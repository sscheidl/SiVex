// End-to-End-Prüfung der Aggregatzustände im echten Browser (Edge/Chromium über Playwright).
// Bedient ausschließlich die gerenderte Oberfläche; der Modellzustand wird nur gelesen.
// Aufruf: npm run build && node tests/e2e/run.mjs   (ONLY=E01,E05 für einzelne Szenarien)
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '../../scripts/serve.mjs';
import { APP, launch, newPage, S, state, settled, canvasSig, click, substance, level, tab, setTempKeys, setTempMouse, shot, overlaps, sleep, assert } from './lib.mjs';

const ROOT = process.env.E2E_ROOT ? path.resolve(process.env.E2E_ROOT) : path.join(APP, 'dist/aggregatzustaende');
const PORT = Number(process.env.E2E_PORT || 8182);
const BASE = `http://localhost:${PORT}/index.html`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const results = [], allRequests = [], allErrors = [];
const SUBS = { water: [0, 100, -30, 130], iodine: [114, 184, 20, 220], iron: [1538, 2862, 1400, 3000], salt: [801, 1465, 700, 1600] };

async function scenario(id, title, fn) {
  if (ONLY && !ONLY.includes(id)) return;
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ id, title, status: 'PASS', detail: detail || '', ms: Date.now() - t0 });
    console.log(`PASS ${id} ${title}${detail ? ' – ' + detail : ''}`);
  } catch (e) {
    results.push({ id, title, status: 'FAIL', detail: e.message, ms: Date.now() - t0 });
    console.log(`FAIL ${id} ${title} – ${e.stack}`);
  }
}

const browser = await launch();
const server = await serve(ROOT, PORT);
console.log(`Browser: ${browser.__channel} ${browser.version()} · Quelle: ${path.relative(APP, ROOT) || '.'}`);
async function open(opts = {}) {
  const o = await newPage(browser, BASE, opts);
  o.done = async () => { allErrors.push(...o.errors); allRequests.push(...o.requests); await o.context.close(); };
  return o;
}
const phaseOf = (sh) => (sh.s > 0.8 ? 'fest' : sh.l > 0.8 ? 'flüssig' : sh.g > 0.95 ? 'gasförmig' : 'Mischung');

// =========================================================== E01 Start
await scenario('E01', 'Start: Wasser, Stoffebene, 20 °C; Regler, Markierungen, Hinweisleiste; nichts überdeckt das Bild', async () => {
  const { page, errors, done } = await open();
  const st = await state(page);
  assert(st.sub === 'water' && st.level === 'matter' && st.Tset === 20, 'Startzustand');
  assert(phaseOf(st.shares) === 'flüssig', 'Wasser bei 20 °C flüssig');
  assert((await page.locator('#tempOut').innerText()).replace(/\s/g, '') === '20°C', 'Temperaturanzeige');
  const ticks = await page.locator('#ticks .tick').allInnerTexts();
  assert(ticks.some((t) => /Schmelztemperatur\s*0 °C/.test(t)) && ticks.some((t) => /Siedetemperatur\s*100 °C/.test(t)), 'Markierungen Schmelz-/Siedetemperatur: ' + ticks.join(' | '));
  assert(/Gasphase zur Veranschaulichung sichtbar dargestellt/.test(await page.locator('#infobar').innerText()), 'Kennzeichnung der Gasphase');
  assert(await page.locator('#btnCold').isHidden(), 'keine kalte Oberfläche bei Wasser');
  const ov = await overlaps(page);
  assert(!ov.length, 'Überdeckungen: ' + ov.join('; '));
  await shot(page, '01-start-wasser-20');
  await done();
  assert(!errors.length, errors.join(' | '));
  return 'Startzustand korrekt, keine Überdeckung';
});

