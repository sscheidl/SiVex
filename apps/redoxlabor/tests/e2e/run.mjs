// End-to-End-Prüfung des Redoxlabors im echten Browser (Chromium über Playwright).
// Bedient die Anwendung wie Lernende (Maus, Touch, Drag-and-drop), misst die
// gerenderten Pixel der Lupe über die Zeit und erzeugt Screenshot-Nachweise.
//
// Aufruf: npm run build && node tests/e2e/run.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const ROOT = fs.existsSync(path.join(APP, 'dist/redoxlabor/index.html')) ? path.join(APP, 'dist/redoxlabor') : APP;
const SHOTS = path.join(APP, 'docs/screenshots');
const PORT = 8123;
const BASE = `http://localhost:${PORT}/index.html?noIntro`;
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ Hilfen
function hsl([r, g, b]) {
  const c = Math.round(Math.max(r, g, b) - Math.min(r, g, b)); // Buntheit 0–255
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: +s.toFixed(2), l: +l.toFixed(2), c };
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Wird in jede Seite injiziert: Messfunktionen für die Lupe
const PAGE_HELPERS = () => {
  window.__probe = (kind) => {
    const { lab, chem, renderer } = window.RedoxLab;
    const t = lab.activeTube();
    const c = t.contents;
    const p = renderer.probe();
    const vol = chem.volume(c) * (1 - c.lost);
    const h = vol * p.portionH;
    const canvas = document.getElementById('lab');
    const rect = canvas.getBoundingClientRect();
    const k = canvas.width / rect.width;
    const ctx = canvas.getContext('2d');
    const px = (lx, ly) => { const cl = p.toClient(lx, ly); return [Math.round((cl.x - rect.left) * k), Math.round((cl.y - rect.top) * k)]; };
    const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    if (kind === 'color') {
      const [x, y] = px(p.cx + 4 * p.Z, p.by - h * p.Z * 0.42);
      const d = ctx.getImageData(x - 5, y - 5, 11, 11).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      // Körnung/Trübung: Helligkeitsstreuung entlang einer senkrechten Linie
      // lokale Rauheit (mittlere Differenz benachbarter Pixel) auf fünf senkrechten Linien, Median
      const roughs = [-8, -4, 0, 4, 8].map((dx) => {
        const [x2, y0] = px(p.cx + dx * p.Z, p.by - h * p.Z * 0.85);
        const [, y1] = px(p.cx + dx * p.Z, p.by - h * p.Z * 0.15);
        const col = ctx.getImageData(x2, y0, 1, Math.max(2, y1 - y0)).data;
        const ls = []; for (let i = 0; i < col.length; i += 4) ls.push(lum(col, i));
        let rr = 0; for (let i = 1; i < ls.length; i++) rr += Math.abs(ls[i] - ls[i - 1]);
        return rr / (ls.length - 1);
      }).sort((a, b2) => a - b2);
      return { rgb: [r / n, g / n, b / n], rough: roughs[2] };
    }
    if (kind === 'mirror') {
      const ri = (p.r - 3.5) * p.Z;
      const [x0, y0] = px(p.cx - ri * 0.92, p.by - h * p.Z * 0.9);
      const [x1, y1] = px(p.cx + ri * 0.92, p.by - 6 * p.Z);
      const d = ctx.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
      let dark = 0, n = 0, sum = 0, sum2 = 0, sat = 0;
      for (let i = 0; i < d.length; i += 16) {
        const L = lum(d, i); n++; sum += L; sum2 += L * L;
        if (L < 160) dark++;
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        sat += mx ? (mx - mn) / mx : 0;
      }
      // Bereich oberhalb der Flüssigkeit (Glaswand ohne Kontakt zur Lösung)
      const [ax0, ay0] = px(p.cx - ri * 0.8, p.by - (h + 30) * p.Z);
      const [ax1, ay1] = px(p.cx + ri * 0.8, p.by - (h + 8) * p.Z);
      const a = ctx.getImageData(ax0, ay0, Math.max(1, ax1 - ax0), Math.max(1, ay1 - ay0)).data;
      let adark = 0, an = 0;
      for (let i = 0; i < a.length; i += 16) { an++; if (lum(a, i) < 160) adark++; }
      const mean = sum / n;
      // Helligkeitsumfang quer über das Glas (Mitte der Flüssigkeitshöhe): 95.–5. Perzentil
      const ranges = [0.3, 0.5, 0.7].map((f) => {
        const [lx0, ly] = px(p.cx - ri * 0.95, p.by - h * p.Z * f);
        const [lx1] = px(p.cx + ri * 0.95, p.by - h * p.Z * f);
        const line = ctx.getImageData(lx0, ly, Math.max(2, lx1 - lx0), 1).data;
        const ls = []; for (let i = 0; i < line.length; i += 4) ls.push(lum(line, i));
        ls.sort((x, y) => x - y);
        return ls[Math.floor(ls.length * 0.95)] - ls[Math.floor(ls.length * 0.05)];
      }).sort((x, y) => x - y);
      const range = ranges[1]; // Median
      return { dark: dark / n, mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), sat: sat / n, aboveDark: adark / an, range };
    }
    return null;
  };
  // Verkleinerte Helligkeitskarte eines Bereichs (logische Szenenkoordinaten) für Bewegungsvergleiche
  window.__snap = (x, y, w, h) => {
    const { renderer } = window.RedoxLab;
    const canvas = document.getElementById('lab');
    const rect = canvas.getBoundingClientRect(); const k = canvas.width / rect.width;
    const a = renderer.toClient(x, y), b = renderer.toClient(x + w, y + h);
    const X = Math.round((a.x - rect.left) * k), Y = Math.round((a.y - rect.top) * k);
    const d = canvas.getContext('2d').getImageData(X, Y, Math.round((b.x - a.x) * k), Math.round((b.y - a.y) * k)).data;
    const out = []; for (let i = 0; i < d.length; i += 4 * 7) out.push(Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]));
    return out;
  };
  window.__tube = (id) => {
    const { lab, chem } = window.RedoxLab;
    const t = lab.tubeById(id);
    const c = t.contents;
    const ap = chem.appearance(c);
    return {
      place: t.place, vol: chem.volume(c), progress: +c.progress.toFixed(3), temp: Math.round(c.temp),
      observable: chem.isObservable(c), outcome: chem.classify(c).outcome, phase: lab.phaseOf(id).id,
      status: chem.analyze(c).status, mirror: ap ? ap.mirror : 0, sample: c.sampleId
    };
  };
};

async function newPage(browser, opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 }, opts));
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(PAGE_HELPERS);
  await page.goto(BASE);
  await page.waitForFunction(() => window.RedoxLab && window.RedoxLab.lab);
  await sleep(400);
  return { context, page, errors, requests };
}

const idle = (page) => page.waitForFunction(() => !window.RedoxLab.lab.busy(), null, { timeout: 15000 });
async function click(page, sel) { await page.click(sel); await sleep(60); await idle(page); }
async function tap(page, sel) { await page.locator(sel).tap(); await sleep(60); await idle(page); }
async function anchor(page, target) { return page.evaluate((t) => window.RedoxLab.renderer.anchor(t), target); }
async function canvasTap(page, target) { const a = await anchor(page, target); await page.touchscreen.tap(a.x, a.y); await sleep(60); await idle(page); }
async function canvasClick(page, target) { const a = await anchor(page, target); await page.mouse.click(a.x, a.y); await sleep(60); await idle(page); }
async function drag(page, from, to) {
  const a = await anchor(page, from), b = await anchor(page, to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 12, a.y + (b.y - a.y) * i / 12); await sleep(16); }
  await page.mouse.up(); await sleep(60); await idle(page);
}
const tube = (page, id) => page.evaluate((i) => window.__tube(i), id);
const probe = (page, kind) => page.evaluate((k) => window.__probe(k), kind);
async function waitObservable(page, id, timeout = 45000) {
  await page.waitForFunction((i) => window.__tube(i).observable, id, { timeout, polling: 250 });
}
// Reaktion praktisch abgeschlossen (ein positiver Befund ist schon vorher möglich)
async function waitComplete(page, id, timeout = 60000) {
  await page.waitForFunction((i) => window.__tube(i).progress >= 0.97, id, { timeout, polling: 250 });
}
async function shot(page, name, clip) { const f = path.join(SHOTS, name); await page.screenshot(clip ? { path: f, clip } : { path: f }); return path.relative(APP, f); }
async function lupeClip(page) {
  return page.evaluate(() => {
    const { renderer } = window.RedoxLab; const L = renderer.layout.detail;
    const a = renderer.toClient(L.x, L.y), b = renderer.toClient(L.x + L.w, L.y + L.h);
    return { x: Math.floor(a.x), y: Math.floor(a.y), width: Math.ceil(b.x - a.x), height: Math.ceil(b.y - a.y) };
  });
}

