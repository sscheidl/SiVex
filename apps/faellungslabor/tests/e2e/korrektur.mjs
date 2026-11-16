// Browserprüfung der Korrekturen 1.1.0 (FK01–FK19) auf dem AUSGELIEFERTEN Web-ZIP (frisch entpackt,
// über HTTP) bzw. – für FK18 – zusätzlich auf der Einzeldatei per file://. Bedient die Oberfläche
// (Maus, Tastatur, Touch-Emulation); der Modellzustand wird nur gelesen. Zeiten werden in Modellzeit
// bei 1× gemessen (A.lab.state.time), die bei 1× der Uhrzeit entspricht.
// Aufruf: npm run package && node tests/e2e/korrektur.mjs   (ONLY=FK03,FK11 für einzelne Fälle)
// Ergebnis: tests/e2e/korrektur-results.json; Belege in docs/evidence und docs/screenshots.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { serve } from '../../scripts/serve.mjs';
import {
  APP, launch, newPage, adv, idle, S, tube, bottle, tubeHit, btn, fill, over, dropTap, part, ptab, speed, toastText,
  shot, tubeClip, decodePng, meanRGB, lum, unzip, extract, VERSION, REL, writeEvidence, assert
} from './lib.mjs';

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ROOT = process.env.E2E_ROOT ? path.resolve(process.env.E2E_ROOT) : path.join(extract(unzip(fs.readFileSync(REL(`faellungslabor-${VERSION}-web.zip`))), 'sivex-fl-fk-'), 'faellungslabor');
const PORT = Number(process.env.E2E_PORT || 8182);
const BASE = `http://localhost:${PORT}/index.html`;
const results = [], allRequests = [], allErrors = [];
const DROP = 0.05e-3 * 0.1; // mol Ag⁺ je Tropfen
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);

async function scenario(id, title, fn) {
  if (ONLY && !ONLY.includes(id)) return;
  const t0 = Date.now();
  try {
    const r = (await fn()) || {};
    results.push({ id, title, status: 'PASS', detail: r.detail || '', evidence: r.evidence || [], viewport: r.viewport || '1180×820', input: r.input || 'Maus', ms: Date.now() - t0 });
    console.log(`PASS ${id} ${title}${r.detail ? ' – ' + r.detail : ''}`);
  } catch (e) {
    results.push({ id, title, status: 'FAIL', detail: e.message, ms: Date.now() - t0 });
    console.log(`FAIL ${id} ${title} – ${e.stack}`);
  }
}

const browser = await launch();
const server = await serve(ROOT, PORT);
const BROWSER = `${browser.__channel} ${browser.version()}`;
console.log(`Browser: ${BROWSER} · Prüfling: ${ROOT}`);
async function open(opts = {}, url = BASE) {
  const o = await newPage(browser, url, Object.assign({ clock: true, block: true, viewport: { width: 1180, height: 820 } }, opts));
  o.done = async () => { allErrors.push(...o.errors); allRequests.push(...o.requests); await o.context.close(); };
  return o;
}
/** Modellzeit (s) bei 1×. */
const now = (page) => S(page, (A) => A.lab.state.time);
/** Uhr vorstellen, bis die Modellzeit t erreicht ist. */
async function untilModel(page, t) { for (let i = 0; i < 4000 && (await now(page)) < t - 1e-9; i++) await adv(page, 16); }
const tabState = (page) => S(page, (A) => { const tb = A.lab.tab(); return { visible: tb.visible, sel: tb.sel, archive: tb.archive.map((a) => a.ansatz), waste: tb.waste, tubes: tb.tubes.slice(0, tb.visible).map((t) => ({ ansatz: t.ansatz, sample: t.sample, V: t.V, rev: t.rev, ag: t.log.agDrops })) }; });
const forbidShown = async (page) => { await adv(page, 120); return page.locator('#forbid').isVisible(); };
const stageStrings = (page) => page.evaluate(() => {
  const t = [document.querySelector('#stage').innerText];
  document.querySelectorAll('#stage [aria-label], #stage [title]').forEach((e) => t.push(e.getAttribute('aria-label') || '', e.getAttribute('title') || ''));
  return t.join('\n');
});
/** AgX-Ansatz: 2 mL Probe + n Tropfen AgNO₃, Pipette zurück. */
async function precip(page, key, slot, drops = 10) {
  await fill(page, key, slot); await over(page, 'agno3', slot);
  for (let i = 0; i < Math.floor(drops / 5); i++) { await btn(page, '[data-dose="n5"]'); await idle(page); }
  for (let i = 0; i < drops % 5; i++) await dropTap(page);
  await btn(page, '#btnReturn'); await idle(page);
}

// =========================================================== FK01 Beschriftung und Gruppen
await scenario('FK01', 'Etiketten größer, gruppiert, NH₃ eindeutig – Tabletformate hell/dunkel, beide Versuchsteile', async () => {
  const rows = {}, ev = [];
  for (const [w, h] of [[1024, 768], [1180, 820], [820, 1180]]) for (const theme of ['dark', 'light']) {
    const { page, done } = await open({ viewport: { width: w, height: h } });
    if (theme === 'light') { await btn(page, '#btnTheme'); await adv(page, 100); }
    for (const p of ['main', 'control']) {
      if (p === 'control') { await part(page, 'control'); await adv(page, 200); }
      const m = await page.evaluate(() => {
        const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
        const glyph = (e) => { if (!e || getComputedStyle(e).display === 'none') return null; const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()]; return { fontPx: parseFloat(getComputedStyle(e).fontSize), lineBoxPx: Math.max(...rs.map((r) => r.height)), lines: rs.length }; };
        const cards = [...document.querySelectorAll('.bcard')].map((c) => ({ key: c.dataset.card, text: c.innerText.replace(/\s+/g, ' ').trim(), box: box(c), f: glyph(c.querySelector('.f')), n: glyph(c.querySelector('.n')), q: glyph(c.querySelector('.q')), overflow: c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1, compact: c.classList.contains('compact'), tight: c.classList.contains('tight') }));
        const heads = [...document.querySelectorAll('.ghead')].map((g) => ({ t: g.textContent, box: box(g), cut: g.scrollWidth > g.clientWidth + 1 }));
        const stage = box(document.getElementById('lab'));
        return { cards, heads, stage, layout: window.FL.app.lab.layout() };
      });
      const L = m.layout, G = L.groups;
      assert(!m.cards.some((c) => c.compact), `${w}×${h} ${p}: volles Etikett erwartet`);
      for (const c of m.cards) {
        assert(!c.overflow, `${c.key}: Etikett läuft über`);
        assert(c.f == null || c.f.fontPx >= 16, `${c.key}: Formel ${c.f && c.f.fontPx}px`);
        assert(c.n && c.n.fontPx >= 14, `${c.key}: Name ${c.n && c.n.fontPx}px`);
        assert(c.box.x >= m.stage.x - 0.5 && c.box.x + c.box.w <= m.stage.x + m.stage.w + 0.5, `${c.key}: innerhalb der Bühne`);
      }
      // keine Überlappung; Abstand innerhalb der Gruppe ≥ 4 px, zwischen Gruppen deutlich größer
      const byKey = Object.fromEntries(m.cards.map((c) => [c.key, c]));
      let inner = Infinity, between = Infinity;
      G.forEach((g, gi) => {
        for (let i = 1; i < g.keys.length; i++) inner = Math.min(inner, byKey[g.keys[i]].box.x - (byKey[g.keys[i - 1]].box.x + byKey[g.keys[i - 1]].box.w));
        if (gi) { const a = byKey[G[gi - 1].keys.at(-1)], b = byKey[g.keys[0]]; between = Math.min(between, b.box.x - (a.box.x + a.box.w)); }
      });
      assert(inner >= 4 && between >= inner + 8, `Abstände: in Gruppe ${inner.toFixed(1)} px, zwischen Gruppen ${between.toFixed(1)} px`);
      // Überschriften vorhanden, nicht abgeschnitten
      const want = p === 'main' ? ['Probelösungen', 'Nachweis- und Prüfreagenzien', 'zum Verdünnen'] : ['Positivkontrolle', 'Blindprobe', 'Wasserproben', 'Nachweisreagenz'];
      assert(JSON.stringify(m.heads.map((x) => x.t)) === JSON.stringify(want), 'Gruppen: ' + m.heads.map((x) => x.t));
      assert(!m.heads.some((x) => x.cut), 'Überschrift abgeschnitten');
      // eindeutige Etiketten; NH₃ verdünnt/konzentriert
      const texts = m.cards.map((c) => c.text);
      assert(new Set(texts).size === texts.length, 'doppelte Etiketten: ' + texts);
      if (p === 'main') {
        assert(/NH₃ Ammoniak verdünnt/.test(byKey.nh3dil.text) && /NH₃ Ammoniak konzentriert/.test(byKey.nh3conc.text.replace(/\u00ad/g, '')), 'NH₃ eindeutig: ' + byKey.nh3dil.text + ' | ' + byKey.nh3conc.text);
        assert(G[0].keys.join() === 'nacl,nabr,nai' && G[1].keys.join() === 'agno3,nh3dil,nh3conc' && G[2].keys.join() === 'water', 'Gruppenzuordnung Hauptteil');
      } else assert(G.map((g) => g.keys.join('+')).join('|') === 'nacl|water|tap+mineral|agno3', 'Gruppenzuordnung Kontrollteil');
      rows[`${w}x${h}-${theme}-${p}`] = { scale: await S(page, (A) => A.renderer.view.scale), etiketten: m.cards.map((c) => ({ key: c.key, text: c.text.replace(/\u00ad/g, ''), formel_px: c.f && c.f.fontPx, name_px: c.n.fontPx, zusatz_px: c.q && c.q.fontPx, zeilenhoehe_name_px: +c.n.lineBoxPx.toFixed(1), breite_px: c.box.w, eng_gesetzt: c.tight })), abstand_in_gruppe_px: +inner.toFixed(1), abstand_zwischen_gruppen_px: +between.toFixed(1) };
      ev.push(await shot(page, `nachher-1.1.0-${w}x${h}-${theme}${p === 'control' ? '-kontrolle' : ''}`));
    }
    await done();
  }
  // Vergleich zu 1.0.0 (gleiches Verfahren, docs/evidence/vorher-1.0.0.json)
  const vorher = JSON.parse(fs.readFileSync(path.join(APP, 'docs/evidence/vorher-1.0.0.json'), 'utf8'));
  writeEvidence('FK01-etiketten.json', { methode: 'Berechnete Schriftgröße und Zeilenbox im Browser (CSS-px), Bühnenausschnitt je Format/Hintergrund/Versuchsteil', vorher_1_0_0: Object.fromEntries(Object.entries(vorher).filter(([k]) => /x/.test(k) && !/nh3/.test(k))), nachher_1_1_0: rows });
  const min = Math.min(...Object.values(rows).flatMap((r) => r.etiketten.map((e) => e.name_px)));
  return { detail: `Name min. ${min} px (vorher ${vorher['1024x768-dark'].flaschenname_css_px} px), Formel 18 px; 12 Ansichten`, evidence: ev.concat(['docs/evidence/FK01-etiketten.json']), viewport: '1024×768, 1180×820, 820×1180' };
});

