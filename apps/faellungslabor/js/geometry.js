/*
 * Fällungslabor – Geometrie der Laborbühne (ohne DOM)
 *
 * Weltkoordinaten: Höhe 1000, Breite passt sich der Bühne an (mindestens MIN_W).
 * Der Füllstand im Reagenzglas wird – wie im TitraLab 3 für den Erlenmeyerkolben
 * (titration/js/view/geometry.js) – aus der realen Glasgeometrie berechnet:
 * Halbkugelboden (Innenradius 1,0 cm) und zylindrischer Teil. Die Steighöhe entspricht
 * damit genau dem Volumen; Fassungsvermögen 20 mL bei 67 mm, Glasrand bei 82 mm.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const chem = isNode ? require('./chem.js') : root.FL.chem;
  const api = factory(chem);
  if (isNode) module.exports = api;
  else (root.FL = root.FL || {}).geometry = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const H = 1000;
  const BENCH = 905;            // Oberkante Tisch
  const MM = 6.2;               // Welteinheiten pro mm am Reagenzglas
  const R_CM = 1.0;             // Innenradius (cm)
  const RIM_MM = 82;            // Höhe des Glasrands über dem inneren Boden
  const WALL = 4.5;             // Glaswand (Welt)
  const INNER_BOTTOM = 878;     // innerer Boden der Reagenzgläser
  const RIM_Y = INNER_BOTTOM - RIM_MM * MM;
  const TUBE_R = R_CM * 10 * MM; // Innenradius (Welt)
  const TUBE_GAP = 172;         // Mittenabstand der Reagenzgläser
  const BOTTLE_GAP = 116;       // Mittenabstand der Flaschen
  const SHELF_Y = 258;          // Flaschenboden (Regalbrett)
  const BOTTLE = { w: 86, h: 104, neck: 30, neckH: 22 };
  const PIPETTE_LEN = 112;      // Glasschaft der Pipette (Spitze bis Hütchen)
  const LIFT = 56;              // aufgenommene Pipette über der Flasche
  const TOP_Y = -52;            // oberster sichtbarer Weltpunkt (Hütchen der aufgenommenen Pipette)
  const TIP_ABOVE = 30;         // Pipettenspitze über dem Glasrand beim Dosieren
  const GRAV = 2600;            // verlangsamter Fall (Welt/s²), wie Pufferfish/TitraLab

  const HEMI_ML = (2 / 3) * Math.PI * R_CM * R_CM * R_CM; // 2,094 mL
  const AREA = Math.PI * R_CM * R_CM;                     // cm² im Zylinder

  /** Volumen (mL) bis zur Füllhöhe h (cm). */
  function volumeAt(hcm) {
    if (!(hcm > 0)) return 0;
    if (hcm <= R_CM) return (Math.PI * hcm * hcm * (3 * R_CM - hcm)) / 3;
    return HEMI_ML + AREA * (hcm - R_CM);
  }
  /** Füllhöhe (cm) für ein Volumen (mL); im Halbkugelteil per Bisektion. */
  function heightFor(v) {
    if (!(v > 0)) return 0;
    if (v >= HEMI_ML) return R_CM + (v - HEMI_ML) / AREA;
    let lo = 0, hi = R_CM;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (volumeAt(m) < v) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  /** y der Flüssigkeitsoberfläche (Welt). */
  const surfaceY = (v) => INNER_BOTTOM - heightFor(v) * 10 * MM;
  /** Innere Halbbreite (Welt) in der Höhe y. */
  function halfWidthAt(y) {
    const h = (INNER_BOTTOM - y) / MM / 10; // cm über dem Boden
    if (h >= R_CM) return TUBE_R;
    if (h <= 0) return 0;
    const d = R_CM - h;
    return Math.sqrt(Math.max(0, R_CM * R_CM - d * d)) * 10 * MM;
  }
  const CAPACITY_Y = surfaceY(C.CAPACITY_ML);

  /** Mindestbreite der Welt für n Flaschen und m Reagenzgläser. */
  function minWidth(nBottles, nTubes) {
    return Math.max(nBottles * BOTTLE_GAP + 80, nTubes * TUBE_GAP + 120, 700);
  }
  /** Mittelpunkt der Flasche i von n bei Weltbreite W (Abstand wächst mit verfügbarem Platz). */
  function bottleGap(n, W) { return Math.max(BOTTLE_GAP, Math.min(150, (W - 80) / n)); }
  function bottleX(i, n, W) { return W / 2 + (i - (n - 1) / 2) * bottleGap(n, W); }
  /** Mittelpunkt des Reagenzglases i von m bei Weltbreite W. */
  function tubeX(i, m, W) { return W / 2 + (i - (m - 1) / 2) * TUBE_GAP; }

  /** Ruheposition der Pipette (in der Flasche) und Arbeitsposition über einem Reagenzglas. */
  const pipetteRest = (bx) => ({ x: bx, y: SHELF_Y - BOTTLE.h - BOTTLE.neckH + 26 });
  const pipetteOver = (tx) => ({ x: tx, y: RIM_Y - TIP_ABOVE });
  /** Fallzeit (s) eines Tropfens von der Spitze bis zur Oberfläche bei Volumen v. */
  function fallTime(v) { const d = Math.max(10, surfaceY(v) - (RIM_Y - TIP_ABOVE)); return Math.sqrt((2 * d) / GRAV); }

  /** Volumen (mL), das ein abgesetzter Niederschlag am Boden einnimmt (Darstellungsparameter). */
  const SEDIMENT_ML_PER_MMOL = 4.0;

  return {
    H, BENCH, TOP_Y, PIPETTE_LEN, LIFT, MM, R_CM, RIM_MM, WALL, INNER_BOTTOM, RIM_Y, TUBE_R, TUBE_GAP, BOTTLE_GAP, SHELF_Y, BOTTLE, TIP_ABOVE, GRAV,
    HEMI_ML, AREA, CAPACITY_Y, SEDIMENT_ML_PER_MMOL,
    volumeAt, heightFor, surfaceY, halfWidthAt, minWidth, bottleGap, bottleX, tubeX, pipetteRest, pipetteOver, fallTime
  };
});
