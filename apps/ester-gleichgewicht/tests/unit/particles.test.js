// Unit-Tests der Teilchenebene (ohne DOM). Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../js/particles.js');

test('40 Teilchen aus 1 mol + 1 mol; Teilchenzahl bleibt konstant; Sortenbilanz erhalten', () => {
  const sys = P.createSystem(5);
  sys.init([1, 1, 0, 0]);
  assert.equal(sys.state.parts.length, 40);
  for (let i = 0; i < 6000; i++) sys.advance(0.05);
  const c = sys.counts();
  assert.equal(c.reduce((a, b) => a + b, 0), 40);
  assert.equal(c[0] + c[2], 20);
  assert.equal(c[1] + c[3], 20);
  assert.ok(sys.state.parts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
});

test('Im Mittel stellt sich etwa 7 : 13 ein (Q um 4), Hin- und Rückstöße gleich häufig', () => {
  const sys = P.createSystem(9);
  sys.init([1, 1, 0, 0]);
  let sumE = 0, n = 0, hin = 0, rueck = 0;
  for (let i = 0; i < 40000; i++) {
    sys.advance(0.05);
    if (sys.state.t > 200) { sumE += sys.counts()[2]; n++; }
  }
  for (const e of sys.state.log) { if (e[1] > 0) hin++; else rueck++; }
  const meanE = sumE / n;
  assert.ok(meanE > 11.5 && meanE < 14.5, `Mittel Ester ${meanE.toFixed(2)}`);
  assert.ok(hin > 20 && rueck > 20 && Math.abs(hin - rueck) <= Math.max(6, 0.2 * hin), `hin ${hin}, rück ${rueck}`);
});

test('Katalysator beschleunigt die Ereignisse, Hydrolyse-Start führt zu denselben Zahlen', () => {
  const a = P.createSystem(3), b = P.createSystem(3);
  a.init([1, 1, 0, 0]); b.init([1, 1, 0, 0]); b.state.catalyst = true;
  for (let i = 0; i < 400; i++) { a.advance(0.05); b.advance(0.05); }
  assert.ok(b.state.log.length > a.state.log.length);
  const h = P.createSystem(4);
  h.init([0, 0, 1, 1]);
  let sum = 0, n = 0;
  for (let i = 0; i < 30000; i++) { h.advance(0.05); if (h.state.t > 200) { sum += h.counts()[2]; n++; } }
  assert.ok(sum / n > 11 && sum / n < 15, `Mittel Ester bei Hydrolyse ${(sum / n).toFixed(2)}`);
});
