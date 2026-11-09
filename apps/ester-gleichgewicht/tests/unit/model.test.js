// Unit-Tests der Ester-Kinetik (ohne DOM). Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../js/model.js');

const run = (m, days, step) => { for (let t = 0; t < days - 1e-9; t += step) m.advance(step); };

test('Synthese: Gleichgewicht bei 0,33/0,33/0,67/0,67 mol, Q → K = 4, erreicht nach etwa 10 Tagen', () => {
  const m = M.createModel({ preset: 'synthese' });
  run(m, 30, 0.05);
  const n = m.state.n;
  assert.ok(Math.abs(n[0] - 1 / 3) < 0.005 && Math.abs(n[2] - 2 / 3) < 0.005, `n = ${n.map((v) => v.toFixed(3))}`);
  assert.ok(Math.abs(m.Q - 4) < 0.05);
  assert.ok(m.state.eqTime != null && m.state.eqTime > 5 && m.state.eqTime < 16, `eqTime ${m.state.eqTime}`);
});

test('Hydrolyse läuft auf dasselbe Gleichgewicht zu', () => {
  const m = M.createModel({ preset: 'hydrolyse' });
  run(m, 40, 0.05);
  assert.ok(Math.abs(m.state.n[0] - 1 / 3) < 0.005 && Math.abs(m.state.n[2] - 2 / 3) < 0.005);
});

test('Stoffbilanz: n(S)+n(E) und n(A)+n(W) bleiben erhalten; Werte nie negativ', () => {
  const m = M.createModel({ preset: 'synthese' });
  run(m, 20, 0.1);
  const n = m.state.n;
  assert.ok(Math.abs(n[0] + n[2] - 1) < 1e-9 && Math.abs(n[1] + n[3] - 1) < 1e-9);
  assert.ok(n.every((v) => v >= 0));
});

test('Katalysator: dasselbe Gleichgewicht, viel schneller (Stunden statt Tage)', () => {
  const a = M.createModel({ preset: 'synthese' }), b = M.createModel({ preset: 'synthese', catalyst: true });
  run(a, 0.5, 0.01); run(b, 0.5, 0.01);
  assert.ok(b.state.n[2] > 0.6 && a.state.n[2] < 0.4, `mit Kat ${b.state.n[2].toFixed(2)}, ohne ${a.state.n[2].toFixed(2)}`);
  assert.equal(b.timeUnit, 'h');
  assert.ok(Math.abs(b.tDisplay - 12) < 1e-9);
  run(b, 2, 0.01);
  assert.ok(Math.abs(b.Q - 4) < 0.05);
});

test('equilibrium(): analytische Lösung stimmt mit der Simulation überein, auch bei gemischtem Start', () => {
  const m = M.createModel({ preset: 'gemischt' });
  const eq = m.equilibrium();
  assert.ok(Math.abs((eq[2] * eq[3]) / (eq[0] * eq[1]) - 4) < 1e-9);
  run(m, 40, 0.05);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(m.state.n[i] - eq[i]) < 0.005);
});

test('Neustart mit eigenen Mengen, Katalysator-Marke', () => {
  const m = M.createModel();
  m.reset(null, [0.8, 0.2, 0, 0.5]);
  assert.deepEqual(m.state.n, [0.8, 0.2, 0, 0.5]);
  assert.equal(m.state.preset, 'eigen');
  m.advance(1);
  m.setCatalyst(true);
  assert.equal(m.state.marks.length, 1);
  m.setCatalyst(true);
  assert.equal(m.state.marks.length, 1);
});
