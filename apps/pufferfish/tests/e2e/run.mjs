// End-to-End-Prüfung von Pufferfish im echten Browser (Edge/Chromium über Playwright).
// Bedient ausschließlich die gerenderte Oberfläche; der Modellzustand wird nur gelesen.
// Erwartungswerte für pH stammen aus chem.js im Browser bzw. aus unabhängigen Formeln.
// Aufruf: npm run build && node tests/e2e/run.mjs   (ONLY=E01,E05 für einzelne Szenarien)
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '../../scripts/serve.mjs';
import { APP, launch, newPage, S, beakers, idle, waitFor, click, dose, target, exp, slot, speed, tab, toastText, skipPredict, predict, shot, sleep, assert, near } from './lib.mjs';

const ROOT = process.env.E2E_ROOT ? path.resolve(process.env.E2E_ROOT) : path.join(APP, 'dist/pufferfish');
const PORT = Number(process.env.E2E_PORT || 8172);
const BASE = `http://localhost:${PORT}/index.html`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const results = [], allRequests = [], allErrors = [];

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
const refPH = (page, recipe, reagent, mL) => S(page, (A, C, a) => C.pH(C.add(a.r === 'water' ? C.water(30) : a.r === 'phos' ? C.phosphate(30, 0.05, 0.05) : C.acetate(30, a.ha, a.a), a.reagent, a.mL)), Object.assign({ reagent, mL }, recipe));
const canvasSig = (page, sel) => page.evaluate((s) => { const c = document.querySelector(s); return c.toDataURL().length + ':' + c.toDataURL().slice(-200); }, sel);
const setVal = async (page, sel, v) => { const l = page.locator(sel); if ((await l.evaluate((e) => e.tagName)) === 'SELECT') await l.selectOption(v); else await l.fill(v); };

