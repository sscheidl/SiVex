/*
 * Oberfläche des Halbtitrationslabors (ab 0.2.0)
 * ---------------------------------------------
 * Labkit-Hülle: Kopfzeile mit globalen Schaltern, Laborbühne (Titrierstand
 * und Titrationskurve nebeneinander, darunter die Dosierleiste),
 * verschiebbare Trennlinie, einklappbares Bedienfeld mit den Reitern
 * Aufgabe · Ergebnisse · Hefteintrag. Start direkt im Labor.
 *
 * Gerätezustand: ein pH-Meter für alle Versuche, eine Bürette je Maßlösung.
 * Eine neue Probe leert nur den Kolben.
 */
(function (global) {
  'use strict';

  const NS = global.Halbtitration;
  const Chem = NS.Chemistry;
  const Ind = NS.Indicators;
  const C = NS.Content;
  const Store = NS.Store;
  const T = NS.Tasks;
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
      const ex = Chem.experiment(id);
      const lab = new NS.Lab(ex);
      lab.timeScale = SPEED;
      // ein pH-Meter für alle Versuche
      Object.defineProperty(lab, 'calibration', { get: function () { return state.meter.calibration; }, set: function (v) { state.meter.calibration = v; }, configurable: true });
      const saved = state.exps[id].lab;
      if (saved) {
        const s = Object.assign({}, saved);
        delete s.burette;
        delete s.calibration;
        lab.restore(s);
      }
      lab.burette = state.burettes[ex.titrant]; // eine Bürette je Maßlösung
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
      Object.keys(labs).forEach(function (id) {
        const j = labs[id].toJSON();
        delete j.burette;
        delete j.calibration;
        state.exps[id].lab = j;
      });
      if (!Store.save(state) && !storageWarned) {
        storageWarned = true;
        toast('Lokales Speichern ist hier nicht möglich. Die App funktioniert weiter, Eingaben gehen beim Neuladen aber verloren.', 'warn', 8000);
      }
    };
    if (now) run(); else saveTimer = setTimeout(run, 300);
  }

  // ------------------------------------------------------------ Meldungen und Dialoge

  let toastTimer = null;
  function toast(text, kind, ms) {
    const el = $('#toast');
    el.className = 'toast show ' + (kind || '');
    el.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, ms || 4200);
  }

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
        el.className = 'lk-btn' + (b.primary ? ' primary' : '') + (b.warn ? ' warn' : '');
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
    return modal(title, /^</.test(text) ? text : '<p>' + text + '</p>', [{ label: 'Abbrechen', value: false }, { label: okLabel || 'OK', value: true, primary: true }]);
  }

  // ------------------------------------------------------------ Messreihen

  function activeSeries() { const e = es(); return e.active >= 0 ? e.series[e.active] || null : null; }
  function seriesLabel(s) { return 'Messreihe ' + s.no + ' · ' + (s.kind === 'survey' ? 'Titrationskurve' : 'Halbtitration'); }

  function newSeries(kind) {
    const e = es();
    const no = e.series.length ? Math.max.apply(null, e.series.map(function (s) { return s.no; })) + 1 : 1;
    const s = { id: 'R' + no, no: no, kind: kind, sample: e.sampleNo, points: [], endpoint: null, startReading: null, refills: [], finished: false, indicator: e.indicator || 'none', target: null, created: Date.now() };
    e.series.push(s);
    e.active = e.series.length - 1;
    if (kind === 'survey') e.evalSurvey = s.id; else e.evalHalf = s.id;
    return s;
  }

  function freshSample(kind) {
    const l = lab();
    if (l.isFlowing) l.closeValve();
    const e = es();
    const cur = activeSeries();
    if (cur && !cur.points.length && !l.dispensed) {
      cur.kind = kind;
      cur.indicator = e.indicator || 'none';
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
    e.open.prep = undefined;
    save();
    refresh();
  }

  function takeReading(auto) {
    const l = lab();
    const s = activeSeries();
    if (!s || s.finished) { if (!auto) toast('Setze zuerst eine frische Probe an.', 'warn'); return; }
    if (!l.meterReady) { if (!auto) toast(l.calibration < 2 ? 'Das pH-Meter ist noch nicht kalibriert.' : 'Die Elektrode taucht nicht in die Probe ein.', 'warn'); return; }
    const r = l.reading();
    const p = { v: r.v, pH: r.pH, stable: r.stable, settled: r.settled, homogeneous: r.homogeneous, stirred: r.stirred, t: Math.round(l.time * 10) / 10 };
    const i = s.points.findIndex(function (q) { return Math.abs(q.v - p.v) < 0.005; });
    const replaced = i >= 0 ? s.points[i] : null;
    if (i >= 0) s.points[i] = p; else s.points.push(p);
    s.points.sort(function (a, b) { return a.v - b.v; });
    if (!auto) {
      if (!r.settled || !r.stable) toast('Messpunkt gespeichert, aber noch nicht stabil (offener Kreis). Nach dem Zugeben kurz warten, bis die Anzeige „stabil“ zeigt.', 'warn', 6000);
      else if (replaced && (replaced.pH !== p.pH || replaced.stable !== p.stable)) toast('Messpunkt bei ' + fmt(p.v, 2) + ' mL ersetzt.');
    }
    autoPending = false;
    save();
    refresh();
  }

  async function markEndpoint() {
    const s = activeSeries();
    if (!s) return;
    if (s.endpoint && !(await confirmBox('Endpunkt erneut notieren?', 'Für diese Messreihe ist bereits ein Endpunkt bei ' + fmt(s.endpoint.v, 2) + ' mL notiert. Den neuen Wert verwenden?', 'Neu notieren'))) return;
    if (lab().isFlowing) lab().closeValve();
    pendingEndpoint = true;
    toast('Hahn geschlossen – der Endpunkt wird notiert, sobald der letzte Tropfen angekommen ist.');
  }
  function recordEndpoint() {
    const s = activeSeries();
    const l = lab();
    pendingEndpoint = false;
    if (!s) return;
    s.endpoint = { v: l.addedRounded, reading: Math.round(l.burette.reading * 100) / 100 };
    toast('Endpunkt notiert bei ' + fmt(s.endpoint.v, 2) + ' mL (Bürettenstand ' + fmt(s.endpoint.reading, 2) + ' mL).', 'ok');
    save();
    refresh();
  }

  async function repeatSeries() {
    const s = activeSeries();
    if (!s) return;
    if (!(await confirmBox('Messreihe wiederholen?', 'Die Messwerte von „' + esc(seriesLabel(s)) + '“ werden verworfen und eine frische Probe für denselben Zweck angesetzt. Andere Messreihen und deine Rechnungen bleiben erhalten.', 'Verwerfen und neu'))) return;
    const e = es();
    const kind = s.kind;
    e.series.splice(e.active, 1);
    e.active = -1;
    if (e.evalSurvey === s.id) e.evalSurvey = null;
    if (e.evalHalf === s.id) e.evalHalf = null;
    freshSample(kind);
  }

  async function resetMenu() {
    const v = await modal('Zurücksetzen', '<p><strong>Neue Probe</strong> und <strong>Messreihe wiederholen</strong> findest du über der Laborbühne. Sie löschen keine Rechnungen.</p><p><strong>Gesamtes Labor zurücksetzen</strong> löscht alle Messreihen, Rechnungen und Antworten aller vier Versuche auf diesem Gerät.</p>', [
      { label: 'Abbrechen', value: null, primary: true },
      { label: 'Gesamtes Labor zurücksetzen', value: 'all', warn: true },
    ]);
    if (v !== 'all') return;
    if (!(await confirmBox('Wirklich alles löschen?', 'Dieser Schritt kann nicht rückgängig gemacht werden.', 'Alles löschen'))) return;
    const fresh = Store.createState();
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.assign(state, fresh);
    Object.keys(labs).forEach(function (k) { delete labs[k]; });
    renderer.setLab(lab());
    save(true); // schreibt einen frischen Stand (ein alter 0.1.0-Stand wird dadurch nicht erneut übernommen)
    refresh();
    toast('Labor zurückgesetzt.', 'ok');
  }

  // ------------------------------------------------------------ Labor: Vorbereitung und Dosierung

  const renderer = new NS.LabRenderer($('#labCanvas'));
  let autoPending = false;
  let pendingEndpoint = false;
  let doseSize = 1;
  let pendingCal2 = false;

  function bindLab(l, id) {
    l.on('step-done', function () { if (id === state.current) autoPending = true; });
    l.on('valve', function (e) { if (!e.open && id === state.current) autoPending = true; });
    l.on('empty', function () { if (id === state.current) toast('Bürette am Ende der Skala (50,00 mL) – zwischen zwei Proben nachfüllen.', 'warn'); });
    l.on('limited', function () { if (id === state.current) toast('Nur bis zum Ende der Bürettenskala zugegeben.', 'warn'); });
    l.on('blocked', function (e) { if (id === state.current) toast(blockedText(e.reason), 'warn'); });
    l.on('prep', function (e) {
      if (e.action === 'sample-done') l.addWater(); // Probe vorlegen: pipettieren, dann verdünnen
      if (e.action === 'cal-done' && e.step === 1 && pendingCal2) { pendingCal2 = false; l.calibrate(2); }
      if (id !== state.current) return;
      if (/-done$/.test(e.action) || e.action === 'electrode') { save(); refreshLab(); }
    });
  }

  function blockedText(r) {
    return {
      burette: 'Die Bürette ist noch nicht vorbereitet.',
      sample: 'Es ist noch keine Probe im Kolben.',
      water: 'Die Probe wird noch verdünnt.',
      empty: 'Die Bürette ist bis zur 50-mL-Marke abgelassen – vor der nächsten Probe nachfüllen.',
      titrant: 'Wähle im Bedienfeld zuerst die passende Maßlösung.',
    }[r] || 'Das geht gerade nicht.';
  }

  function titrantOk() { const a = es().answers.titrant; return !!a && (a.status === 'ok' || a.shown) && es().titrant === exp().titrant; }

  function prepStatus() {
    const l = lab();
    return {
      burette: l.buretteReady && titrantOk(),
      meter: l.calibration >= 2,
      sample: l.sampleReady && l.waterReady,
      indicator: !!l.indicator,
      stir: l.stirrer,
      electrode: l.electrodeIn,
      // der Indikator ist freiwillig und zählt nicht als Pflichtschritt
      allDone: function () { return this.burette && this.meter && this.sample && this.electrode; },
    };
  }

  function chip(done, text) { return '<span class="pchip' + (done ? ' done' : '') + '">' + (done ? '✓ ' : '○ ') + text + '</span>'; }

  /** Indikatorwahl mit Knopf – sichtbar, solange die Probe noch keinen Indikator hat */
  function indicatorControl() {
    const l = lab();
    const e = es();
    const sel = e.indicator && e.indicator !== 'none' ? e.indicator : 'phenolphthalein';
    return '<span class="pgroup"><select id="deckIndicator" aria-label="Indikator wählen (freiwillig)" title="Freiwillige zusätzliche Beobachtung – maßgeblich ist die pH-Messung">' + Ind.list().filter(function (i) { return i.range; }).map(function (i) {
      return '<option value="' + i.id + '"' + (sel === i.id ? ' selected' : '') + ' title="Umschlag pH ' + fmt(i.range[0], 1) + '–' + fmt(i.range[1], 1) + '">' + esc(i.name) + '</option>';
    }).join('') + '</select>' + btn('indicator', 'zugeben', l.sampleReady && !l.indicator, false, '3 Tropfen Indikatorlösung zugeben (freiwillig – maßgeblich ist die pH-Messung)') + '</span>';
  }

  function deckHtml() {
    const l = lab();
    const x = exp();
    const e = es();
    const s = activeSeries();
    const p = prepStatus();
    const tit = Chem.TITRANTS[x.titrant];
    const allDone = p.allDone();
    const showPrep = e.open.prep !== undefined ? e.open.prep : !allDone;
    let h = '';
    if (!showPrep) {
      // erledigt: kompakte Statuszeile; der Indikator bleibt als Knopf erreichbar
      h += '<div class="deck-row prepline">' + chip(p.burette, 'Bürette ' + tit.formula.replace('(aq)', '') + (s && s.startReading !== null ? ' · Start ' + fmt(s.startReading, 2) + ' mL' : '')) + chip(p.meter, 'pH-Meter') + chip(p.sample, 'Probe ' + (e.sampleNo + 1)) +
        (p.indicator ? chip(true, Ind.get(l.indicator).name) : l.sampleReady ? '<span class="pchip">Indikator ' + indicatorControl() + '</span>' : '') +
        chip(p.electrode, 'Elektrode') + '<button type="button" class="lk-btn small" data-action="toggle-prep">Vorbereitung</button></div>';
    } else {
      // Laborreihenfolge von links nach rechts; der nächste offene Schritt ist hervorgehoben
      const busy = l.pipetting ? (l.pipetting.kind === 'sample' ? 'Pipettiert …' : 'Verdünnt …') : null;
      const steps = [
        { done: p.burette, html: p.burette ? '✓ Bürette ' + tit.formula.replace('(aq)', '') : 'Bürette: ' + btn('prep-burette', 'Natronlauge', !l.isFlowing, false, 'Bürette mit Natronlauge NaOH(aq), 0,100 mol/L, spülen, füllen und entlüften', ' data-titrant="NaOH"') + btn('prep-burette', 'Salzsäure', !l.isFlowing, false, 'Bürette mit Salzsäure HCl(aq), 0,100 mol/L, spülen, füllen und entlüften', ' data-titrant="HCl"') },
        { done: p.meter, html: p.meter ? '✓ pH-Meter kalibriert' : btn('prep-meter', l.calRunning ? 'Kalibriert …' : 'pH-Meter kalibrieren', !l.calRunning && !l.electrodeIn, false, 'Zwei-Punkt-Kalibrierung mit Pufferlösungen pH 7,00 und ' + (x.direction > 0 ? '10,01' : '4,01')) },
        { done: p.sample, html: p.sample ? '✓ Probe ' + (e.sampleNo + 1) : btn('prep-sample', busy || 'Probe vorlegen', !l.pipetting && l.sample === 0 && !!s && !s.finished, false, fmt(x.vSample, 2) + ' mL Probe pipettieren und mit ' + fmt(x.vWater, 0) + ' mL Wasser verdünnen') },
        { done: p.indicator, optional: true, html: p.indicator ? '✓ ' + Ind.get(l.indicator).name : 'Indikator ' + indicatorControl() },
        { done: p.stir, html: btn('stir', p.stir ? '✓ Rührer an' : 'Rührer einschalten', true, p.stir, p.stir ? 'Antippen schaltet den Rührer aus' : 'Magnetrührer einschalten') },
        { done: p.electrode, html: btn('electrode', p.electrode ? '✓ Elektrode eingetaucht' : 'Elektrode eintauchen', !l.calRunning && (l.electrodeIn || (p.meter && p.sample)), p.electrode, l.electrodeIn ? 'Antippen nimmt die Elektrode heraus' : 'Elektrode spülen und in die Probe tauchen') },
      ];
      const next = steps.findIndex(function (q) { return !q.done && !q.optional; });
      h += '<div class="deck-row prep">' + steps.map(function (q, i) {
        return '<span class="pstep' + (q.done ? ' done' : '') + (i === next ? ' next' : '') + '"><span class="pn">' + (i + 1) + '</span>' + q.html + '</span>';
      }).join('') +
        (l.burette.filled && !l.dispensed && !l.isFlowing && l.burette.reading > 20 ? btn('refill', 'Nachfüllen', true, false, 'Bürette vor dieser Probe nachfüllen') : '') +
        (allDone ? '<button type="button" class="lk-btn small" data-action="toggle-prep">Einklappen</button>' : '') + '</div>';
    }
    // Messen: Rührer, Dosierung, Übernahme, Erfassungsart
    const auto = state.prefs.capture !== 'manual';
    h += '<div class="deck-row measure">' +
      '<button type="button" class="lk-btn small stir" data-action="stir" aria-pressed="' + l.stirrer + '">Rührer ' + (l.stirrer ? 'an' : 'aus') + '</button>' +
      '<div class="readout" aria-live="off"><span>V zugegeben</span><b id="roV">–</b><span>Bürette</span><b id="roR">–</b><span>pH</span><b><span id="roPH">–</span><span id="roSt" class="status-pill"></span></b></div>' +
      '<div class="lk-seg light dose" role="group" aria-label="Dosiermenge">' + [['drop', '1 Tr.'], [0.1, '0,10'], [0.2, '0,20'], [0.5, '0,50'], [1, '1,00'], [2, '2,00']].map(function (d) {
        return '<button type="button" data-action="dose-size" data-size="' + d[0] + '" aria-pressed="' + (String(doseSize) === String(d[0])) + '"' + (d[0] === 'drop' ? ' aria-label="1 Tropfen (0,05 mL)"' : ' aria-label="' + d[1] + ' mL"') + '>' + d[1] + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="lk-btn primary" data-action="dose" title="Taste D">Zugeben <span id="doseLbl"></span></button>' +
      '<button type="button" class="lk-btn" data-action="valve" id="btnValve" title="Taste H">Hahn öffnen</button>' +
      '<button type="button" class="lk-btn take" data-action="take" title="Taste M">Messwert übernehmen</button>' +
      '<div class="lk-seg light capture" role="group" aria-label="Messwerterfassung"><span class="seg-label">Erfassung</span>' +
      '<button type="button" data-action="capture" data-mode="auto" aria-pressed="' + auto + '" title="Nach jeder Zugabe wird der Messwert übernommen, sobald die Anzeige stabil ist – die Kurve wächst mit">automatisch</button>' +
      '<button type="button" data-action="capture" data-mode="manual" aria-pressed="' + !auto + '" title="Messwerte nur mit „Messwert übernehmen“ (Taste M)">manuell</button></div>' +
      '<span class="util"><label class="rate">Tropfgeschwindigkeit <input type="range" id="rate" min="0" max="100" step="1" value="' + rateToSlider(l.flowRate) + '" aria-label="Tropfgeschwindigkeit bei offenem Hahn"><span id="rateLbl"></span></label>' +
      (s && !s.finished && s.indicator !== 'none' ? '<button type="button" class="lk-btn small" data-action="endpoint">Endpunkt notieren</button>' : '') +
      (s && !s.finished && s.kind === 'half' ? '<span class="target"><label for="targetIn">Zielmarke</label><input type="text" inputmode="decimal" id="targetIn" value="' + esc(s.targetDraft !== undefined ? s.targetDraft : Number.isFinite(s.target) ? fmt(s.target, 2) : '') + '" autocomplete="off"><span class="unit">mL</span><button type="button" class="lk-btn small" data-action="set-target">Setzen</button></span>' : '') +
      '</span><span class="deck-hint" id="deckHint"></span></div>';
    return h;
  }

  function btn(action, label, enabled, done, title, extra) {
    return '<button type="button" class="lk-btn small' + (done ? ' done' : '') + '" data-action="' + action + '"' + (extra || '') + (enabled ? '' : ' disabled') + (title ? ' title="' + esc(title) + '"' : '') + '>' + label + '</button>';
  }

  function rateFromSlider(v) { return 0.01 * Math.pow(100, v / 100); }
  function rateToSlider(q) { return Math.round((Math.log(q / 0.01) / Math.log(100)) * 100); }

  function expChipsHtml() {
    return Chem.EXPERIMENT_IDS.map(function (id) {
      const x = Chem.EXPERIMENTS[id];
      const r = C.ROLES[id];
      const st = state.exps[id];
      const done = st.submission ? ' ✓' : '';
      return '<button type="button" class="expchip" data-action="choose-exp" data-id="' + id + '" aria-pressed="' + (id === state.current) + '"><b>' + x.no + ' ' + esc(r.chip) + done + '</b><small>' + r.role + '</small></button>';
    }).join('');
  }

  function seriesBarHtml() {
    const s = activeSeries();
    return '<button type="button" class="lk-btn small" data-action="new-sample" data-kind="survey" title="Kolben leeren, frische Probe für eine Titrationskurve (gespeicherte Reihen bleiben)">Neue Probe (Kurve)</button>' +
      '<button type="button" class="lk-btn small" data-action="new-sample" data-kind="half" title="Kolben leeren, frische Probe für die Halbtitration (gespeicherte Reihen bleiben)">Neue Probe (Halbtitration)</button>' +
      '<button type="button" class="lk-btn small" data-action="repeat"' + (s && s.points.length ? '' : ' disabled') + ' title="Aktive Messreihe verwerfen und mit frischer Probe wiederholen">Reihe wiederholen</button>';
  }

  // ------------------------------------------------------------ Kurve

  const chart = new NS.TitrationChart($('#chart'), {
    onRead: function (p, s) { $('#chartFoot').innerHTML = '<strong>' + esc(s.label) + '</strong>: V = ' + fmt(p.v, 2) + ' mL · pH = ' + fmt(p.pH, 2) + (p.stable && p.homogeneous !== false ? '' : ' <span class="badge warn">nicht stabil</span>'); },
    onMarker: function (key, v) {
      T.setMarker(key, v);
      save();
      updateChart();
      const s = T.survey();
      const ip = s ? NS.Evaluation.interpolate(s.points, v) : null;
      $('#chartFoot').innerHTML = '<strong>Marker ' + markerLabel(key) + '</strong>: V = ' + fmt(v, 2) + ' mL' + (ip && Number.isFinite(ip.pH) ? ' · pH ≈ ' + fmt(ip.pH, 2) + (ip.interpolated ? ' <span class="badge int">interpoliert</span>' : '') : '') + ' – im Bedienfeld prüfen.';
      clearTimeout(markerTimer);
      markerTimer = setTimeout(function () { if (state.tab === 'task') T.renderTask(); }, 250);
    },
  });
  let markerTimer = null;

  function markerLabel(k) { return { eq1: exp().stages > 1 ? 'ÄP 1' : 'ÄP', eq2: 'ÄP 2' }[k]; }

  function indicatorBand(indId) {
    const ind = Ind.get(indId || 'none');
    if (!ind.range) return null;
    const c = Ind.solutionColor(ind.id, (ind.range[0] + ind.range[1]) / 2, 1.2);
    return { range: ind.range, color: 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',0.22)', label: 'Umschlagsbereich ' + ind.name };
  }

  function seriesForChart() {
    return es().series.map(function (s) {
      return { id: s.id, label: seriesLabel(s), points: s.points, color: s.kind === 'survey' ? NS.TitrationChart.COLORS.s1 : NS.TitrationChart.COLORS.s2, kind: s.kind };
    });
  }

  function updateChart() {
    const l = lab();
    const e = es();
    const s = activeSeries();
    const x = exp();
    const rel = T.released();
    const survey = T.survey();
    const marking = chart.mode === 'marker';
    const markers = ['eq1', 'eq2'].filter(function (k) { return Number(k.slice(-1)) <= x.stages; }).map(function (k) {
      const v = e.markers[k];
      const ip = Number.isFinite(v) && survey ? NS.Evaluation.interpolate(survey.points, v) : null;
      return { key: k, v: Number.isFinite(v) ? v : NaN, pH: ip ? ip.pH : NaN, label: markerLabel(k), color: '#0f7a52', interpolated: !!(ip && ip.interpolated) };
    });
    const bandInd = s ? s.indicator : e.indicator;
    const data = {
      series: seriesForChart(),
      activeId: marking && survey ? survey.id : s ? s.id : survey ? survey.id : null,
      current: l.sample > 0 && s && !s.finished ? { v: l.addedRounded, pH: l.displayPH } : null,
      target: s && s.kind === 'half' && Number.isFinite(s.target) ? s.target : null,
      endpoints: (s && s.endpoint ? [{ v: s.endpoint.v, label: 'Endpunkt' }] : []),
      markers: markers,
      band: e.view.band ? indicatorBand(bandInd) : null,
      xMode: e.view.xMode === 'data' ? 'data' : 'capacity',
      model: null, litLines: [], approxPoints: [],
    };
    if (rel) {
      if (e.view.model) data.model = Chem.curve(x, Math.min(x.capacity, Math.max(10, maxV() + 2)), 300);
      if (e.view.lit) {
        const lit = Chem.LITERATURE[x.id];
        // auf der pH-Achse nur pKₛ-Werte; bei Ammoniak der Wert der korrespondierenden Säure
        data.litLines = lit.pKs.slice(0, x.id === 'phosphoric' ? 2 : lit.pKs.length).map(function (p, i) {
          return { pH: p, label: (x.id === 'ammonia' ? 'pKₛ(NH₄⁺) = ' : 'pKₛ' + (lit.pKs.length > 1 ? ['₁', '₂'][i] : '') + ' = ') + fmt(p, 2) + ' (Literatur)' };
        });
      }
      if (e.view.approx) data.approxPoints = NS.Evaluation.theoryPoints(x).map(function (p) { return { v: p.v, pH: p.main, label: p.label }; });
    }
    chart.setData(data);
    renderChartTools(rel, data);
  }

  function maxV() { let m = 0; es().series.forEach(function (s) { s.points.forEach(function (p) { if (p.v > m) m = p.v; }); }); return m; }

  let toolsSig = '';
  function renderChartTools(rel, data) {
    const e = es();
    const x = exp();
    const survey = T.survey();
    const steps = T.stepState();
    const showMarkers = !!survey && (!steps.curve || chart.mode === 'marker' || e.open.curve);
    const s = activeSeries();
    const ind = s ? s.indicator : e.indicator;
    const sig = [rel, e.view.xMode, e.view.band, e.view.model, e.view.lit, e.view.approx, chart.mode, chart.activeMarker, showMarkers, ind, x.id].join('|');
    if (sig !== toolsSig) {
      toolsSig = sig;
      let h = '<div class="lk-seg light" role="group" aria-label="Bereich der Volumenachse"><button type="button" data-action="xmode" data-x="capacity" aria-pressed="' + (e.view.xMode !== 'data') + '">0–50 mL</button><button type="button" data-action="xmode" data-x="data" aria-pressed="' + (e.view.xMode === 'data') + '">Messbereich</button></div>';
      if (showMarkers) {
        h += '<button type="button" class="lk-btn small' + (chart.mode === 'marker' && chart.activeMarker === 'eq1' ? ' on' : '') + '" data-action="chart-marker" data-marker="eq1">Marker ' + markerLabel('eq1') + '</button>';
        if (x.stages > 1) h += '<button type="button" class="lk-btn small' + (chart.mode === 'marker' && chart.activeMarker === 'eq2' ? ' on' : '') + '" data-action="chart-marker" data-marker="eq2">Marker ÄP 2</button>';
        if (chart.mode === 'marker') h += '<button type="button" class="lk-btn small" data-action="chart-read">Fertig</button>';
      }
      if (ind && ind !== 'none') h += '<label class="chk"><input type="checkbox" id="chkBand"' + (e.view.band ? ' checked' : '') + '> Umschlag</label>';
      if (rel) {
        h += '<label class="chk"><input type="checkbox" id="chkModel"' + (e.view.model ? ' checked' : '') + '> Modell</label>';
        h += '<label class="chk"><input type="checkbox" id="chkLit"' + (e.view.lit ? ' checked' : '') + '> Literatur-pKₛ</label>';
        h += '<label class="chk"><input type="checkbox" id="chkApprox"' + (e.view.approx ? ' checked' : '') + '> Näherung</label>';
      }
      $('#chartTools').innerHTML = h;
    }
    $('#chartSub').textContent = chart.mode === 'marker' ? '· Antippen oder ziehen setzt den Marker, Pfeiltasten verschieben ihn' : '';
    // Legende
    let lg = '';
    const ac = data.series.find(function (q) { return q.id === data.activeId; });
    if (ac) lg += '<span><i class="dot" style="background:' + ac.color + '"></i>' + esc(ac.label) + '</span>';
    if (data.series.length > 1) lg += '<span><i class="dot" style="background:' + NS.TitrationChart.COLORS.pale + '"></i>gespeicherte Reihe(n)</span>';
    lg += '<span><i class="ring"></i>nicht stabil</span><span><i class="line"></i>Verbindung der Messpunkte</span>';
    if (data.current) lg += '<span><i class="line dash"></i>aktuelle Position</span>';
    if (data.markers.some(function (m) { return Number.isFinite(m.v); })) lg += '<span><i class="line dash green"></i>eigener Marker</span>';
    if (data.model) lg += '<span><i class="line dash grey"></i>Modellreferenz</span>';
    if (data.litLines.length) lg += '<span><i class="line dot2"></i>Literatur-pKₛ</span>';
    if (data.approxPoints.length) lg += '<span><i class="dia"></i>Näherungsrechnung</span>';
    $('#chartLegend').innerHTML = lg;
  }

  function chartImage() {
    updateChart();
    chart.draw(true);
    return $('#chart').toDataURL('image/png');
  }

  // ------------------------------------------------------------ Darstellung

  function refreshLab() {
    $('#expChips').innerHTML = expChipsHtml();
    $('#seriesBar').innerHTML = seriesBarHtml();
    $('#deck').innerHTML = subs(deckHtml());
    const x = exp();
    const l = lab();
    const s = activeSeries();
    renderer.setOptions({
      labels: {
        titrant: { title: 'Maßlösung', lines: [l.burette.filled ? Chem.TITRANTS[x.titrant].formula + ', c = 0,100 mol/L' : 'Bürette leer'] },
        sample: l.sample > 0 ? { title: 'Probe ' + (es().sampleNo + 1), lines: [x.sampleFormula, l.indicator && l.indicator !== 'none' ? '+ ' + Ind.get(l.indicator).name : l.water > 0 ? 'verdünnt auf ' + fmt(x.vSample + x.vWater, 0) + ' mL' : fmt(x.vSample, 0) + ' mL'] } : null,
      },
    });
    lastDyn = '';
    renderDynamic(true);
    updateChart();
  }

  function renderPanel() {
    $$('.lk-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)); });
    if (state.tab === 'task') T.renderTask();
    else if (state.tab === 'results') T.renderResults();
    else $('#panelBody').innerHTML = '<div class="lk-notebook">' + C.NOTEBOOK + '</div><p class="lk-muted">Zum Abschreiben ins Heft – unabhängig von deinen Messwerten.</p>';
  }

  function refresh() {
    refreshLab();
    renderPanel();
  }

  function applyPanel() {
    $('#main').classList.toggle('panel-hidden', !state.panelOpen);
    $('#btnPanel').setAttribute('aria-expanded', String(state.panelOpen));
    $('#btnPanel').setAttribute('aria-pressed', String(state.panelOpen));
  }

  let lastDyn = '';
  let lastLock = '';
  function renderDynamic(force) {
    const l = lab();
    const s = activeSeries();
    if (!$('#roV')) return;
    const p = prepStatus();
    const lock = [p.sample, p.burette, p.meter, p.electrode, p.indicator, p.stir, !!l.pipetting, !!l.calRunning, !!(s && s.points.length), l.dispensed > 0, s && s.endpoint ? s.endpoint.v : ''].join('|');
    if (lock !== lastLock) { lastLock = lock; if (!force) { refreshLab(); return; } }
    const sigNow = [l.addedRounded, l.burette.reading, l.displayPH, l.stable, l.isFlowing, l.valveOpen, s ? s.points.length : -1, l.homogeneous, doseSize, l.flowRate].join('|');
    if (sigNow === lastDyn && !force) return;
    lastDyn = sigNow;
    $('#roV').textContent = fmt(l.addedRounded, 2) + ' mL';
    $('#roR').textContent = l.burette.filled ? fmt(Math.round(l.burette.reading * 100) / 100, 2) + ' mL' : '–';
    $('#roPH').textContent = l.displayPH === null ? '–' : fmt(l.displayPH, 2);
    const st = $('#roSt');
    if (!l.meterReady) { st.className = 'status-pill'; st.textContent = 'nicht bereit'; }
    else if (!l.isSettled) { st.className = 'status-pill warn'; st.textContent = 'Zugabe'; }
    else if (!l.stable) { st.className = 'status-pill warn'; st.textContent = l.stirrer ? 'misst …' : 'ohne Rühren'; }
    else { st.className = 'status-pill ok'; st.textContent = 'stabil'; }
    $('#btnValve').textContent = l.valveOpen ? 'Hahn schließen' : 'Hahn öffnen';
    $('#btnValve').classList.toggle('on', l.valveOpen);
    $('#doseLbl').textContent = doseSize === 'drop' ? '(0,05 mL)' : '(' + fmt(doseSize, 2) + ' mL)';
    const rl = $('#rateLbl');
    if (rl) rl.textContent = fmt(l.flowRate, 2) + ' mL/s';
    const hint = $('#deckHint');
    if (hint) hint.textContent = s && s.kind === 'half' && Number.isFinite(s.target) ? 'Ziel ' + fmt(s.target, 2) + ' mL · noch ' + fmt(Math.max(0, s.target - l.addedRounded), 2) + ' mL' : s ? s.points.length + ' Messpunkt(e) in dieser Reihe' : '';
    updateChart();
  }

  // ------------------------------------------------------------ Aktionen

  function canStartDosing() {
    const l = lab();
    const s = activeSeries();
    if (!titrantOk()) { toast(blockedText('titrant'), 'warn'); return false; }
    const why = l.canDose();
    if (why) { toast(blockedText(why), 'warn'); return false; }
    if (!s || s.finished) { toast('Setze zuerst eine frische Probe an.', 'warn'); return false; }
    // Anfangsstand wird digital übernommen
    if (s.startReading === null) s.startReading = Math.round(l.burette.reading * 100) / 100;
    return true;
  }

  function dose() {
    if (!canStartDosing()) return;
    const l = lab();
    l.addVolume(doseSize === 'drop' ? l.dropVolume : doseSize);
    const s = activeSeries();
    if (s && s.kind === 'half' && Number.isFinite(s.target) && l.step && l.step.target > s.target + 0.025 && l.dispensed <= s.target + 0.025) {
      toast('Achtung: Mit dieser Zugabe wird deine Zielmarke überschritten. Verbrauchte Maßlösung lässt sich nicht zurückholen.', 'warn', 6000);
    }
    renderDynamic(true);
  }

  async function onAction(b) {
    const a = b.dataset.action;
    const l = lab();
    const s = activeSeries();
    if (await T.onAction(b)) return;
    switch (a) {
      case 'choose-exp': {
        l.closeValve();
        state.current = b.dataset.id;
        chart.mode = 'read';
        chart.activeMarker = null;
        renderer.setLab(lab());
        ensureSeries();
        save();
        refresh();
        break;
      }
      case 'prep-sample': l.pipetteSample(); refreshLab(); break;
      case 'prep-burette': {
        const want = exp().titrant;
        const pick = b.dataset.titrant;
        const a = es().answers.titrant = es().answers.titrant || {};
        a.choice = [pick];
        if (pick !== want) {
          a.status = 'wrong';
          toast(want === 'NaOH' ? 'Salzsäure neutralisiert keine Säure – für diese Probe brauchst du eine Base als Maßlösung.' : 'Natronlauge reagiert nicht mit der Base Ammoniak – für diese Probe brauchst du eine Säure als Maßlösung.', 'warn', 6000);
          save(); refresh();
          break;
        }
        a.status = 'ok';
        es().titrant = want;
        if (!l.buretteReady) {
          l.rinseBurette();
          l.fillBurette(START_READINGS[es().sampleNo % START_READINGS.length]);
          l.purgeTip(0.15);
          toast('Bürette mit ' + Chem.TITRANTS[want].name + ' gespült, gefüllt und entlüftet. Der Stand wird digital abgelesen.');
        } else toast('Die Bürette mit ' + Chem.TITRANTS[want].name + ' ist bereits gefüllt.');
        save(); refresh();
        break;
      }
      case 'refill': {
        if (!(await confirmBox('Bürette nachfüllen?', 'Die Bürette wird vor dieser Probe wieder bis knapp unter die Nullmarke gefüllt. Gespeicherte Messreihen ändern sich dadurch nicht.', 'Nachfüllen'))) return;
        l.fillBurette(START_READINGS[(es().sampleNo + 2) % START_READINGS.length]);
        if (s) s.startReading = null;
        save(); refreshLab();
        break;
      }
      case 'prep-meter': pendingCal2 = true; l.calibrate(1); refreshLab(); break;
      case 'electrode': {
        if (l.electrodeIn) { l.liftElectrode(); save(); refreshLab(); break; }
        const r = l.immerseElectrode();
        if (!r.ok) toast({ calibrate: 'Erst das pH-Meter kalibrieren.', sample: 'Es ist noch keine Probe im Kolben.', depth: 'Die Probe wird noch verdünnt – erst dann sind Glasmembran und Diaphragma bedeckt.' }[r.reason], 'warn', 5000);
        save(); refreshLab();
        break;
      }
      case 'indicator': {
        const sel = $('#deckIndicator');
        const id = sel ? sel.value : es().indicator;
        if (!id || id === 'none' || !l.addIndicator(id)) break;
        es().indicator = id;
        if (s && (s.indicator === 'none' || !s.indicator)) s.indicator = id;
        save(); refresh();
        break;
      }
      case 'capture': state.prefs.capture = b.dataset.mode === 'manual' ? 'manual' : 'auto'; save(); refreshLab(); break;
      case 'toggle-prep': { const p = prepStatus(); const open = es().open.prep !== undefined ? es().open.prep : !p.allDone(); es().open.prep = !open; save(); refreshLab(); break; }
      case 'stir': l.setStirrer(!l.stirrer); save(); refreshLab(); break;
      case 'dose-size': doseSize = b.dataset.size === 'drop' ? 'drop' : Number(b.dataset.size); $$('[data-action="dose-size"]').forEach(function (q) { q.setAttribute('aria-pressed', String(q === b)); }); renderDynamic(true); break;
      case 'dose': dose(); break;
      case 'valve': if (l.valveOpen || canStartDosing()) { l.toggleValve(); renderDynamic(true); } break;
      case 'take': takeReading(false); break;
      case 'endpoint': markEndpoint(); break;
      case 'new-sample': {
        const cur = activeSeries();
        if (cur && cur.points.length && !cur.finished && !(await confirmBox('Frische Probe ansetzen?', 'Die aktive Messreihe „' + esc(seriesLabel(cur)) + '“ wird beendet und gespeichert. Der Kolben wird geleert; Bürette und Kalibrierung bleiben.', 'Neue Probe'))) return;
        freshSample(b.dataset.kind);
        toast('Frische Probe – „Probe vorlegen“ und Elektrode eintauchen.', 'ok');
        break;
      }
      case 'repeat': repeatSeries(); break;
      case 'set-target': {
        if (!s || s.kind !== 'half' || s.finished) { toast('Die Zielmarke gilt für eine aktive Halbtitration. Setze zuerst eine frische Probe für die Halbtitration an.', 'warn', 5000); break; }
        let v = Number(b.dataset.v);
        if (!Number.isFinite(v)) { const p = NS.Format.parseQuantity(($('#targetIn') || {}).value || '', 'mL'); if (!p.ok && !p.empty) toast(p.message, 'warn'); v = p.ok ? p.value : null; }
        s.target = Number.isFinite(v) ? v : null;
        delete s.targetDraft;
        save(); refreshLab();
        break;
      }
      case 'xmode': es().view.xMode = b.dataset.x; save(); updateChart(); break;
      case 'chart-marker': {
        if (!T.survey()) { toast('Nimm zuerst eine Titrationskurve auf.', 'warn'); break; }
        chart.mode = 'marker';
        chart.activeMarker = b.dataset.marker;
        updateChart();
        $('#chart').focus();
        break;
      }
      case 'chart-read': chart.mode = 'read'; chart.activeMarker = null; updateChart(); if (state.tab === 'task') T.renderTask(); break;
      case 'toggle-panel': state.panelOpen = !state.panelOpen; applyPanel(); save(); break;
      case 'notebook': state.tab = 'notebook'; if (!state.panelOpen) { state.panelOpen = true; applyPanel(); } renderPanel(); save(); break;
      case 'report': T.report(); break;
      case 'reset-menu': resetMenu(); break;
      default: break;
    }
  }

  function ensureSeries() {
    const e = es();
    const l = lab();
    if (activeSeries() || l.sample > 0 || l.dispensed) return;
    newSeries(e.series.some(function (q) { return q.kind === 'survey' && q.points.length; }) ? 'half' : 'survey');
  }

  // ------------------------------------------------------------ Ereignisse

  document.addEventListener('click', function (ev) {
    const tab = ev.target.closest('.lk-tabs [data-tab]');
    if (tab) { state.tab = tab.dataset.tab; renderPanel(); save(); return; }
    const b = ev.target.closest('[data-action]');
    if (b && !b.disabled) onAction(b);
  });

  document.addEventListener('change', function (ev) {
    const t = ev.target;
    if (T.onChange(ev)) return;
    if (t.id === 'deckIndicator') { es().indicator = t.value; save(); return; }
    const e = es();
    if (t.id === 'chkBand') { e.view.band = t.checked; save(); updateChart(); }
    if (t.id === 'chkModel') { e.view.model = t.checked; save(); updateChart(); }
    if (t.id === 'chkLit') { e.view.lit = t.checked; save(); updateChart(); }
    if (t.id === 'chkApprox') { e.view.approx = t.checked; save(); updateChart(); }
  });

  document.addEventListener('input', function (ev) {
    const t = ev.target;
    if (t.id === 'targetIn') { const s = activeSeries(); if (s) s.targetDraft = t.value; return; }
    if (t.id === 'rate') { lab().setFlowRate(rateFromSlider(Number(t.value))); renderDynamic(true); return; }
    if (t.matches('[data-field] input[type="text"]')) T.onInput(t);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.target.matches('[data-field] input')) {
      if (ev.key === 'Enter') { ev.preventDefault(); T.checkField(ev.target.closest('[data-field]').dataset.field); }
      return;
    }
    if (ev.target.matches('input, textarea, select') || !$('#modal').hidden || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    const l = lab();
    if (k === 'd') { ev.preventDefault(); dose(); }
    else if (k === 'h') { ev.preventDefault(); if (l.valveOpen || canStartDosing()) { l.toggleValve(); renderDynamic(true); } }
    else if (k === 'm') { ev.preventDefault(); takeReading(false); }
  });

  $('#labCanvas').addEventListener('pointerdown', function (ev) {
    const rect = this.getBoundingClientRect();
    const hit = renderer.hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
    const l = lab();
    if (hit === 'stopcock') { renderer.tapFeedback('stopcock'); if (l.valveOpen || canStartDosing()) l.toggleValve(); renderDynamic(true); }
    else if (hit === 'stirrer') { l.setStirrer(!l.stirrer); save(); refreshLab(); }
  });

  // Aufklappbereiche merken (das toggle-Ereignis steigt nicht auf, daher Capture)
  document.addEventListener('toggle', function (ev) {
    const d = ev.target;
    if (d.tagName === 'DETAILS' && d.dataset.key) { es().open['d:' + d.dataset.key] = d.open; save(); }
  }, true);

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
    const s = activeSeries();
    if (autoPending && state.prefs.capture !== 'manual' && l.isSettled && l.stable && s && !s.finished && l.meterReady) takeReading(true);
    renderer.setOptions({ targetReading: s && s.kind === 'half' && Number.isFinite(s.target) && l.burette.filled ? (s.startReading !== null ? s.startReading : l.burette.reading) + s.target : null });
    renderer.frame(dt);
    renderDynamic(false);
    chart.draw();
    saveClock += dt;
    if (saveClock > 2) { saveClock = 0; if (l.dispensed || l.sample) save(); }
    global.requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ Start

  const app = {
    state: state, labs: labs, lab: lab, exp: exp, es: es, save: save, toast: toast, modal: modal, confirmBox: confirmBox,
    esc: esc, subs: subs, activeSeries: activeSeries, seriesLabel: seriesLabel, refresh: refresh, refreshLab: refreshLab,
    updateChart: updateChart, chartImage: chartImage, renderer: renderer, chart: chart,
  };
  NS.App = app;
  T.init(app);

  LK.splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex-halbtitration-panel', minStage: 560 });
  renderer.setLab(lab());
  ensureSeries();
  applyPanel();
  refresh();
  if (!Store.ok) toast('Lokales Speichern ist nicht verfügbar – Eingaben bleiben nur bis zum Neuladen erhalten.', 'warn', 8000);
  else if (state.migratedFrom === 1) { toast('Speicherstand aus Version 0.1.0 übernommen: Messreihen und Eingaben sind erhalten, frühere Prüfungen bitte erneut ausführen.', 'info', 9000); state.migratedFrom = null; save(); }
  global.requestAnimationFrame(loop);
})(typeof globalThis !== 'undefined' ? globalThis : this);
