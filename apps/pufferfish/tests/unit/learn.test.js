// Bewertung der Protokollfragen, der Herleitung und der sechs Rechenaufgaben.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../js/learn.js');

const task = (id) => L.TASKS.find((t) => t.id === id);
const field = (t, id) => task(t).fields.find((f) => f.id === id);
const g = (t, id, v, u) => L.gradeTaskField(field(t, id), v, u);

test('Zahlen lesen: Dezimalkomma, Verhältnis, Zehnerpotenz, Unsinn', () => {
  assert.equal(L.num('4,57'), 4.57);
  assert.equal(L.num(' 4.57 '), 4.57);
  assert.equal(L.num('2:1'), 2);
  assert.equal(L.num('1 : 0,5'), 2);
  assert.ok(Math.abs(L.num('10^0,3') - 1.995) < 0.001);
  assert.ok(Number.isNaN(L.num('etwa vier')));
  assert.ok(Number.isNaN(L.num('')));
});

test('Sechs Aufgaben vorhanden, darunter Pufferbereiche und Verhältnisse', () => {
  assert.equal(L.TASKS.length, 6);
  assert.deepEqual(L.TASKS.map((t) => t.id), ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']);
});

test('Aufgabe 1/2: Bereiche, Mitte statt Grenze, falsche Stufe', () => {
  assert.ok(g('k1', 'lo', '3,75').ok); assert.ok(g('k1', 'hi', '5,75').ok);
  assert.ok(g('k1', 'lo', '3,8').ok, 'Rundung toleriert');
  assert.equal(g('k1', 'lo', '4,75').kind, 'concept');
  assert.ok(g('k2', 'lo', '6,2').ok); assert.ok(g('k2', 'hi', '8.20').ok);
  assert.match(g('k2', 'lo', '1,15').fb, /Falsche Stufe/);
  assert.ok(g('k1', 'lo', '').empty);
});

test('Aufgabe 3: Verhältnis, Kehrwert, Logarithmus nicht aufgelöst', () => {
  assert.ok(g('k3', 'q', '2,0').ok); assert.ok(g('k3', 'q', '1,995').ok); assert.ok(g('k3', 'q', '2:1').ok);
  assert.equal(g('k3', 'q', '0,5').kind, 'quotient');
  assert.equal(g('k3', 'q', '0,30').kind, 'log');
  assert.equal(g('k3', 'q', '1,06').kind, 'concept');
  assert.ok(L.gradeTaskField(field('k3', 'way'), 'lg[c(A⁻)/c(HA)] = pH − pKₛ').ok);
  assert.ok(!L.gradeTaskField(field('k3', 'way'), 'c(A⁻)/c(HA) = pH − pKₛ').ok);
});

test('Aufgabe 4: Stoffmengen mit Einheit, Stöchiometriefehler, pH', () => {
  const fA = task('k4').fields[0], fHA = task('k4').fields[1];
  assert.ok(L.gradeTaskField(fA, '4,00', 'mmol').ok);
  assert.ok(L.gradeTaskField(fA, '0,004', 'mol').ok);
  assert.equal(L.gradeTaskField(fA, '4', 'mol').kind, 'unit');
  assert.equal(L.gradeTaskField(fA, '0,0364', 'mol/L').kind, 'unit');
  assert.equal(L.gradeTaskField(fA, '5', 'mmol').kind, 'stoich');
  assert.equal(L.gradeTaskField(fA, '6', 'mmol').kind, 'stoich');
  assert.equal(L.gradeTaskField(fA, '4', '').kind, 'unit');
  assert.ok(L.gradeTaskField(fHA, '6,0', 'mmol').ok);
  assert.ok(g('k4', 'pH', '4,57').ok); assert.ok(g('k4', 'pH', '4.574').ok);
  assert.equal(g('k4', 'pH', '4,93').kind, 'quotient');
  assert.equal(g('k4', 'pH', '4,75').kind, 'stoich');
});

test('Aufgabe 5/6: Auswahl, Verhältnis, Blut mit CO₂*', () => {
  assert.ok(L.gradeTaskField(field('k5', 'pair'), 'Phosphat').ok);
  assert.match(L.gradeTaskField(field('k5', 'pair'), 'Ammonium').fb, /außerhalb/);
  assert.ok(g('k5', 'q', '1,58').ok); assert.ok(g('k5', 'q', '1,6').ok);
  assert.equal(g('k5', 'q', '0,63').kind, 'quotient');
  assert.ok(g('k6', 'q', '20').ok); assert.ok(g('k6', 'q', '19,95').ok); assert.ok(g('k6', 'q', '20:1').ok);
  assert.equal(g('k6', 'q', '0,05').kind, 'quotient');
  assert.equal(g('k6', 'q', '1,3').kind, 'log');
  assert.match(L.gradeTaskField(field('k6', 'why'), 'Das Verhältnis gilt für HCO₃⁻ zu molekularer Kohlensäure H₂CO₃.').fb, /CO₂\*/);
});

test('Herleitung: Stoffmengen statt Stammlösungskonzentrationen', () => {
  const f = L.THEORY.find((t) => t.id === 't6').fields[1];
  assert.ok(L.gradeField(f, '1').ok);
  assert.match(L.gradeField(f, '2').fb, /n = c · V/);
  const r = L.THEORY.find((t) => t.id === 't7').fields;
  assert.ok(L.gradeField(r[1], '5,75').ok);
  assert.match(L.gradeField(r[1], '3,75').fb, /Vorzeichen/);
  assert.ok(L.gradeField(r[3], 'pH ≈ pKₛ ± 1').ok);
});

test('Protokoll: Beobachtung nur mit eigener Messung belegt; Freitext wird nicht bewertet', () => {
  const q = L.PROTOCOLS.e1.questions.find((x) => x.id === 'o1');
  const none = L.gradeQuestion(q, ['a', 'b', 'c'], {});
  assert.equal(none.status, 'unproven');
  const acid = L.gradeQuestion(q, ['a', 'b', 'c'], { e1: { HCl: true } });
  assert.equal(acid.status, 'unproven');
  assert.equal(L.gradeQuestion(q, ['a', 'b', 'c'], { e1: { HCl: true, NaOH: true } }).status, 'right');
  const wrong = L.gradeQuestion(q, ['a', 'd'], { e1: { HCl: true, NaOH: true } });
  assert.equal(wrong.status, 'wrong'); assert.equal(wrong.marks.d, 'n'); assert.equal(wrong.marks.a, 'y');
  assert.equal(L.gradeQuestion(q, ['a'], { e1: { HCl: true } }).status, 'partial');
  const d = L.PROTOCOLS.e1.questions.find((x) => x.id === 'd1');
  assert.equal(L.gradeQuestion(d, 'b').status, 'right');
  assert.match(L.gradeQuestion(d, 'c').fb, /nicht eingeschlossen/);
  assert.equal(L.gradeQuestion(L.PROTOCOLS.e1.questions.find((x) => x.id === 'f1'), 'beliebiger Text').status, 'free');
});

// ============================================================ 0.2.0
const C = require('../../js/chem.js');

test('Protokolle: drei Versuche, keine Vermutung als Eintrittshürde, kein „Wunderwasser“', () => {
  assert.deepEqual(Object.keys(L.PROTOCOLS), ['e1', 'e2', 'e3']);
  for (const e of Object.keys(L.PROTOCOLS)) assert.equal(L.PROTOCOLS[e].predict, undefined, 'keine verpflichtende Vermutung');
  assert.ok(!/wunder/i.test(JSON.stringify(L.PROTOCOLS) + JSON.stringify(L.THEORY) + JSON.stringify(L.NOTEBOOK) + JSON.stringify(L.APPLICATIONS)), 'kein „Wunderwasser“ in Lerninhalten');
  assert.match(L.PROTOCOLS.e1.intro, /Wasser und eine Pufferlösung/);
});

test('Freitext: konkrete Leitfragen, unbewertet, mit Erwartung', () => {
  const f1 = L.PROTOCOLS.e1.questions.find((q) => q.id === 'f1');
  assert.match(f1.text, /Erkläre in 1–3 Sätzen, warum sich der pH-Wert der Pufferlösung nach Zugabe von HCl weniger stark ändert als bei Wasser/);
  const f2 = L.PROTOCOLS.e2.questions.find((q) => q.id === 'f2');
  assert.match(f2.text, /CH₃COOH und CH₃COO⁻ .* zusammenwirken/);
  const f3 = L.PROTOCOLS.e3.questions.find((q) => q.id === 'f3');
  assert.match(f3.text, /gemessenen pH-Wert .* Ziel-pH/);
  for (const e of ['e1', 'e2', 'e3']) for (const q of L.PROTOCOLS[e].questions.filter((x) => x.type === 'free')) {
    assert.ok(q.expect && q.note, 'Erwartung und Hinweis zur Nichtbewertung sichtbar');
    assert.match(q.note, /nicht bewertet/);
    assert.doesNotMatch(q.text, /In eigenen Worten \(wird nicht bewertet, erscheint im Journal\):/);
    assert.equal(L.gradeQuestion(q, 'beliebiger Text').status, 'free');
  }
});

test('Antworten mischen: stabile, gespeicherte Reihenfolge je Frage; Bewertung nach Antwort-ID', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const o1 = L.shuffled(12345, 'q:d1', ids), o2 = L.shuffled(12345, 'q:d1', ids);
  assert.deepEqual(o1, o2, 'gleicher Seed und gleiche Frage → gleiche Reihenfolge');
  assert.deepEqual(o1.slice().sort(), ids, 'echte Permutation');
  const store = {};
  const first = L.orderFor(store, 777, 'q:d1', ids);
  assert.deepEqual(L.orderFor(store, 999, 'q:d1', ids), first, 'gespeichert: spätere Aufrufe (auch mit anderem Seed) ändern nichts');
  assert.deepEqual(store['q:d1'], first);
  assert.notDeepEqual(L.shuffled(1, 'q:d1', ids).join(), L.shuffled(2, 'q:d1', ids).join() + 'x');
  // veränderte Optionsmenge → neu gemischt
  assert.equal(L.orderFor({ k: ['a', 'b'] }, 1, 'k', ids).length, 4);
  // Bewertung ist von der Anzeigereihenfolge unabhängig
  const q = L.PROTOCOLS.e1.questions.find((x) => x.id === 'd1');
  assert.equal(L.gradeQuestion(q, 'b').status, 'right');
  const m = L.PROTOCOLS.e1.questions.find((x) => x.id === 'o1');
  const ev = { e1: { HCl: true, NaOH: true } };
  assert.equal(L.gradeQuestion(m, ['c', 'a', 'b'], ev).status, 'right', 'Reihenfolge der Auswahl egal');
  assert.equal(L.gradeQuestion(m, ['b', 'a'], ev).status, 'partial');
});

