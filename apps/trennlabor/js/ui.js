/*
 * Trennlabor – Bedienoberfläche
 * Startansicht, Bedienfeld (Aufgabe, Hilfe, Versuch, Auswertung, Hefteintrag),
 * Eingabe auf der Bühne (Tippen und optional Ziehen), Zeitsteuerung,
 * Sicherheitsstopp, Dialoge und Sitzungsspeicher.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const { fmt, clamp } = TL.util;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STORE_KEY = 'trennlabor.session.v1';
  const CH = TL.chroma, DI = TL.distill, CL = TL.classic;
  const fmtTime = (s) => { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, '0')} min`; };
  const CHECK = '✓';

  function createUI(session, stage, renderers) {
    const ui = {
      selected: { classic: null, chroma: null, distill: null },
      tab: 'exp', pourMode: 'slow', waterAmt: 25,
      chromaView: 'lab', lineTool: 'pencil', lineY: 1.5, level: 1, eluent: 'water', lane: 0,
      thermoPos: 'correct', hoseIn: 'bottom', sampleSrc: 'A', igniteTarget: 'dish',
      drag: null, measure: null, panelOpen: true, flash: null
    };
    const panel = $('#panel'), tabBody = $('#tabBody'), toasts = $('#toasts'), hud = $('#hud');
    const sigs = {};
    let evalDirty = true;

    // ============================================================ Speicher
    function save() { try { root.sessionStorage.setItem(STORE_KEY, JSON.stringify({ s: session.exportSession(), ui: { tab: ui.tab, pourMode: ui.pourMode } })); } catch (e) { /* nicht verfügbar */ } }
    function load() {
      try {
        if (/[?&](neu|fresh)\b/.test(root.location.search)) { root.sessionStorage.removeItem(STORE_KEY); return; }
        const raw = root.sessionStorage.getItem(STORE_KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        session.importSession(d.s);
        if (d.ui) Object.assign(ui, d.ui);
      } catch (e) { /* ignorieren */ }
    }
    let saveTimer = 0;

    // ============================================================ Rückmeldungen
    let lastToast = '';
    function toast(text, kind) {
      if (!text || (text === lastToast && toasts.lastChild)) return;
      lastToast = text;
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || '');
      el.textContent = text;
      toasts.appendChild(el);
      while (toasts.children.length > 3) toasts.removeChild(toasts.firstChild);
      const life = kind === 'warn' ? 5200 : 3800;
      setTimeout(() => el.classList.add('out'), life);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); if (lastToast === text) lastToast = ''; }, life + 450);
    }
    session.on('message', (m) => toast(m.text, m.kind));
    session.on('offer', () => { sigs.help = null; });
    session.on('success', (e) => { evalDirty = true; toast('Versuchsziel erreicht – jetzt kannst du in „Auswertung“ deine Beobachtungen festhalten.', 'success'); sigs.tabs = null; void e; });
    session.on('complete', () => { evalDirty = true; sigs.tabs = null; });
    session.on('safety', () => showSafety());
    session.on('change', (e) => { if (e && ['task', 'lab', 'reset', 'resetAll', 'import', 'submit', 'help', 'expert'].includes(e.reason)) evalDirty = true; });

    function run(res) {
      if (res && res.ok === false && res.message && !res.safety) { /* Modell meldet selbst */ }
      sigs.exp = null; sigs.tasks = null;
      saveTimer = 0;
      return res;
    }

    // ============================================================ Startansicht
    const ART = {
      classic: '<svg viewBox="0 0 200 120" aria-hidden="true"><path d="M30 30v70a6 6 0 0 0 6 6h40a6 6 0 0 0 6-6V30" fill="rgba(200,225,240,.5)" stroke="#6d8296" stroke-width="2"/><rect x="31" y="70" width="50" height="30" fill="#bcd8ec" opacity=".8"/><rect x="31" y="92" width="50" height="12" fill="#d9b77c"/><path d="M110 20h70l-30 40v30" fill="#f7f4ec" stroke="#6d8296" stroke-width="2"/><path d="M150 90v20" stroke="#6d8296" stroke-width="3"/><circle cx="150" cy="104" r="2.5" fill="#7fb2dd"/></svg>',
      chroma: '<svg viewBox="0 0 200 120" aria-hidden="true"><rect x="60" y="8" width="80" height="106" rx="3" fill="#fbfbf8" stroke="#a9b2bb"/><path d="M60 95h80" stroke="#888" stroke-dasharray="3 3"/><ellipse cx="80" cy="70" rx="7" ry="5" fill="#68288f" opacity=".8"/><ellipse cx="80" cy="44" rx="7" ry="6" fill="#1c60d6" opacity=".8"/><ellipse cx="80" cy="26" rx="7" ry="6" fill="#f2c416" opacity=".9"/><ellipse cx="120" cy="44" rx="7" ry="6" fill="#1c60d6" opacity=".8"/><ellipse cx="120" cy="62" rx="7" ry="5" fill="#de245e" opacity=".8"/><rect x="60" y="100" width="80" height="14" fill="#cfe2f0" opacity=".8"/></svg>',
      distill: '<svg viewBox="0 0 200 120" aria-hidden="true"><circle cx="45" cy="80" r="24" fill="rgba(200,225,240,.6)" stroke="#6d8296" stroke-width="2"/><path d="M38 58V30h14v28" fill="none" stroke="#6d8296" stroke-width="2"/><path d="M52 40l100 40" stroke="#6d8296" stroke-width="10" stroke-linecap="round" opacity=".35"/><path d="M52 40l100 40" stroke="#6d8296" stroke-width="3"/><path d="M45 12v34" stroke="#c0392b" stroke-width="2.5"/><path d="M150 88h18l-4 24h-10z" fill="rgba(200,225,240,.6)" stroke="#6d8296" stroke-width="2"/><path d="M25 104h40l-6 10H31z" fill="#e07b2c" opacity=".8"/></svg>'
    };
    function renderHome() {
      const prog = session.progress();
      $('#home').innerHTML = `<div class="home-inner">
        <h1>Virtuelles Trennlabor</h1>
        <p class="lead">Wähle ein Labor. Jede Aufgabe stellt dir ein Problem – wie du es löst, entscheidest du selbst: Geräte, Reihenfolge und Mengen haben Folgen. Erst nach einem gelungenen Versuch und deiner Auswertung gibt es die Erklärung und einen Muster-Hefteintrag zum Abschreiben.</p>
        <div class="labcards">${session.LABS.map((l) => {
          const p = prog.find((x) => x.lab === l.id);
          return `<button type="button" class="labcard" data-act="lab" data-lab="${l.id}" aria-label="${esc(l.name)} öffnen">
            <div class="art">${ART[l.id]}</div>
            <h2><b>${l.letter}</b>${esc(l.name)}</h2>
            <p>${esc(l.desc)}</p>
            <ul>${p.tasks.map((t) => `<li><span class="st ${t.done ? 'done' : t.success ? 'success' : ''}">${t.done ? CHECK : ''}</span>${esc(t.id)} ${esc(t.short)}${t.done ? ' <span class="pill ok">erledigt</span>' : ''}</li>`).join('')}</ul>
            <span class="btn primary go">Labor öffnen</span>
          </button>`;
        }).join('')}</div>
        <p class="note">Hinweise: Alle Vorgänge laufen im Zeitraffer ab (Pause, 1×, 4×, 10× oben rechts). Alles lässt sich durch Antippen bedienen; Bechergläser und Stifte kann man zusätzlich ziehen. Die Anwendung arbeitet vollständig offline und speichert nur innerhalb dieser Browsersitzung. Mengen und Zeiten sind Modellwerte – siehe Bedienhinweise.</p>
      </div>`;
    }

    // ============================================================ Navigation
    function showLab(lab) {
      session.openLab(lab);
      document.body.classList.toggle('home', !lab);
      $$('#labTabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.lab === lab ? 'page' : 'false'));
      if (!lab) renderHome();
      Object.keys(sigs).forEach((k) => { sigs[k] = null; });
      evalDirty = true;
      requestAnimationFrame(() => stage.resize());
      save();
    }

    // ============================================================ Panel: Aufgaben, Hilfe
    function renderTaskBar() {
      const lab = session.state.lab;
      const cur = session.currentTaskId();
      const sig = [lab, cur, session.state.expert, ...session.tasksOf(lab).map((t) => { const m = session.meta(t.id); return t.id + !!m.completedAt + !!m.snapshot; })].join('|');
      if (sig === sigs.tasks) return;
      sigs.tasks = sig;
      $('#taskBar').innerHTML = session.tasksOf(lab).map((t) => {
        const m = session.meta(t.id);
        const st = m.completedAt ? 'done' : m.snapshot ? 'success' : '';
        return `<button type="button" class="taskchip" data-act="task" data-task="${t.id}" aria-current="${t.id === cur}" title="${esc(t.title)}"><span class="st ${st}">${m.completedAt ? CHECK : ''}</span>${t.id}<span class="sr-only"> ${esc(t.short)}</span></button>`;
      }).join('');
      const t = session.task();
      $('#taskCard').innerHTML = `<div class="card task-card"><h3>${esc(t.id)} <small>${esc(session.LABS.find((l) => l.id === lab).name)}</small></h3>
        <p class="task-title">${esc(t.title)}</p>
        <p>${esc(t.problem)}</p>
        <details><summary>Ziel und Material</summary><div class="goal"><b>Ziel:</b> ${esc(t.goal)}</div><ul>${t.materials.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></details></div>`;
    }

    function renderHelp() {
      const h = session.help();
      const sig = [session.currentTaskId(), h.level, h.text, h.offer].join('|');
      if (sig === sigs.help) return;
      sigs.help = sig;
      $('#helpCard').innerHTML = `<div class="card help-card" id="helpBox"><h3>Hilfe <small>drei Stufen</small></h3>
        <div class="seg full" role="radiogroup" aria-label="Hilfestufe">${session.HELP_LEVELS.map((n, i) => `<button type="button" role="radio" data-act="help" data-level="${i}" aria-pressed="${h.level === i}" aria-checked="${h.level === i}">${n}</button>`).join('')}</div>
        ${h.level > 0 && h.text ? `<div class="help-text" id="helpText">${esc(h.text)}</div>` : ''}
        ${h.offer ? `<div class="offer" id="helpOffer"><span>Das hat noch nicht geklappt. Möchtest du ${h.offerLevel === 1 ? 'eine kleine Hilfe' : 'eine konkrete Hilfe'}?</span><span class="row"><button type="button" class="btn small primary" data-act="help" data-level="${h.offerLevel}">Ja</button><button type="button" class="btn small" data-act="offerNo">Nein</button></span></div>` : ''}
      </div>`;
    }

    function renderTabs() {
      const m = session.meta();
      const sig = [ui.tab, !!m.snapshot, !!m.completedAt].join('|');
      if (sig === sigs.tabs) return;
      sigs.tabs = sig;
      $$('#pTabs button').forEach((b) => {
        const t = b.dataset.tab;
        b.setAttribute('aria-selected', String(ui.tab === t));
        const label = { exp: 'Versuch', eval: 'Auswertung', note: 'Hefteintrag' }[t];
        b.innerHTML = label + (t === 'eval' && m.snapshot && !m.completedAt ? ' <span class="dot" aria-label="bereit"></span>' : '') + (t === 'note' && !m.completedAt ? ' <span class="lock" aria-label="gesperrt">🔒</span>' : t === 'note' ? ' <span class="dot"></span>' : '');
      });
    }

    // ============================================================ Versuch: klassisch
    const NAME = (lab, id) => lab.nameOf(id);
    function contentsText(d) {
      if (!d) return '';
      const p = [];
      if (d.water > 0.05) p.push(`${fmt(d.water, d.water < 10 ? 1 : 0)} mL Wasser${d.liquid > 1 ? ` (${d.turbidityClass})` : ''}`);
      if (d.oil > 0.05) p.push(`${fmt(d.oil, d.oil < 10 ? 1 : 0)} mL Öl${d.disp > 1 ? ', fein verteilt' : ''}`);
      if (d.salt > 0.01) p.push(`${fmt(d.salt)} g Kochsalz gelöst`);
      if (d.saltSolid > 0.01) p.push(`${fmt(d.saltSolid)} g Kochsalz fest`);
      if (d.sand > 0.01) p.push(`${fmt(d.sand)} g Sand`);
      if (d.iron > 0.01) p.push(`${fmt(d.iron)} g Eisen`);
      if (d.petals > 0.01) p.push(`${fmt(d.petals)} g Blütenreste`);
      if (d.frag > 0.01) p.push(`${fmt(d.frag, 2)} g feine Pflanzenteilchen`);
      if (d.dyeConc > 0.05) p.push(`rot gefärbt (${fmt(d.dyeConc)} mg Farbstoffe/mL)`);
      if (Math.abs(d.T - 20) > 3) p.push(`${Math.round(d.T)} °C`);
      return p.length ? p.join(' · ') : 'leer';
    }

    function amtSeg(title) {
      return `<span class="lbl">${title || 'Wassermenge'}</span><div class="seg" role="radiogroup" aria-label="Wassermenge">${[10, 25, 50, 100].map((a) => `<button type="button" data-act="wamt" data-amt="${a}" aria-pressed="${ui.waterAmt === a}">${a} mL</button>`).join('')}</div>`;
    }

    function classicTargets(lab, from) {
      const st = lab.state;
      const t = [];
      for (const v of Object.values(st.vessels)) if (v.id !== from) t.push([v.id, NAME(lab, v.id)]);
      if (st.F) t.push(['F', 'Trichter']);
      if (st.D) t.push(['D', 'Abdampfschale']);
      if (st.S) t.push(['S', 'Scheidetrichter']);
      t.push(['waste', 'Ausguss']);
      return t.filter((x) => x[0] !== from);
    }

    function renderClassic(lab) {
      const st = lab.state;
      let sel = ui.selected.classic;
      const busy = lab.busy();
      const op = st.op;
      const devices = [...Object.keys(st.vessels).map((id) => [id, NAME(lab, id)])];
      if (st.F) devices.push(['F', 'Trichter']);
      if (st.D) devices.push(['D', 'Abdampfschale']);
      if (st.S) devices.push(['S', 'Scheidetrichter']);
      if (st.R) devices.push(['R', 'Uhrglas (Rückstand)']);
      if (st.E) devices.push(['E', 'Uhrglas (Eisen)']);
      devices.push(['waste', 'Ausguss']);
      let html = '';
      if (op) {
        const what = { pour: `Gießen: ${NAME(lab, op.from)} → ${NAME(lab, op.to)}${op.waiting ? ' (wartet, bis der Trichter Platz hat)' : ''}`, water: 'Wasser wird zugegeben …', stir: 'Es wird umgerührt …', magnet: 'Der Magnet wird durch das Gemisch geführt …', move: 'Becherglas wird umgestellt …', insert: 'Einsatz wird eingelegt …', removeInsert: 'Einsatz wird herausgenommen …', hibiscus: 'Blüten werden zugegeben …', shake: 'Scheidetrichter wird geschüttelt …' }[op.type] || '';
        html += `<div class="card"><div class="busy" style="margin:0"><span>${esc(what)}</span>${op.type === 'pour' ? '<button type="button" class="btn small" data-act="stop">Gießen stoppen</button>' : ''}</div></div>`;
      }
      html += `<div class="card" id="devCard"><h3>Geräte <small>antippen oder auf der Bühne wählen</small></h3><div class="devlist">${devices.map(([id, n]) => `<button type="button" class="btn" data-act="sel" data-id="${id}" aria-pressed="${sel === id}">${esc(n)}</button>`).join('')}</div></div>`;
      if (sel && !lab.container(sel) && !['water', 'kettle', 'hib', 'magnet', 'burner', 'waste'].includes(sel)) sel = ui.selected.classic = null;
      if (sel === 'burner') sel = 'D';
      if (['water', 'kettle', 'hib', 'magnet'].includes(sel)) {
        const tool = sel;
        const targets = tool === 'hib' ? Object.keys(st.vessels) : tool === 'magnet' ? [...Object.keys(st.vessels), ...(st.F ? ['F'] : []), ...(st.R ? ['R'] : []), ...(st.D ? ['D'] : [])] : [...Object.keys(st.vessels), ...(st.F ? ['F'] : []), ...(st.D ? ['D'] : []), ...(st.S ? ['S'] : [])];
        const title = { water: 'Spritzflasche (kaltes Wasser, 20 °C)', kettle: 'Wasserkocher (heißes Wasser, ca. 90 °C)', hib: `Hibiskusblüten (noch ${fmt(st.hibiscusStock, 0)} g)`, magnet: 'Magnet (in Folie)' }[tool];
        html += `<div class="card" id="selCard"><div class="sel-head"><b>${esc(title)}</b></div>`;
        if (tool === 'water' || tool === 'kettle') html += amtSeg();
        html += `<span class="lbl">${tool === 'magnet' ? 'Magnet einsetzen in …' : tool === 'hib' ? '2 g Blüten geben in …' : 'Wasser geben in …'}</span><div class="targets">${targets.map((id) => `<button type="button" class="btn" data-act="tool" data-tool="${tool}" data-to="${id}" ${busy ? 'disabled' : ''}>${esc(NAME(lab, id))}</button>`).join('')}</div>`;
        html += '<p class="muted" style="margin-top:6px">Tipp: Werkzeug gewählt lassen und dann auf der Bühne ein Gefäß antippen.</p></div>';
      } else if (sel) {
        const d = lab.describe(sel);
        html += `<div class="card" id="selCard"><div class="sel-head"><b>${esc(NAME(lab, sel))}</b>${st.vessels[sel] ? `<span class="muted">${esc(CL.PLACE_NAMES[st.vessels[sel].place] || '')}</span>` : ''}</div>
          <div class="contents" data-live="contents" data-id="${sel}">${esc(contentsText(d))}</div>`;
        const canPour = st.vessels[sel] || sel === 'S' || sel === 'D';
        if (canPour) {
          html += `<span class="lbl">${sel === 'S' ? 'Oben ausgießen' : 'Ausgießen'}</span>
            <div class="seg full" role="radiogroup" aria-label="Art des Gießens">${[['slow', 'Vorsichtig abgießen'], ['fast', 'Zügig ausgießen'], ['all', 'Vollständig umfüllen']].map(([m, n]) => `<button type="button" data-act="pmode" data-mode="${m}" aria-pressed="${ui.pourMode === m}">${n}</button>`).join('')}</div>
            <div class="targets" style="margin-top:6px">${classicTargets(lab, sel).map(([id, n]) => `<button type="button" class="btn" data-act="pour" data-from="${sel}" data-to="${id}" ${busy ? 'disabled' : ''}>→ ${esc(n)}</button>`).join('')}</div>`;
        }
        if (st.vessels[sel]) {
          if (st.equip.water || st.equip.kettle) html += amtSeg();
          html += '<span class="lbl">Weitere Handlungen</span><div class="grid2">';
          if (st.equip.rod) html += `<button type="button" class="btn" data-act="stir" data-id="${sel}" ${busy ? 'disabled' : ''}>Umrühren</button>`;
          if (st.equip.water) html += `<button type="button" class="btn" data-act="tool" data-tool="water" data-to="${sel}" ${busy ? 'disabled' : ''}>${ui.waterAmt} mL Wasser (kalt)</button>`;
          if (st.equip.kettle) html += `<button type="button" class="btn" data-act="tool" data-tool="kettle" data-to="${sel}" ${busy ? 'disabled' : ''}>${ui.waterAmt} mL Wasser (heiß)</button>`;
          if (st.equip.hibiscus) html += `<button type="button" class="btn" data-act="tool" data-tool="hib" data-to="${sel}" ${busy ? 'disabled' : ''}>Hibiskusblüten (2 g)</button>`;
          if (st.equip.magnet) html += `<button type="button" class="btn" data-act="tool" data-tool="magnet" data-to="${sel}" ${busy ? 'disabled' : ''}>Magnet einsetzen</button>`;
          html += '</div><span class="lbl">Stellen</span><div class="grid2">';
          const place = st.vessels[sel].place;
          if (st.F && place !== 'filter') html += `<button type="button" class="btn" data-act="move" data-id="${sel}" data-to="filter" ${busy || lab.vesselAt('filter') ? 'disabled' : ''}>Unter den Trichter</button>`;
          if (st.S && place !== 'sep') html += `<button type="button" class="btn" data-act="move" data-id="${sel}" data-to="sep" ${busy || lab.vesselAt('sep') ? 'disabled' : ''}>Unter den Scheidetrichter</button>`;
          if (place === 'filter' || place === 'sep') html += `<button type="button" class="btn" data-act="move" data-id="${sel}" data-to="bench" ${busy ? 'disabled' : ''}>Zurück auf den Tisch</button>`;
          html += '</div>';
        }
        if (sel === 'F') {
          const ins = st.insert;
          html += `<span class="lbl">Einsatz</span><div class="grid2">
            <button type="button" class="btn" data-act="insert" data-kind="paper" ${busy || ins ? 'disabled' : ''}>Filterpapier (gefaltet) einlegen</button>
            <button type="button" class="btn" data-act="insert" data-kind="paperFlat" ${busy || ins ? 'disabled' : ''}>Filterpapier ungefaltet hineindrücken</button>
            ${st.equip.sieve ? `<button type="button" class="btn" data-act="insert" data-kind="sieve" ${busy || ins ? 'disabled' : ''}>Teesieb einsetzen</button>` : ''}
            <button type="button" class="btn" data-act="removeInsert" ${busy || !ins ? 'disabled' : ''}>Einsatz mit Rückstand herausnehmen</button></div>
            ${amtSeg('Ausspülen mit Wasser')}<div class="grid2" style="margin-top:6px"><button type="button" class="btn" data-act="tool" data-tool="water" data-to="F" ${busy ? 'disabled' : ''}>${ui.waterAmt} mL Wasser darauf</button>${st.equip.magnet ? `<button type="button" class="btn" data-act="tool" data-tool="magnet" data-to="F" ${busy ? 'disabled' : ''}>Magnet in den Rückstand</button>` : ''}</div>
            <p class="muted" style="margin-top:6px">Darunter: ${lab.vesselAt('filter') ? esc(NAME(lab, lab.vesselAt('filter').id)) : '<b style="color:var(--bad)">kein Gefäß</b>'}</p>`;
        }
        if (sel === 'D') {
          html += `<span class="lbl">Brenner</span><div class="seg full" role="radiogroup" aria-label="Brenner">${[[0, 'Aus'], [1, 'Kleine Flamme'], [2, 'Große Flamme']].map(([l, n]) => `<button type="button" data-act="burner" data-level="${l}" aria-pressed="${st.burner === l}">${n}</button>`).join('')}</div>
            <p class="muted" style="margin-top:6px" data-live="dishT">Temperatur in der Schale: ${Math.round(st.D.T)} °C</p>
            ${amtSeg()}<div class="grid2" style="margin-top:6px"><button type="button" class="btn" data-act="tool" data-tool="water" data-to="D" ${busy ? 'disabled' : ''}>${ui.waterAmt} mL Wasser zugeben</button><button type="button" class="btn" data-act="stir" data-id="D" ${busy ? 'disabled' : ''}>Umrühren</button></div>`;
        }
        if (sel === 'S') {
          html += `<span class="lbl">Hahn</span><div class="seg full" role="radiogroup" aria-label="Hahn">${[['closed', 'Zu', 0], ['drop', 'Tropfenweise', 0.15], ['open', 'Offen', 1]].map(([v, n, x]) => `<button type="button" data-act="tap" data-v="${v}" aria-pressed="${st.tap === x}">${n}</button>`).join('')}</div>
            <span class="lbl">Stopfen und Schütteln</span><div class="grid2"><button type="button" class="btn" data-act="stopper" data-v="${st.stopper ? 0 : 1}">${st.stopper ? 'Stopfen abnehmen' : 'Stopfen aufsetzen'}</button><button type="button" class="btn" data-act="shake" ${busy ? 'disabled' : ''}>Schütteln</button></div>
            <p class="muted" style="margin-top:6px">Darunter: ${lab.vesselAt('sep') ? esc(NAME(lab, lab.vesselAt('sep').id)) : '<b style="color:var(--bad)">kein Gefäß</b>'}</p>`;
        }
        if (sel === 'R' && st.equip.magnet) html += `<div class="grid2"><button type="button" class="btn" data-act="tool" data-tool="magnet" data-to="R" ${busy ? 'disabled' : ''}>Magnet einsetzen</button></div>`;
        if (sel === 'waste') html += '<p class="muted">Was hier hineingegossen wird, ist verloren.</p>';
        html += '</div>';
      } else {
        html += '<div class="card" id="selCard"><p class="muted">Tippe auf der Bühne oder oben auf ein Gerät, um zu sehen, was du damit tun kannst. Bechergläser kannst du auch auf ein Ziel ziehen (Ausgießen) oder unter Trichter bzw. Scheidetrichter ziehen.</p></div>';
      }
      html += balanceCard(lab);
      return html;
    }

    function balanceCard(lab) {
      const b = lab.balance();
      const names = { water: ['Wasser', 'mL'], oil: ['Öl', 'mL'], salt: ['Kochsalz', 'g'], sand: ['Sand', 'g'], iron: ['Eisen', 'g'], plant: ['Blütenreste', 'g'], dye: ['Farbstoffe', 'mg'] };
      const rows = Object.keys(names).filter((k) => b.start[k] > 0.001 || b.now[k] > 0.001).map((k) => {
        const where = b.where[k].sort((x, y) => y.amount - x.amount).map((w) => `<span class="${w.lost ? 'lost' : ''}">${esc(w.name)} ${fmt(w.amount, k === 'dye' ? 0 : 1)}</span>`).join(', ');
        return `<tr><th>${names[k][0]}</th><td class="n">${fmt(b.start[k], k === 'dye' ? 0 : 1)} ${names[k][1]}</td><td>${where || '–'}</td></tr>`;
      }).join('');
      return `<div class="card"><details id="balance"><summary><b>Mengenbilanz</b> <span class="muted">Ausgangsmenge und Verbleib</span></summary><table class="bal" data-live="balance"><thead><tr><th>Stoff</th><th>gesamt</th><th>wo jetzt</th></tr></thead><tbody>${rows}</tbody></table><p class="muted" style="margin-top:6px">Rot: verloren (Ausguss, Tisch, verdampft, verspritzt). Nichts entsteht aus dem Nichts.</p></details></div>`;
    }

    // ============================================================ Versuch: Chromatographie
    function renderChroma(lab) {
      const st = lab.state, p = st.paper, ch = st.chamber;
      const fresh = p && p.state === 'fresh';
      const dev = p && p.state === 'developing';
      let html = `<div class="card" id="cPaper"><h3>1 · Papier ${p ? `<small>Nr. ${p.no}: ${p.state === 'fresh' ? 'vorbereiten' : p.state === 'developing' ? 'in der Kammer' : p.state === 'drying' ? 'feucht' : 'trocken'}</small>` : ''}</h3>
        <div class="grid2"><button type="button" class="btn" data-act="cpaper" data-type="sheet" ${dev ? 'disabled' : ''}>Neues breites Papier (3 Bahnen)</button><button type="button" class="btn" data-act="cpaper" data-type="strip" ${dev ? 'disabled' : ''}>Neuer schmaler Streifen</button></div></div>`;
      html += `<div class="card" id="cLine"><h3>2 · Startlinie ${p && p.line ? `<small>${p.line.tool === 'pencil' ? 'Bleistift' : 'Kugelschreiber'}, ${fmt(p.line.y)} cm</small>` : ''}</h3>
        <div class="row"><div class="seg" role="radiogroup" aria-label="Stift für die Startlinie">${[['pencil', 'Bleistift'], ['ballpoint', 'Kugelschreiber']].map(([t, n]) => `<button type="button" data-act="ltool" data-tool="${t}" aria-pressed="${ui.lineTool === t}">${n}</button>`).join('')}</div>
        <span class="stepper"><button type="button" class="btn small" data-act="lineY" data-d="-0.5" aria-label="Startlinie tiefer">−</button><output>${fmt(ui.lineY)} cm</output><button type="button" class="btn small" data-act="lineY" data-d="0.5" aria-label="Startlinie höher">+</button></span></div>
        <button type="button" class="btn wide" style="margin-top:6px" data-act="cline" ${!fresh || (p && (p.line || p.spots.length)) ? 'disabled' : ''}>Startlinie zeichnen</button></div>`;
      const lanes = p ? p.lanes : 3;
      const spotOn = (l) => p && p.spots.find((s) => s.lane === l);
      html += `<div class="card" id="cSpot"><h3>3 · Proben auftragen</h3><div class="pens" role="radiogroup" aria-label="Probe">${CH.PENS.map((pen) => `<button type="button" class="pen" data-act="pen" data-pen="${pen.id}" aria-pressed="${st.selectedPen === pen.id}"><i style="background:rgb(${pen.color.join(',')})"></i>${esc(pen.name)}</button>`).join('')}</div>
        <span class="lbl">Bahn</span><div class="seg" role="radiogroup" aria-label="Bahn">${Array.from({ length: lanes }, (_, l) => { const s = spotOn(l); return `<button type="button" data-act="lane" data-lane="${l}" aria-pressed="${ui.lane === l}">Bahn ${l + 1}${s ? ` (${esc(CH.PEN_BY_ID[s.pen].name.split(' ')[0])} ×${s.load})` : ''}</button>`; }).join('')}</div>
        <button type="button" class="btn wide primary" style="margin-top:6px" data-act="spot" ${!fresh ? 'disabled' : ''}>Einmal auftupfen</button></div>`;
      html += `<div class="card" id="cChamber"><h3>4 · Entwicklungskammer <small data-live="chamber">${ch.eluent ? `${esc(CH.ELUENTS[ch.eluent].short)}, ${fmt(ch.level)} cm` : 'leer'}${ch.lid ? ', Deckel auf' : ''}</small></h3>
        <div class="seg full" role="radiogroup" aria-label="Laufmittel">${Object.values(CH.ELUENTS).map((e) => `<button type="button" data-act="eluent" data-el="${e.id}" aria-pressed="${ui.eluent === e.id}">${esc(e.short)}</button>`).join('')}</div>
        <div class="row" style="margin-top:6px"><span class="muted">Füllhöhe</span><span class="stepper"><button type="button" class="btn small" data-act="level" data-d="-0.5" aria-label="weniger">−</button><output>${fmt(ui.level)} cm</output><button type="button" class="btn small" data-act="level" data-d="0.5" aria-label="mehr">+</button></span></div>
        <div class="grid2" style="margin-top:6px"><button type="button" class="btn" data-act="fill" ${dev ? 'disabled' : ''}>Laufmittel einfüllen</button><button type="button" class="btn" data-act="emptyCh" ${dev || !ch.eluent ? 'disabled' : ''}>Kammer leeren</button>
        <button type="button" class="btn" data-act="lid" aria-pressed="${ch.lid}">${ch.lid ? 'Deckel abnehmen' : 'Deckel auflegen'}</button></div></div>`;
      html += `<div class="card" id="cDev"><h3>5 · Entwickeln <small data-live="front">${p && p.state !== 'fresh' ? `Front ${fmt(p.front)} cm` : ''}</small></h3>
        <div class="grid2"><button type="button" class="btn primary" data-act="insertP" ${!fresh ? 'disabled' : ''}>Papier in die Kammer stellen</button><button type="button" class="btn" data-act="removeP" ${!dev ? 'disabled' : ''}>Papier herausnehmen</button>
        <button type="button" class="btn" data-act="markF" ${!p || p.state !== 'drying' || p.frontMark ? 'disabled' : ''}>Laufmittelfront markieren</button></div>
        ${p && p.state === 'drying' && !p.frontMark ? '<p class="muted" style="margin-top:6px">Die Front ist nur sichtbar, solange das Papier feucht ist.</p>' : ''}</div>`;
      const papers = TL.tasks.chroma.papers(lab);
      html += `<div class="card" id="cArch"><h3>Chromatogramme <small>${papers.length}</small></h3>
        <div class="seg full" role="radiogroup" aria-label="Ansicht"><button type="button" data-act="cview" data-v="lab" aria-pressed="${ui.chromaView === 'lab'}">Laboransicht</button><button type="button" data-act="cview" data-v="compare" aria-pressed="${ui.chromaView === 'compare'}">Chromatogramme vergleichen</button></div>
        <div class="archive" style="margin-top:6px">${papers.map((x) => `<div class="it"><span>Nr. ${x.p.no} · ${esc(CH.ELUENTS[x.p.eluent].short)} · ${x.r.lanes.map((l) => esc(CH.PEN_BY_ID[l.pen].name)).join(', ') || 'ohne Probe'}</span><span class="pill ${x.r.clean ? 'ok' : x.r.usable ? 'warn' : 'bad'}">${x.r.clean ? 'sauber' : x.r.usable ? 'gestört' : 'unbrauchbar'}</span></div>`).join('') || '<span class="muted">Noch keine entwickelten Chromatogramme.</span>'}</div>
        <label class="switch" style="margin-top:8px"><input type="checkbox" data-act="expert" ${session.state.expert ? 'checked' : ''}> Expertenmodus (Laufstrecken, Rf-Werte)</label></div>`;
      return html;
    }

    // ============================================================ Versuch: Destillation
    function chartSvg(lab) {
      const log = lab.state.tempLog;
      const W = 320, H = 170, L = 34, B = 22, T = 8, Rr = 8;
      const tmax = Math.max(300, log.length ? log[log.length - 1].t : 0);
      const x = (t) => L + (t / tmax) * (W - L - Rr);
      const y = (v) => T + (1 - (clamp(v, 15, 110) - 15) / 95) * (H - T - B);
      let grid = '';
      for (const v of [20, 40, 60, 78, 100]) grid += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 78 || v === 100 ? '#c9d3dc' : '#eef2f5'}" stroke-dasharray="${v === 78 || v === 100 ? '4 3' : ''}"/><text x="${L - 4}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="#6b7987">${v}</text>`;
      const step = tmax > 1200 ? 300 : 120;
      for (let t = 0; t <= tmax; t += step) grid += `<text x="${x(t)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#6b7987">${Math.round(t / 60)}</text>`;
      const path = (k) => { let d = ''; for (const p of log) { if (p[k] == null) { d += ' '; continue; } d += (d.endsWith(' ') || !d ? 'M' : 'L') + x(p.t).toFixed(1) + ' ' + y(p[k]).toFixed(1); } return d.replace(/\s+/g, ' ').trim(); };
      return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperaturverlauf"><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>${grid}
        <text x="${W - Rr}" y="${H - 6}" font-size="10" text-anchor="end" fill="#6b7987">min</text><text x="4" y="12" font-size="10" fill="#6b7987">°C</text>
        <path d="${path('flask')}" fill="none" stroke="#e0703c" stroke-width="1.8" stroke-dasharray="5 3"/>
        <path d="${path('read')}" fill="none" stroke="#1f6fe5" stroke-width="2.4"/></svg>
        <div class="row" style="font-size:12px;gap:12px"><span><b style="color:#1f6fe5">——</b> Thermometer (Dampf am Abgang)</span><span><b style="color:#e0703c">- - -</b> Kolbeninhalt (Modellwert)</span></div>`;
    }

    function renderDistill(lab) {
      const st = lab.state, p = st.parts;
      const hot = st.flask.T > 40;
      const row = (on, name, controls, extra) => `<div class="part"><span class="ck ${on === 'bad' ? 'badpos' : on ? 'on' : ''}">${on ? CHECK : ''}</span><span>${name}${extra ? `<br><small class="muted">${extra}</small>` : ''}</span><span class="row">${controls}</span></div>`;
      const b = (act, label, attrs, dis) => `<button type="button" class="btn small" data-act="${act}" ${attrs || ''} ${dis ? 'disabled' : ''}>${label}</button>`;
      const POS = { correct: 'am seitlichen Abgang', high: 'zu hoch', deep: 'in der Flüssigkeit' };
      let html = `<div class="card" id="dBuild"><h3>Aufbau <small>${hot ? 'Apparatur heiß' : 'kalt'}</small></h3><div class="parts">
        ${row(p.mantle, 'Heizpilz', p.mantle ? b('dremove', 'Entfernen', 'data-part="mantle"', st.heater > 0) : b('dplace', 'Aufstellen', 'data-part="mantle"'))}
        ${row(p.flask, 'Rundkolben (250 mL)', p.flask ? b('dremove', 'Ausspannen', 'data-part="flask"') : b('dplace', 'Einspannen', 'data-part="flask"'))}
        ${row(lab.flaskVol() > 0.5, `Ethanol-Wasser-Gemisch <span data-live="fvol">${fmt(lab.flaskVol(), 0)} mL</span>`, b('dfill', '+ 25 mL einfüllen', '', !p.flask || p.head))}
        ${row(st.stones, 'Siedesteine', b('dstones', 'Zugeben', '', st.stones))}
        ${row(p.head, 'Destillationsaufsatz', p.head ? b('dremove', 'Abnehmen', 'data-part="head"') : b('dplace', 'Aufsetzen', 'data-part="head"'))}
        ${row(p.thermo ? (p.thermo === 'correct' ? true : 'bad') : false, 'Thermometer', p.thermo ? b('dremove', 'Herausnehmen', 'data-part="thermo"') : b('dplace', 'Einsetzen', `data-part="thermo" data-opt="${ui.thermoPos}"`), p.thermo ? `Kugel ${POS[p.thermo]}` : '')}
        <div class="seg full" role="radiogroup" aria-label="Thermometerposition">${Object.entries(POS).map(([k, n]) => `<button type="button" data-act="tpos" data-v="${k}" aria-pressed="${ui.thermoPos === k}">${n}</button>`).join('')}</div>
        ${row(p.cooler, 'Liebigkühler', p.cooler ? b('dremove', 'Abnehmen', 'data-part="cooler"') : b('dplace', 'Anschließen', 'data-part="cooler"'))}
        ${row(p.hoseIn ? (p.hoseIn === 'bottom' ? true : 'bad') : false, 'Kühlwasserschläuche', p.hoseIn ? b('dremove', 'Lösen', 'data-part="hoses"') : b('dplace', 'Anschließen', `data-part="hoses" data-opt="${ui.hoseIn}"`), p.hoseIn ? (p.hoseIn === 'bottom' ? 'Zulauf unten, Ablauf oben' : 'Zulauf oben, Ablauf unten') : '')}
        <div class="seg full" role="radiogroup" aria-label="Zulauf des Kühlwassers">${[['bottom', 'Zulauf unten'], ['top', 'Zulauf oben']].map(([k, n]) => `<button type="button" data-act="hose" data-v="${k}" aria-pressed="${ui.hoseIn === k}">${n}</button>`).join('')}</div>
        ${row(p.adapter, 'Vorstoß', p.adapter ? b('dremove', 'Abnehmen', 'data-part="adapter"') : b('dplace', 'Ansetzen', 'data-part="adapter"'))}
        ${row(p.clamps, 'Schliffverbindungen mit Klemmen', p.clamps ? b('dremove', 'Lösen', 'data-part="clamps"') : b('dplace', 'Sichern', 'data-part="clamps"'))}
      </div></div>`;
      html += `<div class="card" id="dRun"><h3>Betrieb</h3>
        <span class="lbl">Kühlwasser (Durchfluss)</span><div class="seg full" role="radiogroup" aria-label="Kühlwasser">${DI.COOL_NAMES.map((n, i) => `<button type="button" data-act="cool" data-level="${i}" aria-pressed="${st.cool === i}">${n}</button>`).join('')}</div>
        <span class="lbl">Heizpilz</span><div class="seg full" role="radiogroup" aria-label="Heizstufe">${[0, 1, 2, 3, 4].map((i) => `<button type="button" data-act="heat" data-level="${i}" aria-pressed="${st.heater === i}">${i === 0 ? 'Aus' : 'Stufe ' + i}</button>`).join('')}</div>
        <dl class="kv" style="margin-top:8px"><dt>Thermometer</dt><dd data-live="tread">–</dd><dt>Kolbeninhalt</dt><dd data-live="ftemp">–</dd><dt>Im Kolben</dt><dd data-live="fvol2">–</dd></dl></div>`;
      const rec = (id) => st.receivers[id];
      html += `<div class="card" id="dRec"><h3>Vorlagen</h3><div class="grid3">${['A', 'B', 'C'].map((id, i) => `<button type="button" class="btn small" data-act="recv" data-id="${id}" aria-pressed="${st.receiverAt === id}">Vorlage ${i + 1}<br><span data-live="rv${id}">${fmt(rec(id).E + rec(id).W, 1)} mL</span></button>`).join('')}</div>
        <div class="grid2" style="margin-top:6px"><button type="button" class="btn small" data-act="recv" data-id="" ${!st.receiverAt ? 'disabled' : ''}>Vorlage wegnehmen</button><button type="button" class="btn small" data-act="rstop" ${!st.receiverAt ? 'disabled' : ''}>${st.receiverStopper ? 'Stopfen abnehmen' : 'Vorlage mit Stopfen verschließen'}</button></div>
        <p class="muted" style="margin-top:6px">Unter dem Vorstoß: ${st.receiverAt ? 'Vorlage ' + ('ABC'.indexOf(st.receiverAt) + 1) : '<b style="color:var(--bad)">keine Vorlage</b>'}</p></div>`;
      html += `<div class="card" id="dBurn"><h3>Brennprobe <small>getrennt von der Apparatur</small></h3>
        <span class="lbl">Probe (ca. 2 mL) entnehmen aus</span><div class="seg full" role="radiogroup" aria-label="Probenquelle">${[['A', 'Vorlage 1'], ['B', 'Vorlage 2'], ['C', 'Vorlage 3'], ['flask', 'Kolben']].map(([k, n]) => `<button type="button" data-act="ssrc" data-v="${k}" aria-pressed="${ui.sampleSrc === k}">${n}</button>`).join('')}</div>
        <button type="button" class="btn wide" style="margin-top:6px" data-act="sample">Probe in die Porzellanschale geben</button>
        <span class="lbl">Stabfeuerzeug an …</span><div class="seg full" role="radiogroup" aria-label="Ziel der Zündung">${[['dish', 'Porzellanschale'], ['apparatus', 'Vorstoß der Apparatur']].map(([k, n]) => `<button type="button" data-act="itgt" data-v="${k}" aria-pressed="${ui.igniteTarget === k}">${n}</button>`).join('')}</div>
        <button type="button" class="btn wide primary" style="margin-top:6px" data-act="ignite">Entzünden</button>
        <p class="muted" style="margin-top:6px" data-live="dish">${st.dish ? `In der Schale: ${fmt(st.dish.E + st.dish.W)} mL aus ${esc(st.dish.label)}${st.dish.burned ? ' (geprüft)' : ''}` : 'Porzellanschale leer'}</p></div>`;
      html += `<div class="card" id="dChart"><h3>Temperaturverlauf</h3><div data-live="chart">${chartSvg(lab)}</div></div>`;
      return html;
    }

    function renderExp() {
      const e = session.engine();
      const lab = session.state.lab;
      const sig = expSig(e, lab);
      if (sig === sigs.exp) return;
      sigs.exp = sig;
      const focus = document.activeElement && panel.contains(document.activeElement) ? focusKey(document.activeElement) : null;
      tabBody.innerHTML = lab === 'classic' ? renderClassic(e) : lab === 'chroma' ? renderChroma(e) : renderDistill(e);
      const bal = $('#balance', tabBody);
      if (bal && ui.balanceOpen) bal.open = true;
      if (bal) bal.addEventListener('toggle', () => { ui.balanceOpen = bal.open; });
      if (focus) { const el = $(focus, tabBody); if (el) el.focus(); }
      if (ui.flash) { const el = $('#' + ui.flash, tabBody); if (el) { el.classList.add('flash'); el.scrollIntoView({ block: 'nearest' }); } ui.flash = null; }
      updateLive();
    }
    function focusKey(el) {
      const ds = el.dataset || {};
      if (!ds.act) return null;
      const extra = ['to', 'id', 'mode', 'level', 'v', 'part', 'tool', 'pen', 'lane', 'el', 'kind', 'type', 'd', 'amt', 'from'].filter((k) => ds[k] != null).map((k) => `[data-${k}="${ds[k]}"]`).join('');
      return `[data-act="${ds.act}"]${extra}`;
    }
    function expSig(e, lab) {
      const st = e.state;
      if (lab === 'classic') {
        const r = (c) => (c ? [c.water, c.oil, c.salt, c.dye].map((v) => Math.round(v * 10)).join(',') + CL.PKEYS.map((k) => Math.round((c.p[k].set + c.p[k].sus) * 20)).join(',') : '');
        return [lab, session.currentTaskId(), ui.selected.classic, ui.pourMode, ui.waterAmt, st.op ? st.op.type + st.op.waiting : '', st.insert, st.burner, st.tap, st.stopper, st.hibiscusStock,
          ...Object.values(st.vessels).map((v) => v.place + r(v.c)), r(st.F), r(st.D), r(st.S), r(st.E), r(st.R), Math.round(st.D ? st.D.T / 10 : 0)].join('|');
      }
      if (lab === 'chroma') {
        const p = st.paper;
        return [lab, session.currentTaskId(), st.selectedPen, ui.lane, ui.lineTool, ui.lineY, ui.eluent, ui.level, ui.chromaView, session.state.expert, st.chamber.eluent, st.chamber.level, st.chamber.lid, st.archive.length,
          p ? [p.no, p.state, p.line && p.line.y, p.line && p.line.tool, JSON.stringify(p.spots), !!p.frontMark].join(',') : ''].join('|');
      }
      return [lab, ui.thermoPos, ui.hoseIn, ui.sampleSrc, ui.igniteTarget, JSON.stringify(st.parts), st.stones, Math.round(e.flaskVol()), st.heater, st.cool, st.receiverAt, st.receiverStopper, st.flask.T > 40, !!st.dish, st.dish && st.dish.burned, st.burnTests.length, !!st.safety].join('|');
    }

    /** Laufend aktualisierte Werte ohne Neuaufbau des Panels. */
    function updateLive() {
      const e = session.engine();
      if (!e) return;
      const lab = session.state.lab;
      const set = (k, v) => { const el = $(`[data-live="${k}"]`, panel); if (el && el.textContent !== v) el.textContent = v; };
      if (lab === 'classic') {
        const c = $('[data-live="contents"]', panel);
        if (c) set('contents', contentsText(e.describe(c.dataset.id)));
        if (e.state.D) set('dishT', `Temperatur in der Schale: ${Math.round(e.state.D.T)} °C`);
      } else if (lab === 'distill') {
        const st = e.state;
        const r = e.reading();
        set('tread', r == null ? 'kein Thermometer' : `${fmt(r)} °C${st.parts.thermo !== 'correct' ? ' (Position falsch!)' : ''}`);
        set('ftemp', `${fmt(st.flask.T)} °C`);
        set('fvol', `${fmt(e.flaskVol(), 0)} mL`);
        set('fvol2', `${fmt(e.flaskVol(), 1)} mL`);
        for (const id of ['A', 'B', 'C']) set('rv' + id, `${fmt(st.receivers[id].E + st.receivers[id].W, 1)} mL`);
        const chart = $('[data-live="chart"]', panel);
        if (chart && (chart._n !== st.tempLog.length)) { chart._n = st.tempLog.length; chart.innerHTML = chartSvg(e); }
      } else if (lab === 'chroma') {
        const p = e.state.paper;
        set('front', p && p.state !== 'fresh' ? `Front ${fmt(p.front)} cm${p.front >= CH.PAPER_LEN - 0.05 ? ' (oberer Rand!)' : ''}` : '');
      }
    }

    // ============================================================ Auswertung
    function renderEval() {
      if (!evalDirty && sigs.evalTask === session.currentTaskId() && sigs.evalTab === ui.tab) {
        // nur die Erfolgsliste live halten
        const box = $('#liveCheck', tabBody);
        if (box) { const html = checklist(session.task().check(session.engine())); if (box._h !== html) { box._h = html; box.innerHTML = html; } }
        return;
      }
      evalDirty = false; sigs.evalTask = session.currentTaskId(); sigs.evalTab = ui.tab;
      const ev = session.evaluation();
      const m = session.meta();
      let html = `<div class="card"><h3>Versuchsziel <small>aus dem aktuellen Zustand</small></h3><div id="liveCheck">${checklist(ev.check)}</div></div>`;
      if (!ev.unlocked) {
        html += '<div class="card"><p class="locked">Die Auswertung öffnet sich, sobald dein Versuch das Ziel erreicht hat. Experimentiere zuerst – Beobachtungsfragen und Lückentext beziehen sich auf deine eigenen Ergebnisse.</p></div>';
        tabBody.innerHTML = html;
        return;
      }
      html += `<div class="card"><h3>Beobachtungen <small>Versuchsstand bei ${fmtTime(ev.successAt || 0)}</small></h3>${ev.observations.map((o) => obsHtml(o, ev.completed)).join('')}</div>`;
      // Lückentext
      let gi = 0;
      const gt = esc(ev.gaps.text).replace(/\{(\w+)\}/g, (_, k) => {
        gi++;
        const r = ev.gaps.results[k];
        const cls = r ? r.status : '';
        const val = ev.gaps.drafts[k] || '';
        return `<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Lücke ${gi}" data-gap="${k}" class="${cls}" value="${esc(val)}" ${ev.completed || (r && (r.status === 'correct' || r.status === 'typo')) ? 'readonly' : ''}>`;
      });
      const gfb = Object.entries(ev.gaps.results).filter(([, r]) => r.status === 'wrong' || r.status === 'typo').map(([k, r]) => {
        const n = ev.gaps.keys.indexOf(k) + 1;
        return r.status === 'typo' ? `<li style="color:var(--ok)">Lücke ${n}: richtig – achte auf die Schreibweise „${esc(r.canonical)}“.</li>` : `<li>Lücke ${n}: ${esc(r.hint || 'Noch nicht richtig.')}</li>`;
      }).join('');
      html += `<div class="card"><h3>Erklärung <small>Lücken selbst ausfüllen</small></h3><div class="gaptext">${gt}</div>${gfb ? `<ul class="gapfb">${gfb}</ul>` : ''}${ev.gaps.bank ? `<div class="bank" aria-label="Wortauswahl">${ev.gaps.bank.map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : ''}</div>`;
      if (ev.completed) html += '<div class="result ok" role="status">Alles richtig ausgewertet. Unter „Hefteintrag“ findest du jetzt die Erklärung und den Muster-Hefteintrag.</div>';
      else {
        if (m.submissions && !ev.completed) html += '<div class="result no" role="status">Noch nicht alles richtig. Richtige Antworten bleiben erhalten – überarbeite die markierten Stellen.</div>';
        html += '<button type="button" class="btn primary wide" data-act="submit">Auswertung prüfen</button>';
      }
      tabBody.innerHTML = html;
    }
    function checklist(c) {
      return `<ul class="checklist">${c.items.map((i) => `<li><span class="ck ${i.info ? 'info' : i.ok ? 'on' : ''}">${!i.info && i.ok ? CHECK : ''}</span><span>${esc(i.label)}<small>${esc(i.detail || '')}</small></span></li>`).join('')}</ul>`;
    }
    function obsHtml(o, done) {
      const r = o.result;
      let fb = '';
      if (!o.available) fb = `<div class="fb unavailable">${esc(o.unavailable || 'Dazu gibt es in deinem Versuch keinen Befund.')}</div>`;
      else if (r && r.status === 'correct') fb = '<div class="fb correct">richtig</div>';
      else if (r && r.status === 'wrong') fb = `<div class="fb wrong">${esc(r.hint || 'Noch nicht richtig.')}</div>`;
      else if (r && r.status === 'empty') fb = '<div class="fb wrong">Bitte beantworten.</div>';
      const lock = done || (r && r.status === 'correct') || !o.available;
      let body = '';
      if (o.type === 'choice') {
        body = `<div class="opts" role="radiogroup">${o.options.map(([v, l]) => `<label class="opt ${o.draft === v ? 'sel' : ''}"><input type="radio" name="o_${o.id}" value="${esc(v)}" data-obs="${o.id}" ${o.draft === v ? 'checked' : ''} ${lock ? 'disabled' : ''}>${esc(l)}</label>`).join('')}</div>`;
      } else {
        body = `<div class="numin"><input type="text" inputmode="decimal" data-obs="${o.id}" value="${esc(o.draft || '')}" aria-label="${esc(o.q)}" ${lock ? 'readonly' : ''}><span>${esc(o.unit || '')}</span></div>`;
      }
      return `<div class="q"><div class="qt">${esc(o.q)}</div>${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}${o.available ? body : ''}${fb}</div>`;
    }

    // ============================================================ Hefteintrag
    function renderNote() {
      const th = session.theory();
      const sig = [session.currentTaskId(), th.unlocked, th.step].join('|');
      if (sig === sigs.note) return;
      sigs.note = sig;
      if (!th.unlocked) {
        tabBody.innerHTML = '<div class="card"><p class="locked">Erklärung und Muster-Hefteintrag erscheinen erst, wenn dein Versuch gelungen ist und du ihn richtig ausgewertet hast.</p></div>';
        return;
      }
      const shown = th.steps.slice(0, Math.max(1, th.step));
      let html = `<div class="card theory"><h3>Erklärung <small>Schritt ${Math.min(th.step + 1, th.steps.length)} von ${th.steps.length}</small></h3><ol>${shown.map((s) => `<li>${s}</li>`).join('')}</ol>
        ${th.step < th.steps.length ? `<div class="row" style="margin-top:8px"><button type="button" class="btn primary" data-act="tnext">${th.step + 1 < th.steps.length ? 'Weiter' : 'Zum Hefteintrag'}</button><button type="button" class="btn" data-act="tall">Alles zeigen</button></div>` : ''}</div>`;
      if (th.notebook) {
        html += `<div class="card"><h3>Muster-Hefteintrag <small>zum Abschreiben ins Heft</small></h3><div class="notebook" id="notebook"><h4>${esc(th.notebook.title)}</h4>${th.notebook.sections.map(([h, t]) => `<h5>${esc(h)}</h5><p>${esc(t)}</p>`).join('')}</div></div>`;
      }
      tabBody.innerHTML = html;
    }

    // ============================================================ HUD und Sicherheitsstopp
    function renderHud() {
      const e = session.engine();
      if (!e) { hud.innerHTML = ''; return; }
      const lab = session.state.lab;
      let html = `<div class="box">Versuchszeit <b>${fmtTime(e.state.t)}</b>${session.state.paused ? ' · <b>Pause</b>' : ''}</div>`;
      if (lab === 'distill') {
        const r = e.reading();
        const pos = e.state.parts.thermo;
        html = `<div class="temp" id="tempHud"><small>Dampftemperatur (Thermometer am Aufsatz)</small><div class="v ${r == null ? 'na' : ''}">${r == null ? 'kein Thermometer' : fmt(r) + ' °C'}</div><div class="sub">${pos && pos !== 'correct' ? '⚠ Thermometer sitzt nicht am seitlichen Abgang' : 'Kolbeninhalt: ' + fmt(e.state.flask.T, 0) + ' °C'}</div></div>` + html;
      }
      if (lab === 'chroma' && ui.measure) html += `<div class="box">Lineal: <b>${fmt(ui.measure.cm)} cm</b> ab Startlinie (Chromatogramm Nr. ${ui.measure.no})</div>`;
      hud.classList.toggle('right', lab === 'distill');
      if (hud._h !== html) { hud._h = html; hud.innerHTML = html; }
    }

    function showSafety() {
      const e = session.engine();
      const s = e && e.state.safety;
      const box = $('#safety');
      if (!s) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = `<div class="box"><h2 id="safetyTitle"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 30 28H2z" fill="#f6c142" stroke="#222" stroke-width="2"/><path d="M16 11v9" stroke="#222" stroke-width="3"/><circle cx="16" cy="24" r="1.8" fill="#222"/></svg>${esc(s.title)}</h2>
        <p>${esc(s.text)}</p><p class="fix"><b>So geht es weiter:</b> ${esc(s.fix)}</p>
        <p class="muted">Die Heizung wurde (virtuell) ausgeschaltet. Im echten Labor entstünde hier Gefahr – in der Simulation passiert nichts.</p>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn primary" data-act="ack" id="ackBtn">Verstanden – Aufbau korrigieren</button></div></div>`;
      setTimeout(() => { const b = $('#ackBtn'); if (b) b.focus(); }, 30);
    }

    // ============================================================ Zeitsteuerung
    function renderTime() {
      const s = session.state;
      $$('#timeCtl button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.speed === 'pause' ? s.paused : !s.paused && +b.dataset.speed === s.speed)));
      $('#lapse').textContent = s.lab ? `Zeitraffer ×${session.effective()}` : '';
    }

    // ============================================================ Dialog
    function openModal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; const f = $('#modalBox button'); if (f) f.focus(); }
    function closeModal() { $('#modal').hidden = true; }
    function restartDialog() {
      const t = session.task();
      openModal(`<h2>Neu beginnen</h2><p>Was möchtest du zurücksetzen?</p><div class="stack">
        <button type="button" class="btn primary" data-act="resetExp">Nur diesen Versuch neu aufbauen (${esc(t.lab === 'classic' ? t.id : session.LABS.find((l) => l.id === t.lab).name)})</button>
        <button type="button" class="btn danger" data-act="resetAll">Alles zurücksetzen (alle Aufgaben und Auswertungen)</button>
        <button type="button" class="btn" data-act="closeModal">Abbrechen</button></div>
        <p class="muted" style="margin-top:8px">Abgeschlossene Aufgaben bleiben beim Neuaufbau eines Versuchs erhalten.</p>`);
    }

    // ============================================================ Aktionen
    function act(el) {
      const d = el.dataset;
      const e = session.engine();
      const a = d.act;
      switch (a) {
        case 'lab': showLab(d.lab); return;
        case 'task': session.selectTask(d.task); ui.tab = 'exp'; Object.keys(sigs).forEach((k) => { sigs[k] = null; }); evalDirty = true; break;
        case 'help': session.setHelp(+d.level); sigs.help = null; evalDirty = true; break;
        case 'offerNo': session.dismissOffer(); sigs.help = null; break;
        case 'tab': ui.tab = d.tab; sigs.exp = null; sigs.note = null; evalDirty = true; break;
        case 'submit': collectDrafts(); session.submit(); evalDirty = true; sigs.help = null; sigs.tasks = null; break;
        case 'tnext': session.nextTheory(); break;
        case 'tall': session.showAllTheory(); break;
        case 'resetExp': session.resetExperiment(); closeModal(); ui.selected = { classic: null, chroma: null, distill: null }; ui.measure = null; evalDirty = true; showSafety(); break;
        case 'resetAll': session.resetAll(); closeModal(); try { root.sessionStorage.removeItem(STORE_KEY); } catch (x) { /* */ } showLab(null); return;
        case 'closeModal': closeModal(); return;
        case 'ack': e.ackSafety(); showSafety(); break;
        // klassisch
        case 'sel': ui.selected.classic = ui.selected.classic === d.id && d.toggle ? null : d.id; break;
        case 'pmode': ui.pourMode = d.mode; break;
        case 'wamt': ui.waterAmt = +d.amt; break;
        case 'pour': run(e.pour(d.from, d.to, ui.pourMode)); break;
        case 'stop': run(e.stopOp()); break;
        case 'stir': run(e.stir(d.id)); break;
        case 'tool': run(applyTool(e, d.tool, d.to)); break;
        case 'move': run(e.moveVessel(d.id, d.to)); break;
        case 'insert': run(e.insertFilter(d.kind)); break;
        case 'removeInsert': run(e.removeFilter()); break;
        case 'burner': run(e.setBurner(+d.level)); break;
        case 'tap': run(e.setTap(d.v)); break;
        case 'stopper': run(e.setStopper(d.v === '1')); break;
        case 'shake': run(e.shakeSep()); break;
        // Chromatographie
        case 'cpaper': run(e.newPaper(d.type)); ui.lane = 0; ui.chromaView = 'lab'; break;
        case 'ltool': ui.lineTool = d.tool; break;
        case 'lineY': ui.lineY = clamp(ui.lineY + +d.d, 0.5, 4); break;
        case 'cline': run(e.drawLine(ui.lineTool, ui.lineY)); break;
        case 'pen': run(e.selectPen(d.pen)); break;
        case 'lane': ui.lane = +d.lane; break;
        case 'spot': run(e.applySpot(e.state.selectedPen, ui.lane)); break;
        case 'eluent': ui.eluent = d.el; break;
        case 'level': ui.level = clamp(ui.level + +d.d, 0.5, 3); break;
        case 'fill': run(e.fillChamber(ui.eluent, ui.level)); break;
        case 'emptyCh': run(e.emptyChamber()); break;
        case 'lid': run(e.setLid(!e.state.chamber.lid)); break;
        case 'insertP': run(e.insertPaper()); ui.chromaView = 'lab'; break;
        case 'removeP': run(e.removePaper()); break;
        case 'markF': run(e.markFront()); break;
        case 'cview': ui.chromaView = d.v; ui.measure = null; break;
        case 'expert': session.setExpert(el.checked); sigs.tasks = null; break;
        // Destillation
        case 'dplace': run(e.place(d.part, d.opt)); break;
        case 'dremove': run(e.remove(d.part)); break;
        case 'dfill': run(e.fill()); break;
        case 'dstones': run(e.addStones()); break;
        case 'tpos': ui.thermoPos = d.v; break;
        case 'hose': ui.hoseIn = d.v; break;
        case 'cool': run(e.setCooling(+d.level)); break;
        case 'heat': run(e.setHeater(+d.level)); break;
        case 'recv': run(e.placeReceiver(d.id || null)); break;
        case 'rstop': run(e.setReceiverStopper(!e.state.receiverStopper)); break;
        case 'ssrc': ui.sampleSrc = d.v; break;
        case 'sample': run(e.takeSample(ui.sampleSrc)); break;
        case 'itgt': ui.igniteTarget = d.v; break;
        case 'ignite': run(e.ignite(ui.igniteTarget)); break;
        default: return;
      }
      sigs.exp = null;
      session.checkProgress();
      save();
      refresh();
    }
    function applyTool(e, tool, to) {
      if (tool === 'water') return e.addWater(to, ui.waterAmt, 'cold');
      if (tool === 'kettle') return e.addWater(to, ui.waterAmt, 'hot');
      if (tool === 'hib') return e.addHibiscus(to);
      if (tool === 'magnet') return e.useMagnet(to);
      return { ok: false };
    }
    function collectDrafts() {
      $$('[data-gap]', tabBody).forEach((inp) => session.saveDraft('gaps', inp.dataset.gap, inp.value));
      $$('input[data-obs]', tabBody).forEach((inp) => { if (inp.type === 'radio') { if (inp.checked) session.saveDraft('obs', inp.dataset.obs, inp.value); } else session.saveDraft('obs', inp.dataset.obs, inp.value); });
    }

    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el || el.disabled) return;
      if (el.tagName === 'INPUT' && el.type === 'checkbox') return; // über change
      act(el);
    });
    document.addEventListener('change', (ev) => {
      const el = ev.target;
      if (el.dataset && el.dataset.act === 'expert') { act(el); return; }
      if (el.dataset && el.dataset.obs) { collectDrafts(); $$('.opt', tabBody).forEach((o) => o.classList.toggle('sel', !!$('input:checked', o))); save(); }
    });
    document.addEventListener('input', (ev) => {
      const el = ev.target;
      if (el.dataset && (el.dataset.gap || el.dataset.obs)) { collectDrafts(); saveTimer = 0; }
    });
    $('#homeBtn').addEventListener('click', () => showLab(null));
    $('#labTabs').addEventListener('click', (ev) => { const b = ev.target.closest('[data-lab]'); if (b) showLab(b.dataset.lab); });
    $('#timeCtl').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-speed]'); if (!b) return;
      if (b.dataset.speed === 'pause') session.setPaused(!session.state.paused); else session.setSpeed(+b.dataset.speed);
      renderTime(); save();
    });
    $('#btnRestart').addEventListener('click', restartDialog);
    $('#btnPanel').addEventListener('click', () => {
      ui.panelOpen = !ui.panelOpen;
      $('#layout').classList.toggle('collapsed', !ui.panelOpen);
      $('#btnPanel').setAttribute('aria-pressed', String(ui.panelOpen));
      requestAnimationFrame(() => stage.resize());
    });
    $('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !$('#modal').hidden) closeModal();
    });

    // ============================================================ Bühne: Tippen und Ziehen
    const canvas = stage.canvas;
    let down = null;
    canvas.addEventListener('pointerdown', (ev) => {
      if (!session.state.lab) return;
      const p = stage.toLogical(ev.clientX, ev.clientY);
      const h = stage.hitTest(p.x, p.y);
      down = { x: ev.clientX, y: ev.clientY, hit: h, id: ev.pointerId, moved: false };
      try { canvas.setPointerCapture(ev.pointerId); } catch (x) { /* */ }
    });
    canvas.addEventListener('pointermove', (ev) => {
      const p = stage.toLogical(ev.clientX, ev.clientY);
      const h = stage.hitTest(p.x, p.y);
      canvas.classList.toggle('pointer', !!h);
      if (!down || down.id !== ev.pointerId) return;
      if (!down.moved && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 12 && draggable(down.hit)) down.moved = true;
      if (down.moved) {
        ui.drag = { id: down.hit.id, ghost: p, target: dropTarget(down.hit.id, h) };
      }
    });
    const endDrag = (ev) => {
      if (!down || down.id !== ev.pointerId) return;
      const p = stage.toLogical(ev.clientX, ev.clientY);
      const h = stage.hitTest(p.x, p.y);
      if (down.moved) {
        const target = dropTarget(down.hit.id, h);
        if (target) drop(down.hit.id, target);
      } else if (down.hit) tap(down.hit, p);
      else if (session.state.lab === 'chroma' && ui.chromaView === 'compare') tap({ id: 'none' }, p);
      down = null; ui.drag = null;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', () => { down = null; ui.drag = null; });

    function draggable(h) {
      if (!h) return false;
      const lab = session.state.lab;
      const e = session.engine();
      if (lab === 'classic') return !!e.state.vessels[h.id] && !e.busy();
      if (lab === 'chroma') return h.id.startsWith('pen:');
      return false;
    }
    function dropTarget(src, h) {
      if (!h || h.id === src) return null;
      const lab = session.state.lab;
      if (lab === 'classic') {
        const e = session.engine();
        if (h.id === 'slot:filter' || h.id === 'slot:sep') return h.id;
        if (e.state.vessels[h.id] || ['F', 'D', 'S', 'waste'].includes(h.id)) return h.id;
        if (h.id === 'burner') return 'D';
        return null;
      }
      if (lab === 'chroma') return h.id.startsWith('lane:') ? h.id : null;
      return null;
    }
    function drop(src, target) {
      const e = session.engine();
      if (session.state.lab === 'classic') {
        if (target === 'slot:filter') run(e.moveVessel(src, 'filter'));
        else if (target === 'slot:sep') run(e.moveVessel(src, 'sep'));
        else run(e.pour(src, target, ui.pourMode));
        ui.selected.classic = src;
      } else if (session.state.lab === 'chroma') {
        const pen = src.slice(4), lane = +target.slice(5);
        e.selectPen(pen); ui.lane = lane;
        run(e.applySpot(pen, lane));
      }
      sigs.exp = null; session.checkProgress(); save(); refresh();
    }
    function tap(h, p) {
      const lab = session.state.lab;
      const e = session.engine();
      if (lab === 'classic') {
        const sel = ui.selected.classic;
        const container = !!e.container(h.id) && !['E'].includes(h.id);
        if (['water', 'kettle', 'hib', 'magnet'].includes(sel) && container && h.id !== sel) run(applyTool(e, sel, h.id));
        else if (h.id.startsWith('slot:') && sel && e.state.vessels[sel]) run(e.moveVessel(sel, h.id.slice(5)));
        else { ui.selected.classic = h.id === 'burner' ? 'D' : h.id.startsWith('slot:') ? sel : h.id; ui.flash = 'selCard'; }
      } else if (lab === 'chroma') {
        if (ui.chromaView === 'compare') {
          const m = renderers.chroma.measureAt(e, p.x, p.y);
          ui.measure = m && session.state.expert ? m : null;
          if (m && !session.state.expert) toast('Messen mit dem Lineal ist im Expertenmodus möglich.');
        } else if (h.id.startsWith('pen:')) { e.selectPen(h.id.slice(4)); ui.flash = 'cSpot'; }
        else if (h.id.startsWith('lane:')) {
          const lane = +h.id.slice(5);
          ui.lane = lane;
          const ps = e.state.paper;
          if (ps && ps.state === 'fresh') { if (!ps.line) run(e.drawLine(ui.lineTool, ui.lineY)); else run(e.applySpot(e.state.selectedPen, lane)); }
          ui.flash = 'cSpot';
        } else if (h.id === 'chamber') ui.flash = 'cChamber';
        else if (h.id === 'paper') ui.flash = e.state.paper && e.state.paper.state === 'fresh' ? 'cLine' : 'cDev';
        else if (h.id === 'pencil') { ui.lineTool = 'pencil'; ui.flash = 'cLine'; }
        else if (h.id === 'ballpoint') { ui.lineTool = 'ballpoint'; ui.flash = 'cLine'; }
        else if (h.id.startsWith('bottle:')) { ui.eluent = h.id.slice(7); ui.flash = 'cChamber'; }
      } else if (lab === 'distill') {
        if (h.id.startsWith('tray:')) {
          const part = h.id.slice(5);
          if (part === 'mix') run(e.fill());
          else if (part === 'stones') run(e.addStones());
          else run(e.place(part, part === 'thermo' ? ui.thermoPos : part === 'hoses' ? ui.hoseIn : undefined));
          ui.flash = 'dBuild';
        } else if (h.id.startsWith('rec:')) { run(e.placeReceiver(h.id.slice(4))); ui.flash = 'dRec'; }
        else if (h.id === 'dish') ui.flash = 'dBurn';
        else if (h.id === 'mantle' || h.id === 'flask' || h.id === 'head' || h.id === 'cooler') ui.flash = h.id === 'mantle' ? 'dRun' : 'dBuild';
      }
      sigs.exp = null; session.checkProgress(); save(); refresh();
    }

    // ============================================================ Gesamtaktualisierung
    function refresh() {
      if (!session.state.lab) return;
      renderTaskBar();
      renderHelp();
      renderTabs();
      if (ui.tab === 'exp') renderExp();
      else if (ui.tab === 'eval') renderEval();
      else renderNote();
      renderTime();
      const s = session.engine().state.safety;
      if (!!s !== !$('#safety').hidden) showSafety();
    }
    let liveClock = 0;
    function frame(dt) {
      if (!session.state.lab) return;
      liveClock -= dt;
      if (liveClock <= 0) {
        liveClock = 0.2;
        refresh();
        updateLive();
        renderHud();
      }
      saveTimer -= dt;
      if (saveTimer <= 0) { saveTimer = 2; save(); }
    }

    // Start
    load();
    if (ui.tab && !['exp', 'eval', 'note'].includes(ui.tab)) ui.tab = 'exp';
    showLab(session.state.lab);
    return { ui, frame, refresh, showLab, toast, save, act };
  }

  TL.ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
