'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const chem = require('../../js/chemistry.js');
const { fehling, tollens, newLab, act, addAll } = require('./helpers.js');

const ALDEHYDES = ['ethanal', 'propanal', 'butanal'];
const KETONES = ['propanon', 'butanon', 'pentan-2-on'];

// ------------------------------------------------------------- Farbmodell
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}
function contentsWith(ids) {
  const c = chem.createContents();
  ids.forEach((id) => chem.add(c, id));
  c.mix = 1;
  return c;
}

test('Stoffdaten: Pflichtproben vollständig, kein Benzaldehyd, Summenformeln passen zur Halbstrukturformel', () => {
  const ids = chem.BASIC_SAMPLE_IDS.slice().sort();
  assert.deepEqual(ids, [...ALDEHYDES, ...KETONES].sort());
  assert.deepEqual(chem.SUGAR_IDS.slice().sort(), ['fructose', 'glucose', 'maltose', 'saccharose']);
  assert.ok(!chem.SAMPLES.some((s) => /benz/i.test(s.id)));
  const sub = { '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4, '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9 };
  for (const s of chem.SAMPLES.filter((x) => x.chain)) {
    const f = chem.formulaFromChain(s);
    const m = /^C(.+)H(.+)O$/.exec(s.formula);
    const num = (t) => +t.split('').map((ch) => sub[ch]).join('');
    assert.equal(num(m[1]), f.C, s.id + ' C');
    assert.equal(num(m[2]), f.H, s.id + ' H');
    // Aldehyde: Carbonyl-C trägt H (endständig); Ketone: Carbonyl-C zwischen zwei C-Gruppen
    if (s.cls === 'aldehyd') assert.equal(s.chain[s.carbonyl + 1], 'H');
    else assert.ok(s.carbonyl > 0 && s.carbonyl < s.chain.length - 1 && s.chain[s.carbonyl + 1] !== 'H');
  }
});

test('C-01: Fehling I ist hellblau und klar', () => {
  const ap = chem.appearance(contentsWith(['fehling1']));
  const c = hsl(ap.liquid);
  assert.ok(c.h > 195 && c.h < 215, 'Farbton blau: ' + c.h);
  assert.ok(c.l > 0.55, 'hell: ' + c.l);
  assert.ok(ap.liquid[3] < 0.7, 'durchscheinend');
  assert.equal(ap.turb[3], 0, 'klar, keine Trübung');
});

test('C-02: Fehling II ist farblos und klar', () => {
  const ap = chem.appearance(contentsWith(['fehling2']));
  assert.ok(ap.liquid[3] <= 0.12, 'nahezu farblos');
  assert.equal(ap.turb[3], 0, 'klar');
});

test('C-03: Fehling I + II ergibt tiefblaue klare Lösung', () => {
  const ap = chem.appearance(contentsWith(['fehling1', 'fehling2']));
  const c = hsl(ap.liquid);
  assert.ok(c.h > 215 && c.h < 240, 'Farbton tiefblau: ' + c.h);
  assert.ok(c.l < 0.5, 'dunkel: ' + c.l);
  assert.ok(ap.liquid[3] > 0.8, 'kräftig');
  assert.equal(ap.turb[3], 0, 'klar');
  const fI = hsl(chem.appearance(contentsWith(['fehling1'])).liquid);
  assert.ok(c.l < fI.l - 0.15, 'deutlich dunkler als Fehling I');
});

test('Reagenzien für Tollens sind farblos', () => {
  for (const id of ['agno3', 'naoh', 'nh3']) {
    const ap = chem.appearance(contentsWith([id]));
    assert.ok(ap.liquid[3] <= 0.12 && ap.turb[3] === 0, id);
  }
});

test('Tollens-Vorbereitung: AgNO₃ → brauner Ag₂O-Niederschlag mit NaOH → klare Lösung mit NH₃', () => {
  const c = chem.createContents();
  chem.add(c, 'agno3');
  assert.equal(chem.analyze(c).status, 'incomplete');
  assert.equal(chem.appearance(c).turb[3], 0);
  chem.add(c, 'naoh');
  const a1 = chem.analyze(c);
  assert.equal(a1.status, 'precipitate');
  const t1 = chem.appearance(c).turb;
  assert.ok(t1[3] > 0.6 && t1[0] > t1[2], 'brauner Niederschlag');
  chem.add(c, 'nh3');
  assert.equal(chem.analyze(c).status, 'precipitate', 'eine Portion NH₃ löst nur teilweise');
  assert.ok(chem.appearance(c).turb[3] < t1[3]);
  chem.add(c, 'nh3');
  const a3 = chem.analyze(c);
  assert.equal(a3.status, 'ready');
  assert.ok(a3.valid);
  assert.equal(chem.appearance(c).turb[3], 0, 'klare ammoniakalische Silberlösung');
});

