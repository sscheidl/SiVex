/*
 * Fällungslabor – Bedienfeld: Anleitung, Beobachtung (Protokoll + Ergebnisübersicht), Aufgaben
 * bzw. Auswertung, Hefteintrag bzw. Kurzfassung; dazu Dialoge (Gefahrstoffkarte, Hefteintrag,
 * Gesamtrücksetzen). Aufbau, Schaltflächen und Rückmeldeformen nach Redoxlabor/Labkit
 * (docs/QUALITY.md). Liest den Laborzustand nur; Antworten bleiben lokal.
 */
(function (root) {
  'use strict';
  const FL = root.FL, C = FL.chem, M = FL.model, T = FL.tasks, GHS = FL.ghs, LL = root.LK.learn, core = root.LK.core;
  const esc = LL.esc;
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const fmt = (v, d) => C.fmt(v, d);
  const PTABS = {
    main: [['guide', 'Anleitung'], ['obs', 'Protokoll'], ['tasks', 'Aufgaben'], ['note', 'Hefteintrag']],
    control: [['guide', 'Anleitung'], ['obs', 'Protokoll'], ['tasks', 'Auswertung'], ['note', 'Kurzfassung']]
  };
  const STEPS = { main: T.STEPS, control: T.CONTROL_STEPS };

  /** Startwert für das Mischen: neu je Durchgang; über „#seed=…“ in der Adresse festlegbar (Prüfungen). */
  function hashSeed(offset) {
    try { const m = /[#&]seed=(\d+)/.exec(root.location.hash || ''); if (m) return (Number(m[1]) + (offset || 0)) >>> 0; } catch (e) { /* ohne Adresse */ }
    return null;
  }
  function freshLearn(p) {
    const steps = STEPS[p];
    const fixed = hashSeed(p === 'main' ? 0 : 1);
    return { v: 2, seed: fixed != null ? fixed : T.newSeed(), step: steps[0].id, steps: LL.freshState(steps) };
  }
  function freshState() {
    return {
      ptab: { main: 'guide', control: 'guide' },
      learn: { main: freshLearn('main'), control: freshLearn('control') },
      records: { main: [], control: [] }, drafts: {}, uid: 1
    };
  }
  function sanitize(s) {
    const f = freshState();
    if (!s || typeof s !== 'object') return f;
    for (const p of ['main', 'control']) {
      if (s.ptab && PTABS[p].some(([k]) => k === s.ptab[p])) f.ptab[p] = s.ptab[p];
      const L = s.learn && s.learn[p];
      // Antworten aus 1.0.0 (Buchstaben) werden auf die fachlichen IDs abgebildet und neu bewertet
      const legacy = L && L.v !== 2;
      if (L && L.steps) for (const st of STEPS[p]) if (L.steps[st.id]) {
        const ss = Object.assign(LL.freshStep(), L.steps[st.id], { confirmSolution: false });
        if (legacy) {
          const m = T.migrateAnswers(ss.answers);
          ss.answers = m.answers;
          if (ss.graded) ss.graded = T.grade(st, ss.answers);
          if (m.changed) f.migrated = true;
        }
        f.learn[p].steps[st.id] = ss;
      }
      if (L && STEPS[p].some((x) => x.id === L.step)) f.learn[p].step = L.step;
      if (L && L.v === 2 && Number.isInteger(L.seed) && L.seed >= 0) f.learn[p].seed = L.seed >>> 0;
      if (s.records && Array.isArray(s.records[p])) f.records[p] = s.records[p].filter((r) => r && r.ansatz);
    }
    if (s.drafts && typeof s.drafts === 'object') f.drafts = s.drafts;
    f.uid = s.uid | 0 || 1;
    return f;
  }

  /** Kurzbeschreibung der Zugaben eines Ansatzes (tatsächliche Volumina). */
  function addsText(t) {
    if (!t || !(t.V > 0)) return 'leer';
    const s = C.SOLUTIONS[t.sample];
    const parts = [`${s ? s.short || s.name : 'Probe'} ${fmt(t.log.sampleV, 2)} mL`];
    if (t.log.agDrops) parts.push(`AgNO₃ ${t.log.agDrops} Tr. (${fmt(t.log.agV, 2)} mL)`);
    if (t.log.waterV) parts.push(`Wasser ${fmt(t.log.waterV, 2)} mL`);
    if (t.log.nh3dilV) parts.push(`NH₃ verd. ${fmt(t.log.nh3dilV, 2)} mL`);
    if (t.log.nh3concV) parts.push(`NH₃ konz. ${fmt(t.log.nh3concV, 2)} mL`);
    return parts.join(' · ');
  }

  function create(opts) {
    const { lab } = opts;
    const S = sanitize(opts.saved);
    const body = document.getElementById('panelBody');
    const tabsEl = document.getElementById('ptabs');
    const modal = document.getElementById('modal'), modalBody = document.getElementById('modalBody');
    const part = () => lab.state.tab;
    let lastSig = '', lastView = '';
    let lastFocusBeforeModal = null;

    // ---------------------------------------------------------------- Reiter des Bedienfelds
    function renderTabs() {
      const p = part();
      tabsEl.innerHTML = PTABS[p].map(([k, label]) => `<button type="button" role="tab" id="ptab-${k}" data-ptab="${k}" aria-selected="${S.ptab[p] === k}" aria-controls="panelBody">${label}</button>`).join('');
      body.setAttribute('aria-labelledby', 'ptab-' + S.ptab[p]);
    }
    tabsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ptab]');
      if (!b) return;
      S.ptab[part()] = b.dataset.ptab;
      render(); opts.save();
    });
    function showTab(k) { S.ptab[part()] = k; render(); }

    // ---------------------------------------------------------------- Inhalte
    function guideHtml(p) {
      if (p === 'main') {
        return `<div class="lk-card"><h2>Fällungsreaktionen</h2>
          <p>Untersuche, was passiert, wenn du Silbernitratlösung zu Natriumchlorid-, Natriumbromid- und Natriumiodidlösung gibst.</p>
          <ol class="steps-list">
            <li><b>Probe einfüllen:</b> Flasche antippen (Pipette aufnehmen), dann ein leeres Reagenzglas antippen. Die Pipette gibt das unten eingestellte Probevolumen ab.</li>
            <li><b>Silbernitratlösung zutropfen:</b> Flasche antippen, Reagenzglas antippen. Dann „Tropfen“ oder das Glas antippen = 1 Tropfen, gedrückt halten = mehrere Tropfen.</li>
            <li><b>Beobachten:</b> direkt nach dem Tropfen, nach dem Stehenlassen (Zeitraffer 5× hilft) und nach dem <b>Schwenken</b>. Vergleiche die drei Gläser nebeneinander.</li>
            <li><b>Notieren:</b> Glas antippen und im Reiter „Protokoll“ festhalten. Die Ergebnisübersicht steht darunter.</li>
          </ol></div>
          <div class="lk-card"><h3>Erweiterung: Ammoniakprüfung</h3>
          <p>Setze zwei Proben gleich an (gleiche Probe, gleiche Tropfenzahl) – mit „+ Glas“ stehen bis zu sechs Reagenzgläser bereit. Gib in das eine <b>verdünnte</b>, in das andere <b>konzentrierte</b> Ammoniaklösung (Dosierhilfe 0,5 mL / 1,0 mL) und schwenke. Zum Vergleich kannst du auch destilliertes Wasser zugeben.</p>
          <p class="lk-muted small">Ammoniaklösung gehört erst zu einem Ansatz, der schon Silbernitratlösung enthält.</p></div>
          <div class="lk-card"><h3>Gut zu wissen</h3>
          <ul class="small"><li>Ein Tropfen ist im Modell 0,050 mL. Jedes Reagenzglas fasst 20 mL.</li>
          <li><b>Spülen</b> gießt das gewählte Glas in den Behälter „Silberabfälle“ aus und beendet nur diesen Ansatz; er bleibt in der Ergebnisübersicht. <b>− Glas</b> nimmt ein Glas aus dem Ständer (gefüllt erst nach Rückfrage).</li>
          <li>Dieselbe Probe darfst du nachgeben, eine andere Probe nicht.</li>
          <li>Konzentrationen und Gefahrstoffhinweise: ⓘ unten auf dem Flaschenetikett antippen.</li>
          <li>Zeiten für Mischen und Absetzen sind für die Beobachtung gewählt, keine Messwerte.</li>
          <li>Hintergrund hell/dunkel ändert nur die Darstellung.</li></ul></div>
          ${resetHtml()}`;
      }
      return `<div class="lk-card"><h2>Kontrollversuche</h2>
        <p>Dieser Teil ist unabhängig vom Hauptversuch und kann davor oder danach bearbeitet werden.</p>
        <ul><li><b>Positivkontrolle:</b> Natriumchloridlösung + Silbernitratlösung – so sieht eine sichere Chloridfällung aus.</li>
        <li><b>Blindprobe (negativ):</b> destilliertes Wasser + Silbernitratlösung.</li>
        <li><b>Alltagsproben:</b> Leitungswasser und Mineralwasser + Silbernitratlösung.</li></ul>
        <p>Fülle jeweils das gleiche Probevolumen ein und gib überall gleich viele Tropfen Silbernitratlösung zu (z. B. mit „5 Tropfen“). Vergleiche dann alle vier Gläser.</p></div>
        <div class="lk-card"><h3>Hinweis zu den Wasserproben</h3><p class="small">Leitungs- und Mineralwasser sind hier feste Modellproben mit typischen Mengen gelöster Ionen. Echtes Wasser ist je nach Ort und Quelle verschieden zusammengesetzt und kann anders reagieren.</p></div>
        ${resetHtml()}`;
    }
    function resetHtml() {
      return `<div class="lk-card danger"><h3>Neu beginnen</h3><p class="small">Einzelne Gläser leerst du mit „Spülen“. Hier wird dagegen <b>alles</b> zurückgesetzt: beide Versuchsteile, Beobachtungen und Antworten.</p><button type="button" class="lk-btn" data-act="resetAll">Gesamten Lernstand zurücksetzen …</button></div>`;
    }

    function obsHtml(p) {
      const tb = lab.tab();
      const sel = tb.sel != null && tb.sel < tb.visible ? tb.sel : null;
      const t = sel != null ? tb.tubes[sel] : null;
      let card;
      if (!t) card = `<div class="lk-note info">Tippe ein Reagenzglas an, um eine Beobachtung festzuhalten.</div>`;
      else if (!(t.V > 0)) card = `<div class="lk-note info">Glas ${sel + 1} ist leer. Fülle zuerst eine Probe ein.</div>`;
      else {
        const d = S.drafts[t.ansatz + '@' + p] || {};
        const nh3 = t.log.nh3dilV > 0 || t.log.nh3concV > 0;
        const radios = (name, opts2) => Object.entries(opts2).map(([k, v]) => `<label class="lk-opt"><input type="radio" name="${name}" value="${k}"${d[name] === k ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('');
        card = `<div class="lk-card"><h2>Glas ${sel + 1} · Ansatz ${esc(t.ansatz)}</h2>
          <p class="adds">${esc(addsText(t))}<br><span class="lk-muted">Volumen jetzt: ${fmt(t.V, 2)} mL</span></p>
          <form class="lk-form" id="obsForm" novalidate>
            <fieldset><legend>Trübung bzw. Niederschlag</legend>${radios('trueb', T.OBS.trueb)}</fieldset>
            <fieldset><legend>Farbe des Niederschlags</legend>${radios('farbe', T.OBS.farbe)}</fieldset>
            ${nh3 ? `<fieldset><legend>Nach Zugabe von Ammoniaklösung</legend>${radios('nh3', T.OBS.nh3)}</fieldset>` : ''}
            <label class="notefield">Eigene Notiz (freiwillig, wird nicht bewertet)<textarea name="note" rows="2" maxlength="300">${esc(d.note || '')}</textarea></label>
            <div class="lk-row"><button type="submit" class="lk-btn primary">Beobachtung speichern</button></div>
          </form></div>`;
      }
      return card + overviewHtml(p);
    }

    function recordStatus(r, p) {
      const tb = lab.tab(p);
      const cur = tb.tubes.slice(0, tb.visible).find((t) => t.ansatz === r.ansatz);
      if (!cur) return { cls: 'old', text: 'Ansatz beendet (Glas gespült).' };
      if (cur.rev !== r.rev) return { cls: 'changed', text: `Ansatz seither verändert (jetzt: ${addsText(cur)}). Die Notiz gehört zum früheren Stand.` };
      return { cls: 'cur', text: 'aktueller Stand' };
    }
    function overviewHtml(p) {
      const recs = S.records[p];
      const rows = recs.map((r) => {
        const s = recordStatus(r, p);
        const obs = [r.trueb && T.OBS.trueb[r.trueb], r.farbe && T.OBS.farbe[r.farbe], r.nh3 && ('nach NH₃: ' + T.OBS.nh3[r.nh3])].filter(Boolean).join(' · ') || '–';
        return `<li class="rec ${s.cls}"><div class="rec-h"><b>Ansatz ${esc(r.ansatz)}</b><span class="st">${s.cls === 'cur' ? '✓ ' : 'ⓘ '}${esc(s.text)}</span></div>
          <div><span class="lk-muted">Zugaben:</span> ${esc(r.adds)}</div><div><span class="lk-muted">Beobachtung:</span> ${esc(obs)}</div>${r.note ? `<div><span class="lk-muted">Notiz:</span> ${esc(r.note)}</div>` : ''}</li>`;
      }).join('');
      const intro = p === 'main' ? 'Deine gespeicherten Beobachtungen – mit den Zugaben zum Zeitpunkt der Notiz.' : 'Kontrollversuche (getrennt vom Hauptversuch ausgewertet).';
      return `<div class="lk-card"><h2>Ergebnisübersicht</h2><p class="small lk-muted">${intro}</p>${rows ? `<ul class="overview">${rows}</ul>` : '<p class="lk-muted">Noch keine Beobachtung gespeichert.</p>'}
        ${p === 'main' ? '<p class="small lk-muted">Grenze des Verfahrens: Zwei der Niederschläge sehen sich ähnlich – vergleiche sie nebeneinander und nutze die Ammoniakprobe.</p>' : ''}</div>`;
    }

    function tasksHtml(p) {
      const L = S.learn[p], steps = STEPS[p];
      const pr = T.progress(steps, L);
      let html = '';
      if (p === 'main') html += `<p class="progress" role="status">Pflichtschritte gelöst: <b>${pr.done} von ${pr.total}</b> · Schritt 4 (Ammoniak) ist eine Erweiterung.</p>`;
      // Anzeige mit der für diesen Durchgang gemischten Reihenfolge; Bewertung über dieselben IDs
      html += `<div class="tasks${p === 'main' && L.step === 'gleich' ? ' eqs' : ''}">${LL.taskHtml(steps.map((st) => T.view(st, L.seed)), L)}</div>`;
      const ss = L.steps[L.step];
      if (p === 'main' && L.step === 'nh3') html += `<details class="lk-card more"><summary>Vertiefung: Warum löst sich der Niederschlag?</summary><p>Ammoniakmoleküle binden gelöste Silberionen zum Diamminsilber(I)-Ion:</p><p class="eqline">Ag⁺(aq) + 2 NH₃(aq) → [Ag(NH₃)₂]⁺(aq)</p><p>Dadurch sinkt die Konzentration freier Silberionen, und Feststoff kann sich lösen. Je schwerer löslich der Niederschlag ist, desto mehr Ammoniak ist nötig – bei Silberiodid reicht auch konzentrierte Ammoniaklösung nicht.</p></details>`;
      if (p === 'control' && ss && ((ss.graded && ss.graded.allCorrect) || ss.solution)) html += `<div class="lk-card statement"><h3>Auswertung</h3><p>${esc(T.CONTROL_STATEMENT)}</p></div>`;
      html += `<div class="lk-row round"><button type="button" class="lk-btn small" data-act="newRound">Neuer Durchgang …</button><span class="small lk-muted">löscht die Antworten dieses Teils und mischt die Antworten neu</span></div>`;
      if (p === 'control') html += `<details class="lk-card more"><summary>Für Interessierte: andere Anionen und Ansäuern</summary><p>Neben Halogenidionen können auch andere Anionen, z. B. Carbonationen, mit Silberionen schwer lösliche Stoffe bilden. In der Analytik säuert man eine Probe deshalb vorher mit verdünnter Salpetersäure an: Carbonat wird dabei zerstört, Silberhalogenide bleiben bestehen. In diesem Labor wird nicht angesäuert.</p></details>`;
      return html;
    }

    function notebookHtml() {
      const nb = T.NOTEBOOK;
      return `<div class="lk-notebook" id="nbText"><p class="nb-tag">Zum Abschluss – für dein Heft</p><h2>${esc(nb.title)}</h2>${nb.blocks.map((b) => b.kind === 'eq' ? `<p class="eq"><span>${esc(b.text)}</span>, <span class="legend">${esc(b.legend)}</span></p>` : `<p>${md(b.text)}</p>`).join('')}</div>`;
    }
    function noteHtml(p) {
      if (p === 'main') return `${notebookHtml()}<div class="lk-row" style="margin-top:10px"><button type="button" class="lk-btn small" data-act="copyNb">Text kopieren</button><button type="button" class="lk-btn small" data-act="printNb">Drucken</button></div><p class="small lk-muted">Der Eintrag gilt unabhängig davon, ob dein eigener Versuch gelungen ist. Abschreibzeit etwa 5 Minuten.</p>`;
      const cs = T.CONTROL_SUMMARY;
      return `<div class="lk-notebook"><p class="nb-tag">Kurzfassung der Kontrollversuche</p><h2>${esc(cs.title)}</h2><p>${md(cs.text)}</p></div>`;
    }

    // ---------------------------------------------------------------- Zeichnen
    function render() {
      const p = part();
      const active = document.activeElement;
      const focusKey = active && body.contains(active) ? (active.name ? 'name:' + active.name + ':' + (active.value || '') : active.dataset && active.dataset.act ? 'act:' + active.dataset.act : active.dataset && active.dataset.step ? 'step:' + active.dataset.step : null) : null;
      const caret = active && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
      renderTabs();
      const k = S.ptab[p];
      if (lastView !== p + ':' + k) { lastView = p + ':' + k; const panel = document.getElementById('panel'); if (panel) panel.scrollTop = 0; }
      body.innerHTML = k === 'guide' ? guideHtml(p) : k === 'obs' ? obsHtml(p) : k === 'tasks' ? tasksHtml(p) : noteHtml(p);
      lastSig = signature();
      if (focusKey) {
        let el = null;
        if (focusKey.startsWith('name:')) { const [, n, v] = focusKey.split(':'); el = body.querySelector(`[name="${n}"][value="${v}"]`) || body.querySelector(`[name="${n}"]`); }
        else if (focusKey.startsWith('act:')) el = body.querySelector(`[data-act="${focusKey.slice(4)}"]`);
        else if (focusKey.startsWith('step:')) el = body.querySelector(`[data-step="${focusKey.slice(5)}"]`);
        core.restoreFocus(el, caret);
      }
    }
    /** Neuaufbau nur, wenn sich für den sichtbaren Reiter Relevantes geändert hat. */
    function signature() {
      const p = part(), k = S.ptab[p], tb = lab.tab();
      if (k !== 'obs') return p + k;
      const t = tb.sel != null ? tb.tubes[tb.sel] : null;
      return [p, k, tb.sel, t && t.ansatz, t && t.rev, tb.tubes.map((x) => x.ansatz + ':' + x.rev).join(','), tb.visible, S.records[p].length].join('|');
    }
    function tick() {
      if (signature() !== lastSig) {
        // Eingaben im Protokoll nicht durch einen Neuaufbau verlieren
        const f = body.querySelector('#obsForm');
        if (f) storeDraft(f);
        render();
      }
    }

    // ---------------------------------------------------------------- Ereignisse
    function storeDraft(form) {
      const tb = lab.tab(), t = tb.sel != null ? tb.tubes[tb.sel] : null;
      if (!t || !t.ansatz) return;
      const d = LL.readForm(form);
      d.note = form.querySelector('textarea') ? form.querySelector('textarea').value : '';
      S.drafts[t.ansatz + '@' + part()] = d;
    }
    body.addEventListener('submit', (e) => {
      e.preventDefault();
      const p = part();
      if (e.target.id === 'obsForm') {
        const tb = lab.tab(), t = tb.tubes[tb.sel];
        if (!t || !t.ansatz) return;
        storeDraft(e.target);
        const d = S.drafts[t.ansatz + '@' + p] || {};
        if (!d.trueb && !d.farbe && !d.nh3 && !d.note) { opts.toast('Wähle mindestens eine Beobachtung aus.'); return; }
        S.records[p].push({ id: S.uid++, ansatz: t.ansatz, slot: tb.sel, rev: t.rev, sample: t.sample, adds: addsText(t), trueb: d.trueb || '', farbe: d.farbe || '', nh3: d.nh3 || '', note: (d.note || '').trim().slice(0, 300) });
        opts.toast(`Beobachtung zu Ansatz ${t.ansatz} gespeichert.`);
        render(); opts.save();
        return;
      }
      if (e.target.id === 'lkStepForm') {
        const L = S.learn[p], step = STEPS[p].find((s) => s.id === L.step), ss = L.steps[step.id];
        ss.answers = Object.assign({}, ss.answers, LL.readForm(e.target));
        ss.graded = T.grade(step, ss.answers);
        ss.confirmSolution = false;
        if (!ss.graded.allCorrect) ss.fails++;
        render(); opts.save();
        const note = body.querySelector('.lk-form .lk-note');
        if (note) try { note.scrollIntoView({ block: 'nearest' }); } catch (err) { /* ältere Browser */ }
      }
    });
    body.addEventListener('change', (e) => {
      const form = e.target.closest('form');
      if (!form) return;
      if (form.id === 'obsForm') { storeDraft(form); opts.save(); return; }
      if (form.id === 'lkStepForm') {
        const L = S.learn[part()], ss = L.steps[L.step];
        if (ss.solution) return;
        ss.answers = Object.assign({}, ss.answers, LL.readForm(form));
        opts.save();
      }
    });
    body.addEventListener('input', (e) => { if (e.target.name === 'note') { const f = e.target.closest('form'); if (f) storeDraft(f); } });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const p = part(), L = S.learn[p];
      if (b.dataset.step) { L.step = b.dataset.step; render(); opts.save(); return; }
      const act = b.dataset.act;
      if (!act) return;
      const step = STEPS[p].find((s) => s.id === L.step), ss = L.steps[step.id];
      if (act === 'tip') { ss.tip = Math.min(3, ss.tip + 1); render(); opts.save(); }
      else if (act === 'solution') {
        const form = body.querySelector('#lkStepForm');
        if (form && !ss.solution) ss.answers = Object.assign({}, ss.answers, LL.readForm(form));
        if (!(ss.graded && ss.graded.allCorrect) && !ss.confirmSolution) { ss.confirmSolution = true; render(); return; }
        ss.solution = true; ss.confirmSolution = false; render(); opts.save();
      } else if (act === 'solutionYes') { ss.solution = true; ss.confirmSolution = false; render(); opts.save(); }
      else if (act === 'solutionNo') { ss.confirmSolution = false; render(); }
      else if (act === 'hideSolution') { ss.solution = false; render(); opts.save(); }
      else if (act === 'resetAll') confirmReset();
      else if (act === 'newRound') openModal(`<h2 id="modalTitle">Neuer Durchgang?</h2><p>Alle Antworten im Teil „${p === 'main' ? 'Fällungsreaktionen' : 'Kontrollversuche'}“ werden gelöscht, die Antwortmöglichkeiten neu gemischt. Versuche und Beobachtungen bleiben erhalten.</p><div class="lk-row end"><button type="button" class="lk-btn" data-m="close">Abbrechen</button><button type="button" class="lk-btn primary" data-m="newRoundYes">Neu beginnen</button></div>`);
      else if (act === 'copyNb') copyNotebook();
      else if (act === 'printNb') printNotebook();
    });

    // ---------------------------------------------------------------- Dialoge
    function openModal(html, labelId) {
      lastFocusBeforeModal = document.activeElement;
      modalBody.innerHTML = html;
      modal.hidden = false;
      const card = modal.querySelector('.modal-card');
      card.setAttribute('aria-labelledby', labelId || 'modalTitle');
      const btn = modal.querySelector('[data-m="close"]') || card;
      try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }
    }
    function closeModal() {
      modal.hidden = true; modalBody.innerHTML = '';
      if (lastFocusBeforeModal && document.contains(lastFocusBeforeModal)) core.restoreFocus(lastFocusBeforeModal);
    }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { closeModal(); return; }
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const m = b.dataset.m;
      if (m === 'close') closeModal();
      else if (m === 'resetYes') { closeModal(); opts.resetAll(); }
      else if (m === 'newRoundYes') { const p = part(); S.learn[p] = freshLearn(p); closeModal(); showTab('tasks'); opts.save(); opts.toast('Neuer Durchgang – Antworten neu gemischt.'); }
      else if (m === 'copyNb') copyNotebook();
      else if (m === 'printNb') printNotebook();
    });
    document.addEventListener('keydown', (e) => {
      if (modal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key === 'Tab') {
        const f = [...modal.querySelectorAll('button, [href], input, select, textarea')].filter((x) => !x.disabled);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    function ghsCard(key) {
      const s = C.SOLUTIONS[key], L = GHS.LABELS[key];
      if (!s || !L) return;
      const pict = (code) => `<figure><img src="${GHS.dataUri(code)}" width="64" height="64" alt="${esc(code + ': ' + GHS.PICTOGRAMS[code].name)}"><figcaption>${esc(GHS.PICTOGRAMS[code].name)}</figcaption></figure>`;
      const hazard = L.pict.length
        ? `<p class="signal"><b>Signalwort: ${esc(L.signal)}</b></p><div class="picts">${L.pict.map(pict).join('')}</div><ul class="hsatz">${L.h.map((h) => `<li><b>${h}</b> ${esc(GHS.H[h])}</li>`).join('')}</ul>`
        : `<p><b>Keine Gefahrenpiktogramme</b> – ${s.kind === 'water' || s.water ? 'kein Gefahrstoff.' : 'die Lösung ist in dieser Konzentration nicht kennzeichnungspflichtig.'}</p>`;
      openModal(`<h2 id="modalTitle">${esc(s.name)}</h2>
        <p class="formula">${esc(s.formula)} · ${esc(L.form)}</p>
        ${s.c != null ? `<p class="conc"><b>Konzentration:</b> ${esc(s.label)}</p>` : ''}
        ${hazard}
        ${L.protect ? `<p><b>Schutz:</b> ${esc(L.protect)}</p>` : ''}
        ${L.note ? `<p class="small">${esc(L.note)}</p>` : ''}
        ${s.water ? '<p class="small">Feste Modellprobe: Sie enthält typische Mengen gelöster Ionen. Echtes Wasser ist je nach Ort verschieden.</p>' : ''}
        <p class="small lk-muted">Quelle: ${esc(L.source)}.${L.derived ? ' (abgeleitet)' : ''} ${esc(GHS.NOTE)}</p>
        <div class="lk-row end"><button type="button" class="lk-btn primary" data-m="close">Schließen</button></div>`);
    }
    function confirmReset() {
      openModal(`<h2 id="modalTitle">Gesamten Lernstand zurücksetzen?</h2><p>Alle Reagenzgläser in beiden Versuchsteilen, alle gespeicherten Beobachtungen und alle Antworten werden gelöscht. Das lässt sich nicht rückgängig machen.</p><p class="small lk-muted">Nur ein Glas leeren: Glas antippen und „Spülen“.</p><div class="lk-row end"><button type="button" class="lk-btn" data-m="close">Abbrechen</button><button type="button" class="lk-btn danger" data-m="resetYes">Ja, alles zurücksetzen</button></div>`);
    }
    function openNotebook() {
      openModal(`${notebookHtml().replace('<h2>', '<h2 id="modalTitle">')}<div class="lk-row end" style="margin-top:10px"><button type="button" class="lk-btn small" data-m="copyNb">Text kopieren</button><button type="button" class="lk-btn small" data-m="printNb">Drucken</button><button type="button" class="lk-btn primary" data-m="close">Schließen</button></div>`);
    }
    function notebookPlain() {
      const nb = T.NOTEBOOK;
      return [nb.title, ...nb.blocks.map((b) => (b.kind === 'eq' ? `${b.text}, ${b.legend}` : b.text.replace(/\*\*/g, '')))].join('\n\n');
    }
    function copyNotebook() {
      const txt = notebookPlain();
      const done = () => opts.toast('Hefteintrag kopiert.');
      const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); opts.toast(ok ? 'Hefteintrag kopiert.' : 'Kopieren ist hier nicht möglich – bitte abschreiben.'); };
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback(); } catch (e) { fallback(); }
    }
    function printNotebook() {
      const area = document.getElementById('printArea');
      area.innerHTML = notebookHtml();
      try { root.print(); } catch (e) { /* Drucken nicht verfügbar */ }
    }

    return {
      state: S, render, tick, showTab, ghsCard, openNotebook, closeModal, openModal, addsText, part,
      isModalOpen: () => !modal.hidden
    };
  }

  FL.ui = { create, freshState, freshLearn, sanitize, addsText, PTABS };
})(typeof self !== 'undefined' ? self : this);
