// Prüft das fertige SCORM-1.2-Paket mit einem simulierten LMS (Moodle-ähnliche API 1.2).
// Das ZIP wird direkt gelesen und aus dem Speicher ausgeliefert – geprüft wird
// also genau das, was in mebis hochgeladen würde.
// Geprüft: Manifest, Start eingebettet (iframe) und im neuen Fenster, LMSInitialize/
// LMSFinish, keine Datenübertragung, Kernversuche aller drei Labore über die
// Oberfläche, keine Laufzeitfehler und keine fehlenden Ressourcen.
// Aufruf: npm run package && node tests/e2e/scorm.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzip } from './zip.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const version = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
const ZIP = path.join(APP, 'release', `trennlabor-${version}-scorm12.zip`);
const PORT = 8141;

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
${mode === 'iframe' ? '<iframe id="sco" src="/pkg/index.html?neu" style="width:1400px;height:880px;border:0"></iframe>' : '<button id="open" onclick="window.win = window.open(\'/pkg/index.html?neu\', \'sco\', \'width=1400,height=900\')">Starten</button>'}`;

const results = [];
const check = (id, ok, detail) => { results.push({ id, status: ok ? 'PASS' : 'FAIL', detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} – ${detail}`); };

const files = unzip(fs.readFileSync(ZIP));
const manifest = files.get('imsmanifest.xml')?.toString('utf8') || '';
const listed = [...manifest.matchAll(/<file href="([^"]+)"\/>/g)].map((m) => m[1]).sort();
const inZip = [...files.keys()].filter((f) => f !== 'imsmanifest.xml').sort();
check('SCORM-1', !!manifest && /<schemaversion>1\.2<\/schemaversion>/.test(manifest) && /adlcp:scormtype="sco"/.test(manifest) && /href="index.html"/.test(manifest) && /<schema>ADL SCORM<\/schema>/.test(manifest),
  'imsmanifest.xml im Paketstamm, SCORM 1.2, SCO mit Startpunkt index.html');
