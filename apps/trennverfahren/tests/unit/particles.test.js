// Teilchenmodell (Darstellungslogik ohne Zeichnen): Mengen, gleichmäßige Verteilung, Emulsion, Magnet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const core = require('../../../../shared/labkit/js/core.js');
const M = require('../../js/model.js');
const { act, pour, runUntil } = require('./helpers.js');

/** Lädt particles.js in einen Kontext mit Modell und Labkit; Zeichenbefehle laufen ins Leere. */
function loadPV() {
  const ctx = { console, Math, LK: { core }, TV: { model: M }, devicePixelRatio: 1 };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/particles.js'), 'utf8'), ctx);
  return ctx.TV.particles;
}
const noop = () => {};
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: noop }) : k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
const canvas = { width: 300, height: 300, getContext: () => ctx2d, getBoundingClientRect: () => ({ width: 300, height: 300 }) };
const PV = loadPV();

function view(e, focus) {
  const v = PV.createParticleView(canvas, () => e, () => focus);
  return { v, run: (sec, rate) => { for (let t = 0; t < sec; t += 1 / 30) { if (rate !== 0) e.advance((rate || 1) / 30); v.frame(1 / 30, rate !== 0); } } };
}

test('Mengen: Eisenkörner proportional zur Masse, Salz als großes Gitter, Lösung mit vielen Ionen', () => {
  const o = (c) => ({ c: Object.assign(M.zero(), c) });
  assert.equal(PV.counts(o({ iron: 5 })).iron, 7);
  assert.equal(PV.counts(o({ iron: 1.25 })).iron, 2);
  assert.equal(PV.counts(o({ iron: 0 })).iron, 0);
  assert.ok(PV.counts(o({ saltS: 8 })).lattice >= 60, 'festes Kochsalz zeigt ein großes Gitter');
  assert.ok(PV.counts(o({ water: 40, saltD: 8 })).pairs >= 18, 'Kochsalzlösung zeigt viele Ionenpaare');
});

test('Magnet: nur erfasstes Eisen wandert zum Magneten; die übrigen Körner bleiben liegen und nichts fällt zurück', () => {
  const e = M.createEngine(5);
  const { v, run } = view(e, 'M');
  run(1);
  const P = () => v.state;
  e.act('magnet', 'M');
  let maxRestY = 0, back = false;
  const leavingIds = new Set();
  for (let i = 0; i < 120; i++) {
    run(1 / 30 * 1);
    P().leaving.forEach((g) => leavingIds.add(g));
    for (const g of P().grains) if (g.kind === 'iron') { maxRestY = Math.max(maxRestY, g.y); if (leavingIds.has(g)) back = true; }
    if (!e.state.op) break;
  }
  run(2);
  assert.equal(back, false, 'ein Korn, das zum Magneten gezogen wurde, kehrt nicht ins Gemisch zurück');
  assert.equal(P().grains.filter((g) => g.kind === 'iron').length, 2, 'nach dem ersten Durchgang liegen zwei Eisenkörner im Gemisch');
  for (const g of P().grains.filter((q) => q.kind === 'iron')) assert.ok(g.y > 200, 'verbliebene Körner liegen unten: ' + g.y);
  assert.equal(P().leaving.length, 0, 'erfasste Körner haben mit dem Magneten das Bild verlassen');
});

test('Öl als Reinstoff: gleichmäßig verteilt, keine Schichten oder Randreihen', () => {
  const e = M.createEngine(4);
  act(e, 'move', 'S', 'sepring');
  pour(e, 'A', 'S');
  act(e, 'move', 'B', 'sepunder'); e.act('setCock', 2); runUntil(e, (st) => st.objs.S.c.water < 0.3, 120, 0.05); e.act('setCock', 0);
  act(e, 'move', 'B', 'pB'); act(e, 'move', 'C', 'sepunder'); e.act('setCock', 2); runUntil(e, (st) => st.objs.S.c.oil < 0.3, 120, 0.05); e.act('setCock', 0);
  const { v, run } = view(e, 'C');
  run(3);
  const oil = v.state.oil;
  assert.ok(oil.length > 60, 'viele Ölteilchen: ' + oil.length);
  const ys = oil.map((p) => p.y), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const bins = new Array(6).fill(0);
  for (const y of ys) bins[Math.min(5, Math.floor((y - y0) / (y1 - y0 + 1e-9) * 6))]++;
  const mean = oil.length / 6;
  for (const b of bins) assert.ok(b > mean * 0.45 && b < mean * 1.8, 'Höhenverteilung gleichmäßig: ' + bins);
  const border = oil.filter((p) => p.u < 0.04 || p.u > 0.96).length / oil.length;
  assert.ok(border < 0.15, 'keine Häufung am Rand: ' + border);
});

test('Öl/Wasser: in der Schicht über die ganze Ölphase verteilt; nach dem Schütteln Tröpfchen im Wasser, kein Wasser in den Tröpfchen', () => {
  const e = M.createEngine(4);
  act(e, 'move', 'S', 'sepring');
  pour(e, 'A', 'S');
  const { v, run } = view(e, 'S');
  run(4);
  const s = v.state;
  const oilYs = s.oil.map((p) => p.y);
  const span = (Math.max(...oilYs) - Math.min(...oilYs)) / (s.oilR.y1 - s.oilR.y0);
  assert.ok(span > 0.8, 'Ölteilchen füllen die Ölphase, nicht nur die Grenzfläche: ' + span);
  // schütteln
  act(e, 'stopper', true); act(e, 'move', 'S', 'hand'); e.act('shake');
  run(3.5);
  act(e, 'move', 'S', 'sepring');
  run(0.5);
  const drops = s.dropsShown;
  assert.ok(drops.length >= 6, 'viele Öltröpfchen: ' + drops.length);
  const inDrops = s.oil.filter((p) => drops.some((d) => Math.hypot(p.x - d.x, p.y - d.y) < d.r + 4)).length;
  assert.ok(inDrops / s.oil.length > 0.6, 'die meisten Ölteilchen stecken in Tröpfchen: ' + inDrops / s.oil.length);
  const wetDrop = s.water.filter((p) => p.vis > 0.5 && drops.some((d) => Math.hypot(p.x - d.x, p.y - d.y) < d.r - 4)).length;
  assert.equal(wetDrop, 0, 'kein sichtbares Wasserteilchen im Innern eines Öltröpfchens');
  for (let i = 0; i < drops.length; i++) for (let j = i + 1; j < drops.length; j++) {
    const a = drops[i], b = drops[j];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * 0.85, 'Tröpfchen überlappen kaum');
  }
  // in Ruhe entmischt: wieder eine Schicht
  run(40);
  assert.ok(s.dropsShown.length <= 2, 'nach dem Stehenlassen kaum noch Tröpfchen: ' + s.dropsShown.length);
});
