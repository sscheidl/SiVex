// Fachmodell: Bilanzen, Konvergenz, unabhängige Referenzrechnungen, Kurvenverlauf
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/model/chemistry.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` erwartet ${b}, erhalten ${a} (±${tol})`);
const KW = 1e-14;

/**
 * Unabhängige Referenz: Newton-Verfahren auf der Ladungsbilanz in h
 * (ohne Logarithmen, eigene Anteilsformel α_j = Π K_i / h^j / Σ …).
 * Startwert und Verfahren unterscheiden sich vom Bisektionssolver des Modells.
 */
function referencePH(exp, v) {
  const sys = C.SYSTEMS[exp.system];
  const Ks = sys.pKa.map((p) => Math.pow(10, -p));
  const V = exp.vSample + exp.vWater + v;
  const cS = (exp.cSample * exp.vSample) / V;
  const cNa = exp.titrant === 'NaOH' ? (exp.cTitrant * v) / V : 0;
  const cCl = (exp.sampleCl * exp.cSample * exp.vSample + (exp.titrant === 'HCl' ? exp.cTitrant * v : 0)) / V;
  const f = (h) => {
    let num = 0, den = 0, prod = 1;
    for (let j = 0; j <= Ks.length; j++) {
      if (j > 0) prod *= Ks[j - 1] / h;
      den += prod;
      num += prod * (sys.z0 - j);
    }
    return h - KW / h + cNa - cCl + cS * (num / den);
  };
  // Grobsuche über ein Raster, dann Sekantenverfahren in ln h
  let best = 1, bestVal = Infinity;
  for (let p = 0; p <= 14; p += 0.05) { const val = Math.abs(f(Math.pow(10, -p))); if (val < bestVal) { bestVal = val; best = p; } }
  let x0 = Math.log(Math.pow(10, -best - 0.02)), x1 = Math.log(Math.pow(10, -best + 0.02));
  let f0 = f(Math.exp(x0)), f1 = f(Math.exp(x1));
  for (let i = 0; i < 100 && Math.abs(x1 - x0) > 1e-14; i++) {
    const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
    x0 = x1; f0 = f1; x1 = x2; f1 = f(Math.exp(x1));
  }
  return -Math.log10(Math.exp(x1));
}

test('Ladungs- und Stoffbilanz für alle vier Systeme über die ganze Kurve', () => {
  for (const id of C.EXPERIMENT_IDS) {
    const e = C.experiment(id);
    for (let v = 0; v <= 40; v += 0.25) {
      const s = C.state(e, v);
      const scale = Math.max(s.cH3O, s.cOH, s.cNa, s.cCl, s.cSys);
      assert.ok(Math.abs(C.residual(e, s)) / scale < 1e-9, `${id} V=${v}: Residuum ${C.residual(e, s)}`);
      near(s.alpha.reduce((a, b) => a + b, 0), 1, 1e-12, `${id} Σα`);
      near(s.species.reduce((a, b) => a + b, 0), s.cSys, 1e-12, `${id} Stoffbilanz`);
      near(s.cSys, (e.cSample * e.vSample) / (e.vSample + e.vWater + v), 1e-15, `${id} Verdünnung`);
      assert.ok(s.iterations < 200, 'Solver konvergiert');
    }
  }
});

test('Solver stimmt mit unabhängiger Newton/Sekanten-Referenz überein', () => {
  for (const id of C.EXPERIMENT_IDS) {
    const e = C.experiment(id);
    for (const v of [0, 1, 5, 9.99, 10, 12, 15, 18, 20, 24, 30, 40]) {
      near(C.phAt(e, v), referencePH(e, v), 1e-6, `${id} V=${v}`);
    }
  }
});

test('Geschlossene Formeln als weitere Referenzen', () => {
  // Essigsäure allein: Kubische Gleichung h³ + K h² − (K c + Kw) h − K Kw = 0 (Newton)
  const e = C.experiment('acetic');
  const c0 = (e.cSample * e.vSample) / (e.vSample + e.vWater);
  const K = Math.pow(10, -4.757);
  let h = 1e-3;
  for (let i = 0; i < 60; i++) {
    const g = h ** 3 + K * h ** 2 - (K * c0 + KW) * h - K * KW;
    const dg = 3 * h ** 2 + 2 * K * h - (K * c0 + KW);
    h -= g / dg;
  }
  near(C.phAt(e, 0), -Math.log10(h), 1e-9, 'Essigsäure Start');
  // Überschuss NaOH weit nach dem ÄP: pH ≈ 14 + lg c(OH⁻, Überschuss); Acetat trägt kaum bei
  const v = 34;
  const excess = (e.cTitrant * v - e.cSample * e.vSample) / (e.vSample + e.vWater + v);
  near(C.phAt(e, v), 14 + Math.log10(excess), 0.01, 'NaOH-Überschuss');
  // Ammoniak + HCl weit nach dem ÄP: pH ≈ −lg c(H₃O⁺, Überschuss)
  const a = C.experiment('ammonia');
  const ex2 = (a.cTitrant * 30 - a.cSample * a.vSample) / (a.vSample + a.vWater + 30);
  near(C.phAt(a, 30), -Math.log10(ex2), 0.01, 'HCl-Überschuss');
});

