// Browserabnahme (Playwright + Edge): Szenarien E1–E9, Ergebnisse in tests/e2e/results.json,
// Screenshots und Bildfolgen in docs/screenshots/. Einzelne Szenarien: ONLY=E1,E4 node tests/e2e/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '../../scripts/serve.mjs';
import * as L from './lib.mjs';
import * as F from './flows.mjs';
const { S, sleep, assert, shot } = L;

const PORT = Number(process.env.PORT || 8141);
const BASE = process.env.BASE_URL || `http://localhost:${PORT}/`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ANIM = path.join(L.SHOTS, 'anim');
const results = [];
const srv = process.env.BASE_URL ? null : await serve(L.APP, PORT);
const browser = await L.launch();
console.log('Browser:', browser.__channel, browser.version());

async function scenario(id, title, fn, ctxOpts) {
  if (ONLY && !ONLY.includes(id)) return;
  const t0 = Date.now();
  const { context, page, errors, requests } = await L.newPage(browser, BASE, ctxOpts);
  let status = 'PASS', detail = '';
  try {
    detail = (await fn(page, context)) || '';
    const ext = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('file:'));
    assert(!ext.length, 'externe Anfragen: ' + ext.join(', '));
    assert(!errors.length, 'Fehler in der Konsole: ' + errors.join(' | '));
  } catch (e) {
    status = 'HOLD – failed'; detail = String(e && e.stack || e).split('\n').slice(0, 3).join(' ');
    try { await shot(page, `fail-${id}`); } catch (e2) { /* */ }
  }
  await context.close();
  const r = { id, title, status, detail: typeof detail === 'string' ? detail : JSON.stringify(detail), seconds: Math.round((Date.now() - t0) / 1000) };
  results.push(r);
  console.log(`${status === 'PASS' ? '✔' : '✖'} ${id} ${title} (${r.seconds} s) ${r.detail}`);
}

// ------------------------------------------------------------------ E1 Pflichtablauf (Maus)
await scenario('E1', 'Pflichtablauf: fünf Versuche, Beobachtung, Kontrolle mit Korrektur, Hefteintrag (Maus, 1440×900)', async (page) => {
  await shot(page, '01-start');
  await F.exp1(page); await shot(page, '02-v1-dekantiert');
  await F.exp2(page); await shot(page, '03-v2-filtriert');
  await F.exp3(page); await shot(page, '04-v3-eingedampft');
  await F.exp4(page); await shot(page, '05-v4-geschieden');
  await F.exp5(page); await shot(page, '06-v5-trennkette');
  const m = await F.quiz(page, '07-kontrolle');
  await F.notebook(page); await shot(page, '08-hefteintrag');
  await page.locator('.nb .figs').evaluate((el) => el.scrollIntoView({ block: 'start' })); await shot(page, '08b-hefteintrag-bilder');
  return `Kontrolle zuerst ${m.wrong} falsche Optionen und ${m.gw} falsche Lücken markiert, danach korrigiert`;
});

// ------------------------------------------------------------------ E2 Touch
await scenario('E2', 'Touch (Tablet 1180×820, hasTouch): Versuche 1, 3 und 4 vollständig per Antippen', async (page) => {
  await F.exp1(page, { touch: true });
  await F.exp3(page, { touch: true });
  await F.exp4(page, { touch: true });
  // Kopfzeilenschalter per Tipp
  await page.locator('#btnParticles').tap(); await page.locator('#btnNames').tap();
  const st = await page.evaluate(() => [document.querySelector('#btnParticles').getAttribute('aria-pressed'), document.querySelector('#btnNames').getAttribute('aria-pressed')]);
  assert(st[0] === 'true' && st[1] === 'false', 'Schalter per Tipp ' + st);
  await shot(page, '10-tablet-touch');
  return 'alle Handlungen über tap()';
}, { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });

