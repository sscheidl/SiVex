// Hilfen für die Unit-Tests: Versuche über die Handlungen des Modells durchspielen.
const M = require('../../js/model.js');

/** Führt eine Handlung aus und wartet, bis der Handgriff fertig ist (Gießen: bis Fließen beginnt). */
function act(e, name, ...args) {
  const r = e.act(name, ...args);
  let guard = 0;
  while (e.state.op && !(e.state.op.type === 'pour' && e.state.op.phase === 'flow') && guard++ < 2000) e.advance(0.05);
  return r;
}
/** Läuft, bis die Bedingung erfüllt ist (oder maxSec Modellzeit vergangen sind). */
function runUntil(e, cond, maxSec, chunk) {
  const c = chunk || 0.1;
  let t = 0;
  while (!cond(e.state) && t < maxSec) { e.advance(c); t += c; }
  return cond(e.state);
}
/** Gießt von src nach dst, bis `until` erfüllt ist oder der Fluss von selbst stoppt; danach zurückstellen. */
function pour(e, src, dst, opts) {
  const o = Object.assign({ speed: 'slow', until: null, max: 120 }, opts || {});
  e.act('setPourSpeed', o.speed);
  const r = act(e, 'pour', src, dst);
  if (!r.ok) return r;
  runUntil(e, (st) => !st.op || st.op.phase !== 'flow' || (o.until && o.until(st)), o.max, 0.05);
  if (e.state.op && e.state.op.phase === 'flow') e.act('stopPour');
  runUntil(e, (st) => !st.op, 5, 0.05);
  return r;
}
const wait = (e, sec) => e.advance(sec);
const sand = (o) => o.c.sandC + o.c.sandF;
module.exports = { M, act, runUntil, pour, wait, sand };
