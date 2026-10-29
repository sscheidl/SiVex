/*
 * Aggregatzustände – Lernweg, Prüfung, Hilfen, Hefteintrag (ohne DOM)
 *
 * Ein gemeinsamer Lernweg in drei Schritten; die Stoffe sind frei umschaltbare
 * Beispiele. Selbstkontrolle nach docs/QUALITY.md (Redoxlabor): geschlossene
 * Formate, Rückmeldung je Feld, drei Hilfestufen auf Anforderung, „Lösung
 * anzeigen“ bewusst anzufordern, keine Benotung, keine Übermittlung.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.AZ = root.AZ || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STATES3 = { fest: 'fest', fluessig: 'flüssig', gas: 'gasförmig' };
  const gap = (id, options, correct, wrong) => ({ id, options, correct, wrong: wrong || {} });

  // ------------------------------------------------------------------ Schritt 1: Beobachten (Lückentext)
  const OBSERVE = {
    id: 'observe', n: 1, short: 'Beobachten', title: 'Beobachten auf der Stoffebene',
    intro: 'Stelle die Stoffebene ein. Verändere die Temperatur mit dem Regler und betrachte jeden der vier Stoffe. Wähle dann in jeder Lücke den passenden Begriff.',
    paragraphs: [
      ['Bei −20 °C ist Wasser ', gap('g1', STATES3, 'fest', { fluessig: 'Stelle Wasser auf −20 °C und betrachte die Probe genau.', gas: 'Stelle Wasser auf −20 °C und betrachte die Probe genau.' }),
        '. Ein fester Stoff hat ', gap('g2', { gefaess: 'die Form des Gefäßes', eigen: 'eine eigene, feste Form', keine: 'überhaupt keine bestimmte Form' }, 'eigen', { gefaess: 'Das gilt für Flüssigkeiten. Wie sieht das Eis im Becherglas aus?', keine: 'Das gilt für Gase.' }), '.'],
      ['Eine Flüssigkeit ', gap('g3', { eigen: 'behält ihre eigene Form', form: 'passt sich der Form des Gefäßes an', raum: 'füllt den ganzen Raum aus' }, 'form', { eigen: 'Beobachte, wie geschmolzenes Eisen oder Kochsalz den Tiegelboden ausfüllt.', raum: 'Eine Flüssigkeit bleibt unten im Gefäß und hat eine Oberfläche.' }),
        ' und hat eine waagrechte Oberfläche. Ein Gas ', gap('g4', { boden: 'sammelt sich am Boden des Gefäßes', ober: 'bildet eine waagrechte Oberfläche', raum: 'verteilt sich im ganzen verfügbaren Raum' }, 'raum', { boden: 'Beobachte die Gaswölkchen oberhalb der Siedetemperatur.', ober: 'Eine Oberfläche hat nur die Flüssigkeit.' }), '.'],
      ['Auch Metalle und Salze können fest, flüssig oder gasförmig sein: Bei 2000 °C ist Eisen ', gap('g5', STATES3, 'fluessig', { fest: 'Stelle Eisen auf 2000 °C. Vergleiche mit den Markierungen am Regler.', gas: 'Stelle Eisen auf 2000 °C. Vergleiche mit den Markierungen am Regler.' }),
        ', bei 1550 °C ist Kochsalz ', gap('g6', STATES3, 'gas', { fest: 'Stelle Kochsalz auf 1550 °C und vergleiche mit der Siedetemperatur.', fluessig: 'Stelle Kochsalz auf 1550 °C und vergleiche mit der Siedetemperatur.' }), '.'],
      ['Erwärmt man festes Iod, entsteht schon unterhalb von 114 °C ', gap('g7', { fluessig: 'eine Flüssigkeit', dampf: 'violetter Dampf', nichts: 'nichts Sichtbares' }, 'dampf', { fluessig: 'Stelle Iod auf etwa 90 °C und beobachte den Raum über dem Feststoff.', nichts: 'Stelle Iod auf etwa 90 °C und warte einen Moment.' }), '.'],
      ['Jeder reine Stoff schmilzt und siedet bei einer ', gap('g8', { gleich: 'für alle Stoffe gleichen Temperatur', typisch: 'bestimmten, für ihn typischen Temperatur', beliebig: 'beliebigen Temperatur' }, 'typisch', { gleich: 'Vergleiche die Markierungen am Regler bei den vier Stoffen.', beliebig: 'Ändert sich die Schmelztemperatur von Wasser, wenn du den Versuch wiederholst?' }),
        '. Schmelz- und Siedetemperatur sind deshalb ', gap('g9', { kenn: 'Kenneigenschaften', zufall: 'Zufallswerte', mess: 'Messfehler' }, 'kenn', { zufall: 'Die Werte sind für jeden Reinstoff gleich bleibend und typisch.', mess: 'Die Werte sind für jeden Reinstoff gleich bleibend und typisch.' }), ' eines Stoffes.']
    ],
    hints: [
      'Stelle jeden Stoff einmal unterhalb, zwischen und oberhalb der beiden Markierungen am Temperaturregler ein und beobachte die Probe.',
      'Unterhalb der Schmelztemperatur ist ein Stoff fest, zwischen Schmelz- und Siedetemperatur flüssig und oberhalb der Siedetemperatur gasförmig. Iod bildet schon als Feststoff etwas Dampf.',
      'Lies die Markierungen ab: Eisen 1538 °C und 2862 °C, Kochsalz 801 °C und 1465 °C, Iod 114 °C und 184 °C. Vergleiche damit die Temperaturen im Text.'
    ],
    solution: 'Unterhalb der Schmelztemperatur ist jeder der vier Stoffe fest und hat eine eigene Form. Zwischen Schmelz- und Siedetemperatur ist er flüssig, passt sich dem Gefäß an und hat eine waagrechte Oberfläche. Oberhalb der Siedetemperatur ist er gasförmig und verteilt sich im ganzen Raum. Eisen ist bei 2000 °C flüssig, Kochsalz bei 1550 °C gasförmig. Festes Iod bildet schon unterhalb von 114 °C violetten Dampf. Schmelz- und Siedetemperatur sind für jeden Reinstoff typisch: Es sind Kenneigenschaften.'
  };
  OBSERVE.gaps = OBSERVE.paragraphs.flat().filter((x) => typeof x === 'object');

  // ------------------------------------------------------------------ Schritt 2: Erklären (Ankreuzen)
  const EXPLAIN = {
    id: 'explain', n: 2, short: 'Erklären', title: 'Erklären auf der Teilchenebene',
    intro: 'Schalte auf die Teilchenebene um. Vergleiche Anordnung, Abstände und Bewegung der Teilchen im festen, flüssigen und gasförmigen Zustand.',
    questions: [
      { id: 'q1', type: 'many', legend: '1. Im festen Zustand … (alles Zutreffende ankreuzen)',
        options: { order: '… sind die Teilchen regelmäßig angeordnet.', still: '… bewegen sich die Teilchen gar nicht.', vib: '… schwingen die Teilchen auf ihren Plätzen hin und her.', small: '… sind die Teilchen kleiner als im flüssigen Zustand.', hold: '… halten die Teilchen durch starke Anziehung fest zusammen.' },
        correct: ['order', 'vib', 'hold'],
        misc: { still: 'Schau genau hin: Auch im Feststoff zittern die Teilchen auf ihren Plätzen.', small: 'Die Teilchen behalten in allen Zuständen ihre Größe.' } },
      { id: 'q2', type: 'many', legend: '2. Im flüssigen Zustand … (alles Zutreffende ankreuzen)',
        options: { bigger: '… sind die Teilchen größer als im festen Zustand.', close: '… sind die Teilchen ungeordnet, bleiben aber eng beieinander.', far: '… sind die Abstände zwischen den Teilchen sehr groß.', glide: '… bewegen sich die Teilchen ständig und gleiten aneinander vorbei.' },
        correct: ['close', 'glide'],
        misc: { bigger: 'Die Teilchen dehnen sich nicht aus – nur ihre Anordnung ändert sich.', far: 'Große Abstände gibt es erst im Gas.' } },
      { id: 'q3', type: 'many', legend: '3. Im gasförmigen Zustand … (alles Zutreffende ankreuzen)',
        options: { far: '… sind die Abstände zwischen den Teilchen groß.', still: '… stehen die Teilchen still.', fast: '… bewegen sich die Teilchen schnell und ungeordnet durch den ganzen Raum.', noattr: '… ziehen sich die Teilchen überhaupt nicht mehr an.', bounce: '… stoßen die Teilchen aneinander und an die Wand und ändern dabei ihre Richtung.' },
        correct: ['far', 'fast', 'bounce'],
        misc: { still: 'Beobachte die Gasteilchen: Sie fliegen schnell umher.', noattr: 'Die Anziehung verschwindet nicht – sie kann die schnellen, weit entfernten Teilchen aber kaum noch zusammenhalten.' } },
      { id: 'q4', type: 'one', legend: '4. Was geschieht beim Schmelzen auf der Teilchenebene?',
        options: { soft: 'Die Teilchen selbst werden weich und schmelzen.', move: 'Die Teilchen bewegen sich stärker und verlassen ihre festen Plätze. Die Teilchen selbst bleiben gleich.', grow: 'Die Teilchen dehnen sich aus und werden größer.', new: 'Es entstehen neue Teilchen.' },
        correct: 'move',
        misc: { soft: 'Weich werden und schmelzen kann nur der Stoff. Die einzelnen Teilchen verändern sich im Modell nicht.', grow: 'Vergleiche die Größe der Symbole vor und nach dem Schmelzen.', new: 'Zähle nach: Die Zahl der Teilchen bleibt gleich.' } },
      { id: 'q5', type: 'one', legend: '5. Wasser verdampft vollständig. Wie viele Wasserteilchen gibt es danach?',
        options: { none: 'keine mehr – die Teilchen sind verschwunden', fewer: 'weniger als vorher', same: 'genauso viele wie vorher – sie sind nur weit verteilt', more: 'mehr als vorher' },
        correct: 'same',
        misc: { none: 'Beim Verdampfen verschwinden keine Teilchen – sie verteilen sich im Raum.', fewer: 'Zähle auf der Teilchenebene vor und nach dem Verdampfen.', more: 'Zähle auf der Teilchenebene vor und nach dem Verdampfen.' } }
    ],
    hints: [
      'Stelle einen Stoff auf der Teilchenebene nacheinander fest, flüssig und gasförmig ein. Vergleiche jeweils Anordnung, Abstände und Bewegung.',
      'Achte darauf, ob die Teilchen ihre Größe ändern oder verschwinden. Zähle zur Not einige Teilchen vor und nach dem Verdampfen.',
      'Fest: regelmäßig, schwingen auf ihren Plätzen. Flüssig: ungeordnet, eng beieinander, gleiten aneinander vorbei. Gas: große Abstände, schnell, stoßen zusammen. Die Teilchen selbst bleiben immer gleich.'
    ],
    solution: 'Im Feststoff sitzen die Teilchen regelmäßig auf festen Plätzen und schwingen dort; die Anziehung hält sie fest zusammen. In der Flüssigkeit sind sie ungeordnet, bleiben aber eng beieinander und gleiten aneinander vorbei. Im Gas sind die Abstände groß; die Teilchen fliegen schnell und ungeordnet, stoßen zusammen und ändern dabei ihre Richtung. Die Anziehung wirkt weiter, kann die schnellen Teilchen aber kaum zusammenhalten. Bei allen Übergängen bleiben Zahl und Größe der Teilchen gleich – es ändern sich nur Anordnung, Abstände und Bewegung.'
  };

  // ------------------------------------------------------------------ Schritt 3: Phasenübergänge (Zuordnen)
  const TERMS = { schmelzen: 'Schmelzen', erstarren: 'Erstarren', verdampfen: 'Verdampfen', kondensieren: 'Kondensieren', sublimieren: 'Sublimieren', resublimieren: 'Resublimieren', loesen: 'Lösen', verbrennen: 'Verbrennen' };
  const TERM_OPTIONS = Object.keys(TERMS).sort((a, b) => TERMS[a].localeCompare(TERMS[b], 'de')).reduce((o, k) => { o[k] = TERMS[k]; return o; }, {});
  const PAIRS = { schmelzen: 'erstarren', erstarren: 'schmelzen', verdampfen: 'kondensieren', kondensieren: 'verdampfen', sublimieren: 'resublimieren', resublimieren: 'sublimieren' };
  const TRANSITIONS = {
    id: 'transitions', n: 3, short: 'Übergänge', title: 'Die sechs Phasenübergänge',
    intro: 'Ordne jedem Übergang den Fachbegriff zu. Beim Iod hilft die Schaltfläche „Kalte Oberfläche einblenden“. Unterscheide zwischen dem, was man beobachtet, und der Erklärung im Teilchenmodell.',
    questions: [
      { id: 'q1', type: 'assign', legend: '1. Ordne die Fachbegriffe zu.', options: TERM_OPTIONS,
        rows: [
          { id: 'sl', label: 'fest → flüssig', correct: 'schmelzen' },
          { id: 'ls', label: 'flüssig → fest', correct: 'erstarren' },
          { id: 'lg', label: 'flüssig → gasförmig', correct: 'verdampfen' },
          { id: 'gl', label: 'gasförmig → flüssig', correct: 'kondensieren' },
          { id: 'sg', label: 'fest → gasförmig', correct: 'sublimieren' },
          { id: 'gs', label: 'gasförmig → fest', correct: 'resublimieren' }
        ] },
      { id: 'q2', type: 'one', legend: '2. Am kalten Uhrglas entstehen dunkle Iodkristalle direkt aus dem violetten Ioddampf. Dieser Vorgang heißt …',
        options: { kond: 'Kondensieren', erst: 'Erstarren', resub: 'Resublimieren', sub: 'Sublimieren' }, correct: 'resub',
        misc: { kond: 'Beim Kondensieren entsteht eine Flüssigkeit. Am Uhrglas entsteht direkt ein Feststoff.', erst: 'Erstarren beginnt bei einer Flüssigkeit. Hier beginnt der Vorgang beim Gas.', sub: 'Sublimieren ist die Gegenrichtung: fest → gasförmig.' } },
      { id: 'q3', type: 'one', legend: '3. Welche Aussage über Iod trifft zu?',
        options: { never: 'Iod kann nie flüssig werden, es sublimiert immer.', room: 'Iod schmilzt schon bei Raumtemperatur.', both: 'Festes Iod sublimiert beim Erwärmen schon unterhalb von 114 °C teilweise; zwischen 114 °C und 184 °C ist Iod flüssig.', other: 'Der violette Dampf ist ein anderer Stoff als Iod.' },
        correct: 'both',
        misc: { never: 'Stelle Iod auf 150 °C: Was siehst du im Becherglas?', room: 'Bei 25 °C ist Iod fest – vergleiche mit der Schmelztemperatur.', other: 'Der Dampf besteht aus denselben Iodteilchen wie der Feststoff.' } },
      { id: 'q4', type: 'assign', legend: '4. Beobachtung oder Erklärung im Teilchenmodell?', options: { obs: 'Beobachtung', model: 'Erklärung im Teilchenmodell' },
        rows: [
          { id: 'o1', label: 'Über dem festen Iod bildet sich violetter Dampf.', correct: 'obs' },
          { id: 'o2', label: 'Teilchen lösen sich aus dem Feststoff und fliegen frei umher.', correct: 'model' },
          { id: 'o3', label: 'An der Unterseite des kalten Uhrglases wachsen dunkle Kristalle.', correct: 'obs' },
          { id: 'o4', label: 'Gasteilchen treffen auf die kalte Fläche und lagern sich dort regelmäßig an.', correct: 'model' }
        ] }
    ],
    hints: [
      'Jeder Fachbegriff beschreibt eine Richtung: von welchem Zustand in welchen?',
      'Schmelzen und Erstarren betreffen fest ↔ flüssig, Verdampfen und Kondensieren flüssig ↔ gasförmig, Sublimieren und Resublimieren fest ↔ gasförmig. Lösen und Verbrennen sind keine Phasenübergänge.',
      'Eine Beobachtung beschreibt, was man sieht (Farbe, Dampf, Kristalle). Eine Erklärung spricht von Teilchen. Am kalten Uhrglas wird aus dem Gas direkt ein Feststoff.'
    ],
    solution: 'fest → flüssig: Schmelzen; flüssig → fest: Erstarren; flüssig → gasförmig: Verdampfen; gasförmig → flüssig: Kondensieren; fest → gasförmig: Sublimieren; gasförmig → fest: Resublimieren. Festes Iod sublimiert beim Erwärmen teilweise schon unterhalb seiner Schmelztemperatur; zwischen 114 °C und 184 °C ist es flüssig. Am kalten Uhrglas resublimiert der Ioddampf zu dunklen Kristallen. Violetter Dampf und Kristalle sind Beobachtungen; dass sich Teilchen lösen bzw. regelmäßig anlagern, ist die Erklärung im Teilchenmodell.'
  };

  const STEPS = [OBSERVE, EXPLAIN, TRANSITIONS];
  const STEP_BY_ID = { observe: OBSERVE, explain: EXPLAIN, transitions: TRANSITIONS };

  /** Alle Eingabefelder eines Schritts: { key, kind, def } (key = Formularname). */
  function fields(stepId) {
    const st = STEP_BY_ID[stepId];
    if (st.gaps) return st.gaps.map((g) => ({ key: g.id, kind: 'gap', def: g }));
    const out = [];
    for (const q of st.questions) {
      if (q.type === 'assign') q.rows.forEach((r) => out.push({ key: `${q.id}.${r.id}`, kind: 'row', def: r, q }));
      else out.push({ key: q.id, kind: q.type, def: q, q });
    }
    return out;
  }

  /** Antworten prüfen: jedes Feld einzeln, Eingaben bleiben erhalten. */
  function grade(stepId, answers) {
    const res = {};
    let correct = 0;
    const fs = fields(stepId);
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
          const cor = f.def.correct;
          ok = String(a) === String(cor);
          if (!ok) {
            if (f.kind === 'gap') feedback = (f.def.wrong && f.def.wrong[a]) || 'Das passt nicht zu deiner Beobachtung.';
            else if (f.kind === 'one') feedback = (f.def.misc && f.def.misc[a]) || 'Noch nicht richtig.';
            else if (PAIRS[cor] === a) feedback = 'Achte auf die Richtung: Das ist die Gegenrichtung.';
            else if (a === 'loesen' || a === 'verbrennen') feedback = `${TERMS[a]} ist kein Phasenübergang.`;
            else if (f.q && f.q.id === 'q4') feedback = a === 'obs' ? 'Sieht man Teilchen? Hier wird etwas mit dem Modell erklärt.' : 'Das kann man direkt sehen – ohne Teilchenmodell.';
            else feedback = 'Das ist ein anderer Übergang.';
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

  /** Musterantworten für „Lösung anzeigen“. */
  function solutionAnswers(stepId) {
    const out = {};
    for (const f of fields(stepId)) out[f.key] = f.def.correct;
    return out;
  }
  /** Vollständig bearbeitet (jedes Feld hat eine Antwort)? */
  function complete(stepId, answers) {
    return fields(stepId).every((f) => { const a = answers[f.key]; return Array.isArray(a) ? a.length > 0 : a != null && a !== ''; });
  }

  // ------------------------------------------------------------------ Hefteintrag
  const NOTEBOOK = {
    title: 'Aggregatzustände und Teilchenmodell',
    states: [
      ['fest', 'Teilchen regelmäßig angeordnet, schwingen auf ihren Plätzen, halten fest zusammen – eigene Form.'],
      ['flüssig', 'Teilchen ungeordnet und eng beieinander, gleiten aneinander vorbei – passt sich dem Gefäß an.'],
      ['gasförmig', 'Teilchen weit voneinander entfernt, schnell und ungeordnet – füllt den ganzen Raum.']
    ],
    transitions: [['fest', 'flüssig', 'Schmelzen'], ['flüssig', 'fest', 'Erstarren'], ['flüssig', 'gasförmig', 'Verdampfen'], ['gasförmig', 'flüssig', 'Kondensieren'], ['fest', 'gasförmig', 'Sublimieren'], ['gasförmig', 'fest', 'Resublimieren']],
    rules: [
      '**Schmelztemperatur** und **Siedetemperatur** sind **Kenneigenschaften** eines Reinstoffs.',
      'Bei Phasenübergängen bleiben die Teilchen gleich; es ändern sich Anordnung, Abstände und Bewegung.'
    ]
  };
  function notebookWords() {
    const parts = [NOTEBOOK.title, ...NOTEBOOK.states.map((s) => s.join(' ')), ...NOTEBOOK.transitions.map((t) => t.join(' ')), ...NOTEBOOK.rules];
    return parts.join(' ').replace(/\*\*/g, '').replace(/[→–:,.]/g, ' ').split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;
  }

  return { STEPS, STEP_BY_ID, TERMS, NOTEBOOK, fields, grade, solutionAnswers, complete, notebookWords };
});
