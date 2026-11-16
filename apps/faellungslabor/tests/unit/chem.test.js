// Fachmodell: Referenzfälle mit unabhängigen Handrechnungen.
// Die Sollwerte stammen aus geschlossenen Näherungsformeln bzw. einfachen Iterationen, die NICHT
// den Solver aus chem.js benutzen. Toleranzen sind vor dem Vergleich festgelegt (TOL_*).
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/chem.js');

const DROP = 0.05e-3 * 0.1; // mol Ag je Tropfen (0,050 mL · 0,100 mol/L)
const TOL_BAL = 1e-6;   // Mengenbilanzen (relativ)
const TOL_REF = 0.005;  // Vergleich mit β₂-Näherung (vernachlässigt [Ag(NH₃)]⁺ und freies Ag⁺; < 0,5 %)
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const K = (h) => C.KSP[h] * C.BETA2; // Gesamtkonstante AgX + 2 NH₃ ⇌ [Ag(NH₃)₂]⁺ + X⁻

/** Unabhängige Näherung: gelöste Menge x aus x·(Xex + x) = K·(N − 2x)², per Fixpunkt-Iteration (Stoffmengen, Volumen kürzt sich). */
function refDissolved(h, Agp, Xtot, N) {
  let x = 0;
  for (let i = 0; i < 200; i++) {
    const nf = Math.max(0, N - 2 * x);
    const Xex = Xtot - Agp; // Halogenidüberschuss vor dem Auflösen
    const q = K(h) * nf * nf;
    x = (-Xex + Math.sqrt(Xex * Xex + 4 * q)) / 2;
    x = Math.min(x, Agp);
  }
  return x;
}

test('Konstanten: Quellenwerte 25 °C (pKₗ 9,74 / 12,30 / 16,08; lg β₁ 3,31, lg K₂ 3,91)', () => {
  assert.ok(rel(C.KSP.Cl, 1.82e-10) < 0.01);
  assert.ok(rel(C.KSP.Br, 5.01e-13) < 0.01);
  assert.ok(rel(C.KSP.I, 8.32e-17) < 0.01);
  assert.ok(rel(C.BETA2, 1.66e7) < 0.01);
  assert.equal(C.DROP_ML, 0.05);
  assert.equal(C.CAPACITY_ML, 20);
  // konzentrierte Ammoniaklösung: w = 25 %, ρ = 0,907 g/mL → 0,25 · 907 / 17,031 = 13,31 mol/L
  assert.ok(Math.abs(C.NH3_CONC - 13.3) < 0.05);
  assert.equal(C.NH3_DIL, 2.0);
});

test('R1: 2,00 mL NaCl + 10 Tropfen AgNO₃ – Ag⁺ limitierend, Cl⁻-Überschuss bleibt gelöst', () => {
  const e = C.equilibrium({ V: 2.5, Ag: 10 * DROP, X: 2e-4, N: 0, halide: 'Cl' });
  // Handrechnung: [Cl⁻] = 1,5e-4 mol / 2,5 mL = 0,0600 mol/L; gelöstes Ag = V·Kₗ/[Cl⁻] ≈ 7,6e-12 mol
  const xRef = 1.5e-4 / 2.5e-3;
  assert.ok(rel(e.x, xRef) < TOL_BAL);
  assert.ok(rel(e.solid, 10 * DROP - 2.5e-3 * C.KSP.Cl / xRef) < TOL_BAL);
  assert.ok(rel(e.ag * e.x, C.KSP.Cl) < 1e-9, 'Löslichkeitsprodukt erfüllt');
});

test('R2: Äquivalenz (40 Tropfen) – gelöst bleibt V·√Kₗ', () => {
  const e = C.equilibrium({ V: 4.0, Ag: 2e-4, X: 2e-4, N: 0, halide: 'Cl' });
  const ref = 2e-4 - 4e-3 * Math.sqrt(C.KSP.Cl);
  assert.ok(rel(e.solid, ref) < TOL_BAL);
});

test('R3: Silberüberschuss (60 Tropfen) – keine unbegrenzte Fällung, Halogenid fast vollständig gefällt', () => {
  const e = C.equilibrium({ V: 5.0, Ag: 3e-4, X: 2e-4, N: 0, halide: 'Cl' });
  const agFree = 1e-4 / 5e-3;
  assert.ok(rel(e.solid, 2e-4 - 5e-3 * C.KSP.Cl / agFree) < TOL_BAL);
  assert.ok(e.solid <= 2e-4, 'Fällung durch das Halogenid begrenzt');
  for (const n of [40, 60, 100, 200]) {
    const s = C.equilibrium({ V: 2 + n * 0.05, Ag: n * DROP, X: 2e-4, N: 0, halide: 'I' }).solid;
    assert.ok(s <= 2e-4 + 1e-18, 'nie mehr Feststoff als Halogenid');
  }
});

