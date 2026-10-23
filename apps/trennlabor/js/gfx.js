/*
 * Trennlabor – gemeinsame Zeichenhilfen (Canvas 2D)
 *
 * Skalierung der logischen Laborbühne auf die Canvas-Größe, Trefferflächen
 * für Antippen/Klicken, Farbfunktionen und wiederkehrende Bildelemente
 * (Fliesenwand, Labortisch, Beschriftungen, Glas).
 */
(function (root) {
  'use strict';
  const { clamp, lerp } = root.TL.core;

  function createView(canvas, W, H) {
    const ctx = canvas.getContext('2d');
    const v = { canvas, ctx, W, H, scale: 1, ox: 0, oy: 0, dpr: 1, cssW: 1, cssH: 1, hot: [] };
    v.resize = function () {
      const rect = canvas.getBoundingClientRect();
      v.cssW = Math.max(1, rect.width); v.cssH = Math.max(1, rect.height);
      const raw = root.devicePixelRatio || 1;
      v.dpr = Math.min(raw, v.cssW * v.cssH > 1.6e6 ? 1.5 : 2);
      canvas.width = Math.round(v.cssW * v.dpr);
      canvas.height = Math.round(v.cssH * v.dpr);
      v.scale = Math.min(v.cssW / W, v.cssH / H);
      v.ox = (v.cssW - W * v.scale) / 2;
      // Szene steht unten auf dem Tisch; überschüssige Höhe wird zur Wand
      v.oy = v.cssH - H * v.scale;
    };
    v.begin = function (bg) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bg || '#dfe6ec';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.ox, v.dpr * v.oy);
      v.hot = [];
      // Beschriftungen bei kleinem Maßstab (Tablet) etwas größer zeichnen
      boost.k = clamp(0.8 / v.scale, 1, 1.5);
    };
    v.toLogical = function (cx, cy) {
      const rect = canvas.getBoundingClientRect();
      return { x: (cx - rect.left - v.ox) / v.scale, y: (cy - rect.top - v.oy) / v.scale };
    };
    v.toClient = function (x, y) {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + v.ox + x * v.scale, y: rect.top + v.oy + y * v.scale };
    };
    /** Trefferfläche registrieren (logische Koordinaten). Später registrierte liegen oben. */
    v.addHot = function (id, x, y, w, h, meta) { v.hot.push(Object.assign({ id, x, y, w, h }, meta || {})); };
    v.hit = function (x, y) {
      for (let i = v.hot.length - 1; i >= 0; i--) {
        const h = v.hot[i];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
      }
      return null;
    };
    /** Trefferflächen in Bildschirmkoordinaten (für Tests und Barrierefreiheit). */
    v.hotspots = function () {
      return v.hot.map((h) => {
        const a = v.toClient(h.x, h.y), b = v.toClient(h.x + h.w, h.y + h.h);
        return { id: h.id, kind: h.kind, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      });
    };
    return v;
  }

  // ---------------------------------------------------------------- Farben
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? (c[3] == null ? 1 : c[3]) : a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3] == null ? 1 : a[3], b[3] == null ? 1 : b[3], t)];
  const shade = (c, f) => [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255), c[3]];
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // ---------------------------------------------------------------- Formen
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const boost = { k: 1 };
  /** Beschriftung als Pille. */
  function label(ctx, text, x, y, opts) {
    const o = Object.assign({ size: 15, bg: 'rgba(255,255,255,0.92)', color: '#2b3a48', bold: true, align: 'center', pad: 7, border: 'rgba(40,60,80,0.18)' }, opts || {});
    o.size *= boost.k; o.pad *= boost.k;
    ctx.font = `${o.bold ? 600 : 500} ${o.size}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const w = ctx.measureText(text).width + o.pad * 2;
    const h = o.size + 9;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    ctx.save();
    rr(ctx, x0, y - h / 2, w, h, h / 2);
    ctx.fillStyle = o.bg; ctx.fill();
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + w / 2, y + 0.5);
    ctx.restore();
    return { x: x0, y: y - h / 2, w, h };
  }
  function text(ctx, str, x, y, opts) {
    const o = Object.assign({ size: 14, color: '#2b3a48', weight: 600, align: 'left', base: 'alphabetic', font: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }, opts || {});
    ctx.font = `${o.weight} ${o.size}px ${o.font}`;
    ctx.fillStyle = o.color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
    ctx.fillText(str, x, y);
  }

  /** Hintergrund: Fliesenwand und Labortisch (vorab in ein Offscreen-Canvas gezeichnet). */
  function background(view, benchY, key) {
    const cache = background.cache || (background.cache = {});
    const k = key + ':' + view.W + 'x' + view.H + ':' + benchY;
    if (!cache[k]) {
      const c = document.createElement('canvas');
      c.width = view.W; c.height = view.H;
      const g = c.getContext('2d');
      const wall = g.createLinearGradient(0, 0, 0, benchY);
      wall.addColorStop(0, '#f4f7f9'); wall.addColorStop(1, '#e7edf2');
      g.fillStyle = wall; g.fillRect(0, 0, view.W, benchY);
      g.strokeStyle = 'rgba(150,170,190,0.22)'; g.lineWidth = 1;
      for (let y = 40; y < benchY; y += 52) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(view.W, y + 0.5); g.stroke(); }
      for (let y = 40, row = 0; y < benchY; y += 52, row++) {
        for (let x = (row % 2) * 52; x < view.W; x += 104) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, Math.min(benchY, y + 52)); g.stroke(); }
      }
      const top = g.createLinearGradient(0, benchY - 10, 0, benchY + 40);
      top.addColorStop(0, '#cfd8e0'); top.addColorStop(1, '#b9c5cf');
      g.fillStyle = top; g.fillRect(0, benchY - 10, view.W, 50);
      const front = g.createLinearGradient(0, benchY + 40, 0, view.H);
      front.addColorStop(0, '#9fadb9'); front.addColorStop(1, '#7f8d99');
      g.fillStyle = front; g.fillRect(0, benchY + 40, view.W, view.H - benchY - 40);
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, benchY - 10, view.W, 2);
      cache[k] = c;
    }
    // Ränder außerhalb der logischen Bühne passend füllen (kein Letterboxing)
    const ctx = view.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const yb = (view.oy + (benchY + 40) * view.scale) * view.dpr;
    ctx.fillStyle = '#f2f5f8'; ctx.fillRect(0, 0, ctx.canvas.width, Math.max(0, yb));
    ctx.fillStyle = '#7f8d99'; ctx.fillRect(0, yb, ctx.canvas.width, ctx.canvas.height - yb);
    const yt = (view.oy + (benchY - 10) * view.scale) * view.dpr;
    ctx.fillStyle = '#c4ced7'; ctx.fillRect(0, yt, ctx.canvas.width, yb - yt);
    ctx.restore();
    ctx.drawImage(cache[k], 0, 0);
  }

  /** Glaskontur mit Glanzlicht entlang eines Pfades (Pfad muss gesetzt sein). */
  function glass(ctx, lw) {
    ctx.save();
    ctx.lineWidth = lw || 2.4;
    ctx.strokeStyle = 'rgba(95,120,140,0.85)';
    ctx.stroke();
    ctx.lineWidth = (lw || 2.4) * 0.45;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
    ctx.restore();
  }

  /** Hervorhebung (Auswahl / mögliches Ziel). */
  function highlight(ctx, x, y, w, h, kind, t) {
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin((t || 0) * 5);
    rr(ctx, x - 6, y - 6, w + 12, h + 12, 12);
    if (kind === 'target') { ctx.setLineDash([7, 5]); ctx.strokeStyle = `rgba(31,111,229,${0.55 + 0.35 * pulse})`; ctx.lineWidth = 2.5; }
    else { ctx.strokeStyle = 'rgba(31,111,229,0.95)'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(31,111,229,0.07)'; ctx.fill(); }
    ctx.stroke();
    ctx.restore();
  }

  /** Stoppuhr-Anzeige der Modellzeit. */
  function clock(ctx, x, y, seconds, speed) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    label(ctx, `⏱ ${m}:${String(s).padStart(2, '0')} min${speed === 0 ? ' · Pause' : speed > 1 ? ' · ' + speed + '× Zeitraffer' : ''}`, x, y, { size: 14, align: 'right', bg: 'rgba(22,32,43,0.82)', color: '#fff', border: null });
  }

  root.TL.gfx = { createView, rgba, mix, shade, rng, hash, ease, rr, label, text, background, glass, highlight, clock };
})(typeof self !== 'undefined' ? self : this);
