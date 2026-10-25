// End-to-End-Prüfung der Destillation im echten Browser (Edge/Chromium über Playwright).
// Bedient ausschließlich die gerenderte Oberfläche (Klicks, Tipps, Tastatur, Ziehen an der
// Trennlinie). Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen – nie gesetzt.
// Aufruf: npm run build && node tests/e2e/run.mjs   (ONLY=E01,E05 für einzelne Szenarien)
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '../../scripts/serve.mjs';
import { APP, launch, newPage, S, idle, waitFor, readTemp, tapHit, clickAct, view, speed, heater, water, heatLevel, flow, prepare, shot, grab, differs, worldClip, sleep, assert } from './lib.mjs';

const ROOT = process.env.E2E_ROOT ? path.resolve(process.env.E2E_ROOT) : path.join(APP, 'dist/destillation');
const PORT = Number(process.env.E2E_PORT || 8152);
const BASE = `http://localhost:${PORT}/index.html`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const results = [];
const allRequests = [];
const allErrors = [];

async function scenario(id, title, fn) {
  if (ONLY && !ONLY.includes(id)) return;
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ id, title, status: 'PASS', detail: detail || '', ms: Date.now() - t0 });
    console.log(`PASS ${id} ${title}${detail ? ' – ' + detail : ''}`);
  } catch (e) {
    results.push({ id, title, status: 'FAIL', detail: e.message, ms: Date.now() - t0 });
    console.log(`FAIL ${id} ${title} – ${e.stack}`);
  }
}

const browser = await launch();
const server = await serve(ROOT, PORT);
const browserVersion = browser.version();
console.log(`Browser: ${browser.__channel} ${browser.version()} · Quelle: ${path.relative(APP, ROOT) || '.'}`);

async function open(opts = {}) {
  const o = await newPage(browser, BASE, opts);
  o.done = async () => { allErrors.push(...o.errors); allRequests.push(...o.requests); await o.context.close(); };
  return o;
}
const vol = (st) => st.receiver.c.P + st.receiver.c.E + st.receiver.c.W;
const panel = (page) => page.locator('#panelBody');
async function tab(page, t) { await page.locator(`.lk-tabs [data-tab="${t}"]`).click(); await sleep(80); }
async function pickTask(page, k) { await page.locator(`.taskchips [data-task="${k}"]`).click(); await sleep(80); if (await page.locator('#btnRestartYes').count()) await page.locator('#btnRestartYes').click(); await sleep(80); }
async function check(page) { await page.locator('#btnCheck').click(); await sleep(80); return (await page.locator('#panelBody .lk-note').first().innerText()); }
async function choose(page, qid, value) { await page.locator(`#protoForm [name="q-${qid}"][value="${value}"]`).check(); }
async function fillQ(page, qid, text) { await page.locator(`#protoForm [name="q-${qid}"]`).fill(text); }
const fieldClass = (page, qid) => page.locator(`#protoForm [data-q="${qid}"] .lk-fb`).getAttribute('class');
const de = (v) => String(v.toFixed(1)).replace('.', ',');
/** Abgelesene Temperatur während des Tropfens (wie Lernende: Anzeige ablesen). */
async function readWhileDripping(page) { const vals = []; for (let i = 0; i < 3; i++) vals.push(await readTemp(page)); return vals.reduce((a, b) => a + b, 0) / vals.length; }