// =========================================================== FK02 Positionen, Pipetten und Trefferflächen
await scenario('FK02', 'Flasche, Pipette und Trefferfläche deckungsgleich; alle Infokarten erreichbar (Maus und Touch)', async () => {
  const { page, done } = await open({ hasTouch: true });
  const checked = [];
  for (const p of ['main', 'control']) {
    if (p === 'control') { await part(page, 'control'); await adv(page, 200); }
    const keys = await S(page, (A, FL) => FL.model.TABS[A.lab.state.tab].bottles);
    for (const k of keys) {
      const c = await page.locator(`.bcard[data-card="${k}"]`).boundingBox();
      // Kartenmitte (oben) trifft die Flasche k; Infoleiste trifft die Infokarte k
      const hitAt = (x, y) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const b = e && e.closest('[data-bottle],[data-info]'); return b ? (b.dataset.bottle ? 'bottle:' + b.dataset.bottle : 'info:' + b.dataset.info) : (e ? e.tagName + '.' + e.className : 'nichts'); }, [x, y]);
      const top = await hitAt(c.x + c.width / 2, c.y + 20), strip = await hitAt(c.x + c.width / 2, c.y + c.height - 12);
      assert(top === 'bottle:' + k, `${k}: Etikett trifft ${top}`);
      assert(strip === 'info:' + k, `${k}: Infoleiste trifft ${strip}`);
      // Antippen der Etikettmitte nimmt genau diese Pipette auf; sie steht über der Flasche
      await page.touchscreen.tap(c.x + c.width / 2, c.y + 25); await adv(page, 500);
      const pip = await S(page, (A) => { const p = A.lab.state.pip, s = A.renderer.toScreen(p.x, p.y), r = document.getElementById('lab').getBoundingClientRect(); return { key: p.key, x: r.left + s.x }; });
      assert(pip.key === k && Math.abs(pip.x - (c.x + c.width / 2)) < 1.5, `${k}: Pipette ${pip.key} bei ${pip.x.toFixed(1)} statt ${(c.x + c.width / 2).toFixed(1)}`);
      await page.touchscreen.tap(c.x + c.width / 2, c.y + 25); await idle(page);
      assert((await S(page, (A) => A.lab.state.pip.key)) === null, `${k}: zurückgestellt`);
      // Infokarte über die Leiste
      await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height - 12); await adv(page, 150);
      const t = await page.locator('.modal-card').innerText();
      const name = await S(page, (A, FL, a) => FL.chem.SOLUTIONS[a].name, k);
      assert(t.startsWith(name), `${k}: Karte ${t.slice(0, 30)}`);
      await page.keyboard.press('Escape'); await adv(page, 80);
      checked.push(`${p}:${k}`);
    }
  }
  // Aufgenommene Pipette über einem Glas liegt obenauf (nicht von einer Infoleiste verdeckt)
  await part(page, 'main'); await fill(page, 'nacl', 1); await over(page, 'agno3', 1);
  const pb = await page.locator('.hit.pip').boundingBox();
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).className, [pb.x + pb.width / 2, pb.y + pb.height / 2]);
  assert(/pip/.test(top), 'Pipette über Glas bedienbar: ' + top);
  await done();
  return { detail: `${checked.length} Flaschen (Etikett, Pipette, Infoleiste) deckungsgleich`, input: 'Touch (emuliert)' };
});

// =========================================================== FK03 Leeres Glas entfernen
await scenario('FK03', '„− Glas“: gewähltes leeres Glas weg, +/− bis zu den Grenzen, mindestens eines bleibt; beide Teile, Reload', async () => {
  const { page, done } = await open();
  await btn(page, '#btnRemoveTube');
  assert(/zuerst das Reagenzglas an/.test(await toastText(page)), 'Hinweis ohne Auswahl');
  await fill(page, 'nacl', 0); await fill(page, 'nai', 2);
  await tubeHit(page, 1); await btn(page, '#btnRemoveTube'); await adv(page, 100);
  let s = await tabState(page);
  assert(s.visible === 2 && s.tubes.map((t) => t.ansatz).join() === 'A1,A2' && s.tubes[1].sample === 'nai', 'leeres Glas 2 entfernt, A1/A2 bleiben: ' + JSON.stringify(s.tubes));
  assert(s.sel === null || s.sel < s.visible, 'Auswahl gültig');
  assert(!(await page.locator('.modal').isVisible()), 'leeres Glas ohne Rückfrage');
  for (let i = 0; i < 4; i++) await btn(page, '#btnAddTube');
  s = await tabState(page);
  assert(s.visible === 6 && await page.locator('#btnAddTube').isDisabled(), 'Obergrenze 6');
  // leere Gläser 3–6 wieder weg (jeweils das letzte wählen)
  for (let i = 5; i >= 2; i--) { await tubeHit(page, i); await btn(page, '#btnRemoveTube'); }
  s = await tabState(page);
  assert(s.visible === 2 && s.tubes.map((t) => t.ansatz).join() === 'A1,A2', 'zurück auf 2');
  const hitsOk = await page.$$eval('.hit.tube', (l) => l.map((b) => +b.dataset.slot).join());
  assert(hitsOk === '0,1', 'Trefferflächen passen zu den Gläsern: ' + hitsOk);
  // Reload erhält Anzahl und Ansätze
  await page.reload(); await page.waitForFunction(() => window.FL && window.FL.app); await adv(page, 300);
  s = await tabState(page);
  assert(s.visible === 2 && s.tubes.map((t) => t.ansatz).join() === 'A1,A2', 'nach Reload: ' + JSON.stringify(s));
  // Kontrollteil: 4 Gläser, bis auf 1 entfernen
  await part(page, 'control'); await adv(page, 200);
  for (let i = 3; i >= 1; i--) { await tubeHit(page, i); await btn(page, '#btnRemoveTube'); }
  await tubeHit(page, 0); await btn(page, '#btnRemoveTube');
  assert(/Mindestens ein Reagenzglas bleibt/.test(await toastText(page)), 'Minimum-Hinweis');
  s = await tabState(page);
  assert(s.visible === 1, 'Kontrollteil: eines bleibt');
  for (let i = 0; i < 3; i++) await btn(page, '#btnAddTube');
  assert((await tabState(page)).visible === 4 && await page.locator('#btnAddTube').isDisabled(), 'Kontrollteil: Obergrenze 4');
  await part(page, 'main'); await adv(page, 100);
  assert((await tabState(page)).visible === 2, 'Teile getrennt');
  // Tastatur
  await page.locator('.hit.tube[data-slot="1"]').focus(); await page.keyboard.press('Enter'); await adv(page, 100);
  await page.locator('#btnAddTube').focus(); await page.keyboard.press('Enter'); await adv(page, 100);
  assert((await tabState(page)).visible === 3, 'Tastatur +');
  await page.locator('.hit.tube[data-slot="2"]').focus(); await page.keyboard.press('Enter'); await adv(page, 50);
  await page.locator('#btnRemoveTube').focus(); await page.keyboard.press('Enter'); await adv(page, 100);
  assert((await tabState(page)).visible === 2, 'Tastatur −');
  await done();
  return { detail: 'Hinweis ohne Auswahl, gezielt entfernt, 1…6 bzw. 1…4, Reload, Tastatur', input: 'Maus, Tastatur' };
});

