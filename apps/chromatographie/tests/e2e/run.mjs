// End-to-End-Prüfung der Papierchromatographie im echten Browser (Edge/Chromium über Playwright).
// Bedient ausschließlich die gerenderte Oberfläche (Klicks, Tipps, Tastatur, Ziehen an der
// Trennlinie). Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen – nie gesetzt.
// Aufruf: npm run build && node tests/e2e/run.mjs   (ONLY=E01,E05 für einzelne Szenarien)
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '../../scripts/serve.mjs';
import { APP, SHOTS, launch, newPage, S, idle, waitFor, tapHit, clickAct, speed, prepare, develop, takeOut, shot, sleep, assert } from './lib.mjs';

const ROOT = process.env.E2E_ROOT ? path.resolve(process.env.E2E_ROOT) : path.join(APP, 'dist/chromatographie');
const PORT = Number(process.env.E2E_PORT || 8141);
const BASE = `http://localhost:${PORT}/index.html`;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const results = [];
const allRequests = [];
const allErrors = [];

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
  o.page.on('request', (r) => allRequests.push(r.url()));
  o.done = async () => { allErrors.push(...o.errors); await o.context.close(); };
  return o;
}
const panelText = (page) => page.locator('#panelBody').innerText();
const zonesOf = (page, lane) => S(page, (st, M, T, l) => M.zones(st.paper, l).map((z) => ({ s: +z.s.toFixed(3), color: z.color, atStart: z.atStart, comps: z.comps })), lane);
async function check(page) { await page.locator('#btnCheck').click(); return S(page, (st, M, T) => null); }
async function choose(page, qid, value) { await page.locator(`#protoForm [name="q-${qid}"][value="${value}"]`).check(); }
async function fill(page, qid, text) { await page.locator(`#protoForm [name="q-${qid}"]`).fill(text); }
async function task(page, id) { await page.locator(`.taskchips [data-task="${id}"]`).click(); }

// =========================================================== E01 Strecke 1
await scenario('E01', 'Schwarzer Stift mit Wasser: Vorbereitung, Fleck, Entwicklung in vier Ständen, drei Zonen, Auswertung', async () => {
  const { page, errors, done } = await open();
  await shot(page, '01-leere-kammer');
  await speed(page, 10);
  await tapHit(page, 'pencil');
  await sleep(450); await shot(page, '02-startlinie-wird-gezogen');
  await idle(page);
  await tapHit(page, 'pen:schwarz');
  await page.locator('[data-hit="lane:0"]').click();
  await sleep(420); await shot(page, '03-probenauftrag-stift-tupft');
  await idle(page);
  assert((await S(page, (st) => st.paper.lanes[0] && st.paper.lanes[0].n)) === 1, 'Fleck auf Punkt 1');
  await tapHit(page, 'pen:schwarz');
  await tapHit(page, 'pen:blau'); await tapHit(page, 'lane:1'); await tapHit(page, 'pen:blau');
  await tapHit(page, 'pen:gelb'); await tapHit(page, 'lane:2'); await tapHit(page, 'pen:gelb');
  await shot(page, '04-papier-vorbereitet');
  await tapHit(page, 'bottle:water');
  await sleep(900); await shot(page, '05-laufmittel-wird-eingegossen');
  await idle(page);
  await tapHit(page, 'chamber');
  await sleep(700); await shot(page, '06-papier-wird-eingehaengt');
  await idle(page);
  await speed(page, 30);
  // Front und Zonen kontinuierlich: Messreihe und vier Fortschrittsstände
  const series = [];
  const marks = [[1.0, '07-front-frueh'], [3.5, '08-front-mittel'], [7, '09-front-spaet'], [10, '10-front-weit-oben']];
  for (const [run, name] of marks) {
    await waitFor(page, (st, M, r) => st.paper.front >= M.PAPER.lineY + r, run);
    await speed(page, 0);
    series.push(await S(page, (st, M) => ({ t: st.time, front: st.paper.front, ys: M.bands(st.paper).filter((b) => b.lane === 0 && b.moving).map((b) => b.y) })));
    await shot(page, name);
    await speed(page, 30);
  }
  // feinere Messreihe zwischen den Ständen
  const fine = [];
  for (let i = 0; i < 12; i++) { fine.push(await S(page, (st) => st.paper.front)); await sleep(150); }
  for (let i = 1; i < series.length; i++) {
    assert(series[i].front > series[i - 1].front, 'Front steigt');
    series[i].ys.forEach((y, k) => assert(y > series[i - 1].ys[k], 'Zonen steigen'));
  }
  for (let i = 1; i < fine.length; i++) assert(fine[i] >= fine[i - 1] && fine[i] - fine[i - 1] < 0.4, 'keine Sprünge der Front');
  assert(series[0].ys.length === 3 && new Set(series[1].ys.map((y) => y.toFixed(2))).size === 3, 'drei Komponenten wandern verschieden schnell');
  await takeOut(page);
  await sleep(300);
  await shot(page, '11-endbild-chromatogramm');
  const z = await zonesOf(page, 0);
  assert(z.length === 3, 'drei Zonen: ' + JSON.stringify(z));
  // Auswertung: erst teilweise falsch, dann korrigieren
  await page.locator('#btnCheck').click();
  assert(/Ergebnis belegt/.test(await panelText(page)), 'Ergebnis belegt');
  await choose(page, 'count', '2');
  await choose(page, 'obs', 'sep');
  await choose(page, 'result', 'mix');
  await choose(page, 'why', 'abs');
  await fill(page, 'gap', 'mobile');
  await choose(page, 'limit', 'proof');
  await page.locator('#btnGrade').click();
  const txt1 = await panelText(page);
  assert(/1 von 6 Antworten richtig/.test(txt1), 'Teilbewertung: ' + txt1.slice(0, 400));
  assert((await page.locator('#protoForm .lk-fb.n').count()) === 5, 'fünf Felder als falsch markiert');
  await shot(page, '12-protokoll-teilweise-richtig');
  assert(await page.locator('#protoForm [name="q-result"][value="mix"]').isChecked(), 'richtige Eingabe bleibt erhalten');
  await choose(page, 'count', '3');
  await page.locator('#protoForm [name="q-obs"][value="match"]').check();
  await page.locator('#protoForm [name="q-obs"][value="ref1"]').check();
  await choose(page, 'why', 'ads');
  await fill(page, 'gap', 'stationaere');
  await choose(page, 'limit', 'noproof');
  await page.locator('#btnGrade').click();
  assert(/Alles richtig ausgewertet/.test(await panelText(page)), 'alles richtig');
  await shot(page, '13-protokoll-alles-richtig');
  assert(!errors.length, errors.join('; '));
  await done();
  return `Front ${series.map((s) => s.front.toFixed(1)).join(' → ')} cm; Zonen Schwarz s = ${z.map((x) => x.s.toFixed(2)).join(' / ')} cm (${z.map((x) => x.color).join(', ')})`;
});