test('C-04/F-01/F-02: alle Aldehyde reagieren bei korrekter Fehling-Probe positiv (ziegelrot, trüb)', () => {
  for (const id of ALDEHYDES) {
    const lab = newLab();
    const t = fehling(lab, 1, id);
    const m = chem.classify(t.contents);
    assert.equal(m.outcome, 'positive', id);
    assert.ok(t.contents.progress > 0.97, id + ' Umsatz');
    const ap = chem.appearance(t.contents);
    const c = hsl(ap.turb);
    assert.ok(c.h >= 0 && c.h < 25, id + ' ziegelrot, Farbton ' + c.h);
    assert.ok(ap.turb[3] > 0.85, id + ' deutliche Trübung');
    assert.ok(ap.flecks.density > 0.8, id + ' Partikel');
  }
});

test('C-05/N-01: alle Ketone bleiben bei korrekter Fehling-Probe tiefblau', () => {
  for (const id of KETONES) {
    const lab = newLab();
    const t = fehling(lab, 1, id);
    const m = chem.classify(t.contents);
    assert.equal(m.outcome, 'negative', id);
    assert.equal(t.contents.progress, 0);
    const ap = chem.appearance(t.contents);
    assert.equal(ap.turb[3], 0, id + ' kein Cu₂O');
    assert.ok(hsl(ap.liquid).h > 215, id + ' blau');
    assert.ok(chem.isObservable(t.contents), id + ' Beobachtung möglich (negativer Nachweis ist abschließbar)');
  }
});

test('C-06: Fehling-Farbverlauf über mehrere unterscheidbare Zustände (grünlich → orange → ziegelrot)', () => {
  const c = contentsWith(['fehling1', 'fehling2', 'ethanal']);
  const hues = [];
  for (const p of [0, 0.25, 0.4, 0.55, 0.72, 1]) {
    c.cu2o = p;
    hues.push(Math.round(hsl(chem.appearance(c).body).h));
  }
  // blau → blaugrün → gelbgrün → gelborange → orange → ziegelrot
  assert.ok(hues[0] > 215, 'Start tiefblau ' + hues);
  assert.ok(hues[1] > 140 && hues[1] < 190, 'blaugrün ' + hues);
  assert.ok(hues[2] > 50 && hues[2] < 80, 'gelbgrün ' + hues);
  assert.ok(hues[3] > 30 && hues[3] < 50, 'gelborange ' + hues);
  assert.ok(hues[5] < 20, 'Ende ziegelrot ' + hues);
  for (let i = 1; i < hues.length; i++) assert.ok(hues[i] < hues[i - 1], 'monotoner Farbumschlag ' + hues);
});

test('C-07/F-03/F-04: alle Aldehyde bilden bei korrekter Tollens-Probe einen Silberspiegel', () => {
  for (const id of ALDEHYDES) {
    const lab = newLab();
    const t = tollens(lab, 2, id);
    assert.equal(chem.classify(t.contents).outcome, 'positive', id);
    assert.ok(chem.appearance(t.contents).mirror > 0.95, id + ' Spiegel');
  }
});

test('C-08/N-02: Ketone bilden keinen Silberspiegel', () => {
  for (const id of KETONES) {
    const lab = newLab();
    const t = tollens(lab, 2, id);
    assert.equal(chem.classify(t.contents).outcome, 'negative', id);
    const ap = chem.appearance(t.contents);
    assert.equal(ap.mirror, 0, id);
    assert.equal(ap.turb[3], 0, id + ' bleibt klar');
  }
});

test('N-03: Ethanal + nur Fehling I → kein gültiger Nachweis', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal', { reagents: ['fehling1'], shake: false });
  assert.equal(t.contents.progress, 0);
  const m = chem.classify(t.contents);
  assert.equal(m.outcome, 'invalid');
  assert.equal(m.result, 'ungueltig');
  assert.equal(chem.appearance(t.contents).turb[3], 0, 'kein Cu₂O');
});

test('N-04: Ethanal + Fehling-Lösung ohne Erwärmen → kein abgeschlossener Nachweis', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal', { heat: false, seconds: 120 });
  assert.equal(t.contents.progress, 0, 'keine Reaktion bei Raumtemperatur');
  const m = chem.classify(t.contents);
  assert.equal(m.outcome, 'unfinished');
  assert.notEqual(m.result, 'positiv');
});

