/*
 * Fällungslabor – Fachmodell (ohne DOM, in Node testbar)
 *
 * Vorratslösungen, Konstanten und das gekoppelte Löslichkeits-/Komplexgleichgewicht
 *   AgX(s) ⇌ Ag⁺(aq) + X⁻(aq)                Kₗ = [Ag⁺][X⁻]
 *   Ag⁺ + NH₃ ⇌ [Ag(NH₃)]⁺                   β₁
 *   Ag⁺ + 2 NH₃ ⇌ [Ag(NH₃)₂]⁺                β₂
 * für genau ein Halogenid je Ansatz (Chlorid, Bromid oder Iodid).
 *
 * Bilanzen sind durch die Konstruktion erfüllt: Ein Ansatz führt nur Gesamtstoffmengen
 * (Ag, X, NH₃, Na⁺, NO₃⁻) und die Feststoffmenge; alles Gelöste ergibt sich als Differenz.
 * Konstanten: 25 °C, Ionenstärke null (Martell/Smith, Critical Stability Constants,
 * nach Harvey, Analytical Chemistry 2.1, Anhang 16.10/16.12), siehe docs/CHEMIE.md und docs/QUELLEN.md.
 *
 * Die Wasserproben (Leitungs-, Mineralwasser) folgen bewusst NICHT diesem Modell, sondern einem
 * dokumentierten phänomenologischen Mischfällungsmodell (fällbare Ag⁺-Äquivalente, siehe WATER).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.FL = root.FL || {}).chem = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ Konstanten (25 °C, I = 0)
  const KSP = { Cl: Math.pow(10, -9.74), Br: Math.pow(10, -12.30), I: Math.pow(10, -16.08) };
  const LOG_K1 = 3.31, LOG_K2 = 3.91;
  const BETA1 = Math.pow(10, LOG_K1);
  const BETA2 = Math.pow(10, LOG_K1 + LOG_K2);

  /** Modell-Tropfen: Simulationsparameter, keine Naturkonstante. */
  const DROP_ML = 0.050;
  /** Fassungsvermögen eines großen Reagenzglases im Modell (mL). */
  const CAPACITY_ML = 20.0;

  /** Molare Massen (g/mol) für die Umrechnung Massenanteil ↔ Stoffmengenkonzentration. */
  const M_NH3 = 17.031;
  /** Konzentrierte Ammoniaklösung: w = 25 %, ρ(20 °C) ≈ 0,907 g/mL → c = w·ρ/M. */
  const NH3_CONC_W = 0.25, NH3_CONC_RHO = 907; // g/L
  const NH3_CONC = Math.round((NH3_CONC_W * NH3_CONC_RHO / M_NH3) * 10) / 10; // 13,3 mol/L
  const NH3_DIL = 2.0;

  /**
   * Vorratslösungen. kind: sample (Probe, Messpipette), reagent (Tropfpipette), water.
   * ions: Stoffmengenkonzentrationen in mol/L der enthaltenen Teilchen.
   */
  const SOLUTIONS = {
    agno3: { kind: 'reagent', name: 'Silbernitratlösung', formula: 'AgNO₃(aq)', c: 0.100, label: 'c = 0,100 mol/L', ions: { Ag: 0.1, NO3: 0.1 } },
    nacl: { kind: 'sample', name: 'Natriumchloridlösung', short: 'NaCl', formula: 'NaCl(aq)', c: 0.100, label: 'c = 0,100 mol/L', ions: { Na: 0.1, X: 0.1 }, halide: 'Cl' },
    nabr: { kind: 'sample', name: 'Natriumbromidlösung', short: 'NaBr', formula: 'NaBr(aq)', c: 0.100, label: 'c = 0,100 mol/L', ions: { Na: 0.1, X: 0.1 }, halide: 'Br' },
    nai: { kind: 'sample', name: 'Natriumiodidlösung', short: 'NaI', formula: 'NaI(aq)', c: 0.100, label: 'c = 0,100 mol/L', ions: { Na: 0.1, X: 0.1 }, halide: 'I' },
    nh3dil: { kind: 'reagent', name: 'Ammoniaklösung, verdünnt', short: 'NH₃ verd.', formula: 'NH₃(aq)', c: NH3_DIL, label: 'c = 2,0 mol/L (w ≈ 3,4 %)', ions: { N: NH3_DIL } },
    nh3conc: { kind: 'reagent', name: 'Ammoniaklösung, konzentriert', short: 'NH₃ konz.', formula: 'NH₃(aq)', c: NH3_CONC, label: 'c ≈ 13,3 mol/L (w = 25 %)', ions: { N: NH3_CONC } },
    water: { kind: 'water', name: 'Destilliertes Wasser', short: 'dest. Wasser', formula: 'H₂O', c: null, label: 'Modell: ohne gelöste Ionen', ions: {} },
    tap: { kind: 'sample', name: 'Leitungswasser', short: 'Leitungswasser', formula: 'Modellprobe', c: null, label: 'Modellprobe', ions: {}, water: 'tap' },
    mineral: { kind: 'sample', name: 'Mineralwasser', short: 'Mineralwasser', formula: 'Modellprobe', c: null, label: 'Modellprobe', ions: {}, water: 'mineral' }
  };

  /**
   * Alltagswasser – phänomenologisches Mischfällungsmodell (keine Wasseranalytik).
   * F: Summe der mit Ag⁺ schwer lösliche Verbindungen bildenden Anteile als Ag⁺-Äquivalent (mol/L).
   * Davon Chlorid als typischer, dokumentierter Anteil; der Rest steht summarisch für weitere
   * Anionen (z. B. carbonatbedingte Fällung). Gefällt wird stöchiometrisch min(Ag, F).
   * Repräsentative Werte, nicht für jedes reale Wasser gültig (docs/CHEMIE.md).
   */
  const WATER = {
    tap: { F: 0.0009, chloride: 0.0006, pigment: [236, 234, 226] },
    mineral: { F: 0.0016, chloride: 0.0010, pigment: [234, 231, 220] }
  };

  /** Farben der Feststoffe (Pigment, sRGB) – Darstellungsparameter, Herleitung in docs/CHEMIE.md. */
  const PIGMENT = { Cl: [246, 246, 241], Br: [236, 226, 188], I: [238, 225, 146] };
  const SOLID = {
    Cl: { formula: 'AgCl', name: 'Silberchlorid', color: 'weiß' },
    Br: { formula: 'AgBr', name: 'Silberbromid', color: 'cremefarben bis schwach gelb' },
    I: { formula: 'AgI', name: 'Silberiodid', color: 'blassgelb' }
  };
  const HALIDE = { Cl: { ion: 'Cl⁻', name: 'Chloridion' }, Br: { ion: 'Br⁻', name: 'Bromidion' }, I: { ion: 'I⁻', name: 'Iodidion' } };

  // ------------------------------------------------------------------ Gleichgewicht
  const finite = (v) => typeof v === 'number' && isFinite(v);

  /**
   * Freies NH₃ (mol/L) bei gegebener freier Ag⁺-Konzentration a aus der NH₃-Bilanz
   * N/V = L + a(β₁L + 2β₂L²) → 2β₂aL² + (1 + β₁a)L − N/V = 0 (numerisch stabile Lösung).
   */
  function freeNH3(a, Nc) {
    if (!(Nc > 0)) return 0;
    const qa = 2 * BETA2 * a, qb = 1 + BETA1 * a;
    return (2 * Nc) / (qb + Math.sqrt(qb * qb + 4 * qa * Nc));
  }
  /** Gesamtkonzentration gelösten Silbers (mol/L) bei freiem Ag⁺ a. */
  function agDissolvedConc(a, Nc) {
    const L = freeNH3(a, Nc);
    return a * (1 + BETA1 * L + BETA2 * L * L);
  }

  /** Bisektion auf log10(a) für eine in a monoton fallende Funktion h. */
  function solveLog(h, lo, hi) {
    let a = lo, b = hi;
    for (let i = 0; i < 200; i++) {
      const m = (a + b) / 2;
      if (h(Math.pow(10, m)) > 0) a = m; else b = m;
      if (b - a < 1e-13) break;
    }
    return Math.pow(10, (a + b) / 2);
  }

  /**
   * Gleichgewichtszustand eines Halogenid-Ansatzes.
   * t: { V (mL), Ag, X, N (mol), halide: 'Cl'|'Br'|'I' }
   * Ergebnis: { solid, ag, agNH3, agNH3_2, x, nh3, dissolvedAg, dissolvedX } – Stoffmengen in mol,
   *           Konzentrationen (ag, x, nh3 …) in mol/L.
   */
  function equilibrium(t) {
    const Vl = (t.V || 0) / 1000;
    const A = Math.max(0, t.Ag || 0), X = Math.max(0, t.X || 0), N = Math.max(0, t.N || 0);
    const out = { solid: 0, ag: 0, agNH3: 0, agNH3_2: 0, x: 0, nh3: 0, dissolvedAg: A, dissolvedX: X };
    if (!(Vl > 0)) return out;
    const Nc = N / Vl;
    const ksp = t.halide ? KSP[t.halide] : null;
    let a;
    let solid = 0;
    if (ksp && A > 0 && X > 0) {
      // Mit Feststoff: Ag-Bilanz p = A − V·Ag_gelöst(a), X-Bilanz p = X − V·Kₗ/a
      const h = (av) => (A - Vl * agDissolvedConc(av, Nc)) - (X - Vl * ksp / av);
      a = solveLog(h, -40, 2);
      solid = A - Vl * agDissolvedConc(a, Nc);
      if (!(solid > 0)) solid = 0;
    }
    if (solid > 0) {
      solid = Math.min(solid, A, X);
      out.solid = solid;
      out.x = ksp / a;
    } else {
      // Ohne Feststoff: gesamtes Silber gelöst
      out.solid = 0;
      a = A > 0 ? solveLog((av) => A / Vl - agDissolvedConc(av, Nc), -40, 2) : 0;
      out.x = X / Vl;
    }
    const L = freeNH3(a, Nc);
    out.ag = a; out.nh3 = L;
    out.agNH3 = a * BETA1 * L; out.agNH3_2 = a * BETA2 * L * L;
    out.dissolvedAg = A - out.solid; out.dissolvedX = X - out.solid;
    return out;
  }

  /** Gleichgewichtsmenge Feststoff (mol) eines Ansatzes – Halogenid- oder Wassermodell. */
  function solidAtEquilibrium(t) {
    if (t.water) return Math.max(0, Math.min(t.Ag || 0, t.F || 0));
    if (!t.halide) return 0;
    return equilibrium(t).solid;
  }

  /** Lesbare Zahlen im deutschen Format. */
  function fmt(v, d) {
    if (v == null || !finite(v)) return '–';
    return v.toFixed(d == null ? 2 : d).replace('.', ',');
  }

  return {
    KSP, LOG_K1, LOG_K2, BETA1, BETA2, DROP_ML, CAPACITY_ML, M_NH3, NH3_CONC, NH3_CONC_W, NH3_CONC_RHO, NH3_DIL,
    SOLUTIONS, WATER, PIGMENT, SOLID, HALIDE,
    freeNH3, agDissolvedConc, equilibrium, solidAtEquilibrium, fmt, finite
  };
});
