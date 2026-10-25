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
  // Ausschalten: Sieden läuft aus, kein Sprung
  await heater(page, false);
  const afterOff = await S(page, (st) => [st.flask.T, st.reading]);
  await speed(page, 30); await sleep(1500);
  const later = await S(page, (st) => [st.flask.T, st.reading, st.fx.vapor]);
  assert(later[0] < afterOff[0] + 1 && afterOff[0] - later[0] < 25, 'kein Temperatursprung nach dem Ausschalten ' + afterOff + ' → ' + later);
  await waitFor(page, (st) => st.fx.vapor === 0 && M.vol(st.film) < 0.01);
  await shot(page, '10-nach-dem-ausschalten');
  await speed(page, 1);
  // Probe nur aus der abgenommenen Vorlage
  await tapHit(page, 'pipette'); await tapHit(page, 'receiver');
  assert(await S(page, (st) => !st.pipette && st.receiver.present), 'keine Probe an der montierten Vorlage');
  await tapHit(page, 'pipette');
  await clickAct(page, 'toggleReceiver');
  await sleep(1100);
  assert(await S(page, (st) => !st.receiver.present), 'Vorlage abgenommen, steht am Prüfplatz');
  await tapHit(page, 'pipette'); await tapHit(page, 'receiver');
  await sleep(700); await shot(page, '09a-probe-wird-entnommen');
  await idle(page);
  assert(await S(page, (st) => !!st.pipette), 'Probe in der Pipette');
  await tapHit(page, 'dish');
  await sleep(1000); await shot(page, '09b-probe-wird-ueberfuehrt');
  await idle(page);
  assert(await S(page, (st) => !!st.dish && !st.pipette), 'Probe in der Schale');
  assert(await S(page, (st) => st.fx.flame === 0), 'keine Flamme ohne Zünden');
  await tapHit(page, 'lighter'); await tapHit(page, 'dish');
  await sleep(950); await shot(page, '09c-zuenden-funke');
  await waitFor(page, (st) => st.fx.flame > 0.2, null, 20000);
  const fl = await S(page, (st) => [st.dish.result, st.fx.flame]);
  assert(fl[0] === 'burns' && fl[1] > 0.2, 'bläuliche Flamme: ' + fl);
  await shot(page, '09-brennprobe-blaue-flamme');
  await waitFor(page, (st) => !st.dish.burning, null, 60000);
  // Vorlage per Antippen zurückstellen, Kühlwasser aus
  await tapHit(page, 'receiver');
  await sleep(1100);
  assert(await S(page, (st) => st.receiver.present), 'Vorlage zurückgestellt');
  await water(page, false);
  await speed(page, 0);
  // Befund 14: Brennprobe in den Ergebnissen als farbige Schrift ohne Hintergrund
  await tab(page, 'results');
  const pill = page.locator('#panelBody .pill.ok').first();
  assert(/bläuliche Flamme/.test(await pill.innerText()), 'Brennprobe in den Ergebnissen');
  const css = await pill.evaluate((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.color]; });
  assert(css[0] === 'rgba(0, 0, 0, 0)' && css[1] === 'rgb(28, 138, 74)', 'grüne Schrift ohne Hintergrund: ' + css.join(' / '));
  await shot(page, '16b-ergebnisse-brennprobe');
  await tab(page, 'task');
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
  const warned = await S(page, (st) => !!st.warned.breakthrough1);
  assert(warned, 'Warnung vor dem Wasserübertritt ausgegeben');
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
  // Befund 6: Die Meldung nennt die Temperatur der Flüssigkeit; die Anzeige oben zeigt nur den Dampf
  const msg = await page.locator('#toast').innerText();
  const shown = await readTemp(page);
  const liquid = await S(page, (st) => st.flask.T);
  const m = msg.match(/Flüssigkeit im Kolben ist noch etwa (\d+) °C heiß/);
  assert(m && Math.abs(Number(m[1]) - liquid) <= 1 && Number(m[1]) > 50 && /misst nur den Dampf/.test(msg), 'Meldung mit Flüssigkeitstemperatur: ' + msg);
  await shot(page, '23b-siedesteine-heisse-fluessigkeit');
  await speed(page, 30);
  await waitFor(page, (st) => st.flask.T < 50);
  await clickAct(page, 'addStones'); await idle(page);
  assert(await S(page, (st) => st.stones), 'Siedesteine nach dem Abkühlen');
  await heater(page, true);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 5);
  await done();
  assert(!errors.length, errors.join('; '));
  return `Siedeverzug → Siedesteine abgelehnt (Anzeige ${de(shown)} °C, Flüssigkeit ${de(liquid)} °C) → Abkühlen → Siedesteine → Destillat`;
});