// ------------------------------------------------------------------ E3 Tastatur
await scenario('E3', 'Tastatur: Geräte, Ziele, Gießen stoppen und Schalter ohne Maus', async (page) => {
  await L.exp(page, 1);
  const focusHit = async (id) => { await page.locator(`#hits [data-hit="${id}"]`).focus(); await page.keyboard.press('Enter'); await sleep(80); };
  await focusHit('rod'); await focusHit('A'); await L.idle(page);
  await focusHit('A');
  const tgt = page.locator('#deckSel [data-target="B"]');
  await tgt.focus(); await page.keyboard.press('Enter');
  await L.waitFor(page, (st) => st.op && st.op.phase === 'flow');
  await sleep(1500);
  await page.locator('#btnStopPour').focus(); await page.keyboard.press('Space');
  await L.idle(page);
  const b = await S(page, (st) => st.objs.B.c.water);
  assert(b > 2 && b < 20, 'gestoppt nach kurzer Zeit: ' + b);
  // Tab-Reihenfolge erreicht die Trefferflächen; sichtbarer Fokus
  await page.locator('#btnNames').focus(); await page.keyboard.press('Enter');
  assert((await page.locator('#btnNames').getAttribute('aria-pressed')) === 'false', 'Gerätenamen per Tastatur aus');
  await page.keyboard.press('Enter');
  await page.locator('#btnParticles').focus(); await page.keyboard.press('Space');
  assert((await page.locator('#btnParticles').getAttribute('aria-pressed')) === 'true', 'Teilchenmodell per Tastatur an');
  await page.locator('#hits [data-hit="C"]').focus();
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(ring !== 'none', 'Fokus sichtbar');
  await page.keyboard.press('Escape');
  await shot(page, '11-tastatur-fokus');
  return `gestoppt bei ${b.toFixed(1)} mL`;
});

