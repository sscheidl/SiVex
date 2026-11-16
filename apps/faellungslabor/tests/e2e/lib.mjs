// Gemeinsame Hilfen der Browsertests (Playwright, Chromium/Chrome/Edge).
// Bedient die gerenderte Oberfläche wie Lernende (Klicks, Tipps, Tastatur, gedrückt halten).
// Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen – nie gesetzt.
// Mit clock: true läuft die Zeit der Seite über die Playwright-Uhr (Abläufe schneller als Echtzeit,
// requestAnimationFrame und Timer bleiben dieselben Abläufe wie im Betrieb).
// Aufbau nach apps/pufferfish/tests/e2e/lib.mjs.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP = path.resolve(HERE, '../..');
export const SHOTS = path.join(APP, 'docs/screenshots');
export const EVID = path.join(APP, 'docs/evidence');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Browser starten: PW_EXECUTABLE, sonst Edge, Chrome, Playwright-Chromium, Systemchrome. */
export async function launch() {
  const tries = [];
  if (process.env.PW_EXECUTABLE) tries.push({ executablePath: process.env.PW_EXECUTABLE });
  if (process.env.PW_CHANNEL) tries.push({ channel: process.env.PW_CHANNEL });
  tries.push({ channel: 'msedge' }, { channel: 'chrome' }, {}, { executablePath: '/usr/bin/google-chrome' });
  let last;
  for (const o of tries) {
    try { const b = await chromium.launch(Object.assign({ args: ['--no-sandbox'] }, o)); b.__channel = o.channel || o.executablePath || 'chromium'; return b; } catch (e) { last = e; }
  }
  throw last;
}

export async function newPage(browser, url, opts = {}) {
  const { clock, block, ...ctxOpts } = opts;
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, ctxOpts));
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => requests.push(r.url()));
  if (block) await context.route((u) => !/^(file:|data:|blob:|about:)/.test(String(u)) && !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(String(u)), (r) => r.abort());
  page.__clock = !!clock;
  if (clock) await page.clock.install();
  await page.goto(url);
  await page.waitForFunction(() => window.FL && window.FL.app);
  await adv(page, 300);
  return { context, page, errors, requests };
}

/** Zeit vorwärts: mit Playwright-Uhr virtuell, sonst echt. */
export async function adv(page, ms) { if (page.__clock) await page.clock.runFor(ms); else await sleep(ms); }

// ----- Beobachten (nur lesen)
export const S = (page, fn, arg) => page.evaluate(([f, a]) => new Function('A', 'FL', 'a', 'return (' + f + ')(A, FL, a)')(window.FL.app, window.FL, a), [fn.toString(), arg]);
export const tube = (page, slot, tab) => S(page, (A, FL, a) => { const t = A.lab.tube(a.slot, a.tab); return { V: t.V, ansatz: t.ansatz, sample: t.sample, n: t.n, log: t.log, clouds: t.clouds.length, cloudM: t.clouds.reduce((s, c) => s + c.m, 0), susp: t.susp, sed: t.sed, front: t.front, shake: t.shake, solid: FL.model.solidTotal(t), rev: t.rev }; }, { slot, tab });
export async function idle(page, timeout = 60000) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(() => !window.FL.app.lab.busy())) return;
    if (Date.now() - t0 > timeout) throw new Error('Zeitüberschreitung: Handgriff nicht beendet');
    await adv(page, page.__clock ? 120 : 40);
  }
}

// ----- Bedienen (echte Klicks bzw. Tipps)
async function act(page, sel, touch) { const l = page.locator(sel).first(); if (touch) await l.tap(); else await l.click(); await adv(page, 50); }
export const bottle = (page, key, touch) => act(page, `.hit.bottle[data-bottle="${key}"]`, touch);
export const tubeHit = (page, slot, touch) => act(page, `.hit.tube[data-slot="${slot}"]`, touch);
export const btn = (page, sel, touch) => act(page, sel, touch);
/** Probe einfüllen: Flasche, dann Glas antippen, warten bis die Pipette zurück ist. */
export async function fill(page, key, slot, touch) { await bottle(page, key, touch); await adv(page, 400); await tubeHit(page, slot, touch); await idle(page); }
/** Reagenzpipette über ein Glas bringen. */
export async function over(page, key, slot, touch) {
  const held = await page.evaluate((k) => { const p = window.FL.app.lab.state.pip; return p.key === k && p.tab === window.FL.app.lab.state.tab; }, key);
  if (!held) { await bottle(page, key, touch); await adv(page, 400); }
  await tubeHit(page, slot, touch); await idle(page);
}
export async function dropTap(page, touch) { await act(page, '#btnDrop', touch); await idle(page); await adv(page, 200); }
export async function hold(page, ms) {
  const b = await page.locator('#btnDrop').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await adv(page, ms);
  await page.mouse.up();
}
export async function part(page, id) { await act(page, `#parts [data-part="${id}"]`); }
export async function ptab(page, id) { await act(page, `#ptabs [data-ptab="${id}"]`); }
export async function speed(page, v) { await act(page, `#speed [data-speed="${v}"]`); }
export async function toastText(page) { return (await page.locator('#toast').innerText()).trim(); }

