const test = require('node:test');
const assert = require('node:assert/strict');
const Eval = require('../../js/model/evaluation.js');
const Ind = require('../../js/model/indicators.js');

const base = { cTitrant: 0.1, vSample: 25, vUsed: 24.9, cStudent: 0.0996, cTrue: 0.1, vEquivalence: 25 };

test('richtige Rechnung mit kleinem Ablesefehler: „Sehr genau“', () => {
  const r = Eval.evaluate(base);
  assert.equal(r.calculationCorrect, true);
  assert.equal(r.rating.key, 'excellent');
});

test('Einheitenfehler (Faktor 1000) wird erkannt', () => {
  const r = Eval.evaluate(Object.assign({}, base, { cStudent: 99.6 }));
  assert.equal(r.calculationCorrect, false);
  assert.ok(r.hints.some((h) => h.includes('Faktor 1000')));
});

test('vertauschte Volumina werden erkannt', () => {
  // V(Maß) = 20 mL: richtig 0,08 mol/L, vertauscht 0,125 mol/L
  const r = Eval.evaluate(Object.assign({}, base, { vUsed: 20, vEquivalence: 20, cTrue: 0.08, cStudent: 0.125 }));
  assert.ok(r.hints.some((h) => h.includes('vertauscht')));
});

test('deutliche Übertitration wird schlecht bewertet', () => {
  const r = Eval.evaluate(Object.assign({}, base, { vUsed: 27, cStudent: 0.108 }));
  assert.equal(r.rating.key, 'poor');
});

test('Indikator: Anteil der Basenform am pKs = 50 %, Umschlagsbereiche', () => {
  const ph = Ind.get('phenolphthalein');
  assert.ok(Math.abs(Ind.baseFraction('phenolphthalein', ph.pKa) - 0.5) < 1e-9);
  assert.deepEqual(Ind.get('bromothymolBlue').range, [6.0, 7.6]);
  assert.deepEqual(Ind.get('methylOrange').range, [3.1, 4.4]);
  assert.equal(Ind.get('none').range, null);
  assert.equal(Ind.list().length, 4);
});