// =========================================================== E02 Regler
await scenario('E02', 'Temperaturregler: Anzeige sofort, Bild folgt in ≈ 0,5–1 s; Maus, Tastatur (Pfeile, Bild ↑/↓, Pos1/Ende) und Touch', async () => {
  const { page, errors, done } = await open();
  await setTempMouse(page, 80);
  const a = await state(page);
  const out = (await page.locator('#tempOut').innerText()).replace(/\s/g, '');
  assert(Math.abs(a.Tset - 80) <= 2 && out === `${a.Tset}°C`, `Mausklick setzt Wert und Anzeige sofort (${a.Tset}, ${out})`);
  assert(a.Tview < a.Tset - 5, 'Darstellung folgt verzögert');
  const t0 = Date.now();
  await page.waitForFunction((T) => window.AZ.app.model.state.Tview === T, a.Tset, { polling: 20, timeout: 5000 });
  const lag = Date.now() - t0;
  assert(lag > 300 && lag < 1400, `Verzögerung ${lag} ms`);
  await page.locator('#temp').focus();
  const v0 = (await state(page)).Tset;
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  assert((await state(page)).Tset === v0 + 2, 'Pfeiltasten ±1 °C');
  await page.keyboard.press('PageDown');
  assert((await state(page)).Tset === v0 - 8, 'Bild ↓ −10 °C');
  await page.keyboard.press('End');
  assert((await state(page)).Tset === 130, 'Ende = Maximum');
  await page.keyboard.press('Home');
  assert((await state(page)).Tset === -30, 'Pos1 = Minimum');
  assert((await page.locator('#temp').getAttribute('aria-valuetext')) === '−30 °C', 'aria-valuetext mit Einheit');
  await done();
  // Touch (Tablet)
  const t = await open({ hasTouch: true, isMobile: false, viewport: { width: 1180, height: 820 } });
  const box = await t.page.locator('#temp').boundingBox();
  await t.page.touchscreen.tap(box.x + box.width * 0.85, box.y + box.height / 2);
  await sleep(80);
  const ts = await state(t.page);
  assert(ts.Tset > 100, `Antippen der Schiene stellt den Wert ein (${ts.Tset} °C)`);
  const thumb = await t.page.evaluate(() => { const el = document.querySelector('#temp'); return el.getBoundingClientRect().height; });
  assert(thumb >= 44, `Regler mindestens 44 px hoch (${thumb})`);
  await t.done();
  assert(!errors.length && !t.errors.length, errors.concat(t.errors).join(' | '));
  return `Verzögerung der Darstellung ${lag} ms, Touch ${ts.Tset} °C`;
});

// =========================================================== E03 alle Stoffe, alle Bereiche
await scenario('E03', 'Alle vier Stoffe unterhalb, an und oberhalb beider Übergangstemperaturen (Tastatur), Bilder je Zustand', async () => {
  const { page, errors, done } = await open();
  const log = [];
  for (const [id, [mp, bp]] of Object.entries(SUBS)) {
    await substance(page, id);
    const checks = [[mp - 1, (sh) => sh.s > 0.8 && sh.l < 1e-6, 'fest'], [mp, (sh) => sh.s > 0.4 && Math.abs(sh.s - sh.l) < 0.02, 'fest+flüssig'], [mp + 1, (sh) => sh.l > 0.8 && sh.s < 1e-6, 'flüssig'],
      [bp - 1, (sh) => sh.l > 0.8 && sh.s < 1e-6, 'flüssig'], [bp, (sh) => sh.l > 0.4 && sh.g > 0.45, 'flüssig+gas'], [bp + 1, (sh) => sh.g > 0.999, 'gasförmig']];
    for (const [T, ok, name] of checks) {
      await setTempKeys(page, T);
      await settled(page);
      const st = await state(page);
      assert(st.Tset === T, `${id}: Regler auf ${T} °C`);
      assert(ok(st.shares), `${id} bei ${T} °C: ${name} erwartet, Anteile ${JSON.stringify(st.shares)}`);
      assert(st.n === 48 && st.counts.S + st.counts.L + st.counts.G + st.counts.P === 48, `${id}: 48 Teilchen`);
      const label = await page.locator('#matter').getAttribute('aria-label');
      assert(label.includes(`${T}`.replace('-', '−')), 'Bildbeschreibung nennt die Temperatur');
    }
    log.push(id);
  }
  // Bilder je Stoff und Zustand (Stoffebene) sowie die Teilchenebene
  const n = { water: 10, iodine: 20, iron: 30, salt: 40 };
  for (const [id, [mp, bp, min, max]] of Object.entries(SUBS)) {
    await substance(page, id);
    const temps = { fest: id === 'iodine' ? 25 : Math.round((min + mp) / 2), fluessig: Math.round((mp + bp) / 2), gas: max };
    let k = n[id];
    for (const [name, T] of Object.entries(temps)) {
      await setTempKeys(page, T); await settled(page); await sleep(name === 'gas' ? 2800 : 900);
      await shot(page, `${k++}-${id}-${name}`, { x: 0, y: 52, width: 1040, height: 848 });
      await level(page, 'particles'); await sleep(900);
      await shot(page, `${k++}-${id}-${name}-teilchen`, { x: 0, y: 52, width: 1040, height: 848 });
      await level(page, 'matter');
    }
  }
  await done();
  assert(!errors.length, errors.join(' | '));
  return `${log.length} Stoffe × 6 Temperaturen, 24 Bilder`;
});

