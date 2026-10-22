'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../js/core.js');
const { tasks, classic, chroma, distill, run, K, sandSaltPath, chromaRun, buildDistill } = require('./helpers.js');

const T = tasks.ALL;
const G = tasks.GAPS;
const gap = (id, v) => core.checkGap(Object.assign({ id }, G[id]), v);

test('Lückentext: Normalisierung (Groß-/Kleinschreibung, Umlaute, Leerzeichen) und Synonyme', () => {
  assert.equal(gap('loeslichkeit', 'Loeslichkeit').status, 'correct');
  assert.equal(gap('loeslichkeit', '  löslichkeit ').status, 'correct');
  assert.equal(gap('rueckstand', 'Filterrückstand').status, 'correct');
  assert.equal(gap('sediment', 'Sedimentation').status, 'correct');
  assert.equal(gap('ethanol', 'Alkohol').status, 'correct');
  assert.equal(gap('dekant', 'Dekantation').status, 'correct');
  assert.equal(gap('mobil', 'Mobile').status, 'correct');
});

test('Lückentext: fachlich falscher Begriff wird gezielt abgelehnt (Absorption ≠ Adsorption)', () => {
  const r = gap('adsorption', 'Absorption');
  assert.equal(r.status, 'forbidden');
  assert.match(r.feedback, /Oberfläche/);
  assert.equal(core.gapOk(r), false);
  assert.equal(gap('adsorption', 'Adsorption').status, 'correct');
  assert.equal(gap('rueckstand', 'Filtrat').status, 'forbidden');
  assert.equal(gap('stoffgemisch', 'Reinstoff').status, 'forbidden');
  assert.equal(gap('verdampft', 'kondensiert').status, 'forbidden');
});

test('Lückentext: ein Tippfehler in langen Wörtern wird toleriert (mit Hinweis), zwei nicht, falsche Wörter nicht', () => {
  const t = gap('kristall', 'kristalisiert');
  assert.equal(t.status, 'typo');
  assert.ok(core.gapOk(t));
  assert.match(t.feedback, /kristallisiert/);
  assert.equal(gap('filtrieren', 'Fitrieen').status, 'near');
  assert.equal(core.gapOk(gap('filtrieren', 'Fitrieen')), false);
  assert.equal(gap('filtrieren', 'Destillieren').status, 'wrong');
  assert.equal(gap('t78', '87').status, 'wrong', 'kurze Zahlen werden nicht unscharf akzeptiert');
  assert.equal(gap('t78', '78 °C').status, 'correct');
  assert.equal(gap('filtrat', '').status, 'empty');
});

test('Antwortprüfung: Auswahl, Mehrfachauswahl, Zahl mit Komma, Lückentext je Lücke', () => {
  const q = { type: 'number', check: (v) => Math.abs(v - 4.5) <= 0.3, wrong: 'x' };
  assert.ok(tasks.checkAnswer(q, '4,6').ok);
  assert.equal(tasks.checkAnswer(q, '5,2').ok, false);
  assert.equal(tasks.checkAnswer(q, '').empty, true);
  const m = { type: 'multi', correct: ['hot', 'stir'], wrong: 'x' };
  assert.ok(tasks.checkAnswer(m, ['stir', 'hot']).ok);
  assert.equal(tasks.checkAnswer(m, ['hot']).ok, false);
  const gq = { type: 'gap', gaps: [Object.assign({ id: 'a' }, G.filtrat), Object.assign({ id: 'b' }, G.eindampfen)] };
  const r = tasks.checkAnswer(gq, { a: 'Filtrat', b: 'Sieben' });
  assert.equal(r.ok, false);
  assert.equal(r.gaps[0].status, 'correct');
  assert.equal(r.gaps[1].status, 'wrong');
});

test('Wortauswahl nur als Liste der Begriffe plus Ablenker (für konkrete Hilfe)', () => {
  const q = T['K-02'].questions({ saltMass: 4 }).find((x) => x.type === 'gap');
  const wb = tasks.wordbank(q);
  for (const g of q.gaps) assert.ok(wb.includes(g.accept[0]));
  assert.ok(wb.length > q.gaps.length);
});

test('Jede Aufgabe hat Problem, Bewertung, Hilfe, Fragen, Theorie und vollständigen Hefteintrag', () => {
  assert.deepEqual(Object.keys(tasks.LABS), ['classic', 'chroma', 'distill']);
  assert.deepEqual(tasks.LABS.classic.tasks, ['K-01', 'K-02', 'K-03', 'K-04', 'K-05']);
  for (const id of Object.keys(T)) {
    const t = T[id];
    for (const k of ['title', 'problem', 'material', 'evaluate', 'help', 'questions', 'theory', 'notebook']) assert.ok(t[k], `${id}: ${k}`);
    assert.ok(t.theory.length >= 3);
  }
});

test('Bewertung beruht auf dem Zustand: frischer Versuch gilt nie als gelöst', () => {
  for (const id of ['K-01', 'K-02', 'K-03', 'K-04', 'K-05']) assert.equal(T[id].evaluate(K(id)).success, false, id);
  const c = chroma.createEngine();
  for (const id of ['C-1', 'C-2', 'C-3']) assert.equal(T[id].evaluate(c).success, false, id);
  assert.equal(T['D-1'].evaluate(distill.createEngine()).success, false);
});

