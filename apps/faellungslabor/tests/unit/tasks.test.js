// Aufgaben: richtig / teilweise richtig / falsch / leer / alles angekreuzt; Gleichungen; Hefteintrag.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../js/tasks.js');
const LL = require('../../../../shared/labkit/js/learn.js');

const step = (id, list = T.STEPS) => list.find((s) => s.id === id);
const all = [...T.STEPS, ...T.CONTROL_STEPS];

test('Jede Aufgabe ist ein geschlossenes Format mit Kennzeichnung und drei Hilfestufen', () => {
  for (const s of all) {
    assert.equal(s.hints.length, 3, s.id);
    assert.ok(s.solution.length > 40);
    for (const q of s.questions) {
      assert.ok(['one', 'many', 'assign'].includes(q.type));
      if (q.type === 'one') assert.match(q.legend, /^Wähle eine richtige Antwort/);
      if (q.type === 'many') { assert.match(q.legend, /^Wähle alle zutreffenden Aussagen/); assert.ok(q.correct.length >= 2 && q.correct.length < Object.keys(q.options).length); }
    }
  }
});

test('Mehrfachauswahl: nur die exakte Menge ist richtig; leer und „alles“ bestehen nie; Teilantwort benannt', () => {
  for (const s of all) for (const q of s.questions.filter((x) => x.type === 'many')) {
    const g = (sel) => T.grade(s, { [q.id]: sel }).fields[q.id];
    assert.equal(g(q.correct).ok, true);
    assert.equal(g([]).ok, false); assert.equal(g([]).status, 'empty');
    const every = g(Object.keys(q.options));
    assert.equal(every.ok, false, 'alles ankreuzen');
    assert.match(every.feedback, /trifft nicht zu/);
    const part = g(q.correct.slice(0, 1));
    assert.equal(part.ok, false); assert.equal(part.partial, true);
    assert.match(part.feedback, /trifft zu\. Es fehl(t|en) noch/);
    const wrongKey = Object.keys(q.options).find((k) => !q.correct.includes(k));
    const mixed = g([q.correct[0], wrongKey]);
    assert.equal(mixed.ok, false);
    assert.ok(mixed.feedback.includes(q.options[wrongKey]), 'konkrete Rückmeldung zur falschen Aussage');
  }
});

test('Zuordnungen und Einfachauswahl: konkrete Rückmeldung je Feld, Korrektur möglich', () => {
  const s = step('ionen');
  let g = T.grade(s, { 'rolle.ag': 'fest', 'rolle.x': 'fest', 'rolle.na': 'fest', 'rolle.no3': 'zus', aussagen: ['zuschauerGeloest', 'feststoffIonen'] });
  assert.equal(g.allCorrect, false);
  assert.match(g.fields['rolle.na'].feedback, /Na⁺ bleibt gelöst/);
  g = T.grade(s, { 'rolle.ag': 'fest', 'rolle.x': 'fest', 'rolle.na': 'zus', 'rolle.no3': 'zus', aussagen: ['zuschauerGeloest', 'feststoffIonen'] });
  assert.equal(g.allCorrect, true);
  const sol = LL.solutionAnswers(s);
  assert.equal(T.grade(s, sol).allCorrect, true);
  for (const x of all) assert.equal(T.grade(x, LL.solutionAnswers(x)).allCorrect, true, x.id + ': Musterlösung besteht');
  for (const x of all) assert.equal(T.grade(x, {}).correct, 0, x.id + ': leeres Formular besteht nicht');
});