// =========================================================== E04 Zwischenbilder
await scenario('E04', 'Übergänge als tatsächliche Zwischenbilder in beide Richtungen (Schmelzen, Verdampfen, Kondensieren, Erstarren)', async () => {
  const { page, errors, done } = await open();
  await setTempKeys(page, -20); await settled(page);
  const sig0 = await canvasSig(page, '#matter');
  await setTempKeys(page, 20);
  await page.waitForFunction(() => { const sh = window.AZ.app.model.shares(); return sh.s > 0.3 && sh.l > 0.3; }, null, { polling: 10, timeout: 4000 });
  await shot(page, '50-wasser-schmilzt', { x: 0, y: 52, width: 1040, height: 848 });
  const mid = await state(page);
  assert(mid.proc === 'melting', 'Vorgang Schmelzen');
  await settled(page);
  assert((await canvasSig(page, '#matter')) !== sig0, 'Bild hat sich verändert');
  await setTempKeys(page, 125);
  await page.waitForFunction(() => { const sh = window.AZ.app.model.shares(); return sh.l > 0.3 && sh.g > 0.3; }, null, { polling: 10, timeout: 5000 });
  await sleep(250);
  await shot(page, '51-wasser-verdampft', { x: 0, y: 52, width: 1040, height: 848 });
  assert((await state(page)).proc === 'boiling', 'Vorgang Verdampfen');
  const bubbles = await S(page, (A) => A.matterR.bubbles.length);
  assert(bubbles > 0, 'Siedeblasen sichtbar');
  await settled(page); await sleep(1500);
  await setTempKeys(page, 60);
  await page.waitForFunction(() => window.AZ.app.model.process() === 'condensing', null, { polling: 10, timeout: 4000 });
  await sleep(500);
  const drops = await S(page, (A) => A.matterR.drops.length);
  await shot(page, '52-wasser-kondensiert', { x: 0, y: 52, width: 1040, height: 848 });
  assert(drops > 0, 'Kondenströpfchen an der Glaswand');
  await settled(page);
  await setTempKeys(page, -10);
  await page.waitForFunction(() => { const sh = window.AZ.app.model.shares(); return sh.s > 0.2 && sh.l > 0.2; }, null, { polling: 10, timeout: 5000 });
  assert((await state(page)).proc === 'freezing', 'Vorgang Erstarren');
  await shot(page, '53-wasser-erstarrt', { x: 0, y: 52, width: 1040, height: 848 });
  // Teilchenebene im Übergang
  await settled(page);
  await level(page, 'particles');
  await setTempKeys(page, 5);
  await page.waitForFunction(() => { const c = window.AZ.app.sys.counts(); return c.S > 12 && c.L > 12; }, null, { polling: 10, timeout: 4000 });
  await shot(page, '54-wasser-schmilzt-teilchen', { x: 0, y: 52, width: 1040, height: 848 });
  await done();
  assert(!errors.length, errors.join(' | '));
  return `Blasen ${bubbles}, Tropfen ${drops}`;
});

// =========================================================== E05 Ebenenwechsel synchron
await scenario('E05', 'Stoff- und Teilchenebene synchron: Wechsel mitten im Übergang setzt nichts zurück', async () => {
  const { page, errors, done } = await open();
  await setTempKeys(page, 120);
  await page.waitForFunction(() => { const sh = window.AZ.app.model.shares(); return sh.g > 0.2 && sh.l > 0.2; }, null, { polling: 10, timeout: 4000 });
  const before = await state(page);
  await level(page, 'particles');
  const after = await state(page);
  assert(after.level === 'particles' && after.Tset === before.Tset && after.seq === before.seq, 'gleicher Zustand nach dem Wechsel');
  assert(after.p >= before.p, 'Übergang läuft weiter (kein Rücksprung)');
  assert(await page.locator('#matter').isHidden() && await page.locator('#particles').isVisible(), 'Bildbereich vollständig für die Teilchenebene');
  const pc = await state(page);
  const tg = await S(page, (A) => A.sys.targets(A.model.shares()));
  assert(Math.abs(pc.counts.G - tg.G) <= 4, `Gasteilchen passen zum Modell (${pc.counts.G}/${tg.G})`);
  await level(page, 'matter');
  const back = await state(page);
  assert(back.p >= after.p && back.Tset === 120, 'zurück ohne Zurücksetzen');
  const inf = await page.locator('#infobar').innerText();
  assert(/Gasphase/.test(inf), 'Hinweisleiste passt zur Ansicht');
  await level(page, 'particles');
  assert(/schematisch, nicht maßstabsgetreu/.test(await page.locator('#infobar').innerText()), 'Teilchenebene als schematisch gekennzeichnet');
  await done();
  assert(!errors.length, errors.join(' | '));
  return `p ${before.p.toFixed(2)} → ${back.p.toFixed(2)}`;
});

