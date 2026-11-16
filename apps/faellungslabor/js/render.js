/*
 * Fällungslabor – Laborbühne (Canvas 2D, HiDPI)
 *
 * Glas, Flüssigkeit, Meniskus, Tropfen, Ringwellen und Spritzer nach TitraLab 3
 * (titration/js/view/lab-renderer.js: _drawDrop, _liquidPath, _drawFlask, Wellengleichung in _update;
 * Paletten nach theme.js), angepasst an Reagenzgläser mit Halbkugelboden. Neu: Niederschlag als
 * lokale Wolken am Eintreffpunkt, verteilte Trübung mit Absetzfront und Bodensatz – Menge, Dichte und
 * Lage kommen ausschließlich aus dem Modellzustand (model.js). Der Renderer liest nur.
 * Lesbare Texte (Etiketten, Volumina) liegen als HTML über der Bühne (app.js).
 */
(function (root) {
  'use strict';
  const C = root.FL.chem, G = root.FL.geometry, M = root.FL.model;
  const WAVE_N = 26;
  const STRIP = 80; // Bildschirmpixel unter der Tischkante für die Glasbeschriftung
  const FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(a, 0, 1).toFixed(3)})`;
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // Paletten (hell/dunkel) – nur Darstellung; Chemie, Mengen und Zeit bleiben unverändert
  const PAL = {
    dark: {
      wall0: '#17212c', wall1: '#0d131a', tile: 'rgba(255,255,255,0.025)',
      shelf0: '#4a3a2a', shelf1: '#2f2419', bench0: '#3a4757', bench1: '#283341', benchEdge: 'rgba(200,225,255,0.22)',
      board0: '#0c1218', board1: '#121a23', boardEdge: 'rgba(160,190,220,0.18)',
      glass: 'rgba(225,238,255,0.70)', glassIn: 'rgba(225,238,255,0.22)', rim: 'rgba(235,245,255,0.85)', hl: 1,
      liquid: [196, 222, 248], liquidA: 0.16, drop: 'rgba(235,245,255,0.6)', splash: 'rgba(225,240,255,0.7)', stream: 'rgba(225,240,255,0.55)',
      rack: 'rgba(170,185,200,0.55)', rackFront: 'rgba(120,140,160,0.35)', sel: '90,200,255', shadow: 'rgba(0,0,0,0.45)', speck: [0, 0, 0]
    },
    light: {
      wall0: '#f4f7fa', wall1: '#e5ebf1', tile: 'rgba(40,70,100,0.06)',
      shelf0: '#c9a77e', shelf1: '#a5835b', bench0: '#d5dde4', bench1: '#c3ccd5', benchEdge: 'rgba(255,255,255,0.85)',
      board0: '#c8d1db', board1: '#bac4cf', boardEdge: 'rgba(70,100,132,0.40)',
      glass: 'rgba(60,92,124,0.62)', glassIn: 'rgba(60,92,124,0.24)', rim: 'rgba(60,92,124,0.85)', hl: 0.85,
      liquid: [170, 200, 232], liquidA: 0.10, drop: 'rgba(70,110,160,0.6)', splash: 'rgba(120,165,215,0.8)', stream: 'rgba(150,195,240,0.6)',
      rack: 'rgba(90,110,130,0.55)', rackFront: 'rgba(90,110,130,0.30)', sel: '31,111,229', shadow: 'rgba(40,60,80,0.18)', speck: [90, 100, 112]
    }
  };

  /** Pipette je Flasche: Gummihütchen-Farbe (zusätzlich immer Beschriftung). */
  const BULB = { agno3: '#3a3f46', nacl: '#c43d3d', nabr: '#c76a1d', nai: '#9a7a12', nh3dil: '#2f78c4', nh3conc: '#1d4f8a', water: '#5f8f5a', tap: '#5f8f5a', mineral: '#3f7f8f' };

  class LabRenderer {
    constructor(canvas, lab) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.lab = lab;
      this.view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0, worldW: 1000 };
      this.theme = 'dark'; this.reduceMotion = false; this.fx = {}; this.splashes = []; this.time = 0; this.bg = null;
    }
    get P() { return PAL[this.theme]; }
    setTheme(t) { if (PAL[t] && t !== this.theme) { this.theme = t; this.bg = null; } }

    /** Maßstab nach der Höhe bis knapp unter die Tischkante; reicht die Breite nicht, nach der Breite (dann vertikal mittig). */
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      const tab = this.lab.tab();
      const minW = G.minWidth(M.TABS[this.lab.state.tab].bottles.length, tab.visible);
      const key = [w, h, dpr, minW, tab.visible, this.lab.state.tab].join('|');
      if (key === this._key) return false;
      this._key = key;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      const visH = G.BENCH + 18 - G.TOP_Y; // vom Hütchen der aufgenommenen Pipette bis knapp unter die Tischkante
      const sH = Math.max(0.15, (h - STRIP) / visH), sW = w / minW;
      const scale = Math.min(sH, sW);
      const used = visH * scale;
      const oy = (h - STRIP - used) / (sW < sH ? 2 : 1) - G.TOP_Y * scale;
      Object.assign(this.view, { w, h, dpr, scale, ox: 0, oy, worldW: w / scale });
      this.lab.setWorldWidth(w / scale);
      this.bg = null;
      return true;
    }
    toScreen(x, y) { const v = this.view; return { x: v.ox + x * v.scale, y: v.oy + y * v.scale }; }
    toWorld(px, py) { const v = this.view; return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale }; }

    tubeFx(tab, slot) {
      const k = tab + slot;
      if (!this.fx[k]) this.fx[k] = { h: new Float32Array(WAVE_N), v: new Float32Array(WAVE_N), rings: [], specks: makeSpecks(slot * 7 + (tab === 'main' ? 1 : 101)) };
      return this.fx[k];
    }

    /** Auftreffen (aus model-Ereignissen): Oberflächenimpuls, Ringwelle, Spritzer. */
    onLand(e) {
      if (e.tab !== this.lab.state.tab) return;
      const f = this.tubeFx(e.tab, e.slot);
      const t = this.lab.tube(e.slot);
      const x = this.lab.tubePos(e.slot) + (e.xoff || 0) * G.TUBE_R;
      if (this.reduceMotion) return;
      const idx = clamp(Math.round(((e.xoff || 0) + 1) / 2 * (WAVE_N - 1)), 2, WAVE_N - 3);
      const s = e.stream ? 6 : 18;
      for (let k = -3; k <= 3; k++) f.v[idx + k] += s * Math.exp(-(k * k) / 3);
      if (!e.stream || Math.random() < 0.25) f.rings.push({ x, age: 0, life: 0.8 });
      if (!e.stream) for (let n = 0; n < 2; n++) this.splashes.push({ x, y: G.surfaceY(t.V), vx: (Math.random() - 0.5) * 70, vy: -100 - Math.random() * 70, age: 0, life: 0.3, tab: e.tab });
    }

    update(dt) {
      this.time += dt;
      const st = this.lab.state;
      for (let slot = 0; slot < this.lab.tab().visible; slot++) {
        const f = this.tubeFx(st.tab, slot);
        const h = f.h, v = f.v;
        const sub = Math.max(2, Math.ceil(dt / 0.004)), sdt = dt / sub;
        for (let k = 0; k < sub; k++) {
          for (let j = 0; j < WAVE_N; j++) {
            const l = h[j > 0 ? j - 1 : 1], r = h[j < WAVE_N - 1 ? j + 1 : WAVE_N - 2];
            v[j] += (1700 * (l + r - 2 * h[j]) - 4.2 * v[j] - 40 * h[j]) * sdt;
          }
          for (let j = 0; j < WAVE_N; j++) { v[j] = clamp(v[j], -140, 140); h[j] = clamp(h[j] + v[j] * sdt, -4, 4); }
        }
        f.rings = f.rings.filter((r) => { r.age += dt; return r.age < r.life; });
      }
      this.splashes = this.splashes.filter((p) => { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 1500 * dt; return p.age < p.life && p.tab === st.tab; });
    }

    frame(dt) {
      this.resize();
      this.update(dt);
      const ctx = this.ctx, v = this.view;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.bg) this.renderBackground();
      ctx.drawImage(this.bg, 0, 0);
      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      const st = this.lab.state, tb = this.lab.tab();
      this.drawBottles(ctx);
      this.drawShelfLabels(ctx);
      this.drawRack(ctx, false);
      for (let i = 0; i < tb.visible; i++) this.drawTube(ctx, tb.tubes[i], i, tb.sel === i);
      this.drawRack(ctx, true);
      this.drawDrops(ctx);
      this.drawPipette(ctx);
      ctx.fillStyle = this.P.splash;
      for (const p of this.splashes) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill(); }
      void st;
    }

    renderBackground() {
      const c = this.bg || document.createElement('canvas');
      c.width = this.canvas.width; c.height = this.canvas.height;
      const ctx = c.getContext('2d'), v = this.view, P = this.P;
      const W = c.width, Hh = c.height;
      const wall = ctx.createLinearGradient(0, 0, 0, Hh);
      wall.addColorStop(0, P.wall0); wall.addColorStop(1, P.wall1);
      ctx.fillStyle = wall; ctx.fillRect(0, 0, W, Hh);
      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      const Ww = v.worldW;
      // Fliesen
      ctx.strokeStyle = P.tile; ctx.lineWidth = 1.2;
      for (let x = 0; x < Ww; x += 60) { ctx.beginPath(); ctx.moveTo(x, -200); ctx.lineTo(x, G.BENCH); ctx.stroke(); }
      for (let y = G.BENCH; y > -200; y -= 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(Ww, y); ctx.stroke(); }
      // Kontrastschirm hinter den Reagenzgläsern
      const tb = this.lab.tab();
      const x0 = G.tubeX(0, tb.visible, Ww) - G.TUBE_GAP / 2 - 6, x1 = G.tubeX(tb.visible - 1, tb.visible, Ww) + G.TUBE_GAP / 2 + 6;
      const top = G.RIM_Y - 70;
      const bd = ctx.createLinearGradient(0, top, 0, G.BENCH);
      bd.addColorStop(0, P.board0); bd.addColorStop(1, P.board1);
      ctx.fillStyle = bd; rr(ctx, x0, top, x1 - x0, G.BENCH - top - 4, 14); ctx.fill();
      ctx.strokeStyle = P.boardEdge; ctx.lineWidth = 2; ctx.stroke();
      // Regalbrett für die Flaschen
      const sh = ctx.createLinearGradient(0, G.SHELF_Y, 0, G.SHELF_Y + 16);
      sh.addColorStop(0, P.shelf0); sh.addColorStop(1, P.shelf1);
      ctx.fillStyle = sh; ctx.fillRect(10, G.SHELF_Y, Ww - 20, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(10, G.SHELF_Y + 14, Ww - 20, 6);
      // Tisch
      const bench = ctx.createLinearGradient(0, G.BENCH, 0, G.BENCH + 120);
      bench.addColorStop(0, P.bench0); bench.addColorStop(1, P.bench1);
      ctx.fillStyle = bench; ctx.fillRect(-50, G.BENCH, Ww + 100, 400);
      ctx.strokeStyle = P.benchEdge; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-50, G.BENCH + 1); ctx.lineTo(Ww + 50, G.BENCH + 1); ctx.stroke();
      this.bg = c;
    }

    // ------------------------------------------------------------ Flaschen und Pipetten
    drawBottles(ctx) {
      const st = this.lab.state, keys = M.TABS[st.tab].bottles, B = G.BOTTLE, P = this.P;
      keys.forEach((key) => {
        const x = this.lab.bottlePos(key), y = G.SHELF_Y;
        const brown = key === 'agno3';
        // Körper
        const bx = x - B.w / 2, by = y - B.h;
        ctx.fillStyle = P.shadow; ctx.beginPath(); ctx.ellipse(x, y + 2, B.w / 2 + 4, 5, 0, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createLinearGradient(bx, 0, bx + B.w, 0);
        const tint = brown ? [120, 62, 18] : [200, 222, 240];
        g.addColorStop(0, rgba(tint, brown ? 0.85 : 0.28)); g.addColorStop(0.5, rgba(tint, brown ? 0.6 : 0.10)); g.addColorStop(1, rgba(tint, brown ? 0.9 : 0.30));
        ctx.fillStyle = g; rr(ctx, bx, by, B.w, B.h, 12); ctx.fill();
        // Inhalt (klar), Füllstand 70 %
        const ly = by + B.h * 0.3;
        ctx.fillStyle = brown ? 'rgba(200,150,90,0.30)' : rgba(P.liquid, 0.28);
        rr(ctx, bx + 4, ly, B.w - 8, by + B.h - ly - 4, 9); ctx.fill();
        ctx.strokeStyle = brown ? 'rgba(90,45,10,0.9)' : P.glass; ctx.lineWidth = 2; rr(ctx, bx, by, B.w, B.h, 12); ctx.stroke();
        // Hals
        ctx.fillStyle = brown ? 'rgba(110,58,18,0.85)' : rgba(tint, 0.25);
        ctx.fillRect(x - B.neck / 2, by - B.neckH, B.neck, B.neckH + 2);
        ctx.strokeStyle = brown ? 'rgba(90,45,10,0.9)' : P.glass; ctx.lineWidth = 1.6; ctx.strokeRect(x - B.neck / 2, by - B.neckH, B.neck, B.neckH + 2);
        // Papieretikett auf der Flasche: Name und GHS-Piktogramme der konkreten Lösung
        ctx.fillStyle = 'rgba(250,248,240,0.95)'; rr(ctx, bx + 6, by + 22, B.w - 12, 62, 4); ctx.fill();
        ctx.fillStyle = '#1f2a36'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const s = C.SOLUTIONS[key];
        const lines = labelLines(key, s);
        ctx.font = `700 12px ${FONT}`; ctx.fillText(lines[0], x, by + 33, B.w - 16);
        ctx.font = `600 11px ${FONT}`; if (lines[1]) ctx.fillText(lines[1], x, by + 46, B.w - 16);
        const picts = (root.FL.ghs.LABELS[key] || { pict: [] }).pict;
        const ps = 22, pw = picts.length * (ps + 1);
        picts.forEach((code, i) => { const im = pictImage(code); if (im.complete && im.naturalWidth) ctx.drawImage(im, x - pw / 2 + i * (ps + 1), by + 56, ps, ps); });
        // Pipette in der Flasche (wenn nicht aufgenommen)
        const p = st.pip;
        if (!(p.key === key && p.tab === st.tab)) this.drawPipetteAt(ctx, key, G.pipetteRest(x).x, G.pipetteRest(x).y, 0, false);
      });
    }

    /** Etikettenleiste unter dem Regal: Formel und Konzentration in gleichbleibender Bildschirmgröße. */
    drawShelfLabels(ctx) {
      const st = this.lab.state, keys = M.TABS[st.tab].bottles, k = 1 / this.view.scale;
      const w = G.bottleGap(keys.length, this.view.worldW) - 8 * k, h = 34 * k, y = G.SHELF_Y + 18;
      keys.forEach((key) => {
        const x = this.lab.bottlePos(key), t = shelfText(key);
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; rr(ctx, x - w / 2, y, w, h, 6 * k); ctx.fill();
        ctx.strokeStyle = 'rgba(40,60,80,0.35)'; ctx.lineWidth = k; ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#17212c';
        ctx.font = `700 ${12.5 * k}px ${FONT}`; ctx.fillText(t[0], x - w / 2 + 6 * k, y + 15 * k, w - 26 * k);
        ctx.fillStyle = '#3d4b5a'; ctx.font = `500 ${11 * k}px ${FONT}`; ctx.fillText(t[1], x - w / 2 + 6 * k, y + 29 * k, w - 10 * k);
        ctx.fillStyle = '#2f6db3'; ctx.beginPath(); ctx.arc(x + w / 2 - 11 * k, y + 11 * k, 7.5 * k, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `700 ${11 * k}px Georgia, serif`; ctx.fillText('i', x + w / 2 - 11 * k, y + 15 * k);
      });
    }

    /** Pipette mit Spitze bei (x, y): Glasschaft und Gummihütchen. */
    drawPipetteAt(ctx, key, x, y, squeeze, filled, alpha) {
      const P = this.P;
      ctx.save();
      if (alpha != null) ctx.globalAlpha = alpha;
      const len = G.PIPETTE_LEN, w = 9;
      // Schaft
      ctx.fillStyle = 'rgba(230,240,250,0.30)';
      ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x - w / 2, y - 26); ctx.lineTo(x - w / 2, y - len); ctx.lineTo(x + w / 2, y - len); ctx.lineTo(x + w / 2, y - 26); ctx.lineTo(x + 2, y); ctx.closePath(); ctx.fill();
      if (filled) {
        ctx.fillStyle = key === 'agno3' ? 'rgba(220,225,230,0.75)' : rgba(P.liquid, 0.65);
        ctx.beginPath(); ctx.moveTo(x - 1.6, y - 2); ctx.lineTo(x - w / 2 + 1.5, y - 26); ctx.lineTo(x - w / 2 + 1.5, y - 70); ctx.lineTo(x + w / 2 - 1.5, y - 70); ctx.lineTo(x + w / 2 - 1.5, y - 26); ctx.lineTo(x + 1.6, y - 2); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = P.glass; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x - w / 2, y - 26); ctx.lineTo(x - w / 2, y - len); ctx.moveTo(x + 2, y); ctx.lineTo(x + w / 2, y - 26); ctx.lineTo(x + w / 2, y - len); ctx.stroke();
      // Hütchen
      const sq = 1 - 0.18 * (squeeze || 0);
      ctx.fillStyle = BULB[key] || '#555';
      ctx.beginPath(); ctx.ellipse(x, y - len - 16, 11 * sq, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 8, y - len - 6, 16, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(x - 4, y - len - 22, 3, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawPipette(ctx) {
      const p = this.lab.state.pip, st = this.lab.state;
      if (!p.key || p.tab !== st.tab) return;
      this.drawPipetteAt(ctx, p.key, p.x, p.y, p.squeeze, true);
      if (this.ghost) this.drawPipetteAt(ctx, p.key, this.ghost.x, this.ghost.y + 60, 0, true, 0.45);
      // Ziel über dem Glas: dezente Markierung der Spitze
      if (p.phase === 'over') {
        ctx.strokeStyle = `rgba(${this.P.sel},0.6)`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y + 4, 9, 0, Math.PI * 2); ctx.stroke();
      }
    }

    drawDrops(ctx) {
      const st = this.lab.state, P = this.P;
      const streaming = new Map();
      for (const d of st.drops) {
        if (d.tab !== st.tab) continue;
        if (d.stream) { const s = streaming.get(d.slot) || { x: d.x, top: Infinity, bottom: -Infinity }; s.top = Math.min(s.top, d.y); s.bottom = Math.max(s.bottom, d.y); streaming.set(d.slot, s); continue; }
        const r = 7, speed = G.GRAV * d.t;
        this.drawDrop(ctx, d.x, d.y, r, 1 + Math.min(0.45, speed / 3000), d.key);
      }
      // Strahl: zusammenhängend von der Spitze bis zum vordersten Anteil
      for (const [slot, s] of streaming) {
        const t = this.lab.tube(slot);
        const y0 = G.pipetteOver(this.lab.tubePos(slot)).y + 8;
        const y1 = Math.min(s.bottom, G.surfaceY(t.V));
        const g = ctx.createLinearGradient(s.x - 3, 0, s.x + 3, 0);
        g.addColorStop(0, 'rgba(150,195,245,0.25)'); g.addColorStop(0.5, P.stream); g.addColorStop(1, 'rgba(150,195,245,0.25)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(s.x - 1.6, y0); ctx.lineTo(s.x + 1.6, y0); ctx.lineTo(s.x + 2.6, y1); ctx.lineTo(s.x - 2.6, y1); ctx.closePath(); ctx.fill();
      }
    }
    drawDrop(ctx, x, y, r, stretch, key) {
      ctx.save(); ctx.translate(x, y); ctx.scale(1, stretch || 1);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, key === 'agno3' ? 'rgba(225,230,236,0.45)' : 'rgba(200,228,255,0.35)');
      g.addColorStop(1, 'rgba(120,170,230,0.55)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = this.P.drop; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.restore();
    }

    // ------------------------------------------------------------ Reagenzglasständer
    drawRack(ctx, front) {
      const tb = this.lab.tab(), P = this.P, Ww = this.view.worldW;
      const x0 = G.tubeX(0, tb.visible, Ww) - G.TUBE_GAP / 2 + 10, x1 = G.tubeX(tb.visible - 1, tb.visible, Ww) + G.TUBE_GAP / 2 - 10;
      const plateY = G.INNER_BOTTOM - 300;
      if (!front) {
        ctx.fillStyle = P.rack;
        ctx.fillRect(x0, plateY, 10, G.BENCH - plateY); ctx.fillRect(x1 - 10, plateY, 10, G.BENCH - plateY);
        ctx.fillRect(x0, G.BENCH - 16, x1 - x0, 14);
        return;
      }
      ctx.fillStyle = P.rackFront; rr(ctx, x0 - 6, plateY - 7, x1 - x0 + 12, 14, 4); ctx.fill();
      ctx.strokeStyle = P.rack; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // ------------------------------------------------------------ Reagenzglas
    tubePath(ctx, x, inset) {
      const r = G.TUBE_R + G.WALL - inset; // inset 0 = Außenwand, WALL = Innenwand
      const bottom = G.INNER_BOTTOM + G.WALL - inset;
      const top = G.RIM_Y;
      ctx.beginPath();
      ctx.moveTo(x - r, top);
      ctx.lineTo(x - r, bottom - r);
      ctx.arc(x, bottom - r, r, Math.PI, 0, true);
      ctx.lineTo(x + r, top);
    }
    liquidPath(ctx, x, surf, f) {
      const R = G.TUBE_R, h = f.h;
      ctx.beginPath();
      // Meniskus: an der Glaswand leicht hochgezogen (benetzendes Wasser)
      const men = Math.min(5, Math.max(0, (G.INNER_BOTTOM - surf) * 0.25));
      ctx.moveTo(x - R - 4, surf - men);
      for (let i = 0; i < WAVE_N; i++) {
        const u = i / (WAVE_N - 1), px = x - R + u * 2 * R;
        const edge = Math.pow(Math.abs(u - 0.5) * 2, 6) * men;
        ctx.lineTo(px, surf + h[i] - edge);
      }
      ctx.lineTo(x + R + 4, surf - men);
      ctx.lineTo(x + R + 4, G.INNER_BOTTOM + 10);
      ctx.lineTo(x - R - 4, G.INNER_BOTTOM + 10);
      ctx.closePath();
    }

    drawTube(ctx, t, slot, selected) {
      const P = this.P, x = this.lab.tubePos(slot), f = this.tubeFx(this.lab.state.tab, slot);
      const R = G.TUBE_R;
      ctx.save();
      // Schwenken: Pendelbewegung um die Halterung im Ständer
      if (t.shake > 0 && !this.reduceMotion) {
        const ph = (M.T.shake - t.shake) / M.T.shake;
        const ang = Math.sin(ph * Math.PI * 5) * 0.11 * Math.sin(ph * Math.PI);
        const piv = G.INNER_BOTTOM - 300;
        ctx.translate(x, piv); ctx.rotate(ang); ctx.translate(-x, -piv);
      }
      // Auswahl
      if (selected) {
        ctx.strokeStyle = `rgba(${P.sel},0.85)`; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        this.tubePath(ctx, x, -10); ctx.stroke(); ctx.setLineDash([]);
      }
      // Rückwand
      this.tubePath(ctx, x, 0); ctx.closePath();
      const back = ctx.createLinearGradient(x - R, 0, x + R, 0);
      back.addColorStop(0, 'rgba(170,205,245,0.12)'); back.addColorStop(0.5, 'rgba(255,255,255,0.03)'); back.addColorStop(1, 'rgba(170,205,245,0.10)');
      ctx.fillStyle = back; ctx.fill();

      if (t.V > 0) {
        const surf = G.surfaceY(t.V);
        ctx.save();
        this.tubePath(ctx, x, G.WALL); ctx.closePath(); ctx.clip();
        this.liquidPath(ctx, x, surf, f); ctx.clip();
        // klare Flüssigkeit
        ctx.fillStyle = rgba(P.liquid, P.liquidA);
        ctx.fillRect(x - R - 5, surf - 10, 2 * R + 10, G.INNER_BOTTOM - surf + 20);
        this.drawSolid(ctx, t, x, surf, f);
        // seitliche Abdunkelung (Volumenwirkung)
        const side = ctx.createLinearGradient(x - R, 0, x + R, 0);
        side.addColorStop(0, 'rgba(10,20,35,0.22)'); side.addColorStop(0.28, 'rgba(10,20,35,0)'); side.addColorStop(0.72, 'rgba(10,20,35,0)'); side.addColorStop(1, 'rgba(10,20,35,0.24)');
        ctx.fillStyle = side; ctx.fillRect(x - R - 5, surf - 10, 2 * R + 10, G.INNER_BOTTOM - surf + 20);
        ctx.restore();
        // Oberfläche (2,5D-Ellipse) und Kante
        ctx.save();
        this.tubePath(ctx, x, G.WALL); ctx.closePath(); ctx.clip();
        const hw = G.halfWidthAt(surf);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath(); ctx.ellipse(x, surf, hw, Math.min(6, hw * 0.12), 0, 0, Math.PI * 2); ctx.fill();
        this.liquidPath(ctx, x, surf, f);
        ctx.strokeStyle = this.theme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(40,80,120,0.45)'; ctx.lineWidth = 1.3; ctx.stroke();
        for (const r of f.rings) {
          const k = r.age / r.life, rx = 3 + k * hw * 0.9;
          ctx.strokeStyle = `rgba(255,255,255,${(0.45 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(r.x, surf, rx, rx * 0.12 + 0.8, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }
      // vorderes Glas: Konturen, Rand, Glanz
      this.tubePath(ctx, x, 0); ctx.strokeStyle = P.glass; ctx.lineWidth = 1.8; ctx.stroke();
      this.tubePath(ctx, x, G.WALL); ctx.strokeStyle = P.glassIn; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = P.rim; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(x, G.RIM_Y, R + G.WALL + 3, 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.globalAlpha = P.hl;
      const hl = ctx.createLinearGradient(0, G.RIM_Y, 0, G.INNER_BOTTOM);
      hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.2, 'rgba(255,255,255,0.32)'); hl.addColorStop(0.85, 'rgba(255,255,255,0.16)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.fillRect(x - R + 7, G.RIM_Y + 14, 4, G.INNER_BOTTOM - G.RIM_Y - 50);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + R - 10, G.RIM_Y + 30, 2.5, G.INNER_BOTTOM - G.RIM_Y - 90);
      ctx.restore();
      ctx.restore();
    }

    /** Niederschlag: Bodensatz, Schwebe mit Absetzfront, Wolken – alles aus dem Modellzustand. */
    drawSolid(ctx, t, x, surf, f) {
      const pig = t.model === 'water' ? (C.WATER[C.SOLUTIONS[t.sample] && C.SOLUTIONS[t.sample].water] || {}).pigment || [236, 234, 226] : C.PIGMENT[t.halide] || [240, 240, 240];
      const P = this.P, R = G.TUBE_R, dark = this.theme === 'dark';
      const total = M.solidTotal(t);
      if (!(total > 0)) return;
      // Bodensatz
      let sedTop = G.INNER_BOTTOM;
      if (t.sed > 0) {
        const vs = Math.min(t.V * 0.9, t.sed * 1000 * G.SEDIMENT_ML_PER_MMOL);
        sedTop = G.surfaceY(vs);
        const g = ctx.createLinearGradient(0, sedTop - 4, 0, G.INNER_BOTTOM);
        g.addColorStop(0, rgba(pig, 0.0)); g.addColorStop(0.18, rgba(pig, 0.85)); g.addColorStop(1, rgba(shade(pig, 0.86), 0.97));
        ctx.fillStyle = g; ctx.fillRect(x - R - 2, sedTop - 4, 2 * R + 4, G.INNER_BOTTOM - sedTop + 12);
        // körnige Struktur, auf hellem Grund mit dunkleren Punkten erkennbar
        if (!dark) { ctx.strokeStyle = rgba(shade(pig, 0.62), 0.55); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - G.halfWidthAt(sedTop + 2), sedTop + 2); ctx.lineTo(x + G.halfWidthAt(sedTop + 2), sedTop + 2); ctx.stroke(); }
        ctx.fillStyle = rgba(dark ? shade(pig, 0.75) : P.speck, dark ? 0.35 : 0.18);
        for (const s of f.specks) { const yy = lerp(sedTop + 3, G.INNER_BOTTOM - 2, s.v); if (Math.abs(s.u - 0.5) * 2 * R < G.halfWidthAt(yy) - 2) ctx.fillRect(x + (s.u - 0.5) * 2 * R, yy, 1.6, 1.6); }
      }
      // Schwebe: Konzentration unter der Front gleichmäßig, Front als weiche Kante
      if (t.susp > 0) {
        const vReg = Math.max(0.05, t.V * (1 - t.front));
        const op = M.turbidity(t.susp / vReg * 1e6);
        const yF = lerp(surf, sedTop, t.front);
        const g = ctx.createLinearGradient(0, yF - 10, 0, sedTop);
        g.addColorStop(0, rgba(pig, 0)); g.addColorStop(Math.min(0.5, 18 / Math.max(20, sedTop - yF + 10)), rgba(pig, op)); g.addColorStop(1, rgba(pig, Math.min(0.9, op * 1.08)));
        ctx.fillStyle = g; ctx.fillRect(x - R - 2, yF - 10, 2 * R + 4, sedTop - yF + 12);
        // Flocken: sichtbare Struktur, bewegt sich beim Absetzen mit
        const n = Math.round(f.specks.length * clamp(op * 1.2, 0, 1));
        ctx.fillStyle = rgba(dark ? [255, 255, 255] : P.speck, dark ? 0.22 : 0.16);
        const drift = this.reduceMotion ? 0 : this.time;
        for (let i = 0; i < n; i++) {
          const s = f.specks[i];
          const yy = lerp(yF + 4, sedTop - 2, (((s.v + 0.03 * Math.sin(drift * s.w + s.p)) % 1) + 1) % 1);
          const xx = x + (s.u - 0.5) * 2 * (G.halfWidthAt(yy) - 3) + Math.sin(drift * 0.7 + s.p) * 2;
          ctx.fillRect(xx, yy, 1.8, 1.8);
        }
      }
      // Wolken: entstehen am Eintreffpunkt, sinken, breiten sich aus
      for (const c of t.clouds) {
        const k = clamp(c.age / M.T.cloud, 0, 1);
        const depth = Math.max(10, sedTop - surf);
        const cx = x + c.x * R * (1 - k * 0.6);
        const cy = surf + 5 + depth * (this.reduceMotion ? 0.3 : 0.62) * Math.sqrt(k);
        const rad = 7 + (R * 0.95 - 7) * Math.sqrt(k);
        const share = clamp(0.04 + 0.9 * k, 0.04, 0.95);
        const op = clamp(M.turbidity(c.m / Math.max(0.02, t.V * share) * 1e6) * (1.05 - 0.15 * k), 0, 0.9);
        for (let j = 0; j < 3; j++) {
          const ox = (j - 1) * rad * 0.45 * (0.6 + 0.4 * k), oy = (j === 1 ? -0.2 : 0.25) * rad;
          const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rad * (j === 1 ? 1 : 0.75));
          g.addColorStop(0, rgba(pig, op)); g.addColorStop(0.55, rgba(pig, op * 0.55)); g.addColorStop(1, rgba(pig, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, rad * (j === 1 ? 1 : 0.75), rad * 0.8 * (j === 1 ? 1 : 0.75), 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  const PICT = {};
  function pictImage(code) {
    if (!PICT[code]) { const im = new Image(); im.src = root.FL.ghs.dataUri(code); PICT[code] = im; }
    return PICT[code];
  }
  function shelfText(key) {
    return {
      agno3: ['AgNO₃', '0,100 mol/L'], nacl: ['NaCl', '0,100 mol/L'], nabr: ['NaBr', '0,100 mol/L'], nai: ['NaI', '0,100 mol/L'],
      nh3dil: ['NH₃ verd.', '2,0 mol/L'], nh3conc: ['NH₃ konz.', 'w = 25 %'], water: ['H₂O', 'destilliert'], tap: ['Leitungs-', 'wasser'], mineral: ['Mineral-', 'wasser']
    }[key] || [key, ''];
  }
  function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function makeSpecks(seed) {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: 70 }, () => ({ u: rnd(), v: rnd(), w: 0.4 + rnd(), p: rnd() * 6.28 }));
  }
  function labelLines(key, s) {
    switch (key) {
      case 'agno3': return ['Silber-', 'nitrat'];
      case 'nacl': return ['Natrium-', 'chlorid'];
      case 'nabr': return ['Natrium-', 'bromid'];
      case 'nai': return ['Natrium-', 'iodid'];
      case 'nh3dil': return ['Ammoniak', 'verdünnt'];
      case 'nh3conc': return ['Ammoniak', 'konz.'];
      case 'water': return ['Wasser', 'dest.'];
      case 'tap': return ['Leitungs-', 'wasser'];
      case 'mineral': return ['Mineral-', 'wasser'];
      default: return [s ? s.name : key, ''];
    }
  }

  (root.FL = root.FL || {}).LabRenderer = LabRenderer;
  root.FL.render = { STRIP, PAL, BULB, labelLines, shelfText };
})(typeof self !== 'undefined' ? self : this);
