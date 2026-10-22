'use strict';
// Regressionstests zu den Befunden der Prüfung vom 22.10.2026 (docs/REVIEW-2026-10-22.md).
// Jeder Test bildet die dort beschriebene Reproduktion nach.
const test = require('node:test');
const assert = require('node:assert/strict');
const chem = require('../../js/chemistry.js');
const { fehling, tollens, newLab, act, addAll } = require('./helpers.js');

const ALDEHYDES = ['ethanal', 'propanal', 'butanal'];
const KETONES = ['propanon', 'butanon', 'pentan-2-on'];

/** Reagenz ansetzen, ohne Probe erwärmen, abkühlen lassen. */
function preheatedFehling(lab, tubeId) {
  act(lab, () => lab.selectTube(tubeId));
  addAll(lab, tubeId, ['fehling1', 'fehling2']);
  act(lab, () => lab.shake(tubeId));
  lab.setHotplate(80);
  act(lab, () => lab.moveTube(tubeId, 'bath'));
  lab.advance(60);
  act(lab, () => lab.moveTube(tubeId, 'rack'));
  lab.advance(120);
  return lab.tubeById(tubeId);
}

test('R1: Heizzeit vor Zugabe der Probe zählt nicht – nach Abkühlen zugegebenes Keton ist kein negativer Befund', () => {
  const lab = newLab();
  const t = preheatedFehling(lab, 1);
  assert.equal(chem.classify(t.contents).title, 'Blindprobe ohne Stoffprobe', 'vorher: erwärmte Blindprobe');
  addAll(lab, 1, ['propanon']);
  const m = chem.classify(t.contents);
  assert.equal(m.outcome, 'unfinished', JSON.stringify({ outcome: m.outcome, exposure: t.contents.exposure }));
  assert.equal(t.contents.exposure, 0);
  assert.equal(chem.isObservable(t.contents), false);
  assert.notEqual(lab.phaseOf(1).id, 'observable');
  // Erst die gemeinsame Erwärmung des fertig gemischten Ansatzes erlaubt den negativen Befund
  act(lab, () => lab.moveTube(1, 'bath'));
  lab.advance(30);
  assert.equal(chem.classify(t.contents).outcome, 'negative');
});

test('R1: Fehlende Durchmischung verhindert die Beobachtungszeit; Schütteln/Konvektion holt sie nach', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'butanon', { heat: false, seconds: 0 });
  assert.ok(t.contents.mix < 0.85);
  // Kurzzeitig ins Bad, bevor sich der Ansatz durchmischt hat: keine Dosis
  const c = chem.createContents();
  ['fehling1', 'fehling2'].forEach((id) => chem.add(c, id)); c.mix = 1; chem.add(c, 'butanon');
  c.temp = 80; c.mix = 0.3;
  chem.step(c, 0.01, 80, 1000);
  assert.equal(c.exposure, 0, 'ungemischter Ansatz sammelt keine Beobachtungszeit');
  lab.setHotplate(80);
  act(lab, () => lab.moveTube(1, 'bath'));
  lab.advance(30);
  assert.equal(chem.classify(t.contents).outcome, 'negative');
});

test('R1: Jede Zugabe beginnt die Beobachtung neu, ein bereits sichtbarer positiver Befund bleibt aber bestehen', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal');
  assert.equal(chem.classify(t.contents).outcome, 'positive');
  const cu2o = t.contents.cu2o;
  addAll(lab, 1, ['fehling2']);
  assert.equal(t.contents.exposure, 0);
  assert.equal(t.contents.cu2o, cu2o, 'Cu₂O bleibt erhalten');
  assert.equal(chem.classify(t.contents).outcome, 'positive');
});

test('R2: Vorhandenes Silber bleibt Silber – Fehling I nach fertigem Silberspiegel erzeugt kein Cu₂O', () => {
  const lab = newLab();
  const t = tollens(lab, 1, 'ethanal');
  act(lab, () => lab.moveTube(1, 'rack'));
  lab.advance(60);
  const before = chem.appearance(t.contents);
  assert.ok(before.mirror > 0.95);
  addAll(lab, 1, ['fehling1']);
  lab.advance(30);
  const after = chem.appearance(t.contents);
  assert.equal(after.system, 'foreign');
  assert.equal(t.contents.cu2o, 0, 'kein Cu₂O ohne passende Reaktion');
  assert.ok(after.mirror > 0.95, 'Silberbelag bleibt: ' + after.mirror);
  const red = after.turb[0] > 140 && after.turb[1] < 90 && after.turb[3] > 0.5;
  assert.ok(!red, 'keine ziegelrote Trübung: ' + after.turb.map((x) => x.toFixed(2)));
  const m = chem.classify(t.contents);
  assert.equal(m.outcome, 'invalid');
  assert.match(m.explanation, /Silberbelag bleibt/);
});

