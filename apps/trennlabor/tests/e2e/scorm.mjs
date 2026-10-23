// Prüft das fertige SCORM-1.2-Paket mit einem simulierten LMS (Moodle-ähnliche API 1.2).
// Das ZIP wird direkt gelesen und aus dem Speicher ausgeliefert – geprüft wird also
// die tatsächlich gepackte Datei, nicht der Quellcode.
// Geprüft: Manifest, Start im iframe und im neuen Fenster, LMSInitialize/LMSFinish,
// keine Datenübertragung, Kernversuche aller drei Labore bedienbar, keine Fehler.
// Zusätzlich: Web-ZIP enthält dieselben Laufzeitdateien mit relativen Pfaden.
// Aufruf: npm run package && node tests/e2e/scorm.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const version = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
const ZIP = path.join(APP, 'release', `trennlabor-${version}-scorm12.zip`);
const WEBZIP = path.join(APP, 'release', `trennlabor-${version}-web.zip`);
const PORT = Number(process.env.SCORM_PORT || 8151);
const SHOTS = path.join(APP, 'docs/screenshots');

function unzip(buf) {
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
    files.set(name, method === 8 ? zlib.inflateRawSync(raw) : raw);
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const LMS_PAGE = (mode) => `<!doctype html><meta charset="utf-8"><title>Mock-LMS</title>
<script>
  window.calls = [];
  window.API = {
    LMSInitialize: (a) => { calls.push(['LMSInitialize', a]); return 'true'; },
    LMSFinish: (a) => { calls.push(['LMSFinish', a]); return 'true'; },
    LMSGetValue: (k) => { calls.push(['LMSGetValue', k]); return ''; },
    LMSSetValue: (k, v) => { calls.push(['LMSSetValue', k, v]); return 'true'; },
    LMSCommit: (a) => { calls.push(['LMSCommit', a]); return 'true'; },
    LMSGetLastError: () => '0', LMSGetErrorString: () => '', LMSGetDiagnostic: () => ''
  };
</script>
<body style="margin:0;background:#ccd">
<div style="padding:6px 12px;font:14px system-ui">Mock-LMS · SCORM 1.2 · ${mode === 'iframe' ? 'eingebettet' : 'neues Fenster'}</div>
${mode === 'iframe' ? '<iframe id="sco" src="/pkg/index.html" style="width:1400px;height:860px;border:0"></iframe>' : '<button id="open" onclick="window.win = window.open(\'/pkg/index.html\', \'sco\', \'width=1400,height=900\')">Starten</button>'}`;

const results = [];
const check = (id, ok, detail) => { results.push({ id, status: ok ? 'PASS' : 'FAIL', detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} – ${detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const files = unzip(fs.readFileSync(ZIP));
const manifest = files.get('imsmanifest.xml')?.toString('utf8') || '';
const listed = [...manifest.matchAll(/<file href="([^"]+)"\/>/g)].map((m) => m[1]).sort();
const inZip = [...files.keys()].filter((f) => f !== 'imsmanifest.xml').sort();
check('SCORM-1', !!manifest && /<schemaversion>1\.2<\/schemaversion>/.test(manifest) && /adlcp:scormtype="sco"/.test(manifest) && /href="index.html"/.test(manifest) && files.has('index.html'),
  'imsmanifest.xml im Paketstamm, SCORM 1.2, SCO mit Startpunkt index.html');
check('SCORM-2', JSON.stringify(listed) === JSON.stringify(inZip), `Manifest listet alle ${inZip.length} Dateien des Pakets`);
const html = files.get('index.html').toString('utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('data:'));
check('SCORM-3', refs.every((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith('/') && files.has(r)) && ![...files.values()].some((b) => /(src|href)\s*=\s*["'](https?:)?\/\//i.test(b.toString('utf8'))),
  `alle ${refs.length} Verweise in index.html relativ und im Paket vorhanden, keine externen Ressourcen`);
const web = unzip(fs.readFileSync(WEBZIP));
const webNames = [...web.keys()].map((n) => n.replace(/^trennlabor\//, '')).sort();
check('WEB-1', JSON.stringify(webNames) === JSON.stringify(inZip) && [...web.keys()].every((n) => n.startsWith('trennlabor/')), `Web-ZIP enthält dieselben ${webNames.length} Laufzeitdateien im Ordner trennlabor/`);

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; } // Symbol des Mock-LMS, nicht Teil des Pakets
  if (u.pathname === '/lms-iframe.html' || u.pathname === '/lms-popup.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(LMS_PAGE(u.pathname.includes('iframe') ? 'iframe' : 'popup')); return;
  }
  const name = decodeURIComponent(u.pathname.replace(/^\/pkg\//, ''));
  const data = files.get(name);
  if (!u.pathname.startsWith('/pkg/') || !data) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' }[path.extname(name)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type }); res.end(data);
});
await new Promise((r) => server.listen(PORT, r));
const CHANNEL = process.env.PW_CHANNEL || '';
const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});

/** Kernversuche über die Oberfläche: je ein Labor kurz bedienen. */
async function runExperiments(frame) {
  await frame.waitForFunction(() => window.Trennlabor && window.Trennlabor.ui);
  const idle = () => frame.waitForFunction(() => !window.Trennlabor.ui.curEngine().state.op, null, { timeout: 30000 });
  const click = async (sel) => { await frame.locator(sel).first().click(); await sleep(50); await idle(); };
  const until = (src) => frame.waitForFunction(src, null, { timeout: 90000, polling: 100 });
  const out = {};
  // A: K-01 dekantieren
  await click('[data-open="classic"]');
  await click('#speed [data-speed="50"]');
  await until('window.Trennlabor.ui.curEngine().describe(window.Trennlabor.ui.curEngine().vessel("A").c).suspended < 0.03');
  await click('#controls [data-a="select"][data-id="A"]');
  await click('#controls [data-a="pour"][data-mode="careful"]');
  await click('#controls [data-a="target"][data-id="B"]');
  await click('#evalCard [data-check]');
  out.classic = /Versuch gelungen/.test(await frame.locator('#evalCard').innerText());
  // B: Chromatogramm entwickeln
  await click('#labSwitch [data-lab="chroma"]');
  await click('#controls [data-a="line"]');
  await click('#controls [data-a="sample"][data-v="gruen"]');
  await click('#controls [data-a="spot"][data-v="0"]');
  await click('#controls [data-a="fill"]');
  await click('#controls [data-a="lid"]');
  await click('#controls [data-a="insert"]');
  await until('(() => { const p = window.Trennlabor.ui.curEngine().state.paper; return p.front - p.line.y > 5; })()');
  await click('#controls [data-a="remove"]');
  out.chroma = await frame.evaluate(() => window.Trennlabor.ui.curEngine().zones(0).length === 2);
  // C: Destillation bis zum ersten Destillat
  await click('#labSwitch [data-lab="distill"]');
  for (const p of ['heater', 'flask', 'chips']) await click(`#controls [data-a="mount"][data-p="${p}"]`);
  await click('#controls [data-a="fill"][data-v="100"]');
  await click('#controls [data-a="mount"][data-p="head"]');
  await click('#controls [data-a="thermo"][data-v="vapor"]');
  await click('#controls [data-a="mount"][data-p="condenser"]');
  await click('#controls [data-a="hoses"][data-v="correct"]');
  for (const p of ['adapter', 'receiver', 'clamps']) await click(`#controls [data-a="mount"][data-p="${p}"]`);
  await click('#controls [data-a="cool"][data-v="2"]');
  await click('#controls [data-a="heat"][data-v="3"]');
  await until('window.Trennlabor.ui.curEngine().distillate().vol > 1');
  out.distill = true;
  return out;
}

// 1) eingebettet im Kursfenster (iframe)
{
  const page = await browser.newPage({ viewport: { width: 1420, height: 920 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/lms-iframe.html`);
  const frame = await (await page.waitForSelector('#sco')).contentFrame();
  const out = await runExperiments(frame);
  const scorm = await frame.evaluate(() => window.TL.scorm.state);
  await page.screenshot({ path: path.join(SHOTS, '60-scorm-im-mock-lms.png') });
  await page.evaluate(() => { document.getElementById('sco').src = 'about:blank'; });
  await sleep(500);
  const names = (await page.evaluate(() => window.calls)).map((c) => c[0]);
  check('SCORM-4', scorm.available && scorm.initialized && names[0] === 'LMSInitialize', 'iframe: API gefunden, LMSInitialize erfolgreich');
  check('SCORM-5', out.classic && out.chroma && out.distill && errors.length === 0, `iframe: alle drei Labore bedienbar (K-01 gelöst, Grün in 2 Zonen, Destillat), ${errors.length} Laufzeitfehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  check('SCORM-6', names.filter((n) => n === 'LMSFinish').length === 1, 'iframe: LMSFinish genau einmal beim Verlassen');
  check('SCORM-7', !names.some((n) => n === 'LMSSetValue' || n === 'LMSGetValue'), 'iframe: keine Noten, Fortschritte oder personenbezogenen Daten (Aufrufe: ' + names.join(', ') + ')');
  await page.close();
}
// 2) „Neues Fenster“ (in mebis bevorzugt): API liegt im öffnenden Fenster
{
  const page = await browser.newPage();
  const errors = [];
  await page.goto(`http://localhost:${PORT}/lms-popup.html`);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#open')]);
  popup.on('pageerror', (e) => errors.push(e.message));
  await popup.waitForLoadState();
  await popup.setViewportSize({ width: 1366, height: 900 });
  const out = await runExperiments(popup);
  const scorm = await popup.evaluate(() => window.TL.scorm.state);
  await popup.close({ runBeforeUnload: true });
  await sleep(500);
  const names = (await page.evaluate(() => window.calls)).map((c) => c[0]);
  check('SCORM-8', scorm.initialized && out.classic && out.chroma && out.distill && errors.length === 0 && names.includes('LMSFinish') && !names.includes('LMSSetValue'),
    'neues Fenster: API über window.opener gefunden, alle Labore bedienbar, LMSFinish beim Schließen, keine Datenübertragung');
  await page.close();
}
// 3) ohne LMS (Webserver/file://): Adapter bleibt inaktiv
{
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/pkg/index.html`);
  await page.waitForFunction(() => window.Trennlabor);
  const st = await page.evaluate(() => window.TL.scorm.state);
  check('SCORM-9', !st.available && !st.initialized && errors.length === 0, 'ohne LMS: Adapter inaktiv, App läuft normal');
  await page.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => r.status === 'FAIL').length;
fs.writeFileSync(path.join(HERE, 'scorm-results.json'), JSON.stringify({ date: new Date().toISOString(), package: path.basename(ZIP), browser: CHANNEL || 'chromium', passed: results.length - failed, failed, results }, null, 2));
console.log(`\n${results.length - failed} bestanden, ${failed} fehlgeschlagen. Ergebnisse: tests/e2e/scorm-results.json`);
process.exit(failed ? 1 : 0);
