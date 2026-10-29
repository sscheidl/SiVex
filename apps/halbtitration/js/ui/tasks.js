/*
 * Aufgabe, Selbstkontrolle und Ergebnisse (ab 0.2.0)
 * -------------------------------------------------
 * Schritte je Versuch: Auftrag → Titrationskurve und ÄP → halber Umsatz →
 * Zielvolumen → gezielte Halbtitration → MWG-Begründung → eigener pK und
 * Abgabe → Vergleich; dazu eine freiwillige Vertiefung.
 *
 * Prüfstatus: Jede Prüfung speichert eine Signatur ihrer Grundlagen
 * (Eingabe, Rechenbasis, Messreihe, Messpunkte). Weicht die aktuelle
 * Signatur ab, gilt das Ergebnis als veraltet („erneut prüfen“); eine
 * frühere grüne Bestätigung erscheint dann nicht mehr.
 *
 * Abgabe: nur mit eigenem Zielvolumen und einem protokollierten Messpunkt
 * der gewählten Halbtitrationsreihe; Mängel werden gekennzeichnet, nicht
 * versteckt. „Lösung anzeigen“ ist davon getrennt und wird als solche
 * gespeichert.
 */
(function (global) {
  'use strict';

  const NS = global.Halbtitration;
  const Chem = NS.Chemistry;
  const Ind = NS.Indicators;
  const Ev = NS.Evaluation;
  const C = NS.Content;
  const F = NS.Format;
  const fmt = F.fmt;
  const signed = F.signed;

  let A = null;

  function x() { return A.exp(); }
  function e() { return A.es(); }
  function esc(s) { return A.esc(s); }
  function released() { return !!(e().submission || e().solution); }

  function seriesById(id) { return e().series.find(function (s) { return s.id === id; }) || null; }
  function latest(kind) { return e().series.filter(function (s) { return s.kind === kind && s.points.length; }).slice(-1)[0] || null; }
  function survey() { const s = seriesById(e().evalSurvey); return s && s.kind === 'survey' ? s : latest('survey'); }
  function half() { const s = seriesById(e().evalHalf); return s && s.kind === 'half' ? s : latest('half'); }

  function num(id) {
    const f = e().fields[id];
    if (!f) return NaN;
    const p = F.parseQuantity(f.input, /^(veq|vhalf|eqm)/.test(id) ? 'mL' : null);
    return p.ok ? p.value : NaN;
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function pointsSig(s) { return s ? s.id + ':' + hash(s.points.map(function (p) { return p.v + '/' + p.pH + '/' + (p.stable ? 1 : 0) + (p.homogeneous === false ? 0 : 1); }).join(',')) : '-'; }

  // ------------------------------------------------------------ Rechenbasis

  function basisValues(stage) {
    const b = e().basis['half' + stage];
    const m1 = num('eqm1');
    const m2 = num('eqm2');
    if (b === 'stoich') return { v1: num('veq1'), v2: num('veq2'), kind: 'stoich' };
    if (b === 'derived') return { v1: m1, v2: Number.isFinite(m1) ? 2 * m1 : NaN, kind: 'derived' };
    return { v1: m1, v2: m2, kind: 'measured' };
  }

  // ------------------------------------------------------------ Felder: Prüfung und Signatur

  function task(key) { return Ev.pkTasks(x()).find(function (t) { return t.key === key; }); }
  function theoryPoint(key) { return Ev.theoryPoints(x()).find(function (p) { return p.key === key; }); }
  function input(id) { const f = e().fields[id]; return f && f.input !== undefined ? String(f.input) : ''; }

  function measuredAt(pointKey) {
    if (pointKey === 'start') {
      const s = survey() || half();
      const p = s && s.points.find(function (q) { return q.v === 0; });
      return p ? { pH: p.pH, source: 'gemessen, V = 0 mL', kind: 'meas' } : null;
    }
    if (/^half/.test(pointKey)) {
      const pH = num('phhalf' + pointKey.slice(4));
      return Number.isFinite(pH) ? { pH: pH, source: 'gemessen (Halbtitration)', kind: 'meas' } : null;
    }
    const s = survey();
    const v = num('eqm1');
    if (!s || !Number.isFinite(v)) return null;
    const ip = Ev.interpolate(s.points, v);
    if (!ip || !Number.isFinite(ip.pH)) return null;
    return { pH: Math.round(ip.pH * 100) / 100, source: (ip.interpolated ? 'interpoliert' : 'gemessen') + ' an deinem ÄP-Marker', kind: ip.interpolated ? 'int' : 'meas' };
  }

  /** Signatur der Grundlagen eines Felds */
  function sig(id) {
    let m;
    if ((m = /^eqm(\d)$/.exec(id))) return input(id) + '|' + pointsSig(survey());
    if ((m = /^vhalf(\d)$/.exec(id))) { const b = basisValues(Number(m[1])); return input(id) + '|' + b.kind + ':' + b.v1 + ':' + b.v2; }
    if ((m = /^phhalf(\d)$/.exec(id))) return input(id) + '|' + pointsSig(half()) + '|' + num('vhalf' + m[1]);
    if ((m = /^pk_(.+)$/.exec(id))) return input(id) + '|' + num('phhalf' + task(m[1]).stage);
    if ((m = /^dpk_(.+)$/.exec(id))) return input(id) + '|' + num('pk_' + m[1]);
    if ((m = /^dph_(.+)$/.exec(id))) { const ms = measuredAt(m[1]); return input(id) + '|' + num('th_' + m[1]) + '|' + (ms ? ms.pH : '-'); }
    return input(id);
  }

  function checkFor(id, raw) {
    const ex = x();
    let m;
    if ((m = /^veq(\d)$/.exec(id))) return Ev.checkEquivalenceVolume(ex, Number(m[1]), raw);
    if ((m = /^eqm(\d)$/.exec(id))) {
      const s = survey();
      const p = F.parseQuantity(raw, 'mL');
      if (p.empty) return { status: 'empty', message: 'Noch kein Marker gesetzt.' };
      if (!p.ok) return { status: 'invalid', message: p.message };
      if (m[1] === '2' && Number.isFinite(num('eqm1')) && p.value <= num('eqm1')) return { status: 'wrong', message: 'Der 2. ÄP muss hinter dem 1. ÄP liegen.', kind: 'measure' };
      return Ev.checkEqMarker(s ? s.points : [], p.value, ex.direction);
    }
    if ((m = /^vhalf(\d)$/.exec(id))) return Ev.checkHalfVolume(Number(m[1]), raw, basisValues(Number(m[1])));
    if ((m = /^phhalf(\d)$/.exec(id))) { const s = half(); return Ev.checkMeasuredPH(raw, s ? s.points : [], num('vhalf' + m[1])); }
    if ((m = /^pk_(.+)$/.exec(id))) { const t = task(m[1]); return Ev.checkPK(t, raw, num('phhalf' + t.stage)); }
    if ((m = /^th_(.+)$/.exec(id))) return Ev.checkTheoryPH(theoryPoint(m[1]), raw);
    if ((m = /^dpk_(.+)$/.exec(id))) return Ev.checkDifference(raw, num('pk_' + m[1]), Ev.literatureValue(ex, m[1]));
    if ((m = /^dph_(.+)$/.exec(id))) { const ms = measuredAt(m[1]); return Ev.checkDifference(raw, ms ? ms.pH : NaN, num('th_' + m[1])); }
    return { status: 'invalid', message: 'Unbekanntes Feld.' };
  }

  function runCheck(id) {
    const f = e().fields[id] = e().fields[id] || {};
    const r = checkFor(id, f.input || '');
    f.status = r.status;
    f.message = r.message || null;
    f.kind = r.kind || null;
    f.point = r.point || null;
    f.sig = sig(id);
    if (r.status !== 'empty') f.tries = (f.tries || 0) + 1;
    return f;
  }

  /** Aktueller Status: veraltete Prüfungen gelten als ungeprüft */
  function current(id) {
    const f = e().fields[id];
    if (!f || !f.status) return { status: null };
    if (f.sig !== sig(id)) return { status: 'stale', was: f.status };
    return f;
  }

  function checkField(id) {
    const el = document.getElementById('f-' + id);
    const f = e().fields[id] = e().fields[id] || {};
    if (el) f.input = el.value;
    if (/^eqm/.test(id)) syncMarkerFromField(id);
    runCheck(id);
    A.save();
    A.refresh();
    const box = document.querySelector('[data-field="' + id + '"]');
    if (box) box.scrollIntoView({ block: 'nearest' });
  }

  function syncMarkerFromField(id) {
    const p = F.parseQuantity(input(id), 'mL');
    e().markers['eq' + id.slice(-1)] = p.ok ? p.value : null;
  }

  /** Marker im Diagramm gesetzt → Feld übernimmt den Wert (Prüfung veraltet automatisch) */
  function setMarker(key, v) {
    e().markers[key] = v;
    const id = 'eqm' + key.slice(-1);
    (e().fields[id] = e().fields[id] || {}).input = Number.isFinite(v) ? fmt(v, 2) : '';
  }

  function kindLabel(k) { return { calc: 'Rechnung', measure: 'Messung/Durchführung', approx: 'Näherung/Modellgrenze' }[k] || ''; }

  function fieldHtml(id, label, unit, sub) {
    const f = e().fields[id] || {};
    const cur = current(id);
    const st = cur.status;
    const cls = st === 'ok' ? ' is-ok' : st === 'wrong' || st === 'invalid' ? ' is-bad' : st === 'stale' || !st ? '' : ' is-warn';
    let fb = '';
    if (st === 'stale') fb = '<div class="lk-note stale">Geändert – erneut prüfen.</div>';
    else if (st && cur.message) fb = '<div class="lk-note ' + (st === 'ok' ? 'ok' : st === 'wrong' || st === 'invalid' ? 'bad' : st === 'present' ? 'info' : 'warn') + '">' + (cur.kind ? '<span class="tag">' + kindLabel(cur.kind) + '</span>' : '') + esc(cur.message) + '</div>';
    return '<div class="field" data-field="' + id + '"><label for="f-' + id + '">' + label + '</label><div class="in"><input type="text" inputmode="decimal" autocomplete="off" id="f-' + id + '" class="' + cls + '" value="' + esc(f.input || '') + '"><span class="unit">' + (unit || '') + '</span>' +
      '<button type="button" class="lk-btn small" data-action="check-field" data-field="' + id + '">Prüfen</button>' + hintButton(id) + '</div>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + fb + hintBox(id, hintsFor(id)) + '</div>';
  }

  // ------------------------------------------------------------ Hilfen

  function hintButton(id) {
    const level = e().hints[id] || 0;
    return '<button type="button" class="lk-btn small" data-action="hint" data-id="' + id + '"' + (level >= 3 ? ' disabled' : '') + '>Tipp ' + Math.min(3, level + 1) + '/3</button>';
  }
  function hintBox(id, list) {
    const level = e().hints[id] || 0;
    const names = ['Denkanstoß', 'Ansatz', 'Musterrechnung'];
    let h = '';
    for (let i = 0; i < level && i < 3; i++) if (list[i]) h += '<div class="hint"><b>Tipp ' + (i + 1) + '/3 · ' + names[i] + ':</b> ' + esc(list[i]) + '</div>';
    return h;
  }

  function steepest(points, direction) {
    const pts = points.slice().sort(function (a, b) { return a.v - b.v; });
    let best = null;
    for (let i = 1; i < pts.length; i++) {
      const dv = pts[i].v - pts[i - 1].v;
      if (dv <= 1e-6) continue;
      const sl = ((pts[i].pH - pts[i - 1].pH) / dv) * direction;
      if (!best || sl > best.s) best = { a: pts[i - 1].v, b: pts[i].v, s: sl };
    }
    return best;
  }

  function hintContext(id) {
    let m;
    if (/^eqm/.test(id)) { const s = survey(); return { steep: s && s.points.length > 3 ? steepest(s.points, x().direction) : null }; }
    if ((m = /^vhalf(\d)$/.exec(id))) return { basis: basisValues(Number(m[1])) };
    if ((m = /^phhalf(\d)$/.exec(id))) {
      const target = num('vhalf' + m[1]);
      const s = half();
      let point = null;
      if (s && s.points.length && Number.isFinite(target)) point = s.points.reduce(function (b, p) { return Math.abs(p.v - target) < Math.abs(b.v - target) ? p : b; });
      return { point: point };
    }
    if ((m = /^pk_(.+)$/.exec(id))) { const t = task(m[1]); return { task: t, pH: num('phhalf' + t.stage) }; }
    if ((m = /^th_(.+)$/.exec(id))) return { point: theoryPoint(m[1]) };
    if ((m = /^dpk_(.+)$/.exec(id))) return { a: num('pk_' + m[1]), b: Ev.literatureValue(x(), m[1]) };
    if ((m = /^dph_(.+)$/.exec(id))) { const ms = measuredAt(m[1]); return { a: ms ? ms.pH : NaN, b: num('th_' + m[1]) }; }
    return {};
  }
  function hintsFor(id) {
    if (/^q:/.test(id)) { const q = findQuestion(id.slice(2)); return q ? q.hints : []; }
    return C.hints(x(), id, hintContext(id));
  }

  async function nextHint(id) {
    const h = e().hints;
    const tried = /^q:/.test(id) ? !!(e().answers[id.slice(2)] && e().answers[id.slice(2)].status) : ((e().fields[id] || {}).tries > 0);
    if ((h[id] || 0) === 2 && !tried && !(await A.confirmBox('Dritten Tipp anzeigen?', 'Tipp 3/3 enthält die vollständige Antwort bzw. Rechnung. Er wird nach einem eigenen Versuch empfohlen. Trotzdem anzeigen?', 'Anzeigen'))) return;
    h[id] = Math.min(3, (h[id] || 0) + 1);
    A.save();
    A.refresh();
  }

  // ------------------------------------------------------------ Geschlossene Fragen und Trainer

  function questionSets() {
    const id = x().id;
    return { half: C.halfQuestions(id), why: C.trainer(id) };
  }
  function findQuestion(qid) {
    if (qid === 'titrant') return C.TITRANT_QUESTION;
    const s = questionSets();
    return s.half.concat(s.why).find(function (q) { return q.id === qid; }) || null;
  }
  function answerState(qid) {
    const a = e().answers[qid];
    if (!a || !a.status) return null;
    return a;
  }
  function qDone(qid) { const a = answerState(qid); return !!a && (a.status === 'ok' || a.shown); }

  function questionHtml(q, opts) {
    const a = e().answers[q.id] || {};
    const choice = a.choice || [];
    const checked = a.status ? a : null;
    let h = '<div class="q" data-q="' + q.id + '"><div class="q-text">' + esc(q.text) + '</div>';
    (q.options || []).forEach(function (o) {
      const on = choice.indexOf(o.id) >= 0;
      let cls = '';
      let mark = '';
      if (checked && on) { cls = o.correct ? ' right' : ' wrong'; mark = o.correct ? '<span class="lk-mark y">✓</span>' : '<span class="lk-mark n">✗</span>'; }
      if (checked && checked.shown && o.correct && !on) { cls = ' right'; mark = '<span class="lk-mark y">✓</span>'; }
      h += '<label class="lk-opt' + cls + '"><input type="radio" name="q-' + q.id + '" value="' + o.id + '"' + (on ? ' checked' : '') + '><span>' + esc(o.text) + '</span>' + mark + '</label>';
    });
    h += '<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn small primary" data-action="q-check" data-q="' + q.id + '">Prüfen</button>' + hintButton('q:' + q.id) +
      '<button type="button" class="lk-btn small" data-action="q-solve" data-q="' + q.id + '">Lösung anzeigen</button></div>';
    if (checked) {
      if (checked.shown) h += '<div class="lk-note info">Lösung angezeigt.</div>';
      else h += '<div class="lk-note ' + (checked.status === 'ok' ? 'ok' : 'bad') + '">' + (checked.status === 'ok' ? '✓ Richtig.' : '✗ Noch nicht richtig. Nutze einen Tipp.') + '</div>';
    }
    if (opts && opts.after && checked && (checked.status === 'ok' || checked.shown)) h += '<p class="lk-muted" style="margin:6px 0 0">' + opts.after + '</p>';
    return h + hintBox('q:' + q.id, q.hints || []) + '</div>';
  }

  function checkQuestion(qid, show) {
    const q = findQuestion(qid);
    const sel = document.querySelector('input[name="q-' + qid + '"]:checked');
    const a = e().answers[qid] = e().answers[qid] || {};
    if (qid === 'titrant') {
      const want = x().titrant;
      a.choice = show ? [want] : sel ? [sel.value] : [];
      a.shown = !!show;
      a.status = a.choice.length ? (a.choice[0] === want ? 'ok' : 'wrong') : null;
      if (a.status === 'ok') e().titrant = want;
    } else {
      const right = q.options.filter(function (o) { return o.correct; }).map(function (o) { return o.id; });
      a.choice = show ? right : sel ? [sel.value] : [];
      a.shown = !!show;
      a.status = a.choice.length ? (a.choice[0] === right[0] ? 'ok' : 'wrong') : null;
    }
    A.save();
    A.refresh();
  }

  // ------------------------------------------------------------ Abgabe und Musterlösung

  function stageEvidence(j) {
    const s = half();
    const tf = current('vhalf' + j);
    return Ev.evidence({ target: num('vhalf' + j), targetStatus: tf.status, points: s ? s.points : [], seriesId: s ? s.id : null, pHRaw: input('phhalf' + j) });
  }

  async function submit() {
    const ex = x();
    const st = e();
    const tasks = Ev.pkTasks(ex);
    // Eingaben aus dem Formular übernehmen und alles mit den aktuellen Daten neu prüfen
    document.querySelectorAll('[data-field] input').forEach(function (el) { const id = el.closest('[data-field]').dataset.field; (st.fields[id] = st.fields[id] || {}).input = el.value; });
    for (let j = 1; j <= ex.stages; j++) { runCheck('vhalf' + j); runCheck('phhalf' + j); }
    tasks.forEach(function (t) { runCheck('pk_' + t.key); });
    const stages = {};
    const blocking = [];
    for (let j = 1; j <= ex.stages; j++) {
      const ev = stageEvidence(j);
      stages[j] = ev;
      ev.blocking.forEach(function (b) { blocking.push((ex.stages > 1 ? 'Stufe ' + j + ': ' : '') + b); });
    }
    tasks.forEach(function (t) { if (!Number.isFinite(num('pk_' + t.key))) blocking.push('Trage ' + t.label + ' ein.'); });
    A.save();
    if (blocking.length) {
      const v = await A.modal('Noch kein eigenes Versuchsergebnis', '<p>Abgeben kannst du einen pK-Wert, der aus deiner eigenen Halbtitration stammt. Es fehlt:</p><ul>' + blocking.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul><p class="lk-muted">Ungenaue Messungen oder falsche Rechnungen darfst du abgeben – sie werden gekennzeichnet. Ohne eigenen Versuch kannst du stattdessen bewusst die Musterlösung ansehen.</p>', [{ label: 'Zurück', value: null, primary: true }, { label: 'Musterlösung ansehen', value: 'solution' }]);
      A.refresh();
      if (v === 'solution') await showSolution(true);
      return;
    }
    const flags = [];
    for (let j = 1; j <= ex.stages; j++) stages[j].flags.forEach(function (f) { flags.push((ex.stages > 1 ? 'Stufe ' + j + ': ' : '') + f); });
    tasks.forEach(function (t) { if (st.fields['pk_' + t.key].status !== 'ok') flags.push(t.label + ': Rechnung passt nicht zum gemessenen pH-Wert'); });
    const text = (flags.length ? '<p><strong>Deine Abgabe wird gekennzeichnet:</strong></p><ul>' + flags.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '<p>Messpunkt am Zielvolumen, stabil und durchmischt; Rechnung passend.</p>') +
      '<p>Nach der Abgabe erscheinen Literaturwert und Modellreferenz. Dein abgegebener Wert bleibt unverändert gespeichert; spätere Korrekturen werden getrennt angezeigt.</p>';
    if (!(await A.confirmBox('Eigenes Ergebnis abgeben?', text, 'Abgeben'))) { A.refresh(); return; }
    const values = {};
    tasks.forEach(function (t) { values[t.key] = num('pk_' + t.key); });
    const snap = { at: Date.now(), values: values, flags: flags, stages: {}, series: half().id };
    for (let j = 1; j <= ex.stages; j++) {
      const p = stages[j].point;
      snap.stages[j] = { target: num('vhalf' + j), v: p.v, pH: num('phhalf' + j), stable: !!p.stable, homogeneous: p.homogeneous !== false, stirred: p.stirred !== false };
    }
    st.submission = Object.freeze(snap);
    A.save(true);
    A.refresh();
    A.toast('Ergebnis abgegeben – Literaturwert freigeschaltet.', 'ok');
  }

  async function showSolution(confirmed) {
    if (!confirmed && !(await A.confirmBox('Musterlösung anzeigen?', 'Die Musterlösung zeigt das erwartete Vorgehen und die Literaturwerte. Sie wird als „Musterlösung angesehen“ gespeichert und zählt nicht als eigener Versuch.', 'Anzeigen'))) return;
    if (!e().solution) e().solution = { at: Date.now() };
    e().open.solution = true;
    A.save(true);
    A.refresh();
  }

  function solutionHtml() {
    const ex = x();
    const eq = Chem.equivalenceVolumes(ex);
    const lit = Chem.LITERATURE[ex.id];
    let h = '<div class="lk-note info"><strong>Musterlösung</strong> (bewusst angefordert am ' + new Date(e().solution.at).toLocaleString('de-DE') + ' – kein eigener Versuch)<ol>';
    h += '<li>V(ÄP' + (ex.stages > 1 ? ',1' : '') + ') aus der Kurve bzw. Stöchiometrie: ' + fmt(eq[0], 2) + ' mL' + (ex.stages > 1 ? '; V(ÄP,2) = ' + fmt(eq[1], 2) + ' mL' : '') + '.</li>';
    for (let j = 1; j <= ex.stages; j++) {
      const vh = Chem.halfVolume(ex, j);
      h += '<li>V(HÄP' + (ex.stages > 1 ? ',' + j : '') + ') = ' + (j === 1 ? fmt(eq[0], 2) + ' mL / 2' : '(' + fmt(eq[0], 2) + ' + ' + fmt(eq[1], 2) + ') mL / 2') + ' = ' + fmt(vh, 2) + ' mL; dort misst man pH ≈ ' + fmt(Chem.phAt(ex, vh), 2) + '.</li>';
    }
    if (ex.id === 'ammonia') h += '<li>pK_B ≈ 14,00 − pH ≈ ' + fmt(14 - Chem.phAt(ex, Chem.halfVolume(ex, 1)), 2) + '; Literatur pK_B(NH₃) = ' + fmt(lit.pKb, 2) + ', pKₛ(NH₄⁺) = ' + fmt(lit.pKs[0], 2) + '.</li>';
    else h += '<li>pKₛ ≈ pH(HÄP); Literatur: ' + lit.pKs.slice(0, ex.stages).map(function (p, i) { return 'pKₛ' + (ex.stages > 1 ? ['₁', '₂'][i] : '') + ' = ' + fmt(p, 2); }).join(', ') + '.' + (C.APPROX_NOTE[ex.id] ? ' ' + esc(C.APPROX_NOTE[ex.id]) : '') + '</li>';
    return h + '</ol></div>';
  }

  // ------------------------------------------------------------ Schritte

  function stepState() {
    const ex = x();
    const st = e();
    const s1 = survey();
    const okish = function (id) { const c = current(id); return c.status === 'ok' || c.status === 'measured-note' || c.status === 'approx'; };
    const res = {};
    res.start = qDone('titrant');
    const eqOk = okish('eqm1') && (ex.stages < 2 || okish('eqm2') || current('eqm2').status === 'weak' || st.basis.half2 === 'derived');
    res.curve = !!s1 && eqOk;
    res.half = questionSets().half.every(function (q) { return qDone(q.id); });
    res.target = [1, 2].slice(0, ex.stages).every(function (j) { return current('vhalf' + j).status === 'ok'; });
    res.measure = [1, 2].slice(0, ex.stages).every(function (j) { const c = current('phhalf' + j).status; return c === 'ok' || c === 'measured-note'; });
    res.why = questionSets().why.every(function (q) { return qDone(q.id); });
    res.result = !!st.submission;
    res.compare = !!st.submission && Ev.pkTasks(ex).every(function (t) { return current('dpk_' + t.key).status === 'ok'; });
    return res;
  }

  function stepHtml(id, n, title, done, body, opts) {
    const open = e().open[id] !== undefined ? e().open[id] : !!(opts && opts.openDefault);
    return '<section class="step' + (done ? ' done' : '') + (open ? ' open' : '') + '" data-step="' + id + '"><button type="button" class="step-head" data-action="toggle-step" data-step="' + id + '" aria-expanded="' + open + '"><span class="n">' + (done ? '✓' : n) + '</span><span class="t">' + title + '</span><span class="chev" aria-hidden="true">' + (open ? '▾' : '▸') + '</span></button>' +
      (open ? '<div class="step-body">' + body + '</div>' : '') + '</section>';
  }

  function firstOpen(res) {
    const order = ['start', 'curve', 'half', 'target', 'measure', 'why', 'result', 'compare'];
    for (const k of order) if (!res[k]) return k;
    return 'compare';
  }

  function renderTask() {
    const ex = x();
    const st = e();
    const role = C.ROLES[ex.id];
    const res = stepState();
    const nextId = firstOpen(res);
    // Standard: der erste offene Schritt ist aufgeklappt
    const def = function (id) { return id === nextId; };
    const tasks = Ev.pkTasks(ex);
    const s1 = survey();
    const s2 = half();
    let h = '';

    // 1 Auftrag
    let b = '<p class="task">' + esc(role.task) + '</p>';
    if (role.goals) b += '<ul class="goals">' + role.goals.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>';
    const v0 = ex.vSample + ex.vWater;
    b += '<div class="kv"><span>Probe</span><span>' + fmt(ex.vSample, 2) + ' mL ' + esc(ex.sampleName) + ', c = ' + fmt(ex.cSample, 3) + ' mol/L</span><span>verdünnt</span><span>mit ' + fmt(ex.vWater, 0) + ' mL Wasser auf ' + fmt(v0, 0) + ' mL (Elektrode taucht ein)</span><span>Maßlösungen</span><span>NaOH(aq) oder HCl(aq), je 0,100 mol/L · Bürette 50 mL</span><span>Bedingungen</span><span>25 °C, pK_W = 14,00</span></div>';
    const ta = st.answers.titrant || {};
    const tName = function (k) { return Chem.TITRANTS[k].name + ' ' + Chem.TITRANTS[k].formula; };
    b += '<div class="field" data-q="titrant"><label>Maßlösung</label>';
    if (ta.status === 'ok' || ta.shown) b += '<div class="lk-note ok">✓ ' + esc(tName(ex.titrant)) + ' – passend.</div>';
    else if (ta.status === 'wrong') b += '<div class="lk-note bad">✗ ' + esc(tName(ta.choice[0])) + ' passt nicht zu dieser Probe. Wähle an der Bürette (Vorbereitung ①) die andere Maßlösung.</div>';
    else b += '<p class="lk-muted" style="margin:0">Wähle unten an der Bürette (Vorbereitung ①) die passende Maßlösung.</p>';
    b += '<div class="lk-row" style="margin-top:6px">' + hintButton('q:titrant') + '</div>' + hintBox('q:titrant', C.TITRANT_QUESTION.hints) + '</div>';
    b += '<p class="lk-muted">Einen Indikator kannst du als zusätzliche Beobachtung im Labor zugeben (Vorbereitung ④). Maßgeblich ist die pH-Messung; die Eignung untersuchst du in der Vertiefung.</p>';
    b += details('basics', 'Grundlagen (freiwillig)') + C.BASICS + '</details>';
    h += stepHtml('start', 1, 'Auftrag und Maßlösung', res.start, b, { openDefault: def('start') });

    // 2 Kurve und ÄP
    b = '<p>Titriere die Probe und übernimm Messpunkte. Im Sprung lohnen sich kleine Zugaben. Bestimme dann ' + (ex.stages > 1 ? 'die Äquivalenzpunkte' : 'das Äquivalenzvolumen') + ' an deiner eigenen Kurve.</p>';
    b += '<p class="lk-muted">' + (s1 ? esc(A.seriesLabel(s1)) + ': ' + s1.points.length + ' Messpunkte bis ' + fmt(Math.max.apply(null, s1.points.map(function (p) { return p.v; })), 2) + ' mL' : 'Noch keine Titrationskurve.') + '</p>';
    b += '<div class="lk-row"><button type="button" class="lk-btn small" data-action="chart-marker" data-marker="eq1"' + (s1 ? '' : ' disabled') + '>ÄP' + (ex.stages > 1 ? ' 1' : '') + ' im Diagramm markieren</button>' + (ex.stages > 1 ? '<button type="button" class="lk-btn small" data-action="chart-marker" data-marker="eq2"' + (s1 ? '' : ' disabled') + '>ÄP 2 markieren</button>' : '') + '</div>';
    b += fieldHtml('eqm1', 'V(ÄP' + (ex.stages > 1 ? ',1' : '') + ') aus deiner Kurve', 'mL', 'Marker antippen/ziehen oder Wert eintragen.');
    if (ex.stages > 1) b += fieldHtml('eqm2', 'V(ÄP,2) aus deiner Kurve', 'mL', ex.id === 'glycine' ? 'Zeigt deine Kurve hier keinen deutlichen Sprung, wähle beim Zielvolumen „abgeleitet“.' : '');
    b += details('control', 'Kontrolle mit der Stöchiometrie (freiwillig)') + fieldHtml('veq1', 'V(ÄP' + (ex.stages > 1 ? ',1' : '') + ') berechnet', 'mL') + (ex.stages > 1 ? fieldHtml('veq2', 'V(ÄP,2) berechnet', 'mL') : '') + volumeCompare() + '</details>';
    h += stepHtml('curve', 2, 'Titrationskurve und Äquivalenzpunkt', res.curve, b, { openDefault: def('curve') });

    // 3 Halber Umsatz
    b = '<p>Untersuche die Hälfte deines Äquivalenzvolumens.</p>';
    questionSets().half.forEach(function (q) { b += questionHtml(q); });
    h += stepHtml('half', 3, 'Halber Umsatz', res.half, b, { openDefault: def('half') });

    // 4 Zielvolumen
    b = '';
    for (let j = 1; j <= ex.stages; j++) {
      const opts = [['measured', 'mein ÄP aus der Kurve'], ['stoich', 'berechnetes V(ÄP) (Kontrolle)']];
      if (j === 2) opts.splice(1, 0, ['derived', 'V(ÄP,1) aus der Kurve, V(ÄP,2) = 2 · V(ÄP,1) abgeleitet']);
      b += '<div class="field"><label for="basis' + j + '">Rechenbasis</label><select id="basis' + j + '" data-basis="half' + j + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (st.basis['half' + j] === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><div class="sub">' + basisText(j, basisValues(j)) + '</div></div>';
      b += fieldHtml('vhalf' + j, 'Zielvolumen V(HÄP' + (ex.stages > 1 ? ',' + j : '') + ')', 'mL');
    }
    h += stepHtml('target', 4, 'Zielvolumen berechnen', res.target, b, { openDefault: def('target') });

    // 5 Halbtitration
    b = '<p>Setze eine <strong>frische, gleich große Probe</strong> an und dosiere selbst bis zu deinem Zielvolumen. Rühren, Anzeige stabil werden lassen, Messwert übernehmen. Es wird nicht automatisch gestoppt.</p>';
    b += '<div class="lk-row"><button type="button" class="lk-btn small primary" data-action="new-sample" data-kind="half">Frische Probe für die Halbtitration</button>';
    for (let j = 1; j <= ex.stages; j++) if (Number.isFinite(num('vhalf' + j))) b += '<button type="button" class="lk-btn small" data-action="set-target" data-v="' + num('vhalf' + j) + '">Zielmarke ' + fmt(num('vhalf' + j), 2) + ' mL setzen</button>';
    b += '</div>';
    b += '<p class="lk-muted">' + (s2 ? esc(A.seriesLabel(s2)) + ': ' + s2.points.map(function (p) { return fmt(p.v, 2) + ' mL → pH ' + fmt(p.pH, 2) + (p.stable && p.homogeneous !== false ? '' : ' (nicht stabil)'); }).slice(-4).join(' · ') : 'Noch keine Halbtitration.') + '</p>';
    for (let j = 1; j <= ex.stages; j++) b += fieldHtml('phhalf' + j, 'Gemessener pH am HÄP' + (ex.stages > 1 ? ' ' + j : ''), '', 'Wert aus deiner Halbtitrations-Messreihe');
    h += stepHtml('measure', 5, 'Gezielt halbtitrieren', res.measure, b, { openDefault: def('measure') });

    // 6 Warum? MWG
    b = '<p>Begründe am bekannten Massenwirkungsgesetz, warum dein gemessener pH-Wert ' + (ex.id === 'ammonia' ? 'zur Basenkonstante führt' : 'den pKₛ-Wert liefert') + '.</p><p class="eq">' + (ex.id === 'ammonia' ? 'NH₃ + H₂O ⇌ NH₄⁺ + OH⁻' : C.PAIRS[ex.id][0][0] + ' + H₂O ⇌ H₃O⁺ + ' + C.PAIRS[ex.id][0][1]) + '</p>';
    const why = questionSets().why;
    for (let i = 0; i < why.length; i++) {
      if (i > 0 && !qDone(why[i - 1].id)) { b += '<p class="lk-muted">Der nächste Schritt erscheint, wenn dieser gelöst ist.</p>'; break; }
      b += questionHtml(why[i]);
    }
    b += details('hh', 'Vertiefung: Henderson-Hasselbalch-Gleichung') + C.HH + '</details>';
    h += stepHtml('why', 6, 'Warum gilt das? (MWG)', res.why, b, { openDefault: def('why') });

    // 7 Ergebnis
    b = '';
    tasks.forEach(function (t) {
      const sub = st.submission && Number.isFinite(st.submission.values[t.key]) ? 'abgegeben: ' + fmt(st.submission.values[t.key], 2) + (Number.isFinite(num('pk_' + t.key)) && Math.abs(num('pk_' + t.key) - st.submission.values[t.key]) > 0.0049 ? ' · aktuell korrigiert' : '') : '';
      b += fieldHtml('pk_' + t.key, t.html + ' (experimentell)', '', sub);
    });
    if (ex.stages > 1) b += '<p class="lk-muted">An der ersten Stufe ist das Ablesen eine <strong>näherungsweise</strong> pK-Bestimmung – prüfe nach der Abgabe, wie gut sie hier gilt.</p>';
    if (!st.submission) b += '<div class="lk-row"><button type="button" class="lk-btn primary" data-action="submit">Eigenes Ergebnis abgeben</button>' + (st.solution ? '' : '<button type="button" class="lk-btn" data-action="solution">Lösung anzeigen</button>') + '</div>';
    else b += submissionHtml();
    if (st.legacySubmission && !st.submission) b += '<div class="lk-note warn">Aus Version 0.1.0 übernommen: abgegeben am ' + new Date(st.legacySubmission.at).toLocaleString('de-DE') + ' (' + Object.keys(st.legacySubmission.values).map(function (k) { return esc(k) + ' = ' + fmt(st.legacySubmission.values[k], 2); }).join(', ') + ') – ohne Nachweisprüfung, schaltet nichts frei.</div>';
    if (st.solution) b += solutionHtml();
    h += stepHtml('result', 7, 'Eigenen pK-Wert bestimmen und abgeben', res.result, b, { openDefault: def('result') });

    // 8 Vergleich
    if (released()) {
      b = compareHtml();
      h += stepHtml('compare', 8, 'Vergleichen und deuten', res.compare, b, { openDefault: def('compare') || !!st.submission });
    } else {
      h += '<section class="step locked"><div class="step-head"><span class="n">8</span><span class="t">Vergleichen und deuten</span></div><p class="lk-muted step-lock">Nach der Abgabe des eigenen Ergebnisses.</p></section>';
    }

    // Vertiefung
    h += stepHtml('deep', '+', 'Vertiefung (freiwillig)', false, deepHtml(), { openDefault: false });
    document.getElementById('panelBody').innerHTML = A.subs(h);
  }

  function opt(id, text, correct) { return { id: id, text: text, correct: !!correct }; }
  /** Aufklappbereich, dessen Zustand beim Neuaufbau erhalten bleibt */
  function details(key, summary) { return '<details class="more" data-key="' + key + '"' + (e().open['d:' + key] ? ' open' : '') + '><summary>' + summary + '</summary>'; }

  function basisText(j, bv) {
    const f = function (v) { return Number.isFinite(v) ? fmt(v, 2) + ' mL' : '–'; };
    if (j === 1) return 'V(ÄP' + (x().stages > 1 ? ',1' : '') + ') = ' + f(bv.v1) + (bv.kind === 'stoich' ? ' <span class="badge">berechnet</span>' : ' <span class="badge meas">gemessen</span>');
    return 'V(ÄP,1) = ' + f(bv.v1) + ', V(ÄP,2) = ' + f(bv.v2) + ' ' + (bv.kind === 'derived' ? '<span class="badge der">abgeleitet</span>' : bv.kind === 'stoich' ? '<span class="badge">berechnet</span>' : '<span class="badge meas">gemessen</span>');
  }

  function volumeCompare() {
    const ex = x();
    let h = '';
    for (let j = 1; j <= ex.stages; j++) {
      const mv = num('eqm' + j);
      const cv = num('veq' + j);
      if (Number.isFinite(mv) && Number.isFinite(cv) && current('veq' + j).status === 'ok') {
        const d = Ev.deviation(mv, cv);
        h += '<div class="lk-note info">ÄP' + (ex.stages > 1 ? ' ' + j : '') + ': Kurve − Rechnung = ' + signed(d.abs, 2) + ' mL; relativ ' + signed(d.rel, 1) + ' % <span class="lk-muted">(Referenz und Nenner: berechnetes V(ÄP) = ' + fmt(cv, 2) + ' mL)</span></div>';
      }
    }
    return h;
  }

  function submissionHtml() {
    const sb = e().submission;
    const ex = x();
    let h = '<div class="lk-note ' + (sb.flags.length ? 'warn' : 'ok') + '"><strong>Abgegeben</strong> am ' + new Date(sb.at).toLocaleString('de-DE') + ' (unveränderliche Momentaufnahme): ' + Ev.pkTasks(ex).map(function (t) { return esc(t.label) + ' = ' + fmt(sb.values[t.key], 2); }).join(', ') + '.';
    Object.keys(sb.stages).forEach(function (j) {
      const q = sb.stages[j];
      h += '<br>' + (ex.stages > 1 ? 'Stufe ' + j + ': ' : '') + 'Ziel ' + fmt(q.target, 2) + ' mL, gemessen bei ' + fmt(q.v, 2) + ' mL, pH ' + fmt(q.pH, 2) + (q.stable && q.homogeneous ? ' (stabil)' : ' (nicht stabil/durchmischt)') + '.';
    });
    if (sb.flags.length) h += '<br><strong>Gekennzeichnet:</strong> ' + sb.flags.map(esc).join('; ') + '.';
    return h + '</div>';
  }

  function compareHtml() {
    const ex = x();
    const st = e();
    const lit = Chem.LITERATURE[ex.id];
    const tasks = Ev.pkTasks(ex);
    let h = '<table class="data"><thead><tr><th>Größe</th><th>Literatur</th><th>abgegeben</th></tr></thead><tbody>';
    tasks.forEach(function (t) {
      h += '<tr><td>' + t.html + '</td><td class="num">' + fmt(Ev.literatureValue(ex, t.key), 2) + '</td><td class="num">' + (st.submission ? fmt(st.submission.values[t.key], 2) : '–') + '</td></tr>';
    });
    h += '</tbody></table><p class="lk-muted" style="font-size:12.5px">Quelle: ' + esc(Chem.LITERATURE.source) + '. ' + esc(Chem.LITERATURE.conditions) + '. pK_W = 14,00 (Modellannahme).</p>';
    if (!st.submission) return h + '<p class="lk-muted">Du hast die Musterlösung angesehen, aber kein eigenes Ergebnis abgegeben. Eine eigene Messung kannst du weiterhin durchführen und abgeben.</p>';
    tasks.forEach(function (t) {
      h += fieldHtml('dpk_' + t.key, 'ΔpK für ' + t.html + ' = pK(exp.) − pK(Lit.)', '', 'pK(exp.) = ' + fmt(num('pk_' + t.key), 2) + ', pK(Lit.) = ' + fmt(Ev.literatureValue(ex, t.key), 2));
    });
    if (C.APPROX_NOTE[ex.id]) h += '<div class="lk-note info"><strong>Erste Stufe:</strong> ' + esc(C.APPROX_NOTE[ex.id]) + '</div>';
    // knappe Fehlerdeutung
    const rel = relevance();
    const rf = st.reflection;
    h += '<h3 style="font-size:14px;margin:12px 0 4px">Woran liegt deine Abweichung? (alles Zutreffende)</h3>';
    Ev.CAUSES.forEach(function (c) {
      const on = rf.causes.indexOf(c.id) >= 0;
      let cls = '';
      let note = '';
      if (rf.checked && rel) {
        const r = rel[c.id];
        if (r.real) { cls = on ? ' right' : ''; note = r.why; }
        else if (on && r.relevant) cls = ' right';
        else if (on && !r.relevant) { cls = ' wrong'; note = 'trifft hier nicht zu: ' + r.why; }
        else if (!on && r.relevant) { cls = ' miss'; note = 'fehlt: ' + r.why; }
      }
      h += '<label class="lk-opt' + cls + '"><input type="checkbox" name="cause" value="' + c.id + '"' + (on ? ' checked' : '') + '><span><span class="badge">' + esc(c.group) + '</span> ' + esc(c.text) + (note ? '<br><small>' + esc(note) + '</small>' : '') + '</span></label>';
    });
    h += '<div class="lk-row" style="margin-top:8px"><button type="button" class="lk-btn small primary" data-action="causes-check">Antworten prüfen</button></div>';
    h += '<div class="field"><label for="reflText">Eigene Begründung (wird nicht bewertet)</label><textarea id="reflText">' + esc(rf.text) + '</textarea></div>';
    return h;
  }

  function usedPoints() {
    const sb = e().submission;
    const out = [];
    if (!sb) return out;
    Object.keys(sb.stages).forEach(function (j) { const q = sb.stages[j]; out.push({ stage: Number(j), point: { v: q.v, pH: q.pH, stable: q.stable, homogeneous: q.homogeneous, stirred: q.stirred } }); });
    return out;
  }
  function decompositions() {
    const ex = x();
    const used = usedPoints();
    return Ev.pkTasks(ex).map(function (t) {
      const u = used.find(function (q) { return q.stage === t.stage; });
      return u ? { task: t, d: Ev.decompose(ex, t, u.point), point: u.point } : null;
    }).filter(Boolean);
  }
  function relevance() {
    const ds = decompositions();
    if (!ds.length) return null;
    return Ev.causeRelevance(ds.map(function (q) { return q.d; }), ds.map(function (q) { return q.point; }));
  }

  function deepHtml() {
    const ex = x();
    const st = e();
    let h = '';
    // Schematische Reaktionsfolge; Gleichgewichtsanteile erst nach Freigabe
    const sys = Chem.SYSTEMS[ex.system];
    const forms = ex.titrant === 'HCl' ? sys.forms.slice().reverse() : sys.forms.slice(0, ex.id === 'phosphoric' ? 4 : sys.forms.length);
    h += '<h3>Reaktionsfolge</h3><p class="eq">' + forms.map(esc).join(' → ') + '</p><p class="lk-muted">Schematische Reihenfolge der Titration – keine Aussage über Mengenanteile. Im Gleichgewicht liegen benachbarte Formen nebeneinander vor, je nach pH auch in großen Anteilen.' + (ex.id === 'glycine' ? ' Cl⁻ ist Gegenion des Glycinhydrochlorids.' : '') + '</p>';
    if (released()) {
      const l = A.lab();
      const s = Chem.state(ex, Math.max(0, l.delivered - l.unmixed));
      h += '<h3>Gleichgewichtsanteile jetzt (Modell)</h3><div class="species">' + sys.forms.map(function (f, i) { return '<div><span>' + esc(f) + '</span><span>' + fmt(s.alpha[i] * 100, 1) + ' %</span><span class="bar" style="width:' + Math.round(s.alpha[i] * 100) + '%"></span></div>'; }).join('') + '</div><p class="lk-muted">aus dem Gleichgewichtssolver bei V = ' + fmt(l.addedRounded, 2) + ' mL</p>';
    } else {
      h += '<p class="lk-muted">Die berechneten Gleichgewichtsanteile erscheinen nach der Abgabe deines Ergebnisses (sie würden den HÄP verraten).</p>';
    }
    // Theoretische pH-Werte als Wiederholung
    h += '<h3>Wiederholung: pH-Werte berechnen</h3>';
    if (!released()) h += '<p class="lk-muted">Mit Literaturwerten – verfügbar nach der Abgabe bzw. der Musterlösung.</p>';
    else {
      Ev.theoryPoints(ex).forEach(function (p) {
        h += fieldHtml('th_' + p.key, 'pH am ' + p.label + ' (berechnet)', '', p.given ? esc(p.given) : '');
        const c = current('th_' + p.key);
        if (c.status === 'ok' || c.status === 'approx') {
          h += '<div class="lk-note info">Modellreferenz bei V = ' + fmt(p.v, 2) + ' mL: pH = ' + fmt(p.model, 2) + ' · Näherung − Modell: ' + signed(p.main - p.model, 2) + '</div>';
          const ms = measuredAt(p.key);
          if (ms) h += fieldHtml('dph_' + p.key, 'ΔpH = pH(gemessen) − pH(berechnet)', '', 'pH(gemessen) = ' + fmt(ms.pH, 2) + ' <span class="badge ' + ms.kind + '">' + esc(ms.source) + '</span>');
          else h += '<p class="lk-muted">Kein Messwert an diesem Punkt (Datenlücke).</p>';
        }
      });
    }
    // Indikator
    h += '<h3>Indikator untersuchen</h3>' + indicatorHtml();
    // Fehlerzerlegung
    if (st.submission) h += '<h3>Zerlegung der Abweichung (Modellanalyse)</h3>' + decompositionHtml();
    return h;
  }

  function indicatorHtml() {
    const ex = x();
    const s = survey();
    const used = s ? s.indicator : 'none';
    let h = '';
    if (!s || used === 'none') h += '<p class="lk-muted">Wähle im Schritt 1 einen Indikator und nimm eine Titrationskurve mit ihm auf. Notiere den Endpunkt bei bleibender Farbe.</p>';
    if (s && used !== 'none') {
      const ind = Ind.get(used);
      h += '<p>' + esc(ind.name) + ' (pH ' + fmt(ind.range[0], 1) + '–' + fmt(ind.range[1], 1) + ')' + (s.endpoint ? ': Endpunkt notiert bei ' + fmt(s.endpoint.v, 2) + ' mL.' : ': kein Endpunkt notiert.') + '</p>';
      const mv = num('eqm1');
      if (s.endpoint && Number.isFinite(mv)) h += '<p>Endpunkt − eigener ÄP = ' + signed(s.endpoint.v - mv, 2) + ' mL (aus deinen Daten).</p>';
    }
    if (current('veq1').status === 'ok' || released()) {
      h += '<table class="data"><thead><tr><th>Indikator</th>' + (ex.stages > 1 ? '<th>ÄP</th>' : '') + '<th>Volumenfehler</th><th>Bewertung</th></tr></thead><tbody>';
      Ind.list().filter(function (i) { return i.range; }).forEach(function (i) {
        for (let j = 1; j <= ex.stages; j++) {
          const r = Ev.indicatorSuitability(ex, i.id, j);
          h += '<tr><td>' + esc(i.name) + '</td>' + (ex.stages > 1 ? '<td>' + j + '</td>' : '') + '<td class="num">' + (r.vEnd === null ? '–' : signed(r.error, 2) + ' mL (' + fmt(r.rel, 1) + ' %)') + '</td><td>' + esc(r.label) + '</td></tr>';
        }
      });
      h += '</tbody></table><p class="lk-muted">Rechnerischer Umschlag (Endpunkt-pH) gegen das stöchiometrische V(ÄP); geeignet bis 0,5 %, bedingt bis 3 %. Den pK-Wert liefert immer die pH-Elektrode.</p>';
    } else h += '<p class="lk-muted">Die rechnerische Bewertung aller Indikatoren erscheint, wenn du V(ÄP) berechnet hast (Kontrolle in Schritt 2) oder nach der Abgabe.</p>';
    return h;
  }

  function decompositionHtml() {
    const ds = decompositions();
    if (!ds.length) return '';
    let h = '<table class="data"><thead><tr><th>Größe</th><th>Volumen</th><th>Ablesung</th><th>Näherung</th><th>Rundung</th></tr></thead><tbody>';
    ds.forEach(function (q) {
      h += '<tr><td>' + q.task.html + '<br><small>' + fmt(q.point.v, 2) + ' statt ' + fmt(q.d.vHalf, 2) + ' mL</small></td><td class="num">' + signed(q.d.volumeEffect, 2) + '</td><td class="num">' + signed(q.d.readingEffect, 2) + '</td><td class="num">' + signed(q.d.approximation, 2) + '</td><td class="num">' + signed(q.d.rounding, 2) + '</td></tr>';
    });
    return h + '</tbody></table><p class="lk-muted" style="font-size:12.5px">Summe = pK(exp.) − pK(Lit.). Volumen/Ablesung: Durchführung; Näherung: Modell-pH am exakten HÄP − Modell-pK; Rechenfehler sind nicht enthalten.</p>';
  }

  // ------------------------------------------------------------ Ergebnisübersicht

  function renderResults() {
    let h = '<h2 class="ph">Ergebnisse aller Versuche</h2>';
    Chem.EXPERIMENT_IDS.forEach(function (id) {
      const ex = Chem.experiment(id);
      const st = A.state.exps[id];
      const sb = st.submission;
      const rel = !!(sb || st.solution);
      const tasks = Ev.pkTasks(ex);
      const f = function (k) { const q = st.fields[k]; if (!q) return NaN; const p = F.parseQuantity(q.input, /^(eqm|vhalf)/.test(k) ? 'mL' : null); return p.ok ? p.value : NaN; };
      const mL = function (v) { return Number.isFinite(v) ? fmt(v, 2) + ' mL' : '–'; };
      h += '<div class="rcard' + (sb ? ' done' : '') + '"><h3>' + ex.no + ' ' + esc(C.ROLES[id].chip) + ' <small>' + C.ROLES[id].role + '</small></h3>';
      for (let j = 1; j <= ex.stages; j++) {
        const b = st.basis['half' + j];
        const eqv = j === 1 ? f('eqm1') : (b === 'derived' ? 2 * f('eqm1') : f('eqm2'));
        const eqSrc = j === 2 && b === 'derived' ? 'abgeleitet' : 'aus der Kurve';
        const q = sb && sb.stages[j];
        h += (ex.stages > 1 ? '<p class="rstage">Stufe ' + j + '</p>' : '') + '<dl class="rgrid">' +
          '<dt>ÄP</dt><dd>' + mL(eqv) + (Number.isFinite(eqv) ? ' <span class="badge ' + (eqSrc === 'abgeleitet' ? 'der' : 'meas') + '">' + eqSrc + '</span>' : '') + '</dd>' +
          '<dt>Ziel / Messung</dt><dd>' + (q ? mL(q.target) + ' / ' + mL(q.v) : mL(f('vhalf' + j)) + ' / –') + '</dd>' +
          '<dt>pH am HÄP</dt><dd>' + (q ? fmt(q.pH, 2) + ' <span class="badge' + (q.stable && q.homogeneous ? ' meas">stabil' : ' warn">nicht stabil') + '</span>' : '–') + '</dd>';
        tasks.filter(function (t) { return t.stage === j; }).forEach(function (t) {
          const L = Ev.literatureValue(ex, t.key);
          const corr = sb && Number.isFinite(f('pk_' + t.key)) && Math.abs(f('pk_' + t.key) - sb.values[t.key]) > 0.0049;
          h += '<dt>' + t.html + '</dt><dd>' + (sb ? '<strong>' + fmt(sb.values[t.key], 2) + '</strong> (abgegeben)' + (corr ? ', korrigiert ' + fmt(f('pk_' + t.key), 2) : '') : '–') +
            (rel ? ' · Lit. ' + fmt(L, 2) + (sb ? ' · ΔpK ' + signed(sb.values[t.key] - L, 2) : '') : '') + '</dd>';
        });
        h += '</dl>';
      }
      const notes = [];
      if (sb && sb.flags.length) notes.push('gekennzeichnet: ' + sb.flags.join('; '));
      if (st.solution) notes.push('Musterlösung angesehen' + (sb ? '' : ' – kein eigener Versuch abgegeben'));
      if (st.legacySubmission && !sb) notes.push('Wert aus 0.1.0 übernommen, ohne Nachweis');
      if (!sb && !st.solution) notes.push(st.series.length ? st.series.length + ' Messreihe(n), noch nicht abgegeben' : 'noch nicht bearbeitet');
      h += '<p class="lk-muted rnote">' + esc(notes.join(' · ')) + '</p></div>';
    });
    h += '<p class="lk-muted">Abgegebene Werte sind Momentaufnahmen; spätere Korrekturen stehen daneben. Literaturwerte erscheinen nach der eigenen Abgabe oder einer bewusst angeforderten Musterlösung.</p>';
    h += '<div class="lk-row"><button type="button" class="lk-btn small" data-action="report">Bericht drucken / als PDF</button><button type="button" class="lk-btn small" data-action="csv">Messdaten als CSV</button></div>';
    document.getElementById('panelBody').innerHTML = A.subs(h);
  }

  // ------------------------------------------------------------ Export und Bericht

  function csvText() {
    const rows = ['Versuch;Messreihe;Zweck;V(Maßlösung) / mL;pH;Status;Indikator;Endpunkt V / mL'];
    Chem.EXPERIMENT_IDS.forEach(function (id) {
      const ex = Chem.experiment(id);
      A.state.exps[id].series.forEach(function (s) {
        s.points.forEach(function (p) {
          rows.push([ex.title, s.no, s.kind === 'survey' ? 'Titrationskurve' : 'Halbtitration', fmt(p.v, 2), fmt(p.pH, 2), p.stable && p.homogeneous !== false ? 'stabil' : 'nicht stabil', Ind.get(s.indicator || 'none').name, s.endpoint ? fmt(s.endpoint.v, 2) : ''].join(';'));
        });
      });
    });
    return rows.join('\r\n') + '\r\n';
  }

  function csv() {
    try {
      const blob = new Blob(['\ufeff' + csvText()], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'halbtitration-messdaten.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (err) { A.toast('Export nicht möglich: ' + err.message, 'bad'); }
  }

  function report() {
    const ex = x();
    const st = e();
    let img = '';
    try { img = A.chartImage(); } catch (err) { img = ''; }
    const fields = [['eqm1', 'V(ÄP,1) aus der Kurve'], ['eqm2', 'V(ÄP,2) aus der Kurve'], ['veq1', 'V(ÄP,1) berechnet'], ['veq2', 'V(ÄP,2) berechnet'], ['vhalf1', 'Zielvolumen HÄP 1'], ['vhalf2', 'Zielvolumen HÄP 2'], ['phhalf1', 'pH am HÄP 1'], ['phhalf2', 'pH am HÄP 2']];
    Ev.pkTasks(ex).forEach(function (t) { fields.push(['pk_' + t.key, t.label + ' (experimentell)'], ['dpk_' + t.key, 'ΔpK ' + t.label]); });
    let h = '<h1>Laborbericht · Halbtitration</h1><p>Versuch ' + ex.no + ': ' + esc(ex.short) + ' (' + C.ROLES[ex.id].role + ') · ' + new Date().toLocaleString('de-DE') + ' · Halbtitrationslabor (SiVex)</p>';
    h += '<section><h2>Aufgabe</h2><p>' + esc(C.ROLES[ex.id].task) + '</p><p>Probe: ' + fmt(ex.vSample, 2) + ' mL, c = ' + fmt(ex.cSample, 3) + ' mol/L, verdünnt mit ' + fmt(ex.vWater, 0) + ' mL Wasser; Maßlösung ' + esc(Chem.TITRANTS[ex.titrant].formula) + ', 0,100 mol/L.</p></section>';
    if (img) h += '<section><h2>Titrationskurve</h2><img src="' + img + '" alt="Titrationskurve"></section>';
    h += '<section><h2>Messdaten</h2><div class="cols2">';
    st.series.forEach(function (s) {
      h += '<p><strong>' + esc(A.seriesLabel(s)) + '</strong>' + (s.endpoint ? ' – Endpunkt bei ' + fmt(s.endpoint.v, 2) + ' mL' : '') + '</p><table><tr><th>V / mL</th><th>pH</th><th>Status</th></tr>' + s.points.map(function (p) { return '<tr><td>' + fmt(p.v, 2) + '</td><td>' + fmt(p.pH, 2) + '</td><td>' + (p.stable && p.homogeneous !== false ? 'stabil' : 'nicht stabil') + '</td></tr>'; }).join('') + '</table>';
    });
    h += '</div></section><section><h2>Rechnungen</h2><table><tr><th>Größe</th><th>Eingabe</th><th>Prüfung</th></tr>';
    fields.forEach(function (fl) {
      const fv = st.fields[fl[0]];
      if (!fv || !fv.input) return;
      if (!released() && /^dpk_/.test(fl[0])) return;
      const c = current(fl[0]);
      h += '<tr><td>' + esc(fl[1]) + '</td><td>' + esc(fv.input) + '</td><td>' + statusText(c.status) + '</td></tr>';
    });
    h += '</table></section>';
    if (st.submission) h += '<section><h2>Abgabe</h2>' + submissionHtml().replace(/<\/?div[^>]*>/g, '') + '</section>';
    if (released()) {
      h += '<section><h2>Freigegebene Referenzen</h2><p>' + Ev.pkTasks(ex).map(function (t) { return esc(t.label) + ': Literatur ' + fmt(Ev.literatureValue(ex, t.key), 2); }).join(', ') + '. Quelle: ' + esc(Chem.LITERATURE.source) + ' (' + esc(Chem.LITERATURE.conditions) + ').' + (st.solution ? ' Musterlösung angesehen.' : '') + '</p></section>';
      h += '<section><h2>Fehlerdeutung</h2><ul>' + st.reflection.causes.map(function (c) { return '<li>' + esc(Ev.CAUSES.find(function (q) { return q.id === c; }).text) + '</li>'; }).join('') + '</ul><p>' + esc(st.reflection.text) + '</p></section>';
    } else h += '<section><h2>Referenzen</h2><p>Literaturwerte und Modellreferenz sind noch nicht freigegeben.</p></section>';
    document.getElementById('report').innerHTML = A.subs(h);
    setTimeout(function () { global.print(); }, 60);
  }

  function statusText(s) {
    return { ok: 'richtig', wrong: 'falsch', approx: 'Näherung außerhalb der Gültigkeit', 'measured-note': 'Messwert mit Hinweis', present: 'Messwert vorhanden, Zuordnung offen', weak: 'kein deutlicher Sprung', stale: 'geändert, nicht erneut geprüft', invalid: 'ungültig', nobasis: 'Basis fehlt', gap: 'Datenlücke' }[s] || 'nicht geprüft';
  }

  // ------------------------------------------------------------ Ereignisse

  async function onAction(btn) {
    const a = btn.dataset.action;
    const stepEl = btn.closest && btn.closest('.step');
    if (stepEl && a !== 'toggle-step') e().open[stepEl.dataset.step] = true;
    switch (a) {
      case 'check-field': checkField(btn.dataset.field); return true;
      case 'hint': await nextHint(btn.dataset.id); return true;
      case 'q-check': checkQuestion(btn.dataset.q, false); return true;
      case 'q-solve': {
        const answered = document.querySelector('input[name="q-' + btn.dataset.q + '"]:checked');
        if (!answered && !(await A.confirmBox('Lösung anzeigen?', 'Du hast diese Frage noch nicht beantwortet. Trotzdem die Lösung anzeigen?', 'Lösung anzeigen'))) return true;
        checkQuestion(btn.dataset.q, true);
        return true;
      }
      case 'toggle-step': {
        const id = btn.dataset.step;
        const res = stepState();
        const isOpen = e().open[id] !== undefined ? e().open[id] : id === firstOpen(res);
        e().open[id] = !isOpen;
        A.save();
        A.refresh();
        return true;
      }
      case 'submit': await submit(); return true;
      case 'solution': await showSolution(false); return true;
      case 'causes-check': {
        const rf = e().reflection;
        rf.causes = Array.prototype.slice.call(document.querySelectorAll('input[name="cause"]:checked')).map(function (i) { return i.value; });
        rf.checked = true;
        A.save();
        A.refresh();
        return true;
      }
      case 'csv': csv(); return true;
      case 'report': report(); return true;
      default: return false;
    }
  }

  function onChange(ev) {
    const t = ev.target;
    const st = e();
    if (t.id === 'selIndicator') {
      st.indicator = t.value;
      const s = A.activeSeries();
      const l = A.lab();
      if (s && !s.points.length && !l.dispensed && !l.indicator) s.indicator = t.value; // unbenutzte Probe: sofort
      A.save();
      A.refresh();
      return true;
    }
    if (t.dataset && t.dataset.basis) { st.basis[t.dataset.basis] = t.value; A.save(); A.refresh(); return true; }
    if (t.id === 'reflText') { st.reflection.text = t.value; A.save(); return true; }
    if (t.name === 'cause') { st.reflection.causes = Array.prototype.slice.call(document.querySelectorAll('input[name="cause"]:checked')).map(function (i) { return i.value; }); st.reflection.checked = false; A.save(); return true; }
    if (t.name && t.name.indexOf('q-') === 0) {
      // neue Auswahl entwertet die alte Prüfung
      const a = st.answers[t.name.slice(2)] = st.answers[t.name.slice(2)] || {};
      a.choice = [t.value];
      a.status = null;
      a.shown = false;
      A.save();
      A.refresh();
      return true;
    }
    return false;
  }

  /** Eingabe in ein Feld: sofort speichern; die alte Prüfung veraltet über die Signatur */
  function onInput(t) {
    const box = t.closest('[data-field]');
    if (!box) return false;
    const id = box.dataset.field;
    const f = e().fields[id] = e().fields[id] || {};
    f.input = t.value;
    if (/^eqm/.test(id)) { syncMarkerFromField(id); A.updateChart(); }
    // Rückmeldung des Felds sofort auf „erneut prüfen“ umstellen, ohne den Fokus zu verlieren
    const fb = box.querySelector('.lk-note');
    if (f.status && f.sig !== sig(id)) {
      t.classList.remove('is-ok', 'is-bad', 'is-warn');
      if (fb) { fb.className = 'lk-note stale'; fb.textContent = 'Geändert – erneut prüfen.'; }
    }
    A.save();
    return true;
  }

  NS.Tasks = {
    init: function (app) { A = app; },
    renderTask: renderTask,
    renderResults: renderResults,
    checkField: checkField,
    onAction: onAction,
    onChange: onChange,
    onInput: onInput,
    setMarker: setMarker,
    survey: survey,
    half: half,
    released: released,
    stepState: stepState,
    current: current,
    csvText: csvText,
    report: report,
    num: num,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
