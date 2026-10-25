/*
 * Destillation – Laborbühne (Canvas 2D, HiDPI)
 *
 * Zeichnet ausschließlich aus dem Modellzustand (liest, verändert nie) und
 * aus der Geometrie (js/geometry.js). Die ganze Szene wird gleichmäßig in die
 * Bühne eingepasst; Verbindungen können dadurch nicht auseinanderlaufen.
 * Glas und Flüssigkeit nach TitraLab 3 (lab-renderer.js): Rückwand mit
 * Verlauf, Flüssigkeit mit seitlicher Abdunkelung, Spiegel als flache Ellipse
 * mit Meniskus, Vorderkanten und schmale Glanzlichter, fallende Tropfen mit
 * Lichtreflex. Reine Animationsgrößen (Blasenpositionen, Phasen der Strömung)
 * laufen nur, solange das Modell läuft; Mengen, Raten und Zustände kommen
 * immer aus dem Modell.
 */
(function (root) {
  'use strict';
  const M = root.DS.model;
  const G = root.DS.geometry;
  const { clamp, lerp, fmt } = root.LK.core;
  const D = G.DIM;

  const FONT = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
  const C = {
    glassFill: 'rgba(214,230,246,0.28)',
    glassEdge: 'rgba(78,104,132,0.85)',
    glassInner: 'rgba(78,104,132,0.25)',
    glassTube: 'rgba(236,243,250,0.92)',
    hl: 'rgba(255,255,255,0.85)',
    liquid: [150, 192, 236],
    water: [92, 160, 232],
    metal0: '#59626e', metal1: '#e3e9f0', metal2: '#9aa4b0', metal3: '#3a414b',
    dark: '#2b3440', label: '#17212c', warn: '#a8640a', bad: '#c62f3a', ok: '#1c8a4a', accent: '#1f6fd1'
  };
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const P = (x, y) => ({ x, y });

  // deterministisches Rauschen für Blasen und Flammen
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(t, k) { const i = Math.floor(t), f = t - i; const a = hash(i + k * 57), b = hash(i + 1 + k * 57); return a + (b - a) * (f * f * (3 - 2 * f)); }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }
  function chain(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i + 2 < pts.length; i += 3) ctx.bezierCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, pts[i + 2].x, pts[i + 2].y);
  }

  // ------------------------------------------------------------------ Geräte für Beschriftung und Trainer
  /** Ankerpunkt (am Gerät) und Lage des Schildes (Weltkoordinaten) je Gerät. */
  const PARTS = [
    { id: 'flask', anchor: (g) => P(-g.flask.R * 0.8, g.flask.c.y - g.flask.R * 0.35), label: (g) => P(g.stand1.rodX - 72, g.flask.c.y - 34) },
    { id: 'mantle', anchor: (g) => P(-g.mantle.outer + 6, g.mantle.base - 34), label: (g) => P(g.stand1.rodX - 72, g.mantle.base - 30) },
    { id: 'stones', anchor: (g) => P(10, g.flask.c.y + g.flask.R - 7), label: (g) => P(g.mantle.outer + 52, g.mantle.base - 4) },
    { id: 'head', anchor: (g) => P(-g.head.hw, g.arm.o.y + 18), label: (g) => P(g.stand1.rodX - 50, g.arm.o.y + 6) },
    { id: 'thermo', anchor: (g, st) => P(g.thermo.hw, g.thermo.bulb[st.thermo] - 210), label: (g, st) => P(g.thermo.hw + 76, g.thermo.bulb[st.thermo] - 236) },
    { id: 'condenser', anchor: (g) => g.cond.at(D.jacket0 + 150, D.jacketHW), label: (g) => g.cond.at(D.jacket0 + 150, D.jacketHW + 52) },
    { id: 'inlet', anchor: (g) => g.nozzles.low.tip, label: (g) => P(g.nozzles.low.tip.x - 132, g.nozzles.low.tip.y + 4) },
    { id: 'outlet', anchor: (g) => g.nozzles.high.tip, label: (g) => P(g.nozzles.high.tip.x + 96, g.nozzles.high.tip.y - 26) },
    { id: 'adapter', anchor: (g) => P(g.adapter.a2.x + D.adapterHW, g.adapter.a2.y + 10), label: (g) => P(g.adapter.a2.x + 78, g.adapter.a2.y - 30) },
    { id: 'receiver', anchor: (g) => P(g.receiver.x + g.receiver.baseHW - 10, g.receiver.base - 26), label: (g) => P(g.receiver.x + 100, g.receiver.base - 66) },
    { id: 'distillate', anchor: (g) => P(g.receiver.x - 10, g.receiver.base - 6), label: (g) => P(g.receiver.x - 92, g.receiver.base - 26) },
    { id: 'stand', anchor: (g) => P(g.stand1.rodX, g.stand1.clamps[0].y - 26), label: (g) => P(g.stand1.rodX - 72, g.stand1.clamps[0].y - 36) }
  ];

  // ------------------------------------------------------------------ Renderer
  function createRenderer(canvas, getState, getUi) {
    const ctx = canvas.getContext('2d');
    const bg = document.createElement('canvas');
    let geo = null, geoKey = '';
    const view = { scale: 1, ox: 0, oy: 0, w: 1, h: 1, dpr: 1 };
    let reduce = false;
    try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ohne */ }
    const vis = { lastT: null, time: 0, water: 0, film: 0, hose: 0, bubbles: [], bubbleSeq: 0, drops: [], lastDrop: 0, stream: 0, swap: null, nFractions: null, lastRealDrops: [] };

    function ensureGeo(st) {
      const key = st.mix === 'ew' ? 'S' : 'N';
      if (key === geoKey && geo) return false;
      geo = G.build({ station: key === 'S' });
      geoKey = key;
      return true;
    }
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      const changed = ensureGeo(getState());
      if (!changed && w === view.w && h === view.h && dpr === view.dpr) return false;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      Object.assign(view, G.fit(geo.bounds, w, h, 8), { dpr });
      renderBackground();
      return true;
    }
    const toScreen = (p) => G.toScreen(view, p);
    const px = (n) => n / view.scale;

    // ----- Hintergrund (Wand, Fliesen, Tisch, Ausguss) – zwischengespeichert
    function renderBackground() {
      bg.width = canvas.width; bg.height = canvas.height;
      const b = bg.getContext('2d');
      b.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      const benchY = toScreen(P(0, 0)).y;
      const wall = b.createLinearGradient(0, 0, 0, benchY);
      wall.addColorStop(0, '#f3f6f9'); wall.addColorStop(1, '#e2e8ee');
      b.fillStyle = wall; b.fillRect(0, 0, view.w, benchY);
      const tile = 60 * view.scale;
      b.strokeStyle = 'rgba(160,175,190,0.22)'; b.lineWidth = 1;
      for (let y = benchY - tile, row = 0; y > -tile; y -= tile, row++) {
        b.beginPath(); b.moveTo(0, y); b.lineTo(view.w, y); b.stroke();
        for (let x = (row % 2 ? tile / 2 : 0) + (view.ox % tile); x < view.w; x += tile) { b.beginPath(); b.moveTo(x, y); b.lineTo(x, y + tile); b.stroke(); }
      }
      const t = b.createLinearGradient(0, benchY, 0, view.h);
      t.addColorStop(0, '#c7d0da'); t.addColorStop(0.06, '#b5c0cc'); t.addColorStop(1, '#8f9cab');
      b.fillStyle = t; b.fillRect(0, benchY, view.w, view.h - benchY);
      b.fillStyle = 'rgba(255,255,255,0.55)'; b.fillRect(0, benchY, view.w, 1.2);
      // Ausguss im Tisch
      const s0 = toScreen(P(geo.sink.x0, 0)), s1 = toScreen(P(geo.sink.x1, 0));
      const dpt = Math.max(8, geo.sink.depth * view.scale);
      b.fillStyle = '#6f7d8c'; roundRect(b, s0.x, benchY - 2, s1.x - s0.x, dpt, 5); b.fill();
      const sg = b.createLinearGradient(0, benchY, 0, benchY + dpt);
      sg.addColorStop(0, '#2f3944'); sg.addColorStop(1, '#55626f');
      b.fillStyle = sg; roundRect(b, s0.x + 5, benchY + 1, s1.x - s0.x - 10, dpt - 6, 4); b.fill();
      b.fillStyle = '#1d242c'; b.beginPath(); b.ellipse((s0.x + s1.x) / 2 + 14, benchY + dpt * 0.55, 6, 2.5, 0, 0, Math.PI * 2); b.fill();
    }

    // ------------------------------------------------------------------ Zeichenhelfer
    function text(str, x, y, o) {
      const opt = o || {};
      ctx.save();
      ctx.font = `${opt.weight || 600} ${px(opt.size || 12)}px ${FONT}`;
      ctx.textAlign = opt.align || 'center';
      ctx.textBaseline = opt.base || 'middle';
      if (opt.bg) {
        const w = ctx.measureText(str).width + px(10), h = px((opt.size || 12) + 8);
        const x0 = opt.align === 'left' ? x - px(5) : opt.align === 'right' ? x - w + px(5) : x - w / 2;
        ctx.fillStyle = opt.bg; roundRect(ctx, x0, y - h / 2, w, h, px(5)); ctx.fill();
        if (opt.border) { ctx.strokeStyle = opt.border; ctx.lineWidth = px(1.2); ctx.stroke(); }
      }
      ctx.fillStyle = opt.color || C.label;
      ctx.fillText(str, x, y);
      ctx.restore();
    }
    function tubeStroke(pathFn, hw, fill) {
      ctx.save();
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      pathFn(); ctx.strokeStyle = C.glassEdge; ctx.lineWidth = 2 * hw; ctx.stroke();
      pathFn(); ctx.strokeStyle = fill || C.glassTube; ctx.lineWidth = Math.max(0.5, 2 * hw - px(2.6)); ctx.stroke();
      ctx.restore();
    }
    function metalRod(x0, y0, x1, y1, w) {
      const vert = Math.abs(x1 - x0) < Math.abs(y1 - y0);
      const gr = vert ? ctx.createLinearGradient(x0 - w / 2, 0, x0 + w / 2, 0) : ctx.createLinearGradient(0, y0 - w / 2, 0, y0 + w / 2);
      gr.addColorStop(0, C.metal0); gr.addColorStop(0.35, C.metal1); gr.addColorStop(0.55, C.metal2); gr.addColorStop(1, C.metal3);
      ctx.fillStyle = gr;
      if (vert) ctx.fillRect(x0 - w / 2, Math.min(y0, y1), w, Math.abs(y1 - y0));
      else ctx.fillRect(Math.min(x0, x1), y0 - w / 2, Math.abs(x1 - x0), w);
    }
    function joint(cx, cy, angle, hw, len) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
      ctx.fillStyle = 'rgba(245,248,252,0.75)';
      ctx.fillRect(-len / 2, -hw - 1.5, len, 2 * hw + 3);
      ctx.strokeStyle = 'rgba(78,104,132,0.6)'; ctx.lineWidth = px(1);
      ctx.strokeRect(-len / 2, -hw - 1.5, len, 2 * hw + 3);
      // Schliffklemme (Kunststoff)
      ctx.fillStyle = '#e8892b';
      ctx.fillRect(-len / 2 - 2, -hw - 4, 4, 2 * hw + 8);
      ctx.restore();
    }
    function drawDrop(x, y, r, stretch) {
      ctx.save(); ctx.translate(x, y); ctx.scale(1, stretch || 1);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(190,220,250,0.6)'); g.addColorStop(1, 'rgba(90,140,200,0.85)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(60,100,150,0.55)'; ctx.lineWidth = px(0.8); ctx.stroke();
      ctx.restore();
    }

    // ------------------------------------------------------------------ Stative, Laborboys
    function drawStands(st) {
      const g = geo;
      const s1 = g.stand1, s2 = g.stand2;
      for (const s of [s1, s2]) {
        const pg = ctx.createLinearGradient(0, -s.base.h, 0, 0);
        pg.addColorStop(0, '#4a5462'); pg.addColorStop(0.3, '#2c333d'); pg.addColorStop(1, '#1b2028');
        ctx.fillStyle = pg; roundRect(ctx, s.base.x0, -s.base.h, s.base.x1 - s.base.x0, s.base.h, 3); ctx.fill();
      }
      metalRod(s1.rodX, s1.top, s1.rodX, -s1.base.h, 11);
      metalRod(s2.rodX, s2.top, s2.rodX, -s2.base.h, 11);
      ctx.fillStyle = '#c9d1db';
      roundRect(ctx, s1.rodX - 6.5, s1.top - 4, 13, 7, 3); ctx.fill();
      roundRect(ctx, s2.rodX - 6.5, s2.top - 4, 13, 7, 3); ctx.fill();
    }
    function clampArm(rodX, x1, y, hw, angle, at) {
      // Doppelmuffe am Stab, Stange, Klemmbacken um das Glas
      if (at) {
        // Stab hinter dem Kühler: Muffe unterhalb, kurzer Klemmenhals nach oben
        const by = y + hw + 22;
        metalRod(rodX, by, rodX, y + hw + 4, 7);
        ctx.fillStyle = '#2f3640'; roundRect(ctx, rodX - 13, by - 12, 26, 24, 5); ctx.fill();
        ctx.fillStyle = '#7c8794'; ctx.beginPath(); ctx.arc(rodX + 18, by, 4.5, 0, Math.PI * 2); ctx.fill();
      } else {
        metalRod(rodX, y, x1 - hw - 8, y, 8);
        ctx.fillStyle = '#2f3640'; roundRect(ctx, rodX - 13, y - 15, 26, 30, 5); ctx.fill();
        ctx.fillStyle = '#7c8794'; ctx.beginPath(); ctx.arc(rodX - 18, y, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save(); ctx.translate(at ? at.x : x1, at ? at.y : y); ctx.rotate(angle || 0);
      ctx.fillStyle = '#b48a5a';
      ctx.fillRect(-hw - 6, -12, 5, 24); ctx.fillRect(hw + 1, -12, 5, 24);
      const jaw = ctx.createLinearGradient(0, -14, 0, 14);
      jaw.addColorStop(0, '#c8d0da'); jaw.addColorStop(0.5, '#6d7784'); jaw.addColorStop(1, '#353c46');
      ctx.fillStyle = jaw;
      roundRect(ctx, -hw - 12, -13, 6, 26, 2); ctx.fill();
      roundRect(ctx, hw + 6, -13, 6, 26, 2); ctx.fill();
      ctx.restore();
    }
    function drawJack(x, w, top, h) {
      const y1 = top + h;
      ctx.fillStyle = '#4b5562'; roundRect(ctx, x - w / 2, top, w, 7, 2); ctx.fill();
      ctx.fillStyle = '#3a434f'; roundRect(ctx, x - w / 2, y1 - 7, w, 7, 2); ctx.fill();
      ctx.strokeStyle = '#8b96a3'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const k = w * 0.36;
      ctx.beginPath(); ctx.moveTo(x - k, top + 8); ctx.lineTo(x + k, y1 - 8); ctx.moveTo(x + k, top + 8); ctx.lineTo(x - k, y1 - 8); ctx.stroke();
      ctx.fillStyle = '#5a6573'; ctx.beginPath(); ctx.arc(x, top + h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b96a3'; roundRect(ctx, x + w / 2 - 2, top + h / 2 - 3, 14, 6, 2); ctx.fill();
    }

    // ------------------------------------------------------------------ Heizpilz (aufgeschnitten dargestellt)
    function drawMantleBack(st) {
      const g = geo, m = g.mantle, c = g.flask.c;
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(-m.outer, m.rim);
        ctx.lineTo(-m.outer, m.base - 14);
        ctx.quadraticCurveTo(-m.outer, m.base, -m.outer + 14, m.base);
        ctx.lineTo(m.outer - 14, m.base);
        ctx.quadraticCurveTo(m.outer, m.base, m.outer, m.base - 14);
        ctx.lineTo(m.outer, m.rim);
        ctx.closePath();
      };
      const sg = ctx.createLinearGradient(-m.outer, 0, m.outer, 0);
      sg.addColorStop(0, '#2e3540'); sg.addColorStop(0.45, '#4d5866'); sg.addColorStop(1, '#262c35');
      body(); ctx.fillStyle = sg; ctx.fill();
      // Heizgewebe innen (Rückseite der Schale), glüht mit der Temperatur des Heizpilzes
      const hot = clamp((st.mantleT - 35) / 110, 0, 1);
      ctx.save();
      ctx.beginPath(); ctx.arc(c.x, c.y, m.inner, 0, Math.PI); ctx.closePath();
      ctx.fillStyle = '#d9d0c3'; ctx.fill();
      if (hot > 0) {
        const hg = ctx.createRadialGradient(c.x, c.y + m.inner * 0.7, 4, c.x, c.y + m.inner * 0.5, m.inner * 1.1);
        hg.addColorStop(0, `rgba(255,120,40,${0.75 * hot})`); hg.addColorStop(0.6, `rgba(240,90,30,${0.45 * hot})`); hg.addColorStop(1, `rgba(200,60,20,${0.15 * hot})`);
        ctx.fillStyle = hg; ctx.fill();
      }
      ctx.restore();
    }
    function drawMantleFront(st, ui) {
      const g = geo, m = g.mantle, c = g.flask.c;
      // Schnittflächen links und rechts der Schale
      ctx.save();
      const cut = (sgn) => {
        ctx.beginPath();
        ctx.moveTo(sgn * m.outer, m.rim);
        ctx.lineTo(sgn * m.inner, m.rim);
        const a0 = sgn > 0 ? 0 : Math.PI;
        ctx.arc(c.x, c.y, m.inner, a0, Math.PI / 2, sgn < 0);
        ctx.lineTo(c.x, c.y + m.inner + 8);
        ctx.lineTo(sgn * (m.outer - 14), m.base - 4);
        ctx.quadraticCurveTo(sgn * m.outer, m.base - 4, sgn * m.outer, m.base - 16);
        ctx.closePath();
      };
      for (const sgn of [-1, 1]) {
        cut(sgn);
        const cg = ctx.createLinearGradient(0, m.rim, 0, m.base);
        cg.addColorStop(0, '#5b6675'); cg.addColorStop(1, '#3a434f');
        ctx.fillStyle = cg; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = px(1.2);
        for (let k = -120; k < 120; k += 7) { ctx.beginPath(); ctx.moveTo(k, m.rim); ctx.lineTo(k + 40, m.base); ctx.stroke(); }
        ctx.restore();
      }
      // Heizschicht im Schnitt
      const hot = clamp((st.mantleT - 35) / 110, 0, 1);
      ctx.strokeStyle = hot > 0 ? `rgb(${lerp(190, 255, hot) | 0},${lerp(150, 110, hot) | 0},${lerp(120, 40, hot) | 0})` : '#b9ad9c';
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(c.x, c.y, m.inner + 2, 0.02, Math.PI - 0.02); ctx.stroke();
      ctx.restore();
      // Bedienfeld: Schalter EIN/AUS und Heizstufe
      const on = st.heater.on;
      const y = m.base - 12, x0 = -m.outer + 6, x1 = m.outer - 6;
      ctx.fillStyle = '#1f252d'; roundRect(ctx, x0, y - 8, x1 - x0, 16, 4); ctx.fill();
      ctx.fillStyle = on ? '#ff6a2a' : '#5b6470';
      ctx.beginPath(); ctx.arc(x0 + 9, y, 4.2, 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,120,60,0.35)'; ctx.beginPath(); ctx.arc(x0 + 9, y, 8, 0, Math.PI * 2); ctx.fill(); }
      const room = (x1 - x0) * view.scale;
      text(on ? 'EIN' : 'AUS', x0 + 17, y + 0.5, { size: 9.5, align: 'left', color: on ? '#ffb48a' : '#c9d3de', weight: 700 });
      if (room > 92) text(M.HEAT[st.heater.level].name, x1 - 5, y + 0.5, { size: 9.5, align: 'right', color: '#c9d3de', weight: 600 });
    }

    // ------------------------------------------------------------------ Rundkolben mit Flüssigkeit
    function flaskPath(inset) {
      const g = geo, c = g.flask.c;
      const R = g.flask.R - inset, nw = g.neck.hw - inset;
      const yj = c.y - Math.sqrt(R * R - nw * nw);
      ctx.beginPath();
      ctx.moveTo(-nw, g.neck.y1);
      ctx.lineTo(-nw, yj);
      ctx.arc(c.x, c.y, R, Math.atan2(yj - c.y, -nw), Math.atan2(yj - c.y, nw), true);
      ctx.lineTo(nw, g.neck.y1);
    }
    function drawFlask(st, dtVis) {
      const g = geo, c = g.flask.c;
      const V = M.vol(st.flask.c);
      flaskPath(0); ctx.closePath();
      const back = ctx.createLinearGradient(-g.flask.R, 0, g.flask.R, 0);
      back.addColorStop(0, 'rgba(190,212,236,0.30)'); back.addColorStop(0.5, 'rgba(255,255,255,0.10)'); back.addColorStop(1, 'rgba(190,212,236,0.26)');
      ctx.fillStyle = back; ctx.fill();
      // Inhalt
      ctx.save();
      flaskPath(D.glass); ctx.closePath(); ctx.clip();
      const lev = G.flaskLevel(g, V);
      const shake = st.fx.bump > 0 ? Math.sin(vis.time * 40) * 2 * st.fx.bump : 0;
      const surf = lev.y + (st.fx.violent > 0 ? Math.sin(vis.time * 23) * 1.2 * st.fx.violent : 0) + shake;
      if (V > 0.05) {
        const col = C.liquid;
        const lg = ctx.createLinearGradient(0, surf, 0, c.y + g.flask.R);
        lg.addColorStop(0, rgba(col, 0.62)); lg.addColorStop(1, rgba(col, 0.82));
        ctx.fillStyle = 'rgba(240,246,252,0.55)'; ctx.fillRect(c.x - g.flask.R, surf, 2 * g.flask.R, c.y + g.flask.R - surf + 2);
        ctx.fillStyle = lg; ctx.fillRect(c.x - g.flask.R, surf, 2 * g.flask.R, c.y + g.flask.R - surf + 2);
        const side = ctx.createLinearGradient(-g.flask.R, 0, g.flask.R, 0);
        side.addColorStop(0, 'rgba(20,40,70,0.22)'); side.addColorStop(0.3, 'rgba(20,40,70,0)'); side.addColorStop(0.7, 'rgba(20,40,70,0)'); side.addColorStop(1, 'rgba(20,40,70,0.24)');
        ctx.fillStyle = side; ctx.fillRect(c.x - g.flask.R, surf, 2 * g.flask.R, c.y + g.flask.R - surf + 2);
        // Spiegel: flache Ellipse, Meniskus an der Glaswand
        const ry = Math.max(1.2, lev.half * 0.1);
        ctx.fillStyle = 'rgba(235,245,255,0.45)';
        ctx.beginPath(); ctx.ellipse(c.x, surf, lev.half, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(80,120,170,0.55)'; ctx.lineWidth = px(1.1);
        ctx.beginPath(); ctx.ellipse(c.x, surf, lev.half, ry, 0, 0, Math.PI); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = px(1.2);
        ctx.beginPath(); ctx.moveTo(c.x - lev.half, surf - 2.2); ctx.quadraticCurveTo(c.x - lev.half + 4, surf, c.x - lev.half + 9, surf); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x + lev.half, surf - 2.2); ctx.quadraticCurveTo(c.x + lev.half - 4, surf, c.x + lev.half - 9, surf); ctx.stroke();
      }
      // Siedesteine am Boden
      const stonesOp = st.op && st.op.type === 'stones' ? clamp(st.op.t / st.op.dur, 0, 1) : null;
      const bottom = c.y + g.flask.R - D.glass;
      const stones = [[-9, 0.9], [2, 1.1], [11, 0.85]];
      if (st.stones || stonesOp != null) {
        stones.forEach(([sx, s], i) => {
          let y = bottom - 3.2 * s, x = sx;
          if (stonesOp != null) { const tt = clamp(stonesOp * 1.4 - i * 0.12, 0, 1); y = lerp(g.head.y1 + 20, bottom - 3.2 * s, tt * tt); x = lerp(0, sx, tt); }
          ctx.fillStyle = '#e8e4dc'; ctx.strokeStyle = '#8f877b'; ctx.lineWidth = px(1);
          ctx.beginPath();
          for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; const rr = (3.4 + hash(i * 7 + k) * 1.4) * s; ctx.lineTo(x + Math.cos(a) * rr * 1.25, y + Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
      }
      // Blasen: Siedekeime an den Steinen, Dampfblasen beim Sieden – nur aus dem Modellzustand
      if (V > 0.05) updateBubbles(st, dtVis, lev, surf, bottom);
      for (const b of vis.bubbles) {
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * b.a})`; ctx.lineWidth = px(1.1);
        ctx.fillStyle = `rgba(255,255,255,${0.18 * b.a})`;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // Siedeverzug: herausspritzende Tropfen
      if (st.fx.bump > 0) {
        for (let i = 0; i < 14; i++) {
          const k = (1.5 - st.fx.bump) / 1.5;
          const x = (hash(i) - 0.5) * 2 * g.neck.hw * 0.8, y = surf - k * (60 + 120 * hash(i + 3)) + k * k * 80;
          drawDrop(x, y, 1.8, 1);
        }
      }
      ctx.restore();
      // Glas vorne
      flaskPath(0); ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.5); ctx.stroke();
      flaskPath(D.glass); ctx.strokeStyle = C.glassInner; ctx.lineWidth = px(1); ctx.stroke();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(c.x, c.y, g.flask.R - 8, Math.PI * 1.08, Math.PI * 1.32); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(c.x, c.y, g.flask.R - 9, Math.PI * 1.75, Math.PI * 1.85); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-g.neck.hw + 3, g.neck.y1 + 4, 2, g.neck.y0 - g.neck.y1 - 8);
    }
    function updateBubbles(st, dt, lev, surf, bottom) {
      const fx = st.fx;
      const g = geo;
      const run = dt > 0;
      if (run && !reduce) {
        const rate = (fx.boil > 0 ? 6 + 46 * Math.min(1.4, fx.boil) : 0) + (fx.nucleate > 0 ? 10 * fx.nucleate : 0);
        let n = rate * dt;
        while (n > 0) {
          if (n < 1 && hash(vis.bubbleSeq * 3.3 + vis.time) > n) break;
          n -= 1;
          vis.bubbleSeq++;
          const k = vis.bubbleSeq;
          const fromStone = st.stones && hash(k) < 0.7;
          const big = fx.boil > 0 ? 0.6 + Math.min(1.4, fx.boil) * (0.8 + hash(k + 9)) + fx.violent * 1.5 : 0.35;
          const x0 = fromStone ? [-9, 2, 11][k % 3] + (hash(k + 1) - 0.5) * 4 : (hash(k + 2) - 0.5) * lev.half * 1.4;
          vis.bubbles.push({ x: x0, y: bottom - 4, r: 0.6 + 0.6 * big, grow: big, v: 18 + 22 * hash(k + 5) + 30 * Math.min(1, fx.boil), a: 1, wob: hash(k + 7) * 6, nucleus: fx.boil <= 0 });
        }
      }
      if (!run) return;
      vis.bubbles = vis.bubbles.filter((b) => {
        b.y -= b.v * dt; b.r += b.grow * dt * 1.6; b.x += Math.sin((b.y + b.wob) * 0.25) * 0.15;
        if (b.nucleus) b.a -= dt * 1.6;
        if (b.y - b.r < surf) { b.a -= dt * 8; }
        return b.a > 0 && b.y > surf - 6 && !(M.vol(st.flask.c) < 0.05);
      });
      if (vis.bubbles.length > 260) vis.bubbles.splice(0, vis.bubbles.length - 260);
    }

    // ------------------------------------------------------------------ Destillationsaufsatz, Thermometer
    function headPath(inset) {
      const g = geo, a = g.arm, d = a.d;
      const hw = g.head.hw - inset, aw = a.hw - inset;
      const nUp = P(d.y, -d.x), nDn = P(-d.y, d.x);
      const sUp = (hw - nUp.x * aw) / d.x, sDn = (hw - nDn.x * aw) / d.x;
      const len = G.dist(a.o, a.end) + 4;
      const up0 = P(a.o.x + d.x * sUp + nUp.x * aw, a.o.y + d.y * sUp + nUp.y * aw);
      const up1 = P(a.o.x + d.x * len + nUp.x * aw, a.o.y + d.y * len + nUp.y * aw);
      const dn1 = P(a.o.x + d.x * len + nDn.x * aw, a.o.y + d.y * len + nDn.y * aw);
      const dn0 = P(a.o.x + d.x * sDn + nDn.x * aw, a.o.y + d.y * sDn + nDn.y * aw);
      ctx.beginPath();
      ctx.moveTo(-hw, g.head.y0 + 10);
      ctx.lineTo(-hw, g.head.y1);
      ctx.lineTo(hw, g.head.y1);
      ctx.lineTo(up0.x, up0.y); ctx.lineTo(up1.x, up1.y);
      ctx.lineTo(dn1.x, dn1.y); ctx.lineTo(dn0.x, dn0.y);
      ctx.lineTo(hw, g.head.y0 + 10);
    }
    function drawHeadBack() {
      headPath(0); ctx.closePath();
      ctx.fillStyle = 'rgba(214,230,246,0.30)'; ctx.fill();
    }
    function drawHeadFront() {
      headPath(0); ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.5); ctx.stroke();
      headPath(D.glass); ctx.strokeStyle = C.glassInner; ctx.lineWidth = px(1); ctx.stroke();
      const g = geo;
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-g.head.hw + 3, g.head.y1 + 8, 2, g.head.y0 - g.head.y1 - 20);
      // Schliffverbindung Kolben/Aufsatz
      joint(0, g.head.joint.y + 2, 0, g.neck.hw, 14);
      // Thermometeradapter (Schraubkappe)
      const cp = g.thermo.cap;
      ctx.fillStyle = '#2f6fb5'; roundRect(ctx, -cp.hw, cp.y0, 2 * cp.hw, cp.y1 - cp.y0, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-cp.hw + 2, cp.y0 + 2, 2 * cp.hw - 4, 3);
    }
    function drawThermometer(st, ui) {
      const g = geo, t = g.thermo;
      if (st.op && st.op.type === 'fill') return;
      const pos = st.thermo;
      const yb = t.bulb[pos], top = t.top(pos);
      const sel = ui && ui.selected === 'thermo';
      ctx.save();
      // Glasstab
      ctx.fillStyle = 'rgba(250,252,255,0.95)'; ctx.strokeStyle = sel ? C.accent : 'rgba(78,104,132,0.8)'; ctx.lineWidth = px(sel ? 2.4 : 1.2);
      roundRect(ctx, -t.hw, top, 2 * t.hw, yb - top - t.bulbLen / 2 + 2, t.hw); ctx.fill(); ctx.stroke();
      // Kugel
      ctx.beginPath(); ctx.ellipse(0, yb, t.hw * 0.95, t.bulbLen / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#d6303a'; ctx.fill(); ctx.stroke();
      // Kapillare mit Flüssigkeitssäule
      const T = clamp(st.reading, -5, 112);
      const yT = t.yOf(pos, T);
      ctx.fillStyle = '#d6303a';
      ctx.fillRect(-0.9, yT, 1.8, yb - yT);
      // Skala 0 … 110 °C
      ctx.strokeStyle = 'rgba(40,52,66,0.85)'; ctx.fillStyle = 'rgba(40,52,66,0.95)';
      for (let k = 0; k <= 110; k += 2) {
        const y = t.yOf(pos, k);
        if (y > t.cap.y0 - 2) continue;
        const major = k % 10 === 0;
        ctx.lineWidth = px(major ? 1.1 : 0.7);
        ctx.beginPath(); ctx.moveTo(t.hw - (major ? 5 : 3), y); ctx.lineTo(t.hw, y); ctx.stroke();
        if (k % 20 === 0 && view.scale * 1.7 * 20 > 14) text(String(k), t.hw + 3, y, { size: 9, align: 'left', color: '#2a3542', weight: 600 });
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-t.hw + 1.2, top + 6, 1.2, yb - top - 20);
      ctx.restore();
    }
    function drawDisplay(st) {
      const g = geo, d = g.display;
      if (st.op && st.op.type === 'fill') return;
      // mindestens 150 × 66 Bildschirmpixel, rechts bündig am Thermometer
      const w = Math.max(d.x1 - d.x0, px(150)), h = Math.max(d.y1 - d.y0, px(66));
      const x0 = d.x1 - w, y0 = d.y0;
      ctx.strokeStyle = 'rgba(40,52,66,0.5)'; ctx.lineWidth = px(1.2); ctx.setLineDash([px(4), px(3)]);
      ctx.beginPath(); ctx.moveTo(d.x1, y0 + h * 0.55); ctx.lineTo(-g.thermo.hw - 1, y0 + h * 0.55); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#1b2430'; roundRect(ctx, x0, y0, w, h, px(8)); ctx.fill();
      ctx.strokeStyle = '#3a4757'; ctx.lineWidth = px(1); ctx.stroke();
      text('Dampftemperatur', x0 + px(9), y0 + px(12), { size: 11, align: 'left', color: '#aab6c4', weight: 600 });
      ctx.save();
      ctx.font = `700 ${Math.max(px(26), h * 0.42)}px ${FONT}`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#7ef0a6';
      ctx.fillText(fmt(st.reading, 1) + ' °C', x0 + w - px(9), y0 + h - px(10));
      ctx.restore();
    }

    // ------------------------------------------------------------------ Liebigkühler
    function drawCondenser(st, dtVis) {
      const g = geo, cd = g.cond;
      const j0 = cd.j0, j1 = cd.j1, jhw = cd.jhw, thw = cd.thw, L = cd.len;
      const ang = Math.atan2(cd.d.y, cd.d.x);
      const fx = st.fx;
      ctx.save();
      ctx.translate(cd.c0.x, cd.c0.y); ctx.rotate(ang);
      // Kühlmantel (Rückwand)
      const jacket = (inset) => {
        ctx.beginPath();
        ctx.moveTo(j0 - 12, -thw - 1.5);
        ctx.quadraticCurveTo(j0 - 2, -jhw + inset, j0 + 10, -jhw + inset);
        ctx.lineTo(j1 - 10, -jhw + inset);
        ctx.quadraticCurveTo(j1 + 2, -jhw + inset, j1 + 12, -thw - 1.5);
        ctx.lineTo(j1 + 12, thw + 1.5);
        ctx.quadraticCurveTo(j1 + 2, jhw - inset, j1 - 10, jhw - inset);
        ctx.lineTo(j0 + 10, jhw - inset);
        ctx.quadraticCurveTo(j0 - 2, jhw - inset, j0 - 12, thw + 1.5);
        ctx.closePath();
      };
      jacket(0); ctx.fillStyle = 'rgba(214,230,246,0.30)'; ctx.fill();
      // Kühlwasser im Mantel (nur zwischen Mantel und Innenrohr)
      const j = st.jacket;
      const correct = st.hoses.inlet === 'low' && st.hoses.outlet === 'high';
      if (j.fill > 0.005) {
        ctx.save();
        jacket(D.glass); ctx.clip();
        const warm = clamp((j.T - 15) / 50, 0, 1);
        const wc = [lerp(C.water[0], 170, warm), lerp(C.water[1], 190, warm), lerp(C.water[2], 215, warm)];
        ctx.fillStyle = rgba(wc, 0.42);
        if (correct || j.fill > M.SWAP_FILL + 0.02) {
          const xs = j1 + 12 - j.fill * (j1 - j0 + 24);
          ctx.fillRect(xs, -jhw, j1 + 14 - xs, 2 * jhw);
        } else {
          const hgt = Math.max(2.2, j.fill / M.SWAP_FILL * 5);
          ctx.fillRect(j0 - 12, jhw - D.glass - hgt, j1 - j0 + 24, hgt + 2);
        }
        // gerichtete Strömung: von unten (Zulauf) nach oben (Ablauf)
        if (fx.flow > 0) {
          if (dtVis > 0) vis.water += dtVis * (8 + 9 * fx.flow);
          const dir = correct ? -1 : 1;
          const sp = 26, off = (vis.water % sp) * dir;
          ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = px(1.4); ctx.lineCap = 'round';
          const a = Math.min(0.9, 0.35 + fx.flow / 10);
          ctx.globalAlpha = a;
          const bands = correct || j.fill > M.SWAP_FILL + 0.02 ? [-(jhw + thw) / 2, (jhw + thw) / 2] : [jhw - D.glass - 2.4];
          for (const yb of bands) {
            for (let x = j0 - sp + off; x < j1 + sp; x += sp) {
              if (x < j0 || x > j1) continue;
              ctx.beginPath(); ctx.moveTo(x - 3 * dir, yb - 2.6); ctx.lineTo(x + 2 * dir, yb); ctx.lineTo(x - 3 * dir, yb + 2.6); ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
      // Innenrohr
      ctx.fillStyle = 'rgba(236,243,250,0.55)'; ctx.fillRect(-6, -thw, L + 6, 2 * thw);
      // Kondensat im Innenrohr: Film und rinnende Tropfen (aus der Kondensationsrate)
      const cond = fx.cond, filmV = M.vol(st.film);
      if (filmV > 1e-4 || cond > 1e-5) {
        const zone = j0 + 6 + clamp(fx.condZone, 0.05, 1) * (j1 - j0 - 6);
        const th = clamp(0.6 + cond * 6, 0.6, 2.4);
        ctx.fillStyle = 'rgba(110,160,220,0.55)';
        ctx.beginPath();
        ctx.moveTo(j0 + 6, thw - D.glass * 0.6);
        ctx.lineTo(zone, thw - D.glass * 0.6 - th * 0.6);
        ctx.lineTo(L, thw - D.glass * 0.6 - th);
        ctx.lineTo(L, thw - D.glass * 0.6);
        ctx.closePath(); ctx.fill();
        if (dtVis > 0) vis.film += dtVis * 34;
        const n = Math.min(14, Math.round(2 + cond * 50));
        for (let i = 0; i < n; i++) {
          const span = L - (j0 + 6);
          const s = (j0 + 6) + ((hash(i * 3.1) * span + vis.film * (0.8 + hash(i) * 0.5)) % span);
          const r = s < zone ? 1.0 + hash(i + 2) * 1.2 : 1.6 + hash(i + 4) * 0.8;
          drawDrop(s, thw - D.glass - r * 0.8, r, 0.9);
          if (s < zone && hash(i + 11) < 0.5) drawDrop(s + 12, -thw + D.glass + 1.1, 0.9, 1);
        }
      }
      // Erklärmodus: Dampfteilchen im Innenrohr
      if (getUi().explain && fx.pass > 1e-5) {
        const zone = j0 + clamp(fx.condZone, 0.05, 1) * (j1 - j0);
        const n = Math.round(clamp(fx.pass * 90, 4, 22));
        for (let i = 0; i < n; i++) {
          const end = fx.escape > 1e-5 ? L + 10 : zone;
          const s = ((hash(i * 7.7) * end) + vis.time * 60 * (0.7 + hash(i) * 0.6)) % end;
          const fade = fx.escape > 1e-5 ? 1 : clamp((zone - s) / 40, 0, 1);
          ctx.fillStyle = `rgba(232,120,40,${0.55 * fade})`;
          ctx.beginPath(); ctx.arc(s, (hash(i + 5) - 0.5) * (thw * 1.2), 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.2);
      ctx.beginPath(); ctx.moveTo(-6, -thw); ctx.lineTo(L, -thw); ctx.moveTo(-6, thw); ctx.lineTo(L, thw); ctx.stroke();
      ctx.strokeStyle = C.glassInner; ctx.lineWidth = px(0.8);
      ctx.beginPath(); ctx.moveTo(-6, -thw + D.glass); ctx.lineTo(L, -thw + D.glass); ctx.moveTo(-6, thw - D.glass); ctx.lineTo(L, thw - D.glass); ctx.stroke();
      // Mantel vorne
      jacket(0); ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.5); ctx.stroke();
      jacket(D.glass); ctx.strokeStyle = C.glassInner; ctx.lineWidth = px(1); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(j0 + 14, -jhw + 3.5, j1 - j0 - 28, 1.8);
      ctx.restore();
      // Anschlussstutzen (Oliven)
      for (const k of ['high', 'low']) {
        const nz = g.nozzles[k];
        tubeStroke(() => { ctx.beginPath(); ctx.moveTo(nz.base.x - nz.dir.x * 3, nz.base.y - nz.dir.y * 3); ctx.lineTo(nz.tip.x, nz.tip.y); }, nz.hw);
        if (j.fill > 0.01 && (k === 'low' || correct || st.water.on)) {
          ctx.strokeStyle = rgba(C.water, 0.45); ctx.lineWidth = Math.max(0.5, 2 * nz.hw - px(3));
          ctx.beginPath(); ctx.moveTo(nz.base.x, nz.base.y); ctx.lineTo(nz.tip.x, nz.tip.y); ctx.stroke();
        }
        for (const f of [0.55, 0.8]) {
          const p = P(lerp(nz.base.x, nz.tip.x, f), lerp(nz.base.y, nz.tip.y, f));
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(nz.dir.y, nz.dir.x));
          ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.1);
          ctx.beginPath(); ctx.moveTo(0, -nz.hw - 1.2); ctx.lineTo(0, nz.hw + 1.2); ctx.stroke();
          ctx.restore();
        }
      }
      // Schliff Abgang/Kühler und Kühler/Vorstoß
      joint(cd.c0.x + cd.d.x * 6, cd.c0.y + cd.d.y * 6, ang, cd.thw + 1, 14);
      joint(cd.c1.x - cd.d.x * 2, cd.c1.y - cd.d.y * 2, ang, cd.thw + 1, 12);
    }

    // ------------------------------------------------------------------ Vorstoß, Tropfen, Vorlage
    function adapterPath() {
      const a = geo.adapter;
      ctx.beginPath();
      ctx.moveTo(a.a0.x - geo.cond.d.x * 6, a.a0.y - geo.cond.d.y * 6);
      ctx.lineTo(a.a1.x, a.a1.y);
      ctx.arc(a.center.x, a.center.y, a.r, a.startAngle, 0, false);
      ctx.lineTo(a.tip.x, a.tip.y);
    }
    function drawAdapter(st) {
      const a = geo.adapter;
      tubeStroke(adapterPath, a.hw);
      // Belüftungsolive am Bogen (Druckausgleich: die Apparatur ist offen)
      const vx = a.center.x + Math.cos(-0.75) * a.r, vy = a.center.y + Math.sin(-0.75) * a.r;
      tubeStroke(() => { ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx + 14, vy - 12); }, 3.2);
      // Kondensatfilm im Vorstoß
      const filmV = M.vol(st.film);
      if (filmV > 1e-4) {
        ctx.save();
        ctx.strokeStyle = 'rgba(110,160,220,0.6)'; ctx.lineWidth = clamp(0.8 + st.fx.cond * 8, 0.8, 2.2);
        ctx.beginPath(); ctx.arc(a.center.x, a.center.y, a.r + a.hw - D.glass - 1, a.startAngle + 0.2, 0, false); ctx.lineTo(a.tip.x + a.hw - D.glass - 1, a.tip.y - 2); ctx.stroke();
        ctx.restore();
      }
      // Tropfspitze verjüngt
      ctx.fillStyle = 'rgba(236,243,250,0.95)'; ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.2);
      ctx.beginPath(); ctx.moveTo(a.tip.x - a.hw, a.tip.y - 6); ctx.lineTo(a.tip.x - 2.2, a.tip.y + 6); ctx.lineTo(a.tip.x + 2.2, a.tip.y + 6); ctx.lineTo(a.tip.x + a.hw, a.tip.y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      // austretender Dampf (zurückhaltend) bei unzureichender Kühlung
      const esc = st.fx.escape;
      if (esc > 1e-5) {
        const k = clamp(esc / 0.08, 0.15, 1);
        ctx.save(); ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const ph = vis.time * 1.3 + i * 1.7;
          const base = i % 2 ? P(vx + 14, vy - 12) : P(a.tip.x, a.tip.y + 6);
          ctx.strokeStyle = `rgba(150,165,180,${0.30 * k * (1 - ((ph % 1)))})`; ctx.lineWidth = 3 + 3 * k;
          ctx.beginPath();
          const up = 40 * ((ph % 1));
          ctx.moveTo(base.x, base.y - up * 0.2);
          ctx.quadraticCurveTo(base.x + 8 * Math.sin(ph * 3), base.y - up * 0.6, base.x + 4 * Math.sin(ph * 2), base.y - up);
          ctx.stroke();
        }
        ctx.restore();
        text('⚠ Dampf tritt aus', a.tip.x + 58, a.tip.y - 36, { size: 12, color: '#7a4004', bg: 'rgba(253,241,220,0.95)', border: '#ecc98d' });
      }
    }
    function erlenPath(r, inset) {
      const x = r.x, gl = inset;
      const nh = r.neckHW - gl, bh = r.baseHW - gl;
      const coneTop = r.base - (r.h - 34);
      const bottom = r.base - gl, rc = 8;
      ctx.beginPath();
      ctx.moveTo(x - nh, r.rim + (inset ? 2 : 0));
      ctx.lineTo(x - nh, coneTop);
      ctx.lineTo(x - bh + rc * 0.4, bottom - rc);
      ctx.quadraticCurveTo(x - bh, bottom, x - bh + rc, bottom);
      ctx.lineTo(x + bh - rc, bottom);
      ctx.quadraticCurveTo(x + bh, bottom, x + bh - rc * 0.4, bottom - rc);
      ctx.lineTo(x + nh, coneTop);
      ctx.lineTo(x + nh, r.rim + (inset ? 2 : 0));
    }
    function drawErlenmeyer(r, V, opts) {
      const o = opts || {};
      erlenPath(r, 0); ctx.closePath();
      ctx.fillStyle = 'rgba(214,230,246,0.30)'; ctx.fill();
      if (V > 0.005) {
        ctx.save();
        erlenPath(r, D.glass); ctx.closePath(); ctx.clip();
        const fakeG = { receiver: r };
        const lev = G.receiverLevel(fakeG, V);
        const lg = ctx.createLinearGradient(0, lev.y, 0, r.base);
        lg.addColorStop(0, rgba([110, 165, 228], 0.70)); lg.addColorStop(1, rgba([90, 145, 215], 0.88));
        ctx.fillStyle = lg; ctx.fillRect(r.x - r.baseHW, lev.y, 2 * r.baseHW, r.base - lev.y);
        ctx.strokeStyle = 'rgba(40,90,160,0.85)'; ctx.lineWidth = px(1.3);
        ctx.beginPath(); ctx.moveTo(r.x - lev.half, lev.y); ctx.lineTo(r.x + lev.half, lev.y); ctx.stroke();
        const ry = Math.max(1, lev.half * 0.1);
        ctx.fillStyle = 'rgba(235,245,255,0.5)'; ctx.beginPath(); ctx.ellipse(r.x, lev.y, lev.half, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(80,120,170,0.6)'; ctx.lineWidth = px(1);
        ctx.beginPath(); ctx.ellipse(r.x, lev.y, lev.half, ry, 0, 0, Math.PI); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = px(1.1);
        ctx.beginPath(); ctx.moveTo(r.x - lev.half, lev.y - 2); ctx.quadraticCurveTo(r.x - lev.half + 3, lev.y, r.x - lev.half + 7, lev.y); ctx.stroke();
        ctx.restore();
        o.surface && o.surface(lev.y);
      }
      erlenPath(r, 0); ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.4); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,245,255,0.9)'; ctx.lineWidth = px(1.8);
      ctx.beginPath(); ctx.ellipse(r.x, r.rim, r.neckHW + 2.5, 1.8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.moveTo(r.x - r.neckHW - 3, r.base - (r.h - 34) + 16); ctx.lineTo(r.x - r.neckHW - 1, r.base - (r.h - 34) + 16); ctx.lineTo(r.x - r.baseHW + 12, r.base - 14); ctx.lineTo(r.x - r.baseHW + 8, r.base - 14); ctx.closePath(); ctx.fill();
      if (o.scale) {
        // Volumenskala
        ctx.strokeStyle = 'rgba(40,52,66,0.75)'; ctx.lineWidth = px(1);
        for (const ml of [20, 40, 60, 80, 100]) {
          const lev = G.receiverLevel({ receiver: r }, ml);
          const xr = r.x + lev.half * 0.35;
          ctx.beginPath(); ctx.moveTo(xr, lev.y); ctx.lineTo(xr + 9, lev.y); ctx.stroke();
          if (ml % 40 === 0) text(String(ml), xr + 11, lev.y, { size: 9, align: 'left', color: '#2a3542' });
          if (ml === 100) text('100 mL', xr + 11, lev.y - 1, { size: 9, align: 'left', color: '#2a3542' });
        }
      }
    }
    function drawReceiver(st, dtVis) {
      const g = geo, r = g.receiver;
      const rc = st.receiver;
      drawJack(r.jack.x, r.jack.w, r.jack.top, r.jack.h);
      // Wechselanimation (Expertenmodus): alte Vorlage gleitet nach links auf den Tisch, neue kommt
      const nF = st.fractions.length;
      if (vis.nFractions == null) vis.nFractions = nF;
      if (nF !== vis.nFractions) { vis.swap = nF > vis.nFractions ? { t: 0 } : null; vis.nFractions = nF; }
      if (vis.swap && dtVis > 0) { vis.swap.t += dtVis; if (vis.swap.t > 0.9) vis.swap = null; }
      const sw = vis.swap ? clamp(vis.swap.t / 0.9, 0, 1) : 1;
      // abgestellte Fraktionen links neben der Vorlage
      const shelf = st.fractions.slice(-3);
      shelf.forEach((f, i) => {
        const k = shelf.length - 1 - i;
        const small = scaledErlen(r, 0.62, r.x - 92 - k * 50, 0);
        let rr = small;
        if (i === shelf.length - 1 && vis.swap) {
          const from = { x: r.x, base: r.base };
          rr = scaledErlen(r, lerp(1, 0.62, sw), lerp(from.x, small.x, sw), lerp(r.base, 0, sw));
          rr.rim = rr.base - rr.h;
        }
        drawErlenmeyer(rr, M.vol(f.c), {});
        text(`V${f.n}`, rr.x, 11, { size: 10, color: '#22303d', weight: 700 });
        text(`${fmt(M.vol(f.c), 1)} mL`, rr.x, 24, { size: 9, color: '#22303d' });
      });
      if (!rc.present) {
        text('Keine Vorlage unter dem Vorstoß', r.x, r.jack.top - 30, { size: 11, color: '#7a4004', bg: 'rgba(253,241,220,0.95)', border: '#ecc98d' });
        // Vorlage steht abseits auf dem Tisch
        const off = scaledErlen(r, 0.75, r.x + 66, 0);
        drawErlenmeyer(off, M.vol(rc.c), {});
        return;
      }
      let rr = r;
      if (vis.swap) { rr = Object.assign({}, r, { x: lerp(r.x + 90, r.x, sw) }); rr.rim = r.rim; }
      let surfY = r.base - D.glass;
      drawErlenmeyer(rr, M.vol(rc.c), { scale: true, surface: (y) => { surfY = y; } });
      // Stopfen
      if (rc.stopper) {
        ctx.fillStyle = '#4a4f57';
        ctx.beginPath(); ctx.moveTo(r.x - r.neckHW - 3, r.rim - 8); ctx.lineTo(r.x + r.neckHW + 3, r.rim - 8); ctx.lineTo(r.x + r.neckHW - 1, r.rim + 12); ctx.lineTo(r.x - r.neckHW + 1, r.rim + 12); ctx.closePath(); ctx.fill();
      }
      // Volumenangabe auf dem Laborboy
      text(`Vorlage ${rc.n}: ${fmt(M.vol(rc.c), 1)} mL`, r.x, r.jack.top + r.jack.h / 2 + 1, { size: 11, color: '#fff', weight: 700, bg: 'rgba(31,37,45,0.85)' });
      return surfY;
    }
    function scaledErlen(r, f, x, base) {
      return { x, base, h: r.h * f, rim: base - r.h * f, baseHW: r.baseHW * f, neckHW: r.neckHW * f };
    }
    function drawDrops(st, dtVis, surfY) {
      const a = geo.adapter;
      const tipY = a.tip.y + 6;
      // Neue Tropfen aus dem Modell übernehmen (Tropfenzähler)
      const list = st.drops.list;
      const newest = list.length ? list[list.length - 1].n : 0;
      // Beim ersten Bild oder nach einem Neustart keine alten Tropfen nachholen
      if (vis.lastDrop > newest || vis.dropInit !== st.run) { vis.lastDrop = newest; vis.dropInit = st.run; }
      const fresh = list.filter((d) => d.n > vis.lastDrop);
      vis.lastDrop = newest;
      const now = vis.time;
      vis.lastRealDrops = vis.lastRealDrops.filter((t) => now - t < 1);
      for (const d of fresh) vis.lastRealDrops.push(now);
      const realRate = vis.lastRealDrops.length; // Tropfen pro Sekunde Echtzeit
      const target = st.receiver.present ? (surfY != null ? surfY : geo.receiver.base) : -6;
      const fall = Math.max(10, target - tipY);
      if (realRate > 7 && !reduce) {
        // im Zeitraffer: dünner Strahl statt Einzeltropfen
        ctx.strokeStyle = 'rgba(120,170,230,0.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -vis.time * 60;
        ctx.beginPath(); ctx.moveTo(a.tip.x, tipY); ctx.lineTo(a.tip.x, target); ctx.stroke(); ctx.setLineDash([]);
      } else {
        for (const d of fresh.slice(-6)) vis.drops.push({ t: 0, to: d.to });
      }
      if (dtVis > 0) vis.drops.forEach((d) => { d.t += dtVis; });
      const T = 0.32;
      vis.drops = vis.drops.filter((d) => d.t < T);
      for (const d of vis.drops) {
        const u = d.t / T;
        drawDrop(a.tip.x, tipY + 3 + fall * u * u, 2.2, 1 + 0.4 * u);
      }
      // hängender Tropfen an der Spitze (Menge aus dem Modell)
      const tv = M.vol(st.tip);
      if (tv > 0.002) { const rr = 1 + 1.6 * Math.cbrt(tv / M.DROP_VOL); drawDrop(a.tip.x, tipY + rr * 0.9, rr, 1.15); }
    }

    // ------------------------------------------------------------------ Schläuche, Armatur, Ausguss
    function drawHose(pts, wet, selected, flowDir) {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      chain(ctx, pts); ctx.strokeStyle = selected ? C.accent : 'rgba(70,86,104,0.9)'; ctx.lineWidth = selected ? 12 : 10; ctx.stroke();
      chain(ctx, pts); ctx.strokeStyle = 'rgba(232,238,244,0.96)'; ctx.lineWidth = 7.2; ctx.stroke();
      if (wet) {
        chain(ctx, pts); ctx.strokeStyle = rgba(C.water, 0.55); ctx.lineWidth = 5.6; ctx.stroke();
        if (flowDir) {
          chain(ctx, pts); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 11]); ctx.lineDashOffset = -vis.hose * flowDir; ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      chain(ctx, pts); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    }
    function drawHoses(st, ui, dtVis) {
      const g = geo, h = st.hoses;
      const flowing = st.fx.flow > 0;
      if (flowing && dtVis > 0) vis.hose += dtVis * (20 + 8 * st.fx.flow);
      const selIn = ui.selected === 'hose:inlet', selOut = ui.selected === 'hose:outlet';
      drawHose(h.inlet ? g.hoseRoutes.inlet(h.inlet) : g.hoseRoutes.looseInlet(), flowing, selIn, flowing ? 1 : 0);
      drawHose(h.outlet ? g.hoseRoutes.outlet(h.outlet) : g.hoseRoutes.looseOutlet(), flowing || (h.outlet && st.jacket.fill > 0.5), selOut, flowing ? 1 : 0);
      // offene Schlauchenden markieren
      const endOf = (pts) => pts[pts.length - 1];
      if (!h.inlet) { const e = endOf(g.hoseRoutes.looseInlet()); ctx.fillStyle = '#46566a'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 3, 5, 0.3, 0, Math.PI * 2); ctx.fill(); }
      if (!h.outlet) { const e = endOf(g.hoseRoutes.looseOutlet()); ctx.fillStyle = '#46566a'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
      // Wasser fließt in den Ausguss
      if (flowing && h.outlet) {
        const s = g.sink.drop;
        ctx.strokeStyle = rgba(C.water, 0.6); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, 10); ctx.stroke();
      }
    }
    function drawTap(st) {
      const t = geo.tap;
      metalRod(t.x, t.top + 6, t.x, 0, 12);
      ctx.fillStyle = '#3a434f'; roundRect(ctx, t.x - 16, -8, 32, 8, 2); ctx.fill();
      // Ventilkörper und Olive
      ctx.fillStyle = '#7d8896'; roundRect(ctx, t.x - 9, t.top - 6, 18, 22, 4); ctx.fill();
      tubeStroke(() => { ctx.beginPath(); ctx.moveTo(t.x + 6, t.top + 2); ctx.lineTo(t.outlet.x, t.outlet.y); }, 3.6, '#c9d1db');
      // Hebel: quer = zu, längs = offen (zusätzlich farbige Markierung und Text)
      const open = st.water.on;
      const ang = open ? -Math.PI / 2 + (st.water.level === 'low' ? 0.5 : st.water.level === 'mid' ? 0.25 : 0) : 0;
      ctx.save(); ctx.translate(t.handle.x, t.handle.y); ctx.rotate(ang);
      ctx.fillStyle = open ? '#1f6fd1' : '#c62f3a'; roundRect(ctx, -3, -4, 34, 8, 3); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2f3640'; ctx.beginPath(); ctx.arc(t.handle.x, t.handle.y, 6, 0, Math.PI * 2); ctx.fill();
    }

    // ------------------------------------------------------------------ Tischgeräte
    function drawBench(st, ui) {
      const g = geo;
      // Flasche mit dem gewählten Gemisch
      const b = g.bottle;
      const filling = st.op && st.op.type === 'fill';
      if (!filling) {
        const x0 = b.x - b.w / 2, top = -b.h;
        ctx.fillStyle = 'rgba(214,230,246,0.55)'; roundRect(ctx, x0, top + 18, b.w, b.h - 18, 6); ctx.fill();
        ctx.fillStyle = rgba(C.liquid, 0.55); roundRect(ctx, x0 + 3, top + 40, b.w - 6, b.h - 43, 4); ctx.fill();
        ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.2); roundRect(ctx, x0, top + 18, b.w, b.h - 18, 6); ctx.stroke();
        ctx.fillStyle = 'rgba(214,230,246,0.7)'; ctx.fillRect(b.x - 9, top + 4, 18, 16); ctx.strokeRect(b.x - 9, top + 4, 18, 16);
        ctx.fillStyle = '#2f6fb5'; roundRect(ctx, b.x - 11, top - 4, 22, 10, 2); ctx.fill();
        ctx.fillStyle = '#fffef6'; ctx.fillRect(x0 + 4, top + 46, b.w - 8, 30);
        const mix = M.MIXES[st.mix];
        text(mix.short.split('/')[0], b.x, top + 55, { size: 9, color: '#222', weight: 700 });
        text(mix.id === 'pew' ? '+ Ethanol + Wasser' : '+ Wasser', b.x, top + 67, { size: 8, color: '#333', weight: 600 });
      }
      // Schälchen mit Siedesteinen
      const s = g.stonesDish;
      ctx.fillStyle = '#f3f1ec'; ctx.strokeStyle = '#9a9286'; ctx.lineWidth = px(1);
      ctx.beginPath(); ctx.ellipse(s.x, -s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!st.stones) for (let i = 0; i < 6; i++) { ctx.fillStyle = '#ddd7cc'; ctx.beginPath(); ctx.arc(s.x - 12 + i * 5, -s.h / 2 - 1 + (i % 2) * 2, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      // Stopfen auf dem Tisch
      if (!st.receiver.stopper) {
        const p = g.stopper;
        ctx.fillStyle = '#4a4f57';
        ctx.beginPath(); ctx.moveTo(p.x - 12, p.y - 10); ctx.lineTo(p.x + 12, p.y - 10); ctx.lineTo(p.x + 9, p.y + 6); ctx.lineTo(p.x - 9, p.y + 6); ctx.closePath(); ctx.fill();
      }
    }
    function drawFilling(st) {
      if (!(st.op && st.op.type === 'fill')) return;
      const g = geo, u = clamp(st.op.t / st.op.dur, 0, 1);
      // Trichter im Aufsatz
      const fy = g.head.y1 - 6;
      ctx.fillStyle = 'rgba(214,230,246,0.6)'; ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.2);
      ctx.beginPath(); ctx.moveTo(-34, fy - 46); ctx.lineTo(34, fy - 46); ctx.lineTo(5, fy); ctx.lineTo(5, g.arm.o.y + 30); ctx.lineTo(-5, g.arm.o.y + 30); ctx.lineTo(-5, fy); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Becherglas mit dem Gemisch, wird geneigt
      const tilt = clamp((u - 0.05) / 0.2, 0, 1) * (u < 0.88 ? 1 : 1 - (u - 0.88) / 0.12);
      ctx.save(); ctx.translate(46, fy - 70); ctx.rotate(-tilt * 1.05);
      ctx.fillStyle = 'rgba(214,230,246,0.6)'; ctx.fillRect(0, -50, 46, 60); ctx.strokeRect(0, -50, 46, 60);
      const left = 1 - clamp((u - 0.25) / 0.6, 0, 1);
      ctx.fillStyle = rgba(C.liquid, 0.65); ctx.fillRect(2, 8 - 50 * left, 42, 50 * left);
      ctx.restore();
      if (u > 0.22 && u < 0.86) {
        ctx.strokeStyle = rgba(C.liquid, 0.85); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(40, fy - 98); ctx.quadraticCurveTo(14, fy - 80, 6, fy - 40); ctx.stroke();
        ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(0, g.arm.o.y + 30); ctx.lineTo(0, G.flaskLevel(g, M.vol(st.flask.c)).y); ctx.stroke();
      }
    }

    // ------------------------------------------------------------------ Prüfplatz
    function drawStation(st, ui) {
      const s = geo.station;
      if (!s) return;
      ctx.fillStyle = '#e9e5dc'; roundRect(ctx, s.mat.x0, -s.mat.h, s.mat.x1 - s.mat.x0, s.mat.h, 3); ctx.fill();
      ctx.strokeStyle = '#b9b2a4'; ctx.lineWidth = px(1); ctx.stroke();
      text('Prüfplatz (getrennt)', s.x0 + 4, 17, { size: 11, align: 'left', color: '#22303d', weight: 700 });
      // Porzellanschale
      const d = s.dish;
      const sel = (id) => ui.selected === id;
      ctx.fillStyle = '#fbfbf8'; ctx.strokeStyle = sel('dish') ? C.accent : '#8e959d'; ctx.lineWidth = px(sel('dish') ? 2.4 : 1.2);
      ctx.beginPath(); ctx.moveTo(d.x - 34, d.y - 22); ctx.quadraticCurveTo(d.x, d.y + 12, d.x + 34, d.y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(d.x, d.y - 22, 34, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (st.dish && M.vol(st.dish.c) > 0.005) {
        ctx.fillStyle = rgba(C.liquid, 0.8); ctx.beginPath(); ctx.ellipse(d.x, d.y - 12, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
      // Flamme aus dem Modell (Brenndauer und Stärke)
      const fl = st.fx.flame;
      if (fl > 0) {
        const hgt = 30 + 46 * fl;
        for (let i = 0; i < 3; i++) {
          const w = (16 - i * 4) * (0.7 + 0.3 * fl);
          const flick = (noise(vis.time * 9, i) - 0.5) * 6;
          const fg = ctx.createLinearGradient(0, d.y - 14, 0, d.y - 14 - hgt);
          fg.addColorStop(0, `rgba(40,90,255,${0.65 - i * 0.12})`); fg.addColorStop(0.55, `rgba(90,140,255,${0.45 - i * 0.1})`); fg.addColorStop(0.92, `rgba(255,220,140,${0.12})`); fg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.moveTo(d.x - w, d.y - 12);
          ctx.quadraticCurveTo(d.x - w * 0.9, d.y - 14 - hgt * 0.5, d.x + flick, d.y - 14 - hgt * (1 - i * 0.12));
          ctx.quadraticCurveTo(d.x + w * 0.9, d.y - 14 - hgt * 0.5, d.x + w, d.y - 12); ctx.closePath(); ctx.fill();
        }
        text(st.dish && st.dish.result === 'flicker' ? 'kurzes Aufflackern' : 'bläuliche Flamme', d.x, d.y - 26 - hgt, { size: 11, color: '#1d3f9a', bg: 'rgba(255,255,255,0.85)' });
      } else if (st.dish && st.dish.result) {
        const txt = { burns: 'Flamme erloschen', flicker: 'kurz aufgeflackert', none: 'keine Flamme' }[st.dish.result];
        text(txt, d.x, d.y - 46, { size: 11, color: '#3d4b5a', bg: 'rgba(255,255,255,0.85)' });
      }
      // Pipette (Pasteurpipette mit Saughütchen)
      const p = s.pipette, full = !!st.pipette;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(sel('pipette') ? -0.35 : 0);
      ctx.fillStyle = 'rgba(236,243,250,0.95)'; ctx.strokeStyle = sel('pipette') ? C.accent : C.glassEdge; ctx.lineWidth = px(sel('pipette') ? 2.4 : 1.1);
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-4, -40); ctx.lineTo(-4, -84); ctx.lineTo(4, -84); ctx.lineTo(4, -40); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (full) { ctx.fillStyle = rgba(C.liquid, 0.9); ctx.fillRect(-3, -36, 6, 34); }
      ctx.fillStyle = '#d23b3b'; roundRect(ctx, -6, -108, 12, 26, 5); ctx.fill();
      ctx.restore();
      // Stabfeuerzeug
      const l = s.lighter;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(sel('lighter') ? -0.5 : 0);
      ctx.fillStyle = sel('lighter') ? '#1f6fd1' : '#3a434f'; roundRect(ctx, -6, -54, 12, 48, 4); ctx.fill();
      metalRod(0, -96, 0, -54, 4);
      if (sel('lighter')) { ctx.fillStyle = 'rgba(255,170,60,0.9)'; ctx.beginPath(); ctx.ellipse(0, -102, 3, 6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }

    // ------------------------------------------------------------------ Erklärmodus im Kolben/Aufsatz
    function drawExplainVapor(st) {
      const fx = st.fx, g = geo;
      if (!getUi().explain) return;
      if (fx.vapor <= 1e-5) return;
      const surfY = G.flaskLevel(g, M.vol(st.flask.c)).y;
      const n = Math.round(clamp(fx.vapor * 120, 4, 26));
      for (let i = 0; i < n; i++) {
        const u = (hash(i * 5.3) + vis.time * (0.35 + hash(i) * 0.3)) % 1;
        // Weg: Flüssigkeit → Hals → Aufsatz → Abgang
        let x, y;
        const yTop = g.arm.o.y;
        const reachArm = fx.pass > 1e-5;
        if (u < 0.75 || !reachArm) {
          const v = reachArm ? u / 0.75 : u;
          y = lerp(surfY - 4, yTop + (reachArm ? 0 : 30), v);
          x = (hash(i + 2) - 0.5) * 2 * (y > g.neck.y0 ? g.flask.R * 0.5 : g.head.hw * 0.7);
          if (!reachArm && v > 0.85) continue;
        } else {
          const v = (u - 0.75) / 0.25;
          const p = P(lerp(0, g.arm.end.x, v), lerp(yTop, g.arm.end.y, v));
          x = p.x; y = p.y + (hash(i + 3) - 0.5) * 6;
        }
        ctx.fillStyle = 'rgba(232,120,40,0.55)';
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ------------------------------------------------------------------ Einblendungen (Detail, Diagramm)
    function overlayBox(title) {
      const o = geo.overlay;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.strokeStyle = '#c3cdd8'; ctx.lineWidth = px(1.2);
      roundRect(ctx, o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0, 10); ctx.fill(); ctx.stroke();
      text(title, o.x0 + 12, o.y0 + 16, { size: 13, align: 'left', weight: 700 });
      ctx.restore();
      return o;
    }
    function drawDetail(st) {
      const o = overlayBox('Liebigkühler im Schnitt (vergrößert)');
      const fx = st.fx, j = st.jacket;
      const correct = st.hoses.inlet === 'low' && st.hoses.outlet === 'high';
      const x0 = o.x0 + 20, x1 = o.x1 - 20, yc = (o.y0 + o.y1) / 2 + 12;
      const H = (o.y1 - o.y0) - 80, wTube = H * 0.36;
      const yo0 = yc - H / 2, yo1 = yc + H / 2, yi0 = yc - wTube / 2, yi1 = yc + wTube / 2;
      ctx.save();
      // Mantelraum mit Wasser
      ctx.fillStyle = 'rgba(214,230,246,0.35)'; ctx.fillRect(x0, yo0, x1 - x0, H);
      if (j.fill > 0.01) {
        const warm = clamp((j.T - 15) / 50, 0, 1);
        const wc = [lerp(C.water[0], 170, warm), lerp(C.water[1], 190, warm), lerp(C.water[2], 215, warm)];
        ctx.fillStyle = rgba(wc, 0.45);
        if (correct || j.fill > M.SWAP_FILL + 0.02) { ctx.fillRect(x0, yo0, x1 - x0, yi0 - yo0); ctx.fillRect(x0, yi1, x1 - x0, yo1 - yi1); }
        else { const hh = (yo1 - yi1) * 0.45; ctx.fillRect(x0, yo1 - hh, x1 - x0, hh); }
      }
      // Strömungspfeile Wasser
      if (fx.flow > 0) {
        const dir = correct ? -1 : 1;
        const sp = 46, off = ((vis.water * 2.4) % sp) * dir;
        ctx.strokeStyle = 'rgba(20,70,140,0.75)'; ctx.lineWidth = px(1.8);
        const rows = correct || j.fill > M.SWAP_FILL + 0.02 ? [(yo0 + yi0) / 2, (yi1 + yo1) / 2] : [yo1 - (yo1 - yi1) * 0.22];
        for (const y of rows) for (let x = x0 + off - sp; x < x1 + sp; x += sp) {
          if (x < x0 + 8 || x > x1 - 8) continue;
          ctx.beginPath(); ctx.moveTo(x - 8 * dir, y); ctx.lineTo(x + 8 * dir, y); ctx.lineTo(x + 3 * dir, y - 4); ctx.moveTo(x + 8 * dir, y); ctx.lineTo(x + 3 * dir, y + 4); ctx.stroke();
        }
      }
      // Innenrohr: Dampf und Kondensat
      ctx.fillStyle = 'rgba(250,252,255,0.95)'; ctx.fillRect(x0, yi0, x1 - x0, wTube);
      if (fx.pass > 1e-5) {
        const zone = x0 + clamp(fx.condZone, 0.05, 1) * (x1 - x0);
        const n = Math.round(clamp(fx.pass * 160, 6, 40));
        for (let i = 0; i < n; i++) {
          const end = fx.escape > 1e-5 ? x1 : zone;
          const x = x0 + ((hash(i * 3.7) * (end - x0)) + vis.time * 50 * (0.6 + hash(i))) % (end - x0);
          const fade = fx.escape > 1e-5 ? 1 : clamp((zone - x) / 50, 0, 1);
          ctx.fillStyle = `rgba(232,120,40,${0.6 * fade})`;
          ctx.beginPath(); ctx.arc(x, yi0 + 6 + hash(i + 1) * (wTube - 12), 2.2, 0, Math.PI * 2); ctx.fill();
        }
        // Wärmeübergang: kleine Pfeile vom Innenrohr in das Kühlwasser
        if (j.fill > 0.01 && fx.cond > 1e-5) {
          ctx.strokeStyle = 'rgba(214,80,30,0.7)'; ctx.lineWidth = px(1.6);
          for (let x = x0 + 30; x < zone; x += 60) {
            for (const [ya, yb] of [[yi0, yi0 - 14], [yi1, yi1 + 14]]) {
              if (!correct && j.fill <= M.SWAP_FILL + 0.02 && yb < yi0) continue;
              ctx.beginPath(); ctx.moveTo(x, ya); ctx.lineTo(x, yb); ctx.lineTo(x - 3, yb + (yb < ya ? 4 : -4)); ctx.moveTo(x, yb); ctx.lineTo(x + 3, yb + (yb < ya ? 4 : -4)); ctx.stroke();
            }
          }
        }
      }
      if (fx.cond > 1e-5 || M.vol(st.film) > 1e-4) {
        const zone = x0 + clamp(fx.condZone, 0.05, 1) * (x1 - x0);
        const n = Math.min(16, Math.round(4 + fx.cond * 80));
        for (let i = 0; i < n; i++) {
          const x = x0 + ((hash(i * 2.9) * (x1 - x0)) + vis.film * 2.2 * (0.7 + hash(i) * 0.5)) % (x1 - x0);
          const r = x < zone ? 2 + hash(i) * 2.5 : 3.5;
          drawDrop(x, yi1 - r - 1.5, r, 0.9);
          if (x < zone && hash(i + 7) < 0.6) drawDrop(x + 20, yi0 + 3, 1.8, 1);
        }
      }
      // Glaswände
      ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.6);
      for (const y of [yo0, yo1, yi0, yi1]) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      // Beschriftung der zwei getrennten Strömungsräume
      const wTxt = j.fill > 0.01 ? `Kühlwasser im Mantel · ${fmt(j.T, 0)} °C · ${st.water.on ? 'Durchfluss ' + M.FLOW[st.water.level].name : 'steht'}` : 'Kühlmantel leer (Luft)';
      text(wTxt + (fx.flow > 0 ? (correct ? '  ← strömt zum Ablauf' : '  → läuft unten durch') : ''), x0 + 6, yo0 + 11, { size: 11, align: 'left', color: '#0d3d75' });
      text(fx.pass > 1e-5 ? `Innenrohr: Dampf ${fmt(fx.Tb, 0)} °C → kondensiert` : 'Innenrohr: kein Dampf', x0 + 6, yc, { size: 11, align: 'left', color: '#7a3a0a', bg: 'rgba(255,255,255,0.75)' });
      text(`Kondensat: ${fmt(fx.cond * 60, 1)} mL/min` + (fx.escape > 1e-5 ? ` · nicht kondensiert: ${fmt(fx.escape * 60, 1)} mL/min` : ''), x0 + 6, yo1 + 14, { size: 11, align: 'left', color: fx.escape > 1e-5 ? '#a8640a' : '#22303d' });
      ctx.restore();
    }
    function drawChart(st) {
      const o = overlayBox('Temperatur-Zeit-Diagramm (Thermometer)');
      const x0 = o.x0 + 46, x1 = o.x1 - 14, y0 = o.y0 + 34, y1 = o.y1 - 30;
      const s = st.series;
      const tMax = Math.max(300, Math.ceil(((s.length ? s[s.length - 1].t : 0) + 60) / 300) * 300);
      const X = (t) => x0 + (t / tMax) * (x1 - x0);
      const Y = (T) => y1 - ((T - 0) / 110) * (y1 - y0);
      ctx.save();
      ctx.strokeStyle = '#d9e0e8'; ctx.lineWidth = px(1);
      for (let T = 0; T <= 110; T += 10) { ctx.beginPath(); ctx.moveTo(x0, Y(T)); ctx.lineTo(x1, Y(T)); ctx.stroke(); if (T % 20 === 0) text(String(T), x0 - 6, Y(T), { size: 10, align: 'right', color: '#3d4b5a' }); }
      const step = tMax <= 900 ? 120 : tMax <= 2400 ? 300 : 600;
      for (let t = 0; t <= tMax; t += step) { ctx.beginPath(); ctx.moveTo(X(t), y0); ctx.lineTo(X(t), y1); ctx.stroke(); text(String(Math.round(t / 60)), X(t), y1 + 10, { size: 10, color: '#3d4b5a' }); }
      ctx.strokeStyle = '#3d4b5a'; ctx.lineWidth = px(1.4);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      text('ϑ in °C', x0 + 4, y0 + 8, { size: 10, align: 'left', color: '#3d4b5a', bg: 'rgba(255,255,255,0.85)' });
      text('t in min', x1, y1 + 22, { size: 10, align: 'right', color: '#3d4b5a' });
      // Siedetemperaturen der Reinstoffe
      ctx.setLineDash([px(5), px(4)]);
      for (const k of M.KEYS) {
        const S = M.SUBSTANCES[k];
        ctx.strokeStyle = 'rgba(31,111,209,0.45)';
        ctx.beginPath(); ctx.moveTo(x0, Y(S.bp)); ctx.lineTo(x1, Y(S.bp)); ctx.stroke();
        text(`${S.name} ${S.bp} °C`, x1 - 4, Y(S.bp) - 8, { size: 9, align: 'right', color: '#1f5fb0' });
      }
      ctx.setLineDash([]);
      // Kurve
      if (s.length > 1) {
        ctx.strokeStyle = '#d6303a'; ctx.lineWidth = px(2);
        ctx.beginPath();
        s.forEach((p, i) => { if (i === 0) ctx.moveTo(X(p.t), Y(p.T)); else ctx.lineTo(X(p.t), Y(p.T)); });
        ctx.stroke();
        for (const p of s) if (p.change) {
          ctx.strokeStyle = 'rgba(28,138,74,0.8)'; ctx.lineWidth = px(1.4);
          ctx.beginPath(); ctx.moveTo(X(p.t), y0); ctx.lineTo(X(p.t), y1); ctx.stroke();
          text('V' + p.change, X(p.t) + 2, y0 + 8, { size: 9, align: 'left', color: C.ok, weight: 700 });
        }
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------ Beschriftung, Nummern, Auswahl
    function drawLabels(st, ui) {
      const mode = ui.labels; // 'names' | 'numbers' | null
      if (!mode) return;
      const names = root.DS.tasks ? root.DS.tasks.PART_NAMES : {};
      PARTS.forEach((p, i) => {
        if (p.id === 'distillate' && M.vol(st.receiver.c) < 0.05 && mode === 'names') return;
        if (p.id === 'stones' && !st.stones && mode === 'names') return;
        const a = p.anchor(geo, st), l = p.label(geo, st);
        const hl = ui.selectedPart === p.id;
        ctx.strokeStyle = hl ? C.accent : 'rgba(23,33,44,0.7)'; ctx.lineWidth = px(hl ? 2 : 1.2);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(l.x, l.y); ctx.stroke();
        ctx.fillStyle = hl ? C.accent : '#17212c'; ctx.beginPath(); ctx.arc(a.x, a.y, px(3), 0, Math.PI * 2); ctx.fill();
        const n = (root.DS.tasks ? root.DS.tasks.PART_ORDER.indexOf(p.id) : i) + 1;
        if (mode === 'numbers') {
          ctx.fillStyle = hl ? C.accent : '#17212c';
          ctx.beginPath(); ctx.arc(l.x, l.y, px(11), 0, Math.PI * 2); ctx.fill();
          text(String(n), l.x, l.y + px(0.5), { size: 12, color: '#fff', weight: 700 });
        } else {
          text(names[p.id] || p.id, l.x, l.y, { size: 12, weight: 700, color: hl ? '#fff' : C.label, bg: hl ? C.accent : 'rgba(255,255,255,0.94)', border: hl ? C.accent : '#9fb0c2' });
        }
      });
    }
    function drawSelection(st, ui) {
      if (!ui.selectedPart) return;
      const b = partBox(ui.selectedPart, st);
      if (!b) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(31,111,209,0.9)'; ctx.lineWidth = px(2.5); ctx.setLineDash([px(6), px(4)]);
      roundRect(ctx, b.x0 - 6, b.y0 - 6, b.x1 - b.x0 + 12, b.y1 - b.y0 + 12, 10); ctx.stroke();
      ctx.restore();
    }

    /** Umriss eines Geräts in Weltkoordinaten (für Auswahl und Trefferflächen). */
    function partBox(id, st) {
      const g = geo;
      const c = g.flask.c;
      switch (id) {
        case 'flask': return { x0: -g.flask.R, y0: g.neck.y1, x1: g.flask.R, y1: c.y + g.flask.R };
        case 'mantle': return { x0: -g.mantle.outer, y0: g.mantle.rim, x1: g.mantle.outer, y1: g.mantle.base };
        case 'stones': return { x0: -16, y0: c.y + g.flask.R - 14, x1: 18, y1: c.y + g.flask.R };
        case 'head': return { x0: -g.head.hw, y0: g.head.y1, x1: g.arm.end.x, y1: g.head.y0 };
        case 'thermo': { const pos = st.thermo; return { x0: -14, y0: g.thermo.top(pos), x1: 14, y1: g.thermo.bulb[pos] + 10 }; }
        case 'condenser': { const a = g.cond.at(g.cond.j0, 0), b = g.cond.at(g.cond.j1, 0); return { x0: a.x, y0: a.y - g.cond.jhw - 6, x1: b.x, y1: b.y + g.cond.jhw + 6 }; }
        case 'inlet': { const t = g.nozzles.low.tip; return { x0: t.x - 14, y0: t.y - 26, x1: t.x + 14, y1: t.y + 8 }; }
        case 'outlet': { const t = g.nozzles.high.tip; return { x0: t.x - 14, y0: t.y - 8, x1: t.x + 14, y1: t.y + 26 }; }
        case 'adapter': { const a = g.adapter; return { x0: a.a0.x, y0: a.a0.y - 10, x1: a.tip.x + a.hw + 4, y1: a.tip.y + 6 }; }
        case 'receiver': { const r = g.receiver; return { x0: r.x - r.baseHW, y0: r.rim, x1: r.x + r.baseHW, y1: r.base }; }
        case 'distillate': { const r = g.receiver; const lev = G.receiverLevel(g, M.vol(st.receiver.c)); return { x0: r.x - r.baseHW + 4, y0: Math.min(lev.y, r.base - 10), x1: r.x + r.baseHW - 4, y1: r.base }; }
        case 'stand': return { x0: g.stand1.base.x0, y0: g.stand1.top, x1: g.stand1.clamps[0].x1 + 4, y1: 0 };
        default: return null;
      }
    }

    // ------------------------------------------------------------------ Bild
    function frame(dtReal) {
      const st = getState(), ui = getUi();
      resize();
      const dtModel = vis.lastT == null ? 0 : st.t - vis.lastT;
      vis.lastT = st.t;
      const dtVis = dtModel > 0 ? Math.min(0.1, dtReal) : 0;
      if (dtVis > 0) vis.time += dtVis;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(view.scale * view.dpr, 0, 0, view.scale * view.dpr, view.ox * view.dpr, view.oy * view.dpr);

      drawStands(st);
      drawJack(geo.jack.x, geo.jack.w, geo.jack.top, geo.jack.h);
      drawTap(st);
      drawBench(st, ui);
      drawStation(st, ui);
      drawMantleBack(st);
      drawHeadBack();
      drawThermometer(st, ui);
      drawFlask(st, dtVis);
      drawMantleFront(st, ui);
      drawHeadFront();
      drawExplainVapor(st);
      clampArm(geo.stand1.rodX, 0, geo.stand1.clamps[0].y, geo.neck.hw, 0);
      drawCondenser(st, dtVis);
      clampArm(geo.stand2.rodX, geo.stand2.clampAt.x, geo.stand2.clampAt.y, geo.cond.jhw, Math.atan2(geo.cond.d.y, geo.cond.d.x), geo.stand2.clampAt);
      drawAdapter(st);
      const surf = drawReceiver(st, dtVis);
      drawDrops(st, dtVis, surf);
      drawHoses(st, ui, dtVis);
      drawFilling(st);
      drawDisplay(st);
      if (ui.overlay === 'detail') drawDetail(st);
      else if (ui.overlay === 'chart' && st.expert) drawChart(st);
      drawSelection(st, ui);
      drawLabels(st, ui);
    }

    // ------------------------------------------------------------------ Trefferflächen
    /** Trefferflächen in CSS-Pixeln relativ zur Bühne (mindestens 44 × 44 px). */
    function hitAreas(ui) {
      const st = getState();
      resize();
      const out = [];
      const rect = (id, b) => {
        if (!b) return;
        const a = toScreen(P(b.x0, b.y0)), c = toScreen(P(b.x1, b.y1));
        const w = Math.max(44, c.x - a.x), h = Math.max(44, c.y - a.y);
        out.push({ id, x: Math.round((a.x + c.x) / 2 - w / 2), y: Math.round((a.y + c.y) / 2 - h / 2), w: Math.round(w), h: Math.round(h) });
      };
      const g = geo;
      if (ui.explore) {
        PARTS.forEach((p) => { if (p.id !== 'distillate' || M.vol(st.receiver.c) > 0.05) rect('part:' + p.id, partBox(p.id, st)); });
        return out;
      }
      const end = (pts) => pts[pts.length - 1];
      rect('bottle', { x0: g.bottle.x - g.bottle.w / 2, y0: -g.bottle.h, x1: g.bottle.x + g.bottle.w / 2, y1: 0 });
      rect('stones', { x0: g.stonesDish.x - g.stonesDish.w / 2, y0: -30, x1: g.stonesDish.x + g.stonesDish.w / 2, y1: 0 });
      rect('mantle', { x0: -g.mantle.outer, y0: g.mantle.base - 24, x1: g.mantle.outer, y1: g.mantle.base });
      rect('flask', { x0: -g.flask.R, y0: g.neck.y1, x1: g.flask.R, y1: g.mantle.base - 26 });
      rect('thermo', partBox('thermo', st));
      rect('condenser', (() => { const b = partBox('condenser', st); return { x0: b.x0 + 60, y0: b.y0 + 30, x1: b.x1 - 80, y1: b.y1 - 30 }; })());
      for (const k of ['high', 'low']) { const t = g.nozzles[k].tip; rect('nozzle:' + k, { x0: t.x - 12, y0: t.y - 12, x1: t.x + 12, y1: t.y + 12 }); }
      if (!st.hoses.inlet) { const e = end(g.hoseRoutes.looseInlet()); rect('hose:inlet', { x0: e.x - 22, y0: e.y - 30, x1: e.x + 6, y1: e.y + 4 }); }
      if (!st.hoses.outlet) { const e = end(g.hoseRoutes.looseOutlet()); rect('hose:outlet', { x0: e.x - 14, y0: e.y - 30, x1: e.x + 14, y1: e.y + 8 }); }
      rect('tap', { x0: g.tap.x - 14, y0: g.tap.top - 10, x1: g.tap.x + 30, y1: g.tap.top + 40 });
      rect('receiver', partBox('receiver', st));
      if (st.receiver.present) {
        const p = st.receiver.stopper ? { x0: g.receiver.x - 18, y0: g.receiver.rim - 10, x1: g.receiver.x + 18, y1: g.receiver.rim + 12 } : { x0: g.stopper.x - 14, y0: -18, x1: g.stopper.x + 14, y1: 4 };
        rect('stopper', p);
      }
      rect('adapter', { x0: g.adapter.a1.x - 10, y0: g.adapter.a1.y - 14, x1: g.adapter.tip.x + 10, y1: g.adapter.a2.y + 10 });
      if (g.station) {
        const s = g.station;
        rect('pipette', { x0: s.pipette.x - 10, y0: -116, x1: s.pipette.x + 10, y1: 0 });
        rect('lighter', { x0: s.lighter.x - 10, y0: -104, x1: s.lighter.x + 10, y1: 0 });
        rect('dish', { x0: s.dish.x - 36, y0: s.dish.y - 30, x1: s.dish.x + 36, y1: 0 });
      }
      return out;
    }

    /** Bildschirmpunkte wichtiger Anker (für Tests und die Digitalanzeige im DOM). */
    function anchors() {
      const st = getState();
      resize();
      const g = geo;
      const pts = {};
      for (const c of G.connections(g)) pts[c.name] = [toScreen(c.a), toScreen(c.b)];
      return { view: Object.assign({}, view), connections: pts, display: { a: toScreen(P(g.display.x0, g.display.y0)), b: toScreen(P(g.display.x1, g.display.y1)) }, bounds: { a: toScreen(P(g.bounds.x0, g.bounds.y0)), b: toScreen(P(g.bounds.x1, g.bounds.y1)) }, thermoBulb: toScreen(P(0, g.thermo.bulb[st.thermo])) };
    }

    return { frame, resize, hitAreas, anchors, partBox, get geo() { return geo; }, view, PARTS };
  }

  (root.DS = root.DS || {}).render = { createRenderer, PARTS };
})(typeof self !== 'undefined' ? self : this);
