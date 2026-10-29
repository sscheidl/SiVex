// Abläufe über die Oberfläche (von run.mjs und scorm.mjs genutzt).
import * as L from './lib.mjs';
const { S, sleep, assert } = L;

export async function note(page, obs, expl) {
  await page.locator('#tab-exp').click();
  await page.locator('textarea[data-f="obs"]').fill(obs);
  if (expl) await page.locator('textarea[data-f="expl"]').fill(expl);
  await page.locator('[data-a="snap"]').click();
  await sleep(80);
}
export async function classify(page, hom, kind, prin) {
  await page.locator(`input[name="hom"][value="${hom}"]`).check();
  await page.locator('select[data-f="kind"]').selectOption(kind);
  for (const p of prin) await page.locator(`input[name="prin"][value="${p}"]`).check();
  await page.locator('[data-a="grade"]').click();
  await sleep(80);
}
export const isComplete = (page, n) => page.evaluate((k) => window.TV.app.complete(k), n);

export async function exp1(page, o = {}) {
  await L.exp(page, 1);
  await L.use(page, 'rod', 'A', o.touch); await L.idle(page);
  await L.speed(page, 30); await L.waitFor(page, (st) => st.objs.A.susp.sandF.m + st.objs.A.susp.sandC.m < 0.12); await L.speed(page, 1);
  await L.pour(page, 'A', 'B', (st) => st.objs.A.c.water < 26, { touch: o.touch });
  await page.locator('[data-a="check"]').click();
  assert(await S(page, (st, M, app) => app.notes[1].goalAt != null), 'V1: Trennziel erreicht');
  await note(page, 'Nach dem Umrühren ist alles trüb. Der Sand sinkt nach unten, oben wird es klar. Beim vorsichtigen Abgießen bleibt der Sand im Becherglas.', 'Sand ist schwerer (dichter) als Wasser und löst sich nicht.');
  await classify(page, 'het', 'suspension', ['dichte']);
  assert(await isComplete(page, 1), 'V1 abgeschlossen');
}

export async function exp2(page, o = {}) {
  await L.exp(page, 2);
  await L.use(page, 'paper', 'F', o.touch); await L.idle(page);
  await L.use(page, 'F', 'ring', o.touch); await L.idle(page);
  await L.use(page, 'E', 'under', o.touch); await L.idle(page);
  for (let i = 0; i < 8; i++) {
    if (await S(page, (st) => st.objs.A.c.water < 0.2)) break;
    await L.use(page, 'rod', 'A', o.touch); await L.idle(page);
    await L.pour(page, 'A', 'F', null, { speed: 'fast', touch: o.touch });
    await L.speed(page, 10); await L.waitFor(page, (st) => st.objs.F.c.water < 12); await L.speed(page, 1);
  }
  if (await S(page, (st) => st.objs.A.c.sandC + st.objs.A.c.sandF > 5)) {
    await L.seg(page, '#washAmt', '20', o.touch);
    await L.use(page, 'wash', 'A', o.touch); await L.idle(page);
    await L.use(page, 'rod', 'A', o.touch); await L.idle(page);
    await L.pour(page, 'A', 'F', null, { speed: 'fast', touch: o.touch });
  }
  await L.speed(page, 30); await L.waitFor(page, (st) => st.drip.F < 0.01 && st.objs.F.c.water < 8); await L.speed(page, 1);
  await page.locator('[data-a="check"]').click();
  assert(await S(page, (st, M, app) => app.notes[2].goalAt != null), 'V2: Trennziel erreicht ' + JSON.stringify(await S(page, (st, M) => M.evaluate(st))));
  if (!o.skipTransfer) {
    await L.use(page, 'F', 'U', o.touch); await L.idle(page);
    assert(await S(page, (st, M) => st.objs.U.paper && M.sand(st.objs.U.c) > 15 && M.evaluate(st).done), 'V2: Filterpapier mit Rückstand auf dem Uhrglas, Ziel weiterhin erreicht');
  }
  await note(page, 'Im Filterpapier bleibt der Sand liegen. Unten tropft klares Wasser in den Erlenmeyerkolben. Das Filtrat ist klarer als beim Abgießen.', 'Die Sandkörner sind größer als die Poren im Papier.');
  await classify(page, 'het', 'suspension', ['korn']);
  assert(await isComplete(page, 2), 'V2 abgeschlossen');
}

