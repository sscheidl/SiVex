/*
 * Apfelkrieg – Oberfläche (DOM)
 *
 * Verbindet Modell, Bühne, Diagramm, Balkenpaar, Q/K-Anzeige und das Bedienfeld
 * (Reiter Versuch · Aufgabe · Modell · Hefteintrag). Zeitsteuerung nach G8:
 * Schritt (0,5 s), Start/Pause, Tempo, Neu starten / Nochmal würfeln.
 */
(function (root) {
  'use strict';
  const { core, splitter, learn, chart } = root.LK;
  const M = root.AK.model, T = root.AK.tasks;
  const { StageRenderer } = root.AK.render;
  const $ = (s) => document.querySelector(s);
  const esc = learn.esc;
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const STORE = 'sivex-apfelkrieg-v1';
  const pct = (p) => Math.round(p * 100) + ' %';

  function initialUi() { return { tab: 'experiment', step: 'observe', panel: true, running: false, speed: 1, steps: learn.freshState(T.STEPS) }; }

  function createUI() {
    let saved = null;
    try { saved = JSON.parse(root.sessionStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    const model = M.createModel();
    if (saved && saved.model) model.restore(saved.model);
    const ui = Object.assign(initialUi(), saved && saved.ui ? saved.ui : {});
    ui.running = false;
    const stage = new StageRenderer($('#stage-canvas'), model);
    const ch = chart.createChart($('#chart'), { xLabel: 'Zeit in s', yLabel: 'Anzahl Äpfel', yMin: 0, yMax: model.total, xMinSpan: 60, xFmt: (v) => String(Math.round(v)), yFmt: (v) => String(Math.round(v)) });
    const bars = chart.createBars($('#bars'), { title: 'Würfe pro 10 s', labels: ['→ Enkel', '→ Opa'], decimals: 0 });

    let saveTimer = null;
    function saveNow() { clearTimeout(saveTimer); try { root.sessionStorage.setItem(STORE, JSON.stringify({ model: model.snapshot(), ui })); } catch (e) { /* ohne Speicher */ } }
    function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
    root.addEventListener('pagehide', saveNow);
    root.addEventListener('beforeunload', saveNow);

    // ------------------------------------------------------------ Zeitsteuerung
    let acc = 0;
    function doTick() { const r = model.tick(); stage.throwApples(r.toEnkel, r.toOpa); }
    function step() { ui.running = false; doTick(); syncControls(); save(); }
    function toggleRun() { ui.running = !ui.running; syncControls(); save(); }
    function restart(newSeed) {
      ui.running = false; acc = 0;
      model.reset(Number($('#nOpa') ? $('#nOpa').value : model.state.startOpa), Number($('#nEnkel') ? $('#nEnkel').value : model.state.startEnkel), !!newSeed);
      stage.sync(); ch.setYMax(model.total); qSig = ''; syncControls(); renderPanel(true); save();
    }
    $('#btnStep').addEventListener('click', step);
    $('#btnRun').addEventListener('click', toggleRun);
    $('#btnRestart').addEventListener('click', () => restart(false));
    $('#btnReseed').addEventListener('click', () => restart(true));
    $('#speed').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (b) { ui.speed = Number(b.dataset.speed); syncControls(); save(); } });

    $('#btnNotebook').addEventListener('click', () => { ui.panel = true; ui.tab = 'notebook'; syncControls(); renderPanel(true); $('#panel').scrollTop = 0; save(); });
    $('#btnPanel').addEventListener('click', () => { ui.panel = !ui.panel; syncControls(); onResize(); save(); });
    document.querySelector('.lk-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      ui.tab = b.dataset.tab; syncControls(); renderPanel(true); $('#panel').scrollTop = 0; save();
    });

    function syncControls() {
      $('#btnRun').textContent = ui.running ? 'Pause' : 'Start';
      $('#btnRun').setAttribute('aria-pressed', String(ui.running));
      document.querySelectorAll('#speed [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === ui.speed)));
      $('#btnPanel').setAttribute('aria-expanded', String(ui.panel));
      $('#main').classList.toggle('panel-hidden', !ui.panel);
      document.querySelectorAll('.lk-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
      renderQ();
    }

    // ------------------------------------------------------------ Q/K-Anzeige, Diagramm, Balken
    let qSig = '';
    function renderQ() {
      const s = model.state;
      const eq = s.eqTime != null;
      const sig = [s.step, s.nOpa, s.nEnkel, eq, s.pOpa, s.pEnkel].join('|');
      if (sig === qSig) return;
      qSig = sig;
      const Q = model.Q, r = model.rates();
      $('#qbox').innerHTML = `<div class="qrow"><span class="qlab">Zeit</span><b>${core.fmtTime(s.t)}</b></div>
        <div class="qrow"><span class="qlab">Q = <span class="frac"><span>N(Großvater)</span><span>N(Enkel)</span></span></span><b>${isFinite(Q) ? core.fmt(Q, 2) : '–'}</b></div>
        <div class="qrow ${eq ? 'eq' : ''}"><span class="qlab">K = <span class="frac"><span>p<sub>Enkel</sub></span><span>p<sub>Opa</sub></span></span></span><b>${core.fmt(model.K, 2)}</b></div>
        <div class="qnote">${eq ? '<b>Eingependelt:</b> Q schwankt um K – weiter wird geworfen.' : s.step ? 'Q schwankt und nähert sich K.' : 'Starte den Apfelkrieg.'}</div>`;
      const h = s.history;
      ch.setSeries([
        { id: 'opa', label: 'Großvater', color: chart.COLORS.left, points: h.map((p) => [p[0], p[1]]) },
        { id: 'enkel', label: 'Enkel', color: chart.COLORS.right, points: h.map((p) => [p[0], p[2]]) }
      ]);
      const eqv = model.equilibrium();
      ch.setRefs([{ y: eqv.nOpa, color: '#e39a86' }, { y: eqv.nEnkel, color: '#8fb3e6' }]);
      ch.setMarks(eq ? [{ x: s.eqTime, label: 'eingependelt' }] : []);
      ch.draw();
      bars.set(r.toEnkel, r.toOpa); bars.draw();
      if (ui.tab === 'experiment') updateExperimentNumbers();
    }

    // ------------------------------------------------------------ Bedienfeld: Versuch
    function experimentHtml() {
      const s = model.state;
      const preset = (o, e, label) => `<button type="button" class="lk-btn small" data-preset="${o},${e}">${label}</button>`;
      return `<div class="lk-card"><h2>Startaufstellung</h2>
        <div class="lk-row">${preset(9, 9, '9 : 9')}${preset(18, 0, '18 : 0')}${preset(0, 18, '0 : 18')}</div>
        <label class="sl"><span>Äpfel beim Großvater: <output id="nOpaOut">${s.startOpa}</output></span><input type="range" id="nOpa" min="0" max="${M.LIMITS.nMax}" step="1" value="${s.startOpa}" aria-label="Äpfel beim Großvater zu Beginn"></label>
        <label class="sl"><span>Äpfel beim Enkel: <output id="nEnkelOut">${s.startEnkel}</output></span><input type="range" id="nEnkel" min="0" max="${M.LIMITS.nMax}" step="1" value="${s.startEnkel}" aria-label="Äpfel beim Enkel zu Beginn"></label>
        <div class="lk-row"><button type="button" class="lk-btn primary" id="btnApplyStart">Neu starten mit dieser Aufstellung</button></div></div>
        <div class="lk-card"><h2>Wurfwahrscheinlichkeit je Apfel und Schritt (0,5 s)</h2>
        <label class="sl"><span>Großvater: <output id="pOpaOut">${pct(s.pOpa)}</output></span><input type="range" id="pOpa" min="${M.LIMITS.pMin * 100}" max="${M.LIMITS.pMax * 100}" step="1" value="${Math.round(s.pOpa * 100)}" aria-label="Wurfwahrscheinlichkeit des Großvaters in Prozent"></label>
        <label class="sl"><span>Enkel: <output id="pEnkelOut">${pct(s.pEnkel)}</output></span><input type="range" id="pEnkel" min="${M.LIMITS.pMin * 100}" max="${M.LIMITS.pMax * 100}" step="1" value="${Math.round(s.pEnkel * 100)}" aria-label="Wurfwahrscheinlichkeit des Enkels in Prozent"></label>
        <p class="lk-muted small">Gilt sofort, auch während des Krieges. Die Figuren sind nur Dekoration – gewürfelt wird für jeden Apfel einzeln.</p></div>
        <div class="lk-card"><h2>Ablesen</h2><table class="res"><tbody>
        <tr><td>Großvater</td><td id="readOpa"></td></tr><tr><td>Enkel</td><td id="readEnkel"></td></tr>
        <tr><td>Gleichgewicht erwartet (Mittelwert)</td><td id="readEq"></td></tr></tbody></table></div>`;
    }
    function updateExperimentNumbers() {
      const s = model.state, el = $('#readOpa');
      if (!el) return;
      el.textContent = s.nOpa + ' Äpfel'; $('#readEnkel').textContent = s.nEnkel + ' Äpfel';
      const eq = model.equilibrium();
      $('#readEq').textContent = `${core.fmt(eq.nOpa, 1)} : ${core.fmt(eq.nEnkel, 1)}`;
    }

    function modelHtml() {
      const N = T.MODEL;
      return `<div class="lk-card"><h2>Modell und Wirklichkeit</h2>
        <table class="res analogy"><thead><tr><th>Im Apfelkrieg</th><th>Bei einer chemischen Reaktion</th></tr></thead><tbody>${N.analogy.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>
        <div class="lk-card"><h3>Was das Modell zeigt</h3><ul>${N.shows.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div class="lk-card"><h3>Was das Modell nicht zeigt</h3><ul>${N.hides.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div class="lk-note info"><span class="lk-level particles">Teilchenebene – Modell</span> Der Apfelkrieg arbeitet mit einzelnen, zählbaren Objekten und Zufall. Die Stoffebene mit messbaren Mengen zeigt die App <b>Stechheber</b>; beides zusammen das <b>Estergleichgewicht</b>.</div>`;
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
      return `<h1>Modell Apfelkrieg</h1><div class="lk-notebook">${notebookInner()}</div>
        <h2>Mein Apfelkrieg</h2><table><thead><tr><th>Zeit</th><th>N(Großvater)</th><th>N(Enkel)</th><th>Q</th></tr></thead><tbody>${['0 s', '10 s', '30 s', '60 s', '90 s', '120 s', '180 s'].map((c) => `<tr><td>${c}</td><td></td><td></td><td></td></tr>`).join('')}</tbody></table>
        <p style="font-size:9pt;color:#555">SiVex · Apfelkrieg 0.1.0 · Vorlage: Apfelkrieg nach T. Seilnacht</p>`;
    }

    let panelSig = '';
    function renderPanel(force) {
      const sig = JSON.stringify([ui.tab, ui.step, ui.steps]);
      if (sig === panelSig && !force) return;
      panelSig = sig;
      const body = $('#panelBody');
      const top = $('#panel').scrollTop;
      body.setAttribute('aria-labelledby', 'tab-' + ui.tab);
      body.innerHTML = ui.tab === 'experiment' ? experimentHtml() : ui.tab === 'task' ? learn.taskHtml(T.STEPS, ui, { locked: T.locked, lockedText: T.LOCKED_TEXT }) : ui.tab === 'model' ? modelHtml() : notebookHtml();
      if (ui.tab === 'experiment') updateExperimentNumbers();
      $('#panel').scrollTop = top;
    }
    learn.bindTask($('#panelBody'), { steps: T.STEPS, state: ui, render: () => renderPanel(true), save });
    $('#panelBody').addEventListener('input', (e) => {
      const el = e.target;
      if (el.id === 'pOpa' || el.id === 'pEnkel') {
        model.setRates(el.id === 'pOpa' ? Number(el.value) / 100 : null, el.id === 'pEnkel' ? Number(el.value) / 100 : null);
        $('#pOpaOut').textContent = pct(model.state.pOpa); $('#pEnkelOut').textContent = pct(model.state.pEnkel);
        qSig = ''; renderQ(); save();
      } else if (el.id === 'nOpa' || el.id === 'nEnkel') {
        $('#' + el.id + 'Out').textContent = el.value;
      }
    });
    $('#panelBody').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.preset) { const [o, en] = t.dataset.preset.split(',').map(Number); $('#nOpa').value = o; $('#nEnkel').value = en; $('#nOpaOut').textContent = o; $('#nEnkelOut').textContent = en; restart(false); }
      if (t.id === 'btnApplyStart') restart(false);
      if (t.id === 'btnPrint') { $('#printArea').innerHTML = printHtml(); root.print(); }
    });
    root.addEventListener('beforeprint', () => { if (!$('#printArea').innerHTML) $('#printArea').innerHTML = printHtml(); });

    function onResize() { stage.resize(); ch.draw(); bars.draw(); }
    const sp = splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex-apfelkrieg-panel', minStage: 520, onChange: onResize });
    root.addEventListener('resize', onResize);
    if (root.ResizeObserver) new root.ResizeObserver(onResize).observe($('#stageWrap'));

    // ------------------------------------------------------------ Zeitschleife (feste Schritte, Tick alle 0,5 s Modellzeit)
    const clock = core.createClock({ step: (h) => { stage.advance(h); if (ui.running) { acc += h; while (acc >= M.TICK - 1e-9) { acc -= M.TICK; doTick(); } } } });
    let last = null, frames = 0;
    function loop(now) {
      const dt = last == null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      if (dt > 0) clock.advance(dt * (ui.running ? ui.speed : 1));
      stage.draw();
      renderQ();
      frames++;
      root.requestAnimationFrame(loop);
    }

    syncControls();
    renderPanel(true);
    onResize();
    root.requestAnimationFrame(loop);
    return { model, ui, stage, chart: ch, bars, step, toggleRun, restart, renderPanel, splitter: sp, save: saveNow, get frames() { return frames; } };
  }

  (root.AK = root.AK || {}).ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
