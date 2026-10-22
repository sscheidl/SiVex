'use strict';
const { createLab } = require('../../js/lab.js');

/** Führt eine Handlung aus und lässt die Simulation laufen, bis sie abgeschlossen ist. */
function act(lab, fn) {
  const res = fn();
  let guard = 0;
  while (lab.state.op && guard++ < 400) lab.update(0.02);
  return res;
}

function addAll(lab, tubeId, ids) {
  for (const id of ids) {
    const r = act(lab, () => lab.addSubstance(tubeId, id));
    if (!r.ok) throw new Error('Zugabe fehlgeschlagen: ' + id + ' – ' + r.message);
  }
}

/**
 * Fehling-Probe über die Experimentsteuerung.
 * opts: {reagents, shake, heat, setting, seconds}
 */
function fehling(lab, tubeId, sampleId, opts) {
  const o = Object.assign({ reagents: ['fehling1', 'fehling2'], shake: true, heat: true, setting: 80, seconds: 30 }, opts);
  act(lab, () => lab.selectTube(tubeId));
  addAll(lab, tubeId, o.reagents);
  if (o.shake) act(lab, () => lab.shake(tubeId));
  if (sampleId) addAll(lab, tubeId, [sampleId]);
  if (o.heat) {
    lab.setHotplate(o.setting);
    act(lab, () => lab.moveTube(tubeId, 'bath'));
  }
  lab.advance(o.seconds);
  return lab.tubeById(tubeId);
}

function tollens(lab, tubeId, sampleId, opts) {
  const o = Object.assign({ reagents: ['agno3', 'naoh', 'nh3', 'nh3'], heat: true, setting: 60, seconds: 35 }, opts);
  act(lab, () => lab.selectTube(tubeId));
  addAll(lab, tubeId, o.reagents);
  if (sampleId) addAll(lab, tubeId, [sampleId]);
  if (o.heat) {
    lab.setHotplate(o.setting);
    act(lab, () => lab.moveTube(tubeId, 'bath'));
  }
  lab.advance(o.seconds);
  return lab.tubeById(tubeId);
}

function newLab(mode) {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return createLab({ mode: mode || 'learn', random });
}

module.exports = { act, addAll, fehling, tollens, newLab };
