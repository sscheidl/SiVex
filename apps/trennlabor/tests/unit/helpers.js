'use strict';
const classic = require('../../js/model/classic.js');
const chroma = require('../../js/model/chroma.js');
const distill = require('../../js/model/distill.js');
const tasks = {
  classic: require('../../js/tasks/classic-tasks.js'),
  chroma: require('../../js/tasks/chroma-tasks.js'),
  distill: require('../../js/tasks/distill-tasks.js')
};
const session = require('../../js/session.js');

/** Führt eine Handlung aus und lässt die Simulation laufen, bis sie abgeschlossen ist. */
function act(lab, fn, step) {
  const r = fn();
  let g = 0;
  while (lab.busy() && g++ < 40000) lab.advance(step || 0.25);
  return r;
}
function must(lab, fn) {
  const r = act(lab, fn);
  if (!r || r.ok === false) throw new Error('Handlung fehlgeschlagen: ' + (r && r.message));
  return r;
}
const taskById = (id) => [...tasks.classic.TASKS, ...tasks.chroma.TASKS, ...tasks.distill.TASKS].find((t) => t.id === id);
const engine = (id) => taskById(id).createEngine();

/** K-02 vollständig und richtig durchführen. */
function k02Positive(lab) {
  must(lab, () => lab.addWater('B1', 50));
  must(lab, () => lab.stir('B1'));
  must(lab, () => lab.insertFilter('paper'));
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(250);
  must(lab, () => lab.pour('B2', 'D', 'slow'));
  lab.setBurner(2);
  let g = 0; while (lab.describe('D').water > 5 && g++ < 5000) lab.advance(1);
  lab.setBurner(1);
  g = 0; while (lab.describe('D').water > 0.05 && g++ < 5000) lab.advance(1);
  lab.setBurner(0);
  lab.advance(5);
  return lab;
}

/** Chromatogramm durchführen: pens = [penId, …] auf Bahnen 0.. */
function chromatogram(lab, pens, o) {
  const opt = Object.assign({ eluent: 'water', level: 1, line: 1.5, tool: 'pencil', loads: null, seconds: 700, lid: true, mark: true, paper: 'sheet' }, o);
  lab.newPaper(opt.paper);
  if (opt.tool) lab.drawLine(opt.tool, opt.line);
  pens.forEach((p, i) => { const n = opt.loads ? opt.loads[i] : 1; for (let k = 0; k < n; k++) lab.applySpot(p, i); });
  lab.fillChamber(opt.eluent, opt.level);
  lab.setLid(opt.lid);
  const r = lab.insertPaper();
  if (!r.ok) throw new Error(r.message);
  lab.advance(opt.seconds);
  lab.removePaper();
  if (opt.mark) lab.markFront();
  return lab.state.paper;
}

/** Destillationsapparatur aufbauen. o: Abweichungen vom korrekten Aufbau. */
function buildDistill(o) {
  const opt = Object.assign({ portions: 4, stones: true, thermo: 'correct', hose: 'bottom', clamps: true, receiver: 'A', cool: 2, cooler: true, adapter: true, head: true }, o);
  const lab = distill.create();
  lab.place('mantle'); lab.place('flask');
  for (let i = 0; i < opt.portions; i++) lab.fill();
  if (opt.stones) lab.addStones();
  if (opt.head) lab.place('head');
  if (opt.head && opt.thermo) lab.place('thermo', opt.thermo);
  if (opt.head && opt.cooler) lab.place('cooler');
  if (opt.cooler && opt.hose) lab.place('hoses', opt.hose);
  if (opt.cooler && opt.adapter) lab.place('adapter');
  if (opt.head && opt.clamps) lab.place('clamps');
  if (opt.receiver) lab.placeReceiver(opt.receiver);
  if (opt.cooler && opt.hose) lab.setCooling(opt.cool);
  return lab;
}

function newSession() { return session.createSession(); }

module.exports = { classic, chroma, distill, tasks, session, act, must, taskById, engine, k02Positive, chromatogram, buildDistill, newSession };
