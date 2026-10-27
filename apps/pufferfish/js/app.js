/*
 * Pufferfish – Start, Ereignisse und Zeitschleife
 */
(function (root) {
  'use strict';
  const { engine: E, chem: C, learn: L } = root.PF;
  const $ = (s) => document.querySelector(s);

  const eng = E.create();
  const lab = new root.PF.LabRenderer($('#lab'), eng);
  const chart = new root.PF.chart.Chart($('#chart'));
  const U = root.PF.createUI(eng, lab);
  const ui = U.ui;
  const hadSave = U.load();
  if (!hadSave && root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) ui.reduceMotion = true;

  function applySettings() {
    lab.opts.indicator = ui.indicator;
    lab.opts.reduceMotion = ui.reduceMotion;
    eng.state.showEvents = ui.events;
    document.body.classList.toggle('reduce-motion', ui.reduceMotion);
    $('#btnMotion').setAttribute('aria-pressed', String(ui.reduceMotion));
  }
  applySettings();

  // Universalindikator-Skala (schematisch)
  (function () {
    const stops = [];
    for (let p = 0; p <= 14; p += 0.5) { const c = C.indicatorRGB(p); stops.push(`rgb(${c.join(',')}) ${(p / 14 * 100).toFixed(1)}%`); }
    $('#uiBar').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
    $('#uiBar').innerHTML = [1, 3, 5, 7, 9, 11, 13].map((p) => `<span style="left:${(p / 14 * 100).toFixed(1)}%">${p}</span>`).join('');
  })();

  // ------------------------------------------------------------ Logo
  const logo = $('#logo');
  let nodAt = 0, puffT = 0;
  function puff() {
    if (ui.reduceMotion) return;
    logo.classList.remove('puff', 'nod'); void logo.offsetWidth; logo.classList.add('puff');
    clearTimeout(puffT); puffT = setTimeout(() => logo.classList.remove('puff'), 2800);
  }
  logo.addEventListener('click', puff);
  function nod() {
    if (ui.reduceMotion || logo.classList.contains('puff')) return;
    const t = performance.now();
    if (t - nodAt < 1500) return;
    nodAt = t;
    logo.classList.remove('nod'); void logo.offsetWidth; logo.classList.add('nod');
    setTimeout(() => logo.classList.remove('nod'), 700);
  }

  // ------------------------------------------------------------ Kopfzeile
  document.getElementById('steps').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) U.setPage(b.dataset.page); });
  $('#btnNotebook').addEventListener('click', () => { ui.tab = 'notebook'; $('#main').classList.remove('panel-hidden'); $('#btnPanel').setAttribute('aria-expanded', 'true'); if (ui.page !== 'lab') U.setPage('lab'); U.renderPanel(); U.save(); });
  $('#btnMotion').addEventListener('click', () => { ui.reduceMotion = !ui.reduceMotion; applySettings(); U.save(); });
  $('#btnPanel').addEventListener('click', () => {
    const hidden = $('#main').classList.toggle('panel-hidden');
    $('#btnPanel').setAttribute('aria-expanded', String(!hidden));
  });
  root.LK.splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex.pufferfish.panel', minStage: 560 });

  // ------------------------------------------------------------ Labor-Leisten
  $('#expChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-exp]'); if (!b) return;
    const r = eng.selectExperiment(b.dataset.exp);
    if (r.ok) { lab.resetFx(); U.refreshLab(true); U.renderPanel(); U.save(); } else U.toast(r.text);
  });
  $('#slots').addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (!b) return; const r = eng.selectSlot(b.dataset.slot); if (r.ok) U.refreshLab(true); else U.toast(r.text); U.save(); });
  $('#btnNewSeries').addEventListener('click', () => { const r = eng.newSeries(); if (r.ok) { U.toast('Reihe gespeichert – frische Ansätze stehen bereit.'); U.refreshLab(true); U.renderPanel(); U.save(); } else U.toast(r.text); });
  $('#btnCont').addEventListener('click', () => { const r = eng.continueWithOther(); if (r.ok) { U.toast(`Gegenprobe: dieselben, bereits behandelten Ansätze erhalten jetzt ${eng.current().reagent}.`); U.refreshLab(true); U.save(); } else U.toast(r.text); });

  $('#deck').addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.target) { ui.target = t.dataset.target; U.renderBars(); U.updateTags(); U.save(); return; }
    if (t.dataset.speed != null) { ui.speed = Number(t.dataset.speed); U.renderBars(); U.save(); return; }
    if (t.id === 'btnStep') { if (ui.speed === 0) eng.step(0.2); return; }
    if (t.id === 'btnStir') { eng.stir(ui.target === 'all' ? null : [Number(ui.target)]); U.toast('Umrühren: Die Lösung wird mit dem Glasstab durchmischt.'); return; }
    if (t.dataset.dose) {
      if (ui.speed === 0) { U.toast('Die Zeit ist angehalten. Wähle ¼× oder 1×, um zu dosieren.'); return; }
      if (eng.busy()) { U.toast('Die Pipette ist noch unterwegs – warte, bis die Zugabe beendet ist.'); return; }
      const P = L.PROTOCOLS[eng.state.exp];
      if (P.predict && !ui.predict[eng.state.exp] && !ui.predictSkip[eng.state.exp]) {
        ui.tab = 'task'; $('#main').classList.remove('panel-hidden'); U.renderPanel();
        U.toast('Halte zuerst deine Vermutung fest (Bedienfeld → Aufgabe) – oder wähle „ohne Vermutung weiter“.');
        return;
      }
      const tool = E.DOSES[t.dataset.dose].tool;
      if (tool !== eng.state.tool) { const rt = eng.setTool(tool); if (!rt.ok) { U.toast(rt.text); return; } }
      const r = eng.dose(t.dataset.dose, ui.target === 'all' ? null : [Number(ui.target)]);
      if (!r.ok) U.toast(r.text); else U.renderBars();
    }
  });
  $('#chkIndicator').addEventListener('change', (e) => { ui.indicator = e.target.checked; applySettings(); U.save(); });
  $('#chkEvents').addEventListener('change', (e) => { ui.events = e.target.checked; applySettings(); U.save(); });
  $('#chkZoom').addEventListener('change', (e) => { ui.zoom = e.target.checked; U.save(); });
  $('#chkPka').addEventListener('change', (e) => { ui.pka = e.target.checked; U.save(); });
  $('#cmpSelect').addEventListener('change', (e) => { ui.compare = e.target.value; U.save(); });
  $('#pviews').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fresh]'); if (!b) return;
    const r = eng.freshSample(Number(b.dataset.fresh));
    if (r.ok) { U.toast('Frische Probe aufgestellt; die alte Messung ist unter „Ergebnisse“ gespeichert.'); U.refreshLab(false); U.save(); } else U.toast(r.text);
  });
  $('#pviews').addEventListener('change', (e) => {
    const s = e.target.closest('[data-ratio]'); if (!s || !s.value) return;
    const r = eng.freshSample(Number(s.dataset.ratio), s.value);
    if (r.ok) { U.toast('Neuer Ansatz angelegt.'); U.refreshLab(false); U.save(); } else U.toast(r.text);
  });

  // ------------------------------------------------------------ Bedienfeld
  document.querySelector('.lk-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; ui.tab = b.dataset.tab; ui.confirmSol = null; U.renderPanel(); U.save(); });
  const pb = $('#panelBody');
  pb.addEventListener('submit', (e) => {
    e.preventDefault();
    const x = eng.state.exp;
    if (e.target.id === 'predictForm') {
      const v = new FormData(e.target).get('predict');
      if (!v) { U.toast('Wähle zuerst eine Vermutung.'); return; }
      ui.predict[x] = { v, at: Date.now() };
      U.toast('Vermutung festgehalten. Jetzt selbst dosieren!');
    } else if (e.target.id === 'protoForm') {
      ui.checked[x] = true; ui.confirmSol = null;
      const res = U.gradeAll(x);
      const ok = Object.values(res).every((r) => r.status === 'right');
      if (!ok) ui.fails[x] = (ui.fails[x] || 0) + 1;
      if (x === 'e1' && res.d1 && res.d1.status !== 'empty' && !ui.revealed) { ui.revealed = true; U.refreshLab(true); U.toast('Auflösung: Das Wunderwasser ist eine Phosphatpufferlösung. Die Teilchenansicht ist freigeschaltet.'); }
    }
    U.renderPanel(); U.renderSteps(); U.save();
  });
  pb.addEventListener('change', (e) => {
    const x = eng.state.exp, t = e.target;
    if (t.dataset.q) {
      const q = L.PROTOCOLS[x].questions.find((k) => k.id === t.dataset.q);
      const a = (ui.answers[x] = ui.answers[x] || {});
      if (q.type === 'multi') a[q.id] = [...pb.querySelectorAll(`[data-q="${q.id}"]:checked`)].map((i) => i.value);
      else a[q.id] = t.value;
      U.save();
    }
  });
  pb.addEventListener('input', (e) => { const t = e.target; if (t.dataset.free) { const x = eng.state.exp; (ui.answers[x] = ui.answers[x] || {})[t.dataset.free] = t.value; U.save(); } });
  pb.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const x = eng.state.exp;
    if (t.dataset.go) { U.setPage(t.dataset.go); return; }
    if (t.dataset.cmp) { ui.compare = ui.compare === t.dataset.cmp ? '' : t.dataset.cmp; U.renderBars(); U.renderPanel(); U.save(); return; }
    switch (t.id) {
      case 'btnSkipPredict': ui.predictSkip[x] = true; break;
      case 'btnTip': {
        const res = U.gradeAll(x);
        const q = L.PROTOCOLS[x].questions.find((k) => k.type !== 'free' && (!k.reveal || ui.revealed) && res[k.id] && res[k.id].status !== 'right');
        if (!q) { U.toast('Alles richtig – kein Tipp nötig.'); return; }
        const tp = (ui.tips[x] = ui.tips[x] || {});
        tp[q.id] = Math.min(3, (tp[q.id] || 0) + 1);
        U.renderPanel();
        const fs = pb.querySelector(`[data-qid="${q.id}"]`); if (fs) fs.scrollIntoView({ block: 'nearest' });
        U.save(); return;
      }
      case 'btnSol': {
        const res = U.gradeAll(x);
        if (Object.values(res).some((r) => r.status === 'empty')) ui.confirmSol = 'proto:' + x;
        else showSol(x);
        break;
      }
      case 'btnSolYes': showSol(x); break;
      case 'btnSolNo': ui.confirmSol = null; break;
      case 'btnPrint': $('#printArea').innerHTML = `<h1>Pufferfish – Journal</h1>${U.journalBody()}`; root.print(); return;
      case 'btnExport': {
        const blob = new Blob([U.journalDoc()], { type: 'text/html' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pufferfish-journal.html';
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return;
      }
      case 'btnReset': ui.confirmSol = 'reset'; break;
      case 'btnResetNo': ui.confirmSol = null; break;
      case 'btnResetYes': {
        eng.resetAll(); lab.resetFx();
        Object.assign(ui, { predict: {}, predictSkip: {}, answers: {}, checked: {}, fails: {}, tips: {}, sol: {}, confirmSol: null, revealed: false, theory: {}, tasks: {}, apps: {}, forced: {}, compare: '', pka: false });
        U.refreshLab(true); U.renderSteps(); U.toast('Alles zurückgesetzt.');
        break;
      }
      default: return;
    }
    U.renderPanel(); U.save();
  });
  function showSol(x) {
    ui.sol[x] = true; ui.confirmSol = null; ui.checked[x] = true;
    if (x === 'e1' && !ui.revealed) { ui.revealed = true; U.refreshLab(true); }
    U.renderSteps();
  }

  // ------------------------------------------------------------ Seiten
  const pg = $('#pageBody');
  pg.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.go) { U.setPage(t.dataset.go); return; }
    if (t.dataset.force) { ui.forced[t.dataset.force] = true; if (t.dataset.force === 'theory') ui.revealed = true; U.refreshLab(true); U.setPage(ui.page); return; }
    const id = t.dataset.id;
    if (t.dataset.th) {
      const step = L.THEORY.find((s) => s.id === id), st = (ui.theory[id] = ui.theory[id] || { vals: {} });
      if (t.dataset.th === 'check') {
        st.res = {}; let ok = true;
        for (const f of step.fields) { const r = L.gradeField(f, (st.vals || {})[f.id]); st.res[f.id] = r; if (!r.ok) ok = false; }
        st.ok = ok; if (!ok) st.fails = (st.fails || 0) + 1;
        if (ok && U.theoryDone()) U.toast('Herleitung abgeschlossen: pKₛ-Bereich und formale Stoffmengen sind im Labor freigeschaltet.');
      } else if (t.dataset.th === 'tip') st.tip = Math.min(3, (st.tip || 0) + 1);
      else if (t.dataset.th === 'sol') st.sol = true;
      afterPage(); return;
    }
    if (t.dataset.tk) {
      const task = L.TASKS.find((k) => k.id === id), st = (ui.tasks[id] = ui.tasks[id] || { vals: {}, units: {} });
      if (t.dataset.tk === 'check') {
        st.res = {}; let ok = true;
        for (const f of task.fields) { const r = L.gradeTaskField(f, (st.vals || {})[f.id], (st.units || {})[f.id]); st.res[f.id] = r; if (!r.ok) ok = false; }
        st.checked = true; if (!ok) st.fails = (st.fails || 0) + 1;
      } else if (t.dataset.tk === 'tip') st.tip = Math.min(3, (st.tip || 0) + 1);
      else if (t.dataset.tk === 'sol') { if (st.checked) st.sol = true; else ui.confirmSol = 'task:' + id; }
      else if (t.dataset.tk === 'solYes') { st.sol = true; ui.confirmSol = null; }
      else if (t.dataset.tk === 'solNo') ui.confirmSol = null;
      afterPage(); return;
    }
    if (t.dataset.ap) {
      const q = L.APPLICATIONS.map((a) => a.q).find((k) => k.id === id);
      if (t.dataset.ap === 'check') ui.apps[id + ':res'] = L.gradeQuestion(q, ui.apps[id]);
      else ui.apps[id + ':sol'] = true;
      afterPage();
    }
  });
  function afterPage() {
    const y = $('#page').scrollTop;
    U.renderPage(); U.renderSteps(); U.renderBars(); U.save();
    $('#page').scrollTop = y;
  }
  const pageVal = (e) => {
    const t = e.target;
    if (t.dataset.f) {
      const [id, fid] = t.dataset.f.split(':');
      const bag = id.startsWith('t') ? ui.theory : ui.tasks;
      const st = (bag[id] = bag[id] || { vals: {}, units: {} });
      st.vals = st.vals || {}; st.vals[fid] = t.value; U.save();
    } else if (t.dataset.u) {
      const [id, fid] = t.dataset.u.split(':');
      const st = (ui.tasks[id] = ui.tasks[id] || { vals: {}, units: {} });
      st.units = st.units || {}; st.units[fid] = t.value; U.save();
    } else if (t.dataset.note) {
      const st = (ui.tasks[t.dataset.note] = ui.tasks[t.dataset.note] || { vals: {}, units: {} });
      st.note = t.value; U.save();
    } else if (t.dataset.appQ) { ui.apps[t.dataset.appQ] = t.value; U.save(); }
  };
  pg.addEventListener('input', pageVal);
  pg.addEventListener('change', pageVal);

  // ------------------------------------------------------------ Start und Zeitschleife
  U.renderSteps(); U.renderPage(); U.renderPanel(); U.refreshLab(true);
  if (!ui.reduceMotion) setTimeout(puff, 450);

  let last = performance.now(), wasBusy = false;
  function loop(now) {
    const real = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    const dt = real * ui.speed;
    eng.step(dt);
    let committed = false;
    for (const f of eng.drainFx()) {
      if (f.type === 'land') { lab.onLand(f, eng.geometry(), eng.current()); nod(); }
      else if (f.type === 'commit') committed = true;
    }
    if (ui.page === 'lab') {
      lab.frame(dt);
      U.updateViews(dt, real);
      U.updateTags();
      U.updateReadouts();
      U.updateChart(chart);
    }
    const b = eng.busy();
    if (b !== wasBusy) { wasBusy = b; U.renderBars(); }
    if (committed) { U.save(); if (ui.tab === 'results' || ui.tab === 'journal') U.renderPanel(); }
    root.requestAnimationFrame(loop);
  }
  root.requestAnimationFrame(loop);
  root.addEventListener('pagehide', () => { try { root.localStorage.setItem('sivex.pufferfish.v1', JSON.stringify({ v: 1, ui: Object.assign({}, ui, { confirmSol: null }), engine: eng.serialize() })); } catch (e) { /* ohne Speicher */ } });

  root.PF.app = { eng, lab, chart, U, ui, puff };
})(typeof self !== 'undefined' ? self : this);
