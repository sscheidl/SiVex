// Bedienhilfen für die Browserprüfung (ab 0.2.0): alle Schritte laufen über
// die Oberfläche (Klicks, Eingaben). page.evaluate dient nur zum Lesen von
// Zuständen (z. B. „Anzeige stabil?“) und zum Warten.

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function assert(cond, msg) { if (!cond) throw new Error(msg); }
export const de = (x, d = 2) => x.toFixed(d).replace('.', ',');

export async function act(page, action, extra = '') {
  await page.click(`[data-action="${action}"]${extra}`);
}

export async function confirm(page) {
  await page.waitForSelector('#modal:not([hidden])');
  await page.click('#modalActions .lk-btn.primary');
  await page.waitForSelector('#modal', { state: 'hidden' });
}

export async function labState(page) {
  return page.evaluate(() => {
    const l = Halbtitration.App.lab();
    return { v: l.addedRounded, pH: l.displayPH, stable: l.stable, settled: l.isSettled, reading: l.burette.reading, cal: l.calibration, electrode: l.electrodeIn, sample: l.sampleReady, water: l.waterReady, drops: l.drops.length, unmixed: l.unmixed, filled: l.burette.filled };
  });
}

export async function waitFor(page, fn, arg, timeout = 30000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 50 });
}
export async function waitStable(page) { await waitFor(page, () => { const l = Halbtitration.App.lab(); return l.isSettled && l.stable; }); }
export async function waitSettled(page) { await waitFor(page, () => Halbtitration.App.lab().isSettled); }

/** Versuch wählen (Chip über der Bühne) */
export async function chooseExp(page, id) {
  await page.click(`#expChips [data-id="${id}"]`);
}

/** Schritt im Bedienfeld aufklappen (Reiter „Aufgabe“) */
export async function openStep(page, id) {
  if (!(await page.$('.lk-tabs [data-tab="task"][aria-selected="true"]'))) await page.click('.lk-tabs [data-tab="task"]');
  if (!(await page.$(`.step[data-step="${id}"].open`))) await page.click(`.step[data-step="${id}"] .step-head`);
  await page.waitForSelector(`.step[data-step="${id}"].open`);
}

/** Geschlossene Frage beantworten und prüfen; liefert den Status */
export async function answer(page, qid, value) {
  await page.check(`input[name="q-${qid}"][value="${value}"]`);
  await page.click(`[data-action="q-check"][data-q="${qid}"]`);
  return page.evaluate((q) => (Halbtitration.App.es().answers[q] || {}).status, qid);
}

/** Richtige Antworten aller Fragen eines Schritts (aus den Inhaltsdaten gelesen) */
export async function answerAll(page, kind) {
  const qs = await page.evaluate((k) => {
    const C = Halbtitration.Content;
    const id = Halbtitration.App.exp().id;
    const list = k === 'half' ? C.halfQuestions(id) : C.trainer(id);
    return list.map((q) => ({ id: q.id, right: q.options.find((o) => o.correct).id, wrong: q.options.find((o) => !o.correct).id }));
  }, kind);
  for (const q of qs) {
    const st = await answer(page, q.id, q.right);
    assert(st === 'ok', 'Frage ' + q.id + ' nicht als richtig erkannt');
  }
  return qs;
}

/** Maßlösung an der Bürette wählen (Vorbereitung ①); liefert den Status der Wahl */
export async function chooseTitrant(page, value) {
  const sel = `[data-action="prep-burette"][data-titrant="${value}"]`;
  if (!(await page.$(sel)) && (await page.$('.prepline [data-action="toggle-prep"]'))) await act(page, 'toggle-prep');
  if (await page.$(sel)) await page.click(sel);
  return page.evaluate(() => (Halbtitration.App.es().answers.titrant || {}).status);
}

/** Messwerterfassung umschalten: 'auto' oder 'manual' */
export async function capture(page, mode) {
  await page.click(`[data-action="capture"][data-mode="${mode}"]`);
}

