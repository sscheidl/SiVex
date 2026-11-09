/*
 * Indikatormodell
 * ---------------
 * Ein Säure-Base-Indikator HIn ⇌ In⁻ + H⁺ liegt abhängig vom pH-Wert
 * anteilig in seiner sauren (HIn) und basischen Form (In⁻) vor
 * (Henderson-Hasselbalch):
 *     x(In⁻) = 1 / (1 + 10^(pKs(HIn) - pH))
 *
 * Die sichtbare Farbe wird subtraktiv (Lambert-Beer, je RGB-Kanal) aus den
 * Absorbanzen beider Formen gemischt. Dadurch entsteht z. B. bei
 * Bromthymolblau am Neutralpunkt ganz natürlich Grün (Gelb + Blau).
 * Die Indikatorstoffmenge ist konstant, die Konzentration sinkt beim
 * Titrieren durch Verdünnung (Faktor V0 / Vgesamt).
 */
(function (global) {
  'use strict';

  const NS = (global.Titrierlabor = global.Titrierlabor || {});

  /** Absorbanz je Kanal aus einer Ziel-Durchlichtfarbe (0–255) */
  function absorbanceFromColor(rgb) {
    return rgb.map(function (c) {
      const t = Math.min(1, Math.max(1e-3, c / 255));
      return -Math.log10(t);
    });
  }

  const INDICATORS = {
    phenolphthalein: {
      id: 'phenolphthalein',
      name: 'Phenolphthalein',
      pKa: 9.4,
      range: [8.2, 10.0],
      endpointPH: 8.4, // erste bleibende, schwache Rosafärbung
      acidLabel: 'farblos',
      baseLabel: 'pink-violett',
      acidColor: [255, 255, 255],
      baseColor: [214, 28, 132],
    },
    bromothymolBlue: {
      id: 'bromothymolBlue',
      name: 'Bromthymolblau',
      pKa: 7.1,
      range: [6.0, 7.6],
      endpointPH: 7.0, // Mischfarbe Grün
      acidLabel: 'gelb',
      baseLabel: 'blau',
      acidColor: [244, 206, 32],
      baseColor: [26, 74, 206],
    },
    methylOrange: {
      id: 'methylOrange',
      name: 'Methylorange',
      pKa: 3.46,
      range: [3.1, 4.4],
      endpointPH: 4.0, // Mischfarbe Orange
      acidLabel: 'rot',
      baseLabel: 'gelb-orange',
      acidColor: [222, 38, 46],
      baseColor: [246, 180, 36],
    },
    none: {
      id: 'none',
      name: 'ohne Indikator',
      pKa: null,
      range: null,
      endpointPH: null,
      acidLabel: 'farblos',
      baseLabel: 'farblos',
      acidColor: [255, 255, 255],
      baseColor: [255, 255, 255],
    },
  };

  Object.keys(INDICATORS).forEach(function (key) {
    const ind = INDICATORS[key];
    ind.acidAbsorbance = absorbanceFromColor(ind.acidColor);
    ind.baseAbsorbance = absorbanceFromColor(ind.baseColor);
  });

  function get(id) {
    const ind = INDICATORS[id];
    if (!ind) throw new RangeError('Unbekannter Indikator: ' + id);
    return ind;
  }

  /** Anteil der basischen Form In⁻ (0 … 1) */
  function baseFraction(id, pH) {
    const ind = get(id);
    if (ind.pKa === null) return 0;
    if (!Number.isFinite(pH)) throw new TypeError('pH muss endlich sein');
    return 1 / (1 + Math.pow(10, ind.pKa - pH));
  }

  /**
   * Durchlichtfarbe der Lösung.
   * @param {string} id Indikator
   * @param {number} pH berechneter pH-Wert
   * @param {number} [dilution=1] relative Indikatorkonzentration, z. B. V0 / Vgesamt (≥ 0)
   * @returns {{r:number,g:number,b:number,strength:number,fraction:number}}
   *   r,g,b in 0…255; strength = mittlere Absorbanz (für Deckkraft)
   */
  function solutionColor(id, pH, dilution) {
    const ind = get(id);
    const f = baseFraction(id, pH);
    const k = dilution === undefined ? 1 : Math.max(0, Math.min(5, dilution));
    const out = [0, 0, 0];
    let sumA = 0;
    for (let i = 0; i < 3; i++) {
      const a = k * ((1 - f) * ind.acidAbsorbance[i] + f * ind.baseAbsorbance[i]);
      sumA += a;
      out[i] = 255 * Math.pow(10, -a);
    }
    return { r: out[0], g: out[1], b: out[2], strength: sumA / 3, fraction: f };
  }

  /** CSS-Verlauf über den Umschlagsbereich (für Auswahlkarten in der Oberfläche) */
  function cssGradient(id) {
    const ind = get(id);
    if (!ind.range) return 'linear-gradient(90deg, #dfe8f1, #dfe8f1)';
    const stops = [];
    const lo = ind.range[0] - 0.6;
    const hi = ind.range[1] + 0.6;
    for (let i = 0; i <= 8; i++) {
      const pH = lo + ((hi - lo) * i) / 8;
      const c = solutionColor(id, pH, 1);
      stops.push('rgb(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ') ' + (i * 12.5) + '%');
    }
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  }

  const api = {
    INDICATORS: INDICATORS,
    list: function () {
      return ['phenolphthalein', 'bromothymolBlue', 'methylOrange', 'none'].map(get);
    },
    get: get,
    baseFraction: baseFraction,
    solutionColor: solutionColor,
    cssGradient: cssGradient,
  };

  NS.Indicators = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
