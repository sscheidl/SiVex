// Aufgaben, Protokoll, Hilfen, Geräte-Trainer, Hefteintrag (L-01 … L-05, S-04). Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../js/tasks.js');
const { M, act, setup, runUntil, vol } = require('./helpers.js');

function burnTest(e) { if (e.state.receiver.present) act(e, 'toggleReceiver'); act(e, 'takeSample', 'receiver'); act(e, 'sampleToDish'); act(e, 'ignite', 'dish'); const r = { result: e.state.dish.result }; e.advance(30); act(e, 'toggleReceiver'); return r; }

test('L-01 Ergebnis prüfen hängt vom Versuchszustand ab (Aufgabe 1)', () => {
  const e0 = M.createEngine();
  assert.equal(T.evaluate('ew', e0.state).code, 'notFilled');
  const e = setup({});
  e.advance(60);
  assert.equal(T.evaluate('ew', e.state).ok, false);
  runUntil(e, (s) => vol(s.receiver.c) > 8, 3000, 1);
  assert.equal(T.evaluate('ew', e.state).code, 'noBurn');
  assert.equal(burnTest(e).result, 'burns');
  const r = T.evaluate('ew', e.state);
  assert.equal(r.ok, true, r.text);
  // falsche Thermometerlage verhindert den Erfolg
  const h = setup({ thermo: 'high' });
  runUntil(h, (s) => vol(s.receiver.c) > 8, 3000, 1);
  assert.equal(T.evaluate('ew', h.state).code, 'thermo');
  // ohne Kühlung: Stopp bzw. kein Erfolg
  const n = setup({ water: false });
  n.advance(800);
  assert.equal(T.evaluate('ew', n.state).ok, false);
});

test('L-01 Aufgaben 2 und 3 werten echte Fraktionen aus', () => {
  const p = setup({ mix: 'pw' });
  runUntil(p, (s) => vol(s.receiver.c) > 8, 3000, 1);
  assert.equal(T.evaluate('pw', p.state).ok, true);
  const x = setup({ mix: 'pew' });
  runUntil(x, (s) => vol(s.receiver.c) > 20, 4000, 1);
  assert.notEqual(T.evaluate('pew', x.state).ok, true, 'ohne Wechsel kein Erfolg');
  const y = setup({ mix: 'pew' });
  runUntil(y, (s) => vol(s.receiver.c) > 1 && s.reading > 65, 4000, 1); act(y, 'changeReceiver');
  runUntil(y, (s) => vol(s.receiver.c) > 1 && s.reading > 88, 4000, 1); act(y, 'changeReceiver');
  const r = T.evaluate('pew', y.state);
  assert.equal(r.ok, true, r.text);
});

test('L-01/L-02 Protokoll: Messwerte gegen eigene Werte, Einzelfeld-Bewertung, Eingaben bleiben', () => {
  const e = setup({});
  runUntil(e, (s) => vol(s.receiver.c) > 10, 3000, 1);
  burnTest(e);
  const snap = M.snapshot(e.state);
  const f = T.mainFraction('ew', snap);
  const sol = T.solutionAnswers('ew', snap);
  // vollständig richtig
  const all = T.grade('ew', sol, snap);
  assert.equal(all.allCorrect, true, JSON.stringify(all.fields));
  // teilweise richtig: falsche Temperatur, Fehlvorstellungen angekreuzt
  const part = Object.assign({}, sol, { temp: String(f.Tmed + 6).replace('.', ','), obs: ['drops', 'smoke', 'waterInner'], gap: 'Verdampfen' });
  const g = T.grade('ew', part, snap);
  assert.equal(g.fields.temp.ok, false);
  assert.equal(g.fields.obs.ok, false);
  assert.match(g.fields.obs.feedback, /trifft|treffen/);
  assert.equal(g.fields.gap.status, 'forbidden');
  assert.equal(g.fields.vol.ok, true, 'richtige Felder bleiben richtig');
  assert.equal(g.fields.why.ok, true);
  // Toleranz und Komma
  const t1 = T.grade('ew', { temp: (f.Tmed + 1).toFixed(1).replace('.', ',') }, snap);
  assert.equal(t1.fields.temp.ok, true);
  // feste Zahl, die nicht zum Versuch passt (z. B. 78 statt eigener Messung bei falscher Thermometerlage)
  const h = setup({ thermo: 'high' });
  runUntil(h, (s) => vol(s.receiver.c) > 8, 3000, 1);
  const hs = M.snapshot(h.state);
  const th = T.grade('ew', { temp: String(T.mainFraction('ew', hs).Tmed) }, hs);
  assert.equal(th.fields.temp.ok, false);
  assert.match(th.fields.temp.feedback, /Thermometerkugel/);
});

