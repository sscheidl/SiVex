/*
 * Stechheber – Oberfläche (DOM)
 *
 * Verbindet Modell, Bühne, Diagramm, Balkenpaar, Q/K-Anzeige und das Bedienfeld
 * (Reiter Versuch · Aufgabe · Modell · Hefteintrag). Zeitsteuerung nach G8:
 * Zyklus (ein Schritt), Start/Pause, Tempo, Neu starten; feste Zeitschritte über LK.core.
 */
(function (root) {
  'use strict';
  const { core, splitter, learn, chart } = root.LK;
  const M = root.SH.model, T = root.SH.tasks;
  const { StageRenderer, CYCLE_DUR } = root.SH.render;
  const $ = (s) => document.querySelector(s);
  const esc = learn.esc;
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const STORE = 'sivex-stechheber-v1';
  const SPEEDS = [1, 3, 10];

  function initialUi() {
    return { tab: 'experiment', step: 'observe', panel: true, running: false, speed: 1, steps: learn.freshState(T.STEPS) };
  }

  function createUI() {
    let saved = null;
    try { saved = JSON.parse(root.sessionStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    const model = M.createModel();
    if (saved && saved.model) model.restore(saved.model);
    const ui = Object.assign(initialUi(), saved && saved.ui ? saved.ui : {});
    ui.running = false; // eine gespeicherte Sitzung startet nie von selbst
    const stage = new StageRenderer($('#stage-canvas'), model);
    const ch = chart.createChart($('#chart'), { xLabel: 'Zyklen', yLabel: 'Volumen in mL', yMin: 0, xMinSpan: 20, xFmt: (v) => String(Math.round(v)), yFmt: (v) => String(Math.round(v)) });
    const bars = chart.createBars($('#bars'), { title: 'letzter Zyklus (mL)', labels: ['A → B', 'B → A'], decimals: 1 });

    // ------------------------------------------------------------ Speichern
    let saveTimer = null;
    function saveNow() { clearTimeout(saveTimer); try { root.sessionStorage.setItem(STORE, JSON.stringify({ model: model.snapshot(), ui })); } catch (e) { /* ohne Speicher */ } }
    function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
    root.addEventListener('pagehide', saveNow);
    root.addEventListener('beforeunload', saveNow);

    // ------------------------------------------------------------ Zeitsteuerung
    function step() { if (stage.startCycle()) { ui.running = false; syncControls(); } }
    function toggleRun() { ui.running = !ui.running; if (ui.running && !stage.get()) stage.startCycle(); syncControls(); save(); }
    function setSpeed(v) { ui.speed = v; syncControls(); save(); }
    function restart() {
      stage.anim = null;
      ui.running = false;
      model.reset(Number($('#startA').value), Number($('#startB').value));
      syncControls(); renderPanel(true); save();
    }
    $('#btnStep').addEventListener('click', step);
    $('#btnRun').addEventListener('click', toggleRun);
    $('#btnRestart').addEventListener('click', restart);
    $('#speed').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (b) setSpeed(Number(b.dataset.speed)); });

    // ------------------------------------------------------------ Kopfzeile, Reiter
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

    // ------------------------------------------------------------ Q/K-Anzeige und Diagramm
    let qSig = '';
    function renderQ() {
      const s = model.state;
      const eq = s.eqCycle != null;
      const sig = [s.cycle, s.VA.toFixed(2), s.VB.toFixed(2), eq, s.dA, s.dB].join('|');
      if (sig === qSig) return;
      qSig = sig;
      const Q = model.Q;
      $('#qbox').innerHTML = `<div class="qrow"><span class="qlab">Zyklus</span><b>${s.cycle}</b></div>
        <div class="qrow"><span class="qlab">Q = <span class="frac"><span>V(B)</span><span>V(A)</span></span></span><b>${isFinite(Q) ? core.fmt(Q, 2) : '–'}</b></div>
        <div class="qrow ${eq ? 'eq' : ''}"><span class="qlab">K = <span class="frac"><span>f<sub>a</sub></span><span>f<sub>b</sub></span></span> = <span class="frac"><span>d<sub>a</sub>²</span><span>d<sub>b</sub>²</span></span></span><b>${core.fmt(model.K, 2)}</b></div>
        <div class="qnote">${eq ? '<b>Gleichgewicht:</b> Q = K – die Wasserstände ändern sich nicht mehr.' : s.cycle ? 'Q nähert sich K.' : 'Starte den Versuch.'}</div>`;
      const h = s.history;
      ch.setSeries([
        { id: 'A', label: 'V(A)', color: chart.COLORS.left, points: h.map((p) => [p[0], p[1]]) },
        { id: 'B', label: 'V(B)', color: chart.COLORS.right, points: h.map((p) => [p[0], p[2]]) }
      ]);
      ch.setMarks(eq ? [{ x: s.eqCycle, label: 'Gleichgewicht' }] : []);
      ch.draw();
      bars.set(s.lastA2B, s.lastB2A); bars.draw();
      if (ui.tab === 'experiment') updateExperimentNumbers();
    }

    // ------------------------------------------------------------ Bedienfeld: Versuch
    function experimentHtml() {
      const s = model.state;
      return `<div class="lk-card"><h2>Rohre</h2>
        <p class="lk-muted">Durchmesser der Zylinder: ${s.D} mm. Ein Rohr nimmt den Anteil f = (d/D)² des Wassers mit.</p>
        <label class="sl"><span>Rohr a (A → B): <output id="dAout">${core.fmt(s.dA, 1)} mm</output> · f<sub>a</sub> = <output id="fAout">${core.fmt(model.fA, 3)}</output></span>
          <input type="range" id="dA" min="${M.LIMITS.dMin}" max="${M.LIMITS.dMax}" step="0.5" value="${s.dA}" aria-label="Durchmesser Rohr a in Millimetern"></label>
        <label class="sl"><span>Rohr b (B → A): <output id="dBout">${core.fmt(s.dB, 1)} mm</output> · f<sub>b</sub> = <output id="fBout">${core.fmt(model.fB, 3)}</output></span>
          <input type="range" id="dB" min="${M.LIMITS.dMin}" max="${M.LIMITS.dMax}" step="0.5" value="${s.dB}" aria-label="Durchmesser Rohr b in Millimetern"></label>
        <p class="lk-muted small">Zusammen passen höchstens 100 mL in den Versuch. Die Rohre lassen sich auch während des Versuchs ändern. Zusammen bleibt f<sub>a</sub> + f<sub>b</sub> unter 0,4, damit das Modell nicht schwingt.</p></div>
        <div class="lk-card"><h2>Startwerte</h2>
        <label class="sl"><span>Wasser in A zu Beginn: <output id="startAout">${s.startA} mL</output></span><input type="range" id="startA" min="0" max="${M.LIMITS.Vmax}" step="5" value="${s.startA}" aria-label="Startvolumen in Zylinder A"></label>
        <label class="sl"><span>Wasser in B zu Beginn: <output id="startBout">${s.startB} mL</output></span><input type="range" id="startB" min="0" max="${M.LIMITS.Vmax}" step="5" value="${s.startB}" aria-label="Startvolumen in Zylinder B"></label>
        <div class="lk-row"><button type="button" class="lk-btn primary" id="btnApplyStart">Neu starten mit diesen Werten</button></div></div>
        <div class="lk-card"><h2>Ablesen</h2><table class="res"><tbody>
        <tr><td>Zylinder A</td><td id="readA">${core.fmt(s.VA, 1)} mL</td></tr>
        <tr><td>Zylinder B</td><td id="readB">${core.fmt(s.VB, 1)} mL</td></tr>
        <tr><td>Gleichgewicht erwartet bei</td><td id="readEq"></td></tr></tbody></table></div>`;
    }
    function updateExperimentNumbers() {
      const s = model.state, el = $('#readA');
      if (!el) return;
      el.textContent = core.fmt(s.VA, 1) + ' mL';
      $('#readB').textContent = core.fmt(s.VB, 1) + ' mL';
      const eq = model.equilibrium();
      $('#readEq').textContent = `A ≈ ${core.fmt(eq.VA, 0)} mL, B ≈ ${core.fmt(eq.VB, 0)} mL`;
      $('#fAout').textContent = core.fmt(model.fA, 3); $('#fBout').textContent = core.fmt(model.fB, 3);
    }

    // ------------------------------------------------------------ Bedienfeld: Modell
    function modelHtml() {
      const N = T.MODEL;
      return `<div class="lk-card"><h2>Modell und Wirklichkeit</h2>
        <table class="res analogy"><thead><tr><th>Im Stechheber-Modell</th><th>Bei einer chemischen Reaktion</th></tr></thead><tbody>${N.analogy.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>
        <div class="lk-card"><h3>Was das Modell zeigt</h3><ul>${N.shows.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div class="lk-card"><h3>Was das Modell nicht zeigt</h3><ul>${N.hides.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div class="lk-note info"><span class="lk-level matter">Stoffebene – Modell</span> Der Stechheber arbeitet mit Mengen, die man messen kann (Volumen in mL), nicht mit einzelnen Teilchen. Die Teilchenebene zeigt die App <b>Apfelkrieg</b>.</div>`;
    }

    // ------------------------------------------------------------ Bedienfeld: Hefteintrag
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
      return `<h1>Modellexperiment Stechheber</h1><div class="lk-notebook">${notebookInner()}</div>
        <h2>Mein Versuch</h2><table><thead><tr><th>Zyklus</th><th>V(A) in mL</th><th>V(B) in mL</th><th>Q = V(B)/V(A)</th></tr></thead><tbody>${[0, 1, 2, 5, 10, 20, 30].map((c) => `<tr><td>${c}</td><td></td><td></td><td></td></tr>`).join('')}</tbody></table>
        <p style="font-size:9pt;color:#555">SiVex · Stechheber 0.1.0</p>`;
    }

    // ------------------------------------------------------------ Bedienfeld zeichnen und bedienen
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
      if (el.id === 'dA' || el.id === 'dB') {
        model.setTubes(el.id === 'dA' ? Number(el.value) : null, el.id === 'dB' ? Number(el.value) : null);
        $('#dA').value = model.state.dA; $('#dB').value = model.state.dB;
        $('#dAout').textContent = core.fmt(model.state.dA, 1) + ' mm'; $('#dBout').textContent = core.fmt(model.state.dB, 1) + ' mm';
        qSig = ''; renderQ(); save();
      } else if (el.id === 'startA' || el.id === 'startB') {
        // zusammen höchstens das Fassungsvermögen eines Zylinders
        const other = el.id === 'startA' ? $('#startB') : $('#startA');
        if (Number(el.value) + Number(other.value) > M.LIMITS.capacity) { other.value = M.LIMITS.capacity - Number(el.value); $('#' + other.id + 'out').textContent = other.value + ' mL'; }
        $('#' + el.id + 'out').textContent = el.value + ' mL';
      }
    });
    $('#panelBody').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.id === 'btnApplyStart') restart();
      if (t.id === 'btnPrint') { $('#printArea').innerHTML = printHtml(); root.print(); }
    });
    root.addEventListener('beforeprint', () => { if (!$('#printArea').innerHTML) $('#printArea').innerHTML = printHtml(); });

    // ------------------------------------------------------------ Größe, Trennlinie
    function onResize() { stage.resize(); ch.draw(); bars.draw(); }
    const sp = splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex-stechheber-panel', minStage: 520, onChange: onResize });
    root.addEventListener('resize', onResize);
    if (root.ResizeObserver) new root.ResizeObserver(onResize).observe($('#stageWrap'));

    // ------------------------------------------------------------ Zeitschleife
    const clock = core.createClock({ step: (h) => { stage.advance(h, () => { model.cycle(); }); } });
    let last = null, frames = 0, hintText = '';
    function loop(now) {
      const dt = last == null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      if (dt > 0 && (stage.get() || ui.running)) {
        if (!stage.get() && ui.running) stage.startCycle();
        clock.advance(dt * ui.speed);
        if (!stage.get() && ui.running) stage.startCycle();
      }
      const st = stage.draw(dt);
      if (st.label !== hintText) { hintText = st.label; $('#hint').textContent = hintText; }
      renderQ();
      frames++;
      root.requestAnimationFrame(loop);
    }

    syncControls();
    renderPanel(true);
    onResize();
    root.requestAnimationFrame(loop);
    return { model, ui, stage, chart: ch, bars, step, toggleRun, restart, renderPanel, splitter: sp, save: saveNow, get frames() { return frames; }, CYCLE_DUR };
  }

  (root.SH = root.SH || {}).ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
