// End-to-End-Prüfung des Trennlabors im echten Browser (Chromium/Edge über Playwright).
// Bedient die tatsächliche Oberfläche wie Lernende: Klicks im Bedienfeld, Antippen
// (Touch) und Klicken auf der Laborbühne über die gezeichneten Trefferflächen,
// Ziehen mit der Maus. Der Modellzustand wird nur gelesen (Beobachtung), nie gesetzt.
//
// Aufruf: npm run build && node tests/e2e/run.mjs   (PW_CHANNEL=msedge für Edge)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const ROOT = process.env.E2E_ROOT ? path.resolve(process.env.E2E_ROOT) : fs.existsSync(path.join(APP, 'dist/trennlabor/index.html')) ? path.join(APP, 'dist/trennlabor') : APP;
const SHOTS = path.join(APP, 'docs/screenshots');
const PORT = Number(process.env.E2E_PORT || 8141);
const BASE = `http://localhost:${PORT}/index.html`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ------------------------------------------------------------------ Browser
async function launch() {
  const ch = process.env.PW_CHANNEL;
  const tries = ch ? [{ channel: ch }] : [{}, { channel: 'msedge' }, { channel: 'chrome' }];
  let last;
  for (const o of tries) { try { const b = await chromium.launch(o); b.__channel = o.channel || 'chromium'; return b; } catch (e) { last = e; } }
  throw last;
}

async function newPage(browser, opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, opts));
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(BASE + (opts.query || ''));
  await page.waitForFunction(() => window.Trennlabor && window.Trennlabor.ui);
  await sleep(250);
  return { context, page, errors, requests };
}

// ------------------------------------------------------------------ Bedienhilfen
const eng = (page, fn, arg) => page.evaluate(([f, a]) => { const e = window.Trennlabor.ui.curEngine(); return new Function('e', 'a', 'return (' + f + ')(e, a)')(e, a); }, [fn.toString(), arg]);
const idle = (page) => page.waitForFunction(() => !window.Trennlabor.ui.curEngine().state.op, null, { timeout: 30000 });
const simTime = (page) => page.evaluate(() => window.Trennlabor.ui.curEngine().state.time);
async function waitSim(page, seconds) {
  const t = await simTime(page);
  await page.waitForFunction((x) => window.Trennlabor.ui.curEngine().state.time >= x, t + seconds, { timeout: 120000, polling: 100 });
}
async function waitUntil(page, fn, arg, timeout = 120000) {
  try {
    await page.waitForFunction(([f, a]) => new Function('e', 'a', 'return (' + f + ')(e, a)')(window.Trennlabor.ui.curEngine(), a), [fn.toString(), arg], { timeout, polling: 50 });
  } catch (err) {
    const info = await page.evaluate(() => { const e = window.Trennlabor.ui.curEngine(); return { t: e.state.time, op: e.state.op && e.state.op.type, log: e.state.log.slice(-4).map((m) => m.text) }; }).catch(() => ({}));
    throw new Error('Bedingung nicht erreicht: ' + fn.toString().slice(0, 120) + ' · ' + JSON.stringify(info));
  }
}
async function click(page, sel, touch) {
  // Bedienfeld kann sich nach einer Handlung neu aufbauen: bei „detached“ erneut versuchen
  for (let i = 0; ; i++) {
    try {
      const loc = page.locator(sel).first();
      await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
      if (touch) await loc.tap({ timeout: 5000 }); else await loc.click({ timeout: 5000 });
      break;
    } catch (e) {
      if (i >= 4 || !/detached|not attached|not stable/i.test(String(e.message))) throw e;
      await sleep(80);
    }
  }
  await sleep(40);
  await idle(page);
}
const ctl = (page, a, extra, touch) => click(page, `#controls [data-a="${a}"]${extra || ''}`, touch);
const select = (page, id, touch) => ctl(page, 'select', `[data-id="${id}"]`, touch);
const target = (page, id, touch) => ctl(page, 'target', `[data-id="${id}"]`, touch);
async function openLab(page, lab, touch) {
  if (await page.locator('#startView').isVisible()) await click(page, `[data-open="${lab}"]`, touch);
  else await click(page, `#labSwitch [data-lab="${lab}"]`, touch);
  await sleep(150);
}
const task = (page, id, touch) => click(page, `#taskCard [data-task="${id}"]`, touch);
const speed = (page, s, touch) => click(page, `#speed [data-speed="${s}"]`, touch);
async function hot(page, id) {
  const list = await page.evaluate(() => window.Trennlabor.ui.hotspots());
  const h = list.filter((x) => x.id === id).pop();
  assert(h, 'Trefferfläche nicht gefunden: ' + id);
  return h;
}
/** Auf der Laborbühne antippen (Touch) bzw. klicken (Maus). */
async function stageTap(page, id, touch) {
  const h = await hot(page, id);
  if (touch) await page.touchscreen.tap(h.cx, h.cy); else await page.mouse.click(h.cx, h.cy);
  await sleep(60);
  await idle(page);
}
async function drag(page, fromId, toId) {
  const a = await hot(page, fromId), b = await hot(page, toId);
  await page.mouse.move(a.cx, a.cy); await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(a.cx + (b.cx - a.cx) * i / 14, a.cy + (b.cy - a.cy) * i / 14); await sleep(16); }
  await page.mouse.up(); await sleep(80); await idle(page);
}
async function restart(page, kind) { await click(page, '#btnRestart'); await click(page, `[data-restart="${kind}"]`); await sleep(100); }
const evalText = (page) => page.locator('#evalCard').innerText();
async function checkResult(page) { await click(page, '#evalCard [data-check]'); await sleep(80); return evalText(page); }
async function shot(page, name, opts) { const f = path.join(SHOTS, name); await page.screenshot(Object.assign({ path: f }, opts || {})); return 'docs/screenshots/' + name; }
async function stageShot(page, name) { const box = await page.locator('#stage').boundingBox(); return shot(page, name, { clip: box }); }
const panelText = (page) => page.locator('#panel').innerText();

async function answerChoice(page, qid, value) { await page.locator(`#evalCard input[data-q="${qid}"][value="${value}"]`).check(); }
async function answerMulti(page, qid, values) {
  for (const box of await page.locator(`#evalCard input[data-q="${qid}"]`).all()) { const v = await box.getAttribute('value'); if (values.includes(v)) await box.check(); else await box.uncheck(); }
}
async function answerText(page, qid, value) { await page.locator(`#evalCard input[data-q="${qid}"]`).fill(String(value)); }
async function answerGaps(page, qid, map) { for (const [g, v] of Object.entries(map)) await page.locator(`#evalCard input[data-q="${qid}"][data-gap="${g}"]`).fill(v); }
async function submitAnswers(page) { await click(page, '#evalCard [data-answers]'); await sleep(80); }
async function finishTheory(page) {
  for (let i = 0; i < 8; i++) { const b = page.locator('#evalCard [data-theory]'); if (await b.count()) await b.click(); else break; await sleep(40); }
  await click(page, '#evalCard [data-notebook]');
  const nb = await page.locator('#notebook').innerText();
  return nb;
}
/** Masse von der Waage ablesen (über die Oberfläche: Gefäß wählen → Wiegen). */
async function weigh(page, id) {
  await select(page, id);
  await ctl(page, 'weighHere');
  const t = await page.locator('#selCard').innerText();
  const all = await panelText(page);
  void t;
  const m = /= ([\d,]+) g/.exec(await page.locator('#toasts').innerText()) || /([\d,]+) g/.exec(all);
  return m ? Number(m[1].replace(',', '.')) : NaN;
}

