// Aufgaben, Kontrolle und Hefteintrag: Bewertung, Toleranz, Vollständigkeit.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../js/tasks.js');
const M = require('../../js/model.js');

test('Einordnung je Versuch: richtige Antwort wird erkannt, falsche mit Begründung', () => {
  const want = { 1: ['het', 'suspension'], 2: ['het', 'suspension'], 3: ['hom', 'loesung'], 4: ['het', 'emulsion'], 5: ['het', 'gemenge'] };
  for (const n of M.EXP_IDS) {
    const [hom, kind] = want[n];
    assert.ok(T.checkCls(n, { hom, kind }).all, 'Versuch ' + n);
    const wrong = T.checkCls(n, { hom: hom === 'hom' ? 'het' : 'hom', kind: 'reinstoff' });
    assert.equal(wrong.all, false);
    assert.ok(wrong.hom.fb.length > 20 && wrong.kind.fb.length > 20, 'Rückmeldung erklärt den Fehler');
  }
  assert.equal(T.checkCls(1, {}).hom.fb, 'Noch nicht gewählt.');
});

test('Trennprinzip (TV05): unmittelbares Trennprinzip verlangt, Unlöslichkeit als Voraussetzung nicht als Fehler', () => {
  // Sedimentieren: Dichte genügt; Löslichkeit ist erlaubt (Voraussetzung), aber nicht nötig
  assert.ok(T.checkPrin(1, ['dichte']).ok);
  const v1 = T.checkPrin(1, ['dichte', 'loes']);
  assert.ok(v1.ok); assert.equal(v1.items.loes, 'neutral'); assert.match(v1.notes[0], /Voraussetzung/);
  assert.equal(T.checkPrin(1, ['loes']).ok, false, 'Dichte fehlt');
  // Filtrieren: Korngröße genügt
  assert.ok(T.checkPrin(2, ['korn']).ok);
  assert.ok(T.checkPrin(2, ['korn', 'loes']).ok);
  assert.equal(T.checkPrin(2, ['korn', 'dichte']).ok, false, 'Dichte trennt beim Filtrieren nicht');
  // Eindampfen
  assert.ok(T.checkPrin(3, ['fluecht']).ok);
  // Scheiden: Nichtmischbarkeit und Dichte; Löslichkeitskreuz wird erläutert, nicht als falsch gewertet
  assert.ok(T.checkPrin(4, ['misch', 'dichte']).ok);
  const v4 = T.checkPrin(4, ['misch', 'dichte', 'loes']);
  assert.ok(v4.ok); assert.match(v4.notes[0], /Nichtmischbarkeit/);
  assert.equal(T.checkPrin(4, ['dichte']).ok, false);
  // Trennkette
  assert.ok(T.checkPrin(5, ['magn', 'loes', 'korn', 'fluecht']).ok);
  assert.equal(T.checkPrin(5, ['magn', 'loes', 'korn']).ok, false);
  // Farbe ist nie ein Trennprinzip
  for (const n of M.EXP_IDS) { assert.ok(!T.EXP[n].prin.includes('farbe')); assert.equal(T.checkPrin(n, [...T.EXP[n].prin, 'farbe']).ok, false); }
  assert.match(T.PRINCIPLE_WHY.korn, /keine Kenneigenschaft/);
  // Beschriftung: Dichte statt „schwerer“, Löslichkeit eindeutig auf Feststoffe bezogen
  const lab = Object.fromEntries(T.PRINCIPLES.map((p) => [p.id, p.label]));
  assert.match(lab.dichte, /geringeren Dichte liegt oben/); assert.match(lab.loes, /Feststoffs/); assert.match(lab.misch, /Nichtmischbarkeit/);
});

