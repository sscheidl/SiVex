/*
 * Papierchromatographie – Laborbühne (Canvas 2D, HiDPI)
 *
 * Zeichnet ausschließlich aus dem Modellzustand (liest, verändert nie).
 * Weltkoordinaten in cm; die Bühne wird proportional auf die verfügbare
 * Fläche skaliert. Glas und Flüssigkeit nach TitraLab 3 (lab-renderer.js):
 * Rückwand mit Verlauf, seitliche Abdunkelung, Spiegel mit Meniskus,
 * Vorderkanten und schmale Glanzlichter außerhalb des Papiers.
 */
(function (root) {
  'use strict';
  const M = root.PC.model;
  const { clamp, lerp, easeInOut } = root.LK.core;

  // ------------------------------------------------------------------ Layout
  /**
   * Anordnung (Entwurf 1 von 3, Auswahl siehe docs/TESTBERICHT.md, Abschnitt „Layoutentwürfe“):
   * Arbeitsfläche mit Stifteständer links, Kammer in der Mitte, Laufmittel rechts.
   * compact: schmalere Arbeitsfläche für hochformatige Bühnen (Tablet), damit die Kammer größer wird.
   * Über Kammer und Flaschen bleibt ein Band frei (oberhalb des Deckels): Dort stehen die
   * Meldungen, ohne Papier, Geräte oder Beschriftungen zu verdecken (Befund 6). Animationen
   * (Deckel, Flasche, Papier) bleiben unterhalb dieses Bandes.
   */
  function makeLayout(compact) {
    const L = { compact, W: compact ? 26.7 : 29.6, H: 21.6, bench: 19.6, rack: { y: 18.4 } };
    if (compact) {
      L.chamber = { x: 9.0, w: 15, top: 2.6 };
      L.tile = { x: 0.4, y: 0.6, w: 7.7, h: 11.7 };
      L.paperBench = { x: 0.75, bottom: 11.9, f: 0.78 };
      L.pencil = { x: 8.7, y0: 3.2, y1: 9.6 };
      L.ruler = { x: 7.79 };
      Object.assign(L.rack, { x: 0.45, slot: 1.12 });
      L.bottles = [{ x: 25.35, bottom: 9.6, shelf: true }, { x: 25.35, bottom: 19.6 }];
    } else {
      L.chamber = { x: 10.3, w: 15, top: 2.6 };
      L.tile = { x: 0.4, y: 0.6, w: 8.8, h: 13.1 };
      L.paperBench = { x: 0.8, bottom: 13.3, f: 0.88 };
      L.pencil = { x: 9.75, y0: 3.5, y1: 11 };
      L.ruler = { x: 8.75 };
      Object.assign(L.rack, { x: 0.6, slot: 1.28 });
      L.bottles = [{ x: 27.6, bottom: 9.6, shelf: true }, { x: 27.6, bottom: 19.6 }];
    }
    L.band = { x0: L.chamber.x - 0.2, x1: L.W - 0.15, y0: 0.08, y1: 1.98 };
    const c = L.chamber;
    c.bottom = L.bench;
    c.h = c.bottom - c.top;
    c.glass = 0.3;
    c.floor = c.bottom - 0.45;
    c.cx = c.x + c.w / 2;
    L.paperChamber = { x: c.cx - M.PAPER.width / 2, bottom: c.floor, f: 1 };
    return L;
  }

  /** Lage eines Stifts im Ständer (Fußpunkt, Richtung der Spitze). */
  function penSlot(L, i) {
    const r = L.rack;
    return { x: r.x + r.slot * (i + 0.5), y: r.y + 0.3, angle: 0 };
  }

  /** Punkt auf dem Papier (Papier-cm, y nach oben) → Welt-cm. */
  const paperToWorld = (pp, x, y) => ({ x: pp.x + x * pp.f, y: pp.bottom - y * pp.f });

  // ------------------------------------------------------------------ Farben
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Papierstruktur (feine Fasern), einmal erzeugt
  let fiberCanvas = null;
  function fibers() {
    if (fiberCanvas || typeof document === 'undefined') return fiberCanvas;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.strokeStyle = 'rgba(120,110,90,0.05)';
    g.lineWidth = 1;
    for (let i = 0; i < 420; i++) {
      const x = rnd() * 256, y = rnd() * 256, a = rnd() * Math.PI, l = 4 + rnd() * 10;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    fiberCanvas = c;
    return c;
  }

  // ------------------------------------------------------------------ Papier
  /**
   * Zeichnet ein Chromatographiepapier (Modellpapier oder abgelegtes
   * Chromatogramm) mit Unterkante links bei (pp.x, pp.bottom) im Maßstab pp.f.
   * opts: { time, inChamber, lineProgress, eraseProgress, guides, selectedLane, labels }
   */
  function drawPaper(ctx, p, pp, opts) {
    const o = opts || {};
    const W = M.PAPER.width, H = M.PAPER.height;
    ctx.save();
    ctx.translate(pp.x, pp.bottom);
    ctx.scale(pp.f, pp.f);
    // Schatten und Grund
    ctx.fillStyle = 'rgba(30,40,55,0.10)';
    ctx.fillRect(0.12, -H + 0.12, W, H);
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, -H, W, H);
    const fb = fibers();
    if (fb) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, -H, W, H); ctx.clip();
      ctx.scale(0.02, 0.02);
      ctx.fillStyle = ctx.createPattern(fb, 'repeat');
      ctx.fillRect(0, -H * 50, W * 50, H * 50);
      ctx.restore();
    }
    // Feuchter Bereich und Laufmittelfront
    const sol = p.solvent ? M.SOLVENTS[p.solvent] : null;
    const wetAge = p.state === 'removed' && p.removedAt != null && o.time != null ? o.time - p.removedAt : 0;
    const wetness = p.contact ? (p.state === 'removed' ? clamp(1 - wetAge / M.FRONT_VISIBLE, 0, 1) : 1) : 0;
    if (p.contact && p.front > 0) {
      const f = p.front;
      ctx.fillStyle = rgba(mix(sol.rgb, [150, 170, 190], 0.4), 0.10 + 0.16 * wetness);
      ctx.fillRect(0, -f, W, f);
      // Front: dunklere, leicht wellige Kante
      ctx.strokeStyle = `rgba(90,110,135,${0.22 + 0.45 * wetness})`;
      ctx.lineWidth = 0.045;
      ctx.beginPath();
      for (let x = 0; x <= W + 1e-6; x += 0.25) {
        const y = -f + Math.sin(x * 2.1 + f) * 0.025;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Startlinie (Bleistift)
    const lineLen = p.line ? 1 : (o.lineProgress || 0);
    const lineAlpha = p.line && o.eraseProgress ? 1 - o.eraseProgress : 1;
    if (lineLen > 0) {
      ctx.strokeStyle = `rgba(70,72,78,${0.75 * lineAlpha})`;
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      const x0 = 0.45, x1 = 0.45 + (W - 0.9) * lineLen;
      ctx.moveTo(x0, -M.PAPER.lineY);
      for (let x = x0; x <= x1; x += 0.3) ctx.lineTo(x, -M.PAPER.lineY + Math.sin(x * 3.7) * 0.012);
      ctx.lineTo(x1, -M.PAPER.lineY);
      ctx.stroke();
      if (p.line && o.labels !== false) {
        ctx.fillStyle = `rgba(70,72,78,${0.7 * lineAlpha})`;
        ctx.font = '600 0.42px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        M.PAPER.lanesX.forEach((x, i) => ctx.fillText(String(i + 1), x, -M.PAPER.lineY + 0.6));
      }
    }
    // Hilfsmarken für das Auftragen
    if (o.guides) {
      M.PAPER.lanesX.forEach((x, i) => {
        if (p.lanes[i]) return;
        const y = p.line ? M.PAPER.lineY : M.NOLINE_Y[i];
        ctx.setLineDash([0.12, 0.1]);
        ctx.strokeStyle = o.selectedLane === i ? 'rgba(31,111,209,0.95)' : 'rgba(31,111,209,0.55)';
        ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.arc(x, -y, 0.48, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      });
    }
    // Farbstoffbanden (subtraktiv übereinander)
    ctx.save();
    ctx.beginPath(); ctx.rect(0, -H, W, H); ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    for (const b of M.bands(p)) drawBand(ctx, p, b);
    ctx.restore();
    // Frontmarkierung (Expertenmodus)
    if (p.frontMark != null) {
      ctx.strokeStyle = 'rgba(55,58,66,0.85)';
      ctx.lineWidth = 0.035;
      ctx.setLineDash([0.25, 0.12]);
      ctx.beginPath(); ctx.moveTo(0.3, -p.frontMark); ctx.lineTo(W - 0.3, -p.frontMark); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(120,128,140,0.55)';
    ctx.lineWidth = 0.03;
    ctx.strokeRect(0, -H, W, H);
    ctx.restore();
  }

  function drawBand(ctx, p, b) {
    const l = p.lanes[b.lane];
    const r = M.spotRadius(l.n);
    const rx = r * 1.45 + 0.05 * Math.sqrt(b.s) + (l.n >= M.OVERLOAD ? 0.12 : 0);
    const ry = Math.max(r * 1.05, b.sigma);
    const a = clamp(1.7 * b.amount / Math.sqrt(rx * ry * 4), 0, 0.94);
    if (a < 0.01) return;
    const col = M.COMPONENTS[b.comp].rgb;
    const x = b.x, y = -b.y;
    if (b.tail > 0.02) {
      const g = ctx.createLinearGradient(0, y, 0, y + b.tail + ry);
      g.addColorStop(0, rgba(col, a * 0.55));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y + (b.tail + ry) / 2, rx * 0.8, (b.tail + ry) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.6, rgba(col, a * 0.85));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------ Stifte
  /** Filzstift; Fußpunkt (x, y), angle 0 = Spitze nach oben. */
  function drawPen(ctx, sample, x, y, angle, opts) {
    const o = opts || {};
    const w = 0.95, barrel = 3.0;
    const col = sample.rgb;
    const capCol = sample.id === 'wasserfest' ? [30, 30, 34] : col;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Schatten
    ctx.fillStyle = 'rgba(20,30,40,0.16)';
    roundRect(ctx, -w / 2 + 0.1, -barrel - (o.uncapped ? 0.7 : 1.6) + 0.12, w, barrel + (o.uncapped ? 0.7 : 1.6) + 0.25, 0.3);
    ctx.fill();
    // Endstopfen
    ctx.fillStyle = rgba(mix(capCol, [0, 0, 0], 0.15), 1);
    roundRect(ctx, -w / 2 + 0.06, -0.05, w - 0.12, 0.3, 0.1);
    ctx.fill();
    // Schaft mit Zylinderschattierung
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#c9d0d8'); g.addColorStop(0.22, '#ffffff'); g.addColorStop(0.55, '#eef1f4'); g.addColorStop(1, '#aeb7c2');
    ctx.fillStyle = g;
    roundRect(ctx, -w / 2, -barrel, w, barrel, 0.12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,70,85,0.35)';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    // Farbband
    ctx.fillStyle = rgba(col, 1);
    ctx.fillRect(-w / 2, -barrel + 0.35, w, 0.32);
    // Aufschrift (am Schaft entlang)
    ctx.save();
    ctx.translate(0.02, -1.42);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#1d2733';
    ctx.font = `700 ${sample.label.length > 7 ? 0.31 : 0.37}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sample.label, 0, sample.sub ? -0.12 : 0);
    if (sample.sub) { ctx.font = '600 0.24px system-ui, sans-serif'; ctx.fillStyle = '#4a5868'; ctx.fillText(sample.sub, 0, 0.2); }
    ctx.restore();
    if (o.uncapped) {
      // Spitze: Kegel und Filzspitze
      ctx.fillStyle = '#d5dbe2';
      ctx.beginPath(); ctx.moveTo(-w / 2 + 0.08, -barrel); ctx.lineTo(w / 2 - 0.08, -barrel); ctx.lineTo(0.16, -barrel - 0.45); ctx.lineTo(-0.16, -barrel - 0.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(mix(col, [0, 0, 0], 0.15), 1);
      ctx.beginPath(); ctx.moveTo(-0.15, -barrel - 0.45); ctx.lineTo(0.15, -barrel - 0.45); ctx.quadraticCurveTo(0.1, -barrel - 0.72, 0, -barrel - 0.74); ctx.quadraticCurveTo(-0.1, -barrel - 0.72, -0.15, -barrel - 0.45); ctx.fill();
    } else {
      // Kappe mit Clip
      const cg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      cg.addColorStop(0, rgba(mix(capCol, [0, 0, 0], 0.35), 1)); cg.addColorStop(0.25, rgba(mix(capCol, [255, 255, 255], 0.25), 1)); cg.addColorStop(1, rgba(mix(capCol, [0, 0, 0], 0.4), 1));
      ctx.fillStyle = cg;
      roundRect(ctx, -w / 2 - 0.04, -barrel - 1.6, w + 0.08, 1.75, 0.3);
      ctx.fill();
      ctx.fillStyle = rgba(mix(capCol, [0, 0, 0], 0.5), 1);
      roundRect(ctx, w / 2 - 0.02, -barrel - 1.45, 0.16, 1.2, 0.06);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPencil(ctx, x, y, angle, len) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const w = 0.42;
    // Schatten
    ctx.fillStyle = 'rgba(20,30,40,0.15)';
    ctx.fillRect(-w / 2 + 0.08, -len + 0.1, w, len);
    // Holzspitze unten (y = 0), Radiergummi oben (y = -len)
    ctx.fillStyle = '#e8c49a';
    ctx.beginPath(); ctx.moveTo(-w / 2, -0.9); ctx.lineTo(w / 2, -0.9); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a3d44';
    ctx.beginPath(); ctx.moveTo(-0.07, -0.2); ctx.lineTo(0.07, -0.2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#d9a514'); g.addColorStop(0.35, '#f6cf3b'); g.addColorStop(1, '#c28f0c');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -len + 0.7, w, len - 1.6);
    ctx.fillStyle = '#b8bec6';
    ctx.fillRect(-w / 2, -len + 0.45, w, 0.3);
    ctx.fillStyle = '#e88f8f';
    roundRect(ctx, -w / 2, -len, w, 0.5, 0.08);
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------ Flaschen
  function drawBottle(ctx, solId, cx, bottom, lift, tilt, fillLevel, shelf, open) {
    const sol = M.SOLVENTS[solId];
    const w = 2.5, h = 4.4;
    if (shelf) {
      ctx.fillStyle = '#c9d2dc';
      ctx.fillRect(cx - 1.4, bottom, 2.8, 0.24);
      ctx.fillStyle = '#aab5c1';
      ctx.fillRect(cx - 1.15, bottom + 0.24, 0.18, 0.5);
      ctx.fillRect(cx + 0.97, bottom + 0.24, 0.18, 0.5);
    }
    ctx.save();
    ctx.translate(cx + lift.x, bottom + lift.y);
    ctx.rotate(tilt);
    // Schatten
    if (!tilt) { ctx.fillStyle = 'rgba(20,30,40,0.12)'; ctx.beginPath(); ctx.ellipse(0.2, 0, w * 0.55, 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-w / 2, -0.25);
      ctx.lineTo(-w / 2, -h + 1.3);
      ctx.quadraticCurveTo(-w / 2, -h + 0.75, -0.45, -h + 0.55);
      ctx.lineTo(-0.45, -h);
      ctx.lineTo(0.45, -h);
      ctx.lineTo(0.45, -h + 0.55);
      ctx.quadraticCurveTo(w / 2, -h + 0.75, w / 2, -h + 1.3);
      ctx.lineTo(w / 2, -0.25);
      ctx.quadraticCurveTo(w / 2, 0, w / 2 - 0.25, 0);
      ctx.lineTo(-w / 2 + 0.25, 0);
      ctx.quadraticCurveTo(-w / 2, 0, -w / 2, -0.25);
      ctx.closePath();
    };
    body();
    ctx.fillStyle = 'rgba(225,235,245,0.35)';
    ctx.fill();
    // Inhalt
    ctx.save();
    body(); ctx.clip();
    const lv = -0.1 - (h - 1.6) * fillLevel;
    ctx.fillStyle = rgba(mix(sol.rgb, [120, 160, 200], 0.25), 0.55);
    ctx.fillRect(-w, lv, 2 * w, 2 * h);
    ctx.restore();
    body();
    ctx.strokeStyle = 'rgba(110,130,150,0.75)';
    ctx.lineWidth = 0.05;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-w / 2 + 0.2, -h + 1.4, 0.12, h - 1.9);
    // Deckel (beim Gießen abgeschraubt)
    if (!open) {
      ctx.fillStyle = '#2f5f9e';
      roundRect(ctx, -0.55, -h - 0.55, 1.1, 0.62, 0.1);
      ctx.fill();
    }
    // Etikett
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -w / 2 + 0.15, -h + 1.55, w - 0.3, solId === 'etoh' ? 2.35 : 1.4, 0.1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,95,110,0.35)'; ctx.lineWidth = 0.025; ctx.stroke();
    ctx.fillStyle = '#17212c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (solId === 'etoh') {
      ctx.font = '700 0.4px system-ui, sans-serif';
      ctx.fillText('Ethanol-', 0, -h + 1.95);
      ctx.fillText('Wasser 1 : 1', 0, -h + 2.4);
      // GHS02
      ctx.save();
      ctx.translate(0, -h + 3.2);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(-0.3, -0.3, 0.6, 0.6);
      ctx.strokeStyle = '#d0141c'; ctx.lineWidth = 0.07; ctx.strokeRect(-0.3, -0.3, 0.6, 0.6);
      ctx.restore();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(0, -h + 2.95); ctx.quadraticCurveTo(0.2, -h + 3.2, 0.12, -h + 3.38); ctx.lineTo(-0.12, -h + 3.38); ctx.quadraticCurveTo(-0.2, -h + 3.2, 0, -h + 2.95);
      ctx.fill();
    } else {
      ctx.font = '700 0.5px system-ui, sans-serif';
      ctx.fillText('Wasser', 0, -h + 2.05);
      ctx.font = '600 0.32px system-ui, sans-serif';
      ctx.fillStyle = '#4a5868';
      ctx.fillText('H₂O', 0, -h + 2.55);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Renderer
  function createRenderer(canvas, getState, opts) {
    const ctx = canvas.getContext('2d');
    let L = makeLayout(false);
    const view = { s: 30, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 };
    // Oberflächenwellen beim Eingießen (nur Darstellung; der Füllstand kommt aus dem Modell)
    const wave = { amp: 0, last: null, t: 0, ring: 0 };
    let reduce = false;
    try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ohne */ }

    function resize() {
      const r = canvas.getBoundingClientRect();
      view.dpr = Math.min(2.5, root.devicePixelRatio || 1);
      view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
      canvas.width = Math.round(view.w * view.dpr);
      canvas.height = Math.round(view.h * view.dpr);
      L = makeLayout(view.w / view.h < 1.25);
      view.s = Math.min(view.w / L.W, view.h / L.H);
      view.ox = (view.w - L.W * view.s) / 2;
      view.oy = Math.max(0, (view.h - L.H * view.s) / 2);
    }
    const toScreen = (x, y) => ({ x: view.ox + x * view.s, y: view.oy + y * view.s });

    /** Meldungsband in CSS-Pixeln relativ zur Bühne (oberhalb von Kammer und Geräten). */
    function bandRect() {
      const a = toScreen(L.band.x0, L.band.y0), b = toScreen(L.band.x1, L.band.y1);
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    }

    function updateWave(st) {
      const now = (root.performance ? root.performance.now() : Date.now()) / 1000;
      const dt = wave.last == null ? 0 : Math.min(0.1, now - wave.last);
      wave.last = now;
      wave.t += dt;
      const op = st.op;
      const k = op && op.type === 'pour' ? op.t / op.dur : null;
      const pouring = k != null && k > 0.3 && k < 0.86;
      if (reduce) { wave.amp = 0; return; }
      if (pouring) { wave.amp = Math.min(0.1, wave.amp + dt * 0.35); wave.ring = (wave.ring + dt * 1.6) % 1; }
      else { wave.amp *= Math.exp(-dt / 0.55); if (wave.amp < 0.003) wave.amp = 0; }
    }

    /** Trefferflächen in CSS-Pixeln relativ zur Bühne. */
    function hitAreas(ui) {
      const st = getState();
      const p = st.paper;
      const out = [];
      const rect = (id, x0, y0, x1, y1, extra) => {
        const a = toScreen(x0, y0), b = toScreen(x1, y1);
        const w = Math.max(44, b.x - a.x), h = Math.max(44, b.y - a.y);
        out.push(Object.assign({ id, x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2 - h / 2, w, h }, extra || {}));
      };
      M.SAMPLES.forEach((s, i) => {
        const sl = penSlot(L, i);
        rect('pen:' + s.id, sl.x - 0.6, sl.y - 4.8, sl.x + 0.6, sl.y + 0.2);
      });
      if (p.state === 'bench') {
        M.PAPER.lanesX.forEach((x, i) => {
          const y = p.lanes[i] ? p.lanes[i].y : p.line ? M.PAPER.lineY : M.NOLINE_Y[i];
          const c = paperToWorld(L.paperBench, x, y);
          rect('lane:' + i, c.x - 0.75, c.y - 0.75, c.x + 0.75, c.y + 0.75);
        });
      }
      rect('pencil', L.pencil.x - 0.5, L.pencil.y0, L.pencil.x + 0.5, L.pencil.y1);
      const c = L.chamber;
      rect('chamber', c.x, c.top, c.x + c.w, c.bottom);
      L.bottles.forEach((b, i) => rect('bottle:' + (i === 0 ? 'water' : 'etoh'), b.x - 1.4, b.bottom - 5.0, b.x + 1.4, b.bottom));
      if (p.state === 'removed' && st.expert) {
        const t = paperToWorld(L.paperBench, 0, M.PAPER.height), bt = paperToWorld(L.paperBench, M.PAPER.width, M.PAPER.lineY + 1);
        rect('front', t.x, t.y, bt.x, bt.y);
      }
      return out;
    }

    function opProgress(st, type) {
      return st.op && st.op.type === type ? clamp(st.op.t / st.op.dur, 0, 1) : null;
    }

    // ----- Hintergrund
    function drawRoom() {
      const g = ctx.createLinearGradient(0, 0, 0, L.bench);
      g.addColorStop(0, '#f3f6f9'); g.addColorStop(1, '#e4eaf0');
      ctx.fillStyle = g;
      ctx.fillRect(-5, -5, L.W + 10, L.bench + 5);
      ctx.strokeStyle = 'rgba(160,175,190,0.22)';
      ctx.lineWidth = 0.03;
      for (let y = L.bench - 1.5; y > -5; y -= 1.5) {
        ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(L.W + 5, y); ctx.stroke();
        const off = Math.round(y / 1.5) % 2 ? 0 : 1.5;
        for (let x = -5 + off; x < L.W + 5; x += 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 1.5); ctx.stroke(); }
      }
      const t = ctx.createLinearGradient(0, L.bench, 0, L.H + 5);
      t.addColorStop(0, '#c7d0da'); t.addColorStop(0.08, '#b5c0cc'); t.addColorStop(1, '#8f9cab');
      ctx.fillStyle = t;
      ctx.fillRect(-5, L.bench, L.W + 10, L.H - L.bench + 5);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-5, L.bench, L.W + 10, 0.05);
    }

    function label(text, x, y, opts) {
      const o = opts || {};
      ctx.save();
      ctx.font = `${o.weight || 600} ${(o.size || 13) / view.s}px system-ui, sans-serif`;
      const w = ctx.measureText(text).width + 16 / view.s;
      const h = 22 / view.s;
      ctx.fillStyle = o.bg || 'rgba(255,255,255,0.92)';
      roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
      ctx.fill();
      if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1.5 / view.s; ctx.stroke(); }
      ctx.fillStyle = o.color || '#253241';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + 0.5 / view.s);
      ctx.restore();
    }

    // ----- Kammer
    function chamberPath(inset) {
      const c = L.chamber;
      const x0 = c.x + inset, x1 = c.x + c.w - inset, top = c.top, bot = c.bottom - inset, r = 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, top); ctx.lineTo(x0, bot - r); ctx.quadraticCurveTo(x0, bot, x0 + r, bot);
      ctx.lineTo(x1 - r, bot); ctx.quadraticCurveTo(x1, bot, x1, bot - r); ctx.lineTo(x1, top);
    }

    function drawChamberBack(st) {
      const c = L.chamber;
      // Schatten auf dem Tisch
      ctx.fillStyle = 'rgba(30,40,55,0.12)';
      ctx.beginPath(); ctx.ellipse(c.cx + 0.4, c.bottom + 0.05, c.w * 0.55, 0.28, 0, 0, Math.PI * 2); ctx.fill();
      chamberPath(0); ctx.closePath();
      const back = ctx.createLinearGradient(c.x, 0, c.x + c.w, 0);
      back.addColorStop(0, 'rgba(170,200,230,0.22)'); back.addColorStop(0.5, 'rgba(235,244,252,0.10)'); back.addColorStop(1, 'rgba(170,200,230,0.20)');
      ctx.fillStyle = back;
      ctx.fill();
      // Halter: Glasstab unter dem Deckel
      ctx.fillStyle = 'rgba(150,170,190,0.9)';
      roundRect(ctx, c.x + c.glass, c.top + 0.45, c.w - 2 * c.glass, 0.22, 0.1);
      ctx.fill();
    }

    function liquidY(st) { return L.chamber.floor - st.chamber.level; }

    function drawLiquid(st) {
      const c = L.chamber;
      const lv = st.chamber.level;
      if (lv <= 0.01) return;
      const y = liquidY(st);
      const x0 = c.x + c.glass, x1 = c.x + c.w - c.glass;
      // Welle mit ganzzahliger Periodenzahl über die Breite: Mittelwert = Füllstand des Modells
      const A = Math.min(wave.amp, lv * 0.4);
      const wy = (x) => {
        if (!A) return y;
        const u = (x - x0) / (x1 - x0);
        return y + A * (0.7 * Math.sin(2 * Math.PI * 3 * u - 5.2 * wave.t) + 0.3 * Math.sin(2 * Math.PI * 5 * u + 3.1 * wave.t));
      };
      const surface = (move) => {
        if (move) ctx.moveTo(x0, wy(x0 + 0.4) - men);
        ctx.quadraticCurveTo(x0 + 0.08, wy(x0 + 0.4), x0 + 0.4, wy(x0 + 0.4));
        for (let x = x0 + 0.6; x < x1 - 0.4; x += 0.2) ctx.lineTo(x, wy(x));
        ctx.lineTo(x1 - 0.4, wy(x1 - 0.4));
        ctx.quadraticCurveTo(x1 - 0.08, wy(x1 - 0.4), x1, wy(x1 - 0.4) - men);
      };
      const sol = M.SOLVENTS[st.chamber.solvent || 'water'];
      const tint = st.chamber.tint;
      const base = tint[3] > 0 ? mix(sol.rgb, tint, clamp(tint[3] * 1.2, 0, 0.9)) : sol.rgb;
      const alpha = 0.5 + tint[3] * 0.4;
      ctx.save();
      chamberPath(c.glass); ctx.closePath(); ctx.clip();
      // Flüssigkeit mit Meniskus an den Wänden
      const men = 0.16;
      ctx.beginPath();
      surface(true);
      ctx.lineTo(x1, c.bottom); ctx.lineTo(x0, c.bottom); ctx.closePath();
      const g = ctx.createLinearGradient(0, y, 0, c.floor);
      g.addColorStop(0, rgba(base, alpha * 0.85)); g.addColorStop(1, rgba(base, Math.min(0.95, alpha * 1.2)));
      ctx.fillStyle = g;
      ctx.fill();
      const side = ctx.createLinearGradient(x0, 0, x1, 0);
      side.addColorStop(0, 'rgba(20,40,60,0.16)'); side.addColorStop(0.12, 'rgba(20,40,60,0)'); side.addColorStop(0.88, 'rgba(20,40,60,0)'); side.addColorStop(1, 'rgba(20,40,60,0.18)');
      ctx.fillStyle = side;
      ctx.fill();
      // Spiegel als flache Ellipse (Aufsicht von leicht oben) und helle Kante
      ctx.fillStyle = rgba(mix(base, [255, 255, 255], 0.35), 0.55);
      ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, y, (x1 - x0) / 2 - 0.1, 0.13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.035;
      ctx.beginPath(); surface(true); ctx.stroke();
      // Ringwelle an der Einfallstelle des Strahls
      if (A > 0.01 && st.op && st.op.type === 'pour') {
        const rx = 0.2 + wave.ring * 2.2;
        ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - wave.ring)).toFixed(3)})`;
        ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.ellipse(c.x + c.w - 2.4 - 4.76 - 0.25, y, rx, rx * 0.12 + 0.02, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = rgba(mix(base, [30, 50, 80], 0.6), 0.75);
      ctx.lineWidth = 0.035;
      ctx.beginPath(); for (let x = x0 + 0.4; x <= x1 - 0.4; x += 0.2) { if (x === x0 + 0.4) ctx.moveTo(x, wy(x) + 0.04); else ctx.lineTo(x, wy(x) + 0.04); } ctx.stroke();
      ctx.restore();
    }

    function drawChamberFront(st, lidLift) {
      const c = L.chamber;
      chamberPath(0);
      ctx.strokeStyle = 'rgba(105,135,165,0.9)';
      ctx.lineWidth = 0.07;
      ctx.stroke();
      chamberPath(c.glass);
      ctx.strokeStyle = 'rgba(150,175,200,0.45)';
      ctx.lineWidth = 0.03;
      ctx.stroke();
      // Boden (dickes Glas)
      ctx.fillStyle = 'rgba(180,205,228,0.35)';
      ctx.fillRect(c.x + 0.25, c.floor, c.w - 0.5, c.bottom - c.floor - 0.08);
      // Glanzlichter nur an den Rändern (außerhalb des Papiers)
      const hl = ctx.createLinearGradient(0, c.top, 0, c.bottom);
      hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.2, 'rgba(255,255,255,0.65)'); hl.addColorStop(0.85, 'rgba(255,255,255,0.3)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      ctx.fillRect(c.x + 0.55, c.top + 1.2, 0.16, c.h - 2.2);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(c.x + 0.85, c.top + 2.0, 0.06, c.h - 4);
      ctx.fillRect(c.x + c.w - 0.75, c.top + 1.6, 0.1, c.h - 3);
      ctx.globalAlpha = 1;
      // Oberer Rand
      ctx.strokeStyle = 'rgba(235,245,255,0.95)';
      ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(c.x, c.top); ctx.lineTo(c.x + c.w, c.top); ctx.stroke();
      // Deckel (Glasplatte)
      const ly = c.top - 0.28 - lidLift.y;
      ctx.save();
      ctx.translate(c.cx + lidLift.x, ly);
      ctx.rotate(lidLift.r || 0);
      const lg = ctx.createLinearGradient(0, -0.15, 0, 0.3);
      lg.addColorStop(0, 'rgba(220,235,250,0.65)'); lg.addColorStop(1, 'rgba(170,198,225,0.55)');
      ctx.fillStyle = lg;
      roundRect(ctx, -c.w / 2 - 0.25, 0, c.w + 0.5, 0.28, 0.08);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,180,0.8)'; ctx.lineWidth = 0.03; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-c.w / 2 + 0.4, 0.05, c.w * 0.5, 0.05);
      ctx.restore();
    }

    function drawClip(pp, noWires) {
      const top = pp.bottom - M.PAPER.height * pp.f;
      const cx = pp.x + (M.PAPER.width * pp.f) / 2;
      const c = L.chamber;
      if (!noWires) {
        ctx.strokeStyle = 'rgba(90,100,115,0.9)';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(cx - 0.6, top - 0.25); ctx.lineTo(cx - 0.25, c.top + 0.67);
        ctx.moveTo(cx + 0.6, top - 0.25); ctx.lineTo(cx + 0.25, c.top + 0.67);
        ctx.stroke();
      }
      ctx.fillStyle = '#2c3440';
      roundRect(ctx, cx - 1.1, top - 0.35, 2.2, 0.75, 0.12);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(cx - 1.0, top - 0.3, 2.0, 0.1);
    }

    // ----- Bühne zeichnen
    function draw(ui) {
      const st = getState();
      const p = st.paper;
      updateWave(st);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.clearRect(0, 0, view.w, view.h);
      ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);
      drawRoom();

      const c = L.chamber;
      const tIns = opProgress(st, 'insert'), tRem = opProgress(st, 'remove');
      const moving = tIns != null || tRem != null;
      const mt = tIns != null ? easeInOut(tIns) : tRem != null ? 1 - easeInOut(tRem) : null;
      // Position des Papiers
      let pp = null, inChamber = false;
      if (moving) {
        const a = L.paperBench, b = L.paperChamber;
        const lift = Math.sin(mt * Math.PI) * 0.6;
        pp = { x: lerp(a.x, b.x, mt), bottom: lerp(a.bottom, b.bottom, mt) - lift, f: lerp(a.f, b.f, mt) };
      } else if (p.state === 'chamber') { pp = L.paperChamber; inChamber = true; } else pp = L.paperBench;
      // Deckel hebt sich bei Gießen, Einsetzen und Herausnehmen
      const lidOps = ['pour', 'insert', 'remove'];
      const lidT = st.op && lidOps.includes(st.op.type) ? Math.sin(clamp(st.op.t / st.op.dur, 0, 1) * Math.PI) : 0;
      // beim Gießen nach links geschoben (Flasche kommt von rechts), sonst angehoben
      const lidLift = st.op && st.op.type === 'pour' ? { x: -lidT * 3.4, y: lidT * 0.2, r: 0 } : { x: 0, y: lidT * 0.3, r: 0 };

      // Arbeitsfläche
      const t = L.tile;
      ctx.fillStyle = 'rgba(30,40,55,0.10)';
      roundRect(ctx, t.x + 0.12, t.y + 0.15, t.w, t.h, 0.3); ctx.fill();
      ctx.fillStyle = '#dfe6ee';
      roundRect(ctx, t.x, t.y, t.w, t.h, 0.3); ctx.fill();
      ctx.strokeStyle = 'rgba(140,155,170,0.5)'; ctx.lineWidth = 0.03; ctx.stroke();
      if (p.state === 'chamber' && !moving) {
        ctx.fillStyle = '#5b6b7d';
        ctx.font = `600 ${14 / view.s}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Das Papier hängt', t.x + t.w / 2, t.y + t.h / 2 - 10 / view.s);
        ctx.fillText('in der Kammer.', t.x + t.w / 2, t.y + t.h / 2 + 10 / view.s);
      }

      drawChamberBack(st);
      // Papier in der Kammer (hinter Flüssigkeit und Frontglas)
      const lineP = opProgress(st, 'line'), eraseP = opProgress(st, 'erase');
      const paperOpts = { time: st.time, lineProgress: lineP, eraseProgress: eraseP, guides: p.state === 'bench' && !moving && !!ui.selectedPen, selectedLane: ui.hoverLane };
      const newP = opProgress(st, 'newPaper');
      if (inChamber) { drawPaper(ctx, p, pp, paperOpts); drawClip(pp); }
      drawLiquid(st);
      drawChamberFront(st, lidLift);
      if (!inChamber && !moving) {
        ctx.save();
        if (newP != null) {
          // altes Papier gleitet weg, neues kommt
          const k = newP < 0.5 ? easeInOut(newP * 2) : 1 - easeInOut((newP - 0.5) * 2);
          ctx.globalAlpha = 1 - k * 0.9;
          ctx.translate(-k * 2.0, 0);
        }
        drawPaper(ctx, p, pp, paperOpts);
        ctx.restore();
      }

      // Lineal (Expertenmodus), Nullpunkt auf der Startlinie
      if (st.expert && p.state === 'removed') drawRuler();

      // Bleistift
      const pen = L.pencil;
      let pencilPos = { x: pen.x, y: pen.y1, a: 0 };
      if (lineP != null || eraseP != null || opProgress(st, 'mark') != null) {
        const k = lineP != null ? lineP : eraseP != null ? 1 - eraseP : opProgress(st, 'mark');
        const yLine = opProgress(st, 'mark') != null ? p.front : M.PAPER.lineY;
        const appr = clamp(k / 0.15, 0, 1), back = clamp((k - 0.85) / 0.15, 0, 1);
        const along = clamp((k - 0.15) / 0.7, 0, 1);
        const target = paperToWorld(L.paperBench, 0.45 + (M.PAPER.width - 0.9) * along, yLine);
        const mix2 = appr * (1 - back);
        pencilPos = { x: lerp(pen.x, target.x, mix2), y: lerp(pen.y1, target.y, mix2), a: lerp(0, -0.5, mix2) };
        if (eraseP != null) pencilPos.a = lerp(0, Math.PI - 0.5, mix2);
      }
      drawPencil(ctx, pencilPos.x, pencilPos.y, pencilPos.a, pen.y1 - pen.y0);

      // Laufmittelflaschen
      const pourP = opProgress(st, 'pour');
      L.bottles.forEach((b, i) => {
        const id = i === 0 ? 'water' : 'etoh';
        let lift = { x: 0, y: 0 }, tilt = 0;
        if (pourP != null && st.op.solvent === id) {
          const k = pourP < 0.25 ? easeInOut(pourP / 0.25) : pourP > 0.85 ? 1 - easeInOut((pourP - 0.85) / 0.15) : 1;
          const tx = c.x + c.w - 2.4 - b.x, ty = c.top + 0.7 - b.bottom; // Flasche bleibt unter dem Meldungsband
          lift = { x: tx * k, y: ty * k };
          const tk = clamp((pourP - 0.22) / 0.12, 0, 1) * (1 - clamp((pourP - 0.8) / 0.08, 0, 1));
          tilt = -1.85 * tk;
          if (tk > 0.9) {
            // Strahl aus der Öffnung (Hals oben bei (0, −4,95), um den Kippwinkel gedreht)
            const nx = b.x + lift.x + 4.95 * Math.sin(tilt), ny = b.bottom + lift.y - 4.95 * Math.cos(tilt);
            ctx.strokeStyle = rgba(mix(M.SOLVENTS[id].rgb, [90, 140, 200], 0.35), 0.7);
            ctx.lineWidth = 0.14;
            ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo(nx - 0.2, ny + 2, nx - 0.25, liquidY(st) + 0.05); ctx.stroke();
          }
        }
        drawBottle(ctx, id, b.x, b.bottom, lift, tilt, 0.72, b.shelf, tilt !== 0);
      });

      // Stifte
      const spotP = opProgress(st, 'spot');
      M.SAMPLES.forEach((s, i) => {
        const sl = penSlot(L, i);
        const sel = ui.selectedPen === s.id;
        if (spotP != null && st.op.sampleId === s.id) {
          const lane = st.op.lane;
          const ly = p.lanes[lane] ? p.lanes[lane].y : p.line ? M.PAPER.lineY : M.NOLINE_Y[lane];
          const tgt = paperToWorld(L.paperBench, M.PAPER.lanesX[lane], ly);
          // Spitze (3,74 cm vor dem Fußpunkt) zum Fleck führen, leicht schräg
          const ang = 0.35;
          const tipLen = 3.74;
          const foot = { x: tgt.x - Math.sin(ang) * tipLen, y: tgt.y + Math.cos(ang) * tipLen };
          const start = { x: sl.x, y: sl.y - 1.1 };
          const k = spotP < 0.4 ? easeInOut(spotP / 0.4) : spotP > 0.62 ? 1 - easeInOut((spotP - 0.62) / 0.38) : 1;
          const press = spotP > 0.4 && spotP < 0.62 ? Math.sin((spotP - 0.4) / 0.22 * Math.PI) * 0.12 : 0;
          drawPen(ctx, s, lerp(start.x, foot.x, k) + Math.sin(ang) * press, lerp(start.y, foot.y, k) - Math.cos(ang) * press, lerp(sl.angle, ang, k), { uncapped: true });
          return;
        }
        drawPen(ctx, s, sl.x, sl.y - (sel ? 1.1 : 0), sl.angle, { uncapped: sel });
        if (sel) {
          ctx.strokeStyle = 'rgba(31,111,209,0.95)';
          ctx.lineWidth = 3 / view.s;
          roundRect(ctx, sl.x - 0.64, sl.y - 5.25, 1.28, 5.1, 0.25);
          ctx.stroke();
        }
      });
      // Ständer (vor den Stiften)
      {
        const r = L.rack;
        const g = ctx.createLinearGradient(0, r.y, 0, L.bench);
        g.addColorStop(0, '#5f6d7d'); g.addColorStop(1, '#3f4b58');
        ctx.fillStyle = g;
        roundRect(ctx, r.x - 0.1, r.y, r.slot * 7 + 0.2, L.bench - r.y, 0.2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(r.x, r.y + 0.06, r.slot * 7, 0.08);
      }

      // Papier, das gerade eingehängt oder herausgenommen wird, liegt über allem
      if (moving) { drawPaper(ctx, p, pp, paperOpts); drawClip(pp, true); }

      // Beschriftungen auf der Tischkante
      const ly = L.bench + (L.H - L.bench) / 2;
      const chamberText = st.chamber.solvent ? 'Entwicklungskammer · ' + M.SOLVENTS[st.chamber.solvent].short : 'Entwicklungskammer · leer';
      label(chamberText, c.cx, ly);
      const name = ui.selectedPen ? M.SAMPLE_BY_ID[ui.selectedPen].name : 'Stifte: antippen zum Auswählen';
      label(name, L.rack.x + L.rack.slot * 3.5, ly, ui.selectedPen ? { border: 'rgba(31,111,209,0.9)', color: '#14457f' } : {});
      label('Laufmittel', L.bottles[1].x, ly);
    }

    function drawRuler() {
      const pp = L.paperBench;
      const x = L.ruler.x;
      const y0 = paperToWorld(pp, 0, M.PAPER.lineY).y;
      const len = (M.PAPER.height - M.PAPER.lineY) * pp.f;
      ctx.save();
      ctx.fillStyle = 'rgba(250,252,255,0.88)';
      roundRect(ctx, x, y0 - len - 0.2, 0.62, len + 0.5, 0.06);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,100,120,0.6)'; ctx.lineWidth = 0.02; ctx.stroke();
      ctx.strokeStyle = '#2a3440';
      ctx.fillStyle = '#2a3440';
      ctx.font = `600 ${10.5 / view.s}px system-ui, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (let mm = 0; mm <= 120; mm++) {
        const y = y0 - (mm / 10) * pp.f;
        const lenT = mm % 10 === 0 ? 0.32 : mm % 5 === 0 ? 0.22 : 0.12;
        ctx.lineWidth = mm % 10 === 0 ? 0.025 : 0.014;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + lenT, y); ctx.stroke();
        if (mm % 10 === 0) ctx.fillText(String(mm / 10), x + 0.36, y);
      }
      ctx.restore();
    }

    return { resize, draw, hitAreas, bandRect, view, get layout() { return L; }, toScreen, drawPaper, waveAmp: () => wave.amp };
  }

  /** Kleines Chromatogramm (Ergebnisse) in ein eigenes Canvas zeichnen. */
  function drawThumb(canvas, snap, cssW) {
    const dpr = Math.min(2.5, root.devicePixelRatio || 1);
    const s = cssW / (M.PAPER.width + 0.6);
    const cssH = s * (M.PAPER.height + 0.6);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    ctx.fillStyle = '#e6ecf2';
    ctx.fillRect(0, 0, M.PAPER.width + 0.6, M.PAPER.height + 0.6);
    drawPaper(ctx, snap, { x: 0.3, bottom: M.PAPER.height + 0.3, f: 1 }, { time: snap.removedAt + M.FRONT_VISIBLE });
  }

  (root.PC = root.PC || {}).render = { createRenderer, makeLayout, penSlot, paperToWorld, drawPaper, drawThumb };
})(typeof self !== 'undefined' ? self : this);