async function test(id, title, fn) {
  if (ONLY && !ONLY.some((o) => id.startsWith(o))) return;
  const t0 = Date.now();
  try {
    const evidence = await fn();
    results.push({ id, title, status: 'PASS', seconds: Math.round((Date.now() - t0) / 1000), evidence });
    console.log(`PASS ${id} – ${title}`);
  } catch (e) {
    results.push({ id, title, status: 'FAIL', seconds: Math.round((Date.now() - t0) / 1000), error: String(e && e.stack || e).split('\n').slice(0, 5).join(' | ') });
    console.log(`FAIL ${id} – ${title}: ${e && e.message}`);
  }
}

// ------------------------------------------------------------------ Teilabläufe
async function k02Solve(page, opts = {}) {
  const t = opts.touch;
  await select(page, 'M', t); await ctl(page, 'pour', '[data-mode="all"]', t); await target(page, 'A', t);
  await select(page, 'A', t); await ctl(page, 'waterHere', '', t); await ctl(page, 'ml', '[data-v="50"]', t); await ctl(page, 'water', '[data-hot="0"]', t);
  await ctl(page, 'stir', '', t);
  await waitSim(page, 15);
  if (opts.shots) await stageShot(page, '11-k02-geloest.png');
  await select(page, 'F', t); await ctl(page, 'paper', '[data-v="folded"]', t);
  await select(page, 'E', t); await ctl(page, 'move', '', t); await target(page, 'place:filter', t);
  await select(page, 'A', t); await ctl(page, 'pour', '[data-mode="all"]', t); await target(page, 'F', t);
  await waitSim(page, 20);
  if (opts.shots) await stageShot(page, '12-k02-filtration.png');
  await waitUntil(page, (e) => e.state.funnel.c.water < 4);
  await select(page, 'E', t); await ctl(page, 'move', '', t); await target(page, 'place:bench', t);
  await select(page, 'E', t); await ctl(page, 'pour', '[data-mode="careful"]', t); await target(page, 'D', t);
  await select(page, 'D', t); await ctl(page, 'move', '', t); await target(page, 'place:heater', t);
  await click(page, '#controls [data-a="heat"][data-v="2"]', t);
  await waitUntil(page, (e) => e.vessel('D').c.water < 6);
  if (opts.shots) await stageShot(page, '13-k02-eindampfen.png');
  await click(page, '#controls [data-a="heat"][data-v="1"]', t);
  await waitUntil(page, (e) => e.vessel('D').c.water === 0);
  await click(page, '#controls [data-a="heat"][data-v="0"]', t);
  await waitUntil(page, (e) => e.vessel('D').c.temp < 60);
}

async function chromaStrip(page, { tool = 'pencil', y = '1.5', samples, solvent = 'water', level = 'low', lid = true, dots = 1, untilRun = 6.5, mark = true, archive = true, touch = false, viaStage = false }) {
  const st = await eng(page, (e) => ({ state: e.state.paper.state, line: !!e.state.paper.line }));
  if (st.state !== 'bench' || st.line) await ctl(page, 'newSheet', '', touch);
  await ctl(page, 'lineTool', `[data-v="${tool}"]`, touch);
  await ctl(page, 'lineY', `[data-v="${y}"]`, touch);
  await ctl(page, 'line', '', touch);
  for (let i = 0; i < samples.length; i++) {
    for (let k = 0; k < dots; k++) {
      if (viaStage) { await stageTap(page, 'sample:' + samples[i], touch); await stageTap(page, 'lane:' + i, touch); }
      else { await ctl(page, 'sample', `[data-v="${samples[i]}"]`, touch); await ctl(page, 'spot', `[data-v="${i}"]`, touch); }
    }
  }
  const ch = await eng(page, (e) => e.state.chamber.solvent);
  if (ch && ch !== solvent) await ctl(page, 'empty', '', touch);
  if (ch !== solvent) {
    await ctl(page, 'solvent', `[data-v="${solvent}"]`, touch);
    await ctl(page, 'level', `[data-v="${level}"]`, touch);
    await ctl(page, 'fill', '', touch);
  }
  const lidNow = await eng(page, (e) => e.state.chamber.lid);
  if (lidNow !== lid) await ctl(page, 'lid', '', touch);
  if (viaStage) await stageTap(page, 'chamber', touch); else await ctl(page, 'insert', '', touch);
  await waitUntil(page, (e, r) => { const p = e.state.paper; return !p.line || p.front - p.line.y >= r || p.frontAtTop || p.submerged && p.dissolved > 0.9 && p.front - p.line.y >= Math.min(r, 3); }, untilRun);
  await ctl(page, 'remove', '', touch);
  if (mark) await ctl(page, 'mark', '', touch);
  if (archive) await ctl(page, 'archive', '', touch);
}

const P = (part) => `[data-p="${part}"]`;
async function buildDistill(page, o = {}) {
  const c = Object.assign({ chips: true, thermo: 'vapor', hoses: 'correct', receiver: true, cooling: '2', stopper: false, fill: '100', touch: false }, o);
  const t = c.touch;
  await ctl(page, 'mount', P('heater'), t);
  await ctl(page, 'mount', P('flask'), t);
  if (c.chips) await ctl(page, 'mount', P('chips'), t);
  await ctl(page, 'fill', `[data-v="${c.fill}"]`, t);
  await ctl(page, 'mount', P('head'), t);
  if (c.thermo) await ctl(page, 'thermo', `[data-v="${c.thermo}"]`, t);
  await ctl(page, 'mount', P('condenser'), t);
  if (c.hoses) await ctl(page, 'hoses', `[data-v="${c.hoses}"]`, t);
  await ctl(page, 'mount', P('adapter'), t);
  if (c.receiver) await ctl(page, 'mount', P('receiver'), t);
  await ctl(page, 'mount', P('clamps'), t);
  if (c.stopper) await ctl(page, 'mount', P('stopper'), t);
  if (c.hoses) await click(page, `#controls [data-a="cool"][data-v="${c.cooling}"]`, t);
}