test('Gleichungen: richtige Option vollständig mit aq/s, Ladungen und Zuschauerionen; gekürzte wird erklärt', () => {
  const s = step('gleich');
  const expect = {
    eqCl: 'Na⁺(aq) + Cl⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgCl(s) + Na⁺(aq) + NO₃⁻(aq)',
    eqBr: 'Na⁺(aq) + Br⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgBr(s) + Na⁺(aq) + NO₃⁻(aq)',
    eqI: 'Na⁺(aq) + I⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgI(s) + Na⁺(aq) + NO₃⁻(aq)'
  };
  for (const q of s.questions) {
    assert.equal(q.options[q.correct], expect[q.id]);
    const netKey = Object.keys(q.options).find((k) => /^Ag⁺\(aq\) \+ \w+⁻\(aq\) → Ag\w+\(s\)$/.test(q.options[k]));
    assert.ok(netKey, 'gekürzte Gleichung als Option');
    const f = T.grade(s, { [q.id]: netKey }).fields[q.id];
    assert.equal(f.ok, false);
    assert.equal(f.feedback, 'Die Fällungsreaktion ist richtig dargestellt. Ergänze die Zuschauerionen zur vollständigen Ionengleichung.');
    // jeder Distraktor hat eine eigene Begründung und ist nicht nur eine Umstellung der richtigen Gleichung
    const sorted = (e) => e.split('→').map((side) => side.split(' + ').map((x) => x.trim()).sort().join('+')).join('→');
    for (const k of Object.keys(q.options)) {
      if (k === q.correct) continue;
      assert.ok(q.misc[k], q.id + ' ' + k + ' ohne Rückmeldung');
      assert.notEqual(sorted(q.options[k]), sorted(q.options[q.correct]), 'nur vertauschte Summanden');
    }
  }
});

test('Hefteintrag: 80–100 Wörter mit Legende, genau eine kurze Gleichung, Pflichtinhalte', () => {
  const w = T.notebookWords(T.NOTEBOOK);
  assert.ok(w >= 80 && w <= 100, 'Wörter: ' + w);
  const eqs = T.NOTEBOOK.blocks.filter((b) => b.kind === 'eq');
  assert.equal(eqs.length, 1);
  assert.equal(eqs[0].text + ', ' + eqs[0].legend, 'Ag⁺(aq) + X⁻(aq) → AgX(s), mit X = Cl, Br oder I');
  const text = T.NOTEBOOK.blocks.map((b) => b.text).join(' ');
  for (const m of ['Fällungsreaktion', 'weiß', 'cremefarben bis schwach gelb', 'blassgelb', 'Zuschauerionen', 'verdünnter Ammoniaklösung', 'konzentrierter', 'ungelöst']) assert.ok(text.includes(m), m);
  assert.ok(!/Kontroll|Leitungswasser/.test(text), 'Kontrollzusatz nicht im Haupteintrag');
  const cw = LL.words(T.CONTROL_SUMMARY.text);
  assert.ok(cw >= 30 && cw <= 45, 'Kurzfassung Kontrollen: ' + cw);
});

test('Fortschritt: nur Pflichtschritte des Hauptteils; Ammoniak optional; Kontrollen getrennt', () => {
  const st = { steps: LL.freshState(T.STEPS) };
  assert.deepEqual(T.progress(T.STEPS, st), { done: 0, total: 3 });
  for (const s of T.STEPS.filter((x) => !x.optional)) st.steps[s.id].graded = T.grade(s, LL.solutionAnswers(s));
  assert.deepEqual(T.progress(T.STEPS, st), { done: 3, total: 3 }, 'abschließbar ohne Ammoniakerweiterung und ohne Kontrollen');
  assert.equal(T.STEPS.find((s) => s.id === 'nh3').optional, true);
});

test('Verbindliche Aussage der Kontroll-Auswertung wörtlich', () => {
  assert.equal(T.CONTROL_STATEMENT, 'Leitungs- und Mineralwasser enthalten verschiedene gelöste Ionen. Bei Zugabe von Silbernitratlösung können mehrere schwer lösliche Silberverbindungen entstehen. Der Niederschlag kann deshalb ein Stoffgemisch sein. Welche Ionen darin enthalten sind, lässt sich mit diesem Versuch allein nicht eindeutig feststellen.');
});

// ------------------------------------------------------------------ 1.1.0: zufällige Reihenfolge (FK14–FK16)
test('FK14: Mischen mit festen Startwerten – richtige Antworten an unterschiedlichen Positionen, Bewertung über IDs', () => {
  const all = [...T.STEPS, ...T.CONTROL_STEPS];
  for (const s of all) for (const q of s.questions.filter((x) => x.type !== 'assign')) {
    const firstCorrect = new Set();
    for (const seed of [1, 7, 42, 1234, 98765, 4242424242]) {
      const v = T.view(s, seed).questions.find((x) => x.id === q.id);
      const keys = Object.keys(v.options);
      assert.deepEqual([...keys].sort(), Object.keys(q.options).sort(), 'gleiche IDs');
      for (const k of keys) assert.equal(v.options[k], q.options[k], 'Text gehört zur ID');
      const corr = [].concat(q.correct);
      firstCorrect.add(keys.findIndex((k) => corr.includes(k)));
      // Bewertung unabhängig von der Anzeige: richtig, teilweise, falsch, leer, alles
      const g = (a) => T.grade(s, { [q.id]: a }).fields[q.id];
      assert.equal(g(q.type === 'many' ? corr : q.correct).ok, true);
      assert.equal(g(q.type === 'many' ? [] : '').ok, false);
      if (q.type === 'many') {
        assert.equal(g(keys).ok, false, 'alles gewählt');
        assert.equal(g([corr[0]]).partial, true, 'teilweise');
      } else assert.equal(g(keys.find((k) => k !== q.correct)).ok, false, 'falsch');
    }
    assert.ok(firstCorrect.size >= 2, q.id + ': richtige Antwort nicht immer an derselben Stelle');
  }
});

