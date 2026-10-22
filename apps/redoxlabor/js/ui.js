/*
 * Redoxlabor – Bedienoberfläche
 * Panel, Eingabe (Tippen und Ziehen), gestufte Hilfe, Protokoll,
 * Ergebnisübersicht, Redoxtrainer und Dialoge.
 */
(function (root) {
  'use strict';
  const RL = root.RL;
  const chem = RL.chem, redox = RL.redox;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? c[3] : a})`;
  const PLACE = { rack: 'im Ständer', bath: 'im Wasserbad', flame: 'in der Brennerflamme', moving: 'wird umgesetzt' };
  const STORE_KEY = 'redoxlabor.session.v1';
  const PANEL_NAME = {
    fehling1: ['Fehling I', 'CuSO₄'], fehling2: ['Fehling II', 'Tartrat'],
    agno3: ['AgNO₃', 'Silbernitrat'], naoh: ['NaOH', 'Natronlauge'], nh3: ['NH₃', 'Ammoniak']
  };

  function createUI(lab, renderer, canvas) {
    const panel = $('#panel');
    const toasts = $('#toasts');
    const helpPop = $('#helpPop');
    const drawer = $('#drawer'), drawerBody = $('#drawerBody'), drawerBackdrop = $('#drawerBackdrop');
    const modal = $('#modal'), modalBox = $('#modalBox');
    const ds = { tab: 'protocol', formTube: null, lastRecord: null, redoxTest: 'fehling', trainers: {}, formError: '' };
    let panelSig = '';
    let helpShown = 0, helpSig = '';

    // ============================================================ Sitzung
    function save() {
      try { root.sessionStorage.setItem(STORE_KEY, JSON.stringify(lab.exportSession())); } catch (e) { /* Speicher nicht verfügbar */ }
    }
    function load() {
      try {
        const raw = root.sessionStorage.getItem(STORE_KEY);
        if (raw) lab.importSession(JSON.parse(raw));
      } catch (e) { /* ignorieren */ }
    }

    // ============================================================ Toasts
    let lastToast = '';
    function toast(text, kind) {
      if (text === lastToast && toasts.lastChild) return;
      lastToast = text;
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || '');
      el.textContent = text;
      toasts.appendChild(el);
      while (toasts.children.length > 3) toasts.removeChild(toasts.firstChild);
      setTimeout(() => { el.classList.add('out'); }, kind === 'warn' ? 4800 : 3600);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); if (lastToast === text) lastToast = ''; }, kind === 'warn' ? 5300 : 4100);
    }
    lab.on('message', (m) => toast(m.text, m.kind));

    // ============================================================ Panel
    function tubeIcon(t) {
      const app = chem.appearance(t.contents);
      const vol = chem.volume(t.contents);
      const h = Math.min(22, vol * 3.2);
      const col = app ? rgba(app.body, Math.max(0.25, app.body[3])) : 'transparent';
      const mirror = app && app.mirror > 0.3 ? '<rect x="2" y="' + (29 - h) + '" width="8" height="' + h + '" fill="#b9bfc6" opacity="0.9"/>' : '';
      return `<svg viewBox="0 0 12 32" aria-hidden="true"><path d="M2 2v24a4 4 0 0 0 8 0V2" fill="none" stroke="#7b8a98" stroke-width="1.4"/><clipPath id="tc${t.id}"><path d="M2.7 2v24a3.3 3.3 0 0 0 6.6 0V2z"/></clipPath><g clip-path="url(#tc${t.id})"><rect x="0" y="${30 - h}" width="12" height="${h}" fill="${col}"/>${mirror}</g></svg>`;
    }

    function bottleIcon(id) {
      const r = chem.REAGENT_BY_ID[id];
      const brown = id === 'agno3';
      const liq = r ? r.color : [236, 244, 250, 0.16];
      const fill = brown ? '#8a4a1a' : 'rgba(205,225,238,0.35)';
      return `<svg viewBox="0 0 26 38" aria-hidden="true"><rect x="9.5" y="0.5" width="7" height="6" rx="2" fill="${id && chem.SAMPLE_BY_ID[id] ? '#2b2f33' : '#c8403a'}"/><path d="M9 7h8v4c0 1 6 2 6 6v17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V17c0-4 6-5 6-6z" fill="${fill}" stroke="#6b7c8b" stroke-width="1"/>${brown ? '' : `<path d="M3.6 22h18.8v12a2.5 2.5 0 0 1-2.5 2.5H6.1A2.5 2.5 0 0 1 3.6 34z" fill="${rgba(liq, Math.max(0.18, liq[3]))}"/>`}<rect x="6" y="20" width="14" height="9" rx="1.5" fill="#fff" opacity="0.9"/></svg>`;
    }

    function stepsOf(t) {
      const c = t.contents;
      const a = chem.analyze(c);
      const reagentOk = a.valid && c.mix >= 0.85;
      const heated = chem.heatDose(c) >= 1 || (chem.isReactive(c) && c.progress > 0.97);
      const list = [
        ['Reagenzglas ausgewählt', true],
        ['Nachweisreagenz angesetzt', reagentOk || (a.valid && !!c.sampleId)],
        ['Stoffprobe zugegeben', !!c.sampleId],
        ['Erwärmt und beobachtet', heated],
        ['Beobachtung protokolliert', !!t.recordedId]
      ];
      let cur = list.findIndex((x) => !x[1]);
      return list.map((x, i) => ({ label: x[0], done: x[1], current: i === cur }));
    }

    function phaseWarn(t) {
      const c = t.contents;
      if (c.bumped) return 'Siedeverzug – Ansatz unbrauchbar.';
      const a = chem.analyze(c);
      if (['foreign', 'cuoh2', 'imbalanced'].includes(a.status)) return a.reason;
      return '';
    }

    function signature() {
      const st = lab.state;
      const t = lab.activeTube();
      const parts = [st.mode, st.activeTubeId, st.armed ? st.armed.id : '', st.bath.setting, st.burner.on, st.op ? st.op.type : '', st.protocol.length, st.runId];
      for (const tb of st.tubes) {
        const c = tb.contents;
        parts.push(tb.place, tb.generation, JSON.stringify(c.portions), c.sampleId, c.bumped, tb.recordedId, tb.evaluated, chem.isObservable(c), c.mix >= 0.85, chem.heatDose(c) >= 1);
      }
      if (t) parts.push(lab.phaseOf(t.id).id);
      return parts.join('|');
    }

    function renderPanel() {
      const st = lab.state;
      const t = lab.activeTube();
      const busy = lab.busy();
      const learn = st.mode === 'learn';
      let tubeHtml;
      if (t) {
        const c = t.contents;
        const chips = [];
        for (const r of chem.REAGENTS) if (c.portions[r.id]) chips.push(`<span class="chip">${esc(r.name)}${c.portions[r.id] > 1 ? ' ×' + c.portions[r.id] : ''}</span>`);
        if (c.sampleId) chips.push(`<span class="chip sample">${esc(lab.sampleEntry(c.sampleId).label)}</span>`);
        if (!chips.length) chips.push('<span class="chip empty">leer – Reagenzien antippen</span>');
        const ph = lab.phaseOf(t.id);
        const warn = phaseWarn(t);
        const steps = stepsOf(t).map((s) => `<li class="${s.done ? 'done' : ''} ${s.current ? 'current' : ''}">${s.label}</li>`).join('');
        const inFlame = t.place === 'flame';
        const canRecord = chem.volume(c) > 0 && !busy;
        const observable = chem.isObservable(c) && !t.recordedId && !c.bumped;
        tubeHtml = `
          <div class="tube-head"><b>Reagenzglas ${t.id}</b><span id="tubeLive">${PLACE[t.place]} · ${Math.round(c.temp)} °C</span></div>
          <div class="chips">${chips.join('')}</div>
          <ol class="steps">${steps}</ol>
          <div class="phase ${warn ? 'warn' : observable ? 'ok' : ''}" id="phaseBox">Zustand ${ph.index}/${ph.total}: <b>${ph.label}</b>${warn ? '<br>' + esc(warn) : ''}</div>
          <div class="actions">
            <button type="button" class="btn" data-action="shake" ${busy || inFlame || !chem.volume(c) ? 'disabled' : ''}><span class="i">≈</span>Schütteln</button>
            ${t.place === 'bath' || inFlame
              ? `<button type="button" class="btn" data-action="rack" ${busy ? 'disabled' : ''}><span class="i">⇩</span>In den Ständer</button>`
              : `<button type="button" class="btn" data-action="bath" ${busy ? 'disabled' : ''}><span class="i">♨</span>Ins Wasserbad</button>`}
            ${inFlame
              ? `<button type="button" class="btn" data-action="bath" ${busy ? 'disabled' : ''}><span class="i">♨</span>Ins Wasserbad</button>`
              : `<button type="button" class="btn" data-action="flame" ${busy ? 'disabled' : ''}><span class="i">🔥</span>In die Flamme</button>`}
            <button type="button" class="btn" data-action="replace" ${busy ? 'disabled' : ''}><span class="i">⟲</span>Austauschen</button>
            <button type="button" class="btn ${observable ? 'ok' : 'primary'} wide" data-action="record" ${canRecord ? '' : 'disabled'}><span class="i">✎</span>Beobachtung festhalten</button>
          </div>`;
      } else {
        tubeHtml = '<p class="muted" style="margin:4px 0 2px">Wähle ein Reagenzglas: Tippe im Ständer darauf oder oben auf eine Nummer.</p>';
      }
      const tabs = st.tubes.map((tb) => `<button type="button" class="tube-tab" data-tube="${tb.id}" aria-pressed="${st.activeTubeId === tb.id}" aria-label="Reagenzglas ${tb.id}">${tubeIcon(tb)}${tb.id}${chem.isObservable(tb.contents) && !tb.recordedId && !tb.contents.bumped ? '<span class="dot-ok" title="Beobachtung möglich"></span>' : ''}</button>`).join('');
      const reagents = chem.REAGENTS.map((r) => `<button type="button" class="sub-btn ${st.armed && st.armed.id === r.id ? 'armed' : ''}" data-reagent="${r.id}" ${busy ? 'disabled' : ''} title="${esc(r.name + ' – ' + r.desc)}" aria-label="${esc(r.name)}">${bottleIcon(r.id)}<span>${esc(PANEL_NAME[r.id][0])}</span><small>${esc(PANEL_NAME[r.id][1])}</small></button>`).join('');
      const samples = st.samples.map((s) => {
        const sm = chem.SAMPLE_BY_ID[s.sampleId];
        return `<button type="button" class="sub-btn ${st.armed && st.armed.id === s.sampleId ? 'armed' : ''}" data-sample="${s.sampleId}" ${busy ? 'disabled' : ''}>
          <span class="nm">${esc(learn ? s.label : s.key)}</span><small>${learn ? sm.formula : 'unbekannt'}</small>
          ${learn ? `<span class="info-btn" role="button" tabindex="0" data-info="${s.sampleId}" aria-label="Strukturformel ${esc(s.label)}">i</span>` : ''}
        </button>`;
      }).join('');
      const bath = st.bath;
      panel.innerHTML = `
        <section class="card" aria-label="Reagenzglas">
          <h3>Reagenzglas <small>${t ? '' : 'nicht ausgewählt'}</small></h3>
          <div class="tube-tabs">${tabs}</div>
          ${tubeHtml}
        </section>
        <section class="card" aria-label="Reagenzien">
          <h3>Reagenzien <small>antippen = zugeben</small></h3>
          <div class="substances reagents">${reagents}</div>
        </section>
        <section class="card" aria-label="Stoffproben">
          <h3>Stoffproben <small>${learn ? 'Lernmodus' : 'Analysemodus: unbekannt'}</small></h3>
          <div class="substances samples">${samples}</div>
        </section>
        <section class="card" aria-label="Geräte">
          <h3>Geräte</h3>
          <div class="devices">
            <div class="device-row"><span>Heizplatte <span class="temp-live" id="bathLive">${Math.round(bath.temp)} °C</span></span>
              <div class="seg" role="radiogroup" aria-label="Heizplatte">${[0, 60, 80].map((v) => `<button type="button" role="radio" data-hotplate="${v}" aria-checked="${bath.setting === v}">${v ? v + ' °C' : 'Aus'}</button>`).join('')}</div>
            </div>
            <div class="device-row"><span>Gasbrenner</span>
              <button type="button" class="btn small" data-action="burner">${st.burner.on ? 'Brenner löschen' : 'Brenner entzünden'}</button>
            </div>
          </div>
        </section>`;
      panelSig = signature();
    }

    function refreshLive() {
      const sig = signature();
      if (sig !== panelSig) renderPanel();
      const t = lab.activeTube();
      const live = $('#tubeLive');
      if (t && live) live.textContent = `${PLACE[t.place]} · ${Math.round(t.contents.temp)} °C`;
      const bl = $('#bathLive');
      if (bl) bl.textContent = `${Math.round(lab.state.bath.temp)} °C`;
      if (!helpPop.hidden) renderHelp(false);
      const badge = $('#evalBadge');
      const n = lab.state.protocol.length;
      badge.hidden = n === 0; badge.textContent = n;
    }

    panel.addEventListener('click', (e) => {
      const info = e.target.closest('[data-info]');
      if (info) { e.stopPropagation(); showSampleInfo(info.dataset.info); return; }
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.tube) lab.selectTube(+b.dataset.tube);
      else if (b.dataset.reagent) lab.chooseSubstance(b.dataset.reagent);
      else if (b.dataset.sample) lab.chooseSubstance(b.dataset.sample);
      else if (b.dataset.hotplate != null) lab.setHotplate(+b.dataset.hotplate);
      else if (b.dataset.action) doAction(b.dataset.action);
      refreshLive();
    });

    function needTube() {
      const t = lab.activeTube();
      if (!t) toast('Wähle zuerst ein Reagenzglas aus.', 'warn');
      return t;
    }

    function doAction(a) {
      const t = lab.activeTube();
      switch (a) {
        case 'shake': if (needTube()) lab.shake(t.id); break;
        case 'bath': if (needTube()) lab.moveTube(t.id, 'bath'); break;
        case 'rack': if (needTube()) lab.moveTube(t.id, 'rack'); break;
        case 'flame': if (needTube()) lab.moveTube(t.id, 'flame'); break;
        case 'replace': if (needTube()) lab.replaceTube(t.id); break;
        case 'record': if (needTube()) openProtocol(t.id); break;
        case 'burner': lab.toggleBurner(); break;
      }
    }

    // ============================================================ Canvas-Eingabe
    const ptr = renderer.pointer;
    let down = null;

    canvas.addEventListener('pointerdown', (e) => {
      const p = renderer.toLogical(e.clientX, e.clientY);
      const hit = renderer.hitTest(p.x, p.y);
      down = { id: e.pointerId, x0: e.clientX, y0: e.clientY, hit, type: e.pointerType };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorieren */ }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = renderer.toLogical(e.clientX, e.clientY);
      if (down && down.id === e.pointerId) {
        const dist = Math.hypot(e.clientX - down.x0, e.clientY - down.y0);
        const src = down.hit;
        const draggable = src && (src.type === 'reagent' || src.type === 'sample' || (src.type === 'tube' && lab.tubeById(src.id).place !== 'moving'));
        if (draggable && dist > 10 && !lab.busy()) {
          ptr.drag = { source: src, x: p.x, y: p.y, active: true };
          canvas.classList.add('grabbing');
        }
        if (ptr.drag) { ptr.drag.x = p.x; ptr.drag.y = p.y; }
      } else if (e.pointerType === 'mouse') {
        const hit = renderer.hitTest(p.x, p.y);
        ptr.hover = hit && hit.type !== 'detail' && hit.type !== 'holder' ? hit : null;
        canvas.classList.toggle('pointer', !!ptr.hover);
      }
    });
    const endPointer = (e, cancelled) => {
      if (!down || down.id !== e.pointerId) return;
      const p = renderer.toLogical(e.clientX, e.clientY);
      if (ptr.drag && ptr.drag.active) {
        if (!cancelled) handleDrop(ptr.drag.source, renderer.hitTest(p.x, p.y));
      } else if (!cancelled) {
        handleTap(down.hit);
      }
      ptr.drag = null; down = null;
      canvas.classList.remove('grabbing');
      refreshLive();
    };
    canvas.addEventListener('pointerup', (e) => endPointer(e, false));
    canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
    canvas.addEventListener('pointerleave', () => { if (!down) { ptr.hover = null; canvas.classList.remove('pointer'); } });

    function handleTap(hit) {
      if (!hit) return;
      const t = lab.activeTube();
      switch (hit.type) {
        case 'tube': lab.selectTube(hit.id); break;
        case 'reagent': case 'sample': lab.chooseSubstance(hit.id); break;
        case 'hotplate': lab.cycleHotplate(); break;
        case 'bath': if (needTube()) { if (t.place === 'bath') toast(`Reagenzglas ${t.id} steht bereits im Wasserbad.`); else lab.moveTube(t.id, 'bath'); } break;
        case 'burner': lab.toggleBurner(); break;
        case 'flame': if (needTube()) lab.moveTube(t.id, 'flame'); break;
        case 'rack': if (t && t.place !== 'rack') lab.moveTube(t.id, 'rack'); break;
        case 'holder': toast('Der Reagenzglashalter wird beim Umsetzen ins Wasserbad oder in die Flamme automatisch verwendet.'); break;
      }
    }

    function handleDrop(src, target) {
      if (!target) return;
      if (src.type === 'reagent' || src.type === 'sample') {
        if (target.type === 'tube') lab.addSubstance(target.id, src.id);
        else toast('Ziehe die Pipette auf ein Reagenzglas.', 'warn');
        return;
      }
      if (src.type === 'tube') {
        const map = { bath: 'bath', hotplate: 'bath', flame: 'flame', burner: 'flame', rack: 'rack', tube: 'rack' };
        if (map[target.type]) lab.moveTube(src.id, map[target.type]);
      }
    }

    // ============================================================ Hilfe
    function renderHelp(reset) {
      const h = lab.help();
      const sig = h.levels.join('|');
      if (reset || sig !== helpSig) { if (sig !== helpSig && !reset) helpShown = 0; helpSig = sig; }
      $('#helpContext').textContent = h.context;
      const names = ['Hilfe 1 – Denkimpuls', 'Hilfe 2 – Konkretisierung', 'Hilfe 3 – Konkrete Anleitung'];
      $('#helpLevels').innerHTML = h.levels.slice(0, helpShown).map((l, i) => `<li><b>${names[i]}</b>${esc(l)}</li>`).join('');
      const more = $('#helpMore');
      more.hidden = helpShown >= 3;
      more.textContent = names[helpShown] || '';
    }
    function toggleHelp(force) {
      const open = force != null ? force : helpPop.hidden;
      helpPop.hidden = !open;
      $('#btnHelp').classList.toggle('on', open);
      if (open) { helpShown = 0; renderHelp(true); }
    }
    $('#btnHelp').addEventListener('click', () => toggleHelp());
    $('#helpClose').addEventListener('click', () => toggleHelp(false));
    $('#helpMore').addEventListener('click', () => { helpShown = Math.min(3, helpShown + 1); renderHelp(false); });

    // ============================================================ Dialoge
    function showModal(html, cls) {
      modalBox.className = 'modal ' + (cls || '');
      modalBox.innerHTML = html;
      modal.hidden = false;
      const f = modalBox.querySelector('button.primary, button');
      if (f) f.focus();
    }
    function closeModal() { modal.hidden = true; modalBox.innerHTML = ''; }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { if (!modalBox.classList.contains('safety')) closeModal(); return; }
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const act = b.dataset.m;
      if (act === 'close') closeModal();
      else if (act === 'resetBench') { lab.resetBench(); closeModal(); toast('Laboraufbau wurde zurückgesetzt. Das Protokoll bleibt erhalten.'); }
      else if (act === 'fullRestart') { lab.fullRestart(); closeModal(); ds.trainers = {}; ds.formTube = null; ds.lastRecord = null; toast(lab.state.mode === 'analysis' ? 'Neustart: Die Proben A–F wurden neu gemischt.' : 'Neustart durchgeführt.'); }
      else if (act === 'mode') { lab.setMode(b.dataset.mode); closeModal(); ds.trainers = {}; ds.formTube = null; ds.lastRecord = null; syncMode(); toast(b.dataset.mode === 'analysis' ? 'Analysemodus: Untersuche die unbekannten Proben A–F.' : 'Lernmodus: Die Proben sind beschriftet.'); }
      else if (act === 'onboard') { closeModal(); try { root.sessionStorage.setItem('redoxlabor.onboarded', '1'); } catch (err) { /* */ } }
      save();
      refreshLive();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!modal.hidden && !modalBox.classList.contains('safety')) closeModal();
        else if (!drawer.hidden) closeDrawer();
        else if (!helpPop.hidden) toggleHelp(false);
      }
    });

    function showSampleInfo(id) {
      const s = chem.SAMPLE_BY_ID[id];
      showModal(`
        <h2>${esc(s.name)} <span class="muted">(${esc(s.trivial)})</span></h2>
        <div class="sample-info">
          <dl class="facts">
            <dt>Stoffklasse</dt><dd>${s.cls === 'aldehyd' ? 'Aldehyd (Alkanal)' : 'Keton (Alkanon)'}</dd>
            <dt>Summenformel</dt><dd class="formula">${s.formula}</dd>
            <dt>Halbstrukturformel</dt><dd class="formula">${s.condensed}</dd>
          </dl>
          <div>${RL.structures.structureSvg(s, { size: 24 })}</div>
          <p class="muted">${s.cls === 'aldehyd'
            ? 'Die Carbonylgruppe steht am Kettenende; am Carbonyl-C-Atom sitzt ein H-Atom (Aldehydgruppe –CHO).'
            : 'Die Carbonylgruppe steht innerhalb der Kette; das Carbonyl-C-Atom ist mit zwei C-Atomen verbunden und trägt kein H-Atom.'}
          ${id === 'propanal' || id === 'propanon' ? ' Propanal und Propanon haben dieselbe Summenformel C₃H₆O (Isomere).' : ''}
          ${id === 'butanal' || id === 'butanon' ? ' Butanal und Butanon haben dieselbe Summenformel C₄H₈O (Isomere).' : ''}</p>
        </div>
        <div class="row end"><button type="button" class="btn primary" data-m="close">Schließen</button></div>`);
    }

    lab.on('safety', (e) => {
      const tollens = e.system === 'tollens';
      setTimeout(() => showModal(`
        <h2>⚠ Siedeverzug!</h2>
        <p>Beim direkten Erhitzen in der Brennerflamme wurde die Flüssigkeit über ihre Siedetemperatur erhitzt, ohne zu sieden. Dann verdampft sie schlagartig – heiße Flüssigkeit spritzt aus dem Reagenzglas.</p>
        <p><b>Sicherheitshinweise:</b></p>
        <ul>
          <li>Fehling- und Tollens-Proben im <b>Wasserbad</b> erwärmen.</li>
          <li>Schutzbrille tragen. Die Öffnung des Reagenzglases nie auf Personen richten.</li>
          <li>Wird doch einmal über der Flamme erhitzt: Reagenzglas mit dem Halter schräg halten, ständig schütteln und nur kurz erhitzen.</li>
          ${tollens ? '<li><b>Tollens-Reagenz nie direkt in der Flamme erhitzen</b>, immer frisch ansetzen und nicht aufbewahren: Beim Stehenlassen können sich explosive Silberverbindungen bilden.</li>' : ''}
        </ul>
        <p class="muted">Dieser Ansatz ist nicht mehr auswertbar. Nimm das Reagenzglas aus der Flamme, tausche es aus und wiederhole den Versuch im Wasserbad.</p>
        <div class="row end"><button type="button" class="btn primary" data-m="close">Verstanden</button></div>`, 'safety'), 900);
    });

    $('#btnRestart').addEventListener('click', () => {
      showModal(`
        <h2>Neustart</h2>
        <p>Was möchtest du zurücksetzen?</p>
        <div class="row" style="flex-direction:column;align-items:stretch">
          <button type="button" class="btn primary" data-m="resetBench">Laboraufbau zurücksetzen<br><small>Reagenzgläser leeren, Geräte aus – Protokoll bleibt erhalten</small></button>
          <button type="button" class="btn" data-m="fullRestart">Alles neu starten<br><small>Protokoll löschen${lab.state.mode === 'analysis' ? ', Proben A–F neu mischen' : ''}</small></button>
          <button type="button" class="btn" data-m="close">Abbrechen</button>
        </div>`);
    });

    function syncMode() {
      $$('.mode-switch button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === lab.state.mode)));
    }
    $$('.mode-switch button').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.mode;
      if (m === lab.state.mode) return;
      showModal(`
        <h2>${m === 'analysis' ? 'Zum Analysemodus wechseln?' : 'Zum Lernmodus wechseln?'}</h2>
        <p>${m === 'analysis'
          ? 'Im Analysemodus sind die Stoffproben nur mit A–F beschriftet und werden zufällig zugeordnet. Untersuche sie mit Fehling- und Tollens-Probe und ordne sie begründet ein.'
          : 'Im Lernmodus sind die Stoffproben mit Namen und Formeln beschriftet.'}</p>
        <p class="muted">Beim Wechsel werden Laboraufbau und Protokoll zurückgesetzt.</p>
        <div class="row end"><button type="button" class="btn" data-m="close">Abbrechen</button><button type="button" class="btn primary" data-m="mode" data-mode="${m}">Wechseln</button></div>`);
    }));

    function onboarding() {
      let seen = false;
      try { seen = root.sessionStorage.getItem('redoxlabor.onboarded') === '1'; } catch (e) { /* */ }
      if (seen || /[?&]noIntro/.test(root.location.search)) return;
      showModal(`
        <h2>Willkommen im Redoxlabor</h2>
        <p>Weise mit der <b>Fehling-Probe</b> und der <b>Tollens-Probe</b> nach, welche Stoffe reduzierend wirken.</p>
        <ol class="howto">
          <li><b>Reagenzglas wählen:</b> Tippe im Ständer auf ein Reagenzglas.</li>
          <li><b>Reagenz ansetzen:</b> Tippe auf die Reagenzflaschen – die Pipette gibt eine Portion zu. Du kannst Flaschen auch auf ein Reagenzglas ziehen.</li>
          <li><b>Stoffprobe zugeben</b> und <b>erwärmen:</b> Heizplatte einschalten, Reagenzglas ins Wasserbad stellen.</li>
          <li><b>Beobachten</b> in der Lupe und die <b>Beobachtung festhalten</b>.</li>
          <li>In der <b>Auswertung</b> deuten und im <b>Redox-Trainer</b> die Gleichungen aufstellen.</li>
        </ol>
        <p class="muted">Bei Fragen hilft die gestufte <b>Hilfe</b> oben rechts. Dies ist ein virtuelles Experiment und keine Anleitung für reale Laborarbeit.</p>
        <div class="row end"><button type="button" class="btn primary" data-m="onboard">Los geht’s</button></div>`);
    }

    // ============================================================ Auswertung (Drawer)
    function openDrawer(tab) {
      ds.tab = tab || ds.tab;
      drawer.hidden = false; drawerBackdrop.hidden = false;
      toggleHelp(false);
      renderDrawer();
    }
    function closeDrawer() { drawer.hidden = true; drawerBackdrop.hidden = true; }
    $('#drawerClose').addEventListener('click', closeDrawer);
    drawerBackdrop.addEventListener('click', closeDrawer);
    $$('.tabs button').forEach((b) => b.addEventListener('click', () => { ds.tab = b.dataset.tab; renderDrawer(); }));
    $('#btnEval').addEventListener('click', () => openDrawer(ds.tab === 'redox' ? 'protocol' : ds.tab));
    $('#btnRedox').addEventListener('click', () => openDrawer('redox'));

    function openProtocol(tubeId) {
      ds.formTube = tubeId; ds.lastRecord = null; ds.formError = '';
      openDrawer('protocol');
    }

    function renderDrawer() {
      $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ds.tab)));
      if (ds.tab === 'protocol') drawerBody.innerHTML = protocolHtml();
      else if (ds.tab === 'overview') drawerBody.innerHTML = overviewHtml();
      else drawerBody.innerHTML = redoxHtml();
      drawerBody.scrollTop = 0;
    }

    function optionList(name, dict, type, selected, marks) {
      return Object.entries(dict).map(([k, label]) => {
        const checked = Array.isArray(selected) ? selected.includes(k) : selected === k;
        const mk = marks ? marks(k, checked) : '';
        return `<label class="opt ${mk}"><input type="${type}" name="${name}" value="${k}" ${checked ? 'checked' : ''} ${marks ? 'disabled' : ''}><span>${esc(label)}</span></label>`;
      }).join('');
    }

    function tubeFacts(t) {
      const c = t.contents;
      const parts = [];
      for (const id of c.history) parts.push(lab.substanceLabel(id));
      const compact = [];
      parts.forEach((p) => { const last = compact[compact.length - 1]; if (last && last.n === p) last.k++; else compact.push({ n: p, k: 1 }); });
      const seq = compact.map((x) => x.n + (x.k > 1 ? ' ×' + x.k : '')).join(' → ') || '–';
      const heatTxt = c.maxTemp > 35 ? `ja, bis ca. ${Math.round(c.maxTemp)} °C` : 'nein';
      return `<dl class="facts"><dt>Reagenzglas</dt><dd>${t.id}</dd><dt>Stoffprobe</dt><dd>${c.sampleId ? esc(lab.sampleEntry(c.sampleId).label) : 'keine'}</dd><dt>Zugaben</dt><dd>${esc(seq)}</dd><dt>Erwärmt</dt><dd>${heatTxt}</dd></dl>`;
    }

    function protocolHtml() {
      let html = '';
      const t = ds.formTube ? lab.tubeById(ds.formTube) : null;
      const rec = ds.lastRecord ? lab.state.protocol.find((r) => r.id === ds.lastRecord) : null;
      if (rec) html += feedbackHtml(rec);
      else if (t && chem.volume(t.contents) > 0) html += formHtml(t);
      else html += `<h2>Protokoll</h2><p class="lead">Führe einen Versuch durch und tippe dann am Reagenzglas auf <b>„Beobachtung festhalten“</b>. Hier erscheinen alle protokollierten Versuche.</p>`;
      const recs = lab.state.protocol.slice().reverse();
      html += `<h3>Protokollierte Versuche (${recs.length})</h3>`;
      html += recs.length ? `<div class="records">${recs.map(recordCard).join('')}</div>` : '<p class="muted">Noch keine Einträge.</p>';
      return html;
    }

    function formHtml(t) {
      const obs = chem.isObservable(t.contents);
      return `
        <h2>Beobachtung festhalten</h2>
        <p class="lead">Halte zuerst fest, was du <b>beobachtet</b> hast, und deute es dann. Die Musterlösung erscheint erst nach dem Auswerten oder auf ausdrücklichen Wunsch.</p>
        ${tubeFacts(t)}
        ${obs ? '' : '<div class="note warn">Hinweis: Der Versuch ist noch nicht abgeschlossen (nicht oder nicht ausreichend erwärmt bzw. Reaktion noch im Gange). Du kannst trotzdem protokollieren – überlege, ob sich daraus schon ein Ergebnis ableiten lässt.</div>'}
        ${ds.formError ? `<div class="note bad">${esc(ds.formError)}</div>` : ''}
        <form id="protoForm" data-tube="${t.id}">
          <fieldset><legend>1. Nachweisverfahren</legend><div class="opts">${optionList('method', chem.METHODS, 'radio', null)}</div></fieldset>
          <fieldset><legend>2. Beobachtung <span class="muted">(alles Zutreffende ankreuzen)</span></legend><div class="opts">${optionList('obs', chem.OBSERVATIONS, 'checkbox', [])}</div>
            <p class="muted" style="margin:10px 0 4px">Eigene Notiz (optional, bleibt nur in diesem Browser):</p><textarea name="note" maxlength="500"></textarea></fieldset>
          <fieldset><legend>3. Ergebnis</legend><div class="opts">${optionList('result', chem.RESULTS, 'radio', null)}</div></fieldset>
          <fieldset><legend>4. Deutung</legend><div class="opts">${optionList('interp', chem.INTERPRETATIONS, 'radio', null)}</div></fieldset>
          <fieldset><legend>5. Stoffklasse</legend><div class="opts">${optionList('cls', chem.CLASSES, 'radio', null)}</div></fieldset>
          <div class="row end">
            <button type="button" class="btn" data-proto="solution">Lösung anzeigen</button>
            <button type="submit" class="btn primary">Speichern und auswerten</button>
          </div>
        </form>`;
    }

    function readForm(form) {
      const fd = new FormData(form);
      return {
        method: fd.get('method'), observations: fd.getAll('obs'), result: fd.get('result'),
        interpretation: fd.get('interp'), cls: fd.get('cls'), note: String(fd.get('note') || '').slice(0, 500)
      };
    }

    drawerBody.addEventListener('submit', (e) => {
      const form = e.target.closest('#protoForm');
      if (!form) return;
      e.preventDefault();
      const ans = readForm(form);
      if (!ans.method || !ans.observations.length || !ans.result || !ans.interpretation || !ans.cls) {
        ds.formError = 'Bitte fülle alle fünf Teile aus (mindestens eine Beobachtung ankreuzen).';
        renderDrawer();
        return;
      }
      const rec = lab.recordProtocol(+form.dataset.tube, ans);
      ds.lastRecord = rec.id; ds.formError = '';
      save();
      renderDrawer();
    });

    drawerBody.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.proto === 'solution') {
        const form = $('#protoForm');
        const ans = readForm(form);
        const any = ans.method || ans.observations.length || ans.result || ans.interpretation || ans.cls;
        const rec = lab.recordProtocol(+form.dataset.tube, any ? Object.assign(ans, { partial: true }) : null, { solutionShown: true });
        if (any) rec.graded = chem.gradeProtocol(rec.model, ans);
        rec.solutionShown = true;
        ds.lastRecord = rec.id;
        save(); renderDrawer();
      } else if (b.dataset.goto) {
        if (b.dataset.goto === 'redox') { ds.redoxTest = b.dataset.test || ds.redoxTest; }
        ds.tab = b.dataset.goto; ds.lastRecord = null; ds.formTube = null;
        renderDrawer();
      } else if (b.dataset.newform) {
        ds.lastRecord = null; ds.formTube = null; closeDrawer();
      } else if (b.dataset.rx) {
        redoxClick(b);
      } else if (b.dataset.an) {
        analysisClick(b.dataset.an);
      }
    });
    drawerBody.addEventListener('change', (e) => {
      const s = e.target.closest('select[data-field]');
      if (s) {
        const tr = trainerState();
        tr.answers[s.dataset.field] = s.value;
        s.classList.remove('right', 'wrong');
      }
      const a = e.target.closest('select[data-assign]');
      if (a) { lab.state.analysisAnswers[a.dataset.assign] = a.value; save(); }
    });

    function feedbackHtml(rec) {
      const m = rec.model;
      const g = rec.graded;
      const ans = rec.answers;
      const marks = (field) => (k, checked) => {
        if (!rec.solutionShown && !g) return '';
        if (field === 'obs') {
          const req = m.obsRequired.includes(k), opt = m.obsOptional.includes(k);
          if (checked && (req || opt)) return 'right';
          if (checked && m.strictObs) return 'wrong';
          if (!checked && req && rec.solutionShown) return 'right';
          return '';
        }
        const correct = { method: m.method, result: m.result, interp: m.interpretation, cls: m.cls }[field];
        if (k === correct && (checked || rec.solutionShown)) return 'right';
        if (checked && k !== correct) return 'wrong';
        return '';
      };
      const fbItems = g ? [
        ['Nachweisverfahren', g.method], ['Beobachtung', g.observations], ['Ergebnis', g.result], ['Deutung', g.interpretation], ['Stoffklasse', g.cls]
      ].map(([n, ok]) => `<li class="${ok ? 'y' : 'n'}">${n}</li>`).join('') : '';
      const allOk = g && g.allCorrect;
      const positive = m.outcome === 'positive';
      return `
        <h2>Auswertung · Reagenzglas ${rec.tubeId}</h2>
        <dl class="facts"><dt>Stoffprobe</dt><dd>${esc(rec.sampleLabel)}</dd></dl>
        ${g ? `<div class="note ${allOk ? 'ok' : 'warn'}"><b>${allOk ? 'Alles richtig ausgewertet!' : 'Deine Auswertung im Vergleich:'}</b><ul class="feedback-list">${fbItems}</ul>${g.obsMissing && g.obsMissing.length && !allOk ? 'Es fehlt mindestens eine zutreffende Beobachtung.' : ''}</div>` : ''}
        ${rec.solutionShown ? '<div class="note info">Die Musterlösung wurde auf Anfrage angezeigt.</div>' : ''}
        <div class="note ${m.outcome === 'positive' ? 'ok' : m.outcome === 'negative' ? 'info' : 'warn'}"><b>Musterauswertung: ${esc(m.title)}</b><br>${esc(m.explanation)}</div>
        <fieldset><legend>1. Nachweisverfahren</legend><div class="opts">${optionList('method', chem.METHODS, 'radio', ans && ans.method, marks('method'))}</div></fieldset>
        <fieldset><legend>2. Beobachtung</legend><div class="opts">${optionList('obs', chem.OBSERVATIONS, 'checkbox', (ans && ans.observations) || [], marks('obs'))}</div>${ans && ans.note ? `<p class="muted">Deine Notiz: ${esc(ans.note)}</p>` : ''}</fieldset>
        <fieldset><legend>3. Ergebnis</legend><div class="opts">${optionList('result', chem.RESULTS, 'radio', ans && ans.result, marks('result'))}</div></fieldset>
        <fieldset><legend>4. Deutung</legend><div class="opts">${optionList('interp', chem.INTERPRETATIONS, 'radio', ans && ans.interpretation, marks('interp'))}</div></fieldset>
        <fieldset><legend>5. Stoffklasse</legend><div class="opts">${optionList('cls', chem.CLASSES, 'radio', ans && ans.cls, marks('cls'))}</div></fieldset>
        <div class="row end">
          ${positive ? `<button type="button" class="btn ok" data-goto="redox" data-test="${m.method}">Redoxreaktion erarbeiten →</button>` : ''}
          <button type="button" class="btn" data-goto="overview">Zur Ergebnisübersicht</button>
          <button type="button" class="btn primary" data-newform="1">Weiter experimentieren</button>
        </div>`;
    }

    function outcomePill(m) {
      if (m.outcome === 'positive') return '<span class="pill pos">positiv</span>';
      if (m.outcome === 'negative') return '<span class="pill neg">negativ</span>';
      if (m.outcome === 'unfinished') return '<span class="pill inv">nicht abgeschlossen</span>';
      return '<span class="pill inv">kein gültiger Nachweis</span>';
    }
    function gradePill(rec) {
      if (rec.graded && !rec.answers.partial) return rec.graded.allCorrect ? '<span class="pill ok">✓ richtig ausgewertet</span>' : '<span class="pill no">✗ Auswertung teilweise falsch</span>';
      if (rec.solutionShown) return '<span class="pill">Lösung angezeigt</span>';
      return '';
    }
    function recordCard(rec) {
      const m = rec.model;
      return `<article class="record"><header><b>${esc(rec.sampleLabel)} · ${esc(chem.METHODS[m.method] || 'unvollständig')}</b><span>${outcomePill(m)} ${gradePill(rec)}</span></header>
        <span class="muted">Reagenzglas ${rec.tubeId} · ${esc(m.title)}</span></article>`;
    }

    // --------------------------------------------------------- Ergebnisübersicht
    function overviewHtml() {
      const st = lab.state;
      const rows = lab.overview();
      const analysis = st.mode === 'analysis';
      const cell = (rec) => rec ? `${outcomePill(rec.model)}${rec.graded && !rec.answers.partial ? (rec.graded.allCorrect ? ' ✓' : ' ✗') : ''}` : '<span class="muted">–</span>';
      let checkRes = null;
      if (analysis && st.analysisChecked) checkRes = Object.fromEntries(lab.checkAnalysisSilent().map((r) => [r.key, r]));
      const body = rows.map((r) => {
        const s = chem.SAMPLE_BY_ID[r.sampleId];
        let extra = '';
        if (analysis) {
          const v = st.analysisAnswers[r.key] || '';
          const cr = checkRes && checkRes[r.key];
          extra = `<td><select data-assign="${r.key}" aria-label="Einordnung ${r.key}">
              <option value="" ${!v ? 'selected' : ''}>– wählen –</option>
              <option value="aldehyd" ${v === 'aldehyd' ? 'selected' : ''}>Aldehyd (reduzierend)</option>
              <option value="keinAldehyd" ${v === 'keinAldehyd' ? 'selected' : ''}>kein Aldehyd (Keton)</option></select>
              ${cr ? (cr.correct ? (cr.hasEvidence ? ' <span class="pill ok">✓</span>' : ' <span class="pill">✓ aber ohne Nachweis</span>') : ' <span class="pill no">✗</span>') : ''}</td>`;
          if (st.analysisRevealed) extra += `<td>${esc(s.name)} <span class="muted">(${s.cls === 'aldehyd' ? 'Aldehyd' : 'Keton'})</span></td>`;
        } else {
          extra = `<td>${s.cls === 'aldehyd' ? 'Aldehyd' : 'Keton'} <span class="muted">${s.formula}</span></td>`;
        }
        return `<tr><td><b>${esc(r.label)}</b></td><td>${cell(r.fehling)}</td><td>${cell(r.tollens)}</td>${extra}</tr>`;
      }).join('');
      const head = analysis
        ? `<th>Probe</th><th>Fehling</th><th>Tollens</th><th>Deine Einordnung</th>${st.analysisRevealed ? '<th>Auflösung</th>' : ''}`
        : '<th>Stoffprobe</th><th>Fehling</th><th>Tollens</th><th>Stoffklasse</th>';
      return `
        <h2>Ergebnisübersicht</h2>
        <p class="lead">${analysis
          ? 'Vergleiche die Nachweise der unbekannten Proben A–F und ordne jede Probe begründet ein. Grundlage ist das jeweils zuletzt protokollierte Ergebnis.'
          : 'Vergleiche, wie Aldehyde und Ketone in den beiden Nachweisen reagieren. Grundlage ist das jeweils zuletzt protokollierte Ergebnis.'}</p>
        <table class="ov"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
        ${analysis ? `<div class="row end" style="margin-top:12px">
            <button type="button" class="btn" data-an="check">Einordnung prüfen</button>
            <button type="button" class="btn" data-an="reveal">Auflösung anzeigen</button></div>` : ''}
        <div class="note info"><b>Grenzen der Nachweise:</b> Fehling- und Tollens-Probe zeigen, ob ein Stoff <i>reduzierend</i> wirkt. Alle drei Aldehyde reagieren gleich – ein positiver Nachweis verrät daher nicht, <i>welcher</i> Aldehyd vorliegt. Ein negativer Nachweis zeigt nur, dass keine Aldehydgruppe nachweisbar ist; dass ein Keton vorliegt, folgt daraus erst, weil der Probensatz nur Aldehyde und Ketone enthält. Zur genauen Identifizierung wären weitere Untersuchungen nötig (z. B. Siedetemperatur oder Spektroskopie).</div>
        ${analysis && st.analysisRevealed ? '<div class="note warn">Beachte: Propanal und Propanon (C₃H₆O) sowie Butanal und Butanon (C₄H₈O) haben jeweils dieselbe Summenformel – erst die funktionelle Gruppe entscheidet über das Verhalten im Nachweis.</div>' : ''}`;
    }

    function analysisClick(act) {
      if (act === 'check') {
        const answers = {};
        $$('select[data-assign]', drawerBody).forEach((s) => { answers[s.dataset.assign] = s.value; });
        const res = lab.checkAnalysis(answers);
        const n = res.filter((r) => r.correct && r.hasEvidence).length;
        toast(`${n} von 6 Proben richtig und mit Nachweis eingeordnet.`, n === 6 ? 'success' : 'info');
      } else if (act === 'reveal') {
        lab.revealAnalysis();
      }
      save();
      renderDrawer();
    }

    // --------------------------------------------------------- Redoxtrainer
    function trainerState() {
      const k = ds.redoxTest;
      if (!ds.trainers[k]) ds.trainers[k] = { def: redox.buildTrainer(k), answers: {}, res: {}, hints: {}, solved: {}, full: false };
      return ds.trainers[k];
    }

    function positiveRecordFor(test) {
      return lab.state.protocol.slice().reverse().find((r) => r.model.method === test && r.model.outcome === 'positive');
    }

    function selectHtml(f, tr, step) {
      const v = tr.answers[f.id] || '';
      const r = tr.res[step.id];
      const cls = r && r.fields[f.id] != null ? (r.fields[f.id] ? 'right' : 'wrong') : '';
      const dis = tr.solved[step.id] ? 'disabled' : '';
      return `<select data-field="${f.id}" class="${cls}" ${dis} aria-label="${esc(f.label || 'Auswahl')}"><option value="">–</option>${f.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }

    function redoxHtml() {
      const tr = trainerState();
      const def = tr.def;
      const test = ds.redoxTest;
      const rec = positiveRecordFor(test);
      const sample = rec && rec.sampleId ? chem.SAMPLE_BY_ID[rec.sampleId] : null;
      const learn = lab.state.mode === 'learn' || lab.state.analysisRevealed;
      let ctxNote;
      if (rec) ctxNote = `<div class="note ok">Grundlage: dein positiver ${test === 'fehling' ? 'Fehling' : 'Tollens'}-Nachweis mit <b>${esc(rec.sampleLabel)}</b> (Reagenzglas ${rec.tubeId}). ${learn && sample ? `Hier ist R = ${sample.R}.` : 'Welcher Aldehyd vorliegt, bestimmt der Nachweis nicht – daher allgemein mit R.'}</div>`;
      else ctxNote = `<div class="note warn">Du hast noch keinen positiven ${test === 'fehling' ? 'Fehling' : 'Tollens'}-Nachweis protokolliert. Am besten führst du zuerst den Versuch durch – üben kannst du aber trotzdem.</div>`;
      let firstOpen = def.steps.findIndex((s) => !tr.solved[s.id]);
      if (firstOpen < 0) firstOpen = def.steps.length;
      const steps = def.steps.map((s, i) => {
        const locked = i > firstOpen;
        const solved = !!tr.solved[s.id];
        let inner = '';
        if (!locked) {
          if (s.fields) inner += s.fields.map((f) => `<div class="rx-field"><span>${f.label}</span>${selectHtml(f, tr, s)}</div>`).join('');
          if (s.eqs) inner += s.eqs.map((e) => `<div class="eq"><span class="lbl">${e.label}</span>${e.parts.map((p) => (p.id ? selectHtml(p, tr, s) : `<span>${p.t}</span>`)).join('')}</div>`).join('');
          const nh = tr.hints[s.id] || 0;
          if (nh) inner += `<ol class="hint-list">${s.hints.slice(0, nh).map((h) => `<li>${esc(h)}</li>`).join('')}</ol>`;
          const r = tr.res[s.id];
          if (r && !solved) inner += '<div class="note warn" style="margin:8px 0 0">Noch nicht ganz richtig – rot markierte Felder prüfen.</div>';
          if (solved) inner += `<div class="note ok" style="margin:8px 0 0">${tr.res[s.id] && tr.res[s.id].shown ? 'Lösung angezeigt.' : 'Richtig!'}</div>`;
          if (!solved) {
            inner += `<div class="row end" style="margin-top:8px">
              <button type="button" class="btn small" data-rx="hint" data-step="${s.id}" ${nh >= 3 ? 'disabled' : ''}>Tipp ${Math.min(3, nh + 1)}/3</button>
              <button type="button" class="btn small" data-rx="show" data-step="${s.id}">Lösung dieses Schritts</button>
              <button type="button" class="btn small primary" data-rx="check" data-step="${s.id}">Prüfen</button></div>`;
          }
        }
        return `<section class="rx-step ${locked ? 'locked' : ''} ${solved ? 'solved' : ''}" data-stepid="${s.id}">
          <h4><span class="n">${solved ? '✓' : i + 1}</span>${s.title}</h4>
          ${locked ? '<p class="muted" style="margin:0">Wird nach dem vorherigen Schritt freigeschaltet.</p>' : `<p class="muted" style="margin:0 0 6px">${esc(s.intro)}</p>${inner}`}
        </section>`;
      }).join('');
      return `
        <h2>Redox-Trainer</h2>
        <div class="row" style="margin:8px 0 10px">
          <div class="seg" role="radiogroup" aria-label="Nachweis" style="background:#e9eef3">
            <button type="button" role="radio" data-rx="test" data-test="fehling" aria-checked="${test === 'fehling'}" style="color:var(--ink)">Fehling-Probe</button>
            <button type="button" role="radio" data-rx="test" data-test="tollens" aria-checked="${test === 'tollens'}" style="color:var(--ink)">Tollens-Probe</button>
          </div>
        </div>
        ${ctxNote}
        <div class="rx-steps">${steps}</div>
        ${tr.confirmFull
          ? `<div class="note warn" style="margin-top:14px">Du hast noch nicht alle Schritte bearbeitet. Möchtest du die vollständige Musterlösung wirklich schon anzeigen?
              <div class="row end" style="margin-top:8px"><button type="button" class="btn small" data-rx="fullCancel">Selbst weiterarbeiten</button><button type="button" class="btn small primary" data-rx="full">Ja, Musterlösung anzeigen</button></div></div>`
          : `<div class="row end" style="margin-top:14px"><button type="button" class="btn ${tr.full ? '' : 'primary'}" data-rx="full">${tr.full ? 'Musterlösung ausblenden' : 'Vollständige Musterlösung anzeigen'}</button></div>`}
        ${tr.full ? fullSolutionHtml(test, learn ? sample : null) : ''}
        <details class="fach"><summary>Fachlicher Hinweis zur Schreibweise R–COOH</summary><p>${esc(redox.COOH_NOTE)}</p></details>`;
    }

    function fullSolutionHtml(test, sample) {
      const E = redox.EQUATIONS[test];
      const F = test === 'fehling';
      const bal = redox.balance(E.total);
      const els = Object.keys(bal.left.atoms);
      const balRows = els.map((k) => `<tr><td>${k}</td><td>${bal.left.atoms[k]}</td><td>${bal.right.atoms[k] || 0}</td></tr>`).join('');
      let example = '';
      if (sample) {
        const eq = redox.eqToHtml(E.total).replace('R–CHO', sample.condensed).replace('R–COOH', sample.acidCondensed);
        example = `<h3>Beispiel: ${esc(sample.name)} → ${esc(sample.acid)}</h3><div class="eqline">${eq}</div>`;
      }
      return `
        <section class="rx-step solved" style="margin-top:12px">
          <h4><span class="n">★</span>Musterlösung ${F ? 'Fehling-Probe' : 'Tollens-Probe'}</h4>
          <p><b>Oxidation</b> (C: +I → +III, Elektronenabgabe):</p><div class="eqline">${redox.eqToHtml(E.oxidation)}</div>
          <p><b>Reduktion</b> (${F ? 'Cu: +II → +I' : 'Ag: +I → 0'}, Elektronenaufnahme):</p><div class="eqline">${redox.eqToHtml(E.reduction)}</div>
          <p><b>Redoxreaktion</b> (Gesamtgleichung):</p><div class="eqline">${redox.eqToHtml(E.total)}</div>
          ${example}
          <p class="muted">Das Aldehyd ist das Reduktionsmittel, ${F ? 'die Kupfer(II)-Ionen sind' : 'die Silber(I)-Ionen sind'} das Oxidationsmittel. ${F ? 'Das ziegelrote Kupfer(I)-oxid ist die sichtbare Nachweisreaktion.' : 'Das abgeschiedene Silber bildet den Silberspiegel.'}</p>
          <h3>Kontrolle der Gesamtgleichung</h3>
          <table class="bal"><thead><tr><th>Atom</th><th>links</th><th>rechts</th></tr></thead><tbody>${balRows}<tr><td>Ladung</td><td>${bal.left.charge}</td><td>${bal.right.charge}</td></tr></tbody></table>
          <p class="muted">${F ? 'Die Bildung des tiefblauen Kupfer-Tartrat-Komplexes ist in dieser vereinfachten Gleichung nicht berücksichtigt.' : 'Der Silber-Ammin-Komplex [Ag(NH₃)₂]⁺ entsteht bei der Herstellung des Tollens-Reagenzes.'}</p>
        </section>`;
    }

    function redoxClick(b) {
      const act = b.dataset.rx;
      if (act === 'test') { ds.redoxTest = b.dataset.test; renderDrawer(); return; }
      const tr = trainerState();
      if (act === 'full') {
        const done = tr.def.steps.every((s) => tr.solved[s.id]);
        if (!tr.full && !done && !tr.confirmFull) { tr.confirmFull = true; renderDrawer(); return; }
        tr.full = !tr.full; tr.confirmFull = false; renderDrawer(); return;
      }
      if (act === 'fullCancel') { tr.confirmFull = false; renderDrawer(); return; }
      const step = tr.def.steps.find((s) => s.id === b.dataset.step);
      if (!step) return;
      // aktuelle Auswahl übernehmen
      $$(`.rx-step[data-stepid="${step.id}"] select[data-field]`, drawerBody).forEach((s) => { tr.answers[s.dataset.field] = s.value; });
      if (act === 'hint') tr.hints[step.id] = Math.min(3, (tr.hints[step.id] || 0) + 1);
      if (act === 'check') {
        const r = redox.checkStep(step, tr.answers);
        tr.res[step.id] = r;
        if (r.allCorrect) tr.solved[step.id] = true;
      }
      if (act === 'show') {
        for (const f of redox.fieldsOf(step)) tr.answers[f.id] = f.answer;
        tr.res[step.id] = Object.assign(redox.checkStep(step, tr.answers), { shown: true });
        tr.solved[step.id] = true;
      }
      const y = drawerBody.scrollTop;
      renderDrawer();
      drawerBody.scrollTop = y;
    }

    // Prüfung ohne Ereignis (für die Anzeige)
    lab.checkAnalysisSilent = function () {
      const answers = lab.state.analysisAnswers;
      return lab.overview().map((row) => {
        const truth = chem.SAMPLE_BY_ID[row.sampleId];
        const evidence = [row.fehling, row.tollens].filter((r) => r && (r.model.outcome === 'positive' || r.model.outcome === 'negative'));
        const answer = answers[row.key] || '';
        const expected = truth.reducing ? 'aldehyd' : 'keinAldehyd';
        return { key: row.key, correct: answer === expected, hasEvidence: evidence.length > 0 };
      });
    };

    // ============================================================ Ereignisse
    lab.on('change', () => refreshLive());
    lab.on('protocol', () => save());
    lab.on('restart', () => { syncMode(); save(); renderPanel(); if (!drawer.hidden) renderDrawer(); });
    lab.on('observable', () => refreshLive());

    load();
    syncMode();
    renderPanel();
    setInterval(refreshLive, 250);
    onboarding();

    return { toast, openDrawer, closeDrawer, openProtocol, refreshLive, toggleHelp };
  }

  RL.ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
