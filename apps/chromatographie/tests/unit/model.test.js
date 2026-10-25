// Unit- und Regressionstests des Fachmodells (ohne DOM). Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { M, act, runExperiment, zoneCounts } = require('./helpers.js');

const EXPECTED = {
  water: { schwarz: 3, gruen: 2, violett: 2, orange: 2, blau: 1, gelb: 1, wasserfest: 1 },
  etoh: { schwarz: 2, gruen: 1, violett: 2, orange: 2, blau: 1, gelb: 1, wasserfest: 2 }
};

test('F-01 Datensatz: sieben Proben, zwei Laufmittel, drei Bahnen', () => {
  assert.equal(M.SAMPLES.length, 7);
  assert.deepEqual(Object.keys(M.SOLVENTS).sort(), ['etoh', 'water']);
  assert.match(M.SOLVENTS.etoh.name, /1 : 1/);
  assert.equal(M.PAPER.lanesX.length, 3);
  const e = runExperiment({ samples: ['schwarz', 'gruen', 'blau'] });
  assert.deepEqual(e.state.paper.lanes.map((l) => l.sampleId), ['schwarz', 'gruen', 'blau']);
});

for (const solvent of ['water', 'etoh']) {
  for (const s of M.SAMPLES) {
    test(`F-02 Zonenzahl ${s.id} in ${solvent} bei 5, 8 und 11 cm Laufstrecke`, () => {
      for (const run of [5.2, 8, 11]) {
        const e = runExperiment({ samples: [s.id, null, null], solvent, run });
        assert.ok(e.quality().valid, `${s.id}/${solvent}/${run}: gültig`);
        assert.equal(zoneCounts(e)[0], EXPECTED[solvent][s.id], `${s.id}/${solvent}/${run} cm`);
      }
    });
  }
}

test('F-02 Schwarz in Wasser: violett, blau, gelb von unten nach oben', () => {
  const e = runExperiment({ samples: ['schwarz', null, null] });
  assert.deepEqual(M.zones(e.state.paper, 0).map((z) => z.color), ['violett', 'blau', 'gelb']);
});

test('F-03 Gemeinsamer blauer Bestandteil von Grün und Violett liegt auf der Höhe der Blau-Referenz', () => {
  const e = runExperiment({ samples: ['gruen', 'violett', 'blau'] });
  const p = e.state.paper;
  const ref = M.zones(p, 2)[0];
  const blueIn = (lane) => M.zones(p, lane).find((z) => Math.abs(z.s - ref.s) < 0.15);
  assert.ok(blueIn(0) && blueIn(0).comps.includes('B'), 'Grün hat eine Zone auf Referenzhöhe');
  assert.ok(blueIn(1) && blueIn(1).comps.includes('B'), 'Violett hat eine Zone auf Referenzhöhe');
  // Die anderen Zonen liegen deutlich woanders
  const others = [...M.zones(p, 0), ...M.zones(p, 1)].filter((z) => !z.comps.includes('B'));
  assert.ok(others.every((z) => Math.abs(z.s - ref.s) > 0.8));
});

test('F-04 Wasserfester Stift: in Wasser auf der Startlinie, in Ethanol-Wasser wandert ein Teil', () => {
  const w = runExperiment({ samples: ['wasserfest', null, null], solvent: 'water', run: 10 });
  const zw = M.zones(w.state.paper, 0);
  assert.equal(zw.length, 1);
  assert.ok(zw[0].atStart && !zw[0].moving);
  const et = runExperiment({ samples: ['wasserfest', null, null], solvent: 'etoh', run: 10 });
  const ze = M.zones(et.state.paper, 0);
  assert.equal(ze.length, 2);
  assert.ok(ze[0].atStart, 'Rest bleibt an der Startlinie');
  assert.ok(ze[1].s > 4, 'ein Anteil wandert weit');
});

test('F-05 Füllstand über der Startlinie: Proben lösen sich im Laufmittel, Chromatogramm ungültig', () => {
  const e = runExperiment({ samples: ['schwarz', 'gruen', null], portions: 3 });
  const q = e.quality();
  assert.ok(q.issues.includes('submerged'));
  assert.equal(q.valid, false);
  assert.ok(e.state.chamber.tint[3] > 0.2, 'Laufmittel sichtbar gefärbt');
  assert.ok(e.state.paper.dissolved[0] > 0.9);
  assert.deepEqual(zoneCounts(e), [0, 0, 0]);
  // zweimal Eingießen ist noch geeignet
  const ok2 = runExperiment({ samples: ['schwarz', null, null], portions: 2 });
  assert.ok(ok2.quality().valid);
});

