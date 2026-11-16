/*
 * Fällungslabor – Start, Bühne und Bedienleiste
 *
 * Verbindet Modell (model.js), Renderer (render.js) und Bedienfeld (ui.js):
 *  - unsichtbare HTML-Schaltflächen über Flaschen und Reagenzgläsern (Tab, Enter/Leertaste, ≥ 44 px)
 *  - Pipette: Antippen = 1 Tropfen, Halten = begrenzte Tropfenfolge; Ende bei pointerup,
 *    pointercancel, Verlust der Zeigererfassung, Fokusverlust und verborgenem Tab. Kein Vorgang
 *    wird doppelt durch Touch- und Maus-/Klickereignisse ausgelöst (nur Pointer-Ereignisse, Klick
 *    nur für Tastatur/Hilfsmittel ohne Zeiger).
 *  - Pipette ziehen (optional): auf ein Glas = Ziel wählen, auf eine Vorratsflasche = abgewiesen.
 *  - Sitzungsstand in sessionStorage (Neuladen behält den Versuch, Labkit-Regel), Darstellung
 *    (Hintergrund, Breite des Bedienfelds) in localStorage; Speicherfehler werden abgefangen.
 */
(function (root) {
  'use strict';
  const FL = root.FL, C = FL.chem, G = FL.geometry, M = FL.model, GHS = FL.ghs, LK = root.LK;
  const VERSION = '1.0.0';
  const KEY = 'sivex.faellungslabor.session.v1';
  const PREF = 'sivex.faellungslabor.prefs';
  const $ = (id) => document.getElementById(id);
  const esc = LK.learn.esc;

  // ---------------------------------------------------------------- Speicher (fehlertolerant)
  const store = {
    get(area, k) { try { const s = root[area].getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    set(area, k, v) { try { root[area].setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(area, k) { try { root[area].removeItem(k); } catch (e) { /* ohne Speicher */ } }
  };
  const saved = store.get('sessionStorage', KEY);
  const prefs = Object.assign({ theme: 'dark' }, store.get('localStorage', PREF) || {});

  const lab = M.create(saved && saved.lab);
  const canvas = $('lab');
  const renderer = new FL.LabRenderer(canvas, lab);
  const reduce = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  renderer.reduceMotion = !!(reduce && reduce.matches);
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', (e) => { renderer.reduceMotion = e.matches; document.body.classList.toggle('reduce-motion', e.matches); });
  document.body.classList.toggle('reduce-motion', renderer.reduceMotion);

  let dirty = false;
  function save() { dirty = true; }
  function flush() {
    if (!dirty) return;
    dirty = false;
    store.set('sessionStorage', KEY, { v: 1, version: VERSION, lab: lab.snapshot(), ui: ui.state });
  }

  // ---------------------------------------------------------------- Meldungen
  const toastEl = $('toast');
  let toastTimer = null;
  function toast(text, ms) {
    toastEl.textContent = text; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 3200);
  }
  const forbidEl = $('forbid');
  let forbidTimer = null;
  function showForbidden(e) {
    $('forbidText').textContent = e.text;
    $('forbidReason').textContent = e.reason ? ' ' + e.reason : '';
    const p = renderer.toScreen(e.x, e.y);
    const wrap = $('canvasWrap').getBoundingClientRect();
    forbidEl.hidden = false;
    const bw = forbidEl.offsetWidth, bh = forbidEl.offsetHeight;
    forbidEl.style.left = Math.max(6, Math.min(wrap.width - bw - 6, p.x - 22)) + 'px';
    forbidEl.style.top = Math.max(6, Math.min(wrap.height - bh - 6, p.y - bh - 18)) + 'px';
    forbidEl.classList.remove('wiggle'); void forbidEl.offsetWidth;
    if (!renderer.reduceMotion) forbidEl.classList.add('wiggle');
    clearTimeout(forbidTimer); forbidTimer = setTimeout(() => { forbidEl.hidden = true; }, 3000);
  }

  // ---------------------------------------------------------------- Bedienfeld
  const ui = FL.ui.create({ lab, saved: saved && saved.ui, save, toast, resetAll });
  $('ver').textContent = VERSION;

  function resetAll() {
    store.del('sessionStorage', KEY);
    const fresh = M.create();
    Object.assign(lab.state, fresh.state, { worldW: lab.state.worldW, events: [] });
    // Zustand des Bedienfelds frisch, Darstellung (Hintergrund, Breite) bleibt
    const f = FL.ui.freshState();
    for (const k of Object.keys(ui.state)) delete ui.state[k];
    Object.assign(ui.state, f);
    renderer.fx = {}; renderer._key = null; renderer.bg = null;
    syncPart(); ui.render(); save(); flush();
    toast('Alles zurückgesetzt – beide Versuchsteile beginnen neu.');
  }

  // ---------------------------------------------------------------- Hintergrund hell/dunkel
  function applyTheme(t) {
    prefs.theme = t === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', prefs.theme);
    renderer.setTheme(prefs.theme);
    const b = $('btnTheme');
    b.textContent = prefs.theme === 'dark' ? 'Hintergrund: dunkel' : 'Hintergrund: hell';
    b.setAttribute('aria-pressed', String(prefs.theme === 'light'));
    store.set('localStorage', PREF, prefs);
  }
  $('btnTheme').addEventListener('click', () => applyTheme(prefs.theme === 'dark' ? 'light' : 'dark'));
  applyTheme(prefs.theme);

  // ---------------------------------------------------------------- Kopfzeile
  function syncPart() {
    document.querySelectorAll('#parts [data-part]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.part === lab.state.tab)));
    document.body.dataset.part = lab.state.tab;
    hitsKey = ''; labelsKey = ''; deckSig = '';
  }
  $('parts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-part]');
    if (!b) return;
    if (lab.setTab(b.dataset.part)) { syncPart(); ui.render(); save(); }
  });
  $('parts').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const id = lab.state.tab === 'main' ? 'control' : 'main';
    if (lab.setTab(id)) { syncPart(); ui.render(); save(); $('part-' + id).focus(); }
  });
  $('btnNotebook').addEventListener('click', () => ui.openNotebook());
  $('btnPanel').addEventListener('click', () => {
    const m = $('main');
    const hidden = m.classList.toggle('panel-hidden');
    $('btnPanel').setAttribute('aria-expanded', String(!hidden));
    renderer._key = null;
  });
  LK.splitter.bindSplitter({ splitter: $('splitter'), container: $('main'), panel: $('panel'), storageKey: 'sivex.faellungslabor.panel', onChange: () => { renderer._key = null; } });

  // ---------------------------------------------------------------- Treffflächen und Etiketten
  const hits = $('hits'), labels = $('labels');
  let hitsKey = '', labelsKey = '';
  const solName = (k) => C.SOLUTIONS[k].name;
  function tubeLabel(i) {
    const t = lab.tube(i);
    if (!(t.V > 0)) return `Reagenzglas ${i + 1}, leer`;
    return `Reagenzglas ${i + 1}, Ansatz ${t.ansatz}: ${ui.addsText(t)}, ${C.fmt(t.V, 2)} mL`;
  }
  function layoutHits() {
    const st = lab.state, tb = lab.tab(), keys = M.TABS[st.tab].bottles, v = renderer.view;
    const key = [st.tab, tb.visible, v.scale, v.ox, v.oy, v.worldW, st.pip.key, st.pip.tab, st.pip.phase, st.pip.phase === 'over' ? st.pip.over : '', Math.round(st.pip.x)].join('|');
    if (key === hitsKey) return;
    hitsKey = key;
    let html = '';
    keys.forEach((k) => {
      const x = lab.bottlePos(k);
      const a = renderer.toScreen(x - G.BOTTLE.w / 2 - 4, G.SHELF_Y - G.BOTTLE.h - G.BOTTLE.neckH - G.PIPETTE_LEN);
      const b = renderer.toScreen(x + G.BOTTLE.w / 2 + 4, G.SHELF_Y);
      const w = Math.max(44, b.x - a.x), h = Math.max(44, b.y - a.y);
      const held = st.pip.key === k && st.pip.tab === st.tab;
      html += `<button type="button" class="hit bottle" data-bottle="${k}" aria-pressed="${held}" aria-label="${esc((held ? 'Pipette zurückstellen: ' : 'Pipette aufnehmen: ') + solName(k))}" style="left:${(a.x + b.x) / 2 - w / 2}px;top:${b.y - h}px;width:${w}px;height:${h}px"></button>`;
    });
    for (let i = 0; i < tb.visible; i++) {
      const x = lab.tubePos(i);
      const a = renderer.toScreen(x - G.TUBE_R - 14, G.RIM_Y - 14);
      const b = renderer.toScreen(x + G.TUBE_R + 14, G.INNER_BOTTOM + 14);
      const w = Math.max(44, b.x - a.x), h = Math.max(44, b.y - a.y);
      html += `<button type="button" class="hit tube" data-slot="${i}" aria-label="${esc(tubeLabel(i))}" style="left:${(a.x + b.x) / 2 - w / 2}px;top:${a.y}px;width:${w}px;height:${h}px"></button>`;
    }
    const p = st.pip;
    if (p.key && p.tab === st.tab && (p.phase === 'held' || p.phase === 'over')) {
      const a = renderer.toScreen(p.x - 16, p.y - G.PIPETTE_LEN - 40), b = renderer.toScreen(p.x + 16, p.y - 30);
      const w = Math.max(44, b.x - a.x), h = Math.max(60, b.y - a.y);
      html += `<button type="button" class="hit pip" aria-label="${esc('Pipette der ' + solName(p.key) + ' zurückstellen (oder ziehen)')}" style="left:${(a.x + b.x) / 2 - w / 2}px;top:${a.y}px;width:${w}px;height:${h}px"></button>`;
    }
    hits.innerHTML = html;
  }
  function updateTubeAria() {
    hits.querySelectorAll('.hit.tube').forEach((b) => { const l = tubeLabel(+b.dataset.slot); if (b.getAttribute('aria-label') !== l) b.setAttribute('aria-label', l); b.setAttribute('aria-pressed', String(lab.tab().sel === +b.dataset.slot)); });
  }
  function layoutLabels() {
    const st = lab.state, tb = lab.tab(), keys = M.TABS[st.tab].bottles, v = renderer.view;
    const texts = [];
    for (let i = 0; i < tb.visible; i++) { const t = tb.tubes[i]; texts.push(t.ansatz || '', t.sample || '', t.V.toFixed(3), t.log.agDrops, t.log.nh3dilV.toFixed(2), t.log.nh3concV.toFixed(2), t.log.waterV.toFixed(2)); }
    const key = [st.tab, tb.visible, v.scale, v.ox, v.oy, v.w, v.h].join('|') + '#' + texts.join(',');
    if (key === labelsKey) return;
    labelsKey = key;
    let html = '';
    const bw = Math.max(44, G.bottleGap(keys.length, v.worldW) * v.scale - 8);
    keys.forEach((k) => {
      // Etikett ist auf die Bühne gezeichnet; hier nur die bedienbare, unsichtbare Fläche (Infokarte)
      const s = C.SOLUTIONS[k];
      const p = renderer.toScreen(lab.bottlePos(k), G.SHELF_Y + 18);
      html += `<button type="button" class="blabel" data-info="${k}" style="left:${p.x - bw / 2}px;top:${p.y - 4}px;width:${bw}px;height:${Math.max(44, 42)}px" aria-label="${esc('Informationen und Gefahrstoffkennzeichnung: ' + s.name + ', ' + FL.render.shelfText(k).join(' '))}"></button>`;
    });
    for (let i = 0; i < tb.visible; i++) {
      const t = tb.tubes[i];
      const p = renderer.toScreen(lab.tubePos(i), G.BENCH);
      const w = Math.max(96, G.TUBE_GAP * v.scale - 4);
      let inner;
      if (!(t.V > 0)) inner = `<b>Glas ${i + 1}</b><span class="lk-muted">leer</span>`;
      else {
        const s = C.SOLUTIONS[t.sample];
        const extra = [];
        if (t.log.agDrops) extra.push(`AgNO₃ ${t.log.agDrops}\u00a0Tr.`);
        if (t.log.nh3dilV) extra.push(`NH₃\u00a0verd. ${C.fmt(t.log.nh3dilV, 2)}\u00a0mL`);
        if (t.log.nh3concV) extra.push(`NH₃\u00a0konz. ${C.fmt(t.log.nh3concV, 2)}\u00a0mL`);
        if (t.log.waterV) extra.push(`H₂O ${C.fmt(t.log.waterV, 2)}\u00a0mL`);
        inner = `<b>Glas ${i + 1} · ${esc(t.ansatz)}</b><span>${esc(s.short || s.name)}</span><span>${C.fmt(t.V, 2)}\u00a0mL gesamt</span><span class="adds">${esc(extra.join(' · ') || 'ohne Zugabe')}</span>`;
      }
      html += `<div class="tlabel${tb.sel === i ? ' sel' : ''}" style="left:${p.x - w / 2}px;top:${p.y + 3}px;width:${w}px">${inner}</div>`;
    }
    labels.innerHTML = html;
  }
  labels.addEventListener('click', (e) => { const b = e.target.closest('[data-info]'); if (b) ui.ghsCard(b.dataset.info); });

  // ---------------------------------------------------------------- Eingaben an Flaschen und Gläsern
  let lastKeyAct = 0;
  const dropMode = (slot) => { const p = lab.state.pip; return lab.ready() && p.over === slot && !M.TABS[lab.state.tab].samples.includes(p.key); };
  function tubeAct(slot, hold) {
    if (dropMode(slot)) { if (hold) lab.startHold(); else lab.dropOnce(); }
    else {
      const r = lab.target(slot);
      if (r === 'select') { lab.tab().sel = slot; save(); }
    }
    save();
  }
  hits.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.hit');
    if (!b || e.button > 0) return;
    if (b.dataset.slot != null) {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* ohne Erfassung */ }
      tubeAct(+b.dataset.slot, true);
    }
  });
  const endHold = () => { lab.stopHold(); };
  hits.addEventListener('pointerup', endHold);
  hits.addEventListener('pointercancel', endHold);
  hits.addEventListener('lostpointercapture', endHold);
  hits.addEventListener('click', (e) => {
    const b = e.target.closest('.hit');
    if (!b) return;
    if (b.dataset.bottle) { lab.selectBottle(b.dataset.bottle); save(); return; }
    if (b.classList.contains('pip')) { if (e.detail === 0) { lab.returnPipette(); save(); } return; }
    // Gläser reagieren auf pointerdown; ein Klick ohne Zeiger (Hilfsmittel) gilt als Antippen
    if (b.dataset.slot != null && e.detail === 0 && Date.now() - lastKeyAct > 400) tubeAct(+b.dataset.slot, false);
  });
  hits.addEventListener('keydown', (e) => {
    const b = e.target.closest('.hit.tube');
    if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    lastKeyAct = Date.now();
    if (!e.repeat) tubeAct(+b.dataset.slot, true);
  });
  hits.addEventListener('keyup', (e) => { if (e.target.closest('.hit.tube') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); lastKeyAct = Date.now(); endHold(); } });

  // Pipette ziehen (zusätzliche Bedienart; Tippen genügt immer). Antippen der Pipette stellt sie zurück.
  let drag = null;
  function dropTarget(px, py) {
    const r = $('canvasWrap').getBoundingClientRect();
    const w = renderer.toWorld(px - r.left, py - r.top);
    const tb = lab.tab();
    for (let i = 0; i < tb.visible; i++) if (Math.abs(w.x - lab.tubePos(i)) < G.TUBE_R + 26 && w.y > G.RIM_Y - 120 && w.y < G.BENCH) return { slot: i, w };
    for (const k of M.TABS[lab.state.tab].bottles) if (Math.abs(w.x - lab.bottlePos(k)) < G.BOTTLE.w / 2 + 12 && w.y > G.SHELF_Y - G.BOTTLE.h - 80 && w.y < G.SHELF_Y + 12) return { bottle: k, w };
    return { w };
  }
  hits.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.hit.pip');
    if (!b || e.button > 0) return;
    e.preventDefault();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* */ }
  });
  hits.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) drag.moved = true;
    if (drag.moved) renderer.ghost = dropTarget(e.clientX, e.clientY).w;
  });
  hits.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; renderer.ghost = null;
    if (!d.moved) { lab.returnPipette(); save(); return; }
    const t = dropTarget(e.clientX, e.clientY);
    if (t.slot != null) { if (dropMode(t.slot)) lab.dropOnce(); else lab.target(t.slot); save(); }
    else if (t.bottle) lab.toBottle(t.bottle);
  });
  hits.addEventListener('pointercancel', () => { drag = null; renderer.ghost = null; });

  // Fokusverlust, verborgener Tab, Verlassen: keine Dosierung im Hintergrund
  root.addEventListener('blur', () => { lab.cancelAll(); save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { lab.cancelAll(); save(); flush(); } });
  root.addEventListener('pagehide', () => { lab.cancelAll(); save(); flush(); });
  document.addEventListener('pointerup', endHold, true);
  document.addEventListener('pointercancel', endHold, true);

  // ---------------------------------------------------------------- Bedienleiste
  const doseRow = $('doseRow'), hint = $('deckHint');
  let deckSig = '';
  function deckState() {
    const st = lab.state, p = st.pip, tb = lab.tab();
    const own = p.key && p.tab === st.tab;
    const sample = own && M.TABS[st.tab].samples.includes(p.key);
    return { own, sample, key: own ? p.key : null, over: own && p.phase === 'over' ? p.over : null, phase: own ? p.phase : 'rest', sel: tb.sel, tab: st.tab, vol: st.sampleVol[st.tab] };
  }
  function renderDeck() {
    const d = deckState();
    const sig = JSON.stringify([d.tab, d.key, d.over, d.sample, d.phase === 'over' || d.phase === 'held' ? 'r' : d.phase, d.vol]);
    if (sig === deckSig) return;
    deckSig = sig;
    let html = '', h = '';
    if (!d.key) {
      html = '<span class="who">Keine Pipette in der Hand.</span>';
      h = 'Tippe eine Flasche an, um ihre Pipette aufzunehmen. Das Etikett darunter zeigt Gefahrstoffhinweise.';
    } else {
      const name = solName(d.key), short = d.key === 'tap' ? 'Leitungswasser' : d.key === 'mineral' ? 'Mineralwasser' : FL.render.shelfText(d.key)[0];
      html = `<span class="who" title="${esc('Pipette: ' + name)}"><span class="bulb" style="background:${FL.render.BULB[d.key]}"></span><span>Pipette <b>${esc(short)}</b>${d.over != null ? ` → Glas ${d.over + 1}` : ''}</span></span>`;
      if (d.sample) h = `Tippe ein leeres Reagenzglas an – die Pipette gibt ${d.vol} mL Probe ab.`;
      else if (d.over == null) h = 'Tippe das Reagenzglas an, in das du zugeben möchtest.';
      else {
        html += '<button type="button" class="lk-btn primary dropbtn" id="btnDrop" title="Antippen: 1 Tropfen · Gedrückt halten: mehrere Tropfen nacheinander">Tropfen</button>';
        html += '<button type="button" class="lk-btn small" data-dose="n5">5 Tropfen</button>';
        if (d.key !== 'agno3') html += '<button type="button" class="lk-btn small" data-dose="0.5">0,5 mL</button><button type="button" class="lk-btn small" data-dose="1">1,0 mL</button>';
        h = d.key === 'agno3' ? 'Tropfen antippen = 1 Tropfen, gedrückt halten = mehrere. Du kannst auch das Glas selbst antippen.' : 'Für größere Mengen die Dosierhilfe 0,5 mL / 1,0 mL nutzen. Danach schwenken.';
      }
      html += '<button type="button" class="lk-btn small" id="btnReturn">Pipette zurück</button>';
    }
    doseRow.innerHTML = html;
    hint.textContent = h;
    const drop = $('btnDrop');
    if (drop) {
      drop.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); try { drop.setPointerCapture(e.pointerId); } catch (err) { /* */ } lab.startHold(); save(); });
      drop.addEventListener('pointerup', endHold); drop.addEventListener('pointercancel', endHold); drop.addEventListener('lostpointercapture', endHold);
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lastKeyAct = Date.now(); if (!e.repeat) { lab.startHold(); save(); } } });
      drop.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lastKeyAct = Date.now(); endHold(); } });
      drop.addEventListener('click', (e) => { if (e.detail === 0 && Date.now() - lastKeyAct > 400) { lab.dropOnce(); save(); } });
    }
  }
  doseRow.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btnReturn') { lab.returnPipette(); save(); }
    else if (b.dataset.dose === 'n5') { lab.drops(5); save(); }
    else if (b.dataset.dose) { lab.dose(parseFloat(b.dataset.dose)); save(); }
  });
  $('vol').addEventListener('click', (e) => { const b = e.target.closest('[data-vol]'); if (b) { lab.setSampleVol(+b.dataset.vol); save(); } });
  $('speed').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (b) { lab.setSpeed(+b.dataset.speed); save(); } });
  $('btnShake').addEventListener('click', () => {
    const tb = lab.tab();
    if (tb.sel == null || !lab.shake(tb.sel)) toast(tb.sel == null ? 'Tippe zuerst ein Reagenzglas an.' : 'Das Reagenzglas ist leer.');
    save();
  });
  $('btnRinse').addEventListener('click', () => {
    const tb = lab.tab();
    if (tb.sel == null) { toast('Tippe zuerst ein Reagenzglas an.'); return; }
    const t = tb.tubes[tb.sel], id = t.ansatz;
    if (lab.rinse(tb.sel)) { toast(`Glas ${tb.sel + 1} gespült – Ansatz ${id} ist beendet und bleibt in der Ergebnisübersicht.`); save(); }
    else toast('Das Reagenzglas ist schon leer.');
  });
  $('btnAddTube').addEventListener('click', () => {
    if (lab.addTube()) { toast('Weiteres leeres Reagenzglas im Ständer.'); save(); }
    else toast('Der Ständer ist voll. Spüle ein Glas, um es neu zu verwenden.');
  });
  function syncControls() {
    const st = lab.state, tb = lab.tab();
    document.querySelectorAll('#speed [data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === st.speed)));
    document.querySelectorAll('#vol [data-vol]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.vol === st.sampleVol[st.tab])));
    const has = tb.sel != null && tb.tubes[tb.sel] && tb.tubes[tb.sel].V > 0;
    $('btnShake').disabled = !has; $('btnRinse').disabled = !has;
    $('btnShake').setAttribute('aria-label', tb.sel != null ? `Glas ${tb.sel + 1} schwenken` : 'Schwenken (zuerst ein Glas antippen)');
    $('btnRinse').setAttribute('aria-label', tb.sel != null ? `Glas ${tb.sel + 1} spülen` : 'Glas spülen (zuerst ein Glas antippen)');
    $('btnAddTube').disabled = tb.visible >= M.TABS[st.tab].maxTubes;
  }

  // ---------------------------------------------------------------- Hauptschleife
  let last = performance.now(), saveAt = 0;
  function loop(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    lab.step(dt);
    for (const e of lab.drain()) {
      if (e.type === 'land') { renderer.onLand(e); save(); }
      else if (e.type === 'forbidden') showForbidden(e);
      else if (e.type === 'full') toast(e.text);
      else if (e.type === 'toast') toast(e.text);
    }
    renderer.frame(dt);
    layoutHits(); updateTubeAria(); layoutLabels(); renderDeck(); syncControls(); ui.tick();
    if (now - saveAt > 1500) { saveAt = now; flush(); }
    root.requestAnimationFrame(loop);
  }

  syncPart();
  ui.render();
  root.requestAnimationFrame((t) => { last = t; loop(t); });

  // Zugriff für Tests (nur lesen) und Fehlersuche
  FL.app = { lab, renderer, ui, version: VERSION, toast, save, flush, resetAll, store, KEY };
})(typeof self !== 'undefined' ? self : this);
