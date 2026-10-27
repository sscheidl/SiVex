/*
 * Pufferfish – Teilchenebene (Canvas 2D)
 *
 * Zwei Bereiche je Probe:
 *  1. Bestand: repräsentative Symbole der Puffer-Teilchen, Anzahl aus dem
 *     Gleichgewicht des Modells (1 Symbol ≙ SCALE mmol). Alle Teilchen bewegen
 *     sich (dynamisches Gleichgewicht). Freie H₃O⁺/OH⁻ sind stark vergrößert
 *     hervorgehoben; ihre Anzahl wächst logarithmisch mit dem Abstand von pH 7
 *     und ist nicht maßstäblich. Na⁺/Cl⁻ sind ausgeblendet, Wasser ist Hintergrund.
 *  2. Zeitlupe (schematisch): Für jede Zugabe eine langsam beobachtbare Folge
 *     Zugabe trifft ein → Annäherung → Protonenübertragung → Produkte trennen
 *     sich → Bestand aktualisiert. Der Reaktionsweg stammt aus chem.doseAnalysis.
 * Der pH-Wert wird nie aus Symbolen gezählt; der Bestand folgt dem Modell.
 */
(function (root) {
  'use strict';
  const C = root.PF.chem;
  const SCALE = 0.125; // mmol je Symbol
  const FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const COL = { C: '#495057', Cm: '#868e96', O: '#e03131', H: '#ffffff', P: '#f08c00', Hstroke: '#868e96' };
  const P_NAMES = ['H₃PO₄', 'H₂PO₄⁻', 'HPO₄²⁻', 'PO₄³⁻'];
  const P_KEYS = ['H3PO4', 'H2PO4', 'HPO4', 'PO4'];

  // ------------------------------------------------------------ Symbole
  function atom(ctx, x, y, r, fill, stroke) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, fill); g.addColorStop(1, fill);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = stroke || 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(0.6, r * 0.12); ctx.stroke();
  }
  function bond(ctx, x1, y1, x2, y2, s) { ctx.strokeStyle = '#6c757d'; ctx.lineWidth = Math.max(1, s * 0.16); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function badge(ctx, x, y, s, text, color) {
    ctx.font = `700 ${Math.max(9, s * 0.95)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.max(s * 0.95, ctx.measureText(text).width + s * 0.4);
    ctx.fillStyle = color || '#1864ab'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, s * 0.52, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 0.5);
  }
  function halo(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  }

  /** Acetat-Grundgerüst; mit protonated: CH₃COOH. hidePos: H gerade „unterwegs“. */
  function acetate(ctx, x, y, s, protonated, opt) {
    const o = opt || {};
    const c1 = [x - 0.95 * s, y], c2 = [x, y], o1 = [x + 0.72 * s, y - 0.62 * s], o2 = [x + 0.72 * s, y + 0.62 * s], h = [x + 1.35 * s, y - 1.0 * s];
    bond(ctx, ...c1, ...c2, s); bond(ctx, ...c2, ...o1, s); bond(ctx, ...c2, ...o2, s);
    atom(ctx, ...c1, 0.52 * s, COL.Cm); atom(ctx, ...c2, 0.5 * s, COL.C);
    atom(ctx, ...o1, 0.46 * s, COL.O); atom(ctx, ...o2, 0.46 * s, COL.O);
    if (protonated && !o.noH) { bond(ctx, ...o1, ...h, s); atom(ctx, ...h, 0.3 * s, COL.H, COL.Hstroke); }
    if (!protonated && !o.noBadge) badge(ctx, x + 1.45 * s, y + 0.95 * s, s * 0.7, '−');
    return { hx: h[0], hy: h[1] };
  }
  /** Phosphat mit nH gebundenen Protonen; Ladung 3 − nH. */
  function phosphate(ctx, x, y, s, nH, opt) {
    const o = opt || {};
    const pos = [[-0.78, -0.62], [0.78, -0.62], [0.78, 0.66], [-0.78, 0.66]];
    const hp = [[-1.35, -1.12], [1.35, -1.12], [1.38, 1.15], [-1.38, 1.15]];
    for (const p of pos) bond(ctx, x, y, x + p[0] * s, y + p[1] * s, s);
    atom(ctx, x, y, 0.58 * s, COL.P);
    pos.forEach((p) => atom(ctx, x + p[0] * s, y + p[1] * s, 0.42 * s, COL.O));
    const shown = o.noH ? nH - 1 : nH;
    for (let i = 0; i < shown; i++) { bond(ctx, x + pos[i][0] * s, y + pos[i][1] * s, x + hp[i][0] * s, y + hp[i][1] * s, s); atom(ctx, x + hp[i][0] * s, y + hp[i][1] * s, 0.28 * s, COL.H, COL.Hstroke); }
    const q = 3 - nH;
    if (q > 0 && !o.noBadge) badge(ctx, x, y + 1.55 * s, s * 0.66, q === 1 ? '−' : q + '−');
    const i = Math.max(0, nH - 1);
    return { hx: x + hp[i][0] * s, hy: y + hp[i][1] * s };
  }
  function hydronium(ctx, x, y, s, opt) {
    const o = opt || {};
    if (!o.noHalo) halo(ctx, x, y, s * 1.7, 'rgba(250,200,40,0.55)');
    const hs = [[-0.75, -0.55], [0.75, -0.55], [0, 0.85]];
    const n = o.noH ? 2 : 3;
    for (let i = 0; i < n; i++) bond(ctx, x, y, x + hs[i][0] * s, y + hs[i][1] * s, s);
    atom(ctx, x, y, 0.52 * s, COL.O);
    for (let i = 0; i < n; i++) atom(ctx, x + hs[i][0] * s, y + hs[i][1] * s, 0.3 * s, COL.H, COL.Hstroke);
    if (!o.noBadge) badge(ctx, x + 0.95 * s, y - 0.95 * s, s * 0.62, '+', '#c92a2a');
    return { hx: x + hs[2][0] * s, hy: y + hs[2][1] * s };
  }
  function hydroxide(ctx, x, y, s, opt) {
    const o = opt || {};
    if (!o.noHalo) halo(ctx, x, y, s * 1.6, 'rgba(150,100,230,0.45)');
    bond(ctx, x, y, x - 0.75 * s, y - 0.5 * s, s);
    atom(ctx, x, y, 0.52 * s, COL.O); atom(ctx, x - 0.75 * s, y - 0.5 * s, 0.3 * s, COL.H, COL.Hstroke);
    if (!o.noBadge) badge(ctx, x + 0.9 * s, y + 0.8 * s, s * 0.62, '−');
    return { ax: x + 0.75 * s, ay: y - 0.5 * s };
  }
  function water(ctx, x, y, s, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    bond(ctx, x, y, x - 0.72 * s, y + 0.55 * s, s); bond(ctx, x, y, x + 0.72 * s, y + 0.55 * s, s);
    atom(ctx, x, y, 0.5 * s, COL.O); atom(ctx, x - 0.72 * s, y + 0.55 * s, 0.3 * s, COL.H, COL.Hstroke); atom(ctx, x + 0.72 * s, y + 0.55 * s, 0.3 * s, COL.H, COL.Hstroke);
    ctx.restore();
  }
  function proton(ctx, x, y, s) {
    halo(ctx, x, y, s * 1.2, 'rgba(255,230,80,0.85)');
    atom(ctx, x, y, 0.32 * s, COL.H, '#e8590c');
    ctx.font = `700 ${Math.max(8, s * 0.55)}px ${FONT}`; ctx.fillStyle = '#e8590c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H⁺', x, y - s * 0.75);
  }

  /** Symbol einer Spezies zeichnen (für Bestand und Legende). */
  function drawSpecies(ctx, sp, x, y, s) {
    if (sp === 'HA') acetate(ctx, x, y, s, true);
    else if (sp === 'A') acetate(ctx, x, y, s, false);
    else if (sp === 'H3O') hydronium(ctx, x, y, s);
    else if (sp === 'OH') hydroxide(ctx, x, y, s);
    else { const k = P_KEYS.indexOf(sp); if (k >= 0) phosphate(ctx, x, y, s, 3 - k); }
  }

  // ------------------------------------------------------------ Zielbestand
  /** Symbolzahlen je Spezies aus einer Zusammensetzung (größte Reste). */
  function targetCounts(comp) {
    const r = C.solve(comp);
    const out = {};
    const alloc = (keys, amounts, total) => {
      const N = Math.round(total / SCALE);
      const raw = amounts.map((a) => (total > 0 ? (a / total) * N : 0));
      const base = raw.map(Math.floor);
      let rest = N - base.reduce((a, b) => a + b, 0);
      raw.map((v, i) => [v - base[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { base[i]++; rest--; } });
      keys.forEach((k, i) => { out[k] = base[i]; });
    };
    if (comp.Ac > 0) alloc(['HA', 'A'], [r.HA, r.A], comp.Ac);
    if (comp.P > 0) alloc(P_KEYS, P_KEYS.map((k) => r[k]), comp.P);
    out.H3O = clamp(Math.round((7 - r.pH) * 1.5), 0, 12);
    out.OH = clamp(Math.round((r.pH - 7) * 1.5), 0, 12);
    return { counts: out, pH: r.pH, r };
  }

  // ------------------------------------------------------------ Ansicht je Probe
  class ParticleView {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.parts = []; this.key = null; this.w = 0; this.h = 0; this.dpr = 1;
      this.reduceMotion = false; this.locked = false; this.lastEvent = null;
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      if (r.width === this.w && r.height === this.h && dpr === this.dpr) return;
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
      this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    }
    regions() {
      const w = this.w, h = this.h;
      if (w / h > 1.75) { const pw = Math.round(w * 0.56); return { pop: { x: 0, y: 0, w: pw, h }, ev: { x: pw, y: 0, w: w - pw, h } }; }
      const ph = Math.round(h * 0.55); return { pop: { x: 0, y: 0, w, h: ph }, ev: { x: 0, y: ph, w, h: h - ph } };
    }

    /** Bestand an den Zielbestand anpassen: Umwandlungen werden kurz hervorgehoben. */
    sync(counts, sampleKey) {
      if (sampleKey !== this.key) { this.parts = []; this.key = sampleKey; }
      const have = {};
      for (const p of this.parts) if (!p.leaving) have[p.sp] = (have[p.sp] || 0) + 1;
      const diff = {};
      for (const k of Object.keys(counts)) diff[k] = counts[k] - (have[k] || 0);
      for (const k of Object.keys(have)) if (!(k in diff)) diff[k] = -have[k];
      // Puffer-Teilchen: Überschuss in fehlende Spezies umwandeln (gleiches Grundgerüst)
      const buffer = ['HA', 'A', ...P_KEYS];
      const surplus = [], deficit = [];
      for (const k of buffer) { if (diff[k] < 0) for (let i = 0; i < -diff[k]; i++) surplus.push(k); if (diff[k] > 0) for (let i = 0; i < diff[k]; i++) deficit.push(k); }
      while (surplus.length && deficit.length) {
        const from = surplus.shift(), to = deficit.shift();
        const p = this.parts.find((q) => q.sp === from && !q.leaving);
        if (p) { p.sp = to; p.flash = 1; }
      }
      for (const k of surplus) { const p = this.parts.find((q) => q.sp === k && !q.leaving); if (p) p.leaving = 1; }
      for (const k of deficit) this.spawn(k, false);
      // freie H₃O⁺/OH⁻: ein- bzw. ausblenden
      for (const k of ['H3O', 'OH']) {
        const d = diff[k] || 0;
        for (let i = 0; i < d; i++) this.spawn(k, true);
        for (let i = 0; i < -d; i++) { const p = this.parts.find((q) => q.sp === k && !q.leaving); if (p) p.leaving = 1; }
      }
    }
    spawn(sp, fade) {
      const a = Math.random() * 6.283;
      this.parts.push({ sp, x: 0.08 + Math.random() * 0.84, y: 0.1 + Math.random() * 0.8, vx: Math.cos(a) * 0.05, vy: Math.sin(a) * 0.05, flash: fade ? 0 : 0, appear: fade ? 0 : 1, leaving: 0 });
    }

    step(dt, real) {
      const f = real == null ? dt : real; // Ein-/Ausblenden in Echtzeit (nur Optik)
      for (const p of this.parts) {
        p.flash = Math.max(0, (p.flash || 0) - f * 0.9);
        p.appear = Math.min(1, (p.appear == null ? 1 : p.appear) + f * 1.5);
        if (p.leaving) p.leaving += f * 1.5;
        if (dt <= 0) continue;
        p.vx += (Math.random() - 0.5) * dt * 0.5; p.vy += (Math.random() - 0.5) * dt * 0.5;
        const sp = Math.hypot(p.vx, p.vy), max = p.sp === 'H3O' || p.sp === 'OH' ? 0.11 : 0.06;
        if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0.06) { p.x = 0.06; p.vx = Math.abs(p.vx); } if (p.x > 0.94) { p.x = 0.94; p.vx = -Math.abs(p.vx); }
        if (p.y < 0.1) { p.y = 0.1; p.vy = Math.abs(p.vy); } if (p.y > 0.9) { p.y = 0.9; p.vy = -Math.abs(p.vy); }
      }
      this.parts = this.parts.filter((p) => !p.leaving || p.leaving < 1);
    }

    frame(dt, beaker, engTime, opts) {
      this.resize();
      this.reduceMotion = !!opts.reduceMotion;
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.locked) return;
      this.step(this.reduceMotion ? 0 : dt, opts.real);
      const R = this.regions();
      this.drawPopulation(ctx, R.pop);
      this.drawEvent(ctx, R.ev, beaker, engTime, opts);
    }

    drawPopulation(ctx, r) {
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      const bg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      bg.addColorStop(0, '#eef7fc'); bg.addColorStop(1, '#dcecf6');
      ctx.fillStyle = bg; ctx.fillRect(r.x, r.y, r.w, r.h);
      // Wasser als Hintergrund: dezentes Muster
      ctx.fillStyle = 'rgba(80,140,190,0.10)';
      for (let i = 0; i < 26; i++) { const x = r.x + ((i * 53) % r.w), y = r.y + ((i * 37) % r.h); ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.283); ctx.fill(); }
      const n = Math.max(1, this.parts.length);
      const s = clamp(Math.sqrt((r.w * r.h) / (n + 6)) * 0.2, 4.5, 11);
      for (const p of this.parts) {
        const x = r.x + p.x * r.w, y = r.y + p.y * r.h;
        ctx.save();
        ctx.globalAlpha = (p.appear == null ? 1 : p.appear) * (p.leaving ? Math.max(0, 1 - p.leaving) : 1);
        if (p.flash > 0) { ctx.strokeStyle = `rgba(232,89,12,${p.flash})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s * 2.2, 0, 6.283); ctx.stroke(); }
        drawSpecies(ctx, p.sp, x, y, s);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(23,33,44,0.6)'; ctx.font = `600 10.5px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('Bestand (Modell)', r.x + 5, r.y + 3);
      if (!this.parts.length) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `500 11.5px ${FONT}`;
        ctx.fillText('nur Wasser (Hintergrund)', r.x + r.w / 2, r.y + r.h / 2 - 8);
        ctx.fillText('kaum freie H₃O⁺ oder OH⁻', r.x + r.w / 2, r.y + r.h / 2 + 8);
      }
      ctx.restore();
    }

    drawEvent(ctx, r, beaker, engTime, opts) {
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      ctx.fillStyle = '#fbfcfe'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(11,114,133,0.55)'; ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 3.5, r.y + 3.5, r.w - 7, r.h - 7); ctx.setLineDash([]);
      ctx.fillStyle = '#0b7285'; ctx.font = `700 10.5px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const narrow = r.w < 250;
      ctx.fillText(narrow ? 'Zeitlupe (schemat.)' : 'Zeitlupe · schematisch', r.x + 8, r.y + 6);
      this.narrow = narrow;
      const ev = beaker.event;
      // drei Bänder: Kopf (Phase), Mitte (Teilchen), Fuß (Gleichung + Hinweis)
      const head = narrow ? 32 : 20, foot = 30, band = Math.max(20, r.h - head - foot);
      const s = clamp(Math.min(band / 3.4, r.w / 10), 5, 15);
      const cy = r.y + head + band / 2 + s * 0.2;
      const capY = r.y + r.h - 6;
      ctx.textBaseline = 'alphabetic';
      if (!ev || !opts.showEvents) {
        ctx.fillStyle = 'rgba(23,33,44,0.55)'; ctx.font = `500 ${Math.max(10, s * 0.85)}px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(opts.showEvents ? 'wartet auf die nächste Zugabe' : 'Zeitlupe ausgeschaltet', r.x + r.w / 2, cy);
        ctx.restore(); return;
      }
      const t = clamp((engTime - ev.t0) / ev.dur, 0, 1);
      const an = ev.an, acid = ev.reagent === 'HCl';
      const ion = acid ? 'H₃O⁺' : 'OH⁻';
      const xL = r.x + r.w * 0.27, xR = r.x + r.w * 0.73;
      const phase = t < 0.15 ? 0 : t < 0.35 ? 1 : t < 0.62 ? 2 : t < 0.85 ? 3 : 4;
      const PH = ['Zugabe trifft ein', 'Teilchen nähern sich', 'Protonenübertragung', 'Produkte trennen sich', 'Bestand aktualisiert'];
      let eq = '', note = '';
      if (an.path === 'free') {
        // zugegebenes Ion bleibt frei
        const fall = ease(clamp(t / 0.2, 0, 1));
        const x = lerp(xL, r.x + r.w / 2, ease(clamp((t - 0.15) / 0.5, 0, 1)));
        const y = lerp(r.y + head + 2, cy, fall);
        if (acid) hydronium(ctx, x, y, s); else hydroxide(ctx, x, y, s);
        eq = `${ion} bleibt frei`;
        note = acid ? 'kein Protonenempfänger in nennenswerter Menge' : 'kein Protonenspender in nennenswerter Menge';
        drawCaption(ctx, r, capY, t < 0.15 ? PH[0] : 'kein Reaktionspartner', eq, note, s);
        ctx.restore(); return;
      }
      // Spender (gibt H⁺ ab) und Empfänger (nimmt H⁺ auf)
      let donor, acceptor, products;
      const P = an.pair;
      if (an.path === 'partner') {
        donor = { kind: 'H3O' }; acceptor = { kind: 'OH' };
        eq = 'H₃O⁺ + OH⁻ → 2 H₂O'; products = ['H₂O', 'H₂O'];
      } else if (acid) {
        donor = { kind: 'H3O' };
        acceptor = P.sys === 'Ac' ? { kind: 'Ac', nH: 0 } : { kind: 'P', nH: 2 - P.k };
        const bn = P.sys === 'Ac' ? 'CH₃COO⁻' : P_NAMES[P.k + 1], an2 = P.sys === 'Ac' ? 'CH₃COOH' : P_NAMES[P.k];
        eq = `H₃O⁺ + ${bn} → H₂O + ${an2}`;
      } else {
        donor = P.sys === 'Ac' ? { kind: 'Ac', nH: 1 } : { kind: 'P', nH: 3 - P.k };
        acceptor = { kind: 'OH' };
        const ac = P.sys === 'Ac' ? 'CH₃COOH' : P_NAMES[P.k], bs = P.sys === 'Ac' ? 'CH₃COO⁻' : P_NAMES[P.k + 1];
        eq = `${ac} + OH⁻ → ${bs} + H₂O`;
      }
      // zugegebenes Teilchen kommt von oben links, Partner wartet rechts
      const incomingIsDonor = acid;
      const enter = ease(clamp(t / 0.15, 0, 1));
      const near = ease(clamp((t - 0.15) / 0.2, 0, 1));
      const apart = ease(clamp((t - 0.62) / 0.23, 0, 1));
      const gap = r.w * 0.12;
      const mid = r.x + r.w / 2;
      let xd = lerp(xL, mid - gap, near), xa = lerp(xR, mid + gap, near);
      xd = lerp(xd, xL - r.w * 0.02, apart); xa = lerp(xa, xR + r.w * 0.02, apart);
      let yd = cy, ya = cy;
      if (incomingIsDonor) yd = lerp(r.y + head + 2, cy, enter); else ya = lerp(r.y + head + 2, cy, enter);
      const tr = clamp((t - 0.35) / 0.27, 0, 1); // Fortschritt der Übertragung
      const moved = tr >= 1;
      // Spender zeichnen (ohne H während/nach der Übertragung)
      let dpos;
      const dOpt = { noH: tr > 0, noBadge: false };
      if (donor.kind === 'H3O') {
        if (moved) water(ctx, xd, yd, s, 1 - 0.4 * apart);
        else dpos = hydronium(ctx, xd, yd, s, { noH: tr > 0, noHalo: false });
      } else if (donor.kind === 'Ac') { dpos = acetate(ctx, xd, yd, s, !moved, { noH: tr > 0 && !moved, noBadge: !moved }); }
      else { dpos = phosphate(ctx, xd, yd, s, moved ? donor.nH - 1 : donor.nH, { noH: tr > 0 && !moved }); }
      // Empfänger zeichnen
      let apos;
      if (acceptor.kind === 'OH') {
        if (moved) water(ctx, xa, ya, s, 1 - 0.4 * apart);
        else apos = hydroxide(ctx, xa, ya, s);
      } else if (acceptor.kind === 'Ac') { apos = acetate(ctx, xa, ya, s, moved); }
      else { apos = phosphate(ctx, xa, ya, s, moved ? acceptor.nH + 1 : acceptor.nH); }
      // Proton auf dem Weg (Bogen)
      if (tr > 0 && !moved) {
        const HP = [[-1.35, -1.12], [1.35, -1.12], [1.38, 1.15], [-1.38, 1.15]], OP = [[-0.78, -0.62], [0.78, -0.62], [0.78, 0.66], [-0.78, 0.66]];
        const sx = donor.kind === 'H3O' ? xd : donor.kind === 'Ac' ? xd + 1.35 * s : xd + HP[donor.nH - 1][0] * s;
        const sy = donor.kind === 'H3O' ? yd + 0.85 * s : donor.kind === 'Ac' ? yd - 1.0 * s : yd + HP[donor.nH - 1][1] * s;
        const ex = acceptor.kind === 'OH' ? xa - 0.75 * s : acceptor.kind === 'Ac' ? xa + 0.72 * s : xa + OP[acceptor.nH][0] * s;
        const ey = acceptor.kind === 'OH' ? ya - 0.5 * s : acceptor.kind === 'Ac' ? ya - 0.62 * s : ya + OP[acceptor.nH][1] * s;
        const u = ease(tr);
        const px = lerp(sx, ex, u), py = lerp(sy, ey, u) - Math.sin(u * Math.PI) * s * 1.6;
        proton(ctx, px, py, s);
      }
      if (phase === 2 && !moved) {
        ctx.strokeStyle = 'rgba(232,89,12,0.5)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xd, yd - s * 1.8); ctx.quadraticCurveTo(mid, yd - s * 3.2, xa, ya - s * 1.8); ctx.stroke(); ctx.setLineDash([]);
      }
      const share = an.path === 'weak' ? an.shares.weak : an.shares.partner;
      note = share > 0.95 ? `so reagieren fast alle zugegebenen ${ion}` : `so reagiert ein Teil (≈ ${Math.round(share * 100)} %), der Rest bleibt frei`;
      if (beaker.extra > 0) note += ` · +${beaker.extra} weitere Zugabe${beaker.extra > 1 ? 'n' : ''}`;
      drawCaption(ctx, r, capY, PH[phase], eq, note, s);
      ctx.restore();
    }
  }

  function drawCaption(ctx, r, y, phase, eq, note, s) {
    const fs = clamp(s * 0.95, 10.5, 13.5);
    const narrow = r.w < 250;
    ctx.textAlign = narrow ? 'left' : 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#e8590c'; ctx.font = `700 10.5px ${FONT}`;
    ctx.fillText(phase, narrow ? r.x + 8 : r.x + r.w - 8, r.y + (narrow ? 19 : 6));
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#17212c'; ctx.font = `700 ${fs}px ${FONT}`;
    fitText(ctx, eq, r.x + r.w / 2, y - 12, r.w - 12);
    ctx.fillStyle = 'rgba(23,33,44,0.65)'; ctx.font = `500 10px ${FONT}`;
    fitText(ctx, note, r.x + r.w / 2, y, r.w - 12);
  }
  function fitText(ctx, text, x, y, maxW) {
    const w = ctx.measureText(text).width;
    if (w <= maxW) { ctx.fillText(text, x, y); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(maxW / w, 1); ctx.fillText(text, 0, 0); ctx.restore();
  }

  /** kleines Legendensymbol */
  function legendIcon(canvas, sp) {
    const dpr = Math.min(2.5, root.devicePixelRatio || 1);
    canvas.width = 26 * dpr; canvas.height = 18 * dpr;
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSpecies(ctx, sp, sp === 'HA' || sp === 'A' ? 11 : 12, 9, 5);
  }

  (root.PF = root.PF || {}).particles = { ParticleView, targetCounts, legendIcon, SCALE, P_NAMES, P_KEYS };
})(typeof self !== 'undefined' ? self : this);
