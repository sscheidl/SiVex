// Browserprüfung des Halbtitrationslabors 0.2.0 (Edge über Playwright).
// Bedient die Anwendung über die Oberfläche wie Lernende, prüft Zustände und
// erzeugt Screenshot-Nachweise in docs/screenshots.
//
// Aufruf: node tests/e2e/run.mjs            (alle Szenarien)
//         ONLY=E1,E8 node tests/e2e/run.mjs (Auswahl)
// Zeitraffer: Die Labor-Physik läuft im Test mit ?speed=25 (gleiches Verhalten,
// nur schneller); E8 prüft Animationen in Echtzeit.
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
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, hasTouch: !!opts.touch, deviceScaleFactor: 1 });
  if (opts.init) await ctx.addInitScript(opts.init);
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const page = await ctx.newPage();
  lastPage = page;
  page.setDefaultTimeout(25000);
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.__errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(`http://localhost:${PORT}/`) && !/^(data|blob):/.test(r.url())) page.__errors.push('externe Anfrage: ' + r.url()); });
  return page;
}

async function fresh(page, speed = 25) {
  await page.goto(`${BASE}?speed=${speed}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}?speed=${speed}`);
  await page.waitForSelector('.step[data-step="start"]');
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const field = (page, id) => page.evaluate((i) => Halbtitration.Tasks.current(i).status, id);

/** Kernablauf eines Versuchs bis zur Abgabe; o.stages: Marker, Zielvolumina, Prüferwartungen */
async function coreRun(page, o) {
  await F.chooseExp(page, o.exp);
  const t = await F.chooseTitrant(page, o.titrant);
  assert(t === 'ok', 'Maßlösung nicht akzeptiert');
  await F.prepare(page, { indicator: o.indicator || null });
  await page.waitForTimeout(100);
  const ink0 = await F.curveInk(page, 'chart');
  assert(ink0.blue < 5, 'Kurve zeigt vor der ersten Messung Punkte');
  await F.surveyRun(page, o.eqs, o.vEnd, o.endpoint);
  if (o.shots) await shot(page, o.shots + '-1-kurve');
  await F.openStep(page, 'curve');
  for (let j = 1; j <= o.markers.length; j++) {
    const r = await F.fillField(page, 'eqm' + j, de(o.markers[j - 1]));
    assert((o.markerExpect || [])[j - 1] ? r.current === o.markerExpect[j - 1] : r.current === 'ok', 'ÄP-Marker ' + j + ': ' + JSON.stringify(r));
  }
  await F.openStep(page, 'half');
  await F.answerAll(page, 'half');
  await F.openStep(page, 'target');
  if (o.derived) await page.selectOption('#basis2', 'derived');
  for (let j = 1; j <= o.halves.length; j++) {
    const r = await F.fillField(page, 'vhalf' + j, de(o.halves[j - 1]));
    assert(r.current === 'ok', 'V(HÄP,' + j + ') nicht akzeptiert: ' + JSON.stringify(r));
  }
  await F.openStep(page, 'measure');
  await page.click('.step[data-step="measure"] [data-action="new-sample"]');
  if (await page.$('#modal:not([hidden])')) await F.confirm(page);
  await F.prepare(page);
  await page.click('.step[data-step="measure"] [data-action="set-target"]');
  await F.waitStable(page);
  await F.waitPoint(page);
  for (const h of o.halves) { await F.doseTo(page, Math.floor(h - 0.5), 2); await F.doseTo(page, h, 0.5); }
  const ser = await page.evaluate(() => Halbtitration.App.es().series.map((s) => ({ kind: s.kind, n: s.points.length })));
  assert(ser.some((s) => s.kind === 'survey' && s.n > 10) && ser.some((s) => s.kind === 'half'), 'Erste Messreihe nicht erhalten: ' + JSON.stringify(ser));
  if (o.shots) await shot(page, o.shots + '-2-halbtitration');
  await F.openStep(page, 'measure');
  const pts = await page.evaluate(() => Halbtitration.Tasks.half().points);
  const pHs = [];
  for (let j = 1; j <= o.halves.length; j++) {
    const p = pts.find((q) => Math.abs(q.v - o.halves[j - 1]) < 1e-6);
    assert(p, 'kein Messpunkt am Ziel');
    pHs.push(p.pH);
    const r = await F.fillField(page, 'phhalf' + j, de(p.pH));
    assert(r.current === 'ok', 'pH(HÄP) nicht bestätigt: ' + JSON.stringify(r));
  }
  await F.openStep(page, 'why');
  await F.answerAll(page, 'why');
  if (o.shots) await shot(page, o.shots + '-3-trainer');
  await F.openStep(page, 'result');
  for (const [key, val, expect] of o.pk(pHs)) {
    const r = await F.fillField(page, 'pk_' + key, val);
    assert(r.current === expect, key + ': erwartet ' + expect + ', erhalten ' + JSON.stringify(r));
  }
  // vor der Abgabe: keine Literatur, keine Modellschalter
  const pre = await page.evaluate(() => ({ text: document.getElementById('panelBody').innerText, model: !!document.getElementById('chkModel') }));
  assert(!/Martell|Quelle:/.test(pre.text) && !pre.model, 'Literatur/Modell vor der Abgabe sichtbar');
  await F.act(page, 'submit');
  await F.confirm(page);
  const sb = await page.evaluate(() => Halbtitration.App.es().submission);
  assert(sb && sb.series, 'Abgabe nicht gespeichert');
  await F.openStep(page, 'compare');
  const lit = await page.evaluate(() => document.getElementById('panelBody').innerText);
  assert(/Martell/.test(lit), 'Literatur nach Abgabe nicht sichtbar');
  const tasks = await page.evaluate(() => Halbtitration.Evaluation.pkTasks(Halbtitration.App.exp()).map((t) => ({ key: t.key, lit: Halbtitration.Evaluation.literatureValue(Halbtitration.App.exp(), t.key) })));
  for (const tk of tasks) {
    const own = sb.values[tk.key];
    const r = await F.fillField(page, 'dpk_' + tk.key, de(own - tk.lit));
    assert(r.current === 'ok', 'ΔpK nicht akzeptiert: ' + JSON.stringify(r));
  }
  for (const c of o.causes || []) await page.check(`input[name="cause"][value="${c}"]`);
  await F.act(page, 'causes-check');
  return { pHs, sb };
}

const scenarios = {
  // ---------------------------------------------------------------- Essigsäure: Kernlernweg
  async E1(browser) {
    const page = await newPage(browser);
    await fresh(page);
    // Start im Labor: Auftrag, leere Kurve, kein Theorieblock
    const start = await page.evaluate(() => ({ task: document.querySelector('.step[data-step="start"]').innerText, tab: document.querySelector('.lk-tabs [aria-selected="true"]').dataset.tab, theory: !!document.querySelector('[data-view="theory"]') }));
    assert(/Bestimme den pKₛ-Wert einer Essigsäurelösung/.test(start.task) && start.tab === 'task' && !start.theory, 'Start nicht im Labor mit Auftrag');
    await shot(page, '01-start');
    // Vorbereitung in Laborreihenfolge, Messwerterfassung standardmäßig automatisch
    const order = await page.$$eval('.deck .prep .pstep', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
    assert(/^1 Bürette/.test(order[0]) && /^2 pH-Meter/.test(order[1]) && /^3 Probe/.test(order[2]) && /^4 Indikator/.test(order[3]) && /^5 Rührer/.test(order[4]) && /^6 Elektrode/.test(order[5]), 'Reihenfolge der Vorbereitung: ' + order.join(' | '));
    assert(!(await page.$('[data-action="take"]')) && !(await page.$('[data-action="capture"]')), 'Knopf oder Umschalter für die Erfassung noch vorhanden');
    // falsche Maßlösung an der Bürette → Rückmeldung, Bürette bleibt leer
    assert((await F.chooseTitrant(page, 'HCl')) === 'wrong', 'falsche Maßlösung nicht erkannt');
    assert(!(await F.labState(page)).filled, 'Bürette trotz falscher Maßlösung gefüllt');
    assert(/passt nicht zu dieser Probe/.test(await page.$eval('.step[data-step="start"]', (e) => e.innerText)), 'Rückmeldung im Bedienfeld fehlt');
    // automatische Erfassung: Kurve wächst ohne Klick auf „Messwert übernehmen“
    assert((await F.chooseTitrant(page, 'NaOH')) === 'ok', 'richtige Maßlösung nicht akzeptiert');
    await F.prepare(page);
    await F.setDose(page, 1); await F.act(page, 'dose');
    await F.waitFor(page, () => Halbtitration.App.activeSeries().points.some((p) => p.v === 1 && p.stable));
    await F.act(page, 'repeat'); await F.confirm(page);
    // Geschlossene Frage: falsch → Tipp → Rückmeldung bleibt bei der Frage
    await F.openStep(page, 'half');
    assert((await F.answer(page, 'h1', 'a')) === 'wrong', 'falsche Antwort nicht markiert');
    await page.click('[data-action="hint"][data-id="q:h1"]');
    assert(await page.$('.q[data-q="h1"] .hint'), 'Tipp 1/3 fehlt');
    const r = await coreRun(page, {
      exp: 'acetic', titrant: 'NaOH', eqs: [24], vEnd: 28, markers: [24], halves: [12], shots: '1-essigsaeure',
      pk: (pHs) => [['pKs1', de(14 - pHs[0]), 'wrong'], ['pKs1', de(pHs[0]), 'ok']],
      causes: ['activity'],
    });
    await shot(page, '1-essigsaeure-4-vergleich');
    await page.click('.lk-tabs [data-tab="results"]');
    const res = await page.$eval('#panelBody', (e) => e.innerText);
    assert(/4,7\d \(abgegeben\)/.test(res) && /Lit\. 4,76/.test(res), 'Ergebnisübersicht unvollständig');
    await shot(page, '1-essigsaeure-5-ergebnisse');
    await page.click('.lk-tabs [data-tab="notebook"]');
    assert(/Halbäquivalenzpunkt/.test(await page.$eval('#panelBody', (e) => e.innerText)), 'Hefteintrag fehlt');
    // Bericht mit Kurve und Referenzen
    await page.click('.lk-head [data-action="report"]');
    await page.waitForFunction(() => window.__printed >= 1);
    const rep = await page.evaluate(() => ({ text: document.getElementById('report').innerText, img: !!document.querySelector('#report img') }));
    assert(/Martell/.test(rep.text) && rep.img, 'Bericht unvollständig');
    return { pHs: r.pHs, errors: page.__errors };
  },

  // ---------------------------------------------------------------- Ammoniak: Transfer
  async E2(browser) {
    const page = await newPage(browser);
    await fresh(page);
    const r = await coreRun(page, {
      exp: 'ammonia', titrant: 'HCl', eqs: [18], vEnd: 22, markers: [18], halves: [9], shots: '2-ammoniak',
      pk: (pHs) => [['pKb', de(pHs[0]), 'wrong'], ['pKb', de(14 - pHs[0]), 'ok'], ['pKsNH4', de(pHs[0]), 'ok']],
      causes: [],
    });
    const msg = await page.evaluate(() => Halbtitration.App.es().fields.pk_pKb.tries);
    assert(msg >= 2, 'pK_B-Fehlversuch fehlt');
    await page.check('#chkLit');
    const lines = await page.evaluate(() => Halbtitration.App.chart.litLines.map((l) => l.label));
    assert(lines.length === 1 && /NH₄⁺/.test(lines[0]) && !/K_?B|pKb/i.test(lines[0]), 'Falsche Literaturlinie: ' + lines);
    const trainer = await page.evaluate(() => Halbtitration.Content.trainer('ammonia').map((q) => q.options.find((o) => o.correct).text).join(' | '));
    assert(/pOH/.test(trainer) && /14,00 − pH/.test(trainer) && /NH₄⁺/.test(trainer), 'Basen-Zuordnung im Trainer fehlt');
    return { pHs: r.pHs, lines, errors: page.__errors };
  },

  // ---------------------------------------------------------------- Phosphorsäure: Vertiefung
  async E3(browser) {
    const page = await newPage(browser);
    await fresh(page);
    await F.chooseExp(page, 'phosphoric'); // direkt anwählbar, keine Sperre
    // V(ÄP,2)/2 als HÄP 2 wird erkannt
    await F.openStep(page, 'target');
    await page.selectOption('#basis2', 'stoich');
    await page.evaluate(() => { const f = Halbtitration.App.es().fields; f.veq1 = { input: '10,00' }; f.veq2 = { input: '20,00' }; });
    const w = await F.fillField(page, 'vhalf2', '10,00');
    assert(w.current === 'wrong' && /V\(ÄP,2\)\/2/.test(w.message), 'V(ÄP,2)/2-Fehler nicht erkannt');
    await page.selectOption('#basis2', 'measured');
    await page.evaluate(() => { const f = Halbtitration.App.es().fields; delete f.veq1; delete f.veq2; delete f.vhalf2; });
    // Speziesdarstellung: schematisch, keine falsche Mengenaussage
    await F.openStep(page, 'deep');
    const sp = await page.$eval('.step[data-step="deep"]', (e) => e.innerText);
    assert(/Schematische Reihenfolge/.test(sp) && !/geringen Anteilen/.test(sp) && /erscheinen nach der Abgabe/.test(sp), 'Speziesdarstellung irreführend: ' + sp.slice(0, 200));
    const r = await coreRun(page, {
      exp: 'phosphoric', titrant: 'NaOH', eqs: [10, 20], vEnd: 26, markers: [10, 20], halves: [5, 15], shots: '3-phosphorsaeure',
      pk: (pHs) => [['pKs1', de(pHs[0]), 'ok'], ['pKs2', de(pHs[1]), 'ok']],
      causes: ['approx'],
    });
    assert(r.pHs[0] - 2.15 > 0.2, 'HÄP 1 künstlich auf pKₛ₁ gesetzt');
    const cmp = await page.$eval('.step[data-step="compare"]', (e) => e.innerText);
    assert(/näherungsweise pK-Bestimmung/.test(cmp), 'Näherungsgrenze der 1. Stufe nicht erklärt');
    await F.openStep(page, 'deep');
    const alpha = await page.$$eval('.species div span:nth-child(2)', (els) => els.map((e) => Number(e.textContent.replace(' %', '').replace(',', '.'))));
    assert(alpha.length === 4 && Math.abs(alpha.reduce((a, b) => a + b, 0) - 100) < 0.5, 'Gleichgewichtsanteile nach Freigabe fehlerhaft: ' + alpha);
    await page.check('#chkModel'); await page.check('#chkLit'); await page.check('#chkApprox');
    await shot(page, '3-phosphorsaeure-4-vertiefung');
    return { pHs: r.pHs, errors: page.__errors };
  },

  // ---------------------------------------------------------------- Glycin: Vertiefung mit abgeleitetem ÄP 2
  async E4(browser) {
    const page = await newPage(browser);
    await fresh(page);
    const r = await coreRun(page, {
      exp: 'glycine', titrant: 'NaOH', indicator: 'bromothymolBlue', endpoint: { pH: 7.0, dir: 1 }, eqs: [12, 24], vEnd: 28, markers: [12, 24], markerExpect: ['ok', 'weak'], derived: true, halves: [6, 18], shots: '4-glycin',
      pk: (pHs) => [['pKs1', de(pHs[0]), 'ok'], ['pKs2', de(14 - pHs[1]), 'wrong'], ['pKs2', de(pHs[1]), 'ok']],
      causes: ['approx'],
    });
    await F.openStep(page, 'target');
    assert(/abgeleitet/.test(await page.$eval('.step[data-step="target"]', (e) => e.innerText)), 'Ableitung V(ÄP,2) nicht gekennzeichnet');
    await F.openStep(page, 'deep');
    const d = await page.$eval('.step[data-step="deep"]', (e) => e.innerText);
    assert(/Cl⁻ ist Gegenion/.test(d) && /H₃N⁺–CH₂–COO⁻/.test(d), 'Glycin-Spezies/Gegenion fehlen');
    assert(/Bromthymolblau/.test(d) && /Endpunkt notiert/.test(d), 'Indikatoruntersuchung fehlt');
    assert(r.pHs[0] - 2.35 > 0.1, 'HÄP 1 Glycin künstlich gesetzt');
    return { pHs: r.pHs, errors: page.__errors };
  },

  // ---------------------------------------------------------------- Befund A: veraltete Prüfzustände
  async E5(browser) {
    const page = await newPage(browser);
    await fresh(page);
    await F.openStep(page, 'curve');
    await page.click('.step[data-step="curve"] details summary');
    let r = await F.fillField(page, 'veq1', '24');
    assert(r.current === 'ok', 'V(ÄP) 24 nicht richtig');
    await page.fill('[data-field="veq1"] input', '30');
    const live = await page.evaluate(() => ({ cls: document.querySelector('[data-field="veq1"] input').className, fb: document.querySelector('[data-field="veq1"] .lk-note').innerText, st: Halbtitration.Tasks.current('veq1').status }));
    assert(!/is-ok/.test(live.cls) && /erneut prüfen/.test(live.fb) && live.st === 'stale', 'Grüner Status nach Änderung: ' + JSON.stringify(live));
    await page.reload();
    await F.openStep(page, 'curve');
    await page.click('.step[data-step="curve"] details summary');
    assert((await field(page, 'veq1')) === 'stale' && !(await page.$('[data-field="veq1"] input.is-ok')), 'Nach Neuladen wieder grün');
    // Kette ÄP-Marker → HÄP → pH → pK
    await F.chooseTitrant(page, 'NaOH');
    await F.prepare(page);
    await F.surveyRun(page, [24], 26);
    await F.openStep(page, 'curve');
    await F.fillField(page, 'eqm1', '24,00');
    await F.openStep(page, 'target');
    assert((await F.fillField(page, 'vhalf1', '12,00')).current === 'ok', 'HÄP nicht ok');
    // Marker per Zeiger im Diagramm verschieben → HÄP-Rechnung veraltet
    await F.act(page, 'chart-marker', '[data-marker="eq1"]');
    const box = await page.$eval('#chart', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.click(box.x + 46 + (box.w - 60) * (23 / 50), box.y + box.h / 2);
    await page.waitForTimeout(400);
    assert((await field(page, 'vhalf1')) === 'stale' && (await field(page, 'eqm1')) === 'stale', 'Markeränderung entwertet HÄP-Rechnung nicht');
    await F.act(page, 'chart-read');
    await F.openStep(page, 'curve');
    await F.fillField(page, 'eqm1', '24,00');
    await F.openStep(page, 'target');
    await F.fillField(page, 'vhalf1', '12,00');
    // Rechenbasis wechseln → veraltet
    await page.selectOption('#basis1', 'stoich');
    assert((await field(page, 'vhalf1')) === 'stale', 'Basiswechsel entwertet nicht');
    await page.selectOption('#basis1', 'measured');
    assert((await field(page, 'vhalf1')) === 'ok', 'Rückkehr zur geprüften Basis');
    // Halbtitration, pH, pK
    await F.newSample(page, 'half');
    await F.prepare(page);
    await F.waitStable(page); await F.waitPoint(page);
    await F.doseTo(page, 10, 2); await F.doseTo(page, 12, 0.5);
    const pH = await page.evaluate(() => Halbtitration.App.activeSeries().points.slice(-1)[0].pH);
    await F.openStep(page, 'measure');
    assert((await F.fillField(page, 'phhalf1', de(pH))).current === 'ok', 'pH nicht ok');
    await F.openStep(page, 'result');
    assert((await F.fillField(page, 'pk_pKs1', de(pH))).current === 'ok', 'pK nicht ok');
    // pH ändern → pK veraltet
    await F.openStep(page, 'measure');
    await page.fill('[data-field="phhalf1"] input', de(pH + 0.1));
    await page.dispatchEvent('[data-field="phhalf1"] input', 'input');
    assert((await field(page, 'pk_pKs1')) === 'stale' && (await field(page, 'phhalf1')) === 'stale', 'pH-Änderung entwertet pK nicht');
    await page.fill('[data-field="phhalf1"] input', de(pH));
    await page.dispatchEvent('[data-field="phhalf1"] input', 'input');
    // Reihe wechseln: neue Halbtitrationsreihe → alter Nachweis gilt nicht mehr
    await F.newSample(page, 'half');
    await F.prepare(page);
    await F.waitStable(page); await F.waitPoint(page);
    assert((await field(page, 'phhalf1')) === 'stale', 'Reihenwechsel entwertet den Nachweis nicht');
    // Abgabe bewertet aktuelle Daten: in neuer Reihe kein Punkt am Ziel → blockiert
    await F.openStep(page, 'result');
    await F.act(page, 'submit');
    await page.waitForSelector('#modal:not([hidden])');
    const block = await page.$eval('#modalBody', (e) => e.innerText);
    assert(/gehört zu keinem protokollierten Messpunkt/.test(block), 'Abgabe ohne aktuellen Nachweis nicht blockiert: ' + block);
    await page.click('#modalActions .lk-btn.primary');
    // zurück zur Reihe mit Nachweis: Messreihe wiederholen verwirft die leere
    await F.act(page, 'repeat'); await F.confirm(page);
    await page.evaluate(() => { const e = Halbtitration.App.es(); e.evalHalf = e.series.filter((s) => s.kind === 'half')[0].id; });
    await F.openStep(page, 'measure');
    await F.fillField(page, 'phhalf1', de(pH));
    await F.openStep(page, 'result');
    await F.fillField(page, 'pk_pKs1', de(pH));
    await F.act(page, 'submit');
    await F.confirm(page);
    const sb1 = await page.evaluate(() => JSON.stringify(Halbtitration.App.es().submission));
    // Korrektur nach Abgabe: Momentaufnahme bleibt
    await F.openStep(page, 'result');
    await F.fillField(page, 'pk_pKs1', de(pH + 0.05));
    const sb2 = await page.evaluate(() => JSON.stringify(Halbtitration.App.es().submission));
    assert(sb1 === sb2, 'Abgegebene Momentaufnahme verändert');
    assert(/aktuell korrigiert/.test(await page.$eval('.step[data-step="result"]', (e) => e.innerText)), 'Korrektur nicht getrennt angezeigt');
    return { errors: page.__errors };
  },

  // ---------------------------------------------------------------- Befund B/C: Nachweis, Musterlösung, ungenaue echte Messung
  async E6(browser) {
    const page = await newPage(browser);
    await fresh(page);
    await F.openStep(page, 'result');
    await page.fill('[data-field="pk_pKs1"] input', '4,8');
    await F.act(page, 'submit');
    await page.waitForSelector('#modal:not([hidden])');
    const txt = await page.$eval('#modalBody', (e) => e.innerText);
    assert(/Zielvolumen/.test(txt) && /Halbtitrations-Messreihe/.test(txt), 'Abgabe ohne Messreihe nicht verhindert');
    await page.click('#modalActions .lk-btn:not(.primary)'); // Musterlösung ansehen
    await page.waitForSelector('.step[data-step="result"] .lk-note.info');
    const st = await page.evaluate(() => ({ sub: Halbtitration.App.es().submission, sol: !!Halbtitration.App.es().solution, series: Halbtitration.App.es().series.reduce((n, s) => n + s.points.length, 0) }));
    assert(st.sub === null && st.sol && st.series === 0, 'Musterlösung als eigener Versuch gewertet oder Messwerte erfunden');
    await page.click('.lk-tabs [data-tab="results"]');
    assert(/Musterlösung angesehen – kein eigener Versuch/.test(await page.$eval('#panelBody', (e) => e.innerText)), 'Musterlösung in der Übersicht nicht gekennzeichnet');
    await shot(page, '6-musterloesung-ergebnisse');
    // Befund C in der Oberfläche: pH vor Zielvolumen → nur „vorhanden, Zuordnung offen“
    await F.chooseTitrant(page, 'NaOH');
    await F.newSample(page, 'half');
    await F.prepare(page);
    await F.waitStable(page); await F.waitPoint(page);
    await F.doseTo(page, 10, 2);
    await F.setDose(page, 2); await F.act(page, 'dose'); // bis 12 mL
    await F.setDose(page, 0.5); await F.act(page, 'dose'); // gleich weiter: überschießen auf 12,50 mL
    await F.waitPoint(page);
    const p = await page.evaluate(() => Halbtitration.App.activeSeries().points.slice(-1)[0]);
    assert(p.v === 12.5 && p.stable, 'automatischer Messpunkt nach dem Überschießen fehlt');
    await F.openStep(page, 'measure');
    const pres = await F.fillField(page, 'phhalf1', de(p.pH));
    assert(pres.current === 'present' && /offen/.test(pres.message), 'Ohne Ziel bestätigt: ' + JSON.stringify(pres));
    // ungenaue, aber echte Messung abgeben → gekennzeichnet angenommen; richtige Rechnung erkannt
    await page.evaluate(() => { Halbtitration.App.es().fields.eqm1 = { input: '24,00' }; });
    await F.openStep(page, 'target');
    await F.fillField(page, 'vhalf1', '12,00');
    await F.openStep(page, 'measure');
    const m = await F.fillField(page, 'phhalf1', de(p.pH));
    assert(m.current === 'measured-note' && /12,50 mL statt/.test(m.message), 'Zielabweichung nicht ausgewiesen: ' + JSON.stringify(m));
    await F.openStep(page, 'result');
    assert((await F.fillField(page, 'pk_pKs1', de(p.pH))).current === 'ok', 'richtige Rechnung aus ungenauer Messung nicht erkannt');
    await F.act(page, 'submit');
    await page.waitForSelector('#modal:not([hidden])');
    const fl = await page.$eval('#modalBody', (e) => e.innerText);
    assert(/neben dem Zielvolumen/.test(fl), 'Mangel nicht gekennzeichnet: ' + fl);
    await page.click('#modalActions .lk-btn.primary');
    const sb = await page.evaluate(() => Halbtitration.App.es().submission);
    assert(sb && sb.flags.length >= 1 && sb.stages[1].v === 12.5, 'Ungenaue echte Messung nicht angenommen');
    return { errors: page.__errors };
  },

  // ---------------------------------------------------------------- Durchführung, Speicherung, alter Stand
  async E7(browser) {
    const page = await newPage(browser);
    await fresh(page);
    await F.chooseTitrant(page, 'NaOH');
    await F.prepare(page, { stir: false });
    await F.waitStable(page); await F.waitPoint(page);
    await F.setDose(page, 2); await F.act(page, 'dose');
    await F.waitSettled(page);
    const still = await F.labState(page);
    assert(!still.stable && still.unmixed > 0.5, 'Ohne Rühren sofort stabil');
    const nStill = await page.evaluate(() => Halbtitration.App.activeSeries().points.length);
    assert(nStill === 1, 'Ohne stabile Anzeige wurde ein Punkt erzeugt');
    await shot(page, '7-ohne-ruehren');
    await page.click('.measure [data-action="stir"]');
    await F.waitPoint(page);
    // neue Probe: Bürette und Kalibrierung bleiben, Reihen bleiben
    await F.newSample(page, 'half');
    const keep = await page.evaluate(() => ({ cal: Halbtitration.App.lab().calibration, filled: Halbtitration.App.lab().burette.filled, n: Halbtitration.App.es().series.length, btn: !!document.querySelector('[data-action="prep-burette"]:not([disabled])') }));
    assert(keep.cal === 2 && keep.filled && keep.n === 2 && !keep.btn, 'Neue Probe verlangt erneute Gerätevorbereitung: ' + JSON.stringify(keep));
    // Versuchswechsel: Kalibrierung gilt weiter, Bürette für HCl getrennt
    await F.chooseExp(page, 'ammonia');
    const am = await page.evaluate(() => ({ cal: Halbtitration.App.lab().calibration, filled: Halbtitration.App.lab().burette.filled }));
    assert(am.cal === 2 && !am.filled, 'Gerätezustand beim Versuchswechsel falsch: ' + JSON.stringify(am));
    await F.chooseExp(page, 'acetic');
    assert((await page.evaluate(() => Halbtitration.App.es().series.length)) === 2, 'Versuchswechsel verliert Reihen');
    // Neuladen
    await page.reload();
    await page.waitForSelector('.step[data-step="start"]');
    const re = await page.evaluate(() => ({ n: Halbtitration.App.es().series.length, pts: Halbtitration.App.es().series[0].points.length, cal: Halbtitration.App.lab().calibration }));
    assert(re.n === 2 && re.pts >= 2 && re.cal === 2, 'Wiederherstellung unvollständig: ' + JSON.stringify(re));
    // Gesamtes Labor zurücksetzen
    await F.act(page, 'reset-menu');
    await page.click('#modalActions .lk-btn.warn');
    await F.confirm(page);
    assert((await page.evaluate(() => Halbtitration.App.es().series.filter((s) => s.points.length).length)) === 0, 'Zurücksetzen unvollständig');
    // alter Speicherstand 0.1.0 (vor dem ersten Laden der App eingerichtet)
    const p2 = await newPage(browser, { init: () => {
      if (sessionStorage.getItem('v1-gesetzt')) return;
      sessionStorage.setItem('v1-gesetzt', '1');
      localStorage.clear();
      localStorage.setItem('sivex-halbtitration-v1', JSON.stringify({ v: 1, current: 'acetic', exps: { acetic: { plan: { titrant: 'NaOH', checked: true }, series: [{ id: 'R1', no: 1, kind: 'survey', points: [{ v: 0, pH: 3.04, stable: true }, { v: 1, pH: 3.47, stable: true }] }], active: 0, evalSurvey: 'R1', sampleNo: 1, markers: { eq1: 24 }, fields: { veq1: { input: '24,00', status: 'ok' }, pk_pKs1: { input: '4,76', status: 'ok' } }, submission: { at: 1, values: { pKs1: 4.76 } } } } }));
    } });
    await p2.goto(`${BASE}?speed=25`);
    await p2.waitForSelector('.step[data-step="start"]');
    const mig = await p2.evaluate(() => ({ n: Halbtitration.App.es().series[0].points.length, rel: Halbtitration.Tasks.released(), legacy: !!Halbtitration.App.es().legacySubmission, veq: Halbtitration.Tasks.current('veq1').status }));
    assert(mig.n === 2 && !mig.rel && mig.legacy && mig.veq === null, 'Migration falsch: ' + JSON.stringify(mig));
    // Speicherfehler
    const p3 = await newPage(browser, { init: () => { Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; } });
    await p3.goto(`${BASE}?speed=25`);
    await F.chooseTitrant(p3, 'NaOH');
    await p3.waitForSelector('.toast.show');
    await F.prepare(p3);
    await F.waitStable(p3); await F.waitPoint(p3);
    assert((await p3.evaluate(() => Halbtitration.App.activeSeries().points.length)) === 1, 'Ohne Speicher nicht bedienbar');
    return { errors: page.__errors.concat(p2.__errors, p3.__errors) };
  },

  // ---------------------------------------------------------------- Animation in Echtzeit
  async E8(browser) {
    const page = await newPage(browser);
    await fresh(page);
    await F.chooseTitrant(page, 'NaOH');
    await F.prepare(page, { indicator: 'phenolphthalein' });
    await F.waitStable(page); await F.waitPoint(page);
    await F.doseTo(page, 22, 2);
    await F.doseTo(page, 23.8, 0.2);
    await page.evaluate(() => { Halbtitration.App.lab().timeScale = 1; });
    await F.setDose(page, 0.2);
    await F.act(page, 'dose');
    const frames = [];
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(90);
      frames.push(await page.evaluate(() => { const l = Halbtitration.App.lab(); const r = Halbtitration.App.renderer; return { drops: l.drops.length, plumes: r.plumes.length, delivered: l.delivered, wave: Math.max.apply(null, Array.from(r.waveH).map(Math.abs)) }; }));
      if (i === 9) await shot(page, '8-tropfen-schliere');
    }
    assert(frames.some((f) => f.drops > 0), 'Kein fallender Tropfen');
    assert(frames.some((f) => f.plumes > 0), 'Keine Mischschliere');
    assert(frames.some((f) => f.wave > 0.2), 'Kein Oberflächenimpuls');
    assert(frames[frames.length - 1].delivered > frames[0].delivered, 'Volumen steigt nicht schrittweise');
    await page.waitForTimeout(1500);
    await F.act(page, 'stir');
    await page.waitForTimeout(6000);
    const calm = await page.evaluate(() => Math.max.apply(null, Array.from(Halbtitration.App.renderer.waveH).map(Math.abs)));
    assert(calm < 0.05, 'Ruhende Flüssigkeit zeigt Wellen');
    await page.evaluate(() => { Halbtitration.App.lab().timeScale = 25; document.activeElement.blur(); });
    const n0 = await page.evaluate(() => Halbtitration.App.activeSeries().points.length);
    await F.setDose(page, 'drop');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('d');
    await F.waitPoint(page);
    assert((await page.evaluate(() => Halbtitration.App.activeSeries().points.length)) === n0 + 1, 'Taste D bzw. automatischer Messpunkt wirkt nicht');
    return { frames: frames.map((f) => [f.drops, f.plumes, +f.wave.toFixed(2)].join('/')), calm, errors: page.__errors };
  },

  // ---------------------------------------------------------------- Größen (Tablet emuliert), Touch, Trennlinie, Bedienfeld
  async E9(browser) {
    const out = {};
    for (const vp of [{ width: 1440, height: 900, name: 'desktop-1440x900' }, { width: 1180, height: 820, name: 'tablet-1180x820', touch: true }, { width: 1024, height: 768, name: 'tablet-1024x768', touch: true }]) {
      const page = await newPage(browser, { viewport: vp, touch: vp.touch });
      await fresh(page);
      await shot(page, '9-start-' + vp.name);
      await F.chooseTitrant(page, 'NaOH');
      await F.prepare(page);
      await F.surveyRun(page, [24], 26);
      if (vp.touch) {
        const pos = await page.evaluate(() => { const G = Halbtitration.Geometry.LAYOUT.burette; const p = Halbtitration.App.renderer.toScreen(G.x - 20, G.stopcockY); const r = document.getElementById('labCanvas').getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; });
        await page.touchscreen.tap(pos.x, pos.y);
        await page.waitForTimeout(100);
        const open = await page.evaluate(() => Halbtitration.App.lab().valveOpen);
        await page.touchscreen.tap(pos.x, pos.y);
        assert(open, 'Antippen des Hahns wirkt nicht (' + vp.name + ')');
        await F.waitSettled(page);
      }
      const m = await page.evaluate(() => {
        const vis = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= 0 && r.right <= window.innerWidth + 1; };
        const small = Array.from(document.querySelectorAll('.deck button, .lk-head button, .expchip, .seriesbar button, .lk-tabs button, .chart-tools button')).filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43.5).map((b) => b.textContent.trim().slice(0, 24));
        return { overflow: document.documentElement.scrollWidth - window.innerWidth, small, lab: document.getElementById('labCanvas').getBoundingClientRect().width, chart: document.getElementById('chart').getBoundingClientRect().width, dose: vis('[data-action="dose"]'), take: vis('.measure [data-action="stir"]'), valve: vis('#btnValve'), chartVis: vis('#chart'), labVis: vis('#labCanvas') };
      });
      assert(m.overflow <= 0, 'Überbreite bei ' + vp.name);
      assert(!m.small.length, 'Zu kleine Touchziele bei ' + vp.name + ': ' + m.small.join(', '));
      assert(m.dose && m.take && m.valve && m.chartVis && m.labVis, 'Labor, Kurve und Messbedienung nicht gleichzeitig sichtbar (' + vp.name + '): ' + JSON.stringify(m));
      await shot(page, '9-messbetrieb-' + vp.name);
      // Bedienfeld ein- und ausklappen
      await F.act(page, 'toggle-panel');
      const wide = await page.$eval('#chart', (c) => c.getBoundingClientRect().width);
      assert(wide > m.chart + 80, 'Eingeklapptes Bedienfeld verbreitert die Bühne nicht');
      await shot(page, '9-ohne-bedienfeld-' + vp.name);
      await F.act(page, 'toggle-panel');
      // Trennlinie per Tastatur und Ziehen
      const w0 = await page.$eval('#panel', (e) => e.getBoundingClientRect().width);
      await page.focus('#splitter');
      await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
      const w1 = await page.$eval('#panel', (e) => e.getBoundingClientRect().width);
      const sp = await page.$eval('#splitter', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await page.mouse.move(sp.x, sp.y); await page.mouse.down(); await page.mouse.move(sp.x + 60, sp.y, { steps: 5 }); await page.mouse.up();
      const w2 = await page.$eval('#panel', (e) => e.getBoundingClientRect().width);
      assert((w1 > w0 + 10 || w0 >= 619) && w2 < w1 - 30, 'Trennlinie reagiert nicht (' + vp.name + '): ' + [w0, w1, w2]);
      out[vp.name] = { lab: Math.round(m.lab), chart: Math.round(m.chart), errors: page.__errors };
      await page.context().close();
    }
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
    try { fs.mkdirSync(path.join(APP, '.work'), { recursive: true }); await lastPage.screenshot({ path: path.join(APP, '.work', 'fail-' + name + '.png') }); } catch (err) { /* Seite geschlossen */ }
    const where = (e.stack || '').split('\n').find((l) => /run\.mjs|flow\.mjs/.test(l)) || '';
    results.push({ name, status: 'HOLD – failed', seconds: Math.round((Date.now() - t0) / 1000), error: e.message });
    console.log(name, 'HOLD – failed:', e.message.split('\n').slice(0, 3).join(' / '), where.trim());
  }
}
await browser.close();
server.close();
const file = path.join(HERE, ONLY.length ? 'results-partial.json' : 'results.json');
fs.writeFileSync(file, JSON.stringify({ root: path.relative(APP, ROOT) || '.', date: new Date().toISOString(), browser: 'Microsoft Edge (Playwright channel msedge)', results }, null, 2));
console.log('Ergebnis: ' + results.filter((r) => r.status === 'PASS').length + '/' + results.length + ' PASS → ' + path.relative(APP, file));
process.exit(results.every((r) => r.status === 'PASS') ? 0 : 1);
