// Gemeinsame Hilfen der Browsertests (Playwright, Edge/Chromium).
// Bedient die gerenderte Oberfläche wie Lernende (Klicks, Tipps, Tastatur).
// Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen – nie gesetzt.
// Aufbau nach apps/destillation/tests/e2e/lib.mjs.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP = path.resolve(HERE, '../..');
export const SHOTS = path.join(APP, 'docs/screenshots');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function assert(cond, msg) { if (!cond) throw new Error(msg); }
export const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: erwartet ${b}, erhalten ${a}`);

export async function launch() {
  const ch = process.env.PW_CHANNEL;
  const tries = ch ? [{ channel: ch }] : [{ channel: 'msedge' }, {}, { channel: 'chrome' }];
  let last;
  for (const o of tries) { try { const b = await chromium.launch(o); b.__channel = o.channel || 'chromium'; return b; } catch (e) { last = e; } }
  throw last;
}

export async function newPage(browser, url, opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true }, opts));
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url);
  await page.waitForFunction(() => window.PF && window.PF.app);
  await sleep(200);
  return { context, page, errors, requests };
}

// ----- Beobachten (nur lesen)
export const S = (page, fn, arg) => page.evaluate(([f, a]) => new Function('A', 'C', 'a', 'return (' + f + ')(A, C, a)')(window.PF.app, window.PF.chem, a), [fn.toString(), arg]);
export const beakers = (page) => S(page, (A) => A.eng.current().beakers.map((b) => ({ key: b.key, added: b.added, V: b.comp.V, records: b.records, pending: b.pending.length, event: b.event ? { path: b.event.an.path, pair: b.event.an.pair, t0: b.event.t0, dur: b.event.dur, reagent: b.event.reagent } : null })));
export async function idle(page, timeout = 60000) {
  await page.waitForFunction(() => { const A = window.PF.app; return !A.eng.busy() && A.eng.current().beakers.every((b) => !b.pending.length); }, null, { timeout, polling: 50 });
}
export async function waitFor(page, fn, arg, timeout = 30000) {
  await page.waitForFunction(([f, a]) => new Function('A', 'a', 'return (' + f + ')(A, a)')(window.PF.app, a), [fn.toString(), arg], { timeout, polling: 25 });
}

// ----- Bedienen (echte Klicks bzw. Tipps)
export async function click(page, sel, touch, force) { const l = page.locator(sel).first(); if (touch) await l.tap({ force }); else await l.click({ force }); await sleep(60); }
// aria-disabled verhindert keinen echten Klick; die App weist ihn selbst ab – daher force
export async function dose(page, kind, touch) { await click(page, `#doses [data-dose="${kind}"]`, touch, true); }
export async function target(page, t) { await click(page, `#targets [data-target="${t}"]`); }
export async function exp(page, id) { await click(page, `#expChips [data-exp="${id}"]`); }
export async function slot(page, s) { await click(page, `#slots [data-slot="${s}"]`); }
export async function speed(page, v) { await click(page, `#speed [data-speed="${v}"]`); }
export async function tab(page, t) { await click(page, `.lk-tabs [data-tab="${t}"]`); }
export async function toastText(page) { return (await page.locator('#toast').innerText()).trim(); }
export async function skipPredict(page) { if (await page.locator('#btnSkipPredict').count()) await click(page, '#btnSkipPredict'); }
export async function predict(page, v) { await page.locator(`#predictForm [value="${v}"]`).check(); await click(page, '#predictForm button[type=submit]'); }

export async function shot(page, name, clip) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), clip });
}
