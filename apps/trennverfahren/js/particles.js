/*
 * Trennverfahren – schematisches Teilchenmodell (Canvas 2D)
 *
 * Zeigt einen vergrößerten Ausschnitt des gewählten Gefäßes. Anzahl, Lage und
 * Bewegung der Symbole folgen dem Modellzustand (Füllstand, gelöstes und festes
 * Salz, schwebender und abgesetzter Sand bzw. Eisen, Öl als Schicht oder
 * Tröpfchen, Filter, Verdampfen, Magnet). Symbole sind repräsentativ: keine
 * Teilchenzahlen und keine Größenverhältnisse im Maßstab.
 *
 * Verteilung: Jedes Teilchen hat einen Platz relativ zu seiner Phase (u, v in 0…1;
 * Ölphase, Wasserphase, Bodensatz) und bewegt sich thermisch um ihn herum. Die Plätze
 * wandern selbst langsam ungeordnet (Diffusion in Phasenkoordinaten). So bleibt jede
 * Phase bei jedem Füllstand gleichmäßig gefüllt – es entstehen keine Reihen am Rand.
 * Symbole wie in „Aggregatzustände“: Wasserteilchen als blaue Dreiecke.
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
  const C = { water: '#2f7fd6', waterEdge: '#17508f', waterHi: '#7fb6f0', na: '#8a4fd0', cl: '#2e9a5a', oil: '#d9a514', oilEdge: '#8a6400', sand: '#c9a56b', sandEdge: '#8a6a3a', iron: '#5b6069' };
  /** Symbolgrößen in Weltpixeln des 300er-Ausschnitts (Cl⁻ größer als Na⁺). */
  const SZ = { water: 7, na: 6.3, cl: 8.3, oilL: 9.5, oilW: 4, ion: 14.6 };
  /** Fläche je Symbol in der Flüssigkeit (Weltpixel²): bestimmt die Anzahl. */
  const AREA = { water: 290, oil: 300 };
  /** Höchstzahl gelöster Ionenpaare (bei gesättigter Lösung) und Ionen im festen Salz je g. */
  const ION_PAIRS = 36, LATTICE_PER_G = 10, LATTICE_MAX = 96;
  /** Bezugsfläche für die Ionenzahl: so viel Flüssigkeit zeigt bei Sättigung ION_PAIRS Paare. */
  const ION_AREA = 280 * 200;

  /**
   * Vergleichsbilder für Versuch 3 (Reinstoff / Stoffgemisch): feste Zustände, die nicht aus dem
   * laufenden Versuch stammen, aber dieselbe Darstellung nutzen.
   */
  const ref = (id, name, c, obs, text) => ({ id, name, ref: true, type: 'beaker', c: Object.assign({ water: 0, oil: 0, sandC: 0, sandF: 0, iron: 0, saltS: 0, saltD: 0 }, c), susp: { sandC: { m: 0, fv: 0 }, sandF: { m: 0, fv: 0 }, iron: { m: 0, fv: 0 }, saltS: { m: 0, fv: 0 } }, emul: 0, agit: 0, temp: 20, evap: 0, boil: false, obs, text });
  const REF = {
    'ref:water': ref('ref:water', 'Vergleich: reines Wasser (Reinstoff)', { water: 40 }, 'Klare, farblose Flüssigkeit (Vergleichsbild, nicht aus dem Versuch).',
      'Reinstoff: Es gibt nur eine Teilchensorte, die Wassermoleküle. Sie bewegen sich ständig ungeordnet.'),
    'ref:salt': ref('ref:salt', 'Vergleich: festes Kochsalz (Reinstoff)', { saltS: 8 }, 'Weiße, feste Kristalle (Vergleichsbild, nicht aus dem Versuch).',
      'Reinstoff (Verbindung aus Natrium und Chlor): Na⁺- und Cl⁻-Ionen sind regelmäßig in einem Ionengitter angeordnet. Es gibt keine „Kochsalzmoleküle“.'),
    'ref:sol': ref('ref:sol', 'Vergleich: Kochsalzlösung (homogenes Gemisch)', { water: 40, saltD: 8 }, 'Klare, farblose Flüssigkeit – sie sieht aus wie reines Wasser (Vergleichsbild).',
      'Homogenes Gemisch aus zwei Stoffen: Einzelne Na⁺- und Cl⁻-Ionen sind gleichmäßig zwischen den Wassermolekülen verteilt. Gelöst ist kein eigener Aggregatzustand – das Wasser ist flüssig, das Salz ist nicht geschmolzen.')
  };

  const rnd = Math.random;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
  /** Niedrige Diskrepanz (R2-Folge): gleichmäßige, aber nicht gitterförmige Startplätze. */
  const R2 = (i) => [((0.5 + i * 0.7548776662) % 1 + 1) % 1, ((0.5 + i * 0.5698402910) % 1 + 1) % 1];
  function seeded(seed) { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function grainShape(seed) {
    const r = seeded(seed), pts = [];
    for (let i = 0; i < 9; i++) pts.push(0.8 + 0.28 * r());
    return pts;
  }

  /** Grundmengen der Darstellung aus dem Gefäßzustand (ohne Zeichnen; auch für Tests). */
  function counts(o) {
    const c = o.c;
    const sandT = Mo.sand(c), ironT = c.iron;
    const conc = c.water > 0.01 ? c.saltD / c.water : 0;
    return {
      sand: sandT > 0.05 ? clamp(Math.ceil(sandT / 1.6), 1, 12) : 0,
      iron: ironT > 0.02 ? clamp(Math.ceil(ironT / 0.8 - 1e-9), 1, 8) : 0,
      pairs: c.water > 0.02 ? Math.round(clamp(conc / 0.36, 0, 1.05) * ION_PAIRS) : 0,
      lattice: c.saltS > 0.01 ? clamp(Math.round(c.saltS * LATTICE_PER_G), 4, LATTICE_MAX) : 0
    };
  }

  function createParticleView(canvas, getEngine, getFocus) {
    const ctx = canvas.getContext('2d');
    let focus = null, exp = null;
    let P = null;
    let lref = 1;
    let t = 0;
    let seq = {};

    function reset() {
      P = { water: [], ions: [], oil: [], gas: [], grains: [], leaving: [], transit: [], drops: [], dc: null, lattice: 0 };
      lref = 1; seq = {};
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
      const n = counts(o);
      const sandT = Mo.sand(c), ironT = c.iron;
      const fSand = sandT > 0 ? (o.susp.sandC.m + o.susp.sandF.m) / sandT : 0;
      const fIron = ironT > 0 ? o.susp.iron.m / ironT : 0;
      return {
        L, isFilter,
        liquidFrac: L > 0.02 ? clamp(0.14 + 0.62 * L / lref, 0.14, 0.76) : 0,
        nSand: n.sand, nIron: n.iron,
        sandSusp: L > 0.3 && !isFilter ? Math.round(n.sand * clamp(fSand * 1.1, 0, 1)) : 0,
        ironSusp: L > 0.3 && !isFilter ? Math.round(n.iron * clamp(fIron * 1.1, 0, 1)) : 0,
        frontFrac: L > 0 ? Math.max(o.susp.sandC.fv, o.susp.sandF.fv, o.susp.iron.fv) / L : 0,
        waterShare: L > 0 ? c.water / L : 0, oilShare: L > 0 ? c.oil / L : 0, emul: c.oil > 0.05 && c.water > 0.05 ? o.emul : 0,
        ions: n.pairs, lattice: n.lattice,
        evap: o.evap || 0, temp: o.temp, agit: o.agit,
        drip: o.type === 'funnel' ? st.drip.F : o.type === 'sep' ? st.drip.S : 0,
        magnet: st.op && st.op.type === 'magnet' && st.op.v === o.id ? st.op : null,
        magdrop: st.op && st.op.type === 'magdrop' && st.op.v === o.id ? st.op : null
      };
    }

    // ------------------------------------------------------------------ Bodensatz (Körner und Kristalle) anordnen
    /**
     * Abgesetzte Körner und festes Salz werden von unten nach oben in Reihen gepackt.
     * Liegen Körner vor, ist das Salz in kleinen Kristallen zwischen ihnen verteilt (Gemenge);
     * sonst bildet es wenige große Kristalle auf dem Boden.
     */
    function bedLayout(d, floor) {
      const items = [];
      const settled = P.grains.filter((g) => !g.susp);
      const crystals = [];
      let left = P.lattice;
      if (left > 0) {
        if (settled.length) { while (left > 0) { const k = Math.min(6, left); crystals.push({ n: k, cols: 2 }); left -= k; } }
        else if (left <= 30) crystals.push({ n: left, cols: clamp(Math.ceil(Math.sqrt(left * 1.4)), 2, 7) });
        else { while (left > 0) { const k = Math.min(16, left); crystals.push({ n: k, cols: 4 }); left -= k; } }
      }
      for (const cr of crystals) { cr.rows = Math.ceil(cr.n / cr.cols); cr.w = cr.cols * SZ.ion + 6; cr.h = cr.rows * SZ.ion + 4; }
      // Reihenfolge: Körner und Kristalle abwechselnd (Gemenge), stabil über den Index
      const gs = settled.slice().sort((a, b) => a.order - b.order);
      const per = crystals.length && gs.length ? Math.max(1, Math.round(gs.length / crystals.length)) : 0;
      let ci = 0;
      gs.forEach((g, i) => {
        items.push({ g, w: g.r * 1.75, h: g.r * 1.55 });
        if (per && (i + 1) % per === 0 && ci < crystals.length) { const cr = crystals[ci++]; items.push({ cr, w: cr.w, h: cr.h }); }
      });
      while (ci < crystals.length) { const cr = crystals[ci++]; items.push({ cr, w: cr.w, h: cr.h }); }
      // Reihen packen, zentriert
      const width = BOX.x1 - BOX.x0 - 8;
      const rows = [];
      let row = { items: [], w: 0, h: 0 };
      for (const it of items) {
        if (row.items.length && row.w + it.w > width) { rows.push(row); row = { items: [], w: 0, h: 0 }; }
        row.items.push(it); row.w += it.w; row.h = Math.max(row.h, it.h);
      }
      if (row.items.length) rows.push(row);
      let y = floor;
      rows.forEach((r, ri) => {
        let x = clamp((BOX.x0 + BOX.x1) / 2 - r.w / 2 + (ri % 2 ? 9 : 0), BOX.x0 + 4, Math.max(BOX.x0 + 4, BOX.x1 - 4 - r.w));
        for (const it of r.items) {
          it.x = x + it.w / 2; it.y = y - (it.cr ? it.h / 2 : it.h * 0.48);
          x += it.w;
        }
        y -= r.h * (ri === 0 ? 0.93 : 0.86);
      });
      return { items, top: rows.length ? y : floor, height: floor - (rows.length ? y : floor) };
    }

    function zones(d) {
      const y1 = BOX.y1;
      if (d.isFilter) {
        const band = 176;
        const liqTop = d.L > 0.02 ? lerp(band - 14, BOX.y0 + 40, clamp(d.L / Math.max(lref, 1), 0, 1)) : band;
        return { filter: true, band, liqTop, liqBot: band - 6, floor: band - 6 };
      }
      const liqTop = d.liquidFrac > 0 ? y1 - d.liquidFrac * (y1 - BOX.y0) : y1;
      return { filter: false, liqTop, liqBot: y1, floor: y1 };
    }

    // ------------------------------------------------------------------ Abgleich der Symbole
    const newPt = (kind, extra) => { const i = seq[kind] = (seq[kind] || 0) + 1; const [u, v] = R2(i + (kind === 'oil' ? 400 : kind === 'ion' ? 800 : 0)); return Object.assign({ u, v, ox: 0, oy: 0, vx: 0, vy: 0, a: rnd() * TAU, x: null, y: null }, extra); };

    function reconcile(d, z, bedTop) {
      const liqH = Math.max(0, bedTop - z.liqTop);
      const area = liqH * (BOX.x1 - BOX.x0);
      // Wasserphase einschließlich der Fläche, die Öltröpfchen darin verdecken (dort ausgeblendet)
      const waterArea = area * (d.waterShare + d.oilShare * d.emul);
      const nWater = d.L > 0.02 && d.waterShare > 0.005 ? Math.round(waterArea / AREA.water * (d.waterShare > 0 ? 1 : 0)) : 0;
      const nOil = d.L > 0.02 ? Math.round(area / AREA.oil * d.oilShare) : 0;
      // Wasser: Überzählige werden zufällig gewählt (sonst verarmt eine Seite der Phase); beim
      // Verdampfen steigen sie sichtbar aus der Oberfläche auf
      while (P.water.length > nWater) {
        const p = P.water.splice(Math.floor(rnd() * P.water.length), 1)[0];
        if (d.evap > 0.002) P.gas.push({ x: p.x == null ? lerp(BOX.x0, BOX.x1, p.u) : p.x, y: z.liqTop - 4, vx: (rnd() - 0.5) * 50, vy: -70 - rnd() * 60, a: p.a });
      }
      while (P.water.length < nWater) P.water.push(newPt('water'));
      while (P.oil.length > nOil) P.oil.pop();
      while (P.oil.length < nOil) P.oil.push(newPt('oil', { k: P.oil.length }));
      P.oil.forEach((p, i) => { p.k = i; });
      // Ionenpaare: beim Auskristallisieren wandern sie zum Kristall, beim Lösen kommen sie heraus
      const latticeBefore = P.lattice;
      P.lattice = d.lattice;
      // Ionenzahl folgt der Konzentration und der sichtbaren Flüssigkeitsmenge (gleiche Dichte bei gleicher Konzentration)
      const nIons = Math.round(d.ions * clamp(area * d.waterShare / ION_AREA, 0, 1.3)) * 2;
      while (P.ions.length > nIons) {
        const p = P.ions.pop();
        if (d.lattice > 0 && d.lattice >= latticeBefore && p.x != null) P.transit.push({ x: p.x, y: p.y, na: p.na, t: 0 });
      }
      while (P.ions.length < nIons) {
        const na = P.ions.length % 2 === 0;
        const p = newPt('ion', { na });
        if (latticeBefore > 0) { p.x = lerp(BOX.x0 + 60, BOX.x1 - 60, rnd()); p.y = bedTop - 6; }
        P.ions.push(p);
      }
      // Körner (Sand, Eisen): Eisen, das der Magnet herauszieht, wandert zum Magneten und verlässt das Bild
      const want = [];
      for (let i = 0; i < d.nSand; i++) want.push({ kind: 'sand', susp: i < d.sandSusp, i });
      for (let i = 0; i < d.nIron; i++) want.push({ kind: 'iron', susp: i < d.ironSusp, i });
      const kept = [];
      for (const w of want) {
        let g = P.grains.find((q) => q.kind === w.kind && q.i === w.i);
        if (!g) {
          const sd = Math.floor(rnd() * 99999);
          g = { kind: w.kind, i: w.i, order: w.kind === 'sand' ? w.i * 2 : w.i * 2 + 1 + (w.i % 3), shape: grainShape(sd), r: w.kind === 'sand' ? 20 + (sd % 6) : 15 + (sd % 4), rot: rnd() * TAU, ph: rnd() * TAU, x: null, y: null, u: rnd(), v: 0.3 + rnd() * 0.6, ox: 0, oy: 0,
            dots: Array.from({ length: 14 }, () => [rnd() * 1.6 - 0.8, rnd() * 1.6 - 0.8]) };
          if (d.magdrop && w.kind === 'iron') { g.x = lerp(BOX.x0 + 100, BOX.x1 - 100, rnd()); g.y = BOX.y0 - 24; }
        }
        g.susp = w.susp;
        kept.push(g);
      }
      for (const g of P.grains) {
        if (kept.includes(g)) continue;
        if (g.kind === 'iron' && (d.magnet || P.magHold > 0)) P.leaving.push(Object.assign(g, { hold: 0 }));
      }
      P.grains = kept;
    }

    // ------------------------------------------------------------------ Bewegung
    /** Plätze diffundieren in Phasenkoordinaten (reflektierend) – die Verteilung bleibt gleichmäßig. */
    function wander(p, D, dt, swirl) {
      // Rühren/Schütteln: geschlossene Zirkulation (Stromfunktion sin πu · sin πv), an den Wänden
      // ohne Normalgeschwindigkeit – nichts sammelt sich am Rand
      const su = swirl ? Math.PI * Math.sin(Math.PI * p.u) * Math.cos(Math.PI * p.v) * swirl * 0.12 : 0;
      const sv = swirl ? -Math.PI * Math.cos(Math.PI * p.u) * Math.sin(Math.PI * p.v) * swirl * 0.12 : 0;
      p.u += gauss() * Math.sqrt(dt) * D + su * dt;
      p.v += gauss() * Math.sqrt(dt) * D + sv * dt;
      if (p.u < 0) p.u = -p.u; if (p.u > 1) p.u = 2 - p.u;
      if (p.v < 0) p.v = -p.v; if (p.v > 1) p.v = 2 - p.v;
      p.u = clamp(p.u, 0, 1); p.v = clamp(p.v, 0, 1);
    }
    function jitter(p, A, dt) {
      // Ornstein-Uhlenbeck: zittert um den Platz, kehrt zurück
      p.vx += (gauss() * A * 9 - p.ox * 6 - p.vx * 4) * dt;
      p.vy += (gauss() * A * 9 - p.oy * 6 - p.vy * 4) * dt;
      p.ox = clamp(p.ox + p.vx * dt, -A * 1.6, A * 1.6); p.oy = clamp(p.oy + p.vy * dt, -A * 1.6, A * 1.6);
      p.a += gauss() * dt * 1.4;
    }
    /** Lage eines Platzes in einem Bereich (mit Rand). */
    function place(p, R, pad) {
      const x = lerp(R.x0 + pad, R.x1 - pad, p.u) + p.ox;
      const y = R.y1 - R.y0 > 2 * pad ? lerp(R.y0 + pad, R.y1 - pad, p.v) + p.oy : (R.y0 + R.y1) / 2;
      return [clamp(x, R.x0 + 2, R.x1 - 2), clamp(y, R.y0 + 2, Math.max(R.y0 + 2, R.y1 - 2))];
    }
    /** Folgt dem Ziel weich (kein Springen bei Änderungen des Füllstands). */
    function follow(p, x, y, dt, k) {
      if (p.x == null || dt <= 0) { p.x = x; p.y = y; return; }
      const f = Math.min(1, dt * (k || 8));
      p.x += (x - p.x) * f; p.y += (y - p.y) * f;
    }

    /** Öltröpfchen (Emulsion): Mittelpunkte in der Wasserphase, steigen in Ruhe langsam auf. */
    function dropletCenters(d, dt) {
      if (!P.dc) P.dc = Array.from({ length: 12 }, (_, i) => { const [u, v] = R2(1000 + i); return { u: 0.12 + 0.76 * u, v: 0.15 + 0.8 * v, ph: rnd() * TAU }; });
      const rise = (1 - d.emul) * 0.05 + 0.006;
      for (const c of P.dc) {
        c.ph += dt * (0.8 + d.agit * 5);
        c.u = clamp(c.u + gauss() * Math.sqrt(dt) * (0.03 + d.agit * 0.25), 0.1, 0.9);
        c.v += gauss() * Math.sqrt(dt) * (0.02 + d.agit * 0.2) - (d.agit > 0.3 ? 0 : rise * dt);
        if (c.v < 0.06) c.v = 0.55 + 0.4 * rnd();
        c.v = clamp(c.v, 0.04, 0.96);
      }
      return P.dc;
    }

    function move(d, z, bed, dt) {
      const liqBot = bed.top;
      const T = Math.max(0, d.temp - 20);
      const A = (2.2 + T * 0.035) * (1 + d.agit * 1.5);
      const D = (0.02 + T * 0.0003) * (1 + d.agit * 4);
      const swirl = d.agit > 0.2 ? d.agit : 0;
      const liq = { x0: BOX.x0, x1: BOX.x1, y0: z.liqTop, y1: liqBot };
      const layerShare = d.oilShare * (1 - d.emul);
      const oilR = { x0: BOX.x0, x1: BOX.x1, y0: z.liqTop, y1: z.liqTop + (liqBot - z.liqTop) * layerShare };
      const waterR = layerShare > 0.01 ? { x0: BOX.x0, x1: BOX.x1, y0: oilR.y1, y1: liqBot } : liq;
      P.oilR = oilR; P.waterR = waterR;

      // Öl: Schicht oben (gleichmäßig), ein Teil nach dem Schütteln in Tröpfchen in der Wasserphase
      const nInDrops = d.emul > 0.03 ? Math.round(P.oil.length * d.emul) : 0;
      const nDrops = nInDrops ? clamp(Math.round(2 + d.emul * 10), 2, Math.min(12, nInDrops)) : 0;
      const centers = dropletCenters(d, dt);
      const drops = [];
      for (let k = 0; k < nDrops; k++) {
        const m = Math.floor(nInDrops / nDrops) + (k < nInDrops % nDrops ? 1 : 0);
        const r = Math.sqrt(m * AREA.oil / Math.PI) + 2;
        const c = centers[k];
        const cx = lerp(waterR.x0 + r + 2, waterR.x1 - r - 2, c.u) + Math.sin(c.ph) * 3 * swirl;
        const cy = clamp(lerp(waterR.y0 + r + 2, waterR.y1 - r - 2, c.v), waterR.y0 + r, Math.max(waterR.y0 + r, waterR.y1 - r));
        drops.push({ x: cx, y: cy, r, m, used: 0, c });
      }
      // Tröpfchen überlappen nicht: kurz auseinanderschieben und die Lage merken
      const inR = (dr) => {
        dr.x = clamp(dr.x, waterR.x0 + dr.r + 2, Math.max(waterR.x0 + dr.r + 2, waterR.x1 - dr.r - 2));
        dr.y = clamp(dr.y, waterR.y0 + dr.r + 1, Math.max(waterR.y0 + dr.r + 1, waterR.y1 - dr.r - 1));
      };
      for (let it = 0; it < 14; it++) {
        for (let i = 0; i < drops.length; i++) for (let j = i + 1; j < drops.length; j++) {
          const a = drops[i], b = drops[j];
          const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 0.01, min = a.r + b.r + 3;
          if (dist < min) { const k = (min - dist) / 2 / dist; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
        }
        drops.forEach(inR);
      }
      for (const dr of drops) {
        const wx = waterR.x1 - waterR.x0 - 2 * dr.r - 4, wy = waterR.y1 - waterR.y0 - 2 * dr.r - 4;
        if (wx > 1) dr.c.u = clamp((dr.x - waterR.x0 - dr.r - 2) / wx, 0, 1);
        if (wy > 1) dr.c.v = clamp((dr.y - waterR.y0 - dr.r - 2) / wy, 0.04, 0.96);
      }
      P.dropsShown = drops;
      P.oil.forEach((p) => {
        jitter(p, A * 0.8, dt);
        if (p.k < nInDrops && drops.length) {
          const dr = drops[p.k % drops.length];
          const j = dr.used++;
          const rr = (dr.r - 4.5) * Math.sqrt((j + 0.5) / Math.max(1, dr.m)), th = j * 2.39996 + t * 0.15;
          follow(p, dr.x + Math.cos(th) * rr + p.ox * 0.4, dr.y + Math.sin(th) * rr + p.oy * 0.4, dt, 12);
        } else {
          wander(p, D, dt, swirl);
          const [x, y] = place(p, oilR.y1 - oilR.y0 > 6 ? oilR : { x0: BOX.x0, x1: BOX.x1, y0: z.liqTop, y1: z.liqTop + 8 }, 6);
          follow(p, x, y, dt, 5);
        }
      });
      // Wasser und Ionen: gleichmäßig in der Wasserphase, aus den Öltröpfchen herausgedrängt
      // Liegt ein Teilchen in einem Öltröpfchen, wird es dort ausgeblendet (am Rand weich) – es behält
      // seinen Platz, damit sich nirgends Wasser anhäuft
      const wr = z.filter ? { x0: BOX.x0, x1: BOX.x1, y0: z.liqTop, y1: liqBot } : waterR;
      const cover = (p, pad) => {
        let a = 1;
        for (const dr of drops) a = Math.min(a, clamp((Math.hypot(p.x - dr.x, p.y - dr.y) - dr.r + pad) / 6, 0, 1));
        p.vis = a;
      };
      for (const p of P.water) { wander(p, D, dt, swirl); jitter(p, A, dt); const [x, y] = place(p, wr, 6); follow(p, x, y, dt, 10); cover(p, 1); }
      for (const p of P.ions) { wander(p, D * 0.9, dt, swirl); jitter(p, A * 0.9, dt); const [x, y] = place(p, wr, 8); follow(p, x, y, dt, 6); cover(p, 0); }

      // Gas (Wasser verlässt die Flüssigkeit), Kristallisation
      P.gas = P.gas.filter((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.a += dt * 3; return p.y > BOX.y0 - 10 && p.x > BOX.x0 - 10 && p.x < BOX.x1 + 10; });
      P.transit = P.transit.filter((p) => { p.t += dt; const lx = (BOX.x0 + BOX.x1) / 2, ly = liqBot - 10; p.x += (lx - p.x) * Math.min(1, dt * 3); p.y += (ly - p.y) * Math.min(1, dt * 3); return p.t < 0.8; });

      // Körner: abgesetzt im Bodensatz, schwebend in der Flüssigkeit unterhalb der Absetzfront
      const bedPos = new Map(bed.items.filter((it) => it.g).map((it) => [it.g, it]));
      for (const g of P.grains) {
        g.ph += dt * (1 + swirl * 5);
        let tx, ty, k = 2.2;
        const it = bedPos.get(g);
        if (it) { tx = it.x; ty = it.y; k = d.magdrop ? 2.5 : 2; }
        else {
          wander(g, D * 0.6, dt, swirl);
          const front = lerp(liqBot, z.liqTop, clamp(d.frontFrac, 0, 1));
          const R = { x0: BOX.x0, x1: BOX.x1, y0: Math.max(z.liqTop, front), y1: liqBot };
          [tx, ty] = place(g, R, g.r);
          k = 1 + swirl * 3;
        }
        if (g.x == null) { g.x = tx; g.y = ty; }
        g.x += (tx - g.x) * Math.min(1, dt * k);
        g.y += clamp((ty - g.y) * Math.min(1, dt * k * 1.5), -dt * 160, dt * 220);
        g.rot += swirl * dt * 0.4;
      }
      // Eisen am Magneten: hängt am Magneten, solange er im Gefäß ist, und verlässt dann mit ihm das Bild
      P.magHold = d.magnet ? 1 : Math.max(0, (P.magHold || 0) - dt);
      P.leaving = P.leaving.filter((g, i) => {
        const tx = lerp(BOX.x0 + 110, BOX.x1 - 110, (i % 4) / 3) + (i >> 2) * 9, ty = d.magnet ? BOX.y0 + 34 + (i >> 2) * 8 : BOX.y0 - 60;
        g.x += (tx - g.x) * Math.min(1, dt * 3); g.y += (ty - g.y) * Math.min(1, dt * (d.magnet ? 3 : 2));
        return g.y > BOX.y0 - 50;
      });
      // Filter: Wasser und gelöste Ionen gehen durch die Poren, Körner bleiben liegen
      if (z.filter && d.drip > 0.01) {
        const rate = clamp(d.drip * 6, 2, 22);
        if (rnd() < dt * rate) {
          const pore = BOX.x0 + 20 + Math.floor(rnd() * 9) * 30;
          const ion = rnd() < (P.ions.length / Math.max(1, P.water.length + P.ions.length)) * 1.4;
          P.drops.push({ x: pore, y: z.band - 4, kind: ion ? (rnd() < 0.5 ? 'na' : 'cl') : 'water', vy: 40, a: rnd() * TAU });
        }
      }
      P.drops = P.drops.filter((p) => { p.vy += 120 * dt; p.y += p.vy * dt; return p.y < BOX.y1 + 10; });
    }

    // ------------------------------------------------------------------ Zeichnen
    function frame(wallDt, running) {
      const e = getEngine();
      const st = e.state;
      const id = getFocus();
      const o = st.objs[id] || REF[id];
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
      // Bodensatz zuerst mit dem bisherigen Kornbestand anordnen, dann abgleichen und erneut anordnen
      reconcile(d, z, z.floor - bedLayout(d, z.floor).height);
      const bed = bedLayout(d, z.floor);
      move(d, z, bed, dt);
      const liqBot = bed.top;
      ctx.save();
      ctx.beginPath(); ctx.rect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0); ctx.clip();
      // Flüssigkeit (reicht bis in die Lücken des Bodensatzes), Ölschicht, Öltröpfchen
      if (d.L > 0.02) {
        ctx.fillStyle = 'rgba(205,228,248,0.55)'; ctx.fillRect(BOX.x0, z.liqTop, BOX.x1 - BOX.x0, z.floor - z.liqTop);
        if (P.oilR && P.oilR.y1 - P.oilR.y0 > 0.5) { ctx.fillStyle = 'rgba(250,232,170,0.75)'; ctx.fillRect(BOX.x0, P.oilR.y0, BOX.x1 - BOX.x0, P.oilR.y1 - P.oilR.y0); }
        for (const dr of P.dropsShown || []) {
          ctx.fillStyle = 'rgba(250,232,170,0.85)'; ctx.beginPath(); ctx.arc(dr.x, dr.y, dr.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(190,150,40,0.55)'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(60,110,160,0.6)'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(BOX.x0, z.liqTop); ctx.lineTo(BOX.x1, z.liqTop); ctx.stroke(); ctx.setLineDash([]);
      }
      if (z.filter) {
        ctx.fillStyle = '#e9e4d8'; ctx.fillRect(BOX.x0, z.band - 6, BOX.x1 - BOX.x0, 12);
        for (let i = 0; i < 9; i++) { const x = BOX.x0 + 20 + i * 30; ctx.fillStyle = '#fbfcfd'; ctx.fillRect(x - 3.5, z.band - 6, 7, 12); }
        ctx.fillStyle = 'rgba(205,228,248,0.35)'; ctx.fillRect(BOX.x0, z.band + 6, BOX.x1 - BOX.x0, BOX.y1 - z.band - 6);
      }
      // Bodensatz: Kristalle (Ionengitter) und abgesetzte Körner
      for (const it of bed.items) if (it.cr) crystal(it.x, it.y, it.cr);
      for (const p of P.transit) ion(p.x, p.y, p.na, 0.6);
      // Körner verdecken die Teilchen hinter ihnen (Wasser umgibt sie, dringt aber nicht ein)
      for (const p of P.water) if (p.vis !== 0) water(p.x, p.y, p.a, p.vis);
      for (const p of P.ions) if (p.vis !== 0) ion(p.x, p.y, p.na, p.vis);
      for (const g of P.grains) grain(g);
      for (const g of P.leaving) grain(g);
      for (const p of P.oil) oil(p.x, p.y, p.a);
      for (const p of P.gas) water(p.x, p.y, p.a, 0.75);
      for (const p of P.drops) { if (p.kind === 'water') water(p.x, p.y, p.a); else ion(p.x, p.y, p.kind === 'na'); }
      if (d.magnet || P.leaving.length && P.magHold > 0) magnetBar();
      ctx.restore();
      // Beschriftung der Bereiche
      ctx.font = `600 11px ${FONT}`; ctx.fillStyle = '#4a5866'; ctx.textAlign = 'left';
      if (d.L > 0.02 && z.liqTop - BOX.y0 > 18) ctx.fillText(d.evap > 0.002 && d.temp > 50 ? 'Luft · Wasser (gasförmig)' : 'Luft', BOX.x0 + 6, BOX.y0 + 14);
      else if (d.L <= 0.02 && liqBot - BOX.y0 > 30) ctx.fillText('Luft', BOX.x0 + 6, BOX.y0 + 14);
      if (z.filter) { ctx.fillText('Filterpapier', BOX.x0 + 6, z.band - 9); ctx.fillText('Filtrat', BOX.x0 + 6, z.band + 24); }
      frameBox();
    }
    function frameBox() { ctx.strokeStyle = '#9aa7b4'; ctx.lineWidth = 1.5; ctx.strokeRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0); }
    function label(text) { ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#66768a'; ctx.textAlign = 'center'; ctx.fillText(text, W / 2, Hh / 2); }
    function magnetBar() { ctx.fillStyle = '#d63a3a'; ctx.fillRect(BOX.x0 + 90, BOX.y0 + 2, 50, 18); ctx.fillStyle = '#2f9a57'; ctx.fillRect(BOX.x0 + 140, BOX.y0 + 2, 50, 18); }
    function water(x, y, a, alpha) { drawWater(ctx, x, y, a, alpha); }
    function ion(x, y, na, alpha) { drawIon(ctx, x, y, na, alpha); }
    function oil(x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = C.oil; ctx.beginPath(); ctx.ellipse(0, 0, SZ.oilL, SZ.oilW, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,85,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    function crystal(cx, cy, cr) {
      const x0 = cx - (cr.cols * SZ.ion) / 2 + SZ.ion / 2, y0 = cy + (cr.rows * SZ.ion) / 2 - SZ.ion / 2;
      for (let i = 0; i < cr.n; i++) {
        const c = i % cr.cols, r = Math.floor(i / cr.cols);
        ion(x0 + c * SZ.ion, y0 - r * SZ.ion, (r + c) % 2 === 0);
      }
    }
    function grain(g) {
      if (g.x == null) return;
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot);
      ctx.beginPath();
      g.shape.forEach((k, i) => { const a = i / g.shape.length * TAU; const x = Math.cos(a) * g.r * k, y = Math.sin(a) * g.r * k * 0.8; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
      ctx.fillStyle = g.kind === 'sand' ? C.sand : C.iron; ctx.fill();
      ctx.strokeStyle = g.kind === 'sand' ? C.sandEdge : '#2c3036'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = g.kind === 'sand' ? 'rgba(110,80,40,0.45)' : 'rgba(220,225,232,0.45)';
      for (const [dx, dy] of g.dots) ctx.fillRect(dx * g.r * 0.6, dy * g.r * 0.5, 1.8, 1.8);
      ctx.restore();
    }

    return { frame, resize, reset, get state() { return P; } };
  }

  /** Wasserteilchen: blaues Dreieck (wie in „Aggregatzustände“). */
  function drawWater(ctx, x, y, a, alpha) {
    if (x == null) return;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(x, y); ctx.rotate(a || 0);
    const R = SZ.water;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const th = -Math.PI / 2 + (i * TAU) / 3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(th) * R, Math.sin(th) * R); }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -R, 0, R * 0.6);
    g.addColorStop(0, C.waterHi); g.addColorStop(0.55, C.water); g.addColorStop(1, C.waterEdge);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineJoin = 'round'; ctx.strokeStyle = C.waterEdge; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  /** Ion mit gut lesbarem Ladungszeichen: Na⁺ (violett, kleiner), Cl⁻ (grün, größer). */
  function drawIon(ctx, x, y, na, alpha) {
    if (x == null) return;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const r = na ? SZ.na : SZ.cl;
    ctx.fillStyle = na ? C.na : C.cl; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = na ? '#5a2d93' : '#1d6a3c'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    const k = r * 0.5;
    ctx.moveTo(x - k, y); ctx.lineTo(x + k, y);
    if (na) { ctx.moveTo(x, y - k); ctx.lineTo(x, y + k); }
    ctx.stroke(); ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
  }

  /** Beschreibung auf Teilchenebene (Modellinterpretation) für das Gefäß. */
  function modelText(st, o) {
    if (o && o.ref) return o.text;
    if (!o || !o.c) return '';
    const c = o.c;
    const L = Mo.liq(c);
    const parts = [];
    if (o.type === 'funnel' && o.paper) parts.push('Die Wasserteilchen und die gelösten Na⁺- und Cl⁻-Teilchen sind viel kleiner als die Poren und gelangen hindurch; die Sandkörner bleiben auf dem Papier liegen.');
    if (Mo.sand(c) > 0.05) {
      const s = (o.susp.sandC.m + o.susp.sandF.m) / Math.max(Mo.sand(c), 1e-6);
      parts.push(L > 0.3 ? (s > 0.1 ? 'Sandkörner (jedes Korn besteht aus sehr vielen Teilchen) sind zwischen den Wasserteilchen verteilt und sinken nach unten.' : 'Die Sandkörner liegen unten; über ihnen bewegen sich nur Wasserteilchen.') : 'Die Sandkörner liegen als Feststoff nebeneinander.');
    }
    if (st.op && st.op.type === 'magnet' && st.op.v === o.id) parts.push('Nur die Eisenkörner werden zum Magneten gezogen; die anderen Teilchen bleiben, wo sie sind.');
    else if (c.iron > 0.02) parts.push('Eisenkörner sind feste Verbände aus vielen Eisenteilchen.');
    if (c.saltS > 0.02 && (Mo.sand(c) > 0.05 || c.iron > 0.02) && L < 0.3) parts.push('Gemenge: Kleine Kochsalzkristalle liegen zwischen den Sand- und Eisenkörnern. Jeder Kristall ist ein Ionengitter aus Na⁺- und Cl⁻-Teilchen.');
    if (c.saltD > 0.02) parts.push('Das gelöste Kochsalz liegt als einzelne Na⁺- und Cl⁻-Teilchen gleichmäßig zwischen den Wasserteilchen verteilt vor – deshalb ist die Lösung klar. Gelöst ist kein eigener Aggregatzustand.');
    if (c.saltS > 0.02 && !((Mo.sand(c) > 0.05 || c.iron > 0.02) && L < 0.3)) parts.push(o.evap > 0.002 || o.type === 'dish' ? 'Wenn Wasser verdampft, ordnen sich Na⁺- und Cl⁻-Teilchen regelmäßig zu festen Kristallen an; das Salz schmilzt dabei nicht und wird nicht gasförmig.' : 'Festes Kochsalz: Na⁺- und Cl⁻-Teilchen sind regelmäßig in einem Kristall angeordnet.');
    if (c.oil > 0.05 && c.water > 0.05) parts.push(o.emul > 0.25 ? 'Beim Schütteln wurde das Öl in Tröpfchen zerteilt; jedes Tröpfchen ist eine Ansammlung sehr vieler Ölteilchen, umgeben von Wasserteilchen. In Ruhe steigen die Tröpfchen auf und vereinigen sich wieder zu einer Schicht.' : 'Öl- und Wasserteilchen mischen sich nicht: Die Ölteilchen bleiben in einem eigenen Bereich oben, weil Öl eine geringere Dichte hat.');
    else if (c.oil > 0.05) parts.push('Nur Ölteilchen, gleichmäßig verteilt und in ständiger ungeordneter Bewegung.');
    if (o.evap > 0.002 && o.temp > 50) parts.push('Wasserteilchen verlassen die Flüssigkeit und werden gasförmig. Dieser Wasserdampf ist unsichtbar; die sichtbare weiße Wolke („Dampf“) besteht aus winzigen Tröpfchen von wieder kondensiertem Wasser.');
    if (!parts.length) parts.push(L > 0.02 ? 'Nur Wasserteilchen, die sich ständig ungeordnet bewegen.' : 'Das Gefäß ist leer.');
    return parts.join(' ');
  }

  (root.TV = root.TV || {}).particles = { createParticleView, modelText, counts, drawWater, drawIon, COLORS: C, SIZES: SZ, REF };
})(typeof self !== 'undefined' ? self : this);
