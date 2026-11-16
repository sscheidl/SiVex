// Browserprüfung des Fällungslabors auf dem AUSGELIEFERTEN Web-ZIP (frisch außerhalb des Repositorys
// entpackt, über HTTP). Bedient ausschließlich die Oberfläche (Maus, Tastatur, Touch-Emulation);
// der Modellzustand wird nur gelesen, um Beobachtungen zu belegen. Erwartungswerte für Mengen sind
// unabhängig aus den Bedienschritten gezählt (Tropfen × 0,050 mL × 0,100 mol/L usw.).
// Aufruf: npm run package && node tests/e2e/run.mjs   (ONLY=E03,E09 für einzelne Szenarien;
// E2E_ROOT=dist/faellungslabor prüft stattdessen den Build)
// Zuordnung zur PASS/HOLD-Matrix (FL..) je Szenario; Ergebnis: tests/e2e/results.json.
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '../../scripts/serve.mjs';
import {
  APP, launch, newPage, adv, idle, S, tube, bottle, tubeHit, btn, fill, over, dropTap, hold, part, ptab, speed, toastText,
  shot, tubeClip, decodePng, meanRGB, lum, yellowness, tubeRegion, unzip, extract, VERSION, REL, writeEvidence, assert
} from './lib.mjs';

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
let ROOT;
if (process.env.E2E_ROOT) ROOT = path.resolve(process.env.E2E_ROOT);
else ROOT = path.join(extract(unzip(fs.readFileSync(REL(`faellungslabor-${VERSION}-web.zip`))), 'sivex-fl-e2e-'), 'faellungslabor');
const PORT = Number(process.env.E2E_PORT || 8181);
const BASE = `http://localhost:${PORT}/index.html`;
const results = [], allRequests = [], allErrors = [];
const DROP_MOL = 0.05e-3 * 0.1;
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const TOL = 1e-6;

async function scenario(id, fl, title, fn) {
  if (ONLY && !ONLY.includes(id)) return;
  const t0 = Date.now();
  try {
    const r = (await fn()) || {};
    results.push({ id, fl, title, status: 'PASS', detail: r.detail || '', evidence: r.evidence || [], viewport: r.viewport || '1440×900', input: r.input || 'Maus', ms: Date.now() - t0 });
    console.log(`PASS ${id} [${fl}] ${title}${r.detail ? ' – ' + r.detail : ''}`);
  } catch (e) {
    results.push({ id, fl, title, status: 'FAIL', detail: e.message, ms: Date.now() - t0 });
    console.log(`FAIL ${id} [${fl}] ${title} – ${e.stack}`);
  }
}

const browser = await launch();
const server = await serve(ROOT, PORT);
const BROWSER = `${browser.__channel} ${browser.version()}`;
console.log(`Browser: ${BROWSER} · Prüfling: ${ROOT}`);
async function open(opts = {}) {
  const o = await newPage(browser, BASE, Object.assign({ clock: true, block: true }, opts));
  o.done = async () => { allErrors.push(...o.errors); allRequests.push(...o.requests); await o.context.close(); };
  return o;
}
const stageText = (page) => page.evaluate(() => {
  const t = [document.querySelector('#stage').innerText, document.querySelector('#ptabs').innerText];
  document.querySelectorAll('#stage [aria-label], #stage [title]').forEach((e) => t.push(e.getAttribute('aria-label') || '', e.getAttribute('title') || ''));
  return t.join('\n');
});
const PRODUCTS = /Silberchlorid|Silberbromid|Silberiodid|AgCl|AgBr|AgI\b/;
async function precipitateAll(page, drops = 8) {
  await fill(page, 'nacl', 0); await fill(page, 'nabr', 1); await fill(page, 'nai', 2);
  for (const s of [0, 1, 2]) { await over(page, 'agno3', s); for (let i = 0; i < drops; i++) await dropTap(page); }
}

// =========================================================== E01 App/Integration
await scenario('E01', 'FL01', 'Start: Titel, Version, beide Versuchsteile, keine Fehler, keine externen Anfragen', async () => {
  const { page, errors, requests, done } = await open();
  const title = await page.title();
  assert(title === 'Fällungslabor – SiVex', 'Titel: ' + title);
  assert((await page.locator('.lk-brand b').innerText()) === 'Fällungslabor', 'App-Name');
  assert((await page.locator('#ver').innerText()) === VERSION, 'Version in der Oberfläche');
  assert(await page.locator('#parts [data-part="main"]').innerText() === 'Fällungsreaktionen' && await page.locator('#parts [data-part="control"]').innerText() === 'Kontrollversuche', 'Reiter');
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'sivex.json'), 'utf8'));
  assert(meta.id === 'chemie/faellungslabor' && meta.title === 'Fällungslabor' && meta.version === VERSION && meta.status === 'prototype', 'sivex.json');
  const ev = await shot(page, '01-start-1440x900');
  assert(!errors.length, errors.join('; '));
  assert(requests.every((u) => u.startsWith(`http://localhost:${PORT}/`) || u.startsWith('data:')), 'nur lokale Anfragen');
  await done();
  return { detail: `${requests.length} Anfragen, alle lokal`, evidence: [ev] };
});

// =========================================================== E02 Vorratslösungen und Gefahrstoffkarten
await scenario('E02', 'FL02, FL22', 'Vorratslösungen korrekt beschriftet; GHS-Karten je Lösung per Tippen, lesbar, schließbar', async () => {
  const { page, done } = await open({ hasTouch: true, viewport: { width: 1180, height: 820 } });
  // 1.1.0: Etikett auf der Flasche = Formel, Name, Zusatz (ohne Konzentration); Konzentration in der Infokarte
  const labels = await page.$$eval('.bcard', (b) => b.map((x) => x.innerText.replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim()));
  const want = ['NaCl Natriumchlorid', 'NaBr Natriumbromid', 'NaI Natriumiodid', 'AgNO₃ Silbernitrat', 'NH₃ Ammoniak verdünnt', 'NH₃ Ammoniak konzentriert', 'H₂O Wasser destilliert'];
  assert(JSON.stringify(labels) === JSON.stringify(want), 'Etiketten: ' + labels.join(' | '));
  const info = await page.$$eval('.binfo', (b) => b.map((x) => x.getAttribute('aria-label')));
  for (const n of ['Natriumchloridlösung', 'Natriumbromidlösung', 'Natriumiodidlösung', 'Silbernitratlösung', 'Ammoniaklösung, verdünnt', 'Ammoniaklösung, konzentriert', 'Destilliertes Wasser']) assert(info.some((l) => l.startsWith('Infokarte: ' + n + ' –')), 'Infokarte fehlt: ' + n);
  const txt = (await stageText(page)) + labels.join(' ');
  assert(!/Barium|BaBr|Carbonat|Salpeters|HNO/.test(txt), 'keine ausgeschlossenen Reagenzien');
  const expect = { agno3: ['GHS07'], nacl: [], nabr: [], nai: [], nh3dil: ['GHS05'], nh3conc: ['GHS05', 'GHS07', 'GHS09'], water: [] };
  const ev = [];
  for (const [k, picts] of Object.entries(expect)) {
    await page.locator(`.binfo[data-info="${k}"]`).tap();
    await adv(page, 150);
    const card = page.locator('.modal-card');
    assert(await card.isVisible(), 'Karte sichtbar ' + k);
    const alts = await card.locator('img').evaluateAll((im) => im.map((i) => i.alt.split(':')[0]));
    assert(JSON.stringify(alts) === JSON.stringify(picts), `${k}: Piktogramme ${alts} statt ${picts}`);
    const t = await card.innerText();
    assert(/Quelle:/.test(t), 'Quelle genannt');
    if (picts.length) assert(/Signalwort/.test(t) && /H\d{3}/.test(t), 'Signalwort und H-Sätze');
    if (k !== 'water') assert(/Konzentration: c [=≈] /.test(t), k + ': Konzentration in der Karte');
    else assert(/Keine Gefahrenpiktogramme/.test(t), 'ohne Piktogramme');
    const box = await card.boundingBox(), vp = page.viewportSize();
    assert(box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1, 'Karte ohne Abschneiden');
    if (k === 'nh3conc' || k === 'agno3') ev.push(await shot(page, `02-ghs-karte-${k}`));
    if (k === 'water') { await page.keyboard.press('Escape'); } else await page.locator('.modal [data-m="close"]').tap();
    await adv(page, 100);
    assert(!(await card.isVisible()), 'geschlossen ' + k);
  }
  await part(page, 'control'); await adv(page, 200);
  const cl = await page.$$eval('.binfo', (b) => b.map((x) => x.getAttribute('aria-label')).join(' '));
  assert(/Leitungswasser/.test(cl) && /Mineralwasser/.test(cl) && !/Ammoniak/.test(cl), 'Kontrollteil: Wasserproben, kein Ammoniak');
  await page.locator('.binfo[data-info="tap"]').tap(); await adv(page, 150);
  assert(/Keine Gefahrenpiktogramme – kein Gefahrstoff/.test(await page.locator('.modal-card').innerText()), 'Wasser ohne erfundene Symbole');
  await done();
  return { detail: '7 + 2 Karten geprüft (Touch-Emulation)', evidence: ev, viewport: '1180×820', input: 'Touch (emuliert)' };
});

