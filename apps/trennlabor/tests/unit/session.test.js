'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newSession, must, k02Positive, chromatogram, taskById, session: S } = require('./helpers.js');

const K02_GAPS = { loes: 'löslich', unl: 'unlöslich', rue: 'Rückstand', fil: 'Filtrat', ein: 'Eindampfen' };

test('A-01: drei Labore mit allen Pflichtaufgaben; Expertenaufgabe nur im Expertenmodus', () => {
  const s = newSession();
  assert.deepEqual(s.LABS.map((l) => l.id), ['classic', 'chroma', 'distill']);
  assert.deepEqual(s.tasksOf('classic').map((t) => t.id), ['K-01', 'K-02', 'K-03', 'K-04', 'K-05']);
  assert.deepEqual(s.tasksOf('chroma').map((t) => t.id), ['C-1', 'C-2', 'C-3']);
  assert.deepEqual(s.tasksOf('distill').map((t) => t.id), ['D-1']);
  assert.equal(s.selectTask('C-4').ok, false);
  s.setExpert(true);
  assert.deepEqual(s.tasksOf('chroma').map((t) => t.id), ['C-1', 'C-2', 'C-3', 'C-4']);
  for (const t of S.ALL_TASKS) {
    assert.ok(t.problem && t.goal && t.materials.length, t.id + ': Aufgabe vollständig');
    assert.ok(t.theory.length >= 2, t.id + ': Theorie');
    assert.ok(Object.keys(t.gaps.gaps).length >= 2, t.id + ': Lückentext');
    for (const k of Object.keys(t.gaps.gaps)) assert.ok(t.gaps.text.includes('{' + k + '}'), t.id + ' Lücke ' + k);
    const e = t.createEngine();
    const nb = t.notebook(e);
    assert.deepEqual(nb.sections.map((x) => x[0]), ['Versuch', 'Beobachtung', 'Erklärung', 'Merksatz'], t.id + ': Hefteintrag gegliedert');
  }
});

test('L-02/L-04: Auswertung gesperrt bis zum Erfolg; Hefteintrag erst nach richtiger Auswertung', () => {
  const s = newSession();
  s.selectTask('K-02');
  assert.equal(s.evaluation().unlocked, false);
  assert.equal(s.submit({}).ok, false);
  assert.equal(s.theory().unlocked, false);
  k02Positive(s.engine());
  s.checkProgress();
  const ev = s.evaluation();
  assert.ok(ev.unlocked);
  assert.ok(ev.observations.every((o) => o.correct === undefined), 'keine Lösungen an die Oberfläche');
  // falsche Beobachtung, falscher Fachbegriff, Tippfehler
  let r = s.submit({ obs: { dissolve: 'settled', residue: 'sand', dish: 'crystals' }, gaps: Object.assign({}, K02_GAPS, { ein: 'Destillieren', unl: 'unlöslih' }) });
  assert.equal(r.ok, false);
  assert.equal(r.results.obs.dissolve.status, 'wrong');
  assert.equal(r.results.obs.residue.status, 'correct');
  assert.equal(r.results.gaps.ein.status, 'wrong');
  assert.match(r.results.gaps.ein.hint, /Destillieren/);
  assert.equal(r.results.gaps.unl.status, 'typo', 'Tippfehler toleriert');
  assert.equal(s.theory().unlocked, false);
  // richtige Antworten bleiben erhalten
  assert.equal(s.meta().drafts.obs.residue, 'sand');
  assert.equal(s.meta().drafts.gaps.rue, 'Rückstand');
  r = s.submit({ obs: { dissolve: 'dissolved' }, gaps: { ein: 'Eindampfen' } });
  assert.ok(r.ok);
  const th = s.theory();
  assert.ok(th.unlocked);
  assert.equal(th.notebook, null, 'Hefteintrag nach den Theorieschritten');
  s.showAllTheory();
  assert.equal(s.theory().notebook.title, 'Trennung von Sand und Kochsalz');
});

test('L-02: Beobachtungen beziehen sich auf den tatsächlichen Versuch (z. B. Filterrückstand)', () => {
  const t = taskById('K-02');
  const lab = t.createEngine();
  must(lab, () => lab.insertFilter('paper'));
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(30);
  const o = t.observations(lab).find((x) => x.id === 'residue');
  assert.equal(o.correct, 'both', 'trocken filtriert: Sand und Kochsalz im Filter');
  const lab2 = k02Positive(t.createEngine());
  assert.equal(t.observations(lab2).find((x) => x.id === 'residue').correct, 'sand');
});

