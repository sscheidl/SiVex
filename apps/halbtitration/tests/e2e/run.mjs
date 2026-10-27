// Browserprüfung des Halbtitrationslabors (Edge über Playwright).
// Bedient die Anwendung über die Oberfläche wie Lernende, prüft Zustände und
// erzeugt Screenshot-Nachweise in docs/screenshots.
//
// Aufruf: node tests/e2e/run.mjs            (alle Szenarien)
//         ONLY=E1,E8 node tests/e2e/run.mjs (Auswahl)
// Zeitraffer: Die Labor-Physik läuft im Test mit ?speed=25 (Tropfen, Mischen,
// Ansprechzeit identisch, nur schneller); Szenario E8 prüft Animationen in Echtzeit.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/serve.mjs';
import * as F from './flow.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const ROOT = process.env.ROOT ? path.resolve(process.env.ROOT) : (fs.existsSync(path.join(APP, 'dist/halbtitration/index.html')) ? path.join(APP, 'dist/halbtitration') : APP);
const SHOTS = path.join(APP, 'docs/screenshots');
const PORT = Number(process.env.PORT || 8124);
const BASE = `http://localhost:${PORT}/index.html`;
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let lastPage = null;
const { assert, de } = F;

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, hasTouch: !!opts.touch, isMobile: false, deviceScaleFactor: 1 });
  if (opts.init) await ctx.addInitScript(opts.init);
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const page = await ctx.newPage();
  lastPage = page;
  page.setDefaultTimeout(25000);
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.__errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(`http://localhost:${PORT}/`) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) page.__errors.push('externe Anfrage: ' + r.url()); });
  return page;
}

async function fresh(page, speed = 25) {
  await page.goto(`${BASE}?speed=${speed}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}?speed=${speed}`);
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });

const PLANS = {
  acetic: { exp: 'acetic', titrant: 'NaOH', particle: 'conjBase', eqCat: 'basic', indicator: 'phenolphthalein' },
  ammonia: { exp: 'ammonia', titrant: 'HCl', particle: 'conjAcid', eqCat: 'acidic', indicator: 'methylRed' },
  phosphoric: { exp: 'phosphoric', titrant: 'NaOH', stage: 1, particle: 'ampholyte', eqCat: 'acidic', indicator: 'methylOrange' },
  glycine: { exp: 'glycine', titrant: 'NaOH', stage: 1, particle: 'ampholyte', eqCat: 'neutral', indicator: 'bromothymolBlue' },
};

