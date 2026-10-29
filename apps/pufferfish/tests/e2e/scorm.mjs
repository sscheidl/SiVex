// Prüft die ausgelieferten Pakete: Beide ZIPs werden frisch in leere Temp-Ordner entpackt
// und über HTTP gestartet – SCORM 1.2 im simulierten LMS (eingebettet und neues Fenster),
// das Web-ZIP direkt per HTTP und zusätzlich per file://. Jeweils mit echter Laborbedienung.
// Kein Zugriff auf den Quellcodeordner. Aufbau nach apps/destillation/tests/e2e/scorm.mjs.
// Aufruf: npm run package && node tests/e2e/scorm.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { APP, SHOTS, launch, sleep } from './lib.mjs';

const version = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
const ZIP = path.join(APP, 'release', `pufferfish-${version}-scorm12.zip`);
const WEBZIP = path.join(APP, 'release', `pufferfish-${version}-web.zip`);
const PORT = Number(process.env.SCORM_PORT || 8173);
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
function extract(files, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const [n, b] of files) { if (n.includes('..')) throw new Error('ungültiger Pfad im ZIP'); const f = path.join(dir, n); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); }
  return dir;
}

// ------------------------------------------------------------------ statische Prüfungen
const files = unzip(fs.readFileSync(ZIP));
const manifest = files.get('imsmanifest.xml')?.toString('utf8') || '';
const listed = [...manifest.matchAll(/<file href="([^"]+)"\/>/g)].map((m) => m[1]).sort();
const inZip = [...files.keys()].filter((f) => f !== 'imsmanifest.xml').sort();
check('SCORM-1', !!manifest && /<schemaversion>1\.2<\/schemaversion>/.test(manifest) && /adlcp:scormtype="sco"/.test(manifest) && /href="index.html"/.test(manifest) && files.has('index.html'), 'imsmanifest.xml im Paketstamm, SCORM 1.2, SCO mit Startpunkt index.html');
check('SCORM-2', JSON.stringify(listed) === JSON.stringify(inZip) && inZip.some((f) => f.startsWith('labkit/')), `Manifest listet alle ${inZip.length} Dateien des Pakets (inkl. labkit/)`);
const html = files.get('index.html').toString('utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('data:'));
check('SCORM-3', refs.every((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith('/') && files.has(r)) && ![...files.values()].some((b) => /(src|href)\s*=\s*["'](https?:)?\/\//i.test(b.toString('utf8'))), `alle ${refs.length} Verweise relativ und im Paket vorhanden, keine externen Ressourcen`);
const web = unzip(fs.readFileSync(WEBZIP));
const webNames = [...web.keys()].map((n) => n.replace(/^pufferfish\//, '')).sort();
check('WEB-1', JSON.stringify(webNames) === JSON.stringify(inZip) && [...web.keys()].every((n) => n.startsWith('pufferfish/')), `Web-ZIP enthält dieselben ${webNames.length} Laufzeitdateien im Ordner pufferfish/`);
const sums = fs.readFileSync(path.join(APP, 'release', 'SHA256SUMS.txt'), 'utf8');
check('PKG-1', sums.includes(path.basename(ZIP)) && sums.includes(path.basename(WEBZIP)), 'SHA256SUMS.txt nennt beide Pakete');

// ------------------------------------------------------------------ frisch entpacken, Mock-LMS über HTTP
const scoDir = extract(files, 'sivex-pufferfish-scorm-');
const webDir = extract(web, 'sivex-pufferfish-web-');
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
${mode === 'iframe' ? '<iframe id="sco" src="/sco/index.html" style="width:1400px;height:860px;border:0"></iframe>' : '<button id="open" onclick="window.win = window.open(\'/sco/index.html\', \'sco\', \'width=1400,height=900\')">Starten</button>'}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const served = [];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (u.pathname === '/lms-iframe.html' || u.pathname === '/lms-popup.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(LMS_PAGE(u.pathname.includes('iframe') ? 'iframe' : 'popup')); return; }
  const map = [['/sco/', scoDir], ['/web/', webDir]].find(([p]) => u.pathname.startsWith(p));
  if (!map) { res.writeHead(404); res.end(); return; }
  const file = path.normalize(path.join(map[1], decodeURIComponent(u.pathname.slice(map[0].length))));
  if (!file.startsWith(map[1]) || !fs.existsSync(file)) { res.writeHead(404); res.end(); served.push('404 ' + u.pathname); return; }
  served.push(u.pathname);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));
const browser = await launch();

/** Kurzer Versuch über die Oberfläche (ohne Vermutung): HCl wählen, ein Tropfen in beide Gläser, Messpunkte prüfen; Versuch 3 öffnen und messen. */
async function operate(frame) {
  await frame.waitForFunction(() => window.PF && window.PF.app);
  await frame.locator('#doseBar [data-reagent="HCl"]').click();
  await frame.locator('#btnGo').click();
  await frame.waitForFunction(() => { const A = window.PF.app; return !A.eng.busy() && A.eng.current().beakers.every((b) => b.records.length === 2 && !b.pending.length); }, null, { timeout: 30000 });
  const ph = await frame.evaluate(() => window.PF.app.eng.current().beakers.map((b) => b.records[1].pH));
  const ok1 = Math.abs(ph[0] - 3.779) < 0.002 && Math.abs(ph[1] - 7.197) < 0.002;
  // Versuch 3 (Pufferherstellung) im Paket: Ziel, System, Rechnung, 10 + 20 mL, Messung
  await frame.locator('#expChips [data-exp="e3"]').click();
  await frame.locator('[data-mixtarget="5.05"]').click();
  await frame.locator('input[data-mixsystem="ac"]').check();
  await frame.locator('[data-mixf="r"]').fill('2'); await frame.locator('[data-mixf="vb"]').fill('20'); await frame.locator('[data-mixf="va"]').fill('10');
  await frame.locator('[data-mixaction="check"]').click();
  await frame.locator('#doseBar [data-kind="m10"]').click();
  const idle = () => frame.waitForFunction(() => !window.PF.app.eng.busy(), null, { timeout: 60000 });
  await frame.locator('#doseBar [data-reagent="HAc"]').click(); await frame.locator('#btnGo').click(); await idle();
  await frame.locator('#doseBar [data-reagent="NaAc"]').click(); await frame.locator('#btnGo').click(); await idle();
  await frame.locator('#btnGo').click(); await idle();
  await frame.locator('#btnMeasure').click(); await idle();
  const m = await frame.evaluate(() => { const A = window.PF.app, b = A.eng.current().beakers[0]; return { V: b.comp.V, pH: A.eng.meter(b).pH }; });
  await frame.locator('#expChips [data-exp="e1"]').click();
  return ok1 && Math.abs(m.V - 30) < 1e-9 && Math.abs(m.pH - 5.05) < 0.05;
}
const watch = (pg, errors, external, allowFile) => { pg.on('pageerror', (e) => errors.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); pg.on('request', (r) => { const u = r.url(); if (!u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:') && !u.startsWith('blob:') && !(allowFile && u.startsWith('file:'))) external.push(u); }); };

for (const mode of ['iframe', 'popup']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [], external = [];
  watch(page, errors, external);
  await page.goto(`http://localhost:${PORT}/lms-${mode}.html`);
  let win = null, target;
  if (mode === 'iframe') {
    for (let i = 0; i < 50 && !page.frame({ url: /\/sco\/index\.html/ }); i++) await sleep(100);
    target = page.frame({ url: /\/sco\/index\.html/ });
  } else {
    [win] = await Promise.all([context.waitForEvent('page'), page.click('#open')]);
    watch(win, errors, external);
    await win.waitForLoadState();
    target = win;
  }
  const okRun = await operate(target);
  fs.mkdirSync(SHOTS, { recursive: true });
  await (mode === 'iframe' ? page : win).screenshot({ path: path.join(SHOTS, `50-scorm-${mode}.png`) });
  const callsBefore = await page.evaluate(() => window.calls.slice());
  let finalCalls = null;
  if (mode === 'popup') { await win.close(); await sleep(400); finalCalls = await page.evaluate(() => window.calls.slice()); }
  const label = mode === 'iframe' ? 'eingebettet' : 'neues Fenster';
  check(`SCORM-${mode}-1`, callsBefore.filter((c) => c[0] === 'LMSInitialize').length === 1, `${label}: LMSInitialize genau einmal`);
  check(`SCORM-${mode}-2`, okRun, `${label}: Versuche 1 und 3 über die Oberfläche bedient, Messwerte korrekt`);
  if (finalCalls) check(`SCORM-${mode}-3`, finalCalls.filter((c) => c[0] === 'LMSFinish').length === 1, 'neues Fenster: LMSFinish beim Schließen genau einmal');
  check(`SCORM-${mode}-4`, !callsBefore.some((c) => /LMS(Set|Get)Value|LMSCommit/.test(c[0])), 'keine Werte gelesen oder geschrieben (keine Noten, Antworten, Personendaten)');
  check(`SCORM-${mode}-5`, !errors.length && !external.length, `keine Konsolenfehler, keine externen Anfragen${errors.length ? ': ' + errors.join('; ') : ''}${external.length ? ': ' + external.join(', ') : ''}`);
  await context.close();
}

// ------------------------------------------------------------------ Web-ZIP über HTTP und per file://
for (const via of ['http', 'file']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [], external = [];
  watch(page, errors, external, via === 'file');
  await page.goto(via === 'http' ? `http://localhost:${PORT}/web/pufferfish/index.html` : pathToFileURL(path.join(webDir, 'pufferfish', 'index.html')).href);
  const ok = await operate(page);
  if (via === 'http') await page.screenshot({ path: path.join(SHOTS, '51-web-zip-http.png') });
  check(`WEB-${via}`, ok && !errors.length && !external.length, `frisch entpacktes Web-ZIP per ${via === 'http' ? 'HTTP' : 'file://'} bedienbar, Messwerte korrekt, keine Fehler, keine fremden Anfragen${errors.length ? ': ' + errors.join('; ') : ''}`);
  await context.close();
}
check('HTTP-404', !served.some((s) => s.startsWith('404') && !s.includes('favicon')), `alle Ressourcen aus den entpackten Paketen geladen (${served.length} Anfragen)`);

await browser.close();
server.close();
fs.rmSync(scoDir, { recursive: true, force: true }); fs.rmSync(webDir, { recursive: true, force: true });
const passed = results.filter((r) => r.status === 'PASS').length;
fs.writeFileSync(path.join(APP, 'tests/e2e/scorm-results.json'), JSON.stringify({ date: new Date().toISOString(), package: path.basename(ZIP), web: path.basename(WEBZIP), passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} Paketprüfungen bestanden`);
process.exit(passed === results.length ? 0 : 1);
