// Auswertung: Eingaben, Rechenprüfung gegen eigene Werte, Fehlerarten, Indikatoreignung
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/model/chemistry.js');
require('../../js/model/indicators.js');
const F = require('../../js/model/format.js');
const E = require('../../js/model/evaluation.js');

const acetic = C.experiment('acetic');
const ammonia = C.experiment('ammonia');
const phos = C.experiment('phosphoric');
const gly = C.experiment('glycine');

test('Zahlen mit Dezimalkomma, Einheiten und Vorzeichen', () => {
  assert.equal(F.parseQuantity('12,5', 'mL').value, 12.5);
  assert.equal(F.parseQuantity(' 12.50 mL', 'mL').value, 12.5);
  assert.equal(F.parseQuantity('0,0125 L', 'mL').value, 12.5);
  assert.equal(F.parseQuantity('12,5cm³', 'mL').value, 12.5);
  assert.equal(F.parseQuantity('−0,05', null).value, -0.05);
  assert.equal(F.parseQuantity('+0,05', null).value, 0.05);
  assert.equal(F.parseQuantity('', 'mL').empty, true);
  assert.equal(F.parseQuantity('1,2,3', 'mL').ok, false);
  assert.equal(F.parseQuantity('4,76 mL', null).ok, false);
  assert.equal(F.parseQuantity('12 g', 'mL').ok, false);
  assert.equal(F.parseQuantity('abc', null).ok, false);
  assert.equal(F.fmt(-0.001, 2), '0,00');
  assert.equal(F.signed(0.12, 2), '+0,12');
  assert.equal(F.signed(-0.12, 2), '−0,12');
});

test('Äquivalenzvolumen: richtig und typische Fehler', () => {
  assert.equal(E.checkEquivalenceVolume(acetic, 1, '24,00').status, 'ok');
  assert.equal(E.checkEquivalenceVolume(acetic, 1, '24').status, 'ok');
  assert.equal(E.checkEquivalenceVolume(acetic, 1, '24,1').status, 'wrong');
  assert.match(E.checkEquivalenceVolume(acetic, 1, '60').message, /Wasser/);
  assert.match(E.checkEquivalenceVolume(acetic, 1, '0,024').message, /1000/);
  assert.match(E.checkEquivalenceVolume(phos, 2, '10').message, /Stufenfaktor/);
  assert.equal(E.checkEquivalenceVolume(phos, 2, '20,00').status, 'ok');
  assert.equal(E.checkEquivalenceVolume(gly, 1, '12,00').status, 'ok');
  assert.equal(E.checkEquivalenceVolume(acetic, 1, '').status, 'empty');
  assert.equal(E.checkEquivalenceVolume(acetic, 1, 'x').status, 'invalid');
});

test('Halbäquivalenzvolumen gegen die gewählte Basis', () => {
  assert.equal(E.checkHalfVolume(1, '12,10', { v1: 24.2 }).status, 'ok', 'gemessene Basis 24,2 mL');
  assert.equal(E.checkHalfVolume(1, '12,00', { v1: 24.2 }).status, 'wrong');
  assert.equal(E.checkHalfVolume(2, '15', { v1: 10, v2: 20 }).status, 'ok');
  assert.match(E.checkHalfVolume(2, '10', { v1: 10, v2: 20 }).message, /V\(ÄP,2\)\/2/);
  assert.match(E.checkHalfVolume(1, '24', { v1: 24 }).message, /Äquivalenzvolumen/);
  assert.equal(E.checkHalfVolume(2, '15', { v1: 10, v2: NaN }).status, 'nobasis');
});