// =========================================================== E01 Logo
await scenario('E01', 'Logo: Begrüßung pumpt sich auf, erneut per Klick/Tastatur, keine Layoutsprünge; reduzierte Bewegung', async () => {
  const { page, errors, done } = await open();
  const r0 = await page.locator('#logo').boundingBox();
  const h0 = await page.locator('.lk-head').boundingBox();
  await sleep(1000); // Begrüßung startet nach 450 ms, Höhepunkt bei etwa 22 % von 2,6 s
  const mid = await page.evaluate(() => ({ cls: document.querySelector('#logo').className, tr: getComputedStyle(document.querySelector('.pf-body')).transform, sp: getComputedStyle(document.querySelector('.pf-spikes path')).transform }));
  assert(mid.cls.includes('puff'), 'Begrüßungsanimation läuft');
  const sc = (m) => { const v = /matrix\(([^,]+)/.exec(m); return v ? Number(v[1]) : 1; };
  assert(sc(mid.tr) > 1.15, `Körper aufgepumpt (Skalierung ${sc(mid.tr)})`);
  await shot(page, '01-logo-aufgepumpt', { x: 0, y: 0, width: 360, height: 52 });
  const r1 = await page.locator('#logo').boundingBox(), h1 = await page.locator('.lk-head').boundingBox();
  assert(r0.x === r1.x && r0.width === r1.width && h0.height === h1.height, 'keine Layoutsprünge durch das Logo');
  await sleep(2600);
  assert(!(await page.locator('#logo').getAttribute('class')).includes('puff'), 'Animation endet wieder');
  await page.locator('#logo').focus(); await page.keyboard.press('Enter'); await sleep(500);
  assert((await page.locator('#logo').getAttribute('class')).includes('puff'), 'per Tastatur erneut auslösbar');
  await done();
  const rm = await open({ reducedMotion: 'reduce' });
  await sleep(900);
  const st = await rm.page.evaluate(() => ({ cls: document.querySelector('#logo').className, tr: getComputedStyle(document.querySelector('.pf-body')).transform, rm: window.PF.app.ui.reduceMotion }));
  assert(st.rm && !st.cls.includes('puff') && (st.tr === 'none' || /matrix\(1, 0, 0, 1/.test(st.tr)), 'prefers-reduced-motion: keine Logoanimation');
  await rm.done();
  assert(!errors.length, errors.join(' | '));
  return `Skalierung ${sc(mid.tr).toFixed(2)}, Logo-Box unverändert ${r0.width}×${r0.height}`;
});

// =========================================================== E02 Versuch 1, Säurereihe
await scenario('E02', 'Versuch 1: Vermutung vor dem Dosieren, ein Tropfen nacheinander in beide Gläser, Tropfenweg → Ankunft → Mischen → Messpunkt', async () => {
  const { page, errors, done } = await open();
  await dose(page, 'd1');
  assert((await beakers(page)).every((b) => b.added === 0), 'ohne Vermutung wird nicht dosiert');
  assert(/Vermutung/.test(await toastText(page)), 'Hinweis auf die Vermutung');
  await predict(page, 'wasser');
  await shot(page, '02-start-versuch1');
  await dose(page, 'd1');
  // Tropfen im Flug, Glas noch unverändert
  await waitFor(page, (A) => A.eng.state.drops.length > 0);
  const flight = await S(page, (A) => ({ drops: A.eng.state.drops.length, added: A.eng.current().beakers.map((b) => b.added) }));
  assert(flight.added.every((v) => v === 0), 'keine Gleichgewichtsanzeige vor dem Eintreffen');
  await shot(page, '03-tropfen-im-flug');
  await waitFor(page, (A) => A.eng.current().beakers[0].added > 0);
  const mix = await S(page, (A) => ({ m: A.eng.meter(A.eng.current().beakers[0]), b1: A.eng.current().beakers[1].added, plumes: (A.lab.fx[0] || { plumes: [] }).plumes.length }));
  assert(mix.m.mixing, 'Wasser: Mischstatus nach Ankunft');
  assert(mix.b1 === 0, 'Glas B erhält den Tropfen erst danach (nacheinander)');
  assert(mix.plumes > 0, 'Indikatorschliere nach Ankunft');
  await sleep(250); await shot(page, '04-schliere-mischen');
  await idle(page);
  const bs = await beakers(page);
  near(bs[0].records[1].pH, await refPH(page, { r: 'water' }, 'HCl', 0.05), 1e-9, 'Wasser nach 1 Tropfen');
  near(bs[1].records[1].pH, await refPH(page, { r: 'phos' }, 'HCl', 0.05), 1e-9, 'Phosphat nach 1 Tropfen');
  near(bs[0].records[1].v, 0.05, 1e-12, 'gleiche Zugabe A'); near(bs[1].records[1].v, 0.05, 1e-12, 'gleiche Zugabe B');
  await dose(page, 'd5'); await idle(page);
  await dose(page, 'm1'); await idle(page);
  const b2 = await beakers(page);
  near(b2[0].added, 1.3, 1e-9, 'Summe der Zugaben'); assert(b2[0].records.length === 8, '1 + 1 + 5 + 1 Messpunkte');
  await shot(page, '05-kurve-saeurereihe');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Wasser ${bs[0].records[1].pH.toFixed(3)}, Phosphat ${bs[1].records[1].pH.toFixed(3)} nach 0,05 mL HCl`;
});

// =========================================================== E03 Laugenreihe und Gegenprobe
await scenario('E03', 'Laugenreihe mit frischen Ansätzen, Säurereihe bleibt gespeichert, Gegenprobe ausdrücklich gekennzeichnet (H₃O⁺ + OH⁻)', async () => {
  const { page, errors, done } = await open();
  await skipPredict(page);
  await dose(page, 'd1'); await idle(page);
  await slot(page, 'NaOH');
  let bs = await beakers(page);
  assert(bs.every((b) => b.added === 0 && b.records.length === 1), 'Laugenreihe startet mit frischen Proben');
  await dose(page, 'd1'); await idle(page);
  bs = await beakers(page);
  near(bs[0].records[1].pH, await refPH(page, { r: 'water' }, 'NaOH', 0.05), 1e-9, 'Wasser nach NaOH');
  near(bs[1].records[1].pH, await refPH(page, { r: 'phos' }, 'NaOH', 0.05), 1e-9, 'Phosphat nach NaOH');
  await slot(page, 'HCl');
  bs = await beakers(page);
  near(bs[0].added, 0.05, 1e-12, 'Säurereihe unverändert erhalten');
  await click(page, '#btnCont');
  const c = await S(page, (A) => ({ kind: A.eng.current().kind, reagent: A.eng.current().reagent, start: A.eng.current().beakers[0].records[0].pH }));
  assert(c.kind === 'cont' && c.reagent === 'NaOH', 'Gegenprobe mit NaOH');
  assert(/Gegenprobe/.test(await page.locator('#chartTitle').innerText()), 'Diagrammtitel nennt die Gegenprobe');
  assert(/bereits mit HCl behandelten/.test(await page.locator('#seriesNote').innerText()), 'Hinweis: keine frischen Ansätze');
  await dose(page, 'd1'); await idle(page);
  bs = await beakers(page);
  assert(bs[0].event && bs[0].event.path === 'partner', 'Zeitlupe: H₃O⁺ + OH⁻ → 2 H₂O im angesäuerten Wasser');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Gegenprobe startet bei pH ${c.start.toFixed(2)}`;
});

// =========================================================== E04 Auflösung und Zeitlupe beider Richtungen
await scenario('E04', 'Protokoll Versuch 1 → Auflösung Phosphat; Zeitlupe beider Protonenübertragungen mit Zwischenzuständen und Bestandsänderung', async () => {
  const { page, errors, done } = await open();
  await skipPredict(page);
  await dose(page, 'd1'); await idle(page);
  await slot(page, 'NaOH'); await dose(page, 'd1'); await idle(page);
  assert(await page.locator('.pview.locked').count() === 1, 'Teilchenansicht des Wunderwassers vor der Deutung gesperrt');
  for (const v of ['a', 'b', 'c']) await page.locator(`#protoForm [name="q-o1"][value="${v}"]`).check();
  await page.locator('#protoForm [name="q-d1"][value="b"]').check();
  await click(page, '#protoForm button[type=submit]');
  assert(await page.locator('.pview.locked').count() === 0, 'nach der Deutung freigeschaltet');
  assert(/Phosphatpuffer/.test(await page.locator('.pview[data-i="1"] header').innerText()), 'Name aufgedeckt');
  assert((await page.locator('#protoForm fieldset[data-qid="o1"]').getAttribute('class')).includes('fb-right'), 'Beobachtung mit eigenen Messungen belegt und richtig');
  // Zeitlupe NaOH → Phosphat
  await target(page, '1'); await speed(page, '0.25');
  const before = await S(page, (A) => window.PF.particles.targetCounts(A.eng.current().beakers[1].shown.comp).counts);
  await dose(page, 'm5');
  await waitFor(page, (A) => { const b = A.eng.current().beakers[1]; return b.event && b.event.reagent === 'NaOH' && A.eng.state.time > b.event.t0 + 0.01 && b.added > 0.5; }, null, 60000);
  const ev = (await beakers(page))[1].event;
  assert(ev.path === 'weak' && ev.pair.sys === 'P' && ev.pair.k === 1, 'Weg: H₂PO₄⁻ + OH⁻ → HPO₄²⁻ + H₂O');
  const sigs = [];
  for (const [f, name] of [[0.25, '06-zeitlupe-annaeherung'], [0.5, '07-zeitlupe-protonenuebertragung'], [0.75, '08-zeitlupe-produkte']]) {
    await waitFor(page, (A, a) => A.eng.state.time >= a.t0 + a.dur * a.f, { t0: ev.t0, dur: ev.dur, f }, 60000);
    await speed(page, '0');
    sigs.push(await canvasSig(page, '.pview[data-i="1"] canvas'));
    const box = await page.locator('.pview[data-i="1"]').boundingBox();
    await shot(page, name, box);
    await speed(page, '0.25');
  }
  assert(new Set(sigs).size === 3, 'Zwischenzustände unterscheiden sich (tatsächliche Animation)');
  await speed(page, '1'); await idle(page);
  const after = await S(page, (A) => window.PF.particles.targetCounts(A.eng.current().beakers[1].shown.comp).counts);
  assert(after.HPO4 > before.HPO4 && after.H2PO4 < before.H2PO4 && after.HPO4 + after.H2PO4 + (after.H3PO4 || 0) + (after.PO4 || 0) === 24, `Bestand: HPO₄²⁻ ${before.HPO4}→${after.HPO4}, Gesamtzahl erhalten`);
  const pv = await S(page, (A) => window.PF.app.U.ui && document.querySelectorAll('.pview')[1].querySelector('.pbar').innerText);
  // Zeitlupe HCl → Phosphat (frische Säurereihe)
  await slot(page, 'HCl'); await target(page, '1');
  await dose(page, 'm5');
  await waitFor(page, (A) => { const b = A.eng.current().beakers[1]; return b.event && b.event.reagent === 'HCl' && b.added > 0.5; }, null, 60000);
  const ev2 = (await beakers(page))[1].event;
  assert(ev2.path === 'weak' && ev2.pair.k === 1, 'Weg: HPO₄²⁻ + H₃O⁺ → H₂PO₄⁻ + H₂O');
  await waitFor(page, (A, a) => A.eng.state.time >= a.t0 + a.dur * 0.5, { t0: ev2.t0, dur: ev2.dur }, 60000);
  await shot(page, '09-zeitlupe-saeure-phosphat', await page.locator('.pview[data-i="1"]').boundingBox());
  await idle(page);
  const vol = await S(page, (A) => A.eng.current().beakers[1].comp.V);
  near(vol, 35.05, 1e-9, 'Makrovolumen konsistent (30 + 0,05 + 5 mL)');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `HPO₄²⁻-Symbole ${before.HPO4} → ${after.HPO4} nach 5 mL NaOH; Balken „${pv.replace(/\s+/g, ' ')}“`;
});

// =========================================================== E05 Versuch 2
await scenario('E05', 'Versuch 2: Essigsäure, Natriumacetat, Gemisch – Säure- und Laugenreihe, gleiche Zugaben, passende Reaktionswege', async () => {
  const { page, errors, done } = await open();
  await exp(page, 'e2'); await predict(page, 'mix');
  await click(page, '#chkEvents'); // Reaktionsfolge anfangs aus …
  await dose(page, 'd1'); await idle(page);
  let bs = await beakers(page);
  assert(bs.every((b) => !b.event), 'Zeitlupe abschaltbar, Messung unverändert');
  await click(page, '#chkEvents'); // … und wieder an
  await dose(page, 'd1'); await idle(page);
  bs = await beakers(page);
  const recipes = [{ ha: 0.1, a: 0 }, { ha: 0, a: 0.1 }, { ha: 0.05, a: 0.05 }];
  for (let i = 0; i < 3; i++) near(bs[i].records[2].pH, await refPH(page, recipes[i], 'HCl', 0.1), 1e-9, `${bs[i].key} nach 0,10 mL HCl`);
  assert(bs[0].event.path === 'free' && bs[1].event.path === 'weak' && bs[2].event.path === 'weak', 'HCl: in Essigsäure bleibt H₃O⁺ überwiegend frei; Acetat und Gemisch setzen um');
  assert(bs.every((b) => Math.abs(b.added - 0.1) < 1e-12), 'gleiche Zugaben');
  await shot(page, '10-versuch2-saeure');
  await slot(page, 'NaOH'); await dose(page, 'd5'); await idle(page);
  bs = await beakers(page);
  for (let i = 0; i < 3; i++) near(bs[i].records[5].pH, await refPH(page, recipes[i], 'NaOH', 0.25), 1e-9, `${bs[i].key} nach 0,25 mL NaOH`);
  assert(bs[0].event.path === 'weak' && bs[1].event.path === 'free' && bs[2].event.path === 'weak', 'NaOH: Essigsäure und Gemisch setzen um, in Acetat bleibt OH⁻ frei');
  const d0 = bs.map((b) => b.records[0].pH);
  assert(d0[0] < 3 && Math.abs(d0[2] - 4.75) < 0.01 && d0[1] > 8.8, 'Anfangs-pH verschieden, nicht angeglichen');
  await shot(page, '11-versuch2-lauge');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Start ${d0.map((v) => v.toFixed(2)).join(' / ')}`;
});

// =========================================================== E06 Versuch 3 Kapazität und Verhältnis
await scenario('E06', 'Versuch 3: Weiterdosieren über die Reserve (kein NaN, kein Überlaufen), Ansatz ändern legt neuen Ansatz an, Kurve gezoomt', async () => {
  const { page, errors, done } = await open();
  await exp(page, 'e3'); await click(page, '#chkEvents');
  let full = false;
  for (let k = 0; k < 14 && !full; k++) {
    await dose(page, 'm5');
    if (/zu voll/.test(await toastText(page)) && !(await S(page, (A) => A.eng.busy()))) { full = true; break; }
    await idle(page);
  }
  const bs = await beakers(page);
  assert(full, 'Zugabe wird vor dem Überlaufen abgewiesen');
  for (const b of bs) {
    assert(b.V <= 95 + 1e-9, 'Volumen ≤ 95 mL');
    assert(b.records.every((p) => Number.isFinite(p.pH)), 'keine NaN');
    for (let i = 1; i < b.records.length; i++) assert(b.records[i].pH < b.records[i - 1].pH, 'pH sinkt monoton');
  }
  const r10 = bs[0].records;
  assert(r10[r10.length - 1].pH < 2, '10 : 1 nach Erschöpfung: Salzsäureüberschuss bestimmt den pH');
  await click(page, '#chkZoom');
  await shot(page, '12-versuch3-kapazitaet');
  await click(page, '#btnNewSeries');
  await page.locator('.pview[data-i="0"] select[data-ratio]').selectOption('r3_1');
  const k = await S(page, (A) => A.eng.current().beakers.map((b) => b.key));
  assert(k[0] === 'r3_1', 'Ansatz geändert → neuer Ansatz');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `${bs[0].records.length - 1} Zugaben bis zum vollen Glas; 10:1 endet bei pH ${r10[r10.length - 1].pH.toFixed(2)}`;
});

// =========================================================== E07 Versuch 4 Verdünnung
await scenario('E07', 'Versuch 4: gleiche Zugabe, zehnfach verdünnt hergestellt vs. aufgefüllt (400-mL-Glas)', async () => {
  const { page, errors, done } = await open();
  await exp(page, 'e4'); await click(page, '#chkEvents');
  await dose(page, 'm1'); await idle(page);
  const bs = await beakers(page);
  const d = bs.map((b) => b.records[0].pH - b.records[1].pH);
  near(bs[0].records[0].pH, bs[1].records[0].pH, 0.01, 'Anfangs-pH annähernd gleich');
  assert(d[1] > 10 * d[0], `0,010 mol/L ändert sich viel stärker (ΔpH ${d[1].toFixed(2)} vs ${d[0].toFixed(3)})`);
  near(d[2], d[0], 0.01, 'aufgefüllte Probe: gleiche Stoffmengen → fast gleiche Änderung');
  near(bs[2].V, 301, 1e-9, '300 mL + 1 mL');
  await shot(page, '13-versuch4-verduennung');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `ΔpH: ${d.map((v) => v.toFixed(3)).join(' / ')}`;
});

// =========================================================== E08 Schnellbedienung, Pause, Schritt
await scenario('E08', 'Doppelklick/Schnellbedienung ohne Doppeldosierung; Pause friert Tropfen ein; Schritt; Wechsel während Zugabe abgewiesen', async () => {
  const { page, errors, done } = await open();
  await skipPredict(page);
  await page.locator('#doses [data-dose="d1"]').dblclick();
  await page.locator('#doses [data-dose="d1"]').click({ force: true });
  await slot(page, 'NaOH');
  assert(await S(page, (A) => A.eng.state.slot) === 'HCl', 'Reihenwechsel während der Zugabe abgewiesen');
  await waitFor(page, (A) => A.eng.state.drops.length > 0);
  await speed(page, '0');
  const y0 = await S(page, (A) => ({ y: A.eng.state.drops[0].y, t: A.eng.state.time }));
  await sleep(800);
  const y1 = await S(page, (A) => ({ y: A.eng.state.drops[0].y, t: A.eng.state.time }));
  assert(y0.y === y1.y && y0.t === y1.t, 'Pause: Tropfen und Zeit stehen');
  await dose(page, 'd1');
  assert(/angehalten/.test(await toastText(page)), 'Dosieren in der Pause abgewiesen');
  await click(page, '#btnStep');
  const y2 = await S(page, (A) => A.eng.state.time);
  near(y2 - y1.t, 0.2, 1e-9, 'Schritt = 0,2 s Modellzeit');
  await speed(page, '1'); await idle(page);
  const log = await S(page, (A) => ({ n: A.eng.state.log.length, added: A.eng.current().beakers.map((b) => b.added) }));
  assert(log.n === 1 && log.added.every((v) => Math.abs(v - 0.05) < 1e-12), `genau eine Zugabe (${log.n})`);
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'eine Dosierung trotz Doppelklick + Klick';
});

// =========================================================== E09 Neuladen
await scenario('E09', 'Neuladen: Messreihen, Antworten, Auflösung und Einstellungen bleiben erhalten', async () => {
  const { page, errors, done } = await open();
  await predict(page, 'wasser');
  await dose(page, 'd1'); await idle(page);
  await page.locator('#protoForm [name="q-d1"][value="b"]').check();
  await page.locator('#protoForm textarea[data-free="f1"]').fill('Es braucht Säure und Base.');
  await click(page, '#protoForm button[type=submit]');
  await click(page, '#chkIndicator');
  await sleep(700);
  await page.reload(); await page.waitForFunction(() => window.PF && window.PF.app); await sleep(300);
  const st = await S(page, (A) => ({ rec: A.eng.current().beakers[0].records.length, rev: A.ui.revealed, ind: A.ui.indicator, free: A.ui.answers.e1.f1, busy: A.eng.busy() }));
  assert(st.rec === 2 && st.rev && !st.ind && st.free === 'Es braucht Säure und Base.' && !st.busy, JSON.stringify(st));
  assert(await page.locator('#protoForm textarea[data-free="f1"]').inputValue() === 'Es braucht Säure und Base.', 'Freitext wieder im Formular');
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'Zustand nach Neuladen identisch';
});

// =========================================================== E10 Herleitung
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
await scenario('E10', 'Herleitung: gesperrt vor der Deutung, Fehler mit Rückmeldung, Tipps, alle Schritte, danach pKₛ ± 1 im Diagramm', async () => {
  const { page, errors, done } = await open();
  await click(page, '#steps [data-page="theory"]');
  assert(await page.locator('.lockcard').count() === 1, 'vor der Deutung gesperrt');
  await click(page, '#steps [data-page="lab"]');
  await skipPredict(page);
  await page.locator('#protoForm [name="q-d1"][value="b"]').check();
  await click(page, '#protoForm button[type=submit]');
  await click(page, '#steps [data-page="theory"]');
  await shot(page, '14-herleitung');
  // falscher Ansatz in Schritt 1 → Rückmeldung, Tipp
  await setVal(page, '[data-f="t1:a"]', 'HA'); await setVal(page, '[data-f="t1:b"]', 'OH⁻');
  await click(page, '[data-th="check"][data-id="t1"]');
  assert(await page.locator('[data-step="t1"] .ffb.n').count() === 2, 'zwei Felder als falsch markiert');
  await click(page, '[data-th="tip"][data-id="t1"]');
  assert(/Tipp 1\/3/.test(await page.locator('[data-step="t1"] .tipbox').innerText()), 'Tipp 1/3');
  await doTheory(page);
  assert(await S(page, (A) => A.U.theoryDone()), 'alle sieben Schritte gelöst');
  // Stammlösungsfalle (Schritt 6) separat geprüft: Eingabe 2 → Hinweis n = c · V
  await shot(page, '15-herleitung-ergebnis');
  await click(page, '#steps [data-page="lab"]');
  assert(!(await page.locator('#chkPka').isDisabled()), 'pKₛ-Schalter freigeschaltet');
  await page.locator('#chkPka').check(); await exp(page, 'e2');
  await sleep(300);
  assert(await page.locator('.pfoot .formal').count() === 3, 'formale Stoffmengen und H-H-Vergleich sichtbar');
  await shot(page, '16-labor-nach-herleitung');
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'Schritte 1–7 geprüft';
});

// =========================================================== E11 Rechenaufgaben
await scenario('E11', 'Sechs Rechenaufgaben: Dezimalkomma, Einheiten, falscher Quotient, Stöchiometriefehler, Lösung erst nach Rückfrage', async () => {
  const { page, errors, done } = await open();
  await skipPredict(page);
  await page.locator('#protoForm [name="q-d1"][value="b"]').check(); await click(page, '#protoForm button[type=submit]');
  await doTheory(page);
  await click(page, '#steps [data-page="tasks"]');
  // Lösung vor Bearbeitung nur mit Rückfrage
  await click(page, '[data-tk="sol"][data-id="k1"]');
  assert(await page.locator('[data-tk="solYes"][data-id="k1"]').count() === 1, 'Rückfrage vor dem Rechenweg');
  await click(page, '[data-tk="solNo"][data-id="k1"]');
  assert(!(await page.locator('[data-task="k1"]').innerText()).includes('Rechenweg:'), 'kein Rechenweg ohne Bestätigung');
  // Fehlerfälle
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
  await shot(page, '17-aufgaben-rueckmeldung', await page.locator('[data-task="k4"]').boundingBox());
  // alle richtig
  const ans = [['k1:lo', '3,75'], ['k1:hi', '5,75'], ['k2:lo', '6,2'], ['k2:hi', '8,20'], ['k3:q', '2,0'], ['k4:n(CH₃COO⁻) nachher', '4,00'], ['k4:n(CH₃COOH) nachher', '0,006'], ['k4:pH', '4,57'], ['k5:q', '1,58'], ['k6:q', '20']];
  for (const [k, v] of ans) await setVal(page, `[data-f="${k}"]`, v);
  await setVal(page, '[data-u="k4:n(CH₃COO⁻) nachher"]', 'mmol'); await setVal(page, '[data-u="k4:n(CH₃COOH) nachher"]', 'mol');
  const right = await S(page, () => Object.fromEntries(window.PF.learn.TASKS.flatMap((t) => t.fields.filter((f) => f.type === 'radio').map((f) => [t.id + ':' + f.id, f.ok]))));
  for (const [k, v] of Object.entries(right)) await page.locator(`[data-f="${k}"][value="${v}"]`).check();
  for (const k of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']) await click(page, `[data-tk="check"][data-id="${k}"]`);
  const ok = await S(page, (A) => Object.fromEntries(['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((k) => [k, Object.values(A.ui.tasks[k].res).every((r) => r.ok)])));
  assert(Object.values(ok).every(Boolean), 'alle sechs Aufgaben richtig: ' + JSON.stringify(ok));
  await shot(page, '18-aufgaben-richtig');
  assert(await S(page, (A) => A.U.appsOpen()), 'Anwendungen freigeschaltet');
  assert(!errors.length, errors.join(' | '));
  await done();
  return 'Fehlerarten getrennt erkannt; alle sechs Aufgaben gelöst';
});

// =========================================================== E12 Anwendungen, Journal, Export
await scenario('E12', 'Anwendungen (vier Fälle), Journal ohne vorzeitige Lösungen, Export und Hefteintrag', async () => {
  const { page, errors, done } = await open();
  await predict(page, 'wasser');
  await dose(page, 'd1'); await idle(page);
  await tab(page, 'journal');
  const [dl] = await Promise.all([page.waitForEvent('download'), click(page, '#btnExport')]);
  const html = fs.readFileSync(await dl.path(), 'utf8');
  assert(/Vermutung/.test(html) && /Wasser: 7,00 → 3,78/.test(html), 'Journal enthält Vermutung und Messdaten');
  assert(!/Zutreffend: a, b, c/.test(html) && !/Lösung:/.test(html), 'keine Musterlösung im Export');
  await click(page, '#btnNotebook');
  const nb = await page.locator('.lk-notebook').innerText();
  const words = nb.split(/\s+/).length;
  assert(/Henderson-Hasselbalch/.test(nb) && words < 170, `Hefteintrag knapp (${words} Wörter)`);
  await shot(page, '19-hefteintrag');
  await click(page, '#steps [data-page="apps"]');
  assert(await page.locator('.lockcard').count() === 1, 'Anwendungen vor den Rechnungen gesperrt');
  await click(page, '[data-force="apps"]');
  for (const [q, v] of [['a1', 'a'], ['a2', 'b'], ['a3', 'b'], ['a4', 'a']]) { await page.locator(`[data-app-q="${q}"][value="${v}"]`).check(); await click(page, `[data-ap="check"][data-id="${q}"]`); }
  await page.locator('[data-app-q="a2"][value="c"]').check(); await click(page, '[data-ap="check"][data-id="a2"]');
  assert(/Gleicher pH bedeutet nicht gleiche Reserve/.test(await page.locator('[data-app="see"]').innerText()), 'Kapazitätsvergleich mit Rückmeldung');
  await shot(page, '20-anwendungen');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Hefteintrag ${words} Wörter`;
});

// =========================================================== E13 Tablet (Emulation)
for (const [W, H, id] of [[1180, 820, 'E13'], [1024, 768, 'E14']]) {
  await scenario(id, `Tablet quer ${W}×${H} (Emulation, Touch): kein Querscrollen, Labor und Teilchenansicht gleichzeitig sichtbar, Touchziele`, async () => {
    const { page, errors, done } = await open({ viewport: { width: W, height: H }, hasTouch: true });
    await exp(page, 'e2'); await skipPredict(page);
    await dose(page, 'd1', true); await idle(page);
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert(ov.sw <= ov.cw, `keine horizontale Überbreite (${ov.sw} > ${ov.cw})`);
    const lab = await page.locator('#lab').boundingBox(), pv = await page.locator('.pview').first().boundingBox();
    assert(lab.y + lab.height <= H && pv.y < H && pv.y + 60 < H, 'Labor und Teilchenansicht im sichtbaren Bereich');
    const small = await page.evaluate(() => [...document.querySelectorAll('#deck button, #expChips button, #slots button, .lk-tabs button, #steps button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.h < 40 || r.w < 40));
    assert(!small.length, 'Touchziele ≥ 40 px: ' + JSON.stringify(small));
    // Kurve über Scrollen der Bühne erreichbar, ohne das Experiment zurückzusetzen
    await page.locator('.chartbox').scrollIntoViewIfNeeded();
    const recs = await S(page, (A) => A.eng.current().beakers[0].records.length);
    assert(recs === 2, 'Experiment unverändert nach dem Scrollen');
    await page.evaluate(() => { document.querySelector('.labgrid').scrollTop = 0; });
    await shot(page, `${id === 'E13' ? '21' : '22'}-tablet-${W}x${H}`);
    if (id === 'E14') {
      await click(page, '#steps [data-page="theory"]', true); await click(page, '[data-force="theory"]', true);
      await shot(page, '23-tablet-herleitung');
      await click(page, '#steps [data-page="tasks"]', true); await click(page, '[data-force="tasks"]', true);
      const ovT = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      assert(ovT, 'Aufgabenseite ohne Querscrollen');
      await shot(page, '24-tablet-aufgaben');
    }
    assert(!errors.length, errors.join(' | '));
    await done();
    return 'Emulation (kein echtes iPad)';
  });
}

// =========================================================== E15 Tastatur und Trennlinie
await scenario('E15', 'Tastaturbedienung (Tab/Enter dosiert) und verschiebbare Trennlinie (Pfeiltasten, Doppelklick)', async () => {
  const { page, errors, done } = await open();
  await skipPredict(page);
  await page.locator('#doses [data-dose="d1"]').focus();
  await page.keyboard.press('Enter');
  await idle(page);
  assert((await beakers(page))[0].added === 0.05, 'Enter auf „1 Tropfen“ dosiert');
  const w0 = (await page.locator('#panel').boundingBox()).width;
  await page.locator('#splitter').focus(); await page.keyboard.press('ArrowLeft'); await sleep(100);
  const w1 = (await page.locator('#panel').boundingBox()).width;
  assert(Math.abs(w1 - w0 - 24) < 2, `Bedienfeld +24 px (${w0} → ${w1})`);
  await page.locator('#splitter').dblclick(); await sleep(100);
  const w2 = (await page.locator('#panel').boundingBox()).width;
  assert(Math.abs(w2 - w0) < 2, 'Doppelklick setzt zurück');
  assert(!errors.length, errors.join(' | '));
  await done();
  return `Bedienfeld ${w0} → ${w1} → ${w2} px`;
});

// =========================================================== Abschluss
const external = [...new Set(allRequests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:') && !u.startsWith('blob:')))];
results.push({ id: 'NET', title: 'Keine externen Anfragen', status: external.length ? 'FAIL' : 'PASS', detail: external.join(', ') || `${allRequests.length} Anfragen, alle lokal` });
results.push({ id: 'CON', title: 'Keine Konsolen- oder Seitenfehler', status: allErrors.length ? 'FAIL' : 'PASS', detail: allErrors.slice(0, 5).join(' | ') || 'keine' });
console.log(`${results.at(-2).status} NET – ${results.at(-2).detail}`);
console.log(`${results.at(-1).status} CON – ${results.at(-1).detail}`);
const out = { date: new Date().toISOString(), browser: `${browser.__channel} ${browser.version()}`, root: path.relative(APP, ROOT), results };
if (!ONLY) fs.writeFileSync(path.join(APP, 'tests/e2e/results.json'), JSON.stringify(out, null, 2));
await browser.close(); server.close();
const failed = results.filter((r) => r.status !== 'PASS');
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
