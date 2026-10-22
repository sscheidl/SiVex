'use strict';
// Regressionstests zu Fehlern, die bei der Entwicklung in den Browser-Tests gefunden wurden.
const test = require('node:test');
const assert = require('node:assert/strict');
const { newSession, must, buildDistill, engine, taskById } = require('./helpers.js');

test('R1: Schnappschuss für die Auswertung erst nach abgeschlossener Handlung (nicht mitten im Gießen)', () => {
  const s = newSession();
  s.selectTask('K-01');
  const lab = s.engine();
  lab.advance(150);
  lab.pour('B1', 'B2', 'slow');
  // während des Gießens mehrfach prüfen – das Ziel ist zwischendurch schon erreicht
  let g = 0;
  while (lab.busy() && g++ < 1000) { lab.advance(0.25); s.checkProgress(); }
  s.checkProgress();
  const obs = s.task().observations(s.view());
  const method = obs.find((o) => o.id === 'method');
  assert.equal(method.correct, 'decant', 'Verfahren ist im Schnappschuss protokolliert');
});

test('R2: Nach Bestätigung eines Sicherheitsstopps beginnt die Zählung des ausgetretenen Dampfs neu (kein Dauer-Stopp)', () => {
  const lab = buildDistill({ cool: 0 });
  lab.setHeater(3);
  lab.advance(800);
  assert.equal(lab.state.safety.code, 'escape');
  lab.ackSafety();
  lab.setCooling(2);
  lab.setHeater(3);
  lab.advance(300);
  assert.equal(lab.state.safety, null, 'mit Kühlung läuft es weiter');
  assert.ok(lab.state.receivers.A.E + lab.state.receivers.A.W > 3);
  const t = lab.totals();
  assert.ok(Math.abs(t.E - 40) < 1e-6 && Math.abs(t.W - 60) < 1e-6, 'Bilanz unverändert');
});

test('R3: Trockene Feststoffe rieseln ohne Einsatz durch den Trichter (kein „Festhängen“ im leeren Trichter)', () => {
  const lab = engine('K-02');
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(30);
  assert.ok(lab.describe('B2').sand > 9, 'Sand im Becherglas unter dem Trichter');
  assert.ok(lab.describe('F').solids < 0.05);
});

test('R4: Sand auf mehrere Gefäße verteilt zählt in K-01 als abgetrennt', () => {
  const lab = engine('K-01');
  must(lab, () => lab.pour('B1', 'B2', 'fast'));
  lab.advance(200);
  must(lab, () => lab.pour('B2', 'B3', 'slow'));
  assert.ok(taskById('K-01').check(lab).success);
});

test('R5: Wenig Gemisch im Kolben → Warnung vor dem Heizen', () => {
  const lab = buildDistill({ portions: 1 });
  const msgs = [];
  lab.on('message', (m) => msgs.push(m.text));
  lab.setHeater(3);
  assert.ok(msgs.some((m) => /nur wenig Gemisch/.test(m)));
});
