/*
 * Indikatormodell (aus TitraLab 3 übernommen und erweitert)
 * --------------------------------------------------------
 * HIn ⇌ In⁻ + H⁺: Anteil der basischen Form x(In⁻) = 1 / (1 + 10^(pKs(HIn) − pH)).
 * Die sichtbare Farbe wird subtraktiv (Lambert-Beer je RGB-Kanal) aus den
 * Absorbanzen beider Formen gemischt. Die Indikatorstoffmenge ist konstant,
 * die Konzentration sinkt durch Verdünnung.
 *
 * endpointPH: pH-Wert, an dem der Umschlag als Endpunkt erkannt wird –
 * bei zweifarbigen Indikatoren die Mischfarbe (≈ pKs(HIn)), bei
 * einfarbigen (Phenolphthalein, Thymolphthalein) das erste deutliche
 * Auftreten bzw. Verschwinden der Farbe (Anteil In⁻ ≈ 10 %).
 * Umschlagsbereiche: übliche Tabellenwerte (z. B. Jander/Jahr, Maßanalyse).
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});

  function absorbanceFromColor(rgb) {
    return rgb.map(function (c) {
      const t = Math.min(1, Math.max(1e-3, c / 255));
      return -Math.log10(t);
    });
  }

  const INDICATORS = {
    methylOrange: {
      id: 'methylOrange', name: 'Methylorange', pKa: 3.7, range: [3.1, 4.4], endpointPH: 3.9,
      acidLabel: 'rot', baseLabel: 'gelb-orange', acidColor: [222, 38, 46], baseColor: [246, 180, 36],
    },
    methylRed: {
      id: 'methylRed', name: 'Methylrot', pKa: 5.1, range: [4.4, 6.2], endpointPH: 5.1,
      acidLabel: 'rot', baseLabel: 'gelb', acidColor: [214, 34, 70], baseColor: [244, 206, 48],
    },
    bromothymolBlue: {
      id: 'bromothymolBlue', name: 'Bromthymolblau', pKa: 7.1, range: [6.0, 7.6], endpointPH: 7.0,
      acidLabel: 'gelb', baseLabel: 'blau', acidColor: [244, 206, 32], baseColor: [26, 74, 206],
    },
    phenolphthalein: {
      id: 'phenolphthalein', name: 'Phenolphthalein', pKa: 9.4, range: [8.2, 10.0], endpointPH: 8.45,
      acidLabel: 'farblos', baseLabel: 'pink-violett', acidColor: [255, 255, 255], baseColor: [214, 28, 132],
    },
    thymolphthalein: {
      id: 'thymolphthalein', name: 'Thymolphthalein', pKa: 9.9, range: [9.3, 10.5], endpointPH: 9.4,
      acidLabel: 'farblos', baseLabel: 'blau', acidColor: [255, 255, 255], baseColor: [40, 80, 210],
    },
    none: {
      id: 'none', name: 'ohne Indikator (pH-metrisch)', pKa: null, range: null, endpointPH: null,
      acidLabel: '–', baseLabel: '–', acidColor: [255, 255, 255], baseColor: [255, 255, 255],
    },
  };
  const ORDER = ['methylOrange', 'methylRed', 'bromothymolBlue', 'phenolphthalein', 'thymolphthalein', 'none'];

  ORDER.forEach(function (key) {
    const ind = INDICATORS[key];
    ind.acidAbsorbance = absorbanceFromColor(ind.acidColor);
    ind.baseAbsorbance = absorbanceFromColor(ind.baseColor);
  });

  function get(id) {
    const ind = INDICATORS[id];
    if (!ind) throw new RangeError('Unbekannter Indikator: ' + id);
    return ind;
  }

  function baseFraction(id, pH) {
    const ind = get(id);
    if (ind.pKa === null) return 0;
    return 1 / (1 + Math.pow(10, ind.pKa - pH));
  }

  /**
   * Durchlichtfarbe der Lösung. dilution = relative Indikatorkonzentration.
   * @returns {{r:number,g:number,b:number,strength:number,fraction:number}}
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

  function cssGradient(id) {
    const ind = get(id);
    if (!ind.range) return 'linear-gradient(90deg, #e8edf2, #e8edf2)';
    const stops = [];
    const lo = ind.range[0] - 0.6;
    const hi = ind.range[1] + 0.6;
    for (let i = 0; i <= 8; i++) {
      const pH = lo + ((hi - lo) * i) / 8;
      const c = solutionColor(id, pH, 1.4);
      stops.push('rgb(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ') ' + (i * 12.5) + '%');
    }
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  }

  const api = {
    INDICATORS: INDICATORS,
    ORDER: ORDER,
    list: function () { return ORDER.map(get); },
    get: get,
    baseFraction: baseFraction,
    solutionColor: solutionColor,
    cssGradient: cssGradient,
  };

  NS.Indicators = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
