// Erzeugt die Release-Pakete aus dem statischen Build (dist/trennlabor):
//   release/trennlabor-<version>-web.zip      – zum Hochladen auf einen Webserver
//   release/trennlabor-<version>-scorm12.zip  – SCORM-1.2-Lernpaket für mebis/Moodle
//   release/SHA256SUMS.txt                    – Prüfsummen aller Pakete im Ordner
// Pakete älterer Versionen bleiben erhalten; nur die aktuelle Version wird ersetzt.
// Ohne externe Werkzeuge (eigener ZIP-Schreiber mit zlib); feste Zeitstempel
// sorgen dafür, dass wiederholte Builds identische Archive ergeben.
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
const dist = path.join(app, 'dist', 'trennlabor');
const out = path.join(app, 'release');

execFileSync(process.execPath, [path.join(app, 'scripts', 'build.mjs')], { stdio: 'inherit' });

const walk = (d, base = d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).split(path.sep).join('/')]))
  .sort();
const files = walk(dist);

// ------------------------------------------------------------------ ZIP
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// DOS-Zeitstempel 22.10.2026 12:00:00
const DOS_TIME = (12 << 11) | (0 << 5) | 0;
const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 22;

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
<manifest identifier="SIVEX-CHEMIE-TRENNLABOR-${xml(version)}" version="${xml(version)}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-TRENNLABOR">
    <organization identifier="ORG-TRENNLABOR">
      <title>${xml(meta.title)} – Trennverfahren, Chromatographie und Destillation</title>
      <item identifier="ITEM-TRENNLABOR" identifierref="RES-TRENNLABOR" isvisible="true">
        <title>${xml(meta.title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-TRENNLABOR" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files.map((f) => `      <file href="${xml(f)}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`;

// ------------------------------------------------------------------ Pakete schreiben
fs.mkdirSync(out, { recursive: true });
const read = (f) => fs.readFileSync(path.join(dist, f));
const webName = `trennlabor-${version}-web.zip`;
const scormName = `trennlabor-${version}-scorm12.zip`;
fs.writeFileSync(path.join(out, webName), zip(files.map((f) => ({ name: 'trennlabor/' + f, data: read(f) }))));
fs.writeFileSync(path.join(out, scormName), zip([{ name: 'imsmanifest.xml', data: Buffer.from(manifest, 'utf8') }, ...files.map((f) => ({ name: f, data: read(f) }))]));
// Prüfsummen für alle vorhandenen Pakete, neueste Version zuerst
const vkey = (n) => (/^trennlabor-(\d+)\.(\d+)\.(\d+)/.exec(n) || [0, 0, 0, 0]).slice(1).map((x) => x.padStart(6, '0')).join('.');
const all = fs.readdirSync(out).filter((f) => /^trennlabor-.*\.zip$/.test(f)).sort((a, b) => vkey(b).localeCompare(vkey(a)) || (a.includes('-web') ? -1 : 1));
const sums = all.map((n) => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(out, n))).digest('hex')}  ${n}`).join('\n') + '\n';
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums);
for (const n of [webName, scormName]) console.log(`Paket: release/${n} (${(fs.statSync(path.join(out, n)).size / 1024).toFixed(1)} KiB, ${files.length} Dateien${n === scormName ? ' + imsmanifest.xml' : ''})`);
