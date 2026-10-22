'use strict';
// Zucker als Feststoffe (Lernmodus), Siedeverzug nur mit Flüssigkeit, Abkühlen des Wasserbads.
const test = require('node:test');
const assert = require('node:assert/strict');
const chem = require('../../js/chemistry.js');
const { fehling, tollens, newLab, act, addAll } = require('./helpers.js');

const REDUCING = ['glucose', 'fructose', 'maltose'];

test('Zucker: Glucose, Fructose und Maltose positiv, Saccharose negativ – in beiden Nachweisen', () => {
  for (const id of [...REDUCING, 'saccharose']) {
    for (const run of [fehling, tollens]) {
      const lab = newLab();
      const t = run(lab, 1, id, { seconds: 60 });
      const m = chem.classify(t.contents);
      if (id === 'saccharose') {
        assert.equal(m.outcome, 'negative', id + ' ' + m.method);
        assert.equal(m.cls, 'nichtReduzierenderZucker');
        assert.match(m.explanation, /anomeren C-Atome/);
        assert.equal(t.contents.progress, 0);
      } else {
        assert.equal(m.outcome, 'positive', id + ' ' + m.method);
        assert.equal(m.cls, 'reduzierenderZucker');
      }
    }
  }
});

test('Zucker: fachliche Erklärungen – Glucoson-Hinweis, Endiol bei Fructose, freies anomeres C bei Maltose', () => {
  const ex = (id) => chem.classify(fehling(newLab(), 1, id, { seconds: 60 }).contents).explanation;
  assert.match(ex('glucose'), /Gluconsäure/);
  assert.match(ex('glucose'), /OH-Gruppe an C2 zur Ketogruppe/);
  assert.match(ex('fructose'), /Keto-Enol-Tautomerie/);
  assert.match(ex('fructose'), /Endiol/);
  assert.match(ex('maltose'), /anomere C-Atom der zweiten Einheit/);
  const g = chem.gradeProtocol(chem.classify(fehling(newLab(), 1, 'fructose', { seconds: 60 }).contents),
    { method: 'fehling', observations: ['ziegelrot'], result: 'positiv', interpretation: 'reduzierend', cls: 'aldehyd' });
  assert.equal(g.cls, false, 'Fructose ist kein Aldehyd – Stoffklasse „reduzierender Zucker“');
});

test('Zucker: Fructose reagiert im Modell nicht langsamer als Glucose (Endiol-Bildung)', () => {
  const g = fehling(newLab(), 1, 'glucose', { seconds: 8 });
  const f = fehling(newLab(), 1, 'fructose', { seconds: 8 });
  assert.ok(f.contents.cu2o >= g.contents.cu2o, `Fructose ${f.contents.cu2o} vs. Glucose ${g.contents.cu2o}`);
});

test('Feststoff: Spatelspitze ändert das Flüssigkeitsvolumen nicht und muss sich erst lösen', () => {
  const c = chem.createContents();
  chem.add(c, 'fehling1'); chem.add(c, 'fehling2'); c.mix = 1;
  const vol = chem.volume(c);
  chem.add(c, 'glucose');
  assert.equal(chem.volume(c), vol, 'Feststoff zählt nicht zum Volumen');
  assert.equal(c.solid, 1);
  assert.equal(c.dissolved, 0);
  assert.equal(c.mix, 1, 'Feststoff schichtet nicht wie eine Lösung');
  assert.equal(chem.classify(c).title, 'Feststoff noch nicht gelöst');
  assert.match(chem.describe(c), /ungelöste weiße Kristalle/);
  // ungelöst: keine Beobachtungszeit, keine Reaktion
  c.temp = 80;
  chem.step(c, 0.05, 80, 1000);
  assert.equal(c.exposure, 0);
  chem.dissolve(c, 1);
  assert.equal(c.dissolved, 1);
});