test('Antworten mischen: richtige Option häuft sich nicht an erster Stelle (viele Sitzungen)', () => {
  const qs = [];
  for (const e of Object.keys(L.PROTOCOLS)) for (const q of L.PROTOCOLS[e].questions) if (q.type === 'single' || q.type === 'multi') qs.push(q);
  for (const a of L.APPLICATIONS) qs.push(a.q);
  assert.ok(qs.length >= 10);
  const N = 600;
  let firstOk = 0, total = 0;
  for (const q of qs) {
    const ids = q.options.map((o) => o.v), ok = new Set(q.options.filter((o) => o.ok).map((o) => o.v));
    let firstCorrect = 0;
    for (let s = 1; s <= N; s++) { const o = L.shuffled(s * 7919, 'q:' + q.id, ids); if (ok.has(o[0])) firstCorrect++; }
    const expect = ok.size / ids.length;
    assert.ok(Math.abs(firstCorrect / N - expect) < 0.07, `${q.id}: Anteil richtig an erster Stelle ${(firstCorrect / N).toFixed(3)}, erwartet ${expect.toFixed(3)}`);
    firstOk += firstCorrect; total += N;
  }
  // über alle Fragen: nicht systematisch an erster Stelle (Mittel ≈ Erwartung, nicht „immer a“)
  assert.ok(firstOk / total < 0.4);
  // Auswahlfelder der Herleitung und Aufgaben: richtige Antwort nicht fest an erster Stelle
  for (const t of L.THEORY.concat(L.TASKS)) for (const f of t.fields.filter((x) => (x.type === 'radio' || x.type === 'select') && x.ok)) {
    let first = 0; for (let s = 1; s <= 200; s++) if (L.shuffled(s * 31, `f:${t.id}:${f.id}`, f.options)[0] === f.ok) first++;
    assert.ok(first / 200 < 0.6, `${t.id}:${f.id}`);
  }
  // Mehrfachauswahl: die Reihenfolge der gespeicherten Seeds ist zudem über Sitzungen verschieden
  const orders = new Set(); for (let s = 1; s <= 50; s++) orders.add(L.shuffled(s, 'q:o1', ['a', 'b', 'c', 'd', 'e']).join(''));
  assert.ok(orders.size > 20);
});

