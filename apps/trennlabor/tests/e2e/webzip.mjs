// T-01: Das fertige Web-ZIP wird entpackt und dieselben Nutzeraktionen (Rauchtest
// der E2E-Suite: Startansicht, K-02 positiv, C-01, D-01, Tablet) laufen gegen genau
// diese ausgelieferten Dateien – zusätzlich einmal direkt per file:// geöffnet.
// Aufruf: npm run package && node tests/e2e/webzip.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { unzip } from './zip.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const version = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
const ZIP = path.join(APP, 'release', `trennlabor-${version}-web.zip`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trennlabor-web-'));
for (const [name, data] of unzip(fs.readFileSync(ZIP))) {
  const f = path.join(dir, name);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
}
const root = path.join(dir, 'trennlabor');
console.log('Entpackt nach', root);
execFileSync(process.execPath, [path.join(HERE, 'run.mjs'), '--root', root, '--smoke', '--results', path.join(HERE, 'webzip-results.json')], { stdio: 'inherit', env: Object.assign({}, process.env, { E2E_PORT: '8139' }) });
// file:// ohne Server
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => errors.push('fehlend: ' + r.url()));
await page.goto('file://' + path.join(root, 'index.html'));
await page.waitForFunction(() => window.Trennlabor && window.Trennlabor.session);
await page.click('.labcard[data-lab="classic"]');
await page.waitForTimeout(500);
await browser.close();
if (errors.length) { console.error('file:// FAIL', errors); process.exit(1); }
console.log('PASS file:// – App startet aus dem entpackten Web-ZIP ohne Server und ohne Fehler');
const r = JSON.parse(fs.readFileSync(path.join(HERE, 'webzip-results.json'), 'utf8'));
r.fileProtocol = 'PASS';
fs.writeFileSync(path.join(HERE, 'webzip-results.json'), JSON.stringify(r, null, 2));
fs.rmSync(dir, { recursive: true, force: true });
