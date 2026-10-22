/*
 * Trennlabor – gemeinsame Hilfsfunktionen (ohne DOM)
 * Läuft im Browser (Namensraum TL) und in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).util = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /** Lineare Interpolation in einer sortierten Tabelle [[x, y], …]; außerhalb: Randwerte. */
  function interp(table, x) {
    if (x <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      if (x <= table[i][0]) {
        const [x0, y0] = table[i - 1], [x1, y1] = table[i];
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
      }
    }
    return table[table.length - 1][1];
  }

  /** Reproduzierbarer Zufallsgenerator (LCG). */
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));

  /** Zahl mit deutschem Dezimalkomma. */
  function fmt(v, digits) {
    const d = digits == null ? 1 : digits;
    if (!Number.isFinite(v)) return '–';
    const r = Math.abs(v) < Math.pow(10, -d) / 2 ? 0 : v;
    return r.toFixed(d).replace('.', ',');
  }

  /**
   * Feste Zeitschritte: Die Simulation rechnet unabhängig von Bildrate und
   * Zeitraffer immer in Schritten der Länge h. So hängt das Ergebnis nur von
   * der simulierten Zeit ab, nicht davon, wie schnell sie abläuft (A-04).
   */
  function stepper(h, step) {
    let acc = 0;
    return {
      advance(dt) {
        acc += Math.max(0, dt);
        let n = 0;
        while (acc >= h - 1e-9) { acc -= h; step(h); n++; }
        return n;
      },
      reset() { acc = 0; },
      get pending() { return acc; }
    };
  }

  /** Einfacher Ereignisverteiler. */
  function emitter() {
    const ls = {};
    return {
      on(ev, fn) { (ls[ev] = ls[ev] || []).push(fn); return () => { ls[ev] = ls[ev].filter((f) => f !== fn); }; },
      emit(ev, data) { (ls[ev] || []).slice().forEach((fn) => fn(data)); }
    };
  }

  return { clamp, lerp, smooth, interp, rng, clone, fmt, stepper, emitter };
});