// =========================================================== E03 Drei Fällungen, Übergänge, Farben
await scenario('E03', 'FL03, FL04, FL06', 'Drei Fällungen selbst durchgeführt: Tropfen im Flug, lokale Wolke, Verteilung; Farben unterscheidbar', async () => {
  const { page, errors, done } = await open();
  await fill(page, 'nacl', 0); await fill(page, 'nabr', 1); await fill(page, 'nai', 2);
  await over(page, 'agno3', 0);
  const ev = [];
  // Übergang: Tropfen fällt (noch nicht gebucht) → Wolke am Eintreffpunkt → verteilt
  await page.locator('#btnDrop').click();
  await adv(page, 120);
  const inFlight = await tube(page, 0);
  const flying = await S(page, (A) => A.lab.state.drops.length);
  assert(flying === 1 && inFlight.log.agDrops === 0 && inFlight.n.Ag === 0, 'Tropfen im Flug, noch keine Buchung');
  ev.push(await shot(page, '03a-tropfen-im-flug', await tubeClip(page, 0)));
  await adv(page, 520);
  const landed = await tube(page, 0);
  assert(landed.log.agDrops === 1 && landed.clouds === 1 && landed.cloudM > 0, 'eingetroffen: lokale Wolke');
  ev.push(await shot(page, '03b-wolke-am-eintreffpunkt', await tubeClip(page, 0)));
  await adv(page, 1300);
  ev.push(await shot(page, '03c-wolke-breitet-sich-aus', await tubeClip(page, 0)));
  await adv(page, 2500);
  const spread = await tube(page, 0);
  assert(spread.clouds === 0 && spread.susp > 0, 'verteilt (Schwebe)');
  ev.push(await shot(page, '03d-truebung-verteilt', await tubeClip(page, 0)));
  for (let i = 0; i < 7; i++) await dropTap(page);
  for (const s of [1, 2]) { await over(page, 'agno3', s); for (let i = 0; i < 8; i++) await dropTap(page); }
  await speed(page, 5); await adv(page, 20000); await idle(page);
  ev.push(await shot(page, '03e-drei-faellungen-abgesetzt'));
  // Farbmessung im Bodensatz (Bildschirmpixel)
  const img = decodePng(await page.screenshot());
  const col = [];
  for (const s of [0, 1, 2]) { const r = await tubeRegion(page, s, 866, 'bottom', 0.4); col.push(meanRGB(img, r.x0, r.y0, r.x1, r.y1)); }
  const yl = col.map(yellowness);
  assert(yl[0] < yl[1] && yl[1] < yl[2], `Gelbanteil AgCl < AgBr < AgI: ${yl.map((v) => v.toFixed(3))}`);
  assert(yl[2] - yl[1] > 0.06 && yl[1] - yl[0] > 0.03, 'deutlich unterscheidbar');
  assert(yl[2] < 0.45, 'AgI nicht grell schwefelgelb');
  const t = await Promise.all([0, 1, 2].map((s) => tube(page, s)));
  assert(t.every((x) => rel(x.solid, 8 * DROP_MOL) < 1e-3), 'je 8 Tropfen gefällt');
  const txt = await stageText(page);
  assert(!PRODUCTS.test(txt), 'keine Produktnamen auf der Bühne');
  writeEvidence('E03-farben.json', { methode: 'Mittelwert der Bildschirmpixel im Bodensatz (dunkler Kontrastschirm), 1440×900', rgb: col.map((c) => c.map(Math.round)), gelbanteil: yl });
  assert(!errors.length, errors.join('; '));
  await done();
  return { detail: `Gelbanteil ${yl.map((v) => v.toFixed(3)).join(' / ')}`, evidence: ev.concat(['docs/evidence/E03-farben.json']) };
});

// =========================================================== E04 Einzel-/Dauertropfen, Touch, Tastatur
await scenario('E04', 'FL04, FL24', 'Tippen = 1 Tropfen (Maus, Touch, Tastatur), Halten = begrenzte Folge, Loslassen beendet; keine Doppelauslösung', async () => {
  const { page, done } = await open({ hasTouch: true });
  await fill(page, 'nacl', 0, true);
  await over(page, 'agno3', 0, true);
  // Touch-Tipp auf das Glas (erzeugt pointer- und click-Ereignisse)
  await tubeHit(page, 0, true); await idle(page);
  let t = await tube(page, 0);
  assert(t.log.agDrops === 1, 'Touch-Tipp auf das Glas: genau 1 Tropfen, erhalten ' + t.log.agDrops);
  await adv(page, 300);
  await page.locator('#btnDrop').tap(); await idle(page);
  t = await tube(page, 0);
  assert(t.log.agDrops === 2, 'Touch-Tipp auf „Tropfen“: genau 1');
  await adv(page, 300);
  await page.locator('#btnDrop').click(); await idle(page);
  assert((await tube(page, 0)).log.agDrops === 3, 'Mausklick: genau 1');
  await adv(page, 300);
  await page.locator('#btnDrop').focus(); await page.keyboard.press('Enter'); await idle(page);
  assert((await tube(page, 0)).log.agDrops === 4, 'Enter: genau 1');
  await adv(page, 300);
  // Halten: 2,0 s → 1 + floor((2,0 − 0,45)/0,38) + 1 ≈ 6 Tropfen; danach nichts mehr
  await hold(page, 2000); await idle(page);
  const n1 = (await tube(page, 0)).log.agDrops - 4;
  assert(n1 >= 5 && n1 <= 6, 'Halten 2 s: ' + n1 + ' Tropfen (≈ 3/s)');
  await adv(page, 2000);
  assert((await tube(page, 0)).log.agDrops === 4 + n1, 'nach dem Loslassen kein Nachtropfen');
  // Tastatur halten: Leertaste gedrückt
  await page.locator('#btnDrop').focus();
  await page.keyboard.down(' '); await adv(page, 1300); await page.keyboard.up(' '); await idle(page);
  const n2 = (await tube(page, 0)).log.agDrops - 4 - n1;
  assert(n2 >= 3 && n2 <= 4, 'Leertaste 1,3 s: ' + n2);
  await adv(page, 1500);
  assert((await tube(page, 0)).log.agDrops === 4 + n1 + n2, 'Leertaste losgelassen: Ende');
  await done();
  return { detail: `Halten 2 s → ${n1} Tropfen, Leertaste 1,3 s → ${n2}`, input: 'Touch (emuliert), Maus, Tastatur' };
});

