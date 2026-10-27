/*
 * Trennverfahren – Geometrie (ohne DOM)
 *
 * Gefäßprofile als Rotationskörper (Innenradius r über der Höhe h, in Weltpixeln;
 * 1 mm = 1,25 px), daraus Füllhöhen aus Volumina. Für gekippte Gefäße wird die
 * waagrechte Flüssigkeitsoberfläche über die Querschnittsfläche bestimmt
 * (Halbebenen-Schnitt und Bisektion), sodass der Spiegel beim Neigen waagrecht
 * bleibt und genau dann den Ausguss erreicht, wenn Flüssigkeit austreten kann.
 * Lage der Plätze, Stative und Sonderplätze für den Renderer und die Trefferflächen.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TV = root.TV || {}).geometry = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PX_PER_MM = 1.25;
  const ML_PER_PX3 = Math.pow(1 / PX_PER_MM, 3) / 1000;
  const H = 600; // Welthöhe
  const BASE_Y = 515; // Standfläche hintere Reihe
  const FRONT_Y = 552; // Ablage vorne
  const BENCH_TOP = 492; // Hinterkante der Tischplatte
  const BENCH_FRONT = 566; // Vorderkante der Tischplatte

  // ------------------------------------------------------------------ Profile (Innenraum)
  /** [h, r]-Stützstellen, h nach oben (px), r Innenradius (px). */
  function sphereProfile(rim, depth, n) {
    const R = (rim * rim + depth * depth) / (2 * depth);
    const pts = [];
    for (let i = 0; i <= n; i++) { const h = depth * i / n; pts.push([h, Math.sqrt(Math.max(0, R * R - (R - h) * (R - h)))]); }
    pts[0][1] = Math.max(pts[0][1], 0.5);
    return pts;
  }
  const PROFILES = {
    beaker: [[0, 37], [1.2, 39.6], [4, 41], [118, 41]],
    erlenmeyer: [[0, 45], [2, 48], [6, 49], [125, 15.5], [176, 15.5]],
    dish: sphereProfile(58, 32, 24),
    bowl: sphereProfile(54, 34, 24),
    watch: sphereProfile(46, 8, 12),
    funnel: [[0, 3.5], [66, 42]],
    sep: [[0, 3], [10, 8], [60, 30], [90, 37.5], [120, 41], [150, 40], [175, 28], [190, 12], [215, 12]]
  };
  /** Ursprung des Profils (h = 0) relativ zum lokalen Ursprung des Geräts (y nach unten). */
  const BASE_OFFSET = { beaker: -3, erlenmeyer: -3, dish: -5, bowl: -6, watch: -3, funnel: 0, sep: 0 };
  /** Ausgusspunkt (lokal, y nach unten) für gießbare Gefäße – Ausguss rechts. */
  const LIP = { beaker: [45.5, -122], erlenmeyer: [20.5, -181], bowl: [58, -42] };
  /** Schüttdichte für die Darstellung des Bodensatzes (g/mL) und Porenanteil. */
  const BULK = { sandC: 1.55, sandF: 1.35, iron: 3.0, saltS: 1.2 };
  const PORE = 0.38;

  function rAt(type, h) {
    const p = PROFILES[type];
    if (h <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (h <= p[i][0]) { const a = p[i - 1], b = p[i]; return a[1] + (b[1] - a[1]) * (h - a[0]) / (b[0] - a[0]); }
    }
    return p[p.length - 1][1];
  }
  const topH = (type) => PROFILES[type][PROFILES[type].length - 1][0];

  // Volumen- und Flächentabellen (0,5-px-Schritte)
  const TABLES = {};
  function table(type) {
    if (TABLES[type]) return TABLES[type];
    const dh = 0.5, top = topH(type), hs = [0], vs = [0], as = [0];
    let v = 0, a = 0;
    for (let h = dh; h <= top + 1e-9; h += dh) {
      const r = rAt(type, h - dh / 2);
      v += Math.PI * r * r * dh * ML_PER_PX3;
      a += 2 * r * dh;
      hs.push(h); vs.push(v); as.push(a);
    }
    return (TABLES[type] = { hs, vs, as });
  }
  const interp = (xs, ys, x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    return ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / (xs[hi] - xs[lo]);
  };
  /** Füllhöhe (px über dem Innenboden) für ein Volumen in mL. */
  const heightOf = (type, mL) => interp(table(type).vs, table(type).hs, Math.max(0, mL));
  const volumeAt = (type, h) => interp(table(type).hs, table(type).vs, h);
  /** Querschnittsfläche (px²) bis zur Füllhöhe des Volumens – Grundlage für gekippte Gefäße. */
  const areaOf = (type, mL) => interp(table(type).hs, table(type).as, heightOf(type, mL));
  const capacity = (type) => volumeAt(type, topH(type));

  /** Volumen des Bodensatzes (mL) und das für die Füllhöhe wirksame Gesamtvolumen. */
  function bedVolume(c) { return (c.sandC / BULK.sandC) + (c.sandF / BULK.sandF) + (c.iron / BULK.iron) + (c.saltS / BULK.saltS); }
  function fillVolume(c) { const bed = bedVolume(c); return bed + Math.max(0, c.water + c.oil - PORE * bed); }

  /** Innenraum als Polygon in lokalen Koordinaten (y nach unten). */
  function interiorPoly(type) {
    const p = PROFILES[type], off = BASE_OFFSET[type];
    const left = p.map(([h, r]) => [-r, off - h]);
    const right = p.slice().reverse().map(([h, r]) => [r, off - h]);
    const poly = left.concat(right);
    if (type === 'beaker') { // Ausguss rechts oben
      const top = off - topH(type);
      poly.splice(left.length, 1, [41, top], [45.5, top - 3.5]);
    }
    return poly;
  }

  // ------------------------------------------------------------------ Polygone
  function polyArea(poly) {
    let a = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return Math.abs(a / 2);
  }
  /** Teil des Polygons unterhalb (y ≥ level) einer waagrechten Linie (Sutherland-Hodgman). */
  function clipBelow(poly, level) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ina = a[1] >= level, inb = b[1] >= level;
      if (ina) out.push(a);
      if (ina !== inb) { const t = (level - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, level]); }
    }
    return out;
  }
  function transform(poly, pose) {
    const c = Math.cos(pose.th), s = Math.sin(pose.th);
    return poly.map(([x, y]) => { const dx = x - pose.ax, dy = y - pose.ay; return [pose.x + dx * c - dy * s, pose.y + dx * s + dy * c]; });
  }
  /** Weltpunkt eines lokalen Punktes bei gegebener Pose {x, y (Weltpunkt des Ankers), ax, ay (lokaler Anker), th}. */
  const toWorld = (pose, lx, ly) => transform([[lx, ly]], pose)[0];
  /** Waagrechte Spiegelhöhe (Welt-y) im gedrehten Innenraum für eine Querschnittsfläche. */
  function levelFor(polyW, area) {
    let lo = Infinity, hi = -Infinity;
    for (const p of polyW) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
    if (area <= 0) return hi;
    if (area >= polyArea(polyW)) return lo;
    let a = lo, b = hi;
    for (let i = 0; i < 32; i++) { const m = (a + b) / 2; if (polyArea(clipBelow(polyW, m)) > area) a = m; else b = m; }
    return (a + b) / 2;
  }
  /** Neigungswinkel, bei dem der waagrechte Spiegel gerade den Ausguss erreicht. */
  function pourAngle(type, area) {
    const poly = interiorPoly(type), [lx, ly] = LIP[type];
    let a = 0, b = 2.4;
    const f = (th) => { const pose = { x: 0, y: 0, ax: lx, ay: ly, th }; return polyArea(clipBelow(transform(poly, pose), 0)); };
    if (f(0) <= area) return 0;
    for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (f(m) > area) a = m; else b = m; }
    return (a + b) / 2;
  }

  // ------------------------------------------------------------------ Aufbau der Plätze
  const RING = { funnelApex: 262, ringY: 210, standDx: 96, standTop: 150 };
  const SEPR = { origin: 322, ringY: 258, standDx: 100, standTop: 70 };
  const PLATE = { w: 168, h: 36 };
  const PLATE_TOP = BASE_Y - PLATE.h;
  const HOLDER = { funnel: 58 };

  /** Weltpose eines Geräts am Platz (Ursprung des Geräts, Drehung). */
  function placePose(type, slot) {
    const x = slot.x;
    switch (slot.kind) {
      case 'ring': return { x, y: RING.funnelApex, th: 0 };
      case 'sepring': return { x, y: SEPR.origin, th: 0 };
      case 'plate': return { x, y: PLATE_TOP - (type === 'dish' ? 4 : 0), th: 0 };
      case 'front': return { x, y: FRONT_Y, th: 0 };
      default:
        if (type === 'funnel') return { x, y: BASE_Y - HOLDER.funnel, th: 0 };
        if (type === 'sep') return { x, y: BASE_Y - 46, th: Math.PI / 2, lying: true };
        if (type === 'dish' || type === 'bowl' || type === 'watch') return { x, y: BASE_Y - 3, th: 0 };
        return { x, y: BASE_Y, th: 0 };
    }
  }
  /** Oberkante der Öffnung und Einschenkpunkt eines Zielgeräts an seinem Platz. */
  function openingOf(type, pose) {
    const off = BASE_OFFSET[type] || 0;
    const top = pose.y + off - topH(type);
    const r = rAt(type, topH(type));
    return { x: pose.x, top, r };
  }
  /** Punkt, an dem der Ausguss beim Gießen in ein Ziel stehen soll. */
  function pourTarget(type, pose) {
    const o = openingOf(type, pose);
    const dx = type === 'sep' ? -6 : type === 'funnel' ? -12 : -Math.min(22, o.r * 0.45);
    return { x: o.x + dx, y: o.top - (type === 'sep' ? 14 : 24), top: o.top, r: o.r };
  }
  /** Ende des Trichterrohrs bzw. des Scheidetrichter-Auslaufs (Welt). */
  const funnelTip = (pose) => ({ x: pose.x, y: pose.y + 90 });
  const sepTip = (pose) => ({ x: pose.x, y: pose.y + 78 });

  /** Umriss (lokal) eines Gefäßes grob als Rechteck – für Trefferflächen. */
  const EXTENT = {
    beaker: { x0: -46, x1: 48, y0: -124, y1: 0 },
    erlenmeyer: { x0: -53, x1: 53, y0: -183, y1: 0 },
    dish: { x0: -66, x1: 66, y0: -46, y1: 6 },
    bowl: { x0: -62, x1: 62, y0: -46, y1: 6 },
    watch: { x0: -52, x1: 52, y0: -16, y1: 4 },
    funnel: { x0: -46, x1: 46, y0: -70, y1: 92 },
    sep: { x0: -46, x1: 46, y0: -234, y1: 80 },
    magnet: { x0: -52, x1: 52, y0: -22, y1: 4 },
    rod: { x0: -74, x1: 74, y0: -14, y1: 4 },
    paper: { x0: -40, x1: 40, y0: -16, y1: 4 },
    wash: { x0: -34, x1: 44, y0: -150, y1: 0 }
  };

  return {
    PX_PER_MM, ML_PER_PX3, H, BASE_Y, FRONT_Y, BENCH_TOP, BENCH_FRONT, PROFILES, BASE_OFFSET, LIP, BULK, PORE,
    RING, SEPR, PLATE, PLATE_TOP, HOLDER, EXTENT,
    rAt, topH, heightOf, volumeAt, areaOf, capacity, bedVolume, fillVolume, interiorPoly,
    polyArea, clipBelow, transform, toWorld, levelFor, pourAngle,
    placePose, openingOf, pourTarget, funnelTip, sepTip
  };
});
