/*
 * Trennverfahren – Fachmodell (ohne DOM)
 *
 * Kleines, bilanztreues Modell der fünf klassischen Trennversuche (docs/CHEMIE.md):
 *  - Jedes Gefäß führt seine Stoffmengen: Wasser und Öl in mL, Sand (grob/fein),
 *    Eisen, festes und gelöstes Kochsalz in g. Was ein Gefäß verlässt, landet in
 *    einem anderen Gefäß, am Magneten oder in einem Verlusttopf (verschüttet,
 *    verdampft, verspritzt). Nichts verschwindet, nichts entsteht neu.
 *  - Sedimentation mit Absetzfront je Feststoff: Unterhalb der Front schwebt der
 *    Stoff gleichmäßig verteilt, oberhalb ist die Flüssigkeit klar. Rühren und
 *    zügiges Gießen wirbeln auf; Abgießen nimmt die oberste Schicht.
 *  - Lösen bis zur Löslichkeitsgrenze, Rühren beschleunigt; bei Wasserverlust
 *    kristallisiert Salz aus. Gelöstes Salz passiert das Filterpapier.
 *  - Filter: hält ungelöste Körner zurück; Flüssigkeit läuft nach der Füllhöhe ab,
 *    ein Teil bleibt im Papier und im feuchten Rückstand hängen.
 *  - Öl ist nicht mit Wasser mischbar und weniger dicht; Schütteln erzeugt eine
 *    vorübergehende Emulsion, die sich in Ruhe wieder entmischt. Der
 *    Scheidetrichter lässt die untere Schicht zuerst ab.
 *  - Heizplatte mit eigener Trägheit; Wasser verdampft, Salz bleibt zurück.
 * Zeit in s Modellzeit. Parameter sind Unterrichtsparameter (beschleunigt) und in
 * docs/CHEMIE.md von Literaturwerten getrennt aufgeführt.
 */
