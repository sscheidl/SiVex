// Geometrie: plausible Volumina, waagrechter Spiegel im gekippten Gefäß, Gießwinkel.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../../js/geometry.js');

test('Gefäße fassen realistische Volumina (1 mm = 1,25 px)', () => {
  const cap = (t) => G.capacity(t);
  assert.ok(cap('beaker') > 280 && cap('beaker') < 340, 'Becherglas 250 mL: ' + cap('beaker'));
  assert.ok(cap('erlenmeyer') > 240 && cap('erlenmeyer') < 290, 'Erlenmeyerkolben 250 mL: ' + cap('erlenmeyer'));
  assert.ok(cap('sep') > 250 && cap('sep') < 330, 'Scheidetrichter 250 mL: ' + cap('sep'));
  assert.ok(G.heightOf('beaker', 100) > 30 && G.heightOf('beaker', 100) < 45, '100 mL ≈ 3 cm hoch im Becherglas');
  for (const t of Object.keys(G.PROFILES)) {
    let prev = -1;
    for (let v = 0; v < G.capacity(t); v += G.capacity(t) / 20) { const h = G.heightOf(t, v); assert.ok(h >= prev); prev = h; }
  }
});

test('Gekipptes Becherglas: Spiegel waagrecht, Fläche erhalten, beim Gießwinkel genau am Ausguss', () => {
  const poly = G.interiorPoly('beaker');
  const [lx, ly] = G.LIP.beaker;
  for (const mL of [150, 100, 40, 10]) {
    const A = G.areaOf('beaker', mL);
    const th = G.pourAngle('beaker', A);
    const pose = { x: 300, y: 200, ax: lx, ay: ly, th };
    const pw = G.transform(poly, pose);
    const level = G.levelFor(pw, A);
    const below = G.clipBelow(pw, level);
    assert.ok(Math.abs(G.polyArea(below) - A) / A < 0.01, 'Fläche ' + mL);
    assert.ok(Math.abs(level - 200) < 1.5, `Spiegel am Ausguss (${mL} mL): ${level}`);
  }
  // je weniger Inhalt, desto steiler muss gekippt werden
  const angles = [200, 120, 60, 20].map((v) => G.pourAngle('beaker', G.areaOf('beaker', v)));
  for (let i = 1; i < angles.length; i++) assert.ok(angles[i] > angles[i - 1]);
  assert.ok(G.pourAngle('beaker', G.areaOf('beaker', 330)) < 0.12, 'randvoll: läuft schon bei kaum geneigtem Glas über');
});

test('Bodensatz verdrängt Flüssigkeit nur außerhalb der Poren', () => {
  const c = { water: 100, oil: 0, sandC: 18, sandF: 2, iron: 0, saltS: 0, saltD: 0 };
  const bed = G.bedVolume(c);
  assert.ok(bed > 10 && bed < 16);
  assert.ok(G.fillVolume(c) > 100 && G.fillVolume(c) < 100 + bed);
});