/** Probe und Geräte vorbereiten, bis gemessen werden kann */
/** Vorbereitung in Laborreihenfolge: (① Bürette vorher über chooseTitrant) ② Kalibrieren ③ Probe ④ Indikator ⑤ Rührer ⑥ Elektrode */
export async function prepare(page, { stir = true, indicator = null } = {}) {
  if (await page.$('[data-action="prep-meter"]:not([disabled])')) await act(page, 'prep-meter');
  await waitFor(page, () => Halbtitration.App.lab().calibration >= 2 && !Halbtitration.App.lab().calRunning);
  if (await page.$('[data-action="prep-sample"]:not([disabled])')) await act(page, 'prep-sample');
  await waitFor(page, () => { const l = Halbtitration.App.lab(); return l.sampleReady && l.waterReady; });
  if (indicator) {
    await page.selectOption('#deckIndicator', indicator);
    await act(page, 'indicator');
  }
  const on = await page.evaluate(() => Halbtitration.App.lab().stirrer);
  if (stir !== on) await page.click('.measure [data-action="stir"]');
  if (!(await page.evaluate(() => Halbtitration.App.lab().electrodeIn))) {
    await page.waitForSelector('[data-action="electrode"]:not([disabled])');
    await act(page, 'electrode');
  }
}

export async function fillField(page, id, value, check = true) {
  const sel = `[data-field="${id}"] input`;
  await page.fill(sel, value);
  if (check) {
    await page.click(`[data-field="${id}"] [data-action="check-field"]`);
    await page.waitForTimeout(30);
  }
  return page.evaluate((i) => Object.assign({}, Halbtitration.App.es().fields[i], { current: Halbtitration.Tasks.current(i).status }), id);
}

export async function setDose(page, size) {
  await page.click(`[data-action="dose-size"][data-size="${size}"]`);
}

export async function doseAndTake(page, size, { take = true, stable = true } = {}) {
  await setDose(page, size);
  await act(page, 'dose');
  await waitSettled(page);
  if (stable) await waitStable(page);
  if (take) await act(page, 'take');
}

export async function doseTo(page, target, size) {
  for (let i = 0; i < 400; i++) {
    const v = (await labState(page)).v;
    if (v >= target - 1e-6) return;
    const step = Math.min(size, Math.round((target - v) * 100) / 100);
    const s = Math.abs(step - 0.05) < 1e-9 ? 'drop' : [2, 1, 0.5, 0.2, 0.1].includes(step) ? step : null;
    if (s === null) { await doseAndTake(page, 0.1); continue; }
    await doseAndTake(page, s);
  }
}

/** Titrationskurve: grob, fein um alle ÄP, danach Überschuss; optional Endpunkt */
export async function surveyRun(page, eqs, vEnd, endpoint) {
  await waitStable(page);
  await act(page, 'take');
  let v = 0;
  let marked = false;
  const fine = eqs.map((e) => [e - 1.2, e + 1.0]);
  while (v < vEnd - 1e-6) {
    const inFine = fine.some(([a, b]) => v >= a - 1e-6 && v < b - 1e-6);
    const nextFine = fine.find(([a]) => a > v + 1e-6);
    let size = inFine ? 0.2 : 1;
    if (!inFine && nextFine && nextFine[0] - v < 1 - 1e-6) size = 0.2;
    await doseAndTake(page, size);
    const st = await labState(page);
    v = st.v;
    if (endpoint && !marked && (st.pH - endpoint.pH) * endpoint.dir >= 0) {
      await act(page, 'endpoint');
      await waitFor(page, () => !!Halbtitration.App.activeSeries().endpoint);
      marked = true;
    }
  }
  return marked;
}

export async function newSample(page, kind) {
  await page.click(`#seriesBar [data-action="new-sample"][data-kind="${kind}"]`);
  if (await page.$('#modal:not([hidden])')) await confirm(page);
  await page.waitForSelector('[data-action="prep-sample"]:not([disabled])');
}

export async function curveInk(page, canvasId) {
  return page.evaluate((id) => {
    const c = document.getElementById(id);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let blue = 0, orange = 0;
    for (let i = 0; i < d.length; i += 16) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (b > 180 && r < 80 && g > 80 && g < 140) blue++;
      if (r > 190 && g > 70 && g < 110 && b < 70) orange++;
    }
    return { blue, orange };
  }, canvasId);
}