// =========================================================== E02 Strecke 2
await scenario('E02', 'Grün, Violett, Blau-Referenz: gemeinsamer blauer Bestandteil über relative Laufstrecke; Ethanol-Wasser trennt nicht', async () => {
  const { page, errors, done } = await open();
  await task(page, 'B');
  await speed(page, 30);
  await prepare(page, { samples: ['gruen', 'violett', 'blau'], solvent: 'etoh' });
  await develop(page, 7);
  await takeOut(page);
  await page.locator('#btnCheck').click();
  const t1 = await panelText(page);
  assert(/Noch nicht belegt/.test(t1) && /Grün zeigt nur eine Zone/.test(t1), 'Ethanol-Wasser: unzureichend');
  await shot(page, '20-aufgabe-b-ethanol-unzureichend');
  await prepare(page, { samples: ['gruen', 'violett', 'blau'], solvent: 'water' });
  await develop(page, 8);
  await takeOut(page);
  const [g, v, b] = [await zonesOf(page, 0), await zonesOf(page, 1), await zonesOf(page, 2)];
  const ref = b[0].s;
  const gb = g.find((z) => Math.abs(z.s - ref) < 0.15), vb = v.find((z) => Math.abs(z.s - ref) < 0.15);
  assert(g.length === 2 && v.length === 2 && b.length === 1, 'Zonenzahlen 2/2/1');
  assert(gb && vb, 'Grün und Violett haben je eine Zone auf Referenzhöhe');
  assert(g.concat(v).filter((z) => z !== gb && z !== vb).every((z) => Math.abs(z.s - ref) > 0.8), 'übrige Zonen deutlich anders');
  await page.locator('#btnCheck').click();
  assert(/Ergebnis belegt/.test(await panelText(page)), 'Wasser: belegt');
  await shot(page, '21-aufgabe-b-gemeinsamer-blauer-farbstoff');
  assert(!errors.length, errors.join('; '));
  await done();
  return `Blau-Referenz s = ${ref.toFixed(2)} cm, Grün ${gb.s.toFixed(2)} cm, Violett ${vb.s.toFixed(2)} cm`;
});

// =========================================================== E03 Strecke 3
await scenario('E03', 'Blau und Gelb getrennt und nebeneinander: je eine Zone; Hinweis „eine Zone ist kein Beweis“', async () => {
  const { page, errors, done } = await open();
  await speed(page, 30);
  const out = [];
  for (const samples of [['blau', null, null], ['gelb', null, null], ['blau', 'gelb', null]]) {
    await prepare(page, { samples });
    await develop(page, 6);
    await takeOut(page);
    for (let i = 0; i < 3; i++) if (samples[i]) { const z = await zonesOf(page, i); assert(z.length === 1, samples[i] + ' eine Zone'); out.push(`${samples[i]} ${z[0].s.toFixed(2)}`); }
  }
  await shot(page, '22-referenzen-je-eine-zone');
  await page.locator('#btnNotebook').click();
  const nb = await panelText(page);
  assert(/kein Beweis/.test(nb), 'Hefteintrag nennt Grenze');
  assert(!errors.length, errors.join('; '));
  await done();
  return out.join(', ');
});

// =========================================================== E04 Strecke 4
await scenario('E04', 'Orange und Grün vergleichen: gemeinsamer gelber Bestandteil', async () => {
  const { page, errors, done } = await open();
  await task(page, 'free');
  await speed(page, 30);
  await prepare(page, { samples: ['orange', 'gruen', 'gelb'] });
  await develop(page, 8);
  await takeOut(page);
  const [o, g, y] = [await zonesOf(page, 0), await zonesOf(page, 1), await zonesOf(page, 2)];
  assert(o.length === 2 && g.length === 2, 'Orange und Grün je zwei Zonen');
  const top = (zs) => zs[zs.length - 1].s;
  assert(Math.abs(top(o) - y[0].s) < 0.15 && Math.abs(top(g) - y[0].s) < 0.15, 'oberste Zone auf Gelb-Höhe');
  assert(o[0].color === 'rot' && g[0].color === 'blau', 'untere Zonen verschieden');
  await shot(page, '23-orange-gruen-gelb');
  assert(!errors.length, errors.join('; '));
  await done();
  return `gelb bei ${y[0].s.toFixed(2)} cm in Orange, Grün und Referenz; unten Orange rot, Grün blau`;
});

// =========================================================== E05 Strecke 5
await scenario('E05', 'Wasserfester Stift: Wasser – keine Wanderung; Ethanol-Wasser – Anteil wandert, Rest bleibt; Aufgabe C', async () => {
  const { page, errors, done } = await open();
  await task(page, 'C');
  await speed(page, 30);
  await prepare(page, { samples: ['wasserfest', null, null], solvent: 'water' });
  await develop(page, 8);
  await takeOut(page);
  const zw = await zonesOf(page, 0);
  assert(zw.length === 1 && zw[0].atStart, 'bleibt auf der Startlinie');
  await shot(page, '24-wasserfest-wasser');
  await page.locator('#btnCheck').click();
  assert(/fehlt noch eines mit Ethanol-Wasser/.test(await panelText(page)), 'fordert zweites Laufmittel');
  await prepare(page, { samples: [null, 'wasserfest', null], solvent: 'etoh' });
  await develop(page, 7);
  await takeOut(page);
  const ze = await zonesOf(page, 1);
  assert(ze.length === 2 && ze[0].atStart && ze[1].s > 3, 'Ethanol-Wasser: Rest + wandernder Anteil');
  await shot(page, '25-wasserfest-ethanol-wasser');
  await page.locator('#btnCheck').click();
  assert(/Ergebnis belegt/.test(await panelText(page)), 'Aufgabe C belegt');
  await choose(page, 'water', 'stay');
  await page.locator('#protoForm [name="q-etoh"][value="up"]').check();
  await page.locator('#protoForm [name="q-etoh"][value="rest"]').check();
  await choose(page, 'why', 'sol');
  await fill(page, 'gap', 'Absorption');
  await choose(page, 'mean', 'insol');
  await page.locator('#btnGrade').click();
  const t = await panelText(page);
  assert(/4 von 5/.test(t) && /Absorption bedeutet Aufsaugen/.test(t), 'Absorption gezielt zurückgewiesen');
  await fill(page, 'gap', 'Adsorption');
  await page.locator('#btnGrade').click();
  assert(/Alles richtig ausgewertet/.test(await panelText(page)), 'nach Korrektur richtig');
  assert(!errors.length, errors.join('; '));
  await done();
  return `Wasser: Zone bei s = ${zw[0].s.toFixed(2)} cm; Ethanol-Wasser: ${ze.map((z) => z.s.toFixed(2) + ' cm ' + z.color).join(' / ')}`;
});

