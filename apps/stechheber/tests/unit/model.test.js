// Unit-Tests des Stechheber-Modells (ohne DOM). Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../js/model.js');

test('Standardwerte: K = (d_a/d_b)² ≈ 2,04, Gesamtmenge bleibt exakt erhalten', () => {
  const m = M.createModel();
  assert.ok(Math.abs(m.K - (10 / 7) ** 2) < 1e-12);
  const T = m.total;
  for (let i = 0; i < 60; i++) m.cycle();
  assert.ok(Math.abs(m.total - T) < 1e-9);
  assert.equal(m.state.cycle, 60);
  assert.equal(m.state.history.length, 61);
});

test('Gleichgewicht wird erkannt und entspricht V_B/V_A = K, unabhängig von der Startseite', () => {
  for (const [VA, VB] of [[80, 0], [0, 80], [40, 40], [50, 50]]) {
    const m = M.createModel({ VA, VB });
    for (let i = 0; i < 80 && m.state.eqCycle == null; i++) m.cycle();
    assert.ok(m.state.eqCycle != null && m.state.eqCycle <= 40, `Gleichgewicht bei Start ${VA}/${VB} nach ≤ 40 Zyklen`);
    assert.ok(Math.abs(m.Q - m.K) < 0.02, `Q ≈ K bei Start ${VA}/${VB}`);
    const eq = m.equilibrium();
    assert.ok(Math.abs(m.state.VA - eq.VA) < 0.5 && Math.abs(m.state.VB - eq.VB) < 0.5);
  }
});

test('Im Gleichgewicht sind Hin- und Rückübertragung gleich groß, aber nicht null (dynamisch)', () => {
  const m = M.createModel();
  for (let i = 0; i < 60; i++) m.cycle();
  const r = m.cycle();
  assert.ok(r.a2b > 1, 'es wird weiter übertragen');
  assert.ok(Math.abs(r.a2b - r.b2a) < 0.05);
});

test('Erster Zyklus: Rohr a bringt f_a·V_A nach B, Rohr b nichts', () => {
  const m = M.createModel();
  const r = m.cycle();
  assert.ok(Math.abs(r.a2b - 0.16 * 80) < 1e-12);
  assert.equal(r.b2a, 0);
  assert.ok(Math.abs(m.state.VB - 12.8) < 1e-12);
});

test('Rohre: Grenzen und Begrenzung von f_a + f_b, Änderung hebt den Gleichgewichtszustand auf', () => {
  const m = M.createModel();
  m.setTubes(12, 12);
  assert.ok(m.fA + m.fB <= M.LIMITS.fSumMax + 1e-9);
  m.setTubes(1, 1);
  assert.equal(m.state.dA, M.LIMITS.dMin);
  const m2 = M.createModel();
  for (let i = 0; i < 60; i++) m2.cycle();
  assert.ok(m2.state.eqCycle != null);
  m2.setTubes(8, null);
  assert.equal(m2.state.eqCycle, null);
  for (let i = 0; i < 60; i++) m2.cycle();
  assert.ok(Math.abs(m2.Q - m2.K) < 0.02, 'neues Gleichgewicht mit neuem K');
});

test('Neustart: Startvolumina 0…100 mL, Verlauf leer', () => {
  const m = M.createModel();
  m.cycle(); m.cycle();
  m.reset(150, -5);
  assert.equal(m.state.VA, 100);
  assert.equal(m.state.VB, 0);
  assert.equal(m.state.cycle, 0);
  assert.deepEqual(m.state.history, [[0, 100, 0]]);
});

test('Startvolumina zusammen höchstens das Fassungsvermögen (100 mL)', () => {
  const m = M.createModel();
  m.reset(80, 60);
  assert.equal(m.state.VA + m.state.VB, M.LIMITS.capacity);
  assert.equal(m.state.VA, 80);
});
