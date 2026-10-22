'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { distill, tasks, run, buildDistill } = require('./helpers.js');

const T = tasks.ALL['D-1'];
const E = () => distill.createEngine();
const balance = (e) => {
  const t = e.totals();
  assert.ok(Math.abs(t.E - e.state.added.E) < 1e-6, `Ethanol ${t.E} vs ${e.state.added.E}`);
  assert.ok(Math.abs(t.W - e.state.added.W) < 1e-6, `Wasser ${t.W} vs ${e.state.added.W}`);
};

test('Siede- und Dampfdaten: 78/100 °C als Endpunkte, Gemisch dazwischen, Dampf ethanolreicher', () => {
  assert.equal(distill.boilT(0), 100);
  assert.ok(Math.abs(distill.boilT(1) - 78.1) < 0.3);
  const x = distill.xOf(30, 70);
  assert.ok(distill.boilT(x) > 84 && distill.boilT(x) < 87, 'Siedebeginn 30 %: ' + distill.boilT(x));
  assert.ok(distill.vapY(x) > x);
  for (let i = 1; i < distill.VLE.length; i++) assert.ok(distill.VLE[i][2] <= distill.VLE[i - 1][2] + 0.2);
});

test('D-01: vollständiger Aufbau → Destillat, steigende Dampftemperatur, Brennprobe positiv, Erfolg', () => {
  const e = E();
  buildDistill(e);
  run(e, 'setHeater', 3);
  e.advance(330);
  const first = e.state.firstDrop;
  assert.ok(first, 'Destillat tropft');
  assert.ok(e.state.readings.min > 84 && e.state.readings.min < 87.5, 'Dampftemperatur beim Tropfen ' + e.state.readings.min);
  e.advance(200);
  const d = e.distillate();
  assert.ok(d.vol > 10, 'Destillat ' + d.vol);
  assert.ok(d.pct > 60, 'ethanolreich: ' + d.pct);
  assert.ok(e.state.readings.max - e.state.readings.min > 1, 'Temperatur steigt stetig, kein Sprung');
  assert.ok(e.state.readings.max < 95);
  // keine starre Zweistufenfolge: Kurve ohne Sprung > 3 K zwischen zwei Messpunkten während des Tropfens
  const cur = e.state.curve.filter((c) => c.t > first.t + 10 && c.head != null);
  for (let i = 1; i < cur.length; i++) assert.ok(Math.abs(cur[i].head - cur[i - 1].head) < 1.5);
  run(e, 'takeSample', 'receiver');
  const r = run(e, 'ignite', 'dish');
  assert.equal(r.result, 'burns');
  const ev = T.evaluate(e);
  assert.ok(ev.success, JSON.stringify(ev.problems));
  const q = T.questions(ev.snapshot);
  assert.equal(q.find((x) => x.id === 'q2').correct, 'rise');
  assert.ok(q.find((x) => x.id === 'q1').check(ev.snapshot.tMin + 0.5));
  assert.equal(q.find((x) => x.id === 'q1').check(78), false, '78 °C ist nicht die abgelesene Dampftemperatur');
  balance(e);
});

test('D-02: Kühlwasser aus → deutlich weniger Destillat, Dampf entweicht', () => {
  const a = E(), b = E();
  buildDistill(a); buildDistill(b, { cooling: 0 });
  for (const e of [a, b]) { run(e, 'setHeater', 3); e.advance(500); }
  assert.ok(b.distillate().vol < a.distillate().vol * 0.25, `${b.distillate().vol} vs ${a.distillate().vol}`);
  assert.ok(b.state.lost.vapor.E + b.state.lost.vapor.W > 5);
  assert.ok(b.state.log.some((m) => m.code === 'vaporEscape'));
  balance(b);
});

test('D-02: Schläuche vertauscht → schlechtere Kühlung', () => {
  const a = E(), b = E();
  buildDistill(a); buildDistill(b, { hoses: 'reversed' });
  for (const e of [a, b]) { run(e, 'setHeater', 3); e.advance(500); }
  assert.ok(b.distillate().vol < a.distillate().vol * 0.7);
  assert.ok(b.condEfficiency() < a.condEfficiency());
});

test('D-03: Thermometer falsch positioniert → Messung nicht als korrekt gewertet', () => {
  for (const pos of ['liquid', 'high', null]) {
    const e = E();
    buildDistill(e, { thermo: pos });
    run(e, 'setHeater', 3);
    e.advance(450);
    run(e, 'takeSample', 'receiver');
    run(e, 'ignite', 'dish');
    const ev = T.evaluate(e);
    assert.equal(ev.success, false, 'Position ' + pos);
    assert.ok(ev.problems.some((p) => p.code === 'thermoWrong'));
    if (pos === 'high') assert.ok(e.state.sensor < e.boilingPoint() - 3, 'zu tiefe Anzeige ' + e.state.sensor);
    if (pos === 'liquid') assert.ok(Math.abs(e.state.sensor - e.state.liquid.T) < 1);
  }
});

test('D-04: Heizleistung 0 → auch nach langer Zeit kein Destillat', () => {
  const e = E();
  buildDistill(e);
  e.advance(3000);
  assert.equal(e.distillate().vol, 0);
  assert.equal(e.state.liquid.T, 20);
  assert.equal(T.evaluate(e).success, false);
});

test('D-05: geschlossene Apparatur erhitzen → sofortiger Sicherheitsstopp', () => {
  const e = E();
  buildDistill(e, { stopper: true });
  const r = run(e, 'setHeater', 2);
  assert.equal(r.ok, false);
  assert.equal(e.state.safety.code, 'closed');
  assert.equal(e.state.heater, 0);
  assert.equal(run(e, 'resume').ok, false);
  run(e, 'unmount', 'stopper');
  assert.equal(run(e, 'resume').ok, true);
  assert.equal(run(e, 'setHeater', 2).ok, true);
});