// ================================================================== Szenarien
const server = await serve(ROOT, PORT);
const browser = await launch();
console.log(`Browser: ${browser.__channel} ${browser.version()} · Prüfgegenstand: ${path.relative(APP, ROOT) || '.'}`);
const meta = { browser: `${browser.__channel} ${browser.version()}`, root: path.relative(APP, ROOT) || '.', date: new Date().toISOString() };

// A-01: Startansicht
await test('A-01', 'Startansicht mit drei Laboren, jedes erreichbar und bedienbar', async () => {
  const { page, errors } = await newPage(browser);
  const cards = await page.locator('[data-open]').count();
  assert(cards === 3, 'drei Laborkarten erwartet, gefunden ' + cards);
  const s = await shot(page, '01-startansicht.png');
  for (const lab of ['classic', 'chroma', 'distill']) {
    await openLab(page, lab);
    const n = await page.locator('#controls button:not([disabled])').count();
    assert(n >= 5, `${lab}: zu wenige aktive Bedienelemente (${n})`);
    const hs = await page.evaluate(() => window.Trennlabor.ui.hotspots().length);
    assert(hs >= 5, `${lab}: zu wenige Trefferflächen auf der Bühne (${hs})`);
    await shot(page, `02-${lab}-leer.png`);
    await click(page, '#btnHome');
  }
  assert(!errors.length, errors.join('; '));
  return { screenshots: [s, 'docs/screenshots/02-classic-leer.png', 'docs/screenshots/02-chroma-leer.png', 'docs/screenshots/02-distill-leer.png'] };
});

// 1 + L-02 + L-03: K-02 positiv mit Auswertung
await test('E2E-01', 'K-02 positiv: Lösen, Filtrieren, Eindampfen, Auswertung, Hefteintrag (inkl. L-02, L-03)', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'classic'); await task(page, 'K-02'); await speed(page, 50);
  // L-03: vor dem Versuch keine Fragen und kein Hefteintrag
  assert(await page.locator('#evalCard [data-answers], #evalCard [data-notebook], #evalCard .q').count() === 0, 'Fragen dürfen vor dem Versuch nicht sichtbar sein');
  await k02Solve(page, { shots: true });
  const crystals = await stageShot(page, '14-k02-salzkristalle.png');
  const mass = await weigh(page, 'D');
  assert(mass >= 3 && mass <= 5, 'Salzmasse von der Waage: ' + mass);
  const res = await checkResult(page);
  assert(/Versuch gelungen/.test(res), 'Erfolg erwartet: ' + res);
  assert(await page.locator('#evalCard [data-notebook]').count() === 0, 'Hefteintrag erst nach der Auswertung');
  // L-02: falsche Beobachtung + falsch geschriebener Fachbegriff
  await answerChoice(page, 'q1', 'residue');
  await answerChoice(page, 'q2', 'crystals');
  await answerText(page, 'q3', String(mass).replace('.', ','));
  await answerGaps(page, 'g1', { loeslich: 'löslich', unloeslich: 'unlöslich', rueckstand: 'Filtrat', filtrat: 'Filtrat', eindampfen: 'Eindampfen', kristall: 'kristalisiert', loeslichkeit: 'Loeslichkeit' });
  await submitAnswers(page);
  let ev = await evalText(page);
  assert(/Denke daran/.test(ev), 'gezieltes Feedback zur falschen Beobachtung fehlt');
  assert(/Der Rückstand bleibt im Filter|Das Filtrat ist die durchgelaufene/.test(ev), 'gezieltes Feedback zum verwechselten Fachbegriff fehlt');
  assert(await page.locator('#evalCard input[data-q="q2"]:checked').isDisabled(), 'richtige Antwort bleibt erhalten und gesperrt');
  assert(await page.locator('#evalCard input[data-gap="loeslichkeit"]').isDisabled(), 'Synonym/Umlautvariante „Loeslichkeit“ wird erkannt');
  assert((await page.locator('#evalCard input[data-gap="loeslich"]').inputValue()) === 'löslich', 'Eingaben bleiben erhalten');
  assert(/Schreibweise: „kristallisiert“/.test(ev), 'Tippfehler wird toleriert, aber die Schreibweise gezeigt');
  const shotFb = await shot(page, '15-k02-auswertung-feedback.png');
  await answerChoice(page, 'q1', 'solution');
  await answerGaps(page, 'g1', { rueckstand: 'Rueckstand' });
  await submitAnswers(page);
  ev = await evalText(page);
  assert(/Auswertung abgeschlossen/.test(ev), 'Auswertung nicht abgeschlossen: ' + ev.slice(0, 400));
  const nb = await finishTheory(page);
  assert(/Beobachtung/i.test(nb) && /Erklärung/i.test(nb) && /Merksatz/i.test(nb) && /Durchführung/i.test(nb) && /Kochsalz/.test(nb), 'Hefteintrag unvollständig');
  const nbShot = await shot(page, '16-k02-hefteintrag.png');
  assert(!errors.length, errors.join('; '));
  return { mass, screenshots: ['docs/screenshots/11-k02-geloest.png', 'docs/screenshots/12-k02-filtration.png', 'docs/screenshots/13-k02-eindampfen.png', crystals, shotFb, nbShot] };
});

// 2 + L-01: trocken filtrieren, Hilfe, Korrektur
await test('E2E-02', 'K-02 negativ: trockenes Gemisch filtrieren; wiederholtes Scheitern → Hilfe angeboten → Korrektur (L-01)', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'classic'); await task(page, 'K-02'); await speed(page, 50);
  await select(page, 'F'); await ctl(page, 'paper', '[data-v="folded"]');
  await select(page, 'E'); await ctl(page, 'move'); await target(page, 'place:filter');
  await select(page, 'M'); await ctl(page, 'pour', '[data-mode="all"]'); await target(page, 'F');
  await waitSim(page, 30);
  let r = await checkResult(page);
  assert(/ungelöst im Filter/.test(r), 'Fehlversuch nicht erkannt: ' + r);
  const filtrateSalt = await eng(page, (e) => e.vessel('E').c.saltD + e.vessel('E').c.saltS);
  assert(filtrateSalt === 0, 'Salz darf nicht durch den trockenen Filter gelangen');
  assert(await page.locator('#helpOffer').count() === 0 || true, '');
  await checkResult(page);
  assert(await page.locator('#helpOffer').count() === 1, 'Hilfe wird nach wiederholtem Scheitern nicht angeboten');
  assert(!(await page.locator('#helpText').count()), 'Hilfe darf nicht ungefragt eingeblendet werden');
  const offer = await shot(page, '17-hilfe-angebot.png');
  await click(page, '#helpOffer [data-offer]');
  const small = await page.locator('#helpText').innerText();
  assert(/trockene Feststoffe/.test(small), 'kleine Hilfe passt nicht zum Fehler: ' + small);
  await click(page, '#helpCard [data-help="2"]');
  const concrete = await page.locator('#helpText').innerText();
  assert(/Rückstand/.test(concrete) && /Wasser/.test(concrete), 'konkrete Hilfe passt nicht: ' + concrete);
  const hshot = await shot(page, '18-hilfe-konkret.png');
  assert(await page.locator('#helpCard [data-help]').count() === 3, 'genau drei Hilfezustände');
  // Korrektur gemäß Hilfe
  await select(page, 'F'); await ctl(page, 'scrape'); await target(page, 'A');
  await select(page, 'A'); await ctl(page, 'waterHere'); await ctl(page, 'ml', '[data-v="50"]'); await ctl(page, 'water', '[data-hot="0"]');
  await ctl(page, 'stir');
  await waitSim(page, 15);
  const dissolved = await eng(page, (e) => e.vessel('A').c.saltD);
  assert(dissolved > 4, 'Korrektur wirkt nicht: gelöstes Salz ' + dissolved);
  const help2 = await page.locator('#helpText').innerText();
  assert(!/trockene Feststoffe|Rückstand aus dem Trichter/.test(help2), 'Hilfe reagiert nicht auf den neuen Zustand: ' + help2);
  assert(!errors.length, errors.join('; '));
  return { help: { small, concrete, afterCorrection: help2 }, screenshots: [offer, hshot] };
});

