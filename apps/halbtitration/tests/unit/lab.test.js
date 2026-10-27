// Experimentsteuerung: Volumenbuchhaltung, Bürettenstand, Mischung, Messkette, Speicherung
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/model/chemistry.js');
const Lab = require('../../js/experiment/lab.js');

function ready(id) {
  const l = new Lab(C.experiment(id));
  l.pipetteSample(); l.simulate(3);
  l.addWater(); l.simulate(3);
  l.rinseBurette(); l.fillBurette(0.4); l.purgeTip(0.15);
  l.calibrate(1); l.simulate(3.1); l.calibrate(2); l.simulate(3.1);
  assert.equal(l.immerseElectrode().ok, true);
  l.setStirrer(true);
  return l;
}

test('Vorbereitung erzwingt Reihenfolge und sinnvolle Bedingungen', () => {
  const l = new Lab(C.experiment('acetic'));
  assert.equal(l.canDose(), 'burette');
  assert.equal(l.immerseElectrode().reason, 'calibrate');
  l.pipetteSample(); l.simulate(3);
  l.calibrate(1); l.simulate(3.1); l.calibrate(2); l.simulate(3.1);
  assert.equal(l.immerseElectrode().reason, 'depth', 'Diaphragma ohne Verdünnung nicht bedeckt');
  l.rinseBurette(); l.fillBurette(0.4);
  assert.equal(l.canDose(), 'burette', 'Luftblase in der Spitze');
  l.purgeTip(0.15);
  assert.equal(l.canDose(), 'water');
});

test('Volumenbuchhaltung und Bürettenstand bleiben konsistent', () => {
  const l = ready('acetic');
  const r0 = l.burette.reading;
  l.addVolume(1.0);
  for (let i = 0; i < 200; i++) {
    l.update(1 / 60);
    const inFlight = l.drops.reduce((s, d) => s + d.vol, 0);
    assert.ok(Math.abs(l.dispensed - (l.delivered + l.hanging + inFlight)) < 1e-9, 'dispensed = delivered + hanging + drops');
    assert.ok(Math.abs(l.burette.reading - r0 - l.dispensed) < 1e-9, 'Bürettenstand folgt der Abgabe');
  }
  l.simulate(3);
  assert.ok(Math.abs(l.delivered - 1) < 1e-9);
  // Nachfüllen ändert nur den Stand, nicht das abgegebene Volumen (keine Sprünge in der Kurve)
  const d = l.dispensed;
  l.fillBurette(0.3);
  assert.equal(l.dispensed, d);
  assert.equal(l.burette.reading, 0.3);
});

test('Bürettenende wird nicht überschritten', () => {
  const l = ready('acetic');
  l.addVolume(60);
  l.simulate(120, 0.05);
  assert.ok(l.burette.reading <= 50 + 1e-9);
  assert.ok(Math.abs(l.dispensed - (50 - 0.55)) < 1e-6);
});

test('Ohne Rühren keine sofort homogene, stabile Anzeige', () => {
  const still = ready('acetic');
  still.setStirrer(false);
  still.simulate(10);
  still.addVolume(2); still.simulate(3);
  assert.equal(still.isSettled, true);
  assert.ok(still.unmixed > 1, 'unvermischter Anteil bleibt');
  assert.equal(still.homogeneous, false);
  const stirred = ready('acetic');
  stirred.simulate(25);
  stirred.addVolume(2); stirred.simulate(3);
  stirred.simulate(15);
  assert.equal(stirred.homogeneous, true);
  assert.equal(stirred.stable, true);
  assert.ok(Math.abs(stirred.displayPH - Math.round(stirred.state.pH * 100) / 100) < 0.011);
  assert.ok(Math.abs(still.sensor - stirred.sensor) > 0.02, 'ohne Rühren weicht die Anzeige ab');
});

test('Sensor hat eine Ansprechzeit; „stabil“ erst nach ruhiger Anzeige', () => {
  const l = ready('acetic');
  l.simulate(25);
  assert.equal(l.stable, true);
  l.addVolume(1);
  l.simulate(0.8);
  assert.equal(l.stable, false);
  const mid = l.sensor;
  l.simulate(15);
  assert.ok(Math.abs(l.sensor - mid) > 0.01, 'Anzeige läuft nach');
  assert.equal(l.stable, true);
  const r = l.reading();
  assert.equal(r.v, 1);
  assert.equal(r.stable, true);
});

test('Speichern und Wiederherstellen ohne versteckte Sprünge', () => {
  const l = ready('glycine');
  l.addVolume(3);
  l.simulate(0.5);
  const json = JSON.parse(JSON.stringify(l.toJSON()));
  const m = new Lab(C.experiment('glycine'));
  m.restore(json);
  assert.equal(m.dispensed, 3, 'laufende Zugabe gilt als abgeschlossen');
  assert.equal(m.delivered, 3);
  assert.ok(Math.abs(m.burette.reading - (0.55 + 3)) < 1e-9);
  assert.equal(m.calibration, 2);
  assert.equal(m.electrodeIn, true);
});

test('Neue Probe: Kolben leer, Bürette und Kalibrierung bleiben', () => {
  const l = ready('ammonia');
  l.addVolume(2); l.simulate(5);
  const r = l.burette.reading;
  l.newSample();
  assert.equal(l.dispensed, 0);
  assert.equal(l.sample, 0);
  assert.equal(l.electrodeIn, false);
  assert.equal(l.calibration, 2);
  assert.equal(l.burette.reading, r);
});
