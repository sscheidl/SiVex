/*
 * Pufferfish – Start, Ereignisse und Zeitschleife
 */
(function (root) {
  'use strict';
  const { engine: E, chem: C, learn: L } = root.PF;
  const $ = (s) => document.querySelector(s);
  const de = (v, d) => root.LK.core.fmt(v, d);

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

  // ------------------------------------------------------------ Labor: Versuch, Lösung, Pipette, Menge, Ziel
  function afterLabChange(full) { U.refreshLab(full); U.save(); }

  // ------------------------------------------------------------ Pause blockiert nie (iPad-Regel 4, 0.3.0)
  /** Pause beenden (1×) und das sagen. */
  function resume(text) {
    if (ui.speed !== 0) return false;
    ui.speed = 1; U.renderBars(); U.save();
    if (text) U.toast(text);
    return true;
  }
  /**
   * Bedienen bei angehaltener Zeit, während eine Zugabe oder Messung stillsteht: Zeit läuft wieder,
   * der Vorgang läuft zu Ende (sonst würde alles mit „Warte …“ abgewiesen). Gibt true zurück, wenn
   * die Bedienung deshalb abgefangen wurde.
   */
  function unblock() {
    if (ui.speed === 0 && eng.busy()) { resume('Pause beendet – die laufende Zugabe bzw. Messung läuft jetzt zu Ende. Danach kannst du weitermachen.'); return true; }
    return false;
  }
  /** Laufende Zugabe oder Messung sofort zu Ende rechnen (z. B. vor einem Versuchswechsel). */
  function finishRunning() {
    for (let i = 0; i < 1200 && eng.busy(); i++) eng.step(0.05);
    let committed = false;
    for (const f of eng.drainFx()) if (f.type === 'commit' || f.type === 'measured') committed = true;
    if (committed) U.save();
  }

  $('#expChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-exp]'); if (!b) return;
    // Versuchswechsel: laufende Zugabe/Messung abschließen, Zeit auf 1× (iPad-Regel 4)
    if (eng.busy()) finishRunning();
    if (ui.speed === 0) { ui.speed = 1; U.renderBars(); }
    const r = eng.selectExperiment(b.dataset.exp);
    if (r.ok) {
      lab.resetFx(); ui.tab = 'task'; U.refreshLab(true); U.renderPanel(); U.save();
    } else U.toast(r.text);
  });

  /** Lösung wählen – Flasche im Labor und Schalter in der Dosierleiste führen hierher (ein Zustand). */
  function selectReagent(key) {
    const before = eng.state.slot;
    const r = eng.selectSlot(key);
    if (!r.ok) { U.toast(r.text); return; }
    // 0.2.2: Jeder Wechsel HCl ↔ NaOH beginnt mit frischen Ansätzen (Wasser pH 7,00, Puffer pH 7,20).
    // Eine schon benutzte Reihe des gewählten Reagenzes wird dabei unter „Ergebnisse“ abgelegt, nicht gelöscht.
    if (key !== before && !isMixExp() && key !== 'cont') {
      const name = key === 'HCl' ? 'Säurereihe' : 'Laugenreihe';
      if (eng.used(eng.current())) {
        const n = eng.newSeries();
        U.toast(n.ok ? `${name} mit ${key}: frische Ansätze. Die vorige ${name} steht unter „Ergebnisse“.` : n.text);
      } else U.toast(`${name} mit ${key}: frische Ansätze.`);
    }
    afterLabChange(true);
  }
  const isMixExp = () => E.expById(eng.state.exp).mixing;

  $('#tags').addEventListener('click', (e) => {
    if (e.target.closest('[data-bottle],[data-pip]') && unblock()) return;
    const b = e.target.closest('[data-bottle]'); if (b) { selectReagent(b.dataset.bottle); return; }
    const p = e.target.closest('[data-pip]');
    if (p) { const r = eng.setTool(p.dataset.pip); if (!r.ok) U.toast(r.text); else afterLabChange(false); }
  });

  function doDose() {
    if (unblock()) return;
    resume('Pause beendet – die Zeit läuft wieder (1×).');
    if (eng.busy()) { U.toast('Die Pipette ist noch unterwegs – warte, bis die Zugabe beendet ist.'); return; }
    const block = U.dosingBlock();
    if (block) { U.toast(block); if (isMixExp()) { ui.tab = 'task'; $('#main').classList.remove('panel-hidden'); U.renderPanel(); } return; }
    const r = eng.dose(eng.state.kind, isMixExp() || ui.target === 'all' ? null : [Number(ui.target)]);
    if (!r.ok) U.toast(r.text); else U.renderBars();
  }
  function doMeasure() {
    if (unblock()) return;
    resume('Pause beendet – die Zeit läuft wieder (1×).');
    if (eng.busy()) { U.toast('Warte, bis die laufende Zugabe oder Messung beendet ist.'); return; }
    const block = U.dosingBlock();
    if (block) { U.toast(block); return; }
    const m = ui.mix;
    const r = eng.measure({ r: m.entries.r, vb: m.entries.vb, va: m.entries.va, res: m.res ? { ok: m.res.ok, r: pickRes(m.res.r), vb: pickRes(m.res.vb), va: pickRes(m.res.va), sum: pickRes(m.res.sum) } : null });
    if (!r.ok) U.toast(r.text); else { U.toast('Mischen und messen …'); U.renderBars(); }
  }
  const pickRes = (x) => (x ? { ok: x.ok, empty: !!x.empty, kind: x.kind || null, fb: x.fb || '' } : null);

  $('#deck').addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.speed == null && t.id !== 'btnStep' && t.id !== 'btnStir' && t.id !== 'btnGo' && t.id !== 'btnMeasure' && unblock()) return;
    if (t.dataset.reagent) { selectReagent(t.dataset.reagent); return; }
    if (t.dataset.tool) { const r = eng.setTool(t.dataset.tool); if (!r.ok) U.toast(r.text); else afterLabChange(false); return; }
    if (t.dataset.kind) { const r = eng.setKind(t.dataset.kind); if (!r.ok) U.toast(r.text); else afterLabChange(false); return; }
    if (t.dataset.target) { ui.target = t.dataset.target; U.renderBars(); U.updateTags(); U.save(); return; }
    if (t.dataset.speed != null) { ui.speed = Number(t.dataset.speed); U.renderBars(); U.save(); return; }
    if (t.id === 'btnStep') { if (ui.speed === 0) eng.step(0.2); return; }
    if (t.id === 'btnStir') { eng.setStir(!eng.state.stirOn); U.toast(eng.state.stirOn ? 'Rühren an: Die Rührfische drehen sich, die Lösungen mischen sich schneller.' : 'Rühren aus.'); U.renderBars(); return; }
    if (t.id === 'btnGo') { doDose(); return; }
    if (t.id === 'btnMeasure') { doMeasure(); return; }
  });
  $('#btnNewSeries').addEventListener('click', () => { if (unblock()) return; const r = eng.newSeries(); if (r.ok) { U.toast('Reihe gespeichert – frische Ansätze stehen bereit.'); U.refreshLab(true); U.renderPanel(); U.save(); } else U.toast(r.text); });
  $('#btnCont').addEventListener('click', () => { if (unblock()) return; const r = eng.continueWithOther(); if (r.ok) { U.toast(`Gegenprobe: dieselben, bereits behandelten Ansätze erhalten jetzt ${eng.current().reagent}.`); U.refreshLab(true); U.save(); } else U.toast(r.text); });
  $('#btnBatch').addEventListener('click', () => { if (unblock()) return; const r = eng.newBatch(); if (r.ok) { U.toast('Leeres Becherglas aufgestellt. Frühere Messungen stehen unter „Ergebnisse“.'); lab.resetFx(); U.refreshLab(true); U.renderPanel(); U.save(); } else U.toast(r.text); });
  $('#chkIndicator').addEventListener('change', (e) => { ui.indicator = e.target.checked; applySettings(); U.save(); });
  $('#chkZoom').addEventListener('change', (e) => { ui.zoom = e.target.checked; U.save(); });
  $('#chkPka').addEventListener('change', (e) => { ui.pka = e.target.checked; U.save(); });
  $('#cmpSelect').addEventListener('change', (e) => { ui.compare = e.target.value; U.save(); });

  // Zusatzansicht: Teilchenmodell / Mischungsverhältnis ↔ pH-Kurve (gleicher Platz, kein Datenverlust)
  $('#viewToggle').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    ui.view[eng.state.exp] = b.dataset.view;
    U.renderExtra(); U.save();
    if (b.dataset.view === 'curve') U.updateChart(chart, true);
  });

  // ------------------------------------------------------------ Bedienfeld
  document.querySelector('.lk-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; ui.tab = b.dataset.tab; ui.confirmSol = null; U.renderPanel(); U.save(); });
  const pb = $('#panelBody');

  function mixReset(keepTarget) {
    const m = ui.mix;
    if (!keepTarget) m.target = null;
    m.system = null; m.pick = null; m.msg = null;
    m.entries = { r: '', vb: '', va: '' }; m.res = null; m.checked = false; m.tip = 0; m.sol = false;
  }
  function setTarget(pH) {
    if (unblock()) return;
    if (eng.busy()) { U.toast('Warte, bis die laufende Zugabe oder Messung beendet ist.'); return; }
    const msg = L.targetMessage(null, pH);
    if (!msg.ok) { ui.mix.customMsg = msg.text; U.toast(msg.text); U.renderPanel(); U.save(); return; } // bisheriges Ziel bleibt
    const r = eng.selectSystem(null, pH);
    if (!r.ok) { U.toast(r.text); return; }
    mixReset(false); ui.mix.target = pH; ui.mix.customMsg = null;
    lab.resetFx(); U.refreshLab(true); U.renderPanel(); U.save();
  }
  function setSystem(id) {
    const m = ui.mix;
    if (unblock()) { U.renderPanel(); return; }
    if (eng.busy()) { U.toast('Warte, bis die laufende Zugabe oder Messung beendet ist.'); U.renderPanel(); return; }
    const msg = L.targetMessage(id, m.target);
    const r = eng.selectSystem(msg.ok ? id : null, m.target);
    if (!r.ok) { U.toast(r.text); U.renderPanel(); return; }
    m.pick = id; m.msg = msg;
    m.entries = { r: '', vb: '', va: '' }; m.res = null; m.checked = false; m.tip = 0; m.sol = false;
    m.system = msg.ok ? id : null;
    lab.resetFx(); U.refreshLab(true); U.renderPanel(); U.save();
  }
  function mixCheck() {
    const m = ui.mix;
    const plan = C.planMix(m.system, m.target);
    const res = L.gradeMixCalc(plan, m.entries);
    if (res.empty) { U.toast('Fülle alle drei Felder aus, dann prüfe die Rechnung.'); m.res = res; U.renderPanel(); return; }
    m.res = res; m.checked = true;
    U.toast(res.ok ? 'Rechnung richtig – jetzt herstellen.' : 'Rechnung geprüft – Rückmeldung unter den Feldern. Du kannst trotzdem herstellen und messen.');
    U.refreshLab(false); U.renderPanel(); U.save();
  }

  pb.addEventListener('submit', (e) => {
    e.preventDefault();
    const x = eng.state.exp;
    if (e.target.id === 'protoForm') {
      ui.checked[x] = true; ui.confirmSol = null;
      const res = U.gradeAll(x);
      const ok = Object.values(res).every((r) => r.status === 'right');
      if (!ok) ui.fails[x] = (ui.fails[x] || 0) + 1;
      if (x === 'e1' && res.d1 && res.d1.status !== 'empty') U.toast('Deutung abgegeben – die Herleitung ist jetzt freigeschaltet (Reiter „2 Herleitung“).');
    }
    U.renderPanel(); U.renderSteps(); U.renderBars(); U.save();
  });
  pb.addEventListener('change', (e) => {
    const x = eng.state.exp, t = e.target;
    if (t.dataset.q) {
      const q = L.PROTOCOLS[x].questions.find((k) => k.id === t.dataset.q);
      const a = (ui.answers[x] = ui.answers[x] || {});
      if (q.type === 'multi') a[q.id] = [...pb.querySelectorAll(`[data-q="${q.id}"]:checked`)].map((i) => i.value);
      else a[q.id] = t.value;
      U.renderSteps(); U.save();
    } else if (t.dataset.mixsystem) setSystem(t.dataset.mixsystem);
  });
  pb.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.free) { const x = eng.state.exp; (ui.answers[x] = ui.answers[x] || {})[t.dataset.free] = t.value; U.save(); }
    else if (t.dataset.mixf) { ui.mix.entries[t.dataset.mixf] = t.value; ui.mix.res = null; U.save(); } // geänderte Eingabe: altes Prüfergebnis gilt nicht mehr
    else if (t.dataset.mixcustom != null) { ui.mix.custom = t.value; }
  });
  pb.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.mixcustom != null) { e.preventDefault(); setTarget(L.num(ui.mix.custom)); }
  });
  pb.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const x = eng.state.exp;
    if (t.dataset.go) { U.setPage(t.dataset.go); return; }
    if (t.dataset.force) { ui.forced[t.dataset.force] = true; afterLabChange(true); U.renderSteps(); U.renderPanel(); return; }
    if (t.dataset.cmp) { ui.compare = ui.compare === t.dataset.cmp ? '' : t.dataset.cmp; U.renderBars(); U.renderPanel(); U.save(); return; }
    if (t.dataset.fresh != null) {
      const r = eng.freshSample(Number(t.dataset.fresh));
      if (r.ok) { U.toast('Frische Probe aufgestellt; die alte Messung ist unter „Ergebnisse“ gespeichert.'); U.refreshLab(false); U.renderPanel(); U.save(); } else U.toast(r.text);
      return;
    }
    if (t.dataset.mixtarget) { setTarget(Number(t.dataset.mixtarget)); return; }
    if (t.dataset.mixaction) {
      const m = ui.mix;
      switch (t.dataset.mixaction) {
        case 'custom': setTarget(L.num(m.custom)); return;
        case 'check': mixCheck(); return;
        case 'tip': m.tip = Math.min(3, (m.tip || 0) + 1); break;
        case 'sol': if (m.checked) m.sol = true; else ui.confirmSol = 'mix'; break;
        case 'solYes': m.sol = true; ui.confirmSol = null; break;
        case 'solNo': ui.confirmSol = null; break;
        default: return;
      }
      U.renderPanel(); U.save(); return;
    }
    switch (t.id) {
      case 'btnMeasurePanel': doMeasure(); return;
      case 'btnTip': {
        const res = U.gradeAll(x);
        const q = L.PROTOCOLS[x].questions.find((k) => k.type !== 'free' && res[k.id] && res[k.id].status !== 'right');
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
        Object.assign(ui, { answers: {}, checked: {}, fails: {}, tips: {}, sol: {}, confirmSol: null, theory: {}, tasks: {}, apps: {}, forced: {}, compare: '', pka: false, order: {}, view: { e1: 'main', e2: 'main', e3: 'main' }, seed: Math.floor(Math.random() * 4294967295) + 1 });
        mixReset(false);
        U.refreshLab(true); U.renderSteps(); U.toast('Alles zurückgesetzt.');
        break;
      }
      default: return;
    }
    U.renderPanel(); U.save();
  });
  function showSol(x) {
    ui.sol[x] = true; ui.confirmSol = null; ui.checked[x] = true;
    U.renderSteps();
  }

  // ------------------------------------------------------------ Seiten
  const pg = $('#pageBody');
  pg.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.go) { U.setPage(t.dataset.go); return; }
    if (t.dataset.force) { ui.forced[t.dataset.force] = true; U.refreshLab(true); U.setPage(ui.page); return; }
    const id = t.dataset.id;
    if (t.dataset.th) {
      const step = L.THEORY.find((s) => s.id === id), st = (ui.theory[id] = ui.theory[id] || { vals: {} });
      if (t.dataset.th === 'check') {
        st.res = {}; let ok = true;
        for (const f of step.fields) { const r = L.gradeField(f, (st.vals || {})[f.id]); st.res[f.id] = r; if (!r.ok) ok = false; }
        st.ok = ok; if (!ok) st.fails = (st.fails || 0) + 1;
        if (ok && U.theoryDone()) U.toast('Herleitung abgeschlossen: Versuch 3 (Puffer herstellen) ist freigeschaltet, pKₛ-Bereich und formale Stoffmengen sind im Labor verfügbar.');
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
    try { frame(now); } catch (e) { if (root.console) root.console.error(e); } // ein Fehler in einem Bild darf die Zeitschleife nicht beenden
    root.requestAnimationFrame(loop);
  }
  function frame(now) {
    const real = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    const dt = real * ui.speed;
    eng.step(dt);
    let committed = false, measured = null;
    for (const f of eng.drainFx()) {
      if (f.type === 'land') { lab.onLand(f, eng.geometry(), eng.current()); U.onLand(f); nod(); }
      else if (f.type === 'commit') committed = true;
      else if (f.type === 'measured') measured = f.entry;
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
    if (measured) {
      U.toast(`pH-Messelektrode: pH ${de(measured.pH, 2)} gemessen.`);
      U.renderPanel(); U.save();
    }
    if (committed) { U.save(); if (ui.tab === 'results' || ui.tab === 'journal') U.renderPanel(); }
  }
  root.requestAnimationFrame(loop);
  root.addEventListener('pagehide', () => U.saveNow());

  root.PF.app = { eng, lab, chart, U, ui, puff };
})(typeof self !== 'undefined' ? self : this);
