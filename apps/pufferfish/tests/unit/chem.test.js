// Fachliche Prüfung des chemischen Modells gegen unabhängige Referenzrechnungen.
// Die Erwartungswerte stammen aus geschlossenen Formeln (quadratische Gleichungen,
// Henderson-Hasselbalch, Stöchiometrie), nicht aus dem Solver selbst.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/chem.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ${b}, erhalten ${a} (Toleranz ${tol})`);
const KW = 1e-14;
const Ka = Math.pow(10, -4.75);

test('Wasser: neutral, nach HCl und NaOH (exakte quadratische Lösung)', () => {
  near(C.pH(C.water(30)), 7, 1e-9, 'reines Wasser');
  for (const mL of [0.05, 0.25, 1, 5]) {
    const V = 30 + mL, c = 0.1 * mL / V;
    const h = (c + Math.sqrt(c * c + 4 * KW)) / 2; // h² − c·h − Kw = 0
    near(C.pH(C.add(C.water(30), 'HCl', mL)), -Math.log10(h), 1e-9, `HCl ${mL} mL`);
    near(C.pH(C.add(C.water(30), 'NaOH', mL)), 14 + Math.log10(h), 1e-9, `NaOH ${mL} mL`);
  }
  near(C.pH(C.add(C.water(30), 'HCl', 0.05)), 3.779, 0.001, 'ein Tropfen HCl in 30 mL Wasser');
});

test('Essigsäure 0,100 mol/L: Näherung für schwache Säuren (Kw vernachlässigbar)', () => {
  const c = 0.1;
  const h = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * c)) / 2;
  near(C.pH(C.acetate(30, 0.1, 0)), -Math.log10(h), 1e-6);
  near(C.pH(C.acetate(30, 0.1, 0)), 2.88, 0.01);
});

test('Natriumacetat 0,100 mol/L: pOH aus Kb = Kw/Ks', () => {
  const Kb = KW / Ka, c = 0.1;
  const oh = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * c)) / 2;
  near(C.pH(C.acetate(30, 0, 0.1)), 14 + Math.log10(oh), 0.002);
});

test('Acetatpuffer verschiedener Verhältnisse: exakte quadratische Lösung h² + (Cb+Ka)h − Ka·Ca = 0', () => {
  for (const [ca, cb] of [[0.05, 0.05], [0.1 * 10 / 11, 0.1 / 11], [0.1 / 11, 0.1 * 10 / 11], [0.005, 0.005]]) {
    const h = (-(cb + Ka) + Math.sqrt((cb + Ka) ** 2 + 4 * Ka * ca)) / 2;
    near(C.pH(C.acetate(30, ca, cb)), -Math.log10(h), 1e-4, `HA ${ca} / A⁻ ${cb}`);
  }
  near(C.pH(C.acetate(30, 0.05, 0.05)), 4.75, 0.002, '1:1 liegt bei pKs');
  near(C.pH(C.acetate(30, 0.1 / 11, 0.1 * 10 / 11)), 5.75, 0.01, 'A⁻:HA = 10:1 → pKs + 1');
  near(C.pH(C.acetate(30, 0.1 * 10 / 11, 0.1 / 11)), 3.75, 0.02, 'A⁻:HA = 1:10 → etwa pKs − 1');
});

test('Bekannter Zugabefall (Aufgabe 4): 100 mL je 0,0500 mol/L + 10,0 mL HCl 0,100 mol/L', () => {
  const c = C.add(C.acetate(100, 0.05, 0.05), 'HCl', 10);
  const f = C.formal(c);
  near(f.A, 4.0, 1e-9, 'n(A⁻) formal');
  near(f.HA, 6.0, 1e-9, 'n(HA) formal');
  near(C.hh(4.75, f.A, f.HA), 4.75 + Math.log10(4 / 6), 1e-12, 'H-H');
  near(C.pH(c), 4.574, 0.002, 'Gleichgewichtsmodell');
});

