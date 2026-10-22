'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const chem = require('../../js/chemistry.js');
const { fehling, tollens, newLab, act, addAll } = require('./helpers.js');

test('Zustandsmaschine: Phasen der Fehling-Probe in sinnvoller Reihenfolge', () => {
  const lab = newLab();
  const seen = [];
  const note = () => { const p = lab.phaseOf(1).id; if (seen[seen.length - 1] !== p) seen.push(p); };
  note();
  act(lab, () => lab.selectTube(1)); note();
  addAll(lab, 1, ['fehling1']); note();
  addAll(lab, 1, ['fehling2']); note();
  act(lab, () => lab.shake(1)); note();
  addAll(lab, 1, ['propanal']); note();
  lab.setHotplate(80);
  act(lab, () => lab.moveTube(1, 'bath')); note();
  for (let i = 0; i < 60; i++) { lab.advance(0.5); note(); }
  const m = lab.modelFor(1);
  assert.equal(m.outcome, 'positive');
  lab.recordProtocol(1, null, { solutionShown: false }); note();
  lab.recordProtocol(1, { method: 'fehling', observations: ['ziegelrot'], result: 'positiv', interpretation: 'reduzierend', cls: 'aldehyd' }); note();
  assert.deepEqual(seen, ['notPrepared', 'provided', 'partial', 'reagentReady', 'sampleAdded', 'conditions', 'running', 'observable', 'finished', 'evaluated']);
});

test('Handlungen sind zeitlich animiert: Zustand ändert sich erst beim Eintropfen', () => {
  const lab = newLab();
  lab.selectTube(2);
  lab.addSubstance(2, 'fehling1');
  assert.equal(chem.volume(lab.tubeById(2).contents), 0, 'Pipette ist noch unterwegs');
  assert.ok(lab.busy());
  lab.advance(1.4);
  assert.equal(chem.volume(lab.tubeById(2).contents), 1, 'nach dem Eintropfen');
  lab.advance(1);
  assert.ok(!lab.busy());
});

test('Während einer Handlung werden weitere Handlungen abgelehnt (keine widersprüchlichen Zustände)', () => {
  const lab = newLab();
  lab.selectTube(1);
  assert.ok(lab.addSubstance(1, 'fehling1').ok);
  assert.equal(lab.addSubstance(1, 'fehling2').ok, false);
  assert.equal(lab.moveTube(1, 'bath').ok, false);
});

test('Umsetzen: Reagenzglas ist während des Transports weder im Ständer noch im Bad', () => {
  const lab = newLab();
  lab.selectTube(1);
  lab.moveTube(1, 'bath');
  assert.equal(lab.tubeById(1).place, 'moving');
  lab.advance(2);
  assert.equal(lab.tubeById(1).place, 'bath');
  // nur zwei Plätze im Wasserbad
  act(lab, () => lab.moveTube(2, 'bath'));
  const r = act(lab, () => lab.moveTube(3, 'bath'));
  assert.equal(r.ok, false);
});

test('Ohne gezündeten Brenner kann kein Reagenzglas in die Flamme', () => {
  const lab = newLab();
  assert.equal(lab.moveTube(1, 'flame').ok, false);
});

test('E-09/U-03: Laboraufbau zurücksetzen und erneut durchführen', () => {
  const lab = newLab();
  fehling(lab, 1, 'ethanal');
  lab.recordProtocol(1, null, { solutionShown: true });
  lab.resetBench();
  for (const t of lab.state.tubes) {
    assert.equal(chem.volume(t.contents), 0);
    assert.equal(t.place, 'rack');
  }
  assert.equal(lab.state.bath.setting, 0);
  assert.equal(lab.state.protocol.length, 1, 'Protokoll bleibt beim Zurücksetzen des Aufbaus erhalten');
  const t = fehling(lab, 1, 'ethanal');
  assert.equal(chem.classify(t.contents).outcome, 'positive');
  lab.fullRestart();
  assert.equal(lab.state.protocol.length, 0);
});