test('Versuch 3: Zielwerte, Systemwahl, Zurückweisung', () => {
  assert.deepEqual(L.MIX_TARGETS.map((t) => t.pH), [5.05, 6.90, 9.55]);
  assert.equal(L.targetMessage('ac', 5.05).ok, true);
  const bad = L.targetMessage('ph', 5.05);
  assert.equal(bad.ok, false); assert.match(bad.text, /Faustregel pKₛ ± 1/); assert.match(bad.text, /Wähle ein anderes System/);
  assert.equal(L.targetMessage('ac', 5.75).code, 'edge');
  assert.match(L.targetMessage('ac', 5.75).text, /Näherung/);
  const none = L.targetMessage(null, 5.95);
  assert.equal(none.ok, false); assert.equal(none.code, 'none');
  assert.equal(L.targetMessage(null, 2).code, 'invalid');
  assert.equal(L.targetMessage(null, NaN).code, 'invalid');
  assert.equal(L.targetMessage(null, 6.9).code, 'pick');
});

test('Versuch 3: Schülerrechnung wird geprüft, mit konkreter Ursache', () => {
  const plan = C.planMix('ac', 5.05);
  const ok = L.gradeMixCalc(plan, { r: '2,0', vb: '20', va: '10' });
  assert.equal(ok.ok, true);
  assert.equal(L.gradeMixCalc(plan, { r: '2', vb: '20,0', va: '10,0' }).ok, true);
  assert.equal(L.gradeMixCalc(plan, { r: '1,995', vb: '19,98', va: '10,02' }).ok, true);
  const inv = L.gradeMixCalc(plan, { r: '0,5', vb: '10', va: '20' });
  assert.equal(inv.r.kind, 'quotient'); assert.equal(inv.vb.kind, 'swap'); assert.equal(inv.ok, false);
  assert.equal(L.gradeMixCalc(plan, { r: '0,30', vb: '20', va: '10' }).r.kind, 'log');
  assert.equal(L.gradeMixCalc(plan, { r: '1,06', vb: '20', va: '10' }).r.kind, 'concept');
  assert.equal(L.gradeMixCalc(plan, { r: '2', vb: '20', va: '15' }).sum.kind, 'sum');
  assert.equal(L.gradeMixCalc(plan, { r: '', vb: '20', va: '10' }).empty, true);
  assert.equal(L.gradeMixCalc(plan, { r: 'abc', vb: '20', va: '10' }).r.kind, 'format');
  assert.equal(L.gradeMixCalc(plan, { r: '2', vb: '45', va: '10' }).vb.kind, 'range');
  // Phosphat: mehr Säure-Lösung (r < 1)
  const pp = C.planMix('ph', 6.90);
  assert.equal(L.gradeMixCalc(pp, { r: '0,5', vb: '10', va: '20' }).ok, true);
  assert.equal(L.gradeMixCalc(pp, { r: '2', vb: '20', va: '10' }).r.kind, 'quotient');
  assert.equal(L.gradeMixCalc(pp, { r: '-0,3', vb: '10', va: '20' }).r.kind, 'log');
});

