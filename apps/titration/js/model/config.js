/*
 * Versuchskonfiguration: Grenzwerte, Eingabeprüfung, Zufallsprobe
 * --------------------------------------------------------------
 * Reine Logik ohne DOM – im Browser und in Node.js testbar.
 */
(function (global) {
  'use strict';

  const NS = (global.Titrierlabor = global.Titrierlabor || {});
  if (!NS.Chemistry && typeof require === 'function') require('./chemistry.js');
  const Chem = NS.Chemistry;

  const LIMITS = {
    cTitrant: { min: 0.01, max: 0.5, unit: 'mol/L', label: 'c(Maßlösung)' },
    cSample: { min: 0.01, max: 0.5, unit: 'mol/L', label: 'c(Probelösung)' },
    vSample: { min: 5, max: 50, unit: 'mL', label: 'V(Probelösung)' },
  };

  /** Fassungsvermögen der Bürette in mL */
  const BURETTE_CAPACITY = 50;

  /** Zielbereich des Äquivalenzvolumens für zufällige (unbekannte) Proben */
  const RANDOM_VEQ_RANGE = [12, 42];

  const DEFAULTS = {
    sampleType: 'acid',
    vSample: 25,
    cTitrant: 0.1,
    cSample: 0.1,
    concentrationMode: 'hidden', // 'hidden' = zufällig & unbekannt, 'given' = vorgegeben
    indicator: 'phenolphthalein',
    electrode: true,
    stirrer: true,
  };

  /**
   * Wandelt eine Benutzereingabe in eine Zahl um. Akzeptiert Dezimalkomma
   * und -punkt ("0,1", "0.1", " 25 "). Liefert NaN bei ungültiger Eingabe.
   */
  function parseDecimal(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
    if (typeof input !== 'string') return NaN;
    let s = input.trim().replace(/\s+/g, '');
    if (s === '') return NaN;
    // Tausendertrennzeichen werden nicht unterstützt: genau ein Dezimaltrenner
    if ((s.match(/[.,]/g) || []).length > 1) return NaN;
    s = s.replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  }

  /**
   * Prüft einen Einzelwert gegen die Grenzen.
   * @returns {{ok:boolean, value:number, message:string|null}}
   */
  function validateField(key, raw) {
    const lim = LIMITS[key];
    const value = parseDecimal(raw);
    if (Number.isNaN(value)) {
      return { ok: false, value: NaN, message: 'Bitte eine Zahl eingeben (z. B. ' + formatNumber(lim.min * 10, 2) + ').' };
    }
    if (value < lim.min || value > lim.max) {
      return {
        ok: false,
        value: value,
        message: 'Erlaubt: ' + formatNumber(lim.min, 2) + ' bis ' + formatNumber(lim.max, 2) + ' ' + lim.unit + '.',
      };
    }
    return { ok: true, value: value, message: null };
  }

  /**
   * Hinweise zur Durchführbarkeit (z. B. Äquivalenzpunkt außerhalb der Bürette).
   * @param {object} cfg vollständige numerische Konfiguration
   * @param {boolean} revealValues darf das Äquivalenzvolumen genannt werden?
   */
  function feasibilityWarnings(cfg, revealValues) {
    const out = [];
    const vEq = Chem.equivalenceVolume(cfg);
    const vText = revealValues ? ' (' + formatNumber(vEq, 2) + ' mL)' : '';
    if (vEq > BURETTE_CAPACITY) {
      out.push({
        level: 'error',
        text: 'Der theoretische Äquivalenzpunkt' + vText + ' liegt außerhalb des Bürettenbereichs von ' +
          BURETTE_CAPACITY + ' mL. Der Äquivalenzpunkt kann nicht erreicht werden – Maßlösung konzentrierter wählen oder weniger Probelösung vorlegen.',
      });
    } else if (vEq > 0.9 * BURETTE_CAPACITY) {
      out.push({
        level: 'warn',
        text: 'Der Äquivalenzpunkt' + vText + ' liegt sehr nahe am Ende der Bürettenskala.',
      });
    } else if (vEq < 2) {
      out.push({
        level: 'warn',
        text: 'Sehr kleiner Verbrauch' + vText + ': Der relative Ablesefehler wird groß. Eine verdünntere Maßlösung wäre günstiger.',
      });
    }
    return out;
  }

  function roundSig(x, digits) {
    if (x === 0) return 0;
    const p = Math.pow(10, digits - Math.ceil(Math.log10(Math.abs(x))));
    return Math.round(x * p) / p;
  }

  /**
   * Erzeugt eine zufällige, plausible Probenkonzentration, deren
   * Äquivalenzvolumen möglichst im Bereich RANDOM_VEQ_RANGE liegt.
   * @param {number} cTitrant
   * @param {number} vSample
   * @param {() => number} [rng=Math.random]
   */
  function randomSampleConcentration(cTitrant, vSample, rng) {
    const r = typeof rng === 'function' ? rng() : Math.random();
    const vEq = RANDOM_VEQ_RANGE[0] + r * (RANDOM_VEQ_RANGE[1] - RANDOM_VEQ_RANGE[0]);
    let c = roundSig((cTitrant * vEq) / vSample, 4);
    c = Math.min(LIMITS.cSample.max, Math.max(LIMITS.cSample.min, c));
    return c;
  }

  /** Deutsche Zahlformatierung mit fester Nachkommastellenzahl */
  function formatNumber(x, digits) {
    if (!Number.isFinite(x)) return '–';
    const s = x.toFixed(digits === undefined ? 2 : digits);
    return s.replace('-', '−').replace('.', ',');
  }

  const api = {
    LIMITS: LIMITS,
    DEFAULTS: DEFAULTS,
    BURETTE_CAPACITY: BURETTE_CAPACITY,
    RANDOM_VEQ_RANGE: RANDOM_VEQ_RANGE,
    parseDecimal: parseDecimal,
    validateField: validateField,
    feasibilityWarnings: feasibilityWarnings,
    randomSampleConcentration: randomSampleConcentration,
    formatNumber: formatNumber,
    roundSig: roundSig,
  };

  NS.Config = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