test('N-04b: kaltes Wasserbad (Heizplatte aus) startet die Reaktion nicht', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal', { setting: 0, seconds: 60 });
  assert.equal(t.contents.progress, 0);
});

test('N-05: Ethanal + unvollständiges Tollens-Reagenz → kein gültiger Nachweis', () => {
  const variants = [['agno3'], ['agno3', 'naoh'], ['agno3', 'naoh', 'nh3']];
  for (const reagents of variants) {
    const lab = newLab();
    const t = tollens(lab, 1, 'ethanal', { reagents });
    const m = chem.classify(t.contents);
    assert.equal(m.outcome, 'invalid', reagents.join('+'));
    assert.equal(chem.appearance(t.contents).mirror, 0, 'kein Spiegel bei ' + reagents.join('+'));
  }
});

test('E-04: Fehling reagiert nur mit Reagenz + reduzierender Probe + Wärme', () => {
  const cases = [
    { name: 'ohne Probe', sample: null, opts: {}, expect: 0 },
    { name: 'nur Fehling II', sample: 'ethanal', opts: { reagents: ['fehling2'] }, expect: 0 },
    { name: 'ohne Wärme', sample: 'ethanal', opts: { heat: false }, expect: 0 },
    { name: 'Keton', sample: 'butanon', opts: {}, expect: 0 },
    { name: 'vollständig', sample: 'ethanal', opts: {}, expect: 1 }
  ];
  for (const k of cases) {
    const lab = newLab();
    const t = fehling(lab, 1, k.sample, k.opts);
    assert.equal(Math.round(t.contents.progress), k.expect, k.name);
  }
});

test('E-05: Tollens bei Raumtemperatur langsam, im warmen Wasserbad deutlich schneller', () => {
  // Fachlich: Mit einfachen Aldehyden kann sich Silber auch ohne Erwärmen abscheiden
  // (Strathclyde, Kap. 7). Das Modell zeigt das als langsame Reaktion über einige Minuten.
  const cold = tollens(newLab(), 1, 'ethanal', { heat: false, seconds: 30 });
  const warm = tollens(newLab(), 1, 'ethanal', { setting: 60, seconds: 30 });
  assert.ok(cold.contents.progress > 0 && cold.contents.progress < chem.VISIBLE.tollens, 'kalt: beginnend ' + cold.contents.progress);
  assert.ok(warm.contents.progress >= chem.COMPLETE, 'warm: abgeschlossen ' + warm.contents.progress);
  assert.equal(chem.classify(cold.contents).outcome, 'unfinished');
  const lab = newLab();
  const late = tollens(lab, 1, 'ethanal', { heat: false, seconds: 400 });
  assert.equal(chem.classify(late.contents).outcome, 'positive', 'nach einigen Minuten auch bei Raumtemperatur sichtbar');
  assert.ok(chem.appearance(late.contents).mirror > 0.9, 'schonende Abscheidung ergibt einen Spiegel');
});

test('Unkritische Reihenfolge: Probe vor dem Reagenz, Fehling II vor Fehling I', () => {
  const lab = newLab();
  const t = fehling(lab, 1, null, { reagents: ['ethanal', 'fehling2', 'fehling1'] });
  assert.equal(chem.classify(t.contents).outcome, 'positive');
});

test('Fehlbedienung wird nicht automatisch korrigiert: Fehling I + Natronlauge → Cu(OH)₂, beim Erhitzen schwarz', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'propanon', { reagents: ['fehling1', 'naoh'] });
  const a = chem.analyze(t.contents);
  assert.equal(a.status, 'cuoh2');
  assert.ok(t.contents.cuo > 0.9);
  const m = chem.classify(t.contents);
  assert.equal(m.outcome, 'invalid');
  assert.deepEqual(m.obsRequired, ['schwarz']);
});

test('Gemisch aus Kupfer- und Silberreagenzien wird als ungültig erkannt', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal', { reagents: ['fehling1', 'fehling2', 'agno3'] });
  assert.equal(chem.analyze(t.contents).system, 'foreign');
  assert.equal(t.contents.progress, 0);
});

test('Zweite, andere Stoffprobe wird abgelehnt; Fassungsvermögen begrenzt', () => {
  const c = chem.createContents();
  assert.ok(chem.add(c, 'ethanal').ok);
  assert.equal(chem.add(c, 'propanon').ok, false);
  for (let i = 0; i < chem.CAPACITY - 1; i++) chem.add(c, 'fehling2');
  assert.equal(chem.volume(c), chem.CAPACITY);
  assert.equal(chem.add(c, 'fehling2').ok, false);
});