// =========================================================== E06 Strecke 6
await scenario('E06', 'Überfüllte Kammer: Startflecken ausgewaschen, gefärbtes Laufmittel, ungültig, Hilfe nach zwei Fehlversuchen', async () => {
  const { page, errors, done } = await open();
  await speed(page, 30);
  await prepare(page, { samples: ['schwarz', 'blau', null], portions: 3 });
  await shot(page, '26-ueberfuellt-vor-dem-einhaengen');
  await develop(page, 5);
  await shot(page, '27-ueberfuellt-flecken-loesen-sich');
  await takeOut(page);
  const tint = await S(page, (st) => st.chamber.tint[3]);
  assert(tint > 0.2, 'Laufmittel gefärbt');
  assert((await zonesOf(page, 0)).length === 0, 'keine Zonen auf dem Papier');
  await page.locator('#btnCheck').click();
  assert(/spiegel lag über den Farbpunkten/i.test(await panelText(page)), 'Fehler benannt');
  assert(!(await page.locator('#btnTipOffer').count()), 'nach einem Fehlversuch noch kein Angebot');
  await page.locator('#btnCheck').click();
  assert(await page.locator('#btnTipOffer').count(), 'Hilfe wird angeboten');
  assert(!/Tipp 1\/3:/.test(await panelText(page)), 'Tipp nicht ungefragt eingeblendet');
  await page.locator('#btnTipOffer').click();
  await page.locator('#btnTip').click();
  await page.locator('#btnTip').click();
  const t = await panelText(page);
  assert(/Tipp 1\/3:.*Flüssigkeitsspiegel/s.test(t) && /Tipp 3\/3:.*leere die Kammer/s.test(t), 'drei zustandsbezogene Tipps');
  assert(!/Tipp 4/.test(t) && (await page.locator('#btnTip').innerText()) === 'Tipp 3/3', 'keine vierte Stufe');
  await shot(page, '28-hilfe-drei-stufen');
  assert(!errors.length, errors.join('; '));
  await done();
  return `Färbung des Laufmittels ${tint.toFixed(2)}`;
});

// =========================================================== E07 Strecke 7
await scenario('E07', 'Viermal aufgetupft: überladene, verschmierte Zone, keine saubere Bewertung', async () => {
  const { page, errors, done } = await open();
  await speed(page, 30);
  // nur ein überladener schwarzer Fleck: darf nicht als sauber getrennt gelten
  await prepare(page, { samples: ['schwarz', 'blau', null], dabs: [4, 1] });
  await shot(page, '29-viermal-getupft');
  await develop(page, 8);
  await takeOut(page);
  const n4only = (await zonesOf(page, 0)).length;
  await page.locator('#btnCheck').click();
  const t = await panelText(page);
  assert(/Noch nicht belegt/.test(t) && /so oft betupft/.test(t), 'überladen nicht als sauber bewertet');
  // Vergleich 1× / 4× nebeneinander
  await prepare(page, { samples: ['schwarz', 'schwarz', 'blau'], dabs: [1, 4, 1] });
  await develop(page, 8);
  await takeOut(page);
  const [n1, n4] = [(await zonesOf(page, 0)).length, (await zonesOf(page, 1)).length];
  assert(n1 === 3 && n4 < 3 && n4only < 3, `1×: ${n1}, 4×: ${n4} Zonen`);
  await shot(page, '30-ueberladen-verschmiert');
  assert(!errors.length, errors.join('; '));
  await done();
  return `Schwarz 1×: ${n1} Zonen, 4×: ${n4} Zonen`;
});

// =========================================================== E08 Strecke 8
await scenario('E08', 'Zu früh herausgenommen und ungeeignetes Laufmittel: unvollständige Trennung, Abhilfe durch neuen Versuch', async () => {
  const { page, errors, done } = await open();
  await speed(page, 30);
  await prepare(page, { samples: ['schwarz', 'gelb', null] });
  await develop(page, 2.2);
  await takeOut(page);
  const n = (await zonesOf(page, 0)).length;
  assert(n < 3, 'früh: Zonen noch nicht getrennt');
  await shot(page, '31-zu-frueh-herausgenommen');
  await page.locator('#btnCheck').click();
  assert(/nur [0-9,]+ cm über die Startlinie/.test(await panelText(page)), 'zu kurz benannt');
  await page.locator('#btnTip').click(); await page.locator('#btnTip').click(); await page.locator('#btnTip').click();
  assert(/mindestens etwa 5 cm/.test(await panelText(page)), 'konkrete Abhilfe');
  await prepare(page, { samples: ['schwarz', 'gelb', null], solvent: 'etoh' });
  await develop(page, 8);
  await takeOut(page);
  await page.locator('#btnCheck').click();
  assert(/nur 2 Zonen deutlich getrennt/.test(await panelText(page)), 'Ethanol-Wasser unvollständig');
  await prepare(page, { samples: ['schwarz', 'gelb', null], solvent: 'water' });
  await develop(page, 7);
  await takeOut(page);
  await page.locator('#btnCheck').click();
  assert(/Ergebnis belegt/.test(await panelText(page)), 'nach Abhilfe belegt');
  assert(!errors.length, errors.join('; '));
  await done();
  return `früh: ${n} Zone(n); Ethanol-Wasser: 2; Wasser: 3`;
});

// =========================================================== E09 Strecke 9
await scenario('E09', 'Zwei Chromatogramme ablegen und vergleichen, frühere Befunde bleiben erhalten', async () => {
  const { page, errors, done } = await open();
  await speed(page, 30);
  await prepare(page, { samples: ['schwarz', 'gruen', 'violett'], solvent: 'water' });
  await develop(page, 7);
  await takeOut(page);
  const first = await S(page, (st) => JSON.stringify(st.archive[0].zones));
  await prepare(page, { samples: ['schwarz', 'gruen', 'violett'], solvent: 'etoh' });
  await develop(page, 7);
  await takeOut(page);
  await page.locator('.lk-tabs [data-tab="results"]').click();
  assert((await page.locator('.result canvas').count()) === 2, 'zwei Papiere in der Übersicht');
  const t = await panelText(page);
  assert(/Papier 1/.test(t) && /Papier 2/.test(t) && /Wasser/.test(t) && /Ethanol-Wasser/.test(t), 'Bedingungen je Papier');
  await page.locator('[data-big="P1"]').click();
  await shot(page, '32-ergebnisse-vergleich');
  const after = await S(page, (st) => JSON.stringify(st.archive[0].zones));
  assert(first === after, 'Befund Papier 1 unverändert');
  await page.reload();
  await page.waitForFunction(() => window.PC && window.PC.app);
  assert((await S(page, (st) => st.archive.length)) === 2, 'nach Neuladen erhalten');
  assert(!errors.length, errors.join('; '));
  await done();
  return 'Papier 1 (Wasser) und Papier 2 (Ethanol-Wasser) nebeneinander; Neuladen behält beide';
});