test('L-01 Beobachtungsfrage richtet sich nach dem eigenen Versuch', () => {
  const e = setup({ thermo: 'high' });
  runUntil(e, (s) => vol(s.receiver.c) > 8, 3000, 1);
  const q = T.questions('ew', M.snapshot(e.state)).find((x) => x.id === 'obs');
  assert.deepEqual(q.answerFor(M.snapshot(e.state)), ['drops'], 'kein verlässliches Plateau bei falscher Lage');
  const ok = setup({});
  runUntil(ok, (s) => vol(s.receiver.c) > 8, 3000, 1);
  assert.deepEqual(q.answerFor(M.snapshot(ok.state)).sort(), ['drops', 'plateau']);
  // Brennprobe-Frage ohne Brennprobe: kein Messwert
  const g = T.grade('ew', { burn: 'burns' }, M.snapshot(ok.state));
  assert.equal(g.fields.burn.status, 'nodata');
});

test('L-03 Drei Tipps je Befund, konkreter werdend', () => {
  for (const code of ['notFilled', 'noCooling', 'thermo', 'noBurn', 'noStones', 'impure', 'noChange', 'done']) {
    const h = T.hints(code);
    assert.equal(h.length, 3, code);
    assert.ok(h[2].length > h[0].length, `${code}: Stufe 3 konkreter`);
  }
});

test('L-02/L-04/S-04 Geräte-Trainer: alle Teile, Vorlage/Destillat unterschieden, Funktionen', () => {
  assert.equal(T.PART_ORDER.length, 12);
  for (const n of ['Rundkolben', 'Heizpilz', 'Siedesteine', 'Destillationsaufsatz', 'Thermometer', 'Liebigkühler', 'Kühlwasserzulauf', 'Kühlwasserablauf', 'Vorstoß', 'Vorlage', 'Destillat', 'Stativ mit Klemme']) assert.ok(Object.values(T.PART_NAMES).includes(n), n);
  const right = Object.fromEntries(T.PART_ORDER.map((id) => [id, T.PART_NAMES[id]]));
  assert.equal(T.gradeNames(right).allCorrect, true);
  const swapped = Object.assign({}, right, { receiver: 'Destillat', distillate: 'Vorlage', inlet: 'Kühlwasserablauf' });
  const g = T.gradeNames(swapped);
  assert.equal(g.correct, 9);
  assert.match(g.fields.receiver.feedback, /Gefäß/);
  assert.match(g.fields.inlet.feedback, /unten hinein/);
  assert.equal(g.fields.flask.ok, true, 'richtige Felder bleiben');
  assert.ok(T.TRAINER_TERMS().length > 12, 'plausible Alternativen');
  assert.match(T.PART_INFO.receiver, /Auffanggefäß/);
  assert.match(T.PART_INFO.distillate, /Flüssigkeit/);
  const fr = Object.fromEntries(T.FUNCTION_QUESTIONS.map((q) => [q.id, q.correct]));
  assert.equal(T.gradeFunctions(fr).allCorrect, true);
  assert.equal(T.gradeFunctions({}).correct, 0);
  assert.equal(T.NAME_HINTS.length, 3);
  assert.equal(T.FUNCTION_HINTS.length, 3);
  assert.equal(T.THEORY.length, 4);
});

test('L-05 Hefteintrag: kurz, unabhängig vom Versuch, Modellgrenze benannt', () => {
  const n = T.notebookWords();
  assert.ok(n >= 80 && n <= 130, 'Wortzahl ' + n);
  const txt = JSON.stringify(T.NOTEBOOK);
  for (const w of ['Siedetemperatur', 'verdampft', 'kondensiert', 'Destillat', 'Vorlage', 'Liebigkühler', 'Siedesteine']) assert.ok(txt.includes(w), w);
  assert.match(T.NOTEBOOK.rule, /nicht vollständig/);
  assert.match(T.MODEL_NOTE, /Azeotrop/);
  assert.match(T.SOLUTIONS.ew, /keine Reinheit/);
});
