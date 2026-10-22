'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classic, act, must, engine, taskById, k02Positive } = require('./helpers.js');

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} ≉ ${b}`);
function balanced(lab) {
  const b = lab.balance();
  for (const k of Object.keys(b.start)) close(b.now[k], b.start[k], 1e-6, `Mengenbilanz ${k}`);
}

// ------------------------------------------------------------ K-01
test('K-01: Sedimentieren + vorsichtiges Dekantieren ergibt klares Wasser', () => {
  const lab = engine('K-01');
  lab.advance(150);
  must(lab, () => lab.pour('B1', 'B2', 'slow'));
  const w = lab.describe('B2');
  assert.ok(w.water > 85, 'viel Wasser');
  assert.equal(w.turbidityClass, 'klar');
  assert.ok(w.sand < 0.3);
  assert.ok(taskById('K-01').check(lab).success);
  balanced(lab);
});

test('K-01 Gegenfall: Sofort und zügig ausgießen → trübes Wasser mit viel Sand, kein Erfolg', () => {
  const lab = engine('K-01');
  must(lab, () => lab.pour('B1', 'B2', 'fast'));
  const w = lab.describe('B2');
  assert.notEqual(w.turbidityClass, 'klar');
  assert.ok(w.sand > 2, 'Sand mitgerissen: ' + w.sand);
  assert.equal(taskById('K-01').check(lab).success, false);
  // Korrektur: absetzen lassen und erneut vorsichtig abgießen
  lab.advance(180);
  must(lab, () => lab.pour('B2', 'B3', 'slow'));
  assert.equal(lab.describe('B3').turbidityClass, 'klar');
  assert.ok(taskById('K-01').check(lab).success, 'nach Korrektur erfolgreich');
  balanced(lab);
});

test('K-01: Zu schnelles Dekantieren nach dem Absetzen wirbelt Bodensatz auf (Vergleich mit vorsichtig)', () => {
  const a = engine('K-01'), b = engine('K-01');
  a.advance(150); b.advance(150);
  must(a, () => a.pour('B1', 'B2', 'slow'));
  must(b, () => b.pour('B1', 'B2', 'fast'));
  assert.ok(b.describe('B2').sand > 5 * a.describe('B2').sand + 0.5, `zügig ${b.describe('B2').sand} vs. vorsichtig ${a.describe('B2').sand}`);
});

test('K-01: Filtrieren mit gefaltetem Filterpapier hält allen Sand zurück', () => {
  const lab = engine('K-01');
  must(lab, () => lab.insertFilter('paper'));
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(400);
  const f = lab.describe('B2');
  assert.equal(f.sand, 0);
  assert.ok(f.water > 90);
  assert.ok(lab.describe('F').sand > 14);
  assert.ok(taskById('K-01').check(lab).success);
  balanced(lab);
});

test('K-06: Ohne Filterpapier läuft der Sand durch; ungefaltetes Papier lässt Trübung durch', () => {
  const lab = engine('K-01');
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(60);
  assert.ok(lab.describe('B2').sand > 13, 'ohne Papier: Sand im Filtrat');
  const lab2 = engine('K-01');
  must(lab2, () => lab2.insertFilter('paperFlat'));
  must(lab2, () => lab2.moveVessel('B2', 'filter'));
  must(lab2, () => lab2.pour('B1', 'F', 'all'));
  lab2.advance(400);
  const f = lab2.describe('B2');
  assert.ok(f.sand > 0.3, 'ungefaltet: Sand im Filtrat ' + f.sand);
  assert.equal(taskById('K-01').check(lab2).success, false);
});

test('K-06: Ohne Gefäß unter dem Trichter tropft das Filtrat auf den Tisch (Verlust, Bilanz stimmt)', () => {
  const lab = engine('K-01');
  const warnings = [];
  lab.on('mistake', (m) => warnings.push(m.key));
  must(lab, () => lab.insertFilter('paper'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(400);
  assert.ok(lab.describe('table').water > 90);
  assert.ok(warnings.includes('noReceiver'));
  balanced(lab);
});

// ------------------------------------------------------------ K-02
test('K-02 positiv: Lösen, Filtrieren, Eindampfen → Sand und festes Salz getrennt', () => {
  const lab = k02Positive(engine('K-02'));
  const D = lab.describe('D');
  assert.ok(D.saltSolid > 4, 'Salzkristalle ' + D.saltSolid);
  assert.ok(D.water < 0.05);
  assert.equal(D.sand, 0);
  const res = taskById('K-02').check(lab);
  assert.ok(res.success, JSON.stringify(res.items));
  balanced(lab);
});

test('K-06: Trockenes Gemisch in den Filter → keine Trennung, Salz bleibt mit Sand im Rückstand', () => {
  const lab = engine('K-02');
  must(lab, () => lab.insertFilter('paper'));
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(60);
  const F = lab.describe('F');
  assert.ok(F.sand > 9 && F.saltSolid > 4.5, 'beides im Filter');
  assert.ok(lab.describe('B2').salt + lab.describe('B2').saltSolid < 0.01, 'nichts im Filtrat');
  assert.equal(taskById('K-02').check(lab).success, false);
  // Korrektur möglich: Wasser auf den Filter löst das Salz heraus
  must(lab, () => lab.addWater('F', 50));
  lab.advance(300);
  assert.ok(lab.describe('B2').salt > 4, 'Salz nach dem Ausspülen im Filtrat');
});

test('K-06: Gelöstes Salz läuft durch den Filter ins Filtrat, nicht in den Rückstand', () => {
  const lab = engine('K-02');
  must(lab, () => lab.addWater('B1', 50));
  must(lab, () => lab.stir('B1'));
  must(lab, () => lab.insertFilter('paper'));
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(300);
  assert.ok(lab.describe('B2').salt > 4.3);
  assert.equal(lab.describe('B2').saltSolid, 0);
  assert.ok(lab.describe('F').saltSolid < 0.01, 'kein festes Salz im Filter');
});

test('K-06: Salzlösung weggeschüttet → später kein Salz aus dem Nichts', () => {
  const lab = engine('K-02');
  must(lab, () => lab.addWater('B1', 50));
  must(lab, () => lab.stir('B1'));
  must(lab, () => lab.insertFilter('paper'));
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(300);
  must(lab, () => lab.pour('B2', 'waste', 'all'));
  lab.setBurner(2);
  lab.advance(600);
  assert.equal(lab.describe('D').saltSolid, 0, 'leere Schale bleibt leer');
  assert.ok(lab.describe('waste').salt > 4);
  assert.equal(taskById('K-02').check(lab).success, false);
  balanced(lab);
});

test('K-06: Eindampfen einer Sand-Suspension → Rückstand enthält Sand, keine reine Salzfraktion', () => {
  const lab = engine('K-02');
  must(lab, () => lab.addWater('B1', 50));
  must(lab, () => lab.stir('B1'));
  must(lab, () => lab.pour('B1', 'D', 'all'));
  lab.setBurner(1);
  lab.advance(2500);
  const D = lab.describe('D');
  assert.ok(D.sand > 5 && D.saltSolid > 3);
  assert.equal(taskById('K-02').check(lab).success, false);
});

test('K-06: Starkes Erhitzen fast trockener Kristalle → Salz spritzt heraus (Verlust bilanziert)', () => {
  const a = engine('K-02'); const b = engine('K-02');
  for (const lab of [a, b]) {
    must(lab, () => lab.addWater('B1', 50)); must(lab, () => lab.stir('B1'));
    must(lab, () => lab.insertFilter('paper')); must(lab, () => lab.moveVessel('B2', 'filter'));
    must(lab, () => lab.pour('B1', 'F', 'all')); lab.advance(250); must(lab, () => lab.pour('B2', 'D', 'slow'));
  }
  a.setBurner(2); a.advance(1400);
  b.setBurner(2); let g = 0; while (b.describe('D').water > 5 && g++ < 4000) b.advance(1); b.setBurner(1); b.advance(800);
  assert.ok(a.describe('splatter').saltSolid + a.describe('splatter').salt > 0.2, 'stark: verspritzt');
  assert.ok(b.describe('splatter').saltSolid + b.describe('splatter').salt < 0.01, 'zum Schluss schwach: nichts verspritzt');
  balanced(a); balanced(b);
});

test('K-02: Wenig Wasser löst nur einen Teil des Salzes (Sättigung)', () => {
  const lab = engine('K-02');
  must(lab, () => lab.addWater('B1', 10));
  must(lab, () => lab.stir('B1'));
  lab.advance(60);
  const d = lab.describe('B1');
  assert.ok(d.salt < 3.7 && d.saltSolid > 1.2, `gelöst ${d.salt}, fest ${d.saltSolid}`);
});

// ------------------------------------------------------------ K-03
test('K-03 positiv: Magnet zuerst, dann Lösen, Filtrieren, Eindampfen → drei Fraktionen', () => {
  const lab = engine('K-03');
  must(lab, () => lab.useMagnet('B1'));
  must(lab, () => lab.useMagnet('B1'));
  assert.ok(lab.describe('E').iron > 4.7);
  assert.equal(lab.describe('E').sand, 0, 'Magnet zieht keinen Sand an');
  assert.equal(lab.describe('E').saltSolid, 0, 'Magnet zieht kein Salz an');
  k02Positive(lab);
  const r = taskById('K-03').check(lab);
  assert.ok(r.success, JSON.stringify(r.items));
  balanced(lab);
});

test('K-03 andere Reihenfolge: Erst lösen und filtrieren, dann Magnet auf den Filterrückstand', () => {
  const lab = engine('K-03');
  must(lab, () => lab.addWater('B1', 50)); must(lab, () => lab.stir('B1'));
  must(lab, () => lab.insertFilter('paper')); must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all')); lab.advance(250);
  assert.ok(lab.describe('F').iron > 4.8, 'Eisen liegt mit dem Sand im Filter');
  must(lab, () => lab.useMagnet('F')); must(lab, () => lab.useMagnet('F')); must(lab, () => lab.useMagnet('F'));
  must(lab, () => lab.pour('B2', 'D', 'slow'));
  lab.setBurner(2); let g = 0; while (lab.describe('D').water > 5 && g++ < 4000) lab.advance(1);
  lab.setBurner(1); g = 0; while (lab.describe('D').water > 0.05 && g++ < 4000) lab.advance(1); lab.setBurner(0);
  const r = taskById('K-03').check(lab);
  assert.ok(r.success, JSON.stringify(r.items));
});

test('K-03: Ohne Magnet keine Eisenfraktion; Magnet ohne Eisen zieht nichts an', () => {
  const lab = k02Positive(engine('K-03'));
  assert.equal(taskById('K-03').check(lab).success, false);
  const k02 = engine('K-02');
  const msgs = [];
  const eng = k02;
  eng.on('message', (m) => msgs.push(m.text));
  const r = eng.useMagnet('B1');
  assert.equal(r.ok, false, 'kein Magnet in K-02');
});

// ------------------------------------------------------------ K-04
function sepPositive(lab) {
  must(lab, () => lab.pour('B1', 'S', 'all'));
  lab.advance(90);
  must(lab, () => lab.moveVessel('B2', 'sep'));
  lab.setTap('open');
  let g = 0; while (lab.describe('S').water > 4 && g++ < 20000) lab.advance(0.05);
  lab.setTap('drop');
  g = 0; while (lab.describe('S').water > 0.05 && g++ < 200000) lab.advance(0.05);
  lab.setTap('closed');
  must(lab, () => lab.moveVessel('B2', 'bench'));
  must(lab, () => lab.moveVessel('B3', 'sep'));
  lab.setTap('open'); lab.advance(80); lab.setTap('closed');
  return lab;
}

test('K-04 positiv: Absetzen, untere Phase ablassen, obere getrennt auffangen', () => {
  const lab = sepPositive(engine('K-04'));
  const w = lab.describe('B2'), o = lab.describe('B3');
  assert.ok(w.water > 55 && w.oil < 0.5, JSON.stringify([w.water, w.oil]));
  assert.ok(o.oil > 35 && o.water < 1);
  assert.ok(taskById('K-04').check(lab).success);
  balanced(lab);
});

test('K-04: Dichtere Phase (Wasser) läuft zuerst aus dem Hahn', () => {
  const lab = engine('K-04');
  must(lab, () => lab.pour('B1', 'S', 'all'));
  lab.advance(90);
  must(lab, () => lab.moveVessel('B2', 'sep'));
  lab.setTap('open'); lab.advance(10); lab.setTap('closed');
  const b = lab.describe('B2');
  assert.ok(b.water > 9 && b.oil < 0.3);
});

test('K-06: Hahn zu lange offen → Mischfraktion; zu früh geöffnet (Emulsion) → Öl im Wasser', () => {
  const lab = engine('K-04');
  must(lab, () => lab.pour('B1', 'S', 'all'));
  lab.advance(90);
  must(lab, () => lab.moveVessel('B2', 'sep'));
  lab.setTap('open'); lab.advance(75); lab.setTap('closed');
  assert.ok(lab.describe('B2').oil > 5, 'Öl mit abgelassen');
  assert.equal(taskById('K-04').check(lab).success, false);
  const lab2 = engine('K-04');
  must(lab2, () => lab2.pour('B1', 'S', 'all'));
  must(lab2, () => lab2.moveVessel('B2', 'sep'));
  lab2.setTap('open'); lab2.advance(45); lab2.setTap('closed');
  const b = lab2.describe('B2');
  assert.ok(b.oil > 1, 'ohne Absetzen: Öltröpfchen im Wasser ' + b.oil);
});

test('K-06: Hahn offen ohne Gefäß → Verlust auf dem Tisch; Stopfen auf → Abfluss stockt', () => {
  const lab = engine('K-04');
  must(lab, () => lab.pour('B1', 'S', 'all'));
  lab.advance(60);
  lab.setTap('open'); lab.advance(20); lab.setTap('closed');
  assert.ok(lab.describe('table').water > 15);
  balanced(lab);
  const lab2 = engine('K-04');
  must(lab2, () => lab2.pour('B1', 'S', 'all'));
  lab2.setStopper(true);
  must(lab2, () => lab2.moveVessel('B2', 'sep'));
  lab2.setTap('open'); lab2.advance(30);
  assert.ok(lab2.describe('B2').water < 2, 'Unterdruck: kaum Abfluss');
  lab2.setStopper(false); lab2.advance(20);
  assert.ok(lab2.describe('B2').water > 15, 'nach Abnehmen des Stopfens läuft es');
});

test('K-06: Öl und Wasser lassen sich durch Filterpapier nicht trennen', () => {
  const lab = engine('K-04');
  must(lab, () => lab.insertFilter('paper'));
  must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all'));
  lab.advance(800);
  const b = lab.describe('B2');
  assert.ok(b.water > 40 && b.oil > 25, 'beide Phasen im Filtrat');
  assert.equal(taskById('K-04').check(lab).success, false);
});

// ------------------------------------------------------------ K-05
test('K-05: Heißes Wasser zieht die Farbstoffe deutlich schneller aus als kaltes', () => {
  const lab = engine('K-05');
  must(lab, () => lab.addHibiscus('B1')); must(lab, () => lab.addHibiscus('B2'));
  must(lab, () => lab.addWater('B1', 100, 'cold')); must(lab, () => lab.addWater('B2', 100, 'hot'));
  lab.advance(180);
  const cold = lab.describe('B1').dyeConc, hot = lab.describe('B2').dyeConc;
  assert.ok(hot > 4 * cold, `heiß ${hot} vs. kalt ${cold}`);
  assert.ok(cold > 0.05, 'kalt färbt sich langsam, aber sichtbar');
  // Farbe nimmt über die Zeit zu
  const before = lab.describe('B1').dyeConc; lab.advance(300); assert.ok(lab.describe('B1').dyeConc > before);
});

test('K-05: Filtrieren trennt Blütenreste, nicht die gelösten Farbstoffe; Sieb lässt feine Teilchen durch', () => {
  const lab = engine('K-05');
  must(lab, () => lab.addHibiscus('B1')); must(lab, () => lab.addHibiscus('B1'));
  must(lab, () => lab.addWater('B1', 100, 'hot'));
  lab.advance(300);
  const dye = lab.describe('B1').dyeConc;
  must(lab, () => lab.insertFilter('paper')); must(lab, () => lab.moveVessel('B2', 'filter'));
  must(lab, () => lab.pour('B1', 'F', 'all')); lab.advance(500);
  const t = lab.describe('B2');
  assert.equal(t.petals, 0); assert.equal(t.frag, 0);
  assert.ok(Math.abs(t.dyeConc - dye) / dye < 0.2, 'Farbstoffkonzentration bleibt');
  const lab2 = engine('K-05');
  must(lab2, () => lab2.addHibiscus('B1')); must(lab2, () => lab2.addHibiscus('B1'));
  must(lab2, () => lab2.addWater('B1', 100, 'hot')); lab2.advance(300);
  must(lab2, () => lab2.insertFilter('sieve')); must(lab2, () => lab2.moveVessel('B2', 'filter'));
  must(lab2, () => lab2.pour('B1', 'F', 'all')); lab2.advance(200);
  const s = lab2.describe('B2');
  assert.equal(s.petals, 0, 'Sieb hält Blütenstücke zurück');
  assert.ok(s.frag > 0.05, 'feine Teilchen gehen durch das Sieb');
});

test('K-05: Erfolg verlangt Vergleich kalt/heiß und gefilterten Tee; Tee wird nie als Reinstoff gewertet', () => {
  const lab = engine('K-05');
  must(lab, () => lab.addHibiscus('B1')); must(lab, () => lab.addHibiscus('B2'));
  must(lab, () => lab.addWater('B2', 100, 'hot'));
  lab.advance(200);
  must(lab, () => lab.insertFilter('paper')); must(lab, () => lab.moveVessel('B3', 'filter'));
  must(lab, () => lab.pour('B2', 'F', 'all')); lab.advance(500);
  assert.equal(taskById('K-05').check(lab).success, false, 'nur heiß: kein Vergleich');
  must(lab, () => lab.addWater('B1', 100, 'cold')); lab.advance(200);
  assert.ok(taskById('K-05').check(lab).success);
  const pure = taskById('K-05').observations(lab).find((o) => o.id === 'pure');
  assert.equal(pure.correct, 'mixture');
});

// ------------------------------------------------------------ allgemein
test('A-03 Mengenbilanz bleibt bei zufälligen Handlungsfolgen erhalten (keine Erzeugung/Vernichtung)', () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const id of ['K-02', 'K-03', 'K-04', 'K-05']) {
    const lab = engine(id);
    const ids = ['B1', 'B2', 'B3', 'F', 'D', 'S', 'waste'].filter((x) => x === 'waste' || lab.container(x));
    for (let i = 0; i < 60; i++) {
      const k = Math.floor(rnd() * 9);
      const a = ids[Math.floor(rnd() * ids.length)], b = ids[Math.floor(rnd() * ids.length)];
      act(lab, () => [
        () => lab.pour(a, b, ['slow', 'fast', 'all'][Math.floor(rnd() * 3)]),
        () => lab.addWater(a, 25, rnd() < 0.5 ? 'cold' : 'hot'),
        () => lab.stir(a),
        () => lab.moveVessel(['B1', 'B2', 'B3'][Math.floor(rnd() * 3)], ['filter', 'sep', 'bench'][Math.floor(rnd() * 3)]),
        () => lab.insertFilter(['paper', 'paperFlat', 'sieve'][Math.floor(rnd() * 3)]),
        () => lab.removeFilter(),
        () => lab.setBurner(Math.floor(rnd() * 3)),
        () => lab.useMagnet(a),
        () => lab.setTap(['open', 'drop', 'closed'][Math.floor(rnd() * 3)])
      ][k]());
      lab.advance(rnd() * 40);
      if (lab.state.hibiscusStock >= 2 && rnd() < 0.1) act(lab, () => lab.addHibiscus('B1'));
    }
    balanced(lab);
    for (const c of ['B1', 'B2', 'B3', 'F', 'D', 'S']) {
      const d = lab.describe(c);
      if (!d) continue;
      for (const v of [d.water, d.oil, d.salt, d.saltSolid, d.sand, d.iron, d.petals, d.frag, d.dye]) assert.ok(v >= -1e-9, `${id} ${c}: negative Menge ${v}`);
    }
  }
});

test('A-04 Zeitraffer: gleiche simulierte Zeit in verschiedenen Schrittgrößen → identischer Zustand', () => {
  const run = (chunk) => {
    const lab = engine('K-02');
    const adv = (sec) => { for (let i = 0; i < Math.round(sec / chunk); i++) lab.update(chunk); };
    lab.addWater('B1', 50);
    adv(20);
    lab.stir('B1');
    adv(100);
    lab.insertFilter('paper'); adv(10); lab.moveVessel('B2', 'filter'); adv(10);
    lab.pour('B1', 'F', 'all'); adv(200);
    return JSON.stringify([lab.describe('B1'), lab.describe('B2'), lab.describe('F')]);
  };
  const a = run(0.05), b = run(0.25), c = run(1), d = run(5);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(c, d);
});

test('A-03 Vorgänge laufen über die Zeit (keine Sprünge): Filtrieren und Eindampfen brauchen Zeit', () => {
  const lab = engine('K-02');
  must(lab, () => lab.addWater('B1', 50)); must(lab, () => lab.stir('B1'));
  must(lab, () => lab.insertFilter('paper')); must(lab, () => lab.moveVessel('B2', 'filter'));
  lab.pour('B1', 'F', 'all');
  lab.advance(20);
  const mid = lab.describe('B2').water;
  assert.ok(mid > 0 && mid < 40, 'Filtrat entsteht nach und nach: ' + mid);
});
