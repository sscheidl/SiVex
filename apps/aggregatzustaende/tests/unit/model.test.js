// Unit-Tests des Zustandsmodells (ohne DOM): alle vier Stoffe unterhalb, an und
// oberhalb beider Übergangstemperaturen, Verzögerung, rasche Reglerbewegungen,
// Stoffwechsel, Iod-Sublimation und kalte Oberfläche.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../js/substances.js');
const M = require('../../js/model.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: erwartet ${b} ± ${tol}, erhalten ${a}`);
const run = (m, sec) => { for (let i = 0; i < Math.round(sec / 0.05); i++) m.advance(0.05); };
function settle(m, T, sec = 6) { m.setTemp(T); run(m, sec); return m.shares(); }
const sum = (sh) => sh.s + sh.l + sh.g + sh.c;

test('vier Stoffe mit eigenen Schmelz- und Siedetemperaturen in einem gemeinsamen Datensatz', () => {
  assert.deepEqual(S.ORDER, ['water', 'iodine', 'iron', 'salt']);
  const exp = { water: [0, 100], iodine: [114, 184], iron: [1538, 2862], salt: [801, 1465] };
  for (const id of S.ORDER) {
    const s = S.SUBSTANCES[id];
    assert.deepEqual([s.mp, s.bp], exp[id], id);
    assert.ok(s.min < s.mp && s.mp < s.bp && s.bp < s.max, `${id}: Bereich umfasst beide Übergänge`);
    assert.ok(s.start >= s.min && s.start <= s.max, `${id}: Startwert im Bereich`);
    assert.ok(s.particle && s.particle.kinds.length >= 1, `${id}: Teilchensymbol konfiguriert`);
  }
  assert.equal(S.SUBSTANCES.salt.particle.kinds.length, 2, 'Kochsalz: zwei Teilchensorten');
});

test('Startzustand: Wasser bei 20 °C flüssig, Iod/Eisen/Kochsalz fest', () => {
  const m = M.createModel();
  assert.equal(m.state.sub, 'water');
  assert.equal(m.state.Tset, 20);
  near(m.shares().l, 1, 1e-9, 'Wasser flüssig');
  for (const id of ['iodine', 'iron', 'salt']) {
    m.setSubstance(id);
    assert.equal(m.state.Tset, S.SUBSTANCES[id].start);
    near(m.shares().s, 1, 1e-9, `${id} fest`);
  }
});

for (const id of S.ORDER) {
  test(`${S.SUBSTANCES[id].name}: unterhalb, an und oberhalb der Schmelz- und Siedetemperatur`, () => {
    const s = S.SUBSTANCES[id];
    const m = M.createModel({ sub: id });
    const vmax = s.vapor ? s.vapor.max : 0;
    let sh = settle(m, s.mp - 1);
    assert.ok(sh.s >= 1 - vmax - 1e-6 && sh.l < 1e-6, `${id} unter Smp.: fest (s=${sh.s})`);
    sh = settle(m, s.mp);
    near(sh.s, 0.5 * (1 - (s.vapor ? s.vapor.max : 0)), 1e-3, `${id} genau am Smp.: halb fest`);
    near(sh.l, sh.s, 1e-3, `${id} genau am Smp.: halb flüssig`);
    assert.equal(m.process(), 'atMelting');
    sh = settle(m, s.mp + 1);
    assert.ok(sh.l >= 1 - vmax - 1e-3 && sh.s < 1e-6, `${id} über Smp.: flüssig`);
    sh = settle(m, Math.round((s.mp + s.bp) / 2));
    assert.ok(sh.l >= 1 - vmax - 1e-3, `${id} zwischen Smp. und Sdp.: flüssig`);
    sh = settle(m, s.bp - 1);
    assert.ok(sh.l >= 1 - vmax - 1e-3, `${id} unter Sdp.: flüssig`);
    sh = settle(m, s.bp);
    near(sh.g, 0.5 + 0.5 * vmax, 1e-3, `${id} genau am Sdp.: halb gasförmig`);
    assert.equal(m.process(), 'atBoiling');
    sh = settle(m, s.bp + 1);
    near(sh.g, 1, 1e-6, `${id} über Sdp.: gasförmig`);
    sh = settle(m, s.max);
    near(sh.g, 1, 1e-6, `${id} am Ende des Bereichs: gasförmig`);
    sh = settle(m, s.min);
    assert.ok(sh.s >= 1 - vmax - 1e-6, `${id} zurück am Bereichsanfang: wieder fest`);
    near(sum(sh), 1, 1e-9, 'Anteile ergeben zusammen 1');
  });
}

test('Darstellung folgt dem Regler verzögert (≈ 0,5–1 s) und erreicht den Wert genau', () => {
  const m = M.createModel();
  m.setTemp(80);
  assert.equal(m.state.Tset, 80, 'eingestellter Wert sofort übernommen');
  run(m, 0.25);
  const t1 = m.state.Tview;
  assert.ok(t1 > 45 && t1 < 70, `nach 0,25 s auf halbem Weg (${t1})`);
  run(m, 0.75);
  assert.ok(Math.abs(m.state.Tview - 80) < 1.5, `nach 1 s fast erreicht (${m.state.Tview})`);
  run(m, 0.2);
  assert.equal(m.state.Tview, 80, 'nach gut einer Sekunde exakt erreicht');
});

test('Zustandswechsel weich: Schmelzen dauert gut eine Sekunde, Mischung dazwischen; beide Richtungen', () => {
  const m = M.createModel({ sub: 'water', Tset: -10 });
  m.setTemp(10);
  const seen = new Set();
  let mixed = false;
  for (let i = 0; i < 40; i++) { m.advance(0.05); seen.add(m.process()); const sh = m.shares(); if (sh.s > 0.2 && sh.l > 0.2) mixed = true; }
  assert.ok(seen.has('melting') && mixed, 'Schmelzen mit sichtbarer Mischung');
  run(m, 2);
  assert.equal(m.shares().l, 1);
  m.setTemp(120); seen.clear();
  for (let i = 0; i < 60; i++) { m.advance(0.05); seen.add(m.process()); }
  assert.ok(seen.has('boiling'), 'Verdampfen');
  m.setTemp(50); seen.clear();
  for (let i = 0; i < 60; i++) { m.advance(0.05); seen.add(m.process()); }
  assert.ok(seen.has('condensing'), 'Kondensieren');
  m.setTemp(-20); seen.clear();
  for (let i = 0; i < 60; i++) { m.advance(0.05); seen.add(m.process()); }
  assert.ok(seen.has('freezing'), 'Erstarren');
  assert.equal(m.shares().s, 1);
});

test('direkter Sprung fest → gasförmig läuft über die Flüssigkeit (kein Zustand wird übersprungen)', () => {
  const m = M.createModel({ sub: 'water', Tset: -30 });
  m.setTemp(130);
  let maxL = 0;
  for (let i = 0; i < 100; i++) { m.advance(0.05); maxL = Math.max(maxL, m.shares().l); }
  assert.ok(maxL > 0.9, `zwischendurch flüssig (max. ${maxL})`);
  near(m.shares().g, 1, 1e-9, 'am Ende gasförmig');
});

test('rasches Hin- und Herbewegen des Reglers: keine hängenden oder falschen Zustände, Anteile immer gültig', () => {
  for (const id of S.ORDER) {
    const s = S.SUBSTANCES[id];
    const m = M.createModel({ sub: id });
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 400; i++) {
      m.setTemp(s.min + rnd() * (s.max - s.min));
      m.advance(rnd() * 0.06);
      const sh = m.shares();
      assert.ok(Object.values(sh).every((v) => Number.isFinite(v) && v >= -1e-9 && v <= 1 + 1e-9), `${id}: Anteile gültig`);
      near(sum(sh), 1, 1e-9, `${id}: Summe 1`);
    }
    for (const T of [s.mp - 5, s.mp, Math.round((s.mp + s.bp) / 2), s.bp, s.bp + 5, s.min]) {
      const sh = settle(m, T);
      const p = M.phaseTarget(s, T);
      near(m.state.p, p, 1e-9, `${id} bei ${T} °C: Endzustand erreicht`);
      assert.ok(Number.isFinite(sh.g));
    }
  }
});

