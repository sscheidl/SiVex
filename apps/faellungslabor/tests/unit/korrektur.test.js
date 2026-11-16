// Korrekturfassung 1.1.0: identische Probe nachgeben, „− Glas“, Ausgießen, NH₃-Darstellungszeiten.
// Erwartungswerte unabhängig aus den Bedienschritten gezählt; Toleranzen vorab festgelegt.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/chem.js');
const M = require('../../js/model.js');

const TOL = 1e-6;
const DROP = 0.05e-3 * 0.1;
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const run = (L, s, dt = 1 / 60) => { for (let t = 0; t < s; t += dt) L.step(dt); };
const idle = (L, max = 60) => { let t = 0; while (L.busy() && t < max) { L.step(1 / 60); t += 1 / 60; } assert.ok(t < max, 'Handgriff endet'); };
const lab = () => { const L = M.create(); L.setWorldWidth(1200); return L; };
function to(L, key, slot) { const p = L.state.pip; if (!(p.key === key && p.tab === L.state.tab)) { L.selectBottle(key); run(L, 0.5); } L.target(slot); idle(L); }
function dropsN(L, n) { for (let i = 0; i < n; i++) { assert.ok(L.dropOnce()); idle(L); } }
const ev = (L, type) => L.drain().filter((e) => e.type === type);

// ------------------------------------------------------------------ FK06/FK07/FK08
for (const [key, h] of [['nacl', 'Cl'], ['nabr', 'Br'], ['nai', 'I']]) {
  test(`FK06/FK07 ${key}: dieselbe Probe vor Reagenzien, nach AgNO₃ und nach NH₃ erneut zugeben`, () => {
    const L = lab();
    to(L, key, 0); to(L, key, 0); // zweimal vor Reagenzien: 4 mL
    let t = L.tube(0);
    assert.ok(rel(t.V, 4) < TOL && rel(t.n.X, 4e-4) < TOL && t.ansatz === 'A1');
    to(L, 'agno3', 0); dropsN(L, 10);
    const rev0 = t.rev;
    L.drain();
    to(L, key, 0); // nach AgNO₃
    t = L.tube(0);
    assert.equal(ev(L, 'forbidden').length, 0, 'nicht abgewiesen');
    assert.ok(rel(t.V, 4 + 0.5 + 2) < TOL && rel(t.n.X, 6e-4) < TOL && rel(t.n.Na, 6e-4) < TOL && rel(t.log.sampleV, 6) < TOL, 'Volumen und Stoffmengen');
    assert.equal(t.ansatz, 'A1', 'Ansatz bleibt');
    assert.ok(t.rev > rev0, 'Revision erhöht (Beobachtungen werden als veraltet markiert)');
    // NH₃ konzentriert löst je nach Halogenid; dann erneut dieselbe Probe → Gleichgewicht neu
    to(L, 'nh3conc', 0); L.dose(1.0); idle(L); run(L, 20); L.shake(0); run(L, 20);
    const before = M.solidTotal(t);
    const pEqBefore = M.species(t).pEq;
    assert.ok(Math.abs(before - pEqBefore) < 1e-3 * 5e-5, 'im Gleichgewicht');
    to(L, key, 0);
    run(L, 10); L.shake(0); run(L, 20);
    const sp = M.species(t);
    assert.ok(rel(t.V, 4 + 0.5 + 2 + 1 + 2) < TOL && rel(t.n.X, 8e-4) < TOL, 'Bilanz nach NH₃ und erneuter Probe');
    assert.ok(Math.abs(sp.solid - sp.pEq) < 1e-3 * 5e-5, 'neues Gleichgewicht erreicht');
    assert.ok(sp.pEq >= pEqBefore - 1e-15, 'mehr Halogenid verschiebt zur Fällung (nie weniger Feststoff)');
    assert.ok(rel(sp.solid + sp.dissolvedAg, 10 * DROP) < TOL && rel(sp.solid + sp.dissolvedX, 8e-4) < TOL, 'Ag- und X-Bilanz');
    void h;
  });
}

