// Erzeugt einen statischen Build in dist/titration/ und prüft ihn.
// Kein Bundler: Der Build kopiert die Laufzeitdateien der App und stellt
// sicher, dass keine externen Ressourcen, absoluten Pfade oder
// Netzwerkzugriffe enthalten sind und dass der Service Worker alle
// Dateien kennt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(app, 'dist', 'titration');
const FILES = ['index.html', 'sivex.json', 'sw.js', 'assets', 'css', 'js'];

fs.rmSync(path.join(app, 'dist'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of FILES) fs.cpSync(path.join(app, f), path.join(out, f), { recursive: true });

const problems = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(out);
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const rel = path.relative(out, f).split(path.sep).join('/');
  if (/(src|href)\s*=\s*["'](https?:)?\/\//i.test(txt)) problems.push(`${rel}: externe Ressource`);
  if (/(src|href)\s*=\s*["']\/[^/]/i.test(txt)) problems.push(`${rel}: absoluter Pfad`);
  // Der Service Worker darf fetch() für seinen Cache verwenden (nur eigene Dateien)
  if (rel !== 'sw.js' && /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts)\s*\(/.test(txt)) problems.push(`${rel}: Netzwerkzugriff`);
  if (/url\(\s*["']?(https?:)?\/\//i.test(txt)) problems.push(`${rel}: externe CSS-Ressource`);
}
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (m[1].startsWith('data:')) continue;
  if (!fs.existsSync(path.join(out, m[1]))) problems.push(`index.html verweist auf fehlende Datei ${m[1]}`);
}
// Service Worker: jede Skript- und Stildatei der Seite muss im Cache-Manifest stehen
const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg))"/g)) {
  if (!sw.includes(`'${m[1]}'`)) problems.push(`sw.js kennt ${m[1]} nicht`);
}
const size = files.reduce((s, f) => s + fs.statSync(f).size, 0);
if (problems.length) {
  console.error('Build-Prüfung fehlgeschlagen:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log(`Build OK: ${files.length} Dateien, ${(size / 1024).toFixed(1)} KiB → ${path.relative(process.cwd(), out)}`);
