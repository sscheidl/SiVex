/*
 * Laborgrafik (Canvas 2D)
 * -----------------------
 * Zeichnet Stativ, Bürette mit Schellbachstreifen und Meniskus, Hahn,
 * Tropfen, Erlenmeyerkolben mit animierter Flüssigkeit, Magnetrührer,
 * pH-Elektrode mit Messgerät sowie eine Ablese-Lupe.
 *
 * Alle chemisch relevanten Größen (Füllstände, Farbe, Schlieren,
 * pH-Anzeige) werden ausschließlich aus dem Experiment-Objekt bzw. dem
 * chemischen Modell abgeleitet. Rein dekorativ animiert sind nur
 * Oberflächenwellen, Rührfisch und Spritzer.
 */
(function (global) {
  'use strict';

  const NS = (global.Titrierlabor = global.Titrierlabor || {});
  const G = NS.Geometry;
  const L = G.LAYOUT;
  const B = L.burette;
  const Ind = NS.Indicators;
  /** aktuelle Farbpalette (hell/dunkel), siehe theme.js */
  function T() { return NS.Theme.palette; }

  const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
  const MONO = '"Cascadia Mono", "SF Mono", Menlo, Consolas, monospace';
  const VIEW_BOX = { x0: 140, y0: 0, x1: 950, y1: 1000 };
  const GRAVITY = 2600; // Welteinheiten / s²
  const WAVE_N = 48;
  /** Indikatorkonzentration im Kolben relativ zur Referenz der Farbdefinition (einige Tropfen Indikatorlösung) */
  const INDICATOR_STRENGTH = 2.2;

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

  function fmt(x, d) { return NS.Config.formatNumber(x, d); }

  class LabRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.bg = document.createElement('canvas');
      this.exp = null;
      this.opts = {
        indicator: 'phenolphthalein',
        electrode: true,
        stirrer: true,
        magnifier: true,
        labels: null,
        hintStopcock: false,
        teacher: false,
      };
      this.view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 1, h: 1 };
      this.bgTheme = null; // Schema, mit dem der Hintergrund zuletzt gezeichnet wurde

      // Animationszustand (rein visuell)
      this.time = 0;
      this.valveAngle = 0;
      this.stirAngle = 0;
      this.stirSpeed = 0;
      this.waveH = new Float32Array(WAVE_N);
      this.waveV = new Float32Array(WAVE_N);
      this.rings = [];
      this.splashes = [];
      this.plumes = [];
      this.taps = [];
      this.color = null;
      this.levelSmooth = null;

      // Reduzierte Bewegung (Systemeinstellung): keine Wellen, Spritzer, Wirbel,
      // Pulsringe; Tropfen und Farbänderungen bleiben sichtbar.
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

    // ---------- Konfiguration ----------

    setExperiment(exp) {
      this.exp = exp;
      this.plumes = [];
      this.rings = [];
      this.splashes = [];
      this.color = null;
      this.levelSmooth = null;
      const self = this;
      exp.on('drop-landed', function (e) {
        if (self.exp === exp) self._onDropLanded(e);
      });
    }

    setOptions(o) {
      Object.assign(this.opts, o);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (w === this.view.w && h === this.view.h && dpr === this.view.dpr && this.bgTheme === T().name) return;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      const vbW = VIEW_BOX.x1 - VIEW_BOX.x0;
      const vbH = VIEW_BOX.y1 - VIEW_BOX.y0;
      const scale = Math.min(w / vbW, h / vbH);
      this.view = {
        scale: scale,
        dpr: dpr,
        w: w,
        h: h,
        ox: (w - vbW * scale) / 2 - VIEW_BOX.x0 * scale,
        oy: (h - vbH * scale) / 2 - VIEW_BOX.y0 * scale,
      };
      this._renderBackground();
      this.bgTheme = T().name;
    }

    /** Bildschirm- (CSS-Pixel relativ zur Canvas) → Weltkoordinaten */
    toWorld(px, py) {
      const v = this.view;
      return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
    }

    hitTest(px, py) {
      const p = this.toWorld(px, py);
      const dxs = p.x - B.x;
      const dys = p.y - B.stopcockY;
      if (dxs * dxs + dys * dys < 52 * 52) return 'stopcock';
      const m = L.meter;
      if (this.opts.electrode && p.x > m.x0 && p.x < m.x1 && p.y > m.top && p.y < L.benchY) return 'meter';
      const st = L.stirrer;
      if (p.x > st.x - st.halfWidth && p.x < st.x + st.halfWidth && p.y > st.top + 14 && p.y < st.top + st.height) {
        return 'stirrer';
      }
      return null;
    }

    /** Kurzer visueller Rückmeldering an einer Weltposition */
    tapFeedback(kind) {
      if (kind === 'stopcock') this.taps.push({ x: B.x, y: B.stopcockY, age: 0 });
    }

    // ---------- Simulation der Effekte ----------

    _onDropLanded(e) {
      const exp = this.exp;
      const surfaceY = G.flaskSurfaceY(exp.config.vSample + exp.delivered);
      const halfW = G.flaskInnerHalfWidth(surfaceY);
      const x = B.x + (this.reduceMotion ? 0 : (e.x || 0) * 6);
      if (this.reduceMotion) {
        // nur die (statische) Farbschliere zeigt die Zugabe an
        if (this.opts.indicator !== 'none') {
          this.plumes.push({ x0: x, y0: surfaceY + 2, age: 0, vol: e.vol, phase: 0, drift: 0 });
          if (this.plumes.length > 50) this.plumes.shift();
        }
        return;
      }
      const idx = clamp(Math.round(((x - (B.x - halfW)) / (2 * halfW)) * (WAVE_N - 1)), 1, WAVE_N - 2);
      this._impulse(idx, 22 * Math.sqrt(e.vol / 0.05));
      this.rings.push({ x: x, age: 0, life: 0.9 });
      const n = e.vol > 0.03 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        this.splashes.push({
          x: x, y: surfaceY, vx: (Math.random() - 0.5) * 90, vy: -120 - Math.random() * 90, age: 0, life: 0.35,
        });
      }
      if (this.opts.indicator !== 'none') {
        this.plumes.push({
          x0: x, y0: surfaceY + 2, age: 0, vol: e.vol, phase: Math.random() * Math.PI * 2, drift: (Math.random() - 0.5),
        });
        if (this.plumes.length > 50) this.plumes.shift();
      }
    }

    /** Gaußförmiger Impuls auf die Oberfläche (vermeidet kurzwelliges Rauschen) */
    _impulse(idx, strength) {
      for (let k = -4; k <= 4; k++) {
        const i = idx + k;
        if (i < 0 || i >= WAVE_N) continue;
        this.waveV[i] += strength * Math.exp(-(k * k) / 4);
      }
    }

    _update(dt) {
      const exp = this.exp;
      this.time += dt;

      // Hahngriff folgt der tatsächlichen Hahnstellung
      const targetAngle = exp ? exp.valveOpening * (Math.PI / 2) : 0;
      this.valveAngle = lerp(this.valveAngle, targetAngle, 1 - Math.exp(-dt * 14));

      // Rührer
      const targetStir = this.opts.stirrer ? 1 : 0;
      this.stirSpeed = lerp(this.stirSpeed, targetStir, 1 - Math.exp(-dt * 1.8));
      if (!this.reduceMotion) this.stirAngle += this.stirSpeed * 15 * dt;

      if (!exp) return;

      // Fallzeit der Tropfen aus der aktuellen Fallhöhe (Synchronisation Grafik ↔ Modell)
      const surfaceY = G.flaskSurfaceY(exp.config.vSample + exp.delivered);
      const fallDist = Math.max(20, surfaceY - (B.tipEndY + 6));
      exp.fallTime = Math.sqrt((2 * fallDist) / GRAVITY);

      // Oberflächenwellen (1D-Wellengleichung mit Dämpfung)
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
      if (!this.reduceMotion && this.stirSpeed > 0.2 && Math.random() < dt * 5) {
        this._impulse(4 + Math.floor(Math.random() * (WAVE_N - 8)), (Math.random() - 0.5) * 6 * this.stirSpeed);
      }

      // Farbe der Gesamtlösung: Zielwert aus berechnetem pH, sichtbare Durchmischung
      const target = this._bulkColor();
      if (!this.color) this.color = target.slice();
      const tau = 0.2; // kurze optische Glättung; die eigentliche Durchmischung modelliert das Experiment
      const k = 1 - Math.exp(-dt / tau);
      for (let i = 0; i < 4; i++) this.color[i] = lerp(this.color[i], target[i], k);

      // Effekte altern lassen
      this.rings = this.rings.filter(function (r) { r.age += dt; return r.age < r.life; });
      this.splashes = this.splashes.filter(function (p) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += GRAVITY * 0.6 * dt;
        return p.age < p.life;
      });
      const mixTau = this.opts.stirrer ? 0.33 : 1.6;
      const vTot = exp.config.vSample + exp.delivered;
      this.plumes = this.plumes.filter(function (p) {
        p.age += dt;
        p.mixed = 0.12 * Math.exp(p.age / mixTau);
        return p.mixed < vTot * 0.8 && p.age < 14;
      });
      this.taps = this.taps.filter(function (t) { t.age += dt; return t.age < 0.6; });
    }

    /** [r, g, b, alpha] der Gesamtlösung aus dem berechneten pH-Wert */
    _bulkColor() {
      const exp = this.exp;
      // Sichtbarer pH (Durchmischung, siehe Experiment.pHMeasured) statt Gleichgewichts-pH
      return this._liquidRGBA(Ind.solutionColor(this.opts.indicator, exp.pHMeasured, this._indicatorConc()));
    }

    /** Indikatorkonzentration: konstante Stoffmenge, verdünnt durch die zugegebene Maßlösung */
    _indicatorConc() {
      const exp = this.exp;
      return INDICATOR_STRENGTH * exp.config.vSample / (exp.config.vSample + exp.delivered);
    }

    _liquidRGBA(c) {
      // Farbloses Wasser leicht bläulich-klar, Indikatorfarbe deckt mit steigender Absorbanz
      const s = clamp(c.strength, 0, 2);
      const tint = clamp(s * 3, 0, 1);
      const r = lerp(205, c.r, tint);
      const g = lerp(228, c.g, tint);
      const b = lerp(250, c.b, tint);
      const a = 0.30 + 0.58 * clamp(s * 1.8, 0, 1);
      return [r, g, b, a];
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

      if (!this.exp) return;
      if (this.opts.electrode) this._drawElectrodeArm(ctx);
      this._drawStirrer(ctx);
      this._drawFlask(ctx);
      this._drawBurette(ctx, false);
      this._drawClamp(ctx);
      this._drawStopcock(ctx);
      this._drawDrops(ctx);
      if (this.opts.electrode) this._drawMeter(ctx);
      if (this.opts.labels) this._drawLabels(ctx);
      if (this.opts.magnifier) this._drawLens(ctx);
      this._drawHints(ctx);
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

      // Wand
      const wall = ctx.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, T().wall0);
      wall.addColorStop(1, T().wall1);
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, W, H);

      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      const wx0 = -v.ox / v.scale;
      const wx1 = (v.w - v.ox) / v.scale;
      const wy0 = -v.oy / v.scale;
      const wy1 = (v.h - v.oy) / v.scale;

      // Fliesenraster, sehr dezent
      ctx.strokeStyle = T().tile;
      ctx.lineWidth = 1;
      for (let x = Math.floor(wx0 / 70) * 70; x < wx1; x += 70) {
        ctx.beginPath(); ctx.moveTo(x, wy0); ctx.lineTo(x, L.benchY); ctx.stroke();
      }
      for (let y = Math.floor(wy0 / 70) * 70; y < L.benchY; y += 70) {
        ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke();
      }

      // Weiches Licht hinter dem Aufbau
      const glow = ctx.createRadialGradient(500, 560, 30, 500, 560, 620);
      glow.addColorStop(0, T().glow0);
      glow.addColorStop(0.5, T().glow1);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);

      // Laborbank
      const bench = ctx.createLinearGradient(0, L.benchY, 0, wy1);
      bench.addColorStop(0, T().bench0);
      bench.addColorStop(0.04, T().bench1);
      bench.addColorStop(1, T().bench2);
      ctx.fillStyle = bench;
      ctx.fillRect(wx0, L.benchY, wx1 - wx0, wy1 - L.benchY);
      ctx.fillStyle = T().benchEdge;
      ctx.fillRect(wx0, L.benchY, wx1 - wx0, 1.2);
      const benchGlow = ctx.createRadialGradient(500, L.benchY, 10, 500, L.benchY, 420);
      benchGlow.addColorStop(0, T().benchGlow);
      benchGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = benchGlow;
      ctx.fillRect(wx0, L.benchY, wx1 - wx0, 120);

      // Schatten auf der Bank
      this._shadow(ctx, L.stirrer.x, L.benchY + 3, 190, 14, 0.55);
      this._shadow(ctx, (L.meter.x0 + L.meter.x1) / 2, L.benchY + 3, 120, 10, 0.5);
      this._shadow(ctx, (L.stand.baseX0 + L.stand.baseX1) / 2, L.benchY + 2, 140, 8, 0.5);

      // Stativ: Fußplatte und Stange
      const s = L.stand;
      const plate = ctx.createLinearGradient(0, L.benchY - 16, 0, L.benchY);
      plate.addColorStop(0, '#4a5462');
      plate.addColorStop(0.3, '#2c333d');
      plate.addColorStop(1, '#1b2028');
      ctx.fillStyle = plate;
      roundRect(ctx, s.baseX0, L.benchY - 15, s.baseX1 - s.baseX0, 15, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(s.baseX0 + 4, L.benchY - 15, s.baseX1 - s.baseX0 - 8, 1);

      const rod = ctx.createLinearGradient(s.rodX - 6, 0, s.rodX + 6, 0);
      rod.addColorStop(0, '#59626e');
      rod.addColorStop(0.35, '#e3e9f0');
      rod.addColorStop(0.55, '#9aa4b0');
      rod.addColorStop(1, '#3a414b');
      ctx.fillStyle = rod;
      ctx.fillRect(s.rodX - 6, s.rodTop, 12, L.benchY - 15 - s.rodTop);
      ctx.fillStyle = '#c9d1db';
      roundRect(ctx, s.rodX - 7, s.rodTop - 4, 14, 8, 3);
      ctx.fill();

      // Klemmenarm zur Bürette (Doppelmuffe + Stange)
      const cy = L.clampY;
      const arm = ctx.createLinearGradient(0, cy - 5, 0, cy + 5);
      arm.addColorStop(0, '#d9e0e8');
      arm.addColorStop(0.5, '#8d97a3');
      arm.addColorStop(1, '#4b535e');
      ctx.fillStyle = arm;
      ctx.fillRect(s.rodX, cy - 4.5, B.x - 22 - s.rodX, 9);
      const boss = ctx.createLinearGradient(s.rodX - 16, 0, s.rodX + 16, 0);
      boss.addColorStop(0, '#2a3038');
      boss.addColorStop(0.4, '#5b6573');
      boss.addColorStop(1, '#232830');
      ctx.fillStyle = boss;
      roundRect(ctx, s.rodX - 15, cy - 17, 30, 34, 5);
      ctx.fill();
      ctx.fillStyle = '#1b1f25';
      ctx.beginPath(); ctx.arc(s.rodX - 22, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7c8794';
      ctx.fillRect(s.rodX - 30, cy - 2, 10, 4);
    }

    _shadow(ctx, x, y, rx, ry, a) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, 'rgba(0,0,0,' + (a * T().shadow).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ---------- Bürette ----------

    _drawBurette(ctx, detail) {
      const x = B.x;
      const ih = B.innerHalf;
      const oh = ih + B.wall;
      const reading = this.exp.reading;
      const yM = G.buretteY(reading);
      const yBottom = B.stopcockY - 14;

      // Schellbachstreifen (Rückwand): weißer Grund mit blauem Mittelstreifen
      ctx.fillStyle = 'rgba(236,242,248,0.80)';
      ctx.fillRect(x - 5.5, B.top + 4, 11, yBottom - B.top - 4);

      // Flüssigkeitssäule
      const liq = ctx.createLinearGradient(x - ih, 0, x + ih, 0);
      liq.addColorStop(0, 'rgba(120,170,225,0.55)');
      liq.addColorStop(0.3, 'rgba(195,225,255,0.20)');
      liq.addColorStop(0.7, 'rgba(195,225,255,0.16)');
      liq.addColorStop(1, 'rgba(110,160,220,0.55)');
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

      // Blauer Streifen: dünn in Luft, durch Brechung breiter in der Flüssigkeit
      ctx.fillStyle = '#1f4fd1';
      ctx.fillRect(x - 0.8, B.top + 4, 1.6, Math.max(0, yM - 7 - B.top - 4));
      ctx.fillRect(x - 1.5, yM + 7, 3, Math.max(0, yBottom - yM - 7));
      // Schellbach-Spitze: zwei Pfeilspitzen berühren sich am Meniskus
      ctx.beginPath();
      ctx.moveTo(x - 1.5, yM + 7); ctx.lineTo(x + 1.5, yM + 7); ctx.lineTo(x + 0.15, yM); ctx.lineTo(x - 0.15, yM);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 0.8, yM - 7); ctx.lineTo(x + 0.8, yM - 7); ctx.lineTo(x + 0.15, yM); ctx.lineTo(x - 0.15, yM);
      ctx.closePath(); ctx.fill();

      // Meniskus: dunkle Brechungskante + heller Reflex
      ctx.lineWidth = detail ? 0.7 : 1.1;
      ctx.strokeStyle = 'rgba(10,25,45,0.85)';
      ctx.beginPath();
      ctx.moveTo(x - ih, yM - men);
      ctx.bezierCurveTo(x - ih, yM - 0.3, x - ih * 0.45, yM, x, yM);
      ctx.bezierCurveTo(x + ih * 0.45, yM, x + ih, yM - 0.3, x + ih, yM - men);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = detail ? 0.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x - ih + 1, yM - men + 1.6);
      ctx.bezierCurveTo(x - ih + 1, yM + 1.2, x - ih * 0.4, yM + 1.6, x, yM + 1.6);
      ctx.bezierCurveTo(x + ih * 0.4, yM + 1.6, x + ih - 1, yM + 1.2, x + ih - 1, yM - men + 1.6);
      ctx.stroke();

      // Glasrohr
      const glass = ctx.createLinearGradient(x - oh, 0, x + oh, 0);
      glass.addColorStop(0, 'rgba(210,230,255,0.30)');
      glass.addColorStop(0.12, 'rgba(255,255,255,0.06)');
      glass.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      glass.addColorStop(0.88, 'rgba(255,255,255,0.05)');
      glass.addColorStop(1, 'rgba(210,230,255,0.28)');
      ctx.fillStyle = glass;
      ctx.fillRect(x - oh, B.top, 2 * oh, yBottom - B.top);
      ctx.strokeStyle = T().glass;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - oh, B.top); ctx.lineTo(x - oh, yBottom);
      ctx.moveTo(x + oh, B.top); ctx.lineTo(x + oh, yBottom);
      ctx.stroke();
      ctx.strokeStyle = T().glassIn;
      ctx.beginPath();
      ctx.moveTo(x - ih, B.top + 2); ctx.lineTo(x - ih, yBottom);
      ctx.moveTo(x + ih, B.top + 2); ctx.lineTo(x + ih, yBottom);
      ctx.stroke();
      // Glanzlichter
      const hl = ctx.createLinearGradient(0, B.top, 0, yBottom);
      hl.addColorStop(0, 'rgba(255,255,255,0.0)');
      hl.addColorStop(0.15, 'rgba(255,255,255,0.45)');
      hl.addColorStop(0.85, 'rgba(255,255,255,0.35)');
      hl.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = hl;
      ctx.fillRect(x - oh + 3, B.top, 2.2, yBottom - B.top);
      ctx.globalAlpha = 0.35 * T().highlight;
      ctx.fillRect(x + oh - 4.5, B.top, 1.2, yBottom - B.top);
      ctx.globalAlpha = 1;
      // Oberer Rand
      ctx.strokeStyle = T().glassRim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, B.top, oh, 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();

      this._drawScale(ctx, detail);
    }

    _drawScale(ctx, detail) {
      const x = B.x;
      const ih = B.innerHalf;
      const px = this.view.scale * (detail ? L.lens.zoom : 1);
      const showTenth = detail || B.mlPx * 0.1 * px > 2.6;
      const ticks = [];
      for (let i = 0; i <= 500; i++) {
        const ml = i / 10;
        const y = B.zeroY + ml * B.mlPx;
        let len;
        if (i % 10 === 0) len = 2 * ih;
        else if (i % 5 === 0) len = ih * 1.25;
        else if (showTenth) len = ih * 0.7;
        else continue;
        ticks.push({ y: y, len: len, major: i % 10 === 0 });
      }
      const drawTicks = function (color) {
        ctx.strokeStyle = color;
        for (const t of ticks) {
          ctx.lineWidth = t.major ? (detail ? 0.45 : 0.9) : (detail ? 0.3 : 0.6);
          ctx.beginPath();
          ctx.moveTo(x - ih, t.y);
          ctx.lineTo(x - ih + t.len, t.y);
          ctx.stroke();
        }
      };
      drawTicks(T().tick);
      // Auf dem weißen Schellbachstreifen erscheinen die Striche dunkel
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 5.5, B.top, 11, B.fiftyY - B.top + 2);
      ctx.clip();
      drawTicks('rgba(12,20,32,0.95)');
      ctx.restore();

      // Beschriftung
      ctx.fillStyle = T().scaleText;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      const step = detail ? 1 : 5;
      ctx.font = (detail ? '600 4.6px ' : '600 14px ') + FONT;
      for (let ml = 0; ml <= 50; ml += step) {
        const y = B.zeroY + ml * B.mlPx;
        ctx.fillText(String(ml), x - ih - (detail ? 5 : 8), y);
      }
      if (!detail) {
        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = T().scaleSub;
        ctx.fillText('mL', x - ih - 8, B.zeroY - 15);
        ctx.save();
        ctx.translate(x + ih + 12, B.zeroY + 150);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = '500 10.5px ' + FONT;
        ctx.fillStyle = T().scaleSub2;
        ctx.fillText('50 mL  ·  Klasse AS  ·  20 °C', 0, 0);
        ctx.restore();
      }
    }

    _drawStopcock(ctx) {
      const x = B.x;
      const y = B.stopcockY;
      const ih = B.innerHalf;
      const oh = ih + B.wall;
      const yTop = y - 14;
      const open = this.exp.isFlowing;

      // Übergang Rohr → Hahnkörper → Spitze (Glas mit Flüssigkeit)
      ctx.fillStyle = 'rgba(180,215,250,0.28)';
      ctx.beginPath();
      ctx.moveTo(x - ih, yTop);
      ctx.lineTo(x + ih, yTop);
      ctx.lineTo(x + 4, y - 4);
      ctx.lineTo(x - 4, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = T().glass;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - oh, yTop); ctx.lineTo(x - 7, y - 6);
      ctx.moveTo(x + oh, yTop); ctx.lineTo(x + 7, y - 6);
      ctx.stroke();

      // Untere Spitze
      const t0 = B.tipStartY;
      const t1 = B.tipEndY;
      ctx.fillStyle = 'rgba(180,215,250,0.30)';
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 8);
      ctx.lineTo(x + 5, y + 8);
      ctx.lineTo(x + 5, t0);
      ctx.lineTo(x + 1.6, t1);
      ctx.lineTo(x - 1.6, t1);
      ctx.lineTo(x - 5, t0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = T().glass;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(x - 3.6, y + 10, 1.1, t0 - y - 8);

      // Hahngehäuse (Glas)
      const body = ctx.createLinearGradient(0, y - 11, 0, y + 11);
      body.addColorStop(0, 'rgba(235,245,255,0.55)');
      body.addColorStop(0.45, 'rgba(160,195,230,0.18)');
      body.addColorStop(1, 'rgba(225,238,255,0.45)');
      ctx.fillStyle = body;
      roundRect(ctx, x - 30, y - 10, 60, 20, 9);
      ctx.fill();
      ctx.strokeStyle = T().glassRim;
      ctx.stroke();
      // Flüssigkeit in der Bohrung, wenn offen
      if (open) {
        ctx.fillStyle = 'rgba(170,210,250,0.6)';
        ctx.fillRect(x - 2, y - 10, 4, 20);
      }

      // PTFE-Küken und Griff
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
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      roundRect(ctx, -52, -7, 56, 14, 7);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      roundRect(ctx, -48, -5.5, 46, 3, 1.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(10,25,60,0.35)';
      for (let i = 0; i < 3; i++) ctx.fillRect(-44 + i * 6, -3, 2, 7);
      // Markierung der Bohrungsrichtung
      ctx.fillStyle = '#e8f0ff';
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b3f99';
      ctx.fillRect(-1, -3.5, 2, 7);
      ctx.restore();

      // Hängender Tropfen an der Spitze
      const hv = this.exp.hanging;
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
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.35, 'rgba(200,228,255,0.35)');
      g.addColorStop(1, 'rgba(120,170,230,0.55)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = T().dropEdge;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }

    _drawDrops(ctx) {
      const exp = this.exp;
      const x = B.x;
      const surfaceY = G.flaskSurfaceY(exp.config.vSample + exp.delivered);
      const y0 = B.tipEndY + 6;
      // Bei hoher Fließgeschwindigkeit: zusammenhängender Strahl
      const q = exp.currentFlow;
      if (q > 0.3) {
        const w = 0.8 + q * 1.6;
        const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
        g.addColorStop(0, 'rgba(150,195,245,0.35)');
        g.addColorStop(0.5, T().stream);
        g.addColorStop(1, 'rgba(150,195,245,0.35)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 1.6, B.tipEndY);
        ctx.lineTo(x + 1.6, B.tipEndY);
        ctx.lineTo(x + w * 0.6, surfaceY);
        ctx.lineTo(x - w * 0.6, surfaceY);
        ctx.closePath();
        ctx.fill();
      }
      for (const d of exp.drops) {
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
      // Klemmbacken mit Korkpolster
      ctx.fillStyle = '#b48a5a';
      roundRect(ctx, x - oh - 4, y - 12, 4, 24, 1.5); ctx.fill();
      roundRect(ctx, x + oh, y - 12, 4, 24, 1.5); ctx.fill();
      const jaw = ctx.createLinearGradient(0, y - 14, 0, y + 14);
      jaw.addColorStop(0, '#c8d0da');
      jaw.addColorStop(0.5, '#6d7784');
      jaw.addColorStop(1, '#353c46');
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
      const e = gl - inset; // 0 = Innenwand, gl = Außenwand
      const bottom = L.flask.innerBottom + e;
      const coneTop = G.flaskConeTopY;
      const top = G.flaskTopInnerY - 6;
      const nr = f.neckRadius * s + e;
      const br = f.baseRadius * s + e;
      const rc = 10 + e;
      // Seitenneigung für gleichmäßige Wanddicke
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
      const vortexDepth = (this.reduceMotion ? 0 : 5.5) * this.stirSpeed * clamp((L.flask.innerBottom - surfaceY) / 18, 0.2, 1);
      ctx.beginPath();
      ctx.moveTo(x - halfW - 30, surfaceY + h[0]);
      for (let i = 0; i < WAVE_N; i++) {
        const u = i / (WAVE_N - 1);
        const px = x - halfW + u * 2 * halfW;
        const rel = (u - 0.5) * 2;
        const vortex = vortexDepth * Math.exp(-rel * rel * 5) - vortexDepth * 0.25;
        ctx.lineTo(px, surfaceY + h[i] + vortex);
      }
      ctx.lineTo(x + halfW + 30, surfaceY + h[WAVE_N - 1]);
      ctx.lineTo(x + halfW + 30, L.flask.innerBottom + 20);
      ctx.lineTo(x - halfW - 30, L.flask.innerBottom + 20);
      ctx.closePath();
    }

    _drawFlask(ctx) {
      const exp = this.exp;
      const x = L.flask.x;
      const vTot = exp.config.vSample + exp.delivered;
      const surfaceY = G.flaskSurfaceY(vTot);
      const halfW = G.flaskInnerHalfWidth(surfaceY);
      const col = this.color || this._bulkColor();

      // Rückwand-Glas
      this._flaskPath(ctx, 0);
      ctx.closePath();
      const back = ctx.createLinearGradient(x - 100, 0, x + 100, 0);
      back.addColorStop(0, 'rgba(170,205,245,0.10)');
      back.addColorStop(0.5, 'rgba(255,255,255,0.03)');
      back.addColorStop(1, 'rgba(170,205,245,0.08)');
      ctx.fillStyle = back;
      ctx.fill();

      // Weiße Unterlage des Rührers scheint durch den Boden
      ctx.save();
      this._flaskPath(ctx, L.flask.glass);
      ctx.closePath();
      ctx.clip();

      // Rührfisch
      this._drawStirBar(ctx);
      // Elektrode (hinter der Flüssigkeit, damit sie eingefärbt wirkt)
      if (this.opts.electrode) this._drawElectrodeInFlask(ctx);

      // Flüssigkeit
      this._liquidPath(ctx, surfaceY, halfW);
      const grad = ctx.createLinearGradient(0, surfaceY, 0, L.flask.innerBottom);
      grad.addColorStop(0, rgba(col, col[3] * 0.85));
      grad.addColorStop(1, rgba(col, Math.min(0.95, col[3] * 1.15)));
      ctx.fillStyle = grad;
      ctx.fill();
      // seitliche Abdunkelung (Volumenwirkung)
      const side = ctx.createLinearGradient(x - 100, 0, x + 100, 0);
      side.addColorStop(0, 'rgba(10,20,35,0.28)');
      side.addColorStop(0.3, 'rgba(10,20,35,0.0)');
      side.addColorStop(0.7, 'rgba(10,20,35,0.0)');
      side.addColorStop(1, 'rgba(10,20,35,0.30)');
      ctx.fillStyle = side;
      ctx.fill();

      // Schlieren (lokal berechneter pH-Wert), nur innerhalb der Flüssigkeit
      ctx.save();
      this._liquidPath(ctx, surfaceY, halfW);
      ctx.clip();
      this._drawPlumes(ctx, surfaceY, halfW, col);
      ctx.restore();

      // Oberfläche (2.5D-Ellipse) und Wellenkante
      const ry = Math.min(7, halfW * 0.09);
      ctx.fillStyle = rgba([lerp(col[0], 255, 0.35), lerp(col[1], 255, 0.35), lerp(col[2], 255, 0.35)], 0.22);
      ctx.beginPath();
      ctx.ellipse(x, surfaceY, halfW, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      this._liquidPath(ctx, surfaceY, halfW);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Ringwellen
      for (const r of this.rings) {
        const t = r.age / r.life;
        const rx = 4 + t * halfW * 0.9;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 * (1 - t)).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(r.x, surfaceY, rx, rx * 0.09 + 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Spritzer
      ctx.fillStyle = T().splash;
      for (const p of this.splashes) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();
      }

      // Vorderes Glas: Konturen und Glanzlichter
      this._flaskPath(ctx, 0);
      ctx.strokeStyle = T().glass;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      this._flaskPath(ctx, L.flask.glass);
      ctx.strokeStyle = T().glassIn;
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
      // linker Glanzstreifen entlang der Kegelwand
      ctx.save();
      ctx.globalAlpha = T().highlight;
      const g = ctx.createLinearGradient(0, coneTop, 0, bottom);
      g.addColorStop(0, 'rgba(255,255,255,0.0)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.38)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - nr - 6, coneTop + 22);
      ctx.lineTo(x - nr - 1, coneTop + 22);
      ctx.lineTo(x - br + 26, bottom - 18);
      ctx.lineTo(x - br + 16, bottom - 18);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.5 * T().highlight;
      ctx.beginPath();
      ctx.moveTo(x + nr + 9, coneTop + 30);
      ctx.lineTo(x + nr + 12, coneTop + 30);
      ctx.lineTo(x + br - 10, bottom - 22);
      ctx.lineTo(x + br - 14, bottom - 22);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = T().highlight;
      // Hals-Glanz
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - nr + 3, G.flaskTopInnerY, 2, coneTop - G.flaskTopInnerY - 8);
      // Randwulst
      const top = G.flaskTopInnerY - 6;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = T().glassRim2;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(x, top, nr + 7, 3.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Bodenreflex
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, bottom + 2, br - 8, 3.5, 0, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    _flaskMarks(ctx) {
      // Näherungsmarken (wie auf echten Erlenmeyerkolben) aus der Kolbengeometrie
      const x = L.flask.x;
      ctx.save();
      ctx.strokeStyle = T().flaskMark;
      ctx.fillStyle = T().flaskMark;
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
      // Emaille-Schreibfeld
      const y = G.flaskSurfaceY(10) - 6;
      ctx.fillStyle = T().flaskField;
      roundRect(ctx, x - 66, y - 8, 42, 16, 2);
      ctx.fill();
      ctx.fillStyle = T().flaskFieldText;
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
      g.addColorStop(1, '#9aa6b2');
      ctx.fillStyle = g;
      roundRect(ctx, x - proj / 2, y - hgt / 2, proj, hgt, hgt / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      roundRect(ctx, x - proj / 2 + 3, y - hgt / 2 + 2, Math.max(0, proj - 6), 2.5, 1.2);
      ctx.fill();
    }

    _drawPlumes(ctx, surfaceY, halfW, bulk) {
      const exp = this.exp;
      const depth = Math.max(4, L.flask.innerBottom - surfaceY);
      const dilution = this._indicatorConc();
      for (const p of this.plumes) {
        const pH = exp.plumePH(p.vol, p.mixed);
        const c = this._liquidRGBA(Ind.solutionColor(this.opts.indicator, pH, dilution));
        const diff = (Math.abs(c[0] - bulk[0]) + Math.abs(c[1] - bulk[1]) + Math.abs(c[2] - bulk[2])) / 255 +
          Math.abs(c[3] - bulk[3]);
        if (diff < 0.02) continue;
        const a = clamp(diff * 1.6, 0, 0.9) * Math.max(0, 1 - p.age / 14);
        const sink = Math.min(1, p.age / (this.opts.stirrer ? 0.6 : 3));
        const swirlR = this.reduceMotion ? 0 : this.stirSpeed * halfW * 0.55 * Math.min(1, p.age * 1.4);
        const ang = p.phase + p.age * 6 * this.stirSpeed;
        const px = lerp(p.x0, L.flask.x, sink * 0.4) + Math.sin(ang) * swirlR + p.drift * 10 * p.age;
        const r = 4 + 10 * Math.sqrt(Math.min(p.mixed, 10)) * clamp(depth / 45, 0.5, 1.5);
        const py = surfaceY + 2 + r * 0.3 + sink * depth * 0.45 + Math.cos(ang) * Math.min(depth * 0.2, swirlR * 0.15);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, rgba(c, a));
        g.addColorStop(0.6, rgba(c, a * 0.45));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1.6, 0.75);
        ctx.translate(-px, -py);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // ---------- Magnetrührer ----------

    _drawStirrer(ctx) {
      const s = L.stirrer;
      const x0 = s.x - s.halfWidth;
      const w = 2 * s.halfWidth;
      // Gehäuse
      const body = ctx.createLinearGradient(0, s.top, 0, s.top + s.height);
      body.addColorStop(0, '#3b4552');
      body.addColorStop(0.25, '#2a323d');
      body.addColorStop(1, '#161b22');
      ctx.fillStyle = body;
      roundRect(ctx, x0, s.top + 6, w, s.height - 6, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x0 + 10, s.top + 16, w - 20, 1);
      // Keramik-Heizplatte (weiß, hilft beim Erkennen des Farbumschlags)
      const plate = ctx.createLinearGradient(0, s.top - 2, 0, s.top + 12);
      plate.addColorStop(0, '#f6f8fb');
      plate.addColorStop(0.6, '#d3dbe3');
      plate.addColorStop(1, '#9ea9b5');
      ctx.fillStyle = plate;
      roundRect(ctx, x0 + 8, s.top - 1, w - 16, 12, 5);
      ctx.fill();
      // Bedienfeld
      ctx.fillStyle = '#10151b';
      roundRect(ctx, x0 + 18, s.top + 24, w - 36, 36, 7);
      ctx.fill();
      // Drehknopf
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
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(kx + Math.cos(ka) * 9, ky + Math.sin(ka) * 9);
      ctx.stroke();
      // LED + Beschriftung
      const on = this.opts.stirrer;
      ctx.fillStyle = on ? '#3df58a' : '#24402f';
      if (on) { ctx.shadowColor = '#3df58a'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(kx + 30, ky, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(220,230,240,0.85)';
      ctx.font = '600 13px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Magnetrührer', kx + 42, ky - 7);
      ctx.fillStyle = 'rgba(170,185,200,0.85)';
      ctx.font = '500 11px ' + FONT;
      ctx.fillText(on ? 'Rühren · an  (antippen)' : 'Rühren · aus  (antippen)', kx + 42, ky + 9);
    }

    // ---------- pH-Elektrode und Messgerät ----------

    _electrodeX() { return B.x + 24; }

    _drawElectrodeArm(ctx) {
      const m = L.meter;
      const ex = this._electrodeX();
      const postX = m.x0 + 30;
      const armY = 494;
      const post = ctx.createLinearGradient(postX - 4, 0, postX + 4, 0);
      post.addColorStop(0, '#59626e');
      post.addColorStop(0.4, '#dfe6ee');
      post.addColorStop(1, '#3a414b');
      ctx.fillStyle = post;
      ctx.fillRect(postX - 4, armY - 6, 8, m.top - armY + 6);
      const arm = ctx.createLinearGradient(0, armY - 4, 0, armY + 4);
      arm.addColorStop(0, '#d9e0e8');
      arm.addColorStop(1, '#4b535e');
      ctx.fillStyle = arm;
      ctx.fillRect(ex + 8, armY - 3.5, postX - ex - 8, 7);
      ctx.fillStyle = '#2a3038';
      roundRect(ctx, postX - 9, armY - 10, 18, 20, 4);
      ctx.fill();
      // Halterring
      ctx.fillStyle = '#2f3741';
      roundRect(ctx, ex - 10, armY - 9, 20, 18, 4);
      ctx.fill();

      // Kabel zum Messgerät
      ctx.strokeStyle = T().cable;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex, 472);
      ctx.bezierCurveTo(ex + 10, 380, m.x1 + 40, 430, m.x1 - 12, m.top + 30);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Elektrodenkopf und Schaft bis zum Kolbenhals
      const head = ctx.createLinearGradient(ex - 7, 0, ex + 7, 0);
      head.addColorStop(0, '#11161c');
      head.addColorStop(0.4, '#3b4450');
      head.addColorStop(1, '#0d1116');
      ctx.fillStyle = head;
      roundRect(ctx, ex - 7, 470, 14, 52, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(ex - 4, 474, 1.5, 44);
      this._electrodeShaft(ctx, 522, G.flaskTopInnerY - 6);
    }

    _electrodeShaft(ctx, y0, y1) {
      const ex = this._electrodeX();
      const g = ctx.createLinearGradient(ex - 6, 0, ex + 6, 0);
      g.addColorStop(0, 'rgba(200,225,250,0.45)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(200,225,250,0.40)');
      ctx.fillStyle = g;
      ctx.fillRect(ex - 6, y0, 12, y1 - y0);
      ctx.strokeStyle = T().glass;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(ex - 6, y0, 12, y1 - y0);
      // Ableitelement (Silberdraht)
      ctx.strokeStyle = 'rgba(210,215,225,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ex, y0); ctx.lineTo(ex, y1); ctx.stroke();
    }

    _drawElectrodeInFlask(ctx) {
      const ex = this._electrodeX();
      const yTop = G.flaskTopInnerY - 8;
      const yBulb = L.flask.innerBottom - 16;
      this._electrodeShaft(ctx, yTop, yBulb - 4);
      // Diaphragma
      ctx.fillStyle = 'rgba(240,230,200,0.7)';
      ctx.fillRect(ex + 4, yBulb - 22, 2, 4);
      // Glasmembran-Kugel
      const g = ctx.createRadialGradient(ex - 2, yBulb - 2, 1, ex, yBulb, 8);
      g.addColorStop(0, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.5, 'rgba(200,225,250,0.30)');
      g.addColorStop(1, 'rgba(160,200,240,0.55)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex, yBulb, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = T().glass;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    _drawMeter(ctx) {
      const m = L.meter;
      const w = m.x1 - m.x0;
      const h = L.benchY - m.top;
      const body = ctx.createLinearGradient(0, m.top, 0, L.benchY);
      body.addColorStop(0, '#dfe5ec');
      body.addColorStop(0.08, '#c3ccd6');
      body.addColorStop(1, '#8792a0');
      ctx.fillStyle = body;
      roundRect(ctx, m.x0, m.top, w, h, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(m.x0 + 12, m.top + 1, w - 24, 1);

      // Display
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

      const pH = this.exp.pHMeasured;
      const displayOn = this.opts.meterDisplay !== false;
      if (displayOn) {
      ctx.fillStyle = '#9dffc8';
      ctx.shadowColor = 'rgba(80,255,170,0.6)';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '700 38px ' + MONO;
      ctx.fillText(this.opts.meterLive === false ? '--,--' : fmt(pH, 2), dx + dw - 10, dy + 50);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.textAlign = 'left';
      ctx.font = '700 15px ' + FONT;
      ctx.fillStyle = 'rgba(157,255,200,0.85)';
      ctx.fillText('pH', dx + 9, dy + 21);
      ctx.font = '500 11px ' + MONO;
      ctx.fillStyle = 'rgba(157,255,200,0.55)';
      ctx.fillText('25,0 °C', dx + 9, dy + 58);
      }
      // Ein/Aus-Taste für die Anzeige
      const bx = m.x0 + 30;
      const by = m.top + 104;
      const btn = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 12);
      btn.addColorStop(0, '#6b7785');
      btn.addColorStop(1, '#2c333c');
      ctx.fillStyle = btn;
      ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = displayOn ? '#9dffc8' : '#c9d2dc';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(bx, by, 5.5, -Math.PI * 0.3, Math.PI * 1.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by - 7.5); ctx.lineTo(bx, by - 2); ctx.stroke();
      ctx.fillStyle = displayOn ? '#3df58a' : '#3a4a3f';
      if (displayOn) { ctx.shadowColor = '#3df58a'; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(bx + 20, by, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(30,40,52,0.8)';
      ctx.font = '600 11px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayOn ? 'Anzeige an' : 'Anzeige aus', bx + 28, by);
      ctx.font = '700 12px ' + FONT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('pH-Meter', m.x1 - 12, m.top + 130);
    }

    // ---------- Beschriftungen ----------

    _drawLabels(ctx) {
      const lab = this.opts.labels;
      if (lab.titrant) {
        this._tag(ctx, B.x + 50, 26, lab.titrant.title, lab.titrant.lines, B.x + B.innerHalf + B.wall + 2, 52);
      }
      if (lab.sample) {
        const y = G.flaskConeTopY + 30;
        this._tag(ctx, 352, y - 10, lab.sample.title, lab.sample.lines, L.flask.x - 70, y + 70, 'right');
      }
    }

    _tag(ctx, x, y, title, lines, ax, ay, side) {
      ctx.save();
      ctx.font = '700 12px ' + FONT;
      let w = ctx.measureText(title.toUpperCase()).width;
      ctx.font = '600 15.5px ' + FONT;
      for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      w += 26;
      const h = 28 + lines.length * 20;
      // side 'right': x ist die rechte Kante des Etiketts
      if (side === 'right') x -= w;
      // Etikett im sichtbaren Ausschnitt halten (schmale Bühne neben der Kurve)
      const v = this.view;
      const wx0 = -v.ox / v.scale;
      const wx1 = (v.w - v.ox) / v.scale;
      x = clamp(x, wx0 + 8, Math.max(wx0 + 8, wx1 - w - 8));
      // Leitlinie
      ctx.strokeStyle = T().tagLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      const sx = side === 'right' ? x + w : x;
      ctx.moveTo(sx, y + h / 2);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = T().tagDot;
      ctx.beginPath(); ctx.arc(ax, ay, 2.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = T().tagBg;
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = T().tagBorder;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '700 12px ' + FONT;
      ctx.fillStyle = T().tagTitle;
      ctx.fillText(title.toUpperCase(), x + 13, y + 19);
      ctx.font = '600 15.5px ' + FONT;
      ctx.fillStyle = T().tagText;
      lines.forEach(function (l, i) { ctx.fillText(l, x + 13, y + 40 + i * 20); });
      ctx.restore();
    }

    // ---------- Ablese-Lupe ----------

    _drawLens(ctx) {
      const lz = L.lens;
      const yM = G.buretteY(this.exp.reading);
      const cx = B.x + lz.dx;
      const cy = clamp(yM, 200, 430);
      const R = lz.radius;
      const oh = B.innerHalf + B.wall;

      // Verbindungslinien
      ctx.strokeStyle = T().lensLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(B.x + oh + 1, yM - 5);
      ctx.lineTo(cx - R * 0.8, cy - R * 0.6);
      ctx.moveTo(B.x + oh + 1, yM + 5);
      ctx.lineTo(cx - R * 0.8, cy + R * 0.6);
      ctx.stroke();
      ctx.strokeStyle = T().lensLine2;
      ctx.strokeRect(B.x - oh - 3, yM - 6, 2 * oh + 6, 12);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      const bg = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, R);
      bg.addColorStop(0, T().lensBg0);
      bg.addColorStop(1, T().lensBg1);
      ctx.fillStyle = bg;
      ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      ctx.translate(cx, cy);
      ctx.scale(lz.zoom, lz.zoom);
      ctx.translate(-B.x + 6, -yM);
      this._drawBurette(ctx, true);
      ctx.restore();

      // Fassung
      ctx.lineWidth = 6;
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, '#e2e8ef');
      rim.addColorStop(0.5, '#6c7683');
      rim.addColorStop(1, '#2b323b');
      ctx.strokeStyle = rim;
      ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, R - 8, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.fillStyle = T().lensCaption;
      ctx.font = '600 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Ablesehilfe · Unterkante Meniskus', cx, cy + R + 10);
    }

    _drawHints(ctx) {
      if (this.opts.hintStopcock) {
        const t = this.reduceMotion ? 0.35 : (this.time % 1.6) / 1.6;
        ctx.strokeStyle = 'rgba(' + T().hintRing + ',' + (0.7 * (1 - t)).toFixed(3) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(B.x, B.stopcockY, 30 + t * 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = T().hintBg;
        roundRect(ctx, B.x + 62, B.stopcockY - 16, 124, 32, 16);
        ctx.fill();
        ctx.fillStyle = T().hintText;
        ctx.font = '600 13.5px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Hahn antippen', B.x + 124, B.stopcockY);
      }
      if (this.reduceMotion) return;
      for (const tp of this.taps) {
        const t = tp.age / 0.6;
        ctx.strokeStyle = 'rgba(' + T().tapRing + ',' + (0.6 * (1 - t)).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 20 + t * 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  NS.LabRenderer = LabRenderer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