export async function exp3(page, o = {}) {
  await L.exp(page, 3);
  await L.pour(page, 'A', 'D', null, { touch: o.touch });
  await L.seg(page, '#heatLevel', '2', o.touch);
  await L.speed(page, 30);
  await L.waitFor(page, (st) => st.objs.D.c.water < 2.5);
  await L.seg(page, '#heatLevel', '0', o.touch);
  await L.waitFor(page, (st) => st.objs.D.c.water < 0.5);
  await L.speed(page, 1);
  await page.locator('[data-a="check"]').click();
  assert(await S(page, (st, M, app) => app.notes[3].goalAt != null), 'V3: Trennziel erreicht');
  if (!o.skipTransfer) {
    await L.speed(page, 30); await L.waitFor(page, (st, M) => st.objs.D.c.water < 0.01 && st.objs.D.temp < M.HANDLE_T); await L.speed(page, 1);
    await L.use(page, 'D', 'U', o.touch); await L.idle(page);
    assert(await S(page, (st, M) => st.objs.U.c.saltS > 7 && M.evaluate(st).done), 'V3: Kristalle auf dem Uhrglas, Ziel weiterhin erreicht');
  }
  await note(page, 'Die klare Lösung siedet, es steigt Dunst auf. Die Flüssigkeit wird weniger, am Rand entstehen weiße Kristalle.', 'Das Wasser verdampft, das Salz bleibt zurück.');
  await classify(page, 'hom', 'loesung', ['fluecht']);
  assert(await isComplete(page, 3), 'V3 abgeschlossen');
}

export async function exp4(page, o = {}) {
  await L.exp(page, 4);
  await L.use(page, 'S', 'sepring', o.touch); await L.idle(page);
  await L.pour(page, 'A', 'S', null, { speed: 'fast', touch: o.touch });
  if (o.shake) await shakeOutside(page, o);
  await L.speed(page, 30); await L.waitFor(page, (st) => st.objs.S.emul < 0.005); await L.speed(page, 1);
  await L.use(page, 'B', 'sepunder', o.touch); await L.idle(page);
  // Hahn direkt am gezeichneten Scheidetrichter: zu → Tropfen → offen
  await cock(page, 2, o.touch);
  await L.waitFor(page, (st) => st.objs.S.c.water < 5);
  await cock(page, 1, o.touch, true);
  await L.waitFor(page, (st) => st.objs.S.c.water < 0.4);
  await cock(page, 0, o.touch, true);
  await L.use(page, 'B', 'B', o.touch); await L.idle(page); // erneutes Antippen stellt zurück
  await L.use(page, 'C', 'sepunder', o.touch); await L.idle(page);
  await cock(page, 2, o.touch);
  await L.waitFor(page, (st, M) => M.liq(st.objs.S.c) < 0.02);
  await cock(page, 0, o.touch);
  assert(!(await S(page, (st, M) => M.evaluate(st).criteria.some((c) => /schüttel/i.test(c.text)))), 'kein Schüttelkriterium');
  await page.locator('[data-a="check"]').click();
  assert(await S(page, (st, M, app) => app.notes[4].goalAt != null), 'V4: Trennziel erreicht ' + JSON.stringify(await S(page, (st, M) => M.evaluate(st))));
  await note(page, 'Zwei Schichten: oben gelbes Öl, unten Wasser. Unten läuft zuerst das Wasser heraus, die Grenzfläche sinkt.', 'Öl und Wasser mischen sich nicht; Öl hat die geringere Dichte.');
  await classify(page, 'het', 'emulsion', ['misch', 'dichte']);
  assert(await isComplete(page, 4), 'V4 abgeschlossen');
}

