/*
 * Pufferfish – Oberfläche: Bedienfeld, Seiten, Messwertkarten, Teilchenpanels,
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
  const STORE = 'sivex.pufferfish.v1';
  const de = (v, d) => fmt(v, d);

  function createUI(eng, lab) {
    const ui = {
      page: 'lab', tab: 'task', speed: 1, target: 'all', indicator: true, events: true, reduceMotion: false, zoom: false, pka: false, compare: '',
      predict: {}, predictSkip: {}, answers: {}, checked: {}, fails: {}, tips: {}, sol: {}, confirmSol: null,
      revealed: false, theory: {}, tasks: {}, apps: {}, forced: {}
    };
    const views = []; // Teilchenansichten der aktuellen Reihe
    let viewSeries = null, tagsSig = '', readSig = '', chartSig = '', toastTimer = 0, saveTimer = 0, saveWarned = false;

    // ---------------------------------------------------------- Hilfen
    const exp = () => E.expById(eng.state.exp);
    const series = () => eng.current();
    const sampleName = (key) => { const s = E.SAMPLES[key]; return s.hidden ? (ui.revealed ? `${s.name} (${s.revealed})` : s.name) : s.name; };
    const sampleDetail = (key) => { const s = E.SAMPLES[key]; return s.hidden && ui.revealed ? s.detailRevealed : s.detail; };
    const stepDone = (t) => { const st = ui.theory[t.id]; return !!(st && (st.sol || st.ok)); };
    const theoryOpen = () => ui.revealed || !!ui.forced.theory;
    const theoryDone = () => L.THEORY.every(stepDone);
    const tasksOpen = () => theoryDone() || !!ui.forced.tasks;
    const taskTried = (t) => { const s = ui.tasks[t.id]; return !!(s && (s.checked || s.sol)); };
    const appsOpen = () => L.TASKS.every(taskTried) || !!ui.forced.apps;
    const numbersOpen = () => theoryDone();
    const reagentName = (r) => (r === 'HCl' ? 'HCl' : 'NaOH');

    function toast(text) {
      const t = $('#toast'); t.textContent = text; t.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
    }

    // ---------------------------------------------------------- Speichern
    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          const keep = Object.assign({}, ui, { confirmSol: null });
          root.localStorage.setItem(STORE, JSON.stringify({ v: 1, ui: keep, engine: eng.serialize() }));
        } catch (e) { if (!saveWarned) { saveWarned = true; toast('Speichern im Browser ist nicht möglich – nach dem Neuladen beginnt der Versuch neu.'); } }
      }, 400);
    }
    function load() {
      let o = null;
      try { o = JSON.parse(root.localStorage.getItem(STORE) || 'null'); } catch (e) { o = null; }
      if (!o || o.v !== 1) return false;
      if (o.ui && typeof o.ui === 'object') for (const k of Object.keys(ui)) if (k in o.ui) ui[k] = o.ui[k];
      ui.confirmSol = null;
      if (!['lab', 'theory', 'tasks', 'apps'].includes(ui.page)) ui.page = 'lab';
      return eng.restore(o.engine);
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
        for (const r in out[e]) ev[e][r] = e === 'e3' && r === 'HCl' ? out[e][r] >= 3 - 1e-9 : out[e][r] > 0;
      }
      return ev;
    }

    // ---------------------------------------------------------- Kopfzeile und Seiten
    function setPage(p) {
      const gate = { theory: theoryOpen, tasks: tasksOpen, apps: appsOpen }[p];
      ui.page = p;
      if (p === 'theory' && gate && gate()) { if (!ui.revealed) { ui.revealed = true; refreshLab(true); } }
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
    }
    function lockHtml(title, need, key) {
      return `<div class="lk-card lockcard"><h2>${esc(title)}</h2><p>${need}</p>
        <p class="lk-muted">Dieser Teil baut auf deinen eigenen Beobachtungen bzw. Rechnungen auf. Für Wiederholung oder Unterricht kannst du ihn trotzdem öffnen.</p>
        <div class="lk-row"><button type="button" class="lk-btn" data-go="lab">Zurück ins Labor</button><button type="button" class="lk-btn" data-force="${key}">Trotzdem öffnen</button></div></div>`;
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
    /** Feste, aber nicht naheliegende Reihenfolge der Antwortmöglichkeiten (richtige Antwort nicht immer zuerst). */
    function mixed(id, opts) {
      const h = (t) => { let x = 2166136261; for (const ch of id + '|' + t) x = Math.imul(x ^ ch.charCodeAt(0), 16777619); return x >>> 0; };
      return opts.slice().sort((p, q) => h(p) - h(q));
    }
    function fieldHtml(prefix, f, val, res, unit) {
      const cls = res ? (res.ok ? 'right' : res.empty ? '' : 'wrong') : '';
      const fb = res && res.empty ? '<p class="ffb lk-muted">noch nicht beantwortet</p>' : res ? `<p class="ffb ${res.ok ? 'y' : 'n'}">${res.ok ? '✓ richtig' : '✗ ' + esc(res.fb)}${res.kind && !res.ok ? ` <span class="badge warn">${{ unit: 'Einheit', stoich: 'Stöchiometrie', quotient: 'Quotient', log: 'Logarithmus', calc: 'Rechnung', concept: 'Ansatz', format: 'Eingabe' }[res.kind] || ''}</span>` : ''}</p>` : '';
      const name = `${prefix}:${f.id}`;
      if (f.type === 'select') {
        return `<div class="frow sel"><span class="flabel">${esc(f.label)}</span><select data-f="${name}" class="${cls}" aria-label="${esc(f.label)}"><option value="">– wählen –</option>${mixed(name, f.options).map((o) => `<option ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${fb}</div>`;
      }
      if (f.type === 'radio') {
        return `<div class="frow"><span class="flabel">${esc(f.label)}</span><div class="radios">${mixed(name, f.options).map((o) => `<label class="lk-opt ${val === o ? (res && !res.empty ? (res.ok ? 'right' : 'wrong') : '') : ''}"><input type="radio" name="${name}" data-f="${name}" value="${esc(o)}" ${val === o ? 'checked' : ''}> <span>${esc(o)}</span></label>`).join('')}</div>${fb}</div>`;
      }
      if (f.type === 'amount') {
        return `<div class="frow"><span class="flabel">${esc(f.label)} =</span><input type="text" inputmode="decimal" data-f="${name}" class="${cls}" value="${esc(val || '')}" aria-label="${esc(f.label)}" autocomplete="off"><select data-u="${name}" aria-label="Einheit für ${esc(f.label)}"><option value="">Einheit</option>${L.UNITS.map((u) => `<option ${unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>${fb}</div>`;
      }
      return `<div class="frow"><span class="flabel">${esc(f.label)}</span><input type="text" inputmode="decimal" data-f="${name}" class="${cls}" value="${esc(val || '')}" aria-label="${esc(f.label)}" autocomplete="off">${fb}</div>`;
    }
    function tipsHtml(hints, n) { return n ? `<div class="lk-card tipbox">${hints.slice(0, n).map((h, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(h)}</p>`).join('')}</div>` : ''; }
    const tipLabel = (n) => (n ? (n < 3 ? `Nächster Tipp (${n + 1}/3)` : 'Tipp 3/3') : 'Tipp');

    function theoryHtml() {
      if (!theoryOpen()) return lockHtml('Herleitung', 'Führe zuerst Versuch 1 durch und gib im Reiter <b>Aufgabe</b> deine <b>Deutung</b> ab („Was muss das Wunderwasser enthalten?“).', 'theory');
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
        <div class="lk-card reveal"><h3>Auflösung: das Wunderwasser</h3><p>30,0 mL Phosphatpufferlösung, c(H₂PO₄⁻) = c(HPO₄²⁻) = 0,050 mol/L (als Natriumsalze). Säure: H₂PO₄⁻, Base: HPO₄²⁻, pKₛ₂ = 7,20. Im idealen Modell ergibt das pH ≈ 7,20.</p><p class="meta">Ein zertifizierter „pH-7-Kalibrierpuffer“ ist nicht automatisch ein ideales 1 : 1-Gemisch mit pH 7,00 (Aktivitäten, Temperatur).</p></div></div>
        ${steps}
        ${all ? `<section class="tstep done"><h2>Ergebnis</h2><span class="eqline">pH = pKₛ + lg [ c(A⁻) / c(HA) ]</span>
          <p><b>Gültigkeit:</b> In Aktivitäten formuliert ist die Gleichung eine exakte Umformung des Gleichgewichts. Die übliche Konzentrationsform und das Einsetzen formaler Stoffmengen sind Näherungen. Beide Partner müssen in geeigneter Menge vorliegen. Zugegebene starke Säure bzw. Base erst stöchiometrisch umsetzen, dann das neue Verhältnis einsetzen. Ist ein Partner verbraucht, darf man nicht logarithmieren – dann bestimmt der Überschuss den pH-Wert. Die App rechnet intern mit der vollständigen Ladungsbilanz weiter.</p>
          <p><b>Pufferbereich ≠ Pufferkapazität:</b> Der Bereich (≈ pKₛ ± 1) sagt, <i>wo</i> ein Paar puffert. Die Kapazität sagt, <i>wie viel</i> Säure oder Base es umsetzen kann; sie wächst mit den Stoffmengen. Bei gegebener Gesamtkonzentration ist die (differentielle) Pufferwirkung nahe gleichen Anteilen am größten; die Reserve für weitere Säure hängt von n(A⁻), die für weitere Lauge von n(HA) ab.</p>
          <p class="lk-note ok">Im Labor kannst du jetzt im Diagramm „pKₛ ± 1“ einblenden; die Messwertkarten zeigen formale Stoffmengen und den H-H-Vergleich. Weiter geht es mit <button type="button" class="lk-btn small" data-go="tasks">3 Rechnen</button></p></section>` : ''}`;
    }

    // ---------------------------------------------------------- Rechenaufgaben
    function tasksHtml() {
      if (!tasksOpen()) return lockHtml('Rechnen', 'Schließe zuerst die <b>Herleitung</b> ab (alle sieben Schritte geprüft oder gelöst).', 'tasks');
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
      if (!appsOpen()) return lockHtml('Puffer in Natur und Technik', 'Bearbeite zuerst alle <b>sechs Rechenaufgaben</b> (jeweils mindestens einmal prüfen).', 'apps');
      const cards = L.APPLICATIONS.map((a) => {
        const q = a.q, val = ui.apps[q.id], st = ui.apps[q.id + ':res'];
        return `<section class="tstep" data-app="${a.id}"><h2>${esc(a.title)}</h2>
          <dl class="facts"><dt>Paar</dt><dd>${esc(a.pair)}</dd><dt>Zweck</dt><dd>${esc(a.purpose)}</dd><dt>pH-Bezug</dt><dd>${esc(a.ph)}</dd><dt>Modellgrenze</dt><dd>${esc(a.limit)}</dd></dl>
          <fieldset class="lk-form" style="border:0;padding:0;margin:0"><legend style="font-weight:700">${esc(q.text)}</legend>
          ${q.options.map((o) => `<label class="lk-opt ${st && val === o.v ? (o.ok ? 'right' : 'wrong') : ''}"><input type="radio" name="app:${q.id}" data-app-q="${q.id}" value="${o.v}" ${val === o.v ? 'checked' : ''}> <span>${esc(o.t)}</span></label>`).join('')}</fieldset>
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
    }

    function questionHtml(e, q, ev, res) {
      const a = (ui.answers[e] || {})[q.id];
      const sol = ui.sol[e];
      if (q.type === 'free') return `<fieldset><legend>${esc(q.text)}</legend><textarea data-free="${q.id}" aria-label="${esc(q.text)}">${esc(a || '')}</textarea></fieldset>`;
      const r = res && res[q.id];
      const cls = r ? (r.status === 'right' ? 'fb-right' : r.status === 'unproven' ? 'fb-unproven' : r.status === 'empty' ? '' : 'fb-wrong') : '';
      const multi = q.type === 'multi';
      const opts = q.options.map((o) => {
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
      for (const q of P.questions) if (q.type !== 'free' && (!q.reveal || ui.revealed)) out[q.id] = L.gradeQuestion(q, (ui.answers[e] || {})[q.id], ev);
      return out;
    }

    function taskHtml() {
      const e = eng.state.exp, x = exp(), P = L.PROTOCOLS[e];
      let h = `<div class="lk-card"><h2>Versuch ${x.n}: ${esc(x.title)}</h2><p>${esc(P.intro)}</p><p class="meta"><b>Material:</b> ${esc(P.material)}</p></div>`;
      if (P.predict) {
        const pv = ui.predict[e];
        if (pv) h += `<div class="lk-card"><h3>Vermutung</h3><p>${esc(P.predict.text)} <b>${esc(P.predict.options.find((o) => o.v === pv.v).t)}</b></p><p class="saved">✓ festgehalten</p></div>`;
        else if (!ui.predictSkip[e]) {
          return h + `<form class="lk-form" id="predictForm"><fieldset><legend>1. Vermutung</legend><p>${esc(P.predict.text)}</p>${P.predict.options.map((o) => `<label class="lk-opt"><input type="radio" name="predict" value="${o.v}"> <span>${esc(o.t)}</span></label>`).join('')}</fieldset>
            <div class="lk-row"><button type="submit" class="lk-btn primary">Vermutung festhalten</button><button type="button" class="lk-btn" id="btnSkipPredict">ohne Vermutung weiter</button></div></form>
            <p class="lk-muted">Danach dosierst du selbst: Pipette wählen, Zugabe antippen.</p>`;
        }
      }
      const res = ui.checked[e] ? gradeAll(e) : null;
      let lastStep = '';
      const qs = P.questions.filter((q) => !q.reveal || ui.revealed);
      h += '<form class="lk-form" id="protoForm">';
      qs.forEach((q) => {
        if (q.step !== lastStep) { h += `<p class="qstep">${esc(q.step)}</p>`; lastStep = q.step; }
        h += questionHtml(e, q, null, res);
      });
      h += '<div class="lk-row end">';
      h += '<button type="submit" class="lk-btn primary">Antworten prüfen</button>';
      h += `<button type="button" class="lk-btn" id="btnTip">Tipp</button>`;
      h += ui.sol[e] ? '' : '<button type="button" class="lk-btn" id="btnSol">Lösung anzeigen</button>';
      h += '</div></form>';
      if (ui.confirmSol === 'proto:' + e) h += '<div class="lk-note warn" role="alert">Du hast noch nicht alles bearbeitet. Lösung trotzdem anzeigen?<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnSolYes">Ja, Lösung anzeigen</button><button type="button" class="lk-btn" id="btnSolNo">Abbrechen</button></div></div>';
      if ((ui.fails[e] || 0) >= 2 && res && !Object.values(res).every((r) => r.status === 'right')) h += '<div class="lk-note info">Das hat noch nicht ganz geklappt. Ein Tipp hilft dir weiter – Schaltfläche „Tipp“.</div>';
      if (e === 'e1' && ui.revealed) h += `<div class="lk-card reveal"><h3>Auflösung</h3><p>Das Wunderwasser ist eine <b>Phosphatpufferlösung</b>: 30,0 mL mit c(H₂PO₄⁻) = c(HPO₄²⁻) = 0,050 mol/L (Natriumsalze). HPO₄²⁻ nimmt Protonen von H₃O⁺ auf, H₂PO₄⁻ gibt Protonen an OH⁻ ab. Die Teilchenansicht des Puffers ist jetzt freigeschaltet – beobachte die Zeitlupe.</p></div>`;
      if (e === 'e1' && ui.revealed && !theoryOpen()) h += '';
      if (e === 'e1' && ui.revealed) h += '<p class="lk-note ok">Als Nächstes: <b>Versuch 2</b> (Acetat) und danach die <button type="button" class="lk-btn small" data-go="theory">2 Herleitung</button></p>';
      return h;
    }

    function recAt(b, v) { const r = b.records.find((p) => Math.abs(p.v - v) < 1e-6); return r ? de(r.pH, 2) : '–'; }
    function resultsHtml() {
      const e = eng.state.exp, x = exp();
      const live = Object.values(eng.state.series).filter((s) => s.exp === e && s.beakers.some((b) => b.records.length > 1));
      const arch = eng.state.archive.filter((a) => a.exp === e);
      const rows = (name, recsList, keys) => keys.map((k, i) => {
        const b = recsList[i], last = b.records[b.records.length - 1];
        return `<tr><td>${LETTER(i)} ${esc(sampleName(k))}</td><td>${de(b.records[0].pH, 2)}</td><td>${recAt(b, 0.05)}</td><td>${recAt(b, 1)}</td><td>${de(last.pH, 2)} <span class="lk-muted">(${de(last.v, 2)} mL)</span></td></tr>`;
      }).join('');
      const table = (title, sub, list, keys, cmp) => `<div class="lk-card reslist"><h3>${title}</h3><p class="meta">${sub}</p><table><tr><th>Probe</th><th>Start</th><th>0,05 mL</th><th>1,0 mL</th><th>zuletzt</th></tr>${rows(title, list, keys)}</table>${cmp ? `<div class="lk-row" style="margin-top:6px"><button type="button" class="lk-btn small" data-cmp="${cmp}">${ui.compare === cmp ? 'Vergleich ausblenden' : 'Im Diagramm vergleichen'}</button></div>` : ''}</div>`;
      let h = `<div class="lk-card"><h2>Ergebnisse – Versuch ${x.n}</h2><p class="meta">pH-Werte deiner Messreihen (stabile Messwerte nach dem Mischen). Säure- und Laugenreihen sind getrennte, frische Ansätze.</p></div>`;
      if (!live.length && !arch.length) h += '<p class="lk-muted">Noch keine Messungen in diesem Versuch.</p>';
      for (const s of live) h += table(`${s.kind === 'cont' ? 'Gegenprobe' : 'Aktuelle Reihe'}: ${reagentName(s.reagent)}`, seriesDesc(s), s.beakers, s.beakers.map((b) => b.key));
      for (const a of arch.slice().reverse()) h += table(`Gespeichert: ${reagentName(a.reagent)} (${a.why})`, `${a.kind === 'cont' ? 'Gegenprobe · ' : ''}${new Date(a.archived).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`, a.runs, a.runs.map((r) => r.key), a.id);
      return h;
    }
    function seriesDesc(s) {
      const r = E.REAGENTS[s.reagent];
      if (s.kind === 'cont') return `Zugabe ${r.label} zu den bereits mit ${reagentName(s.from.reagent)} behandelten Ansätzen (vorher ${s.from.added.map((v) => de(v, 2) + ' mL').join(' / ')}).`;
      return `Frische Ansätze, Zugabe ${r.label}.`;
    }

    function journalHtml() {
      return `<div class="lk-card"><h2>Journal</h2><p class="meta">Sammelt deine Vermutungen, Beobachtungen, Deutungen, ausgewählte Messdaten und Rechnungen. Gespeichert wird nur in diesem Browser.</p>
        <div class="lk-row"><button type="button" class="lk-btn" id="btnPrint">Drucken</button><button type="button" class="lk-btn" id="btnExport">Als HTML-Datei speichern</button></div></div>
        <div class="lk-card">${journalBody()}</div>
        <div class="lk-card"><h3>Zurücksetzen</h3><p class="meta"><b>Frische Probe</b> (an einer Messwertkarte) ersetzt ein Glas, <b>Neue Messreihe</b> stellt alle Gläser frisch auf (alte Reihe bleibt gespeichert). <b>Alles zurücksetzen</b> löscht alle Messreihen, Antworten und Rechnungen.</p>
        ${ui.confirmSol === 'reset' ? '<div class="lk-note warn" role="alert">Wirklich alles löschen?<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnResetYes">Ja, alles löschen</button><button type="button" class="lk-btn" id="btnResetNo">Abbrechen</button></div></div>' : '<button type="button" class="lk-btn" id="btnReset">Alles zurücksetzen</button>'}</div>`;
    }
    function journalBody() {
      let h = '';
      for (const x of E.EXPERIMENTS) {
        const P = L.PROTOCOLS[x.id], a = ui.answers[x.id] || {};
        const parts = [];
        if (P.predict && ui.predict[x.id]) parts.push(`<p><b>Vermutung:</b> ${esc(P.predict.text)} ${esc(P.predict.options.find((o) => o.v === ui.predict[x.id].v).t)}</p>`);
        for (const q of P.questions) {
          const v = a[q.id];
          if (v == null || (Array.isArray(v) && !v.length) || v === '') continue;
          const text = q.type === 'free' ? esc(v) : q.type === 'multi' ? v.map((k) => esc(q.options.find((o) => o.v === k).t)).join('; ') : esc((q.options.find((o) => o.v === v) || {}).t);
          parts.push(`<p><b>${esc(q.step)}:</b> ${text}</p>`);
        }
        const data = [];
        for (const s of Object.values(eng.state.series)) {
          if (s.exp !== x.id || !s.beakers.some((b) => b.added > 0)) continue;
          data.push(`<tr><td>${s.kind === 'cont' ? 'Gegenprobe ' : ''}${reagentName(s.reagent)}</td>${s.beakers.map((b, i) => `<td>${LETTER(i)} ${esc(sampleName(b.key))}: ${de(b.records[0].pH, 2)} → ${de(b.records[b.records.length - 1].pH, 2)} (${de(b.added, 2)} mL)</td>`).join('')}</tr>`);
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

    // ---------------------------------------------------------- Labor: Leisten, Karten, Ansichten
    function renderBars() {
      const st = eng.state, busy = eng.busy();
      $('#expChips').innerHTML = E.EXPERIMENTS.map((x) => `<button type="button" data-exp="${x.id}" aria-pressed="${x.id === st.exp}"><b>${x.n}</b>${esc(x.short)}</button>`).join('');
      const a = eng.slots(st.exp);
      document.querySelectorAll('#slots [data-slot]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.slot === st.slot));
        if (b.dataset.slot === 'cont') { b.hidden = !a.cont; if (a.cont) b.innerHTML = `Gegenprobe <small>${reagentName(eng.state.series[a.cont].reagent)}</small>`; }
      });
      const s = series();
      const grp = (tool, label) => `<span class="pip ${st.tool === tool ? 'active' : ''}" data-pip="${tool}"><span class="lbl">${label}</span>` + Object.entries(E.DOSES).filter(([, d]) => d.tool === tool).map(([k, d]) => `<button type="button" class="dose" data-dose="${k}" aria-disabled="${busy || ui.speed === 0}" aria-label="${d.label} ${s.reagent} mit der ${label} zugeben">${d.label}</button>`).join('') + '</span>';
      $('#doses').innerHTML = grp('dropper', 'Tropfpipette') + grp('measure', 'Messpipette');
      const n = s.beakers.length;
      if (ui.target !== 'all' && Number(ui.target) >= n) ui.target = 'all';
      $('#targets').innerHTML = '<span class="lbl">Ziel</span>' + `<button type="button" class="tgt" data-target="all" aria-pressed="${ui.target === 'all'}" title="Vergleichsmodus: dieselbe Zugabe nacheinander in alle Gläser">Alle</button>` + s.beakers.map((b, i) => `<button type="button" class="tgt" data-target="${i}" aria-pressed="${String(ui.target) === String(i)}" aria-label="nur Glas ${LETTER(i)}: ${esc(sampleName(b.key))}">${LETTER(i)}</button>`).join('');
      document.querySelectorAll('#speed [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === ui.speed)));
      $('#btnStep').disabled = ui.speed !== 0;
      $('#chkIndicator').checked = ui.indicator; $('#chkEvents').checked = ui.events;
      $('#chkZoom').checked = ui.zoom;
      const pk = $('#chkPka'); pk.disabled = !numbersOpen(); pk.checked = ui.pka && numbersOpen();
      $('#pkaWrap').classList.toggle('disabled', !numbersOpen());
      $('#pkaWrap').title = numbersOpen() ? 'pKₛ und Faustregel-Bereich ± 1 einzeichnen' : 'Nach der Herleitung verfügbar';
      $('#btnCont').textContent = s.kind === 'cont' ? 'Gegenprobe läuft' : `Gegenprobe mit ${s.reagent === 'HCl' ? 'NaOH' : 'HCl'}`;
      $('#btnCont').disabled = s.kind === 'cont' || !eng.used(s) || busy;
      $('#btnNewSeries').disabled = !eng.used(s) || busy;
      // Vergleichsauswahl
      const arch = eng.state.archive.filter((x) => x.exp === st.exp);
      if (ui.compare && !arch.some((x) => x.id === ui.compare)) ui.compare = '';
      $('#cmpSelect').innerHTML = `<option value="">Vergleich: keiner</option>` + arch.map((x, i) => `<option value="${x.id}" ${x.id === ui.compare ? 'selected' : ''}>Vergleich: gespeicherte ${reagentName(x.reagent)}-Reihe ${i + 1}</option>`).join('');
      $('#cmpSelect').disabled = !arch.length;
    }

    function buildViews() {
      const s = series();
      viewSeries = s.id + ':' + s.beakers.map((b) => b.key).join(',');
      const box = $('#pviews');
      box.innerHTML = s.beakers.map((b, i) => `<div class="pview" data-i="${i}" style="border-left:4px solid ${CH.STYLE[i].color}"><header><b class="nm">${LETTER(i)} · ${esc(sampleName(b.key))}</b><span class="sub">Teilchenebene (Modell)</span><span class="val"></span></header><div class="pc"><canvas aria-hidden="true"></canvas></div><div class="pbar"></div><div class="pfoot"></div></div>`).join('');
      views.length = 0;
      box.querySelectorAll('.pview').forEach((el, i) => {
        const v = new PV.ParticleView(el.querySelector('canvas'));
        v.el = el; v.sig = '';
        views.push(v);
      });
      buildLegend();
      tagsSig = ''; readSig = ''; chartSig = '';
    }
    function buildLegend() {
      const s = series();
      const ac = s.beakers.some((b) => b.comp.Ac > 0), ph = s.beakers.some((b) => b.comp.P > 0) && ui.revealed;
      const items = [];
      if (ac) items.push(['HA', 'CH₃COOH (HA)'], ['A', 'CH₃COO⁻ (A⁻)']);
      if (ph) items.push(['H2PO4', 'H₂PO₄⁻'], ['HPO4', 'HPO₄²⁻']);
      items.push(['H3O', 'H₃O⁺'], ['OH', 'OH⁻']);
      const el = $('#plegend');
      el.innerHTML = items.map(([k, t]) => `<span class="sym"><canvas data-sp="${k}" aria-hidden="true"></canvas>${t}</span>`).join('') +
        `<span class="note" title="Die wenigen Symbole zeigen freie H₃O⁺-/OH⁻-Ionen nicht maßstäblich: Ihre Anzahl wächst um 1,5 Symbole je pH-Einheit Abstand von 7. Der pH-Wert stammt immer aus dem Modell.">Modell: 1 Symbol ≙ ${de(PV.SCALE, 3)} mmol · H₃O⁺/OH⁻ hervorgehoben, Anzahl logarithmisch, nicht maßstäblich · Na⁺/Cl⁻ ausgeblendet · Wasser = Hintergrund</span>`;
      el.querySelectorAll('canvas').forEach((c) => PV.legendIcon(c, c.dataset.sp));
    }

    function updateViews(dt, real) {
      const s = series();
      if (viewSeries !== s.id + ':' + s.beakers.map((b) => b.key).join(',')) buildViews();
      s.beakers.forEach((b, i) => {
        const v = views[i];
        if (!v) return;
        const locked = !!E.SAMPLES[b.key].hidden && !ui.revealed;
        if (locked !== v.locked) { v.locked = locked; v.el.classList.toggle('locked', locked); v.el.querySelector('.pc').dataset.lock = 'Die Teilchenansicht des Wunderwassers wird nach deiner Deutung freigeschaltet (Bedienfeld → Aufgabe).'; v.sig = ''; }
        const sig = `${b.records.length}|${b.key}|${ui.revealed}|${numbersOpen()}`;
        if (sig !== v.sig) {
          v.sig = sig;
          const tc = PV.targetCounts(b.shown.comp);
          if (!locked) v.sync(tc.counts, b.key);
          v.el.querySelector('.pbar').innerHTML = barHtml(b, tc, locked);
          v.el.querySelector('header .nm').textContent = `${LETTER(i)} · ${sampleName(b.key)}`;
        }
        v.frame(dt, b, eng.state.time, { showEvents: ui.events, reduceMotion: ui.reduceMotion, real });
      });
    }
    function barHtml(b, tc, locked) {
      if (locked) return '<div class="info">Zusammensetzung wird nach deiner Deutung aufgedeckt.</div>';
      const r = tc.r, c = b.shown.comp, nums = numbersOpen();
      const seg = (cls, label, f) => (f > 0.004 ? `<div class="${cls}" style="flex-basis:${(f * 100).toFixed(2)}%">${f > 0.12 ? label + (nums ? ' ' + de(f * 100, 0) + ' %' : '') : ''}</div>` : '');
      if (c.Ac > 0) return seg('acid', 'HA', r.HA / c.Ac) + seg('base', 'A⁻', r.A / c.Ac);
      if (c.P > 0) return seg('acid2', 'H₃PO₄', r.H3PO4 / c.P) + seg('acid', 'H₂PO₄⁻', r.H2PO4 / c.P) + seg('base', 'HPO₄²⁻', r.HPO4 / c.P) + seg('base2', 'PO₄³⁻', r.PO4 / c.P);
      return `<div class="info">keine Puffer-Teilchen${nums ? ` · c(H₃O⁺) ≈ ${sci(r.h)} mol/L, c(OH⁻) ≈ ${sci(r.oh)} mol/L` : ' · freie H₃O⁺/OH⁻ siehe Symbole'}</div>`;
    }
    function sci(x) { const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); return `${de(m, 1)}·10${String(e).split('').map((ch) => (ch === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(ch)])).join('')}`; }

    function updateTags() {
      const s = series(), geo = eng.geometry(), box = $('#tags');
      const sig = s.id + s.beakers.map((b) => b.key).join(',') + lab.view.w + 'x' + lab.view.h + ui.revealed + ui.target + s.reagent;
      if (sig !== tagsSig) {
        tagsSig = sig;
        const sc = lab.view.scale;
        let h = '';
        s.beakers.forEach((b, i) => {
          const g = geo[i], p = lab.toScreen(g.x, G().BENCH + 9);
          const w = Math.max(64, Math.min(220, (g.half * 2 + 66) * sc));
          const sel = ui.target === 'all' || String(ui.target) === String(i);
          const compact = w < 80;
          h += `<div class="tag ${sel ? 'target' : ''} ${compact ? 'compact' : ''}" data-tag="${i}" title="${esc(sampleName(b.key))}" style="left:${p.x}px;top:${p.y}px;max-width:${w}px"><b>${compact ? LETTER(i) : LETTER(i) + ' · ' + esc(sampleName(b.key))}</b><br><span class="ph"></span> <span class="st"></span></div>`;
        });
        for (const k of ['HCl', 'NaOH']) { const p = lab.toScreen(G().BOTTLES[k].x, G().BENCH - 114); h += `<div class="tag bottle ${s.reagent === k ? 'active' : ''}" style="left:${p.x}px;top:${p.y - 20}px">${k}</div>`; }
        box.innerHTML = h;
      }
      s.beakers.forEach((b, i) => {
        const el = box.querySelector(`[data-tag="${i}"]`);
        if (!el) return;
        const m = eng.meter(b);
        const ph = el.querySelector('.ph'), st = el.querySelector('.st');
        const t1 = 'pH ' + de(m.pH, 2);
        if (ph.textContent !== t1) ph.textContent = t1;
        const t2 = el.classList.contains('compact') ? '' : m.mixing ? '…' : '✓';
        if (st.textContent !== t2) { st.textContent = t2; st.classList.toggle('mix', m.mixing); }
      });
    }
    const G = () => root.PF.geometry;

    function updateReadouts(force) {
      const s = series();
      if (viewSeries !== s.id + ':' + s.beakers.map((b) => b.key).join(',')) buildViews();
      const sig = s.id + s.beakers.map((b) => `${b.key}:${b.records.length}:${b.pending.length}`).join(',') + ui.revealed + numbersOpen() + eng.busy();
      if (!force && sig === readSig) return;
      readSig = sig;
      const r = E.REAGENTS[s.reagent];
      $('#seriesNote').textContent = seriesDesc(s);
      s.beakers.forEach((b, i) => {
        const v = views[i]; if (!v) return;
        const last = b.records[b.records.length - 1], d = last.pH - b.records[0].pH;
        v.el.querySelector('header .val').innerHTML = `pH <b>${de(last.pH, 2)}</b> · ΔpH <b>${(d >= 0 ? '+' : '−') + de(Math.abs(d), 2)}</b>${b.pending.length ? ' <span class="mix">mischt …</span>' : ''}`;
        v.el.querySelector('.pfoot').innerHTML = `<div class="nums"><span>V(${s.reagent}) <b>${de(last.v, 2)} mL</b></span><span>n(${r.ion}) zugegeben <b>${de(C.C_REAGENT * last.v, 4)} mmol</b></span><span>V ges. <b>${de(b.comp0.V + last.v, 2)} mL</b></span><span>Ref. <b>pH ${de(b.records[0].pH, 2)}</b></span>
          <span class="acts">${s.kind === 'fresh' ? `<button type="button" class="lk-btn" data-fresh="${i}" ${eng.busy() ? 'disabled' : ''} title="Dieses Glas durch eine frische, unbehandelte Probe ersetzen">Frische Probe</button>` : '<span class="lk-muted">Gegenprobe</span>'}${exp().ratio && s.kind === 'fresh' ? `<select data-ratio="${i}" aria-label="Ansatz für Glas ${LETTER(i)} ändern" ${eng.busy() ? 'disabled' : ''}><option value="">Ansatz ändern …</option>${E.RATIO_KEYS.map((k) => `<option value="${k}" ${k === b.key ? 'disabled' : ''}>${E.SAMPLES[k].name}</option>`).join('')}</select>` : ''}</span></div>
          ${numbersOpen() ? formalHtml(b) : ''}`;
      });
    }
    function formalHtml(b) {
      const c = b.shown.comp;
      if (E.SAMPLES[b.key].hidden && !ui.revealed) return '';
      const f = C.formal(c), pHm = C.pH(c);
      if (c.Ac > 0) {
        const hh = C.hh(C.PKA_AC, f.A, f.HA);
        return `<div class="formal">formal: n(HA) = ${de(f.HA, 3)} mmol · n(A⁻) = ${de(f.A, 3)} mmol${f.HA > 0 && f.A > 0 ? ` · A⁻ : HA = ${de(f.A / f.HA, 2)}` : ''} · ${hh == null ? `H-H nicht anwendbar (${f.excessAcid > 0 ? 'Säureüberschuss ' + de(f.excessAcid, 3) + ' mmol' : f.excessBase > 0 ? 'Basenüberschuss ' + de(f.excessBase, 3) + ' mmol' : 'ein Partner fehlt'})` : `H-H: pH ≈ ${de(hh, 2)} (Modell ${de(pHm, 2)})`}</div>`;
      }
      if (c.P > 0) {
        const pairs = [['H3PO4', 'H2PO4', 0], ['H2PO4', 'HPO4', 1], ['HPO4', 'PO4', 2]];
        const N = { H3PO4: 'H₃PO₄', H2PO4: 'H₂PO₄⁻', HPO4: 'HPO₄²⁻', PO4: 'PO₄³⁻' };
        const pr = pairs.find(([a, bb]) => f[a] > 0 && f[bb] > 0) || pairs[1];
        const hh = C.hh(C.PKA_P[pr[2]], f[pr[1]], f[pr[0]]);
        return `<div class="formal">formal: n(${N[pr[0]]}) = ${de(f[pr[0]], 3)} mmol · n(${N[pr[1]]}) = ${de(f[pr[1]], 3)} mmol · ${hh == null ? 'H-H nicht anwendbar' : `H-H (pKₛ${'₁₂₃'[pr[2]]} = ${de(C.PKA_P[pr[2]], 2)}): pH ≈ ${de(hh, 2)} (Modell ${de(pHm, 2)})`}</div>`;
      }
      return `<div class="formal">kein Puffer: ${f.excessAcid > 0 ? 'Überschuss H₃O⁺ ' + de(f.excessAcid, 4) + ' mmol' : f.excessBase > 0 ? 'Überschuss OH⁻ ' + de(f.excessBase, 4) + ' mmol' : 'neutral'}</div>`;
    }

    function updateChart(chart, force) {
      const s = series();
      const box = $('#chart').getBoundingClientRect();
      const band = ui.pka && numbersOpen() ? (eng.state.exp === 'e1' ? { pKa: 7.2, label: 'Phosphat: pKₛ₂ = 7,20 (Faustregel ± 1)' } : { pKa: 4.75, label: 'Acetat: pKₛ = 4,75 (Faustregel ± 1)' }) : null;
      const sig = s.id + s.beakers.map((b) => b.key + b.records.length).join(',') + ui.zoom + !!band + ui.compare + Math.round(box.width) + 'x' + Math.round(box.height) + ui.revealed;
      if (!force && sig === chartSig) return;
      chartSig = sig;
      const curves = s.beakers.map((b, i) => ({ label: `${LETTER(i)} ${sampleName(b.key)}`, records: b.records, style: CH.STYLE[i] }));
      const a = ui.compare ? eng.state.archive.find((x) => x.id === ui.compare) : null;
      const compare = a ? a.runs.map((r, i) => ({ label: `${sampleName(r.key)}`, records: r.records, style: CH.STYLE[i % 3] })) : [];
      const rg = E.REAGENTS[s.reagent];
      const xLabel = `V(${s.reagent}) in mL · c = 0,100 mol/L`;
      chart.draw({ curves, compare, xLabel, zoom: ui.zoom, band });
      $('#chartTitle').textContent = `pH gegen zugegebenes Volumen ${rg.name} (${s.reagent})${s.kind === 'cont' ? ' – Gegenprobe' : ''}`;
      $('#chartLegend').innerHTML = curves.map((c) => `<span class="it">${CH.legendSwatch(c.style)}${esc(c.label)}</span>`).join('') + (a ? compare.map((c) => `<span class="it">${CH.legendSwatch(c.style, true)}gespeichert (${reagentName(a.reagent)}): ${esc(c.label)}</span>`).join('') : '') + '<span class="it lk-muted">Linien verbinden Messpunkte nur zur Orientierung.</span>';
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
      ui, toast, save, load, evidence, setPage, renderSteps, renderPage, renderPanel, renderBars, buildViews, updateViews, updateTags, updateReadouts, updateChart, refreshLab, gradeAll, journalDoc, journalBody,
      theoryOpen, theoryDone, tasksOpen, appsOpen, numbersOpen, sampleName
    };
  }

  (root.PF = root.PF || {}).createUI = createUI;
})(typeof self !== 'undefined' ? self : this);
