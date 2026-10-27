/*
 * Zustand der Lernenden und lokale Speicherung
 * -------------------------------------------
 * Alles bleibt im Browser (localStorage). Speicherfehler (privater Modus,
 * volle Quote, gesperrter Speicher) werden abgefangen; die App bleibt
 * bedienbar und meldet den Zustand nur.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});
  const KEY = 'sivex-halbtitration-v1';
  const VERSION = 1;

  function emptyExperiment() {
    return {
      plan: { titrant: null, stage: 1, eqCat: null, particle: null, indicator: null, reasons: [], checked: false, feedback: null },
      lab: null,
      sampleNo: 0,
      series: [],
      active: -1,
      evalSurvey: null,
      evalHalf: null,
      markers: {},
      fields: {}, // fieldId → {input, status, message, kind, tries}
      hints: {}, // fieldId → Stufe 0…3
      basis: { half1: 'measured', half2: 'measured' },
      submission: null, // {at, values:{taskKey: number}, pH:{taskKey:number}}
      reflection: { causes: [], text: '', checked: false },
      view: { band: true, model: false, lit: false, approx: false, xMode: 'capacity', deriv: false },
    };
  }

  function createState() {
    const exps = {};
    (NS.Chemistry ? NS.Chemistry.EXPERIMENT_IDS : ['acetic', 'ammonia', 'phosphoric', 'glycine']).forEach(function (id) { exps[id] = emptyExperiment(); });
    return {
      v: VERSION,
      current: 'acetic',
      view: 'theory',
      theory: { answers: {}, results: {}, hints: {}, shown: {} },
      exps: exps,
      prefs: { autoTake: false, panelW: null },
    };
  }

  /** Fehlende Felder nach Versionswechsel ergänzen (vorwärtskompatibel) */
  function normalize(s) {
    const base = createState();
    if (!s || s.v !== VERSION || typeof s !== 'object') return base;
    const out = Object.assign(base, s);
    Object.keys(base.exps).forEach(function (id) {
      const e = Object.assign(emptyExperiment(), (s.exps || {})[id] || {});
      e.plan = Object.assign(emptyExperiment().plan, e.plan || {});
      e.view = Object.assign(emptyExperiment().view, e.view || {});
      e.reflection = Object.assign(emptyExperiment().reflection, e.reflection || {});
      e.basis = Object.assign(emptyExperiment().basis, e.basis || {});
      out.exps[id] = e;
    });
    out.theory = Object.assign(base.theory, s.theory || {});
    out.prefs = Object.assign(base.prefs, s.prefs || {});
    if (!out.exps[out.current]) out.current = 'acetic';
    return out;
  }

  const store = {
    ok: true,
    lastError: null,
    load: function () {
      try {
        const raw = global.localStorage.getItem(KEY);
        this.ok = true;
        return normalize(raw ? JSON.parse(raw) : null);
      } catch (e) {
        this.ok = false;
        this.lastError = e;
        return createState();
      }
    },
    save: function (state) {
      try {
        global.localStorage.setItem(KEY, JSON.stringify(state));
        this.ok = true;
        return true;
      } catch (e) {
        this.ok = false;
        this.lastError = e;
        return false;
      }
    },
    clear: function () {
      try { global.localStorage.removeItem(KEY); } catch (e) { /* Speicher gesperrt */ }
    },
    KEY: KEY,
    createState: createState,
    emptyExperiment: emptyExperiment,
    normalize: normalize,
  };

  NS.Store = store;
  if (typeof module !== 'undefined' && module.exports) module.exports = store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
