/*
 * Pufferfish – Laborbühne (Canvas 2D, HiDPI)
 *
 * Darstellung von Glas, Flüssigkeit, Meniskus, Tropfen, Oberflächenimpulsen
 * und Mischschlieren nach TitraLab 3 (titration/js/view/lab-renderer.js:
 * _drawDrop, _liquidPath, _drawFlask, _drawPlumes, Wellengleichung in _update),
 * angepasst an zylindrische Bechergläser und den hellen SiVex-Laborhintergrund.
 * Der Renderer liest nur den Modellzustand (engine.state) und verändert ihn nie.
 */
(function (root) {
  'use strict';
  const C = root.PF.chem, G = root.PF.geometry;
  const WAVE_N = 34;
  const FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  class LabRenderer {
    constructor(canvas, engine, opts) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.eng = engine;
      this.opts = Object.assign({ indicator: true, reduceMotion: false }, opts || {});
      this.view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };
      this.fx = {}; // je Glas: Wellen, Ringe, Schlieren, Farbe
      this.splashes = []; this.time = 0; this.seriesId = null; this.streamTails = new Map();
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      if (w === this.view.w && h === this.view.h && dpr === this.view.dpr) return false;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      const scale = Math.min(w / G.W, h / G.H);
      Object.assign(this.view, { w, h, dpr, scale, ox: (w - G.W * scale) / 2, oy: (h - G.H * scale) / 2 });
      return true;
    }
    toScreen(x, y) { const v = this.view; return { x: v.ox + x * v.scale, y: v.oy + y * v.scale }; }

    beakerFx(i) {
      if (!this.fx[i]) this.fx[i] = { h: new Float32Array(WAVE_N), v: new Float32Array(WAVE_N), rings: [], plumes: [], color: null, stirA: 0 };
      return this.fx[i];
    }
    resetFx() { this.fx = {}; this.splashes = []; this.streamTails.clear(); }

    /** Auftreffen von Tropfen/Strahl (vom App-Loop aus engine.drainFx weitergereicht). */
    onLand(e, geo, s) {
      if (!s || s.id !== e.series) return;
      const b = s.beakers[e.beaker], g = geo[e.beaker];
      const f = this.beakerFx(e.beaker);
      const surf = G.surfaceY(g, b.comp.V);
      const x = G.tipOver(g, this.eng.state.tool).x;
      if (this.opts.indicator) {
        const last = f.plumes[f.plumes.length - 1];
        if (e.stream && last && last.stream && this.time - last.born < 0.4) last.vol += e.vol; // Strahl: eine wachsende Schliere
        else f.plumes.push({ x0: x, age: 0, born: this.time, vol: e.vol, share: 0.004, phase: Math.random() * 6.28, drift: Math.random() - 0.5, stream: e.stream });
        if (f.plumes.length > 40) f.plumes.shift();
      }
      if (this.opts.reduceMotion) return;
      const idx = clamp(Math.round(((x - (g.x - g.half)) / (2 * g.half)) * (WAVE_N - 1)), 2, WAVE_N - 3);
      const strength = e.stream ? 5 : 20;
      for (let k = -4; k <= 4; k++) { const i = idx + k; if (i >= 0 && i < WAVE_N) f.v[i] += strength * Math.exp(-(k * k) / 4); }
      if (!e.stream || Math.random() < 0.3) f.rings.push({ x, age: 0, life: 0.9 });
      if (!e.stream) for (let n = 0; n < 2; n++) this.splashes.push({ x, y: surf, vx: (Math.random() - 0.5) * 80, vy: -110 - Math.random() * 80, age: 0, life: 0.32 });
    }

    update(dt) {
      this.time += dt;
      const s = this.eng.current();
      if (s.id !== this.seriesId) { this.resetFx(); this.seriesId = s.id; }
      const t = this.eng.state.time;
      s.beakers.forEach((b, i) => {
        const f = this.beakerFx(i);
        const stirring = b.stirUntil > t;
        if (stirring && !this.opts.reduceMotion) f.stirA += dt * 7;
        // Wellengleichung mit Dämpfung (TitraLab 3)
        const h = f.h, v = f.v;
        const sub = Math.max(2, Math.ceil(dt / 0.004)), sdt = dt / sub;
        for (let k = 0; k < sub; k++) {
          for (let j = 0; j < WAVE_N; j++) {
            const l = h[j > 0 ? j - 1 : 1], r = h[j < WAVE_N - 1 ? j + 1 : WAVE_N - 2];
            v[j] += (1700 * (l + r - 2 * h[j]) - 3.8 * v[j] - 40 * h[j]) * sdt;
          }
          for (let j = 0; j < WAVE_N; j++) { v[j] = clamp(v[j], -150, 150); h[j] = clamp(h[j] + v[j] * sdt, -5, 5); }
        }
        if (stirring && !this.opts.reduceMotion && Math.random() < dt * 8) {
          const j = 3 + Math.floor(Math.random() * (WAVE_N - 6)); v[j] += (Math.random() - 0.5) * 8;
        }
        const tau = stirring ? 0.3 : 1.6;
        // Anteil der Lösung, mit dem sich die Zugabe schon vermischt hat – gleiche Zeitkonstante wie die Messwertanzeige
        f.plumes = f.plumes.filter((p) => { p.age += dt; p.share = Math.min(1, 0.004 * Math.exp(p.age / (tau * 0.6))); return p.share < 0.8; });
        f.rings = f.rings.filter((r) => { r.age += dt; return r.age < r.life; });
      });
      this.splashes = this.splashes.filter((p) => { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 1600 * dt; return p.age < p.life; });
    }

    /** Farbe [r,g,b,a] einer Lösung mit Indikator (schematisch) bzw. ohne. */
    liquidColor(pHv, k) {
      if (!this.opts.indicator) return [214, 230, 244, 0.42];
      const c = C.indicatorRGB(pHv);
      const s = clamp(k, 0, 1);
      return [lerp(225, c[0], 0.35 + 0.6 * s), lerp(235, c[1], 0.35 + 0.6 * s), lerp(245, c[2], 0.35 + 0.6 * s), 0.5 + 0.38 * s];
    }

    // ------------------------------------------------------------ Zeichnen
    frame(dt) {
      if (this.resize()) this.bg = null;
      this.update(dt);
      const ctx = this.ctx, v = this.view;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.bg) this.renderBackground();
      ctx.drawImage(this.bg, 0, 0);
      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      const s = this.eng.current(), geo = this.eng.geometry();
      this.drawBottles(ctx, s);
      this.drawRack(ctx);
      s.beakers.forEach((b, i) => { this.drawRef(ctx, b, geo[i]); this.drawBeaker(ctx, b, geo[i], i); });
      this.drawDrops(ctx, geo, s);
      this.drawPipettes(ctx, s);
    }

    renderBackground() {
      const c = this.bg || document.createElement('canvas');
      c.width = this.canvas.width; c.height = this.canvas.height;
      const ctx = c.getContext('2d'), v = this.view;
      const W = c.width, H = c.height;
      const wall = ctx.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#eef3f7'); wall.addColorStop(1, '#dde5ec');
      ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      const wx0 = -v.ox / v.scale, wx1 = (v.w - v.ox) / v.scale, wy0 = -v.oy / v.scale, wy1 = (v.h - v.oy) / v.scale;
      ctx.strokeStyle = 'rgba(120,140,160,0.12)'; ctx.lineWidth = 1;
      for (let x = Math.floor(wx0 / 64) * 64; x < wx1; x += 64) { ctx.beginPath(); ctx.moveTo(x, wy0); ctx.lineTo(x, G.BENCH); ctx.stroke(); }
      for (let y = Math.floor(wy0 / 64) * 64; y < G.BENCH; y += 64) { ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke(); }
      const glow = ctx.createRadialGradient(560, 280, 40, 560, 280, 600);
      glow.addColorStop(0, 'rgba(255,255,255,0.55)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(wx0, wy0, wx1 - wx0, G.BENCH - wy0);
      const bench = ctx.createLinearGradient(0, G.BENCH, 0, wy1);
      bench.addColorStop(0, '#c9d3dc'); bench.addColorStop(0.06, '#b8c4cf'); bench.addColorStop(1, '#a3b0bd');
      ctx.fillStyle = bench; ctx.fillRect(wx0, G.BENCH, wx1 - wx0, wy1 - G.BENCH);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(wx0, G.BENCH, wx1 - wx0, 1.4);
      this.bg = c;
    }

    shadow(ctx, x, y, rx, ry, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, `rgba(40,55,70,${a})`); g.addColorStop(1, 'rgba(40,55,70,0)');
      ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rx, 0, 6.283); ctx.fill(); ctx.restore();
    }

    drawBottles(ctx, s) {
      const B = G.BOTTLE;
      for (const key of ['HCl', 'NaOH']) {
        const x = G.BOTTLES[key].x, base = G.BENCH, top = base - B.h;
        const active = s.reagent === key;
        this.shadow(ctx, x, base + 2, B.w * 0.7, 6, 0.28);
        // Flaschenkörper (Klarglas) mit farbloser Maßlösung
        ctx.save();
        rr(ctx, x - B.w / 2, top + 22, B.w, B.h - 22, 9);
        ctx.fillStyle = 'rgba(220,234,246,0.55)'; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = 'rgba(200,222,242,0.55)'; ctx.fillRect(x - B.w / 2, top + 48, B.w, B.h);
        ctx.restore();
        ctx.strokeStyle = active ? 'rgba(11,114,133,0.95)' : 'rgba(90,115,140,0.7)'; ctx.lineWidth = active ? 2.4 : 1.4; ctx.stroke();
        // Hals und Kappe
        ctx.fillStyle = 'rgba(220,234,246,0.7)'; ctx.fillRect(x - B.neck, top + 6, 2 * B.neck, 18);
        ctx.strokeStyle = 'rgba(90,115,140,0.7)'; ctx.lineWidth = 1.2; ctx.strokeRect(x - B.neck, top + 6, 2 * B.neck, 18);
        // Etikett
        ctx.fillStyle = '#fff'; rr(ctx, x - B.w / 2 + 5, top + 58, B.w - 10, 34, 3); ctx.fill();
        ctx.strokeStyle = key === 'HCl' ? '#c92a2a' : '#1c7ed6'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#17212c'; ctx.font = '700 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(key, x, top + 70);
        ctx.font = '600 9px ' + FONT; ctx.fillText('0,100 M', x, top + 84);
        // Glanz
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - B.w / 2 + 5, top + 28, 3, B.h - 40);
        ctx.restore();
      }
    }

    drawRack(ctx) {
      // kleiner Pipettenständer
      const x0 = 180, x1 = 246, y = G.BENCH - 30;
      this.shadow(ctx, (x0 + x1) / 2, G.BENCH + 2, 44, 5, 0.25);
      ctx.fillStyle = '#8a98a8'; rr(ctx, x0, G.BENCH - 8, x1 - x0, 8, 3); ctx.fill();
      ctx.fillStyle = '#9aa8b7'; ctx.fillRect(x0 + 4, y - 4, 4, 26); ctx.fillRect(x1 - 8, y - 4, 4, 26);
      ctx.fillStyle = '#b3bfcb'; rr(ctx, x0, y - 6, x1 - x0, 7, 3); ctx.fill();
    }

    drawRef(ctx, b, g) {
      // Referenzprobe (unbehandelt) im Reagenzglas
      const r = g.ref, x = r.x, bottom = r.bottom - 6, top = bottom - r.h;
      const k = 1;
      const col = this.liquidColor(b.records[0].pH, k);
      this.shadow(ctx, x, G.BENCH + 2, 18, 4, 0.25);
      ctx.fillStyle = '#a7b3bf'; rr(ctx, x - 20, G.BENCH - 30, 40, 30, 4); ctx.fill(); // Ständer
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x - r.r, top); ctx.lineTo(x - r.r, bottom - r.r); ctx.arc(x, bottom - r.r, r.r, Math.PI, 0, true); ctx.lineTo(x + r.r, top);
      ctx.fillStyle = 'rgba(225,238,250,0.35)'; ctx.fill();
      ctx.save(); ctx.clip();
      const lvl = bottom - r.h * 0.55;
      ctx.fillStyle = rgba(col, col[3]); ctx.fillRect(x - r.r, lvl, 2 * r.r, bottom - lvl + 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x - r.r + 3, lvl + 3, 2.5, bottom - lvl - 14);
      ctx.restore();
      ctx.strokeStyle = 'rgba(90,115,140,0.75)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, top, r.r + 2, 2.4, 0, 0, 6.283); ctx.stroke();
      ctx.restore();
      // Wiederholte Vorderseite des Ständers
      ctx.fillStyle = 'rgba(167,179,191,0.95)'; rr(ctx, x - 20, G.BENCH - 18, 40, 18, 4); ctx.fill();
      ctx.fillStyle = '#17212c'; ctx.font = '700 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Ref.', x, G.BENCH - 9);
    }

    beakerPath(ctx, g, e) {
      const x = g.x, hw = g.half + e, top = g.top - 10, bottom = g.bottom + e, rc = 8 + e;
      ctx.beginPath();
      ctx.moveTo(x - hw - (e > 0 ? 5 : 3), top - 2); // Ausguss links
      ctx.quadraticCurveTo(x - hw, top, x - hw, top + 8);
      ctx.lineTo(x - hw, bottom - rc);
      ctx.quadraticCurveTo(x - hw, bottom, x - hw + rc, bottom);
      ctx.lineTo(x + hw - rc, bottom);
      ctx.quadraticCurveTo(x + hw, bottom, x + hw, bottom - rc);
      ctx.lineTo(x + hw, top);
    }

    liquidPath(ctx, g, surf, f) {
      const x0 = g.x - g.half, w = 2 * g.half;
      ctx.beginPath();
      ctx.moveTo(x0 - 4, surf - 3.5 + f.h[0]);
      const vortex = f.stirDepth || 0;
      for (let j = 0; j < WAVE_N; j++) {
        const u = j / (WAVE_N - 1), px = x0 + u * w;
        const wall = Math.min(u, 1 - u) * w; // Abstand zur Wand
        const men = -3.5 * Math.exp(-wall / 4.5); // Meniskus: an der Wand hochgezogen
        const rel = (u - 0.5) * 2;
        ctx.lineTo(px, surf + f.h[j] + men + vortex * (Math.exp(-rel * rel * 5) - 0.3));
      }
      ctx.lineTo(x0 + w + 4, surf - 3.5 + f.h[WAVE_N - 1]);
      ctx.lineTo(x0 + w + 4, g.bottom + 12);
      ctx.lineTo(x0 - 4, g.bottom + 12);
      ctx.closePath();
    }

    drawBeaker(ctx, b, g, i) {
      const f = this.beakerFx(i);
      const T = G.TYPES[b.type];
      const m = this.eng.meter(b);
      const k = b.comp0.V0 / b.comp.V; // Indikator verdünnt sich mit der Zugabe
      const target = this.liquidColor(m.pH, k);
      if (!f.color) f.color = target.slice();
      for (let j = 0; j < 4; j++) f.color[j] = lerp(f.color[j], target[j], 0.25);
      const col = f.color;
      const surf = G.surfaceY(g, b.comp.V);
      const stirring = b.stirUntil > this.eng.state.time;
      f.stirDepth = lerp(f.stirDepth || 0, stirring && !this.opts.reduceMotion ? 3.5 : 0, 0.08);

      this.shadow(ctx, g.x, G.BENCH + 3, g.half * 1.25, 9, 0.35);
      // Rückwand
      this.beakerPath(ctx, g, 0); ctx.closePath();
      const back = ctx.createLinearGradient(g.x - g.half, 0, g.x + g.half, 0);
      back.addColorStop(0, 'rgba(180,205,228,0.30)'); back.addColorStop(0.5, 'rgba(255,255,255,0.18)'); back.addColorStop(1, 'rgba(180,205,228,0.28)');
      ctx.fillStyle = back; ctx.fill();

      // Elektrode hinter der Flüssigkeit
      this.drawElectrode(ctx, g, surf, true);

      ctx.save();
      this.beakerPath(ctx, g, 0); ctx.closePath(); ctx.clip();
      // Flüssigkeit
      this.liquidPath(ctx, g, surf, f);
      const grad = ctx.createLinearGradient(0, surf, 0, g.bottom);
      grad.addColorStop(0, rgba(col, col[3] * 0.82)); grad.addColorStop(1, rgba(col, Math.min(0.95, col[3] * 1.12)));
      ctx.fillStyle = grad; ctx.fill();
      const side = ctx.createLinearGradient(g.x - g.half, 0, g.x + g.half, 0);
      side.addColorStop(0, 'rgba(30,50,70,0.18)'); side.addColorStop(0.28, 'rgba(30,50,70,0)'); side.addColorStop(0.72, 'rgba(30,50,70,0)'); side.addColorStop(1, 'rgba(30,50,70,0.2)');
      ctx.fillStyle = side; ctx.fill();
      // Schlieren
      ctx.save(); this.liquidPath(ctx, g, surf, f); ctx.clip(); this.drawPlumes(ctx, b, g, surf, f, col, k, stirring); ctx.restore();
      // Oberfläche und Ringwellen
      const ry = Math.min(5, g.half * 0.07);
      ctx.fillStyle = rgba([lerp(col[0], 255, 0.4), lerp(col[1], 255, 0.4), lerp(col[2], 255, 0.4)], 0.35);
      ctx.beginPath(); ctx.ellipse(g.x, surf, g.half, ry, 0, 0, 6.283); ctx.fill();
      this.liquidPath(ctx, g, surf, f);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.3; ctx.stroke();
      for (const r of f.rings) {
        const t = r.age / r.life, rx = 4 + t * g.half * 0.85;
        ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - t)).toFixed(3)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(r.x, surf, rx, rx * 0.08 + 0.8, 0, 0, 6.283); ctx.stroke();
      }
      ctx.restore();

      // Elektrodenschaft vor dem Glas oberhalb der Flüssigkeit, Glasstab beim Rühren
      this.drawElectrode(ctx, g, surf, false);
      if (stirring || f.rodFade > 0) this.drawRod(ctx, g, surf, f, stirring);

      // Vorderes Glas
      this.beakerPath(ctx, g, 0);
      ctx.strokeStyle = 'rgba(80,110,140,0.75)'; ctx.lineWidth = 1.6; ctx.stroke();
      this.beakerPath(ctx, g, g.glass);
      ctx.strokeStyle = 'rgba(80,110,140,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      // Randwulst
      ctx.strokeStyle = 'rgba(80,110,140,0.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(g.x, g.top - 10, g.half + g.glass / 2, 3, 0, 0, 6.283); ctx.stroke();
      // Glanzlichter (dezent)
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(g.x - g.half + 6, g.top + 6, 3, g.bottom - g.top - 26);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(g.x + g.half - 10, g.top + 14, 2, g.bottom - g.top - 40);
      // Skala (Näherungsmarken) aus der Geometrie
      ctx.strokeStyle = 'rgba(60,85,110,0.6)'; ctx.fillStyle = 'rgba(60,85,110,0.75)'; ctx.lineWidth = 1;
      ctx.font = '600 10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const ml of T.marks) {
        const y = G.surfaceY(g, ml);
        ctx.beginPath(); ctx.moveTo(g.x - g.half + 14, y); ctx.lineTo(g.x - g.half + 28, y); ctx.stroke();
        ctx.fillText(String(ml), g.x - g.half + 31, y);
      }
      ctx.font = '600 9px ' + FONT; ctx.fillText(T.label, g.x - g.half + 14, g.bottom - 14);
      // Spritzer
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const p of this.splashes) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, 6.283); ctx.fill(); }
    }

    drawElectrode(ctx, g, surf, behind) {
      const x = g.x + g.half * 0.48, y1 = g.bottom - 22, y0 = g.top - 70;
      if (behind) {
        // eingetauchter Teil mit Glaskugel
        ctx.fillStyle = 'rgba(205,220,232,0.85)'; ctx.fillRect(x - 5, Math.max(surf, y0), 10, y1 - Math.max(surf, y0));
        ctx.beginPath(); ctx.arc(x, y1, 7, 0, 6.283); ctx.fillStyle = 'rgba(214,228,240,0.95)'; ctx.fill();
        ctx.strokeStyle = 'rgba(90,115,140,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        return;
      }
      const top = Math.min(surf, y1);
      const sh = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
      sh.addColorStop(0, '#2f3a46'); sh.addColorStop(0.45, '#6b7886'); sh.addColorStop(1, '#2a333d');
      ctx.fillStyle = sh; ctx.fillRect(x - 6, y0, 12, Math.max(0, g.top + 6 - y0));
      ctx.fillStyle = 'rgba(205,220,232,0.9)'; ctx.fillRect(x - 5, g.top + 6, 10, Math.max(0, top - g.top - 6));
      ctx.strokeStyle = '#3a4757'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + 10, y0 - 40, x + 30, y0 - 60); ctx.stroke();
    }

    drawRod(ctx, g, surf, f, stirring) {
      f.rodFade = clamp((f.rodFade || 0) + (stirring ? 0.08 : -0.06), 0, 1);
      const a = f.stirA;
      const bx = g.x - g.half * 0.1 + Math.cos(a) * g.half * 0.45, by = g.bottom - 10 + Math.sin(a) * 4;
      const tx = g.x - g.half * 0.55, ty = g.top - 60;
      ctx.save(); ctx.globalAlpha = f.rodFade;
      ctx.strokeStyle = 'rgba(235,244,252,0.95)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,110,140,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    drawPlumes(ctx, b, g, surf, f, bulk, k, stirring) {
      if (!this.opts.indicator) return;
      const depth = Math.max(6, g.bottom - surf);
      const s = this.eng.current();
      for (const p of f.plumes) {
        // lokaler pH: Zugabe vermischt mit „mixed“ mL der umgebenden Lösung
        const share = p.share;
        const local = { V: p.vol + share * b.comp.V, Na: share * b.comp.Na, Cl: share * b.comp.Cl, Ac: share * b.comp.Ac, P: share * b.comp.P };
        if (s.reagent === 'HCl') local.Cl += 0.1 * p.vol; else local.Na += 0.1 * p.vol;
        const c = this.liquidColor(C.pH(local), k);
        const diff = (Math.abs(c[0] - bulk[0]) + Math.abs(c[1] - bulk[1]) + Math.abs(c[2] - bulk[2])) / 255;
        if (diff < 0.03) continue;
        const a = clamp(diff * 1.5, 0, 0.85);
        const sink = Math.min(1, p.age / (stirring ? 0.6 : 2.6));
        const swirl = this.opts.reduceMotion ? 0 : (stirring ? g.half * 0.5 : 0) * Math.min(1, p.age * 1.5);
        const ang = p.phase + p.age * (stirring ? 6 : 0.4);
        const px = lerp(p.x0, g.x, sink * 0.35) + Math.sin(ang) * swirl + p.drift * 8 * Math.min(p.age, 3);
        const r = (5 + 22 * Math.sqrt(share) + 6 * Math.sqrt(p.vol)) * clamp(depth / 50, 0.6, 1.6);
        const py = surf + 3 + r * 0.3 + sink * depth * 0.45;
        const gr = ctx.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.6, rgba(c, a * 0.45)); gr.addColorStop(1, rgba(c, 0));
        ctx.save(); ctx.translate(px, py); ctx.scale(1.5, 0.8); ctx.translate(-px, -py);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill(); ctx.restore();
      }
    }

    drawDrop(ctx, x, y, r, stretch) {
      ctx.save(); ctx.translate(x, y); ctx.scale(1, stretch);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(200,225,250,0.6)'); g.addColorStop(1, 'rgba(110,150,200,0.75)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(70,100,140,0.55)'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.restore();
    }

    drawDrops(ctx, geo, s) {
      const st = this.eng.state;
      for (const d of st.drops) {
        if (d.series !== s.id) continue;
        this.drawDrop(ctx, d.x, d.y, 4.6, 1 + Math.min(0.35, d.v / 3000));
      }
      // Strahl der Messpipette
      for (const sm of st.streams) {
        if (sm.series !== s.id) continue;
        const b = s.beakers[sm.beaker], g = geo[sm.beaker];
        const surf = G.surfaceY(g, b.comp.V);
        let top = sm.y0;
        if (!sm.open) {
          if (!this.streamTails.has(sm)) this.streamTails.set(sm, this.time);
          const tt = this.time - this.streamTails.get(sm);
          top = sm.y0 + 0.5 * 2600 * tt * tt;
        }
        if (top >= surf) continue;
        const w = 2.2;
        const gr = ctx.createLinearGradient(sm.x - w, 0, sm.x + w, 0);
        gr.addColorStop(0, 'rgba(120,160,210,0.55)'); gr.addColorStop(0.5, 'rgba(240,248,255,0.9)'); gr.addColorStop(1, 'rgba(120,160,210,0.55)');
        ctx.fillStyle = gr; ctx.fillRect(sm.x - w / 2, top, w, surf - top);
      }
    }

    drawPipettes(ctx, s) {
      const st = this.eng.state, p = st.pipette;
      for (const tool of ['dropper', 'measure']) {
        const P = G.PIPETTES[tool];
        const active = st.tool === tool;
        const pos = active ? { x: p.x, y: p.y } : P.rest;
        this.drawPipette(ctx, tool, pos.x, pos.y, active ? p : { content: 0, squeeze: 0 }, active);
      }
    }

    drawPipette(ctx, tool, x, tipY, p, active) {
      const P = G.PIPETTES[tool];
      ctx.save();
      if (tool === 'dropper') {
        const tube = P.len * 0.7, top = tipY - tube;
        // Glasrohr mit verjüngter Spitze
        ctx.beginPath(); ctx.moveTo(x - 1.6, tipY); ctx.lineTo(x - 5, tipY - 22); ctx.lineTo(x - 5, top); ctx.lineTo(x + 5, top); ctx.lineTo(x + 5, tipY - 22); ctx.lineTo(x + 1.6, tipY); ctx.closePath();
        ctx.fillStyle = 'rgba(225,238,250,0.6)'; ctx.fill();
        if (p.content > 0) {
          const lvl = tipY - Math.min(tube - 6, 10 + (p.content / P.capacity) * (tube - 20));
          ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(170,205,240,0.75)'; ctx.fillRect(x - 6, lvl, 12, tipY - lvl); ctx.restore();
        }
        ctx.strokeStyle = active ? 'rgba(11,114,133,0.95)' : 'rgba(80,110,140,0.75)'; ctx.lineWidth = active ? 1.8 : 1.2; ctx.stroke();
        // Gummihütchen (wird beim Tropfen gedrückt)
        const sq = p.squeeze || 0, bw = 10 - 3.5 * sq, bh = P.len * 0.3;
        ctx.beginPath(); ctx.ellipse(x, top - bh * 0.55, bw, bh * 0.55, 0, 0, 6.283);
        ctx.fillStyle = '#c0392b'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - bw * 0.5, top - bh * 0.9, 2.5, bh * 0.6);
        ctx.fillStyle = '#a93226'; ctx.fillRect(x - 7, top - 4, 14, 6);
      } else {
        const len = P.len, top = tipY - len, grad0 = tipY - 34, grad1 = top + 36;
        ctx.beginPath(); ctx.moveTo(x - 1.4, tipY); ctx.lineTo(x - 3.6, tipY - 16); ctx.lineTo(x - 3.6, top + 24); ctx.lineTo(x + 3.6, top + 24); ctx.lineTo(x + 3.6, tipY - 16); ctx.lineTo(x + 1.4, tipY); ctx.closePath();
        ctx.fillStyle = 'rgba(225,238,250,0.6)'; ctx.fill();
        if (p.content > 0) {
          const lvl = grad0 - (p.content / P.capacity) * (grad0 - grad1);
          ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(170,205,240,0.8)'; ctx.fillRect(x - 5, lvl, 10, tipY - lvl); ctx.restore();
        }
        ctx.strokeStyle = active ? 'rgba(11,114,133,0.95)' : 'rgba(80,110,140,0.75)'; ctx.lineWidth = active ? 1.6 : 1.1; ctx.stroke();
        // Graduierung 0…5 mL
        ctx.strokeStyle = 'rgba(40,60,80,0.7)'; ctx.lineWidth = 0.8;
        for (let i = 0; i <= 50; i++) {
          const y = grad0 - (i / 50) * (grad0 - grad1), wl = i % 10 === 0 ? 5 : i % 5 === 0 ? 3.5 : 2;
          ctx.beginPath(); ctx.moveTo(x - 3.6, y); ctx.lineTo(x - 3.6 + wl, y); ctx.stroke();
        }
        // Pipettierhilfe
        ctx.fillStyle = '#2f9e44'; rr(ctx, x - 7, top, 14, 26, 5); ctx.fill();
        ctx.beginPath(); ctx.arc(x, top - 6, 9, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 4, top + 3, 2, 18);
      }
      ctx.restore();
    }
  }

  (root.PF = root.PF || {}).LabRenderer = LabRenderer;
})(typeof self !== 'undefined' ? self : this);