test('Versuch 3: Auswertung nennt Ursache der Abweichung, Messwert bleibt unverändert', () => {
  const mk = (sys, t, vA, vB, calc) => {
    const c = C.mixComp(sys, vA, vB), pair = C.pairAmounts(sys, c);
    return { system: sys, target: t, vAcid: vA, vBase: vB, V: c.V, nAcid: pair.acid, nBase: pair.base, ratio: pair.base / pair.acid, pH: C.pH(c), hh: C.hh(C.SYSTEMS[sys].pKa, pair.base, pair.acid), calc: calc || null };
  };
  const good = L.analyzeOutcome(mk('ac', 5.05, 10, 20));
  assert.equal(good.band, 'good'); assert.ok(Math.abs(good.dev) < 0.05); assert.equal(good.causes.length, 0);
  const off = L.analyzeOutcome(mk('ac', 5.05, 15, 15));
  assert.equal(off.band, 'off'); assert.ok(off.dev < -0.25);
  assert.match(off.causes[0], /Zugegeben wurden V\(Base\) = 15,0 mL und V\(Säure\) = 15,0 mL statt 20,0 mL und 10,0 mL/);
  assert.match(off.causes[0], /n\(A⁻\)\/n\(HA\) = 1,00 statt 2,00/);
  const bad = L.analyzeOutcome(mk('am', 9.55, 20, 10, { res: { ok: false, r: { ok: false, fb: 'Falscher Quotient: …', kind: 'quotient' }, vb: { ok: true }, va: { ok: true }, sum: { ok: true } } }));
  assert.ok(bad.causes.some((c) => /Rechnung war nicht vollständig richtig/.test(c)));
  const one = L.analyzeOutcome({ system: 'ac', target: 5.05, vAcid: 30, vBase: 0, V: 30, ratio: null, pH: 2.88, hh: null, calc: null });
  assert.match(one.causes[0], /kein Puffer/);
  const big = L.analyzeOutcome(mk('ph', 6.9, 40, 20));
  assert.ok(big.causes.some((c) => /Gesamtvolumen/.test(c)));
});

