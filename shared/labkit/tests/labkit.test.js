// Unit-Tests der Labkit-Bausteine (ohne DOM). Aufruf: npm test (in shared/labkit)
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');
const { clampPanelWidth, MIN_PANEL, MAX_PANEL, MIN_STAGE } = require('../js/splitter.js');

test('Feste Zeitschritte: gleiche Modellzeit ergibt gleiche Schrittzahl, unabhängig von der Stückelung', () => {
  const run = (chunks) => { let n = 0; const c = core.createClock({ step: () => { n++; } }); chunks.forEach((x) => c.advance(x)); return n; };
  assert.equal(run([10]), 200);
  assert.equal(run(Array(1000).fill(0.01)), 200);
  assert.equal(run([3.3, 0.07, 6.63]), 200);
});

test('Begriffsprüfung: richtig, Tippfehler, gesperrter Begriff, falsch, leer', () => {
  const gap = { accept: ['Adsorption'], forbid: [{ term: 'Absorption', hint: 'Absorption heißt Aufsaugen.' }], hint: 'Gemeint ist das Anhaften.' };
  assert.equal(core.checkGap(gap, ' adsorption ').status, 'correct');
  assert.equal(core.checkGap(gap, 'Adsorbtion').status, 'typo');
  assert.ok(core.gapOk(core.checkGap(gap, 'Adsorbtion')));
  assert.equal(core.checkGap(gap, 'Absorption').status, 'forbidden');
  assert.equal(core.checkGap(gap, 'Lösung').status, 'wrong');
  assert.equal(core.checkGap(gap, '').status, 'empty');
  assert.equal(core.checkGap({ accept: ['stationäre', 'stationaere'] }, 'Stationaere').status, 'correct');
});

test('Zahlen und Formatierung im deutschen Format', () => {
  assert.equal(core.parseNum('0,62'), 0.62);
  assert.equal(core.parseNum(' 4.5 cm'), 4.5);
  assert.ok(Number.isNaN(core.parseNum('')));
  assert.equal(core.fmt(0.6249, 2), '0,62');
  assert.equal(core.fmtTime(125), '2:05');
});

test('Trennlinie: Bedienfeldbreite bleibt in sinnvollen Grenzen', () => {
  assert.equal(clampPanelWidth(100, 1440), MIN_PANEL);
  assert.equal(clampPanelWidth(2000, 1440), MAX_PANEL);
  assert.equal(clampPanelWidth(400, 1440), 400);
  // Bühne behält mindestens MIN_STAGE
  assert.equal(clampPanelWidth(600, 900), 900 - MIN_STAGE);
  assert.ok(clampPanelWidth(600, 600) >= MIN_PANEL);
  // optional größere Mindestbreite der Bühne je App (Labkit 0.1.1)
  assert.equal(clampPanelWidth(600, 1024, 600), 1024 - 600);
  assert.equal(clampPanelWidth(600, 1440, 600), 600);
  assert.equal(clampPanelWidth(600, 900, undefined), 900 - MIN_STAGE);
});

test('Ereignisverteiler: an- und abmelden', () => {
  const e = core.emitter();
  let n = 0;
  const off = e.on('x', () => n++);
  e.emit('x'); off(); e.emit('x');
  assert.equal(n, 1);
});

test('Fokus (0.2.0): Auswahllisten nur nach Tastaturbedienung erneut fokussieren, Textfelder immer', () => {
  const el = (tagName) => ({ tagName, focused: 0, sel: null, focus() { this.focused++; }, setSelectionRange(a, b) { this.sel = [a, b]; } });
  core.noteInput('pointer');
  const s1 = el('SELECT');
  assert.equal(core.restoreFocus(s1), false, 'nach Antippen: Auswahlliste bleibt zu (iPad öffnete sie sonst erneut)');
  assert.equal(s1.focused, 0);
  const t = el('TEXTAREA');
  assert.equal(core.restoreFocus(t, [3, 5]), true);
  assert.equal(t.focused, 1); assert.deepEqual(t.sel, [3, 5]);
  core.noteInput('keyboard');
  assert.equal(core.lastInputKeyboard(), true);
  const s2 = el('select');
  assert.equal(core.restoreFocus(s2), true, 'nach Tastatur: Fokus zurück, damit man weiterarbeiten kann');
  assert.equal(core.restoreFocus(null), false);
  assert.equal(core.VERSION, '0.3.0');
  core.noteInput('pointer');
});

// ---------------------------------------------------------------- 0.3.0: Lernweg-Mechanik und Diagramm
const learn = require('../js/learn.js');
const chart = require('../js/chart.js');

test('Lernweg: Lückentext, Einfachwahl, Mehrfachwahl und Zuordnung werden feldweise geprüft', () => {
  const step = {
    id: 's', n: 1, short: 'S', title: 'T', intro: '', hints: ['a', 'b', 'c'], solution: 'x',
    paragraphs: [['A ', learn.gap('g1', { x: 'X', y: 'Y' }, 'x', { y: 'nein' }), ' B']],
    questions: [
      { id: 'q1', type: 'one', legend: '', options: { a: 'A', b: 'B' }, correct: 'b', misc: { a: 'falsch' } },
      { id: 'q2', type: 'many', legend: '', options: { a: 'A', b: 'B', c: 'C' }, correct: ['a', 'c'] },
      { id: 'q3', type: 'assign', legend: '', options: { l: 'links', r: 'rechts' }, rows: [{ id: 'r1', label: '', correct: 'l' }, { id: 'r2', label: '', correct: 'r' }] }
    ]
  };
  assert.equal(learn.fields(step).length, 5);
  const g = learn.grade(step, { g1: 'y', q1: 'b', q2: ['a'], 'q3.r1': 'l', 'q3.r2': '' });
  assert.equal(g.correct, 2);
  assert.equal(g.total, 5);
  assert.equal(g.fields.g1.feedback, 'nein');
  assert.equal(g.fields.q1.ok, true);
  assert.match(g.fields.q2.feedback, /fehlt noch eine/);
  assert.equal(g.fields['q3.r2'].status, 'empty');
  assert.deepEqual(learn.solutionAnswers(step), { g1: 'x', q1: 'b', q2: ['a', 'c'], 'q3.r1': 'l', 'q3.r2': 'r' });
  assert.ok(learn.grade(step, learn.solutionAnswers(step)).allCorrect);
  assert.equal(learn.complete(step, { g1: 'x' }), false);
  const st = { step: 's', steps: learn.freshState([step]) };
  const html = learn.taskHtml([step], st);
  assert.match(html, /Antworten prüfen/);
  assert.match(html, /name="q3.r1"/);
});

test('Diagramm: schöne Achsenteilung und deutsche Zahlen', () => {
  assert.equal(chart.niceStep(100, 5), 20);
  assert.equal(chart.niceStep(1, 4), 0.2);
  assert.equal(chart.niceStep(37, 10), 5);
  assert.equal(chart.fmtDe(0.5), '0,5');
  assert.equal(chart.fmtDe(0), '0');
});
