// Zustandsablauf: Dosierung, Ankunft, Mischung, Messreihen, Speichern.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/chem.js');
const E = require('../../js/engine.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, erhalten ${a}`);
function runUntilIdle(eng, max = 120) {
  let t = 0;
  while (t < max && (eng.busy() || eng.current().beakers.some((b) => b.pending.length))) { eng.step(0.05); t += 0.05; }
  return t;
}

test('Startzustand: Versuch 1, frische Proben, Startmesswert protokolliert', () => {
  const eng = E.create();
  const s = eng.current();
  assert.equal(s.exp, 'e1'); assert.equal(s.reagent, 'HCl');
  assert.deepEqual(s.beakers.map((b) => b.key), ['water', 'wunder']);
  near(s.beakers[0].records[0].pH, 7, 1e-9);
  near(s.beakers[1].records[0].pH, 7.2, 0.01);
});

test('Ein Tropfen im Vergleichsmodus: erst Ankunft, dann Mischung, dann Kurvenpunkt – in beiden Gläsern gleich', () => {
  const eng = E.create();
  assert.ok(eng.dose('d1').ok);
  const s = eng.current();
  // kurz nach dem Start ist noch nichts im Glas
  eng.step(0.3);
  assert.equal(s.beakers[0].added, 0, 'kein Gleichgewicht vor Eintreffen des Tropfens');
  let sawPending = false, sawLandWithoutRecord = false;
  for (let t = 0; t < 60 && (eng.busy() || s.beakers.some((b) => b.pending.length)); t += 0.05) {
    eng.step(0.05);
    if (s.beakers[0].added > 0 && s.beakers[0].records.length === 1) sawLandWithoutRecord = true;
    if (s.beakers[0].pending.length) { sawPending = true; assert.ok(eng.meter(s.beakers[0]).mixing); }
  }
  assert.ok(sawLandWithoutRecord && sawPending, 'Mischphase zwischen Ankunft und Protokoll');
  for (const b of s.beakers) { near(b.added, 0.05, 1e-12); assert.equal(b.records.length, 2); near(b.records[1].v, 0.05, 1e-12); }
  near(s.beakers[0].records[1].pH, 3.779, 0.001);
  near(s.beakers[1].records[1].pH, 7.197, 0.001);
  near(s.beakers[0].comp.V, 30.05, 1e-12);
});

test('Doppelklick/Schnellbedienung: keine doppelte Dosierung, kein Wechsel während der Zugabe', () => {
  const eng = E.create();
  assert.ok(eng.dose('d1').ok);
  assert.equal(eng.dose('d1').reason, 'busy');
  assert.equal(eng.selectSlot('NaOH').reason, 'busy');
  assert.equal(eng.setTool('measure').reason, 'busy');
  runUntilIdle(eng);
  const s = eng.current();
  near(s.beakers[0].added, 0.05, 1e-12, 'genau ein Tropfen');
  assert.equal(eng.state.log.length, 1);
});

test('Fünf Tropfen und Messpipette: Volumen exakt, Punkte je Tropfen bzw. je Zugabe', () => {
  const eng = E.create();
  eng.dose('d5', [0]); runUntilIdle(eng);
  const b = eng.current().beakers[0];
  near(b.added, 0.25, 1e-12); assert.equal(b.records.length, 6);
  assert.equal(eng.current().beakers[1].added, 0, 'Einzelziel: anderes Glas unberührt');
  assert.equal(eng.dose('m1').reason, 'tool');
  eng.setTool('measure');
  assert.ok(eng.dose('m5').ok); runUntilIdle(eng);
  near(eng.current().beakers[0].added, 5.25, 1e-9); near(eng.current().beakers[1].added, 5, 1e-9);
  near(eng.current().beakers[1].records.at(-1).pH, C.pH(C.add(C.phosphate(30, 0.05, 0.05), 'HCl', 5)), 1e-9);
});

test('Säure- und Laugenreihe getrennt, frische Ansätze; Gegenprobe ausdrücklich gekennzeichnet', () => {
  const eng = E.create();
  eng.dose('d1'); runUntilIdle(eng);
  assert.ok(eng.selectSlot('NaOH').ok);
  const n = eng.current();
  assert.equal(n.reagent, 'NaOH');
  assert.ok(n.beakers.every((b) => b.added === 0), 'Laugenreihe beginnt frisch');
  eng.dose('d1'); runUntilIdle(eng);
  near(n.beakers[0].records[1].pH, 10.221, 0.001);
  eng.selectSlot('HCl');
  near(eng.current().beakers[0].added, 0.05, 1e-12, 'Säurereihe bleibt erhalten');
  assert.ok(eng.continueWithOther().ok);
  const c = eng.current();
  assert.equal(c.kind, 'cont'); assert.equal(c.reagent, 'NaOH');
  assert.deepEqual(c.from.added, [0.05, 0.05]);
  near(c.beakers[0].records[0].pH, 3.779, 0.001, 'Gegenprobe startet beim angesäuerten Zustand');
  eng.dose('d1'); runUntilIdle(eng);
  assert.equal(c.beakers[0].event.an.path, 'partner', 'H₃O⁺ + OH⁻ → 2 H₂O');
});

test('Neue Messreihe archiviert, frische Probe ersetzt nur ein Glas, Ansatz ändern', () => {
  const eng = E.create();
  eng.selectExperiment('e3');
  eng.dose('d1'); runUntilIdle(eng);
  assert.ok(eng.freshSample(0).ok);
  assert.equal(eng.current().beakers[0].added, 0);
  near(eng.current().beakers[1].added, 0.05, 1e-12);
  assert.equal(eng.state.archive.length, 1);
  assert.ok(eng.freshSample(2, 'r1_3').ok);
  assert.equal(eng.current().beakers[2].key, 'r1_3');
  assert.ok(eng.newSeries().ok);
  assert.ok(eng.current().beakers.every((b) => b.added === 0));
  assert.equal(eng.state.archive.length, 3);
  assert.equal(eng.newSeries().reason, 'fresh');
});

test('Kapazität: Weiterdosieren über die Reserve, keine NaN, Glas läuft nicht über', () => {
  const eng = E.create();
  eng.selectExperiment('e3'); eng.setTool('measure');
  for (let k = 0; k < 13; k++) { const r = eng.dose('m5'); if (!r.ok) { assert.equal(r.reason, 'full'); break; } runUntilIdle(eng); }
  for (const b of eng.current().beakers) {
    assert.ok(b.comp.V <= 95 + 1e-9);
    assert.ok(b.records.every((p) => Number.isFinite(p.pH)));
    for (let i = 1; i < b.records.length; i++) assert.ok(b.records[i].pH < b.records[i - 1].pH);
  }
});

test('Pause/Schritt: ohne Zeitschritt geschieht nichts, in kleinen Schritten konsistent', () => {
  const a = E.create(), b = E.create();
  a.dose('d1'); b.dose('d1');
  a.step(0); assert.equal(a.state.time, 0);
  for (let i = 0; i < 400; i++) a.step(0.025);
  for (let i = 0; i < 40; i++) b.step(0.25);
  const ra = a.current().beakers.map((x) => x.records.length), rb = b.current().beakers.map((x) => x.records.length);
  assert.deepEqual(ra, rb);
  near(a.current().beakers[0].records[1].pH, b.current().beakers[0].records[1].pH, 1e-12);
});

test('Speichern und Wiederherstellen', () => {
  const eng = E.create();
  eng.dose('d1'); runUntilIdle(eng);
  eng.selectSlot('NaOH'); eng.dose('d1');
  for (let i = 0; i < 20; i++) eng.step(0.05); // mitten in der Zugabe speichern
  const json = JSON.parse(JSON.stringify(eng.serialize()));
  const r = E.create();
  assert.ok(r.restore(json));
  assert.equal(r.state.slot, 'NaOH');
  assert.equal(r.busy(), false, 'keine halbe Zugabe nach dem Neuladen');
  r.selectSlot('HCl');
  near(r.current().beakers[0].records[1].pH, 3.779, 0.001);
  assert.equal(r.restore({ v: 99 }), false);
});

test('Verdünnungsversuch: 400-mL-Glas für die aufgefüllte Probe', () => {
  const eng = E.create();
  eng.selectExperiment('e4');
  const s = eng.current();
  assert.equal(s.beakers[2].type, 'b400');
  near(s.beakers[2].comp.V, 300, 1e-9);
  near(s.beakers[2].comp.Ac, s.beakers[0].comp.Ac, 1e-12, 'gleiche Stoffmenge wie unverdünnt');
  near(s.beakers[1].comp.Ac, s.beakers[0].comp.Ac / 10, 1e-12);
});