// =========================================================== E05 Füllstand, Meniskus, Kapazität
await scenario('E05', 'FL05', 'Füllstand steigt mit dem Volumen; Zugabe stoppt bei 20 mL mit „Reagenzglas ist voll“', async () => {
  const { page, done } = await open();
  await fill(page, 'nacl', 0);
  const ev = [];
  const surf = () => S(page, (A, FL) => FL.geometry.surfaceY(A.lab.tube(0).V));
  const y0 = await surf();
  await over(page, 'agno3', 0); await dropTap(page);
  await over(page, 'water', 0);
  await btn(page, '[data-dose="1"]'); await adv(page, 400);
  const yMid = await surf();
  ev.push(await shot(page, '05a-strahl-dosierhilfe', await tubeClip(page, 0)));
  await idle(page);
  const y1 = await surf();
  assert(y1 < yMid && yMid < y0, 'Spiegel steigt sichtbar während der Zugabe');
  for (let i = 0; i < 20; i++) { await btn(page, '[data-dose="1"]'); await idle(page); }
  const t = await tube(page, 0);
  assert(t.V <= 20 + 1e-9 && t.V > 19.94, 'gefüllt bis zur Grenze: ' + t.V);
  assert(/Reagenzglas ist voll/.test(await toastText(page)), 'Meldung');
  assert(rel(t.V, 2 + 0.05 + t.log.waterV) < TOL, 'Volumenbilanz');
  ev.push(await shot(page, '05b-reagenzglas-voll', await tubeClip(page, 0)));
  await done();
  return { detail: `V = ${t.V.toFixed(3)} mL`, evidence: ev };
});

// =========================================================== E06 Sedimentation und Schwenken
await scenario('E06', 'FL07', 'Absetzen mit klarer werdendem Überstand, Schwenken suspendiert wieder; Feststoffmenge erhalten', async () => {
  const { page, done } = await open();
  await page.locator('#vol [data-vol="3"]').click();
  await fill(page, 'nai', 0); await over(page, 'agno3', 0);
  for (let i = 0; i < 12; i++) await dropTap(page);
  await page.locator('.hit.pip').click(); await idle(page);
  await adv(page, 3500);
  const ev = [];
  const p0 = (await tube(page, 0)).solid;
  const lumTop = async () => { const img = decodePng(await page.screenshot()); const r = await tubeRegion(page, 0, 'surface', 850, 0.4); return lum(meanRGB(img, r.x0, r.y0, r.x1, r.y0 + (r.y1 - r.y0) * 0.4)); };
  const L0 = await lumTop();
  ev.push(await shot(page, '06a-suspendiert', await tubeClip(page, 0)));
  await adv(page, 18000);
  const mid = await tube(page, 0);
  ev.push(await shot(page, '06b-setzt-sich-ab', await tubeClip(page, 0)));
  await adv(page, 30000);
  const L1 = await lumTop();
  const set = await tube(page, 0);
  ev.push(await shot(page, '06c-abgesetzt', await tubeClip(page, 0)));
  assert(mid.front > 0.3 && mid.front < 0.7 && mid.sed > 0 && mid.susp > 0, 'Absetzfront unterwegs');
  assert(set.susp === 0 && rel(set.sed, p0) < TOL, 'vollständig abgesetzt');
  assert(L1 < L0 - 0.03, `Überstand klarer (Helligkeit ${L0.toFixed(3)} → ${L1.toFixed(3)})`);
  await tubeHit(page, 0); await page.locator('#btnShake').click(); await adv(page, 400);
  ev.push(await shot(page, '06d-schwenken-laeuft', await tubeClip(page, 0)));
  await adv(page, 1200);
  const sh = await tube(page, 0);
  assert(rel(sh.susp, p0) < 0.01 && sh.sed < 0.01 * p0 + 1e-12, 'wieder aufgewirbelt');
  assert(rel(sh.solid, p0) < TOL, 'keine Mengenänderung');
  const L2 = await lumTop();
  assert(L2 > L1 + 0.03, 'nach dem Schwenken wieder trüb');
  ev.push(await shot(page, '06e-nach-dem-schwenken', await tubeClip(page, 0)));
  writeEvidence('E06-ueberstand.json', { helligkeitOben: { suspendiert: L0, abgesetzt: L1, geschwenkt: L2 }, feststoff_mol: { start: p0, abgesetzt: set.sed, geschwenkt: sh.solid } });
  await done();
  return { detail: `Helligkeit oben ${L0.toFixed(3)} → ${L1.toFixed(3)} → ${L2.toFixed(3)}`, evidence: ev.concat(['docs/evidence/E06-ueberstand.json']) };
});

// =========================================================== E07 Mengen und Grenzen
await scenario('E07', 'FL08, FL06', 'Nullzugabe, 1 und viele Tropfen, Probenvolumen 1/3 mL, Silberüberschuss; Trübung mengenabhängig', async () => {
  const { page, done } = await open();
  await page.locator('#vol [data-vol="1"]').click(); await fill(page, 'nacl', 0);
  await page.locator('#vol [data-vol="3"]').click(); await fill(page, 'nacl', 1);
  await page.locator('#vol [data-vol="2"]').click(); await fill(page, 'nacl', 2);
  let t = await Promise.all([0, 1, 2].map((s) => tube(page, s)));
  assert(rel(t[0].V, 1) < TOL && rel(t[1].V, 3) < TOL && rel(t[2].V, 2) < TOL, 'Probenvolumina 1/3/2 mL');
  assert(t.every((x) => x.solid === 0), 'Nullzugabe: klar');
  await over(page, 'agno3', 0); await dropTap(page);
  await over(page, 'agno3', 1); await btn(page, '[data-dose="n5"]'); await idle(page); await btn(page, '[data-dose="n5"]'); await idle(page); await btn(page, '[data-dose="n5"]'); await idle(page);
  // Glas 1: 1 mL Probe (1e-4 mol Cl⁻) – 30 Tropfen Ag (1,5e-4 mol) → Silberüberschuss
  await over(page, 'agno3', 0);
  for (let k = 0; k < 6; k++) { await btn(page, '[data-dose="n5"]'); await idle(page); }
  await adv(page, 3500);
  t = await Promise.all([0, 1, 2].map((s) => tube(page, s)));
  assert(t[0].log.agDrops === 31 && t[0].solid <= 1e-4 + 1e-15 && rel(t[0].solid, 1e-4) < 1e-4, 'Silberüberschuss: Fällung durch Chlorid begrenzt (1,0e-4 mol)');
  assert(rel(t[1].solid, 15 * DROP_MOL) < 1e-6, '15 Tropfen in 3 mL: Ag⁺ limitierend');
  const vis = await S(page, (A, FL) => [0, 1, 2].map((i) => { const t = A.lab.tube(i); return FL.model.turbidity(t.susp / t.V * 1e6); }));
  assert(vis[0] > vis[1] && vis[1] > vis[2] && vis[2] === 0, 'Trübung nach Menge gestuft: ' + vis.map((v) => v.toFixed(2)));
  const nan = await S(page, (A) => JSON.stringify(A.lab.snapshot()).match(/NaN|Infinity|-\d/g));
  assert(!nan, 'keine NaN/unendlich/negativ im Zustand: ' + nan);
  const ev = [await shot(page, '07-mengen-1-15-31-tropfen')];
  await done();
  return { detail: `Trübung ${vis.map((v) => v.toFixed(2)).join(' / ')}`, evidence: ev };
});