test('Stoffwechsel setzt sauber zurück, laufende Übergänge wandern nicht mit', () => {
  const m = M.createModel({ sub: 'water', Tset: 20 });
  m.setTemp(130); run(m, 0.6);
  assert.ok(m.process() === 'boiling');
  const seq = m.state.seq;
  m.setSubstance('iron');
  assert.equal(m.state.sub, 'iron');
  assert.equal(m.state.Tset, 1400);
  assert.equal(m.state.Tview, 1400);
  assert.equal(m.state.p, 0);
  assert.equal(m.process(), null);
  assert.equal(m.state.seq, seq + 1, 'Laufnummer erhöht (Renderer verwerfen ihre Effekte)');
  assert.equal(m.setTemp(99999), 3000, 'Reglerbereich des neuen Stoffes');
  assert.equal(m.setTemp(-5), 1400);
});

test('Iod: Sublimation unterhalb der Schmelztemperatur, flüssiges Iod zwischen 114 und 184 °C', () => {
  const m = M.createModel({ sub: 'iodine' });
  assert.ok(m.shares().g < 1e-6, 'bei 25 °C kein Dampf');
  m.setTemp(95);
  run(m, 0.5);
  const early = m.shares().g;
  const sh = settle(m, 95, 8);
  assert.ok(early < sh.g, 'Dampf entsteht langsam');
  assert.ok(sh.g > 0.08 && sh.s > 0.8 && sh.l === 0, `fest mit violettem Dampf (g=${sh.g.toFixed(3)})`);
  assert.equal(m.process(), 'subliming');
  const liq = settle(m, 150);
  assert.ok(liq.l > 0.8 && liq.s === 0, 'zwischen 114 und 184 °C überwiegend flüssig');
  for (const id of ['water', 'iron', 'salt']) {
    const o = M.createModel({ sub: id });
    const s = S.SUBSTANCES[id];
    assert.equal(settle(o, s.mp - 1).g, 0, `${id}: keine Sublimation`);
  }
});

