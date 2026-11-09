// Farbschema: beide Paletten vollständig, Umschalten ohne DOM möglich.
const test = require('node:test');
const assert = require('node:assert/strict');
const Theme = require('../../js/view/theme.js');

test('helle und dunkle Palette haben dieselben Schlüssel', () => {
  const d = Object.keys(Theme.PALETTES.dark).sort();
  const l = Object.keys(Theme.PALETTES.light).sort();
  assert.deepEqual(l, d);
  assert.ok(d.length > 40);
});

test('Standard ist dunkel; set/toggle wechseln die Palette', () => {
  assert.equal(Theme.saved(), 'dark');
  assert.equal(Theme.set('light').name, 'light');
  assert.equal(Theme.palette.wall0, '#f5f8fa');
  assert.equal(Theme.toggle().name, 'dark');
  assert.equal(Theme.set('unbekannt').name, 'dark', 'unbekannte Namen fallen auf dunkel zurück');
});

test('Zuhörer werden beim Wechsel benachrichtigt', () => {
  let got = null;
  Theme.onChange((p) => { got = p.name; });
  Theme.set('light');
  assert.equal(got, 'light');
  Theme.set('dark');
});
