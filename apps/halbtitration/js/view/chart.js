/*
 * Titrationskurve (Canvas 2D)
 * ---------------------------
 * Zeigt ausschließlich protokollierte Messpunkte. Verbindungslinien sind
 * als solche erkennbar (dünn), Messpunkte als Kreise; nicht stabil
 * übernommene Werte erscheinen als offene Kreise. Die aktuelle Position
 * (Live-Anzeige) ist kein Messpunkt und wird gestrichelt markiert.
 *
 * Modellreferenz, Literatur-pK-Linien und Näherungswerte erscheinen nur,
 * wenn die Oberfläche sie nach der Freigabe übergibt.
 *
 * Bedienung (Pointer Events, Tastatur):
 *  Modus „read“   – Antippen/Ziehen wählt den nächsten Messpunkt der aktiven Reihe
 *  Modus „marker“ – Antippen/Ziehen setzt den aktiven Marker (interpoliert)
 *  Pfeiltasten verschieben Cursor bzw. Marker (0,05 mL; mit Umschalt 0,5 mL)
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});
  const fmt = NS.Format.fmt;
  const Ev = NS.Evaluation;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  const COLORS = {
    s1: '#1f6fe5',
    s2: '#d4572a',
    pale: 'rgba(120,135,150,0.55)',
    grid: 'rgba(30,50,70,0.08)',
    axis: '#3d4b59',
    model: '#6b7a89',
    approx: '#7a3fc2',
    lit: '#138a5b',
    target: '#d26a00',
  };

  function niceStep(range, target) {
    const raw = range / target;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  }

  class TitrationChart {
    constructor(canvas, callbacks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cb = callbacks || {};
      this.series = [];
      this.activeId = null;
      this.current = null; // {v, pH, live:true}
      this.markers = []; // {key, v, pH, label, color, interpolated}
      this.target = null; // eigene Zielmarke (mL)
      this.endpoints = []; // {v, label}
      this.band = null; // {range:[lo,hi], color, label}
      this.model = null; // [{v,pH}]
      this.litLines = []; // {pH, label}
      this.approxPoints = []; // {v, pH, label}
      this.mode = 'read';
      this.activeMarker = null;
      this.cursor = null; // {seriesId, index}
      this.xMode = 'capacity';
      this.capacity = 50;
      this.dirty = true;
      this.size = { w: 0, h: 0, dpr: 1 };
      this.pad = { l: 46, r: 14, t: 14, b: 38 };
      this._bind();
    }

    setData(d) {
      Object.assign(this, d);
      this.dirty = true;
    }

    activeSeries() {
      return this.series.find(function (s) { return s.id === this.activeId; }, this) || null;
    }

    /** x-Bereich: Bürettenskala oder Messbereich (gerundet, verrät keinen ÄP) */
    range() {
      if (this.xMode === 'data') {
        let vMax = 0;
        this.series.forEach(function (s) { s.points.forEach(function (p) { if (p.v > vMax) vMax = p.v; }); });
        if (this.current) vMax = Math.max(vMax, this.current.v);
        const step = 5;
        return [0, Math.min(this.capacity, Math.max(10, Math.ceil((vMax + 1) / step) * step))];
      }
      if (this.xMode === 'zoom' && this.zoom) return this.zoom;
      return [0, this.capacity];
    }

    setZoom(center, width) {
      const w = Math.max(1, Math.min(this.capacity, width));
      let x0 = center - w / 2;
      let x1 = center + w / 2;
      if (x0 < 0) { x1 -= x0; x0 = 0; }
      if (x1 > this.capacity) { x0 -= x1 - this.capacity; x1 = this.capacity; }
      this.zoom = [Math.max(0, x0), x1];
      this.xMode = 'zoom';
      this.dirty = true;
    }

    // ---------- Koordinaten ----------

    _plot() {
      const p = this.pad;
      return { x0: p.l, y0: p.t, x1: this.size.w - p.r, y1: this.size.h - p.b };
    }
    _vx(v) { const r = this.range(); const a = this._plot(); return a.x0 + ((v - r[0]) / (r[1] - r[0])) * (a.x1 - a.x0); }
    _py(pH) { const a = this._plot(); return a.y1 - (pH / 14) * (a.y1 - a.y0); }
    _xv(x) { const r = this.range(); const a = this._plot(); return r[0] + ((x - a.x0) / (a.x1 - a.x0)) * (r[1] - r[0]); }

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
      this.canvas.addEventListener('pointermove', function (e) { if (active) handle(e); });
      const end = function () { active = false; };
      this.canvas.addEventListener('pointerup', end);
      this.canvas.addEventListener('pointercancel', end);
      this.canvas.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        self.nudge(dir * (e.shiftKey ? 0.5 : 0.05));
      });
    }

    _pointer(px) {
      const v = Math.max(0, Math.min(this.capacity, this._xv(px)));
      if (this.mode === 'marker' && this.activeMarker) {
        this._setMarker(Math.round(v * 100) / 100);
      } else {
        this._selectNearest(v);
      }
    }

    _setMarker(v) {
      if (this.cb.onMarker) this.cb.onMarker(this.activeMarker, v);
      this.dirty = true;
    }

    _selectNearest(v) {
      const s = this.activeSeries();
      if (!s || !s.points.length) return;
      let best = 0;
      s.points.forEach(function (p, i) { if (Math.abs(p.v - v) < Math.abs(s.points[best].v - v)) best = i; });
      this.cursor = { seriesId: s.id, index: best };
      if (this.cb.onRead) this.cb.onRead(s.points[best], s);
      this.dirty = true;
    }

    nudge(dv) {
      if (this.mode === 'marker' && this.activeMarker) {
        const m = this.markers.find(function (x) { return x.key === this.activeMarker; }, this);
        const base = m && Number.isFinite(m.v) ? m.v : this.range()[0];
        this._setMarker(Math.round(Math.max(0, Math.min(this.capacity, base + dv)) * 100) / 100);
        return;
      }
      const s = this.activeSeries();
      if (!s || !s.points.length) return;
      const sorted = s.points;
      let i = this.cursor && this.cursor.seriesId === s.id ? this.cursor.index : 0;
      i = Math.max(0, Math.min(sorted.length - 1, i + (dv > 0 ? 1 : -1)));
      this.cursor = { seriesId: s.id, index: i };
      if (this.cb.onRead) this.cb.onRead(sorted[i], s);
      this.dirty = true;
    }

    // ---------- Zeichnen ----------

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (w !== this.size.w || h !== this.size.h || dpr !== this.size.dpr) {
        this.size = { w: w, h: h, dpr: dpr };
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.dirty = true;
      }
    }

    draw(force) {
      this.resize();
      if (!this.dirty && !force) return;
      this.dirty = false;
      const ctx = this.ctx;
      const d = this.size.dpr;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, this.size.w, this.size.h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.size.w, this.size.h);
      const a = this._plot();
      if (a.x1 - a.x0 < 40 || a.y1 - a.y0 < 40) return;
      const r = this.range();

      // Indikator-Umschlagsband
      if (this.band && this.band.range) {
        const y0 = this._py(this.band.range[1]);
        const y1 = this._py(this.band.range[0]);
        ctx.fillStyle = this.band.color || 'rgba(214,28,132,0.12)';
        ctx.fillRect(a.x0, y0, a.x1 - a.x0, y1 - y0);
        ctx.fillStyle = '#4a5866';
        ctx.font = '600 11px ' + FONT;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(this.band.label, a.x1 - 4, y0 + 2);
      }

      // Gitter und Achsen
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.font = '12px ' + FONT;
      ctx.fillStyle = COLORS.axis;
      const xs = niceStep(r[1] - r[0], Math.max(4, Math.floor((a.x1 - a.x0) / 70)));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let v = Math.ceil(r[0] / xs) * xs; v <= r[1] + 1e-9; v += xs) {
        const x = this._vx(v);
        ctx.beginPath(); ctx.moveTo(x, a.y0); ctx.lineTo(x, a.y1); ctx.stroke();
        ctx.fillText(fmt(v, xs < 1 ? 1 : 0), x, a.y1 + 5);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let p = 0; p <= 14; p += 2) {
        const y = this._py(p);
        ctx.beginPath(); ctx.moveTo(a.x0, y); ctx.lineTo(a.x1, y); ctx.stroke();
        ctx.fillText(String(p), a.x0 - 6, y);
      }
      ctx.strokeStyle = COLORS.axis;
      ctx.beginPath(); ctx.moveTo(a.x0, a.y0); ctx.lineTo(a.x0, a.y1); ctx.lineTo(a.x1, a.y1); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '600 12px ' + FONT;
      ctx.fillText('V(Maßlösung) zugegeben in mL', (a.x0 + a.x1) / 2, this.size.h - 2);
      ctx.save();
      ctx.translate(12, (a.y0 + a.y1) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'middle';
      ctx.fillText('pH', 0, 0);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.rect(a.x0, a.y0 - 6, a.x1 - a.x0, a.y1 - a.y0 + 12);
      ctx.clip();

      // Literatur-pK-Linien (nach Freigabe)
      this.litLines.forEach(function (l) {
        const y = this._py(l.pH);
        ctx.strokeStyle = COLORS.lit;
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(a.x0, y); ctx.lineTo(a.x1, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.lit;
        ctx.font = '600 11px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(l.label, a.x0 + 4, y - 2);
      }, this);

      // Modellreferenz (nach Freigabe)
      if (this.model && this.model.length) {
        ctx.strokeStyle = COLORS.model;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        this.model.forEach(function (p, i) {
          const x = this._vx(p.v);
          const y = this._py(p.pH);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }, this);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Messreihen: inaktive blass zuerst
      const ordered = this.series.slice().sort(function (s1, s2) { return (s1.id === this.activeId) - (s2.id === this.activeId); }.bind(this));
      ordered.forEach(function (s) { this._drawSeries(ctx, s, s.id === this.activeId); }, this);

      // Endpunkte (beobachteter Farbumschlag)
      this.endpoints.forEach(function (e) {
        const x = this._vx(e.v);
        ctx.fillStyle = '#b0177a';
        ctx.beginPath(); ctx.moveTo(x, a.y1 - 1); ctx.lineTo(x - 7, a.y1 - 13); ctx.lineTo(x + 7, a.y1 - 13); ctx.closePath(); ctx.fill();
        ctx.font = '600 11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(e.label, x, a.y1 - 15);
      }, this);

      // Zielmarke
      if (Number.isFinite(this.target)) {
        const x = this._vx(this.target);
        ctx.strokeStyle = COLORS.target;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(x, a.y0); ctx.lineTo(x, a.y1); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.target;
        ctx.font = '700 11px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Ziel ' + fmt(this.target, 2) + ' mL', x + 4, a.y1 - 18);
      }

      // Marker der Lernenden
      this.markers.forEach(function (m, i) {
        if (!Number.isFinite(m.v)) return;
        const x = this._vx(m.v);
        const active = this.mode === 'marker' && this.activeMarker === m.key;
        ctx.strokeStyle = m.color;
        ctx.lineWidth = active ? 2.2 : 1.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(x, a.y0 + 14); ctx.lineTo(x, a.y1); ctx.stroke();
        if (Number.isFinite(m.pH)) {
          const y = this._py(m.pH);
          ctx.beginPath(); ctx.moveTo(a.x0, y); ctx.lineTo(x, y); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 2;
          ctx.stroke();
          if (m.interpolated) {
            ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.stroke();
          }
        }
        ctx.setLineDash([]);
        ctx.fillStyle = m.color;
        ctx.font = '700 11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(m.label, x, a.y0 + (i % 2) * 13);
      }, this);

      // Näherungswerte (nach Freigabe)
      this.approxPoints.forEach(function (p) {
        const x = this._vx(p.v);
        const y = this._py(p.pH);
        ctx.fillStyle = COLORS.approx;
        ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
      }, this);

      // Aktuelle Position (Live-Wert, kein Messpunkt)
      if (this.current && Number.isFinite(this.current.v)) {
        const x = this._vx(this.current.v);
        ctx.strokeStyle = 'rgba(30,50,70,0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(x, a.y0); ctx.lineTo(x, a.y1); ctx.stroke();
        ctx.setLineDash([]);
        if (Number.isFinite(this.current.pH)) {
          const y = this._py(this.current.pH);
          ctx.strokeStyle = '#18222d';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
        }
      }

      // Cursor (Ablesen)
      if (this.cursor) {
        const s = this.series.find(function (q) { return q.id === this.cursor.seriesId; }, this);
        const p = s && s.points[this.cursor.index];
        if (p) {
          const x = this._vx(p.v);
          const y = this._py(p.pH);
          ctx.strokeStyle = '#18222d';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();

      if (!this.series.some(function (s) { return s.points.length; })) {
        ctx.fillStyle = '#74828f';
        ctx.font = '600 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Noch keine Messwerte', (a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
      }
    }

    _drawSeries(ctx, s, active) {
      if (!s.points.length) return;
      const pts = s.points.slice().sort(function (p, q) { return p.v - q.v; });
      const col = active ? s.color : COLORS.pale;
      ctx.strokeStyle = col;
      ctx.lineWidth = active ? 1.4 : 1;
      ctx.beginPath();
      pts.forEach(function (p, i) {
        const x = this._vx(p.v);
        const y = this._py(p.pH);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }, this);
      ctx.stroke();
      const r = active ? 3.6 : 2.6;
      pts.forEach(function (p) {
        const x = this._vx(p.v);
        const y = this._py(p.pH);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (p.stable) { ctx.fillStyle = col; ctx.fill(); }
        else { ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = col; ctx.stroke(); }
      }, this);
    }

    /** Ableitung ΔpH/ΔV der aktiven Reihe (für die optionale Ansicht) */
    derivative() {
      const s = this.activeSeries();
      return s ? Ev.derivative(s.points) : [];
    }
  }

  TitrationChart.COLORS = COLORS;
  NS.TitrationChart = TitrationChart;
})(typeof globalThis !== 'undefined' ? globalThis : this);
