/*
 * Stechheber – Modell (ohne DOM)
 *
 * Zwei Standzylinder A und B mit gleichem Querschnitt (Durchmesser D), zwei Rohre a und b
 * (Durchmesser d_a, d_b). Ein bis zum Boden eingetauchtes Rohr nimmt den Anteil f = (d/D)²
 * des Volumens seines Zylinders mit und gibt ihn in den anderen Zylinder.
 *
 * Pro Zyklus:   ΔV(A→B) = f_a · V_A        ΔV(B→A) = f_b · V_B
 * Gleichgewicht: f_a · V_A = f_b · V_B   →   K = V_B / V_A = f_a / f_b = (d_a / d_b)²
 *
 * Dieselbe Struktur wie k₁·c(Edukt) = k₋₁·c(Produkt). Die Verdrängung der Rohrwand wird
 * vernachlässigt (siehe docs/CHEMIE.md). Alle Volumina in mL, exakt bilanziert.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.SH = root.SH || {}).model = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULTS = { D: 25, dA: 10, dB: 7, VA: 80, VB: 0 };
  const LIMITS = { dMin: 4, dMax: 12, D: 25, Vmax: 100, capacity: 100, fSumMax: 0.4 };
  /** Gleichgewicht gilt als erreicht, wenn sich die Volumina drei Zyklen lang um weniger als EPS ändern. */
  const EPS = 0.05, EQ_STREAK = 3;
  const frac = (d, D) => (d / D) * (d / D);

  function createModel(init) {
    const p = Object.assign({}, DEFAULTS, init || {});
    const s = {
      D: p.D, dA: p.dA, dB: p.dB,
      VA: p.VA, VB: p.VB, startA: p.VA, startB: p.VB,
      cycle: 0, lastA2B: 0, lastB2A: 0, eqCycle: null, streak: 0,
      history: [[0, p.VA, p.VB]], marks: []
    };
    const api = {
      state: s,
      get fA() { return frac(s.dA, s.D); },
      get fB() { return frac(s.dB, s.D); },
      /** Gleichgewichtskonstante des Modells: hängt nur von den Rohren ab. */
      get K() { return this.fA / this.fB; },
      /** Momentaner Quotient V_B/V_A (∞ bei leerem A). */
      get Q() { return s.VA > 1e-9 ? s.VB / s.VA : Infinity; },
      get total() { return s.VA + s.VB; },
      /** Volumen, das die Rohre im nächsten Zyklus aufnehmen würden. */
      preview() { return { a2b: this.fA * s.VA, b2a: this.fB * s.VB }; },
      /** Ein vollständiger Zyklus: eintauchen, heben, tauschen, ablassen. */
      cycle() {
        const a2b = this.fA * s.VA, b2a = this.fB * s.VB;
        const dA = b2a - a2b;
        s.VA += dA; s.VB -= dA;
        s.lastA2B = a2b; s.lastB2A = b2a;
        s.cycle++;
        s.history.push([s.cycle, s.VA, s.VB]);
        if (s.eqCycle == null) {
          if (Math.abs(dA) < EPS) s.streak++; else s.streak = 0;
          if (s.streak >= EQ_STREAK) s.eqCycle = s.cycle - EQ_STREAK + 1;
        }
        return { a2b, b2a };
      },
      /** Rohre ändern (mm). f_a + f_b bleibt unter fSumMax, damit das Modell nicht schwingt. */
      setTubes(dA, dB) {
        const cl = (d) => Math.min(LIMITS.dMax, Math.max(LIMITS.dMin, Math.round(d * 2) / 2));
        let a = cl(dA == null ? s.dA : dA), b = cl(dB == null ? s.dB : dB);
        while (frac(a, s.D) + frac(b, s.D) > LIMITS.fSumMax) { if (dA != null && dB == null) b -= 0.5; else a -= 0.5; }
        const changed = a !== s.dA || b !== s.dB;
        s.dA = a; s.dB = b;
        if (changed && s.cycle > 0) { s.eqCycle = null; s.streak = 0; }
        return changed;
      },
      /** Neu starten mit den gegebenen Startvolumina (mL, 0…Vmax; zusammen höchstens das Fassungsvermögen). */
      reset(VA, VB) {
        const cl = (v) => Math.min(LIMITS.Vmax, Math.max(0, Math.round(v)));
        s.startA = cl(VA == null ? s.startA : VA); s.startB = cl(VB == null ? s.startB : VB);
        if (s.startA + s.startB > LIMITS.capacity) s.startB = LIMITS.capacity - s.startA;
        s.VA = s.startA; s.VB = s.startB;
        s.cycle = 0; s.lastA2B = 0; s.lastB2A = 0; s.eqCycle = null; s.streak = 0;
        s.history = [[0, s.VA, s.VB]]; s.marks = [];
      },
      /** Gleichgewichtsvolumina für die aktuellen Rohre und die aktuelle Gesamtmenge. */
      equilibrium() {
        const K = this.K, T = this.total;
        return { VA: T / (1 + K), VB: T * K / (1 + K) };
      },
      /** Zustand für den Sitzungsspeicher. */
      snapshot() { return { dA: s.dA, dB: s.dB, VA: s.VA, VB: s.VB, startA: s.startA, startB: s.startB, cycle: s.cycle, lastA2B: s.lastA2B, lastB2A: s.lastB2A, eqCycle: s.eqCycle, streak: s.streak, history: s.history, marks: s.marks }; },
      restore(o) { if (o && typeof o.VA === 'number') Object.assign(s, o); }
    };
    return api;
  }

  return { DEFAULTS, LIMITS, EPS, frac, createModel };
});
