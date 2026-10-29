/*
 * Texte und Aufgaben des Halbtitrationslabors (ab 0.2.0)
 * -----------------------------------------------------
 * Lernweg: kurzer Auftrag → selbst titrieren → halben Umsatz untersuchen →
 * gezielt halbtitrieren → am eigenen Ergebnis mit dem MWG begründen →
 * vergleichen und sichern. Keine gesuchten Zahlenwerte in den Texten.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});
  const fmt = NS.Format.fmt;
  const Chem = NS.Chemistry;

  // ------------------------------------------------------------ Rollen und Aufträge

  const ROLES = {
    acetic: {
      role: 'Kern',
      chip: 'Essigsäure',
      task: 'Bestimme den pKₛ-Wert einer Essigsäurelösung mithilfe einer Titration und einer pH-Messung. Nimm zunächst eine Titrationskurve auf und bestimme das Äquivalenzvolumen.',
      goals: null,
    },
    ammonia: {
      role: 'Transfer',
      chip: 'Ammoniak',
      task: 'Was ändert sich, wenn die Probe eine schwache Base ist? Bestimme den pK_B-Wert von Ammoniak auf demselben Weg: Titrationskurve, Äquivalenzvolumen, gezielte Halbtitration.',
      goals: null,
    },
    phosphoric: {
      role: 'Vertiefung',
      chip: 'Phosphorsäure',
      task: 'Phosphorsäure gibt ihre Protonen in Stufen ab. Bestimme pKₛ₁ und pKₛ₂ durch Halbtitration und prüfe, wie gut die einfache Beziehung pH ≈ pKₛ an beiden Stufen gilt.',
      goals: ['zwei Protolysestufen und ihre ÄP/HÄP zuordnen', 'V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)]/2 verstehen', 'schwache oder fehlende Sprünge erkennen (3. Stufe)', 'Grenzen von pH ≈ pKₛ an der ersten Stufe untersuchen'],
    },
    glycine: {
      role: 'Vertiefung',
      chip: 'Glycin',
      task: 'Glycinhydrochlorid (H₃N⁺–CH₂–COOH Cl⁻) wird mit Natronlauge titriert: Kation → Zwitterion → Anion. Bestimme beide pKₛ-Werte des Glycins durch Halbtitration.',
      goals: ['zwei pKₛ-Werte (–COOH und –NH₃⁺) zuordnen', 'V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)]/2 nutzen', 'einen kaum sichtbaren zweiten ÄP aus dem ersten ableiten', 'Grenzen von pH ≈ pKₛ an der ersten Stufe untersuchen'],
    },
  };

  /** Säure-/Base-Paare je Stufe (Säure, korrespondierende Base) */
  const PAIRS = {
    acetic: [['CH₃COOH', 'CH₃COO⁻', 'Essigsäure', 'Acetat']],
    ammonia: [['NH₄⁺', 'NH₃', 'Ammonium', 'Ammoniak']],
    phosphoric: [['H₃PO₄', 'H₂PO₄⁻', 'Phosphorsäure', 'Dihydrogenphosphat'], ['H₂PO₄⁻', 'HPO₄²⁻', 'Dihydrogenphosphat', 'Hydrogenphosphat']],
    glycine: [['H₃N⁺–CH₂–COOH', 'H₃N⁺–CH₂–COO⁻', 'Glycin-Kation', 'Zwitterion'], ['H₃N⁺–CH₂–COO⁻', 'H₂N–CH₂–COO⁻', 'Zwitterion', 'Glycinat-Anion']],
  };

  // ------------------------------------------------------------ Fragen zum halben Umsatz

  function opt(id, text, correct) { return { id: id, text: text, correct: !!correct }; }

  /** Geschlossene Fragen; Reihenfolge = Aufgabenfolge im Schritt „Halber Umsatz“ */
  function halfQuestions(expId) {
    const P = PAIRS[expId];
    const acid = function (j) { return P[j][0]; };
    const base = function (j) { return P[j][1]; };
    if (expId === 'ammonia') {
      return [{
        id: 'hb1', text: 'Bei der Hälfte des Äquivalenzvolumens ist die Hälfte des Ammoniaks umgesetzt. Welche Teilchen liegen dann näherungsweise in gleicher Stoffmenge vor?',
        options: [opt('a', 'NH₃ und NH₄⁺', true), opt('b', 'NH₄⁺ und OH⁻'), opt('c', 'NH₃ und Cl⁻ aus der Salzsäure'), opt('d', 'nur NH₄⁺')],
        hints: ['Welches Teilchen entsteht, wenn NH₃ ein Proton von H₃O⁺ aufnimmt?', 'Die Hälfte des NH₃ ist zu seiner korrespondierenden Säure geworden, die andere Hälfte ist noch da.', 'n(NH₃) ≈ n(NH₄⁺): je die Hälfte der vorgelegten Stoffmenge.'],
      }];
    }
    const qs = [
      {
        id: 'h1', text: 'Betrachte die Hälfte deines Äquivalenzvolumens' + (P.length > 1 ? ' der ersten Stufe' : '') + '. Wie viel der ' + P[0][2] + ' ist bis dahin umgesetzt?',
        options: [opt('a', 'ein Viertel'), opt('b', 'die Hälfte', true), opt('c', 'alles'), opt('d', 'das hängt vom pH-Wert ab')],
        hints: ['Am Äquivalenzpunkt ist die Stufe vollständig umgesetzt. Wie viel Maßlösung hast du bei halbem Volumen zugegeben?', 'n(OH⁻) ist proportional zum zugegebenen Volumen: halbes Volumen, halbe Stoffmenge.', 'Die Hälfte: Bei V(ÄP)/2 hat die Hälfte der Säure ihr Proton abgegeben.'],
      },
      {
        id: 'h2', text: 'Welche Stoffmengen liegen dann näherungsweise vor?',
        options: [opt('a', 'n(' + acid(0) + ') ≈ n(' + base(0) + ') – je die Hälfte der Ausgangsstoffmenge', true), opt('b', 'nur ' + base(0)), opt('c', 'nur ' + acid(0) + ', die Natronlauge bleibt unverbraucht'), opt('d', 'n(' + base(0) + ') ≈ 2 · n(' + acid(0) + ')')],
        hints: ['Was wird aus dem umgesetzten Teil der Säure?', 'Jedes umgesetzte Teilchen ' + acid(0) + ' wird zu einem Teilchen ' + base(0) + '.', 'Die Hälfte ist noch ' + acid(0) + ', die andere Hälfte ist ' + base(0) + ' – also gleiche Stoffmengen.'],
      },
      {
        id: 'h3', text: 'Was folgt für das Konzentrationsverhältnis c(' + base(0) + ') / c(' + acid(0) + ') in der Lösung?',
        options: [opt('a', '≈ 1, weil beide im selben Volumen gelöst sind', true), opt('b', '≈ 0,5'), opt('c', '≈ 2'), opt('d', 'nicht abschätzbar, weil sich das Volumen verändert hat')],
        hints: ['c = n / V. Gilt für beide Teilchen dasselbe V?', 'Beide Teilchen sind in derselben Lösung: Das Volumen kürzt sich im Verhältnis heraus.', 'Gleiche Stoffmengen im selben Volumen → gleiche Konzentrationen → Verhältnis ≈ 1.'],
      },
    ];
    if (P.length > 1) {
      qs.push({
        id: 'h4', text: 'Und die zweite Stufe (' + acid(1) + ' → ' + base(1) + '): Bei welchem Volumen ist sie zur Hälfte umgesetzt?',
        options: [opt('a', 'V(ÄP,2) / 2'), opt('b', '[V(ÄP,1) + V(ÄP,2)] / 2', true), opt('c', 'V(ÄP,1) / 2'), opt('d', 'V(ÄP,2)')],
        hints: ['Wo beginnt die zweite Stufe auf der Volumenachse?', 'Die zweite Stufe läuft von V(ÄP,1) bis V(ÄP,2).', 'Ihre Mitte liegt bei [V(ÄP,1) + V(ÄP,2)]/2. V(ÄP,2)/2 wäre genau der erste ÄP.'],
      });
    }
    return qs;
  }

  // ------------------------------------------------------------ MWG-Trainer

  function trainer(expId) {
    if (expId === 'ammonia') {
      return [
        { id: 't1', text: 'K_B = c(NH₄⁺) · c(OH⁻) / c(NH₃). Am HÄP gilt c(NH₄⁺) ≈ c(NH₃). Was bleibt übrig?',
          options: [opt('a', 'K_B ≈ c(OH⁻)', true), opt('b', 'K_B ≈ c(H₃O⁺)'), opt('c', 'K_B ≈ 1'), opt('d', 'K_B ≈ c(NH₄⁺)')],
          hints: ['Welcher Bruch steckt in der Gleichung?', 'c(NH₄⁺)/c(NH₃) ≈ 1 – dieser Faktor fällt weg.', 'K_B ≈ c(OH⁻).'] },
        { id: 't2', text: 'Welche Beziehung folgt mit p = −lg?',
          options: [opt('a', 'pK_B ≈ pOH', true), opt('b', 'pK_B ≈ pH'), opt('c', 'pK_B ≈ 7'), opt('d', 'pK_B ≈ pH − 14,00')],
          hints: ['−lg c(OH⁻) hat einen eigenen Namen.', '−lg K_B = pK_B und −lg c(OH⁻) = pOH.', 'pK_B ≈ pOH.'] },
        { id: 't3', text: 'Das pH-Meter zeigt aber den pH-Wert. Wie erhältst du pK_B bei 25 °C?',
          options: [opt('a', 'pK_B ≈ 14,00 − pH', true), opt('b', 'pK_B ≈ pH'), opt('c', 'pK_B ≈ pH − 14,00'), opt('d', 'pK_B ≈ 14,00 + pH')],
          hints: ['Wie hängen pH und pOH bei 25 °C zusammen?', 'pH + pOH = pK_W = 14,00.', 'pK_B ≈ pOH = 14,00 − pH.'] },
        { id: 't4', text: 'Welcher Konstanten entspricht der gemessene pH-Wert am HÄP selbst näherungsweise?',
          options: [opt('a', 'pKₛ(NH₄⁺), der Säurekonstante der korrespondierenden Säure', true), opt('b', 'pK_B(NH₃)'), opt('c', 'pKₛ(NH₃)'), opt('d', 'keiner Konstanten')],
          hints: ['Betrachte das Gleichgewicht aus Sicht der Säure NH₄⁺.', 'NH₄⁺ + H₂O ⇌ NH₃ + H₃O⁺; am HÄP c(NH₃) ≈ c(NH₄⁺).', 'pH ≈ pKₛ(NH₄⁺); zugleich pKₛ(NH₄⁺) + pK_B(NH₃) = 14,00.'] },
      ];
    }
    const P = PAIRS[expId];
    const a = P[0][0];
    const b = P[0][1];
    const n = P.length > 1 ? '₁' : '';
    const steps = [
      { id: 't1', text: 'Am HÄP gilt c(' + b + ') ≈ c(' + a + '). Setze ein: Kₛ' + n + ' = c(H₃O⁺) · c(' + b + ') / c(' + a + '). Welchen Wert hat der Bruch?',
        options: [opt('a', '≈ 1', true), opt('b', '≈ 0'), opt('c', '≈ ½'), opt('d', '≈ 2')],
        hints: ['Was ergibt ein Bruch aus zwei gleich großen Zahlen?', 'c(' + b + ') und c(' + a + ') sind am HÄP näherungsweise gleich.', 'Der Bruch ist ≈ 1.'] },
      { id: 't2', text: 'Was bleibt von der Gleichung übrig?',
        options: [opt('a', 'Kₛ' + n + ' ≈ c(H₃O⁺)', true), opt('b', 'Kₛ' + n + ' ≈ c(' + b + ')'), opt('c', 'Kₛ' + n + ' ≈ 1'), opt('d', 'c(H₃O⁺) ≈ 1 mol/L')],
        hints: ['Multipliziere c(H₃O⁺) mit 1.', 'Kₛ = c(H₃O⁺) · 1.', 'Kₛ' + n + ' ≈ c(H₃O⁺).'] },
      { id: 't3', text: 'Bilde den negativen dekadischen Logarithmus (p = −lg). Welche Beziehung erhältst du?',
        options: [opt('a', 'pKₛ' + n + ' ≈ pH', true), opt('b', 'pKₛ' + n + ' ≈ pOH'), opt('c', 'pKₛ' + n + ' ≈ 14,00 − pH'), opt('d', 'pKₛ' + n + ' ≈ 7')],
        hints: ['−lg c(H₃O⁺) ist …?', '−lg Kₛ = pKₛ und −lg c(H₃O⁺) = pH.', 'pKₛ ≈ pH am HÄP – deshalb liefert die pH-Messung dort den pKₛ-Wert.'] },
    ];
    if (P.length > 1) {
      steps.push({ id: 't4', text: 'Gilt die gleiche Überlegung an der zweiten Stufe (' + P[1][0] + ' / ' + P[1][1] + ')?',
        options: [opt('a', 'Ja: Am HÄP 2 gilt c(' + P[1][1] + ') ≈ c(' + P[1][0] + ') und damit pH ≈ pKₛ₂.', true), opt('b', 'Nein: An der zweiten Stufe gilt pH ≈ pKₛ₁.'), opt('c', 'Nein: Am HÄP 2 gilt pH ≈ ½(pKₛ₁ + pKₛ₂).'), opt('d', 'Nein: Die zweite Stufe hat keinen pKₛ-Wert.')],
        hints: ['Schreibe das MWG der zweiten Stufe auf.', 'Kₛ₂ = c(H₃O⁺) · c(' + P[1][1] + ') / c(' + P[1][0] + ').', 'Am HÄP 2 ist dieses Paar je zur Hälfte vorhanden → pH ≈ pKₛ₂. ½(pKₛ₁ + pKₛ₂) gilt am 1. ÄP (Ampholyt).'] });
    }
    return steps;
  }

  const TITRANT_QUESTION = {
    id: 'titrant',
    text: 'Welche Maßlösung brauchst du für diese Probe?',
    hints: ['Säure oder Base – was liegt in der Probe vor?', 'Für eine Neutralisation brauchst du den Gegenpartner: zu einer Säure eine starke Base, zu einer Base eine starke Säure.', 'Säuren (Essigsäure, Phosphorsäure, Glycinhydrochlorid) → Natronlauge; Ammoniak → Salzsäure.'],
  };

  // ------------------------------------------------------------ Hilfen zu Rechenfeldern

  /**
   * Gestufte Hilfen: Denkimpuls → Ansatz → Musterrechnung mit eigenen Daten.
   * Stufe 3 wird erst nach eigener Bearbeitung empfohlen.
   */
  function hints(exp, field, ctx) {
    const n = exp.cSample * exp.vSample;
    const stage = Number(String(field).slice(-1)) || 1;
    const c = function (x, d) { return fmt(x, d === undefined ? 2 : d); };
    if (/^eqm/.test(field)) {
      return [
        'Wo ändert sich der pH-Wert deiner Kurve bei kleiner Zugabe am stärksten?',
        'Der Äquivalenzpunkt liegt in der Mitte des steilen Abschnitts. Die Tabelle zeigt ΔpH/ΔV zwischen deinen Messpunkten.',
        ctx && ctx.steep ? 'Der steilste Abschnitt deiner Messung liegt zwischen ' + c(ctx.steep.a) + ' und ' + c(ctx.steep.b) + ' mL.' : 'Miss im Bereich des Sprungs in kleinen Schritten, damit sich der ÄP eingrenzen lässt.',
      ];
    }
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
        stage === 1 ? 'Bei welchem Volumen ist die Stufe zur Hälfte umgesetzt?' : 'Wo beginnt und wo endet die zweite Stufe auf der Volumenachse?',
        stage === 1 ? 'V(HÄP,1) = V(ÄP,1) / 2 – mit deinem eigenen ÄP.' : 'V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)] / 2 – nicht V(ÄP,2)/2.',
        b && Number.isFinite(b.v1)
          ? (stage === 1 ? 'V(HÄP,1) = ' + c(b.v1) + ' mL / 2 = ' + c(b.v1 / 2) + ' mL.' : (Number.isFinite(b.v2) ? 'V(HÄP,2) = (' + c(b.v1) + ' mL + ' + c(b.v2) + ' mL) / 2 = ' + c((b.v1 + b.v2) / 2) + ' mL.' : 'Für die Musterrechnung fehlt noch V(ÄP,2) in der gewählten Basis.'))
          : 'Für die Musterrechnung zuerst den ÄP-Marker setzen bzw. eine Rechenbasis wählen.',
      ];
    }
    if (/^phhalf/.test(field)) {
      return [
        'Welcher deiner protokollierten Messpunkte der Halbtitration liegt an deinem Zielvolumen?',
        'Nimm den stabil übernommenen pH-Wert am Zielvolumen aus der Messtabelle der Halbtitration.',
        ctx && ctx.point ? 'Protokolliert: V = ' + c(ctx.point.v) + ' mL, pH = ' + c(ctx.point.pH) + (ctx.point.stable ? ' (stabil).' : ' (nicht stabil).') : 'Es gibt noch keinen passenden Messpunkt der Halbtitration.',
      ];
    }
    if (/^pk_/.test(field)) {
      const task = ctx && ctx.task;
      const pH = ctx && ctx.pH;
      if (task && task.from === 'pOH') {
        return [
          'Welche Größe ist am HÄP einer Base gleich pK_B – pH oder pOH?',
          'pOH = pK_W − pH mit pK_W = 14,00; am HÄP pOH ≈ pK_B.',
          Number.isFinite(pH) ? 'pK_B ≈ pOH = 14,00 − ' + c(pH) + ' = ' + c(14 - pH) + '.' : 'Zuerst den gemessenen pH-Wert eintragen.',
        ];
      }
      return [
        'Was hast du im MWG-Trainer für den HÄP herausgefunden?',
        'Am HÄP dieser Stufe gilt pH ≈ pKₛ.',
        Number.isFinite(pH) ? (task ? task.label : 'pKₛ') + ' ≈ pH(HÄP) = ' + c(pH) + '.' : 'Zuerst den gemessenen pH-Wert eintragen.',
      ];
    }
    if (/^th_/.test(field)) {
      const p = ctx && ctx.point;
      if (!p) return ['', '', ''];
      const lit = Chem.LITERATURE[exp.id];
      let sample = p.approach + ' → pH = ' + c(p.main) + '.';
      if (p.key === 'start') {
        if (exp.id === 'ammonia') sample = 'pOH = ½(' + c(lit.pKb) + ' − lg ' + c(p.cGiven, 4) + ') = ' + c(Chem.PKW - p.main) + '; pH = 14,00 − pOH = ' + c(p.main) + '.';
        else if (p.alpha >= 0.05) sample = 'Kₛ = 10^(−' + c(lit.pKs[0]) + ') mol/L; x² + Kₛ·x − Kₛ·c₀ = 0 → x = c(H₃O⁺) → pH = ' + c(p.main) + '.';
        else sample = 'pH = ½(' + c(lit.pKs[0]) + ' − lg ' + c(p.cGiven, 4) + ') = ' + c(p.main) + '.';
      } else if (/^half/.test(p.key)) {
        sample = 'pH = ' + (exp.id === 'ammonia' ? '14,00 − pK_B = 14,00 − ' + c(lit.pKb) + ' = ' : 'pKₛ = ') + c(p.main) + '.';
      }
      return [
        p.key === 'start' ? 'Welche Teilchen bestimmen den pH-Wert vor der ersten Zugabe? Wie konzentriert ist die Probe nach dem Verdünnen?' : /^half/.test(p.key) ? 'Was gilt am HÄP?' : 'Welches Teilchen liegt am Äquivalenzpunkt vor – Säure, Base oder Ampholyt?',
        p.approach + (p.given ? ' · ' + p.given : ''),
        sample,
      ];
    }
    if (/^dpk_|^dph_/.test(field)) {
      return [
        'Abweichung = eigener Wert − Referenzwert. Achte auf das Vorzeichen.',
        /^dpk/.test(field) ? 'ΔpK = pK(experimentell) − pK(Literatur). Keine Prozentangabe: pK-Werte sind logarithmisch.' : 'ΔpH = pH(gemessen) − pH(berechnet).',
        ctx && Number.isFinite(ctx.a) && Number.isFinite(ctx.b) ? fmt(ctx.a, 2) + ' − ' + fmt(ctx.b, 2) + ' = ' + NS.Format.signed(ctx.a - ctx.b, 2) + '.' : 'Es fehlen noch Werte.',
      ];
    }
    return ['', '', ''];
  }

  // ------------------------------------------------------------ Freiwillige Hilfen und Vertiefung

  const BASICS =
    '<ul>' +
    '<li><strong>Äquivalenzpunkt (ÄP):</strong> Die betrachtete Stufe ist stöchiometrisch vollständig umgesetzt. Er liegt in der Mitte des steilen Sprungs der pH-Kurve.</li>' +
    '<li><strong>Endpunkt:</strong> beobachteter Farbumschlag eines Indikators – stimmt nicht automatisch mit dem ÄP überein. <strong>Neutralpunkt:</strong> pH = 7 (25 °C), kein Synonym für den ÄP.</li>' +
    '<li><strong>Säurekonstante:</strong> HA + H₂O ⇌ H₃O⁺ + A⁻, Kₛ = c(H₃O⁺) · c(A⁻) / c(HA), pKₛ = −lg Kₛ. Für Basen entsprechend K_B, pK_B; pKₛ + pK_B = 14,00 für ein korrespondierendes Paar.</li>' +
    '<li><strong>Messen:</strong> Im Sprung kleine Zugaben, rühren, erst bei stabiler Anzeige übernehmen. Die Kurve entsteht nur aus deinen übernommenen Messpunkten.</li>' +
    '</ul>';

  const HH =
    '<p>Aus dem MWG folgt durch Logarithmieren die Henderson-Hasselbalch-Gleichung in Konzentrationsform:</p>' +
    '<p class="eq">pH = pKₛ + lg [ c(A⁻) / c(HA) ]</p>' +
    '<p>Am HÄP ist c(A⁻) ≈ c(HA), lg 1 = 0, also pH ≈ pKₛ. Die Näherung c(A⁻) ≈ c(HA) setzt voraus, dass die Säure selbst kaum protolysiert und keine Nachbarstufe stört. Bei starken ersten Stufen (Phosphorsäure, Glycin) ist am stöchiometrischen HÄP c(A⁻) merklich größer als c(HA) – der gemessene pH liegt dann über pKₛ. Pufferwirkung und Pufferherstellung behandelt die App „Pufferfish“.</p>';

  /** Deutung der systematischen Abweichung an der ersten Stufe (nach eigenem Ergebnis) */
  const APPROX_NOTE = {
    phosphoric: 'Phosphorsäure ist in der ersten Stufe relativ stark. Sie protolysiert schon selbst zu einem erheblichen Teil; am stöchiometrischen HÄP 1 liegt deshalb mehr H₂PO₄⁻ als H₃PO₄ vor. Der gemessene pH liegt systematisch über pKₛ₁ – das Ablesen am HÄP 1 ist hier nur eine näherungsweise pK-Bestimmung. An der zweiten Stufe gilt die Beziehung gut.',
    glycine: 'Die Carboxygruppe des Glycin-Kations ist relativ stark sauer. Sie protolysiert schon selbst; am stöchiometrischen HÄP 1 liegt deshalb mehr Zwitterion als Kation vor. Der gemessene pH liegt systematisch über pKₛ₁ – eine näherungsweise pK-Bestimmung. An der zweiten Stufe (–NH₃⁺) gilt die Beziehung gut.',
  };

  // ------------------------------------------------------------ Hefteintrag (ca. 100 Wörter)

  const NOTEBOOK =
    '<h2>pK-Werte durch Halbtitration</h2>' +
    '<p>Am <strong>Halbäquivalenzpunkt (HÄP)</strong> ist eine Protolysestufe zur Hälfte umgesetzt: c(A⁻) ≈ c(HA).</p>' +
    '<span class="eq">Kₛ = c(H₃O⁺) · c(A⁻) / c(HA) &nbsp;⇒&nbsp; Kₛ ≈ c(H₃O⁺) &nbsp;⇒&nbsp; pKₛ ≈ pH(HÄP)</span>' +
    '<ul>' +
    '<li><strong>Vorgehen:</strong> V(ÄP) aus der Titrationskurve, V(HÄP) = V(ÄP)/2, frische Probe bis V(HÄP) titrieren, pH messen.</li>' +
    '<li><strong>Schwache Base</strong> (NH₃): am HÄP pOH ≈ pK_B, also pK_B ≈ 14,00 − pH; der pH entspricht pKₛ(NH₄⁺).</li>' +
    '<li><strong>Mehrprotonige Säuren:</strong> V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)]/2.</li>' +
    '<li><strong>Grenze:</strong> pKₛ ≈ pH ist eine Näherung; bei starken Säurestufen liegt der pH am HÄP darüber.</li>' +
    '<li>Abweichungen als <strong>ΔpK mit Vorzeichen</strong>, nicht in Prozent.</li>' +
    '</ul>';

  const api = {
    ROLES: ROLES,
    PAIRS: PAIRS,
    halfQuestions: halfQuestions,
    trainer: trainer,
    TITRANT_QUESTION: TITRANT_QUESTION,
    hints: hints,
    BASICS: BASICS,
    HH: HH,
    APPROX_NOTE: APPROX_NOTE,
    NOTEBOOK: NOTEBOOK,
  };
  NS.Content = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
