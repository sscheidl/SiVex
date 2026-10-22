/*
 * Trennlabor – Prüfung von Lückentexten und Messwerten (ohne KI, ohne Netz)
 *
 * Eingaben werden normalisiert (Groß-/Kleinschreibung, Umlaute, ß, Leer- und
 * Satzzeichen). Akzeptiert werden festgelegte Begriffe und Synonyme sowie
 * kleine Tippfehler. Fachlich falsche Begriffe, die einem richtigen ähneln
 * (z. B. „Absorption“ statt „Adsorption“), stehen in einer Sperrliste und
 * werden immer abgelehnt – auch wenn sie nur einen Buchstaben abweichen.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).answers = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFC')
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /** Damerau-Levenshtein-Abstand (Vertauschung zweier Nachbarbuchstaben zählt 1). */
  function distance(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[m][n];
  }

  /** Erlaubte Tippfehler je nach Wortlänge. */
  const tolerance = (len) => (len >= 10 ? 2 : len >= 5 ? 1 : 0);

  /**
   * Prüft eine Lücke.
   * gap: { accept: [...], wrong: [{terms:[...], hint}], hint }
   * Ergebnis: { status: 'empty'|'correct'|'typo'|'wrong', canonical, hint }
   */
  function checkGap(gap, input) {
    const n = normalize(input);
    if (!n) return { status: 'empty', hint: '' };
    const canonical = gap.accept[0];
    // 1. Sperrliste hat Vorrang (fachlich falsche, aber ähnliche Begriffe)
    for (const w of gap.wrong || []) {
      for (const t of w.terms) if (normalize(t) === n) return { status: 'wrong', canonical, hint: w.hint || gap.hint || '' };
    }
    // 2. exakte Treffer (inkl. Synonyme)
    for (const a of gap.accept) if (normalize(a) === n) return { status: 'correct', canonical };
    // 3. Tippfehler – nur wenn die Eingabe keinem gesperrten Begriff mindestens ebenso nahe ist
    let best = Infinity;
    for (const a of gap.accept) {
      const na = normalize(a);
      const d = distance(n, na);
      if (d <= tolerance(na.length) && d < best) best = d;
    }
    if (best < Infinity) {
      let nearWrong = Infinity;
      for (const w of gap.wrong || []) for (const t of w.terms) nearWrong = Math.min(nearWrong, distance(n, normalize(t)));
      if (nearWrong > best) return { status: 'typo', canonical };
      const w = (gap.wrong || []).find((x) => x.terms.some((t) => distance(n, normalize(t)) === nearWrong));
      return { status: 'wrong', canonical, hint: (w && w.hint) || gap.hint || '' };
    }
    return { status: 'wrong', canonical, hint: gap.hint || '' };
  }

  /** Liest eine Zahl mit Komma oder Punkt; null, wenn keine Zahl. */
  function parseNumber(s) {
    const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.').replace(/[^0-9.+-]/g, '');
    if (!t || !/^[+-]?\d*\.?\d+$/.test(t)) return null;
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  }

  return { normalize, distance, checkGap, parseNumber };
});