// =========================================================== E01 Standard 1 komplett
await scenario('E01', 'Standard 1 komplett: befüllen → Siedesteine → Kühlwasser EIN → Heizung EIN → Sieden → Ablesen → Destillat → Brennprobe → AUS → Auswertung → Hefteintrag', async () => {
  const { page, errors, done } = await open();
  await shot(page, '01-start-vormontiert');
  assert(await S(page, (st) => !st.filled && st.thermo === 'high' && !st.hoses.inlet && st.receiver.present), 'Startzustand vormontiert, Kolben leer');
  await speed(page, 10);
  await tapHit(page, 'bottle');
  await sleep(2600); await shot(page, '02-befuellen-trichter');
  const lvl = [];
  for (let i = 0; i < 3; i++) { lvl.push(await S(page, (st, M) => M.vol(st.flask.c))); await sleep(500); }
  await idle(page);
  assert(lvl[0] < lvl[2] || lvl[2] === 100, 'Füllstand steigt sichtbar: ' + lvl.join(' → '));
  await clickAct(page, 'addStones'); await sleep(700); await shot(page, '03-siedesteine-fallen'); await idle(page);
  await clickAct(page, 'thermoDown');
  assert(await S(page, (st) => st.thermo === 'correct'), 'Thermometer auf Höhe des Abgangs');
  await tapHit(page, 'hose:inlet'); await tapHit(page, 'nozzle:low');
  await tapHit(page, 'hose:outlet'); await tapHit(page, 'nozzle:high');
  await water(page, true);
  await sleep(1500); await shot(page, '04-kuehlwasser-fliesst-ein');
  const fill = await S(page, (st) => st.jacket.fill);
  assert(fill > 0.1, 'Mantel füllt sich ' + fill);
  await heatLevel(page, 'mid'); await heater(page, true);
  await speed(page, 30);
  await waitFor(page, (st) => st.flask.T > 50);
  await shot(page, '05-aufheizen');
  assert(await S(page, (st) => st.fx.boil === 0), 'kein Sieden beim Aufheizen');
  await waitFor(page, (st) => st.fx.boil > 0.05);
  await speed(page, 1); await sleep(1200); await shot(page, '06-sieden-blasen');
  // Füllstand sinkt im Kolben, Vorlage füllt sich (fortlaufende Bildfolge)
  await speed(page, 30);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 2);
  await speed(page, 1);
  const T = await readWhileDripping(page);
  assert(T > 78 && T < 81.5, 'abgelesene Dampftemperatur ' + T);
  const clip = await worldClip(page, 'receiver');
  const f1 = await grab(page, clip); await sleep(400); const f2 = await grab(page, clip);
  assert(differs(f1, f2), 'Vorlage: aufeinanderfolgende Bilder verschieden (Tropfen)');
  await shot(page, '07-kondensat-tropfen');
  await speed(page, 30);
  const seq = [];
  for (let i = 0; i < 4; i++) { seq.push(await S(page, (st, M) => [M.vol(st.flask.c), M.vol(st.receiver.c), st.drops.seq])); await sleep(700); }
  for (let i = 1; i < seq.length; i++) assert(seq[i][0] < seq[i - 1][0] && seq[i][1] > seq[i - 1][1] && seq[i][2] > seq[i - 1][2], 'Kolben sinkt, Vorlage steigt, Tropfen zählen: ' + JSON.stringify(seq));
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 12);
  await speed(page, 1);
  await shot(page, '08-vorlage-gefuellt');
  // Brennprobe am getrennten Prüfplatz
  await tapHit(page, 'pipette'); await tapHit(page, 'receiver');
  assert(await S(page, (st) => !!st.pipette), 'Probe in der Pipette');
  await tapHit(page, 'dish');
  assert(await S(page, (st) => !!st.dish), 'Probe in der Schale');
  assert(await S(page, (st) => st.fx.flame === 0), 'keine Flamme ohne Zünden');
  await tapHit(page, 'lighter'); await tapHit(page, 'dish');
  await sleep(900);
  const fl = await S(page, (st) => [st.dish.result, st.fx.flame]);
  assert(fl[0] === 'burns' && fl[1] > 0.2, 'bläuliche Flamme: ' + fl);
  await shot(page, '09-brennprobe-blaue-flamme');
  await waitFor(page, (st) => !st.dish.burning, null, 60000);
  // Ausschalten: Sieden läuft aus, kein Sprung
  await heater(page, false); await water(page, false);
  const afterOff = await S(page, (st) => [st.flask.T, st.reading]);
  await speed(page, 30); await sleep(1500);
  const later = await S(page, (st) => [st.flask.T, st.reading, st.fx.vapor]);
  assert(later[0] < afterOff[0] + 1 && afterOff[0] - later[0] < 25, 'kein Temperatursprung nach dem Ausschalten ' + afterOff + ' → ' + later);
  await waitFor(page, (st) => st.fx.vapor === 0);
  await shot(page, '10-nach-dem-ausschalten');
  await speed(page, 0);
  // Auswertung
  const r = await check(page);
  assert(/Ergebnis belegt/.test(r), 'Ergebnis prüfen: ' + r);
  await fillQ(page, 'temp', de(T));
  const v = await S(page, (st, M, Tt) => Tt.mainFraction('ew', M.snapshot(st)).vol);
  await fillQ(page, 'vol', de(v));
  await choose(page, 'obs', 'plateau'); await choose(page, 'obs', 'drops');
  await choose(page, 'result', 'E'); await choose(page, 'why', 'bp');
  await fillQ(page, 'gap', 'Kondensation'); await choose(page, 'burn', 'burns');
  await page.locator('#btnGrade').click(); await sleep(150);
  const summary = await panel(page).innerText();
  assert(/Alles richtig ausgewertet/.test(summary), 'Protokoll vollständig richtig');
  await shot(page, '11-protokoll-richtig');
  await page.locator('#btnNotebook').click(); await sleep(150);
  assert(/Destillation/.test(await panel(page).innerText()), 'Hefteintrag');
  await shot(page, '12-hefteintrag');
  const bal = await page.evaluate(() => window.DS.app.engine.balance());
  assert(bal.ok, 'Bilanz ' + bal.error);
  await done();
  assert(!errors.length, errors.join('; '));
  return `T ${de(T)} °C, Destillat ${de(v)} mL, Flamme bläulich`;
});

// =========================================================== E02 Standard 2 komplett
await scenario('E02', 'Standard 2 komplett: Propanon/Wasser, klar andere Temperatur, abgrenzbare Fraktion', async () => {
  const { page, errors, done } = await open();
  await pickTask(page, 'pw');
  assert(await S(page, (st) => st.mix === 'pw'), 'Gemisch gewählt');
  await speed(page, 10);
  await prepare(page);
  await speed(page, 30);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 3);
  await speed(page, 1);
  const T = await readWhileDripping(page);
  assert(T > 56 && T < 59.5, 'Propanon geht bei ~57 °C über: ' + T);
  await shot(page, '13-propanon-wasser');
  await speed(page, 30);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 15);
  const r = await check(page);
  assert(/Ergebnis belegt/.test(r), r);
  const share = await S(page, (st, M) => M.share(st.receiver.c).P);
  assert(share > 0.97, 'Fraktion Propanon ' + share);
  // Danach steigt die Temperatur deutlich (Fraktion abgrenzbar)
  await waitFor(page, (st) => st.reading > 85, null, 240000);
  await done();
  assert(!errors.length, errors.join('; '));
  return `T ${de(T)} °C, Propanon-Anteil ${(share * 100).toFixed(0)} %`;
});

