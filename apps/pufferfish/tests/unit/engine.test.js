// Zustandsablauf: Dosierung, Ankunft, Mischung, Messreihen, Versuch 3, Speichern.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/chem.js');
const E = require('../../js/engine.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, erhalten ${a}`);
function runUntilIdle(eng, max = 240) {
  let t = 0;
  while (t < max && (eng.busy() || eng.current().beakers.some((b) => b.pending.length))) { eng.step(0.05); t += 0.05; }
  return t;
}

test('Startzustand: Versuch 1, Wasser und Pufferlösung, Startmesswert protokolliert', () => {
  const eng = E.create();
  const s = eng.current();
  assert.equal(s.exp, 'e1'); assert.equal(s.reagent, 'HCl');
  assert.deepEqual(s.beakers.map((b) => b.key), ['water', 'puffer']);
  assert.deepEqual(s.beakers.map((b) => E.SAMPLES[b.key].name), ['Wasser', 'Pufferlösung']);
  near(s.beakers[0].records[0].pH, 7, 1e-9);
  near(s.beakers[1].records[0].pH, 7.2, 0.01);
});

test('Genau drei Versuche; Verdünnung (Versuch 4) ist nicht erreichbar', () => {
  assert.deepEqual(E.EXPERIMENTS.map((e) => e.id), ['e1', 'e2', 'e3']);
  const eng = E.create();
  assert.equal(eng.selectExperiment('e4').reason, 'unknown');
  assert.equal(eng.state.exp, 'e1');
  for (const k of Object.keys(E.SAMPLES)) assert.ok(!/c010|fill300|c100|r10_1/.test(k), 'keine Verdünnungs-/Verhältnisproben mehr');
  assert.ok(!JSON.stringify(E.EXPERIMENTS).match(/Verdünnung|Wunder/));
});

test('Ein Tropfen im Vergleichsmodus: erst Ankunft, dann Mischung, dann Kurvenpunkt – in beiden Gläsern gleich', () => {
  const eng = E.create();
  assert.ok(eng.dose('d1').ok);
  const s = eng.current();
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
  assert.equal(eng.setKind('d5').reason, 'busy');
  assert.equal(eng.selectExperiment('e2').reason, 'busy');
  runUntilIdle(eng);
  near(eng.current().beakers[0].added, 0.05, 1e-12, 'genau ein Tropfen');
  assert.equal(eng.state.log.length, 1);
});

test('Lösung, Pipette, Menge: ein Zustand; Bedienreihenfolge Lösung → Pipette → Menge → Zugabe', () => {
  const eng = E.create();
  assert.equal(eng.state.slot, 'HCl'); assert.equal(eng.state.tool, 'dropper'); assert.equal(eng.state.kind, 'd1');
  assert.ok(eng.selectSlot('NaOH').ok);
  assert.ok(eng.setKind('m5').ok, 'Mengenwahl wechselt die Pipette mit');
  assert.equal(eng.state.tool, 'measure'); assert.equal(eng.state.kind, 'm5');
  assert.ok(eng.setTool('dropper').ok);
  assert.equal(eng.state.kind, 'd1', 'passende Standardmenge zur Pipette');
  assert.equal(eng.dose('m1').reason, 'tool', 'Menge der anderen Pipette wird abgewiesen');
  assert.equal(eng.setKind('m10').reason, 'unknown', '10 mL gibt es nur in Versuch 3');
  assert.equal(eng.selectSlot('NH3').reason, 'unknown');
  eng.dose(eng.state.kind); runUntilIdle(eng);
  const n = eng.current();
  assert.equal(n.reagent, 'NaOH');
  near(n.beakers[0].records[1].pH, 10.221, 0.001);
  assert.equal(eng.state.log[0].reagent, 'NaOH');
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

test('Säure- und Laugenreihe getrennt, frische Ansätze; Gegenprobe ausdrücklich gekennzeichnet; nichts wird überschrieben', () => {
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
  eng.selectSlot('NaOH'); eng.selectSlot('HCl');
  near(eng.current().beakers[0].added, 0.05, 1e-12, 'mehrfaches Umschalten überschreibt nichts');
  assert.ok(eng.continueWithOther().ok);
  const c = eng.current();
  assert.equal(c.kind, 'cont'); assert.equal(c.reagent, 'NaOH');
  assert.deepEqual(c.from.added, [0.05, 0.05]);
  near(c.beakers[0].records[0].pH, 3.779, 0.001, 'Gegenprobe startet beim angesäuerten Zustand');
  eng.dose('d1'); runUntilIdle(eng);
  near(c.beakers[0].added, 0.05, 1e-12);
  assert.ok(c.beakers[0].records.at(-1).pH > c.beakers[0].records[0].pH, 'Lauge hebt den pH-Wert des angesäuerten Wassers');
  // Gegenprobe wählbar, frische Reihe der anderen Lösung bleibt getrennt
  assert.ok(eng.selectSlot('cont').ok);
  assert.equal(eng.current().kind, 'cont');
});

test('Neue Messreihe archiviert, frische Probe ersetzt nur ein Glas', () => {
  const eng = E.create();
  eng.selectExperiment('e2');
  eng.dose('d1'); runUntilIdle(eng);
  assert.ok(eng.freshSample(0).ok);
  assert.equal(eng.current().beakers[0].added, 0);
  near(eng.current().beakers[1].added, 0.05, 1e-12);
  assert.equal(eng.state.archive.length, 1);
  assert.ok(eng.newSeries().ok);
  assert.ok(eng.current().beakers.every((b) => b.added === 0));
  assert.equal(eng.state.archive.length, 2, 'nur behandelte Gläser werden archiviert');
  assert.equal(eng.newSeries().reason, 'fresh');
});

test('Kapazität: Weiterdosieren, keine NaN, Glas läuft nicht über', () => {
  const eng = E.create();
  eng.selectExperiment('e2'); eng.setTool('measure'); eng.setKind('m5');
  for (let k = 0; k < 13; k++) { const r = eng.dose('m5'); if (!r.ok) { assert.equal(r.reason, 'full'); break; } runUntilIdle(eng); }
  for (const b of eng.current().beakers) {
    assert.ok(b.comp.V <= 95 + 1e-9);
    assert.ok(b.records.every((p) => Number.isFinite(p.pH)));
    for (let i = 1; i < b.records.length; i++) assert.ok(b.records[i].pH <= b.records[i - 1].pH + 1e-9);
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

test('Weltbreite: Gläser verteilen sich, Höhe und Maße bleiben (größere Gläser als 0.1.0)', () => {
  const eng = E.create();
  const g0 = eng.geometry()[0];
  assert.ok((g0.bottom - g0.top) >= 258 * 1.1, 'Becherglas in Welteinheiten höher als in 0.1.0 (258); die Bildschirmgröße prüft der Browsertest');
  eng.setWorldWidth(1800);
  const g1 = eng.geometry();
  assert.ok(g1[1].x - g1[0].x > 400, 'weiter verteilt');
  eng.selectExperiment('e2'); eng.setWorldWidth(1000);
  const g = eng.geometry();
  for (let i = 1; i < g.length; i++) assert.ok(g[i].x - g[i].half - (g[i - 1].x + g[i - 1].half) > 20, 'Gläser überlappen nicht');
});

// ------------------------------------------------------------ Versuch 3
function dosePair(eng, vAcid, vBase) {
  const S = C.SYSTEMS[eng.state.system];
  const run = (stock, mL) => { eng.selectSlot(stock); eng.setKind('m10'); let rest = mL; while (rest > 1e-9) { const k = rest >= 10 ? 'm10' : rest >= 5 ? 'm5' : rest >= 1 ? 'm1' : 'm05'; const v = E.DOSES[k].vol; eng.setKind(k); const r = eng.dose(k); assert.ok(r.ok, r.text); runUntilIdle(eng); rest -= v; } };
  run(S.acid.stock, vAcid); run(S.base.stock, vBase);
}

test('Versuch 3: nur Messpipette, Stammlösungen als Flaschen, ohne HCl/NaOH', () => {
  const eng = E.create();
  eng.selectExperiment('e3');
  const s = eng.current();
  assert.equal(s.kind, 'mix'); assert.equal(eng.state.tool, 'measure');
  assert.deepEqual(eng.bottleKeys(), [], 'erst Systemwahl');
  assert.equal(eng.dose('m5').reason, 'system');
  assert.equal(eng.setTool('dropper').reason, 'tool');
  assert.equal(eng.selectSlot('HCl').reason, 'none');
  assert.ok(eng.selectSystem('ac', 5.05).ok);
  assert.deepEqual(eng.bottleKeys(), ['HAc', 'NaAc']);
  assert.equal(eng.selectSlot('HCl').reason, 'none', 'keine irreführende HCl/NaOH-Vorauswahl');
  assert.ok(eng.selectSlot('NaAc').ok);
  assert.equal(eng.dose('d1').reason, 'unknown');
  assert.ok(eng.dose('m5').ok); runUntilIdle(eng);
  const b = eng.current().beakers[0];
  near(b.vols.NaAc, 5, 1e-9); near(b.comp.V, 5, 1e-9);
  near(b.comp.Ac, 0.5, 1e-9); near(b.comp.Na, 0.5, 1e-9);
});

test('Versuch 3: kein Messwert vor dem Mischen; Messung aus dem Modell; falsches Verhältnis ändert den Wert', () => {
  const eng = E.create();
  eng.selectExperiment('e3');
  assert.ok(eng.selectSystem('ac', 5.05).ok);
  const plan = C.planMix('ac', 5.05);
  dosePair(eng, 10, 20);
  const b = eng.current().beakers[0];
  near(b.comp.V, 30, 1e-9);
  assert.equal(eng.meter(b).pH, null, 'pH-Wert erscheint erst nach dem Messen');
  assert.equal(eng.meter(b).measured, false);
  assert.equal(eng.state.history.length, 0);
  assert.ok(eng.measure({ r: '2,0', vb: '20', va: '10', res: null }).ok);
  assert.equal(eng.measure().reason, 'busy', 'während der Messung keine zweite Messung');
  assert.equal(eng.dose('m1').reason, 'busy');
  assert.equal(eng.meter(b).mixing, true); assert.equal(eng.meter(b).pH, null);
  runUntilIdle(eng);
  const m = eng.meter(b);
  assert.equal(m.measured, true);
  const modelPH = C.pH(C.mixComp('ac', 10, 20));
  near(m.pH, modelPH, 1e-12, 'Messwert = Modellrechnung, nicht an den Sollwert angeglichen');
  assert.ok(Math.abs(m.pH - 5.05) <= 0.05);
  const h = eng.state.history;
  assert.equal(h.length, 1);
  near(h[0].vAcid, 10, 1e-9); near(h[0].vBase, 20, 1e-9); near(h[0].ratio, 2, 1e-9); near(h[0].pH, modelPH, 1e-12);
  assert.equal(h[0].target, 5.05); assert.equal(h[0].calc.r, '2,0');
  assert.ok(Math.abs(h[0].hh - 5.0515) < 0.001);
  // weiter dosieren: Messwert gilt nicht mehr, Messprotokoll bleibt
  eng.selectSlot('HAc'); eng.setKind('m5'); eng.dose('m5'); runUntilIdle(eng);
  assert.equal(eng.meter(b).measured, false); assert.equal(eng.meter(b).pH, null);
  assert.equal(eng.state.history.length, 1);
  eng.measure(); runUntilIdle(eng);
  const second = eng.state.history[1];
  near(second.ratio, 2 / 1.5, 1e-9);
  assert.ok(second.pH < h[0].pH - 0.1, 'mehr Säure senkt den gemessenen pH-Wert nachweisbar');
  assert.ok(plan.VAcid > 0);
});

test('Versuch 3: alle drei Standardaufgaben im Labormodell, ohne Anpassung', () => {
  for (const [sys, t] of [['ac', 5.05], ['ph', 6.90], ['am', 9.55]]) {
    const eng = E.create(); eng.selectExperiment('e3');
    assert.ok(eng.selectSystem(sys, t).ok);
    const plan = C.planMix(sys, t);
    dosePair(eng, Math.round(plan.VAcid), Math.round(plan.VBase));
    assert.ok(eng.measure().ok); runUntilIdle(eng);
    const e = eng.state.history[0];
    assert.ok(Math.abs(e.pH - t) <= 0.05, `${sys}: ${e.pH} vs ${t}`);
    near(e.V, 30, 1e-9);
    // ein Fehler im Verhältnis: doppelt so viel Base
    const wrong = E.create(); wrong.selectExperiment('e3'); wrong.selectSystem(sys, t);
    dosePair(wrong, Math.round(plan.VAcid), Math.round(plan.VBase) + 10);
    wrong.measure(); runUntilIdle(wrong);
    assert.ok(wrong.state.history[0].pH - e.pH > 0.1, `${sys}: zu viel Base erhöht den pH-Wert`);
  }
});

test('Versuch 3: Systemwechsel setzt ein leeres Becherglas auf, Messungen bleiben; Neu ansetzen', () => {
  const eng = E.create(); eng.selectExperiment('e3');
  eng.selectSystem('ph', 6.9);
  dosePair(eng, 20, 10); eng.measure(); runUntilIdle(eng);
  assert.equal(eng.state.history.length, 1);
  assert.ok(eng.selectSystem('ac', 5.05).ok);
  assert.equal(eng.current().beakers[0].comp.V, 0, 'neues, leeres Glas');
  assert.equal(eng.state.history.length, 1);
  assert.deepEqual(eng.bottleKeys(), ['HAc', 'NaAc']);
  eng.selectSlot('NaAc'); eng.dose('m5'); runUntilIdle(eng);
  assert.ok(eng.newBatch().ok);
  assert.equal(eng.current().beakers[0].comp.V, 0);
  assert.equal(eng.measure().reason, 'empty');
});

test('Versuch 3: Experimentwechsel räumt die Lösungswahl auf (kein Stammlösungs-Slot in Versuch 1)', () => {
  const eng = E.create(); eng.selectExperiment('e3'); eng.selectSystem('am', 9.55);
  assert.equal(eng.state.slot, 'NH4Cl');
  assert.ok(eng.selectExperiment('e1').ok);
  assert.equal(eng.state.slot, 'HCl'); assert.equal(eng.current().exp, 'e1');
  assert.equal(eng.state.tool, 'measure', 'Pipette bleibt, Menge passt');
  assert.ok(E.expById('e1').doses.includes(eng.state.kind));
  eng.selectExperiment('e3');
  assert.equal(eng.state.slot, 'NH4Cl');
});

// ------------------------------------------------------------ Speichern
test('Speichern und Wiederherstellen (Stand 0.2.0, Version 2)', () => {
  const eng = E.create();
  eng.dose('d1'); runUntilIdle(eng);
  eng.selectSlot('NaOH'); eng.dose('d1');
  for (let i = 0; i < 20; i++) eng.step(0.05); // mitten in der Zugabe speichern
  const json = JSON.parse(JSON.stringify(eng.serialize()));
  assert.equal(json.v, 2);
  const r = E.create();
  assert.ok(r.restore(json));
  assert.equal(r.state.slot, 'NaOH');
  assert.equal(r.busy(), false, 'keine halbe Zugabe nach dem Neuladen');
  r.selectSlot('HCl');
  near(r.current().beakers[0].records[1].pH, 3.779, 0.001);
  assert.equal(r.restore({ v: 99 }), false);
});

test('Speicherstand 0.1.0 (Version 1) wird nicht gelesen und beschädigt nichts', () => {
  const eng = E.create();
  eng.dose('d1'); runUntilIdle(eng);
  const before = JSON.stringify(eng.serialize());
  // ein 0.1.0-Speicherstand mit entfernten Versuchen/Proben
  const old = { v: 1, uid: 5, exp: 'e4', slot: 'HCl', tool: 'dropper', showEvents: true, series: { s1: { id: 's1', exp: 'e4', reagent: 'HCl', kind: 'fresh', created: 1, from: null, beakers: [{ key: 'c100', comp0: C.acetate(30, 0.05, 0.05), comp: C.acetate(30, 0.05, 0.05), added: 0, records: [{ v: 0, pH: 4.75 }] }] } }, active: { e4: { HCl: 's1' } }, archive: [] };
  assert.equal(eng.restore(old), false);
  assert.equal(JSON.stringify(eng.serialize()), before, 'laufender Zustand bleibt unverändert');
  assert.equal(eng.state.exp, 'e1');
});

test('Wiederherstellen eines gespeicherten Versuchs 3 (Messwert, Volumina, System)', () => {
  const eng = E.create(); eng.selectExperiment('e3'); eng.selectSystem('am', 9.55);
  dosePair(eng, 10, 20); eng.measure({ r: '2,0', vb: '20', va: '10', res: null }); runUntilIdle(eng);
  const json = JSON.parse(JSON.stringify(eng.serialize()));
  const r = E.create();
  assert.ok(r.restore(json));
  assert.equal(r.state.exp, 'e3'); assert.equal(r.state.system, 'am'); assert.equal(r.state.target, 9.55);
  const b = r.current().beakers[0];
  near(b.comp.V, 30, 1e-9); near(b.vols.NH4Cl, 10, 1e-9); near(b.vols.NH3, 20, 1e-9);
  assert.equal(r.meter(b).measured, true);
  near(r.meter(b).pH, eng.meter(eng.current().beakers[0]).pH, 1e-12);
  assert.equal(r.state.history.length, 1);
  assert.equal(r.state.tool, 'measure');
});

test('Versuch 3: zweites Messen am unveränderten Glas wird abgewiesen (keine doppelten Zeilen)', () => {
  const eng = E.create(); eng.selectExperiment('e3'); eng.selectSystem('ac', 5.05);
  dosePair(eng, 10, 20); eng.measure(); runUntilIdle(eng);
  assert.equal(eng.measure().reason, 'measured');
  assert.equal(eng.state.history.length, 1);
  eng.selectSlot('HAc'); eng.setKind('m1'); eng.dose('m1'); runUntilIdle(eng);
  assert.ok(eng.measure().ok); runUntilIdle(eng);
  assert.equal(eng.state.history.length, 2);
});

test('Versuch 3: Systemwechsel während der Messung wird abgewiesen, Zustand bleibt konsistent', () => {
  const eng = E.create(); eng.selectExperiment('e3'); eng.selectSystem('ac', 5.05);
  dosePair(eng, 5, 5); eng.measure();
  assert.equal(eng.selectSystem(null, 6.9).reason, 'busy');
  assert.equal(eng.state.system, 'ac'); assert.equal(eng.state.target, 5.05);
  runUntilIdle(eng);
  assert.equal(eng.state.history[0].system, 'ac');
});

test('0.2.1: Rühren an/aus beschleunigt die Mischung, ändert aber keinen Messwert', () => {
  const a = E.create(), b = E.create();
  b.setStir(true);
  assert.equal(b.state.stirOn, true);
  assert.equal(b.stirring(b.current().beakers[0]), true);
  for (const e of [a, b]) e.dose('d1');
  const until = (e) => { let t = 0; while (t < 60 && (e.busy() || e.current().beakers.some((x) => x.pending.length))) { e.step(0.05); t += 0.05; } return t; };
  const ta = until(a), tb = until(b);
  assert.ok(tb < ta, `mit Rühren schneller protokolliert (${tb.toFixed(2)} s < ${ta.toFixed(2)} s)`);
  assert.equal(a.current().beakers[0].records[1].pH, b.current().beakers[0].records[1].pH);
  b.setStir(false);
  assert.equal(b.stirring(b.current().beakers[0]), false);
});
