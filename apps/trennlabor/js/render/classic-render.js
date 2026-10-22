/*
 * Trennlabor – Darstellung „Klassische Trennverfahren“ (Canvas 2D)
 * Zeichnet ausschließlich aus dem Modellzustand (TL.classic). Eigene Zustände
 * sind rein visuell (Kippbewegung beim Gießen, Teilchenbewegung).
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const R = TL.render;
  const { clamp, lerp, smooth, rng } = TL.util;
  const { pm } = TL.classic.helpers;

  const BENCH = 620;
  const BW = 118, BH = 150; // Becherglas 250 mL
  const ML_PX = (BH - 7) * 0.88 / 250;
  const G_PX = 1.6; // Bodensatzhöhe je g (zeichnerisch überhöht)
  const SLOT_X = { bench1: 150, bench2: 330, bench3: 510, filter: 760, sep: 990 };
  const FUN = { x: 760, top: 300, topW: 132, coneH: 96, stemB: 482 };
  const DISH = { x: 990, rim: 432, w: 150, depth: 36 };
  const SEP = { x: 990, top: 150, neck: 175, bodyTop: 205, bodyBottom: 392, w: 112, tap: 430, stemB: 482 };
  const SHELF = { y: 236, x0: 30, x1: 600 };
  const ITEM_X = { water: 85, kettle: 190, hib: 300, magnet: 405, rod: 520 };
  const WG = { R: { x: 640, y: 712 }, E: { x: 820, y: 712 } };
  const SINK = { x: 1140, y: BENCH };

  const WATER = [165, 202, 232, 0.45];
  const OIL = [236, 196, 64, 0.62];
  const DYE = [150, 12, 48];
  const SANDCOL = [205, 172, 118];

  function liquidColor(c) {
    const w = c.water + c.disp;
    let col = WATER.slice();
    if (c.water > 0.5 && c.dye > 0) {
      const conc = c.dye / c.water;
      const a = 1 - Math.exp(-conc * 0.9);
      col = R.mix(col, [DYE[0], DYE[1], DYE[2], 0.92], a);
    }
    if (w > 0.5 && c.disp > 0) col = R.mix(col, [245, 228, 170, 0.75], clamp(c.disp / w * 2.2, 0, 0.85));
    return col;
  }

  function create(stage) {
    const ctx = stage.ctx;
    const vis = { pour: null, t: 0, petals: {}, drag: null };

    function petalsFor(id) {
      if (!vis.petals[id]) { const r = rng(id.charCodeAt(0) * 31 + id.length * 7); vis.petals[id] = Array.from({ length: 40 }, () => ({ u: r(), v: r(), s: 0.6 + r() * 0.8, rot: r() * 6.28, ph: r() * 6.28 })); }
      return vis.petals[id];
    }

    /** Inhalt eines Gefäßes in einen Innenbereich zeichnen (aufrecht). */
    function contents(c, inner, id, opts) {
      const o = Object.assign({ mlPx: ML_PX, gPx: G_PX }, opts);
      const settled = { sand: c.p.sandC.set + c.p.sandF.set, iron: c.p.iron.set, salt: c.p.saltX.set, plant: c.p.petals.set + c.p.frag.set };
      const sedTot = settled.sand + settled.iron + settled.salt + settled.plant * 3;
      let y = inner.bottom;
      // Bodensatz in Schichten: Eisen, Sand, Salzkristalle, Pflanzenreste
      const layers = [['iron', settled.iron], ['sand', settled.sand], ['salt', settled.salt], ['plant', settled.plant * 3]];
      if (sedTot > 0.02) {
        for (const [kind, m] of layers) {
          if (m < 0.01) continue;
          const hh = Math.max(1.2, m * o.gPx);
          R.sediment(ctx, inner, y - hh, y, kind === 'sand' && settled.salt > settled.sand * 0.3 ? 'mix' : kind, id.length + kind.length);
          y -= hh;
        }
      }
      const aqV = c.water + c.disp;
      const oilV = Math.max(0, c.oil - c.disp);
      const aqH = aqV * o.mlPx, oilH = oilV * o.mlPx;
      const aqTop = y - aqH, oilTop = aqTop - oilH;
      if (aqH > 0.3) {
        const col = liquidColor(c);
        R.liquidBand(ctx, inner, aqTop, y + 0.5, col, { meniscus: oilH < 0.3 });
        // Trübung durch aufgewirbelte Feststoffe
        const susSolid = c.p.sandC.sus + c.p.sandF.sus + c.p.iron.sus + c.p.saltX.sus + c.p.frag.sus;
        const turb = aqV > 0.5 ? susSolid / aqV * 100 : 0;
        R.turbidity(ctx, inner, aqTop + 2, y, clamp(turb / 5, 0, 1), c.p.iron.sus > c.p.sandC.sus ? [70, 72, 78, 1] : SANDCOL.concat(1), vis.t, id.length * 13);
        // Emulsion: Öltröpfchen
        if (c.disp > 0.2) {
          const r = rng(77 + id.length);
          const n = Math.min(160, Math.round(c.disp * 4));
          ctx.save(); ctx.fillStyle = 'rgba(240,200,80,0.75)';
          for (let i = 0; i < n; i++) {
            const xx = inner.left + r() * (inner.right - inner.left);
            const yy = aqTop + 3 + ((r() + vis.t * 0.03 * (0.3 + r())) % 1) * (aqH - 4);
            const s = 1 + r() * 2.4;
            ctx.beginPath(); ctx.arc(xx, yy, s, 0, 6.28); ctx.fill();
          }
          ctx.restore();
        }
        // Blüten: schwebend/oben schwimmend; Farbschlieren beim Ausziehen
        const petalSus = c.p.petals.sus;
        if (petalSus > 0.02) {
          const ps = petalsFor(id);
          const n = Math.min(40, Math.round(petalSus * 8));
          for (let i = 0; i < n; i++) {
            const p = ps[i];
            const xx = inner.left + 8 + p.u * (inner.right - inner.left - 16) + Math.sin(vis.t * 0.5 + p.ph) * 2;
            const yy = aqTop + 6 + p.v * Math.max(4, aqH * 0.5 - 6);
            if (c.petalDye > 1) {
              const k = TL.classic.extractK(c.T);
              const glow = clamp(k * 260 * (c.petalDye / Math.max(0.1, c.p.petals.set + c.p.petals.sus + c.p.frag.sus)) / 100, 0, 0.55);
              const g = ctx.createRadialGradient(xx, yy + 6, 1, xx, yy + 10, 18);
              g.addColorStop(0, `rgba(150,12,48,${glow})`); g.addColorStop(1, 'rgba(150,12,48,0)');
              ctx.fillStyle = g; ctx.fillRect(xx - 18, yy - 8, 36, 36);
            }
            drawPetal(xx, yy, p.s * 7, p.rot + Math.sin(vis.t * 0.4 + p.ph) * 0.2);
          }
        }
      } else if (c.p.petals.sus + c.p.petals.set > 0.02 && aqV < 0.5) {
        // trockene Blüten liegen im Glas
        const ps = petalsFor(id);
        const n = Math.min(40, Math.round((c.p.petals.sus + c.p.petals.set) * 8));
        for (let i = 0; i < n; i++) { const p = ps[i]; drawPetal(inner.left + 10 + p.u * (inner.right - inner.left - 20), inner.bottom - 5 - p.v * 14, p.s * 7, p.rot); }
      }
      if (oilH > 0.3) {
        R.liquidBand(ctx, inner, oilTop, aqTop + 0.5, OIL, { meniscus: true });
        ctx.save(); ctx.strokeStyle = 'rgba(160,120,20,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(inner.left, aqTop); ctx.lineTo(inner.right, aqTop); ctx.stroke(); ctx.restore();
      }
      const surface = oilH > 0.3 ? oilTop : aqH > 0.3 ? aqTop : y;
      // Ungelöstes Salz in Flüssigkeit sichtbar als Körnchen am Boden
      return { surface, sedTop: y };
    }

    function drawPetal(x, y, s, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = 'rgba(110,18,38,0.92)';
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(170,40,70,0.6)'; ctx.beginPath(); ctx.ellipse(-s * 0.2, -s * 0.1, s * 0.5, s * 0.18, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    const scaleMarks = (yb) => [[50, yb - 3 - 50 * ML_PX], [100, yb - 3 - 100 * ML_PX], [150, yb - 3 - 150 * ML_PX], [200, yb - 3 - 200 * ML_PX], [250, yb - 3 - 250 * ML_PX]];

    function drawBeaker(lab, v, sel) {
      const pose = poseOf(lab, v);
      if (pose.angle) return drawTilted(lab, v, pose, sel);
      const x = pose.x, yb = pose.yb;
      let surf = yb;
      R.beaker(ctx, x, yb, BW, BH, { scale: scaleMarks(yb) }, (inner) => {
        const r = contents(v.c, inner, v.id);
        surf = r.surface;
        drawToolInside(lab, v.id, inner, r);
      });
      stage.hit(v.id, x - BW / 2 - 6, yb - BH - 10, BW + 12, BH + 16, lab.nameOf(v.id));
      if (sel === v.id) R.selection(ctx, x - BW / 2, yb - BH, BW, BH, vis.t);
      R.label(ctx, lab.nameOf(v.id).replace('Becherglas', 'Becherglas'), x, yb + 24, { size: 12.5 });
      return surf;
    }

    function drawToolInside(lab, id, inner, r) {
      const op = lab.state.op;
      if (!op) return;
      if (op.type === 'stir' && op.target === id) {
        const a = Math.sin(op.t * 9) * 0.35;
        ctx.save(); ctx.translate((inner.left + inner.right) / 2 + Math.sin(op.t * 9) * 18, inner.top - 40); ctx.rotate(a * 0.3);
        ctx.fillStyle = 'rgba(220,235,245,0.9)'; ctx.strokeStyle = 'rgba(120,140,160,0.9)'; ctx.lineWidth = 1;
        ctx.fillRect(-3, 0, 6, inner.bottom - inner.top + 30); ctx.strokeRect(-3, 0, 6, inner.bottom - inner.top + 30);
        ctx.restore();
        // Wirbel
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse((inner.left + inner.right) / 2, lerp(r.surface, inner.bottom, 0.3 + i * 0.2), 30 - i * 6, 4, 0, op.t * 6 + i, op.t * 6 + i + 2.5); ctx.stroke(); }
        ctx.restore();
      }
      if (op.type === 'magnet' && op.target === id) drawMagnetIn(inner, op);
    }

    function drawMagnetIn(inner, op) {
      const p = clamp(op.t / op.dur, 0, 1);
      const dip = Math.sin(p * Math.PI);
      const x = lerp(inner.left + 25, inner.right - 25, (Math.sin(p * Math.PI * 3) + 1) / 2);
      const y = lerp(inner.top - 60, inner.bottom - 46, dip);
      drawMagnet(x, y, 0, p);
    }
    function drawMagnet(x, y, rot, p) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
      ctx.fillStyle = 'rgba(230,240,248,0.5)'; R.roundRect(ctx, -16, -6, 32, 52, 6); ctx.fill();
      ctx.fillStyle = '#c0392b'; ctx.fillRect(-12, 0, 24, 20); ctx.fillStyle = '#2c5aa0'; ctx.fillRect(-12, 20, 24, 20);
      ctx.fillStyle = '#fff'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('N', 0, 14); ctx.fillText('S', 0, 34);
      if (p > 0.3) { const r = rng(5); ctx.fillStyle = '#3a3e45'; for (let i = 0; i < 30 * p; i++) ctx.fillRect(-12 + r() * 24, 38 + r() * 6, 2, 2); }
      ctx.restore();
    }

    /** Lage eines Becherglases: normal oder beim Ausgießen angehoben und gekippt. */
    function poseOf(lab, v) {
      const x = SLOT_X[v.place] || (vis.moveFrom && vis.moveFrom.id === v.id ? vis.moveFrom.x : 330);
      const base = { x, yb: BENCH, angle: 0 };
      if (v.place === 'moving' && lab.state.op && lab.state.op.type === 'move') {
        const op = lab.state.op;
        const p = smooth(op.t / op.dur);
        const x0 = SLOT_X[op.from], x1 = SLOT_X[op.to];
        return { x: lerp(x0, x1, p), yb: BENCH - Math.sin(p * Math.PI) * 60, angle: 0 };
      }
      if (vis.pour && vis.pour.from === v.id && vis.pour.p > 0.001) {
        const tp = targetPoint(lab, vis.pour.to);
        const p = smooth(vis.pour.p);
        const c = v.c;
        const fill = clamp((c.water + c.oil) / 250, 0, 1);
        const ang = (vis.pour.mode === 'all' ? 1.35 : 1.0) + (1 - fill) * 0.55;
        // Ausgießpunkt (Schnabel = obere rechte Ecke) über dem Ziel
        const lipX = tp.x - 14, lipY = tp.y - 30;
        return { x: lerp(x, lipX - BW / 2, p), yb: lerp(BENCH, lipY + BH, p), angle: ang * p, lipX: lerp(x + BW / 2, lipX, p), lipY: lerp(BENCH - BH, lipY, p) };
      }
      return base;
    }

    function drawTilted(lab, v, pose, sel) {
      const c = v.c;
      ctx.save();
      ctx.translate(pose.lipX, pose.lipY);
      ctx.rotate(pose.angle);
      // lokales System: Schnabel im Ursprung, Becherglas links unten davon
      ctx.save();
      ctx.translate(-BW / 2, BH);
      R.beaker(ctx, 0, 0, BW, BH, {}, (inner) => {
        const liquid = c.water + c.oil;
        // Flüssigkeit mit waagerechter Oberfläche: im gedrehten System schräg
        ctx.save();
        ctx.rotate(-pose.angle);
        const col = c.oil > c.water ? OIL : liquidColor(c);
        if (liquid > 0.3) {
          ctx.fillStyle = R.rgba(col, Math.max(0.35, col[3]));
          // Oberfläche knapp unter dem Schnabel (Weltkoordinaten relativ zum Becherglasboden)
          const lip = { x: BW / 2, y: -BH };
          const cs = Math.cos(pose.angle), sn = Math.sin(pose.angle);
          const lipWy = lip.x * sn + lip.y * cs;
          const depth = Math.min(160, 40 + liquid * 0.6);
          ctx.fillRect(-300, lipWy + 3, 600, depth + 300);
          const susSolid = c.p.sandC.sus + c.p.sandF.sus + c.p.iron.sus;
          if (susSolid > 0.05) { ctx.fillStyle = R.rgba(SANDCOL, clamp(susSolid / Math.max(1, c.water) * 100 / 5, 0, 1) * 0.5); ctx.fillRect(-300, lipWy + 3, 600, depth + 300); }
        }
        ctx.restore();
        const sed = c.p.sandC.set + c.p.sandF.set + c.p.iron.set + c.p.saltX.set;
        if (sed > 0.05) R.sediment(ctx, inner, inner.bottom - sed * G_PX, inner.bottom, c.p.iron.set > c.p.sandC.set ? 'iron' : 'sand', 3);
      });
      ctx.restore();
      ctx.restore();
      stage.hit(v.id, pose.lipX - BW - 20, pose.lipY - 20, BW + 30, BH + 40, lab.nameOf(v.id));
      void sel;
    }

    function targetPoint(lab, id) {
      if (lab.state.vessels[id]) { const v = lab.state.vessels[id]; return { x: SLOT_X[v.place] || 330, y: BENCH - BH }; }
      if (id === 'F') return { x: FUN.x - 20, y: FUN.top };
      if (id === 'D') return { x: DISH.x - 30, y: DISH.rim - 4 };
      if (id === 'S') return { x: SEP.x, y: SEP.top - 6 };
      if (id === 'waste') return { x: SINK.x - 10, y: SINK.y - 30 };
      return { x: 600, y: 400 };
    }
    function surfaceY(lab, id) {
      if (lab.state.vessels[id]) { const v = lab.state.vessels[id]; return BENCH - 3 - (v.c.water + v.c.oil) * ML_PX - 4; }
      if (id === 'F') return FUN.top + FUN.coneH * 0.75;
      if (id === 'D') return DISH.rim + DISH.depth - 8;
      if (id === 'S') return SEP.bodyBottom - 20;
      return SINK.y - 6;
    }

    function drawStream(lab) {
      const op = lab.state.op;
      if (!vis.pour || vis.pour.p < 0.95 || !op || op.type !== 'pour') return;
      const src = lab.state.vessels[op.from];
      if (!src && op.from !== 'S' && op.from !== 'D') return;
      const pose = src ? poseOf(lab, src) : null;
      const sx = pose ? pose.lipX : SEP.x + 20, sy = pose ? pose.lipY + 2 : SEP.top;
      const ty = surfaceY(lab, op.to);
      const c = src ? src.c : lab.container(op.from);
      const col = c.oil - c.disp > 0.3 ? OIL : liquidColor(c);
      const rate = op.waiting ? 0 : op.mode === 'fast' ? 5 : op.mode === 'all' ? 4 : 2.6;
      if (!rate) return;
      ctx.save();
      ctx.strokeStyle = R.rgba(col, Math.max(0.55, col[3] + 0.25));
      ctx.lineWidth = rate; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 10, sy + 10, sx + 12, ty); ctx.stroke();
      const sus = c.p.sandC.sus + c.p.sandF.sus + c.p.iron.sus;
      if (sus > 0.05 || op.sedT) { ctx.strokeStyle = R.rgba(SANDCOL, 0.7); ctx.setLineDash([2, 4]); ctx.lineDashOffset = -vis.t * 60; ctx.lineWidth = rate * 0.6; ctx.stroke(); }
      ctx.restore();
    }

    // ---------------------------------------------------------- Stationen
    function drawFilter(lab, sel) {
      const st = lab.state;
      if (!st.F) return;
      R.stand(ctx, FUN.x + 120, 250, BENCH);
      R.clampArm(ctx, FUN.x + 120, FUN.top + 30, FUN.x + 40);
      // Ring
      ctx.save(); ctx.strokeStyle = '#59636d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(FUN.x, FUN.top + 30, 52, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      const F = st.F;
      const ins = st.insert;
      const op = st.op;
      const insertP = op && op.type === 'insert' ? clamp(op.t / op.dur, 0, 1) : ins ? 1 : 0;
      const shownIns = op && op.type === 'insert' ? op.insert : ins;
      const removing = op && op.type === 'removeInsert' ? clamp(op.t / op.dur, 0, 1) : 0;
      const top = FUN.top, half = FUN.topW / 2, ch = FUN.coneH;
      const cone = () => { ctx.beginPath(); ctx.moveTo(FUN.x - half, top); ctx.lineTo(FUN.x - 6, top + ch); ctx.lineTo(FUN.x + 6, top + ch); ctx.lineTo(FUN.x + half, top); };
      if (shownIns !== 'sieve') {
        ctx.save(); ctx.fillStyle = 'rgba(225,236,245,0.35)'; cone(); ctx.closePath(); ctx.fill(); ctx.restore();
        // Filterpapier
        if (shownIns === 'paper' || shownIns === 'paperFlat') {
          ctx.save(); ctx.globalAlpha = insertP * (1 - removing);
          const off = -removing * 80;
          ctx.translate(0, off);
          ctx.fillStyle = '#f7f4ec'; ctx.strokeStyle = '#d6cfbf'; ctx.lineWidth = 1;
          if (shownIns === 'paper') {
            ctx.beginPath(); ctx.moveTo(FUN.x - half + 8, top - 6); ctx.lineTo(FUN.x, top + ch - 10); ctx.lineTo(FUN.x + half - 8, top - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(180,170,150,0.6)'; ctx.beginPath(); ctx.moveTo(FUN.x - 20, top - 4); ctx.lineTo(FUN.x, top + ch - 12); ctx.moveTo(FUN.x + 18, top - 4); ctx.lineTo(FUN.x, top + ch - 12); ctx.stroke();
          } else {
            // ungefaltet: liegt nicht an, Spalt an der Seite
            ctx.beginPath(); ctx.moveTo(FUN.x - half + 22, top - 18); ctx.quadraticCurveTo(FUN.x - 30, top + ch - 10, FUN.x + 4, top + ch - 26); ctx.quadraticCurveTo(FUN.x + 30, top + ch * 0.4, FUN.x + half - 4, top - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
          }
          ctx.restore();
        }
        // Inhalt im Trichter (Flüssigkeit über dem Papier, Rückstand)
        const liq = F.water + F.oil;
        const sol = TL.classic.helpers.solidsMass(F);
        if (liq > 0.2 || sol > 0.02) {
          ctx.save(); cone(); ctx.closePath(); ctx.clip();
          const fillH = Math.min(ch - 6, Math.sqrt(liq / 55) * (ch - 8));
          const solH = Math.min(ch - 6, Math.sqrt(sol / 20) * (ch * 0.55));
          const yl = top + ch - 6;
          if (sol > 0.02) {
            const kind = F.p.iron.set + F.p.iron.sus > F.p.sandC.set ? 'iron' : (F.p.petals.set + F.p.petals.sus) > 0.2 ? 'plant' : F.p.saltX.set > (F.p.sandC.set + F.p.sandF.set) ? 'salt' : (F.p.saltX.set > 0.3 ? 'mix' : 'sand');
            ctx.fillStyle = R.grainPattern(ctx, kind);
            ctx.fillRect(FUN.x - half, yl - solH, half * 2, solH + 10);
          }
          if (liq > 0.2) {
            const col = F.oil > F.water ? OIL : liquidColor(F);
            ctx.fillStyle = R.rgba(col, Math.max(0.3, col[3]));
            ctx.fillRect(FUN.x - half, yl - fillH, half * 2, fillH + 10);
            const sus = F.p.sandC.sus + F.p.sandF.sus;
            if (sus > 0.05) { ctx.fillStyle = R.rgba(SANDCOL, clamp(sus / liq * 100 / 5, 0, 0.8)); ctx.fillRect(FUN.x - half, yl - fillH, half * 2, fillH + 10); }
          }
          ctx.restore();
        }
        // Glas
        ctx.save(); ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.4; cone(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(FUN.x - 6, top + ch); ctx.lineTo(FUN.x - 4, FUN.stemB); ctx.lineTo(FUN.x + 4, FUN.stemB); ctx.lineTo(FUN.x + 6, top + ch); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(FUN.x, top, half, 5, 0, 0, Math.PI * 2); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(105,125,145,0.6)'; ctx.stroke();
        ctx.restore();
      } else {
        drawSieve(F, insertP * (1 - removing));
      }
      // Durchfluss
      const rec = lab.vesselAt('filter');
      const yEnd = rec ? BENCH - 3 - (rec.c.water + rec.c.oil) * ML_PX - 3 : BENCH - 2;
      const col = F.oil > F.water ? OIL : liquidColor(F);
      R.drips(ctx, FUN.x, FUN.stemB, Math.max(FUN.stemB + 4, yEnd), st.fx.funnelFlow, col.slice(0, 3).concat(Math.max(0.6, col[3])), vis.t, 0.3);
      if (st.fx.funnelBypass) { ctx.save(); ctx.fillStyle = R.rgba(SANDCOL, 0.7); ctx.fillRect(FUN.x - 1, FUN.stemB, 2, 6); ctx.restore(); }
      if (!rec) {
        // Pfütze auf dem Tisch
        const tbl = lab.container('table');
        const pud = tbl.water + tbl.oil;
        if (pud > 0.5) { ctx.save(); ctx.fillStyle = 'rgba(160,190,215,0.45)'; ctx.beginPath(); ctx.ellipse(FUN.x, BENCH + 4, Math.min(70, 12 + pud * 0.6), 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        stage.hit('slot:filter', FUN.x - BW / 2, BENCH - BH, BW, BH, 'Platz unter dem Trichter');
        if (vis.drag) R.targetMark(ctx, FUN.x - BW / 2, BENCH - BH, BW, BH);
        ctx.save(); ctx.strokeStyle = 'rgba(80,100,120,0.35)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; R.roundRect(ctx, FUN.x - BW / 2, BENCH - BH, BW, BH, 8); ctx.stroke(); ctx.restore();
      }
      stage.hit('F', FUN.x - half - 10, top - 26, half * 2 + 20, FUN.stemB - top + 26, 'Trichter');
      if (sel === 'F') R.selection(ctx, FUN.x - half, top - 20, half * 2, FUN.stemB - top + 20, vis.t);
      R.label(ctx, shownIns === 'sieve' ? 'Teesieb' : 'Trichter' + (ins === 'paper' ? ' mit Filterpapier' : ins === 'paperFlat' ? ' (Papier ungefaltet)' : ''), FUN.x, top - 40, { size: 12.5 });
    }

    function drawSieve(F, alpha) {
      ctx.save(); ctx.globalAlpha = Math.max(0.15, alpha);
      const cx = FUN.x, cy = FUN.top + 10;
      ctx.fillStyle = 'rgba(200,205,210,0.35)';
      ctx.beginPath(); ctx.ellipse(cx, cy, 62, 6, 0, 0, Math.PI); ctx.lineTo(cx - 62, cy); ctx.arc(cx, cy, 62, Math.PI, 0, true); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 62, 0, Math.PI); ctx.closePath();
      ctx.save(); ctx.clip();
      const liq = F.water;
      if (liq > 0.2) { ctx.fillStyle = R.rgba(liquidColor(F), 0.7); ctx.fillRect(cx - 62, cy + 62 - Math.min(55, liq * 0.8), 124, 70); }
      const pl = F.p.petals.set + F.p.petals.sus;
      if (pl > 0.05) { ctx.fillStyle = R.grainPattern(ctx, 'plant'); ctx.fillRect(cx - 62, cy + 62 - Math.min(40, 8 + pl * 6), 124, 60); }
      ctx.strokeStyle = 'rgba(90,95,100,0.35)'; ctx.lineWidth = 0.7;
      for (let i = -62; i < 62; i += 5) { ctx.beginPath(); ctx.moveTo(cx + i, cy); ctx.lineTo(cx + i, cy + 64); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - 64, cy + i + 62); ctx.lineTo(cx + 64, cy + i + 62); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = '#7d858d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 62, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 62, cy); ctx.lineTo(cx + 62, cy); ctx.stroke();
      ctx.restore();
    }

    function drawDish(lab, sel) {
      const st = lab.state;
      if (!st.D) return;
      const D = st.D;
      const gauze = DISH.rim + DISH.depth + 2;
      // Dreifuß
      ctx.save(); ctx.strokeStyle = '#4e5965'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(DISH.x - 70, gauze); ctx.lineTo(DISH.x - 84, BENCH); ctx.moveTo(DISH.x + 70, gauze); ctx.lineTo(DISH.x + 84, BENCH); ctx.moveTo(DISH.x, gauze); ctx.lineTo(DISH.x + 6, BENCH - 8); ctx.stroke();
      ctx.fillStyle = '#6a737c'; ctx.fillRect(DISH.x - 82, gauze, 164, 5);
      ctx.fillStyle = st.burner && D.T > 80 ? 'rgba(210,90,40,0.6)' : 'rgba(130,135,140,0.8)'; ctx.fillRect(DISH.x - 40, gauze, 80, 4);
      ctx.restore();
      R.burner(ctx, DISH.x, BENCH, st.burner, vis.t);
      // Schale
      const w2 = DISH.w / 2;
      const bowl = () => { ctx.beginPath(); ctx.moveTo(DISH.x - w2, DISH.rim); ctx.quadraticCurveTo(DISH.x - w2 + 10, DISH.rim + DISH.depth + 6, DISH.x, DISH.rim + DISH.depth); ctx.quadraticCurveTo(DISH.x + w2 - 10, DISH.rim + DISH.depth + 6, DISH.x + w2, DISH.rim); };
      ctx.save(); bowl(); ctx.closePath(); ctx.fillStyle = '#f3f1ec'; ctx.fill(); ctx.restore();
      ctx.save(); bowl(); ctx.closePath(); ctx.clip();
      const liq = D.water + D.oil;
      const sol = TL.classic.helpers.solidsMass(D);
      const yb = DISH.rim + DISH.depth;
      if (liq > 0.05) {
        const h = Math.min(DISH.depth - 2, Math.sqrt(liq / 70) * (DISH.depth - 3));
        const col = liquidColor(D);
        ctx.fillStyle = R.rgba(col, Math.max(0.4, col[3] + 0.15)); ctx.fillRect(DISH.x - w2, yb - h, DISH.w, h + 8);
        const sus = D.p.sandC.sus + D.p.sandF.sus;
        if (sus > 0.02) { ctx.fillStyle = R.rgba(SANDCOL, clamp(sus / liq * 20, 0, 0.7)); ctx.fillRect(DISH.x - w2, yb - h, DISH.w, h + 8); }
        if (D.T > 95 && st.burner) {
          const r = rng(Math.floor(vis.t * 8));
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          for (let i = 0; i < 6 * st.burner; i++) { ctx.beginPath(); ctx.arc(DISH.x - w2 + 20 + r() * (DISH.w - 40), yb - r() * h, 1 + r() * 2, 0, 6.28); ctx.fill(); }
        }
      }
      const sand = D.p.sandC.set + D.p.sandF.set + D.p.sandC.sus + D.p.sandF.sus;
      if (sand > 0.05) { ctx.fillStyle = R.grainPattern(ctx, 'sand'); ctx.fillRect(DISH.x - w2 * 0.6, yb - Math.min(12, sand * 1.2), DISH.w * 0.6, 14); }
      const xs = pm(D, 'saltX');
      if (xs > 0.01) {
        // Kristalle: zuerst am Rand (Verdunstungsrand), dann am Boden
        const n = Math.min(160, Math.round(xs * 30));
        TL.render.crystals(ctx, DISH.x, yb - 4, w2 * (liq > 3 ? 0.85 : 0.6), 4, n, 23);
        if (liq > 1) TL.render.crystals(ctx, DISH.x, DISH.rim + 8, w2 * 0.9, 2, Math.round(n * 0.25), 41);
      }
      if (D.dye > 1 && liq < 1) { ctx.fillStyle = 'rgba(120,10,40,0.6)'; ctx.fillRect(DISH.x - w2 * 0.5, yb - 4, DISH.w * 0.5, 6); }
      ctx.restore();
      ctx.save(); bowl(); ctx.strokeStyle = '#b9b4a8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(DISH.x, DISH.rim, w2, 5, 0, 0, Math.PI * 2); ctx.strokeStyle = '#cfc9bd'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      // Dampf und Spritzer
      if (st.fx.steam > 0) {
        ctx.save();
        for (let i = 0; i < 7; i++) {
          const ph = (vis.t * 0.35 + i / 7) % 1;
          ctx.fillStyle = `rgba(255,255,255,${0.42 * (1 - ph) * st.fx.steam})`;
          ctx.beginPath(); ctx.arc(DISH.x - 40 + i * 13 + Math.sin(vis.t + i) * 8, DISH.rim - ph * 90, 8 + ph * 18, 0, 6.28); ctx.fill();
        }
        ctx.restore();
      }
      if (st.fx.spatter) {
        const r = rng(Math.floor(vis.t * 20));
        ctx.save(); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(120,130,140,0.8)';
        for (let i = 0; i < 8; i++) { const x = DISH.x + (r() - 0.5) * 180, y = DISH.rim - r() * 60; ctx.fillRect(x, y, 2.5, 2.5); ctx.strokeRect(x, y, 2.5, 2.5); }
        ctx.restore();
      }
      if (D.T > 25) R.label(ctx, `${Math.round(D.T)} °C`, DISH.x + w2 + 30, DISH.rim + 8, { size: 12, bg: D.T > 60 ? 'rgba(255,236,224,0.95)' : undefined });
      stage.hit('D', DISH.x - w2 - 6, DISH.rim - 20, DISH.w + 12, DISH.depth + 30, 'Abdampfschale');
      stage.hit('burner', DISH.x - 40, BENCH - 100, 80, 100, 'Brenner');
      if (sel === 'D' || sel === 'burner') R.selection(ctx, DISH.x - w2, DISH.rim - 14, DISH.w, BENCH - DISH.rim + 14, vis.t);
      R.label(ctx, 'Abdampfschale mit Brenner', DISH.x, BENCH + 24, { size: 12.5 });
    }

    function drawSep(lab, sel) {
      const st = lab.state;
      if (!st.S) return;
      const S = st.S;
      R.stand(ctx, SEP.x + 110, 110, BENCH);
      R.clampArm(ctx, SEP.x + 110, SEP.neck + 6, SEP.x + 14);
      const w2 = SEP.w / 2;
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(SEP.x - 12, SEP.neck); ctx.lineTo(SEP.x - 12, SEP.bodyTop - 8);
        ctx.bezierCurveTo(SEP.x - w2 - 8, SEP.bodyTop + 10, SEP.x - w2, SEP.bodyTop + 80, SEP.x - 9, SEP.bodyBottom);
        ctx.lineTo(SEP.x - 5, SEP.tap - 14); ctx.lineTo(SEP.x + 5, SEP.tap - 14); ctx.lineTo(SEP.x + 9, SEP.bodyBottom);
        ctx.bezierCurveTo(SEP.x + w2, SEP.bodyTop + 80, SEP.x + w2 + 8, SEP.bodyTop + 10, SEP.x + 12, SEP.bodyTop - 8);
        ctx.lineTo(SEP.x + 12, SEP.neck);
      };
      ctx.save(); body(); ctx.closePath(); ctx.fillStyle = 'rgba(225,236,245,0.35)'; ctx.fill(); ctx.restore();
      // Inhalt: Volumen → Höhe über Flächenprofil (Birne)
      ctx.save(); body(); ctx.closePath(); ctx.clip();
      const yOf = (vol) => {
        // Kumuliertes Volumen von unten; Querschnitt ~ Breite² (vereinfacht numerisch)
        let v = 0, y = SEP.tap - 14;
        while (y > SEP.neck && v < vol) {
          const wy = widthAt(y);
          v += wy * wy * 0.0105; y -= 1;
        }
        return y;
      };
      const aq = S.water + S.disp, oilL = Math.max(0, S.oil - S.disp);
      const yAq = yOf(aq), yOil = yOf(aq + oilL);
      if (aq > 0.1) {
        const col = liquidColor(S);
        ctx.fillStyle = R.rgba(col, Math.max(0.35, col[3])); ctx.fillRect(SEP.x - w2 - 10, yAq, SEP.w + 20, SEP.tap - yAq);
        if (S.disp > 0.2) {
          const r = rng(19); ctx.fillStyle = 'rgba(240,200,80,0.8)';
          for (let i = 0; i < Math.min(140, S.disp * 4); i++) { const yy = yAq + ((r() + vis.t * 0.02 * (0.3 + r())) % 1) * (SEP.tap - 14 - yAq); const ww = widthAt(yy) / 2; ctx.beginPath(); ctx.arc(SEP.x + (r() - 0.5) * 2 * ww, yy, 1 + r() * 2, 0, 6.28); ctx.fill(); }
        }
      }
      if (oilL > 0.1) {
        ctx.fillStyle = R.rgba(OIL, 0.68); ctx.fillRect(SEP.x - w2 - 10, yOil, SEP.w + 20, yAq - yOil);
        ctx.strokeStyle = 'rgba(160,120,20,0.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(SEP.x - w2, yAq); ctx.lineTo(SEP.x + w2, yAq); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); body(); ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(SEP.x - w2 + 12, SEP.bodyTop + 20, 5, 90);
      // Auslauf und Hahn
      ctx.beginPath(); ctx.moveTo(SEP.x - 4, SEP.tap + 10); ctx.lineTo(SEP.x - 3, SEP.stemB); ctx.lineTo(SEP.x + 3, SEP.stemB); ctx.lineTo(SEP.x + 4, SEP.tap + 10); ctx.stroke();
      ctx.restore();
      const open = st.tap;
      ctx.save(); ctx.translate(SEP.x, SEP.tap);
      ctx.fillStyle = 'rgba(210,225,235,0.9)'; ctx.strokeStyle = '#6d7f90'; ctx.lineWidth = 1.5;
      R.roundRect(ctx, -9, -14, 18, 26, 4); ctx.fill(); ctx.stroke();
      ctx.rotate(open ? (open < 0.5 ? Math.PI / 4 : Math.PI / 2) : 0);
      ctx.fillStyle = open ? '#1e8e5a' : '#c0392b'; R.roundRect(ctx, -24, -4, 48, 8, 3); ctx.fill();
      ctx.restore();
      // Stopfen
      if (st.stopper) { ctx.save(); ctx.fillStyle = '#3a6ea5'; R.roundRect(ctx, SEP.x - 15, SEP.top - 14, 30, 22, 5); ctx.fill(); ctx.restore(); }
      else { ctx.save(); ctx.fillStyle = '#3a6ea5'; R.roundRect(ctx, SEP.x + 70, BENCH - 24, 30, 22, 5); ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.strokeStyle = 'rgba(105,125,145,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SEP.x - 12, SEP.neck); ctx.lineTo(SEP.x - 12, SEP.top); ctx.moveTo(SEP.x + 12, SEP.neck); ctx.lineTo(SEP.x + 12, SEP.top); ctx.stroke(); ctx.restore();
      // Auslauf
      const rec = lab.vesselAt('sep');
      const yEnd = rec ? BENCH - 3 - (rec.c.water + rec.c.oil) * ML_PX - 3 : BENCH - 2;
      const outCol = S.water + S.disp > 0.05 ? liquidColor(S) : OIL;
      R.drips(ctx, SEP.x, SEP.stemB, Math.max(SEP.stemB + 4, yEnd), st.fx.sepFlow * 2.2, outCol.slice(0, 3).concat(0.75), vis.t, 0.1);
      if (st.op && st.op.type === 'shake') { /* Schütteln wird durch Schwenken dargestellt */ }
      if (!rec) {
        stage.hit('slot:sep', SEP.x - BW / 2, BENCH - BH, BW, BH, 'Platz unter dem Scheidetrichter');
        if (vis.drag) R.targetMark(ctx, SEP.x - BW / 2, BENCH - BH, BW, BH);
        ctx.save(); ctx.strokeStyle = 'rgba(80,100,120,0.35)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; R.roundRect(ctx, SEP.x - BW / 2, BENCH - BH, BW, BH, 8); ctx.stroke(); ctx.restore();
        const tbl = lab.container('table');
        const pud = tbl.water + tbl.oil;
        if (pud > 0.5) { ctx.save(); ctx.fillStyle = 'rgba(200,190,140,0.45)'; ctx.beginPath(); ctx.ellipse(SEP.x, BENCH + 4, Math.min(70, 12 + pud * 0.6), 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      }
      stage.hit('S', SEP.x - w2 - 14, SEP.top - 20, SEP.w + 28, SEP.stemB - SEP.top + 20, 'Scheidetrichter');
      if (sel === 'S') R.selection(ctx, SEP.x - w2 - 6, SEP.top - 16, SEP.w + 12, SEP.stemB - SEP.top + 16, vis.t);
      R.label(ctx, `Scheidetrichter · Hahn ${open ? (open < 0.5 ? 'tropfenweise' : 'offen') : 'zu'}${st.stopper ? ' · Stopfen auf' : ''}`, SEP.x, SEP.top - 36, { size: 12 });
    }
    function widthAt(y) {
      // Breite des Scheidetrichters (Birnenform) in Abhängigkeit von y
      if (y <= SEP.bodyTop - 8) return 24;
      if (y >= SEP.bodyBottom) return lerp(18, 10, clamp((y - SEP.bodyBottom) / (SEP.tap - 14 - SEP.bodyBottom), 0, 1));
      const u = (y - (SEP.bodyTop - 8)) / (SEP.bodyBottom - SEP.bodyTop + 8);
      return lerp(24, SEP.w, Math.sin(Math.min(1, u * 1.6) * Math.PI / 2)) * (u > 0.62 ? lerp(1, 0.16, (u - 0.62) / 0.38) : 1);
    }

    function drawShelf(lab, sel) {
      const eq = lab.state.equip;
      ctx.save();
      ctx.fillStyle = '#c8d1d9'; R.roundRect(ctx, SHELF.x0, SHELF.y, SHELF.x1 - SHELF.x0, 12, 3); ctx.fill();
      ctx.fillStyle = '#aeb9c3'; ctx.fillRect(SHELF.x0 + 20, SHELF.y + 12, 8, 24); ctx.fillRect(SHELF.x1 - 28, SHELF.y + 12, 8, 24);
      ctx.restore();
      const y = SHELF.y;
      const op = lab.state.op;
      // Spritzflasche
      if (eq.water) {
        const x = ITEM_X.water;
        const active = op && op.type === 'water' && op.temp < 50;
        ctx.save();
        if (active) { const tp = targetPoint(lab, op.to); ctx.translate(tp.x - 60, tp.y - 70); ctx.rotate(0.5); ctx.translate(-x, -y); }
        ctx.fillStyle = 'rgba(236,244,250,0.85)'; ctx.strokeStyle = '#8796a4'; ctx.lineWidth = 1.5;
        R.roundRect(ctx, x - 22, y - 78, 44, 78, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = R.rgba(WATER, 0.6); ctx.fillRect(x - 20, y - 50, 40, 48);
        ctx.fillStyle = '#e6e9ec'; ctx.fillRect(x - 8, y - 92, 16, 14);
        ctx.strokeStyle = '#8796a4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 92); ctx.quadraticCurveTo(x + 4, y - 112, x + 26, y - 108); ctx.stroke();
        ctx.restore();
        if (active) { const tp = targetPoint(lab, op.to); ctx.save(); ctx.strokeStyle = R.rgba(WATER, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tp.x - 20, tp.y - 70); ctx.quadraticCurveTo(tp.x, tp.y - 50, tp.x + 6, surfaceY(lab, op.to)); ctx.stroke(); ctx.restore(); }
        stage.hit('water', x - 30, y - 115, 62, 118, 'Spritzflasche (kaltes Wasser)');
        if (sel === 'water') R.selection(ctx, x - 26, y - 112, 56, 112, vis.t);
        R.text(ctx, 'Wasser', x, y + 22, { size: 11.5, weight: 600, color: '#4a5866' });
      }
      if (eq.kettle) {
        const x = ITEM_X.kettle;
        const active = op && op.type === 'water' && op.temp > 50;
        ctx.save();
        if (active) { const tp = targetPoint(lab, op.to); ctx.translate(tp.x - 75, tp.y - 60); ctx.rotate(0.55); ctx.translate(-x, -y); }
        ctx.fillStyle = '#e9edf0'; ctx.strokeStyle = '#7d8a96'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x - 26, y - 70); ctx.lineTo(x + 24, y - 70); ctx.lineTo(x + 30, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 26, y - 60); ctx.lineTo(x + 44, y - 74); ctx.stroke();
        ctx.fillStyle = '#2d3a46'; ctx.fillRect(x - 34, y - 64, 8, 50);
        ctx.fillStyle = '#e0703c'; ctx.beginPath(); ctx.arc(x - 6, y - 20, 4, 0, 6.28); ctx.fill();
        ctx.restore();
        if (!active) for (let i = 0; i < 3; i++) { const ph = (vis.t * 0.4 + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x + 44 + ph * 10, y - 80 - ph * 40, 5 + ph * 8, 0, 6.28); ctx.fill(); }
        if (active) { const tp = targetPoint(lab, op.to); ctx.save(); ctx.strokeStyle = R.rgba(WATER, 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tp.x - 12, tp.y - 50); ctx.quadraticCurveTo(tp.x, tp.y - 30, tp.x + 4, surfaceY(lab, op.to)); ctx.stroke(); ctx.restore(); }
        stage.hit('kettle', x - 38, y - 88, 86, 90, 'Wasserkocher (heißes Wasser)');
        if (sel === 'kettle') R.selection(ctx, x - 36, y - 84, 82, 84, vis.t);
        R.text(ctx, 'Wasserkocher ~90 °C', x, y + 22, { size: 11.5, weight: 600, color: '#4a5866' });
      }
      if (eq.hibiscus) {
        const x = ITEM_X.hib;
        ctx.save();
        ctx.fillStyle = 'rgba(236,240,244,0.8)'; ctx.strokeStyle = '#8796a4'; ctx.lineWidth = 1.5;
        R.roundRect(ctx, x - 30, y - 64, 60, 64, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b8402c'; R.roundRect(ctx, x - 32, y - 72, 64, 12, 4); ctx.fill();
        const left = lab.state.hibiscusStock;
        const r = rng(3);
        for (let i = 0; i < Math.round(left * 4); i++) drawPetal(x - 22 + r() * 44, y - 8 - r() * Math.min(48, 6 + left * 5), 6, r() * 6);
        ctx.restore();
        if (op && op.type === 'hibiscus') {
          const tp = targetPoint(lab, op.to); const p = clamp(op.t / op.dur, 0, 1);
          for (let i = 0; i < 6; i++) drawPetal(lerp(x, tp.x + (i - 3) * 6, p), lerp(y - 70, tp.y + 20, p) + i * 4, 6, i);
        }
        stage.hit('hib', x - 36, y - 78, 72, 80, 'Hibiskusblüten');
        if (sel === 'hib') R.selection(ctx, x - 34, y - 76, 68, 76, vis.t);
        R.text(ctx, `Hibiskus (${TL.util.fmt(left, 0)} g)`, x, y + 22, { size: 11.5, weight: 600, color: '#4a5866' });
      }
      if (eq.magnet) {
        const x = ITEM_X.magnet;
        if (!(op && op.type === 'magnet')) drawMagnet(x, y - 50, 0, 0);
        stage.hit('magnet', x - 26, y - 64, 52, 66, 'Magnet');
        if (sel === 'magnet') R.selection(ctx, x - 22, y - 60, 44, 60, vis.t);
        R.text(ctx, 'Magnet', x, y + 22, { size: 11.5, weight: 600, color: '#4a5866' });
      }
      if (eq.rod) {
        const x = ITEM_X.rod;
        if (!(op && op.type === 'stir')) { ctx.save(); ctx.fillStyle = 'rgba(220,235,245,0.9)'; ctx.strokeStyle = 'rgba(120,140,160,0.9)'; ctx.translate(x, y - 4); ctx.rotate(-0.35); ctx.fillRect(-3, -90, 6, 90); ctx.strokeRect(-3, -90, 6, 90); ctx.restore(); }
        R.text(ctx, 'Glasstab', x, y + 22, { size: 11.5, weight: 600, color: '#4a5866' });
      }
    }

    function drawWatchGlass(lab, id, sel) {
      const c = lab.container(id);
      if (!c) return;
      const { x, y } = WG[id];
      ctx.save();
      ctx.fillStyle = 'rgba(225,236,245,0.6)'; ctx.strokeStyle = 'rgba(105,125,145,0.8)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, 62, 13, 0, 0, Math.PI); ctx.ellipse(x, y, 62, 6, 0, Math.PI, 0, true); ctx.fill(); ctx.stroke();
      const m = TL.classic.helpers.solidsMass(c);
      if (m > 0.02) {
        const kind = pm(c, 'iron') > m * 0.5 ? 'iron' : (pm(c, 'petals') + pm(c, 'frag')) > m * 0.5 ? 'plant' : pm(c, 'saltX') > m * 0.5 ? 'salt' : 'sand';
        ctx.fillStyle = R.grainPattern(ctx, kind);
        ctx.beginPath(); ctx.ellipse(x, y + 2, Math.min(48, 14 + m * 2.4), Math.min(8, 3 + m * 0.4), 0, 0, Math.PI * 2); ctx.fill();
        if (id === 'R') { ctx.fillStyle = 'rgba(247,244,236,0.7)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 56, 8, 0, 0, Math.PI * 2); ctx.globalCompositeOperation = 'destination-over'; ctx.fill(); }
      }
      ctx.restore();
      stage.hit(id, x - 66, y - 22, 132, 40, lab.nameOf(id));
      if (sel === id) R.selection(ctx, x - 64, y - 18, 128, 34, vis.t);
      R.text(ctx, id === 'E' ? 'Uhrglas (Eisen)' : 'Uhrglas (Rückstand)', x, y + 30, { size: 11.5, weight: 600, color: '#4a5866' });
    }

    function drawSink(lab, sel) {
      ctx.save();
      ctx.fillStyle = '#9aa6b1'; R.roundRect(ctx, SINK.x - 60, SINK.y - 30, 120, 34, 6); ctx.fill();
      ctx.fillStyle = '#6d7984'; R.roundRect(ctx, SINK.x - 52, SINK.y - 24, 104, 22, 5); ctx.fill();
      ctx.fillStyle = '#3f4952'; ctx.beginPath(); ctx.arc(SINK.x, SINK.y - 13, 4, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#8f9aa5'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(SINK.x + 40, SINK.y - 30); ctx.lineTo(SINK.x + 40, SINK.y - 90); ctx.quadraticCurveTo(SINK.x + 40, SINK.y - 104, SINK.x + 22, SINK.y - 104); ctx.stroke();
      ctx.restore();
      stage.hit('waste', SINK.x - 64, SINK.y - 110, 128, 116, 'Ausguss');
      if (sel === 'waste') R.selection(ctx, SINK.x - 60, SINK.y - 106, 120, 108, vis.t);
      R.label(ctx, 'Ausguss', SINK.x, BENCH + 24, { size: 12.5 });
    }

    // ---------------------------------------------------------- Bild
    function frame(lab, ui, dt) {
      vis.t += dt;
      const st = lab.state;
      const op = st.op;
      // Kippbewegung beim Gießen (rein visuell)
      if (op && op.type === 'pour' && st.vessels[op.from]) {
        if (!vis.pour || vis.pour.from !== op.from) vis.pour = { from: op.from, to: op.to, mode: op.mode, p: 0 };
        vis.pour.to = op.to; vis.pour.mode = op.mode;
        vis.pour.p = Math.min(1, vis.pour.p + dt * 3.5);
      } else if (vis.pour) {
        vis.pour.p -= dt * 3.5;
        if (vis.pour.p <= 0) vis.pour = null;
      }
      vis.drag = ui.drag || null;
      R.background(ctx, BENCH);
      const sel = ui.selected;
      drawShelf(lab, sel);
      drawSink(lab, sel);
      drawWatchGlass(lab, 'R', sel);
      drawWatchGlass(lab, 'E', sel);
      drawDish(lab, sel);
      drawSep(lab, sel);
      drawFilter(lab, sel);
      // Bechergläser: zuerst die stehenden, das gekippte zuletzt
      const vs = Object.values(st.vessels);
      const tilted = vs.filter((v) => vis.pour && vis.pour.from === v.id);
      for (const v of vs.filter((x) => !tilted.includes(x))) drawBeaker(lab, v, sel);
      for (const v of tilted) drawBeaker(lab, v, sel);
      drawStream(lab);
      // Zieldarstellung beim Ziehen
      if (ui.drag && ui.drag.target) { const h = stage.hits.find((x) => x.id === ui.drag.target); if (h) R.targetMark(ctx, h.x, h.y, h.w, h.h); }
      // Tisch-Pfütze allgemein
      const tbl = lab.container('table');
      if (tbl.water + tbl.oil > 0.5 && !vis.puddleNote) { /* gezeichnet bei Trichter/Scheidetrichter */ }
      if (ui.drag && ui.drag.ghost) {
        ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = 'rgba(31,111,229,0.2)'; ctx.strokeStyle = 'rgba(31,111,229,0.8)'; ctx.lineWidth = 2;
        R.roundRect(ctx, ui.drag.ghost.x - 40, ui.drag.ghost.y - 50, 80, 100, 10); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }

    return { frame, vis, BENCH };
  }

  TL.render.classic = { create, SLOT_X };
})(typeof self !== 'undefined' ? self : this);
