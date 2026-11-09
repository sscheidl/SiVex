/*
 * Chemisches Berechnungsmodell: Säure-Base-Titration
 * --------------------------------------------------
 * Probelösungen: Salzsäure (stark), Natronlauge (stark),
 *                Essigsäure (schwach), Ammoniaklösung (schwach).
 * Maßlösungen:   Natronlauge (für Säuren) bzw. Salzsäure (für Basen).
 *
 * Annahmen: 25 °C, ideal verdünnte Lösung (Aktivitäten = Konzentrationen),
 * HCl und NaOH vollständig protolysiert bzw. dissoziiert, Volumina additiv,
 * der Indikator beeinflusst den pH-Wert nicht.
 *
 * Kern ist die Ladungsbilanz der Mischung:
 *   c(H3O+) + c(Na+) + c(NH4+) = c(OH-) + c(Cl-) + c(CH3COO-)
 * mit den Gleichgewichten
 *   c(CH3COO-) = c0(Essigsäure) · Ks / (Ks + c(H3O+))
 *   c(NH4+)    = c0(Ammoniak)   · c(H3O+) / (c(H3O+) + Ks(NH4+))
 *   c(OH-)     = Kw / c(H3O+)
 * Diese eine Gleichung gilt vor, am und nach dem Äquivalenzpunkt und
 * enthält die Autoprotolyse des Wassers sowie die Protolyse der
 * korrespondierenden Base bzw. Säure (z. B. Acetat am Äquivalenzpunkt).
 *
 * - Starke Säure / starke Base: geschlossene Lösung der quadratischen
 *   Gleichung h² − D·h − Kw = 0 (numerisch stabile Form).
 * - Mit schwacher Komponente: Die Bilanz ist streng monoton in c(H3O+);
 *   sie wird durch Bisektion in lg c(H3O+) gelöst (garantiert konvergent).
 *
 * Volumina in mL, Konzentrationen in mol/L, Stoffmengen in mmol
 * (mol/L · mL = mmol). Datei läuft im Browser (Namensraum "Titrierlabor")
 * und in Node.js (module.exports).
 */
