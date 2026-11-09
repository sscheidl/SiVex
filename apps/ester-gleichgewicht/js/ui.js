/*
 * Estergleichgewicht – Oberfläche (DOM)
 *
 * Stoffebene (Kolben, Mengenbalken) und Teilchenebene (Kasten) nebeneinander, darunter
 * das Diagramm n(t), das Balkenpaar der Teilchenebene und die Q/K-Anzeige mit MWG.
 * Bedienfeld: Versuch · Aufgabe · Tabelle · Modell · Hefteintrag. Zeitsteuerung nach G8:
 * Schritt (1 Tag bzw. 1 h), Start/Pause, Tempo, Neu starten; Katalysator umschaltbar.
 */
(function (root) {
  'use strict';
  const { core, splitter, learn, chart } = root.LK;
  const M = root.EG.model, P = root.EG.particles, T = root.EG.tasks;
  const { MatterRenderer, ParticleRenderer, drawParticle, SUB } = root.EG.render;
  const $ = (s) => document.querySelector(s);
  const esc = learn.esc;
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const STORE = 'sivex-ester-v1';
  const DAYS_PER_SEC = 0.5;          // 1×: 1 Tag je 2 s ohne Katalysator
  const DAYS_PER_SEC_CAT = 1 / 48;   // 1×: 1 Stunde je 2 s mit Katalysator
  const mol = (v) => core.fmt(v, 2) + ' mol';

  function initialUi() {
    return { tab: 'experiment', step: 'observe', panel: true, running: false, speed: 1, view: 'both', steps: learn.freshState(T.STEPS), table: {} };
  }

  function createUI() {
    let saved = null;
    try { saved = JSON.parse(root.sessionStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    const model = M.createModel();
    if (saved && saved.model) model.restore(saved.model);
    const ui = Object.assign(initialUi(), saved && saved.ui ? saved.ui : {});
    ui.running = false;
    const matterR = new MatterRenderer($('#matter'), model);
    const partR = new ParticleRenderer($('#particles'));
    let sys = P.createSystem(20261109);
    sys.init(model.state.n); sys.state.catalyst = model.state.catalyst;
    partR.setSystem(sys);
    const ch = chart.createChart($('#chart'), { xLabel: 'Zeit in Tagen', yLabel: 'Stoffmenge in mol', yMin: 0, yMax: 1, xMinSpan: 12, xFmt: (v) => core.fmt(v, 0), yFmt: (v) => core.fmt(v, 2) });
    const bars = chart.createBars($('#bars'), { title: 'erfolgreiche Stöße pro 10 s', labels: ['hin', 'zurück'], decimals: 0 });

    let saveTimer = null;
    function saveNow() { clearTimeout(saveTimer); try { root.sessionStorage.setItem(STORE, JSON.stringify({ model: model.snapshot(), ui })); } catch (e) { /* ohne Speicher */ } }
    function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
    root.addEventListener('pagehide', saveNow);
    root.addEventListener('beforeunload', saveNow);

    // ------------------------------------------------------------ Zeitsteuerung
    const stepDays = () => (model.state.catalyst ? 1 / 24 : 1);
    function step() { ui.running = false; model.advance(stepDays()); for (let i = 0; i < 10; i++) sys.advance(0.1); afterAdvance(); syncControls(); save(); }
    function toggleRun() { ui.running = !ui.running; syncControls(); save(); }
    function restart(preset, n) {
      ui.running = false;
      model.reset(preset, n);
      sys = P.createSystem((Date.now() % 100000) + 7); sys.init(model.state.n); sys.state.catalyst = model.state.catalyst; partR.setSystem(sys); partR.resize();
      qSig = ''; syncControls(); renderPanel(true); save();
    }
    function setCatalyst(on) { model.setCatalyst(on); sys.state.catalyst = !!on; qSig = ''; syncControls(); save(); }
    $('#btnStep').addEventListener('click', step);
    $('#btnRun').addEventListener('click', toggleRun);
    $('#btnRestart').addEventListener('click', () => restart(model.state.preset === 'eigen' ? null : model.state.preset, model.state.preset === 'eigen' ? model.state.start : null));
    $('#btnCat').addEventListener('click', () => setCatalyst(!model.state.catalyst));
    $('#speed').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (b) { ui.speed = Number(b.dataset.speed); syncControls(); save(); } });
    $('#views').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { ui.view = b.dataset.view; syncControls(); onResize(); save(); } });

    $('#btnNotebook').addEventListener('click', () => { ui.panel = true; ui.tab = 'notebook'; syncControls(); renderPanel(true); $('#panel').scrollTop = 0; save(); });
    $('#btnPanel').addEventListener('click', () => { ui.panel = !ui.panel; syncControls(); onResize(); save(); });
    document.querySelector('.lk-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      ui.tab = b.dataset.tab; syncControls(); renderPanel(true); $('#panel').scrollTop = 0; save();
    });

    function syncControls() {
      const s = model.state;
      $('#btnRun').textContent = ui.running ? 'Pause' : 'Start';
      $('#btnRun').setAttribute('aria-pressed', String(ui.running));
      $('#btnStep').textContent = s.catalyst ? '1 Stunde' : '1 Tag';
      $('#btnCat').setAttribute('aria-pressed', String(!!s.catalyst));
      $('#btnCat').textContent = s.catalyst ? 'Katalysator: an' : 'Katalysator: aus';
      document.querySelectorAll('#speed [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === ui.speed)));
      document.querySelectorAll('#views [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === ui.view)));
      $('#matterWrap').hidden = ui.view === 'particles';
      $('#particleWrap').hidden = ui.view === 'matter';
      $('#btnPanel').setAttribute('aria-expanded', String(ui.panel));
      $('#main').classList.toggle('panel-hidden', !ui.panel);
      document.querySelectorAll('.lk-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
      renderLegend();
      renderQ();
    }
    let legendDone = false;
    function renderLegend() {
      if (legendDone) return;
      legendDone = true;
      const el = $('#legend');
      el.innerHTML = SUB.map((s, i) => `<span class="sym"><canvas width="44" height="30" data-t="${i}" aria-hidden="true"></canvas><span>${esc(s.short)}</span></span>`).join('') + '<span class="note">schematisch – keine Molekülstrukturen</span>';
      el.querySelectorAll('canvas').forEach((c) => { const ctx = c.getContext('2d'); drawParticle(ctx, Number(c.dataset.t), 22, 15, 7); });
    }

    // ------------------------------------------------------------ Q/K-Anzeige, Diagramm, Tabelle
    let qSig = '', lastBars = 0;
    function renderQ() {
      const s = model.state, eq = s.eqTime != null;
      const sig = [s.history.length, eq, s.catalyst, s.preset].join('|');
      if (sig !== qSig) {
        qSig = sig;
        const Q = model.Q;
        $('#qbox').innerHTML = `<div class="qrow"><span class="qlab">Zeit</span><b>${core.fmt(model.tDisplay, s.catalyst ? 1 : 1)} ${s.catalyst ? 'h' : 'Tage'}</b></div>
          <div class="qrow"><span class="qlab">Q = <span class="frac"><span>n(Ester) · n(Wasser)</span><span>n(Säure) · n(Alkohol)</span></span></span><b>${isFinite(Q) ? core.fmt(Q, 2) : '–'}</b></div>
          <div class="qrow ${eq ? 'eq' : ''}"><span class="qlab">K</span><b>${core.fmt(model.K, 0)}</b></div>
          <div class="qnote">${eq ? '<b>Gleichgewicht:</b> Q = K, die Stoffmengen bleiben konstant.' : s.t > 0 ? 'Q nähert sich K.' : 'Starte die Reaktion.'}</div>`;
        const f = s.catalyst ? 24 : 1;
        ch.set({ xLabel: s.catalyst ? 'Zeit in Stunden' : 'Zeit in Tagen', xMinSpan: s.catalyst ? 6 : 12 });
        ch.setSeries([
          { id: 'S', label: 'Säure, Alkohol', color: chart.COLORS.left, points: s.history.map((p) => [p[0] * f, p[1]]) },
          { id: 'A', color: chart.COLORS.left, width: 1.2, dashed: true, points: s.history.map((p) => [p[0] * f, p[2]]) },
          { id: 'E', label: 'Ester, Wasser', color: chart.COLORS.right, points: s.history.map((p) => [p[0] * f, p[3]]) },
          { id: 'W', color: chart.COLORS.right, width: 1.2, dashed: true, points: s.history.map((p) => [p[0] * f, p[4]]) }
        ]);
        const eqv = model.equilibrium();
        ch.setRefs([{ y: eqv[2], color: '#8fb3e6' }, { y: eqv[0], color: '#e39a86' }]);
        const marks = s.marks.map((m, i) => ({ x: m.t * f, label: m.label, color: '#a8640a', row: i + 1 }));
        if (eq) marks.unshift({ x: s.eqTime * f, label: 'chemisches Gleichgewicht' });
        ch.setMarks(marks);
        ch.draw();
        // Gleichgewichtszustand für die Tabelle festhalten
        if (eq && s.preset !== 'eigen' && !ui.table[s.preset]) { ui.table[s.preset] = { start: s.start.slice(), eq: s.n.map((v) => core.round(v, 2)), days: core.round(s.eqTime, 1), catalyst: s.catalyst }; if (ui.tab === 'table') renderPanel(true); save(); }
        if (ui.tab === 'experiment' || ui.tab === 'table') updateNumbers();
      }
      const now = performance.now();
      if (now - lastBars > 200) { lastBars = now; const r = sys.rates(); bars.set(r.hin, r.rueck); bars.draw(); }
    }
    function afterAdvance() { renderQ(); }

    // ------------------------------------------------------------ Bedienfeld
    function experimentHtml() {
      const s = model.state;
      const btn = (k) => `<button type="button" class="lk-btn small${s.preset === k ? ' primary' : ''}" data-preset="${k}">${esc(M.PRESETS[k].label.split(':')[0])}</button>`;
      return `<div class="lk-card"><h2>Ansatz</h2>
        <div class="lk-row">${Object.keys(M.PRESETS).map(btn).join('')}</div>
        <p class="lk-muted small" style="margin-top:6px">${esc(s.preset === 'eigen' ? 'Eigene Stoffmengen' : M.PRESETS[s.preset].label)}</p>
        <details><summary>Eigene Stoffmengen (je 0 … 1 mol)</summary>
        ${M.SHORT.map((n, i) => `<label class="sl"><span>${esc(M.NAMES[i])}: <output id="n${i}Out">${core.fmt(s.start[i], 2)} mol</output></span><input type="range" id="n${i}" min="0" max="1" step="0.05" value="${s.start[i]}" aria-label="Startmenge ${esc(M.NAMES[i])} in mol"></label>`).join('')}
        <div class="lk-row"><button type="button" class="lk-btn primary" id="btnApplyStart">Neu starten mit diesen Mengen</button></div></details></div>
        <div class="lk-card"><h2>Katalysator</h2><p>Konzentrierte Schwefelsäure beschleunigt Hin- und Rückreaktion gleichermaßen (im Modell 50-fach). Ohne Katalysator rechnet die Simulation in Tagen, mit Katalysator in Stunden.</p>
        <div class="lk-row"><button type="button" class="lk-btn${s.catalyst ? ' primary' : ''}" id="btnCat2" aria-pressed="${!!s.catalyst}">${s.catalyst ? 'Katalysator entfernen' : 'Katalysator zugeben'}</button></div></div>
        <div class="lk-card"><h2>Ablesen</h2><table class="res"><tbody>${M.NAMES.map((n, i) => `<tr><td>${esc(n)}</td><td id="read${i}"></td></tr>`).join('')}
        <tr><td>Gleichgewicht erwartet (Ester)</td><td id="readEq"></td></tr></tbody></table></div>`;
    }
    function tableHtml() {
      const row = (label, arr, cls) => `<tr class="${cls || ''}"><td>${label}</td>${arr.map((v) => `<td>${core.fmt(v, 2)}</td>`).join('')}</tr>`;
      const block = (key, title) => {
        const e = ui.table[key], p = M.PRESETS[key];
        return row(`Start der <b>${title}</b>`, p.n, key) +
          (e ? row(`<b>Gleichgewicht</b> nach ${core.fmt(e.days, 0)} Tagen${e.catalyst ? ' (mit Katalysator)' : ''}`, e.eq, key) : `<tr class="${key}"><td><b>Gleichgewicht</b></td><td colspan="4" class="lk-muted">noch nicht gemessen – ${title} bis zum Gleichgewicht laufen lassen</td></tr>`);
      };
      return `<p class="lk-muted">Die Tabelle füllt sich, sobald ein Ansatz das Gleichgewicht erreicht hat. Angaben in mol.</p>
        <div class="lk-card"><div class="tscroll"><table class="res tab"><thead><tr><th>Estersynthese / Hydrolyse</th><th>Säure<br><small>H₃C–COOH</small></th><th>Alkohol<br><small>C₂H₅–OH</small></th><th>Ester<br><small>H₃C–COOC₂H₅</small></th><th>Wasser<br><small>H₂O</small></th></tr></thead>
        <tbody>${block('synthese', 'Synthese')}${block('hydrolyse', 'Hydrolyse')}</tbody></table></div></div>
        <div class="lk-card"><h3>Jetzt</h3><table class="res"><tbody>${M.NAMES.map((n, i) => `<tr><td>${esc(n)}</td><td id="read${i}"></td></tr>`).join('')}</tbody></table></div>`;
    }
    function updateNumbers() {
      const s = model.state;
      if (!$('#read0')) return;
      s.n.forEach((v, i) => { $('#read' + i).textContent = mol(v); });
      if ($('#readEq')) $('#readEq').textContent = mol(model.equilibrium()[2]);
    }
    function modelHtml() {
      const N = T.MODEL;
      return `<div class="lk-card"><h2>Zwei Ebenen, eine Reaktion</h2>
        ${N.levels.map(([a, b], i) => `<p><span class="lk-level ${i ? 'particles' : 'matter'}">${esc(a)}</span><br>${esc(b)}</p>`).join('')}
        <p class="lk-note info">Die glatte Kurve ist der Mittelwert über unvorstellbar viele Teilchen; die Teilchenansicht zeigt Einzelereignisse mit Zufall.</p></div>
        <div class="lk-card"><h3>Was die Simulation zeigt</h3><ul>${N.shows.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div class="lk-card"><h3>Was sie vereinfacht oder weglässt</h3><ul>${N.hides.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    }
    function notebookInner() {
      const N = T.NOTEBOOK;
      return `<h2>${esc(N.title)}</h2><ul>${N.points.map((p) => `<li>${md(p)}</li>`).join('')}</ul><span class="eq">${esc(N.equation)}</span><p>${esc(N.analogy)}</p>`;
    }
    function notebookHtml() {
      return `<div class="lk-notebook">${notebookInner()}</div>
        <p class="lk-muted" style="margin-top:8px">Zum Abschreiben ins Heft (etwa 5 Minuten). Der Hefteintrag hängt nicht von deinem Versuch ab. Rohfassung – wird mit Schritt 2 und 3 ergänzt.</p>
        <div class="lk-row"><button type="button" class="lk-btn" id="btnPrint">Hefteintrag drucken</button></div>`;
    }
    function printHtml() {
      return `<h1>Estergleichgewicht</h1><div class="lk-notebook">${notebookInner()}</div>
        <h2>Meine Messwerte</h2><table><thead><tr><th>Ansatz</th><th>Säure</th><th>Alkohol</th><th>Ester</th><th>Wasser</th></tr></thead><tbody>${['Synthese – Start', 'Synthese – Gleichgewicht', 'Hydrolyse – Start', 'Hydrolyse – Gleichgewicht'].map((c) => `<tr><td>${c}</td><td></td><td></td><td></td><td></td></tr>`).join('')}</tbody></table>
        <p style="font-size:9pt;color:#555">SiVex · Estergleichgewicht 0.1.0</p>`;
    }

    let panelSig = '';
    function renderPanel(force) {
      const sig = JSON.stringify([ui.tab, ui.step, ui.steps]);
      if (sig === panelSig && !force) return;
      panelSig = sig;
      const body = $('#panelBody');
      const top = $('#panel').scrollTop;
      body.setAttribute('aria-labelledby', 'tab-' + ui.tab);
      body.innerHTML = ui.tab === 'experiment' ? experimentHtml() : ui.tab === 'task' ? learn.taskHtml(T.STEPS, ui, { locked: T.locked, lockedText: T.LOCKED_TEXT }) : ui.tab === 'table' ? tableHtml() : ui.tab === 'model' ? modelHtml() : notebookHtml();
      updateNumbers();
      $('#panel').scrollTop = top;
    }
    learn.bindTask($('#panelBody'), { steps: T.STEPS, state: ui, render: () => renderPanel(true), save });
    $('#panelBody').addEventListener('input', (e) => {
      const el = e.target;
      if (/^n[0-3]$/.test(el.id)) $('#' + el.id + 'Out').textContent = mol(Number(el.value));
    });
    $('#panelBody').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.preset) restart(t.dataset.preset, null);
      if (t.id === 'btnApplyStart') restart(null, [0, 1, 2, 3].map((i) => Number($('#n' + i).value)));
      if (t.id === 'btnCat2') { setCatalyst(!model.state.catalyst); renderPanel(true); }
      if (t.id === 'btnPrint') { $('#printArea').innerHTML = printHtml(); root.print(); }
    });
    root.addEventListener('beforeprint', () => { if (!$('#printArea').innerHTML) $('#printArea').innerHTML = printHtml(); });

    function onResize() { matterR.resize(); partR.resize(); ch.draw(); bars.draw(); }
    const sp = splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex-ester-panel', minStage: 560, onChange: onResize });
    root.addEventListener('resize', onResize);
    if (root.ResizeObserver) new root.ResizeObserver(onResize).observe($('#viewrow'));

    // ------------------------------------------------------------ Zeitschleife
    const clock = core.createClock({ step: (h) => { sys.advance(h); if (ui.running) model.advance(h * (model.state.catalyst ? DAYS_PER_SEC_CAT : DAYS_PER_SEC)); } });
    let last = null, frames = 0;
    function loop(now) {
      const dt = last == null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      if (dt > 0) clock.advance(dt * ui.speed);
      if (ui.view !== 'particles') matterR.draw();
      if (ui.view !== 'matter') partR.draw();
      renderQ();
      frames++;
      root.requestAnimationFrame(loop);
    }

    syncControls();
    renderPanel(true);
    onResize();
    root.requestAnimationFrame(loop);
    return { model, ui, get sys() { return sys; }, chart: ch, bars, step, toggleRun, restart, setCatalyst, renderPanel, splitter: sp, save: saveNow, get frames() { return frames; } };
  }

  (root.EG = root.EG || {}).ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