test('R2: Cu₂O bleibt erhalten, wenn danach Silbernitrat zugegeben wird', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal');
  act(lab, () => lab.moveTube(1, 'rack'));
  addAll(lab, 1, ['agno3']);
  const ap = chem.appearance(t.contents);
  assert.equal(t.contents.ag, 0);
  assert.equal(ap.mirror, 0);
  assert.ok(t.contents.cu2o > 0.97 && ap.turb[3] > 0.8, 'rote Trübung bleibt');
});

test('R2: Schwarzes CuO aus Fehlansatz verschwindet nicht durch spätere Fehling-II-Zugabe', () => {
  const lab = newLab();
  const t = fehling(lab, 1, null, { reagents: ['fehling1', 'naoh'] });
  assert.ok(t.contents.cuo > 0.9);
  act(lab, () => lab.moveTube(1, 'rack'));
  addAll(lab, 1, ['fehling2']);
  const a = chem.analyze(t.contents);
  assert.equal(a.status, 'contaminated');
  assert.equal(a.valid, false);
  const ap = chem.appearance(t.contents);
  assert.ok(ap.turb[3] > 0.6 && Math.max(...ap.turb.slice(0, 3)) < 60, 'schwarzer Feststoff sichtbar: ' + ap.turb);
  // Auch eine reduzierende Probe führt hier zu keinem Nachweis
  addAll(lab, 1, ['ethanal']);
  act(lab, () => lab.moveTube(1, 'bath'));
  lab.advance(30);
  assert.equal(t.contents.cu2o, 0);
  assert.equal(chem.classify(t.contents).outcome, 'invalid');
});

test('R3/R4: Frühes Protokoll bleibt als Zwischenstand erhalten, der weiterlaufende Versuch wird erneut auswertbar', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal', { seconds: 0.5 });
  const answers = { method: 'fehling', observations: ['tiefblau'], result: 'ungueltig', interpretation: 'keineAussage', cls: 'keineAussage' };
  const rec = lab.recordProtocol(1, answers);
  assert.equal(rec.model.outcome, 'unfinished');
  assert.equal(rec.interim, true);
  assert.equal(lab.phaseOf(1).id, 'evaluated');
  const msgs = [];
  lab.on('message', (m) => msgs.push(m.text));
  lab.advance(30);
  assert.equal(chem.classify(t.contents).outcome, 'positive');
  const ph = lab.phaseOf(1);
  assert.equal(ph.id, 'observable', 'erneut beobachtbar statt endgültig ausgewertet');
  assert.equal(ph.stale, true);
  assert.equal(lab.recordCurrent(t), false);
  assert.ok(msgs.some((m) => /verändert/.test(m)), 'Hinweis auf veränderten Versuch');
  assert.equal(lab.state.protocol[0].model.outcome, 'unfinished', 'früherer Eintrag bleibt unverändert');
  const rec2 = lab.recordProtocol(1, { method: 'fehling', observations: ['ziegelrot'], result: 'positiv', interpretation: 'reduzierend', cls: 'aldehyd' });
  assert.ok(rec2.graded.allCorrect);
  assert.equal(lab.phaseOf(1).id, 'evaluated');
  assert.equal(lab.state.protocol.length, 2);
});

test('R4: Ein positives Protokoll vor Reaktionsende bleibt gültig (Befund ändert sich nicht)', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal', { seconds: 0 });
  while (!chem.isObservable(t.contents)) lab.advance(0.1);
  const rec = lab.recordProtocol(1, null, { solutionShown: true });
  assert.equal(rec.model.outcome, 'positive');
  assert.equal(rec.model.complete, false);
  lab.advance(30);
  assert.ok(chem.isComplete(t.contents));
  assert.equal(lab.recordCurrent(t), true);
  assert.equal(lab.phaseOf(1).id, 'evaluated');
});

test('R5: Deutlich sichtbares Cu₂O erlaubt einen positiven Befund vor vollständigem Umsatz', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal', { seconds: 0 });
  while (t.contents.progress < 0.6) lab.advance(0.05);
  const ap = chem.appearance(t.contents);
  assert.ok(ap.turb[3] > 0.7, 'kräftige Trübung');
  const m = chem.classify(t.contents);
  assert.equal(m.outcome, 'positive');
  assert.equal(m.result, 'positiv');
  assert.equal(m.complete, false);
  assert.match(m.title, /läuft noch/);
  const g = chem.gradeProtocol(m, { method: 'fehling', observations: ['ziegelrot'], result: 'positiv', interpretation: 'reduzierend', cls: 'aldehyd' });
  assert.ok(g.allCorrect, 'positive Auswertung wird anerkannt');
});

