// Prüft das SCORM-1.2-Paket mit einem simulierten LMS (Moodle-ähnliche API 1.2).
// Das ZIP wird direkt gelesen und aus dem Speicher ausgeliefert.
// Geprüft: Manifest, Start in iframe und in neuem Fenster, LMSInitialize/LMSFinish,
// keine Datenübertragung (LMSSetValue/LMSGetValue), Kernversuch läuft, keine Fehler.
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
const ZIP = path.join(APP, 'release', `redoxlabor-${version}-scorm12.zip`);
const PORT = 8131;

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
${mode === 'iframe' ? '<iframe id="sco" src="/pkg/index.html?noIntro" style="width:1400px;height:900px;border:0"></iframe>' : '<button id="open" onclick="window.win = window.open(\'/pkg/index.html?noIntro\', \'sco\', \'width=1400,height=900\')">Starten</button>'}`;

const results = [];
const check = (id, ok, detail) => { results.push({ id, status: ok ? 'PASS' : 'FAIL', detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} – ${detail}`); };

const files = unzip(fs.readFileSync(ZIP));
const manifest = files.get('imsmanifest.xml')?.toString('utf8') || '';
const listed = [...manifest.matchAll(/<file href="([^"]+)"\/>/g)].map((m) => m[1]).sort();
const inZip = [...files.keys()].filter((f) => f !== 'imsmanifest.xml').sort();
check('SCORM-1', !!manifest && /<schemaversion>1\.2<\/schemaversion>/.test(manifest) && /adlcp:scormtype="sco"/.test(manifest) && /href="index.html"/.test(manifest),
  'imsmanifest.xml im Paketstamm, SCORM 1.2, SCO mit Startpunkt index.html');
check('SCORM-2', JSON.stringify(listed) === JSON.stringify(inZip), `Manifest listet alle ${inZip.length} Dateien des Pakets`);
check('SCORM-3', ![...files.values()].some((b) => /(src|href)\s*=\s*["'](https?:)?\/\//i.test(b.toString('utf8'))), 'keine externen Ressourcen im Paket');

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/lms-iframe.html' || u.pathname === '/lms-popup.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(LMS_PAGE(u.pathname.includes('iframe') ? 'iframe' : 'popup')); return;
  }
  const name = decodeURIComponent(u.pathname.replace(/^\/pkg\//, ''));
  const data = files.get(name);
  if (!u.pathname.startsWith('/pkg/') || !data) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(name)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type }); res.end(data);
});
await new Promise((r) => server.listen(PORT, r));
const CHANNEL = process.env.PW_CHANNEL || '';
const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runExperiment(frame) {
  // Kurzer Kernversuch im Lernpaket: Fehling-Probe mit Ethanal bis zur positiven Reaktion
  await frame.waitForFunction(() => window.RedoxLab && window.RedoxLab.lab);
  const idle = () => frame.waitForFunction(() => !window.RedoxLab.lab.busy());
  for (const sel of ['[data-hotplate="80"]', '[data-tube="1"]', '[data-reagent="fehling1"]', '[data-reagent="fehling2"]', '[data-action="shake"]', '[data-sample="ethanal"]', '[data-action="bath"]']) {
    await frame.click(sel); await sleep(50); await idle();
  }
  await frame.waitForFunction(() => window.RedoxLab.chem.isObservable(window.RedoxLab.lab.tubeById(1).contents), null, { timeout: 45000 });
  return frame.evaluate(() => window.RedoxLab.chem.classify(window.RedoxLab.lab.tubeById(1).contents).outcome);
}

// 1) eingebettet im Kursfenster (iframe)
{
  const page = await browser.newPage({ viewport: { width: 1450, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/lms-iframe.html`);
  const frame = page.frame({ url: /\/pkg\/index\.html/ }) || (await (await page.waitForSelector('#sco')).contentFrame());
  const outcome = await runExperiment(frame);
  const scorm = await frame.evaluate(() => window.RL.scorm.state);
  await page.evaluate(() => { document.getElementById('sco').src = 'about:blank'; });
  await sleep(500);
  const calls = await page.evaluate(() => window.calls);
  const names = calls.map((c) => c[0]);
  check('SCORM-4', scorm.available && scorm.initialized && names[0] === 'LMSInitialize', 'iframe: API gefunden, LMSInitialize erfolgreich');
  check('SCORM-5', outcome === 'positive' && errors.length === 0, `iframe: Fehling-Probe mit Ethanal positiv, ${errors.length} Laufzeitfehler`);
  check('SCORM-6', names.includes('LMSFinish') && names.filter((n) => n === 'LMSFinish').length === 1, 'iframe: LMSFinish genau einmal beim Verlassen');
  check('SCORM-7', !names.some((n) => n === 'LMSSetValue' || n === 'LMSGetValue'), 'iframe: keine Noten, Fortschritte oder personenbezogenen Daten gelesen/geschrieben (Aufrufe: ' + names.join(', ') + ')');
  await page.screenshot({ path: path.join(APP, 'docs/screenshots/17-scorm-im-mock-lms.png') });
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
  await popup.setViewportSize({ width: 1400, height: 900 });
  const outcome = await runExperiment(popup);
  const scorm = await popup.evaluate(() => window.RL.scorm.state);
  await popup.close({ runBeforeUnload: true });
  await sleep(500);
  const names = (await page.evaluate(() => window.calls)).map((c) => c[0]);
  check('SCORM-8', scorm.initialized && outcome === 'positive' && errors.length === 0 && names.includes('LMSFinish') && !names.includes('LMSSetValue'),
    'neues Fenster: API über window.opener gefunden, Versuch positiv, LMSFinish beim Schließen, keine Datenübertragung');
  await page.close();
}
// 3) ohne LMS (Webserver/file://): Adapter bleibt inaktiv
{
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/pkg/index.html?noIntro`);
  await page.waitForFunction(() => window.RedoxLab);
  const st = await page.evaluate(() => window.RL.scorm.state);
  check('SCORM-9', !st.available && !st.initialized && errors.length === 0, 'ohne LMS: Adapter inaktiv, App läuft normal');
  await page.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => r.status === 'FAIL').length;
fs.writeFileSync(path.join(HERE, 'scorm-results.json'), JSON.stringify({ date: new Date().toISOString(), package: path.basename(ZIP), passed: results.length - failed, failed, results }, null, 2));
console.log(`\n${results.length - failed} bestanden, ${failed} fehlgeschlagen. Ergebnisse: tests/e2e/scorm-results.json`);
process.exit(failed ? 1 : 0);