test('Phosphat: Bilanzresiduen, Massenbilanz, Anfangs-pH nahe pKs2', () => {
  const p = C.phosphate(30, 0.05, 0.05);
  const s = C.solve(p);
  near(s.pH, 7.20, 0.01, '1:1-Modelllösung');
  assert.ok(Math.abs(C.residual(p, s.h)) < 1e-12, 'Ladungsbilanz erfüllt');
  near(s.H3PO4 + s.H2PO4 + s.HPO4 + s.PO4, p.P, 1e-12, 'Massenbilanz Phosphat');
  for (const mL of [0, 1, 10, 15, 25, 40, 60]) {
    for (const r of ['HCl', 'NaOH']) {
      const c = C.add(p, r, mL), q = C.solve(c);
      const k = 1 / c.V;
      const pos = q.h + c.Na * k, neg = q.oh + c.Cl * k + (q.H2PO4 + 2 * q.HPO4 + 3 * q.PO4) * k;
      assert.ok(Math.abs(pos - neg) / (pos + neg) < 1e-9, `relative Ladungsbilanz ${r} ${mL} mL`);
      for (const sp of ['H3PO4', 'H2PO4', 'HPO4', 'PO4']) assert.ok(q[sp] >= 0, 'keine negativen Spezies');
    }
  }
});

test('Phosphat ist mehrprotonig: jenseits der zweiten Stufe wirkt die nächste', () => {
  const p = C.phosphate(30, 0.05, 0.05);
  // nach 15 mL HCl ist HPO₄²⁻ formal verbraucht; weitere Säure trifft H₂PO₄⁻ (Stufe 1)
  const f = C.formal(C.add(p, 'HCl', 22.5));
  near(f.H3PO4, 0.75, 1e-9); near(f.H2PO4, 2.25, 1e-9);
  near(C.pH(C.add(p, 'HCl', 30)), 2.15, 0.4, 'Nähe pKs1 bei halbem Umsatz der ersten Stufe');
  assert.equal(C.phosphateStep(7.2), 1);
  assert.equal(C.phosphateStep(2.5), 0);
  assert.equal(C.phosphateStep(12), 2);
});

test('Zugabekurven: Richtung, Kontinuität, Volumen, Verhalten beiderseits des Pufferbereichs', () => {
  const samples = [C.water(30), C.phosphate(30, 0.05, 0.05), C.acetate(30, 0.1, 0), C.acetate(30, 0, 0.1), C.acetate(30, 0.05, 0.05), C.acetate(30, 0.005, 0.005)];
  for (const s of samples) {
    for (const r of ['HCl', 'NaOH']) {
      let prev = C.pH(s), c = s;
      for (let i = 1; i <= 600; i++) {
        c = C.add(c, r, 0.05);
        const v = C.pH(c);
        assert.ok(Number.isFinite(v), 'pH endlich');
        if (r === 'HCl') assert.ok(v <= prev + 1e-9, 'HCl senkt den pH monoton');
        else assert.ok(v >= prev - 1e-9, 'NaOH erhöht den pH monoton');
        prev = v;
      }
      near(c.V, s.V + 30, 1e-9, 'Gesamtvolumen = Probe + Zugabe');
    }
  }
  // Pufferwirkung: im Bereich kleine Schritte, nach Verlassen größere Schritte
  const mix = C.acetate(30, 0.05, 0.05);
  const step = (mL) => C.pH(C.add(mix, 'HCl', mL)) - C.pH(C.add(mix, 'HCl', mL + 0.5));
  assert.ok(step(0) < step(10), 'Änderung nimmt mit fortschreitender Umwandlung zu');
  assert.ok(step(0) > 0.02, 'auch am Anfang ändert sich der pH (kein künstliches Plateau)');
  assert.ok(step(14.5) > 5 * step(0), 'nahe der Erschöpfung deutlich stärkere Änderung');
});

