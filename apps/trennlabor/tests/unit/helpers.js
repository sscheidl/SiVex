'use strict';
const classic = require('../../js/classic.js');
const chroma = require('../../js/chroma.js');
const distill = require('../../js/distill.js');
const tasks = require('../../js/tasks.js');

/** Führt eine Handlung aus und lässt das Modell laufen, bis die Animation fertig ist. */
function run(e, name, ...args) {
  const r = e.act(name, ...args);
  let guard = 0;
  while (e.state.op && guard++ < 20000) e.advance(0.05);
  return r;
}
function expectOk(r, what) {
  if (!r.ok) throw new Error(`${what || 'Handlung'} fehlgeschlagen: ${r.message}`);
  return r;
}

const K = (id) => classic.createEngine(id);

/** K-02/K-03-Standardweg: Lösen, Filtrieren, Eindampfen. */
function sandSaltPath(e, opts) {
  const o = Object.assign({ magnetFirst: false, water: 50 }, opts);
  if (o.magnetFirst) {
    for (let i = 0; i < 3; i++) expectOk(run(e, 'useMagnet', 'M'), 'Magnet');
    expectOk(run(e, 'releaseMagnet', 'U'), 'Abstreifen');
  }
  expectOk(run(e, 'pour', 'M', 'A', 'all'), 'Gemisch umfüllen');
  expectOk(run(e, 'addWater', 'A', o.water), 'Wasser');
  expectOk(run(e, 'stir', 'A'), 'Rühren');
  e.advance(15);
  expectOk(run(e, 'setPaper', 'folded'), 'Filterpapier');
  expectOk(run(e, 'move', 'E', 'filter'), 'Kolben unter Trichter');
  expectOk(run(e, 'pour', 'A', 'F', 'all'), 'Filtrieren');
  e.advance(120);
  expectOk(run(e, 'move', 'E', 'bench'), 'Kolben zurück');
  expectOk(run(e, 'pour', 'E', 'D', 'careful'), 'Filtrat in Schale');
  expectOk(run(e, 'move', 'D', 'heater'), 'Schale auf Heizplatte');
  expectOk(run(e, 'setHeater', 2), 'Heizen');
  e.advance(330);
  expectOk(run(e, 'setHeater', 1), 'Heizen niedrig');
  e.advance(400);
  run(e, 'setHeater', 0);
  e.advance(200);
}

function chromaRun(e, { tool = 'pencil', y = 1.5, samples = ['schwarz', 'gruen', 'blau'], solvent = 'water', level = 'low', lid = true, seconds = 700, dots = 1, mark = true, archive = true } = {}) {
  if (e.state.paper.state !== 'bench' || e.state.paper.line) expectOk(run(e, 'newSheet'));
  expectOk(run(e, 'drawLine', tool, y), 'Startlinie');
  samples.forEach((s, i) => { for (let k = 0; k < dots; k++) expectOk(run(e, 'spot', i, s), 'Probe'); });
  if (e.state.chamber.solvent && e.state.chamber.solvent !== solvent) expectOk(run(e, 'emptyChamber'));
  if (!e.state.chamber.solvent) expectOk(run(e, 'fill', solvent, level), 'Laufmittel');
  run(e, 'setLid', lid);
  expectOk(run(e, 'insert'), 'Einstellen');
  e.advance(seconds);
  expectOk(run(e, 'remove'), 'Herausnehmen');
  if (mark) run(e, 'markFront');
  if (archive) expectOk(run(e, 'archive'), 'Ablegen');
  return e.state.archive[e.state.archive.length - 1];
}

/** Vollständiger Destillationsaufbau. opts: Abweichungen */
function buildDistill(e, opts) {
  const o = Object.assign({ chips: true, fill: 100, thermo: 'vapor', hoses: 'correct', adapter: true, receiver: true, clamps: true, cooling: 2, stopper: false }, opts);
  expectOk(run(e, 'mount', 'heater'));
  expectOk(run(e, 'mount', 'flask'));
  if (o.chips) expectOk(run(e, 'mount', 'chips'));
  if (o.fill) expectOk(run(e, 'fill', o.fill));
  expectOk(run(e, 'mount', 'head'));
  if (o.thermo) expectOk(run(e, 'mount', 'thermo', o.thermo));
  expectOk(run(e, 'mount', 'condenser'));
  if (o.hoses) expectOk(run(e, 'mount', 'hoses', o.hoses));
  if (o.adapter) expectOk(run(e, 'mount', 'adapter'));
  if (o.receiver) expectOk(run(e, 'mount', 'receiver'));
  if (o.clamps) expectOk(run(e, 'mount', 'clamps'));
  if (o.stopper) expectOk(run(e, 'mount', 'stopper'));
  if (o.cooling && o.hoses) expectOk(run(e, 'setCooling', o.cooling));
}

module.exports = { classic, chroma, distill, tasks, run, expectOk, K, sandSaltPath, chromaRun, buildDistill };
