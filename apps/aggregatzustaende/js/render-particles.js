/*
 * Aggregatzustände – Teilchenebene (Canvas 2D, HiDPI)
 *
 * Zeichnet den Darstellungsraum der gemeinsamen Teilchen-Engine mit den
 * Symbolen aus den Stoffdaten (Dreieck, Rechteck, Kugel). Schematisch und
 * nicht maßstabsgetreu; die Symbole sind keine Molekülstrukturen.
 * Begründete Ausnahme von WebGL: Für knapp 50 flache 2D-Symbole ist Canvas 2D
 * robuster und wartbarer (siehe docs/CHEMIE.md, Abschnitt Technik).
 * Der Renderer liest nur den Zustand der Engine und verändert ihn nie.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /** Ein Teilchensymbol zeichnen (auch für die Legende verwendet). */
  function drawSymbol(ctx, k, x, y, a, s) {
    const r = k.r * s;
    ctx.save();
    ctx.translate(x, y);
    if (k.symbol === 'sphere') {
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, k.shine); g.addColorStop(0.45, k.fill); g.addColorStop(1, k.edge);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = k.edge; ctx.lineWidth = Math.max(0.6, r * 0.09); ctx.stroke();
    } else if (k.symbol === 'triangle') {
      ctx.rotate(a);
      const R = r * 1.22;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const t = -Math.PI / 2 + (i * TAU) / 3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(t) * R, Math.sin(t) * R); }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -R, 0, R * 0.6);
      g.addColorStop(0, '#7fb6f0'); g.addColorStop(0.55, k.fill); g.addColorStop(1, k.edge);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineJoin = 'round'; ctx.strokeStyle = k.edge; ctx.lineWidth = Math.max(0.6, r * 0.12); ctx.stroke();
    } else {
      ctx.rotate(a);
      const w = k.w * s, h = k.h * s;
      rr(ctx, -w / 2, -h / 2, w, h, h * 0.28);
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, '#b583e6'); g.addColorStop(0.5, k.fill); g.addColorStop(1, k.edge);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = k.edge; ctx.lineWidth = Math.max(0.6, h * 0.12); ctx.stroke();
    }
    ctx.restore();
  }

  class ParticleRenderer {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.view = { w: 0, h: 0, dpr: 1, s: 1, ox: 0, oy: 0 };
      this.sys = null;
    }
    setSystem(sys) { this.sys = sys; }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      if (w === this.view.w && h === this.view.h && dpr === this.view.dpr) return false;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      Object.assign(this.view, { w, h, dpr });
      return true;
    }
    /** Darstellungsraum in Bildschirmkoordinaten (für Tests). */
    boxRect() {
      const v = this.view, sys = this.sys;
      const pad = Math.max(10, Math.min(v.w, v.h) * 0.04);
      const s = Math.min((v.w - 2 * pad) / sys.W, (v.h - 2 * pad) / sys.H);
      return { s, x: (v.w - sys.W * s) / 2, y: (v.h - sys.H * s) / 2, w: sys.W * s, h: sys.H * s };
    }
    draw(model) {
      this.resize();
      const ctx = this.ctx, v = this.view, sys = this.sys;
      if (!sys) return;
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, v.h);
      bg.addColorStop(0, '#dfe7ef'); bg.addColorStop(1, '#cfd9e3');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, v.w, v.h);
      const b = this.boxRect();
      // Rahmen des Ausschnitts (schematischer, stark vergrößerter Blick in den Stoff)
      ctx.save();
      ctx.shadowColor = 'rgba(30,50,70,0.18)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
      rr(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, 14);
      ctx.fillStyle = '#fbfdff'; ctx.fill();
      ctx.restore();
      rr(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, 14);
      ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      rr(ctx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 10); ctx.clip();
      const inner = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      inner.addColorStop(0, '#f7fafd'); inner.addColorStop(1, '#eef3f8');
      ctx.fillStyle = inner; ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      ctx.setTransform(v.dpr * b.s, 0, 0, v.dpr * b.s, v.dpr * b.x, v.dpr * b.y);
      // kalte Oberfläche (nur Iod)
      const st = model.state;
      const pa = Math.max(st.coldVis, sys.ps.some((p) => p.ph === 'P') ? 0.6 : 0);
      if (sys.plate.length && pa > 0.01) {
        ctx.globalAlpha = pa;
        const g = ctx.createLinearGradient(0, 0, 0, sys.PLATE_Y);
        g.addColorStop(0, '#9ab7cf'); g.addColorStop(1, '#d7e9f6');
        ctx.fillStyle = g; ctx.fillRect(-2, -2, sys.W + 4, sys.PLATE_Y + 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 26; i++) { const x = ((i * 37) % 89) * (sys.W / 89); ctx.fillRect(x, sys.PLATE_Y - 0.9, 1.6, 0.9); }
        ctx.strokeStyle = '#6f8ea8'; ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.moveTo(0, sys.PLATE_Y); ctx.lineTo(sys.W, sys.PLATE_Y); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const kinds = sys.sub.particle.kinds;
      // Paare im Gas (Kochsalz): dezente Verbindung unter den Kugeln
      ctx.strokeStyle = 'rgba(90,100,110,0.45)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      for (const p of sys.ps) {
        if (p.bond > p.i) { const q = sys.ps[p.bond]; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      }
      // zuerst die großen Kugeln, dann die kleinen (Kochsalz), sonst Reihenfolge der Engine
      const order = kinds.length > 1 ? sys.ps.slice().sort((a, c) => c.r - a.r) : sys.ps;
      for (const p of order) drawSymbol(ctx, kinds[p.kind], p.x, p.y, p.a, 1);
      ctx.restore();
    }
  }

  (root.AZ = root.AZ || {}).renderParticles = { ParticleRenderer, drawSymbol };
})(typeof self !== 'undefined' ? self : this);