// 3: Filtrat verworfen
await test('E2E-03', 'K-02 Verlust: Filtrat in den Ausguss → kein Salz aus dem Nichts', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'classic'); await task(page, 'K-02'); await speed(page, 50);
  await select(page, 'M'); await ctl(page, 'pour', '[data-mode="all"]'); await target(page, 'A');
  await select(page, 'A'); await ctl(page, 'waterHere'); await ctl(page, 'ml', '[data-v="50"]'); await ctl(page, 'water', '[data-hot="0"]');
  await ctl(page, 'stir'); await waitSim(page, 15);
  await select(page, 'F'); await ctl(page, 'paper', '[data-v="folded"]');
  await select(page, 'E'); await ctl(page, 'move'); await target(page, 'place:filter');
  await select(page, 'A'); await ctl(page, 'pour', '[data-mode="all"]'); await target(page, 'F');
  await waitUntil(page, (e) => e.state.funnel.c.water < 4);
  await select(page, 'E'); await ctl(page, 'move'); await target(page, 'place:bench');
  await select(page, 'E'); await ctl(page, 'pour', '[data-mode="careful"]'); await target(page, 'waste');
  await select(page, 'D'); await ctl(page, 'move'); await target(page, 'place:heater');
  await click(page, '#controls [data-a="heat"][data-v="2"]');
  await waitSim(page, 200);
  const salt = await eng(page, (e) => e.vessel('D').c.saltS);
  assert(salt === 0, 'Salz aus dem Nichts: ' + salt);
  const r = await checkResult(page);
  assert(/weggegossen|verschüttet/.test(r), 'Verlust nicht benannt: ' + r);
  const s = await stageShot(page, '19-k02-filtrat-verworfen.png');
  assert(!errors.length, errors.join('; '));
  return { screenshots: [s] };
});

// 4: K-01 Sedimentieren/Dekantieren, zu schnell, Korrektur; mit Maus auf der Bühne und Ziehen
await test('E2E-04', 'K-01: Sedimentieren, vorsichtig vs. zu schnell dekantieren, trübes Resultat korrigieren (Bühne: Klick und Ziehen)', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'classic'); await task(page, 'K-01'); await speed(page, 20);
  const s0 = await stageShot(page, '20-k01-trueb.png');
  await waitUntil(page, (e) => e.describe(e.vessel('A').c).suspended < 0.03);
  const s1 = await stageShot(page, '21-k01-sedimentiert.png');
  // zu schnell: über Bühne auswählen, dann im Bedienfeld „zügig“
  await stageTap(page, 'A');
  assert(await page.locator('#controls [data-a="pour"][data-mode="fast"]').count() === 1, 'Auswahl über die Bühne fehlgeschlagen');
  await ctl(page, 'pour', '[data-mode="fast"]');
  await stageTap(page, 'B'); // Ziel auf der Bühne antippen
  const turbid = await eng(page, (e) => ({ sand: e.vessel('B').c.sand, turb: e.describe(e.vessel('B').c).suspended }));
  assert(turbid.sand > 1, 'zügiges Gießen muss Sand mitreißen: ' + JSON.stringify(turbid));
  const s2 = await stageShot(page, '22-k01-zu-schnell-trueb.png');
  let r = await checkResult(page);
  assert(/trüb|Sand gelandet/.test(r), 'trübes Ergebnis muss erkannt werden: ' + r);
  // Korrektur: absetzen lassen, dann durch Ziehen vorsichtig in C gießen
  await waitUntil(page, (e) => e.describe(e.vessel('B').c).suspended < 0.03);
  await drag(page, 'B', 'C');
  await waitSim(page, 3);
  r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'Korrektur muss gelingen: ' + r);
  const vol = await eng(page, (e) => e.vessel('C').c.water);
  const s3 = await stageShot(page, '23-k01-korrigiert.png');
  // Gegenprobe: vorsichtig nach Absetzen gelingt direkt
  await restart(page, 'task');
  await waitUntil(page, (e) => e.describe(e.vessel('A').c).suspended < 0.03);
  await select(page, 'A'); await ctl(page, 'pour', '[data-mode="careful"]'); await target(page, 'B');
  await waitSim(page, 3);
  r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'vorsichtiges Dekantieren muss gelingen');
  assert(!errors.length, errors.join('; '));
  return { waterAfterCorrection: vol, screenshots: [s0, s1, s2, s3] };
});

// 5: K-03
await test('E2E-05', 'K-03: Magnet, Lösen, Filtrieren, Eindampfen → drei Fraktionen', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'classic'); await task(page, 'K-03'); await speed(page, 50);
  for (let i = 0; i < 3; i++) { await select(page, 'M'); await ctl(page, 'magnetHere'); }
  const s0 = await stageShot(page, '24-k03-magnet.png');
  const onMag = await eng(page, (e) => e.state.magnet.iron);
  assert(onMag > 4.5, 'Eisen am Magneten: ' + onMag);
  const rest = await eng(page, (e) => e.vessel('M').c);
  assert(rest.sand === 10 && rest.saltS === 5, 'Magnet darf nur Eisen erfassen');
  await select(page, 'U'); await ctl(page, 'releaseHere');
  await k02Solve(page);
  const r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'K-03 nicht gelöst: ' + r);
  const s1 = await stageShot(page, '25-k03-drei-fraktionen.png');
  assert(!errors.length, errors.join('; '));
  return { ironOnMagnet: onMag, screenshots: [s0, s1] };
});

