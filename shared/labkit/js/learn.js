/*
 * SiVex-Labkit – Lernweg-Mechanik (Prüfung, Hilfen, Lösung, Formular)
 *
 * Verallgemeinert aus apps/aggregatzustaende/js/tasks.js und ui.js nach der
 * Lern- und Auswertungsstruktur in docs/QUALITY.md: geschlossene Formate,
 * Rückmeldung je Feld, Tipp 1/3–3/3 auf Anforderung, „Lösung anzeigen“ bewusst
 * anzufordern, keine Benotung, keine Übermittlung. Enthält nur Mechanik – die
 * Inhalte (Schritte, Fragen, Hinweise) liefert jede App in ihrer tasks.js.
 *
 * Schritt: { id, n, short, title, intro, hints: [3 Texte], solution,
 *            paragraphs: [[Text | gap(id, options, correct, wrong)], …]      (Lückentext)
 *            questions: [{ id, type: 'one'|'many'|'assign', legend, options, correct, misc, rows }] }
 * Zustand je Schritt (freshStep): { answers, graded, fails, tip, solution, confirmSolution }
 *
 * Ohne `document` (Node, Tests) stehen nur die reinen Funktionen zur Verfügung.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.LK = root.LK || {}).learn = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const gap = (id, options, correct, wrong) => ({ id, options, correct, wrong: wrong || {} });
  function freshStep() { return { answers: {}, graded: null, fails: 0, tip: 0, solution: false, confirmSolution: false }; }
  function freshState(steps) { const o = {}; for (const s of steps) o[s.id] = freshStep(); return o; }

  /** Alle Eingabefelder eines Schritts: { key, kind, def, q } (key = Formularname). */
  function fields(step) {
    const out = [];
    if (step.paragraphs) for (const par of step.paragraphs) for (const x of par) if (typeof x === 'object') out.push({ key: x.id, kind: 'gap', def: x });
    for (const q of step.questions || []) {
      if (q.type === 'assign') q.rows.forEach((r) => out.push({ key: `${q.id}.${r.id}`, kind: 'row', def: r, q }));
      else out.push({ key: q.id, kind: q.type, def: q, q });
    }
    return out;
  }

  /** Antworten prüfen: jedes Feld einzeln, Eingaben bleiben erhalten. */
  function grade(step, answers) {
    const res = {};
    let correct = 0;
    const fs = fields(step);
    for (const f of fs) {
      const a = answers[f.key];
      let ok = false, status = 'answered', feedback = '';
      if (f.kind === 'many') {
        const sel = new Set(Array.isArray(a) ? a : []);
        const cor = new Set(f.def.correct);
        if (!sel.size) status = 'empty';
        ok = sel.size === cor.size && [...cor].every((k) => sel.has(k));
        if (!ok && sel.size) {
          const wrongSel = [...sel].filter((k) => !cor.has(k));
          const missing = [...cor].filter((k) => !sel.has(k)).length;
          const misc = wrongSel.map((k) => f.def.misc && f.def.misc[k]).filter(Boolean)[0];
          feedback = (wrongSel.length ? `${wrongSel.length} angekreuzte Aussage${wrongSel.length > 1 ? 'n treffen' : ' trifft'} nicht zu. ` : '') +
            (missing ? `Es fehlt noch ${missing === 1 ? 'eine zutreffende Aussage' : missing + ' zutreffende Aussagen'}. ` : '') + (misc || '');
        }
      } else {
        if (a == null || a === '') status = 'empty';
        else {
          ok = String(a) === String(f.def.correct);
          if (!ok) {
            if (f.kind === 'gap') feedback = (f.def.wrong && f.def.wrong[a]) || 'Das passt nicht zu deiner Beobachtung.';
            else if (f.kind === 'one') feedback = (f.def.misc && f.def.misc[a]) || 'Noch nicht richtig.';
            else feedback = (f.def.wrong && f.def.wrong[a]) || (f.q.feedback ? f.q.feedback(a, f.def) : '') || 'Das passt hier nicht.';
          }
        }
      }
      if (status === 'empty') feedback = 'Noch keine Antwort.';
      else if (ok) feedback = 'Richtig.';
      if (ok) correct++;
      res[f.key] = { ok, status, feedback };
    }
    return { fields: res, correct, total: fs.length, allCorrect: correct === fs.length };
  }
  function solutionAnswers(step) { const out = {}; for (const f of fields(step)) out[f.key] = f.def.correct; return out; }
  function complete(step, answers) {
    return fields(step).every((f) => { const a = answers[f.key]; return Array.isArray(a) ? a.length > 0 : a != null && a !== ''; });
  }
  /** Wortzahl eines Hefteintrags (Richtwert etwa 100 Wörter zuzüglich Gleichungen). */
  function words(text) { return String(text).replace(/\*\*/g, '').replace(/[→–:,.;]/g, ' ').split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length; }

  // ------------------------------------------------------------------ Formular-HTML
  const mark = (fg) => (fg && fg.status !== 'empty' ? (fg.ok ? '<span class="lk-mark y" aria-label="richtig">✓</span>' : '<span class="lk-mark n" aria-label="falsch">✗</span>') : '');
  function selectHtml(name, options, value, cls, label) {
    return `<select name="${esc(name)}" class="${cls}" aria-label="${esc(label)}"><option value="">– wählen –</option>${Object.entries(options).map(([k, t]) => `<option value="${esc(k)}"${String(value) === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  }
  function optHtml(q, ans, cls) {
    const type = q.type === 'many' ? 'checkbox' : 'radio';
    return Object.entries(q.options).map(([k, text]) => {
      const checked = q.type === 'many' ? (ans || []).includes(k) : String(ans) === k;
      const m = cls(k, checked);
      return `<label class="lk-opt ${m}"><input type="${type}" name="${esc(q.id)}" value="${esc(k)}"${checked ? ' checked' : ''}><span>${esc(text)}</span>${m === 'right' ? '<span class="lk-mark y" aria-label="richtig">✓</span>' : m === 'wrong' ? '<span class="lk-mark n" aria-label="falsch">✗</span>' : ''}</label>`;
    }).join('');
  }
  function stepFormHtml(step, ss) {
    const sol = ss.solution ? solutionAnswers(step) : null;
    const val = (key) => (sol ? sol[key] : ss.answers[key]);
    const g = sol ? null : ss.graded;
    const fg = (key) => g && g.fields[key];
    const selCls = (key) => (sol ? 'right' : fg(key) && fg(key).status !== 'empty' ? (fg(key).ok ? 'right' : 'wrong') : '');
    let html = '';
    if (step.paragraphs) {
      html += `<div class="lk-cloze">${step.paragraphs.map((par) => {
        const fb = [];
        const inner = par.map((x) => {
          if (typeof x === 'string') return esc(x);
          const f = fg(x.id);
          if (f && f.status === 'answered' && !f.ok) fb.push(f.feedback);
          return `<span class="lk-gapw">${selectHtml(x.id, x.options, val(x.id), selCls(x.id), 'Lücke ' + x.id)}${sol ? '' : mark(f)}</span>`;
        }).join('');
        return `<p>${inner}</p>${fb.map((t) => `<span class="lk-fbline n">✗ ${esc(t)}</span>`).join('')}`;
      }).join('')}</div>`;
    }
    html += (step.questions || []).map((q) => {
      if (q.type === 'assign') {
        const rows = q.rows.map((r) => {
          const key = `${q.id}.${r.id}`, f = fg(key);
          return `<div class="lk-arow lk-choice"><span>${esc(r.label)}</span><span class="lk-gapw lk-choice-ctl">${selectHtml(key, q.options, val(key), selCls(key), r.label)}${sol ? '' : mark(f)}</span>${f && f.status === 'answered' && !f.ok ? `<p class="lk-fb n">✗ ${esc(f.feedback)}</p>` : ''}</div>`;
        }).join('');
        return `<fieldset class="lk-assign" data-q="${esc(q.id)}"><legend>${esc(q.legend)}</legend>${rows}</fieldset>`;
      }
      const f = fg(q.id);
      const cls = (k, checked) => {
        if (sol) { const c = q.type === 'many' ? q.correct.includes(k) : q.correct === k; return c ? 'right' : ''; }
        if (!f || f.status === 'empty') return '';
        if (q.type === 'many') return checked ? (q.correct.includes(k) ? 'right' : 'wrong') : '';
        return checked ? (f.ok ? 'right' : 'wrong') : '';
      };
      const fbHtml = !sol && f && f.status !== 'empty' ? `<p class="lk-fb ${f.ok ? 'y' : 'n'}">${f.ok ? '✓ ' : '✗ '}${esc(f.feedback)}</p>` : '';
      return `<fieldset data-q="${esc(q.id)}"><legend>${esc(q.legend)}</legend>${optHtml(q, val(q.id), cls)}${fbHtml}</fieldset>`;
    }).join('');
    return html;
  }

  /**
   * HTML des Aufgaben-Reiters.
   * steps: Liste der Schritte; state: { step: aktuelle id, steps: { id: Zustand } }
   * opts.locked(step): true, wenn ein Schritt noch nicht bearbeitbar ist (z. B. noch nicht entwickelt)
   */
  function taskHtml(steps, state, opts) {
    opts = opts || {};
    const step = steps.find((s) => s.id === state.step) || steps[0];
    const ss = state.steps[step.id];
    const chips = steps.map((x) => {
      const d = state.steps[x.id] && state.steps[x.id].graded && state.steps[x.id].graded.allCorrect;
      const locked = opts.locked && opts.locked(x);
      return `<button type="button" data-step="${esc(x.id)}" aria-pressed="${x.id === step.id}"${locked ? ' class="locked" title="Folgt in einem späteren Entwicklungsschritt"' : ''}><span class="num">${x.n}</span>${esc(x.short)}${d ? '<span class="done" aria-label="gelöst">✓</span>' : ''}${locked ? '<span class="lock" aria-label="noch nicht verfügbar">🔒</span>' : ''}</button>`;
    }).join('');
    let html = `<div class="lk-stepchips" role="group" aria-label="Schritt im Lernweg">${chips}</div>`;
    if (opts.locked && opts.locked(step)) {
      return html + `<div class="lk-card"><h2>Schritt ${step.n}: ${esc(step.title)}</h2><p>${esc(step.intro)}</p><div class="lk-note info">${esc(opts.lockedText || 'Dieser Schritt folgt in einem späteren Entwicklungsschritt der App.')}</div></div>`;
    }
    const g = ss.graded;
    const summary = g && !ss.solution ? `<div class="lk-note ${g.allCorrect ? 'ok' : 'warn'}" role="status">${g.allCorrect ? '<b>Alles richtig!</b>' : `<b>${g.correct} von ${g.total} Antworten richtig.</b> Richtige Antworten bleiben stehen – verbessere die markierten Felder und prüfe erneut.`}</div>` : '';
    html += `<div class="lk-card"><h2>Schritt ${step.n}: ${esc(step.title)}</h2><p>${esc(step.intro)}</p>
      <form class="lk-form" id="lkStepForm" novalidate>${stepFormHtml(step, ss)}${summary}
      <div class="lk-row">${ss.solution ? '<button type="button" class="lk-btn primary" data-act="hideSolution">Eigene Antworten zeigen</button>' : '<button type="submit" class="lk-btn primary" data-act="grade">Antworten prüfen</button>'}
      <button type="button" class="lk-btn" data-act="tip">${ss.tip ? (ss.tip < 3 ? `Nächster Tipp (${ss.tip + 1}/3)` : 'Tipp 3/3') : 'Tipp'}</button>
      <button type="button" class="lk-btn" data-act="solution"${ss.solution ? ' disabled' : ''}>Lösung anzeigen</button></div></form></div>`;
    if (ss.confirmSolution) html += `<div class="lk-note warn" role="alert">Du hast noch nicht alle Antworten richtig. Lösung trotzdem anzeigen? Deine eigenen Antworten bleiben gespeichert.<div class="lk-row"><button type="button" class="lk-btn primary" data-act="solutionYes">Ja, Lösung anzeigen</button><button type="button" class="lk-btn" data-act="solutionNo">Abbrechen</button></div></div>`;
    if (ss.fails >= 2 && !ss.tip && !(g && g.allCorrect) && !ss.solution) html += '<div class="lk-note info">Das hat noch nicht geklappt. Möchtest du einen Tipp? <button type="button" class="lk-btn small" data-act="tip">Tipp 1/3 anzeigen</button></div>';
    if (ss.tip) html += `<div class="lk-card lk-tipbox">${step.hints.slice(0, ss.tip).map((h, i) => `<p><span class="lvl">Tipp ${i + 1}/3:</span> ${esc(h)}</p>`).join('')}</div>`;
    if (ss.solution) html += `<div class="lk-card"><h3>Lösung</h3><p>${esc(step.solution)}</p></div>`;
    const next = steps[steps.indexOf(step) + 1];
    if (g && g.allCorrect && next && !(opts.locked && opts.locked(next))) html += `<div class="lk-row end"><button type="button" class="lk-btn" data-step="${esc(next.id)}">Weiter zu Schritt ${next.n}: ${esc(next.short)} →</button></div>`;
    return html;
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

  /**
   * Ereignisse des Aufgaben-Reiters an ein Elternelement binden.
   * opts: { steps, state, render(), save(), onStep(id) (optional) }
   * Das Elternelement darf auch andere Reiter enthalten; nur Elemente mit data-act / data-step
   * und das Formular #lkStepForm werden behandelt.
   */
  function bindTask(parent, opts) {
    const cur = () => opts.steps.find((s) => s.id === opts.state.step) || opts.steps[0];
    parent.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.step) { opts.state.step = t.dataset.step; if (opts.onStep) opts.onStep(t.dataset.step); opts.render(); opts.save(); return; }
      const act = t.dataset.act;
      if (!act) return;
      const ss = opts.state.steps[cur().id];
      if (act === 'tip') { ss.tip = Math.min(3, ss.tip + 1); opts.render(); opts.save(); }
      else if (act === 'solution') {
        const form = parent.querySelector('#lkStepForm');
        if (form && !ss.solution) ss.answers = Object.assign({}, ss.answers, readForm(form));
        if (!(ss.graded && ss.graded.allCorrect) && !ss.confirmSolution) { ss.confirmSolution = true; opts.render(); return; }
        ss.solution = true; ss.confirmSolution = false; opts.render(); opts.save();
      }
      else if (act === 'solutionYes') { ss.solution = true; ss.confirmSolution = false; opts.render(); opts.save(); }
      else if (act === 'solutionNo') { ss.confirmSolution = false; opts.render(); }
      else if (act === 'hideSolution') { ss.solution = false; opts.render(); opts.save(); }
    });
    parent.addEventListener('submit', (e) => {
      if (e.target.id !== 'lkStepForm') return;
      e.preventDefault();
      const step = cur(), ss = opts.state.steps[step.id];
      ss.answers = Object.assign({}, ss.answers, readForm(e.target));
      ss.graded = grade(step, ss.answers);
      ss.confirmSolution = false;
      if (!ss.graded.allCorrect) ss.fails++;
      opts.render(); opts.save();
    });
    parent.addEventListener('change', (e) => {
      const form = e.target.closest('form');
      if (!form || form.id !== 'lkStepForm') return;
      const ss = opts.state.steps[cur().id];
      if (ss.solution) return;
      ss.answers = Object.assign({}, ss.answers, readForm(form));
      opts.save();
    });
  }

  return { esc, gap, freshStep, freshState, fields, grade, solutionAnswers, complete, words, stepFormHtml, taskHtml, readForm, bindTask };
});
