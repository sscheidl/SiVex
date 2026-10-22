// End-to-End-Prüfung des Trennlabors im echten Browser (Chromium über Playwright).
// Bedient die wirkliche Oberfläche wie Lernende (Klicken, Tippen auf Touch-Geräten,
// Tastatur, optional Ziehen) und prüft danach den Modellzustand, die Anzeige
// (Texte, Pixel der Laborbühne) und legt Screenshots ab.
//
// Aufruf: npm run build && node tests/e2e/run.mjs [--root <verzeichnis>] [--only <id,id>] [--smoke]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ROOT = argVal('--root') || (fs.existsSync(path.join(APP, 'dist/trennlabor/index.html')) ? path.join(APP, 'dist/trennlabor') : APP);
const ONLY = (argVal('--only') || '').split(',').filter(Boolean);
const SMOKE = args.includes('--smoke');
const SHOTS = path.join(APP, 'docs/screenshots');
const PORT = +(process.env.E2E_PORT || 8137);
const BASE = `http://localhost:${PORT}/index.html?neu`;
const RESULTS = argVal('--results') || path.join(HERE, SMOKE ? 'smoke-results.json' : 'results.json');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ------------------------------------------------------------------ Hilfen
async function open(browser, o) {
  const opt = Object.assign({ width: 1440, height: 900, touch: false }, o);
  const ctx = await browser.newContext({ viewport: { width: opt.width, height: opt.height }, hasTouch: opt.touch, isMobile: false, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(`http://localhost:${PORT}/`) && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.Trennlabor && window.Trennlabor.session);
  const T = {
    page, ctx, errors, external, touch: opt.touch,
    async click(sel) {
      // Das Bedienfeld kann sich während des Versuchs ändern: bei kurzzeitig
      // ersetzten Knoten bis zu dreimal erneut versuchen (wie ein zweites Antippen).
      for (let attempt = 0; ; attempt++) {
        try {
          const el = page.locator(sel).first();
          await el.scrollIntoViewIfNeeded({ timeout: 10000 });
          if (opt.touch) await el.tap({ timeout: 10000 }); else await el.click({ timeout: 10000 });
          break;
        } catch (e) {
          if (attempt >= 3 || !/not attached|detached|not stable/i.test(String(e.message))) throw e;
          await sleep(120);
        }
      }
      await sleep(60);
    },
    async lab(id) { await T.click(`#labTabs [data-lab="${id}"]`); await sleep(150); },
    async task(id) { await T.click(`[data-act="task"][data-task="${id}"]`); await sleep(100); },
    async speed(s) { await T.click(`[data-speed="${s}"]`); },
    async idle(timeout) { await page.waitForFunction(() => !window.Trennlabor.session.engine().busy(), null, { timeout: timeout || 60000 }); },
    async until(fn, arg, timeout) { await page.waitForFunction(fn, arg, { timeout: timeout || 90000, polling: 50 }); },
    st: (fn, arg) => page.evaluate(fn, arg),
    /** Objekt auf der Bühne antippen bzw. anklicken (echte Zeigerereignisse am Canvas). */
    async tapStage(id) {
      const pt = await page.evaluate((hid) => window.Trennlabor.stage.hitCenter(hid), id);
      assert(pt, 'Objekt auf der Bühne nicht gefunden: ' + id);
      if (opt.touch) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
      await sleep(120);
    },
    async dragStage(from, to) {
      const a = await page.evaluate((hid) => window.Trennlabor.stage.hitCenter(hid), from);
      const b = await page.evaluate((hid) => window.Trennlabor.stage.hitCenter(hid), to);
      assert(a && b, 'Ziehen: Objekt fehlt');
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      for (let i = 1; i <= 12; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 12, a.y + (b.y - a.y) * i / 12); await sleep(16); }
      await page.mouse.up(); await sleep(150);
    },
    async shot(name) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); },
    /** Mittlere Farbe eines Bereichs der Bühne (logische Koordinaten relativ zu einem Trefferbereich). */
    async pixels(id, fx0, fy0, fx1, fy1) {
      return page.evaluate(([hid, a, b, c, d]) => {
        const { stage } = window.Trennlabor;
        const h = stage.hits.find((x) => x.id === hid);
        if (!h) return null;
        const p0 = stage.toClient(h.x + h.w * a, h.y + h.h * b), p1 = stage.toClient(h.x + h.w * c, h.y + h.h * d);
        const r = stage.canvas.getBoundingClientRect(); const k = stage.canvas.width / r.width;
        const X = Math.round((p0.x - r.left) * k), Y = Math.round((p0.y - r.top) * k);
        const W = Math.max(1, Math.round((p1.x - p0.x) * k)), H = Math.max(1, Math.round((p1.y - p0.y) * k));
        const data = stage.canvas.getContext('2d').getImageData(X, Y, W, H).data;
        let R = 0, G = 0, B = 0, n = 0, L2 = 0, Ls = 0;
        for (let i = 0; i < data.length; i += 4) { R += data[i]; G += data[i + 1]; B += data[i + 2]; n++; const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; Ls += L; L2 += L * L; }
        const mean = Ls / n;
        return { r: R / n, g: G / n, b: B / n, lum: mean, std: Math.sqrt(Math.max(0, L2 / n - mean * mean)) };
      }, [id, fx0, fy0, fx1, fy1]);
    },
    async answer(obs, gaps) {
      for (const [k, v] of Object.entries(obs || {})) {
        const radio = page.locator(`input[data-obs="${k}"][value="${v}"]`);
        if (await radio.count()) { await radio.scrollIntoViewIfNeeded(); await radio.check({ force: true }); }
        else { const inp = page.locator(`input[data-obs="${k}"]`); await inp.scrollIntoViewIfNeeded(); await inp.fill(String(v)); }
      }
      for (const [k, v] of Object.entries(gaps || {})) { const inp = page.locator(`[data-gap="${k}"]`); await inp.scrollIntoViewIfNeeded(); await inp.fill(v); }
      await T.click('[data-act="submit"]');
      await sleep(200);
    },
    async meta() { return page.evaluate(() => { const s = window.Trennlabor.session; const m = s.meta(); return { completed: !!m.completedAt, snapshot: !!m.snapshot, results: m.results, drafts: m.drafts, help: m.help, offer: m.offer }; }); },
    async check() { return page.evaluate(() => { const s = window.Trennlabor.session; return s.task().check(s.engine()); }); },
    async noHorizontalScroll() { return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); }
  };
  return T;
}

async function scenario(browser, id, title, fn, o) {
  if (ONLY.length && !ONLY.includes(id)) return;
  const t0 = Date.now();
  let T;
  try {
    T = await open(browser, o);
    const detail = await fn(T);
    assert(T.errors.length === 0, 'Laufzeitfehler: ' + T.errors.join(' | '));
    assert(T.external.length === 0, 'externe Anfragen: ' + T.external.join(', '));
    results.push({ id, title, status: 'PASS', detail: detail || '', ms: Date.now() - t0, viewport: o ? `${o.width}×${o.height}${o.touch ? ' Touch' : ''}` : '1440×900' });
    console.log(`PASS ${id} – ${title}${detail ? ' – ' + detail : ''}`);
  } catch (e) {
    results.push({ id, title, status: 'FAIL', detail: String(e.message || e).slice(0, 600), ms: Date.now() - t0 });
    console.log(`FAIL ${id} – ${title}: ${e.message}`);
    if (T) await T.page.screenshot({ path: path.join(SHOTS, `fail-${id}.png`) }).catch(() => {});
  } finally {
    if (T) await T.ctx.close();
  }
}