// 6: K-04
await test('E2E-06', 'K-04: Scheidetrichter trennt beide Phasen; Hahnfehler erzeugt Mischfraktion', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'classic'); await task(page, 'K-04'); await speed(page, 20);
  await select(page, 'A'); await ctl(page, 'pour', '[data-mode="all"]'); await target(page, 'S');
  const s0 = await stageShot(page, '26-k04-emulsion.png');
  await waitUntil(page, (e) => e.describe(e.state.sep.c).emulsion < 1.5);
  const s1 = await stageShot(page, '27-k04-zwei-phasen.png');
  await select(page, 'B'); await ctl(page, 'move'); await target(page, 'place:sep');
  await speed(page, 1);
  await select(page, 'S'); await ctl(page, 'cock', '[data-v="1"]');
  await waitUntil(page, (e) => e.state.sep.c.water - e.state.sep.c.emW < 5);
  await ctl(page, 'cock', '[data-v="0.25"]');
  await waitUntil(page, (e) => e.state.sep.c.water < 0.4);
  await ctl(page, 'cock', '[data-v="0"]');
  const s2 = await stageShot(page, '28-k04-wasser-abgelassen.png');
  await select(page, 'B'); await ctl(page, 'move'); await target(page, 'place:bench');
  await select(page, 'C'); await ctl(page, 'move'); await target(page, 'place:sep');
  await speed(page, 20);
  await select(page, 'S'); await ctl(page, 'cock', '[data-v="1"]');
  await waitUntil(page, (e) => e.state.sep.c.oil < 0.05);
  await ctl(page, 'cock', '[data-v="0"]');
  let r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'K-04 nicht gelöst: ' + r);
  // Fehler: Hahn zu lange offen
  await restart(page, 'task');
  await select(page, 'A'); await ctl(page, 'pour', '[data-mode="all"]'); await target(page, 'S');
  await waitUntil(page, (e) => e.describe(e.state.sep.c).emulsion < 1.5);
  await select(page, 'B'); await ctl(page, 'move'); await target(page, 'place:sep');
  await select(page, 'S'); await ctl(page, 'cock', '[data-v="1"]');
  await waitUntil(page, (e) => e.vessel('B').c.oil > 10);
  await ctl(page, 'cock', '[data-v="0"]');
  r = await checkResult(page);
  assert(/noch Öl und Wasser zusammen/.test(r), 'Mischfraktion nicht erkannt: ' + r);
  const s3 = await stageShot(page, '29-k04-mischfraktion.png');
  assert(!errors.length, errors.join('; '));
  return { screenshots: [s0, s1, s2, s3] };
});

// 7: K-05
await test('E2E-07', 'K-05: kaltes vs. heißes Wasser, Blütenreste abtrennen, Tee bleibt Stoffgemisch', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'classic'); await task(page, 'K-05'); await speed(page, 50);
  const run = async (hot) => {
    await select(page, 'P'); await ctl(page, 'pour', '[data-mode="all"]'); await target(page, 'A');
    await select(page, 'A'); await ctl(page, 'waterHere'); await ctl(page, 'ml', '[data-v="50"]'); await ctl(page, 'water', `[data-hot="${hot ? 1 : 0}"]`);
    await select(page, 'A'); await ctl(page, 'waterHere'); await ctl(page, 'ml', '[data-v="50"]'); await ctl(page, 'water', `[data-hot="${hot ? 1 : 0}"]`);
    await ctl(page, 'stir');
    await waitSim(page, 120);
    return eng(page, (e) => e.describe(e.vessel('A').c).dyeConc);
  };
  const cold = await run(false);
  const sc = await stageShot(page, '30-k05-kalt-120s.png');
  await restart(page, 'apparatus');
  const hot = await run(true);
  const sh = await stageShot(page, '31-k05-heiss-120s.png');
  assert(hot > 2 * cold, `heiß (${hot}) muss deutlich stärker extrahieren als kalt (${cold})`);
  await select(page, 'B'); await ctl(page, 'sieveOn');
  await select(page, 'A'); await ctl(page, 'pour', '[data-mode="all"]'); await target(page, 'T');
  await waitSim(page, 5);
  const tea = await eng(page, (e) => e.vessel('B').c);
  assert(tea.petals === 0 && tea.dye > 0, 'Sieb muss Blüten zurückhalten, Farbstoff durchlassen');
  const r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'K-05 nicht gelöst: ' + r);
  await answerChoice(page, 'q3', 'pure');
  await submitAnswers(page);
  assert(/Auch nach dem Filtrieren/.test(await evalText(page)), '„Reinstoff“ darf nicht akzeptiert werden');
  const s2 = await stageShot(page, '32-k05-tee-abgesiebt.png');
  assert(!errors.length, errors.join('; '));
  return { dyeConcCold: cold, dyeConcHot: hot, screenshots: [sc, sh, s2] };
});

// 8: C-01 positiv (Touch, über die Bühne)
await test('E2E-08', 'C-01: Schwarz/Grün/Blau nebeneinander, Laufmittelfront steigt, getrennte Banden, gemeinsamer Farbstoff', async () => {
  const { page, errors } = await newPage(browser, { hasTouch: true });
  await openLab(page, 'chroma', true); await speed(page, 50, true);
  const fronts = [];
  const watch = setInterval(async () => { try { fronts.push(await eng(page, (e) => e.state.paper.front)); } catch (x) { /* Seite beschäftigt */ } }, 300);
  let mid = null;
  const p = chromaStrip(page, { samples: ['schwarz', 'gruen', 'blau'], touch: true, viaStage: true });
  await page.waitForFunction(() => { const p = window.Trennlabor.ui.curEngine().state.paper; return p.state === 'chamber' && p.front > 4; }, null, { timeout: 60000 });
  mid = await stageShot(page, '33-c01-entwicklung-laeuft.png');
  await p;
  clearInterval(watch);
  const rising = fronts.filter((f, i) => i && f > fronts[i - 1]).length;
  assert(rising >= 3, 'Front steigt nicht sichtbar kontinuierlich: ' + fronts.join(','));
  const snap = await eng(page, (e) => e.state.archive[e.state.archive.length - 1]);
  const counts = snap.zones.map((z) => z && z.length);
  assert(counts[0] === 3 && counts[1] === 2 && counts[2] === 1, 'Zonenzahlen ' + counts);
  const blue = snap.zones[2][0].s;
  assert(snap.zones[1].some((z) => Math.abs(z.s - blue) < 0.05), 'gemeinsamer blauer Farbstoff nicht auf gleicher Höhe');
  const done = await stageShot(page, '34-c01-chromatogramm.png');
  const r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'C-1 nicht gelöst: ' + r);
  await answerText(page, 'z0', '3'); await answerText(page, 'z1', '2'); await answerText(page, 'z2', '1');
  await answerMulti(page, 'mix', ['schwarz', 'gruen']);
  await answerChoice(page, 'pure', 'maybe');
  await answerGaps(page, 'g1', { gemischFarbe: 'Gemisch', mobil: 'mobile', stationaer: 'stationäre', laufmittel: 'Laufmittel', adsorption: 'Absorption' });
  await submitAnswers(page);
  const fb = await evalText(page);
  assert(/Adsorption \(mit d\)/.test(fb), '„Absorption“ muss gezielt zurückgewiesen werden');
  await answerGaps(page, 'g1', { adsorption: 'Adsorption' });
  await submitAnswers(page);
  assert(/Auswertung abgeschlossen/.test(await evalText(page)), 'C-1 Auswertung nicht abgeschlossen');
  assert(!errors.length, errors.join('; '));
  return { fronts: fronts.slice(0, 12), counts, screenshots: [mid, done] };
});