test('R4: AgCl + 0,5 mL verdünnte NH₃ – teilweise gelöst (Handrechnung β₂-Näherung)', () => {
  const N = 0.5e-3 * 2.0;
  const e = C.equilibrium({ V: 3.0, Ag: 5e-5, X: 2e-4, N, halide: 'Cl' });
  const x = refDissolved('Cl', 5e-5, 2e-4, N);
  assert.ok(rel(5e-5 - e.solid, x) < TOL_REF, `gelöst ${5e-5 - e.solid} vs. Referenz ${x}`);
  assert.ok(e.solid > 0.5 * 5e-5 && e.solid < 0.8 * 5e-5, 'sichtbarer Rest bei zu kleiner Menge');
});

test('R5: AgCl löst sich vollständig erst ab der berechneten NH₃-Menge (Schwelle aus Formel)', () => {
  // Schwelle: N = 2x + √(x·X_ges/K) mit x = 5e-5, X_ges = 2e-4
  const Nth = 2 * 5e-5 + Math.sqrt(5e-5 * 2e-4 / K('Cl'));
  assert.ok(C.equilibrium({ V: 3.5, Ag: 5e-5, X: 2e-4, N: Nth * 0.95, halide: 'Cl' }).solid > 0);
  assert.equal(C.equilibrium({ V: 3.5, Ag: 5e-5, X: 2e-4, N: Nth * 1.05, halide: 'Cl' }).solid, 0);
  assert.ok(Nth / 2.0 * 1000 < 1.1, 'mit 2 mol/L genügt etwa 1 mL');
});

test('R6/R7: AgBr – verdünnt weitgehend beständig, konzentriert weitgehend löslich (Mengenreferenz)', () => {
  const dil = C.equilibrium({ V: 5.0, Ag: 5e-5, X: 2e-4, N: 2.5e-3 * 2.0, halide: 'Br' });
  const xd = refDissolved('Br', 5e-5, 2e-4, 2.5e-3 * 2.0);
  assert.ok(rel(5e-5 - dil.solid, xd) < TOL_REF);
  assert.ok(dil.solid / 5e-5 > 0.9, 'gleiches Volumen verdünnter NH₃: > 90 % bleiben');
  const twice = C.equilibrium({ V: 7.5, Ag: 5e-5, X: 2e-4, N: 5e-3 * 2.0, halide: 'Br' });
  assert.ok(twice.solid / 5e-5 > 0.8, 'doppeltes Volumen: > 80 % bleiben');
  const conc = C.equilibrium({ V: 5.0, Ag: 5e-5, X: 2e-4, N: 2.5e-3 * C.NH3_CONC, halide: 'Br' });
  const xc = refDissolved('Br', 5e-5, 2e-4, 2.5e-3 * C.NH3_CONC);
  assert.ok(rel(5e-5 - conc.solid, xc) < TOL_REF);
  assert.ok(conc.solid / 5e-5 < 0.15, '2,5 mL konzentrierte NH₃: höchstens 15 % bleiben');
});

test('R8: AgI bleibt auch mit viel konzentrierter NH₃ sichtbar bestehen', () => {
  for (const mL of [2.5, 5, 10, 15]) {
    const e = C.equilibrium({ V: 2.5 + mL, Ag: 5e-5, X: 2e-4, N: mL * 1e-3 * C.NH3_CONC, halide: 'I' });
    assert.ok(e.solid / 5e-5 > 0.95, `AgI-Rest bei ${mL} mL: ${e.solid / 5e-5}`);
  }
  // auch ohne Iodidüberschuss (Äquivalenz) bleibt AgI weitgehend bestehen
  const eq = C.equilibrium({ V: 14, Ag: 2e-4, X: 2e-4, N: 10e-3 * C.NH3_CONC, halide: 'I' });
  assert.ok(eq.solid / 2e-4 > 0.9);
});

