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

// ============================================================ 0.2.0: Ammonium/Ammoniak, Stammlösungen, Versuch 3
// Unabhängige Referenzen: (1) geschlossene kubische Gleichung für einprotonige Systeme, gelöst mit eigener
// Bisektion in c(H₃O⁺); (2) Brent-Verfahren auf der pH-Achse mit Anteilsfunktionen aus kumulierten pKₛ-Werten
// für das dreiprotonige Phosphat. Beides ist unabhängig vom Solver in chem.js (dort Bisektion in lg c).

/** h³ + (K + m − x + C)·h² + ((m − x)·K − Kw)·h − Kw·K = 0 für C = n(NH₄⁺)+n(NH₃)/V, m = c(Na⁺), x = c(Cl⁻). */
function refAmmonium(C_, m, x) {
  const K = Math.pow(10, -9.25);
  const f = (h) => ((h + K + m - x + C_) * h + ((m - x) * K - KW)) * h - KW * K;
  let lo = 1e-15, hi = 1; // f(lo) < 0 < f(hi)
  for (let i = 0; i < 300; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) > 0) hi = mid; else lo = mid; }
  return -Math.log10(Math.sqrt(lo * hi));
}

/** Brent-Verfahren (Wurzel von g im Intervall [a, b]). */
function brent(g, a, b, tol = 1e-13) {
  let fa = g(a), fb = g(b);
  assert.ok(fa * fb < 0, 'Vorzeichenwechsel im Intervall');
  let c = a, fc = fa, d = b - a, e = d;
  for (let i = 0; i < 200; i++) {
    if (fb * fc > 0) { c = a; fc = fa; d = e = b - a; }
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + tol / 2, xm = (c - b) / 2;
    if (Math.abs(xm) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      let p, q;
      const s = fb / fa;
      if (a === c) { p = 2 * xm * s; q = 1 - s; }
      else { const qq = fa / fc, r = fb / fc; p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1)); q = (qq - 1) * (r - 1) * (s - 1); }
      if (p > 0) q = -q; p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) { e = d; d = p / q; } else { d = xm; e = d; }
    } else { d = xm; e = d; }
    a = b; fa = fb;
    b += Math.abs(d) > tol1 ? d : (xm > 0 ? tol1 : -tol1);
    fb = g(b);
  }
  return b;
}
/** Phosphat (n in mmol, V in mL; Na, Cl in mmol): pH aus Ladungsbilanz mit α-Anteilen aus kumulierten pKₛ. */
function refPhosphate(P, Na, Cl, V) {
  const pk = [2.15, 7.20, 12.35];
  const g = (pH) => {
    const h = Math.pow(10, -pH), oh = Math.pow(10, pH - 14);
    // log-Gewichte der Spezies H₃PO₄ … PO₄³⁻ (relativ zu H₃PO₄ = 0): −Σ(pH − pKᵢ)·ln10
    const lw = [0, (pH - pk[0]), (2 * pH - pk[0] - pk[1]), (3 * pH - pk[0] - pk[1] - pk[2])].map((x) => x * Math.LN10);
    const mx = Math.max(...lw), w = lw.map((x) => Math.exp(x - mx)), sw = w.reduce((a, b) => a + b, 0);
    const charge = (w[1] + 2 * w[2] + 3 * w[3]) / sw;
    return (h + Na / V - oh - Cl / V - (P / V) * charge);
  };
  return brent(g, -2, 16);
}

test('0.2.0: Drei Puffersysteme (kein Carbonat), Stammlösungen je 0,100 mol/L, 30,0 mL', () => {
  assert.deepEqual(C.SYSTEM_IDS, ['ac', 'ph', 'am']);
  assert.deepEqual(C.SYSTEM_IDS.map((i) => C.SYSTEMS[i].pKa), [4.75, 7.20, 9.25]);
  assert.ok(!JSON.stringify(C.SYSTEMS).match(/Carbonat|HCO|CO₃/));
  assert.equal(C.MIX_V, 30.0); assert.equal(C.MIX_C, 0.100);
  near(C.KA_N, Math.pow(10, -9.25), 1e-20, 'KA_N = 10^−9,25 direkt, nicht aus pK_B abgeleitet');
});

test('Ammonium/Ammoniak: Start-pH gegen die geschlossene kubische Gleichung', () => {
  for (const [a, b] of [[0.05, 0.05], [0.1, 0], [0, 0.1], [0.1 / 3, 0.2 / 3], [0.2 / 3, 0.1 / 3], [0.005, 0.005]]) {
    const c = C.ammonium(30, a, b);
    near(C.pH(c), refAmmonium(a + b, 0, a), 1e-6, `NH₄Cl ${a} / NH₃ ${b}`);
  }
  near(C.pH(C.ammonium(30, 0.05, 0.05)), 9.25, 0.003, '1:1 liegt bei pKₛ(NH₄⁺)');
  // reine Salz-/Basenlösung: pKₛ(NH₄⁺) und nicht pK_B(NH₃) wirkt im Kation
  const Kb = KW / Math.pow(10, -9.25), c = 0.1;
  const oh = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * c)) / 2;
  near(C.pH(C.ammonium(30, 0, 0.1)), 14 + Math.log10(oh), 0.002, 'NH₃ 0,100 mol/L ≈ 11,1');
  const ka = Math.pow(10, -9.25), h = (-ka + Math.sqrt(ka * ka + 4 * ka * c)) / 2;
  near(C.pH(C.ammonium(30, 0.1, 0)), -Math.log10(h), 0.002, 'NH₄Cl 0,100 mol/L ≈ 5,1');
});