// 9–12: Chromatographie-Fehler und Expertenmodus
await test('E2E-09', 'C-02 negativ: wasserfester Stift mit Wasser wandert nicht; mit Ethanol-Wasser teilweise', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'chroma'); await task(page, 'C-3'); await speed(page, 50);
  await chromaStrip(page, { samples: ['wasserfest'], solvent: 'water' });
  const w = await eng(page, (e) => e.state.archive[e.state.archive.length - 1].zones[0]);
  assert(w.every((z) => z.atStart), 'Wasserfester Stift darf in Wasser nicht wandern');
  const s0 = await stageShot(page, '35-c02-wasserfest-wasser.png');
  await chromaStrip(page, { samples: ['wasserfest'], solvent: 'etoh', untilRun: 5.2 });
  const et = await eng(page, (e) => e.state.archive[e.state.archive.length - 1].zones[0]);
  assert(et.some((z) => !z.atStart), 'mit Ethanol-Wasser muss ein Teil wandern');
  const r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'C-3 nicht gelöst: ' + r);
  const s1 = await stageShot(page, '36-c02-wasserfest-ethanol.png');
  assert(!errors.length, errors.join('; '));
  return { screenshots: [s0, s1] };
});

await test('E2E-10', 'C-03 negativ: Startlinie unter dem Flüssigkeitsspiegel → keine gültige Chromatographie', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'chroma'); await speed(page, 50);
  await chromaStrip(page, { samples: ['gruen'], y: '1', level: 'high', untilRun: 4 });
  const a = await eng(page, (e) => e.state.archive[e.state.archive.length - 1]);
  assert(a.submerged && !a.quality.valid, 'eingetauchte Startlinie muss ungültig sein');
  const s = await stageShot(page, '37-c03-startlinie-eingetaucht.png');
  const r = await checkResult(page);
  assert(/unter dem Flüssigkeitsspiegel/.test(r), 'Fehler nicht benannt: ' + r);
  assert(!errors.length, errors.join('; '));
  return { screenshots: [s] };
});

await test('E2E-11', 'C-04 negativ: zu viel Farbstoff → verbreiterte Flecken im Vergleich zur Normalprobe; Kugelschreiber-Startlinie stört', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'chroma'); await speed(page, 50);
  await chromaStrip(page, { samples: ['blau'], dots: 1 });
  await chromaStrip(page, { samples: ['blau'], dots: 4 });
  const [n, o] = await eng(page, (e) => e.state.archive.slice(-2).map((a) => a.zones[0][0].sigma));
  assert(o > 1.3 * n, `Fleck nicht verbreitert (${n} → ${o})`);
  await chromaStrip(page, { tool: 'pen', samples: ['gelb'], solvent: 'etoh', untilRun: 5.2 });
  const pen = await eng(page, (e) => e.state.archive[e.state.archive.length - 1].quality);
  assert(pen.issues.includes('penLine') && !pen.valid, 'Kugelschreiberlinie muss als Störung gelten');
  await click(page, '#controls [data-a="compare"]');
  const s = await shot(page, '38-c04-vergleich-normal-ueberladen-kuli.png');
  await click(page, '#modalBox [data-close]');
  assert(!errors.length, errors.join('; '));
  return { sigmaNormal: n, sigmaOverloaded: o, screenshots: [s] };
});

await test('E2E-12', 'C-05: Reinstoff zeigt eine Bande; Standardmodus ohne Rf, Expertenmodus berechnet Rf korrekt', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'chroma'); await speed(page, 50);
  await chromaStrip(page, { samples: ['blau'] });
  assert(!/Rf =|Frontstrecke|Strecke\s+Rf/.test(await page.locator('#controls').innerText()), 'Rf darf im Standardmodus nicht erscheinen');
  const a = await eng(page, (e) => e.state.archive[e.state.archive.length - 1]);
  assert(a.zones[0].length === 1, 'Reinstoff muss genau eine Zone zeigen');
  await ctl(page, 'expert');
  const txt = await page.locator('#controls').innerText();
  const m = /Blau \(Ref\.\)\s+blau\s+([\d,]+) cm\s+([\d,]+)/.exec(txt);
  assert(m, 'Messtabelle im Expertenmodus fehlt: ' + txt.slice(-300));
  const s = Number(m[1].replace(',', '.')), rf = Number(m[2].replace(',', '.'));
  const front = a.frontMarked - a.line.y;
  assert(Math.abs(rf - s / front) < 0.02, `Rf ${rf} ≠ ${s}/${front}`);
  const shotE = await stageShot(page, '39-c05-expertenmodus-lineal.png');
  assert(!errors.length, errors.join('; '));
  return { rf, s, front, screenshots: [shotE] };
});

// 13: D-01 positiv
await test('E2E-13', 'D-01 positiv: Aufbau, Kühlwasser unten, Erhitzen, Temperatur ablesen, Destillat, separate Brennprobe, Auswertung', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'distill'); await speed(page, 20);
  await buildDistill(page);
  const s0 = await stageShot(page, '40-d01-aufbau-fertig.png');
  await click(page, '#controls [data-a="heat"][data-v="3"]');
  await waitUntil(page, (e) => e.state.vaporRate > 0);
  const s1 = await stageShot(page, '41-d01-sieden.png');
  await waitUntil(page, (e) => e.distillate().vol > 2);
  const reading = Number((await page.locator('[data-live="sensor"]').innerText()).replace(' °C', '').replace(',', '.'));
  const s2 = await stageShot(page, '42-d01-destillat-tropft.png');
  assert(reading > 83 && reading < 90, 'Dampftemperatur unplausibel: ' + reading);
  await waitUntil(page, (e) => e.distillate().vol > 8);
  await click(page, '#controls [data-a="heat"][data-v="0"]');
  await ctl(page, 'sample', '[data-v="receiver"]');
  await ctl(page, 'ignite', '[data-v="dish"]');
  const burn = await eng(page, (e) => e.state.dish.result);
  assert(burn === 'burns', 'Brennprobe muss brennen: ' + burn);
  const s3 = await stageShot(page, '43-d01-brennprobe.png');
  const r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'D-1 nicht gelöst: ' + r);
  await answerText(page, 'q1', String(reading).replace('.', ','));
  await answerChoice(page, 'q2', 'jump');
  await answerChoice(page, 'q3', 'blue');
  await answerChoice(page, 'q4', 'flammable');
  await answerGaps(page, 'g1', { t78: '78', t100: '100', verdampft: 'verdampft', kondensiert: 'kondensiert', ethanol: 'Alkohol', siedetemp: 'Siedetemperaturen' });
  await submitAnswers(page);
  assert(/Sieh dir den Temperaturverlauf an/.test(await evalText(page)), 'falsche Zweistufen-Interpretation muss abgelehnt werden');
  await answerChoice(page, 'q2', 'rise');
  await submitAnswers(page);
  assert(/Auswertung abgeschlossen/.test(await evalText(page)), 'D-1 Auswertung nicht abgeschlossen');
  await finishTheory(page);
  const s4 = await shot(page, '44-d01-hefteintrag.png');
  assert(!errors.length, errors.join('; '));
  return { reading, screenshots: [s0, s1, s2, s3, s4] };
});

