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
  const { clamp, lerp, fmt, easeInOut } = root.LK.core;
  const D = G.DIM;

  const TOP_BAND = 58; // px oben frei für das Meldungsband (zwei Zeilen)
  const GRAVITY = 2600; // Welteinheiten/s² für fallende Tropfen (wie TitraLab 3)
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
  /** Teilchenfarben im Erklärmodus (Befund 7): Propanon grün, Ethanol rot, Wasser blau. */
  const PARTICLE = { P: [28, 138, 74], E: [214, 48, 58], W: [31, 111, 209] };

  // deterministisches Rauschen für Blasen und Flammen
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  /**
   * Stoff des i-ten Dampfteilchens: Jedes Teilchen hat eine feste Zufallszahl; die Stoffmengenanteile
   * y = [P, E, W] aus dem Modell teilen die Zahlen auf. So entsprechen die Anteile der Farben der
   * Dampfzusammensetzung, und ein Teilchen wechselt seine Farbe nur, wenn sich die Zusammensetzung ändert.
   */
  function particleKey(i, y) {
    const sum = y[0] + y[1] + y[2];
    const u = hash(i * 13.37 + 0.71) * (sum > 0 ? sum : 1);
    let acc = 0;
    for (let k = 0; k < 3; k++) { acc += y[k]; if (y[k] > 0 && u < acc) return M.KEYS[k]; }
    return sum > 0 ? M.KEYS[y.indexOf(Math.max(...y))] : 'W';
  }
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
    { id: 'mantle', anchor: (g) => P(g.mantle.outer - 6, g.mantle.base - 34), label: (g) => P(g.mantle.outer + 62, g.mantle.base - 40) },
    { id: 'stones', anchor: (g, st) => (st.stones ? P(10, g.flask.c.y + g.flask.R - 7) : P(g.stonesDish.x + 6, -12)), label: (g, st) => (st.stones ? P(g.mantle.outer + 56, g.mantle.base + 10) : P(g.stonesDish.x + 8, -116)) },
    { id: 'head', anchor: (g) => P(-g.head.hw, g.arm.o.y + 18), label: (g) => P(g.stand1.rodX - 50, g.arm.o.y + 6) },
    { id: 'thermo', anchor: (g, st) => P(g.thermo.hw, g.thermo.bulb[st.thermo] - 210), label: (g, st) => P(g.thermo.hw + 76, g.thermo.bulb[st.thermo] - 236) },
    { id: 'condenser', anchor: (g) => g.cond.at(D.jacket0 + 150, D.jacketHW), label: (g) => g.cond.at(D.jacket0 + 150, D.jacketHW + 52) },
    { id: 'inlet', anchor: (g) => g.nozzles.low.tip, label: (g) => P(g.nozzles.low.tip.x - 132, g.nozzles.low.tip.y + 4) },
    { id: 'outlet', anchor: (g) => g.nozzles.high.tip, label: (g) => P(g.nozzles.high.tip.x + 96, g.nozzles.high.tip.y - 26) },
    { id: 'adapter', anchor: (g) => P(g.adapter.a2.x + D.adapterHW, g.adapter.a2.y + 10), label: (g) => P(g.adapter.a2.x + 78, g.adapter.a2.y - 30) },
    { id: 'receiver', anchor: (g) => P(g.receiver.x + g.receiver.baseHW - 10, g.receiver.base - 26), label: (g) => P(g.receiver.x + 80, g.receiver.rim - 22) },
    { id: 'distillate', anchor: (g) => P(g.receiver.x - 10, g.receiver.base - 6), label: (g) => P(g.receiver.x - 92, g.receiver.base - 26) },
    { id: 'mixture', extra: true, anchor: (g) => P(g.bottle.x, -24), label: (g) => P(g.bottle.x, 18) },
    { id: 'stand', anchor: (g) => P(g.stand1.rodX, g.stand1.clamps[0].y - 26), label: (g) => P(g.stand1.rodX - 72, g.stand1.clamps[0].y - 36) }
  ];

  /** Zusätzliche Geräte im Modus „Erkunden“ (nicht Teil des Geräte-Trainers). */
  const EXPLORE_EXTRA = ['tap', 'sink', 'pipette', 'dish', 'lighter'];

  // ------------------------------------------------------------------ Renderer
  function createRenderer(canvas, getState, getUi) {
    const ctx = canvas.getContext('2d');
    const bg = document.createElement('canvas');
    let geo = null, geoKey = '';
    const view = { scale: 1, ox: 0, oy: 0, w: 1, h: 1, dpr: 1 };
    let reduce = false;
    try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ohne */ }
    const vis = { lastT: null, time: 0, water: 0, film: 0, hose: 0, bubbles: [], bubbleSeq: 0, drops: [], lastDrop: 0, stream: 0, swap: null, nFractions: null, lastRealDrops: [], rings: [], splashes: [], wave: 0, recvPose: null, recvDrawn: null };

    function ensureGeo(st) {
      const key = M.MIXES[st.mix].burnTest ? 'S' : 'N'; // Prüfplatz für die Brennprobe
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
      Object.assign(view, G.fit(geo.bounds, w, h, 8, TOP_BAND), { dpr });
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
      // Stativ mit Doppelmuffe; die Stange zum Kolbenhals liegt hinter dem Glas (keine sichtbare Klemme)
      const s1 = geo.stand1;
      const pg = ctx.createLinearGradient(0, -s1.base.h, 0, 0);
      pg.addColorStop(0, '#4a5462'); pg.addColorStop(0.3, '#2c333d'); pg.addColorStop(1, '#1b2028');
      ctx.fillStyle = pg; roundRect(ctx, s1.base.x0, -s1.base.h, s1.base.x1 - s1.base.x0, s1.base.h, 3); ctx.fill();
      metalRod(s1.rodX, s1.top, s1.rodX, -s1.base.h, 11);
      ctx.fillStyle = '#c9d1db'; roundRect(ctx, s1.rodX - 6.5, s1.top - 4, 13, 7, 3); ctx.fill();
      const y = s1.clamps[0].y;
      metalRod(s1.rodX, y, 0, y, 7);
      ctx.fillStyle = '#2f3640'; roundRect(ctx, s1.rodX - 12, y - 13, 24, 26, 5); ctx.fill();
      ctx.fillStyle = '#7c8794'; ctx.beginPath(); ctx.arc(s1.rodX - 17, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    function drawJack(x, w, top, h) {
      const y1 = top + h;
      ctx.fillStyle = '#4b5562'; roundRect(ctx, x - w / 2, top, w, 7, 2); ctx.fill();
      ctx.fillStyle = '#3a434f'; roundRect(ctx, x - w / 2, y1 - 7, w, 7, 2); ctx.fill();
      ctx.strokeStyle = '#8b96a3'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const k = w * 0.36;
      ctx.beginPath(); ctx.moveTo(x - k, top + 8); ctx.lineTo(x + k, y1 - 8); ctx.moveTo(x + k, top + 8); ctx.lineTo(x - k, y1 - 8); ctx.stroke();
      ctx.fillStyle = '#5a6573'; ctx.beginPath(); ctx.arc(x, top + h / 2, 4, 0, Math.PI * 2); ctx.fill();
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
      // Heizgewebe innen (Rückseite der Schale), neutral; die Temperatur zeigt die Heizschicht im Schnitt
      ctx.save();
      ctx.beginPath(); ctx.arc(c.x, c.y, m.inner, 0, Math.PI); ctx.closePath();
      const fg = ctx.createLinearGradient(0, c.y, 0, c.y + m.inner);
      fg.addColorStop(0, '#e7e9ec'); fg.addColorStop(1, '#cfd4da');
      ctx.fillStyle = fg; ctx.fill();
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
      // ohne Flüssigkeit keine Blasen – auch nicht im Stillstand (vorher blieben sie nach einem Neustart stehen)
      if (V > 0.05) updateBubbles(st, dtVis, lev, surf, bottom);
      else vis.bubbles = [];
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
        // Blasen nur bei tatsächlichem Sieden bzw. Siedekeimen (Befund 13: keine Restwerte nach dem Abkühlen)
        const rate = (fx.boil > 1e-3 ? 6 + 46 * Math.min(1.4, fx.boil) : 0) + (fx.nucleate > 1e-3 ? 10 * fx.nucleate : 0);
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
      joint(0, g.head.joint.y + 2, Math.PI / 2, g.neck.hw, 14);
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
      // Erklärmodus: Dampfteilchen im Innenrohr, gefärbt nach der Zusammensetzung des Dampfs
      if (getUi().explain && fx.pass > 1e-5) {
        const zone = j0 + clamp(fx.condZone, 0.05, 1) * (j1 - j0);
        const n = Math.round(clamp(fx.pass * 90, 4, 22));
        const y = shares(st, 'py');
        for (let i = 0; i < n; i++) {
          const end = fx.escape > 1e-5 ? L + 10 : zone;
          const s = ((hash(i * 7.7) * end) + vis.time * 60 * (0.7 + hash(i) * 0.6)) % end;
          const fade = fx.escape > 1e-5 ? 1 : clamp((zone - s) / 40, 0, 1);
          ctx.fillStyle = rgba(PARTICLE[particleKey(i + 100, y)], 0.8 * fade);
          ctx.beginPath(); ctx.arc(s, (hash(i + 5) - 0.5) * (thw * 1.2), 1.7, 0, Math.PI * 2); ctx.fill();
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
        const lev = G.receiverLevel({ receiver: r }, V);
        const wob = o.wave || 0;
        const lg = ctx.createLinearGradient(0, lev.y, 0, r.base);
        lg.addColorStop(0, rgba([110, 165, 228], 0.70)); lg.addColorStop(1, rgba([90, 145, 215], 0.88));
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(r.x - r.baseHW, lev.y);
        for (let k = 0; k <= 16; k++) { const u = k / 16; ctx.lineTo(r.x - lev.half + 2 * lev.half * u, lev.y + Math.sin(u * Math.PI * 3 + vis.time * 14) * wob); }
        ctx.lineTo(r.x + r.baseHW, lev.y); ctx.lineTo(r.x + r.baseHW, r.base); ctx.lineTo(r.x - r.baseHW, r.base); ctx.closePath(); ctx.fill();
        const ry = Math.max(1, lev.half * 0.1);
        ctx.fillStyle = 'rgba(235,245,255,0.5)'; ctx.beginPath(); ctx.ellipse(r.x, lev.y, lev.half, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(40,90,160,0.75)'; ctx.lineWidth = px(1.2);
        ctx.beginPath(); ctx.ellipse(r.x, lev.y, lev.half, ry, 0, 0, Math.PI); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = px(1.1);
        ctx.beginPath(); ctx.moveTo(r.x - lev.half, lev.y - 2); ctx.quadraticCurveTo(r.x - lev.half + 3, lev.y, r.x - lev.half + 7, lev.y); ctx.stroke();
        // Ringwellen nach dem Auftreffen eines Tropfens (TitraLab 3)
        for (const ring of o.rings || []) {
          const t = ring.age / ring.life;
          const rx = 2 + t * lev.half * 0.9;
          ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - t)).toFixed(3)})`; ctx.lineWidth = px(1);
          ctx.beginPath(); ctx.ellipse(r.x, lev.y, rx, rx * 0.1 + 0.6, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }
      erlenPath(r, 0); ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.4); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,245,255,0.9)'; ctx.lineWidth = px(1.8);
      ctx.beginPath(); ctx.ellipse(r.x, r.rim, r.neckHW + 2.5, 1.8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.moveTo(r.x - r.neckHW - 3, r.base - (r.h - 34) + 16); ctx.lineTo(r.x - r.neckHW - 1, r.base - (r.h - 34) + 16); ctx.lineTo(r.x - r.baseHW + 12, r.base - 14); ctx.lineTo(r.x - r.baseHW + 8, r.base - 14); ctx.closePath(); ctx.fill();
      if (o.scale) {
        // Volumenskala wie aufgedruckt: Striche auf einer senkrechten Linie, Zahlen links davon
        ctx.strokeStyle = 'rgba(40,52,66,0.8)'; ctx.lineWidth = px(1);
        for (const ml of [20, 40, 60, 80]) {
          const lev = G.receiverLevel({ receiver: r }, ml);
          const len = ml % 40 === 0 ? 8 : 5;
          ctx.beginPath(); ctx.moveTo(r.x + 1, lev.y); ctx.lineTo(r.x + 1 + len, lev.y); ctx.stroke();
          // nur Zahlen, damit die Skala auf den Kolben passt (Befund 4); die Einheit steht in der Anzeige „Vorlage …: … mL“
          if (ml % 40 === 0) text(String(ml), r.x - 2, lev.y, { size: 9, align: 'right', color: '#2a3542' });
        }
      }
    }
    /** Lage der aktuellen Vorlage (unter dem Vorstoß oder abgestellt), mit Bewegung beim Wechsel. */
    function receiverPose(st, dtVis) {
      const g = geo;
      const target = st.receiver.present ? { x: g.receiver.x, base: g.receiver.base } : { x: g.receiverAway.x, base: g.receiverAway.base };
      let p = vis.recvPose;
      if (!p || p.geoKey !== geoKey) p = vis.recvPose = { x: target.x, base: target.base, fx: target.x, fb: target.base, tx: target.x, tb: target.base, t: 1, geoKey };
      if (Math.abs(p.tx - target.x) > 0.5 || Math.abs(p.tb - target.base) > 0.5) {
        p.fx = p.x; p.fb = p.base; p.tx = target.x; p.tb = target.base; p.t = 0;
      }
      if (p.t < 1) p.t = Math.min(1, p.t + (dtVis > 0 ? dtVis : 0.016) / 0.9);
      const u = easeInOut(p.t);
      p.x = lerp(p.fx, p.tx, u);
      p.base = lerp(p.fb, p.tb, u);
      const lift = p.t < 1 ? Math.sin(Math.PI * u) * 40 : 0;
      const r = Object.assign({}, g.receiver, { x: p.x, base: p.base - lift, rim: p.base - lift - g.receiver.h });
      return { r, moving: p.t < 1, home: st.receiver.present && p.t >= 1 };
    }
    function drawReceiver(st, dtVis) {
      const g = geo, rj = g.receiver.jack;
      const rc = st.receiver;
      drawJack(rj.x, rj.w, rj.top, rj.h);
      // auf den Tisch gelaufenes Destillat (keine oder volle Vorlage): Pfütze neben der Hebebühne
      const spilt = M.vol(st.lost.table);
      if (spilt > 0.05) {
        const rx = Math.min(70, 9 + 7 * Math.sqrt(spilt)), cx = rj.x + rj.w / 2 + rx * 0.55, cy = rj.top + rj.h - 1;
        ctx.fillStyle = 'rgba(150,196,232,0.55)'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(90,140,190,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      }
      // Wechselanimation (Expertenmodus): alte Vorlage gleitet auf den Tisch, neue kommt
      const nF = st.fractions.length;
      if (vis.nFractions == null) vis.nFractions = nF;
      if (nF !== vis.nFractions) { vis.swap = nF > vis.nFractions ? { t: 0 } : null; vis.nFractions = nF; }
      if (vis.swap && dtVis > 0) { vis.swap.t += dtVis; if (vis.swap.t > 0.9) vis.swap = null; }
      const sw = vis.swap ? clamp(vis.swap.t / 0.9, 0, 1) : 1;
      const R0 = g.receiver;
      const shelf = st.fractions.slice(-3);
      shelf.forEach((f, i) => {
        const k = shelf.length - 1 - i;
        const small = scaledErlen(R0, 0.62, R0.x - 92 - k * 50, 0);
        let rr = small;
        if (i === shelf.length - 1 && vis.swap) rr = scaledErlen(R0, lerp(1, 0.62, sw), lerp(R0.x, small.x, sw), lerp(R0.base, 0, sw));
        drawErlenmeyer(rr, M.vol(f.c), {});
        text(`V${f.n}`, rr.x, 11, { size: 10, color: '#22303d', weight: 700 });
        text(`${fmt(M.vol(f.c), 1)} mL`, rr.x, 24, { size: 9, color: '#22303d' });
      });
      const pose = receiverPose(st, dtVis);
      let r = pose.r;
      if (vis.swap) r = Object.assign({}, r, { x: lerp(R0.x + 90, R0.x, sw) });
      vis.recvDrawn = r;
      drawErlenmeyer(r, M.vol(rc.c), { scale: true, rings: pose.home ? vis.rings : [], wave: pose.home ? vis.wave : 0 });
      // Füllmenge steht in der Bedienleiste (Befund 3), nicht mehr auf dem Laborboy
      if (!rc.present && !pose.moving) text('Keine Vorlage unter dem Vorstoß', rj.x, rj.top - 30, { size: 11, color: '#7a4004', bg: 'rgba(253,241,220,0.95)', border: '#ecc98d' });
      return { r, home: pose.home };
    }
    function scaledErlen(r, f, x, base) {
      return { x, base, h: r.h * f, rim: base - r.h * f, baseHW: r.baseHW * f, neckHW: r.neckHW * f };
    }
    function drawDrops(st, dtVis, recv) {
      const a = geo.adapter;
      const tipY = a.tip.y + 6;
      const list = st.drops.list;
      const newest = list.length ? list[list.length - 1].n : 0;
      if (vis.lastDrop > newest || vis.dropInit !== st.run) { vis.lastDrop = newest; vis.dropInit = st.run; }
      const fresh = list.filter((d) => d.n > vis.lastDrop);
      vis.lastDrop = newest;
      const now = vis.time;
      vis.lastRealDrops = vis.lastRealDrops.filter((t) => now - t < 1);
      for (let i = 0; i < fresh.length; i++) vis.lastRealDrops.push(now);
      const realRate = vis.lastRealDrops.length;
      // Auftreffpunkt an der Vorlage in ihrer gezeichneten Lage (auch während sie bewegt wird):
      // durch die Öffnung bis zum Spiegel bzw. Boden, sonst auf das Glas oder den Laborboy
      const hit = G.erlenStop(recv.r, M.vol(st.receiver.c), a.tip.x, tipY);
      const target = hit ? hit.y : geo.receiver.jack.top - 1;
      const surf = hit && hit.into === 'liquid' && recv.home;
      const stream = realRate > 7 && !reduce;
      if (stream) {
        // im Zeitraffer: zusammenhängender Strahl, nach unten dünner (TitraLab 3)
        const w = clamp(0.8 + realRate / 25, 0.8, 2.2);
        const sg = ctx.createLinearGradient(a.tip.x - w, 0, a.tip.x + w, 0);
        sg.addColorStop(0, 'rgba(120,170,230,0.45)'); sg.addColorStop(0.5, 'rgba(225,240,255,0.75)'); sg.addColorStop(1, 'rgba(120,170,230,0.45)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.moveTo(a.tip.x - 1.6, tipY); ctx.lineTo(a.tip.x + 1.6, tipY); ctx.lineTo(a.tip.x + w * 0.6, target); ctx.lineTo(a.tip.x - w * 0.6, target); ctx.closePath(); ctx.fill();
      }
      for (const d of fresh.slice(-6)) vis.drops.push({ t: 0, n: d.n, landed: false });
      if (dtVis > 0) {
        vis.drops.forEach((d) => { d.t += dtVis; });
        vis.rings.forEach((r) => { r.age += dtVis; });
        vis.splashes.forEach((p) => { p.age += dtVis; });
        vis.wave *= Math.exp(-dtVis * 3);
      }
      const x = a.tip.x;
      vis.drops = vis.drops.filter((d) => {
        const y = tipY + 2 + 0.5 * GRAVITY * d.t * d.t;
        if (y >= target) {
          if (surf && !reduce) {
            vis.rings.push({ age: 0, life: 0.9 });
            vis.wave = Math.min(1.4, vis.wave + 0.6);
            // Spritzer fallen auf den Spiegel zurück und bleiben zwischen den Wänden (nicht durch den Boden)
            for (let k = 0; k < 2; k++) vis.splashes.push({ x0: x, y0: target, half: Math.max(0, hit.half - 1.2), vx: (hash(d.n * 3 + k) - 0.5) * 90, vy: -110 - hash(d.n + k) * 80, age: 0 });
          }
          return false;
        }
        if (!stream) drawDrop(x, y, 2.3, 1 + Math.min(0.45, (GRAVITY * d.t) / 3000));
        return true;
      });
      vis.rings = vis.rings.filter((r) => r.age < r.life).slice(-6);
      ctx.fillStyle = 'rgba(210,232,255,0.85)';
      vis.splashes = vis.splashes.filter((p) => {
        const q = G.splashAt(p, p.age, GRAVITY * 0.6);
        if (q) { ctx.beginPath(); ctx.arc(q.x, q.y, 1.1, 0, Math.PI * 2); ctx.fill(); }
        return !!q;
      });
      // hängender Tropfen an der Spitze wächst mit dem Modell und reißt ab
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
    /** Zulaufschlauch (liegt hinter der Vorlage auf dem Tisch) – vor dem Laborboy gezeichnet. */
    function drawInletHose(st, ui, dtVis) {
      const g = geo, h = st.hoses;
      const flowing = st.fx.flow > 0;
      if (flowing && dtVis > 0) vis.hose += dtVis * (20 + 8 * st.fx.flow);
      drawHose(h.inlet ? g.hoseRoutes.inlet(h.inlet) : g.hoseRoutes.looseInlet(), flowing, ui.selected === 'hose:inlet', flowing ? 1 : 0);
      if (!h.inlet) { const pts = g.hoseRoutes.looseInlet(), e = pts[pts.length - 1]; ctx.fillStyle = '#46566a'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 3, 5, 0.2, 0, Math.PI * 2); ctx.fill(); }
    }
    function drawOutletHose(st, ui) {
      const g = geo, h = st.hoses;
      const flowing = st.fx.flow > 0;
      drawHose(h.outlet ? g.hoseRoutes.outlet(h.outlet) : g.hoseRoutes.looseOutlet(), flowing || (h.outlet && st.jacket.fill > 0.5), ui.selected === 'hose:outlet', flowing ? 1 : 0);
      if (!h.outlet) { const pts = g.hoseRoutes.looseOutlet(), e = pts[pts.length - 1]; ctx.fillStyle = '#46566a'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
      if (flowing && h.outlet) {
        const s = g.sink.drop;
        ctx.strokeStyle = rgba(C.water, 0.6); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, 10); ctx.stroke();
      }
    }
    /** Laborarmatur am Ausguss: Standrohr, Ventilhebel, Schwanenhals mit Schlaucholive. */
    function drawTap(st) {
      const t = geo.tap;
      metalRod(t.x, t.top + 8, t.x, 0, 12);
      ctx.fillStyle = '#3a434f'; roundRect(ctx, t.x - 14, -6, 28, 6, 2); ctx.fill();
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = '#6d7784'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(t.x, t.top + 10); ctx.quadraticCurveTo(t.x, t.top - 10, t.x - 20, t.top - 10); ctx.quadraticCurveTo(t.olive.x, t.top - 10, t.olive.x, t.olive.y - 8); ctx.stroke();
      ctx.strokeStyle = '#c9d1db'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(t.x - 2, t.top + 8); ctx.quadraticCurveTo(t.x - 2, t.top - 7, t.x - 20, t.top - 7); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#9aa4b0'; roundRect(ctx, t.olive.x - 3.5, t.olive.y - 10, 7, 12, 2); ctx.fill();
      // Ventil mit Hebel: quer = zu, längs = offen (Zustand steht zusätzlich am Schalter)
      const open = st.water.on;
      const ang = open ? -Math.PI / 2 + (st.water.level === 'low' ? 0.5 : st.water.level === 'mid' ? 0.25 : 0) : 0;
      ctx.fillStyle = '#7d8896'; roundRect(ctx, t.x - 9, t.handle.y - 10, 18, 20, 4); ctx.fill();
      ctx.save(); ctx.translate(t.handle.x, t.handle.y); ctx.rotate(ang);
      ctx.fillStyle = open ? '#1f6fd1' : '#c62f3a'; roundRect(ctx, -3, -4, 30, 8, 3); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2f3640'; ctx.beginPath(); ctx.arc(t.handle.x, t.handle.y, 5.5, 0, Math.PI * 2); ctx.fill();
    }

    // ------------------------------------------------------------------ Tischgeräte
    function drawBench(st, ui) {
      const g = geo;
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
      const s = g.stonesDish;
      ctx.fillStyle = '#f3f1ec'; ctx.strokeStyle = '#9a9286'; ctx.lineWidth = px(1);
      ctx.beginPath(); ctx.ellipse(s.x, -s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!st.stones) for (let i = 0; i < 6; i++) { ctx.fillStyle = '#ddd7cc'; ctx.beginPath(); ctx.arc(s.x - 12 + i * 5, -s.h / 2 - 1 + (i % 2) * 2, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }

    function drawFilling(st) {
      if (!(st.op && st.op.type === 'fill')) return;
      const g = geo, u = clamp(st.op.t / st.op.dur, 0, 1);
      // Trichter im Aufsatz
      const f = g.funnel, b = g.pour;
      ctx.fillStyle = 'rgba(214,230,246,0.6)'; ctx.strokeStyle = C.glassEdge; ctx.lineWidth = px(1.2);
      ctx.beginPath(); ctx.moveTo(f.x - f.hw, f.top); ctx.lineTo(f.x + f.hw, f.top); ctx.lineTo(f.x + f.stemHW, f.throat); ctx.lineTo(f.x + f.stemHW, f.stemEnd); ctx.lineTo(f.x - f.stemHW, f.stemEnd); ctx.lineTo(f.x - f.stemHW, f.throat); ctx.closePath(); ctx.fill(); ctx.stroke();
      // Becherglas mit dem Gemisch: Inhalt aus dem Modell (ausgegossene Menge), Neigung so,
      // dass der waagrechte Spiegel gerade an der Ausgusskante steht – erst dann fließt es aus.
      const left = clamp(1 - st.op.done / M.FILL_VOLUME, 0, 1);
      const flowing = left > 1e-4 && left < 1 - 1e-4;
      let a;
      if (left >= 1 - 1e-4) a = G.pourTilt(b, 1) * easeInOut(clamp((u - 0.05) / 0.2, 0, 1));
      else if (flowing) a = G.pourTilt(b, left);
      else a = (Math.PI / 2) * (u < 0.88 ? 1 : 1 - easeInOut((u - 0.88) / 0.12));
      ctx.save(); ctx.translate(b.pivot.x, b.pivot.y); ctx.rotate(-a);
      ctx.fillStyle = 'rgba(214,230,246,0.6)'; ctx.fillRect(0, b.top, b.w, b.h); ctx.strokeRect(0, b.top, b.w, b.h);
      const liq = G.pourLiquid(b, a, left);
      if (liq.poly.length > 2) { ctx.fillStyle = rgba(C.liquid, 0.65); ctx.beginPath(); liq.poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      if (flowing) {
        // Strahl ab der Ausgusskante als Wurfparabel in den Trichter, dann durch den Hals bis zum Spiegel im Kolben
        const s = G.pourStream(g, a, -40, GRAVITY);
        ctx.strokeStyle = rgba(C.liquid, 0.85); ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
        ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(f.x, f.throat); ctx.lineTo(f.x, G.flaskLevel(g, M.vol(st.flask.c)).y); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }

    // ------------------------------------------------------------------ Prüfplatz
    const mixP = (a, b, u) => P(lerp(a.x, b.x, u), lerp(a.y, b.y, u));
    const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
    /** Lage der Pipette (Spitze), Neigung und Füllung – aus Handgriff und Modellzustand. */
    function pipettePose(st, ui) {
      const s = geo.station;
      const rest = P(s.pipette.x, s.pipette.y);
      const rv = vis.recvDrawn || { x: geo.receiverAway.x, base: geo.receiverAway.base, rim: geo.receiverAway.base - geo.receiver.h };
      const above = P(rv.x, rv.rim - 44);
      const lev = G.receiverLevel({ receiver: Object.assign({}, geo.receiver, rv) }, Math.max(0.3, M.vol(st.receiver.c)));
      const inside = P(rv.x, lev.y + 2);
      const overDish = P(s.dish.x, s.dish.y - 46);
      const op = st.op;
      if (op && op.type === 'sample') {
        const u = op.t / op.dur;
        let p = mixP(rest, above, easeInOut(seg(u, 0, 0.3)));
        if (u > 0.3) p = mixP(above, inside, easeInOut(seg(u, 0.3, 0.5)));
        if (u > 0.6) p = mixP(inside, above, easeInOut(seg(u, 0.6, 0.85)));
        return { tip: P(p.x, p.y - (u < 0.3 ? Math.sin(Math.PI * seg(u, 0, 0.3)) * 50 : 0)), ang: 0, fill: seg(u, 0.5, 0.6), squeeze: u > 0.45 && u < 0.6 ? 1 - Math.abs(u - 0.52) * 12 : 0 };
      }
      if (op && op.type === 'toDish') {
        const u = op.t / op.dur;
        let p = mixP(above, overDish, easeInOut(seg(u, 0, 0.45)));
        if (u > 0.7) p = mixP(overDish, rest, easeInOut(seg(u, 0.7, 1)));
        const lift = u < 0.45 ? Math.sin(Math.PI * seg(u, 0, 0.45)) * 40 : u > 0.7 ? Math.sin(Math.PI * seg(u, 0.7, 1)) * 40 : 0;
        return { tip: P(p.x, p.y - lift), ang: 0, fill: 1 - seg(u, 0.45, 0.7), squeeze: u > 0.45 && u < 0.7 ? 0.8 : 0 };
      }
      if (st.pipette) return { tip: above, ang: 0, fill: 1, squeeze: 0 };
      if (ui.selected === 'pipette') return { tip: P(rest.x + 6, rest.y - 22), ang: 0.35, fill: 0, squeeze: 0 };
      return { tip: rest, ang: 0, fill: 0, squeeze: 0 };
    }
    /** Lage des Stabfeuerzeugs (Fußpunkt), Neigung zur Schale, Funke. */
    function lighterPose(st, ui) {
      const s = geo.station;
      const rest = { base: P(s.lighter.x, s.lighter.y), ang: 0 };
      const held = { base: P(s.lighter.x + 10, s.lighter.y - 16), ang: 0.5 };
      const a = 1.35; // fast waagrecht gehalten, Spitze über der Schale
      const tipT = P(s.dish.x - 10, s.dish.y - 28);
      const at = { base: P(tipT.x - 100 * Math.sin(a), tipT.y + 100 * Math.cos(a)), ang: a };
      const op = st.op;
      if (op && op.type === 'light') {
        const u = op.t / op.dur;
        const from = held;
        if (u < 0.5) { const k = easeInOut(seg(u, 0, 0.5)); return { base: mixP(from.base, at.base, k), ang: lerp(from.ang, at.ang, k), spark: 0 }; }
        if (u < 0.78) return { base: at.base, ang: at.ang, spark: u > 0.55 ? 1 : 0 };
        const k = easeInOut(seg(u, 0.78, 1));
        return { base: mixP(at.base, rest.base, k), ang: lerp(at.ang, 0, k), spark: 0 };
      }
      if (ui.selected === 'lighter') return Object.assign({ spark: 0 }, held);
      return Object.assign({ spark: 0 }, rest);
    }
    function drawStation(st, ui) {
      const s = geo.station;
      if (!s) return;
      ctx.fillStyle = '#e9e5dc'; roundRect(ctx, s.mat.x0, -s.mat.h, s.mat.x1 - s.mat.x0, s.mat.h, 3); ctx.fill();
      ctx.strokeStyle = '#b9b2a4'; ctx.lineWidth = px(1); ctx.stroke();
      text('Prüfplatz (getrennt)', s.x0 + 4, 17, { size: 11, align: 'left', color: '#22303d', weight: 700 });
      // Stellplatz für die abgenommene Vorlage
      ctx.strokeStyle = 'rgba(80,90,100,0.35)'; ctx.setLineDash([px(4), px(3)]); ctx.lineWidth = px(1);
      ctx.beginPath(); ctx.ellipse(s.recv.x, s.recv.y - 1, geo.receiver.baseHW + 4, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      // Porzellanschale
      const d = s.dish;
      ctx.fillStyle = '#fbfbf8'; ctx.strokeStyle = '#8e959d'; ctx.lineWidth = px(1.2);
      ctx.beginPath(); ctx.moveTo(d.x - 34, d.y - 22); ctx.quadraticCurveTo(d.x, d.y + 12, d.x + 34, d.y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(d.x, d.y - 22, 34, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (st.dish && M.vol(st.dish.c) > 0.005) {
        ctx.fillStyle = rgba(C.liquid, 0.85); ctx.beginPath(); ctx.ellipse(d.x, d.y - 12, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
      // Flamme aus dem Modell (Brenndauer und Stärke)
      const fl = st.fx.flame;
      const yellow = st.dish && st.dish.fuel === 'P'; // Propanon: gelblich, leuchtend; Ethanol: bläulich, kaum leuchtend
      if (fl > 0) {
        const hgt = 30 + 46 * fl;
        for (let i = 0; i < 3; i++) {
          const w = (16 - i * 4) * (0.7 + 0.3 * fl);
          const flick = (noise(vis.time * 9, i) - 0.5) * 6;
          const fg = ctx.createLinearGradient(0, d.y - 14, 0, d.y - 14 - hgt);
          if (yellow) { fg.addColorStop(0, `rgba(60,110,255,${0.6 - i * 0.12})`); fg.addColorStop(0.18, `rgba(255,190,60,${0.75 - i * 0.12})`); fg.addColorStop(0.65, `rgba(255,215,90,${0.6 - i * 0.1})`); fg.addColorStop(1, 'rgba(255,240,180,0)'); }
          else { fg.addColorStop(0, `rgba(40,90,255,${0.65 - i * 0.12})`); fg.addColorStop(0.55, `rgba(90,140,255,${0.45 - i * 0.1})`); fg.addColorStop(0.92, 'rgba(255,220,140,0.12)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); }
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.moveTo(d.x - w, d.y - 12);
          ctx.quadraticCurveTo(d.x - w * 0.9, d.y - 14 - hgt * 0.5, d.x + flick, d.y - 14 - hgt * (1 - i * 0.12));
          ctx.quadraticCurveTo(d.x + w * 0.9, d.y - 14 - hgt * 0.5, d.x + w, d.y - 12); ctx.closePath(); ctx.fill();
        }
        text(st.dish && st.dish.result === 'flicker' ? 'kurzes Aufflackern' : yellow ? 'gelbliche Flamme' : 'bläuliche Flamme', d.x, d.y - 26 - hgt, { size: 11, color: yellow ? '#7a4a00' : '#1d3f9a', bg: 'rgba(255,255,255,0.85)' });
      } else if (st.dish && st.dish.result && !(st.op && st.op.type === 'light')) {
        const txt = { burns: 'Flamme erloschen', flicker: 'kurz aufgeflackert', none: 'keine Flamme' }[st.dish.result];
        text(txt, d.x, d.y - 46, { size: 11, color: '#3d4b5a', bg: 'rgba(255,255,255,0.85)' });
      }
    }
    /** Pipette und Feuerzeug zuletzt zeichnen (sie bewegen sich über die Gefäße). */
    function drawStationTools(st, ui) {
      if (!geo.station) return;
      const pp = pipettePose(st, ui);
      ctx.save(); ctx.translate(pp.tip.x, pp.tip.y); ctx.rotate(pp.ang);
      const sel = ui.selected === 'pipette';
      ctx.fillStyle = 'rgba(236,243,250,0.95)'; ctx.strokeStyle = sel ? C.accent : C.glassEdge; ctx.lineWidth = px(sel ? 2.4 : 1.1);
      ctx.beginPath(); ctx.moveTo(-1.6, 0); ctx.lineTo(-4, -40); ctx.lineTo(-4, -84); ctx.lineTo(4, -84); ctx.lineTo(4, -40); ctx.lineTo(1.6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (pp.fill > 0) { ctx.fillStyle = rgba([110, 165, 228], 0.9); const hgt = 34 * pp.fill; ctx.beginPath(); ctx.moveTo(-1.4, -1); ctx.lineTo(-3.4, -1 - hgt); ctx.lineTo(3.4, -1 - hgt); ctx.lineTo(1.4, -1); ctx.closePath(); ctx.fill(); }
      if (pp.fill > 0 && pp.fill < 1 && st.op && st.op.type === 'toDish') drawDrop(0, 6 + (vis.time * 120) % 30, 1.6, 1.2);
      const sq = 1 - 0.25 * clamp(pp.squeeze, 0, 1);
      ctx.fillStyle = '#d23b3b'; roundRect(ctx, -6 * (2 - sq), -84 - 26 * sq, 12 * (2 - sq), 26 * sq, 5); ctx.fill();
      ctx.restore();
      const lp = lighterPose(st, ui);
      const lsel = ui.selected === 'lighter' || (st.op && st.op.type === 'light');
      ctx.save(); ctx.translate(lp.base.x, lp.base.y); ctx.rotate(lp.ang);
      ctx.fillStyle = lsel ? '#1f6fd1' : '#3a434f'; roundRect(ctx, -6, -54, 12, 48, 4); ctx.fill();
      ctx.fillStyle = '#e6e9ee'; roundRect(ctx, -2, -46, 4, 10, 1.5); ctx.fill();
      metalRod(0, -100, 0, -54, 4);
      if (lp.spark) {
        const f = 0.6 + 0.4 * noise(vis.time * 30, 3);
        ctx.fillStyle = `rgba(255,190,80,${f})`; ctx.beginPath(); ctx.ellipse(0, -106, 3.2 * f, 7 * f, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,220,0.95)'; ctx.beginPath(); ctx.arc(0, -103, 1.4, 0, Math.PI * 2); ctx.fill();
      } else if (ui.selected === 'lighter') {
        ctx.fillStyle = 'rgba(255,170,60,0.9)'; ctx.beginPath(); ctx.ellipse(0, -106, 2.6, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------ Erklärmodus im Kolben/Aufsatz
    function drawExplainVapor(st) {
      const fx = st.fx, g = geo;
      if (!getUi().explain) return;
      if (fx.vapor <= 1e-5) return;
      const surfY = G.flaskLevel(g, M.vol(st.flask.c)).y;
      const n = Math.round(clamp(fx.vapor * 120, 4, 26));
      const yUp = shares(st, 'vy'), yOut = shares(st, 'py');
      for (let i = 0; i < n; i++) {
        const u = (hash(i * 5.3) + vis.time * (0.35 + hash(i) * 0.3)) % 1;
        // Weg: Flüssigkeit → Hals → Aufsatz → Abgang
        let x, y, inArm = false;
        const yTop = g.arm.o.y;
        const reachArm = fx.pass > 1e-5;
        if (u < 0.75 || !reachArm) {
          const v = reachArm ? u / 0.75 : u;
          y = lerp(surfY - 4, yTop + (reachArm ? 0 : 30), v);
          // seitlich nur so weit, wie der Kolben in dieser Höhe innen breit ist (oben an der Kugel schmaler)
          const rin = g.flask.R - D.glass - 2.5, dy = y - g.flask.c.y;
          const half = y > g.neck.y0 ? Math.min(g.flask.R * 0.5, Math.sqrt(Math.max(0, rin * rin - dy * dy))) : g.head.hw * 0.7;
          x = (hash(i + 2) - 0.5) * 2 * half;
          if (!reachArm && v > 0.85) continue;
        } else {
          const v = (u - 0.75) / 0.25;
          const p = P(lerp(0, g.arm.end.x, v), lerp(yTop, g.arm.end.y, v));
          x = p.x; y = p.y + (hash(i + 3) - 0.5) * 6;
          inArm = true;
        }
        ctx.fillStyle = rgba(PARTICLE[particleKey(i, inArm ? yOut : yUp)], 0.8);
        ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ------------------------------------------------------------------ Einblendungen (Detail, Diagramm)
    function overlayBox(title, box, hint) {
      const o = box || geo.overlay;
      ctx.save();
      ctx.fillStyle = box ? '#fff' : 'rgba(255,255,255,0.96)'; ctx.strokeStyle = '#c3cdd8'; ctx.lineWidth = px(1.2);
      roundRect(ctx, o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0, 10); ctx.fill(); ctx.stroke();
      text(title, o.x0 + px(12), o.y0 + px(16), { size: 13, align: 'left', weight: 700 });
      if (hint) text(hint, o.x1 - px(10), o.y0 + px(16), { size: 11, align: 'right', weight: 600, color: C.accent });
      ctx.restore();
      return o;
    }
    /** Breite eines Textes in Weltkoordinaten (gleiche Schrift wie text()). */
    function textW(str, size, weight) {
      ctx.save(); ctx.font = `${weight || 600} ${px(size || 12)}px ${FONT}`;
      const w = ctx.measureText(str).width; ctx.restore();
      return w;
    }
    /** Stoffmengenanteile [P, E, W] des Dampfs aus dem Modell ('vy' aufsteigend, 'py' in den Kühler). */
    function shares(st, which) {
      const y = st.fx[which] || st.fx.vy;
      return y && y.length === 3 ? y : M.vaporFractions(st.flask.c);
    }
    /** Legende der Teilchenfarben für die im Gemisch vorhandenen Stoffe, linksbündig ab x. */
    function particleLegend(st, x, y) {
      let cx = x;
      for (const k of M.KEYS) {
        if (!(M.MIXES[st.mix].comp[k] > 0)) continue;
        ctx.fillStyle = rgba(PARTICLE[k], 0.9); ctx.beginPath(); ctx.arc(cx + px(4), y, px(4), 0, Math.PI * 2); ctx.fill();
        const name = M.SUBSTANCES[k].name;
        text(name, cx + px(11), y, { size: 11, align: 'left', color: '#22303d' });
        cx += px(22) + textW(name, 11);
      }
    }
    /** Bühne unterhalb des Meldungsbands als Weltrechteck (Diagramm groß, Befund 12). */
    function stageBox() {
      const a = G.toWorld(view, P(8, TOP_BAND)), b = G.toWorld(view, P(view.w - 8, view.h - 8));
      return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    }
    function drawDetail(st) {
      const o = overlayBox('Liebigkühler im Schnitt (vergrößert)');
      const fx = st.fx, j = st.jacket;
      const py = shares(st, 'py');
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
          ctx.fillStyle = rgba(PARTICLE[particleKey(i + 200, py)], 0.8 * fade);
          ctx.beginPath(); ctx.arc(x, yi0 + 6 + hash(i + 1) * (wTube - 12), 2.4, 0, Math.PI * 2); ctx.fill();
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
      // Beschriftung der zwei getrennten Strömungsräume; passt die Strömungsrichtung nicht mehr
      // in die Zeile, steht sie im unteren Wasserraum (Befund 5: nichts ragt über die Abbildung hinaus)
      const wTxt = j.fill > 0.01 ? `Kühlwasser im Mantel · ${fmt(j.T, 0)} °C · ${st.water.on ? 'Durchfluss ' + M.FLOW[st.water.level].name : 'steht'}` : 'Kühlmantel leer (Luft)';
      const dirTxt = fx.flow > 0 ? (correct ? '← strömt zum Ablauf' : '→ läuft unten durch') : '';
      const room = x1 - x0 - 12;
      const one = dirTxt && textW(wTxt + '  ' + dirTxt, 11) <= room;
      text(one ? wTxt + '  ' + dirTxt : wTxt, x0 + 6, yo0 + 11, { size: 11, align: 'left', color: '#0d3d75' });
      if (dirTxt && !one) text(dirTxt, x0 + 6, yo1 - 9, { size: 11, align: 'left', color: '#0d3d75' });
      text(fx.pass > 1e-5 ? `Innenrohr: Dampf ${fmt(fx.Tb, 0)} °C → kondensiert` : 'Innenrohr: kein Dampf', x0 + 6, yc, { size: 11, align: 'left', color: '#7a3a0a', bg: 'rgba(255,255,255,0.75)' });
      const cTxt = `Kondensat: ${fmt(fx.cond * 60, 1)} mL/min` + (fx.escape > 1e-5 ? ` · nicht kondensiert: ${fmt(fx.escape * 60, 1)} mL/min` : '');
      text(cTxt, x0 + 6, yo1 + 14, { size: 11, align: 'left', color: fx.escape > 1e-5 ? '#a8640a' : '#22303d' });
      // Legende der Dampfteilchen, rechts unten (sofern Platz neben dem Kondensattext)
      if (fx.pass > 1e-5 && textW(cTxt, 11) + px(170) < x1 - x0) particleLegend(st, x1 - px(170), yo1 + 14);
      ctx.restore();
    }
    function drawChart(st, big) {
      const o = overlayBox('Temperatur-Zeit-Diagramm (Thermometer)', big ? stageBox() : null, big ? 'Antippen: verkleinern' : 'Antippen: groß');
      const x0 = o.x0 + px(46), x1 = o.x1 - px(14), y0 = o.y0 + px(34), y1 = o.y1 - px(30);
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
        if (p.extra && mode === 'numbers') return;
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
          const nm = p.id === 'mixture' ? M.MIXES[st.mix].name : names[p.id] || p.id;
          text(nm, l.x, l.y, { size: 12, weight: 700, color: hl ? '#fff' : C.label, bg: hl ? C.accent : 'rgba(255,255,255,0.94)', border: hl ? C.accent : '#9fb0c2' });
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
        case 'stones': return st.stones ? { x0: -16, y0: c.y + g.flask.R - 14, x1: 18, y1: c.y + g.flask.R } : { x0: g.stonesDish.x - g.stonesDish.w / 2, y0: -28, x1: g.stonesDish.x + g.stonesDish.w / 2, y1: 0 };
        case 'mixture': return { x0: g.bottle.x - g.bottle.w / 2, y0: -g.bottle.h - 6, x1: g.bottle.x + g.bottle.w / 2, y1: 0 };
        case 'tap': return { x0: g.tap.olive.x - 8, y0: g.tap.top - 16, x1: g.tap.x + 30, y1: 0 };
        case 'sink': return { x0: g.sink.x0, y0: -12, x1: g.sink.x1, y1: 14 };
        case 'pipette': return g.station ? { x0: g.station.pipette.x - 10, y0: -116, x1: g.station.pipette.x + 10, y1: 0 } : null;
        case 'lighter': return g.station ? { x0: g.station.lighter.x - 10, y0: -104, x1: g.station.lighter.x + 10, y1: 0 } : null;
        case 'dish': return g.station ? { x0: g.station.dish.x - 36, y0: g.station.dish.y - 30, x1: g.station.dish.x + 36, y1: 0 } : null;
        case 'head': return { x0: -g.head.hw, y0: g.head.y1, x1: g.arm.end.x, y1: g.head.y0 };
        case 'thermo': { const pos = st.thermo; return { x0: -14, y0: g.thermo.top(pos), x1: 14, y1: g.thermo.bulb[pos] + 10 }; }
        case 'condenser': { const a = g.cond.at(g.cond.j0, 0), b = g.cond.at(g.cond.j1, 0); return { x0: a.x, y0: a.y - g.cond.jhw - 6, x1: b.x, y1: b.y + g.cond.jhw + 6 }; }
        case 'inlet': { const t = g.nozzles.low.tip; return { x0: t.x - 14, y0: t.y - 26, x1: t.x + 14, y1: t.y + 8 }; }
        case 'outlet': { const t = g.nozzles.high.tip; return { x0: t.x - 14, y0: t.y - 8, x1: t.x + 14, y1: t.y + 26 }; }
        case 'adapter': { const a = g.adapter; return { x0: a.a0.x, y0: a.a0.y - 10, x1: a.tip.x + a.hw + 4, y1: a.tip.y + 6 }; }
        case 'receiver': { const r = g.receiver; const x = st.receiver.present ? r.x : g.receiverAway.x, base = st.receiver.present ? r.base : g.receiverAway.base; return { x0: x - r.baseHW, y0: base - r.h, x1: x + r.baseHW, y1: base }; }
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
      // Neuer Versuch: Blasen, Tropfen, Spritzer und Wellen des alten Versuchs verwerfen
      if (vis.run !== st.run) {
        Object.assign(vis, { bubbles: [], drops: [], rings: [], splashes: [], wave: 0, swap: null, nFractions: null, lastRealDrops: [] });
        vis.run = st.run;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(view.scale * view.dpr, 0, 0, view.scale * view.dpr, view.ox * view.dpr, view.oy * view.dpr);

      drawStands(st);
      drawJack(geo.jack.x, geo.jack.w, geo.jack.top, geo.jack.h);
      drawTap(st);
      drawInletHose(st, ui, dtVis);
      drawBench(st, ui);
      drawStation(st, ui);
      drawMantleBack(st);
      drawHeadBack();
      drawThermometer(st, ui);
      drawFlask(st, dtVis);
      drawMantleFront(st, ui);
      drawHeadFront();
      drawExplainVapor(st);
      drawCondenser(st, dtVis);
      drawAdapter(st);
      const surf = drawReceiver(st, dtVis);
      drawDrops(st, dtVis, surf);
      drawOutletHose(st, ui);
      drawFilling(st);
      drawDisplay(st);
      drawStationTools(st, ui);
      const big = ui.overlay === 'chart' && ui.chartBig;
      if (ui.overlay === 'detail') drawDetail(st);
      else if (ui.overlay === 'chart' && !big) drawChart(st, false);
      drawSelection(st, ui);
      drawLabels(st, ui);
      if (big) drawChart(st, true); // bildschirmfüllend über allem (Befund 12)
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
        // rechts frei von der Touch-Fläche der Trennlinie (ragt 15 px in die Bühne)
        const x = Math.min((a.x + c.x) / 2 - w / 2, view.w - 16 - w);
        out.push({ id, x: Math.round(x), y: Math.round((a.y + c.y) / 2 - h / 2), w: Math.round(w), h: Math.round(h) });
      };
      const g = geo;
      // Diagramm: Antippen vergrößert auf die ganze Bühne bzw. verkleinert wieder (Befund 12)
      if (ui.overlay === 'chart' && ui.chartBig) { rect('chart', stageBox()); return out; }
      if (ui.overlay === 'chart') rect('chart', g.overlay);
      if (ui.explore) {
        // das große Stativ zuunterst: das Siedestein-Schälchen steht vor dem Stativfuß und bleibt antippbar
        const order = PARTS.filter((p) => p.id === 'stand').concat(PARTS.filter((p) => p.id !== 'stand'));
        order.forEach((p) => { if (p.id !== 'distillate' || M.vol(st.receiver.c) > 0.05) rect('part:' + p.id, partBox(p.id, st)); });
        for (const id of EXPLORE_EXTRA) rect('part:' + id, partBox(id, st));
        return out;
      }
      if (ui.labels === 'names') return out;
      const end = (pts) => pts[pts.length - 1];
      rect('bottle', { x0: g.bottle.x - g.bottle.w / 2, y0: -g.bottle.h, x1: g.bottle.x + g.bottle.w / 2, y1: 0 });
      rect('stones', { x0: g.stonesDish.x - g.stonesDish.w / 2, y0: -30, x1: g.stonesDish.x + g.stonesDish.w / 2, y1: 0 });
      rect('mantle', { x0: -g.mantle.outer, y0: g.mantle.base - 24, x1: g.mantle.outer, y1: g.mantle.base });
      rect('flask', { x0: -g.flask.R, y0: g.neck.y1, x1: g.flask.R, y1: g.mantle.base - 26 });
      rect('thermo', partBox('thermo', st));
      rect('condenser', (() => { const b = partBox('condenser', st); return { x0: b.x0 + 50, y0: b.y0 + 30, x1: b.x1 - 70, y1: b.y1 - 30 }; })());
      for (const k of ['high', 'low']) { const t = g.nozzles[k].tip; rect('nozzle:' + k, { x0: t.x - 12, y0: t.y - 12, x1: t.x + 12, y1: t.y + 12 }); }
      if (!st.hoses.inlet) { const e = end(g.hoseRoutes.looseInlet()); rect('hose:inlet', { x0: e.x - 10, y0: e.y - 30, x1: e.x + 10, y1: e.y + 6 }); }
      if (!st.hoses.outlet) { const e = end(g.hoseRoutes.looseOutlet()); rect('hose:outlet', { x0: e.x - 14, y0: e.y - 30, x1: e.x + 10, y1: e.y + 8 }); }
      rect('tap', { x0: g.tap.x - 12, y0: g.tap.handle.y - 16, x1: g.tap.x + 32, y1: g.tap.handle.y + 16 });
      rect('adapter', { x0: g.adapter.a1.x - 10, y0: g.adapter.a1.y - 14, x1: g.adapter.tip.x + 10, y1: g.adapter.a2.y + 10 });
      if (!st.receiver.present) rect('receiverSpot', { x0: g.receiver.x - g.receiver.baseHW, y0: g.receiver.rim + 30, x1: g.receiver.x + g.receiver.baseHW, y1: g.receiver.base });
      rect('receiver', partBox('receiver', st));
      if (g.station) {
        const s = g.station;
        const pp = pipettePose(st, ui), lp = lighterPose(st, ui);
        rect('pipette', { x0: pp.tip.x - 10, y0: pp.tip.y - 112, x1: pp.tip.x + 10, y1: pp.tip.y });
        rect('lighter', { x0: lp.base.x - 10, y0: lp.base.y - 100, x1: lp.base.x + 10, y1: lp.base.y });
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

    /** Meldungsband oben (CSS-Pixel relativ zur Bühne): über der ganzen Szene, unter der Bedienleiste. */
    function bandRect() { resize(); return { x: 8, y: 2, w: Math.max(0, view.w - 16), h: TOP_BAND - 4 }; }

    return { frame, resize, hitAreas, anchors, partBox, bandRect, get geo() { return geo; }, view, PARTS, EXPLORE_EXTRA };
  }

  (root.DS = root.DS || {}).render = { createRenderer, PARTS, PARTICLE, TOP_BAND };
})(typeof self !== 'undefined' ? self : this);
