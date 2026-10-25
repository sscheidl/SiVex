// Hilfen für die Unit-Tests: Versuche über die Handlungen des Modells durchspielen.
const M = require('../../js/model.js');

/** Führt eine Handlung aus und wartet, bis der Handgriff fertig ist. */
function act(e, name, ...args) {
  const r = e.act(name, ...args);
  let guard = 0;
  while (e.state.op && guard++ < 1000) e.advance(0.05);
  return r;
}

/**
 * Kompletter Versuch: Papier vorbereiten, Proben auftragen, Laufmittel, entwickeln.
 * opts: { samples: ['schwarz', …] (je Bahn, null = leer), solvent, portions, dabs, line, run (cm Front über Startlinie), engine }
 */
function runExperiment(opts) {
  const e = opts.engine || M.createEngine();
  const o = Object.assign({ solvent: 'water', portions: 1, dabs: 1, line: true, run: 8 }, opts);
  if (e.state.paper.state !== 'bench' || e.state.paper.line || e.state.paper.lanes.some(Boolean)) act(e, 'newSheet');
  if (o.line) act(e, 'drawLine');
  o.samples.forEach((s, i) => {
    if (!s) return;
    const n = Array.isArray(o.dabs) ? o.dabs[i] : o.dabs;
    for (let k = 0; k < n; k++) act(e, 'spot', i, s);
  });
  if (e.state.chamber.solvent && (e.state.chamber.solvent !== o.solvent || e.state.chamber.portions > o.portions)) act(e, 'emptyChamber');
  while (e.state.chamber.portions < o.portions) act(e, 'pour', o.solvent);
  act(e, 'insert');
  const target = M.PAPER.lineY + o.run;
  let guard = 0;
  while (e.state.paper.front < target && !e.state.paper.frontAtTop && guard++ < 200000) e.advance(0.5);
  if (o.extra) e.advance(o.extra);
  act(e, 'remove');
  return e;
}

/** Anzahl der sichtbaren Zonen je Bahn des aktuellen Papiers. */
const zoneCounts = (e) => [0, 1, 2].map((i) => M.zones(e.state.paper, i).length);

module.exports = { M, act, runExperiment, zoneCounts };