test('FK07: Fällung nach Komplexierung – AgCl gelöst, neue NaCl-Probe fällt erneut aus', () => {
  const L = lab();
  to(L, 'nacl', 0); to(L, 'agno3', 0); dropsN(L, 10);
  to(L, 'nh3dil', 0); L.dose(1.0); idle(L); run(L, 15); L.shake(0); run(L, 15);
  assert.ok(M.solidTotal(L.tube(0)) < 1e-12, 'gelöst');
  to(L, 'nacl', 0); idle(L); run(L, 1);
  const s = M.solidTotal(L.tube(0));
  const ref = C.equilibrium({ V: L.tube(0).V, Ag: 5e-5, X: 4e-4, N: 2e-3, halide: 'Cl' }).solid;
  assert.ok(s > 0 && Math.abs(s - ref) < 1e-6 * 5e-5 + 1e-15, `erneute Fällung wie Gleichgewicht: ${s} vs ${ref}`);
});

test('FK08: andere Probe, NH₃ vor AgNO₃, volles Glas und Umfüllen bleiben abgefangen; danach weiter', () => {
  const L = lab();
  to(L, 'nacl', 0); L.drain();
  to(L, 'nh3dil', 0); assert.equal(ev(L, 'forbidden').length, 1, 'NH₃ vor AgNO₃');
  to(L, 'agno3', 0); dropsN(L, 2);
  to(L, 'nabr', 0); assert.equal(ev(L, 'forbidden').length, 1, 'andere Probe nach AgNO₃');
  L.toBottle('nacl'); assert.equal(ev(L, 'forbidden').length, 1, 'Umfüllen');
  // fast voll: 3 mL-Proben bis zur Grenze
  L.setSampleVol(3);
  for (let i = 0; i < 6; i++) to(L, 'nacl', 0);
  const t = L.tube(0);
  assert.ok(t.V <= 20 + 1e-9 && t.V > 17, 'höchstens 20 mL: ' + t.V);
  L.drain(); to(L, 'nacl', 0);
  assert.ok(L.drain().some((e) => e.type === 'full'), 'volles Glas meldet „voll“');
  assert.ok(t.V <= 20 + 1e-9);
  to(L, 'nacl', 1); assert.ok(rel(L.tube(1).V, 3) < TOL, 'danach korrekt weiter');
});

// ------------------------------------------------------------------ FK09/FK10 Darstellungszeiten, ab Ende der Zugabe
function settledAgX(L, key, slot, drops) {
  to(L, key, slot); to(L, 'agno3', slot); dropsN(L, drops); L.returnPipette(); idle(L); run(L, 60);
  const t = L.tube(slot); assert.ok(t.susp === 0 && t.sed > 0, 'abgesetzt'); return M.solidTotal(t);
}
function series(L, slot, p0, times) { const out = []; let tt = 0; for (const T of times) { run(L, T - tt); tt = T; out.push(M.solidTotal(L.tube(slot)) / p0); } return out; }

test('FK09: AgCl (10 Tr.) + 1 mL NH₃ verd. – Beginn in 1–2 s, klar in ≤ 10 s; geschwenkt ≤ 5 s (1×)', () => {
  const L = lab();
  const p0 = settledAgX(L, 'nacl', 0, 10);
  to(L, 'nh3dil', 0); L.dose(1.0); idle(L); // Messung ab Ende der Zugabe
  const s = series(L, 0, p0, [1, 2, 5, 10]);
  assert.ok(s[1] < 0.9, 'nach 2 s sichtbar weniger (Bodensatz, ohne Schwenken): ' + s[1]);
  assert.ok(s[3] < 0.01, 'nach 10 s klar: ' + s[3]);
  const L2 = lab();
  const q0 = settledAgX(L2, 'nacl', 0, 10);
  to(L2, 'nh3dil', 0); L2.dose(1.0); idle(L2); L2.shake(0);
  const g = series(L2, 0, q0, [1, 2, 5]);
  assert.ok(g[0] < 0.75 && g[2] < 0.01, 'geschwenkt: ' + g.map((v) => v.toFixed(3)));
});

test('FK09: AgBr (10 Tr.) + 2,5 mL NH₃ konz. geschwenkt – bis auf den Gleichgewichtsrest in ≤ 10 s', () => {
  const L = lab();
  const p0 = settledAgX(L, 'nabr', 0, 10);
  to(L, 'nh3conc', 0); L.dose(1.0); idle(L); L.dose(1.0); idle(L); L.dose(0.5); idle(L); L.shake(0);
  const pEq = M.species(L.tube(0)).pEq / p0;
  const s = series(L, 0, p0, [2, 10]);
  assert.ok(pEq < 0.1, 'Gleichgewichtsrest ' + pEq);
  assert.ok(s[1] - pEq < 0.01, `nach 10 s am Gleichgewicht (${s[1].toFixed(3)} vs ${pEq.toFixed(3)})`);
});

