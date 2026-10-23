/*
 * Trennlabor – Fachmodell „Klassische Trennverfahren“ (ohne DOM)
 *
 * Zustand aller Gefäße und Geräte eines Versuchs (Mengen in g bzw. mL),
 * zeitabhängige Vorgänge (Absetzen, Lösen, Filtrieren, Eindampfen, Extrahieren,
 * Phasentrennung) und die erlaubten Handlungen. Jede Stoffmenge bleibt
 * bilanziert: Was ein Gefäß verlässt, landet in einem anderen Gefäß oder in
 * einem Verlusttopf (verschüttet, Ausguss, verdampft, verspritzt).
 */
(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('./core.js') : root.TL.core;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).classic = api;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { clamp, clone } = core;

  /** Stoffmengen, die bilanziert werden. petalDye: Farbstoff noch in den Blüten; dye: gelöster Farbstoff (Einheiten). */
  const KEYS = ['sand', 'iron', 'saltS', 'saltD', 'water', 'oil', 'petals', 'petalDye', 'dye'];
  const ROOM = 20;
  const CSAT = (T) => 0.357 + 0.00035 * Math.max(0, T - 20); // g Kochsalz je mL Wasser (35,7 g/100 mL bei 20 °C)
  const DENS = { sand: 2.65, iron: 7.87, saltS: 2.16, oil: 0.92, petals: 0.6 };
  const BULK = { sand: 1.5, iron: 3.5, saltS: 1.2, petals: 0.12 }; // Schüttdichte für die Darstellung (g/mL)

  const TYPES = {
    beaker: { name: 'Becherglas', cap: 250, heatEff: 0.75, cVessel: 70 },
    erlenmeyer: { name: 'Erlenmeyerkolben', cap: 250, heatEff: 0.7, cVessel: 80 },
    dish: { name: 'Abdampfschale', cap: 100, heatEff: 0.85, cVessel: 80 },
    watch: { name: 'Uhrglas', cap: 15, heatEff: 0.6, cVessel: 15 },
    source: { name: 'Vorratsschale', cap: 60, heatEff: 0.6, cVessel: 40 },
    funnel: { name: 'Trichter', cap: 120, heatEff: 0, cVessel: 30 },
    sieve: { name: 'Teesieb', cap: 150, heatEff: 0, cVessel: 20 },
    sep: { name: 'Scheidetrichter', cap: 250, heatEff: 0, cVessel: 90 }
  };
  const HEATER_W = [0, 150, 400];
  const BENCH = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5'];

  const emptyC = (extra) => Object.assign({ sand: 0, iron: 0, saltS: 0, saltD: 0, water: 0, oil: 0, petals: 0, petalDye: 0, dye: 0, susp: 0, emW: 0, emO: 0, temp: ROOM, agit: 0 }, extra || {});

  // ------------------------------------------------------------------ Versuche
  const SETUPS = {
    'K-01': {
      title: 'Sand und Wasser trennen',
      vessels: [
        { id: 'A', type: 'beaker', label: 'Becherglas A', place: 'b0', c: { sand: 10, water: 100, susp: 1, agit: 0.7 } },
        { id: 'B', type: 'beaker', label: 'Becherglas B', place: 'b1' },
        { id: 'C', type: 'beaker', label: 'Becherglas C', place: 'b2' },
        { id: 'E', type: 'erlenmeyer', label: 'Erlenmeyerkolben', place: 'b3' }
      ],
      devices: { funnel: true, heater: false, sep: false, sieve: false, magnet: false },
      water: { hot: false }
    },
    'K-02': {
      title: 'Sand und Kochsalz trennen',
      vessels: [
        { id: 'M', type: 'source', label: 'Gemisch (Sand + Kochsalz)', place: 'b0', c: { sand: 10, saltS: 5 } },
        { id: 'A', type: 'beaker', label: 'Becherglas A', place: 'b1' },
        { id: 'B', type: 'beaker', label: 'Becherglas B', place: 'b2' },
        { id: 'E', type: 'erlenmeyer', label: 'Erlenmeyerkolben', place: 'b3' },
        { id: 'D', type: 'dish', label: 'Abdampfschale', place: 'b4' }
      ],
      devices: { funnel: true, heater: true, sep: false, sieve: false, magnet: false },
      water: { hot: false }
    },
    'K-03': {
      title: 'Eisen, Sand und Kochsalz trennen',
      vessels: [
        { id: 'M', type: 'source', label: 'Gemisch (Eisen + Sand + Kochsalz)', place: 'b0', c: { iron: 5, sand: 10, saltS: 5 } },
        { id: 'A', type: 'beaker', label: 'Becherglas A', place: 'b1' },
        { id: 'E', type: 'erlenmeyer', label: 'Erlenmeyerkolben', place: 'b2' },
        { id: 'D', type: 'dish', label: 'Abdampfschale', place: 'b3' },
        { id: 'U', type: 'watch', label: 'Uhrglas', place: 'b4' }
      ],
      devices: { funnel: true, heater: true, sep: false, sieve: false, magnet: true },
      water: { hot: false }
    },
    'K-04': {
      title: 'Öl und Wasser trennen',
      vessels: [
        { id: 'A', type: 'beaker', label: 'Becherglas A', place: 'b0', c: { oil: 50, water: 50, emW: 45, emO: 45, agit: 0.6 } },
        { id: 'B', type: 'beaker', label: 'Becherglas B', place: 'b1' },
        { id: 'C', type: 'beaker', label: 'Becherglas C', place: 'b2' },
        { id: 'E', type: 'erlenmeyer', label: 'Erlenmeyerkolben', place: 'b3' }
      ],
      devices: { funnel: true, heater: false, sep: true, sieve: false, magnet: false },
      water: { hot: false }
    },
    'K-05': {
      title: 'Hibiskustee durch Extraktion herstellen',
      vessels: [
        { id: 'P', type: 'source', label: 'Getrocknete Hibiskusblüten', place: 'b0', c: { petals: 4, petalDye: 40 } },
        { id: 'A', type: 'beaker', label: 'Becherglas A', place: 'b1' },
        { id: 'B', type: 'beaker', label: 'Becherglas B', place: 'b2' },
        { id: 'C', type: 'beaker', label: 'Becherglas C', place: 'b3' }
      ],
      devices: { funnel: true, heater: true, sep: false, sieve: true, magnet: false },
      water: { hot: true }
    }
  };

  function initialState(taskId) {
    const s = SETUPS[taskId];
    if (!s) throw new Error('Unbekannter Versuch ' + taskId);
    const st = {
      lab: 'classic', taskId, time: 0, seq: 0,
      vessels: s.vessels.map((v) => ({ id: v.id, type: v.type, label: v.label, place: v.place, c: emptyC(clone(v.c || {})) })),
      devices: clone(s.devices),
      water: clone(s.water),
      funnel: s.devices.funnel ? { id: 'F', type: 'funnel', label: 'Trichter', paper: 'none', c: emptyC() } : null,
      sieve: s.devices.sieve ? { id: 'T', type: 'sieve', label: 'Teesieb', on: null, c: emptyC() } : null,
      sep: s.devices.sep ? { id: 'S', type: 'sep', label: 'Scheidetrichter', cock: 0, c: emptyC() } : null,
      heater: s.devices.heater ? { level: 0 } : null,
      magnet: s.devices.magnet ? { iron: 0 } : null,
      lost: { spilled: emptyC(), waste: emptyC(), evaporated: emptyC(), spatter: emptyC() },
      added: { water: 0 },
      op: null, safety: null, lastWeigh: null,
      flags: {}, log: []
    };
    st.initial = totals(st);
    return st;
  }

  // ---------------------------------------------------------- Mengenbilanz
  function allContents(st) {
    const list = st.vessels.map((v) => v.c);
    if (st.funnel) list.push(st.funnel.c);
    if (st.sieve) list.push(st.sieve.c);
    if (st.sep) list.push(st.sep.c);
    if (st.op && st.op.inflight) list.push(st.op.inflight);
    return list;
  }
  function totals(st) {
    const t = { sand: 0, iron: 0, salt: 0, water: 0, oil: 0, petals: 0, dye: 0 };
    const add = (c) => {
      t.sand += c.sand; t.iron += c.iron; t.salt += c.saltS + c.saltD; t.water += c.water; t.oil += c.oil;
      t.petals += c.petals; t.dye += c.petalDye + c.dye;
    };
    allContents(st).forEach(add);
    Object.values(st.lost).forEach(add);
    if (st.magnet) t.iron += st.magnet.iron;
    return t;
  }

  const liquid = (c) => c.water + c.oil;
  const solids = (c) => c.sand + c.iron + c.saltS + c.petals;
  const mass = (c) => c.sand + c.iron + c.saltS + c.saltD + c.water + c.oil * DENS.oil + c.petals;
  const heatCap = (c, type) => 4.18 * c.water + 1.9 * c.oil + 0.8 * c.sand + 0.88 * (c.saltS + c.saltD) + 0.45 * c.iron + 1.5 * c.petals + (type && TYPES[type] ? TYPES[type].cVessel : 0);
  const solidVolume = (c) => c.sand / BULK.sand + c.iron / BULK.iron + c.saltS / BULK.saltS + c.petals / BULK.petals;

  /**
   * Beschreibung eines Gefäßinhalts für Darstellung, Hilfe und Bewertung.
   * turbidity: suspendierter Feststoff je mL (g/mL); dyeConc: Farbstoff je mL.
   */
  function describe(c) {
    const L = liquid(c);
    const suspended = (c.sand + c.iron * 0.05) * c.susp;
    return {
      liquid: L, solids: solids(c), mass: mass(c),
      suspended, turbidity: L > 0.3 ? suspended / L : 0,
      saltConc: c.water > 0.05 ? c.saltD / c.water : 0,
      dyeConc: c.water > 0.3 ? c.dye / c.water : 0,
      layered: c.water > 1 && c.oil > 1,
      freeWater: Math.max(0, c.water - c.emW), freeOil: Math.max(0, c.oil - c.emO), emulsion: c.emW + c.emO,
      dry: L < 0.3,
      empty: L < 0.05 && solids(c) < 0.01 && c.saltD < 0.01
    };
  }

  // ------------------------------------------------------------- Transfer
  /** Verschiebt Mengen (Objekt mit KEYS) von a nach b (b darf ein Verlusttopf sein). */
  function transfer(a, b, amt, inSusp) {
    const moved = {};
    let any = 0;
    for (const k of KEYS) {
      const v = Math.min(Math.max(0, amt[k] || 0), a[k]);
      moved[k] = v;
      any += v;
    }
    if (any <= 0) return moved;
    // Emulsionsanteile wandern anteilig mit (Wasser/Öl in der Emulsion bleiben ≤ Gesamtmenge)
    const emWm = a.water > 0 ? a.emW * (moved.water / a.water) : 0;
    const emOm = a.oil > 0 ? a.emO * (moved.oil / a.oil) : 0;
    const hcM = heatCap(moved);
    const hcB = heatCap(b);
    const sandB = b.sand;
    for (const k of KEYS) { a[k] -= moved[k]; b[k] += moved[k]; if (a[k] < 1e-9) a[k] = 0; }
    a.emW = Math.max(0, Math.min(a.water, a.emW - emWm)); a.emO = Math.max(0, Math.min(a.oil, a.emO - emOm));
    b.emW = Math.min(b.water, b.emW + emWm); b.emO = Math.min(b.oil, b.emO + emOm);
    // Schwebstoff: eingegossener Sand ist aufgewirbelt
    const ts = sandB + moved.sand;
    b.susp = ts > 0 ? clamp((sandB * b.susp + moved.sand * (inSusp == null ? 1 : inSusp)) / ts, 0, 1) : 0;
    if (hcB + hcM > 0) b.temp = (b.temp * hcB + a.temp * hcM) / (hcB + hcM);
    return moved;
  }
  const scale = (amt, f) => { const o = {}; for (const k of KEYS) o[k] = (amt[k] || 0) * f; return o; };

  /**
   * Was beim Umgießen mitgeht (vollständiger Plan, wird während der Animation anteilig ausgeführt).
   * mode: careful (vorsichtig dekantieren), fast (zügig), all (alles), upper (nur obere Schicht)
   */
  function pourPlan(c, mode, srcType) {
    const p = {};
    for (const k of KEYS) p[k] = 0;
    const L = liquid(c);
    if (mode === 'all') { for (const k of KEYS) p[k] = c[k]; return { plan: p, susp: Math.max(c.susp, 0.8) }; }
    if (mode === 'upper') {
      const fw = Math.max(0, c.water - c.emW), fo = Math.max(0, c.oil - c.emO);
      // obere Schicht (Öl), halbe Emulsion und etwas mitgerissene untere Phase
      p.oil = fo + c.emO * 0.6;
      p.water = Math.min(c.water, c.emW * 0.6 + Math.min(fw, 0.05 * fw + (srcType === 'sep' ? 1.5 : 2.5)));
    } else {
      // Flüssigkeit über dem Bodensatz; etwas bleibt im Bodensatz zurück
      const settled = c.sand * (1 - c.susp) + c.iron + c.saltS + c.petals;
      const retain = Math.min(L, (mode === 'fast' ? 0.6 : 1.2) + 0.25 * (c.sand * (1 - c.susp) + c.iron + c.saltS) + 2.5 * c.petals + (settled > 0 ? 0.5 : 0));
      const share = L > 0 ? (L - retain) / L : 0;
      p.water = c.water * share;
      p.oil = c.oil * share;
    }
    const wf = c.water > 0 ? p.water / c.water : 0;
    p.saltD = c.saltD * wf; p.dye = c.dye * wf;
    const lf = L > 0 ? (p.water + p.oil) / L : 0;
    let susp = c.susp;
    if (mode === 'fast') susp = Math.max(c.susp, 0.4); // Bodensatz wird aufgewirbelt
    if (mode === 'upper') susp = c.susp;
    p.sand = c.sand * susp * lf;
    p.iron = c.iron * (mode === 'fast' ? 0.08 : 0) * lf;
    p.saltS = c.saltS * (mode === 'fast' ? 0.15 : 0) * lf;
    p.petals = c.petals * (mode === 'fast' ? 0.45 : 0.08) * lf;
    p.petalDye = c.petals > 0 ? c.petalDye * (p.petals / c.petals) : 0;
    return { plan: p, susp: 1 };
  }

  // =================================================================== Engine
  function createEngine(taskId, saved) {
    const bus = core.emitter();
    const st = saved ? clone(saved) : initialState(taskId);
    const clock = core.createClock({ step });

    const msg = (text, kind, code) => {
      st.seq++;
      const entry = { t: st.time, kind: kind || 'info', text, code: code || null, n: st.seq };
      st.log.push(entry);
      if (st.log.length > 200) st.log.splice(0, st.log.length - 200);
      bus.emit('message', entry);
      return entry;
    };
    const fail = (text, code) => { msg(text, 'warn', code); return { ok: false, message: text, code }; };
    const ok = (text, extra) => { if (text) msg(text, 'info'); return Object.assign({ ok: true, message: text || '' }, extra || {}); };
    const once = (key, text, kind, code) => { if (!st.flags[key]) { st.flags[key] = true; msg(text, kind || 'warn', code); } };

    const vessel = (id) => st.vessels.find((v) => v.id === id) || null;
    /** Alle Behälter, auch Geräte mit Inhalt. */
    function container(id) {
      if (id === 'F') return st.funnel;
      if (id === 'T') return st.sieve;
      if (id === 'S') return st.sep;
      return vessel(id);
    }
    const label = (id) => {
      if (id === 'waste') return 'Ausguss';
      const c = container(id);
      return c ? c.label : id;
    };
    const atPlace = (p) => st.vessels.find((v) => v.place === p) || null;
    const funnelReceiver = () => atPlace('filter');
    const sepReceiver = () => atPlace('sep');
    const busy = () => !!st.op;

    // ------------------------------------------------------- Sicherheit
    function safetyStop(code, text) {
      if (st.safety) return;
      st.safety = { code, text, t: st.time };
      if (st.heater) st.heater.level = 0;
      if (st.op && st.op.type !== 'move') st.op = null;
      msg(text, 'safety', code);
      bus.emit('safety', st.safety);
    }
    function checkSafety() {
      if (!st.heater || st.heater.level === 0) return;
      const v = atPlace('heater');
      if (v && v.c.oil > 0.5) {
        safetyStop('oilHeat', 'Sicherheitsunterbrechung: Ein Gefäß mit Öl steht auf der eingeschalteten Heizplatte. Heißes Öl kann spritzen und sich entzünden. Die Heizplatte wurde ausgeschaltet. Zum Trennen von Öl und Wasser ist kein Erhitzen nötig.');
      }
    }
    function resume() {
      if (!st.safety) return ok();
      if (st.safety.code === 'oilHeat') {
        const v = atPlace('heater');
        if (v && v.c.oil > 0.5) return fail('Nimm zuerst das Gefäß mit Öl von der Heizplatte.', 'safetyPending');
      }
      st.safety = null;
      return ok('Der Versuch kann fortgesetzt werden.');
    }
    const guard = () => (st.safety ? fail('Der Versuch ist wegen einer Sicherheitsunterbrechung angehalten. Behebe die Ursache und setze fort.', 'safety') : busy() ? fail('Warte, bis die laufende Handlung abgeschlossen ist.', 'busy') : null);

    // ------------------------------------------------------------- Aktionen
    function addWater(targetId, ml, hot) {
      const g = guard(); if (g) return g;
      const t = container(targetId);
      if (!t) return fail('Wähle zuerst ein Gefäß.', 'noTarget');
      if (targetId === 'T' && !st.sieve.on) return fail('Lege das Teesieb zuerst auf ein Gefäß.', 'sieveFree');
      if (hot && !st.water.hot) return fail('In diesem Versuch steht kein heißes Wasser bereit.', 'noHot');
      ml = clamp(Number(ml) || 0, 1, 100);
      const inflight = emptyC({ water: ml, temp: hot ? 90 : ROOM });
      st.added.water += ml;
      if (hot) st.flags.hotWater = true;
      st.op = { type: 'water', target: targetId, t: 0, dur: 1.4, inflight, total: ml, hot: !!hot };
      return ok(`${ml} mL ${hot ? 'heißes ' : ''}Wasser werden in ${label(targetId)} gegeben …`);
    }

    function stir(targetId) {
      const g = guard(); if (g) return g;
      const t = container(targetId);
      if (!t) return fail('Wähle zuerst ein Gefäß.', 'noTarget');
      if (targetId === 'S') return fail('Im Scheidetrichter wird nicht mit dem Glasstab gerührt.', 'stirSep');
      if (describe(t.c).empty) return fail(`${label(targetId)} ist leer – hier gibt es nichts zu rühren.`, 'stirEmpty');
      if (targetId === 'F' && st.funnel.paper !== 'none') {
        st.funnel.paper = 'torn';
        st.op = { type: 'stir', target: targetId, t: 0, dur: 2.0 };
        return fail('Beim Rühren im Trichter ist das nasse Filterpapier eingerissen. Feststoffe können jetzt hindurchgelangen.', 'paperTorn');
      }
      st.op = { type: 'stir', target: targetId, t: 0, dur: 3.0 };
      return ok(`Mit dem Glasstab wird in ${label(targetId)} gerührt …`);
    }

    function pour(fromId, toId, mode) {
      const g = guard(); if (g) return g;
      const a = container(fromId);
      if (!a) return fail('Wähle zuerst das Gefäß, aus dem du gießen möchtest.', 'noSource');
      if (fromId === toId) return fail('Quelle und Ziel sind dasselbe Gefäß.', 'same');
      if (fromId === 'F' || fromId === 'T') return fail('Den Rückstand im Trichter oder Sieb kannst du mit „Rückstand überführen“ entnehmen.', 'pourFromFilter');
      const d = describe(a.c);
      if (d.empty) return fail(`${label(fromId)} ist leer.`, 'pourEmpty');
      mode = mode || 'careful';
      if (mode === 'upper' && !d.layered) mode = 'careful';
      if (d.dry && mode !== 'all') mode = 'all'; // Feststoff wird ausgeschüttet
      if (toId !== 'waste') {
        const b = container(toId);
        if (!b) return fail('Wähle ein Zielgefäß.', 'noTarget');
        if (toId === 'T' && !st.sieve.on) return fail('Lege das Teesieb zuerst auf ein Gefäß.', 'sieveFree');
        if (toId === 'T' && st.sieve.on === fromId) return fail('Das Teesieb liegt auf diesem Gefäß.', 'same');
      }
      if (st.heater && a.place === 'heater' && a.c.temp > 60 && st.heater.level > 0) {
        return fail('Das Gefäß auf der heißen Heizplatte darfst du nicht anfassen. Schalte die Heizplatte aus und lass es abkühlen.', 'hotVessel');
      }
      const { plan, susp } = pourPlan(a.c, mode, a.type);
      const amount = KEYS.reduce((s, k) => s + plan[k], 0);
      if (amount < 0.01) return fail('Es lässt sich nichts abgießen – im Gefäß ist nur Bodensatz.', 'pourNothing');
      const vol = plan.water + plan.oil + solidVolume(plan);
      const dur = clamp(1.2 + vol / (mode === 'fast' ? 90 : mode === 'all' ? 60 : 40), 1.4, 4.5);
      st.op = { type: 'pour', from: fromId, to: toId, mode, t: 0, dur, plan, done: 0, susp, inflight: emptyC() };
      const how = { careful: 'vorsichtig', fast: 'zügig', all: 'vollständig', upper: 'die obere Schicht' }[mode];
      return ok(`${label(fromId)}: ${mode === 'upper' ? 'die obere Schicht wird' : 'Inhalt wird ' + how} in ${label(toId)} gegossen …`, { mode });
    }

    function move(id, place) {
      const g = guard(); if (g && !(st.safety && g.code === 'safety')) return g;
      if (busy()) return fail('Warte, bis die laufende Handlung abgeschlossen ist.', 'busy');
      const v = vessel(id);
      if (!v) return fail('Wähle zuerst ein Gefäß.', 'noTarget');
      if (place === 'bench') {
        const free = BENCH.find((p) => !atPlace(p));
        if (!free) return fail('Auf dem Tisch ist kein Platz frei.', 'benchFull');
        place = free;
      }
      if (v.place === place) return ok();
      if (place === 'heater' && !st.heater) return fail('In diesem Versuch gibt es keine Heizplatte.', 'noHeater');
      if (place === 'filter' && !st.funnel) return fail('In diesem Versuch gibt es keinen Filtertrichter.', 'noFunnel');
      if (place === 'sep' && !st.sep) return fail('In diesem Versuch gibt es keinen Scheidetrichter.', 'noSep');
      if (v.type === 'source' && (place === 'filter' || place === 'sep' || place === 'heater')) return fail('Die Vorratsschale bleibt auf dem Tisch.', 'sourceFixed');
      if (atPlace(place)) return fail(`Dort steht bereits ${atPlace(place).label}.`, 'placeTaken');
      if (st.sieve && st.sieve.on === id && place !== 'heater' && !BENCH.includes(place)) return fail('Nimm zuerst das Teesieb vom Gefäß.', 'sieveOnVessel');
      if (v.place === 'heater' && st.heater && st.heater.level > 0 && v.c.temp > 60 && !st.safety) {
        return fail('Das Gefäß ist heiß. Schalte die Heizplatte aus und lass es kurz abkühlen.', 'hotVessel');
      }
      st.op = { type: 'move', id, from: v.place, to: place, t: 0, dur: 0.8 };
      v.place = 'moving';
      return ok();
    }

    function setHeater(level) {
      if (!st.heater) return fail('In diesem Versuch gibt es keine Heizplatte.', 'noHeater');
      level = clamp(Math.round(level), 0, 2);
      if (st.safety && level > 0) return fail('Erst nach Behebung der Sicherheitsunterbrechung weiterheizen.', 'safety');
      st.heater.level = level;
      st.flags.dryMsg = false; st.flags.spatterMsg = false;
      checkSafety();
      return ok(level ? `Heizplatte: ${level === 1 ? 'niedrige' : 'hohe'} Stufe.` : 'Heizplatte ausgeschaltet.');
    }

    function setPaper(mode) {
      const g = guard(); if (g) return g;
      if (!st.funnel) return fail('Kein Trichter vorhanden.', 'noFunnel');
      const d = describe(st.funnel.c);
      if (!d.empty && mode !== st.funnel.paper) return fail('Im Trichter ist noch Material. Entnimm zuerst den Rückstand.', 'funnelFull');
      st.funnel.paper = mode;
      return ok({ folded: 'Filterpapier gefaltet, eingesetzt und angefeuchtet.', flat: 'Filterpapier ungefaltet aufgelegt.', none: 'Filterpapier entfernt.' }[mode] || '');
    }

    function setCock(level) {
      if (!st.sep) return fail('Kein Scheidetrichter vorhanden.', 'noSep');
      if (st.safety) return fail('Versuch angehalten.', 'safety');
      st.sep.cock = [0, 0.25, 1].includes(level) ? level : 0;
      return ok(st.sep.cock === 0 ? 'Hahn geschlossen.' : st.sep.cock < 1 ? 'Hahn einen Spalt geöffnet.' : 'Hahn ganz geöffnet.');
    }

    function placeSieve(vid) {
      const g = guard(); if (g) return g;
      if (!st.sieve) return fail('Kein Teesieb vorhanden.', 'noSieve');
      if (vid == null) { st.sieve.on = null; return ok('Teesieb abgenommen.'); }
      const v = vessel(vid);
      if (!v) return fail('Wähle ein Gefäß.', 'noTarget');
      if (v.type === 'source' || v.type === 'watch') return fail('Das Teesieb passt nicht auf dieses Gefäß.', 'sieveFit');
      st.sieve.on = vid;
      return ok(`Teesieb liegt auf ${v.label}.`);
    }

    function scrape(fromId, toId) {
      const g = guard(); if (g) return g;
      const a = container(fromId);
      if (!a || (fromId !== 'F' && fromId !== 'T')) return fail('Rückstand lässt sich nur aus Trichter oder Teesieb entnehmen.', 'scrapeWhat');
      const b = vessel(toId);
      if (!b) return fail('Wähle ein Gefäß für den Rückstand.', 'noTarget');
      if (describe(a.c).empty) return fail('Im ' + a.label + ' ist kein Rückstand.', 'scrapeEmpty');
      const plan = {}; for (const k of KEYS) plan[k] = a.c[k];
      st.op = { type: 'scrape', from: fromId, to: toId, t: 0, dur: 1.5, plan, done: 0, susp: 0, inflight: emptyC() };
      return ok(`Rückstand aus ${a.label} wird in ${b.label} überführt …`);
    }

    function useMagnet(targetId) {
      const g = guard(); if (g) return g;
      if (!st.magnet) return fail('In diesem Versuch gibt es keinen Magneten.', 'noMagnet');
      const t = container(targetId);
      if (!t) return fail('Wähle ein Gefäß, über das du den Magneten führst.', 'noTarget');
      st.op = { type: 'magnet', target: targetId, t: 0, dur: 2.0 };
      return ok(`Der Magnet (in Folie) wird durch ${label(targetId)} geführt …`);
    }

    function releaseMagnet(toId) {
      const g = guard(); if (g) return g;
      if (!st.magnet) return fail('Kein Magnet vorhanden.', 'noMagnet');
      if (st.magnet.iron < 0.005) return fail('Am Magneten haftet nichts.', 'magnetEmpty');
      const v = vessel(toId);
      if (!v) return fail('Wähle ein Gefäß, in das du die Eisenspäne abstreifst.', 'noTarget');
      st.op = { type: 'release', target: toId, t: 0, dur: 1.2 };
      return ok(`Eisenspäne werden von der Folie in ${v.label} abgestreift …`);
    }

    function weigh(id) {
      const g = guard(); if (g) return g;
      const c = id === 'magnet' ? null : container(id);
      if (!c && id !== 'magnet') return fail('Wähle ein Gefäß zum Wiegen.', 'noTarget');
      const m = id === 'magnet' ? st.magnet.iron : mass(c.c);
      st.lastWeigh = { id, label: id === 'magnet' ? 'Eisen am Magneten' : c.label, mass: Math.round(m * 10) / 10, t: st.time };
      msg(`Waage: Inhalt von ${st.lastWeigh.label} = ${core.fmt(st.lastWeigh.mass, 1)} g`, 'info', 'weigh');
      return ok('', { mass: st.lastWeigh.mass });
    }

    function act(name, ...args) {
      const fn = { addWater, stir, pour, move, setHeater, setPaper, setCock, placeSieve, scrape, useMagnet, releaseMagnet, weigh, resume }[name];
      if (!fn) return fail('Unbekannte Handlung ' + name);
      const r = fn(...args);
      bus.emit('change', { action: name, result: r });
      return r;
    }

    // --------------------------------------------------------------- Zeitschritt
    function applyPlanPart(op, a, b, frac) {
      const part = scale(op.plan, frac);
      transfer(a, b, part, op.susp);
    }

    function stepOp(dt) {
      const op = st.op;
      if (!op) return;
      op.t += dt;
      const p = clamp(op.t / op.dur, 0, 1);
      if (op.type === 'water') {
        const t = container(op.target);
        const due = op.total * p - (op.total - op.inflight.water);
        if (due > 0) {
          transfer(op.inflight, t.c, { water: due }, 1);
          t.c.agit = Math.max(t.c.agit, 0.35);
          if (op.target === 'S' || describe(t.c).layered) { t.c.emW = Math.min(t.c.water, t.c.emW + due * 0.3); t.c.emO = Math.min(t.c.oil, Math.max(t.c.emO, t.c.oil * 0.3)); }
        }
      } else if (op.type === 'stir') {
        const t = container(op.target);
        t.c.agit = 1;
        if (t.c.water > 0.5 && t.c.oil > 0.5) { t.c.emW = Math.max(t.c.emW, t.c.water * 0.85); t.c.emO = Math.max(t.c.emO, t.c.oil * 0.85); }
      } else if (op.type === 'pour' || op.type === 'scrape') {
        // Ein Teil der Bewegung ist Anheben/Kippen; gegossen wird zwischen 25 % und 85 % der Animation
        const pf = clamp((p - 0.25) / 0.6, 0, 1);
        const a = container(op.from);
        let target;
        if (op.to === 'waste') target = st.lost.waste;
        else target = container(op.to).c;
        let delta = pf - op.done;
        // In den Trichter wird portionsweise nachgegossen
        if (op.to === 'F' && delta > 0) {
          const room = TYPES.funnel.cap * 0.85 - liquid(st.funnel.c);
          const vol = (op.plan.water + op.plan.oil) * delta;
          if (vol > room) {
            const allowed = Math.max(0, room) / Math.max(1e-6, op.plan.water + op.plan.oil);
            delta = allowed;
            op.t = Math.min(op.t, op.dur * (0.25 + 0.6 * (op.done + delta)));
            op.waiting = true;
          } else op.waiting = false;
        }
        if (delta > 0) {
          applyPlanPart(op, a.c, target, delta);
          op.done += delta;
          if (op.to !== 'waste') { const tc = container(op.to).c; tc.agit = Math.max(tc.agit, 0.5); if (tc.water > 0.5 && tc.oil > 0.5) { tc.emW = Math.max(tc.emW, tc.water * 0.5); tc.emO = Math.max(tc.emO, tc.oil * 0.5); } }
        }
        if (op.type === 'scrape' && p >= 1 && op.from === 'F') st.funnel.paper = 'none';
      } else if (op.type === 'magnet') {
        if (p >= 1 && !op.applied) {
          op.applied = true;
          const t = container(op.target);
          const c = t.c;
          if (c.iron > 0.001) {
            const wet = liquid(c) > 0.5;
            const f = wet ? 0.8 : 0.92;
            const take = c.iron * f;
            c.iron -= take; st.magnet.iron += take;
            msg(`Der Magnet zieht ${core.fmt(take, 1)} g Eisenspäne an. Sand und Kochsalz bleiben liegen.`, 'info', 'magnetHit');
          } else {
            msg('Der Magnet zieht hier nichts an.', 'info', 'magnetMiss');
          }
        }
      } else if (op.type === 'release') {
        if (p >= 1 && !op.applied) {
          op.applied = true;
          const v = vessel(op.target);
          v.c.iron += st.magnet.iron; st.magnet.iron = 0;
        }
      } else if (op.type === 'move') {
        if (p >= 1) {
          const v = vessel(op.id);
          v.place = op.to;
          if (op.to === 'heater') checkSafety();
        }
      }
      if (p >= 1 && (!op.waiting)) {
        if ((op.type === 'pour' || op.type === 'scrape') && op.done < 1 - 1e-6) {
          applyPlanPart(op, container(op.from).c, op.to === 'waste' ? st.lost.waste : container(op.to).c, 1 - op.done);
        }
        if (op.type === 'water' && op.inflight.water > 0) transfer(op.inflight, container(op.target).c, { water: op.inflight.water }, 1);
        finishOp(op);
        st.op = null;
      }
    }

    function finishOp(op) {
      if (op.type === 'pour' && op.to === 'waste') {
        const lw = st.lost.waste;
        if (lw.saltD > 0.05 && !st.flags.wasteSalt) { st.flags.wasteSalt = true; msg('Die Lösung ist im Ausguss – das darin gelöste Kochsalz ist verloren.', 'warn', 'saltWasted'); }
      }
      if (op.type === 'pour' && op.to === 'F') {
        if (st.funnel.paper === 'none') msg('Im Trichter liegt kein Filterpapier – Feststoffe laufen mit hindurch.', 'warn', 'noPaper');
        if (!funnelReceiver()) msg('Unter dem Trichter steht kein Gefäß – was durchläuft, tropft auf den Tisch.', 'warn', 'noReceiver');
        const c = st.funnel.c;
        if (c.saltS > 0.3 && c.water < 0.5) msg('Das trockene Gemisch liegt im Filter. Ohne Wasser wird hier nichts getrennt.', 'warn', 'dryFilter');
      }
      if (op.type === 'pour' && op.to === 'S' && st.sep.cock > 0 && !sepReceiver()) {
        msg('Der Hahn des Scheidetrichters ist offen und es steht kein Gefäß darunter!', 'warn', 'sepOpenNoReceiver');
      }
      bus.emit('change', { action: 'opDone', op: op.type });
    }

    /** Überlauf eines Behälters: was nicht hineinpasst, wird verschüttet. */
    function overflow(holder) {
      const c = holder.c;
      const cap = TYPES[holder.type].cap;
      const vol = liquid(c) + solidVolume(c) * 0.5;
      if (vol > cap + 0.5) {
        const f = (vol - cap) / Math.max(1e-6, liquid(c));
        const amt = { water: c.water * f, oil: c.oil * f, saltD: c.saltD * f, dye: c.dye * f, sand: c.sand * c.susp * f };
        transfer(c, st.lost.spilled, amt, 1);
        once('over-' + holder.id + '-' + Math.floor(st.time / 10), `${holder.label} läuft über – ein Teil der Flüssigkeit ist verschüttet.`, 'warn', 'overflow');
      }
    }

    function stepContents(c, dt, holder) {
      const L = liquid(c);
      const stirring = st.op && st.op.type === 'stir' && st.op.target === holder.id;
      if (!stirring) c.agit = Math.max(0, c.agit - dt / 3);
      // Schwebstoffe setzen sich ab (grobe Körner rasch, feine Anteile langsamer)
      if (L < 0.3) c.susp = 0;
      else {
        const eq = c.agit * 0.95;
        if (c.susp < eq) c.susp += (eq - c.susp) * Math.min(1, dt * 3);
        else {
          const tau = c.susp > 0.12 ? 4.5 : 22;
          c.susp = Math.max(eq, c.susp * Math.exp(-dt / tau));
        }
        if (c.susp < 0.002) c.susp = 0;
      }
      // Emulsion aus Öl und Wasser trennt sich in Ruhe
      if (c.water > 0.3 && c.oil > 0.3) {
        if (c.agit < 0.2) { const f = Math.exp(-dt / 25); c.emW *= f; c.emO *= f; if (c.emW < 0.05) c.emW = 0; if (c.emO < 0.05) c.emO = 0; }
      } else { c.emW = 0; c.emO = 0; }
      c.emW = Math.min(c.emW, c.water); c.emO = Math.min(c.emO, c.oil);
      // Lösen bzw. Auskristallisieren von Kochsalz
      if (c.water > 0.01) {
        const cap = CSAT(c.temp) * c.water - c.saltD;
        if (cap > 0 && c.saltS > 0) {
          const k = (0.03 + 0.55 * c.agit) * (1 + Math.max(0, c.temp - 20) / 40);
          const d = Math.min(cap, c.saltS * (1 - Math.exp(-k * dt)));
          c.saltS -= d; c.saltD += d;
        } else if (cap < 0) {
          c.saltD += cap; c.saltS -= cap; // übersättigt → Kristalle
        }
      } else if (c.saltD > 0) { c.saltS += c.saltD; c.saltD = 0; }
      if (c.saltS < 1e-6) c.saltS = 0;
      // Extraktion der Hibiskusblüten (schneller bei höherer Temperatur und beim Rühren)
      if (c.petals > 0 && c.water > 0.5 && c.petalDye > 0) {
        if (c.temp > (st.flags.maxExtractT || 0)) st.flags.maxExtractT = c.temp;
        const total = c.petalDye + c.dye;
        const eq = total * c.water / (c.water + 2.5 * c.petals);
        if (c.dye < eq) {
          const k = (1 / 520) * Math.exp(0.036 * (c.temp - 20)) * (1 + 1.5 * c.agit);
          const d = Math.min(c.petalDye, (eq - c.dye) * (1 - Math.exp(-k * dt)));
          c.petalDye -= d; c.dye += d;
        }
      }
    }

    function stepHeat(v, dt) {
      const c = v.c;
      const onHeater = v.place === 'heater' && st.heater;
      const P = onHeater ? HEATER_W[st.heater.level] * TYPES[v.type].heatEff : 0;
      const C = heatCap(c, v.type);
      const loss = 0.6 * (c.temp - ROOM);
      if (P > 0) {
        // Kleinste Restmengen verdampfen sofort (sonst bliebe ein „ewiger“ Wasserfilm)
        if (c.water > 0 && c.water <= 0.001) {
          st.lost.evaporated.water += c.water; c.water = 0; c.emW = 0;
          if (c.saltD > 0) { c.saltS += c.saltD; c.saltD = 0; }
        }
        if (c.water > 0 && c.temp >= 100 - 1e-6) {
          const net = Math.max(0, P - loss);
          const evap = Math.min(c.water, net / 2257 * dt);
          const share = c.water > 0 ? evap / c.water : 0;
          c.water -= evap; st.lost.evaporated.water += evap;
          c.emW = Math.max(0, c.emW * (1 - share));
          c.temp = 100;
          c.agit = Math.max(c.agit, 0.35); // Sieden durchmischt
          if (st.heater.level === 2 && c.water < 4 && c.saltS + c.saltD > 0.2) {
            const lossS = c.saltS * 0.006 * dt;
            c.saltS -= lossS; st.lost.spatter.saltS += lossS;
            once('spatterMsg', 'Es knistert und spritzt: Bei hoher Heizstufe springen Salzkristalle aus der Schale. Stelle die Heizung niedriger.', 'warn', 'spatter');
          }
          if (c.water < 1e-4) {
            c.water = 0;
            if (c.saltD > 0) { c.saltS += c.saltD; c.saltD = 0; }
            once('dryMsg', `${v.label}: Das Wasser ist vollständig verdampft.`, 'info', 'dry');
          }
        } else {
          c.temp += (P - loss) / C * dt;
          if (c.water > 0.001) c.temp = Math.min(100, c.temp);
          else c.temp = Math.min(320, c.temp);
        }
      } else {
        c.temp = ROOM + (c.temp - ROOM) * Math.exp(-dt / 300);
      }
    }

    function stepFunnel(dt) {
      const f = st.funnel;
      if (!f) return;
      const c = f.c;
      const rec = funnelReceiver();
      const dest = rec ? rec.c : st.lost.spilled;
      const paper = f.paper;
      const rate = { folded: 1.6, flat: 2.6, torn: 4, none: 12 }[paper];
      const retain = (paper === 'none' ? 0.2 : 1.0) + 0.25 * (c.sand + c.iron + c.saltS) + 2.5 * c.petals;
      const L = liquid(c);
      if (L > retain + 1e-6) {
        const dv = Math.min(L - retain, rate * dt);
        const lf = dv / L;
        const pass = { folded: 0, flat: 0.3, torn: 0.65, none: 1 }[paper];
        const amt = {
          water: c.water * lf, oil: c.oil * lf, saltD: c.saltD * lf, dye: c.dye * lf,
          sand: paper === 'none' ? c.sand * Math.min(1, lf * 1.5) : c.sand * c.susp * lf * pass * 3,
          iron: paper === 'none' ? c.iron * Math.min(1, lf * 1.5) : 0,
          saltS: paper === 'none' ? c.saltS * Math.min(1, lf * 1.5) : 0,
          petals: paper === 'none' ? c.petals * lf * 0.3 : 0
        };
        amt.petalDye = c.petals > 0 ? c.petalDye * (amt.petals / c.petals) : 0;
        transfer(c, dest, amt, 1);
        if (!rec) once('dripTable-' + Math.floor(st.time / 15), 'Unter dem Trichter fehlt ein Auffanggefäß – das Filtrat tropft auf den Tisch.', 'warn', 'noReceiver');
      } else if (paper === 'none' && solids(c) > 0.001) {
        // trockener Feststoff rieselt durch den leeren Trichterhals
        const d = Math.min(1, 2 * dt / Math.max(0.1, solids(c)));
        transfer(c, dest, { sand: c.sand * d, iron: c.iron * d, saltS: c.saltS * d }, 0.3);
      }
    }

    function stepSieve(dt) {
      const s = st.sieve;
      if (!s) return;
      const c = s.c;
      const rec = s.on ? vessel(s.on) : null;
      const dest = rec ? rec.c : st.lost.spilled;
      const retain = 0.3 + 2.5 * c.petals;
      const L = liquid(c);
      if (L > retain + 1e-6) {
        const dv = Math.min(L - retain, 25 * dt);
        const lf = dv / L;
        transfer(c, dest, { water: c.water * lf, oil: c.oil * lf, saltD: c.saltD * lf, dye: c.dye * lf, sand: c.sand * Math.min(1, lf * 1.3) * 0.92, iron: c.iron * Math.min(1, lf * 1.3), saltS: c.saltS * Math.min(1, lf * 1.3) }, 1);
      }
    }

    function stepSep(dt) {
      const s = st.sep;
      if (!s || s.cock === 0) return;
      const c = s.c;
      const L = liquid(c);
      if (L < 1e-6) return;
      const rec = sepReceiver();
      const dest = rec ? rec.c : st.lost.spilled;
      let dv = Math.min(L, 2.4 * s.cock * dt);
      // Von unten: freies Wasser, dann Emulsion, dann Öl
      const fw = Math.max(0, c.water - c.emW);
      const amt = { water: 0, oil: 0 };
      const a1 = Math.min(dv, fw); amt.water += a1; dv -= a1;
      const em = c.emW + c.emO;
      if (dv > 0 && em > 0) {
        const a2 = Math.min(dv, em);
        amt.water += a2 * c.emW / em; amt.oil += a2 * c.emO / em; dv -= a2;
      }
      if (dv > 0) amt.oil += Math.min(dv, Math.max(0, c.oil - c.emO));
      const wf = c.water > 0 ? amt.water / c.water : 0;
      amt.saltD = c.saltD * wf; amt.dye = c.dye * wf;
      // Emulsion: Abfluss aus der Emulsion verringert sie entsprechend
      const emWbefore = c.emW, emObefore = c.emO;
      const fromEmW = Math.max(0, amt.water - a1), fromEmO = Math.min(emObefore, amt.oil);
      transfer(c, dest, amt, 1);
      c.emW = Math.max(0, Math.min(c.water, emWbefore - fromEmW));
      c.emO = Math.max(0, Math.min(c.oil, emObefore - fromEmO));
      if (rec) { rec.c.agit = Math.max(rec.c.agit, 0.25); }
      if (!rec) once('sepSpill-' + Math.floor(st.time / 15), 'Der Hahn ist offen, aber unter dem Scheidetrichter steht kein Gefäß – Flüssigkeit geht verloren.', 'warn', 'sepNoReceiver');
    }

    function step(dt) {
      st.time += dt;
      if (!st.safety) stepOp(dt);
      else if (st.op && st.op.type === 'move') stepOp(dt);
      stepFunnel(dt);
      stepSieve(dt);
      stepSep(dt);
      for (const v of st.vessels) { stepHeat(v, dt); stepContents(v.c, dt, v); }
      if (st.funnel) stepContents(st.funnel.c, dt, st.funnel);
      if (st.sieve) stepContents(st.sieve.c, dt, st.sieve);
      if (st.sep) stepContents(st.sep.c, dt, st.sep);
      for (const v of st.vessels) overflow(v);
      if (st.funnel) overflow(st.funnel);
      if (st.sep) overflow(st.sep);
      checkSafety();
    }

    // ----------------------------------------------------------- Abfragen
    /** Alle Fraktionen: Behälter mit Inhalt (für Bewertung und Darstellung). */
    function fractions() {
      const out = [];
      const push = (id, lbl, kind, c) => out.push({ id, label: lbl, kind, c, d: describe(c) });
      for (const v of st.vessels) push(v.id, v.label, v.type, v.c);
      if (st.funnel) push('F', 'Filterrückstand im Trichter', 'funnel', st.funnel.c);
      if (st.sieve) push('T', 'Rückstand im Teesieb', 'sieve', st.sieve.c);
      if (st.sep) push('S', 'Scheidetrichter', 'sep', st.sep.c);
      if (st.magnet) push('magnet', 'Eisen am Magneten', 'magnet', emptyC({ iron: st.magnet.iron }));
      return out;
    }

    return {
      state: st, act, step, clock,
      advance: (sec) => clock.advance(sec),
      on: bus.on, vessel, container, label, describe, fractions, totals: () => totals(st),
      funnelReceiver, sepReceiver, atPlace, busy, BENCH
    };
  }

  return { createEngine, initialState, SETUPS, TYPES, KEYS, describe, totals, liquid, solids, mass, solidVolume, CSAT, HEATER_W, BULK };
});
