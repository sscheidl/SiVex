/*
 * Stechheber – Lerninhalte (ohne DOM)
 *
 * Lernweg in drei Schritten nach docs/GLEICHGEWICHT-PLANUNG.md (G9). In Version 0.1
 * ist Schritt 1 (Beobachten) bearbeitbar; Schritte 2 und 3 sind angelegt und folgen
 * mit 0.2 bzw. 0.3. Mechanik: shared/labkit/js/learn.js.
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('../../../shared/labkit/js/learn.js') : root.LK.learn);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.SH = root.SH || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function (learn) {
  'use strict';
  const { gap } = learn;

  const OBSERVE = {
    id: 'observe', n: 1, short: 'Beobachten', title: 'Beobachten: Was passiert mit dem Wasser?',
    intro: 'Starte mit 80 mL Wasser in Zylinder A (Standardwerte). Lass mindestens 30 Zyklen laufen und beobachte Zylinder, Diagramm und das Balkenpaar. Wähle dann in jeder Lücke den passenden Begriff.',
    paragraphs: [
      ['Im ersten Zyklus nimmt Rohr a aus Zylinder A ', gap('g1', { viel: 'viel Wasser', wenig: 'fast kein Wasser', nichts: 'kein Wasser' }, 'viel', { wenig: 'Zu Beginn steht das Wasser in A hoch – das Rohr füllt sich bis zu dieser Höhe.', nichts: 'Rohr a taucht in A ein, und dort ist Wasser.' }),
        ' mit. Rohr b nimmt aus Zylinder B ', gap('g2', { viel: 'viel Wasser', nichts: 'kein Wasser', gleich: 'gleich viel wie Rohr a' }, 'nichts', { viel: 'Zylinder B ist zu Beginn leer.', gleich: 'Zylinder B ist zu Beginn leer – ein leeres Gefäß füllt kein Rohr.' }), ' mit.'],
      ['Von Zyklus zu Zyklus wird die Menge, die von A nach B wandert, ', gap('g3', { kleiner: 'kleiner', groesser: 'größer', gleich: 'immer gleich' }, 'kleiner', { groesser: 'Vergleiche den roten Balken nach 1, 5 und 10 Zyklen.', gleich: 'Der rote Balken ändert sich – schau genau hin.' }),
        ', weil der Wasserstand in A ', gap('g4', { sinkt: 'sinkt', steigt: 'steigt', bleibt: 'gleich bleibt' }, 'sinkt', { steigt: 'Zylinder A gibt mehr ab, als er zurückbekommt.', bleibt: 'Beobachte die rote Kurve im Diagramm.' }),
        '. Die Menge von B nach A wird dabei ', gap('g5', { groesser: 'größer', kleiner: 'kleiner', null: 'null' }, 'groesser', { kleiner: 'Je mehr Wasser in B steht, desto höher füllt sich Rohr b.', null: 'Sobald Wasser in B steht, nimmt Rohr b etwas mit.' }), '.'],
      ['Nach einer Weile ändern sich die Wasserstände in A und B ', gap('g6', { nicht: 'nicht mehr', weiter: 'immer weiter', schneller: 'immer schneller' }, 'nicht', { weiter: 'Sieh dir das Ende der Kurven an: Sie laufen waagrecht.', schneller: 'Die Kurven werden flacher, nicht steiler.' }),
        '. Trotzdem wird in jedem Zyklus weiter Wasser übertragen: ', gap('g7', { gleich: 'gleich viel von A nach B wie von B nach A', mehr: 'mehr von A nach B als zurück', keins: 'gar keins mehr' }, 'gleich', { mehr: 'Vergleiche die beiden Balken im Gleichgewicht.', keins: 'Die Rohre füllen sich weiterhin – die Balken sind nicht null.' }),
        '. Ein solcher Zustand heißt ', gap('g8', { dyn: 'dynamisches Gleichgewicht', stat: 'Stillstand', ende: 'Ende der Reaktion' }, 'dyn', { stat: 'Stillstand wäre: Es wird nichts mehr übertragen. Hier laufen beide Richtungen weiter.', ende: 'Es passiert weiterhin etwas – nur in beide Richtungen gleich viel.' }), '.'],
      ['Mit den Standardrohren ist im Gleichgewicht der Wasserstand in B ', gap('g9', { doppelt: 'etwa doppelt so hoch wie in A', gleich: 'genauso hoch wie in A', halb: 'etwa halb so hoch wie in A' }, 'doppelt', { gleich: 'Lies die Volumina unter den Zylindern ab und vergleiche.', halb: 'Lies die Volumina unter den Zylindern ab: Welcher Zylinder hat mehr?' }), '.']
    ],
    questions: [
      { id: 'q1', type: 'one', legend: 'Woran erkennst du im Diagramm, dass das Gleichgewicht erreicht ist?',
        options: { flat: 'Beide Kurven laufen waagrecht weiter.', cross: 'Die beiden Kurven schneiden sich.', zero: 'Eine Kurve erreicht den Wert 0.', same: 'Beide Kurven haben denselben Wert.' },
        correct: 'flat',
        misc: { cross: 'Der Schnittpunkt ist nur ein Zwischenzustand – danach ändern sich die Kurven weiter.', zero: 'Kein Zylinder wird leer, solange beide Rohre Wasser übertragen.', same: 'Gleiche Volumina gibt es nur, wenn beide Rohre gleich dick sind. Entscheidend ist, dass sich nichts mehr ändert.' } }
    ],
    hints: [
      'Drücke „Zyklus“ einige Male einzeln und beobachte, wie hoch sich jedes Rohr füllt. Danach „Start“ und bis zur gestrichelten Linie „Gleichgewicht“ laufen lassen.',
      'Das Balkenpaar zeigt, wie viel im letzten Zyklus hin- und zurückgewandert ist. Zu Beginn ist der rote Balken groß und der blaue null; im Gleichgewicht sind beide gleich hoch – aber nicht null.',
      'Im Gleichgewicht: Kurven waagrecht, Balken gleich hoch, Volumina unter den Zylindern konstant (etwa 26 mL in A und 54 mL in B). Es wird weiter übertragen, aber in beide Richtungen gleich viel.'
    ],
    solution: 'Im ersten Zyklus nimmt Rohr a viel Wasser aus A mit, Rohr b aus dem leeren B nichts. Von Zyklus zu Zyklus wird die Menge von A nach B kleiner, weil der Wasserstand in A sinkt; die Menge von B nach A wird größer. Nach einer Weile ändern sich die Wasserstände nicht mehr, obwohl in jedem Zyklus weiter gleich viel Wasser hin und zurück übertragen wird: ein dynamisches Gleichgewicht. Im Diagramm laufen beide Kurven waagrecht. Mit den Standardrohren steht in B etwa doppelt so viel Wasser wie in A.'
  };

  const INTERPRET = {
    id: 'interpret', n: 2, short: 'Deuten', title: 'Deuten: Woher kommt die Zahl K?',
    intro: 'Starte das Wasser einmal in A, einmal in B und einmal in beiden Zylindern. Vergleiche die Gleichgewichte und den Quotienten Q = V(B)/V(A).',
    questions: [], hints: ['', '', ''], solution: ''
  };
  const INTERVENE = {
    id: 'intervene', n: 3, short: 'Eingreifen', title: 'Eingreifen: Was macht das Gleichgewicht, wenn man stört?',
    intro: 'Gieße im Gleichgewicht Wasser nach, nimm welches heraus oder tausche die Rohre. Beschreibe, wohin sich das Gleichgewicht verschiebt.',
    questions: [], hints: ['', '', ''], solution: ''
  };

  const STEPS = [OBSERVE, INTERPRET, INTERVENE];
  const AVAILABLE = { observe: true, interpret: false, intervene: false };
  const locked = (step) => !AVAILABLE[step.id];
  const LOCKED_TEXT = 'Dieser Schritt folgt im nächsten Entwicklungsschritt der App (Schritt 2 mit Version 0.2, Schritt 3 mit Version 0.3). Du kannst das Modell trotzdem frei ausprobieren.';

  // ------------------------------------------------------------------ Modellkarte (G7)
  const MODEL = {
    analogy: [
      ['Zylinder A, Wasserstand V(A)', 'Edukte, Konzentration c(Edukt)'],
      ['Zylinder B, Wasserstand V(B)', 'Produkte, Konzentration c(Produkt)'],
      ['Rohr a (Anteil f_a je Zyklus)', 'Hinreaktion mit Geschwindigkeitskonstante k₁'],
      ['Rohr b (Anteil f_b je Zyklus)', 'Rückreaktion mit Geschwindigkeitskonstante k₋₁'],
      ['ein Zyklus', 'ein Zeitschritt'],
      ['f_a · V(A) = f_b · V(B)', 'k₁ · c(Edukt) = k₋₁ · c(Produkt) – Hin- und Rückreaktion gleich schnell']
    ],
    shows: [
      'Die übertragene Menge hängt vom Wasserstand ab – wie die Reaktionsgeschwindigkeit von der Konzentration.',
      'Das Gleichgewicht ist dynamisch: Es wird weiter übertragen, die Wasserstände bleiben trotzdem konstant.',
      'Die Lage des Gleichgewichts (K = V(B)/V(A)) hängt nur von den Rohren ab, nicht von der Startmenge.'
    ],
    hides: [
      'Wasser bleibt Wasser: Es gibt keine Stoffumwandlung, nur einen Ortswechsel.',
      'Die Übertragung läuft in festen Schritten (Zyklen); eine echte Reaktion läuft ununterbrochen.',
      'Rohrwand und Verdrängung werden vernachlässigt; der Anteil f = (d/D)² gilt exakt.'
    ]
  };

  // ------------------------------------------------------------------ Hefteintrag (Rohfassung 0.1)
  const NOTEBOOK = {
    title: 'Modellexperiment Stechheber – das dynamische Gleichgewicht',
    points: [
      'Rohr a überträgt in jedem Zyklus einen festen **Anteil** des Wassers von A nach B, Rohr b einen festen Anteil von B nach A.',
      'Je **höher der Wasserstand**, desto mehr nimmt das Rohr mit. Deshalb wird die Übertragung A → B kleiner und B → A größer, bis beide gleich groß sind.',
      'Dann ändern sich die Wasserstände nicht mehr, obwohl weiter übertragen wird: **dynamisches Gleichgewicht** – Hin- und Rückvorgang laufen gleich schnell.',
      'Das Verhältnis der Wasserstände im Gleichgewicht ist die **Gleichgewichtskonstante** des Modells. Sie hängt nur von den Rohren ab.'
    ],
    equation: 'f_a · V(A) = f_b · V(B)   ⇒   K = V(B) / V(A) = f_a / f_b = (d_a / d_b)²',
    analogy: 'Zylinder A ↔ Edukte, Zylinder B ↔ Produkte, Rohr a ↔ Hinreaktion, Rohr b ↔ Rückreaktion.'
  };

  return { STEPS, AVAILABLE, locked, LOCKED_TEXT, MODEL, NOTEBOOK };
});
