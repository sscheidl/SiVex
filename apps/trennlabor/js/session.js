/*
 * Trennlabor – Sitzung (ohne DOM)
 *
 * Verwaltet die drei Labore, die Aufgaben, die laufenden Modelle, Zeitraffer,
 * Hilfe (genau drei Stufen: keine, kleine, konkrete), Hilfeangebote nach
 * wiederholten Fehlern, Auswertung (Beobachtungen, Lückentexte) und den
 * Abschluss einer Aufgabe. Die Auswertung bezieht sich auf den Versuchsstand
 * zum Zeitpunkt des ersten Erfolgs („Schnappschuss“): Späteres Herumprobieren
 * macht einen gelungenen Versuch nicht rückwirkend falsch.
 */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const deps = node
    ? { util: require('./util.js'), answers: require('./answers.js'), tasks: { classic: require('./tasks/classic-tasks.js'), chroma: require('./tasks/chroma-tasks.js'), distill: require('./tasks/distill-tasks.js') } }
    : { util: root.TL.util, answers: root.TL.answers, tasks: root.TL.tasks };
  const api = factory(deps);
  if (node) module.exports = api;
  else (root.TL = root.TL || {}).session = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  const { util, answers, tasks } = deps;

  const LABS = [
    { id: 'classic', letter: 'A', name: 'Klassische Trennverfahren', short: 'Klassische Verfahren', lapse: 6, desc: 'Sedimentieren, Dekantieren, Filtrieren, Lösen, Eindampfen, Magnettrennung, Scheidetrichter, Extraktion' },
    { id: 'chroma', letter: 'B', name: 'Chromatographie', short: 'Chromatographie', lapse: 20, desc: 'Papierchromatographie von Filzstiftfarben mit zwei Laufmitteln' },
    { id: 'distill', letter: 'C', name: 'Destillation', short: 'Destillation', lapse: 12, desc: 'Ethanol-Wasser-Gemisch: Aufbau, Temperaturmessung, Brennprobe' }
  ];
  const LAB_BY_ID = Object.fromEntries(LABS.map((l) => [l.id, l]));
  const SPEEDS = [1, 4, 10];
  const ALL_TASKS = [...tasks.classic.TASKS, ...tasks.chroma.TASKS, ...tasks.distill.TASKS];
  const TASK_BY_ID = Object.fromEntries(ALL_TASKS.map((t) => [t.id, t]));
  const HELP_LEVELS = ['Keine Hilfe', 'Kleine Hilfe', 'Konkrete Hilfe'];
  const OFFER_AFTER = 2;

  function newMeta() {
    return {
      help: 0, offer: false, mistakes: 0, mistakesAtOffer: 0, wrong: 0, wrongAtOffer: 0,
      drafts: { obs: {}, gaps: {} }, results: { obs: {}, gaps: {} },
      successAt: null, snapshot: null, completedAt: null, theoryStep: 0, submissions: 0
    };
  }

  function createSession(options) {
    const opts = Object.assign({}, options);
    const ev = util.emitter();
    const st = {
      lab: null,
      current: { classic: 'K-01', chroma: 'C-1', distill: 'D-1' },
      expert: false, speed: 1, paused: false,
      meta: {}
    };
    for (const t of ALL_TASKS) st.meta[t.id] = newMeta();
    const engines = {};
    const shadows = {};
    let checkClock = 0;

    const keyOf = (task) => (task.lab === 'classic' ? task.id : task.lab);
    const task = (id) => TASK_BY_ID[id || currentTaskId()];
    const currentTaskId = () => (st.lab ? st.current[st.lab] : null);
    const meta = (id) => st.meta[id || currentTaskId()];

    function bindEngine(key, eng) {
      eng.on('message', (m) => { if (activeKey() === key) ev.emit('message', m); });
      eng.on('mistake', (m) => {
        const t = TASK_BY_ID[st.lab && keyOf(task()) === key ? currentTaskId() : key];
        if (!t) return;
        const mt = st.meta[t.id];
        mt.mistakes++;
        maybeOffer(t.id);
        ev.emit('mistake', Object.assign({ task: t.id }, m));
      });
      eng.on('safety', (s) => ev.emit('safety', s));
      eng.on('change', () => { checkClock = 0; ev.emit('engine', { key }); });
    }
    function engineFor(id) {
      const t = task(id);
      const key = keyOf(t);
      if (!engines[key]) { engines[key] = t.createEngine(); bindEngine(key, engines[key]); }
      return engines[key];
    }
    const activeKey = () => (st.lab ? keyOf(task()) : null);
    const engine = () => (st.lab ? engineFor(currentTaskId()) : null);

    function maybeOffer(id) {
      const m = st.meta[id];
      if (m.help >= 2 || m.offer) return;
      if (m.mistakes - m.mistakesAtOffer >= OFFER_AFTER || m.wrong - m.wrongAtOffer >= OFFER_AFTER) {
        m.offer = true;
        ev.emit('offer', { task: id, level: m.help + 1 });
      }
    }

    // ---------------------------------------------------------- Navigation
    function openLab(lab) {
      if (lab && !LAB_BY_ID[lab]) return { ok: false };
      st.lab = lab || null;
      if (st.lab) engine();
      ev.emit('change', { reason: 'lab' });
      return { ok: true };
    }
    function selectTask(id) {
      const t = TASK_BY_ID[id];
      if (!t) return { ok: false };
      if (t.expert && !st.expert) return { ok: false, message: 'Diese Aufgabe gibt es nur im Expertenmodus.' };
      st.lab = t.lab;
      st.current[t.lab] = id;
      engineFor(id);
      ev.emit('change', { reason: 'task' });
      return { ok: true };
    }
    function tasksOf(lab) { return ALL_TASKS.filter((t) => t.lab === lab && (!t.expert || st.expert)); }
    function setExpert(on) {
      st.expert = !!on;
      if (!st.expert && task(st.current.chroma).expert) st.current.chroma = 'C-1';
      if (engines.chroma) engines.chroma.setExpert(st.expert);
      ev.emit('change', { reason: 'expert' });
      return { ok: true };
    }

    // ---------------------------------------------------------- Zeit
    function setSpeed(s) { if (SPEEDS.includes(s)) st.speed = s; st.paused = false; ev.emit('change', { reason: 'speed' }); return { ok: true }; }
    function setPaused(p) { st.paused = !!p; ev.emit('change', { reason: 'speed' }); return { ok: true }; }
    const lapse = () => (st.lab ? LAB_BY_ID[st.lab].lapse : 1);
    const effective = () => lapse() * st.speed;

    /** Echtzeit dt (s) → Simulation; Zeitraffer ändert nur die Geschwindigkeit, nicht die Schritte. */
    function update(realDt) {
      const e = engine();
      if (!e) return 0;
      if (st.paused || (e.state.safety)) return 0;
      const simDt = Math.min(realDt, 0.1) * effective();
      const n = e.update(simDt);
      checkClock -= realDt;
      if (checkClock <= 0) { checkClock = 0.25; checkProgress(); }
      return n;
    }

    /** Erfolg prüfen; beim ersten Erfolg Schnappschuss für die Auswertung anlegen. */
    function checkProgress(id) {
      const tid = id || currentTaskId();
      if (!tid) return null;
      const t = task(tid), m = st.meta[tid];
      const e = engineFor(tid);
      const res = t.check(e);
      if (res.success && !m.completedAt) {
        const was = m.lastSuccess;
        if (!was) {
          m.snapshot = e.exportState();
          m.successAt = e.state.t;
          delete shadows[tid];
          if (!m.everSucceeded) { m.everSucceeded = true; ev.emit('success', { task: tid }); }
        }
      }
      m.lastSuccess = res.success;
      return res;
    }

    // ---------------------------------------------------------- Hilfe
    function setHelp(level, id) {
      const m = meta(id);
      m.help = util.clamp(level | 0, 0, 2);
      if (m.offer) { m.offer = false; m.mistakesAtOffer = m.mistakes; m.wrongAtOffer = m.wrong; }
      ev.emit('change', { reason: 'help' });
      return { ok: true };
    }
    function dismissOffer(id) {
      const m = meta(id);
      m.offer = false; m.mistakesAtOffer = m.mistakes; m.wrongAtOffer = m.wrong;
      ev.emit('change', { reason: 'help' });
    }
    function help(id) {
      const tid = id || currentTaskId();
      const t = task(tid), m = st.meta[tid];
      const h = t.help(engineFor(tid)) || { small: '', concrete: '' };
      let text = m.help === 1 ? h.small : m.help === 2 ? h.concrete : '';
      // In der Auswertung: konkrete Hinweise zu falschen Lücken
      const wrongGaps = Object.entries(m.results.gaps).filter(([, r]) => r.status === 'wrong');
      if (m.help === 2 && m.snapshot && !m.completedAt && wrongGaps.length) {
        text += ' ' + wrongGaps.map(([k, r]) => r.hint).filter(Boolean).slice(0, 2).join(' ');
      }
      return { level: m.help, levelName: HELP_LEVELS[m.help], text: text.trim(), offer: m.offer, offerLevel: Math.min(2, m.help + 1), wordBank: m.help === 2 ? (t.gaps.bank || []) : null };
    }

    // ---------------------------------------------------------- Auswertung
    function view(id) {
      const tid = id || currentTaskId();
      const m = st.meta[tid];
      if (!m.snapshot) return null;
      if (!shadows[tid]) { const e = task(tid).createEngine(); e.importState(m.snapshot); shadows[tid] = e; }
      return shadows[tid];
    }

    function judgeObs(o, value) {
      if (o.correct == null) return { status: 'unavailable', hint: o.unavailable || '' };
      if (value == null || value === '') return { status: 'empty' };
      if (o.type === 'number') {
        const v = answers.parseNumber(value);
        if (v == null) return { status: 'wrong', hint: 'Bitte eine Zahl eingeben.' };
        return Math.abs(v - o.correct) <= (o.tol || 0) + 1e-9 ? { status: 'correct' } : { status: 'wrong', hint: o.type === 'number' && o.unit === '°C' ? 'Lies den Wert noch einmal im Temperaturverlauf ab.' : 'Prüfe deine Messung noch einmal.' };
      }
      return value === o.correct ? { status: 'correct' } : { status: 'wrong', hint: 'Vergleiche mit dem, was du in deinem Versuch tatsächlich gesehen hast.' };
    }

    function evaluation(id) {
      const tid = id || currentTaskId();
      const t = task(tid), m = st.meta[tid];
      const live = t.check(engineFor(tid));
      const v = view(tid);
      const obs = v ? t.observations(v) : [];
      return {
        task: tid, unlocked: !!v, check: live, frozenCheck: v ? t.check(v) : null, successAt: m.successAt,
        observations: obs.map((o) => Object.assign({}, o, { correct: undefined, available: o.correct != null, result: m.results.obs[o.id] || null, draft: m.drafts.obs[o.id] })),
        gaps: { text: t.gaps.text, keys: Object.keys(t.gaps.gaps), results: m.results.gaps, drafts: m.drafts.gaps, bank: m.help === 2 ? t.gaps.bank : null },
        completed: !!m.completedAt
      };
    }

    function saveDraft(kind, key, value, id) {
      const m = meta(id);
      m.drafts[kind][key] = value;
      if (m.results[kind][key] && m.results[kind][key].status !== 'correct') delete m.results[kind][key];
    }

    function submit(input, id) {
      const tid = id || currentTaskId();
      const t = task(tid), m = st.meta[tid];
      const v = view(tid);
      if (!v) return { ok: false, message: 'Führe den Versuch zuerst erfolgreich durch.' };
      if (m.completedAt) return { ok: true, completed: true };
      const obsIn = (input && input.obs) || m.drafts.obs;
      const gapsIn = (input && input.gaps) || m.drafts.gaps;
      Object.assign(m.drafts.obs, obsIn); Object.assign(m.drafts.gaps, gapsIn);
      const obs = t.observations(v);
      let ok = true, avail = 0;
      for (const o of obs) {
        const r = judgeObs(o, m.drafts.obs[o.id]);
        m.results.obs[o.id] = r;
        if (r.status === 'unavailable') continue;
        avail++;
        if (r.status !== 'correct') ok = false;
      }
      for (const k of Object.keys(t.gaps.gaps)) {
        const r = answers.checkGap(t.gaps.gaps[k], m.drafts.gaps[k]);
        m.results.gaps[k] = r;
        if (r.status !== 'correct' && r.status !== 'typo') ok = false;
      }
      if (!avail) ok = false;
      m.submissions++;
      if (ok) {
        m.completedAt = Date.now();
        m.completedSim = m.successAt;
        m.theoryStep = 0;
        ev.emit('complete', { task: tid });
      } else {
        m.wrong++;
        maybeOffer(tid);
      }
      ev.emit('change', { reason: 'submit' });
      return { ok, completed: ok, results: m.results };
    }

    function theory(id) {
      const tid = id || currentTaskId();
      const t = task(tid), m = st.meta[tid];
      if (!m.completedAt) return { unlocked: false };
      const v = view(tid) || engineFor(tid);
      return { unlocked: true, steps: t.theory, step: m.theoryStep, notebook: m.theoryStep >= t.theory.length ? t.notebook(v) : null };
    }
    function nextTheory(id) {
      const tid = id || currentTaskId();
      const m = st.meta[tid];
      if (!m.completedAt) return { ok: false };
      m.theoryStep = Math.min(task(tid).theory.length, m.theoryStep + 1);
      ev.emit('change', { reason: 'theory' });
      return { ok: true };
    }
    function showAllTheory(id) {
      const tid = id || currentTaskId();
      const m = st.meta[tid];
      if (!m.completedAt) return { ok: false };
      m.theoryStep = task(tid).theory.length;
      ev.emit('change', { reason: 'theory' });
      return { ok: true };
    }

    // ---------------------------------------------------------- Neustart
    /** Nur den aktuellen Versuch (Apparatur) zurücksetzen; Abschlüsse bleiben erhalten. */
    function resetExperiment(id) {
      const tid = id || currentTaskId();
      const t = task(tid);
      const key = keyOf(t);
      const keepExpert = key === 'chroma' ? st.expert : null;
      engines[key] = t.createEngine();
      bindEngine(key, engines[key]);
      if (keepExpert != null) engines[key].setExpert(keepExpert);
      for (const x of ALL_TASKS) if (keyOf(x) === key) st.meta[x.id].lastSuccess = false;
      ev.emit('change', { reason: 'reset' });
      return { ok: true };
    }
    function resetAll() {
      for (const k of Object.keys(engines)) delete engines[k];
      for (const k of Object.keys(shadows)) delete shadows[k];
      for (const t of ALL_TASKS) st.meta[t.id] = newMeta();
      st.lab = null; st.expert = false; st.speed = 1; st.paused = false;
      ev.emit('change', { reason: 'resetAll' });
      return { ok: true };
    }

    // ---------------------------------------------------------- Sitzungsspeicher
    function exportSession() {
      const eng = {};
      for (const [k, e] of Object.entries(engines)) eng[k] = e.exportState();
      return { v: 1, st: util.clone(st), engines: eng };
    }
    function importSession(data) {
      if (!data || data.v !== 1) return false;
      Object.assign(st, data.st);
      for (const t of ALL_TASKS) if (!st.meta[t.id]) st.meta[t.id] = newMeta();
      for (const [k, s] of Object.entries(data.engines || {})) {
        const t = ALL_TASKS.find((x) => keyOf(x) === k);
        if (!t) continue;
        const e = t.createEngine();
        e.importState(s);
        engines[k] = e; bindEngine(k, e);
      }
      ev.emit('change', { reason: 'import' });
      return true;
    }

    function progress() {
      return LABS.map((l) => ({ lab: l.id, tasks: tasksOf(l.id).map((t) => ({ id: t.id, short: t.short, done: !!st.meta[t.id].completedAt, success: !!st.meta[t.id].snapshot })) }));
    }

    return {
      state: st, on: ev.on, LABS, SPEEDS, HELP_LEVELS,
      openLab, selectTask, tasksOf, task, meta, engine, engineFor, currentTaskId, setExpert,
      setSpeed, setPaused, update, effective, lapse, checkProgress,
      setHelp, dismissOffer, help, evaluation, saveDraft, submit, theory, nextTheory, showAllTheory,
      resetExperiment, resetAll, exportSession, importSession, progress, view
    };
  }

  return { createSession, LABS, LAB_BY_ID, SPEEDS, ALL_TASKS, TASK_BY_ID, HELP_LEVELS };
});