// ------------------------------------------------------------------ E4 Korrekturen und Fehlhandlungen
await scenario('E4', 'Korrekturen: zu früh dekantiert, ohne Papier, ungelöstes Salz, verunreinigte Scheidefraktion, alternative Trennkette', async (page) => {
  const out = [];
  // zu früh dekantieren → trüb → absetzen → in C abgießen
  await L.exp(page, 1);
  await L.use(page, 'rod', 'A'); await L.idle(page);
  await L.pour(page, 'A', 'B', (st) => st.objs.A.c.water < 26, { speed: 'fast' });
  await page.locator('[data-a="check"]').click();
  const turb = await S(page, (st) => st.objs.B.c.sandC + st.objs.B.c.sandF);
  assert(turb > 0.3, 'trübes Dekantat ' + turb);
  assert((await page.locator('.crit .mk.n').count()) >= 1, 'Ergebnis prüfen nennt offenes Ziel');
  await shot(page, '20-v1-zu-frueh-trueb');
  await L.speed(page, 30); await sleep(4000); await L.speed(page, 1);
  await L.pour(page, 'B', 'C', (st) => st.objs.B.c.water < 12);
  assert(await S(page, (st, M) => M.evaluate(st).done), 'korrigiert');
  out.push(`trüb ${turb.toFixed(1)} g → korrigiert`);
  // ohne Papier filtrieren
  await L.exp(page, 2);
  await L.use(page, 'F', 'ring'); await L.idle(page);
  await L.use(page, 'E', 'under'); await L.idle(page);
  await L.use(page, 'rod', 'A'); await L.idle(page);
  await L.pour(page, 'A', 'F', null, { speed: 'fast' });
  await sleep(1500);
  const sandE = await S(page, (st) => st.objs.E.c.sandC + st.objs.E.c.sandF);
  assert(sandE > 1, 'Sand im Filtrat ohne Papier ' + sandE);
  const hm = await page.evaluate(() => document.querySelector('#hintbar').dataset.lastWarn || '');
  assert(hm.includes('Ohne Filterpapier'), 'Warnung im Hinweisbereich oberhalb der Bühne: ' + hm);
  await shot(page, '21-v2-ohne-papier');
  out.push(`ohne Papier ${sandE.toFixed(1)} g Sand im Kolben`);
  // V5 zu wenig Wasser → ungelöstes Salz im Filter → nachspülen
  await L.exp(page, 5);
  await L.use(page, 'mag', 'M'); await L.idle(page); await L.tapHit(page, 'U'); await L.idle(page);
  await L.tapHit(page, 'M'); await L.idle(page); await L.tapHit(page, 'U'); await L.idle(page); await L.tapHit(page, 'mag');
  await L.pour(page, 'M', 'A', null, { speed: 'fast' });
  await L.use(page, 'wash', 'A'); await L.idle(page);
  await L.use(page, 'paper', 'F'); await L.idle(page);
  await L.pour(page, 'A', 'F', null, { speed: 'fast' });
  if (!(await S(page, (st, M) => M.isEmpty(st.objs.A.c)))) await L.pour(page, 'A', 'F', null, { speed: 'fast' });
  await L.speed(page, 10); await sleep(2000); await L.speed(page, 1);
  const und = await S(page, (st) => st.objs.F.c.saltS);
  assert(und > 0.5, 'ungelöstes Salz im Rückstand ' + und);
  await page.locator('[data-a="check"]').click(); await page.locator('[data-a="tip"]').click(); await page.locator('[data-a="tip"]').click();
  const tip = await page.locator('.tipbox').innerText();
  assert(/ungelöste Salzkristalle|Spüle/.test(tip), 'Tipp 2/3 passt zum Zustand: ' + tip);
  await shot(page, '22-v5-ungeloestes-salz');
  await L.seg(page, '#washAmt', '20');
  for (let i = 0; i < 3; i++) { await L.use(page, 'wash', 'F'); await L.idle(page); await L.speed(page, 30); await sleep(1500); await L.speed(page, 1); }
  const after = await S(page, (st) => st.objs.F.c.saltS);
  assert(after < 0.05, 'nach dem Nachspülen gelöst ' + after);
  out.push(`ungelöst ${und.toFixed(1)} g → ${after.toFixed(2)} g`);
  // V4 zu spät geschlossen → Öl im Wasser → zurückgießen und erneut scheiden
  await L.exp(page, 4);
  await L.use(page, 'S', 'sepring'); await L.idle(page);
  await L.pour(page, 'A', 'S', null, { speed: 'fast' });
  await L.use(page, 'B', 'sepunder'); await L.idle(page);
  await L.seg(page, '#cock', '2');
  await L.waitFor(page, (st) => st.objs.S.c.oil < 40);
  await L.seg(page, '#cock', '0');
  const oilB = await S(page, (st) => st.objs.B.c.oil);
  assert(oilB > 5, 'Öl in der Wasserfraktion ' + oilB);
  await shot(page, '23-v4-zu-spaet-geschlossen');
  await L.use(page, 'B', 'pB'); await L.idle(page);
  await L.pour(page, 'B', 'S', null, { speed: 'fast' });
  await L.speed(page, 30); await sleep(2000); await L.speed(page, 1);
  await L.use(page, 'C', 'sepunder'); await L.idle(page);
  await L.seg(page, '#cock', '2'); await L.waitFor(page, (st) => st.objs.S.c.water < 5); await L.seg(page, '#cock', '1'); await L.waitFor(page, (st) => st.objs.S.c.water < 0.4); await L.seg(page, '#cock', '0');
  await L.use(page, 'C', 'pC'); await L.idle(page);
  await L.use(page, 'B', 'sepunder'); await L.idle(page);
  await L.seg(page, '#cock', '2'); await L.waitFor(page, (st, M) => M.liq(st.objs.S.c) < 0.02);
  const ev4 = await S(page, (st, M) => M.evaluate(st));
  assert(ev4.criteria.find((c) => c.id === 'water').ok && ev4.criteria.find((c) => c.id === 'oil').ok, 'nach erneutem Scheiden saubere Fraktionen ' + JSON.stringify(ev4));
  out.push(`Öl im Wasser ${oilB.toFixed(0)} mL → neu geschieden`);
  // V5 alternative Reihenfolge in neuem Ansatz
  await page.locator('#btnRestart').click(); await page.locator('#rsYes').click(); await sleep(200);
  await L.exp(page, 5);
  await page.locator('#btnRestart').click(); await page.locator('#rsYes').click(); await sleep(200);
  await L.pour(page, 'M', 'A', null, { speed: 'fast' });
  await L.seg(page, '#washAmt', '20');
  for (let i = 0; i < 2; i++) { await L.use(page, 'wash', 'A'); await L.idle(page); }
  await L.use(page, 'rod', 'A'); await L.idle(page);
  await L.use(page, 'paper', 'F'); await L.idle(page);
  for (let i = 0; i < 6; i++) {
    if (await S(page, (st) => st.objs.A.c.water < 0.2)) break;
    await L.use(page, 'rod', 'A'); await L.idle(page);
    await L.pour(page, 'A', 'F', null, { speed: 'fast' });
    await L.speed(page, 10); await L.waitFor(page, (st) => st.objs.F.c.water < 8); await L.speed(page, 1);
  }
  await L.seg(page, '#washAmt', '5');
  for (let i = 0; i < 2; i++) { await L.use(page, 'wash', 'F'); await L.idle(page); await L.speed(page, 30); await L.waitFor(page, (st) => st.drip.F < 0.01); await L.speed(page, 1); }
  await L.use(page, 'mag', 'F'); await L.idle(page); await L.tapHit(page, 'U'); await L.idle(page);
  for (let i = 0; i < 3; i++) { await L.tapHit(page, 'F'); await L.idle(page); await L.tapHit(page, 'U'); await L.idle(page); }
  await L.tapHit(page, 'mag');
  await L.pour(page, 'E', 'D', null, { speed: 'fast' });
  await L.seg(page, '#heatLevel', '2'); await L.speed(page, 30); await L.waitFor(page, (st) => st.objs.D.c.water < 2.5); await L.seg(page, '#heatLevel', '0'); await L.waitFor(page, (st) => st.objs.D.c.water < 0.5); await L.speed(page, 1);
  const ev5 = await S(page, (st, M) => M.evaluate(st));
  assert(ev5.done, 'alternative Reihenfolge erreicht alle Ziele ' + JSON.stringify(ev5.criteria));
  await shot(page, '24-v5-alternative-reihenfolge');
  out.push('alternative Reihenfolge erfolgreich');
  return out.join('; ');
});