test('F-05 Überladung: vier Auftupfer verschmieren die Zonen, Bahn gilt als überladen', () => {
  const e = runExperiment({ samples: ['schwarz', 'schwarz', null], dabs: [1, 4] });
  const [n1, n4] = zoneCounts(e);
  assert.equal(n1, 3);
  assert.ok(n4 < 3, 'überladene Bahn zeigt weniger getrennte Zonen');
  assert.ok(e.quality().issues.includes('overloaded'));
  const s1 = M.bands(e.state.paper).find((b) => b.lane === 0 && b.comp === 'B');
  const s4 = M.bands(e.state.paper).find((b) => b.lane === 1 && b.comp === 'B');
  assert.ok(s4.sigma > s1.sigma * 1.4 && s4.tail > 0.5, 'breiter mit Schweif');
});

test('F-05 Mehrfaches Auftupfen (2–3×) macht Zonen breiter, trennt aber noch', () => {
  const e = runExperiment({ samples: ['schwarz', 'schwarz', 'schwarz'], dabs: [1, 2, 3] });
  assert.deepEqual(zoneCounts(e), [3, 3, 3]);
  const sig = [0, 1, 2].map((i) => M.bands(e.state.paper).find((b) => b.lane === i && b.comp === 'G').sigma);
  assert.ok(sig[0] < sig[1] && sig[1] < sig[2]);
  assert.ok(!e.quality().issues.includes('overloaded'));
});

test('F-05 Zu früh herausgenommen: Trennung unvollständig', () => {
  const e = runExperiment({ samples: ['schwarz', null, null], run: 2.5 });
  assert.ok(e.quality().issues.includes('short'));
  assert.equal(e.quality().valid, false);
  assert.ok(zoneCounts(e)[0] < 3, 'Zonen liegen noch übereinander');
});

test('F-05 Ungeeignetes Laufmittel: Grün in Ethanol-Wasser bleibt eine Zone, auch bei langer Laufstrecke', () => {
  const e = runExperiment({ samples: ['gruen', null, null], solvent: 'etoh', run: 11.5 });
  assert.ok(e.quality().valid);
  const z = M.zones(e.state.paper, 0);
  assert.equal(z.length, 1);
  assert.equal(z[0].color, 'grün');
});

test('Ohne Startlinie: Flecken auf unterschiedlicher Höhe, Chromatogramm ungültig', () => {
  const e = runExperiment({ samples: ['blau', 'blau', 'blau'], line: false });
  const ys = e.state.paper.lanes.map((l) => l.y);
  assert.ok(new Set(ys).size === 3);
  assert.ok(e.quality().issues.includes('noLine'));
  assert.equal(e.quality().valid, false);
});

test('Ohne Laufmittel steigt nichts; Front bleibt 0', () => {
  const e = M.createEngine();
  act(e, 'drawLine'); act(e, 'spot', 0, 'schwarz'); act(e, 'insert');
  e.advance(300);
  assert.equal(e.state.paper.front, 0);
  act(e, 'remove');
  assert.ok(e.quality().issues.includes('noSolvent'));
  assert.equal(e.state.archive.length, 0);
});

test('G-04/Modell: Front steigt fortlaufend und wird langsamer (Washburn), Zonen wandern unterschiedlich schnell', () => {
  const e = M.createEngine();
  act(e, 'drawLine'); act(e, 'spot', 0, 'schwarz'); act(e, 'pour', 'water'); act(e, 'insert');
  const fronts = [], ys = [];
  for (let i = 0; i < 12; i++) { e.advance(60); fronts.push(e.state.paper.front); ys.push(M.bands(e.state.paper).filter((b) => b.lane === 0).map((b) => b.y)); }
  for (let i = 1; i < fronts.length; i++) assert.ok(fronts[i] > fronts[i - 1], 'steigt');
  const d1 = fronts[1] - fronts[0], d9 = fronts[10] - fronts[9];
  assert.ok(d9 < d1 * 0.5, 'wird langsamer');
  for (let i = 1; i < ys.length; i++) ys[i].forEach((y, k) => assert.ok(y >= ys[i - 1][k] - 1e-9));
  const last = ys[ys.length - 1];
  assert.ok(new Set(last.map((y) => y.toFixed(2))).size === 3, 'drei Komponenten auf verschiedener Höhe');
});

test('F-06 Pause und Zeitraffer: gleiche Modellzeit → identischer Zustand', () => {
  const build = () => { const e = M.createEngine(); act(e, 'drawLine'); act(e, 'spot', 0, 'schwarz'); act(e, 'spot', 1, 'gruen'); act(e, 'pour', 'water'); act(e, 'insert'); return e; };
  const a = build(), b = build(), c = build();
  a.advance(600);
  for (let i = 0; i < 6000; i++) b.advance(0.1);
  [3.33, 0.02, 100, 0.5, 496.15].forEach((x) => c.advance(x));
  assert.equal(a.state.time.toFixed(6), b.state.time.toFixed(6));
  assert.deepEqual(M.zones(a.state.paper, 0), M.zones(b.state.paper, 0));
  assert.deepEqual(M.zones(a.state.paper, 1), M.zones(c.state.paper, 1));
  assert.equal(a.state.paper.front, c.state.paper.front);
});