async function contactSheet(browser, frames, title, file) {
  const page = await browser.newPage({ viewport: { width: 200 * frames.length + 40, height: 300 } });
  const imgs = frames.map((f) => `<figure><img src="data:image/png;base64,${f.png.toString('base64')}"><figcaption>${f.caption}</figcaption></figure>`).join('');
  await page.setContent(`<html><body style="margin:0;font-family:system-ui;background:#fff"><h3 style="margin:10px 20px">${title}</h3><div style="display:flex;gap:8px;padding:0 20px">${imgs}</div>
    <style>figure{margin:0;width:192px}img{width:192px}figcaption{font-size:12px;color:#333;text-align:center}</style></body></html>`);
  await page.screenshot({ path: path.join(SHOTS, file), fullPage: true });
  await page.close();
  return 'docs/screenshots/' + file;
}

async function test(id, title, fn) {
  const t0 = Date.now();
  try {
    const evidence = await fn();
    results.push({ id, title, status: 'PASS', seconds: Math.round((Date.now() - t0) / 1000), evidence });
    console.log(`PASS ${id} – ${title}`);
  } catch (e) {
    results.push({ id, title, status: 'FAIL', seconds: Math.round((Date.now() - t0) / 1000), error: String(e && e.stack || e).split('\n').slice(0, 4).join(' | ') });
    console.log(`FAIL ${id} – ${title}: ${e && e.message}`);
  }
}

// ------------------------------------------------------------------ Szenarien
async function fehlingByMouse(page, tubeId, sample) {
  await click(page, '[data-hotplate="80"]');
  await click(page, `[data-tube="${tubeId}"]`);
  await click(page, '[data-reagent="fehling1"]');
  await click(page, '[data-reagent="fehling2"]');
  await click(page, '[data-action="shake"]');
  if (sample) await click(page, `[data-sample="${sample}"]`);
}

async function fillProtocol(page, a) {
  await page.check(`#protoForm input[name="method"][value="${a.method}"]`);
  for (const o of a.obs) await page.check(`#protoForm input[name="obs"][value="${o}"]`);
  await page.check(`#protoForm input[name="result"][value="${a.result}"]`);
  await page.check(`#protoForm input[name="interp"][value="${a.interp}"]`);
  await page.check(`#protoForm input[name="cls"][value="${a.cls}"]`);
  await page.click('#protoForm button[type="submit"]');
  await sleep(200);
}

async function scenarioStart(browser) {
  await test('VIS-1', 'Unbenutzter Labortisch wird gerendert', async () => {
    const { page, errors, context } = await newPage(browser);
    await sleep(600);
    const f = await shot(page, '01-labortisch.png');
    const counts = await page.evaluate(() => ({ reagents: document.querySelectorAll('[data-reagent]').length, samples: document.querySelectorAll('[data-sample]').length, tubes: document.querySelectorAll('[data-tube]').length }));
    assert(counts.reagents === 5 && counts.samples === 10 && counts.tubes === 4, JSON.stringify(counts));
    assert(errors.length === 0, errors.join('; '));
    await context.close();
    return { screenshot: f, counts };
  });
}