test('FK10: zu wenig NH₃ lässt Rest, AgBr/verdünnt und AgI/konz. bleiben, Wasser löst nicht', () => {
  const L = lab();
  const a = settledAgX(L, 'nacl', 0, 10);
  to(L, 'nh3dil', 0); L.dose(0.5); idle(L); L.shake(0); run(L, 30);
  const ra = M.solidTotal(L.tube(0)) / a;
  assert.ok(ra > 0.6 && ra < 0.7, 'AgCl Rest bei 0,5 mL (Referenz R4: 66 %): ' + ra);
  const b = settledAgX(L, 'nabr', 1, 10);
  to(L, 'nh3dil', 1); L.dose(1.0); idle(L); L.dose(1.0); idle(L); L.dose(0.5); idle(L); L.shake(1); run(L, 30);
  assert.ok(M.solidTotal(L.tube(1)) / b > 0.9, 'AgBr verdünnt beständig');
  const c = settledAgX(L, 'nai', 2, 10);
  to(L, 'nh3conc', 2); for (let i = 0; i < 5; i++) { L.dose(1.0); idle(L); } L.shake(2); run(L, 30);
  assert.ok(M.solidTotal(L.tube(2)) / c > 0.95, 'AgI bleibt');
  L.addTube();
  const d = settledAgX(L, 'nacl', 3, 10);
  to(L, 'water', 3); L.dose(1.0); idle(L); L.shake(3); run(L, 30);
  assert.ok(M.solidTotal(L.tube(3)) / d > 0.999, 'Wasser ist kein Ersatz');
});

test('Konstanten des Fachmodells unverändert (nur Darstellungszeiten angepasst)', () => {
  assert.ok(rel(C.KSP.Cl, Math.pow(10, -9.74)) < 1e-12 && rel(C.BETA2, Math.pow(10, 7.22)) < 1e-12);
  assert.deepEqual([M.T.kSusp, M.T.kSed, M.T.floorRate], [0.9, 0.25, 0.03]);
});

// ------------------------------------------------------------------ FK11/FK12 Ausgießen
test('FK11: Ausgießen ist zustandsgekoppelt – Volumen sinkt in der Gießphase, Archiv genau einmal, Abfall bilanziert', () => {
  const L = lab();
  to(L, 'nacl', 0); to(L, 'agno3', 0); dropsN(L, 6); L.returnPipette(); idle(L);
  to(L, 'nabr', 1); L.returnPipette(); idle(L);
  const V0 = L.tube(0).V, p0 = M.solidTotal(L.tube(0)), other = JSON.stringify(L.tube(1));
  assert.ok(L.rinse(0));
  assert.equal(L.rinse(0), false, 'Mehrfachklick');
  assert.equal(L.rinse(1), false, 'zweites Ausgießen gleichzeitig nicht');
  assert.equal(L.tab().archive.length, 1);
  run(L, 0.4); assert.ok(rel(L.tube(0).V, V0) < TOL, 'Anheben: noch voll');
  run(L, 0.9); const vMid = L.tube(0).V; assert.ok(vMid > 0 && vMid < V0, 'Gießphase: teilweise leer ' + vMid);
  idle(L);
  assert.equal(L.tube(0).V, 0); assert.equal(M.solidTotal(L.tube(0)), 0);
  const w = L.tab().waste;
  assert.ok(rel(w.V, V0) < TOL && rel(w.solid, p0) < TOL && rel(w.Ag, 6 * DROP) < TOL && rel(w.X, 2e-4) < TOL, 'Inhalt im Abfall');
  assert.equal(L.tab().archive.length, 1);
  assert.equal(JSON.stringify(L.tube(1)), other, 'anderes Glas unberührt');
});

test('FK12: Ausgießen unter Tabwechsel, Fokusverlust, Pause und Speichern – stabil, genau eine Archivierung', () => {
  for (const how of ['tab', 'cancel', 'pause', 'snapshot']) {
    const L = lab();
    to(L, 'nai', 0); to(L, 'agno3', 0); dropsN(L, 3); L.returnPipette(); idle(L);
    to(L, 'nacl', 1); L.returnPipette(); idle(L);
    L.rinse(0); run(L, 1.0);
    let R = L;
    if (how === 'tab') { L.setTab('control'); L.setTab('main'); }
    else if (how === 'cancel') L.cancelAll();
    else if (how === 'pause') { L.setSpeed(0); run(L, 5); assert.ok(L.state.pour, 'Pause hält die Handlung an'); L.setSpeed(1); idle(L); }
    else { R = M.create(JSON.parse(JSON.stringify(L.snapshot()))); }
    assert.equal(R.state.pour, null, how + ': kein offener Handgriff');
    assert.equal(R.tube(0).V, 0, how + ': leer');
    assert.equal(R.tab().archive.length, 1, how + ': genau eine Archivierung');
    assert.ok(rel(R.tab().waste.V, 2.15) < TOL, how + ': Abfall vollständig');
    assert.ok(rel(R.tube(1).V, 2) < TOL && R.tube(1).ansatz === 'A2', how + ': anderes Glas erhalten');
    assert.equal(R.busy(), false);
  }
});

