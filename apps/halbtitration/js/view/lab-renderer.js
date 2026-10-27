/*
 * Laborgrafik (Canvas 2D) – übernommen aus TitraLab 3 (lab-renderer.js),
 * auf die helle SiVex-Oberfläche umgestellt und um Vorbereitung,
 * Kalibrierung, Elektrodenbewegung und Zielmarke erweitert.
 *
 * Stativ, Bürette mit Schellbachstreifen und Meniskus, Hahn, Tropfen,
 * Erlenmeyerkolben mit Flüssigkeit, Magnetrührer, pH-Elektrode mit
 * Messgerät und Ablese-Lupe.
 *
 * Alle chemisch relevanten Größen (Füllstände, Farbe, Schlieren,
 * pH-Anzeige) kommen ausschließlich aus dem Lab-Objekt bzw. dem
 * chemischen Modell. Oberflächenimpulse entstehen nur durch landende
 * Tropfen und den laufenden Rührer; ruhende Flüssigkeit bleibt glatt.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});
  const G = NS.Geometry;
  const L = G.LAYOUT;
  const B = L.burette;
  const Ind = NS.Indicators;
  const Chem = NS.Chemistry;
  const fmt = NS.Format.fmt;

  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const MONO = '"Cascadia Mono", "SF Mono", Menlo, Consolas, monospace';
  const VIEW_BOX = { x0: 140, y0: 0, x1: 950, y1: 1000 };
  const GRAVITY = 2600;
  const WAVE_N = 48;
  const INDICATOR_STRENGTH = 2.2;
  const GLASS = 'rgba(70,100,132,0.62)';
  const GLASS_IN = 'rgba(70,100,132,0.24)';
  const INK = '#1f2f40';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a.toFixed(3) + ')';
  }

  class LabRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.bg = document.createElement('canvas');
      this.lab = null;
      this.opts = { magnifier: true, labels: null, targetReading: null };
      this.view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 1, h: 1 };

      this.time = 0;
      this.valveAngle = 0;
      this.stirAngle = 0;
      this.stirSpeed = 0;
      this.electrodePos = 0; // 0 = oben (Halter), 1 = eingetaucht
      this.waveH = new Float32Array(WAVE_N);
      this.waveV = new Float32Array(WAVE_N);
      this.rings = [];
      this.splashes = [];
      this.plumes = [];
      this.taps = [];
      this.color = null;
      this.levelShown = 0;

      this.reduceMotion = false;
      const self = this;
      try {
        const mq = global.matchMedia('(prefers-reduced-motion: reduce)');
        this.reduceMotion = mq.matches;
        const onChange = function (e) { self.reduceMotion = e.matches; };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
      } catch (e) { /* matchMedia nicht verfügbar */ }
    }

    setLab(lab) {
      this.lab = lab;
      this.plumes = [];
      this.rings = [];
      this.splashes = [];
      this.color = null;
      this.waveH.fill(0);
      this.waveV.fill(0);
      this.levelShown = lab.liquidVolume;
      this.electrodePos = lab.electrodeIn ? 1 : 0;
      // Je Lab-Objekt nur ein Listener (setLab wird bei jeder neuen Probe erneut aufgerufen)
      if (!this._bound) this._bound = new WeakSet();
      if (!this._bound.has(lab)) {
        this._bound.add(lab);
        const self = this;
        lab.on('drop-landed', function (e) { if (self.lab === lab) self._onDropLanded(e); });
      }
    }

    setOptions(o) { Object.assign(this.opts, o); }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (w === this.view.w && h === this.view.h && dpr === this.view.dpr) return;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      const vbW = VIEW_BOX.x1 - VIEW_BOX.x0;
      const vbH = VIEW_BOX.y1 - VIEW_BOX.y0;
      const scale = Math.min(w / vbW, h / vbH);
      this.view = { scale: scale, dpr: dpr, w: w, h: h, ox: (w - vbW * scale) / 2 - VIEW_BOX.x0 * scale, oy: (h - vbH * scale) / 2 - VIEW_BOX.y0 * scale };
      this._renderBackground();
    }

    toWorld(px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    }

    /** Weltkoordinaten → CSS-Pixel relativ zur Canvas (für Tests und Hinweise) */
    toScreen(x, y) {
      const v = this.view;
      return { x: x * v.scale + v.ox, y: y * v.scale + v.oy };
    }

    hitTest(px, py) {
      const p = this.toWorld(px, py);
      const dxs = p.x - B.x;
      const dys = p.y - B.stopcockY;
      if (dxs * dxs + dys * dys < 52 * 52) return 'stopcock';
      const st = L.stirrer;
      if (p.x > st.x - st.halfWidth && p.x < st.x + st.halfWidth && p.y > st.top + 14 && p.y < st.top + st.height) return 'stirrer';
      return null;
    }

    tapFeedback(kind) {
      if (kind === 'stopcock') this.taps.push({ x: B.x, y: B.stopcockY, age: 0 });
    }

    // ---------- Effekte ----------

    _surfaceY() { return G.flaskSurfaceY(Math.max(0.01, this.levelShown)); }

    _onDropLanded(e) {
      const surfaceY = this._surfaceY();
      const halfW = G.flaskInnerHalfWidth(surfaceY);
      const x = B.x + (this.reduceMotion ? 0 : (e.x || 0) * 6);
      if (this.lab.indicator && this.lab.indicator !== 'none') {
        this.plumes.push({ x0: x, y0: surfaceY + 2, age: 0, vol: e.vol, phase: Math.random() * Math.PI * 2, drift: this.reduceMotion ? 0 : Math.random() - 0.5, vBulk: this.lab.delivered - e.vol });
        if (this.plumes.length > 50) this.plumes.shift();
      }
      if (this.reduceMotion) return;
      const idx = clamp(Math.round(((x - (B.x - halfW)) / (2 * halfW)) * (WAVE_N - 1)), 1, WAVE_N - 2);
      this._impulse(idx, 22 * Math.sqrt(e.vol / 0.05));
      this.rings.push({ x: x, age: 0, life: 0.9 });
      const n = e.vol > 0.03 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        this.splashes.push({ x: x, y: surfaceY, vx: (Math.random() - 0.5) * 90, vy: -120 - Math.random() * 90, age: 0, life: 0.35 });
      }
    }

    _impulse(idx, strength) {
      for (let k = -4; k <= 4; k++) {
        const i = idx + k;
        if (i < 0 || i >= WAVE_N) continue;
        this.waveV[i] += strength * Math.exp(-(k * k) / 4);
      }
    }

    _update(dt) {
      const lab = this.lab;
      this.time += dt;
      const sdtLab = dt * (lab ? lab.timeScale : 1);
      const targetAngle = lab ? lab.valveOpening * (Math.PI / 2) : 0;
      this.valveAngle = lerp(this.valveAngle, targetAngle, 1 - Math.exp(-dt * 14));
      const targetStir = lab && lab.stirrer ? 1 : 0;
      this.stirSpeed = lerp(this.stirSpeed, targetStir, 1 - Math.exp(-sdtLab * 1.8));
      if (!this.reduceMotion) this.stirAngle += this.stirSpeed * 15 * dt;
      if (!lab) return;

      this.electrodePos = lerp(this.electrodePos, lab.electrodeIn ? 1 : 0, 1 - Math.exp(-sdtLab * 4));
      if (Math.abs(this.electrodePos - (lab.electrodeIn ? 1 : 0)) < 0.002) this.electrodePos = lab.electrodeIn ? 1 : 0;
      // Füllstand: folgt dem Volumen (Pipettieren ist im Modell bereits zeitlich aufgelöst)
      this.levelShown = lab.liquidVolume;

      const surfaceY = this._surfaceY();
      const fallDist = Math.max(20, surfaceY - (B.tipEndY + 6));
      lab.fallTime = Math.sqrt((2 * fallDist) / GRAVITY);

      // Oberflächenwellen: gedämpfte 1D-Wellengleichung, angeregt nur durch Tropfen und Rührer
      const h = this.waveH;
      const v = this.waveV;
      const sub = Math.max(3, Math.ceil(dt / 0.004));
      const sdt = dt / sub;
      for (let s = 0; s < sub; s++) {
        for (let i = 0; i < WAVE_N; i++) {
          const l = h[i > 0 ? i - 1 : 1];
          const r = h[i < WAVE_N - 1 ? i + 1 : WAVE_N - 2];
          const vl = v[i > 0 ? i - 1 : 1];
          const vr = v[i < WAVE_N - 1 ? i + 1 : WAVE_N - 2];
          const acc = 1800 * (l + r - 2 * h[i]) + 40 * (vl + vr - 2 * v[i]) - 3.5 * v[i] - 40 * h[i];
          v[i] += acc * sdt;
        }
        for (let i = 0; i < WAVE_N; i++) {
          v[i] = clamp(v[i], -160, 160);
          h[i] = clamp(h[i] + v[i] * sdt, -5, 5);
        }
      }
      if (!this.reduceMotion && this.stirSpeed > 0.2 && lab.liquidVolume > 1 && Math.random() < dt * 5) {
        this._impulse(4 + Math.floor(Math.random() * (WAVE_N - 8)), (Math.random() - 0.5) * 6 * this.stirSpeed);
      }

      const target = this._bulkColor();
      if (!this.color) this.color = target.slice();
      const k = 1 - Math.exp(-sdtLab / (lab.stirrer ? 0.3 : 3));
      for (let i = 0; i < 4; i++) this.color[i] = lerp(this.color[i], target[i], k);

      this.rings = this.rings.filter(function (r) { r.age += dt; return r.age < r.life; });
      this.splashes = this.splashes.filter(function (p) {
        p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += GRAVITY * 0.6 * dt;
        return p.age < p.life;
      });
      const mixTau = lab.stirrer ? lab.mixTauStirred / 3 : lab.mixTauStill / 8;
      const vTot = lab.liquidVolume;
      this.plumes = this.plumes.filter(function (p) {
        p.age += sdtLab;
        p.mixed = 0.12 * Math.exp(Math.min(p.age / mixTau, 30));
        return p.mixed < vTot * 0.8 && p.age < (lab.stirrer ? 14 : 120);
      });
      this.taps = this.taps.filter(function (t) { t.age += dt; return t.age < 0.6; });
    }

    _indicatorConc() {
      const lab = this.lab;
      const v0 = lab.exp.vSample + lab.exp.vWater;
      return (INDICATOR_STRENGTH * v0) / Math.max(1, lab.liquidVolume);
    }

    _bulkColor() {
      const lab = this.lab;
      if (!lab.indicator || lab.indicator === 'none' || lab.liquidVolume < 0.5) return this._liquidRGBA(null);
      return this._liquidRGBA(Ind.solutionColor(lab.indicator, lab.bulkState.pH, this._indicatorConc()));
    }

    _liquidRGBA(c) {
      if (!c) return [196, 220, 242, 0.34];
      const s = clamp(c.strength, 0, 2);
      const tint = clamp(s * 3, 0, 1);
      return [lerp(196, c.r, tint), lerp(220, c.g, tint), lerp(242, c.b, tint), 0.34 + 0.56 * clamp(s * 1.8, 0, 1)];
    }

    // ---------- Zeichnen ----------

    frame(dt) {
      this.resize();
      this._update(dt);
      const ctx = this.ctx;
      const v = this.view;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this.bg, 0, 0);
      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      if (!this.lab) return;
      this._drawElectrodeArm(ctx);
      this._drawStirrer(ctx);
      this._drawFlask(ctx);
      this._drawBurette(ctx, false);
      this._drawClamp(ctx);
      this._drawStopcock(ctx);
      this._drawDrops(ctx);
      this._drawMeter(ctx);
      if (this.opts.labels) this._drawLabels(ctx);
      if (this.opts.magnifier && this.lab.burette.filled) this._drawLens(ctx);
      this._drawTaps(ctx);
    }

    _renderBackground() {
      const v = this.view;
      const c = this.bg;
      c.width = this.canvas.width;
      c.height = this.canvas.height;
      const ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const W = c.width;
      const H = c.height;
      const wall = ctx.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#f5f8fa');
      wall.addColorStop(1, '#e7edf2');
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, W, H);

      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      const wx0 = -v.ox / v.scale;
      const wx1 = (v.w - v.ox) / v.scale;
      const wy0 = -v.oy / v.scale;
      const wy1 = (v.h - v.oy) / v.scale;

      // Fliesen
      ctx.strokeStyle = 'rgba(40,70,100,0.06)';
      ctx.lineWidth = 1;
      for (let x = Math.floor(wx0 / 70) * 70; x < wx1; x += 70) { ctx.beginPath(); ctx.moveTo(x, wy0); ctx.lineTo(x, L.benchY); ctx.stroke(); }
      for (let y = Math.floor(wy0 / 70) * 70; y < L.benchY; y += 70) { ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke(); }

      // Laborbank
      const bench = ctx.createLinearGradient(0, L.benchY, 0, wy1);
      bench.addColorStop(0, '#d5dde4');
      bench.addColorStop(0.05, '#c3ccd5');
      bench.addColorStop(1, '#aab5c0');
      ctx.fillStyle = bench;
      ctx.fillRect(wx0, L.benchY, wx1 - wx0, wy1 - L.benchY);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(wx0, L.benchY, wx1 - wx0, 1.5);

      this._shadow(ctx, L.stirrer.x, L.benchY + 3, 190, 14, 0.22);
      this._shadow(ctx, (L.meter.x0 + L.meter.x1) / 2, L.benchY + 3, 120, 10, 0.2);
      this._shadow(ctx, (L.stand.baseX0 + L.stand.baseX1) / 2, L.benchY + 2, 140, 8, 0.22);

      const s = L.stand;
      const plate = ctx.createLinearGradient(0, L.benchY - 16, 0, L.benchY);
      plate.addColorStop(0, '#5d6875');
      plate.addColorStop(0.3, '#3b444f');
      plate.addColorStop(1, '#262c34');
      ctx.fillStyle = plate;
      roundRect(ctx, s.baseX0, L.benchY - 15, s.baseX1 - s.baseX0, 15, 4);
      ctx.fill();
      const rod = ctx.createLinearGradient(s.rodX - 6, 0, s.rodX + 6, 0);
      rod.addColorStop(0, '#6a737f');
      rod.addColorStop(0.35, '#eef2f6');
      rod.addColorStop(0.55, '#a3adb8');
      rod.addColorStop(1, '#4a525c');
      ctx.fillStyle = rod;
      ctx.fillRect(s.rodX - 6, s.rodTop, 12, L.benchY - 15 - s.rodTop);
      ctx.fillStyle = '#b9c2cc';
      roundRect(ctx, s.rodX - 7, s.rodTop - 4, 14, 8, 3);
      ctx.fill();

      const cy = L.clampY;
      const arm = ctx.createLinearGradient(0, cy - 5, 0, cy + 5);
      arm.addColorStop(0, '#e3e8ee');
      arm.addColorStop(0.5, '#97a1ad');
      arm.addColorStop(1, '#56606b');
      ctx.fillStyle = arm;
      ctx.fillRect(s.rodX, cy - 4.5, B.x - 22 - s.rodX, 9);
      const boss = ctx.createLinearGradient(s.rodX - 16, 0, s.rodX + 16, 0);
      boss.addColorStop(0, '#323943');
      boss.addColorStop(0.4, '#66707e');
      boss.addColorStop(1, '#2a3038');
      ctx.fillStyle = boss;
      roundRect(ctx, s.rodX - 15, cy - 17, 30, 34, 5);
      ctx.fill();
      ctx.fillStyle = '#1f242b';
      ctx.beginPath(); ctx.arc(s.rodX - 22, cy, 6, 0, Math.PI * 2); ctx.fill();
    }

    _shadow(ctx, x, y, rx, ry, a) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, 'rgba(20,35,50,' + a + ')');
      g.addColorStop(1, 'rgba(20,35,50,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ---------- Bürette ----------

    _drawBurette(ctx, detail) {
      const x = B.x;
      const ih = B.innerHalf;
      const oh = ih + B.wall;
      const bur = this.lab.burette;
      const filled = bur.filled;
      const yM = filled ? G.buretteY(bur.reading) : B.stopcockY - 14;
      const yBottom = B.stopcockY - 14;

      // Schellbachstreifen
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(x - 5.5, B.top + 4, 11, yBottom - B.top - 4);

      if (filled) {
        const liq = ctx.createLinearGradient(x - ih, 0, x + ih, 0);
        liq.addColorStop(0, 'rgba(110,160,215,0.45)');
        liq.addColorStop(0.3, 'rgba(170,205,240,0.22)');
        liq.addColorStop(0.7, 'rgba(170,205,240,0.18)');
        liq.addColorStop(1, 'rgba(100,150,210,0.45)');
        ctx.fillStyle = liq;
        const men = detail ? 3.2 : 3.6;
        ctx.beginPath();
        ctx.moveTo(x - ih, yM - men);
        ctx.bezierCurveTo(x - ih, yM - 0.3, x - ih * 0.45, yM, x, yM);
        ctx.bezierCurveTo(x + ih * 0.45, yM, x + ih, yM - 0.3, x + ih, yM - men);
        ctx.lineTo(x + ih, yBottom);
        ctx.lineTo(x - ih, yBottom);
        ctx.closePath();
        ctx.fill();
        // Schellbach-Streifen: in der Flüssigkeit breiter, Pfeilspitzen am Meniskus
        ctx.fillStyle = '#1f4fd1';
        ctx.fillRect(x - 0.8, B.top + 4, 1.6, Math.max(0, yM - 7 - B.top - 4));
        ctx.fillRect(x - 1.5, yM + 7, 3, Math.max(0, yBottom - yM - 7));
        ctx.beginPath();
        ctx.moveTo(x - 1.5, yM + 7); ctx.lineTo(x + 1.5, yM + 7); ctx.lineTo(x + 0.15, yM); ctx.lineTo(x - 0.15, yM);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 0.8, yM - 7); ctx.lineTo(x + 0.8, yM - 7); ctx.lineTo(x + 0.15, yM); ctx.lineTo(x - 0.15, yM);
        ctx.closePath(); ctx.fill();
        ctx.lineWidth = detail ? 0.7 : 1.1;
        ctx.strokeStyle = 'rgba(10,25,45,0.85)';
        ctx.beginPath();
        ctx.moveTo(x - ih, yM - men);
        ctx.bezierCurveTo(x - ih, yM - 0.3, x - ih * 0.45, yM, x, yM);
        ctx.bezierCurveTo(x + ih * 0.45, yM, x + ih, yM - 0.3, x + ih, yM - men);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#1f4fd1';
        ctx.fillRect(x - 0.8, B.top + 4, 1.6, yBottom - B.top - 4);
      }

      // Glasrohr
      const glass = ctx.createLinearGradient(x - oh, 0, x + oh, 0);
      glass.addColorStop(0, 'rgba(120,160,200,0.22)');
      glass.addColorStop(0.15, 'rgba(255,255,255,0.10)');
      glass.addColorStop(0.85, 'rgba(255,255,255,0.08)');
      glass.addColorStop(1, 'rgba(120,160,200,0.20)');
      ctx.fillStyle = glass;
      ctx.fillRect(x - oh, B.top, 2 * oh, yBottom - B.top);
      ctx.strokeStyle = GLASS;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - oh, B.top); ctx.lineTo(x - oh, yBottom);
      ctx.moveTo(x + oh, B.top); ctx.lineTo(x + oh, yBottom);
      ctx.stroke();
      ctx.strokeStyle = GLASS_IN;
      ctx.beginPath();
      ctx.moveTo(x - ih, B.top + 2); ctx.lineTo(x - ih, yBottom);
      ctx.moveTo(x + ih, B.top + 2); ctx.lineTo(x + ih, yBottom);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x - oh + 3, B.top, 2.2, yBottom - B.top);
      ctx.strokeStyle = GLASS;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, B.top, oh, 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();

      this._drawScale(ctx, detail);
      if (!detail) this._drawTarget(ctx);
    }

    _drawScale(ctx, detail) {
      const x = B.x;
      const ih = B.innerHalf;
      const px = this.view.scale * (detail ? L.lens.zoom : 1);
      const showTenth = detail || B.mlPx * 0.1 * px > 2.6;
      ctx.strokeStyle = 'rgba(20,32,46,0.9)';
      for (let i = 0; i <= 500; i++) {
        const y = B.zeroY + (i / 10) * B.mlPx;
        let len;
        if (i % 10 === 0) len = 2 * ih;
        else if (i % 5 === 0) len = ih * 1.25;
        else if (showTenth) len = ih * 0.7;
        else continue;
        ctx.lineWidth = i % 10 === 0 ? (detail ? 0.45 : 0.9) : (detail ? 0.3 : 0.6);
        ctx.beginPath();
        ctx.moveTo(x - ih, y);
        ctx.lineTo(x - ih + len, y);
        ctx.stroke();
      }
      ctx.fillStyle = INK;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      const step = detail ? 1 : 5;
      ctx.font = (detail ? '600 4.6px ' : '600 14px ') + FONT;
      for (let ml = 0; ml <= 50; ml += step) ctx.fillText(String(ml), x - ih - (detail ? 5 : 8), B.zeroY + ml * B.mlPx);
      if (!detail) {
        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = '#4a5866';
        ctx.fillText('mL', x - ih - 8, B.zeroY - 15);
        ctx.save();
        ctx.translate(x + ih + 12, B.zeroY + 150);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = '500 10.5px ' + FONT;
        ctx.fillStyle = '#5d6b78';
        ctx.fillText('50 mL  ·  Klasse AS  ·  20 °C', 0, 0);
        ctx.restore();
      }
    }

    /** Eigene Zielmarke der Lernenden (Arbeitsmittel für die Halbtitration) */
    _drawTarget(ctx) {
      const t = this.opts.targetReading;
      if (!Number.isFinite(t) || t < 0 || t > 50) return;
      const y = G.buretteY(t);
      const x = B.x - B.innerHalf - B.wall - 34;
      ctx.save();
      ctx.fillStyle = '#d26a00';
      ctx.beginPath();
      ctx.moveTo(x + 22, y); ctx.lineTo(x + 12, y - 6); ctx.lineTo(x + 12, y + 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d26a00';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(B.x + B.innerHalf, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '700 11px ' + FONT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('Ziel', x + 10, y);
      ctx.restore();
    }

    _drawStopcock(ctx) {
      const x = B.x;
      const y = B.stopcockY;
      const ih = B.innerHalf;
      const oh = ih + B.wall;
      const yTop = y - 14;
      const lab = this.lab;
      const filled = lab.burette.filled;

      ctx.fillStyle = filled ? 'rgba(150,190,235,0.35)' : 'rgba(200,220,240,0.18)';
      ctx.beginPath();
      ctx.moveTo(x - ih, yTop); ctx.lineTo(x + ih, yTop); ctx.lineTo(x + 4, y - 4); ctx.lineTo(x - 4, y - 4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = GLASS;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - oh, yTop); ctx.lineTo(x - 7, y - 6);
      ctx.moveTo(x + oh, yTop); ctx.lineTo(x + 7, y - 6);
      ctx.stroke();

      const t0 = B.tipStartY;
      const t1 = B.tipEndY;
      ctx.fillStyle = filled ? 'rgba(150,190,235,0.38)' : 'rgba(200,220,240,0.18)';
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 8); ctx.lineTo(x + 5, y + 8); ctx.lineTo(x + 5, t0); ctx.lineTo(x + 1.6, t1); ctx.lineTo(x - 1.6, t1); ctx.lineTo(x - 5, t0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = GLASS;
      ctx.stroke();
      // Luftblase in der Spitze (vor dem Entlüften)
      if (filled && lab.burette.bubble) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(60,90,120,0.8)';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(x, y + 22, 3.4, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }

      const body = ctx.createLinearGradient(0, y - 11, 0, y + 11);
      body.addColorStop(0, 'rgba(235,245,255,0.75)');
      body.addColorStop(0.45, 'rgba(160,195,230,0.30)');
      body.addColorStop(1, 'rgba(210,228,248,0.7)');
      ctx.fillStyle = body;
      roundRect(ctx, x - 30, y - 10, 60, 20, 9);
      ctx.fill();
      ctx.strokeStyle = GLASS;
      ctx.stroke();
      if (lab.isFlowing) {
        ctx.fillStyle = 'rgba(120,170,230,0.7)';
        ctx.fillRect(x - 2, y - 10, 4, 20);
      }

      ctx.save();
      ctx.translate(x, y);
      const key = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
      key.addColorStop(0, '#ffffff');
      key.addColorStop(1, '#b8c4cf');
      ctx.fillStyle = key;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(this.valveAngle);
      const grip = ctx.createLinearGradient(0, -7, 0, 7);
      grip.addColorStop(0, '#6fa8ff');
      grip.addColorStop(0.5, '#2d6be3');
      grip.addColorStop(1, '#1b3f99');
      ctx.fillStyle = grip;
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      roundRect(ctx, -52, -7, 56, 14, 7);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      roundRect(ctx, -48, -5.5, 46, 3, 1.5);
      ctx.fill();
      ctx.fillStyle = '#e8f0ff';
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b3f99';
      ctx.fillRect(-1, -3.5, 2, 7);
      ctx.restore();

      const hv = lab.hanging;
      if (hv > 1e-5) {
        const r = 19 * Math.cbrt(hv);
        this._drawDrop(ctx, x, t1 + r * 0.92, r, 1 + 0.12 * (r / 7));
      }
    }

    _drawDrop(ctx, x, y, r, stretch) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, stretch || 1);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35, 'rgba(180,212,245,0.55)');
      g.addColorStop(1, 'rgba(80,130,200,0.7)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(60,100,150,0.6)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }

    _drawDrops(ctx) {
      const lab = this.lab;
      const x = B.x;
      const surfaceY = this._surfaceY();
      const y0 = B.tipEndY + 6;
      const q = lab.currentFlow * lab.timeScale;
      if (q > 0.3 && lab.isFlowing) {
        const w = 0.8 + Math.min(q, 1.5) * 1.6;
        const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
        g.addColorStop(0, 'rgba(110,160,220,0.45)');
        g.addColorStop(0.5, 'rgba(210,230,255,0.7)');
        g.addColorStop(1, 'rgba(110,160,220,0.45)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 1.6, B.tipEndY); ctx.lineTo(x + 1.6, B.tipEndY); ctx.lineTo(x + w * 0.6, surfaceY); ctx.lineTo(x - w * 0.6, surfaceY);
        ctx.closePath(); ctx.fill();
      }
      for (const d of lab.drops) {
        const fall = Math.min(surfaceY - y0, 0.5 * GRAVITY * d.t * d.t);
        const r = 19 * Math.cbrt(d.vol);
        const speed = GRAVITY * d.t;
        this._drawDrop(ctx, x + (d.x || 0) * 6 * (fall / 250), y0 + fall, r, 1 + Math.min(0.45, speed / 3000));
      }
    }

    _drawClamp(ctx) {
      const x = B.x;
      const y = L.clampY;
      const oh = B.innerHalf + B.wall;
      ctx.fillStyle = '#b48a5a';
      roundRect(ctx, x - oh - 4, y - 12, 4, 24, 1.5); ctx.fill();
      roundRect(ctx, x + oh, y - 12, 4, 24, 1.5); ctx.fill();
      const jaw = ctx.createLinearGradient(0, y - 14, 0, y + 14);
      jaw.addColorStop(0, '#d0d7e0');
      jaw.addColorStop(0.5, '#76808d');
      jaw.addColorStop(1, '#3d444e');
      ctx.fillStyle = jaw;
      roundRect(ctx, x - oh - 11, y - 14, 7, 28, 2.5); ctx.fill();
      roundRect(ctx, x + oh + 4, y - 14, 7, 28, 2.5); ctx.fill();
      ctx.fillStyle = '#2a3038';
      roundRect(ctx, x + oh + 11, y - 4, 16, 8, 3); ctx.fill();
      ctx.fillStyle = '#9aa4b0';
      ctx.beginPath(); ctx.arc(x + oh + 29, y, 5, 0, Math.PI * 2); ctx.fill();
    }

    // ---------- Kolben ----------

    _flaskPath(ctx, inset) {
      const x = L.flask.x;
      const f = G.FLASK_CM;
      const s = G.FLASK_SCALE;
      const gl = L.flask.glass;
      const e = gl - inset;
      const bottom = L.flask.innerBottom + e;
      const coneTop = G.flaskConeTopY;
      const top = G.flaskTopInnerY - 6;
      const nr = f.neckRadius * s + e;
      const br = f.baseRadius * s + e;
      const rc = 10 + e;
      const slope = (br - nr) / (bottom - coneTop);
      ctx.beginPath();
      ctx.moveTo(x - nr, top);
      ctx.lineTo(x - nr, coneTop - 8);
      ctx.quadraticCurveTo(x - nr, coneTop + 2, x - nr - slope * 12, coneTop + 10);
      ctx.lineTo(x - br + slope * rc, bottom - rc);
      ctx.quadraticCurveTo(x - br, bottom, x - br + rc, bottom);
      ctx.lineTo(x + br - rc, bottom);
      ctx.quadraticCurveTo(x + br, bottom, x + br - slope * rc, bottom - rc);
      ctx.lineTo(x + nr + slope * 12, coneTop + 10);
      ctx.quadraticCurveTo(x + nr, coneTop + 2, x + nr, coneTop - 8);
      ctx.lineTo(x + nr, top);
    }

    _liquidPath(ctx, surfaceY, halfW) {
      const x = L.flask.x;
      const h = this.waveH;
      const depthF = clamp((L.flask.innerBottom - surfaceY) / 18, 0.2, 1);
      const vortexDepth = (this.reduceMotion ? 0 : 5.5) * this.stirSpeed * depthF;
      ctx.beginPath();
      ctx.moveTo(x - halfW - 30, surfaceY + h[0]);
      for (let i = 0; i < WAVE_N; i++) {
        const u = i / (WAVE_N - 1);
        const rel = (u - 0.5) * 2;
        const vortex = vortexDepth * Math.exp(-rel * rel * 5) - vortexDepth * 0.25;
        ctx.lineTo(x - halfW + u * 2 * halfW, surfaceY + h[i] + vortex);
      }
      ctx.lineTo(x + halfW + 30, surfaceY + h[WAVE_N - 1]);
      ctx.lineTo(x + halfW + 30, L.flask.innerBottom + 20);
      ctx.lineTo(x - halfW - 30, L.flask.innerBottom + 20);
      ctx.closePath();
    }

    _drawFlask(ctx) {
      const lab = this.lab;
      const x = L.flask.x;
      const hasLiquid = this.levelShown > 0.05;
      const surfaceY = this._surfaceY();
      const halfW = G.flaskInnerHalfWidth(surfaceY);
      const col = this.color || this._bulkColor();

      this._flaskPath(ctx, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(200,220,240,0.18)';
      ctx.fill();

      ctx.save();
      this._flaskPath(ctx, L.flask.glass);
      ctx.closePath();
      ctx.clip();
      this._drawStirBar(ctx);
      this._drawElectrodeInFlask(ctx);
      if (hasLiquid) {
        this._liquidPath(ctx, surfaceY, halfW);
        const grad = ctx.createLinearGradient(0, surfaceY, 0, L.flask.innerBottom);
        grad.addColorStop(0, rgba(col, col[3] * 0.85));
        grad.addColorStop(1, rgba(col, Math.min(0.95, col[3] * 1.15)));
        ctx.fillStyle = grad;
        ctx.fill();
        const side = ctx.createLinearGradient(x - 100, 0, x + 100, 0);
        side.addColorStop(0, 'rgba(20,40,70,0.14)');
        side.addColorStop(0.3, 'rgba(20,40,70,0)');
        side.addColorStop(0.7, 'rgba(20,40,70,0)');
        side.addColorStop(1, 'rgba(20,40,70,0.16)');
        ctx.fillStyle = side;
        ctx.fill();
        ctx.save();
        this._liquidPath(ctx, surfaceY, halfW);
        ctx.clip();
        this._drawPlumes(ctx, surfaceY, halfW, col);
        ctx.restore();
        const ry = Math.min(7, halfW * 0.09);
        ctx.fillStyle = rgba([lerp(col[0], 255, 0.4), lerp(col[1], 255, 0.4), lerp(col[2], 255, 0.4)], 0.35);
        ctx.beginPath(); ctx.ellipse(x, surfaceY, halfW, ry, 0, 0, Math.PI * 2); ctx.fill();
        this._liquidPath(ctx, surfaceY, halfW);
        ctx.strokeStyle = 'rgba(60,100,140,0.45)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
        for (const r of this.rings) {
          const t = r.age / r.life;
          const rx = 4 + t * halfW * 0.9;
          ctx.strokeStyle = 'rgba(60,100,150,' + (0.4 * (1 - t)).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(r.x, surfaceY, rx, rx * 0.09 + 0.8, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(120,165,215,0.8)';
      for (const p of this.splashes) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill(); }

      this._flaskPath(ctx, 0);
      ctx.strokeStyle = GLASS;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      this._flaskPath(ctx, L.flask.glass);
      ctx.strokeStyle = GLASS_IN;
      ctx.lineWidth = 1;
      ctx.stroke();
      this._flaskHighlights(ctx);
      this._flaskMarks(ctx);
    }

    _flaskHighlights(ctx) {
      const x = L.flask.x;
      const s = G.FLASK_SCALE;
      const f = G.FLASK_CM;
      const coneTop = G.flaskConeTopY;
      const bottom = L.flask.innerBottom;
      const nr = f.neckRadius * s;
      const br = f.baseRadius * s;
      ctx.save();
      const g = ctx.createLinearGradient(0, coneTop, 0, bottom);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - nr - 6, coneTop + 22); ctx.lineTo(x - nr - 1, coneTop + 22); ctx.lineTo(x - br + 26, bottom - 18); ctx.lineTo(x - br + 16, bottom - 18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x - nr + 3, G.flaskTopInnerY, 2, coneTop - G.flaskTopInnerY - 8);
      const top = G.flaskTopInnerY - 6;
      ctx.strokeStyle = GLASS;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, top, nr + 7, 3.2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    _flaskMarks(ctx) {
      const x = L.flask.x;
      ctx.save();
      ctx.strokeStyle = 'rgba(40,60,80,0.65)';
      ctx.fillStyle = 'rgba(40,60,80,0.75)';
      ctx.lineWidth = 1;
      ctx.font = '600 11px ' + FONT;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      [25, 50, 75, 100].forEach(function (ml) {
        const y = G.flaskSurfaceY(ml);
        const hw = G.flaskInnerHalfWidth(y);
        const x0 = x + hw * 0.32;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 14, y); ctx.stroke();
        if (ml % 50 === 0) ctx.fillText(String(ml), x0 + 17, y);
      });
      const y = G.flaskSurfaceY(10) - 6;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      roundRect(ctx, x - 66, y - 8, 42, 16, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(40,60,80,0.8)';
      ctx.font = '600 9px ' + FONT;
      ctx.fillText('100 mL', x - 62, y);
      ctx.restore();
    }

    _drawStirBar(ctx) {
      const x = L.flask.x;
      const y = L.flask.innerBottom - 7;
      const len = 48;
      const hgt = 13;
      const proj = Math.abs(Math.cos(this.stirAngle)) * (len - hgt) + hgt;
      const g = ctx.createLinearGradient(0, y - hgt / 2, 0, y + hgt / 2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#d9e0e7');
      g.addColorStop(1, '#8e9aa7');
      ctx.fillStyle = g;
      roundRect(ctx, x - proj / 2, y - hgt / 2, proj, hgt, hgt / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,80,100,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    _drawPlumes(ctx, surfaceY, halfW, bulk) {
      const lab = this.lab;
      if (!lab.indicator || lab.indicator === 'none') return;
      const depth = Math.max(4, L.flask.innerBottom - surfaceY);
      const dilution = this._indicatorConc();
      for (const p of this.plumes) {
        const pH = Chem.plumePH(lab.exp, Math.max(0, p.vBulk), p.vol, p.mixed);
        const c = this._liquidRGBA(Ind.solutionColor(lab.indicator, pH, dilution));
        const diff = (Math.abs(c[0] - bulk[0]) + Math.abs(c[1] - bulk[1]) + Math.abs(c[2] - bulk[2])) / 255 + Math.abs(c[3] - bulk[3]);
        if (diff < 0.02) continue;
        const life = lab.stirrer ? 14 : 120;
        const a = clamp(diff * 1.6, 0, 0.9) * Math.max(0, 1 - p.age / life);
        const sink = Math.min(1, p.age / (lab.stirrer ? 0.6 : 6));
        const swirlR = this.reduceMotion ? 0 : this.stirSpeed * halfW * 0.55 * Math.min(1, p.age * 1.4);
        const ang = p.phase + p.age * 6 * this.stirSpeed;
        const px = lerp(p.x0, L.flask.x, sink * 0.4) + Math.sin(ang) * swirlR + p.drift * 10 * Math.min(p.age, 4);
        const r = 4 + 10 * Math.sqrt(Math.min(p.mixed, 10)) * clamp(depth / 45, 0.5, 1.5);
        const py = surfaceY + 2 + r * 0.3 + sink * depth * 0.45 + Math.cos(ang) * Math.min(depth * 0.2, swirlR * 0.15);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, rgba(c, a));
        g.addColorStop(0.6, rgba(c, a * 0.45));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(px, py); ctx.scale(1.6, 0.75); ctx.translate(-px, -py);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // ---------- Magnetrührer ----------

    _drawStirrer(ctx) {
      const s = L.stirrer;
      const x0 = s.x - s.halfWidth;
      const w = 2 * s.halfWidth;
      const body = ctx.createLinearGradient(0, s.top, 0, s.top + s.height);
      body.addColorStop(0, '#4a5562');
      body.addColorStop(0.25, '#333c47');
      body.addColorStop(1, '#1d232b');
      ctx.fillStyle = body;
      roundRect(ctx, x0, s.top + 6, w, s.height - 6, 10);
      ctx.fill();
      const plate = ctx.createLinearGradient(0, s.top - 2, 0, s.top + 12);
      plate.addColorStop(0, '#f8fafc');
      plate.addColorStop(0.6, '#d8e0e7');
      plate.addColorStop(1, '#a3aeba');
      ctx.fillStyle = plate;
      roundRect(ctx, x0 + 8, s.top - 1, w - 16, 12, 5);
      ctx.fill();
      ctx.fillStyle = '#11161c';
      roundRect(ctx, x0 + 18, s.top + 24, w - 36, 36, 7);
      ctx.fill();
      const kx = x0 + 48;
      const ky = s.top + 42;
      const knob = ctx.createRadialGradient(kx - 4, ky - 5, 2, kx, ky, 14);
      knob.addColorStop(0, '#8b96a3');
      knob.addColorStop(1, '#2b323b');
      ctx.fillStyle = knob;
      ctx.beginPath(); ctx.arc(kx, ky, 12, 0, Math.PI * 2); ctx.fill();
      const ka = -Math.PI * 0.75 + this.stirSpeed * Math.PI * 1.1;
      ctx.strokeStyle = '#e9eef4';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(ka) * 9, ky + Math.sin(ka) * 9); ctx.stroke();
      const on = this.lab && this.lab.stirrer;
      ctx.fillStyle = on ? '#3df58a' : '#24402f';
      if (on) { ctx.shadowColor = '#3df58a'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(kx + 30, ky, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(225,232,240,0.92)';
      ctx.font = '600 13px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Magnetrührer', kx + 42, ky - 7);
      ctx.fillStyle = 'rgba(180,195,210,0.9)';
      ctx.font = '500 11px ' + FONT;
      ctx.fillText(on ? 'Rühren · an  (antippen)' : 'Rühren · aus  (antippen)', kx + 42, ky + 9);
    }

    // ---------- pH-Elektrode und Messgerät ----------

    _electrodeX() { return B.x + 24; }

    /** Senkrechte Verschiebung der Elektrode: oben (Halter) bis eingetaucht */
    _electrodeLift() { return (1 - this.electrodePos) * 340; }

    _drawElectrodeArm(ctx) {
      const m = L.meter;
      const ex = this._electrodeX();
      const postX = m.x0 + 30;
      const lift = this._electrodeLift();
      const armY = 494 - lift;
      const post = ctx.createLinearGradient(postX - 4, 0, postX + 4, 0);
      post.addColorStop(0, '#6a737f');
      post.addColorStop(0.4, '#eef2f6');
      post.addColorStop(1, '#4a525c');
      ctx.fillStyle = post;
      ctx.fillRect(postX - 4, 330, 8, m.top - 330);
      const arm = ctx.createLinearGradient(0, armY - 4, 0, armY + 4);
      arm.addColorStop(0, '#e3e8ee');
      arm.addColorStop(1, '#56606b');
      ctx.fillStyle = arm;
      ctx.fillRect(ex + 8, armY - 3.5, postX - ex - 8, 7);
      ctx.fillStyle = '#2a3038';
      roundRect(ctx, postX - 9, armY - 10, 18, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#2f3741';
      roundRect(ctx, ex - 10, armY - 9, 20, 18, 4);
      ctx.fill();

      ctx.strokeStyle = '#1a2027';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex, 472 - lift);
      ctx.bezierCurveTo(ex + 10, 380 - lift, m.x1 + 40, 430, m.x1 - 12, m.top + 30);
      ctx.stroke();
      ctx.lineCap = 'butt';

      const head = ctx.createLinearGradient(ex - 7, 0, ex + 7, 0);
      head.addColorStop(0, '#11161c');
      head.addColorStop(0.4, '#3b4450');
      head.addColorStop(1, '#0d1116');
      ctx.fillStyle = head;
      roundRect(ctx, ex - 7, 470 - lift, 14, 52, 4);
      ctx.fill();
      // Schaft oberhalb des Kolbenhalses; der Teil im Kolben folgt beim Zeichnen des Kolbens
      const yBulb = L.flask.innerBottom - 16 - lift;
      const neck = G.flaskTopInnerY - 6;
      this._electrodeShaft(ctx, 522 - lift, Math.min(neck, yBulb - 4));
      if (yBulb + 8 < neck) this._electrodeTip(ctx, yBulb);
    }

    _electrodeShaft(ctx, y0, y1) {
      if (y1 <= y0) return;
      const ex = this._electrodeX();
      const g = ctx.createLinearGradient(ex - 6, 0, ex + 6, 0);
      g.addColorStop(0, 'rgba(150,185,220,0.55)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(150,185,220,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(ex - 6, y0, 12, y1 - y0);
      ctx.strokeStyle = GLASS;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(ex - 6, y0, 12, y1 - y0);
      ctx.strokeStyle = 'rgba(150,155,165,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ex, y0); ctx.lineTo(ex, y1); ctx.stroke();
    }

    _electrodeTip(ctx, yBulb) {
      const ex = this._electrodeX();
      ctx.fillStyle = 'rgba(210,190,140,0.85)';
      ctx.fillRect(ex + 4, yBulb - 22, 2, 4);
      const g = ctx.createRadialGradient(ex - 2, yBulb - 2, 1, ex, yBulb, 8);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.5, 'rgba(180,210,240,0.45)');
      g.addColorStop(1, 'rgba(110,160,215,0.7)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex, yBulb, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GLASS;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    _drawElectrodeInFlask(ctx) {
      const yTop = G.flaskTopInnerY - 8;
      const yBulb = L.flask.innerBottom - 16 - this._electrodeLift();
      if (yBulb + 8 < yTop + 2) return;
      this._electrodeShaft(ctx, yTop, yBulb - 4);
      this._electrodeTip(ctx, yBulb);
    }

    _drawMeter(ctx) {
      const lab = this.lab;
      const m = L.meter;
      const w = m.x1 - m.x0;
      const h = L.benchY - m.top;
      const body = ctx.createLinearGradient(0, m.top, 0, L.benchY);
      body.addColorStop(0, '#f1f4f7');
      body.addColorStop(0.08, '#d9e0e7');
      body.addColorStop(1, '#a3aeba');
      ctx.fillStyle = body;
      roundRect(ctx, m.x0, m.top, w, h, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,80,100,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const dx = m.x0 + 14;
      const dy = m.top + 16;
      const dw = w - 28;
      const dh = 66;
      ctx.fillStyle = '#0b1410';
      roundRect(ctx, dx - 3, dy - 3, dw + 6, dh + 6, 8);
      ctx.fill();
      const lcd = ctx.createLinearGradient(0, dy, 0, dy + dh);
      lcd.addColorStop(0, '#12261d');
      lcd.addColorStop(1, '#0a1712');
      ctx.fillStyle = lcd;
      roundRect(ctx, dx, dy, dw, dh, 6);
      ctx.fill();

      ctx.fillStyle = '#9dffc8';
      ctx.textBaseline = 'alphabetic';
      let main = '– – –';
      let status = '';
      if (lab.calRunning) {
        main = 'CAL';
        status = 'Puffer ' + (lab.calRunning === 1 ? 'pH 7,00' : (lab.exp.direction > 0 ? 'pH 10,01' : 'pH 4,01')) + ' …';
      } else if (lab.calibration < 2) {
        main = 'CAL?';
        status = 'nicht kalibriert';
      } else if (!lab.electrodeIn) {
        status = 'Elektrode eintauchen';
      } else {
        main = fmt(lab.displayPH, 2);
        status = lab.stable ? '✓ stabil' : '~ misst …';
      }
      ctx.shadowColor = 'rgba(80,255,170,0.5)';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'right';
      ctx.font = '700 36px ' + MONO;
      ctx.fillText(main, dx + dw - 10, dy + 46);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.textAlign = 'left';
      ctx.font = '700 15px ' + FONT;
      ctx.fillStyle = 'rgba(157,255,200,0.85)';
      ctx.fillText('pH', dx + 9, dy + 21);
      ctx.font = '600 11px ' + FONT;
      ctx.fillStyle = lab.stable ? 'rgba(157,255,200,0.95)' : 'rgba(157,255,200,0.6)';
      ctx.fillText(status, dx + 9, dy + 60);
      ctx.textAlign = 'right';
      ctx.font = '500 10px ' + MONO;
      ctx.fillStyle = 'rgba(157,255,200,0.5)';
      ctx.fillText('25,0 °C', dx + dw - 8, dy + 60);

      ctx.fillStyle = '#26323e';
      ctx.font = '700 12px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText('pH-Meter', m.x1 - 12, m.top + 112);
      ctx.font = '500 10.5px ' + FONT;
      ctx.fillStyle = '#4a5866';
      ctx.fillText(lab.calibration >= 2 ? 'kalibriert (2 Puffer)' : lab.calibration === 1 ? 'Kalibrierung 1/2' : 'Kalibrierung fehlt', m.x1 - 12, m.top + 128);
    }

    // ---------- Beschriftungen ----------

    _drawLabels(ctx) {
      const lab = this.opts.labels;
      if (lab.titrant) this._tag(ctx, B.x + 50, 26, lab.titrant.title, lab.titrant.lines, B.x + B.innerHalf + B.wall + 2, 52);
      if (lab.sample) {
        const y = G.flaskConeTopY + 30;
        this._tag(ctx, 352, y - 10, lab.sample.title, lab.sample.lines, L.flask.x - 70, y + 70, 'right');
      }
    }

    _tag(ctx, x, y, title, lines, ax, ay, side) {
      ctx.save();
      ctx.font = '700 12px ' + FONT;
      let w = ctx.measureText(title.toUpperCase()).width;
      ctx.font = '600 15px ' + FONT;
      for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      w += 26;
      const h = 28 + lines.length * 20;
      if (side === 'right') x -= w;
      ctx.strokeStyle = 'rgba(31,111,229,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(side === 'right' ? x + w : x, y + h / 2);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(31,111,229,0.85)';
      ctx.beginPath(); ctx.arc(ax, ay, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.shadowColor = 'rgba(20,30,45,0.15)';
      ctx.shadowBlur = 6;
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(70,100,130,0.3)';
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '700 12px ' + FONT;
      ctx.fillStyle = '#1f6fe5';
      ctx.fillText(title.toUpperCase(), x + 13, y + 19);
      ctx.font = '600 15px ' + FONT;
      ctx.fillStyle = INK;
      lines.forEach(function (l, i) { ctx.fillText(l, x + 13, y + 40 + i * 20); });
      ctx.restore();
    }

    // ---------- Ablese-Lupe ----------

    _drawLens(ctx) {
      const lz = L.lens;
      const yM = G.buretteY(this.lab.burette.reading);
      const cx = B.x + lz.dx;
      const cy = clamp(yM, 200, 430);
      const R = lz.radius;
      const oh = B.innerHalf + B.wall;
      ctx.strokeStyle = 'rgba(31,111,229,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(B.x + oh + 1, yM - 5); ctx.lineTo(cx - R * 0.8, cy - R * 0.6);
      ctx.moveTo(B.x + oh + 1, yM + 5); ctx.lineTo(cx - R * 0.8, cy + R * 0.6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(31,111,229,0.7)';
      ctx.strokeRect(B.x - oh - 3, yM - 6, 2 * oh + 6, 12);
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#f2f5f8';
      ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      ctx.translate(cx, cy);
      ctx.scale(lz.zoom, lz.zoom);
      ctx.translate(-B.x + 6, -yM);
      this._drawBurette(ctx, true);
      ctx.restore();
      ctx.lineWidth = 6;
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, '#e2e8ef');
      rim.addColorStop(0.5, '#7c8693');
      rim.addColorStop(1, '#3b424b');
      ctx.strokeStyle = rim;
      ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#3d4b59';
      ctx.font = '600 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Ablesehilfe · Unterkante Meniskus', cx, cy + R + 10);
    }

    _drawTaps(ctx) {
      if (this.reduceMotion) return;
      for (const tp of this.taps) {
        const t = tp.age / 0.6;
        ctx.strokeStyle = 'rgba(31,111,229,' + (0.6 * (1 - t)).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 20 + t * 30, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  NS.LabRenderer = LabRenderer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