// =========================================================== E06 rasche Reglerbewegungen
await scenario('E06', 'Rasches Hin- und Herziehen: keine hängenden Animationen, keine verschwundenen Teilchen, flüssige Bildrate', async () => {
  const { page, errors, done } = await open();
  for (const lv of ['matter', 'particles']) {
    await level(page, lv);
    const box = await page.locator('#temp').boundingBox();
    const f0 = await S(page, (A) => A.frames);
    const t0 = Date.now();
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 0; i < 60; i++) { await page.mouse.move(box.x + 22 + Math.abs(Math.sin(i * 0.7)) * (box.width - 44), box.y + box.height / 2, { steps: 2 }); }
    await page.mouse.up();
    const fps = ((await S(page, (A) => A.frames)) - f0) / ((Date.now() - t0) / 1000);
    const mid = await state(page);
    assert(mid.n === 48 && mid.counts.S + mid.counts.L + mid.counts.G === 48, '48 Teilchen während des Ziehens');
    await setTempKeys(page, 50);
    await settled(page); await sleep(1200);
    const st = await state(page);
    assert(phaseOf(st.shares) === 'flüssig' && st.counts.L === 48, `nach dem Ziehen stabil flüssig (${JSON.stringify(st.counts)})`);
    assert(fps > 20, `${lv}: Bildrate beim Ziehen ${fps.toFixed(0)} fps`);
    await setTempKeys(page, -30);
    await setTempKeys(page, 130);
    await setTempKeys(page, 100);
    await settled(page);
    const at = await state(page);
    assert(at.proc === 'atBoiling' && Math.abs(at.shares.g - 0.5) < 0.01, 'genau an der Siedetemperatur: beide Zustände');
    await setTempKeys(page, 20);
  }
  await done();
  assert(!errors.length, errors.join(' | '));
  return 'Stoff- und Teilchenebene';
});

// =========================================================== E07 Stoffwechsel
await scenario('E07', 'Stoffwechsel mitten im Übergang: sauberer Startzustand, nichts wandert mit; Bereich und Markierungen wechseln', async () => {
  const { page, errors, done } = await open();
  await setTempKeys(page, 125);
  await page.waitForFunction(() => window.AZ.app.matterR.puffs.length > 5, null, { polling: 20, timeout: 5000 });
  await substance(page, 'iron');
  const st = await state(page);
  const fx = await S(page, (A) => ({ puffs: A.matterR.puffs.length, bubbles: A.matterR.bubbles.length }));
  assert(st.sub === 'iron' && st.Tset === 1400 && st.shares.s === 1 && st.counts.S === 48, 'Eisen fest bei 1400 °C');
  assert(fx.puffs === 0 && fx.bubbles === 0, `keine Wölkchen/Blasen vom Wasser (${JSON.stringify(fx)})`);
  const sl = await page.evaluate(() => { const e = document.querySelector('#temp'); return [e.min, e.max, e.value]; });
  assert(sl.join() === '1400,3000,1400', 'Reglerbereich des Eisens: ' + sl.join());
  const ticks = (await page.locator('#ticks').innerText()).replace(/\s+/g, ' ');
  assert(/1538 °C/.test(ticks) && /2862 °C/.test(ticks), 'Markierungen 1538/2862 °C');
  for (const id of ['salt', 'iodine', 'water']) {
    await substance(page, id);
    const s = await state(page);
    assert(s.sub === id && s.proc === null, `${id}: Startzustand ohne laufenden Übergang`);
  }
  await done();
  assert(!errors.length, errors.join(' | '));
  return 'Wasser → Eisen → Kochsalz → Iod → Wasser';
});

