// Experiment: Volumenbuchhaltung und Durchmischung (sichtbarer pH) ohne Browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const Experiment = require('../../js/experiment/experiment.js');
const Chem = require('../../js/model/chemistry.js');

const CFG = { sampleType: 'acid', cSample: 0.1, vSample: 25, cTitrant: 0.1, indicator: 'bromothymolBlue' };

/** Experiment kurz vor dem ÄP (der nächste Tropfen führt von pH 4,2 auf 9,7), Anzeige eingeschwungen */
function nearEquivalence(opts) {
  const exp = new Experiment(CFG, Object.assign({ electrode: true }, opts));
  exp.dispensed = 24.97;
  exp.delivered = 24.97;
  exp.pHMeasured = exp.pH;
  exp.points = [];
  exp.recordPoint();
  return exp;
}

/** Gibt einen Tropfen zu und misst, wie lange die Anzeige im Fenster [lo, hi] liegt */
function greenSeconds(exp, lo, hi) {
  exp.addVolume(0.05);
  let inWindow = 0;
  const h = 1 / 60;
  for (let t = 0; t < 40; t += h) {
    exp.update(h);
    if (exp.pHMeasured >= lo && exp.pHMeasured <= hi) inWindow += h;
  }
  return inWindow;
}

test('Gleichgewichts-pH springt mit dem letzten Tropfen, die Anzeige folgt verzögert', () => {
  const exp = nearEquivalence();
  const before = exp.pH;
  assert.ok(before < 4.5, 'vor dem ÄP sauer');
  exp.addVolume(0.05);
  exp.simulate(1.0);
  assert.ok(exp.pH > 9.5, 'nach dem Tropfen basisch: ' + exp.pH);
  assert.ok(exp.pHMeasured < exp.pH - 1, 'Anzeige hinkt nach: ' + exp.pHMeasured);
  exp.simulate(40);
  assert.ok(exp.isMixed);
  assert.equal(exp.pHMeasured, exp.pH, 'nach dem Einschwingen exakt der Gleichgewichtswert');
});

test('Bromthymolblau: Grün (pH 6–7,6) mit Rührer ≥ 1 s, ohne Rührer ≥ 3 s sichtbar', () => {
  const stirred = greenSeconds(nearEquivalence({ stirring: true }), 6.0, 7.6);
  const still = greenSeconds(nearEquivalence({ stirring: false }), 6.0, 7.6);
  assert.ok(stirred >= 1.0 && stirred <= 3.0, `mit Rührer ${stirred.toFixed(2)} s`);
  assert.ok(still >= 3.0 && still <= 8.0, `ohne Rührer ${still.toFixed(2)} s`);
  assert.ok(still > 2 * stirred, 'ohne Rührer deutlich länger');
});

test('Rührer zur Laufzeit umschaltbar; Zeitkonstanten aus den Vorgaben', () => {
  const exp = nearEquivalence();
  assert.equal(exp.mixTau, Experiment.DEFAULTS.mixTauStirred);
  exp.setStirring(false);
  assert.equal(exp.mixTau, Experiment.DEFAULTS.mixTauStill);
});

test('Messkurve: ein eingeschwungener Punkt je Tropfen, unabhängig von der Hahnbedienung', () => {
  const exp = nearEquivalence();
  exp.addVolume(0.05);
  exp.simulate(1.0); // Tropfen gelandet, Anzeige noch im Einschwingen
  const n = exp.points.length;
  const last = exp.points[n - 1];
  assert.ok(Math.abs(last.v - 25.02) < 1e-6, 'Punkt beim neuen Volumen');
  assert.ok(Math.abs(last.pH - exp.pH) < 1e-9, 'Punkt trägt den eingeschwungenen Wert, nicht die nachlaufende Anzeige');
  assert.ok(exp.pHMeasured < exp.pH - 1, 'Anzeige hinkt noch nach');
  exp.simulate(10);
  assert.equal(exp.points.length, n, 'keine weiteren Punkte beim gleichen Volumen');
  assert.ok(Math.abs(exp.points[n - 1].pH - last.pH) < 1e-12, 'Punkt bleibt unverändert');
  // Ungeduldige Bedienung: Strahl auf, zu, auf – Kurve bleibt monoton und ohne Stufen
  const rough = new Experiment(CFG, { electrode: true });
  for (let k = 0; k < 6; k++) {
    rough.setFlowRate(k % 2 ? 1.0 : 0.02);
    rough.openValve(); rough.simulate(k % 2 ? 3 : 2); rough.closeValve(); rough.simulate(1.5);
  }
  const pts = rough.points;
  assert.ok(pts.length > 20);
  for (let i = 1; i < pts.length; i++) {
    assert.ok(pts[i].v > pts[i - 1].v, 'Volumen steigt');
    assert.ok(pts[i].pH >= pts[i - 1].pH - 1e-9, `pH fällt bei ${pts[i].v} mL`);
    assert.ok(Math.abs(pts[i].pH - Chem.phAt(CFG, pts[i].v)) < 1e-9, 'jeder Punkt liegt auf der Modellkurve');
  }
  for (const d of Chem.derivative(pts)) assert.ok(Number.isFinite(d.slope));
});

test('Langsam titriert: Endpunkt im grünen Fenster liegt am ÄP; schneller Strahl überfährt ihn', () => {
  // langsam: ein Tropfen, dann warten
  const slow = nearEquivalence();
  slow.addVolume(0.05);
  slow.simulate(2.3); // Tropfen landet nach 0,8 s, danach läuft die Anzeige in den Grünbereich
  assert.ok(slow.pHMeasured > 6 && slow.pHMeasured < 7.6, 'grün: ' + slow.pHMeasured);
  slow.noteEndpoint();
  slow.simulate(1);
  assert.ok(Math.abs(slow.endpoint - 25.02) < 1e-6, 'Endpunkt = letzter Tropfen, 0,02 mL hinter dem ÄP');
  // schnell: Hahn offen, Strahl 1 mL/s, bis Grün erkannt und Hahn geschlossen
  const fast = nearEquivalence();
  fast.setFlowRate(1.0);
  fast.openValve();
  const h = 1 / 60;
  let t = 0;
  while (!(fast.pHMeasured > 6) && t < 30) { fast.update(h); t += h; }
  fast.noteEndpoint();
  fast.simulate(2);
  assert.ok(fast.endpoint > 25.3, 'übertitriert: ' + fast.endpoint + ' mL');
});

test('Volumenbuchhaltung: dispensed = delivered + hanging + Tropfen; Kapazität 50 mL', () => {
  const exp = new Experiment(CFG);
  exp.setFlowRate(0.5);
  exp.openValve();
  for (let i = 0; i < 300; i++) {
    exp.update(1 / 60);
    const sum = exp.delivered + exp.hanging + exp.inFlight;
    assert.ok(Math.abs(sum - exp.dispensed) < 1e-6);
  }
  exp.simulate(200);
  assert.equal(exp.dispensed, 50);
  assert.equal(exp.isFlowing, false);
});