// =========================================================== E08 Bilanzen über einen vollständigen Ablauf
await scenario('E08', 'FL09', 'Silber-, Halogenid-, Zuschauerionen- und Volumenbilanz (unabhängig gezählt, Toleranz 1e-6)', async () => {
  const { page, done } = await open();
  await fill(page, 'nabr', 0);
  await over(page, 'agno3', 0); for (let i = 0; i < 9; i++) await dropTap(page);
  await over(page, 'water', 0); await btn(page, '[data-dose="0.5"]'); await idle(page);
  await over(page, 'nh3conc', 0); await btn(page, '[data-dose="1"]'); await idle(page); await dropTap(page);
  await adv(page, 20000);
  const t = await tube(page, 0);
  const sp = await S(page, (A, FL) => FL.model.species(A.lab.tube(0)));
  const ref = { V: 2 + 9 * 0.05 + 0.5 + 1.05, Ag: 9 * DROP_MOL, NO3: 9 * DROP_MOL, Na: 2e-4, X: 2e-4, N: 1.05e-3 * 13.3 };
  const rows = [];
  for (const [k, v] of Object.entries(ref)) { const got = k === 'V' ? t.V : t.n[k]; rows.push({ groesse: k, soll: v, ist: got, relAbw: rel(got, v) }); assert(rel(got, v) < TOL, `${k}: ${got} vs ${v}`); }
  assert(rel(sp.solid + sp.dissolvedAg, ref.Ag) < TOL && rel(sp.solid + sp.dissolvedX, ref.X) < TOL, 'Ag- und Br-Bilanz');
  assert(sp.solid >= 0 && sp.dissolvedAg >= 0 && sp.complexedAg >= 0, 'nichts negativ');
  writeEvidence('E08-bilanz.json', { toleranz: TOL, zeilen: rows, feststoff: sp.solid, geloestesAg: sp.dissolvedAg, komplexiertesAg: sp.complexedAg });
  await done();
  return { detail: 'max. rel. Abweichung ' + Math.max(...rows.map((r) => r.relAbw)).toExponential(1), evidence: ['docs/evidence/E08-bilanz.json'] };
});

// =========================================================== E09 NH₃ und AgCl
await scenario('E09', 'FL10', 'AgCl: zu wenig verdünnte NH₃ lässt Rest, ausreichende Menge löst sichtbar fortschreitend', async () => {
  const { page, done } = await open();
  await fill(page, 'nacl', 0); await over(page, 'agno3', 0);
  await btn(page, '[data-dose="n5"]'); await idle(page); await btn(page, '[data-dose="n5"]'); await idle(page);
  await adv(page, 3500);
  const p0 = (await tube(page, 0)).solid;
  await over(page, 'nh3dil', 0); await btn(page, '[data-dose="0.5"]'); await idle(page);
  const ev = [];
  ev.push(await shot(page, '09a-agcl-nh3-0-5ml-beginn', await tubeClip(page, 0)));
  await adv(page, 1500);
  const mid = (await tube(page, 0)).solid;
  await adv(page, 30000); await page.locator('#btnShake').click(); await adv(page, 30000);
  const rest = (await tube(page, 0)).solid;
  ev.push(await shot(page, '09b-agcl-rest-bei-zu-wenig-nh3', await tubeClip(page, 0)));
  assert(mid < p0 && rest > 0.5 * p0 && rest < 0.8 * p0, `Rest bei 0,5 mL: ${(rest / p0).toFixed(3)}`);
  await btn(page, '[data-dose="1"]'); await idle(page);
  const seq = [];
  // 1.1.0: schnelleres, aber weiterhin fortschreitendes Auflösen – Abtastung alle 0,5 s
  for (let i = 0; i < 4; i++) { await adv(page, 500); seq.push((await tube(page, 0)).solid / p0); ev.push(await shot(page, `09c-agcl-loest-sich-${i + 1}`, await tubeClip(page, 0))); }
  await page.locator('#btnShake').click(); await adv(page, 20000);
  const end = (await tube(page, 0)).solid;
  assert(seq[0] < 1 && seq.every((v, i) => !i || v < seq[i - 1]) && seq[0] > 0.02, 'fortschreitend, nicht schlagartig: ' + seq.map((v) => v.toFixed(2)));
  assert(end < 1e-12, 'mit 1,5 mL verdünnter NH₃ gelöst');
  writeEvidence('E09-agcl.json', { start_mol: p0, nach_0_5mL: rest / p0, verlauf_nach_weiterem_1mL: seq, ende: end });
  await done();
  return { detail: `Rest ${(rest / p0).toFixed(2)}, Verlauf ${seq.map((v) => v.toFixed(2)).join('→')}`, evidence: ev.concat(['docs/evidence/E09-agcl.json']) };
});

// =========================================================== E10 NH₃ und AgBr (zwei frische, gleiche Ansätze)
await scenario('E10', 'FL11', 'AgBr: zwei frisch gleich angesetzte Proben – verdünnt weitgehend beständig, konzentriert löslich', async () => {
  const { page, done } = await open();
  await fill(page, 'nabr', 0); await fill(page, 'nabr', 1);
  for (const s of [0, 1]) { await over(page, 'agno3', s); await btn(page, '[data-dose="n5"]'); await idle(page); await btn(page, '[data-dose="n5"]'); await idle(page); }
  await adv(page, 3500);
  const a = await tube(page, 0), b = await tube(page, 1);
  assert(a.ansatz !== b.ansatz && rel(a.solid, b.solid) < 1e-9, 'zwei getrennte, gleich angesetzte Ansätze');
  await over(page, 'nh3dil', 0); await btn(page, '[data-dose="1"]'); await idle(page); await btn(page, '[data-dose="1"]'); await idle(page); await btn(page, '[data-dose="0.5"]'); await idle(page);
  await over(page, 'nh3conc', 1); await btn(page, '[data-dose="1"]'); await idle(page); await btn(page, '[data-dose="1"]'); await idle(page); await btn(page, '[data-dose="0.5"]'); await idle(page);
  await tubeHit(page, 0); await page.locator('#btnShake').click(); await adv(page, 200);
  await page.locator('.hit.pip').click(); await idle(page);
  await tubeHit(page, 1); await page.locator('#btnShake').click();
  await adv(page, 25000);
  const ra = (await tube(page, 0)).solid / a.solid, rb = (await tube(page, 1)).solid / b.solid;
  const ev = [await shot(page, '10-agbr-verduennt-links-konzentriert-rechts')];
  assert(ra > 0.9, 'verdünnt: > 90 % bleiben, ' + ra.toFixed(3));
  assert(rb < 0.15, 'konzentriert: weitgehend gelöst, ' + rb.toFixed(3));
  await done();
  return { detail: `Rest verdünnt ${ra.toFixed(2)}, konzentriert ${rb.toFixed(2)} (je 2,5 mL)`, evidence: ev };
});

// =========================================================== E11 NH₃ und AgI
await scenario('E11', 'FL12', 'AgI bleibt auch bei viel konzentrierter NH₃ sichtbar bestehen', async () => {
  const { page, done } = await open();
  await fill(page, 'nai', 0); await over(page, 'agno3', 0); await btn(page, '[data-dose="n5"]'); await idle(page); await btn(page, '[data-dose="n5"]'); await idle(page);
  await adv(page, 3000);
  const p0 = (await tube(page, 0)).solid;
  await over(page, 'nh3conc', 0); for (let i = 0; i < 6; i++) { await btn(page, '[data-dose="1"]'); await idle(page); }
  await page.locator('#btnShake').click(); await adv(page, 30000);
  const r = (await tube(page, 0)).solid / p0;
  const img = decodePng(await page.screenshot());
  const reg = await tubeRegion(page, 0, 860, 'bottom', 0.4);
  const y = yellowness(meanRGB(img, reg.x0, reg.y0, reg.x1, reg.y1));
  const ev = [await shot(page, '11-agi-mit-6-ml-konz-nh3', await tubeClip(page, 0))];
  assert(r > 0.95 && y > 0.12, `AgI-Rest ${r.toFixed(3)}, sichtbar gelblich ${y.toFixed(3)}`);
  await done();
  return { detail: `Rest ${(r * 100).toFixed(1)} % nach 6 mL konz. NH₃`, evidence: ev };
});