// =========================================================== E03 Expertenmodus komplett
await scenario('E03', 'Expertenmodus: drei Komponenten, Vorlagenwechsel, Fraktionen und Temperaturkurve', async () => {
  const { page, errors, done } = await open();
  assert(!(await page.locator('.taskchips [data-task="pew"]').count()), 'Szenario 3 nur im Expertenmodus');
  await page.locator('#btnExpert').click();
  await pickTask(page, 'pew');
  assert(await S(page, (st) => st.mix === 'pew' && st.expert), 'Dreistoffgemisch');
  await speed(page, 10);
  await prepare(page);
  await view(page, 'chart');
  await speed(page, 30);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 1);
  await waitFor(page, (st) => st.reading > 65);
  await clickAct(page, 'changeReceiver');
  await sleep(350); await shot(page, '14-vorlagenwechsel-animiert');
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 1);
  await waitFor(page, (st) => st.reading > 88);
  await clickAct(page, 'changeReceiver');
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 3);
  await speed(page, 0);
  await shot(page, '15-experte-diagramm-fraktionen');
  const fr = await S(page, (st, M) => M.snapshot(st).fractions.map((f) => [f.n, f.main, +f.vol.toFixed(1), +f.Tmed.toFixed(1)]));
  assert(fr[0][1] === 'P' && fr[1][1] === 'E' && fr[2][1] === 'W', 'Fraktionen ' + JSON.stringify(fr));
  const marks = await S(page, (st) => st.series.filter((p) => p.change).length);
  assert(marks === 2, 'Wechsel im Diagramm markiert');
  const r = await check(page);
  assert(/Ergebnis belegt/.test(r), r);
  await tab(page, 'results');
  const res = await panel(page).innerText();
  assert(/Vorlage 1/.test(res) && /Vorlage 2/.test(res) && /Stoffbilanz/.test(res), 'Ergebnisübersicht');
  await shot(page, '16-ergebnisse-experte');
  await done();
  assert(!errors.length, errors.join('; '));
  return JSON.stringify(fr);
});

// =========================================================== E04 Ohne Kühlung vs. mit Kühlung
await scenario('E04', 'Ohne Kühlung vs. mit korrekter Kühlung bei gleicher Modellzeit', async () => {
  const T = 900;
  const a = await open(); const b = await open();
  await speed(a.page, 10); await speed(b.page, 10);
  await prepare(a.page);
  await speed(a.page, 0);
  await prepare(b.page, { hoses: 'none', water: false });
  await speed(b.page, 30);
  await waitFor(b.page, (st, M, t) => st.t >= t || !!st.safety, T);
  await speed(b.page, 0);
  const tb = await S(b.page, (st) => st.t);
  await speed(a.page, 30);
  await waitFor(a.page, (st, M, t) => st.t >= t - 4, tb);
  await speed(a.page, 1);
  await waitFor(a.page, (st, M, t) => st.t >= t, tb);
  await speed(a.page, 0);
  await shot(b.page, '17-ohne-kuehlung-stopp');
  const va = await S(a.page, (st, M) => [st.t, M.vol(st.receiver.c)]);
  const vb = await S(b.page, (st, M) => [st.t, M.vol(st.receiver.c), M.vol(st.lost.vapor), st.safety && st.safety.code]);
  assert(Math.abs(va[0] - vb[0]) < 0.5, 'gleiche Modellzeit');
  assert(vb[1] < va[1] * 0.5, `ohne Kühlung weniger Destillat: ${vb[1]} vs ${va[1]}`);
  assert(vb[2] > 1, 'Dampfverlust gebucht ' + vb[2]);
  assert(await b.page.locator('#safety').isVisible(), 'Sicherheitsstopp sichtbar');
  // sichtbarer Unterschied an der Vorlage
  const ca = await a.page.locator('#readout').innerText(), cb = await b.page.locator('#readout').innerText();
  await a.done(); await b.done();
  assert(!a.errors.length && !b.errors.length, a.errors.concat(b.errors).join('; '));
  return `t = ${va[0].toFixed(0)} s: mit Kühlung ${de(va[1])} mL, ohne ${de(vb[1])} mL, Verlust ${de(vb[2])} mL (${ca} | ${cb})`;
});

