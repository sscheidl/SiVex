/*
 * Destillation – Geometrie der Apparatur (ohne DOM)
 *
 * Alle Bauteile liegen in EINEM Weltkoordinatensystem (Einheit ≈ 1 mm,
 * y nach unten, Tischplatte bei y = 0). Jedes Teil wird aus den Ankerpunkten
 * seines Vorgängers berechnet:
 *   Kolbenmitte → Kolbenhals → Destillationsaufsatz → seitlicher Abgang
 *   → Innenrohr des Liebigkühlers → Vorstoß → Tropfspitze → Vorlage,
 * Laborboys und Stativarm richten sich nach diesen Punkten, die Schläuche
 * nach Kühleranschlüssen und Laborarmatur. Die Bühne wird als Ganzes gleichmäßig skaliert
 * (fit); deshalb bleiben alle Verbindungen bei jeder Bildschirmgröße und
 * Trennlinienstellung geschlossen. connections() liefert die Sollverbindungen
 * für die automatischen Tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.DS = root.DS || {}).geometry = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const deg = Math.PI / 180;
  const P = (x, y) => ({ x, y });
  const addv = (a, b, k) => P(a.x + b.x * (k == null ? 1 : k), a.y + b.y * (k == null ? 1 : k));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ------------------------------------------------------------------ Maße
  const DIM = {
    flaskR: 50,          // Rundkolben 250 mL (Außenradius, gegenüber dem Kühler vergrößert gezeichnet)
    glass: 2.2,          // Wandstärke
    neckHW: 13,          // Kolbenhals NS 29 (halbe Außenbreite)
    neckLen: 40,         // Hals über dem Kugelansatz
    headHW: 12,          // Destillationsaufsatz
    headLen: 120,        // vom Halsende bis zur Oberkante
    armY: 50,            // Abstand Oberkante → Achse des seitlichen Abgangs
    armAngle: 16,        // Neigung des Abgangs und des Kühlers (Grad unter der Waagrechten)
    armHW: 7.5,
    armLen: 64,
    condLen: 355,        // Innenrohr des Liebigkühlers
    jacket0: 46,         // Kühlmantel von … bis … (entlang der Achse)
    jacket1: 310,
    jacketHW: 18,
    tubeHW: 6,
    nozzleHigh: 70,      // oberer Anschluss (Ablauf) nahe dem Aufsatz
    nozzleLow: 286,      // unterer Anschluss (Zulauf) nahe dem Vorstoß
    nozzleLen: 22,
    nozzleHW: 4.5,
    adapterStraight: 30, // Vorstoß: gerades Stück, Bogen, senkrechtes Stück
    adapterBend: 24,
    adapterDrop: 52,
    adapterHW: 7,
    tipInside: 20,       // so weit ragt die Tropfspitze in den Hals der Vorlage
    recvH: 112,          // Erlenmeyerkolben 100 mL
    recvBaseHW: 36,
    recvNeckHW: 13,
    recvJackH: 46,       // Laborboy unter der Vorlage
    mantleWall: 24,      // Heizpilz: Wandstärke um den Kolben
    mantleBottom: 26,
    jackW: 150,
    thermoLen: 300,      // Thermometer (Kugelmitte bis Oberende)
    thermoHW: 4.2,
    bulbLen: 16
  };

  /**
   * Baut die Apparatur. opts: { station: true|false } (getrennter Prüfplatz für die Brennprobe)
   */
  function build(opts) {
    const o = opts || {};
    const D = DIM;
    const th = D.armAngle * deg;
    const d = P(Math.cos(th), Math.sin(th));      // Richtung Abgang/Kühler (nach rechts unten)
    const nUp = P(Math.sin(th), -Math.cos(th));   // Normale nach oben
    const nDown = P(-Math.sin(th), Math.cos(th)); // Normale nach unten

    // Höhe zunächst relativ zur Kolbenmitte (cy = 0), danach so verschoben,
    // dass die Vorlage auf ihrem Laborboy steht.
    const rel = (cy) => {
      const g = {};
      g.flask = { c: P(0, cy), R: D.flaskR };
      const neckJoin = cy - Math.sqrt(D.flaskR * D.flaskR - D.neckHW * D.neckHW);
      g.neck = { x: 0, y0: neckJoin, y1: cy - D.flaskR - D.neckLen, hw: D.neckHW };
      g.head = { x: 0, y0: g.neck.y1, y1: g.neck.y1 - D.headLen, hw: D.headHW };
      g.head.joint = P(0, g.neck.y1);                     // Schliff Kolben/Aufsatz
      g.arm = { o: P(0, g.head.y1 + D.armY), d, hw: D.armHW };
      g.arm.start = addv(g.arm.o, d, D.headHW / Math.cos(th) * 0.95);
      g.arm.end = addv(g.arm.o, d, D.headHW / Math.cos(th) + D.armLen);
      const C0 = g.arm.end;                                // Schliff Abgang/Kühler
      const C1 = addv(C0, d, D.condLen);
      g.cond = { c0: C0, c1: C1, d, nUp, nDown, len: D.condLen, j0: D.jacket0, j1: D.jacket1, jhw: D.jacketHW, thw: D.tubeHW };
      g.cond.at = (s, off) => addv(addv(C0, d, s), nUp, off || 0);
      const nzH = g.cond.at(D.nozzleHigh, D.jacketHW);
      const nzL = addv(addv(C0, d, D.nozzleLow), nDown, D.jacketHW);
      g.nozzles = {
        high: { base: nzH, tip: addv(nzH, nUp, D.nozzleLen), dir: nUp, hw: D.nozzleHW },
        low: { base: nzL, tip: addv(nzL, nDown, D.nozzleLen), dir: nDown, hw: D.nozzleHW }
      };
      // Vorstoß
      const A0 = C1;
      const A1 = addv(A0, d, D.adapterStraight);
      const Cb = addv(A1, nDown, D.adapterBend);
      const A2 = P(Cb.x + D.adapterBend, Cb.y);          // Ende des Bogens, Richtung senkrecht nach unten
      const tip = P(A2.x, A2.y + D.adapterDrop);
      g.adapter = { a0: A0, a1: A1, center: Cb, r: D.adapterBend, a2: A2, tip, hw: D.adapterHW, startAngle: Math.atan2(A1.y - Cb.y, A1.x - Cb.x), endAngle: 0 };
      // Vorlage (Erlenmeyerkolben): Spitze ragt in den Hals
      const rim = tip.y - D.tipInside;
      g.receiver = { x: tip.x, rim, base: rim + D.recvH, h: D.recvH, baseHW: D.recvBaseHW, neckHW: D.recvNeckHW };
      return g;
    };
    // Vorlage soll auf einem Laborboy der Höhe recvJackH stehen: Basis bei y = −recvJackH
    let g0 = rel(0);
    const cy = -D.recvJackH - g0.receiver.base;
    const g = rel(cy);
    g.bench = 0;
    g.receiver.jack = { x: g.receiver.x, w: 112, h: D.recvJackH, top: -D.recvJackH };

    // Heizpilz und Laborboy unter dem Kolben
    const fc = g.flask.c;
    g.mantle = { x: 0, rim: fc.y + 4, inner: D.flaskR + 3, outer: D.flaskR + D.mantleWall, base: fc.y + D.flaskR + D.mantleBottom };
    g.mantle.knob = P(g.mantle.outer * 0.62, g.mantle.base - 16);
    g.jack = { x: 0, w: D.jackW, top: g.mantle.base, h: -g.mantle.base };

    // Stativ mit Doppelmuffe; der Arm hält den Kolbenhals von hinten
    const rodX = -112;
    g.stand1 = { rodX, base: { x0: -175, x1: -28, h: 12 }, top: g.neck.y1 - 30, clamps: [{ y: g.neck.y1 + 16, x1: -D.neckHW - 1, hw: D.neckHW }] };

    // Thermometer: Kugelmitte je nach Position
    const armLow = g.arm.o.y + D.armHW;               // Unterkante der Abgangsöffnung (auf der Achse)
    g.thermo = {
      x: 0, hw: D.thermoHW, bulbLen: D.bulbLen, len: D.thermoLen,
      bulb: { high: g.arm.o.y - D.armHW - D.bulbLen / 2 - 9, correct: armLow + D.bulbLen / 2 - 1, low: g.neck.y1 + 22 },
      cap: { y0: g.head.y1 - 16, y1: g.head.y1 + 2, hw: D.headHW + 3 }
    };
    g.thermo.top = (pos) => g.thermo.bulb[pos] - D.thermoLen;
    // Skala: Abbildung °C ↔ y entlang des Stiels (relativ zur Kugelmitte)
    g.thermo.scale = { t0: 0, t1: 110, off0: -D.thermoLen + 214, off1: -D.thermoLen + 24 };
    g.thermo.yOf = (pos, T) => {
      const s = g.thermo.scale;
      return g.thermo.bulb[pos] + s.off0 + (s.off1 - s.off0) * (T - s.t0) / (s.t1 - s.t0);
    };

    // Ausguss mit Laborarmatur: Zulauf aus der Armatur, Ablauf ins Becken
    g.sink = { x0: g.receiver.x + 92, x1: g.receiver.x + 196, y: 0, depth: 26 };
    const tapX = g.sink.x0 + 56;
    g.tap = { x: tapX, base: 0, top: -150, olive: P(g.sink.x0 + 14, -108), handle: P(tapX, -86) };
    g.tap.outlet = g.tap.olive;
    g.sink.drop = P(g.sink.x1 - 18, -14);

    // Schlauchwege als kubische Bézierketten [p0, c1, c2, p1, c3, c4, p2, …], aus den tatsächlichen Anschlusspunkten
    const nh = g.nozzles.high.tip;
    const hoseTopY = nh.y - 64;
    const sd = g.sink.drop;
    const ol = g.tap.olive;
    g.hoseRoutes = {
      // Zulauf: Armatur → hinter der Vorlage über den Tisch → Anschluss
      inlet: (nozzle) => {
        const end = g.nozzles[nozzle];
        const bench = [ol, P(ol.x, -34), P(ol.x - 12, -6), P(ol.x - 60, -6)];
        if (nozzle === 'low') return bench.concat([P(end.tip.x + 60, -6), addv(end.tip, end.dir, 70), end.tip]);
        // falsch: Zulauf am oberen Anschluss – Schlauch führt vor dem Kühler nach oben
        return bench.concat([P(end.tip.x + 40, -6), addv(end.tip, end.dir, 150), end.tip]);
      },
      // Ablauf: Anschluss → Ausguss
      outlet: (nozzle) => {
        const end = g.nozzles[nozzle];
        if (nozzle === 'high') {
          const p1 = P(end.tip.x + 150, hoseTopY);
          return [end.tip, addv(end.tip, end.dir, 44), P(end.tip.x + 60, hoseTopY), p1,
            P(sd.x - 150, hoseTopY), P(sd.x, hoseTopY + 10), P(sd.x, hoseTopY + 120),
            P(sd.x, -100), P(sd.x, -60), sd];
        }
        // falsch: Ablauf am unteren Anschluss – Schlauch hängt nach unten und läuft über den Tisch
        return [end.tip, addv(end.tip, end.dir, 60), P(end.tip.x + 10, -14), P(end.tip.x + 60, -14),
          P(end.tip.x + 200, -14), P(sd.x - 30, -40), sd];
      },
      // lose Schlauchenden, solange nicht angeschlossen
      looseInlet: () => [ol, P(ol.x, -70), P(ol.x + 4, -40), P(ol.x + 8, -16)],
      looseOutlet: () => [sd, P(sd.x + 4, -52), P(g.sink.x1 + 12, -52), P(g.sink.x1 + 14, -8)]
    };
    g.hoseTopY = hoseTopY;

    // Flasche mit dem Gemisch und Schälchen mit Siedesteinen auf dem Tisch
    g.bottle = { x: g.jack.w / 2 + 30, base: 0, w: 44, h: 92 };
    g.stonesDish = { x: g.bottle.x + 54, base: 0, w: 42, h: 12 };

    // Getrennter Prüfplatz (nur Ethanol/Wasser)
    if (o.station) {
      const x1 = g.stand1.base.x0 - 22, x0 = x1 - 300;
      g.station = { x0, x1, y: 0, mat: { x0: x0 + 6, x1: x1 - 6, h: 8 }, dish: P(x0 + 150, -8), pipette: P(x0 + 22, -8), lighter: P(x0 + 70, -12), recv: P(x0 + 250, -8) };
    }
    // Abgenommene Vorlage: zum Prüfplatz (Ethanol/Wasser) bzw. auf den Tisch neben dem Aufbau – gleiche Größe
    g.receiverAway = g.station ? { x: g.station.recv.x, base: g.station.recv.y } : { x: g.receiver.x - 130, base: 0 };

    // Große Digitalanzeige links neben dem Thermometer (über dem Aufsatz), Einblendflächen rechts oben
    const tTop = g.thermo.top('high');
    g.display = { x0: -168, x1: -20, y1: g.thermo.cap.y0 - 34 };
    g.display.y0 = g.display.y1 - 76;
    const ovX0 = g.cond.at(D.jacket0 + 150, 0).x;
    g.overlay = { x0: ovX0, x1: g.sink.x1, y0: tTop - 4, y1: Math.min(hoseTopY - 26, g.cond.at(D.jacket0 + 150, 0).y - 140) };

    // Szenengrenzen (alles, was immer sichtbar sein muss)
    const x0 = o.station ? g.station.x0 - 12 : g.stand1.base.x0 - 16;
    g.bounds = { x0, x1: g.sink.x1 + 44, y0: tTop - 12, y1: 34 }; // rechts Abstand zum Griffbereich der Trennlinie
    return g;
  }

  // ------------------------------------------------------------------ Sollverbindungen
  /** Punkte, die exakt zusammenfallen müssen (für Tests und Selbstprüfung). */
  function connections(g) {
    return [
      { name: 'Kolbenhals ↔ Destillationsaufsatz', a: P(g.neck.x, g.neck.y1), b: P(g.head.x, g.head.y0) },
      { name: 'Seitlicher Abgang ↔ Liebigkühler', a: g.arm.end, b: g.cond.c0 },
      { name: 'Liebigkühler ↔ Vorstoß', a: g.cond.c1, b: g.adapter.a0 },
      { name: 'Vorstoß-Bogen ↔ senkrechtes Stück', a: P(g.adapter.center.x + g.adapter.r, g.adapter.center.y), b: g.adapter.a2 },
      { name: 'Vorstoß-Spitze ↔ Hals der Vorlage (senkrecht darüber)', a: P(g.adapter.tip.x, 0), b: P(g.receiver.x, 0) },
      { name: 'Vorlage ↔ Laborboy', a: P(g.receiver.x, g.receiver.base), b: P(g.receiver.jack.x, g.receiver.jack.top) },
      { name: 'Heizpilz ↔ Laborboy', a: P(g.mantle.x, g.mantle.base), b: P(g.jack.x, g.jack.top) },
      { name: 'Laborboy ↔ Tisch', a: P(g.jack.x, g.jack.top + g.jack.h), b: P(g.jack.x, 0) },
      { name: 'Oberer Anschluss am Kühlmantel', a: g.nozzles.high.base, b: g.cond.at(DIM.nozzleHigh, DIM.jacketHW) },
      { name: 'Unterer Anschluss am Kühlmantel', a: g.nozzles.low.base, b: g.cond.at(DIM.nozzleLow, -DIM.jacketHW) },
      { name: 'Zulaufschlauch ↔ Laborarmatur', a: g.hoseRoutes.inlet('low')[0], b: g.tap.olive }
    ];
  }

  /** Prüft Lage-Bedingungen (Kolben im Heizpilz, Spitze im Hals, Teile über dem Tisch …). */
  function checks(g) {
    const r = [];
    const ok = (name, cond) => r.push({ name, ok: !!cond });
    ok('Kolben sitzt im Heizpilz', g.mantle.rim > g.flask.c.y - 1 && g.mantle.inner >= g.flask.R);
    ok('Tropfspitze ragt in den Hals der Vorlage', g.adapter.tip.y > g.receiver.rim && Math.abs(g.adapter.tip.x - g.receiver.x) < 1e-9);
    ok('Vorstoß-Spitze schmaler als Hals der Vorlage', g.adapter.hw * 0.6 < g.receiver.neckHW);
    ok('Laborboy unter dem Heizpilz hat positive Höhe', g.jack.h > 20);
    ok('Kühler fällt zum Vorstoß hin ab', g.cond.c1.y > g.cond.c0.y);
    ok('Zulauf unten, Ablauf oben', g.nozzles.low.base.y > g.nozzles.high.base.y);
    ok('Thermometerkugel (richtig) auf Höhe des Abgangs', Math.abs(g.thermo.bulb.correct - g.arm.o.y) < DIM.armHW + DIM.bulbLen);
    ok('Thermometerkugel (zu hoch) über dem Abgang, aber im Aufsatz', g.thermo.bulb.high + DIM.bulbLen / 2 < g.arm.o.y - DIM.armHW && g.thermo.bulb.high - DIM.bulbLen / 2 > g.head.y1);
    ok('Thermometerkugel (zu tief) im Kolbenhals', g.thermo.bulb.low > g.neck.y1 && g.thermo.bulb.low < g.neck.y0);
    ok('Einblendfläche liegt über dem Ablaufschlauch', g.overlay.y1 < g.hoseTopY);
    ok('Digitalanzeige links vom Thermometer', g.display.x1 < -g.thermo.hw);
    ok('Stativstange 1 endet unter der Digitalanzeige', g.stand1.top > g.display.y1);
    ok('Digitalanzeige über dem Aufsatz, unter dem Thermometer-Oberende', g.display.y1 < g.thermo.cap.y0 && g.display.y0 > g.thermo.top('high'));
    ok('Armatur am Ausguss, Ablauf rechts der Armatur', g.tap.x > g.sink.x0 && g.tap.x < g.sink.x1 && g.sink.drop.x > g.tap.x + 20);
    ok('Abgenommene Vorlage steht frei', g.station ? g.receiverAway.x + DIM.recvBaseHW < g.station.x1 && g.receiverAway.x - DIM.recvBaseHW > g.station.dish.x + 36 : g.receiverAway.x + DIM.recvBaseHW < g.receiver.jack.x - g.receiver.jack.w / 2);
    ok('Ausguss rechts der Vorlage', g.sink.x0 > g.receiver.x + g.receiver.jack.w / 2);
    if (g.station) ok('Prüfplatz getrennt links vom Stativ', g.station.x1 < g.stand1.base.x0 - 20);
    return r;
  }

  // ------------------------------------------------------------------ Bildschirmabbildung
  /** Gleichmäßige Skalierung der Szenengrenzen in eine Fläche w × h (CSS-Pixel). */
  /** padTop: oben freigehaltenes Band (CSS-Pixel) für Meldungen. */
  function fit(bounds, w, h, pad, padTop) {
    const p = pad == null ? 10 : pad;
    const top = Math.max(p, padTop || 0);
    const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
    const scale = Math.max(0.05, Math.min((w - 2 * p) / bw, (h - p - top) / bh));
    const ox = (w - bw * scale) / 2 - bounds.x0 * scale;
    const oy = top + (h - p - top - bh * scale) / 2 - bounds.y0 * scale;
    return { scale, ox, oy, w, h };
  }
  const toScreen = (v, pt) => P(pt.x * v.scale + v.ox, pt.y * v.scale + v.oy);
  const toWorld = (v, pt) => P((pt.x - v.ox) / v.scale, (pt.y - v.oy) / v.scale);

  /** Punkt einer kubischen Bézierkette (Punkte p0,c1,c2,p1[,c3,c4,p2]) zum Parameter u ∈ [0,1]. */
  function bezierPoint(pts, u) {
    if (pts.length === 4) return cubic(pts[0], pts[1], pts[2], pts[3], u);
    if (pts.length === 5) { // p0 c1 m c2 p1 → zwei Segmente über m
      const m = pts[2];
      return u < 0.5 ? cubic(pts[0], pts[1], pts[1], m, u * 2) : cubic(m, pts[3], pts[3], pts[4], (u - 0.5) * 2);
    }
    return pts[0];
  }
  function cubic(a, b, c, d, t) {
    const s = 1 - t;
    return P(s * s * s * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t * t * t * d.x, s * s * s * a.y + 3 * s * s * t * b.y + 3 * s * t * t * c.y + t * t * t * d.y);
  }

  // ------------------------------------------------------------------ Füllstände
  /** Höhe des Flüssigkeitsspiegels im Rundkolben (Kugelabschnitt + Hals) für V mL. */
  function flaskLevel(g, V) {
    const R = g.flask.R - DIM.glass;
    const cap = (h) => (Math.PI * h * h * (3 * R - h)) / 3 / 1000; // mm³ → mL
    const total = (4 / 3) * Math.PI * R * R * R / 1000;
    const v = Math.max(0, Math.min(V, total * 0.98));
    let lo = 0, hi = 2 * R;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (cap(m) < v) lo = m; else hi = m; }
    const hgt = (lo + hi) / 2;
    const y = g.flask.c.y + R - hgt;
    const half = Math.sqrt(Math.max(0, R * R - (y - g.flask.c.y) * (y - g.flask.c.y)));
    return { y, half, h: hgt };
  }
  /** Erlenmeyerkolben 100 mL: Spiegel aus dem Volumen (Kegelstumpf). */
  function receiverLevel(g, V) {
    const r = g.receiver;
    const gl = DIM.glass;
    const H = r.h - 34;                    // Höhe des konischen Teils bis zum Hals
    const r0 = r.baseHW - gl - 4, r1 = r.neckHW - gl;
    const volTo = (hh) => { const rr = r0 + (r1 - r0) * (hh / H); return (Math.PI * hh * (r0 * r0 + r0 * rr + rr * rr)) / 3 / 1000; };
    let lo = 0, hi = H;
    const v = Math.max(0, V);
    if (volTo(H) <= v) return { y: r.base - gl - H, half: r1, h: H, full: true };
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (volTo(m) < v) lo = m; else hi = m; }
    const hh = (lo + hi) / 2;
    return { y: r.base - gl - hh, half: r0 + (r1 - r0) * (hh / H) + 2, h: hh };
  }
  function receiverVolumeAt(g, hh) {
    const r = g.receiver; const gl = DIM.glass; const H = r.h - 34;
    const r0 = r.baseHW - gl - 4, r1 = r.neckHW - gl;
    const rr = r0 + (r1 - r0) * (hh / H);
    return (Math.PI * hh * (r0 * r0 + r0 * rr + rr * rr)) / 3 / 1000;
  }

  return { DIM, build, connections, checks, fit, toScreen, toWorld, bezierPoint, cubic, flaskLevel, receiverLevel, receiverVolumeAt, dist };
});