// =========================================================== E12 Grenzen der Anleitung
await scenario('E12', 'FL13', 'Vorgänge außerhalb der Anleitung: kein Stofftransfer, kurzer Hinweis, danach weiter bedienbar', async () => {
  const { page, done } = await open();
  await fill(page, 'nacl', 0);
  const snap = () => S(page, (A) => JSON.stringify(A.lab.tab().tubes.map((t) => [t.V, t.n, t.log])));
  const before = await snap();
  const cases = [];
  const expectForbid = async (name) => {
    await adv(page, 120);
    assert(await page.locator('#forbid').isVisible(), name + ': Verbotszeichen sichtbar');
    assert((await page.locator('#forbidText').innerText()) === 'Dieser Vorgang entspricht nicht der Experimentieranleitung.', 'Text');
    assert(await page.locator('#forbid').getAttribute('role') === 'alert', 'zugänglich angekündigt');
    cases.push({ fall: name, grund: await page.locator('#forbidReason').innerText() });
  };
  await bottle(page, 'nh3dil'); await adv(page, 400); await tubeHit(page, 0); await expectForbid('NH₃ vor Silbernitrat');
  const ev = [await shot(page, '12a-verbotszeichen-nh3-vor-agno3')];
  await bottle(page, 'nabr'); await adv(page, 400); await tubeHit(page, 0); await expectForbid('zweite andere Probe');
  await bottle(page, 'agno3'); await adv(page, 400); await tubeHit(page, 1); await expectForbid('Silbernitrat in leeres Glas');
  // Umfüllen in eine Vorratsflasche (Pipette auf eine Flasche ziehen)
  const pip = await page.locator('.hit.pip').boundingBox();
  const target = await page.locator('.hit.bottle[data-bottle="nacl"]').boundingBox();
  await page.mouse.move(pip.x + pip.width / 2, pip.y + pip.height / 2); await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height * 0.75, { steps: 8 }); await page.mouse.up();
  await expectForbid('Umfüllen in Vorratsflasche');
  assert((await snap()) === before, 'Zustand unverändert');
  await adv(page, 3300);
  assert(!(await page.locator('#forbid').isVisible()), 'Zeichen verschwindet wieder');
  // korrekte Handlung danach ohne Sackgasse
  await tubeHit(page, 0); await idle(page); await dropTap(page);
  assert((await tube(page, 0)).log.agDrops === 1, 'danach korrekt weiter');
  await over(page, 'nh3dil', 0); await dropTap(page); await adv(page, 300); await dropTap(page);
  assert(rel((await tube(page, 0)).log.nh3dilV, 0.1) < TOL, 'weitere NH₃-Zugabe nicht blockiert');
  writeEvidence('E12-grenzen.json', cases);
  await done();
  return { detail: cases.length + ' Fälle abgewiesen', evidence: ev.concat(['docs/evidence/E12-grenzen.json']) };
});

// =========================================================== E13 Kontrollversuche unabhängig
await scenario('E13', 'FL14, FL15, FL16', 'Kontrollteil zuerst nutzbar; positiv trüb, Blindprobe klar, Alltagswasser plausibel trüb; Zustände getrennt', async () => {
  const { page, done } = await open();
  await part(page, 'control'); await adv(page, 200);
  const keys = ['nacl', 'water', 'tap', 'mineral'];
  for (let i = 0; i < 4; i++) await fill(page, keys[i], i);
  for (let i = 0; i < 4; i++) { await over(page, 'agno3', i); await btn(page, '[data-dose="n5"]'); await idle(page); }
  await adv(page, 2500);
  const ev = [await shot(page, '13a-kontrollen-trueb-verteilt')];
  const t = await Promise.all([0, 1, 2, 3].map((i) => tube(page, i, 'control')));
  assert(t.every((x) => rel(x.V, 2.25) < TOL && x.log.agDrops === 5), 'gleiche Volumina, gleiche Tropfenzahl');
  assert(t[1].solid === 0, 'Blindprobe ohne Fällung');
  assert(t[0].solid > 10 * t[2].solid && t[2].solid > 0 && t[3].solid > t[2].solid, 'Positivkontrolle deutlich, Wasserproben schwächer');
  const img = decodePng(await page.screenshot());
  const L = [];
  for (let i = 0; i < 4; i++) { const r = await tubeRegion(page, i, 'surface', 'bottom', 0.45); L.push(lum(meanRGB(img, r.x0, r.y0, r.x1, r.y1))); }
  assert(L[0] > L[2] && L[2] > L[1] + 0.02 && L[3] > L[1] + 0.02, 'sichtbar: positiv > Wasser > Blindprobe ' + L.map((v) => v.toFixed(3)));
  // Auswertung: Aussage verbindlich, keine Halogenidaufgabe zur Wasserprobe
  await ptab(page, 'tasks'); await adv(page, 100);
  let txt = await page.locator('#panelBody').innerText();
  assert(!/Chlorid.*(Leitungswasser|Mineralwasser).*Gleichung/.test(txt) && !/eqCl|Ionengleichung/.test(txt), 'keine Halogenid-Formelaufgabe zur Wasserprobe');
  await page.locator('[data-act="solution"]').click(); await page.locator('[data-act="solutionYes"]').click(); await adv(page, 100);
  txt = await page.locator('#panelBody').innerText();
  assert(txt.includes('Leitungs- und Mineralwasser enthalten verschiedene gelöste Ionen. Bei Zugabe von Silbernitratlösung können mehrere schwer lösliche Silberverbindungen entstehen. Der Niederschlag kann deshalb ein Stoffgemisch sein. Welche Ionen darin enthalten sind, lässt sich mit diesem Versuch allein nicht eindeutig feststellen.'), 'verbindliche Aussage');
  const det = page.locator('details.more');
  assert((await det.count()) === 1 && (await det.getAttribute('open')) === null && /Salpetersäure/.test(await det.textContent()) && !/Salpetersäure/.test(txt), 'Ansäuern nur als optionale, zugeklappte Erläuterung');
  assert((await page.locator('.hit.bottle').evaluateAll((b) => b.map((x) => x.dataset.bottle))).join() === 'nacl,water,tap,mineral,agno3', 'keine Säure- oder Carbonatflasche');
  ev.push(await shot(page, '13b-kontrolle-auswertung'));
  // Wechsel zum Hauptteil und zurück: Zustände getrennt erhalten
  await part(page, 'main'); await adv(page, 200);
  const main = await Promise.all([0, 1, 2].map((i) => tube(page, i, 'main')));
  assert(main.every((x) => x.V === 0), 'Hauptteil unberührt');
  await fill(page, 'nacl', 0);
  await part(page, 'control'); await adv(page, 200);
  const t2 = await Promise.all([0, 1, 2, 3].map((i) => tube(page, i, 'control')));
  assert(t2.every((x, i) => x.ansatz === t[i].ansatz && rel(x.solid, t[i].solid) < TOL), 'Kontrollzustand erhalten');
  writeEvidence('E13-kontrollen.json', { feststoff_mol: t.map((x) => x.solid), helligkeit: L });
  await done();
  return { detail: `Helligkeit K1–K4 ${L.map((v) => v.toFixed(2)).join(' / ')}`, evidence: ev.concat(['docs/evidence/E13-kontrollen.json']) };
});

