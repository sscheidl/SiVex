// Gemeinsame Hilfen der Browsertests (Playwright, Edge/Chromium).
// Bedient die gerenderte Oberfläche wie Lernende (Klicks, Tipps, Tastatur,
// Ziehen). Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen.
// Aufbau nach apps/pufferfish/tests/e2e/lib.mjs.
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
  await page.waitForFunction(() => window.AZ && window.AZ.app && window.AZ.app.frames > 3);
  return { context, page, errors, requests };
}

// ----- Beobachten (nur lesen)
export const S = (page, fn, arg) => page.evaluate(([f, a]) => new Function('A', 'a', 'return (' + f + ')(A, a)')(window.AZ.app, a), [fn.toString(), arg]);
export const state = (page) => S(page, (A) => { const st = A.model.state; return { sub: st.sub, Tset: st.Tset, Tview: st.Tview, p: st.p, c: st.c, cold: st.cold, coldVis: st.coldVis, seq: st.seq, shares: A.model.shares(), proc: A.model.process(), counts: A.sys.counts(), n: A.sys.ps.length, level: A.ui.level }; });
export async function settled(page, timeout = 15000) {
  await page.waitForFunction(() => { const A = window.AZ.app, st = A.model.state; const M = window.AZ.model; return st.Tview === st.Tset && Math.abs(st.p - M.phaseTarget(A.model.substance, st.Tview)) < 1e-9; }, null, { timeout, polling: 50 });
}
/** Prüfsumme eines Canvas (zeigt, ob sich das Bild ändert). */
export const canvasSig = (page, sel) => page.evaluate((s) => { const c = document.querySelector(s); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return h; }, sel);

// ----- Bedienen
export async function click(page, sel, touch) { const l = page.locator(sel).first(); if (touch) await l.tap(); else await l.click(); await sleep(60); }
export const substance = (page, id, touch) => click(page, `#subs [data-sub="${id}"]`, touch);
export const level = (page, lv, touch) => click(page, `#levels [data-level="${lv}"]`, touch);
export const tab = (page, t) => click(page, `.lk-tabs [data-tab="${t}"]`);
/** Temperatur wie mit der Tastatur einstellen: Fokus auf den Regler, Home, dann Pfeiltasten/Bild-Tasten. */
export async function setTempKeys(page, T) {
  const sl = page.locator('#temp');
  await sl.focus();
  const st = await state(page);
  const big = await S(page, (A) => A.model.substance.bigStep);
  let cur = st.Tset;
  while (Math.abs(T - cur) >= big) { await page.keyboard.press(T > cur ? 'PageUp' : 'PageDown'); cur += T > cur ? big : -big; }
  while (cur !== T) { await page.keyboard.press(T > cur ? 'ArrowRight' : 'ArrowLeft'); cur += T > cur ? 1 : -1; }
  await sleep(30);
}
/** Temperatur per Maus auf der Reglerschiene anklicken (Position aus der Reglerskala berechnet). */
export async function setTempMouse(page, T) {
  const box = await page.locator('#temp').boundingBox();
  const p = await S(page, (A, t) => window.AZ.substances.tempToPos(A.model.substance, t), T);
  const thumb = 44;
  const x = box.x + thumb / 2 + p * (box.width - thumb);
  await page.mouse.click(x, box.y + box.height / 2);
  await sleep(40);
}

export async function shot(page, name, clip) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), clip });
}
/** Sichtbare Texte und Bedienelemente, die das Bild überdecken (sollte leer sein). */
export const overlaps = (page) => page.evaluate(() => {
  const wrap = document.querySelector('#canvasWrap').getBoundingClientRect();
  const out = [];
  const els = document.querySelectorAll('.lk-app *');
  for (const el of els) {
    if (el.closest('#canvasWrap')) continue;
    if (el.closest('#panel') || el.matches('.sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const ctl = /^(BUTTON|INPUT|SELECT|OUTPUT|LABEL|CANVAS)$/.test(el.tagName) || el.classList.contains('tick');
    if (!hasText && !ctl) continue;
    const ix = Math.min(r.right, wrap.right) - Math.max(r.left, wrap.left), iy = Math.min(r.bottom, wrap.bottom) - Math.max(r.top, wrap.top);
    if (ix > 0.5 && iy > 0.5) out.push(`${el.tagName}.${el.className || ''} „${(el.textContent || '').trim().slice(0, 30)}“`);
  }
  // Bedienfeld: liegt es neben/unter dem Bild?
  const panel = document.querySelector('#panel');
  if (panel && getComputedStyle(panel).display !== 'none') {
    const p = panel.getBoundingClientRect();
    const ix = Math.min(p.right, wrap.right) - Math.max(p.left, wrap.left), iy = Math.min(p.bottom, wrap.bottom) - Math.max(p.top, wrap.top);
    if (ix > 0.5 && iy > 0.5) out.push('Bedienfeld überdeckt das Bild');
  }
  return out;
});