// =========================================================== E10 Strecke 10
await scenario('E10', 'Expertenmodus: Front markieren, Rf aus echten Laufstrecken; Front am Rand; Standardmodus ohne Rf', async () => {
  const { page, errors, done } = await open();
  assert(!/Rf/.test(await panelText(page)) && !(await page.locator('[data-act="markFront"]').count()), 'Standardmodus ohne Rf');
  await page.locator('#btnExpert').click();
  await speed(page, 30);
  await prepare(page, { samples: ['blau', 'schwarz', null] });
  await develop(page, 9);
  await takeOut(page);
  await speed(page, 1);
  await clickAct(page, 'markFront');
  await idle(page);
  await shot(page, '33-experte-front-markiert-lineal');
  // Ablesen am Lineal (gemessen wird hier aus dem gezeichneten Zustand, eingegeben wird über die Oberfläche)
  const m = await S(page, (st, M) => { const p = st.paper; const z = M.zones(p, 0)[0]; return { front: p.frontMark - p.lanes[0].y, dist: z.s }; });
  await page.locator('#rfFront').fill(m.front.toFixed(1).replace('.', ','));
  await page.locator('#rfDist').fill(m.dist.toFixed(1).replace('.', ','));
  await page.locator('#rfVal').fill('0,9');
  await page.locator('#btnRf').click();
  assert(/Rf: ✗/.test(await panelText(page)), 'falscher Rf erkannt');
  await page.locator('#rfVal').fill((m.dist / m.front).toFixed(2).replace('.', ','));
  await page.locator('#btnRf').click();
  assert(/Richtig gemessen und berechnet/.test(await panelText(page)), 'Rf richtig');
  await shot(page, '34-experte-rf-geprueft');
  await speed(page, 30);
  await prepare(page, { samples: ['gelb', null, null] });
  await develop(page, 30).catch(() => {});
  await waitFor(page, (st) => st.paper.frontAtTop);
  await takeOut(page);
  await clickAct(page, 'markFront');
  await sleep(200);
  assert(/oberen Rand gestiegen/.test(await page.locator('#toast').innerText()), 'Front am Rand: nicht markierbar');
  await page.locator('#btnRf').click().catch(() => {});
  assert(!errors.length, errors.join('; '));
  await done();
  return `Front ${m.front.toFixed(2)} cm, Zone ${m.dist.toFixed(2)} cm, Rf ${(m.dist / m.front).toFixed(2)}`;
});

// =========================================================== E11 Strecke 11
await scenario('E11', 'Lösung anzeigen ohne erfolgreichen Versuch (mit Rückfrage), Hefteintrag jederzeit', async () => {
  const { page, errors, done } = await open();
  await page.locator('#btnNotebook').click();
  const nb = await panelText(page);
  const words = nb.split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;
  assert(/Stationäre Phase/.test(nb) && /Mobile Phase/.test(nb) && /Adsorption/.test(nb) && /Löslichkeit/.test(nb), 'Fachbegriffe');
  await shot(page, '35-hefteintrag-ohne-versuch');
  await page.locator('.lk-tabs [data-tab="task"]').click();
  await task(page, 'C');
  await page.locator('#btnSolution').click();
  assert(await page.locator('#btnSolutionYes').count(), 'Rückfrage bei unvollständiger Bearbeitung');
  await page.locator('#btnSolutionNo').click();
  assert(!/Musterlösung/.test(await panelText(page)), 'Abbrechen zeigt nichts');
  await page.locator('#btnSolution').click();
  await page.locator('#btnSolutionYes').click();
  const t = await panelText(page);
  assert(/Musterlösung \(auf Anfrage angezeigt\)/.test(t) && /Adsorption/.test(t), 'Musterlösung');
  assert((await page.locator('#protoForm .lk-opt.right').count()) >= 5, 'richtige Antworten markiert');
  await shot(page, '36-loesung-ohne-versuch');
  assert(!errors.length, errors.join('; '));
  await done();
  return `Hefteintrag ${words} Wörter (inkl. Hinweiszeile)`;
});

// =========================================================== E12 Strecke 12
await scenario('E12', 'Touch-Ablauf, Tastatur, Trennlinie (Maus, Touch, Tastatur, Doppelklick, Speicherung)', async () => {
  const { page, errors, done } = await open({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });
  await speed(page, 30);
  await prepare(page, { samples: ['gruen', null, 'blau'], touch: true });
  await develop(page, 5.5, true);
  await takeOut(page, true);
  assert((await zonesOf(page, 0)).length === 2, 'per Touch entwickelt');
  // Tastatur: Fokus auf Stift, Enter wählt
  await clickAct(page, 'newSheet'); await idle(page);
  await page.locator('[data-hit="pencil"]').focus();
  await page.keyboard.press('Enter'); await idle(page);
  await page.locator('[data-hit="pen:violett"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-hit="lane:1"]').focus();
  await page.keyboard.press('Space'); await idle(page);
  assert((await S(page, (st) => st.paper.line && st.paper.lanes[1] && st.paper.lanes[1].sampleId)) === 'violett', 'Tastatur: Linie und Probe');
  const focusVisible = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(focusVisible !== 'none', 'sichtbarer Fokus');
  // Trennlinie
  const panelW = () => page.evaluate(() => document.querySelector('#panel').getBoundingClientRect().width);
  const w0 = await panelW();
  const sp = await page.locator('#splitter').boundingBox();
  await page.mouse.move(sp.x + sp.width / 2, sp.y + 300);
  await page.mouse.down(); await page.mouse.move(sp.x - 120, sp.y + 300, { steps: 6 }); await page.mouse.up();
  const w1 = await panelW();
  assert(w1 > w0 + 80, `Maus: ${w0} → ${w1}`);
  await page.locator('#splitter').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const w2 = await panelW();
  assert(Math.abs(w1 - 48 - w2) < 3, `Tastatur: ${w1} → ${w2}`);
  // Touch-Ziehen (Zeigerereignisse vom Typ touch)
  const sb = await page.locator('#splitter').boundingBox();
  await page.locator('#splitter').dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: sb.x + 7, clientY: sb.y + 200, isPrimary: true });
  await page.locator('#splitter').dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: sb.x + 140, clientY: sb.y + 200, isPrimary: true });
  await page.locator('#splitter').dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: sb.x + 140, clientY: sb.y + 200, isPrimary: true });
  const w3 = await panelW();
  assert(w3 < w2 - 100, `Touch: ${w2} → ${w3}`);
  await page.reload(); await page.waitForFunction(() => window.PC && window.PC.app); await sleep(200);
  assert(Math.abs((await panelW()) - w3) < 2, 'Breite nach Neuladen gemerkt');
  await page.locator('#splitter').dblclick();
  const w4 = await panelW();
  assert(Math.abs(w4 - w0) < 2, `Doppelklick setzt zurück: ${w4} vs ${w0}`);
  // Grenzen
  const s2 = await page.locator('#splitter').boundingBox();
  await page.mouse.move(s2.x + 7, s2.y + 300); await page.mouse.down(); await page.mouse.move(20, s2.y + 300, { steps: 4 }); await page.mouse.up();
  const stageW = await page.evaluate(() => document.querySelector('#stage').getBoundingClientRect().width);
  assert(stageW >= 418, 'Bühne bleibt mindestens 420 px breit: ' + stageW);
  await shot(page, '37-trennlinie-breites-bedienfeld');
  await page.locator('#splitter').dblclick();
  // Bedienfeld einklappen
  await page.locator('#btnPanel').click(); await sleep(150);
  assert(!(await page.locator('#panel').isVisible()), 'Bedienfeld eingeklappt');
  await shot(page, '38-bedienfeld-eingeklappt');
  await page.locator('#btnPanel').click();
  assert(!errors.length, errors.join('; '));
  await done();
  return `Bedienfeld ${w0} → Maus ${w1} → Tastatur ${w2} → Touch ${w3} → Doppelklick ${w4} px; Bühne min. ${stageW | 0} px`;
});

