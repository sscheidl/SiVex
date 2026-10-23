/*
 * Trennlabor – Darstellung „Klassische Trennverfahren“ (Canvas 2D)
 *
 * Zeichnet ausschließlich aus dem Modellzustand (TL.classic). Füllhöhen werden
 * volumentreu aus der Gefäßform berechnet; Bewegungen (Gießen, Rühren,
 * Tropfen, Dampf) sind zeitabhängig aus dem Zustand der laufenden Handlung
 * abgeleitet.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const { clamp, lerp } = TL.core;
  const G = TL.gfx;
  const K = TL.classic;

  const W = 1180, H = 840, BENCH = 690;
  const SLOT_X = { b0: 68, b1: 190, b2: 312, b3: 434, b4: 556, b5: 678 };
  const HB = BENCH - 36; // Oberseite der Heizplatte
  const ST = { filter: { x: 814, base: BENCH }, heater: { x: 984, base: HB }, sep: { x: 1108, base: BENCH } };
  const FUN = { x: 814, top: 428, coneH: 92, topR: 62, stemR: 5, stemEnd: 600 };
  const SEP = { x: 1108, top: 226, bottom: 510, cock: 538, stemEnd: 616 };
  const SHELF = { y: 188, x0: 10, x1: 726 };
  const TOOLS = { bottle: 48, kettle: 138, rod: 226, magnet: 302, sieve: 394, scale: 516, waste: 660 };

  // ------------------------------------------------------- Gefäßgeometrie
  /** Profile: Innenradius r(h) über der Innenbodenhöhe h (px). capH: Höhe bei Nennvolumen. */
  const GEOM = {
    beaker: { w: 104, h: 138, inner: 128, capH: 120, r: () => 47, flat: true },
    erlenmeyer: { w: 112, h: 142, inner: 136, capH: 122, r: (h) => (h < 104 ? 52 - 34 * h / 104 : 18), flat: true },
    dish: { w: 134, h: 46, inner: 42, capH: 38, r: (h) => Math.sqrt(Math.max(0, 74 * 74 - (74 - h) * (74 - h))), bowl: 74 },
    watch: { w: 104, h: 18, inner: 15, capH: 13, r: (h) => Math.sqrt(Math.max(0, 98 * 98 - (98 - h) * (98 - h))), bowl: 98 },
    source: { w: 124, h: 42, inner: 38, capH: 34, r: (h) => Math.sqrt(Math.max(0, 70 * 70 - (70 - h) * (70 - h))), bowl: 70 },
    funnel: { inner: FUN.coneH, capH: FUN.coneH * 0.86, r: (h) => 7 + (FUN.topR - 9) * h / FUN.coneH },
    sep: { inner: 270, capH: 210, r: (h) => (h < 14 ? 6 + h * 0.9 : h < 140 ? 18 + 44 * Math.pow((h - 14) / 126, 0.65) : h < 252 ? 62 - 50 * Math.pow((h - 140) / 112, 1.8) : 12) },
    sieve: { inner: 40, capH: 36, r: (h) => Math.sqrt(Math.max(0, 46 * 46 - (46 - h) * (46 - h))) }
  };
  const tables = {};
  function volTable(type) {
    if (tables[type]) return tables[type];
    const g = GEOM[type];
    const cap = K.TYPES[type].cap;
    const raw = [0];
    for (let h = 1; h <= g.inner; h++) { const r = g.r(h - 0.5); raw.push(raw[h - 1] + Math.PI * r * r); }
    const k = cap / raw[Math.round(g.capH)];
    tables[type] = raw.map((v) => v * k);
    return tables[type];
  }
  /** Höhe (px) für ein Volumen (mL) in einem Gefäßtyp. */
  function heightFor(type, vol) {
    const t = volTable(type);
    if (vol <= 0) return 0;
    for (let h = 1; h < t.length; h++) if (t[h] >= vol) return h - 1 + (vol - t[h - 1]) / (t[h] - t[h - 1]);
    return t.length - 1;
  }

  // ------------------------------------------------------- Farben
  const C = {
    water: [190, 222, 245, 0.42], dye: [176, 16, 58], sand: [212, 186, 136], iron: [78, 80, 86], salt: [246, 246, 244],
    oil: [236, 196, 58, 0.82], emul: [236, 228, 196, 0.92], petal: [126, 18, 46], glassFill: 'rgba(225,238,248,0.22)'
  };

  function liquidColor(c) {
    const d = K.describe(c);
    let col = C.water.slice();
    const dye = clamp(d.dyeConc / 0.22, 0, 1);
    if (dye > 0) col = G.mix(col, [C.dye[0], C.dye[1], C.dye[2], 0.9], Math.pow(dye, 0.7));
    const turb = clamp(d.turbidity * 9, 0, 0.9);
    if (turb > 0) col = G.mix(col, [196, 170, 120, 0.95], turb);
    return col;
  }

  function createRenderer(canvas) {
    const view = G.createView(canvas, W, H);
    const ctx = view.ctx;
    let time = 0;

    // ------------------------------------------------- Position eines Gefäßes
    function placePos(place) {
      if (SLOT_X[place] != null) return { x: SLOT_X[place], base: BENCH };
      if (ST[place]) return { x: ST[place].x, base: ST[place].base };
      return { x: 0, base: BENCH };
    }

    function vesselPose(e, v) {
      const st = e.state;
      const op = st.op;
      let pos = placePos(v.place);
      let angle = 0, lift = 0;
      if (op && op.type === 'move' && op.id === v.id) {
        const a = placePos(op.from), b = placePos(op.to);
        const p = G.ease(clamp(op.t / op.dur, 0, 1));
        pos = { x: lerp(a.x, b.x, p), base: lerp(a.base, b.base, p) - Math.sin(p * Math.PI) * 60 };
      }
      if (op && (op.type === 'pour') && op.from === v.id) {
        const tgt = targetMouth(e, op.to);
        const p = clamp(op.t / op.dur, 0, 1);
        const up = G.ease(clamp(p / 0.25, 0, 1)) * (1 - G.ease(clamp((p - 0.88) / 0.12, 0, 1)));
        const side = tgt.x > pos.x ? -1 : 1;
        const g = GEOM[v.type];
        const dx = tgt.x + side * (g.w * 0.42) - pos.x;
        const dyBase = tgt.y - 6 - pos.base + g.h * 0.15;
        const tilt = (op.mode === 'all' ? 1.75 : op.mode === 'fast' ? 1.45 : 1.25);
        pos = { x: pos.x + dx * up, base: pos.base + Math.min(0, dyBase) * up };
        angle = -side * tilt * G.ease(clamp((p - 0.12) / 0.3, 0, 1)) * (1 - G.ease(clamp((p - 0.82) / 0.12, 0, 1)));
        lift = up;
      }
      return { x: pos.x, base: pos.base, angle, lift };
    }

    /** Öffnung, in die gegossen wird. */
    function targetMouth(e, id) {
      if (id === 'waste') return { x: TOOLS.waste, y: SHELF.y - 92 };
      if (id === 'F') return { x: FUN.x, y: FUN.top };
      if (id === 'S') return { x: SEP.x, y: SEP.top + 4 };
      if (id === 'T') { const v = e.vessel(e.state.sieve.on); const p = placePos(v ? v.place : 'b0'); return { x: p.x, y: p.base - GEOM[v ? v.type : 'beaker'].h - 18 }; }
      const v = e.vessel(id);
      const p = placePos(v.place);
      return { x: p.x, y: p.base - GEOM[v.type].h };
    }

    // ------------------------------------------------- Gefäße zeichnen
    function vesselPath(type, x, base) {
      const g = GEOM[type];
      ctx.beginPath();
      if (type === 'beaker') {
        const hw = g.w / 2;
        ctx.moveTo(x - hw - 4, base - g.h);
        ctx.lineTo(x - hw, base - g.h + 6);
        ctx.lineTo(x - hw, base - 6);
        ctx.quadraticCurveTo(x - hw, base, x - hw + 6, base);
        ctx.lineTo(x + hw - 6, base);
        ctx.quadraticCurveTo(x + hw, base, x + hw, base - 6);
        ctx.lineTo(x + hw, base - g.h);
      } else if (type === 'erlenmeyer') {
        ctx.moveTo(x - 20, base - g.h);
        ctx.lineTo(x - 18, base - g.h + 4);
        ctx.lineTo(x - 18, base - 108);
        ctx.lineTo(x - g.w / 2 + 2, base - 8);
        ctx.quadraticCurveTo(x - g.w / 2, base, x - g.w / 2 + 8, base);
        ctx.lineTo(x + g.w / 2 - 8, base);
        ctx.quadraticCurveTo(x + g.w / 2, base, x + g.w / 2 - 2, base - 8);
        ctx.lineTo(x + 18, base - 108);
        ctx.lineTo(x + 18, base - g.h + 4);
        ctx.lineTo(x + 20, base - g.h);
      } else {
        const R = g.bowl;
        const hw = g.w / 2;
        const depth = g.h;
        ctx.moveTo(x - hw - 2, base - depth);
        // Schalenform: Kreisbogen
        const cy = base - R;
        const a0 = Math.PI / 2 + Math.asin(Math.min(1, hw / R));
        const a1 = Math.PI / 2 - Math.asin(Math.min(1, hw / R));
        ctx.arc(x, cy + (R - depth) * 0 + 0, R, a0, a1, true);
        ctx.lineTo(x + hw + 2, base - depth);
      }
    }
    function innerClip(type, x, base) {
      const g = GEOM[type];
      ctx.beginPath();
      if (g.flat) {
        for (let h = 0; h <= g.inner; h += 2) ctx.lineTo(x - g.r(h), base - 3 - h);
        for (let h = g.inner; h >= 0; h -= 2) ctx.lineTo(x + g.r(h), base - 3 - h);
      } else {
        for (let h = 0; h <= g.inner; h += 1) ctx.lineTo(x - g.r(h), base - 2 - h);
        for (let h = g.inner; h >= 0; h -= 1) ctx.lineTo(x + g.r(h), base - 2 - h);
      }
      ctx.closePath();
    }

    /** Inhalt in einem Gefäß. bottomY: Innenboden, rFn: Radiusprofil, type für Volumentabelle. */
    function drawContents(c, type, x, bottomY, seed, opts) {
      const o = opts || {};
      const d = K.describe(c);
      const g = GEOM[type];
      const rnd = G.rng(seed);
      const sedBulk = c.sand * (1 - c.susp) / K.BULK.sand + c.iron / K.BULK.iron + c.saltS / K.BULK.saltS;
      const sedH = heightFor(type, sedBulk);
      const liqTotal = d.liquid;
      const fillV = liqTotal > 0 ? Math.max(sedBulk, sedBulk * 0.6 + liqTotal) : sedBulk;
      const topH = heightFor(type, fillV);
      // Flüssigkeit
      if (liqTotal > 0.05) {
        const layered = d.layered;
        const parts = [];
        if (layered) {
          const vW = d.freeWater, vE = d.emulsion, vO = d.freeOil;
          let acc = sedBulk * 0.6;
          const hAt = (v) => heightFor(type, Math.max(sedBulk, acc + v));
          let h0 = sedH;
          const pushLayer = (vol, col) => { if (vol <= 0.01) return; const h1 = hAt(vol); parts.push([h0, h1, col]); acc += vol; h0 = h1; };
          pushLayer(vW, liquidColor(Object.assign({}, c, { oil: 0 })));
          pushLayer(vE, C.emul);
          pushLayer(vO, C.oil);
        } else {
          const col = c.oil > c.water ? C.oil : liquidColor(c);
          parts.push([sedH * 0.5, topH, col]);
        }
        for (const [h0, h1, col] of parts) {
          ctx.fillStyle = G.rgba(col);
          ctx.fillRect(x - 200, bottomY - h1, 400, h1 - h0 + 0.6);
        }
        // Oberfläche
        const rTop = g.r(topH);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x - rTop, bottomY - topH - 1, rTop * 2, 2.2);
        // Schwebeteilchen
        if (d.suspended > 0.02 && !layered) {
          const n = Math.min(140, Math.round(d.suspended * 18 + 6));
          ctx.fillStyle = 'rgba(150,120,70,0.75)';
          for (let i = 0; i < n; i++) {
            const hh = sedH + (topH - sedH) * ((rnd() + time * 0.02 * (rnd() - 0.5)) % 1 + 1) % 1;
            const rr = g.r(hh) - 3;
            const px = x + (rnd() * 2 - 1) * rr + Math.sin(time * 1.3 + i) * 1.5;
            ctx.fillRect(px, bottomY - hh, 1.8, 1.8);
          }
        }
        // Blasen beim Sieden
        if (o.boil) {
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
          for (let i = 0; i < 14; i++) {
            const ph = (time * (0.8 + rnd()) + rnd()) % 1;
            const hh = sedH + (topH - sedH) * ph;
            const rr = g.r(hh) - 5;
            ctx.beginPath(); ctx.arc(x + (rnd() * 2 - 1) * rr, bottomY - hh, 1.5 + ph * 2, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
      // Bodensatz (Sand, Eisen, Salzkristalle)
      if (sedBulk > 0.02) {
        const total = c.sand * (1 - c.susp) + c.iron + c.saltS;
        const fs = total > 0 ? c.sand * (1 - c.susp) / total : 0, fi = total > 0 ? c.iron / total : 0;
        let col = G.mix(C.salt, C.sand, fs + fi > 0 ? fs / (fs + fi + 1e-9) : 0);
        col = G.mix(col, C.iron, fi);
        if (fs + fi < 0.05) col = C.salt;
        const shape = () => {
          ctx.beginPath();
          ctx.moveTo(x - 200, bottomY + 2);
          const r = g.r(sedH);
          const lump = liqTotal < 0.3 && type !== 'dish' && type !== 'watch' ? 1 : 0;
          for (let i = 0; i <= 20; i++) {
            const xx = x - r + 2 * r * i / 20;
            const bump = lump ? Math.sin(Math.PI * i / 20) * Math.min(10, sedH * 0.6) : 0;
            ctx.lineTo(xx, bottomY - sedH - bump + Math.sin(i * 1.7 + seed) * 0.8);
          }
          ctx.lineTo(x + 200, bottomY + 2);
          ctx.closePath();
        };
        shape();
        ctx.fillStyle = G.rgba(col, 1); ctx.fill();
        // Körnung
        ctx.save(); shape(); ctx.clip();
        const n = Math.min(500, Math.round(sedBulk * 40 + 30));
        for (let i = 0; i < n; i++) {
          const hh = rnd() * (sedH + 8);
          const rr = g.r(hh);
          const px = x + (rnd() * 2 - 1) * rr;
          const which = rnd();
          if (which < fi) ctx.fillStyle = 'rgba(40,42,46,0.9)';
          else if (which < fi + (c.saltS / Math.max(1e-6, total))) ctx.fillStyle = 'rgba(255,255,255,0.95)';
          else ctx.fillStyle = rnd() < 0.5 ? 'rgba(160,132,84,0.8)' : 'rgba(236,214,170,0.9)';
          const s = which < fi ? 2.6 : 2;
          ctx.fillRect(px, bottomY - hh, s, s * (which < fi ? 0.5 : 1));
        }
        ctx.restore();
      }
      // Salzkristalle am Rand / Kruste beim Eindampfen
      if (c.saltS > 0.05 && liqTotal < 3 && (type === 'dish' || type === 'watch' || type === 'beaker' || type === 'source')) {
        const n = Math.min(160, Math.round(c.saltS * 26));
        for (let i = 0; i < n; i++) {
          const hh = rnd() * Math.max(5, Math.min(g.inner * 0.6, 4 + c.saltS * 2.6));
          const rr = g.r(hh) - 3;
          const px = x + (rnd() * 2 - 1) * rr;
          const s = 2 + rnd() * 3.2;
          ctx.fillStyle = rnd() < 0.3 ? 'rgba(220,226,232,1)' : 'rgba(255,255,255,1)';
          ctx.fillRect(px, bottomY - hh - s, s, s);
          ctx.strokeStyle = 'rgba(160,170,180,0.6)'; ctx.lineWidth = 0.6; ctx.strokeRect(px, bottomY - hh - s, s, s);
        }
      }
      // Hibiskusblüten
      if (c.petals > 0.01) {
        const n = Math.max(1, Math.round(c.petals * 7));
        const wet = liqTotal > 1;
        for (let i = 0; i < n; i++) {
          const ph = rnd();
          const hh = wet ? sedH + 3 + ph * Math.max(4, (topH - sedH) * (c.agit > 0.3 ? 0.95 : 0.45)) + (c.agit > 0.3 ? Math.sin(time * 2 + i) * 6 : 0) : 3 + ph * Math.min(26, 6 + c.petals * 5);
          const rr = g.r(Math.min(hh, g.inner)) - 8;
          const px = x + (rnd() * 2 - 1) * Math.max(4, rr);
          ctx.save();
          ctx.translate(px, bottomY - hh);
          ctx.rotate(rnd() * 6.28 + (wet && c.agit > 0.3 ? time : 0));
          ctx.fillStyle = G.rgba(wet ? C.petal : [150, 30, 50]);
          ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(80,10,30,0.6)'; ctx.fillRect(-4, -0.5, 8, 1);
          ctx.restore();
        }
      }
      return { topH, sedH };
    }

    function drawGraduation(type, x, bottomY) {
      if (type !== 'beaker' && type !== 'erlenmeyer') return;
      ctx.save();
      ctx.strokeStyle = 'rgba(70,90,110,0.55)'; ctx.fillStyle = 'rgba(70,90,110,0.75)'; ctx.lineWidth = 1;
      ctx.font = '600 9px system-ui, sans-serif'; ctx.textAlign = 'left';
      const marks = type === 'beaker' ? [50, 100, 150, 200, 250] : [50, 100, 150, 200];
      for (const m of marks) {
        const h = heightFor(type, m);
        const r = GEOM[type].r(h);
        const xx = type === 'beaker' ? x - r + 6 : x + r - 22;
        ctx.beginPath(); ctx.moveTo(xx, bottomY - h); ctx.lineTo(xx + (m % 100 === 0 ? 14 : 9), bottomY - h); ctx.stroke();
        if (m % 100 === 0 || type === 'erlenmeyer') ctx.fillText(String(m), xx + 16, bottomY - h + 3);
      }
      ctx.restore();
    }

    /** Porzellanschalen sind undurchsichtig: Inhalt wird durch die Öffnung (leichte Aufsicht) gezeigt. */
    const PORCELAIN = { dish: true, source: true };
    function drawPorcelain(e, v, x, base) {
      const g = GEOM[v.type];
      const hw = g.w / 2, depth = g.h, rimY = base - depth, ry = v.type === 'dish' ? 12 : 11;
      const c = v.c;
      // Außenseite
      ctx.beginPath();
      ctx.moveTo(x - hw, rimY);
      ctx.bezierCurveTo(x - hw + 4, base - 6, x - 30, base - 2, x - 22, base);
      ctx.lineTo(x + 22, base);
      ctx.bezierCurveTo(x + 30, base - 2, x + hw - 4, base - 6, x + hw, rimY);
      ctx.closePath();
      const gr = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
      gr.addColorStop(0, '#e6e1d8'); gr.addColorStop(0.35, '#fbfaf7'); gr.addColorStop(1, '#d9d3c8');
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = 'rgba(120,112,100,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
      if (v.type === 'dish') { ctx.fillStyle = 'rgba(150,140,125,0.6)'; ctx.fillRect(x + hw - 10, rimY - 2, 14, 5); }
      // Innenseite (Aufsicht)
      ctx.beginPath(); ctx.ellipse(x, rimY, hw, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ece8e0'; ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x, rimY, hw - 2, ry - 1.5, 0, 0, Math.PI * 2); ctx.clip();
      const d = e.describe(c);
      const solidsBulk = c.sand / K.BULK.sand + c.iron / K.BULK.iron + c.saltS / K.BULK.saltS;
      const fillV = d.liquid > 0.05 ? solidsBulk * 0.6 + d.liquid : solidsBulk;
      const topH = heightFor(v.type, fillV);
      const k = clamp(g.r(Math.max(2, topH)) / g.r(g.inner), 0.15, 1);
      const cy = rimY + (1 - topH / g.inner) * 5;
      const rnd = G.rng(G.hash(v.id + e.state.taskId));
      if (solidsBulk > 0.02 && d.liquid < 0.05) {
        // Feststoffhaufen bzw. Kruste
        const total = c.sand + c.iron + c.saltS;
        let col = G.mix(C.salt, C.sand, total ? c.sand / total : 0);
        col = G.mix(col, C.iron, total ? c.iron / total : 0);
        ctx.fillStyle = G.rgba(col);
        ctx.beginPath(); ctx.ellipse(x, cy + 1, hw * Math.max(0.35, k), ry * Math.max(0.35, k), 0, 0, Math.PI * 2); ctx.fill();
        const n = Math.min(420, Math.round(total * 28 + 20));
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
          const px = x + Math.cos(a) * r * hw * Math.max(0.35, k) * 0.95, py = cy + 1 + Math.sin(a) * r * ry * Math.max(0.35, k) * 0.9;
          const w = rnd();
          if (w < (total ? c.iron / total : 0)) { ctx.fillStyle = 'rgba(45,46,50,0.95)'; ctx.fillRect(px, py, 3, 1.2); }
          else if (w < (total ? (c.iron + c.saltS) / total : 0)) { const sz = 1.6 + rnd() * 2.4; ctx.fillStyle = '#ffffff'; ctx.fillRect(px, py - sz, sz, sz); ctx.strokeStyle = 'rgba(150,160,170,0.7)'; ctx.lineWidth = 0.5; ctx.strokeRect(px, py - sz, sz, sz); }
          else { ctx.fillStyle = rnd() < 0.5 ? 'rgba(160,132,84,0.9)' : 'rgba(236,214,170,0.95)'; ctx.fillRect(px, py, 1.8, 1.8); }
        }
      } else if (d.liquid > 0.05) {
        const col = liquidColor(c);
        ctx.fillStyle = G.rgba(col, Math.max(0.55, col[3] || 0.5));
        ctx.beginPath(); ctx.ellipse(x, cy, hw * k, ry * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, cy, hw * k * 0.96, ry * k * 0.92, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
        // Kristalle am Rand und am Boden, wenn die Lösung gesättigt ist
        if (c.saltS > 0.05) {
          const n = Math.min(160, Math.round(c.saltS * 30));
          for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = 0.55 + rnd() * 0.45; const sz = 1.5 + rnd() * 2.2; ctx.fillStyle = '#fff'; ctx.fillRect(x + Math.cos(a) * r * hw * k, cy + Math.sin(a) * r * ry * k - sz, sz, sz); }
        }
        if (c.sand > 0.05) {
          const n = Math.min(260, Math.round(c.sand * 18));
          for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()); ctx.fillStyle = 'rgba(150,120,75,0.75)'; ctx.fillRect(x + Math.cos(a) * r * hw * k * 0.9, cy + Math.sin(a) * r * ry * k * 0.85, 1.8, 1.8); }
        }
        if (v.place === 'heater' && c.temp >= 99.5 && e.state.heater && e.state.heater.level > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
          for (let i = 0; i < 10; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()); const ph = (time * 2 + rnd()) % 1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * hw * k * 0.8, cy + Math.sin(a) * r * ry * k * 0.7, 1 + ph * 2.5, 0, 7); ctx.stroke(); }
        }
      }
      if (c.petals > 0.01) {
        const n = Math.max(1, Math.round(c.petals * 7));
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
          ctx.save(); ctx.translate(x + Math.cos(a) * r * hw * 0.6, cy + Math.sin(a) * r * ry * 0.6); ctx.rotate(rnd() * 6.28);
          ctx.fillStyle = G.rgba([150, 30, 50]); ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(x, rimY, hw, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(120,112,100,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
    }

    function drawVessel(e, v, ui) {
      const pose = vesselPose(e, v);
      const g = GEOM[v.type];
      const x = pose.x, base = pose.base;
      ctx.save();
      if (pose.angle) {
        const pivotX = x + (pose.angle < 0 ? g.w / 2 : -g.w / 2), pivotY = base - g.h;
        ctx.translate(pivotX, pivotY); ctx.rotate(pose.angle); ctx.translate(-pivotX, -pivotY);
      }
      if (PORCELAIN[v.type]) {
        drawPorcelain(e, v, x, base);
        ctx.restore();
        const op0 = e.state.op;
        if (op0 && op0.type === 'pour' && op0.from === v.id) drawStream(e, op0, pose, v);
        if (v.c.temp > 85 && v.c.water > 0.05 && !pose.angle) drawSteam(x, base - g.h - 4, clamp((v.c.temp - 85) / 15, 0, 1), G.hash(v.id));
        finishVessel(e, v, ui, pose);
        return;
      }
      // Glasinneres
      vesselPath(v.type, x, base);
      ctx.fillStyle = C.glassFill; ctx.fill();
      ctx.save();
      innerClip(v.type, x, base);
      ctx.clip();
      if (!pose.angle) {
        const boil = v.place === 'heater' && v.c.temp >= 99.5 && v.c.water > 0.2 && e.state.heater && e.state.heater.level > 0;
        drawContents(v.c, v.type, x, base - (g.flat ? 3 : 2), G.hash(v.id + e.state.taskId), { boil });
      } else {
        // beim Gießen: Inhalt vereinfacht als Pegel im geneigten Glas
        drawContents(v.c, v.type, x, base - 3, G.hash(v.id + e.state.taskId), {});
      }
      ctx.restore();
      drawGraduation(v.type, x, base - 3);
      vesselPath(v.type, x, base);
      G.glass(ctx, 2.4);
      // Glanz
      if (g.flat) { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x + g.w / 2 - 16, base - g.h + 14, 5, g.h - 30); }
      ctx.restore();
      // Gießstrahl
      const op = e.state.op;
      if (op && op.type === 'pour' && op.from === v.id) drawStream(e, op, pose, v);
      // Dampf über heißem Gefäß
      if (v.c.temp > 85 && v.c.water > 0.05 && !pose.angle) drawSteam(x, base - g.h - 4, clamp((v.c.temp - 85) / 15, 0, 1), G.hash(v.id));
      finishVessel(e, v, ui, pose);
    }

    function finishVessel(e, v, ui, pose) {
      const g = GEOM[v.type];
      const x = pose.x, base = pose.base;
      // Beschriftung und Trefferfläche
      if (!pose.lift && v.place !== 'moving') {
        G.label(ctx, v.type === 'source' ? shortLabel(v.label) : v.label, x, base + (v.place === 'heater' ? 62 : 24), { size: 14 });
        if (v.c.temp > 30) G.label(ctx, `${Math.round(v.c.temp)} °C`, x + g.w / 2 + 6, base - g.h - 10, { size: 11.5, align: 'left', bg: 'rgba(255,240,225,0.95)', color: '#a33a10' });
        view.addHot(v.id, x - g.w / 2 - 8, base - g.h - 16, g.w + 16, g.h + 50, { kind: 'vessel' });
        if (ui.sel === v.id) G.highlight(ctx, x - g.w / 2, base - g.h - 4, g.w, g.h + 8, 'sel', time);
        else if (ui.targets && ui.targets.includes(v.id)) G.highlight(ctx, x - g.w / 2, base - g.h - 4, g.w, g.h + 8, 'target', time);
      }
    }
    const shortLabel = (l) => (l.startsWith('Gemisch') ? 'Gemisch' : l.startsWith('Getrocknete') ? 'Hibiskusblüten' : l);

    function drawStream(e, op, pose, v) {
      const p = clamp(op.t / op.dur, 0, 1);
      if (p < 0.25 || p > 0.86 || op.waiting) return;
      const g = GEOM[v.type];
      const tgt = targetMouth(e, op.to);
      const lipX = pose.x + (pose.angle < 0 ? g.w / 2 : -g.w / 2) + (pose.angle < 0 ? 4 : -4);
      const lipY = pose.base - g.h + 2;
      const plan = op.plan;
      const liquid = plan.water + plan.oil;
      const col = plan.oil > plan.water ? C.oil : liquidColor({ water: plan.water || 1, saltD: plan.saltD, dye: plan.dye, sand: plan.sand, susp: 1, oil: 0, iron: 0, petals: 0, saltS: 0, petalDye: 0, emW: 0, emO: 0 });
      const wdt = clamp(2 + liquid / 25, 2, 7);
      ctx.save();
      ctx.strokeStyle = liquid > 0.5 ? G.rgba(col, Math.max(0.55, col[3] || 0.6)) : 'rgba(200,180,140,0.9)';
      ctx.lineWidth = wdt; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lipX, lipY);
      ctx.quadraticCurveTo(lipX + (tgt.x - lipX) * 0.2, lipY + 10, tgt.x + (lipX < tgt.x ? -8 : 8), tgt.y + 8);
      ctx.stroke();
      // Feststoffkörner im Strahl
      const solid = plan.sand + plan.iron + plan.saltS + plan.petals;
      if (solid > 0.2) {
        const rnd = G.rng(7);
        for (let i = 0; i < 26; i++) {
          const f = (rnd() + time * 1.8) % 1;
          const xx = lerp(lipX, tgt.x, f), yy = lerp(lipY, tgt.y + 8, f * f);
          ctx.fillStyle = plan.petals > plan.sand ? G.rgba(C.petal) : plan.iron > plan.sand ? 'rgba(60,60,66,0.9)' : 'rgba(170,140,90,0.95)';
          ctx.fillRect(xx + (rnd() - 0.5) * 6, yy, 2.4, 2.4);
        }
      }
      ctx.restore();
    }

    function drawSteam(x, y, k, seed) {
      const rnd = G.rng(seed);
      ctx.save();
      for (let i = 0; i < 9; i++) {
        const ph = (time * 0.35 + rnd()) % 1;
        const xx = x + (rnd() - 0.5) * 60 + Math.sin(time + i) * 8 * ph;
        const yy = y - ph * 110;
        ctx.fillStyle = `rgba(255,255,255,${0.32 * k * (1 - ph)})`;
        ctx.beginPath(); ctx.arc(xx, yy, 10 + ph * 22, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ------------------------------------------------- Geräte
    function drawShelf(e, ui) {
      const st = e.state;
      ctx.fillStyle = '#c4ced7'; ctx.fillRect(SHELF.x0, SHELF.y, SHELF.x1 - SHELF.x0, 12);
      ctx.fillStyle = '#a8b4bf'; ctx.fillRect(SHELF.x0, SHELF.y + 12, SHELF.x1 - SHELF.x0, 4);
      // Spritzflasche (kaltes Wasser)
      const bx = TOOLS.bottle, by = SHELF.y;
      const wOp = st.op && st.op.type === 'water' ? st.op : null;
      if (!(wOp && !wOp.hot)) drawWashBottle(bx, by, 0);
      G.label(ctx, 'Wasser', bx, by + 30, { size: 13.5 });
      view.addHot('water', bx - 30, by - 112, 60, 150, { kind: 'tool' });
      if (st.water.hot) {
        if (!(wOp && wOp.hot)) drawKettle(TOOLS.kettle, by, 0);
        G.label(ctx, 'Heißes Wasser', TOOLS.kettle, by + 30, { size: 13.5 });
        view.addHot('hotwater', TOOLS.kettle - 44, by - 100, 88, 140, { kind: 'tool' });
      }
      // Glasstab
      ctx.save(); ctx.strokeStyle = 'rgba(120,150,170,0.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      if (!(st.op && st.op.type === 'stir')) { ctx.beginPath(); ctx.moveTo(TOOLS.rod - 34, by - 6); ctx.lineTo(TOOLS.rod + 30, by - 70); ctx.stroke(); }
      ctx.restore();
      G.label(ctx, 'Glasstab', TOOLS.rod, by + 30, { size: 13.5 });
      view.addHot('rod', TOOLS.rod - 40, by - 80, 80, 120, { kind: 'tool' });
      // Magnet
      if (st.magnet) {
        if (!(st.op && (st.op.type === 'magnet' || st.op.type === 'release'))) drawMagnet(TOOLS.magnet, by - 12, st.magnet.iron, 0);
        G.label(ctx, 'Magnet', TOOLS.magnet, by + 30, { size: 13.5 });
        view.addHot('magnet', TOOLS.magnet - 36, by - 96, 72, 136, { kind: 'tool' });
        if (ui.sel === 'magnet') G.highlight(ctx, TOOLS.magnet - 30, by - 92, 60, 96, 'sel', time);
      }
      // Teesieb (wenn nicht aufgelegt)
      if (st.sieve && !st.sieve.on) {
        drawSieve(TOOLS.sieve, by - 26, st.sieve.c);
        G.label(ctx, 'Teesieb', TOOLS.sieve, by + 30, { size: 13.5 });
        view.addHot('T', TOOLS.sieve - 56, by - 70, 112, 110, { kind: 'device' });
        if (ui.sel === 'T') G.highlight(ctx, TOOLS.sieve - 52, by - 64, 104, 66, 'sel', time);
      }
      // Waage
      drawScale(TOOLS.scale, by, st.lastWeigh);
      view.addHot('scale', TOOLS.scale - 70, by - 70, 140, 110, { kind: 'tool' });
      // Ausguss
      drawWaste(TOOLS.waste, by);
      view.addHot('waste', TOOLS.waste - 60, by - 100, 120, 140, { kind: 'waste' });
      if (ui.targets && ui.targets.includes('waste')) G.highlight(ctx, TOOLS.waste - 52, by - 96, 104, 96, 'target', time);
    }

    function drawWashBottle(x, base, tilt) {
      ctx.save();
      ctx.translate(x, base); ctx.rotate(tilt);
      G.rr(ctx, -24, -86, 48, 86, 12);
      const gr = ctx.createLinearGradient(-24, 0, 24, 0);
      gr.addColorStop(0, 'rgba(235,242,248,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.98)'); gr.addColorStop(1, 'rgba(210,222,232,0.95)');
      ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = 'rgba(110,130,150,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(180,215,240,0.55)'; ctx.fillRect(-21, -50, 42, 47);
      ctx.fillStyle = '#2f6fd1'; ctx.fillRect(-12, -98, 24, 14);
      ctx.strokeStyle = '#7a8b99'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -98); ctx.lineTo(0, -108); ctx.lineTo(26, -116); ctx.stroke();
      ctx.restore();
    }
    function drawKettle(x, base, tilt) {
      ctx.save(); ctx.translate(x, base); ctx.rotate(tilt);
      G.rr(ctx, -34, -78, 68, 78, 16);
      ctx.fillStyle = '#d6dde3'; ctx.fill(); ctx.strokeStyle = '#8796a4'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#5d6b78'; ctx.fillRect(-34, -8, 68, 8);
      ctx.beginPath(); ctx.moveTo(34, -60); ctx.lineTo(56, -76); ctx.lineTo(58, -70); ctx.lineTo(34, -48); ctx.closePath(); ctx.fillStyle = '#c3ccd4'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-34, -42, 18, Math.PI * 0.5, Math.PI * 1.5); ctx.lineWidth = 6; ctx.strokeStyle = '#4b5864'; ctx.stroke();
      ctx.fillStyle = '#e0703c'; ctx.beginPath(); ctx.arc(0, -86, 6, 0, 7); ctx.fill();
      G.text(ctx, '90 °C', 0, -36, { size: 11, align: 'center', color: '#a33a10', weight: 700 });
      ctx.restore();
    }
    function drawMagnet(x, y, iron, tilt) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      // Stabmagnet in Folie
      ctx.fillStyle = 'rgba(235,240,245,0.7)'; G.rr(ctx, -15, -84, 30, 96, 6); ctx.fill();
      ctx.fillStyle = '#c0392b'; ctx.fillRect(-11, -80, 22, 42);
      ctx.fillStyle = '#2c5fb8'; ctx.fillRect(-11, -38, 22, 44);
      G.text(ctx, 'N', 0, -54, { size: 13, color: '#fff', align: 'center', weight: 800 });
      G.text(ctx, 'S', 0, -12, { size: 13, color: '#fff', align: 'center', weight: 800 });
      if (iron > 0.02) {
        const rnd = G.rng(11);
        const n = Math.min(160, Math.round(iron * 32));
        ctx.fillStyle = 'rgba(55,56,60,0.95)';
        for (let i = 0; i < n; i++) { const a = rnd() * Math.PI; const r = 12 + rnd() * (4 + iron * 1.6); ctx.fillRect(Math.cos(a) * r * 0.9 - 1, 8 + Math.sin(a) * r * 0.55, 2.8, 1.2); }
      }
      ctx.restore();
    }
    function drawSieve(x, y, c) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 44, 0, Math.PI); ctx.closePath();
      ctx.fillStyle = 'rgba(200,205,210,0.35)'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(110,115,120,0.6)'; ctx.lineWidth = 0.8;
      for (let i = -44; i <= 44; i += 5) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + 46); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 46, y + i + 22); ctx.lineTo(x + 46, y + i + 22); ctx.stroke(); }
      if (c && (c.petals > 0.01 || c.water > 0.2)) {
        if (c.water > 0.2) { ctx.fillStyle = G.rgba(liquidColor(c), 0.6); ctx.fillRect(x - 46, y + 46 - Math.min(40, c.water * 0.8 + 6), 92, 60); }
        const rnd = G.rng(5);
        const n = Math.round(c.petals * 7);
        for (let i = 0; i < n; i++) { ctx.save(); ctx.translate(x + (rnd() - 0.5) * 60, y + 22 + rnd() * 20); ctx.rotate(rnd() * 6); ctx.fillStyle = G.rgba(C.petal); ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.4, 0, 0, 7); ctx.fill(); ctx.restore(); }
      }
      ctx.restore();
      ctx.strokeStyle = '#7d8790'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 46, y); ctx.lineTo(x + 46, y); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 46, y); ctx.lineTo(x + 92, y - 6); ctx.stroke();
      ctx.restore();
    }
    function drawScale(x, base, last) {
      ctx.save();
      G.rr(ctx, x - 66, base - 30, 132, 30, 6); ctx.fillStyle = '#e9edf1'; ctx.fill(); ctx.strokeStyle = '#9aa7b3'; ctx.stroke();
      ctx.fillStyle = '#c9d1d8'; ctx.fillRect(x - 54, base - 38, 108, 8);
      G.rr(ctx, x - 44, base - 24, 88, 18, 4); ctx.fillStyle = '#1f2a33'; ctx.fill();
      G.text(ctx, last ? `${TL.core.fmt(last.mass, 1)} g` : '0,0 g', x + 38, base - 10, { size: 13, color: '#7cf0a8', align: 'right', weight: 700, font: 'ui-monospace, Consolas, monospace' });
      G.label(ctx, last ? 'Waage: ' + (last.label.length > 22 ? last.label.slice(0, 21) + '…' : last.label) : 'Waage', x, base + 30, { size: 13.5 });
      ctx.restore();
    }
    function drawWaste(x, base) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x - 46, base - 92); ctx.lineTo(x - 38, base); ctx.lineTo(x + 38, base); ctx.lineTo(x + 46, base - 92); ctx.closePath();
      ctx.fillStyle = '#8d99a5'; ctx.fill(); ctx.strokeStyle = '#66727e'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#5c6874'; ctx.fillRect(x - 48, base - 96, 96, 8);
      G.text(ctx, 'Abfall', x, base - 40, { size: 13, color: '#fff', align: 'center', weight: 700 });
      G.label(ctx, 'Ausguss', x, base + 30, { size: 13.5 });
      ctx.restore();
    }

    function drawFunnelStation(e, ui) {
      const st = e.state;
      const f = st.funnel;
      // Stativ
      ctx.fillStyle = '#7b8792'; ctx.fillRect(FUN.x + 70, 300, 8, BENCH - 300);
      ctx.fillStyle = '#5e6a75'; ctx.fillRect(FUN.x + 36, BENCH - 8, 76, 10);
      ctx.fillStyle = '#7b8792'; ctx.fillRect(FUN.x + 40, FUN.top + 8, 34, 6);
      ctx.strokeStyle = '#7b8792'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(FUN.x, FUN.top + 12, 46, 7, 0, 0, Math.PI * 2); ctx.stroke();
      // Trichter
      const coneBottom = FUN.top + FUN.coneH;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(FUN.x - FUN.topR, FUN.top);
        ctx.lineTo(FUN.x - 7, coneBottom);
        ctx.lineTo(FUN.x - FUN.stemR, FUN.stemEnd);
        ctx.lineTo(FUN.x + FUN.stemR, FUN.stemEnd);
        ctx.lineTo(FUN.x + 7, coneBottom);
        ctx.lineTo(FUN.x + FUN.topR, FUN.top);
      };
      path(); ctx.fillStyle = C.glassFill; ctx.fill();
      // Filterpapier
      if (f.paper === 'folded' || f.paper === 'torn') {
        ctx.beginPath(); ctx.moveTo(FUN.x - FUN.topR + 6, FUN.top - 6); ctx.lineTo(FUN.x, coneBottom - 2); ctx.lineTo(FUN.x + FUN.topR - 6, FUN.top - 6); ctx.closePath();
        ctx.fillStyle = 'rgba(252,252,248,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(170,170,160,0.9)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = 'rgba(190,190,180,0.8)'; ctx.beginPath(); ctx.moveTo(FUN.x, FUN.top - 6); ctx.lineTo(FUN.x, coneBottom - 4); ctx.stroke();
        if (f.paper === 'torn') { ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(FUN.x - 10, coneBottom - 30); ctx.lineTo(FUN.x - 2, coneBottom - 22); ctx.lineTo(FUN.x - 9, coneBottom - 14); ctx.stroke(); }
      } else if (f.paper === 'flat') {
        ctx.beginPath(); ctx.moveTo(FUN.x - FUN.topR - 14, FUN.top - 4); ctx.quadraticCurveTo(FUN.x, FUN.top + 40, FUN.x + FUN.topR + 14, FUN.top - 4);
        ctx.strokeStyle = 'rgba(160,160,150,0.95)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = 'rgba(252,252,248,0.85)'; ctx.fill();
      }
      // Inhalt
      ctx.save(); path(); ctx.clip();
      drawContents(f.c, 'funnel', FUN.x, coneBottom, 99, {});
      ctx.restore();
      path(); G.glass(ctx, 2.4);
      // Tropfen / Strahl
      const rec = e.funnelReceiver();
      const L = f.c.water + f.c.oil;
      const retain = (f.paper === 'none' ? 0.2 : 1) + 0.25 * (f.c.sand + f.c.iron + f.c.saltS) + 2.5 * f.c.petals;
      if (L > retain + 0.05) {
        const col = liquidColor(f.paper === 'folded' ? Object.assign({}, f.c, { susp: 0, sand: 0 }) : f.c);
        const endY = rec ? BENCH - GEOM[rec.type].h + 20 : BENCH - 4;
        if (f.paper === 'none' || f.paper === 'torn') {
          ctx.strokeStyle = G.rgba(col, 0.75); ctx.lineWidth = f.paper === 'none' ? 4 : 2.5; ctx.beginPath(); ctx.moveTo(FUN.x, FUN.stemEnd); ctx.lineTo(FUN.x, endY); ctx.stroke();
        } else {
          for (let i = 0; i < 3; i++) {
            const ph = (time * (f.paper === 'flat' ? 2.2 : 1.4) + i / 3) % 1;
            const yy = FUN.stemEnd + ph * (endY - FUN.stemEnd);
            ctx.fillStyle = G.rgba(col, 0.9);
            ctx.beginPath(); ctx.ellipse(FUN.x, yy, 2.4, 3.6, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      const lbl = { folded: 'Trichter mit Filterpapier', flat: 'Trichter (Papier flach aufgelegt)', torn: 'Trichter (Filterpapier gerissen)', none: 'Trichter ohne Filterpapier' }[f.paper];
      G.label(ctx, lbl, FUN.x, FUN.top - 32, { size: 13.5 });
      view.addHot('F', FUN.x - FUN.topR - 10, FUN.top - 46, FUN.topR * 2 + 20, FUN.stemEnd - FUN.top + 46, { kind: 'device' });
      if (ui.sel === 'F') G.highlight(ctx, FUN.x - FUN.topR, FUN.top - 10, FUN.topR * 2, FUN.coneH + 20, 'sel', time);
      else if (ui.targets && ui.targets.includes('F')) G.highlight(ctx, FUN.x - FUN.topR, FUN.top - 10, FUN.topR * 2, FUN.coneH + 20, 'target', time);
      if (!rec) placeHint('filter', ui, 'unter den Trichter');
    }

    function placeHint(place, ui, txt) {
      const p = placePos(place);
      const w = 96, h = 100;
      ctx.save();
      ctx.setLineDash([6, 5]); ctx.strokeStyle = ui.targets && ui.targets.includes('place:' + place) ? 'rgba(31,111,229,0.9)' : 'rgba(110,130,150,0.45)'; ctx.lineWidth = 1.8;
      G.rr(ctx, p.x - w / 2, p.base - h, w, h, 10); ctx.stroke();
      ctx.restore();
      G.text(ctx, txt, p.x, p.base - h / 2 + 4, { size: 12.5, color: '#6b7987', align: 'center', weight: 600 });
      view.addHot('place:' + place, p.x - w / 2, p.base - h, w, h, { kind: 'place' });
    }

    function drawHeater(e, ui) {
      const lv = e.state.heater.level;
      const x = ST.heater.x;
      ctx.save();
      G.rr(ctx, x - 70, HB, 140, 36, 6); ctx.fillStyle = '#e4e8ec'; ctx.fill(); ctx.strokeStyle = '#97a4b0'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#5a646d'; ctx.fillRect(x - 62, HB - 6, 124, 8);
      if (lv > 0) {
        const glow = ctx.createRadialGradient(x, HB - 2, 4, x, HB - 2, 72);
        glow.addColorStop(0, `rgba(255,${lv === 2 ? 70 : 140},40,${lv === 2 ? 0.75 : 0.45})`); glow.addColorStop(1, 'rgba(255,80,40,0)');
        ctx.fillStyle = glow; ctx.fillRect(x - 70, HB - 24, 140, 26);
      }
      ctx.beginPath(); ctx.arc(x - 46, HB + 18, 10, 0, Math.PI * 2); ctx.fillStyle = '#39434c'; ctx.fill();
      ctx.save(); ctx.translate(x - 46, HB + 18); ctx.rotate(-2.2 + lv * 1.6); ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -9, 3, 7); ctx.restore();
      G.rr(ctx, x - 26, HB + 8, 88, 20, 4); ctx.fillStyle = '#1f2a33'; ctx.fill();
      G.text(ctx, ['AUS', 'NIEDRIG', 'HOCH'][lv], x + 18, HB + 23, { size: 12, color: lv ? '#ffb27a' : '#7d8b97', align: 'center', weight: 800, font: 'ui-monospace, Consolas, monospace' });
      ctx.restore();
      G.label(ctx, 'Heizplatte', x, BENCH + 24, { size: 14 });
      view.addHot('heater', x - 70, HB, 140, 40, { kind: 'device' });
      if (!e.atPlace('heater')) placeHint('heater', ui, 'auf die Heizplatte');
    }

    function drawSepStation(e, ui) {
      const st = e.state;
      const s = st.sep;
      const x = SEP.x;
      // Stativ
      ctx.fillStyle = '#7b8792'; ctx.fillRect(x + 58, 170, 8, BENCH - 170);
      ctx.fillStyle = '#5e6a75'; ctx.fillRect(x + 24, BENCH - 8, 64, 10);
      const ringY = SEP.bottom - 186; // Stativring unter der Schulter des Trichters
      ctx.fillStyle = '#7b8792'; ctx.fillRect(x + 40, ringY - 3, 20, 6);
      ctx.strokeStyle = '#7b8792'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, ringY, 54, 8, 0, Math.PI, Math.PI * 2); ctx.stroke();
      const g = GEOM.sep;
      const bottom = SEP.bottom;
      const outline = () => {
        ctx.beginPath();
        for (let h = 0; h <= g.inner; h += 3) ctx.lineTo(x - g.r(h) - 2, bottom - h);
        for (let h = g.inner; h >= 0; h -= 3) ctx.lineTo(x + g.r(h) + 2, bottom - h);
        ctx.closePath();
      };
      outline(); ctx.fillStyle = C.glassFill; ctx.fill();
      ctx.save(); outline(); ctx.clip();
      drawContents(s.c, 'sep', x, bottom, 77, {});
      ctx.restore();
      outline(); G.glass(ctx, 2.4);
      ctx.strokeStyle = '#7b8792'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, ringY, 54, 8, 0, 0, Math.PI); ctx.stroke();
      // Stopfen
      ctx.fillStyle = '#d9dee3'; G.rr(ctx, x - 13, bottom - g.inner - 14, 26, 16, 4); ctx.fill(); ctx.strokeStyle = '#9aa6b1'; ctx.stroke();
      // Auslauf und Hahn
      ctx.strokeStyle = 'rgba(95,120,140,0.85)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, SEP.stemEnd); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,240,248,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.save(); ctx.translate(x, SEP.cock);
      ctx.fillStyle = '#e3e7eb'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#7f8b96'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.rotate(s.cock === 0 ? 0 : s.cock < 1 ? -Math.PI / 4 : -Math.PI / 2);
      ctx.fillStyle = s.cock ? '#1f6fe5' : '#5d6873'; G.rr(ctx, -24, -4, 48, 8, 3); ctx.fill();
      ctx.restore();
      G.label(ctx, s.cock === 0 ? 'Hahn zu' : s.cock < 1 ? 'Hahn: Spalt' : 'Hahn offen', x - 74, SEP.cock, { size: 13, bg: s.cock ? 'rgba(225,236,252,0.95)' : undefined });
      // Ablaufender Strahl
      const L = s.c.water + s.c.oil;
      if (s.cock > 0 && L > 0.05) {
        const rec = e.sepReceiver();
        const endY = rec ? BENCH - GEOM[rec.type].h + 20 : BENCH - 4;
        const fw = s.c.water - s.c.emW;
        const col = fw > 0.2 ? liquidColor(Object.assign({}, s.c, { oil: 0 })) : s.c.emW > 0.2 ? C.emul : C.oil;
        ctx.strokeStyle = G.rgba(col, 0.85); ctx.lineWidth = s.cock < 1 ? 1.8 : 3.5;
        ctx.beginPath(); ctx.moveTo(x, SEP.stemEnd); ctx.lineTo(x, endY); ctx.stroke();
      }
      G.label(ctx, 'Scheidetrichter', x, SEP.top - 24, { size: 13.5 });
      view.addHot('S', x - 66, SEP.top - 36, 132, SEP.stemEnd - SEP.top + 36, { kind: 'device' });
      if (ui.sel === 'S') G.highlight(ctx, x - 64, SEP.top - 6, 128, SEP.stemEnd - SEP.top + 6, 'sel', time);
      else if (ui.targets && ui.targets.includes('S')) G.highlight(ctx, x - 64, SEP.top - 6, 128, SEP.stemEnd - SEP.top + 6, 'target', time);
      if (!e.sepReceiver()) placeHint('sep', ui, 'unter den Hahn');
    }

    function drawBenchSlots(e, ui) {
      for (const p of Object.keys(SLOT_X)) {
        if (e.atPlace(p)) continue;
        if (ui.targets && ui.targets.includes('place:bench')) {
          const x = SLOT_X[p];
          ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(31,111,229,0.7)'; ctx.lineWidth = 1.6; G.rr(ctx, x - 50, BENCH - 90, 100, 90, 10); ctx.stroke(); ctx.restore();
          view.addHot('slot:' + p, x - 50, BENCH - 90, 100, 90, { kind: 'place' });
        }
      }
    }

    // ------------------------------------------------- Handlungen mit Werkzeug
    function drawToolOps(e) {
      const op = e.state.op;
      if (!op) return;
      const p = clamp(op.t / op.dur, 0, 1);
      const up = Math.sin(Math.PI * p);
      if (op.type === 'water') {
        const m = targetMouth(e, op.target);
        const from = op.hot ? { x: TOOLS.kettle, y: SHELF.y } : { x: TOOLS.bottle, y: SHELF.y };
        const k = G.ease(clamp(p / 0.25, 0, 1)) * (1 - G.ease(clamp((p - 0.85) / 0.15, 0, 1)));
        const x = lerp(from.x, m.x - 60, k), y = lerp(from.y, m.y - 30, k);
        if (op.hot) drawKettle(x, y, 0.6 * k); else drawWashBottle(x, y, 0.5 * k);
        if (p > 0.25 && p < 0.85) {
          ctx.strokeStyle = op.hot ? 'rgba(200,225,245,0.85)' : 'rgba(170,210,240,0.9)'; ctx.lineWidth = 3;
          const sx = op.hot ? x + 56 * Math.cos(0.6 * k) : x + 30, sy = op.hot ? y - 70 : y - 110;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(m.x - 10, sy - 10, m.x, m.y + 10); ctx.stroke();
          if (op.hot) drawSteam(m.x, m.y, 0.6, 3);
        }
      } else if (op.type === 'stir') {
        const m = targetMouth(e, op.target);
        const v = e.container(op.target);
        const depth = v.type === 'funnel' ? 60 : (GEOM[v.type] ? GEOM[v.type].h : 100) - 10;
        const dx = Math.sin(time * 9) * 20;
        ctx.save(); ctx.strokeStyle = 'rgba(120,150,170,0.95)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x + dx * 0.4 + 10, m.y - 90); ctx.lineTo(m.x + dx, m.y + depth); ctx.stroke(); ctx.restore();
      } else if (op.type === 'magnet' || op.type === 'release') {
        const m = targetMouth(e, op.target);
        const v = e.container(op.target);
        const depth = op.type === 'magnet' ? (v.type === 'funnel' ? 70 : GEOM[v.type] ? GEOM[v.type].h - 14 : 60) : -10;
        const x = lerp(TOOLS.magnet, m.x, Math.min(1, p * 3)), y = lerp(SHELF.y - 12, m.y + depth * up, Math.min(1, p * 3));
        drawMagnet(x + Math.sin(time * 6) * (op.type === 'magnet' ? 10 * up : 0), y, op.type === 'release' ? e.state.magnet.iron * (1 - p) : e.state.magnet.iron + (p > 0.6 ? 0.5 : 0), 0);
        if (op.type === 'release' && p > 0.3) {
          ctx.fillStyle = 'rgba(55,56,60,0.9)';
          const rnd = G.rng(3);
          for (let i = 0; i < 30; i++) { const f = (rnd() + time * 2) % 1; ctx.fillRect(m.x + (rnd() - 0.5) * 30, lerp(y + 10, m.y + 10, f), 2.4, 1.2); }
        }
      } else if (op.type === 'scrape') {
        const a = op.from === 'F' ? { x: FUN.x, y: FUN.top + 40 } : targetMouth(e, 'T');
        const b = targetMouth(e, op.to);
        const k = G.ease(p);
        const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y - 20, k) - Math.sin(Math.PI * k) * 80;
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = 'rgba(250,250,245,0.95)'; ctx.beginPath(); ctx.moveTo(-26, -20); ctx.lineTo(0, 22); ctx.lineTo(26, -20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(190,160,110,0.9)'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, 18); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // ------------------------------------------------- Hauptzeichnung
    function frame(dt, e, ui) {
      time += dt;
      view.begin('#dfe6ec');
      G.background(view, BENCH, 'classic');
      const st = e.state;
      drawShelf(e, ui);
      if (st.funnel) drawFunnelStation(e, ui);
      if (st.heater) drawHeater(e, ui);
      if (st.sep) drawSepStation(e, ui);
      drawBenchSlots(e, ui);
      // Gefäße: bewegte zuletzt
      const order = st.vessels.slice().sort((a, b) => ((st.op && (st.op.from === a.id || st.op.id === a.id)) ? 1 : 0) - ((st.op && (st.op.from === b.id || st.op.id === b.id)) ? 1 : 0));
      for (const v of order) drawVessel(e, v, ui);
      // Teesieb auf einem Gefäß
      if (st.sieve && st.sieve.on) {
        const v = e.vessel(st.sieve.on);
        const pose = vesselPose(e, v);
        const y = pose.base - GEOM[v.type].h - 2;
        drawSieve(pose.x, y, st.sieve.c);
        view.addHot('T', pose.x - 50, y - 12, 100, 40, { kind: 'device' });
        if (ui.sel === 'T') G.highlight(ctx, pose.x - 48, y - 8, 96, 50, 'sel', time);
        else if (ui.targets && ui.targets.includes('T')) G.highlight(ctx, pose.x - 48, y - 8, 96, 50, 'target', time);
      }
      drawToolOps(e);
      G.clock(ctx, W - 14, 24, st.time, ui.speed);
      // Hinweis bei laufendem Nachgießen
      if (st.op && st.op.type === 'pour' && st.op.waiting) G.label(ctx, 'Der Trichter ist voll – es wird portionsweise nachgegossen …', FUN.x, FUN.top - 60, { size: 12, bg: 'rgba(255,243,226,0.96)', color: '#8a4b00' });
    }

    return { view, resize: view.resize, frame, toLogical: view.toLogical, hit: (x, y) => view.hit(x, y), hotspots: view.hotspots, heightFor, GEOM, W, H };
  }

  TL.renderClassic = { createRenderer, heightFor, GEOM };
})(typeof self !== 'undefined' ? self : this);