async function scenarioFehlingEthanal(browser) {
  const { page, errors, context } = await newPage(browser);
  const ev = {};
  await test('C-01/C-02', 'Fehling I hellblau, Fehling II farblos (gerenderte Pixel in der Lupe)', async () => {
    await click(page, '[data-hotplate="80"]');
    await click(page, '[data-tube="2"]');
    await click(page, '[data-reagent="fehling2"]');
    const c2 = hsl((await probe(page, 'color')).rgb);
    await click(page, '[data-tube="1"]');
    await click(page, '[data-reagent="fehling1"]');
    const c1 = hsl((await probe(page, 'color')).rgb);
    ev.fehling1 = c1; ev.fehling2 = c2;
    assert(c1.h >= 190 && c1.h <= 215 && c1.l > 0.55 && c1.c > 60, 'Fehling I nicht hellblau: ' + JSON.stringify(c1));
    assert(c2.c < 22 && c2.l > 0.75, 'Fehling II nicht farblos (Buntheit < 22 von 255): ' + JSON.stringify(c2));
    ev.shot = await shot(page, '02-fehling-I-und-II-vor-dem-Mischen.png');
    return { 'Fehling I (Reagenzglas 1)': c1, 'Fehling II (Reagenzglas 2)': c2, screenshot: ev.shot };
  });
  await test('C-03', 'Beim Mischen entsteht sichtbar die tiefblaue Fehling-Lösung', async () => {
    await page.click('[data-reagent="fehling2"]');
    await page.waitForFunction(() => window.__tube(1).vol === 2, null, { timeout: 5000 });
    await sleep(500);
    const layered = await shot(page, '02b-fehling-schichtung-beim-zugeben.png');
    await idle(page);
    await click(page, '[data-action="shake"]');
    await sleep(900);
    const pc = await probe(page, 'color');
    ev.clearRough = pc.rough;
    const c = hsl(pc.rgb);
    assert(c.h >= 215 && c.h <= 240 && c.l < 0.5, 'nicht tiefblau: ' + JSON.stringify(c));
    assert(c.l < ev.fehling1.l - 0.15, 'nicht dunkler als Fehling I');
    const f = await shot(page, '03-fehling-tiefblau-nach-dem-Mischen.png');
    return { gemischt: c, screenshots: [layered, f] };
  });
  await test('E-08a', 'Aldehyd zugegeben, nicht erwärmt: Probe sichtbar, Zustand aktualisiert, keine Reaktion', async () => {
    await click(page, '[data-sample="ethanal"]');
    await sleep(4000);
    const s = await tube(page, 1);
    const c = hsl((await probe(page, 'color')).rgb);
    assert(s.vol === 3 && s.sample === 'ethanal', 'Probe nicht im Zustand');
    assert(s.phase === 'conditions' || s.phase === 'sampleAdded', 'Phase ' + s.phase);
    assert(s.progress === 0, 'Reaktion ohne Erwärmen');
    assert(c.h > 210, 'Darstellung nicht mehr blau: ' + JSON.stringify(c));
    return { zustand: s, farbe: c };
  });
  await test('F-01/V-03/V-04', 'Ethanal + Fehling + Wasserbad: kontinuierlicher Farbumschlag bis ziegelrot mit Trübung', async () => {
    const start = await probe(page, 'color');
    await click(page, '[data-action="bath"]');
    const series = [];
    const frames = [];
    const clip = await lupeClip(page);
    let midShot = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      const s = await tube(page, 1);
      const p = await probe(page, 'color');
      const c = hsl(p.rgb);
      series.push({ t: +((Date.now() - t0) / 1000).toFixed(1), progress: s.progress, temp: s.temp, h: c.h, s: c.s, l: c.l, rough: +p.rough.toFixed(2) });
      if (frames.length < 7 && (frames.length === 0 || s.progress >= [0, 0.05, 0.2, 0.35, 0.5, 0.7, 0.98][frames.length])) {
        frames.push({ png: await page.screenshot({ clip }), caption: `t=${series[series.length - 1].t}s · ${s.temp} °C · Umsatz ${Math.round(s.progress * 100)} %` });
      }
      if (!midShot && s.progress >= 0.4) midShot = await shot(page, '04-fehling-positiv-waehrend-Farbumschlag.png');
      if (s.observable && ev.firstObservable == null) ev.firstObservable = { progress: s.progress, outcome: s.outcome };
      if (s.progress >= 0.97) break;
      await sleep(400);
    }
    const end = series[series.length - 1];
    await sleep(800);
    frames.push({ png: await page.screenshot({ clip }), caption: `Ende · Umsatz ${Math.round((await tube(page, 1)).progress * 100)} %` });
    const f = await shot(page, '05-fehling-ziegelrot-ausgebildet.png');
    const sheet = await contactSheet(browser, frames, 'Fehling-Probe mit Ethanal – Lupe zu verschiedenen Zeitpunkten (Echtzeit-Rendering)', 'seq-fehling-ethanal.png');
    assert(end.progress >= 0.97, 'Reaktion nicht abgeschlossen: ' + JSON.stringify(end));
    // R5: positiver Befund schon bei deutlich sichtbarem Cu₂O, nicht erst bei vollständigem Umsatz
    assert(ev.firstObservable && ev.firstObservable.outcome === 'positive' && ev.firstObservable.progress < 0.97, 'früheste Beobachtung: ' + JSON.stringify(ev.firstObservable));
    const final = hsl((await probe(page, 'color')).rgb);
    assert(final.h <= 25 || final.h >= 350, 'Endfarbe nicht ziegelrot: ' + JSON.stringify(final));
    const buckets = new Set(series.map((x) => Math.round(x.h / 20)));
    assert(buckets.size >= 5, 'zu wenige unterscheidbare Farbstufen: ' + [...buckets]);
    assert(series.some((x) => x.h > 60 && x.h < 190 && x.s > 0.2), 'kein blaugrün/gelbgrüner Zwischenzustand');
    // Körnung flackert von Bild zu Bild (Partikel funkeln): Median aus sieben Messungen statt Einzelwert
    const roughs = [];
    for (let i = 0; i < 7; i++) { roughs.push((await probe(page, 'color')).rough); await sleep(250); }
    const endP = { rough: roughs.slice().sort((a, b) => a - b)[3] };
    // Körnung der Cu₂O-Suspension gegenüber der klaren tiefblauen Lösung (C-03)
    assert(endP.rough >= ev.clearRough * 2, `keine Trübung/Körnung messbar (Rauheit klar ${ev.clearRough.toFixed(2)} → ${endP.rough.toFixed(2)})`);
    ev.series = series;
    return { fruehesteBeobachtung: ev.firstObservable, endfarbe: final, farbstufen: buckets.size, rauheit: { klareLoesung: +ev.clearRough.toFixed(2), vorErwaermen: +start.rough.toFixed(2), ende: +endP.rough.toFixed(2) }, verlauf: series.filter((_, i) => i % 3 === 0), screenshots: [midShot, f, sheet] };
  });
  await test('U-06/D-04/D-05', 'Beobachtung eintragen und auswerten (positiv)', async () => {
    await click(page, '[data-action="record"]');
    const hasSolutionBefore = await page.locator('text=Musterauswertung').count();
    assert(hasSolutionBefore === 0, 'Musterlösung vor eigener Eingabe sichtbar');
    await fillProtocol(page, { method: 'fehling', obs: ['ziegelrot'], result: 'positiv', interp: 'reduzierend', cls: 'aldehyd' });
    await page.waitForSelector('text=Alles richtig ausgewertet!');
    const f = await shot(page, '12-protokoll-auswertung-positiv.png');
    return { screenshot: f };
  });
  await test('U-07/D-06/D-07', 'Redox-Trainer bearbeiten (6 Schritte) und Musterlösung anzeigen', async () => {
    await page.click('[data-goto="redox"]');
    await sleep(200);
    assert(await page.locator('text=Musterlösung Fehling-Probe').count() === 0, 'Musterlösung ungefragt sichtbar');
    const def = await page.evaluate(() => window.RedoxLab.redox.buildTrainer('fehling').steps.map((s) => ({ id: s.id, fields: window.RedoxLab.redox.fieldsOf(s).map((f) => [f.id, f.answer]) })));
    // Schritt 1 zuerst falsch beantworten → Rückmeldung
    await page.selectOption('select[data-field="ald"]', 'wird reduziert');
    await page.click('button[data-rx="check"][data-step="assign"]');
    await page.waitForSelector('select[data-field="ald"].wrong');
    await page.click('button[data-rx="hint"][data-step="assign"]');
    await page.waitForSelector('.hint-list li');
    for (const s of def) {
      for (const [fid, ans] of s.fields) await page.selectOption(`.rx-step[data-stepid="${s.id}"] select[data-field="${fid}"]`, ans);
      await page.click(`button[data-rx="check"][data-step="${s.id}"]`);
      await page.waitForSelector(`.rx-step.solved[data-stepid="${s.id}"]`);
    }
    await page.click('button[data-rx="full"]');
    await page.waitForSelector('text=Musterlösung Fehling-Probe');
    await page.waitForSelector('text=Beispiel: Ethanal → Ethansäure');
    const bal = await page.locator('table.bal').innerText();
    const f = await shot(page, '10-redox-auswertung.png');
    await page.locator('.drawer-body').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const f2 = await shot(page, '10b-redox-musterloesung.png');
    return { schritte: def.length, bilanz: bal.replace(/\s+/g, ' '), screenshots: [f, f2] };
  });
  await test('T-03a', 'Keine Laufzeitfehler im Fehling-Ablauf', async () => {
    const appErr = await page.evaluate(() => window.RedoxLab.errors);
    assert(errors.length === 0 && appErr.length === 0, errors.concat(appErr).join('; '));
    return { fehler: 0 };
  });
  await context.close();
}

async function scenarioPropanalTouch(browser) {
  const { page, errors, context } = await newPage(browser, { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: false });
  await test('F-02/U-02', 'Propanal + Fehling nur per Antippen auf dem Labortisch (Touch, Tablet-Querformat)', async () => {
    await canvasTap(page, { type: 'tube', id: 2 });
    await canvasTap(page, { type: 'hotplate' }); // Aus → 60 °C
    await canvasTap(page, { type: 'hotplate' }); // 60 → 80 °C
    await canvasTap(page, { type: 'reagent', id: 'fehling1' });
    await canvasTap(page, { type: 'reagent', id: 'fehling2' });
    await tap(page, '[data-action="shake"]');
    await canvasTap(page, { type: 'sample', id: 'propanal' });
    await canvasTap(page, { type: 'bath' });
    const s0 = await tube(page, 2);
    assert(s0.place === 'bath', 'nicht im Wasserbad: ' + s0.place);
    await page.waitForFunction(() => window.__tube(2).progress > 0.4, null, { timeout: 40000 });
    const f = await shot(page, '09-tablet-querformat-1180x820.png');
    await waitComplete(page, 2);
    const s = await tube(page, 2);
    assert(s.outcome === 'positive', 'Ergebnis ' + s.outcome);
    const c = hsl((await probe(page, 'color')).rgb);
    assert(c.h <= 25 || c.h >= 350, 'nicht ziegelrot ' + JSON.stringify(c));
    const layout = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      canvasW: document.getElementById('lab').getBoundingClientRect().width,
      panelW: document.getElementById('panel').getBoundingClientRect().width
    }));
    assert(layout.scrollW <= layout.innerW, 'horizontales Scrollen');
    assert(errors.length === 0, errors.join('; '));
    return { zustand: s, farbe: c, layout, screenshot: f };
  });
  await test('U-02b/D-03/U-05', 'Gestufte Hilfe per Touch, drei Stufen, kontextabhängig', async () => {
    await tap(page, '#btnHelp');
    const ctx1 = await page.locator('#helpContext').innerText();
    for (let i = 0; i < 3; i++) await tap(page, '#helpMore');
    const levels = await page.locator('#helpLevels li').allInnerTexts();
    assert(levels.length === 3, 'Stufen: ' + levels.length);
    const f = await shot(page, '13-hilfe-drei-stufen.png');
    await canvasTap(page, { type: 'tube', id: 3 });
    await sleep(400);
    const ctx2 = await page.locator('#helpContext').innerText();
    const shownAfter = await page.locator('#helpLevels li').count();
    assert(ctx1 !== ctx2, 'Kontext ändert sich nicht');
    assert(shownAfter === 0, 'Hilfe wurde bei neuem Kontext nicht zurückgesetzt');
    return { kontextVorher: ctx1, kontextNachher: ctx2, stufen: levels.map((l) => l.slice(0, 90)), screenshot: f };
  });
  await context.close();
}

