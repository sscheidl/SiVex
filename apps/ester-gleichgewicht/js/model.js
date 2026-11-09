/*
 * Estergleichgewicht – Modell der Stoffebene (ohne DOM)
 *
 *   Ethansäure (S) + Ethanol (A)  ⇌  Ethansäureethylester (E) + Wasser (W)        K = 4
 *
 * Geschlossenes System bei konstantem Volumen; mit n in mol:
 *   v_hin  = k₁ · n(S) · n(A)        v_rück = k₋₁ · n(E) · n(W)        k₁ / k₋₁ = K
 *   dn(S)/dt = dn(A)/dt = −(v_hin − v_rück),   dn(E)/dt = dn(W)/dt = +(v_hin − v_rück)
 * Integration mit Runge-Kutta 4. Ordnung (glatte Kurven, keine Knicke).
 *
 * Zeiteinheit: Tage ohne Katalysator (k₁ = 0,8 pro mol und Tag: Gleichgewicht nach etwa 10 Tagen
 * wie in der Vorlage), mit Katalysator (Schwefelsäure) beide Konstanten × 50 (Stunden).
 * Für 1 mol + 1 mol ergibt K = 4 im Gleichgewicht x = 2/3: n(E) = n(W) = 0,67 mol, n(S) = n(A) = 0,33 mol.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.EG = root.EG || {}).model = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const K = 4;
  const K1 = 0.8;              // pro (mol·Tag), ohne Katalysator
  const CAT = 50;              // Beschleunigung durch den Katalysator (beide Richtungen)
  const PRESETS = {
    synthese: { label: 'Estersynthese: 1 mol Säure + 1 mol Alkohol', n: [1, 1, 0, 0] },
    hydrolyse: { label: 'Esterhydrolyse: 1 mol Ester + 1 mol Wasser', n: [0, 0, 1, 1] },
    gemischt: { label: 'Gemischt: 0,5 mol von jedem Stoff', n: [0.5, 0.5, 0.5, 0.5] }
  };
  const NAMES = ['Ethansäure', 'Ethanol', 'Ethansäureethylester', 'Wasser'];
  const SHORT = ['Säure', 'Alkohol', 'Ester', 'Wasser'];
  const EPS = 2e-4;            // Gleichgewicht: |v_hin − v_rück| · 1 Tag < EPS mol

  function createModel(init) {
    const p = Object.assign({ preset: 'synthese', catalyst: false }, init || {});
    const s = {
      n: PRESETS[p.preset].n.slice(), start: PRESETS[p.preset].n.slice(), preset: p.preset,
      catalyst: p.catalyst, t: 0,
      history: [[0, ...PRESETS[p.preset].n]], eqTime: null, marks: []
    };
    /** Zeitfaktor: in Tagen gerechnet; mit Katalysator sind die Konstanten 50-mal so groß. */
    const k1 = () => K1 * (s.catalyst ? CAT : 1);
    const k2 = () => k1() / K;
    const rate = (n) => k1() * n[0] * n[1] - k2() * n[2] * n[3];   // Netto-Umsatz in mol je Tag
    const api = {
      state: s, K, K1, CAT, PRESETS, NAMES, SHORT,
      get vHin() { return k1() * s.n[0] * s.n[1]; },
      get vRueck() { return k2() * s.n[2] * s.n[3]; },
      /** Reaktionsquotient n(E)·n(W) / (n(S)·n(A)); Infinity ohne Edukte. */
      get Q() { const d = s.n[0] * s.n[1]; return d > 1e-12 ? (s.n[2] * s.n[3]) / d : Infinity; },
      /** Zeit in der zur Anzeige passenden Einheit. */
      get timeUnit() { return s.catalyst ? 'h' : 'd'; },
      get tDisplay() { return s.catalyst ? s.t * 24 : s.t; },
      /** Gleichgewichtsumsatz x für den aktuellen Start (allgemeine Lösung der quadratischen Gleichung). */
      equilibrium() {
        const [a, b, c, d] = s.start;
        // (c+x)(d+x) = K (a−x)(b−x)  →  (1−K)x² + (c+d+K(a+b))x + (cd − Kab) = 0
        const A = 1 - K, B = c + d + K * (a + b), C = c * d - K * a * b;
        const x = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
        return [a - x, b - x, c + x, d + x];
      },
      /** Zeit um dt (Tage) fortschreiben, RK4 mit Teilschritten. */
      advance(dt) {
        const h = Math.min(dt, 0.02 / (s.catalyst ? CAT : 1));
        let rest = dt;
        while (rest > 1e-12) {
          const hh = Math.min(h, rest);
          const n = s.n;
          const f = (nn) => rate(nn);
          const add = (nn, k, fac) => [nn[0] - k * fac, nn[1] - k * fac, nn[2] + k * fac, nn[3] + k * fac];
          const k1_ = f(n), k2_ = f(add(n, k1_, hh / 2)), k3_ = f(add(n, k2_, hh / 2)), k4_ = f(add(n, k3_, hh));
          const dx = (hh / 6) * (k1_ + 2 * k2_ + 2 * k3_ + k4_);
          s.n = [Math.max(0, n[0] - dx), Math.max(0, n[1] - dx), Math.max(0, n[2] + dx), Math.max(0, n[3] + dx)];
          s.t += hh; rest -= hh;
        }
        s.history.push([s.t, ...s.n]);
        if (s.eqTime == null && Math.abs(rate(s.n)) / (s.catalyst ? CAT : 1) < EPS) s.eqTime = s.t;
      },
      setCatalyst(on) { if (!!on !== s.catalyst) { s.catalyst = !!on; s.marks.push({ t: s.t, label: on ? 'Katalysator zugegeben' : 'Katalysator entfernt' }); } },
      /** Neu starten mit einer Vorgabe oder eigenen Stoffmengen (mol, 0…1). */
      reset(preset, n) {
        if (preset && PRESETS[preset]) { s.preset = preset; s.start = PRESETS[preset].n.slice(); }
        else if (n) { s.preset = 'eigen'; s.start = n.map((v) => Math.min(1, Math.max(0, Math.round(v * 100) / 100))); }
        s.n = s.start.slice(); s.t = 0; s.history = [[0, ...s.n]]; s.eqTime = null; s.marks = [];
      },
      snapshot() { return { n: s.n, start: s.start, preset: s.preset, catalyst: s.catalyst, t: s.t, history: s.history, eqTime: s.eqTime, marks: s.marks }; },
      restore(o) { if (o && Array.isArray(o.n)) Object.assign(s, o); }
    };
    return api;
  }

  return { K, K1, CAT, PRESETS, NAMES, SHORT, EPS, createModel };
});
