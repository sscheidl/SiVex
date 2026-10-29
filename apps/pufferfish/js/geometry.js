/*
 * Pufferfish – Geometrie der Laborbühne (ohne DOM)
 *
 * Weltkoordinaten: Höhe 590, Breite mindestens 1000. Der Renderer wählt den
 * Maßstab nach der Höhe und dehnt die Welt in der Breite bei Bedarf aus
 * (worldW); Bechergläser verteilen sich dann gleichmäßig. Bechergläser sind
 * Zylinder: Die Steighöhe folgt exakt aus dem Volumen (h = V / (π r²)), wie im
 * TitraLab 3 der Füllstand aus der Kolbengeometrie.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.PF = root.PF || {}).geometry = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 1000, H = 590, BENCH = 500, CM = 32; // Welteinheiten je cm (0.1.0: 28)
  const TRAVEL = { dropper: 150, measure: 164 }; // Höhe der Pipettenspitze beim Verfahren

  /** Becherglastypen (Innenmaße in cm). */
  const TYPES = {
    b100: { r: 2.15, h: 9.2, glass: 0.16, nominal: 100, marks: [25, 50, 75, 100], maxFill: 95, label: '100 mL' }
  };

  // Flaschenplätze von links: Platz 0 und 1 (HCl/NaOH bzw. Säure-/Basen-Stammlösung)
  const BOTTLE_X = [62, 192];
  const BOTTLE = { w: 58, h: 128, neck: 14, mouthY: BENCH - 144, dipY: BENCH - 100 };
  const PIPETTES = {
    dropper: { len: 150, rest: { x: 262, y: BENCH - 30 }, capacity: 1.5 },
    measure: { len: 190, rest: { x: 312, y: BENCH - 30 }, capacity: 10.0 }
  };
  const X0 = 346;

  /** Lage der Gläser für eine Liste von Typen (gleichmäßige Lücken im Bereich X0…worldW − 14). */
  function layout(types, worldW) {
    const x0 = X0, x1 = Math.max(W, worldW || W) - 14, REF = 70;
    const widths = types.map((t) => 2 * (TYPES[t].r + TYPES[t].glass) * CM + REF);
    const gap = Math.max(14, (x1 - x0 - widths.reduce((a, b) => a + b, 0)) / (types.length + 1));
    let x = x0 + gap;
    return types.map((t, i) => {
      const T = TYPES[t];
      const half = T.r * CM;
      const cx = x + T.glass * CM + half;
      x += widths[i] + gap;
      const bottom = BENCH - 7;
      const top = bottom - T.h * CM;
      return { type: t, x: cx, half, bottom, top, glass: T.glass * CM, ref: { x: cx + half + T.glass * CM + 32, bottom: BENCH - 2, h: 104, r: 16 } };
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

  return { W, H, BENCH, CM, TRAVEL, TYPES, BOTTLE_X, BOTTLE, PIPETTES, X0, layout, surfaceY, tipOver };
});