// =========================================================== E05 Vertauschte Schläuche + Korrektur
await scenario('E05', 'Falsch angeschlossene Schläuche, Wirkung, Korrektur', async () => {
  const { page, errors, done } = await open({ hasTouch: true });
  await speed(page, 10);
  await prepare(page, { hoses: 'swap', touch: true });
  await view(page, 'detail', true);
  await speed(page, 30);
  await waitFor(page, (st, M) => M.vol(st.lost.vapor) > 0.5 || !!st.safety);
  await speed(page, 1); await sleep(800);
  await shot(page, '18-schlaeuche-vertauscht-detail');
  const s1 = await S(page, (st, M) => [st.jacket.fill, M.vol(st.lost.vapor), st.mistakes.escape || 0]);
  assert(s1[0] < 0.2, 'Mantel nur teilweise gefüllt ' + s1[0]);
  assert(s1[1] > 0.3 && s1[2] >= 1, 'Dampfverlust gebucht und gewarnt ' + s1);
  // Korrektur: Heizung aus, Wasser zu, umstecken, Wasser auf
  if (await page.locator('#btnAck').count()) await page.locator('#btnAck').tap();
  await heater(page, false, true); await water(page, false, true);
  await tapHit(page, 'nozzle:high', true); await tapHit(page, 'nozzle:low', true);
  assert(await S(page, (st) => !st.hoses.inlet && !st.hoses.outlet), 'Schläuche abgezogen');
  await tapHit(page, 'hose:inlet', true); await tapHit(page, 'nozzle:low', true);
  await tapHit(page, 'hose:outlet', true); await tapHit(page, 'nozzle:high', true);
  await water(page, true, true);
  await speed(page, 10); await sleep(2500);
  assert(await S(page, (st) => st.jacket.fill > 0.99), 'Mantel nach Korrektur voll');
  await heater(page, true, true);
  await speed(page, 30);
  const l0 = await S(page, (st, M) => M.vol(st.lost.vapor));
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 10);
  const l1 = await S(page, (st, M) => M.vol(st.lost.vapor));
  assert(l1 - l0 < 0.1, `nach Korrektur kein weiterer Verlust: ${l0} → ${l1}`);
  await speed(page, 1); await sleep(600);
  await shot(page, '19-schlaeuche-korrigiert-detail');
  await done();
  assert(!errors.length, errors.join('; '));
  return `Mantelfüllung vertauscht ${s1[0].toFixed(2)}, Verlust ${de(s1[1])} mL → nach Korrektur +${(l1 - l0).toFixed(2)} mL`;
});

// =========================================================== E06 Thermometerlage
await scenario('E06', 'Falsche Thermometerlage vs. richtige: Messwert und Auswertungsfeedback', async () => {
  const { page, errors, done } = await open();
  await speed(page, 10);
  await prepare(page, { thermo: 'high' });
  await speed(page, 30);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 6);
  await speed(page, 1);
  const Th = await readWhileDripping(page);
  assert(Th < 68, 'zu hoch sitzendes Thermometer misst zu wenig: ' + Th);
  await shot(page, '20-thermometer-zu-hoch');
  await speed(page, 0);
  await fillQ(page, 'temp', de(Th));
  await page.locator('#btnGrade').click(); await sleep(120);
  const fb = await page.locator('#protoForm [data-q="temp"] .lk-fb').innerText();
  assert(/Thermometerkugel/.test(fb), 'Auswertung warnt: ' + fb);
  const r = await check(page);
  assert(/Noch nicht belegt/.test(r), 'kein Erfolg mit falscher Lage');
  // Korrektur im sicheren Zustand
  await clickAct(page, 'thermoDown');
  assert(await S(page, (st) => st.thermo === 'high'), 'Verstellen während des Siedens gesperrt');
  await heater(page, false);
  await speed(page, 30);
  await waitFor(page, (st) => st.fx.vapor === 0 && st.fx.pass < 1e-4);
  await clickAct(page, 'thermoDown');
  assert(await S(page, (st) => st.thermo === 'correct'), 'korrigiert');
  await heater(page, true);
  const d0 = await S(page, (st) => st.drops.seq);
  await waitFor(page, (st, M, d) => st.drops.seq > d + 40, d0);
  await speed(page, 1); await sleep(1000);
  const Tc = await readWhileDripping(page);
  assert(Tc > 78 && Tc < 81.5, 'richtige Lage: ' + Tc);
  await shot(page, '21-thermometer-korrigiert');
  await done();
  assert(!errors.length, errors.join('; '));
  return `zu hoch ${de(Th)} °C → richtig ${de(Tc)} °C`;
});

