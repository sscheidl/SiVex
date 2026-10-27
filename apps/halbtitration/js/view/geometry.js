/*
 * (Unverändert aus TitraLab 3 übernommen: titration/js/view/geometry.js;
 *  nur der Namensraum heißt hier „Halbtitration“.)
 *
 * Geometrie des Laboraufbaus
 * --------------------------
 * Alle Zeichenkoordinaten sind „Weltkoordinaten“ einer 1000 × 1000 großen
 * Szene; der Renderer skaliert sie passend auf die Canvas-Größe.
 *
 * Der Füllstand im Erlenmeyerkolben wird nicht geschätzt, sondern aus
 * der realen Kolbengeometrie berechnet (100-mL-Enghals-Erlenmeyerkolben,
 * Kegelstumpf + zylindrischer Hals). So entspricht die Steighöhe genau
 * dem zugegebenen Volumen.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});

  const SCENE = { width: 1000, height: 1000 };

  /** Kolben: Innenmaße in cm */
  const FLASK_CM = {
    baseRadius: 3.2, // Innenradius am Boden
    neckRadius: 1.1, // Innenradius im Hals
    coneHeight: 7.5, // Höhe des kegelförmigen Teils
    neckHeight: 1.8,
  };

  /** Maßstab Kolben: Welteinheiten pro cm */
  const FLASK_SCALE = 34;

  const LAYOUT = {
    benchY: 950,
    stirrer: { x: 470, top: 880, height: 70, halfWidth: 140 },
    flask: { x: 470, innerBottom: 874, glass: 5 },
    burette: {
      x: 470,
      top: 30,
      zeroY: 60, // 0,00-mL-Marke
      mlPx: 8.4, // Welteinheiten pro mL
      innerHalf: 12,
      wall: 3,
      stopcockY: 525,
      tipStartY: 548,
      tipEndY: 590,
    },
    stand: { rodX: 290, rodTop: 20, baseX0: 170, baseX1: 410 },
    clampY: 190,
    meter: { x0: 730, x1: 910, top: 812 },
    lens: { dx: 185, radius: 88, zoom: 4.2 }, // Ablese-Lupe
  };

  LAYOUT.burette.fiftyY = LAYOUT.burette.zeroY + 50 * LAYOUT.burette.mlPx;

  /** Volumen (mL = cm³) eines Kegelstumpfs vom Boden bis zur Höhe h (cm) */
  function coneVolume(h) {
    const R = FLASK_CM.baseRadius;
    const r = radiusAt(h);
    return (Math.PI * h * (R * R + R * r + r * r)) / 3;
  }

  /** Innenradius (cm) in der Höhe h (cm) über dem Boden */
  function radiusAt(h) {
    const f = FLASK_CM;
    if (h <= 0) return f.baseRadius;
    if (h >= f.coneHeight) return f.neckRadius;
    return f.baseRadius - ((f.baseRadius - f.neckRadius) * h) / f.coneHeight;
  }

  const CONE_VOLUME = coneVolume(FLASK_CM.coneHeight);

  /** Füllhöhe (cm) für ein Flüssigkeitsvolumen (mL), numerisch per Bisektion */
  function heightForVolume(v) {
    if (!(v > 0)) return 0;
    if (v >= CONE_VOLUME) {
      const extra = (v - CONE_VOLUME) / (Math.PI * FLASK_CM.neckRadius * FLASK_CM.neckRadius);
      return FLASK_CM.coneHeight + extra;
    }
    let lo = 0;
    let hi = FLASK_CM.coneHeight;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (coneVolume(mid) < v) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** y-Koordinate (Welt) der Flüssigkeitsoberfläche im Kolben */
  function flaskSurfaceY(volume) {
    return LAYOUT.flask.innerBottom - heightForVolume(volume) * FLASK_SCALE;
  }

  /** Innerer Halbbreite (Welt) in der Welt-y-Koordinate y */
  function flaskInnerHalfWidth(y) {
    const h = (LAYOUT.flask.innerBottom - y) / FLASK_SCALE;
    return radiusAt(h) * FLASK_SCALE;
  }

  /** y-Koordinate (Welt) des Meniskus bei gegebener Bürettenablesung (mL) */
  function buretteY(reading) {
    return LAYOUT.burette.zeroY + reading * LAYOUT.burette.mlPx;
  }

  const api = {
    SCENE: SCENE,
    LAYOUT: LAYOUT,
    FLASK_CM: FLASK_CM,
    FLASK_SCALE: FLASK_SCALE,
    CONE_VOLUME: CONE_VOLUME,
    coneVolume: coneVolume,
    radiusAt: radiusAt,
    heightForVolume: heightForVolume,
    flaskSurfaceY: flaskSurfaceY,
    flaskInnerHalfWidth: flaskInnerHalfWidth,
    buretteY: buretteY,
    flaskTopInnerY: LAYOUT.flask.innerBottom - (FLASK_CM.coneHeight + FLASK_CM.neckHeight) * FLASK_SCALE,
    flaskConeTopY: LAYOUT.flask.innerBottom - FLASK_CM.coneHeight * FLASK_SCALE,
  };

  NS.Geometry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