test('Ammonium: Ladungsbilanz, Massenbilanz, Zugaben von HCl und NaOH gegen die Referenz', () => {
  const n0 = C.ammonium(30, 0.05, 0.05);
  for (const r of ['HCl', 'NaOH']) {
    for (const mL of [0, 0.05, 1, 5, 10, 15, 20, 30, 60]) {
      const c = C.add(n0, r, mL), q = C.solve(c), k = 1 / c.V;
      const pos = q.h + c.Na * k + q.NH4 * k, neg = q.oh + c.Cl * k;
      assert.ok(Math.abs(pos - neg) / (pos + neg) < 1e-9, `relative Ladungsbilanz ${r} ${mL} mL`);
      near(q.NH4 + q.NH3, c.N, 1e-12, 'Massenbilanz Stickstoff');
      assert.ok(q.NH4 >= 0 && q.NH3 >= 0);
      near(C.pH(c), refAmmonium(c.N / c.V, c.Na / c.V, c.Cl / c.V), 1e-6, `${r} ${mL} mL`);
    }
  }
  const f = C.formal(C.add(n0, 'HCl', 1));
  near(f.NH4, 1.5 + 0.1, 1e-12); near(f.NH3, 1.5 - 0.1, 1e-12);
  const g = C.formal(C.add(n0, 'NaOH', 20));
  near(g.NH4, 0, 1e-12); near(g.NH3, 3, 1e-12); near(g.excessBase, 0.5, 1e-12);
  const e = C.formal(C.add(n0, 'HCl', 20));
  near(e.NH3, 0, 1e-12); near(e.excessAcid, 0.5, 1e-12);
  assert.equal(C.hh(9.25, e.NH3, e.NH4), null, 'kein Logarithmus bei fehlendem Partner');
  assert.equal(C.system(n0).pKa, 9.25);
});

test('Phosphat: Solver gegen das unabhängige Brent-Verfahren mit α-Anteilen aus kumulierten pKₛ', () => {
  for (const [c1, c2] of [[0.05, 0.05], [0.1, 0], [0, 0.1], [0.0667, 0.0333], [0.0333, 0.0667]]) {
    const p = C.phosphate(30, c1, c2);
    near(C.pH(p), refPhosphate(p.P, p.Na, p.Cl, p.V), 1e-8, `NaH₂PO₄ ${c1} / Na₂HPO₄ ${c2}`);
  }
  const p = C.phosphate(30, 0.05, 0.05);
  for (const r of ['HCl', 'NaOH']) for (const mL of [1, 5, 14, 22.5, 40]) { const c = C.add(p, r, mL); near(C.pH(c), refPhosphate(c.P, c.Na, c.Cl, c.V), 1e-8, `${r} ${mL}`); }
});

test('Acetat: Solver gegen die geschlossene kubische Gleichung (Stammlösungen und Zugaben)', () => {
  const Ka = Math.pow(10, -4.75);
  const refAc = (Ca, m, x) => { // h³ + (m − x + Ka)h² − (Ka·Ca + Kw − …)… allgemeine Form für Säure HA (Gesamt Ca) mit Kation m, Anion x
    const f = (h) => (h + m - x) * h * (h + Ka) - Ca * Ka * h - KW * (h + Ka) + 0 * Ca; // Ladungsbilanz: h + m = Kw/h + x + Ca·Ka/(h + Ka)
    let lo = 1e-15, hi = 1; for (let i = 0; i < 300; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) > 0) hi = mid; else lo = mid; }
    return -Math.log10(Math.sqrt(lo * hi));
  };
  for (const [a, b] of [[0.1, 0], [0, 0.1], [0.05, 0.05], [1 / 30, 2 / 30]]) {
    const c = C.acetate(30, a, b);
    near(C.pH(c), refAc(c.Ac / c.V, c.Na / c.V, 0), 1e-6, `HAc ${a} / NaAc ${b}`);
  }
});