// =========================================================== E07 Schalter unabhängig, Regelung, Thermik
await scenario('E07', 'Heizpilz EIN/AUS + Stufe, Kühlwasser unabhängig EIN/AUS + Durchfluss, plausibler Verlauf', async () => {
  const { page, errors, done } = await open({ hasTouch: true });
  await speed(page, 10);
  await prepare(page, { heater: false, water: false, touch: true });
  // kalt: kein Sieden, auch nicht bei laufendem Kühlwasser
  await water(page, true, true);
  await speed(page, 30); await sleep(2000);
  assert(await S(page, (st) => st.fx.boil === 0 && st.flask.T < 25 && st.water.on && !st.heater.on), 'kalte Apparatur siedet nicht; Wasser unabhängig an');
  await water(page, false, true);
  assert(await S(page, (st) => !st.water.on), 'Kühlwasser unabhängig aus');
  await water(page, true, true);
  // Heizung EIN: allmählich wärmer
  await heater(page, true, true);
  const T0 = await S(page, (st) => st.flask.T);
  await sleep(300);
  const T1 = await S(page, (st) => st.flask.T);
  assert(T1 - T0 < 5, 'kein Sprung ' + T0 + '→' + T1);
  const label = await page.locator('#btnHeat').innerText();
  assert(/Heizung\s*EIN/.test(label), 'Beschriftung Heizung EIN: ' + label);
  // Stufe wirkt
  await heatLevel(page, 'low', true);
  await waitFor(page, (st) => st.flask.T > 45);
  const rLow = await S(page, (st) => st.mantleT);
  await heatLevel(page, 'high', true);
  await sleep(2500);
  const rHigh = await S(page, (st) => st.mantleT);
  assert(rHigh > rLow + 5, 'höhere Stufe → heißerer Heizpilz');
  await heatLevel(page, 'mid', true);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 4);
  // Durchfluss variiert Strömung
  await flow(page, 'low', true); await sleep(1500);
  const jl = await S(page, (st) => [st.fx.flow, st.jacket.T]);
  await flow(page, 'high', true); await sleep(1500);
  const jh = await S(page, (st) => [st.fx.flow, st.jacket.T]);
  assert(jh[0] > jl[0] && jh[1] < jl[1], 'stärkerer Durchfluss → kälterer Mantel ' + jl + ' / ' + jh);
  // Kühlwasser AUS: Kondensation sinkt (verzögert)
  await speed(page, 10);
  const c0 = await S(page, (st) => st.fx.cond);
  await water(page, false, true);
  assert(/Kühlwasser\s*AUS/.test(await page.locator('#btnWater').innerText()), 'Beschriftung Kühlwasser AUS');
  await speed(page, 30);
  await waitFor(page, (st) => st.fx.escape > 0.035 || !!st.safety);
  const c1 = await S(page, (st) => st.fx.cond);
  assert(c1 < c0 * 0.85, `Kondensation sinkt deutlich: ${c0} → ${c1}`);
  await shot(page, '22-kuehlwasser-aus-dampf-tritt-aus');
  // Heizung AUS: Temperatur fällt allmählich, Tropfen hören auf
  if (await page.locator('#btnAck').count()) await page.locator('#btnAck').tap();
  await water(page, true, true);
  await heater(page, false, true);
  const r0 = await S(page, (st) => st.reading);
  await waitFor(page, (st) => st.fx.vapor === 0);
  await sleep(4000);
  const r1 = await S(page, (st) => st.reading);
  assert(r1 < r0, 'Temperatur fällt ' + r0 + ' → ' + r1);
  const d0 = await S(page, (st) => st.drops.seq); await sleep(2000); const d1 = await S(page, (st) => st.drops.seq);
  assert(d1 === d0, 'keine Tropfen mehr');
  await done();
  assert(!errors.length, errors.join('; '));
  return `Heizpilz niedrig ${rLow.toFixed(0)} °C → hoch ${rHigh.toFixed(0)} °C; Kondensation ${(c0 * 60).toFixed(1)} → ${(c1 * 60).toFixed(1)} mL/min`;
});

// =========================================================== E08 Siedesteine fehlen
await scenario('E08', 'Siedesteine fehlen: Stopp, Ursache, Korrektur, Wiederaufnahme', async () => {
  const { page, errors, done } = await open();
  await speed(page, 10);
  await prepare(page, { stones: false });
  await speed(page, 30);
  await waitFor(page, (st) => !!st.safety);
  await speed(page, 1); await sleep(300);
  await shot(page, '23-siedeverzug-stopp');
  const txt = await page.locator('#safety').innerText();
  assert(/Siedeverzug/.test(txt) && /Siedesteine/.test(txt), 'verständliche Ursache');
  assert(await S(page, (st) => !st.heater.on), 'Heizung aus');
  await page.locator('#btnAck').click();
  await heater(page, true);
  assert(await S(page, (st) => !st.heater.on), 'ohne Siedesteine kein Wiederanlauf');
  await clickAct(page, 'addStones');
  assert(await S(page, (st) => !st.stones), 'nicht in heiße Flüssigkeit');
  await speed(page, 30);
  await waitFor(page, (st) => st.flask.T < 50);
  await clickAct(page, 'addStones'); await idle(page);
  assert(await S(page, (st) => st.stones), 'Siedesteine nach dem Abkühlen');
  await heater(page, true);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 5);
  await done();
  assert(!errors.length, errors.join('; '));
  return 'Siedeverzug → Abkühlen → Siedesteine → Destillat';
});

