/*
 * Estergleichgewicht – Lerninhalte (ohne DOM)
 *
 * Lernweg in drei Schritten nach docs/GLEICHGEWICHT-PLANUNG.md (G9). In Version 0.1
 * ist Schritt 1 (Beobachten) bearbeitbar; Schritte 2 und 3 folgen mit 0.2 bzw. 0.3.
 * Mechanik: shared/labkit/js/learn.js.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../../../shared/labkit/js/learn.js') : root.LK.learn);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.EG = root.EG || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function (learn) {
  'use strict';
  const { gap } = learn;

  const OBSERVE = {
    id: 'observe', n: 1, short: 'Beobachten', title: 'Beobachten: Esterbildung und Esterhydrolyse',
    intro: 'Starte die Estersynthese (1 mol Säure + 1 mol Alkohol) ohne Katalysator und lass sie bis zum Gleichgewicht laufen. Starte dann die Esterhydrolyse (1 mol Ester + 1 mol Wasser). Vergleiche die Tabelle und schau dir die Teilchenebene an.',
    paragraphs: [
      ['Bei der Estersynthese ', gap('g1', { ab: 'nehmen die Stoffmengen von Säure und Alkohol ab', zu: 'nehmen die Stoffmengen von Säure und Alkohol zu', gleich: 'bleiben alle Stoffmengen gleich' }, 'ab', { zu: 'Die roten Kurven fallen – Edukte werden verbraucht.', gleich: 'Schau auf die Kurven in den ersten Tagen.' }),
        ', während Ester und Wasser ', gap('g2', { ent: 'entstehen', ver: 'verschwinden', null: 'bei null bleiben' }, 'ent', { ver: 'Die blauen Kurven steigen.', null: 'Die blauen Kurven steigen von 0 auf etwa 0,67 mol.' }), '.'],
      ['Die Reaktion kommt aber nicht zu Ende: Nach etwa 10 Tagen sind noch ', gap('g3', { drittel: 'etwa 0,33 mol Säure', nichts: '0 mol Säure', alles: '1 mol Säure' }, 'drittel', { nichts: 'Lies die Tabelle ab: Die Säure wird nicht vollständig verbraucht.', alles: 'Lies die Tabelle ab: Ein großer Teil der Säure hat reagiert.' }),
        ' übrig, und es sind ', gap('g4', { zwei: 'etwa 0,67 mol Ester', eins: '1,00 mol Ester', halb: '0,50 mol Ester' }, 'zwei', { eins: 'Vollständiger Umsatz wäre 1 mol – so weit kommt es nicht.', halb: 'Lies die Tabelle genauer ab.' }), ' entstanden.'],
      ['Startet man umgekehrt mit 1 mol Ester und 1 mol Wasser (Hydrolyse), ergeben sich nach 10 Tagen ', gap('g5', { gleich: 'dieselben Stoffmengen wie bei der Synthese', andere: 'ganz andere Stoffmengen', nichts: 'keine Veränderungen' }, 'gleich', { andere: 'Vergleiche die beiden Tabellenzeilen „Gleichgewichtszustand“.', nichts: 'Der Ester wird teilweise gespalten – die roten Kurven steigen.' }),
        '. Das Gleichgewicht ist also ', gap('g6', { beide: 'von beiden Seiten erreichbar', nur: 'nur von der Eduktseite erreichbar', zufall: 'Zufall' }, 'beide', { nur: 'Die Hydrolyse führt zu denselben Werten – also auch von der Produktseite.', zufall: 'Beide Läufe enden exakt gleich – das ist kein Zufall.' }), '.'],
      ['Auf der Teilchenebene sieht man im Gleichgewicht, dass ', gap('g7', { weiter: 'weiterhin Teilchen zusammenstoßen und reagieren – hin und zurück etwa gleich oft', nichts: 'keine Teilchen mehr reagieren', nurhin: 'nur noch Ester gebildet wird' }, 'weiter', { nichts: 'Beobachte das Aufblitzen und das Balkenpaar: Beide Richtungen laufen weiter.', nurhin: 'Beide Balken sind etwa gleich hoch – auch die Rückreaktion läuft.' }),
        '. Die Stoffmengen bleiben konstant, weil ', gap('g8', { gleichschnell: 'Hin- und Rückreaktion gleich schnell ablaufen', stop: 'die Reaktion gestoppt ist', kein: 'keine Edukte mehr vorhanden sind' }, 'gleichschnell', { stop: 'Die Teilchenebene zeigt: Es wird weiter reagiert.', kein: 'Es sind noch 0,33 mol Säure und Alkohol vorhanden.' }), ': ein dynamisches Gleichgewicht.'],
      ['Mit Katalysator (Schwefelsäure) wird das Gleichgewicht ', gap('g9', { schneller: 'viel schneller erreicht, aber mit denselben Stoffmengen', mehr: 'mit mehr Ester erreicht', weniger: 'mit weniger Ester erreicht' }, 'schneller', { mehr: 'Vergleiche die Tabelle mit und ohne Katalysator: gleiche Werte.', weniger: 'Vergleiche die Tabelle mit und ohne Katalysator: gleiche Werte.' }), '.']
    ],
    questions: [
      { id: 'q1', type: 'one', legend: 'Welche Aussage über die glatte Kurve der Stoffebene und die springenden Zahlen der Teilchenebene ist richtig?',
        options: { mean: 'Die glatte Kurve ist der Mittelwert über unvorstellbar viele Teilchen; die 40 Teilchen zeigen Einzelereignisse mit Zufall.', wrong: 'Die Teilchenebene ist falsch, weil die Zahlen schwanken.', diff: 'Es sind zwei verschiedene Reaktionen.', exact: 'Auch bei echten Stoffmengen schwanken die Messwerte so stark.' },
        correct: 'mean',
        misc: { wrong: 'Die Schwankungen gehören zum Modell mit wenigen Teilchen – bei 10²³ Teilchen mitteln sie sich weg.', diff: 'Beide Ansichten zeigen dieselbe Reaktion mit demselben K.', exact: 'Bei 1 mol (6·10²³ Teilchen) sind relative Schwankungen unmessbar klein.' } }
    ],
    hints: [
      'Lass die Synthese ohne Katalysator mit Tempo 10× laufen, bis die gestrichelte Linie „Gleichgewicht“ erscheint, und lies dann die Tabelle ab. Danach „Esterhydrolyse“ starten.',
      'Das Balkenpaar zeigt die erfolgreichen Zusammenstöße pro 10 s in beide Richtungen. Vergleiche es zu Beginn und im Gleichgewicht.',
      'Gleichgewicht: 0,33 mol Säure und Alkohol, 0,67 mol Ester und Wasser – von beiden Seiten; Katalysator nur schneller; Teilchenebene: beide Richtungen laufen weiter, Zahlen schwanken um die Mittelwerte 7 : 13.'
    ],
    solution: 'Bei der Synthese nehmen Säure und Alkohol ab, Ester und Wasser entstehen – aber nicht vollständig: Nach etwa 10 Tagen bleiben 0,33 mol Säure und Alkohol, 0,67 mol Ester und Wasser sind entstanden. Die Hydrolyse führt zu denselben Stoffmengen; das Gleichgewicht ist von beiden Seiten erreichbar. Auf der Teilchenebene reagieren weiter Teilchen hin und zurück, etwa gleich oft – die Stoffmengen bleiben konstant, weil Hin- und Rückreaktion gleich schnell ablaufen (dynamisches Gleichgewicht). Der Katalysator beschleunigt beide Richtungen; die Lage des Gleichgewichts ändert er nicht. Die glatte Kurve ist der Mittelwert über sehr viele Teilchen.'
  };

  const INTERPRET = {
    id: 'interpret', n: 2, short: 'Deuten', title: 'Deuten: Massenwirkungsgesetz und K',
    intro: 'Vergleiche Synthese und Hydrolyse im Vergleichslauf, probiere eigene Startmengen und berechne K aus der Tabelle.',
    questions: [], hints: ['', '', ''], solution: ''
  };
  const INTERVENE = {
    id: 'intervene', n: 3, short: 'Eingreifen', title: 'Eingreifen: Mehr Ester nach Le Chatelier',
    intro: 'Gib Ethanol zu, destilliere Ester ab oder entziehe Wasser. Beobachte, wohin sich das Gleichgewicht verschiebt, und formuliere die Regel.',
    questions: [], hints: ['', '', ''], solution: ''
  };

  const STEPS = [OBSERVE, INTERPRET, INTERVENE];
  const AVAILABLE = { observe: true, interpret: false, intervene: false };
  const locked = (step) => !AVAILABLE[step.id];
  const LOCKED_TEXT = 'Dieser Schritt folgt im nächsten Entwicklungsschritt der App (Schritt 2 mit Version 0.2, Schritt 3 mit Version 0.3). Du kannst die Simulation trotzdem frei ausprobieren.';

  const MODEL = {
    levels: [
      ['Stoffebene (messbar)', 'Stoffmengen in mol, glatte Kurven aus den Geschwindigkeitsgesetzen v_hin = k₁·n(S)·n(A), v_rück = k₋₁·n(E)·n(W); K = k₁/k₋₁ = 4. Im Labor zugänglich über Titration der Säure.'],
      ['Teilchenebene (Modell)', '40 schematische Teilchen (20 je mol). Ob und wann ein Paar reagiert, wird aus denselben Geschwindigkeitsgesetzen ausgewürfelt; der gezeichnete Zusammenstoß ist Veranschaulichung. Symbole sind keine Molekülstrukturen.']
    ],
    shows: [
      'Die Reaktion läuft nicht vollständig ab; von beiden Seiten stellt sich dasselbe Gleichgewicht ein.',
      'Im Gleichgewicht laufen Hin- und Rückreaktion weiter, gleich schnell (dynamisch).',
      'Der Katalysator beschleunigt beide Richtungen und ändert die Lage des Gleichgewichts nicht.',
      'Glatte Kurve = Mittelwert vieler Teilchen; wenige Teilchen = sichtbare Schwankungen.'
    ],
    hides: [
      'Geschwindigkeitskonstanten sind Lehrbuchwerte für die Veranschaulichung (Gleichgewicht ohne Katalysator nach etwa 10 Tagen); echte Zeiten hängen von Temperatur und Ansatz ab.',
      'Volumen und Dichte werden konstant gesetzt; Nebenreaktionen, Verdunsten und der Katalysator als Stoff bleiben unberücksichtigt.',
      'Die Esterbildung ist nahezu thermoneutral: Temperatur verschiebt das Gleichgewicht kaum, Druck spielt ohne Gase keine Rolle. Deshalb bietet die App diese Eingriffe nicht an.'
    ]
  };

  const NOTEBOOK = {
    title: 'Estergleichgewicht – ein echtes dynamisches Gleichgewicht',
    points: [
      'Ethansäure und Ethanol reagieren zu **Ethansäureethylester** und Wasser. Die Reaktion ist **umkehrbar** (Esterhydrolyse).',
      'Die Reaktion läuft **nicht vollständig** ab: Aus 1 mol Säure und 1 mol Alkohol entstehen etwa **0,67 mol Ester** und Wasser; 0,33 mol Säure und Alkohol bleiben übrig – egal, ob man von den Edukten oder von den Produkten startet.',
      'Im **chemischen Gleichgewicht** sind Hin- und Rückreaktion **gleich schnell**; die Stoffmengen bleiben konstant, obwohl auf der Teilchenebene weiter reagiert wird (**dynamisch**).',
      'Ein **Katalysator** (konz. Schwefelsäure) beschleunigt beide Richtungen und lässt die Lage des Gleichgewichts unverändert.',
      '**Massenwirkungsgesetz:** Im Gleichgewicht hat der Quotient aus Produkt- und Eduktkonzentrationen einen festen Wert, die **Gleichgewichtskonstante K**.'
    ],
    equation: 'CH₃COOH + C₂H₅OH  ⇌  CH₃COOC₂H₅ + H₂O        K = c(Ester) · c(Wasser) / (c(Säure) · c(Alkohol)) ≈ 4',
    analogy: 'Vergleiche: Stechheber (Stoffebene, Wasser wandert) und Apfelkrieg (Teilchenebene, Äpfel fliegen) – hier passiert beides zugleich, und es entstehen wirklich neue Stoffe.'
  };

  return { STEPS, AVAILABLE, locked, LOCKED_TEXT, MODEL, NOTEBOOK };
});