test('Feststoff: Schütteln löst schneller; höchstens drei Spatelportionen; trockener Feststoff ist kein Nachweis', () => {
  const lab = newLab();
  act(lab, () => lab.selectTube(1));
  addAll(lab, 1, ['glucose']);
  const t = lab.tubeById(1);
  assert.equal(chem.volume(t.contents), 0);
  assert.equal(chem.analyze(t.contents).system, 'none');
  assert.equal(chem.describe(t.contents), 'weiße Kristalle, trocken');
  addAll(lab, 1, ['glucose', 'glucose']);
  assert.equal(chem.canAdd(t.contents, 'glucose').ok, false);
  addAll(lab, 1, ['fehling1', 'fehling2']);
  const before = t.contents.dissolved;
  act(lab, () => lab.shake(1));
  assert.ok(t.contents.dissolved >= before + 0.5, 'Schütteln beschleunigt das Lösen');
  lab.setHotplate(80);
  act(lab, () => lab.moveTube(1, 'bath'));
  lab.advance(40);
  assert.equal(chem.classify(t.contents).outcome, 'positive');
});

test('Zucker: kein falsch negativer Befund bei reduzierenden Zuckern (60/80 °C, Tollens auch kalt)', () => {
  for (const id of REDUCING) {
    for (const [run, setting] of [[fehling, 60], [fehling, 80], [tollens, 60], [tollens, 0]]) {
      const lab = newLab();
      const t = run(lab, 1, id, { seconds: 0, setting, heat: setting > 0 });
      for (let s = 0; s < 900; s += 0.5) {
        lab.advance(0.5);
        const o = chem.classify(t.contents).outcome;
        assert.notEqual(o, 'negative', `${id}/${setting}: nach ${s} s negativ`);
        if (o === 'positive') break;
      }
    }
  }
});

test('Probensätze: Lernmodus mit Zuckern, Analysemodus nur mit Aldehyden/Ketonen; Sitzungsimport prüft den Satz', () => {
  const lab = newLab('learn');
  assert.equal(lab.state.samples.length, 10);
  const learnSession = lab.exportSession();
  lab.setMode('analysis');
  assert.equal(lab.state.samples.length, 6);
  assert.ok(lab.state.samples.every((s) => !chem.SAMPLE_BY_ID[s.sampleId].solid));
  assert.equal(lab.importSession(learnSession), true);
  assert.equal(lab.state.samples.length, 10);
  const broken = Object.assign({}, learnSession, { samples: learnSession.samples.slice(0, 6) });
  assert.equal(lab.importSession(broken), false, 'unvollständiger Lern-Probensatz wird abgelehnt');
});

test('Siedeverzug nur mit Flüssigkeit: leeres Glas und trockener Zucker in der Flamme bleiben unversehrt', () => {
  for (const content of [[], ['glucose']]) {
    const lab = newLab();
    let safety = 0;
    lab.on('safety', () => safety++);
    act(lab, () => lab.selectTube(1));
    if (content.length) addAll(lab, 1, content);
    lab.toggleBurner(true);
    act(lab, () => lab.moveTube(1, 'flame'));
    lab.advance(10);
    assert.equal(lab.tubeById(1).contents.bumped, false, JSON.stringify(content));
    assert.equal(safety, 0);
  }
});

test('Wasserbad kühlt nach dem Zurückschalten spürbar ab (Newtonsches Abkühlen im Zeitraffer)', () => {
  const lab = newLab();
  lab.setHotplate(80); lab.advance(30);
  assert.ok(lab.state.bath.temp > 79);
  lab.setHotplate(60); lab.advance(15);
  assert.ok(lab.state.bath.temp < 61 && lab.state.bath.temp > 59.5, '80 → 60 °C: ' + lab.state.bath.temp);
  lab.setHotplate(80); lab.advance(30);
  lab.setHotplate(0); lab.advance(30);
  assert.ok(lab.state.bath.temp < 45, 'aus nach 30 s: ' + lab.state.bath.temp);
  lab.advance(300);
  assert.ok(lab.state.bath.temp >= 20 && lab.state.bath.temp < 21, 'nähert sich der Raumtemperatur: ' + lab.state.bath.temp);
});
