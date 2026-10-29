/*
 * Pufferfish – Teilchenmodell (Canvas 2D), eine schematische Ansicht je Probe
 *
 * Vereinfachte Darstellung für die Versuche 1 und 2: Jedes Teilchen ist eine
 * beschriftete Plakette mit der Formel (Farbe und Beschriftung nennen Rolle und
 * Teilchen – keine Molekülzeichnung). Die Anzahl folgt dem Gleichgewicht des
 * Modells (1 Symbol ≙ SCALE mmol Puffer-Teilchen); alle Teilchen bewegen sich
 * (dynamisches Gleichgewicht). Freie H₃O⁺/OH⁻ sind stark vergrößert
 * hervorgehoben; ihre Anzahl wächst logarithmisch mit dem Abstand von pH 7 und
 * ist nicht maßstäblich. Na⁺/Cl⁻ sind ausgeblendet, Wasser ist der Hintergrund.
 * Der pH-Wert wird nie aus Symbolen gezählt; der Bestand folgt dem Modell.
 * Umwandlungen (z. B. HPO₄²⁻ → H₂PO₄⁻ bei Säurezugabe) werden kurz umrandet.
 */
(function (root) {
  'use strict';
  const C = root.PF.chem;
  const SCALE = 0.2; // mmol je Symbol
  const FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /** Rollen: Säureform (violett), Basenform (türkis), freie Ionen (orange/lila). */
  const SPECIES = {
    HA: { label: 'CH₃COOH', name: 'Essigsäure (Säure HA)', role: 'Säure', color: '#5f3dc4' },
    A: { label: 'CH₃COO⁻', name: 'Acetat (Base A⁻)', role: 'Base', color: '#0b7285' },
    H3PO4: { label: 'H₃PO₄', name: 'Phosphorsäure', role: 'Säure', color: '#862e9c' },
    H2PO4: { label: 'H₂PO₄⁻', name: 'Dihydrogenphosphat (Säure HA)', role: 'Säure', color: '#5f3dc4' },
    HPO4: { label: 'HPO₄²⁻', name: 'Hydrogenphosphat (Base A⁻)', role: 'Base', color: '#0b7285' },
    PO4: { label: 'PO₄³⁻', name: 'Phosphat', role: 'Base', color: '#1971c2' },
    H3O: { label: 'H₃O⁺', name: 'Oxonium-Ion (frei)', role: 'frei', color: '#e8590c' },
    OH: { label: 'OH⁻', name: 'Hydroxid-Ion (frei)', role: 'frei', color: '#9c36b5' }
  };
  const P_KEYS = ['H3PO4', 'H2PO4', 'HPO4', 'PO4'];

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

  /** Welche Spezies kommen in einer Zusammensetzung vor (für die Legende)? */
  function speciesOf(comp) {
    const keys = [];
    if (comp.Ac > 0) keys.push('HA', 'A');
    if (comp.P > 0) keys.push('H2PO4', 'HPO4');
    keys.push('H3O', 'OH');
    return keys;
  }

  // ------------------------------------------------------------ Ansicht je Probe
  class ParticleView {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.parts = []; this.key = null; this.w = 0; this.h = 0; this.dpr = 1;
      this.reduceMotion = false;
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      if (r.width === this.w && r.height === this.h && dpr === this.dpr) return;
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
      this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
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
      this.parts.push({ sp, x: 0.08 + Math.random() * 0.84, y: 0.12 + Math.random() * 0.76, vx: Math.cos(a) * 0.05, vy: Math.sin(a) * 0.05, flash: 0, appear: fade ? 0 : 1, leaving: 0 });
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
        if (p.x < 0.1) { p.x = 0.1; p.vx = Math.abs(p.vx); } if (p.x > 0.9) { p.x = 0.9; p.vx = -Math.abs(p.vx); }
        if (p.y < 0.12) { p.y = 0.12; p.vy = Math.abs(p.vy); } if (p.y > 0.88) { p.y = 0.88; p.vy = -Math.abs(p.vy); }
      }
      this.parts = this.parts.filter((p) => !p.leaving || p.leaving < 1);
      this.separate();
    }

    /** Plaketten überlappen möglichst nicht (weiche Trennung, solange Platz ist). */
    separate() {
      const P = this.parts, W = this.w, H = this.h;
      if (P.length < 2 || P.length > 60) return;
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        if (!a.pw) continue;
        for (let j = i + 1; j < P.length; j++) {
          const b = P[j];
          if (!b.pw) continue;
          const dx = (b.x - a.x) * W, dy = (b.y - a.y) * H;
          const ox = (a.pw + b.pw) / 2 * 0.94 - Math.abs(dx), oy = (a.ph + b.ph) / 2 * 0.98 - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          if (oy < ox) { const m = (oy / 2) / H * (dy >= 0 ? 1 : -1); a.y -= m; b.y += m; }
          else { const m = (ox / 2) / W * (dx >= 0 ? 1 : -1); a.x -= m; b.x += m; }
        }
      }
      for (const p of P) { p.x = clamp(p.x, 0.1, 0.9); p.y = clamp(p.y, 0.12, 0.88); }
    }

    frame(dt, opts) {
      this.resize();
      this.reduceMotion = !!opts.reduceMotion;
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      this.step(this.reduceMotion ? 0 : dt, opts.real);
      this.draw(ctx);
    }

    draw(ctx) {
      const W = this.w, H = this.h;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#eef7fc'); bg.addColorStop(1, '#dcecf6');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // Wasser als Hintergrund: dezentes Muster
      ctx.fillStyle = 'rgba(80,140,190,0.10)';
      for (let i = 0; i < 30; i++) { const x = (i * 53) % W, y = (i * 37) % H; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.283); ctx.fill(); }
      const n = Math.max(1, this.parts.length);
      const ph = clamp(Math.sqrt((W * H) / (n + 14)) * 0.6, 17, 26); // Höhe einer Plakette
      const fs = ph * 0.56;
      ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of this.parts) {
        const S = SPECIES[p.sp];
        const free = p.sp === 'H3O' || p.sp === 'OH';
        const tw = ctx.measureText(S.label).width;
        const w = tw + ph * (free ? 0.9 : 0.8), h = free ? ph * 1.12 : ph;
        const x = p.x * W, y = p.y * H;
        p.pw = w; p.ph = h;
        ctx.save();
        ctx.globalAlpha = (p.appear == null ? 1 : p.appear) * (p.leaving ? Math.max(0, 1 - p.leaving) : 1);
        if (p.flash > 0) { ctx.strokeStyle = `rgba(232,89,12,${p.flash})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, w * 0.75, h * 1.1, 0, 0, 6.283); ctx.stroke(); }
        if (free) { const g = ctx.createRadialGradient(x, y, h * 0.3, x, y, w * 0.9); g.addColorStop(0, p.sp === 'H3O' ? 'rgba(250,200,40,0.55)' : 'rgba(150,100,230,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, w * 0.9, 0, 6.283); ctx.fill(); }
        ctx.fillStyle = S.color;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2) : ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
        if (S.role === 'Säure') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = '#fff';
        ctx.fillText(S.label, x, y + 0.5);
        ctx.restore();
      }
      if (!this.parts.length) {
        ctx.fillStyle = 'rgba(23,33,44,0.65)'; ctx.font = `500 ${clamp(H * 0.075, 12, 14)}px ${FONT}`;
        ctx.fillText('nur Wasser (Hintergrund)', W / 2, H / 2 - 9);
        ctx.fillText('kaum freie H₃O⁺ oder OH⁻', W / 2, H / 2 + 9);
      }
    }
  }

  /** Legendeneintrag als HTML (Farbe + Form + Beschriftung, nicht nur Farbe). */
  function legendHtml(keys) {
    return keys.map((k) => {
      const S = SPECIES[k];
      return `<span class="sym"><span class="chip ${S.role === 'Säure' ? 'dash' : ''}" style="background:${S.color}">${S.label}</span><span class="symname">${S.name}${S.role === 'Säure' || S.role === 'Base' ? '' : ''}</span></span>`;
    }).join('');
  }

  (root.PF = root.PF || {}).particles = { ParticleView, targetCounts, speciesOf, legendHtml, SPECIES, SCALE, P_KEYS };
})(typeof self !== 'undefined' ? self : this);
