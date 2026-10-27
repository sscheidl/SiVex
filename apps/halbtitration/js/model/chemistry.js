/*
 * Chemisches Berechnungsmodell des Halbtitrationslabors
 * -----------------------------------------------------
 * Ein durchgängiger Gleichgewichtssolver für alle vier Versuche:
 *   Essigsäure + NaOH, Ammoniak + HCl, Phosphorsäure + NaOH,
 *   Glycinhydrochlorid + NaOH.
 *
 * Jedes Protolysesystem wird als mehrstufige Säure HₙA mit der Ladung z₀
 * der vollständig protonierten Form beschrieben (Essigsäure z₀ = 0,
 * NH₄⁺ z₀ = +1, H₃PO₄ z₀ = 0, H₃N⁺–CH₂–COOH z₀ = +1). Die Anteile α_j der
 * Formen mit j abgegebenen Protonen folgen aus den Säurekonstanten:
 *     α_j ∝ (K₁·…·K_j) / c(H₃O⁺)^j
 * Gelöst wird die Ladungsbilanz der Mischung
 *     c(H₃O⁺) + c(Na⁺) + C·z̄ = c(OH⁻) + c(Cl⁻),   z̄ = Σ α_j (z₀ − j)
 * zusammen mit den Stoffbilanzen (C, Na⁺, Cl⁻ aus Probe, Wasser und
 * Maßlösung, Volumen additiv) und der Autoprotolyse c(OH⁻) = K_w / c(H₃O⁺).
 * Die linke Seite minus rechte Seite ist streng monoton steigend in
 * c(H₃O⁺); sie wird durch Bisektion in lg c(H₃O⁺) gelöst (garantiert
 * konvergent, keine stückweisen Formeln, keine Sprünge).
 *
 * Modellannahmen: 25 °C, K_w = 1,0·10⁻¹⁴ (pK_w = 14,00), ideal verdünnte
 * Lösung (Aktivitäten = Konzentrationen), NaOH und HCl vollständig
 * protolysiert, Volumina additiv, Indikator ohne Einfluss auf den pH-Wert.
 *
 * Einheiten: Volumen mL, Konzentration mol/L, Stoffmenge mmol.
 * Läuft im Browser (Namensraum „Halbtitration“) und in Node.js.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});

  const PKW = 14.0;
  const KW = Math.pow(10, -PKW);

  /*
   * Protolysesysteme. pKa: Säurekonstanten des Modells (Martell & Smith,
   * Critical Stability Constants, 25 °C, Ionenstärke 0; tabelliert in
   * D. Harvey, Analytical Chemistry 2.1, Anhang 16.11). Die gerundeten
   * Literaturwerte für die Schülerrechnung stehen in LITERATURE.
   * forms: Formeln der Formen mit 0, 1, 2 … abgegebenen Protonen.
   */
  const SYSTEMS = {
    acetic: {
      z0: 0,
      pKa: [4.757],
      forms: ['CH₃COOH', 'CH₃COO⁻'],
      formNames: ['Essigsäure', 'Acetat-Ion'],
    },
    ammonia: {
      z0: 1,
      pKa: [9.244],
      forms: ['NH₄⁺', 'NH₃'],
      formNames: ['Ammonium-Ion', 'Ammoniak'],
    },
    phosphoric: {
      z0: 0,
      pKa: [2.148, 7.199, 12.35],
      forms: ['H₃PO₄', 'H₂PO₄⁻', 'HPO₄²⁻', 'PO₄³⁻'],
      formNames: ['Phosphorsäure', 'Dihydrogenphosphat-Ion', 'Hydrogenphosphat-Ion', 'Phosphat-Ion'],
    },
    glycine: {
      z0: 1,
      pKa: [2.35, 9.778],
      forms: ['H₃N⁺–CH₂–COOH', 'H₃N⁺–CH₂–COO⁻', 'H₂N–CH₂–COO⁻'],
      formNames: ['Glycin-Kation', 'Zwitterion', 'Glycinat-Anion'],
    },
  };

  /**
   * Versuche: Probe, Verdünnung und Maßlösung.
   *  sampleCl: mol Cl⁻ je mol Probe (Glycinhydrochlorid: Gegenion Chlorid)
   *  sampleStart: Protonenstufe, in der die Probe vorliegt (0 = voll protoniert,
   *    Ammoniak liegt als NH₃ vor, also eine Stufe deprotoniert)
   *  stages: Anzahl der in der Schülerauswertung betrachteten Stufen
   */
  const EXPERIMENTS = {
    acetic: {
      id: 'acetic', system: 'acetic', no: 1,
      title: 'Essigsäure', short: 'Essigsäure + Natronlauge',
      sampleFormula: 'CH₃COOH(aq)', sampleName: 'Essigsäure',
      cSample: 0.12, vSample: 20, vWater: 30, sampleCl: 0,
      titrant: 'NaOH', cTitrant: 0.1, stages: 1, direction: 1,
      quantity: 'pKs', capacity: 50,
    },
    ammonia: {
      id: 'ammonia', system: 'ammonia', no: 2,
      title: 'Ammoniak', short: 'Ammoniaklösung + Salzsäure',
      sampleFormula: 'NH₃(aq)', sampleName: 'Ammoniaklösung',
      cSample: 0.09, vSample: 20, vWater: 30, sampleCl: 0,
      titrant: 'HCl', cTitrant: 0.1, stages: 1, direction: -1,
      quantity: 'pKb', capacity: 50,
    },
    phosphoric: {
      id: 'phosphoric', system: 'phosphoric', no: 3,
      title: 'Phosphorsäure', short: 'Phosphorsäure + Natronlauge',
      sampleFormula: 'H₃PO₄(aq)', sampleName: 'Phosphorsäure',
      cSample: 0.05, vSample: 20, vWater: 30, sampleCl: 0,
      titrant: 'NaOH', cTitrant: 0.1, stages: 2, direction: 1,
      quantity: 'pKs', capacity: 50,
    },
    glycine: {
      id: 'glycine', system: 'glycine', no: 4,
      title: 'Glycinhydrochlorid', short: 'Glycinhydrochlorid + Natronlauge',
      sampleFormula: 'H₃N⁺–CH₂–COOH Cl⁻(aq)', sampleName: 'Glycinhydrochlorid-Lösung',
      cSample: 0.06, vSample: 20, vWater: 30, sampleCl: 1,
      titrant: 'NaOH', cTitrant: 0.1, stages: 2, direction: 1,
      quantity: 'pKs', capacity: 50,
    },
  };
  const EXPERIMENT_IDS = ['acetic', 'ammonia', 'phosphoric', 'glycine'];

  const TITRANTS = {
    NaOH: { id: 'NaOH', formula: 'NaOH(aq)', name: 'Natronlauge', c: 0.1 },
    HCl: { id: 'HCl', formula: 'HCl(aq)', name: 'Salzsäure', c: 0.1 },
  };

  /** Literaturwerte (gerundet) für die Schülerrechnung nach der Freigabe */
  const LITERATURE = {
    source: 'A. E. Martell, R. M. Smith: Critical Stability Constants, Bd. 1–4, Plenum, New York 1974–1976; ' +
      'tabelliert in D. Harvey: Analytical Chemistry 2.1, Anhang 16.11 (LibreTexts)',
    conditions: '25 °C, Ionenstärke I = 0 (thermodynamische Werte)',
    acetic: { pKs: [4.76] },
    ammonia: { pKs: [9.24], pKb: 4.76 },
    phosphoric: { pKs: [2.15, 7.2, 12.35] },
    glycine: { pKs: [2.35, 9.78] },
  };

  function experiment(id) {
    const e = EXPERIMENTS[id];
    if (!e) throw new RangeError('Unbekannter Versuch: ' + id);
    return e;
  }

  function assertVolume(v) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new RangeError('Volumen der Maßlösung muss eine Zahl ≥ 0 sein (erhalten: ' + v + ')');
    }
  }

  /**
   * Anteile α_j der Protonierungsstufen bei lg c(H₃O⁺) = lh.
   * Rechnung in Logarithmen (kein Über- oder Unterlauf bei extremen pH-Werten).
   */
  function fractions(sys, lh) {
    const n = sys.pKa.length;
    const logs = new Array(n + 1);
    let acc = 0;
    logs[0] = 0;
    for (let j = 1; j <= n; j++) {
      acc -= sys.pKa[j - 1];
      logs[j] = acc - j * lh;
    }
    let max = -Infinity;
    for (let j = 0; j <= n; j++) if (logs[j] > max) max = logs[j];
    let sum = 0;
    const a = new Array(n + 1);
    for (let j = 0; j <= n; j++) {
      a[j] = Math.pow(10, logs[j] - max);
      sum += a[j];
    }
    for (let j = 0; j <= n; j++) a[j] /= sum;
    return a;
  }

  /** Mittlere Ladung je Teilchen des Systems */
  function meanCharge(sys, alpha) {
    let z = 0;
    for (let j = 0; j < alpha.length; j++) z += alpha[j] * (sys.z0 - j);
    return z;
  }

  /** Analytische Zusammensetzung nach Zugabe von v mL Maßlösung */
  function composition(exp, v) {
    assertVolume(v);
    const vTotal = exp.vSample + exp.vWater + v;
    const nSys = exp.cSample * exp.vSample;
    const nTit = exp.cTitrant * v;
    const nNa = exp.titrant === 'NaOH' ? nTit : 0;
    const nCl = exp.sampleCl * nSys + (exp.titrant === 'HCl' ? nTit : 0);
    // Ammoniak wird als NH₃ zugegeben: Ladungsbeitrag steckt vollständig in z̄
    return { vTotal: vTotal, nSys: nSys, nTit: nTit, cSys: nSys / vTotal, cNa: nNa / vTotal, cCl: nCl / vTotal };
  }

  /** Ladungsbilanz-Funktion: Kationen − Anionen (mol/L) bei lg c(H₃O⁺) = lh */
  function balance(sys, comp, lh) {
    const h = Math.pow(10, lh);
    const alpha = fractions(sys, lh);
    return h - KW / h + comp.cNa - comp.cCl + comp.cSys * meanCharge(sys, alpha);
  }

  /** lg c(H₃O⁺) durch Bisektion; Ergebnisgenauigkeit < 1·10⁻¹² in lg */
  function solveLogH(sys, comp) {
    let lo = -16;
    let hi = 1.5;
    let it = 0;
    while (hi - lo > 1e-12 && it < 200) {
      const mid = (lo + hi) / 2;
      if (balance(sys, comp, mid) > 0) hi = mid;
      else lo = mid;
      it++;
    }
    return { lh: (lo + hi) / 2, iterations: it };
  }

  /**
   * Vollständiger Gleichgewichtszustand nach Zugabe von v mL Maßlösung.
   */
  function state(expOrId, v) {
    const exp = typeof expOrId === 'string' ? experiment(expOrId) : expOrId;
    const sys = SYSTEMS[exp.system];
    const comp = composition(exp, v);
    const sol = solveLogH(sys, comp);
    const h = Math.pow(10, sol.lh);
    const alpha = fractions(sys, sol.lh);
    const species = alpha.map(function (a) { return a * comp.cSys; });
    const pH = -sol.lh;
    return {
      v: v,
      vTotal: comp.vTotal,
      pH: pH,
      pOH: PKW - pH,
      cH3O: h,
      cOH: KW / h,
      cNa: comp.cNa,
      cCl: comp.cCl,
      cSys: comp.cSys,
      alpha: alpha,
      species: species,
      iterations: sol.iterations,
      /** Umsatzgrad τ = n(Maßlösung) / n(Probe) */
      tau: comp.nTit / comp.nSys,
    };
  }

  function phAt(exp, v) { return state(exp, v).pH; }

  /** Ladungsbilanz-Residuum in mol/L (für Tests) */
  function residual(exp, st) {
    const sys = SYSTEMS[exp.system];
    let z = 0;
    st.species.forEach(function (c, j) { z += c * (sys.z0 - j); });
    return st.cH3O + st.cNa + z - st.cOH - st.cCl;
  }

  /**
   * Stöchiometrische Äquivalenzvolumina aller Stufen (mL).
   * NaOH-Titration der voll protonierten Form: V_j = j · n / c.
   * Ammoniak mit HCl: eine Stufe NH₃ → NH₄⁺.
   */
  function equivalenceVolumes(exp) {
    const sys = SYSTEMS[exp.system];
    const n = exp.cSample * exp.vSample;
    const stages = exp.titrant === 'HCl' ? 1 : sys.pKa.length;
    const out = [];
    for (let j = 1; j <= stages; j++) out.push((j * n) / exp.cTitrant);
    return out;
  }

  /** Halbäquivalenzvolumen der Stufe j (1-basiert): (V_{j−1} + V_j) / 2 mit V₀ = 0 */
  function halfVolume(exp, j) {
    const eq = equivalenceVolumes(exp);
    const prev = j > 1 ? eq[j - 2] : 0;
    return (prev + eq[j - 1]) / 2;
  }

  /**
   * Volumen der Maßlösung, bei dem der pH-Wert pHTarget erreicht wird
   * (analytische Umkehrung der Ladungsbilanz, Volumen ist darin linear):
   *   D·V_ges + n(Na⁺) − n(Cl⁻) + n(Sys)·z̄(h) = 0,  D = h − K_w/h.
   * Gibt null zurück, wenn der pH-Wert im Verlauf nie erreicht wird.
   */
  function volumeAtPH(exp, pHTarget) {
    const sys = SYSTEMS[exp.system];
    const lh = -pHTarget;
    const h = Math.pow(10, lh);
    const d = h - KW / h;
    const nSys = exp.cSample * exp.vSample;
    const z = meanCharge(sys, fractions(sys, lh));
    const v0 = exp.vSample + exp.vWater;
    const nCl0 = exp.sampleCl * nSys;
    const sign = exp.titrant === 'NaOH' ? 1 : -1;
    const denom = d + sign * exp.cTitrant;
    if (Math.abs(denom) < 1e-300) return null;
    const v = -(d * v0 - nCl0 + nSys * z) / denom;
    if (!Number.isFinite(v) || v < 0) return null;
    if (sign > 0 ? denom <= 0 : denom >= 0) return null;
    return v;
  }

  /** Modellkurve (nur für Modellreferenz nach der Freigabe und für Tests) */
  function curve(exp, vMax, samples) {
    const n = Math.max(20, Math.floor(samples || 400));
    const xs = [];
    for (let i = 0; i <= n; i++) xs.push((vMax * i) / n);
    equivalenceVolumes(exp).forEach(function (ve) {
      for (let k = -40; k <= 40; k++) {
        const v = ve + Math.sign(k) * 0.6 * Math.pow(Math.abs(k) / 40, 3);
        if (v > 0 && v < vMax) xs.push(v);
      }
    });
    xs.sort(function (a, b) { return a - b; });
    const pts = [];
    let last = -1;
    for (const v of xs) {
      if (v - last < 1e-6) continue;
      last = v;
      pts.push({ v: v, pH: phAt(exp, v) });
    }
    return pts;
  }

  /**
   * pH einer lokalen Schliere: ein frischer Tropfen Maßlösung (dropVol mL),
   * erst mit mixedVol mL der umgebenden Lösung (Zustand bei vBulk) vermischt.
   * Gleiche Ladungsbilanz wie die Gesamtlösung.
   */
  function plumePH(exp, vBulk, dropVol, mixedVol) {
    const sys = SYSTEMS[exp.system];
    const bulk = composition(exp, vBulk);
    const vt = mixedVol + dropVol;
    const tit = exp.cTitrant * dropVol;
    const comp = {
      cSys: (bulk.cSys * mixedVol) / vt,
      cNa: (bulk.cNa * mixedVol + (exp.titrant === 'NaOH' ? tit : 0)) / vt,
      cCl: (bulk.cCl * mixedVol + (exp.titrant === 'HCl' ? tit : 0)) / vt,
    };
    return -solveLogH(sys, comp).lh;
  }

  /** Vorherrschende Form nach Stöchiometrie (ohne Gleichgewichtswissen) */
  function stoichiometricForms(exp, v) {
    const sys = SYSTEMS[exp.system];
    const tau = (exp.cTitrant * v) / (exp.cSample * exp.vSample);
    if (exp.titrant === 'HCl') {
      // NH₃ (Form 1) → NH₄⁺ (Form 0)
      if (tau < 1e-9) return { main: [1], tau: tau };
      if (tau < 1 - 1e-9) return { main: [1, 0], tau: tau };
      return { main: [0], tau: tau };
    }
    const n = sys.pKa.length;
    const k = Math.floor(tau + 1e-9);
    if (k >= n) return { main: [n], tau: tau };
    const frac = tau - k;
    if (frac < 1e-9) return { main: [k], tau: tau };
    return { main: [k, k + 1], tau: tau };
  }

  const api = {
    PKW: PKW,
    KW: KW,
    SYSTEMS: SYSTEMS,
    EXPERIMENTS: EXPERIMENTS,
    EXPERIMENT_IDS: EXPERIMENT_IDS,
    TITRANTS: TITRANTS,
    LITERATURE: LITERATURE,
    experiment: experiment,
    fractions: fractions,
    meanCharge: meanCharge,
    composition: composition,
    state: state,
    phAt: phAt,
    residual: residual,
    equivalenceVolumes: equivalenceVolumes,
    halfVolume: halfVolume,
    volumeAtPH: volumeAtPH,
    curve: curve,
    plumePH: plumePH,
    stoichiometricForms: stoichiometricForms,
  };

  NS.Chemistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