// =========================================================== E08 Iod
await scenario('E08', 'Iod: Sublimation unter 114 °C, kalte Oberfläche mit Resublimation, flüssiges Iod zwischen 114 und 184 °C', async () => {
  const { page, errors, done } = await open();
  await substance(page, 'iodine');
  assert(await page.locator('#btnCold').isVisible(), 'Schaltfläche nur bei Iod sichtbar');
  await setTempKeys(page, 95);
  await settled(page); await sleep(3500);
  let st = await state(page);
  assert(st.shares.s > 0.8 && st.shares.g > 0.08 && st.shares.l === 0, `festes Iod mit Dampf (${JSON.stringify(st.shares)})`);
  assert(st.counts.G >= 4, `Gasteilchen auf der Teilchenebene (${st.counts.G})`);
  const puffs = await S(page, (A) => A.matterR.puffs.length);
  assert(puffs > 3, 'violette Wölkchen');
  await shot(page, '60-iod-sublimation', { x: 0, y: 52, width: 1040, height: 848 });
  await click(page, '#btnCold');
  assert((await page.locator('#btnCold').getAttribute('aria-pressed')) === 'true' && /ausblenden/.test(await page.locator('#btnCold').innerText()), 'Schaltfläche umgeschaltet');
  await page.waitForFunction(() => window.AZ.app.model.state.c > 0.08, null, { polling: 50, timeout: 20000 });
  await sleep(1500);
  await shot(page, '61-iod-kalte-oberflaeche', { x: 0, y: 52, width: 1040, height: 848 });
  await level(page, 'particles'); await sleep(1200);
  st = await state(page);
  assert(st.counts.P >= 3, `Teilchen an der kalten Oberfläche (${st.counts.P})`);
  await shot(page, '62-iod-kalte-oberflaeche-teilchen', { x: 0, y: 52, width: 1040, height: 848 });
  await level(page, 'matter');
  await setTempKeys(page, 150);
  await settled(page); await sleep(800);
  st = await state(page);
  assert(st.shares.l > 0.6 && st.shares.s === 0, 'flüssiges Iod bei 150 °C');
  await shot(page, '63-iod-fluessig-kalte-oberflaeche', { x: 0, y: 52, width: 1040, height: 848 });
  await click(page, '#btnCold');
  await page.waitForFunction(() => window.AZ.app.model.state.c === 0 && window.AZ.app.model.state.coldVis === 0, null, { polling: 50, timeout: 8000 });
  await substance(page, 'water');
  assert(await page.locator('#btnCold').isHidden(), 'bei Wasser wieder ausgeblendet');
  await done();
  assert(!errors.length, errors.join(' | '));
  return `Wölkchen ${puffs}, Teilchen an der Oberfläche ${st.counts.P}`;
});

// =========================================================== E09 Trennlinie
await scenario('E09', 'Trennlinie: Maus, Touch, Tastatur, Doppelklick; Mindestbreiten; Bild passt sich an', async () => {
  const { page, errors, done } = await open();
  const sp = page.locator('#splitter');
  const pw = () => page.locator('#panel').evaluate((e) => e.getBoundingClientRect().width);
  const cw = () => page.locator('#canvasWrap').evaluate((e) => e.getBoundingClientRect().width);
  const w0 = await pw(), c0 = await cw();
  const b = await sp.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 200); await page.mouse.down();
  await page.mouse.move(b.x - 160, b.y + 200, { steps: 8 }); await page.mouse.up();
  const w1 = await pw();
  assert(w1 > w0 + 100, `Maus: Bedienfeld breiter (${w0} → ${w1})`);
  assert((await cw()) < c0 - 100, 'Bild schmaler');
  const b2 = await sp.boundingBox(); // Trennlinie nach dem Zug neu suchen
  await page.mouse.move(b2.x + b2.width / 2, b2.y + 200); await page.mouse.down();
  await page.mouse.move(b2.x + 900, b2.y + 200, { steps: 8 }); await page.mouse.up();
  assert(Math.round(await pw()) === 300, `Mindestbreite Bedienfeld 300 px (${await pw()})`);
  await sp.focus();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  assert(Math.round(await pw()) === 348, `Tastatur ±24 px (${await pw()})`);
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowLeft');
  const max = await pw(), stage = await page.locator('#stage').evaluate((e) => e.getBoundingClientRect().width);
  assert(max <= 620 && stage >= 460, `Höchstbreite Bedienfeld ${max}, Bühne ${stage}`);
  await sp.dblclick();
  assert(Math.abs((await pw()) - w0) < 2, 'Doppelklick setzt zurück');
  await page.keyboard.press('ArrowLeft');
  await sp.focus(); await page.keyboard.press('Home');
  assert(Math.abs((await pw()) - w0) < 2, 'Pos1 setzt zurück');
  const ov = await overlaps(page);
  assert(!ov.length, ov.join('; '));
  await done();
  // Touch über Zeigerereignisse
  const t = await open({ hasTouch: true, viewport: { width: 1180, height: 820 } });
  const tb = await t.page.locator('#splitter').boundingBox();
  const tw0 = await t.page.locator('#panel').evaluate((e) => e.getBoundingClientRect().width);
  const cx = tb.x + tb.width / 2, cy = tb.y + 300;
  await t.page.locator('#splitter').dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: cx, clientY: cy, isPrimary: true, bubbles: true });
  for (let i = 1; i <= 6; i++) await t.page.locator('#splitter').dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: cx - i * 20, clientY: cy, isPrimary: true, bubbles: true });
  await t.page.locator('#splitter').dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: cx - 120, clientY: cy, isPrimary: true, bubbles: true });
  const tw1 = await t.page.locator('#panel').evaluate((e) => e.getBoundingClientRect().width);
  const hitW = await t.page.evaluate(() => { const s = document.querySelector('#splitter'); return parseFloat(getComputedStyle(s, '::before').left) * -2 + s.getBoundingClientRect().width; });
  assert(tw1 > tw0 + 80, `Touch: ${tw0} → ${tw1}`);
  assert(hitW >= 44, `Touch-Fläche ${hitW} px`);
  await t.done();
  assert(!errors.length && !t.errors.length, errors.concat(t.errors).join(' | '));
  return `Maus ${w0}→${w1}, Touch ${tw0}→${tw1}`;
});