// =========================================================== E14 Aufgaben: Formate, Rückmeldung, Hilfen, Lösung
await scenario('E14', 'FL14, FL17, FL18, FL19', 'Auswahlaufgaben: leer/alles/teilweise/falsch/richtig; Gleichungen; Hilfen 1–3; Lösung bewusst; Hauptteil ohne Kontrollen abschließbar', async () => {
  const { page, done } = await open();
  // Keine automatische Produktauflösung: Labor und Protokoll ohne Stoffnamen der Niederschläge
  await precipitateAll(page, 4);
  await tubeHit(page, 0); await ptab(page, 'obs'); await adv(page, 100);
  assert(!PRODUCTS.test(await page.locator('#panelBody').innerText()), 'Protokoll ohne Produktnamen');
  await page.locator('.hit.pip').click(); await idle(page);
  await ptab(page, 'tasks'); await adv(page, 100);
  const grade = async () => { await page.locator('#lkStepForm [data-act="grade"]').click(); await adv(page, 80); };
  // Schritt 1 leer
  await grade();
  assert(/0 von 4 Antworten richtig/.test(await page.locator('#panelBody').innerText()), 'leer besteht nicht');
  // alles ankreuzen
  const ABL = ['wolke', 'verteilt', 'absetzen', 'aufwirbeln', 'schwenkenLoest', 'vorherTrueb'];
  for (const k of ABL) await page.locator(`input[name="ablauf"][value="${k}"]`).check();
  await grade();
  let fb = await page.locator('fieldset[data-q="ablauf"] .lk-fb').innerText();
  assert(/trifft nicht zu/.test(fb) && /4 angekreuzte Aussagen treffen zu/.test(fb), '„alles ankreuzen“ besteht nicht, konkrete Rückmeldung: ' + fb);
  // teilweise richtig
  for (const k of ABL.slice(2)) await page.locator(`input[name="ablauf"][value="${k}"]`).uncheck();
  await grade();
  fb = await page.locator('fieldset[data-q="ablauf"] .lk-fb').innerText();
  assert(/2 angekreuzte Aussagen treffen zu\. Es fehlen noch 2 zutreffende Aussagen/.test(fb), 'Teilantwort benannt: ' + fb);
  // Hilfen 1–3 und Lösung mit Rückfrage
  for (let i = 1; i <= 3; i++) { await page.locator('[data-act="tip"]').first().click(); await adv(page, 50); assert((await page.locator('.lk-tipbox p').count()) === i, 'Tipp ' + i); }
  await page.locator('[data-act="solution"]').click(); await adv(page, 50);
  assert(await page.locator('[data-act="solutionYes"]').isVisible(), 'Rückfrage vor der Lösung');
  await page.locator('[data-act="solutionNo"]').click();
  // richtig beantworten
  await page.locator('select[name="farbe.nacl"]').selectOption('weiss');
  await page.locator('select[name="farbe.nabr"]').selectOption('creme');
  await page.locator('select[name="farbe.nai"]').selectOption('gelb');
  for (const k of ['absetzen', 'aufwirbeln']) await page.locator(`input[name="ablauf"][value="${k}"]`).check();
  await grade();
  assert(/Alles richtig/.test(await page.locator('#panelBody').innerText()), 'Schritt 1 richtig');
  const ev = [await shot(page, '14a-aufgabe-1-richtig')];
  // Schritt 2 mit Fehlvorstellung, dann Korrektur
  await page.locator('.lk-stepchips [data-step="ionen"]').click(); await adv(page, 50);
  for (const [r, v] of [['ag', 'fest'], ['x', 'fest'], ['na', 'fest'], ['no3', 'zus']]) await page.locator(`select[name="rolle.${r}"]`).selectOption(v);
  for (const k of ['zuschauerGeloest', 'naImFeststoff']) await page.locator(`input[name="aussagen"][value="${k}"]`).check();
  await grade();
  const t2 = await page.locator('#panelBody').innerText();
  assert(/Na⁺ bleibt gelöst/.test(t2), 'Rückmeldung zur Fehlvorstellung Na⁺');
  await page.locator('select[name="rolle.na"]').selectOption('zus');
  await page.locator('input[name="aussagen"][value="naImFeststoff"]').uncheck(); await page.locator('input[name="aussagen"][value="feststoffIonen"]').check();
  await grade();
  assert(/Alles richtig/.test(await page.locator('#panelBody').innerText()), 'Schritt 2 nach Korrektur richtig');
  // Schritt 3: gekürzte Gleichung → spezielle Rückmeldung; dann vollständig
  await page.locator('.lk-stepchips [data-step="gleich"]').click(); await adv(page, 50);
  const opts = await page.$$eval('fieldset[data-q="eqCl"] .lk-opt', (l) => l.map((x) => ({ v: x.querySelector('input').value, t: x.innerText.trim() })));
  const net = opts.find((o) => o.t === 'Ag⁺(aq) + Cl⁻(aq) → AgCl(s)');
  const full = opts.find((o) => o.t === 'Na⁺(aq) + Cl⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgCl(s) + Na⁺(aq) + NO₃⁻(aq)');
  assert(net && full, 'Optionen mit Ladungen und Zustandsangaben');
  await page.locator(`input[name="eqCl"][value="${net.v}"]`).check(); await grade();
  assert((await page.locator('fieldset[data-q="eqCl"] .lk-fb').innerText()).includes('Die Fällungsreaktion ist richtig dargestellt. Ergänze die Zuschauerionen zur vollständigen Ionengleichung.'), 'gekürzte Gleichung erläutert');
  ev.push(await shot(page, '14b-gleichung-gekuerzt-rueckmeldung'));
  for (const [q, X] of [['eqCl', 'Cl'], ['eqBr', 'Br'], ['eqI', 'I']]) {
    const o = await page.$$eval(`fieldset[data-q="${q}"] .lk-opt`, (l) => l.map((x) => ({ v: x.querySelector('input').value, t: x.innerText.trim() })));
    const f = o.find((x) => x.t === `Na⁺(aq) + ${X}⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → Ag${X}(s) + Na⁺(aq) + NO₃⁻(aq)`);
    await page.locator(`input[name="${q}"][value="${f.v}"]`).check();
  }
  await grade();
  assert(/Alles richtig/.test(await page.locator('#panelBody').innerText()), 'Gleichungen richtig');
  // Gleichungen ohne Abschneiden (Kartenbreite)
  const clip = await page.$$eval('#panelBody .lk-opt span', (s) => s.filter((x) => x.scrollWidth > x.clientWidth + 1).length);
  assert(clip === 0, 'Gleichungen umbrechen statt abgeschnitten');
  const prog = await page.locator('.progress').innerText();
  assert(/3 von 3/.test(prog), 'Hauptteil abgeschlossen ohne Kontrollbesuch und ohne Ammoniakerweiterung: ' + prog);
  const visited = await S(page, (A) => A.lab.tab('control').counter);
  assert(visited === 0, 'Kontrollteil nicht benutzt');
  // Ammoniakschritt: Lösung bewusst anfordern
  await page.locator('.lk-stepchips [data-step="nh3"]').click(); await page.locator('[data-act="solution"]').click(); await page.locator('[data-act="solutionYes"]').click(); await adv(page, 50);
  assert(await page.locator('[data-act="hideSolution"]').isVisible(), 'Lösung angezeigt, eigene Antworten wieder einblendbar');
  ev.push(await shot(page, '14c-ammoniak-loesung-angefordert'));
  // Wechsel des Versuchsteils erhält Eingaben
  await part(page, 'control'); await part(page, 'main'); await ptab(page, 'tasks'); await page.locator('.lk-stepchips [data-step="beob"]').click(); await adv(page, 50);
  assert((await page.locator('select[name="farbe.nai"]').inputValue()) === 'gelb', 'Eingaben bleiben beim Reiterwechsel');
  await done();
  return { detail: 'leer/alles/teilweise/Fehlvorstellung/richtig, Hilfen 1–3, Lösung mit Rückfrage', evidence: ev };
});

// =========================================================== E15 Protokoll und Ergebnisübersicht
await scenario('E15', 'FL14, FL19', 'Beobachtung speichern; veränderter Ansatz wird dem alten Stand zugeordnet und markiert; gespülter Ansatz bleibt', async () => {
  const { page, done } = await open();
  await fill(page, 'nacl', 0); await over(page, 'agno3', 0); for (let i = 0; i < 5; i++) await dropTap(page);
  await page.locator('.hit.pip').click(); await idle(page);
  await tubeHit(page, 0); await ptab(page, 'obs'); await adv(page, 100);
  await page.locator('input[name="trueb"][value="stark"]').check(); await page.locator('input[name="farbe"][value="weiss"]').check();
  await page.locator('#obsForm textarea').fill('Wolke sofort, setzt sich ab');
  await page.locator('#obsForm button[type="submit"]').click(); await adv(page, 100);
  let ov = await page.locator('ul.overview').innerText();
  assert(/A1/.test(ov) && /aktueller Stand/.test(ov) && /AgNO₃ 5 Tr\./.test(ov), 'gespeichert mit Zugaben');
  await over(page, 'nh3dil', 0); await btn(page, '[data-dose="1"]'); await idle(page); await adv(page, 300);
  ov = await page.locator('ul.overview').innerText();
  assert(/Ansatz seither verändert/.test(ov) && /früheren Stand/.test(ov), 'Hinweis auf veränderten Ansatz, alte Notiz bleibt');
  assert(await page.locator('fieldset legend', { hasText: 'Nach Zugabe von Ammoniaklösung' }).count() === 1, 'Ammoniakfeld erscheint');
  await page.locator('input[name="nh3"][value="geloest"]').check();
  await page.locator('#obsForm button[type="submit"]').click(); await adv(page, 100);
  await page.locator('.hit.pip').click(); await idle(page);
  await tubeHit(page, 0); await page.locator('#btnRinse').click(); await idle(page); await adv(page, 200);
  ov = await page.locator('ul.overview').innerText();
  assert((ov.match(/Ansatz beendet/g) || []).length === 2, 'gespülter Ansatz bleibt mit Hinweis');
  const ev = [await shot(page, '15-protokoll-ergebnisuebersicht')];
  await done();
  return { detail: '2 Einträge, Hinweise „verändert“ und „beendet“', evidence: ev };
});