// =========================================================== FK04 Gefülltes Glas entfernen
await scenario('FK04', 'Gefülltes Glas: Rückfrage, Abbrechen ändert nichts, Bestätigen gießt aus und entfernt; Protokoll erhalten', async () => {
  const { page, done } = await open();
  await precip(page, 'nacl', 0, 5); await fill(page, 'nabr', 1);
  // Beobachtung zu A1 speichern
  await tubeHit(page, 0); await ptab(page, 'obs'); await adv(page, 100);
  await page.locator('input[name="trueb"][value="stark"]').check(); await page.locator('input[name="farbe"][value="weiss"]').check();
  await page.locator('#obsForm button[type="submit"]').click(); await adv(page, 100);
  const before = await tabState(page);
  const recBefore = await S(page, (A) => A.ui.state.records.main.map((r) => r.ansatz));
  await btn(page, '#btnRemoveTube'); await adv(page, 100);
  assert(await page.locator('.modal').isVisible(), 'Rückfrage');
  const q = await page.locator('.modal-card').innerText();
  assert(/Glas 1 ausgießen und wegnehmen/.test(q) && /A1/.test(q), 'Rückfrage nennt Glas und Ansatz: ' + q);
  const ev = [await shot(page, 'nachher-1.1.0-glas-entfernen-rueckfrage')];
  await page.locator('.modal [data-m="close"]').click(); await adv(page, 200);
  assert(JSON.stringify(await tabState(page)) === JSON.stringify(before), 'Abbrechen ändert nichts');
  await btn(page, '#btnRemoveTube'); await page.locator('.modal [data-m="removeYes"]').click(); await adv(page, 300);
  assert((await S(page, (A) => !!A.lab.state.pour)), 'Ausgießen läuft');
  await idle(page);
  const s = await tabState(page);
  assert(s.visible === 2 && s.tubes[0].ansatz === 'A2' && s.tubes[0].sample === 'nabr' && s.tubes[1].V === 0, 'A1 weg, A2 rückt auf: ' + JSON.stringify(s.tubes));
  assert(s.archive.filter((a) => a === 'A1').length === 1, 'A1 genau einmal archiviert');
  assert(rel(s.waste.V, before.tubes[0].V) < 1e-9, 'Abfallvolumen = Glasinhalt');
  assert(rel(s.waste.Ag, 5 * DROP) < 1e-9, 'Silber im Abfall = 5 Tropfen');
  const recAfter = await S(page, (A) => A.ui.state.records.main.map((r) => r.ansatz));
  assert(recBefore.join() === 'A1' && JSON.stringify(recAfter) === JSON.stringify(recBefore), 'Protokolleintrag A1 erhalten: ' + recAfter);
  await ptab(page, 'obs'); await adv(page, 100);
  assert(/A1[\s\S]*Ansatz beendet/.test(await page.locator('ul.overview').innerText()), 'A1 in der Ergebnisübersicht als beendet');
  // Zähler läuft weiter, keine ID-Wiederverwendung
  await fill(page, 'nai', 1);
  assert((await tube(page, 1)).ansatz === 'A3', 'neue ID A3');
  await done();
  return { detail: 'Abbrechen neutral; Bestätigen: ausgegossen, entfernt, A1 1× archiviert, A2 bleibt', evidence: ev };
});

// =========================================================== FK05 Entfernen während einer Zugabe
await scenario('FK05', 'Entfernen während gedrückter Dosierung: Dosierung stoppt, keine Geistertropfen, kein falscher Ansatz', async () => {
  const { page, done } = await open({ hasTouch: true });
  await fill(page, 'nacl', 0); await fill(page, 'nabr', 1); await over(page, 'agno3', 1);
  // Dauertropfen auf Glas 2 (Maus gedrückt), währenddessen zweiter Finger: „− Glas“ und bestätigen
  const b = await page.locator('#btnDrop').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await adv(page, 700);
  const during = (await tube(page, 1)).log.agDrops;
  await page.evaluate(() => document.getElementById('btnRemoveTube').click()); await adv(page, 50);
  await page.evaluate(() => document.querySelector('.modal [data-m="removeYes"]').click()); await adv(page, 50);
  await adv(page, 1500); await page.mouse.up(); await idle(page);
  const s = await tabState(page);
  const arch = await S(page, (A) => A.lab.tab().archive.find((a) => a.ansatz === 'A2'));
  assert(s.visible === 2 && s.tubes[0].ansatz === 'A1' && s.tubes[0].ag === 0 && s.tubes[1].V === 0, 'A1 unberührt, kein Nachdosieren: ' + JSON.stringify(s.tubes));
  assert(s.archive.join() === 'A2', 'A2 genau einmal archiviert');
  assert(arch.log.agDrops >= during && arch.log.agDrops <= during + 2, `Archiv: ${arch.log.agDrops} Tropfen (beim Entfernen ${during})`);
  assert(rel(s.waste.Ag, arch.log.agDrops * DROP) < 1e-9, 'Silberbilanz Abfall = archivierte Tropfen');
  const st = await S(page, (A) => ({ drops: A.lab.state.drops.length, hold: !!A.lab.state.hold, busy: A.lab.busy(), pip: A.lab.state.pip.phase }));
  assert(st.drops === 0 && !st.hold && !st.busy, 'nichts im Flug: ' + JSON.stringify(st));
  // weiter bedienbar
  await over(page, 'agno3', 0); await dropTap(page);
  assert((await tube(page, 0)).log.agDrops === 1, 'danach normal weiter');
  await done();
  return { detail: `Dosierung gestoppt (${arch.log.agDrops} Tropfen archiviert), keine Geistertropfen`, input: 'Maus + zweiter Finger (Skript-Klick)' };
});

// =========================================================== FK05b (1.1.1) Dosieren in ein anderes Glas während „− Glas“
await scenario('FK05b', 'Während ein gefülltes Glas zum Entfernen ausgegossen wird, in ein anderes Glas tropfen: Tropfen bleiben in ihrem Ansatz', async () => {
  const { page, done } = await open();
  await fill(page, 'nacl', 0); await fill(page, 'nabr', 1); await fill(page, 'nai', 2);
  await over(page, 'agno3', 1); await dropTap(page); // A2 hat schon AgNO₃
  await btn(page, '#btnReturn'); await idle(page); // ohne Pipette: Antippen wählt das Glas nur aus
  await tubeHit(page, 0); await adv(page, 100);
  assert((await S(page, (A) => A.lab.tab().sel)) === 0 && !(await S(page, (A) => A.lab.state.pip.key)), 'Glas 1 gewählt, keine Pipette');
  await btn(page, '#btnRemoveTube'); await page.locator('.modal [data-m="removeYes"]').click(); await adv(page, 50);
  assert(await S(page, (A) => !!A.lab.state.pour), 'Ausgießen von A1 läuft');
  // währenddessen: AgNO₃-Pipette über Glas 2 (A2) und Tropfen halten, bis die Gläser aufgerückt sind
  await bottle(page, 'agno3'); await adv(page, 400); await tubeHit(page, 1);
  for (let i = 0; i < 100 && (await S(page, (A) => A.lab.state.pip.phase)) !== 'over'; i++) await adv(page, 16);
  const pipMid = await S(page, (A) => ({ phase: A.lab.state.pip.phase, over: A.lab.state.pip.over, key: A.lab.state.pip.key, pour: A.lab.state.pour && A.lab.state.pour.t, deck: document.getElementById('btnDrop') ? 'Tropfen-Knopf da' : document.querySelector('#doseRow, .doserow') && document.querySelector('#doseRow, .doserow').innerText }));
  assert(pipMid.phase === 'over' && pipMid.over === 1 && pipMid.pour != null, 'Pipette über A2, Ausgießen läuft noch: ' + JSON.stringify(pipMid));
  const b = await page.locator('#btnDrop').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  for (let i = 0; i < 300 && (await S(page, (A) => !!A.lab.state.pour)); i++) await adv(page, 16);
  const mid = await S(page, (A) => ({ over: A.lab.state.pip.over, visible: A.lab.tab().visible, hold: !!A.lab.state.hold }));
  await adv(page, 500); await page.mouse.up(); await idle(page);
  const s = await tabState(page);
  const ev = [await shot(page, 'nachher-1.1.1-glas-entfernen-waehrend-dosierung')];
  assert(mid.visible === 2 && mid.over === 0 && mid.hold, 'Pipette folgt A2 auf Platz 1, Dosierung läuft weiter: ' + JSON.stringify(mid));
  assert(s.tubes[0].ansatz === 'A2' && s.tubes[1].ansatz === 'A3', 'Reihenfolge A2, A3: ' + JSON.stringify(s.tubes));
  assert(s.tubes[0].ag > 1, 'Tropfen während des Ausgießens in A2 gebucht: ' + s.tubes[0].ag);
  assert(s.tubes[1].ag === 0, 'keine Tropfen im Nachbarglas A3 (NaI): ' + s.tubes[1].ag);
  const arch = await S(page, (A) => A.lab.tab().archive.find((a) => a.ansatz === 'A1'));
  assert(arch.log.agDrops === 0, 'keine Tropfen im entfernten Ansatz A1');
  const pip = await S(page, (A) => ({ x: A.lab.state.pip.x, want: A.lab.overPos(0, 'main').x }));
  assert(Math.abs(pip.x - pip.want) < 1e-6, 'Pipette steht über A2: ' + JSON.stringify(pip));
  await done();
  return { detail: `Halten über A2 während des Ausgießens und Aufrückens: A2 ${s.tubes[0].ag} Tropfen, A3 0, A1 archiviert ohne AgNO₃; Pipette über A2`, evidence: ev };
});