(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('../../../shared/labkit/js/core.js') : root.LK.core;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TV = root.TV || {}).model = api;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { clamp, clone } = core;

  // ------------------------------------------------------------------ Stoffe und Parameter
  const KEYS = ['water', 'oil', 'sandC', 'sandF', 'iron', 'saltS', 'saltD'];
  const SOLIDS = ['sandC', 'sandF', 'iron', 'saltS'];
  /** Literaturnah: Dichte g/mL (Wasser 1,00; Sonnenblumenöl ≈ 0,92). */
  const RHO = { water: 1.0, oil: 0.92 };
  /** Löslichkeit von Kochsalz in g je mL Wasser (35,9 g/100 g bei 20 °C, 39,2 g/100 g bei 100 °C). */
  const csat = (T) => 0.359 + 0.00041 * (Math.max(0, T) - 20);
  /** Unterrichtsparameter: Absinken der Front in mL Flüssigkeitssäule je s. */
  const SETTLE = { sandC: 22, sandF: 1.25, iron: 60, saltS: 30 };
  /** Anteil, der bei kräftigem Rühren schwebt. */
  const SUSPEND = { sandC: 0.85, sandF: 1, iron: 0.45, saltS: 0.7 };
  /** Erosion des Bodensatzes beim Ausgießen (relativ). */
  const ERODE = { sandC: 1, sandF: 1, iron: 0.35, saltS: 0.8 };
  /** Feuchte, die ein Rückstand festhält (mL je g Feststoff) und Papier (mL). */
  const HOLD = { sandC: 0.25, sandF: 0.3, iron: 0.08, saltS: 0.12 };
  const PAPER_HOLD = 1.2;
  const POUR = { slow: 4, fast: 12 }; // mL/s
  const POUR_SOLID = { slow: 3, fast: 8 }; // g/s
  const FILTER = { tau: 6, qmax: 2.5, tauOpen: 0.6 }; // s, mL/s
  const COCK = [0, 0.6, 4]; // mL/s: zu, Tropfen, offen
  const EMUL_TAU = 10; // s Entmischung in Ruhe
  const HEAT = { set: [20, 180, 330], tauUp: 12, tauDown: 40, h: { dish: 1.5, beaker: 1.2, erlenmeyer: 1.1 } };
  const LV = 2257; // J/g Verdampfungsenthalpie Wasser
  const ROOM = 20;
  const OPS = { move: 0.7, go: 0.9, back: 0.8, stir: 3, wash: 1.6, paper: 1.4, magnet: 2.6, magdrop: 1.8, shake: 3 };
  const WASH = [5, 20];

  /** Gefäß- und Gerätetypen. cap: Fassungsvermögen (mL Flüssigkeit). */
  const TYPES = {
    beaker: { name: 'Becherglas', cap: 230, pour: true, liquid: true, move: true, heatC: 100 },
    erlenmeyer: { name: 'Erlenmeyerkolben', cap: 230, pour: true, liquid: true, move: true, heatC: 110 },
    dish: { name: 'Abdampfschale', cap: 85, pour: false, liquid: true, move: false, heatC: 90 },
    watch: { name: 'Uhrglas', cap: 8, pour: false, liquid: true, move: false, heatC: 20 },
    bowl: { name: 'Porzellanschale', cap: 100, pour: true, liquid: true, move: false, heatC: 120 },
    funnel: { name: 'Trichter', cap: 45, pour: false, liquid: true, move: true, heatC: 40 },
    sep: { name: 'Scheidetrichter', cap: 200, pour: false, liquid: true, move: true, heatC: 120 },
    magnet: { name: 'Magnet', tool: true },
    rod: { name: 'Glasstab', tool: true },
    wash: { name: 'Spritzflasche', tool: true },
    paper: { name: 'Filterpapier', tool: true }
  };
  /** Sonderplätze: welcher Typ dort stehen kann. */
  const SLOT_ACCEPT = { ring: ['funnel'], under: ['beaker', 'erlenmeyer'], sepring: ['sep'], sepunder: ['beaker', 'erlenmeyer'], plate: ['dish', 'beaker'] };

  // ------------------------------------------------------------------ Versuche
  /**
   * Plätze: x in Weltkoordinaten (Renderer), kind: bench (Tisch, hinten), front (Tisch, vorne),
   * ring/under/sepring/sepunder/plate (Sonderplätze). Objekte stehen auf ihrem Heimplatz.
   */
  const EXPERIMENTS = {
    1: {
      key: 'sed', short: 'Dekantieren', title: 'Sand und Wasser: sedimentieren und dekantieren', width: 640, viewTop: 240,
      slots: [
        { id: 'pA', x: 105, kind: 'bench', role: 'mix' },
        { id: 'pRod', x: 235, kind: 'front' },
        { id: 'pB', x: 365, kind: 'bench', role: 'recv' },
        { id: 'pC', x: 535, kind: 'bench', role: 'recv' }
      ],
      objects: [
        { id: 'A', type: 'beaker', name: 'Becherglas A', home: 'pA', c: { water: 100, sandC: 18, sandF: 2 } },
        { id: 'rod', type: 'rod', name: 'Glasstab', home: 'pRod' },
        { id: 'B', type: 'beaker', name: 'Becherglas B', home: 'pB' },
        { id: 'C', type: 'beaker', name: 'Becherglas C', home: 'pC' }
      ],
      main: 'A'
    },
    2: {
      key: 'filt', short: 'Filtrieren', title: 'Sand und Wasser: filtrieren', width: 970, viewTop: 140,
      slots: [
        { id: 'pA', x: 95, kind: 'bench', role: 'mix' },
        { id: 'pRod', x: 160, kind: 'front' },
        { id: 'pPaper', x: 300, kind: 'front' },
        { id: 'pF', x: 255, kind: 'bench', holder: true },
        { id: 'ring', x: 460, kind: 'ring' },
        { id: 'under', x: 460, kind: 'under' },
        { id: 'pE', x: 680, kind: 'bench', role: 'recv' },
        { id: 'pB', x: 800, kind: 'bench', role: 'recv' },
        { id: 'pW', x: 900, kind: 'bench' }
      ],
      objects: [
        { id: 'A', type: 'beaker', name: 'Becherglas A', home: 'pA', c: { water: 100, sandC: 18, sandF: 2 } },
        { id: 'rod', type: 'rod', name: 'Glasstab', home: 'pRod' },
        { id: 'paper', type: 'paper', name: 'Filterpapier', home: 'pPaper' },
        { id: 'F', type: 'funnel', name: 'Trichter', home: 'pF' },
        { id: 'E', type: 'erlenmeyer', name: 'Erlenmeyerkolben', home: 'pE' },
        { id: 'B', type: 'beaker', name: 'Becherglas B', home: 'pB' },
        { id: 'wash', type: 'wash', name: 'Spritzflasche', home: 'pW' }
      ],
      main: 'A'
    },
    3: {
      key: 'evap', short: 'Eindampfen', title: 'Kochsalzlösung: eindampfen', width: 620, viewTop: 250,
      slots: [
        { id: 'pA', x: 120, kind: 'bench', role: 'mix' },
        { id: 'plate', x: 380, kind: 'plate' },
        { id: 'pRod', x: 530, kind: 'front' }
      ],
      objects: [
        { id: 'A', type: 'beaker', name: 'Becherglas A', home: 'pA', c: { water: 40, saltD: 8 } },
        { id: 'D', type: 'dish', name: 'Abdampfschale', home: 'plate' },
        { id: 'rod', type: 'rod', name: 'Glasstab', home: 'pRod' }
      ],
      plate: true, main: 'A'
    },
    4: {
      key: 'sep', short: 'Scheiden', title: 'Öl und Wasser: scheiden', width: 1050, viewTop: 55,
      slots: [
        { id: 'pA', x: 90, kind: 'bench', role: 'mix' },
        { id: 'pS', x: 245, kind: 'bench', holder: true },
        { id: 'sepring', x: 620, kind: 'sepring' },
        { id: 'sepunder', x: 620, kind: 'sepunder' },
        { id: 'pB', x: 860, kind: 'bench', role: 'recv' },
        { id: 'pC', x: 975, kind: 'bench', role: 'recv' }
      ],
      objects: [
        { id: 'A', type: 'beaker', name: 'Becherglas A', home: 'pA', c: { water: 50, oil: 50 } },
        { id: 'S', type: 'sep', name: 'Scheidetrichter', home: 'pS' },
        { id: 'B', type: 'beaker', name: 'Becherglas B', home: 'pB' },
        { id: 'C', type: 'beaker', name: 'Becherglas C', home: 'pC' }
      ],
      main: 'A'
    },
    5: {
      key: 'chain', short: 'Trennkette', title: 'Eisen, Sand und Kochsalz: eigene Trennkette', width: 960, viewTop: 140,
      slots: [
        { id: 'pM', x: 80, kind: 'bench', role: 'mix' },
        { id: 'pMag', x: 115, kind: 'front' },
        { id: 'pU', x: 205, kind: 'bench', role: 'recv' },
        { id: 'pW', x: 300, kind: 'bench' },
        { id: 'pA', x: 400, kind: 'bench' },
        { id: 'pRod', x: 330, kind: 'front' },
        { id: 'pPaper', x: 470, kind: 'front' },
        { id: 'ring', x: 600, kind: 'ring' },
        { id: 'under', x: 600, kind: 'under' },
        { id: 'plate', x: 860, kind: 'plate' }
      ],
      objects: [
        { id: 'M', type: 'bowl', name: 'Porzellanschale', home: 'pM', c: { iron: 5, sandC: 9, sandF: 1, saltS: 5 } },
        { id: 'mag', type: 'magnet', name: 'Magnet', home: 'pMag' },
        { id: 'U', type: 'watch', name: 'Uhrglas', home: 'pU' },
        { id: 'wash', type: 'wash', name: 'Spritzflasche', home: 'pW' },
        { id: 'A', type: 'beaker', name: 'Becherglas A', home: 'pA' },
        { id: 'rod', type: 'rod', name: 'Glasstab', home: 'pRod' },
        { id: 'paper', type: 'paper', name: 'Filterpapier', home: 'pPaper' },
        { id: 'F', type: 'funnel', name: 'Trichter', home: 'ring' },
        { id: 'E', type: 'erlenmeyer', name: 'Erlenmeyerkolben', home: 'under' },
        { id: 'D', type: 'dish', name: 'Abdampfschale', home: 'plate' }
      ],
      plate: true, main: 'M'
    }
  };
  const EXP_IDS = [1, 2, 3, 4, 5];

  // ------------------------------------------------------------------ Hilfen
  const zero = () => ({ water: 0, oil: 0, sandC: 0, sandF: 0, iron: 0, saltS: 0, saltD: 0 });
  const zsusp = () => ({ sandC: { m: 0, fv: 0 }, sandF: { m: 0, fv: 0 }, iron: { m: 0, fv: 0 }, saltS: { m: 0, fv: 0 } });
  const liq = (c) => c.water + c.oil;
  const sand = (c) => c.sandC + c.sandF;
  const salt = (c) => c.saltS + c.saltD;
  const solids = (c) => c.sandC + c.sandF + c.iron + c.saltS;
  const total = (c) => KEYS.reduce((s, k) => s + c[k], 0);
  const isEmpty = (c) => liq(c) < 0.05 && solids(c) + c.saltD < 0.01;
  function addTo(c, d, f) { const k0 = f == null ? 1 : f; for (const k of KEYS) c[k] += (d[k] || 0) * k0; }
  function tidy(c) { for (const k of KEYS) if (c[k] < 1e-9) c[k] = 0; }

  function initialState(expId) {
    const ex = EXPERIMENTS[expId];
    if (!ex) throw new Error('Unbekannter Versuch ' + expId);
    const objs = {};
    for (const o of ex.objects) {
      const T = TYPES[o.type];
      const obj = { id: o.id, type: o.type, name: o.name, home: o.home, at: o.home };
      if (T.liquid || o.type === 'magnet') {
        Object.assign(obj, { c: Object.assign(zero(), clone(o.c || {})), susp: zsusp(), emul: 0, agit: 0, temp: ROOM, evap: 0, boil: false });
      }
      if (o.type === 'funnel') obj.paper = false;
      if (o.type === 'sep') Object.assign(obj, { stopper: false, cock: 0, vac: 0 });
      objs[o.id] = obj;
    }
    const st = {
      v: 1, exp: expId, t: 0, seq: 0, objs, order: ex.objects.map((o) => o.id),
      plate: ex.plate ? { level: 0, T: ROOM } : null,
      pourSpeed: 'slow', washAmt: WASH[0],
      op: null,
      lost: { spilled: zero(), evaporated: zero(), spatter: zero() },
      added: zero(),
      flags: { maxSusp: 0, maxEmul: 0, sepOut: 0, magnetUses: 0, filtered: 0, stirs: 0 },
      warned: {}, log: [], drip: { F: 0, S: 0 }
    };
    st.initial = inventory(st);
    return st;
  }

  /** Gesamtbestand aller Gefäße, des Magneten und der Verlusttöpfe. */
  function inventory(st) {
    const s = zero();
    for (const id of st.order) { const o = st.objs[id]; if (o.c) addTo(s, o.c); }
    for (const k of ['spilled', 'evaporated', 'spatter']) addTo(s, st.lost[k]);
    return s;
  }
  /** Bilanz je Stoff (Salz fest + gelöst zusammen): Abweichung zum Anfangsbestand. */
  function balance(st) {
    const now = inventory(st), ini = Object.assign(zero(), st.initial);
    addTo(ini, st.added || zero());
    return {
      water: now.water - ini.water, oil: now.oil - ini.oil, sand: sand(now) - sand(ini),
      iron: now.iron - ini.iron, salt: salt(now) - salt(ini)
    };
  }

  const slotOf = (st, slotId) => EXPERIMENTS[st.exp].slots.find((s) => s.id === slotId);
  const objAt = (st, slotId) => st.order.map((id) => st.objs[id]).find((o) => o.at === slotId) || null;
  const funnel = (st) => Object.values(st.objs).find((o) => o.type === 'funnel') || null;
  const sepf = (st) => Object.values(st.objs).find((o) => o.type === 'sep') || null;

  /** Beschreibung eines Gefäßinhalts: Gemischart, homogen/heterogen, kurzer Text. */
  function describe(o) {
    if (!o || !o.c) return { kind: 'none', text: '' };
    const c = o.c;
    const L = liq(c), S = sand(c);
    const parts = [];
    if (c.iron > 0.02) parts.push('Eisen');
    if (S > 0.02) parts.push('Sand');
    if (c.saltS > 0.02) parts.push('Kochsalz (fest)');
    if (isEmpty(c)) return { kind: 'empty', hom: null, text: 'leer' };
    if (L < 0.3) {
      if (parts.length > 1) return { kind: 'gemenge', hom: false, text: 'Gemenge aus ' + parts.join(', ') + (L > 0.02 ? ' (feucht)' : '') };
      if (c.saltS > 0.02) return { kind: 'salt', hom: true, text: 'Kochsalzkristalle' + (L > 0.02 ? ' (feucht)' : '') };
      return { kind: 'solid', hom: true, text: parts[0] + (L > 0.02 ? ' (feucht)' : '') };
    }
    const suspended = SOLIDS.reduce((s, k) => s + o.susp[k].m, 0);
    const bits = [];
    let kind = 'water', hom = true;
    if (c.oil > 0.3 && c.water > 0.3) {
      if (o.emul > 0.25) { kind = 'emulsion'; bits.push('Emulsion aus Öl und Wasser (trüb, Öltröpfchen verteilt)'); }
      else { kind = 'layers'; bits.push('Öl (oben) und Wasser (unten) in zwei Schichten'); }
      hom = false;
    } else if (c.oil > 0.3) { kind = 'oil'; bits.push('Öl'); }
    else if (c.saltD > 0.05) { kind = 'solution'; bits.push('Kochsalzlösung' + (suspended < 0.05 ? ' (klar)' : '')); }
    else bits.push('Wasser');
    if (suspended > 0.15) { hom = false; kind = kind === 'solution' || kind === 'water' ? 'suspension' : kind; bits.push('mit schwebenden Feststoffen: Suspension (trüb)'); }
    const bed = solids(c) - suspended;
    if (bed > 0.05) {
      hom = false;
      const b = [];
      if (c.iron - o.susp.iron.m > 0.02) b.push('Eisen');
      if (S - o.susp.sandC.m - o.susp.sandF.m > 0.02) b.push('Sand');
      if (c.saltS - o.susp.saltS.m > 0.02) b.push(o.type === 'dish' ? 'Salzkristalle' : 'ungelöstes Salz');
      bits.push('Bodensatz: ' + b.join(', '));
    }
    return { kind, hom, text: bits.join(' · ') };
  }

  // ------------------------------------------------------------------ Engine
  function createEngine(expId, saved) {
    const bus = core.emitter();
    const st = saved && saved.v === 1 && saved.exp === expId ? clone(saved) : initialState(expId);
    const ex = EXPERIMENTS[expId];
    const clock = core.createClock({ step });

    const msg = (text, kind, code) => {
      st.seq++;
      const e = { t: +st.t.toFixed(1), kind: kind || 'info', text, code: code || null, n: st.seq };
      st.log.push(e);
      if (st.log.length > 80) st.log.splice(0, st.log.length - 80);
      bus.emit('message', e);
      return e;
    };
    const fail = (text, code) => { msg(text, 'warn', code); return { ok: false, message: text, code }; };
    const ok = (text) => { if (text) msg(text, 'info'); return { ok: true, message: text || '' }; };
    const warnOnce = (key, text) => { if (st.warned[key]) return; st.warned[key] = st.t; msg(text, 'warn', key); };
    const O = (id) => st.objs[id];
    const T = (o) => TYPES[o.type];
    const label = (o) => o.name;

    // ----- Gießen
    function canReceive(dst, src) {
      if (!dst || !dst.c || dst === src) return 'Wähle ein anderes Gefäß als Ziel.';
      if (dst.type === 'magnet') return 'Der Magnet ist kein Gefäß.';
      if (dst.type === 'funnel' && dst.at !== 'ring') return 'Setze den Trichter zuerst in den Filtrierring.';
      if (dst.type === 'sep') {
        if (dst.at !== 'sepring') return 'Hänge den Scheidetrichter zuerst in den Ring am Stativ.';
        if (dst.stopper) return 'Nimm zuerst den Stopfen vom Scheidetrichter ab.';
        if (dst.cock > 0) return 'Schließe zuerst den Hahn – sonst läuft alles unten gleich wieder heraus.';
      }
      if (liq(dst.c) >= T(dst).cap - 0.5) return `${label(dst)} ist voll.`;
      return null;
    }
    function pour(srcId, dstId) {
      const src = O(srcId), dst = O(dstId);
      if (st.op) return fail('Warte, bis der laufende Handgriff fertig ist.', 'busy');
      if (!src || !src.c || !T(src).pour) return fail('Aus diesem Gerät kann man nicht gießen.', 'nopour');
      if (src.at === 'plate' && src.temp > 50) return fail('Das Gefäß ist heiß. Lass es abkühlen.', 'hot');
      if (isEmpty(src.c)) return fail(`${label(src)} ist leer.`, 'empty');
      const why = canReceive(dst, src);
      if (why) return fail(why, 'target');
      st.op = { type: 'pour', src: srcId, dst: dstId, phase: 'go', t: 0, dur: OPS.go, poured: 0, rate: 0 };
      return ok(`${label(src)} wird über ${dst.type === 'funnel' ? 'den Trichter' : label(dst)} gehalten …`);
    }
    function stopPour(reason) {
      const op = st.op;
      if (!op || op.type !== 'pour') return { ok: false };
      if (op.phase === 'back') return { ok: true };
      op.phase = 'back'; op.t = 0; op.dur = OPS.back; op.rate = 0;
      if (reason) msg(reason, 'info', 'pourStop');
      return { ok: true };
    }
    function setPourSpeed(s) { if (!POUR[s]) return { ok: false }; st.pourSpeed = s; return { ok: true }; }

    /** Entnimmt dV von oben aus einem Gefäß (Flüssigkeit samt mitgerissener Feststoffe). */
    function takeTop(o, dV, speed) {
      const c = o.c, out = zero();
      const L = liq(c);
      if (L <= 1e-9) return out;
      dV = Math.min(dV, L);
      const oilLayer = c.oil * (1 - o.emul);
      let dOil = 0, dWP = dV;
      if (oilLayer > 1e-9) {
        const thin = oilLayer < 3 ? (1 - oilLayer / 3) * 0.5 : 0;
        dOil = Math.min(dV, oilLayer) * (1 - thin);
        dWP = dV - dOil;
      }
      const wp = c.water + c.oil * o.emul;
      if (dWP > 0 && wp > 1e-9) {
        const f = Math.min(1, dWP / wp);
        out.water = c.water * f;
        dOil += c.oil * o.emul * f;
      } else if (dWP > 0) dOil = Math.min(c.oil, dOil + dWP);
      out.oil = Math.min(c.oil, dOil);
      out.saltD = c.water > 1e-9 ? c.saltD * out.water / c.water : 0;
      const newL = L - out.water - out.oil;
      for (const k of SOLIDS) {
        const s = o.susp[k];
        if (s.m > 1e-9 && s.fv > newL) {
          const part = s.fv - newL;
          const carried = s.m * Math.min(1, part / s.fv);
          s.m -= carried; s.fv = Math.max(0, newL); out[k] += carried;
        }
        if (newL < 12) {
          const bed = Math.max(0, c[k] - s.m);
          const f = (speed === 'fast' ? 0.8 : 0.3) * ERODE[k] * (dV / Math.max(newL, 1.5));
          out[k] += bed * Math.min(1, f);
        }
      }
      for (const k of KEYS) { out[k] = Math.min(out[k], c[k]); c[k] -= out[k]; }
      for (const k of SOLIDS) o.susp[k].m = Math.min(o.susp[k].m, c[k]);
      tidy(c);
      return out;
    }
    /** Trockene Feststoffe (mit wenig Feuchte) ausschütten. */
    function takeSolids(o, dm) {
      const c = o.c, out = zero();
      const S = solids(c);
      if (S <= 1e-9) return out;
      const f = Math.min(1, dm / S);
      for (const k of KEYS) { out[k] = c[k] * f; c[k] -= out[k]; }
      for (const k of SOLIDS) o.susp[k].m *= (1 - f);
      tidy(c);
      return out;
    }
    /** Gibt Stoffe in ein Gefäß; Feststoffe kommen aufgewirbelt an. */
    function deliver(o, d, agitate) {
      if (!o) { addTo(st.lost.spilled, d); return; }
      const before = liq(o.c);
      addTo(o.c, d);
      const L = liq(o.c);
      if (o.type !== 'funnel' && L > 0.3) {
        for (const k of SOLIDS) {
          if (!d[k]) continue;
          const s = o.susp[k];
          s.m += d[k]; s.fv = L;
        }
      }
      if (agitate && L > 0.3) o.agit = Math.min(0.6, Math.max(o.agit, agitate * (1 - before / (L + 1)) + 0.05));
      if (d.oil > 0 && d.water > 0) o.emul = Math.max(o.emul, 0.05);
    }

    function pourStep(op, dt) {
      const src = O(op.src), dst = O(op.dst);
      if (op.phase !== 'flow') return;
      const L = liq(src.c);
      const dry = L < 0.5;
      const rate = dry ? POUR_SOLID[st.pourSpeed] : POUR[st.pourSpeed];
      let d = rate * dt;
      if (dry && solids(src.c) < 0.01) { stopPour(`${label(src)} ist leer.`); return; }
      if (!dry) {
        const room = T(dst).cap - liq(dst.c);
        if (room <= 0.2) { stopPour(dst.type === 'funnel' ? 'Der Trichter ist voll. Warte, bis Flüssigkeit durchgelaufen ist, und gieße dann nach.' : `${label(dst)} ist voll.`); return; }
        if (dst.type === 'funnel' && liq(dst.c) >= T(dst).cap * 0.92) { stopPour('Der Trichter ist fast voll. Warte, bis Flüssigkeit durchgelaufen ist, und gieße dann nach.'); return; }
        d = Math.min(d, room);
      }
      src.agit = Math.max(src.agit, st.pourSpeed === 'fast' ? 0.35 : 0.06);
      const out = dry ? takeSolids(src, d) : takeTop(src, d, st.pourSpeed);
      const moved = liq(out) + solids(out);
      op.rate = moved / dt;
      op.dry = dry;
      op.poured += dry ? solids(out) : liq(out);
      op.ml = (op.ml || 0) + liq(out); op.g = (op.g || 0) + solids(out);
      deliver(dst, out, st.pourSpeed === 'fast' ? 0.55 : 0.3);
      if (!dry && liq(src.c) < 0.05) {
        const rest = solids(src.c);
        stopPour(rest > 0.3 ? `Die Flüssigkeit ist abgegossen. Der Bodensatz bleibt in ${label(src)} liegen.` : `${label(src)} ist leer.`);
      }
    }

    // ----- Rühren, Spritzflasche, Papier, Bewegen
    function stir(id) {
      const o = O(id);
      if (st.op) return fail('Warte, bis der laufende Handgriff fertig ist.', 'busy');
      if (!o || !o.c) return fail('Mit dem Glasstab rührt man in einem Gefäß.', 'nostir');
      if (o.type === 'funnel') return fail('Im Filter nicht rühren – das nasse Papier reißt leicht.', 'nostir');
      if (o.type === 'sep') return fail('Im Scheidetrichter wird nicht gerührt, sondern mit Stopfen geschüttelt.', 'nostir');
      if (o.type === 'magnet') return fail('Der Magnet ist kein Gefäß.', 'nostir');
      if (isEmpty(o.c)) return fail(`${label(o)} ist leer.`, 'empty');
      st.op = { type: 'stir', v: id, t: 0, dur: OPS.stir };
      st.flags.stirs++;
      return ok(liq(o.c) > 0.3 ? `Du rührst in ${label(o)} um.` : `Du rührst die Feststoffe in ${label(o)} um.`);
    }
    function setWashAmount(a) { if (!WASH.includes(a)) return { ok: false }; st.washAmt = a; return { ok: true }; }
    function wash(id) {
      const o = O(id);
      if (st.op) return fail('Warte, bis der laufende Handgriff fertig ist.', 'busy');
      if (!o || !o.c || o.type === 'magnet') return fail('Spritze das Wasser in ein Gefäß.', 'nowash');
      if (o.type === 'sep' && o.stopper) return fail('Nimm zuerst den Stopfen vom Scheidetrichter ab.', 'stopper');
      if (o.type === 'funnel' && o.at !== 'ring') return fail('Setze den Trichter zuerst in den Filtrierring.', 'ring');
      const room = T(o).cap - liq(o.c);
      if (room < 1) return fail(`${label(o)} ist voll.`, 'full');
      st.op = { type: 'wash', v: id, t: 0, dur: OPS.wash, amt: Math.min(st.washAmt, room), done: 0 };
      return ok(`Mit der Spritzflasche gibst du ${core.fmt(st.op.amt, 0)} mL Wasser in ${o.type === 'funnel' ? 'den Trichter' : label(o)}.`);
    }
    function insertPaper(id) {
      const f = O(id);
      if (st.op) return fail('Warte, bis der laufende Handgriff fertig ist.', 'busy');
      if (!f || f.type !== 'funnel') return fail('Das Filterpapier gehört in den Trichter.', 'paper');
      if (f.paper) return fail('Im Trichter liegt schon ein Filterpapier.', 'paper');
      if (!isEmpty(f.c)) return fail('Der Trichter ist nicht leer. Lass ihn erst leer laufen.', 'paper');
      st.op = { type: 'paper', v: id, t: 0, dur: OPS.paper };
      return ok('Du faltest ein Rundfilter zum Kegel und legst es in den Trichter.');
    }
    function canMove(o, slotId) {
      const slot = slotOf(st, slotId);
      if (!slot) return 'Dieser Platz existiert nicht.';
      if (objAt(st, slotId)) return 'Dieser Platz ist besetzt.';
      if (slotId === o.home) return null;
      const acc = SLOT_ACCEPT[slot.kind];
      if (!acc || !acc.includes(o.type)) return `${label(o)} gehört nicht an diesen Platz.`;
      return null;
    }
    function move(id, slotId) {
      const o = O(id);
      if (st.op) return fail('Warte, bis der laufende Handgriff fertig ist.', 'busy');
      if (!o || !T(o).move) return fail('Dieses Gerät bleibt an seinem Platz.', 'nomove');
      if (o.at === slotId) return ok('');
      if (o.type === 'sep' && o.at === 'sepring' && !isEmpty(o.c)) return fail('Der gefüllte Scheidetrichter bleibt im Ring hängen.', 'nomove');
      if (o.type === 'funnel' && !isEmpty(o.c)) return fail('Der Trichter ist nicht leer und bleibt im Ring.', 'nomove');
      if (o.at === 'plate' && o.temp > 50) return fail('Das Gefäß ist heiß. Lass es abkühlen.', 'hot');
      const why = canMove(o, slotId);
      if (why) return fail(why, 'slot');
      st.op = { type: 'move', v: id, from: o.at, to: slotId, t: 0, dur: OPS.move };
      return ok('');
    }

    // ----- Magnet
    function magnet(id) {
      const o = O(id), m = O('mag');
      if (!m) return fail('In diesem Versuch gibt es keinen Magneten.', 'nomag');
      if (st.op) return fail('Warte, bis der laufende Handgriff fertig ist.', 'busy');
      if (!o || !o.c || o.type === 'magnet') return fail('Halte den Magneten in ein Gefäß mit dem Gemisch.', 'mag');
      if (o.type === 'sep') return fail('In den Scheidetrichter passt der Magnet nicht.', 'mag');
      if (o.c.iron < 0.02) return fail(`In ${label(o)} ist kein Eisen. Der Magnet zieht nur Eisen an – Sand und Salz bleiben liegen.`, 'noiron');
      st.op = { type: 'magnet', v: id, t: 0, dur: OPS.magnet, done: false };
      st.flags.magnetUses++;
      return ok(`Du ziehst den Magneten (in einer Kunststofftüte) durch ${o.type === 'funnel' ? 'den Rückstand im Filter' : label(o)}.`);
    }
    function magnetDrop(id) {
      const o = O(id), m = O('mag');
      if (!m) return { ok: false };
      if (st.op) return fail('Warte, bis der laufende Handgriff fertig ist.', 'busy');
      if (m.c.iron < 0.005) return fail('Am Magneten hängt nichts.', 'magempty');
      if (!o || !o.c || o.type === 'magnet' || o.type === 'sep') return fail('Streife das Eisen in ein Gefäß ab.', 'mag');
      st.op = { type: 'magdrop', v: id, t: 0, dur: OPS.magdrop, done: false };
      return ok(`Du hältst den Magneten über ${label(o)} und ziehst ihn aus der Tüte – das Eisen fällt ab.`);
    }

    // ----- Scheidetrichter
    function stopper(on) {
      const s = sepf(st);
      if (!s) return { ok: false };
      if (st.op && st.op.type === 'shake') return fail('Warte, bis das Schütteln fertig ist.', 'busy');
      if (s.stopper === !!on) return ok('');
      s.stopper = !!on; s.vac = 0;
      return ok(on ? 'Stopfen aufgesetzt.' : 'Stopfen abgenommen – beim Ablassen kann Luft nachströmen.');
    }
    function shake() {
      const s = sepf(st);
      if (!s) return { ok: false };
      if (st.op) return fail('Warte, bis der laufende Handgriff fertig ist.', 'busy');
      if (s.at !== 'sepring') return fail('Hänge den Scheidetrichter zuerst in den Ring.', 'ring');
      if (liq(s.c) < 1) return fail('Der Scheidetrichter ist leer.', 'empty');
      if (!s.stopper) return fail('Ohne Stopfen würde die Flüssigkeit beim Schütteln herausspritzen. Setze den Stopfen auf.', 'stopper');
      if (s.cock > 0) return fail('Schließe zuerst den Hahn.', 'cock');
      st.op = { type: 'shake', v: s.id, t: 0, dur: OPS.shake };
      return ok('Du schüttelst den Scheidetrichter kräftig (und lässt zwischendurch Druck über den Hahn ab).');
    }
    function setCock(level) {
      const s = sepf(st);
      if (!s) return { ok: false };
      const lv = clamp(Math.round(level), 0, 2);
      if (st.op && st.op.type === 'shake') return fail('Warte, bis das Schütteln fertig ist.', 'busy');
      if (s.cock === lv) return ok('');
      s.cock = lv; s.vac = 0;
      if (lv > 0 && s.at === 'sepring' && !objAt(st, 'sepunder') && liq(s.c) > 0.1) warnOnce('nosepRecv', 'Unter dem Scheidetrichter steht kein Gefäß – die Flüssigkeit läuft auf den Tisch!');
      return ok(lv === 0 ? 'Hahn geschlossen.' : lv === 1 ? 'Hahn leicht geöffnet: Es tropft.' : 'Hahn ganz geöffnet.');
    }

    // ----- Heizplatte
    function heat(level) {
      if (!st.plate) return { ok: false };
      const lv = clamp(Math.round(level), 0, 2);
      if (st.plate.level === lv) return ok('');
      st.plate.level = lv;
      const o = objAt(st, 'plate');
      if (lv > 0 && (!o || isEmpty(o.c))) msg('Die Heizplatte heizt, aber auf ihr steht nichts zum Eindampfen.', 'info', 'plateEmpty');
      return ok(lv === 0 ? 'Heizplatte aus – sie kühlt langsam ab.' : `Heizplatte ${lv === 1 ? 'auf niedriger' : 'auf hoher'} Stufe.`);
    }

    // ------------------------------------------------------------------ Zeitschritt
    function opStep(dt) {
      const op = st.op;
      if (!op) return;
      op.t += dt;
      const p = Math.min(1, op.t / op.dur);
      if (op.type === 'pour') {
        if (op.phase === 'go' && op.t >= op.dur) { op.phase = 'flow'; op.t = 0; op.dur = Infinity; }
        else if (op.phase === 'flow') pourStep(op, dt);
        else if (op.phase === 'back' && op.t >= op.dur) {
          const src = O(op.src);
          if ((op.ml || 0) >= 0.5) msg(`Gegossen: ${core.fmt(op.ml, 0)} mL aus ${label(src)}${op.g >= 0.1 ? ` (mit ${core.fmt(op.g, 1)} g Feststoff)` : ''}.`, 'info', 'poured');
          else if ((op.g || 0) >= 0.05) msg(`Ausgeschüttet: ${core.fmt(op.g, 1)} g aus ${label(src)}.`, 'info', 'poured');
          st.op = null; bus.emit('change', { action: 'opDone' });
        }
        return;
      }
      if (op.type === 'stir') {
        const o = O(op.v);
        o.agit = 1;
        if (liq(o.c) > 0.3 && o.c.oil > 0.3 && o.c.water > 0.3) o.emul = Math.max(o.emul, Math.min(0.55, o.emul + dt * 0.4));
      } else if (op.type === 'wash') {
        const o = O(op.v);
        const want = op.amt * p - op.done;
        if (want > 0) { deliver(o, { water: want }, 0.45); st.added.water += want; op.done += want; }
      } else if (op.type === 'shake') {
        const o = O(op.v);
        o.agit = 1; o.emul = Math.min(1, o.emul + dt * 0.8);
      } else if (op.type === 'magnet' && !op.done && op.t >= 0.7) {
        const o = O(op.v), m = O('mag');
        const wet = liq(o.c) > 0.5 || o.type === 'funnel';
        const eff = wet ? 0.65 : 0.8;
        const taken = o.c.iron * eff;
        const film = wet ? Math.min(o.c.water, taken * 0.05) : 0;
        const out = zero();
        out.iron = taken;
        if (film > 0) { out.water = film; out.saltD = o.c.water > 0 ? o.c.saltD * film / o.c.water : 0; }
        for (const k of KEYS) o.c[k] -= out[k];
        o.susp.iron.m = Math.min(o.susp.iron.m, o.c.iron);
        tidy(o.c);
        addTo(m.c, out);
        op.done = true; op.taken = taken;
      } else if (op.type === 'magdrop' && !op.done && op.t >= 1.0) {
        const o = O(op.v), m = O('mag');
        const out = Object.assign({}, m.c);
        for (const k of KEYS) m.c[k] = 0;
        deliver(o, out, 0.1);
        op.done = true;
      }
      if (op.t >= op.dur) {
        const done = op;
        st.op = null;
        if (done.type === 'move') { O(done.v).at = done.to; }
        if (done.type === 'paper') { O(done.v).paper = true; }
        if (done.type === 'magnet') msg(`Am Magneten hängen jetzt ${core.fmt(O('mag').c.iron, 1)} g Eisen. Sand und Salz bleiben zurück.`, 'info', 'magnet');
        if (done.type === 'magdrop') msg(`Eisen abgestreift: ${label(O(done.v))} enthält jetzt ${core.fmt(O(done.v).c.iron, 1)} g Eisen.`, 'info', 'magdrop');
        if (done.type === 'shake') msg('Geschüttelt: Das Öl ist in vielen Tröpfchen im Wasser verteilt.', 'info', 'shaken');
        bus.emit('change', { action: 'opDone', op: done.type });
      }
    }

    function filterStep(dt) {
      const f = funnel(st);
      if (!f) return;
      const c = f.c;
      if (f.at !== 'ring') return;
      const recv = objAt(st, 'under');
      const R = f.paper ? PAPER_HOLD + SOLIDS.reduce((s, k) => s + c[k] * HOLD[k], 0) : 0.02;
      const D = Math.max(0, c.water - R) + (f.paper ? 0 : c.oil);
      st.drip.F = 0;
      if (D <= 1e-6) return;
      const q = f.paper ? Math.min(D / FILTER.tau, FILTER.qmax) : D / FILTER.tauOpen;
      const dV = Math.min(D, Math.max(q * dt, 0.002));
      const out = zero();
      const fw = Math.min(1, dV / Math.max(c.water + (f.paper ? 0 : c.oil), 1e-9));
      out.water = c.water * fw;
      out.saltD = c.water > 0 ? c.saltD * out.water / c.water : 0;
      if (!f.paper) {
        out.oil = c.oil * fw;
        const fs = Math.min(1, dV / Math.max(D, 1e-9));
        for (const k of SOLIDS) out[k] = c[k] * fs;
      }
      for (const k of KEYS) c[k] -= out[k];
      tidy(c);
      if (!recv) warnOnce('noFiltRecv', 'Unter dem Trichter steht kein Gefäß – das Filtrat tropft auf den Tisch.');
      deliver(recv, out, 0.12);
      st.drip.F = (liq(out) + solids(out)) / dt;
      st.flags.filtered += out.water;
      if (!f.paper && solids(out) > 0.02) warnOnce('noPaper', 'Ohne Filterpapier läuft die trübe Suspension mitsamt dem Sand durch den Trichter.');
    }

    function sepStep(dt) {
      const s = sepf(st);
      st.drip.S = 0;
      if (!s || s.at !== 'sepring' || s.cock === 0) return;
      const c = s.c;
      const L = liq(c);
      if (L < 1e-6) return;
      let q = COCK[s.cock];
      if (s.stopper) {
        if (s.vac >= 0.8) { q = 0; warnOnce('vacuum', 'Es fließt nichts mehr nach: Bei aufgesetztem Stopfen kann keine Luft nachströmen. Nimm den Stopfen ab.'); }
        else s.vac += q * dt;
      }
      if (q <= 0) return;
      const dV = Math.min(L, q * dt);
      const out = zero();
      const disp = c.oil * s.emul;
      const wp = c.water + disp;
      if (c.water > 1e-6) {
        let phi = wp > 0 ? disp / wp : 0;
        if (c.water < 2.5) phi = phi + (1 - phi) * (1 - c.water / 2.5) * 0.6;
        out.water = Math.min(c.water, dV * (1 - phi));
        out.oil = Math.min(c.oil, dV * phi);
        out.saltD = c.water > 0 ? c.saltD * out.water / c.water : 0;
      } else {
        out.oil = Math.min(c.oil, dV);
      }
      for (const k of KEYS) c[k] -= out[k];
      s.emul = c.oil > 1e-9 ? clamp(Math.max(0, disp - out.oil) / c.oil, 0, 1) : 0;
      tidy(c);
      const recv = objAt(st, 'sepunder');
      if (!recv) warnOnce('nosepRecv', 'Unter dem Scheidetrichter steht kein Gefäß – die Flüssigkeit läuft auf den Tisch!');
      deliver(recv, out, 0.25);
      st.flags.sepOut += liq(out);
      st.drip.S = liq(out) / dt;
      if (liq(c) < 0.02 && !st.warned.sepEmpty) { st.warned.sepEmpty = st.t; msg('Der Scheidetrichter ist leer gelaufen. Schließe den Hahn.', 'info', 'sepEmpty'); }
    }

    function heatStep(dt) {
      const p = st.plate;
      if (p) {
        const set = HEAT.set[p.level];
        const tau = set > p.T ? HEAT.tauUp : HEAT.tauDown;
        p.T += (set - p.T) * (1 - Math.exp(-dt / tau));
      }
      for (const id of st.order) {
        const o = O(id);
        if (!o.c || o.type === 'magnet') continue;
        const c = o.c;
        const onPlate = p && o.at === 'plate';
        const Cth = 4.18 * c.water + 2.0 * c.oil + 0.85 * solids(c) + T(o).heatC;
        let P = onPlate ? (HEAT.h[o.type] || 1) * (p.T - o.temp) : 0;
        if (!onPlate) P = 0;
        const loss = 0.35 * (o.temp - ROOM);
        const open = !(o.type === 'sep' && o.stopper);
        const area = o.type === 'dish' ? 2.2 : o.type === 'bowl' ? 1.6 : o.type === 'watch' ? 1.2 : 1;
        o.evap = 0; o.boil = false;
        if (c.water > 1e-6 && open) {
          const sat = c.water > 0 ? Math.min(1, c.saltD / (csat(o.temp) * c.water)) : 0;
          const Tb = 100 + 8 * sat;
          if (o.temp >= Tb - 1e-6 && P - loss > 0) {
            const ev = Math.min(c.water, (P - loss) * dt / LV);
            c.water -= ev; addTo(st.lost.evaporated, { water: ev });
            o.evap = ev / dt; o.boil = true; o.temp = Tb;
          } else {
            const ev = Math.min(c.water, 0.00025 * area * Math.exp((o.temp - ROOM) / 17) * dt);
            c.water -= ev; addTo(st.lost.evaporated, { water: ev });
            o.evap = ev / dt;
            o.temp += (P - loss - ev * LV / dt) * dt / Cth;
            if (o.temp > Tb) o.temp = Tb;
          }
          if (c.water < 1e-6) { c.water = 0; }
        } else {
          o.temp += (P - loss) * dt / Cth;
        }
        if (o.temp < ROOM && !onPlate) o.temp += (ROOM - o.temp) * dt * 0.02;
        // Spritzen kurz vor dem Trockenwerden, Trockenlaufen
        if (onPlate && p.level === 2 && c.water > 0 && c.water < 1.5 && c.saltS > 0.5 && o.temp > 99) {
          const sp = Math.min(c.saltS, 0.015 * dt);
          c.saltS -= sp; o.susp.saltS.m = Math.min(o.susp.saltS.m, c.saltS);
          addTo(st.lost.spatter, { saltS: sp });
          warnOnce('spatter', 'Es knistert: Kurz vor dem Trocknen spritzen Salzkristalle aus der Schale. Schalte die Heizplatte herunter oder aus – die Restwärme genügt.');
        }
        if (onPlate && p.level > 0 && c.water <= 0 && c.saltS + c.saltD > 0.3 && o.temp > 140) warnOnce('dry', 'Die Schale ist trocken. Schalte die Heizplatte aus.');
      }
    }

    function dissolveStep(o, dt) {
      const c = o.c;
      if (c.water > 1e-6) {
        const cap = csat(o.temp) * c.water;
        if (c.saltS > 1e-9 && c.saltD < cap) {
          const under = 1 - c.saltD / cap;
          const mix = 0.15 + 0.85 * Math.min(1, o.agit * 2);
          const r = Math.min(c.saltS, cap - c.saltD, 0.6 * Math.pow(c.saltS, 2 / 3) * under * mix * dt);
          c.saltS -= r; c.saltD += r;
          const s = o.susp.saltS; s.m = Math.max(0, Math.min(s.m - r, c.saltS));
        } else if (c.saltD > cap) {
          const r = (c.saltD - cap) * Math.min(1, 0.8 * dt);
          c.saltD -= r; c.saltS += r;
        }
      } else if (c.saltD > 0) { c.saltS += c.saltD; c.saltD = 0; }
    }

    function settleStep(o, dt) {
      const c = o.c;
      const L = liq(c);
      if (o.type === 'funnel' || L < 0.3) {
        for (const k of SOLIDS) { o.susp[k].m = 0; o.susp[k].fv = 0; }
        o.agit = Math.max(0, o.agit - dt * 1.5);
        return;
      }
      const a = o.agit;
      for (const k of SOLIDS) {
        const s = o.susp[k];
        if (c[k] <= 1e-9) { s.m = 0; s.fv = 0; continue; }
        s.fv = Math.min(s.fv, L);
        if (a > 0.05) {
          const target = c[k] * SUSPEND[k] * a;
          if (target > s.m) s.m += (target - s.m) * Math.min(1, 3 * a * dt);
          s.fv += (L - s.fv) * Math.min(1, 6 * a * dt);
        }
        const calm = Math.max(0, 1 - a * 1.6);
        if (calm > 0 && s.m > 1e-9 && s.fv > 0) {
          const dfv = Math.min(s.fv, SETTLE[k] * calm * dt);
          const C = s.m / s.fv;
          s.m = Math.max(0, s.m - C * dfv); s.fv -= dfv;
        }
        if (s.fv <= 1e-6 || s.m <= 1e-7) { s.m = 0; s.fv = 0; }
        s.m = Math.min(s.m, c[k]);
      }
      // Emulsion entmischt sich in Ruhe
      if (c.oil > 0.05 && c.water > 0.05) {
        if (a < 0.2) o.emul = Math.max(0, o.emul - o.emul / EMUL_TAU * dt * (1 - a * 4));
      } else o.emul = 0;
      o.agit = Math.max(0, o.agit - dt * (st.op && st.op.type === 'pour' ? 0.6 : 0.9));
    }

    function step(dt) {
      st.t += dt;
      opStep(dt);
      filterStep(dt);
      sepStep(dt);
      heatStep(dt);
      for (const id of st.order) {
        const o = O(id);
        if (!o.c || o.type === 'magnet') continue;
        dissolveStep(o, dt);
        settleStep(o, dt);
      }
      // Kennwerte für die Auswertung
      const main = O(ex.main);
      if (main && main.c && sand(main.c) > 1) {
        const sf = (main.susp.sandC.m + main.susp.sandF.m) / sand(main.c);
        st.flags.maxSusp = Math.max(st.flags.maxSusp, sf);
      }
      for (const id of st.order) { const o = O(id); if (o.c && o.c.oil > 5 && o.c.water > 5) st.flags.maxEmul = Math.max(st.flags.maxEmul, o.emul); }
    }

    function advance(sec) { const n = clock.advance(sec); if (n) bus.emit('tick'); return n; }

    const ACTIONS = { pour, stopPour, setPourSpeed, stir, wash, setWashAmount, insertPaper, move, magnet, magnetDrop, stopper, shake, setCock, heat };
    function act(name, ...args) {
      const fn = ACTIONS[name];
      if (!fn) return { ok: false, message: 'Unbekannte Handlung ' + name };
      const r = fn(...args);
      bus.emit('change', { action: name, result: r });
      return r;
    }

    return {
      state: st, exp: ex, act, advance, step, on: bus.on,
      evaluate: () => evaluate(st), describe: (id) => describe(st.objs[id]), balance: () => balance(st),
      /** Handgriff mit Flüssigkeitsbewegung, bei dem der Zeitraffer auf 1× begrenzt wird. */
      handBusy: () => !!st.op || !!(sepf(st) && sepf(st).cock > 0 && sepf(st).at === 'sepring' && liq(sepf(st).c) > 0.05),
      canReceive, canMove: (id, slot) => canMove(st.objs[id], slot)
    };
  }

  // ------------------------------------------------------------------ Auswertung (Versuchszustand)
  /** Liste aller Gefäße mit Inhalt (ohne Magnet). */
  const vessels = (st, except) => st.order.map((id) => st.objs[id]).filter((o) => o.c && o.type !== 'magnet' && !(except || []).includes(o.id));
  const fx = (v, d) => core.fmt(v, d == null ? 1 : d);

  function evaluate(st) {
    const o = st.objs;
    const crit = [];
    const add = (id, okv, text, detail) => crit.push({ id, ok: !!okv, text, detail: detail || '' });
    switch (st.exp) {
      case 1: {
        add('stirred', st.flags.maxSusp >= 0.5, 'Sand und Wasser aufgerührt: eine trübe Suspension liegt vor', st.flags.maxSusp >= 0.5 ? '' : 'Bisher wurde der Sand nicht aufgewirbelt.');
        const cands = vessels(st, ['A']).filter((v) => v.c.water > 1);
        const best = cands.filter((v) => sand(v.c) <= 0.3).sort((a, b) => b.c.water - a.c.water)[0] || cands.sort((a, b) => b.c.water - a.c.water)[0];
        add('poured', best && best.c.water >= 50, 'Mindestens 50 mL Wasser in ein anderes Becherglas abgegossen', best ? `${best.name}: ${fx(best.c.water, 0)} mL Wasser` : 'Noch nichts abgegossen.');
        add('clear', best && best.c.water >= 50 && sand(best.c) <= 0.3, 'Das abgegossene Wasser ist (fast) frei von Sand (höchstens 0,3 g)', best ? `${best.name}: ${fx(sand(best.c), 2)} g Sand` : '');
        add('sandStays', sand(o.A.c) >= 15, 'Der Sand bleibt größtenteils als Bodensatz in Becherglas A (mindestens 15 von 20 g)', `Becherglas A: ${fx(sand(o.A.c))} g Sand`);
        break;
      }
      case 2: {
        const F = o.F;
        add('paper', F.paper && F.at === 'ring', 'Trichter mit Filterpapier im Filtrierring', F.paper ? (F.at === 'ring' ? '' : 'Trichter steht noch nicht im Ring.') : 'Kein Filterpapier im Trichter.');
        const cands = vessels(st, ['A', 'F']).filter((v) => v.c.water > 1);
        const best = cands.filter((v) => sand(v.c) <= 0.05).sort((a, b) => b.c.water - a.c.water)[0] || cands.sort((a, b) => b.c.water - a.c.water)[0];
        add('filtrate', best && best.c.water >= 60 && sand(best.c) <= 0.05, 'Klares Filtrat: mindestens 60 mL Wasser ohne Sand in einem Auffanggefäß', best ? `${best.name}: ${fx(best.c.water, 0)} mL, ${fx(sand(best.c), 2)} g Sand` : 'Noch kein Filtrat.');
        add('residue', F.paper && sand(F.c) >= 15, 'Sand als Rückstand im Filterpapier (mindestens 15 von 20 g)', `im Filter: ${fx(sand(F.c))} g Sand`);
        break;
      }
      case 3: {
        const D = o.D;
        add('salt', D.c.saltS >= 5.6, 'Festes Kochsalz in der Abdampfschale (mindestens 5,6 von 8 g)', `Abdampfschale: ${fx(D.c.saltS)} g Salzkristalle`);
        add('dry', D.c.saltS >= 0.5 && D.c.water <= 1, 'Das Wasser ist (fast) vollständig verdampft (höchstens 1 mL Rest)', `Restwasser: ${fx(D.c.water)} mL`);
        add('evap', st.lost.evaporated.water >= 25, 'Das Wasser ist als Wasserdampf entwichen (es wird hier nicht aufgefangen)', `verdampft: ${fx(st.lost.evaporated.water, 0)} mL`);
        break;
      }
      case 4: {
        add('shaken', st.flags.maxEmul >= 0.6, 'Öl und Wasser geschüttelt: vorübergehende Emulsion beobachtet', st.flags.maxEmul >= 0.6 ? '' : 'Noch nicht kräftig geschüttelt.');
        add('sepUsed', st.flags.sepOut >= 30, 'Mit dem Scheidetrichter über den Hahn abgelassen', `abgelassen: ${fx(st.flags.sepOut, 0)} mL`);
        const vs = vessels(st, ['S']);
        const w = vs.filter((v) => v.c.water >= 40).sort((a, b) => a.c.oil - b.c.oil)[0];
        add('water', w && w.c.oil <= 1.5, 'Wasserfraktion: mindestens 40 mL Wasser mit höchstens 1,5 mL Öl', w ? `${w.name}: ${fx(w.c.water, 0)} mL Wasser, ${fx(w.c.oil)} mL Öl` : 'Noch keine Wasserfraktion.');
        const oi = vs.filter((v) => v.c.oil >= 40 && v !== w).sort((a, b) => a.c.water - b.c.water)[0];
        add('oil', oi && oi.c.water <= 1.5, 'Ölfraktion in einem anderen Gefäß: mindestens 40 mL Öl mit höchstens 1,5 mL Wasser', oi ? `${oi.name}: ${fx(oi.c.oil, 0)} mL Öl, ${fx(oi.c.water)} mL Wasser` : 'Noch keine gesonderte Ölfraktion.');
        break;
      }
      case 5: {
        const vs = vessels(st);
        const iron = vs.filter((v) => v.c.iron >= 4).sort((a, b) => (sand(a.c) + salt(a.c)) - (sand(b.c) + salt(b.c)))[0];
        add('iron', iron && sand(iron.c) <= 0.1 && salt(iron.c) <= 0.15, 'Eisen: mindestens 4 g ohne Sand und Salz in einem eigenen Gefäß', iron ? `${iron.name}: ${fx(iron.c.iron)} g Eisen, ${fx(sand(iron.c), 2)} g Sand, ${fx(salt(iron.c), 2)} g Salz` : 'Noch keine Eisenfraktion.');
        const sd = vs.filter((v) => sand(v.c) >= 7.5).sort((a, b) => (a.c.iron + salt(a.c)) - (b.c.iron + salt(b.c)))[0];
        add('sand', sd && sd.c.iron <= 0.3 && salt(sd.c) <= 0.6, 'Sand: mindestens 7,5 g mit höchstens 0,3 g Eisen und 0,6 g Salz', sd ? `${sd.name}: ${fx(sand(sd.c))} g Sand, ${fx(sd.c.iron, 2)} g Eisen, ${fx(salt(sd.c), 2)} g Salz (davon ${fx(sd.c.saltS, 2)} g ungelöst)` : 'Noch keine Sandfraktion.');
        const sl = vs.filter((v) => v.c.saltS >= 3.5).sort((a, b) => (sand(a.c) + a.c.iron) - (sand(b.c) + b.c.iron))[0];
        add('salt', sl && sl.c.water <= 1 && sand(sl.c) <= 0.05 && sl.c.iron <= 0.05, 'Kochsalz: mindestens 3,5 g trockene Kristalle ohne Sand und Eisen', sl ? `${sl.name}: ${fx(sl.c.saltS)} g Salz, ${fx(sl.c.water)} mL Wasser, ${fx(sand(sl.c), 2)} g Sand, ${fx(sl.c.iron, 2)} g Eisen` : 'Noch keine Salzfraktion.');
        break;
      }
    }
    return { done: crit.every((c) => c.ok), criteria: crit };
  }

  return {
    KEYS, SOLIDS, RHO, TYPES, SETTLE, SUSPEND, HOLD, PAPER_HOLD, POUR, POUR_SOLID, FILTER, COCK, EMUL_TAU, HEAT, OPS, WASH, SLOT_ACCEPT,
    EXPERIMENTS, EXP_IDS, csat, liq, sand, salt, solids, total, isEmpty, zero,
    initialState, inventory, balance, describe, evaluate, createEngine, slotOf, objAt
  };
});