// =========================================================== E13 Ansichten
await scenario('E13', 'Pflichtauflösungen: Dominanz der Kammer, keine abgeschnittenen Steuerelemente, Touch-Ziele, kein horizontales Scrollen', async () => {
  const rows = [];
  for (const [w, h] of [[1440, 900], [1180, 820], [1024, 768], [768, 1024]]) {
    const { page, errors, done } = await open({ viewport: { width: w, height: h }, hasTouch: w < 1440 });
    await speed(page, 30);
    await prepare(page, { samples: ['schwarz', 'gruen', 'blau'], touch: w < 1440 });
    await develop(page, 5, w < 1440);
    await speed(page, 0);
    await shot(page, `40-ansicht-${w}x${h}`);
    const measure = () => page.evaluate(() => {
      const r = window.PC.app.renderer, L = r.layout, v = r.view;
      const stage = document.querySelector('#canvasWrap').getBoundingClientRect();
      const objs = { chamber: L.chamber.w * L.chamber.h, paperBench: 9 * L.paperBench.f * 14 * L.paperBench.f, rack: L.rack.slot * 7 * 5.2, bottle: 2.5 * 4.4 };
      const els = [...document.querySelectorAll('#actions button, .hit, .lk-head button, .lk-tabs button, #panelBody button')].filter((e) => e.offsetParent || e.getClientRects().length);
      const vw = innerWidth;
      const clipped = els.filter((e) => { const b = e.getBoundingClientRect(); return b.left < -1 || b.right > vw + 1; }).map((e) => e.textContent || e.dataset.hit);
      // Eingabefelder und Karten dürfen nicht über das Bedienfeld hinausragen
      const pb = document.querySelector('#panelBody').getBoundingClientRect();
      document.querySelectorAll('#panelBody input, #panelBody select, #panelBody .lk-card, #panelBody .lk-note').forEach((e) => { const b = e.getBoundingClientRect(); if (b.width && b.right > pb.right + 1) clipped.push('Bedienfeld: ' + (e.id || e.className)); });
      const small = els.filter((e) => { const b = e.getBoundingClientRect(); return b.height < 36 || b.width < 36; }).map((e) => (e.textContent || e.dataset.hit).trim());
      return {
        wPct: (L.chamber.w * v.s) / stage.width, hPct: (L.chamber.h * v.s) / stage.height, largest: Object.entries(objs).sort((a, b) => b[1] - a[1])[0][0],
        hscroll: document.documentElement.scrollWidth > innerWidth + 1, clipped, small, compact: L.compact, s: v.s
      };
    });
    const m = await measure();
    // zusätzlich im Expertenmodus mit Rf-Formular und fünfter Handlung (Front markieren)
    if (w !== 1440) {
      await page.locator('#btnExpert').click(); await speed(page, 30); await takeOut(page, true); await speed(page, 0);
      const x = await measure();
      m.clipped.push(...x.clipped); m.small.push(...x.small); m.hscroll = m.hscroll || x.hscroll;
    }
    if (w !== 1440) await shot(page, `41-ansicht-experte-${w}x${h}`);
    assert(m.largest === 'chamber', 'Kammer größtes Objekt');
    assert(!m.hscroll, 'kein horizontales Scrollen');
    assert(!m.clipped.length, 'abgeschnitten: ' + m.clipped.join(', '));
    assert(!m.small.length, 'zu kleine Touch-Ziele: ' + m.small.join(', '));
    if (w >= 1024) assert(m.wPct >= 0.48, `Kammerbreite ${m.wPct}`);
    rows.push(`${w}×${h}: Kammer ${(m.wPct * 100).toFixed(0)} % breit, ${(m.hPct * 100).toFixed(0)} % hoch${m.compact ? ' (kompakt)' : ''}, ${m.s.toFixed(1)} px/cm`);
    assert(!errors.length, errors.join('; '));
    await done();
  }
  return rows.join('; ');
});

// =========================================================== E14 Zeitraffer
await scenario('E14', 'Pause und Zeitraffer: gleiche Modellzeit → gleiche Bandenlage und Bewertung', async () => {
  const { page, errors, done } = await open();
  await speed(page, 10);
  await prepare(page, { samples: ['schwarz', 'violett', null] });
  await tapHit(page, 'chamber');
  await idle(page);
  const samples = [];
  for (const [sp, ms] of [[10, 1500], [0, 600], [30, 1200], [1, 700], [30, 2500]]) {
    await speed(page, sp);
    await sleep(ms);
    await speed(page, 0);
    samples.push(await S(page, (st, M) => ({ dev: st.paper.devTime, zones: [0, 1].map((l) => M.zones(st.paper, l).map((z) => +z.s.toFixed(6))) })));
  }
  // Referenz: unabhängiges Modell mit denselben Handlungen, auf dieselbe Entwicklungszeit gerechnet
  const ok = await page.evaluate((smp) => {
    const M = window.PC.model;
    return smp.map((x) => {
      const e = M.createEngine();
      const run = (n, ...a) => { e.act(n, ...a); while (e.state.op) e.advance(0.05); };
      run('drawLine'); run('spot', 0, 'schwarz'); run('spot', 1, 'violett'); run('pour', 'water'); run('insert');
      while (e.state.paper.devTime < x.dev - 1e-9) e.advance(0.05);
      const z = [0, 1].map((l) => M.zones(e.state.paper, l).map((q) => +q.s.toFixed(6)));
      return JSON.stringify(z) === JSON.stringify(x.zones);
    });
  }, samples);
  assert(ok.every(Boolean), 'Abweichung: ' + JSON.stringify(ok));
  assert(samples[1].dev === samples[0].dev, 'Pause hält die Modellzeit an');
  assert(!errors.length, errors.join('; '));
  await done();
  return `5 Stände (10×, Pause, 30×, 1×, 30×) bei ${samples.map((s) => s.dev.toFixed(1)).join(' / ')} s identisch mit Referenzrechnung`;
});