test('kalte Oberfläche: nur bei Iod, Kristalle wachsen aus dem Dampf, Ausblenden baut sie wieder ab', () => {
  const w = M.createModel({ sub: 'water' });
  assert.equal(w.setCold(true), false, 'bei Wasser nicht verfügbar');
  const m = M.createModel({ sub: 'iodine' });
  m.setCold(true);
  settle(m, 25, 5);
  assert.ok(m.state.c < 0.01, 'bei 25 °C kaum Kristalle (kaum Dampf)');
  m.setTemp(95);
  for (let i = 0; i < 40; i++) run(m, 0.25);
  assert.ok(m.state.c > 0.06, `Resublimation am Uhrglas (c=${m.state.c.toFixed(3)})`);
  assert.ok(m.resubliming() || m.state.c >= M.CRYSTAL_MAX - 1e-3);
  assert.ok(m.state.c <= M.CRYSTAL_MAX + 1e-9);
  near(sum(m.shares()), 1, 1e-9, 'Stoffmenge bleibt erhalten');
  m.setTemp(25); for (let i = 0; i < 20; i++) run(m, 0.25);
  assert.ok(m.state.c > 0.05, 'Kristalle bleiben beim Abkühlen am kalten Glas');
  m.setCold(false); for (let i = 0; i < 40; i++) run(m, 0.25);
  assert.equal(m.state.c, 0);
  assert.equal(m.state.coldVis, 0, 'Oberfläche ausgeblendet');
  m.setSubstance('water');
  assert.equal(m.state.cold, false);
});

test('Wiederherstellen nach Neuladen: Stoff, Temperatur und kalte Oberfläche', () => {
  const m = M.createModel();
  m.restore({ sub: 'iodine', Tset: 150, cold: true, c: 0.12 });
  assert.equal(m.state.sub, 'iodine');
  assert.equal(m.state.Tset, 150);
  assert.equal(m.state.cold, true);
  near(m.shares().l, (1 - 0.14) * (1 - 0.12), 1e-9, 'flüssig mit Dampf und Kristallen');
  m.restore({ sub: 'unbekannt', Tset: 5 });
  assert.equal(m.state.sub, 'iodine', 'ungültige Daten werden ignoriert');
});

test('Reglerskala: bei Eisen und Kochsalz gestaucht, Übergänge exakt erreichbar, Hin- und Rückweg stimmen', () => {
  for (const id of S.ORDER) {
    const s = S.SUBSTANCES[id];
    for (const T of [s.min, s.mp, s.bp, s.max]) {
      const pos = Math.round(S.tempToPos(s, T) * 1000) / 1000;
      assert.equal(S.posToTemp(s, pos), T, `${id}: ${T} °C über die Reglerposition ${pos}`);
    }
    let prev = -Infinity;
    for (let p = 0; p <= 1000; p++) { const T = S.posToTemp(s, p / 1000); assert.ok(T >= prev, `${id}: Skala steigt monoton`); prev = T; }
  }
  for (const id of ['iron', 'salt']) {
    const s = S.SUBSTANCES[id];
    near(S.tempToPos(s, s.mp), 0.25, 1e-9, `${id}: Schmelztemperatur bei 25 % des Reglers`);
    near(S.tempToPos(s, s.bp), 0.75, 1e-9, `${id}: Siedetemperatur bei 75 % des Reglers`);
  }
  const w = S.SUBSTANCES.water;
  near(S.tempToPos(w, 50), 80 / 160, 1e-9, 'Wasser: lineare Skala');
});