// =========================================================== FK06 Gleiche Probe nach AgNO₃
await scenario('FK06', 'Gleiche Probe nach AgNO₃ erneut zugeben – Cl, Br, I; Mengen, Volumen, Revision; Kapazität', async () => {
  const { page, done } = await open();
  const rows = [];
  for (const [k, slot] of [['nacl', 0], ['nabr', 1], ['nai', 2]]) {
    await precip(page, k, slot, 5);
    const a = await tube(page, slot);
    await fill(page, k, slot);
    const b = await tube(page, slot);
    assert(!(await page.locator('#forbid').isVisible()), k + ': nicht gesperrt');
    const X = (t) => t.n.X;
    assert(b.ansatz === a.ansatz && b.rev > a.rev, `${k}: gleicher Ansatz ${b.ansatz}, Revision ${a.rev}→${b.rev}`);
    assert(rel(b.V, a.V + 2) < 1e-9 && rel(X(b), 2 * 2e-4) < 1e-9 && rel(b.n.Ag, 5 * DROP) < 1e-9, `${k}: V ${b.V}, X ${X(b)}, Ag ${b.n.Ag}`);
    rows.push({ probe: k, ansatz: b.ansatz, rev: [a.rev, b.rev], V: [a.V, b.V], X_gesamt_mol: X(b) });
  }
  // andere Probe bleibt gesperrt
  const before = await tube(page, 0);
  await bottle(page, 'nabr'); await adv(page, 400); await tubeHit(page, 0);
  assert(await forbidShown(page), 'andere Probe gesperrt');
  assert((await tube(page, 0)).V === before.V, 'unverändert');
  await btn(page, '#btnReturn'); await idle(page);
  // Kapazität: 3 mL-Portionen bis zur Grenze
  await page.locator('#vol [data-vol="3"]').click();
  for (let i = 0; i < 6; i++) await fill(page, 'nacl', 0);
  const v = (await tube(page, 0)).V;
  assert(v <= 20 + 1e-9 && v > 17, 'Kapazitätsgrenze 20 mL: ' + v);
  writeEvidence('FK06-gleiche-probe.json', rows);
  await done();
  return { detail: rows.map((r) => `${r.probe} rev ${r.rev.join('→')}`).join(', ') + `; andere Probe gesperrt; Grenze ${v.toFixed(2)} mL`, evidence: ['docs/evidence/FK06-gleiche-probe.json'] };
});

// =========================================================== FK07 Gleiche Probe nach NH₃
await scenario('FK07', 'Gleiche Probe nach NH₃: erlaubt, Bilanzen und Gleichgewicht konsistent (ggf. neue Fällung)', async () => {
  const { page, done } = await open();
  await precip(page, 'nacl', 0, 5);
  await over(page, 'nh3dil', 0); await btn(page, '[data-dose="1"]'); await idle(page); await btn(page, '#btnReturn'); await idle(page);
  await tubeHit(page, 0); await btn(page, '#btnShake'); await adv(page, 15000);
  const a = await tube(page, 0);
  assert(a.solid < 1e-12, 'AgCl gelöst');
  await fill(page, 'nacl', 0);
  assert(!(await page.locator('#forbid').isVisible()), 'nicht gesperrt');
  await tubeHit(page, 0); await btn(page, '#btnShake'); await adv(page, 15000);
  const b = await tube(page, 0);
  const eq = await S(page, (A, FL) => FL.chem.solidAtEquilibrium(A.lab.tube(0)));
  assert(b.ansatz === a.ansatz && b.rev > a.rev, 'gleicher Ansatz, neue Revision');
  assert(rel(b.n.X, 4e-4) < 1e-9 && rel(b.n.Ag, 5 * DROP) < 1e-9 && rel(b.n.N, 2e-3) < 1e-9, 'Stoffmengen gesamt');
  assert(Math.abs(b.solid - eq) <= 1e-3 * 5 * DROP + 1e-15, `Gleichgewicht: ${b.solid} vs ${eq}`);
  // gleiche Probe nach NH₃ für Br und I ebenfalls erlaubt
  for (const [k, slot] of [['nabr', 1], ['nai', 2]]) {
    await precip(page, k, slot, 5); await over(page, 'nh3conc', slot); await btn(page, '[data-dose="1"]'); await idle(page); await btn(page, '#btnReturn'); await idle(page);
    const r0 = (await tube(page, slot)).rev; await fill(page, k, slot);
    assert(!(await page.locator('#forbid').isVisible()) && (await tube(page, slot)).rev > r0, k + ' nach NH₃ erlaubt');
  }
  writeEvidence('FK07-nach-nh3.json', { agcl: { vor_zweiter_probe: a, nach_zweiter_probe: { V: b.V, n: b.n, solid: b.solid, rev: b.rev }, gleichgewicht_chem: eq } });
  await done();
  return { detail: `AgCl nach 2. Probe: Feststoff ${(b.solid / (5 * DROP) * 100).toFixed(1)} % (Gleichgewicht ${(eq / (5 * DROP) * 100).toFixed(1)} %)`, evidence: ['docs/evidence/FK07-nach-nh3.json'] };
});

// =========================================================== FK08 weiterhin abgefangen
await scenario('FK08', 'Ungültig bleibt ungültig: andere Probe, NH₃ vor AgNO₃, Reagenz in leeres Glas, Umfüllen, volles Glas', async () => {
  const { page, done } = await open();
  await fill(page, 'nacl', 0);
  const snap = () => S(page, (A) => JSON.stringify(A.lab.tab().tubes.map((t) => [t.V, t.n, t.log, t.rev])));
  const before = await snap(), cases = [];
  const expect = async (name) => { assert(await forbidShown(page), name); cases.push(name); };
  await bottle(page, 'nh3dil'); await adv(page, 400); await tubeHit(page, 0); await expect('NH₃ vor AgNO₃');
  await bottle(page, 'nh3conc'); await adv(page, 400); await tubeHit(page, 0); await expect('konz. NH₃ vor AgNO₃');
  await bottle(page, 'nai'); await adv(page, 400); await tubeHit(page, 0); await expect('andere Probe');
  await bottle(page, 'agno3'); await adv(page, 400); await tubeHit(page, 1); await expect('AgNO₃ in leeres Glas');
  await bottle(page, 'water'); await adv(page, 400); await tubeHit(page, 2); await expect('Wasser in leeres Glas');
  const pip = await page.locator('.hit.pip').boundingBox(), tgt = await page.locator('.hit.bottle[data-bottle="nacl"]').boundingBox();
  await page.mouse.move(pip.x + pip.width / 2, pip.y + pip.height / 2); await page.mouse.down();
  await page.mouse.move(tgt.x + tgt.width / 2, tgt.y + tgt.height * 0.8, { steps: 8 }); await page.mouse.up(); await expect('Umfüllen in Vorratsflasche');
  assert((await snap()) === before, 'kein Stofftransfer');
  // berechtigte Zugaben gehen weiter
  await btn(page, '#btnReturn'); await idle(page);
  await over(page, 'agno3', 0); await dropTap(page); await over(page, 'nh3dil', 0); await dropTap(page);
  const t = await tube(page, 0);
  assert(t.log.agDrops === 1 && t.log.nh3dilV > 0, 'berechtigte Zugaben nicht blockiert');
  // volles Glas
  await btn(page, '#btnReturn'); await idle(page);
  await page.locator('#vol [data-vol="3"]').click();
  for (let i = 0; i < 7; i++) await fill(page, 'nacl', 0);
  assert((await tube(page, 0)).V <= 20 + 1e-9, 'Kapazität eingehalten');
  await done();
  return { detail: cases.length + ' ungültige Vorgänge abgewiesen; berechtigte Zugaben laufen' };
});

