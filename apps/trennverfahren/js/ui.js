/*
 * Trennverfahren – Oberfläche (DOM)
 *
 * Verbindet Fachmodell, Renderer, Teilchenansicht und Bedienfeld. Alle Handlungen
 * laufen über engine.act(); die Oberfläche setzt keinen Modellzustand direkt.
 * Bedienung: Gerät/Gefäß antippen → Ziel antippen (oder Zielschaltfläche in der
 * Bedienleiste). Erneutes Antippen stellt zurück. Ziehen ist zusätzlich möglich.
 * Ablauf: fünf Versuche → Kontrolle → Hefteintrag (shared/labkit/DESIGN.md, Abschnitt 6,
 * mit den in docs/BEDIENUNG.md begründeten Abweichungen).
 */
(function (root) {
  'use strict';
  const { core, splitter } = root.LK;
  const M = root.TV.model;
  const T = root.TV.tasks;
  const R = root.TV.render;
  const PV = root.TV.particles;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const fmt = core.fmt;
  const STORE = 'sivex-trennverfahren-v1';
  const N = M.EXP_IDS;

  function freshNote() { return { obs: '', expl: '', snaps: [], cls: {}, prin: [], graded: false, fails: 0, tip: 0, solution: false, confirmSolution: false, checked: null, goalAt: null, ansatz: 1, missing: [] }; }
  function freshQuiz() { return { answers: {}, gaps: {}, graded: false, fails: 0, tip: 0, gapTip: 0, bank: false, solution: false, confirmSolution: false }; }
  function initialUi() { return { tab: 'exp', cur: 1, speed: 1, panel: true, particles: false, names: true, selected: null, pFocus: {} }; }

  function createUI() {
    let saved = null;
    try { saved = JSON.parse(root.sessionStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    if (!saved || saved.v !== 1) saved = null;
    const ui = Object.assign(initialUi(), saved ? saved.ui : {});
    ui.selected = null;
    const notes = {}; for (const n of N) notes[n] = Object.assign(freshNote(), saved && saved.notes ? saved.notes[n] : {});
    const quiz = Object.assign(freshQuiz(), saved && saved.quiz ? saved.quiz : {});
    const engines = {};
    let msgTimer = null, confirmRestart = false;

    function engine(n) {
      if (!engines[n]) {
        engines[n] = M.createEngine(n, saved && saved.models ? saved.models[n] : null);
        wire(engines[n], n);
      }
      return engines[n];
    }
    const eng = () => engine(ui.cur);
    const st = () => eng().state;
    function wire(e, n) {
      e.on('message', (m) => { if (ui.cur === n) showMsg(m.text, m.kind); });
      e.on('change', (ev) => { if (ui.cur === n && ev && (ev.action === 'opDone' || ev.action === 'move')) { layoutDirty = true; refreshDeck(); } });
    }

    const renderer = R.createRenderer($('#lab'), eng, () => ({ selected: ui.selected }));
    const pview = PV.createParticleView($('#pcanvas'), eng, () => focusId());

    // ------------------------------------------------------------------ Speichern
    let saveTimer = null;
    function saveNow() {
      clearTimeout(saveTimer);
      const models = {};
      for (const n of N) if (engines[n]) models[n] = engines[n].state; else if (saved && saved.models && saved.models[n]) models[n] = saved.models[n];
      try { root.sessionStorage.setItem(STORE, JSON.stringify({ v: 1, ui, notes, quiz, models })); } catch (e) { /* ohne Speicher */ }
    }
    function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); }
    root.addEventListener('pagehide', saveNow);
    root.addEventListener('beforeunload', saveNow);

    // ------------------------------------------------------------------ Hinweisbereich oberhalb der Bühne
    function setTaskLine() {
      $('#hintTask').innerHTML = `<span class="no">Versuch ${ui.cur}/5</span>${esc(T.EXP[ui.cur].goal)}`;
    }
    let lastWarnAt = 0, pendingTimer = null;
    function showMsg(text, kind) {
      if (!text || confirmRestart) return;
      // eine Warnung bleibt mindestens 5 s stehen; spätere Hinweise folgen danach
      const now = Date.now();
      if (kind !== 'warn' && now - lastWarnAt < 5000) {
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => showMsg(text, kind), 5000 - (now - lastWarnAt));
        return;
      }
      if (kind === 'warn') { lastWarnAt = now; clearTimeout(pendingTimer); $('#hintbar').dataset.lastWarn = text; }
      const el = $('#hintMsg');
      el.className = 'hint-msg' + (kind === 'warn' ? ' warn' : kind === 'ok' ? ' ok' : '');
      el.textContent = text;
      el.title = text;
      $('#readout').textContent = text;
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { if (!confirmRestart) defaultMsg(); }, kind === 'warn' ? 14000 : 9000);
    }
    function defaultMsg() {
      const el = $('#hintMsg');
      el.className = 'hint-msg';
      const s = st();
      const sel = ui.selected && s.objs[ui.selected];
      el.textContent = sel ? `${sel.name} gewählt – tippe jetzt das Ziel an (oder unten eine Zielschaltfläche).` : 'Tippe ein Gerät oder Gefäß an und danach das Ziel.';
      el.title = '';
    }

    // ------------------------------------------------------------------ Handlungen
    function act(name, ...args) {
      const r = eng().act(name, ...args);
      layoutDirty = true;
      refreshDeck();
      save();
      return r;
    }
    const busy = () => { const op = st().op; return op && !(op.type === 'pour' && op.phase === 'flow'); };
    function select(id, keepMsg) {
      const o = st().objs[id];
      if (!o) return;
      if ((o.type === 'watch' && M.isEmpty(o.c)) || (o.type === 'bowl' && M.isEmpty(o.c)) || (o.type === 'dish' && M.solids(o.c) < 0.05)) {
        ui.selected = null; if (o.c) ui.pFocus[ui.cur] = id;
        showMsg(`${o.name}${o.paper ? ' mit Filterpapier' : ''}: ${M.describe(o).text}. ${o.type === 'bowl' || o.type === 'watch' ? '' : 'Gieße mit einem anderen Gefäß hinein.'}`);
        refreshDeck(); return;
      }
      ui.selected = id;
      if (o.c && o.type !== 'magnet') ui.pFocus[ui.cur] = id;
      if (!keepMsg) defaultMsg();
      refreshDeck();
    }
    /**
     * Ergebnis einer Handlung mit gewähltem Gerät: bei Erfolg Auswahl aufheben (bzw. behalten),
     * bei Ablehnung die Auswahl auf das angetippte Gefäß wechseln – die Begründung bleibt stehen.
     * So bleibt kein Werkzeug „hängen“, und jedes Gefäß lässt sich jederzeit wählen.
     */
    function after(r, id, keepOnOk) {
      if (r && r.ok) { if (!keepOnOk) deselect(); return; }
      const o = st().objs[id];
      ui.selected = null;
      if (o && o.c && o.type !== 'magnet') select(id, true); else refreshDeck();
    }
    function deselect() { ui.selected = null; refreshDeck(); }
    function tap(id) {
      const s = st();
      const obj = s.objs[id];
      if (s.op && s.op.type === 'pour') { showMsg('Es wird gerade gegossen. Tippe zuerst „Gießen stoppen“.'); return; }
      if (busy()) { showMsg('Warte, bis der laufende Handgriff fertig ist.'); return; }
      // Hahn direkt am Scheidetrichter: zu → Tropfen → offen → zu
      if (id === 'cock') { const sp = s.objs.S; if (sp) act('setCock', (sp.cock + 1) % 3); return; }
      // Drehknopf direkt an der Heizplatte: aus → niedrig → hoch → aus
      if (id === 'knob') { if (s.plate) act('heat', (s.plate.level + 1) % 3); return; }
      const sel = ui.selected ? s.objs[ui.selected] : null;
      // Stopfen auf dem Scheidetrichter antippen: abnehmen und auf die Ablage legen
      if (obj && obj.type === 'stopper' && s.objs[obj.at] && (!sel || sel.id === id)) { act('stopper', false); deselect(); return; }
      if (!sel) {
        if (!obj) { showMsg('Wähle zuerst ein Gerät oder Gefäß aus. Danach tippst du diesen Platz an.'); return; }
        select(id); return;
      }
      if (sel.id === id) {
        if (sel.at !== sel.home && M.TYPES[sel.type].move && !M.objAt(s, sel.home)) act('move', id, sel.home);
        deselect(); defaultMsg(); return;
      }
      if (!obj) {
        if (M.TYPES[sel.type].move) { const r = act('move', sel.id, id); if (r.ok) deselect(); }
        else showMsg(`${sel.name} bleibt an seinem Platz.`);
        return;
      }
      if (obj.c && obj.type !== 'magnet') ui.pFocus[ui.cur] = id;
      switch (sel.type) {
        case 'rod': after(act('stir', id), id); break;
        case 'wash': after(act('wash', id), id); break;
        case 'paper': after(act('insertPaper', id), id); break;
        case 'magnet': {
          // Magnet bleibt nach Erfolg gewählt (mehrere Durchgänge). Hängt Eisen daran, bleibt er auch
          // bei einem ungeeigneten Ziel gewählt; ohne Eisen wechselt die Auswahl zum angetippten Gefäß.
          const holding = s.objs.mag.c.iron > 0.005;
          const r = act(holding ? 'magnetDrop' : 'magnet', id);
          if (!r.ok && !holding) after(r, id);
          break;
        }
        case 'stopper': if (obj.type === 'sep') after(act('stopper', true), id); else select(id); break;
        case 'funnel': if (obj.type === 'watch') after(act('transferPaper', sel.id, id), id); else select(id); break;
        case 'dish': if (['watch', 'beaker', 'erlenmeyer', 'bowl'].includes(obj.type)) after(act('scrape', sel.id, id), id); else select(id); break;
        case 'watch': if (['beaker', 'erlenmeyer', 'bowl', 'dish'].includes(obj.type)) after(act('scrape', sel.id, id), id); else select(id); break;
        default:
          if (M.TYPES[sel.type].pour && obj.c) after(act('pour', sel.id, id), id);
          else select(id);
      }
    }

    // ------------------------------------------------------------------ Bedienleiste
    function targetsFor(sel) {
      const s = st(), out = [];
      const vessels = s.order.map((i) => s.objs[i]).filter((o) => o.c && o.type !== 'magnet' && o.id !== sel.id);
      const label = (o) => o.type === 'funnel' ? 'den Trichter' : o.type === 'sep' ? 'den Scheidetrichter' : o.name;
      switch (sel.type) {
        case 'rod': vessels.filter((o) => !['funnel', 'sep'].includes(o.type) && !M.isEmpty(o.c)).forEach((o) => out.push({ id: o.id, text: `in ${o.name} rühren` })); break;
        case 'wash': vessels.filter((o) => !['dish', 'watch'].includes(o.type) && (o.type !== 'funnel' || o.at === 'ring') && (o.type !== 'sep' || o.at === 'sepring')).forEach((o) => out.push({ id: o.id, text: `Wasser in ${label(o)}` })); break;
        case 'paper': vessels.filter((o) => o.type === 'funnel').forEach((o) => out.push({ id: o.id, text: 'in den Trichter legen' })); break;
        case 'stopper': if (s.objs.S && !s.objs.S.stopper) out.push({ id: 'S', text: 'auf den Scheidetrichter setzen' }); break;
        case 'dish': vessels.filter((o) => (o.type === 'watch' && M.isEmpty(o.c) && !o.paper) || ['beaker', 'erlenmeyer', 'bowl'].includes(o.type)).forEach((o) => out.push({ id: o.id, text: `Kristalle ${o.type === 'watch' ? 'auf das Uhrglas' : 'in ' + o.name} überführen` })); break;
        case 'watch': vessels.filter((o) => ['beaker', 'erlenmeyer', 'bowl', 'dish'].includes(o.type)).forEach((o) => out.push({ id: o.id, text: `Inhalt mit dem Spatel in ${o.name} geben` })); break;
        case 'magnet':
          if (s.objs.mag.c.iron > 0.005) vessels.filter((o) => o.type === 'watch' || o.c.iron > 0.02).sort((a, b) => (a.type === 'watch' ? -1 : 0) - (b.type === 'watch' ? -1 : 0)).forEach((o) => out.push({ id: o.id, text: o.type === 'watch' ? 'Eisen auf dem Uhrglas abstreifen' : `Eisen zurück in ${label(o)}` }));
          else vessels.filter((o) => o.c.iron > 0.02).forEach((o) => out.push({ id: o.id, text: o.type === 'funnel' ? 'durch den Rückstand im Filter ziehen' : `durch ${o.name} ziehen` }));
          break;
        default:
          // alle Gefäße anbieten; ist ein Ziel gerade ungeeignet, erklärt die Meldung den Grund
          if (M.TYPES[sel.type].pour && !M.isEmpty(sel.c)) vessels.filter((o) => o.type !== 'dish' || sel.type !== 'bowl').forEach((o) => out.push({ id: o.id, text: `in ${label(o)} gießen` }));
          if (sel.type === 'funnel' && sel.paper) vessels.filter((o) => o.type === 'watch').forEach((o) => out.push({ id: o.id, text: 'Filterpapier mit Rückstand auf das Uhrglas legen' }));
          if (M.TYPES[sel.type].move) {
            for (const slot of eng().exp.slots) {
              if (M.objAt(s, slot.id) || !(slot.id === sel.home || (M.SLOT_ACCEPT[slot.kind] || []).includes(sel.type))) continue;
              const name = slot.id === sel.home ? (sel.type === 'sep' ? 'auf die Ablage legen' : 'zurück an den Platz') : slot.kind === 'under' ? 'unter den Trichter stellen' : slot.kind === 'sepunder' ? 'unter den Hahn stellen' : slot.kind === 'ring' ? 'in den Filtrierring setzen' : slot.kind === 'sepring' ? 'in den Ring hängen' : slot.kind === 'hand' ? 'zum Schütteln in die Hand nehmen' : 'auf die Heizplatte';
              out.push({ id: slot.id, text: name });
            }
          }
      }
      return out;
    }
    function refreshDeck() {
      const s = st(), e = eng();
      const box = $('#deckSel');
      const op = s.op;
      let html;
      if (op && op.type === 'pour') {
        html = `<span class="what">${op.phase === 'flow' ? 'Es wird gegossen' : 'Gießen'}: ${esc(s.objs[op.src].name)} → ${esc(s.objs[op.dst].type === 'funnel' ? 'Trichter' : s.objs[op.dst].name)}${op.phase === 'flow' ? ` · ${fmt(op.poured, 0)} ${op.dry ? 'g' : 'mL'}` : ''}</span>`;
      } else if (ui.selected && s.objs[ui.selected]) {
        const sel = s.objs[ui.selected];
        const tg = targetsFor(sel);
        html = `<span class="what">Gewählt: ${esc(sel.name)}${sel.type === 'magnet' && sel.c.iron > 0.005 ? ` (${fmt(sel.c.iron, 1)} g Eisen)` : ''} →</span>` +
          (tg.length ? tg.map((t) => `<button type="button" class="lk-btn tgt" data-target="${t.id}">${esc(t.text)}</button>`).join('') : '<span class="what idle">kein passendes Ziel</span>') +
          '<button type="button" class="lk-btn" data-cmd="deselect">Auswahl aufheben</button>';
      } else {
        html = '<span class="what idle">Gerät oder Gefäß antippen (auch Tab + Eingabe) – dann erscheinen hier die Ziele.</span>';
      }
      if (box.dataset.html !== html) {
        const had = document.activeElement && box.contains(document.activeElement) ? (document.activeElement.dataset.target || document.activeElement.dataset.pick || document.activeElement.dataset.cmd) : null;
        box.innerHTML = html; box.dataset.html = html;
        if (had) { const b = box.querySelector(`[data-target="${had}"],[data-pick="${had}"],[data-cmd="${had}"]`); if (b) b.focus(); else box.querySelector('button') && box.querySelector('button').focus(); }
      }
      // feste Bedienelemente
      const pourOn = !!(op && op.type === 'pour');
      $('#btnStopPour').disabled = !pourOn || op.phase === 'back';
      for (const b of document.querySelectorAll('#pourSpeed button')) b.setAttribute('aria-pressed', String(b.dataset.v === s.pourSpeed));
      $('#ctlWash').hidden = !s.objs.wash;
      for (const b of document.querySelectorAll('#washAmt button')) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === s.washAmt));
      $('#ctlHeat').hidden = !s.plate;
      if (s.plate) for (const b of document.querySelectorAll('#heatLevel button')) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === s.plate.level));
      const sep = s.objs.S;
      $('#ctlSep').hidden = !sep;
      if (sep) {
        $('#btnStopper').textContent = sep.stopper ? 'Stopfen ab' : 'Stopfen auf';
        $('#btnStopper').setAttribute('aria-pressed', String(sep.stopper));
        for (const b of document.querySelectorAll('#cock button')) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === sep.cock));
      }
      for (const b of document.querySelectorAll('#speed button')) b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === ui.speed));
      $('#btnParticles').setAttribute('aria-pressed', String(ui.particles));
      $('#btnNames').setAttribute('aria-pressed', String(ui.names));
      document.querySelector('#hits').classList.toggle('targeting', !!ui.selected);
      updateHitStates();
      void e;
    }

    // ------------------------------------------------------------------ Trefferflächen und Namensfelder
    let layoutDirty = true;
    let hitSig = '';
    function slotName(slot) {
      const s = st();
      const o = M.objAt(s, slot.id);
      switch (slot.kind) {
        case 'ring': return o ? 'Filtrierring' : 'Filtrierring (frei)';
        case 'under': return o ? '' : 'Platz unter dem Trichter';
        case 'sepring': return 'Ring am Stativ';
        case 'sepunder': return 'Platz unter dem Hahn';
        case 'plate': return 'Heizplatte';
        case 'hand': return 'Scheidetrichter in die Hand nehmen (zum Schütteln)';
        case 'shelf': return 'freier Platz auf der Ablage';
        default: return 'freier Platz';
      }
    }
    function describeObj(o) {
      if (o.type === 'stopper') return st().objs[o.at] ? 'Stopfen (auf dem Scheidetrichter) – antippen zum Abnehmen' : 'Stopfen (auf der Ablage)';
      if (!o.c) return o.name;
      if (o.type === 'watch' && o.paper) return `Uhrglas mit Filterpapier: ${M.describe(o).text}`;
      if (o.type === 'magnet') return o.c.iron > 0.005 ? `Magnet mit ${fmt(o.c.iron, 1)} g Eisen` : 'Magnet';
      const d = M.describe(o).text;
      const extra = o.type === 'funnel' ? (o.paper ? ' mit Filterpapier' : ' ohne Filterpapier') : o.type === 'sep' ? (o.stopper ? ', Stopfen auf' : '') + `, Hahn ${['zu', 'auf Tropfen', 'offen'][o.cock]}` : '';
      return `${o.name}${extra}: ${d}`;
    }
    function placeHits() {
      const s = st();
      const boxes = renderer.boxes();
      const sig = ui.cur + '|' + boxes.map((b) => b.id + b.kind).join(',');
      const host = $('#hits');
      if (sig !== hitSig) {
        host.innerHTML = boxes.map((b) => `<button type="button" class="hit ${b.kind}" data-hit="${b.id}"></button>`).join('');
        hitSig = sig;
      }
      const W = host.clientWidth, H = host.clientHeight;
      for (const b of boxes) {
        const el = host.querySelector(`[data-hit="${b.id}"]`);
        if (!el) continue;
        const r = renderer.toScreen(b);
        let w = Math.max(44, r.w), h = Math.max(44, r.h);
        let x = r.x + r.w / 2 - w / 2, y = r.y + r.h / 2 - h / 2;
        x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y));
        Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
        if (b.kind === 'obj') el.setAttribute('aria-label', describeObj(s.objs[b.id]));
        else if (b.kind === 'part') el.setAttribute('aria-label', b.id === 'knob' ? knobLabel() : cockLabel());
        else el.setAttribute('aria-label', slotName(M.slotOf(s, b.id)));
      }
      updateHitStates();
      placeNames();
      layoutDirty = false;
    }
    const COCK_TXT = ['zu', 'tropfenweise geöffnet', 'ganz geöffnet'];
    const HEAT_TXT = ['aus', 'niedrige Stufe', 'hohe Stufe'];
    function knobLabel() { const p = st().plate; return p ? `Heizplatte: ${HEAT_TXT[p.level]} – Drehknopf antippen zum Umstellen (aus → niedrig → hoch)` : 'Drehknopf'; }
    function cockLabel() { const sp = st().objs.S; return sp ? `Hahn: ${COCK_TXT[sp.cock]} – antippen zum Umstellen (zu → Tropfen → offen)` : 'Hahn'; }
    function updateHitStates() {
      const s = st();
      const sel = ui.selected && s.objs[ui.selected];
      for (const el of document.querySelectorAll('#hits .hit')) {
        const id = el.dataset.hit;
        el.setAttribute('aria-pressed', String(id === ui.selected));
        if (el.classList.contains('slot')) el.classList.toggle('can', !!(sel && M.TYPES[sel.type].move && !eng().canMove(sel.id, id)));
      }
    }
    // sinnvolle Trennstellen (weiches Trennzeichen) für schmale Namensfelder
    const HY = { Erlenmeyerkolben: 'Erlenmeyer­kolben', Spritzflasche: 'Spritz­flasche', Filterpapier: 'Filter­papier', Porzellanschale: 'Porzellan­schale', Becherglas: 'Becher­glas', Scheidetrichter: 'Scheide­trichter', Abdampfschale: 'Abdampf­schale', Heizplatte: 'Heiz­platte', Filtrierring: 'Filtrier­ring', Trichterhalter: 'Trichter­halter', Uhrglas: 'Uhr­glas', Glasstab: 'Glas­stab', Papier: 'Pa­pier' };
    const hyph = (t) => t.replace(/[A-ZÄÖÜ][a-zäöüß]+/g, (w) => HY[w] || w);
    function placeNames() {
      const host = $('#names');
      host.hidden = !ui.names;
      if (!ui.names) return;
      const s = st(), ex = eng().exp;
      const items = [];
      const seen = new Set();
      for (const slot of ex.slots) {
        const o = M.objAt(s, slot.id);
        const homeObj = s.order.map((i) => s.objs[i]).find((q) => q.home === slot.id);
        if (slot.kind === 'under' || slot.kind === 'sepunder') {
          items.push({ x: slot.x, tier: 2, text: (slot.kind === 'under' ? 'darunter: ' : 'unter dem Hahn: ') + (o ? o.name : 'frei'), id: o && o.id });
          continue;
        }
        if (slot.kind === 'ring') { const f = o; items.push({ x: slot.x, tier: 1, text: f ? (f.paper ? 'Trichter mit Filterpapier' : 'Trichter (ohne Papier)') : 'Stativ mit Filtrierring', id: f && f.id }); continue; }
        if (slot.kind === 'sepring') { items.push({ x: slot.x, tier: 1, text: o ? 'Scheidetrichter im Ring' : 'Stativ mit Ring', id: o && o.id }); continue; }
        if (slot.kind === 'plate') { items.push({ x: slot.x, tier: 1, text: o ? `Heizplatte · ${o.name}` : 'Heizplatte', id: o && o.id }); continue; }
        if (slot.kind === 'shelf') continue;
        if (slot.kind === 'hand') { if (o) items.push({ x: slot.x, tier: 1, text: 'Scheidetrichter in der Hand', id: o.id }); continue; }
        const tier = slot.kind === 'front' ? 2 : 1;
        if (o) { items.push({ x: slot.x, tier, text: o.name, id: o.id }); seen.add(o.id); }
        else if (homeObj && homeObj.type === 'funnel') items.push({ x: slot.x, tier, text: 'Trichterhalter' });
        else if (homeObj && homeObj.type === 'sep') items.push({ x: slot.x, tier, text: 'Ablage' });
        else if (homeObj) items.push({ x: slot.x, tier, text: `(${homeObj.name})` });
      }
      // Wandablage: ein gemeinsames Feld in der unteren Zeile
      const shelf = ex.slots.filter((q) => q.kind === 'shelf');
      if (shelf.length) {
        const names = shelf.map((q) => { const o = M.objAt(s, q.id); return o ? o.name : null; }).filter(Boolean);
        items.push({ x: shelf.reduce((a, q) => a + q.x, 0) / shelf.length, tier: 3, text: 'Ablage oben: ' + (names.length ? names.join(' · ') : 'leer') });
      }
      const W = host.clientWidth;
      const html = items.map((it) => {
        const same = items.filter((q) => q.tier === it.tier && q !== it).map((q) => Math.abs(renderer.worldX(q.x) - renderer.worldX(it.x)));
        const room = it.tier === 3 ? Math.min(W - 8, 520) : Math.min(220, same.length ? Math.min(...same) - 6 : 220);
        const x = Math.max(room / 2, Math.min(W - room / 2, renderer.worldX(it.x)));
        return `<span class="nm t${it.tier}${it.id && it.id === ui.selected ? ' sel' : ''}" style="left:${x.toFixed(0)}px;width:${Math.max(40, room).toFixed(0)}px">${hyph(esc(it.text))}</span>`;
      }).join('');
      if (host.dataset.html !== html) { host.innerHTML = html; host.dataset.html = html; }
      const three = items.some((it) => it.tier === 3);
      if (host.classList.contains('three') !== three) { host.classList.toggle('three', three); relayout(); }
    }

    // ------------------------------------------------------------------ Teilchenmodell
    function focusId() {
      const s = st();
      const f = ui.pFocus[ui.cur];
      if (f && s.objs[f] && s.objs[f].c) return f;
      if (f && PV.REF[f] && ui.cur === 3) return f;
      return eng().exp.main;
    }
    function updatePview() {
      if (!ui.particles) return;
      const s = st();
      const id = focusId();
      const o = s.objs[id] || PV.REF[id];
      const sel = $('#pSelect');
      const opts = s.order.map((i) => s.objs[i]).filter((q) => q.c && q.type !== 'magnet');
      if (ui.cur === 3) opts.push(...Object.values(PV.REF));
      const sig = opts.map((q) => q.id).join(',');
      if (sel.dataset.sig !== sig) { sel.innerHTML = opts.map((q) => `<option value="${q.id}">${esc(q.name)}</option>`).join(''); sel.dataset.sig = sig; }
      if (sel.value !== id && document.activeElement !== sel) sel.value = id;
      $('#pFocus').textContent = '– ' + o.name;
      $('#pObs').textContent = o.ref ? o.obs : (M.describe(o).text || '') + (o.type === 'funnel' ? (o.paper ? ' (mit Filterpapier)' : ' (ohne Filterpapier)') : '') + (o.temp > 30 ? ` · ${fmt(o.temp, 0)} °C` : '');
      $('#pModel').textContent = PV.modelText(s, o);
      const c = o.c;
      const L = c.water > 0.02 ? [['water', 'Wasserteilchen', 'tri']] : [];
      if (c.saltD > 0.02 || c.saltS > 0.02) L.push(['na', 'Na⁺-Ion', 'ion', '+'], ['cl', 'Cl⁻-Ion', 'ion big', '−']);
      if (c.oil > 0.05) L.push(['oil', 'Ölteilchen', 'sq']);
      if (M.sand(c) > 0.05) L.push(['sand', 'Sandkorn (sehr viele Teilchen)', 'gr']);
      if (c.iron > 0.02) L.push(['iron', 'Eisenkorn (sehr viele Teilchen)', 'gr']);
      const html = L.map(([k, t, cls, g]) => `<li><i class="${cls}" style="background:${PV.COLORS[k]}" aria-hidden="true">${g || ''}</i>${t}</li>`).join('');
      if ($('#pLegend').dataset.html !== html) { $('#pLegend').innerHTML = html; $('#pLegend').dataset.html = html; }
    }

    // ------------------------------------------------------------------ Bedienfeld
    const flagsOf = (n) => (engines[n] ? engines[n].state.flags : saved && saved.models && saved.models[n] ? saved.models[n].flags : null);
    const complete = (n) => !!(notes[n].goalAt && T.checkCls(n, notes[n].cls).all && T.checkPrin(n, notes[n].prin, flagsOf(n)).ok);
    const allDone = () => N.every(complete);
    function quizState() {
      const items = {};
      let all = true;
      for (const q of T.QUIZ) { const r = T.checkQuizItem(q, quiz.answers[q.id]); items[q.id] = r; if (!r.ok) all = false; }
      const g = T.checkGaps(quiz.gaps);
      return { items, gaps: g, all: all && g.all };
    }

    function renderPanel() {
      const body = $('#panelBody');
      const panel = $('#panel');
      const act = document.activeElement;
      const key = act && body.contains(act) ? (act.dataset.key || null) : null;
      const caret = key && 'selectionStart' in act ? [act.selectionStart, act.selectionEnd] : null;
      const scroll = panel.scrollTop;
      for (const b of document.querySelectorAll('.lk-tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab));
      body.innerHTML = ui.tab === 'exp' ? expHtml() : ui.tab === 'quiz' ? quizHtml() : notebookHtml();
      panel.scrollTop = scroll;
      if (key) {
        const el = body.querySelector(`[data-key="${CSS.escape(key)}"]`);
        // Auswahllisten nur nach Tastaturbedienung erneut fokussieren: Safari auf dem iPad öffnet eine
        // fokussierte Auswahlliste sofort wieder – nach dem Antippen einer Antwort sprang sie erneut auf.
        if (el && !(el.tagName === 'SELECT' && !lastKeyboard)) { el.focus({ preventScroll: true }); if (caret && el.setSelectionRange) try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* */ } }
      }
    }
    // Letzte Eingabeart (Tastatur oder Zeiger/Finger) – steuert, ob Auswahllisten den Fokus zurückbekommen
    var lastKeyboard = false; // eslint-disable-line no-var -- vor dem ersten renderPanel verfügbar
    document.addEventListener('keydown', () => { lastKeyboard = true; }, true);
    document.addEventListener('pointerdown', () => { lastKeyboard = false; }, true);
    document.addEventListener('touchstart', () => { lastKeyboard = false; }, { capture: true, passive: true });

    function expHtml() {
      const n = ui.cur, note = notes[n], X = T.EXP[n], ex = M.EXPERIMENTS[n];
      const s = st();
      const chips = N.map((k) => `<button type="button" data-a="go" data-n="${k}" aria-pressed="${k === n}">${k}${complete(k) ? ' <span class="done">✓</span>' : ''}<small>${esc(M.EXPERIMENTS[k].short)}</small></button>`).join('');
      let h = `<div class="taskchips" role="group" aria-label="Versuch wählen">${chips}</div>`;
      h += `<div class="lk-card"><h2>Versuch ${n}: ${esc(ex.title)}</h2><p>${esc(X.problem)}</p><p class="material">Material: ${esc(X.material)}</p>`;
      h += '<div class="lk-row"><button type="button" class="lk-btn primary" data-a="check" data-key="check">Ergebnis prüfen</button><button type="button" class="lk-btn" data-a="tip" data-key="tip">Tipp' + (note.tip ? ` ${Math.min(3, note.tip + 1)}/3` : '') + '</button><button type="button" class="lk-btn" data-a="solution" data-key="solution">Vorgehen anzeigen</button></div>';
      if (note.checked) {
        const ev = eng().evaluate();
        h += `<div class="lk-note ${ev.done ? 'ok' : 'warn'}" role="status"><b>${ev.done ? 'Trennziel erreicht.' : 'Das Trennziel ist noch nicht erreicht.'}</b><ul class="crit">` +
          ev.criteria.map((c) => `<li><span class="mk ${c.ok ? 'y' : 'n'}">${c.ok ? '✓' : '✗'}</span><span>${esc(c.text)}${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</span></li>`).join('') + '</ul>' +
          (!ev.done && note.fails >= 2 && !note.tip ? '<p>Brauchst du Hilfe? Tippe auf „Tipp“.</p>' : '') + '</div>';
      }
      if (note.tip) h += `<div class="lk-note tipbox">${X.tips.slice(0, note.tip).map((f, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(f(s, eng().evaluate()))}</p>`).join('')}</div>`;
      if (note.confirmSolution) h += '<div class="lk-note warn"><p>Möchtest du das vollständige Vorgehen sehen? Probiere es möglichst zuerst selbst.</p><div class="lk-row"><button type="button" class="lk-btn" data-a="solYes" data-key="solYes">Ja, anzeigen</button><button type="button" class="lk-btn" data-a="solNo">Abbrechen</button></div></div>';
      if (note.solution) h += `<div class="lk-note info"><b>Vorgehen</b><ol>${X.solution.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>`;
      h += `<p class="status-line">Trennziel: ${note.goalAt ? `<span class="y">✓ erreicht</span> (Ansatz ${note.goalAt.ansatz}, nach ${core.fmtTime(note.goalAt.t)} min Versuchszeit)` : '<span class="n">noch nicht erreicht</span>'} · Ansatz ${note.ansatz}</p></div>`;
      // Protokoll
      const cls = note.graded ? T.checkCls(n, note.cls) : null;
      const pr = note.graded ? T.checkPrin(n, note.prin, flagsOf(n)) : null;
      const miss = new Set(note.missing || []);
      h += `<div class="lk-card lk-form"><h2>Protokoll – Versuch ${n}</h2>`;
      h += `<p class="doc-note">1. und 2. sind deine eigene Dokumentation. Sie werden <b>nicht bewertet</b>; geprüft werden das Versuchsergebnis sowie 3. und 4.</p>`;
      h += `<fieldset><legend>1. Beobachtung (Stoffebene)</legend><p class="lbl">${esc(X.obsHint)} Schreibe nur, was du siehst.</p>
        <textarea data-f="obs" data-key="obs" aria-label="Beobachtung">${esc(note.obs)}</textarea></fieldset>`;
      h += `<fieldset><legend>2. Erklärung (Teilchenebene, Eigenschaften)</legend><p class="lbl">${esc(X.explHint)}</p><textarea data-f="expl" data-key="expl" aria-label="Erklärung">${esc(note.expl)}</textarea></fieldset>`;
      h += `<div class="lk-row"><button type="button" class="lk-btn" data-a="snap" data-key="snap">Beobachtung und Erklärung als Zwischenstand speichern</button><span class="lk-muted" style="font-size:13px">mit Ansatz, Versuchszeit und Zustand</span></div>`;
      if (note.snaps.length) h += `<ul class="snaps">${note.snaps.map((x) => `<li><span class="meta">${x.ansatz !== note.ansatz ? '<span class="old">früherer Ansatz · </span>' : ''}Ansatz ${x.ansatz} · ${core.fmtTime(x.t)} min · ${esc(x.state)}</span>${x.obs ? `<i>Beobachtung:</i> ${esc(x.obs)}` : ''}${x.expl ? `<br><i>Erklärung:</i> ${esc(x.expl)}` : ''}</li>`).join('')}</ul>`;
      if (note.goalAt) h += `<div class="lk-row"><button type="button" class="lk-btn" data-a="sample" data-key="sample" aria-expanded="${!!note.sample}">Musterbeobachtung ${note.sample ? 'ausblenden' : 'zum Vergleich anzeigen'}</button></div>` + (note.sample ? `<div class="lk-note info"><b>Musterbeobachtung (zum Selbstvergleich)</b><p>${esc(X.sample)}</p></div>` : '');
      h += `<fieldset class="${miss.has('cls') ? 'missing' : ''}"><legend>3. Einordnung des Gemischs</legend><p class="lbl">${esc(X.cls.q)}</p><div class="row2">` +
        [['hom', 'homogen'], ['het', 'heterogen']].map(([v, t]) => `<label class="lk-opt ${cls && note.cls.hom === v ? (cls.hom.ok ? 'right' : 'wrong') : ''}"><input type="radio" name="hom" value="${v}" data-key="hom-${v}" ${note.cls.hom === v ? 'checked' : ''}>${t}${cls && note.cls.hom === v ? `<span class="lk-mark ${cls.hom.ok ? 'y' : 'n'}">${cls.hom.ok ? '✓' : '✗'}</span>` : ''}</label>`).join('') + '</div>' +
        (cls && !cls.hom.ok ? `<p class="lk-fb n">${esc(cls.hom.fb)}</p>` : '') +
        `<p class="lbl">Gemischart:</p><select data-f="kind" data-key="kind" aria-label="Gemischart" class="${cls && note.cls.kind ? (cls.kind.ok ? 'right' : 'wrong') : ''}"><option value="">– bitte wählen –</option>${T.KINDS.map((k) => `<option value="${k.id}" ${note.cls.kind === k.id ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select>` +
        (cls && note.cls.kind ? `<p class="lk-fb ${cls.kind.ok ? 'y' : 'n'}">${cls.kind.ok ? '✓ ' : '✗ '}${esc(cls.kind.fb)}</p>` : '') + '</fieldset>';
      h += `<fieldset class="${miss.has('prin') ? 'missing' : ''}"><legend>4. Genutzte Eigenschaft (Trennprinzip)</legend><p class="lbl">Kreuze alles Zutreffende an (mehrere Antworten können richtig sein).</p>` +
        T.PRINCIPLES.map((p) => { const m = pr ? pr.items[p.id] : null; return `<label class="lk-opt ${m === 'right' ? 'right' : m === 'wrong' ? 'wrong' : m === 'neutral' ? 'neutral' : ''}"><input type="checkbox" name="prin" value="${p.id}" data-key="prin-${p.id}" ${note.prin.includes(p.id) ? 'checked' : ''}>${esc(p.label)}${m === 'right' ? '<span class="lk-mark y">✓</span>' : m === 'wrong' ? '<span class="lk-mark n">✗</span>' : m === 'neutral' ? '<span class="lk-mark w" title="nicht nötig, aber nicht falsch">○</span>' : ''}</label>`; }).join('') +
        (pr ? `<p class="lk-fb ${pr.ok ? 'y' : 'n'}">${esc(pr.fb)}</p>` + pr.notes.map((x) => `<p class="lk-fb w">○ ${esc(x)}</p>`).join('') : '') + '</fieldset>';
      h += '<div class="lk-row"><button type="button" class="lk-btn primary" data-a="grade" data-key="grade">Auswertung prüfen</button></div>';
      if (note.graded) {
        const parts = [];
        if (!note.goalAt) parts.push('das Trennziel im Versuch erreichen („Ergebnis prüfen“)');
        if (!(cls && cls.all)) parts.push('die Einordnung berichtigen');
        if (!(pr && pr.ok)) parts.push('die genutzte Eigenschaft berichtigen');
        h += parts.length ? `<div class="lk-note warn">Noch offen: ${parts.join(', ')}.</div>` : `<div class="lk-note ok"><b>Versuch ${n} ist abgeschlossen.</b> Deine Beobachtungen bleiben gespeichert; du kannst weiter beobachten und Zwischenstände ergänzen.</div>`;
      }
      if (complete(n)) h += `<div class="lk-row end">${n < 5 ? `<button type="button" class="lk-btn primary" data-a="go" data-n="${n + 1}">Weiter zu Versuch ${n + 1}</button>` : allDone() ? '<button type="button" class="lk-btn primary" data-a="tab" data-t="quiz">Weiter zur Kontrolle</button>' : ''}</div>`;
      h += '</div>';
      // Zustand als Text
      h += `<details class="state"><summary>Zustand der Gefäße als Text</summary><ul>${s.order.map((i) => s.objs[i]).filter((o) => o.c && o.type !== 'magnet').map((o) => `<li>${esc(describeObj(o))}</li>`).join('')}${Object.values(s.lost.spilled).some((v) => v > 0.05) ? `<li>Auf dem Tisch verschüttet: ${fmt(s.lost.spilled.water + s.lost.spilled.oil, 1)} mL</li>` : ''}${s.lost.evaporated.water > 0.5 ? `<li>Verdampft (nicht aufgefangen): ${fmt(s.lost.evaporated.water, 1)} mL Wasser</li>` : ''}${s.objs.mag && s.objs.mag.c.iron > 0.005 ? `<li>Am Magneten: ${fmt(s.objs.mag.c.iron, 1)} g Eisen</li>` : ''}</ul></details>`;
      return h;
    }

    function lockedHtml(title, items) {
      return `<div class="lk-card locked"><div class="big" aria-hidden="true">🔒</div><h2>${esc(title)}</h2><p>Noch offen:</p><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
    }
    function quizHtml() {
      if (!allDone()) return lockedHtml('Die Kontrolle folgt nach den fünf Versuchen.', N.filter((n) => !complete(n)).map((n) => `Versuch ${n}: ${esc(M.EXPERIMENTS[n].short)}`));
      const qs = quizState();
      let h = '<div class="lk-card lk-form"><h2>Kontrolle</h2><p>Beantworte alle Fragen. Bei jeder Frage steht, ob eine oder mehrere Antworten richtig sind. Nach dem Prüfen kannst du falsche Antworten verbessern – richtige bleiben stehen.</p>';
      for (const g of T.QUIZ_GROUPS) {
        h += `<h3 class="qgroup">${esc(g.title)}</h3>`;
        for (const q of T.QUIZ.filter((x) => x.group === g.id)) {
          const r = quiz.graded ? qs.items[q.id] : null;
          const ch = quiz.answers[q.id] || [];
          h += `<fieldset><legend>${esc(q.q)}</legend><p class="qmode">${q.multi ? 'Mehrere Antworten können richtig sein.' : 'Genau eine Antwort ist richtig.'}</p>` +
            q.opts.map((o, i) => { const sel = ch.includes(i); const mark = r && sel ? (o.ok ? 'right' : 'wrong') : ''; return `<label class="lk-opt ${mark}"><input type="${q.multi ? 'checkbox' : 'radio'}" name="${q.id}" value="${i}" data-key="${q.id}-${i}" ${sel ? 'checked' : ''}>${esc(o.t)}${mark ? `<span class="lk-mark ${o.ok ? 'y' : 'n'}">${o.ok ? '✓' : '✗'}</span>` : ''}</label>`; }).join('') +
            (r ? `<p class="lk-fb ${r.ok ? 'y' : 'n'}">${r.ok ? '✓ ' : ''}${esc(r.fb)}</p>` : '') +
            (quiz.solution ? `<p class="lk-fb">Lösung: ${q.opts.map((o, i) => (o.ok ? String.fromCharCode(97 + i) + ') ' + o.t : null)).filter(Boolean).map(esc).join(' · ')}</p>` : '') + '</fieldset>';
        }
      }
      h += '<h3 class="qgroup">Fachbegriffe – Lückentext</h3><fieldset><legend>Setze die passenden Fachbegriffe ein.</legend><p class="qmode">Groß- und Kleinschreibung ist egal; gleichwertige Begriffe werden anerkannt.</p><div class="cloze">';
      for (const part of T.CLOZE) {
        if (part.t) { h += esc(part.t); continue; }
        const r = quiz.graded ? qs.gaps.items[part.gap] : null;
        const v = quiz.gaps[part.gap] || '';
        h += `<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-gap="${part.gap}" data-key="${part.gap}" aria-label="Lücke ${part.gap.slice(1)}" value="${esc(v)}" class="${r ? (r.ok ? 'right' : 'wrong') : ''}">`;
        if (r && !r.ok) h += `<span class="gfb">✗ ${esc(r.feedback)}</span>`;
        else if (r && r.status === 'typo') h += `<span class="gfb" style="color:var(--ok)">✓ ${esc(r.feedback)}</span>`;
      }
      h += '</div>';
      h += `<div class="lk-row"><button type="button" class="lk-btn" data-a="bank" data-key="bank" aria-expanded="${quiz.bank}">Begriffshilfe ${quiz.bank ? 'ausblenden' : 'anzeigen'}</button></div>`;
      if (quiz.bank) h += `<div class="wordbank">${T.WORDBANK.map((w) => `<span>${esc(w)}</span>`).join('')}</div>`;
      if (quiz.solution) h += `<p class="lk-fb">Lösung: ${T.GAPS.map((g) => esc(g.accept[0])).join(' · ')}</p>`;
      h += '</fieldset>';
      h += '<div class="lk-row"><button type="button" class="lk-btn primary" data-a="qcheck" data-key="qcheck">Antworten prüfen</button><button type="button" class="lk-btn" data-a="qtip" data-key="qtip">Tipp' + (quiz.tip ? ` ${Math.min(3, quiz.tip + 1)}/3` : '') + '</button><button type="button" class="lk-btn" data-a="qsol" data-key="qsol">Lösung anzeigen</button></div>';
      if (quiz.tip) h += `<div class="lk-note tipbox">${T.QUIZ_TIPS.slice(0, quiz.tip).map((t, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(t)}</p>`).join('')}${T.GAP_TIPS.slice(0, quiz.tip).map((t, i) => `<p><span class="lvl">Lückentext ${i + 1}/3:</span> ${esc(t)}</p>`).join('')}</div>`;
      if (quiz.confirmSolution) h += '<div class="lk-note warn"><p>Lösung wirklich anzeigen? Versuche es zuerst mit den Tipps.</p><div class="lk-row"><button type="button" class="lk-btn" data-a="qsolYes" data-key="qsolYes">Ja, anzeigen</button><button type="button" class="lk-btn" data-a="qsolNo">Abbrechen</button></div></div>';
      if (quiz.graded) {
        const wrongMc = T.QUIZ.filter((q) => !qs.items[q.id].ok).length, wrongGaps = T.GAPS.filter((g) => !qs.gaps.items[g.gap].ok).length;
        h += qs.all ? '<div class="lk-note ok"><b>Alles richtig.</b> Der Hefteintrag ist freigeschaltet.<div class="lk-row end"><button type="button" class="lk-btn primary" data-a="tab" data-t="notebook">Zum Hefteintrag</button></div></div>'
          : `<div class="lk-note warn">Noch zu verbessern: ${wrongMc ? `${wrongMc} ${wrongMc === 1 ? 'Frage' : 'Fragen'}` : ''}${wrongMc && wrongGaps ? ' und ' : ''}${wrongGaps ? `${wrongGaps} ${wrongGaps === 1 ? 'Lücke' : 'Lücken'}` : ''}. Die markierten Stellen ändern und erneut prüfen.${quiz.fails >= 2 && !quiz.tip ? ' Brauchst du Hilfe? Tippe auf „Tipp“.' : ''}</div>`;
      }
      return h + '</div>';
    }

    // Schematische Teilchenbilder für den Hefteintrag (unabhängig vom Kopfzeilenschalter)
    function svgFig(kind) {
      const r = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
      const rnd = r(kind.length * 97 + 11);
      const water = (n, y0, y1) => Array.from({ length: n }, () => `<circle cx="${(8 + rnd() * 144).toFixed(1)}" cy="${(y0 + rnd() * (y1 - y0)).toFixed(1)}" r="3" fill="#3d8fe0"/>`).join('');
      const ion = (x, y, na) => `<circle cx="${x}" cy="${y}" r="${na ? 3.4 : 4.8}" fill="${na ? '#8a4fd0' : '#2e9a5a'}"/><path d="M${x - 2.4} ${y}h4.8${na ? `M${x} ${y - 2.4}v4.8` : ''}" stroke="#fff" stroke-width="1.3"/>`;
      const grain = (x, y, s) => `<path d="M${x - 14 * s} ${y}l${6 * s} ${-12 * s}l${14 * s} ${-2 * s}l${10 * s} ${9 * s}l${-4 * s} ${11 * s}l${-15 * s} ${4 * s}z" fill="#c9a56b" stroke="#8a6a3a"/>` + Array.from({ length: 6 }, () => `<rect x="${(x - 6 + rnd() * 14).toFixed(1)}" y="${(y - 8 + rnd() * 12).toFixed(1)}" width="1.6" height="1.6" fill="#7a5a30"/>`).join('');
      const box = (inner, cap) => `<figure><svg viewBox="0 0 160 110" role="img" aria-label="${esc(cap)}"><rect x="1" y="1" width="158" height="108" rx="6" fill="#f6f9fc" stroke="#9aa7b4"/>${inner}</svg><figcaption>${esc(cap)}</figcaption></figure>`;
      switch (kind) {
        case 'susp': return box(water(34, 10, 100) + grain(45, 60, 1) + grain(110, 92, 1.1), 'Suspension: Sandkörner (jeweils sehr viele Teilchen) zwischen Wasserteilchen');
        case 'sol': { let s = water(34, 10, 100); for (let i = 0; i < 6; i++) s += ion((20 + i * 24) | 0, (25 + (i % 3) * 28) | 0, true) + ion((30 + i * 22) | 0, (45 + (i % 2) * 34) | 0, false); return box(s, 'Lösung: einzelne Na⁺- und Cl⁻-Teilchen gleichmäßig verteilt'); }
        case 'cryst': { let s = ''; for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) s += ion(36 + x * 12, 32 + y * 12, (x + y) % 2 === 0); return box(s, 'Kristall: Na⁺ und Cl⁻ regelmäßig angeordnet (fest)'); }
        case 'emul': { let s = water(40, 10, 100); for (const [cx, cy] of [[40, 40], [100, 30], [70, 75], [125, 80]]) for (let k = 0; k < 7; k++) s += `<ellipse cx="${(cx + Math.cos(k) * (k ? 7 : 0)).toFixed(1)}" cy="${(cy + Math.sin(k) * (k ? 6 : 0)).toFixed(1)}" rx="4.5" ry="2.2" fill="#d9a514"/>`; return box(s, 'Emulsion: Öltröpfchen (viele Ölteilchen) im Wasser'); }
        case 'layers': { let s = '<rect x="2" y="2" width="156" height="44" fill="#fbf0c8"/>'; for (let i = 0; i < 26; i++) s += `<ellipse cx="${(10 + rnd() * 140).toFixed(1)}" cy="${(8 + rnd() * 34).toFixed(1)}" rx="4.5" ry="2.2" fill="#d9a514"/>`; s += water(28, 54, 102); return box(s, 'Zwei Schichten: Öl oben, Wasser unten'); }
        default: return '';
      }
    }
    function notebookHtml() {
      const qs = quizState();
      if (!allDone() || !qs.all) {
        const items = N.filter((n) => !complete(n)).map((n) => `Versuch ${n}: ${esc(M.EXPERIMENTS[n].short)}`);
        if (!qs.all) items.push('Kontrolle vollständig richtig beantworten');
        return lockedHtml('Der Hefteintrag ist der letzte Schritt.', items);
      }
      const NB = T.NOTEBOOK;
      let h = `<div class="lk-notebook nb"><h2>${esc(NB.title)}</h2><p class="lk-muted">Schreibe den Hefteintrag in dein Heft. Deine eigenen Beobachtungen findest du zum Vergleich bei jedem Versuch.</p>`;
      h += '<h3>1. Reinstoff und Stoffgemisch</h3>' + NB.intro.map((x) => `<p>${md(x)}</p>`).join('');
      h += `<table><thead><tr><th>Gemischart</th><th></th><th>Aufbau</th><th>Beispiel</th></tr></thead><tbody>${NB.kinds.map((k) => `<tr><td><b>${esc(k[0])}</b></td><td>${esc(k[1])}</td><td>${esc(k[2])}</td><td>${esc(k[3])}</td></tr>`).join('')}</tbody></table>`;
      h += '<h3>2. Die Versuche</h3>';
      for (const c of NB.cards) {
        const note = notes[c.n];
        const own = [note.obs, ...note.snaps.map((x) => x.obs)].filter((x) => x && x.trim()).map((x) => x.trim());
        const uniq = [...new Set(own)];
        h += `<div class="vcard"><h4>Versuch ${c.n}: ${esc(c.title)}</h4><dl>
          <dt>Ausgangsgemisch</dt><dd>${md(c.mix)}</dd><dt>Stoffebene</dt><dd>${md(c.stoff)}</dd><dt>Teilchenebene</dt><dd>${md(c.teilchen)}</dd>
          <dt>Aggregatzustände</dt><dd>${md(c.zustand)}</dd><dt>Trennprinzip</dt><dd>${md(c.prinzip)}</dd><dt>Ergebnis</dt><dd>${md(c.result)}</dd></dl>
          ${uniq.length ? `<details class="own"><summary>Deine Beobachtungen</summary>${uniq.map((x) => `<p>${esc(x)}</p>`).join('')}</details>` : ''}</div>`;
      }
      h += '<h3>3. Trennkette Eisen – Sand – Kochsalz</h3><ol class="chain">' + NB.chain.map(([a, b, c2]) => `<li><b>${esc(a)}:</b> ${esc(b)} → <i>${esc(c2)}</i></li>`).join('') + '</ol>';
      h += `<h3>4. Teilchenbilder</h3><div class="figs">${svgFig('susp')}${svgFig('sol')}${svgFig('cryst')}${svgFig('emul')}${svgFig('layers')}</div>`;
      h += '<h3>5. Merke</h3>' + NB.merke.map((x) => `<p class="merke">${md(x)}</p>`).join('');
      return h + '</div>';
    }

    // ------------------------------------------------------------------ Ereignisse Bedienfeld
    function snapState() {
      const s = st();
      const ev = eng().evaluate();
      const vs = s.order.map((i) => s.objs[i]).filter((o) => o.c && o.type !== 'magnet' && !M.isEmpty(o.c)).slice(0, 4);
      return vs.map((o) => `${o.name}: ${M.describe(o).text}`).join('; ') + ` (${ev.criteria.filter((c) => c.ok).length}/${ev.criteria.length} Ziele)`;
    }
    $('#panelBody').addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.f === 'obs' || t.dataset.f === 'expl') { notes[ui.cur][t.dataset.f] = t.value; if (t.value.trim()) notes[ui.cur].missing = (notes[ui.cur].missing || []).filter((x) => x !== 'obs'); save(); }
      if (t.dataset.gap) {
        quiz.gaps[t.dataset.gap] = t.value;
        // geänderte Lücke verliert ihre alte Markierung (ohne Neuzeichnen – der Fokus bleibt, wo er ist)
        if (t.classList.contains('right') || t.classList.contains('wrong')) { t.classList.remove('right', 'wrong'); const fb = t.nextElementSibling; if (fb && fb.classList.contains('gfb')) fb.remove(); }
        save();
      }
    });
    $('#panelBody').addEventListener('change', (ev) => {
      const t = ev.target, note = notes[ui.cur];
      if (t.name === 'hom') { note.cls.hom = t.value; renderPanel(); }
      else if (t.dataset.f === 'kind') { note.cls.kind = t.value; renderPanel(); }
      else if (t.name === 'prin') { note.prin = [...document.querySelectorAll('input[name="prin"]:checked')].map((x) => x.value); renderPanel(); }
      else if (/^q\d+$/.test(t.name)) { quiz.answers[t.name] = [...document.querySelectorAll(`input[name="${t.name}"]:checked`)].map((x) => Number(x.value)); renderPanel(); }
      else if (t.dataset.gap) { quiz.gaps[t.dataset.gap] = t.value; }
      save();
    });
    $('#panelBody').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-a]');
      if (!b) return;
      const n = ui.cur, note = notes[n];
      switch (b.dataset.a) {
        case 'go': switchExp(Number(b.dataset.n)); return;
        case 'tab': setTab(b.dataset.t); return;
        case 'check': {
          const ev2 = eng().evaluate();
          note.checked = true;
          if (ev2.done) markGoal(n); else note.fails++;
          break;
        }
        case 'tip': note.tip = Math.min(3, note.tip + 1); break;
        case 'solution': if (!note.solution) note.confirmSolution = true; break;
        case 'solYes': note.solution = true; note.confirmSolution = false; break;
        case 'solNo': note.confirmSolution = false; break;
        case 'sample': note.sample = !note.sample; break;
        case 'snap': {
          const text = note.obs.trim(), expl = note.expl.trim();
          if (!text && !expl) { showMsg('Die beiden Felder sind noch leer – es gibt nichts zu speichern.', 'warn'); break; }
          note.snaps.push({ t: +st().t.toFixed(1), ansatz: note.ansatz, state: snapState(), obs: text, expl });
          showMsg(`Zwischenstand gespeichert (Versuchszeit ${core.fmtTime(st().t)}). Der Versuch läuft weiter.`, 'ok');
          break;
        }
        case 'grade': {
          note.graded = true;
          const miss = [];
          if (!note.cls.hom || !note.cls.kind) miss.push('cls');
          if (!note.prin.length) miss.push('prin');
          note.missing = miss;
          if (!complete(n)) note.fails++;
          else showMsg(`Versuch ${n} ist abgeschlossen.`, 'ok');
          break;
        }
        case 'qcheck': quiz.graded = true; if (!quizState().all) quiz.fails++; else showMsg('Kontrolle vollständig richtig – der Hefteintrag ist freigeschaltet.', 'ok'); break;
        case 'qtip': quiz.tip = Math.min(3, quiz.tip + 1); break;
        case 'qsol': if (!quiz.solution) quiz.confirmSolution = true; break;
        case 'qsolYes': quiz.solution = true; quiz.confirmSolution = false; break;
        case 'qsolNo': quiz.confirmSolution = false; break;
        case 'bank': quiz.bank = !quiz.bank; break;
      }
      renderPanel();
      save();
    });
    function markGoal(n) {
      const note = notes[n];
      if (note.goalAt) return;
      note.goalAt = { t: +engine(n).state.t.toFixed(1), ansatz: note.ansatz };
      if (ui.cur === n) showMsg('Trennziel erreicht! Notiere deine Beobachtungen und vervollständige das Protokoll.', 'ok');
    }
    function setTab(t) { ui.tab = t; renderPanel(); save(); }
    for (const b of document.querySelectorAll('.lk-tabs button')) b.addEventListener('click', () => setTab(b.dataset.tab));

    function switchExp(n) {
      if (!M.EXPERIMENTS[n]) return;
      ui.cur = n; ui.selected = null; confirmRestart = false;
      ui.tab = 'exp';
      engine(n);
      renderer.fit();
      layoutDirty = true;
      setTaskLine(); defaultMsg(); refreshDeck(); renderPanel(); describeCanvas(); updatePview();
      save();
    }

    // ------------------------------------------------------------------ Kopfzeile und Bedienleiste
    $('#speed').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-speed]'); if (!b) return; ui.speed = Number(b.dataset.speed); refreshDeck(); save(); });
    $('#btnParticles').addEventListener('click', () => { ui.particles = !ui.particles; applyViews(); save(); });
    $('#btnNames').addEventListener('click', () => { ui.names = !ui.names; applyViews(); save(); });
    $('#btnPanel').addEventListener('click', () => { ui.panel = !ui.panel; $('#main').classList.toggle('panel-hidden', !ui.panel); $('#btnPanel').setAttribute('aria-expanded', String(ui.panel)); relayout(); save(); });
    $('#btnRestart').addEventListener('click', () => {
      confirmRestart = true;
      clearTimeout(msgTimer);
      const el = $('#hintMsg');
      el.className = 'hint-msg confirm';
      el.innerHTML = `<span>Versuch ${ui.cur} neu beginnen? Nur dieser Ansatz wird zurückgesetzt; deine Notizen und die anderen Versuche bleiben erhalten.</span><button type="button" class="lk-btn small primary" id="rsYes">Neu beginnen</button><button type="button" class="lk-btn small" id="rsNo">Abbrechen</button>`;
      $('#rsYes').addEventListener('click', () => {
        const n = ui.cur;
        engines[n] = M.createEngine(n); wire(engines[n], n);
        notes[n].ansatz++; notes[n].checked = null;
        confirmRestart = false; ui.selected = null;
        layoutDirty = true; renderer.fit();
        showMsg(`Neuer Ansatz für Versuch ${n}. Deine Notizen und Zwischenstände sind erhalten.`, 'ok');
        refreshDeck(); renderPanel(); saveNow();
      });
      $('#rsNo').addEventListener('click', () => { confirmRestart = false; defaultMsg(); });
      $('#rsYes').focus();
    });
    $('#deckSel').addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.cmd === 'deselect') { deselect(); defaultMsg(); return; }
      if (b.dataset.pick) { tap(b.dataset.pick); return; }
      if (b.dataset.target) tap(b.dataset.target);
    });
    $('#pourSpeed').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) act('setPourSpeed', b.dataset.v); });
    $('#btnStopPour').addEventListener('click', () => act('stopPour'));
    $('#washAmt').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) act('setWashAmount', Number(b.dataset.v)); });
    $('#heatLevel').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) act('heat', Number(b.dataset.v)); });
    $('#btnStopper').addEventListener('click', () => act('stopper', !st().objs.S.stopper));
    $('#btnShake').addEventListener('click', () => act('shake'));
    $('#cock').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) act('setCock', Number(b.dataset.v)); });
    $('#pSelect').addEventListener('change', (ev) => { ui.pFocus[ui.cur] = ev.target.value; save(); });

    // Trefferflächen: Antippen, Tastatur (Buttons), zusätzlich Ziehen
    let drag = null;
    $('#hits').addEventListener('click', (ev) => { const b = ev.target.closest('.hit'); if (!b) return; if (drag && drag.done) { drag = null; return; } tap(b.dataset.hit); });
    $('#hits').addEventListener('pointerdown', (ev) => { const b = ev.target.closest('.hit.obj'); drag = b ? { id: b.dataset.hit, x: ev.clientX, y: ev.clientY, done: false } : null; });
    $('#hits').addEventListener('pointerup', (ev) => {
      if (!drag) return;
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 24) { drag = null; return; }
      const els = document.elementsFromPoint(ev.clientX, ev.clientY);
      const tgt = els.find((el) => el.classList && el.classList.contains('hit') && el.dataset.hit !== drag.id);
      if (tgt) { if (ui.selected !== drag.id) { ui.selected = null; tap(drag.id); } tap(tgt.dataset.hit); }
      drag.done = true;
    });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ui.selected) { deselect(); defaultMsg(); } });

    // ------------------------------------------------------------------ Ansicht
    function applyViews() {
      $('#pview').hidden = !ui.particles;
      $('#scene').classList.toggle('with-p', ui.particles);
      $('#names').hidden = !ui.names;
      refreshDeck();
      relayout();
    }
    function relayout() { renderer.resize(); pview.resize(); layoutDirty = true; placeHits(); }
    function describeCanvas() {
      const s = st();
      $('#lab').setAttribute('aria-label', `Laborbühne Versuch ${ui.cur}: ${s.order.map((i) => s.objs[i]).map((o) => o.name).join(', ')}. Die Geräte sind darüber als Schaltflächen bedienbar.`);
    }
    const ro = root.ResizeObserver ? new ResizeObserver(() => relayout()) : null;
    if (ro) { ro.observe($('#canvasWrap')); ro.observe($('#pview')); } else root.addEventListener('resize', relayout);
    splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex-trennverfahren-panel', onChange: relayout, minStage: 560 });

    // ------------------------------------------------------------------ Takt
    let lastT = null, tick = 0, prevSel = null;
    function loop(now) {
      if (lastT == null) lastT = now;
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const e = eng();
      const capped = ui.speed > 1 && e.handBusy();
      const eff = capped ? 1 : ui.speed;
      if (eff > 0) e.advance(dt * eff);
      renderer.frame(dt, eff > 0, eff);
      if (ui.particles) pview.frame(dt, eff > 0);
      const clock = $('#clock');
      clock.textContent = core.fmtTime(e.state.t);
      clock.className = 'clock' + (ui.speed === 0 ? ' paused' : capped ? ' capped' : '');
      clock.title = capped ? 'Während eines Handgriffs läuft die Zeit höchstens in Echtzeit.' : 'Versuchszeit (Modellzeit)';
      tick += dt;
      const op = e.state.op;
      if (layoutDirty || (op && (op.type === 'move'))) placeHits();
      if (tick > 0.25) {
        tick = 0;
        refreshDeck();
        if ($('#tempRead') && e.state.plate) { const d = e.state.objs.D; $('#tempRead').textContent = d ? `${fmt(d.temp, 0)} °C` : ''; }
        if (!notes[ui.cur].goalAt && e.evaluate().done) { markGoal(ui.cur); if (ui.tab === 'exp') renderPanel(); }
        updatePview();
        if (prevSel !== ui.selected) { prevSel = ui.selected; placeNames(); }
        for (const el of document.querySelectorAll('#hits .hit.obj')) { const o = e.state.objs[el.dataset.hit]; if (o) el.setAttribute('aria-label', describeObj(o)); }
        save();
      }
      root.requestAnimationFrame(loop);
    }

    // ------------------------------------------------------------------ Start
    $('#main').classList.toggle('panel-hidden', !ui.panel);
    $('#btnPanel').setAttribute('aria-expanded', String(ui.panel));
    engine(ui.cur);
    setTaskLine(); defaultMsg(); describeCanvas();
    applyViews();
    renderPanel();
    root.requestAnimationFrame(loop);

    return {
      ui, notes, quiz, engines, renderer, pview,
      get engine() { return eng(); },
      tap, switchExp, renderPanel, placeHits, saveNow, complete, allDone, quizState
    };
  }

  (root.TV = root.TV || {}).ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