test('pK aus dem eigenen pH: korrekte Rechnung mit ungenauem Messwert ist richtig', () => {
  const [tB, tS] = E.pkTasks(ammonia);
  assert.equal(tB.key, 'pKb');
  assert.equal(E.checkPK(tB, '4,70', 9.3).status, 'ok', 'pK_B = 14 − 9,30 auch wenn 9,30 ungenau gemessen');
  assert.match(E.checkPK(tB, '9,30', 9.3).message, /pOH/);
  assert.equal(E.checkPK(tS, '9,30', 9.3).status, 'ok');
  const [t1] = E.pkTasks(acetic);
  assert.equal(E.checkPK(t1, '4,81', 4.81).status, 'ok');
  assert.match(E.checkPK(t1, '9,19', 4.81).message, /pKₛ-Wert/);
  assert.equal(E.checkPK(t1, '4,8', NaN).status, 'nobasis');
  const gl = E.pkTasks(gly);
  assert.deepEqual(gl.map((t) => t.key), ['pKs1', 'pKs2'], 'Glycin: zwei pKₛ-Werte');
});

test('Gemessener pH muss protokolliert sein; Hinweise zur Durchführung', () => {
  const pts = [{ v: 0, pH: 3.04, stable: true }, { v: 12.2, pH: 4.79, stable: true, homogeneous: true }, { v: 12.5, pH: 4.83, stable: false }];
  assert.equal(E.checkMeasuredPH('4,79', [], 12).status, 'gap');
  assert.equal(E.checkMeasuredPH('4,70', pts, 12).status, 'wrong');
  const r = E.checkMeasuredPH('4,79', pts, 12);
  assert.equal(r.status, 'measured-note');
  assert.match(r.message, /12,20 mL statt/);
  assert.match(E.checkMeasuredPH('4,83', pts, 12.5).message, /bevor die Anzeige stabil/);
  assert.equal(E.checkMeasuredPH('4,79', pts, 12.2).status, 'ok');
});

test('Theoretische pH-Werte: Ansätze und Gültigkeitsgrenzen', () => {
  const tpA = E.theoryPoints(acetic);
  const start = tpA.find((p) => p.key === 'start');
  assert.equal(E.checkTheoryPH(start, '3,04').status, 'ok');
  assert.equal(E.checkTheoryPH(start, '10,96').status, 'wrong');
  const eq = tpA.find((p) => p.key === 'eq1');
  assert.ok(Math.abs(eq.main - 8.64) < 0.01, 'ÄP Essigsäure mit Verdünnung');
  assert.equal(E.checkTheoryPH(eq, '8,64').status, 'ok');
  assert.equal(E.checkTheoryPH(eq, '8,87').status, 'wrong', 'ohne Verdünnung (c = 0,12 mol/L) falsch');
  const ps = E.theoryPoints(phos).find((p) => p.key === 'start');
  assert.equal(E.checkTheoryPH(ps, '2,05').status, 'ok', 'quadratische Lösung');
  assert.equal(E.checkTheoryPH(ps, '1,92').status, 'approx', 'einfache Näherung hier ungültig');
  const amp = E.theoryPoints(gly).find((p) => p.key === 'eq1');
  assert.ok(Math.abs(amp.main - 6.065) < 1e-9, 'pI ≈ ½(pKₛ₁ + pKₛ₂)');
  const nh = E.theoryPoints(ammonia);
  assert.ok(Math.abs(nh.find((p) => p.key === 'half1').main - 9.24) < 1e-9, 'NH₃-HÄP: pH = 14 − pK_B');
  for (const id of C.EXPERIMENT_IDS) for (const p of E.theoryPoints(C.experiment(id))) assert.ok(Math.abs(p.main - p.model) < 0.4 || p.key === 'half1', `${id} ${p.key}: Näherung ${p.main} weit vom Modell ${p.model}`);
});

test('Abweichungen mit Vorzeichen, keine Prozent-pH', () => {
  assert.equal(E.checkDifference('+0,05', 4.81, 4.76).status, 'ok');
  assert.equal(E.checkDifference('0,05', 4.81, 4.76).status, 'ok');
  assert.match(E.checkDifference('−0,05', 4.81, 4.76).message, /Vorzeichen/);
  assert.match(E.checkDifference('1,05', 4.81, 4.76).message, /logarithmisch/);
  assert.equal(E.checkDifference('0', NaN, 4.76).status, 'nobasis');
  assert.equal(E.deviation(1, 0).rel, null, 'kein Teilen durch null');
  assert.ok(Math.abs(E.deviation(24.2, 24).rel - 0.8333) < 1e-3);
});

