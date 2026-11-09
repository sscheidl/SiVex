/*
 * Apfelkrieg – Modell (ohne DOM)
 *
 * Zwei Felder: links der Großvater (Opa), rechts der Enkel. Jeder Apfel auf einem Feld
 * wird in jedem Zeitschritt (TICK Sekunden) mit einer festen Wahrscheinlichkeit auf das
 * andere Feld geworfen: p_opa für Äpfel beim Großvater (→ Enkel), p_enkel für Äpfel beim
 * Enkel (→ Großvater). Das ist stochastische Kinetik erster Ordnung in beide Richtungen:
 *
 *   erwartete Würfe je Schritt:  Opa → Enkel: p_opa · N_opa      Enkel → Opa: p_enkel · N_enkel
 *   Gleichgewicht (Mittelwert):  p_opa · N_opa = p_enkel · N_enkel  →  K = N_opa / N_enkel = p_enkel / p_opa
 *
 * Standard p_opa = 0,05, p_enkel = 0,10 je 0,5 s → K = 2: Mit 18 Äpfeln im Mittel 12 : 6
 * wie in der Vorlage. Die Zahlen schwanken; das ist Teil des Modells (Teilchenebene).
 * Ein eigener Zufallsgenerator mit Startwert macht jeden Lauf wiederholbar.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.AK = root.AK || {}).model = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TICK = 0.5;            // Sekunden Modellzeit je Schritt
  const WINDOW = 10;           // Sekunden für die Rate „Würfe pro 10 s“
  const DEFAULTS = { pOpa: 0.05, pEnkel: 0.10, nOpa: 9, nEnkel: 9, seed: 20261109 };
  const LIMITS = { nMax: 60, pMin: 0.01, pMax: 0.3 };

  /** Kleiner deterministischer Zufallsgenerator (mulberry32). */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createModel(init) {
    const p = Object.assign({}, DEFAULTS, init || {});
    const s = {
      pOpa: p.pOpa, pEnkel: p.pEnkel, seed: p.seed,
      nOpa: p.nOpa, nEnkel: p.nEnkel, startOpa: p.nOpa, startEnkel: p.nEnkel,
      t: 0, step: 0,
      history: [[0, p.nOpa, p.nEnkel]],   // [t, N_opa, N_enkel]
      throws: [],                          // je Schritt: [t, nachEnkel, nachOpa] für die gleitende Rate
      eqTime: null, marks: []
    };
    let rand = rng(s.seed);
    const api = {
      state: s,
      TICK, WINDOW,
      get K() { return s.pEnkel / s.pOpa; },
      get Q() { return s.nEnkel > 0 ? s.nOpa / s.nEnkel : Infinity; },
      get total() { return s.nOpa + s.nEnkel; },
      /** Erwartete Gleichgewichtszahlen (Mittelwerte). */
      equilibrium() { const K = this.K, T = this.total; return { nOpa: T * K / (1 + K), nEnkel: T / (1 + K) }; },
      /** Ein Zeitschritt: würfelt für jeden Apfel, gibt die Würfe zurück. */
      tick() {
        let toEnkel = 0, toOpa = 0;
        for (let i = 0; i < s.nOpa; i++) if (rand() < s.pOpa) toEnkel++;
        for (let i = 0; i < s.nEnkel; i++) if (rand() < s.pEnkel) toOpa++;
        s.nOpa += toOpa - toEnkel;
        s.nEnkel += toEnkel - toOpa;
        s.step++;
        s.t = Math.round(s.step * TICK * 1000) / 1000;
        s.history.push([s.t, s.nOpa, s.nEnkel]);
        s.throws.push([s.t, toEnkel, toOpa]);
        while (s.throws.length && s.throws[0][0] < s.t - 60) s.throws.shift();
        if (s.eqTime == null && this.settled()) s.eqTime = s.t;
        return { toEnkel, toOpa };
      },
      /** Würfe pro WINDOW Sekunden in beide Richtungen (gleitender Mittelwert über das Fenster). */
      rates() {
        const from = s.t - WINDOW;
        let e = 0, o = 0, n = 0;
        for (const r of s.throws) if (r[0] > from) { e += r[1]; o += r[2]; n++; }
        const span = Math.min(WINDOW, Math.max(TICK, n * TICK));
        return { toEnkel: e * WINDOW / span, toOpa: o * WINDOW / span, window: WINDOW };
      },
      /**
       * „Eingependelt“: Nach mindestens 40 s weicht der Mittelwert von N_opa über die letzten 30 s um
       * weniger als 1,5 Äpfel (bzw. 8 % der Gesamtzahl) vom erwarteten Gleichgewicht ab.
       */
      settled() {
        if (s.t < 40) return false;
        const eq = this.equilibrium();
        let sum = 0, n = 0;
        for (let i = s.history.length - 1; i >= 0 && s.history[i][0] > s.t - 30; i--) { sum += s.history[i][1]; n++; }
        return n > 0 && Math.abs(sum / n - eq.nOpa) < Math.max(1.5, 0.08 * this.total);
      },
      /** Wurfwahrscheinlichkeiten ändern (Grenzen LIMITS). */
      setRates(pOpa, pEnkel) {
        const cl = (v) => Math.min(LIMITS.pMax, Math.max(LIMITS.pMin, Math.round(v * 100) / 100));
        const a = pOpa == null ? s.pOpa : cl(pOpa), b = pEnkel == null ? s.pEnkel : cl(pEnkel);
        const changed = a !== s.pOpa || b !== s.pEnkel;
        s.pOpa = a; s.pEnkel = b;
        if (changed) s.eqTime = null;
        return changed;
      },
      /** Neu starten; newSeed = true zieht einen neuen Startwert („nochmal würfeln“). */
      reset(nOpa, nEnkel, newSeed) {
        const cl = (v) => Math.min(LIMITS.nMax, Math.max(0, Math.round(v)));
        s.startOpa = cl(nOpa == null ? s.startOpa : nOpa); s.startEnkel = cl(nEnkel == null ? s.startEnkel : nEnkel);
        if (newSeed) s.seed = (s.seed * 1103515245 + 12345) >>> 0;
        rand = rng(s.seed);
        s.nOpa = s.startOpa; s.nEnkel = s.startEnkel;
        s.t = 0; s.step = 0; s.history = [[0, s.nOpa, s.nEnkel]]; s.throws = []; s.eqTime = null; s.marks = [];
      },
      snapshot() { return { pOpa: s.pOpa, pEnkel: s.pEnkel, seed: s.seed, nOpa: s.nOpa, nEnkel: s.nEnkel, startOpa: s.startOpa, startEnkel: s.startEnkel, t: s.t, step: s.step, history: s.history, throws: s.throws, eqTime: s.eqTime, marks: s.marks }; },
      restore(o) { if (o && typeof o.nOpa === 'number') { Object.assign(s, o); rand = rng((s.seed + s.step) >>> 0); } }
    };
    return api;
  }

  return { TICK, WINDOW, DEFAULTS, LIMITS, rng, createModel };
});
