// End-to-End-Prüfung von Pufferfish 0.2.2 im echten Browser (Chromium/Edge über Playwright).
// Bedient ausschließlich die gerenderte Oberfläche; der Modellzustand wird nur gelesen.
// Erwartungswerte für pH stammen aus chem.js im Browser bzw. aus unabhängigen Formeln.
// Zugaben laufen über die Playwright-Uhr (clock) schneller als in Echtzeit ab.
// Aufruf: npm run build && node tests/e2e/run.mjs   (ONLY=E02,E05 für einzelne Szenarien)
// Zuordnung zu den Abnahmekriterien P01–P16 des Änderungsauftrags: siehe `p` je Szenario und docs/TESTBERICHT.md.
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '../../scripts/serve.mjs';
import { APP, launch, newPage, S, beakers, idle, waitFor, click, go, reagent, kind, tool, target, dose, exp, view, speed, tab, toastText, setVal, shot, adv, assert, near } from './lib.mjs';

const ROOT = process.env.E2E_ROOT ? path.resolve(process.env.E2E_ROOT) : path.join(APP, 'dist/pufferfish');
const PORT = Number(process.env.E2E_PORT || 8172);
const BASE = `http://localhost:${PORT}/index.html`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const results = [], allRequests = [], allErrors = [];

async function scenario(id, p, title, fn) {
  if (ONLY && !ONLY.includes(id)) return;
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ id, p, title, status: 'PASS', detail: detail || '', ms: Date.now() - t0 });
    console.log(`PASS ${id} [${p}] ${title}${detail ? ' – ' + detail : ''}`);
  } catch (e) {
    results.push({ id, p, title, status: 'FAIL', detail: e.message, ms: Date.now() - t0 });
    console.log(`FAIL ${id} [${p}] ${title} – ${e.stack}`);
  }
}

const browser = await launch();
const server = await serve(ROOT, PORT);
console.log(`Browser: ${browser.__channel} ${browser.version()} · Quelle: ${path.relative(APP, ROOT) || '.'}`);
async function open(opts = {}) {
  const o = await newPage(browser, BASE, Object.assign({ clock: true }, opts));
  o.done = async () => { allErrors.push(...o.errors); allRequests.push(...o.requests); await o.context.close(); };
  return o;
}
const refPH = (page, recipe, reagentKey, mL) => S(page, (A, C, a) => C.pH(C.add(a.r === 'water' ? C.water(30) : a.r === 'phos' ? C.phosphate(30, 0.05, 0.05) : C.acetate(30, a.ha, a.a), a.reagent, a.mL)), Object.assign({ reagent: reagentKey, mL }, recipe));
/** Sichtbarer Text und alle Attributtexte (aria-label, title, placeholder, alt) der Seite. */
const allText = (page) => page.evaluate(() => {
  const t = [document.body.innerText];
  document.querySelectorAll('[aria-label],[title],[placeholder],[alt]').forEach((e) => { for (const a of ['aria-label', 'title', 'placeholder', 'alt']) if (e.getAttribute(a)) t.push(e.getAttribute(a)); });
  return t.join('\n');
});
const FORBIDDEN = /Verdünnung|Wunderwasser|Vermutung|Hypothese|Zeitlupe/i;
const lum = (rgb) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : 0.5; };

// =========================================================== E01 Logo
await scenario('E01', 'Logo', 'Logo: Begrüßung pumpt sich auf, erneut per Klick/Tastatur, keine Layoutsprünge; reduzierte Bewegung', async () => {
  const { page, errors, done } = await open({ clock: false });
  const r0 = await page.locator('#logo').boundingBox();
  const h0 = await page.locator('.lk-head').boundingBox();
  await adv(page, 1000); // Begrüßung startet nach 450 ms, Höhepunkt bei etwa 22 % von 2,6 s
  const mid = await page.evaluate(() => ({ cls: document.querySelector('#logo').className, tr: getComputedStyle(document.querySelector('.pf-body')).transform }));
  assert(mid.cls.includes('puff'), 'Begrüßungsanimation läuft');
  const sc = (m) => { const v = /matrix\(([^,]+)/.exec(m); return v ? Number(v[1]) : 1; };
  assert(sc(mid.tr) > 1.15, `Körper aufgepumpt (Skalierung ${sc(mid.tr)})`);
  const r1 = await page.locator('#logo').boundingBox(), h1 = await page.locator('.lk-head').boundingBox();
  assert(r0.x === r1.x && r0.width === r1.width && h0.height === h1.height, 'keine Layoutsprünge durch das Logo');
  await adv(page, 2600);
  assert(!(await page.locator('#logo').getAttribute('class')).includes('puff'), 'Animation endet wieder');
  await page.locator('#logo').focus(); await page.keyboard.press('Enter'); await adv(page, 500);
  assert((await page.locator('#logo').getAttribute('class')).includes('puff'), 'per Tastatur erneut auslösbar');
  await done();
  const rm = await open({ reducedMotion: 'reduce', clock: false });
  await adv(rm.page, 900);
  const st = await rm.page.evaluate(() => ({ cls: document.querySelector('#logo').className, tr: getComputedStyle(document.querySelector('.pf-body')).transform, rm: window.PF.app.ui.reduceMotion }));
  assert(st.rm && !st.cls.includes('puff') && (st.tr === 'none' || /matrix\(1, 0, 0, 1/.test(st.tr)), 'prefers-reduced-motion: keine Logoanimation');
  await rm.done();
  assert(!errors.length, errors.join(' | '));
  return `Skalierung ${sc(mid.tr).toFixed(2)}, Logo-Box unverändert ${r0.width}×${r0.height}`;
});

// =========================================================== E02 Start: drei Versuche, Pufferlösung, ohne Vermutung
await scenario('E02', 'P01,P02,P03', 'Frische Sitzung: drei Versuche, „Wasser“ und „Pufferlösung“ von Beginn an, keine Vermutung nötig, sofort dosierbar; Versuch 4 / „Wunderwasser“ nirgends', async () => {
  const { page, errors, done } = await open();
  const chips = await page.locator('#expChips button').allInnerTexts();
  assert(chips.length === 3, `genau drei Versuche: ${JSON.stringify(chips)}`);
  assert(/Wasser & Pufferlösung/.test(chips[0]) && /Säure, Base, Gemisch/.test(chips[1]) && /Puffer herstellen/.test(chips[2]), 'Namen der drei Versuche: ' + JSON.stringify(chips));
  assert(await page.locator('#predictForm, #btnSkipPredict').count() === 0, 'kein Vermutungsformular');
  const tags = await page.locator('.tag .nm').allInnerTexts();
  assert(tags.length === 2 && /A · Wasser/.test(tags[0]) && /B · Pufferlösung/.test(tags[1]), 'Wasser und Pufferlösung beschriftet: ' + JSON.stringify(tags));
  const pv = await page.locator('.pview header .nm').allInnerTexts();
  assert(pv.length === 2 && /Pufferlösung/.test(pv[1]), 'Pufferlösung auch im Teilchenmodell: ' + JSON.stringify(pv));
  const meta = await S(page, (A, C) => ({ sel: A.ui.page, exp: window.PF.engine.EXPERIMENTS.map((e) => e.id), samples: Object.keys(window.PF.engine.SAMPLES) }));
  assert(meta.exp.join() === 'e1,e2,e3', 'nur e1–e3 in den Metadaten');
  // ohne Vermutung sofort: Lösung gewählt (HCl), Zugabe auslösen
  assert(await page.locator('#doseBar [data-reagent="HCl"]').getAttribute('aria-pressed') === 'true', 'HCl vorgewählt');
  await go(page);
  await waitFor(page, (A) => A.eng.state.drops.length > 0);
  await idle(page);
  const bs = await beakers(page);
  assert(bs.every((b) => Math.abs(b.added - 0.05) < 1e-12), 'erste Zugabe ohne Vermutung gelungen');
  // verbotene Begriffe in allen Bereichen der Oberfläche (sichtbarer Text und Attribute)
  const bad = [];
  const scan = async (label) => { const m = FORBIDDEN.exec(await allText(page)); if (m) bad.push(`${label}: „${m[0]}“`); };
  await scan('Labor V1');
  for (const t of ['task', 'results', 'journal', 'notebook']) { await tab(page, t); await scan('Reiter ' + t); }
  await tab(page, 'task');
  for (const e of ['e2', 'e3']) { await exp(page, e); for (const t of ['task', 'results']) { await tab(page, t); await scan(`${e}/${t}`); } }
  await exp(page, 'e1'); await tab(page, 'task');
  for (const pg of ['theory', 'tasks', 'apps']) { await click(page, `#steps [data-page="${pg}"]`); if (await page.locator(`[data-force]`).count()) await click(page, '[data-force]'); await scan('Seite ' + pg); }
  await click(page, '#steps [data-page="lab"]');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(!FORBIDDEN.test(html.replace(/prefers-reduced-motion/g, '')), 'auch nicht in index.html');
  const files = ['js/app.js', 'js/ui.js', 'js/learn.js', 'js/engine.js', 'js/chem.js', 'js/render-lab.js', 'js/render-particles.js', 'js/render-mix.js', 'js/chart.js', 'js/geometry.js', 'css/app.css', 'sivex.json'];
  for (const f of files) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); for (const m of t.match(/.*(Wunderwasser|Verdünnung|Zeitlupe).*/gi) || []) bad.push(`${f}: ${m.trim().slice(0, 90)}`); }
  assert(!bad.length, 'verbotene Begriffe: ' + bad.join(' | '));
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'drei Versuche; keine Treffer für Verdünnung/Wunderwasser/Vermutung/Zeitlupe in Oberfläche und ausgelieferten Dateien';
});

