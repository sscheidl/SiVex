/*
 * Trennlabor – Darstellung „Destillation“ (Canvas 2D)
 * Apparatur, Flüssigkeitsstände, Sieden, Dampf, Kondensat, Kühlwasser,
 * Thermometer und Brennprobe – alles aus dem Modellzustand (TL.distill).
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const R = TL.render;
  const { clamp, lerp, rng, fmt } = TL.util;

  const BENCH = 700;
  const STAND_X = 170;
  const FL = { x: 300, y: 552, r: 76, neckTop: 418 };
  const MANTLE = { x: 300, top: 560, bottom: 650 };
  const HEAD = { x: 300, top: 250, bottom: 418, arm: 290 };
  const COND = { x0: 352, y0: 304, x1: 748, y1: 488 };
  const ADP = { x: 790, y: 560 };
  const OUT = { x: 795 };
  const SPARE = { A: 905, B: 985, C: 1065 };
  const TAP = { x: 1160, y: 600 };
  const DISH = { x: 1120, y: 760 };
  const TRAY = { x: 860, y: 150, w: 326, h: 300 };
  const THERMO_Y = { correct: 296, high: 238, deep: 572 };

  const LIQ = [190, 214, 236, 0.5];

  function create(stage) {
    const ctx = stage.ctx;
    const vis = { t: 0, bubbles: [], drops: [], shake: 0 };
    const r0 = rng(17);
    for (let i = 0; i < 40; i++) vis.bubbles.push({ u: r0() * 2 - 1, ph: r0(), s: 1 + r0() * 2.5, v: 0.5 + r0() });
    for (let i = 0; i < 12; i++) vis.drops.push({ ph: r0(), s: 1.5 + r0() });

    const condPoint = (u) => ({ x: lerp(COND.x0, COND.x1, u), y: lerp(COND.y0, COND.y1, u) });
    const ang = Math.atan2(COND.y1 - COND.y0, COND.x1 - COND.x0);
    const len = Math.hypot(COND.x1 - COND.x0, COND.y1 - COND.y0);

    /** Füllhöhe einer Kugel (Rundkolben) zu einem Volumen. */
    function sphereLevel(vol, r, full) {
      const V = clamp(vol / full, 0, 1) * (4 / 3) * Math.PI * r * r * r * 0.92;
      let lo = 0, hi = 2 * r;
      for (let i = 0; i < 30; i++) { const h = (lo + hi) / 2; const v = Math.PI * h * h * (3 * r - h) / 3; if (v < V) lo = h; else hi = h; }
      return lo;
    }

    function drawStand() {
      R.stand(ctx, STAND_X, 70, BENCH);
    }

    function drawMantle(st) {
      const p = st.parts;
      // Hebebühne
      ctx.save(); ctx.fillStyle = '#7b8792'; R.roundRect(ctx, MANTLE.x - 80, MANTLE.bottom, 160, 10, 3); ctx.fill();
      ctx.strokeStyle = '#5d6975'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(MANTLE.x - 60, MANTLE.bottom + 10); ctx.lineTo(MANTLE.x + 60, BENCH - 6); ctx.moveTo(MANTLE.x + 60, MANTLE.bottom + 10); ctx.lineTo(MANTLE.x - 60, BENCH - 6); ctx.stroke();
      ctx.fillStyle = '#4b5662'; R.roundRect(ctx, MANTLE.x - 80, BENCH - 8, 160, 8, 3); ctx.fill(); ctx.restore();
      if (!p.mantle) return;
      const glow = clamp(st.power / 260, 0, 1);
      ctx.save();
      ctx.fillStyle = '#39424c';
      ctx.beginPath(); ctx.moveTo(MANTLE.x - 98, MANTLE.top); ctx.quadraticCurveTo(MANTLE.x - 92, MANTLE.bottom, MANTLE.x - 60, MANTLE.bottom); ctx.lineTo(MANTLE.x + 60, MANTLE.bottom); ctx.quadraticCurveTo(MANTLE.x + 92, MANTLE.bottom, MANTLE.x + 98, MANTLE.top); ctx.closePath(); ctx.fill();
      const g = ctx.createRadialGradient(MANTLE.x, MANTLE.top + 30, 10, MANTLE.x, MANTLE.top + 30, 90);
      g.addColorStop(0, `rgba(255,${120 - glow * 60},40,${0.15 + glow * 0.75})`); g.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(MANTLE.x, MANTLE.top + 4, 88, 26, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#2a3139'; R.roundRect(ctx, MANTLE.x + 40, MANTLE.bottom - 30, 48, 22, 4); ctx.fill();
      ctx.fillStyle = st.heater ? '#ff7b3a' : '#56616c'; ctx.beginPath(); ctx.arc(MANTLE.x + 52, MANTLE.bottom - 19, 4, 0, 6.29); ctx.fill();
      ctx.restore();
      R.text(ctx, st.heater ? `Stufe ${st.heater}` : 'aus', MANTLE.x + 72, MANTLE.bottom - 18, { size: 10, color: '#fff', weight: 700 });
      stage.hit('mantle', MANTLE.x - 100, MANTLE.top - 4, 200, MANTLE.bottom - MANTLE.top + 14, 'Heizpilz');
    }

    function drawFlask(lab) {
      const st = lab.state;
      if (!st.parts.flask) return;
      const shake = st.fx.bump > 0 ? Math.sin(vis.t * 80) * 3 * st.fx.bump : 0;
      const x = FL.x + shake, y = FL.y;
      R.clampArm(ctx, STAND_X, FL.neckTop + 26, x - 20);
      ctx.save();
      ctx.fillStyle = 'rgba(225,236,245,0.35)';
      ctx.beginPath(); ctx.arc(x, y, FL.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 17, FL.neckTop, 34, y - FL.r - FL.neckTop + 10);
      ctx.restore();
      // Flüssigkeit
      const V = lab.flaskVol();
      if (V > 0.05) {
        const h = sphereLevel(V, FL.r - 3, 250);
        const top = y + FL.r - 3 - h;
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, FL.r - 3, 0, Math.PI * 2); ctx.clip();
        const col = LIQ;
        const g = ctx.createLinearGradient(0, top, 0, y + FL.r);
        g.addColorStop(0, R.rgba(col, col[3])); g.addColorStop(1, R.rgba([150, 185, 215], 0.65));
        ctx.fillStyle = g; ctx.fillRect(x - FL.r, top, FL.r * 2, FL.r * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(x, top, Math.sqrt(Math.max(0, (FL.r - 3) ** 2 - (top - y) ** 2)), 3, 0, 0, Math.PI * 2); ctx.fill();
        // Siedesteine
        if (st.stones) { const r = rng(3); ctx.fillStyle = '#8a8f96'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(x - 26 + r() * 52, y + FL.r - 8 - r() * 4, 3 + r() * 2, 2 + r() * 1.5, r(), 0, 6.29); ctx.fill(); } }
        // Blasen beim Sieden
        const boil = st.fx.boil;
        if (boil > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.strokeStyle = 'rgba(120,150,180,0.6)'; ctx.lineWidth = 0.8;
          const n = Math.round(10 + boil * 30);
          for (let i = 0; i < n; i++) {
            const b = vis.bubbles[i % vis.bubbles.length];
            const ph = (b.ph + vis.t * b.v * (0.6 + boil)) % 1;
            const bx = x + b.u * (FL.r - 20) * (st.stones ? 0.4 + 0.6 * ph : 0.3);
            const by = y + FL.r - 10 - ph * (y + FL.r - 10 - top);
            ctx.beginPath(); ctx.arc(bx, by, b.s * (0.6 + ph), 0, 6.29); ctx.fill(); ctx.stroke();
          }
        }
        if (st.fx.bump > 0.2) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x, top + 10, 22 * st.fx.bump, 0, 6.29); ctx.fill(); }
        ctx.restore();
      }
      // Glas
      ctx.save(); ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.6;
      const a0 = Math.asin(17 / FL.r);
      ctx.beginPath(); ctx.arc(x, y, FL.r, -Math.PI / 2 + a0, Math.PI * 1.5 - a0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 17, y - FL.r + 2); ctx.lineTo(x - 17, FL.neckTop); ctx.moveTo(x + 17, y - FL.r + 2); ctx.lineTo(x + 17, FL.neckTop); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(x - 36, y - 30, 8, 22, 0.5, 0, 6.29); ctx.fill();
      ctx.restore();
      stage.hit('flask', x - FL.r, FL.neckTop, FL.r * 2, y + FL.r - FL.neckTop, 'Rundkolben');
    }

    function drawHead(lab) {
      const st = lab.state, p = st.parts;
      if (!p.head) return;
      const x = HEAD.x;
      // Dampf im Aufsatz
      const warm = st.headWarm;
      if (warm > 0.02 && (st.fx.boil > 0 || warm > 0.3)) {
        const top = lerp(HEAD.bottom, HEAD.top + 10, clamp(warm, 0, 1));
        const g = ctx.createLinearGradient(0, HEAD.bottom, 0, top);
        g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.fillStyle = g; ctx.fillRect(x - 13, top, 26, HEAD.bottom - top);
      }
      ctx.save(); ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.4; ctx.fillStyle = 'rgba(225,236,245,0.3)';
      ctx.beginPath(); ctx.moveTo(x - 15, HEAD.bottom); ctx.lineTo(x - 15, HEAD.top); ctx.lineTo(x + 15, HEAD.top); ctx.lineTo(x + 15, HEAD.arm - 8);
      ctx.lineTo(COND.x0 + 4, COND.y0 - 12); ctx.moveTo(x + 15, HEAD.arm + 10); ctx.lineTo(COND.x0, COND.y0 + 8); ctx.moveTo(x + 15, HEAD.arm + 10); ctx.lineTo(x + 15, HEAD.bottom); ctx.stroke();
      // Schliff am Kolben
      ctx.fillStyle = st.parts.clamps ? '#1f6fe5' : 'rgba(150,160,170,0.6)';
      R.roundRect(ctx, x - 20, HEAD.bottom - 6, 40, 12, 3); ctx.fill();
      ctx.restore();
      if (!p.thermo) {
        ctx.save(); ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, HEAD.top, 15, 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      stage.hit('head', x - 20, HEAD.top - 10, 70, HEAD.bottom - HEAD.top + 10, 'Destillationsaufsatz');
      if (st.fx.leak) wisps(x + 24, HEAD.bottom - 4, 0.8, 4);
    }

    function drawThermo(lab) {
      const st = lab.state, pos = st.parts.thermo;
      if (!pos) return;
      const x = HEAD.x;
      const bulbY = THERMO_Y[pos];
      const topY = bulbY - 240;
      ctx.save();
      // Stopfen/Adapter oben
      ctx.fillStyle = '#3a6ea5'; R.roundRect(ctx, x - 13, HEAD.top - 12, 26, 14, 3); ctx.fill();
      ctx.fillStyle = 'rgba(245,250,255,0.95)'; ctx.strokeStyle = '#7d8a96'; ctx.lineWidth = 1.2;
      R.roundRect(ctx, x - 6, topY, 12, bulbY - topY, 5); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, bulbY, 6.5, 0, 6.29); ctx.fillStyle = '#c0392b'; ctx.fill();
      // Skala 0–110 °C auf dem Schaft
      const s0 = bulbY - 30, s1 = topY + 14;
      const yT = (T) => lerp(s0, s1, clamp(T / 110, 0, 1));
      ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 1.8, yT(st.thermoT), 3.6, bulbY - yT(st.thermoT));
      ctx.strokeStyle = '#2b3a48'; ctx.fillStyle = '#2b3a48'; ctx.font = '600 9px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineWidth = 0.8;
      for (let T = 0; T <= 110; T += 5) { const y = yT(T); ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + (T % 10 === 0 ? 1 : 3), y); ctx.stroke(); if (T % 20 === 0) ctx.fillText(String(T), x - 8, y); }
      ctx.restore();
      // Ablesehilfe: große Anzeige neben dem Thermometer
      const r = lab.reading();
      const bx = x + 26, by = Math.max(84, topY + 10);
      ctx.save();
      ctx.fillStyle = '#10202e'; R.roundRect(ctx, bx, by, 136, 52, 10); ctx.fill();
      ctx.restore();
      R.text(ctx, 'Thermometer', bx + 68, by + 12, { size: 10.5, color: '#9fd0ff', weight: 600 });
      R.text(ctx, r == null ? '–' : `${fmt(r)} °C`, bx + 68, by + 34, { size: 22, color: '#7dffb0', weight: 800 });
      ctx.save(); ctx.strokeStyle = 'rgba(16,32,46,0.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(bx, by + 26); ctx.lineTo(x + 7, yT(st.thermoT)); ctx.stroke(); ctx.restore();
      stage.hit('thermo', x - 10, topY, 20, bulbY - topY + 8, 'Thermometer');
    }

    function drawCooler(lab) {
      const st = lab.state, p = st.parts;
      if (!p.cooler) return;
      ctx.save();
      ctx.translate(COND.x0, COND.y0); ctx.rotate(ang);
      // Kühlmantel
      ctx.fillStyle = 'rgba(225,236,245,0.35)'; ctx.fillRect(30, -20, len - 60, 40);
      const flowing = p.hoseIn && st.cool > 0;
      if (flowing) {
        const fillFrac = p.hoseIn === 'bottom' ? 1 : 0.35;
        ctx.save(); ctx.beginPath(); ctx.rect(30, -20, len - 60, 40); ctx.clip();
        ctx.fillStyle = `rgba(80,150,220,${0.25 + st.cool * 0.1})`;
        // Wasser sammelt sich unten (lokal: +y ist unten-links in Weltkoordinaten nicht exakt; Mantel liegt fast waagerecht)
        ctx.fillRect(30, 20 - 40 * fillFrac, len - 60, 40 * fillFrac);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([10, 14]);
        ctx.lineDashOffset = (p.hoseIn === 'bottom' ? 1 : -1) * vis.t * 40 * st.cool;
        for (const yy of [-12, 12]) { if (fillFrac < 1 && yy < 0) continue; ctx.beginPath(); ctx.moveTo(30, yy); ctx.lineTo(len - 30, yy); ctx.stroke(); }
        ctx.restore();
      }
      // Innenrohr
      ctx.fillStyle = 'rgba(240,246,250,0.7)'; ctx.fillRect(0, -6, len, 12);
      // Dampf und Kondensat im Innenrohr
      if (st.fx.vapor > 0.02) {
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, `rgba(255,255,255,${0.6 * st.fx.vapor})`); g.addColorStop(flowing ? 0.35 : 0.9, `rgba(255,255,255,${0.15 * st.fx.vapor})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, -5, len, 10);
      }
      if (st.fx.drip > 0) {
        ctx.fillStyle = 'rgba(120,170,215,0.85)';
        for (const d of vis.drops) { const u = (d.ph + vis.t * 0.25) % 1; ctx.beginPath(); ctx.ellipse(40 + u * (len - 40), 3.5, d.s * 1.4, d.s, 0, 0, 6.29); ctx.fill(); }
      }
      ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.2;
      ctx.strokeRect(30, -20, len - 60, 40);
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(len, -6); ctx.moveTo(0, 6); ctx.lineTo(len, 6); ctx.stroke();
      // Anschlüsse (Oliven)
      ctx.fillStyle = 'rgba(200,215,228,0.95)'; ctx.strokeStyle = 'rgba(105,125,145,0.9)';
      ctx.fillRect(56, -34, 12, 14); ctx.strokeRect(56, -34, 12, 14);
      ctx.fillRect(len - 70, 20, 12, 14); ctx.strokeRect(len - 70, 20, 12, 14);
      ctx.restore();
      R.clampArm(ctx, STAND_X, 340, COND.x0 + 120);
      const mid = condPoint(0.5);
      stage.hit('cooler', mid.x - 120, mid.y - 70, 240, 140, 'Liebigkühler');
      R.label(ctx, 'Liebigkühler', mid.x + 30, mid.y - 46, { size: 12 });
      drawHoses(lab);
    }

    /** Welt-Koordinaten der beiden Kühlwasseranschlüsse. */
    function nipple(which) {
      const c = Math.cos(ang), s = Math.sin(ang);
      const loc = which === 'upper' ? { x: 62, y: -34 } : { x: len - 64, y: 34 };
      return { x: COND.x0 + loc.x * c - loc.y * s, y: COND.y0 + loc.x * s + loc.y * c };
    }

    function drawHoses(lab) {
      const st = lab.state, p = st.parts;
      // Wasserhahn (rechts) und Ausguss (links)
      ctx.save();
      ctx.strokeStyle = '#8f9aa5'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(TAP.x + 30, TAP.y - 40); ctx.lineTo(TAP.x, TAP.y - 40); ctx.lineTo(TAP.x, TAP.y); ctx.stroke();
      ctx.fillStyle = st.cool ? '#1f6fe5' : '#5d6975'; ctx.beginPath(); ctx.arc(TAP.x + 12, TAP.y - 52, 8, 0, 6.29); ctx.fill();
      ctx.restore();
      R.text(ctx, 'Wasserhahn', TAP.x - 10, TAP.y - 70, { size: 11, weight: 600, color: '#4a5866' });
      if (!p.hoseIn) return;
      const lower = nipple('lower'), upper = nipple('upper');
      const inlet = p.hoseIn === 'bottom' ? lower : upper;
      const outlet = p.hoseIn === 'bottom' ? upper : lower;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 7;
      ctx.strokeStyle = '#2f6db5';
      ctx.beginPath(); ctx.moveTo(TAP.x, TAP.y + 2); ctx.bezierCurveTo(TAP.x - 10, TAP.y + 90, inlet.x + 200, inlet.y + (p.hoseIn === 'bottom' ? 70 : -150), inlet.x, inlet.y); ctx.stroke();
      ctx.strokeStyle = '#7ea6cf';
      // Ablauf: nach oben aus dem Bild zum Ausguss (hinter dem Aufbau)
      ctx.beginPath(); ctx.moveTo(outlet.x, outlet.y); ctx.bezierCurveTo(outlet.x + 30, outlet.y - 120, outlet.x + 120, 120, outlet.x + 150, -10); ctx.stroke();
      ctx.restore();
      R.label(ctx, 'Zulauf', inlet.x + 30, inlet.y + (p.hoseIn === 'bottom' ? 36 : -30), { size: 11, bg: 'rgba(225,238,255,0.95)', color: '#1d4f8f' });
      R.label(ctx, 'Ablauf → Ausguss', outlet.x + 60, outlet.y + (p.hoseIn === 'bottom' ? -40 : 36), { size: 11 });
    }

    function drawAdapter(lab) {
      const st = lab.state;
      if (!st.parts.adapter) return;
      ctx.save(); ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.4; ctx.fillStyle = 'rgba(225,236,245,0.35)';
      ctx.beginPath(); ctx.moveTo(COND.x1 - 6, COND.y1 - 8); ctx.quadraticCurveTo(ADP.x + 8, COND.y1, ADP.x + 7, ADP.y); ctx.lineTo(ADP.x - 5, ADP.y); ctx.quadraticCurveTo(ADP.x - 6, COND.y1 + 12, COND.x1 - 10, COND.y1 + 6); ctx.stroke();
      ctx.restore();
      if (st.fx.escape > 0.02) wisps(ADP.x + 4, ADP.y + 6, st.fx.escape, 7);
    }

    function wisps(x, y, a, n) {
      ctx.save();
      for (let i = 0; i < n; i++) {
        const ph = (vis.t * 0.5 + i / n) % 1;
        ctx.fillStyle = `rgba(240,244,248,${0.65 * a * (1 - ph)})`;
        ctx.beginPath(); ctx.arc(x + Math.sin(vis.t * 2 + i) * 8 + ph * 22, y - ph * 60, 5 + ph * 14, 0, 6.29); ctx.fill();
      }
      ctx.restore();
    }

    function erlenmeyer(x, yb, vol, label, stopper, id, sel) {
      const h = 118, top = yb - h, nw = 13, bw = 46;
      const path = () => { ctx.beginPath(); ctx.moveTo(x - nw, top); ctx.lineTo(x - nw, top + 34); ctx.lineTo(x - bw, yb - 6); ctx.quadraticCurveTo(x - bw, yb, x - bw + 6, yb); ctx.lineTo(x + bw - 6, yb); ctx.quadraticCurveTo(x + bw, yb, x + bw, yb - 6); ctx.lineTo(x + nw, top + 34); ctx.lineTo(x + nw, top); };
      ctx.save(); path(); ctx.fillStyle = 'rgba(225,236,245,0.35)'; ctx.fill();
      if (vol > 0.02) {
        ctx.save(); path(); ctx.clip();
        const hh = Math.min(h - 40, Math.sqrt(vol) * 9);
        ctx.fillStyle = 'rgba(185,212,236,0.7)'; ctx.fillRect(x - bw, yb - hh, bw * 2, hh);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - bw, yb - hh, bw * 2, 1.5);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.2; path(); ctx.stroke();
      if (stopper) { ctx.fillStyle = '#3a6ea5'; R.roundRect(ctx, x - 15, top - 12, 30, 18, 4); ctx.fill(); }
      ctx.restore();
      R.text(ctx, label, x, yb + 14, { size: 11, weight: 700, color: '#4a5866' });
      R.text(ctx, `${fmt(vol, 1)} mL`, x, yb - 20, { size: 11, weight: 700, color: '#26323e' });
      stage.hit(id, x - bw, top - 10, bw * 2, h + 10, label);
      if (sel === id) R.selection(ctx, x - bw, top - 10, bw * 2, h + 10, vis.t);
    }

    function drawReceivers(lab, ui) {
      const st = lab.state;
      for (const id of ['A', 'B', 'C']) {
        const r = st.receivers[id];
        const at = st.receiverAt === id;
        const x = at ? OUT.x : SPARE[id];
        erlenmeyer(x, BENCH, r.E + r.W, `Vorlage ${'ABC'.indexOf(id) + 1}`, at && st.receiverStopper, 'rec:' + id, ui.selected);
      }
      // Tropfen vom Vorstoß
      if (st.parts.adapter && st.fx.drip > 0) {
        const r = st.receiverAt ? st.receivers[st.receiverAt] : null;
        const yEnd = r ? BENCH - Math.min(78, Math.sqrt(r.E + r.W) * 9) : BENCH - 2;
        R.drips(ctx, ADP.x + 1, ADP.y + 2, yEnd, st.fx.drip * 1.8, [130, 175, 220, 0.85], vis.t, 0.4);
      } else if (!st.parts.adapter && st.parts.cooler && st.fx.drip > 0) {
        R.drips(ctx, COND.x1 + 2, COND.y1 + 6, BENCH - 2, st.fx.drip * 1.8, [130, 175, 220, 0.85], vis.t, 0.4);
      }
      if (!st.receiverAt) {
        ctx.save(); ctx.strokeStyle = 'rgba(80,100,120,0.35)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; R.roundRect(ctx, OUT.x - 46, BENCH - 118, 92, 118, 8); ctx.stroke(); ctx.restore();
        const t = st.lost.table;
        if (t.E + t.W > 0.2) { ctx.save(); ctx.fillStyle = 'rgba(160,190,215,0.45)'; ctx.beginPath(); ctx.ellipse(OUT.x, BENCH + 4, Math.min(60, 10 + (t.E + t.W) * 3), 5, 0, 0, 6.29); ctx.fill(); ctx.restore(); }
      }
    }

    function drawDish(lab) {
      const st = lab.state;
      const x = DISH.x, y = DISH.y;
      ctx.save();
      ctx.fillStyle = '#f3f1ec'; ctx.strokeStyle = '#b9b4a8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 46, y - 18); ctx.quadraticCurveTo(x - 40, y + 4, x, y + 2); ctx.quadraticCurveTo(x + 40, y + 4, x + 46, y - 18); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (st.dish && st.dish.E + st.dish.W > 0.02) { ctx.fillStyle = 'rgba(185,212,236,0.8)'; ctx.beginPath(); ctx.ellipse(x, y - 12, 30, 5, 0, 0, 6.29); ctx.fill(); }
      ctx.restore();
      if (st.fx.flame > 0 && st.burnTests.length) {
        const res = st.burnTests[st.burnTests.length - 1].result;
        const hgt = res === 'burns' ? 70 : 34;
        const a = clamp(st.fx.flame / (res === 'burns' ? 3 : 1.5), 0, 1);
        const fl = Math.sin(vis.t * 25) * 3;
        ctx.save();
        const g = ctx.createLinearGradient(0, y - 18 - hgt, 0, y - 16);
        g.addColorStop(0, 'rgba(80,120,255,0)'); g.addColorStop(0.4, `rgba(90,130,255,${0.55 * a})`); g.addColorStop(1, `rgba(60,90,255,${0.85 * a})`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x - 26, y - 16); ctx.quadraticCurveTo(x - 20, y - 18 - hgt * 0.6, x + fl, y - 18 - hgt); ctx.quadraticCurveTo(x + 22, y - 18 - hgt * 0.6, x + 26, y - 16); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // Stabfeuerzeug
      ctx.save(); ctx.translate(x - 90, y - 6); ctx.rotate(-0.2); ctx.fillStyle = '#c0392b'; R.roundRect(ctx, 0, -6, 64, 12, 4); ctx.fill(); ctx.fillStyle = '#9aa4ad'; ctx.fillRect(64, -2.5, 34, 5); ctx.restore();
      stage.hit('dish', x - 100, y - 40, 150, 50, 'Porzellanschale (Brennprobe)');
      R.text(ctx, 'Brennprobe', x, y + 18, { size: 11, weight: 700, color: '#4a5866' });
    }

    function drawTray(lab) {
      const st = lab.state, p = st.parts;
      ctx.save(); ctx.fillStyle = 'rgba(233,237,240,0.92)'; R.roundRect(ctx, TRAY.x, TRAY.y, TRAY.w, TRAY.h, 12); ctx.fill(); ctx.strokeStyle = '#cfd7de'; ctx.stroke(); ctx.restore();
      R.text(ctx, 'Geräteablage – antippen zum Einbauen', TRAY.x + TRAY.w / 2, TRAY.y + 16, { size: 12, weight: 700, color: '#4a5866' });
      const items = [
        ['mantle', 'Heizpilz', !p.mantle], ['flask', 'Rundkolben', !p.flask], ['mix', 'Gemisch 40 %', true], ['stones', 'Siedesteine', !st.stones],
        ['head', 'Aufsatz', !p.head], ['thermo', 'Thermometer', !p.thermo], ['cooler', 'Liebigkühler', !p.cooler], ['hoses', 'Schläuche', !p.hoseIn],
        ['adapter', 'Vorstoß', !p.adapter], ['clamps', 'Klemmen', !p.clamps]
      ];
      const cols = 4, cw = TRAY.w / cols, rh = 92;
      let i = 0;
      for (const [id, name, show] of items) {
        if (!show) continue;
        const cx = TRAY.x + cw * (i % cols) + cw / 2, cy = TRAY.y + 40 + Math.floor(i / cols) * rh;
        icon(id, cx, cy + 26);
        R.text(ctx, name, cx, cy + 66, { size: 11, weight: 600, color: '#26323e' });
        stage.hit('tray:' + id, cx - cw / 2 + 4, cy, cw - 8, rh - 8, name);
        i++;
      }
      if (!i) R.text(ctx, 'Alles eingebaut.', TRAY.x + TRAY.w / 2, TRAY.y + 80, { size: 13, color: '#6b7987' });
    }

    function icon(id, x, y) {
      ctx.save(); ctx.strokeStyle = '#6d8296'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(210,228,240,0.7)';
      switch (id) {
        case 'mantle': ctx.fillStyle = '#39424c'; ctx.beginPath(); ctx.ellipse(x, y, 30, 18, 0, 0, Math.PI); ctx.fill(); break;
        case 'flask': ctx.beginPath(); ctx.arc(x, y + 6, 20, 0, 6.29); ctx.fill(); ctx.stroke(); ctx.strokeRect(x - 6, y - 28, 12, 16); break;
        case 'mix': ctx.fillStyle = 'rgba(232,240,246,0.9)'; R.roundRect(ctx, x - 14, y - 26, 28, 50, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(190,215,235,0.8)'; ctx.fillRect(x - 12, y - 4, 24, 26); break;
        case 'stones': ctx.fillStyle = 'rgba(232,240,246,0.9)'; R.roundRect(ctx, x - 16, y - 18, 32, 40, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#8a8f96'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x - 8 + (k % 3) * 8, y + 10 - Math.floor(k / 3) * 7, 3, 0, 6.29); ctx.fill(); } break;
        case 'head': ctx.beginPath(); ctx.moveTo(x - 6, y + 22); ctx.lineTo(x - 6, y - 24); ctx.lineTo(x + 6, y - 24); ctx.lineTo(x + 6, y - 6); ctx.lineTo(x + 26, y + 4); ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 6, y + 22); ctx.stroke(); break;
        case 'thermo': ctx.fillStyle = '#fff'; R.roundRect(ctx, x - 3, y - 30, 6, 52, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(x, y + 22, 4, 0, 6.29); ctx.fill(); break;
        case 'cooler': ctx.translate(x, y); ctx.rotate(0.4); ctx.strokeRect(-30, -8, 60, 16); ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(36, 0); ctx.stroke(); break;
        case 'hoses': ctx.strokeStyle = '#2f6db5'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x - 6, y, 14, 0.3, 5.5); ctx.stroke(); ctx.strokeStyle = '#7ea6cf'; ctx.beginPath(); ctx.arc(x + 8, y + 4, 12, 3, 8.5); ctx.stroke(); break;
        case 'adapter': ctx.beginPath(); ctx.moveTo(x - 20, y - 10); ctx.quadraticCurveTo(x + 10, y - 10, x + 10, y + 20); ctx.stroke(); break;
        case 'clamps': ctx.fillStyle = '#1f6fe5'; for (let k = 0; k < 3; k++) { R.roundRect(ctx, x - 22 + k * 15, y - 8, 11, 16, 3); ctx.fill(); } break;
        default: break;
      }
      ctx.restore();
    }

    function frame(lab, ui, dt) {
      vis.t += dt;
      R.background(ctx, BENCH);
      drawStand();
      drawTray(lab);
      drawMantle(lab.state);
      drawFlask(lab);
      drawCooler(lab);
      drawHead(lab);
      drawThermo(lab);
      drawAdapter(lab);
      drawReceivers(lab, ui);
      drawDish(lab);
      R.label(ctx, 'Destillation Ethanol/Wasser', 300, BENCH + 30, { size: 12.5 });
    }

    return { frame, measureAt: () => null, vis };
  }

  TL.render.distill = { create };
})(typeof self !== 'undefined' ? self : this);