/** Vollständiger Ablauf eines Versuchs; gibt Kennwerte für weitere Prüfungen zurück */
async function fullRun(page, o) {
  const notes = [];
  await F.plan(page, PLANS[o.exp]);
  assert(await page.$('[data-view="lab"].btn:not([disabled])'), 'Labor nach geprüfter Planung nicht freigegeben');
  if (o.shots) await shot(page, o.shots + '-0-planung');
  await page.click('.phase[data-view="lab"]');
  await F.prepare(page);
  // Keine Zukunftskurve vor der ersten Messung
  await page.waitForTimeout(150);
  const ink0 = await F.curveInk(page, 'labChart');
  assert(ink0.blue < 5, 'Kurve zeigt vor der ersten Messung farbige Punkte: ' + JSON.stringify(ink0));
  const marked = await F.surveyRun(page, o.eqs, o.vEnd, o.endpoint);
  if (o.endpoint) assert(marked, 'Endpunkt wurde nicht notiert');
  if (o.shots) await shot(page, o.shots + '-1-erstdurchgang');
  const s1 = await page.evaluate(() => Halbtitration.App.activeSeries());
  if (s1.endpoint) {
    const rEnd = await F.fillField(page, 'read_end_' + s1.id, de(s1.endpoint.reading));
    assert(rEnd.status === 'ok', 'Endstand-Ablesung nicht akzeptiert');
  }
  await F.finishSeries(page);

  await page.click('.phase[data-view="eval"]');
  for (let j = 1; j <= o.eqs.length; j++) {
    const r = await F.fillField(page, 'veq' + j, de(o.eqs[j - 1]));
    assert(r.status === 'ok', 'V(ÄP,' + j + ') nicht akzeptiert: ' + JSON.stringify(r));
  }
  await F.setMarker(page, 'eq1', o.markers[0]);
  if (o.markers[1]) await F.setMarker(page, 'eq2', o.markers[1]);
  if (s1.endpoint) {
    const c = await F.fillField(page, 'cons_' + s1.id, de(s1.endpoint.reading - s1.startReading));
    assert(c.status === 'ok', 'Verbrauch nicht akzeptiert: ' + JSON.stringify(c));
  }
  if (o.derived) await page.selectOption('#basis2', 'derived');
  const halves = [o.markers[0] / 2];
  if (o.eqs.length > 1) halves.push(o.derived ? (o.markers[0] + 2 * o.markers[0]) / 2 : (o.markers[0] + o.markers[1]) / 2);
  for (let j = 1; j <= halves.length; j++) {
    const r = await F.fillField(page, 'vhalf' + j, de(halves[j - 1]));
    assert(r.status === 'ok', 'V(HÄP,' + j + ') nicht akzeptiert: ' + JSON.stringify(r));
  }
  if (o.shots) await shot(page, o.shots + '-2-auswertung-erstdurchgang');

  // Zweiter Durchgang: frische Probe, Erstdurchgang bleibt
  await page.click('.phase[data-view="lab"]');
  await F.newSample(page, 'half');
  await F.prepare(page);
  await page.fill('#targetIn', de(halves[0]));
  await F.act(page, 'set-target');
  await F.waitStable(page);
  await F.act(page, 'take');
  const targets = halves.map((h) => Math.round(h * 20) / 20); // auf Tropfengröße
  for (const t of targets) {
    await F.doseTo(page, Math.floor(t - 0.5), 2);
    await F.doseTo(page, t, 0.5);
  }
  const series = await page.evaluate(() => Halbtitration.App.es().series.map((s) => ({ kind: s.kind, n: s.points.length })));
  assert(series.length === 2 && series[0].kind === 'survey' && series[0].n > 10 && series[1].kind === 'half', 'Erste Messreihe nicht erhalten: ' + JSON.stringify(series));
  const ink = await F.curveInk(page, 'labChart');
  if (o.shots) await shot(page, o.shots + '-3-halbtitration');
  notes.push('Kurvenpixel blau/orange ' + ink.blue + '/' + ink.orange);

  await page.click('.phase[data-view="eval"]');
  const pts = await page.evaluate(() => Halbtitration.App.es().series.find((q) => q.kind === 'half').points);
  const pHs = [];
  for (let j = 1; j <= halves.length; j++) {
    const p = pts.find((q) => Math.abs(q.v - targets[j - 1]) < 1e-6);
    assert(p, 'Kein Messpunkt am Zielvolumen ' + targets[j - 1]);
    pHs.push(p.pH);
    const r = await F.fillField(page, 'phhalf' + j, de(p.pH));
    assert(r.status === 'ok' || r.status === 'measured-note', 'pH(HÄP) nicht akzeptiert: ' + JSON.stringify(r));
  }
  for (const [key, value, expect] of o.pk(pHs)) {
    const r = await F.fillField(page, 'pk_' + key, value);
    assert(r.status === expect, key + ': erwartet ' + expect + ', erhalten ' + JSON.stringify(r));
  }
  // Vor der Abgabe: keine Literatur im Journal, Modelloptionen gesperrt, Bericht ohne Referenzen
  const before = await page.evaluate(() => ({ journal: document.getElementById('journal').innerText, model: document.getElementById('evModel').disabled }));
  assert(before.model, 'Modellreferenz vor der Abgabe nicht gesperrt');
  assert(!/Martell|Quelle:/.test(before.journal), 'Literatur vor der Abgabe sichtbar');
  await page.evaluate(() => Halbtitration.Journal.report());
  const rep0 = await page.evaluate(() => document.getElementById('report').innerText);
  assert(!/Martell|pKₛ\d? = \d/.test(rep0), 'Bericht vor Abgabe enthält Literaturwerte');
  await F.act(page, 'submit');
  await F.confirm(page);
  const lit = await page.evaluate(() => document.getElementById('journal').innerText);
  assert(/Martell/.test(lit), 'Literatur nach Abgabe nicht sichtbar');

  // Theoretische pH-Werte, Abweichungen, Fehlerbetrachtung
  const tps = await page.evaluate(() => Halbtitration.Evaluation.theoryPoints(Halbtitration.App.exp()).map((p) => ({ key: p.key, main: p.main })));
  for (const p of tps) {
    const r = await F.fillField(page, 'th_' + p.key, de(p.main));
    assert(r.status === 'ok', 'th_' + p.key + ' nicht akzeptiert: ' + JSON.stringify(r));
  }
  const tasks = await page.evaluate(() => Halbtitration.Evaluation.pkTasks(Halbtitration.App.exp()).map((t) => ({ key: t.key, lit: Halbtitration.Evaluation.literatureValue(Halbtitration.App.exp(), t.key), own: Number(Halbtitration.App.es().fields['pk_' + t.key].input.replace(',', '.')) })));
  for (const t of tasks) {
    const d = t.own - t.lit;
    const r = await F.fillField(page, 'dpk_' + t.key, de(d));
    assert(r.status === 'ok', 'ΔpK nicht akzeptiert: ' + JSON.stringify(r));
    if (Math.abs(d) > 0.02) {
      const w = await F.fillField(page, 'dpk_' + t.key, de(-d));
      assert(w.status === 'wrong' && /Vorzeichen/.test(w.message), 'Vorzeichenfehler nicht erkannt');
      await F.fillField(page, 'dpk_' + t.key, de(d));
    }
  }
  const dphIds = await page.$$eval('[data-field^="dph_"]', (els) => els.map((e) => e.dataset.field));
  for (const id of dphIds) {
    const vals = await page.evaluate((i) => { const t = i.slice(4); const J = Halbtitration.App.es().fields; return { th: Number(J['th_' + t].input.replace(',', '.')), label: document.querySelector('[data-field="' + i + '"] .sub').innerText }; }, id);
    const meas = Number(/pH\(gem\.\) = ([\d,]+)/.exec(vals.label)[1].replace(',', '.'));
    const r = await F.fillField(page, id, de(meas - vals.th));
    assert(r.status === 'ok', id + ' nicht akzeptiert: ' + JSON.stringify(r));
  }
  for (const c of o.causes) await page.check(`input[name="cause"][value="${c}"]`);
  await F.act(page, 'causes-check');
  await page.fill('#reflText', 'Testbegründung: Abweichung am HÄP.');
  await page.dispatchEvent('#reflText', 'change');
  await page.check('#evModel'); await page.check('#evLit'); await page.check('#evApprox');
  if (o.shots) {
    await page.evaluate(() => { document.getElementById('journal').scrollTop = 99999; });
    await shot(page, o.shots + '-4-freigabe-modell');
  }
  await page.evaluate(() => Halbtitration.Journal.report());
  await page.waitForFunction(() => window.__printed >= 2);
  const rep = await page.evaluate(() => ({ text: document.getElementById('report').innerText, img: !!document.querySelector('#report img'), printed: window.__printed }));
  assert(/Martell/.test(rep.text) && rep.img && rep.printed >= 2, 'Bericht nach Freigabe unvollständig');
  return { pHs, notes };
}