// =========================================================== E09 Vorlage fehlt, Trockenlauf, Verschließen, Zünden
await scenario('E09', 'Vorlage fehlt / Verschließen / Zünden am Aufbau / Trockenlauf', async () => {
  const { page, errors, done } = await open();
  await speed(page, 10);
  await prepare(page);
  await clickAct(page, 'toggleReceiver');
  await speed(page, 30);
  await waitFor(page, (st) => st.drops.seq > 20);
  await speed(page, 1); await sleep(500);
  await shot(page, '24-vorlage-fehlt');
  const s = await S(page, (st, M) => [M.vol(st.receiver.c), M.vol(st.lost.table)]);
  assert(s[0] === 0 && s[1] > 0.5, 'Kondensat verloren, nicht als Destillat ' + s);
  await clickAct(page, 'toggleReceiver');
  // Zünden an der Apparatur
  await tapHit(page, 'lighter'); await tapHit(page, 'condenser');
  assert(await S(page, (st) => st.safety && st.safety.code === 'ignite'), 'Stopp Zünden');
  await shot(page, '25-stopp-zuenden-am-aufbau');
  await page.locator('#btnAck').click();
  // Verschließen im Betrieb
  await heater(page, true);
  await speed(page, 30); await sleep(500);
  await tapHit(page, 'stopper');
  assert(await S(page, (st) => st.safety && st.safety.code === 'closed'), 'Stopp geschlossene Apparatur');
  await page.locator('#btnAck').click();
  await tapHit(page, 'stopper');
  await heater(page, true);
  assert(await S(page, (st) => st.heater.on), 'Wiederanlauf nach dem Öffnen');
  // Trockenlauf
  await heatLevel(page, 'high'); await flow(page, 'high');
  await waitFor(page, (st) => !!st.safety, null, 400000);
  const code = await S(page, (st) => st.safety.code);
  assert(code === 'dry', 'Trockenlauf-Stopp: ' + code);
  await shot(page, '26-stopp-trockenlauf');
  await done();
  assert(!errors.length, errors.join('; '));
  return 'Tisch statt Vorlage, Zünden, Verschließen, Trockenlauf gestoppt';
});

// =========================================================== E10 Lernsystem
await scenario('E10', 'Lernsystem: richtig / teilweise / falsch, drei Tipps, Lösung, Geräte-Trainer, Hefteintrag ohne Versuch', async () => {
  const { page, errors, done } = await open();
  // Hefteintrag ohne Versuch
  await tab(page, 'notebook');
  const nb = await panel(page).innerText();
  assert(/Siedetemperatur/.test(nb) && /Destillat/.test(nb), 'Hefteintrag ohne Versuch');
  await tab(page, 'task');
  // falsch und teilweise ohne Versuch
  await page.locator('#btnCheck').click(); await page.locator('#btnCheck').click(); await sleep(100);
  assert(await page.locator('#btnTipOffer').count(), 'Tipp nach wiederholtem Scheitern angeboten');
  for (let i = 1; i <= 3; i++) { await page.locator('#btnTip').click(); await sleep(80); assert((await panel(page).innerText()).includes(`Tipp ${i}/3`), 'Tipp ' + i); }
  await page.locator('#btnSolution').click(); await sleep(80);
  assert(await page.locator('#btnSolutionYes').count(), 'Rückfrage vor der Lösung');
  await page.locator('#btnSolutionYes').click(); await sleep(80);
  assert(/Lösung/.test(await panel(page).innerText()), 'Lösung angezeigt');
  // Protokoll mit kurzem Versuch: falsch → teilweise → richtig
  const p2 = await open();
  await speed(p2.page, 10); await prepare(p2.page); await speed(p2.page, 30);
  await waitFor(p2.page, (st, M) => M.vol(st.receiver.c) > 6);
  await speed(p2.page, 0);
  const pg = p2.page;
  await choose(pg, 'obs', 'smoke'); await choose(pg, 'obs', 'waterInner'); await choose(pg, 'why', 'heavy'); await fillQ(pg, 'gap', 'Verdampfen');
  await pg.locator('#btnGrade').click(); await sleep(100);
  assert(/n\b/.test(await fieldClass(pg, 'obs')) && /n\b/.test(await fieldClass(pg, 'gap')), 'falsch markiert');
  await shot(pg, '27-protokoll-falsch');
  await pg.locator('#protoForm [name="q-obs"][value="smoke"]').uncheck(); await pg.locator('#protoForm [name="q-obs"][value="waterInner"]').uncheck();
  await choose(pg, 'obs', 'drops'); await choose(pg, 'obs', 'plateau'); await choose(pg, 'why', 'bp');
  await pg.locator('#btnGrade').click(); await sleep(100);
  assert(/y\b/.test(await fieldClass(pg, 'obs')) && /y\b/.test(await fieldClass(pg, 'why')) && /n\b/.test(await fieldClass(pg, 'gap')), 'teilweise richtig, Eingaben erhalten');
  assert((await pg.locator('#protoForm [name="q-why"][value="bp"]').isChecked()), 'Eingabe bleibt');
  await fillQ(pg, 'gap', 'Kondensation');
  await pg.locator('#btnGrade').click(); await sleep(100);
  assert(/y\b/.test(await fieldClass(pg, 'gap')), 'nach Korrektur richtig');
  await shot(pg, '28-protokoll-teilweise-verbessert');
  await p2.done();
  // Geräte-Trainer
  await tab(page, 'trainer');
  await shot(page, '29-trainer-nummern');
  const sel = (id) => page.locator(`#namesForm [name="n-${id}"]`);
  await sel('receiver').selectOption('Destillat'); await sel('distillate').selectOption('Vorlage'); await sel('flask').selectOption('Rundkolben');
  await page.locator('#namesForm [type="submit"]').click(); await sleep(100);
  const tr = await panel(page).innerText();
  assert(/Gefäß/.test(tr), 'Vorlage/Destillat-Verwechslung erklärt');
  assert(/1 von 12/.test(tr), 'Einzelfeld-Bewertung: ' + (tr.match(/\d+ von 12/) || [])[0]);
  const names = await page.evaluate(() => window.DS.tasks.PART_ORDER.map((id) => [id, window.DS.tasks.PART_NAMES[id]]));
  for (const [id, n] of names) await sel(id).selectOption(n);
  await page.locator('#namesForm [type="submit"]').click(); await sleep(100);
  assert(/Alle Geräte richtig benannt/.test(await panel(page).innerText()), 'Trainer vollständig richtig');
  for (let i = 0; i < 3; i++) await page.locator('[data-tr="fnTip"]').first().click();
  assert((await panel(page).innerText()).includes('Tipp 3/3'), 'drei Tipps im Funktionsteil');
  await page.locator('[data-tr="fnSol"]').click(); await sleep(80);
  await shot(page, '30-trainer-geloest');
  // Geräte erkunden: Hervorhebung und Funktion
  await view(page, 'explore');
  await tapHit(page, 'part:condenser');
  const info = await page.locator('#partInfo').innerText();
  assert(/Liebigkühler/.test(info) && /Kühlwasser/.test(info), 'Geräteinfo');
  await shot(page, '31-geraete-erkunden');
  await done();
  assert(!errors.length, errors.join('; '));
  return 'Tipps 1–3, Lösung mit Rückfrage, Protokoll falsch → teilweise → richtig, Trainer 12/12';
});