test('Texte (TV14): keine „schwerer“-Formulierung, Beobachtungsfragen ohne vorweggenommene Antworten, Dampf fachlich korrekt', () => {
  const all = JSON.stringify({ P: T.PRINCIPLES, W: T.PRINCIPLE_WHY, E: Object.values(T.EXP).map((x) => [x.problem, x.goal, x.obsHint, x.explHint, x.sample, x.solution]), Q: T.QUIZ, N: T.NOTEBOOK });
  assert.doesNotMatch(all, /schwerere?\b/i, 'Dichte nicht mit Masse verwechseln');
  assert.doesNotMatch(all, /weißer Wasserdampf|Wasserdampf ist weiß/i);
  for (const n of M.EXP_IDS) {
    const h = T.EXP[n].obsHint;
    assert.doesNotMatch(h, /\(/, `Versuch ${n}: keine Klammer-Aufzählung`);
    assert.doesNotMatch(h, /Kristall|Dunst|Dampf|Trübung|trüb|Bodensatz|Tröpfchen|Schicht|Grenzfläche|Rückstand|klar/i, `Versuch ${n}: keine vorweggenommene Beobachtung`);
    assert.ok(T.EXP[n].sample && T.EXP[n].sample.length > 80, `Versuch ${n}: Musterbeobachtung`);
  }
  assert.equal(T.EXP[3].obsHint, 'Beschreibe, was du während des Erwärmens und nach dem Abkühlen beobachtest.');
  const nb3 = T.NOTEBOOK.cards[2];
  assert.match(nb3.stoff + nb3.result, /Dampf/); assert.match(nb3.result, /unsichtbar/); assert.match(nb3.result, /kondensierten Wassertröpfchen/);
  // Versuch 4: Schütteln ist freiwillig
  assert.match(T.EXP[4].problem, /Freiwillig/);
  assert.ok(T.EXP[4].solution.findIndex((x) => /Freiwillig/.test(x)) > 1, 'Schütteln erst als Zusatz nach dem Trennweg');
});

test('Kontrolle: 8–10 Aufgaben, alle vier Perspektiven, Angabe zur Mehrfachauswahl, jede falsche Option begründet', () => {
  assert.ok(T.QUIZ.length >= 8 && T.QUIZ.length <= 10, 'Anzahl ' + T.QUIZ.length);
  for (const g of T.QUIZ_GROUPS) assert.ok(T.QUIZ.some((q) => q.group === g.id), 'Gruppe ' + g.id);
  for (const q of T.QUIZ) {
    const right = q.opts.filter((o) => o.ok).length;
    assert.ok(right >= 1);
    if (!q.multi) assert.equal(right, 1, q.id + ' Einfachauswahl hat genau eine richtige Antwort');
    for (const o of q.opts) if (!o.ok) assert.ok(o.why && o.why.length > 15, q.id + ': Begründung für ' + o.t);
  }
  const text = T.QUIZ.map((q) => q.q + ' ' + q.opts.map((o) => o.t).join(' ')).join(' ');
  for (const w of [/klar/i, /Filter/, /Extrahieren/, /gasförmig/, /Kristall/, /mischbar/, /Dichte/, /Magnet/, /neue Stoffe/, /geschmolzen/, /Öltröpfchen/, /Sandkorn/, /Dekantieren/, /Suspension/, /Emulsion/, /Gemenge/])
    assert.match(text, w, 'Inhalt ' + w);
});

test('Kontrolle: richtige, falsche und teilweise richtige Mehrfachauswahl', () => {
  const q = T.QUIZ.find((x) => x.id === 'q5');
  const right = q.opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0);
  assert.ok(T.checkQuizItem(q, right).ok);
  const partial = T.checkQuizItem(q, [right[0]]);
  assert.equal(partial.ok, false); assert.match(partial.fb, /fehlt noch eine/);
  const wrong = T.checkQuizItem(q, [...right, 1]);
  assert.equal(wrong.ok, false); assert.match(wrong.fb, /bleibt in der Schale/);
  assert.equal(T.checkQuizItem(q, []).ok, false);
});

test('Lückentext: 8–10 Begriffe, tolerant bei Groß-/Kleinschreibung, Synonymen und Tippfehlern; Sperrwörter erklärt', () => {
  assert.ok(T.GAPS.length >= 8 && T.GAPS.length <= 10);
  const all = Object.fromEntries(T.GAPS.map((g) => [g.gap, g.accept[0]]));
  assert.ok(T.checkGaps(all).all);
  const lower = Object.fromEntries(T.GAPS.map((g) => [g.gap, g.accept[0].toLowerCase()]));
  assert.ok(T.checkGaps(lower).all, 'Kleinschreibung');
  const syn = Object.assign({}, all, { g2: 'Sedimentation', g3: 'Abgießen', g6: 'Kochsalzlösung', g7: 'abdampfen', g10: 'extrahieren' });
  assert.ok(T.checkGaps(syn).all, 'gleichwertige Begriffe');
  const typo = T.checkGaps(Object.assign({}, all, { g1: 'Suspention' }));
  assert.ok(typo.items.g1.ok && typo.items.g1.status === 'typo');
  const forb = T.checkGaps(Object.assign({}, all, { g5: 'Rückstand', g7: 'Verdampfen' }));
  assert.equal(forb.items.g5.status, 'forbidden'); assert.equal(forb.items.g7.status, 'forbidden');
  assert.ok(forb.items.g4.ok, 'richtige Lücken bleiben richtig');
  for (const w of ['Lösung', 'Suspension', 'Emulsion', 'Gemenge', 'Filtrat', 'Rückstand', 'Extraktion']) assert.ok(T.WORDBANK.includes(w), w);
});

test('Hefteintrag: Gemischarten, fünf Versuchskarten mit allen Rubriken, Trennkette, Merksätze', () => {
  const NB = T.NOTEBOOK;
  assert.deepEqual(NB.kinds.map((k) => k[0]), ['Lösung', 'Suspension', 'Emulsion', 'Gemenge']);
  assert.equal(NB.cards.length, 5);
  for (const c of NB.cards) for (const k of ['mix', 'stoff', 'teilchen', 'zustand', 'prinzip', 'result']) assert.ok(c[k] && c[k].length > 20, `Karte ${c.n}: ${k}`);
  // Aggregatzustandsänderung nur, wo sie stattfindet
  assert.match(NB.cards[2].zustand, /flüssig → gasförmig/);
  for (const i of [0, 1, 3]) assert.match(NB.cards[i].zustand, /kein Wechsel/);
  assert.doesNotMatch(NB.cards[1].zustand + NB.cards[1].teilchen, /wird fest/);
  assert.equal(NB.chain.length, 4);
  const merke = NB.merke.join(' ');
  assert.match(merke, /keine neuen Stoffe/); assert.match(merke, /kein Aggregatzustand/);
  assert.match(NB.intro.join(' '), /Klar bedeutet nicht rein/);
});

test('Hilfen: drei Stufen je Versuch, zustandsabhängig ausführbar; Vorgehen vollständig', () => {
  for (const n of M.EXP_IDS) {
    const e = M.createEngine(n);
    assert.equal(T.EXP[n].tips.length, 3);
    for (const f of T.EXP[n].tips) assert.ok(f(e.state, e.evaluate()).length > 20);
    assert.ok(T.EXP[n].solution.length >= 4);
  }
});