test('Indikatoreignung aus dem Volumenfehler, nicht aus dem Namen', () => {
  assert.equal(E.indicatorSuitability(acetic, 'phenolphthalein', 1).key, 'suitable');
  assert.equal(E.indicatorSuitability(acetic, 'methylOrange', 1).key, 'unsuitable');
  assert.equal(E.indicatorSuitability(acetic, 'bromothymolBlue', 1).key, 'limited');
  assert.equal(E.indicatorSuitability(ammonia, 'methylRed', 1).key, 'suitable');
  assert.equal(E.indicatorSuitability(ammonia, 'phenolphthalein', 1).key, 'unsuitable');
  assert.equal(E.indicatorSuitability(phos, 'thymolphthalein', 2).key, 'suitable');
  assert.notEqual(E.indicatorSuitability(phos, 'methylOrange', 1).key, 'unsuitable', 'Methylorange am 1. ÄP vertretbar');
  for (const id of ['methylOrange', 'methylRed', 'bromothymolBlue', 'phenolphthalein', 'thymolphthalein']) {
    assert.equal(E.indicatorSuitability(gly, id, 2).key, 'unsuitable', 'Glycin ÄP 2: kein Indikator geeignet (' + id + ')');
  }
  assert.equal(E.indicatorSuitability(gly, 'none', 2).key, 'phmetric');
});

test('Interpolation, Datenlücken, ungleichmäßige Abstände', () => {
  const pts = [{ v: 0, pH: 3 }, { v: 2, pH: 4 }, { v: 2.2, pH: 5 }, { v: 6, pH: 9 }];
  const a = E.interpolate(pts, 2.1);
  assert.equal(a.interpolated, true);
  assert.ok(Math.abs(a.pH - 4.5) < 1e-12);
  assert.equal(E.interpolate(pts, 2).interpolated, false);
  assert.equal(E.interpolate(pts, 7).outside, true);
  assert.equal(E.gapAt(pts, 4, 1).gap, true);
  assert.equal(E.gapAt(pts, 1, 2.5).gap, false);
  const d = E.derivative(pts);
  assert.ok(Math.abs(d[1].slope - 5) < 1e-9 && Math.abs(d[1].dv - 0.2) < 1e-12, 'ΔpH/ΔV mit ungleichmäßigem ΔV');
});

test('Zerlegung der pK-Abweichung summiert sich zur Gesamtabweichung', () => {
  for (const exp of [acetic, ammonia, phos, gly]) {
    for (const t of E.pkTasks(exp)) {
      const vHalf = C.halfVolume(exp, t.stage);
      const point = { v: vHalf + 0.3, pH: Math.round((C.phAt(exp, vHalf + 0.3) + 0.02) * 100) / 100, stable: false };
      const d = E.decompose(exp, t, point);
      const measured = t.from === 'pOH' ? 14 - point.pH : point.pH;
      const sum = d.volumeEffect + d.readingEffect + d.approximation + d.rounding;
      assert.ok(Math.abs(sum - (measured - d.literature)) < 1e-9, `${exp.id} ${t.key}`);
    }
  }
  const rel = E.causeRelevance([E.decompose(phos, E.pkTasks(phos)[0], { v: 5, pH: 2.48, stable: true, homogeneous: true, stirred: true })], [{ stable: true, homogeneous: true, stirred: true }]);
  assert.equal(rel.approx.relevant, true, 'Phosphorsäure HÄP 1: Näherung relevant');
  assert.equal(rel.volume.relevant, false);
  assert.equal(rel.early.relevant, false);
});

// ---------------------------------------------------------------- Regression 0.2.0 (Review 29.10.2026)

