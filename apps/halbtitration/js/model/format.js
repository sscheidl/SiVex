/*
 * Zahlen lesen und schreiben (deutsche Schreibweise)
 * -------------------------------------------------
 * parseQuantity akzeptiert Dezimalkomma oder -punkt, Leerzeichen,
 * ein Vorzeichen (+, −, -) und passende Einheiten. Volumina werden in mL
 * zurückgegeben („0,012 L“ → 12 mL).
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});

  const VOLUME_UNITS = { ml: 1, 'cm³': 1, cm3: 1, l: 1000 };

  /**
   * @param {string|number} input
   * @param {'mL'|null} [unit] erwartete Einheit; null = einheitenlos (pH, pK)
   * @returns {{ok:boolean, value:number, empty:boolean, message:string|null}}
   */
  function parseQuantity(input, unit) {
    if (typeof input === 'number') {
      return Number.isFinite(input) ? { ok: true, value: input, empty: false, message: null } : invalid('Bitte eine Zahl eingeben.');
    }
    let s = String(input === undefined || input === null ? '' : input).trim();
    if (s === '') return { ok: false, value: NaN, empty: true, message: 'Noch keine Eingabe.' };
    s = s.replace(/−/g, '-').replace(/\s+/g, '');
    let factor = 1;
    const m = /^([+-]?[0-9.,]+(?:e[+-]?\d+)?)([a-zA-Z³0-9]*)$/i.exec(s);
    if (!m) return invalid('Bitte nur eine Zahl' + (unit ? ' mit Einheit mL' : '') + ' eingeben (z. B. ' + (unit ? '12,50 mL' : '4,76') + ').');
    const num = m[1];
    const u = m[2].toLowerCase();
    if (u) {
      if (unit === 'mL' && Object.prototype.hasOwnProperty.call(VOLUME_UNITS, u)) factor = VOLUME_UNITS[u];
      else if (unit === 'mL') return invalid('Unbekannte Einheit „' + m[2] + '“. Erwartet wird ein Volumen in mL.');
      else return invalid('Hier wird eine Zahl ohne Einheit erwartet (pH- und pK-Werte sind einheitenlos).');
    }
    if ((num.match(/[.,]/g) || []).length > 1) return invalid('Bitte genau ein Dezimaltrennzeichen verwenden.');
    const v = Number(num.replace(',', '.'));
    if (!Number.isFinite(v)) return invalid('Bitte eine Zahl eingeben.');
    return { ok: true, value: v * factor, empty: false, message: null };
  }

  function invalid(message) {
    return { ok: false, value: NaN, empty: false, message: message };
  }

  /** Feste Nachkommastellen, Dezimalkomma, echtes Minuszeichen */
  function fmt(x, digits) {
    if (!Number.isFinite(x)) return '–';
    const d = digits === undefined ? 2 : digits;
    let s = x.toFixed(d);
    if (/^-0[.,]?0*$/.test(s)) s = s.slice(1);
    return s.replace('-', '−').replace('.', ',');
  }

  /** Mit Vorzeichen (+/−) */
  function signed(x, digits) {
    if (!Number.isFinite(x)) return '–';
    const s = fmt(x, digits);
    return x > 0 && s.replace(/[0,]/g, '') !== '' ? '+' + s : s;
  }

  const api = { parseQuantity: parseQuantity, fmt: fmt, signed: signed };
  NS.Format = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
