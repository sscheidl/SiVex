// Unit-Tests der gemeinsamen Teilchen-Engine: Teilchenzahl und -größe bleiben
// erhalten; fest, flüssig und gasförmig sind allein an Anordnung und Bewegung
// unterscheidbar (Kennzahlen statt Augenmaß); Übergänge in beide Richtungen.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../js/substances.js');
const M = require('../../js/model.js');
const PS = require('../../js/particles.js');

function rig(id, T, seed) {
  const m = M.createModel({ sub: id, Tset: T });
  const sys = PS.createSystem(S.SUBSTANCES[id], seed || 3);
  const env = () => ({ shares: m.shares(), T: m.state.Tview, coldVis: m.state.coldVis });
  sys.init(env());
  const run = (Tn, sec) => { if (Tn != null) m.setTemp(Tn); for (let i = 0; i < Math.round(sec * 60); i++) { m.advance(1 / 60); sys.advance(1 / 60, env()); } };
  return { m, sys, run };
}
/** Mittel der Kennzahlen über einige Zeitpunkte (Bewegung statt Momentaufnahme). */
function avgMetrics(r, sec) {
  const acc = { speed: 0, nn: 0, slotDev: 0, ySpan: 0, yTop: 0, n: 0 };
  for (let k = 0; k < 6; k++) {
    r.run(null, sec / 6);
    const x = r.sys.metrics();
    const ph = Object.keys(x.speed)[0];
    acc.speed += x.speed[ph]; acc.nn += x.nn[ph]; acc.slotDev += x.slotDev; acc.ySpan += x.yMax[ph] - x.yMin[ph]; acc.yTop += x.yMin[ph]; acc.n++;
  }
  for (const k of Object.keys(acc)) if (k !== 'n') acc[k] /= acc.n;
  return acc;
}

test('eine Engine für alle Stoffe: 48 Teilchen, Kochsalz mit je 24 Teilchen beider Sorten', () => {
  for (const id of S.ORDER) {
    const sys = PS.createSystem(S.SUBSTANCES[id]);
    assert.equal(sys.ps.length, 48, id);
  }
  const salt = PS.createSystem(S.SUBSTANCES.salt);
  assert.equal(salt.ps.filter((p) => p.kind === 0).length, 24);
  assert.equal(salt.ps.filter((p) => p.kind === 1).length, 24);
  // Wechselanordnung im Gitter: Nachbarn sind verschiedene Sorten
  const sl = salt.slots;
  assert.notEqual(sl[0].kind, sl[1].kind);
  assert.notEqual(sl[0].kind, sl[8].kind);
});

for (const id of S.ORDER) {
  const s = S.SUBSTANCES[id];
  test(`${s.name}: fest, flüssig und gasförmig allein an Anordnung und Bewegung unterscheidbar`, () => {
    const r = rig(id, s.mp - 1);
    r.run(s.mp - 1, 3);
    const solid = avgMetrics(r, 1.5);
    r.run(Math.round((s.mp + s.bp) / 2), 4);
    const liquid = avgMetrics(r, 3);
    r.run(s.max, 5);
    const gas = avgMetrics(r, 3);
    const H = r.sys.H;
    // fest: auf Gitterplätzen, nur kleine Schwingung, dicht
    assert.ok(solid.slotDev < 0.5, `${id} fest: auf Plätzen (Abweichung ${solid.slotDev.toFixed(2)} r)`);
    assert.ok(solid.nn < 1.25, `${id} fest: dicht (${solid.nn.toFixed(2)})`);
    // flüssig: dicht, unten im Gefäß, aber in Bewegung
    assert.ok(liquid.nn < 1.3, `${id} flüssig: eng beisammen (${liquid.nn.toFixed(2)})`);
    assert.ok(liquid.yTop > H * 0.55, `${id} flüssig: bleibt unten (${liquid.yTop.toFixed(1)})`);
    assert.ok(liquid.speed > 2.5 && liquid.speed < 20, `${id} flüssig: ständig in Bewegung (${liquid.speed.toFixed(1)})`);
    // gasförmig: große Abstände, ganzer Raum, schnell
    assert.ok(gas.nn > 1.3, `${id} gas: große Abstände (${gas.nn.toFixed(2)})`);
    assert.ok(gas.ySpan > H * 0.7, `${id} gas: ganzer Raum (${gas.ySpan.toFixed(1)})`);
    assert.ok(gas.speed > 2 * liquid.speed && gas.speed > 25, `${id} gas: schnell (${gas.speed.toFixed(1)})`);
  });
}

