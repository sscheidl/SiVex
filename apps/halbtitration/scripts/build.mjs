// Erzeugt einen statischen Build in dist/halbtitration/ und prüft ihn.
// Die Anwendung braucht keinen Bundler: Der Build kopiert nur die Laufzeitdateien
// und stellt sicher, dass keine externen Ressourcen oder absoluten Pfade verwendet werden.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(app, 'dist', 'halbtitration');
const FILES = ['index.html', 'sivex.json', 'css', 'js'];

fs.rmSync(path.join(app, 'dist'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of FILES) fs.cpSync(path.join(app, f), path.join(out, f), { recursive: true });

// Prüfungen
const problems = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(out);
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const rel = path.relative(out, f);
  if (/(src|href)\s*=\s*["'](https?:)?\/\//i.test(txt)) problems.push(`${rel}: externe Ressource`);
  if (/(src|href)\s*=\s*["']\/[^/]/i.test(txt)) problems.push(`${rel}: absoluter Pfad`);
  if (/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(txt)) problems.push(`${rel}: Netzwerkzugriff`);
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
console.log(`Build OK: ${files.length} Dateien, ${(size / 1024).toFixed(1)} KiB → ${path.relative(process.cwd(), out)}`);
