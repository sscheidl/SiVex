/*
 * Trennverfahren – schematisches Teilchenmodell (Canvas 2D)
 *
 * Zeigt einen vergrößerten Ausschnitt des gewählten Gefäßes. Anzahl, Lage und
 * Bewegung der Symbole folgen dem Modellzustand (Füllstand, gelöstes und festes
 * Salz, schwebender und abgesetzter Sand bzw. Eisen, Öl als Schicht oder
 * Tröpfchen, Filter, Verdampfen, Magnet). Symbole sind repräsentativ: keine
 * Teilchenzahlen und keine Größenverhältnisse im Maßstab.
 * Bewegung nur bei laufender Versuchszeit; Pause hält alles an.
 */
(function (root) {
  'use strict';
  const Mo = root.TV.model;
  const { clamp, lerp } = root.LK.core;
  const TAU = Math.PI * 2;
  const W = 300, Hh = 300;
  const BOX = { x0: 10, x1: 290, y0: 14, y1: 286 };
  const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
  const C = { water: '#3d8fe0', na: '#8a4fd0', cl: '#2e9a5a', oil: '#d9a514', sand: '#c9a56b', sandEdge: '#8a6a3a', iron: '#5b6069' };

  const rnd = Math.random;
  function grainShape(seed) {
    const pts = []; let s = seed;
    for (let i = 0; i < 9; i++) { s = (s * 9301 + 49297) % 233280; pts.push(0.78 + 0.3 * (s / 233280)); }
    return pts;
  }

  function createParticleView(canvas, getEngine, getFocus) {
    const ctx = canvas.getContext('2d');
    let focus = null, exp = null;
    let P = null;
    let lref = 1;
    let t = 0;

    function reset() {
      P = { water: [], ions: [], oil: [], gas: [], grains: [], transit: [], drops: [], lattice: 0, latticeShown: 0 };
      lref = 1;
    }
    reset();

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    }

    // ------------------------------------------------------------------ Zielzustand aus dem Modell
    function describeTarget(st, o) {
      const c = o.c;
      const L = Mo.liq(c);
      lref = Math.max(lref, L, 1);
      const isFilter = o.type === 'funnel' && o.paper;
      const liquidFrac = L > 0.02 ? clamp(0.12 + 0.62 * L / lref, 0.12, 0.74) : 0;
      const bedFrac = clamp(Mo.solids(c) > 0.02 ? 0.06 + 0.012 * Math.sqrt(Mo.solids(c) * 4) * 4 : 0, 0, 0.2);
      const sandT = Mo.sand(c), ironT = c.iron;
      const nSand = sandT > 0.05 ? clamp(Math.round(sandT / 4) + 1, 1, 5) : 0;
      const nIron = ironT > 0.05 ? clamp(Math.round(ironT / 1.5) + 1, 1, 4) : 0;
      const fSand = sandT > 0 ? (o.susp.sandC.m + o.susp.sandF.m) / sandT : 0;
      const fIron = ironT > 0 ? o.susp.iron.m / ironT : 0;
      const frontFrac = L > 0 ? Math.max(o.susp.sandC.fv, o.susp.sandF.fv, o.susp.iron.fv) / L : 0;
      const conc = c.water > 0.01 ? c.saltD / c.water : 0;
      return {
        L, liquidFrac, bedFrac, isFilter, nSand, nIron,
        sandSusp: Math.round(nSand * clamp(fSand * 1.15, 0, 1)), ironSusp: Math.round(nIron * clamp(fIron * 1.15, 0, 1)), frontFrac,
        waterShare: L > 0 ? c.water / L : 0, oilShare: L > 0 ? c.oil / L : 0, emul: o.emul,
        ions: Math.round(clamp(conc / 0.36, 0, 1.05) * 14 * (c.water > 0.02 ? 1 : 0)),
        lattice: c.saltS > 0.01 ? clamp(Math.round(4 + c.saltS * 3), 2, 30) : 0,
        evap: o.evap || 0, temp: o.temp, boil: o.boil, agit: o.agit,
        drip: o.type === 'funnel' ? st.drip.F : o.type === 'sep' ? st.drip.S : 0,
        magnet: st.op && st.op.type === 'magnet' && st.op.v === o.id ? st.op : null
      };
    }

    function zones(d) {
      const y1 = BOX.y1;
      if (d.isFilter) {
        const band = 176;
        const liqTop = d.L > 0.02 ? lerp(band - 14, BOX.y0 + 40, clamp(d.L / Math.max(lref, 1), 0, 1)) : band;
        return { filter: true, band, liqTop, liqBot: band - 6, bedTop: band - 6 - (d.nSand + d.nIron > 0 ? 34 : 0), floor: band - 6, below: [band + 12, y1] };
      }
      const bed = d.bedFrac * (y1 - BOX.y0);
      const floor = y1 - bed;
      const liqTop = d.liquidFrac > 0 ? y1 - d.liquidFrac * (y1 - BOX.y0) : floor;
      return { filter: false, liqTop: Math.min(liqTop, floor - 4), liqBot: floor, floor, bedTop: floor };
    }

    // ------------------------------------------------------------------ Abgleich der Symbole
    function reconcile(d, z, dt) {
      const area = Math.max(0, (z.liqBot - z.liqTop)) * (BOX.x1 - BOX.x0);
      const oilLayerShare = d.oilShare * (1 - d.emul);
      const nWater = Math.round(area / 300 * d.waterShare);
      const nOil = Math.round(area / 300 * d.oilShare);
      // Wasser: Überzählige verlassen beim Verdampfen die Oberfläche, sonst verschwinden sie unten (Abfluss)
      while (P.water.length > nWater) {
        const evaporating = d.evap > 0.002;
        let idx = 0;
        if (evaporating) { let best = Infinity; P.water.forEach((p, i) => { if (p.y < best) { best = p.y; idx = i; } }); const p = P.water.splice(idx, 1)[0]; P.gas.push({ x: p.x, y: z.liqTop - 3, vx: (rnd() - 0.5) * 40, vy: -70 - rnd() * 50 }); }
        else { let best = -Infinity; P.water.forEach((p, i) => { if (p.y > best) { best = p.y; idx = i; } }); P.water.splice(idx, 1); }
      }
      while (P.water.length < nWater) P.water.push({ x: lerp(BOX.x0 + 6, BOX.x1 - 6, rnd()), y: lerp(z.liqTop + 4, z.liqBot - 4, rnd()), vx: 0, vy: 0 });
      while (P.oil.length > nOil) P.oil.pop();
      while (P.oil.length < nOil) P.oil.push({ x: lerp(BOX.x0 + 6, BOX.x1 - 6, rnd()), y: z.liqTop + 6, a: rnd() * TAU, cl: Math.floor(rnd() * 12), vx: 0, vy: 0 });
      P.oilLayerShare = oilLayerShare;
      // Ionenpaare (Na⁺ und Cl⁻): beim Auskristallisieren wandern sie zum Kristall, beim Lösen kommen sie heraus
      const latticeBefore = P.lattice;
      P.lattice = d.lattice;
      const nIons = d.ions * 2;
      while (P.ions.length > nIons) {
        const p = P.ions.pop();
        if (d.lattice > 0 && d.lattice >= latticeBefore) P.transit.push({ x: p.x, y: p.y, na: p.na, t: 0 });
      }
      while (P.ions.length < nIons) {
        const na = P.ions.length % 2 === 0;
        const fromLattice = latticeBefore > 0;
        const lx = (BOX.x0 + BOX.x1) / 2, ly = z.floor - 8;
        P.ions.push({ x: fromLattice ? lx + (rnd() - 0.5) * 30 : lerp(BOX.x0 + 8, BOX.x1 - 8, rnd()), y: fromLattice ? ly : lerp(z.liqTop + 6, z.liqBot - 6, rnd()), vx: 0, vy: 0, na });
      }
      // Körner (Sand, Eisen)
      const want = [];
      for (let i = 0; i < d.nSand; i++) want.push({ kind: 'sand', susp: i < d.sandSusp, i });
      for (let i = 0; i < d.nIron; i++) want.push({ kind: 'iron', susp: i < d.ironSusp, i });
      const kept = [];
      for (const w of want) {
        let g = P.grains.find((q) => q.kind === w.kind && q.i === w.i);
        if (!g) g = { kind: w.kind, i: w.i, x: lerp(BOX.x0 + 30, BOX.x1 - 30, rnd()), y: z.bedTop - 14, shape: grainShape(Math.floor(rnd() * 99999)), r: w.kind === 'sand' ? 17 + rnd() * 4 : 13 + rnd() * 3, ph: rnd() * TAU, dots: Array.from({ length: 14 }, () => [rnd() * 1.6 - 0.8, rnd() * 1.6 - 0.8]) };
        g.susp = w.susp;
        kept.push(g);
      }
      P.grains = kept;
    }

    // ------------------------------------------------------------------ Bewegung
    function move(d, z, dt) {
      const jit = (25 + Math.max(0, d.temp - 20) * 0.8) * (1 + d.agit * 2);
      const swirl = d.agit;
      const clampIn = (p, top, bot, pad) => {
        if (p.x < BOX.x0 + pad) { p.x = BOX.x0 + pad; p.vx = Math.abs(p.vx); }
        if (p.x > BOX.x1 - pad) { p.x = BOX.x1 - pad; p.vx = -Math.abs(p.vx); }
        if (p.y < top + pad) { p.y = top + pad; p.vy = Math.abs(p.vy); }
        if (p.y > bot - pad) { p.y = bot - pad; p.vy = -Math.abs(p.vy); }
      };
      const oilTop = z.liqTop, oilBot = z.liqTop + (z.liqBot - z.liqTop) * (P.oilLayerShare || 0);
      for (const p of P.water) {
        p.vx += (rnd() - 0.5) * jit * dt * 6; p.vy += (rnd() - 0.5) * jit * dt * 6;
        p.vx *= 0.9; p.vy *= 0.9;
        if (swirl > 0.2) { const cx = (BOX.x0 + BOX.x1) / 2; p.vx += (p.y - (z.liqTop + z.liqBot) / 2) * swirl * dt * 3; p.vy -= (p.x - cx) * swirl * dt * 1.2; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        clampIn(p, P.oilLayerShare > 0.02 ? oilBot : z.liqTop, z.liqBot, 4);
      }
      for (const p of P.ions) {
        p.vx += (rnd() - 0.5) * jit * dt * 5; p.vy += (rnd() - 0.5) * jit * dt * 5;
        p.vx *= 0.9; p.vy *= 0.9;
        p.x += p.vx * dt; p.y += p.vy * dt;
        clampIn(p, P.oilLayerShare > 0.02 ? oilBot : z.liqTop, z.liqBot, 5);
      }
      // Öl: als Schicht oben oder als Tröpfchen (Ansammlungen vieler Ölteilchen) im Wasser
      const nDrop = Math.round(d.emul * 9);
      const centers = P.dropCenters || (P.dropCenters = Array.from({ length: 9 }, () => ({ x: lerp(BOX.x0 + 30, BOX.x1 - 30, rnd()), y: 0.3 + 0.6 * rnd(), ph: rnd() * TAU })));
      for (const cc of centers) { cc.ph += dt * (0.6 + swirl * 4); cc.y = clamp(cc.y - dt * 0.04 * (1 - d.emul) * 3, 0.05, 0.95); }
      P.oil.forEach((p, i) => {
        const inDrop = d.emul > 0.05 && p.cl < nDrop && i % 3 !== 0;
        let tx, ty;
        if (inDrop) {
          const cc = centers[p.cl];
          const k = i % 7;
          tx = cc.x + Math.cos(k / 7 * TAU + cc.ph * 0.3) * (k ? 8 : 0) + Math.sin(cc.ph) * 6 * swirl;
          ty = lerp(oilBot + 10, z.liqBot - 10, cc.y) + Math.sin(k / 7 * TAU) * (k ? 8 : 0);
          p.x += (tx - p.x) * Math.min(1, dt * 3); p.y += (ty - p.y) * Math.min(1, dt * 3);
          p.a += dt * 0.5;
        } else {
          p.vx += (rnd() - 0.5) * jit * dt * 4; p.vy += (rnd() - 0.5) * jit * dt * 4;
          p.vx *= 0.9; p.vy *= 0.9;
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y > oilBot) p.y -= Math.min(p.y - oilBot, dt * 60);
          clampIn(p, z.liqTop, Math.max(oilBot, z.liqTop + 10), 4);
          p.a += (rnd() - 0.5) * dt * 3;
        }
      });
      // Gas: Wasserteilchen verlassen die Flüssigkeit (weit auseinander, schnell)
      P.gas = P.gas.filter((p) => { p.x += p.vx * dt; p.y += p.vy * dt; return p.y > BOX.y0 - 10 && p.x > BOX.x0 - 10 && p.x < BOX.x1 + 10; });
      P.transit = P.transit.filter((p) => { p.t += dt; const lx = (BOX.x0 + BOX.x1) / 2, ly = z.floor - 10; p.x += (lx - p.x) * Math.min(1, dt * 3); p.y += (ly - p.y) * Math.min(1, dt * 3); return p.t < 0.8; });
      // Körner
      for (const g of P.grains) {
        g.ph += dt * (1 + swirl * 5);
        const slotX = BOX.x0 + 30 + (g.kind === 'iron' ? 22 : 0) + g.i * 50;
        if (d.magnet && g.kind === 'iron' && d.magnet.t > 0.7) {
          const tgtY = BOX.y0 + 26 + g.i * 6;
          g.x += (lerp(BOX.x0 + 110, BOX.x1 - 110, g.i / 4) - g.x) * Math.min(1, dt * 2.5);
          g.y += (tgtY - g.y) * Math.min(1, dt * 2.5);
          continue;
        }
        if (g.susp && !z.filter) {
          const top = Math.max(z.liqTop + g.r, lerp(z.liqBot, z.liqTop, clamp(d.frontFrac, 0, 1)) + g.r * 0.2);
          const tx = slotX + Math.sin(g.ph) * 40 * swirl;
          const ty = lerp(top, z.liqBot - g.r, 0.5 + 0.45 * Math.sin(g.ph * 0.7 + g.i));
          g.x += (tx - g.x) * Math.min(1, dt * (1 + swirl * 3)); g.y += (ty - g.y) * Math.min(1, dt * (0.8 + swirl * 3));
        } else {
          const ty = (z.filter ? z.floor : z.floor + 2) - g.r * 0.8;
          g.x += (slotX - g.x) * Math.min(1, dt * 1.2);
          g.y += Math.min(Math.max(ty - g.y, -dt * 120), dt * 70);
        }
      }
      // Filter: Wasser und gelöste Ionen gehen durch die Poren, Körner bleiben liegen
      if (z.filter && d.drip > 0.01) {
        const rate = clamp(d.drip * 6, 2, 22);
        if (rnd() < dt * rate) {
          const pore = BOX.x0 + 20 + Math.floor(rnd() * 9) * 30;
          const ion = rnd() < (P.ions.length / Math.max(1, P.water.length + P.ions.length)) * 1.4;
          P.drops.push({ x: pore, y: z.band - 4, kind: ion ? (rnd() < 0.5 ? 'na' : 'cl') : 'water', vy: 40 });
        }
      }
      P.drops = P.drops.filter((p) => { p.vy += 120 * dt; p.y += p.vy * dt; return p.y < BOX.y1 + 10; });
    }

    // ------------------------------------------------------------------ Zeichnen
    function frame(wallDt, running) {
      const e = getEngine();
      const st = e.state;
      const id = getFocus();
      const o = st.objs[id];
      if (e !== exp || id !== focus) { exp = e; focus = id; reset(); }
      const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
      const s = Math.min(canvas.width / dpr / W, canvas.height / dpr / Hh);
      ctx.setTransform(dpr * s, 0, 0, dpr * s, (canvas.width - W * s * dpr) / 2, 0);
      ctx.clearRect(-50, -50, W + 100, Hh + 100);
      ctx.fillStyle = '#fbfcfd'; ctx.fillRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
      if (!o || !o.c) { label('Kein Gefäß gewählt'); frameBox(); return; }
      const d = describeTarget(st, o);
      const z = zones(d);
      const dt = running ? Math.min(0.05, wallDt) : 0;
      t += dt;
      reconcile(d, z, dt);
      if (dt > 0) move(d, z, dt);
      // Gasraum (Luft, ggf. gasförmiges Wasser) – leer gezeichnet
      ctx.save();
      ctx.beginPath(); ctx.rect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0); ctx.clip();
      if (d.L > 0.02) {
        ctx.fillStyle = 'rgba(205,228,248,0.55)'; ctx.fillRect(BOX.x0, z.liqTop, BOX.x1 - BOX.x0, z.liqBot - z.liqTop);
        if (P.oilLayerShare > 0.02) { ctx.fillStyle = 'rgba(250,232,170,0.6)'; ctx.fillRect(BOX.x0, z.liqTop, BOX.x1 - BOX.x0, (z.liqBot - z.liqTop) * P.oilLayerShare); }
        ctx.strokeStyle = 'rgba(60,110,160,0.6)'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(BOX.x0, z.liqTop); ctx.lineTo(BOX.x1, z.liqTop); ctx.stroke(); ctx.setLineDash([]);
      }
      if (z.filter) {
        // Filterpapier mit Poren (stark vereinfacht)
        ctx.fillStyle = '#e9e4d8'; ctx.fillRect(BOX.x0, z.band - 6, BOX.x1 - BOX.x0, 12);
        for (let i = 0; i < 9; i++) { const x = BOX.x0 + 20 + i * 30; ctx.fillStyle = '#fbfcfd'; ctx.fillRect(x - 3, z.band - 6, 6, 12); }
        ctx.fillStyle = 'rgba(205,228,248,0.35)'; ctx.fillRect(BOX.x0, z.band + 6, BOX.x1 - BOX.x0, BOX.y1 - z.band - 6);
      } else if (z.floor < BOX.y1) {
        ctx.fillStyle = '#eef0f2'; ctx.fillRect(BOX.x0, z.floor, BOX.x1 - BOX.x0, BOX.y1 - z.floor);
      }
      // Kristallgitter (festes Salz): regelmäßig angeordnete Na⁺ und Cl⁻
      if (P.lattice > 0) {
        const n = P.lattice, cols = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(n * 2)))), rows = Math.ceil(n / cols);
        const cx = (BOX.x0 + BOX.x1) / 2 + (P.grains.length ? 70 : 0), by = (z.filter ? z.floor : z.floor) - 5;
        for (let r = 0; r < rows; r++) for (let c2 = 0; c2 < cols; c2++) {
          if (r * cols + c2 >= n) break;
          const x = cx - cols * 5 + c2 * 10 + 5, y = by - r * 10;
          ion(x, y, (r + c2) % 2 === 0);
        }
      }
      for (const p of P.transit) ion(p.x, p.y, p.na, 0.6);
      for (const g of P.grains) grain(g);
      for (const p of P.water) water(p.x, p.y);
      for (const p of P.ions) ion(p.x, p.y, p.na);
      for (const p of P.oil) oil(p.x, p.y, p.a);
      for (const p of P.gas) water(p.x, p.y, 0.8);
      for (const p of P.drops) { if (p.kind === 'water') water(p.x, p.y); else ion(p.x, p.y, p.kind === 'na'); }
      if (d.magnet) { ctx.fillStyle = '#d63a3a'; ctx.fillRect(BOX.x0 + 90, BOX.y0 + 2, 50, 16); ctx.fillStyle = '#2f9a57'; ctx.fillRect(BOX.x0 + 140, BOX.y0 + 2, 50, 16); }
      ctx.restore();
      // Beschriftung der Bereiche
      ctx.font = `600 11px ${FONT}`; ctx.fillStyle = '#4a5866'; ctx.textAlign = 'left';
      if (d.L > 0.02 && z.liqTop - BOX.y0 > 18) ctx.fillText(d.evap > 0.002 && d.temp > 50 ? 'Luft · Wasser (gasförmig)' : 'Luft', BOX.x0 + 6, BOX.y0 + 14);
      if (z.filter) { ctx.fillText('Filterpapier', BOX.x0 + 6, z.band - 9); ctx.fillText('Filtrat', BOX.x0 + 6, z.band + 24); }
      frameBox();
    }
    function frameBox() { ctx.strokeStyle = '#9aa7b4'; ctx.lineWidth = 1.5; ctx.strokeRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0); }
    function label(text) { ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#66768a'; ctx.textAlign = 'center'; ctx.fillText(text, W / 2, Hh / 2); }
    function water(x, y, a) {
      ctx.globalAlpha = a == null ? 1 : a;
      ctx.fillStyle = C.water; ctx.beginPath(); ctx.arc(x, y, 3.3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - 1, y - 1, 1, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    function ion(x, y, na, a) {
      ctx.globalAlpha = a == null ? 1 : a;
      const r = na ? 3.2 : 4.6;
      ctx.fillStyle = na ? C.na : C.cl; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y); ctx.lineTo(x + r * 0.55, y);
      if (na) { ctx.moveTo(x, y - r * 0.55); ctx.lineTo(x, y + r * 0.55); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function oil(x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = C.oil; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,85,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    }
    function grain(g) {
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.ph * 0.05);
      ctx.beginPath();
      g.shape.forEach((k, i) => { const a = i / g.shape.length * TAU; const x = Math.cos(a) * g.r * k, y = Math.sin(a) * g.r * k * 0.8; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
      ctx.fillStyle = g.kind === 'sand' ? C.sand : C.iron; ctx.fill();
      ctx.strokeStyle = g.kind === 'sand' ? C.sandEdge : '#2c3036'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = g.kind === 'sand' ? 'rgba(110,80,40,0.45)' : 'rgba(220,225,232,0.45)';
      for (const [dx, dy] of g.dots) ctx.fillRect(dx * g.r * 0.6, dy * g.r * 0.5, 1.6, 1.6);
      ctx.restore();
    }

    return { frame, resize, reset };
  }

  /** Beschreibung auf Teilchenebene (Modellinterpretation) für das Gefäß. */
  function modelText(st, o) {
    if (!o || !o.c) return '';
    const c = o.c;
    const L = Mo.liq(c);
    const parts = [];
    if (o.type === 'funnel' && o.paper) parts.push('Die Wasserteilchen und die gelösten Na⁺- und Cl⁻-Teilchen sind viel kleiner als die Poren und gelangen hindurch; die Sandkörner bleiben auf dem Papier liegen.');
    if (Mo.sand(c) > 0.05) {
      const s = (o.susp.sandC.m + o.susp.sandF.m) / Math.max(Mo.sand(c), 1e-6);
      parts.push(L > 0.3 ? (s > 0.1 ? 'Sandkörner (jedes Korn besteht aus sehr vielen Teilchen) sind zwischen den Wasserteilchen verteilt und sinken nach unten.' : 'Die Sandkörner liegen unten; über ihnen bewegen sich nur Wasserteilchen.') : 'Die Sandkörner liegen als Feststoff nebeneinander.');
    }
    if (c.iron > 0.05) parts.push(st.op && st.op.type === 'magnet' && st.op.v === o.id ? 'Nur die Eisenkörner werden zum Magneten gezogen; die anderen Teilchen bleiben, wo sie sind.' : 'Eisenkörner sind feste Verbände aus vielen Eisenteilchen.');
    if (c.saltD > 0.02) parts.push('Das gelöste Kochsalz liegt als einzelne Na⁺- und Cl⁻-Teilchen gleichmäßig zwischen den Wasserteilchen verteilt vor – deshalb ist die Lösung klar. Gelöst ist kein eigener Aggregatzustand.');
    if (c.saltS > 0.02) parts.push(o.evap > 0.002 || o.type === 'dish' ? 'Wenn Wasser verdampft, ordnen sich Na⁺- und Cl⁻-Teilchen regelmäßig zu festen Kristallen an; das Salz schmilzt dabei nicht und wird nicht gasförmig.' : 'Festes Kochsalz: Na⁺- und Cl⁻-Teilchen sind regelmäßig in einem Kristall angeordnet.');
    if (c.oil > 0.05 && c.water > 0.05) parts.push(o.emul > 0.25 ? 'Beim Schütteln wurde das Öl in Tröpfchen zerteilt; jedes Tröpfchen ist eine Ansammlung sehr vieler Ölteilchen. In Ruhe vereinigen sie sich wieder zu einer Schicht.' : 'Öl- und Wasserteilchen mischen sich nicht: Die Ölteilchen bleiben in einem eigenen Bereich oben, weil Öl eine geringere Dichte hat.');
    else if (c.oil > 0.05) parts.push('Nur Ölteilchen.');
    if (o.evap > 0.002 && o.temp > 50) parts.push('Wasserteilchen verlassen die Flüssigkeit und werden gasförmig (Wasserdampf, unsichtbar). Den sichtbaren Dunst bilden winzige Tröpfchen aus wieder kondensiertem Wasser.');
    if (!parts.length) parts.push(L > 0.02 ? 'Nur Wasserteilchen, die sich ständig ungeordnet bewegen.' : 'Das Gefäß ist leer.');
    return parts.join(' ');
  }

  (root.TV = root.TV || {}).particles = { createParticleView, modelText, COLORS: C };
})(typeof self !== 'undefined' ? self : this);
