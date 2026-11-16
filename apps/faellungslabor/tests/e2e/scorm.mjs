// Prüft die AUSGELIEFERTEN Artefakte in release/ (FL26–FL31):
//  - Einzeldatei: frisch in einen leeren Temp-Ordner kopiert, per file:// und per HTTP, offline
//  - Web-ZIP: frisch entpackt, per file:// und per HTTP, Haupt-, Kontroll- und Auswertungsablauf
//  - SCORM-1.2-ZIP: Manifest im Stamm, Namespaces, Startpfad, alle Ressourcen; Mock-LMS eingebettet (iframe),
//    neues Fenster (opener), ohne API und mit fehlerhafter API; Protokoll aller LMS-Aufrufe
//  - Paketidentität: Versionen, Prüfsummen, Inhalt = aktueller Quellstand
// Kein Zugriff auf den Quellcodeordner zur Laufzeit der Prüflinge; externe Netze sind blockiert.
// Aufruf: npm run package && node tests/e2e/scorm.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { APP, launch, adv, idle, tube, fill, over, dropTap, part, ptab, btn, unzip, extract, VERSION, REL, shot, writeEvidence, assert, S } from './lib.mjs';

const PORT = Number(process.env.SCORM_PORT || 8183);
const names = { html: `faellungslabor-${VERSION}.html`, web: `faellungslabor-${VERSION}-web.zip`, scorm: `faellungslabor-${VERSION}-scorm12.zip` };
const results = [];
const check = (id, fl, ok, detail, evidence) => { results.push({ id, fl, status: ok ? 'PASS' : 'FAIL', detail, evidence: evidence || [] }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} [${fl}] – ${detail}`); };
async function step(id, fl, title, fn) {
  try { const r = (await fn()) || {}; check(id, fl, true, title + (r.detail ? ' – ' + r.detail : ''), r.evidence); }
  catch (e) { check(id, fl, false, title + ' – ' + e.message); console.log(e.stack); }
}

// ------------------------------------------------------------------ statische Prüfungen
const scoFiles = unzip(fs.readFileSync(REL(names.scorm)));
const webFiles = unzip(fs.readFileSync(REL(names.web)));
const manifest = scoFiles.get('imsmanifest.xml')?.toString('utf8') || '';
await step('P01', 'FL28', 'SCORM: imsmanifest.xml im ZIP-Stamm, SCORM 1.2, gültige Namespaces, genau ein SCO mit Startpunkt index.html', () => {
  assert(manifest, 'Manifest fehlt im Stamm');
  assert(![...scoFiles.keys()].some((n) => n !== 'imsmanifest.xml' && n.endsWith('imsmanifest.xml')), 'kein verschachteltes Manifest');
  assert(/<schemaversion>1\.2<\/schemaversion>/.test(manifest) && /<schema>ADL SCORM<\/schema>/.test(manifest), 'Schema 1.2');
  for (const ns of ['xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"', 'xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"']) assert(manifest.includes(ns), 'Namespace ' + ns);
  const scos = [...manifest.matchAll(/<resource [^>]*adlcp:scormtype="sco"[^>]*href="([^"]+)"/g)];
  assert(scos.length === 1 && scos[0][1] === 'index.html' && scoFiles.has('index.html'), 'SCO-Startpunkt');
  const ref = (/identifierref="([^"]+)"/.exec(manifest) || [])[1], res = (/<resource identifier="([^"]+)"/.exec(manifest) || [])[1];
  assert(ref && ref === res, 'Item verweist auf die Ressource');
  assert(manifest.includes(`<title>Fällungslabor</title>`) && manifest.includes(`version="${VERSION}"`), 'Titel und Version im Manifest');
  return { detail: `Ressource ${res}` };
});
await step('P02', 'FL28', 'SCORM: alle Dateien im Manifest gelistet und vorhanden; nur relative, interne Verweise', () => {
  const listed = [...manifest.matchAll(/<file href="([^"]+)"\/>/g)].map((m) => m[1]).sort();
  const inZip = [...scoFiles.keys()].filter((f) => f !== 'imsmanifest.xml').sort();
  assert(JSON.stringify(listed) === JSON.stringify(inZip), 'Manifest = ZIP-Inhalt');
  assert(inZip.some((f) => f.startsWith('labkit/')), 'Baukasten enthalten');
  for (const [n, b] of scoFiles) {
    const t = b.toString('utf8');
    assert(!/(src|href)\s*=\s*["'](https?:)?\/\//i.test(t) && !/url\(\s*["']?(https?:)?\/\//i.test(t), 'externe Ressource in ' + n);
    assert(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts)\s*\(/.test(t), 'Netzzugriff in ' + n);
  }
  const html = scoFiles.get('index.html').toString('utf8');
  const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('data:'));
  assert(refs.every((r) => !r.startsWith('/') && !r.includes('..') && scoFiles.has(r)), 'alle Verweise im Paket');
  return { detail: `${inZip.length} Dateien, ${refs.length} Verweise` };
});
await step('P03', 'FL27', 'Web-ZIP: dieselben Laufzeitdateien im Ordner faellungslabor/ mit index.html', () => {
  const w = [...webFiles.keys()];
  assert(w.every((n) => n.startsWith('faellungslabor/')) && webFiles.has('faellungslabor/index.html'), 'Ordnerstruktur');
  const a = w.map((n) => n.slice('faellungslabor/'.length)).sort(), b = [...scoFiles.keys()].filter((f) => f !== 'imsmanifest.xml').sort();
  assert(JSON.stringify(a) === JSON.stringify(b), 'gleicher Inhalt wie SCORM');
  for (const n of a) assert(webFiles.get('faellungslabor/' + n).equals(scoFiles.get(n)), 'Datei gleich: ' + n);
  return { detail: a.length + ' Dateien' };
});
await step('P04', 'FL26', 'Einzeldatei: Stile, Skripte und Piktogramme eingebettet, kein Verweis auf weitere Dateien', () => {
  const h = fs.readFileSync(REL(names.html), 'utf8');
  assert(!/<(script|link)[^>]*\s(src|href)="(?!data:)/i.test(h), 'externe Datei referenziert');
  assert((h.match(/<script data-src=/g) || []).length === 12 && (h.match(/<style data-src=/g) || []).length === 2, '12 Skripte, 2 Stylesheets eingebettet');
  assert(h.includes('GHS05') && h.includes(`id="ver">${VERSION}<`), 'Piktogramme und Version');
  return { detail: (fs.statSync(REL(names.html)).size / 1024).toFixed(1) + ' KiB' };
});
await step('P05', 'FL31', 'Paketidentität: Versionen gleich, SHA256SUMS vollständig und korrekt, Inhalt = aktueller Quellstand', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
  const meta = JSON.parse(scoFiles.get('sivex.json').toString('utf8'));
  const vApp = (/const VERSION = '([^']+)'/.exec(scoFiles.get('js/app.js').toString('utf8')) || [])[1];
  assert(pkg.version === VERSION && meta.version === VERSION && vApp === VERSION, 'Versionen');
  const sums = fs.readFileSync(REL('SHA256SUMS.txt'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/));
  assert(sums.length === 3, 'drei Einträge');
  for (const [h, n] of sums) assert(crypto.createHash('sha256').update(fs.readFileSync(REL(n))).digest('hex') === h, 'Prüfsumme ' + n);
  assert(Object.values(names).every((n) => sums.some((s) => s[1] === n)), 'alle Artefakte genannt');
  const rels = fs.readdirSync(path.join(APP, 'release')).filter((f) => f.startsWith('faellungslabor-'));
  assert(rels.length === 3, 'keine alten Pakete: ' + rels.join(', '));
  // Inhalt gegen den aktuellen Quellstand (App und Labkit)
  const src = (n) => n.startsWith('labkit/') ? path.resolve(APP, '../../shared/labkit', n.slice(7)) : path.join(APP, n);
  let n = 0;
  for (const [f, b] of scoFiles) { if (f === 'imsmanifest.xml') continue; assert(fs.readFileSync(src(f)).equals(b), 'abweichend vom Quellstand: ' + f); n++; }
  return { detail: `${n} Dateien identisch mit dem Quellstand, Prüfsummen ok` };
});

// ------------------------------------------------------------------ frisch bereitstellen
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const singleDir = tmp('sivex-fl-single-');
fs.copyFileSync(REL(names.html), path.join(singleDir, names.html));
const webDir = extract(webFiles, 'sivex-fl-web-');
const scoDir = extract(scoFiles, 'sivex-fl-scorm-');
const LMS = (mode, api) => `<!doctype html><meta charset="utf-8"><title>Mock-LMS</title>
<script>
  window.calls = [];
  const ok = ${api === 'broken' ? "() => 'false'" : "() => 'true'"};
  ${api === 'none' ? '' : `window.API = {
    LMSInitialize: (a) => { calls.push(['LMSInitialize', a]); ${api === 'throw' ? "throw new Error('LMS defekt');" : 'return ok();'} },
    LMSFinish: (a) => { calls.push(['LMSFinish', a]); return ok(); },
    LMSGetValue: (k) => { calls.push(['LMSGetValue', k]); return ''; },
    LMSSetValue: (k, v) => { calls.push(['LMSSetValue', k, v]); return 'true'; },
    LMSCommit: (a) => { calls.push(['LMSCommit', a]); return 'true'; },
    LMSGetLastError: () => { calls.push(['LMSGetLastError']); return ${api === 'broken' ? "'101'" : "'0'"}; },
    LMSGetErrorString: (c) => { calls.push(['LMSGetErrorString', c]); return ''; },
    LMSGetDiagnostic: (c) => { calls.push(['LMSGetDiagnostic', c]); return ''; }
  };`}
</script>
<body style="margin:0;background:#ccd"><div style="padding:6px 12px;font:14px system-ui">Mock-LMS · SCORM 1.2 · ${mode === 'iframe' ? 'eingebettet' : 'neues Fenster'} · API: ${api}</div>
${mode === 'iframe' ? '<iframe id="sco" src="/sco/index.html" style="width:1380px;height:840px;border:0"></iframe>' : '<button id="open" onclick="window.win = window.open(\'/sco/index.html\', \'sco\', \'width=1400,height=900\')">Starten</button>'}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const served = [];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  served.push(u.pathname);
  const m = /^\/lms-(iframe|popup)-(\w+)\.html$/.exec(u.pathname);
  if (m) { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end(LMS(m[1], m[2])); return; }
  const bases = { '/sco/': scoDir, '/web/': webDir, '/single/': singleDir };
  const pre = Object.keys(bases).find((p) => u.pathname.startsWith(p));
  if (!pre) { res.writeHead(404); res.end(); return; }
  const f = path.normalize(path.join(bases[pre], decodeURIComponent(u.pathname.slice(pre.length))));
  if (!f.startsWith(bases[pre]) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const browser = await launch();
const BROWSER = `${browser.__channel} ${browser.version()}`;
const isLocal = (u) => /^(file:|data:|about:|blob:)/.test(u) || u.startsWith(`http://localhost:${PORT}/`);

async function ctx(opts = {}) {
  const c = await browser.newContext(Object.assign({ viewport: { width: 1400, height: 900 } }, opts));
  const reqs = [], errs = [];
  await c.route((u) => !isLocal(String(u)), (r) => { reqs.push('BLOCKIERT ' + r.request().url()); r.abort(); });
  c.on('request', (r) => reqs.push(r.url()));
  c.on('page', (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); });
  return { c, reqs, errs };
}
async function waitApp(frameOrPage) { await frameOrPage.waitForFunction(() => window.FL && window.FL.app, null, { timeout: 15000 }); }

/** Kernablauf auf einer Seite: Haupt- (Fällung + Ammoniak), Kontroll- und Auswertungsteil. */
async function flow(page) {
  await fill(page, 'nacl', 0); await over(page, 'agno3', 0); await dropTap(page); await dropTap(page);
  await over(page, 'nh3dil', 0); await btn(page, '[data-dose="1"]'); await idle(page);
  const t = await tube(page, 0);
  assert(t.log.agDrops === 2 && t.log.nh3dilV > 0.99 && t.solid >= 0, 'Hauptablauf');
  await ptab(page, 'tasks'); await page.locator('.lk-stepchips [data-step="gleich"]').click();
  assert((await page.locator('fieldset[data-q="eqCl"] .lk-opt').count()) === 5, 'Auswertung bedienbar');
  await part(page, 'control'); await fill(page, 'water', 1); await over(page, 'agno3', 1); await dropTap(page);
  assert((await tube(page, 1, 'control')).log.agDrops === 1, 'Kontrollablauf');
  await page.locator('#btnNotebook').click(); await adv(page, 100);
  assert(/Fällungsreaktion/.test(await page.locator('#nbText').innerText()), 'Hefteintrag');
  await page.keyboard.press('Escape');
}
async function runStandalone(id, fl, title, url, shotName) {
  await step(id, fl, title, async () => {
    const { c, reqs, errs } = await ctx();
    const page = await c.newPage();
    await page.clock.install();
    page.__clock = true;
    await page.goto(url); await waitApp(page); await adv(page, 300);
    await flow(page);
    const ev = shotName ? [await shot(page, shotName)] : [];
    await c.close();
    const ext = reqs.filter((u) => !isLocal(u.replace(/^BLOCKIERT /, 'x')) || u.startsWith('BLOCKIERT'));
    assert(!errs.length, 'Fehler: ' + errs.join(' | '));
    assert(!ext.length, 'externe Anfragen: ' + ext.join(', '));
    return { detail: `${reqs.length} Anfragen, alle lokal; keine Konsolenfehler`, evidence: ev };
  });
}

// ------------------------------------------------------------------ FL26 Einzeldatei
await runStandalone('S01', 'FL26, FL30', 'Einzeldatei frisch außerhalb des Repos per file:// (offline)', pathToFileURL(path.join(singleDir, names.html)).href, '50-einzeldatei-file');
await runStandalone('S02', 'FL26, FL30', 'Einzeldatei per HTTP', `http://localhost:${PORT}/single/${names.html}`);
// ------------------------------------------------------------------ FL27 Web-ZIP
await runStandalone('S03', 'FL27, FL30', 'Web-ZIP frisch entpackt per file://', pathToFileURL(path.join(webDir, 'faellungslabor', 'index.html')).href, '51-web-zip-file');
await runStandalone('S04', 'FL27, FL30', 'Web-ZIP frisch entpackt per HTTP', `http://localhost:${PORT}/web/faellungslabor/index.html`);

// ------------------------------------------------------------------ FL29 Mock-LMS
const ALLOWED = new Set(['LMSInitialize', 'LMSFinish']);
const lmsLog = {};
async function lmsCase(id, mode, api, expectInit) {
  await step(id, 'FL29', `Mock-LMS ${mode === 'iframe' ? 'eingebettet (iframe)' : 'neues Fenster (opener)'}, API: ${api}`, async () => {
    const { c, errs } = await ctx({ viewport: { width: 1440, height: 920 } });
    const lms = await c.newPage();
    await lms.goto(`http://localhost:${PORT}/lms-${mode}-${api}.html`);
    let app;
    if (mode === 'iframe') { const h = await lms.waitForSelector('#sco'); app = await h.contentFrame(); }
    else { const [pop] = await Promise.all([c.waitForEvent('page'), lms.click('#open')]); app = pop; }
    await waitApp(app);
    await (mode === 'iframe' ? lms : app).waitForTimeout(400);
    const st = await app.evaluate(() => Object.assign({}, window.LK.scorm.state));
    // kurze Bedienung im LMS
    const pg = mode === 'iframe' ? app : app;
    await pg.locator('.hit.bottle[data-bottle="nacl"]').click(); await pg.waitForTimeout(500);
    await pg.locator('.hit.tube[data-slot="0"]').click(); await pg.waitForTimeout(3500);
    const v = await app.evaluate(() => window.FL.app.lab.tube(0).V);
    const ev = [];
    if (api === 'ok') ev.push(await (mode === 'iframe' ? lms : app).screenshot({ path: path.join(APP, 'docs/screenshots', `52-scorm-${mode}.png`) }).then(() => `docs/screenshots/52-scorm-${mode}.png`));
    // Beenden: iframe entfernen bzw. Fenster schließen
    if (mode === 'iframe') await lms.evaluate(() => { document.getElementById('sco').src = 'about:blank'; });
    else await app.close({ runBeforeUnload: true });
    await lms.waitForTimeout(400);
    const calls = await lms.evaluate(() => window.calls || []);
    lmsLog[id] = { mode, api, state: st, calls };
    await c.close();
    const bad = calls.filter((x) => !ALLOWED.has(x[0]) && !(api === 'broken' && x[0] === 'LMSGetLastError'));
    assert(v > 1.9, 'App im LMS bedienbar');
    assert(!bad.length, 'unzulässige LMS-Aufrufe: ' + JSON.stringify(bad));
    if (api === 'none') assert(!st.available && !calls.length, 'ohne API: nichts aufgerufen');
    else {
      const inits = calls.filter((x) => x[0] === 'LMSInitialize').length, fins = calls.filter((x) => x[0] === 'LMSFinish').length;
      assert(inits === 1, 'genau ein LMSInitialize');
      if (expectInit) assert(st.initialized && fins === 1, 'LMSFinish genau einmal nach erfolgreicher Anmeldung');
      else assert(!st.initialized && fins === 0, 'nach fehlgeschlagener Anmeldung kein Finish und keine Fehlerschleife');
    }
    assert(!errs.length, 'Fehler: ' + errs.join(' | '));
    return { detail: `Aufrufe: ${calls.map((x) => x[0]).join(', ') || 'keine'}`, evidence: ev };
  });
}
await lmsCase('L01', 'iframe', 'ok', true);
await lmsCase('L02', 'popup', 'ok', true);
await lmsCase('L03', 'iframe', 'none', false);
await lmsCase('L04', 'iframe', 'broken', false);
await lmsCase('L05', 'popup', 'throw', false);
writeEvidence('scorm-lms-aufrufe.json', lmsLog);

await browser.close();
server.close();
const out = { date: new Date().toISOString(), version: VERSION, browser: BROWSER, artefakte: names, results };
fs.writeFileSync(path.join(APP, 'tests/e2e/scorm-results.json'), JSON.stringify(out, null, 2) + '\n');
const failed = results.filter((r) => r.status !== 'PASS');
console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