// ------------------------------------------------------------------ E5 Speicherung
await scenario('E5', 'Speicherung: Notizen/Antworten über Fehler, Panel-, Aufgaben-, Ansichtswechsel und Neuladen; Neustart nur des gewählten Versuchs', async (page) => {
  await L.exp(page, 1);
  await L.use(page, 'rod', 'A'); await L.idle(page);
  await page.locator('textarea[data-f="obs"]').fill('Zwischenstand: trüb');
  await page.locator('[data-a="snap"]').click();
  await page.locator('textarea[data-f="obs"]').fill('Entwurf, noch nicht gespeichert');
  await page.locator('textarea[data-f="expl"]').fill('Erklärungsentwurf');
  await page.locator('input[name="hom"][value="hom"]').check();
  await page.locator('[data-a="grade"]').click();
  assert((await page.locator('.lk-opt.wrong').count()) >= 1, 'falsche Einordnung markiert');
  assert((await page.locator('textarea[data-f="obs"]').inputValue()) === 'Entwurf, noch nicht gespeichert', 'Entwurf nach Prüfen erhalten');
  await page.locator('#tab-quiz').click(); await page.locator('#tab-exp').click();
  await L.exp(page, 2); await L.use(page, 'rod', 'A'); await L.idle(page);
  await page.locator('#btnParticles').click(); await page.locator('#btnNames').click();
  await L.exp(page, 1);
  assert((await page.locator('textarea[data-f="expl"]').inputValue()) === 'Erklärungsentwurf', 'nach Aufgabenwechsel erhalten');
  const before = await S(page, (st) => st.t);
  await page.evaluate(() => window.TV.app.saveNow());
  await page.reload(); await page.waitForFunction(() => window.TV && window.TV.app); await sleep(300);
  const r = await page.evaluate(() => ({ obs: document.querySelector('textarea[data-f="obs"]').value, snaps: window.TV.app.notes[1].snaps.length, hom: window.TV.app.notes[1].cls.hom, p: window.TV.app.ui.particles, n: window.TV.app.ui.names, t: window.TV.app.engine.state.t, v2t: window.TV.app.notes[2] && 1 }));
  assert(r.obs === 'Entwurf, noch nicht gespeichert' && r.snaps === 1 && r.hom === 'hom', 'nach Neuladen erhalten ' + JSON.stringify(r));
  assert(r.p === true && r.n === false, 'Schalterzustände nach Neuladen');
  assert(r.t >= before - 0.5, 'Versuchszustand nach Neuladen');
  // Neustart von Versuch 2 lässt Versuch 1 unberührt
  await L.exp(page, 2);
  await page.locator('#btnRestart').click(); await page.locator('#rsYes').click(); await sleep(200);
  await L.exp(page, 1);
  const v1 = await S(page, (st, M, app) => ({ snaps: app.notes[1].snaps.length, t: st.t }));
  assert(v1.snaps === 1 && v1.t > 1, 'Versuch 1 unverändert ' + JSON.stringify(v1));
  await page.locator('#btnRestart').click(); await page.locator('#rsYes').click(); await sleep(200);
  const v1b = await S(page, (st, M, app) => ({ snaps: app.notes[1].snaps.length, ansatz: app.notes[1].ansatz, t: st.t, obs: app.notes[1].obs }));
  assert(v1b.snaps === 1 && v1b.ansatz === 2 && v1b.t < 1 && v1b.obs, 'Neustart: neuer Ansatz, Notizen bleiben ' + JSON.stringify(v1b));
  await shot(page, '30-speicherung-neuer-ansatz');
  return JSON.stringify(v1b);
});