async function scenarioPropanonOffline(browser) {
  const { page, errors, context, requests } = await newPage(browser);
  await test('N-01/C-05/T-06', 'Propanon + Fehling ohne Netzwerk: kein Cu₂O, Lösung bleibt blau', async () => {
    await context.setOffline(true);
    await fehlingByMouse(page, 1, 'propanon');
    await click(page, '[data-action="bath"]');
    await waitObservable(page, 1);
    const s = await tube(page, 1);
    const c = hsl((await probe(page, 'color')).rgb);
    assert(s.outcome === 'negative' && s.progress === 0, JSON.stringify(s));
    assert(c.h >= 210 && c.h <= 245, 'nicht blau: ' + JSON.stringify(c));
    const f = await shot(page, '06-fehling-negativ-propanon.png');
    return { zustand: s, farbe: c, screenshot: f };
  });
  await test('E-10', 'Korrekt durchgeführter negativer Nachweis wird erfolgreich ausgewertet', async () => {
    await click(page, '[data-action="record"]');
    await fillProtocol(page, { method: 'fehling', obs: ['tiefblau', 'keineVeraenderung'], result: 'negativ', interp: 'nichtReduzierend', cls: 'keinAldehyd' });
    await page.waitForSelector('text=Alles richtig ausgewertet!');
    const f = await shot(page, '14-protokoll-negativ.png');
    return { screenshot: f };
  });
  await test('T-10', 'Keine Anfragen an externe Server', async () => {
    const ext = requests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:'));
    assert(ext.length === 0, ext.join(', '));
    assert(errors.length === 0, errors.join('; '));
    return { anfragen: requests.length, extern: 0 };
  });
  await context.close();
}

async function scenarioTollensEthanal(browser) {
  const { page, errors, context } = await newPage(browser);
  await test('E-02/Tollens-Vorbereitung', 'AgNO₃ → brauner Ag₂O-Niederschlag mit NaOH → klare Lösung durch NH₃', async () => {
    await click(page, '[data-hotplate="60"]');
    await click(page, '[data-tube="2"]');
    await click(page, '[data-reagent="agno3"]');
    const c0 = hsl((await probe(page, 'color')).rgb);
    await click(page, '[data-reagent="naoh"]');
    await sleep(800);
    const c1 = hsl((await probe(page, 'color')).rgb);
    const s1 = await tube(page, 2);
    const f1 = await shot(page, '07a-tollens-silberoxid-niederschlag.png');
    await click(page, '[data-reagent="nh3"]');
    await sleep(800);
    const c2 = hsl((await probe(page, 'color')).rgb);
    await click(page, '[data-reagent="nh3"]');
    await sleep(1000);
    const c3 = hsl((await probe(page, 'color')).rgb);
    const s3 = await tube(page, 2);
    assert(c0.c < 22 && c0.l > 0.75, 'AgNO₃ nicht farblos ' + JSON.stringify(c0));
    assert(s1.status === 'precipitate' && c1.l < 0.5 && c1.h >= 15 && c1.h <= 45, 'kein brauner Niederschlag ' + JSON.stringify(c1));
    assert(c2.l > c1.l, 'Niederschlag löst sich nicht teilweise');
    assert(s3.status === 'ready' && c3.l > 0.75 && c3.c < 22, 'nicht klar ' + JSON.stringify(c3));
    return { AgNO3: c0, 'nach NaOH': c1, 'nach 1× NH3': c2, 'nach 2× NH3': c3, screenshot: f1 };
  });
  await test('F-03/C-07/C-09/V-05/V-06', 'Ethanal + Tollens im Wasserbad: Silberspiegel wächst auf der Innenwand', async () => {
    await click(page, '[data-sample="ethanal"]');
    await sleep(3000);
    const before = await probe(page, 'mirror');
    assert((await tube(page, 2)).progress < 0.05, 'vor dem Erwärmen höchstens beginnende Reaktion');
    await click(page, '[data-action="bath"]');
    const clip = await lupeClip(page);
    const series = [], frames = [];
    let early = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 50000) {
      const s = await tube(page, 2);
      const m = await probe(page, 'mirror');
      series.push({ t: +((Date.now() - t0) / 1000).toFixed(1), progress: s.progress, mirror: +s.mirror.toFixed(2), dark: +m.dark.toFixed(3), std: Math.round(m.std), sat: +m.sat.toFixed(2), above: +m.aboveDark.toFixed(3) });
      if (frames.length < 7 && (frames.length === 0 || s.progress >= [0, 0.08, 0.18, 0.3, 0.45, 0.65, 0.98][frames.length])) {
        frames.push({ png: await page.screenshot({ clip }), caption: `t=${series[series.length - 1].t}s · ${s.temp} °C · Umsatz ${Math.round(s.progress * 100)} %` });
      }
      if (!early && s.progress >= 0.22) early = await shot(page, '07-tollens-beginnende-silberabscheidung.png');
      if (s.progress >= 0.97) break;
      await sleep(400);
    }
    await sleep(1200);
    const end = await probe(page, 'mirror');
    const s = await tube(page, 2);
    frames.push({ png: await page.screenshot({ clip }), caption: `Ende · Umsatz ${Math.round(s.progress * 100)} %` });
    const f = await shot(page, '08-tollens-silberspiegel-ausgebildet.png');
    const sheet = await contactSheet(browser, frames, 'Tollens-Probe mit Ethanal – Silberabscheidung an der Glaswand (Echtzeit-Rendering)', 'seq-tollens-ethanal.png');
    assert(s.outcome === 'positive', 'Ergebnis ' + s.outcome);
    const darks = series.map((x) => x.dark);
    const levels = new Set(darks.map((d) => Math.round(d * 10)));
    assert(before.dark < 0.05, 'Spiegel vor Reaktion: ' + before.dark);
    assert(end.dark > 0.3, 'kaum Belag: ' + end.dark);
    assert(levels.size >= 4, 'Wachstum nicht in Stufen messbar: ' + [...levels]);
    // metallisch: unbunt und großer Helligkeitsumfang (Glanzlicht ↔ dunkle Spiegelung), deutlich größer als bei klarer Lösung
    assert(end.sat < 0.15 && end.range > 130 && end.range > before.range + 80, `kein metallischer Eindruck (Umfang ${before.range.toFixed(0)} → ${end.range.toFixed(0)}, Buntheit ${end.sat.toFixed(2)})`);
    assert(end.aboveDark < 0.05, 'Belag oberhalb der Flüssigkeit: ' + end.aboveDark);
    await click(page, '[data-action="rack"]');
    await sleep(1500);
    const f2 = await shot(page, '08b-tollens-silberspiegel-im-staender.png');
    assert(errors.length === 0, errors.join('; '));
    return { vorher: before, ende: end, stufen: levels.size, verlauf: series.filter((_, i) => i % 3 === 0), screenshots: [early, f, f2, sheet] };
  });
  await context.close();
}

async function scenarioTollensButanalDrag(browser) {
  const { page, errors, context } = await newPage(browser);
  await test('F-04/U-01', 'Butanal + Tollens per Drag-and-drop mit der Maus', async () => {
    await canvasClick(page, { type: 'hotplate' }); // 60 °C
    await drag(page, { type: 'reagent', id: 'agno3' }, { type: 'tube', id: 3 });
    await drag(page, { type: 'reagent', id: 'naoh' }, { type: 'tube', id: 3 });
    await drag(page, { type: 'reagent', id: 'nh3' }, { type: 'tube', id: 3 });
    await drag(page, { type: 'reagent', id: 'nh3' }, { type: 'tube', id: 3 });
    await drag(page, { type: 'sample', id: 'butanal' }, { type: 'tube', id: 3 });
    const s0 = await tube(page, 3);
    assert(s0.vol === 5 && s0.status === 'ready', JSON.stringify(s0));
    await drag(page, { type: 'tube', id: 3 }, { type: 'bath' });
    assert((await tube(page, 3)).place === 'bath', 'nicht ins Bad gezogen');
    await waitComplete(page, 3);
    const s = await tube(page, 3);
    const m = await probe(page, 'mirror');
    assert(s.outcome === 'positive' && s.mirror > 0.95 && m.dark > 0.3, JSON.stringify({ s, m }));
    assert(errors.length === 0, errors.join('; '));
    return { zustand: s, belag: m };
  });
  await context.close();
}

