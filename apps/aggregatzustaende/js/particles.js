/*
 * Aggregatzustände – gemeinsame Teilchen-Engine (ohne DOM)
 *
 * Eine leichte 2D-Animation für alle vier Stoffe – kein Molekulardynamik-Solver.
 * Die Stoffe unterscheiden sich nur über ihre Konfiguration (Gitterart,
 * Abstände, Teilchensorten). Jedes Teilchen ist zu jeder Zeit fest (S),
 * flüssig (L), gasförmig (G) oder sitzt an der kalten Oberfläche (P).
 * Die Zahl der Teilchen je Zustand folgt den Anteilen aus model.shares();
 * beim Wechsel wird jeweils das passende Teilchen umgestellt (oben/außen
 * schmilzt zuerst, oben verdampft zuerst, Gitterplätze füllen sich von unten
 * innen). Die Bewegungsart geht über Gewichte weich über. Kein Teilchen
 * entsteht, verschwindet oder ändert seine Größe.
 *
 *  fest:      Feder zum Gitterplatz + Schwingung, die mit der Temperatur zunimmt
 *  flüssig:   Schwerkraft, Zähigkeit, zufällige Stöße, schwacher Zusammenhalt
 *  gasförmig: geradlinig, Geschwindigkeit nach Temperatur, elastische Stöße
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.AZ = root.AZ || {}).particles = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 88, H = 66;            // Darstellungsraum (Weltkoordinaten, y nach unten)
  const DT = 1 / 120;              // feste Rechenschritte (s)
  const COLS = 8, ROWS = 6;        // 48 Teilchen
  const PLATE_Y = 3.4;             // Unterkante der kalten Oberfläche
  const FLOOR = H - 0.6;
  const CRYSTAL_MAX = 0.3;

  // Bewegungsparameter (gemeinsam für alle Stoffe)
  const K_SOLID = 520, C_SOLID = 42, GLIDE_MAX = 34;
  const G_LIQ = 45, C_LIQ = 2.4, K_COH = 40;
  const WEIGHT_RATE = 5;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Winkeldifferenz unter Beachtung der Symmetrie des Symbols (Rechteck: 180°, Dreieck: 120°). */
  function wrapSym(d, n) {
    const per = TAU / (n || 1);
    d = ((d % per) + per) % per;
    return d > per / 2 ? d - per : d;
  }
  const SYM = { rect: 2, triangle: 3, sphere: 0 };

  function buildSlots(P) {
    const slots = [];
    const k0 = P.kinds[0];
    const rmax = Math.max.apply(null, P.kinds.map((k) => k.r));
    const mid = (COLS - 1) / 2;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        let x, y, a = 0, kind = 0;
        if (P.lattice === 'hex') {
          const s = 2 * k0.r * P.spacing;
          x = W / 2 + (i - mid) * s + (j % 2 ? s / 4 : -s / 4);
          y = FLOOR - k0.r - j * s * 0.866;
        } else {
          x = W / 2 + (i - mid) * P.sx;
          y = FLOOR - rmax - j * P.sy;
          if (P.kinds.length > 1) kind = (i + j) % 2;
          if (P.tilt) a = j % 2 ? P.tilt : -P.tilt;
        }
        slots.push({ x, y, a, kind, prio: j * 100 + Math.abs(i - mid) + (j % 2 ? 0.3 : 0), occ: -1 });
      }
    }
    return slots;
  }
  /** Plätze an der Unterseite der kalten Oberfläche (zwei Reihen, Mitte zuerst). */
  function buildPlate(P, n) {
    const out = [];
    const per = Math.ceil(n / 2);
    const sx = P.sx || 2 * P.kinds[0].r * (P.spacing || 1.05);
    const sy = P.sy || sx * 0.866;
    const mid = (per - 1) / 2;
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < per && out.length < n; i++) {
        out.push({ x: W / 2 + (i - mid) * sx + (j ? sx / 2 : 0), y: PLATE_Y + 2.5 + j * sy, a: P.tilt ? (j ? P.tilt : -P.tilt) : 0, kind: 0, prio: j * 100 + Math.abs(i - mid), occ: -1 });
      }
    }
    return out;
  }

  function createSystem(sub, seed) {
    const P = sub.particle;
    const R = mulberry32(seed || 20261029);
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = R(); v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    const unit = P.kinds.length;
    const slots = buildSlots(P);
    const N = slots.length;
    const plate = sub.coldSurface ? buildPlate(P, Math.floor(N * CRYSTAL_MAX)) : [];
    const gap = P.liquidGap || 1.04;
    const ps = slots.map((sl, i) => {
      const k = P.kinds[sl.kind];
      return {
        i, kind: sl.kind, r: k.r, sym: SYM[k.symbol] || 0,
        ir: k.r * (0.93 + 0.14 * R()), // Wechselwirkungsradius in der Flüssigkeit (verhindert Scheinkristalle; Symbolgröße bleibt gleich)
        x: sl.x, y: sl.y, vx: 0, vy: 0, a: sl.a, va: 0, fx: 0, fy: 0,
        ph: 'S', ws: 1, wl: 0, wg: 0, wp: 0, slot: -1, pslot: -1, bond: -1,
        f1: 7 + 5 * R(), f2: 7 + 5 * R(), q1: TAU * R(), q2: TAU * R(), spin: 0,
        vf: 0.55 + 0.9 * R() // eigene Geschwindigkeit im Gas (Verteilung statt Gleichschritt)
      };
    });
    let t = 0, carry = 0;
    let env = { shares: { s: 1, l: 0, g: 0, c: 0 }, T: sub.start, coldVis: 0 };

    // ------------------------------------------------------------ Temperaturabhängige Bewegung
    function temps() {
      const T = env.T;
      return {
        s: clamp((T - sub.min) / (sub.mp - sub.min), 0, 1),
        l: clamp((T - sub.mp) / (sub.bp - sub.mp), 0, 1),
        all: clamp((T - sub.min) / (sub.max - sub.min), 0, 1)
      };
    }
    const gasSpeed = (th) => 20 + 34 * th.all;
    const plateVisible = () => plate.length > 0 && (env.coldVis > 0.01 || ps.some((p) => p.ph === 'P'));

    // ------------------------------------------------------------ Zählen und Umstellen
    function counts() { const c = { S: 0, L: 0, G: 0, P: 0 }; for (const p of ps) c[p.ph]++; return c; }
    function targets(sh) {
      const U = N / unit;
      const raw = [['S', sh.s], ['L', sh.l], ['G', sh.g], ['P', plate.length ? sh.c || 0 : 0]].map(([k, v]) => ({ k, v: Math.max(0, v) * U }));
      const sum = raw.reduce((a, x) => a + x.v, 0) || 1;
      raw.forEach((x) => { x.v = (x.v * U) / sum; x.n = Math.floor(x.v); });
      let rest = U - raw.reduce((a, x) => a + x.n, 0);
      raw.slice().sort((a, b) => (b.v - b.n) - (a.v - a.n)).forEach((x) => { if (rest > 0) { x.n++; rest--; } });
      const out = {};
      raw.forEach((x) => { out[x.k] = x.n * unit; });
      if (plate.length && out.P > plate.length) { out.G += out.P - plate.length; out.P = plate.length; }
      return out;
    }
    function freeSlot(list, kind) {
      let best = null;
      for (const s of list) if (s.occ < 0 && s.kind === kind && (!best || s.prio < best.prio)) best = s;
      return best;
    }
    function topSlot(list, kind) {
      let best = null;
      for (const s of list) if (s.occ >= 0 && s.kind === kind && (!best || s.prio > best.prio)) best = s;
      return best;
    }
    const d2 = (a, x, y) => (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
    function pick(from, kind, dest, ref) {
      if (from === 'S') { const s = topSlot(slots, kind); return s ? s.occ : -1; }
      if (from === 'P') { const s = topSlot(plate, kind); return s ? s.occ : -1; }
      let best = -1, bv = Infinity;
      for (const p of ps) {
        if (p.ph !== from || p.kind !== kind) continue;
        let v;
        if (dest) v = d2(p, dest.x, dest.y);                       // zum Zielplatz am nächsten
        else if (ref) v = d2(p, ref.x, ref.y);                     // Partner für ein Gaspaar
        else v = from === 'L' ? p.y : -p.y;                        // L: oberstes Teilchen; G: unterstes
        if (v < bv) { bv = v; best = p.i; }
      }
      return best;
    }
    function leave(p) {
      if (p.ph === 'S' && p.slot >= 0) { slots[p.slot].occ = -1; p.slot = -1; }
      if (p.ph === 'P' && p.pslot >= 0) { plate[p.pslot].occ = -1; p.pslot = -1; }
      if (p.ph === 'G' && p.bond >= 0) { ps[p.bond].bond = -1; p.bond = -1; }
    }
    function convertUnit(from, to) {
      const picked = [], dests = [];
      for (let k = 0; k < unit; k++) {
        let dest = null;
        if (to === 'S') dest = freeSlot(slots, k);
        else if (to === 'P') dest = freeSlot(plate, k);
        if ((to === 'S' || to === 'P') && !dest) return false;
        let idx;
        const first = picked.length ? ps[picked[0]] : null;
        if (from === 'G' && first && first.bond >= 0 && ps[first.bond].kind === k) idx = first.bond;
        else idx = pick(from, k, dest, to === 'G' ? first : null);
        if (idx < 0 || picked.includes(idx)) return false;
        picked.push(idx); dests.push(dest);
      }
      const th = temps();
      picked.forEach((idx, n) => {
        const p = ps[idx];
        leave(p);
        p.ph = to;
        const dest = dests[n];
        if (to === 'S') { p.slot = slots.indexOf(dest); dest.occ = idx; }
        if (to === 'P') { p.pslot = plate.indexOf(dest); dest.occ = idx; }
        if (to === 'G') {
          const ang = -Math.PI / 2 + (R() - 0.5) * 2.8;
          p.vf = 0.55 + 0.9 * R();
          const sp = gasSpeed(th) * 0.75 * p.vf;
          p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
          p.spin = (R() < 0.5 ? -1 : 1) * (2 + 3 * R());
        }
      });
      if (to === 'G' && unit === 2 && P.pairsInGas) { ps[picked[0]].bond = picked[1]; ps[picked[1]].bond = picked[0]; }
      return true;
    }
    const ORDER = [['S', 'L'], ['L', 'S'], ['L', 'G'], ['G', 'L'], ['G', 'P'], ['P', 'G'], ['S', 'G'], ['G', 'S'], ['P', 'L'], ['P', 'S'], ['L', 'P'], ['S', 'P']];
    function rebalance(maxUnits) {
      const tg = targets(env.shares);
      for (let n = 0; n < maxUnits; n++) {
        const c = counts();
        let done = false;
        for (const [a, b] of ORDER) {
          if (c[a] > tg[a] && c[b] < tg[b] && convertUnit(a, b)) { done = true; break; }
        }
        if (!done) return;
      }
    }

    // ------------------------------------------------------------ Bewegung
    function step(dt) {
      t += dt;
      rebalance(2);
      const th = temps();
      const vg = gasSpeed(th);
      const ampS = 0.06 + 0.2 * th.s;
      const sigL = 16 + 12 * th.l;
      const plateOn = plateVisible();
      const top0 = plateOn ? PLATE_Y : 0;
      const kw = Math.min(1, WEIGHT_RATE * dt);

      for (const p of ps) {
        p.ws += ((p.ph === 'S' ? 1 : 0) - p.ws) * kw;
        p.wl += ((p.ph === 'L' ? 1 : 0) - p.wl) * kw;
        p.wg += ((p.ph === 'G' ? 1 : 0) - p.wg) * kw;
        p.wp += ((p.ph === 'P' ? 1 : 0) - p.wp) * kw;
        p.fx = 0; p.fy = 0;
      }
      // Zusammenhalt in der Flüssigkeit (schwach, kurze Reichweite)
      for (let i = 0; i < N; i++) {
        const a = ps[i];
        if (a.wl < 0.05) continue;
        for (let j = i + 1; j < N; j++) {
          const b = ps[j];
          if (b.wl < 0.05) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rr = (a.ir + b.ir) * gap, reach = rr * 1.7;
          const dd = dx * dx + dy * dy;
          if (dd >= reach * reach || dd <= rr * rr) continue;
          const d = Math.sqrt(dd);
          const f = K_COH * a.wl * b.wl * (1 - (d - rr) / (reach - rr));
          a.fx += (f * dx) / d; a.fy += (f * dy) / d;
          b.fx -= (f * dx) / d; b.fy -= (f * dy) / d;
        }
      }
      const sq = Math.sqrt(dt);
      for (const p of ps) {
        let ax = p.fx, ay = p.fy;
        // fest bzw. an der kalten Oberfläche: Feder zum Platz mit Schwingung
        const anchor = p.ph === 'S' ? slots[p.slot] : p.ph === 'P' ? plate[p.pslot] : null;
        let w = 0;
        if (anchor) {
          w = p.ph === 'S' ? p.ws : p.wp;
          const A = p.r * (p.ph === 'S' ? ampS : 0.06);
          const tx = anchor.x + A * Math.sin(p.f1 * t + p.q1);
          const ty = anchor.y + A * Math.sin(p.f2 * t + p.q2);
          ax += w * (K_SOLID * (tx - p.x) - C_SOLID * p.vx);
          ay += w * (K_SOLID * (ty - p.y) - C_SOLID * p.vy);
        }
        // flüssig: Schwerkraft und Zähigkeit
        ax += p.wl * (-C_LIQ * p.vx);
        ay += p.wl * (G_LIQ - C_LIQ * p.vy);
        p.vx += ax * dt; p.vy += ay * dt;
        if (p.wl > 0.01) { p.vx += p.wl * sigL * sq * gauss(); p.vy += p.wl * sigL * sq * gauss(); }
        // gasförmig: Geschwindigkeit nach Temperatur, kleine zufällige Richtungsänderungen
        if (p.wg > 0.01) {
          const s = Math.hypot(p.vx, p.vy);
          if (s < 1e-3) { const ang = TAU * R(); p.vx = Math.cos(ang) * vg * 0.5; p.vy = Math.sin(ang) * vg * 0.5; }
          else {
            const k = 1 + ((vg * p.vf) / s - 1) * Math.min(1, p.wg * 2.5 * dt);
            const rot = gauss() * 1.1 * sq * p.wg;
            const c = Math.cos(rot), sn = Math.sin(rot);
            const vx = (p.vx * c - p.vy * sn) * k, vy = (p.vx * sn + p.vy * c) * k;
            p.vx = vx; p.vy = vy;
          }
        }
        // Gleiten zum Platz begrenzen (Ordnen ist sichtbar, kein Springen)
        if (anchor && w < 0.97) {
          const s = Math.hypot(p.vx, p.vy);
          if (s > GLIDE_MAX) { p.vx *= GLIDE_MAX / s; p.vy *= GLIDE_MAX / s; }
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        // Drehung: fest ausgerichtet (leichtes Pendeln), flüssig taumelnd, gasförmig rotierend
        if (p.sym) {
          if (anchor) {
            const tgt = anchor.a + (0.04 + 0.22 * (p.ph === 'S' ? th.s : 0)) * Math.sin(p.f2 * 0.8 * t + p.q1);
            p.va += w * (300 * wrapSym(tgt - p.a, p.sym) - 34 * p.va) * dt;
          }
          p.va += p.wl * (-2 * p.va * dt + 4.5 * sq * gauss());
          p.va += p.wg * (p.spin - p.va) * Math.min(1, 3 * dt);
          p.a += p.va * dt;
        }
      }
      collide();
      bonds();
      for (const p of ps) {
        const g = p.ph === 'G';
        const e = g ? 1 : 0.2;
        const top = p.ph === 'P' ? 0 : top0;
        if (p.x < p.r) { p.x = p.r; if (p.vx < 0) p.vx = -p.vx * e; }
        if (p.x > W - p.r) { p.x = W - p.r; if (p.vx > 0) p.vx = -p.vx * e; }
        if (p.y > FLOOR - p.r) { p.y = FLOOR - p.r; if (p.vy > 0) p.vy = -p.vy * e; }
        if (p.y < top + p.r) { p.y = top + p.r; if (p.vy < 0) p.vy = -p.vy * e; }
      }
    }

    function collide() {
      for (let i = 0; i < N; i++) {
        const a = ps[i];
        for (let j = i + 1; j < N; j++) {
          const b = ps[j];
          if (a.bond === j) continue;
          const ga = a.ph === 'G', gb = b.ph === 'G';
          const cond = !ga && !gb;
          const rr = cond ? (a.ph === 'L' && b.ph === 'L' ? (a.ir + b.ir) * gap : (a.r + b.r) * gap) : a.r + b.r;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dd = dx * dx + dy * dy;
          if (dd >= rr * rr || dd < 1e-9) continue;
          const d = Math.sqrt(dd), nx = dx / d, ny = dy / d, ov = rr - d;
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (ga && gb) {
            // elastischer Stoß gleicher Massen: Normalkomponenten tauschen
            if (vn < 0) { a.vx += vn * nx; a.vy += vn * ny; b.vx -= vn * nx; b.vy -= vn * ny; }
            a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
          } else if (ga || gb) {
            // Gasteilchen prallt an Flüssigkeit oder Feststoff ab
            const g = ga ? a : b, c = ga ? b : a, sgn = ga ? -1 : 1;
            const rel = ((g.vx - c.vx) * nx + (g.vy - c.vy) * ny) * sgn;
            if (rel < 0) {
              g.vx -= 2 * rel * nx * sgn; g.vy -= 2 * rel * ny * sgn;
              if (c.ph === 'L') { c.vx += rel * nx * sgn * 0.15; c.vy += rel * ny * sgn * 0.15; }
            }
            const mc = c.ph === 'L' ? 0.15 : 0;
            g.x += nx * sgn * ov * (1 - mc); g.y += ny * sgn * ov * (1 - mc);
            c.x -= nx * sgn * ov * mc; c.y -= ny * sgn * ov * mc;
          } else {
            // dicht gepackt: sanft auseinanderschieben, Annäherung dämpfen
            const ma = a.ph === 'L' ? 1 : 0.1, mb = b.ph === 'L' ? 1 : 0.1;
            const sa = ma / (ma + mb), sb = mb / (ma + mb);
            a.x -= nx * ov * sa * 0.6; a.y -= ny * ov * sa * 0.6;
            b.x += nx * ov * sb * 0.6; b.y += ny * ov * sb * 0.6;
            if (vn < 0) { a.vx += vn * nx * sa * 0.8; a.vy += vn * ny * sa * 0.8; b.vx -= vn * nx * sb * 0.8; b.vy -= vn * ny * sb * 0.8; }
          }
        }
      }
    }
    /** Gaspaare (Kochsalz) bleiben als Paar zusammen und drehen sich frei. */
    function bonds() {
      for (const a of ps) {
        if (a.bond < a.i) continue;
        const b = ps[a.bond];
        if (a.ph !== 'G' || b.ph !== 'G') { a.bond = -1; b.bond = -1; continue; }
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const nx = dx / d, ny = dy / d;
        const diff = (d - (a.r + b.r)) * 0.5 * Math.min(1, 0.35 + 0.65 * Math.min(a.wg, b.wg));
        a.x += nx * diff; a.y += ny * diff; b.x -= nx * diff; b.y -= ny * diff;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        a.vx += nx * rel * 0.5; a.vy += ny * rel * 0.5; b.vx -= nx * rel * 0.5; b.vy -= ny * rel * 0.5;
      }
    }

    // ------------------------------------------------------------ Startaufstellung
    /** Teilchen sofort passend zu den Anteilen aufstellen (Start, Stoffwechsel, Neuladen). */
    function init(e) {
      env = Object.assign({}, env, e);
      for (const s of slots) s.occ = -1;
      for (const s of plate) s.occ = -1;
      const tg = targets(env.shares);
      const th = temps();
      for (const p of ps) { p.ph = null; p.slot = -1; p.pslot = -1; p.bond = -1; p.vx = 0; p.vy = 0; p.va = 0; }
      const byKind = (k) => ps.filter((p) => p.kind === k && !p.ph);
      // fest: Plätze nach Rangfolge (unten innen zuerst)
      for (let k = 0; k < unit; k++) {
        const list = slots.filter((s) => s.kind === k).sort((a, b) => a.prio - b.prio).slice(0, tg.S / unit);
        const pool = byKind(k);
        list.forEach((s, n) => { const p = pool[n]; p.ph = 'S'; p.slot = slots.indexOf(s); s.occ = p.i; p.x = s.x; p.y = s.y; p.a = s.a; });
      }
      plate.slice().sort((a, b) => a.prio - b.prio).slice(0, tg.P).forEach((s) => {
        const p = byKind(0)[0]; p.ph = 'P'; p.pslot = plate.indexOf(s); s.occ = p.i; p.x = s.x; p.y = s.y; p.a = s.a;
      });
      // flüssig: dichte Schicht am Boden neben bzw. über dem Feststoff
      const rmax = Math.max.apply(null, P.kinds.map((k) => k.r));
      const sp = 2 * rmax * 1.04;
      const solids = ps.filter((p) => p.ph === 'S');
      const free = [];
      for (let y = FLOOR - rmax; y > rmax && free.length < N; y -= sp * 0.88) {
        for (let x = rmax + (free.length % 2) * sp * 0.5; x < W - rmax; x += sp) {
          if (!solids.some((s) => d2(s, x, y) < sp * sp)) free.push({ x, y });
        }
      }
      let li = 0;
      const rest = ps.filter((p) => !p.ph);
      // gleich viele Teilchen je Sorte in Flüssigkeit und Gas
      const nL = tg.L / unit;
      for (let k = 0; k < unit; k++) {
        rest.filter((p) => p.kind === k).forEach((p, n) => { if (n < nL) p.ph = 'L'; });
      }
      ps.filter((p) => p.ph === 'L').sort(() => R() - 0.5).forEach((p) => { const f = free[li++] || { x: W / 2, y: H / 2 }; p.x = f.x + (R() - 0.5) * 0.4; p.y = f.y; p.a = TAU * R(); });
      const liquidTop = li ? free[li - 1].y - rmax : FLOOR;
      const top = (plate.length && tg.P) || env.coldVis > 0.01 ? PLATE_Y + 8 : rmax + 1;
      const gas = ps.filter((p) => !p.ph);
      const placed = ps.filter((p) => p.ph);
      const vg = gasSpeed(th);
      for (const p of gas) {
        if (p.ph) continue;
        p.ph = 'G'; p.spin = (R() < 0.5 ? -1 : 1) * (2 + 3 * R());
        const partner = unit === 2 && P.pairsInGas ? gas.find((q) => !q.ph && q.kind !== p.kind) : null;
        let x = W / 2, y = H / 2;
        const bottom = Math.max(top + 4, Math.min(FLOOR - rmax, liquidTop - rmax));
        for (let tries = 0; tries < 60; tries++) {
          x = rmax + 2 + R() * (W - 2 * rmax - 4); y = top + R() * Math.max(1, bottom - top);
          if (!placed.some((q) => d2(q, x, y) < (q.r + p.r + 1.5) ** 2)) break;
        }
        p.x = x; p.y = y; p.a = TAU * R();
        const ang = TAU * R();
        p.vx = Math.cos(ang) * vg; p.vy = Math.sin(ang) * vg;
        placed.push(p);
        if (partner) {
          partner.ph = 'G'; partner.x = x + p.r + partner.r; partner.y = y; partner.vx = p.vx; partner.vy = p.vy;
          p.bond = partner.i; partner.bond = p.i; placed.push(partner);
        }
      }
      for (const p of ps) { p.ws = p.ph === 'S' ? 1 : 0; p.wl = p.ph === 'L' ? 1 : 0; p.wg = p.ph === 'G' ? 1 : 0; p.wp = p.ph === 'P' ? 1 : 0; }
      for (let n = 0; n < 40; n++) step(DT);
      carry = 0;
    }

    function advance(sec, e) {
      if (e) env = Object.assign({}, env, e);
      carry += Math.min(0.1, Math.max(0, sec));
      let n = 0;
      while (carry >= DT - 1e-9) { step(DT); carry -= DT; n++; }
      return n;
    }

    // ------------------------------------------------------------ Kennzahlen (Tests, Bildschirmleser)
    function metrics() {
      const out = { counts: counts(), speed: {}, slotDev: 0, nn: {}, yMin: {}, yMax: {}, bondsOk: true };
      const by = { S: [], L: [], G: [], P: [] };
      ps.forEach((p) => by[p.ph].push(p));
      for (const k of Object.keys(by)) {
        const l = by[k];
        if (!l.length) continue;
        out.speed[k] = l.reduce((a, p) => a + Math.hypot(p.vx, p.vy), 0) / l.length;
        out.nn[k] = l.reduce((a, p) => {
          let m = Infinity;
          for (const q of ps) if (q !== p && q.bond !== p.i) m = Math.min(m, Math.sqrt(d2(q, p.x, p.y)) / (p.r + q.r));
          return a + m;
        }, 0) / l.length;
        out.yMin[k] = Math.min.apply(null, l.map((p) => p.y));
        out.yMax[k] = Math.max.apply(null, l.map((p) => p.y));
      }
      if (by.S.length) out.slotDev = by.S.reduce((a, p) => a + Math.sqrt(d2(p, slots[p.slot].x, slots[p.slot].y)) / p.r, 0) / by.S.length;
      for (const p of by.G) if (unit === 2 && P.pairsInGas && (p.bond < 0 || Math.abs(Math.sqrt(d2(ps[p.bond], p.x, p.y)) - p.r - ps[p.bond].r) > 0.6)) out.bondsOk = false;
      out.radii = ps.map((p) => p.r);
      return out;
    }

    return {
      W, H, PLATE_Y, FLOOR, ps, slots, plate, sub,
      get t() { return t; }, get env() { return env; },
      init, advance, step, counts, targets, metrics, plateVisible
    };
  }

  return { createSystem, W, H, DT, PLATE_Y, FLOOR };
});
