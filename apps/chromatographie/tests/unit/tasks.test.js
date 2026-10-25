// Unit-Tests der Aufgabenprüfung, Hilfen, Protokollbewertung und Rf-Prüfung. Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { M, act, runExperiment } = require('./helpers.js');
const T = require('../../js/tasks.js');

const last = (e) => e.state.archive[e.state.archive.length - 1];

test('L-01 Aufgabe A: Erfolg nur mit tatsächlich getrenntem Chromatogramm', () => {
  const e0 = M.createEngine();
  assert.equal(T.evaluate('A', e0.state).code, 'noPaper');
  const e = runExperiment({ samples: ['schwarz', null, null] });
  assert.equal(T.evaluate('A', e.state).code, 'needRef');
  runExperiment({ engine: e, samples: ['schwarz', 'blau', null], solvent: 'etoh' });
  const r1 = T.evaluate('A', e.state);
  assert.equal(r1.ok, false);
  assert.equal(r1.code, 'incomplete', 'Ethanol-Wasser trennt Schwarz nicht vollständig');
  runExperiment({ engine: e, samples: ['schwarz', 'blau', null], solvent: 'water' });
  const r2 = T.evaluate('A', e.state);
  assert.ok(r2.ok);
  assert.equal(r2.paper, last(e).id);
});

test('B-02 Aufgabe A: alternative Wege (gelbe statt blaue Referenz, andere Bahnen) werden akzeptiert', () => {
  const e = runExperiment({ samples: ['gelb', null, 'schwarz'] });
  assert.ok(T.evaluate('A', e.state).ok);
  const e2 = runExperiment({ samples: ['blau', 'schwarz', 'gelb'], portions: 2, dabs: 2 });
  assert.ok(T.evaluate('A', e2.state).ok);
});

test('F-05/L-01 Aufgabe A: Fehlversuche führen nicht zu falscher Erfolgsbewertung', () => {
  const sub = runExperiment({ samples: ['schwarz', 'blau', null], portions: 3 });
  assert.equal(T.evaluate('A', sub.state).code, 'submerged');
  const over = runExperiment({ samples: ['schwarz', 'blau', null], dabs: [4, 1] });
  assert.equal(T.evaluate('A', over.state).code, 'overloaded');
  const short = runExperiment({ samples: ['schwarz', 'blau', null], run: 3 });
  assert.equal(T.evaluate('A', short.state).code, 'short');
  const noline = runExperiment({ samples: ['schwarz', 'blau', null], line: false });
  assert.equal(T.evaluate('A', noline.state).code, 'noLine');
});

test('L-01 Aufgabe B: gemeinsame Komponente nur mit geeignetem Laufmittel nachweisbar', () => {
  const e = runExperiment({ samples: ['gruen', 'violett', 'blau'], solvent: 'etoh', run: 10 });
  const r = T.evaluate('B', e.state);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'incomplete');
  runExperiment({ engine: e, samples: ['blau', 'gruen', 'violett'], solvent: 'water' });
  assert.ok(T.evaluate('B', e.state).ok);
  const part = runExperiment({ samples: ['gruen', 'violett', null] });
  assert.equal(T.evaluate('B', part.state).code, 'needSamples');
});

test('L-01 Aufgabe C: braucht je ein gültiges Papier mit Wasser und mit Ethanol-Wasser', () => {
  const e = runExperiment({ samples: ['wasserfest', null, null], solvent: 'water' });
  const r = T.evaluate('C', e.state);
  assert.equal(r.code, 'needOtherSolvent');
  assert.equal(r.missing, 'etoh');
  runExperiment({ engine: e, samples: ['wasserfest', null, null], solvent: 'etoh', portions: 3 });
  assert.equal(T.evaluate('C', e.state).code, 'submerged');
  runExperiment({ engine: e, samples: [null, 'wasserfest', null], solvent: 'etoh' });
  const ok = T.evaluate('C', e.state);
  assert.ok(ok.ok);
  assert.equal(ok.papers.length, 2);
});

test('L-02 Hilfe: zustandsabhängig, genau drei Stufen, Stufe 3 nennt die Korrektur', () => {
  const sub = runExperiment({ samples: ['schwarz', 'blau', null], portions: 3 });
  const code = T.diagnose('A', sub.state);
  assert.equal(code, 'submerged');
  const h = T.hints('A', code);
  assert.equal(h.length, 3);
  assert.match(h[2], /leere die Kammer/i);
  const etoh = runExperiment({ samples: ['gruen', 'violett', 'blau'], solvent: 'etoh' });
  assert.equal(T.diagnose('B', etoh.state), 'incomplete');
  assert.match(T.hints('B', 'incomplete')[2], /Wasser als Laufmittel/);
  // laufender Versuch: Überfüllung wird schon vor dem Einhängen erkannt
  const e = M.createEngine();
  act(e, 'drawLine'); act(e, 'spot', 0, 'schwarz');
  for (let i = 0; i < 3; i++) act(e, 'pour', 'water');
  assert.equal(T.diagnose('A', e.state), 'overfill');
  for (const c of ['noPaper', 'needSamples', 'needRef', 'noLine', 'offLine', 'submerged', 'overfill', 'noSolvent', 'short', 'overloaded', 'incomplete', 'needOtherSolvent', 'developing', 'done', 'free']) {
    assert.equal(T.hints('A', c).length, 3, c);
  }
});