// =========================================================== E16 Hefteintrag
await scenario('E16', 'FL20', 'Hefteintrag sofort erreichbar, knapp, sachlich; Kontroll-Kurzfassung separat', async () => {
  const { page, done } = await open();
  await page.locator('#btnNotebook').click(); await adv(page, 100);
  const txt = await page.locator('#nbText').innerText();
  const words = txt.replace(/^Zum Abschluss – für dein Heft\s*/, '').replace(/Ag⁺\(aq\) \+ X⁻\(aq\) → AgX\(s\),/, '').split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;
  assert(words >= 80 && words <= 110, 'Wortzahl inkl. Titel und Legende: ' + words);
  for (const m of ['Fällungsreaktion', 'weiß', 'cremefarben bis schwach gelb', 'blassgelb', 'Zuschauerionen', 'Ag⁺(aq) + X⁻(aq) → AgX(s)', 'X = Cl, Br oder I', 'verdünnter Ammoniaklösung', 'ungelöst']) assert(txt.includes(m), 'fehlt: ' + m);
  assert(!/Kontroll|Leitungswasser/.test(txt), 'Kontrollzusatz nicht angehängt');
  const ev = [await shot(page, '16a-hefteintrag-sofort')];
  await page.keyboard.press('Escape');
  await part(page, 'control'); await ptab(page, 'note'); await adv(page, 100);
  const k = await page.locator('#panelBody').innerText();
  assert(/Positivkontrolle/.test(k) && /Blindprobe/.test(k), 'Kurzfassung Kontrollen im Kontrollteil');
  ev.push(await shot(page, '16b-kurzfassung-kontrollen'));
  await done();
  return { detail: words + ' Wörter', evidence: ev };
});

// =========================================================== E17 Hell/dunkel
await scenario('E17', 'FL21', 'Hintergrundwechsel ändert keine Chemie, Mengen oder Zeit; Niederschläge auf beiden Hintergründen erkennbar', async () => {
  const { page, done } = await open();
  await precipitateAll(page, 8);
  await speed(page, 5); await adv(page, 15000); await idle(page); await speed(page, 0);
  const st = () => S(page, (A) => JSON.stringify({ t: A.lab.state.time, tubes: A.lab.tab().tubes.map((t) => [t.V, t.susp, t.sed, t.front, t.n]) }));
  const a = await st();
  const meas = async () => { const img = decodePng(await page.screenshot()); const out = []; for (const s of [0, 1, 2]) { const r = await tubeRegion(page, s, 867, 'bottom', 0.4); const r2 = await tubeRegion(page, s, 'surface', 850, 0.4); const a = meanRGB(img, r.x0, r.y0, r.x1, r.y1), c = meanRGB(img, r2.x0, r2.y0, r2.x1, r2.y1); out.push({ sed: lum(a), clear: lum(c), dist: Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]) / 255, rgbSed: a.map(Math.round), rgbClear: c.map(Math.round) }); } return out; };
  const dark = await meas();
  const ev = [await shot(page, '17a-hintergrund-dunkel')];
  await page.locator('#btnTheme').click(); await adv(page, 200);
  const b = await st();
  assert(a === b, 'Zustand unverändert');
  const light = await meas();
  ev.push(await shot(page, '17b-hintergrund-hell'));
  // Kriterien: weißer Bodensatz (AgCl) über die Helligkeit, alle drei über den Farbabstand (getönte Niederschläge
  // unterscheiden sich vor hellem Grund vor allem im Farbton, nicht in der Helligkeit)
  for (const m of [dark, light]) {
    assert(Math.abs(m[0].sed - m[0].clear) > 0.035, `weißer Bodensatz hebt sich ab (${m[0].sed.toFixed(3)} vs ${m[0].clear.toFixed(3)})`);
    for (const x of m) assert(x.dist > 0.08, `Bodensatz vom Überstand unterscheidbar (Farbabstand ${x.dist.toFixed(3)})`);
  }
  assert((await page.locator('html').getAttribute('data-theme')) === 'light', 'Schema gesetzt');
  await page.locator('#btnTheme').click(); await adv(page, 100);
  writeEvidence('E17-kontrast.json', { dunkel: dark, hell: light, methode: 'mittlere Helligkeit Bodensatz vs. klarer Überstand je Glas' });
  await done();
  return { detail: 'Farbabstand Bodensatz/Überstand min. ' + Math.min(...[...dark, ...light].map((x) => x.dist)).toFixed(3), evidence: ev.concat(['docs/evidence/E17-kontrast.json']) };
});

// =========================================================== E18 Tablet/Desktop-Formate, Splitter
const VIEWS = [[1024, 768], [1180, 820], [1440, 900], [1920, 1080], [820, 1180]];
await scenario('E18', 'FL23', 'Formate 1024×768, 1180×820, 1440×900, 1920×1080, 820×1180: Labor groß, Bedienung erreichbar, nichts abgeschnitten; Splitter', async () => {
  const ev = [], rows = [];
  for (const [w, h] of VIEWS) {
    const { page, done } = await open({ viewport: { width: w, height: h }, hasTouch: true });
    await fill(page, 'nai', 0); await over(page, 'agno3', 0); await dropTap(page);
    const m = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      return { scrollW: document.documentElement.scrollWidth, vw: innerWidth, tube: r('.hit.tube[data-slot="0"]'), drop: r('#btnDrop'), speed: r('#speed'), shake: r('#btnShake'), parts: r('#parts'), nb: r('#btnNotebook'), panelOverflow: document.getElementById('panel').scrollWidth - document.getElementById('panel').clientWidth };
    });
    assert(m.scrollW <= m.vw + 1, `${w}×${h}: kein horizontales Scrollen`);
    assert(m.tube.h >= 200 && m.tube.w >= 44, `${w}×${h}: Reagenzglas groß genug (${Math.round(m.tube.w)}×${Math.round(m.tube.h)})`);
    for (const k of ['drop', 'speed', 'shake', 'parts', 'nb']) { const b = m[k]; assert(b && b.x >= 0 && b.x + b.w <= w + 1 && b.h >= 36, `${w}×${h}: ${k} erreichbar`); }
    assert(m.panelOverflow <= 1, `${w}×${h}: Bedienfeld ohne horizontales Abschneiden`);
    await ptab(page, 'tasks'); await page.locator('.lk-stepchips [data-step="gleich"]').click(); await adv(page, 50);
    const clipped = await page.$$eval('#panelBody .lk-opt span, #panelBody legend', (s) => s.filter((x) => x.scrollWidth > x.clientWidth + 1).length);
    assert(clipped === 0, `${w}×${h}: Gleichungen nicht abgeschnitten`);
    ev.push(await shot(page, `18-format-${w}x${h}`));
    rows.push({ format: `${w}×${h}`, reagenzglasPx: [Math.round(m.tube.w), Math.round(m.tube.h)] });
    await done();
  }
  // Splitter: Maus ziehen, Tastatur, Doppelklick zurück, Touch ziehen (CDP)
  const { page, done } = await open({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  const pw = () => page.evaluate(() => document.getElementById('panel').getBoundingClientRect().width);
  const w0 = await pw();
  const sp = await page.locator('#splitter').boundingBox();
  await page.mouse.move(sp.x + sp.width / 2, sp.y + 300); await page.mouse.down(); await page.mouse.move(sp.x - 150, sp.y + 300, { steps: 6 }); await page.mouse.up();
  const w1 = await pw();
  assert(w1 > w0 + 100, 'Maus: Bedienfeld breiter ' + w0 + '→' + w1);
  await page.locator('#splitter').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const w2 = await pw();
  assert(Math.abs(w2 - (w1 - 48)) <= 2, 'Tastatur ±24 px');
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft');
  assert((await pw()) <= 620 + 1, 'Höchstbreite 620 px');
  await page.locator('#splitter').dblclick(); await adv(page, 50);
  assert(Math.abs((await pw()) - w0) <= 2, 'Doppelklick setzt zurück');
  const cdp = await page.context().newCDPSession(page);
  const sb = await page.locator('#splitter').boundingBox();
  const y = sb.y + 300, x0 = sb.x + sb.width / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - i * 20, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert((await pw()) > w0 + 80, 'Finger: Bedienfeld breiter');
  await done();
  writeEvidence('E18-formate.json', rows);
  return { detail: rows.map((r) => `${r.format}: Glas ${r.reagenzglasPx.join('×')} px`).join('; '), evidence: ev.concat(['docs/evidence/E18-formate.json']), viewport: VIEWS.map((v) => v.join('×')).join(', '), input: 'Maus, Tastatur, Touch (emuliert, CDP)' };
});