// =========================================================== Regressionstests 0.2.0
const ansB = { common: 'blau', how: ['height', 'ref'], green: 'gb', violet: 'rb', same: 'cond' };
async function answer(page, answers) {
  for (const [q, v] of Object.entries(answers)) {
    if (Array.isArray(v)) { for (const x of v) await page.locator(`#protoForm [name="q-${q}"][value="${x}"]`).check(); }
    else if (q === 'gap') await fill(page, q, v);
    else await choose(page, q, v);
  }
}
const panelHasSuccess = async (page) => /Alles richtig ausgewertet/.test(await panelText(page));

await scenario('E16', 'Befund 1: Geänderte Protokollantwort nimmt „Alles richtig“ sofort zurück, auch nach Tabwechsel', async () => {
  const { page, errors, done } = await open();
  await task(page, 'B');
  await speed(page, 30);
  await prepare(page, { samples: ['gruen', 'violett', 'blau'] });
  await develop(page, 6);
  await takeOut(page);
  await page.locator('#btnCheck').click();
  await answer(page, ansB);
  await page.locator('#btnGrade').click();
  assert(await panelHasSuccess(page), 'zunächst alles richtig');
  await choose(page, 'common', 'rot');
  assert(!(await panelHasSuccess(page)), 'Erfolg nach Änderung zurückgenommen');
  assert(/noch nicht geprüft/.test(await page.locator('#protoSummary').innerText()), 'als ungeprüft gekennzeichnet');
  assert((await page.locator('fieldset[data-q="how"] .lk-fb.y').count()) === 1, 'unveränderte Antwort bleibt bewertet');
  assert((await page.locator('fieldset[data-q="common"] .lk-fb').count()) === 0, 'geänderte Antwort ohne alte Markierung');
  await page.locator('.lk-tabs [data-tab="results"]').click();
  await page.locator('.lk-tabs [data-tab="task"]').click();
  assert(!(await panelHasSuccess(page)), 'auch nach Tabwechsel kein Erfolg');
  await shot(page, '60-protokoll-geaendert-ungeprueft');
  await page.reload(); await page.waitForFunction(() => window.PC && window.PC.app);
  assert(!(await panelHasSuccess(page)), 'auch nach Neuladen kein Erfolg');
  await page.locator('#btnGrade').click();
  const t = await panelText(page);
  assert(/4 von 5 Antworten richtig/.test(t) && !/Alles richtig/.test(t), 'erneute Prüfung: rot ist falsch');
  assert(!errors.length, errors.join('; '));
  await done();
  return 'Blau → Rot: „Alles richtig“ verschwindet sofort, nach Tabwechsel und Neuladen; erneute Prüfung 4/5';
});

await scenario('E17', 'Befund 1: Geänderter Rf-Wert nach erfolgreicher Prüfung gilt als ungeprüft', async () => {
  const { page, errors, done } = await open();
  await page.locator('#btnExpert').click();
  await speed(page, 30);
  await prepare(page, { samples: ['blau', null, null] });
  await develop(page, 8);
  await takeOut(page);
  await clickAct(page, 'markFront'); await idle(page);
  const m = await S(page, (st, M) => { const p = st.paper; const z = M.zones(p, 0)[0]; return { front: p.frontMark - p.lanes[0].y, dist: z.s }; });
  await page.locator('#rfFront').fill(m.front.toFixed(1).replace('.', ','));
  await page.locator('#rfDist').fill(m.dist.toFixed(1).replace('.', ','));
  await page.locator('#rfVal').fill((m.dist / m.front).toFixed(2).replace('.', ','));
  await page.locator('#btnRf').click();
  assert(/Richtig gemessen und berechnet/.test(await panelText(page)), 'zunächst richtig');
  await page.locator('#rfVal').fill('0,99');
  assert(!/Richtig gemessen und berechnet/.test(await panelText(page)), 'Erfolgsmeldung zurückgenommen');
  assert(!(await page.locator('#rfVal').evaluate((e) => e.classList.contains('right'))), 'grüne Markierung entfernt');
  assert(await page.locator('#rfFront').evaluate((e) => e.classList.contains('right')), 'unveränderte Messung bleibt markiert');
  assert(/Rf: ungeprüft/.test(await panelText(page)), 'Rf als ungeprüft angezeigt');
  await page.locator('.lk-tabs [data-tab="notebook"]').click();
  await page.locator('.lk-tabs [data-tab="task"]').click();
  assert(!/Richtig gemessen und berechnet/.test(await panelText(page)), 'auch nach Tabwechsel kein Erfolg');
  await shot(page, '61-rf-geaendert-ungeprueft');
  await page.locator('#btnRf').click();
  assert(/Rf: ✗/.test(await panelText(page)), 'erneute Prüfung: falsch');
  assert(!errors.length, errors.join('; '));
  await done();
  return 'Rf 0,99 nach richtiger Prüfung: grüne Markierung und Erfolgsmeldung weg, nach erneuter Prüfung ✗';
});

await scenario('E18', 'Befund 2: Musterlösung ohne Papier, Begriffsfeld bearbeiten, Expertenmodus, Tabwechsel, Neuladen – keine Fehler', async () => {
  const { page, errors, done } = await open();
  await page.locator('#btnSolution').click();
  await page.locator('#btnSolutionYes').click();
  await page.locator('#protoForm [name="q-gap"]').fill('mobil');
  await page.locator('#protoForm [name="q-gap"]').fill('stationär');
  await page.locator('#btnExpert').click();
  await page.locator('.lk-tabs [data-tab="results"]').click();
  await page.locator('.lk-tabs [data-tab="task"]').click();
  await page.reload(); await page.waitForFunction(() => window.PC && window.PC.app);
  await sleep(200);
  await page.locator('#protoForm [name="q-gap"]').fill('Stationäre');
  await page.locator('#btnExpert').click();
  const t = await panelText(page);
  assert(/Musterlösung/.test(t) && (await page.locator('#protoForm').count()) === 1, 'Musterlösung und Protokoll sichtbar');
  assert(!errors.length, 'Fehler: ' + errors.join('; '));
  await done();
  return 'kein Laufzeitfehler (vorher: Cannot read properties of null (reading \'lanes\'))';
});

