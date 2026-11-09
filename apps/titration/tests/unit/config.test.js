const test = require('node:test');
const assert = require('node:assert/strict');
const Cfg = require('../../js/model/config.js');

test('Dezimalkomma und -punkt werden akzeptiert, Unsinn nicht', () => {
  assert.equal(Cfg.parseDecimal('0,1'), 0.1);
  assert.equal(Cfg.parseDecimal(' 25.0 '), 25);
  assert.ok(Number.isNaN(Cfg.parseDecimal('1.000,5')));
  assert.ok(Number.isNaN(Cfg.parseDecimal('abc')));
  assert.ok(Number.isNaN(Cfg.parseDecimal('')));
});

test('Grenzwerte: 0,01–0,5 mol/L, 5–50 mL', () => {
  assert.equal(Cfg.validateField('cTitrant', '0,1').ok, true);
  assert.equal(Cfg.validateField('cTitrant', '0,6').ok, false);
  assert.equal(Cfg.validateField('vSample', '4').ok, false);
  assert.equal(Cfg.validateField('vSample', '50').ok, true);
});

test('zufällige Probenkonzentration liefert ÄP im Bürettenbereich 12–42 mL', () => {
  for (let i = 0; i < 200; i++) {
    const c = Cfg.randomSampleConcentration(0.1, 25, Math.random);
    const vEq = (c * 25) / 0.1;
    assert.ok(vEq >= 11.9 && vEq <= 42.1, `V(ÄP) = ${vEq}`);
  }
});

test('Durchführbarkeitswarnung, wenn der ÄP außerhalb der Bürette liegt', () => {
  const w = Cfg.feasibilityWarnings({ sampleType: 'acid', cSample: 0.5, vSample: 50, cTitrant: 0.1 }, true);
  assert.equal(w[0].level, 'error');
  assert.ok(w[0].text.includes('250,00 mL'));
  assert.deepEqual(Cfg.feasibilityWarnings({ sampleType: 'acid', cSample: 0.1, vSample: 25, cTitrant: 0.1 }, false), []);
});

test('deutsche Zahlformatierung', () => {
  assert.equal(Cfg.formatNumber(0.1, 3), '0,100');
  assert.equal(Cfg.formatNumber(-1.5, 1), '−1,5');
  assert.equal(Cfg.formatNumber(NaN), '–');
});