test('R9: RSC-Versuch (3 mL Probe, wenige Tropfen AgNO₃, NH₃ gleiches Volumen bzw. Glas fast voll)', () => {
  const Ag = 3 * DROP, X = 3e-4;
  const cl = C.equilibrium({ V: 6.15, Ag, X, N: 3e-3 * 2.0, halide: 'Cl' });
  const br = C.equilibrium({ V: 6.15, Ag, X, N: 3e-3 * 2.0, halide: 'Br' });
  const brC = C.equilibrium({ V: 18, Ag, X, N: 14.85e-3 * C.NH3_CONC, halide: 'Br' });
  const iC = C.equilibrium({ V: 18, Ag, X, N: 14.85e-3 * C.NH3_CONC, halide: 'I' });
  assert.equal(cl.solid, 0, 'AgCl löst sich im gleichen Volumen verdünnter NH₃');
  assert.ok(br.solid / Ag > 0.8, 'AgBr löst sich darin nicht');
  assert.ok(brC.solid / Ag < 0.1, 'AgBr löst sich größtenteils, wenn konzentrierte NH₃ das Glas fast füllt');
  assert.ok(iC.solid / Ag > 0.95, 'AgI löst sich nicht');
});

test('Gleichgewichtsbedingungen erfüllt; keine negativen oder unendlichen Werte (Raster)', () => {
  for (const h of ['Cl', 'Br', 'I']) {
    for (const drops of [0, 1, 5, 10, 40, 80]) {
      for (const nmL of [0, 0.05, 0.5, 2, 10]) {
        for (const c of [2.0, C.NH3_CONC]) {
          const V = 2 + drops * 0.05 + nmL;
          const t = { V, Ag: drops * DROP, X: 2e-4, N: nmL * 1e-3 * c, halide: h };
          const e = C.equilibrium(t);
          for (const k of Object.keys(e)) assert.ok(isFinite(e[k]) && e[k] >= -1e-30, `${k} = ${e[k]}`);
          assert.ok(e.solid <= Math.min(t.Ag, t.X) + 1e-18);
          if (e.solid > 0) assert.ok(rel(e.ag * e.x, C.KSP[h]) < 1e-8, 'Kₗ erfüllt bei Feststoff');
          else if (t.Ag > 0) assert.ok(e.ag * e.x <= C.KSP[h] * (1 + 1e-8), 'ungesättigt ohne Feststoff');
          // NH₃-Bilanz
          const nh3 = (e.nh3 + e.agNH3 + 2 * e.agNH3_2) * V / 1000;
          if (t.N > 0) assert.ok(rel(nh3, t.N) < 1e-8, 'NH₃-Bilanz');
          // Ag-Bilanz
          if (t.Ag > 0) assert.ok(rel(e.solid + (e.ag + e.agNH3 + e.agNH3_2) * V / 1000, t.Ag) < 1e-8, 'Ag-Bilanz');
        }
      }
    }
  }
});

test('Mehr NH₃ löst nie weniger; Wasser allein löst praktisch nichts', () => {
  let prev = Infinity;
  for (const mL of [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.5]) {
    const s = C.equilibrium({ V: 2.5 + mL, Ag: 5e-5, X: 2e-4, N: mL * 1e-3 * 2.0, halide: 'Cl' }).solid;
    assert.ok(s <= prev + 1e-18); prev = s;
  }
  const s0 = C.equilibrium({ V: 2.5, Ag: 5e-5, X: 2e-4, N: 0, halide: 'Cl' }).solid;
  const sw = C.equilibrium({ V: 12.5, Ag: 5e-5, X: 2e-4, N: 0, halide: 'Cl' }).solid;
  // Handrechnung: nach 10 mL Wasser [Cl⁻] = 1,5e-4/12,5e-3 = 0,012 mol/L → gelöst V·Kₗ/[Cl⁻] = 1,9e-10 mol (≈ 4 ppm)
  const ref = 12.5e-3 * C.KSP.Cl / 0.012 - 2.5e-3 * C.KSP.Cl / 0.06;
  assert.ok(rel(s0 - sw, ref) < 0.01, `Mehrlösung durch Wasser ${s0 - sw} vs. ${ref}`);
  assert.ok((s0 - sw) / s0 < 1e-5, 'Wasser löst praktisch nichts (< 10 ppm)');
});

test('Wassermodell: stöchiometrisch begrenzte Mischfällung, destilliertes Wasser ohne Fällung', () => {
  assert.equal(C.solidAtEquilibrium({ water: true, Ag: 5 * DROP, F: 0 }), 0);
  const F = C.WATER.tap.F * 2e-3;
  assert.equal(C.solidAtEquilibrium({ water: true, Ag: 5 * DROP, F }), F);
  assert.equal(C.solidAtEquilibrium({ water: true, Ag: 1e-7, F }), 1e-7);
  assert.ok(C.WATER.mineral.F > C.WATER.tap.F);
});
