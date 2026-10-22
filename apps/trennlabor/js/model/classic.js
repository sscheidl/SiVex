/*
 * Trennlabor – Modell „Klassische Trennverfahren“ (ohne DOM)
 *
 * Stoffmengenmodell für Gefäße mit Wasser, Öl, gelöstem Salz, gelösten
 * Hibiskusfarbstoffen und Feststoffteilchen (Sand grob/fein, Eisen,
 * Salzkristalle, Blütenteile, feine Pflanzenteilchen). Jede Feststoffart liegt
 * als Bodensatz („set“) oder aufgewirbelt („sus“) vor.
 *
 * Alle Vorgänge (Umgießen, Absetzen, Lösen, Filtrieren, Eindampfen,
 * Ablassen am Scheidetrichter, Ausziehen der Farbstoffe) laufen in festen
 * Zeitschritten über die simulierte Zeit. Stoffe werden nur verschoben,
 * nie erzeugt oder vernichtet: Verluste landen in eigenen „Verlustgefäßen“
 * (Ausguss, Tisch, verdampft, verspritzt), sodass die Mengenbilanz jederzeit
 * aufgeht. Einzelheiten und Quellen: docs/CHEMIE.md, Abschnitt 2.
 */
(function (root, factory) {
  const util = typeof module === 'object' && module.exports ? require('../util.js') : root.TL.util;
  const api = factory(util);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).classic = api;
})(typeof self !== 'undefined' ? self : this, function (util) {
  'use strict';
  const { clamp, interp, clone, fmt } = util;

  const H = 0.05; // Simulationsschritt in s
  const ROOM = 20;

  // ------------------------------------------------------------ Stoffdaten
  /** Feststoffarten. tau: Absetzzeit in s, mob: wie leicht aufgewirbelt. */
  const PARTICLES = {
    sandC: { name: 'Sand (grob)', tau: 2.5, mob: 0.6 },
    sandF: { name: 'Sand (fein)', tau: 30, mob: 1.0 },
    iron: { name: 'Eisenpulver', tau: 1.5, mob: 0.3, magnetic: true },
    saltX: { name: 'Kochsalz (fest)', tau: 1.5, mob: 0.5 },
    petals: { name: 'Hibiskusblüten', tau: 40, mob: 1.0 },
    frag: { name: 'feine Pflanzenteilchen', tau: 90, mob: 1.0 }
  };
  const PKEYS = Object.keys(PARTICLES);

  /** Löslichkeit von NaCl in g je mL Wasser (≈ g/g), nach Temperatur (Literaturwerte, s. CHEMIE.md). */
  const SALT_SOL = [[0, 0.357], [20, 0.359], [40, 0.364], [60, 0.371], [80, 0.380], [100, 0.392]];
  const saltSolubility = (T) => interp(SALT_SOL, T);

  /** Geschwindigkeitskonstante des Ausziehens der Hibiskusfarbstoffe (1/s), Arrhenius-Ansatz. */
  const EXTRACT_K90 = 1 / 150, EXTRACT_EA_R = 3940; // k(20 °C) ≈ 1/2000 s
  const extractK = (T) => EXTRACT_K90 * Math.exp(-EXTRACT_EA_R * (1 / (T + 273.15) - 1 / 363.15));
  const DYE_PER_G = 100; // mg ausziehbare Farbstoffe je g getrockneter Blüten (Modellgröße)
  const FRAG_SHARE = 0.05; // Anteil feiner Teilchen an den Blüten

  // Kapazitäten (mL) und Raten (mL/s bzw. 1/s)
  const CAP = { beaker: 250, small: 150, funnel: 55, dish: 70, sep: 250 };
  const POUR = { slow: 5, fast: 15, all: 12 };
  const FILTER = { paper: 0.35, paperFlat: 0.45, sieve: 3, none: 4 };
  const HOLD = { paper: 2.5, paperFlat: 2.5, sieve: 0.3, none: 0 };
  const SEP_RATE = 1.0; // mL/s bei ganz geöffnetem Hahn
  const BURNER_W = [0, 90, 220]; // wirksame Heizleistung an der Abdampfschale (W)
  const L_VAP = 2257; // J/g Verdampfungswärme Wasser

  // ------------------------------------------------------------ Gefäßinhalt
  function emptyContents() {
    const p = {};
    for (const k of PKEYS) p[k] = { set: 0, sus: 0 };
    return { water: 0, oil: 0, disp: 0, salt: 0, dye: 0, petalDye: 0, p, T: ROOM, agit: 0 };
  }
  const pm = (c, k) => c.p[k].set + c.p[k].sus;
  const sandOf = (c) => pm(c, 'sandC') + pm(c, 'sandF');
  const solidsMass = (c) => PKEYS.reduce((s, k) => s + pm(c, k), 0);
  const liquidVol = (c) => c.water + c.oil;
  const plantMass = (c) => pm(c, 'petals') + pm(c, 'frag');
  const susMass = (c) => PKEYS.reduce((s, k) => s + c.p[k].sus, 0);

  /** Trübung: aufgewirbelte Feststoffe in g je 100 mL Flüssigkeit. */
  function turbidity(c) {
    const v = liquidVol(c);
    if (v < 0.5) return 0;
    return susMass(c) / v * 100;
  }
  function turbidityClass(t) { return t < 0.1 ? 'klar' : t < 0.6 ? 'leicht trüb' : 'trüb'; }

  /** Anteil f aller Bestandteile eines Inhalts als neuen Inhalt herauslösen (Teilchen: set und sus). */
  function takeFraction(c, f, opts) {
    const o = Object.assign({ settled: true }, opts);
    const out = emptyContents();
    f = clamp(f, 0, 1);
    for (const key of ['water', 'oil', 'disp', 'salt', 'dye']) { out[key] = c[key] * f; c[key] -= out[key]; }
    const plantBefore = plantMass(c);
    for (const k of PKEYS) {
      const s = c.p[k].sus * f; out.p[k].sus = s; c.p[k].sus -= s;
      if (o.settled) { const t = c.p[k].set * f; out.p[k].set = t; c.p[k].set -= t; }
    }
    movePetalDye(c, out, plantBefore);
    out.T = c.T;
    return out;
  }

  /** Im Pflanzenmaterial gebundene Farbstoffe wandern anteilig mit den Blütenteilen. */
  function movePetalDye(from, to, plantBefore) {
    if (plantBefore <= 1e-9 || from.petalDye <= 0) return;
    const share = clamp(plantMass(to) / plantBefore, 0, 1);
    const d = from.petalDye * share;
    to.petalDye += d; from.petalDye -= d;
  }

  /** Inhalt b in a hineingeben (Temperatur nach Wärmekapazität gemischt). */
  function merge(a, b) {
    const ca = heatCap(a), cb = heatCap(b);
    if (ca + cb > 1e-9) a.T = (a.T * ca + b.T * cb) / (ca + cb);
    for (const key of ['water', 'oil', 'disp', 'salt', 'dye', 'petalDye']) a[key] += b[key];
    for (const k of PKEYS) { a.p[k].set += b.p[k].set; a.p[k].sus += b.p[k].sus; }
    a.agit = Math.max(a.agit, Math.min(0.25, b.agit + 0.15));
    return a;
  }
  const heatCap = (c) => c.water * 4.18 + c.oil * 1.7 + solidsMass(c) * 0.8;

  /**
   * Flüssigkeit von oben entnehmen (Ausgießen): zuerst die abgesetzte Ölschicht,
   * dann die wässrige Phase mit allem, was darin gelöst oder aufgewirbelt ist.
   */
  function extractTop(c, vol) {
    const out = emptyContents();
    out.T = c.T;
    const layer = Math.max(0, c.oil - c.disp);
    const a = Math.min(vol, layer);
    out.oil += a; c.oil -= a; vol -= a;
    const aq = c.water + c.disp;
    if (vol > 1e-9 && aq > 1e-9) {
      const f = Math.min(1, vol / aq);
      const part = takeFraction(c, f, { settled: false });
      // takeFraction nimmt Öl anteilig – hier nur das verteilte Öl der wässrigen Phase
      c.oil += part.oil - part.disp; part.oil = part.disp;
      merge(out, part);
    }
    return out;
  }

  /** Flüssigkeit von unten ablassen (Scheidetrichter): zuerst die wässrige Phase, dann das Öl. */
  function extractBottom(c, vol) {
    const out = emptyContents();
    out.T = c.T;
    const aq = c.water + c.disp;
    if (aq > 1e-9) {
      const a = Math.min(vol, aq);
      const f = a / aq;
      const part = takeFraction(c, f, { settled: true });
      c.oil += part.oil - part.disp; part.oil = part.disp;
      merge(out, part);
      vol -= a;
    }
    if (vol > 1e-9 && c.oil > 1e-9) {
      const b = Math.min(vol, c.oil);
      out.oil += b; c.oil -= b;
      c.disp = Math.min(c.disp, c.oil);
    }
    return out;
  }

  // ------------------------------------------------------------ Gerätebestand
  const VESSEL_NAMES = { B1: 'Becherglas 1', B2: 'Becherglas 2', B3: 'Becherglas 3' };
  const PLACE_NAMES = { bench1: 'auf dem Tisch', bench2: 'auf dem Tisch', bench3: 'auf dem Tisch', filter: 'unter dem Trichter', sep: 'unter dem Scheidetrichter', moving: 'wird umgestellt' };
  const CONTAINER_NAMES = {
    B1: 'Becherglas 1', B2: 'Becherglas 2', B3: 'Becherglas 3', F: 'Trichter', D: 'Abdampfschale',
    S: 'Scheidetrichter', E: 'Uhrglas (Eisen)', R: 'Uhrglas (Filterrückstand)',
    waste: 'Ausguss', table: 'Tisch (verschüttet)', vapor: 'verdampft', splatter: 'verspritzt'
  };
  const LOST = ['waste', 'table', 'vapor', 'splatter'];

  /**
   * setup: {
   *   equip: { funnel, dish, sep, magnet, water, kettle, hibiscus, rod },
   *   vessels: { B1: {cap, contents…}, B2: {…}, B3: {…} },
   *   hibiscusStock: g
   * }
   */
  function create(setup) {
    const ev = util.emitter();
    const st = {
      kind: 'classic',
      t: 0,
      equip: Object.assign({ funnel: false, dish: false, sep: false, magnet: false, water: true, kettle: false, hibiscus: false, rod: true }, setup.equip),
      vessels: {},
      F: null, insert: null, D: null, burner: 0, S: null, stopper: false, tap: 0, vac: 0,
      E: null, R: null,
      lost: { waste: emptyContents(), table: emptyContents(), vapor: emptyContents(), splatter: emptyContents() },
      added: { water: 0, hibiscus: 0 },
      hibiscusStock: setup.hibiscusStock || 0,
      initial: null,
      op: null,
      selected: null,
      log: [],
      extractions: [],
      fx: { funnelFlow: 0, funnelBypass: 0, sepFlow: 0, steam: 0, spatter: 0, overflow: 0, tableDrip: 0 },
      warned: {}
    };
    const benchSlots = ['bench1', 'bench2', 'bench3'];
    Object.keys(setup.vessels || {}).forEach((id, i) => {
      const v = setup.vessels[id];
      const c = emptyContents();
      if (v.water) c.water = v.water;
      if (v.oil) { c.oil = v.oil; c.disp = v.disp != null ? v.disp : 0; }
      if (v.T != null) c.T = v.T;
      if (v.saltSolid) c.p.saltX.set = v.saltSolid;
      if (v.salt) c.salt = v.salt;
      if (v.sand) { c.p.sandC.set = v.sand * 0.9; c.p.sandF.set = v.sand * 0.1; }
      if (v.iron) c.p.iron.set = v.iron;
      if (v.stirred) { for (const k of PKEYS) { c.p[k].sus = c.p[k].set * PARTICLES[k].mob; c.p[k].set -= c.p[k].sus; } c.agit = 0.4; }
      st.vessels[id] = { id, size: v.size || 'beaker', cap: v.cap || CAP.beaker, place: v.place || benchSlots[i], c };
    });
    if (st.equip.funnel) st.F = emptyContents();
    if (st.equip.dish) st.D = emptyContents();
    if (st.equip.sep) st.S = emptyContents();
    if (st.equip.magnet) st.E = emptyContents();
    if (st.equip.funnel) st.R = emptyContents();
    st.initial = totals(st);

    const stepper = util.stepper(H, step);

    // ---------------------------------------------------------- Zugriff
    function container(id) {
      if (st.vessels[id]) return st.vessels[id].c;
      if (id === 'F') return st.F;
      if (id === 'D') return st.D;
      if (id === 'S') return st.S;
      if (id === 'E') return st.E;
      if (id === 'R') return st.R;
      if (st.lost[id]) return st.lost[id];
      return null;
    }
    const capOf = (id) => (st.vessels[id] ? st.vessels[id].cap : id === 'F' ? CAP.funnel : id === 'D' ? CAP.dish : id === 'S' ? CAP.sep : Infinity);
    const nameOf = (id) => CONTAINER_NAMES[id] || id;
    const vesselAt = (place) => Object.values(st.vessels).find((v) => v.place === place) || null;
    const busy = () => !!st.op;
    const log = (type, data) => { st.log.push(Object.assign({ t: +st.t.toFixed(2), type }, data)); ev.emit('log', st.log[st.log.length - 1]); };
    const msg = (text, kind) => ev.emit('message', { text, kind: kind || 'info' });
    const fail = (text, key) => { msg(text, 'warn'); if (key) mistake(key); return { ok: false, message: text }; };
    function mistake(key) { log('mistake', { key }); ev.emit('mistake', { key }); }

    /** Inhalt in ein Ziel geben; Überlauf landet auf dem Tisch. */
    function deliver(portion, to) {
      const target = container(to);
      if (!target) { merge(st.lost.table, portion); return; }
      const free = capOf(to) - liquidVol(target) - solidsMass(target) * 0.6;
      const vol = liquidVol(portion) + solidsMass(portion) * 0.6;
      if (vol > free + 1e-9 && !LOST.includes(to)) {
        const fIn = clamp(free / vol, 0, 1);
        const over = takeFraction(portion, 1 - fIn);
        merge(st.lost.table, over);
        st.fx.overflow = 1;
        if (!st.warned['over' + to]) { st.warned['over' + to] = true; msg(`${nameOf(to)} läuft über – Flüssigkeit geht auf den Tisch verloren.`, 'warn'); mistake('overflow'); }
      }
      merge(target, portion);
    }

    // ---------------------------------------------------------- Prozesse je Gefäß
    function processContainer(c, h, opts) {
      const o = opts || {};
      // Aufwirbeln und Absetzen
      for (const k of PKEYS) {
        const P = PARTICLES[k];
        const tot = c.p[k].set + c.p[k].sus;
        if (tot <= 0) continue;
        const inLiquid = liquidVol(c) > tot * 0.25 + 0.5;
        const target = inLiquid ? clamp(c.agit * P.mob, 0, 1) * tot : 0;
        if (c.p[k].sus < target) {
          const d = (target - c.p[k].sus) * (1 - Math.exp(-h / 0.3));
          c.p[k].sus += d; c.p[k].set -= d;
        } else {
          const tau = inLiquid ? P.tau : 0.2;
          const d = (c.p[k].sus - target) * (1 - Math.exp(-h / tau));
          c.p[k].sus -= d; c.p[k].set += d;
        }
        if (c.p[k].set < 0) c.p[k].set = 0;
      }
      // Salz lösen bzw. auskristallisieren
      const cap = saltSolubility(c.T) * c.water;
      const solid = pm(c, 'saltX');
      if (c.water > 0.05 && solid > 1e-9 && c.salt < cap) {
        const k = 0.015 + 0.6 * c.agit + (o.flowing ? 0.05 : 0);
        const d = Math.min(solid, cap - c.salt) * (1 - Math.exp(-k * h));
        const fs = c.p.saltX.sus / solid;
        c.p.saltX.sus -= d * fs; c.p.saltX.set -= d * (1 - fs);
        c.salt += d;
      } else if (c.salt > cap + 1e-9) {
        const d = (c.salt - cap) * (1 - Math.exp(-h / 0.8));
        c.salt -= d; c.p.saltX.set += d;
      }
      // Farbstoffe aus den Blüten ausziehen (nur mit Wasser)
      if (c.petalDye > 1e-6 && c.water > 1) {
        const k = extractK(c.T) * (1 + 0.6 * c.agit);
        const d = c.petalDye * (1 - Math.exp(-k * h));
        c.petalDye -= d; c.dye += d;
      }
      // Öl: Verteilen beim Rühren, Entmischen in Ruhe
      if (c.oil > 0) {
        const target = c.agit * 0.6 * c.oil;
        if (c.disp < target) c.disp += (target - c.disp) * (1 - Math.exp(-h / 0.5));
        else c.disp -= (c.disp - target) * (1 - Math.exp(-h / 15));
        c.disp = clamp(c.disp, 0, c.oil);
      } else c.disp = 0;
      // Abklingen der Bewegung
      if (!o.keepAgit) c.agit *= Math.exp(-h / 1.0);
      // Abkühlen auf Raumtemperatur (Becherglas)
      if (!o.heated && c.T !== ROOM) c.T = ROOM + (c.T - ROOM) * Math.exp(-h / 900);
    }

    function stepFunnel(h) {
      if (!st.F) return;
      const F = st.F;
      const ins = st.insert || 'none';
      const hold = HOLD[ins];
      const liq = liquidVol(F);
      st.fx.funnelFlow = 0; st.fx.funnelBypass = 0;
      const drainable = liq - hold;
      if (drainable > 1e-6) {
        const head = clamp(liq / 25, 0.3, 1);
        const v = Math.min(drainable, FILTER[ins] * head * h);
        const f = v / liq;
        const out = emptyContents();
        out.T = F.T;
        // Flüssigkeit samt Gelöstem (Öl durch Papier langsamer – trennt aber nicht)
        const oilF = ins === 'paper' || ins === 'paperFlat' ? f * 0.6 : f;
        for (const key of ['water', 'salt', 'dye']) { const d = F[key] * f; out[key] += d; F[key] -= d; }
        const dOil = F.oil * oilF; out.oil += dOil; F.oil -= dOil; F.disp = Math.min(F.disp, F.oil);
        // Feststoffe
        const plantBefore = plantMass(F);
        for (const k of PKEYS) {
          let pass = 0;
          if (ins === 'none') pass = 1;
          else if (ins === 'sieve') pass = k === 'petals' ? 0 : k === 'frag' ? 0.5 : 1;
          else if (ins === 'paperFlat') pass = k === 'sandF' || k === 'frag' ? 0.5 : k === 'sandC' ? 0.15 : 0.1;
          if (!pass) continue;
          const fp = clamp(f * 3 * pass, 0, 1);
          for (const w of ['sus', 'set']) { const d = F.p[k][w] * fp; out.p[k].sus += d; F.p[k][w] -= d; }
        }
        movePetalDye(F, out, plantBefore);
        st.fx.funnelFlow = v / h;
        st.fx.funnelBypass = ins === 'paperFlat' && susMass(out) > 1e-4 ? 1 : 0;
        const rec = vesselAt('filter');
        if (rec) { deliver(out, rec.id); st.warned.funnelTable = false; }
        else {
          merge(st.lost.table, out);
          st.fx.tableDrip = 1;
          if (!st.warned.funnelTable) { st.warned.funnelTable = true; msg('Unter dem Trichter steht kein Gefäß – das Filtrat tropft auf den Tisch.', 'warn'); mistake('noReceiver'); }
        }
        if (out.water + out.oil > 0) {
          if (!st.warned.filtrateNote) { st.warned.filtrateNote = true; log('filtrate', { insert: ins }); }
        }
      }
      // Ohne Einsatz rieseln trockene Feststoffe durch das Trichterrohr
      if (ins === 'none' && liquidVol(F) < 0.01 && solidsMass(F) > 1e-6) {
        const out = takeFraction(F, 1 - Math.exp(-h / 1.5));
        const rec = vesselAt('filter');
        if (rec) deliver(out, rec.id); else { merge(st.lost.table, out); st.fx.tableDrip = 1; }
        st.fx.funnelFlow = Math.max(st.fx.funnelFlow, 0.5);
      }
      processContainer(F, h, { flowing: drainable > 0 });
    }

    function stepSep(h) {
      if (!st.S) return;
      const S = st.S;
      st.fx.sepFlow = 0;
      if (st.tap > 0 && liquidVol(S) > 1e-6) {
        let rate = SEP_RATE * st.tap;
        if (st.stopper) rate *= Math.max(0, 1 - st.vac / 1.5);
        const v = Math.min(liquidVol(S), rate * h);
        if (v > 1e-9) {
          st.vac += st.stopper ? v : 0;
          const out = extractBottom(S, v);
          st.fx.sepFlow = v / h;
          const rec = vesselAt('sep');
          if (rec) { deliver(out, rec.id); st.warned.sepTable = false; }
          else {
            merge(st.lost.table, out);
            st.fx.tableDrip = 1;
            if (!st.warned.sepTable) { st.warned.sepTable = true; msg('Unter dem Scheidetrichter steht kein Gefäß – die Flüssigkeit läuft auf den Tisch.', 'warn'); mistake('sepNoReceiver'); }
          }
        } else if (st.stopper && !st.warned.vac) {
          st.warned.vac = true;
          msg('Der Abfluss stockt: Mit aufgesetztem Stopfen entsteht im Scheidetrichter ein Unterdruck.', 'warn');
          mistake('stopperVacuum');
        }
      }
      processContainer(S, h);
    }

    function stepDish(h) {
      if (!st.D) return;
      const D = st.D;
      const P = BURNER_W[st.burner];
      const loss = 0.2 * (D.T - ROOM);
      const C = heatCap(D) + 80;
      st.fx.steam = 0; st.fx.spatter = 0;
      if (P > 0 || D.T > ROOM + 0.01) {
        if (D.water > 0.001 && D.T >= 99.95) {
          D.T = 100;
          const net = P - loss;
          if (net > 0) {
            const v = Math.min(D.water, net / L_VAP * h);
            D.water -= v; st.lost.vapor.water += v;
            st.fx.steam = clamp(net / 200, 0, 1);
            if (D.water < 0.002) { st.lost.vapor.water += D.water; D.water = 0; }
          } else D.T += net / C * h;
        } else {
          D.T += (P - loss) / C * h;
          if (D.water > 0.001) D.T = Math.min(D.T, 100);
          D.T = Math.min(D.T, 420);
        }
      }
      // Spritzen beim starken Erhitzen fast trockener Salzkristalle
      const xs = pm(D, 'saltX');
      if (st.burner === 2 && xs > 0.01 && D.water < 3 && D.T >= 99) {
        const rate = D.water > 0.001 ? 0.004 : 0.001;
        const f = 1 - Math.exp(-rate * h);
        const out = takeFraction(D, f, { settled: true });
        // nur Feststoffe und Lösung spritzen, kein Dampf
        merge(st.lost.splatter, out);
        st.fx.spatter = 1;
        if (!st.warned.spatter) { st.warned.spatter = true; msg('Es knistert und spritzt: Fast trockenes Salz springt bei starker Flamme aus der Schale. Zum Schluss nur schwach erhitzen.', 'warn'); mistake('spatter'); }
      }
      if (xs > 0.05 && D.water < 0.01 && !st.warned.dry && st.burner > 0) { st.warned.dry = true; log('evaporatedDry', {}); msg('Das Wasser ist verdampft – in der Schale bleibt ein Feststoff zurück.', 'success'); }
      processContainer(D, h, { heated: st.burner > 0 || D.T > ROOM });
    }

    // ---------------------------------------------------------- laufende Handlungen
    function stepOp(h) {
      const op = st.op;
      if (!op) return;
      op.t += h;
      if (op.type === 'pour') {
        const src = container(op.from);
        if (op.mode === 'fast') src.agit = Math.max(src.agit, 0.4);
        else if (op.mode === 'slow') src.agit = Math.max(src.agit, 0.01);
        let rate = POUR[op.mode];
        // vorsichtiges Eingießen in den Trichter: so, dass er nicht überläuft (nur zügiges Gießen läuft über)
        if (op.to === 'F' && op.mode !== 'fast') {
          const free = CAP.funnel * 0.9 - liquidVol(st.F) - solidsMass(st.F) * 0.6;
          rate = clamp(free / h, 0, rate);
        }
        const sediment = solidsMass(src) - susMass(src);
        const residual = op.mode === 'all' ? 0 : 1.5 + 0.3 * sediment;
        const avail = liquidVol(src) - residual;
        if (avail > 1e-6) {
          const portion = extractTop(src, Math.min(avail, rate * h));
          deliver(portion, op.to);
          op.moved += liquidVol(portion);
        } else if (op.mode === 'all' && solidsMass(src) > 1e-6 && op.to === 'F' && rate < 3) {
          // Trichter noch zu voll: warten, bis Flüssigkeit durchgelaufen ist
        } else if (op.mode === 'all' && solidsMass(src) > 1e-6) {
          // Bodensatz rutscht mit dem Rest der Flüssigkeit hinterher; Reste bleiben an der Glaswand
          op.sedT = (op.sedT || 0) + h;
          const portion = takeFraction(src, 1 - Math.exp(-2 * h));
          deliver(portion, op.to);
          op.moved += solidsMass(portion);
          if (op.sedT > 2) return finishPour(op);
        } else {
          return finishPour(op);
        }
        op.waiting = op.to === 'F' && op.mode !== 'fast' && rate < 1e-6;
        if (op.t > 1500) finishPour(op);
      } else if (op.type === 'water') {
        const v = Math.min(op.amount - op.done, 8 * h);
        const portion = emptyContents();
        portion.water = v; portion.T = op.temp; portion.agit = 0.2;
        st.added.water += v;
        deliver(portion, op.to);
        container(op.to).agit = Math.max(container(op.to).agit, 0.25);
        op.done += v;
        if (op.done >= op.amount - 1e-9) { st.op = null; log('water', { to: op.to, amount: op.amount, temp: op.temp }); noteExtraction(op.to); ev.emit('change', {}); }
      } else if (op.type === 'stir') {
        const c = container(op.target);
        c.agit = 1;
        if (op.t >= op.dur) { st.op = null; log('stir', { target: op.target }); ev.emit('change', {}); }
      } else if (op.type === 'shake') {
        st.S.agit = 1;
        if (op.t >= op.dur) { st.op = null; log('shake', {}); ev.emit('change', {}); }
      } else if (op.type === 'magnet') {
        if (op.t >= op.dur) {
          const c = container(op.target);
          const iron = pm(c, 'iron');
          const f = 0.85;
          for (const w of ['set', 'sus']) { const d = c.p.iron[w] * f; c.p.iron[w] -= d; st.E.p.iron.set += d; }
          st.op = null;
          log('magnet', { target: op.target, amount: iron * f });
          msg(iron > 0.01 ? `Der Magnet zieht ${fmt(iron * f)} g Eisen an. Es wird auf dem Uhrglas abgestreift.` : 'Der Magnet zieht nichts an.', iron > 0.01 ? 'success' : 'info');
          ev.emit('change', {});
        }
      } else if (op.type === 'move') {
        if (op.t >= op.dur) {
          st.vessels[op.vessel].place = op.to;
          st.op = null;
          ev.emit('change', {});
        }
      } else if (op.type === 'insert') {
        if (op.t >= op.dur) { st.insert = op.insert; st.op = null; log('insert', { insert: op.insert }); ev.emit('change', {}); }
      } else if (op.type === 'removeInsert') {
        if (op.t >= op.dur) {
          if (st.insert === 'paper' || st.insert === 'paperFlat' || st.insert === 'sieve') {
            const rest = takeFraction(st.F, 1);
            merge(st.R, rest);
          }
          st.insert = null;
          st.op = null;
          log('removeInsert', {});
          ev.emit('change', {});
        }
      } else if (op.type === 'hibiscus') {
        if (op.t >= op.dur) {
          const c = container(op.to);
          const g = op.g;
          c.p.petals.set += g * (1 - FRAG_SHARE) * 0.4; c.p.petals.sus += g * (1 - FRAG_SHARE) * 0.6;
          c.p.frag.sus += g * FRAG_SHARE;
          c.petalDye += g * DYE_PER_G;
          st.added.hibiscus += g; st.hibiscusStock -= g;
          st.op = null;
          log('hibiscus', { to: op.to, g });
          noteExtraction(op.to);
          ev.emit('change', {});
        }
      }
    }

    function finishPour(op) {
      st.op = null;
      log('pour', { from: op.from, to: op.to, mode: op.mode, moved: +op.moved.toFixed(2) });
      // Bewertung typischer Fehlhandlungen
      const portionTo = op.to;
      if (portionTo === 'waste' && op.saltBefore > 0.2 && op.saltBefore - container(op.from).salt > 0.2) {
        msg('Mit der Lösung ist auch das darin gelöste Salz im Ausguss gelandet.', 'warn');
        mistake('saltWasted');
      }
      if (portionTo === 'waste' && op.dyeBefore > 20 && op.dyeBefore - container(op.from).dye > 20) mistake('teaWasted');
      ev.emit('change', {});
    }

    /** Für K-05: Beginn eines Ausziehens mit Wassertemperatur festhalten. */
    function noteExtraction(id) {
      const c = container(id);
      if (!c || !st.vessels[id]) return;
      if (c.petalDye + c.dye > 1 && c.water > 5) {
        const open = st.extractions.find((e) => e.vessel === id && e.open);
        if (!open) st.extractions.push({ vessel: id, startT: +c.T.toFixed(1), start: +st.t.toFixed(2), contact: 0, open: true });
      }
    }

    function step(h) {
      st.t += h;
      st.fx.overflow = Math.max(0, st.fx.overflow - h * 2);
      st.fx.tableDrip = Math.max(0, st.fx.tableDrip - h);
      stepOp(h);
      const stirTarget = st.op && (st.op.type === 'stir') ? st.op.target : null;
      for (const v of Object.values(st.vessels)) processContainer(v.c, h, { keepAgit: stirTarget === v.id });
      stepFunnel(h);
      stepSep(h);
      stepDish(h);
      if (st.E) processContainer(st.E, h);
      if (st.R) processContainer(st.R, h);
      for (const e of st.extractions) {
        if (!e.open) continue;
        const c = container(e.vessel);
        if (c && c.water > 5 && plantMass(c) > 0.05) e.contact += h;
        else e.open = false;
      }
    }

    // ---------------------------------------------------------- Handlungen
    function guard() { if (busy()) return fail('Warte, bis die aktuelle Handlung abgeschlossen ist.'); return null; }
    const exists = (id) => !!container(id) && !LOST.includes(id);

    function pour(from, to, mode) {
      const g = guard(); if (g) return g;
      mode = mode || 'slow';
      if (!exists(from)) return fail('Dieses Gefäß gibt es hier nicht.');
      if (from === to) return fail('Quelle und Ziel sind dasselbe Gefäß.');
      if (!(to === 'waste' || exists(to))) return fail('Dieses Ziel gibt es hier nicht.');
      if (['F', 'E', 'R'].includes(from)) return fail('Aus diesem Gerät kann man nicht ausgießen.');
      if (from === 'S' && st.stopper) return fail('Nimm zuerst den Stopfen vom Scheidetrichter ab.');
      if (from === 'D' && st.D.T > 50) return fail('Die Abdampfschale ist heiß – lass sie erst abkühlen.');
      if (to === 'S' && st.stopper) return fail('Nimm zuerst den Stopfen ab, bevor du etwas in den Scheidetrichter gießt.');
      if (to === 'E' || to === 'R') return fail('Auf das Uhrglas gießt man keine Flüssigkeit.');
      const src = container(from);
      if (liquidVol(src) + solidsMass(src) < 0.05) return fail(`${nameOf(from)} ist leer.`);
      if (st.vessels[to] && st.vessels[to].place === 'moving') return fail('Das Zielgefäß wird gerade umgestellt.');
      if (to === 'F' && liquidVol(src) < 0.5 && solidsMass(src) > 0.05) {
        // trockenes Gemisch in den Filter
        log('dryToFilter', {});
        mistake('dryFilter');
      }
      if (to === 'F' && !st.insert && solidsMass(src) > 0.2) mistake('noPaper');
      if (mode !== 'all' && liquidVol(src) < 2 && solidsMass(src) > 0.05) mode = 'all';
      st.op = { type: 'pour', from, to, mode, t: 0, moved: 0, saltBefore: src.salt, dyeBefore: src.dye };
      if (mode === 'fast' && solidsMass(src) - susMass(src) > 1) mistake('fastPour');
      msg(`${nameOf(from)} → ${nameOf(to)}: ${mode === 'slow' ? 'vorsichtig abgießen' : mode === 'fast' ? 'zügig ausgießen' : 'vollständig umfüllen'} …`);
      ev.emit('change', {});
      return { ok: true };
    }

    function stopOp() {
      if (!st.op) return { ok: false };
      if (st.op.type === 'pour') return finishPour(st.op) || { ok: true };
      return { ok: false, message: 'Diese Handlung lässt sich nicht abbrechen.' };
    }

    function addWater(to, amount, temp) {
      const g = guard(); if (g) return g;
      if (!exists(to) || ['E', 'R'].includes(to)) return fail('Dorthin kann man kein Wasser geben.');
      if (to === 'S' && st.stopper) return fail('Nimm zuerst den Stopfen ab.');
      const T = temp === 'hot' ? 90 : ROOM;
      if (temp === 'hot' && !st.equip.kettle) return fail('Hier gibt es keinen Wasserkocher.');
      st.op = { type: 'water', to, amount: amount || 25, temp: T, done: 0, t: 0 };
      msg(`${amount} mL ${T > 50 ? 'heißes' : 'kaltes'} Wasser in ${nameOf(to)} …`);
      ev.emit('change', {});
      return { ok: true };
    }

    function stir(target) {
      const g = guard(); if (g) return g;
      if (!st.vessels[target] && target !== 'D') {
        if (target === 'F') return fail('Im Filter rührt man nicht – das Filterpapier könnte reißen.');
        if (target === 'S') return fail('Den Scheidetrichter verschließt man und schwenkt ihn, statt zu rühren.');
        return fail('Hier kann man nicht rühren.');
      }
      if (target === 'D' && st.D.T > 50) return fail('Die Schale ist heiß – Rühren ist hier nicht nötig.');
      const c = container(target);
      if (liquidVol(c) + solidsMass(c) < 0.05) return fail(`${nameOf(target)} ist leer.`);
      st.op = { type: 'stir', target, t: 0, dur: 3 };
      ev.emit('change', {});
      return { ok: true };
    }

    function moveVessel(id, to) {
      const g = guard(); if (g) return g;
      const v = st.vessels[id];
      if (!v) return fail('Dieses Gefäß gibt es nicht.');
      if (to === 'filter' && !st.equip.funnel) return fail('Hier gibt es keinen Trichter.');
      if (to === 'sep' && !st.equip.sep) return fail('Hier gibt es keinen Scheidetrichter.');
      if (to === 'bench') to = ['bench1', 'bench2', 'bench3'].find((p) => !vesselAt(p)) || null;
      if (!to) return fail('Auf dem Tisch ist kein Platz frei.');
      if (v.place === to) return { ok: true };
      const occ = vesselAt(to);
      if (occ) return fail(`Dort steht schon ${nameOf(occ.id)}.`);
      st.op = { type: 'move', vessel: id, to, from: v.place, t: 0, dur: 0.8 };
      v.place = 'moving';
      ev.emit('change', {});
      return { ok: true };
    }

    function insertFilter(kind) {
      const g = guard(); if (g) return g;
      if (!st.F) return fail('Hier gibt es keinen Trichter.');
      if (st.insert) return fail('Im Trichter steckt schon ein Einsatz. Nimm ihn zuerst heraus.');
      if (liquidVol(st.F) + solidsMass(st.F) > 0.05) return fail('Der Trichter ist nicht leer.');
      if (kind === 'sieve' && !st.equip.sieve) return fail('Hier gibt es kein Teesieb.');
      st.op = { type: 'insert', insert: kind, t: 0, dur: kind === 'paper' ? 1.6 : 0.8 };
      if (kind === 'paperFlat') mistake('paperFlat');
      ev.emit('change', {});
      return { ok: true };
    }

    function removeFilter() {
      const g = guard(); if (g) return g;
      if (!st.insert) return fail('Im Trichter steckt kein Einsatz.');
      if (liquidVol(st.F) > HOLD[st.insert] + 0.3) return fail('Warte, bis die Flüssigkeit durchgelaufen ist.');
      st.op = { type: 'removeInsert', t: 0, dur: 0.8 };
      ev.emit('change', {});
      return { ok: true };
    }

    function setBurner(level) {
      if (!st.equip.dish) return fail('Hier gibt es keinen Brenner.');
      st.burner = clamp(level | 0, 0, 2);
      if (st.burner > 0 && liquidVol(st.D) + solidsMass(st.D) < 0.05) msg('Die Abdampfschale ist leer – es gibt nichts einzudampfen.', 'warn');
      log('burner', { level: st.burner });
      ev.emit('change', {});
      return { ok: true };
    }

    function useMagnet(target) {
      const g = guard(); if (g) return g;
      if (!st.equip.magnet) return fail('Hier gibt es keinen Magneten.');
      if (!exists(target) || target === 'E') return fail('Hier kann man den Magneten nicht einsetzen.');
      if (target === 'S') return fail('In den Scheidetrichter passt der Magnet nicht.');
      const c = container(target);
      if (liquidVol(c) + solidsMass(c) < 0.05) return fail(`${nameOf(target)} ist leer.`);
      st.op = { type: 'magnet', target, t: 0, dur: 2 };
      ev.emit('change', {});
      return { ok: true };
    }

    function setTap(v) {
      if (!st.S) return fail('Hier gibt es keinen Scheidetrichter.');
      st.tap = v === 'open' ? 1 : v === 'drop' ? 0.15 : 0;
      log('tap', { tap: st.tap });
      ev.emit('change', {});
      return { ok: true };
    }

    function setStopper(on) {
      if (!st.S) return fail('Hier gibt es keinen Scheidetrichter.');
      st.stopper = !!on;
      if (!on) { st.vac = 0; st.warned.vac = false; }
      ev.emit('change', {});
      return { ok: true };
    }

    function shakeSep() {
      const g = guard(); if (g) return g;
      if (!st.S) return fail('Hier gibt es keinen Scheidetrichter.');
      if (liquidVol(st.S) < 0.5) return fail('Der Scheidetrichter ist leer.');
      if (st.tap > 0) return fail('Schließe zuerst den Hahn.');
      if (!st.stopper) {
        const out = takeFraction(st.S, 0.12);
        merge(st.lost.table, out);
        st.fx.overflow = 1;
        mistake('shakeOpen');
        return fail('Ohne Stopfen spritzt beim Schütteln Flüssigkeit heraus!');
      }
      st.op = { type: 'shake', t: 0, dur: 2 };
      ev.emit('change', {});
      return { ok: true };
    }

    function addHibiscus(to) {
      const g = guard(); if (g) return g;
      if (!st.equip.hibiscus) return fail('Hier gibt es keine Hibiskusblüten.');
      if (!st.vessels[to]) return fail('Gib die Blüten in ein Becherglas.');
      if (st.hibiscusStock < 1.99) return fail('Die Dose mit den Hibiskusblüten ist leer.');
      st.op = { type: 'hibiscus', to, g: 2, t: 0, dur: 1 };
      ev.emit('change', {});
      return { ok: true };
    }

    // ---------------------------------------------------------- Auswertungshilfen
    function totals(s) {
      const t = { water: 0, oil: 0, salt: 0, sand: 0, iron: 0, plant: 0, dye: 0 };
      const add = (c) => {
        if (!c) return;
        t.water += c.water; t.oil += c.oil; t.salt += c.salt + pm(c, 'saltX'); t.sand += sandOf(c);
        t.iron += pm(c, 'iron'); t.plant += plantMass(c); t.dye += c.dye + c.petalDye;
      };
      Object.values(s.vessels).forEach((v) => add(v.c));
      ['F', 'D', 'S', 'E', 'R'].forEach((k) => add(s[k]));
      Object.values(s.lost).forEach(add);
      return t;
    }

    /** Mengenbilanz je Stoff: Ausgangsmenge + Zugaben, Verbleib in Gefäßen und Verlusten. */
    function balance() {
      const keys = ['water', 'oil', 'salt', 'sand', 'iron', 'plant', 'dye'];
      const where = {};
      const ids = [...Object.keys(st.vessels), 'F', 'R', 'D', 'S', 'E'].filter((id) => container(id));
      for (const k of keys) where[k] = [];
      const amount = (c, k) => (k === 'water' ? c.water : k === 'oil' ? c.oil : k === 'salt' ? c.salt + pm(c, 'saltX') : k === 'sand' ? sandOf(c) : k === 'iron' ? pm(c, 'iron') : k === 'plant' ? plantMass(c) : c.dye + c.petalDye);
      for (const id of [...ids, ...LOST]) {
        const c = container(id);
        for (const k of keys) { const a = amount(c, k); if (a > 0.005) where[k].push({ id, name: nameOf(id), amount: a, lost: LOST.includes(id) }); }
      }
      const tot = totals(st);
      const start = Object.assign({}, st.initial);
      start.water += st.added.water;
      start.plant += st.added.hibiscus;
      start.dye += st.added.hibiscus * DYE_PER_G;
      return { start, now: tot, where };
    }

    function describe(id) {
      const c = container(id);
      if (!c) return null;
      return {
        id, name: nameOf(id), water: c.water, oil: c.oil, disp: c.disp, salt: c.salt, saltSolid: pm(c, 'saltX'),
        sand: sandOf(c), iron: pm(c, 'iron'), petals: pm(c, 'petals'), frag: pm(c, 'frag'), plant: plantMass(c),
        dye: c.dye, dyeConc: c.water > 0.5 ? c.dye / c.water : 0, T: c.T, turbidity: turbidity(c),
        turbidityClass: turbidityClass(turbidity(c)), solids: solidsMass(c), liquid: liquidVol(c), sus: susMass(c)
      };
    }

    function exportState() { return clone(st); }
    function importState(s) {
      Object.keys(st).forEach((k) => delete st[k]);
      Object.assign(st, clone(s));
      stepper.reset();
      ev.emit('change', { reason: 'import' });
    }

    return {
      state: st, H,
      on: ev.on, emit: ev.emit,
      update(dt) { return stepper.advance(dt); },
      advance(seconds) { return stepper.advance(seconds); },
      busy, container, describe, balance, nameOf, vesselAt,
      pour, stopOp, addWater, stir, moveVessel, insertFilter, removeFilter, setBurner, useMagnet,
      setTap, setStopper, shakeSep, addHibiscus,
      select(id) { st.selected = id; ev.emit('change', { reason: 'select' }); return { ok: true }; },
      exportState, importState
    };
  }

  return {
    create, emptyContents, takeFraction, merge, extractTop, extractBottom, turbidity, turbidityClass,
    saltSolubility, extractK, PARTICLES, PKEYS, CAP, CONTAINER_NAMES, PLACE_NAMES, VESSEL_NAMES, LOST, DYE_PER_G, FRAG_SHARE,
    helpers: { pm, sandOf, solidsMass, liquidVol, plantMass, susMass }
  };
});
