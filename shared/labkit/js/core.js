/*
 * SiVex-Labkit – gemeinsame Grundfunktionen (ohne DOM, ohne Fachlogik)
 *
 * Mathematische Hilfen, feste Zeitschritte für reproduzierbare Simulationen,
 * Ereignisverteiler und die Prüfung eingetippter Fachbegriffe (Lückentexte).
 * Übernommen aus Trennlabor 1.0.0, Fassung B (apps/trennlabor/js/core.js).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.LK = root.LK || {}).core = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '0.1.0';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const round = (v, d) => { const k = Math.pow(10, d || 0); return Math.round(v * k) / k; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /** Zahl im deutschen Format. */
  function fmt(v, d) {
    if (v == null || !isFinite(v)) return '–';
    const dd = d == null ? 1 : d;
    return round(v, dd).toFixed(dd).replace('.', ',');
  }

  /** Zeit als m:ss. */
  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /**
   * Feste Simulationsschritte: Unabhängig von Bildrate und Zeitraffer wird das
   * Modell immer in Schritten von STEP Sekunden Modellzeit fortgeschrieben.
   * Damit verändern Pause und Zeitraffer nur die Geschwindigkeit, nie das Ergebnis.
   */
  const STEP = 0.05;
  function createClock(engine) {
    let carry = 0;
    return {
      /** Modellzeit (s) vorrücken; gibt die Zahl ausgeführter Schritte zurück. */
      advance(simSeconds) {
        carry += simSeconds;
        let n = 0;
        while (carry >= STEP - 1e-9) { engine.step(STEP); carry -= STEP; n++; }
        return n;
      },
      get carry() { return carry; },
      reset() { carry = 0; }
    };
  }

  // ------------------------------------------------------------ Texteingaben
  /** Normalisiert eine Eingabe: Groß-/Kleinschreibung, Umlaute, Leer- und Satzzeichen. */
  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[\s\-–_.,;:!?"'„“()]+/g, '');
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /**
   * Prüft eine Lücke.
   * gap: { accept: [Begriffe/Synonyme], forbid: [{term, hint}], hint }
   * Ergebnis: { status: 'empty'|'correct'|'typo'|'near'|'forbidden'|'wrong', feedback, canonical }
   *  - typo: ein Tippfehler in einem langen Wort – gilt als richtig, Schreibweise wird gezeigt
   *  - near: zwei Fehler – nicht akzeptiert, Hinweis auf die Schreibweise
   *  - forbidden: fachlich falscher, aber ähnlicher Begriff (z. B. Absorption statt Adsorption)
   */
  function checkGap(gap, input) {
    const v = norm(input);
    const canonical = gap.accept[0];
    if (!v) return { status: 'empty', feedback: 'Noch keine Eingabe.', canonical };
    for (const f of gap.forbid || []) {
      if (norm(f.term) === v) return { status: 'forbidden', feedback: f.hint, canonical };
    }
    const acc = gap.accept.map(norm);
    if (acc.includes(v)) return { status: 'correct', feedback: 'Richtig.', canonical };
    let best = 99;
    for (const a of acc) best = Math.min(best, levenshtein(a, v));
    const minLen = Math.min(...acc.map((a) => a.length));
    if (best === 1 && minLen >= 6) return { status: 'typo', feedback: `Richtig – achte auf die Schreibweise: „${canonical}“.`, canonical };
    if (best === 2 && minLen >= 7) return { status: 'near', feedback: 'Fast – prüfe die Schreibweise des Fachbegriffs.', canonical };
    return { status: 'wrong', feedback: gap.hint || 'Dieser Begriff passt hier nicht.', canonical };
  }
  const gapOk = (r) => r.status === 'correct' || r.status === 'typo';

  /** Dezimalzahl aus einer Eingabe (Komma oder Punkt). */
  function parseNum(s) {
    const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.').replace(/[^0-9.+-]/g, '');
    if (!t) return NaN;
    return Number(t);
  }

  /** Einfacher Ereignisverteiler. */
  function emitter() {
    const ls = {};
    return {
      on(ev, fn) { (ls[ev] = ls[ev] || []).push(fn); return () => { ls[ev] = ls[ev].filter((f) => f !== fn); }; },
      emit(ev, data) { (ls[ev] || []).slice().forEach((fn) => fn(data)); }
    };
  }

  return { VERSION, clamp, lerp, round, clone, easeInOut, fmt, fmtTime, STEP, createClock, norm, levenshtein, checkGap, gapOk, parseNum, emitter };
});
