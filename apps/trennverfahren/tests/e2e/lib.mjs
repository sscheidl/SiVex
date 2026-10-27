// Gemeinsame Hilfen der Browsertests (Playwright, Edge/Chromium).
// Bedient die gerenderte Oberfläche wie Lernende: Klicks/Tipps auf die Trefferflächen
// der Laborbühne, Zielschaltflächen und Bedienelemente. Der Modellzustand wird nur gelesen.
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
  await page.waitForFunction(() => window.TV && window.TV.app);
  await sleep(300);
  return { context, page, errors, requests };
}

// ----- Beobachten (nur lesen)
export const S = (page, fn, arg) => page.evaluate(([f, a]) => new Function('st', 'M', 'app', 'a', 'return (' + f + ')(st, M, app, a)')(window.TV.app.engine.state, window.TV.model, window.TV.app, a), [fn.toString(), arg]);
export async function waitFor(page, fn, arg, timeout = 180000) {
  await page.waitForFunction(([f, a]) => new Function('st', 'M', 'app', 'a', 'return (' + f + ')(st, M, app, a)')(window.TV.app.engine.state, window.TV.model, window.TV.app, a), [fn.toString(), arg], { timeout, polling: 50 });
}
/** Wartet, bis kein Handgriff mehr läuft (Gießen im Fluss zählt als laufend). */
export const idle = (page, timeout) => waitFor(page, (st) => !st.op, null, timeout || 60000);

// ----- Bedienen (echte Klicks bzw. Tipps)
export async function tapHit(page, id, touch) {
  const loc = page.locator(`#hits [data-hit="${id}"]`);
  await loc.waitFor({ state: 'visible', timeout: 10000 });
  if (touch) await loc.tap(); else await loc.click();
  await sleep(80);
}
/** Gerät wählen und Ziel antippen (beides auf der Bühne). */
export async function use(page, a, b, touch) { await idle(page); await tapHit(page, a, touch); await tapHit(page, b, touch); }
/** Zielschaltfläche in der Bedienleiste nach Auswahl. */
export async function target(page, id, touch) { const l = page.locator(`#deckSel [data-target="${id}"]`); if (touch) await l.tap(); else await l.click(); await sleep(80); }
export async function seg(page, sel, v, touch) { const l = page.locator(`${sel} [data-v="${v}"]`); if (touch) await l.tap(); else await l.click(); await sleep(60); }
export async function speed(page, v) { await page.locator(`#speed [data-speed="${v}"]`).click(); await sleep(40); }
export async function stopPour(page, touch) { const l = page.locator('#btnStopPour'); if (touch) await l.tap(); else await l.click(); await sleep(60); }
export async function exp(page, n) { await page.locator('#tab-exp').click(); await page.locator(`.taskchips [data-n="${n}"]`).click(); await sleep(200); }
/** Gießen über die Bühne; stoppt, wenn until() wahr wird oder der Fluss von selbst endet. */
export async function pour(page, src, dst, until, opts = {}) {
  await idle(page);
  await seg(page, '#pourSpeed', opts.speed || 'slow', opts.touch);
  await tapHit(page, src, opts.touch);
  await tapHit(page, dst, opts.touch);
  await waitFor(page, (st) => st.op && st.op.type === 'pour' && st.op.phase === 'flow', null, 10000);
  if (until) {
    await page.waitForFunction(([f]) => { const st = window.TV.app.engine.state; return !st.op || st.op.phase !== 'flow' || new Function('st', 'return (' + f + ')(st)')(st); }, [until.toString()], { timeout: 120000, polling: 20 });
    if (await S(page, (st) => st.op && st.op.phase === 'flow')) await stopPour(page, opts.touch);
  }
  await idle(page, 120000);
}

export async function shot(page, name, opts = {}) {
  const dir = opts.dir || SHOTS;
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot(Object.assign({ path: path.join(dir, name + '.png') }, opts.clip ? { clip: opts.clip } : {}));
}
export async function grab(page, clip) { return page.screenshot({ clip }); }
/** Bildschirmrechteck um ein Weltrechteck (CSS-Pixel der Seite). */
export async function worldClip(page, box, pad = 10) {
  return page.evaluate(([b, p]) => {
    const r = window.TV.app.renderer; const v = r.view;
    const c = document.querySelector('#lab').getBoundingClientRect();
    const x0 = c.left + v.ox + b.x0 * v.scale, y0 = c.top + v.oy + b.y0 * v.scale;
    return { x: Math.max(0, x0 - p), y: Math.max(0, y0 - p), width: (b.x1 - b.x0) * v.scale + 2 * p, height: (b.y1 - b.y0) * v.scale + 2 * p };
  }, [box, pad]);
}
