// Speicherstand: Migration aus 0.1.0 und Schutz vor Fehlfreigaben
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../../js/ui/store.js');

const V1 = {
  v: 1, current: 'phosphoric', view: 'eval',
  exps: {
    acetic: {
      plan: { titrant: 'NaOH', checked: true, indicator: 'phenolphthalein' },
      series: [{ id: 'R1', no: 1, kind: 'survey', points: [{ v: 0, pH: 3.04, stable: true }] }], active: 0, evalSurvey: 'R1', sampleNo: 1,
      markers: { eq1: 24 }, fields: { veq1: { input: '24,00', status: 'ok', message: 'Richtig berechnet.' }, read_start_R1: { input: '0,40', status: 'ok' }, pk_pKs1: { input: '4,76', status: 'ok' } },
      submission: { at: 1, values: { pKs1: 4.76 } },
      lab: { burette: { rinsed: true, filled: true, bubble: false, reading: 24.4 }, calibration: 2, sample: 20, water: 30, dispensed: 24 },
    },
    ammonia: { plan: { titrant: 'NaOH', checked: true } },
  },
};

test('0.1.0-Stand wird übernommen: Daten bleiben, Prüfungen und Freigaben nicht', () => {
  const s = Store.normalize(Store.migrateV1(V1));
  const a = s.exps.acetic;
  assert.equal(s.v, 2);
  assert.equal(s.current, 'phosphoric');
  assert.equal(a.series.length, 1, 'Messreihe erhalten');
  assert.equal(a.markers.eq1, 24);
  assert.equal(a.fields.eqm1.input, '24');
  assert.equal(a.fields.veq1.input, '24,00');
  assert.equal(a.fields.veq1.status, undefined, 'alte Prüfung verworfen');
  assert.equal(a.fields.read_start_R1, undefined, 'Ablesefelder entfallen');
  assert.equal(a.submission, null, 'alte Abgabe ist keine neue Freigabe');
  assert.deepEqual(a.legacySubmission.values, { pKs1: 4.76 });
  assert.equal(a.answers.titrant.status, 'ok');
  assert.equal(s.exps.ammonia.answers.titrant, undefined, 'falsche Maßlösung gilt nicht als gelöst');
  assert.equal(s.meter.calibration, 2);
  assert.equal(s.burettes.NaOH.reading, 24.4);
  assert.equal(a.lab.burette, undefined);
  assert.equal(s.migratedFrom, 1);
});

test('Unbekannte oder beschädigte Stände ergeben einen frischen Zustand', () => {
  assert.equal(Store.normalize(null).v, 2);
  assert.equal(Store.normalize({ v: 7 }).exps.acetic.series.length, 0);
  const n = Store.normalize({ v: 2, current: 'xyz', exps: { acetic: { series: [{ id: 'R1' }] } } });
  assert.equal(n.current, 'acetic');
  assert.equal(n.exps.acetic.series.length, 1);
  assert.equal(n.exps.glycine.series.length, 0);
});
