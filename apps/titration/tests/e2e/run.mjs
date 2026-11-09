// Browserprüfung von TitraLab 3 (Chromium über Playwright).
// Bedient die Anwendung über die Oberfläche, prüft Layout (Kurve neben der
// Apparatur, Trennlinie, Maximieren), Farbschema (hell/dunkel, gespeichert)
// und den Ablauf Vorbereitung → Durchführung → Auswertung. Erzeugt
// Screenshot-Nachweise in docs/screenshots.
//
// Aufruf: node tests/e2e/run.mjs            (alle Szenarien)
//         ONLY=E1,E3 node tests/e2e/run.mjs (Auswahl)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const ROOT = process.env.ROOT ? path.resolve(process.env.ROOT) : (fs.existsSync(path.join(APP, 'dist/titration/index.html')) ? path.join(APP, 'dist/titration') : APP);
const SHOTS = path.join(APP, 'docs/screenshots');
const PORT = Number(process.env.PORT || 8131);
const BASE = `http://localhost:${PORT}/index.html`;
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
fs.mkdirSync(SHOTS, { recursive: true });

// Geräte: iPad 8. Generation quer (Safari-Viewport ohne Leisten ≈ 1080 × 735), hoch, Desktop
const IPAD_L = { width: 1080, height: 735 };
const IPAD_P = { width: 810, height: 1005 };
const DESKTOP = { width: 1440, height: 900 };

const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };

async function newPage(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: !!opts.touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.__errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(`http://localhost:${PORT}/`) && !/^(data|blob):/.test(r.url())) page.__errors.push('externe Anfrage: ' + r.url()); });
  return page;
}

async function fresh(page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.waitForSelector('#btnStart');
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const rect = (page, sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, visible: r.width > 0 && r.height > 0 }; });
const theme = (page) => page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark');

/** Versuch starten und per Modell bis kurz vor den ÄP titrieren (schnell), dann Kurve einblenden */
async function titrate(page, { sample = 'acid', toFraction = 0.98 } = {}) {
  await page.click(`[data-sample="${sample}"]`);
  await page.click('#btnStart');
  await page.waitForSelector('[data-phase-panel="titration"]:not([hidden])');
  // Zeitraffer über das Experiment-Objekt: Hahn öffnen, viele Modellschritte, Hahn schließen
  await page.evaluate((frac) => {
    const app = Titrierlabor.app;
    const exp = app.state.exp;
    const vEq = Titrierlabor.Chemistry.equivalenceVolume(app.state.config);
    exp.flowRate = 1; // zügiger Strahl (mL/s), nur für den Test
    exp.openValve();
    let guard = 0;
    while (exp.delivered < vEq * frac && guard++ < 200000) app.tick(0.05);
    exp.closeValve();
    for (let i = 0; i < 60; i++) app.tick(0.05); // Tropfen ankommen lassen
  }, toFraction);
  await page.click('#tgChart');
  await page.waitForSelector('#chartDrawer:not([hidden])');
  await page.waitForTimeout(150);
}

async function run(id, title, fn) {
  if (ONLY.length && !ONLY.includes(id)) return;
  const t0 = Date.now();
  try {
    await fn();
    results.push({ id, title, ok: true, ms: Date.now() - t0 });
    console.log(`✔ ${id} ${title}`);
  } catch (e) {
    results.push({ id, title, ok: false, ms: Date.now() - t0, error: e.message });
    console.log(`✘ ${id} ${title}\n   ${e.message}`);
  }
}