// ------------------------------------------------------------------ FK03/FK04/FK05 „− Glas“
test('FK03: leeres gewähltes Glas entfernen; Nachrücken; mindestens eines bleibt', () => {
  const L = lab();
  to(L, 'nacl', 0); to(L, 'nai', 2); L.returnPipette(); idle(L);
  L.tab().sel = 1;
  assert.equal(L.removeTube(1), true);
  const tb = L.tab();
  assert.equal(tb.visible, 2);
  assert.deepEqual([tb.tubes[0].ansatz, tb.tubes[1].ansatz], ['A1', 'A2'], 'NaI-Ansatz rückt auf Platz 2, Zuordnung bleibt');
  assert.equal(tb.tubes[1].sample, 'nai');
  assert.equal(tb.sel, 1, 'neue Auswahl gültig');
  assert.equal(L.removeTube(1), 'confirm', 'gefülltes Glas braucht Bestätigung');
  L.addTube(); assert.equal(L.removeTube(2), true);
  // auf ein Glas reduzieren
  L.removeTube(0, true); idle(L);
  assert.equal(tb.visible, 1);
  assert.equal(L.removeTube(0), 'min');
  assert.equal(tb.visible, 1);
  for (let i = 0; i < 6; i++) L.addTube();
  assert.equal(tb.visible, 6);
  assert.ok(tb.tubes.slice(1).every((t) => t.V === 0), 'neue Gläser leer');
});

test('FK04: gefülltes Glas – Abbruch ändert nichts; Bestätigung gießt aus, archiviert, entfernt; Rest erhalten', () => {
  const L = lab();
  to(L, 'nacl', 0); to(L, 'nabr', 1); to(L, 'nai', 2); L.returnPipette(); idle(L);
  const before = JSON.stringify(L.snapshot());
  assert.equal(L.removeTube(1), 'confirm');
  assert.equal(JSON.stringify(L.snapshot()), before, 'ohne Bestätigung unverändert');
  assert.ok(L.removeTube(1, true));
  assert.equal(L.tab().visible, 3, 'während des Ausgießens noch im Ständer');
  idle(L);
  const tb = L.tab();
  assert.equal(tb.visible, 2);
  assert.deepEqual(tb.tubes.slice(0, 2).map((t) => [t.ansatz, t.sample]), [['A1', 'nacl'], ['A3', 'nai']]);
  assert.equal(tb.archive.length, 1); assert.equal(tb.archive[0].ansatz, 'A2');
});

test('FK05: Entfernen während aktiver Zugabe – keine Geistertropfen, keine Doppelbuchung', () => {
  const L = lab();
  to(L, 'nacl', 0); to(L, 'nacl', 1); to(L, 'nacl', 2);
  to(L, 'agno3', 1);
  L.startHold(); run(L, 1.2);
  const inAir = L.state.drops.length, booked = L.tube(1).log.agDrops;
  assert.ok(L.removeTube(1, true));
  assert.equal(L.state.drops.length, 0, 'Tropfen im Flug angekommen');
  assert.equal(L.tab().archive[0].log.agDrops, booked + inAir, 'gebucht genau im entfernten Ansatz');
  run(L, 3); idle(L);
  assert.equal(L.state.hold, null);
  const tb = L.tab();
  assert.equal(tb.visible, 2);
  assert.ok(tb.tubes.slice(0, 2).every((t) => t.log.agDrops === 0), 'keine Tropfen in andere Gläser');
  assert.ok(L.state.pip.over === null, 'Pipette nicht über einem ungültigen Glas');
  to(L, 'agno3', 1); assert.ok(L.dropOnce()); idle(L);
  assert.equal(L.tube(1).log.agDrops, 1, 'weiter bedienbar, richtiges Glas');
  assert.equal(L.tube(1).ansatz, 'A3');
});