test('Ein gelungener Versuch wird durch späteres Herumprobieren nicht rückwirkend falsch (Schnappschuss)', () => {
  const s = newSession();
  s.selectTask('K-02');
  const lab = s.engine();
  k02Positive(lab);
  s.checkProgress();
  // danach alles in den Ausguss
  must(lab, () => lab.pour('B2', 'waste', 'all'));
  lab.advance(30);
  s.checkProgress();
  assert.equal(s.task().check(lab).success, true, 'Salz bleibt in der Schale');
  must(lab, () => lab.addWater('D', 25));
  lab.advance(50); s.checkProgress();
  assert.equal(s.task().check(lab).success, false, 'aktueller Zustand nicht mehr erfolgreich');
  const r = s.submit({ obs: { dissolve: 'dissolved', residue: 'sand', dish: 'crystals' }, gaps: K02_GAPS });
  assert.ok(r.ok, 'Auswertung bezieht sich auf den Versuchsstand beim Erfolg');
});

test('L-01: genau drei Hilfestufen, zustandsabhängig; Angebot nach wiederholtem Fehler; konkrete Hilfe mit Wortauswahl', () => {
  const s = newSession();
  s.selectTask('K-02');
  assert.equal(s.HELP_LEVELS.length, 3);
  assert.equal(s.help().level, 0);
  assert.equal(s.help().text, '');
  s.setHelp(1);
  const small0 = s.help().text;
  s.setHelp(2);
  const concrete0 = s.help().text;
  assert.notEqual(small0, concrete0);
  assert.match(concrete0, /Wasser/);
  assert.equal(s.setHelp(3).ok, true); assert.equal(s.help().level, 2, 'keine vierte Stufe');
  s.setHelp(0);
  // Zustand ändern → andere Hilfe
  const lab = s.engine();
  must(lab, () => lab.addWater('B1', 50)); must(lab, () => lab.stir('B1'));
  s.setHelp(2);
  assert.notEqual(s.help().text, concrete0, 'Hilfe hängt vom Zustand ab');
  assert.match(s.help().text, /Filterpapier|Trichter/);
  // wiederholter Fehler → Angebot
  const s2 = newSession();
  s2.selectTask('K-02');
  const l2 = s2.engine();
  assert.equal(s2.help().offer, false);
  must(l2, () => l2.pour('B1', 'F', 'all')); // trocken + ohne Papier
  assert.equal(s2.help().offer, true);
  assert.equal(s2.help().text, '', 'Angebot, keine ungefragte Lösung');
  s2.setHelp(1);
  assert.equal(s2.help().offer, false);
  assert.ok(s2.help().text.length > 10);
  assert.equal(s2.help().wordBank, null);
  s2.setHelp(2);
  assert.ok(Array.isArray(s2.help().wordBank));
});

test('L-01: Angebot nach zwei falschen Auswertungen', () => {
  const s = newSession();
  s.selectTask('K-02');
  k02Positive(s.engine()); s.checkProgress();
  s.submit({ obs: { dissolve: 'settled' } });
  assert.equal(s.help().offer, false);
  s.submit({ obs: { dissolve: 'floated' } });
  assert.equal(s.help().offer, true);
});

test('L-05: Neu beginnen setzt nur den aktuellen Versuch zurück, abgeschlossene Aufgaben bleiben', () => {
  const s = newSession();
  s.selectTask('K-02');
  k02Positive(s.engine()); s.checkProgress();
  s.submit({ obs: { dissolve: 'dissolved', residue: 'sand', dish: 'crystals' }, gaps: K02_GAPS });
  assert.ok(s.meta('K-02').completedAt);
  s.resetExperiment();
  assert.equal(s.engine().describe('D').saltSolid, 0, 'neuer Ansatz');
  assert.ok(s.meta('K-02').completedAt, 'Abschluss bleibt');
  assert.ok(s.theory().unlocked);
  s.resetAll();
  assert.equal(s.meta('K-02').completedAt, null);
});

