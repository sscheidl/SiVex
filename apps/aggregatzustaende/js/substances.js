/*
 * Aggregatzustände – Stoffdaten (ohne DOM, ohne Logik)
 *
 * Ein gemeinsames Konfigurationsobjekt für alle vier Stoffe. Zustandsmodell,
 * Teilchen-Engine und Renderer sind für alle Stoffe gleich; die Stoffe
 * unterscheiden sich nur in diesen Werten: Schmelz- und Siedetemperatur
 * (gerundet, Normaldruck), didaktischer Darstellungsbereich des Reglers,
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
        legend: 'blaues Dreieck: ein Wasserteilchen'
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
        legend: 'violettes Rechteck: ein Iodteilchen'
      },
      look: { liquid: [58, 22, 40], liquidAlpha: 0.9, gas: [150, 62, 196] }
    },
    iron: {
      id: 'iron', name: 'Eisen', gen: 'des Eisens',
      mp: 1538, bp: 2862, min: 1400, max: 3000, start: 1400, bigStep: 50,
      vessel: 'crucible', solid: 'ingot', glow: true,
      particle: {
        lattice: 'hex', spacing: 1.03, liquidGap: 1.04,
        kinds: [{ symbol: 'sphere', r: 2.1, fill: '#aab4bf', edge: '#5f6975', shine: '#f6f9fc' }],
        legend: 'silbergraue Kugel: ein Eisenteilchen'
      },
      look: { liquid: [255, 176, 70], liquidAlpha: 1, gas: [255, 255, 255] }
    },
    salt: {
      id: 'salt', name: 'Kochsalz', long: 'Kochsalz (Natriumchlorid)', gen: 'des Kochsalzes',
      mp: 801, bp: 1465, min: 700, max: 1600, start: 700, bigStep: 25,
      vessel: 'crucible', solid: 'cubes', glow: true,
      particle: {
        lattice: 'square', sx: 3.9, sy: 3.9, liquidGap: 1.04,
        // zwei Teilchensorten im regelmäßigen Wechsel; im Gas paarweise gruppiert
        kinds: [
          { symbol: 'sphere', r: 1.4, fill: '#5a6069', edge: '#2f343a', shine: '#c9ced6' },
          { symbol: 'sphere', r: 2.35, fill: '#47ad52', edge: '#24702d', shine: '#c9f0cd' }
        ],
        pairsInGas: true,
        legend: 'kleine dunkelgraue und große grüne Kugeln: die zwei Teilchensorten des Kochsalzes'
      },
      look: { liquid: [238, 244, 250], liquidAlpha: 0.82, gas: [255, 255, 255] }
    }
  };
  const ORDER = ['water', 'iodine', 'iron', 'salt'];

  /** Schritt des Reglers: immer 1 °C, damit beide Übergangstemperaturen genau einstellbar sind. */
  const STEP = 1;

  return { SUBSTANCES, ORDER, STEP };
});
