/*
 * Destillation – Oberfläche (DOM)
 *
 * Verbindet Fachmodell, Renderer und Bedienfeld. Alle Handlungen laufen über
 * engine.act(); die Oberfläche setzt keinen Modellzustand direkt.
 * Ablauf und Bezeichnungen nach shared/labkit/DESIGN.md (Abschnitt 6).
 */
(function (root) {
  'use strict';
  const { core, splitter } = root.LK;
  const M = root.DS.model;
  const T = root.DS.tasks;
  const R = root.DS.render;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const fmt = core.fmt;
  const STORE = 'sivex-destillation-v1';

  function freshTaskState() { return { fails: 0, offer: false, tip: 0, result: null, answers: {}, graded: null, gradedSig: null, solution: false, confirmSolution: false }; }
  function initialUi() {
    return {
      tab: 'task', speed: 10, panel: true, selected: null, selectedPart: null,
      explore: false, labelsOn: false, overlay: null, explain: false,
      tasks: { ew: freshTaskState(), pw: freshTaskState(), pew: freshTaskState() },
      names: { answers: {}, graded: null, tip: 0, fails: 0, solution: false },
      fns: { answers: {}, graded: null, tip: 0, fails: 0, solution: false },
      confirmRestart: null
    };
  }

  function createUI() {
    let saved = null;
    try { saved = JSON.parse(root.sessionStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    const engine = M.createEngine(saved && saved.model);
    const ui = Object.assign(initialUi(), saved && saved.ui ? saved.ui : {});
    const st = () => engine.state;
    const labelMode = () => (ui.labelsOn ? 'names' : ui.tab === 'trainer' ? 'numbers' : null);
    const view = () => Object.assign({}, ui, { labels: labelMode() });
    const renderer = R.createRenderer($('#lab'), st, view);

    // ------------------------------------------------------------ Speichern
    let saveTimer = null;
    function saveNow() {
      clearTimeout(saveTimer);
      try { root.sessionStorage.setItem(STORE, JSON.stringify({ model: engine.state, ui })); } catch (e) { /* ohne Speicher */ }
    }
    function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
    root.addEventListener('pagehide', saveNow);
    root.addEventListener('beforeunload', saveNow);

    // ------------------------------------------------------------ Meldungen
    let toastTimer = null;
    function toast(text, kind) {
      if (!text) return;
      const el = $('#toast');
      el.textContent = text;
      el.className = 'toast show' + (kind === 'warn' ? ' warn' : '');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'warn' ? 6500 : 4200);
    }
    engine.on('message', (m) => { if (m.code !== 'safety' && !locked()) toast(m.text, m.kind); });
    engine.on('safety', () => { ui.selected = null; refresh(true); });
    engine.on('change', (e) => { if (e && e.action === 'opDone') refresh(true); });

    // ------------------------------------------------------------ Handlungen
    function act(name, ...args) {
      const r = engine.act(name, ...args);
      refresh(true);
      save();
      return r;
    }
    const isApparatus = (id) => ['flask', 'condenser', 'adapter', 'receiver', 'thermo', 'mantle', 'nozzle:high', 'nozzle:low'].includes(id);

    function hit(id) {
      const s = st();
      if (id.startsWith('part:')) {
        const p = id.slice(5);
        ui.selectedPart = ui.selectedPart === p ? null : p;
        refresh(true);
        return;
      }
      const sel = ui.selected;
      // Gewähltes Gerät erneut antippen: zurücklegen
      if (sel && sel === id) { ui.selected = null; toast(id === 'thermo' ? 'Thermometer abgewählt.' : 'Zurückgelegt.'); refresh(true); return; }
      if (sel === 'lighter') {
        if (id === 'dish') { const r = act('ignite', 'dish'); if (r.ok) ui.selected = null; refresh(true); return; }
        if (id === 'receiver' && !s.receiver.present) { toast('Nie die ganze Vorlage anzünden – nur die kleine Probe in der Porzellanschale.', 'warn'); return; }
        if (isApparatus(id)) { ui.selected = null; act('ignite', 'apparatus'); return; }
      }
      if (sel === 'pipette') {
        if (id === 'receiver') { const r = act('takeSample', 'receiver'); if (r.ok) ui.selected = null; refresh(true); return; }
        if (id === 'flask') { ui.selected = null; act('takeSample', 'flask'); return; }
        if (id === 'dish') { ui.selected = null; act('sampleToDish'); return; }
      }
      if (sel && sel.startsWith('hose:') && id.startsWith('nozzle:')) {
        const r = act('connectHose', sel.slice(5), id.slice(7));
        if (r.ok) ui.selected = null;
        refresh(true);
        return;
      }
      switch (id) {
        case 'bottle': act('fill'); break;
        case 'stones': act('addStones'); break;
        case 'mantle': act('setHeater', !s.heater.on); break;
        case 'tap': act('setWater', !s.water.on); break;
        case 'thermo': ui.selected = 'thermo'; toast(`${M.THERMO[s.thermo].name}. Mit „Thermometer ▲/▼“ verschieben.`); refresh(true); break;
        case 'hose:inlet': ui.selected = id; toast('Zulaufschlauch (vom Wasserhahn) gewählt. Tippe auf einen Anschluss am Kühler.'); refresh(true); break;
        case 'hose:outlet': ui.selected = id; toast('Ablaufschlauch (zum Ausguss) gewählt. Tippe auf einen Anschluss am Kühler.'); refresh(true); break;
        case 'nozzle:high': case 'nozzle:low': {
          const nz = id.slice(7);
          if (s.hoses.inlet === nz || s.hoses.outlet === nz) act('disconnectHose', nz);
          else toast('Wähle zuerst einen Schlauch: das freie Ende am Wasserhahn (Zulauf) oder am Ausguss (Ablauf).', 'warn');
          break;
        }
        case 'receiver': case 'receiverSpot': act('toggleReceiver'); break;
        case 'pipette':
          if (s.pipette) { toast('In der Pipette ist eine Probe. Tippe auf die Porzellanschale.'); ui.selected = 'pipette'; }
          else { ui.selected = 'pipette'; toast(s.receiver.present ? 'Pipette gewählt. Proben nimmt man aus der abgenommenen Vorlage – nimm sie zuerst ab („Vorlage abnehmen“).' : 'Pipette gewählt. Tippe auf die Vorlage am Prüfplatz, um eine Probe zu entnehmen.'); }
          refresh(true); break;
        case 'lighter': ui.selected = 'lighter'; toast('Stabfeuerzeug gewählt. Zünde nur die Probe in der Porzellanschale an.', 'warn'); refresh(true); break;
        case 'dish':
          if (s.pipette) act('sampleToDish');
          else toast(s.dish && !s.dish.result ? 'Wähle das Stabfeuerzeug und tippe dann auf die Schale.' : 'Nimm mit der Pipette eine Probe aus der Vorlage und gib sie in die Schale.');
          break;
        case 'flask': toast(s.filled ? `Rundkolben: ${fmt(M.vol(s.flask.c), 1)} mL Flüssigkeit.` : 'Der Rundkolben ist leer. Tippe auf die Flasche, um das Gemisch einzufüllen.'); break;
        case 'condenser': case 'adapter': toast(id === 'condenser' ? 'Liebigkühler: innen Dampf, außen im Mantel Kühlwasser.' : 'Vorstoß: leitet das Destillat in die Vorlage.'); break;
        default: break;
      }
    }

    const HIT_LABELS = {
      bottle: () => `Flasche mit ${M.MIXES[st().mix].name}: in den Kolben einfüllen`,
      stones: () => 'Siedesteine in den Kolben geben',
      mantle: () => `Heizpilz: Heizung ${st().heater.on ? 'ausschalten' : 'einschalten'}`,
      tap: () => `Wasserhahn: Kühlwasser ${st().water.on ? 'abdrehen' : 'aufdrehen'}`,
      flask: () => 'Rundkolben',
      thermo: () => `Thermometer (${M.THERMO[st().thermo].name}) auswählen`,
      condenser: () => 'Liebigkühler',
      adapter: () => 'Vorstoß',
      'nozzle:high': () => 'Oberer Anschluss des Kühlmantels',
      'nozzle:low': () => 'Unterer Anschluss des Kühlmantels',
      'hose:inlet': () => 'Freies Ende des Zulaufschlauchs (vom Wasserhahn)',
      'hose:outlet': () => 'Freies Ende des Ablaufschlauchs (zum Ausguss)',
      receiver: () => (st().receiver.present ? 'Vorlage abnehmen und abstellen' : 'Vorlage (abgestellt): antippen stellt sie zurück unter den Vorstoß'),
      receiverSpot: () => 'Platz unter dem Vorstoß: Vorlage zurückstellen',
      pipette: () => 'Pipette',
      lighter: () => 'Stabfeuerzeug',
      dish: () => 'Porzellanschale am Prüfplatz'
    };
    function hitLabel(id) {
      if (id.startsWith('part:')) return 'Gerät erkunden: ' + (id === 'part:mixture' ? M.MIXES[st().mix].name : T.PART_NAMES[id.slice(5)]);
      return HIT_LABELS[id] ? HIT_LABELS[id]() : id;
    }

    let hitSig = '';
    function layoutHits() {
      const areas = renderer.hitAreas(view());
      const s = st();
      const sig = JSON.stringify(areas.map((a) => [a.id, a.x, a.y, a.w, a.h])) + ui.selected + ui.selectedPart + s.heater.on + s.water.on + s.receiver.present + s.receiver.stopper + s.thermo + JSON.stringify(s.hoses);
      if (sig === hitSig) return;
      hitSig = sig;
      const box = $('#hits');
      const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.hit : null;
      box.innerHTML = areas.map((a) => `<button type="button" class="hit" data-hit="${a.id}" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px" aria-label="${esc(hitLabel(a.id))}"${ui.selected === a.id || ui.selectedPart === a.id.slice(5) ? ' aria-pressed="true"' : ''}></button>`).join('');
      if (focused) { const b = box.querySelector(`[data-hit="${focused}"]`); if (b) b.focus(); }
    }
    $('#hits').addEventListener('click', (e) => { const b = e.target.closest('[data-hit]'); if (b) hit(b.dataset.hit); });

    // ------------------------------------------------------------ Handlungsleiste und Ansicht
    /** Versuch begonnen? Dann sind Beschriftung und Erkunden gesperrt. */
    const started = () => { const s = st(); return !!(s.filled || s.op || s.stones || s.heater.on || s.water.on || s.hoses.inlet || s.hoses.outlet || s.thermo !== 'high' || s.drops.seq > 0); };
    /** Beschriftung bzw. Erkunden aktiv: keine Handgriffe, keine Fehlermeldungen. */
    const locked = () => !!(ui.labelsOn || ui.explore);
    function actionsHtml() {
      const s = st();
      const b = (a, text, extra) => `<button type="button" class="lk-btn" data-act="${a}"${extra || ''}>${text}</button>`;
      const out = [];
      out.push(b('fill', s.filled ? 'Eingefüllt<span class="ok" aria-hidden="true">✓</span>' : 'Einfüllen', s.filled ? ' disabled aria-label="Gemisch ist eingefüllt"' : ''));
      out.push(b('addStones', s.stones ? 'Siedesteine<span class="ok" aria-hidden="true">✓</span>' : 'Siedesteine', s.stones ? ' disabled aria-label="Siedesteine sind im Kolben"' : ''));
      out.push(`<span class="grp${ui.selected === 'thermo' ? ' hint' : ''}" role="group" aria-label="Thermometer verschieben"><span class="grp-l">Thermometer</span>${b('thermoUp', '▲', ' aria-label="Thermometer höher schieben"')}${b('thermoDown', '▼', ' aria-label="Thermometer tiefer schieben"')}</span>`);
      out.push(b('toggleReceiver', s.receiver.present ? 'Vorlage abnehmen' : 'Vorlage unterstellen'));
      if (s.expert) out.push(b('changeReceiver', 'Vorlage wechseln'));
      if (s.receiver.present) {
        const lab = s.receiver.stopper ? 'Stopfen von der Vorlage nehmen' : 'Stopfen auf die Vorlage setzen';
        out.push(b('toggleStopper', s.receiver.stopper ? 'Stopfen ab' : 'Stopfen', ` aria-label="${lab}"`));
      }
      return out.join('');
    }
    function viewsHtml() {
      const pre = !started();
      const t = (id, text, on, title, dis) => `<button type="button" class="lk-btn" data-view="${id}" aria-pressed="${!!on}" title="${esc(title)}" aria-label="${esc(title.split(':')[0])}"${dis ? ' disabled' : ''}>${text}</button>`;
      return [
        t('labels', 'Namen', ui.labelsOn, pre ? 'Beschriftung: Fachbegriffe an den Geräten anzeigen (nur vor dem Versuch)' : 'Beschriftung: nur vor dem Versuch – für einen neuen Durchgang „Neu beginnen“', !pre),
        t('explore', 'Erkunden', ui.explore, pre ? 'Geräte erkunden: Gerät antippen zeigt Name und Funktion (nur vor dem Versuch)' : 'Geräte erkunden: nur vor dem Versuch – für einen neuen Durchgang „Neu beginnen“', !pre),
        t('detail', 'Kühler', ui.overlay === 'detail', 'Kühler-Detail: vergrößerter Schnitt durch den Liebigkühler'),
        t('explain', 'Teilchen', ui.explain, 'Erklärmodus: Dampfweg als Teilchen (in Wirklichkeit unsichtbar)'),
        t('chart', 'Diagramm', ui.overlay === 'chart', 'Temperatur-Zeit-Diagramm')
      ].join('');
    }
    let actSig = '';
    function renderActions() {
      const s = st();
      if (started() && locked()) { ui.labelsOn = false; ui.explore = false; ui.selectedPart = null; }
      const sig = [s.filled, s.stones, s.expert, s.receiver.present, s.receiver.stopper, ui.selected, ui.labelsOn, ui.explore, ui.overlay, ui.explain, started(), locked()].join('|');
      if (sig === actSig) return;
      actSig = sig;
      const f = document.activeElement && document.activeElement.dataset ? (document.activeElement.dataset.act || document.activeElement.dataset.view) : null;
      $('#actions').innerHTML = actionsHtml();
      $('#views').innerHTML = '<span class="grp-l">Ansicht</span>' + viewsHtml();
      $('#deck').querySelectorAll('button').forEach((x) => { if (locked()) x.disabled = true; else if (!x.closest('#actions')) x.disabled = false; });
      if (f) { const x = document.querySelector(`[data-act="${f}"], [data-view="${f}"]`); if (x && !x.disabled) x.focus(); }
    }
    $('#actions').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
    $('#views').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (!b) return;
      const v = b.dataset.view;
      if (v === 'labels') { ui.labelsOn = !ui.labelsOn; if (ui.labelsOn) { ui.explore = false; ui.selected = null; ui.selectedPart = null; } }
      else if (v === 'explore') { ui.explore = !ui.explore; ui.selected = null; if (ui.explore) ui.labelsOn = false; else ui.selectedPart = null; }
      else if (v === 'detail') ui.overlay = ui.overlay === 'detail' ? null : 'detail';
      else if (v === 'chart') ui.overlay = ui.overlay === 'chart' ? null : 'chart';
      else if (v === 'explain') ui.explain = !ui.explain;
      refresh(true); save();
    });

    // ------------------------------------------------------------ Schalter Heizung/Kühlwasser
    function syncDeck() {
      const s = st();
      const h = $('#btnHeat'), w = $('#btnWater');
      h.setAttribute('aria-pressed', String(s.heater.on));
      h.querySelector('b').textContent = s.heater.on ? 'EIN' : 'AUS';
      h.setAttribute('aria-label', `Heizung ${s.heater.on ? 'EIN – zum Ausschalten tippen' : 'AUS – zum Einschalten tippen'}`);
      w.setAttribute('aria-pressed', String(s.water.on));
      w.querySelector('b').textContent = s.water.on ? 'EIN' : 'AUS';
      w.setAttribute('aria-label', `Kühlwasser ${s.water.on ? 'EIN – zum Ausschalten tippen' : 'AUS – zum Einschalten tippen'}`);
      document.querySelectorAll('#heatLevel [data-level]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === s.heater.level)));
      document.querySelectorAll('#flowLevel [data-level]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === s.water.level)));
    }
    $('#btnHeat').addEventListener('click', () => act('setHeater', !st().heater.on));
    $('#btnWater').addEventListener('click', () => act('setWater', !st().water.on));
    $('#heatLevel').addEventListener('click', (e) => { const b = e.target.closest('[data-level]'); if (b) act('setHeatLevel', b.dataset.level); });
    $('#flowLevel').addEventListener('click', (e) => { const b = e.target.closest('[data-level]'); if (b) act('setFlow', b.dataset.level); });

    // ------------------------------------------------------------ Sicherheitsstopp, Geräteinfo
    let safetySig = '';
    function renderSafety() {
      const s = st().safety;
      const sig = s ? s.code + s.t : '';
      if (sig === safetySig) return;
      safetySig = sig;
      const el = $('#safety');
      if (!s) { el.hidden = true; el.innerHTML = ''; return; }
      el.hidden = false;
      el.innerHTML = `<h2 id="safetyTitle">⚠ ${esc(s.title)}</h2><p>${esc(s.text)}</p><p class="fix"><b>Was tun?</b> ${esc(s.fix)}</p><p class="lk-muted">Die Heizung wurde ausgeschaltet. Bereits aufgefangenes Destillat bleibt erhalten.</p><div class="lk-row end"><button type="button" class="lk-btn primary" id="btnAck">Verstanden</button></div>`;
      $('#btnAck').addEventListener('click', () => act('ackSafety'));
      $('#btnAck').focus();
    }
    let infoSig = '';
    function renderExplainNote() { $('#explainNote').hidden = !ui.explain; }
    function renderPartInfo() {
      const p = ui.explore ? ui.selectedPart : null;
      if (p === infoSig) return;
      infoSig = p;
      const el = $('#partInfo');
      if (!p) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = `<h3>${esc(T.PART_NAMES[p])}</h3><p>${esc(T.PART_INFO[p])}</p>`;
    }

    // ------------------------------------------------------------ Kopfzeile
    function syncHead() {
      document.querySelectorAll('#speed [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === ui.speed)));
      $('#btnExpert').setAttribute('aria-pressed', String(!!st().expert));
      $('#btnPanel').setAttribute('aria-expanded', String(ui.panel));
      $('#main').classList.toggle('panel-hidden', !ui.panel);
      document.querySelectorAll('.lk-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
    }
    $('#speed').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (!b) return; ui.speed = Number(b.dataset.speed); syncHead(); save(); });
    $('#btnExpert').addEventListener('click', () => {
      engine.act('setExpert', !st().expert);
      toast(st().expert ? 'Expertenmodus: Dreistoffgemisch, Vorlagenwechsel, Temperatur-Zeit-Diagramm.' : 'Expertenmodus aus.');
      refresh(true); save();
    });
    $('#btnRestartHead').addEventListener('click', () => { ui.confirmRestart = st().mix; ui.panel = true; ui.tab = 'task'; refresh(true); $('#panel').scrollTop = 0; });
    $('#btnNotebook').addEventListener('click', () => { ui.panel = true; ui.tab = 'notebook'; refresh(true); $('#panel').scrollTop = 0; });
    $('#btnPanel').addEventListener('click', () => { ui.panel = !ui.panel; refresh(true); });
    document.querySelector('.lk-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; ui.tab = b.dataset.tab; refresh(true); $('#panel').scrollTop = 0; save(); });

    // ------------------------------------------------------------ Bedienfeld: Aufgabe
    const TS = () => ui.tasks[st().mix];
    const snapNow = () => M.snapshot(st());

    function optHtml(q, ans, marks) {
      const type = q.type === 'many' ? 'checkbox' : 'radio';
      return Object.entries(q.options).map(([k, text]) => {
        const checked = q.type === 'many' ? (ans || []).includes(k) : String(ans) === k;
        const m = marks ? marks(k, checked) : '';
        return `<label class="lk-opt ${m}"><input type="${type}" name="q-${q.id}" value="${esc(k)}"${checked ? ' checked' : ''}><span>${esc(text)}</span>${m === 'right' ? '<span class="lk-mark y" aria-label="richtig">✓</span>' : m === 'wrong' ? '<span class="lk-mark n" aria-label="falsch">✗</span>' : ''}</label>`;
      }).join('');
    }

    function protocolHtml(taskId, ts, snap) {
      const qs = T.questions(taskId, snap);
      const sol = ts.solution ? T.solutionAnswers(taskId, snap) : null;
      const g = ts.graded;
      const fields = qs.map((q) => {
        const ans = ts.answers[q.id];
        const fg = g && g.fields[q.id];
        const corr = q.type === 'one' || q.type === 'many' ? (q.answerFor ? q.answerFor(snap) : q.correct) : null;
        const marks = (k, checked) => {
          if (sol) { const c = q.type === 'many' ? sol[q.id].includes(k) : String(sol[q.id]) === k; return c ? 'right' : checked ? 'wrong' : ''; }
          if (!fg || fg.status === 'empty' || fg.status === 'nodata') return '';
          if (q.type === 'many') return checked ? (corr.includes(k) ? 'right' : 'wrong') : '';
          return checked ? (fg.ok ? 'right' : 'wrong') : '';
        };
        let inner;
        if (q.type === 'gap') {
          const cls = sol ? 'right' : fg && fg.status !== 'empty' ? (fg.ok ? 'right' : 'wrong') : '';
          inner = `<input class="lk-gap ${cls}" name="q-${q.id}" autocomplete="off" spellcheck="false" value="${esc(sol ? sol[q.id] : ans || '')}" aria-label="${esc(q.legend)}">`;
        } else if (q.type === 'num') {
          const cls = sol ? 'right' : fg && fg.status === 'answered' ? (fg.ok ? 'right' : 'wrong') : '';
          inner = `<div class="numrow"><input class="${cls}" name="q-${q.id}" inputmode="decimal" autocomplete="off" value="${esc(sol ? sol[q.id] : ans || '')}" aria-label="${esc(q.legend)} in ${q.unit}"><span>${q.unit}</span></div>`;
        } else inner = optHtml(q, ans, marks);
        const fb = !sol && fg ? `<p class="lk-fb ${fg.ok ? 'y' : 'n'}">${fg.ok ? '✓ ' : fg.status === 'answered' ? '✗ ' : ''}${esc(fg.feedback)}</p>` : '';
        return `<fieldset data-q="${q.id}"><legend>${esc(q.legend)}</legend>${inner}${fb}</fieldset>`;
      }).join('');
      const changed = g && ts.gradedSig != null && ts.gradedSig !== protoSig(snap);
      const nOk = g ? Object.values(g.fields).filter((f) => f.ok).length : 0;
      const summary = g && !sol ? `<div class="lk-note ${g.allCorrect ? 'ok' : 'warn'}" role="status">${g.allCorrect ? '<b>Alles richtig ausgewertet!</b>' : `<b>${nOk} von ${qs.length} Antworten richtig.</b> Richtige Antworten bleiben stehen – verbessere die markierten Felder und prüfe erneut.`}</div>` : '';
      return `<div class="lk-card"><h3>Protokoll – Versuch ${st().run}</h3><p class="lk-muted">Grundlage sind deine eigenen Beobachtungen und Messwerte.</p>
        ${changed ? '<div class="lk-note info">Dein Versuch hat sich seit der letzten Prüfung verändert. Prüfe deine Antworten erneut.</div>' : ''}
        <form class="lk-form" id="protoForm" novalidate>${fields}${summary}
        ${sol ? '<p class="lk-note info">Musterlösung eingeblendet (aus deinem Versuch, sonst aus dem Modell).</p>' : '<div class="lk-row end"><button type="submit" class="lk-btn primary" id="btnGrade">Antworten prüfen</button></div>'}
        </form></div>`;
    }
    const protoSig = (snap) => snap.fractions.map((f) => `${f.n}:${f.drops}`).join(',') + '|' + snap.burnTests.length;

    function taskHtml() {
      const s = st();
      const id = s.mix;
      const t = T.TASKS[id];
      const ts = TS();
      const order = T.TASK_ORDER.filter((k) => !T.TASKS[k].expert || s.expert);
      const chips = order.map((k) => `<button type="button" data-task="${k}" aria-pressed="${k === id}">${esc(T.TASKS[k].short)}${ui.tasks[k].result && ui.tasks[k].result.ok ? '<span class="done" aria-label="gelöst">✓</span>' : ''}</button>`).join('');
      let html = `<div class="taskchips" role="group" aria-label="Aufgabe und Stoffgemisch wählen">${chips}</div>`;
      if (ui.confirmRestart) {
        html += `<div class="lk-note warn" role="alert">Für ${esc(T.TASKS[ui.confirmRestart].short.slice(2))} wird die Apparatur in den Startzustand versetzt (Kolben leer). Deine bisherigen Vorlagen bleiben unter „Ergebnisse“ erhalten.<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnRestartYes">Versuch neu beginnen</button><button type="button" class="lk-btn" id="btnRestartNo">Abbrechen</button></div></div>`;
      }
      html += `<div class="lk-card"><h2>Aufgabe ${t.n}: ${esc(t.title)}</h2><p>${esc(t.problem)}</p><p class="material">Material: ${esc(t.material)}</p>
        <details class="model"><summary>Grundlagen und Modellgrenze</summary><p>${esc(T.MODEL_NOTE)}</p></details>
        <div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnCheck">Ergebnis prüfen</button>
        <button type="button" class="lk-btn" id="btnTip">${ts.tip ? (ts.tip < 3 ? `Nächster Tipp (${ts.tip + 1}/3)` : 'Tipp 3/3') : 'Tipp'}</button>
        <button type="button" class="lk-btn" id="btnSolution">Lösung anzeigen</button></div>
        <p class="lk-muted" style="font-size:13px;margin:8px 0 0">Versuch ${s.run} · ${esc(M.MIXES[id].label)} · neu beginnen über die Kopfzeile</p></div>`;
      if (ts.confirmSolution) html += `<div class="lk-note warn" role="alert">Du hast die Aufgabe noch nicht vollständig bearbeitet. Lösung trotzdem anzeigen?<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnSolutionYes">Ja, Lösung anzeigen</button><button type="button" class="lk-btn" id="btnSolutionNo">Abbrechen</button></div></div>`;
      if (ts.result) html += `<div class="lk-note ${ts.result.ok ? 'ok' : 'bad'}" role="status"><b>${ts.result.ok ? '✓ Ergebnis belegt.' : '✗ Noch nicht belegt.'}</b> ${esc(ts.result.text)}</div>`;
      if (ts.offer && !ts.tip && !(ts.result && ts.result.ok)) html += '<div class="lk-note info">Das hat noch nicht geklappt. Möchtest du einen Tipp? <button type="button" class="lk-btn small" id="btnTipOffer">Tipp 1/3 anzeigen</button></div>';
      if (ts.tip) {
        const code = ts.result ? ts.result.code : T.evaluate(id, s).code;
        const hs = T.hints(code);
        html += `<div class="lk-card tipbox">${hs.slice(0, ts.tip).map((h, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(h)}</p>`).join('')}</div>`;
      }
      if (ts.solution) html += `<div class="lk-card"><h3>Lösung</h3><p>${esc(T.SOLUTIONS[id])}</p></div>`;
      html += protocolHtml(id, ts, snapNow());
      return html;
    }

    // ------------------------------------------------------------ Bedienfeld: Ergebnisse
    function runTable(snap, title) {
      const mixName = M.MIXES[snap.mix].name;
      const fr = snap.fractions.filter((f) => f.vol > 0.005 || f.drops > 0);
      const rows = fr.map((f) => {
        const temp = f.Tmed == null ? '–' : `${fmt(f.Tmin, 1)} – ${fmt(f.Tmax, 1)} °C<br><span class="lk-muted">meist ${fmt(f.Tmed, 1)} °C</span>`;
        const comp = st().expert ? `<br><span class="lk-muted">Modell: ${M.KEYS.filter((k) => f.share[k] > 0.005).map((k) => `${M.SUBSTANCES[k].name} ${Math.round(f.share[k] * 100)} %`).join(', ') || '–'}</span>` : '';
        const burn = f.burn ? ` <span class="pill ${f.burn === 'burns' ? 'ok' : 'warn'}">Brennprobe: ${{ burns: 'bläuliche Flamme', flicker: 'kurzes Aufflackern', none: 'keine Flamme' }[f.burn]}</span>` : '';
        const thermo = f.thermoOk === false ? ' <span class="pill bad">Thermometer falsch positioniert</span>' : '';
        return `<tr><td>Vorlage ${f.n}${f.current ? ' (unter dem Vorstoß)' : ''}</td><td>${fmt(f.vol, 1)} mL${comp}</td><td>${temp}${thermo}${burn}</td></tr>`;
      }).join('');
      const losses = [snap.lostVapor > 0.05 && `Dampfverlust ${fmt(snap.lostVapor, 1)} mL`, snap.lostTable > 0.05 && `auf den Tisch getropft ${fmt(snap.lostTable, 1)} mL`, snap.lostSplash > 0.05 && `verspritzt ${fmt(snap.lostSplash, 1)} mL`].filter(Boolean);
      return `<div class="lk-card"><h3>${esc(title)}: ${esc(mixName)}</h3>
        ${rows ? `<table class="res"><thead><tr><th>Gefäß</th><th>Destillat</th><th>Dampftemperatur beim Übergehen</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="lk-muted">Noch kein Destillat aufgefangen.</p>'}
        ${losses.length ? `<p class="lk-muted" style="margin-top:6px">Verluste: ${losses.join(' · ')}</p>` : ''}</div>`;
    }
    function resultsHtml() {
      const s = st();
      let html = '<p class="lk-muted">Hier stehen deine tatsächlich aufgefangenen Fraktionen mit der Temperatur, bei der sie übergegangen sind.</p>';
      html += runTable(snapNow(), `Versuch ${s.run} (aktuell)`);
      for (const h of s.history.slice().reverse()) html += runTable(h, `Versuch ${h.run}`);
      if (s.expert) {
        const b = engine.balance();
        const v = (c) => fmt(M.vol(c), 2);
        html += `<div class="lk-card"><h3>Stoffbilanz (Expertenmodus)</h3><p>Eingefüllt ${v(b.charged)} mL = Kolben ${v(s.flask.c)} + Kühler ${fmt(M.vol(s.film) + M.vol(s.tip), 2)} + Vorlagen ${fmt(s.fractions.concat([s.receiver]).reduce((a, r) => a + M.vol(r.c), 0), 2)} + Verluste und Proben ${fmt(Object.values(s.lost).reduce((a, c) => a + M.vol(c), 0) + (s.pipette ? M.vol(s.pipette.c) : 0) + (s.dish ? M.vol(s.dish.c) : 0), 2)} mL</p><p class="lk-muted">Abweichung: ${b.error < 1e-6 ? 'keine (< 0,000001 mL)' : fmt(b.error, 6) + ' mL'}</p></div>`;
      }
      html += '<div class="lk-note info"><b>Grenze des Verfahrens:</b> In der Simulation trennen sich die Stoffe idealisiert vollständig. Bei einer echten einfachen Destillation enthält jede Fraktion auch Anteile der anderen Stoffe.</div>';
      return html;
    }

    // ------------------------------------------------------------ Bedienfeld: Trainer
    function trainerHtml() {
      const n = ui.names, f = ui.fns;
      const terms = T.TRAINER_TERMS();
      const solN = n.solution;
      const rowsN = T.PART_ORDER.map((id, i) => {
        const a = solN ? T.PART_NAMES[id] : n.answers[id] || '';
        const fg = !solN && n.graded && n.graded.fields[id];
        const cls = solN ? 'right' : fg && fg.status !== 'empty' ? (fg.ok ? 'right' : 'wrong') : '';
        return `<span class="no" aria-hidden="true">${i + 1}</span><select name="n-${id}" class="${cls}" aria-label="Gerät Nummer ${i + 1}"><option value="">– wählen –</option>${terms.map((t) => `<option${t === a ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${fg && fg.status !== 'empty' ? `<p class="lk-fb ${fg.ok ? 'y' : 'n'}">${fg.ok ? '✓' : '✗'} ${esc(fg.feedback)}</p>` : ''}`;
      }).join('');
      const tipN = n.tip ? `<div class="lk-card tipbox">${T.NAME_HINTS.slice(0, n.tip).map((h, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(h)}</p>`).join('')}</div>` : '';
      const offerN = n.fails >= 2 && !n.tip && !(n.graded && n.graded.allCorrect) ? '<div class="lk-note info">Möchtest du einen Tipp? <button type="button" class="lk-btn small" data-tr="namesTip">Tipp 1/3 anzeigen</button></div>' : '';
      const sumN = n.graded && !solN ? `<div class="lk-note ${n.graded.allCorrect ? 'ok' : 'warn'}">${n.graded.allCorrect ? '<b>Alle Geräte richtig benannt!</b>' : `<b>${n.graded.correct} von 12 richtig.</b> Verbessere die markierten Felder.`}</div>` : '';
      const rowsF = T.FUNCTION_QUESTIONS.map((q) => {
        const a = f.solution ? q.correct : f.answers[q.id];
        const fg = !f.solution && f.graded && f.graded.fields[q.id];
        const marks = (k, checked) => (f.solution ? (k === q.correct ? 'right' : '') : fg && fg.status !== 'empty' && checked ? (fg.ok ? 'right' : 'wrong') : '');
        return `<fieldset data-fq="${q.id}"><legend>${esc(q.legend)}</legend>${optHtml(Object.assign({ type: 'one', id: 'f-' + q.id }, q), a, marks)}${fg && fg.status !== 'empty' ? `<p class="lk-fb ${fg.ok ? 'y' : 'n'}">${fg.ok ? '✓' : '✗'} ${esc(fg.feedback)}</p>` : ''}</fieldset>`;
      }).join('');
      const tipF = f.tip ? `<div class="lk-card tipbox">${T.FUNCTION_HINTS.slice(0, f.tip).map((h, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(h)}</p>`).join('')}</div>` : '';
      const sumF = f.graded && !f.solution ? `<div class="lk-note ${f.graded.allCorrect ? 'ok' : 'warn'}">${f.graded.allCorrect ? '<b>Alle Funktionen richtig!</b>' : `<b>${f.graded.correct} von ${T.FUNCTION_QUESTIONS.length} richtig.</b>`}</div>` : '';
      return `<div class="lk-card"><h2>1. Geräte benennen</h2><p class="lk-muted">Die Nummern stehen an der Apparatur auf der Bühne. Wähle zu jeder Nummer den Fachbegriff.</p>
        <form id="namesForm" class="lk-form" novalidate><div class="trainer-grid">${rowsN}</div>${sumN}
        <div class="lk-row" style="margin-top:10px">${solN ? '' : '<button type="submit" class="lk-btn primary">Antworten prüfen</button>'}<button type="button" class="lk-btn" data-tr="namesTip">${n.tip ? (n.tip < 3 ? `Nächster Tipp (${n.tip + 1}/3)` : 'Tipp 3/3') : 'Tipp'}</button><button type="button" class="lk-btn" data-tr="namesSol">Lösung anzeigen</button></div></form></div>
        ${offerN}${tipN}
        <div class="lk-card"><h2>2. Funktion bestimmen</h2><form id="fnForm" class="lk-form" novalidate>${rowsF}${sumF}
        <div class="lk-row">${f.solution ? '' : '<button type="submit" class="lk-btn primary">Antworten prüfen</button>'}<button type="button" class="lk-btn" data-tr="fnTip">${f.tip ? (f.tip < 3 ? `Nächster Tipp (${f.tip + 1}/3)` : 'Tipp 3/3') : 'Tipp'}</button><button type="button" class="lk-btn" data-tr="fnSol">Lösung anzeigen</button></div></form></div>
        ${f.fails >= 2 && !f.tip && !(f.graded && f.graded.allCorrect) ? '<div class="lk-note info">Möchtest du einen Tipp? <button type="button" class="lk-btn small" data-tr="fnTip">Tipp 1/3 anzeigen</button></div>' : ''}${tipF}
        <div class="lk-card"><h2>3. Was passiert bei der Destillation?</h2>${T.THEORY.map(([h, p]) => `<p><b>${esc(h)}:</b> ${esc(p)}</p>`).join('')}</div>`;
    }

    function notebookHtml() {
      const nb = T.NOTEBOOK;
      return `<div class="lk-notebook"><h2>${esc(nb.title)}</h2><ul>${nb.lines.map((l) => `<li>${md(l)}</li>`).join('')}</ul><span class="eq">${esc(nb.eq)}</span><p><b>Merke:</b> ${esc(nb.rule)}</p></div>
        <p class="lk-muted" style="margin-top:8px">Zum Abschreiben ins Heft (etwa 5 Minuten). Der Hefteintrag hängt nicht von deinem Versuch ab.</p>`;
    }

    // ------------------------------------------------------------ Bedienfeld zeichnen
    let panelSig = '';
    function panelSignature() {
      const s = st();
      const snap = ui.tab === 'results' ? snapNow() : null;
      return JSON.stringify([ui.tab, s.mix, s.expert, s.run, ui.tasks, ui.names, ui.fns, ui.confirmRestart, s.filled, s.fractions.length, s.burnTests.length, s.history.length,
        ui.tab === 'task' ? protoSig(snapNow()) : '', snap ? snap.fractions.map((f) => [f.n, f.vol.toFixed(1), f.Tmed && f.Tmed.toFixed(1)]) : '', ui.tab === 'results' && s.expert ? Math.floor(s.t / 2) : 0]);
    }
    function renderPanel(force) {
      const sig = panelSignature();
      if (sig === panelSig && !force) return;
      const ae = document.activeElement;
      // nicht neu zeichnen, während jemand gerade tippt (sonst ginge die Eingabe verloren)
      if (!force && ae && $('#panel').contains(ae) && (ae.tagName === 'INPUT' && ae.type !== 'radio' && ae.type !== 'checkbox' || ae.tagName === 'SELECT')) return;
      panelSig = sig;
      const body = $('#panelBody');
      const top = $('#panel').scrollTop;
      body.setAttribute('aria-labelledby', 'tab-' + ui.tab);
      body.innerHTML = ui.tab === 'task' ? taskHtml() : ui.tab === 'results' ? resultsHtml() : ui.tab === 'trainer' ? trainerHtml() : notebookHtml();
      $('#panel').scrollTop = top;
    }

    function readForm(form, prefix) {
      const out = {};
      form.querySelectorAll('input, select').forEach((el) => {
        const name = el.name || '';
        if (!name.startsWith(prefix)) return;
        const id = name.slice(prefix.length);
        if (el.type === 'checkbox') { out[id] = out[id] || []; if (el.checked) out[id].push(el.value); }
        else if (el.type === 'radio') { if (el.checked) out[id] = el.value; else if (!(id in out)) out[id] = ''; }
        else out[id] = el.value;
      });
      return out;
    }

    $('#panelBody').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      const s = st();
      const ts = TS();
      const id = t.id;
      if (t.dataset.task) {
        const k = t.dataset.task;
        if (k === s.mix) return;
        if (s.filled || M.vol(s.charged) > 0) { ui.confirmRestart = k; refresh(true); return; }
        act('selectMix', k); return;
      }
      if (id === 'btnRestart') { ui.confirmRestart = s.mix; refresh(true); return; }
      if (id === 'btnRestartYes') { const k = ui.confirmRestart; ui.confirmRestart = null; ui.selected = null; ui.tasks[k] = freshTaskState(); act('restart', k); return; }
      if (id === 'btnRestartNo') { ui.confirmRestart = null; refresh(true); return; }
      if (id === 'btnCheck') {
        const r = T.evaluate(s.mix, s);
        ts.result = r;
        if (!r.ok) { ts.fails++; if (ts.fails >= 2) ts.offer = true; } else ts.offer = false;
        refresh(true); save(); return;
      }
      if (id === 'btnTip' || id === 'btnTipOffer') {
        if (!ts.result) ts.result = T.evaluate(s.mix, s);
        ts.tip = Math.min(3, ts.tip + 1); refresh(true); save(); return;
      }
      if (id === 'btnSolution') {
        const incomplete = !(ts.result && ts.result.ok) || !(ts.graded && ts.graded.allCorrect);
        if (incomplete && !ts.confirmSolution) { ts.confirmSolution = true; refresh(true); return; }
        ts.solution = true; ts.confirmSolution = false; refresh(true); save(); return;
      }
      if (id === 'btnSolutionYes') { ts.solution = true; ts.confirmSolution = false; refresh(true); save(); return; }
      if (id === 'btnSolutionNo') { ts.confirmSolution = false; refresh(true); return; }
      const tr = t.dataset.tr;
      if (tr === 'namesTip') { ui.names.tip = Math.min(3, ui.names.tip + 1); refresh(true); save(); }
      if (tr === 'namesSol') { ui.names.solution = true; refresh(true); save(); }
      if (tr === 'fnTip') { ui.fns.tip = Math.min(3, ui.fns.tip + 1); refresh(true); save(); }
      if (tr === 'fnSol') { ui.fns.solution = true; refresh(true); save(); }
    });
    $('#panelBody').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const s = st();
      if (form.id === 'protoForm') {
        const ts = TS();
        ts.answers = Object.assign({}, ts.answers, readForm(form, 'q-'));
        const snap = snapNow();
        ts.graded = T.grade(s.mix, ts.answers, snap);
        ts.gradedSig = protoSig(snap);
        if (!ts.graded.allCorrect) { ts.fails++; if (ts.fails >= 2) ts.offer = true; }
      } else if (form.id === 'namesForm') {
        ui.names.answers = readForm(form, 'n-');
        ui.names.graded = T.gradeNames(ui.names.answers);
        if (!ui.names.graded.allCorrect) ui.names.fails++;
      } else if (form.id === 'fnForm') {
        ui.fns.answers = readForm(form, 'q-f-');
        ui.fns.graded = T.gradeFunctions(ui.fns.answers);
        if (!ui.fns.graded.allCorrect) ui.fns.fails++;
      }
      refresh(true); save();
    });
    // Eingaben im Protokoll sofort merken (bleiben beim Neuzeichnen erhalten)
    $('#panelBody').addEventListener('change', (e) => {
      const form = e.target.closest('form');
      if (!form) return;
      if (form.id === 'protoForm') TS().answers = Object.assign({}, TS().answers, readForm(form, 'q-'));
      if (form.id === 'namesForm') ui.names.answers = readForm(form, 'n-');
      if (form.id === 'fnForm') ui.fns.answers = readForm(form, 'q-f-');
      save();
    });

    // ------------------------------------------------------------ Gesamtaktualisierung
    function refresh(force) {
      syncHead();
      syncDeck();
      renderActions();
      renderSafety();
      renderPartInfo();
      renderExplainNote();
      layoutHits();
      renderPanel(force);
    }

    const sp = splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex-destillation-panel', minStage: 600, onChange: () => { renderer.resize(); hitSig = ''; layoutHits(); } });
    function onResize() { renderer.resize(); hitSig = ''; layoutHits(); }
    root.addEventListener('resize', onResize);
    if (root.ResizeObserver) new root.ResizeObserver(onResize).observe($('#canvasWrap'));

    // ------------------------------------------------------------ Zeitschleife
    let last = null, readoutAt = 0, panelAt = 0;
    function loop(now) {
      const dt = last == null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = st();
      const cap = s.op ? 1 : Infinity; // Handgriffe (Einfüllen, Siedesteine, Flamme) laufen höchstens in Echtzeit
      const speed = Math.min(ui.speed, cap);
      if (speed > 0 && dt > 0) engine.advance(dt * speed);
      renderer.frame(dt);
      $('#clock').textContent = core.fmtTime(s.t);
      $('#clock').classList.toggle('paused', ui.speed === 0);
      if (now - readoutAt > 500) {
        readoutAt = now;
        const r = $('#readout');
        r.textContent = `Dampftemperatur ${fmt(s.reading, 1)} °C; Vorlage ${fmt(M.vol(s.receiver.c), 1)} mL`;
        r.dataset.temp = s.reading.toFixed(2);
        layoutHits();
        renderActions();
        syncDeck();
        renderSafety();
      }
      if (now - panelAt > 700) { panelAt = now; renderPanel(false); save(); }
      root.requestAnimationFrame(loop);
    }

    refresh(true);
    root.requestAnimationFrame(loop);

    return { engine, ui, renderer, refresh, act, hit, splitter: sp, save: saveNow };
  }

  (root.DS = root.DS || {}).ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
