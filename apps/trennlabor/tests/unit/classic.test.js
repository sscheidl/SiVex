'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classic, tasks, run, expectOk, K, sandSaltPath } = require('./helpers.js');

const T = tasks.ALL;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} erwartet ${b}, erhalten ${a}`);

function balance(e) {
  const t = e.totals();
  const i = e.state.initial;
  near(t.sand, i.sand, 1e-6, 'Sand');
  near(t.iron, i.iron, 1e-6, 'Eisen');
  near(t.salt, i.salt, 1e-6, 'Kochsalz');
  near(t.water, i.water + e.state.added.water, 1e-6, 'Wasser');
  near(t.oil, i.oil, 1e-6, 'Öl');
  near(t.petals, i.petals, 1e-6, 'Blüten');
  near(t.dye, i.dye, 1e-6, 'Farbstoff');
}

// ------------------------------------------------------------- K-01
test('K-01: Sedimentieren und vorsichtiges Dekantieren ergibt klares Wasser', () => {
  const e = K('K-01');
  e.advance(20);
  assert.ok(e.describe(e.vessel('A').c).suspended > 0.05, 'nach 20 s noch trüb');
  e.advance(80);
  assert.ok(e.describe(e.vessel('A').c).suspended < 0.04, 'Sand hat sich abgesetzt');
  expectOk(run(e, 'pour', 'A', 'B', 'careful'));
  e.advance(5);
  const B = e.vessel('B').c;
  assert.ok(B.water >= 90, 'fast alles Wasser abgegossen');
  assert.ok(B.sand < 0.1, 'kaum Sand mitgekommen');
  const r = T['K-01'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  balance(e);
});

test('K-01: zu schnelles Dekantieren wirbelt Sediment auf → trüb; Absetzen und erneutes Dekantieren korrigiert', () => {
  const e = K('K-01');
  e.advance(100);
  run(e, 'pour', 'A', 'B', 'fast');
  const B = e.vessel('B').c;
  assert.ok(B.sand > 1, 'Sand mitgerissen: ' + B.sand);
  let r = T['K-01'].evaluate(e);
  assert.equal(r.success, false);
  assert.ok(['turbid', 'sandInWater'].includes(r.problems[0].code));
  // Korrektur: absetzen lassen, vorsichtig in C abgießen
  e.advance(100);
  run(e, 'pour', 'B', 'C', 'careful');
  e.advance(5);
  r = T['K-01'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  balance(e);
});

test('K-01: sofort ohne Absetzen abgießen → trübe Flüssigkeit, kein Erfolg', () => {
  const e = K('K-01');
  run(e, 'pour', 'A', 'B', 'careful');
  assert.ok(e.vessel('B').c.sand > 3, 'aufgewirbelter Sand geht mit');
  assert.equal(T['K-01'].evaluate(e).success, false);
});

test('K-01: Filtrieren mit gefaltetem Papier ergibt klares Filtrat; ohne Papier läuft Sand durch', () => {
  const e = K('K-01');
  run(e, 'setPaper', 'folded');
  run(e, 'move', 'E', 'filter');
  run(e, 'pour', 'A', 'F', 'all');
  e.advance(150);
  assert.ok(e.vessel('E').c.sand < 1e-6, 'kein Sand im Filtrat');
  assert.ok(e.vessel('E').c.water > 70);
  assert.ok(T['K-01'].evaluate(e).success);
  balance(e);

  const n = K('K-01');
  run(n, 'move', 'E', 'filter');
  run(n, 'pour', 'A', 'F', 'all');
  n.advance(60);
  assert.ok(n.vessel('E').c.sand > 8, 'ohne Filterpapier läuft der Sand durch');
  assert.equal(T['K-01'].evaluate(n).success, false);
});

test('K-01: ungefaltetes Papier lässt Trübung durch', () => {
  const e = K('K-01');
  run(e, 'setPaper', 'flat');
  run(e, 'move', 'E', 'filter');
  run(e, 'pour', 'A', 'F', 'all');
  e.advance(120);
  assert.ok(e.vessel('E').c.sand > 0.3, 'Sand im Filtrat: ' + e.vessel('E').c.sand);
});

test('K-01: Filtrieren ohne Auffanggefäß – Filtrat tropft auf den Tisch (Verlust)', () => {
  const e = K('K-01');
  run(e, 'setPaper', 'folded');
  run(e, 'pour', 'A', 'F', 'all');
  e.advance(150);
  assert.ok(e.state.lost.spilled.water > 80);
  assert.ok(e.state.log.some((m) => m.code === 'noReceiver'));
  balance(e);
});

test('K-01: Rühren im Trichter reißt das Filterpapier', () => {
  const e = K('K-01');
  run(e, 'setPaper', 'folded');
  run(e, 'pour', 'A', 'F', 'careful');
  const r = run(e, 'stir', 'F');
  assert.equal(r.ok, false);
  assert.equal(e.state.funnel.paper, 'torn');
});

// ------------------------------------------------------------- K-02
test('K-02: Lösen, Filtrieren und Eindampfen liefern Sand und festes Kochsalz', () => {
  const e = K('K-02');
  sandSaltPath(e);
  const D = e.vessel('D').c;
  assert.equal(D.water, 0);
  assert.ok(D.saltS >= 3.5, 'Salzkristalle: ' + D.saltS);
  assert.ok(D.sand === 0);
  const r = T['K-02'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  assert.ok(r.snapshot.saltMass >= 3.5);
  balance(e);
});

test('K-02: Trockenes Gemisch direkt in den Filter → keine Trennung, Salz bleibt im Rückstand', () => {
  const e = K('K-02');
  run(e, 'setPaper', 'folded');
  run(e, 'move', 'E', 'filter');
  run(e, 'pour', 'M', 'F', 'all');
  e.advance(60);
  assert.equal(e.vessel('E').c.saltD + e.vessel('E').c.saltS, 0, 'nichts im Filtrat');
  assert.ok(e.state.funnel.c.saltS > 4.9, 'Salz bleibt im Filter');
  const r = T['K-02'].evaluate(e);
  assert.equal(r.success, false);
  assert.equal(r.problems[0].code, 'dryFilter');
  assert.ok(e.state.log.some((m) => m.code === 'dryFilter'));
});

test('K-02: Gelöstes Salz läuft durch den Filter – im Rückstand ist kein festes Salz', () => {
  const e = K('K-02');
  run(e, 'pour', 'M', 'A', 'all');
  run(e, 'addWater', 'A', 50);
  run(e, 'stir', 'A');
  e.advance(15);
  run(e, 'setPaper', 'folded');
  run(e, 'move', 'E', 'filter');
  run(e, 'pour', 'A', 'F', 'all');
  e.advance(120);
  assert.ok(e.state.funnel.c.saltS < 0.05, 'kaum festes Salz im Rückstand');
  assert.ok(e.vessel('E').c.saltD > 4, 'Salz gelöst im Filtrat');
  assert.equal(e.vessel('E').c.saltS, 0, 'Filtrieren erzeugt kein festes Salz');
  assert.equal(T['K-02'].evaluate(e).success, false, 'ohne Eindampfen kein Erfolg');
});

test('K-02: Filtrat weggeschüttet → kein Salz aus dem Nichts', () => {
  const e = K('K-02');
  run(e, 'pour', 'M', 'A', 'all');
  run(e, 'addWater', 'A', 50);
  run(e, 'stir', 'A');
  e.advance(15);
  run(e, 'setPaper', 'folded');
  run(e, 'move', 'E', 'filter');
  run(e, 'pour', 'A', 'F', 'all');
  e.advance(120);
  run(e, 'move', 'E', 'bench');
  run(e, 'pour', 'E', 'waste', 'careful');
  assert.ok(e.state.log.some((m) => m.code === 'saltWasted'));
  run(e, 'move', 'D', 'heater');
  run(e, 'setHeater', 2);
  e.advance(300);
  assert.equal(e.vessel('D').c.saltS, 0, 'leere Schale → kein Salz');
  const r = T['K-02'].evaluate(e);
  assert.equal(r.success, false);
  assert.ok(r.problems.some((p) => p.code === 'saltWasted'));
  const h = T['K-02'].help(e);
  assert.match(h.concrete, /verloren/);
  balance(e);
});

test('K-02: Eindampfen der Suspension → Rückstand enthält Sand, keine reine Salzfraktion', () => {
  const e = K('K-02');
  run(e, 'pour', 'M', 'A', 'all');
  run(e, 'addWater', 'A', 40);
  run(e, 'stir', 'A');
  e.advance(15);
  run(e, 'pour', 'A', 'D', 'all');
  run(e, 'move', 'D', 'heater');
  run(e, 'setHeater', 2);
  e.advance(500);
  run(e, 'setHeater', 1);
  e.advance(600);
  const D = e.vessel('D').c;
  assert.equal(D.water, 0);
  assert.ok(D.sand > 9 && D.saltS > 4);
  const r = T['K-02'].evaluate(e);
  assert.equal(r.success, false);
  assert.equal(r.problems[0].code, 'sandInSalt');
});

test('K-02: Abdampfen ohne Salzlösung (nur Wasser) liefert kein Salz', () => {
  const e = K('K-02');
  run(e, 'addWater', 'D', 25);
  run(e, 'move', 'D', 'heater');
  run(e, 'setHeater', 2);
  e.advance(400);
  assert.equal(e.vessel('D').c.water, 0);
  assert.equal(e.vessel('D').c.saltS, 0);
});

test('K-02: Hohe Heizstufe am Ende lässt Salz verspritzen (bilanzierter Verlust)', () => {
  const e = K('K-02');
  run(e, 'pour', 'M', 'A', 'all');
  run(e, 'addWater', 'A', 50);
  run(e, 'stir', 'A');
  e.advance(15);
  run(e, 'setPaper', 'folded');
  run(e, 'move', 'E', 'filter');
  run(e, 'pour', 'A', 'F', 'all');
  e.advance(120);
  run(e, 'move', 'E', 'bench');
  run(e, 'pour', 'E', 'D', 'careful');
  run(e, 'move', 'D', 'heater');
  run(e, 'setHeater', 2);
  e.advance(700);
  assert.ok(e.state.lost.spatter.saltS > 0.05, 'verspritzt: ' + e.state.lost.spatter.saltS);
  assert.ok(e.state.log.some((m) => m.code === 'spatter'));
  balance(e);
});

test('K-02: Sicherheitsstopp – Becherglas mit Öl auf eingeschalteter Heizplatte (K-04 hat keine Heizplatte, daher nur Regel geprüft)', () => {
  // In K-02 gibt es kein Öl – der Stopp ist in K-04 nicht erreichbar, weil dort keine Heizplatte steht.
  const e = K('K-02');
  e.vessel('A').c.oil = 20; // künstlicher Fall für die Sicherheitsregel
  run(e, 'move', 'A', 'heater');
  run(e, 'setHeater', 2);
  assert.ok(e.state.safety, 'Sicherheitsstopp');
  assert.equal(e.state.heater.level, 0);
  assert.equal(run(e, 'resume').ok, false, 'erst Ursache beseitigen');
  run(e, 'move', 'A', 'bench');
  assert.equal(run(e, 'resume').ok, true);
});

// ------------------------------------------------------------- K-03
test('K-03: Magnet zuerst, dann Lösen/Filtrieren/Eindampfen → drei Fraktionen', () => {
  const e = K('K-03');
  sandSaltPath(e, { magnetFirst: true });
  const r = T['K-03'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  assert.ok(r.snapshot.iron >= 4.5);
  balance(e);
});

test('K-03: Magnet erfasst nur Eisen', () => {
  const e = K('K-03');
  run(e, 'useMagnet', 'M');
  const M = e.vessel('M').c;
  assert.equal(M.sand, 10);
  assert.equal(M.saltS, 5);
  assert.ok(e.state.magnet.iron > 4 && e.state.magnet.iron < 5);
  run(e, 'useMagnet', 'A');
  assert.ok(e.state.log.some((m) => m.code === 'magnetMiss'));
  balance(e);
});

test('K-03: ohne Magnet landet Eisen im Sand → Sandfraktion verunreinigt; Magnet am Filterrückstand repariert', () => {
  const e = K('K-03');
  sandSaltPath(e, { magnetFirst: false });
  let r = T['K-03'].evaluate(e);
  assert.equal(r.success, false);
  assert.ok(r.problems.some((p) => p.code === 'noIron' || p.code === 'ironInSand'));
  // Korrektur: Eisen aus dem nassen Filterrückstand holen
  for (let i = 0; i < 4; i++) run(e, 'useMagnet', 'F');
  run(e, 'releaseMagnet', 'U');
  r = T['K-03'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  balance(e);
});

// ------------------------------------------------------------- K-04
function k04Separate(e, { closeEarly = 0 } = {}) {
  run(e, 'pour', 'A', 'S', 'all');
  e.advance(150); // absetzen
  run(e, 'move', 'B', 'sep');
  run(e, 'setCock', 1);
  // bis kurz vor der Grenzschicht
  let g = 0;
  while (e.state.sep.c.water - e.state.sep.c.emW > 4 + closeEarly && g++ < 2000) e.advance(0.05);
  run(e, 'setCock', 0.25);
  g = 0;
  while (e.state.sep.c.water > 0.3 + closeEarly && g++ < 4000) e.advance(0.05);
  run(e, 'setCock', 0);
  run(e, 'move', 'B', 'bench');
  run(e, 'move', 'C', 'sep');
  run(e, 'setCock', 1);
  e.advance(60);
  run(e, 'setCock', 0);
}

test('K-04: Scheidetrichter trennt beide Phasen (Wasser unten zuerst)', () => {
  const e = K('K-04');
  k04Separate(e);
  const B = e.vessel('B').c, C = e.vessel('C').c;
  assert.ok(B.water > 45 && B.oil < 1, `Wasserfraktion ${B.water}/${B.oil}`);
  assert.ok(C.oil > 45 && C.water < 1, `Ölfraktion ${C.oil}/${C.water}`);
  const r = T['K-04'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  balance(e);
});

test('K-04: Hahn zu lange offen → Mischfraktion; zurückgießen und neu trennen ist möglich', () => {
  const e = K('K-04');
  run(e, 'pour', 'A', 'S', 'all');
  e.advance(150);
  run(e, 'move', 'B', 'sep');
  run(e, 'setCock', 1);
  e.advance(30); // viel zu lange
  run(e, 'setCock', 0);
  const B = e.vessel('B').c;
  assert.ok(B.oil > 5, 'Öl in der Wasserfraktion: ' + B.oil);
  let r = T['K-04'].evaluate(e);
  assert.equal(r.success, false);
  assert.ok(r.problems.some((p) => p.code === 'mixed'));
  // Korrektur
  run(e, 'move', 'B', 'bench');
  run(e, 'pour', 'B', 'S', 'all');
  run(e, 'move', 'E', 'sep');
  e.advance(150);
  run(e, 'setCock', 1);
  let g = 0;
  while (e.state.sep.c.water > 0.3 && g++ < 4000) e.advance(0.05);
  run(e, 'setCock', 0);
  run(e, 'move', 'E', 'bench');
  run(e, 'move', 'C', 'sep');
  run(e, 'setCock', 1);
  e.advance(60);
  r = T['K-04'].evaluate(e);
  assert.ok(r.success, JSON.stringify(r.problems));
  balance(e);
});

test('K-04: offener Hahn ohne Gefäß → Probe geht verloren', () => {
  const e = K('K-04');
  run(e, 'setCock', 1);
  run(e, 'pour', 'A', 'S', 'all');
  e.advance(30);
  assert.ok(e.state.lost.spilled.water > 20);
  assert.ok(e.state.log.some((m) => m.code === 'sepNoReceiver' || m.code === 'sepOpenNoReceiver'));
  balance(e);
});

test('K-04: Ablassen vor der Phasentrennung liefert eine Mischfraktion', () => {
  const e = K('K-04');
  run(e, 'pour', 'A', 'S', 'all');
  run(e, 'move', 'B', 'sep');
  run(e, 'setCock', 1); // sofort, Emulsion noch nicht getrennt
  e.advance(19); // ungefähr die Wassermenge abgelassen
  run(e, 'setCock', 0);
  const B = e.vessel('B').c;
  assert.ok(B.oil > 3, 'Emulsion mit abgelassen: ' + B.oil);
  assert.ok(e.state.sep.c.water > 3, 'Wasser bleibt im Trichter zurück: ' + e.state.sep.c.water);
  // Vergleich: nach ruhigem Absetzen enthält dieselbe Menge kaum Öl
  const f = K('K-04');
  run(f, 'pour', 'A', 'S', 'all');
  f.advance(150);
  run(f, 'move', 'B', 'sep');
  run(f, 'setCock', 1);
  f.advance(19);
  run(f, 'setCock', 0);
  assert.ok(f.vessel('B').c.oil < B.oil / 2, 'Absetzen verbessert die Trennung');
});

test('K-04: Filtrieren trennt Öl und Wasser nicht', () => {
  const e = K('K-04');
  run(e, 'setPaper', 'folded');
  run(e, 'move', 'B', 'filter');
  run(e, 'pour', 'A', 'F', 'all');
  e.advance(200);
  const B = e.vessel('B').c;
  assert.ok(B.oil > 30 && B.water > 30);
});

// ------------------------------------------------------------- K-05
function hibiscus(e, { hot, seconds, stir = true }) {
  run(e, 'pour', 'P', 'A', 'all');
  run(e, 'addWater', 'A', 50, hot);
  run(e, 'addWater', 'A', 50, hot);
  if (stir) run(e, 'stir', 'A');
  e.advance(seconds);
  return e.describe(e.vessel('A').c).dyeConc;
}

test('K-05: Heißes Wasser extrahiert schneller als kaltes; Ergebnis bleibt Stoffgemisch', () => {
  const hot = K('K-05'), cold = K('K-05');
  const cHot = hibiscus(hot, { hot: true, seconds: 120 });
  const cCold = hibiscus(cold, { hot: false, seconds: 120 });
  assert.ok(cHot > 2 * cCold, `heiß ${cHot} vs. kalt ${cCold}`);
  // kalte Extraktion erreicht mit genügend Zeit ebenfalls einen kräftigen Auszug
  cold.advance(900);
  assert.ok(cold.describe(cold.vessel('A').c).dyeConc > 0.11);
  run(hot, 'placeSieve', 'B');
  run(hot, 'pour', 'A', 'T', 'careful');
  hot.advance(5);
  run(hot, 'pour', 'A', 'T', 'all');
  hot.advance(10);
  const B = hot.vessel('B').c;
  assert.equal(B.petals, 0, 'Sieb hält Blüten zurück');
  assert.ok(B.dye > 0, 'gelöste Farbstoffe gehen durch das Sieb');
  const r = tasks.ALL['K-05'].evaluate(hot);
  assert.ok(r.success, JSON.stringify(r.problems));
  const q = tasks.ALL['K-05'].questions(r.snapshot).find((x) => x.id === 'q3');
  assert.equal(q.correct, 'mix', 'Tee ist Stoffgemisch');
  balance(hot);
});

test('K-05: Blüten im Tee oder zu kurze Extraktion → kein Erfolg', () => {
  const e = K('K-05');
  hibiscus(e, { hot: false, seconds: 20, stir: false });
  let r = tasks.ALL['K-05'].evaluate(e);
  assert.equal(r.success, false);
  assert.ok(['weakExtract', 'petalsInTea'].includes(r.problems[0].code));
  const e2 = K('K-05');
  hibiscus(e2, { hot: true, seconds: 200 });
  run(e2, 'pour', 'A', 'B', 'fast'); // ohne Sieb: Blüten gehen mit
  r = tasks.ALL['K-05'].evaluate(e2);
  assert.equal(r.success, false);
});

// ------------------------------------------------------------- allgemein
test('Zeitraffer verändert nur die Geschwindigkeit: gleiche Modellzeit → gleicher Zustand', () => {
  const a = K('K-02'), b = K('K-02');
  for (const e of [a, b]) { e.act('pour', 'M', 'A', 'all'); }
  // a: viele kleine Schritte (1×), b: wenige große (50×)
  for (let i = 0; i < 400; i++) a.advance(0.016);
  for (let i = 0; i < 8; i++) b.advance(0.8);
  a.advance(6.4 - 400 * 0.016 + 1e-9);
  a.act('addWater', 'A', 50); b.act('addWater', 'A', 50);
  for (let i = 0; i < 3000; i++) a.advance(0.02);
  b.advance(60);
  assert.equal(JSON.stringify(a.state.vessels), JSON.stringify(b.state.vessels));
});

test('Mengenbilanz bleibt bei Fehlbedienungen erhalten (Überlaufen, Ausguss, Verschütten)', () => {
  const e = K('K-01');
  run(e, 'addWater', 'A', 100);
  run(e, 'addWater', 'A', 100); // läuft über
  assert.ok(e.state.lost.spilled.water > 0);
  run(e, 'pour', 'A', 'waste', 'fast');
  run(e, 'pour', 'A', 'B', 'all');
  balance(e);
});

test('Gefäße auf der heißen Heizplatte lassen sich nicht anfassen', () => {
  const e = K('K-02');
  run(e, 'addWater', 'D', 25);
  run(e, 'move', 'D', 'heater');
  run(e, 'setHeater', 2);
  e.advance(60);
  assert.equal(run(e, 'pour', 'D', 'A', 'careful').ok, false);
  assert.equal(run(e, 'move', 'D', 'bench').ok, false);
});

test('Regression: Restwasser in der Schale verdampft vollständig (kein Wasserfilm < 0,001 mL)', () => {
  const e = K('K-02');
  run(e, 'addWater', 'D', 10);
  e.vessel('D').c.saltD = 1;
  run(e, 'move', 'D', 'heater');
  run(e, 'setHeater', 1);
  e.advance(900);
  assert.equal(e.vessel('D').c.water, 0);
  assert.ok(Math.abs(e.vessel('D').c.saltS - 1) < 1e-9);
  // auch eine winzige Restmenge
  e.vessel('D').c.water = 0.0004;
  e.advance(1);
  assert.equal(e.vessel('D').c.water, 0);
});
