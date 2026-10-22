'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chroma, chromatogram } = require('./helpers.js');

const lane = (lab, p, i) => lab.evaluatePaper(p).lanes.find((l) => l.lane === i);

test('C-01 Datensatz: sieben definierte Proben, zwei Laufmittel, Komponenten mit Rf und Löslichkeit je Laufmittel', () => {
  assert.equal(chroma.PENS.length, 7);
  assert.deepEqual(Object.keys(chroma.ELUENTS).sort(), ['ethanol', 'water']);
  assert.equal(Object.keys(chroma.PEN_BY_ID.black.comps).length, 3, 'Schwarz: drei Komponenten');
  assert.deepEqual(Object.keys(chroma.PEN_BY_ID.green.comps).sort(), ['blue', 'yellow']);
  assert.deepEqual(Object.keys(chroma.PEN_BY_ID.purple.comps).sort(), ['blue', 'red']);
  assert.deepEqual(Object.keys(chroma.PEN_BY_ID.orange.comps).sort(), ['red', 'yellow']);
  assert.deepEqual(Object.keys(chroma.PEN_BY_ID.refBlue.comps), ['blue']);
  assert.deepEqual(Object.keys(chroma.PEN_BY_ID.refYellow.comps), ['yellow']);
  for (const c of Object.values(chroma.COMPONENTS)) for (const e of ['water', 'ethanol']) {
    assert.ok(c[e].s >= 0 && c[e].s <= 1 && c[e].rf >= 0 && c[e].rf < 1);
  }
  assert.equal(chroma.COMPONENTS.permBlack.water.s, 0, 'wasserfester Farbstoff in Wasser unlöslich');
  assert.ok(chroma.COMPONENTS.permBlack.ethanol.s > 0.5);
});

test('C-01/C-02: Schwarz, Grün, Blau nebeneinander → 3, 2 und 1 Zone; gemeinsamer blauer Farbstoff auf gleicher Höhe', () => {
  const lab = chroma.create();
  const p = chromatogram(lab, ['black', 'green', 'refBlue']);
  const r = lab.evaluatePaper(p);
  assert.ok(r.clean);
  assert.equal(lane(lab, p, 0).bands, 3);
  assert.equal(lane(lab, p, 1).bands, 2);
  assert.equal(lane(lab, p, 2).bands, 1);
  const yBlue = (i) => p.zones.find((z) => z.lane === i && z.comp === 'blue').y;
  assert.ok(Math.abs(yBlue(0) - yBlue(1)) < 1e-9 && Math.abs(yBlue(1) - yBlue(2)) < 1e-9, 'blaue Zonen auf gleicher Höhe');
});

test('C-02: Laufmittelfront steigt stetig (h² ∝ t); Zonen bewegen sich unterschiedlich schnell mit', () => {
  const lab = chroma.create();
  lab.newPaper('sheet'); lab.drawLine('pencil', 1.5); lab.applySpot('black', 0);
  lab.fillChamber('water', 1); lab.setLid(true); lab.insertPaper();
  const fronts = [], yel = [], vio = [];
  for (let i = 0; i < 6; i++) {
    lab.advance(120);
    const p = lab.state.paper;
    fronts.push(p.front);
    yel.push(p.zones.find((z) => z.comp === 'yellow').y);
    vio.push(p.zones.find((z) => z.comp === 'violet').y);
  }
  for (let i = 1; i < fronts.length; i++) {
    assert.ok(fronts[i] > fronts[i - 1], 'Front steigt');
    assert.ok(fronts[i] - fronts[i - 1] < fronts[1] - fronts[0] + 1e-9, 'Front wird langsamer');
    assert.ok(yel[i] - yel[i - 1] > vio[i] - vio[i - 1], 'Gelb wandert schneller als Violett');
  }
});

test('C-03: Reinstoff-Referenzen ergeben genau eine Zone (in beiden Laufmitteln)', () => {
  for (const el of ['water', 'ethanol']) {
    const lab = chroma.create();
    const p = chromatogram(lab, ['refBlue', 'refYellow'], { eluent: el, seconds: 1500 });
    assert.equal(lane(lab, p, 0).bands, 1, el);
    assert.equal(lane(lab, p, 1).bands, 1, el);
    assert.ok(lane(lab, p, 0).moved && lane(lab, p, 1).moved);
  }
});

test('C-03/C-02: Wasserfester Stift bleibt in Wasser auf der Startlinie und wandert im Ethanol-Wasser-Gemisch', () => {
  const a = chroma.create();
  const pw = chromatogram(a, ['perm']);
  const lw = lane(a, pw, 0);
  assert.equal(lw.moved, false);
  assert.ok(pw.zones.every((z) => Math.abs(z.y - z.y0) < 1e-9));
  const b = chroma.create();
  const pe = chromatogram(b, ['perm'], { eluent: 'ethanol', seconds: 1500 });
  assert.equal(lane(b, pe, 0).moved, true);
});

test('C-04: Startlinie unter dem Laufmittelspiegel → Farbstoffe lösen sich im Vorrat, Chromatogramm unbrauchbar', () => {
  const lab = chroma.create();
  const p = chromatogram(lab, ['black', 'green'], { level: 2, line: 1.5 });
  const r = lab.evaluatePaper(p);
  assert.ok(r.issues.includes('submerged'));
  assert.equal(r.usable, false);
  assert.ok(p.pool > 1, 'Farbstoff im Laufmittelvorrat');
  assert.equal(r.lanes[0].bands, 0);
});