test('Hilfe ist zustandsabhängig: K-02 vom Anfang bis zum Eindampfen jeweils passende Hinweise', () => {
  const e = K('K-02');
  let h = T['K-02'].help(e);
  assert.match(h.small, /löst/);
  run(e, 'setPaper', 'folded');
  run(e, 'move', 'E', 'filter');
  run(e, 'pour', 'M', 'F', 'all');
  h = T['K-02'].help(e);
  assert.match(h.small, /trockene Feststoffe/);
  assert.match(h.concrete, /Rückstand/);
  run(e, 'scrape', 'F', 'A');
  run(e, 'addWater', 'A', 50);
  h = T['K-02'].help(e);
  assert.match(h.concrete, /Rühre|Filterpapier|Trichter/);
  // kleine Hilfe nennt keine Lösung, konkrete nennt die Handlung
  assert.ok(h.small.length < h.concrete.length);
});

test('Hilfe Destillation folgt dem Aufbau und erkennt Fehler (Schläuche vertauscht, Stopfen)', () => {
  const e = distill.createEngine();
  assert.match(T['D-1'].help(e).concrete, /Heizpilz/);
  buildDistill(e, { hoses: 'reversed' });
  assert.match(T['D-1'].help(e).concrete, /Zulauf unten/);
  const f = distill.createEngine();
  buildDistill(f, { stopper: true });
  assert.match(T['D-1'].help(f).concrete, /Stopfen/);
});

test('Fragen beziehen sich auf den eingefrorenen Erfolgszustand (K-02: Salzmasse)', () => {
  const e = K('K-02');
  sandSaltPath(e);
  const r = T['K-02'].evaluate(e);
  assert.ok(r.success);
  const q3 = T['K-02'].questions(r.snapshot).find((q) => q.id === 'q3');
  assert.ok(q3.check(r.snapshot.saltMass));
  assert.equal(q3.check(r.snapshot.saltMass + 1), false);
  // Späteres Herumprobieren ändert den eingefrorenen Schnappschuss nicht
  const frozen = JSON.stringify(r.snapshot);
  run(e, 'pour', 'D', 'waste', 'all');
  assert.equal(JSON.stringify(r.snapshot), frozen);
  assert.equal(T['K-02'].evaluate(e).success, false, 'der aktuelle Zustand ist danach nicht mehr gelöst');
});

test('C-1: Zonenzahlen in den Fragen entsprechen dem eigenen Chromatogramm (auch bei Ethanol-Wasser)', () => {
  const e = chroma.createEngine();
  chromaRun(e, { samples: ['schwarz', 'gruen', 'gelb'], solvent: 'etoh', seconds: 1300 });
  const r = T['C-1'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  const green = r.snapshot.items.find((i) => i.sampleId === 'gruen');
  assert.equal(green.count, 1, 'in Ethanol-Wasser verschmelzen Gelb und Blau');
  const qs = T['C-1'].questions(r.snapshot);
  assert.ok(qs.find((q) => q.id === 'z1').check(1));
  const mix = qs.find((q) => q.id === 'mix');
  assert.ok(!mix.correct.includes('gruen'), 'Grün gilt hier nicht als sicher gemischt');
  const pure = qs.find((q) => q.id === 'pure');
  assert.equal(pure.correct, 'maybe', 'Vorbehalt: eine Zone ist kein Reinheitsbeweis');
});

test('D-1: Antwort zur Temperatur akzeptiert nur abgelesene Dampftemperaturen, nicht 78 °C', () => {
  const e = distill.createEngine();
  buildDistill(e);
  run(e, 'setHeater', 3);
  e.advance(500);
  run(e, 'takeSample', 'receiver');
  run(e, 'ignite', 'dish');
  const r = T['D-1'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  const q1 = T['D-1'].questions(r.snapshot).find((q) => q.id === 'q1');
  assert.ok(q1.check(r.snapshot.tMin));
  assert.ok(!q1.check(78));
  assert.ok(!q1.check(100));
});

test('Alternative Wege führen ebenfalls zum Ziel (A-02)', () => {
  // K-01 über Filtrieren statt Dekantieren
  const a = K('K-01');
  run(a, 'setPaper', 'folded'); run(a, 'move', 'E', 'filter'); run(a, 'pour', 'A', 'F', 'all'); a.advance(150);
  assert.ok(T['K-01'].evaluate(a).success);
  // K-02 über Dekantieren der Salzlösung und Nachspülen statt Filtrieren
  const b = K('K-02');
  run(b, 'pour', 'M', 'A', 'all'); run(b, 'addWater', 'A', 50); run(b, 'stir', 'A'); b.advance(120);
  run(b, 'pour', 'A', 'D', 'careful');
  run(b, 'addWater', 'A', 10); run(b, 'stir', 'A'); b.advance(120); run(b, 'pour', 'A', 'D', 'careful');
  run(b, 'move', 'D', 'heater'); run(b, 'setHeater', 1); b.advance(2600);
  const rb = T['K-02'].evaluate(b);
  assert.ok(rb.success, JSON.stringify(rb.problems));
  // K-05 mit kaltem Wasser, Erwärmen auf der Heizplatte und Filtrieren
  const c = K('K-05');
  run(c, 'pour', 'P', 'A', 'all'); run(c, 'addWater', 'A', 50); run(c, 'addWater', 'A', 50);
  run(c, 'move', 'A', 'heater'); run(c, 'setHeater', 2); c.advance(200); run(c, 'setHeater', 0); c.advance(300);
  run(c, 'move', 'A', 'bench');
  run(c, 'setPaper', 'folded'); run(c, 'move', 'B', 'filter'); run(c, 'pour', 'A', 'F', 'all'); c.advance(200);
  const rc = T['K-05'].evaluate(c);
  assert.ok(rc.success, JSON.stringify(rc.problems));
  // K-04 ohne Scheidetrichter (obere Schicht abgießen) ist ungenauer
  const d = K('K-04');
  d.advance(200);
  run(d, 'pour', 'A', 'B', 'upper');
  assert.ok(d.vessel('B').c.water > 2, 'Abgießen der oberen Schicht reißt Wasser mit');
  assert.equal(T['K-04'].evaluate(d).success, false);
});
