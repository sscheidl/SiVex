'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const redox = require('../../js/redox.js');

test('Formelparser', () => {
  assert.deepEqual(redox.parseFormula('[Ag(NH3)2]+'), { atoms: { Ag: 1, N: 2, H: 6 }, charge: 1 });
  assert.deepEqual(redox.parseFormula('Cu2+'), { atoms: { Cu: 1 }, charge: 2 });
  assert.deepEqual(redox.parseFormula('Cu2O'), { atoms: { Cu: 2, O: 1 }, charge: 0 });
  assert.deepEqual(redox.parseFormula('R-COOH'), { atoms: { R: 1, C: 1, O: 2, H: 1 }, charge: 0 });
  assert.deepEqual(redox.parseFormula('OH-'), { atoms: { O: 1, H: 1 }, charge: -1 });
  assert.deepEqual(redox.parseFormula('e-'), { atoms: {}, charge: -1 });
});

test('C-10: Alle Teil- und Gesamtgleichungen sind atomar und ladungsmäßig ausgeglichen', () => {
  for (const test of ['fehling', 'tollens']) {
    for (const kind of ['oxidation', 'reduction', 'total']) {
      const b = redox.balance(redox.EQUATIONS[test][kind]);
      assert.ok(b.ok, `${test}/${kind}: ${JSON.stringify(b.diff)} Ladung ${b.left.charge}/${b.right.charge}`);
    }
  }
});

test('C-10: Gesamtgleichung = Oxidation + Reduktion (Elektronen gekürzt)', () => {
  for (const test of ['fehling', 'tollens']) {
    const E = redox.EQUATIONS[test];
    const sum = {};
    const addSide = (list, sign) => list.forEach(({ n, f }) => { sum[f] = (sum[f] || 0) + sign * n; });
    addSide(E.oxidation.left, 1); addSide(E.reduction.left, 1);
    addSide(E.oxidation.right, -1); addSide(E.reduction.right, -1);
    addSide(E.total.left, -1); addSide(E.total.right, 1);
    for (const k in sum) assert.equal(sum[k], 0, `${test}: ${k}`);
  }
});

test('Die Elektronenbilanz der Teilgleichungen stimmt überein', () => {
  for (const test of ['fehling', 'tollens']) {
    const E = redox.EQUATIONS[test];
    const eOx = E.oxidation.right.find((p) => p.f === 'e-').n;
    const eRed = E.reduction.left.find((p) => p.f === 'e-').n;
    assert.equal(eOx, eRed);
  }
});

test('C-11: schulische –COOH-Darstellung, kein Carboxylat in den Gleichungen', () => {
  for (const test of ['fehling', 'tollens']) {
    for (const kind of ['oxidation', 'total']) {
      const eq = redox.EQUATIONS[test][kind];
      assert.ok(eq.right.some((p) => p.f === 'R-COOH'));
      assert.ok(![...eq.left, ...eq.right].some((p) => /COO-$/.test(p.f)));
    }
  }
  assert.match(redox.COOH_NOTE, /Carboxylat/);
});

test('Trainer-Musterlösungen ergeben exakt die geprüften Gleichungen', () => {
  for (const test of ['fehling', 'tollens']) {
    const tr = redox.buildTrainer(test);
    assert.equal(tr.steps.length, 6);
    assert.deepEqual(tr.steps.map((s) => s.id), ['assign', 'oxnum', 'electrons', 'balanceE', 'halves', 'total']);
    const ox = redox.trainerEquation(tr, 'halves', 0);
    const red = redox.trainerEquation(tr, 'halves', 1);
    const tot = redox.trainerEquation(tr, 'total', 0);
    assert.deepEqual(ox, redox.EQUATIONS[test].oxidation);
    assert.deepEqual(red, redox.EQUATIONS[test].reduction);
    assert.deepEqual(tot, redox.EQUATIONS[test].total);
    for (const s of tr.steps) {
      assert.equal(s.hints.length, 3, 'drei gestufte Tipps je Schritt');
      const right = Object.fromEntries(redox.fieldsOf(s).map((f) => [f.id, f.answer]));
      assert.ok(redox.checkStep(s, right).allCorrect);
      assert.equal(redox.checkStep(s, {}).allCorrect, false);
      for (const f of redox.fieldsOf(s)) assert.ok(f.options.includes(f.answer), `${test}/${s.id}/${f.id}: Lösung ist auswählbar`);
    }
  }
});

test('Oxidationszahlen im Trainer sind fachlich korrekt', () => {
  const f = redox.buildTrainer('fehling').steps[1].fields;
  const t = redox.buildTrainer('tollens').steps[1].fields;
  const get = (fs, id) => fs.find((x) => x.id === id).answer;
  assert.equal(get(f, 'c1'), '+I');
  assert.equal(get(f, 'c2'), '+III');
  assert.equal(get(f, 'm1'), '+II');
  assert.equal(get(f, 'm2'), '+I');
  assert.equal(get(t, 'm1'), '+I');
  assert.equal(get(t, 'm2'), '0');
});
