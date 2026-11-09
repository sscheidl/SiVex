/*
 * Titrationskurve (Canvas 2D)
 * ---------------------------
 * Zeigt ausschließlich die tatsächlich aufgezeichneten Messpunkte.
 * Die theoretische Kurve erscheint nur im Lehrkraftmodus, der
 * theoretische Äquivalenzpunkt erst nach Freigabe in der Auswertung.
 *
 * Bedienung (Maus und Touch über Pointer Events):
 *   Modus „Ablesen“  – Antippen/Ziehen setzt einen Cursor auf den nächsten Messpunkt
 *   Modus „ÄP markieren“ – Antippen/Ziehen setzt die eigene Äquivalenzpunkt-Markierung
 */
(function (global) {
  'use strict';

  const NS = (global.Titrierlabor = global.Titrierlabor || {});
  const Ind = NS.Indicators;
  const Chem = NS.Chemistry;
  const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

  function fmt(x, d) { return NS.Config.formatNumber(x, d); }

  function niceStep(range, target) {
    const raw = range / target;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    const m = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
    return m * p;
  }

  class TitrationChart {
    constructor(canvas, callbacks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cb = callbacks || {};
      this.points = [];
      this.current = null;
      this.indicator = 'phenolphthalein';
      this.teacherCurve = null;
      this.revealedEq = null; // {v, region:[v1,v2]}
      this.mode = 'read';
      this.cursor = null; // Index in sortierten Punkten
      this.marker = null; // {v, pH}
      this.showDerivative = false;
      this.zoom = null; // [x0, x1] oder null = automatisch
      this.maxAuto = 10;
      this.frozenMax = null;
      this.dirty = true;
      this.size = { w: 0, h: 0, dpr: 1 };
      this.pad = { l: 46, r: 18, t: 14, b: 36 };
      this._bind();
    }

    // ---------- Daten ----------

    setData(d) {
      this.points = d.points || [];
      this.current = d.current || null;
      if (d.indicator) this.indicator = d.indicator;
      this.teacherCurve = d.teacherCurve || null;
      this.revealedEq = d.revealedEq || null;
      this.dirty = true;
    }

    setMode(mode) {
      this.mode = mode;
      this.dirty = true;
    }

    setDerivative(on) {
      this.showDerivative = !!on;
      this.pad.r = on ? 48 : 18;
      this.dirty = true;
    }

    clearMarker() {
      this.marker = null;
      this.dirty = true;
    }

    reset() {
      this.cursor = null;
      this.marker = null;
      this.zoom = null;
      this.maxAuto = 10;
      this.frozenMax = null;
      this.dirty = true;
    }

    /** x-Achse automatisch mitwachsen lassen (verrät den ÄP nicht) */
    _autoRange() {
      if (this.frozenMax) return [0, this.frozenMax];
      let vMax = 0;
      for (const p of this.points) if (p.v > vMax) vMax = p.v;
      if (this.current) vMax = Math.max(vMax, this.current.v);
      const need = Math.max(10, vMax * 1.15 + 1);
      while (this.maxAuto < need && this.maxAuto < 50) this.maxAuto += this.maxAuto < 20 ? 5 : 10;
      return [0, Math.min(50, this.maxAuto)];
    }

    /** Achse für die Auswertung auf den Messbereich festlegen */
    freezeRange() {
      if (!this.points.length) {
        this.frozenMax = null;
        return;
      }
      let vMax = 0;
      for (const p of this.points) if (p.v > vMax) vMax = p.v;
      const step = niceStep(Math.max(vMax, 1), 6);
      this.frozenMax = Math.min(50, Math.max(step, Math.ceil((vMax * 1.04) / step) * step));
      this.dirty = true;
    }

    unfreeze() {
      this.frozenMax = null;
      this.dirty = true;
    }

    range() {
      return this.zoom || this._autoRange();
    }

    zoomBy(factor) {
      const r = this.range();
      const full = this._autoRange();
      let c = (r[0] + r[1]) / 2;
      if (this.marker) c = this.marker.v;
      else if (this.cursor !== null && this._sorted()[this.cursor]) c = this._sorted()[this.cursor].v;
      let w = (r[1] - r[0]) * factor;
      const fullW = full[1] - full[0];
      if (w >= fullW * 0.999) { this.zoom = null; this.dirty = true; return; }
      w = Math.max(0.4, w);
      let x0 = c - w / 2;
      let x1 = c + w / 2;
      if (x0 < full[0]) { x1 += full[0] - x0; x0 = full[0]; }
      if (x1 > full[1]) { x0 -= x1 - full[1]; x1 = full[1]; }
      this.zoom = [Math.max(full[0], x0), x1];
      this.dirty = true;
    }

    zoomReset() {
      this.zoom = null;
      this.dirty = true;
    }

    _sorted() {
      if (this._sortedCache && this._sortedSrc === this.points && this._sortedLen === this.points.length) {
        return this._sortedCache;
      }
      this._sortedSrc = this.points;
      this._sortedLen = this.points.length;
      this._sortedCache = this.points.slice().sort(function (a, b) { return a.v - b.v; });
      return this._sortedCache;
    }

    /** pH an der Stelle v durch lineare Interpolation der Messpunkte */
    interpolate(v) {
      const pts = this._sorted();
      if (!pts.length) return null;
      if (v <= pts[0].v) return pts[0].pH;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].v >= v) {
          const a = pts[i - 1];
          const b = pts[i];
          const t = b.v - a.v > 1e-12 ? (v - a.v) / (b.v - a.v) : 0;
          return a.pH + t * (b.pH - a.pH);
        }
      }
      return pts[pts.length - 1].pH;
    }

    // ---------- Interaktion ----------

    _bind() {
      const self = this;
      let active = false;
      const handle = function (e) {
        const rect = self.canvas.getBoundingClientRect();
        self._pointer(e.clientX - rect.left, e.clientY - rect.top);
      };
      this.canvas.addEventListener('pointerdown', function (e) {
        active = true;
        try { self.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorieren */ }
        handle(e);
        e.preventDefault();
      });
      this.canvas.addEventListener('pointermove', function (e) {
        if (active) handle(e);
      });
      const end = function () { active = false; };
      this.canvas.addEventListener('pointerup', end);
      this.canvas.addEventListener('pointercancel', end);
    }

    _pointer(px, py) {
      const pts = this._sorted();
      if (!pts.length) return;
      const v = this._xToV(px);
      const r = this.range();
      const vc = Math.min(Math.max(v, r[0]), r[1]);
      if (this.mode === 'mark') {
        const vMax = pts[pts.length - 1].v;
        const vm = Math.min(Math.max(vc, pts[0].v), vMax);
        this.marker = { v: vm, pH: this.interpolate(vm) };
        if (this.cb.onMarker) this.cb.onMarker(this.marker);
      } else {
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const dx = this._vToX(pts[i].v) - px;
          const dy = this._phToY(pts[i].pH) - py;
          const d = dx * dx + dy * dy * 0.15;
          if (d < bestD) { bestD = d; best = i; }
        }
        this.cursor = best;
        if (this.cb.onCursor) this.cb.onCursor(pts[best]);
      }
      this.dirty = true;
    }

    // ---------- Koordinaten ----------

    _plot() {
      const s = this.size;
      return { x: this.pad.l, y: this.pad.t, w: s.w - this.pad.l - this.pad.r, h: s.h - this.pad.t - this.pad.b };
    }

    _vToX(v) {
      const p = this._plot();
      const r = this.range();
      return p.x + ((v - r[0]) / (r[1] - r[0])) * p.w;
    }

    _xToV(x) {
      const p = this._plot();
      const r = this.range();
      return r[0] + ((x - p.x) / p.w) * (r[1] - r[0]);
    }

    _phToY(pH) {
      const p = this._plot();
      return p.y + (1 - pH / 14) * p.h;
    }

    // ---------- Zeichnen ----------

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w !== this.size.w || h !== this.size.h || dpr !== this.size.dpr) {
        this.size = { w: w, h: h, dpr: dpr };
        this.canvas.width = Math.max(1, Math.round(w * dpr));
        this.canvas.height = Math.max(1, Math.round(h * dpr));
        this.dirty = true;
      }
    }

    draw(force) {
      this.resize();
      if (!this.dirty && !force) return;
      this.dirty = false;
      const ctx = this.ctx;
      const s = this.size;
      if (s.w < 50 || s.h < 50) return;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, s.w, s.h);
      const p = this._plot();
      const r = this.range();

      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x, p.y, p.w, p.h);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      this._drawIndicatorBand(ctx, p);
      this._drawEquivalence(ctx, p);
      this._drawGrid(ctx, p, r);
      if (this.showDerivative) this._drawDerivative(ctx, p);
      this._drawTeacherCurve(ctx);
      this._drawData(ctx, p);
      ctx.restore();

      this._drawAxes(ctx, p, r);
      this._drawMarker(ctx, p);
      this._drawCursor(ctx, p);
      this._drawCurrent(ctx, p);

      if (!this.points.length) {
        ctx.fillStyle = 'rgba(200,215,232,0.75)';
        ctx.font = '500 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Noch keine Messwerte – mit eingesetzter pH-Elektrode titrieren.', p.x + p.w / 2, p.y + p.h / 2);
      }
    }

    _drawIndicatorBand(ctx, p) {
      const ind = Ind.get(this.indicator);
      if (!ind.range) return;
      const y0 = this._phToY(ind.range[1]);
      const y1 = this._phToY(ind.range[0]);
      const g = ctx.createLinearGradient(0, y1, 0, y0);
      const ca = Ind.solutionColor(ind.id, ind.range[0], 1);
      const cb = Ind.solutionColor(ind.id, ind.range[1], 1);
      g.addColorStop(0, 'rgba(' + Math.round(ca.r) + ',' + Math.round(ca.g) + ',' + Math.round(ca.b) + ',0.16)');
      g.addColorStop(1, 'rgba(' + Math.round(cb.r) + ',' + Math.round(cb.g) + ',' + Math.round(cb.b) + ',0.22)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x, y0, p.w, y1 - y0);
      ctx.fillStyle = 'rgba(220,230,240,0.6)';
      ctx.font = '600 11.5px ' + FONT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('Umschlagsbereich ' + ind.name + ' (pH ' + fmt(ind.range[0], 1) + '–' + fmt(ind.range[1], 1) + ')',
        p.x + p.w - 6, y0 + 3);
    }

    _drawEquivalence(ctx, p) {
      const eq = this.revealedEq;
      if (!eq) return;
      if (eq.region) {
        const x0 = this._vToX(eq.region[0]);
        const x1 = this._vToX(eq.region[1]);
        ctx.fillStyle = 'rgba(61,245,138,0.08)';
        ctx.fillRect(x0, p.y, Math.max(2, x1 - x0), p.h);
      }
      const x = this._vToX(eq.v);
      ctx.strokeStyle = 'rgba(61,245,138,0.9)';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke();
      // pH-Wert am Äquivalenzpunkt (bei schwachen Säuren/Basen ≠ 7)
      if (Number.isFinite(eq.pH)) {
        const y = this._phToY(eq.pH);
        ctx.strokeStyle = 'rgba(61,245,138,0.45)';
        ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#3df58a';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(61,245,138,0.95)';
      ctx.font = '700 12px ' + FONT;
      ctx.textAlign = x > p.x + p.w - 190 ? 'right' : 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('theor. ÄP ' + fmt(eq.v, 2) + ' mL' + (Number.isFinite(eq.pH) ? ' · pH ' + fmt(eq.pH, 2) : ''),
        x + (ctx.textAlign === 'left' ? 6 : -6), p.y + 6);
      // Halbäquivalenzpunkt: pH ≈ pKs
      if (eq.half) {
        const hx = this._vToX(eq.half.v);
        const hy = this._phToY(eq.half.pH);
        ctx.strokeStyle = 'rgba(255,200,90,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,210,120,0.95)';
        ctx.font = '700 12px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = eq.half.pH > 7 ? 'top' : 'bottom';
        ctx.fillText('½ ÄP: pH ≈ pKs = ' + fmt(eq.half.pKa, 2), hx + 9, hy + (eq.half.pH > 7 ? 6 : -6));
      }
    }

    _drawGrid(ctx, p, r) {
      ctx.lineWidth = 1;
      for (let pH = 0; pH <= 14; pH++) {
        const y = Math.round(this._phToY(pH)) + 0.5;
        ctx.strokeStyle = pH === 7 ? 'rgba(255,255,255,0.0)' : 'rgba(255,255,255,' + (pH % 2 ? 0.035 : 0.07) + ')';
        ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); ctx.stroke();
      }
      const step = niceStep(r[1] - r[0], Math.max(4, Math.floor(p.w / 70)));
      for (let v = Math.ceil(r[0] / step) * step; v <= r[1] + 1e-9; v += step) {
        const x = Math.round(this._vToX(v)) + 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke();
      }
      // Neutralpunkt
      const y7 = this._phToY(7);
      ctx.strokeStyle = 'rgba(160,190,220,0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(p.x, y7); ctx.lineTo(p.x + p.w, y7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(160,190,220,0.7)';
      ctx.font = '600 11.5px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('pH 7 (neutral)', p.x + 6, y7 - 2);
    }

    _drawAxes(ctx, p, r) {
      ctx.strokeStyle = 'rgba(220,230,240,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + 0.5, p.y);
      ctx.lineTo(p.x + 0.5, p.y + p.h + 0.5);
      ctx.lineTo(p.x + p.w, p.y + p.h + 0.5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220,230,240,0.85)';
      ctx.font = '600 12.5px ' + FONT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let pH = 0; pH <= 14; pH += 2) ctx.fillText(String(pH), p.x - 7, this._phToY(pH));
      const step = niceStep(r[1] - r[0], Math.max(4, Math.floor(p.w / 70)));
      const dec = step < 0.1 ? 2 : step < 1 ? 1 : 0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let v = Math.ceil(r[0] / step - 1e-9) * step; v <= r[1] + 1e-9; v += step) {
        ctx.fillText(fmt(v, dec), this._vToX(v), p.y + p.h + 6);
      }
      ctx.font = '700 12px ' + FONT;
      ctx.fillStyle = 'rgba(160,200,240,0.95)';
      ctx.textAlign = 'right';
      ctx.fillText('V(Maßlösung) in mL', p.x + p.w, p.y + p.h + 21);
      ctx.save();
      ctx.translate(13, p.y + p.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('pH', 0, 0);
      ctx.restore();
    }

    _drawTeacherCurve(ctx) {
      if (!this.teacherCurve) return;
      ctx.strokeStyle = 'rgba(255,190,90,0.55)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      this.teacherCurve.forEach(function (pt, i) {
        const x = this._vToX(pt.v);
        const y = this._phToY(pt.pH);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }, this);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    _drawData(ctx, p) {
      const pts = this._sorted();
      if (!pts.length) return;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(76,201,240,0.25)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      pts.forEach(function (pt, i) {
        const x = this._vToX(pt.v);
        const y = this._phToY(pt.pH);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }, this);
      ctx.stroke();
      ctx.strokeStyle = '#4cc9f0';
      ctx.lineWidth = 2;
      ctx.stroke();
      const r = this.range();
      const visible = pts.filter(function (pt) { return pt.v >= r[0] && pt.v <= r[1]; }).length;
      const pxPer = p.w / Math.max(1, visible);
      if (pxPer > 5) {
        ctx.fillStyle = '#d8f5ff';
        for (const pt of pts) {
          ctx.beginPath();
          ctx.arc(this._vToX(pt.v), this._phToY(pt.pH), pxPer > 12 ? 2.6 : 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    _drawDerivative(ctx, p) {
      const d = Chem.derivative(this._sorted());
      if (d.length < 2) return;
      let max = 0;
      for (const q of d) max = Math.max(max, Math.abs(q.slope));
      if (max <= 0) return;
      const yBase = p.y + p.h;
      ctx.fillStyle = 'rgba(167,139,250,0.20)';
      ctx.strokeStyle = 'rgba(167,139,250,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this._vToX(d[0].v), yBase);
      for (const q of d) ctx.lineTo(this._vToX(q.v), yBase - (Math.abs(q.slope) / max) * p.h * 0.92);
      ctx.lineTo(this._vToX(d[d.length - 1].v), yBase);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      d.forEach(function (q, i) {
        const x = this._vToX(q.v);
        const y = yBase - (Math.abs(q.slope) / max) * p.h * 0.92;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }, this);
      ctx.stroke();
      // rechte Achse
      ctx.restore();
      ctx.save();
      ctx.fillStyle = 'rgba(167,139,250,0.95)';
      ctx.font = '600 11.5px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const xr = p.x + p.w + 6;
      ctx.fillText(fmt(max, max < 10 ? 1 : 0), xr, p.y + p.h * 0.08);
      ctx.fillText('0', xr, p.y + p.h);
      ctx.save();
      ctx.translate(this.size.w - 8, p.y + p.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('|ΔpH/ΔV| in 1/mL', 0, 0);
      ctx.restore();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x, p.y, p.w, p.h);
      ctx.clip();
    }

    _drawCurrent(ctx, p) {
      if (!this.current) return;
      const x = this._vToX(this.current.v);
      const y = this._phToY(this.current.pH);
      if (x < p.x - 1 || x > p.x + p.w + 1) return;
      const still = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const t = still ? 0.4 : (performance.now() % 1400) / 1400;
      ctx.fillStyle = 'rgba(76,201,240,' + (0.35 * (1 - t)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, 5 + t * 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#4cc9f0';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!still) this.dirty = true; // Pulsieren
    }

    _drawCursor(ctx, p) {
      if (this.cursor === null) return;
      const pt = this._sorted()[this.cursor];
      if (!pt) return;
      const x = this._vToX(pt.v);
      const y = this._phToY(pt.pH);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h);
      ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      this._tooltip(ctx, p, x, y, ['V = ' + fmt(pt.v, 2) + ' mL', 'pH = ' + fmt(pt.pH, 2)], 'rgba(14,22,32,0.92)', '#e8eef5');
    }

    _drawMarker(ctx, p) {
      if (!this.marker) return;
      const x = this._vToX(this.marker.v);
      const y = this._phToY(this.marker.pH);
      ctx.strokeStyle = '#ffb547';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke();
      ctx.fillStyle = '#ffb547';
      ctx.beginPath();
      ctx.moveTo(x, y - 8); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 8, y);
      ctx.closePath(); ctx.fill();
      ctx.font = '700 12px ' + FONT;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = x > p.x + p.w - 140 ? 'right' : 'left';
      ctx.fillText('Dein ÄP: ' + fmt(this.marker.v, 2) + ' mL', x + (ctx.textAlign === 'left' ? 6 : -6), p.y + p.h - 4);
    }

    _tooltip(ctx, p, x, y, lines, bg, fg) {
      ctx.font = '600 13px ' + FONT;
      let w = 0;
      for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      w += 18;
      const h = 10 + lines.length * 16;
      let tx = x + 12;
      let ty = y - h - 10;
      if (tx + w > p.x + p.w) tx = x - w - 12;
      if (ty < p.y) ty = y + 12;
      ctx.fillStyle = bg;
      ctx.strokeStyle = 'rgba(140,190,240,0.4)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(tx, ty, w, h, 6); else ctx.rect(tx, ty, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = fg;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach(function (l, i) { ctx.fillText(l, tx + 9, ty + 6 + i * 16); });
    }
  }

  NS.TitrationChart = TitrationChart;
})(typeof globalThis !== 'undefined' ? globalThis : this);