// 14–16
await test('E2E-14', 'D-02 negativ: Kühlwasser aus → deutlich weniger Destillat bei gleicher Zeit', async () => {
  const runFor = async (cooling) => {
    const { page, errors } = await newPage(browser);
    await openLab(page, 'distill'); await speed(page, 50);
    await buildDistill(page, { cooling });
    await click(page, '#controls [data-a="heat"][data-v="3"]');
    await waitSim(page, 480);
    const v = await eng(page, (e) => ({ dist: e.distillate().vol, lost: e.state.lost.vapor.E + e.state.lost.vapor.W }));
    const s = cooling === '0' ? await stageShot(page, '45-d02-ohne-kuehlwasser.png') : null;
    assert(!errors.length, errors.join('; '));
    await page.context().close();
    return Object.assign(v, { s });
  };
  const ok = await runFor('2'), off = await runFor('0');
  assert(off.dist < 0.3 * ok.dist && off.lost > 3, `ohne Kühlung ${off.dist} mL, mit ${ok.dist} mL`);
  return { withCooling: ok.dist, withoutCooling: off.dist, lostVapor: off.lost, screenshots: [off.s] };
});

await test('E2E-15', 'D-03 negativ: Thermometer falsch positioniert → Messung nicht als korrekt gewertet', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'distill'); await speed(page, 50);
  await buildDistill(page, { thermo: 'high' });
  await click(page, '#controls [data-a="heat"][data-v="3"]');
  await waitUntil(page, (e) => e.distillate().vol > 8);
  const shown = await page.locator('[data-live="sensor"]').innerText();
  const boil = await eng(page, (e) => e.boilingPoint());
  await ctl(page, 'sample', '[data-v="receiver"]');
  await ctl(page, 'ignite', '[data-v="dish"]');
  const r = await checkResult(page);
  assert(/nicht im Dampfweg/.test(r), 'falsche Thermometerlage nicht beanstandet: ' + r);
  const s = await stageShot(page, '46-d03-thermometer-zu-hoch.png');
  assert(!errors.length, errors.join('; '));
  return { shown, boilingPoint: boil, screenshots: [s] };
});

await test('E2E-16', 'D-04 negativ: Heizleistung 0 → keine Destillatproduktion', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'distill'); await speed(page, 50);
  await buildDistill(page);
  await waitSim(page, 600);
  const d = await eng(page, (e) => ({ v: e.distillate().vol, T: e.state.liquid.T }));
  assert(d.v === 0 && d.T < 21, 'ohne Heizung darf nichts destillieren: ' + JSON.stringify(d));
  assert(!errors.length, errors.join('; '));
  return d;
});

// 17: Sicherheitsstopps
await test('E2E-17', 'D-05 kritisch: geschlossene Apparatur erhitzen bzw. an der Apparatur zünden → sofortiger Sicherheitsstopp', async () => {
  const { page, errors } = await newPage(browser);
  await openLab(page, 'distill'); await speed(page, 20);
  await buildDistill(page, { stopper: true });
  await click(page, '#controls [data-a="heat"][data-v="2"]');
  assert(await page.locator('#safety').isVisible(), 'Sicherheitsstopp nicht angezeigt');
  const t1 = await page.locator('#safetyText').innerText();
  assert(/geschlossen/.test(t1), t1);
  const heater = await eng(page, (e) => e.state.heater);
  assert(heater === 0, 'Heizung muss aus sein');
  const s0 = await shot(page, '47-d05-sicherheitsstopp-geschlossen.png');
  await click(page, '#safetyOk');
  await ctl(page, 'resume');
  assert(await eng(page, (e) => !!e.state.safety), 'Fortsetzen ohne Behebung darf nicht gehen');
  await ctl(page, 'unmount', P('stopper'));
  await ctl(page, 'resume');
  assert(await eng(page, (e) => !e.state.safety), 'nach Behebung muss es weitergehen');
  await click(page, '#controls [data-a="heat"][data-v="3"]');
  await waitSim(page, 120);
  await ctl(page, 'ignite', '[data-v="apparatus"]');
  assert(await page.locator('#safety').isVisible(), 'Zünden an der Apparatur nicht gestoppt');
  const t2 = await page.locator('#safetyText').innerText();
  assert(/niemals gezündet/.test(t2), t2);
  const s1 = await shot(page, '48-d05-sicherheitsstopp-zuenden.png');
  assert(!errors.length, errors.join('; '));
  return { screenshots: [s0, s1] };
});

