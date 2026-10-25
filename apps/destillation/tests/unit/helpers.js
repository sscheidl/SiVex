// Hilfen für die Unit-Tests: Versuche über die Handlungen des Modells durchspielen.
const M = require('../../js/model.js');

/** Führt eine Handlung aus und wartet, bis der Handgriff fertig ist. */
function act(e, name, ...args) {
  const r = e.act(name, ...args);
  let guard = 0;
  while (e.state.op && e.state.op.type !== 'burn' && guard++ < 1000) e.advance(0.05);
  return r;
}

/**
 * Aufbau bis zum Heizen. opts: { mix, stones, thermo ('high'|'correct'|'low'), hoses ('ok'|'swap'|'none'),
 * water (bool), flow, heat, heater (bool), expert }
 */
function setup(opts) {
  const o = Object.assign({ mix: 'ew', stones: true, thermo: 'correct', hoses: 'ok', water: true, flow: 'mid', heat: 'mid', heater: true }, opts || {});
  const e = M.createEngine();
  if (o.expert || M.MIXES[o.mix].expert) act(e, 'setExpert', true);
  act(e, 'selectMix', o.mix);
  act(e, 'fill');
  if (o.stones) act(e, 'addStones');
  if (o.thermo !== 'high') act(e, 'setThermo', o.thermo);
  if (o.hoses === 'ok') { act(e, 'connectHose', 'inlet', 'low'); act(e, 'connectHose', 'outlet', 'high'); }
  if (o.hoses === 'swap') { act(e, 'connectHose', 'inlet', 'high'); act(e, 'connectHose', 'outlet', 'low'); }
  act(e, 'setFlow', o.flow);
  if (o.water && o.hoses !== 'none') act(e, 'setWater', true);
  act(e, 'setHeatLevel', o.heat);
  if (o.heater) act(e, 'setHeater', true);
  return e;
}

/** Läuft, bis die Bedingung erfüllt ist (oder maxSec Modellzeit vergangen sind). */
function runUntil(e, cond, maxSec, chunk) {
  const c = chunk || 1;
  let t = 0;
  while (!cond(e.state) && t < maxSec) { e.advance(c); t += c; }
  return cond(e.state);
}

const vol = M.vol;
module.exports = { M, act, setup, runUntil, vol };
