/*
 * Apfelkrieg – Lerninhalte (ohne DOM)
 *
 * Lernweg in drei Schritten nach docs/GLEICHGEWICHT-PLANUNG.md (G9). In Version 0.1
 * ist Schritt 1 (Beobachten) bearbeitbar; Schritte 2 und 3 folgen mit 0.2 bzw. 0.3.
 * Mechanik: shared/labkit/js/learn.js.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../../../shared/labkit/js/learn.js') : root.LK.learn);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.AK = root.AK || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function (learn) {
  'use strict';
  const { gap } = learn;

  const OBSERVE = {
    id: 'observe', n: 1, short: 'Beobachten', title: 'Beobachten: Wer gewinnt den Apfelkrieg?',
    intro: 'Starte mit 9 Äpfeln auf jedem Feld (Standard). Lass den Krieg mindestens zwei Minuten laufen und beobachte die Zahlen, das Diagramm und das Balkenpaar. Wähle dann in jeder Lücke den passenden Begriff.',
    paragraphs: [
      ['Der Enkel wirft ', gap('g1', { schneller: 'schneller', langsamer: 'langsamer', gleich: 'genauso schnell' }, 'schneller', { langsamer: 'Vergleiche die Wurfwahrscheinlichkeiten im Reiter „Versuch“: 10 % gegen 5 % je Schritt.', gleich: 'Im Reiter „Versuch“ siehst du: Der Enkel wirft jeden Apfel mit doppelter Wahrscheinlichkeit.' }),
        ' als der Großvater. Trotzdem liegen nach einer Weile ', gap('g2', { opa: 'beim Großvater mehr Äpfel', enkel: 'beim Enkel mehr Äpfel', gleich: 'auf beiden Feldern gleich viele' }, 'opa', { enkel: 'Lies die Zahlen unter den Feldern ab, nachdem sich der Krieg eingependelt hat.', gleich: 'Lies die Zahlen unter den Feldern ab: Sie unterscheiden sich deutlich.' }), '.'],
      ['Das liegt daran, dass die Zahl der Würfe pro Zeit nicht nur vom Tempo, sondern auch von der ', gap('g3', { anzahl: 'Zahl der Äpfel auf dem eigenen Feld', groesse: 'Größe des Feldes', farbe: 'Farbe der Äpfel' }, 'anzahl', { groesse: 'Beide Felder sind gleich groß.', farbe: 'Alle Äpfel sind gleich.' }),
        ' abhängt: Wer ', gap('g4', { wenige: 'wenige Äpfel', viele: 'viele Äpfel', keine: 'keine Lust' }, 'wenige', { viele: 'Viele Äpfel bedeuten viele Würfe – überlege andersherum.', keine: 'Lust spielt im Modell keine Rolle, nur die Wahrscheinlichkeit je Apfel.' }), ' hat, kommt selten zum Werfen.'],
      ['Nach etwa einer Minute pendeln sich die Zahlen ', gap('g5', { um: 'um feste Werte ein, schwanken aber weiter', fest: 'auf feste Werte ein und bleiben dann exakt gleich', null: 'bei 0 und 18 ein' }, 'um', { fest: 'Schau genau auf die Zahlen: Sie springen immer noch um 1 oder 2 hin und her.', null: 'Kein Feld wird jemals ganz leer, solange geworfen wird.' }),
        '. Im Balkenpaar werden die Würfe pro 10 s in beide Richtungen ', gap('g6', { gleich: 'etwa gleich groß', opa: 'beim Großvater größer', null: 'null' }, 'gleich', { opa: 'Vergleiche die beiden Balken, nachdem sich der Krieg eingependelt hat.', null: 'Es wird weiter geworfen – die Balken sind nicht null.' }),
        '. Das Gleichgewicht ist also ', gap('g7', { dyn: 'dynamisch: Es wird weiter hin und her geworfen', stat: 'statisch: Es passiert nichts mehr', zufall: 'reiner Zufall ohne Regel' }, 'dyn', { stat: 'Beobachte die Äpfel: Sie fliegen weiter über den Zaun.', zufall: 'Der Zufall entscheidet über den einzelnen Wurf – der Mittelwert folgt aber einer Regel.' }), '.'],
      ['Im Gleichgewicht ist das Verhältnis N(Großvater) : N(Enkel) etwa ', gap('g8', { zwei: '2 : 1', eins: '1 : 1', halb: '1 : 2' }, 'zwei', { eins: 'Lies die beiden Zahlen ab, zum Beispiel 12 und 6.', halb: 'Lies ab, wer mehr Äpfel hat – und um welchen Faktor.' }), ' – genau umgekehrt zu den Wurfwahrscheinlichkeiten.']
    ],
    questions: [
      { id: 'q1', type: 'one', legend: 'Du startest den Krieg noch einmal mit „Nochmal würfeln“. Was erwartest du?',
        options: { same: 'Genau derselbe Verlauf und genau dieselben Zahlen.', similar: 'Ein anderer Verlauf, aber am Ende wieder etwa 12 : 6 mit Schwankungen.', other: 'Ein ganz anderes Gleichgewicht, zum Beispiel 6 : 12.', none: 'Diesmal kein Gleichgewicht.' },
        correct: 'similar',
        misc: { same: 'Jeder Wurf ist Zufall – der einzelne Verlauf wiederholt sich nicht. Probiere es aus.', other: 'Die Lage des Gleichgewichts hängt nur von den Wurfwahrscheinlichkeiten ab, nicht vom Zufall.', none: 'Probiere es aus: Die Zahlen pendeln sich wieder ein.' } }
    ],
    hints: [
      'Lies im Reiter „Versuch“ die beiden Wurfwahrscheinlichkeiten ab und überlege, was mehr Würfe bringt: ein schneller Werfer mit wenigen Äpfeln oder ein langsamer mit vielen.',
      'Das Balkenpaar zählt die Würfe der letzten 10 Sekunden. Vergleiche es zu Beginn und nach zwei Minuten.',
      'Im Gleichgewicht: etwa 12 : 6, aber mit Schwankungen; beide Balken etwa gleich hoch, nicht null; das Verhältnis 2 : 1 ist das Umgekehrte der Wahrscheinlichkeiten 5 % : 10 %.'
    ],
    solution: 'Der Enkel wirft schneller, trotzdem liegen beim Großvater mehr Äpfel. Die Würfe pro Zeit hängen auch von der Zahl der eigenen Äpfel ab: Wer wenige Äpfel hat, kommt selten zum Werfen. Nach etwa einer Minute pendeln sich die Zahlen um feste Werte ein (etwa 12 : 6), schwanken aber weiter. Die Würfe pro 10 s sind in beide Richtungen etwa gleich – das Gleichgewicht ist dynamisch. Das Verhältnis 2 : 1 ist das Umgekehrte der Wurfwahrscheinlichkeiten. „Nochmal würfeln“ liefert einen anderen Verlauf, aber dasselbe Gleichgewicht.'
  };

  const INTERPRET = {
    id: 'interpret', n: 2, short: 'Deuten', title: 'Deuten: Zufall, Mittelwert und die Zahl K',
    intro: 'Starte mit 18 : 0, 0 : 18 und 9 : 9. Vergleiche die Gleichgewichte und den Quotienten Q = N(Großvater)/N(Enkel). Was ändert sich mit mehr Äpfeln?',
    questions: [], hints: ['', '', ''], solution: ''
  };
  const INTERVENE = {
    id: 'intervene', n: 3, short: 'Eingreifen', title: 'Eingreifen: Ein Korb Äpfel und bessere Schuhe',
    intro: 'Kippe im Gleichgewicht einen Korb Äpfel auf ein Feld, gib beiden bessere Schuhe oder lass den Großvater müde werden. Beschreibe, wohin sich das Gleichgewicht verschiebt.',
    questions: [], hints: ['', '', ''], solution: ''
  };

  const STEPS = [OBSERVE, INTERPRET, INTERVENE];
  const AVAILABLE = { observe: true, interpret: false, intervene: false };
  const locked = (step) => !AVAILABLE[step.id];
  const LOCKED_TEXT = 'Dieser Schritt folgt im nächsten Entwicklungsschritt der App (Schritt 2 mit Version 0.2, Schritt 3 mit Version 0.3). Du kannst das Modell trotzdem frei ausprobieren.';

  const MODEL = {
    analogy: [
      ['Äpfel beim Großvater, N(Großvater)', 'Eduktteilchen, Konzentration c(Edukt)'],
      ['Äpfel beim Enkel, N(Enkel)', 'Produktteilchen, Konzentration c(Produkt)'],
      ['Wurf über den Zaun nach rechts', 'ein Eduktteilchen reagiert zum Produkt (Hinreaktion)'],
      ['Wurf über den Zaun nach links', 'ein Produktteilchen reagiert zurück (Rückreaktion)'],
      ['Wurfwahrscheinlichkeit je Apfel p_Opa, p_Enkel', 'Geschwindigkeitskonstanten k₁, k₋₁'],
      ['p_Opa · N(Großvater) = p_Enkel · N(Enkel)', 'k₁ · c(Edukt) = k₋₁ · c(Produkt) – gleich viele Umwandlungen pro Zeit']
    ],
    shows: [
      'Jeder einzelne Wurf ist Zufall – wie jeder einzelne Zusammenstoß von Teilchen.',
      'Die Zahl der Würfe pro Zeit wächst mit der Zahl der Äpfel – wie die Reaktionsgeschwindigkeit mit der Konzentration.',
      'Bei kleinen Zahlen schwankt das Gleichgewicht sichtbar; mit mehr Äpfeln werden die Schwankungen relativ kleiner (Schritt 2).',
      'Die Lage des Gleichgewichts hängt nur von den Wurfwahrscheinlichkeiten ab, nicht vom Start und nicht vom Zufall.'
    ],
    hides: [
      'Äpfel bleiben Äpfel: Sie wechseln nur das Feld, es entsteht kein neuer Stoff.',
      'Die Figuren sind Dekoration; im Modell entscheidet nur die Wahrscheinlichkeit je Apfel und Zeitschritt.',
      'Echte Reaktionen laufen mit unvorstellbar vielen Teilchen – dort sieht man die Schwankungen nicht mehr (Stoffebene).'
    ]
  };

  const NOTEBOOK = {
    title: 'Modell Apfelkrieg – Gleichgewicht auf der Teilchenebene',
    points: [
      'Jeder Apfel wird in jedem Zeitschritt mit einer festen **Wahrscheinlichkeit** auf das andere Feld geworfen – der einzelne Wurf ist **Zufall**.',
      'Wer **mehr Äpfel** hat, wirft öfter. Deshalb werden die Würfe nach rechts seltener und die nach links häufiger, bis beide Richtungen im Mittel gleich oft vorkommen.',
      'Dann **schwanken** die Zahlen nur noch um feste Werte: **dynamisches Gleichgewicht** – es wird weiter hin und her geworfen.',
      'Das Verhältnis der Apfelzahlen im Gleichgewicht ist die **Gleichgewichtskonstante** des Modells; sie hängt nur von den Wurfwahrscheinlichkeiten ab.'
    ],
    equation: 'p_Opa · N(Großvater) = p_Enkel · N(Enkel)   ⇒   K = N(Großvater) / N(Enkel) = p_Enkel / p_Opa',
    analogy: 'Apfel ↔ Teilchen, Feld des Großvaters ↔ Edukte, Feld des Enkels ↔ Produkte, Wurf ↔ Umwandlung eines Teilchens.'
  };

  return { STEPS, AVAILABLE, locked, LOCKED_TEXT, MODEL, NOTEBOOK };
});
