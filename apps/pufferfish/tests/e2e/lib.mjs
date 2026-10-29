// Gemeinsame Hilfen der Browsertests (Playwright, Edge/Chromium).
// Bedient die gerenderte Oberfläche wie Lernende (Klicks, Tipps, Tastatur).
// Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen – nie gesetzt.
// Mit clock: true läuft die Zeit der Seite über die Playwright-Uhr (page.clock): Zugaben und
// Mischzeiten werden schneller als in Echtzeit abgespielt, die Seite verhält sich sonst unverändert
// (requestAnimationFrame, Timer und performance.now sind dieselben Abläufe wie im Betrieb).
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
  const { clock, ...ctxOpts } = opts;
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true }, ctxOpts));
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => requests.push(r.url()));
  page.__clock = !!clock;
  if (clock) await page.clock.install();
  await page.goto(url);
  await page.waitForFunction(() => window.PF && window.PF.app);
  await adv(page, 250);
  return { context, page, errors, requests };
}

/** Zeit vorwärts: mit Playwright-Uhr virtuell, sonst echt. */
export async function adv(page, ms) { if (page.__clock) await page.clock.runFor(ms); else await sleep(ms); }

// ----- Beobachten (nur lesen)
export const S = (page, fn, arg) => page.evaluate(([f, a]) => new Function('A', 'C', 'a', 'return (' + f + ')(A, C, a)')(window.PF.app, window.PF.chem, a), [fn.toString(), arg]);
export const beakers = (page) => S(page, (A) => A.eng.current().beakers.map((b) => ({ key: b.key, added: b.added, V: b.comp.V, records: b.records, pending: b.pending.length, vols: b.vols, meas: b.meas ? { done: b.meas.done, pH: b.meas.pH } : null })));
const idleFn = () => { const A = window.PF.app; return !A.eng.busy() && A.eng.current().beakers.every((b) => !b.pending.length); };
export async function idle(page, timeout = 120000) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(idleFn)) return;
    if (Date.now() - t0 > timeout) throw new Error('Zeitüberschreitung: Zugabe/Messung nicht beendet');
    await adv(page, page.__clock ? 250 : 50);
  }
}
export async function waitFor(page, fn, arg, timeout = 60000) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(([f, a]) => new Function('A', 'a', 'return (' + f + ')(A, a)')(window.PF.app, a), [fn.toString(), arg])) return;
    if (Date.now() - t0 > timeout) throw new Error('Zeitüberschreitung: ' + fn.toString().slice(0, 90));
    await adv(page, page.__clock ? 40 : 25);
  }
}

// ----- Bedienen (echte Klicks bzw. Tipps)
export async function click(page, sel, touch, force) { const l = page.locator(sel).first(); if (touch) await l.tap({ force }); else await l.click({ force }); await adv(page, 60); }
// aria-disabled verhindert keinen echten Klick; die App weist ihn selbst ab – daher force
export async function go(page, touch) { await click(page, '#btnGo', touch, true); }
export async function reagent(page, key, touch) { await click(page, `#doseBar [data-reagent="${key}"]`, touch); }
export async function kind(page, k, touch) { await click(page, `#doseBar [data-kind="${k}"]`, touch); }
export async function tool(page, t, touch) { await click(page, `#doseBar [data-tool="${t}"]`, touch); }
export async function target(page, t) { await click(page, `#doseBar [data-target="${t}"]`); }
/** Lösung, Menge und Zugabe wie Lernende: erst wählen, dann „Zugeben“. */
export async function dose(page, key, k, touch) { if (key) await reagent(page, key, touch); if (k) await kind(page, k, touch); await go(page, touch); }
export async function exp(page, id) { await click(page, `#expChips [data-exp="${id}"]`); }
export async function view(page, v) { await click(page, `#viewToggle [data-view="${v}"]`); }
export async function speed(page, v) { await click(page, `#speed [data-speed="${v}"]`); }
export async function tab(page, t) { await click(page, `.lk-tabs [data-tab="${t}"]`); }
export async function toastText(page) { return (await page.locator('#toast').innerText()).trim(); }
export const setVal = async (page, sel, v) => { const l = page.locator(sel); if ((await l.evaluate((e) => e.tagName)) === 'SELECT') await l.selectOption(v); else await l.fill(v); };

export async function shot(page, name, clip) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), clip });
}
