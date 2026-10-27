/*
 * Oberfläche des Halbtitrationslabors: Ansichten, Theorie, Planung, Labor
 * ----------------------------------------------------------------------
 * Die Auswertung (Laborjournal) und der Bericht stehen in journal.js.
 * Alle Messdaten entstehen durch Handlungen im Labor; Modellwissen
 * (Literatur, Modellkurve) erscheint erst nach Abgabe des eigenen Ergebnisses.
 */
(function (global) {
  'use strict';

  const NS = global.Halbtitration;
  const Chem = NS.Chemistry;
  const Ind = NS.Indicators;
  const Ev = NS.Evaluation;
  const C = NS.Content;
  const Store = NS.Store;
  const fmt = NS.Format.fmt;

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  /** HTML-sicher; schreibt pK_B, K_B und pK_W mit tiefgestelltem Index */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; })
      .replace(/(p?K)_([BWw])/g, function (m, k, i) { return k + '<sub>' + i.toUpperCase() + '</sub>'; });
  }

  /** Indexschreibweise in fertigem HTML (nur außerhalb von Tags) */
  function subs(html) {
    return String(html).replace(/(^|>)([^<]*)/g, function (m, a, text) {
      return a + text.replace(/(p?K)_([BWw])/g, function (m2, k, i) { return k + '<sub>' + i.toUpperCase() + '</sub>'; });
    });
  }

  const params = new URLSearchParams(global.location.search);
  const SPEED = Math.max(1, Math.min(50, Number(params.get('speed')) || 1));
  const START_READINGS = [0.4, 0.25, 0.55, 0.35, 0.6, 0.3];

  // ------------------------------------------------------------ Zustand

  const state = Store.load();
  const labs = {};

  function exp() { return Chem.experiment(state.current); }
  function es() { return state.exps[state.current]; }

  function labFor(id) {
    if (!labs[id]) {
      const lab = new NS.Lab(Chem.experiment(id));
      lab.timeScale = SPEED;
      const saved = state.exps[id].lab;
      if (saved) lab.restore(saved);
      bindLab(lab, id);
      labs[id] = lab;
    }
    return labs[id];
  }
  function lab() { return labFor(state.current); }

  let saveTimer = null;
  let storageWarned = false;
  function save(now) {
    clearTimeout(saveTimer);
    const run = function () {
      Object.keys(labs).forEach(function (id) { state.exps[id].lab = labs[id].toJSON(); });
      if (!Store.save(state) && !storageWarned) {
        storageWarned = true;
        toast('Lokales Speichern ist in diesem Browser nicht möglich. Die App funktioniert weiter, Eingaben gehen aber beim Neuladen verloren.', 'warn', 8000);
      }
    };
    if (now) run(); else saveTimer = setTimeout(run, 300);
  }

  // ------------------------------------------------------------ Hilfen der Oberfläche

  function toast(text, kind, ms) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    const area = $('#toastArea');
    // höchstens drei Hinweise gleichzeitig, damit das Bedienfeld frei bleibt
    while (area.children.length >= 3) area.firstElementChild.remove();
    area.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 320); }, ms || 3800);
  }

  /** Modaler Dialog; buttons: [{label, value, primary, warn}] → Promise(value) */
  function modal(title, bodyHtml, buttons) {
    return new Promise(function (resolve) {
      const m = $('#modal');
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = subs(bodyHtml);
      const act = $('#modalActions');
      act.innerHTML = '';
      const prev = document.activeElement;
      (buttons || [{ label: 'Schließen', value: null, primary: true }]).forEach(function (b) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'btn' + (b.primary ? ' primary' : '') + (b.warn ? ' warn' : '');
        el.textContent = b.label;
        el.addEventListener('click', function () { close(b.value); });
        act.appendChild(el);
      });
      function close(v) {
        m.hidden = true;
        document.removeEventListener('keydown', onKey, true);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      }
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(null); } }
      document.addEventListener('keydown', onKey, true);
      m.hidden = false;
      const first = act.querySelector('.primary') || act.querySelector('button');
      if (first) first.focus();
    });
  }

  function confirmBox(title, text, okLabel) {
    return modal(title, '<p>' + text + '</p>', [{ label: 'Abbrechen', value: false }, { label: okLabel || 'OK', value: true, primary: true }]);
  }

  // ------------------------------------------------------------ Messreihen

  function activeSeries() {
    const e = es();
    return e.active >= 0 ? e.series[e.active] || null : null;
  }

  function seriesLabel(s) {
    return 'Messreihe ' + s.no + ' · ' + (s.kind === 'survey' ? 'Erstdurchgang' : 'Halbtitration');
  }

  function newSeries(kind) {
    const e = es();
    const no = e.series.length ? Math.max.apply(null, e.series.map(function (s) { return s.no; })) + 1 : 1;
    const s = {
      id: 'R' + no, no: no, kind: kind, sample: e.sampleNo, points: [], endpoint: null,
      startReading: null, refills: [], finished: false, indicator: lab().indicator || e.plan.indicator || 'none',
      created: Date.now(),
    };
    e.series.push(s);
    e.active = e.series.length - 1;
    if (kind === 'survey') e.evalSurvey = s.id;
    else e.evalHalf = s.id;
    return s;
  }

  /** Frische Probe ansetzen (Kolben leer); Bürette, Kalibrierung und alle Messreihen bleiben */
  function freshSample(kind) {
    const l = lab();
    if (l.isFlowing) l.closeValve();
    const e = es();
    const cur = activeSeries();
    if (cur && !cur.points.length && cur.endpoint === null && !l.dispensed) {
      // unbenutzte Reihe weiterverwenden
      cur.kind = kind;
      if (kind === 'survey') e.evalSurvey = cur.id; else e.evalHalf = cur.id;
    } else {
      if (cur) cur.finished = true;
      e.active = -1;
    }
    e.sampleNo += 1;
    l.newSample();
    renderer.setLab(l);
    if (e.active < 0) newSeries(kind);
    autoPending = false;
    save();
    renderLab();
  }

  function takeReading(auto) {
    const l = lab();
    const s = activeSeries();
    if (!s) return;
    if (!l.meterReady) {
      if (!auto) toast(l.calibration < 2 ? 'Das pH-Meter ist noch nicht kalibriert.' : 'Die Elektrode taucht nicht in die Probe ein.', 'warn');
      return;
    }
    const r = l.reading();
    const p = { v: r.v, pH: r.pH, stable: r.stable, settled: r.settled, homogeneous: r.homogeneous, stirred: r.stirred, t: Math.round(l.time * 10) / 10 };
    const i = s.points.findIndex(function (q) { return Math.abs(q.v - p.v) < 0.005; });
    if (i >= 0) s.points[i] = p; else s.points.push(p);
    s.points.sort(function (a, b) { return a.v - b.v; });
    if (!auto) {
      if (!r.settled) toast('Übernommen, während noch Maßlösung fließt – Messstatus „nicht stabil“.', 'warn');
      else if (!r.stable) toast('Übernommen, bevor die Anzeige stabil war (offener Kreis in der Kurve).', 'warn');
      else if (i >= 0) toast('Messpunkt bei ' + fmt(p.v, 2) + ' mL ersetzt.');
    }
    autoPending = false;
    save();
    renderLabDynamic(true);
  }

  async function markEndpoint() {
    const s = activeSeries();
    const l = lab();
    if (!s) return;
    if (s.endpoint && !(await confirmBox('Endpunkt erneut notieren?', 'Für diese Messreihe ist bereits ein Endpunkt bei ' + fmt(s.endpoint.v, 2) + ' mL notiert. Den neuen Wert stattdessen verwenden?', 'Neu notieren'))) return;
    if (l.isFlowing) l.closeValve();
    pendingEndpoint = true;
    toast('Hahn geschlossen – der Endpunkt wird notiert, sobald der letzte Tropfen angekommen ist.');
  }

  function recordEndpoint() {
    const s = activeSeries();
    const l = lab();
    pendingEndpoint = false;
    if (!s) return;
    s.endpoint = { v: l.addedRounded, reading: Math.round(l.burette.reading * 100) / 100, pH: l.displayPH };
    const f = es().fields;
    delete f['read_end_' + s.id];
    delete f['cons_' + s.id];
    toast('Endpunkt notiert. Lies jetzt den Bürettenstand ab und trage ihn ein.', 'ok');
    save();
    renderLab();
  }

  async function finishSeries() {
    const s = activeSeries();
    if (!s) return;
    if (!s.points.length) { toast('Diese Messreihe enthält noch keine Messwerte.', 'warn'); return; }
    if (!(await confirmBox('Messreihe beenden?', 'Die Messreihe wird gespeichert und kann in der Auswertung verwendet werden. Für weitere Messungen setzt du eine frische Probe an.', 'Beenden'))) return;
    lab().closeValve();
    s.finished = true;
    save();
    renderLab();
    toast(seriesLabel(s) + ' gespeichert.', 'ok');
  }

  async function repeatSeries() {
    const s = activeSeries();
    if (!s) return;
    if (!(await confirmBox('Messreihe wiederholen?', 'Die Messwerte von „' + esc(seriesLabel(s)) + '“ werden verworfen und eine frische Probe für denselben Zweck angesetzt. Andere Messreihen und deine Rechnungen bleiben erhalten.', 'Verwerfen und neu'))) return;
    const e = es();
    const kind = s.kind;
    e.series.splice(e.active, 1);
    Object.keys(e.fields).forEach(function (k) { if (k.endsWith('_' + s.id)) delete e.fields[k]; });
    e.active = -1;
    if (e.evalSurvey === s.id) e.evalSurvey = latest('survey');
    if (e.evalHalf === s.id) e.evalHalf = latest('half');
    freshSample(kind);
  }

  function latest(kind) {
    const list = es().series.filter(function (s) { return s.kind === kind; });
    return list.length ? list[list.length - 1].id : null;
  }

  async function resetMenu() {
    const v = await modal('Zurücksetzen', '<p><strong>Neue Probe</strong> und <strong>Messreihe wiederholen</strong> findest du im Labor. Sie löschen keine Rechnungen.</p><p><strong>Gesamtes Labor zurücksetzen</strong> löscht alle Messreihen, Rechnungen, Planungen und Antworten aller vier Versuche auf diesem Gerät.</p>', [
      { label: 'Abbrechen', value: null },
      { label: 'Gesamtes Labor zurücksetzen', value: 'all', warn: true },
    ]);
    if (v !== 'all') return;
    if (!(await confirmBox('Wirklich alles löschen?', 'Dieser Schritt kann nicht rückgängig gemacht werden.', 'Alles löschen'))) return;
    Store.clear();
    const fresh = Store.createState();
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.assign(state, fresh);
    Object.keys(labs).forEach(function (k) { delete labs[k]; });
    renderer.setLab(lab());
    save(true);
    setView('theory');
    toast('Labor zurückgesetzt.', 'ok');
  }

  // ------------------------------------------------------------ Ansichten

  function setView(v) {
    if (v === 'lab' && !planReady()) {
      toast('Zuerst in der Planung eine passende Maßlösung wählen und die Planung prüfen.', 'warn', 5000);
      v = 'plan';
    }
    state.view = v;
    $$('[data-view-panel]').forEach(function (p) { p.hidden = p.dataset.viewPanel !== v; });
    $$('.phase').forEach(function (b) {
      if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('#expChip').textContent = 'Versuch ' + exp().no + ' · ' + exp().title;
    if (v === 'theory') renderTheory();
    if (v === 'plan') renderPlan();
    if (v === 'lab') { renderLab(); }
    if (v === 'eval') NS.Journal.render();
    save();
  }

  function planReady() {
    const p = es().plan;
    return p.checked && p.titrant === exp().titrant;
  }

  // ------------------------------------------------------------ Theorie

  function renderTheory() {
    const t = state.theory;
    let html = '<h1>Theorie: pK-Werte durch Halbtitration</h1><p class="lead">Kurz und vollständig: Was am Halbäquivalenzpunkt gilt, warum es nur näherungsweise gilt und wie sich Säuren und Basen unterscheiden. Die Fragen unten kannst du selbst prüfen.</p><div class="cols">';
    C.THEORY.forEach(function (b) { html += '<section class="card"><h2>' + esc(b.title) + '</h2>' + b.html + '</section>'; });
    html += '</div><section class="card"><h2>Verständnisfragen</h2>';
    C.QUESTIONS.forEach(function (q, qi) {
      const ans = t.answers[q.id] || [];
      const res = t.results[q.id];
      html += '<div class="q" data-q="' + q.id + '"><div class="q-text">' + (qi + 1) + '. ' + esc(q.text) + (q.type === 'multi' ? ' <span class="badge">alles Zutreffende</span>' : '') + '</div>';
      q.options.forEach(function (o) {
        const checked = ans.indexOf(o.id) >= 0;
        let cls = '';
        if (res) {
          if (checked && o.correct) cls = ' is-ok';
          else if (checked && !o.correct) cls = ' is-bad';
          else if (!checked && o.correct && (res.shown || q.type === 'multi')) cls = res.shown ? ' is-ok' : ' is-miss';
        }
        html += '<label class="opt' + cls + '"><input type="' + (q.type === 'multi' ? 'checkbox' : 'radio') + '" name="' + q.id + '" value="' + o.id + '"' + (checked ? ' checked' : '') + '> <span>' + esc(o.text) + '</span></label>';
      });
      html += '<div class="actions"><button type="button" class="btn primary" data-action="q-check" data-q="' + q.id + '">Prüfen</button>' + hintButton('q', q.id, t.hints[q.id] || 0) +
        '<button type="button" class="btn" data-action="q-solve" data-q="' + q.id + '">Lösung anzeigen</button></div>';
      if (res) html += '<div class="fb ' + (res.ok ? 'ok' : 'bad') + '">' + esc(res.text) + '</div>';
      html += hintHtml(q.hints, t.hints[q.id] || 0);
      html += '</div>';
    });
    html += '</section><div class="actions"><button type="button" class="btn primary" data-view="plan">Weiter zur Planung</button></div>';
    $('#theoryDoc').innerHTML = subs(html);
  }

  function hintButton(kind, id, level) {
    return '<button type="button" class="btn" data-action="hint" data-kind="' + kind + '" data-id="' + id + '"' + (level >= 3 ? ' disabled' : '') + '>Tipp ' + Math.min(3, level + 1) + '/3</button>';
  }

  function hintHtml(list, level) {
    if (!level) return '';
    const names = ['Denkimpuls', 'Ansatz', 'Musterrechnung'];
    let h = '';
    for (let i = 0; i < level && i < 3; i++) if (list[i]) h += '<div class="hint"><b>' + names[i] + ':</b> ' + esc(list[i]) + '</div>';
    return h;
  }

  function checkQuestion(qid, show) {
    const q = C.QUESTIONS.find(function (x) { return x.id === qid; });
    const ans = $$('input[name="' + qid + '"]:checked').map(function (i) { return i.value; });
    state.theory.answers[qid] = show ? q.options.filter(function (o) { return o.correct; }).map(function (o) { return o.id; }) : ans;
    const right = q.options.filter(function (o) { return o.correct; }).map(function (o) { return o.id; }).sort().join();
    const ok = state.theory.answers[qid].slice().sort().join() === right;
    let text;
    if (show) text = 'Lösung: ' + q.hints[2];
    else if (!ans.length) text = 'Noch nichts ausgewählt.';
    else if (ok) text = 'Richtig.';
    else if (q.type === 'multi') {
      const wrong = ans.filter(function (a) { return right.split(',').indexOf(a) < 0; }).length;
      const miss = right.split(',').filter(function (r) { return ans.indexOf(r) < 0; }).length;
      text = 'Noch nicht ganz: ' + (wrong ? wrong + ' Aussage(n) treffen nicht zu' : '') + (wrong && miss ? ', ' : '') + (miss ? miss + ' zutreffende fehlen' : '') + '.';
    } else text = 'Leider nicht richtig. Nutze einen Tipp.';
    state.theory.results[qid] = { ok: ok, text: text, shown: !!show };
    save();
    renderTheory();
    const el = $('[data-q="' + qid + '"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  // ------------------------------------------------------------ Planung

  function renderPlan() {
    const e = es();
    const x = exp();
    const p = e.plan;
    const fb = p.feedback || {};
    let h = '<h1>Planung</h1><p class="lead">Wähle den Versuch, die passende Maßlösung und einen Indikator. Begründe deine Wahl. Die endgültige Bewertung des Indikators erfolgt anhand deiner eigenen Messkurve.</p>';
    h += '<section class="card"><h2>1 · Versuch</h2><div class="exp-cards">';
    Chem.EXPERIMENT_IDS.forEach(function (id) {
      const ex = Chem.EXPERIMENTS[id];
      const st = state.exps[id];
      const status = st.submission ? 'Ergebnis abgegeben' : st.series.length ? st.series.length + ' Messreihe(n)' : 'neu';
      h += '<button type="button" class="exp-card" data-action="choose-exp" data-id="' + id + '" aria-pressed="' + (id === state.current) + '"><strong>Versuch ' + ex.no + ': ' + esc(ex.title) + '</strong><small>' + esc(ex.short) + ' · ' + esc(status) + '</small></button>';
    });
    h += '</div></section>';

    const v0 = x.vSample + x.vWater;
    h += '<section class="card"><h2>2 · Ausgangsdaten</h2><table class="data"><tbody>' +
      '<tr><th>Probe</th><td>' + esc(x.sampleName) + ' (' + esc(x.sampleFormula) + ')</td><td class="num">c = ' + fmt(x.cSample, 3) + ' mol/L</td><td class="num">V = ' + fmt(x.vSample, 2) + ' mL (Vollpipette)</td></tr>' +
      '<tr><th>Verdünnung</th><td>destilliertes Wasser, damit Glasmembran und Diaphragma eintauchen</td><td></td><td class="num">' + fmt(x.vWater, 0) + ' mL → V(Start) = ' + fmt(v0, 0) + ' mL</td></tr>' +
      '<tr><th>Maßlösungen</th><td>Natronlauge NaOH(aq) · Salzsäure HCl(aq)</td><td class="num">je c = 0,100 mol/L</td><td class="num">Bürette 50 mL, Ablesung 0,01 mL</td></tr>' +
      '<tr><th>Bedingungen</th><td colspan="3">25 °C; Modell: pK<sub>W</sub> = 14,00; der gesuchte pK-Wert ist erst nach deiner eigenen Bestimmung zugänglich.</td></tr></tbody></table></section>';

    h += '<section class="card"><h2>3 · Maßlösung</h2><div class="radio-row">';
    Object.keys(Chem.TITRANTS).forEach(function (k) {
      const t = Chem.TITRANTS[k];
      h += optRadio('titrant', k, t.name + ' ' + t.formula + ', c = 0,100 mol/L', p.titrant === k, fb.titrant);
    });
    h += '</div>' + fbHtml(fb.titrantText, fb.titrant) + '</section>';

    if (x.stages > 1) {
      h += '<section class="card"><h2>4 · Welcher Äquivalenzpunkt soll mit dem Indikator erfasst werden?</h2><p>Ein Indikator muss nicht alle Stufen abdecken; pH-metrisch nimmst du ohnehin die ganze Kurve auf.</p><div class="radio-row">';
      [1, 2].forEach(function (j) { h += optRadio('stage', String(j), j + '. Äquivalenzpunkt', String(p.stage) === String(j), null); });
      h += '</div></section>';
    }
    const n0 = x.stages > 1 ? 5 : 4;
    h += '<section class="card"><h2>' + n0 + ' · Erwartung am gewählten Äquivalenzpunkt</h2><p>Welche Teilchen liegen dort überwiegend vor, und welcher pH-Bereich ist deshalb zu erwarten?</p><div class="radio-row">';
    C.EQ_PARTICLES.forEach(function (o) { h += optRadio('particle', o.id, o.label, p.particle === o.id, fb.particleId === o.id ? fb.particle : null); });
    h += '</div>' + fbHtml(fb.particleText, fb.particle) + '<div class="radio-row" style="margin-top:10px">';
    C.EQ_CATEGORIES.forEach(function (o) { h += optRadio('eqCat', o.id, o.label, p.eqCat === o.id, fb.eqCatId === o.id ? fb.eqCat : null); });
    h += '</div>' + fbHtml(fb.eqCatText, fb.eqCat) + '</section>';

    h += '<section class="card"><h2>' + (n0 + 1) + ' · Indikator</h2><table class="data"><thead><tr><th></th><th>Indikator</th><th>Umschlagsbereich</th><th>Farben</th><th>Farbverlauf</th></tr></thead><tbody>';
    Ind.list().forEach(function (ind) {
      h += '<tr><td><input type="radio" name="indicator" value="' + ind.id + '" id="ind-' + ind.id + '"' + (p.indicator === ind.id ? ' checked' : '') + ' style="width:20px;height:20px"></td><td><label for="ind-' + ind.id + '">' + esc(ind.name) + '</label></td><td class="num">' + (ind.range ? 'pH ' + fmt(ind.range[0], 1) + ' – ' + fmt(ind.range[1], 1) : '–') + '</td><td>' + esc(ind.range ? ind.acidLabel + ' → ' + ind.baseLabel : 'Messung nur mit pH-Elektrode') + '</td><td><span class="ind-strip" style="background:' + Ind.cssGradient(ind.id) + '"></span></td></tr>';
    });
    h += '</tbody></table>' + fbHtml(fb.indicatorText, fb.indicator) + '<h3>Begründung (alles Zutreffende)</h3>';
    C.INDICATOR_REASONS.forEach(function (r) {
      const on = p.reasons.indexOf(r.id) >= 0;
      let cls = '';
      if (fb.reasons) cls = on ? (r.good ? ' is-ok' : ' is-bad') : '';
      h += '<label class="opt' + cls + '"><input type="checkbox" name="reasons" value="' + r.id + '"' + (on ? ' checked' : '') + '> <span>' + esc(r.label) + '</span></label>';
    });
    h += fbHtml(fb.reasonsText, fb.reasons) + '</section>';
    h += '<div class="actions"><button type="button" class="btn primary" data-action="plan-check">Planung prüfen</button><button type="button" class="btn" data-action="plan-solve">Lösungshinweis</button><button type="button" class="btn' + (planReady() ? ' primary' : '') + '" data-view="lab"' + (planReady() ? '' : ' disabled') + '>Ins Labor</button></div>';
    $('#planDoc').innerHTML = subs(h);
  }

  function optRadio(name, value, label, checked, status) {
    const cls = status === true ? ' is-ok' : status === false ? ' is-bad' : '';
    return '<label class="opt' + cls + '"><input type="radio" name="' + name + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '> <span>' + esc(label) + '</span></label>';
  }

  function fbHtml(text, ok) {
    if (!text) return '';
    return '<div class="fb ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'warn') + '">' + text + '</div>';
  }

  function readPlanForm() {
    const p = es().plan;
    const val = function (n) { const el = $('input[name="' + n + '"]:checked'); return el ? el.value : null; };
    p.titrant = val('titrant');
    p.stage = exp().stages > 1 ? Number(val('stage') || p.stage || 1) : 1;
    p.particle = val('particle');
    p.eqCat = val('eqCat');
    p.indicator = val('indicator');
    p.reasons = $$('input[name="reasons"]:checked').map(function (i) { return i.value; });
  }

  function checkPlan(solve) {
    readPlanForm();
    const x = exp();
    const p = es().plan;
    const fb = {};
    if (solve) {
      p.titrant = x.titrant;
      p.particle = C.PARTICLE_AT_EQ[x.id][p.stage - 1];
      p.eqCat = Ev.eqCategories(x, p.stage)[0];
    }
    // Maßlösung
    fb.titrant = p.titrant === x.titrant;
    fb.titrantText = !p.titrant ? 'Noch keine Maßlösung gewählt.' : fb.titrant
      ? 'Passend: ' + (x.titrant === 'NaOH' ? 'Eine Säure bzw. ein Säurekation wird mit einer starken Base titriert.' : 'Die Base Ammoniak wird mit einer starken Säure titriert – der pH-Wert fällt.')
      : (x.titrant === 'NaOH' ? 'Die Probe ist sauer; mit Salzsäure findet keine Neutralisation statt.' : 'Ammoniak ist eine Base; mit Natronlauge findet keine Neutralisation statt.');
    // Teilchen am ÄP
    const want = C.PARTICLE_AT_EQ[x.id][p.stage - 1];
    fb.particleId = p.particle;
    fb.particle = p.particle ? p.particle === want : null;
    fb.particleText = !p.particle ? 'Noch nichts gewählt.' : fb.particle ? 'Richtig.' : particleHint(x, p.stage);
    // pH-Bereich
    const cats = Ev.eqCategories(x, p.stage);
    fb.eqCatId = p.eqCat;
    fb.eqCat = p.eqCat ? cats.indexOf(p.eqCat) >= 0 : null;
    fb.eqCatText = !p.eqCat ? 'Noch keine Erwartung gewählt.' : fb.eqCat ? 'Passt zu den Teilchen am ÄP.' : 'Überlege, ob das Teilchen am ÄP Protonen eher abgibt oder aufnimmt.';
    // Indikator: Konsistenz mit der eigenen Erwartung (quantitative Bewertung erst an der eigenen Kurve)
    const ind = p.indicator ? Ind.get(p.indicator) : null;
    if (!ind) { fb.indicator = null; fb.indicatorText = 'Noch kein Indikator gewählt (auch „ohne Indikator“ ist möglich).'; }
    else if (!ind.range) { fb.indicator = true; fb.indicatorText = 'PH-metrische Auswertung ohne Indikator ist immer möglich; den Endpunkt bestimmst du dann aus der Kurve.'; }
    else {
      const mid = (ind.range[0] + ind.range[1]) / 2;
      const side = mid < 6.5 ? 'acidic' : mid > 7.5 ? 'basic' : 'neutral';
      const expCat = p.eqCat || cats[0];
      const consistent = side === expCat || (expCat === 'neutral' && Math.abs(mid - 7) < 1.2) || (cats.indexOf(side) >= 0 && fb.eqCat !== false);
      fb.indicator = consistent;
      fb.indicatorText = consistent
        ? 'Der Umschlagsbereich passt zu deiner Erwartung am gewählten ÄP. Ob der Volumenfehler wirklich klein ist, prüfst du an deiner Kurve.'
        : 'Der Umschlagsbereich liegt nicht im erwarteten pH-Bereich am gewählten ÄP – vermutlich schlägt der Indikator deutlich zu früh oder zu spät um. Du kannst ihn trotzdem verwenden und den Fehler an der Kurve untersuchen.';
    }
    const bad = p.reasons.filter(function (r) { return !C.INDICATOR_REASONS.find(function (x2) { return x2.id === r; }).good; });
    fb.reasons = p.reasons.length ? bad.length === 0 : null;
    fb.reasonsText = !p.reasons.length ? 'Kreuze mindestens eine Begründung an.' : bad.length ? 'Nicht jede angekreuzte Begründung trägt: Der Indikator zeigt den Äquivalenzpunkt an, nicht den HÄP; pH 7 ist der Neutralpunkt.' : 'Begründung schlüssig.';
    p.checked = true;
    p.feedback = fb;
    save();
    renderPlan();
    if (planReady()) toast('Planung gespeichert – du kannst ins Labor wechseln.', 'ok');
  }

  function particleHint(x, stage) {
    if (x.id === 'acetic') return 'Am ÄP ist alle Essigsäure zu Acetat umgesetzt – Acetat ist die korrespondierende Base.';
    if (x.id === 'ammonia') return 'Am ÄP liegt NH₄⁺ vor, die korrespondierende Säure von NH₃.';
    if (x.id === 'phosphoric') return stage === 1 ? 'Am 1. ÄP liegt H₂PO₄⁻ vor: Es kann ein Proton abgeben und eines aufnehmen.' : 'Am 2. ÄP liegt HPO₄²⁻ vor – ebenfalls ein Ampholyt.';
    return stage === 1 ? 'Am 1. ÄP liegt das Zwitterion vor: –COO⁻ kann ein Proton aufnehmen, –NH₃⁺ eines abgeben.' : 'Am 2. ÄP liegt das Glycinat-Anion H₂N–CH₂–COO⁻ vor, eine Base.';
  }

  // ------------------------------------------------------------ Labor

  const renderer = new NS.LabRenderer($('#labCanvas'));
  let autoPending = false;
  let pendingEndpoint = false;

  function bindLab(l, id) {
    l.on('step-done', function () { if (id === state.current) autoPending = true; });
    l.on('valve', function (e) { if (!e.open && id === state.current) autoPending = true; });
    l.on('empty', function () { if (id === state.current) toast('Bürette leer bzw. am Ende der Skala (50,00 mL).', 'warn'); });
    l.on('limited', function () { if (id === state.current) toast('Nur bis zum Ende der Bürettenskala zugegeben.', 'warn'); });
    l.on('blocked', function (e) { if (id === state.current) toast(blockedText(e.reason), 'warn'); });
    l.on('prep', function (e) {
      if (id !== state.current) return;
      if (/-done$/.test(e.action) || e.action === 'electrode') { save(); renderLab(); }
    });
  }

  function blockedText(r) {
    return {
      burette: 'Die Bürette ist noch nicht befüllt und entlüftet.',
      sample: 'Es ist noch keine Probe im Kolben.',
      water: 'Die Probe ist noch nicht verdünnt.',
      empty: 'Die Bürette ist bis zur 50-mL-Marke abgelassen – zwischen zwei Proben nachfüllen.',
      start: 'Trage zuerst den Anfangsstand der Bürette ein (Ablesehilfe).',
    }[r] || 'Das geht gerade nicht.';
  }

  function stepItem(done, label, action, enabled, extra) {
    return '<li><span class="st' + (done ? ' done' : '') + '">' + (done ? '✓' : '') + '</span><button type="button" class="btn small" data-action="' + action + '"' + (enabled ? '' : ' disabled') + (extra || '') + '>' + label + '</button></li>';
  }

  function renderLab() {
    if (state.view !== 'lab') return;
    const l = lab();
    const x = exp();
    const e = es();
    let s = activeSeries();
    if (!s || s.finished) {
      if (!s && l.sample === 0 && !l.dispensed) s = newSeries(e.series.some(function (q) { return q.kind === 'survey' && q.points.length; }) ? 'half' : 'survey');
    }
    const ind = e.plan.indicator || 'none';
    const indObj = Ind.get(ind);
    let h = '';

    // Probe und Zweck
    h += '<div class="box"><h3>Probe ' + Math.max(1, e.sampleNo) + ' <small>' + esc(x.short) + '</small></h3>';
    if (s && !s.finished) {
      const locked = s.points.length > 0 || l.dispensed > 0;
      h += '<div class="seg" role="group" aria-label="Zweck der Probe">' +
        '<button type="button" data-action="kind" data-kind="survey" aria-pressed="' + (s.kind === 'survey') + '"' + (locked ? ' disabled' : '') + '>Erstdurchgang: ÄP untersuchen</button>' +
        '<button type="button" data-action="kind" data-kind="half" aria-pressed="' + (s.kind === 'half') + '"' + (locked ? ' disabled' : '') + '>Halbtitration: pK bestimmen</button></div>';
      h += '<p class="fb info" style="margin:8px 0 0">Aktiv: <strong>' + esc(seriesLabel(s)) + '</strong>' + (e.series.length > 1 ? ' · gespeicherte Reihen erscheinen blass in der Kurve' : '') + '</p>';
    } else {
      h += '<p class="fb info">Die letzte Messreihe ist beendet. Setze eine frische Probe an.</p>';
    }
    h += '<ol class="steps" style="margin-top:8px">' +
      stepItem(l.sample > 0, l.pipetting && l.pipetting.kind === 'sample' ? 'Pipettiert …' : 'Probe pipettieren (' + fmt(x.vSample, 2) + ' mL)', 'pipette', s && !s.finished && l.sample === 0 && !l.pipetting) +
      stepItem(l.water > 0, l.pipetting && l.pipetting.kind === 'water' ? 'Wasser fließt …' : 'Mit dest. Wasser verdünnen (' + fmt(x.vWater, 0) + ' mL)', 'water', l.sampleReady && l.water === 0 && !l.pipetting) +
      (ind !== 'none' ? stepItem(!!l.indicator, 'Indikator zugeben: ' + esc(indObj.name) + ' (3 Tropfen)', 'indicator', l.sampleReady && !l.indicator) : '') +
      '<li><span class="st' + (l.stirrer ? ' done' : '') + '">' + (l.stirrer ? '✓' : '') + '</span><button type="button" class="btn small' + (l.stirrer ? ' on' : '') + '" data-action="stir" aria-pressed="' + l.stirrer + '">Magnetrührer ' + (l.stirrer ? 'an' : 'aus') + '</button></li>' +
      '</ol></div>';

    // Bürette
    const b = l.burette;
    h += '<div class="box"><h3>Bürette <small>Maßlösung ' + esc(Chem.TITRANTS[x.titrant].formula) + ', 0,100 mol/L</small></h3><ol class="steps">' +
      stepItem(b.rinsed, 'Mit wenig Maßlösung vorspülen', 'rinse', !b.filled) +
      stepItem(b.filled, b.filled ? 'Befüllt' : 'Befüllen und auf Stand knapp unter 0 einstellen', 'fill', b.rinsed && !b.filled) +
      stepItem(b.filled && !b.bubble, 'Spitze entlüften (Luftblase in Abfallgefäß)', 'purge', b.filled && b.bubble) +
      '</ol>';
    if (b.filled && !b.bubble && l.dispensed === 0 && !l.isFlowing && b.reading > 5) {
      h += '<div class="row"><button type="button" class="btn small" data-action="refill">Vor dieser Probe nachfüllen</button></div>';
    }
    if (s && !s.finished) h += fieldHtml('read_start_' + s.id, 'Anfangsstand (abgelesen)', 'mL', 'Vor der ersten Zugabe dieser Probe in der Ablesehilfe ablesen.');
    h += '</div>';

    // pH-Meter
    const buf2 = x.direction > 0 ? 'pH 10,01' : 'pH 4,01';
    h += '<div class="box"><h3>pH-Meter <small>Glaselektrode, 25 °C</small></h3><ol class="steps">' +
      stepItem(l.calibration >= 1, l.calRunning === 1 ? 'Kalibriert mit pH 7,00 …' : 'Kalibrieren: Puffer pH 7,00', 'cal1', !l.calRunning && !l.electrodeIn) +
      stepItem(l.calibration >= 2, l.calRunning === 2 ? 'Kalibriert mit ' + buf2 + ' …' : 'Kalibrieren: Puffer ' + buf2, 'cal2', !l.calRunning && !l.electrodeIn && l.calibration === 1) +
      stepItem(l.electrodeIn, l.electrodeIn ? 'Elektrode eingetaucht · herausnehmen' : 'Elektrode spülen und eintauchen', 'electrode', !l.calRunning) +
      '</ol></div>';

    // Titrieren
    h += '<div class="box" id="titBox"><h3>Titrieren <small id="labStatus"></small></h3>' +
      '<div class="readout"><div><small>V zugegeben</small><b id="roV">–</b></div><div><small>Bürettenstand</small><b id="roR">–</b></div><div><small>pH (live)</small><b id="roPH">–</b></div></div>' +
      '<div style="margin-top:8px;font-size:13px;color:var(--ink-2)">Dosiermenge je Zugabe</div><div class="seg" role="group" aria-label="Dosiermenge">';
    [['drop', '1 Tropfen'], [0.1, '0,10'], [0.2, '0,20'], [0.5, '0,50'], [1, '1,00'], [2, '2,00']].forEach(function (d) {
      h += '<button type="button" data-action="dose-size" data-size="' + d[0] + '" aria-pressed="' + (String(doseSize) === String(d[0])) + '">' + d[1] + '</button>';
    });
    h += '</div><div class="row"><button type="button" class="btn primary" data-action="dose" title="Taste D">Zugeben <span id="doseLbl"></span></button>' +
      '<button type="button" class="btn" data-action="valve" id="btnValve" title="Taste H">Hahn öffnen</button></div>' +
      '<label style="display:block;margin-top:6px;font-size:13px;color:var(--ink-2)">Tropfgeschwindigkeit bei offenem Hahn: <span id="rateLbl"></span><input type="range" id="rate" min="0" max="100" step="1" value="' + rateToSlider(l.flowRate) + '" aria-label="Tropfgeschwindigkeit"></label>' +
      '<div class="row"><button type="button" class="btn primary" data-action="take" id="btnTake" title="Taste M">Messwert übernehmen</button></div>' +
      '<label class="chk"><input type="checkbox" id="autoTake"' + (state.prefs.autoTake ? ' checked' : '') + '> nach jeder Zugabe automatisch übernehmen, sobald die Anzeige stabil ist</label>';
    if (s && !s.finished) {
      if (ind !== 'none') h += '<div class="row"><button type="button" class="btn" data-action="endpoint">Endpunkt notieren (bleibende Farbe)</button></div>';
      if (s.endpoint) {
        h += '<p class="fb info" style="margin:6px 0">Endpunkt notiert bei V = ' + fmt(s.endpoint.v, 2) + ' mL.</p>' + fieldHtml('read_end_' + s.id, 'Bürettenstand am Endpunkt (abgelesen)', 'mL', 'In der Ablesehilfe ablesen; den Verbrauch rechnest du im Laborjournal.');
      }
      if (s.kind === 'half') {
        h += '<div class="field"><label for="targetIn">Eigene Zielmarke (zugegebenes Volumen)</label><div class="in"><input type="text" inputmode="decimal" id="targetIn" value="' + esc(s.targetDraft !== undefined ? s.targetDraft : s.target === undefined || s.target === null ? '' : fmt(s.target, 2)) + '" autocomplete="off"><span class="unit">mL</span><button type="button" class="btn small" data-action="set-target">Setzen</button></div><div class="sub">Arbeitsmittel: Die Marke erscheint an Bürette und Kurve. Berechnet wird das Zielvolumen im Laborjournal; es wird nicht automatisch gestoppt.</div></div>';
      }
      h += '<div class="row"><button type="button" class="btn" data-action="finish">Messreihe beenden</button></div>';
    }
    h += '<div id="lastPts"></div></div>';

    // Teilchen
    h += '<div class="box"><h3>Teilchen in der Probe <small>nach Stöchiometrie</small></h3><div class="species" id="speciesBox"></div><p style="font-size:12.5px;color:var(--ink-3);margin:6px 0 0">Hervorgehoben: überwiegende Formen nach dem Umsatz. Im Gleichgewicht liegen auch die benachbarten Formen in geringen Anteilen vor.</p></div>';

    // Probe wechseln
    h += '<div class="box"><h3>Probe wechseln</h3><div class="row">' +
      '<button type="button" class="btn" data-action="new-sample" data-kind="survey">Neue Probe: Erstdurchgang</button>' +
      '<button type="button" class="btn" data-action="new-sample" data-kind="half">Neue Probe: Halbtitration</button></div>' +
      '<div class="row"><button type="button" class="btn warn" data-action="repeat"' + (s && s.points.length ? '' : ' disabled') + '>Messreihe wiederholen (verwerfen)</button></div>' +
      '<p style="font-size:12.5px;color:var(--ink-3);margin:6px 0 0">Neue Probe: gespeicherte Messreihen und Rechnungen bleiben erhalten. Verbrauchte Maßlösung lässt sich nicht aus dem Kolben zurückholen.</p></div>';

    $('#labPanel').innerHTML = subs(h);
    renderer.setOptions({
      labels: {
        titrant: { title: 'Maßlösung', lines: [Chem.TITRANTS[x.titrant].formula + ', c = 0,100 mol/L'] },
        sample: l.sample > 0 ? { title: 'Probe', lines: [x.sampleFormula, l.indicator && l.indicator !== 'none' ? '+ ' + Ind.get(l.indicator).name : (l.water > 0 ? 'verdünnt auf ' + fmt(x.vSample + x.vWater, 0) + ' mL' : fmt(x.vSample, 0) + ' mL')] } : null,
      },
    });
    $('#labBand').checked = !!e.view.band;
    renderLabDynamic(true);
  }

  // Dosiergröße und Geschwindigkeit
  let doseSize = 1;
  function rateFromSlider(v) { return 0.01 * Math.pow(100, v / 100); }
  function rateToSlider(q) { return Math.round((Math.log(q / 0.01) / Math.log(100)) * 100); }

  function fieldHtml(id, label, unit, sub) {
    const f = es().fields[id] || {};
    const cls = f.status === 'ok' ? ' is-ok' : f.status === 'wrong' ? ' is-bad' : f.status ? ' is-warn' : '';
    return '<div class="field" data-field="' + id + '"><label for="f-' + id + '">' + label + '</label><div class="in"><input type="text" inputmode="decimal" autocomplete="off" id="f-' + id + '" class="' + cls + '" value="' + esc(f.input || '') + '"><span class="unit">' + (unit || '') + '</span>' +
      '<button type="button" class="btn small" data-action="check-field" data-field="' + id + '">Prüfen</button>' + hintButton('field', id, (es().hints[id] || 0)) + '</div>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') +
      (f.message ? '<div class="fb ' + (f.status === 'ok' ? 'ok' : f.status === 'wrong' || f.status === 'invalid' ? 'bad' : 'warn') + '">' + (f.kind ? '<span class="tag">' + kindLabel(f.kind) + '</span>' : '') + esc(f.message) + '</div>' : '') +
      fieldHints(id) + '</div>';
  }

  function kindLabel(k) { return { calc: 'Rechnung', measure: 'Messung/Durchführung', approx: 'Näherung' }[k] || ''; }

  function fieldHints(id) {
    const level = es().hints[id] || 0;
    if (!level) return '';
    return hintHtml(NS.Journal.hintsFor(id), level);
  }

  /** Häufig wechselnde Anzeigen ohne Neuaufbau des Bedienfelds */
  let lastDyn = '';
  let lastLock = '';
  function renderLabDynamic(force) {
    const l = lab();
    const s = activeSeries();
    const e = es();
    const v = $('#roV');
    if (!v) return;
    // Bedienelemente, deren Freigabe sich mit der ersten Zugabe bzw. dem ersten Messpunkt ändert
    const lock = String(!!(s && s.points.length)) + (l.dispensed > 0) + (l.isFlowing) + (s && s.endpoint ? s.endpoint.v : '');
    if (lock !== lastLock) { lastLock = lock; renderLab(); return; }
    const target = s && Number.isFinite(s.target) ? s.target : null;
    const sig = [l.addedRounded, l.burette.reading, l.displayPH, l.stable, l.isFlowing, l.valveOpen, s ? s.points.length : -1, l.homogeneous, doseSize, l.flowRate].join('|');
    if (sig === lastDyn && !force) return;
    lastDyn = sig;
    v.textContent = fmt(l.addedRounded, 2) + ' mL';
    $('#roR').textContent = l.burette.filled ? fmt(Math.round(l.burette.reading * 100) / 100, 2) + ' mL' : '–';
    $('#roPH').textContent = l.displayPH === null ? '–' : fmt(l.displayPH, 2);
    let st;
    if (!l.meterReady) st = '<span class="status-pill">pH-Meter nicht bereit</span>';
    else if (l.isFlowing || !l.isSettled) st = '<span class="status-pill warn">Zugabe läuft</span>';
    else if (!l.stable) st = '<span class="status-pill warn">' + (l.stirrer ? 'mischt / misst …' : 'ohne Rühren – mischt langsam') + '</span>';
    else st = '<span class="status-pill ok">stabil</span>';
    $('#labStatus').innerHTML = st;
    $('#btnValve').textContent = l.valveOpen ? 'Hahn schließen' : 'Hahn öffnen';
    $('#btnValve').classList.toggle('on', l.valveOpen);
    $('#doseLbl').textContent = doseSize === 'drop' ? '(0,05 mL)' : '(' + fmt(doseSize, 2) + ' mL)';
    $('#rateLbl').textContent = fmt(l.flowRate, 2) + ' mL/s';
    // Letzte Messpunkte
    if (s) {
      const pts = s.points.slice(-6);
      $('#lastPts').innerHTML = pts.length ? '<table class="mtable" style="margin-top:8px"><thead><tr><th>V / mL</th><th>pH</th><th class="l">Status</th></tr></thead><tbody>' + pts.map(function (p) {
        return '<tr><td>' + fmt(p.v, 2) + '</td><td>' + fmt(p.pH, 2) + '</td><td class="l">' + pointStatus(p) + '</td></tr>';
      }).join('') + '</tbody></table><div style="font-size:12px;color:var(--ink-3)">' + s.points.length + ' Messpunkt(e) in ' + esc(seriesLabel(s)) + (target !== null ? ' · Ziel ' + fmt(target, 2) + ' mL' : '') + '</div>' : '<p style="font-size:13px;color:var(--ink-3);margin:8px 0 0">Noch keine Messpunkte in dieser Reihe.</p>';
    }
    // Teilchen
    const box = $('#speciesBox');
    if (box) {
      const x = exp();
      const sys = Chem.SYSTEMS[x.system];
      const sf = Chem.stoichiometricForms(x, l.delivered);
      const showForms = x.id === 'phosphoric' ? [0, 1, 2, 3] : sys.forms.map(function (_, i) { return i; });
      const order = x.titrant === 'HCl' ? showForms.slice().reverse() : showForms;
      box.innerHTML = l.sample > 0 ? order.map(function (i) {
        return '<div class="' + (sf.main.indexOf(i) >= 0 ? 'main' : '') + '"><span>' + esc(sys.forms[i]) + '</span><span>' + esc(sys.formNames[i]) + '</span></div>';
      }).join('') + (x.id === 'glycine' ? '<div><span>Cl⁻</span><span>Gegenion (aus Glycinhydrochlorid)</span></div>' : '') +
        '<div><span>Umsatz</span><span>n(Maßlösung) / n(Probe) = ' + fmt(sf.tau, 2) + '</span></div>' : '<p style="font-size:13px;color:var(--ink-3);margin:0">Noch keine Probe im Kolben.</p>';
    }
    updateLabChart();
  }

  function pointStatus(p) {
    if (p.stable && p.homogeneous !== false) return '<span class="badge ok">stabil</span>';
    if (!p.settled) return '<span class="badge warn">während Zugabe</span>';
    if (p.homogeneous === false) return '<span class="badge warn">nicht durchmischt</span>';
    return '<span class="badge warn">nicht stabil</span>';
  }

  // ------------------------------------------------------------ Kurve im Labor

  const labChart = new NS.TitrationChart($('#labChart'), {
    onRead: function (p) { $('#labChartSub').textContent = 'Messpunkt: V = ' + fmt(p.v, 2) + ' mL · pH = ' + fmt(p.pH, 2) + (p.stable ? '' : ' (nicht stabil)'); },
  });

  function seriesForChart() {
    return es().series.map(function (s) {
      return { id: s.id, label: seriesLabel(s), points: s.points, color: s.kind === 'survey' ? NS.TitrationChart.COLORS.s1 : NS.TitrationChart.COLORS.s2, kind: s.kind };
    });
  }

  function indicatorBand(indId) {
    const ind = Ind.get(indId || 'none');
    if (!ind.range) return null;
    const c = Ind.solutionColor(ind.id, (ind.range[0] + ind.range[1]) / 2, 1.2);
    return { range: ind.range, color: 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',0.22)', label: 'Umschlagsbereich ' + ind.name };
  }

  function updateLabChart() {
    const l = lab();
    const s = activeSeries();
    const e = es();
    labChart.setData({
      series: seriesForChart(),
      activeId: s ? s.id : null,
      current: l.sample > 0 ? { v: l.addedRounded, pH: l.displayPH } : null,
      target: s && s.kind === 'half' && Number.isFinite(s.target) ? s.target : null,
      endpoints: s && s.endpoint ? [{ v: s.endpoint.v, label: 'Endpunkt' }] : [],
      band: e.view.band ? indicatorBand(l.indicator || e.plan.indicator) : null,
      xMode: e.view.xMode === 'data' ? 'data' : 'capacity',
    });
    $('#labXMode').textContent = e.view.xMode === 'data' ? 'Messbereich' : '0–50 mL';
    const active = s ? '<span><i class="dot" style="background:' + (s.kind === 'survey' ? NS.TitrationChart.COLORS.s1 : NS.TitrationChart.COLORS.s2) + '"></i>aktiv: ' + esc(seriesLabel(s)) + '</span>' : '';
    const others = e.series.length > 1 ? '<span><i class="dot" style="background:' + NS.TitrationChart.COLORS.pale + '"></i>gespeicherte Reihe(n)</span>' : '';
    $('#labLegend').innerHTML = active + others + '<span><i class="ring" style="border-color:#555"></i>nicht stabil übernommen</span><span><i style="border-color:#555"></i>Verbindung der Messpunkte</span><span><i class="dash" style="border-color:#555"></i>aktuelle Position (live)</span>' + (e.view.band && (l.indicator || e.plan.indicator) && (l.indicator || e.plan.indicator) !== 'none' ? '<span><i class="dot" style="background:rgba(214,28,132,0.3);border-radius:2px"></i>Umschlagsbereich</span>' : '');
  }

  // ------------------------------------------------------------ Verschiebbare Trennlinie (aus TitraLab 3)

  function bindSplitter(sp, view) {
    let dragging = false;
    const main = function () { return $('#view-' + view).getBoundingClientRect(); };
    const set = function (w, keep) {
      const r = main();
      const max = Math.max(340, Math.min(720, r.width - 420));
      const width = Math.round(Math.min(max, Math.max(300, w)));
      document.documentElement.style.setProperty('--panel-w', width + 'px');
      sp.setAttribute('aria-valuenow', String(width));
      if (keep) { state.prefs.panelW = width; save(); }
    };
    sp.addEventListener('pointerdown', function (e) {
      dragging = true;
      sp.classList.add('is-dragging');
      document.body.classList.add('is-resizing');
      try { sp.setPointerCapture(e.pointerId); } catch (err) { /* ignorieren */ }
      e.preventDefault();
    });
    sp.addEventListener('pointermove', function (e) { if (dragging) set(main().right - e.clientX - 6, false); });
    const end = function () {
      if (!dragging) return;
      dragging = false;
      sp.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing');
      set(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) || 380, true);
    };
    sp.addEventListener('pointerup', end);
    sp.addEventListener('pointercancel', end);
    sp.addEventListener('dblclick', function () {
      document.documentElement.style.removeProperty('--panel-w');
      state.prefs.panelW = null;
      save();
    });
    sp.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const cur = sp.nextElementSibling.getBoundingClientRect().width;
      set(cur + (e.key === 'ArrowLeft' ? 24 : -24), true);
    });
  }

  // ------------------------------------------------------------ Aktionen

  async function onAction(btn) {
    const a = btn.dataset.action;
    const l = lab();
    const s = activeSeries();
    switch (a) {
      case 'q-check': checkQuestion(btn.dataset.q, false); break;
      case 'q-solve': {
        const answered = $$('input[name="' + btn.dataset.q + '"]:checked').length;
        if (!answered && !(await confirmBox('Lösung anzeigen?', 'Du hast diese Frage noch nicht bearbeitet. Trotzdem die Lösung anzeigen?', 'Lösung anzeigen'))) return;
        checkQuestion(btn.dataset.q, true);
        break;
      }
      case 'hint': {
        if (btn.dataset.kind === 'q') {
          const h = state.theory.hints;
          if ((h[btn.dataset.id] || 0) === 2 && !state.theory.results[btn.dataset.id] && !(await confirmBox('Musterlösung anzeigen?', 'Die dritte Hilfe enthält die Lösung. Erst selbst versuchen?', 'Trotzdem anzeigen'))) return;
          h[btn.dataset.id] = Math.min(3, (h[btn.dataset.id] || 0) + 1);
          save();
          renderTheory();
        } else {
          await NS.Journal.nextHint(btn.dataset.id);
        }
        break;
      }
      case 'choose-exp': {
        readPlanFormSafe();
        lab().closeValve();
        state.current = btn.dataset.id;
        renderer.setLab(lab());
        save();
        setView('plan');
        break;
      }
      case 'plan-check': checkPlan(false); break;
      case 'plan-solve': {
        if (!(await confirmBox('Lösungshinweis', 'Maßlösung, Teilchen und pH-Erwartung werden eingetragen. Die Indikatorwahl bleibt deine Entscheidung.', 'Eintragen'))) return;
        checkPlan(true);
        break;
      }
      case 'pipette': l.pipetteSample(); renderLab(); break;
      case 'water': l.addWater(); renderLab(); break;
      case 'indicator': l.addIndicator(es().plan.indicator); if (s) s.indicator = l.indicator; save(); renderLab(); break;
      case 'stir': l.setStirrer(!l.stirrer); save(); renderLab(); break;
      case 'rinse': l.rinseBurette(); toast('Bürette mit wenig Maßlösung vorgespült; Spülflüssigkeit verworfen.'); save(); renderLab(); break;
      case 'fill': l.fillBurette(START_READINGS[es().sampleNo % START_READINGS.length]); toast('Über die Nullmarke gefüllt und knapp darunter eingestellt. In der Spitze sitzt noch eine Luftblase.'); save(); renderLab(); break;
      case 'purge': l.purgeTip(0.15); toast('Luftblase entfernt (in ein Abfallgefäß abgelassen).'); save(); renderLab(); break;
      case 'refill': {
        if (!(await confirmBox('Bürette nachfüllen?', 'Die Bürette wird vor dieser Probe wieder bis knapp unter die Nullmarke gefüllt. Lies danach den neuen Anfangsstand ab.', 'Nachfüllen'))) return;
        l.fillBurette(START_READINGS[(es().sampleNo + 2) % START_READINGS.length]);
        if (s) { delete es().fields['read_start_' + s.id]; s.startReading = null; }
        save(); renderLab();
        break;
      }
      case 'cal1': l.calibrate(1); renderLab(); break;
      case 'cal2': l.calibrate(2); renderLab(); break;
      case 'electrode': {
        if (l.electrodeIn) { l.liftElectrode(); save(); renderLab(); break; }
        const r = l.immerseElectrode();
        if (!r.ok) toast({ calibrate: 'Erst das pH-Meter mit zwei Pufferlösungen kalibrieren.', sample: 'Es ist noch keine Probe im Kolben.', depth: 'Glasmembran und Diaphragma wären nicht bedeckt – verdünne die Probe zuerst mit destilliertem Wasser.' }[r.reason], 'warn', 5000);
        save(); renderLab();
        break;
      }
      case 'kind': if (s && !s.points.length && !l.dispensed) { s.kind = btn.dataset.kind; if (s.kind === 'survey') es().evalSurvey = s.id; else es().evalHalf = s.id; save(); renderLab(); } break;
      case 'dose-size': doseSize = btn.dataset.size === 'drop' ? 'drop' : Number(btn.dataset.size); $$('[data-action="dose-size"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); }); renderLabDynamic(true); break;
      case 'dose': dose(); break;
      case 'valve': {
        if (!l.valveOpen && !canStartDosing()) return;
        l.toggleValve();
        renderLabDynamic(true);
        break;
      }
      case 'take': takeReading(false); break;
      case 'endpoint': markEndpoint(); break;
      case 'finish': finishSeries(); break;
      case 'new-sample': {
        const cur = activeSeries();
        if (cur && cur.points.length && !cur.finished && !(await confirmBox('Frische Probe ansetzen?', 'Die aktive Messreihe „' + esc(seriesLabel(cur)) + '“ wird beendet und gespeichert. Der Kolben wird geleert.', 'Neue Probe'))) return;
        freshSample(btn.dataset.kind);
        toast('Frische Probe – zuerst pipettieren und verdünnen.', 'ok');
        break;
      }
      case 'repeat': repeatSeries(); break;
      case 'set-target': {
        const p = NS.Format.parseQuantity($('#targetIn').value, 'mL');
        if (!s) return;
        s.target = p.ok ? p.value : null;
        if (!p.ok && !p.empty) toast(p.message, 'warn');
        save(); renderLabDynamic(true);
        break;
      }
      case 'check-field': NS.Journal.checkField(btn.dataset.field); break;
      case 'xmode': {
        const e = es();
        e.view.xMode = e.view.xMode === 'data' ? 'capacity' : 'data';
        save();
        if (btn.dataset.target === 'lab') updateLabChart(); else NS.Journal.render();
        break;
      }
      case 'notebook': modal('Hefteintrag', '<div class="notebook">' + C.NOTEBOOK + '</div>', [{ label: 'Schließen', value: null, primary: true }]); break;
      case 'report': NS.Journal.report(); break;
      case 'reset-menu': resetMenu(); break;
      default:
        if (NS.Journal.onAction) await NS.Journal.onAction(btn);
    }
  }

  function readPlanFormSafe() { if (state.view === 'plan' && $('#planDoc input')) readPlanForm(); }

  function canStartDosing() {
    const l = lab();
    const s = activeSeries();
    const why = l.canDose();
    if (why) { toast(blockedText(why), 'warn'); return false; }
    if (!s || s.finished) { toast('Die Messreihe ist beendet. Setze eine frische Probe an.', 'warn'); return false; }
    const f = es().fields['read_start_' + s.id];
    if (!f || !f.input || !f.input.trim()) { toast(blockedText('start'), 'warn', 5000); return false; }
    if (s.startReading === null) s.startReading = Math.round(l.burette.reading * 100) / 100;
    return true;
  }

  function dose() {
    if (!canStartDosing()) return;
    const l = lab();
    l.addVolume(doseSize === 'drop' ? l.dropVolume : doseSize);
    const s = activeSeries();
    if (s && s.kind === 'half' && Number.isFinite(s.target) && l.step && l.step.target > s.target + 0.025 && l.dispensed <= s.target + 0.025) {
      toast('Achtung: Mit dieser Zugabe wird deine Zielmarke überschritten.', 'warn');
    }
    renderLabDynamic(true);
  }

  // ------------------------------------------------------------ Ereignisse

  document.addEventListener('click', function (ev) {
    const v = ev.target.closest('[data-view]');
    if (v && v.classList.contains('phase')) { readPlanFormSafe(); setView(v.dataset.view); return; }
    if (v && v.tagName === 'BUTTON' && !v.dataset.action) { readPlanFormSafe(); setView(v.dataset.view); return; }
    const b = ev.target.closest('[data-action]');
    if (b && !b.disabled) onAction(b);
  });

  document.addEventListener('change', function (ev) {
    const t = ev.target;
    if (t.closest('#planDoc')) { readPlanForm(); save(); return; }
    if (t.id === 'autoTake') { state.prefs.autoTake = t.checked; save(); return; }
    if (t.id === 'labBand') { es().view.band = t.checked; save(); updateLabChart(); return; }
    if (t.matches('[data-field] input[type="text"]')) {
      const id = t.closest('[data-field]').dataset.field;
      const f = es().fields[id] = es().fields[id] || {};
      f.input = t.value;
      save();
    }
    if (NS.Journal.onChange) NS.Journal.onChange(ev);
  });

  document.addEventListener('input', function (ev) {
    const t = ev.target;
    if (t.id === 'targetIn') { const s = activeSeries(); if (s) s.targetDraft = t.value; }
    if (t.id === 'rate') { lab().setFlowRate(rateFromSlider(Number(t.value))); renderLabDynamic(true); }
    if (t.matches('[data-field] input[type="text"]')) {
      const id = t.closest('[data-field]').dataset.field;
      const f = es().fields[id] = es().fields[id] || {};
      f.input = t.value;
      save();
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.target.matches('[data-field] input')) {
      if (ev.key === 'Enter') { ev.preventDefault(); NS.Journal.checkField(ev.target.closest('[data-field]').dataset.field); }
      return;
    }
    if (ev.target.matches('input, textarea, select') || !$('#modal').hidden || state.view !== 'lab' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (k === 'd') { ev.preventDefault(); dose(); }
    else if (k === 'h') { ev.preventDefault(); const l = lab(); if (l.valveOpen || canStartDosing()) { l.toggleValve(); renderLabDynamic(true); } }
    else if (k === 'm') { ev.preventDefault(); takeReading(false); }
  });

  $('#labCanvas').addEventListener('pointerdown', function (ev) {
    const rect = this.getBoundingClientRect();
    const hit = renderer.hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
    const l = lab();
    if (hit === 'stopcock') {
      renderer.tapFeedback('stopcock');
      if (l.valveOpen || canStartDosing()) l.toggleValve();
      renderLabDynamic(true);
    } else if (hit === 'stirrer') {
      l.setStirrer(!l.stirrer);
      save();
      renderLab();
    }
  });

  global.addEventListener('visibilitychange', function () { if (document.hidden) save(true); });
  global.addEventListener('pagehide', function () { save(true); });

  // ------------------------------------------------------------ Zeitschleife

  let last = performance.now();
  let saveClock = 0;
  function loop(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const l = lab();
    Object.keys(labs).forEach(function (id) { labs[id].update(dt); });
    if (pendingEndpoint && l.isSettled) recordEndpoint();
    if (autoPending && state.prefs.autoTake && l.isSettled && l.stable && activeSeries() && !activeSeries().finished) takeReading(true);
    if (state.view === 'lab') {
      renderer.frame(dt);
      renderer.setOptions({ targetReading: targetReading() });
      renderLabDynamic(false);
      labChart.draw();
    }
    if (state.view === 'eval') NS.Journal.frame();
    saveClock += dt;
    if (saveClock > 2) { saveClock = 0; if (l.dispensed || l.sample) save(); }
    global.requestAnimationFrame(loop);
  }

  function targetReading() {
    const s = activeSeries();
    if (!s || s.kind !== 'half' || !Number.isFinite(s.target) || s.startReading === null) {
      if (s && s.kind === 'half' && Number.isFinite(s.target) && s.startReading === null && lab().burette.filled && !lab().dispensed) return lab().burette.reading + s.target;
      return null;
    }
    return s.startReading + s.target;
  }

  // ------------------------------------------------------------ Start

  const app = {
    state: state, labs: labs, lab: lab, exp: exp, es: es, save: save, toast: toast, modal: modal, confirmBox: confirmBox,
    esc: esc, subs: subs, $: $, $$: $$, activeSeries: activeSeries, seriesLabel: seriesLabel, seriesForChart: seriesForChart,
    indicatorBand: indicatorBand, fieldHtml: fieldHtml, hintHtml: hintHtml, hintButton: hintButton, kindLabel: kindLabel,
    renderLab: renderLab, setView: setView, renderer: renderer, labChart: labChart, pointStatus: pointStatus,
  };
  NS.App = app;
  NS.Journal.init(app);

  bindSplitter($('#labSplitter'), 'lab');
  bindSplitter($('#evalSplitter'), 'eval');
  if (state.prefs.panelW) document.documentElement.style.setProperty('--panel-w', state.prefs.panelW + 'px');
  renderer.setLab(lab());
  if (!Store.ok) toast('Lokales Speichern ist nicht verfügbar – Eingaben bleiben nur bis zum Neuladen erhalten.', 'warn', 8000);
  setView(state.view || 'theory');
  global.requestAnimationFrame(loop);
})(typeof globalThis !== 'undefined' ? globalThis : this);
