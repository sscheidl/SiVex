/*
 * Benutzeroberfläche und Ablaufsteuerung
 * --------------------------------------
 * Verbindet Konfiguration, Experiment, Laborgrafik, Diagramm und
 * Auswertung. Phasen: setup → titration → evaluation.
 */
(function (global) {
  'use strict';

  const NS = global.Titrierlabor;
  const Chem = NS.Chemistry;
  const Ind = NS.Indicators;
  const Cfg = NS.Config;
  const Eval = NS.Evaluation;
  const fmt = Cfg.formatNumber;

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  const app = $('#app');
  const PANEL_KEY = 'titrierlabor.panelWidth';

  const state = {
    phase: 'setup',
    teacher: false,
    setup: {
      sampleType: Cfg.DEFAULTS.sampleType,
      cMode: Cfg.DEFAULTS.concentrationMode,
      indicator: Cfg.DEFAULTS.indicator,
      electrode: Cfg.DEFAULTS.electrode,
      stirrer: Cfg.DEFAULTS.stirrer,
    },
    config: null, // numerische Konfiguration des laufenden Versuchs
    hiddenConcentration: true,
    exp: null,
    showChart: false,
    lens: true,
    meterDisplay: true,
    valveUsed: false,
    revealEq: false,
    marker: null,
    teacherCurve: null,
    jump: null,
  };

  /** Reaktionsgleichungen je Probelösung */
  const REACTIONS = {
    acid: 'HCl + NaOH → NaCl + H₂O  ·  H₃O⁺ + OH⁻ → 2 H₂O',
    base: 'NaOH + HCl → NaCl + H₂O  ·  OH⁻ + H₃O⁺ → 2 H₂O',
    weakAcid: 'CH₃COOH + NaOH → CH₃COONa + H₂O  ·  CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O',
    weakBase: 'NH₃ + HCl → NH₄Cl  ·  NH₃ + H₃O⁺ → NH₄⁺ + H₂O',
  };

  // ---------- Hilfsfunktionen ----------

  function toast(text, kind, ms) {
    const area = $('#toastArea');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    area.appendChild(el);
    while (area.children.length > 3) area.removeChild(area.firstChild);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 320);
    }, ms || 2800);
  }

  function setPressed(el, on) { el.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  function speciesOf(type) { return Chem.SPECIES[type]; }

  /** Zahl mit Vorzeichen; Werte, die gerundet null ergeben, als ±0 */
  function signed(x, d) {
    if (Math.abs(x) < 0.5 * Math.pow(10, -d)) return '±' + fmt(0, d);
    return (x > 0 ? '+' : '') + fmt(x, d);
  }

  function setFieldError(key, msg) {
    const el = $('[data-error="' + key + '"]');
    if (el) el.textContent = msg || '';
    const input = { vSample: '#inVSample', cSample: '#inCSample', cTitrant: '#inCTitrant', vUsed: '#inVUsed', cStudent: '#inCStudent' }[key];
    if (input) $(input).closest('.input-wrap').classList.toggle('invalid', !!msg);
  }

  function rateFromSlider(v) {
    const e = NS.Experiment.DEFAULTS;
    const min = 0.015;
    return min * Math.pow(e.maxFlow / min, v / 100);
  }

  function rateText(q) {
    const dps = q / NS.Experiment.DEFAULTS.dropVolume;
    if (q > 0.3) return 'Strahl · ' + fmt(q, 2) + ' mL/s';
    return (dps < 1 ? fmt(dps, 1) : fmt(dps, dps < 10 ? 1 : 0)) + ' Tropfen/s';
  }

  // ---------- Vorbereitung ----------

  function readSetup() {
    const s = state.setup;
    const v = Cfg.validateField('vSample', $('#inVSample').value);
    const ct = Cfg.validateField('cTitrant', $('#inCTitrant').value);
    const cs = s.cMode === 'given' ? Cfg.validateField('cSample', $('#inCSample').value) : { ok: true, value: NaN };
    setFieldError('vSample', v.message);
    setFieldError('cTitrant', ct.message);
    setFieldError('cSample', s.cMode === 'given' ? cs.message : null);
    return { ok: v.ok && ct.ok && cs.ok, vSample: v.value, cTitrant: ct.value, cSample: cs.value };
  }

  function updateSetup() {
    const s = state.setup;
    const r = readSetup();
    $('#btnStart').disabled = !r.ok;

    const tp = speciesOf(Chem.counterpart(s.sampleType));
    $('#titrantChip').innerHTML = '<b>' + tp.formula + '</b> ' + tp.name;
    $('#reactionNote').textContent = REACTIONS[s.sampleType];
    $$('[data-sample]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.sample === s.sampleType); });
    $$('[data-cmode]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.cmode === s.cMode); });
    $('.cmode-hidden').hidden = s.cMode !== 'hidden';
    $('.cmode-given').hidden = s.cMode !== 'given';
    $$('.ind-card').forEach(function (c) {
      const on = c.dataset.indicator === s.indicator;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-checked', on ? 'true' : 'false');
    });

    // Durchführbarkeit prüfen
    const warnBox = $('#setupWarnings');
    warnBox.innerHTML = '';
    if (r.ok) {
      let warnings = [];
      if (s.cMode === 'given') {
        warnings = Cfg.feasibilityWarnings({ sampleType: s.sampleType, cSample: r.cSample, vSample: r.vSample, cTitrant: r.cTitrant }, true);
      } else {
        const lo = Cfg.randomSampleConcentration(r.cTitrant, r.vSample, function () { return 0; });
        const hi = Cfg.randomSampleConcentration(r.cTitrant, r.vSample, function () { return 0.999; });
        const seen = {};
        [lo, hi].forEach(function (c) {
          Cfg.feasibilityWarnings({ sampleType: s.sampleType, cSample: c, vSample: r.vSample, cTitrant: r.cTitrant }, false)
            .forEach(function (w) { if (!seen[w.text]) { seen[w.text] = 1; warnings.push(w); } });
        });
        if (warnings.length) {
          warnings.unshift({ level: 'warn', text: 'Mit dieser Kombination aus Maßlösung und Probevolumen lässt sich keine gut titrierbare unbekannte Probe erzeugen.' });
        }
      }
      warnings.forEach(function (w) {
        const d = document.createElement('div');
        d.className = 'warning ' + w.level;
        d.textContent = w.text;
        warnBox.appendChild(d);
      });

      // Vorschau im Labor
      const previewC = s.cMode === 'given' ? r.cSample : 0.1;
      buildExperiment({ sampleType: s.sampleType, cSample: previewC, vSample: r.vSample, cTitrant: r.cTitrant, indicator: s.indicator }, true);
    }
    updateLabels();
    updateTeacher();
  }

  function buildIndicatorList() {
    const box = $('#indicatorList');
    Ind.list().forEach(function (ind) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ind-card';
      b.dataset.indicator = ind.id;
      b.setAttribute('role', 'radio');
      const range = ind.range ? 'pH ' + fmt(ind.range[0], 1) + ' – ' + fmt(ind.range[1], 1) : '—';
      b.innerHTML =
        '<span class="ind-name">' + ind.name + '</span>' +
        '<span class="ind-range">' + range + '</span>' +
        (ind.range ? '<span class="ind-bar" style="background:' + Ind.cssGradient(ind.id) + '"></span>' +
          '<span class="ind-colors">' + ind.acidLabel + ' → ' + ind.baseLabel + '</span>' : '<span class="ind-colors">nur mit pH-Elektrode sinnvoll</span>');
      b.addEventListener('click', function () {
        state.setup.indicator = ind.id;
        updateSetup();
      });
      box.appendChild(b);
    });
  }

  // ---------- Experiment ----------

  function buildExperiment(config, preview) {
    const exp = new NS.Experiment(config, { electrode: preview ? false : state.setup.electrode });
    exp.setFlowRate(rateFromSlider(Number($('#inRate').value)));
    state.exp = exp;
    state.config = config;
    state.teacherCurve = Chem.theoreticalCurve(config, 50, 500);
    state.jump = null; // wird bei Bedarf berechnet
    renderer.setExperiment(exp);
    renderer.setOptions({
      indicator: config.indicator,
      electrode: state.setup.electrode,
      stirrer: state.setup.stirrer,
      meterLive: !preview,
      meterDisplay: state.meterDisplay,
    });
    if (preview) return exp;

    exp.on('empty', function () {
      toast('Die Bürette ist leer (50,00 mL verbraucht). Weitere Zugabe ist nicht möglich.', 'warn', 4000);
    });
    exp.on('valve', syncValveButton);
    exp.on('step-done', syncValveButton);
    exp.on('endpoint', function (e) {
      $('#endpointNote').textContent = 'Notiert: ' + fmt(e.v, 2) + ' mL. Du kannst den Wert jederzeit neu notieren.';
      toast('Endpunkt notiert: ' + fmt(e.v, 2) + ' mL', 'ok');
      invalidateResult();
    });
    state.marker = null;
    chart.reset();
    return exp;
  }

  function jumpRegion() {
    if (!state.jump) state.jump = Chem.jumpRegion(state.config);
    return state.jump;
  }

  function startExperiment(sameSample) {
    const s = state.setup;
    let config;
    if (sameSample && state.config) {
      config = Object.assign({}, state.config);
    } else {
      const r = readSetup();
      if (!r.ok) { toast('Bitte zuerst die Eingaben korrigieren.', 'warn'); return; }
      const hidden = s.cMode === 'hidden';
      const cSample = hidden ? Cfg.randomSampleConcentration(r.cTitrant, r.vSample) : r.cSample;
      config = { sampleType: s.sampleType, cSample: cSample, vSample: r.vSample, cTitrant: r.cTitrant, indicator: s.indicator };
      state.hiddenConcentration = hidden;
      Cfg.feasibilityWarnings(config, !hidden).forEach(function (w) { toast(w.text, 'warn', 6000); });
    }
    buildExperiment(config, false);
    state.valveUsed = false;
    state.revealEq = false;
    invalidateResult();
    $('#inVUsed').value = '';
    $('#inCStudent').value = '';
    setFieldError('vUsed', null);
    setFieldError('cStudent', null);
    $('#endpointNote').textContent = 'Notiere das Volumen, sobald die Farbe dauerhaft umschlägt.';
    setPhase('titration');
    syncValveButton();
    setPressed($('#tgElectrode'), state.setup.electrode);
    setPressed($('#tgStirrer'), state.setup.stirrer);
    setPressed($('#tgDisplay'), state.meterDisplay);
  }

  function syncValveButton() {
    const exp = state.exp;
    const btn = $('#btnValve');
    const open = !!(exp && exp.valveOpen);
    setPressed(btn, open);
    $('.valve-text', btn).textContent = open ? 'Hahn schließen' : 'Hahn öffnen';
  }

  function toggleValve() {
    if (state.phase !== 'titration') {
      toast(state.phase === 'setup' ? 'Starte zuerst das Experiment.' : 'Die Titration ist abgeschlossen.', 'warn');
      return;
    }
    state.valveUsed = true;
    state.exp.toggleValve();
    renderer.tapFeedback('stopcock');
    syncValveButton();
  }

  function toggleStirrer() {
    state.setup.stirrer = !state.setup.stirrer;
    $('#optStirrer').checked = state.setup.stirrer;
    renderer.setOptions({ stirrer: state.setup.stirrer });
    setPressed($('#tgStirrer'), state.setup.stirrer);
  }

  function toggleMeterDisplay() {
    state.meterDisplay = !state.meterDisplay;
    renderer.setOptions({ meterDisplay: state.meterDisplay });
    setPressed($('#tgDisplay'), state.meterDisplay);
    lastRO.ph = null;
  }

  // ---------- Phasen ----------

  function setPhase(phase) {
    state.phase = phase;
    app.dataset.phase = phase;
    $$('[data-phase-panel]').forEach(function (p) { p.hidden = p.dataset.phasePanel !== phase; });
    const order = ['setup', 'titration', 'evaluation'];
    $$('.step').forEach(function (b) {
      const i = order.indexOf(b.dataset.step);
      b.classList.toggle('is-active', b.dataset.step === phase);
      b.classList.toggle('is-done', i < order.indexOf(phase));
      b.disabled = i > 0 && !(state.exp && state.config && phase !== 'setup');
      if (b.dataset.step === 'setup') b.disabled = false;
    });
    if (phase === 'evaluation') {
      updateChartData();
      chart.freezeRange();
      if (state.exp.points.length > 1) setChart(true);
      fillEvaluation();
    } else {
      chart.unfreeze();
      // Weiter titrieren macht eine frühere Bewertung ungültig
      invalidateResult();
    }
    if (phase === 'setup') setChart(false);
    updateLabels();
    updateTeacher();
    $('.panel').scrollTop = 0;
  }

  function goToEvaluation() {
    if (!state.exp) return;
    state.exp.closeValve();
    syncValveButton();
    setPhase('evaluation');
  }

  // ---------- Labor-Beschriftungen ----------

  function updateLabels() {
    const cfg = state.config;
    if (!cfg) return;
    const sp = speciesOf(cfg.sampleType);
    const tp = speciesOf(Chem.counterpart(cfg.sampleType));
    const inSetup = state.phase === 'setup';
    const hidden = inSetup ? state.setup.cMode === 'hidden' : state.hiddenConcentration;
    let cLine;
    if (!hidden) cLine = 'c = ' + fmt(cfg.cSample, 3) + ' mol/L';
    else if (state.teacher && !inSetup) cLine = 'c = ' + fmt(cfg.cSample, 4) + ' mol/L (verdeckt)';
    else if (state.phase === 'evaluation' && state.revealEq) cLine = 'c = ' + fmt(cfg.cSample, 4) + ' mol/L';
    else cLine = 'c = ?  (unbekannt)';
    renderer.setOptions({
      labels: {
        titrant: { title: 'Maßlösung', lines: [tp.formula + ' · c = ' + fmt(cfg.cTitrant, 3) + ' mol/L'] },
        sample: { title: 'Probelösung', lines: [sp.formula + ' · V = ' + fmt(cfg.vSample, 2) + ' mL', cLine, 'Indikator: ' + Ind.get(cfg.indicator).name] },
      },
    });
  }

  // ---------- Diagramm ----------

  function setChart(on) {
    state.showChart = on;
    $('#chartDrawer').hidden = !on;
    setPressed($('#tgChart'), on);
    $('#tgChart').textContent = on ? 'pH-Kurve ausblenden' : 'pH-Kurve anzeigen';
    chart.dirty = true;
  }

  function updateChartData() {
    const exp = state.exp;
    if (!exp) return;
    const evalPhase = state.phase === 'evaluation';
    const cfg = state.config;
    let revealed = null;
    if ((evalPhase && state.revealEq) || state.teacher) {
      const j = jumpRegion();
      revealed = {
        v: Chem.equivalenceVolume(cfg),
        pH: Chem.equivalencePH(cfg),
        region: j.v0 !== null ? [j.v0, j.v1] : null,
        half: Chem.halfEquivalence(cfg),
      };
    }
    chart.setData({
      points: exp.points,
      current: exp.electrode && !evalPhase ? { v: exp.delivered, pH: exp.pH } : null,
      indicator: cfg.indicator,
      teacherCurve: state.teacher ? state.teacherCurve : null,
      revealedEq: revealed,
    });
  }

  // ---------- Auswertung ----------

  function fillEvaluation() {
    const cfg = state.config;
    const exp = state.exp;
    const sp = speciesOf(cfg.sampleType);
    const tp = speciesOf(Chem.counterpart(cfg.sampleType));
    const ind = Ind.get(cfg.indicator);
    const rows = [
      ['Probelösung', sp.formula + ' (' + sp.name + ')'],
      ['V(Probelösung)', fmt(cfg.vSample, 2) + ' mL'],
      ['Maßlösung', tp.formula],
      ['c(Maßlösung)', fmt(cfg.cTitrant, 3) + ' mol/L'],
      ['sep'],
      ['Notierter Endpunkt', exp.endpoint !== null ? fmt(exp.endpoint, 2) + ' mL' : 'nicht notiert'],
      ['Verbrauch gesamt', fmt(exp.reading, 2) + ' mL'],
      ['Indikator', ind.name + (ind.range ? ' (pH ' + fmt(ind.range[0], 1) + '–' + fmt(ind.range[1], 1) + ')' : '')],
      ['Messpunkte (pH)', String(exp.points.length)],
    ];
    $('#formulaN').textContent = 'n(' + sp.formula + ') = n(' + tp.formula + ')';
    $('#evalFacts').innerHTML = rows.map(function (r) {
      return r[0] === 'sep' ? '<div class="sep"></div>' : '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
    }).join('');
    if (!$('#inVUsed').value && exp.endpoint !== null) $('#inVUsed').value = fmt(exp.endpoint, 2);
    $('#btnUseNoted').disabled = exp.endpoint === null;
    $('#btnUseMarker').disabled = !state.marker;
    $('#btnRevealEq').textContent = state.revealEq ? 'Theor. ÄP ausblenden' : 'Theor. ÄP einblenden';
    updateTeacherSolution();
  }

  /** Bewertung verwerfen, sobald sich eine Eingabe oder Messung ändert */
  function invalidateResult() {
    const box = $('#resultBox');
    if (!box.hidden) {
      box.hidden = true;
      box.innerHTML = '';
    }
  }

  /** Volumen aus dem Eingabefeld prüfen (gegen den tatsächlichen Verbrauch) */
  function readUsedVolume() {
    const vUsed = Cfg.parseDecimal($('#inVUsed').value);
    const res = Eval.validateUsedVolume(vUsed, state.exp.delivered);
    return { value: vUsed, ok: res.ok, message: res.message };
  }

  function checkResult() {
    const cfg = state.config;
    const used = readUsedVolume();
    const cStudent = Cfg.parseDecimal($('#inCStudent').value);
    let ok = true;
    setFieldError('vUsed', used.ok ? null : used.message);
    if (!used.ok) ok = false;
    if (!(cStudent > 0) || !Number.isFinite(cStudent)) {
      setFieldError('cStudent', 'Bitte eine positive Konzentration in mol/L eingeben (z. B. 0,0985).');
      ok = false;
    } else setFieldError('cStudent', null);
    if (!ok) { invalidateResult(); return; }

    const vEq = Chem.equivalenceVolume(cfg);
    const res = Eval.evaluate({
      cTitrant: cfg.cTitrant, vSample: cfg.vSample, vUsed: used.value, cStudent: cStudent, cTrue: cfg.cSample, vEquivalence: vEq,
    });
    state.revealEq = true;
    renderResult(res, used.value, vEq);
    fillEvaluation();
    updateLabels();
    updateTeacher();
  }

  /** Fachliche Erklärung zur Lage des Äquivalenzpunkts */
  function equivalenceExplanation(cfg) {
    const pHEq = Chem.equivalencePH(cfg);
    const half = Chem.halfEquivalence(cfg);
    const sp = speciesOf(cfg.sampleType);
    if (sp.strong) {
      return '<p>Am Äquivalenzpunkt liegt eine Natriumchlorid-Lösung vor. Na⁺- und Cl⁻-Ionen reagieren nicht mit Wasser; ' +
        'der pH-Wert ergibt sich aus der Autoprotolyse des Wassers: <b>pH = ' + fmt(pHEq, 2) + '</b>.</p>';
    }
    if (cfg.sampleType === 'weakAcid') {
      return '<p>Am Äquivalenzpunkt liegt eine Natriumacetat-Lösung vor. Acetat-Ionen sind eine schwache Base ' +
        '(CH₃COO⁻ + H₂O ⇌ CH₃COOH + OH⁻). Deshalb liegt der Äquivalenzpunkt im basischen Bereich: <b>pH = ' + fmt(pHEq, 2) + '</b>.</p>' +
        '<p>Am Halbäquivalenzpunkt (V = ' + fmt(half.v, 2) + ' mL) gilt c(CH₃COOH) ≈ c(CH₃COO⁻) und damit pH ≈ pK<sub>S</sub> ' +
        '(Modell: pH ' + fmt(half.pH, 2) + ', pK<sub>S</sub> = ' + fmt(half.pKa, 2) + '). Um diesen Punkt liegt der Pufferbereich.</p>';
    }
    return '<p>Am Äquivalenzpunkt liegt eine Ammoniumchlorid-Lösung vor. Ammonium-Ionen sind eine schwache Säure ' +
      '(NH₄⁺ + H₂O ⇌ NH₃ + H₃O⁺). Deshalb liegt der Äquivalenzpunkt im sauren Bereich: <b>pH = ' + fmt(pHEq, 2) + '</b>.</p>' +
      '<p>Am Halbäquivalenzpunkt (V = ' + fmt(half.v, 2) + ' mL) gilt c(NH₃) ≈ c(NH₄⁺) und damit pH ≈ pK<sub>S</sub>(NH₄⁺) ' +
      '(Modell: pH ' + fmt(half.pH, 2) + ', pK<sub>S</sub> = ' + fmt(half.pKa, 2) + '). Um diesen Punkt liegt der Pufferbereich.</p>';
  }

  /** pH-Bereich des Sprungs (aufsteigend sortiert) */
  function jumpRange() {
    const j = jumpRegion();
    return [Math.min(j.pH0, j.pH1), Math.max(j.pH0, j.pH1)];
  }

  /**
   * Kurzbewertung des Indikators: Passt sein Umschlag zum pH-Sprung dieser Titration?
   * @returns {{cls:string, text:string, detail:string}|null}
   */
  function indicatorCheck(cfg) {
    const ind = Ind.get(cfg.indicator);
    if (ind.endpointPH === null) return null;
    const suit = Eval.indicatorSuitability(cfg, ind.endpointPH);
    const jr = jumpRange();
    const pHEq = Chem.equivalencePH(cfg);
    const better = Ind.list().filter(function (x) {
      if (x.endpointPH === null || x.id === ind.id) return false;
      const s = Eval.indicatorSuitability(cfg, x.endpointPH);
      return s && s.key === 'suitable';
    }).map(function (x) { return x.name; });
    const range = 'Umschlag pH ' + fmt(ind.range[0], 1) + '–' + fmt(ind.range[1], 1);
    const jump = 'pH-Sprung dieser Titration ≈ pH ' + fmt(jr[0], 1) + '–' + fmt(jr[1], 1) + ', ÄP bei pH ' + fmt(pHEq, 2);
    let text;
    let cls;
    if (suit.key === 'suitable') {
      cls = 'ok';
      text = ind.name + ' passt: Der Umschlag liegt im pH-Sprung.';
    } else if (suit.key === 'limited') {
      cls = 'warn';
      text = ind.name + ' passt nur bedingt: Der Umschlag liegt am Rand des pH-Sprungs.';
    } else {
      cls = 'bad';
      text = ind.name + ' passt nicht: Der Umschlag liegt außerhalb des pH-Sprungs.';
    }
    if (cls !== 'ok' && better.length) text += ' Besser: ' + better.join(' oder ') + '.';
    let detail = range + ' · ' + jump + '.';
    if (suit.vEndpoint !== null) {
      detail += ' Mit dem Modellkriterium Endpunkt bei pH ' + fmt(ind.endpointPH, 1) + ' schlägt ' + ind.name +
        ' bei ' + fmt(suit.vEndpoint, 2) + ' mL um (Indikatorfehler ' + signed(suit.error, 2) + ' mL, ' +
        signed(suit.error / Chem.equivalenceVolume(cfg) * 100, 1) + ' %).';
    } else {
      detail += ' Der Umschlags-pH (Modellkriterium pH ' + fmt(ind.endpointPH, 1) + ') wird bei dieser Titration nie erreicht.';
    }
    return { cls: cls, text: text, detail: detail };
  }

  /** Auswertung der Messkurve: ÄP nur, wenn der Sprung erfasst wurde */
  function curveAnalysis(cfg, points) {
    return Chem.equivalenceFromData(points, Chem.titrationDirection(cfg.sampleType));
  }

  function renderResult(res, vUsed, vEq) {
    const cfg = state.config;
    const exp = state.exp;
    const sp = speciesOf(cfg.sampleType);
    const tp = speciesOf(Chem.counterpart(cfg.sampleType));
    const nT = cfg.cTitrant * vUsed; // mmol
    const dv = vUsed - vEq;
    const tol = fmt(Eval.CALC_TOLERANCE_PCT, 0);

    // 1) Rechnung
    const calcRow = res.calculationCorrect
      ? check('ok', 'Rechnung', 'stimmt: Aus V = ' + fmt(vUsed, 2) + ' mL folgt c = ' + fmt(res.cFromVolume, 4) + ' mol/L (Toleranz ±' + tol + ' %).')
      : check('bad', 'Rechnung', 'stimmt nicht. ' + res.calcHints.join(' '));
    // 2) Indikator
    const ic = indicatorCheck(cfg);
    const indRow = ic ? check(ic.cls, 'Indikator', ic.text) : check('warn', 'Indikator', 'Ohne Indikator ist der Endpunkt nur über die pH-Kurve bestimmbar.');
    // 3) Genauigkeit
    const accCls = res.rating.key === 'excellent' || res.rating.key === 'good' ? 'ok' : res.rating.key === 'ok' ? 'warn' : 'bad';
    const accRow = check(accCls, 'Ergebnis', 'korrekter Wert ' + fmt(res.cTrue, 4) + ' mol/L, Abweichung ' + signed(res.deviationPct, 2) + ' %.');
    // 4) Endpunkt vs. Äquivalenzpunkt
    const epRow = check('info', 'Endpunkt', 'dein Volumen ' + fmt(vUsed, 2) + ' mL, Äquivalenzpunkt ' + fmt(vEq, 2) +
      ' mL (ΔV ' + signed(dv, 2) + ' mL).');

    // Ausführlicher Teil
    const curve = curveAnalysis(cfg, exp.points);
    let curveText;
    if (!exp.points.length) curveText = '<p>Es wurden keine pH-Messwerte aufgezeichnet.</p>';
    else if (curve.ok) {
      curveText = '<p>Aus der Messkurve: steilste Stelle zwischen ' + fmt(curve.interval[0], 2) + ' und ' + fmt(curve.interval[1], 2) +
        ' mL – Äquivalenzpunkt aus der Kurve ≈ ' + fmt(curve.v, 2) + ' mL.</p>';
    } else {
      curveText = '<p>Aus der Messkurve lässt sich kein Äquivalenzpunkt bestimmen: ' + curve.reason + '</p>';
    }
    if (state.marker) {
      curveText += '<p>Dein markierter Äquivalenzpunkt: ' + fmt(state.marker.v, 2) + ' mL (Δ = ' +
        signed(state.marker.v - vEq, 2) + ' mL zum theoretischen Wert).</p>';
    }

    const details =
      '<details class="more"' + (state.teacher ? ' open' : '') + '><summary>Ausführliche Erklärung</summary>' +
      '<p><b>Rechenweg mit deinen Messwerten</b></p>' +
      '<div class="calc">' +
      'n(' + tp.formula + ', zugegeben) = c · V = ' + fmt(cfg.cTitrant, 3) + ' mol/L · ' + fmt(vUsed / 1000, 5) + ' L = ' + fmt(nT, 4) + ' mmol<br>' +
      'n(' + sp.formula + ', vorgelegt) = n(' + tp.formula + ', zugegeben) = ' + fmt(nT, 4) + ' mmol &nbsp;(1 : 1)<br>' +
      'c(' + sp.formula + ') = n / V = ' + fmt(nT, 4) + ' mmol / ' + fmt(cfg.vSample, 2) + ' mL = ' + fmt(res.cFromVolume, 4) + ' mol/L' +
      '</div>' +
      '<p><b>Äquivalenzpunkt und Endpunkt.</b> Am <i>Äquivalenzpunkt</i> ist die zugegebene Stoffmenge der Maßlösung gleich der ' +
      'vorgelegten Stoffmenge der Probe: n(' + sp.formula + ', vorgelegt) = n(' + tp.formula + ', zugegeben); hier bei ' + fmt(vEq, 2) +
      ' mL. Der <i>Endpunkt</i> ist das Volumen, bei dem du die Titration beendet hast (Farbumschlag oder Kurvenmarkierung). ' +
      'Beide stimmen nicht automatisch überein.</p>' +
      equivalenceExplanation(cfg) +
      (ic ? '<p><b>Indikator.</b> ' + ic.detail + '</p>' : '') +
      curveText +
      '</details>';

    const box = $('#resultBox');
    box.className = 'result ' + res.rating.key;
    box.innerHTML =
      '<span class="rating">Genauigkeit: ' + res.rating.label + '</span>' +
      '<h3>Dein Ergebnis: <span class="big">' + fmt(res.cStudent, 4) + '</span> mol/L</h3>' +
      '<ul class="checks">' + calcRow + indRow + accRow + epRow + '</ul>' +
      details;
    box.hidden = false;
    setTimeout(function () { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  function check(cls, title, text) {
    const icon = { ok: '✓', warn: '!', bad: '✗', info: 'i' }[cls];
    return '<li class="check ' + cls + '"><span class="check-icon" aria-hidden="true">' + icon + '</span>' +
      '<span><b>' + title + ':</b> ' + text + '</span></li>';
  }

  // ---------- Lehrkraftmodus ----------

  function cFromVolume(v) {
    return v !== null && v > 0 ? Chem.sampleConcentration(state.config.cTitrant, v, state.config.vSample) : null;
  }

  /** Musterlösung in der Berechnungskarte (nur Lehrkraftmodus, Auswertung) */
  function updateTeacherSolution() {
    const box = $('#teacherSolution');
    const show = state.teacher && state.phase === 'evaluation' && state.config;
    box.hidden = !show;
    if (!show) return;
    const cfg = state.config;
    const exp = state.exp;
    const sp = speciesOf(cfg.sampleType);
    const used = readUsedVolume();
    const curve = curveAnalysis(cfg, exp.points);
    const lines = [];
    if (used.ok) lines.push('mit eingetragenem V = ' + fmt(used.value, 2) + ' mL: c = <b>' + fmt(cFromVolume(used.value), 4) + ' mol/L</b>');
    if (exp.endpoint !== null) lines.push('mit notiertem Endpunkt ' + fmt(exp.endpoint, 2) + ' mL: c = ' + fmt(cFromVolume(exp.endpoint), 4) + ' mol/L');
    if (curve.ok) lines.push('mit ÄP aus der Messkurve ' + fmt(curve.v, 2) + ' mL: c = ' + fmt(cFromVolume(curve.v), 4) + ' mol/L');
    else if (exp.points.length) lines.push('Messkurve: ' + curve.reason);
    lines.push('wahrer Wert: c(' + sp.formula + ') = <b>' + fmt(cfg.cSample, 4) + ' mol/L</b> (V<sub>ÄP</sub> = ' +
      fmt(Chem.equivalenceVolume(cfg), 2) + ' mL, pH<sub>ÄP</sub> = ' + fmt(Chem.equivalencePH(cfg), 2) + ')');
    box.innerHTML = '<b>Lösung für die Lehrkraft</b><div class="calc">' + lines.join('<br>') + '</div>';
  }

  function updateTeacher() {
    const on = state.teacher;
    $('#teacherCard').hidden = !on;
    $('#teacherBadge').hidden = !on;
    $$('.mode-btn').forEach(function (b) { b.classList.toggle('is-active', (b.dataset.mode === 'teacher') === on); });
    updateTeacherSolution();
    if (!on || !state.config) return;
    const cfg = state.config;
    const exp = state.exp;
    const ind = Ind.get(cfg.indicator);
    const st = exp.state;
    const vEq = Chem.equivalenceVolume(cfg);
    const unknown = state.phase === 'setup' && state.setup.cMode === 'hidden';
    const suit = Eval.indicatorSuitability(cfg, ind.endpointPH);
    const curve = curveAnalysis(cfg, exp.points);
    const sp = st.species;
    const rows = [
      ['c(Probelösung)', unknown ? 'wird beim Start erzeugt' : fmt(cfg.cSample, 4) + ' mol/L'],
      ['Theor. Äquivalenzpunkt', unknown ? '–' : fmt(vEq, 3) + ' mL'],
      ['pH am Äquivalenzpunkt', fmt(Chem.equivalencePH(cfg), 2)],
      ['Indikator-Endpunkt (Modellkriterium)', !unknown && suit && suit.vEndpoint !== null ? fmt(suit.vEndpoint, 3) + ' mL (pH ' + fmt(ind.endpointPH, 1) + ')' : '–'],
      ['Indikator', suit ? '<span class="suit-' + suit.key + '">' + suit.label + '</span>' : '–'],
      ['sep'],
      ['Ergebnis (notierter Endpunkt)', exp.endpoint !== null ? fmt(cFromVolume(exp.endpoint), 4) + ' mol/L' : '–'],
      ['Ergebnis (ÄP aus Messkurve)', curve.ok && !unknown ? fmt(cFromVolume(curve.v), 4) + ' mol/L' : 'Sprung nicht erfasst'],
      ['sep'],
      ['V im Kolben angekommen', fmt(exp.delivered, 3) + ' mL'],
      ['pH (Modell)', fmt(st.pH, 3)],
      ['c(H₃O⁺)', st.cH3O.toExponential(3).replace('.', ',') + ' mol/L'],
      ['c(OH⁻)', st.cOH.toExponential(3).replace('.', ',') + ' mol/L'],
    ];
    if (sp.cHA !== undefined) {
      rows.push(['c(CH₃COOH) / c(CH₃COO⁻)', sp.cHA.toExponential(2).replace('.', ',') + ' / ' + sp.cA.toExponential(2).replace('.', ',')]);
    }
    if (sp.cB !== undefined) {
      rows.push(['c(NH₃) / c(NH₄⁺)', sp.cB.toExponential(2).replace('.', ',') + ' / ' + sp.cBH.toExponential(2).replace('.', ',')]);
    }
    rows.push(['n(Säure) / n(Base)', fmt(st.nAcid, 4) + ' / ' + fmt(st.nBase, 4) + ' mmol']);
    rows.push(['Neutralisationsgrad τ', fmt(st.neutralization, 3)]);
    $('#teacherFacts').innerHTML = rows.map(function (r) {
      return r[0] === 'sep' ? '<div class="sep"></div>' : '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
    }).join('');
  }

  function setTeacher(on) {
    state.teacher = on;
    renderer.setOptions({ teacher: on });
    updateLabels();
    updateTeacher();
    chart.dirty = true;
  }

  // ---------- Live-Anzeigen ----------

  const lastRO = {};
  function updateReadouts() {
    const exp = state.exp;
    if (!exp) return;
    const vol = fmt(exp.reading, 2);
    if (lastRO.vol !== vol) {
      $('#roVolume').textContent = vol;
      $('#roRemaining').textContent = 'Rest: ' + fmt(exp.remaining, 2) + ' mL';
      lastRO.vol = vol;
    }
    let ph;
    let sub;
    if (!exp.electrode) { ph = '–'; sub = 'Elektrode nicht eingesetzt'; }
    else if (!state.meterDisplay) { ph = 'aus'; sub = 'Anzeige ausgeschaltet'; }
    else { ph = fmt(exp.pH, 2); sub = '25 °C · Glaselektrode'; }
    if (lastRO.ph !== ph) {
      $('#roPH').textContent = ph;
      $('#roPhBox').classList.toggle('off', ph === '–' || ph === 'aus');
      $('#roPhSub').textContent = sub;
      lastRO.ph = ph;
    }
    const valveOpen = exp.valveOpen;
    if (lastRO.valve !== valveOpen) { syncValveButton(); lastRO.valve = valveOpen; }
  }

  // ---------- Verschiebbare Trennleiste ----------

  function setPanelWidth(w, save) {
    const main = $('.main').getBoundingClientRect();
    const max = Math.max(320, Math.min(680, main.width - 420));
    const width = Math.round(Math.min(max, Math.max(300, w)));
    document.documentElement.style.setProperty('--panel-w', width + 'px');
    $('#splitter').setAttribute('aria-valuenow', String(width));
    if (save) {
      try { global.localStorage.setItem(PANEL_KEY, String(width)); } catch (e) { /* ohne Speicher */ }
    }
  }

  function bindSplitter() {
    const sp = $('#splitter');
    let dragging = false;
    sp.addEventListener('pointerdown', function (e) {
      dragging = true;
      sp.classList.add('is-dragging');
      document.body.classList.add('is-resizing');
      try { sp.setPointerCapture(e.pointerId); } catch (err) { /* ignorieren */ }
      e.preventDefault();
    });
    sp.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const main = $('.main').getBoundingClientRect();
      setPanelWidth(main.right - e.clientX - 6, false);
    });
    const end = function () {
      if (!dragging) return;
      dragging = false;
      sp.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing');
      const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w'));
      if (cur) setPanelWidth(cur, true);
    };
    sp.addEventListener('pointerup', end);
    sp.addEventListener('pointercancel', end);
    sp.addEventListener('dblclick', function () {
      document.documentElement.style.removeProperty('--panel-w');
      try { global.localStorage.removeItem(PANEL_KEY); } catch (e) { /* ohne Speicher */ }
    });
    sp.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const cur = $('.panel').getBoundingClientRect().width;
      setPanelWidth(cur + (e.key === 'ArrowLeft' ? 24 : -24), true);
    });
    let saved = null;
    try { saved = parseFloat(global.localStorage.getItem(PANEL_KEY)); } catch (e) { /* ohne Speicher */ }
    if (saved) setPanelWidth(saved, false);
  }

  // ---------- Initialisierung ----------

  const renderer = new NS.LabRenderer($('#labCanvas'));
  const chart = new NS.TitrationChart($('#chartCanvas'), {
    onCursor: function (pt) {
      $('#chartFoot').textContent = 'Messpunkt: V = ' + fmt(pt.v, 2) + ' mL · pH = ' + fmt(pt.pH, 2);
    },
    onMarker: function (m) {
      state.marker = m;
      $('#chartFoot').textContent = 'Markierter Äquivalenzpunkt: V = ' + fmt(m.v, 2) + ' mL · pH ≈ ' + fmt(m.pH, 2) +
        (state.phase === 'evaluation' ? ' – mit „Markierten ÄP übernehmen“ in die Rechnung übernehmen.' : '');
      $('#btnUseMarker').disabled = false;
      invalidateResult();
    },
  });

  function bind() {
    // Vorbereitung
    $$('[data-sample]').forEach(function (b) {
      b.addEventListener('click', function () { state.setup.sampleType = b.dataset.sample; updateSetup(); });
    });
    $$('[data-cmode]').forEach(function (b) {
      b.addEventListener('click', function () { state.setup.cMode = b.dataset.cmode; updateSetup(); });
    });
    ['#inVSample', '#inCSample', '#inCTitrant'].forEach(function (id) {
      $(id).addEventListener('input', updateSetup);
    });
    $$('[data-nudge]').forEach(function (b) {
      b.addEventListener('click', function () {
        const cur = Cfg.parseDecimal($('#inVSample').value);
        const base = Number.isFinite(cur) ? cur : 25;
        const step = Number(b.dataset.delta);
        let v = Math.round((base + step) / 5) * 5;
        v = Math.min(Cfg.LIMITS.vSample.max, Math.max(Cfg.LIMITS.vSample.min, v));
        $('#inVSample').value = fmt(v, 2);
        updateSetup();
      });
    });
    $('#optElectrode').addEventListener('change', function (e) { state.setup.electrode = e.target.checked; updateSetup(); });
    $('#optStirrer').addEventListener('change', function (e) { state.setup.stirrer = e.target.checked; updateSetup(); });
    $('#btnStart').addEventListener('click', function () { startExperiment(false); });

    // Durchführung
    $('#btnValve').addEventListener('click', toggleValve);
    $('#inRate').addEventListener('input', function (e) {
      const q = rateFromSlider(Number(e.target.value));
      $('#rateLabel').textContent = rateText(q);
      if (state.exp) state.exp.setFlowRate(q);
    });
    $('#btnEndpoint').addEventListener('click', function () {
      // Hahn wird geschlossen; notiert wird, sobald der letzte Tropfen angekommen ist (Ereignis 'endpoint')
      const v = state.exp.noteEndpoint();
      syncValveButton();
      if (v === null) $('#endpointNote').textContent = 'Hahn geschlossen – der Endpunkt wird notiert, sobald der letzte Tropfen angekommen ist …';
    });
    $('#tgChart').addEventListener('click', function () {
      const on = !state.showChart;
      if (on && !state.exp.electrode) {
        state.exp.setElectrode(true);
        state.setup.electrode = true;
        $('#optElectrode').checked = true;
        renderer.setOptions({ electrode: true });
        setPressed($('#tgElectrode'), true);
        toast('pH-Elektrode eingesetzt – die Kurve wird ab jetzt aufgezeichnet.', 'ok');
      }
      setChart(on);
    });
    $('#tgElectrode').addEventListener('click', function () {
      const on = !state.exp.electrode;
      state.exp.setElectrode(on);
      state.setup.electrode = on;
      $('#optElectrode').checked = on;
      renderer.setOptions({ electrode: on });
      setPressed($('#tgElectrode'), on);
      if (!on && state.showChart) toast('Ohne Elektrode werden keine neuen Messpunkte aufgezeichnet.', 'warn');
    });
    $('#tgStirrer').addEventListener('click', toggleStirrer);
    $('#tgDisplay').addEventListener('click', toggleMeterDisplay);
    $('#tgLens').addEventListener('click', function () {
      state.lens = !state.lens;
      renderer.setOptions({ magnifier: state.lens });
      setPressed($('#tgLens'), state.lens);
    });
    $('#btnRestart').addEventListener('click', function () {
      if (state.exp.reading > 0 && !global.confirm('Bürette neu befüllen und eine neue Probe derselben Lösung vorlegen?')) return;
      startExperiment(true);
      toast('Neue Probe vorgelegt, Bürette auf 0,00 mL befüllt.', 'ok');
    });
    $('#btnToEval').addEventListener('click', function () {
      if (state.exp.reading <= 0) { toast('Es wurde noch keine Maßlösung zugegeben.', 'warn'); return; }
      goToEvaluation();
    });

    // Auswertung: jede Änderung macht eine alte Bewertung ungültig
    $('#inVUsed').addEventListener('input', function () {
      invalidateResult();
      setFieldError('vUsed', null);
      updateTeacherSolution();
    });
    $('#inCStudent').addEventListener('input', function () {
      invalidateResult();
      setFieldError('cStudent', null);
    });
    $('#btnUseNoted').addEventListener('click', function () {
      if (state.exp.endpoint === null) return;
      $('#inVUsed').value = fmt(state.exp.endpoint, 2);
      invalidateResult();
      updateTeacherSolution();
    });
    $('#btnUseMarker').addEventListener('click', function () {
      if (!state.marker) return;
      $('#inVUsed').value = fmt(state.marker.v, 2);
      invalidateResult();
      updateTeacherSolution();
    });
    $('#btnCheck').addEventListener('click', checkResult);
    $('#inCStudent').addEventListener('keydown', function (e) { if (e.key === 'Enter') checkResult(); });
    $('#btnRevealEq').addEventListener('click', function () {
      state.revealEq = !state.revealEq;
      fillEvaluation();
      updateLabels();
    });
    $('#btnRepeat').addEventListener('click', function () { startExperiment(true); });
    $('#btnNew').addEventListener('click', function () { setPhase('setup'); updateSetup(); });

    // Diagramm
    $$('[data-chartmode]').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-chartmode]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
        chart.setMode(b.dataset.chartmode);
        $('#chartFoot').textContent = b.dataset.chartmode === 'mark'
          ? 'Tippe bzw. ziehe auf die Stelle, an der du den Äquivalenzpunkt vermutest (Mitte des steilen pH-Sprungs).'
          : 'Tippe auf die Kurve, um Messpunkte abzulesen.';
      });
    });
    $('#btnDerivative').addEventListener('click', function (e) {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      setPressed(e.currentTarget, on);
      chart.setDerivative(on);
    });
    $('#btnZoomIn').addEventListener('click', function () { chart.zoomBy(0.5); });
    $('#btnZoomOut').addEventListener('click', function () { chart.zoomBy(2); });
    $('#btnZoomReset').addEventListener('click', function () { chart.zoomReset(); });

    // Kopfzeile
    $$('.step').forEach(function (b) {
      b.addEventListener('click', function () {
        const target = b.dataset.step;
        if (target === state.phase) return;
        if (target === 'setup') {
          if (state.phase !== 'setup' && state.exp && state.exp.reading > 0 &&
            !global.confirm('Zur Vorbereitung zurückkehren? Der laufende Versuch wird verworfen.')) return;
          if (state.exp) state.exp.closeValve();
          setPhase('setup');
          updateSetup();
        } else if (target === 'titration' && state.phase === 'evaluation') {
          setPhase('titration');
        } else if (target === 'evaluation' && state.phase === 'titration') {
          if (state.exp.reading <= 0) { toast('Es wurde noch keine Maßlösung zugegeben.', 'warn'); return; }
          goToEvaluation();
        }
      });
    });
    $$('.mode-btn').forEach(function (b) {
      b.addEventListener('click', function () { setTeacher(b.dataset.mode === 'teacher'); });
    });

    // Hilfe: Der Hahn wird beim Öffnen geschlossen und bleibt danach geschlossen
    const closeHelp = function () { $('#helpModal').hidden = true; $('#helpValveNote').hidden = true; };
    $('#btnHelp').addEventListener('click', function () {
      if (closeValveForInterruption()) $('#helpValveNote').hidden = false;
      $('#helpModal').hidden = false;
      $('#btnHelpClose').focus();
    });
    $('#btnHelpClose').addEventListener('click', closeHelp);
    $('#helpModal').addEventListener('click', function (e) { if (e.target.id === 'helpModal') closeHelp(); });

    // Laborfläche: Hahn, Rührer und pH-Meter direkt antippen
    $('#labCanvas').addEventListener('pointerdown', function (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const hit = renderer.hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit === 'stopcock') { toggleValve(); e.preventDefault(); }
      else if (hit === 'stirrer') { toggleStirrer(); e.preventDefault(); }
      else if (hit === 'meter') { toggleMeterDisplay(); e.preventDefault(); }
    });
    $('#labCanvas').addEventListener('pointermove', function (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const hit = renderer.hitTest(e.clientX - rect.left, e.clientY - rect.top);
      e.currentTarget.style.cursor = hit ? 'pointer' : 'default';
    });

    // Tastatur
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#helpModal').hidden) { closeHelp(); return; }
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      // Leertaste auf einem fokussierten Button oder der Trennleiste löst bereits deren Aktion aus
      if (e.code === 'Space' && e.target && (e.target.tagName === 'BUTTON' || e.target.id === 'splitter')) return;
      if (state.phase !== 'titration' || !$('#helpModal').hidden) return;
      if (e.code === 'Space') { e.preventDefault(); toggleValve(); }
    });

    // Seite verborgen (Tab-Wechsel, App-Wechsel, Bildschirmsperre): Hahn schließen
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && closeValveForInterruption()) {
        state.valveClosedWhileHidden = true;
      } else if (!document.hidden && state.valveClosedWhileHidden) {
        state.valveClosedWhileHidden = false;
        toast('Der Bürettenhahn wurde geschlossen, während die Seite nicht sichtbar war.', 'warn', 4000);
      }
    });
    global.addEventListener('pagehide', closeValveForInterruption);

    bindSplitter();
  }

  /** Schließt den Hahn bei einer Unterbrechung. Liefert true, wenn er offen war. */
  function closeValveForInterruption() {
    const exp = state.exp;
    if (!exp || state.phase !== 'titration' || !exp.isFlowing) return false;
    exp.closeValve();
    syncValveButton();
    return true;
  }

  // ---------- Hauptschleife ----------

  let lastT = performance.now();
  let teacherTimer = 0;
  function loop(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    // Ein Fehler in einem einzelnen Frame darf die Animation nicht dauerhaft anhalten
    try {
      frame(state.exp, dt);
    } catch (err) {
      if (global.console) console.error(err);
    }
    global.requestAnimationFrame(loop);
  }

  function frame(exp, dt) {
    if (!exp) return;
    if (state.phase !== 'setup') exp.update(dt);
    renderer.setOptions({ hintStopcock: state.phase === 'titration' && !state.valveUsed });
    renderer.frame(dt);
    if (state.phase !== 'setup') updateReadouts();
    if (state.showChart) {
      updateChartData();
      chart.draw();
    }
    teacherTimer += dt;
    if (state.teacher && teacherTimer > 0.25) { teacherTimer = 0; updateTeacher(); }
  }

  buildIndicatorList();
  bind();
  $('#rateLabel').textContent = rateText(rateFromSlider(Number($('#inRate').value)));
  setPhase('setup');
  updateSetup();
  global.requestAnimationFrame(loop);

  // Offline-Nutzung nach dem ersten Laden (nur über http/https möglich)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  }

  // Für Konsole und automatisierte Browsertests
  NS.app = { state: state, renderer: renderer, chart: chart, setPhase: setPhase, startExperiment: startExperiment, tick: function (dt) { frame(state.exp, dt); } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
