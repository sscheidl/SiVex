/*
 * Apfelkrieg – Bühne (Canvas 2D)
 *
 * Zwei Wiesenfelder mit Zaun, links der Großvater, rechts der Enkel. Äpfel liegen als
 * einzelne Objekte auf den Feldern (Teilchenebene: zählbar, Zufall sichtbar). Ein Wurf
 * fliegt in einem Bogen über den Zaun. Die Bühne zeigt die Äpfel des Modells; Zahlen und
 * Entscheidungen kommen ausschließlich aus model.tick().
 */
(function (root) {
  'use strict';
  const { setupCanvas, FONT } = root.LK.chart;
  const { clamp, lerp } = root.LK.core;
  const FLIGHT = 0.45;   // Sekunden Modellzeit je Wurf
  const ARM = 0.35;      // Sekunden erhobener Arm
  const COL = { grass: '#cfe8b4', grass2: '#b9dc9a', fence: '#8d6a4b', apple: '#d8352b', apple2: '#f0634f', leaf: '#3f8f3b', stem: '#5b3d1e', text: '#17212c' };

  function StageRenderer(canvas, model) {
    this.canvas = canvas; this.model = model;
    this.apples = { opa: [], enkel: [] };   // {x, y} relativ (0…1) im Feld
    this.flights = [];                      // {from, to, t, x0, y0, x1, y1}
    this.arm = { opa: 0, enkel: 0 };
    this.rand = root.AK.model.rng(99);
    this.sync();
  }
  StageRenderer.prototype.resize = function () { setupCanvas(this.canvas); };
  StageRenderer.prototype.place = function () { return { x: 0.08 + this.rand() * 0.84, y: 0.2 + this.rand() * 0.72 }; };
  /** Bühne an die Modellzahlen angleichen (Start, Neustart, Laden). */
  StageRenderer.prototype.sync = function () {
    const s = this.model.state;
    this.flights = [];
    for (const side of ['opa', 'enkel']) {
      const n = side === 'opa' ? s.nOpa : s.nEnkel;
      const arr = this.apples[side];
      while (arr.length > n) arr.pop();
      while (arr.length < n) arr.push(this.place());
    }
  };
  /** Würfe eines Zeitschritts animieren. */
  StageRenderer.prototype.throwApples = function (toEnkel, toOpa) {
    const take = (from, to, k) => {
      for (let i = 0; i < k && this.apples[from].length; i++) {
        const idx = Math.floor(this.rand() * this.apples[from].length);
        const a = this.apples[from].splice(idx, 1)[0];
        const land = this.place();
        this.flights.push({ from, to, t: 0, x0: a.x, y0: a.y, x1: land.x, y1: land.y, delay: i * 0.08 });
        this.arm[from] = ARM;
      }
    };
    take('opa', 'enkel', toEnkel);
    take('enkel', 'opa', toOpa);
  };
  StageRenderer.prototype.advance = function (dt) {
    for (const f of this.flights) { if (f.delay > 0) f.delay -= dt; else f.t += dt; }
    const done = this.flights.filter((f) => f.t >= FLIGHT);
    for (const f of done) this.apples[f.to].push({ x: f.x1, y: f.y1 });
    this.flights = this.flights.filter((f) => f.t < FLIGHT);
    this.arm.opa = Math.max(0, this.arm.opa - dt); this.arm.enkel = Math.max(0, this.arm.enkel - dt);
  };

  StageRenderer.prototype.layout = function (w, h) {
    const top = 64, bottom = h - 46;
    const fieldH = bottom - top;
    const figW = clamp(w * 0.11, 54, 90);
    const fenceX = w / 2;
    return { top, bottom, fieldH, figW, fenceX, fields: { opa: { x: figW, w: fenceX - figW - 6 }, enkel: { x: fenceX + 6, w: w - figW - fenceX - 6 } } };
  };
  StageRenderer.prototype.draw = function () {
    const { ctx, w, h } = setupCanvas(this.canvas);
    const s = this.model.state;
    const L = this.layout(w, h);
    ctx.clearRect(0, 0, w, h);
    // Felder
    for (const side of ['opa', 'enkel']) {
      const f = L.fields[side];
      const g = ctx.createLinearGradient(0, L.top, 0, L.bottom);
      g.addColorStop(0, COL.grass); g.addColorStop(1, COL.grass2);
      ctx.fillStyle = g; ctx.fillRect(f.x, L.top, f.w, L.fieldH);
      ctx.strokeStyle = '#8fb877'; ctx.lineWidth = 1; ctx.strokeRect(f.x + 0.5, L.top + 0.5, f.w - 1, L.fieldH - 1);
    }
    // Zaun
    ctx.fillStyle = COL.fence;
    for (let y = L.top + 10; y < L.bottom; y += 22) ctx.fillRect(L.fenceX - 3, y, 6, 14);
    ctx.fillRect(L.fenceX - 9, L.top + 18, 18, 3); ctx.fillRect(L.fenceX - 9, L.bottom - 22, 18, 3);
    // Überschriften und Zahlen
    ctx.fillStyle = COL.text; ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('Feld des Großvaters', L.fields.opa.x + L.fields.opa.w / 2, L.top - 6);
    ctx.fillText('Feld des Enkels', L.fields.enkel.x + L.fields.enkel.w / 2, L.top - 6);
    ctx.font = `700 22px ${FONT}`; ctx.textBaseline = 'top';
    ctx.fillStyle = '#b4381f'; ctx.fillText(`${s.nOpa} Äpfel`, L.fields.opa.x + L.fields.opa.w / 2, L.bottom + 8);
    ctx.fillStyle = '#155bb0'; ctx.fillText(`${s.nEnkel} Äpfel`, L.fields.enkel.x + L.fields.enkel.w / 2, L.bottom + 8);
    // Figuren
    this.drawFigure(ctx, L.figW / 2, L.bottom - 8, L.figW, 'opa', this.arm.opa > 0);
    this.drawFigure(ctx, w - L.figW / 2, L.bottom - 8, L.figW, 'enkel', this.arm.enkel > 0);
    // Äpfel
    const r = clamp(Math.min(L.fields.opa.w, L.fieldH) / 22, 7, 12);
    for (const side of ['opa', 'enkel']) {
      const f = L.fields[side];
      for (const a of this.apples[side]) this.drawApple(ctx, f.x + a.x * f.w, L.top + a.y * L.fieldH, r);
    }
    for (const fl of this.flights) {
      if (fl.delay > 0) { const f = L.fields[fl.from]; this.drawApple(ctx, f.x + fl.x0 * f.w, L.top + fl.y0 * L.fieldH, r); continue; }
      const t = clamp(fl.t / FLIGHT, 0, 1);
      const f0 = L.fields[fl.from], f1 = L.fields[fl.to];
      const x = lerp(f0.x + fl.x0 * f0.w, f1.x + fl.x1 * f1.w, t);
      const y = lerp(L.top + fl.y0 * L.fieldH, L.top + fl.y1 * L.fieldH, t) - Math.sin(Math.PI * t) * L.fieldH * 0.55;
      this.drawApple(ctx, x, y, r * (1 + 0.25 * Math.sin(Math.PI * t)));
    }
  };
  StageRenderer.prototype.drawApple = function (ctx, x, y, r) {
    ctx.fillStyle = COL.apple; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.apple2; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COL.stem; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - r + 1); ctx.lineTo(x + r * 0.2, y - r - 4); ctx.stroke();
    ctx.fillStyle = COL.leaf; ctx.beginPath(); ctx.ellipse(x + r * 0.45, y - r - 2, r * 0.45, r * 0.22, -0.5, 0, Math.PI * 2); ctx.fill();
  };
  /** Einfache Figur: Großvater mit Hut und Stock, Enkel kleiner mit Kappe. Arm hebt sich beim Wurf. */
  StageRenderer.prototype.drawFigure = function (ctx, cx, baseY, w, who, throwing) {
    const big = who === 'opa';
    const hgt = big ? w * 1.25 : w * 0.95;
    const headR = w * 0.16;
    const shoulder = baseY - hgt + headR * 2.6;
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, w * 0.07); ctx.strokeStyle = big ? '#4a5868' : '#2a6fb8';
    // Beine
    ctx.beginPath(); ctx.moveTo(cx, baseY - hgt * 0.42); ctx.lineTo(cx - w * 0.14, baseY); ctx.moveTo(cx, baseY - hgt * 0.42); ctx.lineTo(cx + w * 0.14, baseY); ctx.stroke();
    // Körper
    ctx.beginPath(); ctx.moveTo(cx, shoulder); ctx.lineTo(cx, baseY - hgt * 0.42); ctx.stroke();
    // Arme: Wurfarm zum Zaun hin erhoben
    const dir = big ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(cx, shoulder + 4); ctx.lineTo(cx - dir * w * 0.22, shoulder + hgt * 0.22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, shoulder + 4);
    if (throwing) ctx.lineTo(cx + dir * w * 0.26, shoulder - hgt * 0.16); else ctx.lineTo(cx + dir * w * 0.2, shoulder + hgt * 0.2);
    ctx.stroke();
    // Kopf
    ctx.fillStyle = '#f2cfae'; ctx.beginPath(); ctx.arc(cx, shoulder - headR * 1.1, headR, 0, Math.PI * 2); ctx.fill();
    if (big) {
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(cx - headR * 1.4, shoulder - headR * 2.1, headR * 2.8, headR * 0.35);
      ctx.fillRect(cx - headR * 0.9, shoulder - headR * 2.9, headR * 1.8, headR * 0.9);
      ctx.strokeStyle = '#8d6a4b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - w * 0.22, shoulder + hgt * 0.22); ctx.lineTo(cx - w * 0.26, baseY); ctx.stroke();
    } else {
      ctx.fillStyle = '#e0392b'; ctx.beginPath(); ctx.arc(cx, shoulder - headR * 1.2, headR * 1.02, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - headR * 1.7, shoulder - headR * 1.25, headR * 1.8, headR * 0.3);
    }
    ctx.fillStyle = COL.text; ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(big ? 'Großvater' : 'Enkel', cx, baseY + 4);
  };

  (root.AK = root.AK || {}).render = { StageRenderer, FLIGHT };
})(typeof self !== 'undefined' ? self : this);