// ------------------------------------------------------------------ Teilabläufe über die Oberfläche
async function k02Positive(T, shots) {
  await T.lab('classic'); await T.task('K-02'); await T.speed(10);
  if (shots) await T.shot('k02-01-ausgang');
  await T.click('[data-act="sel"][data-id="B1"]');
  await T.click('[data-act="wamt"][data-amt="50"]');
  await T.click('[data-act="tool"][data-tool="water"][data-to="B1"]'); await T.idle();
  await T.click('[data-act="stir"][data-id="B1"]'); await sleep(250);
  if (shots) await T.shot('k02-02-ruehren-loesen');
  await T.idle();
  await T.click('[data-act="sel"][data-id="F"]');
  await T.click('[data-act="insert"][data-kind="paper"]'); await T.idle();
  await T.click('[data-act="sel"][data-id="B2"]');
  await T.click('[data-act="move"][data-id="B2"][data-to="filter"]'); await T.idle();
  await T.click('[data-act="sel"][data-id="B1"]');
  await T.click('[data-act="pmode"][data-mode="all"]');
  await T.click('[data-act="pour"][data-from="B1"][data-to="F"]');
  await sleep(700);
  if (shots) await T.shot('k02-03-filtrieren');
  await T.idle();
  await T.until(() => window.Trennlabor.session.engine().describe('F').liquid < 3);
  await T.click('[data-act="sel"][data-id="B2"]');
  await T.click('[data-act="pmode"][data-mode="slow"]');
  await T.click('[data-act="pour"][data-from="B2"][data-to="D"]'); await T.idle();
  await T.click('[data-act="sel"][data-id="D"]');
  await T.click('[data-act="burner"][data-level="2"]');
  await T.until(() => window.Trennlabor.session.engine().describe('D').water < 20);
  if (shots) await T.shot('k02-04-eindampfen');
  await T.until(() => window.Trennlabor.session.engine().describe('D').water < 6);
  await T.click('[data-act="burner"][data-level="1"]');
  await T.until(() => window.Trennlabor.session.engine().describe('D').water < 0.02);
  await T.click('[data-act="burner"][data-level="0"]');
  await sleep(400);
  if (shots) await T.shot('k02-05-salzkristalle');
}
const K02_ANSWERS = [{ dissolve: 'dissolved', residue: 'sand', dish: 'crystals' }, { loes: 'löslich', unl: 'unlöslich', rue: 'Rückstand', fil: 'Filtrat', ein: 'Eindampfen' }];

async function buildDistillUI(T, o) {
  const opt = Object.assign({ thermo: 'correct', hose: 'bottom', cool: 2, stones: true, viaTray: false }, o);
  await T.lab('distill'); await T.speed(10);
  if (opt.viaTray) { await T.tapStage('tray:mantle'); await T.tapStage('tray:flask'); }
  else { await T.click('[data-act="dplace"][data-part="mantle"]'); await T.click('[data-act="dplace"][data-part="flask"]'); }
  for (let i = 0; i < 4; i++) { if (opt.viaTray) await T.tapStage('tray:mix'); else await T.click('[data-act="dfill"]'); }
  if (opt.stones) { if (opt.viaTray) await T.tapStage('tray:stones'); else await T.click('[data-act="dstones"]'); }
  await T.click('[data-act="dplace"][data-part="head"]');
  if (opt.thermo) { await T.click(`[data-act="tpos"][data-v="${opt.thermo}"]`); await T.click('[data-act="dplace"][data-part="thermo"]'); }
  await T.click('[data-act="dplace"][data-part="cooler"]');
  await T.click(`[data-act="hose"][data-v="${opt.hose}"]`); await T.click('[data-act="dplace"][data-part="hoses"]');
  await T.click('[data-act="dplace"][data-part="adapter"]');
  await T.click('[data-act="dplace"][data-part="clamps"]');
  await T.click('[data-act="recv"][data-id="A"]');
  await T.click(`[data-act="cool"][data-level="${opt.cool}"]`);
}

async function chromaRun(T, pens, o) {
  const opt = Object.assign({ eluent: 'water', level: 1, line: 1.5, tool: 'pencil', loads: null, front: 11, paper: 'sheet' }, o);
  await T.click(`[data-act="cpaper"][data-type="${opt.paper}"]`);
  if (opt.tool !== 'pencil') await T.click(`[data-act="ltool"][data-tool="${opt.tool}"]`);
  const curLine = await T.st(() => window.Trennlabor.ui.ui.lineY);
  for (let k = 0; k < Math.round((opt.line - curLine) / 0.5); k++) await T.click('[data-act="lineY"][data-d="0.5"]');
  for (let k = 0; k < Math.round((curLine - opt.line) / 0.5); k++) await T.click('[data-act="lineY"][data-d="-0.5"]');
  await T.click('[data-act="cline"]');
  for (let i = 0; i < pens.length; i++) {
    await T.click(`[data-act="pen"][data-pen="${pens[i]}"]`);
    await T.click(`[data-act="lane"][data-lane="${i}"]`);
    const n = opt.loads ? opt.loads[i] : 1;
    for (let k = 0; k < n; k++) await T.click('[data-act="spot"]');
  }
  const cur = await T.st(() => window.Trennlabor.session.engine().state.chamber);
  if (cur.eluent !== opt.eluent || Math.abs(cur.level - opt.level) > 1e-6) {
    if (cur.eluent) await T.click('[data-act="emptyCh"]');
    await T.click(`[data-act="eluent"][data-el="${opt.eluent}"]`);
    const ul = await T.st(() => window.Trennlabor.ui.ui.level);
    for (let k = 0; k < Math.round((opt.level - ul) / 0.5); k++) await T.click('[data-act="level"][data-d="0.5"]');
    for (let k = 0; k < Math.round((ul - opt.level) / 0.5); k++) await T.click('[data-act="level"][data-d="-0.5"]');
    await T.click('[data-act="fill"]');
  }
  if (!cur.lid) await T.click('[data-act="lid"]');
  await T.click('[data-act="insertP"]');
  await T.until((f) => { const p = window.Trennlabor.session.engine().state.paper; return p.front >= f; }, opt.front, 120000);
  await T.click('[data-act="removeP"]');
  if (opt.mark !== false) await T.click('[data-act="markF"]');
  return T.st(() => { const e = window.Trennlabor.session.engine(); const p = e.state.paper; return { no: p.no, eval: e.evaluatePaper(p), front: p.front }; });
}