// =========================================================== E09 Vorlage fehlt, Zünden, kein Stopfen, Trockenlauf, Neubefüllen
await scenario('E09', 'Vorlage fehlt / Zünden am Aufbau / kein Stopfen (Befund 9) / Trockenlauf und Neubefüllen (Befund 8)', async () => {
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
  await sleep(1000);
  await tapHit(page, 'receiver');
  await sleep(1000);
  assert(await S(page, (st) => !st.receiver.present), 'Antippen nimmt die Vorlage ab');
  await tapHit(page, 'receiver');
  await sleep(1000);
  assert(await S(page, (st) => st.receiver.present), 'erneutes Antippen stellt sie zurück');
  // Zünden an der Apparatur
  await tapHit(page, 'lighter'); await tapHit(page, 'condenser');
  assert(await S(page, (st) => st.safety && st.safety.code === 'ignite'), 'Stopp Zünden');
  await shot(page, '25-stopp-zuenden-am-aufbau');
  await page.locator('#btnAck').click();
  // Befund 9: Vorstoß mit Belüftung – es gibt keinen Stopfen und keinen Stopp „geschlossene Apparatur“
  assert(!(await page.locator('[data-act="toggleStopper"]').count()), 'kein Stopfen-Knopf');
  assert(!/Stopfen/.test(await page.locator('#deck').innerText()), 'Bedienleiste ohne „Stopfen“');
  await heater(page, true);
  assert(await S(page, (st) => st.heater.on && !st.safety), 'Heizen ohne Stopp');
  // Trockenlauf
  await speed(page, 30);
  await heatLevel(page, 'high'); await flow(page, 'high');
  await waitFor(page, (st) => !!st.safety, null, 400000);
  const code = await S(page, (st) => st.safety.code);
  assert(code === 'dry', 'Trockenlauf-Stopp: ' + code);
  await shot(page, '26-stopp-trockenlauf');
  await page.locator('#btnAck').click();
  // Befund 8: leer destillierter Kolben – nach dem Abkühlen neu befüllen, ohne neuen Versuch
  const fillBtn = page.locator('#actions [data-act="fill"]');
  assert(!(await fillBtn.isDisabled()) && (await fillBtn.innerText()).trim() === 'Einfüllen', 'Einfüllen wieder möglich: ' + (await fillBtn.innerText()));
  await clickAct(page, 'fill');
  assert(/noch warm/.test(await page.locator('#toast').innerText()), 'heiß: Hinweis auf die Wärme statt „schon befüllt“');
  await waitFor(page, (st) => st.flask.T < 40 && st.mantleT < 45, null, 400000);
  await speed(page, 10);
  const v0 = await S(page, (st, M) => M.vol(st.flask.c));
  await tapHit(page, 'bottle'); await idle(page);
  const v1 = await S(page, (st, M) => [M.vol(st.flask.c), st.run]);
  assert(Math.abs(v1[0] - v0 - 100) < 1e-6 && v1[1] === 1, `neu befüllt: ${v0.toFixed(1)} → ${v1[0].toFixed(1)} mL, Versuch ${v1[1]}`);
  assert(await fillBtn.isDisabled(), 'voll: wieder „Eingefüllt“');
  await shot(page, '26b-neu-befuellt');
  await heater(page, true);
  assert(await S(page, (st) => st.heater.on), 'Heizen nach dem Nachfüllen');
  await done();
  assert(!errors.length, errors.join('; '));
  return `Tisch statt Vorlage, Zünden, kein Stopfen, Trockenlauf gestoppt, neu befüllt (${v0.toFixed(1)} → ${v1[0].toFixed(1)} mL)`;
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
  // Geräte erkunden: Hervorhebung und Funktion, keine Handgriffe und keine Fehlermeldungen
  await view(page, 'explore');
  assert(await page.locator('#btnWater').isDisabled() && await page.locator('#actions [data-act="fill"]').isDisabled(), 'Handgriffe beim Erkunden gesperrt');
  assert(!(await page.locator('[data-hit="tap"]').count()), 'keine Handgriffe auf der Bühne');
  await tapHit(page, 'part:condenser');
  const info = await page.locator('#partInfo').innerText();
  assert(/Liebigkühler/.test(info) && /Kühlwasser/.test(info), 'Geräteinfo');
  await tapHit(page, 'part:mixture');
  assert(/Gemisch/.test(await page.locator('#partInfo').innerText()), 'Gemisch erkundbar');
  await tapHit(page, 'part:stones');
  assert(/Siedesteine/.test(await page.locator('#partInfo').innerText()), 'Siedesteine erkundbar');
  assert(!(await page.locator('#toast.show').count()), 'keine Meldung beim Erkunden');
  await shot(page, '31-geraete-erkunden');
  await view(page, 'labels');
  assert(await page.locator('#btnHeat').isDisabled(), 'Handgriffe bei Beschriftung gesperrt');
  await shot(page, '31b-beschriftung-vor-dem-versuch');
  await view(page, 'labels');
  await tapHit(page, 'bottle');
  await idle(page);
  assert(await page.locator('#views [data-view="labels"]').isDisabled() && await page.locator('#views [data-view="explore"]').isDisabled(), 'Namen/Erkunden während des Versuchs gesperrt');
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
await scenario('E12', 'Responsive 1440×900, 1180×820, 1024×768, 768×1024 (Touch), Trennlinie Maus/Touch/Tastatur/Doppelklick, Verbindungen intakt; Apparatur größer (Befund 11)', async () => {
  const sizes = [[1440, 900, false], [1180, 820, true], [1024, 768, true], [768, 1024, true]];
  const out = [];
  for (const [w, h, touch] of sizes) {
    const { page, errors, done, context } = await open({ viewport: { width: w, height: h }, hasTouch: touch });
    const coveredAtStart = await page.$$eval('.hit', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== e; }).map((e) => e.dataset.hit));
    assert(!coveredAtStart.length, `${w}×${h} Start: verdeckte Trefferflächen ${coveredAtStart.join(', ')}`);
    await view(page, 'labels', touch);
    await sleep(300);
    await shot(page, `42-beschriftung-${w}x${h}`);
    await view(page, 'labels', touch);
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
    // Befund 11: Maßstab gegenüber 0.2.0 (Szene 1210 × 710 mm, Meldungsband 54 px) bei gleicher Bühne um mindestens 6 % größer
    const sc = await page.evaluate(() => { const v = window.DS.app.renderer.view; return [v.scale, Math.min((v.w - 16) / 1210, (v.h - 62) / 710)]; });
    assert(sc[0] >= sc[1] * 1.06, `${w}×${h}: Maßstab ${sc[0].toFixed(3)} statt bisher ${sc[1].toFixed(3)}`);
    const sp = page.locator('#splitter');
    if (!(await sp.isVisible())) { await done(); assert(!errors.length, errors.join('; ')); out.push(`${w}×${h} gestapelt ok (Maßstab ${sc[0].toFixed(3)})`); continue; }
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

// =========================================================== Befunde der Durchsicht (0.3.0)
/** Alle Texte, die die Bühne im nächsten Bild zeichnet, mit Lage in CSS-Pixeln (nur lesen: fillText wird mitprotokolliert). */
async function drawnTexts(page) {
  return page.evaluate(() => new Promise((res) => {
    const cv = document.querySelector('#lab'), ctx = cv.getContext('2d'), orig = ctx.fillText, seen = [];
    const dpr = cv.width / cv.getBoundingClientRect().width;
    ctx.fillText = function (t, x, y) {
      const m = this.getTransform(), w = this.measureText(t).width * m.a / dpr, sx = (m.a * x + m.e) / dpr, sy = (m.d * y + m.f) / dpr;
      const x0 = this.textAlign === 'left' || this.textAlign === 'start' ? sx : this.textAlign === 'right' || this.textAlign === 'end' ? sx - w : sx - w / 2;
      seen.push({ t: String(t), x0, x1: x0 + w, y: sy });
      return orig.apply(this, arguments);
    };
    requestAnimationFrame(() => requestAnimationFrame(() => { ctx.fillText = orig; res(seen); }));
  }));
}
/** Weltrechteck → CSS-Pixel relativ zur Bühne. */
const worldToStage = (page, box) => page.evaluate((b) => { const v = window.DS.app.renderer.view; return { x0: b.x0 * v.scale + v.ox, y0: b.y0 * v.scale + v.oy, x1: b.x1 * v.scale + v.ox, y1: b.y1 * v.scale + v.oy }; }, box);
/** Rote (Ethanol) und blaue (Wasser) Teilchenpixel im seitlichen Abgang, über mehrere Bilder gezählt. */
async function particlePixels(page, frames = 14) {
  return page.evaluate((n) => new Promise((res) => {
    const r = window.DS.app.renderer, g = r.geo, v = r.view, cv = document.querySelector('#lab'), ctx = cv.getContext('2d');
    const dpr = cv.width / cv.getBoundingClientRect().width;
    const a = g.arm.start, b = g.arm.end;
    const x0 = Math.round((Math.min(a.x, b.x) * v.scale + v.ox + 3) * dpr), x1 = Math.round((Math.max(a.x, b.x) * v.scale + v.ox - 6) * dpr);
    const y0 = Math.round(((Math.min(a.y, b.y) - g.arm.hw) * v.scale + v.oy) * dpr), y1 = Math.round(((Math.max(a.y, b.y) + g.arm.hw) * v.scale + v.oy) * dpr);
    let red = 0, blue = 0, k = 0;
    const tick = () => {
      const d = ctx.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i], G = d[i + 1], B = d[i + 2];
        if (R > 170 && G < 115 && B < 120) red++;
        else if (B > 190 && R < 110 && G < 160) blue++;
      }
      if (++k < n) setTimeout(() => requestAnimationFrame(tick), 70); else res({ red, blue });
    };
    requestAnimationFrame(tick);
  }), frames);
}

await scenario('E13', 'Befunde 1, 15, 17: Start mit 1×, „Namen“ aus und nach „Erkunden“ (auch nach Neuladen); Bedienknöpfe in einer Zeile, Knopf „Vorlage“', async () => {
  const { page, errors, done } = await open();
  const order = await page.$$eval('#views [data-view]', (els) => els.map((e) => e.dataset.view));
  assert(order.indexOf('labels') === order.indexOf('explore') + 1, 'Namen steht nach Erkunden: ' + order.join(', '));
  const pressed = async (sel) => page.locator(sel).getAttribute('aria-pressed');
  assert(await pressed('#views [data-view="labels"]') === 'false', 'Namen beim Start aus');
  assert(await pressed('#speed [data-speed="1"]') === 'true', 'Start mit 1×');
  const t0 = await S(page, (st) => st.t); await sleep(1000); const t1 = await S(page, (st) => st.t);
  assert(t1 - t0 > 0.8 && t1 - t0 < 1.4, 'Modellzeit läuft in Echtzeit: ' + (t1 - t0).toFixed(2) + ' s');
  const tops = () => page.$$eval('#actions > *, #deck .ctl > *', (els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  let ys = await tops();
  assert(Math.max(...ys) - Math.min(...ys) <= 2, 'eine Zeile beim Start: ' + ys.join(','));
  assert((await page.locator('#actions [data-act="toggleReceiver"]').innerText()).trim() === 'Vorlage', 'Knopf heißt „Vorlage“');
  assert((await page.locator('#actions [data-act="toggleReceiver"]').getAttribute('aria-label')) === 'Vorlage abnehmen', 'Bedeutung für Bildschirmleser');
  // Namen einschalten, Tempo ändern, neu laden: Start wieder mit Namen aus und 1×
  await view(page, 'labels'); await speed(page, 10); await sleep(700);
  await page.reload(); await page.waitForFunction(() => window.DS && window.DS.app); await sleep(300);
  assert(await pressed('#views [data-view="labels"]') === 'false', 'Namen nach dem Neuladen aus');
  assert(await pressed('#speed [data-speed="1"]') === 'true', '1× nach dem Neuladen');
  await prepare(page); await idle(page); await sleep(700);
  ys = await tops();
  assert(Math.max(...ys) - Math.min(...ys) <= 2, 'eine Zeile mit „Eingefüllt ✓“ und Heizung EIN: ' + ys.join(','));
  await shot(page, '44-bedienzeile-1440x900', { clip: await page.locator('#deck').boundingBox() });
  await done();
  assert(!errors.length, errors.join('; '));
  return `Ansicht: ${order.join(' · ')}; Bedienleiste mit ${ys.length} Elementen in einer Zeile`;
});

await scenario('E14', 'Befunde 2, 3, 4, 7: Erklärhinweis oben ohne Überdeckung, Vorlagen-Anzeige nach „Diagramm“, Skala ohne „mL“, Teilchen nach Dampfzusammensetzung (Ethanol rot, bei 99,9 °C nur Wasser blau)', async () => {
  const { page, errors, done } = await open();
  await speed(page, 10);
  await prepare(page);
  await speed(page, 30);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 1.5);
  await speed(page, 1);
  await view(page, 'explain'); await sleep(400);
  // Befund 2: Hinweis in der Leiste über der Bühne, nicht auf der Laborbühne
  const note = await page.locator('#explainNote').boundingBox(), cv = await page.locator('#lab').boundingBox();
  assert(note && note.y + note.height <= cv.y + 0.5, 'Hinweis oberhalb der Bühne');
  const noteTxt = await page.locator('#explainNote').innerText();
  assert(/in Wirklichkeit unsichtbar/.test(noteTxt) && /Ethanol/.test(noteTxt) && /Wasser/.test(noteTxt), 'Hinweis mit Legende: ' + noteTxt);
  // Befund 7: Ethanol-Abschnitt → rote Teilchen
  const pe = await particlePixels(page);
  const vyE = await S(page, (st) => st.fx.py.map((x) => +x.toFixed(3)));
  assert(pe.red > 20 && pe.blue * 10 < pe.red, `Ethanol-Abschnitt: rot ${pe.red}, blau ${pe.blue} px (Dampf ${vyE})`);
  await shot(page, '34b-teilchen-ethanol');
  // Befunde 3 und 4: Füllmenge nur in der Leiste, Skala ohne Einheit
  await speed(page, 0); await sleep(600);
  const texts = await drawnTexts(page);
  assert(!texts.some((x) => /^Vorlage \d+:/.test(x.t)), 'kein Vorlagen-Schild auf der Bühne');
  assert(texts.some((x) => x.t === '40') && texts.some((x) => x.t === '80') && !texts.some((x) => /\d+ mL$/.test(x.t)), 'Skala „40“/„80“ ohne „mL“');
  const chip = page.locator('#recvChip');
  const vol0 = await S(page, (st, M) => M.vol(st.receiver.c));
  assert((await chip.innerText()).trim() === `Vorlage 1: ${de(vol0)} mL`, 'Anzeige stimmt: ' + (await chip.innerText()) + ' / ' + vol0);
  const isAfter = await page.evaluate(() => { const c = document.querySelector('#recvChip'), d = document.querySelector('#views [data-view="chart"]'); return !!(d.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); });
  const cb = await chip.boundingBox(), db = await page.locator('#views [data-view="chart"]').boundingBox();
  assert(isAfter && (cb.x >= db.x + db.width || cb.y >= db.y + db.height - 1) && cb.y + cb.height <= cv.y + 0.5, 'Anzeige nach „Diagramm“ in der Leiste');
  await shot(page, '47-leiste-vorlage', { clip: await page.locator('#actionbar').boundingBox() });
  await shot(page, '48-skala-ohne-ml', { clip: await worldClip(page, 'receiver') });
  // Befund 7: nach dem Ethanol, bei 99,9 °C → nur noch Wasser (blau)
  await speed(page, 30);
  await waitFor(page, (st) => st.flask.c.E === 0 && st.reading > 99.5 && st.fx.pass > 1e-4, null, 300000);
  await speed(page, 1); await sleep(300);
  const pw = await particlePixels(page);
  const T = await readTemp(page);
  assert(pw.blue > 20 && pw.red === 0, `Wasser-Abschnitt (${de(T)} °C): blau ${pw.blue}, rot ${pw.red} px`);
  await shot(page, '34c-teilchen-wasser');
  await done();
  assert(!errors.length, errors.join('; '));
  return `Ethanol: rot ${pe.red}/blau ${pe.blue} px; ${de(T)} °C: blau ${pw.blue}/rot ${pw.red} px`;
});

await scenario('E15', 'Befunde 5, 12: Kühler-Detail ohne überstehende Beschriftung; Diagramm antippen → bildschirmfüllend → antippen/Escape → klein (vier Ansichten)', async () => {
  const out = [];
  for (const [w, h, touch] of [[1440, 900, false], [1180, 820, true], [1024, 768, true], [768, 1024, true]]) {
    const { page, errors, done } = await open({ viewport: { width: w, height: h }, hasTouch: touch });
    await speed(page, 10);
    await prepare(page, { touch });
    await speed(page, 30);
    await waitFor(page, (st) => st.fx.cond > 0.02 && st.fx.flow > 0);
    await speed(page, 1);
    await view(page, 'detail', touch); await sleep(300);
    const o = await worldToStage(page, await page.evaluate(() => window.DS.app.renderer.geo.overlay));
    const texts = (await drawnTexts(page)).filter((x) => x.x0 >= o.x0 - 1 && x.x0 <= o.x1 && x.y >= o.y0 && x.y <= o.y1);
    const over = texts.filter((x) => x.x1 > o.x1 - 2);
    assert(texts.some((x) => /Kühlwasser im Mantel/.test(x.t)) && texts.some((x) => /strömt zum Ablauf/.test(x.t)), `${w}×${h}: Beschriftung vorhanden`);
    assert(!over.length, `${w}×${h}: über den Rand: ${over.map((x) => x.t + ' (' + Math.round(x.x1 - o.x1) + ' px)').join('; ')}`);
    await shot(page, `35-kuehler-detail-${w}x${h}`);
    await view(page, 'detail', touch);
    // Diagramm: Antippen vergrößert auf die ganze Bühne, erneutes Antippen verkleinert
    await view(page, 'chart', touch); await sleep(200);
    const small = await page.locator('[data-hit="chart"]').boundingBox();
    await tapHit(page, 'chart', touch); await sleep(250);
    const big = await page.locator('[data-hit="chart"]').boundingBox(), cvb = await page.locator('#lab').boundingBox();
    assert(await page.evaluate(() => window.DS.app.ui.chartBig) && big.width >= cvb.width - 40 && big.height >= cvb.height - 80 && big.width > small.width * 1.4, `${w}×${h}: groß ${Math.round(big.width)}×${Math.round(big.height)} (Bühne ${Math.round(cvb.width)}×${Math.round(cvb.height)})`);
    assert((await page.locator('.hit').count()) === 1, 'groß: nur die Diagrammfläche ist antippbar');
    await shot(page, `45-diagramm-gross-${w}x${h}`);
    await tapHit(page, 'chart', touch); await sleep(250);
    assert(!(await page.evaluate(() => window.DS.app.ui.chartBig)), `${w}×${h}: wieder klein`);
    await tapHit(page, 'chart', touch); await page.keyboard.press('Escape'); await sleep(150);
    assert(!(await page.evaluate(() => window.DS.app.ui.chartBig)), 'Escape verkleinert');
    await done();
    assert(!errors.length, errors.join('; '));
    out.push(`${w}×${h} ok`);
  }
  return out.join(', ');
});

await scenario('E16', 'Befunde 13, 16: Uhr steht nach dem Versuch und läuft beim erneuten Heizen weiter; nach dem Abkühlen auf 20 °C keine Blasen', async () => {
  const { page, errors, done } = await open();
  await speed(page, 10);
  await prepare(page);
  await speed(page, 30);
  await waitFor(page, (st, M) => M.vol(st.receiver.c) > 3);
  await heater(page, false);
  await waitFor(page, (st) => st.ended);
  await sleep(300);
  const c1 = await page.locator('#clock').innerText(); await sleep(2500); const c2 = await page.locator('#clock').innerText();
  assert(c1 === c2 && /stopped/.test(await page.locator('#clock').getAttribute('class')), `Uhr steht: ${c1} → ${c2}`);
  await shot(page, '49-uhr-angehalten', { clip: await page.locator('.lk-head').boundingBox() });
  // weiter abkühlen bis Raumtemperatur: keine Siede- und Keimblasen mehr
  await waitFor(page, (st) => st.flask.T < 21 && st.reading < 21, null, 300000);
  assert(await page.locator('#clock').innerText() === c1, 'Uhr steht weiterhin');
  await speed(page, 1); await sleep(500);
  const fc = await worldClip(page, 'flask');
  const a = await grab(page, fc); await sleep(500); const b = await grab(page, fc);
  const fx = await S(page, (st) => [st.fx.boil, st.fx.nucleate, st.flask.T]);
  assert(fx[0] === 0 && fx[1] === 0 && !differs(a, b), `ruhig bei ${de(fx[2])} °C: boil ${fx[0]}, Keime ${fx[1]}, Bild ${differs(a, b) ? 'bewegt' : 'unverändert'}`);
  await shot(page, '46-abgekuehlt-ohne-blasen', { clip: fc });
  // erneutes Heizen: Uhr läuft weiter
  await heater(page, true); await sleep(1600);
  const c3 = await page.locator('#clock').innerText();
  assert(c3 !== c1 && !/stopped/.test(await page.locator('#clock').getAttribute('class')), `Uhr läuft weiter: ${c1} → ${c3}`);
  await done();
  assert(!errors.length, errors.join('; '));
  return `Uhr ${c1} angehalten, nach erneutem Heizen ${c3}; Kolben ${de(fx[2])} °C ohne Blasen`;
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