test('D-05: Zünden an der Apparatur → Sicherheitsstopp; Brennprobe nur in der Schale', () => {
  const e = E();
  buildDistill(e);
  run(e, 'setHeater', 3);
  e.advance(100);
  const r = run(e, 'ignite', 'apparatus');
  assert.equal(r.ok, false);
  assert.equal(e.state.safety.code, 'igniteApparatus');
  assert.equal(e.state.heater, 0);
});

test('Offene Apparatur (ohne Aufsatz bzw. ohne Kühler) wird beim Einschalten sofort gestoppt', () => {
  const e = E();
  run(e, 'mount', 'heater'); run(e, 'mount', 'flask'); run(e, 'mount', 'chips'); run(e, 'fill', 100);
  run(e, 'setHeater', 2);
  assert.equal(e.state.safety.code, 'openFlask');
  run(e, 'mount', 'head');
  run(e, 'resume');
  run(e, 'setHeater', 2);
  assert.equal(e.state.safety.code, 'openHead');
});

test('Ohne Siedesteine: Siedeverzug → Stopp; Siedesteine nicht in heiße Flüssigkeit', () => {
  const e = E();
  buildDistill(e, { chips: false });
  run(e, 'setHeater', 3);
  let g = 0; while (!e.state.safety && g++ < 10000) e.advance(0.5);
  assert.equal(e.state.safety && e.state.safety.code, 'bump');
  assert.ok(e.state.liquid.T > 80);
  const r = run(e, 'mount', 'chips');
  assert.equal(r.code, 'chipsHot');
  e.advance(900); // abkühlen
  assert.ok(e.state.liquid.T < 50);
  assert.ok(run(e, 'mount', 'chips').ok);
  assert.ok(run(e, 'resume').ok);
  run(e, 'setHeater', 3);
  e.advance(300);
  assert.ok(e.distillate().vol > 2);
});

test('Zu wenig Gemisch → Kolben läuft trocken → Stopp', () => {
  const e = E();
  buildDistill(e, { fill: 25 });
  run(e, 'setHeater', 3);
  e.advance(1500);
  assert.equal(e.state.safety && e.state.safety.code, 'dry');
  balance(e);
});

test('Übermäßige Heizleistung reißt Flüssigkeit mit → wasserreicheres Destillat', () => {
  const a = E(), b = E();
  buildDistill(a); buildDistill(b);
  run(a, 'setHeater', 2); run(b, 'setHeater', 4);
  // gleiche Destillatmenge vergleichen
  let g = 0; while (a.distillate().vol < 12 && g++ < 40000) a.advance(0.5);
  g = 0; while (b.distillate().vol < 12 && g++ < 40000) b.advance(0.5);
  assert.ok(b.distillate().pct < a.distillate().pct - 3, `${b.distillate().pct} vs ${a.distillate().pct}`);
  assert.ok(b.state.log.some((m) => m.code === 'entrain'));
});

test('Ohne Vorlage tropft das Destillat auf den Tisch', () => {
  const e = E();
  buildDistill(e, { receiver: false });
  run(e, 'setHeater', 3);
  e.advance(450);
  assert.equal(e.distillate().vol, 0);
  assert.ok(e.state.lost.spilled.E + e.state.lost.spilled.W > 3);
});

test('Brennprobe: wasserreiche Fraktion brennt nicht; Probe aus heißem Kolben → Stopp', () => {
  const e = E();
  buildDistill(e);
  run(e, 'setHeater', 3);
  e.advance(320);
  run(e, 'changeReceiver');
  e.advance(900);
  assert.equal(e.state.safety, null);
  // späte, wasserreiche Fraktion
  run(e, 'takeSample', 'receiver');
  assert.ok(distill.volPct(e.state.dish.E, e.state.dish.W) < 55);
  const r = run(e, 'ignite', 'dish');
  assert.notEqual(r.result, 'burns');
  e.advance(3);
  assert.ok(run(e, 'cleanDish').ok);
  run(e, 'takeSample', 'fraction:1');
  assert.equal(run(e, 'ignite', 'dish').result, 'burns');
  const f = run(e, 'takeSample', 'flask');
  assert.equal(f.ok, false);
  assert.ok(e.state.safety === null || e.state.safety.code === 'hotOpen');
  balance(e);
});

test('Zeitraffer ändert das Destillationsergebnis nicht', () => {
  const a = E(), b = E();
  buildDistill(a); buildDistill(b);
  run(a, 'setHeater', 3); run(b, 'setHeater', 3);
  for (let i = 0; i < 5000; i++) a.advance(0.1);
  b.advance(500);
  assert.equal(JSON.stringify(a.state.receiver), JSON.stringify(b.state.receiver));
  assert.equal(JSON.stringify(a.state.curve), JSON.stringify(b.state.curve));
});

test('Reihenfolge beim Aufbau und Abbau wird geprüft', () => {
  const e = E();
  assert.match(run(e, 'mount', 'flask').code, /order/);
  run(e, 'mount', 'heater'); run(e, 'mount', 'flask'); run(e, 'fill', 100); run(e, 'mount', 'head');
  assert.equal(run(e, 'fill', 100).code, 'fillLate');
  run(e, 'mount', 'condenser');
  assert.equal(run(e, 'unmount', 'head').code, 'unmountOrder');
  assert.equal(run(e, 'setCooling', 2).code, 'noHoses');
});
