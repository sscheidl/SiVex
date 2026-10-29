/*
 * Pufferfish – zentraler Versuchszustand (ohne DOM, in Node testbar)
 *
 * Ein Zustand führt Mengen, Volumina, Messreihen und den Dosiervorgang.
 * Renderer, Teilchenansicht, Kurve, Verhältnisdiagramm und Journal lesen nur daraus.
 *
 * Ablauf einer Zugabe: Pipette holt die gewählte Lösung aus der Flasche → fährt
 * über das Glas → Tropfen bzw. Strahl fällt → erst beim Auftreffen ändert sich die
 * Zusammensetzung (Modell) → Mischphase („mischt …“) → stabiler Messwert wird
 * als Kurvenpunkt protokolliert (Versuche 1 und 2). Während eine Zugabe läuft,
 * werden weitere Dosierbefehle abgewiesen; so entsteht weder doppelte noch
 * verlorene Dosierung.
 *
 * Versuch 3 (Puffer herstellen): ein Becherglas, in das die beiden Stammlösungen
 * des gewählten Puffersystems dosiert werden. Der pH-Wert wird erst auf Befehl
 * „Mischen und pH messen“ aus dem Modell bestimmt – nicht angepasst, nicht vorab.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const chem = isNode ? require('./chem.js') : root.PF.chem;
  const geo = isNode ? require('./geometry.js') : root.PF.geometry;
  const api = factory(chem, geo);
  if (isNode) module.exports = api;
  else (root.PF = root.PF || {}).engine = api;
})(typeof self !== 'undefined' ? self : this, function (C, G) {
  'use strict';

  // ------------------------------------------------------------ Proben und Versuche
  const SAMPLES = {
    water: { name: 'Wasser', detail: '30 mL, CO₂-freies Modellwasser', make: () => C.water(30) },
    puffer: { name: 'Pufferlösung', detail: '30 mL Modelllösung', make: () => C.phosphate(30, 0.05, 0.05) },
    hac: { name: 'Essigsäure', detail: '30 mL, c = 0,100 mol/L', make: () => C.acetate(30, 0.1, 0) },
    naac: { name: 'Natriumacetat', detail: '30 mL, c = 0,100 mol/L', make: () => C.acetate(30, 0, 0.1) },
    mix: { name: 'Gemisch 1 : 1', detail: '30 mL, je 0,050 mol/L CH₃COOH und CH₃COO⁻', make: () => C.acetate(30, 0.05, 0.05) },
    batch: { name: 'Pufferlösung (hergestellt)', detail: 'Mischung der beiden Stammlösungen', make: () => C.comp(0) }
  };

  const DOSES = {
    d1: { tool: 'dropper', drops: 1, vol: C.DROP_ML, label: '1 Tropfen' },
    d5: { tool: 'dropper', drops: 5, vol: 5 * C.DROP_ML, label: '5 Tropfen' },
    m05: { tool: 'measure', vol: 0.5, label: '0,5 mL' },
    m1: { tool: 'measure', vol: 1.0, label: '1,0 mL' },
    m5: { tool: 'measure', vol: 5.0, label: '5,0 mL' },
    m10: { tool: 'measure', vol: 10.0, label: '10,0 mL' }
  };
  const EXPERIMENTS = [
    { id: 'e1', n: 1, title: 'Wasser und Pufferlösung', short: 'Wasser & Pufferlösung', beakers: ['water', 'puffer'], tools: ['dropper', 'measure'], doses: ['d1', 'd5', 'm05', 'm1', 'm5'], defaultKind: 'd1' },
    { id: 'e2', n: 2, title: 'Säure, Base und Gemisch', short: 'Säure, Base, Gemisch', beakers: ['hac', 'naac', 'mix'], tools: ['dropper', 'measure'], doses: ['d1', 'd5', 'm05', 'm1', 'm5'], defaultKind: 'd1' },
    { id: 'e3', n: 3, title: 'Puffer gezielt herstellen', short: 'Puffer herstellen', beakers: ['batch'], mixing: true, tools: ['measure'], doses: ['m05', 'm1', 'm5', 'm10'], defaultKind: 'm5' }
  ];
  const expById = (id) => EXPERIMENTS.find((e) => e.id === id);

  const REAGENTS = {
    HCl: { formula: 'HCl', name: 'Salzsäure', label: 'HCl (c = 0,100 mol/L)', ion: 'H₃O⁺', tone: 'acid' },
    NaOH: { formula: 'NaOH', name: 'Natronlauge', label: 'NaOH (c = 0,100 mol/L)', ion: 'OH⁻', tone: 'base' }
  };
  for (const id of C.SYSTEM_IDS) {
    const S = C.SYSTEMS[id];
    REAGENTS[S.acid.stock] = { formula: S.acid.stockFormula, name: S.acid.name, label: `${S.acid.name} (c = 0,100 mol/L)`, ion: S.acid.formula, tone: 'acid', stock: true };
    REAGENTS[S.base.stock] = { formula: S.base.stockFormula, name: S.base.name, label: `${S.base.name} (c = 0,100 mol/L)`, ion: S.base.formula, tone: 'base', stock: true };
  }
  /** Flaschen der aktuellen Reihe (Reihenfolge = Flaschenplatz von links). */
  function bottleKeys(s) {
    if (s && s.kind === 'mix') return s.system ? [C.SYSTEMS[s.system].acid.stock, C.SYSTEMS[s.system].base.stock] : [];
    return ['HCl', 'NaOH'];
  }

  // Zeiten bei 1× (Sekunden) – didaktisch verlangsamt, keine gemessenen Geschwindigkeiten
  const GRAV = 2600; // Welteinheiten/s² (verlangsamter Fall)
  const MOVE_SPEED = 1500;
  const TAU_STILL = 1.6, TAU_STIR = 0.3, STIR_TIME = 2.6, SETTLED = 0.95;
  const MEASURE_TIME = 3.0;
  const FLOW = 2.5; // mL/s aus der Messpipette

  function create() {
    let uid = 1;
    const st = {
      time: 0, exp: 'e1', slot: 'HCl', tool: 'dropper', kind: 'd1', system: null, target: null, worldW: G.W,
      series: {}, active: {}, archive: [], history: [],
      pipette: { tool: 'dropper', x: G.PIPETTES.dropper.rest.x, y: G.PIPETTES.dropper.rest.y, content: 0, squeeze: 0, flowing: false },
      op: null, drops: [], streams: [], fx: [], log: []
    };
    const isMix = (id) => !!expById(id || st.exp).mixing;

    // ---------------------------------------------------------- Messreihen
    function makeBeaker(key, comp) {
      const s = SAMPLES[key];
      const c = comp ? C.copy(comp) : s.make();
      const mixing = key === 'batch';
      const pH = c.V > 0 ? C.pH(c) : null;
      return {
        key, type: 'b100', comp0: C.copy(c), comp: c, added: 0, records: pH == null ? [] : [{ v: 0, pH }], pending: [],
        shown: { comp: C.copy(c), pH }, extra: 0, stirUntil: -1, lastLand: -1,
        vols: {}, meas: mixing ? null : undefined
      };
    }
    function makeSeries(expId, reagent, kind, from, comps) {
      const e = expById(expId);
      const keys = from ? from.beakers.map((b) => b.key) : e.beakers;
      return {
        id: 's' + uid++, exp: expId, reagent, kind, created: Date.now(), system: null,
        from: from ? { id: from.id, reagent: from.reagent, added: from.beakers.map((b) => b.added) } : null,
        beakers: keys.map((k, i) => makeBeaker(k, comps ? comps[i] : null))
      };
    }
    function makeMixSeries() {
      const s = makeSeries('e3', null, 'mix');
      s.system = st.system;
      return s;
    }
    function slots(expId) { return (st.active[expId] = st.active[expId] || { HCl: null, NaOH: null, cont: null, mix: null }); }
    function reagentOf(slot, expId) {
      if (slot !== 'cont') return slot;
      const s = st.series[slots(expId).cont];
      return s ? s.reagent : 'NaOH';
    }
    /** Gewählte Lösung der Reihe s (bei Versuch 3: die gerade gewählte Stammlösung). */
    function activeReagent(s) { return s.kind === 'mix' ? st.slot : s.reagent; }
    function normalizeSlot() {
      if (isMix()) {
        const keys = bottleKeys({ kind: 'mix', system: st.system });
        if (!keys.includes(st.slot)) st.slot = keys[0] || null;
      } else if (!['HCl', 'NaOH', 'cont'].includes(st.slot)) st.slot = 'HCl';
      if (st.slot === 'cont' && !slots(st.exp).cont) st.slot = 'HCl';
    }
    function current() {
      normalizeSlot();
      const a = slots(st.exp);
      if (isMix()) {
        let s = a.mix && st.series[a.mix];
        if (!s || s.system !== st.system) {
          if (s) archiveRuns(s, [0], 'neu angesetzt');
          if (s) delete st.series[s.id];
          s = makeMixSeries(); st.series[s.id] = s; a.mix = s.id;
        }
        return s;
      }
      let id = a[st.slot];
      if (!id || !st.series[id]) {
        const s = makeSeries(st.exp, st.slot, 'fresh');
        st.series[s.id] = s; a[st.slot] = s.id; id = s.id;
      }
      return st.series[id];
    }
    const used = (s) => s.beakers.some((b) => b.added > 0);
    function archiveRuns(s, idxs, why) {
      if (s.kind === 'mix') return null; // Messungen stehen in st.history
      const runs = idxs.map((i) => s.beakers[i]).filter((b) => b.records.length > 1)
        .map((b) => ({ key: b.key, records: b.records.map((p) => ({ v: p.v, pH: p.pH })) }));
      if (!runs.length) return null;
      const a = { id: 'a' + uid++, exp: s.exp, reagent: s.reagent, kind: s.kind, from: s.from, created: s.created, archived: Date.now(), why, runs };
      st.archive.push(a);
      return a;
    }

    // ---------------------------------------------------------- Abfragen
    const measuring = () => Object.values(st.series).some((s) => s.kind === 'mix' && s.beakers.some((b) => b.meas && !b.meas.done));
    const busy = () => !!st.op || st.drops.length > 0 || st.streams.length > 0 || measuring();
    const geometry = () => G.layout(current().beakers.map((b) => b.type), st.worldW);
    /** Welt-Breite des sichtbaren Ausschnitts (vom Renderer gemeldet; rein geometrisch). */
    function setWorldWidth(w) { st.worldW = Math.max(G.W, Math.round(w || G.W)); }

    /** Anzeigewert des pH-Meters: stabil oder während der Mischung gleitend. Versuch 3: nur nach Messung. */
    function meter(b) {
      if (b.key === 'batch') {
        if (b.meas && b.meas.done) return { pH: b.meas.pH, mixing: false, measured: true };
        if (b.meas) return { pH: null, mixing: true, measured: false };
        return { pH: null, mixing: false, measured: false };
      }
      if (!b.pending.length) return { pH: b.shown.pH, mixing: false, measured: true };
      const last = b.pending[b.pending.length - 1];
      const p = Math.min(0.97, last.P);
      return { pH: b.shown.pH + (last.pH - b.shown.pH) * p, mixing: true, measured: true };
    }

    // ---------------------------------------------------------- Befehle
    function refuse(reason, text) { return { ok: false, reason, text }; }
    const BUSY = 'Warte, bis die laufende Zugabe beendet ist.';

    function selectExperiment(id) {
      if (busy()) return refuse('busy', BUSY);
      const e = expById(id);
      if (!e) return refuse('unknown', 'Unbekannter Versuch.');
      st.exp = id;
      normalizeSlot();
      if (!e.tools.includes(st.tool)) {
        st.tool = e.tools[0];
        const rest = G.PIPETTES[st.tool].rest;
        Object.assign(st.pipette, { tool: st.tool, x: rest.x, y: rest.y, content: 0 });
        st.kind = e.defaultKind;
      } else if (!e.doses.includes(st.kind)) st.kind = e.doses.find((k) => DOSES[k].tool === st.tool) || e.defaultKind;
      current();
      return { ok: true };
    }
    /** Lösung wählen: HCl/NaOH/Gegenprobe (Versuche 1, 2) bzw. Stammlösung (Versuch 3). */
    function selectSlot(slot) {
      if (busy()) return refuse('busy', BUSY);
      if (isMix()) {
        if (!bottleKeys({ kind: 'mix', system: st.system }).includes(slot)) return refuse('none', 'Wähle zuerst ein Puffersystem.');
        st.slot = slot; return { ok: true };
      }
      if (slot === 'cont' && !slots(st.exp).cont) return refuse('none', 'Es gibt noch keine Gegenprobe.');
      if (!['HCl', 'NaOH', 'cont'].includes(slot)) return refuse('unknown', 'Unbekannte Lösung.');
      st.slot = slot;
      current();
      return { ok: true };
    }
    function setTool(tool) {
      if (busy()) return refuse('busy', 'Die Pipette ist gerade in Gebrauch.');
      if (!G.PIPETTES[tool]) return refuse('unknown', 'Unbekannte Pipette.');
      const e = expById(st.exp);
      if (!e.tools.includes(tool)) return refuse('tool', 'Diese Pipette wird in diesem Versuch nicht benötigt.');
      st.tool = tool;
      if (DOSES[st.kind].tool !== tool || !e.doses.includes(st.kind)) st.kind = e.doses.find((k) => DOSES[k].tool === tool) || st.kind;
      const rest = G.PIPETTES[tool].rest;
      Object.assign(st.pipette, { tool, x: rest.x, y: rest.y, content: 0 });
      return { ok: true };
    }
    /** Zugabemenge wählen; wechselt bei Bedarf die Pipette. */
    function setKind(kind) {
      if (busy()) return refuse('busy', 'Die Pipette ist gerade in Gebrauch.');
      const d = DOSES[kind];
      if (!d || !expById(st.exp).doses.includes(kind)) return refuse('unknown', 'Diese Zugabemenge gibt es hier nicht.');
      if (d.tool !== st.tool) { const r = setTool(d.tool); if (!r.ok) return r; }
      st.kind = kind;
      return { ok: true };
    }
    /** Puffersystem und Ziel-pH für Versuch 3 festlegen (neues, leeres Becherglas). */
    function selectSystem(sys, target) {
      if (busy()) return refuse('busy', BUSY);
      if (sys != null && !C.SYSTEMS[sys]) return refuse('unknown', 'Unbekanntes Puffersystem.');
      st.target = Number.isFinite(target) ? target : st.target;
      if (sys !== st.system) {
        st.system = sys;
        const a = slots('e3');
        if (a.mix && st.series[a.mix]) { delete st.series[a.mix]; a.mix = null; }
        st.slot = sys ? C.SYSTEMS[sys].acid.stock : null;
      }
      if (isMix()) current();
      return { ok: true };
    }
    /** Neues, leeres Becherglas für Versuch 3 (Messungen bleiben in der Liste). */
    function newBatch() {
      if (busy()) return refuse('busy', BUSY);
      const a = slots('e3');
      if (a.mix && st.series[a.mix]) { delete st.series[a.mix]; a.mix = null; }
      if (isMix()) current();
      return { ok: true };
    }

    function path(points) {
      // Verfahrweg über Stützpunkte, Dauer aus Weglänge
      const segs = [];
      let { x, y } = st.pipette;
      for (const p of points) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d > 0.5) segs.push({ type: 'move', from: { x, y }, to: { x: p.x, y: p.y }, dur: 0.12 + d / MOVE_SPEED });
        x = p.x; y = p.y;
      }
      return segs;
    }

    function dose(kind, targets) {
      const d = DOSES[kind];
      if (!d) return refuse('unknown', 'Unbekannte Dosierung.');
      if (busy()) return refuse('busy', 'Die Pipette ist noch unterwegs – warte, bis die Zugabe beendet ist.');
      if (!expById(st.exp).doses.includes(kind)) return refuse('unknown', 'Diese Zugabemenge gibt es hier nicht.');
      if (d.tool !== st.tool) return refuse('tool', `Für „${d.label}“ zuerst die ${d.tool === 'dropper' ? 'Tropfpipette' : 'Messpipette'} wählen.`);
      const s = current();
      if (s.kind === 'mix' && !st.system) return refuse('system', 'Wähle zuerst ein Puffersystem.');
      const reagent = activeReagent(s);
      const idx = (targets && targets.length ? targets : s.beakers.map((_, i) => i)).filter((i) => s.beakers[i]);
      if (!idx.length) return refuse('target', 'Kein Glas gewählt.');
      for (const i of idx) {
        const b = s.beakers[i];
        if (b.comp.V + d.vol > G.TYPES[b.type].maxFill + 1e-9) return refuse('full', `Glas ${String.fromCharCode(65 + i)} ist zu voll für diese Zugabe.`);
      }
      const geo = geometry();
      const P = G.PIPETTES[st.tool];
      const bx = G.BOTTLE_X[Math.max(0, bottleKeys(s).indexOf(reagent))];
      const segs = [];
      const fill = (amount) => {
        segs.push({ type: 'goto', points: [{ x: bx, y: G.TRAVEL[st.tool] }, { x: bx, y: G.BOTTLE.dipY }] });
        segs.push({ type: 'fill', dur: 0.4, amount });
        segs.push({ type: 'goto', points: [{ x: bx, y: G.TRAVEL[st.tool] }] });
      };
      const opId = 'o' + uid++;
      if (st.tool === 'dropper') fill(d.vol * idx.length);
      for (const i of idx) {
        if (st.tool === 'measure') fill(d.vol);
        const tip = G.tipOver(geo[i], st.tool);
        segs.push({ type: 'goto', points: [{ x: tip.x, y: G.TRAVEL[st.tool] }, tip] });
        if (st.tool === 'dropper') {
          for (let k = 0; k < d.drops; k++) {
            segs.push({ type: 'squeeze', dur: 0.16, beaker: i, vol: C.DROP_ML, dose: opId + ':' + i, first: k === 0, last: k === d.drops - 1, label: d.label });
            segs.push({ type: 'wait', dur: 0.3 });
          }
        } else {
          segs.push({ type: 'stream', dur: Math.max(0.45, d.vol / FLOW), beaker: i, vol: d.vol, dose: opId + ':' + i, label: d.label });
          segs.push({ type: 'wait', dur: 0.25 });
        }
        segs.push({ type: 'goto', points: [{ x: tip.x, y: G.TRAVEL[st.tool] }] });
      }
      segs.push({ type: 'goto', points: [{ x: P.rest.x, y: G.TRAVEL[st.tool] }, P.rest] });
      st.op = { id: opId, kind, series: s.id, reagent, targets: idx, segs, i: 0, t: 0, cur: null };
      st.log.push({ t: st.time, kind, reagent, targets: idx.slice(), series: s.id });
      return { ok: true, id: opId };
    }

    /** Rühren an/aus: Rührfische in allen Gläsern drehen dauerhaft (schnellere Durchmischung). */
    function setStir(on) { st.stirOn = !!on; return { ok: true }; }
    const stirring = (b) => st.stirOn || b.stirUntil > st.time;

    function stir(targets) {
      const s = current();
      const idx = targets && targets.length ? targets : s.beakers.map((_, i) => i);
      for (const i of idx) if (s.beakers[i]) s.beakers[i].stirUntil = st.time + STIR_TIME;
      return { ok: true };
    }

    function newSeries() {
      if (busy()) return refuse('busy', BUSY);
      if (isMix()) return refuse('mix', 'In diesem Versuch setzt „Neu ansetzen“ ein leeres Becherglas auf.');
      const s = current();
      if (!used(s)) return refuse('fresh', 'Die Ansätze sind noch unbehandelt – eine neue Messreihe ist nicht nötig.');
      archiveRuns(s, s.beakers.map((_, i) => i), 'neue Messreihe');
      const a = slots(st.exp);
      if (s.kind === 'cont') { delete st.series[s.id]; a.cont = null; st.slot = s.from ? s.from.reagent : 'HCl'; current(); return { ok: true, cont: true }; }
      const n = makeSeries(st.exp, s.reagent, 'fresh');
      st.series[n.id] = n; a[st.slot] = n.id; delete st.series[s.id];
      return { ok: true };
    }

    function freshSample(i) {
      if (busy()) return refuse('busy', BUSY);
      const s = current();
      if (s.kind === 'mix') return refuse('mix', 'Nutze „Neu ansetzen“.');
      if (!s.beakers[i]) return refuse('target', 'Kein Glas.');
      if (s.kind === 'cont') return refuse('cont', 'In einer Gegenprobe gibt es keine frischen Einzelproben. Beginne eine neue Messreihe.');
      archiveRuns(s, [i], 'frische Probe');
      s.beakers[i] = makeBeaker(s.beakers[i].key);
      return { ok: true };
    }

    function continueWithOther() {
      if (busy()) return refuse('busy', BUSY);
      if (isMix()) return refuse('mix', 'Eine Gegenprobe gibt es nur in den Versuchen 1 und 2.');
      const s = current();
      if (s.kind === 'cont') return refuse('cont', 'Diese Reihe ist bereits eine Gegenprobe.');
      if (!used(s)) return refuse('fresh', 'Gib zuerst etwas Maßlösung zu – sonst wäre es eine frische Reihe.');
      const other = s.reagent === 'HCl' ? 'NaOH' : 'HCl';
      const a = slots(st.exp);
      if (a.cont && st.series[a.cont]) { archiveRuns(st.series[a.cont], st.series[a.cont].beakers.map((_, i) => i), 'Gegenprobe ersetzt'); delete st.series[a.cont]; }
      const n = makeSeries(st.exp, other, 'cont', s, s.beakers.map((b) => b.comp));
      st.series[n.id] = n; a.cont = n.id; st.slot = 'cont';
      return { ok: true };
    }

    /**
     * Versuch 3: Mischen und pH messen. Der Messwert entsteht erst nach der Mischzeit aus
     * dem Modell (Ladungsbilanz) – er wird weder vorab angezeigt noch an den Sollwert angepasst.
     * snapshot: Rechnung der Lernenden (wird nur im Messprotokoll mitgeführt).
     */
    function measure(snapshot) {
      if (busy()) return refuse('busy', BUSY);
      if (!isMix()) return refuse('exp', 'Gemessen wird in Versuch 3.');
      const s = current(), b = s.beakers[0];
      if (!st.system) return refuse('system', 'Wähle zuerst ein Puffersystem.');
      if (!(b.comp.V > 0)) return refuse('empty', 'Das Becherglas ist noch leer – dosiere zuerst die Stammlösungen.');
      if (b.meas && b.meas.done) return refuse('measured', 'Dieses Becherglas ist schon gemessen. Gib weiter zu oder setze mit „Neu ansetzen“ neu an.');
      b.stirUntil = st.time + MEASURE_TIME;
      b.meas = { t0: st.time, ready: st.time + MEASURE_TIME, done: false, snapshot: snapshot || null };
      return { ok: true };
    }
    function finishMeasure(s, b) {
      const S = C.SYSTEMS[s.system];
      const pH = C.pH(b.comp);
      const pair = C.pairAmounts(s.system, b.comp);
      const ratio = pair.acid > 0 && pair.base > 0 ? pair.base / pair.acid : null;
      const e = {
        id: 'm' + uid++, at: Date.now(), system: s.system, target: st.target,
        vAcid: b.vols[S.acid.stock] || 0, vBase: b.vols[S.base.stock] || 0, V: b.comp.V,
        nAcid: pair.acid, nBase: pair.base, ratio, pH,
        hh: C.hh(S.pKa, pair.base, pair.acid), calc: b.meas.snapshot
      };
      b.meas.done = true; b.meas.pH = pH; b.meas.entry = e.id;
      st.history.push(e);
      st.fx.push({ type: 'measured', entry: e });
    }

    function resetAll() {
      st.series = {}; st.active = {}; st.archive = []; st.history = [];
      st.system = null; st.target = null;
      st.op = null; st.drops = []; st.streams = []; st.fx = [];
      st.exp = 'e1'; st.slot = 'HCl';
      st.tool = 'dropper'; st.kind = 'd1';
      Object.assign(st.pipette, { tool: 'dropper', x: G.PIPETTES.dropper.rest.x, y: G.PIPETTES.dropper.rest.y, content: 0, squeeze: 0, flowing: false });
      current();
      return { ok: true };
    }

    // ---------------------------------------------------------- Ankunft im Glas
    function seriesById(id) { return st.series[id]; }
    function land(sid, i, vol, doseId, opts) {
      const s = seriesById(sid);
      if (!s) return;
      const b = s.beakers[i];
      b.comp = C.add(b.comp, opts.reagent, vol);
      b.added += vol;
      b.vols[opts.reagent] = (b.vols[opts.reagent] || 0) + vol;
      b.lastLand = st.time;
      if (s.kind === 'mix') {
        b.meas = null; // Zusammensetzung geändert: bisheriger Messwert gilt nicht mehr
      } else if (opts.complete) {
        const pH = C.pH(b.comp);
        b.pending.push({ v: b.added, pH, comp: C.copy(b.comp), P: 0 });
      }
      st.fx.push({ type: 'land', series: sid, beaker: i, vol, stream: !!opts.stream, reagent: opts.reagent, t: st.time });
    }

    // ---------------------------------------------------------- Zeitschritt
    function runOp(dt) {
      const op = st.op;
      let rest = dt;
      while (op && rest > 0) {
        if (!op.cur) {
          const seg = op.segs[op.i];
          if (!seg) { st.op = null; st.pipette.squeeze = 0; return; }
          if (seg.type === 'goto') { op.segs.splice(op.i, 1, ...path(seg.points)); continue; }
          op.cur = seg; op.t = 0;
        }
        const seg = op.cur;
        const left = seg.dur - op.t;
        const use = Math.min(rest, left);
        op.t += use; rest -= use;
        const u = seg.dur > 0 ? op.t / seg.dur : 1;
        const p = st.pipette;
        if (seg.type === 'move') {
          const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          p.x = seg.from.x + (seg.to.x - seg.from.x) * e;
          p.y = seg.from.y + (seg.to.y - seg.from.y) * e;
        } else if (seg.type === 'fill') {
          p.content = seg.amount * Math.min(1, u * 1.1);
        } else if (seg.type === 'squeeze') {
          p.squeeze = Math.sin(Math.PI * u);
        } else if (seg.type === 'stream') {
          if (!seg.started) {
            seg.started = true;
            const geo = geometry();
            const b = seriesById(op.series).beakers[seg.beaker];
            const fall = Math.max(10, G.surfaceY(geo[seg.beaker], b.comp.V) - p.y);
            st.streams.push({ series: op.series, beaker: seg.beaker, dose: seg.dose, label: seg.label, reagent: op.reagent, total: seg.vol, emitted: 0, arrived: 0, lag: Math.sqrt(2 * fall / GRAV), queue: [], x: p.x, y0: p.y, open: true });
          }
          const sm = st.streams[st.streams.length - 1];
          const target = seg.vol * Math.min(1, u);
          const dv = target - sm.emitted;
          if (dv > 0) { sm.queue.push({ dv, at: st.time - rest + sm.lag }); sm.emitted = target; p.content = Math.max(0, p.content - dv); }
          p.flowing = u < 1;
          if (u >= 1) sm.open = false;
        }
        if (op.t >= seg.dur - 1e-12) {
          if (seg.type === 'squeeze') {
            p.squeeze = 0;
            p.content = Math.max(0, p.content - seg.vol);
            st.drops.push({ series: op.series, beaker: seg.beaker, vol: seg.vol, dose: seg.dose, first: seg.first, last: seg.last, full: seg.vol, reagent: op.reagent, label: seg.label, x: p.x, y: p.y + 2, v: 0 });
          }
          if (seg.type === 'stream') p.flowing = false;
          op.cur = null; op.i++;
        }
      }
    }

    function step(dt) {
      if (!(dt > 0)) return;
      const n = Math.max(1, Math.ceil(dt / 0.02));
      const h = dt / n;
      for (let k = 0; k < n; k++) {
        st.time += h;
        runOp(h);
        // fallende Tropfen
        const geo = geometry();
        st.drops = st.drops.filter((d) => {
          const s = seriesById(d.series);
          if (!s) return false;
          d.v += GRAV * h; d.y += d.v * h;
          const surf = G.surfaceY(geo[d.beaker], s.beakers[d.beaker].comp.V);
          if (d.y >= surf) { land(d.series, d.beaker, d.vol, d.dose, { first: d.first, complete: true, full: d.full, label: d.label, reagent: d.reagent }); return false; }
          return true;
        });
        // Strahl der Messpipette
        st.streams = st.streams.filter((sm) => {
          while (sm.queue.length && sm.queue[0].at <= st.time) {
            const q = sm.queue.shift();
            const first = sm.arrived === 0;
            sm.arrived += q.dv;
            const complete = !sm.open && !sm.queue.length && sm.arrived >= sm.total - 1e-9;
            land(sm.series, sm.beaker, q.dv, sm.dose, { first, complete, full: sm.total, stream: true, label: sm.label, reagent: sm.reagent });
          }
          return sm.open || sm.queue.length > 0;
        });
        // Mischen und Protokollieren (Versuche 1, 2) bzw. Messung (Versuch 3)
        for (const id in st.series) {
          const s = st.series[id];
          for (const b of s.beakers) {
            const tau = stirring(b) ? TAU_STIR : TAU_STILL;
            for (const p of b.pending) p.P += (1 - p.P) * Math.min(1, h / tau);
            while (b.pending.length && b.pending[0].P >= SETTLED) {
              const p = b.pending.shift();
              b.records.push({ v: p.v, pH: p.pH });
              b.shown = { comp: p.comp, pH: p.pH };
              st.fx.push({ type: 'commit', series: id, key: b.key });
            }
            if (s.kind === 'mix' && b.meas && !b.meas.done && st.time >= b.meas.ready) finishMeasure(s, b);
          }
        }
      }
    }

    /** Effekte für den Renderer abholen (Auftreffen, Protokollierung, Messung). */
    function drainFx() { const f = st.fx; st.fx = []; return f; }

    // ---------------------------------------------------------- Speichern (Stand 0.2.0, Version 2)
    function serialize() {
      const plainBeaker = (b) => {
        // noch nicht protokollierte Werte sind Modellwerte: beim Speichern übernehmen
        const recs = b.records.concat(b.pending.map((p) => ({ v: p.v, pH: p.pH })));
        const o = { key: b.key, comp0: b.comp0, comp: b.comp, added: b.added, records: recs, vols: b.vols };
        if (b.meas && b.meas.done) o.meas = { pH: b.meas.pH, entry: b.meas.entry };
        return o;
      };
      const series = {};
      for (const id in st.series) {
        const s = st.series[id];
        series[id] = { id: s.id, exp: s.exp, reagent: s.reagent, kind: s.kind, system: s.system, created: s.created, from: s.from, beakers: s.beakers.map(plainBeaker) };
      }
      return { v: 2, uid, exp: st.exp, slot: st.slot, tool: st.tool, kind: st.kind, system: st.system, target: st.target, series, active: st.active, archive: st.archive, history: st.history };
    }

    function restore(o) {
      if (!o || o.v !== 2) return false;
      try {
        const series = {};
        for (const id in o.series) {
          const s = o.series[id];
          if (!expById(s.exp)) continue;
          series[id] = Object.assign({}, s, {
            beakers: s.beakers.map((b) => {
              if (!SAMPLES[b.key]) throw new Error('Probe');
              const nb = makeBeaker(b.key, b.comp0);
              nb.comp = Object.assign({}, b.comp); nb.added = b.added; nb.records = b.records.slice(); nb.vols = Object.assign({}, b.vols);
              nb.shown = nb.comp.V > 0 ? { comp: C.copy(nb.comp), pH: C.pH(nb.comp) } : { comp: C.copy(nb.comp), pH: null };
              if (b.meas && Number.isFinite(b.meas.pH)) nb.meas = { done: true, pH: b.meas.pH, entry: b.meas.entry, t0: 0, ready: 0, snapshot: null };
              return nb;
            })
          });
        }
        st.series = series;
        st.active = o.active || {};
        st.archive = Array.isArray(o.archive) ? o.archive : [];
        st.history = Array.isArray(o.history) ? o.history : [];
        st.system = C.SYSTEMS[o.system] ? o.system : null;
        st.target = Number.isFinite(o.target) ? o.target : null;
        st.exp = expById(o.exp) ? o.exp : 'e1';
        st.slot = typeof o.slot === 'string' ? o.slot : 'HCl';
        uid = Math.max(uid, Number(o.uid) || 1);
        st.op = null; st.drops = []; st.streams = []; st.fx = [];
        st.tool = o.tool === 'measure' ? 'measure' : 'dropper';
        st.kind = DOSES[o.kind] && DOSES[o.kind].tool === st.tool ? o.kind : (st.tool === 'measure' ? 'm1' : 'd1');
        const e = expById(st.exp);
        if (!e.tools.includes(st.tool)) { st.tool = e.tools[0]; st.kind = e.defaultKind; }
        if (!e.doses.includes(st.kind)) st.kind = e.doses.find((k) => DOSES[k].tool === st.tool) || e.defaultKind;
        const rest = G.PIPETTES[st.tool].rest;
        Object.assign(st.pipette, { tool: st.tool, x: rest.x, y: rest.y, content: 0, squeeze: 0, flowing: false });
        current();
        return true;
      } catch (e) {
        resetAll();
        return false;
      }
    }

    current();
    return {
      state: st, current, slots, reagentOf, activeReagent, bottleKeys: () => bottleKeys(current()), busy, geometry, setWorldWidth, meter, used,
      selectExperiment, selectSlot, setTool, setKind, selectSystem, newBatch, dose, stir, setStir, stirring, newSeries, freshSample, continueWithOther, measure, resetAll,
      step, drainFx, serialize, restore
    };
  }

  return { create, SAMPLES, EXPERIMENTS, DOSES, REAGENTS, expById, bottleKeys, TAU_STILL, TAU_STIR, MEASURE_TIME };
});
