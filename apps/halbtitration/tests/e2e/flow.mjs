// Bedienhilfen für die Browserprüfung: alle Schritte laufen über die Oberfläche
// (Klicks, Eingaben). page.evaluate dient nur zum Lesen von Zuständen
// (z. B. „Anzeige stabil?“) und zum Warten.

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function assert(cond, msg) { if (!cond) throw new Error(msg); }

export const de = (x, d = 2) => x.toFixed(d).replace('.', ',');

/** Klick auf einen Knopf mit data-action (optional weiteres Attribut) */
export async function act(page, action, extra = '') {
  await page.click(`[data-action="${action}"]${extra}`);
}

/** Bestätigt einen offenen Dialog mit dem Hauptknopf */
export async function confirm(page) {
  await page.waitForSelector('#modal:not([hidden])');
  await page.click('#modalActions .btn.primary, #modalActions .btn.warn');
  await page.waitForSelector('#modal', { state: 'hidden' });
}

export async function labState(page) {
  return page.evaluate(() => {
    const l = Halbtitration.App.lab();
    return { v: l.addedRounded, pH: l.displayPH, stable: l.stable, settled: l.isSettled, reading: l.burette.reading, cal: l.calibration, electrode: l.electrodeIn, sample: l.sampleReady, water: l.waterReady, drops: l.drops.length, hanging: l.hanging, unmixed: l.unmixed };
  });
}

export async function waitFor(page, fn, arg, timeout = 30000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 50 });
}

export async function waitStable(page) {
  await waitFor(page, () => { const l = Halbtitration.App.lab(); return l.isSettled && l.stable; });
}

export async function waitSettled(page) {
  await waitFor(page, () => Halbtitration.App.lab().isSettled);
}

export async function plan(page, o) {
  await page.click('.phase[data-view="plan"]');
  await page.click(`[data-action="choose-exp"][data-id="${o.exp}"]`);
  await page.check(`input[name="titrant"][value="${o.titrant}"]`);
  if (o.stage) await page.check(`input[name="stage"][value="${o.stage}"]`);
  await page.check(`input[name="particle"][value="${o.particle}"]`);
  await page.check(`input[name="eqCat"][value="${o.eqCat}"]`);
  await page.check(`input[name="indicator"][value="${o.indicator}"]`);
  for (const r of o.reasons || ['jump']) await page.check(`input[name="reasons"][value="${r}"]`);
  await act(page, 'plan-check');
}

/** Probe vorbereiten bis zur Messbereitschaft; Anfangsstand ablesen und eintragen */
export async function prepare(page, { stir = true } = {}) {
  if (!(await labState(page)).sample) {
    await act(page, 'pipette');
    await waitFor(page, () => Halbtitration.App.lab().sampleReady);
  }
  if (!(await labState(page)).water) {
    await page.waitForSelector('[data-action="water"]:not([disabled])');
    await act(page, 'water');
    await waitFor(page, () => Halbtitration.App.lab().waterReady);
  }
  if (await page.$('[data-action="indicator"]:not([disabled])')) await act(page, 'indicator');
  const st = await labState(page);
  if (stir) {
    const on = await page.evaluate(() => Halbtitration.App.lab().stirrer);
    if (!on) await act(page, 'stir');
  }
  if (await page.$('[data-action="rinse"]:not([disabled])')) await act(page, 'rinse');
  if (await page.$('[data-action="fill"]:not([disabled])')) await act(page, 'fill');
  if (await page.$('[data-action="purge"]:not([disabled])')) await act(page, 'purge');
  if (st.cal < 2) {
    await act(page, 'cal1');
    await page.waitForSelector('[data-action="cal2"]:not([disabled])');
    await act(page, 'cal2');
    await waitFor(page, () => Halbtitration.App.lab().calibration >= 2);
  }
  await page.waitForSelector('[data-action="electrode"]:not([disabled])');
  if (!(await page.evaluate(() => Halbtitration.App.lab().electrodeIn))) await act(page, 'electrode');
  const reading = (await labState(page)).reading;
  await fillField(page, await startFieldId(page), de(reading));
  return reading;
}

export async function startFieldId(page) {
  return page.$eval('[data-field^="read_start_"]', (el) => el.dataset.field);
}

export async function fillField(page, id, value, check = true) {
  const sel = `[data-field="${id}"] input`;
  await page.fill(sel, value);
  if (check) {
    await page.click(`[data-field="${id}"] [data-action="check-field"]`);
    await page.waitForTimeout(30);
  }
  return page.evaluate((i) => Halbtitration.App.es().fields[i], id);
}

export async function setDose(page, size) {
  await page.click(`[data-action="dose-size"][data-size="${size}"]`);
}

/** Eine Zugabe der eingestellten Größe; wartet auf Ankunft und stabile Anzeige, übernimmt den Messwert */
export async function doseAndTake(page, size, { take = true, stable = true } = {}) {
  await setDose(page, size);
  await act(page, 'dose');
  await waitSettled(page);
  if (stable) await waitStable(page);
  if (take) await act(page, 'take');
}

/** Dosiert in Schritten bis zum Volumen target (mL) */
export async function doseTo(page, target, size) {
  for (let i = 0; i < 400; i++) {
    const v = (await labState(page)).v;
    if (v >= target - 1e-6) return;
    const step = Math.min(size, Math.round((target - v) * 100) / 100);
    const s = Math.abs(step - 0.05) < 1e-9 ? 'drop' : [2, 1, 0.5, 0.2, 0.1].includes(step) ? step : null;
    if (s === null) { await doseAndTake(page, size === 'drop' ? 'drop' : 0.1); continue; }
    await doseAndTake(page, s);
  }
}

/** Messkurve des Erstdurchgangs: grob, fein um alle ÄP, danach Überschuss */
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
    // Endpunkt wie Lernende: sobald die bleibende Umschlagsfarbe erreicht ist
    if (endpoint && !marked && (st.pH - endpoint.pH) * endpoint.dir >= 0) {
      await act(page, 'endpoint');
      await waitFor(page, () => !!Halbtitration.App.activeSeries().endpoint);
      marked = true;
    }
  }
  return marked;
}

export async function finishSeries(page) {
  await act(page, 'finish');
  await confirm(page);
}

export async function newSample(page, kind) {
  await act(page, 'new-sample', `[data-kind="${kind}"]`);
  if (await page.$('#modal:not([hidden])')) await confirm(page);
  await page.waitForSelector('[data-action="pipette"]:not([disabled])');
}

export async function setMarker(page, key, v) {
  await page.click(`[data-action="cmode"][data-marker="${key}"]`);
  await page.fill('#markerIn', de(v));
  await act(page, 'marker-set');
}

export async function fieldStatus(page, id) {
  return page.evaluate((i) => (Halbtitration.App.es().fields[i] || {}).status, id);
}

/** Pixel der Titrationskurve: Anzahl farbiger (blauer/oranger) Pixel in der Zeichenfläche */
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