async function scenarioNegatives(browser) {
  // N-02, N-03, N-04, N-05 parallel in eigenen Seiten
  const run = async (id, title, fn) => { const p = await newPage(browser); await test(id, title, () => fn(p.page, p.errors)); await p.context.close(); };
  await Promise.all([
    run('N-02/C-08', 'Butanon + Tollens: kein Silberspiegel', async (page, errors) => {
      await click(page, '[data-hotplate="60"]');
      await click(page, '[data-tube="1"]');
      for (const r of ['agno3', 'naoh', 'nh3', 'nh3']) await click(page, `[data-reagent="${r}"]`);
      await click(page, '[data-sample="butanon"]');
      await click(page, '[data-action="bath"]');
      await waitObservable(page, 1);
      await sleep(1000);
      const s = await tube(page, 1), m = await probe(page, 'mirror');
      assert(s.outcome === 'negative' && s.mirror === 0 && m.dark < 0.05, JSON.stringify({ s, m }));
      assert(errors.length === 0, errors.join('; '));
      const f = await shot(page, '15-tollens-negativ-butanon.png');
      return { zustand: s, belag: m, screenshot: f };
    }),
    run('N-03', 'Ethanal + nur Fehling I + Wasserbad: kein gültiger Nachweis', async (page) => {
      await click(page, '[data-hotplate="80"]');
      await click(page, '[data-tube="1"]');
      await click(page, '[data-reagent="fehling1"]');
      await click(page, '[data-sample="ethanal"]');
      await click(page, '[data-action="bath"]');
      await waitObservable(page, 1);
      const s = await tube(page, 1), c = hsl((await probe(page, 'color')).rgb);
      assert(s.outcome === 'invalid' && s.progress === 0, JSON.stringify(s));
      assert(c.h >= 190 && c.h <= 220, 'Farbe ' + JSON.stringify(c));
      return { zustand: s, farbe: c };
    }),
    run('N-04', 'Ethanal + vollständige Fehling-Lösung ohne Erwärmen: kein abgeschlossener Nachweis', async (page) => {
      await click(page, '[data-tube="1"]');
      await click(page, '[data-reagent="fehling1"]');
      await click(page, '[data-reagent="fehling2"]');
      await click(page, '[data-action="shake"]');
      await click(page, '[data-sample="ethanal"]');
      await sleep(25000);
      const s = await tube(page, 1), c = hsl((await probe(page, 'color')).rgb);
      assert(s.progress === 0 && !s.observable && s.outcome === 'unfinished', JSON.stringify(s));
      assert(c.h >= 215, 'Farbe ' + JSON.stringify(c));
      await click(page, '[data-action="record"]');
      await page.click('[data-proto="solution"]');
      await page.waitForSelector('text=Noch nicht erwärmt');
      return { zustand: s, farbe: c, wartezeit_s: 25 };
    }),
    run('N-05', 'Ethanal + unvollständiges Tollens-Reagenz (ohne Ammoniak) + Wasserbad: kein Silberspiegel', async (page) => {
      await click(page, '[data-hotplate="60"]');
      await click(page, '[data-tube="1"]');
      await click(page, '[data-reagent="agno3"]');
      await click(page, '[data-reagent="naoh"]');
      await click(page, '[data-sample="ethanal"]');
      await click(page, '[data-action="bath"]');
      await waitObservable(page, 1);
      const s = await tube(page, 1);
      assert(s.outcome === 'invalid' && s.mirror === 0 && s.progress === 0, JSON.stringify(s));
      return { zustand: s };
    })
  ]);
}

async function scenarioModesAndReset(browser) {
  const { page, errors, context } = await newPage(browser);
  await test('U-03/E-09', 'Experiment zurücksetzen und erneut durchführen', async () => {
    await click(page, '[data-tube="1"]');
    await click(page, '[data-reagent="fehling1"]');
    await click(page, '[data-hotplate="80"]');
    await page.click('#btnRestart');
    await page.click('[data-m="resetBench"]');
    await sleep(300);
    const st = await page.evaluate(() => window.RedoxLab.lab.state.tubes.map((t) => window.RedoxLab.chem.volume(t.contents)).concat(window.RedoxLab.lab.state.bath.setting));
    assert(st.every((x) => x === 0), JSON.stringify(st));
    await click(page, '[data-tube="1"]');
    await click(page, '[data-reagent="fehling1"]');
    assert((await tube(page, 1)).vol === 1, 'erneute Durchführung nicht möglich');
    return { nachReset: st };
  });
  await test('U-04/D-01/D-02', 'Wechsel Lern-/Analysemodus, Proben A–F, neues Mischen beim Neustart', async () => {
    const learn = await page.locator('[data-sample] .nm').allInnerTexts();
    await page.click('.mode-switch [data-mode="analysis"]');
    await page.click('[data-m="mode"]');
    await sleep(300);
    const ana = await page.locator('[data-sample] .nm').allInnerTexts();
    const map1 = await page.evaluate(() => window.RedoxLab.lab.state.samples.map((s) => s.sampleId).join());
    let changed = false;
    for (let i = 0; i < 6 && !changed; i++) {
      await page.click('#btnRestart'); await page.click('[data-m="fullRestart"]'); await sleep(150);
      changed = (await page.evaluate(() => window.RedoxLab.lab.state.samples.map((s) => s.sampleId).join())) !== map1;
    }
    assert(learn.join() === 'Ethanal,Propanal,Butanal,Propanon,Butanon,Pentan-2-on,Glucose,Fructose,Saccharose,Maltose', learn.join());
    assert(ana.join() === 'A,B,C,D,E,F', ana.join());
    assert(changed, 'Zuordnung wird nicht neu gemischt');
    return { lernmodus: learn, analysemodus: ana };
  });
  await test('D-02b', 'Analysemodus: zwei unbekannte Proben untersuchen, vergleichen, einordnen', async () => {
    const samples = await page.evaluate(() => window.RedoxLab.lab.state.samples);
    // Probe A mit Fehling (Reagenzglas 1), Probe B mit Tollens (Reagenzglas 2), parallel im Wasserbad (80 °C)
    await click(page, '[data-hotplate="80"]');
    await click(page, '[data-tube="1"]');
    await click(page, '[data-reagent="fehling1"]'); await click(page, '[data-reagent="fehling2"]'); await click(page, '[data-action="shake"]');
    await click(page, `[data-sample="${samples[0].sampleId}"]`);
    await click(page, '[data-action="bath"]');
    await click(page, '[data-tube="2"]');
    for (const r of ['agno3', 'naoh', 'nh3', 'nh3']) await click(page, `[data-reagent="${r}"]`);
    await click(page, `[data-sample="${samples[1].sampleId}"]`);
    await click(page, '[data-action="bath"]');
    await waitObservable(page, 1); await waitObservable(page, 2);
    for (const id of [1, 2]) {
      await click(page, `[data-tube="${id}"]`);
      await click(page, '[data-action="record"]');
      await page.click('[data-proto="solution"]');
      await page.waitForSelector('text=Musterauswertung');
      await page.click('[data-newform="1"]');
    }
    await page.click('#btnEval');
    await page.click('.tabs [data-tab="overview"]');
    const truth = await page.evaluate(() => window.RedoxLab.lab.state.samples.map((s) => [s.key, window.RedoxLab.chem.SAMPLE_BY_ID[s.sampleId].reducing]));
    for (const [k, red] of truth.slice(0, 2)) await page.selectOption(`select[data-assign="${k}"]`, red ? 'aldehyd' : 'keinAldehyd');
    await page.click('[data-an="check"]');
    await sleep(200);
    const okPills = await page.locator('table.ov .pill.ok').count();
    await page.click('[data-an="reveal"]');
    await sleep(200);
    const f = await shot(page, '16-analysemodus-ergebnisuebersicht.png');
    const rows = await page.locator('table.ov tbody tr').allInnerTexts();
    assert(okPills >= 2, 'Einordnung nicht als richtig erkannt: ' + okPills);
    assert(rows.length === 6, 'Zeilen ' + rows.length);
    assert(errors.length === 0, errors.join('; '));
    return { zeilen: rows.map((r) => r.replace(/\s+/g, ' ')), screenshot: f };
  });
  await context.close();
}