test('E-10/D-05: Protokollbewertung erkennt korrekte positive und negative Auswertung', () => {
  for (const [sample, outcome] of [['ethanal', 'positiv'], ['pentan-2-on', 'negativ']]) {
    const lab = newLab();
    const t = fehling(lab, 1, sample);
    const m = chem.classify(t.contents);
    const correct = {
      method: 'fehling',
      observations: outcome === 'positiv' ? ['ziegelrot'] : ['tiefblau', 'keineVeraenderung'],
      result: outcome,
      interpretation: outcome === 'positiv' ? 'reduzierend' : 'nichtReduzierend',
      cls: outcome === 'positiv' ? 'aldehyd' : 'keinAldehyd'
    };
    assert.ok(chem.gradeProtocol(m, correct).allCorrect, sample);
    const wrongCls = Object.assign({}, correct, { cls: outcome === 'positiv' ? 'aldehydEindeutig' : 'ketonBewiesen' });
    assert.equal(chem.gradeProtocol(m, wrongCls).cls, false, sample + ': eindeutige Identifikation ist fachlich nicht zulässig');
    const wrongObs = Object.assign({}, correct, { observations: ['spiegel'] });
    assert.equal(chem.gradeProtocol(m, wrongObs).observations, false);
  }
});

test('Positive Tollens-Auswertung: Silberspiegel oder grau-schwarzes Silber (mindestens eins), nicht braunes Ag₂O', () => {
  const lab = newLab();
  const t = tollens(lab, 1, 'butanal');
  const m = chem.classify(t.contents);
  const base = { method: 'tollens', result: 'positiv', interpretation: 'reduzierend', cls: 'aldehyd' };
  assert.ok(chem.gradeProtocol(m, Object.assign({ observations: ['spiegel'] }, base)).allCorrect);
  assert.ok(chem.gradeProtocol(m, Object.assign({ observations: ['spiegel', 'grau'] }, base)).allCorrect);
  assert.ok(chem.gradeProtocol(m, Object.assign({ observations: ['grau'] }, base)).allCorrect, 'fein verteiltes Silber ist ebenfalls elementares Silber');
  assert.equal(chem.gradeProtocol(m, Object.assign({ observations: ['braun'] }, base)).observations, false);
  assert.equal(chem.gradeProtocol(m, Object.assign({ observations: ['klar'] }, base)).observations, false);
});

test('Temperaturabhängigkeit: Fehling bei 60 °C langsamer als bei 80 °C, aber positiv', () => {
  const lab1 = newLab();
  const t1 = fehling(lab1, 1, 'ethanal', { setting: 60, seconds: 12 });
  const lab2 = newLab();
  const t2 = fehling(lab2, 1, 'ethanal', { setting: 80, seconds: 12 });
  assert.ok(t1.contents.progress < t2.contents.progress);
  lab1.advance(40);
  assert.equal(chem.classify(t1.contents).outcome, 'positive');
});

test('Reaktion verläuft kontinuierlich (mehrere Zwischenzustände über die Zeit)', () => {
  const lab = newLab();
  const t = fehling(lab, 1, 'ethanal', { seconds: 0 });
  const samples = [];
  for (let i = 0; i < 12; i++) { lab.advance(2); samples.push(+t.contents.progress.toFixed(3)); }
  const distinct = new Set(samples.filter((p) => p > 0 && p < 1));
  assert.ok(distinct.size >= 4, 'mindestens 4 Zwischenstufen: ' + samples.join(', '));
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] >= samples[i - 1]);
});

test('Ohne Flüssigkeit kein Zustand "Beobachtung möglich"', () => {
  const c = chem.createContents();
  for (let i = 0; i < 100; i++) chem.step(c, 0.1, 80, 1);
  assert.equal(chem.isObservable(c), false);
  assert.equal(chem.classify(c).outcome, 'empty');
});

test('Siedeverzug: direktes Erhitzen in der Flamme macht den Versuch ungültig', () => {
  const lab = newLab();
  act(lab, () => lab.selectTube(3));
  addAll(lab, 3, ['fehling1', 'fehling2', 'ethanal']);
  lab.toggleBurner(true);
  let safety = null;
  lab.on('safety', (e) => { safety = e; });
  act(lab, () => lab.moveTube(3, 'flame'));
  lab.advance(6);
  const t = lab.tubeById(3);
  assert.ok(t.contents.bumped);
  assert.ok(safety && safety.tubeId === 3);
  assert.equal(chem.classify(t.contents).outcome, 'invalid');
  assert.equal(chem.canAdd(t.contents, 'fehling1').ok, false);
});