test('L-03 Protokoll A: richtige, teilweise richtige und falsche Antworten je Feld', () => {
  const e = runExperiment({ samples: ['schwarz', 'blau', 'gelb'] });
  const snap = last(e);
  const right = { count: '3', obs: ['sep', 'match', 'ref1'], result: 'mix', why: 'ads', gap: 'stationäre', limit: 'noproof' };
  assert.ok(T.grade('A', right, snap).allCorrect);
  const partial = Object.assign({}, right, { obs: ['sep'], why: 'abs', gap: 'Stationaere' });
  const g = T.grade('A', partial, snap);
  assert.equal(g.allCorrect, false);
  assert.equal(g.fields.count.ok, true);
  assert.equal(g.fields.obs.ok, false);
  assert.match(g.fields.obs.feedback, /fehlt noch/);
  assert.equal(g.fields.why.ok, false, 'Absorption als Distraktor');
  assert.equal(g.fields.gap.ok, true);
  const wrong = T.grade('A', { count: '1', obs: ['stay'], gap: 'mobile' }, snap);
  assert.equal(wrong.fields.gap.status, 'forbidden');
  assert.equal(wrong.fields.result.status, 'empty');
  assert.match(wrong.fields.obs.feedback, /trifft nicht zu/);
});

test('L-03 Protokoll C: Adsorption statt Absorption', () => {
  const g = T.grade('C', { gap: 'Absorption' }, null);
  assert.equal(g.fields.gap.status, 'forbidden');
  assert.match(g.fields.gap.feedback, /Anhaften/);
  assert.ok(T.grade('C', { gap: 'adsorption' }, null).fields.gap.ok);
});

test('Lösung anzeigen funktioniert auch ohne gelungenen Versuch', () => {
  for (const id of ['A', 'B', 'C']) {
    const sol = T.solutionAnswers(id, null);
    assert.ok(T.grade(id, sol, id === 'A' ? { zones: [[{}, {}, {}]], lanes: [{ sampleId: 'schwarz' }] } : null).allCorrect, id);
    assert.ok(T.SOLUTIONS[id].length > 100);
  }
  assert.match(T.SOLUTIONS.A, /kein|nicht/);
  assert.match(T.SOLUTIONS.A, /Reinstoff/);
});

test('L-04 Expertenmodus: Rf aus echten Laufstrecken; ohne Markierung oder bei Front am Rand nicht bestimmbar', () => {
  const e = runExperiment({ samples: ['blau', 'schwarz', null], run: 9 });
  assert.equal(T.checkRf(last(e), 0, 0, {}).code, 'frontUnmarked');
  act(e, 'setExpert', true);
  act(e, 'markFront');
  const snap = last(e);
  const front = snap.frontMark - snap.lanes[0].y;
  const dist = snap.zones[0][0].s;
  const r = T.checkRf(snap, 0, 0, { front: front.toFixed(1).replace('.', ','), dist: dist.toFixed(1), rf: (dist / front).toFixed(2) });
  assert.ok(r.ok, JSON.stringify(r.fields));
  assert.ok(Math.abs(r.truth.rf - 0.62) < 0.01);
  const bad = T.checkRf(snap, 0, 0, { front: front.toFixed(1), dist: (dist + 1).toFixed(1), rf: '0,9' });
  assert.equal(bad.fields.front.ok, true);
  assert.equal(bad.fields.dist.ok, false);
  assert.equal(bad.fields.rf.ok, false);
  const top = runExperiment({ samples: ['blau', null, null], run: 20 });
  assert.equal(T.checkRf(last(top), 0, 0, {}).code, 'frontAtTop');
});

test('L-05 Hefteintrag: etwa 100 Wörter, Fachbegriffe, Ein-Zonen-Grenze, unabhängig vom Versuch', () => {
  const n = T.notebookWords();
  assert.ok(n >= 80 && n <= 120, `${n} Wörter`);
  const all = T.NOTEBOOK.lines.join(' ');
  for (const w of ['Stationäre Phase', 'Mobile Phase', 'Löslichkeit', 'Adsorption', 'kein Beweis']) assert.ok(all.includes(w), w);
  assert.ok(!/Absorption/.test(all));
});

