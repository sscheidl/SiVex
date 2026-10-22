'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { distill, buildDistill } = require('./helpers.js');

const dist = (lab, id) => { const r = lab.state.receivers[id || 'A']; return r.E + r.W; };
function balanced(lab, E0, W0) {
  const t = lab.totals();
  assert.ok(Math.abs(t.E - E0) < 1e-6 && Math.abs(t.W - W0) < 1e-6, `Bilanz E ${t.E} W ${t.W}`);
}

test('D-02 Siedekurve: stetig, zwischen 78 und 100 °C, ohne Sprung; Dampf ethanolreicher als Flüssigkeit', () => {
  let prev = distill.bubbleT(0);
  assert.equal(prev, 100);
  for (let x = 0.01; x <= 1.0001; x += 0.01) {
    const T = distill.bubbleT(x);
    assert.ok(T <= prev + 1e-9 && prev - T < 4.6, `stetig fallend bei x=${x.toFixed(2)}`);
    if (x < 0.999) assert.ok(distill.vaporY(x) > x, 'Dampf ethanolreicher (Azeotrop vernachlässigt)');
    prev = T;
  }
  assert.ok(Math.abs(distill.bubbleT(1) - 78) < 0.01);
  const x40 = distill.xOf(40, 60);
  assert.ok(distill.bubbleT(x40) > 83 && distill.bubbleT(x40) < 86, 'Gemisch mit 40 % siedet bei ca. 84 °C, nicht bei 78 °C');
});

test('D-01 positiv: Aufbau, Kühlwasser unten, Heizen → Destillat ethanolreich, Temperatur steigt allmählich, Brennprobe brennt', () => {
  const lab = buildDistill();
  assert.ok(lab.setHeater(3).ok);
  lab.advance(900);
  const r = lab.state.receivers.A;
  assert.ok(dist(lab) > 15, 'Destillat ' + dist(lab));
  assert.ok(distill.phiOf(r) > 0.6, 'ethanolreicher als 40 %: ' + distill.phiOf(r));
  assert.ok(distill.phiOf(r) < 0.95, 'aber nicht rein');
  const reads = lab.state.collect.map((c) => c.read);
  assert.ok(reads[0] > 82 && reads[0] < 86, 'erste Tropfen bei ca. 84 °C: ' + reads[0]);
  for (let i = 1; i < reads.length; i++) assert.ok(reads[i] >= reads[i - 1] - 0.05, 'kein Rücksprung');
  assert.ok(reads[reads.length - 1] - reads[0] > 0.8, 'allmählicher Anstieg');
  assert.ok(reads.every((v) => v < 95), 'kein Sprung auf 100 °C');
  assert.ok(lab.takeSample('A').ok);
  const res = lab.ignite('dish');
  assert.equal(res.result, 'burns');
  balanced(lab, 40, 60);
});

test('D-04/D-02 negativ: Heizleistung 0 bzw. zu schwach → auch nach langer Zeit kein Destillat', () => {
  const a = buildDistill(); a.advance(3000);
  assert.equal(dist(a), 0);
  const b = buildDistill(); b.setHeater(1); b.advance(3000);
  assert.equal(dist(b), 0, 'Stufe 1 reicht nicht zum Sieden');
  assert.ok(b.state.flask.T < distill.bubbleT(distill.xOf(40, 60)));
});

test('D-03/D-04: Kühlwasser aus → kaum Kondensat, Dampf entweicht, Sicherheitsstopp', () => {
  const ok = buildDistill(); ok.setHeater(3); ok.advance(500);
  const off = buildDistill({ cool: 0 }); off.setHeater(3); off.advance(500);
  assert.ok(dist(off) < 0.25 * dist(ok), `aus ${dist(off)} vs. an ${dist(ok)}`);
  assert.ok(off.state.lost.escaped.E > 0.5);
  assert.equal(off.state.safety && off.state.safety.code, 'escape');
  balanced(off, 40, 60);
});

test('D-04: Kühlwasser oben hinein (falsch) → schwächere Kühlung, weniger Destillat, Dampfverlust', () => {
  const ok = buildDistill(); ok.setHeater(3); ok.advance(450);
  const top = buildDistill({ hose: 'top' }); top.setHeater(3); top.advance(450);
  assert.ok(dist(top) < 0.7 * dist(ok), `oben ${dist(top)} vs. unten ${dist(ok)}`);
  assert.ok(top.state.lost.escaped.E > ok.state.lost.escaped.E + 0.5);
});

test('D-03 (Szenario 15): Thermometer zu hoch oder in der Flüssigkeit → Messwert falsch, Messung nicht verwertbar', () => {
  const hi = buildDistill({ thermo: 'high' }); hi.setHeater(3); hi.advance(600);
  assert.ok(hi.reading() < 70, 'zu hoch: zu niedrige Anzeige ' + hi.reading());
  assert.equal(hi.state.firstDrop.pos, 'high');
  const deep = buildDistill({ thermo: 'deep' }); deep.setHeater(3); deep.advance(600);
  assert.ok(deep.reading() > deep.state.flask.T, 'in der Flüssigkeit: misst überhitzte Kolbenflüssigkeit');
  const none = buildDistill({ thermo: null }); none.setHeater(3); none.advance(500);
  assert.equal(none.state.safety && none.state.safety.code, 'open', 'ohne Thermometer ist der Aufsatz oben offen');
});