test('C-04: Kugelschreiber-Startlinie erzeugt eine zusätzliche Farbspur (sichtbare Störung)', () => {
  for (const el of ['water', 'ethanol']) {
    const lab = chroma.create();
    const p = chromatogram(lab, ['refBlue'], { tool: 'ballpoint', eluent: el, seconds: 1200 });
    const band = p.zones.find((z) => z.comp === 'ballpoint');
    assert.ok(band && band.amount > 0.05 && band.y > band.y0 + 0.5, el + ': Kugelschreiberfarbe wandert');
    const r = lab.evaluatePaper(p);
    assert.ok(r.issues.includes('ballpoint'));
    assert.equal(r.clean, false);
  }
});

test('C-04: Überladener Fleck → breitere Zonen, die zusammenlaufen können (Kontrast zur Normalprobe)', () => {
  const lab = chroma.create();
  const p = chromatogram(lab, ['black', 'black'], { loads: [1, 5] });
  const s = (i, c) => p.zones.find((z) => z.lane === i && z.comp === c && z.mobile).sigma;
  assert.ok(s(1, 'blue') > 2 * s(0, 'blue'), `breiter: ${s(1, 'blue')} vs ${s(0, 'blue')}`);
  assert.ok(lane(lab, p, 1).bands < lane(lab, p, 0).bands, 'Zonen laufen ineinander');
  assert.ok(lab.evaluatePaper(p).issues.includes('overload'));
});

test('C-04: Ungeeignetes bzw. anderes Laufmittel verändert die Auftrennung (andere Reihenfolge)', () => {
  const a = chroma.create(), b = chroma.create();
  const pw = chromatogram(a, ['green']);
  const pe = chromatogram(b, ['green'], { eluent: 'ethanol', seconds: 1500 });
  const order = (p) => p.zones.filter((z) => z.mobile).sort((x, y) => x.y - y.y).map((z) => z.comp).join(',');
  assert.notEqual(order(pw), order(pe));
});

test('C-04: Zu kurze Entwicklung → geringe Laufstrecken, als „zu kurz“ gekennzeichnet', () => {
  const lab = chroma.create();
  const p = chromatogram(lab, ['black'], { seconds: 90 });
  const r = lab.evaluatePaper(p);
  assert.ok(r.issues.includes('tooShort'));
  assert.equal(r.usable, false);
});

test('C-04: Laufmittel bis zum Rand → Front nicht sicher bestimmbar, Zonen bleiben beobachtbar', () => {
  const lab = chroma.create();
  const p = chromatogram(lab, ['black'], { seconds: 4000 });
  assert.ok(p.front >= chroma.PAPER_LEN - 1e-6);
  assert.equal(p.frontMark.valid, false);
  const r = lab.evaluatePaper(p);
  assert.ok(r.issues.includes('frontAtTop'));
  assert.equal(r.lanes[0].bands >= 2, true, 'Banden weiterhin beobachtbar');
  assert.equal(lab.rfOf(p, p.zones[0]), null, 'kein Rf-Wert');
});

test('C-05 Rf: korrekt berechnet; ohne markierte Front nicht bestimmbar; Front nach dem Trocknen nicht mehr markierbar', () => {
  const lab = chroma.create();
  const p = chromatogram(lab, ['refBlue']);
  const z = p.zones.find((x) => x.comp === 'blue');
  const rf = lab.rfOf(p, z);
  assert.ok(Math.abs(rf - chroma.COMPONENTS.blue.water.rf) < 1e-6, 'Rf = Stoffstrecke / Laufmittelstrecke = Modellwert');
  const lab2 = chroma.create();
  const p2 = chromatogram(lab2, ['refBlue'], { mark: false });
  assert.equal(lab2.rfOf(p2, p2.zones[0]), null);
  lab2.advance(120);
  assert.equal(lab2.markFront().ok, false, 'trocken: Front nicht mehr erkennbar');
});

test('Ablauf: Papier mit Proben unter dem Spiegel, ohne Laufmittel, doppelte Bahn – sinnvolle Rückmeldungen', () => {
  const lab = chroma.create();
  assert.equal(lab.insertPaper().ok, false);
  lab.newPaper('sheet');
  assert.equal(lab.insertPaper().ok, false, 'ohne Laufmittel');
  lab.drawLine('pencil', 1.5);
  lab.applySpot('black', 0);
  assert.equal(lab.applySpot('green', 0).ok, false, 'Bahn belegt');
  assert.equal(lab.drawLine('pencil', 2).ok, false, 'Linie nach dem Auftragen');
  lab.fillChamber('water', 1);
  assert.ok(lab.insertPaper().ok);
  assert.equal(lab.newPaper('sheet').ok, false, 'Papier steht in der Kammer');
});

test('A-04 Zeitraffer in der Chromatographie: gleiche Simulationszeit → gleiche Laufstrecken', () => {
  const run = (chunk) => {
    const lab = chroma.create();
    lab.newPaper('sheet'); lab.drawLine('pencil', 1.5); lab.applySpot('black', 0); lab.fillChamber('water', 1); lab.insertPaper();
    for (let i = 0; i < Math.round(600 / chunk); i++) lab.update(chunk);
    return JSON.stringify(lab.state.paper.zones.map((z) => z.y.toFixed(9)));
  };
  assert.equal(run(0.25), run(5));
  assert.equal(run(5), run(20));
});
