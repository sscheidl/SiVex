/*
 * Pufferfish – Geometrie der Laborbühne (ohne DOM)
 *
 * Weltkoordinaten 1000 × 590; der Renderer skaliert sie auf die Canvas-Größe.
 * Bechergläser sind Zylinder: Die Steighöhe folgt exakt aus dem Volumen
 * (h = V / (π r²)), wie im TitraLab 3 der Füllstand aus der Kolbengeometrie.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.PF = root.PF || {}).geometry = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 1000, H = 590, BENCH = 500, CM = 28; // Welteinheiten je cm
  const TRAVEL = { dropper: 172, measure: 184 }; // Höhe der Pipettenspitze beim Verfahren

  /** Becherglastypen (Innenmaße in cm). */
  const TYPES = {
    b100: { r: 2.15, h: 9.2, glass: 0.16, nominal: 100, marks: [25, 50, 75, 100], maxFill: 95, label: '100 mL' },
    b400: { r: 3.7, h: 10.4, glass: 0.2, nominal: 400, marks: [100, 200, 300, 400], maxFill: 380, label: '400 mL' }
  };

  const BOTTLES = { HCl: { x: 62 }, NaOH: { x: 134 } };
  const BOTTLE = { w: 50, h: 112, neck: 13, mouthY: BENCH - 128, dipY: BENCH - 92 };
  const PIPETTES = {
    dropper: { len: 150, rest: { x: 196, y: BENCH - 30 }, capacity: 1.5 },
    measure: { len: 180, rest: { x: 226, y: BENCH - 30 }, capacity: 5.0 }
  };

  /** Lage der Gläser für eine Liste von Typen (gleichmäßige Lücken im Bereich x0…x1). */
  function layout(types) {
    const x0 = 262, x1 = 990, REF = 66;
    const widths = types.map((t) => 2 * (TYPES[t].r + TYPES[t].glass) * CM + REF);
    const gap = (x1 - x0 - widths.reduce((a, b) => a + b, 0)) / (types.length + 1);
    let x = x0 + gap;
    return types.map((t, i) => {
      const T = TYPES[t];
      const half = T.r * CM;
      const cx = x + T.glass * CM + half;
      x += widths[i] + gap;
      const bottom = BENCH - 7;
      const top = bottom - T.h * CM;
      return { type: t, x: cx, half, bottom, top, glass: T.glass * CM, ref: { x: cx + half + T.glass * CM + 30, bottom: BENCH - 2, h: 96, r: 15 } };
    });
  }

  /** y der Flüssigkeitsoberfläche bei V mL. */
  function surfaceY(b, V) {
    const T = TYPES[b.type];
    return b.bottom - (V / (Math.PI * T.r * T.r)) * CM;
  }

  /** Position der Pipettenspitze beim Abgeben in ein Glas. */
  function tipOver(b, tool) {
    return tool === 'measure' ? { x: b.x - b.half * 0.35, y: b.top + 26 } : { x: b.x - 6, y: b.top - 14 };
  }

  return { W, H, BENCH, CM, TRAVEL, TYPES, BOTTLES, BOTTLE, PIPETTES, layout, surfaceY, tipOver };
});