check('SCORM-2', JSON.stringify(listed) === JSON.stringify(inZip) && inZip.includes('index.html'), `Manifest listet alle ${inZip.length} Dateien des Pakets`);
const html = files.get('index.html').toString('utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('data:'));
check('SCORM-3', refs.every((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith('/') && files.has(r)) && ![...files.values()].some((b) => /(src|href)\s*=\s*["'](https?:)?\/\//i.test(b.toString('utf8'))),
  `alle ${refs.length} Verweise relativ und im Paket vorhanden; keine externen Ressourcen`);

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

/** Kurzer Kernversuch je Labor über die Oberfläche (im Lernpaket). */
async function runExperiments(frame) {
  await frame.waitForFunction(() => window.Trennlabor && window.Trennlabor.session);
  const click = async (sel) => { await frame.locator(sel).first().click(); await sleep(60); };
  const idle = () => frame.waitForFunction(() => !window.Trennlabor.session.engine().busy(), null, { timeout: 60000 });
  // A: K-01 Sedimentieren und Dekantieren
  await click('.labcard[data-lab="classic"]'); await click('[data-speed="10"]');
  await frame.waitForFunction(() => window.Trennlabor.session.engine().state.t > 150, null, { timeout: 60000 });
  await click('[data-act="sel"][data-id="B1"]'); await click('[data-act="pour"][data-from="B1"][data-to="B2"]'); await idle();
  const a = await frame.evaluate(() => { const s = window.Trennlabor.session; return s.task().check(s.engine()).success; });
  // B: Chromatogramm
  await click('#labTabs [data-lab="chroma"]'); await click('[data-speed="10"]');
  await click('[data-act="cpaper"][data-type="sheet"]'); await click('[data-act="cline"]');
  await click('[data-act="pen"][data-pen="black"]'); await click('[data-act="spot"]');
  await click('[data-act="fill"]'); await click('[data-act="lid"]'); await click('[data-act="insertP"]');
  await frame.waitForFunction(() => window.Trennlabor.session.engine().state.paper.front > 10, null, { timeout: 60000 });
  await click('[data-act="removeP"]');
  const b = await frame.evaluate(() => { const e = window.Trennlabor.session.engine(); return e.evaluatePaper(e.state.paper).lanes[0].bands; });
  // C: Destillation bis zum ersten Destillat
  await click('#labTabs [data-lab="distill"]'); await click('[data-speed="10"]');
  for (const part of ['mantle', 'flask']) await click(`[data-act="dplace"][data-part="${part}"]`);
  for (let i = 0; i < 4; i++) await click('[data-act="dfill"]');
  await click('[data-act="dstones"]');
  for (const part of ['head', 'thermo', 'cooler', 'hoses', 'adapter', 'clamps']) await click(`[data-act="dplace"][data-part="${part}"]`);
  await click('[data-act="recv"][data-id="A"]'); await click('[data-act="cool"][data-level="2"]'); await click('[data-act="heat"][data-level="3"]');
  await frame.waitForFunction(() => { const r = window.Trennlabor.session.engine().state.receivers.A; return r.E + r.W > 3; }, null, { timeout: 90000 });
  const c = await frame.evaluate(() => window.Trennlabor.session.engine().state.firstDrop.read);
  return { a, b, c };
}

// 1) eingebettet im Kursfenster (iframe)
{
  const page = await browser.newPage({ viewport: { width: 1450, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`http://localhost:${PORT}/lms-iframe.html`);
  const frame = await (await page.waitForSelector('#sco')).contentFrame();
  const r = await runExperiments(frame);
  const scorm = await frame.evaluate(() => window.TL.scorm.state);
  await page.screenshot({ path: path.join(APP, 'docs/screenshots/scorm-01-im-mock-lms.png') });
  await page.evaluate(() => { document.getElementById('sco').src = 'about:blank'; });
  await sleep(500);
  const names = (await page.evaluate(() => window.calls)).map((c) => c[0]);
  check('SCORM-4', scorm.available && scorm.initialized && names[0] === 'LMSInitialize', 'iframe: API gefunden, LMSInitialize erfolgreich');
  check('SCORM-5', r.a && r.b === 3 && r.c > 82 && r.c < 86 && errors.length === 0, `iframe: K-01 gelöst, Chromatogramm Schwarz mit ${r.b} Zonen, erster Destillattropfen bei ${r.c} °C; ${errors.length} Fehler ${errors.join(' | ')}`);
  check('SCORM-6', names.filter((n) => n === 'LMSFinish').length === 1, 'iframe: LMSFinish genau einmal beim Verlassen');
  check('SCORM-7', !names.some((n) => n === 'LMSSetValue' || n === 'LMSGetValue' || n === 'LMSCommit'), 'iframe: keine Noten, Fortschritte oder personenbezogenen Daten (Aufrufe: ' + names.join(', ') + ')');
  await page.close();
}
// 2) „Neues Fenster“ (in mebis bevorzugt): API im öffnenden Fenster
{
  const page = await browser.newPage();
  const errors = [];
  await page.goto(`http://localhost:${PORT}/lms-popup.html`);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#open')]);
  popup.on('pageerror', (e) => errors.push(e.message));
  await popup.waitForLoadState();
  await popup.setViewportSize({ width: 1400, height: 900 });
  const r = await runExperiments(popup);
  const scorm = await popup.evaluate(() => window.TL.scorm.state);
  await popup.screenshot({ path: path.join(APP, 'docs/screenshots/scorm-02-neues-fenster.png') });
  await popup.close({ runBeforeUnload: true });
  await sleep(500);
  const names = (await page.evaluate(() => window.calls)).map((c) => c[0]);
  check('SCORM-8', scorm.initialized && r.a && r.b === 3 && errors.length === 0 && names.includes('LMSFinish') && !names.includes('LMSSetValue'),
    'neues Fenster: API über window.opener, alle drei Kernversuche, LMSFinish beim Schließen, keine Datenübertragung');
  await page.close();
}
// 3) ohne LMS: Adapter bleibt inaktiv
{
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/pkg/index.html?neu`);
  await page.waitForFunction(() => window.Trennlabor);
  const st = await page.evaluate(() => window.TL.scorm.state);
  check('SCORM-9', !st.available && !st.initialized && errors.length === 0, 'ohne LMS: Adapter inaktiv, App läuft normal');
  await page.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => r.status === 'FAIL').length;
fs.writeFileSync(path.join(HERE, 'scorm-results.json'), JSON.stringify({ date: new Date().toISOString(), package: path.basename(ZIP), passed: results.length - failed, failed, results }, null, 2));
console.log(`\n${results.length - failed} bestanden, ${failed} fehlgeschlagen. Ergebnisse: tests/e2e/scorm-results.json`);
process.exit(failed ? 1 : 0);