(function (global) {
  'use strict';

  const NS = (global.Titrierlabor = global.Titrierlabor || {});

  /** Ionenprodukt des Wassers bei 25 °C in (mol/L)² */
  const KW = 1.0e-14;
  const PKW = -Math.log10(KW);

  /**
   * Stoffdaten. role: 'acid' | 'base'; sign: Ladungsbeitrag der vollständig
   * umgesetzten Form je Formeleinheit (+1 Kation Na⁺/NH4⁺, −1 Anion Cl⁻/CH3COO⁻).
   * pKa: pKs der Säure bzw. der korrespondierenden Säure (Schulbuchwerte).
   */
  const SPECIES = {
    acid: { key: 'acid', formula: 'HCl', name: 'Salzsäure', role: 'acid', strong: true, sign: -1, pKa: null },
    base: { key: 'base', formula: 'NaOH', name: 'Natronlauge', role: 'base', strong: true, sign: 1, pKa: null },
    weakAcid: {
      key: 'weakAcid', formula: 'CH₃COOH', name: 'Essigsäure', role: 'acid', strong: false, sign: -1, pKa: 4.75,
      conjugate: 'CH₃COO⁻', conjugateName: 'Acetat-Ion', salt: 'CH₃COONa',
    },
    weakBase: {
      key: 'weakBase', formula: 'NH₃', name: 'Ammoniaklösung', role: 'base', strong: false, sign: 1, pKa: 9.25,
      conjugate: 'NH₄⁺', conjugateName: 'Ammonium-Ion', salt: 'NH₄Cl',
    },
  };
  Object.keys(SPECIES).forEach(function (k) {
    const s = SPECIES[k];
    s.ka = s.pKa === null ? null : Math.pow(10, -s.pKa);
  });

  const SAMPLE_TYPES = ['acid', 'base', 'weakAcid', 'weakBase'];

  function assertFiniteNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(name + ' muss eine endliche Zahl sein (erhalten: ' + value + ')');
    }
  }

  function assertNonNegative(value, name) {
    assertFiniteNumber(value, name);
    if (value < 0) throw new RangeError(name + ' darf nicht negativ sein (erhalten: ' + value + ')');
  }

  function assertPositive(value, name) {
    assertFiniteNumber(value, name);
    if (value <= 0) throw new RangeError(name + ' muss größer als null sein (erhalten: ' + value + ')');
  }

  /**
   * Starke Säure/Base: löst h² − D·h − Kw = 0 numerisch stabil.
   * Für D < 0 wird die gleichwertige Form h = 2·Kw / (sqrt(D² + 4Kw) − D)
   * verwendet (keine Auslöschung). sqrt(D² + 4Kw) > |D| → keine Division durch null.
   * @param {number} excessAcid D = c(Cl⁻) − c(Na⁺) in mol/L
   */
  function hydroniumConcentration(excessAcid, kw) {
    if (kw === undefined) kw = KW;
    assertFiniteNumber(excessAcid, 'Überschusskonzentration');
    assertPositive(kw, 'Kw');
    const root = Math.sqrt(excessAcid * excessAcid + 4 * kw);
    return excessAcid >= 0 ? (excessAcid + root) / 2 : (2 * kw) / (root - excessAcid);
  }

  function phFromExcess(excessAcid, kw) {
    return -Math.log10(hydroniumConcentration(excessAcid, kw));
  }

  function excessFromPH(pH, kw) {
    if (kw === undefined) kw = KW;
    assertFiniteNumber(pH, 'pH');
    const h = Math.pow(10, -pH);
    return h - kw / h;
  }

  function counterpart(sampleType) {
    return SPECIES[sampleType].role === 'acid' ? 'base' : 'acid';
  }

  function isWeak(sampleType) {
    return !SPECIES[sampleType].strong;
  }

  /**
   * Korrektur des Ladungsbeitrags einer schwachen Probe gegenüber der
   * vollständig umgesetzten Form: z(h) = sign + w(h).
   *   Essigsäure: z = −Ks/(Ks + h)   = −1 + h/(Ks + h)
   *   Ammoniak:   z = h/(h + Ks)     = +1 − Ks/(h + Ks)
   */
  function weakCorrection(sampleType, h) {
    const sp = SPECIES[sampleType];
    if (sp.strong) return 0;
    return sp.role === 'acid' ? h / (sp.ka + h) : -sp.ka / (h + sp.ka);
  }

  /** Ladungsbeitrag je mol Probe in Abhängigkeit von c(H3O+) */
  function sampleCharge(sampleType, h) {
    return SPECIES[sampleType].sign + weakCorrection(sampleType, h);
  }

  /**
   * pH-Wert einer Lösung aus ihrer analytischen Zusammensetzung.
   * @param {string} sampleType Art der Probe
   * @param {number} cSampleTotal analytische Konzentration der Probe in der Mischung (mol/L)
   * @param {number} cTitrantTotal analytische Konzentration der Maßlösung in der Mischung (mol/L)
   * @returns {number} c(H3O+) in mol/L
   */
  function solveHydronium(sampleType, cSampleTotal, cTitrantTotal) {
    const sp = SPECIES[sampleType];
    const tSign = SPECIES[counterpart(sampleType)].sign;
    // Ladung der „starken“ Anteile: zuerst die Differenz bilden (vermeidet Auslöschung)
    const strongNet = cSampleTotal * sp.sign + cTitrantTotal * tSign; // = c(Kat.) − c(An.)
    if (sp.strong) return hydroniumConcentration(-strongNet);
    // Bilanz f(h) = h − Kw/h + strongNet + c0·w(h) = 0, streng monoton steigend in h
    const f = function (h) { return h - KW / h + strongNet + cSampleTotal * weakCorrection(sampleType, h); };
    let lo = -16;
    let hi = 1;
    for (let i = 0; i < 200 && hi - lo > 1e-14; i++) {
      const mid = (lo + hi) / 2;
      if (f(Math.pow(10, mid)) > 0) hi = mid;
      else lo = mid;
    }
    return Math.pow(10, (lo + hi) / 2);
  }

  function assertConfig(cfg) {
    if (!cfg || SAMPLE_TYPES.indexOf(cfg.sampleType) < 0) {
      throw new TypeError('sampleType muss einer von ' + SAMPLE_TYPES.join(', ') + ' sein');
    }
    assertPositive(cfg.cSample, 'c(Probelösung)');
    assertPositive(cfg.vSample, 'V(Probelösung)');
    assertPositive(cfg.cTitrant, 'c(Maßlösung)');
  }

  /**
   * Vollständiger Zustand der Mischung nach Zugabe von vTitrant mL Maßlösung.
   * @param {{sampleType:string, cSample:number, vSample:number, cTitrant:number}} cfg
   * @param {number} vTitrant zugegebenes Volumen der Maßlösung in mL (≥ 0)
   */
  function mixtureState(cfg, vTitrant) {
    assertConfig(cfg);
    assertNonNegative(vTitrant, 'V(Maßlösung)');
    const sp = SPECIES[cfg.sampleType];
    const nSample = cfg.cSample * cfg.vSample; // mmol
    const nTitrant = cfg.cTitrant * vTitrant; // mmol
    const vTotal = cfg.vSample + vTitrant; // mL
    const cS = nSample / vTotal;
    const cT = nTitrant / vTotal;

    const cH3O = solveHydronium(cfg.sampleType, cS, cT);
    const cOH = KW / cH3O;
    const pH = -Math.log10(cH3O);

    const nAcid = sp.role === 'acid' ? nSample : nTitrant;
    const nBase = sp.role === 'acid' ? nTitrant : nSample;
    const species = {};
    if (cfg.sampleType === 'weakAcid') {
      species.cA = (cS * sp.ka) / (sp.ka + cH3O); // CH3COO⁻
      species.cHA = cS - species.cA; // CH3COOH
    } else if (cfg.sampleType === 'weakBase') {
      species.cBH = (cS * cH3O) / (cH3O + sp.ka); // NH4⁺
      species.cB = cS - species.cBH; // NH3
    }

    let regime;
    const tolerance = 1e-12 * Math.max(nSample, nTitrant, 1e-30);
    if (Math.abs(nSample - nTitrant) <= tolerance) regime = 'equivalence';
    else regime = nTitrant < nSample ? 'before' : 'after';

    return {
      vTitrant: vTitrant,
      vTotal: vTotal,
      nAcid: nAcid,
      nBase: nBase,
      nSample: nSample,
      nTitrant: nTitrant,
      cSampleTotal: cS,
      cTitrantTotal: cT,
      cH3O: cH3O,
      cOH: cOH,
      cCl: (sp.role === 'base' ? nTitrant : cfg.sampleType === 'acid' ? nSample : 0) / vTotal,
      cNa: (sp.role === 'acid' ? nTitrant : cfg.sampleType === 'base' ? nSample : 0) / vTotal,
      species: species,
      pH: pH,
      pOH: PKW - pH,
      regime: regime,
      /** Neutralisationsgrad τ = n(Maßlösung) / n(Probelösung) */
      neutralization: nTitrant / nSample,
    };
  }

  /** Ladungsbilanz-Residuum (für Tests): Kationen − Anionen in mol/L */
  function chargeBalanceResidual(cfg, state) {
    const s = state.species;
    const cations = state.cH3O + state.cNa + (s.cBH || 0);
    const anions = state.cOH + state.cCl + (s.cA || 0);
    return { cations: cations, anions: anions };
  }

  function phAt(cfg, vTitrant) {
    return mixtureState(cfg, vTitrant).pH;
  }

  /** Theoretisches Äquivalenzvolumen der Maßlösung in mL (1 : 1) */
  function equivalenceVolume(cfg) {
    assertConfig(cfg);
    return (cfg.cSample * cfg.vSample) / cfg.cTitrant;
  }

  /** pH-Wert am theoretischen Äquivalenzpunkt */
  function equivalencePH(cfg) {
    return phAt(cfg, equivalenceVolume(cfg));
  }

  /**
   * Volumen der Maßlösung, bei dem der pH-Wert genau pHTarget beträgt.
   * Analytische Umkehrung der Ladungsbilanz:
   *   D·(Vs + V) + c0·Vs·z(h) + cT·V·zT = 0   mit D = h − Kw/h
   *   → V = −Vs·(D + c0·z(h)) / (D + cT·zT)
   * Gibt null zurück, wenn der pH-Wert im Verlauf nie erreicht wird.
   */
  function volumeAtPH(cfg, pHTarget) {
    assertConfig(cfg);
    const h = Math.pow(10, -pHTarget);
    const d = excessFromPH(pHTarget);
    const zS = sampleCharge(cfg.sampleType, h);
    const zT = SPECIES[counterpart(cfg.sampleType)].sign;
    const denom = d + cfg.cTitrant * zT;
    if (Math.abs(denom) < 1e-300) return null;
    const v = (-cfg.vSample * (d + cfg.cSample * zS)) / denom;
    if (!Number.isFinite(v) || v < 0) return null;
    // Nenner muss das richtige Vorzeichen haben (sonst Lösung physikalisch unmöglich)
    if (zT > 0 ? denom <= 0 : denom >= 0) return null;
    return v;
  }

  /** Halbäquivalenzpunkt (nur schwache Proben): pH ≈ pKs */
  function halfEquivalence(cfg) {
    if (!isWeak(cfg.sampleType)) return null;
    const v = equivalenceVolume(cfg) / 2;
    return { v: v, pH: phAt(cfg, v), pKa: SPECIES[cfg.sampleType].pKa };
  }

  /** c(Probe) = c(Maß) · V(Maß) / V(Probe) */
  function sampleConcentration(cTitrant, vTitrant, vSample) {
    assertPositive(cTitrant, 'c(Maßlösung)');
    assertNonNegative(vTitrant, 'V(Maßlösung)');
    assertPositive(vSample, 'V(Probelösung)');
    return (cTitrant * vTitrant) / vSample;
  }

  /**
   * Theoretische Titrationskurve (Lehrkraftmodus, Tests, Auswertung).
   * Stützstellen am Äquivalenzpunkt verdichtet.
   */
  function theoreticalCurve(cfg, vMax, samples) {
    assertConfig(cfg);
    assertPositive(vMax, 'vMax');
    const n = Math.max(10, Math.floor(samples || 400));
    const vEq = equivalenceVolume(cfg);
    const xs = [];
    for (let i = 0; i <= n; i++) xs.push((vMax * i) / n);
    if (vEq > 0 && vEq < vMax) {
      for (let k = -60; k <= 60; k++) {
        const v = vEq + Math.sign(k) * vEq * 0.02 * Math.pow(Math.abs(k) / 60, 3);
        if (v >= 0 && v <= vMax) xs.push(v);
      }
    }
    xs.sort(function (a, b) { return a - b; });
    const pts = [];
    let last = -1;
    for (const v of xs) {
      if (v - last < 1e-9) continue;
      last = v;
      pts.push({ v: v, pH: phAt(cfg, v) });
    }
    return pts;
  }

  /**
   * Sprungbereich um den Äquivalenzpunkt: Volumenintervall, in dem die
   * Steigung |dpH/dV| mindestens frac (Standard 10 %) der maximalen Steigung beträgt.
   */
  function jumpRegion(cfg, frac) {
    const vEq = equivalenceVolume(cfg);
    const f = frac || 0.1;
    const w = Math.max(vEq * 0.25, 0.05);
    const n = 4000;
    const x0 = Math.max(0, vEq - w);
    const x1 = vEq + w;
    const step = (x1 - x0) / n;
    const slopes = [];
    let prev = phAt(cfg, x0);
    let max = 0;
    for (let i = 1; i <= n; i++) {
      const v = x0 + i * step;
      const p = phAt(cfg, v);
      const s = Math.abs(p - prev) / step;
      slopes.push({ v: v - step / 2, s: s });
      if (s > max) max = s;
      prev = p;
    }
    let a = null;
    let b = null;
    for (const q of slopes) {
      if (q.s >= f * max) {
        if (a === null) a = q.v;
        b = q.v;
      }
    }
    return { v0: a, v1: b, pH0: phAt(cfg, a), pH1: phAt(cfg, b), maxSlope: max };
  }

  /** Größte Steigung ΔpH/ΔV aus Messpunkten (Wendepunkt). {v, pH, slope, interval} oder null */
  function steepestPoint(points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const pts = points
      .filter(function (p) { return Number.isFinite(p.v) && Number.isFinite(p.pH); })
      .slice()
      .sort(function (a, b) { return a.v - b.v; });
    let best = null;
    for (let i = 1; i < pts.length; i++) {
      const dv = pts[i].v - pts[i - 1].v;
      if (dv <= 1e-9) continue;
      const slope = (pts[i].pH - pts[i - 1].pH) / dv;
      if (!best || Math.abs(slope) > Math.abs(best.slope)) {
        best = {
          v: (pts[i].v + pts[i - 1].v) / 2,
          pH: (pts[i].pH + pts[i - 1].pH) / 2,
          slope: slope,
          interval: [pts[i - 1].v, pts[i].v],
        };
      }
    }
    return best;
  }

  /**
   * Äquivalenzpunkt aus Messpunkten (Wendepunkt = steilste Stelle) – aber nur,
   * wenn die Messung den pH-Sprung tatsächlich erfasst hat. Sonst wird keine
   * Bestimmung behauptet (ok: false mit Begründung).
   *
   * Kriterien:
   *  - mindestens 6 Messpunkte,
   *  - Vorzeichen der steilsten Steigung passt zur Titrationsrichtung,
   *  - vor und nach der steilsten Stelle jeweils mindestens 2 Messpunkte,
   *  - der pH-Wert ändert sich vor und nach der steilsten Stelle um je mindestens
   *    1 Einheit (Sprung vollständig durchlaufen),
   *  - das steilste Intervall ist höchstens 0,5 mL breit (ausreichend fein gemessen).
   *
   * @param {{v:number,pH:number}[]} points Messpunkte
   * @param {number} direction +1 = pH steigt (Säure vorgelegt), −1 = pH fällt (Base vorgelegt)
   */
  function equivalenceFromData(points, direction) {
    const pts = (Array.isArray(points) ? points : [])
      .filter(function (p) { return Number.isFinite(p.v) && Number.isFinite(p.pH); })
      .slice()
      .sort(function (a, b) { return a.v - b.v; });
    if (pts.length < 6) return { ok: false, reason: 'Zu wenige Messpunkte für eine Bestimmung aus der Kurve.' };
    let bi = -1;
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      const dv = pts[i].v - pts[i - 1].v;
      if (dv <= 1e-9) continue;
      const s = ((pts[i].pH - pts[i - 1].pH) / dv) * direction;
      if (s > best) { best = s; bi = i; }
    }
    if (bi < 0) return { ok: false, reason: 'Die Messkurve zeigt keinen pH-Sprung in Titrationsrichtung.' };
    const a = pts[bi - 1];
    const b = pts[bi];
    const mid = { v: (a.v + b.v) / 2, pH: (a.pH + b.pH) / 2 };
    const before = bi - 1; // Punkte vor dem Intervall
    const after = pts.length - 1 - bi; // Punkte nach dem Intervall
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (after < 2 || (last.pH - mid.pH) * direction < 1) {
      return { ok: false, reason: 'Die Messkurve reicht nicht über den pH-Sprung hinaus – der Äquivalenzbereich wurde nicht vollständig erfasst.' };
    }
    if (before < 2 || (mid.pH - first.pH) * direction < 1) {
      return { ok: false, reason: 'Vor der steilsten Stelle fehlen Messwerte – der Äquivalenzbereich wurde nicht vollständig erfasst.' };
    }
    if (b.v - a.v > 0.5) {
      return { ok: false, reason: 'Im Sprungbereich liegen die Messpunkte zu weit auseinander (> 0,5 mL).' };
    }
    return { ok: true, v: mid.v, pH: mid.pH, slope: best * direction, interval: [a.v, b.v] };
  }

  /** Erste Ableitung dpH/dV aus Messpunkten */
  function derivative(points) {
    const pts = points.slice().sort(function (a, b) { return a.v - b.v; });
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const dv = pts[i].v - pts[i - 1].v;
      if (dv <= 1e-9) continue;
      out.push({ v: (pts[i].v + pts[i - 1].v) / 2, slope: (pts[i].pH - pts[i - 1].pH) / dv });
    }
    return out;
  }

  const api = {
    KW: KW,
    PKW: PKW,
    SPECIES: SPECIES,
    SAMPLE_TYPES: SAMPLE_TYPES,
    counterpart: counterpart,
    isWeak: isWeak,
    sampleCharge: sampleCharge,
    hydroniumConcentration: hydroniumConcentration,
    solveHydronium: solveHydronium,
    phFromExcess: phFromExcess,
    excessFromPH: excessFromPH,
    mixtureState: mixtureState,
    chargeBalanceResidual: chargeBalanceResidual,
    phAt: phAt,
    equivalenceVolume: equivalenceVolume,
    equivalencePH: equivalencePH,
    volumeAtPH: volumeAtPH,
    halfEquivalence: halfEquivalence,
    sampleConcentration: sampleConcentration,
    theoreticalCurve: theoreticalCurve,
    jumpRegion: jumpRegion,
    steepestPoint: steepestPoint,
    equivalenceFromData: equivalenceFromData,
    titrationDirection: function (sampleType) { return SPECIES[sampleType].role === 'acid' ? 1 : -1; },
    derivative: derivative,
  };

  NS.Chemistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
