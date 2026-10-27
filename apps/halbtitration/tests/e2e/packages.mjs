// Prüft die fertigen Release-Pakete: frisch entpacken, über einen lokalen
// HTTP-Server starten, Startpfade, Ressourcen, Konsole und Netzwerk kontrollieren.
// SCORM: Start in einem Rahmen mit Test-LMS (window.API); es dürfen keine
// Werte (Noten, Personendaten) geschrieben werden.
//
// Aufruf: npm run package && node tests/e2e/packages.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/serve.mjs';
import * as F from './flow.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const REL = path.join(APP, 'release');
const WORK = path.join(APP, '.work', 'pakete');
const PORT = 8125;
const { assert } = F;

const web = path.join(REL, `halbtitration-${pkg.version}-web.zip`);
const scorm = path.join(REL, `halbtitration-${pkg.version}-scorm12.zip`);
assert(fs.existsSync(web) && fs.existsSync(scorm), 'Pakete fehlen – zuerst npm run package');

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(path.join(WORK, 'web'), { recursive: true });
fs.mkdirSync(path.join(WORK, 'scorm'), { recursive: true });
/** Minimaler ZIP-Leser (zentrales Verzeichnis, Methoden 0 und 8) – unabhängig vom Packer und von Systemwerkzeugen */
function unzip(file, dest) {
  const buf = fs.readFileSync(file);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  assert(eocd >= 0, 'ZIP ohne Endsatz: ' + file);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    assert(buf.readUInt32LE(p) === 0x02014b50, 'Zentraler Eintrag beschädigt');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    assert(!name.includes('..') && !path.isAbsolute(name), 'Unsicherer Pfad im ZIP: ' + name);
    const lstart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(lstart, lstart + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    const out = path.join(dest, name);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (!name.endsWith('/')) fs.writeFileSync(out, data);
    p += 46 + nlen + xlen + clen;
  }
}
unzip(web, path.join(WORK, 'web'));
unzip(scorm, path.join(WORK, 'scorm'));

const results = [];
const walk = (d, b = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), b) : [path.relative(b, path.join(d, e.name)).split(path.sep).join('/')]));

// Struktur
const webFiles = walk(path.join(WORK, 'web'));
assert(webFiles.every((f) => f.startsWith('halbtitration/')), 'Web-ZIP: alle Dateien unter halbtitration/');
assert(webFiles.includes('halbtitration/index.html'), 'Web-ZIP: index.html fehlt');
const scFiles = walk(path.join(WORK, 'scorm'));
assert(scFiles.includes('imsmanifest.xml') && scFiles.includes('index.html'), 'SCORM: imsmanifest.xml oder index.html nicht im Stamm');
const manifest = fs.readFileSync(path.join(WORK, 'scorm', 'imsmanifest.xml'), 'utf8');
assert(/<schemaversion>1\.2<\/schemaversion>/.test(manifest), 'SCORM: Schema 1.2 fehlt');
assert(/adlcp:scormtype="sco" href="index.html"/.test(manifest), 'SCORM: Startpfad falsch');
const listed = [...manifest.matchAll(/<file href="([^"]+)"/g)].map((m) => m[1]);
const missing = listed.filter((f) => !fs.existsSync(path.join(WORK, 'scorm', f)));
assert(!missing.length, 'SCORM: im Manifest gelistet, aber nicht im Paket: ' + missing.join(', '));
const unlisted = scFiles.filter((f) => f !== 'imsmanifest.xml' && !listed.includes(f));
assert(!unlisted.length, 'SCORM: nicht im Manifest: ' + unlisted.join(', '));
results.push({ name: 'Paketstruktur', status: 'PASS', detail: { web: webFiles.length, scorm: scFiles.length, manifestFiles: listed.length } });

const browser = await chromium.launch({ channel: 'msedge' });