test('Reagenzglas austauschen setzt nur dieses Glas zurück', () => {
  const lab = newLab();
  fehling(lab, 1, 'ethanal', { heat: false, seconds: 1 });
  act(lab, () => lab.selectTube(2));
  addAll(lab, 2, ['agno3']);
  act(lab, () => lab.replaceTube(1));
  assert.equal(chem.volume(lab.tubeById(1).contents), 0);
  assert.equal(chem.volume(lab.tubeById(2).contents), 1);
});

test('D-01/D-02/U-04: Lernmodus benennt Proben, Analysemodus mischt A–F neu', () => {
  const lab = newLab('learn');
  assert.deepEqual(lab.state.samples.map((s) => s.label), ['Ethanal', 'Propanal', 'Butanal', 'Propanon', 'Butanon', 'Pentan-2-on']);
  lab.setMode('analysis');
  const first = lab.state.samples.map((s) => s.sampleId).join();
  assert.deepEqual(lab.state.samples.map((s) => s.label), ['Probe A', 'Probe B', 'Probe C', 'Probe D', 'Probe E', 'Probe F']);
  assert.deepEqual(lab.state.samples.map((s) => s.sampleId).sort(), chem.SAMPLES.map((s) => s.id).sort());
  let changed = false;
  for (let i = 0; i < 5 && !changed; i++) {
    lab.fullRestart();
    changed = lab.state.samples.map((s) => s.sampleId).join() !== first;
  }
  assert.ok(changed, 'Zuordnung wird beim Neustart gemischt');
  lab.setMode('learn');
  assert.equal(lab.state.samples[0].label, 'Ethanal');
});

test('Analysemodus: Ergebnisse vergleichen und Einordnung prüfen', () => {
  const lab = newLab('analysis');
  const [a, b] = lab.state.samples;
  fehling(lab, 1, a.sampleId);
  lab.recordProtocol(1, null, { solutionShown: true });
  tollens(lab, 2, b.sampleId);
  lab.recordProtocol(2, null, { solutionShown: true });
  const ov = lab.overview();
  assert.ok(ov[0].fehling && !ov[0].tollens);
  assert.ok(ov[1].tollens && !ov[1].fehling);
  const ans = {};
  for (const s of lab.state.samples) ans[s.key] = chem.SAMPLE_BY_ID[s.sampleId].reducing ? 'aldehyd' : 'keinAldehyd';
  const res = lab.checkAnalysis(ans);
  assert.ok(res.every((r) => r.correct));
  assert.ok(res[0].hasEvidence && res[1].hasEvidence && !res[2].hasEvidence);
});

test('D-03/U-05: Hilfen sind dreistufig und hängen vom Versuchszustand ab', () => {
  const lab = newLab();
  const h0 = lab.help();
  assert.equal(h0.levels.length, 3);
  assert.match(h0.levels[2], /Reagenzglas/);
  act(lab, () => lab.selectTube(1));
  const h1 = lab.help();
  addAll(lab, 1, ['fehling1']);
  const h2 = lab.help();
  assert.match(h2.levels[2], /Fehling II/);
  addAll(lab, 1, ['fehling2']);
  const h3 = lab.help();
  assert.match(h3.levels[2], /Schütteln/);
  act(lab, () => lab.shake(1));
  addAll(lab, 1, ['ethanal']);
  const h4 = lab.help();
  assert.match(h4.levels[2], /Heizplatte/);
  const texts = new Set([h0, h1, h2, h3, h4].map((h) => h.levels[2]));
  assert.equal(texts.size, 5, 'jede Situation hat eine eigene Anleitung');
  // Tollens-Pfad
  act(lab, () => lab.selectTube(2));
  addAll(lab, 2, ['agno3']);
  assert.match(lab.help().levels[2], /Natronlauge/);
  addAll(lab, 2, ['naoh']);
  assert.match(lab.help().levels[2], /Ammoniaklösung/);
});

test('Analyse ohne Nachweis wird als unbegründet markiert', () => {
  const lab = newLab('analysis');
  const res = lab.checkAnalysis({});
  assert.ok(res.every((r) => !r.hasEvidence && !r.correct));
});
