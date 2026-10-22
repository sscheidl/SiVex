/*
 * Redoxlabor – Darstellung (Canvas 2D)
 *
 * Zeichnet den Labortisch ausschließlich aus dem Zustand der
 * Experimentsteuerung (RL.lab) und dem optischen Modell der Chemie-Engine
 * (RL.chem.appearance). Eigene Zustände des Renderers sind rein visuell:
 * Glättung von Farbwechseln, Partikelbewegung, Wellen und Tropfen.
 */
(function (root) {
  'use strict';
  const RL = root.RL;
  const chem = RL.chem;
  const { clamp, lerp, smooth } = chem.util;

  const W = 1400, H = 1000;
  const TUBE = { w: 38, h: 270, r: 19, wall: 2.4, portionH: 24 };
  const Z = 2.25; // Vergrößerung der Lupe

  const L = {
    detail: { x: 22, y: 22, w: 420, h: 508 },
    shelf: { x0: 470, x1: 1382, y: 300 },
    reagentX: { fehling1: 556, fehling2: 727, agno3: 898, naoh: 1069, nh3: 1240 },
    bottle: { w: 112, h: 190 },
    sample: { baseY: 694, x0: 84, dx: 78, w: 58, h: 118 },
    rack: { x0: 516, x1: 904, baseY: 908, slotX: [578, 666, 754, 842], tubeBottom: 884, railY: 700 },
    bath: { cx: 1052, plateTop: 842, beakerBottom: 838, beakerTop: 612, beakerHalf: 112, water: 655, slotX: [1016, 1076], tubeBottom: 826 },
    burner: { cx: 1292, baseY: 906, topY: 756 },
    flameTube: { x: 1292, y: 694, angle: -0.5 },
    holder: { x: 205, y: 952 },
    benchTop: 606, benchFront: 966
  };
  const LIFT = 236;

  // --------------------------------------------------------------- Farbe
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? (c[3] == null ? 1 : c[3]) : a})`;
  const shade = (c, f) => [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255), c[3]];
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3] == null ? 1 : a[3], b[3] == null ? 1 : b[3], t)];
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Reproduzierbarer Zufall pro Reagenzglas
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function createRenderer(canvas, lab) {
    const ctx = canvas.getContext('2d');
    let dpr = 1, scale = 1, ox = 0, oy = 0, cssW = 0, cssH = 0;
    let bg = null;
    let time = 0;
    const visuals = new Map();
    const splats = [];
    const sprays = [];
    const bubbles = [];
    const steam = [];
    const drops = [];
    const pointer = { hover: null, drag: null };
    let noise = null;
    const silverCanvas = document.createElement('canvas');
    const sctx = silverCanvas.getContext('2d');

    // ------------------------------------------------------------- Größe
    function resize() {
      const rect = canvas.getBoundingClientRect();
      cssW = Math.max(1, rect.width); cssH = Math.max(1, rect.height);
      const raw = root.devicePixelRatio || 1;
      dpr = Math.min(raw, cssW * cssH > 1.6e6 ? 1.5 : 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      scale = Math.min(cssW / W, cssH / H);
      ox = (cssW - W * scale) / 2;
      oy = (cssH - H * scale) / 2;
      bg = null;
    }

    function toLogical(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
    }
    function toClient(x, y) {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ox + x * scale, y: rect.top + oy + y * scale };
    }

    /** Kachelbare Wolkentextur für Trübungen: weiche Schlieren plus feines Korn. */
    function makeNoise() {
      const N = 128;
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      const r = rng(99);
      const blob = (x, y, rad, col, a) => {
        for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
          const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
          gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
        }
      };
      for (let i = 0; i < 70; i++) blob(r() * N, r() * N, 6 + r() * 22, r() < 0.5 ? '0,0,0' : '255,255,255', 0.05 + r() * 0.12);
      for (let i = 0; i < 1100; i++) {
        const v = r() < 0.55 ? 0 : 255;
        g.fillStyle = `rgba(${v},${v},${v},${0.06 + r() * 0.16})`;
        g.fillRect(r() * N, r() * N, 0.6 + r() * 0.9, 0.6 + r() * 0.9);
      }
      return c;
    }

    // ------------------------------------------------------- Visualzustand
    function visualFor(t) {
      const key = lab.state.runId + ':' + t.id + ':' + t.generation;
      let v = visuals.get(t.id);
      if (!v || v.key !== key) {
        const r = rng(t.id * 7919 + t.generation * 104729 + lab.state.runId * 31);
        v = {
          key, rnd: r, vol: 0, app: null, wave: 0, phase: 0, tilt: 0, tiltV: 0, surge: 0,
          layer: null, plumes: [], particles: [], settle: 0, mirrorH: 0, fade: 1,
          sites: makeSites(r), sparkles: []
        };
        for (let i = 0; i < 260; i++) {
          v.particles.push({ u: r() * 2 - 1, v: r(), s: 0.6 + r() * 0.9, k: r(), ph: r() * 6.28 });
        }
        visuals.set(t.id, v);
      }
      return v;
    }

    function makeSites(r) {
      const sites = [];
      for (let i = 0; i < 150; i++) {
        sites.push({
          u: r() * 2.2 - 1.1, v: Math.pow(r(), 0.85), birth: r() * 0.62, grow: 0.25 + r() * 0.35,
          rad: 2.5 + r() * 6.5, ax: 0.6 + r() * 0.9, alpha: 0.55 + r() * 0.45, rot: r() * 3.14
        });
      }
      return sites;
    }

    lab.on('added', (e) => {
      const t = lab.tubeById(e.tubeId);
      if (!t) return;
      const v = visualFor(t);
      const sub = e.substance;
      const pure = chem.createContents();
      chem.add(pure, sub);
      const subApp = chem.appearance(pure);
      const vol = chem.volume(t.contents);
      if (vol > 1 && v.app && t.contents.mix < 0.98) {
        v.layer = { lower: v.app.body.slice(), upper: subApp.body.slice(), frac: 1 / vol };
      } else {
        v.layer = null;
      }
      v.plumes.push({ u: 0, v: 1, r: 0.25, a: 0.7, c: subApp.body.slice(), age: 0 });
      v.wave = Math.min(4, v.wave + 2.2);
      v.settle = 0;
    });

    // ------------------------------------------------------------ Positionen
    function restPose(place, slot) {
      if (place === 'rack') return { x: L.rack.slotX[slot], y: L.rack.tubeBottom, a: 0 };
      if (place === 'bath') return { x: L.bath.slotX[slot], y: L.bath.tubeBottom, a: 0 };
      if (place === 'flame') return { x: L.flameTube.x, y: L.flameTube.y, a: L.flameTube.angle };
      return { x: 0, y: 0, a: 0 };
    }

    /** Lage eines Reagenzglases: Unterkante (x,y), Winkel a, Haltergriff */
    function tubePose(t) {
      const op = lab.state.op;
      if (op && op.type === 'move' && op.tubeId === t.id) {
        const p = clamp(op.t / op.dur);
        const A = restPose(op.from.place, op.from.slot);
        const B = restPose(op.to.place, op.to.slot);
        const liftA = A.a !== 0 ? 120 : LIFT, liftB = B.a !== 0 ? 120 : LIFT;
        let x, y, a;
        if (p < 0.3) {
          const q = ease(p / 0.3);
          x = A.x; y = A.y - liftA * q; a = A.a * (1 - q);
        } else if (p < 0.72) {
          const q = ease((p - 0.3) / 0.42);
          x = lerp(A.x, B.x, q); y = lerp(A.y - liftA, B.y - liftB, q) - Math.sin(q * Math.PI) * 40; a = B.a * q * 0;
        } else {
          const q = ease((p - 0.72) / 0.28);
          x = B.x; y = B.y - liftB * (1 - q); a = B.a * q;
        }
        return { x, y, a, holder: true, moving: true };
      }
      const pose = restPose(t.place, t.slot);
      pose.holder = t.place === 'flame';
      if (op && op.type === 'shake' && op.tubeId === t.id) {
        const p = op.t / op.dur;
        pose.shake = 0.24 * Math.sin(p * Math.PI * 2 * 4.5) * Math.sin(Math.PI * p);
        pose.y -= 30 * Math.sin(Math.PI * p);
      }
      if (op && op.type === 'bump' && op.tubeId === t.id) {
        const p = op.t / op.dur;
        pose.jolt = Math.sin(p * 60) * 2.5 * (1 - p);
      }
      return pose;
    }

    // ============================================================ Zeichnen
    function frame(dtRaw) {
      const dt = Math.min(0.05, Math.max(0, dtRaw));
      time += dt;
      if (!noise) noise = makeNoise();
      if (!bg) bg = renderBackground();
      updateVisuals(dt);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

      drawDetailPanel();
      drawReagentShelf();
      drawSamples();
      drawBath(false);
      drawRack(false);
      for (const t of lab.state.tubes) {
        if (t.place === 'rack') drawTubeWorld(t);
      }
      drawRack(true);
      drawBurner(false);
      drawHolderRest();
      for (const t of lab.state.tubes) if (t.place === 'flame') drawTubeWorld(t);
      drawBurner(true);
      for (const t of lab.state.tubes) if (t.place === 'moving') drawTubeWorld(t);
      drawPipetteOp();
      drawDrops();
      drawSprays(dt);
      drawBadges();
      drawDragGhost();
    }

    // -------------------------------------------------------- Hintergrund
    function renderBackground() {
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      const g = c.getContext('2d');
      // Fläche außerhalb der Szene passend fortsetzen
      g.setTransform(1, 0, 0, 1, 0, 0);
      const wallGrad = g.createLinearGradient(0, 0, 0, c.height);
      const benchY = (oy + L.benchTop * scale) * dpr;
      wallGrad.addColorStop(0, '#e8edf2');
      wallGrad.addColorStop(Math.min(0.99, benchY / c.height), '#dce3ea');
      wallGrad.addColorStop(Math.min(1, benchY / c.height + 0.001), '#c9d1d8');
      wallGrad.addColorStop(1, '#b7c0c8');
      g.fillStyle = wallGrad;
      g.fillRect(0, 0, c.width, c.height);

      g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      const x0 = -ox / scale - 2, x1 = (cssW - ox) / scale + 2;
      // Wand
      const wg = g.createLinearGradient(0, 0, 0, L.benchTop);
      wg.addColorStop(0, '#eef2f6'); wg.addColorStop(1, '#dfe6ec');
      g.fillStyle = wg; g.fillRect(x0, -oy / scale - 2, x1 - x0, L.benchTop + oy / scale + 2);
      // Fliesenspiegel
      const tileTop = 340;
      g.fillStyle = '#f4f7f9';
      g.fillRect(x0, tileTop, x1 - x0, L.benchTop - tileTop);
      g.strokeStyle = 'rgba(120,140,155,0.13)'; g.lineWidth = 1;
      for (let y = tileTop; y <= L.benchTop; y += 33) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      let row = 0;
      for (let y = tileTop; y < L.benchTop; y += 33, row++) {
        for (let x = Math.floor(x0 / 66) * 66 + (row % 2) * 33; x < x1; x += 66) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(L.benchTop, y + 33)); g.stroke(); }
      }
      // Lichteinfall
      const light = g.createRadialGradient(300, -100, 50, 300, -100, 1100);
      light.addColorStop(0, 'rgba(255,255,255,0.55)'); light.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = light; g.fillRect(x0, -50, x1 - x0, L.benchTop + 50);
      // Wandregal
      const s = L.shelf;
      g.fillStyle = 'rgba(40,55,70,0.12)';
      g.fillRect(s.x0 + 8, s.y + 18, s.x1 - s.x0 - 16, 14);
      [s.x0 + 50, s.x1 - 50].forEach((bx) => {
        g.fillStyle = '#9aa6b1';
        g.beginPath(); g.moveTo(bx - 5, s.y + 16); g.lineTo(bx + 5, s.y + 16); g.lineTo(bx + 5, s.y + 60); g.lineTo(bx - 5, s.y + 30); g.closePath(); g.fill();
      });
      const sg = g.createLinearGradient(0, s.y - 4, 0, s.y + 18);
      sg.addColorStop(0, '#fbfcfd'); sg.addColorStop(0.3, '#e6ebef'); sg.addColorStop(1, '#b9c3cc');
      g.fillStyle = sg;
      roundRect(g, s.x0, s.y - 4, s.x1 - s.x0, 22, 3); g.fill();
      // Labortisch
      const bt = g.createLinearGradient(0, L.benchTop, 0, L.benchFront);
      bt.addColorStop(0, '#c3ccd4'); bt.addColorStop(0.25, '#d3dbe1'); bt.addColorStop(1, '#e3e8ec');
      g.fillStyle = bt; g.fillRect(x0, L.benchTop, x1 - x0, L.benchFront - L.benchTop);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0, L.benchTop, x1 - x0, 2);
      const bf = g.createLinearGradient(0, L.benchFront, 0, H + 40);
      bf.addColorStop(0, '#5b6873'); bf.addColorStop(0.15, '#3f4a54'); bf.addColorStop(1, '#2b333a');
      g.fillStyle = bf; g.fillRect(x0, L.benchFront, x1 - x0, H + 200);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x0, L.benchFront, x1 - x0, 1.5);
      // Beschriftungen auf dem Tisch
      plaque(g, (L.sample.x0 + L.sample.x0 + 5 * L.sample.dx) / 2, L.sample.baseY + 20, 'Stoffproben');
      plaque(g, (L.rack.x0 + L.rack.x1) / 2, L.rack.baseY + 34, 'Reagenzglasständer');
      plaque(g, L.bath.cx, L.rack.baseY + 34, 'Wasserbad auf Heizplatte');
      plaque(g, L.burner.cx, L.rack.baseY + 34, 'Gasbrenner');
      plaque(g, L.holder.x, L.holder.y - 26, 'Reagenzglashalter');
      gogglesSign(g, 1336, 452);
      return c;
    }

    /** Gebotszeichen „Augenschutz benutzen“ (vereinfacht) */
    function gogglesSign(g, x, y) {
      g.save();
      g.fillStyle = '#fff'; roundRect(g, x - 40, y - 40, 80, 104, 8); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.08)'; g.stroke();
      g.fillStyle = '#1f5fbf'; g.beginPath(); g.arc(x, y, 31, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      roundRect(g, x - 22, y - 9, 44, 18, 8); g.fill();
      g.fillStyle = '#1f5fbf';
      g.beginPath(); g.ellipse(x - 10, y, 7.5, 6, 0, 0, Math.PI * 2); g.ellipse(x + 10, y, 7.5, 6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 22, y - 2); g.lineTo(x - 28, y - 6); g.moveTo(x + 22, y - 2); g.lineTo(x + 28, y - 6); g.stroke();
      g.fillStyle = '#2b3640'; g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('Schutzbrille', x, y + 46); g.fillText('tragen', x, y + 59);
      g.restore();
    }

    function plaque(g, x, y, text) {
      g.save();
      g.font = '600 15px system-ui, -apple-system, "Segoe UI", sans-serif';
      const w = g.measureText(text).width + 18;
      g.fillStyle = 'rgba(255,255,255,0.7)';
      roundRect(g, x - w / 2, y - 11, w, 22, 11); g.fill();
      g.fillStyle = '#4b5966'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, x, y + 0.5);
      g.restore();
    }

    function roundRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }

    function shadow(x, y, rx, ry, a) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, `rgba(30,40,50,${a})`); gr.addColorStop(1, 'rgba(30,40,50,0)');
      ctx.save(); ctx.fillStyle = gr; ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
      ctx.beginPath(); ctx.arc(x, y, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    // ---------------------------------------------------------- Flaschen
    function bottlePath(g, x, base, w, h, neckW, neckH) {
      const bodyTop = base - h + neckH + 28;
      const r = 12;
      g.beginPath();
      g.moveTo(x - neckW / 2, base - h);
      g.lineTo(x - neckW / 2, base - h + neckH);
      g.bezierCurveTo(x - neckW / 2, bodyTop - 6, x - w / 2, bodyTop - 14, x - w / 2, bodyTop + 8);
      g.lineTo(x - w / 2, base - r);
      g.quadraticCurveTo(x - w / 2, base, x - w / 2 + r, base);
      g.lineTo(x + w / 2 - r, base);
      g.quadraticCurveTo(x + w / 2, base, x + w / 2, base - r);
      g.lineTo(x + w / 2, bodyTop + 8);
      g.bezierCurveTo(x + w / 2, bodyTop - 14, x + neckW / 2, bodyTop - 6, x + neckW / 2, base - h + neckH);
      g.lineTo(x + neckW / 2, base - h);
      g.closePath();
      return bodyTop;
    }

    function drawBottle(x, base, spec, inUse, glow) {
      const { w, h } = spec;
      const neckW = w * 0.34, neckH = h * 0.14;
      shadow(x, base + 2, w * 0.62, 9, 0.28);
      if (glow) glowRing(() => bottlePath(ctx, x, base, w, h, neckW, neckH), glow);
      // Pipette steht in der Flasche (hinter Glas und Etikett, Kolben oben sichtbar)
      const neckTop = base - h;
      if (!inUse) drawPipette(x, neckTop + (spec.pipDepth || 62), spec.bulb || '#c8403a', spec.liquid, 0.4, spec.pipLen || 118);
      ctx.save();
      const bodyTop = bottlePath(ctx, x, base, w, h, neckW, neckH);
      ctx.clip();
      if (spec.brown) {
        const gb = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        gb.addColorStop(0, 'rgba(70,35,12,0.92)'); gb.addColorStop(0.35, 'rgba(140,72,26,0.86)'); gb.addColorStop(1, 'rgba(60,30,10,0.94)');
        ctx.fillStyle = gb; ctx.fillRect(x - w, base - h - 5, w * 2, h + 10);
      } else {
        ctx.fillStyle = 'rgba(205,225,238,0.22)'; ctx.fillRect(x - w, base - h - 5, w * 2, h + 10);
        const lvl = base - (h - neckH - 40) * 0.72;
        const c = spec.liquid;
        const lg = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        lg.addColorStop(0, rgba(shade(c, 0.78), Math.min(1, c[3] + 0.18)));
        lg.addColorStop(0.45, rgba(c, c[3]));
        lg.addColorStop(1, rgba(shade(c, 0.72), Math.min(1, c[3] + 0.2)));
        ctx.fillStyle = lg; ctx.fillRect(x - w, lvl, w * 2, base - lvl + 2);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - w, lvl, w * 2, 1.5);
      }
      ctx.restore();
      // Glasrand
      ctx.save();
      bottlePath(ctx, x, base, w, h, neckW, neckH);
      ctx.strokeStyle = spec.brown ? 'rgba(40,20,5,0.55)' : 'rgba(90,115,135,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
      // Glanz
      ctx.save();
      const hl = ctx.createLinearGradient(x - w / 2, 0, x - w / 2 + 18, 0);
      hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(255,255,255,0.65)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.fillRect(x - w / 2 + 6, bodyTop + 6, 18, base - bodyTop - 18);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + w / 2 - 16, bodyTop + 14, 5, base - bodyTop - 34);
      ctx.restore();
      // Etikett
      const lw = w * 0.8, lh = spec.labelH || 64, ly = base - 18 - lh;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#fdfdfb'; roundRect(ctx, x - lw / 2, ly, lw, lh, 4); ctx.fill();
      ctx.restore();
      ctx.fillStyle = spec.stripe || '#2f6fd1'; ctx.fillRect(x - lw / 2, ly, lw, 7);
      ctx.fillStyle = '#1d2733'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${spec.titleSize || 17}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      const lines = spec.title;
      const ts = spec.titleSize || 17;
      lines.forEach((ln, i) => ctx.fillText(ln, x, ly + 9 + ts * 1.05 + i * ts * 1.08));
      if (spec.sub) {
        ctx.font = `500 ${spec.subSize || 12.5}px system-ui, -apple-system, "Segoe UI", sans-serif`; ctx.fillStyle = '#56616d';
        ctx.fillText(spec.sub, x, ly + lh - 7);
      }
      // geöffneter Flaschenhals, solange die Pipette benutzt wird
      if (inUse) {
        ctx.fillStyle = 'rgba(60,70,80,0.35)';
        ctx.beginPath(); ctx.ellipse(x, neckTop, neckW / 2, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, neckTop, neckW / 2, 4, 0, Math.PI, 0); ctx.stroke();
      ctx.restore();
    }

    function glowRing(pathFn, strength) {
      ctx.save();
      pathFn();
      const pulse = 0.65 + 0.35 * Math.sin(time * 4);
      ctx.shadowColor = `rgba(40,140,255,${0.85 * strength * pulse})`;
      ctx.shadowBlur = 22;
      ctx.strokeStyle = `rgba(60,150,255,${0.9 * strength})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    function reagentSpec(id) {
      const r = chem.REAGENT_BY_ID[id];
      const base = { w: L.bottle.w, h: L.bottle.h, liquid: r.color, labelH: 66 };
      switch (id) {
        case 'fehling1': return Object.assign(base, { title: ['Fehling I'], sub: 'CuSO₄(aq)', stripe: '#2f7fd8' });
        case 'fehling2': return Object.assign(base, { title: ['Fehling II'], sub: 'Tartrat, NaOH(aq)', stripe: '#6b8bb0' });
        case 'agno3': return Object.assign(base, { title: ['Silber-', 'nitrat'], sub: 'AgNO₃(aq)', brown: true, stripe: '#8a8f96', titleSize: 16, labelH: 74 });
        case 'naoh': return Object.assign(base, { title: ['Natron-', 'lauge'], sub: 'NaOH(aq)', stripe: '#d0782f', titleSize: 16, labelH: 74 });
        case 'nh3': return Object.assign(base, { title: ['Ammoniak-', 'lösung'], sub: 'NH₃(aq)', stripe: '#3c9a6a', titleSize: 16, labelH: 74 });
      }
      return base;
    }

    function drawReagentShelf() {
      const op = lab.state.op;
      for (const r of chem.REAGENTS) {
        const x = L.reagentX[r.id];
        const inUse = op && op.type === 'add' && op.substance === r.id;
        const armed = lab.state.armed && lab.state.armed.id === r.id;
        const hover = pointer.hover && pointer.hover.type === 'reagent' && pointer.hover.id === r.id;
        drawBottle(x, L.shelf.y - 4, reagentSpec(r.id), inUse, armed ? 1 : hover ? 0.5 : 0);
      }
    }

    function drawSamples() {
      const op = lab.state.op;
      const S = L.sample;
      lab.state.samples.forEach((s, i) => {
        const x = S.x0 + i * S.dx;
        const inUse = op && op.type === 'add' && op.substance === s.sampleId;
        const armed = lab.state.armed && lab.state.armed.id === s.sampleId;
        const hover = pointer.hover && pointer.hover.type === 'sample' && pointer.hover.id === s.sampleId;
        const learn = lab.state.mode === 'learn';
        const name = s.label;
        const title = learn ? (name.length > 8 ? splitName(name) : [name]) : [s.key];
        drawBottle(x, S.baseY, {
          w: S.w, h: S.h, liquid: [236, 244, 250, 0.16], title, sub: learn ? chem.SAMPLE_BY_ID[s.sampleId].formula : 'Probe',
          stripe: learn ? (chem.SAMPLE_BY_ID[s.sampleId].cls === 'aldehyd' ? '#8a6bd1' : '#4aa3a1') : '#7b8794',
          titleSize: learn ? 11 : 20, labelH: learn && title.length > 1 ? 56 : 48, bulb: '#2b2f33', pipLen: 76, pipDepth: 84, subSize: 10.5
        }, inUse, armed ? 1 : hover ? 0.5 : 0);
      });
    }
    function splitName(n) {
      const i = n.indexOf('-');
      if (i > 0) return [n.slice(0, i + 1), n.slice(i + 1)];
      return [n.slice(0, 5) + '-', n.slice(5)];
    }

    // ---------------------------------------------------------- Pipette
    function drawPipette(x, tipY, bulbColor, liquid, fill, len) {
      const glassTop = tipY - len;
      ctx.save();
      // Glasrohr
      ctx.beginPath();
      ctx.moveTo(x - 1.2, tipY); ctx.lineTo(x - 3.4, tipY - 38); ctx.lineTo(x - 3.4, glassTop);
      ctx.lineTo(x + 3.4, glassTop); ctx.lineTo(x + 3.4, tipY - 38); ctx.lineTo(x + 1.2, tipY); ctx.closePath();
      ctx.fillStyle = 'rgba(220,235,245,0.45)'; ctx.fill();
      if (fill > 0 && liquid) {
        ctx.save(); ctx.clip();
        const ly = tipY - 60 * fill;
        ctx.fillStyle = rgba(liquid, Math.min(0.85, (liquid[3] || 0.3) + 0.25));
        ctx.fillRect(x - 4, ly, 8, tipY - ly);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(80,105,125,0.7)'; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x - 2.4, glassTop + 4, 1.1, len - 46);
      // Gummikolben
      const bg2 = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
      bg2.addColorStop(0, shadeHex(bulbColor, 0.6)); bg2.addColorStop(0.4, bulbColor); bg2.addColorStop(1, shadeHex(bulbColor, 0.5));
      ctx.fillStyle = bg2;
      ctx.beginPath();
      ctx.moveTo(x - 5, glassTop + 2);
      ctx.bezierCurveTo(x - 9, glassTop - 6, x - 9, glassTop - 30, x, glassTop - 32);
      ctx.bezierCurveTo(x + 9, glassTop - 30, x + 9, glassTop - 6, x + 5, glassTop + 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(x - 3, glassTop - 20, 1.6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function shadeHex(hex, f) {
      const n = parseInt(hex.slice(1), 16);
      return rgba(shade([(n >> 16) & 255, (n >> 8) & 255, n & 255], f));
    }

    function substanceSource(id) {
      if (L.reagentX[id] != null) return { x: L.reagentX[id], tip: L.shelf.y - 4 - L.bottle.h + 62, len: 118, bulb: '#c8403a' };
      const i = lab.state.samples.findIndex((s) => s.sampleId === id);
      return { x: L.sample.x0 + i * L.sample.dx, tip: L.sample.baseY - L.sample.h + 84, len: 76, bulb: '#2b2f33' };
    }

    function pipetteState() {
      const op = lab.state.op;
      if (!op || op.type !== 'add') return null;
      const t = lab.tubeById(op.tubeId);
      const src = substanceSource(op.substance);
      const pose = restPose(t.place, t.slot);
      const mouth = pose.y - TUBE.h;
      const tgt = { x: pose.x, tip: mouth + 14 };
      const dripEnd = op.dropwise ? 2.15 : 1.35;
      const T = op.t;
      let x, tip;
      const up = 140;
      const hi = Math.min(src.tip, tgt.tip) - up;
      if (T < 0.35) { const q = ease(T / 0.35); x = src.x; tip = lerp(src.tip, src.tip - up, q); }
      else if (T < 0.82) { const q = ease((T - 0.35) / 0.47); x = lerp(src.x, tgt.x, q); tip = lerp(src.tip - up, tgt.tip - 34, q) - Math.sin(q * Math.PI) * Math.max(0, (src.tip - up) - hi) * 0; }
      else if (T < 0.92) { const q = ease((T - 0.82) / 0.1); x = tgt.x; tip = lerp(tgt.tip - 34, tgt.tip, q); }
      else if (T < dripEnd) { x = tgt.x; tip = tgt.tip; }
      else { const q = ease(clamp((T - dripEnd) / (op.dur - dripEnd))); x = lerp(tgt.x, src.x, q); tip = lerp(tgt.tip, src.tip, q) - Math.sin(q * Math.PI) * 90; }
      const dripping = T >= 0.92 && T < dripEnd;
      const fill = T < 0.92 ? 1 : T < dripEnd ? 1 - (T - 0.92) / (dripEnd - 0.92) : 0;
      const squeeze = dripping ? 1 : 0;
      return { x, tip, src, op, t, pose, dripping, fill, squeeze, dripEnd };
    }

    function drawPipetteOp() {
      const ps = pipetteState();
      if (!ps) return;
      const pure = chem.createContents(); chem.add(pure, ps.op.substance);
      const col = chem.appearance(pure).body;
      ps.color = col;
      // Strahl (bei normaler Zugabe) – Tropfen werden in updateVisuals erzeugt
      if (ps.dripping && !ps.op.dropwise) {
        const v = visuals.get(ps.t.id);
        const surf = ps.pose.y - liquidHeight(v);
        streamPath(ctx, ps.x, ps.tip + 2, surf, col, 1);
      }
      drawPipette(ps.x, ps.tip, ps.src.bulb, col, ps.fill, ps.src.len);
    }

    function streamPath(g, x, y0, y1, col, s) {
      if (y1 <= y0) return;
      g.save();
      const w = 2.3 * s;
      const grd = g.createLinearGradient(x - w, 0, x + w, 0);
      const base = col[3] < 0.2 ? [215, 232, 245, 0.75] : [col[0], col[1], col[2], 0.85];
      grd.addColorStop(0, rgba(shade(base, 0.8), base[3]));
      grd.addColorStop(0.5, rgba([Math.min(255, base[0] + 40), Math.min(255, base[1] + 40), Math.min(255, base[2] + 30)], base[3]));
      grd.addColorStop(1, rgba(shade(base, 0.8), base[3]));
      g.fillStyle = grd;
      g.beginPath();
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const y = lerp(y0, y1, i / n);
        const wob = Math.sin(time * 40 + i) * 0.25 * s;
        const ww = w * (1 - 0.25 * i / n);
        if (i === 0) g.moveTo(x - ww + wob, y); else g.lineTo(x - ww + wob, y);
      }
      for (let i = n; i >= 0; i--) {
        const y = lerp(y0, y1, i / n);
        const wob = Math.sin(time * 40 + i) * 0.25 * s;
        const ww = w * (1 - 0.25 * i / n);
        g.lineTo(x + ww + wob, y);
      }
      g.closePath(); g.fill();
      g.restore();
    }

    // ------------------------------------------------------------ Tropfen
    function emitDrops(dt) {
      const ps = pipetteState();
      if (!ps || !ps.dripping || !ps.op.dropwise) return;
      const n = 6;
      const interval = (ps.dripEnd - 0.92) / n;
      const k = Math.floor((ps.op.t - 0.92) / interval);
      ps.op._drops = ps.op._drops || 0;
      if (k >= ps.op._drops && ps.op._drops < n) {
        ps.op._drops++;
        const pure = chem.createContents(); chem.add(pure, ps.op.substance);
        drops.push({ x: ps.x, y: ps.tip + 3, vy: 40, tubeId: ps.t.id, col: chem.appearance(pure).body, born: time });
      }
    }

    function drawDrops() {
      for (const d of drops) {
        drawDrop(ctx, d.x, d.y, 1, d.col, d.vy);
      }
    }
    function drawDrop(g, x, y, s, col, vy) {
      const base = col[3] < 0.2 ? [210, 230, 245, 0.85] : [col[0], col[1], col[2], 0.9];
      const stretch = 1 + Math.min(0.8, vy / 900);
      g.save();
      g.translate(x, y);
      g.scale(s, s * stretch);
      g.fillStyle = rgba(base);
      g.beginPath();
      g.moveTo(0, -5); g.bezierCurveTo(2.8, -1, 3.2, 2.5, 0, 3.2); g.bezierCurveTo(-3.2, 2.5, -2.8, -1, 0, -5);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath(); g.arc(-0.9, 0.6, 0.8, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    // ---------------------------------------------------------- Simulation der Optik
    function liquidHeight(v) {
      return v ? v.vol * TUBE.portionH + v.surge : 0;
    }

    function updateVisuals(dt) {
      emitDrops(dt);
      // Tropfen fallen
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += 2400 * dt; d.y += d.vy * dt;
        const t = lab.tubeById(d.tubeId);
        const v = t && visuals.get(t.id);
        const pose = t ? tubePose(t) : null;
        const surf = pose ? pose.y - liquidHeight(v) : H;
        if (d.y >= surf) {
          if (v) {
            v.wave = Math.min(4, v.wave + 1.2);
            v.plumes.push({ u: (Math.random() - 0.5) * 0.3, v: 1, r: 0.12, a: 0.6, c: d.col, age: 0 });
          }
          drops.splice(i, 1);
        }
      }
      for (const t of lab.state.tubes) {
        const v = visualFor(t);
        const c = t.contents;
        const target = chem.appearance(c);
        const k = 1 - Math.exp(-dt / 0.45);
        if (target) {
          if (!v.app) v.app = JSON.parse(JSON.stringify(target));
          else {
            for (const key of ['body', 'liquid', 'turb']) for (let i = 0; i < 4; i++) v.app[key][i] = lerp(v.app[key][i], target[key][i], k);
            for (let i = 0; i < 3; i++) v.app.flecks.color[i] = lerp(v.app.flecks.color[i], target.flecks.color[i], k);
            v.app.flecks.density = lerp(v.app.flecks.density, target.flecks.density, k);
            v.app.flecks.size = lerp(v.app.flecks.size, target.flecks.size, k);
            v.app.mirror = lerp(v.app.mirror, target.mirror, 1 - Math.exp(-dt / 0.25));
            v.app.mirrorQuality = target.mirrorQuality;
            v.app.status = target.status; v.app.system = target.system;
          }
        } else v.app = null;
        const targetVol = chem.volume(c) * (1 - c.lost);
        v.vol = lerp(v.vol, targetVol, 1 - Math.exp(-dt / 0.28));
        if (Math.abs(v.vol - targetVol) < 0.002) v.vol = targetVol;
        if (target && target.mirror > 0.001 && v.mirrorH === 0) v.mirrorH = Math.max(8, chem.volume(c) * TUBE.portionH);
        // Welle und Schwappen
        const pose = tubePose(t);
        const accel = (pose.shake || 0) * 30 + (pose.jolt || 0) * 0.4;
        v.tiltV += (-(v.tilt + (pose.shake || 0) * 0.9) * 90 - v.tiltV * 7) * dt + accel * dt * 4;
        v.tilt += v.tiltV * dt;
        v.wave *= Math.exp(-dt * 1.6);
        if (pose.shake) v.wave = Math.max(v.wave, 2.5);
        const hot = c.temp > 45 ? (c.temp - 45) / 40 : 0;
        if (hot > 0) v.wave = Math.max(v.wave, 0.35 * hot);
        v.phase += dt * (6 + 4 * hot);
        // Siedeverzug: Aufwallen
        const op = lab.state.op;
        if (op && op.type === 'bump' && op.tubeId === t.id) {
          const p = op.t / op.dur;
          v.surge = p < 0.25 ? Math.sin(p / 0.25 * Math.PI / 2) * 90 : 90 * Math.max(0, 1 - (p - 0.25) / 0.35);
          if (p < 0.45 && Math.random() < 0.6) emitSpray(t, pose, v);
          v.wave = 4;
        } else v.surge = Math.max(0, v.surge - dt * 120);
        // Schlieren / Plumes
        for (let i = v.plumes.length - 1; i >= 0; i--) {
          const p = v.plumes[i];
          p.age += dt; p.r += dt * 0.35; p.v -= dt * 0.35; p.a *= Math.exp(-dt * (c.mix > 0.95 ? 1.6 : 0.6));
          if (p.a < 0.02 || p.v < -0.2) v.plumes.splice(i, 1);
        }
        if (c.mix > 0.98) v.layer = null;
        // Sedimentation nach abgeschlossener Fehling-Reaktion im kalten Reagenzglas
        const fehlingDone = target && target.system === 'fehling' && c.progress > 0.97;
        if (fehlingDone && c.temp < 38 && !pose.moving && !pose.shake) v.settle = Math.min(1, v.settle + dt / 28);
        else v.settle = Math.max(0, v.settle - dt * (pose.shake ? 2 : 0.5));
        // Partikel
        const conv = clamp((c.temp - 35) / 30, 0, 1.2);
        for (const p of v.particles) {
          const su = Math.sign(p.u) || 1, au = Math.abs(p.u);
          const om = 0.55 * conv;
          p.u += (om * (p.v - 0.5) * su) * dt + (Math.random() - 0.5) * 0.05 * dt * 10 * (0.3 + conv);
          p.v += (-om * (au - 0.5)) * dt + (Math.random() - 0.5) * 0.03 * dt * 10 * (0.3 + conv);
          if (pose.shake) { p.u += (Math.random() - 0.5) * 0.2; p.v += (Math.random() - 0.5) * 0.15; }
          if (v.settle > 0) p.v -= dt * 0.12 * v.settle * (0.6 + p.k);
          const minV = v.settle > 0 ? 0.0 : 0.02;
          if (p.u > 0.95) p.u = 0.95; if (p.u < -0.95) p.u = -0.95;
          if (p.v > 0.97) p.v = 0.97; if (p.v < minV) p.v = minV;
        }
        // Funkeln auf dem Silberspiegel
        if (v.app && v.app.mirror > 0.3 && Math.random() < dt * 6) {
          v.sparkles.push({ u: Math.random() * 1.6 - 0.8, v: Math.random() * 0.9, age: 0 });
        }
        for (let i = v.sparkles.length - 1; i >= 0; i--) { v.sparkles[i].age += dt; if (v.sparkles[i].age > 0.7) v.sparkles.splice(i, 1); }
      }
      updateBath(dt);
    }

    function emitSpray(t, pose, v) {
      const ang = pose.a;
      const ux = Math.sin(ang), uy = -Math.cos(ang);
      const mx = pose.x + ux * TUBE.h, my = pose.y + uy * TUBE.h;
      const col = v.app ? v.app.body : [200, 220, 240, 0.6];
      for (let i = 0; i < 3; i++) {
        const sp = 220 + Math.random() * 300;
        const spread = (Math.random() - 0.5) * 0.5;
        sprays.push({
          x: mx, y: my, vx: (ux + spread) * sp, vy: (uy + spread * 0.3) * sp,
          r: 1.5 + Math.random() * 2.8, col, life: 0
        });
      }
    }

    function drawSprays(dt) {
      for (let i = sprays.length - 1; i >= 0; i--) {
        const s = sprays[i];
        s.vy += 1500 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life += dt;
        if (s.y > L.benchFront - 20 - (s.x % 40)) {
          splats.push({ x: s.x, y: s.y, r: s.r * (2 + Math.random() * 2), col: s.col, age: 0 });
          sprays.splice(i, 1); continue;
        }
        if (s.life > 3) { sprays.splice(i, 1); continue; }
        ctx.fillStyle = rgba(s.col, Math.max(0.5, s.col[3]));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = splats.length - 1; i >= 0; i--) {
        const s = splats[i];
        s.age += dt;
        const a = Math.max(0, 1 - s.age / 8) * 0.6;
        if (a <= 0) { splats.splice(i, 1); continue; }
        ctx.fillStyle = rgba(s.col, a);
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.8, s.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ------------------------------------------------------------ Reagenzglas
    function tubePath(g, inset) {
      const r = TUBE.r - inset;
      g.beginPath();
      g.moveTo(-r, -TUBE.h + (inset > 0 ? 3 : 0));
      g.lineTo(-r, -TUBE.r);
      g.arc(0, -TUBE.r, r, Math.PI, 0, true);
      g.lineTo(r, -TUBE.h + (inset > 0 ? 3 : 0));
    }

    function drawTubeWorld(t) {
      const pose = tubePose(t);
      const v = visualFor(t);
      const active = lab.state.activeTubeId === t.id;
      ctx.save();
      ctx.translate(pose.x + (pose.jolt || 0), pose.y);
      if (pose.shake) {
        ctx.translate(0, -TUBE.h + 30); ctx.rotate(pose.shake); ctx.translate(0, TUBE.h - 30);
      }
      ctx.rotate(pose.a || 0);
      if (!pose.moving && t.place === 'rack') shadowLocal();
      const hover = pointer.hover && pointer.hover.type === 'tube' && pointer.hover.id === t.id;
      if (active || hover) {
        glowRing(() => { tubePath(ctx, -3); ctx.closePath(); }, active ? 0.9 : 0.4);
      }
      drawTube(ctx, t, v, 1, { inBath: t.place === 'bath' });
      if (pose.holder) drawHolderOnTube();
      ctx.restore();
    }

    function shadowLocal() {
      ctx.save();
      const gr = ctx.createRadialGradient(6, 1, 0, 6, 1, 26);
      gr.addColorStop(0, 'rgba(30,40,50,0.25)'); gr.addColorStop(1, 'rgba(30,40,50,0)');
      ctx.fillStyle = gr; ctx.scale(1, 0.25); ctx.beginPath(); ctx.arc(6, 4, 26, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    /** Zeichnet ein Reagenzglas in lokalen Koordinaten (Ursprung = Unterkante Mitte). s: Detailfaktor */
    function drawTube(g, t, v, s, opts) {
      const r = TUBE.r, wall = TUBE.wall, ri = r - wall;
      // Glaskörper (Rückwand)
      tubePath(g, 0); g.closePath();
      const back = g.createLinearGradient(-r, 0, r, 0);
      back.addColorStop(0, 'rgba(170,195,215,0.30)'); back.addColorStop(0.2, 'rgba(225,238,247,0.10)');
      back.addColorStop(0.8, 'rgba(225,238,247,0.08)'); back.addColorStop(1, 'rgba(170,195,215,0.30)');
      g.fillStyle = back; g.fill();

      const h = liquidHeight(v);
      if (v.app && h > 0.5) drawLiquid(g, t, v, h, s);

      // Vorderseite: Kanten, Lichtreflexe, Rand
      g.save();
      tubePath(g, 0);
      g.strokeStyle = 'rgba(70,95,115,0.62)'; g.lineWidth = 1.15; g.stroke();
      tubePath(g, wall);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.7; g.stroke();
      // Kantenbrechung
      const edge = g.createLinearGradient(-r, 0, r, 0);
      edge.addColorStop(0, 'rgba(60,85,105,0.30)'); edge.addColorStop(0.07, 'rgba(60,85,105,0.0)');
      edge.addColorStop(0.93, 'rgba(60,85,105,0.0)'); edge.addColorStop(1, 'rgba(60,85,105,0.32)');
      tubePath(g, 0); g.closePath(); g.fillStyle = edge; g.fill();
      // Glanzlichter
      const hl = g.createLinearGradient(-r + 3, 0, -r + 11, 0);
      hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.45, 'rgba(255,255,255,0.85)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hl; g.fillRect(-r + 3, -TUBE.h + 12, 8, TUBE.h - 34);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(r - 7, -TUBE.h + 22, 2.2, TUBE.h - 60);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, -r, r - 4, Math.PI * 0.62, Math.PI * 0.9); g.stroke();
      // Rand (gebördelt)
      g.fillStyle = 'rgba(210,228,240,0.5)';
      g.beginPath(); g.ellipse(0, -TUBE.h, r + 2.2, 3.4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(70,95,115,0.7)'; g.lineWidth = 1.1; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.9;
      g.beginPath(); g.ellipse(0, -TUBE.h, r + 1.2, 2.4, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.restore();
      // Nummer am Glas (Beschriftungsfeld)
      g.save();
      g.fillStyle = 'rgba(255,255,255,0.88)';
      roundRect(g, -10, -TUBE.h + 22, 20, 18, 3); g.fill();
      g.strokeStyle = 'rgba(70,95,115,0.4)'; g.lineWidth = 0.6; g.stroke();
      g.fillStyle = '#26323e'; g.font = '700 13px system-ui, -apple-system, "Segoe UI", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(t.id), 0, -TUBE.h + 31.5);
      g.restore();
    }

    function surfaceY(v, x, h) {
      return -h + v.tilt * x * 0.6 + v.wave * Math.sin(x * 0.28 + v.phase) * 0.6;
    }

    function drawLiquid(g, t, v, h, s) {
      const app = v.app;
      const ri = TUBE.r - TUBE.wall;
      const c = t.contents;
      g.save();
      tubePath(g, TUBE.wall); g.closePath(); g.clip();
      // Flüssigkeitskörper
      const path = () => {
        g.beginPath();
        g.moveTo(-ri - 1, surfaceY(v, -ri - 1, h));
        for (let x = -ri; x <= ri + 1; x += 2) g.lineTo(x, surfaceY(v, x, h));
        g.lineTo(ri + 2, 4); g.lineTo(-ri - 2, 4); g.closePath();
      };
      let body = app.body;
      if (v.settle > 0) body = mixc(body, app.liquid[3] > 0.15 ? app.liquid : [228, 238, 244, 0.25], 0.8 * v.settle);
      path();
      const bodyGrad = g.createLinearGradient(-ri, 0, ri, 0);
      const a = clamp(body[3], 0.06, 1);
      bodyGrad.addColorStop(0, rgba(shade(body, 0.62), Math.min(1, a + 0.12)));
      bodyGrad.addColorStop(0.3, rgba(shade(body, 1.08), a));
      bodyGrad.addColorStop(0.5, rgba(shade(body, 1.1), a * 0.97));
      bodyGrad.addColorStop(0.78, rgba(body, a));
      bodyGrad.addColorStop(1, rgba(shade(body, 0.58), Math.min(1, a + 0.14)));
      g.fillStyle = bodyGrad; g.fill();

      // Schichtung beim Zugeben (noch nicht durchmischt)
      if (v.layer && c.mix < 0.98) {
        const w = clamp((1 - c.mix) / 0.7);
        const yi = -h * (1 - v.layer.frac);
        const band = h * (0.06 + 0.4 * (1 - w));
        const vg = g.createLinearGradient(0, 0, 0, -h);
        const up = mixc(body, v.layer.upper, w), lo = mixc(body, v.layer.lower, w);
        const f = (y) => clamp(-y / h);
        vg.addColorStop(0, rgba(lo)); vg.addColorStop(f(yi + band), rgba(lo));
        vg.addColorStop(f(yi), rgba(body)); vg.addColorStop(f(yi - band * 0.6), rgba(up)); vg.addColorStop(1, rgba(up));
        path(); g.fillStyle = vg; g.fill();
        // Schlieren
        g.strokeStyle = rgba(body, 0.35 * w);
        g.lineWidth = 1.6;
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          const x0 = -ri + (k + 0.5) * ri / 2;
          for (let yy = 0; yy <= 1; yy += 0.1) {
            const y = yi - band + yy * band * 2.2;
            const x = x0 + Math.sin(yy * 6 + time * 1.6 + k) * 4;
            if (yy === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      // Einmischende Reagenzien
      for (const p of v.plumes) {
        const px = p.u * ri, py = -h * clamp(p.v, 0, 1);
        const rr = Math.max(2, p.r * ri * 2.2);
        const rg = g.createRadialGradient(px, py, 0, px, py, rr);
        const pc = p.c[3] < 0.2 ? [235, 245, 252, 1] : p.c;
        rg.addColorStop(0, rgba(pc, p.a * 0.7)); rg.addColorStop(1, rgba(pc, 0));
        g.fillStyle = rg; g.beginPath(); g.ellipse(px, py + rr * 0.3, rr * 0.8, rr * 1.4, 0, 0, Math.PI * 2); g.fill();
      }
      // Trübung (Körnung)
      const turbA = app.turb[3] * (1 - 0.85 * v.settle);
      if (turbA > 0.02) {
        g.save();
        path(); g.clip();
        // Textur in Szenenmaßstab, damit die Körnung in der Lupe nicht vergröbert wird
        const pat = g.createPattern(noise, 'repeat');
        const drift = (time * (2 + 6 * clamp((c.temp - 35) / 40))) % 128;
        if (pat.setTransform && root.DOMMatrix) pat.setTransform(new DOMMatrix().scale(1 / s, 1 / s).translate(drift * 0.4, -drift));
        g.globalAlpha = Math.min(1, turbA * 1.15);
        g.fillStyle = pat;
        g.fillRect(-ri - 4, -h - 10, ri * 2 + 8, h + 20);
        // Trübungsfarbe als weicher Schleier
        g.globalAlpha = 1;
        const tg = g.createLinearGradient(-ri, 0, ri, 0);
        tg.addColorStop(0, rgba(shade(app.turb, 0.75), turbA * 0.35)); tg.addColorStop(0.5, rgba(app.turb, turbA * 0.12)); tg.addColorStop(1, rgba(shade(app.turb, 0.75), turbA * 0.35));
        g.fillStyle = tg; g.fillRect(-ri - 4, -h - 10, ri * 2 + 8, h + 20);
        g.restore();
      }
      // Partikel
      const dens = app.flecks.density;
      if (dens > 0.01) {
        const n = Math.round(v.particles.length * dens * (s > 1.5 ? 1 : 0.45));
        g.save(); g.globalCompositeOperation = 'source-over';
        const sz = app.flecks.size * (s > 1.5 ? 0.75 : 0.9);
        for (let i = 0; i < n; i++) {
          const p = v.particles[i];
          const y = -h * p.v;
          const x = p.u * ri;
          if (y < surfaceY(v, x, h) + 1) continue;
          const tw = 0.55 + 0.45 * Math.sin(time * 2.5 + p.ph);
          const rr = sz * p.s * (0.7 + 0.3 * tw);
          g.fillStyle = rgba(shade(app.flecks.color, 0.8 + 0.4 * p.k), 0.45 + 0.4 * tw);
          g.beginPath(); g.arc(x, y, rr * 0.6, 0, Math.PI * 2); g.fill();
        }
        g.restore();
      }
      // Bodensatz (abgesetztes Cu₂O)
      if (v.settle > 0.02) {
        const sh = (5 + 9 * c.progress) * v.settle;
        const sg = g.createLinearGradient(0, 0, 0, -sh - 6);
        const sc = app.flecks.color;
        sg.addColorStop(0, rgba(shade(sc, 0.8), 0.98)); sg.addColorStop(0.7, rgba(sc, 0.9)); sg.addColorStop(1, rgba(sc, 0));
        g.fillStyle = sg; g.fillRect(-ri - 2, -sh - 6, ri * 2 + 4, sh + 8);
      }
      // Silberspiegel an der Glaswand
      if (app.mirror > 0.002) drawMirror(g, v, app, s);
      // Oberfläche / Meniskus
      g.beginPath();
      for (let x = -ri; x <= ri; x += 2) { const y = surfaceY(v, x, h); if (x === -ri) g.moveTo(x, y); else g.lineTo(x, y); }
      g.strokeStyle = rgba(shade(body, 0.6), Math.min(0.9, body[3] + 0.25)); g.lineWidth = 1.5; g.stroke();
      g.beginPath();
      for (let x = -ri + 2; x <= ri - 2; x += 2) { const y = surfaceY(v, x, h) + 1.6; if (x === -ri + 2) g.moveTo(x, y); else g.lineTo(x, y); }
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.9; g.stroke();
      // Meniskus an den Wänden
      g.strokeStyle = rgba(shade(body, 0.7), 0.55); g.lineWidth = 1;
      g.beginPath(); g.arc(-ri + 3.5, surfaceY(v, -ri, h) - 0.5, 3.5, Math.PI, Math.PI * 1.5); g.stroke();
      g.beginPath(); g.arc(ri - 3.5, surfaceY(v, ri, h) - 0.5, 3.5, Math.PI * 1.5, 0); g.stroke();
      // Gasbläschen beim Erwärmen
      if (c.temp > 55) {
        const nB = Math.round((c.temp - 55) / 6);
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.6;
        for (let i = 0; i < nB; i++) {
          const ph = (time * (0.6 + i * 0.13) + i * 0.37) % 1;
          const bx = Math.sin(i * 12.9) * ri * 0.7;
          const by = -ph * h;
          g.beginPath(); g.arc(bx, by, 0.9 + (i % 3) * 0.4, 0, Math.PI * 2); g.stroke();
        }
      }
      g.restore();
    }

    function drawMirror(g, v, app, s) {
      const ri = TUBE.r - TUBE.wall;
      const hm = Math.max(v.mirrorH, 8);
      const m = app.mirror, q = app.mirrorQuality;
      // Pixelmaßstab bestimmen und Silberschicht in eigener Ebene aufbauen
      const tr = g.getTransform();
      const k = Math.hypot(tr.a, tr.b);
      const pw = Math.ceil((ri * 2 + 4) * k), ph = Math.ceil((hm + 4) * k);
      if (silverCanvas.width < pw || silverCanvas.height < ph) { silverCanvas.width = Math.max(pw, silverCanvas.width); silverCanvas.height = Math.max(ph, silverCanvas.height); }
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = 'source-over';
      sctx.clearRect(0, 0, silverCanvas.width, silverCanvas.height);
      sctx.setTransform(k, 0, 0, k, (ri + 2) * k, (hm + 2) * k);
      // Maske: Film + wachsende Inseln; an der projizierten Wandkante dichter
      sctx.save();
      sctx.beginPath();
      sctx.moveTo(-ri, -hm); sctx.lineTo(-ri, -TUBE.r + TUBE.wall); sctx.arc(0, -TUBE.r, ri, Math.PI, 0, true); sctx.lineTo(ri, -hm); sctx.closePath();
      sctx.clip();
      const film = 0.95 * smooth(0.4, 1, m) * (0.75 + 0.25 * q);
      if (film > 0) { sctx.globalAlpha = film; sctx.fillStyle = '#000'; sctx.fillRect(-ri, -hm, ri * 2, hm + 2); }
      sctx.fillStyle = '#000';
      for (const st of v.sites) {
        const grow = clamp((m - st.birth) / st.grow);
        if (grow <= 0) continue;
        const rad = st.rad * Math.pow(grow, 0.7) * (0.7 + 0.5 * q) * (1 + 1.4 * smooth(0.5, 1, m));
        sctx.globalAlpha = st.alpha * (0.5 + 0.5 * grow);
        sctx.beginPath();
        sctx.ellipse(st.u * ri, -st.v * (hm - 2) - 1, rad * st.ax, rad, st.rot, 0, Math.PI * 2);
        sctx.fill();
      }
      const edgeA = smooth(0.15, 0.8, m);
      if (edgeA > 0) {
        sctx.globalAlpha = edgeA * 0.9;
        sctx.fillRect(-ri, -hm, 3.2, hm + 2); sctx.fillRect(ri - 3.2, -hm, 3.2, hm + 2);
        sctx.beginPath(); sctx.arc(0, -TUBE.r, ri, 0, Math.PI); sctx.arc(0, -TUBE.r, ri - 3, Math.PI, 0, true); sctx.fill();
      }
      sctx.restore();
      // Einfärben: metallischer Verlauf über die zylindrische Wand
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = 'source-in';
      const mg = sctx.createLinearGradient(-ri, 0, ri, 0);
      const dull = 1 - q;
      const c = (l) => { const x = Math.round(l * (1 - 0.35 * dull)); return `rgb(${x},${x + 2},${x + 6})`; };
      mg.addColorStop(0, c(40)); mg.addColorStop(0.08, c(120)); mg.addColorStop(0.18, c(238)); mg.addColorStop(0.25, c(255));
      mg.addColorStop(0.33, c(150)); mg.addColorStop(0.45, c(82)); mg.addColorStop(0.58, c(110)); mg.addColorStop(0.7, c(205));
      mg.addColorStop(0.79, c(246)); mg.addColorStop(0.88, c(120)); mg.addColorStop(1, c(38));
      sctx.fillStyle = mg; sctx.fillRect(-ri - 2, -hm - 2, ri * 2 + 4, hm + 6);
      // Graue Flecken in der frühen Phase (fein verteiltes, noch nicht spiegelndes Silber)
      sctx.globalCompositeOperation = 'source-atop';
      sctx.globalAlpha = 0.55 * (1 - smooth(0.3, 0.85, m));
      sctx.fillStyle = 'rgb(88,86,84)'; sctx.fillRect(-ri - 2, -hm - 2, ri * 2 + 4, hm + 6);
      // Wandernder Glanzstreifen
      sctx.globalAlpha = 0.45 * smooth(0.4, 1, m);
      const bx = -ri * 0.55 + Math.sin(time * 0.7) * ri * 0.25;
      const sg = sctx.createLinearGradient(bx - 5, 0, bx + 5, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,1)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      sctx.fillStyle = sg; sctx.fillRect(bx - 6, -hm - 2, 12, hm + 6);
      // Spiegelung der Umgebung (dunkles Band)
      sctx.globalAlpha = 0.5 * smooth(0.5, 1, m);
      const db = sctx.createLinearGradient(0, -hm, 0, 0);
      db.addColorStop(0, 'rgba(30,38,46,0)'); db.addColorStop(0.42, 'rgba(30,38,46,0.15)'); db.addColorStop(0.58, 'rgba(30,38,46,0.9)'); db.addColorStop(0.74, 'rgba(30,38,46,0.1)'); db.addColorStop(1, 'rgba(30,38,46,0)');
      sctx.fillStyle = db; sctx.fillRect(-ri - 2, -hm - 2, ri * 2 + 4, hm + 6);
      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 1;
      // auf das Reagenzglas übertragen
      g.save();
      g.globalAlpha = 0.97;
      g.drawImage(silverCanvas, 0, 0, pw, ph, -ri - 2, -hm - 2, pw / k, ph / k);
      g.restore();
      // Rand des Belags an der Flüssigkeitsoberfläche
      if (m > 0.25) {
        g.strokeStyle = `rgba(120,124,130,${0.6 * smooth(0.25, 0.8, m)})`;
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-ri, -hm); g.lineTo(ri, -hm); g.stroke();
      }
      // Funkeln
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const sp of v.sparkles) {
        const a = Math.sin(sp.age / 0.7 * Math.PI) * 0.55 * smooth(0.5, 1, m);
        const x = sp.u * ri, y = -sp.v * hm;
        const rr = s > 1.5 ? 1.5 : 1.1;
        g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 0.45;
        g.beginPath(); g.moveTo(x - rr, y); g.lineTo(x + rr, y); g.moveTo(x, y - rr); g.lineTo(x, y + rr); g.stroke();
      }
      g.restore();
    }

    function drawHolderOnTube() {
      // Reagenzglashalter aus Holz, Klammer im oberen Drittel
      const y = -TUBE.h + 62;
      ctx.save();
      ctx.fillStyle = '#8b9299';
      ctx.fillRect(-TUBE.r - 3, y - 7, TUBE.r * 2 + 6, 3);
      ctx.fillRect(-TUBE.r - 3, y + 4, TUBE.r * 2 + 6, 3);
      ctx.translate(TUBE.r + 2, y);
      ctx.rotate(0.22);
      const wg = ctx.createLinearGradient(0, -7, 0, 7);
      wg.addColorStop(0, '#d7a466'); wg.addColorStop(0.5, '#b97f3f'); wg.addColorStop(1, '#8c5a26');
      ctx.fillStyle = wg; roundRect(ctx, 0, -6, 150, 12, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(6, -4.5, 136, 2);
      ctx.strokeStyle = '#6f757c'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(30, 0, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    function drawHolderRest() {
      const busyHolder = lab.state.tubes.some((t) => t.place === 'flame' || t.place === 'moving');
      const { x, y } = L.holder;
      ctx.save();
      ctx.globalAlpha = busyHolder ? 0.25 : 1;
      shadow(x, y + 6, 120, 6, 0.22);
      ctx.translate(x - 100, y);
      ctx.rotate(-0.04);
      const wg = ctx.createLinearGradient(0, -7, 0, 7);
      wg.addColorStop(0, '#d7a466'); wg.addColorStop(0.5, '#b97f3f'); wg.addColorStop(1, '#8c5a26');
      ctx.fillStyle = wg; roundRect(ctx, 40, -6, 160, 12, 5); ctx.fill();
      ctx.strokeStyle = '#7d848b'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(40, -4); ctx.lineTo(4, -9); ctx.moveTo(40, 4); ctx.lineTo(4, 9); ctx.stroke();
      ctx.beginPath(); ctx.arc(60, 0, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(2, 0, 9, -1.2, 1.2); ctx.stroke();
      ctx.restore();
    }

    // ---------------------------------------------------------- Ständer
    function drawRack(front) {
      const R = L.rack;
      if (!front) {
        shadow((R.x0 + R.x1) / 2, R.baseY + 2, (R.x1 - R.x0) * 0.55, 10, 0.25);
        // hintere Pfosten
        ctx.fillStyle = '#d5dce2';
        ctx.fillRect(R.x0 + 8, R.railY - 8, 10, R.baseY - R.railY);
        ctx.fillRect(R.x1 - 18, R.railY - 8, 10, R.baseY - R.railY);
        // Lochplatte (Oberseite)
        ctx.fillStyle = '#eef2f5';
        roundRect(ctx, R.x0, R.railY - 12, R.x1 - R.x0, 14, 4); ctx.fill();
        ctx.fillStyle = 'rgba(80,95,110,0.45)';
        for (const sx of R.slotX) { ctx.beginPath(); ctx.ellipse(sx, R.railY - 5, TUBE.r + 3, 4, 0, 0, Math.PI * 2); ctx.fill(); }
        // Bodenplatte
        const bg2 = ctx.createLinearGradient(0, R.tubeBottom - 6, 0, R.baseY);
        bg2.addColorStop(0, '#f3f6f8'); bg2.addColorStop(1, '#c9d2da');
        ctx.fillStyle = bg2; roundRect(ctx, R.x0 - 6, R.tubeBottom - 4, R.x1 - R.x0 + 12, R.baseY - R.tubeBottom + 4, 5); ctx.fill();
        return;
      }
      // vordere Leiste der Lochplatte
      const fg = ctx.createLinearGradient(0, R.railY, 0, R.railY + 18);
      fg.addColorStop(0, '#fbfcfd'); fg.addColorStop(1, '#cfd8df');
      ctx.fillStyle = fg; roundRect(ctx, R.x0 - 4, R.railY, R.x1 - R.x0 + 8, 18, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(90,105,120,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      // vordere Pfosten
      ctx.fillStyle = '#e4e9ee';
      ctx.fillRect(R.x0 - 2, R.railY + 16, 12, R.baseY - R.railY - 18);
      ctx.fillRect(R.x1 - 10, R.railY + 16, 12, R.baseY - R.railY - 18);
      ctx.fillStyle = 'rgba(90,105,120,0.2)';
      ctx.fillRect(R.x0 + 8, R.railY + 16, 2, R.baseY - R.railY - 18);
      // Platznummern
      R.slotX.forEach((sx, i) => {
        const t = lab.state.tubes[i];
        const active = lab.state.activeTubeId === i + 1;
        if (active) { ctx.fillStyle = '#1f6fe5'; ctx.fillRect(sx - 14, R.railY + 13, 28, 3); }
        if (t && t.place !== 'rack') {
          ctx.fillStyle = 'rgba(80,95,110,0.7)'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(t.place === 'bath' ? `${i + 1} → Bad` : t.place === 'flame' ? `${i + 1} → Flamme` : '', sx, R.tubeBottom - 14);
        }
      });
    }

    // --------------------------------------------------------- Wasserbad
    function updateBath(dt) {
      const T = lab.state.bath.temp;
      const B = L.bath;
      const rate = T > 42 ? (T - 42) / 38 * 22 : 0;
      if (Math.random() < rate * dt) {
        bubbles.push({ x: B.cx - B.beakerHalf + 14 + Math.random() * (B.beakerHalf * 2 - 28), y: B.beakerBottom - 6, r: 0.8 + Math.random() * 2.2, vy: 40 + Math.random() * 50, ph: Math.random() * 6 });
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y -= b.vy * dt; b.vy += 30 * dt; b.r += dt * 0.6;
        b.x += Math.sin(time * 5 + b.ph) * 0.2;
        if (b.y < B.water + 2) bubbles.splice(i, 1);
      }
      if (T > 62 && Math.random() < (T - 62) / 18 * 3 * dt) {
        steam.push({ x: B.cx - 70 + Math.random() * 140, y: B.water - 4, r: 10 + Math.random() * 10, a: 0, age: 0, vx: (Math.random() - 0.5) * 10 });
      }
      for (let i = steam.length - 1; i >= 0; i--) {
        const s = steam[i];
        s.age += dt; s.y -= 22 * dt; s.x += s.vx * dt + Math.sin(time + i) * 0.2; s.r += 8 * dt;
        if (s.age > 4) steam.splice(i, 1);
      }
    }

    function beakerPath(g) {
      const B = L.bath, x0 = B.cx - B.beakerHalf, x1 = B.cx + B.beakerHalf;
      g.beginPath();
      g.moveTo(x0 - 6, B.beakerTop - 4);
      g.quadraticCurveTo(x0, B.beakerTop - 2, x0, B.beakerTop + 8);
      g.lineTo(x0, B.beakerBottom - 10);
      g.quadraticCurveTo(x0, B.beakerBottom, x0 + 10, B.beakerBottom);
      g.lineTo(x1 - 10, B.beakerBottom);
      g.quadraticCurveTo(x1, B.beakerBottom, x1, B.beakerBottom - 10);
      g.lineTo(x1, B.beakerTop);
    }

    function drawBath() {
      const B = L.bath;
      const bath = lab.state.bath;
      const hover = pointer.hover && (pointer.hover.type === 'bath' || pointer.hover.type === 'hotplate');
      // Heizplatte
      shadow(B.cx, L.rack.baseY + 2, 150, 10, 0.3);
      const hx0 = B.cx - 128, hx1 = B.cx + 128;
      const pg = ctx.createLinearGradient(0, B.plateTop, 0, L.rack.baseY);
      pg.addColorStop(0, '#f5f7f9'); pg.addColorStop(1, '#c6ced6');
      ctx.fillStyle = pg; roundRect(ctx, hx0, B.plateTop, hx1 - hx0, L.rack.baseY - B.plateTop, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(80,95,110,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      // Keramikfeld
      const heat = clamp((bath.temp - 22) / 60);
      const cg = ctx.createLinearGradient(0, B.plateTop - 8, 0, B.plateTop + 4);
      cg.addColorStop(0, '#3c434a'); cg.addColorStop(1, '#22282d');
      ctx.fillStyle = cg; roundRect(ctx, hx0 + 6, B.plateTop - 8, hx1 - hx0 - 12, 11, 4); ctx.fill();
      if (bath.setting > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createLinearGradient(hx0, 0, hx1, 0);
        const ga = 0.18 + 0.25 * heat + 0.05 * Math.sin(time * 2);
        glow.addColorStop(0, 'rgba(255,80,20,0)'); glow.addColorStop(0.5, `rgba(255,90,30,${ga})`); glow.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = glow; ctx.fillRect(hx0 + 10, B.plateTop - 7, hx1 - hx0 - 20, 6);
        ctx.restore();
      }
      // Drehknopf
      const kx = hx0 + 46, ky = B.plateTop + 33;
      const ang = bath.setting === 0 ? -2.3 : bath.setting === 60 ? 0 : 1.6;
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(kx + 1, ky + 2, 19, 0, Math.PI * 2); ctx.fill();
      const kg = ctx.createRadialGradient(kx - 5, ky - 6, 2, kx, ky, 19);
      kg.addColorStop(0, '#5d6670'); kg.addColorStop(1, '#262c32');
      ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, 18, 0, Math.PI * 2); ctx.fill();
      if (hover && pointer.hover.type === 'hotplate') { ctx.strokeStyle = 'rgba(60,150,255,0.8)'; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.strokeStyle = bath.setting ? '#ff8a3c' : '#e8edf2'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.sin(ang) * 13, ky - Math.cos(ang) * 13); ctx.stroke();
      ctx.lineCap = 'butt';
      [-2.3, 0, 1.6].forEach((a, i) => {
        ctx.fillStyle = [0, 60, 80][i] === bath.setting ? '#ff8a3c' : '#7d8994';
        ctx.beginPath(); ctx.arc(kx + Math.sin(a) * 23, ky - Math.cos(a) * 23, 2.2, 0, Math.PI * 2); ctx.fill();
      });
      // Anzeige
      const dx = hx0 + 104, dy = B.plateTop + 16, dw = 132, dh = 34;
      ctx.fillStyle = '#0f1418'; roundRect(ctx, dx, dy, dw, dh, 5); ctx.fill();
      ctx.font = '700 19px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
      ctx.fillStyle = bath.setting ? '#ffb347' : '#7ee0a1'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(bath.temp)} °C`, dx + 9, dy + dh / 2 + 1);
      ctx.font = '600 10px system-ui, sans-serif'; ctx.fillStyle = '#9aa7b3'; ctx.textAlign = 'right';
      ctx.fillText(bath.setting ? `Soll ${bath.setting}` : 'AUS', dx + dw - 7, dy + dh / 2 + 1);
      // LED
      ctx.fillStyle = bath.setting && bath.temp < bath.setting - 1 ? '#ff4d3a' : bath.setting ? '#ffb347' : '#3c444b';
      ctx.beginPath(); ctx.arc(hx1 - 12, B.plateTop + 12, 3, 0, Math.PI * 2); ctx.fill();

      // Becherglas: Rückwand und Wasser
      const x0 = B.cx - B.beakerHalf, x1 = B.cx + B.beakerHalf;
      shadow(B.cx, B.beakerBottom, B.beakerHalf + 10, 6, 0.25);
      ctx.save();
      beakerPath(ctx); ctx.closePath();
      ctx.fillStyle = 'rgba(205,225,238,0.16)'; ctx.fill();
      ctx.restore();
      const waterTop = B.water + Math.sin(time * 2.2) * 0.8;
      const wg = ctx.createLinearGradient(0, waterTop, 0, B.beakerBottom);
      const warm = clamp((bath.temp - 20) / 60);
      wg.addColorStop(0, `rgba(${170 + 30 * warm},${210 - 5 * warm},${235 - 25 * warm},0.30)`);
      wg.addColorStop(1, `rgba(${140 + 30 * warm},${190},${225 - 20 * warm},0.42)`);
      ctx.fillStyle = wg; ctx.fillRect(x0 + 2, waterTop, x1 - x0 - 4, B.beakerBottom - waterTop - 2);
      // Thermometer (hinter den Reagenzgläsern)
      drawThermometer(x1 - 30, bath.temp);
      // Reagenzgläser im Bad
      for (const t of lab.state.tubes) if (t.place === 'bath') drawTubeWorld(t);
      // Wasser vor den Gläsern
      ctx.fillStyle = 'rgba(150,200,230,0.20)'; ctx.fillRect(x0 + 2, waterTop, x1 - x0 - 4, B.beakerBottom - waterTop - 2);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(B.cx, waterTop, B.beakerHalf - 2, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,240,252,0.35)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
      // Blasen
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8;
      for (const b of bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke(); }
      // Glasvorderseite
      ctx.save();
      beakerPath(ctx);
      ctx.strokeStyle = hover ? 'rgba(40,140,255,0.8)' : 'rgba(80,105,125,0.6)'; ctx.lineWidth = hover ? 2.4 : 1.6; ctx.stroke();
      const hl = ctx.createLinearGradient(x0 + 4, 0, x0 + 22, 0);
      hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(255,255,255,0.6)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.fillRect(x0 + 4, B.beakerTop + 12, 18, B.beakerBottom - B.beakerTop - 30);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x1 - 12, B.beakerTop + 20, 4, B.beakerBottom - B.beakerTop - 50);
      // Graduierung
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.2;
      ctx.font = '600 9px system-ui, sans-serif'; ctx.textAlign = 'left';
      for (let i = 1; i <= 5; i++) {
        const y = B.beakerBottom - i * 38;
        ctx.beginPath(); ctx.moveTo(x0 + 24, y); ctx.lineTo(x0 + (i % 2 ? 40 : 34), y); ctx.stroke();
        if (i % 2 === 0) ctx.fillText(String(i * 100), x0 + 42, y + 3);
      }
      ctx.restore();
      // Dampf
      for (const s of steam) {
        const a = Math.sin(Math.min(1, s.age / 4) * Math.PI) * 0.18;
        const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        sg.addColorStop(0, `rgba(255,255,255,${a})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawThermometer(x, T) {
      const top = 548, bottom = 818;
      ctx.save();
      ctx.translate(x, 0); ctx.rotate(0.05);
      ctx.fillStyle = 'rgba(235,242,248,0.85)';
      roundRect(ctx, -5, top, 10, bottom - top, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(80,105,125,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
      // Skala 0–100 °C
      const yT = (t) => bottom - 14 - (t / 100) * (bottom - top - 30);
      ctx.strokeStyle = 'rgba(40,50,60,0.7)'; ctx.lineWidth = 0.6;
      ctx.font = '600 7px system-ui, sans-serif'; ctx.fillStyle = '#2b3640'; ctx.textAlign = 'left';
      for (let t = 0; t <= 100; t += 10) {
        ctx.beginPath(); ctx.moveTo(-4, yT(t)); ctx.lineTo(t % 20 === 0 ? 1 : -1, yT(t)); ctx.stroke();
      }
      ctx.fillStyle = '#d6332a';
      ctx.fillRect(-1.3, yT(T), 2.6, bottom - 12 - yT(T));
      ctx.beginPath(); ctx.arc(0, bottom - 8, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(2, top + 6, 1, bottom - top - 24);
      ctx.restore();
    }

    // ------------------------------------------------------------ Brenner
    function drawBurner(flameLayer) {
      const Bn = L.burner;
      const on = lab.state.burner.on;
      if (!flameLayer) {
        shadow(Bn.cx, Bn.baseY + 1, 60, 8, 0.3);
        // Schlauch
        ctx.strokeStyle = '#d6862e'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(Bn.cx + 14, Bn.baseY - 30); ctx.bezierCurveTo(Bn.cx + 60, Bn.baseY - 30, Bn.cx + 70, Bn.baseY + 10, Bn.cx + 140, Bn.baseY + 20); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(Bn.cx + 16, Bn.baseY - 33); ctx.bezierCurveTo(Bn.cx + 60, Bn.baseY - 33, Bn.cx + 70, Bn.baseY + 7, Bn.cx + 140, Bn.baseY + 17); ctx.stroke();
        ctx.lineCap = 'butt';
        // Fuß
        const fg = ctx.createLinearGradient(0, Bn.baseY - 18, 0, Bn.baseY);
        fg.addColorStop(0, '#5b636b'); fg.addColorStop(1, '#2a3036');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.moveTo(Bn.cx - 46, Bn.baseY); ctx.lineTo(Bn.cx - 34, Bn.baseY - 18); ctx.lineTo(Bn.cx + 34, Bn.baseY - 18); ctx.lineTo(Bn.cx + 46, Bn.baseY); ctx.closePath(); ctx.fill();
        // Rohr
        const rg = ctx.createLinearGradient(Bn.cx - 11, 0, Bn.cx + 11, 0);
        rg.addColorStop(0, '#7b838b'); rg.addColorStop(0.35, '#e6eaee'); rg.addColorStop(0.6, '#a9b1b9'); rg.addColorStop(1, '#5d656d');
        ctx.fillStyle = rg; ctx.fillRect(Bn.cx - 10, Bn.topY, 20, Bn.baseY - 18 - Bn.topY);
        // Luftregulierung
        ctx.fillStyle = rg; ctx.fillRect(Bn.cx - 14, Bn.baseY - 54, 28, 16);
        ctx.fillStyle = '#2a3036'; ctx.fillRect(Bn.cx - 5, Bn.baseY - 50, 10, 8);
        // Gashahn
        ctx.fillStyle = on ? '#e3a21a' : '#8a939b';
        roundRect(ctx, Bn.cx + 12, Bn.baseY - 40, 20, 8, 3); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Bn.cx - 10, Bn.topY, 20, 3);
        const hover = pointer.hover && pointer.hover.type === 'burner';
        if (hover) { ctx.strokeStyle = 'rgba(60,150,255,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(Bn.cx - 48, Bn.topY - 4, 96, Bn.baseY - Bn.topY + 6); }
        return;
      }
      if (!on) return;
      // Flamme (rauschende, nicht leuchtende Flamme)
      const f1 = Math.sin(time * 23) * 1.6 + Math.sin(time * 37) * 1.1;
      const f2 = Math.sin(time * 19 + 1) * 3;
      const topY = Bn.topY;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(Bn.cx, topY - 70, 5, Bn.cx, topY - 70, 110);
      halo.addColorStop(0, 'rgba(90,140,255,0.16)'); halo.addColorStop(1, 'rgba(90,140,255,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(Bn.cx, topY - 70, 110, 0, Math.PI * 2); ctx.fill();
      // äußerer Flammenmantel
      const tipY = topY - 150 + f2;
      const og = ctx.createLinearGradient(0, topY, 0, tipY);
      og.addColorStop(0, 'rgba(70,110,255,0.55)'); og.addColorStop(0.5, 'rgba(120,120,255,0.35)'); og.addColorStop(1, 'rgba(200,120,255,0)');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.moveTo(Bn.cx - 10, topY);
      ctx.bezierCurveTo(Bn.cx - 24, topY - 50, Bn.cx - 10 + f1, topY - 110, Bn.cx + f1, tipY);
      ctx.bezierCurveTo(Bn.cx + 10 + f1, topY - 110, Bn.cx + 24, topY - 50, Bn.cx + 10, topY);
      ctx.closePath(); ctx.fill();
      // innerer Kegel
      const ig = ctx.createLinearGradient(0, topY, 0, topY - 55);
      ig.addColorStop(0, 'rgba(120,230,255,0.95)'); ig.addColorStop(1, 'rgba(60,140,255,0.4)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(Bn.cx - 8, topY);
      ctx.quadraticCurveTo(Bn.cx - 6, topY - 30, Bn.cx + f1 * 0.2, topY - 55);
      ctx.quadraticCurveTo(Bn.cx + 6, topY - 30, Bn.cx + 8, topY);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // ------------------------------------------------------------ Lupe
    function drawDetailPanel() {
      const D = L.detail;
      const t = lab.activeTube();
      ctx.save();
      // Rahmen
      ctx.shadowColor = 'rgba(20,30,45,0.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#1f2a36'; roundRect(ctx, D.x, D.y, D.w, D.h, 18); ctx.fill();
      ctx.restore();
      const ix = D.x + 10, iy = D.y + 40, iw = D.w - 20, ih = D.h - 50;
      // Kopfzeile
      ctx.fillStyle = '#e8eef5'; ctx.font = '700 17px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(t ? `Lupe · Reagenzglas ${t.id}` : 'Lupe', D.x + 18, D.y + 21);
      if (t) {
        const placeTxt = { rack: 'im Ständer', bath: 'im Wasserbad', flame: 'in der Flamme', moving: 'wird umgesetzt' }[t.place];
        ctx.font = '600 14px system-ui, sans-serif'; ctx.fillStyle = '#9fb3c6'; ctx.textAlign = 'right';
        ctx.fillText(`${placeTxt} · ${Math.round(t.contents.temp)} °C`, D.x + D.w - 18, D.y + 21);
      }
      // Beobachtungshintergrund (weiße Karte)
      ctx.save();
      roundRect(ctx, ix, iy, iw, ih, 12); ctx.clip();
      const bgG = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
      bgG.addColorStop(0, '#ffffff'); bgG.addColorStop(1, '#e9eef2');
      ctx.fillStyle = bgG; ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeStyle = 'rgba(150,165,180,0.15)'; ctx.lineWidth = 1;
      for (let gx = ix + 20; gx < ix + iw; gx += 28) { ctx.beginPath(); ctx.moveTo(gx, iy); ctx.lineTo(gx, iy + ih); ctx.stroke(); }
      if (!t) {
        ctx.fillStyle = '#6b7a88'; ctx.font = '600 17px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Tippe auf ein Reagenzglas,', ix + iw / 2, iy + ih / 2 - 12);
        ctx.fillText('um es hier vergrößert zu sehen.', ix + iw / 2, iy + ih / 2 + 14);
        ctx.restore();
        return;
      }
      const v = visualFor(t);
      const cx = ix + iw / 2, by = iy + ih - 22;
      const pose = tubePose(t);
      // Umgebung: Wasserbad bzw. Flamme
      if (t.place === 'bath') {
        const wl = by - (L.bath.tubeBottom - L.bath.water) * Z;
        const wg = ctx.createLinearGradient(0, wl, 0, iy + ih);
        wg.addColorStop(0, 'rgba(170,215,240,0.45)'); wg.addColorStop(1, 'rgba(140,195,230,0.55)');
        ctx.fillStyle = wg; ctx.fillRect(ix, wl, iw, iy + ih - wl);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = ix; x <= ix + iw; x += 6) ctx.lineTo(x, wl + Math.sin(x * 0.05 + time * 2) * 1.5);
        ctx.stroke();
        const T = lab.state.bath.temp;
        if (T > 42) {
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
          const n = Math.round((T - 42) / 3);
          for (let i = 0; i < n; i++) {
            const ph = (time * (0.25 + (i % 5) * 0.05) + i * 0.618) % 1;
            const bx = ix + ((i * 97) % iw);
            const byy = iy + ih - ph * (iy + ih - wl);
            ctx.beginPath(); ctx.arc(bx + Math.sin(time * 3 + i) * 3, byy, 1.5 + (i % 3), 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
      ctx.save();
      ctx.translate(cx, by);
      if (pose.shake) { ctx.translate(0, -TUBE.h * Z + 60); ctx.rotate(pose.shake * 0.5); ctx.translate(0, TUBE.h * Z - 60); }
      ctx.scale(Z, Z);
      drawTube(ctx, t, v, Z, {});
      ctx.restore();
      if (t.place === 'flame' && lab.state.burner.on) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const fg = ctx.createRadialGradient(cx, by + 30, 5, cx, by + 30, 140);
        fg.addColorStop(0, 'rgba(90,140,255,0.55)'); fg.addColorStop(1, 'rgba(90,140,255,0)');
        ctx.fillStyle = fg; ctx.fillRect(ix, by - 140, iw, 200);
        ctx.restore();
      }
      // Tropfen und Strahl in der Lupe
      const ps = pipetteState();
      if (ps && ps.t.id === t.id && t.place !== 'flame') {
        const toD = (wx, wy) => ({ x: cx + (wx - ps.pose.x) * Z, y: by - (ps.pose.y - wy) * Z });
        if (ps.dripping && !ps.op.dropwise) {
          const a = toD(ps.x, ps.tip), b = by - liquidHeight(v) * Z;
          const pure = chem.createContents(); chem.add(pure, ps.op.substance);
          streamPath(ctx, a.x, Math.max(iy, a.y), b, chem.appearance(pure).body, Z * 0.9);
        }
        for (const d of drops) {
          if (d.tubeId !== t.id) continue;
          const p = toD(d.x, d.y);
          if (p.y > iy) drawDrop(ctx, p.x, p.y, Z * 0.9, d.col, d.vy);
        }
      }
      // Skalenhinweis
      ctx.fillStyle = 'rgba(40,55,70,0.55)'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('vor weißem Hintergrund beobachten', ix + 12, iy + 16);
      ctx.restore();
    }

    // ------------------------------------------------------------ Hinweise
    function drawBadges() {
      for (const t of lab.state.tubes) {
        if (t.place === 'moving') continue;
        if (!chem.isObservable(t.contents) || t.recordedId || t.contents.bumped) continue;
        const pose = restPose(t.place, t.slot);
        const x = pose.x + (t.place === 'flame' ? -120 : 0), y = pose.y - TUBE.h - 22 + Math.sin(time * 3) * 2;
        ctx.save();
        ctx.fillStyle = '#16a36a';
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, 7, 4.2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    function drawDragGhost() {
      const d = pointer.drag;
      if (!d || !d.active) return;
      ctx.save();
      ctx.globalAlpha = 0.8;
      if (d.source.type === 'tube') {
        const t = lab.tubeById(d.source.id);
        ctx.translate(d.x, d.y + TUBE.h / 2);
        drawTube(ctx, t, visualFor(t), 1, {});
      } else {
        const pure = chem.createContents(); chem.add(pure, d.source.id);
        drawPipette(d.x, d.y + 40, d.source.type === 'sample' ? '#2b2f33' : '#c8403a', chem.appearance(pure).body, 1, 100);
      }
      ctx.restore();
    }

    // ------------------------------------------------------------ Trefferprüfung
    function hitTest(lx, ly) {
      // Reagenzgläser
      for (const t of lab.state.tubes) {
        if (t.place === 'moving') continue;
        const p = restPose(t.place, t.slot);
        if (t.place === 'flame') {
          const dx = lx - p.x, dy = ly - p.y;
          const c = Math.cos(-p.a), s = Math.sin(-p.a);
          const lx2 = dx * c - dy * s, ly2 = dx * s + dy * c;
          if (Math.abs(lx2) < TUBE.r + 14 && ly2 < 10 && ly2 > -TUBE.h - 10) return { type: 'tube', id: t.id };
        } else if (Math.abs(lx - p.x) < TUBE.r + 16 && ly < p.y + 10 && ly > p.y - TUBE.h - 12) return { type: 'tube', id: t.id };
      }
      for (const r of chem.REAGENTS) {
        const x = L.reagentX[r.id];
        if (Math.abs(lx - x) < L.bottle.w / 2 + 8 && ly > L.shelf.y - L.bottle.h - 40 && ly < L.shelf.y + 4) return { type: 'reagent', id: r.id };
      }
      for (let i = 0; i < lab.state.samples.length; i++) {
        const x = L.sample.x0 + i * L.sample.dx;
        if (Math.abs(lx - x) < L.sample.dx / 2 && ly > L.sample.baseY - L.sample.h - 34 && ly < L.sample.baseY + 8) return { type: 'sample', id: lab.state.samples[i].sampleId };
      }
      const B = L.bath;
      if (lx > B.cx - 128 && lx < B.cx - 20 && ly > B.plateTop && ly < L.rack.baseY + 4) return { type: 'hotplate' };
      if (Math.abs(lx - B.cx) < B.beakerHalf + 10 && ly > B.beakerTop - 70 && ly < L.rack.baseY + 4) return { type: 'bath' };
      const Bn = L.burner;
      if (Math.abs(lx - Bn.cx) < 50 && ly > Bn.topY - 4 && ly < Bn.baseY + 6) return { type: 'burner' };
      if (Math.abs(lx - Bn.cx) < 70 && ly > Bn.topY - 190 && ly <= Bn.topY - 4) return { type: 'flame' };
      const R = L.rack;
      if (lx > R.x0 - 10 && lx < R.x1 + 10 && ly > R.railY - 120 && ly < R.baseY + 6) return { type: 'rack' };
      if (Math.abs(lx - L.holder.x) < 120 && Math.abs(ly - L.holder.y) < 22) return { type: 'holder' };
      const D = L.detail;
      if (lx > D.x && lx < D.x + D.w && ly > D.y && ly < D.y + D.h) return { type: 'detail' };
      return null;
    }

    /** Bildschirmkoordinaten eines Objekts (für Tests und Tastaturhilfe). */
    function anchor(target) {
      let p = null;
      if (target.type === 'tube') { const t = lab.tubeById(target.id); const r = restPose(t.place, t.slot); p = { x: r.x, y: r.y - 60 }; }
      else if (target.type === 'reagent') p = { x: L.reagentX[target.id], y: L.shelf.y - 60 };
      else if (target.type === 'sample') { const i = lab.state.samples.findIndex((s) => s.sampleId === target.id); p = { x: L.sample.x0 + i * L.sample.dx, y: L.sample.baseY - 40 }; }
      else if (target.type === 'bath') p = { x: L.bath.cx, y: L.bath.beakerTop + 40 };
      else if (target.type === 'hotplate') p = { x: L.bath.cx - 82, y: L.bath.plateTop + 33 };
      else if (target.type === 'burner') p = { x: L.burner.cx, y: L.burner.baseY - 60 };
      else if (target.type === 'flame') p = { x: L.burner.cx, y: L.burner.topY - 90 };
      else if (target.type === 'rack') p = { x: (L.rack.x0 + L.rack.x1) / 2, y: L.rack.baseY - 10 };
      return p ? toClient(p.x, p.y) : null;
    }

    return {
      frame, resize, toLogical, toClient, hitTest, anchor, pointer, layout: L,
      // Messpunkte für automatisierte Prüfung der Darstellung (Lupe)
      probe() {
        const D = L.detail;
        const ix = D.x + 10, iy = D.y + 40, iw = D.w - 20, ih = D.h - 50;
        const cx = ix + iw / 2, by = iy + ih - 22;
        return { cx, by, Z, tubeH: TUBE.h, portionH: TUBE.portionH, r: TUBE.r, toClient };
      }
    };
  }

  RL.render = { createRenderer, W, H };
})(typeof self !== 'undefined' ? self : this);