test('Teilchenzahl und Größe bleiben bei allen Übergängen erhalten (beide Richtungen, rasche Wechsel)', () => {
  for (const id of S.ORDER) {
    const s = S.SUBSTANCES[id];
    const r = rig(id, s.start);
    const radii = r.sys.ps.map((p) => p.r).join();
    const seq = [s.max, s.min, s.mp, s.bp, s.min + 1, s.max, Math.round((s.mp + s.bp) / 2), s.min];
    for (const T of seq) {
      for (let k = 0; k < 12; k++) {
        r.run(T, 0.25);
        const c = r.sys.counts();
        assert.equal(c.S + c.L + c.G + c.P, 48, `${id}: 48 Teilchen bei ${T} °C`);
        assert.ok(r.sys.ps.every((p) => Number.isFinite(p.x) && p.x >= 0 && p.x <= r.sys.W && p.y >= 0 && p.y <= r.sys.H), `${id}: alle Teilchen im Darstellungsraum`);
      }
      const tg = r.sys.targets(r.m.shares());
      const c = r.sys.counts();
      assert.deepEqual([c.S, c.L, c.G], [tg.S, tg.L, tg.G], `${id} bei ${T} °C: Zahl je Zustand passt zum Modell`);
    }
    assert.equal(r.sys.ps.map((p) => p.r).join(), radii, `${id}: Teilchen werden weder größer noch kleiner`);
  }
});

test('Schmelzen und Erstarren: oben/außen zuerst gelöst, Plätze füllen sich von unten innen', () => {
  const r = rig('iron', 1530);
  r.run(1538, 0.5);
  r.run(1538, 3);
  const solids = r.sys.ps.filter((p) => p.ph === 'S');
  assert.equal(solids.length, 24);
  const maxPrio = Math.max(...solids.map((p) => r.sys.slots[p.slot].prio));
  assert.ok(maxPrio < 300, `noch feste Plätze nur in den unteren Reihen (höchste Rangfolge ${maxPrio})`);
  r.run(1400, 4);
  assert.equal(r.sys.counts().S, 48);
  assert.ok(r.sys.metrics().slotDev < 0.6, 'nach dem Erstarren wieder geordnet');
});

test('flüssig: Teilchen tauschen ihre Nachbarn (keine starre Gitterbewegung)', () => {
  for (const id of ['water', 'iron']) {
    const r = rig(id, Math.round((S.SUBSTANCES[id].mp + S.SUBSTANCES[id].bp) / 2));
    r.run(null, 2);
    const nearest = () => r.sys.ps.map((p) => { let best = -1, bd = Infinity; for (const q of r.sys.ps) { if (q === p) continue; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = q.i; } } return best; });
    const a = nearest();
    r.run(null, 6);
    const b = nearest();
    const changed = a.filter((v, i) => v !== b[i]).length / a.length;
    assert.ok(changed > 0.5, `${id}: ${Math.round(changed * 100)} % haben neue Nachbarn`);
  }
});

test('fest: Schwingung nimmt mit der Temperatur zu', () => {
  const dev = (T) => { const r = rig('water', T); r.run(T, 2); let d = 0; for (let k = 0; k < 20; k++) { r.run(null, 0.05); d += r.sys.metrics().slotDev; } return d / 20; };
  const cold = dev(-30), warm = dev(-1);
  assert.ok(warm > cold * 1.5, `−1 °C: ${warm.toFixed(3)} r gegenüber −30 °C: ${cold.toFixed(3)} r`);
});

test('Kochsalz im Gas: dezent paarweise (je ein Teilchen beider Sorten), Paare halten zusammen', () => {
  const r = rig('salt', 1550);
  r.run(1550, 3);
  const m = r.sys.metrics();
  assert.equal(m.counts.G, 48);
  assert.ok(m.bondsOk, 'Paare bleiben verbunden');
  for (const p of r.sys.ps) assert.notEqual(p.kind, r.sys.ps[p.bond].kind, 'Paar aus beiden Sorten');
  r.run(1000, 3);
  assert.ok(r.sys.ps.every((p) => p.bond < 0), 'in der Schmelze keine Paare');
});

test('Iod: Sublimation auf der Teilchenebene und Anlagerung an der kalten Oberfläche', () => {
  const r = rig('iodine', 25);
  r.run(95, 8);
  const c = r.sys.counts();
  assert.ok(c.G >= 4 && c.S >= 38 && c.L === 0, `einige Teilchen verlassen den Feststoff (${JSON.stringify(c)})`);
  r.m.setCold(true);
  r.run(95, 12);
  const cc = r.sys.counts();
  assert.ok(cc.P >= 3, `Teilchen sitzen an der kalten Oberfläche (${cc.P})`);
  const plate = r.sys.ps.filter((p) => p.ph === 'P');
  assert.ok(plate.every((p) => p.y < 15), 'oben an der kalten Fläche');
  r.m.setCold(false);
  r.run(95, 6);
  assert.equal(r.sys.counts().P, 0, 'nach dem Ausblenden wieder frei');
  assert.equal(r.sys.ps.length, 48);
});

test('reproduzierbar: gleicher Startwert ergibt gleiche Bewegung', () => {
  const a = rig('water', 50, 11), b = rig('water', 50, 11);
  a.run(120, 2); b.run(120, 2);
  assert.deepEqual(a.sys.ps.map((p) => [p.x.toFixed(6), p.y.toFixed(6)]), b.sys.ps.map((p) => [p.x.toFixed(6), p.y.toFixed(6)]));
});
