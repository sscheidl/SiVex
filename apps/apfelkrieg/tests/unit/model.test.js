// Unit-Tests des Apfelkrieg-Modells (ohne DOM). Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../js/model.js');

test('Zufallsgenerator: gleicher Startwert, gleiche Folge; Werte in [0,1)', () => {
  const a = M.rng(42), b = M.rng(42);
  for (let i = 0; i < 100; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
});

test('Apfelzahl bleibt erhalten; Zeit läuft in Schritten von 0,5 s', () => {
  const m = M.createModel();
  for (let i = 0; i < 400; i++) m.tick();
  assert.equal(m.total, 18);
  assert.equal(m.state.t, 200);
  assert.equal(m.state.history.length, 401);
});

test('Gleichgewicht im Mittel bei K = p_enkel/p_opa = 2 (12 : 6), von jeder Startseite', () => {
  for (const [o, e] of [[9, 9], [18, 0], [0, 18]]) {
    const m = M.createModel({ nOpa: o, nEnkel: e, seed: 7 });
    let sum = 0, n = 0;
    for (let i = 0; i < 2400; i++) { m.tick(); if (m.state.t > 100) { sum += m.state.nOpa; n++; } }
    const mean = sum / n;
    assert.ok(Math.abs(mean - 12) < 0.6, `Mittelwert N_opa ≈ 12 bei Start ${o}/${e}, war ${mean.toFixed(2)}`);
  }
});

test('Im Gleichgewicht sind die Wurfraten beider Richtungen im Mittel gleich und größer als null', () => {
  const m = M.createModel({ seed: 3 });
  let e = 0, o = 0;
  for (let i = 0; i < 4000; i++) { const r = m.tick(); if (m.state.t > 100) { e += r.toEnkel; o += r.toOpa; } }
  assert.ok(e > 500 && o > 500);
  assert.ok(Math.abs(e - o) / e < 0.08, `Würfe hin ${e}, zurück ${o}`);
  const r = m.rates();
  assert.ok(r.toEnkel >= 0 && r.toOpa >= 0 && r.window === 10);
});

test('„Eingependelt“ wird erkannt; K und Q; Wurfraten mit Grenzen', () => {
  const m = M.createModel({ seed: 11 });
  for (let i = 0; i < 400 && m.state.eqTime == null; i++) m.tick();
  assert.ok(m.state.eqTime != null && m.state.eqTime >= 40 && m.state.eqTime <= 200);
  assert.equal(m.K, 2);
  assert.ok(isFinite(m.Q));
  m.setRates(0.5, 0.001);
  assert.equal(m.state.pOpa, M.LIMITS.pMax);
  assert.equal(m.state.pEnkel, M.LIMITS.pMin);
  assert.equal(m.state.eqTime, null);
});

test('Neustart: Grenzen der Apfelzahl, derselbe Startwert liefert denselben Lauf, neuer Startwert einen anderen', () => {
  const m = M.createModel();
  m.reset(100, -3);
  assert.equal(m.state.nOpa, M.LIMITS.nMax);
  assert.equal(m.state.nEnkel, 0);
  const a = M.createModel({ seed: 5 }), b = M.createModel({ seed: 5 });
  for (let i = 0; i < 50; i++) { a.tick(); b.tick(); }
  assert.deepEqual(a.state.history, b.state.history);
  b.reset(null, null, true);
  for (let i = 0; i < 50; i++) b.tick();
  assert.notDeepEqual(a.state.history, b.state.history);
});