// ------------------------------------------------------------------ E6 Layout
async function layoutCheck(page, tag) {
  const r = await page.evaluate(() => {
    const box = (s) => { const e = document.querySelector(s); if (!e || e.hidden || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom }; };
    const over = (a, b) => a && b && a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
    const hint = box('#hintbar'), canvas = box('#lab'), names = box('#names'), pv = box('#pview'), deck = box('#deck'), head = box('.lk-head');
    const labels = [...document.querySelectorAll('#names .nm')].map((e) => { const b = e.getBoundingClientRect(); return { t: e.className, x: b.left, r: b.right, y: b.top, b: b.bottom }; });
    let labelOverlap = 0;
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (over(labels[i], labels[j])) labelOverlap++;
    const headBtns = [...document.querySelectorAll('.lk-head button')].map((e) => e.getBoundingClientRect()).filter((b) => b.right > innerWidth + 1 || b.height < 30).length;
    const small = [...document.querySelectorAll('#deck button, .hit, .lk-tabs button, .taskchips button')].filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect()).filter((b) => b.width < 43.5 || b.height < 43.5).length;
    return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, hintAbove: hint && canvas ? hint.b <= canvas.y + 1 : false, namesBelow: names ? names.y >= canvas.b - 1 : true,
      pvOverlap: over(pv, canvas), deckOverlap: over(deck, canvas), labelOverlap, headBtns, small, headH: head.b - head.y };
  });
  assert(r.scrollW <= r.innerW, `${tag}: horizontale Überbreite ${r.scrollW} > ${r.innerW}`);
  assert(r.hintAbove, `${tag}: Hinweisbereich oberhalb der Bühne`);
  assert(r.namesBelow && !r.pvOverlap && !r.deckOverlap, `${tag}: Bereiche überlappen ` + JSON.stringify(r));
  assert(r.labelOverlap === 0, `${tag}: Namensfelder überlappen (${r.labelOverlap})`);
  assert(r.headBtns === 0, `${tag}: Kopfzeile nicht vollständig bedienbar`);
  assert(r.small === 0, `${tag}: ${r.small} Bedienelemente kleiner als 44 px`);
  return r;
}
for (const [w, h] of [[1024, 768], [1180, 820], [1920, 1080]]) {
  await scenario(`E6-${w}`, `Layout ${w}×${h}: alle Versuche, Schalter einzeln und kombiniert, lange Meldung`, async (page) => {
    const notes = [];
    for (const n of [1, 2, 3, 4, 5]) {
      await L.exp(page, n);
      for (const [p, nm] of [[false, true], [true, true], [true, false], [false, false]]) {
        const cur = await page.evaluate(() => [window.TV.app.ui.particles, window.TV.app.ui.names]);
        if (cur[0] !== p) await page.locator('#btnParticles').click();
        if (cur[1] !== nm) await page.locator('#btnNames').click();
        await sleep(150);
        await layoutCheck(page, `V${n} T=${p} N=${nm}`);
        if (p && nm) await shot(page, `40-layout-${w}x${h}-v${n}-beide`);
      }
      if (n === 1) await shot(page, `40-layout-${w}x${h}-v1`);
    }
    // lange Rückmeldung (Spritzwarnung) im Hinweisbereich, ohne Überdeckung
    await L.exp(page, 3);
    await L.pour(page, 'A', 'D', null, { speed: 'fast' });
    await L.seg(page, '#heatLevel', '2'); await L.speed(page, 30);
    await L.waitFor(page, (st) => st.warned.spatter != null);
    await L.speed(page, 1);
    const hm = await page.evaluate(() => { const e = document.querySelector('#hintMsg'); return { text: e.textContent, clipped: e.scrollHeight > e.clientHeight + 1, title: e.title }; });
    assert(/spritzen/.test(hm.text), 'lange Meldung angezeigt');
    await layoutCheck(page, 'lange Meldung');
    await L.seg(page, '#heatLevel', '0');
    await shot(page, `41-lange-meldung-${w}x${h}`);
    notes.push(hm.clipped ? 'lange Meldung auf zwei Zeilen gekürzt, Volltext im title' : 'lange Meldung vollständig');
    return notes.join('; ');
  }, { viewport: { width: w, height: h } });
}