test('R5: Kein falsch negativer Befund – Aldehyde zeigen das Produkt, bevor die Wartezeit für „negativ“ erreicht ist', () => {
  for (const id of ALDEHYDES) {
    for (const [kind, setting] of [['fehling', 60], ['fehling', 80], ['tollens', 60], ['tollens', 80], ['tollens', 0]]) {
      const lab = newLab();
      const run = kind === 'fehling' ? fehling : tollens;
      const t = run(lab, 1, id, { seconds: 0, setting, heat: setting > 0 });
      for (let s = 0; s < 600; s += 0.5) {
        lab.advance(0.5);
        const o = chem.classify(t.contents).outcome;
        assert.notEqual(o, 'negative', `${id}/${kind}/${setting}: nach ${s} s negativ`);
        if (o === 'positive') break;
      }
    }
  }
});

test('R5: Ketone werden erst nach ausreichender Beobachtungszeit negativ (Tollens auch bei Raumtemperatur)', () => {
  for (const id of KETONES) {
    const lab = newLab();
    const t = tollens(lab, 1, id, { heat: false, seconds: 60 });
    assert.equal(chem.classify(t.contents).outcome, 'unfinished', id + ' nach 60 s');
    lab.advance(400);
    assert.equal(chem.classify(t.contents).outcome, 'negative', id + ' nach mehreren Minuten');
  }
});

test('R6: Zu heißes Bad – überwiegend fein verteiltes Silber ist positiv; Beobachtung „grau“ genügt', () => {
  const lab = newLab();
  const t = tollens(lab, 1, 'propanal', { setting: 80, seconds: 40 });
  const c = t.contents;
  assert.ok(c.ag > 0.97);
  assert.ok(c.agFilm / c.ag < 0.6, 'überwiegend fein verteilt');
  const m = chem.classify(c);
  assert.equal(m.outcome, 'positive');
  assert.match(m.title, /fein verteiltes Silber/);
  assert.match(m.explanation, /Ag₂O/);
  const ap = chem.appearance(c);
  assert.ok(ap.mirror < 0.9 && ap.turb[3] > 0.5, 'Teilspiegel und dunkle Trübung');
  const g = chem.gradeProtocol(m, { method: 'tollens', observations: ['grau'], result: 'positiv', interpretation: 'reduzierend', cls: 'aldehyd' });
  assert.ok(g.allCorrect);
});

test('R6: Modellhinweis benennt den beschleunigten Versuch im Wasserbad sichtbar in der Auswertung', () => {
  const f = chem.classify(fehling(newLab(), 1, 'ethanal').contents);
  const t = chem.classify(tollens(newLab(), 1, 'ethanal').contents);
  assert.match(f.modelNote, /beschleunigten Versuch im heißen Wasserbad/);
  assert.match(t.modelNote, /Raumtemperatur/);
});

test('Ergebnisübersicht: Späterer ungültiger Versuch löscht frühere gültige Evidenz nicht', () => {
  const lab = newLab('analysis');
  const s = lab.state.samples[0];
  fehling(lab, 1, s.sampleId); lab.recordProtocol(1, null, { solutionShown: true });
  act(lab, () => lab.replaceTube(1));
  fehling(lab, 1, s.sampleId, { reagents: ['fehling1'] }); lab.recordProtocol(1, null, { solutionShown: true });
  const row = lab.overview()[0];
  assert.equal(row.fehling.model.outcome, 'invalid', 'letzter Versuch');
  assert.ok(['positive', 'negative'].includes(row.fehlingEvidence.model.outcome), 'gültige Evidenz bleibt');
  assert.equal(lab.analysisResult({})[0].hasEvidence, true);
});

test('Tollens-Hinweise im regulären Ablauf: frisch ansetzen, Reste nicht aufbewahren', () => {
  const lab = newLab();
  const msgs = [];
  lab.on('message', (m) => msgs.push(m.text));
  tollens(lab, 1, null, { heat: false, seconds: 0 });
  assert.ok(msgs.some((m) => /frisch ansetzen/.test(m)));
  act(lab, () => lab.replaceTube(1));
  assert.ok(msgs.some((m) => /nicht aufbewahren/.test(m)));
});

test('Textbeschreibung für Screenreader beschreibt den sichtbaren Zustand ohne Deutung', () => {
  const t = fehling(newLab(), 1, 'ethanal');
  const d = chem.describe(t.contents);
  assert.match(d, /orange-roter/);
  assert.ok(!/positiv|Aldehyd/.test(d));
  const s = tollens(newLab(), 1, 'ethanal');
  assert.match(chem.describe(s.contents), /silbriger Belag/);
});
