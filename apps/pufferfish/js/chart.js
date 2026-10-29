/*
 * Pufferfish – pH-Zugabekurve (Canvas 2D)
 *
 * x: tatsächlich zugegebenes Volumen der gewählten Maßlösung (mL), y: pH.
 * Gezeichnet werden nur protokollierte (stabile) Messpunkte; Verbindungslinien
 * sind dünn, Messpunkte als Symbole. Nichts wird vorgezeichnet.
 * Achsenaufbau nach TitraLab 3 (titration/js/view/chart.js), vereinfacht.
 */
(function (root) {
  'use strict';
  const FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
  const fmt = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');
  const STYLE = [
    { color: '#1f6fd1', marker: 'circle', dash: [] },
    { color: '#d9480f', marker: 'square', dash: [7, 4] },
    { color: '#2b8a3e', marker: 'triangle', dash: [2, 3] }
  ];

  function niceStep(range, target) {
    const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function marker(ctx, kind, x, y, r, fill) {
    ctx.beginPath();
    if (kind === 'square') ctx.rect(x - r, y - r, 2 * r, 2 * r);
    else if (kind === 'triangle') { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.1, y + r * 0.8); ctx.lineTo(x - r * 1.1, y + r * 0.8); ctx.closePath(); }
    else ctx.arc(x, y, r, 0, 6.283);
    if (fill) ctx.fill(); ctx.stroke();
  }

  class Chart {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.w = 0; this.h = 0; }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      if (r.width === this.w && r.height === this.h && dpr === this.dpr) return false;
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
      this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
      return true;
    }
    /**
     * d: { curves: [{label, records, style}], compare: [{label, records}], xLabel, zoom, band: {pKa, label} | null,
     *      x: {min, max} (feste x-Achse, z. B. lg-Verhältnis), y: {min, max},
     *      guides: [{y, label, color}] (waagerechte Hilfslinien), lines: [{x0, y0, x1, y1, label, color}] }
     */
    draw(d) {
      this.resize();
      const ctx = this.ctx, W = this.w, H = this.h;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const all = d.curves.concat(d.compare).flatMap((c) => c.records);
      let xmin = 0, xmax = Math.max(0.25, ...all.map((p) => p.v));
      let xs = niceStep(xmax, 5); xmax = Math.ceil(xmax / xs - 1e-9) * xs;
      if (d.x) { xmin = d.x.min; xmax = d.x.max; xs = niceStep(xmax - xmin, 6); }
      let y0 = 0, y1 = 14;
      if (d.y) { y0 = d.y.min; y1 = d.y.max; }
      else if (d.zoom && all.length) {
        const ys = all.map((p) => p.pH).concat(d.band ? [d.band.pKa] : []);
        const lo = Math.min(...ys), hi = Math.max(...ys);
        const pad = Math.max(0.05, (hi - lo) * 0.12);
        const st = niceStep(Math.max(0.1, hi - lo + 2 * pad), 5);
        y0 = Math.floor((lo - pad) / st) * st; y1 = Math.ceil((hi + pad) / st) * st;
      }
      const ys = niceStep(y1 - y0, H < 200 ? 4 : 7);
      const L = 40, R = 10, T = 10, B = 32;
      const X = (v) => L + ((v - xmin) / (xmax - xmin)) * (W - L - R);
      const Y = (p) => T + (1 - (p - y0) / (y1 - y0)) * (H - T - B);
      this.map = { X, Y, xmin, xmax, y0, y1 };
      // Raster
      ctx.font = `500 11px ${FONT}`; ctx.fillStyle = '#5c6b7a'; ctx.strokeStyle = '#e3e9ef'; ctx.lineWidth = 1;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const yd = ys < 0.1 ? 2 : ys < 1 ? 1 : 0;
      for (let p = Math.ceil(y0 / ys) * ys; p <= y1 + 1e-9; p += ys) { ctx.beginPath(); ctx.moveTo(L, Y(p)); ctx.lineTo(W - R, Y(p)); ctx.stroke(); ctx.fillText(fmt(p, yd), L - 5, Y(p)); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const xd = xs < 0.1 ? 2 : xs < 1 ? 1 : 0;
      for (let v = Math.ceil(xmin / xs - 1e-9) * xs; v <= xmax + 1e-9; v += xs) { ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), H - B); ctx.stroke(); ctx.fillText(fmt(Math.abs(v) < 1e-9 ? 0 : v, xd), X(v), H - B + 4); }
      ctx.strokeStyle = '#8796a5'; ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
      ctx.fillStyle = '#3d4b5a'; ctx.font = `600 11.5px ${FONT}`;
      ctx.fillText(d.xLabel, (L + W - R) / 2, H - 14);
      ctx.save(); ctx.translate(11, (T + H - B) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText('pH', 0, 0); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(L, T, W - L - R, H - T - B); ctx.clip();
      // pKₛ ± 1 (Faustregel, keine harte Grenze)
      if (d.band) {
        const a = Y(Math.min(y1, d.band.pKa + 1)), b = Y(Math.max(y0, d.band.pKa - 1));
        ctx.fillStyle = 'rgba(11,114,133,0.09)'; ctx.fillRect(L, a, W - L - R, b - a);
        ctx.strokeStyle = 'rgba(11,114,133,0.7)'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(L, Y(d.band.pKa)); ctx.lineTo(W - R, Y(d.band.pKa)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#0b7285'; ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(d.band.label, W - R - 4, Y(d.band.pKa) - 2);
      }
      // Hilfslinien und Geraden (Ziel-pH, Henderson-Hasselbalch ideal)
      for (const g of d.guides || []) {
        ctx.strokeStyle = g.color || '#c92a2a'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(L, Y(g.y)); ctx.lineTo(W - R, Y(g.y)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = g.color || '#c92a2a'; ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(g.label, L + 6, Y(g.y) - 2);
      }
      for (const g of d.lines || []) {
        ctx.strokeStyle = g.color || '#8a96a3'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(X(g.x0), Y(g.y0)); ctx.lineTo(X(g.x1), Y(g.y1)); ctx.stroke(); ctx.setLineDash([]);
        if (g.label) { ctx.fillStyle = g.color || '#5c6b7a'; ctx.font = `500 11px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(g.label, W - R - 4, Y(g.y1) + 16); }
      }
      // Vergleichsreihen (blass, hohl)
      for (const c of d.compare) this.curve(ctx, c.records, X, Y, { color: '#8a96a3', marker: c.style.marker, dash: [3, 3] }, false, 0.8);
      d.curves.forEach((c) => this.curve(ctx, c.records, X, Y, c.style, true, 1.6));
      ctx.restore();
    }
    curve(ctx, recs, X, Y, st, fill, lw) {
      if (!recs.length) return;
      ctx.strokeStyle = st.color; ctx.fillStyle = st.color; ctx.lineWidth = lw * 0.75; ctx.setLineDash(st.dash);
      if (!st.markersOnly) { ctx.beginPath(); recs.forEach((p, i) => (i ? ctx.lineTo(X(p.v), Y(p.pH)) : ctx.moveTo(X(p.v), Y(p.pH)))); ctx.stroke(); }
      ctx.setLineDash([]); ctx.lineWidth = 1.2;
      const many = recs.length > 60;
      recs.forEach((p, i) => { if (!many || i % 2 === 0 || i === recs.length - 1) { ctx.fillStyle = fill ? st.color : '#fff'; marker(ctx, st.marker, X(p.v), Y(p.pH), st.markersOnly ? 5 : many ? 2.4 : 3.4, true); } });
    }
  }

  function legendSwatch(st, faded) {
    const c = faded ? '#8a96a3' : st.color;
    const m = st.marker === 'square' ? `<rect x="11" y="2" width="8" height="8" fill="${faded ? '#fff' : c}" stroke="${c}"/>` : st.marker === 'triangle' ? `<path d="M15 1.5 L20 10 L10 10 Z" fill="${faded ? '#fff' : c}" stroke="${c}"/>` : `<circle cx="15" cy="6" r="4" fill="${faded ? '#fff' : c}" stroke="${c}"/>`;
    return `<svg viewBox="0 0 30 12" aria-hidden="true"><line x1="0" y1="6" x2="30" y2="6" stroke="${c}" stroke-width="1.5" stroke-dasharray="${(faded ? [3, 3] : st.dash).join(' ')}"/>${m}</svg>`;
  }

  (root.PF = root.PF || {}).chart = { Chart, STYLE, legendSwatch };
})(typeof self !== 'undefined' ? self : this);