test('Befund C: ohne Zielvolumen keine Bestätigung „am Zielvolumen“', () => {
  const pts = [{ v: 12, pH: 4.76, stable: true }];
  const r = E.checkMeasuredPH('4.76', pts, NaN);
  assert.equal(r.status, 'present');
  assert.doesNotMatch(r.message, /am Zielvolumen\./);
  assert.match(r.message, /offen/);
  const ok = E.checkMeasuredPH('4.76', pts, 12);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.target.ok, true);
  const off = E.checkMeasuredPH('4,76', pts, 11.5);
  assert.equal(off.status, 'measured-note');
  assert.equal(off.target.ok, false);
  assert.ok(Math.abs(off.target.dv - 0.5) < 1e-9);
  const early = E.checkMeasuredPH('4,76', [{ v: 12, pH: 4.76, stable: false }], 12);
  assert.equal(early.target.ok, true, 'Volumen und Messstatus getrennt');
  assert.equal(early.quality.stable, false);
});

test('Befund B: Abgabe nur mit eigenem Zielvolumen und protokolliertem Messpunkt', () => {
  const none = E.evidence({ target: NaN, points: [], seriesId: null, pHRaw: '4,76' });
  assert.equal(none.ok, false);
  assert.equal(none.blocking.length, 3);
  const noPoint = E.evidence({ target: 12, targetStatus: 'ok', points: [{ v: 12, pH: 4.76, stable: true }], seriesId: 'R2', pHRaw: '4,90' });
  assert.equal(noPoint.ok, false, 'pH ohne zugehörigen Messpunkt');
  const good = E.evidence({ target: 12, targetStatus: 'ok', points: [{ v: 12, pH: 4.76, stable: true, homogeneous: true, stirred: true }], seriesId: 'R2', pHRaw: '4,76' });
  assert.equal(good.ok, true);
  assert.deepEqual(good.flags, []);
  // ungenaue, aber echte Messung: abgebbar, gekennzeichnet
  const rough = E.evidence({ target: 12, targetStatus: 'wrong', points: [{ v: 12.4, pH: 4.83, stable: false, homogeneous: false, stirred: false }], seriesId: 'R2', pHRaw: '4,83' });
  assert.equal(rough.ok, true);
  assert.equal(rough.flags.length, 5);
});

test('ÄP-Marker wird an der eigenen Kurve geprüft, nicht am Modellwert', () => {
  const C2 = require('../../js/model/chemistry.js');
  const ex = C2.experiment('acetic');
  const pts = [];
  for (let v = 0; v <= 22; v += 1) pts.push({ v: v, pH: C2.phAt(ex, v) });
  for (let v = 22.2; v <= 26.01; v += 0.2) pts.push({ v: Math.round(v * 100) / 100, pH: C2.phAt(ex, v) });
  assert.equal(E.checkEqMarker(pts, 23.9, 1).status, 'ok');
  assert.equal(E.checkEqMarker(pts, 12, 1).status, 'weak', 'flacher Pufferbereich');
  assert.equal(E.checkEqMarker(pts, 30, 1).status, 'gap', 'außerhalb der Messwerte');
  // grobe Messung: Sprung nur zwischen 2-mL-Punkten erfasst
  const coarse = [];
  for (let v = 0; v <= 28; v += 2) coarse.push({ v: v, pH: C2.phAt(ex, v) });
  assert.equal(E.checkEqMarker(coarse, 23, 1).status, 'measured-note');
  // fallende Kurve (Ammoniak) mit direction −1
  const am = C2.experiment('ammonia');
  const pa = [];
  for (let v = 0; v <= 22; v += 0.5) pa.push({ v: v, pH: C2.phAt(am, v) });
  assert.equal(E.checkEqMarker(pa, 18, -1).status, 'ok');
  // Glycin: am zweiten ÄP kein deutlicher Sprung
  const gl = C2.experiment('glycine');
  const pg = [];
  for (let v = 0; v <= 28; v += 0.5) pg.push({ v: v, pH: C2.phAt(gl, v) });
  assert.equal(E.checkEqMarker(pg, 12, 1).status, 'ok');
  assert.equal(E.checkEqMarker(pg, 24, 1).status, 'weak');
});