async function scenarioMotion(browser) {
  const { page, errors, context } = await newPage(browser);
  await test('V-02/E-07/V-07', 'Zugeben und Schütteln sind bewegte Animationen (Pixelmessung über die Zeit)', async () => {
    const diff = (a, b) => a.reduce((s2, v, i) => s2 + Math.abs(v - b[i]), 0) / a.length;
    const region = [470, 40, 540, 860];
    // Höhe der hellblauen Flüssigkeitssäule in der Lupe (Pixelzeilen der Glasmitte)
    const blueRows = () => page.evaluate(() => {
      const { renderer } = window.RedoxLab; const p = renderer.probe();
      const canvas = document.getElementById('lab'); const rect = canvas.getBoundingClientRect(); const k = canvas.width / rect.width;
      const a = p.toClient(p.cx + 3 * p.Z, p.by - 200 * p.Z), b = p.toClient(p.cx + 3 * p.Z, p.by - 4 * p.Z);
      const x = Math.round((a.x - rect.left) * k), y0 = Math.round((a.y - rect.top) * k), y1 = Math.round((b.y - rect.top) * k);
      const d = canvas.getContext('2d').getImageData(x, y0, 1, y1 - y0).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] - d[i] > 70) n++;
      return n;
    });
    await click(page, '[data-tube="1"]');
    await sleep(800);
    const r1 = await page.evaluate((r) => window.__snap(...r), region); await sleep(250);
    const r2 = await page.evaluate((r) => window.__snap(...r), region);
    const idleDiff = diff(r1, r2);
    await page.click('[data-reagent="fehling1"]');
    const frames = [], rows = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 2300) {
      // nur Bilder werten, solange die Zugabe noch läuft (danach steht die Pipette zu Recht still)
      if (!(await page.evaluate(() => window.RedoxLab.lab.busy()))) break;
      frames.push(await page.evaluate((r) => window.__snap(...r), region));
      rows.push(await blueRows());
      await sleep(90);
    }
    await idle(page);
    const moveDiffs = frames.slice(1).map((f, i) => diff(frames[i], f));
    const distinctRows = [...new Set(rows)].sort((a, b) => a - b);
    // Schütteln (nach Zugabe von Fehling II): Lupe verändert sich fortlaufend
    await click(page, '[data-reagent="fehling2"]');
    const lupe = await page.evaluate(() => { const D = window.RedoxLab.renderer.layout.detail; return [D.x, D.y, D.w, D.h]; });
    const l0 = await page.evaluate((r) => window.__snap(...r), lupe);
    await page.click('[data-action="shake"]');
    const shake = [];
    for (let i = 0; i < 4; i++) { await sleep(220); shake.push(await page.evaluate((r) => window.__snap(...r), lupe)); }
    const shakeDiffs = shake.map((f, i) => diff(i ? shake[i - 1] : l0, f));
    await idle(page);
    assert(errors.length === 0, errors.join('; '));
    // Kriterium: jede Bildänderung während der Zugabe > 2× Ruherauschen, die stärkste > 5×
    assert(moveDiffs.length >= 4 && moveDiffs.every((d) => d > idleDiff * 2) && Math.max(...moveDiffs) > idleDiff * 5, `Pipettenbewegung nicht über mehrere Zeitpunkte sichtbar: Ruhe ${idleDiff.toFixed(2)}, ${moveDiffs.map((d) => d.toFixed(2))}`);
    assert(distinctRows[0] === 0 && distinctRows.length >= 4, 'Flüssigkeitsspiegel steigt nicht allmählich: ' + distinctRows);
    assert(shakeDiffs.filter((d) => d > 1).length >= 3, 'Schütteln nicht animiert: ' + shakeDiffs.map((d) => d.toFixed(2)));
    return { ruhe: +idleDiff.toFixed(3), pipettenbewegung: moveDiffs.map((d) => +d.toFixed(2)), fuellhoehePixel: distinctRows, schuetteln: shakeDiffs.map((d) => +d.toFixed(2)) };
  });
  await context.close();
}

async function scenarioBump(browser) {
  const { page, errors, context } = await newPage(browser);
  await test('OPT-Siedeverzug', 'Optional: Direktes Erhitzen in der Flamme → Siedeverzug + Sicherheitshinweis', async () => {
    await click(page, '[data-tube="4"]');
    await click(page, '[data-reagent="fehling1"]'); await click(page, '[data-reagent="fehling2"]');
    await page.click('details.more summary');
    await click(page, '[data-action="burner"]');
    await click(page, '[data-action="flame"]');
    await page.waitForFunction(() => window.RedoxLab.lab.state.op && window.RedoxLab.lab.state.op.type === 'bump', null, { timeout: 10000 });
    await sleep(500);
    const f1 = await shot(page, '11a-siedeverzug.png');
    await page.waitForSelector('.modal.safety', { timeout: 5000 });
    const f2 = await shot(page, '11b-sicherheitshinweis.png');
    const s = await tube(page, 4);
    assert(s.outcome === 'invalid', s.outcome);
    assert(errors.length === 0, errors.join('; '));
    return { zustand: s, screenshots: [f1, f2] };
  });
  await context.close();
}

async function scenarioResponsive(browser) {
  await test('V-08/T-05', 'Layout bei Tablet- und Desktopgrößen (kein horizontales Scrollen, Bedienelemente sichtbar)', async () => {
    const out = {};
    for (const [w, h] of [[1024, 768], [1180, 820], [1366, 1024], [1920, 1080], [1280, 800]]) {
      const { page, context, errors } = await newPage(browser, { viewport: { width: w, height: h }, hasTouch: w <= 1366 });
      const m = await page.evaluate(() => {
        const c = document.getElementById('lab').getBoundingClientRect();
        const p = document.getElementById('panel').getBoundingClientRect();
        const rec = document.querySelector('[data-tube="1"]').getBoundingClientRect();
        const R = window.RedoxLab.renderer;
        const a = R.toClient(0, 0), b = R.toClient(1400, 1000);
        return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, canvas: [Math.round(c.width), Math.round(c.height)], panel: Math.round(p.width), btnH: Math.round(rec.height), scene: [Math.round(b.x - a.x), Math.round(b.y - a.y)] };
      });
      assert(m.scrollW <= m.innerW, `${w}x${h}: horizontales Scrollen`);
      assert(m.canvas[0] >= w * 0.6, `${w}x${h}: Labortisch zu schmal`);
      assert(m.btnH >= 40, `${w}x${h}: Touch-Ziel zu klein`);
      assert(errors.length === 0, errors.join('; '));
      if (w === 1024) out.screenshot = await shot(page, '09b-tablet-1024x768.png');
      out[`${w}x${h}`] = m;
      await context.close();
    }
    return out;
  });
}