// ------------------------------------------------------------------ Szenarien
async function main() {
  const server = await serve(ROOT, PORT);
  const CHANNEL = process.env.PW_CHANNEL || '';
  const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
  const ver = browser.version();
  console.log(`Chromium ${ver}, Wurzel: ${path.relative(APP, ROOT) || '.'}${SMOKE ? ' (Rauchtest)' : ''}`);

  // Startansicht
  await scenario(browser, 'S-00', 'Startansicht mit drei Laboren, alle erreichbar (A-01)', async (T) => {
    await T.shot('00-startansicht');
    const cards = await T.page.locator('.labcard').count();
    assert(cards === 3, 'drei Laborkarten');
    for (const lab of ['classic', 'chroma', 'distill']) {
      await T.click('#homeBtn');
      await T.click(`.labcard[data-lab="${lab}"]`);
      await sleep(200);
      const ok = await T.st((l) => window.Trennlabor.session.state.lab === l && document.querySelectorAll('#tabBody button').length > 3, lab);
      assert(ok, 'Labor ' + lab + ' bedienbar');
      await T.shot('00-labor-' + lab);
    }
    return '3 Labore geöffnet, je mit Bedienelementen';
  });

  // 1 K-02 positiv
  await scenario(browser, 'E-01', 'K-02 positiv: Lösen → Filtrieren → Eindampfen → Kristalle → Auswertung → Hefteintrag', async (T) => {
    await k02Positive(T, true);
    const c = await T.check();
    assert(c.success, 'Versuchsziel: ' + JSON.stringify(c.items));
    const px = await T.pixels('D', 0.15, 0.55, 0.85, 0.95);
    assert(px.lum > 150, 'weiße Kristalle in der Schale sichtbar: ' + JSON.stringify(px));
    await T.click('[data-act="tab"][data-tab="note"]');
    const locked = await T.page.locator('.locked').count();
    assert(locked === 1, 'Hefteintrag vor der Auswertung gesperrt');
    await T.click('[data-act="tab"][data-tab="eval"]');
    await T.answer(...K02_ANSWERS);
    const m = await T.meta();
    assert(m.completed, 'abgeschlossen: ' + JSON.stringify(m.results));
    await T.shot('k02-06-auswertung');
    await T.click('[data-act="tab"][data-tab="note"]');
    await T.click('[data-act="tall"]');
    const nb = await T.page.locator('#notebook').innerText();
    for (const h of ['Versuch', 'Beobachtung', 'Erklärung', 'Merksatz']) assert(nb.includes(h), 'Hefteintrag: ' + h);
    await T.shot('k02-07-hefteintrag');
    const D = await T.st(() => window.Trennlabor.session.engine().describe('D'));
    return `Salzkristalle ${D.saltSolid.toFixed(2)} g, Schale ${px.lum.toFixed(0)} Helligkeit, Hefteintrag sichtbar`;
  });

  if (!SMOKE) {
    // 2 K-02 negativ
    await scenario(browser, 'E-02', 'K-02 negativ: trocken filtriert → Salz nicht als getrennt gemeldet', async (T) => {
      await T.lab('classic'); await T.task('K-02'); await T.speed(10);
      await T.click('[data-act="sel"][data-id="F"]'); await T.click('[data-act="insert"][data-kind="paper"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="move"][data-id="B2"][data-to="filter"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="pmode"][data-mode="all"]');
      await T.click('[data-act="pour"][data-from="B1"][data-to="F"]'); await T.idle();
      await sleep(500);
      const c = await T.check();
      assert(!c.success, 'darf nicht erfolgreich sein');
      assert(!c.items.find((i) => i.label.startsWith('Festes Kochsalz')).ok, 'Salz nicht gewonnen');
      const F = await T.st(() => window.Trennlabor.session.engine().describe('F'));
      assert(F.sand > 9 && F.saltSolid > 4.5, 'beides im Filterpapier');
      await T.click('[data-act="tab"][data-tab="eval"]');
      const txt = await T.page.locator('#tabBody').innerText();
      assert(/öffnet sich, sobald/.test(txt), 'Auswertung gesperrt');
      await T.shot('k02-negativ-trocken-filtriert');
      return `Filter: ${F.sand.toFixed(1)} g Sand + ${F.saltSolid.toFixed(1)} g Salz, Ziel nicht erreicht`;
    });

    // 3 K-02 Verlust
    await scenario(browser, 'E-03', 'K-02 Verlust: Filtrat verworfen → kein Salz aus dem Nichts', async (T) => {
      await T.lab('classic'); await T.task('K-02'); await T.speed(10);
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="wamt"][data-amt="50"]');
      await T.click('[data-act="tool"][data-tool="water"][data-to="B1"]'); await T.idle();
      await T.click('[data-act="stir"][data-id="B1"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="F"]'); await T.click('[data-act="insert"][data-kind="paper"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="move"][data-id="B2"][data-to="filter"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="pmode"][data-mode="all"]');
      await T.click('[data-act="pour"][data-from="B1"][data-to="F"]'); await T.idle();
      await T.until(() => window.Trennlabor.session.engine().describe('F').liquid < 3);
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="pour"][data-from="B2"][data-to="waste"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="D"]'); await T.click('[data-act="burner"][data-level="2"]');
      await sleep(3000);
      const D = await T.st(() => window.Trennlabor.session.engine().describe('D'));
      assert(D.saltSolid === 0 && D.salt === 0, 'kein Salz in der Schale');
      const bal = await T.st(() => window.Trennlabor.session.engine().balance());
      const lostSalt = bal.where.salt.filter((w) => w.lost).reduce((s, w) => s + w.amount, 0);
      assert(lostSalt > 4, 'Salzverlust in der Bilanz');
      assert(!(await T.check()).success);
      await T.click('[data-act="help"][data-level="2"]');
      const help = await T.page.locator('#helpText').innerText();
      assert(/verloren|Neu beginnen/.test(help), 'konkrete Hilfe benennt den Verlust: ' + help);
      await T.click('[data-act="sel"][data-id="B1"]');
      await T.page.locator('#balance summary').click();
      await T.shot('k02-verlust-bilanz');
      return `Salz im Ausguss ${lostSalt.toFixed(2)} g; Hilfe: „${help.slice(0, 60)}…“`;
    });

    // 4 K-01
    await scenario(browser, 'E-04', 'K-01: Sedimentieren; vorsichtiges vs. zügiges Dekantieren; trübes Ergebnis korrigiert', async (T) => {
      await T.lab('classic'); await T.task('K-01');
      await T.shot('k01-01-aufgeruehrt');
      await T.speed(10);
      await T.until(() => window.Trennlabor.session.engine().state.t > 150);
      await T.speed(1);
      await T.shot('k01-02-abgesetzt');
      await T.click('[data-act="sel"][data-id="B1"]');
      await T.click('[data-act="pmode"][data-mode="fast"]');
      await T.click('[data-act="pour"][data-from="B1"][data-to="B2"]');
      await sleep(900);
      await T.shot('k01-03-zuegig-ausgiessen');
      await T.idle();
      const fast = await T.st(() => window.Trennlabor.session.engine().describe('B2'));
      assert(fast.turbidityClass !== 'klar' && fast.sand > 2, 'zügig: trüb ' + JSON.stringify([fast.turbidityClass, fast.sand]));
      const pxFast = await T.pixels('B2', 0.2, 0.55, 0.8, 0.8);
      await T.shot('k01-04-trueb');
      assert(!(await T.check()).success, 'trübes Wasser zählt nicht');
      // Korrektur: absetzen lassen, vorsichtig in B3 abgießen
      await T.speed(10);
      await T.until(() => window.Trennlabor.session.engine().describe('B2').sus < 0.02, null, 60000);
      await T.click('[data-act="sel"][data-id="B2"]');
      await T.click('[data-act="pmode"][data-mode="slow"]');
      await T.click('[data-act="pour"][data-from="B2"][data-to="B3"]'); await T.idle();
      const slow = await T.st(() => window.Trennlabor.session.engine().describe('B3'));
      assert(slow.turbidityClass === 'klar' && slow.sand < 0.3, 'vorsichtig: klar');
      const pxClear = await T.pixels('B3', 0.2, 0.55, 0.8, 0.8);
      assert(pxFast.std > pxClear.std || pxFast.lum < pxClear.lum, 'Trübung sichtbar: ' + JSON.stringify([pxFast, pxClear]));
      const c = await T.check();
      assert(c.success, 'nach Korrektur erfolgreich: ' + JSON.stringify(c.items));
      await T.shot('k01-05-klar-korrigiert');
      return `zügig: ${fast.sand.toFixed(1)} g Sand (${fast.turbidityClass}); korrigiert: ${slow.sand.toFixed(2)} g (${slow.turbidityClass})`;
    });

    // 5 K-03
    await scenario(browser, 'E-05', 'K-03: Magnet + Lösen/Filtrieren/Eindampfen → Eisen, Sand, Salz', async (T) => {
      await T.lab('classic'); await T.task('K-03'); await T.speed(10);
      await T.click('[data-act="sel"][data-id="B1"]');
      for (let i = 0; i < 3; i++) { await T.click('[data-act="tool"][data-tool="magnet"][data-to="B1"]'); await sleep(200); await T.idle(); }
      await T.shot('k03-01-magnet');
      const E = await T.st(() => window.Trennlabor.session.engine().describe('E'));
      assert(E.iron > 4.5 && E.sand === 0 && E.saltSolid === 0, 'nur Eisen am Magneten');
      await T.click('[data-act="wamt"][data-amt="50"]');
      await T.click('[data-act="tool"][data-tool="water"][data-to="B1"]'); await T.idle();
      await T.click('[data-act="stir"][data-id="B1"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="F"]'); await T.click('[data-act="insert"][data-kind="paper"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="move"][data-id="B2"][data-to="filter"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="pmode"][data-mode="all"]');
      await T.click('[data-act="pour"][data-from="B1"][data-to="F"]'); await T.idle();
      await T.until(() => window.Trennlabor.session.engine().describe('F').liquid < 3);
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="pmode"][data-mode="slow"]');
      await T.click('[data-act="pour"][data-from="B2"][data-to="D"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="D"]'); await T.click('[data-act="burner"][data-level="2"]');
      await T.until(() => window.Trennlabor.session.engine().describe('D').water < 6);
      await T.click('[data-act="burner"][data-level="1"]');
      await T.until(() => window.Trennlabor.session.engine().describe('D').water < 0.02);
      await T.click('[data-act="burner"][data-level="0"]');
      const c = await T.check();
      assert(c.success, JSON.stringify(c.items));
      const bal = await T.st(() => window.Trennlabor.session.engine().balance());
      for (const k of ['sand', 'salt', 'iron']) assert(Math.abs(bal.now[k] - bal.start[k]) < 1e-6, 'Bilanz ' + k);
      await T.shot('k03-02-drei-fraktionen');
      return c.items.map((i) => i.detail).join(' | ');
    });

    // 6 K-04
    await scenario(browser, 'E-06', 'K-04: Scheidetrichter trennt beide Phasen; Hahnfehler erzeugt Mischfraktion bzw. Verlust', async (T) => {
      await T.lab('classic'); await T.task('K-04'); await T.speed(10);
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="pmode"][data-mode="all"]');
      await T.click('[data-act="pour"][data-from="B1"][data-to="S"]'); await T.idle();
      await T.shot('k04-01-emulsion');
      await T.until(() => window.Trennlabor.session.engine().describe('S').disp < 0.5);
      await T.shot('k04-02-zwei-phasen');
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="move"][data-id="B2"][data-to="sep"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="S"]');
      await T.speed(4);
      await T.click('[data-act="tap"][data-v="open"]');
      await T.until(() => window.Trennlabor.session.engine().describe('S').water < 5);
      await T.click('[data-act="tap"][data-v="drop"]');
      await T.shot('k04-03-tropfenweise');
      await T.until(() => window.Trennlabor.session.engine().describe('S').water < 0.05, null, 120000);
      await T.click('[data-act="tap"][data-v="closed"]');
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="move"][data-id="B2"][data-to="bench"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B3"]'); await T.click('[data-act="move"][data-id="B3"][data-to="sep"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="S"]'); await T.speed(10);
      await T.click('[data-act="tap"][data-v="open"]');
      await T.until(() => window.Trennlabor.session.engine().describe('S').liquid < 0.05);
      await T.click('[data-act="tap"][data-v="closed"]');
      const c = await T.check();
      assert(c.success, JSON.stringify(c.items));
      await T.shot('k04-04-getrennt');
      // Fehler: Hahn offen ohne Gefäß / zu lange offen
      await T.click('#btnRestart'); await T.click('[data-act="resetExp"]');
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="pmode"][data-mode="all"]');
      await T.click('[data-act="pour"][data-from="B1"][data-to="S"]'); await T.idle();
      await T.until(() => window.Trennlabor.session.engine().describe('S').disp < 0.5);
      await T.click('[data-act="sel"][data-id="S"]'); await T.click('[data-act="tap"][data-v="open"]');
      await T.until(() => window.Trennlabor.session.engine().describe('table').water > 5);
      await T.click('[data-act="tap"][data-v="closed"]');
      await T.shot('k04-05-verlust-ohne-gefaess');
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="move"][data-id="B2"][data-to="sep"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="S"]'); await T.click('[data-act="tap"][data-v="open"]');
      await T.until(() => window.Trennlabor.session.engine().describe('B2').oil > 5);
      await T.click('[data-act="tap"][data-v="closed"]');
      const mixed = await T.st(() => window.Trennlabor.session.engine().describe('B2'));
      const c2 = await T.check();
      assert(!c2.success && mixed.oil > 5 && mixed.water > 10, 'Mischfraktion');
      await T.shot('k04-06-mischfraktion');
      return `getrennt: ${c.items.map((i) => i.detail).join(' | ')}; Fehler: Mischfraktion ${mixed.water.toFixed(0)} mL Wasser + ${mixed.oil.toFixed(0)} mL Öl`;
    });

    // 7 K-05
    await scenario(browser, 'E-07', 'K-05: kaltes vs. heißes Wasser, Farbzunahme, Blütenreste abtrennen, Tee bleibt Stoffgemisch', async (T) => {
      await T.lab('classic'); await T.task('K-05'); await T.speed(4);
      await T.click('[data-act="sel"][data-id="B1"]');
      await T.click('[data-act="tool"][data-tool="hib"][data-to="B1"]'); await T.idle();
      await T.click('[data-act="tool"][data-tool="hib"][data-to="B1"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B2"]');
      await T.click('[data-act="tool"][data-tool="hib"][data-to="B2"]'); await T.idle();
      await T.click('[data-act="tool"][data-tool="hib"][data-to="B2"]'); await T.idle();
      await T.click('[data-act="wamt"][data-amt="100"]');
      await T.click('[data-act="sel"][data-id="B1"]');
      await T.click('[data-act="tool"][data-tool="water"][data-to="B1"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B2"]');
      await T.click('[data-act="tool"][data-tool="kettle"][data-to="B2"]'); await T.idle();
      const t0 = await T.st(() => window.Trennlabor.session.engine().state.t);
      await T.until((t) => window.Trennlabor.session.engine().state.t > t + 60, t0);
      const early = await T.st(() => [window.Trennlabor.session.engine().describe('B1').dyeConc, window.Trennlabor.session.engine().describe('B2').dyeConc]);
      const pxCold1 = await T.pixels('B1', 0.15, 0.5, 0.85, 0.85), pxHot1 = await T.pixels('B2', 0.15, 0.5, 0.85, 0.85);
      await T.shot('k05-01-kalt-heiss');
      await T.speed(10);
      await T.until((t) => window.Trennlabor.session.engine().state.t > t + 200, t0);
      const late = await T.st(() => [window.Trennlabor.session.engine().describe('B1').dyeConc, window.Trennlabor.session.engine().describe('B2').dyeConc]);
      const pxHot2 = await T.pixels('B2', 0.15, 0.5, 0.85, 0.85);
      assert(late[1] > 4 * late[0], 'heiß schneller');
      assert(late[1] > early[1], 'Farbe nimmt zu');
      assert(pxHot1.r - pxHot1.g > pxCold1.r - pxCold1.g, 'heißer Ansatz sichtbar röter: ' + JSON.stringify([pxHot1, pxCold1]));
      assert(pxHot2.g < pxHot1.g + 1, 'Rotfärbung nimmt sichtbar zu');
      await T.click('[data-act="sel"][data-id="F"]'); await T.click('[data-act="insert"][data-kind="paper"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B3"]'); await T.click('[data-act="move"][data-id="B3"][data-to="filter"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="pmode"][data-mode="all"]');
      await T.click('[data-act="pour"][data-from="B2"][data-to="F"]'); await T.idle();
      await T.until(() => window.Trennlabor.session.engine().describe('F').liquid < 3);
      const tea = await T.st(() => window.Trennlabor.session.engine().describe('B3'));
      assert(tea.petals === 0 && tea.dyeConc > 1, 'Tee ohne Blüten, rot');
      const c = await T.check();
      assert(c.success, JSON.stringify(c.items));
      await T.shot('k05-02-tee-gefiltert');
      await T.click('[data-act="tab"][data-tab="eval"]');
      await T.answer({ faster: 'hot', kept: 'plant', pure: 'pureFilter' }, { schnell: 'schneller', extr: 'Extraktion', wass: 'Wasser', filt: 'Filtrieren', gem: 'Stoffgemisch' });
      let m = await T.meta();
      assert(!m.completed && m.results.obs.pure.status === 'wrong', '„Reinstoff durch Filtrieren“ wird abgelehnt');
      await T.answer({ pure: 'mixture' }, {});
      m = await T.meta();
      assert(m.completed, 'Tee als Stoffgemisch: abgeschlossen');
      return `Farbstoffe nach Zeit: kalt ${late[0].toFixed(2)}, heiß ${late[1].toFixed(2)} mg/mL; Tee ${tea.water.toFixed(0)} mL ohne Blütenreste`;
    });
  }

  // 8 C-01
  await scenario(browser, 'E-08', 'C-01 positiv: Schwarz/Grün/Blau nebeneinander → Front steigt → verschiedene Banden, gemeinsamer Farbstoff', async (T) => {
    await T.lab('chroma'); await T.speed(10);
    await T.click('[data-act="cpaper"][data-type="sheet"]');
    await T.click('[data-act="cline"]');
    // Proben per Antippen auf der Bühne (Stift wählen, Bahn antippen)
    const pens = ['black', 'green', 'refBlue'];
    for (let i = 0; i < 3; i++) { await T.tapStage('pen:' + pens[i]); await T.tapStage('lane:' + i); }
    await T.shot('c01-01-proben-aufgetragen');
    await T.click('[data-act="fill"]'); await T.click('[data-act="lid"]');
    await T.click('[data-act="insertP"]');
    const fronts = [];
    for (const f of [3, 6, 9]) { await T.until((x) => window.Trennlabor.session.engine().state.paper.front >= x, f); fronts.push(await T.st(() => { const p = window.Trennlabor.session.engine().state.paper; return { front: p.front, y: p.zones.filter((z) => z.lane === 0).map((z) => z.y) }; })); if (f === 6) await T.shot('c01-02-laufmittelfront-steigt'); }
    for (let i = 1; i < fronts.length; i++) assert(fronts[i].front > fronts[i - 1].front && fronts[i].y.some((y, k) => y > fronts[i - 1].y[k]), 'Front und Zonen bewegen sich');
    await T.until(() => window.Trennlabor.session.engine().state.paper.front >= 11);
    await T.click('[data-act="removeP"]'); await T.click('[data-act="markF"]');
    await T.shot('c01-03-chromatogramm');
    const ev = await T.st(() => { const e = window.Trennlabor.session.engine(); return e.evaluatePaper(e.state.paper); });
    assert(ev.clean, 'sauberes Chromatogramm');
    assert(ev.lanes[0].bands === 3 && ev.lanes[1].bands === 2 && ev.lanes[2].bands === 1, 'Banden: ' + ev.lanes.map((l) => l.bands));
    await T.click('[data-act="cview"][data-v="compare"]'); await sleep(250);
    await T.shot('c01-04-vergleich');
    const c = await T.check();
    assert(c.success, JSON.stringify(c.items));
    await T.click('[data-act="tab"][data-tab="eval"]');
    await T.answer({ n_black: 3, n_green: 2, n_refBlue: 1, refMeaning: 'hint' }, { mob: 'mobile', stat: 'stationäre', loes: 'löst', ads: 'Adsorption', gem: 'Gemisch' });
    const m = await T.meta();
    assert(m.completed, JSON.stringify(m.results));
    return `Banden 3/2/1, Front ${fronts.map((f) => f.front.toFixed(1)).join(' → ')} cm`;
  });

  if (!SMOKE) {
    // 9 C-02
    await scenario(browser, 'E-09', 'C-02 negativ: wasserfester Stift mit Wasser → Komponente wandert nicht', async (T) => {
      await T.lab('chroma'); await T.speed(10);
      const r = await chromaRun(T, ['perm', 'black'], { paper: 'sheet' });
      const perm = r.eval.lanes.find((l) => l.pen === 'perm');
      assert(perm.moved === false && perm.bands === 1, 'bleibt auf der Startlinie');
      await T.shot('c02-wasserfest-wasser');
      await chromaRun(T, ['perm'], { eluent: 'ethanol', paper: 'strip', front: 11 });
      const e2 = await T.st(() => { const e = window.Trennlabor.session.engine(); return e.evaluatePaper(e.state.paper); });
      assert(e2.lanes[0].moved, 'Ethanol-Wasser: wandert');
      await T.shot('c02b-wasserfest-ethanol');
      await T.task('C-3');
      assert((await T.check()).success);
      return 'Wasser: bleibt am Start; Ethanol-Wasser 7 : 3: wandert';
    });

    // 10 C-03
    await scenario(browser, 'E-10', 'C-03 negativ: Startlinie unter dem Flüssigkeitsspiegel → keine gültige Chromatographie', async (T) => {
      await T.lab('chroma'); await T.speed(10);
      const r = await chromaRun(T, ['black', 'green'], { level: 2, line: 1.5, front: 8 });
      assert(r.eval.issues.includes('submerged') && !r.eval.usable, 'unbrauchbar');
      await T.shot('c03-startlinie-im-laufmittel');
      assert(!(await T.check()).success, 'zählt nicht');
      const txt = await T.page.locator('#cArch').innerText();
      assert(/unbrauchbar/.test(txt), 'als unbrauchbar gekennzeichnet');
      return 'Chromatogramm als unbrauchbar gekennzeichnet';
    });

    // 11 C-04
    await scenario(browser, 'E-11', 'C-04 negativ: zu viel Farbstoff → verbreiterte Flecken im Vergleich zur Normalprobe', async (T) => {
      await T.lab('chroma'); await T.speed(10);
      const r = await chromaRun(T, ['black', 'black'], { loads: [1, 5] });
      assert(r.eval.issues.includes('overload'), 'überladen erkannt');
      assert(r.eval.lanes[1].bands < r.eval.lanes[0].bands, 'Zonen laufen ineinander');
      await T.click('[data-act="cview"][data-v="compare"]'); await sleep(300);
      // Pixel: Anteil gefärbter Fläche in Bahn 1 vs. Bahn 2
      const area = await T.page.evaluate(() => {
        const { stage, renderers } = window.Trennlabor;
        const c = renderers.chroma.vis.cmp[renderers.chroma.vis.cmp.length - 1];
        const rect = stage.canvas.getBoundingClientRect(); const k = stage.canvas.width / rect.width;
        const out = [];
        for (let lane = 0; lane < 2; lane++) {
          const lx = c.r.x + (lane + 0.5) * c.r.w / 3;
          const a = stage.toClient(lx - 40, c.r.y + 10), b = stage.toClient(lx + 40, c.r.y + c.r.h - 10);
          const d = stage.canvas.getContext('2d').getImageData(Math.round((a.x - rect.left) * k), Math.round((a.y - rect.top) * k), Math.round((b.x - a.x) * k), Math.round((b.y - a.y) * k)).data;
          let colored = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) { n++; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) colored++; }
          out.push(colored / n);
        }
        return out;
      });
      assert(area[1] > 1.5 * area[0], 'überladener Fleck sichtbar breiter: ' + area.map((x) => x.toFixed(3)));
      await T.shot('c04-ueberladen-vergleich');
      return `gefärbte Fläche normal ${area[0].toFixed(3)} vs. überladen ${area[1].toFixed(3)}`;
    });

    // 12 C-05
    await scenario(browser, 'E-12', 'C-05: Reinstoff → eine Bande; Standardmodus ohne Rf; Expertenmodus misst und rechnet korrekt', async (T) => {
      await T.lab('chroma'); await T.speed(10);
      const r = await chromaRun(T, ['refYellow', 'refBlue'], {});
      assert(r.eval.lanes.every((l) => l.bands === 1), 'je eine Zone');
      const tasksStd = await T.page.locator('[data-act="task"]').allInnerTexts();
      assert(!tasksStd.join(' ').includes('C-4'), 'Standardmodus: keine Rf-Aufgabe');
      await T.click('[data-act="cview"][data-v="compare"]');
      await T.page.locator('[data-act="expert"]').check();
      await sleep(250);
      await T.task('C-4');
      await T.click('[data-act="cview"][data-v="compare"]');
      await sleep(250);
      // Messen mit dem Lineal: Front und blaue Zone antippen
      const pts = await T.page.evaluate(() => {
        const { stage, renderers, session } = window.Trennlabor;
        const c = renderers.chroma.vis.cmp[renderers.chroma.vis.cmp.length - 1];
        const p = c.p; const z = p.zones.find((x) => x.comp === 'blue');
        const yOf = (cm) => c.r.yb - cm * c.r.s;
        return { front: stage.toClient(c.r.x + c.r.w * 0.8, yOf(p.frontMark.y)), zone: stage.toClient(c.r.x + (z.lane + 0.5) * c.r.w / p.lanes, yOf(z.y)), no: p.no, sess: session.state.expert };
      });
      await T.page.mouse.click(pts.front.x, pts.front.y); await sleep(250);
      const frontTxt = await T.page.locator('#hud').innerText();
      const sFront = parseFloat(frontTxt.match(/Lineal: ([\d,]+) cm/)[1].replace(',', '.'));
      await T.page.mouse.click(pts.zone.x, pts.zone.y); await sleep(250);
      const zoneTxt = await T.page.locator('#hud').innerText();
      const sZone = parseFloat(zoneTxt.match(/Lineal: ([\d,]+) cm/)[1].replace(',', '.'));
      await T.shot('c05-expertenmodus-lineal');
      const rf = Math.round(sZone / sFront * 100) / 100;
      const truth = await T.st(() => { const e = window.Trennlabor.session.engine(); const p = e.state.paper; return e.rfOf(p, p.zones.find((x) => x.comp === 'blue')); });
      assert(Math.abs(rf - truth) < 0.03, `gemessener Rf ${rf} ≈ Modell ${truth}`);
      await T.click('[data-act="tab"][data-tab="eval"]');
      const ev = await T.st(() => window.Trennlabor.session.evaluation().observations.map((o) => o.id));
      const ans = { front: String(sFront).replace('.', ',') };
      for (const id of ev) if (id.startsWith('rf_')) ans[id] = id === 'rf_blue' ? String(rf).replace('.', ',') : null;
      const yellow = await T.st(() => { const e = window.Trennlabor.session.engine(); const p = e.state.paper; return Math.round(e.rfOf(p, p.zones.find((x) => x.comp === 'yellow')) * 100) / 100; });
      if ('rf_yellow' in ans) ans.rf_yellow = String(yellow).replace('.', ',');
      await T.answer(ans, { stoff: 'Stoffes', lm: 'Laufmittels', null: '0' });
      const m = await T.meta();
      assert(m.completed, 'Expertenaufgabe richtig: ' + JSON.stringify(m.results));
      return `Lineal: Front ${sFront} cm, Zone ${sZone} cm → Rf ${rf} (Modell ${truth.toFixed(3)})`;
    });
  }

  // 13 D-01
  await scenario(browser, 'E-13', 'D-01 positiv: Aufbau → Kühlwasser unten → Erhitzen → Temperatur → Destillat → Brennprobe → Auswertung', async (T) => {
    await buildDistillUI(T, { viaTray: true });
    await T.shot('d01-01-aufgebaut');
    await T.click('[data-act="heat"][data-level="3"]');
    await T.until(() => window.Trennlabor.session.engine().state.flask.T > 60);
    await T.shot('d01-02-erhitzen');
    await T.until(() => !!window.Trennlabor.session.engine().state.firstDrop);
    const hud = await T.page.locator('#tempHud').innerText();
    assert(/°C/.test(hud), 'Temperaturanzeige sichtbar');
    await T.until(() => { const r = window.Trennlabor.session.engine().state.receivers.A; return r.E + r.W > 12; });
    await T.shot('d01-03-destillat');
    const tempVis = await T.page.locator('#tempHud').isVisible();
    assert(tempVis, 'Anzeige bleibt sichtbar');
    await T.click('[data-act="heat"][data-level="0"]');
    await T.click('[data-act="ssrc"][data-v="A"]'); await T.click('[data-act="sample"]');
    await T.click('[data-act="itgt"][data-v="dish"]'); await T.click('[data-act="ignite"]');
    await sleep(150);
    await T.shot('d01-04-brennprobe');
    const st = await T.st(() => { const s = window.Trennlabor.session.engine().state; return { first: s.firstDrop, burn: s.burnTests, collect: s.collect.map((c) => c.read) }; });
    assert(st.burn[0].result === 'burns', 'brennt bläulich');
    assert(st.first.read > 82 && st.first.read < 86, 'erste Tropfen bei ca. 84 °C: ' + st.first.read);
    const c = await T.check();
    assert(c.success, JSON.stringify(c.items));
    await T.click('[data-act="tab"][data-tab="eval"]');
    await T.answer({ first: String(st.first.read).replace('.', ','), trend: 'rise', flame: 'burns', meaning: 'flammable' }, { e78: '78', w100: '100', sied: 'Siedetemperatur', kond: 'kondensiert', dest: 'Destillat', dst: 'Destillation' });
    const m = await T.meta();
    assert(m.completed, JSON.stringify(m.results));
    await T.click('[data-act="tab"][data-tab="note"]'); await T.click('[data-act="tall"]');
    await T.shot('d01-05-hefteintrag');
    return `erster Tropfen ${st.first.read} °C, Verlauf ${st.collect[0]} → ${st.collect[st.collect.length - 1]} °C, Brennprobe: ${st.burn[0].result}`;
  });

  if (!SMOKE) {
    // 14 D-02
    await scenario(browser, 'E-14', 'D-02 negativ: Kühlwasser aus → deutlich weniger Kondensat, Dampf entweicht, Sicherheitsstopp', async (T) => {
      await buildDistillUI(T, { cool: 0 });
      await T.click('[data-act="heat"][data-level="3"]');
      await T.until(() => !!window.Trennlabor.session.engine().state.safety, null, 120000);
      await T.page.locator('#safety').waitFor({ state: 'visible' });
      await T.shot('d02-kuehlung-aus-stopp');
      const s = await T.st(() => { const e = window.Trennlabor.session.engine().state; return { d: e.receivers.A.E + e.receivers.A.W, esc: e.lost.escaped.E, code: e.safety.code }; });
      assert(s.code === 'escape' && s.d < 2 && s.esc > 3, JSON.stringify(s));
      await T.click('[data-act="ack"]');
      assert(await T.page.locator('#safety').isHidden(), 'Wiederaufnahme nach Bestätigung');
      return `Destillat nur ${s.d.toFixed(2)} mL, entwichen ${s.esc.toFixed(1)} mL Ethanol`;
    });

    // 15 D-03
    await scenario(browser, 'E-15', 'D-03 negativ: Thermometer falsch positioniert → keine verlässliche Messung, Messaufgabe nicht bestanden', async (T) => {
      await buildDistillUI(T, { thermo: 'high' });
      await T.click('[data-act="heat"][data-level="3"]');
      await T.until(() => { const r = window.Trennlabor.session.engine().state.receivers.A; return r.E + r.W > 8; });
      const read = await T.st(() => window.Trennlabor.session.engine().reading());
      assert(read < 70, 'zu niedrige Anzeige ' + read);
      const hud = await T.page.locator('#tempHud').innerText();
      assert(/nicht am seitlichen Abgang/.test(hud), 'Warnhinweis am Thermometer');
      await T.click('[data-act="ssrc"][data-v="A"]'); await T.click('[data-act="sample"]'); await T.click('[data-act="ignite"]');
      const c = await T.check();
      assert(!c.success && !c.items[1].ok, 'Messung nicht verwertbar');
      await T.shot('d03-thermometer-zu-hoch');
      return `Anzeige ${read} °C statt ca. 84 °C – Ziel nicht erreicht`;
    });

    // 16 D-04
    await scenario(browser, 'E-16', 'D-04 negativ: Heizleistung 0 → auch nach Simulationszeit kein Destillat', async (T) => {
      await buildDistillUI(T, {});
      await T.until(() => window.Trennlabor.session.engine().state.t > 1500, null, 60000);
      const s = await T.st(() => { const e = window.Trennlabor.session.engine(); return { d: e.state.receivers.A.E + e.state.receivers.A.W, T: e.state.flask.T, t: e.state.t }; });
      assert(s.d === 0 && s.T < 21, JSON.stringify(s));
      await T.shot('d04-ohne-heizung');
      return `nach ${(s.t / 60).toFixed(0)} min Versuchszeit: 0 mL Destillat`;
    });

    // 17 D-05
    await scenario(browser, 'E-17', 'D-05 kritisch: geschlossene Apparatur erhitzen bzw. an der Apparatur zünden → sofortiger Sicherheitsstopp', async (T) => {
      await buildDistillUI(T, {});
      await T.click('[data-act="rstop"]');
      await T.click('[data-act="heat"][data-level="3"]');
      await T.page.locator('#safety').waitFor({ state: 'visible', timeout: 3000 });
      const t1 = await T.page.locator('#safety').innerText();
      assert(/geschlossene Apparatur/.test(t1), t1);
      await T.shot('d05-01-stopp-geschlossen');
      const heater = await T.st(() => window.Trennlabor.session.engine().state.heater);
      assert(heater === 0, 'Heizung aus');
      await T.click('[data-act="ack"]');
      await T.click('[data-act="rstop"]');
      await T.click('[data-act="heat"][data-level="3"]');
      await T.until(() => window.Trennlabor.session.engine().state.flask.T > 70);
      await T.click('[data-act="itgt"][data-v="apparatus"]'); await T.click('[data-act="ignite"]');
      await T.page.locator('#safety').waitFor({ state: 'visible', timeout: 3000 });
      const t2 = await T.page.locator('#safety').innerText();
      assert(/Zünden an der Apparatur/.test(t2), t2);
      await T.shot('d05-02-stopp-zuenden');
      await T.click('[data-act="ack"]');
      await T.click('[data-act="heat"][data-level="3"]');
      await T.until(() => !!window.Trennlabor.session.engine().state.firstDrop);
      return 'beide Stopps sofort; Wiederaufnahme nach Korrektur möglich';
    });

    // 18 L-01
    await scenario(browser, 'E-18', 'L-01: wiederholter Fehler → kleine Hilfe angeboten → konkrete Hilfe → Korrektur möglich', async (T) => {
      await T.lab('classic'); await T.task('K-01'); await T.speed(10);
      assert(await T.page.locator('#helpOffer').count() === 0, 'zu Beginn kein Angebot');
      // Fehler 1: Filtrieren ohne Filterpapier; Fehler 2: zügiges Ausgießen
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="move"][data-id="B2"][data-to="filter"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="pmode"][data-mode="fast"]');
      await T.click('[data-act="pour"][data-from="B1"][data-to="F"]'); await T.idle();
      await T.page.locator('#helpOffer').waitFor({ state: 'visible', timeout: 5000 });
      const helpBefore = await T.page.locator('#helpText').count();
      assert(helpBefore === 0, 'keine ungefragte Lösung');
      await T.shot('l01-01-hilfe-angeboten');
      await T.click('#helpOffer [data-act="help"]');
      const small = await T.page.locator('#helpText').innerText();
      await T.click('[data-act="help"][data-level="2"]');
      const concrete = await T.page.locator('#helpText').innerText();
      assert(small !== concrete && concrete.length > small.length / 2, 'zwei verschiedene Stufen');
      assert(/Filterpapier|absetzen|abgießen/.test(concrete), 'konkret und zustandsbezogen: ' + concrete);
      await T.shot('l01-02-konkrete-hilfe');
      // Korrektur durch die lernende Person
      await T.until(() => window.Trennlabor.session.engine().describe('F').liquid < 0.1);
      await T.click('[data-act="sel"][data-id="F"]'); await T.click('[data-act="insert"][data-kind="paper"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="move"][data-id="B2"][data-to="bench"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B3"]'); await T.click('[data-act="move"][data-id="B3"][data-to="filter"]'); await T.idle();
      await T.click('[data-act="sel"][data-id="B2"]'); await T.click('[data-act="pmode"][data-mode="all"]');
      await T.click('[data-act="pour"][data-from="B2"][data-to="F"]'); await T.idle();
      await T.until(() => window.Trennlabor.session.engine().describe('F').liquid < 3);
      const c = await T.check();
      assert(c.success, 'nach Korrektur erfolgreich: ' + JSON.stringify(c.items));
      return `kleine Hilfe: „${small.slice(0, 50)}…“; konkret: „${concrete.slice(0, 60)}…“`;
    });

    // 19 L-02
    await scenario(browser, 'E-19', 'L-02: falsche Beobachtung und falsch geschriebener Fachbegriff → gezieltes Feedback; Richtiges bleibt; Synonyme', async (T) => {
      await k02Positive(T, false);
      await T.click('[data-act="tab"][data-tab="eval"]');
      await T.answer({ dissolve: 'settled', residue: 'sand', dish: 'crystals' }, { loes: 'Loeslich', unl: 'unlöslih', rue: 'Filtrat', fil: 'Filtrat', ein: 'Abdampfen' });
      const m = await T.meta();
      assert(!m.completed);
      assert(m.results.obs.dissolve.status === 'wrong' && m.results.obs.residue.status === 'correct', 'Beobachtung gezielt');
      assert(m.results.gaps.loes.status === 'correct', 'ö/oe-Variante erkannt');
      assert(m.results.gaps.unl.status === 'typo', 'Tippfehler toleriert');
      assert(m.results.gaps.rue.status === 'wrong' && /durchläuft/.test(m.results.gaps.rue.hint), 'falscher Fachbegriff mit Hinweis');
      assert(m.results.gaps.ein.status === 'correct', 'Synonym „Abdampfen“');
      const fb = await T.page.locator('.gapfb').innerText();
      assert(/Schreibweise/.test(fb) && /Filtrat ist die Flüssigkeit/.test(fb), fb);
      const kept = await T.page.locator('[data-gap="loes"]').inputValue();
      assert(kept === 'Loeslich', 'Eingabe bleibt erhalten');
      await T.shot('l02-feedback');
      await T.answer({ dissolve: 'dissolved' }, { rue: 'Rückstand' });
      assert((await T.meta()).completed, 'nach Korrektur abgeschlossen');
      return 'Beobachtung falsch markiert, „unlöslih“ toleriert, „Filtrat“ an falscher Stelle abgelehnt, „Abdampfen“ als Synonym akzeptiert';
    });

    // 20 L-03
    await scenario(browser, 'E-20', 'L-03: Hefteintrag gesperrt bis zur erfolgreichen Auswertung, danach vollständig', async (T) => {
      await T.lab('classic'); await T.task('K-01'); await T.speed(10);
      await T.click('[data-act="tab"][data-tab="note"]');
      assert(await T.page.locator('.locked').count() === 1, 'vor dem Versuch gesperrt');
      await T.click('[data-act="tab"][data-tab="exp"]');
      await T.until(() => window.Trennlabor.session.engine().state.t > 150);
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="pmode"][data-mode="slow"]');
      await T.click('[data-act="pour"][data-from="B1"][data-to="B2"]'); await T.idle();
      await sleep(400);
      await T.click('[data-act="tab"][data-tab="note"]');
      assert(await T.page.locator('.locked').count() === 1, 'nach dem Versuch, vor der Auswertung gesperrt');
      await T.click('[data-act="tab"][data-tab="eval"]');
      await T.answer({ settle: 'bottom', water: 'klar', method: 'decant' }, { sed: 'Sedimentation', dek: 'dekantieren', fil: 'Filtrieren', rue: 'Rückstand', fit: 'Filtrat' });
      assert((await T.meta()).completed);
      await T.click('[data-act="tab"][data-tab="note"]');
      let steps = 0;
      while (await T.page.locator('[data-act="tnext"]').count()) { await T.click('[data-act="tnext"]'); steps++; if (steps > 8) break; }
      const nb = await T.page.locator('#notebook').innerText();
      for (const h of ['Versuch', 'Beobachtung', 'Erklärung', 'Merksatz']) assert(nb.includes(h), h);
      await T.shot('l03-hefteintrag-k01');
      return `${steps} Theorieschritte, dann vollständiger Hefteintrag`;
    });
  }

  // 21 V-01 Tablet: Kernaufgaben per Touch
  await scenario(browser, 'E-21a', 'V-01 Tablet 1180×820 (Touch): K-01 vollständig per Antippen auf Bühne und Bedienfeld', async (T) => {
    assert(await T.noHorizontalScroll(), 'kein horizontales Scrollen');
    await T.lab('classic'); await T.task('K-01'); await T.speed(10);
    await T.until(() => window.Trennlabor.session.engine().state.t > 150);
    // Becherglas 1 antippen (Bühne), dann Ausgießen
    await T.tapStage('B1');
    const sel = await T.st(() => window.Trennlabor.ui.ui.selected.classic);
    assert(sel === 'B1', 'Antippen auf der Bühne wählt aus');
    await T.click('[data-act="pmode"][data-mode="slow"]');
    await T.click('[data-act="pour"][data-from="B1"][data-to="B2"]'); await T.idle();
    assert((await T.check()).success, 'Ziel per Touch erreicht');
    await T.shot('v01-tablet-1180x820-k01');
    await T.click('[data-act="tab"][data-tab="eval"]');
    await T.answer({ settle: 'bottom', water: 'klar', method: 'decant' }, { sed: 'Sedimentieren', dek: 'Dekantieren', fil: 'Filtrieren', rue: 'Rückstand', fit: 'Filtrat' });
    assert((await T.meta()).completed);
    // Werkzeug antippen, dann Gefäß antippen (Tippen statt Ziehen)
    await T.click('[data-act="tab"][data-tab="exp"]');
    await T.tapStage('water'); await T.tapStage('B3'); await T.idle();
    const w = await T.st(() => window.Trennlabor.session.engine().describe('B3').water);
    assert(w > 20, 'Werkzeug → Gefäß per Antippen');
    return 'Antippen auf der Bühne und im Bedienfeld, Auswertung abgeschlossen';
  }, { width: 1180, height: 820, touch: true });

  await scenario(browser, 'E-21b', 'V-01/V-03 Tablet 1024×768 (Touch): Chromatographie per Antippen, Destillation mit sichtbarem Thermometer', async (T) => {
    assert(await T.noHorizontalScroll());
    await T.lab('chroma'); await T.speed(10);
    await T.click('[data-act="cpaper"][data-type="strip"]');
    await T.tapStage('pencil'); await T.tapStage('lane:0');
    await T.tapStage('pen:green'); await T.tapStage('lane:0');
    await T.click('[data-act="fill"]'); await T.click('[data-act="lid"]'); await T.click('[data-act="insertP"]');
    await T.until(() => window.Trennlabor.session.engine().state.paper.front >= 10);
    await T.click('[data-act="removeP"]'); await T.click('[data-act="markF"]');
    const ev = await T.st(() => { const e = window.Trennlabor.session.engine(); return e.evaluatePaper(e.state.paper); });
    assert(ev.clean && ev.lanes[0].bands === 2, 'Streifen mit zwei Zonen');
    await T.shot('v03-tablet-1024x768-chroma');
    await buildDistillUI(T, { viaTray: true });
    await T.click('[data-act="heat"][data-level="3"]');
    await T.until(() => !!window.Trennlabor.session.engine().state.firstDrop);
    const box = await T.page.locator('#tempHud').boundingBox();
    const vp = T.page.viewportSize();
    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height, 'Temperaturanzeige vollständig sichtbar');
    const stage = await T.page.locator('#stage').boundingBox();
    assert(stage.width >= vp.width * 0.6, 'Bühne groß genug: ' + stage.width);
    await T.shot('v03-tablet-1024x768-destillation');
    return `Bühne ${Math.round(stage.width)}×${Math.round(stage.height)} px, Thermometeranzeige sichtbar`;
  }, { width: 1024, height: 768, touch: true });

  if (!SMOKE) {
    await scenario(browser, 'E-21c', 'V-03 Layout: 1440×900, 1180×820, 1024×768 ohne abgeschnittene Pflichtfunktionen; eingeklapptes Bedienfeld', async (T) => {
      const out = [];
      for (const [w, h] of [[1440, 900], [1180, 820], [1024, 768]]) {
        await T.page.setViewportSize({ width: w, height: h });
        for (const lab of ['classic', 'chroma', 'distill']) {
          await T.lab(lab);
          await sleep(200);
          assert(await T.noHorizontalScroll(), `${w}×${h} ${lab}: horizontales Scrollen`);
          const ok = await T.page.evaluate(() => {
            const vis = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.width > 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1 && r.left >= -1; };
            const tabs = vis('#pTabs'), stage = vis('#stage'), top = vis('#btnRestart'), time = vis('#timeCtl');
            const canvas = document.getElementById('lab').getBoundingClientRect();
            const small = [...document.querySelectorAll('#panel button, .topbar button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 30 || r.width < 30); }).map((b) => b.textContent.trim());
            return { tabs, stage, top, time, cw: canvas.width, small };
          });
          assert(ok.tabs && ok.stage && ok.top && ok.time, `${w}×${h} ${lab}: ${JSON.stringify(ok)}`);
          assert(ok.small.length === 0, `${w}×${h} ${lab}: zu kleine Schaltflächen ${ok.small.join(', ')}`);
          out.push(`${w}×${h}/${lab}: Bühne ${Math.round(ok.cw)} px`);
          await T.shot(`v03-${w}x${h}-${lab}`);
        }
      }
      await T.click('#btnPanel'); await sleep(300);
      const wide = await T.page.locator('#stage').boundingBox();
      assert(wide.width > 1000, 'eingeklappt: Bühne breiter');
      await T.shot('v03-1024x768-bedienfeld-eingeklappt');
      await T.click('#btnPanel');
      return out.join('; ');
    }, { width: 1440, height: 900 });

    await scenario(browser, 'E-21d', 'V-04 Tastatur: Bedienung ohne Maus (Tab/Enter/Leertaste)', async (T) => {
      await T.lab('classic'); await T.task('K-02');
      await T.page.focus('[data-act="sel"][data-id="B1"]');
      await T.page.keyboard.press('Enter'); await sleep(250);
      assert((await T.st(() => window.Trennlabor.ui.ui.selected.classic)) === 'B1', 'Enter wählt');
      await T.page.focus('[data-act="tool"][data-tool="water"][data-to="B1"]');
      await T.page.keyboard.press('Space'); await sleep(300);
      await T.until(() => window.Trennlabor.session.engine().describe('B1').water > 1);
      const focused = await T.page.evaluate(() => document.activeElement && document.activeElement.dataset.act);
      assert(focused, 'Fokus bleibt nach Neuaufbau des Bedienfelds erhalten');
      await T.page.keyboard.press('Tab');
      const ring = await T.page.evaluate(() => getComputedStyle(document.activeElement, ':focus-visible').outlineStyle || 'auto');
      void ring;
      return 'Auswahl mit Enter, Wasserzugabe mit Leertaste, Fokus erhalten';
    });

    await scenario(browser, 'E-21e', 'A-05 optional: Ziehen (Drag-and-drop) als Alternative zum Antippen', async (T) => {
      await T.lab('classic'); await T.task('K-01'); await T.speed(10);
      await T.until(() => window.Trennlabor.session.engine().state.t > 150);
      await T.dragStage('B1', 'B2');
      await T.idle();
      const w = await T.st(() => window.Trennlabor.session.engine().describe('B2').water);
      assert(w > 80, 'Ziehen auf Becherglas 2 gießt vorsichtig ab');
      await T.dragStage('B3', 'slot:filter'); await T.idle();
      const place = await T.st(() => window.Trennlabor.session.engine().state.vessels.B3.place);
      assert(place === 'filter', 'Ziehen unter den Trichter stellt um');
      return 'Ausgießen und Umstellen per Ziehen';
    });

    await scenario(browser, 'E-22a', 'A-04 Zeitraffer/Pause: Pause hält an; 1× und 10× führen zum gleichen Modellzustand', async (T) => {
      await T.lab('classic'); await T.task('K-02');
      await T.click('[data-speed="pause"]');
      const t0 = await T.st(() => window.Trennlabor.session.engine().state.t);
      await sleep(600);
      const t1 = await T.st(() => window.Trennlabor.session.engine().state.t);
      assert(t1 === t0, 'Pause');
      const label = await T.page.locator('#lapse').innerText();
      assert(/×6/.test(label) || label === '', 'Zeitraffer angezeigt');
      // gleicher Ablauf: gleiche Simulationszeit, zwei Geschwindigkeiten (über die Oberfläche)
      const res = [];
      for (const sp of [1, 10]) {
        await T.click('#btnRestart'); await T.click('[data-act="resetExp"]');
        await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="wamt"][data-amt="25"]');
        await T.click('[data-act="tool"][data-tool="water"][data-to="B1"]');
        await T.click(`[data-speed="${sp}"]`);
        await T.until(() => window.Trennlabor.session.engine().state.t >= 60, null, 60000);
        await T.click('[data-speed="pause"]');
        res.push(await T.st(() => { const e = window.Trennlabor.session.engine(); return { t: e.state.t, salt: e.describe('B1').salt }; }));
      }
      // Ergebnis darf nur von der Simulationszeit abhängen
      const solAt = await T.st((ts) => {
        const TL = window.Trennlabor.TL;
        return ts.map((t) => { const e = TL.tasks.classic.TASKS[1].createEngine(); e.addWater('B1', 25); e.advance(t); return e.describe('B1').salt; });
      }, res.map((r) => r.t));
      for (let i = 0; i < 2; i++) assert(Math.abs(res[i].salt - solAt[i]) < 1e-9, 'Zustand = Modell bei gleicher Simulationszeit');
      return `1×: ${res[0].salt.toFixed(3)} g gelöst bei ${res[0].t.toFixed(2)} s; 10×: ${res[1].salt.toFixed(3)} g bei ${res[1].t.toFixed(2)} s – jeweils identisch mit dem Modell`;
    });

    await scenario(browser, 'E-22b', 'Persistenz und Offline: offline bedienbar; Neuladen in derselben Sitzung erhält den Versuch', async (T) => {
      await T.lab('classic'); await T.task('K-02'); await T.speed(10);
      await T.click('[data-act="sel"][data-id="B1"]'); await T.click('[data-act="tool"][data-tool="water"][data-to="B1"]'); await T.idle();
      // offline weiterarbeiten: keine Netzanfragen nötig
      await T.ctx.setOffline(true);
      await T.click('[data-act="stir"][data-id="B1"]'); await T.idle();
      await T.click('[data-act="tab"][data-tab="eval"]');
      await T.ctx.setOffline(false);
      await sleep(2300);
      // ohne ?neu laden (der Parameter beginnt bewusst eine frische Sitzung)
      await T.page.goto(BASE.replace('?neu', ''));
      await T.page.waitForFunction(() => window.Trennlabor && window.Trennlabor.session.state.lab === 'classic');
      const w = await T.st(() => window.Trennlabor.session.engine().describe('B1').water);
      assert(w > 20, 'Versuchszustand erhalten: ' + w);
      const tab = await T.st(() => window.Trennlabor.ui.ui.tab);
      assert(tab === 'eval', 'geöffneter Reiter erhalten');
      return `offline weitergearbeitet; nach Neuladen: ${w.toFixed(0)} mL Wasser in Becherglas 1, Reiter erhalten`;
    });
  }

  await browser.close();
  server.close();
  const failed = results.filter((r) => r.status !== 'PASS').length;
  fs.writeFileSync(RESULTS, JSON.stringify({ date: new Date().toISOString(), browser: 'Chromium ' + ver, root: path.relative(APP, ROOT) || '.', smoke: SMOKE, passed: results.length - failed, failed, results }, null, 2));
  console.log(`\n${results.length - failed} bestanden, ${failed} fehlgeschlagen. Ergebnisse: ${path.relative(APP, RESULTS)}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