// =========================================================== E11 Grafik-Zwischenstände
await scenario('E11', 'Grafik-Zwischenstände und fortlaufende Bildfolgen (Pause hält an)', async () => {
  const { page, errors, done } = await open();
  await speed(page, 10);
  const flaskClip = async () => worldClip(page, 'flask');
  await shot(page, '32-zustand-kalt');
  await prepare(page);
  await speed(page, 30);
  await waitFor(page, (st) => st.fx.boil > 0.2);
  await speed(page, 1); await sleep(800);
  const fc = await flaskClip();
  const a = await grab(page, fc); await sleep(250); const b = await grab(page, fc);
  assert(differs(a, b), 'Siedeblasen bewegen sich');
  await speed(page, 0); await sleep(300);
  const c = await grab(page, fc); await sleep(400); const d = await grab(page, fc);
  assert(!differs(c, d), 'Pause hält die Darstellung an');
  const cc = await worldClip(page, 'condenser');
  await speed(page, 1); await sleep(600);
  const e1 = await grab(page, cc); await sleep(300); const e2 = await grab(page, cc);
  assert(differs(e1, e2), 'Kühlwasserströmung/Kondensat bewegt sich');
  await shot(page, '33-zustand-kondensierend', { clip: cc });
  // Erklärmodus
  await view(page, 'explain'); await sleep(500);
  await shot(page, '34-erklaermodus-teilchen');
  await view(page, 'explain');
  // Detailansicht zeigt denselben Modellzustand
  await speed(page, 30);
  await waitFor(page, (st) => st.fx.cond > 0.02);
  await speed(page, 1);
  await view(page, 'detail'); await sleep(500);
  await shot(page, '35-kuehler-detail');
  const det = await S(page, (st) => [st.fx.cond, st.jacket.fill]);
  assert(det[0] > 0 && det[1] > 0.99, 'Detail: Kondensation und gefüllter Mantel');
  await done();
  assert(!errors.length, errors.join('; '));
  return 'Blasen/Strömung bewegen sich, Pause friert ein';
});

