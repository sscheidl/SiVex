/*
 * Aggregatzustände – Stoffdaten (ohne DOM, ohne Logik)
 *
 * Ein gemeinsames Konfigurationsobjekt für alle vier Stoffe. Zustandsmodell,
 * Teilchen-Engine und Renderer sind für alle Stoffe gleich; die Stoffe
 * unterscheiden sich nur in diesen Werten: Schmelz- und Siedetemperatur
 * (gerundet, Normaldruck), didaktischer Darstellungsbereich des Reglers
 * (bei Eisen und Kochsalz gestaucht: fest, flüssig und gasförmig erhalten
 * etwa gleich viel Reglerweg),
 * Teilchensymbol und optische Erscheinung auf der Stoffebene.
 * Quellen und Vereinfachungen: docs/CHEMIE.md.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.AZ = root.AZ || {}).substances = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUBSTANCES = {
    water: {
      id: 'water', name: 'Wasser', gen: 'des Wassers',
      mp: 0, bp: 100, min: -30, max: 130, start: 20, bigStep: 10,
      vessel: 'beaker', solid: 'iceblock', solidFloats: true,
      particle: {
        lattice: 'hex', spacing: 1.15, liquidGap: 1.02,
        kinds: [{ symbol: 'triangle', r: 2.1, fill: '#2f7fd6', edge: '#17508f' }],
        legend: [{ k: 0, text: 'Wasserteilchen' }]
      },
      look: { liquid: [150, 200, 240], liquidAlpha: 0.42, gas: [255, 255, 255] }
    },
    iodine: {
      id: 'iodine', name: 'Iod', gen: 'des Iods',
      mp: 114, bp: 184, min: 20, max: 220, start: 25, bigStep: 10,
      vessel: 'beaker', solid: 'flakes',
      // Sublimation: fester Stoff bildet schon unterhalb der Schmelztemperatur etwas Dampf
      vapor: { from: 30, max: 0.14 },
      coldSurface: true,
      particle: {
        lattice: 'square', sx: 5.5, sy: 4.0, tilt: 0.3, liquidGap: 1.04,
        kinds: [{ symbol: 'rect', r: 2.15, w: 5.0, h: 2.4, fill: '#7d3fbf', edge: '#4a1d7c' }],
        legend: [{ k: 0, text: 'Iodteilchen' }]
      },
      look: { liquid: [58, 22, 40], liquidAlpha: 0.9, gas: [150, 62, 196] }
    },
    iron: {
      id: 'iron', name: 'Eisen', gen: 'des Eisens',
      mp: 1538, bp: 2862, min: 1400, max: 3000, start: 1400, bigStep: 50, track: [0.25, 0.75],
      vessel: 'crucible', solid: 'ingot', glow: true,
      particle: {
        lattice: 'hex', spacing: 1.03, liquidGap: 1.04,
        kinds: [{ symbol: 'sphere', r: 2.1, fill: '#aab4bf', edge: '#5f6975', shine: '#f6f9fc' }],
        legend: [{ k: 0, text: 'Eisenteilchen' }]
      },
      look: { liquid: [255, 176, 70], liquidAlpha: 1, gas: [255, 255, 255] }
    },
    salt: {
      id: 'salt', name: 'Kochsalz', long: 'Kochsalz (Natriumchlorid)', gen: 'des Kochsalzes',
      mp: 801, bp: 1465, min: 700, max: 1600, start: 700, bigStep: 25, track: [0.25, 0.75],
      vessel: 'crucible', solid: 'cubes', glow: true,
      particle: {
        lattice: 'square', sx: 3.9, sy: 3.9, liquidGap: 1.04,
        // zwei Teilchensorten im regelmäßigen Wechsel; im Gas paarweise gruppiert
        kinds: [
          { symbol: 'sphere', r: 1.4, fill: '#5a6069', edge: '#2f343a', shine: '#c9ced6' },
          { symbol: 'sphere', r: 2.35, fill: '#47ad52', edge: '#24702d', shine: '#c9f0cd' }
        ],
        pairsInGas: true,
        legend: [{ k: 0, text: 'Natrium-Ion (Na⁺)' }, { k: 1, text: 'Chlorid-Ion (Cl⁻)' }, { pair: true, text: 'Ionenpaar (NaCl) im Dampf' }]
      },
      look: { liquid: [238, 244, 250], liquidAlpha: 0.82, gas: [255, 255, 255] }
    }
  };
  const ORDER = ['water', 'iodine', 'iron', 'salt'];

  /** Schritt des Reglers: immer 1 °C, damit beide Übergangstemperaturen genau einstellbar sind. */
  const STEP = 1;

  /**
   * Reglerskala: stückweise linear zwischen Bereichsanfang, Schmelz- und Siedetemperatur und
   * Bereichsende. Ohne track ist sie linear; mit track liegen die beiden Übergänge an diesen
   * Anteilen der Reglerlänge (nicht maßstäblich, dafür besser bedienbar).
   */
  function knots(s) {
    const t = s.track || [(s.mp - s.min) / (s.max - s.min), (s.bp - s.min) / (s.max - s.min)];
    return [[s.min, 0], [s.mp, t[0]], [s.bp, t[1]], [s.max, 1]];
  }
  /** Temperatur → Anteil der Reglerlänge (0…1). */
  function tempToPos(s, T) {
    const k = knots(s);
    if (T <= k[0][0]) return 0;
    for (let i = 1; i < k.length; i++) if (T <= k[i][0]) return k[i - 1][1] + ((T - k[i - 1][0]) / (k[i][0] - k[i - 1][0])) * (k[i][1] - k[i - 1][1]);
    return 1;
  }
  /** Anteil der Reglerlänge → Temperatur (ganze Grad). */
  function posToTemp(s, p) {
    const k = knots(s);
    if (p <= 0) return s.min;
    for (let i = 1; i < k.length; i++) if (p <= k[i][1]) return Math.round((k[i - 1][0] + ((p - k[i - 1][1]) / (k[i][1] - k[i - 1][1])) * (k[i][0] - k[i - 1][0])) / STEP) * STEP;
    return s.max;
  }

  return { SUBSTANCES, ORDER, STEP, tempToPos, posToTemp };
});
