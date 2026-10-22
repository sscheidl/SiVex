'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../js/answers.js');

const ADS = { accept: ['Adsorption', 'Adsorbtion'], wrong: [{ terms: ['Absorption', 'Absorbtion'], hint: 'Absorption bedeutet Aufnahme ins Innere.' }] };

test('L-03 Normalisierung: Groß-/Kleinschreibung, Umlaute, ß, Satzzeichen', () => {
  assert.equal(A.normalize(' Rückstand! '), 'rueckstand');
  assert.equal(A.normalize('RUECKSTAND'), 'rueckstand');
  assert.equal(A.normalize('Gemisch-Stoff'), 'gemischstoff');
  assert.equal(A.normalize('Maß'), 'mass');
});

test('L-03 Lücke: exakte Treffer, Synonyme, Umlaut-Umschreibung', () => {
  const g = { accept: ['Rückstand', 'Filterrückstand'] };
  assert.equal(A.checkGap(g, 'rückstand').status, 'correct');
  assert.equal(A.checkGap(g, 'Rueckstand').status, 'correct');
  assert.equal(A.checkGap(g, 'Filterrückstand').status, 'correct');
  assert.equal(A.checkGap(g, '').status, 'empty');
});

test('L-03 Lücke: kleine Tippfehler werden toleriert, aber als Schreibweise markiert', () => {
  const g = { accept: ['Sedimentieren', 'Sedimentation'] };
  assert.equal(A.checkGap(g, 'Sedimentiren').status, 'typo');
  assert.equal(A.checkGap(g, 'Sedimnetieren').status, 'typo'); // Vertauschung
  assert.equal(A.checkGap({ accept: ['Filtrat'] }, 'Filtart').status, 'typo');
});

test('L-03 Adsorption: Absorption wird immer abgelehnt, auch bei nur einem Buchstaben Abstand', () => {
  assert.equal(A.checkGap(ADS, 'Adsorption').status, 'correct');
  assert.equal(A.checkGap(ADS, 'adsorbtion').status, 'correct', 'Schreibvariante als Synonym hinterlegt');
  assert.equal(A.checkGap(ADS, 'Adsorbtionn').status, 'typo');
  // Gleich weit von richtigem und gesperrtem Begriff → im Zweifel abgelehnt
  assert.equal(A.checkGap({ accept: ['Adsorption'], wrong: [{ terms: ['Absorbtion'] }] }, 'adsorbtion').status, 'wrong');
  const r = A.checkGap(ADS, 'Absorption');
  assert.equal(r.status, 'wrong');
  assert.match(r.hint, /Inneren|Innere/);
  assert.equal(A.checkGap(ADS, 'Absorbtion').status, 'wrong');
  assert.equal(A.checkGap(ADS, 'absorbtion').status, 'wrong');
});

test('L-03 Fachlich falsche Begriffe werden nicht über Tippfehler-Toleranz akzeptiert', () => {
  const g = { accept: ['Filtrat'], wrong: [{ terms: ['Rückstand'], hint: 'x' }] };
  assert.equal(A.checkGap(g, 'Rückstand').status, 'wrong');
  assert.equal(A.checkGap({ accept: ['löslich'], wrong: [{ terms: ['unlöslich'] }] }, 'unlöslich').status, 'wrong');
  assert.equal(A.checkGap({ accept: ['Dichte'] }, 'Masse').status, 'wrong');
});

test('Zahlen mit Komma und Punkt', () => {
  assert.equal(A.parseNumber('84,3'), 84.3);
  assert.equal(A.parseNumber('84.3 °C'), 84.3);
  assert.equal(A.parseNumber('0,62'), 0.62);
  assert.equal(A.parseNumber('abc'), null);
  assert.equal(A.parseNumber(''), null);
});