// =========================================================== E12 Responsive & Trennlinie
await scenario('E12', 'Responsive 1440×900, 1180×820, 1024×768 (Touch), Trennlinie Maus/Touch/Tastatur/Doppelklick, Verbindungen intakt', async () => {
  const sizes = [[1440, 900, false], [1180, 820, true], [1024, 768, true]];
  const out = [];
  for (const [w, h, touch] of sizes) {
    const { page, errors, done, context } = await open({ viewport: { width: w, height: h }, hasTouch: touch });
    const coveredAtStart = await page.$$eval('.hit', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== e; }).map((e) => e.dataset.hit));
    assert(!coveredAtStart.length, `${w}×${h} Start: verdeckte Trefferflächen ${coveredAtStart.join(', ')}`);
    await speed(page, 10);
    await prepare(page, { touch });
    await speed(page, 30);
    await waitFor(page, (st, M) => M.vol(st.receiver.c) > 2);
    await speed(page, 1);
    const checkAll = async (tag) => {
      const a = await page.evaluate(() => window.DS.app.renderer.anchors());
      for (const [name, [p, q]] of Object.entries(a.connections)) assert(Math.hypot(p.x - q.x, p.y - q.y) < 0.5, `${tag}: ${name} getrennt`);
      const cv = await page.locator('#lab').boundingBox();
      assert(a.bounds.a.x >= -0.5 && a.bounds.a.y >= -0.5 && a.bounds.b.x <= cv.width + 0.5 && a.bounds.b.y <= cv.height + 0.5, `${tag}: Szene abgeschnitten`);
      // Pflicht-Bedienelemente sichtbar und nicht verdeckt
      for (const sel of ['#btnHeat', '#btnWater', '#heatLevel', '#flowLevel', '#actions', '#views']) {
        const bb = await page.locator(sel).boundingBox();
        assert(bb && bb.y >= 0 && bb.y + bb.height <= h + 0.5 && bb.x >= 0 && bb.x + bb.width <= w + 0.5, `${tag}: ${sel} sichtbar`);
      }
      const hits = await page.$$eval('.hit', (els) => els.map((e) => [e.offsetWidth, e.offsetHeight]));
      assert(hits.every(([x, y]) => x >= 44 && y >= 44), `${tag}: Trefferflächen ≥ 44 px`);
      // jede Trefferfläche ist in ihrer Mitte selbst antippbar (nicht verdeckt)
      const covered = await page.$$eval('.hit', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t !== e; }).map((e) => e.dataset.hit));
      assert(!covered.length, `${tag}: verdeckte Trefferflächen ${covered.join(', ')}`);
    };
    await checkAll(`${w}×${h}`);
    await shot(page, `40-layout-${w}x${h}`);
    const sp = page.locator('#splitter');
    // Maus: mehrfach ziehen (Trennlinie vor jedem Zug neu suchen)
    for (const dx of [-160, 220, -90]) {
      const box = await sp.boundingBox();
      const cy = box.y + box.height / 2, cx = box.x + box.width / 2;
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx, cy, { steps: 6 }); await page.mouse.up();
      await sleep(150);
      await checkAll(`${w}×${h} Maus ${dx}`);
    }
    await shot(page, `41-splitter-gezogen-${w}x${h}`);
    // Touch über CDP
    if (touch) {
      await sp.focus(); await page.keyboard.press('Home'); await sleep(100); // Pos1: Standardbreite
      const cdp = await context.newCDPSession(page);
      const b2 = await sp.boundingBox();
      const x = b2.x + b2.width / 2, y = b2.y + b2.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 20 * k, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(150);
      const after = await sp.boundingBox();
      assert(after.x < b2.x - 40, 'Touch zieht die Trennlinie');
      await checkAll(`${w}×${h} Touch`);
    }
    // Tastatur und Doppelklick
    const pw = async () => (await page.locator('#panel').boundingBox()).width;
    await sp.focus();
    const pw0 = await pw();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    const pw1 = await pw();
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    const pw2 = await pw();
    assert((pw1 < pw0 - 20 || pw0 <= 301) && pw2 > pw1 + 20, `Pfeiltasten verschmälern/verbreitern das Bedienfeld: ${pw0} → ${pw1} → ${pw2}`);
    await checkAll(`${w}×${h} Tastatur`);
    await sp.dblclick();
    await sleep(150);
    await checkAll(`${w}×${h} Reset`);
    assert(!(await page.evaluate(() => window.DS.app.ui.confirmRestart)), 'keine ungewollte Handlung durch das Ziehen');
    // Beschriftung bleibt innerhalb der Bühne
    await view(page, 'labels', touch);
    await sleep(300);
    await shot(page, `42-beschriftung-${w}x${h}`);
    await done();
    assert(!errors.length, errors.join('; '));
    out.push(`${w}×${h} ok`);
  }
  // schmal: gestapelt, Trennlinie ausgeblendet
  const { page, done } = await open({ viewport: { width: 820, height: 1100 }, hasTouch: true });
  assert(!(await page.locator('#splitter').isVisible()), 'Trennlinie bei schmalem Layout ausgeblendet');
  await shot(page, '43-schmal-gestapelt');
  await done();
  return out.join(', ') + ', schmal gestapelt';
});

// =========================================================== Netz- und Konsolenprüfung
await scenario('T04', 'Keine externen Ressourcen, keine Konsolenfehler', async () => {
  const ext = allRequests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:'));
  assert(!ext.length, 'Externe Anfragen: ' + ext.join(', '));
  assert(!allErrors.length, 'Konsolenfehler: ' + allErrors.join('; '));
  return `${allRequests.length} Anfragen, alle lokal`;
});

await browser.close();
server.close();
// Bei ONLY=… werden die übrigen Ergebnisse des letzten Gesamtlaufs beibehalten (mit Datum je Szenario)
const file = path.join(APP, 'tests/e2e/results.json');
const now = new Date().toISOString();
results.forEach((r) => { r.date = now; });
let merged = results;
if (ONLY && fs.existsSync(file)) {
  const old = JSON.parse(fs.readFileSync(file, 'utf8')).results || [];
  merged = old.filter((r) => !ONLY.includes(r.id)).concat(results).sort((a, b) => a.id.localeCompare(b.id));
}
const summary = { date: now, browser: `${browser.__channel} ${browserVersion}`, root: path.relative(APP, ROOT), results: merged };
fs.writeFileSync(file, JSON.stringify(summary, null, 2));
const failed = results.filter((r) => r.status !== 'PASS');
console.log(`\n${results.length - failed.length}/${results.length} Szenarien bestanden.`);
process.exit(failed.length ? 1 : 0);