test('D-06 (Szenario 17): Geschlossene Apparatur erhitzen → sofortiger Sicherheitsstopp; nach Korrektur weiter', () => {
  const lab = buildDistill();
  lab.setReceiverStopper(true);
  const r = lab.setHeater(3);
  assert.equal(r.ok, false);
  assert.equal(lab.state.safety.code, 'closed');
  assert.equal(lab.state.heater, 0);
  assert.equal(lab.place('clamps').ok, false, 'während des Stopps gesperrt');
  lab.ackSafety();
  lab.setReceiverStopper(false);
  assert.ok(lab.setHeater(3).ok, 'nach Korrektur möglich');
  lab.advance(500);
  assert.ok(dist(lab) > 3);
});

test('D-06 (Szenario 17): Zünden an der Apparatur → Sicherheitsstopp; Brennprobe nur in der separaten Schale', () => {
  const lab = buildDistill(); lab.setHeater(3); lab.advance(400);
  const r = lab.ignite('apparatus');
  assert.equal(r.ok, false);
  assert.equal(lab.state.safety.code, 'igniteApparatus');
  assert.equal(lab.state.burnTests.length, 0, 'keine Brennprobe gezählt');
});

test('D-06: Offene Apparatur (ohne Aufsatz/Kühler) beim Sieden → Sicherheitsstopp, Dampf kehrt in den Kolben zurück', () => {
  const lab = buildDistill({ cooler: false }); lab.setHeater(3); lab.advance(500);
  assert.equal(lab.state.safety.code, 'open');
  balanced(lab, 40, 60);
});

test('D-06: Siedesteine in heiße Flüssigkeit werden unterbunden; ohne Siedesteine Siedeverzug', () => {
  const lab = buildDistill({ stones: false });
  lab.setHeater(2); lab.advance(900);
  assert.ok(lab.state.bumps > 0, 'stoßweises Sieden bei Stufe 2');
  assert.equal(lab.state.safety, null, 'Stufe 2: lernwirksam, kein Stopp');
  assert.equal(lab.addStones().ok, false, 'Siedesteine in heiße Flüssigkeit: abgelehnt');
  const strong = buildDistill({ stones: false }); strong.setHeater(3); strong.advance(400);
  assert.equal(strong.state.safety.code, 'bumping');
  balanced(strong, 40, 60);
});

test('D-06: Ohne Klemmen tritt Dampf an den Verbindungen aus (Verlust); ohne Vorlage tropft Destillat auf den Tisch', () => {
  const a = buildDistill({ clamps: false }); a.setHeater(3); a.advance(500);
  assert.ok(a.state.lost.leak.E > 0.2);
  const b = buildDistill({ receiver: null }); b.setHeater(3); b.advance(500);
  assert.ok(b.state.lost.table.E > 1);
  balanced(a, 40, 60); balanced(b, 40, 60);
});

test('D-06: Übermäßige Heizung mit schwacher Kühlung → Dampfverlust und Stopp; Destillation nie bis zur Trockne', () => {
  const a = buildDistill({ cool: 1 }); a.setHeater(4); a.advance(800);
  assert.ok(a.state.safety && a.state.safety.code === 'escape');
  const b = buildDistill({ portions: 2, cool: 3 }); b.setHeater(3); b.advance(4000);
  assert.ok(b.state.safety && b.state.safety.code === 'dry', 'Kolben fast leer → Stopp');
  balanced(b, 20, 30);
});

test('D-05 Brennprobe: späte, wasserreiche Fraktion brennt nicht; Probe aus heißem Kolben → Stopp', () => {
  assert.equal(distill.burnResult(0.75), 'burns');
  assert.equal(distill.burnResult(0.35), 'flicker');
  assert.equal(distill.burnResult(0.15), 'none');
  const lab = buildDistill({ portions: 4, cool: 3 }); lab.setHeater(3); lab.advance(700);
  lab.placeReceiver('B'); lab.advance(1100);
  assert.ok(distill.phiOf(lab.state.receivers.B) < distill.phiOf(lab.state.receivers.A));
  const r = lab.takeSample('flask');
  assert.equal(r.ok, false);
  assert.equal(lab.state.safety.code, 'hotSample');
});

test('D-01: Aufbau verlangt sinnvolle Reihenfolge (z. B. Füllen vor dem Aufsatz, Thermometer nur im Aufsatz)', () => {
  const lab = distill.create();
  assert.equal(lab.place('head').ok, false);
  lab.place('flask');
  assert.equal(lab.place('thermo', 'correct').ok, false);
  lab.place('head');
  assert.equal(lab.fill().ok, false, 'Füllen bei aufgesetztem Aufsatz');
  assert.equal(lab.setHeater(2).ok, false, 'kein Heizpilz');
  assert.equal(lab.setCooling(2).ok, false, 'keine Schläuche');
});

test('A-04 Zeitraffer in der Destillation: gleiche Simulationszeit → gleiches Ergebnis', () => {
  const run = (chunk) => {
    const lab = buildDistill(); lab.setHeater(3);
    for (let i = 0; i < Math.round(600 / chunk); i++) lab.update(chunk);
    const r = lab.state.receivers.A;
    return [r.E.toFixed(9), r.W.toFixed(9), lab.reading()].join('|');
  };
  assert.equal(run(0.1), run(1.2));
  assert.equal(run(1.2), run(12));
});