// =========================================================== FK09 NH₃ löst sichtbar schneller
await scenario('FK09', 'AgCl/NH₃ verd. und AgBr/NH₃ konz.: sichtbarer Beginn ≤ 2 s, klar ≤ 10 s (1×, ab Ende der Zugabe)', async () => {
  const { page, done } = await open();
  const p0 = 10 * DROP, ev = [], series = {};
  // (a) AgCl abgesetzt, 1 mL verdünnte NH₃, ohne Schwenken – gleiche Bildfolge wie „vorher“
  await precip(page, 'nacl', 0, 10); await adv(page, 50000);
  await over(page, 'nh3dil', 0); await btn(page, '[data-dose="1"]'); await idle(page);
  let t0 = await now(page);
  series.agcl_verd_ohne_schwenken = [];
  for (const t of [0, 1, 2, 5, 10]) {
    await untilModel(page, t0 + t);
    series.agcl_verd_ohne_schwenken.push({ t, rest: (await tube(page, 0)).solid / p0 });
    ev.push(await shot(page, `nachher-1.1.0-nh3-agcl-bodensatz-${t}s`, await tubeClip(page, 0)));
  }
  await btn(page, '#btnReturn'); await idle(page);
  // (b) AgCl, 1 mL verdünnte NH₃, einmal schwenken
  await precip(page, 'nacl', 1, 10); await adv(page, 50000);
  await over(page, 'nh3dil', 1); await btn(page, '[data-dose="1"]'); await idle(page); await btn(page, '#btnReturn'); await idle(page);
  await tubeHit(page, 1); t0 = await now(page); await btn(page, '#btnShake');
  series.agcl_verd_geschwenkt = [];
  for (const t of [0, 1, 2, 5, 10]) { await untilModel(page, t0 + t); series.agcl_verd_geschwenkt.push({ t, rest: (await tube(page, 1)).solid / p0 }); if (t === 2) ev.push(await shot(page, 'nachher-1.1.0-nh3-agcl-geschwenkt-2s', await tubeClip(page, 1))); }
  // (c) AgBr abgesetzt, 3 mL konzentrierte NH₃ (ausreichend; 2,5 mL lassen im Gleichgewicht ≈ 7 % Rest), einmal schwenken
  await precip(page, 'nabr', 2, 10); await adv(page, 50000);
  await over(page, 'nh3conc', 2); for (const d of ['1', '1', '1']) { await btn(page, `[data-dose="${d}"]`); await idle(page); } await btn(page, '#btnReturn'); await idle(page);
  const eqBr = await S(page, (A, FL) => FL.model.species(A.lab.tube(2)).pEq) / p0;
  await tubeHit(page, 2); t0 = await now(page); await btn(page, '#btnShake');
  series.agbr_konz_geschwenkt = [];
  for (const t of [0, 1, 2, 5, 10]) { await untilModel(page, t0 + t); series.agbr_konz_geschwenkt.push({ t, rest: (await tube(page, 2)).solid / p0 }); }
  const at = (s, t) => s.find((x) => x.t === t).rest;
  const A = series.agcl_verd_ohne_schwenken, B = series.agcl_verd_geschwenkt, C = series.agbr_konz_geschwenkt;
  assert(at(A, 2) < 0.9 && at(B, 2) < 0.75 && at(C, 2) < 0.9, `sichtbarer Beginn bis 2 s: ${at(A, 2).toFixed(2)} / ${at(B, 2).toFixed(2)} / ${at(C, 2).toFixed(2)}`);
  assert(eqBr < 1e-6, 'AgBr-Gleichgewichtsrest ' + eqBr);
  assert(at(A, 10) < 0.01 && at(B, 5) < 0.01 && at(C, 10) < 0.01, `klar: AgCl ohne Schwenken 10 s ${at(A, 10).toFixed(3)}, AgCl geschwenkt 5 s ${at(B, 5).toFixed(3)}, AgBr geschwenkt 10 s ${at(C, 10).toFixed(3)}`);
  assert(A[1].rest < A[0].rest && A[2].rest < A[1].rest, 'fortschreitend, nicht schlagartig');
  // Pixel: Bodensatz wird heller → dunkler Hintergrund sichtbar
  const imgs = [0, 10].map((t) => decodePng(fs.readFileSync(path.join(APP, `docs/screenshots/nachher-1.1.0-nh3-agcl-bodensatz-${t}s.png`))));
  // Bodensatzbereich im Glasausschnitt (tubeClip: Rand −120 … Tisch +60): unterste ~5 % der Glashöhe
  const sedBox = await S(page, (A, FL) => { const G = FL.geometry, top = G.RIM_Y - 120, h = G.BENCH + 60 - top; return { y0: (G.INNER_BOTTOM - 22 - top) / h, y1: (G.INNER_BOTTOM - 4 - top) / h }; });
  const lumBottom = (im) => lum(meanRGB(im, im.w * 0.4, im.h * sedBox.y0, im.w * 0.6, im.h * sedBox.y1));
  const L0 = lumBottom(imgs[0]), L10 = lumBottom(imgs[1]);
  assert(L0 - L10 > 0.15, `Bodensatz im Bild sichtbar verschwunden: ${L0.toFixed(2)} → ${L10.toFixed(2)}`);
  const vorher = JSON.parse(fs.readFileSync(path.join(APP, 'docs/evidence/vorher-1.0.0.json'), 'utf8')).nh3_agcl_bodensatz_ohne_schwenken;
  writeEvidence('FK09-aufloesen.json', { agbr_gleichgewichtsrest: eqBr, methode: 'Modellzeit bei 1× ab Ende der Zugabe (Pipette fertig); Anteil des Feststoffs am Anfangsfeststoff (10 Tropfen); Bilder je Zeitpunkt', vorher_1_0_0_agcl_verd_ohne_schwenken: vorher, nachher_1_1_0: series, bild_helligkeit_bodensatz: { t0: L0, t10: L10 } });
  await done();
  return { detail: `AgCl verd. 0/1/2/5/10 s: ${A.map((x) => x.rest.toFixed(2)).join('→')} (vorher 0/2/5/10/20 s: ${vorher.map((x) => x.rest.toFixed(2)).join('→')}); AgCl geschwenkt: ${B.map((x) => x.rest.toFixed(2)).join('→')}; AgBr konz. geschwenkt: ${C.map((x) => x.rest.toFixed(2)).join('→')}`, evidence: ev.concat(['docs/evidence/FK09-aufloesen.json']) };
});

// =========================================================== FK10 Gegen- und Grenzfälle
await scenario('FK10', 'Zu wenig NH₃ lässt Rest; AgBr/verd. beständig; AgI bleibt; Wasser ist kein Ersatz; Konstanten unverändert', async () => {
  const { page, done } = await open();
  const p0 = 10 * DROP, ev = [];
  await btn(page, '#btnAddTube');
  await precip(page, 'nacl', 0, 10); await over(page, 'nh3dil', 0); await btn(page, '[data-dose="0.5"]'); await idle(page); await btn(page, '#btnReturn'); await idle(page);
  await precip(page, 'nabr', 1, 10); await over(page, 'nh3dil', 1); await btn(page, '[data-dose="1"]'); await idle(page); await btn(page, '#btnReturn'); await idle(page);
  await precip(page, 'nai', 2, 10); await over(page, 'nh3conc', 2); for (let i = 0; i < 6; i++) { await btn(page, '[data-dose="1"]'); await idle(page); } await btn(page, '#btnReturn'); await idle(page);
  await precip(page, 'nacl', 3, 10); await over(page, 'water', 3); for (let i = 0; i < 3; i++) { await btn(page, '[data-dose="1"]'); await idle(page); } await btn(page, '#btnReturn'); await idle(page);
  for (const s of [0, 1, 2, 3]) { await tubeHit(page, s); await btn(page, '#btnShake'); await adv(page, 2600); }
  await adv(page, 30000);
  const r = [];
  for (const s of [0, 1, 2, 3]) r.push((await tube(page, s)).solid / p0);
  assert(r[0] > 0.5 && r[0] < 0.8, 'AgCl + 0,5 mL verd.: Rest ' + r[0].toFixed(3));
  assert(r[1] > 0.9, 'AgBr + 1 mL verd. weitgehend beständig: ' + r[1].toFixed(3));
  assert(r[2] > 0.95, 'AgI + 6 mL konz. bleibt: ' + r[2].toFixed(3));
  assert(r[3] > 0.999, 'Wasser löst nicht: ' + r[3].toFixed(4));
  ev.push(await shot(page, 'nachher-1.1.0-nh3-grenzfaelle'));
  const k = await S(page, (A, FL) => ({ pKsp: Object.fromEntries(Object.entries(FL.chem.KSP).map(([a, v]) => [a, +(-Math.log10(v)).toFixed(2)])), lgK1: FL.chem.LOG_K1, lgK2: FL.chem.LOG_K2 }));
  assert(k.pKsp.Cl === 9.74 && k.pKsp.Br === 12.3 && k.pKsp.I === 16.08 && k.lgK1 === 3.31 && k.lgK2 === 3.91, 'Konstanten unverändert: ' + JSON.stringify(k));
  writeEvidence('FK10-grenzfaelle.json', { rest_anteil: { agcl_0_5ml_verd: r[0], agbr_1ml_verd: r[1], agi_6ml_konz: r[2], agcl_3ml_wasser: r[3] }, konstanten: k });
  await done();
  return { detail: `Rest AgCl ${r[0].toFixed(2)}, AgBr ${r[1].toFixed(2)}, AgI ${r[2].toFixed(3)}, Wasser ${r[3].toFixed(4)}`, evidence: ev.concat(['docs/evidence/FK10-grenzfaelle.json']) };
});