test('FK14: Gleichungen werden als Ganzes umgestellt, nie innerhalb einer Gleichung', () => {
  const s = T.STEPS.find((x) => x.id === 'gleich');
  for (const seed of [3, 99, 2026]) for (const q of T.view(s, seed).questions) {
    assert.equal(q.options.full, s.questions.find((x) => x.id === q.id).options.full);
    assert.match(q.options.full, /^Na⁺\(aq\) \+ (Cl|Br|I)⁻\(aq\) \+ Ag⁺\(aq\) \+ NO₃⁻\(aq\) → Ag(Cl|Br|I)\(s\) \+ Na⁺\(aq\) \+ NO₃⁻\(aq\)$/);
  }
});

test('FK15: Reihenfolge stabil für denselben Startwert; neuer Startwert mischt neu; Fisher-Yates gleichverteilt', () => {
  const s = T.STEPS[0];
  const a = JSON.stringify(T.view(s, 555).questions.map((q) => Object.keys(q.options)));
  for (let i = 0; i < 5; i++) assert.equal(JSON.stringify(T.view(s, 555).questions.map((q) => Object.keys(q.options))), a);
  const others = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(T.view(s, seed).questions.map((q) => Object.keys(q.options)))));
  assert.ok(others.size >= 6, 'verschiedene Durchgänge ergeben verschiedene Anordnungen');
  const r = T.rng(11), n = 60000, c = {};
  for (let i = 0; i < n; i++) { const k = T.shuffle([0, 1, 2], r).join(''); c[k] = (c[k] || 0) + 1; }
  assert.equal(Object.keys(c).length, 6);
  for (const v of Object.values(c)) assert.ok(Math.abs(v - n / 6) < 0.03 * n / 6, 'gleichverteilt: ' + JSON.stringify(c));
  const seeds = new Set(Array.from({ length: 50 }, () => T.newSeed()));
  assert.ok(seeds.size > 45, 'neue Startwerte unterscheiden sich');
});

test('FK16: Antworten aus 1.0.0 (Buchstaben) werden auf dieselben fachlichen Aussagen abgebildet', () => {
  const m = T.migrateAnswers({ ablauf: ['a', 'b', 'c', 'd'], aussagen: ['a', 'c'], eqCl: 'c', eqBr: 'd', eqI: 'a', schluss: ['e'], pos: 'a', neg: 'b', wasser: ['c'], 'farbe.nacl': 'weiss' });
  assert.deepEqual(m.answers.ablauf, ['wolke', 'verteilt', 'absetzen', 'aufwirbeln']);
  assert.deepEqual(m.answers.aussagen, ['zuschauerGeloest', 'naImFeststoff']);
  assert.equal(m.answers.eqCl, 'full'); assert.equal(m.answers.eqBr, 'full'); assert.equal(m.answers.eqI, 'full');
  assert.deepEqual(m.answers.schluss, ['silberGeloest']); assert.equal(m.answers.pos, 'zeigtWirkung'); assert.equal(m.answers.neg, 'reagenzAllein');
  assert.deepEqual(m.answers.wasser, ['beweistChlorid']); assert.equal(m.answers['farbe.nacl'], 'weiss');
  // Zuordnung der Inhalte: 1.0.0-Text unter Buchstabe c von „ablauf“ ist derselbe Text wie unter „absetzen“
  assert.match(T.STEPS[0].questions[1].options.absetzen, /setzt sich der Niederschlag ab/);
  assert.equal(T.migrateAnswers({ ablauf: ['wolke'] }).changed, 0, 'neue IDs bleiben unverändert');
});