// Prüfung vom 22.10.2026: Formularentwurf (R3), Zwischenstand (R4), neutrale Lupe,
// Silber bleibt nach Fehling-I-Zugabe (R2), Beschriftung der Reagenzkacheln auf dem Tablet
async function scenarioReviewFixes(browser) {
  {
    const { page, errors, context } = await newPage(browser);
    await test('R3', 'Validierungsfehler: Eingaben bleiben erhalten, fehlende Teile markiert, Fokus auf erstem fehlenden Feld', async () => {
      await fehlingByMouse(page, 1, 'ethanal');
      await click(page, '[data-action="record"]');
      await page.check('#protoForm input[name="method"][value="fehling"]');
      await page.check('#protoForm input[name="obs"][value="tiefblau"]');
      await page.fill('#protoForm textarea[name="note"]', 'Noch nicht erwärmt.');
      await page.click('#protoForm button[type="submit"]');
      await sleep(200);
      const st = await page.evaluate(() => ({
        error: !!document.querySelector('.note.bad'),
        method: (document.querySelector('#protoForm input[name="method"]:checked') || {}).value || null,
        obs: Array.from(document.querySelectorAll('#protoForm input[name="obs"]:checked')).map((i) => i.value),
        note: document.querySelector('#protoForm textarea[name="note"]').value,
        missing: Array.from(document.querySelectorAll('#protoForm fieldset.missing')).map((f) => f.dataset.field),
        focus: document.activeElement && document.activeElement.closest('fieldset') ? document.activeElement.closest('fieldset').dataset.field : null
      }));
      assert(st.error && st.method === 'fehling' && st.obs.join() === 'tiefblau' && st.note === 'Noch nicht erwärmt.', JSON.stringify(st));
      assert(st.missing.join() === 'result,interp,cls' && st.focus === 'result', JSON.stringify(st));
      const f = await shot(page, 'review-r3-entwurf-bleibt.png');
      // Schließen und erneut öffnen: Entwurf bleibt
      await page.click('#drawerClose');
      await click(page, '[data-action="record"]');
      const again = await page.evaluate(() => document.querySelector('#protoForm textarea[name="note"]').value);
      assert(again === 'Noch nicht erwärmt.', 'Entwurf nach erneutem Öffnen: ' + again);
      return { nachFehler: st, screenshot: f };
    });
    await test('R4', 'Frühes Protokoll wird als Zwischenstand gekennzeichnet; weiterlaufender Versuch ist erneut auswertbar', async () => {
      await page.check('#protoForm input[name="result"][value="ungueltig"]');
      await page.check('#protoForm input[name="interp"][value="keineAussage"]');
      await page.check('#protoForm input[name="cls"][value="keineAussage"]');
      await page.click('#protoForm button[type="submit"]');
      await page.waitForSelector('text=Zwischenstand');
      await page.click('[data-newform="1"]');
      await click(page, '[data-action="bath"]');
      await waitComplete(page, 1);
      await sleep(500);
      const s = await tube(page, 1);
      const phase = await page.locator('#phaseBox').innerText();
      assert(s.outcome === 'positive' && s.phase === 'observable', JSON.stringify(s));
      assert(/Zwischenstand/.test(phase), 'Phasenhinweis: ' + phase);
      await page.click('#btnEval');
      await page.waitForSelector('text=erneut beobachten und auswerten');
      await sleep(600); // Einblendanimation des Auswertungsbereichs abwarten
      const f = await shot(page, 'review-r4-zwischenstand.png');
      await page.click('#drawerClose');
      return { zustand: s, phase: phase.replace(/\s+/g, ' '), screenshot: f };
    });
    await test('LUPE-neutral', 'Lupe zeigt das Reagenzglas im Wasserbad vor neutralem, weißem Hintergrund', async () => {
      const px = await page.evaluate(() => {
        const { renderer } = window.RedoxLab;
        const p = renderer.probe();
        const canvas = document.getElementById('lab');
        const rect = canvas.getBoundingClientRect(); const k = canvas.width / rect.width;
        const ctx = canvas.getContext('2d');
        return [[-150, -30], [150, -30], [-150, -150], [150, -150]].map(([dx, dy]) => {
          const cl = p.toClient(p.cx + dx, p.by + dy);
          const d = ctx.getImageData(Math.round((cl.x - rect.left) * k), Math.round((cl.y - rect.top) * k), 1, 1).data;
          return [d[0], d[1], d[2]];
        });
      });
      const tinted = px.filter(([r, g, b]) => Math.min(r, g, b) < 215 || Math.max(r, g, b) - Math.min(r, g, b) > 14);
      assert((await tube(page, 1)).place === 'bath', 'Glas nicht im Bad');
      assert(tinted.length === 0, 'Hintergrund getönt: ' + JSON.stringify(px));
      const f = await shot(page, 'review-lupe-neutral.png', await lupeClip(page));
      assert(errors.length === 0, errors.join('; '));
      return { pixel: px, screenshot: f };
    });
    await context.close();
  }
  {
    const { page, errors, context } = await newPage(browser);
    await test('R2', 'Silberspiegel bleibt nach Zugabe von Fehling I erhalten, keine ziegelrote Trübung', async () => {
      await click(page, '[data-hotplate="60"]');
      await click(page, '[data-tube="2"]');
      for (const r of ['agno3', 'naoh', 'nh3', 'nh3']) await click(page, `[data-reagent="${r}"]`);
      await click(page, '[data-sample="ethanal"]');
      await click(page, '[data-action="bath"]');
      await waitComplete(page, 2);
      await click(page, '[data-action="rack"]');
      await sleep(1500);
      const before = await probe(page, 'mirror');
      await click(page, '[data-reagent="fehling1"]');
      await sleep(3000);
      const after = await probe(page, 'mirror');
      const s = await tube(page, 2);
      const c = hsl((await probe(page, 'color')).rgb);
      assert(s.status === 'foreign' && s.mirror > 0.95, JSON.stringify(s));
      assert(after.dark > 0.3 && after.dark > before.dark * 0.7, `Belag verschwunden: ${before.dark.toFixed(2)} → ${after.dark.toFixed(2)}`);
      assert(!((c.h <= 25 || c.h >= 345) && c.s > 0.45), 'ziegelrote Färbung: ' + JSON.stringify(c));
      const f = await shot(page, 'review-r2-silber-bleibt.png');
      assert(errors.length === 0, errors.join('; '));
      return { vorher: before, nachher: after, farbe: c, screenshot: f };
    });
    await context.close();
  }
  for (const [w, h] of [[1024, 768], [1180, 820]]) {
    const { page, errors, context } = await newPage(browser, { viewport: { width: w, height: h }, hasTouch: true });
    await test('TAB-Beschriftung-' + w, `Reagenzkacheln ohne Wortabbrüche oder Überlauf (${w}×${h}); Geräteleiste sichtbar`, async () => {
      await click(page, '[data-tube="1"]');
      const m = await page.evaluate(() => {
        const out = [];
        for (const b of document.querySelectorAll('.reagents .sub-btn')) {
          const br = b.getBoundingClientRect();
          for (const el of b.querySelectorAll('span:not(.info-btn), small')) {
            const lh = parseFloat(getComputedStyle(el).lineHeight) || 14;
            const r = el.getBoundingClientRect();
            const lines = Math.round(r.height / lh);
            // Text muss innerhalb der Kachel bleiben (das ⓘ-Eckabzeichen ragt absichtlich heraus)
            out.push({ id: b.dataset.reagent, text: el.textContent, overflow: el.scrollWidth > el.clientWidth + 1 || r.left < br.left - 1 || r.right > br.right + 1, lines });
          }
        }
        const dev = document.querySelector('.devices-card').getBoundingClientRect();
        return { items: out, devicesVisible: dev.bottom <= innerHeight + 1 && dev.top < innerHeight };
      });
      // Fehler: Überlauf oder Umbruch mitten im Wort (mehrzeilig ohne Leerzeichen oder weiche Trennstelle)
      const bad = m.items.filter((x) => x.overflow || (x.lines > 1 && !/[­ ]/.test(x.text)));
      assert(bad.length === 0, 'Umbrüche/Überlauf: ' + JSON.stringify(bad));
      assert(m.devicesVisible, 'Wasserbad-Steuerung nicht sichtbar');
      const f = await shot(page, `review-panel-${w}x${h}.png`);
      assert(errors.length === 0, errors.join('; '));
      return { kacheln: m.items.length, screenshot: f };
    });
    await context.close();
  }
}

