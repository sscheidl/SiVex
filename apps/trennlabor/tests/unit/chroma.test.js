'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chroma, tasks, run, chromaRun } = require('./helpers.js');

const T = tasks.ALL;
const E = () => chroma.createEngine();
const lane = (snap, sampleId) => snap.zones[snap.lanes.findIndex((l) => l && l.sampleId === sampleId)];

test('Datensatz: sieben Proben, zwei Laufmittel, definierte Komponenten', () => {
  assert.equal(chroma.SAMPLES.length, 7);
  assert.deepEqual(Object.keys(chroma.SOLVENTS), ['water', 'etoh']);
  const parts = (id) => chroma.SAMPLE_BY_ID[id].parts.map((p) => p[0]).sort();
  assert.equal(parts('schwarz').length, 3);
  assert.deepEqual(parts('gruen'), ['B', 'G']);
  assert.deepEqual(parts('violett'), ['B', 'R']);
  assert.deepEqual(parts('orange'), ['G', 'R']);
  assert.deepEqual(parts('blau'), ['B']);
  assert.deepEqual(parts('gelb'), ['G']);
  // wasserfest: in Wasser unlöslich
  for (const [c] of chroma.SAMPLE_BY_ID.wasserfest.parts) assert.equal(chroma.COMPONENTS[c].water.sol, 0);
  // Alle Rf-Werte im Bereich [0, 1)
  for (const c of Object.values(chroma.COMPONENTS)) for (const s of ['water', 'etoh']) assert.ok(c[s].rf >= 0 && c[s].rf < 1);
});

