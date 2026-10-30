// Erzeugt einen statischen Build in dist/trennverfahren/ und prüft ihn.
// Kein Bundler: Der Build kopiert die Laufzeitdateien der App und den Baukasten
// (shared/labkit → labkit/) und stellt sicher, dass keine externen Ressourcen,
// absoluten Pfade oder Netzwerkzugriffe enthalten sind.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const labkit = path.resolve(app, '../../shared/labkit');
const out = path.join(app, 'dist', 'trennverfahren');
const FILES = ['index.html', 'sivex.json', 'css', 'js'];

fs.rmSync(path.join(app, 'dist'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of FILES) fs.cpSync(path.join(app, f), path.join(out, f), { recursive: true });
for (const f of ['js', 'css']) fs.cpSync(path.join(labkit, f), path.join(out, 'labkit', f), { recursive: true });
const labkitVersion = JSON.parse(fs.readFileSync(path.join(labkit, 'package.json'), 'utf8')).version;

const problems = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(out);
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const rel = path.relative(out, f);
  if (/(src|href)\s*=\s*["'](https?:)?\/\//i.test(txt)) problems.push(`${rel}: externe Ressource`);
  if (/(src|href)\s*=\s*["']\/[^/]/i.test(txt)) problems.push(`${rel}: absoluter Pfad`);
  if (/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts)\s*\(/.test(txt)) problems.push(`${rel}: Netzwerkzugriff`);
  if (/url\(\s*["']?(https?:)?\/\//i.test(txt)) problems.push(`${rel}: externe CSS-Ressource`);
}
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (m[1].startsWith('data:')) continue;
  if (!fs.existsSync(path.join(out, m[1]))) problems.push(`index.html verweist auf fehlende Datei ${m[1]}`);
}
const size = files.reduce((s, f) => s + fs.statSync(f).size, 0);
if (problems.length) {
  console.error('Build-Prüfung fehlgeschlagen:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log(`Build OK: ${files.length} Dateien, ${(size / 1024).toFixed(1)} KiB, Labkit ${labkitVersion} → ${path.relative(process.cwd(), out)}`);

// Testvariante „kompakte Bedienung“ (in Erprobung): gleicher Code, nur index.html schaltet die
// Bedienung um (<html data-ui="kompakt">) und trägt einen eigenen Titel. Eigener Ordner, eigene Pakete,
// damit beide Fassungen parallel in mebis liegen und im Unterricht verglichen werden können.
const outK = path.join(app, 'dist', 'trennverfahren-kompakt');
fs.cpSync(out, outK, { recursive: true });
const htmlK = html
  .replace(/<html lang="de">/, '<html lang="de" data-ui="kompakt">')
  .replace(/<title>[^<]*<\/title>/, '<title>Trennverfahren (kompakte Bedienung) – SiVex</title>');
if (!htmlK.includes('data-ui="kompakt"') || !htmlK.includes('kompakte Bedienung')) { console.error('Build-Prüfung fehlgeschlagen: Testvariante nicht erzeugt'); process.exit(1); }
fs.writeFileSync(path.join(outK, 'index.html'), htmlK);
console.log(`Testvariante kompakte Bedienung → ${path.relative(process.cwd(), outK)}`);
