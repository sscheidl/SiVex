/*
 * Trennlabor – Bedienoberfläche
 *
 * Startansicht, Laborwechsel, Bedienfelder je Labor (vollständige Alternative
 * zum Antippen auf der Bühne), dreistufige Hilfe, Auswertung mit Fragen und
 * Lückentexten, Theorie und Hefteintrag. Zwischenstände werden nur im
 * sessionStorage dieses Browserfensters gehalten.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const { core, classic, chroma, distill, tasks } = TL;
  const { fmt } = core;
  const STORE = 'sivex-trennlabor-v1';
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function storage() { try { return root.sessionStorage; } catch (e) { return null; } }

  function createUI() {
    const errors = [];
    // ------------------------------------------------------------ Zustand
    const S = {
      view: 'start', lab: 'classic', task: { classic: 'K-01', chroma: 'C-1', distill: 'D-1' },
      engines: {}, progress: {}, speed: 1, panelOpen: true, helpSeen: {}
    };
    const engines = {};
    const ui = { sel: null, pending: null, targets: [], sample: null, tool: null, solvent: 'water', level: 'low', lineTool: 'pencil', lineY: 1.5, waterMl: 25, speed: 1 };

    function loadSaved() {
      const st = storage();
      if (!st) return;
      try {
        const raw = st.getItem(STORE);
        if (!raw) return;
        const d = JSON.parse(raw);
        Object.assign(S, d);
      } catch (e) { /* beschädigter Zwischenstand: neu beginnen */ }
    }
    let saveTimer = 0;
    function save() {
      const st = storage();
      if (!st) return;
      try {
        for (const k of Object.keys(engines)) S.engines[k] = engines[k].state;
        st.setItem(STORE, JSON.stringify(S));
      } catch (e) { /* Speicher voll oder gesperrt */ }
    }
    const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };

    const keyFor = (taskId) => (taskId.startsWith('K') ? taskId : taskId.startsWith('C') ? 'chroma' : 'distill');
    function engineFor(taskId) {
      const key = keyFor(taskId);
      if (!engines[key]) {
        const saved = S.engines[key];
        let e;
        try {
          e = key === 'chroma' ? chroma.createEngine(saved) : key === 'distill' ? distill.createEngine(saved) : classic.createEngine(key, saved);
        } catch (err) { e = key === 'chroma' ? chroma.createEngine() : key === 'distill' ? distill.createEngine() : classic.createEngine(key); }
        engines[key] = e;
        wireEngine(e, key);
      }
      return engines[key];
    }
    function resetEngine(taskId) {
      const key = keyFor(taskId);
      delete engines[key]; delete S.engines[key];
      ui.sel = null; ui.pending = null; ui.targets = [];
      return engineFor(taskId);
    }
    const prog = (taskId) => (S.progress[taskId] = S.progress[taskId] || { fails: 0, success: false, snapshot: null, at: null, answers: {}, results: {}, done: false, theory: 0, help: 0, offerSeen: 0, problems: null });

    const curTask = () => S.task[S.lab];
    const curEngine = () => engineFor(curTask());
    const curDef = () => tasks.ALL[curTask()];

    // ------------------------------------------------------------ DOM
    const canvas = $('#lab');
    const renderers = {};
    function renderer() {
      if (!renderers[S.lab]) {
        renderers[S.lab] = S.lab === 'classic' ? TL.renderClassic.createRenderer(canvas) : S.lab === 'chroma' ? TL.renderChroma.createRenderer(canvas) : TL.renderDistill.createRenderer(canvas);
      }
      return renderers[S.lab];
    }

    // ------------------------------------------------------------ Meldungen
    function toast(text, kind) {
      const box = $('#toasts');
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || '');
      el.textContent = text;
      box.appendChild(el);
      while (box.children.length > 3) box.removeChild(box.firstChild);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, kind === 'warn' ? 6500 : 4200);
    }
    function wireEngine(e, key) {
      e.on('message', (m) => {
        if (keyFor(curTask()) !== key || S.view !== 'lab') return;
        if (m.kind === 'safety') return;
        if (m.text) toast(m.text, m.kind === 'warn' ? 'warn' : '');
      });
      e.on('safety', (s) => { if (keyFor(curTask()) === key) showSafety(s); });
      e.on('change', (c) => {
        if (keyFor(curTask()) !== key) return;
        if (c.action === 'opDone' || (c.result && c.result.ok !== undefined)) scheduleRender();
        saveSoon();
      });
    }
    let renderQueued = false;
    function scheduleRender() {
      if (renderQueued) return;
      renderQueued = true;
      root.requestAnimationFrame(() => { renderQueued = false; renderControls(); renderHelp(); });
    }

    function showSafety(s) {
      $('#safetyText').textContent = s.text;
      $('#safety').hidden = false;
      $('#safetyOk').focus();
      scheduleRender();
    }

    // ------------------------------------------------------------ Navigation
    function go(view, lab) {
      S.view = view;
      if (lab) S.lab = lab;
      ui.sel = null; ui.pending = null; ui.targets = []; ui.sample = null; ui.tool = null;
      $('#startView').hidden = view !== 'start';
      $('#labView').hidden = view !== 'lab';
      $('#labSwitch').hidden = view !== 'lab';
      $('#topActions').hidden = view !== 'lab';
      $('#safety').hidden = true;
      $('#brandSub').textContent = view === 'lab' ? tasks.LABS[S.lab].name : 'Stoffe trennen im virtuellen Labor';
      document.querySelectorAll('#labSwitch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lab === S.lab)));
      if (view === 'lab') {
        const r = renderer();
        r.resize();
        renderAll();
        const e = curEngine();
        if (e.state.safety) showSafety(e.state.safety);
      } else renderStart();
      save();
    }

    function setTask(taskId) {
      S.task[S.lab] = taskId;
      ui.sel = null; ui.pending = null; ui.targets = [];
      $('#safety').hidden = true;
      renderAll();
      const e = curEngine();
      if (e.state.safety) showSafety(e.state.safety);
      save();
    }

    function renderAll() {
      renderTask(); renderHelp(); renderControls(); renderEval();
      document.querySelectorAll('#speed button').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.speed) === S.speed)));
      $('#labView').classList.toggle('panel-closed', !S.panelOpen);
      $('#btnPanel').setAttribute('aria-expanded', String(S.panelOpen));
    }

    // ------------------------------------------------------------ Startansicht
    function renderStart() {
      const box = $('#labCards');
      const info = {
        classic: { text: 'Sand, Salz, Eisen, Öl und Hibiskusblüten: Sedimentieren, Dekantieren, Filtrieren, Lösen, Eindampfen, Magnettrennung, Scheidetrichter.', items: ['K-01 Sand und Wasser', 'K-02 Sand und Kochsalz', 'K-03 Eisen, Sand und Kochsalz', 'K-04 Öl und Wasser', 'K-05 Hibiskustee (Extraktion)'] },
        chroma: { text: 'Sieben Proben, zwei Laufmittel: Startlinie ziehen, Proben auftupfen, entwickeln, Chromatogramme vergleichen.', items: ['Welche Stifte enthalten mehrere Farbstoffe?', 'Gemeinsamer Farbstoff in Grün und Violett', 'Wasserfester Stift in zwei Laufmitteln'] },
        distill: { text: 'Apparatur selbst aufbauen, Ethanol-Wasser-Gemisch destillieren, Dampftemperatur verfolgen und Brennprobe durchführen.', items: ['Ethanol aus einem Ethanol-Wasser-Gemisch anreichern'] }
      };
      box.innerHTML = Object.values(tasks.LABS).map((L) => {
        const dots = L.tasks.map((t) => { const p = S.progress[t]; return `<i class="${p && p.done ? 'done' : p && p.success ? 'exp' : ''}" title="${esc(t)}"></i>`; }).join('');
        const done = L.tasks.filter((t) => S.progress[t] && S.progress[t].done).length;
        return `<button type="button" class="lab-card" data-open="${L.id}" aria-label="${esc(L.name)} öffnen">
          <canvas data-preview="${L.id}" aria-hidden="true"></canvas>
          <span class="lc-body">
            <span class="lc-letter">Labor ${L.letter}</span>
            <h2>${esc(L.name)}</h2>
            <p>${esc(info[L.id].text)}</p>
            <ul>${info[L.id].items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
            <span class="lc-foot"><span class="progress-dots" aria-label="${done} von ${L.tasks.length} Aufgaben abgeschlossen">${dots}</span><span class="lc-go">Öffnen</span></span>
          </span></button>`;
      }).join('');
      box.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => go('lab', b.dataset.open)));
      root.requestAnimationFrame(drawPreviews);
    }
    function drawPreviews() {
      document.querySelectorAll('canvas[data-preview]').forEach((cv) => {
        const id = cv.dataset.preview;
        try {
          let e, r, uiP = { speed: 1, targets: [] };
          if (id === 'classic') {
            e = classic.createEngine('K-04');
            e.act('pour', 'A', 'S', 'all'); e.advance(160); e.act('move', 'B', 'sep'); e.advance(2);
            r = TL.renderClassic.createRenderer(cv);
          } else if (id === 'chroma') {
            e = chroma.createEngine();
            e.act('drawLine', 'pencil', 1.5); e.advance(2);
            ['schwarz', 'gruen', 'violett'].forEach((s, i) => { e.act('spot', i, s); e.advance(1); });
            e.act('fill', 'water', 'low'); e.advance(2); e.act('setLid', true); e.act('insert'); e.advance(420);
            r = TL.renderChroma.createRenderer(cv);
          } else {
            e = distill.createEngine();
            [['heater'], ['flask'], ['chips']].forEach((a) => { e.act('mount', ...a); e.advance(1); });
            e.act('fill', 100); e.advance(2);
            [['head'], ['thermo', 'vapor'], ['condenser'], ['hoses', 'correct'], ['adapter'], ['receiver'], ['clamps']].forEach((a) => { e.act('mount', ...a); e.advance(1); });
            e.act('setCooling', 2); e.act('setHeater', 3); e.advance(330);
            r = TL.renderDistill.createRenderer(cv);
          }
          r.resize(); r.frame(0.016, e, uiP);
        } catch (err) { errors.push('Vorschau: ' + err.message); }
      });
    }

    // ------------------------------------------------------------ Aufgabe
    function renderTask() {
      const L = tasks.LABS[S.lab];
      const def = curDef();
      const tabs = L.tasks.map((t) => {
        const p = S.progress[t];
        const cls = p && p.done ? 'ok' : p && p.success ? 'exp' : '';
        return `<button type="button" class="task-tab" data-task="${t}" aria-pressed="${t === curTask()}"><span class="st ${cls}" aria-hidden="true"></span>${esc(t)}<span class="sr-only">${p && p.done ? ' (abgeschlossen)' : ''}</span></button>`;
      }).join('');
      $('#taskCard').innerHTML = `
        <h3>Aufgabe <small>${esc(L.name)}</small></h3>
        ${L.tasks.length > 1 ? `<div class="task-tabs" role="group" aria-label="Aufgaben">${tabs}</div>` : ''}
        <p class="task-title">${esc(def.title)}</p>
        <p>${esc(def.problem)}</p>
        <details class="material"><summary>Material</summary><p>${esc(def.material)}</p></details>`;
      $('#taskCard').querySelectorAll('[data-task]').forEach((b) => b.addEventListener('click', () => setTask(b.dataset.task)));
    }

    // ------------------------------------------------------------ Hilfe
    const HELP_NAMES = ['Keine Hilfe', 'Kleine Hilfe', 'Konkrete Hilfe'];
    function offerDue() {
      const p = prog(curTask());
      const e = curEngine();
      if (p.help > 0 || p.done) return false;
      if (p.fails >= 2 && p.offerSeen < p.fails) return true;
      // wiederholter gleicher Fehler (Warnmeldung) seit dem letzten Angebot
      const counts = {};
      for (const m of e.state.log) {
        if (m.kind !== 'warn' || !m.code || m.n <= (p.offerSeq || 0)) continue;
        if (['busy', 'safety', 'noTarget'].includes(m.code)) continue;
        counts[m.code] = (counts[m.code] || 0) + 1;
        if (counts[m.code] >= 2) return true;
      }
      return false;
    }
    function renderHelp() {
      if (S.view !== 'lab') return;
      const p = prog(curTask());
      const e = curEngine();
      let body = '';
      if (p.help > 0) {
        let h;
        try { h = curDef().help(e); } catch (err) { h = { small: 'Prüfe deinen Aufbau Schritt für Schritt.', concrete: 'Vergleiche den Zustand der Geräte mit der Aufgabe.' }; errors.push('Hilfe: ' + err.message); }
        if (p.done) h = { small: 'Die Aufgabe ist gelöst.', concrete: 'Du kannst eine andere Aufgabe wählen oder diesen Versuch mit „Neu beginnen“ wiederholen.' };
        const txt = p.help === 1 ? h.small : h.concrete;
        body = `<div class="help-text" id="helpText"><span class="lvl">${HELP_NAMES[p.help]}</span>${esc(txt)}</div>`;
      }
      const offer = offerDue() ? `<div class="help-offer" id="helpOffer"><span>Das hat noch nicht geklappt. Möchtest du einen Denkanstoß?</span><button type="button" class="btn" data-offer="1">Kleine Hilfe</button></div>` : '';
      const html = `<h3>Hilfe <small>du entscheidest</small></h3>
        <div class="segc" role="group" aria-label="Hilfestufe">${HELP_NAMES.map((n, i) => `<button type="button" data-help="${i}" aria-pressed="${p.help === i}">${n}</button>`).join('')}</div>
        ${body}${offer}`;
      if ($('#helpCard').__html === html) return;
      $('#helpCard').__html = html;
      $('#helpCard').innerHTML = html;
      $('#helpCard').querySelectorAll('[data-help]').forEach((b) => b.addEventListener('click', () => { setHelp(Number(b.dataset.help)); }));
      const ob = $('#helpCard [data-offer]');
      if (ob) ob.addEventListener('click', () => setHelp(1));
    }
    function setHelp(level) {
      const p = prog(curTask());
      p.help = level;
      p.offerSeen = p.fails;
      p.offerSeq = curEngine().state.seq;
      renderHelp(); renderEval(); save();
    }

    // ------------------------------------------------------------ Steuerung je Labor
    function act(name, ...args) {
      const e = curEngine();
      const r = e.act(name, ...args);
      if (r && r.safety) showSafety(e.state.safety);
      scheduleRender();
      saveSoon();
      return r;
    }
    const btn = (attrs, label, cls) => `<button type="button" class="btn ${cls || ''}" ${attrs}>${label}</button>`;

    function renderControls() {
      if (S.view !== 'lab') return;
      const e = curEngine();
      let html = '';
      if (e.state.safety) {
        html += `<section class="card safety-banner"><h3>Versuch angehalten</h3><p>${esc(e.state.safety.text)}</p>${btn('data-a="resume"', 'Ursache behoben – fortsetzen', 'primary')}</section>`;
      }
      if (S.lab === 'classic') html += classicControls(e);
      else if (S.lab === 'chroma') html += chromaControls(e);
      else html += distillControls(e);
      const box = $('#controls');
      // Nur neu aufbauen, wenn sich etwas geändert hat (kein „verschluckter“ Tipp)
      if (box.__html !== html) {
        box.__html = html;
        box.innerHTML = html;
        box.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => onControl(b.dataset)));
      }
      updateLive();
    }

    function onControl(d) {
      const e = curEngine();
      const a = d.a;
      if (a === 'resume') { const r = act('resume'); if (r.ok) $('#safety').hidden = true; return; }
      if (S.lab === 'classic') return classicAction(e, d);
      if (S.lab === 'chroma') return chromaAction(e, d);
      return distillAction(e, d);
    }

    // ------------------------------------------------ Klassisch
    function cLabel(e, id) {
      if (id === 'waste') return 'Ausguss';
      if (id === 'magnet') return 'Magnet';
      const c = e.container(id);
      return c ? (id === 'F' ? 'Trichter' : c.label) : id;
    }
    function contentText(e, c) {
      const d = e.describe(c);
      const parts = [];
      if (d.empty) return 'leer';
      const L = d.liquid;
      if (L > 0.3) {
        let liq;
        if (d.layered) liq = `zwei Flüssigkeiten: unten Wasser, oben Öl${d.emulsion > 3 ? ' (Grenzschicht noch trüb)' : ''}`;
        else if (c.oil > c.water) liq = 'Öl';
        else {
          const col = d.dyeConc > 0.11 ? 'kräftig rote' : d.dyeConc > 0.03 ? 'rötliche' : d.dyeConc > 0.004 ? 'leicht rosa' : 'farblose';
          liq = `${col} ${d.turbidity > 0.004 ? 'trübe' : 'klare'} Flüssigkeit`;
        }
        parts.push(`${liq}, Skala ≈ ${Math.round(L / (L > 30 ? 5 : 1)) * (L > 30 ? 5 : 1)} mL`);
      }
      const sed = [];
      if (c.sand * (1 - c.susp) > 0.2) sed.push('Sand');
      if (c.iron > 0.05) sed.push('graue Eisenspäne');
      if (c.saltS > 0.05) sed.push(L > 0.3 ? 'Salzkristalle' : 'weiße Kristalle');
      if (c.petals > 0.05) sed.push('Blütenstücke');
      if (sed.length) parts.push((L > 0.3 ? 'am Boden: ' : 'Feststoff: ') + sed.join(', '));
      else if (L <= 0.3 && c.sand > 0.05) parts.push('feuchter Rückstand');
      if (c.temp > 30) parts.push(`${Math.round(c.temp)} °C`);
      return parts.join(' · ');
    }

    function targetList(e, kind, exclude) {
      const st = e.state;
      const ids = [];
      for (const v of st.vessels) {
        if (v.id === exclude) continue;
        if (kind === 'pour' && v.type === 'source') continue;
        if (kind === 'water' && v.type === 'source') continue;
        if (kind === 'sieve' && (v.type === 'source' || v.type === 'watch')) continue;
        ids.push(v.id);
      }
      if (['pour', 'water', 'magnet', 'stir'].includes(kind)) {
        if (st.funnel) ids.push('F');
        if (st.sieve && st.sieve.on && kind !== 'stir') ids.push('T');
        if (st.sep && kind !== 'stir' && kind !== 'magnet') ids.push('S');
      }
      if (kind === 'pour') ids.push('waste');
      if (kind === 'weigh' && st.magnet) ids.push('magnet');
      return ids.filter((id) => id !== exclude);
    }

    function setPending(p, targets) { ui.pending = p; ui.targets = targets || []; renderControls(); }

    function classicControls(e) {
      const st = e.state;
      let h = '';
      // Auswahl
      const sel = ui.sel;
      const selC = sel && sel !== 'magnet' && !['water', 'hotwater', 'rod', 'scale', 'heater', 'waste'].includes(sel) ? e.container(sel) : null;
      h += '<section class="card" id="selCard"><h3>Auswahl <small>Gerät oder Gefäß antippen</small></h3>';
      h += `<div class="vessel-list" role="group" aria-label="Gefäße und Geräte">${st.vessels.map((v) => btn(`data-a="select" data-id="${v.id}" aria-pressed="${sel === v.id}"`, esc(v.type === 'source' ? (v.label.startsWith('Gemisch') ? 'Gemisch' : 'Blüten') : v.label.replace('Becherglas', 'Becherglas').replace('Erlenmeyerkolben', 'Erlenmeyer')))).join('')}
        ${st.funnel ? btn(`data-a="select" data-id="F" aria-pressed="${sel === 'F'}"`, 'Trichter') : ''}
        ${st.sieve ? btn(`data-a="select" data-id="T" aria-pressed="${sel === 'T'}"`, 'Teesieb') : ''}
        ${st.sep ? btn(`data-a="select" data-id="S" aria-pressed="${sel === 'S'}"`, 'Scheidetrichter') : ''}
        ${st.magnet ? btn(`data-a="select" data-id="magnet" aria-pressed="${sel === 'magnet'}"`, 'Magnet') : ''}
        ${btn(`data-a="select" data-id="water" aria-pressed="${sel === 'water' || sel === 'hotwater'}"`, 'Wasser')}
        ${btn(`data-a="select" data-id="scale" aria-pressed="${sel === 'scale'}"`, 'Waage')}</div>`;
      if (ui.pending) {
        const p = ui.pending;
        const what = { pour: `Umgießen (${{ careful: 'vorsichtig', fast: 'zügig', all: 'alles', upper: 'obere Schicht' }[p.mode]}) aus ${cLabel(e, p.from)}`, water: `${p.ml} mL ${p.hot ? 'heißes ' : ''}Wasser`, stir: 'Rühren', magnet: 'Magnet durchführen', release: 'Eisen abstreifen', scrape: `Rückstand aus ${cLabel(e, p.from)} überführen`, sieve: 'Teesieb auflegen', weigh: 'Wiegen', move: `${cLabel(e, p.id)} umstellen` }[p.type];
        h += `<p class="note" id="pendingNote"><b>${esc(what)}:</b> Ziel wählen – auf der Bühne antippen oder hier:</p>`;
        if (p.type === 'move') {
          const places = [['bench', 'auf den Tisch']];
          if (st.funnel) places.push(['filter', 'unter den Trichter']);
          if (st.heater) places.push(['heater', 'auf die Heizplatte']);
          if (st.sep) places.push(['sep', 'unter den Scheidetrichter']);
          h += `<div class="grid2">${places.map(([pl, t]) => btn(`data-a="target" data-id="place:${pl}"`, t)).join('')}</div>`;
        } else {
          h += `<div class="vessel-list">${ui.targets.map((id) => btn(`data-a="target" data-id="${id}"`, esc(cLabel(e, id)))).join('')}</div>`;
        }
        h += `<div class="row" style="margin-top:6px">${btn('data-a="cancel"', 'Abbrechen')}</div>`;
      } else if (!sel) {
        h += '<p class="muted">Wähle ein Gefäß oder Gerät. Danach erscheinen die möglichen Handlungen.</p>';
      } else if (selC) {
        const isDev = ['F', 'T', 'S'].includes(sel);
        const d = e.describe(selC.c);
        h += `<p><b>${esc(sel === 'F' ? 'Trichter' : selC.label)}</b>: <span data-live="content">${esc(contentText(e, selC.c))}</span></p>`;
        if (sel === 'F') {
          h += `<div class="subhead">Filterpapier</div><div class="grid3">${btn(`data-a="paper" data-v="folded" aria-pressed="${st.funnel.paper === 'folded'}"`, 'gefaltet einsetzen')}${btn(`data-a="paper" data-v="flat" aria-pressed="${st.funnel.paper === 'flat'}"`, 'flach auflegen')}${btn(`data-a="paper" data-v="none" aria-pressed="${st.funnel.paper === 'none'}"`, 'entfernen')}</div>`;
          h += `<p class="muted" style="margin-top:6px">Unter dem Trichter: ${e.funnelReceiver() ? esc(e.funnelReceiver().label) : 'kein Gefäß'}</p>`;
        }
        if (sel === 'S') {
          h += `<div class="subhead">Hahn</div><div class="segc" role="group" aria-label="Hahn">${[[0, 'zu'], [0.25, 'Spalt'], [1, 'offen']].map(([v, t]) => `<button type="button" data-a="cock" data-v="${v}" aria-pressed="${st.sep.cock === v}">${t}</button>`).join('')}</div>`;
          h += `<p class="muted" style="margin-top:6px">Unter dem Hahn: ${e.sepReceiver() ? esc(e.sepReceiver().label) : 'kein Gefäß'}</p>`;
        }
        h += '<div class="subhead">Handlungen</div><div class="grid2">';
        if (!isDev || sel === 'S') {
          if (!d.empty) {
            h += btn('data-a="pour" data-mode="careful"', 'Umgießen<small>vorsichtig, Bodensatz bleibt</small>');
            h += btn('data-a="pour" data-mode="fast"', 'Umgießen<small>zügig</small>');
            h += btn('data-a="pour" data-mode="all"', 'Alles umfüllen<small>mit Bodensatz</small>');
            if (d.layered) h += btn('data-a="pour" data-mode="upper"', 'Obere Schicht<small>abgießen</small>');
          }
        }
        if (sel !== 'S' && selC.type !== 'source') h += btn('data-a="stir"', 'Rühren<small>mit dem Glasstab</small>');
        if (selC.type !== 'source' && sel !== 'T') h += btn('data-a="waterHere"', 'Wasser zugeben');
        if (st.magnet && sel !== 'S') h += btn('data-a="magnetHere"', 'Magnet<small>hindurchführen</small>');
        if (st.magnet && st.magnet.iron > 0.005 && !isDev) h += btn('data-a="releaseHere"', 'Eisen hierher<small>vom Magneten abstreifen</small>');
        if ((sel === 'F' || sel === 'T') && !d.empty) h += btn('data-a="scrape"', 'Rückstand<small>in Gefäß überführen</small>');
        if (!isDev) {
          if (st.funnel && st.funnel.c && !e.describe(st.funnel.c).empty) h += btn('data-a="scrapeTo" data-from="F"', 'Rückstand hierher<small>aus dem Trichter</small>');
          if (st.sieve && !e.describe(st.sieve.c).empty) h += btn('data-a="scrapeTo" data-from="T"', 'Rückstand hierher<small>aus dem Teesieb</small>');
          h += btn('data-a="move"', 'Umstellen<small>Tisch, Trichter, Heizplatte …</small>');
          if (st.sieve && selC.type !== 'source' && selC.type !== 'watch') h += st.sieve.on === sel ? btn('data-a="sieveOff"', 'Teesieb<small>abnehmen</small>') : btn('data-a="sieveOn"', 'Teesieb<small>auflegen</small>');
        }
        if (sel === 'T' && st.sieve.on) h += btn('data-a="sieveOff"', 'Teesieb<small>abnehmen</small>');
        if (sel === 'T' && !st.sieve.on) h += btn('data-a="sievePick"', 'Teesieb<small>auf Gefäß legen</small>');
        h += btn('data-a="weighHere"', 'Wiegen<small>auf die Waage</small>');
        h += '</div>';
      } else if (sel === 'water' || sel === 'hotwater') {
        h += `<p><b>Wasser zugeben</b></p><div class="subhead">Menge</div><div class="segc">${[10, 25, 50].map((m) => `<button type="button" data-a="ml" data-v="${m}" aria-pressed="${ui.waterMl === m}">${m} mL</button>`).join('')}</div>`;
        h += `<div class="grid2" style="margin-top:8px">${btn('data-a="water" data-hot="0"', 'Kaltes Wasser<small>Spritzflasche, 20 °C</small>')}${st.water.hot ? btn('data-a="water" data-hot="1"', 'Heißes Wasser<small>Wasserkocher, 90 °C</small>') : ''}</div>`;
      } else if (sel === 'magnet') {
        h += `<p><b>Magnet in Folie</b>: ${st.magnet.iron > 0.005 ? `daran haften ${fmt(st.magnet.iron, 1)} g Eisenspäne` : 'nichts daran'}</p><div class="grid2">${btn('data-a="magnet"', 'Durch ein Gefäß führen')}${st.magnet.iron > 0.005 ? btn('data-a="release"', 'Eisen abstreifen in …') : ''}</div>`;
      } else if (sel === 'scale') {
        h += `<p><b>Waage</b>: ${st.lastWeigh ? `${esc(st.lastWeigh.label)}: <b>${fmt(st.lastWeigh.mass, 1)} g</b> (Inhalt, ohne Gefäß)` : 'noch nichts gewogen'}</p>${btn('data-a="weigh"', 'Gefäß wiegen …')}`;
      } else if (sel === 'heater') {
        h += '<p><b>Heizplatte</b></p>';
      } else if (sel === 'rod') {
        h += `<p><b>Glasstab</b></p>${btn('data-a="stirPick"', 'Rühren in …')}`;
      } else if (sel === 'waste') {
        h += '<p><b>Ausguss</b>: Was hier hineingegossen wird, ist verloren.</p>';
      }
      h += '</section>';
      // Geräte
      if (st.heater || st.sep) {
        h += '<section class="card"><h3>Geräte</h3>';
        if (st.heater) h += `<div class="subhead">Heizplatte <span class="muted">(darauf: ${e.atPlace('heater') ? esc(e.atPlace('heater').label) : 'nichts'})</span></div><div class="segc" role="group" aria-label="Heizplatte">${['Aus', 'Niedrig', 'Hoch'].map((t, i) => `<button type="button" data-a="heat" data-v="${i}" aria-pressed="${st.heater.level === i}">${t}</button>`).join('')}</div>`;
        if (st.sep) h += `<div class="subhead">Hahn am Scheidetrichter</div><div class="segc" role="group" aria-label="Hahn">${[[0, 'zu'], [0.25, 'Spalt'], [1, 'offen']].map(([v, t]) => `<button type="button" data-a="cock" data-v="${v}" aria-pressed="${st.sep.cock === v}">${t}</button>`).join('')}</div>`;
        h += '</section>';
      }
      return h;
    }

    function classicAction(e, d) {
      const st = e.state;
      const a = d.a;
      const sel = ui.sel;
      switch (a) {
        case 'select': ui.sel = d.id; ui.pending = null; ui.targets = []; renderControls(); return;
        case 'cancel': setPending(null); return;
        case 'target': return classicTarget(e, d.id);
        case 'paper': act('setPaper', d.v); return;
        case 'cock': act('setCock', Number(d.v)); return;
        case 'heat': act('setHeater', Number(d.v)); return;
        case 'pour': setPending({ type: 'pour', from: sel, mode: d.mode }, targetList(e, 'pour', sel)); return;
        case 'stir': act('stir', sel); return;
        case 'stirPick': setPending({ type: 'stir' }, targetList(e, 'stir')); return;
        case 'waterHere': ui.sel = 'water'; ui.waterTarget = sel; renderControls(); return;
        case 'ml': ui.waterMl = Number(d.v); renderControls(); return;
        case 'water':
          if (ui.waterTarget) { const t = ui.waterTarget; ui.waterTarget = null; act('addWater', t, ui.waterMl, d.hot === '1'); ui.sel = t; renderControls(); return; }
          setPending({ type: 'water', ml: ui.waterMl, hot: d.hot === '1' }, targetList(e, 'water')); return;
        case 'magnetHere': act('useMagnet', sel); return;
        case 'magnet': setPending({ type: 'magnet' }, targetList(e, 'magnet')); return;
        case 'releaseHere': act('releaseMagnet', sel); return;
        case 'release': setPending({ type: 'release' }, st.vessels.map((v) => v.id)); return;
        case 'scrape': setPending({ type: 'scrape', from: sel }, st.vessels.map((v) => v.id)); return;
        case 'scrapeTo': act('scrape', d.from, sel); return;
        case 'move': setPending({ type: 'move', id: sel }, ['place:bench', 'place:filter', 'place:heater', 'place:sep']); return;
        case 'sieveOn': act('placeSieve', sel); return;
        case 'sieveOff': act('placeSieve', null); return;
        case 'sievePick': setPending({ type: 'sieve' }, targetList(e, 'sieve')); return;
        case 'weighHere': act('weigh', sel); ui.sel = sel; renderControls(); return;
        case 'weigh': setPending({ type: 'weigh' }, targetList(e, 'weigh')); return;
        default:
      }
    }

    function classicTarget(e, id) {
      const p = ui.pending;
      if (!p) return;
      ui.pending = null; ui.targets = [];
      if (p.type === 'pour') act('pour', p.from, id, p.mode);
      else if (p.type === 'water') act('addWater', id, p.ml, p.hot);
      else if (p.type === 'stir') act('stir', id);
      else if (p.type === 'magnet') act('useMagnet', id);
      else if (p.type === 'release') act('releaseMagnet', id);
      else if (p.type === 'scrape') act('scrape', p.from, id);
      else if (p.type === 'sieve') act('placeSieve', id);
      else if (p.type === 'weigh') { act('weigh', id); }
      else if (p.type === 'move') {
        let place = id.startsWith('place:') ? id.slice(6) : id.startsWith('slot:') ? id.slice(5) : null;
        if (place) act('move', p.id, place);
      }
      renderControls();
    }

    function classicTap(e, hot) {
      const id = hot ? hot.id : null;
      if (ui.pending) {
        if (!id) { setPending(null); return; }
        if (ui.pending.type === 'move' && (id.startsWith('place:') || id.startsWith('slot:'))) return classicTarget(e, id);
        if (id === 'heater' && ui.pending.type === 'move') return classicTarget(e, 'place:heater');
        if (ui.targets.includes(id)) return classicTarget(e, id);
        setPending(null);
      }
      if (!id) { ui.sel = null; renderControls(); return; }
      if (id.startsWith('place:') || id.startsWith('slot:')) { if (ui.sel && e.vessel(ui.sel)) { ui.pending = { type: 'move', id: ui.sel }; classicTarget(e, id); } return; }
      if (id === 'hotwater') { ui.sel = 'water'; renderControls(); return; }
      if (id === 'rod') { ui.sel = 'rod'; renderControls(); return; }
      ui.sel = id; ui.waterTarget = null;
      renderControls();
    }

    // ------------------------------------------------ Chromatographie
    function chromaControls(e) {
      const st = e.state;
      const p = st.paper;
      const ch = st.chamber;
      const SB = chroma.SAMPLE_BY_ID;
      let h = '';
      const stateTxt = p.state === 'bench' ? (p.line ? 'liegt auf der Arbeitsunterlage' : 'neu, ohne Startlinie') : p.state === 'chamber' ? 'steht in der Kammer' : 'herausgenommen';
      h += `<section class="card"><h3>Papierstreifen <small>Nr. ${p.n} · ${esc(stateTxt)}</small></h3>`;
      if (p.state === 'bench' && !p.line) {
        h += `<div class="subhead">Startlinie zeichnen</div><div class="segc" role="group" aria-label="Schreibgerät">${[['pencil', 'Bleistift'], ['pen', 'Kugelschreiber']].map(([v, t]) => `<button type="button" data-a="lineTool" data-v="${v}" aria-pressed="${ui.lineTool === v}">${t}</button>`).join('')}</div>
          <div class="segc" role="group" aria-label="Höhe der Startlinie" style="margin-top:6px">${chroma.LINE_HEIGHTS.map((y) => `<button type="button" data-a="lineY" data-v="${y}" aria-pressed="${ui.lineY === y}">${fmt(y, 1)} cm</button>`).join('')}</div>
          <div class="row" style="margin-top:6px">${btn('data-a="line"', 'Startlinie ziehen', 'primary')}</div>`;
      }
      if (p.state === 'bench' && p.line) {
        h += `<div class="subhead">Probe auftupfen – erst Probe, dann Punkt wählen</div><div class="grid2">${chroma.SAMPLES.map((s, i) => btn(`data-a="sample" data-v="${s.id}" aria-pressed="${ui.sample === s.id}"`, `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:rgb(${s.rgb.join(',')})"></span> ${i + 1} ${esc(s.short)}`)).join('')}</div>`;
        h += `<div class="grid3" style="margin-top:6px">${[0, 1, 2].map((i) => btn(`data-a="spot" data-v="${i}" ${ui.sample ? '' : 'disabled'}`, `Punkt ${i + 1}<small>${p.lanes[i] ? esc(SB[p.lanes[i].sampleId].short) + ' ×' + p.lanes[i].n : 'frei'}</small>`)).join('')}</div>`;
      }
      if (p.state === 'chamber') h += `<p>Laufmittelfront: <b class="live" data-live="front">–</b></p>${btn('data-a="remove"', 'Streifen herausnehmen', 'primary')}`;
      if (p.state === 'removed') {
        const dryIn = Math.max(0, chroma.FRONT_VISIBLE - (st.time - p.removedAt));
        h += `<p>Front: ${p.frontMarked != null ? `markiert bei ${fmt(p.frontMarked, 1)} cm` : p.frontAtTop ? 'am oberen Rand – nicht bestimmbar' : dryIn > 0 ? '<span data-live="frontdry">noch sichtbar</span>' : 'eingetrocknet, nicht markiert'}</p>`;
        h += `<div class="grid2">${btn(`data-a="mark" ${p.frontMarked != null ? 'disabled' : ''}`, 'Front markieren<small>mit Bleistift</small>')}${btn(`data-a="archive" ${st.archive.some((a) => a.n === p.n) ? 'disabled' : ''}`, 'Ablegen<small>zum Vergleich</small>', 'primary')}</div>`;
      }
      h += `<div class="row" style="margin-top:8px">${btn(`data-a="newSheet" ${p.state === 'chamber' ? 'disabled' : ''}`, 'Neuer Streifen')}</div></section>`;
      // Kammer
      h += `<section class="card"><h3>Entwicklungskammer <small>${ch.solvent ? esc(chroma.SOLVENTS[ch.solvent].short || chroma.SOLVENTS[ch.solvent].name) + ' · ' + fmt(ch.level, 1) + ' cm' : 'leer'}</small></h3>`;
      h += `<div class="segc" role="group" aria-label="Laufmittel">${[['water', 'Wasser'], ['etoh', 'Ethanol-Wasser 1:1']].map(([v, t]) => `<button type="button" data-a="solvent" data-v="${v}" aria-pressed="${ui.solvent === v}">${t}</button>`).join('')}</div>`;
      h += `<div class="segc" role="group" aria-label="Füllmenge" style="margin-top:6px">${[['low', 'wenig (0,5 cm)'], ['mid', 'mittel (1 cm)'], ['high', 'viel (2 cm)']].map(([v, t]) => `<button type="button" data-a="level" data-v="${v}" aria-pressed="${ui.level === v}">${t}</button>`).join('')}</div>`;
      h += `<div class="grid2" style="margin-top:6px">${btn('data-a="fill"', 'Einfüllen')}${btn(`data-a="empty" ${ch.solvent ? '' : 'disabled'}`, 'Kammer leeren')}</div>`;
      if (ui.solvent === 'etoh') h += '<p class="note warn">Ethanol-Wasser-Gemisch: entzündlich (GHS02). Keine offene Flamme, Kammer abdecken.</p>';
      h += `<div class="grid2" style="margin-top:6px">${btn(`data-a="lid" data-v="${ch.lid ? 0 : 1}"`, ch.lid ? 'Deckel abnehmen' : 'Deckel auflegen')}${btn(`data-a="insert" ${p.state === 'bench' ? '' : 'disabled'}`, 'Streifen einstellen', p.state === 'bench' && p.line ? 'primary' : '')}</div></section>`;
      // Vergleich
      h += `<section class="card"><h3>Vergleich <small>${st.archive.length} abgelegt</small></h3>`;
      if (st.archive.length) h += `<ul class="gapfb">${st.archive.map((a) => `<li>${esc(a.id)} · ${a.solvent === 'water' ? 'Wasser' : 'Ethanol-Wasser'} · ${a.lanes.filter(Boolean).map((l) => esc(SB[l.sampleId].short)).join(', ')}${a.quality.valid ? '' : ' · <b style="color:#a65200">nicht aussagekräftig</b>'}</li>`).join('')}</ul>`;
      h += `<div class="grid2">${btn(`data-a="compare" ${st.archive.length ? '' : 'disabled'}`, 'Vergleich öffnen')}${btn(`data-a="expert" aria-pressed="${st.expert}"`, 'Expertenmodus<small>Lineal und Rf-Werte</small>')}</div>`;
      if (st.expert) h += expertTable(e);
      h += '</section>';
      return h;
    }
    function expertTable(e) {
      const p = e.state.paper;
      if (!p.line || p.state === 'bench') return '<p class="muted">Rf = Laufstrecke des Farbstoffs ÷ Laufstrecke der Front (beide ab der Startlinie). Miss am Lineal, sobald der Streifen entwickelt ist.</p>';
      const SB = chroma.SAMPLE_BY_ID;
      const front = p.frontMarked != null && !p.frontAtTop ? p.frontMarked - p.line.y : null;
      let rows = '';
      p.lanes.forEach((l, i) => {
        if (!l) return;
        e.zones(i).forEach((z) => { const rf = e.rf(z); rows += `<tr><td>${i + 1} ${esc(SB[l.sampleId].short)}</td><td>${esc(z.color)}</td><td>${fmt(z.s, 1)} cm</td><td>${rf == null ? '–' : fmt(rf, 2)}</td></tr>`; });
      });
      return `<p class="muted">Frontstrecke ab Startlinie: ${front == null ? (p.frontAtTop ? 'nicht bestimmbar (Front am Rand)' : 'Front noch nicht markiert') : fmt(front, 1) + ' cm'}</p>
        <table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr style="text-align:left;color:#6b7987"><th>Bahn</th><th>Zone</th><th>Strecke</th><th>Rf</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function chromaAction(e, d) {
      switch (d.a) {
        case 'lineTool': ui.lineTool = d.v; ui.tool = d.v; renderControls(); return;
        case 'lineY': ui.lineY = Number(d.v); renderControls(); return;
        case 'line': act('drawLine', ui.lineTool, ui.lineY); ui.tool = null; return;
        case 'sample': ui.sample = d.v; renderControls(); return;
        case 'spot': act('spot', Number(d.v), ui.sample); return;
        case 'solvent': ui.solvent = d.v; renderControls(); return;
        case 'level': ui.level = d.v; renderControls(); return;
        case 'fill': act('fill', ui.solvent, ui.level); return;
        case 'empty': act('emptyChamber'); return;
        case 'lid': act('setLid', d.v === '1'); return;
        case 'insert': ui.sample = null; act('insert'); return;
        case 'remove': act('remove'); return;
        case 'mark': act('markFront'); return;
        case 'archive': act('archive'); renderEval(); return;
        case 'newSheet': ui.sample = null; act('newSheet'); return;
        case 'compare': openCompare(e); return;
        case 'expert': act('setExpert', !e.state.expert); renderEval(); return;
        default:
      }
    }
    function chromaTap(e, hot) {
      const id = hot ? hot.id : null;
      const p = e.state.paper;
      if (!id) { ui.sample = null; ui.tool = null; renderControls(); return; }
      if (id.startsWith('sample:')) { ui.sample = id.slice(7); ui.tool = null; renderControls(); return; }
      if (id === 'tool:pencil' || id === 'tool:pen') { ui.tool = id.slice(5); ui.lineTool = ui.tool; ui.sample = null; renderControls(); return; }
      if (id.startsWith('line:')) { act('drawLine', ui.tool || ui.lineTool, Number(id.slice(5))); ui.tool = null; return; }
      if (id.startsWith('lane:')) { if (ui.sample) act('spot', Number(id.slice(5)), ui.sample); else toast('Wähle zuerst eine Probe (Stift antippen).'); return; }
      if (id.startsWith('solvent:')) { ui.solvent = id.slice(8); renderControls(); return; }
      if (id === 'lid') { act('setLid', true); return; }
      if (id === 'chamber') {
        if (p.state === 'bench' && p.line) act('insert');
        else if (p.state === 'chamber') act('remove');
        else if (!e.state.chamber.lid) act('setLid', true);
        return;
      }
      if (id === 'paper' && p.state === 'removed' && p.frontMarked == null) { act('markFront'); return; }
      if (id.startsWith('arch:') || id === 'compare') { if (e.state.archive.length) openCompare(e); return; }
    }

    function openCompare(e) {
      const cv = document.createElement('canvas');
      renderers.chroma.drawComparison(cv, e.state.archive, e.state.expert);
      openModal(`<h2 id="modalTitle">Chromatogramme im Vergleich</h2><div class="compare-wrap"></div>
        <p class="muted">Gleiche Farbstoffe wandern im gleichen Laufmittel gleich weit. Vergleiche die Höhen der Zonen.</p>
        <div class="modal-foot"><button type="button" class="btn primary" data-close>Schließen</button></div>`, true);
      $('#modalBox .compare-wrap').appendChild(cv);
    }

    // ------------------------------------------------ Destillation
    function distillControls(e) {
      const st = e.state; const P = st.parts;
      const N = distill.PART_NAMES;
      let h = '<section class="card"><h3>Aufbau <small>von unten nach oben</small></h3>';
      const row = (part, extra) => {
        const on = part === 'thermo' ? !!P.thermo : part === 'hoses' ? !!P.hoses : P[part];
        return `<div class="row" style="justify-content:space-between;margin:4px 0"><span style="font-size:14px">${on ? '✓' : '○'} ${esc(N[part])}</span><span class="row">${extra || ''}${on ? btn(`data-a="unmount" data-p="${part}"`, 'Abnehmen') : (part === 'thermo' || part === 'hoses' ? '' : btn(`data-a="mount" data-p="${part}"`, 'Anbringen', 'primary'))}</span></div>`;
      };
      h += row('heater') + row('flask');
      h += `<div class="subhead">Füllung: <span data-live="fill">–</span></div><div class="grid3">${distill.FILLS.map((m) => btn(`data-a="fill" data-v="${m}"`, `${m} mL<small>Gemisch einfüllen</small>`)).join('')}</div>`;
      h += row('chips');
      h += row('head');
      h += `<div class="subhead">Thermometer – Lage der Kugel</div><div class="grid3">${[['vapor', 'am seitlichen Abgang'], ['high', 'weit darüber'], ['liquid', 'in der Flüssigkeit']].map(([v, t]) => btn(`data-a="thermo" data-v="${v}" aria-pressed="${P.thermo === v}"`, t)).join('')}</div>${P.thermo ? `<div class="row" style="margin-top:4px">${btn('data-a="unmount" data-p="thermo"', 'Thermometer abnehmen')}</div>` : ''}`;
      h += row('condenser');
      h += `<div class="subhead">Kühlwasserschläuche</div><div class="grid2">${btn(`data-a="hoses" data-v="correct" aria-pressed="${P.hoses === 'correct'}"`, 'Zulauf unten<small>Ablauf oben</small>')}${btn(`data-a="hoses" data-v="reversed" aria-pressed="${P.hoses === 'reversed'}"`, 'Zulauf oben<small>Ablauf unten</small>')}</div>${P.hoses ? `<div class="row" style="margin-top:4px">${btn('data-a="unmount" data-p="hoses"', 'Schläuche abnehmen')}</div>` : ''}`;
      h += row('adapter') + row('receiver') + row('clamps') + row('stopper');
      h += '</section>';
      // Bedienung
      h += `<section class="card"><h3>Bedienung</h3>
        <dl class="kv"><dt>Thermometer</dt><dd class="live" data-live="sensor">–</dd><dt>Kolbeninhalt</dt><dd class="live" data-live="flaskT">–</dd><dt>Destillat</dt><dd class="live" data-live="dist">–</dd></dl>
        <div class="subhead">Heizpilz</div><div class="segc" role="group" aria-label="Heizpilz">${[0, 1, 2, 3, 4].map((l) => `<button type="button" data-a="heat" data-v="${l}" aria-pressed="${st.heater === l}">${l === 0 ? 'Aus' : l}</button>`).join('')}</div>
        <div class="subhead">Kühlwasser</div><div class="segc" role="group" aria-label="Kühlwasser">${['zu', 'schwach', 'mittel', 'stark'].map((t, l) => `<button type="button" data-a="cool" data-v="${l}" aria-pressed="${st.cooling === l}">${t}</button>`).join('')}</div>
        <div class="row" style="margin-top:8px">${btn(`data-a="swap" ${P.receiver ? '' : 'disabled'}`, 'Vorlage wechseln<small>neue Fraktion</small>')}</div></section>`;
      // Brennprobe
      const srcs = [['receiver', 'aus der Vorlage']].concat(st.fractions.map((f) => ['fraction:' + f.n, `aus Fraktion ${f.n}`])).concat([['flask', 'aus dem Kolben']]);
      h += `<section class="card"><h3>Brennprobe <small>getrennter Platz</small></h3>
        <p class="muted">Porzellanschale: <span data-live="dish">leer</span></p>
        <div class="subhead">Kleine Probe mit der Pipette entnehmen</div><div class="grid2">${srcs.map(([v, t]) => btn(`data-a="sample" data-v="${v}"`, t)).join('')}</div>
        <div class="subhead">Stabfeuerzeug</div><div class="grid2">${btn('data-a="ignite" data-v="dish"', 'An der Porzellanschale zünden', 'primary')}${btn('data-a="ignite" data-v="apparatus"', 'Am Vorstoß der Apparatur zünden')}</div>
        <div class="row" style="margin-top:6px">${btn('data-a="clean"', 'Schale leeren')}</div>
        ${st.burns.length ? `<ul class="gapfb">${st.burns.slice(-3).map((b) => `<li>${b.from === 'flask' ? 'Kolbenprobe' : b.from === 'receiver' ? 'Vorlage' : 'Fraktion ' + b.from.split(':')[1]}: ${{ burns: 'brennt mit bläulicher Flamme', flicker: 'flammt kurz auf, erlischt', none: 'nicht entzündbar' }[b.result]}</li>`).join('')}</ul>` : ''}</section>`;
      return h;
    }
    function distillAction(e, d) {
      switch (d.a) {
        case 'mount': act('mount', d.p); return;
        case 'unmount': act('unmount', d.p); return;
        case 'thermo': act('mount', 'thermo', d.v); return;
        case 'hoses': act('mount', 'hoses', d.v); return;
        case 'fill': act('fill', Number(d.v)); return;
        case 'heat': act('setHeater', Number(d.v)); return;
        case 'cool': act('setCooling', Number(d.v)); return;
        case 'swap': act('changeReceiver'); return;
        case 'sample': act('takeSample', d.v); return;
        case 'clean': act('cleanDish'); return;
        case 'ignite': act('ignite', d.v); ui.tool = null; return;
        default:
      }
    }
    function distillTap(e, hot) {
      const id = hot ? hot.id : null;
      const P = e.state.parts;
      if (!id) { ui.tool = null; ui.targets = []; renderControls(); return; }
      if (ui.tool === 'lighter') {
        if (id === 'dish') { act('ignite', 'dish'); }
        else if (id === 'apparatus' || id.startsWith('part:')) { act('ignite', 'apparatus'); }
        ui.tool = null; ui.targets = []; return;
      }
      if (id === 'lighter') { ui.tool = 'lighter'; ui.targets = ['dish', 'apparatus']; toast('Stabfeuerzeug: Ziel antippen (Porzellanschale).'); return; }
      if (id === 'tap') { act('setCooling', (e.state.cooling + 1) % 4); return; }
      if (id === 'dish') { if (e.state.dish.E + e.state.dish.W > 0.01) toast('Zünde die Probe mit dem Stabfeuerzeug.'); else act('takeSample', 'receiver'); return; }
      if (id.startsWith('part:')) {
        const part = id.slice(5);
        const mounted = part === 'thermo' ? !!P.thermo : part === 'hoses' ? !!P.hoses : P[part];
        if (part === 'thermo' && !mounted) { act('mount', 'thermo', 'vapor'); return; }
        if (part === 'hoses' && !mounted) { act('mount', 'hoses', 'correct'); return; }
        if (!mounted) { act('mount', part); return; }
        if (part === 'heater') { act('setHeater', (e.state.heater + 1) % 5); return; }
        toast(`${distill.PART_NAMES[part]}: Einstellungen im Bedienfeld.`);
      }
    }

    // ------------------------------------------------------------ Live-Werte
    function updateLive() {
      if (S.view !== 'lab') return;
      const e = curEngine();
      const set = (k, v) => { document.querySelectorAll(`[data-live="${k}"]`).forEach((el) => { if (el.textContent !== v) el.textContent = v; }); };
      if (S.lab === 'distill') {
        const st = e.state;
        set('sensor', st.sensor == null ? 'keine Anzeige' : fmt(st.sensor, 1) + ' °C');
        set('flaskT', fmt(st.liquid.T, 1) + ' °C');
        set('dist', fmt(e.distillate().vol, 1) + ' mL');
        set('fill', st.liquid.E + st.liquid.W > 0 ? fmt(st.liquid.E + st.liquid.W, 0) + ' mL im Kolben' : 'Kolben leer');
        set('dish', st.dish.E + st.dish.W > 0.01 ? `${fmt(st.dish.E + st.dish.W, 1)} mL Probe` : 'leer');
      } else if (S.lab === 'chroma') {
        const p = e.state.paper;
        set('front', `${fmt(p.front, 1)} cm über der Unterkante${p.line ? ' (' + fmt(Math.max(0, p.front - p.line.y), 1) + ' cm über der Startlinie)' : ''}`);
        if (p.state === 'removed') { const left = chroma.FRONT_VISIBLE - (e.state.time - p.removedAt); set('frontdry', left > 0 ? `noch ca. ${Math.ceil(left)} s sichtbar` : 'eingetrocknet'); }
      } else if (S.lab === 'classic' && ui.sel) {
        const c = ['water', 'hotwater', 'magnet', 'scale', 'rod', 'heater', 'waste'].includes(ui.sel) ? null : e.container(ui.sel);
        if (c) set('content', contentText(e, c.c));
      }
    }

    // ------------------------------------------------------------ Auswertung
    function renderEval() {
      if (S.view !== 'lab') return;
      const def = curDef();
      const p = prog(curTask());
      const e = curEngine();
      let h = '<h3>Auswertung</h3>';
      if (!p.success) {
        h += '<p>Wenn du meinst, dass dein Versuch gelungen ist, lass das Ergebnis prüfen. Die Auswertungsfragen erscheinen erst danach.</p>';
        h += `<button type="button" class="btn primary" id="btnCheck" data-check>Ergebnis prüfen</button>`;
        if (p.problems && p.problems.length) h += `<p class="note bad" style="margin-top:8px">Noch nicht gelungen:</p><ul class="problems">${p.problems.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>`;
      } else {
        const snap = p.snapshot;
        h += `<p><span class="success-badge">✓ Versuch gelungen</span> <span class="muted">(Modellzeit ${fmtTime(p.at)})</span></p>`;
        h += `<p class="muted">Die Fragen beziehen sich auf deinen Versuch zu diesem Zeitpunkt.</p>`;
        let qs = [];
        try { qs = def.questions(snap); } catch (err) { errors.push('Fragen: ' + err.message); }
        if (S.lab === 'chroma' && !e.state.expert) qs = qs.filter((q) => !q.expert);
        h += '<div id="questions">' + qs.map((q) => questionHtml(q, p)).join('') + '</div>';
        if (!p.done) h += `<button type="button" class="btn primary" data-answers>Antworten prüfen</button>`;
        if (p.done) {
          h += `<p style="margin-top:10px"><span class="success-badge">✓ Auswertung abgeschlossen</span></p>`;
          const steps = def.theory.slice(0, p.theory + 1);
          h += `<div class="theory"><b>Theorie Schritt für Schritt</b><ol>${steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
          if (p.theory < def.theory.length - 1) h += `<button type="button" class="btn" data-theory>Weiter</button>`;
          h += '</div>';
          if (p.theory >= def.theory.length - 1) h += `<div class="row" style="margin-top:8px"><button type="button" class="btn primary" data-notebook>Hefteintrag anzeigen</button></div>`;
        }
      }
      const box = $('#evalCard');
      box.innerHTML = h;
      const chk = box.querySelector('[data-check]'); if (chk) chk.addEventListener('click', checkResult);
      const ans = box.querySelector('[data-answers]'); if (ans) ans.addEventListener('click', checkAnswers);
      const th = box.querySelector('[data-theory]'); if (th) th.addEventListener('click', () => { p.theory++; renderEval(); save(); });
      const nb = box.querySelector('[data-notebook]'); if (nb) nb.addEventListener('click', showNotebook);
      // Entwürfe sichern
      box.querySelectorAll('[data-q]').forEach((el) => {
        const ev = el.type === 'radio' || el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(ev, () => { readAnswer(el.dataset.q); saveSoon(); });
      });
    }
    const fmtTime = (t) => { const m = Math.floor((t || 0) / 60), s = Math.floor((t || 0) % 60); return `${m}:${String(s).padStart(2, '0')} min`; };

    function questionHtml(q, p) {
      const res = p.results[q.id];
      const ok = res && res.ok;
      const val = p.answers[q.id];
      const dis = ok || p.done ? 'disabled' : '';
      let h = `<div class="q ${ok ? 'ok' : ''}" data-qid="${q.id}">`;
      h += `<div class="prompt">${esc(q.prompt)}${q.optional ? ' <span class="muted">(freiwillig)</span>' : ''}</div>`;
      if (q.type === 'choice' || q.type === 'multi') {
        const multi = q.type === 'multi';
        h += q.options.map(([id, t]) => {
          const checked = multi ? (val || []).includes(id) : val === id;
          return `<label class="opt"><input type="${multi ? 'checkbox' : 'radio'}" name="q-${q.id}" value="${esc(id)}" data-q="${q.id}" ${checked ? 'checked' : ''} ${dis}><span>${esc(t)}</span></label>`;
        }).join('');
      } else if (q.type === 'number') {
        h += `<input type="text" inputmode="decimal" class="num" data-q="${q.id}" value="${esc(val || '')}" aria-label="${esc(q.prompt)}" ${dis}> ${esc(q.unit || '')}`;
      } else if (q.type === 'gap') {
        const gv = val || {};
        const gr = res && res.gaps ? res.gaps : null;
        let i = 0;
        const textHtml = esc(q.text).replace(/\{(\w+)\}/g, (m, gid) => {
          const r = gr ? gr[i] : null; i++;
          const cls = r ? (core.gapOk(r) ? 'good' : r.status === 'near' ? 'nearin' : r.status === 'empty' ? '' : 'badin') : '';
          const lock = (r && core.gapOk(r)) || p.done ? 'disabled' : '';
          return `<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" class="${cls}" data-q="${q.id}" data-gap="${gid}" value="${esc(gv[gid] || '')}" aria-label="Lücke ${i}" ${lock}>`;
        });
        h += `<div class="gaptext">${textHtml}</div>`;
        if (p.help === 2 && !p.done) h += `<div class="wordbank" aria-label="Wortauswahl">${tasks.wordbank(q).map((w) => `<span>${esc(w)}</span>`).join('')}</div>`;
        if (gr) h += `<ul class="gapfb">${gr.map((r, k) => (core.gapOk(r) ? (r.status === 'typo' ? `<li class="ok">Lücke ${k + 1}: ${esc(r.feedback)}</li>` : '') : r.status === 'empty' ? `<li class="bad">Lücke ${k + 1}: noch leer.</li>` : `<li class="bad">Lücke ${k + 1}: ${esc(r.feedback)}</li>`)).join('')}</ul>`;
      }
      if (res && q.type !== 'gap') h += `<div class="fb ${res.ok ? 'ok' : 'bad'}">${esc(res.ok ? '✓ ' + res.feedback : res.feedback)}</div>`;
      if (res && q.type === 'gap' && res.ok) h += '<div class="fb ok">✓ Alle Lücken richtig.</div>';
      h += '</div>';
      return h;
    }

    function readAnswer(qid) {
      const p = prog(curTask());
      const box = $('#evalCard');
      const els = box.querySelectorAll(`[data-q="${qid}"]`);
      if (!els.length) return;
      const first = els[0];
      if (first.type === 'radio') { const c = [...els].find((x) => x.checked); p.answers[qid] = c ? c.value : null; }
      else if (first.type === 'checkbox') p.answers[qid] = [...els].filter((x) => x.checked).map((x) => x.value);
      else if (first.dataset.gap) { const o = p.answers[qid] || {}; els.forEach((x) => { o[x.dataset.gap] = x.value; }); p.answers[qid] = o; }
      else p.answers[qid] = first.value;
    }

    function checkResult() {
      const def = curDef();
      const p = prog(curTask());
      const e = curEngine();
      let r;
      try { r = def.evaluate(e); } catch (err) { errors.push('Bewertung: ' + err.message); r = { success: false, problems: [{ code: 'error', text: 'Das Ergebnis konnte nicht geprüft werden.' }] }; }
      if (r.success) {
        p.success = true; p.snapshot = r.snapshot; p.at = e.state.time; p.problems = null;
        toast('Versuch gelungen – jetzt folgt die Auswertung.', '');
      } else {
        p.fails++; p.problems = r.problems;
      }
      renderEval(); renderHelp(); renderTask(); save();
      const box = $('#evalCard');
      if (box && box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
    }

    function checkAnswers() {
      const def = curDef();
      const p = prog(curTask());
      const e = curEngine();
      let qs = def.questions(p.snapshot);
      if (S.lab === 'chroma' && !e.state.expert) qs = qs.filter((q) => !q.expert);
      for (const q of qs) readAnswer(q.id);
      let allOk = true, wrong = 0;
      for (const q of qs) {
        const prev = p.results[q.id];
        if (prev && prev.ok) continue;
        const val = p.answers[q.id];
        if (q.optional && (val == null || val === '')) { delete p.results[q.id]; continue; }
        const r = tasks.checkAnswer(q, val);
        // Lückentext: richtige Lücken bleiben erhalten, falsche werden gemeldet
        p.results[q.id] = r;
        if (!r.ok) { allOk = false; wrong++; }
      }
      if (allOk) { p.done = true; p.theory = 0; toast('Auswertung abgeschlossen.', ''); }
      else { p.fails++; }
      renderEval(); renderHelp(); renderTask(); save();
      if (!allOk) {
        const firstBad = $('#evalCard .q:not(.ok)');
        if (firstBad && firstBad.scrollIntoView) firstBad.scrollIntoView({ block: 'nearest' });
      }
      return wrong;
    }

    function showNotebook() {
      const def = curDef();
      const p = prog(curTask());
      const n = def.notebook(p.snapshot);
      openModal(`<h2 id="modalTitle">Hefteintrag zum Abschreiben</h2>
        <div class="notebook" id="notebook"><h3>${esc(n.title)}</h3>
          <h4>Versuch / Durchführung</h4><p>${esc(n.versuch)}</p>
          <h4>Beobachtung</h4><p>${esc(n.beobachtung)}</p>
          <h4>Erklärung</h4><p>${esc(n.erklaerung)}</p>
          <h4>Ergebnis / Merksatz</h4><p>${esc(n.merksatz)}</p></div>
        <p class="muted">Schreibe den Eintrag sauber in dein Heft ab.</p>
        <div class="modal-foot"><button type="button" class="btn primary" data-close>Schließen</button></div>`);
    }

    // ------------------------------------------------------------ Modal
    function openModal(html, wide) {
      const m = $('#modal'), box = $('#modalBox');
      box.className = 'modal' + (wide ? ' wide' : '');
      box.innerHTML = html;
      m.hidden = false;
      box.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
      const f = box.querySelector('button, [tabindex]');
      if (f) f.focus();
    }
    function closeModal() { $('#modal').hidden = true; }

    function restartDialog() {
      const L = S.lab;
      const t = curTask();
      const opts = L === 'chroma'
        ? [['paper', 'Nur Streifen und Kammer zurücksetzen', 'Abgelegte Chromatogramme und gelöste Aufgaben bleiben erhalten.'], ['lab', 'Chromatographie ganz neu', 'Auch Vergleich und Ergebnisse von C-1 bis C-3 werden gelöscht.']]
        : [['apparatus', 'Nur diesen Versuchsaufbau zurücksetzen', 'Gelöste Aufgaben und Antworten bleiben erhalten.'], ['task', `Aufgabe ${t} ganz neu`, 'Auch Ergebnis und Antworten dieser Aufgabe werden gelöscht.']];
      openModal(`<h2 id="modalTitle">Neu beginnen</h2><div class="restart-opts">${opts.map(([k, a, b]) => `<button type="button" class="btn" data-restart="${k}"><span><b>${esc(a)}</b><small>${esc(b)}</small></span></button>`).join('')}</div>
        <div class="modal-foot"><button type="button" class="btn" data-close>Abbrechen</button></div>`);
      $('#modalBox').querySelectorAll('[data-restart]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.restart;
        if (k === 'apparatus') resetEngine(t);
        else if (k === 'task') { resetEngine(t); delete S.progress[t]; }
        else if (k === 'paper') {
          const e = curEngine();
          const arch = e.state.archive, count = e.state.paperCount, expert = e.state.expert;
          resetEngine(t);
          const n = curEngine();
          n.state.archive = arch; n.state.paperCount = count + 1; n.state.paper.n = count + 1; n.state.expert = expert;
        } else if (k === 'lab') { resetEngine(t); for (const id of tasks.LABS.chroma.tasks) delete S.progress[id]; }
        closeModal(); $('#safety').hidden = true;
        renderAll(); save();
      }));
    }

    // ------------------------------------------------------------ Zeiger (Antippen / Ziehen)
    let down = null;
    function pointerDown(ev) {
      if (S.view !== 'lab') return;
      const r = renderer();
      const pt = r.toLogical(ev.clientX, ev.clientY);
      down = { x: ev.clientX, y: ev.clientY, hot: r.hit(pt.x, pt.y), drag: false };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ältere Browser */ }
    }
    function pointerMove(ev) {
      const r = renderer();
      if (!down) {
        const pt = r.toLogical(ev.clientX, ev.clientY);
        canvas.classList.toggle('pointer', !!r.hit(pt.x, pt.y));
        return;
      }
      if (!down.drag && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 14 && S.lab === 'classic' && down.hot && curEngine().vessel(down.hot.id)) {
        down.drag = true;
        const e = curEngine();
        ui.sel = down.hot.id;
        ui.pending = { type: 'drag', from: down.hot.id };
        ui.targets = targetList(e, 'pour', down.hot.id).concat(['place:filter', 'place:heater', 'place:sep', 'place:bench']);
        canvas.classList.add('grabbing');
      }
    }
    function pointerUp(ev) {
      if (!down) return;
      const r = renderer();
      const pt = r.toLogical(ev.clientX, ev.clientY);
      const hot = r.hit(pt.x, pt.y);
      const e = curEngine();
      if (down.drag) {
        canvas.classList.remove('grabbing');
        const from = down.hot.id;
        ui.pending = null; ui.targets = [];
        if (hot && hot.id !== from) {
          if (hot.id.startsWith('place:') || hot.id.startsWith('slot:')) act('move', from, hot.id.startsWith('place:') ? hot.id.slice(6) : hot.id.slice(5));
          else if (hot.id === 'heater') act('move', from, 'heater');
          else if (e.container(hot.id) || hot.id === 'waste') act('pour', from, hot.id, e.describe(e.vessel(from).c).dry ? 'all' : 'careful');
        }
        renderControls();
      } else {
        const h = down.hot;
        if (S.lab === 'classic') classicTap(e, h);
        else if (S.lab === 'chroma') chromaTap(e, h);
        else distillTap(e, h);
      }
      down = null;
    }

    // ------------------------------------------------------------ Ereignisse
    function bind() {
      $('#btnHome').addEventListener('click', () => go('start'));
      document.querySelectorAll('#labSwitch button').forEach((b) => b.addEventListener('click', () => go('lab', b.dataset.lab)));
      document.querySelectorAll('#speed button').forEach((b) => b.addEventListener('click', () => { S.speed = Number(b.dataset.speed); ui.speed = S.speed; renderAll(); save(); }));
      $('#btnRestart').addEventListener('click', restartDialog);
      $('#btnPanel').addEventListener('click', () => { S.panelOpen = !S.panelOpen; renderAll(); setTimeout(() => renderer().resize(), 30); save(); });
      $('#safetyOk').addEventListener('click', () => { $('#safety').hidden = true; });
      $('#btnResetAll').addEventListener('click', () => {
        openModal(`<h2 id="modalTitle">Alle Ergebnisse zurücksetzen?</h2><p>Alle Versuche, Antworten und Chromatogramme in diesem Browserfenster werden gelöscht.</p><div class="modal-foot"><button type="button" class="btn" data-close>Abbrechen</button><button type="button" class="btn danger" id="confirmReset">Zurücksetzen</button></div>`);
        $('#confirmReset').addEventListener('click', () => {
          for (const k of Object.keys(engines)) delete engines[k];
          S.engines = {}; S.progress = {};
          closeModal(); save(); renderStart();
        });
      });
      $('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal') closeModal(); });
      root.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (ui.pending) setPending(null); }
      });
      canvas.addEventListener('pointerdown', pointerDown);
      canvas.addEventListener('pointermove', pointerMove);
      canvas.addEventListener('pointerup', pointerUp);
      canvas.addEventListener('pointercancel', () => { down = null; canvas.classList.remove('grabbing'); });
      root.addEventListener('pagehide', save);
    }

    // ------------------------------------------------------------ Hauptschleife
    let last = 0, liveTimer = 0, saveTick = 0;
    function loop(now) {
      const dt = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 0.016;
      last = now;
      try {
        if (S.view === 'lab') {
          const e = curEngine();
          const busy = !!e.state.op;
          // Laufende Handlungen (Gießen, Einsetzen …) werden in normaler Geschwindigkeit gezeigt
          const speed = busy ? Math.min(S.speed, 2) : S.speed;
          if (speed > 0) e.advance(dt * speed);
          ui.speed = S.speed;
          renderer().frame(dt, e, ui);
          liveTimer += dt; saveTick += dt;
          if (liveTimer > 0.25) { liveTimer = 0; updateLive(); }
          if (saveTick > 3) { saveTick = 0; save(); }
        }
      } catch (err) { errors.push('Schleife: ' + (err && err.message)); }
      root.requestAnimationFrame(loop);
    }

    function start() {
      loadSaved();
      bind();
      const stage = $('#stage');
      const onResize = () => { if (S.view === 'lab') renderer().resize(); };
      if (root.ResizeObserver) new ResizeObserver(onResize).observe(stage);
      root.addEventListener('resize', onResize);
      const params = new URLSearchParams(root.location.search);
      const lab = params.get('lab');
      if (lab && tasks.LABS[lab]) go('lab', lab);
      else go(S.view === 'lab' ? 'lab' : 'start', S.lab);
      root.requestAnimationFrame(loop);
    }

    return {
      start, S, ui, engines, errors, curEngine, curTask, renderer, go, setTask, save,
      hotspots: () => renderer().hotspots()
    };
  }

  TL.ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
