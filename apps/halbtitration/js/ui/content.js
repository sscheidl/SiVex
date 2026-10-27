/*
 * Texte und Aufgaben des Halbtitrationslabors
 * ------------------------------------------
 * Theorie, Verständnisfragen, Planungsoptionen, gestufte Hilfen
 * (Denkimpuls → Ansatz → Musterrechnung) und Hefteintrag.
 * Keine Fachlogik, keine gesuchten Zahlenwerte.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});
  const fmt = NS.Format.fmt;
  const Chem = NS.Chemistry;

  // ------------------------------------------------------------ Theorie

  const THEORY = [
    {
      title: 'Begriffe',
      html:
        '<dl class="terms">' +
        '<dt>Äquivalenzpunkt (ÄP)</dt><dd>Die betrachtete Protolysestufe ist stöchiometrisch vollständig umgesetzt: n(zugegebene OH⁻ bzw. H₃O⁺) = n(abgebbare bzw. aufnehmbare Protonen dieser Stufe).</dd>' +
        '<dt>Endpunkt</dt><dd>Experimentell beobachtetes Abbruchkriterium, z. B. die erste bleibende Indikatorfarbe. Endpunkt und Äquivalenzpunkt stimmen nicht automatisch überein (Indikatorfehler).</dd>' +
        '<dt>Halbäquivalenzpunkt (HÄP)</dt><dd>Die betrachtete Stufe ist zur Hälfte umgesetzt. Hier wird der pK-Wert bestimmt.</dd>' +
        '<dt>Neutralpunkt</dt><dd>pH = pOH, bei 25 °C pH = 7,00. Kein Synonym für den Äquivalenzpunkt.</dd>' +
        '</dl>',
    },
    {
      title: 'Schwache Säure: vom MWG zur Halbtitration',
      html:
        '<p class="eq">HA + H₂O ⇌ H₃O⁺ + A⁻</p>' +
        '<p class="eq">K<sub>S</sub> = c(H₃O⁺) · c(A⁻) / c(HA)</p>' +
        '<p>Logarithmieren und Umstellen liefert die Konzentrationsform der Henderson-Hasselbalch-Gleichung:</p>' +
        '<p class="eq">pH = pK<sub>S</sub> + lg [ c(A⁻) / c(HA) ]</p>' +
        '<p>Gibt man Natronlauge zu, wird HA zu A⁻ umgesetzt. Bei halbem Umsatz liegen HA und A⁻ <em>stöchiometrisch</em> in gleicher Menge vor. Sind auch die <em>Gleichgewichtskonzentrationen</em> gleich, wird der Logarithmus null:</p>' +
        '<p class="eq">c(A⁻) = c(HA) &nbsp;⇒&nbsp; pH = pK<sub>S</sub></p>' +
        '<p class="note">Das gilt am stöchiometrischen HÄP nur <strong>näherungsweise</strong>: Die Säure protolysiert auch selbst (Anfangsdissoziation), Wasser protolysiert, und bei mehrprotonigen Säuren beeinflussen sich benachbarte Stufen. Je stärker die Säure und je verdünnter die Lösung, desto größer die Abweichung.</p>',
    },
    {
      title: 'Schwache Base: pK_B ist nicht der abgelesene pH-Wert',
      html:
        '<p class="eq">NH₃ + H₂O ⇌ NH₄⁺ + OH⁻ &nbsp;&nbsp; K<sub>B</sub> = c(NH₄⁺) · c(OH⁻) / c(NH₃)</p>' +
        '<p class="eq">pOH = pK<sub>B</sub> + lg [ c(NH₄⁺) / c(NH₃) ]</p>' +
        '<p>Bei der Titration mit Salzsäure fällt der pH-Wert. Am HÄP gilt c(NH₄⁺) ≈ c(NH₃) und damit <strong>pOH ≈ pK<sub>B</sub></strong>. Das pH-Meter zeigt aber den pH-Wert:</p>' +
        '<p class="eq">pK<sub>B</sub>(NH₃) ≈ pK<sub>W</sub> − pH(HÄP) &nbsp;&nbsp; mit pK<sub>W</sub> = 14,00 (25 °C, Modellannahme)</p>' +
        '<p>Gleichzeitig gilt am HÄP pH ≈ pK<sub>S</sub>(NH₄⁺). pK<sub>S</sub>(NH₄⁺) und pK<sub>B</sub>(NH₃) sind verschiedene Größen; es gilt pK<sub>S</sub> + pK<sub>B</sub> = pK<sub>W</sub>.</p>',
    },
    {
      title: 'Mehrprotonige Systeme',
      html:
        '<p>Phosphorsäure gibt ihre Protonen schrittweise ab:</p>' +
        '<p class="eq">H₃PO₄ ⇌ H₂PO₄⁻ ⇌ HPO₄²⁻ ⇌ PO₄³⁻ &nbsp;(jeweils + H₃O⁺)</p>' +
        '<p>Titriert man die vollständig protonierte Form mit NaOH, gehört zu jeder Stufe ein eigener Äquivalenz- und Halbäquivalenzpunkt:</p>' +
        '<p class="eq">V(HÄP,1) = V(ÄP,1) / 2 &nbsp;&nbsp;&nbsp; V(HÄP,2) = [ V(ÄP,1) + V(ÄP,2) ] / 2</p>' +
        '<p class="note">V(ÄP,2)/2 ist <strong>nicht</strong> der zweite Halbäquivalenzpunkt – dieses Volumen entspricht V(ÄP,1). Nicht jeder Äquivalenzpunkt ist als scharfer Sprung messbar; die dritte Stufe der Phosphorsäure zeigt in wässriger Lösung keinen ausgeprägten Sprung.</p>' +
        '<p><strong>Glycin</strong> wird als Glycinhydrochlorid (H₃N⁺–CH₂–COOH Cl⁻) vorgelegt. Chlorid ist nur Gegenion. Mit NaOH entstehen nacheinander:</p>' +
        '<p class="eq">H₃N⁺–CH₂–COOH → H₃N⁺–CH₂–COO⁻ → H₂N–CH₂–COO⁻</p>' +
        '<p>Das Zwitterion trägt zwei innere Ladungen und ist insgesamt ungeladen; am 1. ÄP liegt es überwiegend vor (isoelektrischer Punkt). <strong>Beide Glycinwerte sind pK<sub>S</sub>-Werte</strong>: pK<sub>S1</sub> gehört zur Carboxygruppe, pK<sub>S2</sub> zur Protonenabgabe der Ammoniumgruppe.</p>',
    },
    {
      title: 'Indikator und pH-Elektrode',
      html:
        '<p>Ein Indikator schlägt in einem Bereich von etwa zwei pH-Einheiten um. Für einen kleinen Indikatorfehler muss dieser Bereich im <strong>steilen Abschnitt am gewählten Äquivalenzpunkt</strong> liegen, nicht im flachen Abschnitt am Halbäquivalenzpunkt. Bei mehrprotonigen Systemen legt man fest, welcher ÄP mit dem Indikator erfasst wird.</p>' +
        '<p>Den pK-Wert liefert der Indikator nicht: Dazu wird der pH-Wert am HÄP mit der kalibrierten pH-Elektrode gemessen. Man kann auch ganz ohne Indikator pH-metrisch arbeiten.</p>',
    },
  ];

  // ------------------------------------------------------------ Verständnisfragen

  const QUESTIONS = [
    {
      id: 'q1', type: 'single',
      text: 'Eine schwache Base B wird mit Salzsäure titriert. Am Halbäquivalenzpunkt misst du pH = 8,3. Was folgt daraus? (Beispielwerte, nicht aus den Versuchen)',
      options: [
        { id: 'a', text: 'pK_B(B) ≈ 8,3, weil am HÄP pH = pK gilt.' },
        { id: 'b', text: 'pK_B(B) ≈ 14,00 − 8,3 = 5,7, denn am HÄP gilt pOH ≈ pK_B.', correct: true },
        { id: 'c', text: 'pK_S(HB⁺) ≈ 5,7.' },
        { id: 'd', text: 'Aus einer Basentitration lässt sich kein pK-Wert bestimmen.' },
      ],
      hints: ['Welche Ionen bestimmen das Gleichgewicht einer Base, H₃O⁺ oder OH⁻?', 'Stelle die Henderson-Hasselbalch-Gleichung für die Base mit pOH auf.', 'pOH = pK_B + lg[c(HB⁺)/c(B)] → am HÄP pOH ≈ pK_B = 14,00 − 8,3 = 5,7; zugleich pK_S(HB⁺) ≈ 8,3.'],
    },
    {
      id: 'q2', type: 'single',
      text: 'Eine zweiprotonige Säure: V(ÄP,1) = 8,0 mL und V(ÄP,2) = 16,0 mL (Beispielwerte). Bei welchem Volumen liegt der zweite Halbäquivalenzpunkt?',
      options: [
        { id: 'a', text: '8,0 mL = V(ÄP,2) / 2' },
        { id: 'b', text: '12,0 mL = [V(ÄP,1) + V(ÄP,2)] / 2', correct: true },
        { id: 'c', text: '4,0 mL = V(ÄP,1) / 2' },
        { id: 'd', text: '16,0 mL' },
      ],
      hints: ['Wo beginnt die zweite Protolysestufe?', 'Die zweite Stufe läuft von V(ÄP,1) bis V(ÄP,2). Ihre Mitte ist gesucht.', '[8,0 mL + 16,0 mL] / 2 = 12,0 mL. V(ÄP,2)/2 = 8,0 mL wäre genau der erste ÄP.'],
    },
    {
      id: 'q3', type: 'multi',
      text: 'Warum stimmt pH(HÄP) nicht immer genau mit pK_S überein? Kreuze alles Zutreffende an.',
      options: [
        { id: 'a', text: 'Die Säure protolysiert auch selbst; dadurch sind c(HA) und c(A⁻) im Gleichgewicht nicht exakt gleich.', correct: true },
        { id: 'b', text: 'Bei mehrprotonigen Säuren beeinflussen sich benachbarte Stufen.', correct: true },
        { id: 'c', text: 'Literaturwerte gelten für Aktivitäten (I = 0), gerechnet wird mit Konzentrationen.', correct: true },
        { id: 'd', text: 'Der Indikator verschiebt den pH-Wert am HÄP stark.' },
        { id: 'e', text: 'Am HÄP ist die Lösung immer neutral.' },
      ],
      hints: ['Was ist der Unterschied zwischen „stöchiometrisch halb umgesetzt“ und „Gleichgewichtskonzentrationen gleich“?', 'Denke an Anfangsdissoziation, Nachbarstufen und an die Bedingungen der Tabellenwerte.', 'a, b und c treffen zu. Indikatoren werden in so kleiner Menge zugesetzt, dass sie den pH-Wert nicht merklich ändern; neutral ist die Lösung am HÄP nur zufällig.'],
    },
    {
      id: 'q4', type: 'single',
      text: 'Welche Aussage über die beiden Werte von Glycin (aus Glycinhydrochlorid) ist richtig?',
      options: [
        { id: 'a', text: 'Der erste Wert ist ein pK_S-, der zweite ein pK_B-Wert.' },
        { id: 'b', text: 'Beide Werte sind pK_S-Werte; der zweite beschreibt die Protonenabgabe der –NH₃⁺-Gruppe.', correct: true },
        { id: 'c', text: 'Beide Werte sind pK_B-Werte, weil Glycin eine Aminogruppe hat.' },
      ],
      hints: ['Was passiert beim Titrieren mit NaOH in der zweiten Stufe – wird ein Proton abgegeben oder aufgenommen?', 'H₃N⁺–CH₂–COO⁻ gibt ein Proton an OH⁻ ab.', 'Beide Stufen sind Protonenabgaben: pK_S1 (–COOH) und pK_S2 (–NH₃⁺).'],
    },
    {
      id: 'q5', type: 'single',
      text: 'In welchem Kurvenabschnitt sollte der Umschlagsbereich eines Indikators liegen?',
      options: [
        { id: 'a', text: 'Im flachen Abschnitt um den Halbäquivalenzpunkt, damit man dort den pK-Wert sieht.' },
        { id: 'b', text: 'Im steilen Abschnitt am gewählten Äquivalenzpunkt.', correct: true },
        { id: 'c', text: 'Immer bei pH 7, weil dort neutralisiert ist.' },
      ],
      hints: ['Wann führt eine kleine Volumenänderung zu einer großen pH-Änderung?', 'Ein Farbumschlag über einen pH-Bereich von etwa 2 Einheiten soll in einem möglichst kleinen Volumenintervall passieren.', 'Im steilen Sprung am ÄP; pH 7 ist der Neutralpunkt und nur bei starken Säuren und Basen auch der ÄP.'],
    },
  ];

  // ------------------------------------------------------------ Planung

  const EQ_CATEGORIES = [
    { id: 'acidic', label: 'sauer (pH < 6,5)' },
    { id: 'neutral', label: 'etwa neutral (6,5–7,5)' },
    { id: 'basic', label: 'basisch (pH > 7,5)' },
  ];

  const EQ_PARTICLES = [
    { id: 'conjBase', label: 'Am ÄP liegt die korrespondierende Base (z. B. ein Anion) vor.' },
    { id: 'conjAcid', label: 'Am ÄP liegt die korrespondierende Säure (z. B. NH₄⁺) vor.' },
    { id: 'ampholyte', label: 'Am ÄP liegt überwiegend ein Ampholyt vor (kann Protonen aufnehmen und abgeben).' },
    { id: 'salt', label: 'Am ÄP liegen nur Na⁺ und Cl⁻ vor – die Lösung ist neutral.' },
  ];

  /** Teilchen am ÄP der Stufe (erwartete Antwort) */
  const PARTICLE_AT_EQ = {
    acetic: ['conjBase'],
    ammonia: ['conjAcid'],
    phosphoric: ['ampholyte', 'ampholyte'],
    glycine: ['ampholyte', 'conjBase'],
  };

  const INDICATOR_REASONS = [
    { id: 'jump', label: 'Der Umschlagsbereich liegt im erwarteten steilen Abschnitt am gewählten Äquivalenzpunkt.', good: true },
    { id: 'phmetric', label: 'Ich werte pH-metrisch aus; der Indikator ist nur eine zusätzliche Kontrolle oder entfällt.', good: true },
    { id: 'half', label: 'Der Umschlag soll am Halbäquivalenzpunkt liegen, damit man dort den pK-Wert erkennt.', good: false },
    { id: 'seven', label: 'Ein Indikator mit Umschlag um pH 7 passt immer, weil am ÄP neutralisiert ist.', good: false },
  ];

  // ------------------------------------------------------------ Hilfen

  /**
   * Gestufte Hilfen je Rechenfeld. Stufe 3 ist eine Musterrechnung mit den
   * eigenen Daten (ctx) und wird erst nach eigener Bearbeitung angeboten.
   */
  function hints(exp, field, ctx) {
    const n = exp.cSample * exp.vSample;
    const stage = Number(String(field).slice(-1)) || 1;
    const c = function (x, d) { return fmt(x, d === undefined ? 2 : d); };
    if (/^veq/.test(field)) {
      return [
        'Wie viele Protonen muss die Maßlösung bis zum ' + stage + '. Äquivalenzpunkt je Teilchen der Probe umsetzen?',
        'n(Probe) = c(Probe) · V(Probe). Am ' + stage + '. ÄP gilt n(Maßlösung) = ' + (stage > 1 ? stage + ' · ' : '') + 'n(Probe); V = n / c(Maßlösung). Das Wasser ändert die Stoffmenge nicht.',
        'n = ' + c(exp.cSample, 3) + ' mol/L · ' + c(exp.vSample) + ' mL = ' + c(n, 2) + ' mmol; V(ÄP,' + stage + ') = ' + (stage > 1 ? stage + ' · ' : '') + c(n, 2) + ' mmol / ' + c(exp.cTitrant, 3) + ' mol/L = ' + c((stage * n) / exp.cTitrant) + ' mL.',
      ];
    }
    if (/^vhalf/.test(field)) {
      const b = ctx && ctx.basis;
      return [
        stage === 1 ? 'Bei welchem Umsatz sind Säure und korrespondierende Base gleich häufig?' : 'Wo beginnt und wo endet die zweite Stufe auf der Volumenachse?',
        stage === 1 ? 'V(HÄP,1) = V(ÄP,1) / 2.' : 'V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)] / 2 – nicht V(ÄP,2)/2.',
        b && Number.isFinite(b.v1)
          ? (stage === 1 ? 'V(HÄP,1) = ' + c(b.v1) + ' mL / 2 = ' + c(b.v1 / 2) + ' mL.' : (Number.isFinite(b.v2) ? 'V(HÄP,2) = (' + c(b.v1) + ' mL + ' + c(b.v2) + ' mL) / 2 = ' + c((b.v1 + b.v2) / 2) + ' mL.' : 'Für die Musterrechnung fehlt noch V(ÄP,2) in der gewählten Basis.'))
          : 'Für die Musterrechnung zuerst eine Rechenbasis wählen.',
      ];
    }
    if (/^phhalf/.test(field)) {
      return [
        'Welcher deiner protokollierten Messpunkte der Halbtitration liegt am Zielvolumen?',
        'Nimm den stabil übernommenen pH-Wert am Zielvolumen aus der Messtabelle der Halbtitration.',
        ctx && ctx.point ? 'Protokolliert: V = ' + c(ctx.point.v) + ' mL, pH = ' + c(ctx.point.pH) + (ctx.point.stable ? ' (stabil).' : ' (nicht stabil).') : 'Es gibt noch keinen protokollierten Messpunkt der Halbtitration.',
      ];
    }
    if (/^pk/.test(field)) {
      const task = ctx && ctx.task;
      const pH = ctx && ctx.pH;
      if (task && task.from === 'pOH') {
        return [
          'Am HÄP sind NH₃ und NH₄⁺ etwa gleich konzentriert. Welche Größe ist dann gleich pK_B – pH oder pOH?',
          'pOH = pK_W − pH mit pK_W = 14,00; am HÄP pOH ≈ pK_B.',
          Number.isFinite(pH) ? 'pK_B ≈ pOH = 14,00 − ' + c(pH) + ' = ' + c(14 - pH) + '.' : 'Zuerst den gemessenen pH-Wert eintragen.',
        ];
      }
      return [
        'Was bedeutet c(A⁻) = c(HA) in der Henderson-Hasselbalch-Gleichung?',
        'lg 1 = 0 → pH ≈ pK_S am HÄP dieser Stufe.',
        Number.isFinite(pH) ? (task ? task.label : 'pK_S') + ' ≈ pH(HÄP) = ' + c(pH) + '.' : 'Zuerst den gemessenen pH-Wert eintragen.',
      ];
    }
    if (/^th_/.test(field)) {
      const p = ctx && ctx.point;
      if (!p) return ['', '', ''];
      const lit = Chem.LITERATURE[exp.id];
      let sample = p.approach;
      if (p.key === 'start') {
        if (exp.id === 'ammonia') sample = 'pOH = ½(' + c(lit.pKb) + ' − lg ' + c(p.cGiven, 4) + ') = ' + c(Chem.PKW - p.main) + '; pH = 14,00 − pOH = ' + c(p.main) + '.';
        else if (p.alpha >= 0.05) sample = 'Kₛ = 10^(−' + c(lit.pKs[0]) + ') = ' + Number(Math.pow(10, -lit.pKs[0]).toPrecision(3)).toString().replace('.', ',') + ' mol/L; x² + Kₛ·x − Kₛ·c₀ = 0 → x = c(H₃O⁺) = ' + Number(Math.pow(10, -p.main).toPrecision(3)).toString().replace('.', ',') + ' mol/L → pH = ' + c(p.main) + '.';
        else sample = 'pH = ½(' + c(lit.pKs[0]) + ' − lg ' + c(p.cGiven, 4) + ') = ' + c(p.main) + '.';
      } else if (/^half/.test(p.key)) {
        sample = 'pH = ' + (exp.id === 'ammonia' ? '14,00 − pK_B = 14,00 − ' + c(lit.pKb) + ' = ' : 'pKₛ = ') + c(p.main) + '.';
      } else {
        sample = p.approach + ' → pH = ' + c(p.main) + '.';
      }
      return [
        p.key === 'start' ? 'Welche Teilchen bestimmen den pH-Wert vor der ersten Zugabe? Wie stark ist die Probe nach dem Verdünnen?' : /^half/.test(p.key) ? 'Welche Gleichung beschreibt ein Gemisch aus Säure und korrespondierender Base?' : 'Welches Teilchen liegt am Äquivalenzpunkt vor – Säure, Base oder Ampholyt?',
        p.approach + (p.given ? ' · ' + p.given : ''),
        sample,
      ];
    }
    if (/^dpk_|^dph_/.test(field)) {
      return [
        'Abweichung = Messwert − Referenzwert. Achte auf das Vorzeichen.',
        /^dpk/.test(field) ? 'ΔpK = pK(experimentell) − pK(Literatur). Keine Prozentangabe: pK-Werte sind logarithmisch.' : 'ΔpH = pH(gemessen) − pH(berechnet).',
        ctx && Number.isFinite(ctx.a) && Number.isFinite(ctx.b) ? c(ctx.a) + ' − ' + c(ctx.b) + ' = ' + NS.Format.signed(ctx.a - ctx.b, 2) + '.' : 'Es fehlen noch Werte.',
      ];
    }
    if (/^read_|^cons_/.test(field)) {
      return [
        'Die Skala der Bürette zählt von oben nach unten. Abgelesen wird die Unterkante des Meniskus.',
        /^cons/.test(field) ? 'Verbrauch = Endstand − Anfangsstand.' : 'Nutze die Ablesehilfe neben der Bürette: Zehntel-Striche, Hundertstel schätzen.',
        ctx && Number.isFinite(ctx.value) ? 'Richtig wäre: ' + c(ctx.value) + ' mL.' : 'Noch kein Wert vorhanden.',
      ];
    }
    return ['', '', ''];
  }

  // ------------------------------------------------------------ Hefteintrag

  const NOTEBOOK =
    '<h3>pK-Werte durch Halbtitration</h3>' +
    '<p><strong>Halbäquivalenzpunkt (HÄP):</strong> Die betrachtete Protolysestufe ist zur Hälfte umgesetzt; dann gilt c(HA) ≈ c(A⁻).</p>' +
    '<p class="eq">pH = pK<sub>S</sub> + lg [ c(A⁻) / c(HA) ] &nbsp;⇒&nbsp; am HÄP: pH ≈ pK<sub>S</sub></p>' +
    '<p><strong>Schwache Base</strong> (z. B. NH₃): am HÄP pOH ≈ pK<sub>B</sub>, also pK<sub>B</sub> ≈ 14,00 − pH (25 °C); zugleich pH ≈ pK<sub>S</sub>(NH₄⁺).</p>' +
    '<p><strong>Mehrprotonige Säuren:</strong> V(HÄP,1) = V(ÄP,1)/2; V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)]/2. Am 1. ÄP (Ampholyt): pH ≈ ½(pK<sub>S1</sub> + pK<sub>S2</sub>).</p>' +
    '<p><strong>Äquivalenzpunkt</strong> ≠ <strong>Endpunkt</strong> (Indikatorumschlag) ≠ <strong>Neutralpunkt</strong> (pH 7). Der Umschlagsbereich des Indikators muss im steilen Sprung am gewählten ÄP liegen; den pK-Wert liefert die pH-Elektrode.</p>' +
    '<p><strong>Merke:</strong> pH = pK<sub>S</sub> am HÄP ist eine Näherung – Abweichungen entstehen durch Protolyse der Säure selbst, Nachbarstufen und Aktivitäten. Abweichungen von pK- und pH-Werten gibt man als Differenz mit Vorzeichen an, nicht in Prozent.</p>';

  const api = {
    THEORY: THEORY,
    QUESTIONS: QUESTIONS,
    EQ_CATEGORIES: EQ_CATEGORIES,
    EQ_PARTICLES: EQ_PARTICLES,
    PARTICLE_AT_EQ: PARTICLE_AT_EQ,
    INDICATOR_REASONS: INDICATOR_REASONS,
    hints: hints,
    NOTEBOOK: NOTEBOOK,
  };
  NS.Content = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
