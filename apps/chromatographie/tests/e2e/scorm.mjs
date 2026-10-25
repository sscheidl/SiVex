// Prüft die ausgelieferten Pakete: SCORM-1.2-ZIP im simulierten LMS (eingebettet und
// neues Fenster) und das entpackte Web-ZIP per file:// – jeweils mit echter Laborbedienung.
// Die ZIP-Dateien werden direkt gelesen; geprüft wird also, was ausgeliefert wird.
// Aufruf: npm run package && node tests/e2e/scorm.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { APP, SHOTS, launch, sleep, assert } from './lib.mjs';

const version = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
const ZIP = path.join(APP, 'release', `chromatographie-${version}-scorm12.zip`);
const WEBZIP = path.join(APP, 'release', `chromatographie-${version}-web.zip`);
const PORT = Number(process.env.SCORM_PORT || 8151);
const results = [];
const check = (id, ok, detail) => { results.push({ id, status: ok ? 'PASS' : 'FAIL', detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} – ${detail}`); };

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
<div style="padding:6px 12px;font:14px system-ui">Mock-LMS · SCORM 1.2 · ${mode === 'iframe' ? 'eingebettet' : 'neues Fenster'} · <a href="/blank.html" id="leave">Kurs verlassen</a></div>
${mode === 'iframe' ? '<iframe id="sco" src="/pkg/index.html" style="width:1400px;height:860px;border:0"></iframe>' : '<button id="open" onclick="window.win = window.open(\'/pkg/index.html\', \'sco\', \'width=1400,height=900\')">Starten</button>'}`;

// ------------------------------------------------------------------ statische Prüfungen
const files = unzip(fs.readFileSync(ZIP));
const manifest = files.get('imsmanifest.xml')?.toString('utf8') || '';
const listed = [...manifest.matchAll(/<file href="([^"]+)"\/>/g)].map((m) => m[1]).sort();
const inZip = [...files.keys()].filter((f) => f !== 'imsmanifest.xml').sort();
check('SCORM-1', !!manifest && /<schemaversion>1\.2<\/schemaversion>/.test(manifest) && /adlcp:scormtype="sco"/.test(manifest) && /href="index.html"/.test(manifest) && files.has('index.html'),
  'imsmanifest.xml im Paketstamm, SCORM 1.2, SCO mit Startpunkt index.html');
check('SCORM-2', JSON.stringify(listed) === JSON.stringify(inZip) && inZip.some((f) => f.startsWith('labkit/')), `Manifest listet alle ${inZip.length} Dateien des Pakets (inkl. labkit/)`);
const html = files.get('index.html').toString('utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('data:'));
check('SCORM-3', refs.every((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith('/') && files.has(r)) && ![...files.values()].some((b) => /(src|href)\s*=\s*["'](https?:)?\/\//i.test(b.toString('utf8'))),
  `alle ${refs.length} Verweise relativ und im Paket vorhanden, keine externen Ressourcen`);
const web = unzip(fs.readFileSync(WEBZIP));
const webNames = [...web.keys()].map((n) => n.replace(/^chromatographie\//, '')).sort();
check('WEB-1', JSON.stringify(webNames) === JSON.stringify(inZip) && [...web.keys()].every((n) => n.startsWith('chromatographie/')), `Web-ZIP enthält dieselben ${webNames.length} Laufzeitdateien im Ordner chromatographie/`);
const distSame = inZip.every((f) => { const d = path.join(APP, 'dist/chromatographie', f); return fs.existsSync(d) && fs.readFileSync(d).equals(files.get(f)); });
check('PKG-1', distSame, 'Paketinhalt byte-identisch mit dem getesteten Build dist/chromatographie');

// ------------------------------------------------------------------ Mock-LMS
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (u.pathname === '/lms-iframe.html' || u.pathname === '/lms-popup.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(LMS_PAGE(u.pathname.includes('iframe') ? 'iframe' : 'popup')); return; }
  if (u.pathname === '/blank.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>Kurs</title>Kurs'); return; }
  if (u.pathname.startsWith('/pkg/')) {
    const f = files.get(decodeURIComponent(u.pathname.slice(5)));
    if (!f) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(u.pathname)] || 'application/octet-stream' }); res.end(f); return;
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(PORT, r));
const browser = await launch();

/** Kurzer Versuch im Paket über die Oberfläche: Schwarz + Blau mit Wasser, Ergebnis prüfen. */
async function operate(frame) {
  const tap = async (id) => { await frame.waitForFunction(() => !window.PC.app.engine.state.op); await frame.locator(`[data-hit="${id}"]`).click(); };
  await frame.waitForFunction(() => window.PC && window.PC.app);
  await frame.locator('#speed [data-speed="30"]').click();
  await tap('pencil');
  await tap('pen:schwarz'); await tap('lane:0'); await tap('pen:schwarz');
  await tap('pen:blau'); await tap('lane:1'); await tap('pen:blau');
  await tap('bottle:water');
  await tap('chamber');
  await frame.waitForFunction(() => window.PC.app.engine.state.paper.front >= 8, null, { timeout: 120000 });
  await tap('chamber');
  await frame.waitForFunction(() => !window.PC.app.engine.state.op);
  await frame.locator('#btnCheck').click();
  return /Ergebnis belegt/.test(await frame.locator('#panelBody').innerText());
}

for (const mode of ['iframe', 'popup']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [], external = [];
  const watch = (pg) => { pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); pg.on('request', (r) => { if (!r.url().startsWith(`http://localhost:${PORT}/`) && !r.url().startsWith('data:')) external.push(r.url()); }); };
  watch(page);
  await page.goto(`http://localhost:${PORT}/lms-${mode}.html`);
  let win = null, target;
  if (mode === 'iframe') {
    await page.waitForSelector('#sco');
    for (let i = 0; i < 50 && !page.frame({ url: /\/pkg\/index\.html/ }); i++) await sleep(100);
    target = page.frame({ url: /\/pkg\/index\.html/ });
  } else {
    [win] = await Promise.all([context.waitForEvent('page'), page.click('#open')]);
    watch(win);
    await win.waitForLoadState();
    target = win;
  }
  const okRun = await operate(target);
  await (mode === 'iframe' ? page : win).screenshot({ path: path.join(SHOTS, `50-scorm-${mode}.png`) });
  const callsBefore = await page.evaluate(() => window.calls.slice());
  let finalCalls = null;
  if (mode === 'popup') { await win.close(); await sleep(400); finalCalls = await page.evaluate(() => window.calls.slice()); }
  const init = callsBefore.filter((c) => c[0] === 'LMSInitialize').length;
  check(`SCORM-${mode}-1`, init === 1, `${mode === 'iframe' ? 'eingebettet' : 'neues Fenster'}: LMSInitialize genau einmal`);
  check(`SCORM-${mode}-2`, okRun, `${mode === 'iframe' ? 'eingebettet' : 'neues Fenster'}: Versuch über die Oberfläche bedient, Aufgabe A belegt`);
  if (finalCalls) check(`SCORM-${mode}-3`, finalCalls.filter((c) => c[0] === 'LMSFinish').length === 1, 'neues Fenster: LMSFinish beim Schließen genau einmal');
  check(`SCORM-${mode}-4`, !callsBefore.some((c) => /LMS(Set|Get)Value|LMSCommit/.test(c[0])), 'keine Werte gelesen oder geschrieben (keine Noten, Antworten, Personendaten)');
  check(`SCORM-${mode}-5`, !errors.length && !external.length, `keine Konsolenfehler, keine externen Anfragen${errors.length ? ': ' + errors.join('; ') : ''}`);
  await context.close();
}
// LMSFinish im eingebetteten Fall: Verlassen der Kursseite beendet die Sitzung
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/lms-iframe.html`);
  for (let i = 0; i < 50 && !page.frame({ url: /\/pkg\/index\.html/ }); i++) await sleep(100);
  await page.frame({ url: /\/pkg\/index\.html/ }).waitForFunction(() => window.PC && window.PC.app);
  const calls = await page.evaluate(async () => { document.querySelector('#sco').remove(); await new Promise((r) => setTimeout(r, 300)); return window.calls; });
  check('SCORM-iframe-3', calls.filter((c) => c[0] === 'LMSFinish').length === 1, 'eingebettet: LMSFinish beim Entfernen des Lernpakets genau einmal');
  await context.close();
}

// ------------------------------------------------------------------ Web-ZIP per file://
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sivex-chroma-web-'));
  for (const [n, b] of web) { const f = path.join(dir, n); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); }
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [], foreign = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) foreign.push(r.url()); });
  await page.goto(pathToFileURL(path.join(dir, 'chromatographie', 'index.html')).href);
  const ok = await operate(page);
  await page.screenshot({ path: path.join(SHOTS, '51-web-zip-file.png') });
  check('WEB-2', ok && !errors.length && !foreign.length, `entpacktes Web-ZIP per file:// bedienbar, Aufgabe A belegt, keine Fehler, keine Netzanfragen${errors.length ? ': ' + errors.join('; ') : ''}`);
  await context.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

await browser.close();
server.close();
const passed = results.filter((r) => r.status === 'PASS').length;
fs.writeFileSync(path.join(APP, 'tests/e2e/scorm-results.json'), JSON.stringify({ date: new Date().toISOString(), package: path.basename(ZIP), web: path.basename(WEBZIP), passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} Paketprüfungen bestanden`);
process.exit(passed === results.length ? 0 : 1);
