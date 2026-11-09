/*
 * Estergleichgewicht – Zeichnen (Canvas 2D)
 *
 * MatterRenderer: Stoffebene – Rundkolben mit Reaktionsgemisch (Meniskus nach TitraLab 3,
 * vereinfacht) und vier Mengenbalken (Edukte rot, Produkte blau), Werte in mol.
 * ParticleRenderer: Teilchenebene – Kasten mit 40 schematischen Teilchen; Ester ist aus dem
 * Säure- und dem Alkoholteil zusammengesetzt gezeichnet, Wasser klein und blau. Aufblitzen beim
 * erfolgreichen Zusammenstoß. Beide Renderer zeichnen nur aus Modellzuständen.
 */
(function (root) {
  'use strict';
  const { setupCanvas, FONT, COLORS } = root.LK.chart;
  const { clamp } = root.LK.core;
  const SUB = [
    { name: 'Ethansäure', short: 'Säure', color: '#d9502f', soft: '#f2b3a3' },
    { name: 'Ethanol', short: 'Alkohol', color: '#e8863a', soft: '#f6cfa9' },
    { name: 'Ethansäure-ethylester', short: 'Ester', color: '#1f6fd1', soft: '#a9c8f0' },
    { name: 'Wasser', short: 'Wasser', color: '#5aa9e6', soft: '#bfe0f7' }
  ];

  // ------------------------------------------------------------------ Stoffebene
  function MatterRenderer(canvas, model) { this.canvas = canvas; this.model = model; }
  MatterRenderer.prototype.resize = function () { setupCanvas(this.canvas); };
  MatterRenderer.prototype.draw = function () {
    const { ctx, w, h } = setupCanvas(this.canvas);
    const n = this.model.state.n;
    ctx.clearRect(0, 0, w, h);
    const total = n.reduce((a, b) => a + b, 0);
    // Kolben links (ca. 38 % der Breite)
    const fx = w * 0.19, base = h - 40;
    const R = clamp(Math.min(w * 0.15, h * 0.26), 36, 110);
    const neckW = R * 0.42, neckH = R * 1.1;
    const cy = base - R;
    // Flüssigkeit: Kugel bis zur Höhe entsprechend der Gesamtmenge (2 mol ≈ 70 % Füllung)
    const fill = clamp(total / 2, 0.05, 1) * 0.72;
    const level = cy + R - 2 * R * fill;
    ctx.save();
    ctx.beginPath(); ctx.arc(fx, cy, R - 2, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createLinearGradient(0, level, 0, cy + R);
    g.addColorStop(0, '#dcebf7'); g.addColorStop(1, '#bcd8ef');
    ctx.fillStyle = g; ctx.fillRect(fx - R, level, 2 * R, cy + R - level);
    const hw = Math.sqrt(Math.max(0, R * R - (level - cy) * (level - cy)));
    ctx.fillStyle = '#eef6fc'; ctx.beginPath(); ctx.ellipse(fx, level, hw, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7fb3dd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(fx, level, hw, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // Glas
    ctx.strokeStyle = '#8aa0b8'; ctx.lineWidth = 2;
    ctx.beginPath();
    const a0 = Math.asin(neckW / R);
    ctx.arc(fx, cy, R, -Math.PI / 2 + a0, Math.PI * 1.5 - a0);
    ctx.lineTo(fx - neckW, cy - R - neckH + 10);
    ctx.moveTo(fx + neckW, cy - Math.sqrt(R * R - neckW * neckW));
    ctx.lineTo(fx + neckW, cy - R - neckH + 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(fx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx, cy - R - neckH + 10, neckW, 3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3d4b5a'; ctx.font = `600 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Reaktionsgemisch', fx, base + 8);
    ctx.fillText(`${(total).toFixed(2).replace('.', ',')} mol gesamt`, fx, base + 24);
    // Mengenbalken rechts
    const bx0 = w * 0.4, bw = (w - bx0 - 12) / 4, barMax = clamp(h - 110, 60, 400), top = base - barMax;
    ctx.strokeStyle = '#e3e8ee'; ctx.lineWidth = 1;
    for (let v = 0; v <= 1.0001; v += 0.25) {
      const y = base - v * barMax;
      ctx.beginPath(); ctx.moveTo(bx0 - 6, y); ctx.lineTo(w - 10, y); ctx.stroke();
      ctx.fillStyle = '#66768a'; ctx.font = `11px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(v.toFixed(2).replace('.', ','), bx0 - 8, y);
    }
    ctx.fillStyle = '#66768a'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('mol', bx0 - 8, top - 10);
    n.forEach((v, i) => {
      const x = bx0 + i * bw + 6, ww = bw - 12, hh = clamp(v, 0, 1) * barMax;
      ctx.fillStyle = SUB[i].color; ctx.fillRect(x, base - hh, ww, hh);
      ctx.fillStyle = '#17212c'; ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(v.toFixed(2).replace('.', ','), x + ww / 2, base - hh - 3);
      ctx.font = `600 12px ${FONT}`; ctx.textBaseline = 'top';
      ctx.fillText(SUB[i].short, x + ww / 2, base + 6);
    });
    ctx.strokeStyle = '#66768a'; ctx.beginPath(); ctx.moveTo(bx0 - 6, base + 0.5); ctx.lineTo(w - 10, base + 0.5); ctx.stroke();
    // Reaktionsgleichung unter dem Ebenen-Etikett
    ctx.fillStyle = '#3d4b5a'; ctx.font = `600 ${clamp(w / 34, 11, 14)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('Ethansäure + Ethanol  ⇌  Ethansäureethylester + Wasser', 10, 40);
  };

  // ------------------------------------------------------------------ Teilchenebene
  function ParticleRenderer(canvas) { this.canvas = canvas; this.sys = null; }
  ParticleRenderer.prototype.setSystem = function (sys) { this.sys = sys; };
  ParticleRenderer.prototype.resize = function () { const { w, h } = setupCanvas(this.canvas); if (this.sys) this.sys.state.aspect = w / Math.max(1, h); };
  /** Ein Teilchen schematisch zeichnen (auch für die Legende). */
  function drawParticle(ctx, type, x, y, r) {
    if (type === 0) { ctx.fillStyle = SUB[0].color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f6d7cf'; ctx.beginPath(); ctx.arc(x + r * 0.55, y - r * 0.45, r * 0.42, 0, Math.PI * 2); ctx.fill(); }
    else if (type === 1) { ctx.fillStyle = SUB[1].color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fbe3cf'; ctx.beginPath(); ctx.arc(x - r * 0.55, y - r * 0.45, r * 0.42, 0, Math.PI * 2); ctx.fill(); }
    else if (type === 2) { ctx.fillStyle = SUB[0].color; ctx.beginPath(); ctx.arc(x - r * 0.55, y, r * 0.95, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = SUB[1].color; ctx.beginPath(); ctx.arc(x + r * 0.6, y, r * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#1f6fd1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.fillStyle = SUB[3].color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e6f3fc'; ctx.beginPath(); ctx.arc(x - r * 0.5, y + r * 0.4, r * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + r * 0.5, y + r * 0.4, r * 0.4, 0, Math.PI * 2); ctx.fill(); }
  }
  ParticleRenderer.prototype.draw = function () {
    const { ctx, w, h } = setupCanvas(this.canvas);
    ctx.clearRect(0, 0, w, h);
    if (!this.sys) return;
    const st = this.sys.state;
    st.aspect = w / Math.max(1, h);
    const R = this.sys.R;
    for (const p of st.parts) drawParticle(ctx, p.type, p.x * w, p.y * h, R[p.type] * w * 0.85);
    for (const e of st.events) {
      const f = this.sys.flash(e);
      if (f == null) continue;
      const cx = e.cx * w, cy = e.cy * h, rr = (10 + 26 * f);
      ctx.save(); ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(cx + Math.cos(a) * rr * 0.5, cy + Math.sin(a) * rr * 0.5); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.stroke(); ctx.restore();
    }
    // Zähler auf einem Streifen am unteren Rand
    const c = this.sys.counts();
    ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.fillRect(0, h - 26, w, 26);
    ctx.font = `700 13px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const txt = [`Säure ${c[0]}`, `Alkohol ${c[1]}`, `Ester ${c[2]}`, `Wasser ${c[3]}`];
    let x = 10;
    txt.forEach((t, i) => { ctx.fillStyle = SUB[i].color; ctx.fillText(t, x, h - 20); x += ctx.measureText(t).width + 14; });
  };

  (root.EG = root.EG || {}).render = { MatterRenderer, ParticleRenderer, drawParticle, SUB, COLORS };
})(typeof self !== 'undefined' ? self : this);
