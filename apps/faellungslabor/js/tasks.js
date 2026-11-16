/*
 * Fällungslabor – Aufgaben, Hilfen, Lösungen, Hefteintrag (ohne DOM, in Node testbar)
 *
 * Geschlossene Formate nach der Lern- und Auswertungsstruktur (docs/QUALITY.md, Vorbild Redoxlabor):
 * „Wähle eine richtige Antwort“ (one), „Wähle alle zutreffenden Aussagen“ (many) und Zuordnungen
 * (assign). Darstellung über das Labkit (LK.learn.taskHtml); die Prüfung ergänzt das Labkit um eine
 * konkrete Rückmeldung je angekreuzter Aussage (richtige Teilantworten werden benannt).
 * Mehrfachauswahl ist nur mit genau der richtigen Menge vollständig richtig; leer oder „alles
 * ankreuzen“ besteht nie. Keine Bewertung von Freitext, keine Übermittlung.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const learn = isNode ? require('../../../shared/labkit/js/learn.js') : root.LK.learn;
  const api = factory(learn);
  if (isNode) module.exports = api;
  else (root.FL = root.FL || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function (LL) {
  'use strict';

  // ------------------------------------------------------------------ Gleichungen
  const SUB = { Cl: 'Cl', Br: 'Br', I: 'I' };
  const NAMES = { Cl: 'Natriumchloridlösung', Br: 'Natriumbromidlösung', I: 'Natriumiodidlösung' };
  const EQ = {
    full: (X) => `Na⁺(aq) + ${X}⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → Ag${X}(s) + Na⁺(aq) + NO₃⁻(aq)`,
    net: (X) => `Ag⁺(aq) + ${X}⁻(aq) → Ag${X}(s)`,
    state: (X) => `Na⁺(aq) + ${X}⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → Ag${X}(aq) + Na⁺(aq) + NO₃⁻(aq)`,
    solid: (X) => `Na⁺(aq) + ${X}⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → NaNO₃(s) + Ag⁺(aq) + ${X}⁻(aq)`,
    charge: (X) => `Na⁺(aq) + ${X}⁺(aq) + Ag⁻(aq) + NO₃⁻(aq) → Ag${X}(s) + Na⁺(aq) + NO₃⁻(aq)`,
    formula: (X) => `Na${X}(aq) + AgNO₃(aq) → Ag${X}(s) + NaNO₃(aq)`,
    spect: (X) => `Na⁺(aq) + ${X}⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → Ag${X}(s)`
  };
  const EQ_FB = {
    net: 'Die Fällungsreaktion ist richtig dargestellt. Ergänze die Zuschauerionen zur vollständigen Ionengleichung.',
    state: 'Der Niederschlag ist ein Feststoff – Zustandsangabe (s), nicht (aq).',
    solid: 'Natriumnitrat ist gut löslich und fällt nicht aus. Der Niederschlag ist das Silberhalogenid.',
    charge: 'Prüfe die Ladungen: Silberionen sind einfach positiv, Halogenidionen einfach negativ geladen.',
    formula: 'Das ist eine Gleichung mit Salzformeln. Gelöste Salze liegen als Ionen vor – schreibe die Ionen einzeln.',
    spect: 'Die Zuschauerionen Na⁺ und NO₃⁻ verschwinden nicht – sie stehen auch rechts, gelöst.'
  };
  function eqQuestion(h, order) {
    const X = SUB[h];
    const options = {}, misc = {};
    order.forEach((k, i) => { const key = String.fromCharCode(97 + i); options[key] = EQ[k](X); if (EQ_FB[k]) misc[key] = EQ_FB[k]; });
    return { id: 'eq' + h, type: 'one', legend: `Wähle eine richtige Antwort: vollständige Ionengleichung für ${NAMES[h]} + Silbernitratlösung`, options, misc, correct: String.fromCharCode(97 + order.indexOf('full')), equation: true };
  }

  // ------------------------------------------------------------------ Hauptteil
  const STEPS = [
    {
      id: 'beob', n: 1, short: 'Beobachten', title: 'Beobachtungen zuordnen',
      intro: 'Führe die drei Fällungen selbst durch und vergleiche die Reagenzgläser – direkt nach dem Zutropfen, nach dem Stehenlassen und nach dem Schwenken.',
      questions: [
        {
          id: 'farbe', type: 'assign', legend: 'Wähle für jede Probe die passende Beobachtung nach Zugabe von Silbernitratlösung.',
          options: { weiss: 'weißer Niederschlag', creme: 'cremefarbener bis schwach gelber Niederschlag', gelb: 'blassgelber Niederschlag', kein: 'kein Niederschlag' },
          rows: [
            { id: 'nacl', label: 'Natriumchloridlösung', correct: 'weiss', wrong: { kein: 'Hier entsteht ein Niederschlag – schau noch einmal genau hin.', creme: 'Vergleiche vor dem dunklen Hintergrund: Dieser Niederschlag ist der hellste der drei.', gelb: 'Vergleiche vor dem dunklen Hintergrund: Dieser Niederschlag ist der hellste der drei.' } },
            { id: 'nabr', label: 'Natriumbromidlösung', correct: 'creme', wrong: { kein: 'Hier entsteht ein Niederschlag – schau noch einmal genau hin.', weiss: 'Vergleiche direkt mit der Chloridprobe: Dieser Niederschlag ist leicht getönt.', gelb: 'Vergleiche direkt mit der Iodidprobe: Dieser Niederschlag ist weniger gelb.' } },
            { id: 'nai', label: 'Natriumiodidlösung', correct: 'gelb', wrong: { kein: 'Hier entsteht ein Niederschlag – schau noch einmal genau hin.', weiss: 'Vergleiche direkt mit der Chloridprobe: Dieser Niederschlag ist deutlich gelblich.', creme: 'Vergleiche direkt mit der Bromidprobe: Dieser Niederschlag ist deutlicher gelb.' } }
          ]
        },
        {
          id: 'ablauf', type: 'many', legend: 'Wähle alle zutreffenden Aussagen.',
          options: {
            a: 'Wo ein Tropfen Silbernitratlösung auftrifft, entsteht sofort eine Trübung (Wolke).',
            b: 'Die Trübung verteilt sich nach und nach in der Lösung.',
            c: 'Lässt man das Reagenzglas stehen, setzt sich der Niederschlag ab; darüber wird die Flüssigkeit klarer.',
            d: 'Beim Schwenken wird der abgesetzte Niederschlag wieder aufgewirbelt.',
            e: 'Beim Schwenken löst sich der Niederschlag auf.',
            f: 'Die Probelösungen sind schon vor der Zugabe trüb.'
          },
          correct: ['a', 'b', 'c', 'd'],
          misc: {
            e: 'Schwenken verteilt den Feststoff nur – die Menge bleibt gleich; beim Stehenlassen setzt er sich wieder ab.',
            f: 'Die Natriumhalogenidlösungen sind klar und farblos; die Trübung entsteht erst mit Silbernitratlösung.'
          }
        }
      ],
      hints: [
        'Beobachte die Reagenzgläser direkt nach einem Tropfen, nach einer halben Minute Stehenlassen und nach dem Schwenken.',
        'Alle drei Proben bilden einen Niederschlag. Einer ist rein weiß, die anderen beiden sind gelblich getönt – unterschiedlich stark. Der dunkle Hintergrund hilft beim Vergleich.',
        'Chlorid: weiß; Bromid: cremefarben bis schwach gelb; Iodid: blassgelb. Schwenken wirbelt den Niederschlag nur auf, es löst ihn nicht.'
      ],
      solution: 'Natriumchloridlösung gibt einen weißen, Natriumbromidlösung einen cremefarbenen bis schwach gelben und Natriumiodidlösung einen blassgelben Niederschlag. Am Eintreffpunkt jedes Tropfens entsteht sofort eine Wolke, die sich verteilt; beim Stehenlassen setzt sich der Feststoff ab, beim Schwenken wird er wieder aufgewirbelt.'
    },
    {
      id: 'ionen', n: 2, short: 'Ionen', title: 'Reagierende Ionen und Zuschauerionen',
      intro: 'In den Lösungen liegen Ionen vor. Entscheide, welche Ionen den Niederschlag bilden und welche gelöst bleiben.',
      questions: [
        {
          id: 'rolle', type: 'assign', legend: 'Wähle für jede Ionenart ihre Rolle bei der Fällung.',
          options: { fest: 'bildet den Niederschlag', zus: 'bleibt gelöst (Zuschauerion)' },
          rows: [
            { id: 'ag', label: 'Silberion Ag⁺', correct: 'fest', wrong: { zus: 'Ohne Silberionen entsteht kein Niederschlag – Ag⁺ ist Teil des Feststoffs.' } },
            { id: 'x', label: 'Halogenidion Cl⁻, Br⁻ bzw. I⁻', correct: 'fest', wrong: { zus: 'Das Halogenidion bildet zusammen mit Ag⁺ den Feststoff.' } },
            { id: 'na', label: 'Natriumion Na⁺', correct: 'zus', wrong: { fest: 'Natriumsalze sind gut löslich: Na⁺ bleibt gelöst und ist nicht im Niederschlag.' } },
            { id: 'no3', label: 'Nitration NO₃⁻', correct: 'zus', wrong: { fest: 'Nitrate sind gut löslich: NO₃⁻ bleibt gelöst.' } }
          ]
        },
        {
          id: 'aussagen', type: 'many', legend: 'Wähle alle zutreffenden Aussagen.',
          options: {
            a: 'Nach der Fällung sind Na⁺- und NO₃⁻-Ionen weiterhin in der Flüssigkeit gelöst.',
            b: 'Der Niederschlag besteht aus Silberionen und Halogenidionen.',
            c: 'Natriumionen sind ein Bestandteil des Niederschlags.',
            d: 'Nach der Fällung sind keine Ionen mehr in der Flüssigkeit.',
            e: 'In der Natriumchloridlösung liegen NaCl-Moleküle vor.'
          },
          correct: ['a', 'b'],
          misc: {
            c: 'Na⁺ bleibt gelöst – im Niederschlag ist kein Natrium.',
            d: 'Die Zuschauerionen (und ein Überschuss an Ag⁺ oder Halogenidionen) bleiben gelöst.',
            e: 'Ein gelöstes Salz liegt als einzelne, von Wasser umhüllte Ionen vor (Na⁺(aq), Cl⁻(aq)), nicht als Moleküle.'
          }
        }
      ],
      hints: [
        'Überlege, welches Ionenpaar einen schwer löslichen Feststoff bildet. Natrium- und Nitratsalze sind gut löslich.',
        'Zwei Ionenarten bilden den Feststoff, zwei bleiben gelöst. Ein gelöstes Salz liegt als einzelne Ionen vor.',
        'Ag⁺ und das Halogenidion bilden den Niederschlag; Na⁺ und NO₃⁻ sind Zuschauerionen und bleiben gelöst.'
      ],
      solution: 'Silberionen und Halogenidionen bilden den schwer löslichen Feststoff. Natrium- und Nitrationen nehmen nicht teil: Sie bleiben als Zuschauerionen gelöst. Gelöste Salze liegen als Ionen vor, nicht als Moleküle.'
    },
    {
      id: 'gleich', n: 3, short: 'Gleichungen', title: 'Vollständige Ionengleichungen',
      intro: 'Eine vollständige Ionengleichung enthält alle beteiligten gelösten Ionen – auch die Zuschauerionen – mit Ladungen und Zustandsangaben.',
      questions: [
        eqQuestion('Cl', ['net', 'charge', 'full', 'state', 'solid']),
        eqQuestion('Br', ['formula', 'state', 'net', 'full', 'solid']),
        eqQuestion('I', ['full', 'spect', 'charge', 'net', 'state'])
      ],
      hints: [
        'Schreibe zuerst auf, welche Ionen in den beiden Lösungen vorliegen – sie stehen alle links.',
        'Rechts stehen der Feststoff mit (s) und die Zuschauerionen mit (aq). Ladungen: Na⁺, Ag⁺, NO₃⁻ und das Halogenidion mit einer negativen Ladung.',
        'Muster: Na⁺(aq) + X⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgX(s) + Na⁺(aq) + NO₃⁻(aq), mit X = Cl, Br oder I.'
      ],
      solution: `${EQ.full('Cl')}; ${EQ.full('Br')}; ${EQ.full('I')}. Lässt man die Zuschauerionen weg, bleibt die gekürzte Ionengleichung Ag⁺(aq) + X⁻(aq) → AgX(s).`
    },
    {
      id: 'nh3', n: 4, short: 'Ammoniak', title: 'Erweiterung: Ammoniakprüfung', optional: true,
      intro: 'Gib zu gefällten Ansätzen verdünnte bzw. konzentrierte Ammoniaklösung und schwenke. Vergleiche dazu frisch und gleich angesetzte Proben nebeneinander.',
      questions: [
        {
          id: 'loes', type: 'assign', legend: 'Wähle für jeden Niederschlag die passende Beobachtung.',
          options: { dil: 'löst sich bei ausreichender Zugabe verdünnter Ammoniaklösung', conc: 'bleibt in verdünnter weitgehend bestehen, löst sich in konzentrierter', none: 'bleibt auch in konzentrierter Ammoniaklösung sichtbar bestehen' },
          rows: [
            { id: 'nacl', label: 'Niederschlag aus der Natriumchloridprobe', correct: 'dil', wrong: { conc: 'Prüfe mit mehreren Millilitern verdünnter Ammoniaklösung und schwenke – dieser Niederschlag löst sich schon darin.', none: 'Dieser Niederschlag löst sich bei ausreichender Zugabe auf – gib mehr Ammoniaklösung zu und schwenke.' } },
            { id: 'nabr', label: 'Niederschlag aus der Natriumbromidprobe', correct: 'conc', wrong: { dil: 'Gib verdünnte Ammoniaklösung in üblicher Menge zu (etwa gleiches Volumen): Der Niederschlag bleibt weitgehend.', none: 'Vergleiche mit konzentrierter Ammoniaklösung in ausreichender Menge.' } },
            { id: 'nai', label: 'Niederschlag aus der Natriumiodidprobe', correct: 'none', wrong: { dil: 'Dieser Niederschlag bleibt sichtbar – auch bei viel Ammoniaklösung.', conc: 'Dieser Niederschlag bleibt auch mit konzentrierter Ammoniaklösung sichtbar.' } }
          ]
        },
        {
          id: 'schluss', type: 'many', legend: 'Wähle alle zutreffenden Aussagen.',
          options: {
            a: 'Ob sich ein Niederschlag löst, hängt auch davon ab, wie viel Ammoniaklösung zugegeben wird.',
            b: 'Mit der Ammoniakprobe lassen sich Niederschläge unterscheiden, die ähnlich aussehen.',
            c: 'Beide Ammoniaklösungen wirken auf alle drei Niederschläge gleich.',
            d: 'Der Niederschlag verschwindet nur, weil die Ammoniaklösung den Ansatz verdünnt.',
            e: 'Das Silber ist nach dem Auflösen weiterhin in der Lösung vorhanden.'
          },
          correct: ['a', 'b', 'e'],
          misc: {
            c: 'Vergleiche die gleich angesetzten Paare: Verdünnte und konzentrierte Lösung wirken verschieden.',
            d: 'Gibt man dieselbe Menge destilliertes Wasser zu, bleibt der Niederschlag bestehen.'
          }
        }
      ],
      hints: [
        'Setze für einen fairen Vergleich zwei Proben gleich an. Gib in das eine Glas verdünnte, in das andere konzentrierte Ammoniaklösung – jeweils mehrere Milliliter – und schwenke.',
        'Ein Niederschlag löst sich schon in verdünnter, einer erst in konzentrierter Ammoniaklösung, einer gar nicht. Zu wenig Ammoniaklösung kann einen Rest lassen.',
        'Silberchlorid löst sich in verdünnter Ammoniaklösung, Silberbromid erst in konzentrierter, Silberiodid bleibt ungelöst. Wasser allein löst keinen der Niederschläge.'
      ],
      solution: 'Silberchlorid löst sich bei ausreichender Zugabe verdünnter Ammoniaklösung, Silberbromid bleibt darin weitgehend bestehen und löst sich in konzentrierter Ammoniaklösung, Silberiodid bleibt auch dann sichtbar. Wie viel sich löst, hängt von der zugegebenen Menge ab. Das Silber bleibt gelöst in der Flüssigkeit (als Silber-Ammoniak-Komplex).'
    }
  ];

  // ------------------------------------------------------------------ Kontrollversuche (eigener Teil)
  const CONTROL_STATEMENT = 'Leitungs- und Mineralwasser enthalten verschiedene gelöste Ionen. Bei Zugabe von Silbernitratlösung können mehrere schwer lösliche Silberverbindungen entstehen. Der Niederschlag kann deshalb ein Stoffgemisch sein. Welche Ionen darin enthalten sind, lässt sich mit diesem Versuch allein nicht eindeutig feststellen.';
  const CONTROL_STEPS = [
    {
      id: 'kontrolle', n: 1, short: 'Kontrollen', title: 'Zweck der Kontrollversuche und Grenzen der Wasserprobe',
      intro: 'Setze die Kontrollansätze mit gleichem Probenvolumen und gleicher Tropfenzahl Silbernitratlösung an und vergleiche.',
      questions: [
        {
          id: 'pos', type: 'one', legend: 'Wähle eine richtige Antwort: Wozu dient die Positivkontrolle mit Natriumchloridlösung?',
          options: {
            a: 'Sie zeigt, dass die Silbernitratlösung wirkt und wie die Fällung aussieht, wenn sicher Chloridionen vorhanden sind.',
            b: 'Sie beweist, dass jede Trübung von Chloridionen stammt.',
            c: 'Sie liefert den Chloridgehalt des Leitungswassers.'
          },
          correct: 'a',
          misc: { b: 'Sie zeigt nur, wie eine Chloridfällung aussieht – andere Ionen können ebenfalls Trübungen erzeugen.', c: 'Die Positivkontrolle enthält kein Leitungswasser; sie ist eine bekannte Vergleichsprobe.' }
        },
        {
          id: 'neg', type: 'one', legend: 'Wähle eine richtige Antwort: Wozu dient die Blindprobe mit destilliertem Wasser?',
          options: {
            a: 'Sie zeigt, dass destilliertes Wasser Chloridionen enthält.',
            b: 'Sie zeigt, dass Silbernitratlösung mit Wasser allein keine Trübung erzeugt.',
            c: 'Ohne Blindprobe wirkt die Silbernitratlösung nicht.'
          },
          correct: 'b',
          misc: { a: 'Die Blindprobe bleibt klar – sie enthält keine Ionen, die mit Silberionen einen Niederschlag bilden.', c: 'Die Silbernitratlösung wirkt auch ohne Blindprobe; die Blindprobe dient dem Vergleich.' }
        },
        {
          id: 'wasser', type: 'many', legend: 'Wähle alle zutreffenden Aussagen zu Leitungs- und Mineralwasser.',
          options: {
            a: 'Die Proben enthalten gelöste Ionen, die mit Silberionen schwer lösliche Stoffe bilden.',
            b: 'Der Niederschlag kann ein Stoffgemisch sein.',
            c: 'Die Trübung beweist eindeutig, dass das Wasser Chloridionen enthält.',
            d: 'Jedes Leitungswasser wird genauso stark trüb wie diese Probe.',
            e: 'Welche Ionen den Niederschlag bilden, lässt sich mit diesem Versuch allein nicht eindeutig feststellen.'
          },
          correct: ['a', 'b', 'e'],
          misc: {
            c: 'Auch andere Ionen bilden mit Silberionen schwer lösliche Stoffe. Eine Trübung allein ist kein eindeutiger Chloridnachweis.',
            d: 'Die Probe ist ein Modell; die Zusammensetzung von Wasser ist je nach Ort und Quelle verschieden.'
          }
        }
      ],
      hints: [
        'Vergleiche alle vier Gläser: Welches zeigt eine sichere Fällung, welches bleibt klar, welche werden schwach trüb?',
        'Kontrollen sind Vergleichsproben mit bekanntem Ergebnis. Sie sagen nichts darüber, welche Ionen in einer unbekannten Probe stecken.',
        'Positivkontrolle: Reagenz wirkt, so sieht eine Chloridfällung aus. Blindprobe: ohne fällbare Ionen bleibt es klar. Wasserproben: Trübung durch verschiedene Ionen möglich, keine eindeutige Zuordnung.'
      ],
      solution: 'Die Positivkontrolle zeigt, dass die Silbernitratlösung wirkt und wie eine Chloridfällung aussieht; die Blindprobe zeigt, dass Wasser mit dem Reagenz allein klar bleibt. ' + CONTROL_STATEMENT
    }
  ];

  // ------------------------------------------------------------------ Protokoll (unbewertet)
  const OBS = {
    trueb: { stark: 'deutliche Trübung bzw. Niederschlag', schwach: 'schwache Trübung', keine: 'keine Trübung' },
    farbe: { weiss: 'weiß', creme: 'cremefarben bis schwach gelb', gelb: 'blassgelb', keine: 'kein Niederschlag' },
    nh3: { geloest: 'Niederschlag löst sich (weitgehend) auf', teil: 'Niederschlag löst sich nur teilweise', bleibt: 'Niederschlag bleibt (weitgehend) bestehen' }
  };

  // ------------------------------------------------------------------ Hefteintrag
  const NOTEBOOK = {
    title: 'Fällungsreaktionen der Silberhalogenide',
    blocks: [
      { kind: 'p', text: 'Bei einer **Fällungsreaktion** bilden gelöste Ionen einen schwer löslichen Feststoff, den **Niederschlag**.' },
      { kind: 'p', text: 'Silberionen bilden mit Chlorid-, Bromid- und Iodidionen schwer lösliche **Silberhalogenide**: Silberchlorid ist weiß, Silberbromid cremefarben bis schwach gelb, Silberiodid blassgelb. Der Niederschlag trübt zunächst die Lösung und setzt sich beim Stehenlassen am Boden ab.' },
      { kind: 'p', text: 'Natrium- und Nitrationen nehmen nicht teil und bleiben als **Zuschauerionen** gelöst.' },
      { kind: 'eq', text: 'Ag⁺(aq) + X⁻(aq) → AgX(s)', legend: 'mit X = Cl, Br oder I' },
      { kind: 'p', text: '**Ammoniakprobe:** Silberchlorid löst sich in verdünnter Ammoniaklösung, Silberbromid erst in konzentrierter; Silberiodid bleibt ungelöst. So lassen sich die Niederschläge unterscheiden.' }
    ]
  };
  const CONTROL_SUMMARY = {
    title: 'Kontrollversuche',
    text: 'Die **Positivkontrolle** (Natriumchloridlösung) zeigt, wie eine Fällung aussieht; die **Blindprobe** (destilliertes Wasser) bleibt klar. Leitungs- und Mineralwasser werden trüb: Sie enthalten verschiedene Ionen, die mit Silberionen schwer lösliche Stoffe bilden. Welche, zeigt dieser Versuch allein nicht.'
  };
  /** Wörter eines Hefteintrags (Legende eingerechnet, Gleichungssymbole nicht). */
  function notebookWords(nb) {
    return nb.blocks.reduce((s, b) => s + (b.kind === 'eq' ? LL.words(b.legend || '') : LL.words(b.text)), 0);
  }

  // ------------------------------------------------------------------ Prüfung
  /**
   * Prüfung wie LK.learn.grade, aber mit konkreter Rückmeldung je angekreuzter Aussage:
   * richtig angekreuzte Aussagen werden gezählt und benannt, falsche mit Begründung,
   * fehlende nur als Anzahl (ohne die Lösung zu verraten).
   */
  function grade(step, answers) {
    const g = LL.grade(step, answers);
    for (const q of step.questions || []) {
      if (q.type !== 'many') continue;
      const f = g.fields[q.id];
      if (f.status === 'empty') { f.feedback = 'Noch keine Aussage angekreuzt.'; continue; }
      if (f.ok) { f.feedback = 'Richtig – genau diese Aussagen treffen zu.'; continue; }
      const sel = Array.isArray(answers[q.id]) ? answers[q.id] : [];
      const right = sel.filter((k) => q.correct.includes(k));
      const wrong = sel.filter((k) => !q.correct.includes(k));
      const missing = q.correct.filter((k) => !sel.includes(k)).length;
      const parts = [];
      if (right.length) parts.push(`${right.length === 1 ? 'Eine angekreuzte Aussage trifft' : right.length + ' angekreuzte Aussagen treffen'} zu.`);
      for (const k of wrong) parts.push(`„${q.options[k]}“ trifft nicht zu${q.misc && q.misc[k] ? ': ' + q.misc[k] : '.'}`);
      if (missing) parts.push(missing === 1 ? 'Es fehlt noch eine zutreffende Aussage.' : `Es fehlen noch ${missing} zutreffende Aussagen.`);
      f.feedback = parts.join(' ');
      f.partial = right.length > 0;
    }
    return g;
  }

  const required = (steps) => steps.filter((s) => !s.optional);
  /** Fortschritt nur über Pflichtschritte des jeweiligen Teils (Kontrollen getrennt). */
  function progress(steps, state) {
    const req = required(steps);
    const done = req.filter((s) => state.steps[s.id] && state.steps[s.id].graded && state.steps[s.id].graded.allCorrect).length;
    return { done, total: req.length };
  }

  return { STEPS, CONTROL_STEPS, CONTROL_STATEMENT, EQ, EQ_FB, OBS, NOTEBOOK, CONTROL_SUMMARY, notebookWords, grade, progress, required };
});
