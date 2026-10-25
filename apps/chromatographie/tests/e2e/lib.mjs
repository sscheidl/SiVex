// Gemeinsame Hilfen der Browsertests (Playwright, Chromium/Edge).
// Bedient die gerenderte Oberfläche wie Lernende: Klicks/Tipps auf Schaltflächen
// und die Trefferflächen der Laborbühne. Der Modellzustand wird nur gelesen.
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
  await page.waitForFunction(() => window.PC && window.PC.app);
  await page.evaluate(() => {
    window.__overlap = (t) => {
      const r = window.PC.app.renderer, L = r.layout, w = document.querySelector('#canvasWrap').getBoundingClientRect();
      const box = (x0, y0, x1, y1) => { const a = r.toScreen(x0, y0), b = r.toScreen(x1, y1); return { left: w.left + a.x, top: w.top + a.y, right: w.left + b.x, bottom: w.top + b.y }; };
      const c = L.chamber;
      const objs = [box(c.x - 0.3, c.top - 0.6, c.x + c.w + 0.3, c.bottom), box(L.tile.x, L.tile.y, L.tile.x + L.tile.w, L.tile.y + L.tile.h),
        ...L.bottles.map((b) => box(b.x - 1.5, b.bottom - 5.1, b.x + 1.5, b.bottom)), box(L.rack.x, L.rack.y - 5.2, L.rack.x + L.rack.slot * 7, L.bench),
        box(L.pencil.x - 0.3, L.pencil.y0, L.pencil.x + 0.3, L.pencil.y1)];
      const ui = [...document.querySelectorAll('#actions button, .hit')].map((e) => e.getBoundingClientRect());
      return objs.concat(ui).some((b) => b.left < t.right && b.right > t.left && b.top < t.bottom && b.bottom > t.top);
    };
  });
  await sleep(200);
  return { context, page, errors, requests };
}

// ----- Beobachten (nur lesen)
export const S = (page, fn, arg) => page.evaluate(([f, a]) => new Function('st', 'M', 'T', 'a', 'return (' + f + ')(st, M, T, a)')(window.PC.app.engine.state, window.PC.model, window.PC.tasks, a), [fn.toString(), arg]);
export const idle = (page) => page.waitForFunction(() => !window.PC.app.engine.state.op, null, { timeout: 30000 });
export async function waitFor(page, fn, arg, timeout = 180000) {
  await page.waitForFunction(([f, a]) => new Function('st', 'M', 'a', 'return (' + f + ')(st, M, a)')(window.PC.app.engine.state, window.PC.model, a), [fn.toString(), arg], { timeout, polling: 50 });
}

// ----- Bedienen (echte Klicks bzw. Tipps)
export async function tapHit(page, id, touch) {
  await idle(page);
  const loc = page.locator(`[data-hit="${id}"]`);
  await loc.waitFor({ state: 'visible', timeout: 10000 });
  if (touch) await loc.tap(); else await loc.click();
}
export async function clickAct(page, act, touch) {
  await idle(page);
  const loc = page.locator(`#actions [data-act="${act}"]`);
  if (touch) await loc.tap(); else await loc.click();
}
export async function speed(page, v) { await page.locator(`#speed [data-speed="${v}"]`).click(); }

/** Papier vorbereiten und entwickeln – nur über die Oberfläche. */
export async function prepare(page, { samples, solvent = 'water', portions = 1, dabs = 1, line = true, touch = false, newPaper = true }) {
  if (newPaper) {
    const unused = await S(page, (st) => st.paper.state === 'bench' && !st.paper.line && !st.paper.lanes.some(Boolean));
    if (!unused) { await clickAct(page, 'newSheet', touch); await idle(page); }
  }
  if (line) await tapHit(page, 'pencil', touch);
  for (let i = 0; i < samples.length; i++) {
    if (!samples[i]) continue;
    await tapHit(page, 'pen:' + samples[i], touch);
    const n = Array.isArray(dabs) ? dabs[i] : dabs;
    for (let k = 0; k < n; k++) await tapHit(page, 'lane:' + i, touch);
    await tapHit(page, 'pen:' + samples[i], touch); // zurückstellen
  }
  const ch = await S(page, (st) => st.chamber);
  if (ch.solvent && (ch.solvent !== solvent || ch.portions > portions)) { await clickAct(page, 'emptyChamber', touch); await idle(page); }
  for (let k = (await S(page, (st) => st.chamber.portions)); k < portions; k++) await tapHit(page, 'bottle:' + solvent, touch);
  await idle(page);
}
export async function develop(page, run, touch) {
  await tapHit(page, 'chamber', touch);
  await idle(page);
  await waitFor(page, (st, M, r) => st.paper.front >= M.PAPER.lineY + r || st.paper.frontAtTop, run);
}
export async function takeOut(page, touch) { await tapHit(page, 'chamber', touch); await idle(page); }

export async function shot(page, name, opts = {}) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot(Object.assign({ path: path.join(opts.dir || SHOTS, name + '.png') }, opts.clip ? { clip: opts.clip } : {}));
}
