/*
 * Pufferfish – Lerninhalte und Bewertung (ohne DOM, in Node testbar)
 *
 * Protokoll je Versuch (Beobachtung → Deutung → Erklärung; keine verpflichtende
 * Vermutung), Herleitung der Henderson-Hasselbalch-Gleichung als Trainer, sechs
 * Rechenaufgaben mit getrennter Fehlerdiagnose, Herstellungsrechnung und
 * Auswertung für Versuch 3, Anwendungen, Hefteintrag.
 * Geschlossene Formate werden bewertet (nach Antwort-ID, unabhängig von der
 * Bildschirmposition); eigene Formulierungen (Freitext) werden nur gespeichert,
 * nie per Wortsuche als richtig/falsch eingestuft.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('../../../shared/labkit/js/core.js') : root.LK.core;
  const chem = isNode ? require('./chem.js') : root.PF.chem;
  const api = factory(core, chem);
  if (isNode) module.exports = api;
  else (root.PF = root.PF || {}).learn = api;
})(typeof self !== 'undefined' ? self : this, function (core, C) {
  'use strict';
  const fmt = core.fmt;

  // ------------------------------------------------------------ Zahlen lesen
  /** Zahl mit Komma oder Punkt, auch „2 : 1“, „1:0,5“ oder „10^0,3“. */
  function num(s) {
    const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(/·/g, '*').replace(/×/g, '*');
    if (!t) return NaN;
    if (/^[-+]?[\d.,]+:[\d.,]+$/.test(t)) {
      const [a, b] = t.split(':').map((x) => core.parseNum(x));
      return b ? a / b : NaN;
    }
    const pow = /^10\^\(?([-+]?[\d.,]+)\)?$/.exec(t);
    if (pow) return Math.pow(10, core.parseNum(pow[1]));
    if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
    return Number(t.replace(',', '.'));
  }
  const within = (v, ref, rel, abs) => Math.abs(v - ref) <= Math.max(abs || 0, Math.abs(ref) * (rel || 0));

  // ------------------------------------------------------------ Protokolle
  // Evidenz: s = Zusammenfassung der eigenen Messreihen (siehe app: evidence())
  const has = (s, exp, reagent) => !!(s && s[exp] && s[exp][reagent]);
  const need = (exp, reagent, text) => (s) => has(s, exp, reagent) ? true : text;

  const FREE_NOTE = 'Wird nicht bewertet und nicht geprüft; deine Antwort erscheint im Journal.';

  const PROTOCOLS = {
    e1: {
      intro: 'Zwei gleich große Proben: Wasser und eine Pufferlösung. Beide enthalten Universalindikator. Wähle Salzsäure oder Natronlauge und gib nacheinander dieselbe Menge in beide Gläser. Vergleiche die pH-Änderungen im Glas, in der Tabelle und – wenn du magst – in der pH-Kurve. Danach wertest du aus.',
      material: 'je 30,0 mL Wasser bzw. Pufferlösung · HCl und NaOH, je c = 0,100 mol/L · Tropfpipette (1 Tropfen ≙ 0,050 mL, vereinbarte Simulationsgröße) · Messpipette',
      questions: [
        {
          id: 'o1', step: 'Beobachtung', type: 'multi', text: 'Was hast du beobachtet? Kreuze alles Zutreffende an.',
          options: [
            { v: 'a', t: 'Schon ein Tropfen HCl senkt den pH-Wert des Wassers um mehrere Einheiten.', ok: true, needs: need('e1', 'HCl', 'Führe zuerst die Säurereihe durch.') },
            { v: 'b', t: 'In der Pufferlösung ändert sich der pH-Wert bei einem Tropfen HCl um weniger als 0,1.', ok: true, needs: need('e1', 'HCl', 'Führe zuerst die Säurereihe durch.') },
            { v: 'c', t: 'Auch bei Natronlauge ändert sich der pH-Wert der Pufferlösung zunächst nur wenig.', ok: true, needs: need('e1', 'NaOH', 'Führe dazu auch die Laugenreihe durch.') },
            { v: 'd', t: 'Der pH-Wert der Pufferlösung bleibt bei jeder Zugabemenge exakt gleich.', ok: false, fb: 'Schau genau hin: Auch in der Pufferlösung ändert sich der pH-Wert – nur viel weniger, und bei großen Zugaben zunehmend stärker.' },
            { v: 'e', t: 'Wasser reagiert auf Natronlauge kaum.', ok: false, fb: 'Ein Tropfen NaOH hebt den pH-Wert des Wassers um mehrere Einheiten.' }
          ],
          hints: ['Vergleiche in der Tabelle oder in der pH-Kurve die beiden Proben bei gleicher Zugabe.', 'Lies die ΔpH-Werte im Glas oder in der Ergebnistabelle ab – nach einem Tropfen und nach größeren Zugaben.', 'Richtig sind die Aussagen über die starke Änderung im Wasser und die geringe (aber vorhandene) Änderung in der Pufferlösung – für Säure und für Lauge.'],
          solution: 'Zutreffend: a, b, c. Im Wasser genügt ein Tropfen für eine Änderung um mehrere pH-Einheiten. In der Pufferlösung bleibt die Änderung bei Säure und Lauge zunächst klein, ist aber nie null und wird bei großen Zugaben stärker.'
        },
        {
          id: 'd1', step: 'Deutung', type: 'single', text: 'Die Pufferlösung mildert saure UND basische Zugaben ab. Was muss sie enthalten?',
          options: [
            { v: 'a', t: 'Eine starke Säure, die zugegebene OH⁻-Ionen neutralisiert.', ok: false, fb: 'Eine starke Säure könnte OH⁻ umsetzen – aber dann wäre die Probe stark sauer, und zugegebene Säure würde nicht abgemildert.' },
            { v: 'b', t: 'Teilchen, die Protonen von H₃O⁺ aufnehmen, und Teilchen, die Protonen an OH⁻ abgeben – eine schwache Säure und ihre korrespondierende Base.', ok: true },
            { v: 'c', t: 'Einen Stoff, der die zugegebenen Ionen einschließt und dauerhaft speichert.', ok: false, fb: 'Teilchen werden nicht eingeschlossen oder „weggesperrt“. Es findet eine Protonenübertragung statt: Aus einem starken Teilchen wird ein schwächerer Partner.' },
            { v: 'd', t: 'Nur einen besonders stabilen Indikator.', ok: false, fb: 'Der Indikator zeigt den pH-Wert nur an. Auch das pH-Messgerät zeigt die geringe Änderung.' }
          ],
          hints: ['Was passiert mit zugegebenem H₃O⁺, wenn es auf ein Teilchen trifft, das ein Proton aufnehmen kann?', 'Für Säure braucht man einen Protonenempfänger, für Lauge einen Protonenspender.', 'Gesucht ist ein Säure-Base-Paar: schwache Säure HA und korrespondierende Base A⁻ nebeneinander.'],
          solution: 'b: Eine schwache Säure und ihre korrespondierende Base. Die Base nimmt Protonen von H₃O⁺ auf, die Säure gibt Protonen an OH⁻ ab.'
        },
        {
          id: 'x1', step: 'Erklärung (Teilchenebene)', type: 'single', text: 'Die Pufferlösung ist ein Phosphatpuffer: c(H₂PO₄⁻) = c(HPO₄²⁻) = 0,050 mol/L. Welche Reaktion läuft bei Zugabe von Salzsäure ab?',
          options: [
            { v: 'a', t: 'HPO₄²⁻ + H₃O⁺ → H₂PO₄⁻ + H₂O', ok: true },
            { v: 'b', t: 'H₂PO₄⁻ + H₃O⁺ → HPO₄²⁻ + H₂O', ok: false, fb: 'Prüfe die Ladungen und Protonen: Nimmt ein Teilchen ein Proton auf, wird es um eine negative Ladung „ärmer“.' },
            { v: 'c', t: 'H₃O⁺ + Cl⁻ → HCl + H₂O', ok: false, fb: 'Cl⁻ ist eine äußerst schwache Base und nimmt praktisch kein Proton auf.' },
            { v: 'd', t: 'HPO₄²⁻ + H₃O⁺ → HPO₄²⁻ (H₃O⁺ wird gespeichert)', ok: false, fb: 'Teilchen werden nicht gespeichert; ein Proton wird übertragen.' }
          ],
          hints: ['Vergleiche im Teilchenmodell die Symbole der Pufferlösung vor und nach der Zugabe von HCl.', 'Die basische Form nimmt das Proton auf.', 'HPO₄²⁻ + H₃O⁺ → H₂PO₄⁻ + H₂O'],
          solution: 'a: HPO₄²⁻ + H₃O⁺ → H₂PO₄⁻ + H₂O. Bei Natronlauge: H₂PO₄⁻ + OH⁻ → HPO₄²⁻ + H₂O.'
        },
        {
          id: 'x2', step: 'Erklärung (Teilchenebene)', type: 'single', text: 'Und bei Zugabe von Natronlauge?',
          options: [
            { v: 'a', t: 'H₂PO₄⁻ + OH⁻ → HPO₄²⁻ + H₂O', ok: true },
            { v: 'b', t: 'HPO₄²⁻ + OH⁻ → H₂PO₄⁻ + H₂O', ok: false, fb: 'OH⁻ nimmt ein Proton auf – das muss von der sauren Form kommen.' },
            { v: 'c', t: 'Na⁺ + OH⁻ → NaOH', ok: false, fb: 'Natrium-Ionen sind nur Gegenionen; sie reagieren hier nicht.' },
            { v: 'd', t: 'OH⁻ bleibt frei, weil im Puffer keine Säure ist', ok: false, fb: 'Die saure Form H₂PO₄⁻ ist ein Protonenspender.' }
          ],
          hints: ['Wer gibt im Puffer ein Proton ab?', 'Die saure Form des Paars reagiert mit OH⁻.', 'H₂PO₄⁻ + OH⁻ → HPO₄²⁻ + H₂O'],
          solution: 'a: H₂PO₄⁻ + OH⁻ → HPO₄²⁻ + H₂O.'
        },
        { id: 'f1', step: 'Erklärung in eigenen Worten', type: 'free', text: 'Erkläre in 1–3 Sätzen, warum sich der pH-Wert der Pufferlösung nach Zugabe von HCl weniger stark ändert als bei Wasser.', expect: '1–3 Sätze; nenne, welche Teilchen der Pufferlösung mit H₃O⁺ reagieren.', note: FREE_NOTE }
      ]
    },
    e2: {
      intro: 'Drei Proben mit derselben Gesamtmenge des Acetatsystems, aber unterschiedlicher Zusammensetzung: Essigsäure, Natriumacetat und ein Gemisch. Wähle Salzsäure oder Natronlauge, dosiere in alle drei Gläser und vergleiche. Zur Erinnerung: Bei der Halbtitration einer schwachen Säure liegen Säure und korrespondierende Base nebeneinander vor – so ein Gemisch steht hier in Glas C.',
      material: 'je 30,0 mL: Essigsäure 0,100 mol/L · Natriumacetat 0,100 mol/L · Gemisch je 0,050 mol/L · HCl und NaOH, je 0,100 mol/L',
      questions: [
        {
          id: 'o2', step: 'Beobachtung', type: 'multi', text: 'Was zeigen deine Messungen? Kreuze alles Zutreffende an.',
          options: [
            { v: 'a', t: 'Im Gemisch ändert sich der pH-Wert bei Säure- und bei Laugenzugabe nur wenig.', ok: true, needs: (s) => (has(s, 'e2', 'HCl') && has(s, 'e2', 'NaOH')) || 'Dafür brauchst du Säure- UND Laugenreihe.' },
            { v: 'b', t: 'In der Natriumacetat-Lösung fällt der pH-Wert bei den ersten HCl-Tropfen deutlich, danach nur noch langsam.', ok: true, needs: need('e2', 'HCl', 'Führe zuerst die Säurereihe durch.') },
            { v: 'c', t: 'Die Essigsäure mildert zugegebene Natronlauge ab, weil dabei Acetat entsteht.', ok: true, needs: need('e2', 'NaOH', 'Führe dazu die Laugenreihe durch.') },
            { v: 'd', t: 'Die Essigsäure mildert zugegebene Salzsäure besonders gut ab.', ok: false, fb: 'In der Essigsäure fehlt ein Protonenempfänger in nennenswerter Menge: Zugegebenes H₃O⁺ bleibt großenteils frei.' },
            { v: 'e', t: 'Alle drei Proben starten beim gleichen pH-Wert.', ok: false, fb: 'Die Anfangswerte unterscheiden sich deutlich (etwa 2,9 – 4,75 – 8,9).' }
          ],
          hints: ['Vergleiche jeweils die erste Zugabe und spätere Zugaben.', 'Natriumacetat enthält zunächst nur A⁻ – erst durch die Säure entsteht HA.', 'Zutreffend sind a, b und c.'],
          solution: 'Zutreffend: a, b, c. Essigsäure allein kann Lauge umsetzen (es entsteht Acetat), Acetat allein kann Säure umsetzen (es entsteht Essigsäure). Das Gemisch enthält beide Partner von Anfang an.'
        },
        {
          id: 'd2', step: 'Deutung', type: 'single', text: 'Warum wirkt das Gemisch in beide Richtungen?',
          options: [
            { v: 'a', t: 'Es enthält mehr Essigsäure als die anderen Proben.', ok: false, fb: 'Alle drei Proben enthalten dieselbe Gesamtmenge des Acetatsystems (je 3,0 mmol).' },
            { v: 'b', t: 'Es enthält von Anfang an beide Partner in nennenswerter Menge: CH₃COOH reagiert mit OH⁻, CH₃COO⁻ mit H₃O⁺.', ok: true },
            { v: 'c', t: 'Acetat-Ionen speichern H₃O⁺, bis sie voll sind.', ok: false, fb: 'Es gibt keinen Speicher: CH₃COO⁻ nimmt ein Proton auf und wird zu CH₃COOH.' },
            { v: 'd', t: 'Sein pH-Wert liegt bei 7.', ok: false, fb: 'Der Acetatpuffer liegt bei etwa pH 4,75 – Puffer müssen nicht neutral sein.' }
          ],
          hints: ['Welche Teilchen braucht man für Säure, welche für Lauge?', 'Die Gesamtmenge ist gleich – nur die Zusammensetzung unterscheidet sich.', 'Beide Partner (HA und A⁻) müssen in nennenswerter Menge vorhanden sein.'],
          solution: 'b: Beide Partner liegen in nennenswerter Menge vor; die Säure setzt OH⁻ um, die Base H₃O⁺.'
        },
        {
          id: 'x3', step: 'Erklärung (Teilchenebene)', type: 'single', text: 'Welche Gleichung beschreibt die Säurezugabe zum Gemisch?',
          options: [
            { v: 'a', t: 'CH₃COO⁻ + H₃O⁺ → CH₃COOH + H₂O', ok: true },
            { v: 'b', t: 'CH₃COOH + H₃O⁺ → CH₃COO⁻ + H₂O', ok: false, fb: 'Eine Säure nimmt kein weiteres Proton auf; die Ladungen gehen hier auch nicht auf.' },
            { v: 'c', t: 'CH₃COO + H₃O⁺ → CH₃COOH + H₂O⁺', ok: false, fb: 'Acetat ist ein Anion (CH₃COO⁻); Wasser entsteht ungeladen.' },
            { v: 'd', t: 'H₃O⁺ + OH⁻ → 2 H₂O', ok: false, fb: 'Diese Neutralisation läuft ab, wenn H₃O⁺ und OH⁻ zusammentreffen – im Puffer ist der Partner von H₃O⁺ aber vor allem CH₃COO⁻.' }
          ],
          hints: ['Vergleiche im Teilchenmodell die Symbole im Gemisch vor und nach der Zugabe von HCl.', 'A⁻ nimmt das Proton auf.', 'CH₃COO⁻ + H₃O⁺ → CH₃COOH + H₂O'],
          solution: 'a: CH₃COO⁻ + H₃O⁺ → CH₃COOH + H₂O; bei Lauge: CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O.'
        },
        {
          id: 'x4', step: 'Erklärung (Teilchenebene)', type: 'single', text: 'Und welche Gleichung beschreibt die Laugenzugabe zum Gemisch?',
          options: [
            { v: 'a', t: 'CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O', ok: true },
            { v: 'b', t: 'CH₃COO⁻ + OH⁻ → CH₃COOH + H₂O', ok: false, fb: 'OH⁻ nimmt ein Proton auf – das muss von der Säure CH₃COOH kommen, nicht vom Anion.' },
            { v: 'c', t: 'Na⁺ + OH⁻ → NaOH', ok: false, fb: 'Natrium-Ionen sind nur Gegenionen; sie reagieren hier nicht.' },
            { v: 'd', t: 'CH₃COOH + OH⁻ → CH₃COOH (OH⁻ wird gespeichert)', ok: false, fb: 'Teilchen werden nicht gespeichert; ein Proton wird übertragen.' }
          ],
          hints: ['Wer im Gemisch kann ein Proton abgeben?', 'Die saure Form des Paars reagiert mit OH⁻.', 'CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O'],
          solution: 'a: CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O.'
        },
        { id: 'f2', step: 'Erklärung in eigenen Worten', type: 'free', text: 'Erkläre in 1–3 Sätzen, wie CH₃COOH und CH₃COO⁻ im Gemisch zusammenwirken, wenn HCl bzw. NaOH zugegeben wird.', expect: '1–3 Sätze; nenne für Säure und für Lauge, welcher Partner reagiert und was entsteht.', note: FREE_NOTE }
      ]
    },
    e3: {
      intro: 'Stelle eine Pufferlösung mit vorgegebenem pH-Wert her: Ziel-pH und Puffersystem wählen → Mischungsverhältnis und Volumina selbst berechnen → die beiden Stammlösungen dosieren → pH-Wert mit der pH-Messelektrode überprüfen.',
      material: 'Stammlösungen des gewählten Systems, je c = 0,100 mol/L · Gesamtvolumen 30,0 mL · Messpipette (bis 10 mL) · pH-Messelektrode · 25 °C, ideales Modell',
      questions: [
        {
          id: 'q31', step: 'Auswahl des Systems', type: 'single', text: 'Nach welchem Kriterium wählt man das Puffersystem für einen Ziel-pH?',
          options: [
            { v: 'a', t: 'Der pKₛ-Wert des Paars liegt nahe am Ziel-pH (Faustregel: Ziel-pH ≈ pKₛ ± 1).', ok: true },
            { v: 'b', t: 'Man nimmt das System mit dem größten pKₛ-Wert, weil es am stärksten puffert.', ok: false, fb: 'Der pKₛ-Wert muss zum Ziel-pH passen, nicht möglichst groß sein.' },
            { v: 'c', t: 'Jedes Paar puffert bei jedem pH-Wert gleich gut.', ok: false, fb: 'Außerhalb von etwa pKₛ ± 1 ist ein Partner zu knapp – das Paar puffert dort kaum noch.' },
            { v: 'd', t: 'Man nimmt das System mit der höchsten Stammlösungskonzentration.', ok: false, fb: 'Die Konzentration bestimmt die Kapazität, nicht den pH-Bereich.' }
          ],
          hints: ['Bei welchem Verhältnis n(A⁻) : n(HA) ist die Pufferwirkung gut?', 'Faustregel: Verhältnis zwischen 1 : 10 und 10 : 1.', 'Dann liegt der pH-Wert im Bereich pKₛ ± 1.'],
          solution: 'a: Der pKₛ-Wert muss in der Nähe des Ziel-pH liegen (Näherung pKₛ ± 1), damit beide Partner in nennenswerter Menge vorliegen.'
        },
        {
          id: 'q32', step: 'Auswertung', type: 'single', text: 'Du gibst von der Base-Lösung mehr zu, als du berechnet hast (Säure-Lösung wie berechnet). Wie ändert sich der pH-Wert?',
          options: [
            { v: 'a', t: 'Er wird höher, weil n(A⁻)/n(HA) größer wird.', ok: true },
            { v: 'b', t: 'Er wird niedriger, weil mehr Base mehr H₃O⁺ erzeugt.', ok: false, fb: 'Mehr Base bedeutet mehr A⁻ und damit ein größeres Verhältnis n(A⁻)/n(HA) – der pH-Wert steigt.' },
            { v: 'c', t: 'Er bleibt gleich, weil das Gesamtvolumen gleich bleibt.', ok: false, fb: 'Nicht das Volumen, sondern das Verhältnis der Stoffmengen bestimmt den pH-Wert.' }
          ],
          hints: ['Setze in pH = pKₛ + lg[n(A⁻)/n(HA)] ein.', 'Mehr A⁻ vergrößert den Quotienten.', 'Ein größerer Quotient hat einen größeren Logarithmus.'],
          solution: 'a: n(A⁻) steigt, der Quotient und lg wachsen – der pH-Wert wird höher.'
        },
        { id: 'f3', step: 'Auswertung in eigenen Worten', type: 'free', text: 'Vergleiche in 1–3 Sätzen deinen gemessenen pH-Wert mit dem Ziel-pH und nenne eine mögliche Ursache für eine Abweichung.', expect: '1–3 Sätze; nenne Zahlenwerte (Messwert, Ziel-pH) und eine Ursache (z. B. Volumen, Verhältnis, Modellgrenze).', note: FREE_NOTE }
      ]
    }
  };


  // ------------------------------------------------------------ Stabile Mischung der Antworten
  function hash32(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) {
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** Gemischte Reihenfolge der Antwort-IDs; hängt nur von Sitzungs-Seed und Frage ab (Fisher-Yates). */
  function shuffled(seed, key, ids) {
    const rnd = mulberry32(hash32(String(seed) + '|' + key));
    const a = ids.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /** Gespeicherte Reihenfolge je Frage: einmal erzeugt, danach unverändert (auch nach Neuladen). */
  function orderFor(store, seed, key, ids) {
    const have = store[key];
    if (Array.isArray(have) && have.length === ids.length && ids.every((i) => have.includes(i))) return have;
    const o = shuffled(seed, key, ids);
    store[key] = o;
    return o;
  }

  /**
   * Bewertet eine Frage. ans: Wert (single), Array (multi). s: Evidenz.
   * Ergebnis: { status: 'right'|'wrong'|'partial'|'empty'|'unproven', fb, marks: {v: 'y'|'n'|'u'} }
   */
  function gradeQuestion(q, ans, s) {
    if (q.type === 'single') {
      if (!ans) return { status: 'empty', fb: 'Noch keine Auswahl.' };
      const o = q.options.find((x) => x.v === ans);
      if (!o) return { status: 'empty', fb: 'Noch keine Auswahl.' };
      return o.ok ? { status: 'right', fb: 'Richtig.' } : { status: 'wrong', fb: o.fb || 'Nicht zutreffend.' };
    }
    if (q.type === 'multi') {
      const sel = new Set(Array.isArray(ans) ? ans : []);
      if (!sel.size) return { status: 'empty', fb: 'Noch nichts angekreuzt.' };
      const marks = {}, fbs = [];
      let wrong = 0, missing = 0, unproven = 0;
      for (const o of q.options) {
        const ev = o.needs ? o.needs(s) : true;
        const chosen = sel.has(o.v);
        if (chosen && ev !== true) { marks[o.v] = 'u'; unproven++; fbs.push(ev); continue; }
        if (chosen && !o.ok) { marks[o.v] = 'n'; wrong++; if (o.fb) fbs.push(o.fb); }
        else if (chosen && o.ok) marks[o.v] = 'y';
        else if (!chosen && o.ok) missing++;
      }
      if (!wrong && !missing && !unproven) return { status: 'right', fb: 'Alles richtig.', marks };
      if (unproven && !wrong) return { status: 'unproven', fb: 'Für einige Aussagen fehlt noch deine eigene Messung: ' + [...new Set(fbs)].join(' '), marks };
      const tail = missing ? ` Es fehlt noch ${missing === 1 ? 'eine zutreffende Aussage' : missing + ' zutreffende Aussagen'}.` : '';
      return { status: wrong ? 'wrong' : 'partial', fb: (fbs.length ? [...new Set(fbs)].join(' ') : '') + tail, marks };
    }
    return { status: 'free' };
  }

  // ------------------------------------------------------------ Herleitung (Trainer)
  const THEORY = [
    {
      id: 't1', title: 'Protolyse der schwachen Säure', intro: 'Ausgangspunkt ist das Gleichgewicht der schwachen Säure HA mit Wasser.',
      fields: [
        { id: 'a', type: 'select', label: 'HA + H₂O ⇌', options: ['A⁻', 'HA', 'H₃O⁺', 'OH⁻'], ok: 'A⁻' },
        { id: 'b', type: 'select', label: '+', options: ['H₃O⁺', 'OH⁻', 'H₂O', 'A⁻'], ok: 'H₃O⁺' }
      ],
      hints: ['Eine Säure gibt ein Proton ab – an wen?', 'HA gibt ein Proton an H₂O ab; aus HA wird A⁻.', 'HA + H₂O ⇌ A⁻ + H₃O⁺'],
      solution: 'HA + H₂O ⇌ A⁻ + H₃O⁺'
    },
    {
      id: 't2', title: 'Säurekonstante', intro: 'Im idealisierten Konzentrationsmodell gilt das Massenwirkungsgesetz. Konzentrationen sind auf die Standardkonzentration 1 mol/L bezogen; Wasser als Lösungsmittel erscheint nicht im Ausdruck.',
      fields: [{ id: 'a', type: 'radio', label: 'Kₛ =', options: ['c(H₃O⁺) · c(A⁻) / c(HA)', 'c(HA) / (c(H₃O⁺) · c(A⁻))', 'c(H₃O⁺) · c(A⁻) · c(H₂O) / c(HA)', 'c(H₃O⁺) / c(A⁻)'], ok: 'c(H₃O⁺) · c(A⁻) / c(HA)', fbs: { 'c(HA) / (c(H₃O⁺) · c(A⁻))': 'Produkte stehen im Zähler, Edukte im Nenner.', 'c(H₃O⁺) · c(A⁻) · c(H₂O) / c(HA)': 'Wasser ist Lösungsmittel; seine Konzentration ist praktisch konstant und steckt in Kₛ.', 'c(H₃O⁺) / c(A⁻)': 'Die Säure HA fehlt im Ausdruck.' } }],
      hints: ['Massenwirkungsgesetz: Produkte durch Edukte.', 'Produkte: A⁻ und H₃O⁺; Edukt: HA (Wasser nicht).', 'Kₛ = c(H₃O⁺) · c(A⁻) / c(HA)'],
      solution: 'Kₛ = c(H₃O⁺) · c(A⁻) / c(HA)'
    },
    {
      id: 't3', title: 'Nach c(H₃O⁺) umstellen',
      fields: [{ id: 'a', type: 'radio', label: 'c(H₃O⁺) =', options: ['Kₛ · c(HA) / c(A⁻)', 'Kₛ · c(A⁻) / c(HA)', 'c(HA) / (Kₛ · c(A⁻))', 'Kₛ − c(A⁻) / c(HA)'], ok: 'Kₛ · c(HA) / c(A⁻)', fbs: { 'Kₛ · c(A⁻) / c(HA)': 'Beide Seiten mit c(HA) multiplizieren und durch c(A⁻) teilen – prüfe, wo c(HA) landet.', 'c(HA) / (Kₛ · c(A⁻))': 'Kₛ steht im Zähler, wenn man mit c(HA)/c(A⁻) multipliziert.', 'Kₛ − c(A⁻) / c(HA)': 'Es wird multipliziert und dividiert, nicht subtrahiert.' } }],
      hints: ['Multipliziere beide Seiten mit c(HA).', 'Dann teile durch c(A⁻).', 'c(H₃O⁺) = Kₛ · c(HA) / c(A⁻)'],
      solution: 'c(H₃O⁺) = Kₛ · c(HA) / c(A⁻)'
    },
    {
      id: 't4', title: 'Negativen dekadischen Logarithmus anwenden', intro: 'Mit pH = −lg c(H₃O⁺) und pKₛ = −lg Kₛ. Regel: lg(a · b) = lg a + lg b.',
      fields: [
        { id: 'a', type: 'radio', label: 'pH =', options: ['pKₛ − lg[c(HA)/c(A⁻)]', 'pKₛ + lg[c(HA)/c(A⁻)]', 'pKₛ · lg[c(HA)/c(A⁻)]', '−pKₛ − lg[c(HA)/c(A⁻)]'], ok: 'pKₛ − lg[c(HA)/c(A⁻)]', fbs: { 'pKₛ + lg[c(HA)/c(A⁻)]': 'Das Minus vor dem Logarithmus gilt für beide Faktoren.', 'pKₛ · lg[c(HA)/c(A⁻)]': 'Der Logarithmus eines Produkts ist eine Summe.', '−pKₛ − lg[c(HA)/c(A⁻)]': '−lg Kₛ ist bereits pKₛ (positiv).' } },
        { id: 'b', type: 'radio', label: 'Aus −lg[c(HA)/c(A⁻)] wird +lg[c(A⁻)/c(HA)], weil …', options: ['lg(1/x) = −lg x (Kehrwert)', 'lg(a/b) = lg a · lg b', 'sich Minus und Bruchstrich wegkürzen'], ok: 'lg(1/x) = −lg x (Kehrwert)', fbs: { 'lg(a/b) = lg a · lg b': 'lg(a/b) = lg a − lg b.', 'sich Minus und Bruchstrich wegkürzen': 'Man nutzt die Logarithmusregel für den Kehrwert.' } }
      ],
      hints: ['−lg(Kₛ · Q) = −lg Kₛ − lg Q', 'Mit Q = c(HA)/c(A⁻): pH = pKₛ − lg Q', 'Den Kehrwert bilden dreht das Vorzeichen: −lg Q = +lg(1/Q).'],
      solution: 'pH = pKₛ − lg[c(HA)/c(A⁻)] = pKₛ + lg[c(A⁻)/c(HA)], denn −lg x = lg(1/x).'
    },
    {
      id: 't5', title: 'Die Puffergleichung und die Richtung einer pH-Änderung', intro: 'Henderson-Hasselbalch: pH = pKₛ + lg[c(A⁻)/c(HA)]',
      fields: [
        { id: 'a', type: 'select', label: 'Nach Zugabe von Salzsäure wird c(A⁻)/c(HA)', options: ['kleiner', 'größer', 'gleich'], ok: 'kleiner' },
        { id: 'b', type: 'select', label: 'und der pH-Wert', options: ['sinkt', 'steigt', 'bleibt exakt gleich'], ok: 'sinkt' }
      ],
      hints: ['H₃O⁺ reagiert mit A⁻ zu HA.', 'A⁻ wird weniger, HA mehr – der Quotient …', 'Quotient kleiner → lg kleiner → pH sinkt (wenig, solange beide Partner reichlich vorhanden sind).'],
      solution: 'c(A⁻)/c(HA) wird kleiner, der pH-Wert sinkt – bei ausreichend vielen Partnern nur wenig.'
    },
    {
      id: 't6', title: 'Stoffmengen statt Konzentrationen', intro: 'Im selben Gemisch teilen sich HA und A⁻ ein Volumen.',
      fields: [
        { id: 'a', type: 'radio', label: 'Warum darf man n(A⁻)/n(HA) einsetzen?', options: ['c = n/V, und das gemeinsame Volumen kürzt sich heraus.', 'Weil n und c dasselbe sind.', 'Weil Stoffmengen immer genauer sind.'], ok: 'c = n/V, und das gemeinsame Volumen kürzt sich heraus.', fbs: { 'Weil n und c dasselbe sind.': 'c = n/V – nur im Quotienten kürzt sich V.', 'Weil Stoffmengen immer genauer sind.': 'Es geht um das Kürzen des gemeinsamen Volumens.' } },
        { id: 'b', type: 'number', label: '20 mL Essigsäure (0,10 mol/L) + 10 mL Natriumacetat-Lösung (0,20 mol/L): n(A⁻)/n(HA) =', check: (v) => within(v, 1, 0.02) ? { ok: true } : within(v, 2, 0.02) ? { ok: false, fb: 'Du hast die Konzentrationen der Stammlösungen eingesetzt. Rechne erst n = c · V.' } : within(v, 0.5, 0.02) ? { ok: false, fb: 'Kehrwert und Stammlösungskonzentrationen – berechne n(A⁻) und n(HA) einzeln mit n = c · V.' } : { ok: false, fb: 'Berechne n(HA) = 0,10 mol/L · 20 mL und n(A⁻) = 0,20 mol/L · 10 mL.' } }
      ],
      hints: ['c(A⁻)/c(HA) = (n(A⁻)/V)/(n(HA)/V)', 'n = c · V: 0,10 mol/L · 20 mL = 2,0 mmol', 'n(HA) = 2,0 mmol, n(A⁻) = 0,20 · 10 = 2,0 mmol → Verhältnis 1'],
      solution: 'Das Volumen kürzt sich. n(HA) = 2,0 mmol, n(A⁻) = 2,0 mmol, also n(A⁻)/n(HA) = 1 (nicht 2!).'
    },
    {
      id: 't7', title: 'Pufferbereich', intro: 'Acetatpuffer, pKₛ = 4,75. Berechne den pH-Wert für verschiedene Verhältnisse c(A⁻) : c(HA).',
      fields: [
        { id: 'a', type: 'number', label: 'c(A⁻) : c(HA) = 1 : 1 → pH =', check: (v) => within(v, 4.75, 0, 0.011) ? { ok: true } : { ok: false, fb: 'lg 1 = 0.' } },
        { id: 'b', type: 'number', label: 'c(A⁻) : c(HA) = 10 : 1 → pH =', check: (v) => within(v, 5.75, 0, 0.011) ? { ok: true } : within(v, 3.75, 0, 0.011) ? { ok: false, fb: 'Vorzeichen: Mehr Base → höherer pH.' } : { ok: false, fb: 'lg 10 = 1.' } },
        { id: 'c', type: 'number', label: 'c(A⁻) : c(HA) = 1 : 10 → pH =', check: (v) => within(v, 3.75, 0, 0.011) ? { ok: true } : within(v, 5.75, 0, 0.011) ? { ok: false, fb: 'Vorzeichen: Mehr Säure → niedrigerer pH.' } : { ok: false, fb: 'lg 0,1 = −1.' } },
        { id: 'd', type: 'radio', label: 'Üblicher Pufferbereich (Faustregel):', options: ['pH ≈ pKₛ ± 1', 'genau pH = pKₛ', 'pH 0 bis 14', 'pKₛ ± 7'], ok: 'pH ≈ pKₛ ± 1', fbs: { 'genau pH = pKₛ': 'pH = pKₛ ist die Mitte des Bereichs (gleiche Anteile), nicht der ganze Bereich.', 'pH 0 bis 14': 'Außerhalb von etwa 1 : 10 … 10 : 1 ist ein Partner zu knapp.', 'pKₛ ± 7': 'Das wäre die ganze pH-Skala.' } }
      ],
      hints: ['Setze in pH = pKₛ + lg[c(A⁻)/c(HA)] ein.', 'lg 10 = 1, lg 1 = 0, lg 0,1 = −1', 'pH 4,75 / 5,75 / 3,75 – Bereich pKₛ ± 1'],
      solution: '1 : 1 → 4,75; 10 : 1 → 5,75; 1 : 10 → 3,75. Faustregel: Pufferbereich pKₛ ± 1 (Grenzen sind fließend, keine harte Wirksamkeitsgrenze).'
    }
  ];

  function gradeField(f, val) {
    if (val == null || String(val).trim() === '') return { ok: false, empty: true, fb: 'Noch keine Eingabe.' };
    if (f.type === 'number') {
      const v = num(val);
      if (!Number.isFinite(v)) return { ok: false, fb: 'Bitte eine Zahl eingeben (Dezimalkomma erlaubt).' };
      return f.check(v);
    }
    if (val === f.ok) return { ok: true };
    return { ok: false, fb: (f.fbs && f.fbs[val]) || 'Noch nicht richtig.' };
  }

  // ------------------------------------------------------------ Rechenaufgaben
  const UNITS = ['mmol', 'mol', 'mol/L', 'mL'];
  const toMmol = (v, u) => (u === 'mmol' ? v : u === 'mol' ? v * 1000 : NaN);

  function amountField(ref, label, wrongs) {
    return {
      id: label, type: 'amount', label,
      check(v, u) {
        if (u === 'mol/L') return { ok: false, kind: 'unit', fb: 'Das ist eine Konzentration. Gefragt ist die Stoffmenge (mmol oder mol).' };
        if (u === 'mL') return { ok: false, kind: 'unit', fb: 'mL ist ein Volumen. Gefragt ist die Stoffmenge.' };
        const m = toMmol(v, u);
        if (within(m, ref, 0.01)) return { ok: true };
        if (within(v, ref, 0.01) && u === 'mol') return { ok: false, kind: 'unit', fb: `${fmt(v, 2)} mol wären tausendmal zu viel – meinst du mmol?` };
        if (within(v * 1000, ref, 0.01) && u === 'mmol') return { ok: false, kind: 'unit', fb: 'Zahl passt zu mol, die Einheit ist aber mmol.' };
        for (const w of wrongs) if (within(m, w.v, 0.01)) return { ok: false, kind: w.kind, fb: w.fb };
        return { ok: false, kind: 'calc', fb: 'Rechne die Stoffmengen mit n = c · V und berücksichtige den Umsatz.' };
      }
    };
  }

  const TASKS = [
    {
      id: 'k1', n: 1, title: 'Pufferbereich des Acetatpuffers',
      text: 'Essigsäure/Acetat: pKₛ = 4,75. Berechne die untere und obere Grenze des üblichen Pufferbereichs und begründe.',
      fields: [
        { id: 'lo', type: 'number', label: 'untere Grenze: pH =', check: (v) => within(v, 3.75, 0, 0.051) ? { ok: true } : within(v, 4.75, 0, 0.011) ? { ok: false, kind: 'concept', fb: 'pH = pKₛ ist die Mitte des Bereichs, nicht die Grenze.' } : within(v, 5.75, 0, 0.011) ? { ok: false, kind: 'concept', fb: 'Das ist die obere Grenze.' } : { ok: false, kind: 'calc', fb: 'Untere Grenze: pKₛ − 1.' } },
        { id: 'hi', type: 'number', label: 'obere Grenze: pH =', check: (v) => within(v, 5.75, 0, 0.051) ? { ok: true } : within(v, 4.75, 0, 0.011) ? { ok: false, kind: 'concept', fb: 'pH = pKₛ ist die Mitte des Bereichs, nicht die Grenze.' } : within(v, 3.75, 0, 0.011) ? { ok: false, kind: 'concept', fb: 'Das ist die untere Grenze.' } : { ok: false, kind: 'calc', fb: 'Obere Grenze: pKₛ + 1.' } },
        { id: 'why', type: 'radio', label: 'Begründung:', options: ['Zwischen c(A⁻) : c(HA) = 1 : 10 und 10 : 1 sind beide Partner in nennenswerter Menge vorhanden; lg 10 = 1.', 'Bei pH = pKₛ ist die Pufferwirkung null.', 'Der Bereich reicht bis pH 7, weil dort neutral ist.'], ok: 'Zwischen c(A⁻) : c(HA) = 1 : 10 und 10 : 1 sind beide Partner in nennenswerter Menge vorhanden; lg 10 = 1.', fbs: { 'Bei pH = pKₛ ist die Pufferwirkung null.': 'Umgekehrt: Bei gleichen Anteilen ist die (differentielle) Pufferwirkung am größten.', 'Der Bereich reicht bis pH 7, weil dort neutral ist.': 'Der Bereich hängt vom pKₛ des Paars ab, nicht vom Neutralpunkt.' } }
      ],
      hints: ['Der Pufferbereich liegt um pKₛ herum.', 'Faustregel: Verhältnis zwischen 1 : 10 und 10 : 1 → lg zwischen −1 und +1.', 'pH = 4,75 ± 1'],
      solution: 'pH = pKₛ ± 1 → etwa 3,75 bis 5,75. Begründung: Zwischen den Verhältnissen 1 : 10 und 10 : 1 liegen beide Partner in nennenswerter Menge vor (lg 10 = 1). Die Grenzen sind eine Faustregel.'
    },
    {
      id: 'k2', n: 2, title: 'Pufferbereich des Phosphatpuffers',
      text: 'Phosphorsäure ist dreiprotonig (pKₛ₁ = 2,15; pKₛ₂ = 7,20; pKₛ₃ = 12,35). Bestimme den Bereich des Paars H₂PO₄⁻/HPO₄²⁻.',
      fields: [
        { id: 'lo', type: 'number', label: 'untere Grenze: pH =', check: (v) => within(v, 6.2, 0, 0.051) ? { ok: true } : (within(v, 1.15, 0, 0.011) || within(v, 11.35, 0, 0.011)) ? { ok: false, kind: 'concept', fb: 'Falsche Stufe: Für H₂PO₄⁻/HPO₄²⁻ gilt pKₛ₂ = 7,20.' } : within(v, 7.2, 0, 0.011) ? { ok: false, kind: 'concept', fb: 'pKₛ₂ ist die Mitte des Bereichs.' } : { ok: false, kind: 'calc', fb: 'Untere Grenze: pKₛ₂ − 1.' } },
        { id: 'hi', type: 'number', label: 'obere Grenze: pH =', check: (v) => within(v, 8.2, 0, 0.051) ? { ok: true } : (within(v, 3.15, 0, 0.011) || within(v, 13.35, 0, 0.011)) ? { ok: false, kind: 'concept', fb: 'Falsche Stufe: Für H₂PO₄⁻/HPO₄²⁻ gilt pKₛ₂ = 7,20.' } : within(v, 7.2, 0, 0.011) ? { ok: false, kind: 'concept', fb: 'pKₛ₂ ist die Mitte des Bereichs.' } : { ok: false, kind: 'calc', fb: 'Obere Grenze: pKₛ₂ + 1.' } }
      ],
      hints: ['Welche Protolysestufe verbindet H₂PO₄⁻ und HPO₄²⁻?', 'H₂PO₄⁻ ⇌ HPO₄²⁻ + H⁺ ist die zweite Stufe.', 'pKₛ₂ ± 1 = 7,20 ± 1'],
      solution: 'Zweite Stufe, pKₛ₂ = 7,20 → Bereich etwa 6,20 bis 8,20. Die anderen Stufen haben eigene Bereiche um 2,15 bzw. 12,35.'
    },
    {
      id: 'k3', n: 3, title: 'Verhältnis für einen Ziel-pH',
      text: 'Ein Acetatpuffer (pKₛ = 4,75) soll pH 5,05 haben. Bestimme c(A⁻)/c(HA) durch Umstellen.',
      fields: [
        { id: 'way', type: 'radio', label: 'Ansatz:', options: ['lg[c(A⁻)/c(HA)] = pH − pKₛ', 'c(A⁻)/c(HA) = pH − pKₛ', 'c(A⁻)/c(HA) = pH / pKₛ'], ok: 'lg[c(A⁻)/c(HA)] = pH − pKₛ', fbs: { 'c(A⁻)/c(HA) = pH − pKₛ': 'pH − pKₛ ist der Logarithmus des Verhältnisses, nicht das Verhältnis selbst.', 'c(A⁻)/c(HA) = pH / pKₛ': 'pH-Werte werden nicht dividiert; stelle die Gleichung um.' } },
        { id: 'q', type: 'number', label: 'c(A⁻)/c(HA) =', check: (v) => within(v, 1.995, 0.02) ? { ok: true } : within(v, 0.501, 0.02) ? { ok: false, kind: 'quotient', fb: 'Falscher Quotient: Du hast c(HA)/c(A⁻) berechnet.' } : within(v, 0.3, 0.04) ? { ok: false, kind: 'log', fb: '0,30 ist lg des Verhältnisses. Das Verhältnis ist 10^0,30.' } : within(v, 5.05 / 4.75, 0.01) ? { ok: false, kind: 'concept', fb: 'pH-Werte werden nicht dividiert.' } : { ok: false, kind: 'calc', fb: 'Rechne 10^(pH − pKₛ).' } }
      ],
      hints: ['Löse pH = pKₛ + lg x nach x auf.', 'lg x = 5,05 − 4,75 = 0,30', 'x = 10^0,30 ≈ 2,0'],
      solution: 'lg[c(A⁻)/c(HA)] = 5,05 − 4,75 = 0,30 → c(A⁻)/c(HA) = 10^0,30 ≈ 2,0 : 1'
    },
    {
      id: 'k4', n: 4, title: 'Nach Säurezugabe',
      text: '100,0 mL Acetatpuffer mit je c = 0,0500 mol/L CH₃COOH und CH₃COO⁻ (pKₛ = 4,75). Zugabe: 10,0 mL HCl, c = 0,100 mol/L. Berechne die Stoffmengen nach dem Umsatz und den neuen pH-Wert.',
      fields: [
        amountField(4.0, 'n(CH₃COO⁻) nachher', [{ v: 5, kind: 'stoich', fb: 'Die Säurezugabe fehlt: H₃O⁺ + CH₃COO⁻ → CH₃COOH + H₂O verbraucht 1,00 mmol Acetat.' }, { v: 6, kind: 'stoich', fb: 'Vertauscht: Die Säure verbraucht Acetat und bildet Essigsäure.' }, { v: 4.5, kind: 'stoich', fb: 'n(HCl) = c · V = 0,100 mol/L · 10,0 mL = 1,00 mmol.' }]),
        amountField(6.0, 'n(CH₃COOH) nachher', [{ v: 5, kind: 'stoich', fb: 'Die Säurezugabe fehlt: Aus 1,00 mmol Acetat entsteht 1,00 mmol Essigsäure.' }, { v: 4, kind: 'stoich', fb: 'Vertauscht: Essigsäure nimmt zu, Acetat nimmt ab.' }, { v: 5.5, kind: 'stoich', fb: 'n(HCl) = c · V = 0,100 mol/L · 10,0 mL = 1,00 mmol.' }]),
        { id: 'pH', type: 'number', label: 'neuer pH-Wert:', check: (v) => within(v, 4.574, 0, 0.021) ? { ok: true } : within(v, 4.926, 0, 0.021) ? { ok: false, kind: 'quotient', fb: 'Falscher Quotient: Im Zähler steht n(A⁻), im Nenner n(HA).' } : within(v, 4.75, 0, 0.011) ? { ok: false, kind: 'stoich', fb: 'Das ist der Anfangswert – rechne mit den Stoffmengen nach dem Umsatz.' } : within(v, 2.04, 0, 0.05) ? { ok: false, kind: 'concept', fb: 'Das wäre der pH-Wert der Salzsäure allein (ohne Puffer).' } : { ok: false, kind: 'calc', fb: 'pH = 4,75 + lg(n(A⁻)/n(HA)) mit den Werten nach dem Umsatz.' } }
      ],
      hints: ['Erst Stöchiometrie, dann Gleichgewicht: Welche Teilchen reagieren mit H₃O⁺?', 'n vorher: je 0,0500 mol/L · 100,0 mL = 5,00 mmol; n(HCl) = 1,00 mmol.', 'n(A⁻) = 5,00 − 1,00 = 4,00 mmol; n(HA) = 6,00 mmol; pH = 4,75 + lg(4,00/6,00)'],
      solution: 'n(HCl) = 0,100 mol/L · 10,0 mL = 1,00 mmol. CH₃COO⁻ + H₃O⁺ → CH₃COOH + H₂O. n(CH₃COO⁻) = 5,00 − 1,00 = 4,00 mmol; n(CH₃COOH) = 5,00 + 1,00 = 6,00 mmol. pH = 4,75 + lg(4,00/6,00) = 4,75 − 0,176 ≈ 4,57. (Das Volumen 110 mL kürzt sich im Quotienten.)'
    },
    {
      id: 'k5', n: 5, title: 'Puffer auswählen',
      text: 'Ziel-pH 7,40. Zur Verfügung: Acetat (pKₛ = 4,75), Phosphat H₂PO₄⁻/HPO₄²⁻ (pKₛ = 7,20), Ammonium NH₄⁺/NH₃ (pKₛ = 9,25). Wähle ein geeignetes Paar und berechne das Verhältnis Base : Säure.',
      fields: [
        { id: 'pair', type: 'radio', label: 'Geeignetes Paar:', options: ['Acetat', 'Phosphat', 'Ammonium'], ok: 'Phosphat', fbs: { Acetat: 'pKₛ 4,75 liegt 2,65 unter dem Ziel – außerhalb von pKₛ ± 1.', Ammonium: 'pKₛ 9,25 liegt 1,85 über dem Ziel – außerhalb von pKₛ ± 1.' } },
        { id: 'q', type: 'number', label: 'c(Base)/c(Säure) =', check: (v) => within(v, 1.585, 0.025) ? { ok: true } : within(v, 0.631, 0.025) ? { ok: false, kind: 'quotient', fb: 'Falscher Quotient: Gefragt ist Base : Säure, also c(HPO₄²⁻)/c(H₂PO₄⁻).' } : within(v, 0.2, 0.03) ? { ok: false, kind: 'log', fb: '0,20 ist lg des Verhältnisses; das Verhältnis ist 10^0,20.' } : within(v, Math.pow(10, 2.65), 0.03) || within(v, Math.pow(10, -1.85), 0.03) ? { ok: false, kind: 'concept', fb: 'Rechne mit dem pKₛ des geeigneten Paars (7,20).' } : { ok: false, kind: 'calc', fb: '10^(7,40 − 7,20)' } }
      ],
      hints: ['Welcher pKₛ liegt am nächsten am Ziel-pH (höchstens ±1)?', 'Phosphat: lg x = 7,40 − 7,20 = 0,20', 'x = 10^0,20 ≈ 1,58'],
      solution: 'Phosphat (pKₛ 7,20 liegt im Bereich ± 1 um 7,40). c(HPO₄²⁻)/c(H₂PO₄⁻) = 10^0,20 ≈ 1,58 : 1.'
    },
    {
      id: 'k6', n: 6, title: 'Blutbeispiel',
      text: 'Blut, 37 °C, pH 7,40. Effektives System CO₂*/HCO₃⁻ mit CO₂* = CO₂(aq) + H₂CO₃ und pK′ = 6,10: pH = 6,10 + lg[c(HCO₃⁻)/c(CO₂*)]. Berechne das Verhältnis und erkläre die Besonderheit.',
      fields: [
        { id: 'q', type: 'number', label: 'c(HCO₃⁻) : c(CO₂*) =', check: (v) => within(v, 19.95, 0.03) ? { ok: true } : within(v, 0.0501, 0.03) ? { ok: false, kind: 'quotient', fb: 'Falscher Quotient: Gefragt ist HCO₃⁻ zu CO₂*.' } : within(v, 1.3, 0.03) ? { ok: false, kind: 'log', fb: '1,30 ist lg des Verhältnisses; das Verhältnis ist 10^1,30.' } : { ok: false, kind: 'calc', fb: '10^(7,40 − 6,10)' } },
        { id: 'why', type: 'radio', label: 'Besonderheit:', options: ['Das Verhältnis liegt außerhalb von 1 : 10 … 10 : 1; Blut ist aber ein offenes System: CO₂ wird über die Lunge abgeatmet bzw. nachgebildet, HCO₃⁻ über die Niere reguliert.', 'Das Verhältnis gilt für HCO₃⁻ zu molekularer Kohlensäure H₂CO₃.', 'Weil 20 : 1 außerhalb der Faustregel liegt, ist Blut kein Puffer.', 'pK′ = 6,10 gilt auch im 25-°C-Labormodell für H₂CO₃.'], ok: 'Das Verhältnis liegt außerhalb von 1 : 10 … 10 : 1; Blut ist aber ein offenes System: CO₂ wird über die Lunge abgeatmet bzw. nachgebildet, HCO₃⁻ über die Niere reguliert.', fbs: { 'Das Verhältnis gilt für HCO₃⁻ zu molekularer Kohlensäure H₂CO₃.': 'Im Nenner steht CO₂* – ganz überwiegend gelöstes CO₂, nur sehr wenig H₂CO₃.', 'Weil 20 : 1 außerhalb der Faustregel liegt, ist Blut kein Puffer.': 'Gerade das offene System macht den Puffer trotz 20 : 1 wirksam; außerdem puffern Proteine und Hämoglobin mit.', 'pK′ = 6,10 gilt auch im 25-°C-Labormodell für H₂CO₃.': 'pK′ = 6,1 ist ein effektiver Wert für 37 °C und das CO₂-System, nicht der pKₛ echter H₂CO₃.' } }
      ],
      hints: ['Stelle wie in Aufgabe 3 um.', 'lg x = 7,40 − 6,10 = 1,30', 'x = 10^1,30 ≈ 20'],
      solution: 'lg x = 1,30 → c(HCO₃⁻)/c(CO₂*) = 10^1,30 ≈ 20 : 1. Das liegt außerhalb der einfachen Faustregel für einen geschlossenen Puffer. Blut ist ein offenes System: Die Lunge reguliert CO₂ (Abatmen/Nachbilden), die Niere HCO₃⁻. CO₂* ist überwiegend gelöstes CO₂ (c(CO₂*) ≈ α · pCO₂); nur ein winziger Teil liegt als H₂CO₃ vor. Weitere Blutpuffer: Proteine, Hämoglobin.'
    }
  ];

  function gradeTaskField(f, val, unit) {
    if (val == null || String(val).trim() === '') return { ok: false, empty: true, fb: 'Noch keine Eingabe.' };
    if (f.type === 'amount') {
      const v = num(val);
      if (!Number.isFinite(v)) return { ok: false, kind: 'format', fb: 'Bitte eine Zahl eingeben (Dezimalkomma erlaubt).' };
      if (!unit) return { ok: false, kind: 'unit', fb: 'Wähle eine Einheit.' };
      return f.check(v, unit);
    }
    return gradeField(f, val);
  }


  // ------------------------------------------------------------ Versuch 3: Herstellungsrechnung
  /** Standardisierte Übungsaufgaben (je ein System); der Ziel-pH liegt im Bereich pKₛ ± 1. */
  const MIX_TARGETS = [{ id: 't1', pH: 5.05 }, { id: 't2', pH: 6.90 }, { id: 't3', pH: 9.55 }];
  const PH_MIN = 3.5, PH_MAX = 10.5;

  const SYS_ORDER = C.SYSTEM_IDS;
  const rangeText = (id) => `${fmt(C.SYSTEMS[id].pKa - 1, 2)} – ${fmt(C.SYSTEMS[id].pKa + 1, 2)}`;

  /** Prüft Ziel-pH und gewähltes System; Text für die Lernenden. */
  function targetMessage(sys, pH) {
    if (!Number.isFinite(pH) || pH < PH_MIN || pH > PH_MAX) return { ok: false, code: 'invalid', text: `Gib den Ziel-pH als Zahl zwischen ${fmt(PH_MIN, 1)} und ${fmt(PH_MAX, 1)} ein (z. B. 5,05).` };
    const fits = C.suitableSystems(pH);
    if (sys && !C.SYSTEMS[sys]) return { ok: false, code: 'invalid', text: 'Unbekanntes Puffersystem.' };
    if (!fits.length) {
      return { ok: false, code: 'none', text: `Für pH ${fmt(pH, 2)} passt keines der drei Systeme (Faustregel pKₛ ± 1): Acetat ${rangeText('ac')}, Phosphat ${rangeText('ph')}, Ammonium/Ammoniak ${rangeText('am')}. Wähle einen Ziel-pH in einem dieser Bereiche.` };
    }
    if (!sys) return { ok: true, code: 'pick', text: 'Wähle jetzt das Puffersystem, dessen pKₛ-Wert zum Ziel-pH passt.' };
    const a = C.assessTarget(sys, pH), S = C.SYSTEMS[sys];
    if (!a.ok) {
      return { ok: false, code: 'range', text: `${S.name} (pKₛ = ${fmt(S.pKa, 2)}) puffert nur etwa im Bereich ${rangeText(sys)} (Faustregel pKₛ ± 1). pH ${fmt(pH, 2)} liegt ${a.d > 0 ? 'darüber' : 'darunter'}: Dort ist ${a.d > 0 ? 'die Säure HA zu knapp' : 'die Base A⁻ zu knapp'} (Verhältnis außerhalb 1 : 10 … 10 : 1). Wähle ein anderes System.` };
    }
    if (a.code === 'edge') return { ok: true, code: 'edge', text: `Passt, liegt aber am Rand des Bereichs pKₛ ± 1 (Verhältnis ${fmt(Math.pow(10, a.d), 2)} : 1). Dort ist die Pufferwirkung schwächer; pKₛ ± 1 ist nur eine Näherung.` };
    return { ok: true, code: 'ok', text: `${S.name} passt: pKₛ = ${fmt(S.pKa, 2)}, Ziel-pH liegt im Bereich ${rangeText(sys)} (Näherung pKₛ ± 1).` };
  }

  /** Eintrag der Lernenden prüfen. e = { r, vb, va } als Text; plan aus C.planMix. */
  function gradeMixCalc(plan, e) {
    const R = plan.ratio, lgR = plan.pH - plan.pKa;
    const res = {};
    // Verhältnis n(A⁻)/n(HA)
    const sr = String(e.r == null ? '' : e.r).trim();
    if (!sr) res.r = { ok: false, empty: true, fb: 'Noch keine Eingabe.' };
    else {
      const v = num(sr);
      if (!Number.isFinite(v)) res.r = { ok: false, kind: 'format', fb: 'Bitte eine Zahl eingeben (Dezimalkomma erlaubt).' };
      else if (within(v, R, 0.03, 0.05)) res.r = { ok: true };
      else if (within(v, 1 / R, 0.03)) res.r = { ok: false, kind: 'quotient', fb: 'Falscher Quotient: Gefragt ist n(A⁻)/n(HA) – die Base steht im Zähler.' };
      else if (within(v, lgR, 0.03, 0.02)) res.r = { ok: false, kind: 'log', fb: `${fmt(lgR, 2)} ist lg des Verhältnisses (pH − pKₛ). Das Verhältnis selbst ist 10^${fmt(lgR, 2)}.` };
      else if (within(v, plan.pH / plan.pKa, 0.01)) res.r = { ok: false, kind: 'concept', fb: 'pH-Werte werden nicht dividiert; stelle pH = pKₛ + lg[n(A⁻)/n(HA)] nach dem Verhältnis um.' };
      else res.r = { ok: false, kind: 'calc', fb: 'Rechne 10^(pH − pKₛ), mit pKₛ des gewählten Systems.' };
    }
    // Volumina (Base-Lösung, Säure-Lösung)
    const vol = (txt, ref, other, nameRef, nameOther) => {
      const t = String(txt == null ? '' : txt).trim();
      if (!t) return { ok: false, empty: true, fb: 'Noch keine Eingabe.' };
      const v = num(t);
      if (!Number.isFinite(v)) return { ok: false, kind: 'format', fb: 'Bitte eine Zahl eingeben (Dezimalkomma erlaubt).' };
      if (within(v, ref, 0, 0.3)) return { ok: true };
      if (within(v, other, 0, 0.3)) return { ok: false, kind: 'swap', fb: `Das wäre das Volumen der ${nameOther}-Lösung – Säure und Base vertauscht? Bei n(A⁻)/n(HA) = ${fmt(plan.ratio, 2)} wird von der ${plan.ratio > 1 ? 'Base' : 'Säure'}-Lösung mehr gebraucht.` };
      if (v < 0 || v > plan.Vtot + 1e-9) return { ok: false, kind: 'range', fb: `Das Volumen muss zwischen 0 und ${fmt(plan.Vtot, 1)} mL liegen.` };
      return { ok: false, kind: 'calc', fb: `Aus V(Base) + V(Säure) = ${fmt(plan.Vtot, 1)} mL und V(Base)/V(Säure) = n(A⁻)/n(HA) folgt das Volumen (bei gleicher Konzentration c).` };
    };
    res.vb = vol(e.vb, plan.VBase, plan.VAcid, 'Base', 'Säure');
    res.va = vol(e.va, plan.VAcid, plan.VBase, 'Säure', 'Base');
    // Summe
    const vb = num(e.vb), va = num(e.va);
    if (res.vb.ok !== undefined && Number.isFinite(vb) && Number.isFinite(va) && Math.abs(vb + va - plan.Vtot) > 0.6) {
      res.sum = { ok: false, kind: 'sum', fb: `V(Base) + V(Säure) = ${fmt(vb + va, 1)} mL – gefordert sind ${fmt(plan.Vtot, 1)} mL Gesamtvolumen.` };
    } else res.sum = { ok: true };
    res.ok = !!(res.r.ok && res.vb.ok && res.va.ok && res.sum.ok);
    res.empty = !!(res.r.empty || res.vb.empty || res.va.empty);
    return res;
  }

  /**
   * Auswertung einer Messung gegen den Ziel-pH. Nennt die konkrete Ursache einer Abweichung
   * (Volumina, Verhältnis, Rechenfehler) – der Messwert selbst wird nie angepasst.
   */
  function analyzeOutcome(e) {
    const S = C.SYSTEMS[e.system];
    const plan = C.planMix(e.system, e.target);
    const dev = e.pH - e.target;
    const band = Math.abs(dev) <= 0.05 ? 'good' : Math.abs(dev) <= 0.2 ? 'near' : 'off';
    const causes = [];
    if (e.ratio == null) {
      causes.push('Im Becherglas fehlt ein Partner des Paars (n(HA) = 0 oder n(A⁻) = 0): Das ist kein Puffer, die Henderson-Hasselbalch-Gleichung ist nicht anwendbar.');
    } else {
      const dA = e.vAcid - plan.VAcid, dB = e.vBase - plan.VBase;
      if (Math.abs(dA) > 0.3 || Math.abs(dB) > 0.3) {
        causes.push(`Zugegeben wurden V(Base) = ${fmt(e.vBase, 1)} mL und V(Säure) = ${fmt(e.vAcid, 1)} mL statt ${fmt(plan.VBase, 1)} mL und ${fmt(plan.VAcid, 1)} mL. Das ergibt n(A⁻)/n(HA) = ${fmt(e.ratio, 2)} statt ${fmt(plan.ratio, 2)} und nach der Gleichung pH ≈ ${fmt(e.hh, 2)}.`);
      }
      if (Math.abs(e.V - plan.Vtot) > 0.5) causes.push(`Das Gesamtvolumen beträgt ${fmt(e.V, 1)} mL statt ${fmt(plan.Vtot, 1)} mL. Für das Verhältnis zählt nur das Verhältnis der Stoffmengen; Konzentration und Kapazität ändern sich.`);
      if (e.calc && e.calc.res && !e.calc.res.ok) {
        const bad = ['r', 'vb', 'va', 'sum'].filter((k) => e.calc.res[k] && !e.calc.res[k].ok && !e.calc.res[k].empty);
        if (bad.length) causes.push('Schon deine Rechnung war nicht vollständig richtig: ' + bad.map((k) => e.calc.res[k].fb).join(' '));
      }
      if (!causes.length && band !== 'good') causes.push(`Volumina und Verhältnis stimmen mit der Rechnung überein. Die Abweichung von ${fmt(Math.abs(dev), 2)} stammt aus der Näherung der Gleichung (Gleichgewichtsmodell mit Wasser-Autoprotolyse).`);
    }
    const summary = band === 'good'
      ? `Der Messwert pH ${fmt(e.pH, 2)} liegt innerhalb von 0,05 um den Ziel-pH ${fmt(e.target, 2)}.`
      : band === 'near'
        ? `Der Messwert pH ${fmt(e.pH, 2)} weicht um ${fmt(Math.abs(dev), 2)} vom Ziel-pH ${fmt(e.target, 2)} ab.`
        : `Der Messwert pH ${fmt(e.pH, 2)} weicht deutlich (${fmt(Math.abs(dev), 2)}) vom Ziel-pH ${fmt(e.target, 2)} ab.`;
    return { plan, dev, band, causes, summary, system: S.name };
  }

  // ------------------------------------------------------------ Anwendungen
  const APPLICATIONS = [
    {
      id: 'blut', title: 'Blut', pair: 'CO₂* / HCO₃⁻ (CO₂* = CO₂(aq) + H₂CO₃), daneben Proteine und Hämoglobin', purpose: 'hält den Blut-pH in einem engen Bereich um 7,4',
      ph: 'arterieller pH etwa 7,4 (Normbereich etwa 7,37–7,43); effektiver pK′ ≈ 6,1 bei 37 °C', limit: 'Offenes System: Atmung und Niere regeln die Partner nach. Eine einfache Puffergleichung beschreibt weder die Regulation noch einen Gesundheitszustand – keine Diagnostik.',
      q: { id: 'a1', type: 'single', text: 'Warum fängt das Hydrogencarbonat-System trotz 20 : 1 Säure aus dem Stoffwechsel wirksam ab?', options: [
        { v: 'a', t: 'Entstehendes CO₂ wird über die Lunge abgeatmet; so bleibt das Verhältnis näherungsweise erhalten.', ok: true },
        { v: 'b', t: 'Hämoglobin speichert alle zugegebene Säure.', ok: false, fb: 'Hämoglobin puffert mit, speichert aber nicht „alle Säure“ – Protonen werden gebunden, Puffer sind begrenzt.' },
        { v: 'c', t: 'Bei 37 °C ist der pK′ gleich 7,4.', ok: false, fb: 'Der effektive pK′ liegt bei etwa 6,1.' },
        { v: 'd', t: 'Die Faustregel gilt für Blut exakt.', ok: false, fb: 'Das Verhältnis liegt außerhalb der Faustregel; erst das offene System erklärt die Wirkung.' }] }
    },
    {
      id: 'see', title: 'Gewässer', pair: 'HCO₃⁻ / CO₃²⁻ und CO₂ (Kohlensäure-System)', purpose: 'Säureneutralisationsvermögen (Alkalinität) schützt vor Versauerung',
      ph: 'pH vieler Gewässer etwa 6,5–8,5; entscheidend für die Empfindlichkeit ist die Alkalinität, nicht der pH-Wert allein', limit: 'Reale Gewässer: Austausch mit Luft-CO₂, Gestein, Organismen und weitere Stoffe. Kein einfacher geschlossener Puffer.',
      q: { id: 'a2', type: 'single', text: 'Zwei Seen haben pH 7,5. See A: Alkalinität 2,0 mmol/L, See B: 0,1 mmol/L. Welcher reagiert empfindlicher auf sauren Regen?', options: [
        { v: 'a', t: 'See A, weil er mehr Hydrogencarbonat enthält.', ok: false, fb: 'Mehr Hydrogencarbonat bedeutet mehr Reserve gegen Säure.' },
        { v: 'b', t: 'See B, weil seine Säureneutralisationsreserve viel kleiner ist.', ok: true },
        { v: 'c', t: 'Beide gleich, weil der pH-Wert gleich ist.', ok: false, fb: 'Gleicher pH bedeutet nicht gleiche Reserve – wie bei den Acetatpuffern mit 0,10 und 0,010 mol/L.' }] }
    },
    {
      id: 'bio', title: 'Biochemische Laborarbeit', pair: 'z. B. H₂PO₄⁻ / HPO₄²⁻ (pKₛ₂ = 7,20) oder andere Puffer je nach Ziel-pH', purpose: 'Enzyme brauchen einen passenden pH-Wert; der Puffer hält ihn während der Reaktion',
      ph: 'Ziel-pH im Bereich pKₛ ± 1 des gewählten Paars', limit: 'Enzyme haben unterschiedliche Optima; Phosphat ist nicht überall geeignet (z. B. Fällung mit Ca²⁺, Einfluss auf manche Enzyme).',
      q: { id: 'a3', type: 'single', text: 'Ein Enzymversuch soll bei pH 7,0 laufen. Welches Paar wählst du?', options: [
        { v: 'a', t: 'Acetat (pKₛ 4,75)', ok: false, fb: '7,0 liegt weit außerhalb von 4,75 ± 1.' },
        { v: 'b', t: 'Phosphat H₂PO₄⁻/HPO₄²⁻ (pKₛ 7,20)', ok: true },
        { v: 'c', t: 'Ammonium (pKₛ 9,25)', ok: false, fb: '7,0 liegt außerhalb von 9,25 ± 1.' }] }
    },
    {
      id: 'mess', title: 'Messtechnik', pair: 'zertifizierte Standardpufferlösungen (z. B. Phosphat-, Phthalat-, Boratpuffer)', purpose: 'Kalibrieren von pH-Messgeräten mit stabilen Referenzwerten',
      ph: 'Referenz-pH mit Temperaturangabe, z. B. pH 4, 7, 10 bei 25 °C', limit: 'Referenzwerte werden gemessen und zertifiziert. Beispiel: Ein NBS/NIST-Phosphatstandard mit je 0,025 mol/kg H₂PO₄⁻ und HPO₄²⁻ hat pH 6,86 bei 25 °C – nicht 7,20 wie die ideale H-H-Rechnung. Aktivitäten und Temperatur zählen; die Rechnung ersetzt keine Zertifizierung.',
      q: { id: 'a4', type: 'single', text: 'Warum kalibriert man nicht mit selbst gemischtem Puffer und dem H-H-Rechenwert?', options: [
        { v: 'a', t: 'Weil der echte pH-Wert durch Aktivitäten, Temperatur und Herstellungsfehler vom idealen Rechenwert abweicht; zertifizierte Puffer haben einen gemessenen Referenzwert.', ok: true },
        { v: 'b', t: 'Weil selbst gemischte Puffer nie puffern.', ok: false, fb: 'Sie puffern – aber ihr genauer pH-Wert ist nicht zertifiziert.' },
        { v: 'c', t: 'Weil pH-Meter nur mit pH 7 funktionieren.', ok: false, fb: 'Man kalibriert meist mit zwei oder drei Puffern, z. B. pH 4, 7 und 10.' }] }
    }
  ];

  // ------------------------------------------------------------ Hefteintrag
  const NOTEBOOK = {
    title: 'Puffer',
    items: [
      'Ein <b>Puffer</b> enthält eine schwache Säure HA und ihre korrespondierende Base A⁻ in vergleichbaren Mengen.',
      'Zugegebene H₃O⁺-Ionen reagieren mit A⁻, zugegebene OH⁻-Ionen mit HA. Aus einer starken Säure/Base wird ein schwächerer Partner:',
      { eq: 'A⁻ + H₃O⁺ → HA + H₂O        HA + OH⁻ → A⁻ + H₂O' },
      'Der pH-Wert ändert sich dabei wenig – aber nie gar nicht.',
      { eq: '<b>Henderson-Hasselbalch:</b> pH = pKₛ + lg [c(A⁻) / c(HA)]' },
      '<b>Pufferbereich</b> (Faustregel): pH ≈ pKₛ ± 1, also c(A⁻) : c(HA) zwischen 1 : 10 und 10 : 1. Bei 1 : 1 gilt pH = pKₛ.',
      '<b>Puffer herstellen:</b> Paar mit pKₛ nahe am Ziel-pH wählen, n(A⁻)/n(HA) = 10^(pH − pKₛ) berechnen, mit n = c · V die Volumina bestimmen, mischen, messen.',
      '<b>Pufferkapazität:</b> Stoffmenge an Säure oder Base, die ein Puffer umsetzen kann. Sie wächst mit den Stoffmengen der Partner – gleicher pH bedeutet nicht gleiche Kapazität.',
      'Beispiele: Blut (CO₂*/HCO₃⁻), Phosphatpuffer im Labor, Kalibrierpuffer.'
    ]
  };

  return { num, within, shuffled, orderFor, MIX_TARGETS, targetMessage, gradeMixCalc, analyzeOutcome, PROTOCOLS, gradeQuestion, THEORY, gradeField, TASKS, UNITS, gradeTaskField, APPLICATIONS, NOTEBOOK };
});
