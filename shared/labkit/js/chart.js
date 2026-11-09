/*
 * SiVex-Labkit – Zeit-Mengen-Diagramm und Balkenpaar (Canvas 2D, ohne Fachlogik)
 *
 * Gemeinsamer Baustein der Gleichgewichts-Apps (docs/GLEICHGEWICHT-PLANUNG.md, G2/G3):
 *  - createChart(canvas, opts): Reihen über einer Zeit-/Zählachse, Referenzlinien,
 *    senkrechte Marken (z. B. „Gleichgewicht“, Eingriffe), optionale Zweitreihen (gestrichelt).
 *  - createBars(canvas, opts): zwei Balken „pro Zeiteinheit“ (Hin/Rück) mit Zahl.
 * Farben kommen von der App (Standard: links/Edukte Rot, rechts/Produkte Blau).
 * HiDPI-fähig; zeichnet nur, wenn draw() gerufen wird.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.LK = root.LK || {}).chart = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COLORS = { left: '#d9502f', right: '#1f6fd1', axis: '#66768a', grid: '#e3e8ee', text: '#17212c', mark: '#3d4b5a', eq: '#1c8a4a' };
  const FONT = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Arial, sans-serif';

  /** Schöne Achsenteilung: Schrittweite 1·2·5·10^k für etwa n Teilstriche. */
  function niceStep(range, n) {
    if (!(range > 0)) return 1;
    const raw = range / Math.max(1, n);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    const k = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
    return k * p;
  }
  const fmtDe = (v, d) => (Math.abs(v) < 1e-12 ? '0' : Number(v.toFixed(d == null ? 2 : d)).toString().replace('.', ','));

  function setupCanvas(canvas) {
    const dpr = Math.max(1, Math.min(3, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)));
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(10, Math.round(rect.width)), h = Math.max(10, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /**
   * opts: { xLabel, yLabel, yMax (feste Obergrenze, sonst automatisch), xMin (Sichtfenster, Standard: alle Daten),
   *         xFmt, yFmt (Formatierer), font (px), colors }
   * Reihen: setSeries([{ id, label, color, points: [[x,y],…], dashed }])
   * Referenzlinien: setRefs([{ y, label, color }])
   * Marken: setMarks([{ x, label, color, dashed }])
   */
  function createChart(canvas, opts) {
    opts = Object.assign({ xLabel: '', yLabel: '', yMax: null, yMin: 0, xMinSpan: 10, font: 13 }, opts || {});
    const colors = Object.assign({}, COLORS, opts.colors || {});
    let series = [], refs = [], marks = [];
    const api = {
      setSeries(s) { series = s || []; },
      setRefs(r) { refs = r || []; },
      setMarks(m) { marks = m || []; },
      /** Feste Obergrenze der y-Achse ändern (null = automatisch). */
      setYMax(v) { opts.yMax = v; },
      /** Einzelne Optionen nachträglich ändern (z. B. Achsenbeschriftung). */
      set(o) { Object.assign(opts, o || {}); },
      draw
    };
    function draw() {
      const { ctx, w, h } = setupCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      const f = opts.font;
      ctx.font = `${f}px ${FONT}`;
      // Datenbereich
      let xMax = opts.xMinSpan, yMax = opts.yMax;
      for (const s of series) for (const p of s.points) { if (p[0] > xMax) xMax = p[0]; if (yMax == null && p[1] > (yMax || 0)) yMax = p[1]; }
      for (const m of marks) if (m.x > xMax) xMax = m.x;
      if (opts.yMax == null) { yMax = (yMax || 1) * 1.08; for (const r of refs) if (r.y * 1.08 > yMax) yMax = r.y * 1.08; }
      const yMin = opts.yMin;
      const yF = opts.yFmt || ((v) => fmtDe(v, 2));
      const padR = 16, padT = 14, padB = 22 + (opts.xLabel ? f + 6 : 0);
      const ysPre = niceStep(yMax - yMin, Math.max(10, h - padB - padT) / 42);
      let tickW = 0;
      for (let y = yMin; y <= yMax + 1e-9; y += ysPre) tickW = Math.max(tickW, ctx.measureText(yF(y)).width);
      const padL = 10 + tickW + 8 + (opts.yLabel ? f + 4 : 0);
      const x0 = padL, x1 = w - padR, y0 = h - padB, y1 = padT;
      const pw = Math.max(10, x1 - x0), ph = Math.max(10, y0 - y1);
      const X = (x) => x0 + (x / xMax) * pw;
      const Y = (y) => y0 - ((y - yMin) / (yMax - yMin)) * ph;
      // Gitter und Achsen
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.grid;
      ctx.fillStyle = colors.axis;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const ys = niceStep(yMax - yMin, ph / 42);
      for (let y = yMin; y <= yMax + 1e-9; y += ys) {
        const yy = Y(y);
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
        ctx.fillText(yF(y), x0 - 6, yy);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const xs = niceStep(xMax, pw / 64);
      for (let x = 0; x <= xMax + 1e-9; x += xs) {
        const xx = X(x);
        ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 + 4); ctx.strokeStyle = colors.axis; ctx.stroke();
        ctx.fillText((opts.xFmt || ((v) => fmtDe(v, 2)))(x), xx, y0 + 6);
      }
      ctx.strokeStyle = colors.axis; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      if (opts.xLabel) { ctx.fillStyle = colors.text; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(opts.xLabel, x1, h - 2); }
      if (opts.yLabel) {
        ctx.save(); ctx.translate(f + 2, y1 + ph / 2); ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = colors.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opts.yLabel, 0, 0); ctx.restore();
      }
      // Referenzlinien
      for (const r of refs) {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = r.color || colors.mark; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, Y(r.y)); ctx.lineTo(x1, Y(r.y)); ctx.stroke(); ctx.restore();
        if (r.label) { ctx.fillStyle = r.color || colors.mark; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(r.label, x0 + 4, Y(r.y) - 2); }
      }
      // Reihen (Clipping auf den Zeichenbereich)
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y1 - 2, pw, ph + 2); ctx.clip();
      for (const s of series) {
        if (!s.points.length) continue;
        ctx.strokeStyle = s.color || colors.text; ctx.lineWidth = s.width || 2.4;
        ctx.setLineDash(s.dashed ? [7, 5] : []);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        s.points.forEach((p, i) => { const xx = X(p[0]), yy = Y(p[1]); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); });
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
      // Reihenbeschriftung am rechten Ende (versetzt, damit sie sich nicht überdecken)
      const labels = series.filter((s) => s.label && s.points.length).map((s) => ({ s, y: Y(s.points[s.points.length - 1][1]) }));
      labels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < f + 2) labels[i].y = labels[i - 1].y + f + 2;
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      for (const l of labels) {
        ctx.fillStyle = l.s.color || colors.text;
        const ty = Math.min(y0 - 2, Math.max(y1 + f, l.y - 3));
        ctx.fillText(l.s.label, x1 - 2, ty);
      }
      // Marken
      for (const m of marks) {
        const xx = X(m.x);
        ctx.save(); ctx.setLineDash(m.dashed === false ? [] : [5, 4]); ctx.strokeStyle = m.color || colors.eq; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(xx, y1); ctx.lineTo(xx, y0); ctx.stroke(); ctx.restore();
        if (m.label) {
          ctx.fillStyle = m.color || colors.eq; ctx.textBaseline = 'top';
          const tw = ctx.measureText(m.label).width;
          const left = xx + 4 + tw > x1;
          ctx.textAlign = left ? 'right' : 'left';
          ctx.fillText(m.label, left ? xx - 4 : xx + 4, y1 + (m.row || 0) * (f + 3));
        }
      }
    }
    return api;
  }

  /**
   * Balkenpaar „pro Zeiteinheit“.
   * opts: { title, labels: [links, rechts], colors: [links, rechts], max (feste Skala, sonst automatisch), fmt, font }
   * set(a, b) setzt die Werte; draw() zeichnet.
   */
  function createBars(canvas, opts) {
    opts = Object.assign({ title: '', labels: ['hin', 'zurück'], colors: [COLORS.left, COLORS.right], max: null, font: 13, decimals: 1 }, opts || {});
    let a = 0, b = 0, peak = 1;
    function set(va, vb) { a = Math.max(0, va || 0); b = Math.max(0, vb || 0); peak = Math.max(peak * 0.995, a, b, 1e-6); }
    function draw() {
      const { ctx, w, h } = setupCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      const f = opts.font;
      ctx.font = `${f}px ${FONT}`;
      ctx.fillStyle = COLORS.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      let top = 4;
      if (opts.title) { ctx.fillText(opts.title, w / 2, top); top += f + 6; }
      const bottom = h - (f + 8) - 6;
      const area = Math.max(10, bottom - top - (f + 6));
      const max = opts.max || peak;
      const bw = Math.min(56, (w - 30) / 2 - 10);
      const xs = [w / 2 - bw - 8, w / 2 + 8];
      [a, b].forEach((v, i) => {
        const hh = Math.max(0, Math.min(1, v / max)) * area;
        ctx.fillStyle = opts.colors[i];
        ctx.fillRect(xs[i], bottom - hh, bw, hh);
        ctx.fillStyle = COLORS.text; ctx.textBaseline = 'bottom';
        ctx.fillText((opts.fmt || ((x) => fmtDe(x, opts.decimals)))(v), xs[i] + bw / 2, bottom - hh - 2);
        ctx.textBaseline = 'top'; ctx.fillStyle = COLORS.axis;
        ctx.fillText(opts.labels[i], xs[i] + bw / 2, bottom + 4);
      });
      ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xs[0] - 6, bottom + 0.5); ctx.lineTo(xs[1] + bw + 6, bottom + 0.5); ctx.stroke();
    }
    return { set, draw, get values() { return [a, b]; } };
  }

  return { COLORS, FONT, niceStep, fmtDe, setupCanvas, createChart, createBars };
});