const server = await serve(ROOT, PORT);
const browser = await chromium.launch();
try {
  await run('E1', 'Start: Version in der Kopfzeile, dunkles Schema als Standard, keine Fehler', async () => {
    const page = await newPage(browser, DESKTOP);
    await fresh(page);
    const v = await page.textContent('#appVersion');
    const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
    assert(v === 'v' + pkg.version, `Kopfzeile zeigt ${v}, package.json ${pkg.version}`);
    assert((await theme(page)) === 'dark', 'Standard ist nicht dunkel');
    assert((await page.getAttribute('#btnTheme', 'aria-pressed')) === 'false');
    await shot(page, '01-start-dunkel-desktop');
    assert(page.__errors.length === 0, 'Fehler: ' + page.__errors.join(' | '));
    await page.context().close();
  });

  await run('E2', 'Farbschema: umschalten, speichern, nach Neuladen erhalten; Canvas folgt', async () => {
    const page = await newPage(browser, DESKTOP);
    await fresh(page);
    await page.click('#btnTheme');
    assert((await theme(page)) === 'light', 'nicht auf hell umgeschaltet');
    assert((await page.textContent('#btnTheme')).trim() === '☾', 'Symbol nicht gewechselt');
    const bg = await page.$eval('.panel', (el) => getComputedStyle(el).backgroundColor);
    assert(bg === 'rgb(255, 255, 255)', 'Bedienfeld nicht weiß: ' + bg);
    // Hintergrund der Laborbühne (Canvas) hell?
    await page.waitForTimeout(100);
    const px = await page.evaluate(() => {
      const c = document.getElementById('labCanvas');
      const d = c.getContext('2d').getImageData(4, 4, 1, 1).data;
      return [d[0], d[1], d[2]];
    });
    assert(px[0] > 200 && px[1] > 200 && px[2] > 200, 'Laborwand nicht hell: ' + px);
    await shot(page, '02-start-hell-desktop');
    await page.reload();
    await page.waitForSelector('#btnStart');
    assert((await theme(page)) === 'light', 'Schema nach Neuladen verloren');
    assert((await page.textContent('#btnTheme')).trim() === '☾');
    await page.click('#btnTheme');
    assert((await theme(page)) === 'dark');
    assert(page.__errors.length === 0, 'Fehler: ' + page.__errors.join(' | '));
    await page.context().close();
  });

  await run('E3', 'iPad quer: Kurve rechts neben der Apparatur, volle Höhe, Trennlinie sichtbar', async () => {
    const page = await newPage(browser, IPAD_L, { touch: true });
    await fresh(page);
    await titrate(page, { sample: 'acid' });
    const lab = await rect(page, '.lab-wrap');
    const ch = await rect(page, '#chartDrawer');
    const sp = await rect(page, '#stageSplitter');
    const canvas = await rect(page, '#chartCanvas');
    assert(ch.x > lab.x + lab.w - 1, `Kurve liegt nicht rechts von der Apparatur (lab ${JSON.stringify(lab)}, chart ${JSON.stringify(ch)})`);
    assert(Math.abs(ch.h - lab.h) < 2, 'Kurve hat nicht die Höhe der Apparatur');
    assert(sp.visible && sp.x >= lab.x + lab.w - 1 && sp.x <= ch.x + 1, 'Trennlinie nicht zwischen Apparatur und Kurve');
    assert(canvas.h >= 420, `Zeichenfläche der Kurve nur ${Math.round(canvas.h)} px hoch`);
    assert(lab.w >= 280, 'Apparatur zu schmal');
    await shot(page, '03-ipad-quer-kurve-rechts');
    // Im hellen Schema
    await page.click('#btnTheme');
    await page.waitForTimeout(150);
    await shot(page, '04-ipad-quer-kurve-rechts-hell');
    assert(page.__errors.length === 0, 'Fehler: ' + page.__errors.join(' | '));
    await page.context().close();
  });

  await run('E4', 'Trennlinie Apparatur/Kurve: ziehen, speichern, Doppelklick setzt zurück', async () => {
    const page = await newPage(browser, IPAD_L);
    await fresh(page);
    await titrate(page);
    const before = await rect(page, '#chartDrawer');
    const sp = await rect(page, '#stageSplitter');
    const y = sp.y + sp.h / 2;
    await page.mouse.move(sp.x + sp.w / 2, y);
    await page.mouse.down();
    await page.mouse.move(sp.x - 120, y, { steps: 6 });
    await page.mouse.up();
    const after = await rect(page, '#chartDrawer');
    assert(after.w > before.w + 80, `Kurve nicht breiter geworden (${before.w} → ${after.w})`);
    const saved = await page.evaluate(() => localStorage.getItem('titrierlabor.chartWidth'));
    assert(saved && Math.abs(Number(saved) - after.w) < 3, 'Breite nicht gespeichert: ' + saved);
    await page.dblclick('#stageSplitter');
    const reset = await rect(page, '#chartDrawer');
    assert(Math.abs(reset.w - before.w) < 3, 'Doppelklick setzt nicht zurück');
    assert((await page.evaluate(() => localStorage.getItem('titrierlabor.chartWidth'))) === null);
    await page.context().close();
  });

  await run('E5', 'Kurve maximieren: Apparatur ausgeblendet, Kurve füllt die Bühne; zurück', async () => {
    const page = await newPage(browser, IPAD_L);
    await fresh(page);
    await titrate(page);
    await page.click('#btnChartMax');
    await page.waitForTimeout(100);
    const stage = await rect(page, '.stage');
    const ch = await rect(page, '#chartDrawer');
    const lab = await rect(page, '.lab-wrap');
    assert(!lab.visible, 'Apparatur noch sichtbar');
    assert(Math.abs(ch.w - stage.w) < 2 && Math.abs(ch.h - stage.h) < 2, 'Kurve füllt die Bühne nicht');
    assert((await page.getAttribute('#btnChartMax', 'aria-pressed')) === 'true');
    await shot(page, '05-ipad-quer-kurve-maximiert');
    await page.click('#btnChartMax');
    assert((await rect(page, '.lab-wrap')).visible, 'Apparatur kommt nicht zurück');
    // Kurve ausblenden räumt den Maximierzustand auf
    await page.click('#btnChartMax');
    await page.click('#tgChart');
    assert((await page.evaluate(() => document.querySelector('.stage').className)) === 'stage', 'Bühne nicht zurückgesetzt: ' + (await page.evaluate(() => document.querySelector('.stage').className)));
    assert((await rect(page, '.lab-wrap')).visible);
    assert(page.__errors.length === 0, 'Fehler: ' + page.__errors.join(' | '));
    await page.context().close();
  });

  await run('E6', 'iPad hoch (< 900 px): Kurve unter der Apparatur, Trennlinie ausgeblendet', async () => {
    const page = await newPage(browser, IPAD_P, { touch: true });
    await fresh(page);
    await titrate(page, { sample: 'weakAcid' });
    const lab = await rect(page, '.lab-wrap');
    const ch = await rect(page, '#chartDrawer');
    const sp = await rect(page, '#stageSplitter');
    assert(ch.y >= lab.y + lab.h - 1, 'Kurve liegt im Hochformat nicht unter der Apparatur');
    assert(!sp.visible, 'Trennlinie im Hochformat sichtbar');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await shot(page, '06-ipad-hoch-kurve-unten');
    await page.click('#btnChartMax');
    await page.waitForTimeout(100);
    assert(!(await rect(page, '.lab-wrap')).visible);
    assert((await rect(page, '#chartCanvas')).h > 300, 'maximierte Kurve im Hochformat zu klein');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await shot(page, '07-ipad-hoch-kurve-maximiert');
    assert(page.__errors.length === 0, 'Fehler: ' + page.__errors.join(' | '));
    await page.context().close();
  });

  await run('E7', 'Ablauf bis zur Auswertung: Ergebnis prüfen (hell), Kurve breiter in der Auswertung', async () => {
    const page = await newPage(browser, DESKTOP);
    await fresh(page);
    await page.click('#btnTheme');
    await titrate(page, { sample: 'weakBase', toFraction: 1.0 });
    const wTit = (await rect(page, '#chartDrawer')).w;
    await page.click('#btnEndpoint');
    await page.waitForTimeout(200);
    await page.click('#btnToEval');
    await page.waitForSelector('[data-phase-panel="evaluation"]:not([hidden])');
    await page.waitForTimeout(150);
    const wEval = (await rect(page, '#chartDrawer')).w;
    assert(wEval > wTit + 50, `Kurve in der Auswertung nicht breiter (${wTit} → ${wEval})`);
    await page.click('#btnUseNoted');
    const v = await page.inputValue('#inVUsed');
    assert(/\d/.test(v), 'Endpunkt nicht übernommen');
    const c = await page.evaluate(() => {
      const s = Titrierlabor.app.state;
      const vUsed = Titrierlabor.Config.parseDecimal(document.getElementById('inVUsed').value);
      return Titrierlabor.Chemistry.sampleConcentration(s.config.cTitrant, vUsed, s.config.vSample);
    });
    await page.fill('#inCStudent', String(c.toFixed(4)).replace('.', ','));
    await page.click('#btnCheck');
    await page.waitForSelector('#resultBox:not([hidden])');
    const cls = await page.getAttribute('#resultBox', 'class');
    assert(/excellent|good/.test(cls), 'Bewertung unerwartet: ' + cls);
    await shot(page, '08-auswertung-hell-desktop');
    assert(page.__errors.length === 0, 'Fehler: ' + page.__errors.join(' | '));
    await page.context().close();
  });

  await run('E9', 'Grünphase bei Bromthymolblau: letzter Tropfen in Echtzeit, Kolben wird grün, Hinweis in der Auswertung', async () => {
    const page = await newPage(browser, DESKTOP);
    await fresh(page);
    // HCl 0,1 M, 25 mL, vorgegebene Konzentration, BTB – bis ≈ 24,95 mL im Zeitraffer, dann zwei Tropfen in Echtzeit
    await page.click('[data-sample="acid"]');
    await page.click('[data-cmode="given"]');
    await page.fill('#inCSample', '0,1');
    await page.click('#indicatorList [data-indicator="bromothymolBlue"]');
    await page.click('#btnStart');
    await page.waitForSelector('[data-phase-panel="titration"]:not([hidden])');
    await page.evaluate(() => {
      const app = Titrierlabor.app; const exp = app.state.exp;
      exp.flowRate = 1; exp.openValve();
      let g = 0; while (exp.dispensed < 24.90 && g++ < 100000) app.tick(0.05);
      exp.closeValve(); for (let i = 0; i < 80; i++) app.tick(0.05);
      while (!exp.isMixed) app.tick(0.05);
    });
    const pxColor = () => page.evaluate(() => {
      // Farbe der Lösung im Kolben: Mitte der Flüssigkeit, aus dem Canvas
      const r = Titrierlabor.app.renderer; const c = r.color;
      return c ? [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] : null;
    });
    const before = await pxColor();
    assert(before && before[0] > before[2], 'vor dem Tropfen nicht gelb: ' + before);
    const meas0 = await page.evaluate(() => Titrierlabor.app.state.exp.pHMeasured);
    assert(meas0 < 4.5, 'pH vor dem Tropfen: ' + meas0);
    // Ein Tropfen in Echtzeit (Hahn kurz öffnen bei langsamster Stellung)
    await page.evaluate(() => Titrierlabor.app.state.exp.addVolume(0.12)); // 24,90 → 25,02 mL: über den ÄP
    await page.waitForFunction(() => { const e = Titrierlabor.app.state.exp; return e.pHMeasured > 6.85 && e.pHMeasured < 7.3; }, null, { timeout: 8000 });
    await page.waitForTimeout(250); // optische Glättung der Farbe (0,2 s)
    const mid = await pxColor();
    const meas1 = await page.evaluate(() => [Titrierlabor.app.state.exp.pHMeasured, Titrierlabor.app.state.exp.pH]);
    assert(meas1[1] > 9, 'Gleichgewichts-pH nach dem Tropfen: ' + meas1[1]);
    assert(mid[1] > mid[0] && mid[1] > mid[2], 'Lösung im Umschlag nicht grün: ' + mid);
    const shown = await page.textContent('#roPH');
    assert(/^[67],/.test(shown), 'Anzeige folgt nicht der Farbe: ' + shown);
    await shot(page, '10-btb-gruenphase-desktop');
    await page.waitForFunction(() => Titrierlabor.app.state.exp.pHMeasured > 8.2, null, { timeout: 12000 });
    const after = await pxColor();
    assert(after[2] > after[0], 'danach nicht blau: ' + after);
    await page.click('#btnEndpoint');
    await page.waitForTimeout(300);
    await page.click('#btnToEval');
    await page.waitForSelector('[data-phase-panel="evaluation"]:not([hidden])');
    const note = await page.textContent('#mixNote');
    assert(note.includes('Mischfarbe') && note.includes('Carbonat'), 'Hinweis fehlt');
    assert(page.__errors.length === 0, 'Fehler: ' + page.__errors.join(' | '));
    await page.context().close();
  });

  await run('E8', 'Lehrkraftmodus und Kurzanleitung (dunkel, Desktop)', async () => {
    const page = await newPage(browser, DESKTOP);
    await fresh(page);
    await titrate(page, { sample: 'weakAcid', toFraction: 0.6 });
    await page.click('[data-mode="teacher"]');
    await page.waitForSelector('#teacherCard:not([hidden])');
    await shot(page, '09-lehrkraft-dunkel-desktop');
    await page.click('#btnHelp');
    await page.waitForSelector('#helpModal:not([hidden])');
    const txt = await page.textContent('#helpModal');
    assert(txt.includes('Farbschema') && txt.includes('rechts neben der Apparatur'), 'Kurzanleitung nicht aktualisiert');
    await page.click('#btnHelpClose');
    assert(page.__errors.length === 0, 'Fehler: ' + page.__errors.join(' | '));
    await page.context().close();
  });
} finally {
  await browser.close();
  server.close();
}

fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify({ date: new Date().toISOString(), root: path.relative(APP, ROOT) || '.', results }, null, 2) + '\n');
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Szenarien bestanden`);
process.exit(failed.length ? 1 : 0);
