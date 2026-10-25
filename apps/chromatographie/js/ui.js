/*
 * Papierchromatographie – Oberfläche (DOM)
 *
 * Verbindet Fachmodell, Renderer und Bedienfeld. Alle Handlungen laufen über
 * engine.act(); die Oberfläche setzt keinen Modellzustand direkt.
 * Ablauf und Bezeichnungen nach shared/labkit/DESIGN.md (Abschnitt 6).
 */
(function (root) {
  'use strict';
  const { core } = root.LK;
  const M = root.PC.model;
  const T = root.PC.tasks;
  const R = root.PC.render;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const STORE = 'sivex-chromatographie-v1';

  function freshTaskState() { return { fails: 0, offer: false, tip: 0, result: null, paper: null, answers: {}, graded: null, solution: false, confirmSolution: false }; }
  function initialUi() {
    return {
      tab: 'task', task: 'A', selectedPen: null, speed: 10, panel: true,
      tasks: { A: freshTaskState(), B: freshTaskState(), C: freshTaskState(), free: freshTaskState() },
      rf: { lane: 0, zone: 0, front: '', dist: '', rf: '', result: null }, bigResult: null
    };
  }

  function createUI(opts) {
    let saved = null;
    try { saved = JSON.parse(root.sessionStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    const engine = M.createEngine(saved && saved.model);
    const ui = Object.assign(initialUi(), saved && saved.ui ? saved.ui : {});
    ui.hoverLane = null;
    const st = engine.state;
    const renderer = R.createRenderer($('#lab'), () => engine.state, { layout: opts.layout });

    // ------------------------------------------------------------ Speichern
    let saveTimer = null;
    function saveNow() {
      clearTimeout(saveTimer);
      try { root.sessionStorage.setItem(STORE, JSON.stringify({ model: engine.state, ui: Object.assign({}, ui, { hoverLane: null }) })); } catch (e) { /* ohne Speicher */ }
    }
    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, 300);
    }
    // Beim Neuladen oder Verlassen sofort sichern (sonst ginge der letzte Handgriff verloren)
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
      toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'warn' ? 6500 : 4000);
    }
    engine.on('message', (m) => toast(m.text, m.kind));

    // ------------------------------------------------------------ Handlungen
    function act(name, ...args) {
      const r = engine.act(name, ...args);
      refresh();
      return r;
    }

    function hit(id) {
      const [kind, arg] = id.split(':');
      const p = st.paper;
      if (kind === 'pen') {
        if (ui.selectedPen === arg) { ui.selectedPen = null; toast('Stift zurück in den Ständer gestellt.'); }
        else {
          ui.selectedPen = arg;
          toast(p.state === 'bench' ? `${M.SAMPLE_BY_ID[arg].name} gewählt. Tippe auf einen Punkt des Papiers.` : `${M.SAMPLE_BY_ID[arg].name} gewählt. Aufgetupft wird auf einem neuen, trockenen Papier.`);
        }
        refresh();
      } else if (kind === 'lane') {
        if (!ui.selectedPen) { toast('Wähle zuerst einen Stift aus dem Ständer.', 'warn'); return; }
        act('spot', Number(arg), ui.selectedPen);
      } else if (kind === 'pencil') act('drawLine');
      else if (kind === 'bottle') act('pour', arg);
      else if (kind === 'chamber') {
        if (p.state === 'chamber') act('remove');
        else if (p.state === 'bench') act('insert');
        else toast('Dieses Papier ist schon entwickelt. Nimm für einen neuen Versuch ein neues Papier.', 'warn');
      } else if (kind === 'front') act('markFront');
    }

    const HIT_LABELS = {
      pencil: () => (st.paper.line ? 'Bleistift: Startlinie wieder entfernen' : 'Bleistift: Startlinie ziehen'),
      chamber: () => (st.paper.state === 'chamber' ? 'Entwicklungskammer: Papier herausnehmen' : 'Entwicklungskammer: Papier einhängen'),
      'bottle:water': () => 'Wasser in die Kammer gießen',
      'bottle:etoh': () => 'Ethanol-Wasser 1 : 1 in die Kammer gießen',
      front: () => 'Laufmittelfront mit Bleistift markieren'
    };
    function hitLabel(id) {
      if (HIT_LABELS[id]) return HIT_LABELS[id]();
      const [kind, arg] = id.split(':');
      if (kind === 'pen') return M.SAMPLE_BY_ID[arg].name + (ui.selectedPen === arg ? ' – gewählt, zurückstellen' : ' – auswählen');
      if (kind === 'lane') { const l = st.paper.lanes[arg]; return `Auftragepunkt ${Number(arg) + 1}` + (l ? ` (${M.SAMPLE_BY_ID[l.sampleId].label}, ${l.n}×)` : ''); }
      return id;
    }

    let hitSig = '';
    function layoutHits() {
      const areas = renderer.hitAreas(ui);
      const sig = JSON.stringify(areas.map((a) => [a.id, a.x | 0, a.y | 0, a.w | 0, a.h | 0])) + ui.selectedPen + st.paper.line + st.paper.state + JSON.stringify(st.paper.lanes);
      if (sig === hitSig) return;
      hitSig = sig;
      const box = $('#hits');
      const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.hit : null;
      box.innerHTML = areas.map((a) => `<button type="button" class="hit" data-hit="${a.id}" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px" aria-label="${esc(hitLabel(a.id))}"${a.id.startsWith('pen:') ? ` aria-pressed="${ui.selectedPen === a.id.slice(4)}"` : ''}></button>`).join('');
      if (focused) { const b = box.querySelector(`[data-hit="${focused}"]`); if (b) b.focus(); }
    }
    $('#hits').addEventListener('click', (e) => { const b = e.target.closest('[data-hit]'); if (b) hit(b.dataset.hit); });
    $('#hits').addEventListener('pointerover', (e) => { const b = e.target.closest('[data-hit^="lane:"]'); ui.hoverLane = b ? Number(b.dataset.hit.slice(5)) : null; });
    $('#hits').addEventListener('pointerout', () => { ui.hoverLane = null; });

    // ------------------------------------------------------------ Handlungsleiste
    function actionsHtml() {
      const p = st.paper;
      const b = (a, text, extra) => `<button type="button" class="lk-btn" data-act="${a}"${extra || ''}>${text}</button>`;
      const out = [b('newSheet', 'Neues Papier')];
      out.push(b('drawLine', p.line ? 'Startlinie entfernen' : 'Startlinie ziehen'));
      out.push(p.state === 'chamber' ? b('remove', 'Papier herausnehmen', ' data-primary="1"') : b('insert', 'Papier einhängen'));
      out.push(b('emptyChamber', 'Kammer leeren'));
      if (st.expert) out.push(b('markFront', 'Front markieren'));
      return out.join('');
    }
    let actSig = '';
    function renderActions() {
      const sig = [st.paper.line, st.paper.state, st.expert].join('|');
      if (sig === actSig) return;
      actSig = sig;
      const el = $('#actions');
      const f = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.act : null;
      el.innerHTML = actionsHtml();
      if (f) { const x = el.querySelector(`[data-act="${f}"]`); if (x) x.focus(); }
    }
    $('#actions').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });

    // ------------------------------------------------------------ Kopfzeile
    function syncHead() {
      document.querySelectorAll('#speed [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === ui.speed)));
      $('#btnExpert').setAttribute('aria-pressed', String(!!st.expert));
      $('#btnPanel').setAttribute('aria-expanded', String(ui.panel));
      $('#main').classList.toggle('panel-hidden', !ui.panel);
    }
    $('#speed').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (!b) return; ui.speed = Number(b.dataset.speed); syncHead(); save(); });
    $('#btnExpert').addEventListener('click', () => { engine.act('setExpert', !st.expert); toast(st.expert ? 'Expertenmodus: Front markieren, Lineal und Rf-Werte.' : 'Expertenmodus aus.'); refresh(true); });
    $('#btnNotebook').addEventListener('click', () => { ui.panel = true; ui.tab = 'notebook'; refresh(true); $('#panel').scrollTop = 0; });
    $('#btnPanel').addEventListener('click', () => { ui.panel = !ui.panel; refresh(true); setTimeout(onResize, 0); });

    // ------------------------------------------------------------ Bedienfeld
    const TS = () => ui.tasks[ui.task];
    const snapById = (id) => st.archive.find((a) => a.id === id) || null;

    function optHtml(q, ans, marks, disabled) {
      const type = q.type === 'many' ? 'checkbox' : 'radio';
      return Object.entries(q.options).map(([k, text]) => {
        const checked = q.type === 'many' ? (ans || []).includes(k) : String(ans) === k;
        const m = marks ? marks(k, checked) : '';
        return `<label class="lk-opt ${m}"><input type="${type}" name="q-${q.id}" value="${esc(k)}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${esc(text)}</span>${m === 'right' ? '<span class="lk-mark y" aria-label="richtig">✓</span>' : m === 'wrong' ? '<span class="lk-mark n" aria-label="falsch">✗</span>' : ''}</label>`;
      }).join('');
    }

    function protocolHtml(ts, snap) {
      const qs = T.QUESTIONS[ui.task] || [];
      if (!qs.length) return '';
      const sol = ts.solution ? T.solutionAnswers(ui.task, snap) : null;
      const g = ts.graded;
      const fields = qs.map((q) => {
        const ans = ts.answers[q.id];
        const fg = g && g.fields[q.id];
        const right = sol ? sol[q.id] : null;
        const marks = (k, checked) => {
          if (sol) {
            const corr = q.type === 'many' ? right.includes(k) : String(right) === k;
            if (corr) return 'right';
            return checked ? 'wrong' : '';
          }
          if (!fg || fg.status === 'empty') return '';
          if (q.type === 'many') return checked ? (corrSet(q, snap).includes(k) ? 'right' : 'wrong') : '';
          return checked ? (fg.ok ? 'right' : 'wrong') : '';
        };
        let inner;
        if (q.type === 'gap') {
          const cls = sol ? 'right' : fg && fg.status !== 'empty' ? (fg.ok ? 'right' : 'wrong') : '';
          inner = `<input class="lk-gap ${cls}" name="q-${q.id}" autocomplete="off" spellcheck="false" value="${esc(sol ? (ans && T.grade(ui.task, { [q.id]: ans }, snap).fields[q.id].ok ? ans : right) : ans || '')}" aria-label="${esc(q.legend)}">`;
        } else inner = optHtml(q, ans, marks, false);
        const fb = !sol && fg ? `<p class="lk-fb ${fg.ok ? 'y' : 'n'}">${fg.ok ? '✓ ' : fg.status === 'empty' ? '' : '✗ '}${esc(fg.feedback)}</p>` : '';
        return `<fieldset data-q="${q.id}"><legend>${esc(q.legend)}</legend>${inner}${fb}</fieldset>`;
      }).join('');
      const head = snap ? `Protokoll zu Papier ${snap.n} (${esc(snap.solvent ? M.SOLVENTS[snap.solvent].short : '')})` : 'Protokoll';
      const summary = g && !sol ? `<div class="lk-note ${g.allCorrect ? 'ok' : 'warn'}" role="status">${g.allCorrect ? '<b>Alles richtig ausgewertet!</b>' : `<b>${Object.values(g.fields).filter((f) => f.ok).length} von ${qs.length} Antworten richtig.</b> Richtige Antworten bleiben stehen – verbessere die markierten Felder und prüfe erneut.`}</div>` : '';
      return `<div class="lk-card"><h3>${head}</h3><p class="lk-muted">Wähle die zutreffenden Antworten. Grundlage ist dein eigenes Chromatogramm.</p>
        <form class="lk-form" id="protoForm" novalidate>${fields}
        ${summary}
        ${sol ? '' : '<div class="lk-row end"><button type="submit" class="lk-btn primary" id="btnGrade">Antworten prüfen</button></div>'}
        </form></div>`;
    }
    function corrSet(q, snap) { return q.answerFor ? [q.answerFor(snap)] : q.correct; }

    function rfHtml() {
      const p = st.paper;
      const snap = st.archive.find((a) => a.n === p.n && p.state === 'removed');
      let body;
      if (!snap) body = '<p class="lk-muted">Entwickle ein Papier und nimm es heraus. Markiere gleich danach die Laufmittelfront („Front markieren“), solange sie noch feucht und gut zu sehen ist. Dann kannst du hier mit dem Lineal messen.</p>';
      else {
        const lanes = snap.lanes.map((l, i) => (l ? `<option value="${i}"${ui.rf.lane === i ? ' selected' : ''}>Punkt ${i + 1}: ${esc(M.SAMPLE_BY_ID[l.sampleId].label)}</option>` : '')).join('');
        const lane = snap.lanes[ui.rf.lane] ? ui.rf.lane : snap.lanes.findIndex(Boolean);
        const zs = (snap.zones[lane] || []);
        const zopts = zs.map((z, k) => `<option value="${k}"${ui.rf.zone === k ? ' selected' : ''}>Zone ${k + 1} von unten${z.atStart ? ' (Startlinie)' : ''}</option>`).join('');
        const r = ui.rf.result;
        const cls = (f) => (r && r.fields ? (r.fields[f].ok ? 'right' : 'wrong') : '');
        body = `<p class="lk-muted">Miss am Lineal neben dem Papier (0 = Startlinie) und berechne Rf = Laufstrecke der Zone ÷ Laufstrecke der Front.</p>
          <div class="rf-grid">
            <label>Bahn<select id="rfLane">${lanes}</select></label>
            <label>Zone<select id="rfZone">${zopts}</select></label>
            <label>Laufstrecke Front (cm)<input id="rfFront" inputmode="decimal" class="${cls('front')}" value="${esc(ui.rf.front)}"></label>
            <label>Laufstrecke Zone (cm)<input id="rfDist" inputmode="decimal" class="${cls('dist')}" value="${esc(ui.rf.dist)}"></label>
            <label>Rf-Wert<input id="rfVal" inputmode="decimal" class="${cls('rf')}" value="${esc(ui.rf.rf)}"></label>
          </div>
          <div class="lk-row end" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnRf">Messung prüfen</button></div>
          ${r ? (r.fields ? `<div class="lk-note ${r.ok ? 'ok' : 'warn'}">${r.ok ? '<b>Richtig gemessen und berechnet.</b>' : '<b>Noch nicht ganz.</b>'}<ul>${['front', 'dist', 'rf'].map((f) => `<li>${{ front: 'Front', dist: 'Zone', rf: 'Rf' }[f]}: ${r.fields[f].ok ? '✓' : '✗'} ${esc(r.fields[f].feedback)}</li>`).join('')}</ul></div>` : `<div class="lk-note warn">${esc(r.text)}</div>`) : ''}`;
      }
      return `<div class="lk-card"><h3>Expertenmodus: Rf-Wert bestimmen</h3>${body}</div>`;
    }

    function taskHtml() {
      const t = T.TASKS[ui.task];
      const ts = TS();
      const chips = T.TASK_ORDER.map((id) => `<button type="button" data-task="${id}" aria-pressed="${ui.task === id}">${esc(T.TASKS[id].short)}${ui.tasks[id].result && ui.tasks[id].result.ok ? '<span class="done" aria-label="gelöst">✓</span>' : ''}</button>`).join('');
      let html = `<div class="taskchips" role="group" aria-label="Aufgabe wählen">${chips}</div>
        <div class="lk-card"><h2>${ui.task === 'free' ? '' : 'Aufgabe ' + t.id + ': '}${esc(t.title)}</h2><p>${esc(t.problem)}</p><p class="material">Material: ${esc(t.material)}</p>`;
      if (ui.task !== 'free') {
        html += `<div class="lk-row"><button type="button" class="lk-btn primary" id="btnCheck">Ergebnis prüfen</button>
          <button type="button" class="lk-btn" id="btnTip">${ts.tip ? (ts.tip < 3 ? `Nächster Tipp (${ts.tip + 1}/3)` : 'Tipp 3/3') : 'Tipp'}</button>
          <button type="button" class="lk-btn" id="btnSolution">Lösung anzeigen</button></div>`;
      }
      html += '</div>';
      if (ts.confirmSolution) html += `<div class="lk-note warn" role="alert">Du hast die Aufgabe noch nicht vollständig bearbeitet. Lösung trotzdem anzeigen?<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn primary" id="btnSolutionYes">Ja, Lösung anzeigen</button><button type="button" class="lk-btn" id="btnSolutionNo">Abbrechen</button></div></div>`;
      if (ts.result) {
        const r = ts.result;
        html += `<div class="lk-note ${r.ok ? 'ok' : 'bad'}" role="status"><b>${r.ok ? '✓ Ergebnis belegt.' : '✗ Noch nicht belegt.'}</b> ${esc(r.text)}</div>`;
      }
      if (ts.offer && !ts.tip && !(ts.result && ts.result.ok)) html += `<div class="lk-note info">Das hat noch nicht geklappt. Möchtest du einen Tipp? <button type="button" class="lk-btn small" id="btnTipOffer">Tipp 1/3 anzeigen</button></div>`;
      if (ts.tip) {
        const code = T.diagnose(ui.task, st);
        const h = T.hints(ui.task, code, ts.result);
        html += `<div class="lk-note tipbox">${h.slice(0, ts.tip).map((x, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(x)}</p>`).join('')}</div>`;
      }
      if (ts.solution) html += `<div class="lk-note info"><b>Musterlösung (auf Anfrage angezeigt)</b><br>${esc(T.SOLUTIONS[ui.task])}</div>`;
      const snap = ts.paper ? snapById(ts.paper) : null;
      if ((ts.result && ts.result.ok) || ts.solution) html += protocolHtml(ts, snap);
      if (st.expert) html += rfHtml();
      return html;
    }

    function resultsHtml() {
      if (!st.archive.length) return '<div class="lk-card"><h2>Ergebnisse</h2><p>Hier erscheinen alle Papiere, die du entwickelt und aus der Kammer genommen hast – zum Vergleichen nebeneinander.</p></div>';
      const issueText = { submerged: 'Spiegel über den Punkten', noLine: 'ohne Startlinie', short: 'früh herausgenommen', overloaded: 'überladen', frontAtTop: 'Front am Rand' };
      const cards = st.archive.slice().reverse().map((a) => {
        const issues = a.quality.issues.filter((i) => issueText[i]).map((i) => `<span class="pill bad">${issueText[i]}</span>`).join('');
        const lanes = a.lanes.map((l, i) => `<li>${l ? esc(M.SAMPLE_BY_ID[l.sampleId].label) + (l.n > 1 ? ` (${l.n}×)` : '') : '–'}</li>`).join('');
        const big = ui.bigResult === a.id;
        return `<article class="result${big ? ' big' : ''}"><h3>Papier ${a.n}</h3><div class="meta">${esc(M.SOLVENTS[a.solvent].short)} · ${core.fmtTime(a.devTime)} min entwickelt</div>${issues}
          <canvas data-thumb="${a.id}" role="img" aria-label="Chromatogramm Papier ${a.n}"></canvas><ol>${lanes}</ol>
          <button type="button" class="lk-btn small" data-big="${a.id}">${big ? 'Kleiner' : 'Größer ansehen'}</button></article>`;
      }).join('');
      return `<div class="lk-card"><h2>Ergebnisse</h2><p class="lk-muted">Deine entwickelten Papiere. Die Befunde bleiben dem jeweiligen Versuch zugeordnet. Gleich weit gewanderte Zonen liegen auf gleicher Höhe.</p></div><div class="results">${cards}</div>`;
    }

    function notebookHtml() {
      const N = T.NOTEBOOK;
      return `<div class="lk-notebook"><h2>${esc(N.title)}</h2><ul>${N.lines.map((l) => `<li>${md(l)}</li>`).join('')}</ul><p><b>Merke:</b> ${esc(N.rule)}</p>${st.expert ? `<span class="eq">${esc(N.expert)}</span>` : ''}</div>
        <p class="lk-muted" style="margin-top:8px">Zum Abschreiben ins Heft – unabhängig davon, ob dein Versuch geklappt hat.</p>`;
    }

    let panelSig = '';
    function renderPanel(force) {
      const sig = JSON.stringify([ui.tab, ui.task, st.archive.length, st.archive.map((a) => a.frontMark), st.expert, st.paper.state, st.paper.n, ui.bigResult, ui.panel]);
      if (!force && sig === panelSig) return;
      panelSig = sig;
      document.querySelectorAll('.lk-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
      const body = $('#panelBody');
      body.setAttribute('aria-labelledby', 'tab-' + ui.tab);
      body.innerHTML = ui.tab === 'task' ? taskHtml() : ui.tab === 'results' ? resultsHtml() : notebookHtml();
      body.querySelectorAll('canvas[data-thumb]').forEach((c) => {
        const a = snapById(c.dataset.thumb);
        const big = ui.bigResult === a.id;
        R.drawThumb(c, a, big ? Math.min(300, body.clientWidth - 60) : 130);
      });
    }

    document.querySelector('.lk-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; ui.tab = b.dataset.tab; refresh(true); });

    const panelBody = $('#panelBody');
    panelBody.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const ts = TS();
      if (b.dataset.task) { ui.task = b.dataset.task; ui.rf.result = null; }
      else if (b.id === 'btnCheck') {
        const r = T.evaluate(ui.task, st);
        ts.result = r;
        if (r.ok) { ts.paper = r.paper; ts.fails = 0; ts.offer = false; }
        else { ts.fails += 1; if (ts.fails >= 2) ts.offer = true; }
      } else if (b.id === 'btnTip' || b.id === 'btnTipOffer') ts.tip = Math.min(3, ts.tip + 1);
      else if (b.id === 'btnSolution') {
        const qs = T.QUESTIONS[ui.task] || [];
        const answered = qs.every((q) => { const a = ts.answers[q.id]; return Array.isArray(a) ? a.length : a; });
        if (ts.solution) return;
        if (!(ts.result && ts.result.ok) || !answered) ts.confirmSolution = true;
        else ts.solution = true;
      } else if (b.id === 'btnSolutionYes') { ts.solution = true; ts.confirmSolution = false; if (!ts.paper) { const r = T.evaluate(ui.task, st); if (r.ok) ts.paper = r.paper; } }
      else if (b.id === 'btnSolutionNo') ts.confirmSolution = false;
      else if (b.id === 'btnRf') {
        const p = st.paper;
        const snap = st.archive.find((a) => a.n === p.n);
        readRf();
        const lane = snap.lanes[ui.rf.lane] ? ui.rf.lane : snap.lanes.findIndex(Boolean);
        ui.rf.result = T.checkRf(snap, lane, ui.rf.zone, ui.rf);
      } else if (b.dataset.big) ui.bigResult = ui.bigResult === b.dataset.big ? null : b.dataset.big;
      else return;
      save();
      renderPanel(true);
    });
    function readRf() {
      const v = (id) => { const el = $(id); return el ? el.value : ''; };
      ui.rf.front = v('#rfFront'); ui.rf.dist = v('#rfDist'); ui.rf.rf = v('#rfVal');
    }
    panelBody.addEventListener('change', (e) => {
      if (e.target.id === 'rfLane') { ui.rf.lane = Number(e.target.value); ui.rf.zone = 0; ui.rf.result = null; readRf(); save(); renderPanel(true); return; }
      if (e.target.id === 'rfZone') { ui.rf.zone = Number(e.target.value); ui.rf.result = null; readRf(); save(); renderPanel(true); }
    });
    panelBody.addEventListener('input', (e) => {
      if (e.target.closest('.rf-grid')) { readRf(); save(); return; }
      const form = e.target.closest('#protoForm');
      if (!form) return;
      const ts = TS();
      for (const q of T.QUESTIONS[ui.task] || []) {
        if (q.type === 'many') ts.answers[q.id] = [...form.querySelectorAll(`[name="q-${q.id}"]:checked`)].map((x) => x.value);
        else if (q.type === 'gap') ts.answers[q.id] = (form.querySelector(`[name="q-${q.id}"]`) || {}).value || '';
        else { const c = form.querySelector(`[name="q-${q.id}"]:checked`); ts.answers[q.id] = c ? c.value : null; }
      }
      // Markierung des geänderten Feldes zurücknehmen, andere bleiben
      const fs = e.target.closest('fieldset');
      if (fs && ts.graded && ts.graded.fields[fs.dataset.q]) {
        fs.querySelectorAll('.right, .wrong').forEach((x) => x.classList.remove('right', 'wrong'));
        fs.querySelectorAll('.lk-mark, .lk-fb').forEach((x) => x.remove());
        delete ts.graded.fields[fs.dataset.q];
      }
      save();
    });
    panelBody.addEventListener('submit', (e) => {
      if (e.target.id !== 'protoForm') return;
      e.preventDefault();
      const ts = TS();
      ts.graded = T.grade(ui.task, ts.answers, ts.paper ? snapById(ts.paper) : null);
      save();
      renderPanel(true);
      const first = panelBody.querySelector('.lk-fb.n, .lk-note');
      if (first) first.scrollIntoView({ block: 'nearest' });
    });

    // ------------------------------------------------------------ Gesamtaktualisierung
    function refresh(force) {
      syncHead();
      renderActions();
      layoutHits();
      renderPanel(force);
      save();
    }
    engine.on('change', () => { layoutHits(); renderActions(); renderPanel(false); save(); });

    // ------------------------------------------------------------ Größe, Trennlinie, Schleife
    function onResize() { renderer.resize(); hitSig = ''; layoutHits(); }
    root.addEventListener('resize', onResize);
    if (root.ResizeObserver) new root.ResizeObserver(onResize).observe($('#canvasWrap'));
    root.LK.splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex-chromatographie-panel', onChange: () => setTimeout(onResize, 0) });

    let last = null, clockShown = '';
    function frame(ts) {
      const dt = last == null ? 0 : Math.min(0.1, (ts - last) / 1000);
      last = ts;
      // Handgriffe laufen immer in Echtzeit (auch bei Pause), die Entwicklung im gewählten Tempo
      const speed = st.op ? 1 : ui.speed;
      if (dt > 0 && speed > 0) engine.advance(dt * speed);
      renderer.draw(ui);
      const c = core.fmtTime(st.time) + (ui.speed === 0 ? ' ❚❚' : '');
      if (c !== clockShown) { clockShown = c; const el = $('#clock'); el.textContent = c; el.classList.toggle('paused', ui.speed === 0); }
      root.requestAnimationFrame(frame);
    }

    onResize();
    refresh(true);
    root.requestAnimationFrame(frame);
    return { engine, ui, renderer, refresh, hit };
  }

  (root.PC = root.PC || {}).ui = { createUI, STORE };
})(typeof self !== 'undefined' ? self : this);