test('Kurven sind stetig und haben die richtige Richtung', () => {
  for (const id of C.EXPERIMENT_IDS) {
    const e = C.experiment(id);
    let prev = C.phAt(e, 0);
    let maxStep = 0;
    for (let v = 0.01; v <= 45; v += 0.01) {
      const p = C.phAt(e, v);
      const d = (p - prev) * e.direction;
      assert.ok(d > -1e-9, `${id}: Richtung falsch bei ${v.toFixed(2)} mL`);
      maxStep = Math.max(maxStep, Math.abs(p - prev));
      prev = p;
    }
    assert.ok(maxStep < 1.0, `${id}: Sprung ${maxStep} pro 0,01 mL`);
  }
});

test('Stufenstöchiometrie und Halbäquivalenzvolumina', () => {
  const p = C.experiment('phosphoric');
  assert.deepEqual(C.equivalenceVolumes(p).map((x) => +x.toFixed(6)), [10, 20, 30]);
  near(C.halfVolume(p, 1), 5, 1e-12);
  near(C.halfVolume(p, 2), 15, 1e-12);
  assert.notEqual(C.halfVolume(p, 2), C.equivalenceVolumes(p)[1] / 2, 'V(HÄP,2) ≠ V(ÄP,2)/2');
  const g = C.experiment('glycine');
  assert.deepEqual(C.equivalenceVolumes(g).map((x) => +x.toFixed(6)), [12, 24]);
  near(C.halfVolume(g, 2), 18, 1e-12);
  assert.deepEqual(C.equivalenceVolumes(C.experiment('ammonia')).map((x) => +x.toFixed(6)), [18]);
});

test('Halbäquivalenzpunkte: Näherung pH ≈ pKₛ nicht erzwungen', () => {
  const a = C.experiment('acetic');
  near(C.phAt(a, C.halfVolume(a, 1)), 4.757, 0.01, 'Essigsäure');
  const nh = C.experiment('ammonia');
  const s = C.state(nh, C.halfVolume(nh, 1));
  near(s.pH, 9.244, 0.01, 'pH ≈ pKₛ(NH₄⁺)');
  near(s.pOH, 14 - 9.244, 0.01, 'pOH ≈ pK_B(NH₃)');
  const p = C.experiment('phosphoric');
  assert.ok(C.phAt(p, 5) - 2.148 > 0.2, 'Phosphorsäure HÄP 1 weicht deutlich ab (Anfangsdissoziation)');
  near(C.phAt(p, 15), 7.199, 0.02, 'Phosphorsäure HÄP 2');
  const g = C.experiment('glycine');
  assert.ok(C.phAt(g, 6) - 2.35 > 0.1, 'Glycin HÄP 1 weicht ab');
  near(C.phAt(g, 18), 9.778, 0.02, 'Glycin HÄP 2');
});

test('Spezies und Gegenionen bei Glycin', () => {
  const g = C.experiment('glycine');
  const s0 = C.state(g, 0);
  near(s0.cCl, s0.cSys, 1e-15, 'Chlorid = Glycin (Hydrochlorid, kein Zusatz-HCl)');
  assert.ok(s0.alpha[0] > 0.6, 'Start überwiegend Kation');
  const s1 = C.state(g, 12);
  assert.ok(s1.alpha[1] > 0.99, 'am 1. ÄP überwiegend Zwitterion');
  assert.ok(Math.abs(C.meanCharge(C.SYSTEMS.glycine, s1.alpha)) < 0.01, 'Zwitterion: Gesamtladung ≈ 0');
  const s2 = C.state(g, 40);
  assert.ok(s2.alpha[2] > 0.9, 'im Überschuss Anion');
  near(s2.cCl, (g.cSample * g.vSample) / s2.vTotal, 1e-15, 'Chlorid nur verdünnt');
});

test('Phosphorsäure: drei Gleichgewichte, kein ausgeprägter dritter Sprung', () => {
  const p = C.experiment('phosphoric');
  const s = C.state(p, 20);
  assert.equal(s.alpha.length, 4);
  assert.ok(s.alpha[2] > 0.9, 'am 2. ÄP überwiegend HPO₄²⁻');
  // Steigung um V(ÄP,3) = 30 mL: flach (kein Sprung)
  const slope3 = (C.phAt(p, 30.5) - C.phAt(p, 29.5)) / 1;
  const slope1 = (C.phAt(p, 10.5) - C.phAt(p, 9.5)) / 1;
  assert.ok(slope3 < 0.25 * slope1, `dritter Sprung zu ausgeprägt: ${slope3} vs ${slope1}`);
});

test('volumeAtPH kehrt phAt um', () => {
  for (const id of C.EXPERIMENT_IDS) {
    const e = C.experiment(id);
    for (const v of [0.5, 3, 7, 11, 16, 22]) {
      const pH = C.phAt(e, v);
      near(C.volumeAtPH(e, pH), v, 1e-6, `${id} V=${v}`);
    }
  }
  assert.equal(C.volumeAtPH(C.experiment('acetic'), 1.0), null, 'unerreichbarer pH-Wert');
});

test('Stöchiometrische Formen ohne Gleichgewichtswissen', () => {
  const p = C.experiment('phosphoric');
  assert.deepEqual(C.stoichiometricForms(p, 0).main, [0]);
  assert.deepEqual(C.stoichiometricForms(p, 5).main, [0, 1]);
  assert.deepEqual(C.stoichiometricForms(p, 10).main, [1]);
  assert.deepEqual(C.stoichiometricForms(C.experiment('ammonia'), 9).main, [1, 0]);
});

test('Ungültige Eingaben werden abgewiesen', () => {
  assert.throws(() => C.state('acetic', -1), RangeError);
  assert.throws(() => C.state('acetic', NaN), RangeError);
  assert.throws(() => C.experiment('xyz'), RangeError);
});