// =========================================================== E10 Fenstergrößen
await scenario('E10', 'Fenstergrößen Desktop/Tablet/Handy: keine Überdeckung, kein waagrechtes Scrollen, Regler und Auswahl erreichbar, Touchziele ≥ 44 px', async () => {
  const sizes = [[1920, 1080], [1440, 900], [1280, 800], [1180, 820], [1024, 768], [820, 1180], [768, 1024], [390, 844]];
  const notes = [];
  for (const [w, h] of sizes) {
    const o = await open({ viewport: { width: w, height: h }, hasTouch: w < 1200 });
    for (const id of ['water', 'iodine']) {
      await substance(o.page, id);
      for (const lv of ['matter', 'particles']) {
        await level(o.page, lv);
        const ov = await overlaps(o.page);
        assert(!ov.length, `${w}×${h} ${id}/${lv}: ${ov.join('; ')}`);
      }
    }
    await level(o.page, 'matter');
    const m = await o.page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const small = [...document.querySelectorAll('.ctrlbar button, .lk-tabs button, .stepchips button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).filter((x) => x.height < 43.5 || x.width < 43.5).length;
      const ticks = [...document.querySelectorAll('#ticks .tick:not([hidden])')].map((t) => t.getBoundingClientRect());
      let tickOverlap = 0;
      for (let i = 0; i < ticks.length; i++) for (let j = i + 1; j < ticks.length; j++) if (ticks[i].right > ticks[j].left && ticks[j].right > ticks[i].left) tickOverlap++;
      const vw = document.documentElement.clientWidth;
      const clipped = [...document.querySelectorAll('#ticks .tick:not([hidden])')].filter((t) => { const b = t.getBoundingClientRect(); return b.left < -0.5 || b.right > vw + 0.5; }).length;
      return { scrollW: document.documentElement.scrollWidth, vw, canvas: r('#canvasWrap'), slider: r('#temp'), subs: r('#subs'), small, tickOverlap, clipped };
    });
    assert(m.scrollW <= m.vw + 1, `${w}×${h}: waagrechtes Scrollen (${m.scrollW} > ${m.vw})`);
    assert(m.canvas.width >= Math.min(300, w - 40) && m.canvas.height >= 240, `${w}×${h}: Bild ${m.canvas.width}×${m.canvas.height}`);
    assert(m.slider.width >= Math.min(260, w - 60), `${w}×${h}: Regler ${m.slider.width} px breit`);
    assert(!m.small, `${w}×${h}: ${m.small} Touchziele unter 44 px`);
    assert(!m.tickOverlap && !m.clipped, `${w}×${h}: Markierungen überlappen (${m.tickOverlap}) oder sind abgeschnitten (${m.clipped})`);
    if (w >= 900) assert(m.slider.bottom <= h + 1 && m.subs.top >= 0, `${w}×${h}: Regler ohne Scrollen sichtbar`);
    if ([1180, 1024, 820, 390].includes(w)) await shot(o.page, `70-groesse-${w}x${h}`);
    notes.push(`${w}×${h}`);
    await o.done();
    assert(!o.errors.length, o.errors.join(' | '));
  }
  return notes.join(', ');
});

// =========================================================== E11 Animation sichtbar
await scenario('E11', 'Animation sichtbar bei gleichbleibender Temperatur (Flüssigkeit, Gas, Feststoff-Schwingung), Teilchen bewegen sich', async () => {
  const { page, errors, done } = await open();
  const changes = async (sel) => { const a = await canvasSig(page, sel); await sleep(400); const b = await canvasSig(page, sel); return a !== b; };
  assert(await changes('#matter'), 'Flüssigkeitsoberfläche bewegt sich');
  await level(page, 'particles');
  for (const T of [-20, 50, 120]) {
    await setTempKeys(page, T); await settled(page); await sleep(600);
    const p0 = await S(page, (A) => A.sys.ps.map((p) => [p.x, p.y]));
    await sleep(500);
    const p1 = await S(page, (A) => A.sys.ps.map((p) => [p.x, p.y]));
    const moved = p0.filter((q, i) => Math.hypot(q[0] - p1[i][0], q[1] - p1[i][1]) > 0.02).length;
    assert(moved > 40, `${T} °C: ${moved} Teilchen bewegen sich`);
    assert(await changes('#particles'), `${T} °C: Bild ändert sich`);
  }
  await level(page, 'matter');
  await setTempKeys(page, 120); await settled(page); await sleep(800);
  assert(await changes('#matter'), 'Gaswölkchen bewegen sich');
  await done();
  assert(!errors.length, errors.join(' | '));
  return 'Stoff- und Teilchenebene animiert';
});