test('Verdünnung: gleiches Verhältnis, zehnfach andere Konzentration vs. bloßes Auffüllen', () => {
  const a = C.acetate(30, 0.05, 0.05), b = C.acetate(30, 0.005, 0.005), d = C.add(a, 'water', 270);
  near(C.pH(a), C.pH(b), 0.01, 'Anfangs-pH annähernd gleich');
  const dA = C.pH(a) - C.pH(C.add(a, 'HCl', 1)), dB = C.pH(b) - C.pH(C.add(b, 'HCl', 1)), dD = C.pH(d) - C.pH(C.add(d, 'HCl', 1));
  assert.ok(dB > 10 * dA, 'zehnfach verdünnt hergestellt: deutlich geringerer Widerstand');
  near(dD, dA, 0.01, 'aufgefüllte Probe: gleiche Stoffmengen → fast gleiche Änderung bei gleicher Zugabe');
});

test('Formale Bilanz und H-H: keine negativen Restmengen, kein Logarithmus von 0', () => {
  const f = C.formal(C.add(C.acetate(30, 0.05, 0.05), 'HCl', 20));
  assert.equal(f.A, 0); near(f.HA, 3, 1e-12); near(f.excessAcid, 0.5, 1e-12);
  assert.equal(C.hh(4.75, f.A, f.HA), null);
  const g = C.formal(C.add(C.acetate(30, 0.05, 0.05), 'NaOH', 20));
  assert.equal(g.HA, 0); near(g.excessBase, 0.5, 1e-12);
  const w = C.formal(C.add(C.water(30), 'HCl', 1));
  near(w.excessAcid, 0.1, 1e-12);
});

test('Grenzfälle: großer Überschuss, ungültige Eingaben', () => {
  const v = C.pH(C.add(C.water(30), 'NaOH', 300));
  assert.ok(v > 12.9 && v < 13.1, 'pH > 12,9 bei großem Laugenüberschuss, nicht geklemmt');
  assert.throws(() => C.add(C.water(30), 'HCl', -1));
  assert.throws(() => C.add(C.water(30), 'H2SO4', 1));
  assert.throws(() => C.solve({ V: 0, Na: 0, Cl: 0, Ac: 0, P: 0 }));
});

test('Reaktionsweg einer Zugabe', () => {
  const mix = C.doseAnalysis(C.acetate(30, 0.05, 0.05), 'HCl', 0.05);
  assert.equal(mix.path, 'weak'); assert.equal(mix.pair.sys, 'Ac'); assert.ok(mix.shares.weak > 0.99);
  const w = C.doseAnalysis(C.water(30), 'NaOH', 0.05);
  assert.equal(w.path, 'free');
  const n = C.doseAnalysis(C.add(C.water(30), 'HCl', 1), 'NaOH', 0.05);
  assert.equal(n.path, 'partner', 'H₃O⁺ + OH⁻ → 2 H₂O in angesäuertem Wasser');
  const p = C.doseAnalysis(C.phosphate(30, 0.05, 0.05), 'NaOH', 0.05);
  assert.equal(p.path, 'weak'); assert.deepEqual(p.pair, { sys: 'P', k: 1 });
  const ex = C.doseAnalysis(C.add(C.acetate(30, 0.05, 0.05), 'HCl', 16), 'HCl', 1);
  assert.equal(ex.path, 'free', 'nach Erschöpfung bleibt H₃O⁺ frei');
});

test('Universalindikator: schematische Farben, stetig', () => {
  assert.deepEqual(C.indicatorRGB(7), [104, 178, 66]);
  let prev = C.indicatorRGB(0);
  for (let p = 0.1; p <= 14; p += 0.1) {
    const c = C.indicatorRGB(p);
    assert.ok(c.every((x, i) => Math.abs(x - prev[i]) <= 12), 'keine Farbsprünge');
    prev = c;
  }
});