// =========================================================== E19 Abbruchwege
await scenario('E19', 'FL24', 'Dauerzugabe endet bei pointercancel, Fokusverlust und verborgenem Tab; keine Hintergrunddosierung', async () => {
  const { page, done } = await open();
  await fill(page, 'nacl', 0); await over(page, 'agno3', 0);
  const n = async () => (await tube(page, 0)).log.agDrops + await S(page, (A) => A.lab.state.drops.length);
  const stops = {};
  for (const [name, fn] of [
    ['pointercancel', () => page.locator('#btnDrop').dispatchEvent('pointercancel')],
    ['Fokusverlust (blur)', () => page.evaluate(() => window.dispatchEvent(new Event('blur')))],
    ['Tab verborgen', () => page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); })]
  ]) {
    const b = await page.locator('#btnDrop').boundingBox();
    await page.mouse.move(b.x + 20, b.y + 10); await page.mouse.down();
    await adv(page, 900);
    await fn();
    await adv(page, 100);
    const a = await n();
    await adv(page, 2000);
    const c = await n();
    await page.mouse.up();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
    assert(c === a, `${name}: keine weiteren Tropfen (${a} → ${c})`);
    stops[name] = a;
    await idle(page); await adv(page, 300);
  }
  // Tabwechsel während der Dosierhilfe: abgeschlossen, keine Fortsetzung im anderen Teil
  await over(page, 'water', 0); await btn(page, '[data-dose="1"]'); await adv(page, 400);
  await part(page, 'control'); await adv(page, 2000);
  const v1 = (await tube(page, 0, 'main')).V;
  await adv(page, 2000);
  assert((await tube(page, 0, 'main')).V === v1, 'Wechsel des Versuchsteils beendet die Zugabe');
  assert(await S(page, (A) => A.lab.state.pip.key === null), 'Pipette zurück');
  await done();
  return { detail: JSON.stringify(stops) };
});

// =========================================================== E20 Pause, Zurücksetzen, Speicher
await scenario('E20', 'FL25', 'Pause blockiert nicht; Neuladen stellt stabil wieder her; Glas spülen vs. alles zurücksetzen; ohne Speicher lauffähig', async () => {
  const { page, context, done } = await open({ clock: false });
  await fill(page, 'nacl', 0); await over(page, 'agno3', 0); await dropTap(page);
  await speed(page, 0);
  const f0 = (await tube(page, 0)).front;
  await adv(page, 800);
  assert((await tube(page, 0)).front === f0, 'Pause hält das Absetzen an');
  await page.locator('#btnDrop').click(); await idle(page);
  assert((await tube(page, 0)).log.agDrops === 2 && (await S(page, (A) => A.lab.state.speed)) === 1, 'Bedienen beendet die Pause');
  assert(/Pause beendet/.test(await toastText(page)), 'Hinweis');
  await speed(page, 0);
  // Neuladen während gedrückter Dosierung
  const b = await page.locator('#btnDrop').boundingBox();
  await page.mouse.move(b.x + 20, b.y + 10); await page.mouse.down(); await adv(page, 500);
  await page.reload(); await page.waitForFunction(() => window.FL && window.FL.app); await adv(page, 600);
  await page.mouse.up();
  const r = await S(page, (A) => ({ speed: A.lab.state.speed, drops: A.lab.state.drops.length, pip: A.lab.state.pip.key, busy: A.lab.busy(), t: A.lab.tube(0) }));
  assert(r.speed === 1 && r.drops === 0 && r.pip === null && !r.busy, 'stabil: nicht pausiert, nichts im Flug, Pipette zurück');
  assert(r.t.ansatz === 'A1' && r.t.log.agDrops >= 2, 'Ansatz wiederhergestellt');
  // gezielt: Glas spülen
  await tubeHit(page, 0); await page.locator('#btnRinse').click(); await idle(page);
  assert((await tube(page, 0)).V === 0, 'Glas leer');
  // alles zurücksetzen mit Bestätigung (Abbrechen, dann Ja)
  await fill(page, 'nai', 1);
  await ptab(page, 'guide'); await page.locator('[data-act="resetAll"]').click(); await page.locator('.modal [data-m="close"]').click();
  assert((await tube(page, 1)).V > 0, 'Abbrechen ändert nichts');
  await page.locator('[data-act="resetAll"]').click(); await page.locator('.modal [data-m="resetYes"]').click(); await adv(page, 200);
  assert((await tube(page, 1)).V === 0 && (await S(page, (A) => A.lab.tab().counter)) === 0, 'alles zurückgesetzt');
  await done();
  // Speicher verweigert
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx2.addInitScript(() => { for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { configurable: true, get() { throw new Error('Speicher gesperrt'); } }); });
  const p2 = await ctx2.newPage();
  const errs = []; p2.on('pageerror', (e) => errs.push(e.message));
  await p2.goto(BASE); await p2.waitForFunction(() => window.FL && window.FL.app);
  await fill(p2, 'nacl', 0); await over(p2, 'agno3', 0); await dropTap(p2);
  assert((await tube(p2, 0)).log.agDrops === 1 && !errs.length, 'ohne Speicher voll bedienbar: ' + errs.join('; '));
  await ctx2.close();
  void context;
  return { detail: 'Pause, Reload, Spülen, Gesamtreset, Speicher gesperrt' };
});

// =========================================================== Abschluss
await browser.close();
server.close();
const ext = allRequests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:'));
results.push({ id: 'E21', fl: 'FL30', title: 'Netzwerk und Konsole über alle Szenarien', status: !ext.length && !allErrors.length ? 'PASS' : 'FAIL', detail: `${allRequests.length} Seitenanfragen, extern: ${ext.length}; Konsolen-/Seitenfehler: ${allErrors.length}${allErrors.length ? ' – ' + allErrors.slice(0, 3).join(' | ') : ''}` });
console.log(`${results[results.length - 1].status} E21 [FL30] Netzwerk/Konsole – ${results[results.length - 1].detail}`);
const out = { date: new Date().toISOString(), version: VERSION, browser: BROWSER, emulated: 'Chromium-Desktop; Touch per Playwright-Emulation (hasTouch, CDP-Touch); kein echtes iPad', target: process.env.E2E_ROOT ? path.relative(APP, ROOT) : 'release/faellungslabor-' + VERSION + '-web.zip (frisch entpackt, HTTP)', results };
if (!ONLY) fs.writeFileSync(path.join(APP, 'tests/e2e/results.json'), JSON.stringify(out, null, 2) + '\n');
const failed = results.filter((r) => r.status !== 'PASS');
console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
