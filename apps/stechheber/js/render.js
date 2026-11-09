/*
 * Stechheber – Laborbühne (Canvas 2D)
 *
 * Zwei Standzylinder A und B mit Skala, Flüssigkeit mit Meniskus (nach dem Vorbild von
 * TitraLab 3, vereinfacht), zwei Rohre a und b. Die Animation eines Zyklus besteht aus
 * fünf Phasen: eintauchen → heben → hinübertragen → ablassen → zurückkehren. Die Bühne
 * zeichnet ausschließlich aus dem Modellzustand und dem Animationsfortschritt; die
 * Volumina ändern sich erst, wenn die Oberfläche model.cycle() ruft.
 */
(function (root) {
  'use strict';
  const { core } = root.LK;
  const { setupCanvas } = root.LK.chart;
  const { clamp, lerp, easeInOut } = core;

  /** Phasen eines Zyklus mit Dauer in Sekunden Modellzeit (1×). */
  const PHASES = [
    { id: 'dip', dur: 0.7, label: 'Rohre eintauchen' },
    { id: 'lift', dur: 0.6, label: 'Rohre heben (Daumen drauf)' },
    { id: 'carry', dur: 0.7, label: 'Rohre tauschen' },
    { id: 'drain', dur: 0.7, label: 'Rohre ablassen' },
    { id: 'back', dur: 0.5, label: 'Rohre zurück' }
  ];
  const CYCLE_DUR = PHASES.reduce((s, p) => s + p.dur, 0);
  const GLASS = { fill: 'rgba(255,255,255,0.55)', edge: '#8aa0b8', edge2: '#5f7891' };
  const WATER = { body: '#9fd0f3', deep: '#6fb4ea', top: '#c9e6fa', line: '#3f8fd1' };

  function StageRenderer(canvas, model) {
    this.canvas = canvas; this.model = model;
    this.ctx = canvas.getContext('2d');
    this.anim = null; // { phase, t, a2b, b2a } während eines Zyklus
  }
  StageRenderer.prototype.resize = function () { setupCanvas(this.canvas); };

  /** Geometrie passend zur Zeichenfläche. */
  StageRenderer.prototype.layout = function (w, h) {
    const m = this.model;
    const cap = root.SH.model.LIMITS.capacity;
    const cylW = clamp(w * 0.19, 56, 110);
    const base = h - 58;                                   // Platz für Buchstabe und mL-Angabe
    // Rohre (Länge cylH + 24) stehen in Ruhe knapp über der Mündung; alles muss in die Höhe passen
    const cylH = clamp(Math.min(h * 0.5, (base - 24 - 14 - 22) / 2), 90, 420);
    const gap = clamp(w * 0.16, 36, 140);
    const xA = w / 2 - gap / 2 - cylW, xB = w / 2 + gap / 2;
    const tubeScale = cylW / m.state.D;                    // Pixel pro mm (Rohrbreiten maßstäblich zum Zylinder)
    const top = base - cylH;
    const restY = top - 14;                                // Ruhelage der Rohre (Unterkante)
    return { cap, cylW, cylH, base, top, xA, xB, tubeScale, restY, mlPx: cylH / cap, tubeLen: cylH + 24 };
  };

  StageRenderer.prototype.draw = function (dt) {
    const { ctx, w, h } = setupCanvas(this.canvas);
    const m = this.model, s = m.state;
    const L = this.layout(w, h);
    ctx.clearRect(0, 0, w, h);
    // Tisch
    ctx.fillStyle = '#d7dee6'; ctx.fillRect(0, L.base, w, h - L.base);
    ctx.fillStyle = '#b9c4d0'; ctx.fillRect(0, L.base, w, 3);

    // Animationszustand → sichtbare Volumina und Rohrpositionen
    let VA = s.VA, VB = s.VB, colA = 0, colB = 0; // Säulenvolumen in den Rohren a, b
    let ya = L.restY, yb = L.restY;             // Unterkante der Rohre
    let xa = L.xA + L.cylW / 2, xb = L.xB + L.cylW / 2;
    let phase = null, label = '';
    if (this.anim) {
      const A = this.anim, ph = PHASES[A.phase], t = easeInOut(clamp(A.t / ph.dur, 0, 1));
      phase = ph.id; label = ph.label;
      const hA = s.VA * L.mlPx, hB = s.VB * L.mlPx;
      const dipA = L.base - 6, dipB = L.base - 6;
      if (phase === 'dip') { ya = lerp(L.restY, dipA, t); yb = lerp(L.restY, dipB, t); colA = Math.max(0, Math.min(hA, L.base - 6 - ya)) / L.mlPx * m.fA; colB = Math.max(0, Math.min(hB, L.base - 6 - yb)) / L.mlPx * m.fB; }
      else if (phase === 'lift') { ya = lerp(dipA, L.restY, t); yb = lerp(dipB, L.restY, t); colA = A.a2b; colB = A.b2a; VA = s.VA - A.a2b * t; VB = s.VB - A.b2a * t; }
      else if (phase === 'carry') { xa = lerp(L.xA + L.cylW / 2, L.xB + L.cylW / 2, t); xb = lerp(L.xB + L.cylW / 2, L.xA + L.cylW / 2, t); colA = A.a2b; colB = A.b2a; VA = s.VA - A.a2b; VB = s.VB - A.b2a; }
      else if (phase === 'drain') { xa = L.xB + L.cylW / 2; xb = L.xA + L.cylW / 2; colA = A.a2b * (1 - t); colB = A.b2a * (1 - t); VA = s.VA - A.a2b + A.b2a * t; VB = s.VB - A.b2a + A.a2b * t; }
      else if (phase === 'back') { xa = lerp(L.xB + L.cylW / 2, L.xA + L.cylW / 2, t); xb = lerp(L.xA + L.cylW / 2, L.xB + L.cylW / 2, t); } // Modell ist nach dem Ablassen schon fortgeschrieben
    }

    this.drawCylinder(ctx, L, L.xA, VA, 'A', 'Zylinder A');
    this.drawCylinder(ctx, L, L.xB, VB, 'B', 'Zylinder B');
    // Tauschpfeile (gestrichelt) während des Tragens
    if (phase === 'carry' || phase === 'drain') {
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = '#66768a'; ctx.lineWidth = 1.4;
      const y = L.restY - 26;
      ctx.beginPath(); ctx.moveTo(L.xA + L.cylW / 2, y); ctx.quadraticCurveTo(w / 2, y - 40, L.xB + L.cylW / 2, y); ctx.stroke();
      ctx.restore();
    }
    // Ablass-Strahl
    if (phase === 'drain') {
      const tA = this.anim.t / PHASES[3].dur;
      if (this.anim.a2b > 0.05 && tA < 0.95) this.drawStream(ctx, xa, ya, L.base - 4 - VB * L.mlPx, Math.min(1, this.anim.a2b / 10));
      if (this.anim.b2a > 0.05 && tA < 0.95) this.drawStream(ctx, xb, yb, L.base - 4 - VA * L.mlPx, Math.min(1, this.anim.b2a / 10));
    }
    this.drawTube(ctx, L, xa, ya, s.dA, colA, 'a');
    this.drawTube(ctx, L, xb, yb, s.dB, colB, 'b');

    return { phase, label: label || (s.cycle ? `Zyklus ${s.cycle} abgeschlossen` : 'Bereit – „Zyklus“ oder „Start“ drücken') };
  };

  StageRenderer.prototype.drawCylinder = function (ctx, L, x, V, letter, aria) {
    const { cylW, cylH, base, top, mlPx, cap } = L;
    const hL = clamp(V, 0, cap) * mlPx;
    // Glaskörper
    ctx.fillStyle = GLASS.fill; ctx.fillRect(x, top, cylW, cylH);
    // Flüssigkeit
    if (hL > 0.5) {
      const y = base - hL;
      const g = ctx.createLinearGradient(0, y, 0, base);
      g.addColorStop(0, WATER.body); g.addColorStop(1, WATER.deep);
      ctx.fillStyle = g; ctx.fillRect(x + 1.5, y, cylW - 3, hL);
      // Meniskus: Ellipse an der Oberfläche
      ctx.fillStyle = WATER.top;
      ctx.beginPath(); ctx.ellipse(x + cylW / 2, y, cylW / 2 - 1.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = WATER.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x + cylW / 2, y, cylW / 2 - 1.5, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // Skala (alle 20 mL, Zahlen alle 40 mL)
    ctx.strokeStyle = GLASS.edge2; ctx.fillStyle = '#3d4b5a'; ctx.lineWidth = 1;
    ctx.font = `11px ${root.LK.chart.FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let v = 10; v <= cap; v += 10) {
      const y = base - v * mlPx;
      const long = v % 20 === 0;
      ctx.beginPath(); ctx.moveTo(x + cylW - (long ? 14 : 8), y); ctx.lineTo(x + cylW, y); ctx.stroke();
      if (long) ctx.fillText(String(v), x + cylW + 3, y);
    }
    // Glasrand
    ctx.strokeStyle = GLASS.edge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, top - 2); ctx.lineTo(x, base); ctx.lineTo(x + cylW, base); ctx.lineTo(x + cylW, top - 2); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = GLASS.edge2;
    ctx.beginPath(); ctx.ellipse(x + cylW / 2, top - 2, cylW / 2, 3, 0, Math.PI, 0); ctx.stroke();
    // Fuß und Buchstabe
    ctx.fillStyle = '#c6d0db'; ctx.fillRect(x - 8, base - 4, cylW + 16, 5);
    ctx.fillStyle = '#17212c'; ctx.font = `700 18px ${root.LK.chart.FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(letter, x + cylW / 2, base + 8);
    ctx.font = `13px ${root.LK.chart.FONT}`; ctx.fillStyle = '#3d4b5a';
    ctx.fillText(core.fmt(V, 1) + ' mL', x + cylW / 2, base + 8 + 20);
  };

  StageRenderer.prototype.drawTube = function (ctx, L, x, yBottom, dMM, colV, letter) {
    const w = Math.max(6, dMM * L.tubeScale);
    const len = L.tubeLen;
    const yTop = yBottom - len;
    ctx.fillStyle = GLASS.fill; ctx.fillRect(x - w / 2, yTop, w, len);
    if (colV > 0.01) {
      // Säulenhöhe: Volumen in mL geteilt durch Rohrquerschnitt (relativ zum Zylinder)
      const hCol = Math.min(len - 4, colV / root.SH.model.frac(dMM, this.model.state.D) * L.mlPx);
      ctx.fillStyle = WATER.body; ctx.fillRect(x - w / 2 + 1, yBottom - hCol, w - 2, hCol);
      ctx.fillStyle = WATER.top; ctx.fillRect(x - w / 2 + 1, yBottom - hCol, w - 2, 2);
    }
    ctx.strokeStyle = GLASS.edge; ctx.lineWidth = 1.6;
    ctx.strokeRect(x - w / 2, yTop, w, len);
    ctx.fillStyle = '#17212c'; ctx.font = `700 15px ${root.LK.chart.FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(letter, x, yTop - 4);
  };

  StageRenderer.prototype.drawStream = function (ctx, x, y1, y2, strength) {
    if (y2 <= y1) return;
    ctx.fillStyle = 'rgba(111,180,234,0.75)';
    const w = 2 + 4 * strength;
    ctx.fillRect(x - w / 2, y1, w, y2 - y1);
  };

  /** Animation um dt Sekunden Modellzeit fortschreiben; ruft onCycle(), wenn ein Zyklus endet. */
  StageRenderer.prototype.advance = function (dt, onCycle) {
    if (!this.anim) return false;
    this.anim.t += dt;
    while (this.anim && this.anim.t >= PHASES[this.anim.phase].dur) {
      this.anim.t -= PHASES[this.anim.phase].dur;
      if (this.anim.phase === 3) onCycle(this.anim); // nach dem Ablassen gilt der neue Stand
      this.anim.phase++;
      if (this.anim.phase >= PHASES.length) { this.anim = null; return true; }
    }
    return false;
  };
  StageRenderer.prototype.startCycle = function () {
    if (this.anim) return false;
    const p = this.model.preview();
    this.anim = { phase: 0, t: 0, a2b: p.a2b, b2a: p.b2a };
    return true;
  };
  StageRenderer.prototype.get = function () { return this.anim; };

  (root.SH = root.SH || {}).render = { StageRenderer, PHASES, CYCLE_DUR };
})(typeof self !== 'undefined' ? self : this);