test('F-07 Rf erscheint nur im Expertenmodus-Teil des Hefteintrags', () => {
  assert.ok(!/Rf/.test(T.NOTEBOOK.lines.join(' ') + T.NOTEBOOK.rule));
  assert.match(T.NOTEBOOK.expert, /Rf/);
});

// ------------------------------------------------------------------ Regressionstests 0.2.0

test('Befund 2: Bewertung und Musterlösung ohne eigenes Chromatogramm werfen keinen Fehler', () => {
  assert.doesNotThrow(() => T.grade('A', { gap: 'stationär' }, null));
  assert.doesNotThrow(() => T.grade('A', { count: '3', obs: ['sep'] }, null));
  const sol = T.solutionAnswers('A', null);
  assert.equal(sol.count, '3');
  assert.ok(T.grade('A', sol, null).allCorrect);
  for (const id of ['A', 'B', 'C']) for (const q of T.QUESTIONS[id]) assert.doesNotThrow(() => T.correctFor(q, null), id + '/' + q.id);
});

test('Befund 3: Startlinie nach dem Auftragen – Punkte bleiben, Warnung beim Einhängen, kein gültiger Nachweis', () => {
  const e = M.createEngine();
  const msgs = [];
  e.on('message', (m) => msgs.push(m));
  act(e, 'spot', 0, 'schwarz'); act(e, 'spot', 2, 'gelb');
  T.diagnose('A', e.state);
  act(e, 'drawLine');
  assert.deepEqual(e.state.paper.lanes.map((l) => l && l.y), [2.35, null, 2.6], 'Punkte nicht verschoben');
  assert.equal(T.diagnose('A', e.state), 'offLine', 'Hilfe erkennt den Fehler schon vor dem Einhängen');
  act(e, 'pour', 'water'); act(e, 'insert');
  const w = msgs.find((m) => m.code === 'offLine');
  assert.ok(w && w.kind === 'warn');
  assert.equal(w.text, 'Die Probenpunkte liegen nicht auf einer gemeinsamen Startlinie. Verwende neues Papier und zeichne zuerst die Startlinie.');
  while (e.state.paper.front < 10) e.advance(1);
  act(e, 'remove');
  assert.equal(e.quality().valid, false);
  assert.ok(e.quality().issues.includes('offLine'));
  const r = T.evaluate('A', e.state);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'offLine');
  // richtig: erst Linie, dann Punkte – keine Warnung
  const ok = runExperiment({ samples: ['schwarz', null, 'gelb'] });
  assert.ok(T.evaluate('A', ok.state).ok);
});

test('Befund 4: Ausgewertet wird das neueste passende Papier; ein älterer Erfolg rettet keinen neuen Fehlversuch', () => {
  const e = runExperiment({ samples: ['schwarz', 'blau', null] });
  const r1 = T.evaluate('A', e.state);
  assert.ok(r1.ok);
  assert.deepEqual(r1.papers, ['P1']);
  runExperiment({ engine: e, samples: ['schwarz', 'blau', null], portions: 3 });
  const r2 = T.evaluate('A', e.state);
  assert.equal(r2.ok, false);
  assert.equal(r2.paper, 'P2');
  assert.deepEqual(r2.papers, ['P2']);
  // Papier ohne passende Proben zählt nicht als Bezug
  runExperiment({ engine: e, samples: ['orange', null, null] });
  assert.equal(T.evaluate('A', e.state).paper, 'P2');
});

test('Befund 4: Aufgabe C nennt beide Vergleichspapiere; neuester Versuch je Laufmittel zählt', () => {
  const e = runExperiment({ samples: ['wasserfest', null, null], solvent: 'water' });
  runExperiment({ engine: e, samples: ['wasserfest', null, null], solvent: 'etoh' });
  const ok = T.evaluate('C', e.state);
  assert.ok(ok.ok);
  assert.deepEqual(ok.papers.sort(), ['P1', 'P2']);
  runExperiment({ engine: e, samples: ['wasserfest', null, null], solvent: 'water', portions: 3 });
  const bad = T.evaluate('C', e.state);
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'submerged');
  assert.deepEqual(bad.papers.sort(), ['P2', 'P3']);
});

test('Befund 4: Verweise auf entfernte Archivpapiere werden erkannt', () => {
  const e = runExperiment({ samples: ['schwarz', 'blau', null], run: 5.2 });
  assert.ok(T.refsValid(['P1'], e.state.archive));
  for (let i = 0; i < 12; i++) runExperiment({ engine: e, samples: ['gelb', null, null], run: 5.2 });
  assert.equal(e.state.archive.length, 12);
  assert.equal(T.refsValid(['P1'], e.state.archive), false, 'ältestes Papier fiel heraus');
  assert.ok(T.refsValid([], e.state.archive));
});