export async function shot(page, name, clip) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), clip });
  return 'docs/screenshots/' + name + '.png';
}
/** Ausschnitt um ein Reagenzglas (Bildschirmkoordinaten aus dem Renderer). */
export async function tubeClip(page, slot, pad = 60) {
  const r = await S(page, (A, FL, a) => {
    const G = FL.geometry, x = A.lab.tubePos(a.slot);
    const p0 = A.renderer.toScreen(x - G.TUBE_R - a.pad, G.RIM_Y - 120), p1 = A.renderer.toScreen(x + G.TUBE_R + a.pad, G.BENCH + 60);
    const c = document.getElementById('lab').getBoundingClientRect();
    return { x: c.left + p0.x, y: c.top + p0.y, width: p1.x - p0.x, height: p1.y - p0.y };
  }, { slot, pad });
  return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height };
}

// ----- Bildauswertung: kleiner PNG-Decoder (8 bit, RGB/RGBA, ohne Zeilensprung) für Pixelmessungen
import zlib from 'node:zlib';
export function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG-Format nicht unterstützt'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error('PNG-Farbtyp ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), cur;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = cur[x * bpp]; out[(y * w + x) * 4 + 1] = cur[x * bpp + 1]; out[(y * w + x) * 4 + 2] = cur[x * bpp + 2]; out[(y * w + x) * 4 + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
    prev = cur;
  }
  return { w, h, px: out };
}
/** Mittlere Farbe (RGB) in einem Rechteck eines dekodierten Bildes. */
export function meanRGB(img, x0, y0, x1, y1) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(img.h, Math.round(y1)); y++) for (let x = Math.max(0, Math.round(x0)); x < Math.min(img.w, Math.round(x1)); x++) { const i = (y * img.w + x) * 4; r += img.px[i]; g += img.px[i + 1]; b += img.px[i + 2]; n++; }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}
export const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
/** Gelbanteil: (R+G)/2 − B, normiert. */
export const yellowness = (c) => ((c[0] + c[1]) / 2 - c[2]) / 255;
/** Bildschirmrechteck (Seitenkoordinaten) eines Weltbereichs im Reagenzglas. */
export async function tubeRegion(page, slot, yTop, yBot, inset = 0.5) {
  return S(page, (A, FL, a) => {
    const G = FL.geometry, x = A.lab.tubePos(a.slot), c = document.getElementById('lab').getBoundingClientRect();
    const t = A.lab.tube(a.slot);
    const y0 = a.yTop === 'surface' ? G.surfaceY(t.V) + 4 : a.yTop, y1 = a.yBot === 'bottom' ? G.INNER_BOTTOM - 3 : a.yBot;
    const hw = G.TUBE_R * a.inset;
    const p0 = A.renderer.toScreen(x - hw, y0), p1 = A.renderer.toScreen(x + hw, y1);
    return { x0: c.left + p0.x, y0: c.top + p0.y, x1: c.left + p1.x, y1: c.top + p1.y };
  }, { slot, yTop, yBot, inset });
}

// ----- ZIP lesen und frisch entpacken (außerhalb des Repositorys)
import os from 'node:os';
export function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    files.set(name, method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw));
    p += 46 + nlen + elen + clen;
  }
  return files;
}
export function extract(files, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const [n, b] of files) { if (n.includes('..') || n.startsWith('/')) throw new Error('ungültiger Pfad im ZIP: ' + n); const f = path.join(dir, n); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); }
  return dir;
}
export const VERSION = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
export const REL = (n) => path.join(APP, 'release', n);
export function writeEvidence(name, data) { fs.mkdirSync(EVID, { recursive: true }); fs.writeFileSync(path.join(EVID, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n'); return 'docs/evidence/' + name; }
