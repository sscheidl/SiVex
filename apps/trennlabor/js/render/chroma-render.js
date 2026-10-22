/*
 * Trennlabor – Darstellung „Papierchromatographie“ (Canvas 2D)
 * Laufmittelfront, Farbstoffzonen und Startfleck werden ausschließlich aus dem
 * Modellzustand (TL.chroma) gezeichnet – es gibt keine vorgefertigten Bilder.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const R = TL.render;
  const CH = TL.chroma;
  const { clamp, rng, lerp } = TL.util;

  const BENCH = 680;
  const S = 30; // px je cm im Labor
  const CHAMBER = { x: 320, top: 150, bottom: 676, w: 316 };
  const BOARD = { x: 800, bottom: 640 };
  const PEN_Y = 742, PEN_X0 = 560;

  function create(stage) {
    const ctx = stage.ctx;
    const vis = { t: 0, cmp: [], loads: 0, spotAnim: null };

    function paperRect(p, cx, yb, s) {
      const w = p.width * s, h = CH.PAPER_LEN * s;
      return { x: cx - w / 2, y: yb - h, w, h, cx, yb, s };
    }

    /** Ein Chromatographiepapier zeichnen (Laufmittel, Zonen, Linien). */
    function drawPaper(p, cx, yb, s, opts) {
      const o = Object.assign({ hits: false, ruler: false, title: true }, opts);
      const r = paperRect(p, cx, yb, s);
      const yOf = (cm) => yb - cm * s;
      ctx.save();
      ctx.shadowColor = 'rgba(30,40,50,0.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#fdfdfb'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      // feuchter Bereich bis zur Front
      const wetAlpha = p.state === 'developing' ? 0.3 : p.state === 'drying' ? 0.3 * (1 - p.tOut / 90) : 0;
      if (p.state !== 'fresh' && wetAlpha > 0.01) {
        const fy = yOf(p.front);
        ctx.fillStyle = `rgba(150,180,205,${wetAlpha})`;
        ctx.beginPath(); ctx.moveTo(r.x, yb);
        for (let i = 0; i <= 18; i++) {
          const x = r.x + (r.w * i) / 18;
          const wob = p.front < CH.PAPER_LEN - 0.05 ? Math.sin(i * 1.3 + p.no) * (p.lid ? 1.2 : 3.2) : 0;
          ctx.lineTo(x, fy + wob);
        }
        ctx.lineTo(r.x + r.w, yb); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(90,120,150,${wetAlpha * 1.8})`; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= 18; i++) { const x = r.x + (r.w * i) / 18; const wob = p.front < CH.PAPER_LEN - 0.05 ? Math.sin(i * 1.3 + p.no) * (p.lid ? 1.2 : 3.2) : 0; if (i) ctx.lineTo(x, fy + wob); else ctx.moveTo(x, fy + wob); }
        ctx.stroke();
      }
      // Startlinie
      if (p.line) {
        ctx.strokeStyle = p.line.tool === 'pencil' ? 'rgba(90,90,95,0.85)' : 'rgba(30,60,170,0.9)';
        ctx.lineWidth = p.line.tool === 'pencil' ? 1.2 : 1.6;
        ctx.beginPath(); ctx.moveTo(r.x + 4, yOf(p.line.y)); ctx.lineTo(r.x + r.w - 4, yOf(p.line.y)); ctx.stroke();
      }
      // Proben bzw. Zonen
      if (p.state === 'fresh') {
        for (const sp of p.spots) {
          const pen = CH.PEN_BY_ID[sp.pen];
          const rad = CH.spotRadius(sp.load) * s;
          const g = ctx.createRadialGradient(r.x + sp.x * s, yOf(sp.y), 0, r.x + sp.x * s, yOf(sp.y), rad * 1.25);
          g.addColorStop(0, R.rgba(pen.color, 0.95)); g.addColorStop(0.7, R.rgba(pen.color, 0.75)); g.addColorStop(1, R.rgba(pen.color, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x + sp.x * s, yOf(sp.y), rad * 1.25, 0, 6.29); ctx.fill();
        }
      } else {
        ctx.globalCompositeOperation = 'multiply';
        for (const z of p.zones) {
          if (z.amount < 0.01) continue;
          const col = CH.COMPONENTS[z.comp].color;
          const zx = r.x + z.x * s;
          const zy = yOf(z.y);
          if (z.band) {
            const hh = Math.max(3, z.sigma * s * 1.4);
            const g = ctx.createLinearGradient(0, zy - hh, 0, zy + hh);
            g.addColorStop(0, R.rgba(col, 0)); g.addColorStop(0.5, R.rgba(col, clamp(z.amount * 0.7, 0.1, 0.6))); g.addColorStop(1, R.rgba(col, 0));
            ctx.fillStyle = g; ctx.fillRect(r.x, zy - hh, r.w, hh * 2);
            // Schliere vom Start bis zur Zone
            if (z.y - z.y0 > 0.3) { ctx.fillStyle = R.rgba(col, 0.12); ctx.fillRect(r.x, zy, r.w, yOf(z.y0) - zy); }
            continue;
          }
          const rx = (CH.spotRadius(Math.min(z.load, 6)) + 0.18 + z.sigma * 0.25) * s;
          const ry = Math.max(2.5, z.sigma * s * 1.25);
          const a = clamp(0.18 + z.amount * 1.5 / Math.max(1, z.sigma / 0.3), 0.12, 0.95);
          // Schwanz bei überladenen Flecken
          if (z.load >= CH.OVERLOAD && z.mobile && z.y - z.y0 > 0.3) {
            const g = ctx.createLinearGradient(0, yOf(z.y0), 0, zy);
            g.addColorStop(0, R.rgba(col, 0.32)); g.addColorStop(1, R.rgba(col, 0.05));
            ctx.fillStyle = g; ctx.fillRect(zx - rx * 0.8, zy, rx * 1.6, yOf(z.y0) - zy);
          }
          ctx.save(); ctx.translate(zx, zy); ctx.scale(1, ry / rx);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          g.addColorStop(0, R.rgba(col, a)); g.addColorStop(0.55, R.rgba(col, a * 0.75)); g.addColorStop(1, R.rgba(col, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.29); ctx.fill();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      // markierte Front
      if (p.frontMark) {
        ctx.strokeStyle = 'rgba(70,70,75,0.9)'; ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(r.x + 4, yOf(p.frontMark.y) + 1.5); ctx.lineTo(r.x + r.w - 4, yOf(p.frontMark.y) + 1.5); ctx.stroke();
        ctx.setLineDash([]);
        if (!p.frontMark.valid) R.text(ctx, 'Front?', r.x + r.w - 6, yOf(p.frontMark.y) + 12, { size: 11, align: 'right', color: '#a3261c', weight: 700 });
      }
      ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(150,160,170,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1); ctx.restore();
      if (o.title) R.text(ctx, `Nr. ${p.no}`, r.x + 6, r.y + 12, { size: 11, align: 'left', color: '#7d8791', weight: 700 });
      if (o.ruler) drawRuler(r.x - 26, yb, s);
      return r;
    }

    function drawRuler(x, yb, s) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,248,215,0.95)'; ctx.strokeStyle = '#c9b56a'; ctx.lineWidth = 1;
      ctx.fillRect(x, yb - CH.PAPER_LEN * s - 4, 22, CH.PAPER_LEN * s + 8); ctx.strokeRect(x, yb - CH.PAPER_LEN * s - 4, 22, CH.PAPER_LEN * s + 8);
      ctx.strokeStyle = '#333'; ctx.fillStyle = '#333'; ctx.font = '600 9px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (let mm = 0; mm <= CH.PAPER_LEN * 10; mm++) {
        const y = yb - (mm / 10) * s;
        const len = mm % 10 === 0 ? 10 : mm % 5 === 0 ? 7 : 4;
        ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + 22 - len, y); ctx.lineWidth = 0.7; ctx.stroke();
        if (mm % 10 === 0) ctx.fillText(String(mm / 10), x + 1, y);
      }
      ctx.restore();
    }

    function drawChamber(lab) {
      const st = lab.state, ch = st.chamber;
      const p = st.paper;
      const inPaper = p && p.state === 'developing';
      const yb = CHAMBER.bottom, x = CHAMBER.x;
      // Rückwand, Laufmittel, Papier, Vorderwand
      const w2 = CHAMBER.w / 2;
      ctx.save(); ctx.fillStyle = 'rgba(225,236,245,0.35)'; ctx.fillRect(x - w2, CHAMBER.top, CHAMBER.w, yb - CHAMBER.top); ctx.restore();
      const level = ch.eluent ? ch.level : 0;
      if (level > 0) {
        const E = CH.ELUENTS[ch.eluent];
        let col = E.color.slice();
        if (p && p.submerged && p.pool > 0.05) col = R.mix(col, [120, 70, 110, 0.6], clamp(p.pool * 0.12, 0, 0.75));
        R.liquidBand(ctx, { left: x - w2 + 3, right: x + w2 - 3 }, yb - level * S, yb, col, { meniscus: true });
      }
      if (inPaper) {
        // Halterung
        ctx.save(); ctx.fillStyle = '#7b8792'; ctx.fillRect(x - w2 - 14, CHAMBER.top + 54, CHAMBER.w + 28, 6);
        ctx.fillStyle = '#4e5965'; R.roundRect(ctx, x - 16, CHAMBER.top + 48, 32, 18, 4); ctx.fill(); ctx.restore();
        drawPaper(p, x, yb - 2, S, {});
        // Laufmittel vor dem Papier
        if (level > 0) { ctx.save(); ctx.fillStyle = R.rgba(CH.ELUENTS[ch.eluent].color, 0.22); ctx.fillRect(x - w2 + 3, yb - level * S, CHAMBER.w - 6, level * S); ctx.restore(); }
      }
      // Glas
      ctx.save(); ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(x - w2, CHAMBER.top); ctx.lineTo(x - w2, yb - 8); ctx.quadraticCurveTo(x - w2, yb, x - w2 + 8, yb); ctx.lineTo(x + w2 - 8, yb); ctx.quadraticCurveTo(x + w2, yb, x + w2, yb - 8); ctx.lineTo(x + w2, CHAMBER.top); ctx.stroke();
      const gl = ctx.createLinearGradient(x - w2, 0, x - w2 + 22, 0); gl.addColorStop(0, 'rgba(255,255,255,0.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - w2 + 3, CHAMBER.top + 20, 20, yb - CHAMBER.top - 40);
      // Füllstandsskala (cm)
      ctx.strokeStyle = 'rgba(70,90,110,0.6)'; ctx.fillStyle = 'rgba(55,70,90,0.8)'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
      for (let c = 1; c <= 4; c++) { const y = yb - c * S; ctx.beginPath(); ctx.moveTo(x + w2 - 22, y); ctx.lineTo(x + w2 - 8, y); ctx.stroke(); ctx.fillText(`${c} cm`, x + w2 - 58, y); }
      ctx.restore();
      // Deckel
      ctx.save();
      if (ch.lid) { ctx.fillStyle = 'rgba(210,228,240,0.75)'; ctx.strokeStyle = 'rgba(105,125,145,0.9)'; R.roundRect(ctx, x - w2 - 14, CHAMBER.top - 12, CHAMBER.w + 28, 12, 3); ctx.fill(); ctx.stroke(); }
      else { ctx.translate(x + w2 + 30, yb); ctx.rotate(-1.35); ctx.fillStyle = 'rgba(210,228,240,0.75)'; ctx.strokeStyle = 'rgba(105,125,145,0.9)'; R.roundRect(ctx, 0, 0, CHAMBER.w * 0.6, 10, 3); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      stage.hit('chamber', x - w2 - 10, CHAMBER.top - 20, CHAMBER.w + 20, yb - CHAMBER.top + 26, 'Entwicklungskammer');
      R.label(ctx, `Entwicklungskammer${ch.eluent ? ' · ' + CH.ELUENTS[ch.eluent].short + ' · ' + TL.util.fmt(ch.level) + ' cm' : ' · leer'}`, x, BENCH + 26, { size: 12.5 });
      if (ch.eluent === 'ethanol') drawFlammable(x + w2 - 26, CHAMBER.top + 30);
    }

    function drawFlammable(x, y) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d0021b'; ctx.lineWidth = 2.5; ctx.fillRect(-12, -12, 24, 24); ctx.strokeRect(-12, -12, 24, 24);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-6, 7); ctx.quadraticCurveTo(-8, -2, -1, -9); ctx.quadraticCurveTo(0, -2, 4, -4); ctx.quadraticCurveTo(8, 2, 6, 7); ctx.closePath(); ctx.fill();
      ctx.fillRect(-8, 8, 16, 2);
      ctx.restore();
    }

    function drawBoard(lab, ui) {
      const p = lab.state.paper;
      ctx.save(); ctx.fillStyle = '#e9edf0'; R.roundRect(ctx, BOARD.x - 190, 150, 380, 520, 12); ctx.fill(); ctx.strokeStyle = '#cfd7de'; ctx.stroke(); ctx.restore();
      R.label(ctx, 'Arbeitsfläche', BOARD.x, 168, { size: 12 });
      if (!p || p.state === 'developing') {
        R.text(ctx, p ? 'Das Papier steht in der Kammer.' : 'Nimm ein neues Papier (Bedienfeld).', BOARD.x, 400, { size: 14, color: '#6b7987' });
        return;
      }
      const r = drawPaper(p, BOARD.x, BOARD.bottom, S, { ruler: !!ui.expert });
      stage.hit('paper', r.x, r.y, r.w, r.h, 'Papier');
      if (p.state === 'fresh') {
        for (let l = 0; l < p.lanes; l++) {
          const lx = r.x + (l + 0.5) * r.w / p.lanes;
          const ly = BOARD.bottom - (p.line ? p.line.y : 1.5) * S;
          stage.hit('lane:' + l, lx - r.w / p.lanes / 2 + 2, ly - 40, r.w / p.lanes - 4, 80, `Bahn ${l + 1}`);
          const sp = p.spots.find((s) => s.lane === l);
          if (!sp) { ctx.save(); ctx.strokeStyle = ui.lane === l ? 'rgba(31,111,229,0.8)' : 'rgba(120,130,140,0.35)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(lx, ly, 8, 0, 6.29); ctx.stroke(); ctx.restore(); }
          if (ui.drag && ui.drag.target === 'lane:' + l) R.targetMark(ctx, lx - 30, ly - 30, 60, 60);
          R.text(ctx, String(l + 1), lx, BOARD.bottom + 14, { size: 11, color: '#6b7987', weight: 700 });
        }
        if (vis.spotAnim && vis.t - vis.spotAnim.t < 0.5) {
          const a = vis.spotAnim; const lx = r.x + (a.lane + 0.5) * r.w / p.lanes; const ly = BOARD.bottom - (p.line ? p.line.y : 1.5) * S;
          drawPen(CH.PEN_BY_ID[a.pen], lx + 4, ly - 8 - Math.sin((vis.t - a.t) / 0.5 * Math.PI) * 10, -1.2);
        }
      }
    }

    function drawPen(pen, x, y, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
      ctx.fillStyle = '#f1f3f5'; ctx.strokeStyle = '#9aa4ad'; ctx.lineWidth = 1;
      R.roundRect(ctx, 0, -7, 62, 14, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = R.rgba(pen.color, 1); R.roundRect(ctx, 54, -8, 26, 16, 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-12, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fillStyle = '#d9d2c4'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-12, 0); ctx.lineTo(-8, 2); ctx.fillStyle = R.rgba(pen.color, 1); ctx.fill();
      ctx.fillStyle = R.rgba(pen.color, 0.85); ctx.fillRect(8, -3, 30, 6);
      if (pen.id === 'perm') { ctx.fillStyle = '#fff'; ctx.font = '700 7px system-ui'; ctx.fillText('PERM', 12, 3); }
      ctx.restore();
    }

    function drawTools(lab, ui) {
      // Laufmittelflaschen
      const bottles = [['water', 560, 'Wasser'], ['ethanol', 660, 'Ethanol-Wasser 7 : 3']];
      for (const [id, x, name] of bottles) {
        ctx.save();
        ctx.fillStyle = 'rgba(232,240,246,0.85)'; ctx.strokeStyle = '#8796a4'; ctx.lineWidth = 1.5;
        R.roundRect(ctx, x - 26, BENCH - 96, 52, 96, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2f3a45'; ctx.fillRect(x - 10, BENCH - 110, 20, 14);
        ctx.fillStyle = 'rgba(190,215,235,0.6)'; ctx.fillRect(x - 24, BENCH - 60, 48, 58);
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 22, BENCH - 82, 44, 22);
        ctx.restore();
        R.text(ctx, id === 'water' ? 'H₂O' : 'EtOH', x, BENCH - 71, { size: 11, weight: 700 });
        if (id === 'ethanol') drawFlammable(x, BENCH - 30);
        stage.hit('bottle:' + id, x - 30, BENCH - 112, 60, 114, name);
        R.text(ctx, name, x, BENCH + 14, { size: 11, weight: 600, color: '#4a5866' });
        if (ui.view !== 'compare' && lab.state.chamber.eluent === id) { ctx.save(); ctx.strokeStyle = 'rgba(31,111,229,0.5)'; ctx.lineWidth = 2; R.roundRect(ctx, x - 30, BENCH - 114, 60, 116, 10); ctx.stroke(); ctx.restore(); }
      }
      // Bleistift und Kugelschreiber
      const tools = [['pencil', 120, 'Bleistift', '#e5b93c'], ['ballpoint', 120, 'Kugelschreiber', '#1d3fa6']];
      tools.forEach(([id, x, name, col], i) => {
        const y = PEN_Y - 18 + i * 34;
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = col; R.roundRect(ctx, 0, -5, 110, 10, 3); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-14, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fillStyle = id === 'pencil' ? '#e8d4b0' : '#c9cdd2'; ctx.fill();
        ctx.fillStyle = id === 'pencil' ? '#444' : '#1d3fa6'; ctx.beginPath(); ctx.arc(-12, 0, 1.6, 0, 6.29); ctx.fill();
        ctx.restore();
        R.text(ctx, name, x + 170, y, { size: 11.5, weight: 600, color: ui.lineTool === id ? '#1f6fe5' : '#4a5866' });
        stage.hit(id, x - 16, y - 14, 220, 28, name);
      });
      // Stifte
      CH.PENS.forEach((pen, i) => {
        const x = PEN_X0 + 170 + (i % 4) * 125, y = PEN_Y - 18 + Math.floor(i / 4) * 36;
        drawPen(pen, x, y, 0);
        R.text(ctx, pen.name, x + 34, y + 16, { size: 10.5, weight: 600, color: lab.state.selectedPen === pen.id ? '#1f6fe5' : '#4a5866' });
        stage.hit('pen:' + pen.id, x - 14, y - 12, 100, 32, pen.long);
        if (lab.state.selectedPen === pen.id) R.selection(ctx, x - 12, y - 9, 94, 18, vis.t);
      });
    }

    // ---------------------------------------------------------- Vergleichsansicht
    function drawCompare(lab, ui) {
      const list = TL.tasks.chroma.papers(lab).slice(-4);
      vis.cmp = [];
      ctx.save(); ctx.fillStyle = '#eef2f5'; ctx.fillRect(0, 0, R.W, R.H); ctx.restore();
      R.text(ctx, 'Chromatogramme vergleichen', 600, 36, { size: 20, weight: 750 });
      R.text(ctx, ui.expert ? 'Tippe auf die Mitte einer Zone, um ihre Laufstrecke ab der Startlinie zu messen.' : 'Die letzten vier entwickelten Chromatogramme nebeneinander.', 600, 62, { size: 13, color: '#4a5866' });
      if (!list.length) { R.text(ctx, 'Noch keine entwickelten Chromatogramme.', 600, 380, { size: 15, color: '#6b7987' }); return; }
      const s = 30;
      const slot = R.W / list.length;
      list.forEach((x, i) => {
        const cx = slot * (i + 0.5) + (ui.expert ? 12 : 0);
        const yb = 610;
        const r = drawPaper(x.p, cx, yb, s, { ruler: !!ui.expert });
        vis.cmp.push({ no: x.p.no, p: x.p, r });
        const lanes = x.r.lanes;
        for (const l of lanes) {
          const lx = r.x + (l.lane + 0.5) * r.w / x.p.lanes;
          R.text(ctx, CH.PEN_BY_ID[l.pen].name.replace(' (Referenz)', ' (R)'), lx, yb + 14 + (l.lane % 2) * 14, { size: 10.5, weight: 600 });
        }
        R.label(ctx, `Nr. ${x.p.no} · ${CH.ELUENTS[x.p.eluent].short}`, cx, r.y - 16, { size: 12 });
        const issues = { submerged: 'Start im Laufmittel', ballpoint: 'Kugelschreiberlinie', overload: 'zu viel Probe', tooShort: 'zu kurz entwickelt', frontAtTop: 'Front am Rand', noLine: 'ohne Startlinie' };
        const txt = x.r.issues.map((k) => issues[k]).filter(Boolean).join(', ');
        if (txt) R.text(ctx, txt, cx, yb + 46, { size: 11, color: '#a3261c', weight: 600 });
        if (ui.measure && ui.measure.no === x.p.no && x.p.line) {
          const y = yb - (x.p.line.y + ui.measure.cm) * s;
          ctx.save(); ctx.strokeStyle = 'rgba(31,111,229,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 3]);
          ctx.beginPath(); ctx.moveTo(r.x - 30, y); ctx.lineTo(r.x + r.w + 8, y); ctx.stroke(); ctx.restore();
        }
      });
    }

    function measureAt(lab, x, y) {
      for (const c of vis.cmp) {
        const r = c.r;
        if (x >= r.x - 30 && x <= r.x + r.w + 10 && y >= r.y && y <= r.y + r.h) {
          if (!c.p.line) return { no: c.no, cm: NaN };
          const cm = (r.yb - y) / r.s - c.p.line.y;
          return { no: c.no, cm: Math.round(cm * 10) / 10 };
        }
      }
      return null;
    }

    function frame(lab, ui, dt) {
      vis.t += dt;
      const p = lab.state.paper;
      const loads = p ? p.spots.reduce((s, x) => s + x.load, 0) + p.no * 1000 : 0;
      if (loads !== vis.loads) {
        if (p && loads > vis.loads && Math.floor(loads / 1000) === Math.floor(vis.loads / 1000)) {
          const last = lab.state.log.filter((e) => e.type === 'spot').slice(-1)[0];
          if (last) vis.spotAnim = { lane: last.lane, pen: last.pen, t: vis.t };
        }
        vis.loads = loads;
      }
      if (ui.view === 'compare') { drawCompare(lab, ui); return; }
      R.background(ctx, BENCH);
      drawChamber(lab);
      drawBoard(lab, ui);
      drawTools(lab, ui);
      if (ui.drag && ui.drag.id && ui.drag.id.startsWith('pen:') && ui.drag.ghost) drawPen(CH.PEN_BY_ID[ui.drag.id.slice(4)], ui.drag.ghost.x, ui.drag.ghost.y, -1);
      void lerp; void rng;
    }

    return { frame, measureAt, vis };
  }

  TL.render.chroma = { create };
})(typeof self !== 'undefined' ? self : this);