test('Chromatographie-Aufgaben: Erfolg nur mit eigenen, sauberen Chromatogrammen; Antworten aus dem eigenen Ergebnis', () => {
  const s = newSession();
  s.setExpert(true);
  s.selectTask('C-1');
  const lab = s.engine();
  chromatogram(lab, ['black', 'green', 'refBlue'], { tool: 'ballpoint' });
  assert.equal(s.task().check(lab).success, false, 'gestört durch Kugelschreiber');
  chromatogram(lab, ['black', 'green', 'refBlue']);
  assert.ok(s.task('C-1').check(lab).success);
  const obs = s.task('C-1').observations(lab);
  assert.equal(obs.find((o) => o.id === 'n_black').correct, 3);
  assert.equal(obs.find((o) => o.id === 'n_refBlue').correct, 1);
  assert.equal(s.task('C-2').check(lab).success, false, 'Violett fehlt');
  chromatogram(lab, ['purple', 'perm']);
  assert.ok(s.task('C-2').check(lab).success, 'Grün und Violett im selben Laufmittel (zwei Papiere)');
  assert.equal(s.task('C-2').observations(lab).find((o) => o.id === 'common').correct, 'blue');
  assert.equal(s.task('C-3').check(lab).success, false, 'Ethanol fehlt');
  chromatogram(lab, ['perm'], { eluent: 'ethanol', seconds: 1500 });
  assert.ok(s.task('C-3').check(lab).success);
  const o3 = s.task('C-3').observations(lab);
  assert.equal(o3.find((o) => o.id === 'water').correct, 'stays');
  assert.equal(o3.find((o) => o.id === 'ethanol').correct, 'moves');
  // C-4: Rf aus eigener Messung
  const o4 = s.task('C-4').observations(lab);
  const last = lab.state.paper;
  const front = o4.find((o) => o.id === 'front');
  assert.ok(Math.abs(front.correct - (last.frontMark.y - last.line.y)) < 0.01, 'Laufmittelstrecke aus der eigenen Markierung');
  const rfPerm = o4.find((o) => o.id === 'rf_permBlack');
  assert.ok(rfPerm && Math.abs(rfPerm.correct - 0.74) < 0.01, 'Rf aus dem eigenen Chromatogramm');
  // ohne gültige Front kein Rf
  const s2 = newSession(); s2.setExpert(true); s2.selectTask('C-4');
  chromatogram(s2.engine(), ['black'], { mark: false });
  assert.equal(s2.task().check(s2.engine()).success, false);
  assert.equal(s2.task().observations(s2.engine())[0].correct, null);
});

test('D-1: Messaufgabe nur mit richtig sitzendem Thermometer; Brennprobe muss vom Destillat stammen', () => {
  const { buildDistill } = require('./helpers.js');
  const t = taskById('D-1');
  const bad = buildDistill({ thermo: 'high' }); bad.setHeater(3); bad.advance(800); bad.takeSample('A'); bad.ignite('dish');
  const r = t.check(bad);
  assert.equal(r.success, false);
  assert.equal(r.items[1].ok, false);
  assert.equal(t.observations(bad).find((o) => o.id === 'first').correct, null);
  const good = buildDistill(); good.setHeater(3); good.advance(800); good.takeSample('A'); good.ignite('dish');
  assert.ok(t.check(good).success);
  const obs = t.observations(good);
  assert.ok(Math.abs(obs.find((o) => o.id === 'first').correct - good.state.firstDrop.read) < 1e-9);
  assert.equal(obs.find((o) => o.id === 'trend').correct, 'rise');
  assert.equal(obs.find((o) => o.id === 'flame').correct, 'burns');
});

test('Sitzungsspeicher: Export/Import erhält Versuchszustand, Entwürfe und Abschlüsse', () => {
  const s = newSession();
  s.selectTask('K-02');
  k02Positive(s.engine()); s.checkProgress();
  s.saveDraft('gaps', 'loes', 'löslich');
  const data = JSON.parse(JSON.stringify(s.exportSession()));
  const s2 = newSession();
  assert.ok(s2.importSession(data));
  assert.equal(s2.currentTaskId(), 'K-02');
  assert.equal(s2.meta().drafts.gaps.loes, 'löslich');
  assert.ok(Math.abs(s2.engine().describe('D').saltSolid - s.engine().describe('D').saltSolid) < 1e-9);
  assert.ok(s2.evaluation().unlocked);
});

test('A-04: Zeitraffer und Pause in der Sitzung ändern nur die Geschwindigkeit', () => {
  const s = newSession();
  s.selectTask('K-01');
  s.setPaused(true);
  s.update(0.1);
  assert.equal(s.engine().state.t, 0, 'Pause');
  s.setSpeed(10);
  s.update(0.1);
  assert.ok(Math.abs(s.engine().state.t - 0.1 * 6 * 10) < 0.051);
  assert.equal(s.effective(), 60);
});
