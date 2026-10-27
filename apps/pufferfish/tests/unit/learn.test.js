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