await scenario('E19', 'Befund 3 und 6: Startlinie nach dem Auftragen – Meldung im Band über der Kammer, kein Aufgabennachweis', async () => {
  const { page, errors, done } = await open();
  await speed(page, 30);
  await tapHit(page, 'pen:schwarz'); await tapHit(page, 'lane:0'); await tapHit(page, 'pen:schwarz');
  await tapHit(page, 'pen:gelb'); await tapHit(page, 'lane:2'); await tapHit(page, 'pen:gelb');
  await tapHit(page, 'pencil');
  await idle(page);
  const ys = await S(page, (st) => st.paper.lanes.map((l) => l && l.y));
  assert(JSON.stringify(ys) === '[2.35,null,2.6]', 'Punkte unverändert: ' + JSON.stringify(ys));
  await tapHit(page, 'bottle:water');
  await tapHit(page, 'chamber');
  await idle(page);
  await page.waitForFunction(() => /gemeinsamen Startlinie/.test(document.querySelector('#toast').textContent), null, { timeout: 5000 });
  const text = await page.locator('#toast').innerText();
  assert(text === 'Die Probenpunkte liegen nicht auf einer gemeinsamen Startlinie. Verwende neues Papier und zeichne zuerst die Startlinie.', 'Meldung: ' + text);
  const geo = await page.evaluate(() => {
    const t = document.querySelector('#toast').getBoundingClientRect(), b = document.querySelector('#msgband').getBoundingClientRect();
    const r = window.PC.app.renderer, L = r.layout, wrap = document.querySelector('#canvasWrap').getBoundingClientRect();
    const chamberTop = wrap.top + r.toScreen(0, L.chamber.top - 0.6).y; // Oberkante inkl. Deckel
    return { inside: t.top >= b.top - 1 && t.bottom <= b.bottom + 1 && t.left >= b.left - 1 && t.right <= b.right + 1, gap: chamberTop - t.bottom, overlap: window.__overlap(t) };
  });
  assert(geo.inside && geo.gap >= 0 && !geo.overlap, 'Meldung im Band oberhalb der Kammer, ohne Überschneidung: ' + JSON.stringify(geo));
  await shot(page, '62-startlinie-nachtraeglich-meldung');
  await waitFor(page, (st, M) => st.paper.front >= M.PAPER.lineY + 7);
  await takeOut(page);
  await page.locator('#btnCheck').click();
  const t = await panelText(page);
  assert(/Noch nicht belegt/.test(t) && /gemeinsamen Startlinie/.test(t), 'kein Nachweis');
  assert(!errors.length, errors.join('; '));
  await done();
  return `Punkte bleiben bei 2,35/2,60 cm; Meldung ${geo.gap.toFixed(0)} px oberhalb von Kammer und Arbeitsfläche; Aufgabe A nicht belegt`;
});

await scenario('E20', 'Befund 4: Ausgewertetes Papier wird genannt und gezeigt; neues Bezugspapier setzt die Bewertung zurück; Aufgabe C nennt beide Papiere', async () => {
  const { page, errors, done } = await open();
  await speed(page, 30);
  await prepare(page, { samples: ['schwarz', 'blau', null] });
  await develop(page, 6); await takeOut(page);
  await page.locator('#btnCheck').click();
  assert(/Ausgewertet: Papier 1 \(Wasser\)/.test(await panelText(page)), 'Papier 1 genannt');
  await answer(page, { count: '3' });
  await page.locator('#btnGrade').click();
  assert(await page.locator('#protoSummary .lk-note').count(), 'Bewertung zu Papier 1');
  await prepare(page, { samples: ['schwarz', 'blau', null], portions: 3 });
  await develop(page, 5); await takeOut(page);
  assert(/neues Papier dazugekommen/.test(await panelText(page)), 'Hinweis auf neues Papier');
  await page.locator('#btnCheck').click();
  const t2 = await panelText(page);
  assert(/Noch nicht belegt/.test(t2) && /Ausgewertet: Papier 2/.test(t2) && !/Ausgewertet: Papier 1/.test(t2), 'neuester Fehlversuch zählt, nicht der ältere Erfolg');
  await shot(page, '63-auswertung-papier-genannt');
  await page.locator('[data-show="P2"]').click();
  assert((await page.locator('.lk-tabs [data-tab="results"]').getAttribute('aria-selected')) === 'true' && await page.locator('.result.big [data-thumb="P2"]').count(), 'Chromatogramm direkt erreichbar');
  await page.locator('.lk-tabs [data-tab="task"]').click();
  await prepare(page, { samples: ['schwarz', null, 'gelb'] });
  await develop(page, 6); await takeOut(page);
  await page.locator('#btnCheck').click();
  const t3 = await panelText(page);
  assert(/Ergebnis belegt/.test(t3) && /Protokoll zu Papier 3/.test(t3), 'neues Bezugspapier 3');
  assert(!(await page.locator('#protoSummary .lk-note').count()), 'alte Bewertung nicht übernommen');
  assert(await page.locator('#protoForm [name="q-count"][value="3"]').isChecked(), 'Eingabe bleibt erhalten');
  // Aufgabe C
  await task(page, 'C');
  await prepare(page, { samples: ['wasserfest', null, null], solvent: 'water' });
  await develop(page, 6); await takeOut(page);
  await prepare(page, { samples: ['wasserfest', null, null], solvent: 'etoh' });
  await develop(page, 6); await takeOut(page);
  await page.locator('#btnCheck').click();
  const t4 = await panelText(page);
  assert(/Ausgewertet: Papier 4 \(Wasser\) und Papier 5 \(Ethanol-Wasser 1 : 1\)/.test(t4) && /Protokoll zu Papier 4 \(Wasser\) und Papier 5/.test(t4), 'beide Vergleichspapiere benannt');
  assert((await page.locator('.evalthumb').count()) === 2, 'beide Papiere als Miniatur erreichbar');
  await shot(page, '64-aufgabe-c-beide-papiere');
  assert(!errors.length, errors.join('; '));
  await done();
  return 'Papier 1 ✓ → Papier 2 ✗ (nicht durch Papier 1 gerettet) → Papier 3 ✓ ohne alte Bewertung; Aufgabe C: Papier 4 und 5';
});