test('Front am oberen Rand: Front 14 cm, Zonen bleiben auf dem Papier, Rf nicht bestimmbar', () => {
  const e = runExperiment({ samples: ['gelb', null, null], run: 20 });
  assert.ok(e.state.paper.frontAtTop);
  assert.equal(e.state.paper.front, M.PAPER.height);
  M.zones(e.state.paper, 0).forEach((z) => assert.ok(z.hi < M.PAPER.height));
  act(e, 'setExpert', true);
  const r = act(e, 'markFront');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'frontAtTop');
});

test('Expertenmodus: Front markieren und Rf aus Laufstrecken; zu spät markiert → nicht mehr erkennbar', () => {
  const e = runExperiment({ samples: ['blau', null, null], run: 9 });
  assert.equal(act(e, 'markFront').code, 'noExpert');
  act(e, 'setExpert', true);
  assert.ok(act(e, 'markFront').ok);
  const z = M.zones(e.state.paper, 0)[0];
  assert.ok(Math.abs(M.rf(e.state.paper, 0, z) - 0.62) < 0.01);
  assert.equal(e.state.archive[0].frontMark, e.state.paper.frontMark, 'Markierung im abgelegten Chromatogramm');
  const late = runExperiment({ samples: ['blau', null, null], run: 9 });
  act(late, 'setExpert', true);
  late.advance(M.FRONT_VISIBLE + 5);
  assert.equal(act(late, 'markFront').code, 'frontDry');
});

test('B-03 Zurücknehmen: Startlinie entfernen, Stift-Bahn belegt, Kammer leeren, neues Papier ohne Verlust', () => {
  const e = M.createEngine();
  act(e, 'drawLine');
  assert.ok(e.state.paper.line);
  act(e, 'drawLine'); // erneutes Antippen entfernt die Linie
  assert.equal(e.state.paper.line, false);
  act(e, 'drawLine');
  act(e, 'spot', 0, 'schwarz');
  assert.equal(act(e, 'eraseLine').code, 'eraseSpots');
  assert.equal(act(e, 'spot', 0, 'gruen').code, 'laneTaken');
  act(e, 'pour', 'water');
  assert.equal(act(e, 'pour', 'etoh').code, 'otherSolvent');
  act(e, 'emptyChamber');
  assert.equal(e.state.chamber.level, 0);
  act(e, 'pour', 'etoh');
  assert.equal(e.state.chamber.solvent, 'etoh');
  const first = runExperiment({ engine: e, samples: ['schwarz', null, null], solvent: 'etoh' });
  const second = runExperiment({ engine: first, samples: ['wasserfest', null, null], solvent: 'water' });
  assert.equal(second.state.archive.length, 2);
  assert.equal(second.state.archive[0].solvent, 'etoh');
  assert.equal(second.state.archive[1].solvent, 'water');
  assert.equal(second.state.archive[0].zones[0].length, 2, 'früherer Befund unverändert');
});

test('Handgriffe: Wirkung erst während der Bewegung, gesperrt solange sie läuft', () => {
  const e = M.createEngine();
  e.act('drawLine');
  assert.equal(e.state.paper.line, false);
  assert.equal(e.act('spot', 0, 'schwarz').code, 'busy');
  e.advance(M.OPS.line.dur);
  assert.equal(e.state.paper.line, true);
  e.act('spot', 0, 'schwarz');
  e.advance(M.OPS.spot.dur * 0.4);
  assert.equal(e.state.paper.lanes[0], null);
  e.advance(M.OPS.spot.dur * 0.2);
  assert.equal(e.state.paper.lanes[0].n, 1);
  e.advance(1);
  e.act('pour', 'water');
  e.advance(M.OPS.pour.dur / 2);
  assert.ok(e.state.chamber.level > 0 && e.state.chamber.level < M.PORTION, 'Spiegel steigt beim Gießen allmählich');
});

test('Gespeicherter Zustand lässt sich fortsetzen', () => {
  const e = runExperiment({ samples: ['schwarz', null, null] });
  const copy = M.createEngine(JSON.parse(JSON.stringify(e.state)));
  assert.deepEqual(M.zones(copy.state.paper, 0), M.zones(e.state.paper, 0));
  assert.equal(copy.state.archive.length, 1);
});