test('Notizbuch enthält das Herstellen eines Puffers; keine Carbonat-Systeme in Versuch 3', () => {
  assert.ok(L.NOTEBOOK.items.some((i) => typeof i === 'string' && /Puffer herstellen/.test(i)));
  assert.ok(!JSON.stringify(L.PROTOCOLS.e3).match(/HCO₃|Carbonat/));
});

test('Versuch 3: Rechnung mit ganzen mL und einer Nachkommastelle wird auch am Rand des Pufferbereichs akzeptiert', () => {
  const lo = C.planMix('ac', 3.75), hi = C.planMix('ac', 5.75);
  assert.equal(L.gradeMixCalc(lo, { r: '0,1', vb: '3', va: '27' }).ok, true, 'pH 3,75: 2,73 / 27,27 mL gerundet');
  assert.equal(L.gradeMixCalc(hi, { r: '10', vb: '27', va: '3' }).ok, true, 'pH 5,75');
  assert.equal(L.gradeMixCalc(C.planMix('ph', 6.4), { r: '0,16', vb: '4', va: '26' }).ok, true);
  assert.equal(L.gradeMixCalc(C.planMix('ac', 5.05), { r: '2', vb: '20,2', va: '10,2' }).sum.ok, true, 'Summe 30,4 mL innerhalb der Rundung');
  assert.equal(L.gradeMixCalc(C.planMix('ac', 5.05), { r: '2', vb: '22', va: '10' }).vb.ok, false);
  assert.equal(L.targetMessage('xx', 5).ok, false, 'unbekanntes System wirft nicht');
});