test('Versuch 3: Standardaufgaben pH 5,05 / 6,90 / 9,55 mit 0,100-M-Stammlösungen, 30 mL', () => {
  const cases = [['ac', 5.05], ['ph', 6.90], ['am', 9.55]];
  for (const [sys, t] of cases) {
    const S = C.SYSTEMS[sys];
    const plan = C.planMix(sys, t);
    near(plan.VAcid + plan.VBase, 30, 1e-12, 'Gesamtvolumen');
    near(plan.nBase / plan.nAcid, Math.pow(10, t - S.pKa), 1e-9, 'Verhältnis nach H-H (über Stoffmengen n = c·V)');
    const [eA, eB] = sys === 'ph' ? [20.0, 10.0] : [10.0, 20.0]; // 10 : 20 bzw. 20 : 10 mL (Verhältnis 2 bzw. 0,5)
    near(plan.VAcid, eA, 0.05); near(plan.VBase, eB, 0.05);
    const c = C.mixComp(sys, plan.VAcid, plan.VBase);
    near(c.V, 30, 1e-12);
    const model = C.pH(c);
    // unabhängige Referenz je System
    let ref;
    if (sys === 'ph') ref = refPhosphate(c.P, c.Na, c.Cl, c.V);
    else if (sys === 'am') ref = refAmmonium(c.N / c.V, c.Na / c.V, c.Cl / c.V);
    else { const Ka = Math.pow(10, -4.75); const f = (h) => (h + c.Na / c.V) * h * (h + Ka) - (c.Ac / c.V) * Ka * h - KW * (h + Ka); let lo = 1e-15, hi = 1; for (let i = 0; i < 300; i++) { const m = Math.sqrt(lo * hi); if (f(m) > 0) hi = m; else lo = m; } ref = -Math.log10(Math.sqrt(lo * hi)); }
    assert.ok(Math.abs(model - ref) <= 0.02, `${sys}: Solver ${model} vs. Referenz ${ref} (≤ 0,02)`);
    assert.ok(Math.abs(model - t) <= 0.05, `${sys}: Solver ${model} vs. Ziel-pH ${t} (≤ 0,05)`);
    const pair = C.pairAmounts(sys, c);
    near(pair.base / pair.acid, plan.ratio, 1e-9, 'formale Stoffmengen = geplantes Verhältnis');
    // falsches Verhältnis (Volumina vertauscht, Faktor 2) → deutlich anderer pH-Wert
    const swapped = C.pH(C.mixComp(sys, plan.VBase, plan.VAcid));
    assert.ok(Math.abs(swapped - model) > 0.5, `${sys}: vertauschte Volumina ergeben ${swapped}, nicht ${model}`);
    const half = C.pH(C.mixComp(sys, plan.VAcid, plan.VBase * 0.5));
    assert.ok(model - half > 0.2, 'zu wenig Base senkt den pH-Wert nachweisbar');
    const equal = C.pH(C.mixComp(sys, 15, 15));
    near(equal, S.pKa, 0.03, '1:1-Mischung liegt bei pKₛ');
  }
});

test('Versuch 3: Gleichgewicht und formale Bilanz stimmen für alle drei Systeme über den Pufferbereich überein', () => {
  for (const sys of C.SYSTEM_IDS) {
    for (let pH = C.SYSTEMS[sys].pKa - 1; pH <= C.SYSTEMS[sys].pKa + 1 + 1e-9; pH += 0.25) {
      const p = C.planMix(sys, pH), c = C.mixComp(sys, p.VAcid, p.VBase), q = C.solve(c);
      assert.ok(Math.abs(C.pH(c) - pH) < 0.06, `${sys} pH ${pH}: ${C.pH(c)}`);
      const eq = C.pairEquilibrium(sys, c), f = C.pairAmounts(sys, c);
      assert.ok(Math.abs(eq.base - f.base) / f.base < 0.03 && Math.abs(eq.acid - f.acid) / f.acid < 0.03, `${sys}: Gleichgewichtsmengen ≈ formale Mengen`);
      assert.ok(Math.abs(C.residual(c, q.h)) < 1e-12);
    }
  }
});

test('Ziel-pH prüfen: pKₛ ± 1 als Näherung, Zurückweisung ungeeigneter Systeme', () => {
  assert.equal(C.assessTarget('ac', 5.05).ok, true);
  assert.equal(C.assessTarget('ac', 5.75).code, 'edge');
  assert.equal(C.assessTarget('ac', 5.9).ok, false);
  assert.deepEqual(C.assessTarget('ac', 6.9).suggest, ['ph']);
  assert.equal(C.assessTarget('ph', 5.05).ok, false);
  assert.deepEqual(C.assessTarget('ph', 5.05).suggest, ['ac']);
  assert.deepEqual(C.suitableSystems(9.55), ['am']);
  assert.deepEqual(C.suitableSystems(5.95), [], 'Lücke zwischen den Systemen');
  assert.equal(C.assessTarget('ac', NaN).code, 'invalid');
});

test('Stammlösungen: Beiträge je mL, unbekannte Lösung wird abgewiesen', () => {
  const c = C.add(C.add(C.comp(0), 'Na2HPO4', 10), 'NaH2PO4', 20);
  near(c.P, 3.0, 1e-12); near(c.Na, 2 + 2, 1e-12); // 10 mL·0,1·2 + 20 mL·0,1·1
  const n = C.add(C.add(C.comp(0), 'NH4Cl', 10), 'NH3', 20);
  near(n.N, 3.0, 1e-12); near(n.Cl, 1.0, 1e-12); near(n.Na, 0, 1e-12);
  assert.throws(() => C.add(C.comp(0), 'NaHCO3', 5));
});