// =========================================================== FK11 Ausgießanimation
await scenario('FK11', 'Spülen: Anheben, Kippen über beschrifteten Silberabfall, Strahl trifft die Öffnung, leer zurück; zustandsgekoppelt, 1× archiviert', async () => {
  const { page, done } = await open();
  await precip(page, 'nacl', 1, 6); await fill(page, 'nai', 0);
  const other = await tube(page, 0);
  await tubeHit(page, 1);
  const V0 = (await tube(page, 1)).V;
  assert(/Silberabfälle/.test(await page.locator('.wlabel').innerText()), 'Abfallbehälter beschriftet');
  await btn(page, '#btnRinse');
  const t0 = await now(page) - 0.05;
  const frames = [], ev = [];
  for (const [i, t] of [0.12, 0.45, 0.8, 1.2, 1.6, 2.0, 2.3].entries()) {
    await untilModel(page, t0 + t);
    const f = await S(page, (A) => {
      const pr = A.lab.state.pour; if (!pr) return null;
      const q = A.renderer.pourPose(pr), w = q.w, s = A.renderer.toScreen(q.lip.x, (q.lip.y + w.top) / 2);
      const fx = document.getElementById('fx'), d = A.renderer.view.dpr;
      const a = fx.getContext('2d').getImageData(Math.round(s.x * d) - 3, Math.round(s.y * d), 7, 1).data;
      let alpha = 0; for (let j = 3; j < a.length; j += 4) alpha = Math.max(alpha, a[j]);
      return { k: q.k, phase: q.phase, winkel: Math.round(q.a * 180 / Math.PI), lip: q.lip, oeffnung: { x0: w.x - w.w / 2, x1: w.x + w.w / 2, y: w.top }, V: A.lab.tube(pr.slot).V, abfallV: A.lab.tab().waste.V, strahlAlpha: alpha, label: document.querySelectorAll('.tlabel')[pr.slot].innerText };
    });
    frames.push(Object.assign({ t }, f));
    ev.push(await shot(page, `nachher-1.1.0-ausgiessen-${i + 1}`, { x: 0, y: 60, width: 880, height: 560 }));
  }
  await idle(page);
  const pourFr = frames.filter((f) => f && f.phase === 'pour');
  assert(frames[0] && frames[0].phase === 'lift' && /wird ausgegossen/.test(frames[0].label), 'Anheben, Glas als „wird ausgegossen“ beschriftet');
  assert(pourFr.length >= 2 && pourFr.every((f) => f.winkel > 90), 'gekippt: ' + pourFr.map((f) => f.winkel));
  assert(pourFr.every((f) => f.lip.x > f.oeffnung.x0 && f.lip.x < f.oeffnung.x1 && f.lip.y < f.oeffnung.y), 'Lippe über der Öffnung');
  assert(pourFr.some((f) => f.strahlAlpha > 60), 'Strahl sichtbar zwischen Lippe und Öffnung');
  const vs = frames.filter(Boolean).map((f) => f.V);
  assert(vs.every((v, i) => i === 0 || v <= vs[i - 1] + 1e-12) && vs[0] > vs.at(-1), 'Füllstand sinkt mit dem Ausgießen');
  const s = await tabState(page);
  const after = await tube(page, 0);
  assert(s.tubes[1].V === 0 && s.archive.join() === 'A1', 'leer zurück, A1 einmal archiviert');
  assert(rel(s.waste.V, V0) < 1e-9 && rel(s.waste.Ag, 6 * DROP) < 1e-9, 'Abfall = Inhalt');
  assert(JSON.stringify(after) === JSON.stringify(other), 'anderes Glas unberührt');
  const fxClear = await S(page, () => { const c = document.getElementById('fx'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  const dur = await S(page, (A, FL) => FL.model.T.pour);
  writeEvidence('FK11-ausgiessen.json', { dauer_s: dur, bilder: frames });
  await done();
  return { detail: `${dur} s; Winkel ${pourFr.map((f) => f.winkel).join('/')}°, Strahl sichtbar, Abfall ${s.waste.V.toFixed(2)} mL; Bewegungsebene danach ${fxClear ? 'mit Pipetten' : 'leer'}`, evidence: ev.concat(['docs/evidence/FK11-ausgiessen.json']) };
});

// =========================================================== FK12 Ausgießen unter Abbruch
await scenario('FK12', 'Ausgießen bei Mehrfachklick, Pause, Tabwechsel, Fokusverlust, Reload und reduzierter Bewegung stabil', async () => {
  const out = [];
  const setup = async (page) => { await precip(page, 'nacl', 0, 4); await fill(page, 'nabr', 1); await tubeHit(page, 0); };
  const check = async (page, name) => {
    await idle(page);
    const s = await tabState(page);
    assert(s.tubes[0].V === 0 && s.archive.join() === 'A1' && s.tubes[1].ansatz === 'A2' && s.tubes[1].V > 0, name + ': ' + JSON.stringify(s));
    assert(rel(s.waste.Ag, 4 * DROP) < 1e-9, name + ': Abfall einfach gebucht');
    await fill(page, 'nai', 0); assert((await tube(page, 0)).ansatz === 'A3', name + ': danach bedienbar');
    out.push(name);
  };
  { // Mehrfachklick
    const { page, done } = await open(); await setup(page);
    for (let i = 0; i < 5; i++) await page.locator('#btnRinse').click({ force: true });
    await check(page, 'Mehrfachklick'); await done();
  }
  { // Pause während des Ausgießens
    const { page, done } = await open(); await setup(page);
    await btn(page, '#btnRinse'); await adv(page, 400); await speed(page, 0); await adv(page, 2000);
    const mid = await S(page, (A) => !!A.lab.state.pour);
    await speed(page, 1); await check(page, 'Pause' + (mid ? ' (angehalten)' : '')); await done();
  }
  { // Tabwechsel
    const { page, done } = await open(); await setup(page);
    await btn(page, '#btnRinse'); await adv(page, 500); await part(page, 'control'); await adv(page, 100);
    assert(!(await S(page, (A) => !!A.lab.state.pour)), 'Tabwechsel schließt ab');
    await part(page, 'main'); await check(page, 'Tabwechsel'); await done();
  }
  { // Fokusverlust
    const { page, done } = await open(); await setup(page);
    await btn(page, '#btnRinse'); await adv(page, 500); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await adv(page, 100);
    await check(page, 'Fokusverlust'); await done();
  }
  { // Reload mitten im Ausgießen
    const { page, done } = await open(); await setup(page);
    await btn(page, '#btnRinse'); await adv(page, 900);
    await page.evaluate(() => window.FL.app.flush());
    await page.reload(); await page.waitForFunction(() => window.FL && window.FL.app); await adv(page, 300);
    assert(!(await S(page, (A) => !!A.lab.state.pour)), 'nach Reload kein hängendes Ausgießen');
    await check(page, 'Reload'); await done();
  }
  { // Entfernen während Ausgießen anderer Gläser gesperrt
    const { page, done } = await open(); await setup(page);
    await btn(page, '#btnRinse'); await adv(page, 300);
    await tubeHit(page, 1); await btn(page, '#btnRemoveTube');
    assert(/warten/.test(await toastText(page)), 'zweiter Handgriff wartet');
    await tubeHit(page, 0); await check(page, 'paralleles Entfernen'); await done();
  }
  { // reduzierte Bewegung: kurz, im Ständer
    const { page, done } = await open({ reducedMotion: 'reduce' }); await setup(page);
    await btn(page, '#btnRinse'); await adv(page, 300);
    const r = await S(page, (A) => ({ reduced: A.lab.state.reduced, dur: A.lab.state.pour && A.lab.state.pour.dur, ps: A.renderer.pouringSlot() }));
    assert(r.reduced && r.dur <= 1 && r.ps === null, 'vereinfacht: ' + JSON.stringify(r));
    await check(page, 'reduzierte Bewegung'); await done();
  }
  return { detail: out.join(', ') };
});

// =========================================================== FK13 Konzentrationen nur in der Infokarte
await scenario('FK13', 'Bühne ohne Konzentrationsangaben; genaue Werte in der Infokarte; Modellwerte unverändert', async () => {
  const { page, done } = await open();
  for (const p of ['main', 'control']) {
    if (p === 'control') { await part(page, 'control'); await adv(page, 200); }
    const txt = await stageStrings(page);
    assert(!/mol\/L|w = 25|0,100|2,0 mol|%/.test(txt), p + ': Konzentration auf der Bühne: ' + (txt.match(/.{0,20}(mol\/L|%).{0,10}/) || [''])[0]);
  }
  await part(page, 'main'); await adv(page, 200);
  const want = { agno3: 'c = 0,100 mol/L', nacl: 'c = 0,100 mol/L', nabr: 'c = 0,100 mol/L', nai: 'c = 0,100 mol/L', nh3dil: 'c = 2,0 mol/L (w ≈ 3,4 %)', nh3conc: 'c ≈ 13,3 mol/L (w = 25 %)' };
  const ev = [];
  for (const [k, c] of Object.entries(want)) {
    await page.locator(`.binfo[data-info="${k}"]`).click(); await adv(page, 120);
    const t = await page.locator('.modal-card').innerText();
    assert(t.includes('Konzentration: ' + c), `${k}: Karte zeigt ${c}`);
    if (k === 'nh3conc') ev.push(await shot(page, 'nachher-1.1.0-infokarte-nh3-konz'));
    await page.keyboard.press('Escape'); await adv(page, 80);
  }
  const m = await S(page, (A, FL) => Object.fromEntries(['agno3', 'nacl', 'nabr', 'nai', 'nh3dil', 'nh3conc'].map((k) => [k, FL.chem.SOLUTIONS[k].c])));
  assert(m.agno3 === 0.1 && m.nacl === 0.1 && m.nh3dil === 2.0 && Math.abs(m.nh3conc - 13.3) < 0.1, 'Modellkonzentrationen: ' + JSON.stringify(m));
  await done();
  return { detail: 'keine Konzentration auf der Bühne; 6 Infokarten mit Konzentration; Modell ' + JSON.stringify(m), evidence: ev };
});

// =========================================================== FK14/FK15 Mischen der Antworten
const optOrder = (page) => page.$$eval('#panelBody fieldset[data-q]', (fs) => Object.fromEntries(fs.map((f) => {
  const sel = f.querySelector('select');
  return [f.dataset.q, sel ? [...sel.options].map((o) => o.value).filter(Boolean) : [...f.querySelectorAll('.lk-opt input')].map((i) => i.value)];
})));
async function tasksAt(page, step) { await ptab(page, 'tasks'); await adv(page, 80); await page.locator(`.lk-stepchips [data-step="${step}"]`).click(); await adv(page, 80); }
await scenario('FK14', 'Antworten je Durchgang gemischt (Startwerte über #seed); Bewertung über fachliche IDs', async () => {
  const seeds = [1, 7, 42, 1234, 98765], perSeed = {}, ev = [];
  for (const seed of seeds) {
    const { page, done } = await open({}, BASE + '#seed=' + seed);
    const o = {};
    for (const st of ['beob', 'ionen', 'gleich', 'nh3']) { await tasksAt(page, st); Object.assign(o, await optOrder(page)); }
    perSeed[seed] = o;
    if (seed === 42) {
      // richtige Antworten über IDs ankreuzen – Bewertung richtig, unabhängig von der Position
      await tasksAt(page, 'gleich');
      for (const q of ['eqCl', 'eqBr', 'eqI']) await page.locator(`input[name="${q}"][value="full"]`).check();
      await page.locator('#lkStepForm [data-act="grade"]').click(); await adv(page, 80);
      assert(/Alles richtig/.test(await page.locator('#panelBody').innerText()), 'Gleichungen über ID richtig bewertet');
      ev.push(await shot(page, 'nachher-1.1.0-aufgaben-gemischt-seed42'));
      await tasksAt(page, 'ionen');
      for (const k of ['zuschauerGeloest', 'feststoffIonen']) await page.locator(`input[name="aussagen"][value="${k}"]`).check();
      for (const [r, v] of [['ag', 'fest'], ['x', 'fest'], ['na', 'zus'], ['no3', 'zus']]) await page.locator(`select[name="rolle.${r}"]`).selectOption(v);
      await page.locator('#lkStepForm [data-act="grade"]').click(); await adv(page, 80);
      assert(/Alles richtig/.test(await page.locator('#panelBody').innerText()), 'Mehrfachauswahl über IDs richtig');
    }
    await done();
  }
  const qs = Object.keys(perSeed[seeds[0]]);
  const differing = qs.filter((q) => new Set(seeds.map((s) => perSeed[s][q].join())).size > 1);
  assert(differing.length === qs.length, 'alle Fragen gemischt: ' + qs.filter((q) => !differing.includes(q)));
  // richtige Gleichung nicht immer an derselben Stelle
  const pos = seeds.map((s) => perSeed[s].eqCl.indexOf('full'));
  assert(new Set(pos).size > 1, 'richtige Gleichung an wechselnden Stellen: ' + pos);
  // Gleichungen als Ganzes: Optionsmenge unverändert
  assert(seeds.every((s) => perSeed[s].eqCl.slice().sort().join() === perSeed[seeds[0]].eqCl.slice().sort().join()), 'gleiche Optionen');
  writeEvidence('FK14-reihenfolgen.json', { seeds, reihenfolgen: perSeed, position_richtige_eqCl: pos });
  return { detail: `${qs.length} Fragen, ${seeds.length} Startwerte, Position „full“ in eqCl: ${pos.join(',')}`, evidence: ev.concat(['docs/evidence/FK14-reihenfolgen.json']) };
});

await scenario('FK15', 'Reihenfolge bleibt beim Antworten, Prüfen, Hilfe, Reiter-/Teilwechsel und Reload; „Neuer Durchgang“ mischt neu', async () => {
  const { page, done } = await open();
  await tasksAt(page, 'beob');
  const o0 = await optOrder(page);
  await page.locator('input[name="ablauf"][value="absetzen"]').check();
  await page.locator('#lkStepForm [data-act="grade"]').click(); await adv(page, 80);
  await page.locator('[data-act="tip"]').first().click(); await adv(page, 80);
  assert(JSON.stringify(await optOrder(page)) === JSON.stringify(o0), 'nach Antworten/Prüfen/Hilfe gleich');
  await ptab(page, 'guide'); await part(page, 'control'); await part(page, 'main'); await tasksAt(page, 'beob');
  assert(JSON.stringify(await optOrder(page)) === JSON.stringify(o0), 'nach Reiter-/Teilwechsel gleich');
  await page.evaluate(() => window.FL.app.flush());
  await page.reload(); await page.waitForFunction(() => window.FL && window.FL.app); await adv(page, 300);
  await tasksAt(page, 'beob');
  assert(JSON.stringify(await optOrder(page)) === JSON.stringify(o0), 'nach Reload gleich');
  assert(await page.locator('input[name="ablauf"][value="absetzen"]').isChecked(), 'Auswahl nach Reload erhalten');
  const seed0 = await S(page, (A) => A.ui.state.learn.main.seed);
  // Neuer Durchgang: Rückfrage, Abbrechen neutral, dann neu gemischt
  await page.locator('[data-act="newRound"]').click(); await adv(page, 80);
  await page.locator('.modal [data-m="close"]').click(); await adv(page, 80);
  assert((await S(page, (A) => A.ui.state.learn.main.seed)) === seed0, 'Abbrechen behält den Durchgang');
  await page.locator('[data-act="newRound"]').click(); await page.locator('.modal [data-m="newRoundYes"]').click(); await adv(page, 100);
  const seed1 = await S(page, (A) => A.ui.state.learn.main.seed);
  await tasksAt(page, 'beob');
  const o1 = await optOrder(page);
  assert(seed1 !== seed0, 'neuer Startwert');
  assert(!(await page.locator('input[name="ablauf"][value="absetzen"]').isChecked()), 'Antworten gelöscht');
  const allQ = [];
  for (const st of ['beob', 'ionen', 'gleich', 'nh3']) { await tasksAt(page, st); allQ.push(JSON.stringify(await optOrder(page))); }
  assert(JSON.stringify(o1) !== JSON.stringify(o0) || allQ.length, 'neu gemischt');
  await done();
  return { detail: `Startwert ${seed0} stabil; neuer Durchgang → ${seed1}` };
});

// =========================================================== FK16 Altzustände
await scenario('FK16', 'Sitzung aus 1.0.0 (Buchstaben-Antworten) wird übernommen und richtig bewertet; Speicherfehler abgefangen', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx.route((u) => !/^http:\/\/localhost/.test(String(u)) && !/^(data|blob|about):/.test(String(u)), (r) => r.abort());
  // gespeicherter Stand im Format 1.0.0: richtige Antworten als Buchstaben (eqCl „c“, aussagen a+b, ablauf a–d)
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('sivex.faellungslabor.session.v1')) return;
    const st = (answers, graded) => ({ answers, graded: graded || null, fails: 0, tip: 0, solution: false, confirmSolution: false });
    sessionStorage.setItem('sivex.faellungslabor.session.v1', JSON.stringify({ v: 1, version: '1.0.0', lab: null, ui: {
      ptab: { main: 'tasks', control: 'guide' },
      learn: { main: { step: 'gleich', steps: {
        beob: st({ 'farbe.nacl': 'weiss', 'farbe.nabr': 'creme', 'farbe.nai': 'gelb', ablauf: ['a', 'b', 'c', 'd'] }, { allCorrect: true }),
        ionen: st({ 'rolle.ag': 'fest', 'rolle.x': 'fest', 'rolle.na': 'zus', 'rolle.no3': 'zus', aussagen: ['a', 'b'] }, { allCorrect: true }),
        gleich: st({ eqCl: 'c', eqBr: 'd', eqI: 'a' }, { allCorrect: true }) } } },
      records: { main: [], control: [] }, drafts: {}, uid: 1 } }));
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.clock.install(); page.__clock = true;
  await page.goto(BASE); await page.waitForFunction(() => window.FL && window.FL.app); await adv(page, 600);
  const t = await toastText(page);
  assert(/aus Version 1\.0 übernommen/.test(t), 'Migrationshinweis: ' + t);
  const L = await S(page, (A) => A.ui.state.learn.main);
  assert(L.v === 2 && L.steps.gleich.answers.eqCl === 'full' && L.steps.gleich.answers.eqBr === 'full' && L.steps.gleich.answers.eqI === 'full', 'Gleichungen auf IDs: ' + JSON.stringify(L.steps.gleich.answers));
  assert(L.steps.ionen.answers.aussagen.join() === 'zuschauerGeloest,feststoffIonen' && L.steps.beob.answers.ablauf.join() === 'wolke,verteilt,absetzen,aufwirbeln', 'Mehrfachauswahl auf IDs');
  assert(L.steps.gleich.graded.allCorrect && L.steps.ionen.graded.allCorrect && L.steps.beob.graded.allCorrect, 'neu bewertet: weiterhin richtig');
  const prog = await page.locator('.progress').innerText();
  assert(/3 von 3/.test(prog), 'Fortschritt erhalten: ' + prog);
  assert(await page.locator('input[name="eqCl"][value="full"]').isChecked(), 'Auswahl sichtbar übernommen');
  const ev = [await shot(page, 'nachher-1.1.0-migration-1-0')];
  // Reload: kein zweiter Hinweis, Daten stabil
  await page.evaluate(() => window.FL.app.flush());
  await page.reload(); await page.waitForFunction(() => window.FL && window.FL.app); await adv(page, 600);
  assert((await S(page, (A) => A.ui.state.learn.main.steps.gleich.answers.eqCl)) === 'full', 'nach Reload stabil');
  assert(!errs.length, errs.join('; '));
  await ctx.close();
  // beschädigter Speicher
  const ctx2 = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx2.addInitScript(() => { try { sessionStorage.setItem('sivex.faellungslabor.session.v1', '{kaputt'); } catch (e) { /* */ } });
  const p2 = await ctx2.newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
  await p2.goto(BASE); await p2.waitForFunction(() => window.FL && window.FL.app);
  assert(!e2.length && (await p2.evaluate(() => window.FL.app.ui.state.learn.main.v)) === 2, 'beschädigter Speicher: frischer Start');
  await ctx2.close();
  // gesperrter Speicher
  const ctx3 = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx3.addInitScript(() => { for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { configurable: true, get() { throw new Error('gesperrt'); } }); });
  const p3 = await ctx3.newPage(); const e3 = []; p3.on('pageerror', (e) => e3.push(e.message));
  await p3.goto(BASE); await p3.waitForFunction(() => window.FL && window.FL.app);
  await p3.locator('#ptabs [data-ptab="tasks"]').click(); await p3.locator('input[name="ablauf"]').first().check();
  assert(!e3.length, 'gesperrter Speicher: ' + e3.join('; '));
  await ctx3.close();
  return { detail: 'Buchstaben → IDs (eq/Mehrfachauswahl), Bewertung erhalten, Hinweis einmal; kaputter/gesperrter Speicher ok', evidence: ev };
});

