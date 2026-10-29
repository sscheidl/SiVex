// Unit-Tests von Lernweg, Prüfung, Hilfen und Hefteintrag.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../js/tasks.js');

test('drei Schritte mit je drei Hilfestufen und einer Lösung', () => {
  assert.deepEqual(T.STEPS.map((s) => s.id), ['observe', 'explain', 'transitions']);
  for (const s of T.STEPS) {
    assert.equal(s.hints.length, 3, s.id);
    assert.ok(s.solution.length > 80, s.id);
  }
});

test('Musterlösung ist in jedem Schritt vollständig richtig', () => {
  for (const s of T.STEPS) {
    const g = T.grade(s.id, T.solutionAnswers(s.id));
    assert.ok(g.allCorrect, s.id);
    assert.equal(g.correct, g.total);
    assert.ok(T.complete(s.id, T.solutionAnswers(s.id)));
  }
});

test('leere Antworten: jedes Feld „Noch keine Antwort“, nichts richtig', () => {
  for (const s of T.STEPS) {
    const g = T.grade(s.id, {});
    assert.equal(g.correct, 0);
    assert.ok(Object.values(g.fields).every((f) => f.status === 'empty' && f.feedback === 'Noch keine Antwort.'));
    assert.equal(T.complete(s.id, {}), false);
  }
});

test('Lückentext: einzelne Felder werden getrennt markiert, mit konkretem Beobachtungshinweis', () => {
  const a = T.solutionAnswers('observe');
  a.g5 = 'gas';       // Eisen bei 2000 °C
  a.g7 = 'fluessig';  // Iod unterhalb 114 °C
  const g = T.grade('observe', a);
  assert.equal(g.correct, g.total - 2);
  assert.equal(g.fields.g5.ok, false);
  assert.match(g.fields.g5.feedback, /2000 °C/);
  assert.match(g.fields.g7.feedback, /90 °C/);
  assert.equal(g.fields.g1.ok, true);
});

test('keine verräterischen Lösungen im Lückentext: Optionen nicht in Lösungsreihenfolge, Startwert leer', () => {
  const firstIsCorrect = T.STEP_BY_ID.observe.gaps.filter((g) => Object.keys(g.options)[0] === g.correct).length;
  assert.ok(firstIsCorrect <= 3, `höchstens wenige Lücken mit richtiger Antwort an erster Stelle (${firstIsCorrect})`);
  assert.ok(T.STEP_BY_ID.observe.paragraphs.flat().filter((x) => typeof x === 'string').every((t) => !/\(z\. ?B\./.test(t)));
});

test('Ankreuzen: typische Fehlvorstellungen erhalten eine passende Rückmeldung', () => {
  const g = T.grade('explain', { q1: ['order', 'still'], q2: ['close', 'glide', 'bigger'], q3: ['far', 'fast', 'bounce', 'noattr'], q4: 'soft', q5: 'none' });
  assert.equal(g.correct, 0);
  assert.match(g.fields.q1.feedback, /zittern/);
  assert.match(g.fields.q1.feedback, /fehlt noch/);
  assert.match(g.fields.q2.feedback, /dehnen sich nicht aus/);
  assert.match(g.fields.q3.feedback, /Anziehung verschwindet nicht/);
  assert.match(g.fields.q4.feedback, /Teilchen verändern sich im Modell nicht/);
  assert.match(g.fields.q5.feedback, /verschwinden keine Teilchen/);
});

test('Zuordnung der Übergänge: Gegenrichtung und Nicht-Übergänge werden erkannt', () => {
  const a = T.solutionAnswers('transitions');
  a['q1.sl'] = 'erstarren';
  a['q1.sg'] = 'verbrennen';
  a['q4.o2'] = 'obs';
  const g = T.grade('transitions', a);
  assert.match(g.fields['q1.sl'].feedback, /Gegenrichtung/);
  assert.match(g.fields['q1.sg'].feedback, /kein Phasenübergang/);
  assert.match(g.fields['q4.o2'].feedback, /Teilchen/);
  assert.equal(g.correct, g.total - 3);
  const terms = Object.values(T.TERMS);
  for (const t of ['Schmelzen', 'Erstarren', 'Verdampfen', 'Kondensieren', 'Sublimieren', 'Resublimieren']) assert.ok(terms.includes(t), t);
});

test('Iod-Aufgabe: flüssiges Iod ist der richtige Normalfall, Resublimieren am Uhrglas', () => {
  const q = T.STEP_BY_ID.transitions.questions;
  assert.equal(q.find((x) => x.id === 'q3').correct, 'both');
  assert.match(q.find((x) => x.id === 'q3').options.both, /zwischen 114 °C und 184 °C ist Iod flüssig/);
  assert.equal(q.find((x) => x.id === 'q2').correct, 'resub');
});

test('Hefteintrag: etwa 100 Wörter, alle drei Zustände, alle sechs Übergänge, Kenneigenschaften', () => {
  const n = T.notebookWords();
  assert.ok(n >= 80 && n <= 130, `${n} Wörter`);
  assert.equal(T.NOTEBOOK.states.length, 3);
  assert.equal(T.NOTEBOOK.transitions.length, 6);
  assert.match(T.NOTEBOOK.rules.join(' '), /Kenneigenschaften/);
  assert.match(T.NOTEBOOK.rules.join(' '), /Schmelztemperatur/);
});
