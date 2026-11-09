// Fachliche Prüfung des chemischen Modells (Node.js, ohne Browser).
const test = require('node:test');
const assert = require('node:assert/strict');
const Chem = require('../../js/model/chemistry.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b} ± ${tol}, erhalten ${a}`);
const cfg = (sampleType, cSample = 0.1, vSample = 25, cTitrant = 0.1) => ({ sampleType, cSample, vSample, cTitrant });

test('Äquivalenzvolumen: c·V = c·V (1:1)', () => {
  near(Chem.equivalenceVolume(cfg('acid', 0.1, 25, 0.1)), 25, 1e-9);
  near(Chem.equivalenceVolume(cfg('weakBase', 0.08, 20, 0.1)), 16, 1e-9);
});

test('HCl / NaOH: pH 1 am Start, pH 7 am ÄP, pH 12,x im Überschuss', () => {
  const c = cfg('acid');
  near(Chem.phAt(c, 0), 1, 0.01, 'Start');
  near(Chem.phAt(c, 25), 7, 0.01, 'Äquivalenzpunkt');
  // 50 mL NaOH 0,1 M auf 25 mL HCl 0,1 M: c(OH⁻) = 2,5 mmol / 75 mL = 0,0333 → pH 12,52
  near(Chem.phAt(c, 50), 12.52, 0.01, 'Überschuss');
});

test('NaOH-Probe mit HCl: Kurve fällt, pH 7 am ÄP', () => {
  const c = cfg('base');
  near(Chem.phAt(c, 0), 13, 0.01);
  near(Chem.phAt(c, 25), 7, 0.01);
  assert.equal(Chem.titrationDirection('base'), -1);
});

test('Essigsäure: Start pH ≈ 2,88, Halbäquivalenz pH = pKs, ÄP basisch (Acetat)', () => {
  const c = cfg('weakAcid');
  near(Chem.phAt(c, 0), 2.88, 0.01, 'Start');
  const half = Chem.halfEquivalence(c);
  near(half.v, 12.5, 1e-9);
  near(half.pH, 4.75, 0.01, 'Halbäquivalenz');
  // ÄP: c(Acetat) = 2,5 mmol / 50 mL = 0,05 M, Kb = 10^-9,25 → pH ≈ 8,72
  near(Chem.equivalencePH(c), 8.72, 0.02, 'Äquivalenzpunkt');
});

test('Ammoniak: ÄP sauer (Ammonium), Halbäquivalenz pH = pKs(NH4+)', () => {
  const c = cfg('weakBase');
  // c(NH4+) = 0,05 M, Ks = 10^-9,25 → pH ≈ 5,28
  near(Chem.equivalencePH(c), 5.28, 0.02);
  near(Chem.halfEquivalence(c).pH, 9.25, 0.01);
  assert.equal(Chem.halfEquivalence(cfg('acid')), null, 'starke Säure hat keinen Halbäquivalenzpunkt');
});

test('Ladungsbilanz ist an jedem Punkt erfüllt', () => {
  for (const t of ['acid', 'base', 'weakAcid', 'weakBase']) {
    const c = cfg(t, 0.137, 20, 0.1);
    for (const v of [0, 5, 13.7, 27.4, 27.41, 40]) {
      const st = Chem.mixtureState(c, v);
      const r = Chem.chargeBalanceResidual(c, st);
      near(r.cations - r.anions, 0, 1e-9 * Math.max(1, r.cations), `${t} bei ${v} mL`);
    }
  }
});

test('pH-Kurve ist monoton und Verdünnung wird berücksichtigt', () => {
  const c = cfg('acid');
  let last = -1;
  for (let v = 0; v <= 50; v += 0.5) {
    const pH = Chem.phAt(c, v);
    assert.ok(pH >= last, `pH fällt bei ${v} mL`);
    last = pH;
  }
  // 10 mL NaOH zugegeben: c(H3O+) = (2,5 - 1,0) mmol / 35 mL
  near(Chem.phAt(c, 10), -Math.log10(1.5 / 35), 0.001);
});

test('Äquivalenzpunkt aus Messdaten (steilste Stelle) und Konzentrationsformel', () => {
  const c = cfg('weakAcid', 0.0825, 25, 0.1);
  const pts = Chem.theoreticalCurve(c, 40, 400);
  const eq = Chem.equivalenceFromData(pts, 1);
  near(eq.v, Chem.equivalenceVolume(c), 0.3, 'ÄP aus Daten');
  near(Chem.sampleConcentration(0.1, 20.625, 25), 0.0825, 1e-9);
});

test('ungültige Eingaben werden abgewiesen', () => {
  assert.throws(() => Chem.phAt(cfg('acid', -1), 0), RangeError);
  assert.throws(() => Chem.phAt(cfg('wasser'), 0), TypeError);
  assert.throws(() => Chem.phAt(cfg('acid'), -0.1), RangeError);
});
