/*
 * Aggregatzustände – Oberfläche (DOM)
 *
 * Verbindet Zustandsmodell, Teilchen-Engine, beide Renderer und das
 * Bedienfeld. Stoff- und Teilchenebene lesen denselben Modellzustand; der
 * Wechsel der Ansicht setzt nichts zurück. Texte und Bedienelemente liegen
 * nie über dem Bild (eigene Leisten unter dem Bild, Bedienfeld rechts).
 * Ablauf und Bezeichnungen nach shared/labkit/DESIGN.md (Abschnitt 6).
 */
(function (root) {
  'use strict';
  const { core, splitter } = root.LK;
  const S = root.AZ.substances, M = root.AZ.model, PS = root.AZ.particles, T = root.AZ.tasks;
  const { MatterRenderer } = root.AZ.renderMatter;
  const { ParticleRenderer, drawSymbol } = root.AZ.renderParticles;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const STORE = 'sivex-aggregatzustaende-v1';
  const deg = (v) => `${String(v).replace('-', '−')} °C`;
  const PHASES = [['S', 'fest'], ['L', 'flüssig'], ['G', 'gasförmig']];

  function freshStep() { return { answers: {}, graded: null, fails: 0, tip: 0, solution: false, confirmSolution: false }; }
  function freshSeen() { const o = {}; for (const id of S.ORDER) o[id] = { S: {}, L: {}, G: {} }; return o; }
  function initialUi() {
    return { level: 'matter', scheme: false, tab: 'task', step: 'observe', panel: true, steps: { observe: freshStep(), explain: freshStep(), transitions: freshStep() }, seen: freshSeen(), special: { sublimation: false, resublimation: false } };
  }

  function createUI() {
    let saved = null;
    try { saved = JSON.parse(root.sessionStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
    const model = M.createModel();
    if (saved && saved.model) model.restore(saved.model);
    const ui = Object.assign(initialUi(), saved && saved.ui ? saved.ui : {});
    let sys = null;
    const matterR = new MatterRenderer($('#matter'), model);
    const partR = new ParticleRenderer($('#particles'));
    const env = () => ({ shares: model.shares(), T: model.state.Tview, coldVis: model.state.coldVis });
    function newSystem() {
      sys = PS.createSystem(model.substance, 20261029);
      sys.init(env());
      partR.setSystem(sys);
    }
    newSystem();

    // ------------------------------------------------------------ Speichern
    let saveTimer = null;
    function saveNow() {
      clearTimeout(saveTimer);
      const st = model.state;
      try { root.sessionStorage.setItem(STORE, JSON.stringify({ model: { sub: st.sub, Tset: st.Tset, cold: st.cold, c: st.c }, ui })); } catch (e) { /* ohne Speicher */ }
    }
    function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
    root.addEventListener('pagehide', saveNow);
    root.addEventListener('beforeunload', saveNow);

    // ------------------------------------------------------------ Stoff, Ebene, kalte Oberfläche
    function setSubstance(id) {
      if (!S.SUBSTANCES[id] || id === model.state.sub) return;
      model.setSubstance(id);
      newSystem();
      syncControls();
      save();
    }
    function setLevel(lv) {
      ui.level = lv === 'particles' ? 'particles' : 'matter';
      syncControls();
      save();
    }
    $('#subs').addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (b) setSubstance(b.dataset.sub); });
    $('#levels').addEventListener('click', (e) => { const b = e.target.closest('[data-level]'); if (b) setLevel(b.dataset.level); });
    $('#btnCold').addEventListener('click', () => { model.setCold(!model.state.cold); syncControls(); save(); });
    $('#btnScheme').addEventListener('click', () => { ui.scheme = !ui.scheme; syncControls(); onResize(); save(); });

    // ------------------------------------------------------------ Temperaturregler
    // Der Regler arbeitet mit Positionen 0…1000; die Skala (bei Eisen und Kochsalz gestaucht) rechnet in °C um.
    const slider = $('#temp');
    const POS = 1000;
    const toPos = (T) => Math.round(S.tempToPos(model.substance, T) * POS);
    function showTemp() {
      const v = model.state.Tset;
      $('#tempOut').textContent = deg(v);
      slider.setAttribute('aria-valuetext', deg(v));
    }
    slider.addEventListener('input', () => { model.setTemp(S.posToTemp(model.substance, Number(slider.value) / POS)); showTemp(); save(); });
    // Tastatur immer in °C: Pfeile ±1 °C, Bild ↑/↓ bzw. Umschalt + Pfeil großer Schritt, Pos1/Ende Bereichsgrenzen
    slider.addEventListener('keydown', (e) => {
      const s = model.substance, T = model.state.Tset;
      const up = e.key === 'ArrowRight' || e.key === 'ArrowUp', down = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
      let n = null;
      if (e.key === 'PageUp') n = T + s.bigStep; else if (e.key === 'PageDown') n = T - s.bigStep;
      else if (up) n = T + (e.shiftKey ? s.bigStep : S.STEP); else if (down) n = T - (e.shiftKey ? s.bigStep : S.STEP);
      else if (e.key === 'Home') n = s.min; else if (e.key === 'End') n = s.max;
      if (n == null) return;
      e.preventDefault();
      slider.value = String(toPos(model.setTemp(n)));
      showTemp(); save();
    });
    /** Markierungen für Schmelz- und Siedetemperatur sowie die Bereichsenden. */
    function renderTicks() {
      const s = model.substance;
      const pos = (v) => S.tempToPos(s, v);
      const left = (p) => `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${p.toFixed(5)})`;
      const tick = (v, label, cls) => `<span class="tick ${cls || ''}" style="left:${left(pos(v))}">${label}</span>`;
      $('#ticks').innerHTML = [
        tick(s.min, `<b>${deg(s.min)}</b>`, 'end start'),
        tick(s.mp, `<span>Schmelztemperatur</span><b>${deg(s.mp)}</b>`),
        tick(s.bp, `<span>Siedetemperatur</span><b>${deg(s.bp)}</b>`),
        tick(s.max, `<b>${deg(s.max)}</b>`, 'end stop')
      ].join('');
      // End-Markierungen auf schmalen Reglern ausblenden, wenn sie mit einer Übergangsmarke kollidieren
      const w = $('#ticks').getBoundingClientRect().width;
      const ends = document.querySelectorAll('#ticks .tick.end');
      ends.forEach((t, i) => {
        const p = i ? pos(s.max) - pos(s.bp) : pos(s.mp) - pos(s.min);
        t.hidden = w > 0 && p * (w - 44) < 92;
      });
    }

    // ------------------------------------------------------------ Hinweisleiste unter dem Bild
    let infoSig = '';
    function renderInfo() {
      const s = model.substance;
      const sig = s.id + ui.level;
      if (sig === infoSig) return;
      infoSig = sig;
      const el = $('#infobar');
      if (ui.level === 'matter') {
        el.innerHTML = `<span><b>${esc(s.long || s.name)}</b> · Stoffebene</span><span class="note">Gasphase zur Veranschaulichung sichtbar dargestellt.</span>`;
      } else {
        const kinds = s.particle.kinds;
        const chips = s.particle.legend.map((l, i) => `<span class="sym"><canvas width="52" height="40" data-l="${i}" aria-hidden="true"></canvas><span>${esc(l.text)}</span></span>`).join('');
        el.innerHTML = `<span class="chips" aria-label="Legende">${chips}</span><span class="note">Teilchenebene: schematisch, nicht maßstabsgetreu; die Symbole sind keine Molekülstrukturen.</span>`;
        el.querySelectorAll('canvas').forEach((c) => {
          const ctx = c.getContext('2d');
          ctx.setTransform(2, 0, 0, 2, 0, 0);
          const l = s.particle.legend[Number(c.dataset.l)];
          if (l.pair) {
            // Ionenpaar: beide Kugeln berühren sich (Maßstab wie im Bild verkleinert)
            const a = kinds[0], b = kinds[1], k = 2.2;
            drawSymbol(ctx, b, 15, 10, 0, k);
            drawSymbol(ctx, a, 15 - (a.r + b.r) * k, 10, 0, k);
          } else {
            const k = kinds[l.k];
            drawSymbol(ctx, k, 13, 10, k.symbol === 'rect' ? -0.3 : 0, 3.2);
          }
        });
      }
    }

    function syncControls() {
      const s = model.substance, st = model.state;
      document.querySelectorAll('#subs [data-sub]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sub === s.id)));
      document.querySelectorAll('#levels [data-level]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === ui.level)));
      const cold = $('#btnCold');
      cold.hidden = !s.coldSurface;
      cold.setAttribute('aria-pressed', String(!!st.cold));
      cold.textContent = st.cold ? 'Kalte Oberfläche ausblenden' : 'Kalte Oberfläche einblenden';
      $('#btnScheme').setAttribute('aria-pressed', String(!!ui.scheme));
      $('#btnScheme').title = ui.scheme ? 'Schema der Phasenübergänge ausblenden' : 'Schema der Phasenübergänge neben dem Bild einblenden';
      $('#scheme').hidden = !ui.scheme;
      $('#viewrow').classList.toggle('with-scheme', !!ui.scheme);
      if (ui.scheme) renderScheme(true);
      $('#matter').hidden = ui.level !== 'matter';
      $('#particles').hidden = ui.level !== 'particles';
      slider.value = String(toPos(st.Tset));
      showTemp();
      renderTicks();
      renderInfo();
      describe(true);
      $('#btnPanel').setAttribute('aria-expanded', String(ui.panel));
      $('#main').classList.toggle('panel-hidden', !ui.panel);
      document.querySelectorAll('.lk-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
    }

    // ------------------------------------------------------------ Schema der Phasenübergänge (dynamisch)
    // Zustände färben sich nach ihrem Anteil, der gerade ablaufende Übergang wird hervorgehoben
    // und läuft als bewegter Pfeil; an Schmelz- bzw. Siedetemperatur laufen beide Richtungen.
    const SCH = { G: [170, 34], F: [62, 268], L: [278, 268] };
    const SCH_T = [['sl', 'F', 'L', 'Schmelzen'], ['ls', 'L', 'F', 'Erstarren'], ['lg', 'L', 'G', 'Verdampfen'], ['gl', 'G', 'L', 'Kondensieren'], ['sg', 'F', 'G', 'Sublimieren'], ['gs', 'G', 'F', 'Resublimieren']];
    const SCH_NAMES = { F: 'fest', L: 'flüssig', G: 'gasförmig' };
    function schemeSvg() {
      const hw = 56, hh = 20;
      const edge = (u) => Math.min(hw / Math.max(1e-6, Math.abs(u[0])), hh / Math.max(1e-6, Math.abs(u[1])));
      const arrows = SCH_T.map(([id, a, b, label]) => {
        const A = SCH[a], B = SCH[b];
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n = [-u[1], u[0]];
        const e = edge(u) + 4, off = -7;
        const x1 = A[0] + u[0] * e + n[0] * off, y1 = A[1] + u[1] * e + n[1] * off, x2 = B[0] - u[0] * e + n[0] * off, y2 = B[1] - u[1] * e + n[1] * off;
        let ang = Math.atan2(u[1], u[0]) * 180 / Math.PI;
        if (ang > 90 || ang < -90) ang += 180;
        const mx = (A[0] + B[0]) / 2 - n[0] * 22, my = (A[1] + B[1]) / 2 - n[1] * 22;
        return `<g class="arr" data-t="${id}"><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/><text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${ang.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})">${label}</text></g>`;
      }).join('');
      const boxes = Object.entries(SCH).map(([k, [x, y]]) => `<g class="box" data-s="${k}"><rect class="base" x="${x - hw}" y="${y - hh}" width="${2 * hw}" height="${2 * hh}" rx="8"/><rect class="fill" x="${x - hw}" y="${y - hh}" width="${2 * hw}" height="${2 * hh}" rx="8" opacity="0"/><rect class="frame" x="${x - hw}" y="${y - hh}" width="${2 * hw}" height="${2 * hh}" rx="8" fill="none"/><text x="${x}" y="${y + 6}" text-anchor="middle">${SCH_NAMES[k]}</text></g>`).join('');
      return `<h2>Phasenübergänge</h2><svg viewBox="0 0 340 300" role="img" aria-label="Schema: fest, flüssig, gasförmig und die sechs Übergänge; der laufende Übergang ist hervorgehoben"><defs><marker id="sah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#9aa9b8"/></marker><marker id="sahOn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#1f6fd1"/></marker></defs>${arrows}${boxes}</svg><p class="now" id="schemeNow" aria-live="off"></p><p class="legend">Farbe der Kästen: Anteil des Stoffes in diesem Zustand.</p>`;
    }
    let schemeSig = '', vPrev = 0;
    function renderScheme(force) {
      const el = $('#scheme');
      if (!ui.scheme) return;
      if (force || !el.firstChild) el.innerHTML = schemeSvg();
      const st = model.state, sub = model.substance, sh = model.shares();
      const proc = model.process();
      const on = new Set(), eq = new Set();
      if (proc === 'melting') on.add('sl');
      if (proc === 'freezing') on.add('ls');
      if (proc === 'boiling') on.add('lg');
      if (proc === 'condensing') on.add('gl');
      if (proc === 'atMelting') { eq.add('sl'); eq.add('ls'); }
      if (proc === 'atBoiling') { eq.add('lg'); eq.add('gl'); }
      if (sub.vapor && st.p < 2 && st.v > 0.01) {
        const rising = st.v < M.vaporTarget(sub, st.Tview) - 0.002 && st.v >= vPrev;
        const pair = st.p < 1 ? ['sg', 'gs'] : ['lg', 'gl'];
        if (rising) on.add(pair[0]); else if (!on.size) { eq.add(pair[0]); eq.add(pair[1]); }
      }
      vPrev = st.v;
      if (model.resubliming()) on.add('gs');
      const share = { F: sh.s, L: sh.l, G: sh.g };
      const main = Object.keys(share).reduce((a, b) => (share[b] > share[a] ? b : a));
      const sig = [...on].join() + '|' + [...eq].join() + '|' + Object.values(share).map((v) => v.toFixed(2)).join() + main + (force ? Math.random() : '');
      if (sig === schemeSig) return;
      schemeSig = sig;
      el.querySelectorAll('.box').forEach((g) => {
        g.querySelector('.fill').setAttribute('opacity', (0.12 + 0.88 * share[g.dataset.s]).toFixed(2) * (share[g.dataset.s] > 0.01 ? 1 : 0));
        g.classList.toggle('main', g.dataset.s === main);
      });
      el.querySelectorAll('.arr').forEach((g) => { g.classList.toggle('on', on.has(g.dataset.t)); g.classList.toggle('eq', !on.has(g.dataset.t) && eq.has(g.dataset.t)); });
      const name = (id) => SCH_T.find((t) => t[0] === id)[3];
      let txt;
      if (on.size) txt = `Gerade: <b>${[...on].map(name).join(' und ')}</b>`;
      else if (eq.size) txt = `Beides gleichzeitig: <b>${[...eq].map(name).join(' und ')}</b>`;
      else txt = 'Gerade kein Übergang.';
      $('#schemeNow').innerHTML = txt;
    }

    // ------------------------------------------------------------ Beschreibung für Bildschirmleser
    let lastWords = '', wordsSince = 0, spoken = '';
    function describe(force) {
      const s = model.substance;
      const words = model.phaseWords();
      const proc = { melting: 'Der Stoff schmilzt.', freezing: 'Der Stoff erstarrt.', boiling: 'Der Stoff verdampft.', condensing: 'Der Stoff kondensiert.', subliming: 'Über dem Feststoff bildet sich Dampf.' }[model.process()] || '';
      const label = `${s.name} bei ${deg(model.state.Tset)}: ${words}. ${proc}${model.state.cold ? ' Kalte Oberfläche über der Probe.' : ''}`;
      $('#matter').setAttribute('aria-label', 'Stoffebene – ' + label);
      $('#particles').setAttribute('aria-label', 'Teilchenebene – ' + label);
      if (words !== lastWords) { lastWords = words; wordsSince = performance.now(); }
      const stable = performance.now() - wordsSince > 900;
      const text = `${s.name}: ${words}`;
      if ((stable || force) && text !== spoken) { spoken = text; $('#srState').textContent = text; }
    }

    // ------------------------------------------------------------ Beobachtungen festhalten (Ergebnisse)
    let seenSig = '';
    function trackSeen() {
      const sh = model.shares(), st = model.state;
      const lv = ui.level === 'particles' ? 'T' : 'S';
      const rec = ui.seen[st.sub] || (ui.seen[st.sub] = { S: {}, L: {}, G: {} });
      if (sh.s > 0.85) rec.S[lv] = true;
      if (sh.l > 0.8) rec.L[lv] = true;
      if (sh.g > 0.85) rec.G[lv] = true;
      if (model.substance.vapor && st.v > 0.05 && sh.s > 0.5) ui.special.sublimation = true;
      if (st.c > 0.06) ui.special.resublimation = true;
      const sig = JSON.stringify([ui.seen, ui.special]);
      if (sig !== seenSig) { seenSig = sig; if (ui.tab === 'results') renderPanel(true); save(); }
    }

    // ------------------------------------------------------------ Kopfzeile, Reiter
    $('#btnNotebook').addEventListener('click', () => { ui.panel = true; ui.tab = 'notebook'; syncControls(); renderPanel(true); $('#panel').scrollTop = 0; save(); });
    $('#btnPanel').addEventListener('click', () => { ui.panel = !ui.panel; syncControls(); onResize(); save(); });
    document.querySelector('.lk-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      ui.tab = b.dataset.tab; syncControls(); renderPanel(true); $('#panel').scrollTop = 0; save();
    });

    // ------------------------------------------------------------ Bedienfeld: Aufgabe
    const mark = (fg) => (fg && fg.status !== 'empty' ? (fg.ok ? '<span class="lk-mark y" aria-label="richtig">✓</span>' : '<span class="lk-mark n" aria-label="falsch">✗</span>') : '');
    function selectHtml(name, options, value, cls, label) {
      return `<select name="${name}" class="${cls}" aria-label="${esc(label)}"><option value="">– wählen –</option>${Object.entries(options).map(([k, t]) => `<option value="${esc(k)}"${String(value) === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    }
    function optHtml(q, ans, cls) {
      const type = q.type === 'many' ? 'checkbox' : 'radio';
      return Object.entries(q.options).map(([k, text]) => {
        const checked = q.type === 'many' ? (ans || []).includes(k) : String(ans) === k;
        const m = cls(k, checked);
        return `<label class="lk-opt ${m}"><input type="${type}" name="${q.id}" value="${esc(k)}"${checked ? ' checked' : ''}><span>${esc(text)}</span>${m === 'right' ? '<span class="lk-mark y" aria-label="richtig">✓</span>' : m === 'wrong' ? '<span class="lk-mark n" aria-label="falsch">✗</span>' : ''}</label>`;
      }).join('');
    }
    function stepFormHtml(step, ss) {
      const sol = ss.solution ? T.solutionAnswers(step.id) : null;
      const val = (key) => (sol ? sol[key] : ss.answers[key]);
      const g = sol ? null : ss.graded;
      const fg = (key) => g && g.fields[key];
      const selCls = (key) => (sol ? 'right' : fg(key) && fg(key).status !== 'empty' ? (fg(key).ok ? 'right' : 'wrong') : '');
      if (step.id === 'observe') {
        return `<div class="cloze">${step.paragraphs.map((par) => {
          const fb = [];
          const inner = par.map((x) => {
            if (typeof x === 'string') return esc(x);
            const f = fg(x.id);
            if (f && f.status === 'answered' && !f.ok) fb.push(f.feedback);
            return `<span class="gapw">${selectHtml(x.id, x.options, val(x.id), selCls(x.id), 'Lücke ' + x.id.slice(1))}${sol ? '' : mark(f)}</span>`;
          }).join('');
          return `<p>${inner}</p>${fb.map((t) => `<span class="fbline n">✗ ${esc(t)}</span>`).join('')}`;
        }).join('')}</div>`;
      }
      return step.questions.map((q) => {
        if (q.type === 'assign') {
          const rows = q.rows.map((r) => {
            const key = `${q.id}.${r.id}`, f = fg(key);
            return `<div class="arow"><span>${esc(r.label)}</span><span class="gapw">${selectHtml(key, q.options, val(key), selCls(key), r.label)}${sol ? '' : mark(f)}</span>${f && f.status === 'answered' && !f.ok ? `<p class="lk-fb n">✗ ${esc(f.feedback)}</p>` : ''}</div>`;
          }).join('');
          return `<fieldset class="assign" data-q="${q.id}"><legend>${esc(q.legend)}</legend>${rows}</fieldset>`;
        }
        const f = fg(q.id);
        const cls = (k, checked) => {
          if (sol) { const c = q.type === 'many' ? q.correct.includes(k) : q.correct === k; return c ? 'right' : ''; }
          if (!f || f.status === 'empty') return '';
          if (q.type === 'many') return checked ? (q.correct.includes(k) ? 'right' : 'wrong') : '';
          return checked ? (f.ok ? 'right' : 'wrong') : '';
        };
        const fbHtml = !sol && f && f.status !== 'empty' ? `<p class="lk-fb ${f.ok ? 'y' : 'n'}">${f.ok ? '✓ ' : '✗ '}${esc(f.feedback)}</p>` : '';
        return `<fieldset data-q="${q.id}"><legend>${esc(q.legend)}</legend>${optHtml(q, val(q.id), cls)}${fbHtml}</fieldset>`;
      }).join('');
    }
    function taskHtml() {
      const step = T.STEP_BY_ID[ui.step];
      const ss = ui.steps[step.id];
      const chips = T.STEPS.map((x) => {
        const d = ui.steps[x.id].graded && ui.steps[x.id].graded.allCorrect;
        return `<button type="button" data-step="${x.id}" aria-pressed="${x.id === step.id}"><span class="num">${x.n}</span>${esc(x.short)}${d ? '<span class="done" aria-label="gelöst">✓</span>' : ''}</button>`;
      }).join('');
      let html = `<div class="stepchips" role="group" aria-label="Schritt im Lernweg">${chips}</div>`;
      const g = ss.graded;
      const summary = g && !ss.solution ? `<div class="lk-note ${g.allCorrect ? 'ok' : 'warn'}" role="status">${g.allCorrect ? '<b>Alles richtig!</b>' : `<b>${g.correct} von ${g.total} Antworten richtig.</b> Richtige Antworten bleiben stehen – verbessere die markierten Felder und prüfe erneut.`}</div>` : '';
      html += `<div class="lk-card"><h2>Schritt ${step.n}: ${esc(step.title)}</h2><p>${esc(step.intro)}</p>
        <form class="lk-form" id="stepForm" novalidate>${stepFormHtml(step, ss)}${summary}
        <div class="lk-row">${ss.solution ? '<button type="button" class="lk-btn primary" id="btnHideSolution">Eigene Antworten zeigen</button>' : '<button type="submit" class="lk-btn primary" id="btnGrade">Antworten prüfen</button>'}
        <button type="button" class="lk-btn" id="btnTip">${ss.tip ? (ss.tip < 3 ? `Nächster Tipp (${ss.tip + 1}/3)` : 'Tipp 3/3') : 'Tipp'}</button>
        <button type="button" class="lk-btn" id="btnSolution"${ss.solution ? ' disabled' : ''}>Lösung anzeigen</button></div></form></div>`;
      if (ss.confirmSolution) html += `<div class="lk-note warn" role="alert">Du hast noch nicht alle Antworten richtig. Lösung trotzdem anzeigen? Deine eigenen Antworten bleiben gespeichert.<div class="lk-row"><button type="button" class="lk-btn primary" id="btnSolutionYes">Ja, Lösung anzeigen</button><button type="button" class="lk-btn" id="btnSolutionNo">Abbrechen</button></div></div>`;
      if (ss.fails >= 2 && !ss.tip && !(g && g.allCorrect) && !ss.solution) html += '<div class="lk-note info">Das hat noch nicht geklappt. Möchtest du einen Tipp? <button type="button" class="lk-btn small" id="btnTipOffer">Tipp 1/3 anzeigen</button></div>';
      if (ss.tip) html += `<div class="lk-card tipbox">${step.hints.slice(0, ss.tip).map((h, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(h)}</p>`).join('')}</div>`;
      if (ss.solution) html += `<div class="lk-card"><h3>Lösung</h3><p>${esc(step.solution)}</p></div>`;
      const next = T.STEPS[step.n];
      if (g && g.allCorrect && next) html += `<div class="lk-row end"><button type="button" class="lk-btn" data-step="${next.id}">Weiter zu Schritt ${next.n}: ${esc(next.short)} →</button></div>`;
      return html;
    }

    // ------------------------------------------------------------ Bedienfeld: Ergebnisse
    function resultsHtml() {
      const mk = (on, letter, what) => `<span class="mk ${on ? 'y' : 'n'}" title="${esc(what)}">${letter}${on ? '✓' : '–'}</span>`;
      const rows = S.ORDER.map((id) => {
        const s = S.SUBSTANCES[id], r = ui.seen[id] || { S: {}, L: {}, G: {} };
        const cells = PHASES.map(([k, name]) => `<td class="seen" aria-label="${esc(name)}: ${r[k].S ? 'auf der Stoffebene gesehen' : 'auf der Stoffebene noch nicht gesehen'}, ${r[k].T ? 'auf der Teilchenebene gesehen' : 'auf der Teilchenebene noch nicht gesehen'}">${mk(r[k].S, 'S', 'Stoffebene')} ${mk(r[k].T, 'T', 'Teilchenebene')}</td>`).join('');
        return `<tr><td><b>${esc(s.name)}</b><br><span class="lk-muted">${deg(s.mp)} / ${deg(s.bp)}</span></td>${cells}</tr>`;
      }).join('');
      const sp = ui.special;
      const steps = T.STEPS.map((x) => {
        const ss = ui.steps[x.id], g = ss.graded;
        const txt = ss.solution ? 'Lösung angesehen' : g ? (g.allCorrect ? 'alles richtig ✓' : `${g.correct} von ${g.total} richtig`) : 'noch nicht geprüft';
        return `<tr><td>${x.n}. ${esc(x.title)}</td><td>${g && g.allCorrect ? `<span class="pill ok">${esc(txt)}</span>` : esc(txt)}</td></tr>`;
      }).join('');
      return `<p class="lk-muted">Hier siehst du, welche Zustände du bei welchem Stoff schon beobachtet hast. Die Temperaturen gelten bei Normaldruck (1013 hPa).</p>
        <div class="lk-card"><h3>Beobachtete Zustände</h3>
        <table class="res"><thead><tr><th>Stoff<br>Schmelz- / Siedetemperatur</th><th>fest</th><th>flüssig</th><th>gas&shy;förmig</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="lk-muted" style="margin:6px 0 0;font-size:13px">S = auf der Stoffebene gesehen · T = auf der Teilchenebene gesehen</p></div>
        <div class="lk-card"><h3>Iod: Sublimieren und Resublimieren</h3>
        <p>${sp.sublimation ? '<span class="mk y">✓</span> Dampf über festem Iod (Sublimieren) beobachtet' : '<span class="mk n">–</span> Dampf über festem Iod noch nicht beobachtet'}</p>
        <p>${sp.resublimation ? '<span class="mk y">✓</span> Kristalle an der kalten Oberfläche (Resublimieren) beobachtet' : '<span class="mk n">–</span> Kristalle an der kalten Oberfläche noch nicht beobachtet'}</p></div>
        <div class="lk-card"><h3>Lernweg</h3><table class="res"><tbody>${steps}</tbody></table></div>
        <div class="lk-note info"><b>Kenneigenschaften:</b> Jeder Reinstoff hat eine eigene Schmelz- und Siedetemperatur. Daran kann man Stoffe erkennen und voneinander unterscheiden.</div>`;
    }

    // ------------------------------------------------------------ Bedienfeld: Hefteintrag
    function diagramSvg() {
      const N = T.NOTEBOOK;
      const box = (x, y, t) => `<rect x="${x - 46}" y="${y - 15}" width="92" height="30" rx="8" fill="#eef4fb" stroke="#5b7da3"/><text class="st" x="${x}" y="${y + 4.5}" text-anchor="middle">${t}</text>`;
      const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2b3640" stroke-width="1.6" marker-end="url(#ah)"/>`;
      const lab = (x, y, t, anchor) => `<text x="${x}" y="${y}" text-anchor="${anchor || 'middle'}">${t}</text>`;
      return `<svg class="diagram" viewBox="0 0 400 236" role="img" aria-label="Schema der sechs Phasenübergänge zwischen fest, flüssig und gasförmig">
        <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2b3640"/></marker></defs>
        ${box(62, 208, 'fest')}${box(338, 208, 'flüssig')}${box(200, 26, 'gasförmig')}
        ${arrow(112, 200, 288, 200)}${lab(200, 192, N.transitions[0][2])}
        ${arrow(288, 216, 112, 216)}${lab(200, 232, N.transitions[1][2])}
        ${arrow(352, 190, 238, 44)}${lab(306, 106, N.transitions[2][2], 'start')}
        ${arrow(222, 46, 334, 192)}${lab(266, 152, N.transitions[3][2], 'end')}
        ${arrow(48, 190, 162, 44)}${lab(94, 106, N.transitions[4][2], 'end')}
        ${arrow(178, 46, 66, 192)}${lab(134, 124, N.transitions[5][2], 'start')}
      </svg>`;
    }
    function notebookInner() {
      const N = T.NOTEBOOK;
      return `<h2>${esc(N.title)}</h2>
        <ul class="states">${N.states.map(([k, t]) => `<li><b>${esc(k)}:</b> ${esc(t)}</li>`).join('')}</ul>
        ${diagramSvg()}
        <ul class="tlist">${N.transitions.map(([a, b, t]) => `<li>${esc(a)} → ${esc(b)}: <b>${esc(t)}</b></li>`).join('')}</ul>
        <p><b>Merke:</b> ${md(N.rules[0])} ${md(N.rules[1])}</p>`;
    }
    function notebookHtml() {
      return `<div class="lk-notebook">${notebookInner()}</div>
        <p class="lk-muted" style="margin-top:8px">Zum Abschreiben ins Heft (etwa 5 Minuten). Der Hefteintrag hängt nicht von deinen Antworten ab.</p>
        <div class="lk-row"><button type="button" class="lk-btn" id="btnPrint">Arbeitsblatt drucken</button></div>`;
    }
    function printHtml() {
      const rows = S.ORDER.map((id) => { const s = S.SUBSTANCES[id]; return `<tr><td>${esc(s.long || s.name)}</td><td>${deg(s.mp)}</td><td>${deg(s.bp)}</td><td></td></tr>`; }).join('');
      return `<h1>Aggregatzustände und Teilchenmodell</h1>
        <div class="lk-notebook">${notebookInner()}</div>
        <h2>Kenneigenschaften (bei 1013 hPa)</h2>
        <table><thead><tr><th>Stoff</th><th>Schmelztemperatur</th><th>Siedetemperatur</th><th>Zustand bei 1000 °C</th></tr></thead><tbody>${rows}</tbody></table>
        <h2>Meine Beobachtung beim Iod</h2><div class="lines"></div><div class="lines"></div><div class="lines"></div>
        <p style="font-size:9pt;color:#555">SiVex · Aggregatzustände 0.3.0 · Teilchenebene schematisch, nicht maßstabsgetreu.</p>`;
    }

    // ------------------------------------------------------------ Bedienfeld zeichnen und bedienen
    let panelSig = '';
    function renderPanel(force) {
      const sig = JSON.stringify([ui.tab, ui.step, ui.steps]);
      if (sig === panelSig && !force) return;
      panelSig = sig;
      const body = $('#panelBody');
      const top = $('#panel').scrollTop;
      body.setAttribute('aria-labelledby', 'tab-' + ui.tab);
      body.innerHTML = ui.tab === 'task' ? taskHtml() : ui.tab === 'results' ? resultsHtml() : notebookHtml();
      $('#panel').scrollTop = top;
    }
    function readForm(form) {
      const out = {};
      form.querySelectorAll('input, select').forEach((el) => {
        const name = el.name;
        if (!name) return;
        if (el.type === 'checkbox') { out[name] = out[name] || []; if (el.checked) out[name].push(el.value); }
        else if (el.type === 'radio') { if (el.checked) out[name] = el.value; else if (!(name in out)) out[name] = ''; }
        else out[name] = el.value;
      });
      return out;
    }
    $('#panelBody').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      const ss = ui.steps[ui.step];
      if (t.dataset.step) { ui.step = t.dataset.step; renderPanel(true); $('#panel').scrollTop = 0; save(); return; }
      const id = t.id;
      if (id === 'btnTip' || id === 'btnTipOffer') { ss.tip = Math.min(3, ss.tip + 1); renderPanel(true); save(); return; }
      if (id === 'btnSolution') {
        const form = $('#stepForm');
        if (form && !ss.solution) ss.answers = Object.assign({}, ss.answers, readForm(form));
        if (!(ss.graded && ss.graded.allCorrect) && !ss.confirmSolution) { ss.confirmSolution = true; renderPanel(true); return; }
        ss.solution = true; ss.confirmSolution = false; renderPanel(true); save(); return;
      }
      if (id === 'btnSolutionYes') { ss.solution = true; ss.confirmSolution = false; renderPanel(true); save(); return; }
      if (id === 'btnSolutionNo') { ss.confirmSolution = false; renderPanel(true); return; }
      if (id === 'btnHideSolution') { ss.solution = false; renderPanel(true); save(); return; }
      if (id === 'btnPrint') { $('#printArea').innerHTML = printHtml(); root.print(); }
    });
    $('#panelBody').addEventListener('submit', (e) => {
      e.preventDefault();
      const ss = ui.steps[ui.step];
      ss.answers = Object.assign({}, ss.answers, readForm(e.target));
      ss.graded = T.grade(ui.step, ss.answers);
      ss.confirmSolution = false;
      if (!ss.graded.allCorrect) ss.fails++;
      renderPanel(true); save();
    });
    // Eingaben sofort merken (bleiben beim Neuzeichnen und Neuladen erhalten)
    $('#panelBody').addEventListener('change', (e) => {
      const form = e.target.closest('form');
      if (!form || form.id !== 'stepForm' || ui.steps[ui.step].solution) return;
      ui.steps[ui.step].answers = Object.assign({}, ui.steps[ui.step].answers, readForm(form));
      save();
    });
    root.addEventListener('beforeprint', () => { if (!$('#printArea').innerHTML) $('#printArea').innerHTML = printHtml(); });

    // ------------------------------------------------------------ Größe, Trennlinie
    function onResize() { partR.resize(); matterR.resize(); renderTicks(); }
    const sp = splitter.bindSplitter({ splitter: $('#splitter'), container: $('#main'), panel: $('#panel'), storageKey: 'sivex-aggregatzustaende-panel', minStage: 460, onChange: onResize });
    root.addEventListener('resize', onResize);
    if (root.ResizeObserver) new root.ResizeObserver(onResize).observe($('#canvasWrap'));

    // ------------------------------------------------------------ Zeitschleife
    let last = null, slowAt = 0, schemeAt = 0, frames = 0;
    function loop(now) {
      const dt = last == null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      if (dt > 0) {
        model.advance(dt);
        sys.advance(dt, env());
      }
      matterR.frame(dt, ui.level === 'matter');
      if (ui.level === 'particles') partR.draw(model);
      frames++;
      if (now - slowAt > 250) { slowAt = now; trackSeen(); describe(false); }
      if (ui.scheme && now - schemeAt > 120) { schemeAt = now; renderScheme(false); }
      root.requestAnimationFrame(loop);
    }

    syncControls();
    renderPanel(true);
    root.requestAnimationFrame(loop);

    return {
      model, ui, matterR, partR, get sys() { return sys; }, get frames() { return frames; },
      setSubstance, setLevel, renderPanel, renderScheme, splitter: sp, save: saveNow
    };
  }

  (root.AZ = root.AZ || {}).ui = { createUI };
})(typeof self !== 'undefined' ? self : this);