// =========================================================== E12 Aufgaben
await scenario('E12', 'Aufgaben: Rückmeldung je Feld, Tipp nach zwei Fehlversuchen angeboten, drei Stufen, Lösung mit Rückfrage, Antworten bleiben erhalten', async () => {
  const { page, errors, done } = await open();
  await tab(page, 'task');
  // Schritt 1: teilweise falsch
  const sol = await S(page, () => window.AZ.tasks.solutionAnswers('observe'));
  for (const [k, v] of Object.entries(sol)) await page.locator(`#stepForm select[name="${k}"]`).selectOption(k === 'g5' ? 'gas' : v);
  await click(page, '#btnGrade');
  assert(await page.locator('#stepForm select.wrong').count() === 1 && await page.locator('#stepForm select.right').count() === 8, 'ein Feld falsch, acht richtig markiert');
  assert(/2000 °C/.test(await page.locator('.fbline.n').innerText()), 'konkrete Rückmeldung zur falschen Lücke');
  assert(!(await page.locator('#btnTipOffer').count()), 'nach einem Fehlversuch noch kein Tipp-Angebot');
  await click(page, '#btnGrade');
  assert(await page.locator('#btnTipOffer').count() === 1, 'nach zwei Fehlversuchen wird ein Tipp angeboten');
  assert(!(await page.locator('.tipbox').count()), 'Tipp wird nicht von selbst eingeblendet');
  await click(page, '#btnTipOffer'); await click(page, '#btnTip'); await click(page, '#btnTip');
  assert(await page.locator('.tipbox p').count() === 3, 'drei Hilfestufen');
  assert(/Tipp 3\/3/.test(await page.locator('#btnTip').innerText()), 'keine vierte Stufe');
  await click(page, '#btnSolution');
  assert(await page.locator('[role=alert]').filter({ hasText: 'Lösung trotzdem anzeigen' }).count() === 1, 'Rückfrage vor der Lösung');
  await click(page, '#btnSolutionYes');
  assert(await page.locator('#stepForm select.right').count() === 9, 'Lösung zeigt alle Felder richtig');
  await click(page, '#btnHideSolution');
  assert((await page.locator('#stepForm select[name="g5"]').inputValue()) === 'gas', 'eigene Antwort bleibt erhalten');
  await page.locator('#stepForm select[name="g5"]').selectOption('fluessig');
  await click(page, '#btnGrade');
  assert(/Alles richtig/.test(await page.locator('#panelBody').innerText()), 'nach Korrektur alles richtig');
  // Schritt 2 über die Oberfläche
  await click(page, '[data-step="explain"]');
  for (const id of ['q1', 'q2', 'q3']) {
    const cor = await S(page, (A, q) => window.AZ.tasks.STEP_BY_ID.explain.questions.find((x) => x.id === q).correct, id);
    for (const v of cor) await page.locator(`#stepForm input[name="${id}"][value="${v}"]`).check();
  }
  await page.locator('#stepForm input[name="q4"][value="grow"]').check();
  await page.locator('#stepForm input[name="q5"][value="same"]').check();
  await click(page, '#btnGrade');
  assert(/4 von 5/.test(await page.locator('#panelBody').innerText()), 'Schritt 2: 4 von 5');
  assert(/Größe der Symbole/.test(await page.locator('fieldset[data-q="q4"] .lk-fb').innerText()), 'Fehlvorstellung „Teilchen werden größer“ angesprochen');
  await shot(page, '80-aufgabe-rueckmeldung', { x: 1040, y: 52, width: 400, height: 848 });
  // Neuladen: Antworten bleiben
  await page.reload(); await page.waitForFunction(() => window.AZ && window.AZ.app);
  assert((await page.locator('#stepForm input[name="q4"][value="grow"]').isChecked()), 'Antworten nach Neuladen erhalten');
  // Schritt 3 vollständig
  await click(page, '[data-step="transitions"]');
  const s3 = await S(page, () => window.AZ.tasks.solutionAnswers('transitions'));
  for (const [k, v] of Object.entries(s3)) {
    const sel = page.locator(`#stepForm select[name="${k}"]`);
    if (await sel.count()) await sel.selectOption(v); else await page.locator(`#stepForm input[name="${k}"][value="${v}"]`).check();
  }
  await click(page, '#btnGrade');
  assert(/Alles richtig/.test(await page.locator('#panelBody').innerText()), 'Schritt 3 richtig');
  await shot(page, '81-aufgabe-schritt3', { x: 1040, y: 52, width: 400, height: 848 });
  await done();
  assert(!errors.length, errors.join(' | '));
  return 'Schritte 1–3 über die Oberfläche';
});

