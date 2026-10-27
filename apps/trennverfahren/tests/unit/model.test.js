// Fachmodell: Bilanzen, Lösen/Kristallisieren, Filter, Sedimentation, Scheiden, Magnet,
// Eindampfen und das Erreichen der Trennziele über Handlungsfolgen.
const test = require('node:test');
const assert = require('node:assert/strict');
const { M, act, runUntil, pour, wait, sand } = require('./helpers.js');

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b} (±${eps})`);
function balanced(e, msg) {
  const b = e.balance();
  for (const k of Object.keys(b)) near(b[k], 0, 1e-6, `${msg || 'Bilanz'} ${k}`);
}
const crit = (e, id) => e.evaluate().criteria.find((c) => c.id === id).ok;

// ------------------------------------------------------------------ Versuch 1
function decant(waitSec, speed, stopAt) {
  const e = M.createEngine(1);
  act(e, 'stir', 'A');
  wait(e, waitSec);
  pour(e, 'A', 'B', { speed: speed || 'slow', until: (st) => st.objs.A.c.water < (stopAt || 25) });
  return e;
}

test('V1: Aufrühren erzeugt eine Suspension, in Ruhe setzt sich der Sand ab (Absetzfront sinkt)', () => {
  const e = M.createEngine(1);
  const A = e.state.objs.A;
  assert.equal(A.susp.sandC.m, 0, 'am Anfang liegt der Sand unten');
  act(e, 'stir', 'A');
  const s0 = A.susp.sandC.m + A.susp.sandF.m;
  assert.ok(s0 > 12, 'nach dem Rühren schwebt der meiste Sand: ' + s0);
  assert.equal(M.describe(A).kind, 'suspension');
  let prev = s0, prevFront = A.susp.sandF.fv;
  for (let i = 0; i < 18; i++) {
    wait(e, 5);
    const s = A.susp.sandC.m + A.susp.sandF.m;
    assert.ok(s <= prev + 1e-9, 'Schwebanteil nimmt in Ruhe nicht zu');
    assert.ok(A.susp.sandF.fv <= prevFront + 1e-9, 'Front des Feinanteils sinkt');
    prev = s; prevFront = A.susp.sandF.fv;
  }
  assert.ok(prev < 0.3, 'nach anderthalb Minuten ist fast alles abgesetzt: ' + prev);
  act(e, 'stir', 'A');
  assert.ok(A.susp.sandC.m > 10, 'erneutes Rühren wirbelt den Bodensatz wieder auf');
  balanced(e);
});

test('V1: zu frühes Abgießen gibt ein trübes Dekantat, nach dem Absetzen wird es klar', () => {
  const early = decant(2);
  const late = decant(90);
  const sEarly = sand(early.state.objs.B), sLate = sand(late.state.objs.B);
  assert.ok(sEarly > 1, 'früh: viel Sand im Dekantat ' + sEarly);
  assert.ok(sLate < 0.3, 'spät: Dekantat fast sandfrei ' + sLate);
  assert.equal(crit(early, 'clear'), false);
  assert.ok(late.evaluate().done, 'sorgfältiges Dekantieren erreicht das Trennziel (25 mL bleiben über dem Sand)');
  balanced(early); balanced(late);
});

test('V1: zügiges Gießen wirbelt mehr Sand auf als vorsichtiges', () => {
  const slow = decant(90, 'slow'), fast = decant(90, 'fast');
  assert.ok(sand(fast.state.objs.B) > sand(slow.state.objs.B) * 3, `zügig ${sand(fast.state.objs.B)} vs. vorsichtig ${sand(slow.state.objs.B)}`);
});

test('V1: Gießen bis zum Ende spült den Bodensatz mit aus', () => {
  const e = M.createEngine(1);
  act(e, 'stir', 'A'); wait(e, 90);
  pour(e, 'A', 'B');
  assert.ok(sand(e.state.objs.B) > 5, 'viel Sand landet in B');
  assert.equal(crit(e, 'sandStays'), false);
  balanced(e);
});

test('V1: ein trübes Dekantat lässt sich durch erneutes Absetzen und Abgießen korrigieren', () => {
  const e = decant(2, 'fast');
  assert.equal(crit(e, 'clear'), false);
  wait(e, 90);
  pour(e, 'B', 'C', { until: (st) => st.objs.B.c.water < 12 });
  assert.ok(sand(e.state.objs.C) <= 0.3, 'C klar');
  assert.ok(e.evaluate().done, 'Versuch nach Korrektur abgeschlossen');
  balanced(e);
});

test('V1: ohne Aufrühren ist das Trennziel nicht erreicht', () => {
  const e = M.createEngine(1);
  pour(e, 'A', 'B', { until: (st) => st.objs.A.c.water < 25 });
  assert.equal(crit(e, 'stirred'), false);
  assert.equal(e.evaluate().done, false);
});

// ------------------------------------------------------------------ Versuch 2
function filterSetup(paper) {
  const e = M.createEngine(2);
  if (paper !== false) act(e, 'insertPaper', 'F');
  act(e, 'move', 'F', 'ring');
  act(e, 'move', 'E', 'under');
  return e;
}
test('V2: Filter hält Sand zurück, Wasser läuft als klares Filtrat durch; Bilanz inkl. Feuchte im Rückstand', () => {
  const e = filterSetup();
  for (let i = 0; i < 8 && e.state.objs.A.c.water > 0.1; i++) { act(e, 'stir', 'A'); pour(e, 'A', 'F', { speed: 'fast' }); wait(e, 10); }
  wait(e, 40);
  const F = e.state.objs.F, E = e.state.objs.E;
  assert.equal(sand(E), 0, 'kein Sand im Filtrat');
  assert.ok(E.c.water > 85, 'Filtrat ' + E.c.water);
  assert.ok(F.c.water > 3 && F.c.water < 8, 'Rückstand bleibt feucht: ' + F.c.water);
  assert.ok(e.evaluate().done);
  balanced(e);
});
test('V2: Trichter läuft nicht über – das Gießen stoppt rechtzeitig, Nachgießen ist möglich', () => {
  const e = filterSetup();
  act(e, 'stir', 'A');
  pour(e, 'A', 'F', { speed: 'fast' });
  assert.ok(M.liq(e.state.objs.F.c) <= M.TYPES.funnel.cap, 'Füllung ≤ Kapazität');
  assert.ok(e.state.objs.A.c.water > 30, 'es ist noch Suspension übrig');
  assert.ok(e.state.log.some((l) => /Trichter ist (fast )?voll/.test(l.text)));
  wait(e, 15);
  const r = pour(e, 'A', 'F', { speed: 'fast' });
  assert.ok(r.ok, 'Nachgießen');
});
test('V2: ohne Filterpapier läuft der Sand mit durch; Korrektur durch erneutes Filtrieren', () => {
  const e = filterSetup(false);
  act(e, 'stir', 'A');
  pour(e, 'A', 'F', { speed: 'fast' });
  wait(e, 5);
  assert.ok(sand(e.state.objs.E) > 2, 'Sand im Erlenmeyerkolben');
  assert.equal(e.evaluate().done, false);
  // Korrektur: Papier einlegen, B unterstellen, trübes Filtrat erneut filtrieren
  while (e.state.objs.A.c.water > 0.2) { act(e, 'stir', 'A'); pour(e, 'A', 'F', { speed: 'fast' }); wait(e, 4); }
  wait(e, 5);
  act(e, 'insertPaper', 'F');
  act(e, 'move', 'E', 'pE');
  act(e, 'move', 'B', 'under');
  for (let i = 0; i < 10 && e.state.objs.E.c.water > 0.1; i++) { act(e, 'stir', 'E'); pour(e, 'E', 'F', { speed: 'fast' }); wait(e, 12); }
  wait(e, 40);
  assert.equal(sand(e.state.objs.B), 0);
  assert.ok(e.state.objs.B.c.water > 60);
  balanced(e);
});
test('V2: Filtrat tropft ohne Auffanggefäß auf den Tisch (verschüttet, nicht verschwunden)', () => {
  const e = M.createEngine(2);
  act(e, 'insertPaper', 'F'); act(e, 'move', 'F', 'ring');
  act(e, 'stir', 'A'); pour(e, 'A', 'F'); wait(e, 30);
  assert.ok(e.state.lost.spilled.water > 5);
  balanced(e);
});

// ------------------------------------------------------------------ Lösen, Filtrieren gelösten Salzes
test('Salz löst sich nur in Wasser und nur bis zur Löslichkeitsgrenze; Rühren beschleunigt', () => {
  const e = M.createEngine(5);
  const M5 = e.state.objs.M;
  wait(e, 60);
  assert.equal(M5.c.saltD, 0, 'ohne Wasser löst sich nichts');
  // wenig Wasser: Sättigung
  pour(e, 'M', 'A', { speed: 'fast' });
  e.act('setWashAmount', 5);
  act(e, 'wash', 'A');
  for (let i = 0; i < 6; i++) act(e, 'stir', 'A');
  const A = e.state.objs.A;
  near(A.c.saltD, M.csat(20) * A.c.water, 0.05, 'gesättigt');
  assert.ok(A.c.saltS > 2.5, 'ungelöstes Salz bleibt fest: ' + A.c.saltS);
  // Rühren beschleunigt
  const t = (stir) => {
    const x = M.createEngine(5);
    pour(x, 'M', 'A', { speed: 'fast' }); x.act('setWashAmount', 20); act(x, 'wash', 'A'); act(x, 'wash', 'A');
    let s = 0;
    while (x.state.objs.A.c.saltS > 0.05 && s < 300) { if (stir) act(x, 'stir', 'A'); else wait(x, 3); s += 3; }
    return s;
  };
  assert.ok(t(true) * 3 < t(false), 'mit Rühren deutlich schneller gelöst');
});

test('Filter: gelöstes Salz geht durch das Papier, ungelöstes Salz und Sand bleiben liegen; trockenes Filtrieren trennt nicht', () => {
  const e = M.createEngine(5);
  act(e, 'insertPaper', 'F');
  pour(e, 'M', 'F', { speed: 'fast' }); // trocken auf den Filter
  wait(e, 30);
  const F = e.state.objs.F, E = e.state.objs.E;
  assert.ok(F.c.saltS > 4.9 && sand(F) > 9.9, 'trocken: alles bleibt im Filter');
  assert.equal(M.isEmpty(E.c), true);
  e.act('setWashAmount', 20);
  act(e, 'wash', 'F'); act(e, 'wash', 'F'); wait(e, 60); act(e, 'wash', 'F'); wait(e, 60);
  assert.ok(E.c.saltD > 3.5, 'gelöstes Salz im Filtrat: ' + E.c.saltD);
  assert.equal(sand(E), 0);
  assert.equal(E.c.saltS, 0, 'kein festes Salz im Filtrat');
  balanced(e);
});

// ------------------------------------------------------------------ Versuch 3
test('V3: Eindampfen – Wasser verdampft, Salz bleibt und kristallisiert; kein Sieden bei kalter Lösung', () => {
  const e = M.createEngine(3);
  pour(e, 'A', 'D');
  const D = e.state.objs.D;
  wait(e, 30);
  assert.equal(D.boil, false, 'kalte Lösung siedet nicht');
  assert.equal(D.c.saltS, 0, 'klare Lösung ohne Kristalle');
  e.act('heat', 2);
  runUntil(e, (st) => st.objs.D.boil, 300);
  assert.ok(D.temp >= 99.9, 'Sieden erst bei Siedetemperatur: ' + D.temp);
  runUntil(e, (st) => st.objs.D.c.saltS > 0.5, 900);
  assert.ok(D.c.water > 1, 'Kristalle bilden sich, bevor alles Wasser weg ist');
  near(D.c.saltD / D.c.water, M.csat(D.temp), 0.02, 'Lösung dabei gesättigt');
  runUntil(e, (st) => st.objs.D.c.water < 2, 900);
  e.act('heat', 0);
  runUntil(e, (st) => st.objs.D.c.water < 0.01, 600);
  assert.equal(e.state.lost.evaporated.saltS + e.state.lost.evaporated.saltD, 0, 'Salz wird nicht gasförmig');
  assert.ok(D.c.saltS > 7.5, 'Salz zurückgewonnen: ' + D.c.saltS);
  assert.ok(e.evaluate().done);
  balanced(e);
});
test('V3: Trockenlaufen auf hoher Stufe – Salz spritzt (Verlust wird bilanziert), Warnung erscheint', () => {
  const e = M.createEngine(3);
  pour(e, 'A', 'D'); e.act('heat', 2); wait(e, 900);
  assert.ok(e.state.lost.spatter.saltS > 0, 'verspritztes Salz');
  assert.ok(e.state.warned.spatter != null && e.state.warned.dry != null);
  assert.ok(e.state.objs.D.c.saltS >= 5.6, 'trotzdem genug Salz für das Trennziel');
  balanced(e);
});

// ------------------------------------------------------------------ Versuch 4
function sepFilled() {
  const e = M.createEngine(4);
  act(e, 'move', 'S', 'sepring');
  pour(e, 'A', 'S', { speed: 'fast' });
  return e;
}
test('V4: Schütteln nur mit Stopfen; Emulsion entmischt sich in Ruhe; Wasser liegt unten und fließt zuerst', () => {
  const e = sepFilled();
  const S = e.state.objs.S;
  assert.equal(act(e, 'shake').ok, false, 'ohne Stopfen nicht schütteln');
  act(e, 'stopper', true); act(e, 'shake');
  assert.ok(S.emul > 0.9, 'Emulsion nach dem Schütteln');
  assert.equal(M.describe(S).kind, 'emulsion');
  wait(e, 10); const mid = S.emul;
  wait(e, 50);
  assert.ok(mid < 0.6 && S.emul < 0.01, 'entmischt sich mit der Zeit');
  assert.equal(M.describe(S).kind, 'layers');
  act(e, 'stopper', false); act(e, 'move', 'B', 'sepunder'); e.act('setCock', 2);
  wait(e, 2);
  const B = e.state.objs.B;
  assert.ok(B.c.water > 6 && B.c.oil < 0.1, 'zuerst fließt die untere Wasserschicht: ' + JSON.stringify(B.c));
  balanced(e);
});
test('V4: Stopfen beim Ablassen → Unterdruck stoppt den Fluss', () => {
  const e = sepFilled();
  act(e, 'stopper', true); act(e, 'move', 'B', 'sepunder'); e.act('setCock', 2);
  wait(e, 10);
  assert.ok(M.liq(e.state.objs.B.c) < 1, 'kaum etwas abgelaufen');
  assert.ok(e.state.warned.vacuum != null);
});
test('V4: sauberes Scheiden erreicht das Ziel; zu frühes Ablassen und zu spätes Schließen verunreinigen', () => {
  const run = (settle, closeAt) => {
    const e = sepFilled();
    act(e, 'stopper', true); act(e, 'shake'); wait(e, settle); act(e, 'stopper', false);
    act(e, 'move', 'B', 'sepunder'); e.act('setCock', 2);
    runUntil(e, (st) => st.objs.S.c.water < 6, 60, 0.05); e.act('setCock', 1);
    runUntil(e, (st) => st.objs.S.c.water < closeAt, 60, 0.05); e.act('setCock', 0);
    act(e, 'move', 'B', 'pB'); act(e, 'move', 'C', 'sepunder'); e.act('setCock', 2);
    runUntil(e, (st) => M.liq(st.objs.S.c) < 0.02, 120, 0.05);
    return e;
  };
  const good = run(60, 0.4);
  assert.ok(good.evaluate().done, JSON.stringify(good.evaluate().criteria));
  const early = run(1, 0.4);
  assert.ok(early.state.objs.B.c.oil > 1.5, 'zu früh: Öltröpfchen im Wasser ' + early.state.objs.B.c.oil);
  const late = run(60, -1);
  assert.ok(late.state.objs.B.c.oil > 1.5 || late.state.objs.C.c.water > 1.5 || !late.evaluate().done, 'zu spät geschlossen: Fraktion verunreinigt');
  balanced(good); balanced(early);
});
test('V4: verunreinigte Fraktion lässt sich zurückgießen und erneut scheiden', () => {
  const e = sepFilled();
  act(e, 'stopper', true); act(e, 'shake'); act(e, 'stopper', false);
  act(e, 'move', 'B', 'sepunder'); e.act('setCock', 2);
  runUntil(e, (st) => M.liq(st.objs.S.c) < 0.02, 60, 0.05);
  assert.equal(e.evaluate().done, false);
  act(e, 'move', 'B', 'pB');
  assert.equal(pour(e, 'B', 'S', { speed: 'fast' }).ok, false, 'bei offenem Hahn wird nicht nachgegossen');
  e.act('setCock', 0);
  pour(e, 'B', 'S', { speed: 'fast' });
  wait(e, 60);
  act(e, 'move', 'C', 'sepunder'); e.act('setCock', 2);
  runUntil(e, (st) => st.objs.S.c.water < 0.4, 60, 0.05); e.act('setCock', 0);
  act(e, 'move', 'C', 'pC'); act(e, 'move', 'B', 'sepunder'); e.act('setCock', 2);
  runUntil(e, (st) => M.liq(st.objs.S.c) < 0.02, 60, 0.05);
  assert.ok(e.evaluate().done, JSON.stringify(e.evaluate().criteria));
  balanced(e);
});

// ------------------------------------------------------------------ Versuch 5
test('V5: Magnet zieht nur Eisen an; abgetrennte Stoffe bleiben bei Folgehandlungen erhalten', () => {
  const e = M.createEngine(5);
  const before = Object.assign({}, e.state.objs.M.c);
  act(e, 'magnet', 'M');
  const mag = e.state.objs.mag.c;
  assert.ok(mag.iron > 3.5);
  assert.equal(sand(e.state.objs.mag) + mag.saltS + mag.saltD, 0, 'nur Eisen am Magneten');
  assert.equal(sand(e.state.objs.M), sand({ c: before }));
  assert.equal(e.state.objs.M.c.saltS, before.saltS);
  act(e, 'magnetDrop', 'U');
  act(e, 'magnet', 'U'); act(e, 'magnetDrop', 'U');
  const ironU = e.state.objs.U.c.iron;
  assert.equal(act(e, 'magnet', 'A').ok, false, 'leeres Becherglas: kein Eisen');
  // Folgehandlungen dürfen das Eisen auf dem Uhrglas nicht verändern
  pour(e, 'M', 'A', { speed: 'fast' }); e.act('setWashAmount', 20); act(e, 'wash', 'A'); act(e, 'stir', 'A'); wait(e, 30);
  assert.equal(e.state.objs.U.c.iron, ironU);
  balanced(e);
});
function standardChain() {
  const e = M.createEngine(5);
  for (let i = 0; i < 2; i++) { act(e, 'magnet', 'M'); act(e, 'magnetDrop', 'U'); }
  pour(e, 'M', 'A', { speed: 'fast' });
  e.act('setWashAmount', 20); act(e, 'wash', 'A'); act(e, 'wash', 'A');
  act(e, 'stir', 'A'); act(e, 'stir', 'A');
  act(e, 'insertPaper', 'F');
  for (let i = 0; i < 6 && e.state.objs.A.c.water > 0.1; i++) { act(e, 'stir', 'A'); pour(e, 'A', 'F', { speed: 'fast' }); wait(e, 15); }
  e.act('setWashAmount', 5); act(e, 'wash', 'F'); wait(e, 30);
  return e;
}
test('V5: naheliegende Trennkette Magnet → Extraktion → Filtration → Eindampfen erreicht alle Ziele', () => {
  const e = standardChain();
  pour(e, 'E', 'D');
  e.act('heat', 2); runUntil(e, (st) => st.objs.D.c.water < 2, 900); e.act('heat', 0); runUntil(e, (st) => st.objs.D.c.water < 0.01, 600);
  assert.ok(e.evaluate().done, JSON.stringify(e.evaluate().criteria));
  balanced(e);
});
test('V5: zu wenig Wasser – ungelöstes Salz bleibt im Filter; Nachspülen korrigiert', () => {
  const e = M.createEngine(5);
  for (let i = 0; i < 3; i++) { act(e, 'magnet', 'M'); act(e, 'magnetDrop', 'U'); }
  pour(e, 'M', 'A', { speed: 'fast' });
  e.act('setWashAmount', 5); act(e, 'wash', 'A'); act(e, 'wash', 'A'); act(e, 'stir', 'A');
  act(e, 'insertPaper', 'F');
  for (let i = 0; i < 4 && M.liq(e.state.objs.A.c) > 0.1; i++) { act(e, 'stir', 'A'); pour(e, 'A', 'F', { speed: 'fast' }); wait(e, 10); }
  pour(e, 'A', 'F', { speed: 'fast' }); wait(e, 20);
  const F = e.state.objs.F;
  assert.ok(F.c.saltS > 1, 'ungelöstes Salz im Rückstand: ' + F.c.saltS);
  assert.equal(crit(e, 'sand'), false);
  e.act('setWashAmount', 20);
  for (let i = 0; i < 3; i++) { act(e, 'wash', 'F'); wait(e, 40); }
  assert.ok(F.c.saltS < 0.05, 'nach dem Nachspülen gelöst');
  assert.ok(crit(e, 'sand'), JSON.stringify(e.evaluate().criteria));
  balanced(e);
});
test('V5: alternative Reihenfolge (lösen, filtrieren, Magnet am Rückstand, eindampfen) funktioniert', () => {
  const e = M.createEngine(5);
  pour(e, 'M', 'A', { speed: 'fast' });
  e.act('setWashAmount', 20); act(e, 'wash', 'A'); act(e, 'wash', 'A'); act(e, 'stir', 'A'); act(e, 'stir', 'A');
  act(e, 'insertPaper', 'F');
  for (let i = 0; i < 6 && e.state.objs.A.c.water > 0.1; i++) { act(e, 'stir', 'A'); pour(e, 'A', 'F', { speed: 'fast' }); wait(e, 15); }
  e.act('setWashAmount', 5); act(e, 'wash', 'F'); wait(e, 30);
  for (let i = 0; i < 4; i++) { act(e, 'magnet', 'F'); act(e, 'magnetDrop', 'U'); }
  pour(e, 'E', 'D');
  e.act('heat', 2); runUntil(e, (st) => st.objs.D.c.water < 2, 900); e.act('heat', 0); runUntil(e, (st) => st.objs.D.c.water < 0.01, 600);
  assert.ok(e.evaluate().done, JSON.stringify(e.evaluate().criteria));
  balanced(e);
});

// ------------------------------------------------------------------ Allgemein
test('Gemischarten: Lösung homogen, Suspension/Emulsion/Gemenge heterogen', () => {
  assert.equal(M.describe(M.createEngine(3).state.objs.A).hom, true);
  assert.equal(M.describe(M.createEngine(3).state.objs.A).kind, 'solution');
  assert.equal(M.describe(M.createEngine(5).state.objs.M).kind, 'gemenge');
  assert.equal(M.describe(M.createEngine(5).state.objs.M).hom, false);
});
test('Versuche sind unabhängig: Neubeginn eines Versuchs berührt die anderen nicht', () => {
  const a = M.createEngine(1), b = M.createEngine(2);
  act(a, 'stir', 'A'); pour(a, 'A', 'B');
  const fresh = M.createEngine(1);
  assert.equal(fresh.state.objs.B.c.water, 0);
  assert.equal(b.state.objs.A.c.water, 100);
});
test('Gespeicherter Zustand wird übernommen (Sitzungswiederherstellung)', () => {
  const a = decant(90);
  const copy = JSON.parse(JSON.stringify(a.state));
  const b = M.createEngine(1, copy);
  assert.equal(b.state.objs.B.c.water, a.state.objs.B.c.water);
  assert.ok(b.evaluate().done);
});
