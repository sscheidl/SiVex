// Gemeinsame Hilfen der Browsertests (Playwright, Edge/Chromium).
// Bedient die gerenderte Oberfläche wie Lernende: Klicks/Tipps auf Schaltflächen,
// Schalter und die Trefferflächen der Laborbühne. Der Modellzustand wird nur gelesen.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP = path.resolve(HERE, '../..');
export const SHOTS = path.join(APP, 'docs/screenshots');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function assert(cond, msg) { if (!cond) throw new Error(msg); }

export async function launch() {
  const ch = process.env.PW_CHANNEL;
  const tries = ch ? [{ channel: ch }] : [{ channel: 'msedge' }, {}, { channel: 'chrome' }];
  let last;
  for (const o of tries) { try { const b = await chromium.launch(o); b.__channel = o.channel || 'chromium'; return b; } catch (e) { last = e; } }
  throw last;
}

export async function newPage(browser, url, opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, opts));
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url);
  await page.waitForFunction(() => window.DS && window.DS.app);
  await sleep(250);
  return { context, page, errors, requests };
}

// ----- Beobachten (nur lesen)
export const S = (page, fn, arg) => page.evaluate(([f, a]) => new Function('st', 'M', 'T', 'a', 'return (' + f + ')(st, M, T, a)')(window.DS.app.engine.state, window.DS.model, window.DS.tasks, a), [fn.toString(), arg]);
export const idle = (page) => page.waitForFunction(() => { const o = window.DS.app.engine.state.op; return !o || o.type === 'burn'; }, null, { timeout: 30000 });
export async function waitFor(page, fn, arg, timeout = 240000) {
  await page.waitForFunction(([f, a]) => new Function('st', 'M', 'a', 'return (' + f + ')(st, M, a)')(window.DS.app.engine.state, window.DS.model, a), [fn.toString(), arg], { timeout, polling: 50 });
}
/** Abgelesene Dampftemperatur (Digitalanzeige, Textspiegel für Bildschirmleser). */
export const readTemp = async (page) => { await sleep(560); return Number(await page.locator('#readout').getAttribute('data-temp')); };

// ----- Bedienen (echte Klicks bzw. Tipps)
export async function tapHit(page, id, touch) {
  await idle(page);
  const loc = page.locator(`[data-hit="${id}"]`);
  await loc.waitFor({ state: 'visible', timeout: 10000 });
  if (touch) await loc.tap(); else await loc.click();
  await sleep(60);
}
export async function clickAct(page, act, touch) {
  await idle(page);
  const loc = page.locator(`#actions [data-act="${act}"]`);
  if (touch) await loc.tap(); else await loc.click();
  await sleep(60);
}
export async function view(page, v, touch) { const l = page.locator(`#views [data-view="${v}"]`); if (touch) await l.tap(); else await l.click(); await sleep(60); }
export async function speed(page, v) { await page.locator(`#speed [data-speed="${v}"]`).click(); }
export async function heater(page, on, touch) {
  const b = page.locator('#btnHeat');
  if ((await b.getAttribute('aria-pressed')) !== String(on)) { if (touch) await b.tap(); else await b.click(); }
  await sleep(60);
}
export async function water(page, on, touch) {
  const b = page.locator('#btnWater');
  if ((await b.getAttribute('aria-pressed')) !== String(on)) { if (touch) await b.tap(); else await b.click(); }
  await sleep(60);
}
export async function heatLevel(page, l, touch) { const b = page.locator(`#heatLevel [data-level="${l}"]`); if (touch) await b.tap(); else await b.click(); }
export async function flow(page, l, touch) { const b = page.locator(`#flowLevel [data-level="${l}"]`); if (touch) await b.tap(); else await b.click(); }

/** Aufbau über die Oberfläche: Einfüllen, Siedesteine, Thermometer, Schläuche, Kühlwasser, Heizung. */
export async function prepare(page, o = {}) {
  const opt = Object.assign({ stones: true, thermo: 'correct', hoses: 'ok', water: true, heat: 'mid', flow: 'mid', heater: true, touch: false }, o);
  const t = opt.touch;
  await tapHit(page, 'bottle', t);
  await idle(page);
  if (opt.stones) { await clickAct(page, 'addStones', t); await idle(page); }
  if (opt.thermo === 'correct') await clickAct(page, 'thermoDown', t);
  if (opt.thermo === 'low') { await clickAct(page, 'thermoDown', t); await clickAct(page, 'thermoDown', t); }
  if (opt.hoses === 'ok') { await tapHit(page, 'hose:inlet', t); await tapHit(page, 'nozzle:low', t); await tapHit(page, 'hose:outlet', t); await tapHit(page, 'nozzle:high', t); }
  if (opt.hoses === 'swap') { await tapHit(page, 'hose:inlet', t); await tapHit(page, 'nozzle:high', t); await tapHit(page, 'hose:outlet', t); await tapHit(page, 'nozzle:low', t); }
  await flow(page, opt.flow, t);
  if (opt.water && opt.hoses !== 'none') await water(page, true, t);
  await heatLevel(page, opt.heat, t);
  if (opt.heater) await heater(page, true, t);
}

export async function shot(page, name, opts = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot(Object.assign({ path: path.join(opts.dir || SHOTS, name + '.png') }, opts.clip ? { clip: opts.clip } : {}));
}
/** Bildausschnitt als Puffer (für Vergleiche aufeinanderfolgender Bilder). */
export async function grab(page, clip) { return page.screenshot({ clip }); }
export const differs = (a, b) => !a.equals(b);
/** Bildschirmrechteck eines Weltrechtecks der Bühne (CSS-Pixel relativ zur Seite). */
export async function worldClip(page, part) {
  return page.evaluate((p) => {
    const r = window.DS.app.renderer; const b = r.partBox(p, window.DS.app.engine.state); const v = r.view;
    const c = document.querySelector('#lab').getBoundingClientRect();
    const x0 = c.left + b.x0 * v.scale + v.ox, y0 = c.top + b.y0 * v.scale + v.oy;
    return { x: Math.max(0, x0 - 6), y: Math.max(0, y0 - 6), width: (b.x1 - b.x0) * v.scale + 12, height: (b.y1 - b.y0) * v.scale + 12 };
  }, part);
}