test('C-01: Schwarz/Grün/Blau nebeneinander in Wasser → 3/2/1 Zonen; Front steigt kontinuierlich', () => {
  const e = E();
  run(e, 'drawLine', 'pencil', 1.5);
  ['schwarz', 'gruen', 'blau'].forEach((s, i) => run(e, 'spot', i, s));
  run(e, 'fill', 'water', 'low');
  run(e, 'setLid', true);
  run(e, 'insert');
  const fronts = [];
  for (let i = 0; i < 10; i++) { e.advance(60); fronts.push(e.state.paper.front); }
  for (let i = 1; i < fronts.length; i++) assert.ok(fronts[i] >= fronts[i - 1]);
  assert.ok(fronts[1] - fronts[0] > fronts[9] - fronts[8], 'Front wird langsamer (Kapillarmodell)');
  run(e, 'remove');
  run(e, 'markFront');
  const snap = run(e, 'archive').snap;
  assert.ok(snap.quality.valid, JSON.stringify(snap.quality));
  assert.equal(lane(snap, 'schwarz').length, 3);
  assert.equal(lane(snap, 'gruen').length, 2);
  assert.equal(lane(snap, 'blau').length, 1);
  // gemeinsamer blauer Farbstoff: gleiche Laufstrecke
  const blueRef = lane(snap, 'blau')[0];
  assert.ok(lane(snap, 'gruen').some((z) => Math.abs(z.s - blueRef.s) < 0.05));
  const r = T['C-1'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
});

test('C-02: wasserfester Stift wandert mit Wasser nicht; mit Ethanol-Wasser teilweise', () => {
  const e = E();
  const w = chromaRun(e, { samples: ['wasserfest'], solvent: 'water' });
  const zw = lane(w, 'wasserfest');
  assert.ok(zw.every((z) => z.atStart), 'alles bleibt auf der Startlinie');
  const et = chromaRun(e, { samples: ['wasserfest'], solvent: 'etoh', seconds: 1100 });
  const ze = lane(et, 'wasserfest');
  assert.ok(ze.some((z) => !z.atStart) && ze.some((z) => z.atStart), JSON.stringify(ze));
  const r = T['C-3'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  const qs = T['C-3'].questions(r.snapshot);
  assert.equal(qs[0].correct, 'stays');
  assert.equal(qs[1].correct, 'part');
});

test('C-03: Startlinie unter dem Flüssigkeitsspiegel → Proben lösen sich, Chromatogramm ungültig', () => {
  const e = E();
  const snap = chromaRun(e, { y: 1.0, level: 'high', samples: ['gruen'] });
  assert.ok(snap.submerged);
  assert.equal(snap.quality.valid, false);
  assert.ok(snap.quality.issues.includes('submerged'));
  assert.ok(e.state.chamber.tint[3] > 0.1, 'Laufmittel färbt sich');
  assert.ok(e.state.log.some((m) => m.code === 'submerged'));
});

test('C-04: Zu viel Farbstoff → breitere Zonen und Schweif; Kugelschreiber-Startlinie stört', () => {
  const a = E(), b = E();
  const normal = chromaRun(a, { samples: ['blau'], dots: 1 });
  const over = chromaRun(b, { samples: ['blau'], dots: 4 });
  assert.ok(lane(over, 'blau')[0].sigma > 1.3 * lane(normal, 'blau')[0].sigma);
  assert.ok(over.quality.issues.includes('overloaded'));
  const bands = chroma.bands(b.state.paper).filter((x) => x.lane === 0 && x.moving);
  assert.ok(bands[0].tail > 0, 'Schweif bei Überladung');
  // Kugelschreiber: mit Ethanol-Wasser wandert die Tinte quer über den Streifen
  const c = E();
  const pen = chromaRun(c, { tool: 'pen', samples: ['gelb'], solvent: 'etoh', seconds: 1000 });
  assert.ok(pen.quality.issues.includes('penLine'));
  assert.equal(pen.quality.valid, false);
  const penBands = chroma.bands(c.state.paper).filter((x) => x.lane === -1 && x.moving);
  assert.ok(penBands.length && penBands[0].s > 2, 'Kugelschreibertinte wandert sichtbar');
});

test('C-04: Unpassendes Laufmittel verändert die Trennung (Grün in Ethanol-Wasser: Gelb und Blau verschmelzen)', () => {
  const e = E();
  const snap = chromaRun(e, { samples: ['gruen', 'violett', 'blau'], solvent: 'etoh', seconds: 1300 });
  assert.ok(snap.quality.valid, JSON.stringify(snap.quality));
  assert.equal(lane(snap, 'gruen').length, 1, 'nicht aufgelöst');
  const r = T['C-2'].evaluate(e);
  assert.equal(r.success, false);
  assert.equal(r.problems[0].code, 'unresolved');
  // mit Wasser gelingt es
  const s2 = chromaRun(e, { samples: ['gruen', 'violett', 'blau'], solvent: 'water' });
  assert.equal(lane(s2, 'gruen').length, 2);
  const r2 = T['C-2'].evaluate(e);
  assert.ok(r2.success, JSON.stringify(r2.problems));
  assert.ok(r2.snapshot.common.includes('blau'));
  assert.equal(T['C-2'].questions(r2.snapshot)[0].correct, 'blau');
});

test('Entwicklung zu kurz → geringe Laufstrecke, Zonen nicht getrennt, ungültig', () => {
  const e = E();
  const snap = chromaRun(e, { samples: ['schwarz'], seconds: 40 });
  assert.ok(snap.quality.issues.includes('short'));
  assert.ok(lane(snap, 'schwarz').length < 3);
});

test('Laufmittel bis zum Rand: Front nicht bestimmbar (Rf null), Zonen aber beobachtbar', () => {
  const e = E();
  run(e, 'drawLine', 'pencil', 1.5);
  run(e, 'spot', 0, 'blau');
  run(e, 'fill', 'water', 'low');
  run(e, 'setLid', true);
  run(e, 'insert');
  e.advance(4000);
  assert.ok(e.state.paper.frontAtTop);
  run(e, 'remove');
  const m = run(e, 'markFront');
  assert.equal(m.ok, false);
  assert.equal(m.code, 'frontAtTop');
  const z = e.zones(0);
  assert.equal(z.length, 1);
  assert.equal(e.rf(z[0]), null);
  const snap = run(e, 'archive').snap;
  assert.ok(snap.quality.valid, 'Banden bleiben auswertbar');
  assert.ok(snap.quality.issues.includes('frontAtTop'));
});

test('Reinstoff-Referenzen zeigen genau eine Zone; Rf im Expertenmodus korrekt', () => {
  const e = E();
  const snap = chromaRun(e, { samples: ['blau', 'gelb'] });
  for (const id of ['blau', 'gelb']) assert.equal(lane(snap, id).length, 1);
  const z = e.zones(0)[0];
  const rf = e.rf(z);
  assert.ok(Math.abs(rf - chroma.COMPONENTS.B.water.rf) < 0.02, 'Rf ' + rf);
  // manuell nachgerechnet: Stoffstrecke / Frontstrecke ab Startlinie
  assert.ok(Math.abs(rf - z.s / (snap.frontMarked - snap.line.y)) < 1e-9);
});

test('Front trocknet: zu spätes Markieren nicht möglich', () => {
  const e = E();
  chromaRun(e, { samples: ['blau'], mark: false, archive: false });
  e.advance(chroma.FRONT_VISIBLE + 5);
  const r = run(e, 'markFront');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'frontDry');
});

test('Ohne Deckel steigt das Laufmittel langsamer (Verdunstung)', () => {
  const a = E(), b = E();
  for (const [e, lid] of [[a, true], [b, false]]) {
    run(e, 'drawLine', 'pencil', 1.5); run(e, 'spot', 0, 'blau'); run(e, 'fill', 'etoh', 'low'); run(e, 'setLid', lid); run(e, 'insert'); e.advance(900);
  }
  assert.ok(a.state.paper.front > b.state.paper.front + 0.5);
});

test('Fehlbedienungen werden abgelehnt: Proben ohne Startlinie, Laufmittelwechsel ohne Leeren, Linie nach dem Einstellen', () => {
  const e = E();
  assert.equal(run(e, 'spot', 0, 'blau').code, 'spotNoLine');
  run(e, 'fill', 'water', 'low');
  assert.equal(run(e, 'fill', 'etoh', 'low').code, 'otherSolvent');
  run(e, 'drawLine', 'pencil', 1.5);
  run(e, 'insert');
  assert.equal(run(e, 'spot', 0, 'blau').code, 'spotLate');
  assert.equal(run(e, 'newSheet').code, 'inChamber');
});

test('Zeitraffer ändert das Chromatogramm nicht', () => {
  const a = E(), b = E();
  for (const e of [a, b]) { run(e, 'drawLine', 'pencil', 1.5); run(e, 'spot', 0, 'schwarz'); run(e, 'fill', 'water', 'low'); run(e, 'setLid', true); run(e, 'insert'); }
  for (let i = 0; i < 6000; i++) a.advance(0.1);
  b.advance(600);
  assert.equal(JSON.stringify(a.zones(0)), JSON.stringify(b.zones(0)));
});