// Zucker als Feststoffe, Glas im Wasserbad antippen, Beschriftung und Sicherheitszeichen
async function scenarioSugars(browser) {
  const { page, errors, context } = await newPage(browser);
  await test('Z-01', 'Glucose per Spatel in Fehling-Lösung: Kristalle sichtbar, lösen sich, positiver Nachweis', async () => {
    await fehlingByMouse(page, 1, null);
    await canvasClick(page, { type: 'sample', id: 'glucose' });
    const s0 = await page.evaluate(() => { const c = window.RedoxLab.lab.tubeById(1).contents; return { solid: c.solid, dissolved: +c.dissolved.toFixed(2), sample: c.sampleId, vol: window.RedoxLab.chem.volume(c) }; });
    assert(s0.solid === 1 && s0.sample === 'glucose' && s0.vol === 2 && s0.dissolved < 0.2, JSON.stringify(s0));
    const crystals = await shot(page, 'zucker-01-glucose-kristalle.png', await lupeClip(page));
    await click(page, '[data-action="bath"]');
    await waitComplete(page, 1);
    const s = await tube(page, 1);
    const c = hsl((await probe(page, 'color')).rgb);
    assert(s.outcome === 'positive', JSON.stringify(s));
    assert(c.h <= 25 || c.h >= 350, 'nicht ziegelrot ' + JSON.stringify(c));
    const f = await shot(page, 'zucker-02-glucose-positiv.png');
    return { vorher: s0, zustand: s, farbe: c, screenshots: [crystals, f] };
  });
  await test('U-08', 'Reagenzglas im Wasserbad antippen bringt es in den Ständer zurück', async () => {
    assert((await tube(page, 1)).place === 'bath', 'Ausgangslage');
    await canvasClick(page, { type: 'tube', id: 1 });
    const s = await tube(page, 1);
    assert(s.place === 'rack', 'nicht zurück im Ständer: ' + s.place);
    return { ort: s.place };
  });
  await test('Z-02', 'Saccharose bleibt in der Fehling-Probe negativ (tiefblau)', async () => {
    await fehlingByMouse(page, 2, null);
    await click(page, '[data-sample="saccharose"]');
    await click(page, '[data-action="shake"]');
    await click(page, '[data-action="bath"]');
    await waitObservable(page, 2, 60000);
    const s = await tube(page, 2);
    const c = hsl((await probe(page, 'color')).rgb);
    assert(s.outcome === 'negative' && s.progress === 0, JSON.stringify(s));
    assert(c.h >= 210 && c.h <= 245, 'nicht blau ' + JSON.stringify(c));
    await click(page, '[data-action="record"]');
    await page.click('[data-proto="solution"]');
    await page.waitForSelector('text=anomeren C-Atome');
    const f = await shot(page, 'zucker-03-saccharose-negativ.png');
    assert(errors.length === 0, errors.join('; '));
    return { zustand: s, farbe: c, screenshot: f };
  });
  await context.close();
  {
    const { page, errors, context } = await newPage(browser, { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
    await test('V-09', 'Labortisch: zwei Probenreihen, größere Beschriftung, Augenschutz-Zeichen (Tablet)', async () => {
      const m = await page.evaluate(() => {
        const { renderer, lab } = window.RedoxLab;
        const hits = lab.state.samples.map((s) => { const a = renderer.anchor({ type: 'sample', id: s.sampleId }); const r = document.getElementById('lab').getBoundingClientRect(); const lp = renderer.toLogical(a.x, a.y); const h = renderer.hitTest(lp.x, lp.y); return { id: s.sampleId, hit: h && h.id, y: Math.round(lp.y) }; });
        return { hits, rows: [...new Set(hits.map((h) => h.y))].length };
      });
      assert(m.hits.every((h) => h.hit === h.id), 'Trefferflächen: ' + JSON.stringify(m.hits));
      assert(m.rows === 2, 'Reihen: ' + m.rows);
      const f = await shot(page, 'zucker-00-labortisch-tablet.png');
      assert(errors.length === 0, errors.join('; '));
      return { reihen: m.rows, proben: m.hits.length, screenshot: f };
    });
    await context.close();
  }
}

// GHS-Kennzeichnung: Symbole auf den Flaschen ein-/ausblendbar, Gefahrstoffkarte, Legende
async function scenarioGhs(browser) {
  const { page, errors, context } = await newPage(browser, { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
  // Rotanteil im Bereich über dem Etikett der Fehling-I-Flasche (dort sitzen die Rauten)
  const redAboveLabel = () => page.evaluate(() => {
    const { renderer } = window.RedoxLab;
    const L = renderer.layout;
    const canvas = document.getElementById('lab'); const rect = canvas.getBoundingClientRect(); const k = canvas.width / rect.width;
    const a = renderer.toClient(L.reagentX.fehling1 - 34, L.shelf.y - 4 - 18 - 66 - 36), b = renderer.toClient(L.reagentX.fehling1 + 34, L.shelf.y - 4 - 18 - 66 - 2);
    const d = canvas.getContext('2d').getImageData(Math.round((a.x - rect.left) * k), Math.round((a.y - rect.top) * k), Math.round((b.x - a.x) * k), Math.round((b.y - a.y) * k)).data;
    let red = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 190 && d[i + 1] < 70 && d[i + 2] < 70) red++;
    return red;
  });
  await test('GHS-1', 'GHS-Symbole auf den Reagenzflaschen, per Schalter aus- und wieder einblendbar', async () => {
    await sleep(500);
    const on = await redAboveLabel();
    const f1 = await shot(page, 'ghs-01-symbole-an.png');
    await page.click('[data-ghs]');
    await sleep(400);
    const off = await redAboveLabel();
    const f2 = await shot(page, 'ghs-02-symbole-aus.png');
    await page.click('[data-ghs]');
    await sleep(400);
    const again = await redAboveLabel();
    assert(on > 40 && off === 0 && again > 40, JSON.stringify({ on, off, again }));
    return { rotePixel: { an: on, aus: off, wieder: again }, screenshots: [f1, f2] };
  });
  await test('GHS-2', 'Gefahrstoffkarte (ⓘ) mit Piktogrammen, Signalwort und H-Sätzen im Wortlaut; Legende mit allen neun Symbolen', async () => {
    await page.locator('[data-hazard="naoh"]').tap();
    await page.waitForSelector('.modal .hazard');
    await sleep(400); // Einblendanimation abwarten
    const card = await page.evaluate(() => ({ imgs: [...document.querySelectorAll('.modal .hazard-picts img')].map((i) => i.naturalWidth > 0), text: document.querySelector('.modal').innerText }));
    assert(card.imgs.length === 1 && card.imgs[0], 'Piktogramm ' + JSON.stringify(card.imgs));
    assert(/GEFAHR/i.test(card.text) && /H314/.test(card.text) && /schwere Verätzungen/.test(card.text), card.text.slice(0, 300));
    const f1 = await shot(page, 'ghs-03-gefahrstoffkarte-natronlauge.png');
    await page.click('[data-m="legend"]');
    await page.waitForSelector('.legend-grid');
    const n = await page.evaluate(() => [...document.querySelectorAll('.legend-grid img')].filter((i) => i.naturalWidth > 0).length);
    assert(n === 9, 'Legende: ' + n);
    const f2 = await shot(page, 'ghs-04-legende.png');
    await page.click('[data-m="close"]');
    // Stoffinfo Ethanal: Reinstoff-Einstufung mit Hinweis zur realen Schule
    await page.locator('[data-info="ethanal"]').tap();
    await page.waitForSelector('text=Einstufung des Reinstoffs');
    const t = await page.locator('.modal').innerText();
    assert(/H350/.test(t) && /RiSU/.test(t) && /virtuellen Labor/.test(t), t.slice(0, 400));
    const f3 = await shot(page, 'ghs-05-stoffinfo-ethanal.png');
    await page.click('[data-m="close"]');
    assert(errors.length === 0, errors.join('; '));
    return { legende: n, screenshots: [f1, f2, f3] };
  });
  await context.close();
}

// ------------------------------------------------------------------ Ablauf
const server = await serve(ROOT, PORT);
const CHANNEL = process.env.PW_CHANNEL || '';
const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
console.log('Prüfe Build in', path.relative(process.cwd(), ROOT) || '.');
const t0 = Date.now();
await scenarioStart(browser);
await Promise.all([scenarioFehlingEthanal(browser), scenarioPropanalTouch(browser), scenarioPropanonOffline(browser)]);
await Promise.all([scenarioTollensEthanal(browser), scenarioTollensButanalDrag(browser)]);
await scenarioNegatives(browser);
await Promise.all([scenarioModesAndReset(browser), scenarioBump(browser), scenarioResponsive(browser), scenarioMotion(browser)]);
await scenarioReviewFixes(browser);
await scenarioSugars(browser);
await scenarioGhs(browser);
await browser.close();
server.close();

const summary = { date: new Date().toISOString(), browser: (CHANNEL ? CHANNEL + ' via ' : 'Chromium (') + 'Playwright ' + (await import('playwright/package.json', { with: { type: 'json' } })).default.version + (CHANNEL ? ', Version ' + browser.version() : ')'), durationSeconds: Math.round((Date.now() - t0) / 1000), passed: results.filter((r) => r.status === 'PASS').length, failed: results.filter((r) => r.status === 'FAIL').length, results };
fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(summary, null, 2));
console.log(`\n${summary.passed} bestanden, ${summary.failed} fehlgeschlagen (${summary.durationSeconds} s). Ergebnisse: tests/e2e/results.json`);
process.exit(summary.failed ? 1 : 0);
