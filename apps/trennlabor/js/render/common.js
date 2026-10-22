/*
 * Trennlabor – gemeinsame Zeichenfunktionen (Canvas 2D)
 * Glasgeräte, Flüssigkeiten, Beschriftungen, Hintergrund, Treffer-Bereiche.
 * Die Renderer der drei Labore zeichnen ausschließlich aus dem Modellzustand.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const { clamp, lerp, rng } = TL.util;

  const W = 1200, H = 800;
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? (c[3] == null ? 1 : c[3]) : a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3] == null ? 1 : a[3], b[3] == null ? 1 : b[3], t)];

  /** Bühne: Größenanpassung, Koordinatenumrechnung, Trefferbereiche. */
  function createStage(canvas) {
    const ctx = canvas.getContext('2d');
    const s = { canvas, ctx, dpr: 1, scale: 1, ox: 0, oy: 0, cssW: 1, cssH: 1, hits: [], W, H };
    s.resize = function () {
      const r = canvas.getBoundingClientRect();
      s.cssW = Math.max(1, r.width); s.cssH = Math.max(1, r.height);
      s.dpr = Math.min(root.devicePixelRatio || 1, 2);
      canvas.width = Math.round(s.cssW * s.dpr); canvas.height = Math.round(s.cssH * s.dpr);
      s.scale = Math.min(s.cssW / W, s.cssH / H);
      s.ox = (s.cssW - W * s.scale) / 2; s.oy = (s.cssH - H * s.scale) / 2;
    };
    s.begin = function () {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#dfe6ec';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(s.dpr * s.scale, 0, 0, s.dpr * s.scale, s.dpr * s.ox, s.dpr * s.oy);
      s.hits = [];
    };
    s.toLogical = (cx, cy) => { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left - s.ox) / s.scale, y: (cy - r.top - s.oy) / s.scale }; };
    s.toClient = (x, y) => { const r = canvas.getBoundingClientRect(); return { x: r.left + s.ox + x * s.scale, y: r.top + s.oy + y * s.scale }; };
    s.hit = (id, x, y, w, h, label) => { s.hits.push({ id, x, y, w, h, label: label || id }); };
    s.hitTest = (x, y) => { for (let i = s.hits.length - 1; i >= 0; i--) { const h = s.hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; };
    s.hitCenter = (id) => { const h = s.hits.find((x) => x.id === id); if (!h) return null; return s.toClient(h.x + h.w / 2, h.y + h.h / 2); };
    return s;
  }

  // ------------------------------------------------------------ Hintergrund
  let bgCache = null;
  function background(ctx, benchY) {
    const key = benchY;
    if (!bgCache || bgCache.key !== key) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      const wall = g.createLinearGradient(0, 0, 0, benchY);
      wall.addColorStop(0, '#f4f7f9'); wall.addColorStop(1, '#e6ecf0');
      g.fillStyle = wall; g.fillRect(0, 0, W, benchY);
      g.strokeStyle = 'rgba(160,175,190,0.25)'; g.lineWidth = 1;
      for (let y = 40; y < benchY; y += 40) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
      for (let y = 0, row = 0; y < benchY; y += 40, row++) for (let x = (row % 2) * 40; x < W; x += 80) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 40); g.stroke(); }
      const top = g.createLinearGradient(0, benchY, 0, benchY + 26);
      top.addColorStop(0, '#c9d3db'); top.addColorStop(1, '#b7c3cd');
      g.fillStyle = top; g.fillRect(0, benchY, W, 26);
      const front = g.createLinearGradient(0, benchY + 26, 0, H);
      front.addColorStop(0, '#d6dee5'); front.addColorStop(1, '#c4ced7');
      g.fillStyle = front; g.fillRect(0, benchY + 26, W, H - benchY - 26);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, benchY, W, 1.5);
      bgCache = { key, c };
    }
    // Bereiche außerhalb der logischen Bühne (Seitenverhältnis) passend füllen
    ctx.fillStyle = '#eceff3'; ctx.fillRect(-3000, -3000, W + 6000, 3000 + benchY);
    ctx.fillStyle = '#c4ced7'; ctx.fillRect(-3000, benchY, W + 6000, 3000);
    ctx.fillStyle = '#c9d3db'; ctx.fillRect(-3000, benchY, W + 6000, 26);
    ctx.drawImage(bgCache.c, 0, 0);
  }

  // ------------------------------------------------------------ Beschriftung
  function label(ctx, text, x, y, opts) {
    const o = Object.assign({ size: 13, bold: true, bg: 'rgba(255,255,255,0.88)', color: '#26323e', align: 'center' }, opts);
    ctx.save();
    ctx.font = `${o.bold ? 600 : 500} ${o.size}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const w = ctx.measureText(text).width + 14, h = o.size + 9;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    ctx.fillStyle = o.bg;
    roundRect(ctx, x0, y - h / 2, w, h, h / 2); ctx.fill();
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + w / 2, y + 0.5);
    ctx.restore();
    return w;
  }
  function text(ctx, t, x, y, opts) {
    const o = Object.assign({ size: 13, weight: 500, color: '#26323e', align: 'center', base: 'middle' }, opts);
    ctx.save();
    ctx.font = `${o.weight} ${o.size}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.fillStyle = o.color; ctx.textAlign = o.align; ctx.textBaseline = o.base;
    ctx.fillText(t, x, y);
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /** Auswahlrahmen um ein Objekt. */
  function selection(ctx, x, y, w, h, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(31,111,229,0.9)'; ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t * 30;
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 14); ctx.stroke();
    ctx.restore();
  }
  function targetMark(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(31,111,229,0.08)'; ctx.strokeStyle = 'rgba(31,111,229,0.55)'; ctx.lineWidth = 2;
    roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 12); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ Glas
  /** Glaswand mit Lichtreflexen (für beliebige Pfade). */
  function glassStroke(ctx, path, opts) {
    const o = Object.assign({ width: 2.4 }, opts);
    ctx.save();
    ctx.strokeStyle = 'rgba(120,140,160,0.85)'; ctx.lineWidth = o.width;
    path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.restore();
  }

  /** Becherglas: Rückwand, Inhalt (Callback), Vorderseite mit Skala. */
  function beaker(ctx, x, yb, w, h, opts, drawContent) {
    const o = Object.assign({ scale: null, label: null }, opts);
    const r = 8;
    const left = x - w / 2, right = x + w / 2, top = yb - h;
    // Rückwand
    ctx.save();
    ctx.fillStyle = 'rgba(225,236,245,0.35)';
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, yb - r); ctx.quadraticCurveTo(left, yb, left + r, yb); ctx.lineTo(right - r, yb); ctx.quadraticCurveTo(right, yb, right, yb - r); ctx.lineTo(right, top); ctx.closePath(); ctx.fill();
    ctx.restore();
    const inner = { left: left + 3, right: right - 3, top: top + 4, bottom: yb - 3, w: w - 6, h: h - 7, x };
    if (drawContent) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(inner.left, inner.top - 30); ctx.lineTo(inner.left, inner.bottom - r + 3); ctx.quadraticCurveTo(inner.left, inner.bottom, inner.left + r - 3, inner.bottom);
      ctx.lineTo(inner.right - r + 3, inner.bottom); ctx.quadraticCurveTo(inner.right, inner.bottom, inner.right, inner.bottom - r + 3); ctx.lineTo(inner.right, inner.top - 30); ctx.closePath();
      ctx.clip();
      drawContent(inner);
      ctx.restore();
    }
    // Skala
    if (o.scale) {
      ctx.save();
      ctx.strokeStyle = 'rgba(70,90,110,0.55)'; ctx.fillStyle = 'rgba(55,70,90,0.75)'; ctx.lineWidth = 1;
      ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const [ml, y] of o.scale) {
        ctx.beginPath(); ctx.moveTo(left + 8, y + 0.5); ctx.lineTo(left + 22, y + 0.5); ctx.stroke();
        ctx.fillText(String(ml), left + 25, y);
      }
      ctx.restore();
    }
    // Glas vorn
    ctx.save();
    ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(left - 5, top - 2); ctx.quadraticCurveTo(left, top - 2, left, top + 6);
    ctx.lineTo(left, yb - r); ctx.quadraticCurveTo(left, yb, left + r, yb); ctx.lineTo(right - r, yb); ctx.quadraticCurveTo(right, yb, right, yb - r); ctx.lineTo(right, top);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, top, w / 2, 4, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(105,125,145,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    const gl = ctx.createLinearGradient(left, 0, left + 16, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0.65)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(left + 3, top + 10, 14, h - 24);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(right - 12, top + 14, 4, h - 34);
    ctx.restore();
    return inner;
  }

  /** Flüssigkeitsschicht zwischen y0 (oben) und y1 (unten) über die Breite eines Bereichs. */
  function liquidBand(ctx, inner, y0, y1, color, opts) {
    if (y1 - y0 < 0.3) return;
    const o = Object.assign({ meniscus: true }, opts);
    ctx.save();
    const g = ctx.createLinearGradient(inner.left, 0, inner.right, 0);
    g.addColorStop(0, rgba(color, Math.min(1, color[3] * 1.25)));
    g.addColorStop(0.5, rgba(color, color[3]));
    g.addColorStop(1, rgba(color, Math.min(1, color[3] * 1.3)));
    ctx.fillStyle = g;
    ctx.fillRect(inner.left - 2, y0, inner.right - inner.left + 4, y1 - y0);
    if (o.meniscus) {
      ctx.fillStyle = rgba(color, Math.min(1, color[3] * 0.9 + 0.15));
      ctx.beginPath(); ctx.ellipse((inner.left + inner.right) / 2, y0, (inner.right - inner.left) / 2, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse((inner.left + inner.right) / 2, y0, (inner.right - inner.left) / 2 - 1, 3, 0, Math.PI, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ Feststoff-Texturen
  const patterns = {};
  function grainPattern(ctx, kind) {
    if (patterns[kind]) return patterns[kind];
    const N = 64;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    const r = rng(kind.length * 977 + 13);
    const base = { sand: '#d9b77c', iron: '#4a4e55', salt: '#f4f6f8', plant: '#7b1f2e', mix: '#cfae78' }[kind] || '#ccc';
    g.fillStyle = base; g.fillRect(0, 0, N, N);
    const cols = {
      sand: ['#c49a58', '#e8cf9c', '#b38a4c', '#f1dcb2', '#a77d43'],
      iron: ['#2f3237', '#5d626b', '#3b3f45', '#70757e'],
      salt: ['#ffffff', '#e2e8ee', '#d5dde5', '#f8fbff'],
      plant: ['#5a1020', '#93263a', '#6b1828', '#b03a4e'],
      mix: ['#c49a58', '#f2f2f2', '#b38a4c', '#ffffff', '#e8cf9c']
    }[kind] || ['#999'];
    for (let i = 0; i < 380; i++) {
      g.fillStyle = cols[(r() * cols.length) | 0];
      const s = 0.8 + r() * 2.2;
      g.beginPath(); g.ellipse(r() * N, r() * N, s, s * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
    }
    patterns[kind] = ctx.createPattern(c, 'repeat');
    return patterns[kind];
  }

  /** Bodensatz mit leicht gewölbter Oberfläche. */
  function sediment(ctx, inner, yTop, yBottom, kind, seed) {
    if (yBottom - yTop < 0.4) return;
    ctx.save();
    ctx.fillStyle = grainPattern(ctx, kind);
    ctx.beginPath();
    ctx.moveTo(inner.left - 2, yBottom + 2);
    ctx.lineTo(inner.left - 2, yTop + 2);
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const x = lerp(inner.left, inner.right, i / n);
      const bump = Math.sin(i * 1.7 + seed) * 1.2 - Math.sin((i / n) * Math.PI) * 1.5;
      ctx.lineTo(x, yTop + bump);
    }
    ctx.lineTo(inner.right + 2, yBottom + 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fill();
    ctx.restore();
  }

  /** Schwebeteilchen (Trübung) in einem Bereich. */
  function turbidity(ctx, inner, y0, y1, amount, color, t, seed) {
    if (amount <= 0.002 || y1 - y0 < 1) return;
    ctx.save();
    const a = clamp(amount, 0, 1);
    ctx.fillStyle = rgba(color, a * 0.55);
    ctx.fillRect(inner.left - 2, y0, inner.right - inner.left + 4, y1 - y0);
    const r = rng(seed || 7);
    const n = Math.round(30 + a * 160);
    ctx.fillStyle = rgba(color.map((v, i) => (i < 3 ? v * 0.75 : v)), 0.35 + a * 0.4);
    for (let i = 0; i < n; i++) {
      const u = r(), v = r(), ph = r() * 6.28;
      const x = inner.left + u * (inner.right - inner.left) + Math.sin(t * 0.8 + ph) * 3;
      const y = y0 + ((v + t * 0.01 * (0.5 + r())) % 1) * (y1 - y0);
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.restore();
  }

  /** Kleine Salzwürfel. */
  function crystals(ctx, cx, cy, spreadX, spreadY, count, seed) {
    const r = rng(seed || 11);
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = cx + (r() - 0.5) * 2 * spreadX, y = cy + (r() - 0.5) * 2 * spreadY;
      const s = 2 + r() * 3.5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 0.8 - 0.4);
      ctx.fillStyle = 'rgba(250,252,255,0.95)'; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = 'rgba(150,170,190,0.8)'; ctx.lineWidth = 0.6; ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = 'rgba(200,215,230,0.7)'; ctx.fillRect(-s / 2, -s / 2, s, s * 0.3);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Stativ mit Stange und Fuß. */
  function stand(ctx, x, yTop, yBase) {
    ctx.save();
    const g = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
    g.addColorStop(0, '#8e99a4'); g.addColorStop(0.5, '#e3e8ec'); g.addColorStop(1, '#7c8792');
    ctx.fillStyle = g; ctx.fillRect(x - 5, yTop, 10, yBase - yTop);
    ctx.fillStyle = '#4b5662'; roundRect(ctx, x - 70, yBase - 10, 150, 14, 4); ctx.fill();
    ctx.fillStyle = '#5d6975'; roundRect(ctx, x - 70, yBase - 12, 150, 6, 3); ctx.fill();
    ctx.restore();
  }
  function clampArm(ctx, x0, y, x1) {
    ctx.save();
    ctx.fillStyle = '#6c7783'; roundRect(ctx, Math.min(x0, x1), y - 4, Math.abs(x1 - x0), 8, 3); ctx.fill();
    ctx.fillStyle = '#3d4650'; roundRect(ctx, x0 - 9, y - 9, 18, 18, 4); ctx.fill();
    ctx.restore();
  }

  /** Bunsenbrenner mit Flamme (level 0–2). */
  function burner(ctx, x, yBase, level, t) {
    ctx.save();
    ctx.fillStyle = '#3e4852'; roundRect(ctx, x - 34, yBase - 12, 68, 12, 4); ctx.fill();
    const g = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    g.addColorStop(0, '#77828d'); g.addColorStop(0.5, '#d8dde2'); g.addColorStop(1, '#6a7580');
    ctx.fillStyle = g; ctx.fillRect(x - 9, yBase - 92, 18, 82);
    ctx.fillStyle = '#5b6672'; ctx.fillRect(x - 12, yBase - 40, 24, 10);
    ctx.strokeStyle = '#e07b2c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 12, yBase - 34); ctx.quadraticCurveTo(x + 60, yBase - 30, x + 70, yBase - 2); ctx.stroke();
    if (level > 0) {
      const hgt = level === 2 ? 70 : 34, wid = level === 2 ? 15 : 9;
      const top = yBase - 92;
      const fl = Math.sin(t * 23) * 2 + Math.sin(t * 37) * 1.4;
      const og = ctx.createLinearGradient(0, top - hgt, 0, top);
      og.addColorStop(0, 'rgba(90,140,255,0)'); og.addColorStop(0.35, 'rgba(90,140,255,0.55)'); og.addColorStop(1, 'rgba(60,110,255,0.85)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.moveTo(x - wid, top); ctx.quadraticCurveTo(x - wid * 0.9, top - hgt * 0.6, x + fl * 0.4, top - hgt - fl); ctx.quadraticCurveTo(x + wid * 0.9, top - hgt * 0.6, x + wid, top); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(40,200,255,0.75)';
      ctx.beginPath(); ctx.moveTo(x - wid * 0.5, top); ctx.quadraticCurveTo(x, top - hgt * 0.45, x + wid * 0.5, top); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /** Fallende Tropfen in einem senkrechten Strang. */
  function drips(ctx, x, y0, y1, rate, color, t, seed) {
    if (rate <= 0.001) return;
    ctx.save();
    ctx.fillStyle = rgba(color, Math.max(0.55, color[3] || 0.6));
    if (rate > 2.2) {
      ctx.fillRect(x - 1.6, y0, 3.2, y1 - y0);
    } else {
      const n = Math.max(1, Math.round(rate * 2.5));
      const period = 1 / Math.max(0.6, rate * 1.6);
      for (let i = 0; i < n; i++) {
        const ph = ((t / period) + i / n + (seed || 0)) % 1;
        const y = y0 + ph * ph * (y1 - y0);
        ctx.beginPath(); ctx.ellipse(x, y, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  TL.render = TL.render || {};
  Object.assign(TL.render, {
    W, H, rgba, mix, createStage, background, label, text, roundRect, selection, targetMark, glassStroke, beaker,
    liquidBand, sediment, turbidity, crystals, stand, clampArm, burner, drips, grainPattern
  });
})(typeof self !== 'undefined' ? self : this);