const scenarios = {
  // ---------------------------------------------------------------- vollständige Abläufe je Stoff
  async E1(browser) {
    const page = await newPage(browser);
    await fresh(page);
    await shot(page, '01-start-theorie');
    // Verständnisfrage: falsch, Tipp, richtig
    await page.check('input[name="q1"][value="a"]');
    await F.act(page, 'q-check', '[data-q="q1"]');
    assert(await page.$('[data-q="q1"] .fb.bad'), 'Falsche Antwort nicht markiert');
    await F.act(page, 'hint', '[data-id="q1"]');
    await page.check('input[name="q1"][value="b"]');
    await F.act(page, 'q-check', '[data-q="q1"]');
    assert(await page.$('[data-q="q1"] .fb.ok'), 'Richtige Antwort nicht markiert');
    const r = await fullRun(page, {
      exp: 'acetic', eqs: [24], vEnd: 28, markers: [24], endpoint: { pH: 8.4, dir: 1 }, shots: '1-essigsaeure',
      pk: (pHs) => [['pKs1', de(14 - pHs[0]), 'wrong'], ['pKs1', de(pHs[0]), 'ok']],
      causes: ['approx', 'activity'],
    });
    const rel = await page.evaluate(() => document.querySelector('label.opt.is-bad') ? 'activity markiert' : 'ok');
    return { pHs: r.pHs, notes: r.notes.concat(rel), errors: page.__errors };
  },
  async E2(browser) {
    const page = await newPage(browser);
    await fresh(page);
    const r = await fullRun(page, {
      exp: 'ammonia', eqs: [18], vEnd: 22, markers: [18], endpoint: { pH: 5.1, dir: -1 }, shots: '2-ammoniak',
      pk: (pHs) => [['pKb', de(pHs[0]), 'wrong'], ['pKb', de(14 - pHs[0]), 'ok'], ['pKsNH4', de(pHs[0]), 'ok']],
      causes: ['approx'],
    });
    // Ammoniak: Literaturlinie auf der pH-Achse heißt pKₛ(NH₄⁺) – keine pK_B-Markierung auf der pH-Achse
    const litLabels = await page.evaluate(() => Halbtitration.Journal.chart().litLines.map((l) => l.label + ' @ ' + l.pH));
    assert(litLabels.length === 1 && /NH₄⁺/.test(litLabels[0]) && !/K_?B|pKb/i.test(litLabels[0]), 'Falsche Literaturlinie im Ammoniakversuch: ' + litLabels);
    const tries = await page.evaluate(() => Halbtitration.App.es().fields.pk_pKb.tries);
    assert(tries >= 2, 'pK_B-Fehlversuch nicht protokolliert');
    return { pHs: r.pHs, notes: r.notes.concat(litLabels), errors: page.__errors };
  },
  async E3(browser) {
    const page = await newPage(browser);
    await fresh(page);
    // Fehlerbilder der Mehrprotonigen
    await F.plan(page, PLANS.phosphoric);
    await page.click('.phase[data-view="eval"]');
    const w1 = await F.fillField(page, 'veq2', '10,00');
    assert(w1.status === 'wrong' && /Stufenfaktor/.test(w1.message), 'Stufenfaktor-Fehler nicht erkannt');
    await page.selectOption('#basis2', 'stoich');
    await F.fillField(page, 'veq1', '10,00');
    await F.fillField(page, 'veq2', '20,00');
    const w2 = await F.fillField(page, 'vhalf2', '10,00');
    assert(w2.status === 'wrong' && /V\(ÄP,2\)\/2/.test(w2.message), 'V(ÄP,2)/2-Fehler nicht erkannt: ' + JSON.stringify(w2));
    await page.selectOption('#basis2', 'measured');
    await page.evaluate(() => { const f = Halbtitration.App.es().fields; delete f.vhalf2; delete f.veq1; delete f.veq2; });
    const r = await fullRun(page, {
      exp: 'phosphoric', eqs: [10, 20], vEnd: 26, markers: [10, 20.1], endpoint: { pH: 3.9, dir: 1 }, shots: '3-phosphorsaeure',
      pk: (pHs) => [['pKs1', de(pHs[0]), 'ok'], ['pKs2', de(pHs[1]), 'ok']],
      causes: ['approx'],
    });
    // Startpunkt mit einfacher Näherung: rechnerisch richtig, aber außerhalb der Gültigkeit
    const a = await F.fillField(page, 'th_start', '1,92');
    assert(a.status === 'approx', 'Gültigkeitsgrenze der Näherung nicht erkannt: ' + JSON.stringify(a));
    assert(r.pHs[0] - 2.15 > 0.2, 'HÄP 1 der Phosphorsäure künstlich auf pKₛ1 gesetzt: ' + r.pHs[0]);
    return { pHs: r.pHs, notes: r.notes, errors: page.__errors };
  },
  async E4(browser) {
    const page = await newPage(browser);
    await fresh(page);
    const r = await fullRun(page, {
      exp: 'glycine', eqs: [12, 24], vEnd: 28, markers: [12], derived: true, endpoint: { pH: 7.0, dir: 1 }, shots: '4-glycin',
      pk: (pHs) => [['pKs1', de(pHs[0]), 'ok'], ['pKs2', de(14 - pHs[1]), 'wrong'], ['pKs2', de(pHs[1]), 'ok']],
      causes: ['approx'],
    });
    const basis = await page.evaluate(() => document.querySelector('[data-basis="half2"]').closest('.field').innerText);
    assert(/abgeleitet/.test(basis), 'Abgeleitetes V(ÄP,2) nicht gekennzeichnet');
    await page.click('.phase[data-view="lab"]');
    const sp = await page.$eval('#speciesBox', (e) => e.innerText);
    assert(/H₃N⁺–CH₂–COO⁻/.test(sp) && /Cl⁻/.test(sp), 'Glycin-Spezies oder Gegenion fehlen: ' + sp);
    assert(r.pHs[0] - 2.35 > 0.1, 'HÄP 1 des Glycins künstlich auf pKₛ1 gesetzt');
    return { pHs: r.pHs, notes: r.notes, errors: page.__errors };
  },

  // ---------------------------------------------------------------- Sonderfälle der Durchführung
  async E5(browser) {
    const page = await newPage(browser);
    await fresh(page);
    await F.plan(page, PLANS.acetic);
    await page.click('.phase[data-view="lab"]');
    // Ohne Anfangsstand keine Zugabe
    await F.act(page, 'pipette');
    await F.waitFor(page, () => Halbtitration.App.lab().sampleReady);
    // Elektrode ohne Verdünnung und ohne Kalibrierung verweigert
    await F.act(page, 'electrode');
    assert(!(await page.evaluate(() => Halbtitration.App.lab().electrodeIn)), 'Elektrode ohne Kalibrierung eingetaucht');
    await page.fill('#f-' + (await F.startFieldId(page)), '');
    await F.act(page, 'water');
    await F.waitFor(page, () => Halbtitration.App.lab().waterReady);
    await F.act(page, 'rinse'); await F.act(page, 'fill');
    await F.act(page, 'dose');
    assert((await F.labState(page)).v === 0, 'Dosierung trotz Luftblase/fehlendem Anfangsstand');
    await F.act(page, 'purge');
    await F.act(page, 'dose');
    assert((await F.labState(page)).v === 0, 'Dosierung ohne Anfangsstand');
    // Ablesefehler beim Anfangsstand
    const wrongRead = await F.fillField(page, await F.startFieldId(page), '0,00');
    assert(wrongRead.status === 'wrong', 'Falscher Anfangsstand nicht erkannt');
    await F.prepare(page, { stir: false });
    // Ohne Rühren: Anzeige wird lange nicht stabil, Wert weicht ab
    await F.waitStable(page); await F.act(page, 'take');
    await F.setDose(page, 2); await F.act(page, 'dose');
    await F.waitSettled(page);
    const noStir = await F.labState(page);
    assert(!noStir.stable && noStir.unmixed > 0.5, 'Ohne Rühren sofort homogen/stabil: ' + JSON.stringify(noStir));
    // Zu frühe Übernahme
    await F.act(page, 'take');
    const early = await page.evaluate(() => Halbtitration.App.activeSeries().points.slice(-1)[0]);
    assert(!early.stable, 'Zu frühe Übernahme nicht als instabil gekennzeichnet');
    await page.waitForTimeout(200);
    await shot(page, '5-ohne-ruehren');
    await F.act(page, 'stir');
    await F.waitStable(page);
    const after = await F.labState(page);
    assert(Math.abs(after.pH - early.pH) >= 0.02, 'Durchmischung ändert die Anzeige nicht');
    // Überschießen in der Halbtitration
    await F.finishSeries(page);
    await F.newSample(page, 'half');
    await F.prepare(page);
    await page.fill('#targetIn', '12,00'); await F.act(page, 'set-target');
    await F.doseTo(page, 10, 2);
    await F.doseTo(page, 11, 1);
    await F.setDose(page, 2); await F.act(page, 'dose');
    await page.waitForSelector('.toast.warn:has-text("Zielmarke")');
    await F.waitStable(page); await F.act(page, 'take');
    // Neue Probe löscht keine Reihen; Messreihe wiederholen verwirft nur die aktive
    await F.newSample(page, 'half');
    let n = await page.evaluate(() => Halbtitration.App.es().series.length);
    assert(n === 3, 'Neue Probe hat Messreihen verändert: ' + n);
    await F.prepare(page);
    await F.waitStable(page); await F.act(page, 'take');
    await F.act(page, 'repeat'); await F.confirm(page);
    n = await page.evaluate(() => Halbtitration.App.es().series.length);
    assert(n === 3, 'Messreihe wiederholen hat falsch gezählt: ' + n);
    const ptsNew = await page.evaluate(() => Halbtitration.App.activeSeries().points.length);
    assert(ptsNew === 0, 'Wiederholte Messreihe nicht leer');
    // Neuladen: Zustand wiederherstellen
    await F.fillField(page, await F.startFieldId(page), '9,99', false);
    await page.reload();
    await page.waitForSelector('#labPanel .box');
    const restored = await page.evaluate(() => ({ view: Halbtitration.App.state.view, n: Halbtitration.App.es().series.length, cal: Halbtitration.App.lab().calibration, filled: Halbtitration.App.lab().burette.filled, input: document.querySelector('[data-field^="read_start_"] input').value }));
    assert(restored.view === 'lab' && restored.n === 3 && restored.cal === 2 && restored.filled && restored.input === '9,99', 'Wiederherstellung unvollständig: ' + JSON.stringify(restored));
    // Versuchswechsel und zurück
    await F.plan(page, PLANS.glycine);
    await page.click('[data-action="choose-exp"][data-id="acetic"]');
    const back = await page.evaluate(() => Halbtitration.App.es().series.length);
    assert(back === 3, 'Versuchswechsel verliert Messreihen');
    // Gesamtes Labor zurücksetzen
    await F.act(page, 'reset-menu');
    await page.click('#modalActions .btn.warn');
    await F.confirm(page);
    const all = await page.evaluate(() => Halbtitration.Chemistry.EXPERIMENT_IDS.map((id) => Halbtitration.App.state.exps[id].series.length).reduce((a, b) => a + b, 0));
    assert(all === 0, 'Zurücksetzen unvollständig');
    return { errors: page.__errors };
  },

  // ---------------------------------------------------------------- Indikatorwahl und Datenlücke
  async E6(browser) {
    const page = await newPage(browser);
    await fresh(page);
    // Unpassender Indikator: Methylorange bei Essigsäure – Planung meldet Widerspruch, Labor bleibt möglich
    await F.plan(page, Object.assign({}, PLANS.acetic, { indicator: 'methylOrange' }));
    const fb = await page.$eval('#planDoc', (e) => e.innerText);
    assert(/nicht im erwarteten pH-Bereich/.test(fb), 'Unpassender Indikator ohne Hinweis');
    await page.click('.phase[data-view="lab"]');
    await F.prepare(page);
    await F.waitStable(page); await F.act(page, 'take');
    // grob messen: Datenlücke am ÄP
    for (let i = 0; i < 14; i++) await F.doseAndTake(page, 2);
    await F.finishSeries(page);
    await page.click('.phase[data-view="eval"]');
    await F.fillField(page, 'veq1', '24,00');
    await F.setMarker(page, 'eq1', 23.0);
    const j = await page.$eval('#journal', (e) => e.innerText);
    assert(/Datenlücke/.test(j), 'Datenlücke am ÄP nicht gemeldet');
    assert(/ungeeignet/.test(j), 'Methylorange bei Essigsäure nicht als ungeeignet bewertet');
    // pH-metrisch ohne Indikator: kein Endpunkt-Knopf
    await F.plan(page, Object.assign({}, PLANS.acetic, { indicator: 'none', reasons: ['phmetric'] }));
    await page.click('.phase[data-view="lab"]');
    await F.newSample(page, 'survey');
    assert(!(await page.$('[data-action="endpoint"]')), 'Endpunkt-Knopf ohne Indikator');
    assert(!(await page.$('[data-action="indicator"]')), 'Indikatorzugabe ohne Indikator');
    // Halbtitrations-pH ohne Messpunkt → Datenlücke
    await page.click('.phase[data-view="eval"]');
    const g = await F.fillField(page, 'phhalf1', '4,76');
    assert(g.status === 'gap', 'Fehlende Halbtitration nicht als Datenlücke erkannt: ' + JSON.stringify(g));
    // Dezimalkomma, Einheiten, ungültige Eingaben
    const u = await F.fillField(page, 'veq1', '0,024 L');
    assert(u.status === 'ok', 'Einheit L nicht umgerechnet');
    const bad = await F.fillField(page, 'veq1', '24,0,0');
    assert(bad.status === 'invalid', 'Ungültige Eingabe akzeptiert');
    const empty = await F.fillField(page, 'veq1', '');
    assert(empty.status === 'empty', 'Leere Eingabe nicht erkannt');
    return { errors: page.__errors };
  },

  // ---------------------------------------------------------------- Speicherfehler
  async E7(browser) {
    const page = await newPage(browser, { init: () => { Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; } });
    await page.goto(`${BASE}?speed=25`);
    await F.plan(page, PLANS.acetic);
    await page.waitForSelector('.toast.warn');
    await page.click('.phase[data-view="lab"]');
    await F.prepare(page);
    await F.waitStable(page); await F.act(page, 'take');
    const n = await page.evaluate(() => Halbtitration.App.activeSeries().points.length);
    assert(n === 1, 'App ohne Speicher nicht bedienbar');
    return { errors: page.__errors };
  },

  // ---------------------------------------------------------------- Animation in Echtzeit
  async E8(browser) {
    const page = await newPage(browser);
    await fresh(page, 25);
    await F.plan(page, PLANS.acetic);
    await page.click('.phase[data-view="lab"]');
    await F.prepare(page);
    await F.waitStable(page); await F.act(page, 'take');
    await F.doseTo(page, 22, 2);
    await F.doseTo(page, 23.8, 0.2);
    // Echtzeit für die Animationsnachweise
    await page.evaluate(() => { Halbtitration.App.lab().timeScale = 1; });
    await F.setDose(page, 0.2);
    await F.act(page, 'dose');
    const frames = [];
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(90);
      frames.push(await page.evaluate(() => { const l = Halbtitration.App.lab(); const r = Halbtitration.App.renderer; return { t: l.time, hanging: l.hanging, drops: l.drops.length, plumes: r.plumes.length, delivered: l.delivered, wave: Math.max.apply(null, Array.from(r.waveH).map(Math.abs)) }; }));
      if (i === 9) await shot(page, '6-tropfen-schliere');
    }
    assert(frames.some((f) => f.drops > 0), 'Kein fallender Tropfen beobachtet');
    assert(frames.some((f) => f.plumes > 0), 'Keine Mischschliere beobachtet');
    assert(frames.some((f) => f.wave > 0.2), 'Kein Oberflächenimpuls beobachtet');
    assert(frames[frames.length - 1].delivered > frames[0].delivered, 'Volumen steigt nicht schrittweise');
    // Hahn offen: Fließen
    await page.waitForTimeout(1500);
    await F.act(page, 'valve');
    await page.waitForTimeout(600);
    await shot(page, '7-hahn-offen');
    await F.act(page, 'valve');
    // Ruhende Flüssigkeit ohne Rührer: keine Dauerwellen
    await F.act(page, 'stir');
    await page.waitForTimeout(6000);
    const calm = await page.evaluate(() => Math.max.apply(null, Array.from(Halbtitration.App.renderer.waveH).map(Math.abs)));
    assert(calm < 0.05, 'Ruhende Flüssigkeit zeigt Wellen: ' + calm);
    // Tastatur: D = Zugabe, M = Messwert
    await page.evaluate(() => { Halbtitration.App.lab().timeScale = 25; document.activeElement.blur(); });
    const n0 = await page.evaluate(() => Halbtitration.App.activeSeries().points.length);
    await F.setDose(page, 'drop');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('d');
    await F.waitSettled(page); await F.waitStable(page);
    await page.keyboard.press('m');
    const n1 = await page.evaluate(() => Halbtitration.App.activeSeries().points.length);
    assert(n1 === n0 + 1, 'Tastaturbedienung D/M wirkt nicht');
    return { frames: frames.map((f) => [f.drops, f.plumes, +f.wave.toFixed(2)].join('/')), calm, errors: page.__errors };
  },

  // ---------------------------------------------------------------- Tablet-Größen (Emulation) und Trennlinie
  async E9(browser) {
    const out = {};
    for (const vp of [{ width: 1440, height: 900, name: 'desktop-1440x900', touch: false }, { width: 1180, height: 820, name: 'tablet-1180x820', touch: true }, { width: 1024, height: 768, name: 'tablet-1024x768', touch: true }]) {
      const page = await newPage(browser, { viewport: vp, touch: vp.touch });
      await fresh(page);
      await F.plan(page, PLANS.phosphoric);
      await page.click('.phase[data-view="lab"]');
      await F.prepare(page);
      await F.surveyRun(page, [10], 12);
      if (vp.touch) {
        // Antippen des Hahns auf der Grafik öffnet und schließt
        const pos = await page.evaluate(() => { const G = Halbtitration.Geometry.LAYOUT.burette; const p = Halbtitration.App.renderer.toScreen(G.x - 20, G.stopcockY); const r = document.getElementById('labCanvas').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; });
        await page.touchscreen.tap(pos.x, pos.y);
        await page.waitForTimeout(100);
        const open = await page.evaluate(() => Halbtitration.App.lab().valveOpen);
        await page.touchscreen.tap(pos.x, pos.y);
        assert(open, 'Antippen des Hahns wirkt nicht (' + vp.name + ')');
      }
      await F.waitSettled(page);
      const m = await page.evaluate(() => {
        const small = Array.from(document.querySelectorAll('#labPanel button, .phase, .tb')).filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43.5).map((b) => b.textContent.trim().slice(0, 30));
        return { overflow: document.documentElement.scrollWidth - window.innerWidth, small, lab: document.getElementById('labCanvas').getBoundingClientRect().width, chart: document.getElementById('labChart').getBoundingClientRect().width };
      });
      assert(m.overflow <= 0, 'Horizontale Überbreite ' + m.overflow + ' px bei ' + vp.name);
      assert(!m.small.length, 'Zu kleine Touchziele bei ' + vp.name + ': ' + m.small.join(', '));
      await shot(page, '8-labor-' + vp.name);
      await page.click('.phase[data-view="eval"]');
      await F.setMarker(page, 'eq1', 10);
      await page.waitForTimeout(200);
      const m2 = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth }));
      assert(m2.overflow <= 0, 'Überbreite in der Auswertung bei ' + vp.name);
      await shot(page, '9-auswertung-' + vp.name);
      // Trennlinie per Tastatur
      if (!vp.touch) {
        const w0 = await page.$eval('#journal', (e) => e.getBoundingClientRect().width);
        await page.focus('#evalSplitter');
        await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
        const w1 = await page.$eval('#journal', (e) => e.getBoundingClientRect().width);
        assert(w1 > w0 + 30, 'Trennlinie reagiert nicht auf Pfeiltasten');
        const sp = await page.$eval('#evalSplitter', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        await page.mouse.move(sp.x, sp.y); await page.mouse.down(); await page.mouse.move(sp.x + 80, sp.y, { steps: 5 }); await page.mouse.up();
        const w2 = await page.$eval('#journal', (e) => e.getBoundingClientRect().width);
        assert(w2 < w1 - 50, 'Trennlinie reagiert nicht auf Ziehen');
      }
      out[vp.name] = { lab: Math.round(m.lab), chart: Math.round(m.chart), errors: page.__errors };
      await page.context().close();
    }
    // Planung und Journal-Bildschirmfotos (Desktop)
    return out;
  },
};

