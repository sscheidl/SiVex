/*
 * Auswertungslogik
 * ----------------
 * Vergleicht die von Schülerinnen und Schülern berechnete Konzentration
 * mit dem intern bekannten Wert und analysiert typische Fehlerquellen.
 * Unterschieden werden:
 *   - theoretischer Äquivalenzpunkt  (n(Säure) = n(Base), aus dem Modell)
 *   - experimenteller Endpunkt       (Farbumschlag / abgelesenes Volumen)
 */
(function (global) {
  'use strict';

  const NS = (global.Titrierlabor = global.Titrierlabor || {});
  if (!NS.Chemistry && typeof require === 'function') require('./chemistry.js');
  const Chem = NS.Chemistry;

  const RATINGS = [
    { max: 1, key: 'excellent', label: 'Sehr genau' },
    { max: 2.5, key: 'good', label: 'Gut' },
    { max: 5, key: 'ok', label: 'Akzeptabel' },
    { max: Infinity, key: 'poor', label: 'Deutliche Abweichung' },
  ];

  /** Toleranz für die Rechenkontrolle (Rundung der Lernenden) in Prozent */
  const CALC_TOLERANCE_PCT = 1;

  function rate(absPercent) {
    for (const r of RATINGS) if (absPercent <= r.max) return r;
    return RATINGS[RATINGS.length - 1];
  }

  function relDev(value, reference) {
    return ((value - reference) / reference) * 100;
  }

  /**
   * @param {object} p
   * @param {number} p.cTitrant   c(Maßlösung) mol/L
   * @param {number} p.vSample    V(Probelösung) mL
   * @param {number} p.vUsed      von den Lernenden verwendetes Volumen der Maßlösung in mL
   * @param {number} p.cStudent   eingegebenes Ergebnis mol/L
   * @param {number} p.cTrue      tatsächliche Konzentration mol/L
   * @param {number} p.vEquivalence theoretisches Äquivalenzvolumen mL
   */
  function evaluate(p) {
    ['cTitrant', 'vSample', 'vUsed', 'cStudent', 'cTrue', 'vEquivalence'].forEach(function (k) {
      if (typeof p[k] !== 'number' || !Number.isFinite(p[k])) {
        throw new TypeError(k + ' fehlt oder ist ungültig');
      }
    });

    const cFromVolume = Chem.sampleConcentration(p.cTitrant, p.vUsed, p.vSample);
    const deviation = relDev(p.cStudent, p.cTrue);
    const calcDeviation = cFromVolume > 0 ? relDev(p.cStudent, cFromVolume) : Infinity;
    const volumeDeviation = p.vUsed - p.vEquivalence;
    const volumeDeviationPct = relDev(p.vUsed, p.vEquivalence);

    // Rechnung gilt als korrekt, wenn sie bis auf Rundung (±1 %) zum eigenen Volumen passt
    const calculationCorrect = Math.abs(calcDeviation) <= CALC_TOLERANCE_PCT;

    const calcHints = [];
    const hints = calcHints;
    if (!calculationCorrect && cFromVolume > 0) {
      const ratio = p.cStudent / cFromVolume;
      if (Math.abs(Math.log10(Math.abs(ratio)) - 3) < 0.05 || Math.abs(Math.log10(Math.abs(ratio)) + 3) < 0.05) {
        hints.push('Dein Ergebnis weicht um den Faktor 1000 ab – wahrscheinlich ein Einheitenfehler (mL ↔ L).');
      } else {
        const swapped = (p.cTitrant * p.vSample) / p.vUsed;
        if (Math.abs(relDev(p.cStudent, swapped)) <= CALC_TOLERANCE_PCT) {
          hints.push('Es sieht so aus, als wären V(Maßlösung) und V(Probelösung) in der Formel vertauscht.');
        } else {
          hints.push('Prüfe deine Rechnung: Mit deinem Volumen von ' + fmt(p.vUsed, 2) + ' mL ergibt sich c = ' +
            fmt(cFromVolume, 4) + ' mol/L.');
        }
      }
    }
    let volumeHint = null;
    if (Math.abs(volumeDeviation) > 0.05) {
      volumeHint = volumeDeviation > 0
        ? 'Das verwendete Volumen liegt ' + fmt(volumeDeviation, 2) + ' mL über dem Äquivalenzpunkt („übertitriert“).'
        : 'Das verwendete Volumen liegt ' + fmt(-volumeDeviation, 2) + ' mL unter dem Äquivalenzpunkt (zu früh beendet).';
    }

    return {
      cStudent: p.cStudent,
      cTrue: p.cTrue,
      cFromVolume: cFromVolume,
      deviationPct: deviation,
      calcDeviationPct: calcDeviation,
      calculationCorrect: calculationCorrect,
      volumeDeviation: volumeDeviation,
      volumeDeviationPct: volumeDeviationPct,
      rating: rate(Math.abs(deviation)),
      calcHints: calcHints.slice(),
      volumeHint: volumeHint,
      hints: volumeHint ? hints.concat([volumeHint]) : hints,
    };
  }

  /**
   * Prüft das von den Lernenden angegebene Endpunkt-Volumen. Es kann nicht
   * größer sein als das tatsächlich aus der Bürette entnommene Volumen.
   * @param {number} vUsed angegebenes Volumen in mL
   * @param {number} consumed tatsächlicher Bürettenverbrauch in mL
   */
  function validateUsedVolume(vUsed, consumed) {
    if (typeof vUsed !== 'number' || !Number.isFinite(vUsed) || vUsed <= 0) {
      return { ok: false, message: 'Bitte ein Volumen größer als 0 mL eingeben.' };
    }
    // Ablesung auf 0,01 mL: Rundungstoleranz 0,005 mL
    if (vUsed > consumed + 0.005) {
      return {
        ok: false,
        message: 'Es wurden insgesamt nur ' + fmt(consumed, 2) + ' mL Maßlösung zugegeben – ein Endpunkt bei ' +
          fmt(vUsed, 2) + ' mL kann nicht gemessen worden sein.',
      };
    }
    return { ok: true, message: null };
  }

  /**
   * Eignung eines Indikators für die konkrete Titration: Abstand zwischen
   * dem Volumen, bei dem der Indikator umschlägt (Endpunkt-pH), und dem
   * theoretischen Äquivalenzvolumen (Indikatorfehler).
   * @param {object} cfg Versuchskonfiguration
   * @param {number|null} endpointPH Umschlags-pH des Indikators
   */
  function indicatorSuitability(cfg, endpointPH) {
    if (endpointPH === null || endpointPH === undefined) return null;
    const vEq = Chem.equivalenceVolume(cfg);
    const vInd = Chem.volumeAtPH(cfg, endpointPH);
    if (vInd === null) {
      return { vEndpoint: null, error: null, relErrorPct: null, key: 'unsuitable', label: 'ungeeignet (Umschlag wird nie erreicht)' };
    }
    const err = vInd - vEq;
    const rel = Math.abs(err / vEq) * 100;
    let key;
    let label;
    if (rel <= 0.3) { key = 'suitable'; label = 'geeignet'; }
    else if (rel <= 1.5) { key = 'limited'; label = 'bedingt geeignet'; }
    else { key = 'unsuitable'; label = 'ungeeignet'; }
    return { vEndpoint: vInd, error: err, relErrorPct: rel, key: key, label: label };
  }

  function fmt(x, d) {
    return NS.Config ? NS.Config.formatNumber(x, d) : x.toFixed(d).replace('.', ',');
  }

  const api = {
    evaluate: evaluate,
    validateUsedVolume: validateUsedVolume,
    indicatorSuitability: indicatorSuitability,
    RATINGS: RATINGS,
    CALC_TOLERANCE_PCT: CALC_TOLERANCE_PCT,
    rate: rate,
  };

  NS.Evaluation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
