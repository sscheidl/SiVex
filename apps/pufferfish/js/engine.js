/*
 * Pufferfish – zentraler Versuchszustand (ohne DOM, in Node testbar)
 *
 * Ein Zustand führt Mengen, Volumina, Messreihen und den Dosiervorgang.
 * Renderer, Teilchenansicht, Kurve und Journal lesen nur daraus.
 *
 * Ablauf einer Zugabe: Pipette holt Maßlösung aus der Flasche → fährt über
 * das Glas → Tropfen bzw. Strahl fällt → erst beim Auftreffen ändert sich die
 * Zusammensetzung (Modell) → Mischphase („mischt …“) → stabiler Messwert wird
 * als Kurvenpunkt protokolliert. Während eine Zugabe läuft, werden weitere
 * Dosierbefehle abgewiesen; so entsteht weder doppelte noch verlorene Dosierung.
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
  const r = (ha, a) => C.acetate(30, 0.1 * ha / (ha + a), 0.1 * a / (ha + a));
  const SAMPLES = {
    water: { name: 'Wasser', detail: '30 mL, CO₂-freies Modellwasser', make: () => C.water(30) },
    wunder: { name: 'Wunderwasser', hidden: true, revealed: 'Phosphatpuffer', detail: '30 mL vorbereitete Modelllösung', detailRevealed: '30 mL, c(H₂PO₄⁻) = c(HPO₄²⁻) = 0,050 mol/L', make: () => C.phosphate(30, 0.05, 0.05) },
    hac: { name: 'Essigsäure', detail: '30 mL, c = 0,100 mol/L', make: () => C.acetate(30, 0.1, 0) },
    naac: { name: 'Natriumacetat', detail: '30 mL, c = 0,100 mol/L', make: () => C.acetate(30, 0, 0.1) },
    mix: { name: 'Gemisch 1 : 1', detail: '30 mL, je 0,050 mol/L CH₃COOH und CH₃COO⁻', make: () => r(1, 1) },
    r10_1: { name: 'HA : A⁻ = 10 : 1', detail: '30 mL, Acetatsystem gesamt 0,100 mol/L', make: () => r(10, 1) },
    r3_1: { name: 'HA : A⁻ = 3 : 1', detail: '30 mL, Acetatsystem gesamt 0,100 mol/L', make: () => r(3, 1) },
    r1_1: { name: 'HA : A⁻ = 1 : 1', detail: '30 mL, Acetatsystem gesamt 0,100 mol/L', make: () => r(1, 1) },
    r1_3: { name: 'HA : A⁻ = 1 : 3', detail: '30 mL, Acetatsystem gesamt 0,100 mol/L', make: () => r(1, 3) },
    r1_10: { name: 'HA : A⁻ = 1 : 10', detail: '30 mL, Acetatsystem gesamt 0,100 mol/L', make: () => r(1, 10) },
    c100: { name: 'Puffer 0,10 mol/L', detail: '30 mL, 1 : 1, je 0,050 mol/L', make: () => r(1, 1) },
    c010: { name: 'Puffer 0,010 mol/L', detail: '30 mL, 1 : 1, je 0,0050 mol/L (zehnfach verdünnt hergestellt)', make: () => C.acetate(30, 0.005, 0.005) },
    fill300: { name: 'Puffer aufgefüllt', detail: '30 mL Puffer 0,10 mol/L + 270 mL Wasser', type: 'b400', make: () => { const c = C.add(r(1, 1), 'water', 270); c.V0 = 300; return c; } }
  };
  const RATIO_KEYS = ['r10_1', 'r3_1', 'r1_1', 'r1_3', 'r1_10'];

  const EXPERIMENTS = [
    { id: 'e1', n: 1, title: 'Wasser oder Wunderwasser?', short: 'Wunderwasser', beakers: ['water', 'wunder'] },
    { id: 'e2', n: 2, title: 'Warum braucht es beide Partner?', short: 'Beide Partner', beakers: ['hac', 'naac', 'mix'] },
    { id: 'e3', n: 3, title: 'Verhältnis und Reserve', short: 'Verhältnis', beakers: ['r10_1', 'r1_1', 'r1_10'], ratio: true },
    { id: 'e4', n: 4, title: 'Verdünnung', short: 'Verdünnung', beakers: ['c100', 'c010', 'fill300'] }
  ];
  const expById = (id) => EXPERIMENTS.find((e) => e.id === id);

  const DOSES = {
    d1: { tool: 'dropper', drops: 1, vol: C.DROP_ML, label: '1 Tropfen' },
    d5: { tool: 'dropper', drops: 5, vol: 5 * C.DROP_ML, label: '5 Tropfen' },
    m05: { tool: 'measure', vol: 0.5, label: '0,5 mL' },
    m1: { tool: 'measure', vol: 1.0, label: '1,0 mL' },
    m5: { tool: 'measure', vol: 5.0, label: '5,0 mL' }
  };
  const REAGENTS = {
    HCl: { formula: 'HCl', name: 'Salzsäure', label: 'HCl (c = 0,100 mol/L)', ion: 'H₃O⁺' },
    NaOH: { formula: 'NaOH', name: 'Natronlauge', label: 'NaOH (c = 0,100 mol/L)', ion: 'OH⁻' }
  };

  // Zeiten bei 1× (Sekunden) – didaktisch verlangsamt, keine gemessenen Geschwindigkeiten
  const GRAV = 2600; // Welteinheiten/s² (verlangsamter Fall)
  const MOVE_SPEED = 1500;
  const TAU_STILL = 1.6, TAU_STIR = 0.3, STIR_TIME = 2.6, SETTLED = 0.95;
  const EVENT_DUR = 4.6;
  const FLOW = 2.5; // mL/s aus der Messpipette

  function create() {
    let uid = 1;
    const st = {
      time: 0, exp: 'e1', slot: 'HCl', tool: 'dropper', showEvents: true,
      series: {}, active: {}, archive: [],
      pipette: { tool: 'dropper', x: G.PIPETTES.dropper.rest.x, y: G.PIPETTES.dropper.rest.y, content: 0, squeeze: 0, flowing: false },
      op: null, drops: [], streams: [], fx: [], log: []
    };

    // ---------------------------------------------------------- Messreihen
    function makeBeaker(key, comp) {
      const s = SAMPLES[key];
      const c = comp ? C.copy(comp) : s.make();
      const pH = C.pH(c);
      return { key, type: s.type || 'b100', comp0: C.copy(c), comp: c, added: 0, records: [{ v: 0, pH }], pending: [], shown: { comp: C.copy(c), pH }, event: null, extra: 0, stirUntil: -1, lastLand: -1 };
    }
    function makeSeries(expId, reagent, kind, from, comps) {
      const e = expById(expId);
      const keys = from ? from.beakers.map((b) => b.key) : e.beakers;
      return {
        id: 's' + uid++, exp: expId, reagent, kind, created: Date.now(),
        from: from ? { id: from.id, reagent: from.reagent, added: from.beakers.map((b) => b.added) } : null,
        beakers: keys.map((k, i) => makeBeaker(k, comps ? comps[i] : null))
      };
    }
    function slots(expId) { return (st.active[expId] = st.active[expId] || { HCl: null, NaOH: null, cont: null }); }
    function reagentOf(slot, expId) {
      if (slot !== 'cont') return slot;
      const s = st.series[slots(expId).cont];
      return s ? s.reagent : 'NaOH';
    }
    function current() {
      const a = slots(st.exp);
      if (st.slot === 'cont' && !a.cont) st.slot = 'HCl';
      let id = a[st.slot];
      if (!id || !st.series[id]) {
        const s = makeSeries(st.exp, st.slot, 'fresh');
        st.series[s.id] = s; a[st.slot] = s.id; id = s.id;
      }
      return st.series[id];
    }
    const used = (s) => s.beakers.some((b) => b.added > 0);
    function archiveRuns(s, idxs, why) {
      const runs = idxs.map((i) => s.beakers[i]).filter((b) => b.records.length > 1)
        .map((b) => ({ key: b.key, records: b.records.map((p) => ({ v: p.v, pH: p.pH })) }));
      if (!runs.length) return null;
      const a = { id: 'a' + uid++, exp: s.exp, reagent: s.reagent, kind: s.kind, from: s.from, created: s.created, archived: Date.now(), why, runs };
      st.archive.push(a);
      return a;
    }

    // ---------------------------------------------------------- Abfragen
    const busy = () => !!st.op || st.drops.length > 0 || st.streams.length > 0;
    const geometry = () => G.layout(current().beakers.map((b) => b.type));

    /** Anzeigewert des pH-Meters: stabil oder während der Mischung gleitend. */
    function meter(b) {
      if (!b.pending.length) return { pH: b.shown.pH, mixing: false };
      const last = b.pending[b.pending.length - 1];
      const p = Math.min(0.97, last.P);
      return { pH: b.shown.pH + (last.pH - b.shown.pH) * p, mixing: true };
    }

    // ---------------------------------------------------------- Befehle
    function refuse(reason, text) { return { ok: false, reason, text }; }

    function selectExperiment(id) {
      if (busy()) return refuse('busy', 'Warte, bis die laufende Zugabe beendet ist.');
      if (!expById(id)) return refuse('unknown', 'Unbekannter Versuch.');
      st.exp = id;
      if (st.slot === 'cont' && !slots(id).cont) st.slot = 'HCl';
      current();
      return { ok: true };
    }
    function selectSlot(slot) {
      if (busy()) return refuse('busy', 'Warte, bis die laufende Zugabe beendet ist.');
      if (slot === 'cont' && !slots(st.exp).cont) return refuse('none', 'Es gibt noch keine Gegenprobe.');
      st.slot = slot;
      current();
      return { ok: true };
    }
    function setTool(tool) {
      if (busy()) return refuse('busy', 'Die Pipette ist gerade in Gebrauch.');
      if (!G.PIPETTES[tool]) return refuse('unknown', 'Unbekannte Pipette.');
      st.tool = tool;
      const rest = G.PIPETTES[tool].rest;
      Object.assign(st.pipette, { tool, x: rest.x, y: rest.y, content: 0 });
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
      if (d.tool !== st.tool) return refuse('tool', `Für „${d.label}“ zuerst die ${d.tool === 'dropper' ? 'Tropfpipette' : 'Messpipette'} wählen.`);
      const s = current();
      const idx = (targets && targets.length ? targets : s.beakers.map((_, i) => i)).filter((i) => s.beakers[i]);
      if (!idx.length) return refuse('target', 'Kein Glas gewählt.');
      for (const i of idx) {
        const b = s.beakers[i];
        if (b.comp.V + d.vol > G.TYPES[b.type].maxFill + 1e-9) return refuse('full', `Glas ${String.fromCharCode(65 + i)} ist zu voll für diese Zugabe.`);
      }
      const geo = geometry();
      const P = G.PIPETTES[st.tool];
      const bottle = G.BOTTLES[s.reagent];
      const segs = [];
      const fill = (amount) => {
        segs.push({ type: 'goto', points: [{ x: bottle.x, y: G.TRAVEL[st.tool] }, { x: bottle.x, y: G.BOTTLE.dipY }] });
        segs.push({ type: 'fill', dur: 0.4, amount });
        segs.push({ type: 'goto', points: [{ x: bottle.x, y: G.TRAVEL[st.tool] }] });
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
      st.op = { id: opId, kind, series: s.id, reagent: s.reagent, targets: idx, segs, i: 0, t: 0, cur: null };
      st.log.push({ t: st.time, kind, targets: idx.slice(), series: s.id });
      return { ok: true, id: opId };
    }

    function stir(targets) {
      const s = current();
      const idx = targets && targets.length ? targets : s.beakers.map((_, i) => i);
      for (const i of idx) if (s.beakers[i]) s.beakers[i].stirUntil = st.time + STIR_TIME;
      return { ok: true };
    }

    function newSeries() {
      if (busy()) return refuse('busy', 'Warte, bis die laufende Zugabe beendet ist.');
      const s = current();
      if (!used(s)) return refuse('fresh', 'Die Ansätze sind noch unbehandelt – eine neue Messreihe ist nicht nötig.');
      archiveRuns(s, s.beakers.map((_, i) => i), 'neue Messreihe');
      const a = slots(st.exp);
      if (s.kind === 'cont') { delete st.series[s.id]; a.cont = null; st.slot = s.from ? s.from.reagent : 'HCl'; current(); return { ok: true, cont: true }; }
      const n = makeSeries(st.exp, s.reagent, 'fresh');
      st.series[n.id] = n; a[st.slot] = n.id; delete st.series[s.id];
      return { ok: true };
    }

    function freshSample(i, key) {
      if (busy()) return refuse('busy', 'Warte, bis die laufende Zugabe beendet ist.');
      const s = current();
      if (!s.beakers[i]) return refuse('target', 'Kein Glas.');
      if (s.kind === 'cont') return refuse('cont', 'In einer Gegenprobe gibt es keine frischen Einzelproben. Beginne eine neue Messreihe.');
      const k = key || s.beakers[i].key;
      if (!SAMPLES[k]) return refuse('unknown', 'Unbekannte Probe.');
      archiveRuns(s, [i], key && key !== s.beakers[i].key ? 'Ansatz geändert' : 'frische Probe');
      s.beakers[i] = makeBeaker(k);
      return { ok: true };
    }

    function continueWithOther() {
      if (busy()) return refuse('busy', 'Warte, bis die laufende Zugabe beendet ist.');
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

    function resetAll() {
      st.series = {}; st.active = {}; st.archive = [];
      st.op = null; st.drops = []; st.streams = []; st.fx = [];
      setTool(st.tool);
      current();
      return { ok: true };
    }

    // ---------------------------------------------------------- Ankunft im Glas
    function seriesById(id) { return st.series[id]; }
    function land(sid, i, vol, doseId, opts) {
      const s = seriesById(sid);
      if (!s) return;
      const b = s.beakers[i];
      if (opts.first) {
        // Zeitlupe zeigt die erste Zugabe; weitere während der Sequenz werden nur gezählt
        if (b.event && st.time <= b.event.t0 + EVENT_DUR) b.extra++;
        else if (st.showEvents) { b.event = { id: doseId, t0: st.time, dur: EVENT_DUR, an: C.doseAnalysis(b.comp, s.reagent, opts.full), reagent: s.reagent, label: opts.label }; b.extra = 0; }
      }
      b.comp = C.add(b.comp, s.reagent, vol);
      b.added += vol;
      b.lastLand = st.time;
      if (opts.complete) {
        const pH = C.pH(b.comp);
        const waitEvent = b.event && b.event.id === doseId ? b.event.t0 + EVENT_DUR : 0;
        b.pending.push({ v: b.added, pH, comp: C.copy(b.comp), P: 0, waitEvent });
      }
      st.fx.push({ type: 'land', series: sid, beaker: i, vol, stream: !!opts.stream, t: st.time });
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
            st.streams.push({ series: op.series, beaker: seg.beaker, dose: seg.dose, label: seg.label, total: seg.vol, emitted: 0, arrived: 0, lag: Math.sqrt(2 * fall / GRAV), queue: [], x: p.x, y0: p.y, open: true });
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
            st.drops.push({ series: op.series, beaker: seg.beaker, vol: seg.vol, dose: seg.dose, first: seg.first, last: seg.last, full: seg.vol, label: seg.label, x: p.x, y: p.y + 2, v: 0 });
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
          if (d.y >= surf) { land(d.series, d.beaker, d.vol, d.dose, { first: d.first, complete: true, full: d.full, label: d.label }); return false; }
          return true;
        });
        // Strahl der Messpipette
        st.streams = st.streams.filter((sm) => {
          while (sm.queue.length && sm.queue[0].at <= st.time) {
            const q = sm.queue.shift();
            const first = sm.arrived === 0;
            sm.arrived += q.dv;
            const complete = !sm.open && !sm.queue.length && sm.arrived >= sm.total - 1e-9;
            land(sm.series, sm.beaker, q.dv, sm.dose, { first, complete, full: sm.total, stream: true, label: sm.label });
          }
          return sm.open || sm.queue.length > 0;
        });
        // Mischen und Protokollieren (nur in der sichtbaren Reihe tickt die Zeit nicht anders als in anderen)
        for (const id in st.series) {
          for (const b of st.series[id].beakers) {
            const tau = b.stirUntil > st.time ? TAU_STIR : TAU_STILL;
            for (const p of b.pending) p.P += (1 - p.P) * Math.min(1, h / tau);
            while (b.pending.length && b.pending[0].P >= SETTLED && st.time >= b.pending[0].waitEvent) {
              const p = b.pending.shift();
              b.records.push({ v: p.v, pH: p.pH });
              b.shown = { comp: p.comp, pH: p.pH };
              st.fx.push({ type: 'commit', series: id, key: b.key });
            }
          }
        }
      }
    }

    /** Effekte für den Renderer abholen (Auftreffen, Protokollierung). */
    function drainFx() { const f = st.fx; st.fx = []; return f; }

    // ---------------------------------------------------------- Speichern
    function serialize() {
      const plainBeaker = (b) => {
        // noch nicht protokollierte Werte sind Modellwerte: beim Speichern übernehmen
        const recs = b.records.concat(b.pending.map((p) => ({ v: p.v, pH: p.pH })));
        return { key: b.key, comp0: b.comp0, comp: b.comp, added: b.added, records: recs };
      };
      const series = {};
      for (const id in st.series) {
        const s = st.series[id];
        series[id] = { id: s.id, exp: s.exp, reagent: s.reagent, kind: s.kind, created: s.created, from: s.from, beakers: s.beakers.map(plainBeaker) };
      }
      return { v: 1, uid, exp: st.exp, slot: st.slot, tool: st.tool, showEvents: st.showEvents, series, active: st.active, archive: st.archive };
    }

    function restore(o) {
      if (!o || o.v !== 1) return false;
      try {
        const series = {};
        for (const id in o.series) {
          const s = o.series[id];
          if (!expById(s.exp)) continue;
          series[id] = Object.assign({}, s, {
            beakers: s.beakers.map((b) => {
              if (!SAMPLES[b.key]) throw new Error('Probe');
              const nb = makeBeaker(b.key, b.comp0);
              nb.comp = Object.assign({}, b.comp); nb.added = b.added; nb.records = b.records.slice();
              nb.shown = { comp: C.copy(nb.comp), pH: C.pH(nb.comp) };
              return nb;
            })
          });
        }
        st.series = series;
        st.active = o.active || {};
        st.archive = Array.isArray(o.archive) ? o.archive : [];
        st.exp = expById(o.exp) ? o.exp : 'e1';
        st.slot = ['HCl', 'NaOH', 'cont'].includes(o.slot) ? o.slot : 'HCl';
        st.showEvents = o.showEvents !== false;
        uid = Math.max(uid, Number(o.uid) || 1);
        st.op = null; st.drops = []; st.streams = []; st.fx = [];
        setTool(o.tool === 'measure' ? 'measure' : 'dropper');
        current();
        return true;
      } catch (e) {
        resetAll();
        return false;
      }
    }

    current();
    return {
      state: st, current, slots, reagentOf, busy, geometry, meter, used,
      selectExperiment, selectSlot, setTool, dose, stir, newSeries, freshSample, continueWithOther, resetAll,
      step, drainFx, serialize, restore, EVENT_DUR
    };
  }

  return { create, SAMPLES, EXPERIMENTS, RATIO_KEYS, DOSES, REAGENTS, expById, EVENT_DUR, TAU_STILL, TAU_STIR };
});