async function smoke(dir, url, label, wrapper) {
  const server = await serve(dir, PORT);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  page.on('request', (r) => { if (!r.url().startsWith(`http://localhost:${PORT}/`) && !/^(data|blob):/.test(r.url())) bad.push('extern ' + r.url()); });
  let frame = page;
  if (wrapper) {
    await page.route(`http://localhost:${PORT}/__lms.html`, (route) => route.fulfill({ contentType: 'text/html', body: wrapper }));
    await page.goto(`http://localhost:${PORT}/__lms.html`);
    await page.waitForFunction(() => document.querySelector('iframe').contentWindow.Halbtitration && document.querySelector('iframe').contentWindow.Halbtitration.App);
    frame = page.frames().find((f) => f.url().endsWith('index.html?speed=25'));
  } else {
    await page.goto(url);
  }
  await frame.evaluate(() => localStorage.clear());
  await frame.goto(frame.url());
  await F.plan(frame, { exp: 'glycine', titrant: 'NaOH', stage: 1, particle: 'ampholyte', eqCat: 'neutral', indicator: 'bromothymolBlue' });
  await frame.click('.phase[data-view="lab"]');
  await F.prepare(frame);
  await F.waitStable(frame);
  await F.act(frame, 'take');
  await F.doseAndTake(frame, 2);
  const n = await frame.evaluate(() => Halbtitration.App.activeSeries().points.length);
  assert(n === 2, label + ': Messung im entpackten Paket nicht möglich');
  await frame.click('.phase[data-view="eval"]');
  const lms = wrapper ? await page.evaluate(() => window.__lms) : null;
  await ctx.close();
  server.close();
  if (wrapper) {
    assert(lms.init >= 1, 'SCORM: LMSInitialize nicht aufgerufen');
    assert(lms.set.length === 0, 'SCORM: Werte an das LMS geschrieben: ' + JSON.stringify(lms.set));
  }
  const status = errors.length || bad.length ? 'HOLD – failed' : 'PASS';
  results.push({ name: label, status, errors, bad, lms });
  console.log(label, status, errors.concat(bad).join(' | '));
}

const LMS = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Test-LMS</title><script>
window.__lms = { init: 0, finish: 0, set: [], get: [] };
window.API = {
  LMSInitialize: function () { window.__lms.init++; return 'true'; },
  LMSFinish: function () { window.__lms.finish++; return 'true'; },
  LMSGetValue: function (k) { window.__lms.get.push(k); return ''; },
  LMSSetValue: function (k, v) { window.__lms.set.push([k, v]); return 'true'; },
  LMSCommit: function () { return 'true'; },
  LMSGetLastError: function () { return '0'; }, LMSGetErrorString: function () { return ''; }, LMSGetDiagnostic: function () { return ''; }
};
</script></head><body style="margin:0"><iframe src="index.html?speed=25" style="border:0;width:100vw;height:100vh"></iframe></body></html>`;

try {
  await smoke(path.join(WORK, 'web'), `http://localhost:${PORT}/halbtitration/index.html?speed=25`, 'Web-ZIP entpackt');
  await smoke(path.join(WORK, 'scorm'), null, 'SCORM-ZIP entpackt (Test-LMS)', LMS);
  // Start ohne Server (file://), wie bei „Web-ZIP entpacken und index.html öffnen“
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///' + path.join(WORK, 'web', 'halbtitration', 'index.html').split(path.sep).join('/'));
  const ok = await page.evaluate(() => !!(window.Halbtitration && window.Halbtitration.App && document.querySelector('#theoryDoc h1')));
  await ctx.close();
  results.push({ name: 'Web-ZIP per file://', status: ok && !errs.length ? 'PASS' : 'HOLD – failed', errors: errs });
  console.log('Web-ZIP per file://', ok && !errs.length ? 'PASS' : 'HOLD – failed', errs.join(' | '));
} catch (e) {
  results.push({ name: 'Paketstart', status: 'HOLD – failed', error: e.message });
  console.log('HOLD – failed', e.message);
}
await browser.close();
fs.writeFileSync(path.join(HERE, 'packages-results.json'), JSON.stringify({ date: new Date().toISOString(), version: pkg.version, results }, null, 2));
fs.rmSync(WORK, { recursive: true, force: true });
console.log('Ergebnis: ' + results.filter((r) => r.status === 'PASS').length + '/' + results.length + ' PASS');
process.exit(results.every((r) => r.status === 'PASS') ? 0 : 1);
