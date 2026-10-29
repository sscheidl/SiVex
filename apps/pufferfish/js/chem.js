/*
 * Pufferfish – chemisches Modell (ohne DOM, in Node testbar)
 *
 * Ideales Konzentrationsmodell bei 25 °C: Der pH-Wert folgt aus der
 * Ladungsbilanz mit Wasserautoprotolyse, Essigsäure/Acetat, allen drei
 * Protolysestufen der Phosphorsäure und Ammonium/Ammoniak. Natrium- und
 * Chlorid-Ionen werden als Gegenionen bilanziert (Na⁺ aus Salzen und NaOH,
 * Cl⁻ aus HCl und NH₄Cl).
 *
 *   c(H₃O⁺) + c(Na⁺) + c(NH₄⁺) = c(OH⁻) + c(Cl⁻) + c(CH₃COO⁻)
 *                      + c(H₂PO₄⁻) + 2·c(HPO₄²⁻) + 3·c(PO₄³⁻)
 *
 * Die linke Seite minus die rechte wächst streng monoton mit c(H₃O⁺); die
 * Nullstelle wird per Bisektion in lg c(H₃O⁺) gesucht. Damit gibt es weder
 * negative Konzentrationen noch Logarithmusfehler, auch weit jenseits der
 * Pufferkapazität. Aktivitäten/Ionenstärke werden nicht berücksichtigt.
 *
 * Ammoniak wird als idealisiertes, geschlossenes System behandelt (keine
 * Flüchtigkeit, keine Aktivitäten); pKₛ(NH₄⁺) = 9,25 wird direkt verwendet
 * (nicht aus pK_B(NH₃) abgeleitet).
 *
 * Einheiten: Stoffmengen in mmol, Volumen in mL (mmol/mL = mol/L).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.PF = root.PF || {}).chem = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KW = 1.0e-14;
  const PKA_AC = 4.75;
  const PKA_P = [2.15, 7.20, 12.35];
  const PKA_N = 9.25; // NH₄⁺/NH₃
  const KA_AC = Math.pow(10, -PKA_AC);
  const KA_P = PKA_P.map((p) => Math.pow(10, -p));
  const KA_N = Math.pow(10, -PKA_N);
  const C_REAGENT = 0.100; // mol/L, HCl und NaOH
  const DROP_ML = 0.050; // vereinbarte Tropfengröße der Simulation

  // ------------------------------------------------------------ Zusammensetzung
  /** Formale Zusammensetzung: V in mL, alle anderen Größen in mmol. */
  function comp(V) { return { V, Na: 0, Cl: 0, Ac: 0, P: 0, N: 0, V0: V }; }
  const copy = (c) => Object.assign({}, c);

  function water(V) { return comp(V); }
  /** Acetatsystem aus Essigsäure (cHA) und Natriumacetat (cA) in mol/L. */
  function acetate(V, cHA, cA) { const c = comp(V); c.Ac = (cHA + cA) * V; c.Na = cA * V; return c; }
  /** Phosphat aus NaH₂PO₄ (c1) und Na₂HPO₄ (c2) in mol/L. */
  function phosphate(V, c1, c2) { const c = comp(V); c.P = (c1 + c2) * V; c.Na = (c1 + 2 * c2) * V; return c; }

  /** Ammoniumsystem aus NH₄Cl (c1) und NH₃(aq) (c2) in mol/L. */
  function ammonium(V, c1, c2) { const c = comp(V); c.N = (c1 + c2) * V; c.Cl = c1 * V; return c; }

  /**
   * Zugegebene Lösungen (alle c = 0,100 mol/L) und ihre Beiträge je mL in mmol:
   * Maßlösungen HCl/NaOH sowie die Stammlösungen der drei Puffersysteme.
   */
  const STOCKS = {
    HCl: { Cl: C_REAGENT },
    NaOH: { Na: C_REAGENT },
    HAc: { Ac: C_REAGENT },
    NaAc: { Ac: C_REAGENT, Na: C_REAGENT },
    NaH2PO4: { P: C_REAGENT, Na: C_REAGENT },
    Na2HPO4: { P: C_REAGENT, Na: 2 * C_REAGENT },
    NH4Cl: { N: C_REAGENT, Cl: C_REAGENT },
    NH3: { N: C_REAGENT }
  };

  /** Zugabe einer Lösung aus STOCKS oder von Wasser. */
  function add(c0, reagent, mL) {
    if (!(mL >= 0)) throw new RangeError('Volumen muss ≥ 0 sein');
    const c = copy(c0);
    c.V += mL;
    if (reagent === 'water') return c;
    const st = STOCKS[reagent];
    if (!st) throw new RangeError('Unbekanntes Reagenz: ' + reagent);
    for (const k in st) c[k] += st[k] * mL;
    return c;
  }

  // ------------------------------------------------------------ Gleichgewicht
  /** Anteile [HA, A⁻] des Acetatsystems bei c(H₃O⁺) = h. */
  function fracAc(h) { const d = h + KA_AC; return [h / d, KA_AC / d]; }
  /** Anteile [NH₄⁺, NH₃] bei c(H₃O⁺) = h. */
  function fracN(h) { const d = h + KA_N; return [h / d, KA_N / d]; }
  /** Anteile [H₃PO₄, H₂PO₄⁻, HPO₄²⁻, PO₄³⁻] bei c(H₃O⁺) = h. */
  function fracP(h) {
    const [k1, k2, k3] = KA_P;
    const t = [h * h * h, k1 * h * h, k1 * k2 * h, k1 * k2 * k3];
    const d = t[0] + t[1] + t[2] + t[3];
    return t.map((x) => x / d);
  }

  /** Ladungsbilanz (mol/L): positiv bei zu viel H₃O⁺, negativ bei zu wenig. */
  function residual(c, h) {
    const k = 1 / c.V;
    const a = fracAc(h);
    const p = fracP(h);
    const n = fracN(h);
    return h + c.Na * k + c.N * k * n[0] - KW / h - c.Cl * k - c.Ac * k * a[1] - c.P * k * (p[1] + 2 * p[2] + 3 * p[3]);
  }

  /** pH-Wert und Speziesverteilung einer Zusammensetzung. */
  function solve(c) {
    if (!(c.V > 0)) throw new RangeError('Volumen muss > 0 sein');
    let lo = -16, hi = 2; // lg c(H₃O⁺)
    for (let i = 0; i < 200 && hi - lo > 1e-13; i++) {
      const mid = (lo + hi) / 2;
      if (residual(c, Math.pow(10, mid)) > 0) hi = mid; else lo = mid;
    }
    const x = (lo + hi) / 2;
    const h = Math.pow(10, x);
    const a = fracAc(h);
    const p = fracP(h);
    const n = fracN(h);
    return {
      pH: -x, h, oh: KW / h,
      HA: c.Ac * a[0], A: c.Ac * a[1],
      NH4: c.N * n[0], NH3: c.N * n[1],
      H3PO4: c.P * p[0], H2PO4: c.P * p[1], HPO4: c.P * p[2], PO4: c.P * p[3],
      freeH: h * c.V, freeOH: (KW / h) * c.V
    };
  }
  const pH = (c) => solve(c).pH;

  // ------------------------------------------------------------ formale Bilanz
  /**
   * Formal (stöchiometrisch) verbliebene Stoffmengen nach vollständigem Umsatz
   * der zugegebenen starken Säure/Base – die Größen, mit denen man in der
   * Schule rechnet. Nicht zu verwechseln mit den Gleichgewichtsmengen aus solve().
   */
  function formal(c) {
    const net = c.Na - c.Cl; // netto zugegebene starke Base
    const out = { excessAcid: 0, excessBase: 0 };
    if (c.N > 0) {
      // Chlorid (aus HCl und NH₄Cl) ist nur durch Na⁺ oder NH₄⁺ ausgeglichen: n(NH₄⁺) = n(Cl⁻) − n(Na⁺)
      out.NH4 = Math.min(Math.max(-net, 0), c.N);
      out.NH3 = c.N - out.NH4;
      out.excessAcid = Math.max(0, -net - c.N);
      out.excessBase = Math.max(0, net);
    } else if (c.Ac > 0) {
      out.A = Math.min(Math.max(net, 0), c.Ac);
      out.HA = c.Ac - out.A;
      out.excessAcid = Math.max(0, -net);
      out.excessBase = Math.max(0, net - c.Ac);
    } else if (c.P > 0) {
      const x = net / c.P; // abgegebene Protonen je H₃PO₄
      const s = { H3PO4: 0, H2PO4: 0, HPO4: 0, PO4: 0 };
      if (x <= 0) { s.H3PO4 = c.P; out.excessAcid = -net; }
      else if (x < 1) { s.H3PO4 = c.P * (1 - x); s.H2PO4 = c.P * x; }
      else if (x < 2) { s.H2PO4 = c.P * (2 - x); s.HPO4 = c.P * (x - 1); }
      else if (x < 3) { s.HPO4 = c.P * (3 - x); s.PO4 = c.P * (x - 2); }
      else { s.PO4 = c.P; out.excessBase = net - 3 * c.P; }
      Object.assign(out, s);
    } else {
      out.excessAcid = Math.max(0, -net);
      out.excessBase = Math.max(0, net);
    }
    return out;
  }

  /**
   * Henderson-Hasselbalch mit formalen Stoffmengen. Gibt null zurück, wenn ein
   * Partner fehlt – negative oder verschwindende Restmengen werden nicht logarithmiert.
   */
  function hh(pKa, nBase, nAcid) {
    if (!(nBase > 0) || !(nAcid > 0)) return null;
    return pKa + Math.log10(nBase / nAcid);
  }

  /** Puffersystem und relevante Stufe einer Zusammensetzung (für Markierungen). */
  function system(c) {
    if (c.N > 0) return { id: 'N', name: 'NH₄⁺/NH₃', pKa: PKA_N, acid: 'NH₄⁺', base: 'NH₃' };
    if (c.Ac > 0) return { id: 'Ac', name: 'Essigsäure/Acetat', pKa: PKA_AC, acid: 'CH₃COOH', base: 'CH₃COO⁻' };
    if (c.P > 0) return { id: 'P', name: 'H₂PO₄⁻/HPO₄²⁻', pKa: PKA_P[1], acid: 'H₂PO₄⁻', base: 'HPO₄²⁻', step: 2 };
    return null;
  }

  // ------------------------------------------------------------ Reaktionsweg einer Zugabe
  /** Phosphatstufe (0, 1, 2) passend zum pH-Bereich. */
  function phosphateStep(pHv) {
    if (pHv < (PKA_P[0] + PKA_P[1]) / 2) return 0;
    if (pHv < (PKA_P[1] + PKA_P[2]) / 2) return 1;
    return 2;
  }

  /**
   * Wohin gehen die Protonen einer Zugabe? Vergleicht das Gleichgewicht vor
   * und nach der Zugabe (Protonenbilanz):
   *   Säure:  n = Δ(gebundene H⁺ im schwachen System) − Δn(OH⁻) + Δn(H₃O⁺)
   *   Base:   n = −Δ(gebundene H⁺) − Δn(H₃O⁺) + Δn(OH⁻)
   * Ergebnis: Anteile und der überwiegende Weg. Das Teilchenmodell (Versuche 1/2) zeigt danach,
   * ob die Zugabe mit dem Puffer zu H₂O reagiert oder frei bleibt.
   */
  function doseAnalysis(before, reagent, mL) {
    const n = C_REAGENT * mL;
    const after = add(before, reagent, mL);
    const s0 = solve(before), s1 = solve(after);
    const bound = (s) => s.HA + s.NH4 + 3 * s.H3PO4 + 2 * s.H2PO4 + s.HPO4;
    const dBound = bound(s1) - bound(s0);
    const dH = s1.freeH - s0.freeH, dOH = s1.freeOH - s0.freeOH;
    const acid = reagent === 'HCl';
    const shares = acid
      ? { weak: dBound / n, partner: -dOH / n, free: dH / n }
      : { weak: -dBound / n, partner: -dH / n, free: dOH / n };
    for (const k in shares) shares[k] = Math.min(1, Math.max(0, shares[k]));
    let path = 'free';
    if (shares.weak >= shares.free && shares.weak >= shares.partner) path = 'weak';
    else if (shares.partner > shares.free) path = 'partner';
    let pair = null;
    if (path === 'weak') {
      if (before.N > 0) pair = { sys: 'N', k: 0 };
      else if (before.Ac > 0) pair = { sys: 'Ac', k: 0 };
      else pair = { sys: 'P', k: phosphateStep((s0.pH + s1.pH) / 2) };
    }
    return { reagent, n, path, pair, shares, pH0: s0.pH, pH1: s1.pH };
  }


  // ------------------------------------------------------------ Puffersysteme für Versuch 3
  /**
   * Die drei Puffersysteme des Herstellungsversuchs. Beide Stammlösungen eines
   * Systems haben c = 0,100 mol/L; hergestellt werden 30,0 mL (Modellannahme).
   * Der Bereich pKₛ ± 1 ist eine Faustregel, keine harte Grenze.
   */
  const SYSTEMS = {
    ac: {
      id: 'ac', name: 'Acetat', pair: 'CH₃COOH / CH₃COO⁻', pKa: PKA_AC,
      acid: { formula: 'CH₃COOH', symbol: 'HA', stock: 'HAc', name: 'Essigsäure-Lösung', stockFormula: 'CH₃COOH' },
      base: { formula: 'CH₃COO⁻', symbol: 'A⁻', stock: 'NaAc', name: 'Natriumacetat-Lösung', stockFormula: 'CH₃COONa' }
    },
    ph: {
      id: 'ph', name: 'Phosphat', pair: 'H₂PO₄⁻ / HPO₄²⁻', pKa: PKA_P[1],
      acid: { formula: 'H₂PO₄⁻', symbol: 'HA', stock: 'NaH2PO4', name: 'Natriumdihydrogenphosphat-Lösung', stockFormula: 'NaH₂PO₄' },
      base: { formula: 'HPO₄²⁻', symbol: 'A⁻', stock: 'Na2HPO4', name: 'Dinatriumhydrogenphosphat-Lösung', stockFormula: 'Na₂HPO₄' }
    },
    am: {
      id: 'am', name: 'Ammonium/Ammoniak', pair: 'NH₄⁺ / NH₃', pKa: PKA_N,
      acid: { formula: 'NH₄⁺', symbol: 'HA', stock: 'NH4Cl', name: 'Ammoniumchlorid-Lösung', stockFormula: 'NH₄Cl' },
      base: { formula: 'NH₃', symbol: 'A⁻', stock: 'NH3', name: 'Ammoniak-Lösung (NH₃(aq))', stockFormula: 'NH₃' }
    }
  };
  const SYSTEM_IDS = ['ac', 'ph', 'am'];
  const MIX_V = 30.0; // mL Gesamtvolumen der hergestellten Pufferlösung
  const MIX_C = 0.100; // mol/L beider Stammlösungen

  /** Bereitstellung: Säure- und Basenanteil (formale Stoffmengen) einer Mischung des Systems sys. */
  function pairAmounts(sys, c) {
    const f = formal(c);
    if (sys === 'ac') return { acid: f.HA || 0, base: f.A || 0 };
    if (sys === 'ph') return { acid: f.H2PO4 || 0, base: f.HPO4 || 0 };
    return { acid: f.NH4 || 0, base: f.NH3 || 0 };
  }

  /** Gleichgewichtsmengen des Paars aus dem Solver (zur Kontrolle gegen die formale Bilanz). */
  function pairEquilibrium(sys, c) {
    const s = solve(c);
    if (sys === 'ac') return { acid: s.HA, base: s.A };
    if (sys === 'ph') return { acid: s.H2PO4, base: s.HPO4 };
    return { acid: s.NH4, base: s.NH3 };
  }

  /**
   * Ist das System für den Ziel-pH geeignet? Faustregel |pH − pKₛ| ≤ 1.
   * code: 'ok' | 'edge' (Randlage, ≥ 0,85) | 'range' | 'invalid'
   */
  function assessTarget(sys, pH) {
    const S = SYSTEMS[sys];
    if (!S || !Number.isFinite(pH)) return { ok: false, code: 'invalid' };
    const d = pH - S.pKa;
    const fits = SYSTEM_IDS.filter((id) => Math.abs(pH - SYSTEMS[id].pKa) <= 1 + 1e-9);
    if (Math.abs(d) > 1 + 1e-9) return { ok: false, code: 'range', d, suggest: fits };
    return { ok: true, code: Math.abs(d) >= 0.85 ? 'edge' : 'ok', d, suggest: fits };
  }

  /** Alle Systeme, deren Bereich pKₛ ± 1 den Ziel-pH enthält (kann leer sein). */
  function suitableSystems(pH) { return Number.isFinite(pH) ? SYSTEM_IDS.filter((id) => Math.abs(pH - SYSTEMS[id].pKa) <= 1 + 1e-9) : []; }

  /**
   * Lösungsweg über Stoffmengen: n = c · V, n(A⁻)/n(HA) = 10^(pH − pKₛ),
   * V(Säure) + V(Base) = Gesamtvolumen. Bei verschiedenen Stammlösungskonzentrationen
   * folgt V(Base)/V(Säure) = r · c(Säure)/c(Base).
   */
  function planMix(sys, pH, o) {
    const S = SYSTEMS[sys], opt = o || {};
    const Vt = opt.V == null ? MIX_V : opt.V, cA = opt.cAcid == null ? MIX_C : opt.cAcid, cB = opt.cBase == null ? MIX_C : opt.cBase;
    const ratio = Math.pow(10, pH - S.pKa);
    const VAcid = Vt / (1 + ratio * cA / cB), VBase = Vt - VAcid;
    return { system: sys, pH, pKa: S.pKa, ratio, Vtot: Vt, VAcid, VBase, nAcid: cA * VAcid, nBase: cB * VBase, cAcid: cA, cBase: cB };
  }

  /** Zusammensetzung nach Zugabe von vA mL Säure- und vB mL Basen-Stammlösung des Systems (ohne Vorlage). */
  function mixComp(sys, vA, vB) {
    const S = SYSTEMS[sys];
    let c = comp(0);
    c = add(c, S.acid.stock, vA);
    c = add(c, S.base.stock, vB);
    return c;
  }

  // ------------------------------------------------------------ Universalindikator (schematisch)
  /**
   * Schematisches Farbmodell eines Universalindikators: lineare Interpolation
   * zwischen typischen Farbstufen. Keine Kalibrierung eines bestimmten Produkts.
   */
  const UI_STOPS = [
    [0, [205, 30, 50]], [2, [222, 44, 46]], [3, [236, 86, 40]], [4, [244, 142, 32]],
    [5, [240, 190, 34]], [6, [214, 212, 46]], [7, [104, 178, 66]], [8, [32, 150, 128]],
    [9, [36, 108, 192]], [10, [66, 70, 172]], [11, [104, 58, 160]], [14, [112, 36, 132]]
  ];
  function indicatorRGB(pHv) {
    const v = Math.min(14, Math.max(0, pHv));
    for (let i = 1; i < UI_STOPS.length; i++) {
      const [p1, c1] = UI_STOPS[i];
      if (v <= p1) {
        const [p0, c0] = UI_STOPS[i - 1];
        const t = (v - p0) / (p1 - p0);
        return c0.map((x, j) => Math.round(x + (c1[j] - x) * t));
      }
    }
    return UI_STOPS[UI_STOPS.length - 1][1].slice();
  }

  return {
    KW, PKA_AC, PKA_P, PKA_N, KA_AC, KA_P, KA_N, C_REAGENT, DROP_ML, STOCKS,
    SYSTEMS, SYSTEM_IDS, MIX_V, MIX_C,
    comp, copy, water, acetate, phosphate, ammonium, add,
    fracAc, fracP, fracN, pairAmounts, pairEquilibrium, assessTarget, suitableSystems, planMix, mixComp, residual, solve, pH, formal, hh, system, phosphateStep, doseAnalysis,
    UI_STOPS, indicatorRGB
  };
});
