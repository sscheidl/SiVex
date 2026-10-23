/*
 * Trennlabor – Darstellung „Papierchromatographie“ (Canvas 2D)
 *
 * Papierstreifen, Startlinie, Probenflecken und Farbzonen werden direkt aus
 * dem Modell (TL.chroma.bands) gezeichnet: Lage = Rf × Frontstrecke,
 * Breite = Fleckgröße + Diffusion. Die Laufmittelfront steigt sichtbar.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const { clamp, lerp } = TL.core;
  const G = TL.gfx;
  const CH = TL.chroma;

  const W = 1200, H = 820, BENCH = 600;
  const PX = 32; // px je cm
  const MAT = { x: 372, bottom: 556 }; // Papier auf der Arbeitsunterlage (linke Kante, Unterkante)
  const JAR = { x: 768, top: 146, bottom: 596, w: 250 };
  const PAPER_IN = { x: JAR.x - 3 * PX, bottom: JAR.bottom - 6 };
  const PENS = { x0: 36, dx: 42, base: BENCH, h: 150 };
  const BOTTLES = { water: 990, etoh: 1094 };
  const BOARD = { x: 960, y: 18, w: 220 };

  function createRenderer(canvas) {
    const view = G.createView(canvas, W, H);
    let ctx = view.ctx;
    let time = 0;

    // -------------------------------------------------------------- Papier
    function paperBands(p) { return CH.bands(p); }

    function drawPaper(p, x0, bottom, s, opts) {
      const o = opts || {};
      const w = CH.PAPER.width * s, h = CH.PAPER.height * s;
      const top = bottom - h;
      ctx.save();
      ctx.fillStyle = '#fffefb';
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = o.thumb ? 3 : 8; ctx.shadowOffsetY = 2;
      ctx.fillRect(x0, top, w, h);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, top, w, h); ctx.clip();
      // Fasertextur
      if (!o.thumb) {
        const rnd = G.rng(p.n * 31 + 7);
        ctx.strokeStyle = 'rgba(200,196,186,0.18)'; ctx.lineWidth = 0.6;
        for (let i = 0; i < 70; i++) { const yy = top + rnd() * h; ctx.beginPath(); ctx.moveTo(x0 + rnd() * w, yy); ctx.lineTo(x0 + rnd() * w, yy + (rnd() - 0.5) * 6); ctx.stroke(); }
      }
      // nasser Bereich
      const wetVisible = p.state === 'chamber' || (p.state === 'removed' && (o.now - p.removedAt) < CH.FRONT_VISIBLE);
      if (p.front > 0 && p.solvent) {
        const fy = bottom - p.front * s;
        const fade = p.state === 'removed' ? clamp(1 - (o.now - p.removedAt) / CH.FRONT_VISIBLE, 0, 1) : 1;
        if (wetVisible || o.thumb) {
          ctx.fillStyle = p.solvent === 'etoh' ? `rgba(200,190,150,${0.16 * fade})` : `rgba(150,180,210,${0.18 * fade})`;
          ctx.fillRect(x0, fy, w, bottom - fy);
          if (fade > 0.05) { ctx.fillStyle = `rgba(120,150,180,${0.35 * fade})`; ctx.fillRect(x0, fy - 1, w, 2); }
        }
      }
      // Banden
      const bands = paperBands(p);
      for (const b of bands) {
        const comp = CH.COMPONENTS[b.comp];
        const cy = bottom - b.y * s;
        const a = clamp(b.amount * 1.15, 0.12, 0.95);
        const sig = Math.max(0.06, b.sigma) * s;
        if (b.wide) {
          const gr = ctx.createLinearGradient(0, cy - sig * 1.6, 0, cy + sig * 1.6);
          gr.addColorStop(0, G.rgba(comp.rgb, 0)); gr.addColorStop(0.5, G.rgba(comp.rgb, a * 0.8)); gr.addColorStop(1, G.rgba(comp.rgb, 0));
          ctx.fillStyle = gr; ctx.fillRect(x0, cy - sig * 1.6, w, sig * 3.2);
          continue;
        }
        const lx = x0 + CH.PAPER.lanes[b.lane] * s;
        const rx = CH.spotRadius(p.lanes[b.lane] ? p.lanes[b.lane].n : 1) * s * 1.15 + (b.moving ? b.s * 0.04 * s : 0);
        if (b.tail > 0) {
          const y0 = bottom - p.line.y * s;
          const gr = ctx.createLinearGradient(0, y0, 0, cy);
          gr.addColorStop(0, G.rgba(comp.rgb, 0.05)); gr.addColorStop(1, G.rgba(comp.rgb, a * 0.5 * Math.min(1, b.tail)));
          ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(lx, (y0 + cy) / 2, rx * 0.8, Math.abs(y0 - cy) / 2 + 1, 0, 0, Math.PI * 2); ctx.fill();
        }
        const gr = ctx.createRadialGradient(lx, cy, 0, lx, cy, Math.max(rx, sig * 1.8));
        gr.addColorStop(0, G.rgba(comp.rgb, a)); gr.addColorStop(0.55, G.rgba(comp.rgb, a * 0.7)); gr.addColorStop(1, G.rgba(comp.rgb, 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(lx, cy, rx, Math.max(sig * 1.8, 1.5), 0, 0, Math.PI * 2); ctx.fill();
      }
      // Startlinie
      if (p.line) {
        const ly = bottom - p.line.y * s;
        ctx.strokeStyle = p.line.tool === 'pen' ? 'rgba(30,50,170,0.95)' : 'rgba(90,90,95,0.8)';
        ctx.lineWidth = o.thumb ? 0.8 : 1.4;
        ctx.beginPath(); ctx.moveTo(x0 + 0.3 * s, ly); ctx.lineTo(x0 + w - 0.3 * s, ly); ctx.stroke();
        if (!o.thumb) {
          ctx.fillStyle = 'rgba(90,90,95,0.8)';
          CH.PAPER.lanes.forEach((lx, i) => { if (!p.lanes[i]) { ctx.fillRect(x0 + lx * s - 0.5, ly - 4, 1, 8); } });
        }
      }
      // markierte Front
      if (p.frontMarked != null) {
        const fy = bottom - p.frontMarked * s;
        ctx.strokeStyle = 'rgba(80,80,85,0.85)'; ctx.lineWidth = o.thumb ? 0.8 : 1.2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(x0 + 0.2 * s, fy); ctx.lineTo(x0 + w - 0.2 * s, fy); ctx.stroke(); ctx.setLineDash([]);
        if (!o.thumb) G.text(ctx, 'Front', x0 + w - 4, fy - 4, { size: 11, color: '#555', align: 'right', weight: 600 });
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(150,150,140,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x0, top, w, h);
      // Bahnnummern
      if (!o.thumb && p.line) {
        CH.PAPER.lanes.forEach((lx, i) => {
          const l = p.lanes[i];
          G.text(ctx, String(i + 1), x0 + lx * s, bottom + 16, { size: 12, color: '#56636f', align: 'center', weight: 700 });
          if (l && o.names) G.text(ctx, CH.SAMPLE_BY_ID[l.sampleId].short, x0 + lx * s, bottom + 31, { size: 10.5, color: '#56636f', align: 'center', weight: 600 });
        });
      }
      return { x: x0, y: top, w, h };
    }

    function drawRuler(x, bottom, s) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,250,215,0.95)'; ctx.fillRect(x, bottom - 12.2 * s, 26, 12.4 * s);
      ctx.strokeStyle = '#a69f6a'; ctx.strokeRect(x, bottom - 12.2 * s, 26, 12.4 * s);
      ctx.strokeStyle = '#3d3a2a'; ctx.fillStyle = '#3d3a2a'; ctx.lineWidth = 1;
      ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'left';
      for (let mm = 0; mm <= 120; mm += 1) {
        const y = bottom - mm / 10 * s;
        const len = mm % 10 === 0 ? 12 : mm % 5 === 0 ? 8 : 4;
        ctx.beginPath(); ctx.moveTo(x, y + 0.5); ctx.lineTo(x + len, y + 0.5); ctx.stroke();
        if (mm % 10 === 0) ctx.fillText(String(mm / 10), x + 14, y + 4);
      }
      ctx.restore();
    }

    // -------------------------------------------------------------- Geräte
    function drawPens(e, ui) {
      CH.SAMPLES.forEach((s, i) => {
        const x = PENS.x0 + i * PENS.dx;
        const sel = ui.sample === s.id;
        const lift = sel ? 18 : 0;
        const top = PENS.base - PENS.h - lift;
        ctx.save();
        // Schaft
        G.rr(ctx, x - 11, top + 34, 22, PENS.h - 40, 6);
        ctx.fillStyle = s.id === 'wasserfest' ? '#3a3d42' : '#eef1f4'; ctx.fill();
        ctx.strokeStyle = 'rgba(80,90,100,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = G.rgba(s.rgb); ctx.fillRect(x - 11, top + 70, 22, 14);
        // Kappe
        G.rr(ctx, x - 12, top, 24, 40, 6); ctx.fillStyle = G.rgba(s.rgb); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x - 8, top + 4, 4, 30);
        ctx.restore();
        G.text(ctx, String(i + 1), x, PENS.base + 20, { size: 15, align: 'center', weight: 800, color: '#34424f' });
        view.addHot('sample:' + s.id, x - 20, top - 4, 40, PENS.h + 26, { kind: 'sample' });
        if (sel) G.highlight(ctx, x - 16, top - 4, 32, PENS.h + 8, 'sel', time);
      });
      G.label(ctx, 'Proben 1–7', PENS.x0 + 3 * PENS.dx, PENS.base + 46, { size: 14 });
      // Bleistift und Kugelschreiber
      const pencilBusy = e.state.op && e.state.op.type === 'line';
      if (!pencilBusy || (e.state.paper.line && e.state.paper.line.tool !== 'pencil')) drawPencil(46, 690, 0);
      if (!pencilBusy || (e.state.paper.line && e.state.paper.line.tool !== 'pen')) drawBallpen(46, 734, 0);
      G.text(ctx, 'Bleistift', 222, 695, { size: 15, color: '#fff', weight: 700 });
      G.text(ctx, 'Kugelschreiber', 222, 739, { size: 15, color: '#fff', weight: 700 });
      view.addHot('tool:pencil', 30, 674, 300, 34, { kind: 'tool' });
      view.addHot('tool:pen', 30, 718, 300, 34, { kind: 'tool' });
      if (ui.tool === 'pencil') G.highlight(ctx, 40, 678, 172, 24, 'sel', time);
      if (ui.tool === 'pen') G.highlight(ctx, 40, 722, 172, 24, 'sel', time);
    }
    function drawPencil(x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#f2c230'; ctx.fillRect(0, -6, 140, 12);
      ctx.fillStyle = '#e5b020'; ctx.fillRect(0, -2, 140, 2);
      ctx.fillStyle = '#e9cfa0'; ctx.beginPath(); ctx.moveTo(140, -6); ctx.lineTo(162, 0); ctx.lineTo(140, 6); ctx.fill();
      ctx.fillStyle = '#3b3b3b'; ctx.beginPath(); ctx.moveTo(156, -1.8); ctx.lineTo(162, 0); ctx.lineTo(156, 1.8); ctx.fill();
      ctx.fillStyle = '#d98aa0'; ctx.fillRect(-12, -6, 12, 12);
      ctx.restore();
    }
    function drawBallpen(x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      G.rr(ctx, 0, -5, 150, 10, 4); ctx.fillStyle = '#d7e3f2'; ctx.fill(); ctx.strokeStyle = '#7c8fa7'; ctx.stroke();
      ctx.fillStyle = '#2440b0'; ctx.fillRect(4, -5, 26, 10);
      ctx.fillStyle = '#9aa6b2'; ctx.beginPath(); ctx.moveTo(150, -4); ctx.lineTo(164, 0); ctx.lineTo(150, 4); ctx.fill();
      ctx.restore();
    }

    function drawJar(e, ui) {
      const ch = e.state.chamber;
      const x0 = JAR.x - JAR.w / 2, x1 = JAR.x + JAR.w / 2;
      // Laufmittel
      if (ch.level > 0) {
        const ly = JAR.bottom - ch.level * PX;
        const col = ch.solvent === 'etoh' ? [235, 228, 200, 0.55] : [190, 220, 245, 0.55];
        const tinted = ch.tint[3] > 0 ? G.mix(col, [90, 70, 120, 0.7], ch.tint[3]) : col;
        ctx.fillStyle = G.rgba(tinted);
        ctx.fillRect(x0 + 4, ly, JAR.w - 8, JAR.bottom - ly);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x0 + 4, ly - 1, JAR.w - 8, 2);
      }
      // Glas
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x0, JAR.top); ctx.lineTo(x0, JAR.bottom - 8); ctx.quadraticCurveTo(x0, JAR.bottom, x0 + 8, JAR.bottom); ctx.lineTo(x1 - 8, JAR.bottom); ctx.quadraticCurveTo(x1, JAR.bottom, x1, JAR.bottom - 8); ctx.lineTo(x1, JAR.top);
      ctx.fillStyle = 'rgba(225,238,248,0.18)'; ctx.fill();
      G.glass(ctx, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x1 - 18, JAR.top + 20, 6, JAR.bottom - JAR.top - 40);
      ctx.restore();
      // Halterung für den Streifen
      ctx.fillStyle = '#7b8792'; ctx.fillRect(x0 - 20, JAR.top - 18, JAR.w + 40, 6);
      // Deckel
      const lidOn = ch.lid;
      ctx.save();
      if (lidOn) { G.rr(ctx, x0 - 12, JAR.top - 12, JAR.w + 24, 10, 3); }
      else { ctx.translate(x1 + 6, BENCH - 150); G.rr(ctx, 0, 0, 9, 150, 3); }
      ctx.fillStyle = 'rgba(205,225,240,0.7)'; ctx.fill(); ctx.strokeStyle = 'rgba(95,120,140,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      G.label(ctx, 'Entwicklungskammer' + (ch.solvent ? ' · ' + (ch.solvent === 'water' ? 'Wasser' : 'Ethanol-Wasser') + ' ' + TL.core.fmt(ch.level, 1) + ' cm' : ' (leer)'), JAR.x, BENCH + 28, { size: 14 });
      view.addHot('chamber', x0 - 10, JAR.top - 24, JAR.w + 20, JAR.bottom - JAR.top + 40, { kind: 'device' });
      if (!lidOn) view.addHot('lid', x1 + 2, BENCH - 156, 22, 156, { kind: 'device' });
      if (ui.targets && ui.targets.includes('chamber')) G.highlight(ctx, x0, JAR.top - 10, JAR.w, JAR.bottom - JAR.top + 10, 'target', time);
      // Skala der Füllhöhe
      ctx.strokeStyle = 'rgba(70,90,110,0.6)'; ctx.fillStyle = 'rgba(70,90,110,0.85)'; ctx.font = '600 10px system-ui, sans-serif';
      for (let cm = 0; cm <= 3; cm++) { const y = JAR.bottom - cm * PX; ctx.beginPath(); ctx.moveTo(x0 + 4, y); ctx.lineTo(x0 + (cm % 1 ? 8 : 14), y); ctx.stroke(); if (cm) ctx.fillText(cm + ' cm', x0 + 16, y + 3); }
    }

    function drawBottles(e, ui) {
      const op = e.state.op;
      for (const id of ['water', 'etoh']) {
        let x = BOTTLES[id], base = BENCH, tilt = 0;
        if (op && op.type === 'fill' && e.state.chamber.solvent === id) {
          const p = clamp(op.t / op.dur, 0, 1);
          const k = Math.sin(Math.PI * p);
          x = lerp(x, JAR.x + JAR.w / 2 + 30, k); base = lerp(base, JAR.top - 40, k); tilt = -1.2 * k;
        }
        ctx.save(); ctx.translate(x, base); ctx.rotate(tilt);
        G.rr(ctx, -34, -140, 68, 140, 10);
        ctx.fillStyle = id === 'etoh' ? 'rgba(246,242,228,0.95)' : 'rgba(232,242,250,0.95)'; ctx.fill();
        ctx.strokeStyle = 'rgba(95,120,140,0.85)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = id === 'etoh' ? 'rgba(235,228,200,0.6)' : 'rgba(190,220,245,0.6)'; ctx.fillRect(-31, -90, 62, 87);
        ctx.fillStyle = '#4b5864'; ctx.fillRect(-14, -158, 28, 20);
        ctx.fillStyle = '#fff'; ctx.fillRect(-30, -128, 60, 40); ctx.strokeStyle = '#9aa6b1'; ctx.lineWidth = 1; ctx.strokeRect(-30, -128, 60, 40);
        G.text(ctx, id === 'water' ? 'Wasser' : 'Ethanol-', 0, -112, { size: 11.5, align: 'center', weight: 700 });
        G.text(ctx, id === 'water' ? 'H₂O' : 'Wasser 1:1', 0, -96, { size: 10.5, align: 'center', weight: 600, color: '#4a5866' });
        if (id === 'etoh') {
          // GHS02 Flamme
          ctx.save(); ctx.translate(0, -62); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#fff'; ctx.fillRect(-13, -13, 26, 26); ctx.strokeStyle = '#d2201c'; ctx.lineWidth = 3; ctx.strokeRect(-13, -13, 26, 26);
          ctx.restore();
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(-6, -54); ctx.quadraticCurveTo(-8, -64, -1, -72); ctx.quadraticCurveTo(0, -64, 4, -66); ctx.quadraticCurveTo(8, -60, 6, -54); ctx.closePath(); ctx.fill();
          ctx.fillRect(-8, -53, 16, 2);
        }
        ctx.restore();
        if (!(op && op.type === 'fill' && e.state.chamber.solvent === id)) {
          view.addHot('solvent:' + id, x - 38, base - 160, 76, 170, { kind: 'solvent' });
          if (ui.solvent === id) G.highlight(ctx, x - 36, base - 156, 72, 158, 'sel', time);
        }
      }
      G.label(ctx, 'Laufmittel', (BOTTLES.water + BOTTLES.etoh) / 2, BENCH + 28, { size: 14 });
      if (op && op.type === 'fill') {
        const p = clamp(op.t / op.dur, 0, 1);
        if (p > 0.3 && p < 0.75) { ctx.strokeStyle = 'rgba(180,210,240,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(JAR.x + JAR.w / 2 - 20, JAR.top - 30); ctx.lineTo(JAR.x + 40, JAR.bottom - 10); ctx.stroke(); }
      }
    }

    function drawWorkMat(e, ui) {
      const p = e.state.paper;
      // Arbeitsunterlage
      ctx.fillStyle = '#c9d3dc'; G.rr(ctx, MAT.x - 40, 130, 6 * PX + 110, MAT.bottom - 130 + 60, 12); ctx.fill();
      ctx.fillStyle = '#d8e0e7'; G.rr(ctx, MAT.x - 34, 136, 6 * PX + 98, MAT.bottom - 136 + 48, 10); ctx.fill();
      G.label(ctx, 'Arbeitsunterlage', MAT.x + 3 * PX, BENCH + 28, { size: 14 });
      const op = e.state.op;
      if (p.state === 'chamber' && !(op && op.type === 'insert')) {
        G.text(ctx, 'Streifen steht in der Kammer', MAT.x + 3 * PX, 350, { size: 15, color: '#6b7987', align: 'center' });
        return;
      }
      let x0 = MAT.x, bottom = MAT.bottom;
      if (op && (op.type === 'insert' || op.type === 'remove')) {
        const k = G.ease(clamp(op.t / op.dur, 0, 1));
        const f = op.type === 'insert' ? k : 1 - k;
        x0 = lerp(MAT.x, PAPER_IN.x, f); bottom = lerp(MAT.bottom, PAPER_IN.bottom, f) - Math.sin(Math.PI * f) * 80;
        if (op.type === 'insert' && f > 0.98) return;
      }
      drawPaper(p, x0, bottom, PX, { now: e.state.time, names: true });
      view.addHot('paper', x0, bottom - 12 * PX, 6 * PX, 12 * PX, { kind: 'paper' });
      if (p.line && p.state === 'bench') {
        CH.PAPER.lanes.forEach((lx, i) => {
          const cx = x0 + lx * PX, cy = bottom - p.line.y * PX;
          view.addHot('lane:' + i, cx - 26, cy - 26, 52, 52, { kind: 'lane' });
          if (ui.sample && !p.lanes[i]) G.highlight(ctx, cx - 14, cy - 14, 28, 28, 'target', time);
        });
      }
      if (!p.line && p.state === 'bench' && ui.tool) {
        for (const yv of CH.LINE_HEIGHTS) {
          const y = bottom - yv * PX;
          ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(31,111,229,0.6)'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 6 * PX, y); ctx.stroke(); ctx.restore();
          G.text(ctx, TL.core.fmt(yv, 1) + ' cm', x0 - 6, y + 4, { size: 11, color: '#1f6fe5', align: 'right' });
          view.addHot('line:' + yv, x0, y - 10, 6 * PX, 20, { kind: 'line' });
        }
      }
      if (e.state.expert) drawRuler(x0 + 6 * PX + 8, bottom, PX);
      // Animation Bleistift / Probe
      if (op && op.type === 'line') {
        const k = clamp(op.t / op.dur, 0, 1);
        const y = bottom - p.line.y * PX;
        if (p.line.tool === 'pencil') drawPencil(x0 + k * 6 * PX - 162, y, 0); else drawBallpen(x0 + k * 6 * PX - 164, y, 0);
      }
      if (op && op.type === 'spot') {
        const k = Math.sin(Math.PI * clamp(op.t / op.dur, 0, 1));
        const lx = x0 + CH.PAPER.lanes[op.lane] * PX, ly = bottom - p.line.y * PX;
        const s = CH.SAMPLE_BY_ID[p.lanes[op.lane].sampleId];
        ctx.save(); ctx.translate(lx, ly - 10 - (1 - k) * 60); ctx.rotate(0.35);
        ctx.fillStyle = G.rgba(s.rgb); G.rr(ctx, -8, -120, 16, 112, 5); ctx.fill();
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(0, 6); ctx.lineTo(5, -8); ctx.fill();
        ctx.restore();
      }
    }

    function drawChamberPaper(e) {
      const p = e.state.paper;
      const op = e.state.op;
      if (p.state !== 'chamber' || (op && op.type === 'insert')) return;
      drawPaper(p, PAPER_IN.x, PAPER_IN.bottom, PX, { now: e.state.time, names: false });
      // Klammer
      ctx.fillStyle = '#5d6873'; ctx.fillRect(JAR.x - 14, PAPER_IN.bottom - 12 * PX - 26, 28, 18);
      // Flüssigkeitsspiegel vor dem Papier (Transparenz)
      const ch = e.state.chamber;
      if (ch.level > 0) {
        const ly = JAR.bottom - ch.level * PX;
        ctx.fillStyle = ch.solvent === 'etoh' ? 'rgba(235,228,200,0.35)' : 'rgba(190,220,245,0.35)';
        ctx.fillRect(PAPER_IN.x - 4, ly, 6 * PX + 8, JAR.bottom - ly);
      }
      if (e.state.expert) drawRuler(PAPER_IN.x - 34, PAPER_IN.bottom, PX);
    }

    function drawBoard(e, ui) {
      const arch = e.state.archive;
      ctx.save();
      G.rr(ctx, BOARD.x, BOARD.y, BOARD.w, 300, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,140,160,0.35)'; ctx.stroke();
      ctx.restore();
      G.text(ctx, 'Vergleich', BOARD.x + 12, BOARD.y + 24, { size: 15, weight: 700, color: '#34424f' });
      if (!arch.length) { G.text(ctx, 'Noch keine abgelegten', BOARD.x + 12, BOARD.y + 54, { size: 13, color: '#6b7987' }); G.text(ctx, 'Chromatogramme', BOARD.x + 12, BOARD.y + 72, { size: 13, color: '#6b7987' }); }
      const s = 17;
      arch.slice(-3).forEach((a, i) => {
        const x = BOARD.x + 14 + i * 70, bottom = BOARD.y + 40 + 12 * s;
        drawPaper(paperFromSnap(a), x, bottom, 9.5, { thumb: true, now: 1e9 });
        G.text(ctx, a.id + (a.quality.valid ? '' : ' ⚠'), x + 28, bottom + 18, { size: 12.5, align: 'center', weight: 700, color: a.quality.valid ? '#34424f' : '#a65200' });
        G.text(ctx, a.solvent === 'water' ? 'Wasser' : 'Eth.-W.', x + 28, bottom + 34, { size: 11.5, align: 'center', color: '#56636f' });
        view.addHot('arch:' + a.id, x - 2, bottom - 12 * 9.5, 62, 12 * 9.5 + 40, { kind: 'archive' });
      });
      if (arch.length) G.text(ctx, arch.length > 3 ? '+ ' + (arch.length - 3) + ' weitere · antippen zum Vergleichen' : 'Antippen zum Vergleichen', BOARD.x + 12, BOARD.y + 288, { size: 11.5, color: '#56636f' });
      view.addHot('compare', BOARD.x, BOARD.y, BOARD.w, 300, { kind: 'compare' });
    }

    function paperFromSnap(a) {
      return { n: a.n, line: a.line, lanes: a.lanes, solvent: a.solvent, flow: a.flow, dissolved: a.dissolved, front: a.front, frontMarked: a.frontMarked, frontAtTop: a.frontAtTop, state: 'removed', removedAt: -1e9, submerged: a.submerged };
    }

    /** Vergleichsansicht (für das Modal): alle abgelegten Chromatogramme nebeneinander. */
    function drawComparison(cv, archive, expert) {
      const s = 26;
      const n = Math.max(1, archive.length);
      const cw = 6 * s + (expert ? 70 : 46);
      cv.width = Math.max(320, n * cw + 30); cv.height = 12 * s + 110;
      const saved = ctx;
      ctx = cv.getContext('2d');
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#f3f6f9'; ctx.fillRect(0, 0, cv.width, cv.height);
        archive.forEach((a, i) => {
          const x = 20 + i * cw;
          drawPaper(paperFromSnap(a), x, 12 * s + 24, s, { now: 1e9, names: true });
          G.text(ctx, `${a.id} · ${a.solvent === 'water' ? 'Wasser' : 'Ethanol-Wasser'}`, x + 3 * s, 12 * s + 74, { size: 12.5, align: 'center', weight: 700 });
          const issues = a.quality.issues.filter((q) => ['penLine', 'submerged', 'short', 'overloaded', 'frontAtTop'].includes(q));
          if (issues.length) G.text(ctx, '⚠ ' + issues.map((q) => ({ penLine: 'Kugelschreiber', submerged: 'Start unter Spiegel', short: 'zu kurz', overloaded: 'überladen', frontAtTop: 'Front am Rand' }[q])).join(', '), x + 3 * s, 12 * s + 92, { size: 11, align: 'center', color: '#a65200' });
          if (expert) drawRuler(x + 6 * s + 4, 12 * s + 24, s);
        });
      } finally { ctx = saved; }
    }

    function frame(dt, e, ui) {
      time += dt;
      view.begin('#dfe6ec');
      G.background(view, BENCH, 'chroma');
      drawPens(e, ui);
      drawWorkMat(e, ui);
      drawJar(e, ui);
      drawChamberPaper(e);
      drawBottles(e, ui);
      drawBoard(e, ui);
      const p = e.state.paper;
      if (p.state === 'chamber' || p.state === 'removed') {
        const run = p.line ? Math.max(0, p.front - p.line.y) : 0;
        G.label(ctx, `Front: ${TL.core.fmt(p.front, 1)} cm über der Unterkante` + (p.line ? ` · ${TL.core.fmt(run, 1)} cm über der Startlinie` : ''), JAR.x, JAR.top - 42, { size: 14, bg: 'rgba(22,32,43,0.85)', color: '#fff', border: null });
      }
      G.clock(ctx, W - 14, H - 18, e.state.time, ui.speed);
    }

    return { view, resize: view.resize, frame, toLogical: view.toLogical, hit: (x, y) => view.hit(x, y), hotspots: view.hotspots, drawComparison, W, H, PX };
  }

  TL.renderChroma = { createRenderer };
})(typeof self !== 'undefined' ? self : this);