// =========================================================== E13 Ergebnisse, Hefteintrag, Druck
await scenario('E13', 'Ergebnisse zeigen eigene Beobachtungen; Hefteintrag ohne gelöste Aufgaben erreichbar; Arbeitsblatt druckbar', async () => {
  const { page, errors, done } = await open();
  await click(page, '#btnNotebook');
  const nb = await page.locator('.lk-notebook').innerText();
  for (const w of ['fest', 'flüssig', 'gasförmig', 'Schmelzen', 'Erstarren', 'Verdampfen', 'Kondensieren', 'Sublimieren', 'Resublimieren', 'Kenneigenschaften']) assert(nb.includes(w), 'Hefteintrag enthält ' + w);
  await shot(page, '82-hefteintrag', { x: 1040, y: 52, width: 400, height: 848 });
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await click(page, '#btnPrint');
  assert(await page.evaluate(() => window.__printed) === 1, 'Druck ausgelöst');
  assert(/Kenneigenschaften/.test(await page.locator('#printArea').innerHTML()), 'Arbeitsblatt erzeugt');
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('.lk-app').isHidden() && await page.locator('#printArea').isVisible(), 'Druckansicht zeigt nur das Arbeitsblatt');
  const pdfH = await page.evaluate(() => document.querySelector('#printArea').getBoundingClientRect().height);
  await page.emulateMedia({ media: 'screen' });
  assert(pdfH < 1050, `Arbeitsblatt passt auf eine Seite (${pdfH.toFixed(0)} px)`);
  // Beobachtungen
  await tab(page, 'results');
  assert(/S✓/.test(await page.locator('table.res').first().innerText()), 'Wasser flüssig auf der Stoffebene vermerkt');
  await level(page, 'particles'); await setTempKeys(page, -20); await settled(page); await sleep(600);
  await substance(page, 'iodine'); await setTempKeys(page, 95); await settled(page); await sleep(3500);
  const txt = await page.locator('#panelBody').innerText();
  assert(/Sublimieren\) beobachtet/.test(txt), 'Sublimation vermerkt');
  await shot(page, '83-ergebnisse', { x: 1040, y: 52, width: 400, height: 848 });
  await done();
  assert(!errors.length, errors.join(' | '));
  return `Arbeitsblatt ${pdfH.toFixed(0)} px hoch`;
});

// =========================================================== E14 Barrierefreiheit (Grundprüfung)
await scenario('E14', 'Tastatur und Beschriftung: alle Bedienelemente erreichbar, Fokus sichtbar, Zustand als Text für Bildschirmleser', async () => {
  const { page, errors, done } = await open();
  const order = [];
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const e = document.activeElement; return (e.id || e.dataset.sub || e.dataset.level || e.dataset.tab || e.tagName); })); }
  for (const want of ['water', 'iodine', 'matter', 'particles', 'temp', 'splitter']) assert(order.includes(want), `Tab erreicht ${want}: ${order.join(',')}`);
  await page.locator('[data-sub="salt"]').focus(); await page.keyboard.press('Enter');
  assert((await state(page)).sub === 'salt', 'Stoffwahl per Enter');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(outline !== 'none', 'Fokusrahmen sichtbar');
  await sleep(1300);
  assert(/Kochsalz: fest/.test(await page.locator('#srState').innerText()), 'Zustand als Text: ' + await page.locator('#srState').innerText());
  const pressed = await page.locator('#subs [aria-pressed="true"]').innerText();
  assert(pressed === 'Kochsalz', 'Auswahl nicht nur über Farbe (aria-pressed)');
  await done();
  assert(!errors.length, errors.join(' | '));
  return order.slice(0, 8).join(' → ');
});

await browser.close();
server.close();
const ext = allRequests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:') && !u.startsWith('blob:'));
results.push({ id: 'NET', title: 'Keine externen Anfragen', status: ext.length ? 'FAIL' : 'PASS', detail: ext.length ? ext.join(', ') : `${allRequests.length} Anfragen, alle lokal` });
console.log(`${ext.length ? 'FAIL' : 'PASS'} NET – ${results[results.length - 1].detail}`);
const passed = results.filter((r) => r.status === 'PASS').length;
if (!ONLY) fs.writeFileSync(path.join(APP, 'tests/e2e/results.json'), JSON.stringify({ date: new Date().toISOString(), browser: browser.__channel, passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} Szenarien bestanden`);
process.exit(passed === results.length ? 0 : 1);
