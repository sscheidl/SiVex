/*
 * Trennlabor – Darstellung „Destillation“ (Canvas 2D)
 *
 * Apparatur in Seitenansicht. Nicht angebrachte Teile erscheinen als
 * gestrichelte Platzhalter, die angetippt werden können. Thermometer, große
 * Digitalanzeige und Temperaturverlauf lesen ausschließlich den Modellwert.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const { clamp, lerp, fmt } = TL.core;
  const G = TL.gfx;
  const D = TL.distill;

  const W = 1240, H = 860, BENCH = 740;
  const FL = { x: 262, cy: 598, r: 62, neckTop: 470 };
  const HEAD = { top: 318, arm: 392 };
  const COND = { x0: 314, y0: 408, x1: 700, y1: 556 };
  const RCV = { x: 758, base: BENCH };
  const TAP = { x: 904, y: 344 };
  const SINK = { x: 948, y: BENCH };
  const SAMPLE = { x0: 1018, x1: 1230, top: 612, dish: 1100, pip: 1196 };
  const BULB = { vapor: HEAD.arm, high: HEAD.top + 26, liquid: FL.cy + 18 };
  const GRAPH = { x: 724, y: 14, w: 502, h: 232 };
  const READ = { x: 376, y: 14, w: 334, h: 168 };

  // Kugelvolumen-Tabelle für den Rundkolben (250 mL bis ca. 88 % der Kugel)
  const sphere = (() => {
    const t = [0];
    for (let h = 1; h <= 2 * FL.r - 6; h++) { const y = FL.r - (h - 0.5); const r = Math.sqrt(Math.max(0, FL.r * FL.r - y * y)); t.push(t[h - 1] + Math.PI * r * r); }
    const k = 250 / t[Math.round(2 * FL.r * 0.88)];
    return t.map((v) => v * k);
  })();
  const flaskH = (vol) => { for (let h = 1; h < sphere.length; h++) if (sphere[h] >= vol) return h; return sphere.length - 1; };

  function createRenderer(canvas) {
    const view = G.createView(canvas, W, H);
    const ctx = view.ctx;
    let time = 0;

    const P = (e) => e.state.parts;
    const angle = Math.atan2(COND.y1 - COND.y0, COND.x1 - COND.x0);
    const along = (f, off) => ({ x: lerp(COND.x0, COND.x1, f) - Math.sin(angle) * (off || 0), y: lerp(COND.y0, COND.y1, f) + Math.cos(angle) * (off || 0) });

    function ghost(id, x, y, w, h, text, ui) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = ui.targets && ui.targets.includes(id) ? 'rgba(31,111,229,0.95)' : 'rgba(100,120,140,0.5)';
      ctx.lineWidth = 1.8;
      G.rr(ctx, x, y, w, h, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      ctx.restore();
      G.text(ctx, text, x + w / 2, y + h / 2 + 4, { size: 13, align: 'center', color: '#56636f' });
      view.addHot(id, x, y, w, h, { kind: 'ghost' });
    }

    // ---------------------------------------------------------- Bauteile
    function drawStand() {
      ctx.fillStyle = '#5e6a75'; G.rr(ctx, 70, BENCH - 10, 180, 12, 3); ctx.fill();
      ctx.fillStyle = '#86929d'; ctx.fillRect(116, 150, 9, BENCH - 150);
      ctx.fillStyle = '#5e6a75'; G.rr(ctx, 470, BENCH - 10, 120, 12, 3); ctx.fill();
      ctx.fillStyle = '#86929d'; ctx.fillRect(526, 400, 9, BENCH - 400);
    }

    function drawHeater(e, ui) {
      const lv = e.state.heater;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(FL.x - 92, BENCH); ctx.lineTo(FL.x - 84, 632); ctx.quadraticCurveTo(FL.x, 690, FL.x + 84, 632); ctx.lineTo(FL.x + 92, BENCH); ctx.closePath();
      ctx.fillStyle = '#4c5660'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(FL.x, 634, 84, 14, 0, Math.PI, 0); ctx.fillStyle = '#c6b9a3'; ctx.fill();
      if (lv > 0) {
        const glow = ctx.createRadialGradient(FL.x, 650, 10, FL.x, 650, 90);
        glow.addColorStop(0, `rgba(255,${120 - lv * 15},40,${0.15 + lv * 0.12})`); glow.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = glow; ctx.fillRect(FL.x - 90, 600, 180, 90);
      }
      G.rr(ctx, FL.x - 40, 700, 80, 26, 5); ctx.fillStyle = '#1f2a33'; ctx.fill();
      G.text(ctx, lv ? 'Stufe ' + lv : 'AUS', FL.x, 718, { size: 13, color: lv ? '#ffb27a' : '#7d8b97', align: 'center', weight: 800, font: 'ui-monospace, Consolas, monospace' });
      ctx.restore();
      G.label(ctx, 'Heizpilz', FL.x, BENCH + 22, { size: 14 });
      view.addHot('part:heater', FL.x - 92, 630, 184, 110, { kind: 'part' });
    }

    function drawFlask(e, ui) {
      const st = e.state;
      const vol = st.liquid.E + st.liquid.W;
      ctx.save();
      // Flüssigkeit
      ctx.save();
      ctx.beginPath(); ctx.arc(FL.x, FL.cy, FL.r - 2, 0, Math.PI * 2); ctx.clip();
      if (vol > 0) {
        const h = flaskH(vol);
        const top = FL.cy + FL.r - h;
        ctx.fillStyle = 'rgba(200,225,245,0.55)'; ctx.fillRect(FL.x - FL.r, top, FL.r * 2, h + 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(FL.x - FL.r, top - 1, FL.r * 2, 2);
        // Sieden
        const boiling = st.heater > 0 && st.vaporRate > 0;
        if (boiling || st.liquid.superheat > 0) {
          const n = 10 + st.heater * 8;
          const rnd = G.rng(4);
          ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2;
          for (let i = 0; i < n; i++) {
            const ph = (time * (0.9 + rnd() * 0.8) + rnd()) % 1;
            const y = FL.cy + FL.r - 6 - ph * (h - 6);
            ctx.beginPath(); ctx.arc(FL.x + (rnd() - 0.5) * 90, y, 1.5 + ph * (st.heater >= 4 ? 4 : 2.5), 0, 7); ctx.stroke();
          }
        }
        if (P(e).chips) { const rnd = G.rng(9); ctx.fillStyle = '#7c7f86'; for (let i = 0; i < 6; i++) ctx.fillRect(FL.x - 26 + rnd() * 52, FL.cy + FL.r - 8 - rnd() * 4, 5, 4); }
      } else if (P(e).chips) { const rnd = G.rng(9); ctx.fillStyle = '#7c7f86'; for (let i = 0; i < 6; i++) ctx.fillRect(FL.x - 26 + rnd() * 52, FL.cy + FL.r - 8 - rnd() * 4, 5, 4); }
      // Dampf im Kolben
      if (st.vaporRate > 0) {
        const rnd = G.rng(12);
        for (let i = 0; i < 10; i++) { const ph = (time * 0.6 + rnd()) % 1; ctx.fillStyle = `rgba(255,255,255,${0.25 * (1 - ph)})`; ctx.beginPath(); ctx.arc(FL.x + (rnd() - 0.5) * 50, FL.cy - ph * 50, 8 + ph * 8, 0, 7); ctx.fill(); }
      }
      ctx.restore();
      // Glas
      ctx.beginPath();
      ctx.moveTo(FL.x - 13, FL.neckTop);
      ctx.lineTo(FL.x - 13, FL.cy - FL.r + 6);
      ctx.arc(FL.x, FL.cy, FL.r, -Math.PI / 2 - 0.21, -Math.PI / 2 + 0.21, true);
      ctx.lineTo(FL.x + 13, FL.neckTop);
      ctx.fillStyle = 'rgba(225,238,248,0.15)'; ctx.fill();
      G.glass(ctx, 2.6);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(FL.x - 26, FL.cy - 24, 8, 20, -0.5, 0, 7); ctx.fill();
      ctx.restore();
      view.addHot('part:flask', FL.x - FL.r, FL.neckTop, FL.r * 2, FL.cy + FL.r - FL.neckTop, { kind: 'part' });
      if (ui.sel === 'flask') G.highlight(ctx, FL.x - FL.r, FL.neckTop, FL.r * 2, FL.cy + FL.r - FL.neckTop, 'sel', time);
    }

    function drawHead(e) {
      const st = e.state;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(FL.x - 15, FL.neckTop + 6); ctx.lineTo(FL.x - 15, HEAD.top);
      ctx.moveTo(FL.x + 15, FL.neckTop + 6); ctx.lineTo(FL.x + 15, HEAD.arm + 12);
      ctx.lineTo(COND.x0 + 4, COND.y0 + 10);
      ctx.moveTo(FL.x + 15, HEAD.top); ctx.lineTo(FL.x + 15, HEAD.arm - 12); ctx.lineTo(COND.x0 + 4, COND.y0 - 10);
      G.glass(ctx, 2.6);
      ctx.fillStyle = '#a7b3be'; ctx.fillRect(FL.x - 17, FL.neckTop - 2, 34, 10);
      ctx.fillStyle = '#a7b3be'; ctx.fillRect(FL.x - 17, HEAD.top - 6, 34, 8);
      // Dampf im Aufsatz
      if (st.vaporRate > 0) {
        const reach = st.passRate > 0 ? 1 : clamp((st.head.T - 20) / Math.max(1, e.boilingPoint() - 20), 0, 1);
        const rnd = G.rng(21);
        for (let i = 0; i < 14; i++) {
          const ph = (time * 0.8 + rnd()) % 1;
          const y = FL.neckTop + 30 - ph * (FL.neckTop + 30 - HEAD.arm) * reach;
          ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - ph * 0.6)})`; ctx.beginPath(); ctx.arc(FL.x + (rnd() - 0.5) * 18, y, 5 + rnd() * 4, 0, 7); ctx.fill();
        }
        if (st.passRate > 0) for (let i = 0; i < 6; i++) { const ph = (time * 1.1 + i / 6) % 1; const p = { x: lerp(FL.x + 10, COND.x0 + 10, ph), y: lerp(HEAD.arm, COND.y0, ph) }; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill(); }
      }
      ctx.restore();
      view.addHot('part:head', FL.x - 22, HEAD.top - 10, 70, FL.neckTop - HEAD.top + 20, { kind: 'part' });
    }

    function drawThermometer(e, ui) {
      const pos = P(e).thermo;
      const bulbY = BULB[pos];
      const topY = bulbY - 300;
      const x = FL.x;
      ctx.save();
      G.rr(ctx, x - 6, topY, 12, bulbY - topY, 6);
      ctx.fillStyle = 'rgba(245,250,255,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(95,120,140,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, bulbY, 7, 0, 7); ctx.fillStyle = '#c62f2f'; ctx.fill();
      // Skala 0–110 °C über 250 px
      const T = e.state.sensor == null ? 20 : e.state.sensor;
      const yAt = (t) => bulbY - 22 - (t / 110) * 250;
      ctx.fillStyle = '#c62f2f'; ctx.fillRect(x - 1.6, yAt(T), 3.2, bulbY - yAt(T));
      ctx.strokeStyle = '#334'; ctx.lineWidth = 1; ctx.font = '600 9.5px system-ui, sans-serif'; ctx.fillStyle = '#334'; ctx.textAlign = 'left';
      for (let t = 0; t <= 110; t += 2) {
        const y = yAt(t), len = t % 10 === 0 ? 7 : 3.5;
        ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 6 + len, y); ctx.stroke();
        if (t % 20 === 0) ctx.fillText(String(t), x + 15, y + 3);
      }
      ctx.restore();
      view.addHot('part:thermo', x - 14, topY, 48, bulbY - topY + 8, { kind: 'part' });
      if (ui.sel === 'thermo') G.highlight(ctx, x - 10, topY, 20, bulbY - topY + 8, 'sel', time);
    }

    function drawCondenser(e, ui) {
      const st = e.state;
      const p = P(e);
      ctx.save();
      ctx.translate(COND.x0, COND.y0); ctx.rotate(angle);
      const L = Math.hypot(COND.x1 - COND.x0, COND.y1 - COND.y0);
      // Mantel
      G.rr(ctx, 24, -20, L - 48, 40, 14);
      ctx.fillStyle = 'rgba(225,238,248,0.25)'; ctx.fill();
      // Kühlwasser im Mantel
      let fill = 0;
      if (p.hoses) fill = p.hoses === 'correct' ? (st.cooling > 0 ? 1 : 0.85) : (st.cooling > 0 ? 0.5 : 0.2);
      if (fill > 0) {
        ctx.save(); G.rr(ctx, 26, -18, L - 52, 36, 12); ctx.clip();
        ctx.fillStyle = 'rgba(120,180,235,0.45)';
        if (fill >= 1) ctx.fillRect(26, -18, L - 52, 36);
        else ctx.fillRect(26 + (L - 52) * (1 - fill), -18, (L - 52) * fill, 36);
        if (st.cooling > 0) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 8; i++) { const f = (i / 8 + time * 0.15 * st.cooling * (p.hoses === 'correct' ? -1 : 1) + 10) % 1; ctx.beginPath(); ctx.arc(26 + f * (L - 52), Math.sin(i * 2.1) * 10, 2, 0, 7); ctx.fill(); } }
        ctx.restore();
      }
      G.rr(ctx, 24, -20, L - 48, 40, 14); G.glass(ctx, 2.4);
      // Innenrohr
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(L, -6); ctx.moveTo(0, 6); ctx.lineTo(L, 6); G.glass(ctx, 2);
      // Stutzen: oben (nahe Aufsatz) und unten (nahe Vorlage)
      ctx.fillStyle = 'rgba(225,238,248,0.6)'; ctx.strokeStyle = 'rgba(95,120,140,0.85)'; ctx.lineWidth = 2;
      ctx.fillRect(44, -34, 12, 16); ctx.strokeRect(44, -34, 12, 16);
      ctx.fillRect(L - 58, 18, 12, 16); ctx.strokeRect(L - 58, 18, 12, 16);
      // Kondensat
      if (st.condRate > 0) {
        const rnd = G.rng(5);
        ctx.fillStyle = 'rgba(200,225,245,0.95)';
        for (let i = 0; i < 12; i++) { const f = (rnd() + time * 0.35) % 1; ctx.beginPath(); ctx.ellipse(f * L, 3, 3, 2, 0, 0, 7); ctx.fill(); }
      }
      ctx.restore();
      view.addHot('part:condenser', Math.min(COND.x0, COND.x1), COND.y0 - 30, Math.abs(COND.x1 - COND.x0), COND.y1 - COND.y0 + 60, { kind: 'part' });
    }
    const portTop = () => { const a = along(56 / Math.hypot(COND.x1 - COND.x0, COND.y1 - COND.y0)); return { x: a.x + Math.sin(angle) * 34, y: a.y - Math.cos(angle) * 34 }; };
    const portBottom = () => { const L = Math.hypot(COND.x1 - COND.x0, COND.y1 - COND.y0); const a = along((L - 52) / L); return { x: a.x - Math.sin(angle) * 34, y: a.y + Math.cos(angle) * 34 }; };

    function hose(from, to, active, dir, c1, c2) {
      ctx.save();
      ctx.strokeStyle = '#3a4a63'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(from.x, from.y);
      const my = Math.max(from.y, to.y) + 80;
      const a = c1 || { x: from.x, y: my }, b = c2 || { x: to.x, y: my };
      ctx.bezierCurveTo(a.x, a.y, b.x, b.y, to.x, to.y); ctx.stroke();
      ctx.strokeStyle = active ? '#78b4ea' : '#5a6b84'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.lineDashOffset = active ? -time * 40 * dir : 0; ctx.stroke();
      ctx.restore();
    }

    function drawWater(e, ui) {
      const st = e.state; const p = P(e);
      // Wasserhahn
      ctx.fillStyle = '#9aa6b1'; ctx.fillRect(TAP.x - 4, TAP.y - 60, 8, 60);
      ctx.fillStyle = '#b8c2cb'; G.rr(ctx, TAP.x - 40, TAP.y - 8, 54, 16, 6); ctx.fill();
      ctx.fillStyle = st.cooling ? '#1f6fe5' : '#5d6873'; G.rr(ctx, TAP.x - 8, TAP.y - 30, 16, 14, 3); ctx.fill();
      G.label(ctx, 'Kühlwasser ' + ['zu', 'schwach', 'mittel', 'stark'][st.cooling], TAP.x + 10, TAP.y - 76, { size: 14 });
      view.addHot('tap', TAP.x - 46, TAP.y - 66, 100, 80, { kind: 'device' });
      // Ausguss
      ctx.fillStyle = '#9ea9b3'; G.rr(ctx, SINK.x - 50, SINK.y - 34, 100, 34, 6); ctx.fill();
      ctx.fillStyle = '#6e7a85'; ctx.fillRect(SINK.x - 42, SINK.y - 30, 84, 6);
      G.label(ctx, 'Abfluss', SINK.x, SINK.y + 22, { size: 14 });
      const pt = portTop(), pb = portBottom();
      if (p.hoses && p.condenser) {
        const tapOut = { x: TAP.x - 36, y: TAP.y + 4 }, sinkIn = { x: SINK.x - 20, y: SINK.y - 30 };
        // Schläuche: vom Hahn bzw. zum Abfluss, oberer Stutzen über die Apparatur geführt
        const viaTop = (port, end, toPort) => (toPort ? hose(end, port, st.cooling > 0, 1, { x: end.x - 40, y: end.y - 150 }, { x: port.x + 30, y: port.y - 140 }) : hose(port, end, st.cooling > 0, 1, { x: port.x + 30, y: port.y - 140 }, { x: end.x - 60, y: end.y - 260 }));
        const viaLow = (port, end, toPort) => (toPort ? hose(end, port, st.cooling > 0, 1, { x: end.x - 30, y: end.y + 160 }, { x: port.x + 10, y: port.y + 90 }) : hose(port, end, st.cooling > 0, 1, { x: port.x + 10, y: port.y + 90 }, { x: end.x - 70, y: end.y + 10 }));
        if (p.hoses === 'correct') { viaLow(pb, tapOut, true); viaTop(pt, sinkIn, false); }
        else { viaTop(pt, tapOut, true); viaLow(pb, sinkIn, false); }
        G.label(ctx, p.hoses === 'correct' ? 'Zulauf' : 'Ablauf', pb.x + 30, pb.y + 4, { size: 11, align: 'left' });
        G.label(ctx, p.hoses === 'correct' ? 'Ablauf' : 'Zulauf', pt.x + 12, pt.y - 16, { size: 11, align: 'left' });
        view.addHot('part:hoses', pb.x - 20, pb.y - 10, 60, 50, { kind: 'part' });
      } else if (p.condenser) {
        ghost('part:hoses', pb.x - 10, pb.y + 6, 120, 40, 'Schläuche', ui);
      }
    }

    function drawAdapterReceiver(e, ui) {
      const st = e.state; const p = P(e);
      if (p.adapter) {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(COND.x1 - 6, COND.y1 - 8); ctx.quadraticCurveTo(RCV.x - 4, COND.y1 + 6, RCV.x - 6, 642);
        ctx.moveTo(COND.x1 + 4, COND.y1 + 8); ctx.quadraticCurveTo(RCV.x + 6, COND.y1 + 20, RCV.x + 6, 642);
        G.glass(ctx, 2.4); ctx.restore();
        view.addHot('part:adapter', COND.x1 - 10, COND.y1 - 16, RCV.x - COND.x1 + 30, 90, { kind: 'part' });
      } else if (p.condenser) ghost('part:adapter', COND.x1 - 6, COND.y1 - 12, 86, 60, 'Vorstoß', ui);
      const tip = p.adapter ? { x: RCV.x, y: 642 } : { x: COND.x1 + 4, y: COND.y1 + 4 };
      // Tropfen
      if (st.dripRate > 0) {
        for (let i = 0; i < 2; i++) {
          const ph = (time * (0.8 + Math.min(2.5, st.dripRate * 6)) + i / 2) % 1;
          const endY = p.receiver ? RCV.base - 60 : BENCH - 4;
          ctx.fillStyle = 'rgba(190,220,245,0.95)'; ctx.beginPath(); ctx.ellipse(tip.x, lerp(tip.y, endY, ph), 2.4, 3.6, 0, 0, 7); ctx.fill();
        }
      }
      // entweichender Dampf
      if (st.passRate > 0 && e.condEfficiency() < 0.6) {
        const rnd = G.rng(31);
        for (let i = 0; i < 10; i++) { const ph = (time * 0.5 + rnd()) % 1; ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - ph)})`; ctx.beginPath(); ctx.arc(tip.x + 10 + ph * 40 + (rnd() - 0.5) * 20, tip.y - ph * 60, 8 + ph * 16, 0, 7); ctx.fill(); }
      }
      if (p.receiver) {
        const vol = st.receiver.E + st.receiver.W;
        const base = RCV.base, x = RCV.x;
        ctx.save();
        const path = () => { ctx.beginPath(); ctx.moveTo(x - 14, base - 118); ctx.lineTo(x - 14, base - 86); ctx.lineTo(x - 46, base - 6); ctx.quadraticCurveTo(x - 48, base, x - 40, base); ctx.lineTo(x + 40, base); ctx.quadraticCurveTo(x + 48, base, x + 46, base - 6); ctx.lineTo(x + 14, base - 86); ctx.lineTo(x + 14, base - 118); };
        path(); ctx.fillStyle = 'rgba(225,238,248,0.2)'; ctx.fill();
        if (vol > 0.01) {
          ctx.save(); path(); ctx.clip();
          const h = Math.min(90, Math.sqrt(vol) * 9);
          ctx.fillStyle = 'rgba(200,225,245,0.7)'; ctx.fillRect(x - 50, base - 3 - h, 100, h + 3);
          ctx.restore();
        }
        path(); G.glass(ctx, 2.4);
        if (p.stopper) { ctx.fillStyle = '#b5523b'; G.rr(ctx, x - 17, base - 128, 34, 16, 4); ctx.fill(); }
        ctx.restore();
        G.label(ctx, `Vorlage · ${fmt(vol, 1)} mL`, x, BENCH + 22, { size: 14 });
        view.addHot('part:receiver', x - 50, base - 130, 100, 150, { kind: 'part' });
        if (ui.targets && ui.targets.includes('receiver')) G.highlight(ctx, x - 48, base - 124, 96, 124, 'target', time);
      } else ghost('part:receiver', RCV.x - 50, RCV.base - 120, 100, 120, 'Vorlage', ui);
      // Fraktionen daneben
      st.fractions.slice(-2).forEach((f, i) => {
        const x = RCV.x + 82 + i * 42;
        ctx.save(); G.rr(ctx, x - 16, BENCH - 70, 32, 70, 6); ctx.fillStyle = 'rgba(225,238,248,0.3)'; ctx.fill(); G.glass(ctx, 1.8);
        const h = Math.min(60, Math.sqrt(f.E + f.W) * 6.5); ctx.fillStyle = 'rgba(200,225,245,0.75)'; ctx.fillRect(x - 14, BENCH - 3 - h, 28, h);
        ctx.restore();
        G.text(ctx, 'F' + f.n, x, BENCH + 16, { size: 11, align: 'center', weight: 700 });
      });
    }

    function drawClamps(e) {
      const ok = P(e).clamps;
      ctx.save();
      ctx.strokeStyle = ok ? '#5d6873' : 'rgba(93,104,115,0.45)'; ctx.lineWidth = 5;
      if (!ok) ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(120, 500); ctx.lineTo(FL.x - 14, 500); ctx.stroke();
      const m = along(0.55);
      ctx.beginPath(); ctx.moveTo(530, m.y + 30); ctx.lineTo(m.x, m.y + 12); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ok ? '#39434c' : 'rgba(57,67,76,0.4)';
      ctx.fillRect(FL.x - 22, 492, 10, 16); ctx.fillRect(m.x - 6, m.y + 6, 12, 16);
      ctx.restore();
      view.addHot('part:clamps', 120, 488, FL.x - 130, 24, { kind: 'part' });
    }

    function drawSampleStation(e, ui) {
      const st = e.state;
      ctx.fillStyle = '#b5c0ca'; G.rr(ctx, SAMPLE.x0, SAMPLE.top, SAMPLE.x1 - SAMPLE.x0, 14, 4); ctx.fill();
      ctx.fillStyle = '#8e9aa5'; ctx.fillRect(SAMPLE.x0 + 14, SAMPLE.top + 14, 10, BENCH - SAMPLE.top - 14); ctx.fillRect(SAMPLE.x1 - 24, SAMPLE.top + 14, 10, BENCH - SAMPLE.top - 14);
      G.label(ctx, 'Brennprobe – getrennter Platz', (SAMPLE.x0 + SAMPLE.x1) / 2, SAMPLE.top - 150, { size: 12, bg: 'rgba(255,243,226,0.96)', color: '#8a4b00' });
      // Porzellanschale
      const x = SAMPLE.dish, y = SAMPLE.top;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x - 50, y - 26); ctx.quadraticCurveTo(x, y + 18, x + 50, y - 26); ctx.closePath();
      ctx.fillStyle = '#f7f5f0'; ctx.fill(); ctx.strokeStyle = '#a9a39a'; ctx.lineWidth = 2; ctx.stroke();
      const amt = st.dish.E + st.dish.W;
      if (amt > 0.01) { ctx.fillStyle = 'rgba(200,225,245,0.85)'; ctx.beginPath(); ctx.ellipse(x, y - 12, 18 + amt * 6, 4, 0, 0, 7); ctx.fill(); }
      // Flamme
      if (st.dish.burning > 0) {
        const fl = st.dish.result === 'flicker' ? clamp(st.dish.burning * 4, 0, 1) : 1;
        for (let i = 0; i < 3; i++) {
          const hgt = (46 + Math.sin(time * 11 + i * 2) * 8) * fl;
          const gr = ctx.createLinearGradient(0, y - 14 - hgt, 0, y - 14);
          gr.addColorStop(0, 'rgba(120,160,255,0)'); gr.addColorStop(0.5, 'rgba(110,150,255,0.45)'); gr.addColorStop(1, 'rgba(70,110,240,0.75)');
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.moveTo(x - 20 + i * 14, y - 14); ctx.quadraticCurveTo(x - 24 + i * 14 + Math.sin(time * 9 + i) * 6, y - 14 - hgt * 0.6, x - 13 + i * 14, y - 14 - hgt); ctx.quadraticCurveTo(x - 2 + i * 14, y - 14 - hgt * 0.5, x - 6 + i * 14, y - 14); ctx.fill();
        }
      }
      ctx.restore();
      G.label(ctx, 'Porzellanschale' + (amt > 0.01 ? ` · ${fmt(amt, 1)} mL` : ''), x, BENCH + 22, { size: 14 });
      view.addHot('dish', x - 56, y - 70, 112, 90, { kind: 'device' });
      if (ui.targets && ui.targets.includes('dish')) G.highlight(ctx, x - 54, y - 50, 108, 60, 'target', time);
      // Pipette und Stabfeuerzeug
      ctx.save(); ctx.translate(SAMPLE.pip, y - 110); ctx.rotate(0.15);
      ctx.fillStyle = 'rgba(230,240,248,0.9)'; ctx.fillRect(-4, 0, 8, 100); ctx.strokeStyle = 'rgba(95,120,140,0.8)'; ctx.strokeRect(-4, 0, 8, 100);
      ctx.fillStyle = '#c0392b'; G.rr(ctx, -7, -26, 14, 28, 6); ctx.fill();
      ctx.restore();
      G.text(ctx, 'Pipette', SAMPLE.pip, y + 26, { size: 11, align: 'center', color: '#fff', weight: 700 });
      const op = st.op;
      if (!(op && op.type === 'ignite')) {
        ctx.save(); ctx.translate(SAMPLE.x0 + 20, y - 4);
        ctx.fillStyle = '#2b3f63'; G.rr(ctx, 0, -8, 70, 14, 5); ctx.fill(); ctx.fillStyle = '#aab4bd'; ctx.fillRect(70, -3, 50, 5);
        ctx.restore();
      }
      view.addHot('lighter', SAMPLE.x0 + 14, y - 16, 120, 26, { kind: 'tool' });
      if (ui.tool === 'lighter') G.highlight(ctx, SAMPLE.x0 + 16, y - 14, 112, 20, 'sel', time);
      if (op && op.type === 'sample') {
        const k = Math.sin(Math.PI * clamp(op.t / op.dur, 0, 1));
        const src = op.src === 'flask' ? { x: FL.x, y: FL.neckTop } : { x: RCV.x, y: RCV.base - 120 };
        const px = lerp(SAMPLE.pip, op.t / op.dur < 0.5 ? src.x : x, k), py = lerp(y - 110, (op.t / op.dur < 0.5 ? src.y : y - 40) - 80, k);
        ctx.fillStyle = 'rgba(230,240,248,0.95)'; ctx.fillRect(px - 4, py, 8, 100); ctx.fillStyle = '#c0392b'; G.rr(ctx, px - 7, py - 26, 14, 28, 6); ctx.fill();
      }
      if (op && op.type === 'ignite') {
        const k = Math.sin(Math.PI * clamp(op.t / op.dur, 0, 1));
        ctx.save(); ctx.translate(lerp(SAMPLE.x0 + 20, x - 120, k), lerp(y - 4, y - 30, k));
        ctx.fillStyle = '#2b3f63'; G.rr(ctx, 0, -8, 70, 14, 5); ctx.fill(); ctx.fillStyle = '#aab4bd'; ctx.fillRect(70, -3, 50, 5);
        ctx.fillStyle = 'rgba(255,170,40,0.9)'; ctx.beginPath(); ctx.ellipse(124, -1, 6, 4, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
    }

    function drawReadout(e) {
      const st = e.state;
      const pos = P(e).thermo;
      ctx.save();
      G.rr(ctx, READ.x, READ.y, READ.w, READ.h, 14);
      ctx.fillStyle = 'rgba(22,32,43,0.94)'; ctx.fill();
      G.text(ctx, 'THERMOMETER', READ.x + 16, READ.y + 26, { size: 12, color: '#9fb3c6', weight: 700 });
      const val = st.sensor == null ? '– – , –' : fmt(st.sensor, 1);
      G.text(ctx, val, READ.x + READ.w - 70, READ.y + 92, { size: 58, color: '#7cf0a8', align: 'right', weight: 700, font: 'ui-monospace, Consolas, "Courier New", monospace' });
      G.text(ctx, '°C', READ.x + READ.w - 20, READ.y + 92, { size: 30, color: '#7cf0a8', align: 'right', weight: 700 });
      const where = { vapor: 'Kugel im Dampfweg, Höhe seitlicher Abgang', high: 'Kugel oberhalb des seitlichen Abgangs', liquid: 'Kugel taucht in die Flüssigkeit' }[pos] || 'kein Thermometer eingesetzt';
      G.text(ctx, where, READ.x + 16, READ.y + 124, { size: 13.5, color: '#d7e2ec', weight: 600 });
      G.text(ctx, 'Destillat gesamt: ' + fmt(e.distillate().vol, 1) + ' mL', READ.x + 16, READ.y + 152, { size: 13.5, color: '#9fb3c6', weight: 600 });
      ctx.restore();
    }

    function drawGraph(e) {
      const st = e.state;
      const g = GRAPH;
      ctx.save();
      G.rr(ctx, g.x, g.y, g.w, g.h, 12); ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,140,160,0.35)'; ctx.stroke();
      const px0 = g.x + 46, px1 = g.x + g.w - 14, py0 = g.y + 34, py1 = g.y + g.h - 30;
      const tMax = Math.max(300, Math.ceil(st.time / 120) * 120);
      const X = (t) => px0 + (px1 - px0) * t / tMax;
      const Y = (T) => py1 - (py1 - py0) * (T - 20) / 90;
      G.text(ctx, 'Temperaturverlauf', g.x + 14, g.y + 21, { size: 14, weight: 700 });
      ctx.strokeStyle = 'rgba(120,140,160,0.25)'; ctx.lineWidth = 1; ctx.font = '600 10px system-ui, sans-serif'; ctx.fillStyle = '#56636f'; ctx.textAlign = 'right';
      for (let T = 20; T <= 110; T += 10) { ctx.beginPath(); ctx.moveTo(px0, Y(T)); ctx.lineTo(px1, Y(T)); ctx.stroke(); ctx.fillText(T + ' °C', px0 - 4, Y(T) + 3); }
      ctx.textAlign = 'center';
      for (let t = 0; t <= tMax; t += tMax > 900 ? 300 : 120) ctx.fillText(Math.round(t / 60) + ' min', X(t), py1 + 14);
      // Bezugslinien
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(31,111,229,0.5)';
      ctx.beginPath(); ctx.moveTo(px0, Y(78)); ctx.lineTo(px1, Y(78)); ctx.stroke();
      ctx.strokeStyle = 'rgba(31,111,229,0.5)'; ctx.beginPath(); ctx.moveTo(px0, Y(100)); ctx.lineTo(px1, Y(100)); ctx.stroke();
      ctx.setLineDash([]);
      G.text(ctx, 'Sdt. Ethanol 78 °C', px0 + 4, Y(78) - 3, { size: 9.5, color: '#3d6fb8', weight: 600 });
      G.text(ctx, 'Sdt. Wasser 100 °C', px0 + 4, Y(100) - 3, { size: 9.5, color: '#3d6fb8', weight: 600 });
      // Kurven
      const curve = st.curve;
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,130,140,0.8)'; ctx.setLineDash([5, 4]);
      ctx.beginPath(); curve.forEach((c, i) => { const x = X(c.t), y = Y(c.flask); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 2.6; ctx.strokeStyle = '#e0602c';
      ctx.beginPath(); let started = false;
      curve.forEach((c) => { if (c.head == null) { started = false; return; } const x = X(c.t), y = Y(c.head); if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; } });
      ctx.stroke();
      // Legende
      ctx.fillStyle = '#e0602c'; ctx.fillRect(g.x + g.w - 268, g.y + 14, 18, 3);
      G.text(ctx, 'Thermometer', g.x + g.w - 246, g.y + 20, { size: 12.5, weight: 600 });
      ctx.strokeStyle = 'rgba(120,130,140,0.9)'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(g.x + g.w - 150, g.y + 16); ctx.lineTo(g.x + g.w - 132, g.y + 16); ctx.stroke(); ctx.setLineDash([]);
      G.text(ctx, 'Kolbeninhalt', g.x + g.w - 128, g.y + 20, { size: 12.5, weight: 600, color: '#56636f' });
      ctx.restore();
    }

    function frame(dt, e, ui) {
      time += dt;
      view.begin('#dfe6ec');
      G.background(view, BENCH, 'distill');
      const p = P(e);
      drawStand();
      drawWater(e, ui);
      if (p.heater) drawHeater(e, ui); else ghost('part:heater', FL.x - 92, 632, 184, 108, 'Heizpilz', ui);
      if (p.flask) drawFlask(e, ui); else if (p.heater) ghost('part:flask', FL.x - FL.r, FL.cy - FL.r, FL.r * 2, FL.r * 2, 'Rundkolben', ui);
      if (p.flask) {
        if (p.head) drawHead(e); else ghost('part:head', FL.x - 30, HEAD.top, 100, FL.neckTop - HEAD.top - 4, 'Aufsatz', ui);
        if (p.head) { if (p.condenser) drawCondenser(e, ui); else ghost('part:condenser', COND.x0 + 30, COND.y0 - 10, 300, 90, 'Liebigkühler', ui); }
      }
      drawAdapterReceiver(e, ui);
      if (p.condenser || p.flask) drawClamps(e);
      if (p.thermo) drawThermometer(e, ui); else if (p.head) ghost('part:thermo', FL.x - 20, HEAD.top - 150, 40, 140, 'Thermo-meter', ui);
      drawSampleStation(e, ui);
      drawReadout(e);
      drawGraph(e);
      if (p.condenser && p.adapter && ui.targets && ui.targets.includes('apparatus')) G.highlight(ctx, COND.x1 - 10, COND.y1 - 20, 90, 100, 'target', time);
      if (p.condenser) view.addHot('apparatus', COND.x1 - 10, COND.y1 - 20, 60, 50, { kind: 'apparatus' });
      G.clock(ctx, W - 14, H - 18, e.state.time, ui.speed);
    }

    return { view, resize: view.resize, frame, toLogical: view.toLogical, hit: (x, y) => view.hit(x, y), hotspots: view.hotspots, W, H };
  }

  TL.renderDistill = { createRenderer };
})(typeof self !== 'undefined' ? self : this);