// ------------------------------------------------------------------ E7 Animation (Bildfolgen)
await scenario('E7', 'Animation: Gießen, Wellen, Sedimentation, Tropfen, Phasentrennung, Lösen, Kristallbildung als Bildfolgen', async (page) => {
  fs.mkdirSync(ANIM, { recursive: true });
  const out = [];
  const frames = async (name, clipBox, n, gap, measure) => {
    const clip = await L.worldClip(page, clipBox, 6);
    const data = [];
    let prev = null, changed = 0;
    for (let i = 0; i < n; i++) {
      const buf = await L.grab(page, clip);
      fs.writeFileSync(path.join(ANIM, `${name}-${String(i).padStart(2, '0')}.png`), buf);
      if (prev && !buf.equals(prev)) changed++;
      prev = buf;
      if (measure) data.push(await S(page, measure));
      await sleep(gap);
    }
    return { changed, data };
  };
  const mono = (arr, dir, k) => arr.every((v, i) => i === 0 || (dir > 0 ? v[k] >= arr[i - 1][k] - 1e-6 : v[k] <= arr[i - 1][k] + 1e-6));
  // Gießen V1: Quelle verliert, Ziel gewinnt im selben Transfer
  await L.exp(page, 1);
  await L.use(page, 'rod', 'A');
  const stir = await frames('v1-ruehren', { x0: 20, x1: 220, y0: 300, y1: 530 }, 5, 400, (st) => ({ s: st.objs.A.susp.sandC.m + st.objs.A.susp.sandF.m }));
  await L.idle(page);
  const sed = await frames('v1-sedimentation', { x0: 20, x1: 220, y0: 300, y1: 530 }, 8, 700, (st) => ({ s: st.objs.A.susp.sandC.m + st.objs.A.susp.sandF.m, front: st.objs.A.susp.sandC.fv }));
  assert(mono(sed.data, -1, 's') && sed.data[0].s > sed.data[sed.data.length - 1].s + 3 && sed.changed >= 5, 'Sedimentation sichtbar und monoton ' + JSON.stringify(sed.data));
  out.push(`Sedimentation ${sed.data[0].s.toFixed(1)}→${sed.data.at(-1).s.toFixed(1)} g schwebend`);
  await L.speed(page, 30); await sleep(3500); await L.speed(page, 1);
  await L.tapHit(page, 'A'); await L.tapHit(page, 'B');
  await L.waitFor(page, (st) => st.op && st.op.phase === 'flow');
  const pourF = await frames('v1-giessen', { x0: 20, x1: 640, y0: 230, y1: 530 }, 10, 350, (st) => ({ a: st.objs.A.c.water, b: st.objs.B.c.water, sum: st.objs.A.c.water + st.objs.B.c.water + st.lost.evaporated.water }));
  assert(mono(pourF.data, -1, 'a') && mono(pourF.data, 1, 'b') && pourF.data.at(-1).b > pourF.data[0].b + 5, 'Quelle sinkt, Ziel steigt ' + JSON.stringify(pourF.data));
  assert(pourF.data.every((d) => Math.abs(d.sum - pourF.data[0].sum) < 1e-6), 'Summe erhalten (inkl. Verdunstung) ' + JSON.stringify(pourF.data.map((d) => d.sum)));
  const waves = await page.evaluate(() => { const v = window.TV.app.renderer.vis.B; return Math.max(...Array.from(v.h).map(Math.abs)); });
  assert(waves > 0.05, 'Auftreffen regt Wellen an ' + waves);
  await L.stopPour(page); await L.idle(page);
  await sleep(4000);
  const calm = await page.evaluate(() => { const v = window.TV.app.renderer.vis.B; return Math.max(...Array.from(v.h).map(Math.abs)); });
  assert(calm < waves * 0.3, `Wellen klingen ab (${waves.toFixed(2)} → ${calm.toFixed(3)})`);
  out.push(`Gießen A ${pourF.data[0].a.toFixed(0)}→${pourF.data.at(-1).a.toFixed(0)} mL, B ${pourF.data[0].b.toFixed(0)}→${pourF.data.at(-1).b.toFixed(0)} mL; Wellen ${waves.toFixed(2)}→${calm.toFixed(3)}`);
  // Tropfen V2
  await L.exp(page, 2);
  await L.use(page, 'paper', 'F'); await L.idle(page); await L.use(page, 'F', 'ring'); await L.idle(page); await L.use(page, 'E', 'under'); await L.idle(page);
  await L.use(page, 'rod', 'A'); await L.idle(page);
  await L.pour(page, 'A', 'F', null, { speed: 'fast' });
  const drip = await frames('v2-tropfen', { x0: 380, x1: 560, y0: 180, y1: 520 }, 10, 250, (st) => ({ e: st.objs.E.c.water, f: st.objs.F.c.water, drops: window.TV.app.renderer.vis.F ? 1 : 0 }));
  assert(mono(drip.data, 1, 'e') && drip.data.at(-1).e > drip.data[0].e && drip.changed >= 7, 'Filtrat tropft ' + JSON.stringify(drip.data));
  out.push(`Filtrat ${drip.data[0].e.toFixed(1)}→${drip.data.at(-1).e.toFixed(1)} mL in ${drip.changed} veränderten Bildern`);
  // Phasentrennung V4
  await L.exp(page, 4);
  await L.use(page, 'S', 'sepring'); await L.idle(page);
  await L.pour(page, 'A', 'S', null, { speed: 'fast' });
  await page.locator('#btnStopper').click(); await page.locator('#btnShake').click();
  await frames('v4-schuetteln', { x0: 500, x1: 740, y0: 60, y1: 420 }, 6, 450);
  await L.idle(page);
  const sep = await frames('v4-entmischen', { x0: 500, x1: 740, y0: 60, y1: 420 }, 10, 1300, (st) => ({ em: st.objs.S.emul }));
  assert(mono(sep.data, -1, 'em') && sep.data[0].em > 0.6 && sep.data.at(-1).em < 0.4, 'Entmischung ' + JSON.stringify(sep.data));
  out.push(`Emulsion ${sep.data[0].em.toFixed(2)}→${sep.data.at(-1).em.toFixed(2)}`);
  // Lösen V5 (Extraktion) und Kristallbildung V3
  await L.exp(page, 5);
  await L.pour(page, 'M', 'A', null, { speed: 'fast' });
  await L.seg(page, '#washAmt', '20');
  await L.use(page, 'wash', 'A'); await L.idle(page); await L.use(page, 'wash', 'A'); await L.idle(page);
  await L.use(page, 'rod', 'A');
  const dis = await frames('v5-loesen', { x0: 340, x1: 470, y0: 330, y1: 530 }, 6, 450, (st) => ({ s: st.objs.A.c.saltS, d: st.objs.A.c.saltD }));
  assert(mono(dis.data, -1, 's') && dis.data[0].s > dis.data.at(-1).s, 'Salz löst sich ' + JSON.stringify(dis.data));
  out.push(`Lösen ${dis.data[0].s.toFixed(2)}→${dis.data.at(-1).s.toFixed(2)} g fest`);
  await L.exp(page, 3);
  await L.pour(page, 'A', 'D', null, { speed: 'fast' });
  await L.seg(page, '#heatLevel', '2'); await L.speed(page, 30);
  await L.waitFor(page, (st) => st.objs.D.c.water < 22);
  const cr = await frames('v3-kristalle', { x0: 290, x1: 470, y0: 330, y1: 520 }, 8, 900, (st) => ({ w: st.objs.D.c.water, s: st.objs.D.c.saltS, T: st.objs.D.temp, boil: st.objs.D.boil }));
  await L.speed(page, 1);
  assert(mono(cr.data, -1, 'w') && mono(cr.data, 1, 's') && cr.data.at(-1).s > cr.data[0].s + 1, 'Kristalle wachsen ' + JSON.stringify(cr.data));
  out.push(`Eindampfen Wasser ${cr.data[0].w.toFixed(1)}→${cr.data.at(-1).w.toFixed(1)} mL, Kristalle ${cr.data[0].s.toFixed(1)}→${cr.data.at(-1).s.toFixed(1)} g`);
  return out.join('; ');
}, { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });

// ------------------------------------------------------------------ E8 Teilchenmodell
await scenario('E8', 'Teilchenmodell: Gefäßbezug, Legende, Pause hält beide Darstellungen an, Umschalten ändert keine Mengen', async (page) => {
  const out = [];
  await L.exp(page, 3);
  await page.locator('#speed [data-speed="0"]').click(); await sleep(100);
  const before = await page.evaluate(() => JSON.stringify(window.TV.app.engine.state.objs));
  await page.locator('#btnParticles').click(); await sleep(200);
  await page.locator('#btnParticles').click(); await sleep(200);
  await page.locator('#btnParticles').click(); await sleep(200);
  assert(before === await page.evaluate(() => JSON.stringify(window.TV.app.engine.state.objs)), 'Umschalten ändert den Zustand nicht');
  await L.speed(page, 1);
  await L.tapHit(page, 'A'); await L.tapHit(page, 'A');
  const leg = await page.evaluate(() => [document.querySelector('#pFocus').textContent, document.querySelector('#pLegend').innerText, document.querySelector('#pModel').textContent]);
  assert(/Becherglas A/.test(leg[0]) && /Na⁺/.test(leg[1]) && /Cl⁻/.test(leg[1]) && /kein eigener Aggregatzustand/.test(leg[2]), 'Lösung: Ionen in der Legende ' + JSON.stringify(leg));
  await shot(page, '50-teilchen-loesung');
  // Pause: Makro- und Teilchenansicht stehen still
  await L.pour(page, 'A', 'D', null, { speed: 'fast' });
  await L.tapHit(page, 'D'); await L.tapHit(page, 'D');
  await L.seg(page, '#heatLevel', '2'); await L.speed(page, 30);
  await L.waitFor(page, (st) => st.objs.D.boil);
  await L.speed(page, 0); await sleep(300);
  const pc = await page.locator('#pcanvas').boundingBox();
  const lab = await L.worldClip(page, { x0: 290, x1: 470, y0: 200, y1: 520 });
  const a1 = await L.grab(page, pc), b1 = await L.grab(page, lab), t1 = await S(page, (st) => st.t);
  await sleep(1200);
  const a2 = await L.grab(page, pc), b2 = await L.grab(page, lab), t2 = await S(page, (st) => st.t);
  assert(a1.equals(a2) && b1.equals(b2) && t1 === t2, 'Pause hält beide Darstellungen an');
  await L.speed(page, 1); await sleep(800);
  const a3 = await L.grab(page, pc);
  assert(!a3.equals(a2), 'nach der Pause bewegen sich die Teilchen wieder');
  await shot(page, '51-teilchen-eindampfen');
  out.push('Pause synchron');
  // Filter und Emulsion
  await L.exp(page, 2);
  await L.use(page, 'paper', 'F'); await L.idle(page); await L.use(page, 'F', 'ring'); await L.idle(page); await L.use(page, 'E', 'under'); await L.idle(page);
  await L.use(page, 'rod', 'A'); await L.idle(page);
  await L.pour(page, 'A', 'F', null, { speed: 'fast' });
  await page.locator('#pSelect').selectOption('F'); await sleep(900);
  const ft = await page.locator('#pModel').textContent();
  assert(/Poren/.test(ft), 'Filtertext ' + ft);
  await shot(page, '52-teilchen-filter');
  await L.exp(page, 4);
  await L.use(page, 'S', 'sepring'); await L.idle(page);
  await L.pour(page, 'A', 'S', null, { speed: 'fast' });
  await page.locator('#btnStopper').click(); await page.locator('#btnShake').click(); await L.idle(page);
  await page.locator('#pSelect').selectOption('S'); await sleep(600);
  assert(/Tröpfchen/.test(await page.locator('#pModel').textContent()), 'Emulsion im Teilchentext');
  await shot(page, '53-teilchen-emulsion');
  // Schalter bleibt über Aufgaben- und Reiterwechsel erhalten
  await page.locator('#tab-notebook').click(); await L.exp(page, 1);
  assert(await page.evaluate(() => window.TV.app.ui.particles && !document.querySelector('#pview').hidden), 'Teilchenmodell bleibt an');
  out.push('Filter, Emulsion, Lösung dargestellt');
  return out.join('; ');
}, { viewport: { width: 1440, height: 900 } });

// ------------------------------------------------------------------ Abschluss
await browser.close();
if (srv) srv.close();
const file = path.join(L.HERE, process.env.RESULTS || 'results.json');
fs.writeFileSync(file, JSON.stringify({ date: new Date().toISOString(), browser: browser.__channel, results }, null, 2));
const failed = results.filter((r) => r.status !== 'PASS');
console.log(`\n${results.length - failed.length}/${results.length} Szenarien PASS`);
process.exit(failed.length ? 1 : 0);