// =========================================================== E03 Dosierleiste: Flasche ↔ Schalter, Reihenfolge, dunkel nur ausgewählt
await scenario('E03', 'P05', 'Flasche und Umschalter wählen synchron HCl/NaOH (Maus, Touch, Tastatur); Dosierleiste 1 Lösung → 2 Pipette → 3 Menge → 4 Ziel/Zugabe; nur Gewähltes dunkel', async () => {
  const { page, errors, done } = await open({ hasTouch: true });
  const pressed = (sel) => page.locator(sel).getAttribute('aria-pressed');
  const state = () => S(page, (A) => ({ slot: A.eng.state.slot, tool: A.eng.state.tool, kind: A.eng.state.kind }));
  // Reihenfolge der Schritte (DOM und Anzeige)
  const steps = await page.evaluate(() => [...document.querySelectorAll('#doseBar .slbl')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.innerText.replace(/\s+/g, ' ').trim(), x: Math.round(r.x), y: Math.round(r.y) }; }));
  assert(steps.map((s) => s.t).join('|').replace(/\s/g, '') === ['1 Lösung', '2 Pipette', '3 Menge', '4 Ziel', '5 Zugabe'].join('|').replace(/\s/g, ''), 'Reihenfolge der Schritte: ' + JSON.stringify(steps));
  for (let i = 1; i < steps.length; i++) assert(steps[i].y > steps[i - 1].y - 4 && (steps[i].y > steps[i - 1].y + 4 || steps[i].x > steps[i - 1].x), `Lesereihenfolge ${steps[i - 1].t} → ${steps[i].t}`);
  const order = await page.evaluate(() => { const q = (s) => [...document.querySelectorAll(s)]; const all = q('#doseBar [data-reagent], #doseBar [data-tool], #doseBar [data-kind], #doseBar [data-target], #btnGo'); const idx = (e) => all.indexOf(e); return { r: idx(q('#doseBar [data-reagent]').at(-1)), t: idx(q('#doseBar [data-tool]')[0]), k: idx(q('#doseBar [data-kind]')[0]), z: idx(q('#doseBar [data-target]')[0]), g: idx(document.querySelector('#btnGo')) }; });
  assert(order.r < order.t && order.t < order.k && order.k < order.z && order.z < order.g, 'Lösungen vor Pipetten vor Menge vor Ziel/Zugabe: ' + JSON.stringify(order));
  // Flasche → Umschalter
  assert((await state()).slot === 'HCl');
  await click(page, '.bottlebtn[data-bottle="NaOH"]', true);
  assert((await state()).slot === 'NaOH', 'Antippen der NaOH-Flasche aktiviert NaOH');
  assert(await pressed('#doseBar [data-reagent="NaOH"]') === 'true' && await pressed('#doseBar [data-reagent="HCl"]') === 'false', 'Umschalter zeigt NaOH');
  assert(await pressed('.bottlebtn[data-bottle="NaOH"]') === 'true' && await pressed('.bottlebtn[data-bottle="HCl"]') === 'false', 'Flaschenschalter zeigt NaOH');
  // Umschalter → Flasche
  await click(page, '#doseBar [data-reagent="HCl"]', true);
  assert((await state()).slot === 'HCl' && await pressed('.bottlebtn[data-bottle="HCl"]') === 'true' && await pressed('.bottlebtn[data-bottle="NaOH"]') === 'false', 'Umschalter → Flasche synchron');
  // Tastatur
  await page.locator('.bottlebtn[data-bottle="NaOH"]').focus(); await page.keyboard.press('Enter'); await adv(page, 60);
  assert((await state()).slot === 'NaOH' && await pressed('#doseBar [data-reagent="NaOH"]') === 'true', 'Tastatur auf der Flasche');
  await page.locator('#doseBar [data-reagent="HCl"]').focus(); await page.keyboard.press('Space'); await adv(page, 60);
  assert((await state()).slot === 'HCl', 'Tastatur am Umschalter');
  // genau ein gewählter Zustand je Gruppe; nur Gewähltes dunkel, alles andere hell
  const groups = await page.evaluate(() => [...document.querySelectorAll('#doseBar [role="group"]')].map((g) => ({ n: g.querySelectorAll('[aria-pressed="true"]').length, all: g.querySelectorAll('[aria-pressed]').length, label: g.getAttribute('aria-label') })));
  for (const g of groups) assert(g.n === 1, `genau eine Auswahl in „${g.label}“ (${g.n}/${g.all})`);
  const cols = await page.evaluate(() => [...document.querySelectorAll('#doseBar .opt')].map((b) => ({ p: b.getAttribute('aria-pressed'), bg: getComputedStyle(b).backgroundColor, t: b.innerText.replace(/\s+/g, ' ').trim().slice(0, 16) })));
  for (const c of cols) {
    if (c.p === 'true') assert(lum(c.bg) < 0.2, `ausgewählt ist dunkel: ${c.t} ${c.bg}`);
    else assert(lum(c.bg) > 0.85, `nicht ausgewählt ist hell: ${c.t} ${c.bg}`);
  }
  // Flaschen sind Klickflächen über der Zeichnung, ohne eigene Beschriftung darunter
  const hits = await page.evaluate(() => [...document.querySelectorAll('.bottlebtn')].map((b) => ({ txt: b.textContent.trim(), cls: b.className, label: b.getAttribute('aria-label') })));
  assert(hits.length === 2 && hits.every((h) => h.txt === '' && /hit/.test(h.cls) && /wählen/.test(h.label)), 'Flaschen-Klickflächen ohne Zusatzbeschriftung: ' + JSON.stringify(hits));
  // Pipette im Ständer antippen wählt den Pipettentyp (gleicher Zustand wie die Leiste)
  await click(page, '.piphit[data-pip="measure"]', true);
  assert((await state()).tool === 'measure' && await pressed('#doseBar [data-tool="measure"]') === 'true' && await pressed('.piphit[data-pip="measure"]') === 'true', 'Messpipette per Antippen im Labor gewählt');
  await click(page, '.piphit[data-pip="dropper"]', true);
  assert((await state()).tool === 'dropper' && await pressed('#doseBar [data-tool="dropper"]') === 'true', 'Tropfpipette per Antippen im Labor gewählt');
  // Auswahl von Pipette und Menge: Tropfpipette → Messpipette → Menge
  await tool(page, 'measure', true);
  assert((await state()).tool === 'measure' && await pressed('#doseBar [data-tool="measure"]') === 'true' && await pressed('#doseBar [data-tool="dropper"]') === 'false', 'Pipettenwahl');
  assert(await page.locator('#doseBar [data-kind]').count() === 3, 'Mengen der Messpipette: 0,5 / 1,0 / 5,0 mL');
  await kind(page, 'm5', true);
  assert((await state()).kind === 'm5' && await pressed('#doseBar [data-kind="m5"]') === 'true', 'Mengenwahl');
  // Touchziele ≥ 44×44 CSS-Pixel
  const small = await page.evaluate(() => [...document.querySelectorAll('#doseBar button, .bottlebtn, #viewToggle button, #expChips button, #speed button, #btnStir, #btnStep, .seriesbar button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.h < 43.5 || r.w < 43.5));
  assert(!small.length, 'Touchziele ≥ 44 px: ' + JSON.stringify(small));
  // Während der Zugabe: Auswahl gesperrt (disabled ≠ nicht ausgewählt), kein inkonsistenter Wechsel
  await kind(page, 'm1');
  await go(page, true);
  await waitFor(page, (A) => A.eng.busy());
  const during = await page.evaluate(() => ({ dis: [...document.querySelectorAll('#doseBar .opt')].every((b) => b.disabled), bottle: [...document.querySelectorAll('.bottlebtn')].every((b) => b.disabled), unsel: (() => { const u = document.querySelector('#doseBar [data-reagent="NaOH"]'); const cs = getComputedStyle(u); return { dis: u.disabled, p: u.getAttribute('aria-pressed'), op: cs.opacity, bs: cs.borderStyle }; })(), sel: (() => { const u = document.querySelector('#doseBar [data-reagent="HCl"]'); return { p: u.getAttribute('aria-pressed'), bg: getComputedStyle(u).backgroundColor }; })() }));
  assert(during.dis && during.bottle, 'alle Schalter während der Zugabe deaktiviert');
  assert(during.unsel.dis && during.unsel.p === 'false' && Number(during.unsel.op) < 1 && during.unsel.bs === 'dashed', 'deaktiviert und nicht ausgewählt: abgeblendet, gestrichelt: ' + JSON.stringify(during.unsel));
  assert(during.sel.p === 'true' && lum(during.sel.bg) < 0.2, 'gewählter Zustand bleibt dunkel');
  await click(page, '.bottlebtn[data-bottle="NaOH"]', true, true);
  assert((await state()).slot === 'HCl', 'Wechsel der Lösung während der Zugabe abgewiesen');
  await idle(page);
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'Flasche ↔ Schalter synchron; Reihenfolge 1–5; ausgewählt dunkel (Leuchtdichte < 0,2), sonst hell (> 0,85)';
});

// =========================================================== E04 Säure-/Laugenreihe, Gegenprobe
await scenario('E04', 'P05,P14', 'Jeder Wechsel HCl ↔ NaOH beginnt mit frischen Ansätzen, die vorige Reihe liegt unter „Ergebnisse“, Gegenprobe ausdrücklich gekennzeichnet (H₃O⁺ + OH⁻); nichts wird unbemerkt überschrieben', async () => {
  const { page, errors, done } = await open();
  await dose(page, 'HCl', 'd1'); await idle(page);
  await reagent(page, 'NaOH');
  assert(/Laugenreihe/.test(await toastText(page)), 'Hinweis auf die frische Laugenreihe');
  let bs = await beakers(page);
  assert(bs.every((b) => b.added === 0 && b.records.length === 1), 'Laugenreihe startet mit frischen Proben');
  await go(page); await idle(page);
  bs = await beakers(page);
  near(bs[0].records[1].pH, await refPH(page, { r: 'water' }, 'NaOH', 0.05), 1e-9, 'Wasser nach NaOH');
  near(bs[1].records[1].pH, await refPH(page, { r: 'phos' }, 'NaOH', 0.05), 1e-9, 'Phosphat nach NaOH');
  await reagent(page, 'HCl');
  bs = await beakers(page);
  assert(bs.every((b) => b.added === 0 && b.records.length === 1), 'zurück zu HCl: frische Ansätze (0.2.2)');
  near(bs[0].records[0].pH, 7, 1e-9, 'Wasser startet neutral'); near(bs[1].records[0].pH, 7.2, 0.01, 'Pufferlösung startet bei 7,20');
  assert(/vorige Säurereihe steht unter „Ergebnisse“/.test(await toastText(page)), 'Hinweis auf die abgelegte Reihe');
  const arch = await S(page, (A) => A.eng.state.archive.filter((a) => a.exp === 'e1').map((a) => a.reagent + ':' + a.runs.map((r) => r.records.at(-1).v).join('/')));
  assert(arch.includes('HCl:0.05/0.05'), 'vorige Säurereihe abgelegt, nicht gelöscht: ' + JSON.stringify(arch));
  await reagent(page, 'NaOH'); await reagent(page, 'HCl');
  const n0 = await S(page, (A) => A.eng.state.archive.length);
  assert(n0 === arch.length + 1, `unbenutzte Reihen werden beim Umschalten nicht abgelegt (${n0})`);
  await go(page); await idle(page);
  await click(page, '#btnCont');
  const c = await S(page, (A) => ({ kind: A.eng.current().kind, reagent: A.eng.current().reagent, start: A.eng.current().beakers[0].records[0].pH, slot: A.eng.state.slot }));
  assert(c.kind === 'cont' && c.reagent === 'NaOH' && c.slot === 'cont', 'Gegenprobe mit NaOH');
  near(c.start, await refPH(page, { r: 'water' }, 'HCl', 0.05), 1e-9, 'Gegenprobe startet im angesäuerten Zustand');
  assert(await page.locator('#doseBar [data-reagent="cont"]').getAttribute('aria-pressed') === 'true', 'Gegenprobe im Umschalter gekennzeichnet gewählt');
  assert(/Gegenprobe/.test(await page.locator('#seriesNote').innerText()), 'Gegenprobe im Bühnenhinweis gekennzeichnet');
  await go(page); await waitFor(page, (A) => A.eng.current().beakers[0].added > 0.049);
  await idle(page);
  const after = (await beakers(page))[0];
  assert(after.records.at(-1).pH > c.start + 0.5, 'NaOH hebt den pH-Wert des angesäuerten Wassers deutlich (Neutralisation)');
  // frische Reihe der Gegenseite bleibt erreichbar und wird nicht überschrieben
  await reagent(page, 'NaOH');
  const f = await S(page, (A) => ({ kind: A.eng.current().kind, added: A.eng.current().beakers[0].added, arch: A.eng.state.archive.filter((a) => a.reagent === 'NaOH').length }));
  assert(f.kind === 'fresh' && f.added === 0 && f.arch >= 1, 'Wechsel zu NaOH: frische Laugenreihe, die frühere liegt unter „Ergebnisse“');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Gegenprobe startet bei pH ${c.start.toFixed(2)}, endet bei ${after.records.at(-1).pH.toFixed(2)}`;
});

// =========================================================== E05 Versuch 1: Modellwerte, Teilchenmodell ohne Zeitlupe
await scenario('E05', 'P07,P14', 'Versuch 1: Tropfen → Ankunft → Mischen → Messpunkt; einziges Teilchenmodell mit Legende (ohne Zeitlupe), Bestand folgt dem Modell', async () => {
  const { page, errors, done } = await open();
  await go(page);
  await waitFor(page, (A) => A.eng.state.drops.length > 0);
  const flight = await S(page, (A) => ({ drops: A.eng.state.drops.length, added: A.eng.current().beakers.map((b) => b.added) }));
  assert(flight.added.every((v) => v === 0), 'keine Gleichgewichtsanzeige vor dem Eintreffen');
  await waitFor(page, (A) => A.eng.current().beakers[0].added > 0);
  const mix = await S(page, (A) => ({ m: A.eng.meter(A.eng.current().beakers[0]), b1: A.eng.current().beakers[1].added, plumes: (A.lab.fx[0] || { plumes: [] }).plumes.length }));
  assert(mix.m.mixing, 'Wasser: Mischstatus nach Ankunft'); assert(mix.b1 === 0, 'Glas B erhält den Tropfen erst danach (nacheinander)'); assert(mix.plumes > 0, 'Indikatorschliere nach Ankunft');
  await idle(page);
  const bs = await beakers(page);
  near(bs[0].records[1].pH, await refPH(page, { r: 'water' }, 'HCl', 0.05), 1e-9, 'Wasser nach 1 Tropfen');
  near(bs[1].records[1].pH, await refPH(page, { r: 'phos' }, 'HCl', 0.05), 1e-9, 'Phosphat nach 1 Tropfen');
  // Teilchenmodell: eine Ansicht, Legende, Hinweis auf Abstraktion; keine Zeitlupe
  assert(await page.locator('#partview').isVisible() && await page.locator('#pviews .pview').count() === 2, 'eine Teilchenmodell-Ansicht mit zwei Proben');
  const leg = await page.locator('#plegend').innerText();
  assert(/H₂PO₄⁻/.test(leg) && /HPO₄²⁻/.test(leg) && /H₃O⁺/.test(leg) && /OH⁻/.test(leg), 'Legende nennt alle Teilchen: ' + leg.replace(/\s+/g, ' '));
  const note = await page.locator('#extraNote').innerText();
  assert(/nicht maßstäblich/.test(note) && /Schematisch/.test(note), 'Abstraktion kenntlich: ' + note);
  assert(await page.locator('#chkEvents, #eventStage, .zeitlupe, [data-event]').count() === 0, 'keine Zeitlupen-Bedienelemente');
  assert(!(await S(page, (A) => Object.keys(window.PF.particles).concat(Object.getOwnPropertyNames(window.PF.particles.ParticleView.prototype))).then((k) => k.some((n) => /event|slow/i.test(n)))), 'kein Zeitlupen-Code im Teilchenmodell');
  assert(await page.locator('.pview .pc canvas').count() === 2, 'je Probe genau ein Canvas (keine zweite Zone)');
  // Bestand folgt dem Modell: HPO₄²⁻ nimmt bei 5 mL NaOH zu, H₂PO₄⁻ ab
  await reagent(page, 'NaOH'); await tool(page, 'measure'); await kind(page, 'm5'); await go(page); await idle(page);
  await adv(page, 800);
  const cnt = await S(page, (A) => A.U.views()[1].parts.filter((p) => !p.leaving).reduce((o, p) => { o[p.sp] = (o[p.sp] || 0) + 1; return o; }, {}));
  const tc = await S(page, (A, C) => window.PF.particles.targetCounts(A.eng.current().beakers[1].shown.comp).counts);
  assert(cnt.HPO4 === tc.HPO4 && cnt.H2PO4 === tc.H2PO4, `Symbolzahlen = Modell: ${JSON.stringify(cnt)} / ${JSON.stringify(tc)}`);
  assert(tc.HPO4 > tc.H2PO4, 'nach NaOH überwiegt HPO₄²⁻ im Modell');
  await dose(page, 'HCl', 'm5'); await idle(page);
  await shot(page, '02-versuch1-nach-zugabe');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Wasser ${bs[0].records[1].pH.toFixed(3)}, Pufferlösung ${bs[1].records[1].pH.toFixed(3)} nach 0,05 mL HCl; Symbole ${JSON.stringify(cnt)}`;
});

// =========================================================== E06 Versuch 2
await scenario('E06', 'P02,P07,P14', 'Versuch 2: Essigsäure, Natriumacetat und Gemisch ohne Vorabantwort – Säure- und Laugenreihe, Modellwerte, Teilchenmodell mit HAc/Ac⁻', async () => {
  const { page, errors, done } = await open();
  await exp(page, 'e2');
  assert(await page.locator('#predictForm').count() === 0, 'keine Vermutung');
  let bs = await beakers(page);
  assert(bs.map((b) => b.key).join() === 'hac,naac,mix', 'drei Proben');
  const start = bs.map((b) => b.records[0].pH);
  near(start[0], 2.88, 0.01, 'Essigsäure'); near(start[1], 8.88, 0.02, 'Acetat'); near(start[2], 4.75, 0.002, 'Gemisch');
  const leg = await page.locator('#plegend').innerText();
  assert(/HAc/.test(leg) && /Ac⁻/.test(leg) && /Essigsäure/.test(leg) && /Ethanoat/.test(leg) && /H₂O/.test(leg), 'Legende HAc/Ac⁻ mit Namen und H₂O: ' + leg.replace(/\s+/g, ' '));
  await go(page); await idle(page);
  bs = await beakers(page);
  const ref = (r, ha, a) => S(page, (A, C, x) => C.pH(C.add(C.acetate(30, x.ha, x.a), x.r, 0.05)), { r, ha, a });
  near(bs[0].records[1].pH, await ref('HCl', 0.1, 0), 1e-9, 'Essigsäure + HCl'); near(bs[1].records[1].pH, await ref('HCl', 0, 0.1), 1e-9, 'Acetat + HCl'); near(bs[2].records[1].pH, await ref('HCl', 0.05, 0.05), 1e-9, 'Gemisch + HCl');
  assert(bs[1].records[0].pH - bs[1].records[1].pH > 0.5, 'Natriumacetat-Lösung nimmt Säure auf: deutliche, aber begrenzte Änderung (kein „reagiert nicht“)');
  assert(bs[0].records[0].pH - bs[0].records[1].pH < 0.1, 'Essigsäure ändert sich bei einem Tropfen HCl wenig (kein Protonenempfänger in nennenswerter Menge)');
  assert(Math.abs(bs[2].records[1].pH - bs[2].records[0].pH) < 0.01, 'Gemisch kaum');
  await reagent(page, 'NaOH'); await tool(page, 'measure'); await kind(page, 'm1'); await go(page); await idle(page);
  bs = await beakers(page);
  near(bs[0].records[1].pH, await S(page, (A, C) => C.pH(C.add(C.acetate(30, 0.1, 0), 'NaOH', 1))), 1e-9, 'Essigsäure + NaOH (Acetat entsteht)');
  assert(bs[0].records[1].pH - bs[0].records[0].pH > 0.3, 'Essigsäure reagiert mit NaOH: Änderung messbar (0,1 mmol OH⁻ erzeugen Acetat)');
  await shot(page, '04-versuch2-nach-zugabe');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Start ${start.map((v) => v.toFixed(2)).join(' / ')}`;
});

// =========================================================== E07 Umschalter Teilchenmodell | pH-Kurve
await scenario('E07', 'P06', 'pH-Kurve beim Start verborgen; Umschalter ersetzt die Zusatzansicht am selben Platz; dosieren → wechseln → dosieren → zurück: alle Messpunkte vorhanden', async () => {
  const { page, errors, done } = await open();
  assert(await page.locator('#viewToggle [data-view="main"]').getAttribute('aria-pressed') === 'true', 'Teilchenmodell beim Start gewählt');
  assert(await page.locator('#viewToggle [data-view="curve"]').getAttribute('aria-pressed') === 'false', 'pH-Kurve beim Start nicht gewählt');
  assert(!(await page.locator('#chartbox').isVisible()) && await page.locator('#partview').isVisible(), 'Kurve verborgen, Teilchenmodell sichtbar');
  assert(await page.locator('#viewToggle').isVisible(), 'Umschalter gut auffindbar (sichtbar)');
  const labBox0 = await page.locator('#lab').boundingBox();
  await dose(page, 'HCl', 'd1'); await idle(page);
  await view(page, 'curve');
  assert(await page.locator('#chartbox').isVisible() && !(await page.locator('#partview').isVisible()), 'Kurve ersetzt das Teilchenmodell');
  const a = await page.locator('#partview').boundingBox().catch(() => null);
  const bodyBox = await page.locator('.extra-body').boundingBox(), cBox = await page.locator('#chartbox').boundingBox();
  assert(Math.abs(cBox.x - bodyBox.x) < 1 && Math.abs(cBox.y - bodyBox.y) < 1 && Math.abs(cBox.width - bodyBox.width) < 1 && Math.abs(cBox.height - bodyBox.height) < 1, 'Kurve füllt dieselbe Fläche');
  const labBox1 = await page.locator('#lab').boundingBox();
  assert(Math.abs(labBox0.height - labBox1.height) < 1 && Math.abs(labBox0.width - labBox1.width) < 1, 'Laboransicht bleibt unverändert sichtbar');
  assert(await page.locator('#lab').isVisible(), 'Labor immer sichtbar');
  // im Kurvenmodus weiter dosieren
  await dose(page, null, 'd5'); await idle(page);
  const n1 = (await beakers(page))[0].records.length; assert(n1 === 7, `1 + 1 + 5 Messpunkte (${n1})`);
  await view(page, 'main'); assert(await page.locator('#partview').isVisible(), 'zurück zum Teilchenmodell');
  await tool(page, 'measure'); await kind(page, 'm1'); await go(page); await idle(page);
  await view(page, 'curve');
  const chk = await S(page, (A) => { const rec = A.eng.current().beakers.map((b) => b.records.length); const m = A.chart.map; return { rec, xmax: m.xmax, added: A.eng.current().beakers.map((b) => b.added), last: A.eng.current().beakers[0].records.at(-1).v }; });
  assert(chk.rec[0] === 8 && chk.rec[1] === 8, `alle Messpunkte vorhanden (${chk.rec})`);
  near(chk.last, 1.3, 1e-9, 'Summe der Zugaben in der Kurve'); assert(chk.xmax >= 1.3, 'x-Achse reicht über den gesamten Verlauf');
  // Messpunkte im gezeichneten Bild: Pixel um die Punkte sind farbig (Kurve zeichnet wirklich alle Punkte)
  const px = await page.evaluate(() => { const A = window.PF.app, c = document.getElementById('chart'), ctx = c.getContext('2d'), m = A.chart.map, d = A.chart.dpr; let hit = 0; for (const p of A.eng.current().beakers[0].records) { const x = Math.round(m.X(p.v) * d), y = Math.round(m.Y(p.pH) * d); const q = ctx.getImageData(x - 2, y - 2, 5, 5).data; let colored = 0; for (let i = 0; i < q.length; i += 4) if (q[i + 3] > 200 && (q[i] < 120 || q[i + 2] < 120)) colored++; if (colored > 3) hit++; } return { hit, n: A.eng.current().beakers[0].records.length }; });
  assert(px.hit >= px.n - 1, `gezeichnete Punkte entsprechen den Messpunkten (${px.hit}/${px.n})`);
  await shot(page, '03-versuch1-ph-kurve');
  // wiederholter Wechsel ohne Verlust
  for (let i = 0; i < 3; i++) { await view(page, 'main'); await view(page, 'curve'); }
  assert((await beakers(page))[0].records.length === 8 && (await beakers(page))[0].added > 1.29, 'Messreihe nach mehrfachem Umschalten unverändert');
  // Zustand je Versuch: Versuch 2 beginnt wieder mit dem Teilchenmodell, Versuch 1 bleibt auf Kurve
  await exp(page, 'e2'); assert(await page.locator('#viewToggle [data-view="main"]').getAttribute('aria-pressed') === 'true', 'Versuch 2: Teilchenmodell beim Start');
  await exp(page, 'e1'); assert(await page.locator('#viewToggle [data-view="curve"]').getAttribute('aria-pressed') === 'true', 'Versuch 1: Kurvenwahl bleibt');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `${chk.rec[0]} Messpunkte nach Wechseln, ${px.hit}/${px.n} im Bild`;
});

// =========================================================== E08 Layout: größeres Labor, Beschriftungen
await scenario('E08', 'P04', 'Labor dominiert: Becherglas ≥ 25 % höher als in 0.1.0 (1440×900), pH-Messelektrode beschriftet, pH-Anzeige dem Glas zugeordnet, nichts verdeckt', async () => {
  const { page, errors, done } = await open();
  const BEFORE = 126.27; // 0.1.0, Startansicht 1440×900: Becherglashöhe in Bildschirmpixeln (gemessen mit dem 0.1.0-Build)
  const m = await S(page, (A) => { const g = A.eng.geometry(); const sc = A.lab.view.scale; const r = document.getElementById('lab').getBoundingClientRect(); return { px: (g[0].bottom - g[0].top) * sc, half: g[0].half * sc, canvas: [r.width, r.height], scale: sc, g: g.map((q) => ({ x: q.x * sc + A.lab.view.ox, half: q.half * sc })) }; });
  assert(m.px >= BEFORE * 1.25, `Becherglashöhe ${m.px.toFixed(1)} px ≥ ${(BEFORE * 1.25).toFixed(1)} px`);
  const el = await page.evaluate(() => [...document.querySelectorAll('.eltag')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(e).visibility !== 'hidden' && r.width > 0 }; }));
  assert(el.length === 2 && el.every((e) => e.t === 'pH-Messelektrode' && e.vis), 'jede Elektrode sichtbar mit „pH-Messelektrode“ beschriftet: ' + JSON.stringify(el.map((e) => e.t)));
  const wrap = await page.locator('#canvasWrap').boundingBox();
  const tags = await page.evaluate(() => [...document.querySelectorAll('.tag')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.innerText.replace(/\s+/g, ' ').trim(), x: r.x, y: r.y, w: r.width, h: r.height, ph: e.querySelector('.ph').textContent }; }));
  const boxes = [...el.map((e) => ({ n: 'Elektrode ' + e.t, ...e })), ...tags.map((t) => ({ n: 'Anzeige ' + t.t, ...t })), ...await page.evaluate(() => [...document.querySelectorAll('.bottlebtn, .piphit, .addtag')].map((e) => { const r = e.getBoundingClientRect(); return { n: (e.dataset.bottle ? 'Flasche ' + e.dataset.bottle : e.dataset.pip ? 'Pipette ' + e.dataset.pip : 'Menge ' + e.textContent.trim()), x: r.x, y: r.y, w: r.width, h: r.height }; }))];
  for (const b of boxes) assert(b.x >= wrap.x - 1 && b.y >= wrap.y - 1 && b.x + b.w <= wrap.x + wrap.width + 1 && b.y + b.h <= wrap.y + wrap.height + 1, `${b.n} liegt vollständig im Laborbild`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; const ov = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; assert(!ov, `${a.n} überdeckt ${b.n} nicht`); }
  // pH-Anzeige gehört eindeutig zum Glas: Mitte der Anzeige unter dem Glas
  tags.forEach((t, i) => { const cx = t.x + t.w / 2 - wrap.x; assert(Math.abs(cx - m.g[i].x) < m.g[i].half + 12, `Anzeige ${i} liegt unter Glas ${i}`); assert(/^pH \d+,\d\d/.test(t.ph), 'pH-Anzeige: ' + t.ph); });
  // Elektroden gehören zu den Gläsern (rechts oben am Glas)
  el.forEach((e, i) => { const cx = e.x - wrap.x; assert(Math.abs(cx - m.g[i].x) < m.g[i].half + 40, `Elektrodenbeschriftung ${i} nahe Glas ${i}`); });
  const lab = await page.locator('#lab').boundingBox(); const ext = await page.locator('#extra').boundingBox();
  assert(lab.height >= 300 && lab.width * lab.height > ext.width * ext.height * 0.9, `Laborbild dominiert (${Math.round(lab.width)}×${Math.round(lab.height)} gegenüber Zusatzansicht ${Math.round(ext.width)}×${Math.round(ext.height)})`);
  await shot(page, '01-start-versuch1');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Becherglas ${m.px.toFixed(1)} px (0.1.0: ${BEFORE} px, +${((m.px / BEFORE - 1) * 100).toFixed(0)} %), Laborbild ${Math.round(lab.width)}×${Math.round(lab.height)}`;
});

// =========================================================== E09 Protokoll, Leitfragen, stabile Antwortreihenfolge
await scenario('E09', 'P08,P09', 'Protokoll Versuch 1/2: Leitfragen statt Freitext-Allgemeinplatz, Antworten stabil gemischt (Rerender, Neuladen, mehrere Sitzungen), Bewertung nach Antwort-ID', async () => {
  const { page, errors, context, done } = await open();
  await dose(page, 'HCl', 'd1'); await idle(page);
  await reagent(page, 'NaOH'); await go(page); await idle(page);
  const q = await page.locator('#protoForm legend').allInnerTexts();
  assert(q.some((t) => /Erkläre in 1–3 Sätzen, warum sich der pH-Wert der Pufferlösung nach Zugabe von HCl weniger stark ändert als bei Wasser/.test(t)), 'konkrete Leitfrage Versuch 1');
  const panelText = await page.locator('#panelBody').innerText();
  assert(!/In eigenen Worten/.test(panelText), 'kein allgemeiner Freitext-Auftrag mehr');
  assert(/Erwartet: 1–3 Sätze/.test(panelText) && /nicht bewertet/.test(panelText), 'Erwartung und Nichtbewertung sichtbar');
  assert(await page.locator('textarea[data-free="f1"]').getAttribute('placeholder') !== null, 'Platzhalter im Textfeld');
  // Reihenfolge je Frage lesen
  const orders = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#protoForm fieldset[data-qid]')].map((f) => [f.dataset.qid, [...f.querySelectorAll('input')].map((i) => i.value)])));
  const o1 = await orders();
  assert(Object.keys(o1).join() === 'o1,d1,x1,x2', 'Fragen Versuch 1: ' + Object.keys(o1));
  for (const [k, v] of Object.entries(o1)) assert(v.slice().sort().join() === (k === 'o1' ? 'a,b,c,d,e' : 'a,b,c,d'), `vollständige Optionen ${k}`);
  // Rerender (Reiterwechsel, Bewerten) ändert die Reihenfolge nicht
  await tab(page, 'results'); await tab(page, 'task');
  assert(JSON.stringify(await orders()) === JSON.stringify(o1), 'Reihenfolge nach Reiterwechsel gleich');
  await page.locator('#protoForm [name="q-d1"][value="b"]').check();
  await page.locator('#protoForm [name="q-x1"][value="a"]').check();
  await click(page, '#protoForm button[type=submit]');
  assert(JSON.stringify(await orders()) === JSON.stringify(o1), 'Reihenfolge nach „Antworten prüfen“ gleich');
  // Bewertung nach Antwort-ID (richtig = b, unabhängig von der Position)
  const pos = (await orders()).d1.indexOf('b');
  assert(await page.locator('fieldset[data-qid="d1"]').getAttribute('class') === 'fb-right', `d1 richtig bewertet (Position von „b“: ${pos + 1})`);
  await page.locator('#protoForm [name="q-d1"][value="a"]').check(); await click(page, '#protoForm button[type=submit]');
  assert(await page.locator('fieldset[data-qid="d1"]').getAttribute('class') === 'fb-wrong', 'falsche Antwort a erkannt');
  assert(/starke Säure/.test(await page.locator('fieldset[data-qid="d1"] .lk-fb').innerText()), 'Rückmeldung zur Fehlvorstellung');
  await page.locator('#protoForm [name="q-d1"][value="b"]').check(); await click(page, '#protoForm button[type=submit]');
  // Mehrfachauswahl: teilweise richtig → Rückmeldung; mit Evidenz (Säure- und Laugenreihe) vollständig richtig
  for (const v of ['a', 'b']) await page.locator(`#protoForm [name="q-o1"][value="${v}"]`).check();
  await click(page, '#protoForm button[type=submit]');
  assert(await page.locator('fieldset[data-qid="o1"]').getAttribute('class') === 'fb-wrong' || /Es fehlt noch/.test(await page.locator('fieldset[data-qid="o1"] .lk-fb').innerText()), 'Mehrfachauswahl unvollständig: Hinweis');
  await page.locator('#protoForm [name="q-o1"][value="c"]').check();
  await page.locator('#protoForm [name="q-o1"][value="d"]').check(); await click(page, '#protoForm button[type=submit]');
  assert(await page.locator('fieldset[data-qid="o1"]').getAttribute('class') === 'fb-wrong', 'falsche Zusatzantwort d erkannt');
  await page.locator('#protoForm [name="q-o1"][value="d"]').uncheck(); await click(page, '#protoForm button[type=submit]');
  assert(await page.locator('fieldset[data-qid="o1"]').getAttribute('class') === 'fb-right', 'Mehrfachauswahl a, b, c richtig – Reihenfolge ohne Einfluss');
  await page.locator('textarea[data-free="f1"]').fill('Der Puffer enthält HPO₄²⁻, das H₃O⁺ aufnimmt.');
  // Neuladen: gleiche Reihenfolge, Antworten bleiben
  await adv(page, 800);
  await page.reload(); await page.waitForFunction(() => window.PF && window.PF.app); await adv(page, 300);
  assert(JSON.stringify(await orders()) === JSON.stringify(o1), 'Reihenfolge nach Neuladen gleich (gespeichert)');
  assert(await page.locator('textarea[data-free="f1"]').inputValue() === 'Der Puffer enthält HPO₄²⁻, das H₃O⁺ aufnimmt.', 'Freitext erhalten');
  assert(await page.locator('#protoForm [name="q-d1"][value="b"]').isChecked(), 'Auswahl erhalten');
  // Journal: Leitfrage und unbewertete Antwort
  await tab(page, 'journal');
  const j = await page.locator('#panelBody').innerText();
  assert(/Leitfrage: Erkläre in 1–3 Sätzen/.test(j) && /Meine Antwort \(unbewertet\): Der Puffer enthält/.test(j), 'Leitfrage und Antwort im Journal');
  // Versuch 2: Leitfrage zum Zusammenwirken beider Partner
  await exp(page, 'e2'); await tab(page, 'task');
  const q2 = await page.locator('#protoForm legend').allInnerTexts();
  assert(q2.some((t) => /wie CH₃COOH und CH₃COO⁻ im Gemisch zusammenwirken, wenn HCl bzw. NaOH zugegeben wird/.test(t)), 'Leitfrage Versuch 2');
  const e2o = await orders(); assert(Object.keys(e2o).join() === 'o2,d2,x3,x4', 'Fragen Versuch 2');
  await context.close();
  // mehrere Sitzungen: richtige Antwort nicht systematisch an erster Stelle
  const firsts = [], seqs = new Set();
  for (let i = 0; i < 12; i++) {
    const s = await open();
    const o = await s.page.evaluate(() => { const f = (id) => [...document.querySelectorAll(`#protoForm fieldset[data-qid="${id}"] input`)].map((x) => x.value); return { d1: f('d1'), x1: f('x1'), x2: f('x2') }; });
    firsts.push([o.d1[0] === 'b', o.x1[0] === 'a', o.x2[0] === 'a']); seqs.add(o.d1.join('') + o.x1.join('') + o.x2.join(''));
    await s.done();
  }
  const rate = firsts.flat().filter(Boolean).length / (firsts.length * 3);
  assert(rate < 0.5 && seqs.size >= 6, `richtige Antworten stehen nicht systematisch vorn (Anteil an erster Stelle ${(rate * 100).toFixed(0)} %, ${seqs.size} verschiedene Reihenfolgen in 12 Sitzungen)`);
  allErrors.push(...errors);
  return `Reihenfolge stabil (Rerender/Neuladen); 12 Sitzungen: ${(rate * 100).toFixed(0)} % richtig an erster Stelle (Erwartung ≈ 29 %)`;
});

// =========================================================== E10 Herleitung und Rechnen
const THEORY = { 't1:a': 'A⁻', 't1:b': 'H₃O⁺', 't2:a': 'c(H₃O⁺) · c(A⁻) / c(HA)', 't3:a': 'Kₛ · c(HA) / c(A⁻)', 't4:a': 'pKₛ − lg[c(HA)/c(A⁻)]', 't4:b': 'lg(1/x) = −lg x (Kehrwert)', 't5:a': 'kleiner', 't5:b': 'sinkt', 't6:a': 'c = n/V, und das gemeinsame Volumen kürzt sich heraus.', 't6:b': '1', 't7:a': '4,75', 't7:b': '5,75', 't7:c': '3,75', 't7:d': 'pH ≈ pKₛ ± 1' };
async function doTheory(page) {
  await click(page, '#steps [data-page="theory"]');
  for (let i = 1; i <= 7; i++) {
    const keys = Object.keys(THEORY).filter((k) => k.startsWith(`t${i}:`));
    for (const k of keys) {
      const sel = `[data-f="${k}"]`;
      const n = await page.locator(sel).count();
      if (n > 1) await page.locator(`${sel}[value="${THEORY[k]}"]`).check();
      else await setVal(page, sel, THEORY[k]);
    }
    await click(page, `[data-th="check"][data-id="t${i}"]`);
  }
}
async function answerD1(page) { await page.locator('#protoForm [name="q-d1"][value="b"]').check(); await click(page, '#protoForm button[type=submit]'); }
await scenario('E10', 'P14,P08', 'Herleitung (nach der Deutung freigeschaltet, ohne alle Rechenaufgaben vor Versuch 3) und sechs Rechenaufgaben mit getrennter Fehlerdiagnose; Antwortlisten gemischt', async () => {
  const { page, errors, done } = await open();
  await click(page, '#steps [data-page="theory"]');
  assert(await page.locator('.lockcard').count() === 1, 'vor der Deutung gesperrt');
  assert(!/Wunderwasser|Vermutung/.test(await page.locator('.lockcard').innerText()), 'Sperrhinweis ohne alte Begriffe');
  await click(page, '#steps [data-page="lab"]');
  await answerD1(page);
  assert(!(await page.locator('#steps [data-page="theory"]').getAttribute('class') || '').includes('locked'), 'Herleitung nach der Deutung freigeschaltet');
  await click(page, '#steps [data-page="theory"]');
  assert(/Zusammensetzung der Pufferlösung/.test(await page.locator('.reveal').innerText()), 'Zusammensetzung (Phosphatpuffer) in der Erklärung');
  await shot(page, '12-herleitung');
  await setVal(page, '[data-f="t1:a"]', 'HA'); await setVal(page, '[data-f="t1:b"]', 'OH⁻');
  await click(page, '[data-th="check"][data-id="t1"]');
  assert(await page.locator('[data-step="t1"] .ffb.n').count() === 2, 'zwei Felder als falsch markiert');
  await click(page, '[data-th="tip"][data-id="t1"]');
  assert(/Tipp 1\/3/.test(await page.locator('[data-step="t1"] .tipbox').innerText()), 'Tipp 1/3');
  const selOrders = await page.evaluate(() => [...document.querySelectorAll('[data-step="t1"] select[data-f]')].map((s) => [...s.options].map((o) => o.textContent).join('|')));
  assert(selOrders.every((o) => o.startsWith('– wählen –')), 'Auswahlfelder mit Platzhalter');
  await doTheory(page);
  assert(await S(page, (A) => A.U.theoryDone()), 'alle sieben Schritte gelöst');
  assert(await S(page, (A) => A.U.mixOpen()), 'Versuch 3 nach der Herleitung freigeschaltet, ohne Rechenaufgaben');
  assert(!(await S(page, (A) => A.U.appsOpen())), 'Anwendungen weiter von den Rechenaufgaben abhängig');
  await click(page, '#steps [data-page="lab"]');
  const foot = await page.locator('.pfoot').allInnerTexts();
  assert(foot.length === 2 && /^kein Puffer/.test(foot[0]) && /^formal: n\(H₂PO₄⁻\)/.test(foot[1]) && /H-H \(pKₛ₂ = 7,20\)/.test(foot[1]), 'nach der Herleitung: Wasser „kein Puffer“, Pufferlösung mit formalen Stoffmengen und H-H-Vergleich: ' + JSON.stringify(foot));
  await view(page, 'curve');
  assert(!(await page.locator('#chkPka').isDisabled()), 'pKₛ ± 1 im Diagramm freigeschaltet');
  await page.locator('#chkPka').check(); await adv(page, 200);
  assert(await S(page, (A) => A.ui.pka), 'pKₛ ± 1 gewählt'); await view(page, 'main');
  await click(page, '#steps [data-page="tasks"]');
  await click(page, '[data-tk="sol"][data-id="k1"]');
  assert(await page.locator('[data-tk="solYes"][data-id="k1"]').count() === 1, 'Rückfrage vor dem Rechenweg');
  await click(page, '[data-tk="solNo"][data-id="k1"]');
  await setVal(page, '[data-f="k3:q"]', '0,5'); await click(page, '[data-tk="check"][data-id="k3"]');
  assert(/Falscher Quotient/.test(await page.locator('[data-task="k3"]').innerText()), 'falscher Quotient erkannt');
  await setVal(page, '[data-f="k3:q"]', '0,30'); await click(page, '[data-tk="check"][data-id="k3"]');
  assert(/10\^0,30/.test(await page.locator('[data-task="k3"]').innerText()), 'Logarithmus nicht aufgelöst erkannt');
  await setVal(page, '[data-f="k4:n(CH₃COO⁻) nachher"]', '4'); await setVal(page, '[data-u="k4:n(CH₃COO⁻) nachher"]', 'mol');
  await setVal(page, '[data-f="k4:n(CH₃COOH) nachher"]', '5'); await setVal(page, '[data-u="k4:n(CH₃COOH) nachher"]', 'mmol');
  await setVal(page, '[data-f="k4:pH"]', '4,93');
  await click(page, '[data-tk="check"][data-id="k4"]');
  const t4 = await page.locator('[data-task="k4"]').innerText();
  assert(/tausendmal/.test(t4) && /Säurezugabe fehlt/.test(t4) && /Falscher Quotient/.test(t4), 'Einheit, Stöchiometrie und Quotient getrennt erklärt');
  const ans = [['k1:lo', '3,75'], ['k1:hi', '5,75'], ['k2:lo', '6,2'], ['k2:hi', '8,20'], ['k3:q', '2,0'], ['k4:n(CH₃COO⁻) nachher', '4,00'], ['k4:n(CH₃COOH) nachher', '0,006'], ['k4:pH', '4,57'], ['k5:q', '1,58'], ['k6:q', '20']];
  for (const [k, v] of ans) await setVal(page, `[data-f="${k}"]`, v);
  await setVal(page, '[data-u="k4:n(CH₃COO⁻) nachher"]', 'mmol'); await setVal(page, '[data-u="k4:n(CH₃COOH) nachher"]', 'mol');
  const right = await S(page, () => Object.fromEntries(window.PF.learn.TASKS.flatMap((t) => t.fields.filter((f) => f.type === 'radio').map((f) => [t.id + ':' + f.id, f.ok]))));
  const radioOrder = await page.evaluate(() => [...document.querySelectorAll('[data-task="k5"] [data-f="k5:pair"]')].map((i) => i.value));
  assert(radioOrder.slice().sort().join() === 'Acetat,Ammonium,Phosphat', 'Paare der Aufgabe 5 vollständig: ' + radioOrder);
  for (const [k, v] of Object.entries(right)) await page.locator(`[data-f="${k}"][value="${v}"]`).check();
  for (const k of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']) await click(page, `[data-tk="check"][data-id="${k}"]`);
  const ok = await S(page, (A) => Object.fromEntries(['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((k) => [k, Object.values(A.ui.tasks[k].res).every((r) => r.ok)])));
  assert(Object.values(ok).every(Boolean), 'alle sechs Aufgaben richtig: ' + JSON.stringify(ok));
  await shot(page, '13-aufgaben');
  assert(await S(page, (A) => A.U.appsOpen()), 'Anwendungen freigeschaltet');
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'Schritte 1–7 und Aufgaben 1–6 geprüft; Versuch 3 schon nach der Herleitung offen';
});

// =========================================================== Hilfen für Versuch 3
async function openMix(page) { await exp(page, 'e3'); }
async function planMix(page, targetPH, sysId, entries) {
  await click(page, `[data-mixtarget="${targetPH}"]`);
  await page.locator(`input[data-mixsystem="${sysId}"]`).check(); await adv(page, 100);
  if (entries) {
    for (const [k, v] of Object.entries(entries)) await page.locator(`[data-mixf="${k}"]`).fill(v);
    await click(page, '[data-mixaction="check"]');
  }
}
async function doseStock(page, stock, mL) {
  await reagent(page, stock);
  let rest = mL;
  while (rest > 1e-9) { const k = rest >= 10 ? 'm10' : rest >= 5 ? 'm5' : rest >= 1 ? 'm1' : 'm05'; await kind(page, k); await go(page); await idle(page); rest -= { m10: 10, m5: 5, m1: 1, m05: 0.5 }[k]; }
}
const mixState = (page) => S(page, (A, C) => { const s = A.eng.current(), b = s.beakers[0]; const m = A.eng.meter(b); return { V: b.comp.V, vols: b.vols, measured: m.measured, mixing: m.mixing, pH: m.pH, hist: A.eng.state.history.length, sys: A.eng.state.system, target: A.eng.state.target }; });

// =========================================================== E11 Versuch 3: Sperre, Systemwahl, Rechnung, Reihenfolge
await scenario('E11', 'P10,P05', 'Versuch 3 beginnt mit Systemwahl und Rechnung: ohne Voraussetzung zugänglich (Einzelstunde), ungeeignete Systeme/Ziel-pH zurückgewiesen, Stammlösungen statt HCl/NaOH, Dosieren erst nach der Rechnung, Formel immer sichtbar', async () => {
  const { page, errors, done } = await open();
  await exp(page, 'e3');
  assert(await page.locator('#panelBody .lockcard').count() === 0 && await page.locator('[data-mixtarget]').count() === 3, 'Versuch 3 sofort zugänglich, ohne Herleitung (0.2.1)');
  assert(await page.locator('#expChips [data-exp="e3"] .lockmark').count() === 0, 'keine Sperre am Versuchsknopf');
  // Formel gut sichtbar – in beiden Zusatzansichten, bei Eingaben, nach Reiterwechsel
  const formula = async (label) => {
    const vis = await page.evaluate(() => { const f = document.querySelector('#formulaBar'); const r = f.getBoundingClientRect(); const vp = { w: innerWidth, h: innerHeight }; const fs = parseFloat(getComputedStyle(f.querySelector('.eqn')).fontSize); return { text: f.innerText.replace(/\s+/g, ' '), shown: !f.hidden && r.width > 200 && r.height > 20 && r.top >= 0 && r.bottom <= vp.h, fs }; });
    assert(vis.shown && /pH = pKₛ \+ lg \( n\(A⁻\) \/ n\(HA\) \)/.test(vis.text) && /n\(A⁻\) \/ n\(HA\) = 10pH − pKₛ/.test(vis.text) && vis.fs >= 15, `Formel sichtbar (${label}): ${vis.text}`);
  };
  await formula('Start');
  assert(await page.locator('#doseBar [data-reagent="HCl"], #doseBar [data-reagent="NaOH"], .bottlebtn[data-bottle="HCl"], .bottlebtn[data-bottle="NaOH"]').count() === 0, 'keine HCl/NaOH-Vorauswahl im Versuch 3');
  assert(await page.locator('#doseBar [data-tool]').count() === 0 && /Messpipette/.test(await page.locator('#doseBar').innerText()), 'Dosierung mit der Messpipette, kein Tropfpipetten-Umschalter');
  // Ziel-pH wählen
  assert(await page.locator('[data-mixtarget]').count() === 3, 'drei Standardaufgaben');
  await go(page);
  assert(/Ziel-pH und Puffersystem wählen/.test(await toastText(page)), 'ohne Ziel/System kein Dosieren: ' + await toastText(page));
  await click(page, '[data-mixtarget="6.9"]');
  await formula('Ziel gewählt');
  // ungeeignetes System (Acetat für 6,90) zurückweisen
  await page.locator('input[data-mixsystem="ac"]').check(); await adv(page, 100);
  let msg = await page.locator('[data-mixstep="2"] .ffb').innerText();
  assert(/✗/.test(msg) && /Faustregel pKₛ ± 1/.test(msg) && /Acetat/.test(msg), 'Acetat für pH 6,90 abgewiesen: ' + msg);
  assert((await mixState(page)).sys === null && await page.locator('[data-mixstep="3"]').count() === 0, 'kein Rechenteil bei ungeeignetem System');
  assert(await page.locator('.bottlebtn').count() === 0, 'vor der Systemwahl keine wählbaren Flaschen (Bild zeigt neutrale Säure/Base)');
  await page.locator('input[data-mixsystem="am"]').check(); await adv(page, 100);
  assert(/✗/.test(await page.locator('[data-mixstep="2"] .ffb').innerText()), 'Ammonium für pH 6,90 abgewiesen');
  // geeignetes System
  await page.locator('input[data-mixsystem="ph"]').check(); await adv(page, 100);
  msg = await page.locator('[data-mixstep="2"] .ffb').innerText();
  assert(/✓ Phosphat passt/.test(msg) && /Näherung/.test(msg), 'Phosphat akzeptiert: ' + msg);
  assert((await mixState(page)).sys === 'ph', 'Engine kennt das gewählte System');
  const bottles = await page.evaluate(() => [...document.querySelectorAll('.bottlebtn')].map((b) => b.getAttribute('aria-label')));
  assert(bottles.join(' ').includes('NaH₂PO₄') && bottles.join(' ').includes('Na₂HPO₄'), 'Stammlösungen als Flaschen: ' + bottles.join(' | '));
  await formula('System gewählt');
  // Diagramm zeigt vor der Rechnung nichts vorweg (kein Soll-Balken, keine Zielgröße)
  const mv = await page.locator('#mixview').innerText();
  assert(/Noch nichts zugegeben/.test(mv) && !/6,90|Ziel/.test(mv), 'Diagramm ohne vorweggenommene Lösung: ' + mv.replace(/\s+/g, ' ').slice(0, 120));
  // Dosieren vor der Rechnung nicht möglich
  await go(page);
  assert(/selbst rechnen/.test(await toastText(page)) && (await mixState(page)).V === 0, 'Zugeben erst nach der Rechnung: ' + await toastText(page));
  assert(await page.locator('#btnGo').getAttribute('aria-disabled') === 'true' && /Erst selbst rechnen/.test(await page.locator('#deckHint').innerText()), 'Schaltfläche abgeblendet, Hinweis sichtbar');
  // Rechnung mit Fehlern: Quotient vertauscht, Volumina vertauscht
  await page.locator('[data-mixf="r"]').fill('2'); await page.locator('[data-mixf="vb"]').fill('20'); await page.locator('[data-mixf="va"]').fill('10');
  await formula('Eingaben');
  await click(page, '[data-mixaction="check"]');
  const fb = await page.locator('[data-mixstep="3"]').innerText();
  assert(/Falscher Quotient/.test(fb) && /vertauscht/.test(fb), 'Fehlerursachen benannt: ' + fb.replace(/\s+/g, ' ').slice(0, 260));
  assert(!(await page.locator('[data-mixstep="3"] .lk-note.ok').count()), 'keine Erfolgsmeldung bei falscher Rechnung');
  // Lösung nur auf Anforderung
  assert(!/Lösung: n\(A⁻\)/.test(await page.locator('[data-mixstep="3"]').innerText()), 'Lösung nicht vorweggenommen');
  await click(page, '[data-mixaction="tip"]'); assert(/Tipp 1\/3/.test(await page.locator('[data-mixstep="3"] .tipbox').innerText()), 'Tipp 1/3');
  // richtige Rechnung
  await page.locator('[data-mixf="r"]').fill('0,5'); await page.locator('[data-mixf="vb"]').fill('10'); await page.locator('[data-mixf="va"]').fill('20');
  await click(page, '[data-mixaction="check"]');
  assert(await page.locator('[data-mixstep="3"] .lk-note.ok').count() === 1, 'richtige Rechnung bestätigt');
  assert(await page.locator('#btnGo').getAttribute('aria-disabled') === 'false' && !(await page.locator('#deckHint').isVisible()), 'Zugeben nach der Rechnung freigegeben (auch wenn die Rechnung Fehler hatte, wird sie geprüft)');
  await shot(page, '05-versuch3-rechnung');
  // eigener Ziel-pH: Zurückweisung und Randlage
  await click(page, '[data-mixtarget="5.05"]');
  await page.locator('#mixCustom').fill('5,95'); await click(page, '[data-mixaction="custom"]');
  assert(/passt keines der drei Systeme/.test(await toastText(page)), 'Lücke zwischen den Systemen zurückgewiesen: ' + await toastText(page));
  assert((await mixState(page)).target === 5.05 && /passt keines/.test(await page.locator('[data-mixstep="1"]').innerText()), 'zurückgewiesener Ziel-pH wird nicht übernommen, Hinweis bleibt sichtbar; bisheriges Ziel 5,05 bleibt');
  await page.locator('#mixCustom').fill('12'); await page.keyboard.press('Enter'); await adv(page, 100);
  assert(/Zahl zwischen/.test(await toastText(page)), 'außerhalb des Bereichs: ' + await toastText(page));
  await page.locator('#mixCustom').fill('abc'); await click(page, '[data-mixaction="custom"]');
  assert(/Zahl/.test(await toastText(page)), 'keine Zahl');
  await page.locator('#mixCustom').fill('4,3'); await click(page, '[data-mixaction="custom"]');
  assert((await mixState(page)).target === 4.3 && await page.locator('[data-mixstep="2"]').count() === 1, 'eigener Ziel-pH 4,3 im Pufferbereich akzeptiert');
  await page.locator('input[data-mixsystem="ac"]').check(); await adv(page, 100);
  assert(/✓ Acetat passt/.test(await page.locator('[data-mixstep="2"] .ffb').innerText()), 'Acetat für 4,3');
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'Sperre, Zurückweisungen (Acetat/Ammonium für 6,90; 5,95; 12), Rechnung vor Dosierung, Formel in jeder Phase sichtbar';
});

// =========================================================== E12 Versuch 3: Herstellen, Verhältnisdiagramm, Messung, Kurve
await scenario('E12', 'P10,P11,P12,P13', 'Versuch 3 für pH 5,05 / 6,90 / 9,55: berechnen, dosieren (Diagramm aus echten Stoffmengen), erst dann messen; Ziel erreicht; falsches Verhältnis verändert den Messwert; Formel in Diagramm und Kurve sichtbar', async () => {
  const cases = [['5.05', 'ac', { r: '2,0', vb: '20', va: '10' }, [['HAc', 10], ['NaAc', 20]], 'ac'], ['6.9', 'ph', { r: '0,5', vb: '10', va: '20' }, [['NaH2PO4', 20], ['Na2HPO4', 10]], 'ph'], ['9.55', 'am', { r: '2,0', vb: '20', va: '10' }, [['NH4Cl', 10], ['NH3', 20]], 'am']];
  const out = [];
  for (const [t, sys, entries, doses] of cases) {
    const { page, errors, done } = await open();
    await openMix(page);
    await planMix(page, t, sys, entries);
    const sN = await S(page, (A, C, a) => ({ pKa: C.SYSTEMS[a].pKa, acid: C.SYSTEMS[a].acid.stock, base: C.SYSTEMS[a].base.stock }), sys);
    // Herstellen: erste Stammlösung → Diagramm folgt den tatsächlichen Stoffmengen
    await doseStock(page, doses[0][0], doses[0][1]);
    let st = await mixState(page);
    near(st.V, doses[0][1], 1e-9, 'Volumen nach der ersten Stammlösung');
    assert(!st.measured && st.pH === null, 'kein pH-Wert vor dem Mischen/Messen');
    let mv = await page.locator('#mixview').innerText();
    assert(/fehlt die (Base A⁻|Säure HA)/.test(mv) && /kein Puffer/.test(mv), 'nur ein Partner: Diagramm zeigt „kein Puffer“: ' + mv.replace(/\s+/g, ' ').slice(0, 200));
    const real = (nm) => page.evaluate((c) => document.querySelector(c).textContent, nm);
    const n1 = await S(page, (A, C) => { const b = A.eng.current().beakers[0]; const p = C.pairAmounts(A.eng.state.system, b.comp); return p; });
    assert((await real('.acidv')).replace(',', '.') === n1.acid.toFixed(3) && (await real('.basev')).replace(',', '.') === n1.base.toFixed(3), `Säulen = Stoffmengen aus dem Becherglas (${await real('.acidv')} / ${await real('.basev')})`);
    // während der zweiten Dosierung ändert sich das Diagramm
    await reagent(page, doses[1][0]); await kind(page, 'm10'); await go(page);
    await waitFor(page, (A, a) => A.eng.current().beakers[0].comp.V > a + 2 && A.eng.busy(), doses[0][1]);
    const mid = await S(page, (A, C) => { const b = A.eng.current().beakers[0]; const p = C.pairAmounts(A.eng.state.system, b.comp); return { acid: p.acid, base: p.base, shown: [document.querySelector('.acidv').textContent, document.querySelector('.basev').textContent] }; });
    assert(mid.acid + mid.base > n1.acid + n1.base + 0.15, 'Diagramm ändert sich beim Dosieren (Zwischenzustand)');
    await idle(page);
    if (doses[1][1] > 10) await doseStock(page, doses[1][0], doses[1][1] - 10);
    st = await mixState(page);
    near(st.V, 30, 1e-9, 'Gesamtvolumen 30,0 mL');
    const plan = await S(page, (A, C, a) => C.planMix(a.sys, a.t), { sys, t: Number(t) });
    const frac = await page.evaluate(() => [document.querySelector('.mx-bar .seg.acid').style.flexBasis, document.querySelector('.mx-bar .seg.base').style.flexBasis]);
    near(parseFloat(frac[1]) / parseFloat(frac[0]), plan.ratio, 0.03, 'Balkenverhältnis = n(A⁻)/n(HA)');
    mv = await page.locator('#mixview').innerText();
    assert(/noch nicht gemessen/.test(mv) && !/gemessener pH-Wert/.test(mv), 'Messung erscheint erst nach dem Mischen');
    assert(/pH –/.test(await page.locator('.tag').first().innerText()), 'pH-Anzeige am Glas zeigt „–“: ' + await page.locator('.tag').first().innerText());
    await shot(page, `06-versuch3-mischen-${sys}`);
    // Messen
    await click(page, '#btnMeasure', false, true);
    await waitFor(page, (A) => { const m = A.eng.meter(A.eng.current().beakers[0]); return m.mixing; });
    assert((await mixState(page)).pH === null, 'während des Mischens noch kein Wert');
    assert(/misst|mischt/.test(await page.locator('#mixview .mx-ph').innerText()), 'Statusanzeige „mischt und misst“');
    await idle(page); await adv(page, 300);
    st = await mixState(page);
    const ref = await S(page, (A, C, a) => ({ model: C.pH(C.mixComp(a.sys, a.va, a.vb)) }), { sys, va: doses[0][0] === sN.acid ? doses[0][1] : doses[1][1], vb: doses[0][0] === sN.base ? doses[0][1] : doses[1][1] });
    near(st.pH, ref.model, 1e-12, 'Messwert = Modell, keine Angleichung');
    assert(Math.abs(st.pH - Number(t)) <= 0.05, `Messwert ${st.pH.toFixed(3)} innerhalb 0,05 vom Ziel ${t}`);
    assert(/gemessener pH-Wert/.test(await page.locator('#mixview').innerText()), 'Messwert im Diagramm nach dem Mischen');
    assert(new RegExp('pH ' + st.pH.toFixed(2).replace('.', ',')).test(await page.locator('.tag').first().innerText()), 'pH-Anzeige am Glas');
    const oc = await page.locator('.outcome').innerText();
    assert(/Ziel erreicht/.test(oc) && /Rechnung/.test(oc) && /Hergestellt \/ gemessen/.test(oc) && /Abweichung/.test(oc), 'Gegenüberstellung Rechnung/Volumina/Messwert/Abweichung: ' + oc.replace(/\s+/g, ' ').slice(0, 300));
    // Kurvenansicht: Formel bleibt, Punkt vorhanden; zurück: Diagramm unverändert
    await view(page, 'curve');
    await formula2(page);
    assert(await page.locator('#chartbox').isVisible() && !(await page.locator('#mixview').isVisible()), 'Kurve ersetzt das Verhältnisdiagramm');
    const pt = await page.evaluate(() => { const A = window.PF.app, c = document.getElementById('chart'), ctx = c.getContext('2d'), m = A.chart.map, d = A.chart.dpr; const e = A.eng.state.history[0]; const x = Math.round(m.X(Math.log10(e.ratio)) * d), y = Math.round(m.Y(e.pH) * d); const q = ctx.getImageData(x - 3, y - 3, 7, 7).data; let col = 0; for (let i = 0; i < q.length; i += 4) if (q[i + 3] > 200 && q[i + 2] > 150 && q[i] < 90) col++; return { col }; });
    assert(pt.col > 5, 'Messpunkt im Kurvenbild gezeichnet');
    if (sys === 'ac') await shot(page, '08-versuch3-ph-kurve');
    await view(page, 'main');
    assert(await page.locator('#mixview').isVisible() && /gemessener pH-Wert/.test(await page.locator('#mixview').innerText()), 'zurück: Verhältnisdiagramm samt Messwert');
    await formula2(page);
    if (sys === 'ac') {
      await shot(page, '07-versuch3-messung');
      // Fehler im Verhältnis: 10 mL Base zu viel → Messwert weicht nachweisbar ab, Ursache wird genannt
      const good = st.pH;
      await doseStock(page, sN.base, 10);
      await click(page, '#btnMeasure', false, true); await idle(page); await adv(page, 300);
      const bad = await mixState(page);
      assert(bad.pH - good > 0.1 && bad.hist === 2, `zu viel Base erhöht den gemessenen pH-Wert (${good.toFixed(2)} → ${bad.pH.toFixed(2)})`);
      const oc2 = await page.locator('.outcome').innerText();
      assert(/Abweichung/.test(oc2) && /Gesamtvolumen/.test(oc2), 'Ursache (Gesamtvolumen/Verhältnis) genannt: ' + oc2.replace(/\s+/g, ' ').slice(0, 300));
      // Kurve: zwei Messpunkte (gleiche Gerade pH = pKₛ + lg x)
      await view(page, 'curve');
      assert(await S(page, (A) => A.eng.state.history.length) === 2, 'zwei Messungen im Verlauf');
      await view(page, 'main');
      // Fragen zu Versuch 3 (nach der Messung): Auswahl nach Antwort-ID bewertet, Leitfrage unbewertet im Journal
      await tab(page, 'task');
      assert(await page.locator('[data-mixstep="6"] fieldset[data-qid]').count() === 2 && await page.locator('[data-mixstep="6"] textarea[data-free="f3"]').count() === 1, 'zwei Fragen und eine Leitfrage nach der Messung');
      await page.locator('[data-mixstep="6"] [name="q-q31"][value="b"]').check(); await page.locator('[data-mixstep="6"] [name="q-q32"][value="a"]').check();
      await click(page, '[data-mixstep="6"] button[type=submit]');
      assert(await page.locator('fieldset[data-qid="q31"]').getAttribute('class') === 'fb-wrong' && await page.locator('fieldset[data-qid="q32"]').getAttribute('class') === 'fb-right', 'q31 falsch (b), q32 richtig (a) – unabhängig von der Position');
      await page.locator('[data-mixstep="6"] [name="q-q31"][value="a"]').check(); await click(page, '[data-mixstep="6"] button[type=submit]');
      assert(await page.locator('fieldset[data-qid="q31"]').getAttribute('class') === 'fb-right', 'q31 richtig (a)');
      await page.locator('textarea[data-free="f3"]').fill('Gemessen 5,05, Ziel 5,05: Das Verhältnis passt.');
      await tab(page, 'journal');
      const jj = await page.locator('#panelBody').innerText();
      assert(/Versuch 3: Puffer gezielt herstellen/.test(jj) && /Leitfrage: Vergleiche in 1–3 Sätzen/.test(jj) && /Meine Antwort \(unbewertet\): Gemessen 5,05/.test(jj) && /Ziel 5,05/.test(jj) && /gemessen 5,05/.test(jj), 'Journal: Messung mit Rechnung, Volumina, Abweichung und Leitfrage');
      // Neu ansetzen: leeres Glas, Messprotokoll bleibt
      await click(page, '#btnBatch');
      st = await mixState(page); assert(st.V === 0 && st.hist === 2, 'Neu ansetzen: leeres Becherglas, Messungen bleiben');
      await tab(page, 'results');
      assert((await page.locator('#panelBody tr').count()) >= 3, 'Ergebnisliste Versuch 3');
    }
    assert(!errors.length, errors.join(' | '));
    out.push(`${sys}: Ziel ${t} → gemessen ${st.pH == null ? '' : ''}${(await S(page, (A) => A.eng.state.history[0].pH)).toFixed(3)}`);
    await done();
  }
  return out.join('; ');
});
async function formula2(page) {
  const t = await page.evaluate(() => { const f = document.querySelector('#formulaBar'); const r = f.getBoundingClientRect(); return { txt: f.innerText.replace(/\s+/g, ' '), ok: !f.hidden && r.height > 20 && r.top >= 0 && r.bottom <= innerHeight }; });
  assert(t.ok && /pH = pKₛ \+ lg/.test(t.txt), 'Formel sichtbar: ' + t.txt);
}

// =========================================================== E13 Anwendungen, Journal, Export, Hefteintrag
await scenario('E13', 'P09,P14', 'Anwendungen (vier Fälle), Journal mit Leitfrage ohne vorzeitige Lösungen, Export und Hefteintrag', async () => {
  // echte Uhr: mit der Playwright-Uhr löst Edge unter Windows keinen Download aus (Testumgebung, nicht die App)
  const { page, errors, done } = await open({ clock: false });
  await dose(page, 'HCl', 'd1'); await idle(page);
  await page.locator('textarea[data-free="f1"]').fill('Die Pufferlösung enthält HPO₄²⁻.');
  await tab(page, 'journal');
  const [dl] = await Promise.all([page.waitForEvent('download'), click(page, '#btnExport')]);
  const html = fs.readFileSync(await dl.path(), 'utf8');
  assert(/Leitfrage/.test(html) && /Meine Antwort \(unbewertet\)/.test(html) && /Die Pufferlösung enthält HPO₄²⁻/.test(html), 'Journal enthält Leitfrage und unbewertete Antwort');
  assert(/Wasser: 7,00 → 3,78/.test(html), 'Messdaten im Export');
  assert(!/Zutreffend: a, b, c/.test(html) && !/Lösung:/.test(html), 'keine Musterlösung im Export');
  assert(!FORBIDDEN.test(html.replace(/Verdünn/g, '')), 'Export ohne alte Begriffe');
  await click(page, '#btnNotebook');
  const nb = await page.locator('.lk-notebook').innerText();
  const words = nb.split(/\s+/).length;
  assert(/Henderson-Hasselbalch/.test(nb) && words < 200, `Hefteintrag knapp (${words} Wörter)`);
  await click(page, '#steps [data-page="apps"]');
  assert(await page.locator('.lockcard').count() === 1, 'Anwendungen vor den Rechnungen gesperrt');
  await click(page, '[data-force="apps"]');
  assert(await page.locator('[data-app]').count() === 4, 'vier Anwendungsfälle');
  for (const [q, v] of [['a1', 'a'], ['a2', 'b'], ['a3', 'b'], ['a4', 'a']]) { await page.locator(`[data-app-q="${q}"][value="${v}"]`).check(); await click(page, `[data-ap="check"][data-id="${q}"]`); }
  assert(await page.locator('.ffb.y').count() === 4, 'vier richtige Antworten (nach Antwort-ID)');
  await page.locator('[data-app-q="a2"][value="c"]').check(); await click(page, '[data-ap="check"][data-id="a2"]');
  assert(/Gleicher pH bedeutet nicht gleiche Reserve/.test(await page.locator('[data-app="see"]').innerText()), 'Kapazitätsvergleich mit Rückmeldung');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Hefteintrag ${words} Wörter`;
});

// =========================================================== E14 Neuladen, Speicherstand 0.2.0, 0.1.0-Daten bleiben unberührt
await scenario('E14', 'P14', 'Neuladen: Messreihen, Antworten, Auswahl, Ansicht und Versuch 3 bleiben erhalten; Daten von 0.1.0 werden weder gelesen noch verändert', async () => {
  const V1 = JSON.stringify({ v: 1, ui: { page: 'lab', revealed: true, predict: { e1: { v: 'gleich' } }, answers: { e4: { q41: 'a' } } }, engine: { v: 1, exp: 'e4', series: {}, active: {}, archive: [] } });
  const { page, errors, context, done } = await open();
  await context.addInitScript((v) => { if (!localStorage.getItem('sivex.pufferfish.v1')) localStorage.setItem('sivex.pufferfish.v1', v); }, V1);
  await page.reload(); await page.waitForFunction(() => window.PF && window.PF.app); await adv(page, 300);
  assert(await page.evaluate(() => localStorage.getItem('sivex.pufferfish.v1')) === V1, '0.1.0-Speicherstand unverändert vorhanden');
  const fresh = await S(page, (A) => ({ exp: A.eng.state.exp, rec: A.eng.current().beakers[0].records.length, revealed: A.ui.revealed, keys: Object.keys(A.ui).includes('predict') }));
  assert(fresh.exp === 'e1' && fresh.rec === 1 && !fresh.revealed && !fresh.keys, 'neuer Start trotz 0.1.0-Daten: ' + JSON.stringify(fresh));
  await dose(page, 'HCl', 'd1'); await idle(page);
  await page.locator('#protoForm [name="q-d1"][value="b"]').check();
  await page.locator('textarea[data-free="f1"]').fill('Es braucht Säure und Base.');
  await click(page, '#protoForm button[type=submit]');
  await click(page, '#chkIndicator'); await view(page, 'curve');
  await adv(page, 700);
  assert(await page.evaluate(() => localStorage.getItem('sivex.pufferfish.v2')) !== null, 'Speicherstand 0.2.0 unter eigenem Schlüssel');
  assert(await page.evaluate(() => localStorage.getItem('sivex.pufferfish.v1')) === V1, '0.1.0-Speicherstand bleibt nach dem Speichern unverändert');
  await page.reload(); await page.waitForFunction(() => window.PF && window.PF.app); await adv(page, 300);
  const st = await S(page, (A) => ({ rec: A.eng.current().beakers[0].records.length, ind: A.ui.indicator, free: A.ui.answers.e1.f1, busy: A.eng.busy(), view: A.ui.view.e1 }));
  assert(st.rec === 2 && !st.ind && st.free === 'Es braucht Säure und Base.' && !st.busy && st.view === 'curve', JSON.stringify(st));
  assert(await page.locator('#chartbox').isVisible(), 'gewählte Ansicht (Kurve) wiederhergestellt');
  assert(await page.locator('#protoForm textarea[data-free="f1"]').inputValue() === 'Es braucht Säure und Base.', 'Freitext wieder im Formular');
  // Versuch 3 über Neuladen
  await openMix(page); await planMix(page, '5.05', 'ac', { r: '2', vb: '20', va: '10' });
  await doseStock(page, 'NaAc', 10); await click(page, '#btnMeasure', false, true); await idle(page); await adv(page, 800);
  const before = await mixState(page);
  await page.reload(); await page.waitForFunction(() => window.PF && window.PF.app); await adv(page, 300);
  const after = await mixState(page);
  assert(after.sys === 'ac' && after.target === 5.05 && Math.abs(after.V - 10) < 1e-9 && after.measured && Math.abs(after.pH - before.pH) < 1e-12 && after.hist === 1, 'Versuch 3 nach Neuladen: ' + JSON.stringify(after));
  assert(await page.locator('[data-mixf="r"]').inputValue() === '2' && await page.locator('[data-mixstep="3"] .lk-note.ok').count() === 1, 'Rechnung und Bestätigung erhalten');
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'v2 gespeichert; v1 unverändert und ignoriert';
});

// =========================================================== E15 Schnellbedienung, Pause, Schritt
await scenario('E15', 'P14', 'Doppelklick/Schnellbedienung ohne Doppeldosierung; Pause friert Tropfen ein; Schritt; Bedienen beendet die Pause', async () => {
  const { page, errors, done } = await open();
  await page.locator('#btnGo').dblclick();
  await page.locator('#btnGo').click({ force: true });
  await click(page, '.bottlebtn[data-bottle="NaOH"]', false, true);
  assert(await S(page, (A) => A.eng.state.slot) === 'HCl', 'Lösungswechsel während der Zugabe abgewiesen');
  await waitFor(page, (A) => A.eng.state.drops.length > 0);
  await speed(page, '0');
  const y0 = await S(page, (A) => ({ y: A.eng.state.drops[0].y, t: A.eng.state.time }));
  await adv(page, 800);
  const y1 = await S(page, (A) => ({ y: A.eng.state.drops[0].y, t: A.eng.state.time }));
  assert(y0.y === y1.y && y0.t === y1.t, 'Pause: Tropfen und Zeit stehen');
  await click(page, '#btnStep');
  const y2 = await S(page, (A) => A.eng.state.time);
  near(y2 - y1.t, 0.2, 1e-9, 'Schritt = 0,2 s Modellzeit');
  // 0.3.0 (iPad-Regel 4): Bedienen bei stillstehender Zugabe beendet die Pause, statt alles zu blockieren
  await go(page);
  assert(/Pause beendet/.test(await toastText(page)) && await S(page, (A) => A.ui.speed === 1), 'Dosieren in der Pause beendet die Pause, die laufende Zugabe läuft zu Ende');
  await idle(page);
  const log = await S(page, (A) => ({ n: A.eng.state.log.length, added: A.eng.current().beakers.map((b) => b.added) }));
  assert(log.n === 1 && log.added.every((v) => Math.abs(v - 0.05) < 1e-12), `genau eine Zugabe (${log.n})`);
  // Umrühren, Tropfen- und Strahlanimation, Meniskus: Zeichnung ändert sich tatsächlich (Übergänge, nicht nur Endzustände)
  const s0 = await page.evaluate(() => document.getElementById('lab').toDataURL().length);
  await tool(page, 'measure'); await kind(page, 'm5'); await go(page);
  await waitFor(page, (A) => A.eng.state.streams.length > 0);
  await adv(page, 400);
  const jet = await page.evaluate(() => { const A = window.PF.app; return { streams: A.eng.state.streams.length, sig: document.getElementById('lab').toDataURL().length, surf: A.eng.current().beakers[0].comp.V }; });
  assert(jet.streams > 0 && jet.sig !== s0, 'Strahl der Messpipette sichtbar');
  const v0 = await S(page, (A) => A.eng.current().beakers[0].comp.V);
  await idle(page);
  const v1 = await S(page, (A) => A.eng.current().beakers[0].comp.V);
  assert(v1 > v0 && Math.abs(v1 - 35.05) < 1e-6, `Flüssigkeitsstand steigt mit der Zugabe (${v0.toFixed(2)} → ${v1.toFixed(2)} mL)`);
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'eine Dosierung trotz Doppelklick + Klick; Strahl und Füllstand ändern sich';
});

// =========================================================== E16–E19 Bildschirmgrößen
const VIEWPORTS = [[1440, 900, 'E16', false, '01'], [1180, 820, 'E17', true, '09-tablet-1180x820'], [1024, 768, 'E18', true, '10-tablet-1024x768'], [768, 1024, 'E19', true, '11-tablet-768x1024']];
async function layoutChecks(page, W, H, label) {
  const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert(ov.sw <= ov.cw, `${label}: keine horizontale Überbreite (${ov.sw} > ${ov.cw})`);
  const sel = '#doseBar button, .bottlebtn, #viewToggle button, #expChips button, #speed button, #btnStir, .seriesbar button:not([hidden]), #steps button, .lk-tabs button';
  const n = await page.locator(sel).count();
  const bad = [];
  for (let i = 0; i < n; i++) {
    const l = page.locator(sel).nth(i);
    if (!(await l.isVisible())) continue;
    await l.scrollIntoViewIfNeeded();
    const r = await l.evaluate((e) => { const b = e.getBoundingClientRect(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2; const top = document.elementFromPoint(cx, cy); return { t: e.textContent.trim().slice(0, 18), covered: !(top === e || e.contains(top)), inX: b.x >= -1 && b.x + b.width <= innerWidth + 1, w: b.width, h: b.height, cover: top ? (top.className || top.tagName) : 'none' }; });
    if (r.covered || !r.inX || r.w < 43.5 || r.h < 43.5) bad.push(JSON.stringify(r));
  }
  assert(!bad.length, `${label}: Bedienelemente überdeckt/zu klein/außerhalb: ${bad.join(' ')}`);
  await page.evaluate(() => { document.querySelector('.labgrid').scrollTop = 0; window.scrollTo(0, 0); });
  const lab = await page.locator('#lab').boundingBox();
  assert(lab.width >= 380 && lab.height >= 200, `${label}: Laborbild nutzbar (${Math.round(lab.width)}×${Math.round(lab.height)})`);
  // Beschriftungen liegen im Laborbild und überlappen sich nicht
  const wrap = await page.locator('#canvasWrap').boundingBox();
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.eltag, .tag, .bottlebtn, .piphit, .addtag')].map((e) => { const r = e.getBoundingClientRect(); return { n: (e.className + ' ' + e.textContent).slice(0, 30), x: r.x, y: r.y, w: r.width, h: r.height }; }));
  for (const b of boxes) assert(b.x >= wrap.x - 1 && b.x + b.w <= wrap.x + wrap.width + 1 && b.y >= wrap.y - 1 && b.y + b.h <= wrap.y + wrap.height + 1, `${label}: ${b.n} liegt im Laborbild`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; assert(!(a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1), `${label}: ${a.n} überdeckt ${b.n}`); }
  return { lab: `${Math.round(lab.width)}×${Math.round(lab.height)}` };
}
for (const [W, H, id, touch, name] of VIEWPORTS) {
  await scenario(id, 'P15', `Anzeige und Bedienung bei ${W}×${H}${touch ? ' (Touch-Emulation)' : ''}: kein Querscrollen, nichts überdeckt, Laborbild und Zusatzansicht nutzbar, Versuch 1 und 3`, async () => {
    const { page, errors, done } = await open({ viewport: { width: W, height: H }, hasTouch: touch });
    await dose(page, 'HCl', 'd1', touch); await idle(page);
    const a = await layoutChecks(page, W, H, 'Versuch 1');
    const scale = await S(page, (A) => A.lab.view.scale), beaker = await S(page, (A) => (A.eng.geometry()[0].bottom - A.eng.geometry()[0].top) * A.lab.view.scale);
    await page.locator('#extra').scrollIntoViewIfNeeded();
    assert(await page.locator('#partview').isVisible(), 'Teilchenmodell erreichbar');
    await page.evaluate(() => { document.querySelector('.labgrid').scrollTop = 0; window.scrollTo(0, 0); });
    await shot(page, name === '01' ? '01-start-versuch1-1440x900-nach-zugabe' : name);
    await view(page, 'curve'); await page.locator('#chartbox').scrollIntoViewIfNeeded();
    assert(await page.locator('#chartbox').isVisible() && (await page.locator('#chart').boundingBox()).height >= 100, 'pH-Kurve lesbar erreichbar');
    await view(page, 'main');
    // Versuch 3
    await openMix(page); await planMix(page, '6.9', 'ph', { r: '0,5', vb: '10', va: '20' });
    await doseStock(page, 'NaH2PO4', 10);
    const b = await layoutChecks(page, W, H, 'Versuch 3');
    await page.locator('#formulaBar').scrollIntoViewIfNeeded();
    const f = await page.evaluate(() => { const r = document.querySelector('#formulaBar').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, w: r.width }; });
    assert(f.top >= 0 && f.bottom <= f.h && f.w > 300, 'Formel im sichtbaren Bereich: ' + JSON.stringify(f));
    assert(await page.locator('#mixview').isVisible(), 'Verhältnisdiagramm sichtbar');
    await page.evaluate(() => { document.querySelector('.labgrid').scrollTop = 0; window.scrollTo(0, 0); });
    if (name === '01') await shot(page, '06-versuch3-mischen-1440x900');
    // Ergebnis-/Panel-Seiten ohne Querscrollen
    await click(page, '#steps [data-page="theory"]', touch);
    const ovp = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    assert(ovp, 'Herleitungsseite ohne Querscrollen');
    assert(!errors.length, errors.join(' | '));
    await done();
    return `Labor ${a.lab}, Becherglas ${beaker.toFixed(0)} px (Maßstab ${scale.toFixed(2)})${touch ? ', Emulation (kein echtes iPad)' : ''}`;
  });
}

// =========================================================== E20 Tastatur und Trennlinie
await scenario('E20', 'P05,P14', 'Tastaturbedienung (Tab/Enter wählt und dosiert) und verschiebbare Trennlinie (Pfeiltasten, Doppelklick)', async () => {
  const { page, errors, done } = await open();
  await page.locator('#doseBar [data-reagent="NaOH"]').focus(); await page.keyboard.press('Enter'); await adv(page, 60);
  await page.locator('#doseBar [data-kind="d5"]').focus(); await page.keyboard.press('Enter'); await adv(page, 60);
  await page.locator('#btnGo').focus(); await page.keyboard.press('Enter');
  await idle(page);
  const b = await beakers(page);
  near(b[0].added, 0.25, 1e-12, 'Enter wählt NaOH und 5 Tropfen und dosiert');
  assert(await S(page, (A) => A.eng.current().reagent) === 'NaOH', 'Laugenreihe');
  const w0 = (await page.locator('#panel').boundingBox()).width;
  await page.locator('#splitter').focus(); await page.keyboard.press('ArrowLeft'); await adv(page, 100);
  const w1 = (await page.locator('#panel').boundingBox()).width;
  assert(Math.abs(w1 - w0 - 24) < 2, `Bedienfeld +24 px (${w0} → ${w1})`);
  await page.locator('#splitter').dblclick(); await adv(page, 100);
  const w2 = (await page.locator('#panel').boundingBox()).width;
  assert(Math.abs(w2 - w0) < 2, 'Doppelklick setzt zurück');
  // Fokus sichtbar
  await page.locator('#doseBar [data-reagent="HCl"]').focus();
  const out = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(out !== 'none', 'sichtbarer Fokus');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Bedienfeld ${w0} → ${w1} → ${w2} px`;
});

// =========================================================== E22 Konsistenz bei Bedienung während Zugabe/Messung (Prüfbericht)
await scenario('E22', 'P05,P14', 'Versuch 3: Ziel/System-Wechsel während Zugabe und Messung wird abgewiesen (kein Einfrieren, kein Zustandsunterschied); Eingabeänderung verwirft das Prüfergebnis; Gegenprobe: Flaschen und Umschalter zeigen denselben Zustand', async () => {
  const { page, errors, done } = await open();
  await openMix(page); await planMix(page, '5.05', 'ac', { r: '2', vb: '20', va: '10' });
  await reagent(page, 'NaAc'); await kind(page, 'm10'); await go(page);
  await waitFor(page, (A) => A.eng.busy());
  await click(page, '[data-mixtarget="6.9"]');
  assert(/Warte/.test(await toastText(page)), 'Zielwechsel während der Zugabe abgewiesen: ' + await toastText(page));
  await idle(page);
  assert((await mixState(page)).target === 5.05 && await S(page, (A) => A.ui.mix.target) === 5.05 && await S(page, (A) => A.ui.mix.system) === 'ac', 'UI und Engine unverändert');
  await click(page, '#btnMeasure', false, true);
  await waitFor(page, (A) => A.eng.meter(A.eng.current().beakers[0]).mixing);
  await click(page, '[data-mixtarget="6.9"]');
  await page.locator('input[data-mixsystem="ph"]').evaluate((e) => e.click()); // sofort, ohne auf den Zustand zu warten
  assert(/Warte/.test(await toastText(page)) && await S(page, (A) => A.ui.mix.system) === 'ac', 'Systemwechsel während der Messung abgewiesen');
  const t0 = await S(page, (A) => A.eng.state.time);
  await idle(page); await adv(page, 500);
  const t1 = await S(page, (A) => A.eng.state.time);
  const st = await mixState(page);
  assert(t1 > t0 + 1 && st.measured && st.sys === 'ac' && st.target === 5.05, 'Messung läuft zu Ende, Zeitschleife läuft weiter: ' + JSON.stringify(st));
  await click(page, '#btnMeasure', false, true);
  assert(/schon gemessen/.test(await toastText(page)) && (await mixState(page)).hist === 1, 'zweites Messen am unveränderten Glas abgewiesen, keine doppelte Zeile');
  // Prüfergebnis verfällt bei geänderter Eingabe
  assert(await page.locator('[data-mixstep="3"] .lk-note.ok').count() === 1, 'Rechnung bestätigt');
  await page.locator('[data-mixf="r"]').fill('3'); await adv(page, 100);
  await tab(page, 'results'); await tab(page, 'task');
  assert(await page.locator('[data-mixstep="3"] .lk-note.ok').count() === 0 && await S(page, (A) => A.ui.mix.res) === null, 'altes Prüfergebnis nach Änderung nicht mehr angezeigt');
  // Gegenprobe in Versuch 1: Flaschen und Umschalter zeigen denselben Zustand
  await exp(page, 'e1'); await tool(page, 'dropper'); await dose(page, 'HCl', 'd1'); await idle(page); await click(page, '#btnCont');
  const ps = await page.evaluate(() => ({ deck: ['HCl', 'NaOH', 'cont'].map((k) => document.querySelector(`#doseBar [data-reagent="${k}"]`).getAttribute('aria-pressed')), bottle: ['HCl', 'NaOH'].map((k) => document.querySelector(`.bottlebtn[data-bottle="${k}"]`).getAttribute('aria-pressed')) }));
  assert(ps.deck.join() === 'false,false,true' && ps.bottle.join() === 'false,false', 'Gegenprobe: keine Flasche als gewählt dargestellt: ' + JSON.stringify(ps));
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'kein Einfrieren, kein Zustandsunterschied';
});

// =========================================================== E23 0.2.1: mL-Anzeige, Rührfisch, Neutralisation zu H₂O
await scenario('E23', 'P05,P07,P14', '0.2.1: zugesetzte Gesamtmenge je Glas nur in Versuch 1 (Neue Reihe setzt zurück), Rühren an/aus mit Rührfisch, im Puffer entsteht H₂O, im Wasser nicht', async () => {
  const { page, errors, done } = await open();
  const pressed = (sel) => page.locator(sel).first().getAttribute('aria-pressed');
  const add = () => page.evaluate(() => [...document.querySelectorAll('.addtag')].map((a) => a.innerText.replace(/\s+/g, ' ').trim()));
  let a = await add();
  assert(a.length === 2 && a.every((t) => /HCl 0,00 mL/.test(t) && /NaOH 0,00 mL/.test(t)), 'Start: zugesetzt 0,00 mL je Glas: ' + JSON.stringify(a));
  await tool(page, 'measure'); await kind(page, 'm1'); await go(page);
  await waitFor(page, (A) => A.eng.current().beakers[0].added > 0.2 && A.eng.current().beakers[0].added < 0.99);
  a = await add();
  assert(/HCl 0,\d\d mL/.test(a[0]) && !/HCl 0,00/.test(a[0]), 'Anzeige zählt während der Zugabe mit: ' + a[0]);
  await idle(page);
  a = await add();
  assert(/HCl 1,00 mL/.test(a[0]) && /HCl 1,00 mL/.test(a[1]) && /NaOH 0,00 mL/.test(a[1]), 'nach 1,0 mL in beide Gläser: ' + JSON.stringify(a));
  // Teilchenmodell: im Puffer reagiert die Zugabe zu H₂O, im Wasser bleibt H₃O⁺ frei
  await target(page, 'all'); await go(page);
  let sawWater = false, waterInA = false;
  for (let i = 0; i < 400; i++) { // Messpipette: erst Glas A, dann nachfüllen und Glas B
    const fx = await page.evaluate(() => window.PF.app.U.views().map((v) => v.fx.map((f) => f.sp)));
    if (fx[1] && fx[1].includes('H2O')) sawWater = true;
    if (fx[0] && fx[0].length) waterInA = true;
    if (sawWater && !(await S(page, (A) => A.eng.busy()))) break;
    await adv(page, 60);
  }
  await idle(page);
  assert(sawWater, 'Pufferlösung: H₃O⁺ reagiert mit HPO₄²⁻, H₂O entsteht sichtbar');
  assert(!waterInA, 'Wasser: keine Neutralisation, kein H₂O-Symbol (H₃O⁺ häuft sich an)');
  const h3o = await page.evaluate(() => window.PF.app.U.views()[0].parts.filter((p) => p.sp === 'H3O' && !p.leaving).length);
  assert(h3o >= 6, `Wasser: freie H₃O⁺ sichtbar angehäuft (${h3o})`);
  // Laugenreihe zeigt ihre eigene Menge; Neue Reihe setzt zurück
  await reagent(page, 'NaOH');
  a = await add();
  assert(a.every((t) => /HCl 0,00 mL/.test(t) && /NaOH 0,00 mL/.test(t)), 'Laugenreihe: frische Ansätze, 0,00 mL: ' + JSON.stringify(a));
  await reagent(page, 'HCl');
  a = await add();
  assert(a.every((t) => /HCl 0,00 mL/.test(t)), 'zurück zu HCl: frische Ansätze, 0,00 mL (vorige Reihe abgelegt): ' + JSON.stringify(a));
  await go(page); await idle(page);
  a = await add();
  assert(/HCl 1,00 mL/.test(a[0]), 'neue Zugabe gezählt: ' + a[0]);
  await click(page, '#btnNewSeries');
  a = await add();
  assert(a.every((t) => /HCl 0,00 mL/.test(t)), 'Neue Reihe setzt die Mengen zurück: ' + JSON.stringify(a));
  // Rühren an/aus mit Rührfisch
  const s0 = await page.evaluate(() => document.getElementById('lab').toDataURL().length);
  await click(page, '#btnStir');
  assert(await pressed('#btnStir') === 'true' && await S(page, (A) => A.eng.state.stirOn && A.eng.stirring(A.eng.current().beakers[0])), 'Rühren an');
  await adv(page, 300);
  const s1 = await page.evaluate(() => document.getElementById('lab').toDataURL().length);
  await adv(page, 137);
  const s2 = await page.evaluate(() => document.getElementById('lab').toDataURL().length);
  assert(s1 !== s0 && s2 !== s1, 'Rührfisch dreht sich (Bild ändert sich)');
  await click(page, '#btnStir');
  assert(await pressed('#btnStir') === 'false' && !(await S(page, (A) => A.eng.state.stirOn)), 'Rühren aus');
  // Versuch 2 und 3: keine Mengenanzeige
  await exp(page, 'e2');
  assert(await page.locator('.addtag').count() === 0, 'Versuch 2 ohne Mengenanzeige');
  await exp(page, 'e3');
  assert(await page.locator('.addtag').count() === 0, 'Versuch 3 ohne Mengenanzeige');
  await exp(page, 'e1');
  await shot(page, '14-versuch1-menge-ruehrfisch');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `H₂O im Puffer, ${h3o} H₃O⁺ im Wasser; Mengen zählen live und werden zurückgesetzt`;
});

// =========================================================== E21 Zufallsbedienung (Robustheit)
async function monkey(seed, steps, startMix) {
  let st = seed >>> 0; const rnd = () => (st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296;
  const { page, errors, done } = await open();
  if (startMix) {
    await exp(page, 'e3'); await click(page, '[data-mixtarget="5.05"]');
    await page.locator('input[data-mixsystem="ac"]').check(); await page.locator('[data-mixf="r"]').fill('2'); await page.locator('[data-mixf="vb"]').fill('20'); await page.locator('[data-mixf="va"]').fill('10');
    await click(page, '[data-mixaction="check"]');
  }
  const SEL = startMix
    ? ['#doseBar button', '#doseBar [data-reagent]', '#btnGo', '#btnGo', '#btnMeasure', '#btnMeasure', '#btnBatch', '.bottlebtn', '#viewToggle button', '#speed button', '[data-mixtarget]', 'input[data-mixsystem]', '[data-mixaction]', '#btnMeasurePanel', '.lk-tabs button', '#expChips button', '#protoForm button', '#btnStir']
    : ['#doseBar button', '.bottlebtn', '#expChips button', '#viewToggle button', '#speed button', '#btnStep', '#btnStir', '#btnNewSeries', '#btnCont', '.lk-tabs button', '[data-mixtarget]', '[data-mixaction]', 'input[data-mixsystem]', '#chkIndicator', '#chkZoom', '#chkPka', '[data-fresh]', '[data-cmp]', '#steps button', '[data-force]', '[data-go]', '#btnNotebook', '#btnMotion', '#btnPanel', '#protoForm button', '[data-th]', '[data-tk]', '[data-ap]'];
  let clicks = 0;
  for (let i = 0; i < steps; i++) {
    const sel = SEL[Math.floor(rnd() * SEL.length)];
    const loc = page.locator(sel), n = await loc.count();
    if (!n) continue;
    const el = loc.nth(Math.floor(rnd() * n));
    try { if (!(await el.isVisible())) continue; if (sel.startsWith('input[')) await el.check({ timeout: 800, force: true }); else await el.click({ timeout: 800, force: true }); clicks++; } catch (e) { /* nicht klickbar */ }
    if (rnd() < 0.3) for (const f of ['r', 'vb', 'va']) { const inp = page.locator(`[data-mixf="${f}"]`); if (await inp.count()) await inp.fill(['2', '0,5', '10', '20', '', 'x', '-3', '1e3'][Math.floor(rnd() * 8)]).catch(() => {}); }
    await adv(page, Math.floor(rnd() * 1500) + 100);
    if (errors.length) break;
  }
  const state = await S(page, (A) => ({ exp: A.eng.state.exp, time: Math.round(A.eng.state.time), hist: A.eng.state.history.length }));
  assert(!errors.length, `Seed ${seed}: ${errors.join(' | ')}`);
  await done();
  return `Seed ${seed}: ${clicks} Klicks, ${state.time} s Modellzeit, keine Fehler`;
}
await scenario('E21', 'P14,P15', 'Zufallsbedienung (gesetzter Seed, Versuche 1–3, Reiter, Seiten, Zurücksetzen): keine Seiten- oder Konsolenfehler', async () => {
  const out = [await monkey(21, 140, false), await monkey(22, 140, true)];
  return out.join('; ');
});

// =========================================================== Abschluss
const external = [...new Set(allRequests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:') && !u.startsWith('blob:')))];
results.push({ id: 'NET', p: 'P16', title: 'Keine externen Anfragen', status: external.length ? 'FAIL' : 'PASS', detail: external.join(', ') || `${allRequests.length} Anfragen, alle lokal` });
results.push({ id: 'CON', p: 'P15', title: 'Keine Konsolen- oder Seitenfehler', status: allErrors.length ? 'FAIL' : 'PASS', detail: allErrors.slice(0, 5).join(' | ') || 'keine' });
console.log(`${results.at(-2).status} NET – ${results.at(-2).detail}`);
console.log(`${results.at(-1).status} CON – ${results.at(-1).detail}`);
const out = { date: new Date().toISOString(), browser: `${browser.__channel} ${browser.version()}`, root: path.relative(APP, ROOT), results };
if (!ONLY) fs.writeFileSync(path.join(APP, 'tests/e2e/results.json'), JSON.stringify(out, null, 2));
await browser.close(); server.close();
const failed = results.filter((r) => r.status !== 'PASS');
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