// 1.1.1 (Review PR #56): Während ein gefülltes Glas zum Entfernen ausgegossen wird, darf in ANDERE
// Gläser dosiert werden. Rücken die Gläser danach auf, dürfen Tropfen im Flug nicht im Nachbarglas landen.
const until = (L, cond, max = 10) => { let t = 0; while (!cond() && t < max) { L.step(1 / 60); t += 1 / 60; } assert.ok(t < max, 'Bedingung erreicht'); };
test('FK05b: Dosieren in ein anderes Glas während „− Glas“ – Tropfen bleiben in ihrem Ansatz, Pipette rückt mit', () => {
  const L = lab();
  to(L, 'nacl', 0); to(L, 'nabr', 1); to(L, 'nai', 2);
  to(L, 'agno3', 1); L.returnPipette(); idle(L); // A2 hat AgNO₃ – weitere Tropfen sind erlaubt
  const a2 = L.tube(1).log.agDrops;
  L.drain();
  assert.ok(L.removeTube(0, true));
  L.selectBottle('agno3'); run(L, 0.5); L.target(1);
  until(L, () => L.state.pip.phase === 'over');
  assert.ok(L.state.pour, 'Ausgießen läuft noch');
  assert.ok(L.startHold());
  until(L, () => !L.state.pour); // Gläser rücken auf, während der Halte-Strahl läuft
  assert.equal(L.tab().visible, 2);
  assert.equal(L.state.pip.over, 0, 'Pipette folgt dem aufgerückten Glas A2');
  run(L, 0.5); L.stopHold(); idle(L);
  const released = L.drain().filter((e) => e.type === 'land' && e.key === 'agno3').length;
  const tb = L.tab();
  assert.deepEqual(tb.tubes.slice(0, 2).map((t) => t.ansatz), ['A2', 'A3']);
  assert.ok(released > 0, 'es wurde während des Ausgießens dosiert');
  assert.equal(tb.tubes[0].log.agDrops, a2 + released, 'alle Tropfen in A2 (NaBr)');
  assert.equal(tb.tubes[1].log.agDrops, 0, 'keine Tropfen im Nachbarglas A3 (NaI)');
  assert.equal(tb.archive[0].log.agDrops, 0, 'keine Tropfen im entfernten Ansatz A1');
  const pos = L.overPos(0, 'main');
  assert.ok(Math.abs(L.state.pip.x - pos.x) < 1e-9, 'Pipette steht über A2');
});

test('FK05b: Pipette unterwegs zu einem nachrückenden Glas, während „− Glas“ endet – sie kommt über dem richtigen Glas an', () => {
  const L = lab();
  to(L, 'nacl', 0); to(L, 'nabr', 1); to(L, 'nai', 2);
  to(L, 'agno3', 2); dropsN(L, 1); L.returnPipette(); idle(L); // A3: 1 Tropfen
  assert.ok(L.removeTube(0, true));
  L.selectBottle('agno3');
  until(L, () => L.state.pour && L.state.pour.t > L.state.pour.dur - 0.15);
  L.target(2); // Bewegung dauert länger als der Rest des Ausgießens
  assert.equal(L.state.pip.phase, 'move');
  idle(L);
  assert.equal(L.state.pip.over, 1, 'Ziel = aufgerücktes Glas A3');
  assert.ok(Math.abs(L.state.pip.x - L.overPos(1, 'main').x) < 1e-9, 'steht über A3, nicht über dem alten Platz');
  L.drain(); assert.ok(L.dropOnce()); idle(L);
  assert.deepEqual(L.tab().tubes.slice(0, 2).map((t) => [t.ansatz, t.log.agDrops]), [['A2', 0], ['A3', 2]]);
});

test('FK03/FK16: Entfernen und Hinzufügen in beiden Reitern, Wiederherstellung nach Neuladen', () => {
  const L = lab();
  to(L, 'nacl', 0); L.returnPipette(); idle(L);
  L.removeTube(2); L.removeTube(1);
  L.setTab('control');
  L.removeTube(3); L.removeTube(0);
  assert.equal(L.tab('control').visible, 2);
  const R = M.create(JSON.parse(JSON.stringify(L.snapshot())));
  assert.equal(R.tab('main').visible, 1);
  assert.equal(R.tab('control').visible, 2);
  assert.equal(R.tube(0, 'main').ansatz, 'A1');
  R.setTab('main'); R.addTube(); assert.equal(R.tab('main').visible, 2);
});