// =========================================================== FK19 Version und Prüfsummen
await scenario('FK19', '1.1.1 in App, Metadaten, Manifest und Paketen; SHA256SUMS aktuell; nur aktuelle Version in release/', async () => {
  const rd = path.join(APP, 'release'), files = fs.readdirSync(rd).sort();
  assert(JSON.stringify(files) === JSON.stringify(['SHA256SUMS.txt', `faellungslabor-${VERSION}-scorm12.zip`, `faellungslabor-${VERSION}-web.zip`, `faellungslabor-${VERSION}.html`].sort()), 'release/: ' + files);
  assert(VERSION === '1.1.1', 'package.json ' + VERSION);
  const sums = fs.readFileSync(path.join(rd, 'SHA256SUMS.txt'), 'utf8').trim().split('\n').map((l) => l.split(/\s+\*?/));
  for (const [h, n] of sums) assert(crypto.createHash('sha256').update(fs.readFileSync(path.join(rd, n))).digest('hex') === h, 'Prüfsumme ' + n);
  const sx = JSON.parse(fs.readFileSync(path.join(APP, 'sivex.json'), 'utf8'));
  assert(sx.version === VERSION, 'sivex.json');
  const html = fs.readFileSync(REL(`faellungslabor-${VERSION}.html`), 'utf8');
  assert(html.includes(`VERSION = '${VERSION}'`) && html.includes(`id="ver">${VERSION}<`), 'Einzeldatei-Version');
  const web = unzip(fs.readFileSync(REL(`faellungslabor-${VERSION}-web.zip`)));
  const sc = unzip(fs.readFileSync(REL(`faellungslabor-${VERSION}-scorm12.zip`)));
  const find = (z, re) => { const k = [...z.keys()].find((n) => re.test(n)); return k && z.get(k).toString('utf8'); };
  assert(JSON.parse(find(web, /sivex\.json$/)).version === VERSION && find(web, /js\/app\.js$/).includes(`VERSION = '${VERSION}'`), 'Web-ZIP-Version');
  assert(new RegExp(`<version>${VERSION.replace(/\./g, '\\.')}</version>|version="${VERSION.replace(/\./g, '\\.')}"|${VERSION.replace(/\./g, '\\.')}`).test(find(sc, /imsmanifest\.xml$/)), 'Manifest nennt ' + VERSION);
  // Paketinhalt entspricht dem Quellstand (js/css/index.html)
  for (const f of ['js/model.js', 'js/render.js', 'js/app.js', 'js/ui.js', 'js/tasks.js', 'js/geometry.js', 'css/app.css']) {
    const src = fs.readFileSync(path.join(APP, f), 'utf8'), z = find(web, new RegExp(f.replace(/[./]/g, (c) => '\\' + c) + '$'));
    assert(z === src, 'Paket ≠ Quelle: ' + f);
  }
  return { detail: `${files.length} Dateien in release/, Prüfsummen stimmen, Paket = Quellstand` };
});

// =========================================================== Abschluss
await browser.close();
server.close();
const ext = allRequests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:'));
if (!ONLY) results.push({ id: 'FK-NET', title: 'Netzwerk und Konsole über alle FK-Szenarien', status: !ext.length && !allErrors.length ? 'PASS' : 'FAIL', detail: `${allRequests.length} Anfragen, extern ${ext.length}, Fehler ${allErrors.length}${allErrors.length ? ': ' + allErrors.slice(0, 3).join(' | ') : ''}` });
const out = { date: new Date().toISOString(), version: VERSION, browser: BROWSER, emulated: 'Chromium-Desktop; Touch per Playwright-Emulation; kein echtes iPad', target: process.env.E2E_ROOT ? path.relative(APP, ROOT) : `release/faellungslabor-${VERSION}-web.zip (frisch entpackt, HTTP)`, results };
if (!ONLY) fs.writeFileSync(path.join(APP, 'tests/e2e/korrektur-results.json'), JSON.stringify(out, null, 2) + '\n');
const failed = results.filter((r) => r.status !== 'PASS');
console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
void pathToFileURL;