/** Hahn am Scheidetrichter antippen, bis die gewünschte Stellung erreicht ist (zu → Tropfen → offen → zu). */
export async function cock(page, level, touch, keyboard) {
  for (let i = 0; i < 3; i++) {
    if (await S(page, (st, M, app, a) => st.objs.S.cock === a, level)) return;
    if (keyboard) { await page.locator('#hits [data-hit="cock"]').focus(); await page.keyboard.press('Enter'); await sleep(60); }
    else await L.tapHit(page, 'cock', touch);
  }
  assert(await S(page, (st, M, app, a) => st.objs.S.cock === a, level), 'Hahnstellung ' + level);
}
/** Optionales Schütteln außerhalb des Rings: Stopfen auf, Hahn zu, in die Hand, schütteln, einhängen, Stopfen ab. */
export async function shakeOutside(page, o = {}) {
  await L.use(page, 'stop', 'S', o.touch); await L.idle(page);
  await L.use(page, 'S', 'hand', o.touch); await L.idle(page);
  const l = page.locator('#btnShake'); if (o.touch) await l.tap(); else await l.click();
  await L.idle(page);
  assert(await S(page, (st) => st.objs.S.emul > 0.9 && st.objs.S.at === 'hand'), 'geschüttelt in der Hand');
  await L.use(page, 'S', 'sepring', o.touch); await L.idle(page);
  await L.speed(page, 30); await L.waitFor(page, (st) => st.objs.S.emul < 0.005); await L.speed(page, 1);
  await L.tapHit(page, 'stop', o.touch); await L.idle(page); // Stopfen antippen: zurück auf die Ablage
  assert(await S(page, (st) => !st.objs.S.stopper && st.objs.stop.at === 'pStop'), 'Stopfen abgenommen');
}

export async function exp5(page, o = {}) {
  await L.exp(page, 5);
  await L.use(page, 'mag', 'M', o.touch); await L.idle(page); await L.tapHit(page, 'U', o.touch); await L.idle(page);
  await L.tapHit(page, 'M', o.touch); await L.idle(page); await L.tapHit(page, 'U', o.touch); await L.idle(page); // Magnet bleibt gewählt
  await L.tapHit(page, 'mag', o.touch); // Magnet wieder ablegen (abwählen)
  await L.pour(page, 'M', 'A', null, { speed: 'fast', touch: o.touch });
  await L.seg(page, '#washAmt', '20', o.touch);
  for (let i = 0; i < 2; i++) { await L.use(page, 'wash', 'A', o.touch); await L.idle(page); }
  await L.use(page, 'rod', 'A', o.touch); await L.idle(page);
  await L.use(page, 'paper', 'F', o.touch); await L.idle(page);
  for (let i = 0; i < 6; i++) {
    if (await S(page, (st) => st.objs.A.c.water < 0.2)) break;
    await L.use(page, 'rod', 'A', o.touch); await L.idle(page);
    await L.pour(page, 'A', 'F', null, { speed: 'fast', touch: o.touch });
    await L.speed(page, 10); await L.waitFor(page, (st) => st.objs.F.c.water < 8); await L.speed(page, 1);
  }
  await L.seg(page, '#washAmt', '5', o.touch);
  for (let i = 0; i < 2; i++) { await L.use(page, 'wash', 'F', o.touch); await L.idle(page); await L.speed(page, 30); await L.waitFor(page, (st) => st.drip.F < 0.01); await L.speed(page, 1); }
  await L.pour(page, 'E', 'D', null, { speed: 'fast', touch: o.touch });
  await L.seg(page, '#heatLevel', '2', o.touch); await L.speed(page, 30);
  await L.waitFor(page, (st) => st.objs.D.c.water < 2.5);
  await L.seg(page, '#heatLevel', '0', o.touch);
  await L.waitFor(page, (st) => st.objs.D.c.water < 0.5); await L.speed(page, 1);
  await page.locator('[data-a="check"]').click();
  assert(await S(page, (st, M, app) => app.notes[5].goalAt != null), 'V5: Trennziel erreicht ' + JSON.stringify(await S(page, (st, M) => M.evaluate(st))));
  await note(page, 'Am Magneten hängt nur das schwarze Eisen. Mit Wasser verschwindet das Salz, der Sand bleibt im Filter. Beim Eindampfen entstehen weiße Kristalle.', 'Magnetismus, Löslichkeit, Filter, Verdampfen.');
  await classify(page, 'het', 'gemenge', ['magn', 'loes', 'korn', 'fluecht']);
  assert(await isComplete(page, 5), 'V5 abgeschlossen');
}

