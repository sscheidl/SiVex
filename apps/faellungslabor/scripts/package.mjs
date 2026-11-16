// Erzeugt die drei Nutzerartefakte aus dem frischen statischen Build (dist/faellungslabor):
//   release/faellungslabor-<version>.html          – eigenständige Einzeldatei (Stile/Skripte/Grafiken eingebettet)
//   release/faellungslabor-<version>-web.zip       – statische Web-App (Ordner faellungslabor/ mit index.html)
//   release/faellungslabor-<version>-scorm12.zip   – SCORM-1.2-Lernpaket für mebis/Moodle (imsmanifest.xml im Stamm)
//   release/SHA256SUMS.txt                         – Prüfsummen der drei Artefakte
// Nur die aktuelle Version bleibt im Ordner. Eigener ZIP-Schreiber (zlib) mit festen Zeitstempeln:
// wiederholte Builds aus demselben Quellstand ergeben identische Dateien.
// Nach apps/pufferfish/scripts/package.mjs (dort aus Trennlabor 1.0.0, Fassung B); neu: Einzeldatei.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(app, 'sivex.json'), 'utf8'));
const version = pkg.version;
const dist = path.join(app, 'dist', 'faellungslabor');
const out = path.join(app, 'release');

execFileSync(process.execPath, [path.join(app, 'scripts', 'build.mjs')], { stdio: 'inherit' });

const walk = (d, base = d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).split(path.sep).join('/')]))
  .sort();
const files = walk(dist);
const read = (f) => fs.readFileSync(path.join(dist, f));

// ------------------------------------------------------------------ ZIP
const CRC_TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
// DOS-Zeitstempel 16.11.2026 12:00:00
const DOS_TIME = (12 << 11);
const DOS_DATE = ((2026 - 1980) << 9) | (11 << 5) | 16;
function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(useDeflate ? 8 : 0, 8); lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(useDeflate ? 8 : 0, 10); ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

// ------------------------------------------------------------------ SCORM-Manifest
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="SIVEX-CHEMIE-FAELLUNGSLABOR-${xml(version)}" version="${xml(version)}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-FAELLUNGSLABOR">
    <organization identifier="ORG-FAELLUNGSLABOR">
      <title>${xml(meta.title)}</title>
      <item identifier="ITEM-FAELLUNGSLABOR" identifierref="RES-FAELLUNGSLABOR" isvisible="true">
        <title>${xml(meta.title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-FAELLUNGSLABOR" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files.map((f) => `      <file href="${xml(f)}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`;

// ------------------------------------------------------------------ Einzeldatei
// Stylesheets und Skripte werden in Dateireihenfolge eingebettet; Grafiken liegen bereits als
// data:-URI bzw. SVG-Text im Code. Kein Nachladen aus dem Quellbaum, kein Netz.
function singleHtml() {
  let html = read('index.html').toString('utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => `<style data-src="${href}">\n${read(href).toString('utf8')}\n</style>`);
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script data-src="${src}">\n${read(src).toString('utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
  if (/<(link|script)[^>]*\s(href|src)="(?!data:)[^"]+"/i.test(html)) throw new Error('Einzeldatei enthält noch externe Verweise');
  return Buffer.from(html, 'utf8');
}

// ------------------------------------------------------------------ Schreiben
fs.mkdirSync(out, { recursive: true });
const names = { html: `faellungslabor-${version}.html`, web: `faellungslabor-${version}-web.zip`, scorm: `faellungslabor-${version}-scorm12.zip` };
for (const f of fs.readdirSync(out)) if (/^faellungslabor-/.test(f) && !Object.values(names).includes(f)) fs.rmSync(path.join(out, f));
fs.writeFileSync(path.join(out, names.html), singleHtml());
fs.writeFileSync(path.join(out, names.web), zip(files.map((f) => ({ name: 'faellungslabor/' + f, data: read(f) }))));
fs.writeFileSync(path.join(out, names.scorm), zip([{ name: 'imsmanifest.xml', data: Buffer.from(manifest, 'utf8') }, ...files.map((f) => ({ name: f, data: read(f) }))]));
const sums = [names.html, names.web, names.scorm].map((n) => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(out, n))).digest('hex')}  ${n}`).join('\n') + '\n';
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums);
for (const n of Object.values(names)) console.log(`Artefakt: release/${n} (${(fs.statSync(path.join(out, n)).size / 1024).toFixed(1)} KiB${n.endsWith('.zip') ? `, ${files.length} Dateien${n === names.scorm ? ' + imsmanifest.xml' : ''}` : ''})`);
console.log('Prüfsummen: release/SHA256SUMS.txt');