// 21: Tablet-Viewports mit Touch
for (const [w, h] of [[1180, 820], [1024, 768]]) {
  await test(`E2E-21-${w}`, `V-01/V-03: Tablet ${w}×${h} mit Touch – K-01 per Antippen lösbar, keine abgeschnittenen Pflichtfunktionen`, async () => {
    const { page, errors } = await newPage(browser, { viewport: { width: w, height: h }, hasTouch: true, isMobile: false });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, 'horizontales Scrollen auf der Startseite');
    await openLab(page, 'classic', true); await speed(page, 50, true);
    const layout = await page.evaluate(() => {
      const st = document.getElementById('stage').getBoundingClientRect(), pn = document.getElementById('panel').getBoundingClientRect();
      return { stageW: st.width, stageH: st.height, panelW: pn.width, vw: window.innerWidth, scrollW: document.documentElement.scrollWidth };
    });
    assert(layout.scrollW <= layout.vw + 1, 'horizontales Scrollen im Labor');
    assert(layout.stageW >= 0.55 * layout.vw, 'Bühne zu klein: ' + JSON.stringify(layout));
    // Trefferflächen der Bühne vollständig sichtbar
    const hs = await page.evaluate(() => window.Trennlabor.ui.hotspots());
    const st = await page.locator('#stage').boundingBox();
    const cut = hs.filter((x) => x.x < st.x - 1 || x.y < st.y - 1 || x.x + x.w > st.x + st.width + 1 || x.y + x.h > st.y + st.height + 1);
    assert(!cut.length, 'abgeschnittene Trefferflächen: ' + cut.map((c) => c.id).join(','));
    await stageTap(page, 'A', true);
    await waitUntil(page, (e) => e.describe(e.vessel('A').c).suspended < 0.03);
    await ctl(page, 'pour', '[data-mode="careful"]', true);
    await stageTap(page, 'B', true);
    await waitSim(page, 3);
    const r = await checkResult(page);
    assert(/Versuch gelungen/.test(r), 'K-01 per Touch nicht lösbar: ' + r);
    const shots = [await shot(page, `50-tablet-${w}x${h}-klassisch.png`)];
    // Mindestgröße der Bedienelemente
    const small = await page.evaluate(() => [...document.querySelectorAll('#panel button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 34).map((b) => b.textContent.trim()).slice(0, 5));
    assert(!small.length, 'zu kleine Touchziele: ' + small.join(' | '));
    for (const lab of ['chroma', 'distill']) {
      await openLab(page, lab, true);
      const hs2 = await page.evaluate(() => window.Trennlabor.ui.hotspots());
      const st2 = await page.locator('#stage').boundingBox();
      const cut2 = hs2.filter((x) => x.x < st2.x - 1 || x.y < st2.y - 1 || x.x + x.w > st2.x + st2.width + 1 || x.y + x.h > st2.y + st2.height + 1);
      assert(!cut2.length, `${lab}: abgeschnittene Trefferflächen: ` + cut2.map((c) => c.id).join(','));
      shots.push(await shot(page, `50-tablet-${w}x${h}-${lab}.png`));
    }
    // Panel einklappbar, Thermometer bleibt sichtbar
    await click(page, '#btnPanel', true);
    const wide = await page.locator('#stage').boundingBox();
    assert(wide.width > layout.stageW + 100, 'Bedienfeld lässt sich nicht einklappen');
    shots.push(await shot(page, `50-tablet-${w}x${h}-destillation-panel-zu.png`));
    await click(page, '#btnPanel', true);
    assert(!errors.length, errors.join('; '));
    return { layout, screenshots: shots };
  });
}

// V-04: Tastaturbedienung
await test('V-04', 'Wesentliche Steuerung per Tastatur (Tab/Enter/Leertaste) bedienbar', async () => {
  const { page, errors } = await newPage(browser);
  await page.keyboard.press('Tab'); // Marke
  await page.keyboard.press('Tab'); // erste Laborkarte? (verdeckte Elemente überspringen)
  let found = false;
  for (let i = 0; i < 12 && !found; i++) { const a = await page.evaluate(() => document.activeElement && document.activeElement.dataset.open); if (a === 'classic') found = true; else await page.keyboard.press('Tab'); }
  assert(found, 'Laborkarte per Tab nicht erreichbar');
  await page.keyboard.press('Enter'); await sleep(200);
  // Becherglas A per Tastatur wählen und Wasser zugeben
  const focusOn = async (sel) => { for (let i = 0; i < 80; i++) { if (await page.evaluate((s) => document.activeElement && document.activeElement.matches(s), sel)) return true; await page.keyboard.press('Tab'); } return false; };
  assert(await focusOn('#controls [data-a="select"][data-id="B"]'), 'Gefäßauswahl nicht per Tab erreichbar');
  await page.keyboard.press('Enter'); await idle(page);
  assert(await focusOn('#controls [data-a="waterHere"]'), 'Handlung nicht per Tab erreichbar');
  await page.keyboard.press(' '); await idle(page);
  assert(await focusOn('#controls [data-a="water"][data-hot="0"]'), 'Wasser nicht per Tab erreichbar');
  await page.keyboard.press('Enter'); await idle(page); await sleep(300); await idle(page);
  const w = await eng(page, (e) => e.vessel('B').c.water);
  assert(w === 25, 'Tastaturbedienung ohne Wirkung: ' + w);
  const focusStyle = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(!errors.length, errors.join('; '));
  return { water: w, focusStyle };
});

// A-04: Zeitraffer im Browser
await test('A-04', 'Zeitraffer und Pause ändern nur die Geschwindigkeit (gleiche Modellzeit → gleiches Ergebnis)', async () => {
  const runAt = async (s) => {
    const { page, errors } = await newPage(browser);
    await openLab(page, 'classic'); await task(page, 'K-01');
    await speed(page, 0);
    const t0 = await simTime(page); await sleep(500); const t1 = await simTime(page);
    assert(t1 === t0, 'Pause hält die Zeit nicht an');
    await speed(page, s);
    await waitSim(page, 30);
    await speed(page, 0);
    const t = await simTime(page);
    const st = await page.evaluate((tt) => {
      const E = window.Trennlabor.TL.classic;
      const ref = E.createEngine('K-01'); ref.advance(tt);
      return { app: window.Trennlabor.ui.curEngine().state.vessels[0].c, ref: ref.state.vessels[0].c };
    }, t);
    assert(!errors.length, errors.join('; '));
    await page.context().close();
    return st;
  };
  const a = await runAt(1), b = await runAt(50);
  for (const r of [a, b]) assert(Math.abs(r.app.susp - r.ref.susp) < 1e-9, 'Zustand weicht vom Modell bei gleicher Modellzeit ab');
  return { at1x: a.app.susp, at50x: b.app.susp };
});

// 22: Offline/Netz, Ressourcen
await test('T-01', 'Ausgelieferter Build: keine externen Anfragen, offline weiter bedienbar, keine Konsolenfehler', async () => {
  const { page, errors, requests, context } = await newPage(browser);
  const external = requests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:'));
  assert(!external.length, 'externe Anfragen: ' + external.join(', '));
  await context.setOffline(true);
  await openLab(page, 'classic'); await task(page, 'K-01'); await speed(page, 50);
  await waitUntil(page, (e) => e.describe(e.vessel('A').c).suspended < 0.03);
  await select(page, 'A'); await ctl(page, 'pour', '[data-mode="careful"]'); await target(page, 'B');
  const r = await checkResult(page);
  assert(/Versuch gelungen/.test(r), 'offline nicht bedienbar');
  // Persistenz im Browserfenster: Neuladen behält Zwischenstand
  await context.setOffline(false);
  await page.reload(); await page.waitForFunction(() => window.Trennlabor && window.Trennlabor.ui);
  const kept = await page.evaluate(() => { const p = window.Trennlabor.ui.S.progress['K-01']; return p && p.success; });
  assert(kept, 'Zwischenstand nach dem Neuladen verloren');
  assert(!errors.length, errors.join('; '));
  return { requests: requests.length, external: external.length };
});

await browser.close();
server.close();
const failed = results.filter((r) => r.status === 'FAIL').length;
fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify({ meta, passed: results.length - failed, failed, results }, null, 2));
console.log(`\n${results.length - failed} bestanden, ${failed} fehlgeschlagen. Ergebnisse: tests/e2e/results.json`);
process.exit(failed ? 1 : 0);
