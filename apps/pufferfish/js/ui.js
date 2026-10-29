/*
 * Pufferfish – Oberfläche: Dosierleiste, Zusatzansicht, Seiten, Messwertkarten,
 * Speichern (localStorage, nur im eigenen Browser) und Journal-Export.
 * Keine Übertragung von Daten; keine Lösungen im Export, solange sie nicht
 * ausdrücklich angefordert wurden.
 */
(function (root) {
  'use strict';
  const { chem: C, engine: E, learn: L, particles: PV, chart: CH } = root.PF;
  const core = root.LK.core;
  const fmt = core.fmt;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LETTER = (i) => String.fromCharCode(65 + i);
  /** Speicherstand 0.2.0. Der Stand 0.1.0 (…v1) wird bewusst nicht gelesen und nicht verändert. */
  const STORE = 'sivex.pufferfish.v2';
  const de = (v, d) => fmt(v, d);
  const RANGE_LG = 1.5;

  function createUI(eng, lab) {
    const ui = {
      page: 'lab', tab: 'task', speed: 1, target: 'all', indicator: true, reduceMotion: false, zoom: false, pka: false, compare: '',
      view: { e1: 'main', e2: 'main', e3: 'main' },
      seed: Math.floor(Math.random() * 4294967295) + 1, order: {},
      answers: {}, checked: {}, fails: {}, tips: {}, sol: {}, confirmSol: null,
      theory: {}, tasks: {}, apps: {}, forced: {},
      mix: { target: null, custom: '', customMsg: null, system: null, pick: null, entries: { r: '', vb: '', va: '' }, res: null, checked: false, tip: 0, sol: false, msg: null }
    };
    const views = []; // Teilchenansichten der aktuellen Reihe
    let mixView = null;
    let orderDirty = false, viewSeries = null, tagsSig = '', readSig = '', chartSig = '', extraSig = '', toastTimer = 0, saveTimer = 0, saveWarned = false;

    // ---------------------------------------------------------- Hilfen
    const exp = () => E.expById(eng.state.exp);
    const series = () => eng.current();
    const sampleName = (key) => E.SAMPLES[key].name;
    const stepDone = (t) => { const st = ui.theory[t.id]; return !!(st && (st.sol || st.ok)); };
    const answered = (e, q) => { const v = (ui.answers[e] || {})[q]; return Array.isArray(v) ? v.length > 0 : !!v; };
    /** Die Herleitung öffnet nach der eigenen Deutung in Versuch 1 (oder Lösung / bewusstes Öffnen). */
    const theoryOpen = () => answered('e1', 'd1') || !!ui.sol.e1 || !!ui.forced.theory;
    const theoryDone = () => L.THEORY.every(stepDone);
    const tasksOpen = () => theoryDone() || !!ui.forced.tasks;
    const taskTried = (t) => { const s = ui.tasks[t.id]; return !!(s && (s.checked || s.sol)); };
    const appsOpen = () => L.TASKS.every(taskTried) || !!ui.forced.apps;
    const numbersOpen = () => theoryDone();
    /** Versuch 3 baut auf der Herleitung auf; die sechs Rechenaufgaben sind dafür nicht nötig. */
    const mixOpen = () => true; // 0.2.1: Versuch 3 ohne Voraussetzung (in einer Einzelstunde nutzbar)
    const reagentName = (r) => (E.REAGENTS[r] ? E.REAGENTS[r].formula : r);
    const isMix = () => !!exp().mixing;
    const sysObj = () => (ui.mix.system ? C.SYSTEMS[ui.mix.system] : null);
    const curView = () => ui.view[eng.state.exp] || 'main';
    const G = () => root.PF.geometry;

    function toast(text) {
      const t = $('#toast'); t.textContent = text; t.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
    }

    // ---------------------------------------------------------- Speichern
    function snapshot() { return { v: 2, ui: Object.assign({}, ui, { confirmSol: null }), engine: eng.serialize() }; }
    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try { root.localStorage.setItem(STORE, JSON.stringify(snapshot())); } catch (e) { if (!saveWarned) { saveWarned = true; toast('Speichern im Browser ist nicht möglich – nach dem Neuladen beginnt der Versuch neu.'); } }
      }, 400);
    }
    function saveNow() { try { root.localStorage.setItem(STORE, JSON.stringify(snapshot())); } catch (e) { /* ohne Speicher */ } }
    function load() {
      let o = null;
      try { o = JSON.parse(root.localStorage.getItem(STORE) || 'null'); } catch (e) { o = null; }
      if (!o || o.v !== 2) return false;
      if (o.ui && typeof o.ui === 'object') {
        for (const k of Object.keys(ui)) if (k in o.ui && o.ui[k] != null) ui[k] = o.ui[k];
        ui.view = Object.assign({ e1: 'main', e2: 'main', e3: 'main' }, ui.view);
        ui.mix = Object.assign({ target: null, custom: '', customMsg: null, system: null, pick: null, entries: { r: '', vb: '', va: '' }, res: null, checked: false, tip: 0, sol: false, msg: null }, ui.mix);
        if (!ui.order || typeof ui.order !== 'object') ui.order = {};
        if (!Number.isFinite(ui.seed)) ui.seed = Math.floor(Math.random() * 4294967295) + 1;
      }
      ui.confirmSol = null;
      if (!['lab', 'theory', 'tasks', 'apps'].includes(ui.page)) ui.page = 'lab';
      const ok = eng.restore(o.engine);
      if (!ok) return false;
      // Versuch 3: gespeicherte Auswahl mit dem Engine-Zustand abgleichen
      if (eng.state.system !== ui.mix.system) { ui.mix.system = eng.state.system; if (!ui.mix.system) { ui.mix.checked = false; ui.mix.res = null; } }
      return true;
    }

    // ---------------------------------------------------------- Evidenz aus eigenen Messungen
    function evidence() {
      const out = {};
      const note = (expId, reagent, mL) => { out[expId] = out[expId] || {}; out[expId][reagent] = Math.max(out[expId][reagent] || 0, mL); };
      for (const id in eng.state.series) {
        const s = eng.state.series[id];
        if (s.kind !== 'fresh') continue;
        note(s.exp, s.reagent, Math.min(...s.beakers.map((b) => b.added)));
      }
      for (const a of eng.state.archive) if (a.kind === 'fresh') note(a.exp, a.reagent, Math.min(...a.runs.map((r) => r.records[r.records.length - 1].v)));
      const ev = {};
      for (const e in out) {
        ev[e] = {};
        for (const r in out[e]) ev[e][r] = out[e][r] > 0;
      }
      return ev;
    }

    // ---------------------------------------------------------- Stabil gemischte Antwortreihenfolge
    /** Antwortoptionen in gespeicherter, gemischter Reihenfolge (Bewertung bleibt an den Antwort-IDs). */
    function ordered(key, items, idOf) {
      const ids = items.map(idOf);
      const had = ui.order[key];
      const o = L.orderFor(ui.order, ui.seed, key, ids);
      if (had !== ui.order[key]) orderDirty = true; // neu erzeugte Reihenfolge wird mit gespeichert
      return o.map((id) => items[ids.indexOf(id)]);
    }

    // ---------------------------------------------------------- Kopfzeile und Seiten
    function setPage(p) {
      ui.page = p;
      renderSteps(); renderPage(); save();
    }
    function renderSteps() {
      document.querySelectorAll('#steps button').forEach((b) => {
        const p = b.dataset.page;
        if (p === ui.page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        const open = p === 'lab' || ({ theory: theoryOpen, tasks: tasksOpen, apps: appsOpen }[p])();
        b.classList.toggle('locked', !open);
      });
    }
    function renderPage() {
      const page = $('#page');
      if (ui.page === 'lab') { page.hidden = true; return; }
      page.hidden = false;
      const body = $('#pageBody');
      body.innerHTML = ui.page === 'theory' ? theoryHtml() : ui.page === 'tasks' ? tasksHtml() : appsHtml();
      page.scrollTop = page.scrollTop; // Position halten
      if (orderDirty) { orderDirty = false; save(); }
    }
    function lockHtml(title, need, key, go) {
      return `<div class="lk-card lockcard"><h2>${esc(title)}</h2><p>${need}</p>
        <p class="lk-muted">Dieser Teil baut auf deinen eigenen Beobachtungen bzw. Rechnungen auf. Für Wiederholung oder Unterricht kannst du ihn trotzdem öffnen.</p>
        <div class="lk-row"><button type="button" class="lk-btn" data-go="${go || 'lab'}">${go === 'theory' ? 'Zur Herleitung' : 'Zurück ins Labor'}</button><button type="button" class="lk-btn" data-force="${key}">Trotzdem öffnen</button></div></div>`;
    }

    // ---------------------------------------------------------- Herleitung
    function retroSvg() {
      // Rückblick: Titrationskurve (aus dem Modell berechnet), Halbäquivalenzpunkt markiert
      const W = 440, H = 210, L0 = 36, B0 = 28;
      const X = (v) => L0 + (v / 30) * (W - L0 - 10), Y = (p) => 8 + (1 - p / 14) * (H - B0 - 8);
      let d = '';
      for (let v = 0; v <= 30.0001; v += 0.25) { const p = C.pH(C.add(C.acetate(20, 0.1, 0), 'NaOH', v)); d += (v ? 'L' : 'M') + X(v).toFixed(1) + ' ' + Y(p).toFixed(1); }
      const grid = [0, 2, 4, 6, 8, 10, 12, 14].map((p) => `<line x1="${L0}" x2="${W - 10}" y1="${Y(p)}" y2="${Y(p)}" stroke="#e3e9ef"/><text x="${L0 - 5}" y="${Y(p) + 4}" font-size="10" text-anchor="end" fill="#5c6b7a">${p}</text>`).join('');
      const xt = [0, 10, 20, 30].map((v) => `<text x="${X(v)}" y="${H - B0 + 13}" font-size="10" text-anchor="middle" fill="#5c6b7a">${v}</text>`).join('');
      return `<svg class="retro" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rückblick: Titrationskurve von 20 mL Essigsäure (0,10 mol/L) mit Natronlauge (0,10 mol/L); am Halbäquivalenzpunkt bei 10 mL gilt pH = pKs = 4,75">
        ${grid}${xt}<line x1="${L0}" y1="${Y(0)}" x2="${W - 10}" y2="${Y(0)}" stroke="#8796a5"/><line x1="${L0}" y1="8" x2="${L0}" y2="${Y(0)}" stroke="#8796a5"/>
        <path d="${d}" fill="none" stroke="#1f6fd1" stroke-width="2"/>
        <line x1="${X(10)}" x2="${X(10)}" y1="${Y(4.75)}" y2="${Y(0)}" stroke="#0b7285" stroke-dasharray="4 3"/><line x1="${L0}" x2="${X(10)}" y1="${Y(4.75)}" y2="${Y(4.75)}" stroke="#0b7285" stroke-dasharray="4 3"/>
        <circle cx="${X(10)}" cy="${Y(4.75)}" r="4.5" fill="#0b7285"/>
        <text x="${X(10) + 8}" y="${Y(4.75) + 14}" font-size="11" fill="#0b7285" font-weight="700">Halbäquivalenzpunkt: n(HA) = n(A⁻), pH = pKₛ</text>
        <text x="${(L0 + W) / 2}" y="${H - 3}" font-size="10.5" text-anchor="middle" fill="#3d4b5a">V(NaOH) in mL</text></svg>`;
    }
    function fieldHtml(prefix, f, val, res, unit) {
      const cls = res ? (res.ok ? 'right' : res.empty ? '' : 'wrong') : '';
      const fb = res && res.empty ? '<p class="ffb lk-muted">noch nicht beantwortet</p>' : res ? `<p class="ffb ${res.ok ? 'y' : 'n'}">${res.ok ? '✓ richtig' : '✗ ' + esc(res.fb)}${res.kind && !res.ok ? ` <span class="badge warn">${{ unit: 'Einheit', stoich: 'Stöchiometrie', quotient: 'Quotient', log: 'Logarithmus', calc: 'Rechnung', concept: 'Ansatz', format: 'Eingabe', swap: 'vertauscht', sum: 'Summe', range: 'Bereich' }[res.kind] || ''}</span>` : ''}</p>` : '';
      const name = `${prefix}:${f.id}`;
      if (f.type === 'select') {
        return `<div class="frow sel"><span class="flabel">${esc(f.label)}</span><select data-f="${name}" class="${cls}" aria-label="${esc(f.label)}"><option value="">– wählen –</option>${ordered('f:' + name, f.options, (o) => o).map((o) => `<option ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${fb}</div>`;
      }
      if (f.type === 'radio') {
        return `<div class="frow"><span class="flabel">${esc(f.label)}</span><div class="radios">${ordered('f:' + name, f.options, (o) => o).map((o) => `<label class="lk-opt ${val === o ? (res && !res.empty ? (res.ok ? 'right' : 'wrong') : '') : ''}"><input type="radio" name="${name}" data-f="${name}" value="${esc(o)}" ${val === o ? 'checked' : ''}> <span>${esc(o)}</span></label>`).join('')}</div>${fb}</div>`;
      }
      if (f.type === 'amount') {
        return `<div class="frow"><span class="flabel">${esc(f.label)} =</span><input type="text" inputmode="decimal" data-f="${name}" class="${cls}" value="${esc(val || '')}" aria-label="${esc(f.label)}" autocomplete="off"><select data-u="${name}" aria-label="Einheit für ${esc(f.label)}"><option value="">Einheit</option>${L.UNITS.map((u) => `<option ${unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>${fb}</div>`;
      }
      return `<div class="frow"><span class="flabel">${esc(f.label)}</span><input type="text" inputmode="decimal" data-f="${name}" class="${cls}" value="${esc(val || '')}" aria-label="${esc(f.label)}" autocomplete="off">${fb}</div>`;
    }
    function tipsHtml(hints, n) { return n ? `<div class="lk-card tipbox">${hints.slice(0, n).map((h, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(h)}</p>`).join('')}</div>` : ''; }
    const tipLabel = (n) => (n ? (n < 3 ? `Nächster Tipp (${n + 1}/3)` : 'Tipp 3/3') : 'Tipp');

    function theoryHtml() {
      if (!theoryOpen()) return lockHtml('Herleitung', 'Führe zuerst Versuch 1 durch und beantworte im Reiter <b>Aufgabe</b> die <b>Deutung</b> („Was muss die Pufferlösung enthalten?“).', 'theory');
      let open = true;
      const steps = L.THEORY.map((t, i) => {
        const st = ui.theory[t.id] || {};
        const locked = !open;
        const done = stepDone(t);
        if (!done) open = false;
        const res = st.res || {};
        return `<section class="tstep ${locked ? 'locked' : ''} ${done ? 'done' : ''}" data-step="${t.id}">
          <h2><span class="n">${i + 1}</span>${esc(t.title)} ${done ? '<span class="lk-mark y">✓</span>' : ''}</h2>
          ${t.intro ? `<p>${esc(t.intro)}</p>` : ''}
          ${locked ? '<p class="lk-muted">Wird nach dem vorherigen Schritt freigeschaltet.</p>' : `
          <div class="fields">${t.fields.map((f) => fieldHtml(t.id, f, (st.vals || {})[f.id], res[f.id])).join('')}</div>
          ${st.sol ? `<p class="lk-note info"><b>Lösung:</b> ${esc(t.solution)}</p>` : ''}
          ${tipsHtml(t.hints, st.tip || 0)}
          ${st.fails >= 2 && !st.tip && !done ? '<div class="lk-note info">Möchtest du einen Tipp? <button type="button" class="lk-btn small" data-th="tip" data-id="' + t.id + '">Tipp 1/3 anzeigen</button></div>' : ''}
          <div class="lk-row">${done ? '' : `<button type="button" class="lk-btn primary" data-th="check" data-id="${t.id}">Prüfen</button>`}
          <button type="button" class="lk-btn" data-th="tip" data-id="${t.id}">${tipLabel(st.tip || 0)}</button>
          ${st.sol ? '' : `<button type="button" class="lk-btn" data-th="sol" data-id="${t.id}">Lösung dieses Schritts</button>`}</div>`}
        </section>`;
      }).join('');
      const all = theoryDone();
      return `<h1>Herleitung: aus der beobachteten Reaktion zur Puffergleichung</h1>
        <p class="lead">Du hast gesehen: Zugegebene H₃O⁺-Ionen reagieren mit der Base A⁻, zugegebene OH⁻-Ionen mit der Säure HA. Wie hängt der pH-Wert von der Zusammensetzung ab?</p>
        <div class="cols"><div class="lk-card"><h3>Rückblick (aus dem Titrationslabor)</h3>${retroSvg()}<p class="meta">Bei der Halbtitration einer schwachen Säure liegen HA und A⁻ in gleicher Stoffmenge nebeneinander – genau so ein Gemisch ist ein Puffer. (Kurve aus dem Modell dieser App berechnet; kein Teil des Versuchs.)</p></div>
        <div class="lk-card reveal"><h3>Zusammensetzung der Pufferlösung aus Versuch 1</h3><p>30,0 mL Phosphatpufferlösung, c(H₂PO₄⁻) = c(HPO₄²⁻) = 0,050 mol/L (als Natriumsalze). Säure: H₂PO₄⁻, Base: HPO₄²⁻, pKₛ₂ = 7,20. Im idealen Modell ergibt das pH ≈ 7,20.</p><p class="meta">Ein zertifizierter „pH-7-Kalibrierpuffer“ ist nicht automatisch ein ideales 1 : 1-Gemisch mit pH 7,00 (Aktivitäten, Temperatur).</p></div></div>
        ${steps}
        ${all ? `<section class="tstep done"><h2>Ergebnis</h2><span class="eqline">pH = pKₛ + lg [ c(A⁻) / c(HA) ]</span>
          <p><b>Gültigkeit:</b> In Aktivitäten formuliert ist die Gleichung eine exakte Umformung des Gleichgewichts. Die übliche Konzentrationsform und das Einsetzen formaler Stoffmengen sind Näherungen. Beide Partner müssen in geeigneter Menge vorliegen. Zugegebene starke Säure bzw. Base erst stöchiometrisch umsetzen, dann das neue Verhältnis einsetzen. Ist ein Partner verbraucht, darf man nicht logarithmieren – dann bestimmt der Überschuss den pH-Wert. Die App rechnet intern mit der vollständigen Ladungsbilanz weiter.</p>
          <p><b>Pufferbereich ≠ Pufferkapazität:</b> Der Bereich (≈ pKₛ ± 1) sagt, <i>wo</i> ein Paar puffert. Die Kapazität sagt, <i>wie viel</i> Säure oder Base es umsetzen kann; sie wächst mit den Stoffmengen. Bei gegebener Gesamtkonzentration ist die (differentielle) Pufferwirkung nahe gleichen Anteilen am größten; die Reserve für weitere Säure hängt von n(A⁻), die für weitere Lauge von n(HA) ab.</p>
          <p class="lk-note ok">Jetzt kannst du im Labor <b>Versuch 3</b> durchführen: einen Puffer mit vorgegebenem pH-Wert berechnen, herstellen und messen. Die <button type="button" class="lk-btn small" data-go="tasks">3 Rechnen</button>-Aufgaben stehen dir zusätzlich offen.</p></section>` : ''}`;
    }

    // ---------------------------------------------------------- Rechenaufgaben
    function tasksHtml() {
      if (!tasksOpen()) return lockHtml('Rechnen', 'Schließe zuerst die <b>Herleitung</b> ab (alle sieben Schritte geprüft oder gelöst).', 'tasks', 'theory');
      const cards = L.TASKS.map((t) => {
        const st = ui.tasks[t.id] || {};
        const res = st.res || {};
        const allOk = t.fields.every((f) => res[f.id] && res[f.id].ok);
        return `<section class="tstep ${allOk ? 'done' : ''}" data-task="${t.id}"><h2><span class="n">${t.n}</span>${esc(t.title)} ${allOk ? '<span class="lk-mark y">✓</span>' : ''}</h2>
          <p>${esc(t.text)}</p>
          ${t.fields.map((f) => fieldHtml(t.id, f, (st.vals || {})[f.id], res[f.id], (st.units || {})[f.id])).join('')}
          <div class="frow"><span class="flabel">Dein Rechenweg (freiwillig, wird nicht bewertet):</span><input type="text" class="wide" data-note="${t.id}" value="${esc(st.note || '')}" aria-label="Rechenweg zu Aufgabe ${t.n}" autocomplete="off" style="flex:1;min-width:200px"></div>
          ${st.sol ? `<p class="lk-note info"><b>Rechenweg:</b> ${esc(t.solution)}</p>` : ''}
          ${ui.confirmSol === 'task:' + t.id ? `<div class="lk-note warn" role="alert">Du hast diese Aufgabe noch nicht geprüft. Rechenweg trotzdem anzeigen?<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" data-tk="solYes" data-id="${t.id}">Ja, anzeigen</button><button type="button" class="lk-btn" data-tk="solNo" data-id="${t.id}">Abbrechen</button></div></div>` : ''}
          ${tipsHtml(t.hints, st.tip || 0)}
          ${st.fails >= 2 && !st.tip && !allOk ? `<div class="lk-note info">Möchtest du einen Hinweis? <button type="button" class="lk-btn small" data-tk="tip" data-id="${t.id}">Tipp 1/3 anzeigen</button></div>` : ''}
          <div class="lk-row"><button type="button" class="lk-btn primary" data-tk="check" data-id="${t.id}">Prüfen</button><button type="button" class="lk-btn" data-tk="tip" data-id="${t.id}">${tipLabel(st.tip || 0)}</button>${st.sol ? '' : `<button type="button" class="lk-btn" data-tk="sol" data-id="${t.id}">Rechenweg anzeigen</button>`}</div></section>`;
      }).join('');
      return `<h1>Selbst rechnen</h1><p class="lead">Sechs kurze Aufgaben. Gib Ergebnisse mit Dezimalkomma ein; bei Stoffmengen wählst du die Einheit. Rückmeldung erst nach „Prüfen“; richtige Teilergebnisse bleiben erhalten.</p>
        <details class="help"><summary>Formelhilfe und Daten (25 °C, Acetat/Phosphat/Ammonium)</summary>
          <p>pH = pKₛ + lg [c(A⁻)/c(HA)] · n = c · V · im selben Gemisch: c(A⁻)/c(HA) = n(A⁻)/n(HA) · 10^x ist die Umkehrung von lg x</p>
          <table class="datatable"><tr><th>Paar</th><th>pKₛ</th></tr><tr><td>CH₃COOH / CH₃COO⁻</td><td>4,75</td></tr><tr><td>H₃PO₄ / H₂PO₄⁻</td><td>2,15</td></tr><tr><td>H₂PO₄⁻ / HPO₄²⁻</td><td>7,20</td></tr><tr><td>HPO₄²⁻ / PO₄³⁻</td><td>12,35</td></tr><tr><td>NH₄⁺ / NH₃</td><td>9,25</td></tr><tr><td>CO₂* / HCO₃⁻ (Blut, 37 °C, effektiv)</td><td>6,1</td></tr></table>
          <p class="lk-muted">Tabellenwerte üblicher Lehrbuchtabellen weichen um wenige Hundertstel ab (z. B. 4,74/4,76).</p></details>
        ${cards}
        ${appsOpen() ? '<p class="lk-note ok">Weiter mit <button type="button" class="lk-btn small" data-go="apps">4 Anwendungen</button></p>' : ''}`;
    }

    // ---------------------------------------------------------- Anwendungen
    function appsHtml() {
      if (!appsOpen()) return lockHtml('Puffer in Natur und Technik', 'Bearbeite zuerst alle <b>sechs Rechenaufgaben</b> (jeweils mindestens einmal prüfen).', 'apps', 'tasks');
      const cards = L.APPLICATIONS.map((a) => {
        const q = a.q, val = ui.apps[q.id], st = ui.apps[q.id + ':res'];
        return `<section class="tstep" data-app="${a.id}"><h2>${esc(a.title)}</h2>
          <dl class="facts"><dt>Paar</dt><dd>${esc(a.pair)}</dd><dt>Zweck</dt><dd>${esc(a.purpose)}</dd><dt>pH-Bezug</dt><dd>${esc(a.ph)}</dd><dt>Modellgrenze</dt><dd>${esc(a.limit)}</dd></dl>
          <fieldset class="lk-form" style="border:0;padding:0;margin:0"><legend style="font-weight:700">${esc(q.text)}</legend>
          ${ordered('q:' + q.id, q.options, (o) => o.v).map((o) => `<label class="lk-opt ${st && val === o.v ? (o.ok ? 'right' : 'wrong') : ''}"><input type="radio" name="app:${q.id}" data-app-q="${q.id}" value="${o.v}" ${val === o.v ? 'checked' : ''}> <span>${esc(o.t)}</span></label>`).join('')}</fieldset>
          ${st ? `<p class="ffb ${st.status === 'right' ? 'y' : 'n'}">${st.status === 'right' ? '✓ ' : '✗ '}${esc(st.fb)}</p>` : ''}
          ${ui.apps[q.id + ':sol'] ? `<p class="lk-note info">Lösung: ${esc(q.options.find((o) => o.ok).t)}</p>` : ''}
          <div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" data-ap="check" data-id="${q.id}">Prüfen</button>${ui.apps[q.id + ':sol'] ? '' : `<button type="button" class="lk-btn" data-ap="sol" data-id="${q.id}">Lösung anzeigen</button>`}</div></section>`;
      }).join('');
      return `<h1>Puffer in Natur und Technik</h1><p class="lead">Vier kompakte Fälle. Je Fall: wirksames Paar, Zweck, pH-Bezug und eine Grenze des Modells – dazu eine eigene Entscheidung.</p><div class="cols">${cards}</div>
        <p class="lk-muted">Hinweis: Diese Fälle sind fachliche Beispiele, keine medizinische Diagnostik oder Gesundheitsberatung.</p>`;
    }

    // ---------------------------------------------------------- Bedienfeld
    function renderPanel() {
      document.querySelectorAll('.lk-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
      const body = $('#panelBody');
      const y = $('#panel').scrollTop;
      body.innerHTML = ui.tab === 'task' ? taskHtml() : ui.tab === 'results' ? resultsHtml() : ui.tab === 'journal' ? journalHtml() : notebookHtml();
      $('#panel').scrollTop = y;
      if (orderDirty) { orderDirty = false; save(); }
    }

    function questionHtml(e, q, res) {
      const a = (ui.answers[e] || {})[q.id];
      const sol = ui.sol[e];
      if (q.type === 'free') {
        return `<fieldset class="freeq"><legend>${esc(q.text)}</legend><p class="expect"><b>Erwartet:</b> ${esc(q.expect)} <span class="lk-muted">${esc(q.note)}</span></p><textarea data-free="${q.id}" rows="4" placeholder="Deine Antwort in 1–3 Sätzen …" aria-label="${esc(q.text)}">${esc(a || '')}</textarea></fieldset>`;
      }
      const r = res && res[q.id];
      const cls = r ? (r.status === 'right' ? 'fb-right' : r.status === 'unproven' ? 'fb-unproven' : r.status === 'empty' ? '' : 'fb-wrong') : '';
      const multi = q.type === 'multi';
      const opts = ordered('q:' + q.id, q.options, (o) => o.v).map((o) => {
        const chosen = multi ? (a || []).includes(o.v) : a === o.v;
        let oc = '', mark = '';
        if (r && chosen) {
          const m = multi ? (r.marks || {})[o.v] : (r.status === 'right' ? 'y' : 'n');
          oc = m === 'y' ? 'right' : m === 'u' ? 'unproven' : m === 'n' ? 'wrong' : '';
          mark = m === 'y' ? '<span class="lk-mark y">✓</span>' : m === 'n' ? '<span class="lk-mark n">✗</span>' : m === 'u' ? '<span class="lk-mark u">?</span>' : '';
        }
        return `<label class="lk-opt ${oc}"><input type="${multi ? 'checkbox' : 'radio'}" name="q-${q.id}" data-q="${q.id}" value="${o.v}" ${chosen ? 'checked' : ''}> <span>${esc(o.t)}</span>${mark}</label>`;
      }).join('');
      const fb = r && r.status !== 'empty' ? `<p class="lk-fb ${r.status === 'right' ? 'y' : 'n'}">${esc(r.fb)}</p>` : r ? `<p class="lk-fb n">${esc(r.fb)}</p>` : '';
      const tip = ((ui.tips[e] || {})[q.id]) || 0;
      return `<fieldset class="${cls}" data-qid="${q.id}"><legend>${esc(q.text)}</legend>${opts}${fb}${tipsHtml(q.hints || [], tip)}${sol ? `<p class="lk-note info"><b>Lösung:</b> ${esc(q.solution)}</p>` : ''}</fieldset>`;
    }

    function gradeAll(e) {
      const ev = evidence(), P = L.PROTOCOLS[e], out = {};
      for (const q of P.questions) if (q.type !== 'free') out[q.id] = L.gradeQuestion(q, (ui.answers[e] || {})[q.id], ev);
      return out;
    }

    function protoFormHtml(e) {
      const P = L.PROTOCOLS[e];
      const res = ui.checked[e] ? gradeAll(e) : null;
      let lastStep = '', h = '<form class="lk-form" id="protoForm">';
      P.questions.forEach((q) => {
        if (q.step !== lastStep) { h += `<p class="qstep">${esc(q.step)}</p>`; lastStep = q.step; }
        h += questionHtml(e, q, res);
      });
      h += '<div class="lk-row end">';
      h += '<button type="submit" class="lk-btn primary">Antworten prüfen</button>';
      h += '<button type="button" class="lk-btn" id="btnTip">Tipp</button>';
      h += ui.sol[e] ? '' : '<button type="button" class="lk-btn" id="btnSol">Lösung anzeigen</button>';
      h += '</div></form>';
      if (ui.confirmSol === 'proto:' + e) h += '<div class="lk-note warn" role="alert">Du hast noch nicht alles bearbeitet. Lösung trotzdem anzeigen?<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnSolYes">Ja, Lösung anzeigen</button><button type="button" class="lk-btn" id="btnSolNo">Abbrechen</button></div></div>';
      if ((ui.fails[e] || 0) >= 2 && res && !Object.values(res).every((r) => r.status === 'right')) h += '<div class="lk-note info">Das hat noch nicht ganz geklappt. Ein Tipp hilft dir weiter – Schaltfläche „Tipp“.</div>';
      return h;
    }

    function taskHtml() {
      const e = eng.state.exp, x = exp(), P = L.PROTOCOLS[e];
      let h = `<div class="lk-card"><h2>Versuch ${x.n}: ${esc(x.title)}</h2><p>${esc(P.intro)}</p><p class="meta"><b>Material:</b> ${esc(P.material)}</p></div>`;
      if (x.mixing) return h + mixHtml();
      h += protoFormHtml(e);
      if (e === 'e1' && theoryOpen()) h += '<p class="lk-note ok">Als Nächstes: <b>Versuch 2</b> (Acetat) und dann die <button type="button" class="lk-btn small" data-go="theory">2 Herleitung</button></p>';
      return h;
    }

    // ---------------------------------------------------------- Versuch 3: Planung, Herstellung, Auswertung
    function mixHtml() {
      if (!mixOpen()) return lockHtml('Versuch 3: Puffer herstellen', 'Dieser Versuch baut auf der <b>Herleitung</b> der Henderson-Hasselbalch-Gleichung auf. Erst herleiten, dann berechnen, herstellen und messen. Die sechs Rechenaufgaben sind dafür nicht nötig.', 'mix', 'theory');
      const m = ui.mix, S = sysObj();
      let h = '';
      // 1 Ziel
      const custom = m.target != null && !L.MIX_TARGETS.some((t) => t.pH === m.target);
      h += `<section class="mixstep" data-mixstep="1"><h3><span class="n">1</span> Ziel-pH festlegen</h3>
        <p>Stelle <b>30,0 mL</b> Pufferlösung mit dem gewünschten pH-Wert her.</p>
        <div class="opts" role="group" aria-label="Ziel-pH wählen">${L.MIX_TARGETS.map((t) => `<button type="button" class="opt" data-mixtarget="${t.pH}" aria-pressed="${m.target === t.pH}">pH ${de(t.pH, 2)}</button>`).join('')}</div>
        <div class="frow"><label class="flabel" for="mixCustom">oder eigener Ziel-pH</label><input id="mixCustom" type="text" inputmode="decimal" data-mixcustom value="${esc(custom ? de(m.target, 2) : m.custom)}" autocomplete="off" aria-label="Eigener Ziel-pH"><button type="button" class="lk-btn small" data-mixaction="custom">übernehmen</button>${m.customMsg ? `<p class="ffb n" role="alert">✗ ${esc(m.customMsg)}</p>` : ''}</div></section>`;
      // 2 System
      if (m.target != null) {
        const msg = L.targetMessage(m.system, m.target);
        h += `<section class="mixstep" data-mixstep="2"><h3><span class="n">2</span> Puffersystem wählen</h3>
          <p>Wähle das Paar, dessen pKₛ-Wert zum Ziel-pH <b>${de(m.target, 2)}</b> passt. Die Faustregel <b>pKₛ ± 1</b> ist nur eine Näherung.</p>
          <div class="radios">${C.SYSTEM_IDS.map((id) => { const SS = C.SYSTEMS[id]; return `<label class="lk-opt ${m.pick === id ? (m.system === id ? 'right' : 'wrong') : ''}"><input type="radio" name="mixsys" data-mixsystem="${id}" value="${id}" ${m.pick === id ? 'checked' : ''}> <span><b>${esc(SS.name)}</b>: ${esc(SS.pair)}, pKₛ = ${de(SS.pKa, 2)}<br><span class="lk-muted">Stammlösungen: ${esc(SS.acid.name)} und ${esc(SS.base.name)}, je 0,100 mol/L</span></span></label>`; }).join('')}</div>
          ${m.msg ? `<p class="ffb ${m.msg.ok ? 'y' : 'n'}" role="status">${m.msg.ok ? '✓ ' : '✗ '}${esc(m.msg.text)}</p>` : (msg.code === 'none' ? `<p class="ffb n">✗ ${esc(msg.text)}</p>` : '')}</section>`;
      }
      // 3 Rechnen
      if (m.target != null && S) {
        const plan = C.planMix(S.id, m.target), r = m.res || {};
        const f = m.entries;
        const row = (id, label, unit, ph) => `<div class="frow"><label class="flabel" for="mx-${id}">${label}</label><input id="mx-${id}" type="text" inputmode="decimal" data-mixf="${id}" class="${r[id] ? (r[id].ok ? 'right' : r[id].empty ? '' : 'wrong') : ''}" value="${esc(f[id] || '')}" autocomplete="off" placeholder="${ph}" aria-label="${esc(label)}">${unit ? `<span class="unit">${unit}</span>` : ''}${r[id] ? (r[id].empty ? '<p class="ffb lk-muted">noch nicht beantwortet</p>' : `<p class="ffb ${r[id].ok ? 'y' : 'n'}">${r[id].ok ? '✓ richtig' : '✗ ' + esc(r[id].fb)}${r[id].kind && !r[id].ok ? ` <span class="badge warn">${{ quotient: 'Quotient', log: 'Logarithmus', calc: 'Rechnung', concept: 'Ansatz', format: 'Eingabe', swap: 'vertauscht', range: 'Bereich' }[r[id].kind] || ''}</span>` : ''}</p>`) : ''}</div>`;
        const hints = ['Löse pH = pKₛ + lg x nach x = n(A⁻)/n(HA) auf.', `x = 10^(pH − pKₛ) = 10^(${de(m.target, 2)} − ${de(S.pKa, 2)}). Bei gleicher Konzentration gilt V(Base)/V(Säure) = x.`, 'V(Säure) = 30,0 mL / (1 + x); V(Base) = 30,0 mL − V(Säure).'];
        h += `<section class="mixstep" data-mixstep="3"><h3><span class="n">3</span> Selbst rechnen</h3>
          <p>Rechne <b>vor dem Mischen</b>. Beide Stammlösungen haben c = 0,100 mol/L; mit n = c · V gilt das Verhältnis der Stoffmengen auch für das Verhältnis der Volumina.</p>
          ${row('r', 'n(A⁻) / n(HA) =', '', 'z. B. 1,5')}
          ${row('vb', `V(${esc(S.base.stockFormula)}-Lösung, Base A⁻) =`, 'mL', '')}
          ${row('va', `V(${esc(S.acid.stockFormula)}-Lösung, Säure HA) =`, 'mL', '')}
          ${m.res && m.res.sum && !m.res.sum.ok ? `<p class="ffb n">✗ ${esc(m.res.sum.fb)} <span class="badge warn">Summe</span></p>` : ''}
          ${m.res && m.res.ok ? '<p class="lk-note ok">✓ Deine Rechnung stimmt. Du kannst jetzt herstellen.</p>' : ''}
          ${m.sol ? `<p class="lk-note info"><b>Lösung:</b> n(A⁻)/n(HA) = 10^(${de(m.target, 2)} − ${de(S.pKa, 2)}) = ${de(plan.ratio, 2)}; V(Säure) = 30,0 mL/(1 + ${de(plan.ratio, 2)}) = ${de(plan.VAcid, 1)} mL; V(Base) = ${de(plan.VBase, 1)} mL.</p>` : ''}
          ${tipsHtml(hints, m.tip || 0)}
          ${ui.confirmSol === 'mix' ? '<div class="lk-note warn" role="alert">Du hast noch nicht geprüft. Lösung trotzdem anzeigen?<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" data-mixaction="solYes">Ja, anzeigen</button><button type="button" class="lk-btn" data-mixaction="solNo">Abbrechen</button></div></div>' : ''}
          <div class="lk-row"><button type="button" class="lk-btn primary" data-mixaction="check">Rechnung prüfen</button><button type="button" class="lk-btn" data-mixaction="tip">${tipLabel(m.tip || 0)}</button>${m.sol ? '' : '<button type="button" class="lk-btn" data-mixaction="sol">Lösung anzeigen</button>'}</div></section>`;
      }
      // 4 Herstellen
      if (m.target != null && S) {
        h += `<section class="mixstep ${m.checked ? '' : 'locked'}" data-mixstep="4"><h3><span class="n">4</span> Herstellen</h3>
          ${m.checked ? `<p>Dosiere im Labor mit der <b>Messpipette</b> nacheinander die beiden Stammlösungen (Flaschen oder Schalter „1 Lösung“, dann „Zugeben“). Das Diagramm <b>Mischungsverhältnis</b> zeigt die tatsächlich zugegebenen Stoffmengen. Der pH-Wert erscheint erst beim Messen.</p><p class="meta">Falsches Verhältnis? Du kannst weiter zugeben oder mit „Neu ansetzen“ ein leeres Becherglas aufstellen.</p>` : '<p class="lk-muted">Wird freigeschaltet, sobald du deine Rechnung geprüft hast (auch eine fehlerhafte Rechnung wird geprüft und kann hier verwendet werden).</p>'}</section>`;
        h += `<section class="mixstep ${m.checked ? '' : 'locked'}" data-mixstep="5"><h3><span class="n">5</span> Messen und auswerten</h3>
          ${m.checked ? '<div class="lk-row"><button type="button" class="lk-btn primary" id="btnMeasurePanel">Mischen und pH messen</button></div>' : '<p class="lk-muted">Erst herstellen, dann messen.</p>'}
          ${outcomeHtml()}</section>`;
      }
      if (eng.state.history.length) h += `<section class="mixstep" data-mixstep="6"><h3><span class="n">6</span> Fragen</h3>${protoFormHtml('e3')}</section>`;
      return h;
    }
    function outcomeHtml() {
      const b = series().beakers[0];
      const e = b.meas && b.meas.done ? eng.state.history.find((q) => q.id === b.meas.entry) : null;
      if (!e) return `<p class="lk-muted">${b.comp.V > 0 ? 'Dieses Becherglas ist noch nicht gemessen.' : 'Noch nichts im Becherglas.'}${eng.state.history.length ? ' Frühere Messungen stehen unter „Ergebnisse“.' : ''}</p>`;
      const o = L.analyzeOutcome(e);
      const used = `${de(e.vBase, 1)} / ${de(e.vAcid, 1)} mL`;
      const calc = e.calc ? `${esc(e.calc.r || '–')}; ${esc(e.calc.vb || '–')} / ${esc(e.calc.va || '–')} mL` : '–';
      return `<div class="outcome ${o.band}" role="status"><p class="ostate"><b>${o.band === 'good' ? '✓ Ziel erreicht' : o.band === 'near' ? 'Fast getroffen' : 'Abweichung'}:</b> ${esc(o.summary)}</p>
        <table class="datatable cmp"><tr><th></th><th>Rechnung</th><th>Hergestellt / gemessen</th></tr>
        <tr><td>n(A⁻)/n(HA)</td><td>${de(o.plan.ratio, 2)} <span class="lk-muted">(Soll)</span><br><span class="lk-muted">deine Angabe: ${esc(e.calc ? e.calc.r || '–' : '–')}</span></td><td>${e.ratio == null ? '–' : de(e.ratio, 2)}</td></tr>
        <tr><td>V(Base) / V(Säure)</td><td>${de(o.plan.VBase, 1)} / ${de(o.plan.VAcid, 1)} mL <span class="lk-muted">(Soll)</span><br><span class="lk-muted">deine Angabe: ${calc}</span></td><td>${used}</td></tr>
        <tr><td>pH-Wert</td><td>Ziel ${de(e.target, 2)}</td><td><b>gemessen ${de(e.pH, 2)}</b>${e.hh != null ? `<br><span class="lk-muted">Rechenwert (H-H): ${de(e.hh, 2)}</span>` : ''}</td></tr>
        <tr><td>Abweichung</td><td colspan="2"><b>${(o.dev >= 0 ? '+' : '−') + de(Math.abs(o.dev), 2)}</b> pH-Einheiten</td></tr></table>
        ${o.causes.length ? `<ul class="causes">${o.causes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</div>`;
    }

    // ---------------------------------------------------------- Ergebnisse, Journal, Hefteintrag
    function recAt(b, v) { const r = b.records.find((p) => Math.abs(p.v - v) < 1e-6); return r ? de(r.pH, 2) : '–'; }
    function resultsHtml() {
      const e = eng.state.exp, x = exp();
      if (x.mixing) return mixResultsHtml();
      const live = Object.values(eng.state.series).filter((s) => s.exp === e && s.beakers.some((b) => b.records.length > 1));
      const arch = eng.state.archive.filter((a) => a.exp === e);
      const rows = (recsList, keys) => keys.map((k, i) => {
        const b = recsList[i], last = b.records[b.records.length - 1];
        return `<tr><td>${LETTER(i)} ${esc(sampleName(k))}</td><td>${de(b.records[0].pH, 2)}</td><td>${recAt(b, 0.05)}</td><td>${recAt(b, 1)}</td><td>${de(last.pH, 2)} <span class="lk-muted">(${de(last.v, 2)} mL)</span></td></tr>`;
      }).join('');
      const table = (title, sub, list, keys, cmp) => `<div class="lk-card reslist"><h3>${title}</h3><p class="meta">${sub}</p><table><tr><th>Probe</th><th>Start</th><th>0,05 mL</th><th>1,0 mL</th><th>zuletzt</th></tr>${rows(list, keys)}</table>${cmp ? `<div class="lk-row" style="margin-top:6px"><button type="button" class="lk-btn small" data-cmp="${cmp}">${ui.compare === cmp ? 'Vergleich ausblenden' : 'Im Diagramm vergleichen'}</button></div>` : ''}</div>`;
      let h = `<div class="lk-card"><h2>Ergebnisse – Versuch ${x.n}</h2><p class="meta">pH-Werte deiner Messreihen (stabile Messwerte nach dem Mischen). Säure- und Laugenreihen sind getrennte, frische Ansätze.</p></div>`;
      if (!live.length && !arch.length) h += '<p class="lk-muted">Noch keine Messungen in diesem Versuch.</p>';
      for (const s of live) h += table(`${s.kind === 'cont' ? 'Gegenprobe' : 'Aktuelle Reihe'}: ${reagentName(s.reagent)}`, seriesDesc(s), s.beakers, s.beakers.map((b) => b.key));
      for (const a of arch.slice().reverse()) h += table(`Gespeichert: ${reagentName(a.reagent)} (${a.why})`, `${a.kind === 'cont' ? 'Gegenprobe · ' : ''}${new Date(a.archived).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`, a.runs, a.runs.map((r) => r.key), a.id);
      const s = series();
      if (s.kind === 'fresh') {
        h += `<div class="lk-card"><h3>Proben erneuern</h3><p class="meta">Ersetzt ein Glas durch eine frische, unbehandelte Probe; die alte Messung bleibt hier gespeichert.</p><div class="lk-row">${s.beakers.map((b, i) => `<button type="button" class="lk-btn small" data-fresh="${i}" ${eng.busy() ? 'disabled' : ''}>Frische Probe ${LETTER(i)} · ${esc(sampleName(b.key))}</button>`).join('')}</div></div>`;
      }
      return h;
    }
    function seriesDesc(s) {
      const r = E.REAGENTS[s.reagent];
      if (s.kind === 'cont') return `Gegenprobe: Zugabe ${r.label} zu den bereits mit ${reagentName(s.from.reagent)} behandelten Ansätzen (vorher ${s.from.added.map((v) => de(v, 2) + ' mL').join(' / ')}).`;
      return `Frische Ansätze, Zugabe ${r.label}.`;
    }
    function mixResultsHtml() {
      const hist = eng.state.history;
      let h = '<div class="lk-card"><h2>Ergebnisse – Versuch 3</h2><p class="meta">Alle Messungen mit der pH-Messelektrode, mit Ziel, Volumina und Abweichung.</p></div>';
      if (!hist.length) return h + '<p class="lk-muted">Noch keine Messung.</p>';
      h += `<div class="lk-card reslist"><table><tr><th>#</th><th>System</th><th>Ziel</th><th>V(Base) / V(Säure)</th><th>n(A⁻)/n(HA)</th><th>gemessen</th><th>Abw.</th></tr>${hist.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(C.SYSTEMS[e.system].name)}</td><td>${de(e.target, 2)}</td><td>${de(e.vBase, 1)} / ${de(e.vAcid, 1)} mL</td><td>${e.ratio == null ? '–' : de(e.ratio, 2)}</td><td><b>${de(e.pH, 2)}</b></td><td>${(e.pH - e.target >= 0 ? '+' : '−') + de(Math.abs(e.pH - e.target), 2)}</td></tr>`).join('')}</table></div>`;
      return h;
    }

    function journalHtml() {
      return `<div class="lk-card"><h2>Journal</h2><p class="meta">Sammelt deine Beobachtungen, Deutungen, Antworten auf die Leitfragen, ausgewählte Messdaten und Rechnungen. Gespeichert wird nur in diesem Browser.</p>
        <div class="lk-row"><button type="button" class="lk-btn" id="btnPrint">Drucken</button><button type="button" class="lk-btn" id="btnExport">Als HTML-Datei speichern</button></div></div>
        <div class="lk-card">${journalBody()}</div>
        <div class="lk-card"><h3>Zurücksetzen</h3><p class="meta"><b>Frische Probe</b> (Reiter Ergebnisse) ersetzt ein Glas, <b>Neue Reihe</b> stellt alle Gläser frisch auf (alte Reihe bleibt gespeichert). <b>Alles zurücksetzen</b> löscht alle Messreihen, Antworten und Rechnungen.</p>
        ${ui.confirmSol === 'reset' ? '<div class="lk-note warn" role="alert">Wirklich alles löschen?<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnResetYes">Ja, alles löschen</button><button type="button" class="lk-btn" id="btnResetNo">Abbrechen</button></div></div>' : '<button type="button" class="lk-btn" id="btnReset">Alles zurücksetzen</button>'}</div>`;
    }
    function journalBody() {
      let h = '';
      for (const x of E.EXPERIMENTS) {
        const P = L.PROTOCOLS[x.id], a = ui.answers[x.id] || {};
        const parts = [];
        for (const q of P.questions) {
          const v = a[q.id];
          if (v == null || (Array.isArray(v) && !v.length) || v === '') continue;
          const text = q.type === 'free' ? esc(v) : q.type === 'multi' ? v.map((k) => esc(q.options.find((o) => o.v === k).t)).join('; ') : esc((q.options.find((o) => o.v === v) || {}).t);
          parts.push(q.type === 'free' ? `<p><b>Leitfrage:</b> ${esc(q.text)}<br><i>Meine Antwort (unbewertet):</i> ${text}</p>` : `<p><b>${esc(q.step)}:</b> ${text}</p>`);
        }
        const data = [];
        if (x.mixing) {
          for (const e of eng.state.history.filter((q) => q.system)) {
            data.push(`<tr><td>${esc(C.SYSTEMS[e.system].name)}</td><td>Ziel ${de(e.target, 2)}</td><td>Rechnung: ${e.calc ? `${esc(e.calc.r || '–')}; ${esc(e.calc.vb || '–')} / ${esc(e.calc.va || '–')} mL` : '–'}</td><td>verwendet: ${de(e.vBase, 1)} / ${de(e.vAcid, 1)} mL</td><td>gemessen ${de(e.pH, 2)} (Abw. ${(e.pH - e.target >= 0 ? '+' : '−') + de(Math.abs(e.pH - e.target), 2)})</td></tr>`);
          }
        } else {
          for (const s of Object.values(eng.state.series)) {
            if (s.exp !== x.id || !s.beakers.some((b) => b.added > 0)) continue;
            data.push(`<tr><td>${s.kind === 'cont' ? 'Gegenprobe ' : ''}${reagentName(s.reagent)}</td>${s.beakers.map((b, i) => `<td>${LETTER(i)} ${esc(sampleName(b.key))}: ${de(b.records[0].pH, 2)} → ${de(b.records[b.records.length - 1].pH, 2)} (${de(b.added, 2)} mL)</td>`).join('')}</tr>`);
          }
        }
        if (!parts.length && !data.length) continue;
        h += `<h3>Versuch ${x.n}: ${esc(x.title)}</h3>${parts.join('')}${data.length ? `<table class="datatable">${data.join('')}</table>` : ''}${ui.sol[x.id] ? '<p class="lk-muted">(Lösung wurde angezeigt.)</p>' : ''}`;
      }
      const tk = L.TASKS.filter((t) => ui.tasks[t.id] && (ui.tasks[t.id].checked || ui.tasks[t.id].note));
      if (tk.length) {
        h += '<h3>Eigene Rechnungen</h3>';
        for (const t of tk) {
          const st = ui.tasks[t.id];
          const vals = t.fields.map((f) => `${esc(f.label)} ${esc((st.vals || {})[f.id] || '–')} ${esc((st.units || {})[f.id] || '')}${st.res && st.res[f.id] ? (st.res[f.id].ok ? ' ✓' : ' ✗') : ''}`).join(' · ');
          h += `<p><b>${t.n}. ${esc(t.title)}:</b> ${vals}${st.note ? `<br><i>Rechenweg:</i> ${esc(st.note)}` : ''}${st.sol ? ' <span class="lk-muted">(Rechenweg angezeigt)</span>' : ''}</p>`;
        }
      }
      return h || '<p class="lk-muted">Noch keine Einträge.</p>';
    }
    function notebookHtml() {
      const N = L.NOTEBOOK;
      return `<div class="lk-notebook"><h2>${N.title}</h2><ul>${N.items.map((it) => (typeof it === 'string' ? `<li>${it}</li>` : `</ul><span class="eq">${it.eq}</span><ul>`)).join('')}</ul></div>`;
    }

    // ---------------------------------------------------------- Labor: Dosierleiste, Versuchswahl, Zusatzansicht
    /** Auswahl-Schaltfläche: aria-pressed trennt „ausgewählt“ (dunkel, Häkchen) von „nicht ausgewählt“ (hell). */
    const opt = (attr, val, label, pressed, extra) => `<button type="button" class="opt" ${attr}="${esc(val)}" aria-pressed="${pressed}" ${extra || ''}>${label}</button>`;

    function renderBars() {
      const st = eng.state, busy = eng.busy(), x = exp(), s = series();
      const lockMix = (id) => id === 'e3' && !mixOpen();
      $('#expChips').innerHTML = E.EXPERIMENTS.map((e) => `<button type="button" data-exp="${e.id}" aria-pressed="${e.id === st.exp}"><b>${e.n}</b>${esc(e.short)}${lockMix(e.id) ? ' <span class="lockmark" title="Baut auf der Herleitung auf" aria-label="(nach der Herleitung)">🔒</span>' : ''}</button>`).join('');
      $('#btnNewSeries').hidden = !!x.mixing; $('#btnCont').hidden = !!x.mixing; $('#btnBatch').hidden = !x.mixing;
      $('#btnBatch').disabled = busy || !(s.beakers[0].comp.V > 0);
      $('#formulaBar').hidden = !x.mixing;
      if (x.mixing) renderFormulaBar();
      // Dosierleiste: 1 Lösung · 2 Pipette · 3 Menge · 4 Ziel/Zugabe
      const slot = st.slot, reagents = eng.bottleKeys();
      const a = eng.slots(st.exp);
      let step1;
      if (x.mixing) {
        step1 = reagents.length ? reagents.map((k) => { const R = E.REAGENTS[k]; return opt('data-reagent', k, `<span class="t1">${esc(R.formula)}</span><span class="t2">${R.tone === 'acid' ? 'Säure HA' : 'Base A⁻'}</span>`, slot === k, `aria-label="${esc(R.name)} ${esc(R.formula)}, ${R.tone === 'acid' ? 'Säure' : 'Base'}, 0,100 mol/L" ${busy ? 'disabled' : ''}`); }).join('') : '<span class="lk-muted">Zuerst Ziel-pH und Puffersystem wählen</span>';
      } else {
        step1 = ['HCl', 'NaOH'].map((k) => opt('data-reagent', k, `<span class="t1">${k}</span><span class="t2">${k === 'HCl' ? 'Salzsäure' : 'Natronlauge'}</span>`, slot === k, `aria-label="${E.REAGENTS[k].name} ${k}, 0,100 mol/L" ${busy ? 'disabled' : ''}`)).join('');
        if (a.cont && st.series[a.cont]) step1 += opt('data-reagent', 'cont', `<span class="t1">Gegenprobe</span><span class="t2">${reagentName(st.series[a.cont].reagent)}</span>`, slot === 'cont', `aria-label="Gegenprobe mit ${reagentName(st.series[a.cont].reagent)}" ${busy ? 'disabled' : ''}`);
      }
      const toolLabel = { dropper: 'Tropfpipette', measure: 'Messpipette' };
      const step2 = x.tools.map((t) => opt('data-tool', t, toolLabel[t], st.tool === t, busy ? 'disabled' : '')).join('');
      const nTool = x.tools.length > 1;
      const step3 = x.doses.filter((k) => E.DOSES[k].tool === st.tool).map((k) => opt('data-kind', k, E.DOSES[k].label, st.kind === k, `aria-label="Zugabemenge ${E.DOSES[k].label}" ${busy ? 'disabled' : ''}`)).join('');
      const n = s.beakers.length;
      if (ui.target !== 'all' && Number(ui.target) >= n) ui.target = 'all';
      const step4 = x.mixing ? '' : `<div class="step"><span class="slbl"><b>4</b> Ziel</span><div class="opts" role="group" aria-label="Zielgefäß">${opt('data-target', 'all', 'Alle', ui.target === 'all', `title="Vergleichsmodus: dieselbe Zugabe nacheinander in alle Gläser" ${busy ? 'disabled' : ''}`)}${s.beakers.map((b, i) => opt('data-target', i, LETTER(i), String(ui.target) === String(i), `aria-label="nur Glas ${LETTER(i)}: ${esc(sampleName(b.key))}" ${busy ? 'disabled' : ''}`)).join('')}</div></div>`;
      const gated = dosingBlock();
      $('#doseBar').innerHTML = `
        <div class="step"><span class="slbl"><b>1</b> ${x.mixing ? 'Stammlösung' : 'Lösung'}</span><div class="opts" role="group" aria-label="${x.mixing ? 'Stammlösung wählen' : 'Lösung wählen'}">${step1}</div></div>
        ${nTool ? `<div class="step"><span class="slbl"><b>2</b> Pipette</span><div class="opts" role="group" aria-label="Pipettentyp wählen">${step2}</div></div>` : ''}
        <div class="step"><span class="slbl"><b>${nTool ? 3 : 2}</b> Menge${nTool ? '' : ' <span class="lk-muted">(Messpipette)</span>'}</span><div class="opts" role="group" aria-label="Zugabemenge wählen">${step3}</div></div>
        ${step4}
        <div class="step go"><span class="slbl"><b>${x.mixing ? 3 : 5}</b> Zugabe</span><div class="gobtns"><button type="button" class="go" id="btnGo" aria-disabled="${busy || ui.speed === 0 || !!gated}" ${gated ? `aria-describedby="deckHint"` : ''}>▶ Zugeben</button>${x.mixing ? `<button type="button" class="go measure" id="btnMeasure" aria-disabled="${busy || ui.speed === 0 || !!gated || !(s.beakers[0].comp.V > 0)}">Mischen und pH messen</button>` : ''}</div></div>`;
      $('#deckHint').textContent = gated || '';
      $('#deckHint').hidden = !gated;
      document.querySelectorAll('#speed [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === ui.speed)));
      $('#btnStep').disabled = ui.speed !== 0;
      $('#chkIndicator').checked = ui.indicator;
      $('#indWrap').hidden = !!x.mixing; $('#uiScale').hidden = !!x.mixing;
      $('#btnStir').disabled = false; $('#btnStir').setAttribute('aria-pressed', String(!!eng.state.stirOn)); $('#btnStir').textContent = eng.state.stirOn ? '✓ Rühren an' : 'Rühren';
      const pk = $('#chkPka'); pk.disabled = !numbersOpen() || !!x.mixing; pk.checked = ui.pka && numbersOpen();
      $('#pkaWrap').classList.toggle('disabled', !numbersOpen());
      $('#pkaWrap').hidden = !!x.mixing;
      $('#pkaWrap').title = numbersOpen() ? 'pKₛ und Faustregel-Bereich ± 1 einzeichnen' : 'Nach der Herleitung verfügbar';
      $('#chkZoom').checked = ui.zoom; $('#chkZoom').parentNode.hidden = !!x.mixing;
      $('#btnCont').textContent = s.kind === 'cont' ? 'Gegenprobe läuft' : `Gegenprobe: ${s.reagent === 'HCl' ? 'NaOH' : 'HCl'}`;
      $('#btnCont').disabled = s.kind === 'cont' || !eng.used(s) || busy;
      $('#btnNewSeries').disabled = !eng.used(s) || busy;
      // Vergleichsauswahl
      const arch = eng.state.archive.filter((q) => q.exp === st.exp);
      if (ui.compare && !arch.some((q) => q.id === ui.compare)) ui.compare = '';
      $('#cmpSelect').innerHTML = `<option value="">Vergleich: keiner</option>` + arch.map((q, i) => `<option value="${q.id}" ${q.id === ui.compare ? 'selected' : ''}>Vergleich: gespeicherte ${reagentName(q.reagent)}-Reihe ${i + 1}</option>`).join('');
      $('#cmpSelect').disabled = !arch.length; $('#cmpSelect').hidden = !!x.mixing;
      renderExtra();
    }
    /** Warum ist „Zugeben“ gerade nicht möglich? (null = möglich) */
    function dosingBlock() {
      if (!isMix()) return null;
      if (ui.mix.target == null || !ui.mix.system) return 'Erst Ziel-pH und Puffersystem wählen (Bedienfeld → Aufgabe).';
      if (!ui.mix.checked) return 'Erst selbst rechnen und die Rechnung prüfen (Bedienfeld → Aufgabe, Schritt 3).';
      return null;
    }
    function renderFormulaBar() {
      const S = sysObj();
      $('#formulaBar').innerHTML = `<span class="fl">Henderson-Hasselbalch</span><span class="eqn">pH = pKₛ + lg ( n(A⁻) / n(HA) )</span><span class="sep">⇔</span><span class="eqn">n(A⁻) / n(HA) = 10<sup>pH − pKₛ</sup></span>${S ? `<span class="sys" title="${esc(S.pair)}">${esc(S.name)} · pKₛ = ${de(S.pKa, 2)}</span>` : '<span class="sys lk-muted">System noch nicht gewählt</span>'}`;
      $('#formulaBar').title = 'Näherung für gleiches Volumen: n = c · V; gilt im Pufferbereich pKₛ ± 1';
    }

    /** Zusatzansicht am selben Platz: Teilchenmodell bzw. Mischungsverhältnis ↔ pH-Kurve. */
    function renderExtra() {
      const x = exp(), v = curView();
      const sig = [x.id, v, ui.mix.system, mixOpen()].join('|');
      const tg = $('#viewToggle');
      tg.querySelector('[data-view="main"]').textContent = x.mixing ? 'Mischungsverhältnis' : 'Teilchenmodell';
      tg.querySelector('[data-view="main"]').setAttribute('aria-pressed', String(v === 'main'));
      tg.querySelector('[data-view="curve"]').setAttribute('aria-pressed', String(v === 'curve'));
      $('#partview').hidden = !(v === 'main' && !x.mixing);
      $('#mixview').hidden = !(v === 'main' && x.mixing);
      $('#chartbox').hidden = v !== 'curve';
      $('#chartCtl').hidden = v !== 'curve';
      $('#extraTitle').hidden = v === 'main' && !x.mixing;
      $('#extraNote').hidden = !(v === 'main' && !x.mixing);
      $('#extraTitle').textContent = v === 'curve' ? (x.mixing ? 'pH-Wert gegen lg [n(A⁻)/n(HA)]' : 'pH gegen zugegebenes Volumen') : (x.mixing ? 'Anteile und Stoffmengen im Becherglas' : 'Teilchenmodell (schematisch, nicht maßstäblich)');
      if (sig !== extraSig) { extraSig = sig; chartSig = ''; readSig = ''; }
    }

    function buildViews() {
      const s = series();
      viewSeries = s.id + ':' + s.beakers.map((b) => b.key).join(',');
      const box = $('#pviews');
      views.length = 0;
      if (s.kind === 'mix') { box.innerHTML = ''; $('#plegend').innerHTML = ''; return; }
      box.innerHTML = s.beakers.map((b, i) => `<div class="pview" data-i="${i}" style="border-top:4px solid ${CH.STYLE[i].color}"><header><b class="nm">${LETTER(i)} · ${esc(sampleName(b.key))}</b><span class="val"></span></header><div class="pc"><canvas role="img" aria-label="Teilchenmodell ${LETTER(i)}: ${esc(sampleName(b.key))}"></canvas></div><div class="pbar"></div><div class="pfoot"></div></div>`).join('');
      box.querySelectorAll('.pview').forEach((el) => {
        const v = new PV.ParticleView(el.querySelector('canvas'));
        v.el = el; v.sig = '';
        views.push(v);
      });
      buildLegend();
      tagsSig = ''; readSig = ''; chartSig = '';
    }
    function buildLegend() {
      const s = series();
      const keys = [];
      for (const b of s.beakers) for (const k of PV.speciesOf(b.comp0)) if (!keys.includes(k)) keys.push(k);
      const ORDER = ['HA', 'H2PO4', 'A', 'HPO4', 'H3PO4', 'PO4', 'H3O', 'OH', 'H2O'];
      keys.sort((p, q) => ORDER.indexOf(p) - ORDER.indexOf(q));
      $('#plegend').innerHTML = PV.legendHtml(keys);
      $('#extraNote').innerHTML = `Schematisch, <b>nicht maßstäblich</b>: 1 Symbol ≙ ${de(PV.SCALE, 1)} mmol Puffer-Teilchen · H₃O⁺/OH⁻ stark überhöht · Hintergrund = Wasser (Lösungsmittel), H₂O-Symbol: entsteht kurz bei der Neutralisation`;
      $('#extraNote').title = 'Freie H₃O⁺/OH⁻ sind stark überhöht dargestellt (Anzahl nur logarithmisch). Gestrichelter Rand = saure Form. Na⁺/Cl⁻ werden nicht gezeigt; Wasser ist der Hintergrund. Reagiert eine Zugabe mit dem Puffer, entsteht kurz ein H₂O-Symbol, das sich im Lösungsmittel auflöst – ein Bestandssymbol wandelt sich erst nach vielen Zugaben um (1 Symbol ≙ 0,2 mmol). Der pH-Wert stammt aus der Modellrechnung, nicht aus gezählten Symbolen.';
    }

    function updateViews(dt, real) {
      const s = series();
      if (viewSeries !== s.id + ':' + s.beakers.map((b) => b.key).join(',')) buildViews();
      if (s.kind === 'mix') { updateMix(s); return; }
      if (curView() !== 'main') return;
      s.beakers.forEach((b, i) => {
        const v = views[i];
        if (!v) return;
        const sig = `${b.records.length}|${b.key}|${numbersOpen()}`;
        if (sig !== v.sig) {
          v.sig = sig;
          const tc = PV.targetCounts(b.shown.comp);
          v.sync(tc.counts, b.key);
          v.el.querySelector('.pbar').innerHTML = barHtml(b, tc);
          v.el.querySelector('.pfoot').innerHTML = numbersOpen() ? formalHtml(b) : '';
          v.el.querySelector('header .nm').textContent = `${LETTER(i)} · ${sampleName(b.key)}`;
        }
        v.frame(dt, { reduceMotion: ui.reduceMotion, real });
      });
    }
    /**
     * Zugabe ist im Glas angekommen: Reaktionsweg aus dem Modell bestimmen und im Teilchenmodell
     * zeigen (nur Versuche 1/2, höchstens alle 0,35 s je Glas – Strahl und Tropfenserien).
     */
    const lastReact = {};
    function onLand(f) {
      const s = series();
      if (s.kind === 'mix' || f.series !== s.id || curView() !== 'main') return;
      const v = views[f.beaker], b = s.beakers[f.beaker];
      if (!v || !b) return;
      const now = performance.now();
      if (now - (lastReact[f.beaker] || 0) < 350) return;
      const reagent = f.reagent || s.reagent;
      if (reagent !== 'HCl' && reagent !== 'NaOH') return;
      const n = C.C_REAGENT * f.vol, c = b.comp;
      const before = Object.assign({}, c, { V: c.V - f.vol, Cl: c.Cl - (reagent === 'HCl' ? n : 0), Na: c.Na - (reagent === 'NaOH' ? n : 0) });
      if (!(before.V > 0) || before.Cl < -1e-12 || before.Na < -1e-12) return;
      before.Cl = Math.max(0, before.Cl); before.Na = Math.max(0, before.Na);
      let an;
      try { an = C.doseAnalysis(before, reagent, f.vol); } catch (e) { return; }
      if (v.react(an)) lastReact[f.beaker] = now;
    }
    function updateMix(s) {
      if (!mixView) mixView = new root.PF.MixView($('#mixview'));
      if (curView() !== 'main') return;
      const b = s.beakers[0], S = sysObj();
      let pair = { acid: 0, base: 0 };
      if (S && b.comp.V > 0) pair = C.pairAmounts(S.id, b.comp);
      const m = eng.meter(b);
      mixView.update({ system: S, nAcid: pair.acid, nBase: pair.base, vAcid: S ? b.vols[S.acid.stock] || 0 : 0, vBase: S ? b.vols[S.base.stock] || 0 : 0, V: b.comp.V,
        measure: m.measured && S ? { pH: m.pH, hh: C.hh(S.pKa, pair.base, pair.acid) } : null, measuring: m.mixing });
    }
    function barHtml(b, tc) {
      const r = tc.r, c = b.shown.comp, nums = numbersOpen();
      const seg = (cls, label, f) => (f > 0.004 ? `<div class="${cls}" style="flex-basis:${(f * 100).toFixed(2)}%">${f > 0.12 ? label + (nums ? ' ' + de(f * 100, 0) + ' %' : '') : ''}</div>` : '');
      if (c.Ac > 0) return seg('acid', 'HAc', r.HA / c.Ac) + seg('base', 'Ac⁻', r.A / c.Ac);
      if (c.P > 0) return seg('acid2', 'H₃PO₄', r.H3PO4 / c.P) + seg('acid', 'H₂PO₄⁻', r.H2PO4 / c.P) + seg('base', 'HPO₄²⁻', r.HPO4 / c.P) + seg('base2', 'PO₄³⁻', r.PO4 / c.P);
      return `<div class="info">keine Puffer-Teilchen${nums ? ` · c(H₃O⁺) ≈ ${sci(r.h)} mol/L, c(OH⁻) ≈ ${sci(r.oh)} mol/L` : ' · freie H₃O⁺/OH⁻ siehe Symbole'}</div>`;
    }
    /** Nach der Herleitung: formale Stoffmengen und Henderson-Hasselbalch-Vergleich (Modell bleibt maßgeblich). */
    function formalHtml(b) {
      const c = b.shown.comp, f = C.formal(c), pHm = C.pH(c);
      if (c.Ac > 0) {
        const hh = C.hh(C.PKA_AC, f.A, f.HA);
        return `formal: n(HA) = ${de(f.HA, 2)} mmol · n(A⁻) = ${de(f.A, 2)} mmol · ${hh == null ? `H-H nicht anwendbar (${f.excessAcid > 0 ? 'Säureüberschuss ' + de(f.excessAcid, 2) + ' mmol' : f.excessBase > 0 ? 'Basenüberschuss ' + de(f.excessBase, 2) + ' mmol' : 'ein Partner fehlt'})` : `H-H: pH ≈ ${de(hh, 2)} (Modell ${de(pHm, 2)})`}`;
      }
      if (c.P > 0) {
        const pairs = [['H3PO4', 'H2PO4', 0], ['H2PO4', 'HPO4', 1], ['HPO4', 'PO4', 2]];
        const N = { H3PO4: 'H₃PO₄', H2PO4: 'H₂PO₄⁻', HPO4: 'HPO₄²⁻', PO4: 'PO₄³⁻' };
        const pr = pairs.find(([a, bb]) => f[a] > 0 && f[bb] > 0) || pairs[1];
        const hh = C.hh(C.PKA_P[pr[2]], f[pr[1]], f[pr[0]]);
        return `formal: n(${N[pr[0]]}) = ${de(f[pr[0]], 2)} mmol · n(${N[pr[1]]}) = ${de(f[pr[1]], 2)} mmol · ${hh == null ? 'H-H nicht anwendbar' : `H-H (pKₛ${'₁₂₃'[pr[2]]} = ${de(C.PKA_P[pr[2]], 2)}): pH ≈ ${de(hh, 2)} (Modell ${de(pHm, 2)})`}`;
      }
      return `kein Puffer: ${f.excessAcid > 0 ? 'Überschuss H₃O⁺ ' + de(f.excessAcid, 3) + ' mmol' : f.excessBase > 0 ? 'Überschuss OH⁻ ' + de(f.excessBase, 3) + ' mmol' : 'neutral'}`;
    }
    function sci(x) { const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); return `${de(m, 1)}·10${String(e).split('').map((ch) => (ch === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(ch)])).join('')}`; }

    // ---------------------------------------------------------- Beschriftungen über der Bühne
    /** Zugesetzte Gesamtmengen je Glas (Versuch 1): {HCl, NaOH} in mL; Gegenprobe zählt die Vorbehandlung mit. */
    function addedTotals(s, i) {
      const b = s.beakers[i], t = { HCl: 0, NaOH: 0 };
      if (s.reagent in t) t[s.reagent] += b.added;
      if (s.kind === 'cont' && s.from && s.from.reagent in t) t[s.from.reagent] += s.from.added[i] || 0;
      return t;
    }
    function updateTags() {
      const s = series(), geo = eng.geometry(), box = $('#tags');
      const reagents = eng.bottleKeys();
      const x = exp(), showAdd = x.id === 'e1';
      const sig = s.id + s.beakers.map((b) => b.key).join(',') + lab.view.w + 'x' + lab.view.h + ui.target + eng.activeReagent(s) + reagents.join(',') + eng.state.system + eng.state.exp + eng.busy() + eng.state.tool + x.tools.join(',');
      if (sig !== tagsSig) {
        tagsSig = sig;
        const sc = lab.view.scale, B = G().BOTTLE;
        const R = E.REAGENTS, act = eng.state.slot; // gleicher Zustand wie der Umschalter (bei Gegenprobe ist keine Flasche gewählt)
        let h = '';
        const tagBox = [];
        s.beakers.forEach((b, i) => {
          const g = geo[i], p = lab.toScreen(g.x, G().BENCH + 6);
          const next = geo[i + 1], prev = geo[i - 1];
          const room = Math.min(next ? (next.x - g.x) : 1e9, prev ? (g.x - prev.x) : 1e9) * sc - 6;
          // Versuch 1: Platz zwischen Glasschild und Mengenanzeige teilen (Name möglichst ungekürzt)
          const w = showAdd ? (room >= 290 ? Math.min(168, room - 126) : next ? Math.max(100, room - 106) : Math.max(116, room - 94)) : Math.max(84, Math.min(200, room));
          const sel = !isMix() && (ui.target === 'all' || String(ui.target) === String(i));
          const el = lab.toScreen(lab.electrodeX(g), g.top - 78);
          tagBox.push({ x: p.x, w });
          h += `<div class="tag ${sel ? 'target' : ''}" data-tag="${i}" style="left:${p.x}px;top:${p.y}px;width:${w}px"><b class="nm">${isMix() ? 'Becherglas' : LETTER(i) + ' · ' + esc(sampleName(b.key))}</b><span class="ln2"><span class="ph"></span> <span class="st"></span></span></div>`;
          h += `<div class="eltag" style="left:${el.x}px;top:${el.y}px" aria-hidden="true">pH-Messelektrode</div>`;
        });
        // Versuch 1: zugesetzte Gesamtmenge rechts neben dem Glasschild
        if (showAdd) s.beakers.forEach((b, i) => {
          const t = tagBox[i], p = lab.toScreen(geo[i].x, G().BENCH + 6);
          const left = t.x + t.w / 2 + 6;
          const limit = tagBox[i + 1] ? tagBox[i + 1].x - tagBox[i + 1].w / 2 - 6 : lab.view.w - 6;
          const w = Math.min(130, limit - left);
          if (w < 84) return;
          h += `<div class="addtag" data-add="${i}" style="left:${left}px;top:${p.y}px;width:${w}px" aria-live="off"><span class="ah">zugesetzt</span><span class="ar" data-r="HCl"></span><span class="ar" data-r="NaOH"></span></div>`;
        });
        // Flaschen: unsichtbare Klickflächen über der Zeichnung (Auswahl wird im Bild hervorgehoben)
        reagents.forEach((k, i) => {
          const reg = R[k];
          if (!reg) return;
          const tl = lab.toScreen(G().BOTTLE_X[i] - B.w / 2 - 4, G().BENCH - B.h - 4), br = lab.toScreen(G().BOTTLE_X[i] + B.w / 2 + 4, G().BENCH);
          const w = Math.max(44, br.x - tl.x), hh = Math.max(44, br.y - tl.y), cx = (tl.x + br.x) / 2;
          h += `<button type="button" class="bottlebtn hit" data-bottle="${esc(k)}" aria-pressed="${act === k}" ${eng.busy() ? 'disabled' : ''} style="left:${cx - w / 2}px;top:${br.y - hh}px;width:${w}px;height:${hh}px" aria-label="${esc(reg.name)} ${esc(reg.formula)}, 0,100 mol/L${isMix() ? (reg.tone === 'acid' ? ', Säure' : ', Base') : ''} – als Zugabelösung wählen" title="${esc(reg.name)} (${esc(reg.formula)}) – antippen zum Auswählen"></button>`;
        });
        // Pipetten im Ständer: antippen wählt den Pipettentyp (Klickflächen überlappen weder einander noch die Flaschen)
        const label = { dropper: 'Tropfpipette', measure: 'Messpipette' };
        const tools = x.tools.filter((t) => G().PIPETTES[t]).sort((p, q) => G().PIPETTES[p].rest.x - G().PIPETTES[q].rest.x);
        const bottleRight = reagents.length ? lab.toScreen(G().BOTTLE_X[reagents.length - 1] + B.w / 2 + 4, 0).x : -1e9;
        const px = tools.map((t) => lab.toScreen(G().PIPETTES[t].rest.x, 0).x);
        tools.forEach((t, i) => {
          const P = G().PIPETTES[t];
          const lo = i ? (px[i - 1] + px[i]) / 2 : Math.max(bottleRight + 2, px[i] - 22);
          const hi = i < tools.length - 1 ? (px[i] + px[i + 1]) / 2 : px[i] + 22;
          const w = Math.max(8, Math.min(44, 2 * Math.min(px[i] - lo, hi - px[i]) - 2));
          const top = lab.toScreen(P.rest.x, P.rest.y - P.len - 18), bot = lab.toScreen(P.rest.x, P.rest.y + 4);
          h += `<button type="button" class="piphit" data-pip="${t}" aria-pressed="${eng.state.tool === t}" ${eng.busy() ? 'disabled' : ''} style="left:${px[i] - w / 2}px;top:${top.y}px;width:${w}px;height:${Math.max(44, bot.y - top.y)}px" aria-label="${label[t]} wählen" title="${label[t]} – antippen zum Auswählen"></button>`;
        });
        box.innerHTML = h;
      }
      s.beakers.forEach((b, i) => {
        const el = box.querySelector(`[data-tag="${i}"]`);
        if (!el) return;
        const m = eng.meter(b);
        const ph = el.querySelector('.ph'), st = el.querySelector('.st');
        const t1 = m.pH == null ? 'pH –' : 'pH ' + de(m.pH, 2);
        if (ph.textContent !== t1) ph.textContent = t1;
        const t2 = isMix() ? (m.mixing ? 'misst …' : m.measured ? '✓ gemessen' : 'nicht gemessen') : m.mixing ? '…' : '✓';
        if (st.textContent !== t2) { st.textContent = t2; st.classList.toggle('mix', m.mixing); }
        const ad = box.querySelector(`[data-add="${i}"]`);
        if (ad) {
          const tot = addedTotals(s, i);
          for (const r of ['HCl', 'NaOH']) {
            const e2 = ad.querySelector(`[data-r="${r}"]`), txt = `${r} ${de(tot[r], 2)} mL`;
            if (e2.textContent !== txt) e2.textContent = txt;
            e2.classList.toggle('on', s.reagent === r);
          }
        }
      });
    }

    function updateReadouts(force) {
      const s = series();
      if (viewSeries !== s.id + ':' + s.beakers.map((b) => b.key).join(',')) buildViews();
      const sig = s.id + s.beakers.map((b) => `${b.key}:${b.records.length}:${b.pending.length}`).join(',') + eng.busy() + eng.state.exp;
      if (!force && sig === readSig) return;
      readSig = sig;
      $('#seriesNote').textContent = s.kind === 'mix' ? (sysObj() ? `Becherglas: ${de(s.beakers[0].comp.V, 1)} mL Mischung der beiden Stammlösungen (${sysObj().name}).` : 'Leeres Becherglas – erst Ziel-pH und Puffersystem wählen.') : seriesDesc(s);
      if (s.kind === 'mix') return;
      s.beakers.forEach((b, i) => {
        const v = views[i]; if (!v) return;
        const last = b.records[b.records.length - 1], d = last.pH - b.records[0].pH;
        v.el.querySelector('header .val').innerHTML = `pH <b>${de(last.pH, 2)}</b> · ΔpH <b>${(d >= 0 ? '+' : '−') + de(Math.abs(d), 2)}</b>${b.pending.length ? ' <span class="mix">mischt …</span>' : ''}`;
      });
    }

    function updateChart(chart, force) {
      if (curView() !== 'curve') return;
      const s = series(), x = exp();
      const box = $('#chart').getBoundingClientRect();
      const hist = eng.state.history;
      const sig = s.id + s.beakers.map((b) => b.key + b.records.length).join(',') + ui.zoom + ui.pka + ui.compare + Math.round(box.width) + 'x' + Math.round(box.height) + x.id + (x.mixing ? hist.length + '|' + ui.mix.target + '|' + ui.mix.system : '');
      if (!force && sig === chartSig) return;
      chartSig = sig;
      if (x.mixing) { drawMixChart(chart); return; }
      const band = ui.pka && numbersOpen() ? (eng.state.exp === 'e1' ? { pKa: 7.2, label: 'Phosphat: pKₛ₂ = 7,20 (Faustregel ± 1)' } : { pKa: 4.75, label: 'Acetat: pKₛ = 4,75 (Faustregel ± 1)' }) : null;
      const curves = s.beakers.map((b, i) => ({ label: `${LETTER(i)} ${sampleName(b.key)}`, records: b.records, style: CH.STYLE[i] }));
      const a = ui.compare ? eng.state.archive.find((q) => q.id === ui.compare) : null;
      const compare = a ? a.runs.map((r, i) => ({ label: `${sampleName(r.key)}`, records: r.records, style: CH.STYLE[i % 3] })) : [];
      const rg = E.REAGENTS[s.reagent];
      chart.draw({ curves, compare, xLabel: `V(${s.reagent}) in mL · c = 0,100 mol/L`, zoom: ui.zoom, band });
      $('#extraTitle').textContent = `pH gegen zugegebenes Volumen ${rg.name} (${s.reagent})${s.kind === 'cont' ? ' – Gegenprobe' : ''}`;
      $('#chartLegend').innerHTML = curves.map((c) => `<span class="it">${CH.legendSwatch(c.style)}${esc(c.label)}</span>`).join('') + (a ? compare.map((c) => `<span class="it">${CH.legendSwatch(c.style, true)}gespeichert (${reagentName(a.reagent)}): ${esc(c.label)}</span>`).join('') : '') + '<span class="it lk-muted">Linien verbinden Messpunkte nur zur Orientierung.</span>';
    }
    /** Versuch 3: Messpunkte (pH gegen lg[n(A⁻)/n(HA)]) aus den tatsächlichen Messungen. */
    function drawMixChart(chart) {
      const S = sysObj(), hist = eng.state.history.filter((e) => S && e.system === S.id && e.ratio != null);
      const pKa = S ? S.pKa : 7;
      const recs = hist.map((e) => ({ v: Math.log10(e.ratio), pH: e.pH }));
      const guides = S && ui.mix.target != null ? [{ y: ui.mix.target, label: `Ziel-pH ${de(ui.mix.target, 2)}`, color: '#c92a2a' }] : [];
      const lines = S ? [{ x0: -RANGE_LG, y0: pKa - RANGE_LG, x1: RANGE_LG, y1: pKa + RANGE_LG, color: '#5c6b7a' }] : [];
      chart.draw({ curves: [{ label: 'Messungen', records: recs, style: { color: '#1f6fd1', marker: 'circle', dash: [], markersOnly: true } }], compare: [], xLabel: 'lg [ n(A⁻) / n(HA) ] der hergestellten Mischung', zoom: false, band: null, x: { min: -RANGE_LG, max: RANGE_LG }, y: { min: pKa - 1.8, max: pKa + 1.8 }, guides, lines });
      $('#chartLegend').innerHTML = `<span class="it">${CH.legendSwatch({ color: '#1f6fd1', marker: 'circle', dash: [] })}Messpunkt (pH-Messelektrode)</span>${S ? `<span class="it"><svg viewBox="0 0 30 12" aria-hidden="true"><line x1="0" y1="6" x2="30" y2="6" stroke="#5c6b7a" stroke-width="1.5" stroke-dasharray="2 4"/></svg>Rechengerade pH = pKₛ + lg x (ideal, ${esc(S.name)}, pKₛ = ${de(pKa, 2)})</span>` : ''}${hist.length ? '' : '<span class="it lk-muted">Noch keine Messung – Punkte erscheinen nach „Mischen und pH messen“.</span>'}`;
    }

    function refreshLab(full) {
      renderBars();
      if (full) { buildViews(); }
      updateReadouts(true);
      tagsSig = ''; chartSig = '';
    }

    // ---------------------------------------------------------- Journal-Export
    function journalDoc() {
      return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Pufferfish – Journal</title><style>body{font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;max-width:820px;margin:20px auto;padding:0 16px}table{border-collapse:collapse}td,th{border:1px solid #999;padding:3px 6px;text-align:left}</style></head><body><h1>Pufferfish – Journal</h1><p>Erstellt am ${new Date().toLocaleString('de-DE')} · SiVex, Chemie Q13</p>${journalBody()}</body></html>`;
    }

    return {
      ui, toast, save, saveNow, load, evidence, setPage, renderSteps, renderPage, renderPanel, renderBars, buildViews, updateViews, updateTags, updateReadouts, updateChart, refreshLab, gradeAll, journalDoc, journalBody,
      theoryOpen, addedTotals, onLand, views: () => views, theoryDone, tasksOpen, appsOpen, mixOpen, numbersOpen, sampleName, dosingBlock, renderFormulaBar, renderExtra,
      views: () => views
    };
  }

  (root.PF = root.PF || {}).createUI = createUI;
})(typeof self !== 'undefined' ? self : this);
