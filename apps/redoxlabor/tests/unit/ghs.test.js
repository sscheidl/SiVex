'use strict';
// Gefahrstoffkennzeichnung: Vollständigkeit, Konsistenz und saubere, eingebettete Piktogramme.
const test = require('node:test');
const assert = require('node:assert/strict');
const chem = require('../../js/chemistry.js');
const ghs = require('../../js/ghs.js');

test('GHS: jedes Reagenz und jede Probe ist gekennzeichnet, mit Quelle', () => {
  for (const id of [...chem.REAGENTS.map((r) => r.id), ...chem.SAMPLES.map((s) => s.id)]) {
    const L = ghs.LABELS[id];
    assert.ok(L, id + ' fehlt');
    assert.ok(L.form && L.source, id + ': Form und Quelle');
    if (L.pict.length) {
      assert.ok(['Gefahr', 'Achtung'].includes(L.signal), id + ': Signalwort');
      assert.ok(L.h.length > 0, id + ': H-Sätze');
    } else {
      assert.equal(L.h.length, 0, id + ': ohne Piktogramm keine H-Sätze');
    }
    for (const c of L.pict) assert.ok(ghs.PICTOGRAMS[c] && ghs.SVG[c], `${id}: ${c}`);
    for (const h of L.h) assert.ok(ghs.H[h], `${id}: Wortlaut für ${h}`);
    assert.equal(new Set(L.pict).size, L.pict.length, id + ': Piktogramme doppelt');
  }
  // Reagenzien in Schulkonzentration, Proben als Reinstoff gekennzeichnet
  for (const r of chem.REAGENTS) assert.ok(!ghs.LABELS[r.id].pure, r.id);
  for (const s of chem.SAMPLES) assert.ok(ghs.LABELS[s.id].pure, s.id);
});

test('GHS: fachliche Stichproben aus den Sicherheitsdatenblättern', () => {
  const L = ghs.LABELS;
  assert.deepEqual(L.naoh.h, ['H290', 'H314']);
  assert.equal(L.naoh.signal, 'Gefahr');
  assert.deepEqual(L.fehling1.pict, ['GHS05', 'GHS09']);
  assert.ok(L.fehling1.h.includes('H410'), 'Kupfersalz gewässergefährdend');
  assert.equal(L.agno3.signal, 'Achtung');
  assert.ok(L.nh3.h.includes('H318'));
  // Ethanal: krebserzeugend Kat. 1B – Hinweis auf reale Schule, im virtuellen Labor zulässig
  assert.ok(L.ethanal.h.includes('H350') && L.ethanal.pict.includes('GHS08'));
  assert.match(L.ethanal.school, /RiSU/);
  assert.match(L.ethanal.school, /virtuellen Labor/);
  for (const id of chem.SUGAR_IDS) assert.equal(L[id].pict.length, 0, id + ' nicht eingestuft');
  // GHS07 nicht zusätzlich zu GHS05 nur wegen Haut-/Augenreizung (Rangfolgeregel CLP Art. 26)
  assert.ok(!L.nh3.pict.includes('GHS07'));
});

test('GHS: alle neun Piktogramme eingebettet, ohne Skripte und externe Verweise', () => {
  assert.deepEqual(Object.keys(ghs.SVG), ['GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09']);
  for (const [code, svg] of Object.entries(ghs.SVG)) {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, code);
    assert.match(svg, /width="128" height="128"/, code);
    assert.doesNotMatch(svg, /<script|\son\w+\s*=|javascript:|href\s*=|<image|<foreignObject/i, code);
    assert.ok(ghs.dataUri(code).startsWith('data:image/svg+xml'), code);
  }
});