await scenario('E21', 'Befund 4: Ältestes Papier fällt aus dem Archiv (12 Papiere) – keine ungültigen Verweise', async () => {
  const { page, errors, done } = await open();
  await speed(page, 30);
  await prepare(page, { samples: ['schwarz', 'blau', null] });
  await develop(page, 5.2); await takeOut(page);
  await page.locator('#btnCheck').click();
  await answer(page, { count: '3' });
  await page.locator('#btnGrade').click();
  for (let i = 0; i < 12; i++) { await prepare(page, { samples: ['gelb', null, null] }); await develop(page, 5.2); await takeOut(page); }
  const ids = await S(page, (st) => st.archive.map((a) => a.id));
  assert(ids.length === 12 && !ids.includes('P1'), 'Papier 1 entfernt');
  await page.locator('.lk-tabs [data-tab="results"]').click();
  await page.locator('.lk-tabs [data-tab="task"]').click();
  const t = await panelText(page);
  assert(/nicht mehr vorhanden/.test(t) && !/Ergebnis belegt/.test(t) && !(await page.locator('#protoForm').count()), 'Bewertung verworfen, Hinweis');
  await page.reload(); await page.waitForFunction(() => window.PC && window.PC.app);
  await page.locator('#btnCheck').click();
  assert(/Ausgewertet: Papier 1\b/.test(await panelText(page)) === false, 'kein Verweis auf Papier 1');
  assert(!errors.length, errors.join('; '));
  await done();
  return '13 Papiere: Bewertung zu Papier 1 verworfen, Hinweis „nicht mehr vorhanden“, keine Fehler';
});

await scenario('E22', 'Befund 7: Stift nach „Neues Papier“ und „Papier einhängen“ zurückgestellt und verschlossen (Bühne und Leiste)', async () => {
  const { page, errors, done } = await open();
  const sel = () => S(page, () => window.PC.app.ui.selectedPen);
  const pressed = (id) => page.locator(`[data-hit="pen:${id}"]`).getAttribute('aria-pressed');
  await tapHit(page, 'pencil');
  await tapHit(page, 'pen:gruen'); await tapHit(page, 'lane:0');
  await idle(page);
  await clickAct(page, 'insert'); await idle(page);
  assert((await sel()) === null && (await pressed('gruen')) === 'false', 'Leiste „Papier einhängen“');
  await tapHit(page, 'chamber'); await idle(page);
  await tapHit(page, 'pen:violett');
  await clickAct(page, 'newSheet'); await idle(page);
  assert((await sel()) === null && (await pressed('violett')) === 'false', 'Leiste „Neues Papier“');
  await tapHit(page, 'pencil');
  await tapHit(page, 'pen:orange'); await tapHit(page, 'lane:1');
  await tapHit(page, 'chamber'); await idle(page);
  assert((await sel()) === null, 'Bühne: Kammer antippen');
  await shot(page, '65-stift-zurueckgestellt');
  assert(!errors.length, errors.join('; '));
  await done();
  return 'nach Einhängen (Leiste und Bühne) und neuem Papier ist kein Stift mehr gewählt';
});

await scenario('E23', 'Befund 6: Meldungsband auf Desktop und Tablet (quer/hoch) oberhalb von Kammer und Geräten', async () => {
  const rows = [];
  for (const [w, h] of [[1440, 900], [1180, 820], [1024, 768], [768, 1024]]) {
    const { page, errors, done } = await open({ viewport: { width: w, height: h }, hasTouch: w < 1440 });
    await tapHit(page, 'pen:schwarz', w < 1440); await tapHit(page, 'lane:0', w < 1440); await tapHit(page, 'pencil', w < 1440);
    await tapHit(page, 'chamber', w < 1440);
    await idle(page);
    await page.waitForFunction(() => /gemeinsamen Startlinie/.test(document.querySelector('#toast').textContent), null, { timeout: 5000 });
    await sleep(300);
    const g = await page.evaluate(() => {
      const t = document.querySelector('#toast').getBoundingClientRect();
      const r = window.PC.app.renderer, wrap = document.querySelector('#canvasWrap').getBoundingClientRect();
      return { lines: Math.round((t.height - 14) / 19), gap: wrap.top + r.toScreen(0, r.layout.chamber.top - 0.6).y - t.bottom, overlap: window.__overlap(t), h: t.height };
    });
    await shot(page, `66-meldung-${w}x${h}`);
    assert(g.gap >= 0 && !g.overlap, `${w}×${h}: ${JSON.stringify(g)}`);
    rows.push(`${w}×${h}: ${g.lines} Zeile(n), ${g.gap.toFixed(0)} px Abstand`);
    assert(!errors.length, errors.join('; '));
    await done();
  }
  return rows.join('; ');
});

await scenario('E24', 'Befund 8: Wellen beim Eingießen klingen ab; Füllstand stimmt mit dem Modell überein', async () => {
  const { page, errors, done } = await open();
  await tapHit(page, 'bottle:water');
  await page.waitForFunction(() => { const o = window.PC.app.engine.state.op; return o && o.t / o.dur > 0.7 && window.PC.app.renderer.waveAmp() > 0.03; }, null, { timeout: 5000 });
  const during = await page.evaluate(() => window.PC.app.renderer.waveAmp());
  await shot(page, '67-eingiessen-wellen');
  await idle(page);
  const level = await S(page, (st, M) => [st.chamber.level, M.PORTION]);
  await page.waitForFunction(() => window.PC.app.renderer.waveAmp() === 0, null, { timeout: 8000 });
  await shot(page, '68-nach-dem-eingiessen-ruhig');
  assert(Math.abs(level[0] - level[1]) < 1e-9, 'Füllstand = eine Portion');
  assert(!errors.length, errors.join('; '));
  await done();
  return `Amplitude beim Gießen ${during.toFixed(3)} cm, danach 0; Spiegel ${level[0].toFixed(2)} cm`;
});

// =========================================================== E15 Netz und Konsole
await scenario('E15', 'Keine externen Anfragen, keine Konsolenfehler, Neuladen behält den Versuch', async () => {
  const { page, errors, done, requests } = await open();
  await speed(page, 30);
  await prepare(page, { samples: ['gruen', null, null] });
  await page.reload(); await page.waitForFunction(() => window.PC && window.PC.app);
  const kept = await S(page, (st) => st.paper.line && st.chamber.portions === 1 && st.paper.lanes[0] && st.paper.lanes[0].sampleId === 'gruen');
  assert(kept, 'Zwischenstand nach Neuladen erhalten');
  assert(!errors.length, errors.join('; '));
  await done();
  const external = allRequests.filter((u) => !u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:'));
  assert(!external.length, 'extern: ' + external.join(', '));
  assert(!allErrors.length, 'Fehler in Szenarien: ' + allErrors.join('; '));
  return `${allRequests.length} Anfragen in allen Szenarien, davon extern: 0; Konsolenfehler: 0`;
});

await browser.close();
server.close();
const summary = { date: new Date().toISOString(), browser: browser.__channel, root: path.relative(APP, ROOT), passed: results.filter((r) => r.status === 'PASS').length, total: results.length, results };
if (!ONLY) fs.writeFileSync(path.join(HERE_DIR(), 'results.json'), JSON.stringify(summary, null, 2));
console.log(`\n${summary.passed}/${summary.total} Szenarien bestanden`);
process.exit(summary.passed === summary.total ? 0 : 1);
function HERE_DIR() { return path.join(APP, 'tests/e2e'); }