const browser = await chromium.launch({ channel: 'msedge' });
const server = await serve(ROOT, PORT);
console.log('Prüfe ' + ROOT);
for (const [name, fn] of Object.entries(scenarios)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  const t0 = Date.now();
  try {
    const detail = await fn(browser);
    const errs = [].concat(detail && detail.errors || []);
    Object.values(detail || {}).forEach((v) => { if (v && v.errors) errs.push(...v.errors); });
    results.push({ name, status: errs.length ? 'HOLD – failed' : 'PASS', seconds: Math.round((Date.now() - t0) / 1000), detail, errors: errs });
    console.log(name, errs.length ? 'FEHLER ' + errs.join(' | ') : 'PASS', Math.round((Date.now() - t0) / 1000) + ' s');
  } catch (e) {
    results.push({ name, status: 'HOLD – failed', seconds: Math.round((Date.now() - t0) / 1000), error: e.message });
    try { fs.mkdirSync(path.join(APP, '.work'), { recursive: true }); await lastPage.screenshot({ path: path.join(APP, '.work', 'fail-' + name + '.png') }); } catch (err) { /* Seite geschlossen */ }
    const where = (e.stack || '').split('\n').find((l) => /run\.mjs|flow\.mjs/.test(l)) || '';
    console.log(name, 'HOLD – failed:', e.message.split('\n').slice(0, 3).join(' / '), where.trim());
  }
}
await browser.close();
server.close();
const file = path.join(HERE, ONLY.length ? 'results-partial.json' : 'results.json');
fs.writeFileSync(file, JSON.stringify({ root: path.relative(APP, ROOT) || '.', date: new Date().toISOString(), browser: 'Microsoft Edge (Playwright channel msedge)', results }, null, 2));
console.log('Ergebnis: ' + results.filter((r) => r.status === 'PASS').length + '/' + results.length + ' PASS → ' + path.relative(APP, file));
process.exit(results.every((r) => r.status === 'PASS') ? 0 : 1);
