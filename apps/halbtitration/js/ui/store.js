/*
 * Zustand der Lernenden und lokale Speicherung
 * -------------------------------------------
 * Alles bleibt im Browser (localStorage). Speicherfehler (privater Modus,
 * volle Quote, gesperrter Speicher) werden abgefangen; die App bleibt
 * bedienbar und meldet den Zustand nur.
 *
 * Format v2 (ab 0.2.0). Ein Speicherstand v1 (0.1.0) wird übernommen:
 * Messreihen, Marker und Eingaben bleiben erhalten; alte Prüfergebnisse
 * gelten als ungeprüft; eine alte Ergebnisabgabe bleibt als „übernommen,
 * ohne Nachweisprüfung“ sichtbar und schaltet keine Literatur frei.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});
  const KEY = 'sivex-halbtitration-v2';
  const KEY_V1 = 'sivex-halbtitration-v1';
  const VERSION = 2;
  const IDS = ['acetic', 'ammonia', 'phosphoric', 'glycine'];
  const TITRANT = { acetic: 'NaOH', ammonia: 'HCl', phosphoric: 'NaOH', glycine: 'NaOH' };

  function emptyBurette() { return { rinsed: false, filled: false, bubble: false, reading: null }; }

  function emptyExperiment() {
    return {
      titrant: null,
      indicator: 'none',
      lab: null,
      sampleNo: 0,
      series: [],
      active: -1,
      evalSurvey: null,
      evalHalf: null,
      markers: {},
      fields: {}, // fieldId → {input, status, message, kind, sig, point}
      answers: {}, // Frage-/Trainerschritt → {choice:[], status, shown, sig}
      hints: {}, // fieldId/Frage → Stufe 0…3
      basis: { half1: 'measured', half2: 'measured' },
      submission: null, // unveränderliche Momentaufnahme der Abgabe
      legacySubmission: null, // aus 0.1.0 übernommen, ohne Nachweis
      solution: null, // {at}: Musterlösung bewusst angefordert
      reflection: { causes: [], text: '', checked: false },
      view: { band: true, model: false, lit: false, approx: false, alpha: false, xMode: 'capacity' },
      open: {},
    };
  }

  function createState() {
    const exps = {};
    IDS.forEach(function (id) { exps[id] = emptyExperiment(); });
    return {
      v: VERSION,
      current: 'acetic',
      tab: 'task',
      panelOpen: true,
      meter: { calibration: 0 },
      burettes: { NaOH: emptyBurette(), HCl: emptyBurette() },
      exps: exps,
      prefs: { autoTake: false },
      migratedFrom: null,
    };
  }

  /** Fehlende Felder ergänzen (vorwärtskompatibel) */
  function normalize(s) {
    const base = createState();
    if (!s || typeof s !== 'object' || s.v !== VERSION) return base;
    const out = Object.assign(base, s);
    IDS.forEach(function (id) {
      const e = Object.assign(emptyExperiment(), (s.exps || {})[id] || {});
      ['view', 'reflection', 'basis'].forEach(function (k) { e[k] = Object.assign(emptyExperiment()[k], e[k] || {}); });
      e.series = (Array.isArray(e.series) ? e.series : []).map(function (sr) { return Object.assign({ points: [], indicator: 'none', endpoint: null, startReading: null, finished: false }, sr); });
      out.exps[id] = e;
    });
    out.meter = Object.assign({ calibration: 0 }, s.meter || {});
    out.burettes = { NaOH: Object.assign(emptyBurette(), (s.burettes || {}).NaOH || {}), HCl: Object.assign(emptyBurette(), (s.burettes || {}).HCl || {}) };
    out.prefs = Object.assign(base.prefs, s.prefs || {});
    if (IDS.indexOf(out.current) < 0) out.current = 'acetic';
    return out;
  }

  /** Speicherstand 0.1.0 übernehmen */
  function migrateV1(old) {
    const st = createState();
    st.migratedFrom = 1;
    if (IDS.indexOf(old.current) >= 0) st.current = old.current;
    IDS.forEach(function (id) {
      const o = (old.exps || {})[id];
      if (!o) return;
      const e = st.exps[id];
      if (o.plan && o.plan.titrant) {
        e.titrant = o.plan.titrant;
        // Nur eine in 0.1.0 geprüfte, passende Wahl gilt weiter als erledigt
        if (o.plan.checked && o.plan.titrant === TITRANT[id]) e.answers.titrant = { choice: [o.plan.titrant], status: 'ok' };
      }
      if (o.plan && o.plan.indicator) e.indicator = o.plan.indicator;
      ['sampleNo', 'series', 'active', 'evalSurvey', 'evalHalf', 'basis'].forEach(function (k) { if (o[k] !== undefined) e[k] = o[k]; });
      e.series = (e.series || []).map(function (sr) { return Object.assign({ points: [], endpoint: null, startReading: null, finished: false, target: null }, sr, { refills: sr.refills || [], indicator: sr.indicator || 'none' }); });
      e.markers = Object.assign({}, o.markers || {});
      // Eingaben behalten, Prüfergebnisse verwerfen (sie gehörten zu anderer Logik)
      Object.keys(o.fields || {}).forEach(function (k) {
        if (/^read_|^cons_/.test(k)) return; // Ablesefelder entfallen
        const f = o.fields[k];
        if (f && f.input !== undefined) e.fields[k] = { input: f.input };
      });
      ['eq1', 'eq2'].forEach(function (k) {
        if (Number.isFinite(e.markers[k])) e.fields['eqm' + k.slice(-1)] = { input: String(e.markers[k]).replace('.', ',') };
      });
      if (o.submission) e.legacySubmission = { at: o.submission.at, values: o.submission.values || {} };
      if (o.lab) {
        const lab = Object.assign({}, o.lab);
        if (lab.burette && lab.burette.filled && !st.burettes[TITRANT[id]].filled) st.burettes[TITRANT[id]] = Object.assign(emptyBurette(), lab.burette);
        if (lab.calibration >= 2) st.meter.calibration = 2;
        delete lab.burette;
        delete lab.calibration;
        e.lab = lab;
      }
      if (o.reflection) e.reflection = Object.assign(e.reflection, { text: o.reflection.text || '' });
    });
    return st;
  }

  const store = {
    ok: true,
    lastError: null,
    load: function () {
      try {
        const raw = global.localStorage.getItem(KEY);
        this.ok = true;
        if (raw) return normalize(JSON.parse(raw));
        const old = global.localStorage.getItem(KEY_V1);
        if (old) {
          const parsed = JSON.parse(old);
          if (parsed && parsed.v === 1) return normalize(migrateV1(parsed));
        }
        return createState();
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
    /** Löscht den aktuellen Stand; ein alter v1-Stand bleibt unangetastet erhalten */
    clear: function () {
      try { global.localStorage.removeItem(KEY); } catch (e) { /* Speicher gesperrt */ }
    },
    KEY: KEY,
    KEY_V1: KEY_V1,
    createState: createState,
    emptyExperiment: emptyExperiment,
    normalize: normalize,
    migrateV1: migrateV1,
  };

  NS.Store = store;
  if (typeof module !== 'undefined' && module.exports) module.exports = store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