/** Kontrolle zuerst mit Fehlern, dann korrigiert. Gibt Prüfdaten zurück. */
export async function quiz(page, shots) {
  await page.locator('#tab-quiz').click();
  await sleep(150);
  const data = await page.evaluate(() => window.TV.tasks.QUIZ.map((q) => ({ id: q.id, multi: q.multi, right: q.opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0), n: q.opts.length })));
  // falsch: bei jeder zweiten Frage eine falsche Option, sonst richtig
  for (const [k, q] of data.entries()) {
    const choose = k % 2 === 0 ? [[...Array(q.n).keys()].find((i) => !q.right.includes(i))] : q.right;
    for (const i of choose) await page.locator(`input[name="${q.id}"][value="${i}"]`).check();
  }
  const gaps = await page.evaluate(() => window.TV.tasks.GAPS.map((g) => [g.gap, g.accept[0]]));
  for (const [k, [g, v]] of gaps.entries()) await page.locator(`input[data-gap="${g}"]`).fill(k === 1 ? 'Filtration' : k === 4 ? 'rückstand' : k === 6 ? 'eindampfen' : v.toLowerCase());
  await page.locator('[data-a="qcheck"]').click(); await sleep(150);
  const marks1 = await page.evaluate(() => ({ wrong: document.querySelectorAll('.lk-opt.wrong').length, right: document.querySelectorAll('.lk-opt.right').length, gw: document.querySelectorAll('.cloze input.wrong').length, gr: document.querySelectorAll('.cloze input.right').length }));
  assert(marks1.wrong >= 5 && marks1.gw === 2, 'Fehler markiert ' + JSON.stringify(marks1));
  assert(!(await page.evaluate(() => window.TV.app.quizState().all)), 'noch nicht alles richtig');
  const nbLocked = await page.locator('#tab-notebook').click().then(() => page.locator('.locked').count());
  assert(nbLocked === 1, 'Hefteintrag gesperrt, solange die Kontrolle Fehler hat');
  await page.locator('#tab-quiz').click(); await sleep(100);
  const kept = await page.evaluate(() => Object.keys(window.TV.app.quiz.answers).length);
  assert(kept === data.length, 'Antworten bleiben erhalten');
  if (shots) await L.shot(page, shots + '-falsch');
  for (const [k, q] of data.entries()) {
    if (k % 2 !== 0) continue;
    for (let i = 0; i < q.n; i++) { const l = page.locator(`input[name="${q.id}"][value="${i}"]`); if (q.multi) { if (q.right.includes(i)) await l.check(); else await l.uncheck(); } else if (q.right.includes(i)) await l.check(); }
  }
  await page.locator(`input[data-gap="${gaps[1][0]}"]`).fill('Sedimentation');
  await page.locator(`input[data-gap="${gaps[4][0]}"]`).fill('Filtrat');
  await page.locator('[data-a="qcheck"]').click(); await sleep(150);
  assert(await page.evaluate(() => window.TV.app.quizState().all), 'Kontrolle vollständig richtig');
  if (shots) await L.shot(page, shots + '-richtig');
  return marks1;
}

export async function notebook(page) {
  await page.locator('#tab-notebook').click(); await sleep(150);
  const r = await page.evaluate(() => ({
    locked: !!document.querySelector('.locked'), cards: document.querySelectorAll('.nb .vcard').length,
    figs: document.querySelectorAll('.nb figure svg').length, own: document.querySelectorAll('.nb details.own').length,
    text: document.querySelector('.nb') ? document.querySelector('.nb').innerText : ''
  }));
  assert(!r.locked && r.cards === 5 && r.figs >= 4 && r.own === 5, 'Hefteintrag vollständig ' + JSON.stringify({ ...r, text: '' }));
  for (const w of ['Stoffebene', 'Teilchenebene', 'Aggregatzustände', 'Trennprinzip', 'keine neuen Stoffe', 'kein Aggregatzustand', 'Trennkette']) assert(r.text.includes(w), 'Hefteintrag enthält ' + w);
  return r;
}

export async function fullFlow(page, o = {}) {
  await exp1(page, o); await exp2(page, o); await exp3(page, o); await exp4(page, o); await exp5(page, o);
  await quiz(page, o.shots);
  return notebook(page);
}
