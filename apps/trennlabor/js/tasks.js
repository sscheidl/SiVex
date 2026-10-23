/*
 * Trennlabor – Aufgaben (ohne DOM)
 *
 * Für jede Aufgabe: Problemstellung, Bewertung am tatsächlichen Versuchszustand,
 * zustandsabhängige Hilfe (klein/konkret), Beobachtungsfragen und Lückentexte
 * (aus dem eingefrorenen Erfolgszustand abgeleitet), Theorie und Muster-Hefteintrag.
 */
(function (root, factory) {
  const req = typeof module === 'object' && module.exports;
  const deps = req
    ? { core: require('./core.js'), classic: require('./classic.js'), chroma: require('./chroma.js'), distill: require('./distill.js') }
    : { core: root.TL.core, classic: root.TL.classic, chroma: root.TL.chroma, distill: root.TL.distill };
  const api = factory(deps);
  if (req) module.exports = api;
  else (root.TL = root.TL || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  const { core, chroma } = deps;
  const { fmt } = core;
  const r1 = (v) => Math.round(v * 10) / 10;

  // ---------------------------------------------------------------- Lücken
  const G = {
    sediment: { accept: ['Sedimentieren', 'Sedimentation', 'Absetzen', 'Absetzenlassen'], hint: 'Gesucht ist der Fachbegriff für das Absetzen eines Feststoffs.' },
    dekant: { accept: ['Dekantieren', 'Dekantation'], hint: 'Gesucht ist der Fachbegriff für das vorsichtige Abgießen über dem Bodensatz.' },
    filtrieren: { accept: ['Filtrieren', 'Filtration', 'Filtern'], forbid: [{ term: 'Sieben', hint: 'Sieben trennt grobe Teile – hier ist das Verfahren mit Filterpapier gemeint.' }], hint: 'Gesucht ist das Trennverfahren mit Filterpapier.' },
    rueckstand: { accept: ['Rückstand', 'Filterrückstand'], forbid: [{ term: 'Filtrat', hint: 'Das Filtrat ist die durchgelaufene Flüssigkeit. Gesucht ist, was im Filter bleibt.' }], hint: 'Wie heißt das, was im Filterpapier zurückbleibt?' },
    filtrat: { accept: ['Filtrat'], forbid: [{ term: 'Rückstand', hint: 'Der Rückstand bleibt im Filter. Gesucht ist die durchgelaufene Flüssigkeit.' }], hint: 'Wie heißt die Flüssigkeit, die durch den Filter läuft?' },
    loeslich: { accept: ['löslich', 'wasserlöslich', 'gut löslich'], forbid: [{ term: 'unlöslich', hint: 'Kochsalz löst sich doch beim Rühren auf.' }], hint: 'Was passiert mit Kochsalz in Wasser?' },
    unloeslich: { accept: ['unlöslich', 'nicht löslich', 'wasserunlöslich', 'schwer löslich'], forbid: [{ term: 'löslich', hint: 'Der Sand blieb doch als Feststoff zurück.' }], hint: 'Was gilt für Sand in Wasser?' },
    eindampfen: { accept: ['Eindampfen', 'Abdampfen', 'Verdampfen', 'Eindampfen lassen'], hint: 'Mit welchem Verfahren hast du das Wasser entfernt?' },
    kristall: { accept: ['kristallisiert', 'kristallisiert aus', 'auskristallisiert', 'bleibt zurück', 'kristallisiert sich'], hint: 'Was geschieht mit dem gelösten Salz, wenn das Wasser verschwindet?' },
    magnet: { accept: ['Magneten', 'Magnet', 'Dauermagneten'], hint: 'Mit welchem Gerät hast du das Eisen herausgeholt?' },
    magnetisch: { accept: ['magnetisch', 'ferromagnetisch'], hint: 'Welche Eigenschaft hat Eisen, die Sand und Salz fehlt?' },
    loeslichkeit: { accept: ['Löslichkeit', 'Wasserlöslichkeit'], forbid: [{ term: 'Dichte', hint: 'Die Dichte nutzt du beim Scheidetrichter. Hier ging es ums Auflösen.' }], hint: 'In welcher Eigenschaft unterscheiden sich Sand und Kochsalz beim Kontakt mit Wasser?' },
    dichte: { accept: ['Dichte'], forbid: [{ term: 'Masse', hint: 'Nicht die Masse, sondern die Masse je Volumen entscheidet.' }, { term: 'Gewicht', hint: 'Nicht das Gewicht, sondern die Masse je Volumen entscheidet.' }], hint: 'Welche Stoffeigenschaft entscheidet, welche Flüssigkeit unten liegt?' },
    mischbar: { accept: ['mischbar', 'ineinander löslich', 'mischbar miteinander'], forbid: [{ term: 'löslich', hint: 'Bei zwei Flüssigkeiten spricht man davon, ob sie mischbar sind.' }], hint: 'Öl und Wasser sind nicht …?' },
    scheide: { accept: ['Scheidetrichter'], hint: 'Mit welchem Gerät mit Hahn hast du die Flüssigkeiten getrennt?' },
    hahn: { accept: ['Hahn', 'Absperrhahn', 'Hahnküken'], hint: 'Durch welches Bauteil lässt man die Flüssigkeit unten ab?' },
    extrahieren: { accept: ['Extrahieren', 'Extraktion', 'Herauslösen'], hint: 'Fachbegriff für das Herauslösen von Stoffen mit einem Lösungsmittel.' },
    loesungsmittel: { accept: ['Lösungsmittel', 'Extraktionsmittel'], hint: 'Wie nennt man die Flüssigkeit, die andere Stoffe löst?' },
    stoffgemisch: { accept: ['Stoffgemisch', 'Gemisch', 'Lösung', 'homogenes Gemisch', 'Gemenge'], forbid: [{ term: 'Reinstoff', hint: 'Im Tee sind Wasser und viele gelöste Stoffe – kein Reinstoff.' }], hint: 'Ist der Tee ein Reinstoff oder …?' },
    gemischFarbe: { accept: ['Stoffgemisch', 'Gemisch', 'Farbstoffgemisch'], forbid: [{ term: 'Reinstoff', hint: 'Eine Farbe mit mehreren Zonen enthält mehrere Farbstoffe.' }], hint: 'Mehrere Farbzonen bedeuten, dass die Farbe ein … ist.' },
    mobil: { accept: ['mobile', 'bewegliche', 'mobil'], forbid: [{ term: 'stationäre', hint: 'Das Laufmittel bewegt sich – es ist nicht die ruhende Phase.' }], hint: 'Das Laufmittel bewegt sich. Wie heißt eine solche Phase?' },
    stationaer: { accept: ['stationäre', 'ruhende', 'stationär', 'feste'], forbid: [{ term: 'mobile', hint: 'Das Papier bewegt sich nicht.' }], hint: 'Das Papier bewegt sich nicht. Wie heißt diese Phase?' },
    adsorption: { accept: ['Adsorption', 'adsorbiert', 'Anlagerung', 'angelagert', 'adsorbieren'], forbid: [{ term: 'Absorption', hint: 'Absorption bedeutet Aufnahme ins Innere eines Stoffes. Gemeint ist die Anlagerung an der Oberfläche: Adsorption (mit d).' }, { term: 'absorbiert', hint: 'Gemeint ist die Anlagerung an der Oberfläche: adsorbiert (mit d), nicht absorbiert.' }], hint: 'Wie heißt das Anlagern eines Stoffes an einer Oberfläche?' },
    laufmittel: { accept: ['Laufmittel', 'Fließmittel', 'mobilen Phase', 'mobile Phase', 'Lösungsmittel'], hint: 'In welcher Flüssigkeit muss sich der Farbstoff lösen, um zu wandern?' },
    hoehe: { accept: ['Höhe', 'Laufhöhe', 'Laufstrecke', 'Strecke'], hint: 'Woran erkennst du auf dem Chromatogramm, dass zwei Zonen derselbe Farbstoff sein können?' },
    blauen: { accept: ['blauen', 'blau'], hint: 'Welche Farbzone findest du in beiden Bahnen?' },
    unloeslichW: { accept: ['unlöslich', 'nicht löslich', 'wasserunlöslich', 'kaum löslich'], forbid: [{ term: 'löslich', hint: 'Mit Wasser blieb der Fleck doch auf der Startlinie.' }], hint: 'Was beobachtest du beim wasserfesten Stift mit Wasser?' },
    loeslichE: { accept: ['löslich', 'teilweise löslich', 'gut löslich'], forbid: [{ term: 'unlöslich', hint: 'Mit dem Ethanol-Wasser-Gemisch wanderte doch ein Teil nach oben.' }], hint: 'Was beobachtest du beim wasserfesten Stift mit dem Ethanol-Wasser-Gemisch?' },
    t78: { accept: ['78', '78 °C', '78°C', '78,3', 'achtundsiebzig'], hint: 'Siedetemperatur von Ethanol bei Normaldruck (gerundet).' },
    t100: { accept: ['100', '100 °C', '100°C', 'hundert'], hint: 'Siedetemperatur von Wasser bei Normaldruck.' },
    verdampft: { accept: ['verdampft', 'siedet', 'verdunstet', 'wird gasförmig', 'geht in den Dampf über'], forbid: [{ term: 'kondensiert', hint: 'Im Kolben wird die Flüssigkeit zu Dampf – das Gegenteil von Kondensieren.' }], hint: 'Was geschieht im Kolben beim Erhitzen mit der Flüssigkeit?' },
    kondensiert: { accept: ['kondensiert', 'verflüssigt', 'kondensiert sich', 'wird flüssig'], forbid: [{ term: 'verdampft', hint: 'Im Kühler wird der Dampf abgekühlt – das Gegenteil von Verdampfen.' }], hint: 'Was geschieht mit dem Dampf im Kühler?' },
    ethanol: { accept: ['Ethanol', 'Alkohol', 'Äthanol', 'Ethylalkohol'], forbid: [{ term: 'Wasser', hint: 'Der Ethanolanteil im Destillat ist höher.' }], hint: 'Welcher Stoff ist im Destillat angereichert?' },
    siedetemp: { accept: ['Siedetemperatur', 'Siedetemperaturen', 'Siedepunkt', 'Siedepunkte'], forbid: [{ term: 'Schmelztemperatur', hint: 'Bei der Destillation geht es um das Verdampfen.' }], hint: 'In welcher Stoffeigenschaft unterscheiden sich Ethanol und Wasser?' }
  };
  const gap = (id) => Object.assign({ id }, G[id]);

  // --------------------------------------------------- Klassische Verfahren
  const nonDevice = (f) => !['funnel', 'sieve', 'magnet', 'sep', 'source'].includes(f.kind);
  const saltOf = (c) => c.saltS + c.saltD;

  function sandFraction(fr, maxIron) {
    let sand = 0, contam = 0;
    const where = [];
    for (const f of fr) {
      if (f.kind === 'magnet' || f.c.sand < 0.5) continue;
      const salt = saltOf(f.c);
      if (salt <= 0.12 * f.c.sand + 0.25 && f.c.iron <= (maxIron == null ? 99 : maxIron)) { sand += f.c.sand; contam += salt; where.push(f.label); }
    }
    return { sand, contam, where };
  }
  const saltFraction = (fr, needIronFree) => fr.find((f) => f.kind !== 'funnel' && f.kind !== 'sieve' && f.kind !== 'magnet' && f.c.saltS >= 3.0 && f.c.water <= 0.5 && f.c.sand <= 0.2 && (!needIronFree || f.c.iron <= 0.1));

  const K = {};

  K['K-01'] = {
    id: 'K-01', lab: 'classic', short: 'Sand/Wasser',
    title: 'Sand und Wasser trennen',
    problem: 'In Becherglas A ist Wasser mit aufgewirbeltem Sand. Gewinne mindestens 70 mL klares Wasser ohne Sand in einem anderen Gefäß. Der Sand soll getrennt davon zurückbleiben.',
    material: 'Drei Bechergläser, Erlenmeyerkolben, Trichter mit Stativ, Filterpapier, Glasstab, Spritzflasche mit Wasser, Ausguss',
    evaluate(e) {
      const fr = e.fractions();
      const clear = fr.find((f) => f.id !== 'A' && f.kind !== 'funnel' && f.c.water >= 70 && f.c.sand <= 0.25 && f.d.suspended <= 0.04 && f.c.oil < 0.5);
      const sandF = sandFraction(fr);
      const problems = [];
      if (!clear) {
        const turbid = fr.find((f) => f.c.water >= 40 && f.d.suspended > 0.04 && f.id !== 'A');
        const sandy = fr.find((f) => f.id !== 'A' && f.kind !== 'funnel' && f.c.water >= 40 && f.c.sand > 0.25);
        const A = fr.find((f) => f.id === 'A');
        if (turbid) problems.push({ code: 'turbid', text: `Die Flüssigkeit in ${turbid.label} ist noch trüb – darin schwebt Sand.` });
        else if (sandy) problems.push({ code: 'sandInWater', text: `In ${sandy.label} ist mit dem Wasser auch Sand gelandet (Bodensatz).` });
        else if (A && A.c.water >= 70) problems.push({ code: 'notSeparated', text: 'Wasser und Sand sind noch gemeinsam in Becherglas A.' });
        const lost = e.state.lost.waste.water + e.state.lost.spilled.water;
        if (lost > 35) problems.push({ code: 'waterLost', text: `Rund ${Math.round(lost)} mL Wasser sind verschüttet oder weggegossen – für 70 mL reicht der Rest nicht mehr.` });
        if (!problems.length) problems.push({ code: 'tooLittle', text: 'Es gibt noch kein Gefäß mit mindestens 70 mL klarem Wasser.' });
      }
      if (sandF.sand < 8.5) problems.push({ code: 'sandMissing', text: 'Der Sand ist nicht vollständig vom Wasser getrennt zurückgeblieben.' });
      const success = !problems.length;
      const method = e.state.funnel && e.state.funnel.c.sand > 0.5 ? 'filter' : 'decant';
      return { success, problems, snapshot: success ? { waterVol: r1(clear.c.water), where: clear.label, method, sand: r1(sandF.sand) } : null };
    },
    help(e) {
      const st = e.state; const fr = e.fractions();
      const A = fr.find((f) => f.id === 'A');
      const turbid = fr.find((f) => f.id !== 'A' && f.c.water > 20 && f.d.suspended > 0.04);
      const sandy = fr.find((f) => f.id !== 'A' && f.kind !== 'funnel' && f.c.water > 20 && f.c.sand > 0.25);
      if (st.funnel && st.funnel.c.water > 3 && !e.funnelReceiver()) return { small: 'Wohin läuft das Filtrat?', concrete: 'Stelle ein leeres Gefäß (z. B. den Erlenmeyerkolben) unter den Trichter.' };
      if (st.funnel && st.funnel.paper !== 'folded' && st.funnel.paper !== 'none' && turbid) return { small: 'Liegt das Filterpapier richtig im Trichter?', concrete: 'Leere den Trichter, setze ein gefaltetes Filterpapier ein und filtriere die trübe Flüssigkeit noch einmal.' };
      if (turbid) return { small: 'Was passiert mit dem Sand, wenn die Flüssigkeit eine Weile ruhig steht?', concrete: `Lass ${turbid.label} stehen, bis sich der Sand abgesetzt hat, und gieße dann vorsichtig ab – oder filtriere die trübe Flüssigkeit mit gefaltetem Filterpapier.` };
      if (sandy) return { small: 'Ist beim Abgießen Sand mitgekommen?', concrete: `Lass den Sand in ${sandy.label} absetzen und gieße das klare Wasser vorsichtig in ein anderes Gefäß ab.` };
      if (A && A.c.water > 60 && A.d.suspended > 0.3) return { small: 'Beobachte das Becherglas A eine Weile, ohne etwas zu tun.', concrete: 'Warte (Zeitraffer), bis sich der Sand am Boden abgesetzt hat. Gieße dann „vorsichtig“ in ein leeres Becherglas ab.' };
      if (A && A.c.water > 60) return { small: 'Wie bekommst du das klare Wasser über dem Sand heraus, ohne den Sand aufzuwirbeln?', concrete: 'Gieße aus Becherglas A „vorsichtig“ in Becherglas B ab (Dekantieren). Alternativ: gefaltetes Filterpapier einsetzen und filtrieren.' };
      return { small: 'Prüfe, ob in einem Gefäß mindestens 70 mL klares Wasser ohne Sand sind.', concrete: 'Wähle das Gefäß mit dem klaren Wasser aus und kontrolliere Füllstand und Bodensatz; dann „Ergebnis prüfen“.' };
    },
    questions(s) {
      return [
        { id: 'q1', type: 'choice', prompt: 'Was geschah mit dem Sand, solange das Gefäß ruhig stand?', options: [['settle', 'Er setzte sich am Boden ab.'], ['dissolve', 'Er löste sich im Wasser auf.'], ['float', 'Er schwamm an der Oberfläche.']], correct: 'settle', wrong: 'Achte auf die Beobachtung im ruhigen Becherglas.' },
        { id: 'q2', type: 'number', prompt: `Wie viel klares Wasser hast du in ${s.where} gewonnen? (Skala ablesen)`, unit: 'mL', check: (v) => Math.abs(v - s.waterVol) <= 4, wrong: 'Lies die Füllhöhe an der Skala des Gefäßes ab (Gefäß auswählen).' },
        { id: 'g1', type: 'gap', prompt: 'Ergänze die Fachbegriffe.', text: 'Der Sand setzt sich am Boden ab. Diesen Vorgang nennt man {sediment}. Das vorsichtige Abgießen der Flüssigkeit über dem Bodensatz heißt {dekant}. Beim {filtrieren} hält das Filterpapier den Sand als {rueckstand} zurück, die durchgelaufene Flüssigkeit heißt {filtrat}.', gaps: [gap('sediment'), gap('dekant'), gap('filtrieren'), gap('rueckstand'), gap('filtrat')] }
      ];
    },
    theory: [
      'Sand ist in Wasser unlöslich und hat eine größere Dichte als Wasser. In ruhigem Wasser sinken die Körner deshalb nach unten – die Suspension sedimentiert.',
      'Beim Dekantieren gießt man die Flüssigkeit langsam über dem Bodensatz ab. Gießt man zu schnell, wird der Sand aufgewirbelt und gelangt mit ins neue Gefäß.',
      'Beim Filtrieren sind die Poren des Filterpapiers kleiner als die Sandkörner: Der Sand bleibt als Rückstand im Filter, das Wasser läuft als Filtrat durch.',
      'Beide Verfahren nutzen unterschiedliche Eigenschaften: Sedimentieren/Dekantieren die Dichte, Filtrieren die Teilchengröße.'
    ],
    notebook(s) {
      return {
        title: 'Trennung eines Sand-Wasser-Gemischs',
        versuch: 'Ein Gemisch aus Sand und Wasser wird umgerührt und anschließend ruhig stehen gelassen. Danach wird die Flüssigkeit vorsichtig abgegossen bzw. durch ein gefaltetes Filterpapier filtriert.',
        beobachtung: `Das Gemisch ist nach dem Umrühren trüb. In Ruhe setzt sich der Sand am Boden ab, das Wasser darüber wird klar. Das abgegossene bzw. filtrierte Wasser ist klar (hier ca. ${fmt(s.waterVol, 0)} mL), der Sand bleibt im Becherglas bzw. im Filter zurück.`,
        erklaerung: 'Sand ist in Wasser unlöslich und hat eine größere Dichte als Wasser. Deshalb sinkt er nach unten (Sedimentieren) und das Wasser kann abgegossen werden (Dekantieren). Beim Filtrieren werden die Sandkörner vom Filterpapier zurückgehalten, weil sie größer sind als die Poren.',
        merksatz: 'Ein Gemisch aus einem unlöslichen Feststoff und einer Flüssigkeit (Suspension) trennt man durch Sedimentieren und Dekantieren oder durch Filtrieren. Rückstand = Feststoff im Filter, Filtrat = durchgelaufene Flüssigkeit.'
      };
    }
  };

  K['K-02'] = {
    id: 'K-02', lab: 'classic', short: 'Sand/Kochsalz',
    title: 'Sand und Kochsalz trennen',
    problem: 'In der Vorratsschale liegt ein trockenes Gemisch aus 10 g Sand und 5 g Kochsalz. Gewinne beide Stoffe getrennt: den Sand und das Kochsalz als trockenen, festen Stoff.',
    material: 'Vorratsschale mit Gemisch, zwei Bechergläser, Erlenmeyerkolben, Abdampfschale, Heizplatte, Trichter mit Stativ, Filterpapier, Glasstab, Spritzflasche mit Wasser, Waage, Ausguss',
    evaluate(e) { return evalSandSalt(e, false); },
    help(e) { return helpSandSalt(e, false); },
    questions(s) {
      return [
        { id: 'q1', type: 'choice', prompt: 'Wo befand sich das Kochsalz, nachdem du den Sand abgetrennt hattest?', options: [['residue', 'Im Filterrückstand bzw. Bodensatz beim Sand'], ['solution', 'Gelöst in der Flüssigkeit (Filtrat bzw. abgegossene Lösung)'], ['gone', 'Es war verschwunden']], correct: 'solution', wrong: 'Denke daran, was beim Rühren mit dem Salz passiert ist.' },
        { id: 'q2', type: 'choice', prompt: 'Was blieb in der Abdampfschale zurück, als das Wasser verdampft war?', options: [['crystals', 'Weiße Kristalle'], ['nothing', 'Nichts'], ['sand', 'Sand']], correct: 'crystals', wrong: 'Sieh dir die Abdampfschale genau an.' },
        { id: 'q3', type: 'number', prompt: 'Welche Masse Kochsalz hast du gewonnen? (Abdampfschale auf die Waage)', unit: 'g', check: (v) => Math.abs(v - s.saltMass) <= 0.3, wrong: 'Wiege die Abdampfschale mit dem trockenen Salz (Gefäß wählen → Wiegen).' },
        { id: 'g1', type: 'gap', prompt: 'Ergänze die Fachbegriffe.', text: 'Kochsalz ist in Wasser {loeslich}, Sand ist {unloeslich}. Beim Filtrieren bleibt der Sand als {rueckstand} im Filter, das gelöste Salz gelangt ins {filtrat}. Beim {eindampfen} verdampft das Wasser und das Salz {kristall}. Die Trennung beruht auf der unterschiedlichen {loeslichkeit} der beiden Stoffe.', gaps: [gap('loeslich'), gap('unloeslich'), gap('rueckstand'), gap('filtrat'), gap('eindampfen'), gap('kristall'), gap('loeslichkeit')] }
      ];
    },
    theory: [
      'Ein trockenes Gemisch aus zwei Feststoffen lässt sich nicht filtrieren: Beide bleiben im Filter liegen.',
      'Gibt man Wasser hinzu und rührt, löst sich das Kochsalz (es ist wasserlöslich). Sand löst sich nicht. Das Lösen des Salzes ist eine Extraktion mit Wasser.',
      'Beim Filtrieren bleibt der Sand als Rückstand im Filter. Die Salzlösung läuft als Filtrat durch – das Salz lässt sich also nicht durch Filtrieren als Feststoff gewinnen.',
      'Beim Eindampfen verdampft das Wasser, das Salz bleibt in der Abdampfschale zurück und kristallisiert aus. Gegen Ende vorsichtig heizen, sonst spritzen Kristalle heraus.'
    ],
    notebook(s) {
      return {
        title: 'Trennung von Sand und Kochsalz',
        versuch: 'Das Sand-Salz-Gemisch wird mit Wasser verrührt. Die Suspension wird filtriert. Das Filtrat wird in einer Abdampfschale erhitzt, bis das Wasser verdampft ist.',
        beobachtung: `Beim Rühren verschwinden die Salzkristalle, der Sand bleibt sichtbar. Im Filter bleibt Sand zurück, das Filtrat ist klar. Beim Eindampfen bleiben weiße Kristalle zurück (hier ${fmt(s.saltMass, 1)} g Kochsalz).`,
        erklaerung: 'Kochsalz ist in Wasser löslich, Sand ist unlöslich. Beim Filtrieren wird der unlösliche Sand zurückgehalten, das gelöste Salz läuft mit dem Wasser durch. Beim Eindampfen verdampft das Wasser, das Salz kristallisiert aus.',
        merksatz: 'Stoffe mit unterschiedlicher Löslichkeit trennt man durch Lösen, Filtrieren und Eindampfen. Ein gelöster Stoff läuft durch den Filter und wird durch Eindampfen zurückgewonnen.'
      };
    }
  };

  function evalSandSalt(e, withIron) {
    const fr = e.fractions();
    const st = e.state;
    const problems = [];
    const salt = saltFraction(fr, withIron);
    const sandF = sandFraction(fr, withIron ? 0.3 : null);
    let iron = null;
    if (withIron) iron = fr.find((f) => f.c.iron >= 4.0 && f.c.sand <= 0.2 && saltOf(f.c) <= 0.2);
    const lostSalt = st.lost.waste.saltD + st.lost.waste.saltS + st.lost.spilled.saltD + st.lost.spilled.saltS;
    if (!salt) {
      const dishWet = fr.find((f) => f.c.saltD >= 2.5 && f.c.water > 0.5);
      const mixedSalt = fr.find((f) => f.c.saltS >= 1 && f.c.sand > 0.2);
      const ironSalt = withIron && fr.find((f) => f.c.saltS >= 1 && f.c.iron > 0.1 && f.c.sand <= 0.2);
      if (st.funnel && st.funnel.c.saltS > 0.4 && st.funnel.c.water < 1) problems.push({ code: 'dryFilter', text: 'Das Salz liegt noch ungelöst im Filter – trocken lässt es sich nicht vom Sand abtrennen.' });
      else if (mixedSalt && mixedSalt.c.water <= 0.5 && mixedSalt.kind === 'dish') problems.push({ code: 'sandInSalt', text: `In ${mixedSalt.label} sind Salz und Sand zusammen eingedampft – das Salz ist nicht rein.` });
      else if (mixedSalt) problems.push({ code: 'saltUndissolved', text: `In ${mixedSalt.label} liegt noch festes Salz zusammen mit Sand.` });
      else if (ironSalt) problems.push({ code: 'ironInSalt', text: `In ${ironSalt.label} sind Eisenspäne im Salz.` });
      else if (dishWet) problems.push({ code: 'notEvaporated', text: `Das Kochsalz ist in ${dishWet.label} noch gelöst. Fester Stoff ist es erst, wenn das Wasser entfernt ist.` });
      else if (lostSalt > 2) problems.push({ code: 'saltWasted', text: `Rund ${fmt(lostSalt, 1)} g Kochsalz sind mit der Lösung weggegossen oder verschüttet worden. Woher soll das Salz jetzt kommen?` });
      else {
        const small = fr.find((f) => f.c.saltS > 0.3 && f.c.water <= 0.5 && f.c.sand <= 0.2);
        if (small) problems.push({ code: 'saltLow', text: `In ${small.label} sind nur ${fmt(small.c.saltS, 1)} g Kochsalz – zu viel ist verloren gegangen (mindestens 3,0 g von 5 g).` });
        else problems.push({ code: 'noSalt', text: 'Es gibt noch kein Gefäß mit trockenem, festem Kochsalz ohne Sand.' });
      }
    }
    if (sandF.sand < 8) {
      const saltySand = fr.find((f) => f.c.sand >= 2 && saltOf(f.c) > 0.12 * f.c.sand + 0.25);
      const ironySand = withIron && fr.find((f) => f.c.sand >= 2 && f.c.iron > 0.3);
      if (ironySand) problems.push({ code: 'ironInSand', text: `Im Sand (${ironySand.label}) sind noch Eisenspäne.` });
      else if (saltySand) problems.push({ code: 'saltInSand', text: `Der Sand in ${saltySand.label} enthält noch viel Kochsalz.` });
      else problems.push({ code: 'sandMissing', text: 'Der Sand ist nicht vollständig als eigene Fraktion abgetrennt.' });
    }
    if (withIron && !iron) {
      const onMag = st.magnet && st.magnet.iron;
      problems.push({ code: 'noIron', text: onMag > 0.5 ? `Am Magneten haften erst ${fmt(onMag, 1)} g Eisen – es fehlt noch Eisen (mindestens 4 g).` : 'Das Eisen ist noch nicht als eigene Fraktion abgetrennt.' });
    }
    const success = !problems.length;
    return {
      success, problems,
      snapshot: success ? { saltMass: r1(salt.c.saltS), saltWhere: salt.label, sand: r1(sandF.sand), iron: iron ? r1(iron.c.iron) : null, ironWhere: iron ? iron.label : null, saltPct: Math.round(salt.c.saltS / 5 * 100) } : null
    };
  }

  function helpSandSalt(e, withIron) {
    const st = e.state;
    const fr = e.fractions();
    const by = (id) => fr.find((f) => f.id === id);
    const M = by('M');
    const lostSalt = st.lost.waste.saltD + st.lost.waste.saltS;
    const mag = st.magnet ? st.magnet.iron : 0;
    if (lostSalt > 2) return { small: 'Wo ist das gelöste Kochsalz geblieben?', concrete: 'Das Kochsalz wurde mit der Lösung in den Ausguss gegossen und ist verloren. Beginne den Versuch neu („Neu beginnen“ → nur diesen Versuch) und fange das Filtrat auf.' };
    if (M && M.c.sand + M.c.saltS + M.c.iron > 1) {
      if (withIron) return { small: 'Welcher der drei Stoffe hat eine besondere Eigenschaft, die du ohne Wasser nutzen kannst?', concrete: 'Führe den Magneten (in Folie) mehrmals durch das trockene Gemisch und streife die Eisenspäne auf dem Uhrglas ab. Danach: Gemisch in ein Becherglas, Wasser zugeben, rühren.' };
      return { small: 'Überlege, welcher der beiden Stoffe sich in Wasser löst.', concrete: 'Schütte das Gemisch in ein Becherglas, gib etwa 50 mL Wasser dazu und rühre, bis sich das Salz gelöst hat.' };
    }
    if (st.funnel && st.funnel.c.saltS > 0.4 && st.funnel.c.water < 1) return { small: 'Kann ein Filter zwei trockene Feststoffe voneinander trennen?', concrete: 'Überführe den Rückstand aus dem Trichter in ein Becherglas („Rückstand überführen“), gib Wasser zu und rühre, bis sich das Salz gelöst hat.' };
    if (withIron && mag > 0.3) {
      const watch = fr.find((f) => f.c.iron >= 0.3 && f.kind === 'watch');
      if (!watch && mag >= 4) return { small: 'Das Eisen hängt noch am Magneten.', concrete: 'Streife die Eisenspäne vom Magneten auf das Uhrglas ab („Magnet abstreifen“).' };
    }
    const undissolved = fr.find((f) => f.c.saltS > 0.4 && f.c.water > 1 && f.c.sand > 0.5);
    if (undissolved) return { small: 'Ist schon das ganze Salz gelöst?', concrete: `Rühre in ${undissolved.label} weiter, bis keine Salzkristalle mehr zu sehen sind. Reicht das Wasser nicht, gib noch etwas dazu.` };
    if (withIron) {
      const ironWet = fr.find((f) => f.c.iron > 0.5 && f.c.sand > 0.5 && f.kind !== 'magnet');
      if (ironWet && mag + fr.filter((f) => f.c.iron > 0.3 && f.c.sand < 0.2).reduce((s, f) => s + f.c.iron, 0) < 4) {
        return { small: 'Im Sand sind noch Eisenspäne. Womit holst du sie heraus?', concrete: `Führe den Magneten durch ${ironWet.label} (mehrmals, bis nichts mehr hängen bleibt) und streife das Eisen auf dem Uhrglas ab.` };
      }
    }
    const susp = fr.find((f) => f.c.saltD > 1 && f.c.sand > 0.5 && f.c.water > 5 && f.kind !== 'funnel');
    if (susp) {
      if (!st.funnel || st.funnel.paper !== 'folded') return { small: 'Womit hältst du die Sandkörner zurück, während die Lösung durchläuft?', concrete: 'Setze ein gefaltetes Filterpapier in den Trichter ein und stelle den Erlenmeyerkolben darunter.' };
      if (!e.funnelReceiver()) return { small: 'Wohin soll das Filtrat laufen?', concrete: 'Stelle den Erlenmeyerkolben unter den Trichter.' };
      return { small: 'Wie trennst du jetzt den Sand von der Salzlösung?', concrete: `Gieße den Inhalt von ${susp.label} in den Trichter mit Filterpapier.` };
    }
    const mixedDish = fr.find((f) => f.c.saltS + f.c.saltD > 0.5 && f.c.sand > 0.2 && f.kind === 'dish');
    if (mixedDish) return { small: 'Wie ist der Sand in die Abdampfschale gekommen?', concrete: 'Gib den Inhalt der Schale mit Wasser zurück in ein Becherglas, rühre, filtriere mit Filterpapier und dampfe nur das klare Filtrat ein.' };
    const sol = fr.find((f) => f.c.saltD >= 1 && f.c.sand < 0.3 && f.c.water > 0.5 && f.kind !== 'dish');
    if (sol) return { small: 'Wie bekommst du das gelöste Salz wieder als Feststoff?', concrete: `Gieße die Lösung aus ${sol.label} in die Abdampfschale, stelle sie auf die Heizplatte und heize.` };
    const dish = fr.find((f) => f.kind === 'dish' && f.c.saltD > 0.5 && f.c.water > 0.5);
    if (dish) {
      const v = e.vessel(dish.id);
      if (v.place !== 'heater') return { small: 'Was brauchst du, damit das Wasser verschwindet?', concrete: 'Stelle die Abdampfschale auf die Heizplatte und schalte sie ein.' };
      if (st.heater.level === 0) return { small: 'Die Schale steht bereit – was fehlt noch?', concrete: 'Schalte die Heizplatte ein (hohe Stufe), gegen Ende auf niedrige Stufe.' };
      if (st.heater.level === 2 && dish.c.water < 6) return { small: 'Achte auf das Ende des Eindampfens.', concrete: 'Stelle die Heizplatte jetzt auf „niedrig“, damit die Kristalle nicht aus der Schale spritzen.' };
      return { small: 'Das Eindampfen braucht Zeit.', concrete: 'Lass die Heizplatte laufen (Zeitraffer), bis das Wasser vollständig verdampft ist.' };
    }
    const saltySand = fr.find((f) => f.c.sand >= 2 && saltOf(f.c) > 0.12 * f.c.sand + 0.25 && f.c.water < 8);
    if (saltySand) return { small: 'Im feuchten Sand steckt noch Salzlösung.', concrete: `Spüle den Sand in ${saltySand.label} mit wenig Wasser nach (im Filter: Wasser darauf gießen) und dampfe auch diese Lösung ein.` };
    return { small: 'Prüfe, ob jeder Stoff getrennt und trocken in einem eigenen Gefäß liegt.', concrete: 'Kontrolliere die Abdampfschale: Ist das Wasser vollständig verdampft? Dann „Ergebnis prüfen“.' };
  }

  K['K-03'] = {
    id: 'K-03', lab: 'classic', short: 'Eisen/Sand/Salz',
    title: 'Eisen, Sand und Kochsalz trennen',
    problem: 'Das Gemisch in der Vorratsschale enthält 5 g Eisenspäne, 10 g Sand und 5 g Kochsalz. Trenne es in drei Fraktionen: Eisen, Sand und festes Kochsalz.',
    material: 'Vorratsschale mit Gemisch, Becherglas, Erlenmeyerkolben, Abdampfschale, Uhrglas, Magnet in Folie, Heizplatte, Trichter mit Stativ, Filterpapier, Glasstab, Spritzflasche mit Wasser, Waage, Ausguss',
    evaluate(e) { return evalSandSalt(e, true); },
    help(e) { return helpSandSalt(e, true); },
    questions(s) {
      return [
        { id: 'q1', type: 'choice', prompt: 'Was zog der Magnet aus dem Gemisch heraus?', options: [['iron', 'Nur die Eisenspäne'], ['ironsand', 'Eisenspäne und Sand'], ['all', 'Alle drei Stoffe']], correct: 'iron', wrong: 'Sieh nach, was am Magneten hängen blieb.' },
        { id: 'q2', type: 'number', prompt: `Welche Masse Eisen hast du abgetrennt? (${s.ironWhere} wiegen)`, unit: 'g', check: (v) => Math.abs(v - s.iron) <= 0.3, wrong: 'Wiege die Eisenfraktion (Gefäß wählen → Wiegen).' },
        { id: 'q3', type: 'number', prompt: 'Welche Masse Kochsalz hast du gewonnen?', unit: 'g', check: (v) => Math.abs(v - s.saltMass) <= 0.3, wrong: 'Wiege die Abdampfschale mit dem trockenen Salz.' },
        { id: 'g1', type: 'gap', prompt: 'Ergänze die Fachbegriffe.', text: 'Eisen lässt sich mit einem {magnet} abtrennen, weil es {magnetisch} ist. Sand und Kochsalz unterscheiden sich in ihrer {loeslichkeit}: Nach Zugabe von Wasser hält der Filter den Sand als {rueckstand} zurück, das Salz wird durch {eindampfen} des Filtrats gewonnen.', gaps: [gap('magnet'), gap('magnetisch'), gap('loeslichkeit'), gap('rueckstand'), gap('eindampfen')] }
      ];
    },
    theory: [
      'Jedes Trennverfahren nutzt eine Eigenschaft, in der sich die Stoffe unterscheiden.',
      'Eisen ist magnetisch, Sand und Kochsalz nicht. Mit dem Magneten (in Folie, damit sich die Späne leicht abstreifen lassen) wird das Eisen abgetrennt – am besten im trockenen Gemisch.',
      'Sand und Kochsalz unterscheiden sich in der Löslichkeit in Wasser: Lösen, Filtrieren, Eindampfen.',
      'Die Reihenfolge ist wichtig: Zuerst das Eisen trocken abtrennen. Im nassen Gemisch haftet es schlechter am Magneten, und Eisen sollte nicht lange in Salzwasser liegen (es rostet).'
    ],
    notebook(s) {
      return {
        title: 'Trennung von Eisen, Sand und Kochsalz',
        versuch: 'Mit einem Magneten in Folie werden die Eisenspäne aus dem trockenen Gemisch geholt. Der Rest wird mit Wasser verrührt, filtriert und das Filtrat eingedampft.',
        beobachtung: `Am Magneten bleiben nur die grauen Eisenspäne hängen (${fmt(s.iron, 1)} g). Im Filter bleibt Sand zurück. Nach dem Eindampfen liegen weiße Salzkristalle in der Schale (${fmt(s.saltMass, 1)} g).`,
        erklaerung: 'Eisen ist magnetisch, Sand und Kochsalz sind es nicht. Kochsalz ist in Wasser löslich, Sand nicht. Deshalb lassen sich die Stoffe nacheinander mit Magnet, Filtrieren und Eindampfen trennen.',
        merksatz: 'Ein Gemisch aus mehreren Stoffen trennt man schrittweise. Jedes Verfahren nutzt eine Stoffeigenschaft: Magnetismus (Magnettrennung), Löslichkeit (Lösen, Filtrieren, Eindampfen).'
      };
    }
  };

  K['K-04'] = {
    id: 'K-04', lab: 'classic', short: 'Öl/Wasser',
    title: 'Öl und Wasser trennen',
    problem: 'In Becherglas A sind 50 mL Speiseöl und 50 mL Wasser frisch durchmischt. Trenne die beiden Flüssigkeiten so, dass mindestens 40 mL Wasser und mindestens 40 mL Öl jeweils möglichst rein in einem eigenen Gefäß stehen.',
    material: 'Drei Bechergläser, Erlenmeyerkolben, Scheidetrichter mit Hahn im Stativ, Trichter mit Filterpapier, Ausguss',
    evaluate(e) {
      const fr = e.fractions().filter((f) => f.kind !== 'sep' && f.kind !== 'funnel');
      const water = fr.find((f) => f.c.water >= 40 && f.c.oil <= 2);
      const oil = fr.find((f) => f.c.oil >= 40 && f.c.water <= 2);
      const problems = [];
      const sep = e.state.sep;
      if (!water || !oil) {
        const mixed = fr.find((f) => f.c.water > 2 && f.c.oil > 2);
        const lostW = e.state.lost.spilled.water + e.state.lost.waste.water;
        const lostO = e.state.lost.spilled.oil + e.state.lost.waste.oil;
        if (mixed) problems.push({ code: 'mixed', text: `In ${mixed.label} sind noch Öl und Wasser zusammen (${fmt(mixed.c.water, 0)} mL Wasser, ${fmt(mixed.c.oil, 0)} mL Öl).` });
        if (lostW > 10 || lostO > 10) problems.push({ code: 'lost', text: `Es ist Flüssigkeit verloren gegangen (Wasser ${fmt(lostW, 0)} mL, Öl ${fmt(lostO, 0)} mL).` });
        if (sep && e.describe(sep.c).liquid > 5) problems.push({ code: 'stillInSep', text: 'Im Scheidetrichter ist noch Flüssigkeit. Beide Phasen sollen in eigenen Gefäßen stehen.' });
        if (!problems.length) problems.push({ code: 'notSeparated', text: 'Es gibt noch keine zwei Gefäße mit reinem Wasser und reinem Öl.' });
      }
      const success = !problems.length;
      return { success, problems, snapshot: success ? { water: r1(water.c.water), waterWhere: water.label, oil: r1(oil.c.oil), oilWhere: oil.label, oilInWater: r1(water.c.oil), waterInOil: r1(oil.c.water) } : null };
    },
    help(e) {
      const st = e.state; const fr = e.fractions();
      const sep = st.sep; const d = e.describe(sep.c);
      const rec = e.sepReceiver();
      if (sep.cock > 0 && !rec) return { small: 'Wohin läuft die Flüssigkeit aus dem Hahn?', concrete: 'Schließe sofort den Hahn und stelle ein leeres Becherglas unter den Scheidetrichter.' };
      const mixedOut = fr.find((f) => f.kind !== 'sep' && f.c.water > 2 && f.c.oil > 2);
      if (d.liquid < 5 && mixedOut) return { small: 'Mit welchem Gerät lassen sich zwei Flüssigkeitsschichten getrennt ablassen?', concrete: `Gieße den Inhalt von ${mixedOut.label} in den Scheidetrichter (Hahn geschlossen) und warte, bis sich zwei klare Schichten gebildet haben.` };
      if (d.liquid > 5 && d.emulsion > 4) return { small: 'Sind die beiden Schichten schon klar voneinander getrennt?', concrete: 'Warte mit geschlossenem Hahn, bis die trübe Mischzone zwischen den Schichten verschwunden ist.' };
      if (d.liquid > 5 && sep.c.water > 1 && !rec) return { small: 'Welche Schicht kommt zuerst aus dem Hahn?', concrete: 'Stelle ein leeres Becherglas unter den Scheidetrichter und öffne den Hahn.' };
      if (d.liquid > 5 && sep.c.water > 1) return { small: 'Welche Flüssigkeit ist unten – und wann musst du den Hahn schließen?', concrete: 'Öffne den Hahn (gegen Ende nur einen Spalt) und schließe ihn genau dann, wenn die Grenzschicht den Hahn erreicht.' };
      if (d.liquid > 5 && sep.c.water <= 1) return { small: 'Im Scheidetrichter ist nur noch Öl.', concrete: 'Stelle ein anderes leeres Becherglas unter den Hahn und lass das Öl ab (oder gieße es oben aus).' };
      if (mixedOut) return { small: 'Ein Gefäß enthält noch beides. Kannst du es noch einmal trennen?', concrete: `Gieße ${mixedOut.label} zurück in den Scheidetrichter und trenne erneut.` };
      return { small: 'Prüfe Wasser- und Ölfraktion.', concrete: 'Beide Gefäße sollen nur eine Flüssigkeit enthalten – dann „Ergebnis prüfen“.' };
    },
    questions(s) {
      return [
        { id: 'q1', type: 'choice', prompt: 'Welche Flüssigkeit bildete im Scheidetrichter die untere Schicht?', options: [['water', 'Wasser'], ['oil', 'Öl'], ['none', 'Es gab keine Schichten']], correct: 'water', wrong: 'Welche Flüssigkeit lief zuerst aus dem Hahn?' },
        { id: 'q2', type: 'choice', prompt: 'Warum liegt diese Flüssigkeit unten?', options: [['dense', 'Sie hat die größere Dichte.'], ['more', 'Es ist mehr davon vorhanden.'], ['heavy', 'Sie ist zähflüssiger.']], correct: 'dense', wrong: 'Gleiche Volumina von Öl und Wasser haben unterschiedliche Masse.' },
        { id: 'q3', type: 'number', prompt: `Wie viel Wasser hast du in ${s.waterWhere} aufgefangen?`, unit: 'mL', check: (v) => Math.abs(v - s.water) <= 3, wrong: 'Lies das Volumen an der Skala des Becherglases ab.' },
        { id: 'g1', type: 'gap', prompt: 'Ergänze die Fachbegriffe.', text: 'Öl und Wasser sind nicht {mischbar}. Die Flüssigkeit mit der größeren {dichte} bildet die untere Schicht. Im {scheide} lässt man die untere Phase durch den {hahn} ab.', gaps: [gap('mischbar'), gap('dichte'), gap('scheide'), gap('hahn')] }
      ];
    },
    theory: [
      'Öl und Wasser sind nicht mischbar. Nach dem Schütteln sind feine Öltröpfchen im Wasser verteilt (Emulsion) – in Ruhe vereinigen sie sich wieder.',
      'Öl hat eine kleinere Dichte (ca. 0,92 g/mL) als Wasser (1,0 g/mL) und schwimmt deshalb oben.',
      'Im Scheidetrichter lässt man die untere Phase durch den Hahn ab und schließt ihn, sobald die Grenzschicht den Hahn erreicht. Die obere Phase wird in ein zweites Gefäß abgelassen oder oben ausgegossen.',
      'Filtrieren trennt keine Flüssigkeiten: Beide laufen durch das Filterpapier.'
    ],
    notebook(s) {
      return {
        title: 'Trennung von Öl und Wasser',
        versuch: 'Das Öl-Wasser-Gemisch wird in einen Scheidetrichter gefüllt und stehen gelassen. Die untere Schicht wird durch den Hahn in ein Becherglas abgelassen, die obere in ein zweites.',
        beobachtung: `Zunächst ist das Gemisch trüb, dann bilden sich zwei Schichten: unten Wasser, oben das gelbliche Öl. Aufgefangen wurden ${fmt(s.water, 0)} mL Wasser und ${fmt(s.oil, 0)} mL Öl.`,
        erklaerung: 'Öl und Wasser sind nicht mischbar. Wasser hat die größere Dichte und bildet die untere Schicht. Deshalb läuft es zuerst aus dem Hahn.',
        merksatz: 'Nicht mischbare Flüssigkeiten unterschiedlicher Dichte trennt man mit dem Scheidetrichter: Die Flüssigkeit mit der größeren Dichte ist unten und wird zuerst abgelassen.'
      };
    }
  };

  K['K-05'] = {
    id: 'K-05', lab: 'classic', short: 'Hibiskustee',
    title: 'Hibiskustee durch Extraktion herstellen',
    problem: 'Stelle aus den getrockneten Hibiskusblüten einen kräftig roten Tee her (mindestens 60 mL) und trenne die Blütenreste vollständig ab.',
    material: 'Schale mit getrockneten Hibiskusblüten (4 g), drei Bechergläser, Spritzflasche (kaltes Wasser), Wasserkocher (heißes Wasser, ca. 90 °C), Heizplatte, Glasstab, Teesieb, Trichter mit Filterpapier, Ausguss',
    evaluate(e) {
      const fr = e.fractions();
      const st = e.state;
      const tea = fr.find((f) => nonDevice(f) && f.c.water >= 60 && f.d.dyeConc >= 0.11 && f.c.petals <= 0.05);
      const petalsSep = fr.filter((f) => f !== tea && f.c.petals > 0).reduce((s, f) => s + f.c.petals, 0);
      const problems = [];
      if (!tea) {
        const withPetals = fr.find((f) => nonDevice(f) && f.c.water >= 30 && f.c.petals > 0.05);
        const pale = fr.filter((f) => nonDevice(f) && f.c.water >= 60 && f.c.petals <= 0.05).sort((a, b) => b.d.dyeConc - a.d.dyeConc)[0];
        if (withPetals && withPetals.d.dyeConc < 0.11) problems.push({ code: 'weakExtract', text: `In ${withPetals.label} ist der Auszug noch blass – es sind erst wenige Farbstoffe aus den Blüten herausgelöst.` });
        else if (withPetals) problems.push({ code: 'petalsInTea', text: `Im Tee in ${withPetals.label} schwimmen noch Blütenreste.` });
        else if (pale) problems.push({ code: 'weak', text: `Der Tee in ${pale.label} ist zu blass – es wurden zu wenig Farbstoffe herausgelöst.` });
        else problems.push({ code: 'noTea', text: 'Es gibt noch kein Gefäß mit mindestens 60 mL Tee ohne Blütenreste.' });
      }
      if (tea && petalsSep < 3) problems.push({ code: 'petalsLost', text: 'Die Blütenreste wurden nicht abgetrennt aufgefangen.' });
      const success = !problems.length;
      return { success, problems, snapshot: success ? { vol: r1(tea.c.water), where: tea.label, conc: Math.round(tea.d.dyeConc * 1000) / 1000, hot: !!st.flags.hotWater, maxT: Math.round(st.flags.maxExtractT || 20) } : null };
    },
    help(e) {
      const st = e.state; const fr = e.fractions();
      const P = fr.find((f) => f.id === 'P');
      const ext = fr.find((f) => nonDevice(f) && f.c.petals > 0.5 && f.c.water > 10);
      if (P && P.c.petals > 1 && !ext) return { small: 'Wie bekommst du die Farbstoffe aus den Blüten ins Wasser?', concrete: 'Gib die Blüten in ein Becherglas und gieße Wasser dazu (heißes Wasser aus dem Wasserkocher wirkt schneller). Dann umrühren und warten.' };
      if (ext && ext.d.dyeConc < 0.11) {
        const cold = ext.c.temp < 50;
        return { small: cold ? 'Wie könntest du das Herauslösen beschleunigen?' : 'Das Herauslösen braucht noch etwas Zeit.', concrete: cold ? 'Rühre um und warte länger (Zeitraffer) – oder erwärme das Becherglas auf der Heizplatte bzw. verwende heißes Wasser.' : 'Rühre gelegentlich um und warte (Zeitraffer), bis der Auszug kräftig rot ist.' };
      }
      if (ext && ext.d.dyeConc >= 0.11) {
        if (st.sieve && !st.sieve.on) return { small: 'Wie hältst du die Blüten zurück, während der Tee abläuft?', concrete: 'Lege das Teesieb auf ein leeres Becherglas und gieße den Auszug hindurch (oder filtriere mit Filterpapier).' };
        return { small: 'Der Auszug ist kräftig. Was ist noch zu tun?', concrete: `Gieße ${ext.label} durch das Teesieb (oder den Filter) in ein leeres Becherglas.` };
      }
      const teaPetals = fr.find((f) => nonDevice(f) && f.c.water > 30 && f.c.petals > 0.05);
      if (teaPetals) return { small: 'Im Tee sind noch Blütenreste.', concrete: `Gieße ${teaPetals.label} noch einmal durch Teesieb oder Filter in ein leeres Becherglas.` };
      const water = fr.filter((f) => nonDevice(f)).reduce((s, f) => s + f.c.water, 0);
      if (water < 60) return { small: 'Reicht die Teemenge?', concrete: 'Verwende genug Wasser für die Extraktion (z. B. 100 mL) – die Blüten saugen einen Teil auf.' };
      return { small: 'Prüfe Farbe und Menge des Tees.', concrete: 'Wähle das Gefäß mit dem Tee aus und prüfe dann das Ergebnis.' };
    },
    questions(s) {
      return [
        { id: 'q1', type: 'choice', prompt: 'Wie veränderte sich das Wasser bei den Blüten mit der Zeit?', options: [['redder', 'Es wurde nach und nach immer kräftiger rot.'], ['instant', 'Es war sofort kräftig rot.'], ['none', 'Es blieb farblos.']], correct: 'redder', wrong: 'Beobachte, wie sich die Farbe im Laufe der Zeit entwickelt.' },
        { id: 'q2', type: 'multi', prompt: 'Was beschleunigt das Herauslösen der Farbstoffe? (alle zutreffenden wählen)', options: [['hot', 'Heißes Wasser'], ['stir', 'Umrühren'], ['filter', 'Filtrieren'], ['cold', 'Eiskaltes Wasser']], correct: ['hot', 'stir'], wrong: 'Denke an die Wirkung von Temperatur und Bewegung.' },
        { id: 'q3', type: 'choice', prompt: 'Was ist der fertige Hibiskustee?', options: [['mix', 'Ein Stoffgemisch: Wasser mit vielen gelösten Stoffen'], ['pure', 'Ein Reinstoff (reiner Farbstoff)'], ['water', 'Reines Wasser mit roter Farbe']], correct: 'mix', wrong: 'Auch nach dem Filtrieren sind im Tee Wasser und viele gelöste Stoffe.' },
        { id: 'g1', type: 'gap', prompt: 'Ergänze die Fachbegriffe.', text: 'Beim {extrahieren} werden lösliche Stoffe mit einem {loesungsmittel} (hier Wasser) aus den Blüten herausgelöst. Die Blütenreste werden durch {filtrieren} oder Sieben abgetrennt. Der Tee ist ein {stoffgemisch}.', gaps: [gap('extrahieren'), gap('loesungsmittel'), gap('filtrieren'), gap('stoffgemisch')] }
      ];
    },
    theory: [
      'Die Blüten enthalten wasserlösliche Farb-, Säure- und Aromastoffe. Wasser löst sie heraus – das ist eine Extraktion.',
      'Heißes Wasser und Umrühren beschleunigen das Herauslösen; mit kaltem Wasser dauert es deutlich länger.',
      'Sieb oder Filter halten die festen Blütenreste zurück. Die gelösten Farbstoffe laufen hindurch – sie lassen sich so nicht abtrennen.',
      'Der Tee bleibt ein Stoffgemisch aus Wasser und vielen gelösten Stoffen. Filtrieren macht ihn nicht zu einem Reinstoff.'
    ],
    notebook(s) {
      return {
        title: 'Extraktion: Hibiskustee',
        versuch: `Getrocknete Hibiskusblüten werden mit ${s.hot || s.maxT >= 50 ? 'heißem' : 'kaltem'} Wasser übergossen, umgerührt und einige Zeit stehen gelassen. Anschließend werden die Blütenreste mit einem Sieb bzw. Filter abgetrennt.`,
        beobachtung: `Das Wasser färbt sich nach und nach immer kräftiger rot. Mit heißem Wasser geht es schneller als mit kaltem. Im Sieb bzw. Filter bleiben die Blütenreste zurück, der rote Tee (ca. ${fmt(s.vol, 0)} mL) läuft hindurch.`,
        erklaerung: 'Wasser löst die löslichen Farb- und Aromastoffe aus den Blüten heraus (Extraktion). Die unlöslichen Blütenreste werden durch Sieben oder Filtrieren abgetrennt. Die gelösten Stoffe bleiben im Tee.',
        merksatz: 'Beim Extrahieren werden lösliche Stoffe mit einem Lösungsmittel aus einem Stoffgemisch herausgelöst. Der Tee ist ein Stoffgemisch, kein Reinstoff.'
      };
    }
  };

  // ------------------------------------------------------ Chromatographie
  const SBY = chroma.SAMPLE_BY_ID;
  /** Gültige Bahnen aller abgelegten Chromatogramme: [{snap, lane, sampleId, zones}] */
  function validLanes(e) {
    const out = [];
    for (const snap of e.state.archive) {
      if (!snap.quality.valid) continue;
      snap.lanes.forEach((l, i) => { if (l && l.n <= 2) out.push({ snap, lane: i, sampleId: l.sampleId, zones: snap.zones[i] }); });
    }
    return out;
  }
  const movingZones = (zs) => zs.filter((z) => !z.atStart);
  const solventName = (s) => (s === 'water' ? 'Wasser' : 'Ethanol-Wasser');
  const runOf = (snap) => snap.flow; // Frontstrecke über der Startlinie

  function chromaIssues(e) {
    const probs = [];
    const arch = e.state.archive;
    if (!arch.length) {
      probs.push({ code: 'noArchive', text: 'Es liegt noch kein entwickeltes Chromatogramm im Vergleich. Entwickle einen Streifen, nimm ihn heraus und lege ihn ab.' });
      return probs;
    }
    const texts = {
      penLine: 'Startlinie mit Kugelschreiber: Die Tinte selbst wandert mit und stört das Chromatogramm.',
      submerged: 'Die Startlinie lag unter dem Flüssigkeitsspiegel – die Proben haben sich im Laufmittel gelöst.',
      short: 'Die Entwicklung war zu kurz – die Laufstrecke reicht nicht für eine deutliche Trennung.',
      noSolvent: 'Der Streifen wurde ohne Laufmittel entwickelt.',
      noSample: 'Auf dem Streifen war keine Probe.',
      overloaded: 'Mindestens ein Fleck wurde zu oft aufgetragen – die Zonen sind breit und verschmiert.'
    };
    for (const a of arch) {
      for (const i of a.quality.issues) if (texts[i] && !probs.some((p) => p.code === i)) probs.push({ code: i, text: `${a.id}: ${texts[i]}` });
    }
    return probs;
  }

  const C = {};
  C['C-1'] = {
    id: 'C-1', lab: 'chroma', short: 'Farbstoffe im Stift',
    title: 'Welche Stifte enthalten mehrere Farbstoffe?',
    problem: 'Untersuche mit Papierchromatographie mindestens den schwarzen und den grünen Filzstift sowie einen der beiden Referenzfarbstoffe (blau oder gelb). Finde heraus, welche Proben aus mehreren Farbstoffen bestehen.',
    material: 'Chromatographiepapier, Bleistift, Kugelschreiber, sieben Proben, zwei Laufmittel (Wasser, Ethanol-Wasser 1:1), Entwicklungskammer mit Deckel, Lineal (Expertenmodus)',
    evaluate(e) {
      const lanes = validLanes(e);
      const has = (id) => lanes.find((l) => l.sampleId === id);
      const ref = has('blau') || has('gelb');
      const problems = [];
      if (!has('schwarz') || !has('gruen') || !ref) {
        problems.push(...chromaIssues(e));
        const miss = [];
        if (!has('schwarz')) miss.push('schwarzer Filzstift');
        if (!has('gruen')) miss.push('grüner Filzstift');
        if (!ref) miss.push('ein Referenzfarbstoff');
        problems.push({ code: 'missing', text: 'Noch kein aussagekräftiges Chromatogramm für: ' + miss.join(', ') + '.' });
      }
      const success = !problems.length;
      let snapshot = null;
      if (success) {
        const pick = [has('schwarz'), has('gruen'), ref].concat(lanes.filter((l) => !['schwarz', 'gruen', ref.sampleId].includes(l.sampleId)).filter((l, i, a) => a.findIndex((x) => x.sampleId === l.sampleId) === i));
        snapshot = { items: pick.map((l) => ({ sampleId: l.sampleId, name: SBY[l.sampleId].short, chrom: l.snap.id, solvent: l.snap.solvent, count: l.zones.length, moving: movingZones(l.zones).length, rf: l.snap.frontMarked != null && !l.snap.frontAtTop ? l.zones.map((z) => Math.round(z.s / (l.snap.frontMarked - l.snap.line.y) * 100) / 100) : null })), ref: ref.sampleId };
      }
      return { success, problems, snapshot };
    },
    help(e) { return chromaHelp(e, ['schwarz', 'gruen', 'blau']); },
    questions(s) {
      const qs = [];
      s.items.slice(0, 3).forEach((it, i) => {
        qs.push({ id: 'z' + i, type: 'number', prompt: `Wie viele Farbzonen zeigt „${it.name}“ in deinem Chromatogramm ${it.chrom} (${solventName(it.solvent)})?`, unit: '', check: (v) => v === it.count, wrong: 'Zähle die getrennten Farbflecken dieser Bahn – auch einen Fleck, der auf der Startlinie geblieben ist.' });
      });
      const opts = s.items.map((it) => [it.sampleId, it.name]);
      qs.push({ id: 'mix', type: 'multi', prompt: 'Welche der untersuchten Proben bestehen nach deinem Chromatogramm sicher aus mehreren Farbstoffen?', options: opts, correct: s.items.filter((it) => it.count >= 2).map((it) => it.sampleId), wrong: 'Eine Probe mit mehreren getrennten Zonen enthält mehrere Farbstoffe.' });
      qs.push({ id: 'pure', type: 'choice', prompt: 'Eine Probe zeigt nur eine einzige Zone. Was folgt daraus?', options: [['maybe', 'Sie kann ein Reinstoff sein – sicher ist das nicht, denn zwei Farbstoffe können gleich weit wandern.'], ['sure', 'Sie ist sicher ein Reinstoff.'], ['mix', 'Sie ist sicher ein Gemisch.']], correct: 'maybe', wrong: 'Denke daran, dass zwei Farbstoffe zufällig gleich weit wandern könnten.' });
      qs.push({ id: 'g1', type: 'gap', prompt: 'Ergänze die Fachbegriffe.', text: 'Eine Filzstiftfarbe mit mehreren Zonen ist ein {gemischFarbe}. Das Laufmittel ist die {mobil} Phase, das Papier die {stationaer} Phase. Ein Farbstoff wandert nur, wenn er sich im {laufmittel} löst. Farbstoffe, die stärker am Papier haften ({adsorption}), wandern langsamer.', gaps: [gap('gemischFarbe'), gap('mobil'), gap('stationaer'), gap('laufmittel'), gap('adsorption')] });
      const rfItem = s.items.find((it) => it.rf && it.rf.length && it.count === 1 && (it.sampleId === 'blau' || it.sampleId === 'gelb'));
      if (rfItem) qs.push({ id: 'rf', type: 'number', expert: true, optional: true, prompt: `Expertenmodus: Bestimme den Rf-Wert von „${rfItem.name}“ in ${rfItem.chrom} (Laufstrecke des Farbstoffs ÷ Laufstrecke der Front).`, unit: '', check: (v) => Math.abs(v - rfItem.rf[0]) <= 0.03, wrong: 'Miss beide Strecken ab der Startlinie (Lineal im Expertenmodus) und teile sie.' });
      return qs;
    },
    theory: [
      'Das Laufmittel steigt im Papier nach oben (mobile Phase). Das Papier bleibt an Ort und Stelle (stationäre Phase).',
      'Ein Farbstoff wandert nur, wenn er sich im Laufmittel löst. Gleichzeitig lagert er sich immer wieder an der Papieroberfläche an (Adsorption).',
      'Je besser sich ein Farbstoff im Laufmittel löst und je schwächer er am Papier haftet, desto weiter wandert er. So trennen sich die Bestandteile einer Farbe in einzelne Zonen.',
      'Eine einzelne Zone ist ein Hinweis auf einen Reinstoff, aber kein Beweis: Zwei Farbstoffe können zufällig gleich weit wandern. Ein zweites Laufmittel kann das klären.'
    ],
    notebook(s) {
      const lines = s.items.map((it) => `${it.name}: ${it.count} Zone${it.count === 1 ? '' : 'n'}`).join('; ');
      return {
        title: 'Papierchromatographie von Filzstiftfarben',
        versuch: 'Auf einen Streifen Chromatographiepapier wird mit Bleistift eine Startlinie gezeichnet. Darauf werden kleine Punkte der Proben aufgetragen. Der Streifen wird so in die Kammer mit wenig Laufmittel gestellt, dass die Startlinie über dem Flüssigkeitsspiegel liegt.',
        beobachtung: `Das Laufmittel steigt im Papier nach oben. Die Farbpunkte wandern mit und trennen sich teilweise in mehrere Farbzonen auf (${lines}).`,
        erklaerung: 'Das Laufmittel ist die mobile Phase, das Papier die stationäre Phase. Die Farbstoffe lösen sich unterschiedlich gut im Laufmittel und werden unterschiedlich stark am Papier adsorbiert. Deshalb wandern sie verschieden weit.',
        merksatz: 'Mit der Chromatographie trennt man Stoffgemische. Mehrere Zonen zeigen ein Stoffgemisch an. Eine einzelne Zone weist auf einen Reinstoff hin, ist aber kein sicherer Beweis.'
      };
    }
  };

  C['C-2'] = {
    id: 'C-2', lab: 'chroma', short: 'Gemeinsamer Farbstoff',
    title: 'Haben Grün und Violett einen gemeinsamen Farbstoff?',
    problem: 'Prüfe mit einem Chromatogramm, ob der grüne und der violette Filzstift einen gemeinsamen Farbstoff enthalten – und welcher es ist.',
    material: 'wie oben; Tipp: mehrere Proben nebeneinander auf einem Streifen sind gut vergleichbar',
    evaluate(e) {
      const lanes = validLanes(e);
      const problems = [];
      let best = null;
      for (const snap of e.state.archive.filter((a) => a.quality.valid)) {
        const g = lanes.find((l) => l.snap === snap && l.sampleId === 'gruen');
        const v = lanes.find((l) => l.snap === snap && l.sampleId === 'violett');
        if (g && v) { best = { snap, g, v }; if (movingZones(g.zones).length >= 2 && movingZones(v.zones).length >= 2) break; }
      }
      if (!best) {
        problems.push(...chromaIssues(e));
        problems.push({ code: 'missingGV', text: 'Es gibt noch kein aussagekräftiges Chromatogramm, auf dem Grün und Violett nebeneinander entwickelt wurden.' });
      } else if (movingZones(best.g.zones).length < 2 || movingZones(best.v.zones).length < 2) {
        problems.push({ code: 'unresolved', text: `In ${best.snap.id} (${solventName(best.snap.solvent)}) sind die Farbstoffe von Grün oder Violett nicht in getrennte Zonen aufgeteilt. So lässt sich kein gemeinsamer Farbstoff sicher erkennen.` });
      }
      const success = !problems.length;
      let snapshot = null;
      if (success) {
        const run = runOf(best.snap);
        const common = [];
        for (const zg of movingZones(best.g.zones)) for (const zv of movingZones(best.v.zones)) if (Math.abs(zg.s - zv.s) / run < 0.04) common.push(zg.color);
        snapshot = { chrom: best.snap.id, solvent: best.snap.solvent, common, gCount: best.g.zones.length, vCount: best.v.zones.length, withRef: lanes.some((l) => l.snap === best.snap && l.sampleId === 'blau') };
      }
      return { success, problems, snapshot };
    },
    help(e) { return chromaHelp(e, ['gruen', 'violett', 'blau']); },
    questions(s) {
      const correct = s.common.includes('blau') ? 'blau' : s.common[0] || 'none';
      return [
        { id: 'q1', type: 'choice', prompt: `Welche Farbzone findest du in ${s.chrom} sowohl bei Grün als auch bei Violett auf gleicher Höhe?`, options: [['gelb', 'eine gelbe Zone'], ['rot', 'eine rote Zone'], ['blau', 'eine blaue Zone'], ['none', 'keine']], correct, wrong: 'Vergleiche die Höhen der Zonen beider Bahnen.' },
        { id: 'q2', type: 'choice', prompt: 'Woran erkennst du im Chromatogramm einen gemeinsamen Farbstoff?', options: [['height', 'Gleiche Farbe auf gleicher Höhe (gleiche Laufstrecke) im selben Laufmittel'], ['color', 'Die Proben haben beim Auftragen dieselbe Farbe'], ['size', 'Die Flecken sind gleich groß']], correct: 'height', wrong: 'Entscheidend ist, wie weit ein Farbstoff im selben Laufmittel wandert.' },
        { id: 'g1', type: 'gap', prompt: 'Ergänze.', text: 'Grün und Violett enthalten denselben {blauen} Farbstoff, denn im gleichen Laufmittel liegen die Zonen auf gleicher {hoehe}.', gaps: [gap('blauen'), gap('hoehe')] }
      ];
    },
    theory: [
      'Gleiche Stoffe wandern im gleichen Laufmittel auf gleichem Papier gleich weit.',
      'Grün entsteht hier aus einem gelben und einem blauen Farbstoff, Violett aus einem roten und einem blauen. Die blauen Zonen liegen auf gleicher Höhe – wie beim blauen Referenzfarbstoff.',
      'Ein Vergleich mit einem bekannten Referenzstoff auf demselben Streifen macht die Zuordnung sicherer.',
      'Im Ethanol-Wasser-Gemisch laufen Gelb und Blau fast gleich weit – Grün erscheint dann als eine einzige Zone. Das zeigt, warum die Wahl des Laufmittels wichtig ist.'
    ],
    notebook(s) {
      return {
        title: 'Gemeinsamer Farbstoff in zwei Filzstiften',
        versuch: `Grüner und violetter Filzstift${s.withRef ? ' sowie der blaue Referenzfarbstoff' : ''} werden nebeneinander auf dieselbe Startlinie aufgetragen und mit ${solventName(s.solvent)} entwickelt.`,
        beobachtung: 'Grün trennt sich in eine gelbe und eine blaue Zone, Violett in eine rote und eine blaue Zone. Die beiden blauen Zonen liegen auf gleicher Höhe.',
        erklaerung: 'Derselbe Stoff wandert im gleichen Laufmittel gleich weit. Die blauen Zonen gehören also zum selben blauen Farbstoff.',
        merksatz: 'Stoffe lassen sich durch Vergleich der Laufstrecken mit Referenzstoffen im gleichen Chromatogramm zuordnen.'
      };
    }
  };

  C['C-3'] = {
    id: 'C-3', lab: 'chroma', short: 'Wasserfester Stift',
    title: 'Was geschieht mit dem wasserfesten Stift?',
    problem: 'Untersuche den wasserfesten schwarzen Stift einmal mit Wasser und einmal mit dem Ethanol-Wasser-Gemisch als Laufmittel und vergleiche.',
    material: 'wie oben; zwei Streifen, zwei Laufmittel (Kammer zwischendurch leeren)',
    evaluate(e) {
      const lanes = validLanes(e).filter((l) => l.sampleId === 'wasserfest');
      const w = lanes.find((l) => l.snap.solvent === 'water');
      const et = lanes.find((l) => l.snap.solvent === 'etoh');
      const problems = [];
      if (!w || !et) {
        problems.push(...chromaIssues(e));
        problems.push({ code: 'missingW', text: `Es fehlt noch ein aussagekräftiges Chromatogramm des wasserfesten Stifts mit ${!w && !et ? 'Wasser und mit Ethanol-Wasser' : !w ? 'Wasser' : 'Ethanol-Wasser'}.` });
      }
      const success = !problems.length;
      return { success, problems, snapshot: success ? { wChrom: w.snap.id, eChrom: et.snap.id, wMoves: movingZones(w.zones).length > 0, eMoves: movingZones(et.zones).length > 0, eStays: et.zones.some((z) => z.atStart) } : null };
    },
    help(e) { return chromaHelp(e, ['wasserfest']); },
    questions(s) {
      return [
        { id: 'q1', type: 'choice', prompt: `Was beobachtest du beim wasserfesten Stift mit Wasser (${s.wChrom})?`, options: [['stays', 'Der Fleck bleibt auf der Startlinie.'], ['moves', 'Der Fleck wandert mit der Front nach oben.'], ['split', 'Er trennt sich in mehrere Zonen.']], correct: s.wMoves ? 'moves' : 'stays', wrong: 'Sieh dir die Bahn im Chromatogramm mit Wasser an.' },
        { id: 'q2', type: 'choice', prompt: `Und mit dem Ethanol-Wasser-Gemisch (${s.eChrom})?`, options: [['part', 'Ein Teil wandert nach oben, ein dunkler Rest bleibt auf der Startlinie.'], ['stays', 'Alles bleibt auf der Startlinie.'], ['all', 'Alles wandert vollständig mit der Front.']], correct: s.eMoves && s.eStays ? 'part' : s.eMoves ? 'all' : 'stays', wrong: 'Vergleiche Startlinie und obere Zone in diesem Chromatogramm.' },
        { id: 'g1', type: 'gap', prompt: 'Ergänze.', text: 'Der Farbstoff des wasserfesten Stifts ist in Wasser {unloeslichW}, im Ethanol-Wasser-Gemisch teilweise {loeslichE}. Ein Farbstoff wandert nur, wenn er sich im {laufmittel} löst.', gaps: [gap('unloeslichW'), gap('loeslichE'), gap('laufmittel')] }
      ];
    },
    theory: [
      'Wasserfeste Stifte enthalten Farbstoffe, die sich nicht in Wasser lösen – deshalb verwischt die Schrift nicht.',
      'Ohne Löslichkeit im Laufmittel wandert ein Farbstoff nicht: Er bleibt auf der Startlinie.',
      'Im Ethanol-Wasser-Gemisch löst sich ein Teil der Farbstoffe und wandert. Ein unlöslicher Rest (Pigment) bleibt liegen.',
      'Das richtige Laufmittel hängt also von den Stoffen ab, die man trennen will. Ethanol ist leicht entzündlich – keine offenen Flammen.'
    ],
    notebook() {
      return {
        title: 'Wasserfester Stift in zwei Laufmitteln',
        versuch: 'Der wasserfeste Stift wird auf zwei Streifen aufgetragen. Ein Streifen wird mit Wasser, der andere mit einem Ethanol-Wasser-Gemisch (1:1) entwickelt.',
        beobachtung: 'Mit Wasser bleibt der Fleck auf der Startlinie. Mit dem Ethanol-Wasser-Gemisch wandert ein blauschwarzer Teil nach oben, ein dunkler Rest bleibt auf der Startlinie.',
        erklaerung: 'Der Farbstoff ist in Wasser unlöslich und wird deshalb nicht von der mobilen Phase mitgenommen. Im Ethanol-Wasser-Gemisch ist ein Teil löslich und wandert.',
        merksatz: 'Ein Stoff wandert in der Chromatographie nur, wenn er im Laufmittel löslich ist. Die Wahl des Laufmittels entscheidet über die Trennung.'
      };
    }
  };

  function chromaHelp(e, wanted) {
    const st = e.state;
    const p = st.paper;
    const ch = st.chamber;
    if (p.state === 'chamber') {
      if (p.submerged) return { small: 'Wo liegen die Probenpunkte im Vergleich zum Flüssigkeitsspiegel?', concrete: 'Dieser Streifen ist unbrauchbar. Nimm ihn heraus, nimm einen neuen Streifen und fülle nur wenig Laufmittel ein (Spiegel unter der Startlinie).' };
      if (!ch.solvent) return { small: 'Was soll das Papier hochsteigen?', concrete: 'Nimm den Streifen heraus und fülle zuerst Laufmittel in die Kammer.' };
      if (p.frontAtTop) return { small: 'Hast du die Front im Blick?', concrete: 'Nimm den Streifen jetzt heraus. Die Front ist am Rand – Rf-Werte lassen sich nicht mehr bestimmen, die Farbzonen aber schon beobachten.' };
      if (p.line && p.front - p.line.y < chroma.MIN_RUN) return { small: 'Ist das Laufmittel schon weit genug gestiegen?', concrete: 'Warte (Zeitraffer), bis die Front etwa 1–2 cm unter dem oberen Rand ist, und nimm den Streifen dann heraus.' };
      return { small: 'Die Front ist weit gestiegen.', concrete: 'Nimm den Streifen heraus und markiere sofort die Laufmittelfront mit Bleistift.' };
    }
    if (p.state === 'removed') {
      if (p.frontMarked == null && !p.frontAtTop && st.time - p.removedAt < chroma.FRONT_VISIBLE) return { small: 'Die Front trocknet bald.', concrete: 'Markiere jetzt die Laufmittelfront und lege das Chromatogramm danach zum Vergleich ab.' };
      if (!st.archive.some((a) => a.n === p.n)) return { small: 'Willst du dieses Ergebnis vergleichen?', concrete: 'Lege das Chromatogramm zum Vergleich ab („Ablegen“) und prüfe dann das Ergebnis.' };
      const q = chroma.quality(p);
      if (!q.valid) return chromaFixHelp(q.issues);
    }
    if (p.state === 'bench') {
      if (!p.line) return { small: 'Woran erkennst du später, wo die Proben gestartet sind?', concrete: 'Zeichne mit Bleistift (nicht Kugelschreiber!) eine Startlinie etwa 1,5 cm über der Unterkante.' };
      if (p.line.tool === 'pen') return { small: 'Womit hast du die Startlinie gezeichnet?', concrete: 'Kugelschreibertinte kann mitwandern. Nimm einen neuen Streifen und zeichne die Startlinie mit Bleistift.' };
      const lanes = p.lanes.filter(Boolean).map((l) => l.sampleId);
      const missing = wanted.filter((w) => !lanes.includes(w) && !validLanes(e).some((v) => v.sampleId === w));
      if (p.lanes.some((l) => l && l.n >= 3)) return { small: 'Wie groß sind deine Probenflecken?', concrete: 'Zu große Flecken verschmieren. Nimm einen neuen Streifen und tupfe jede Probe nur ein- bis zweimal kurz auf.' };
      if (missing.length && lanes.length < 3) return { small: 'Welche Proben brauchst du für die Aufgabe?', concrete: `Trage noch auf: ${missing.map((m) => SBY[m].short).join(', ')} (jeweils ein kleiner Punkt auf der Startlinie).` };
      if (!ch.solvent) return { small: 'Was braucht die Kammer, bevor der Streifen hinein kommt?', concrete: `Fülle wenig Laufmittel ein (Füllhöhe unter ${core.fmt(p.line.y, 1)} cm – also „wenig“), am besten ${wanted.includes('wasserfest') ? 'erst Wasser, später Ethanol-Wasser' : 'Wasser'}.` };
      if (ch.level >= p.line.y - 0.05) return { small: 'Vergleiche die Füllhöhe mit der Höhe deiner Startlinie.', concrete: 'Der Flüssigkeitsspiegel würde über der Startlinie stehen. Leere die Kammer und fülle weniger Laufmittel ein.' };
      if (!ch.lid) return { small: 'Was verhindert, dass das Laufmittel verdunstet?', concrete: 'Lege den Deckel auf die Kammer und stelle dann den Streifen hinein.' };
      return { small: 'Alles bereit?', concrete: 'Stelle den Streifen in die Kammer und beobachte, wie das Laufmittel steigt.' };
    }
    const issues = chromaIssues(e);
    if (issues.length) return chromaFixHelp(issues.map((i) => i.code));
    return { small: 'Hast du alle nötigen Proben chromatographiert?', concrete: `Benötigt: ${wanted.map((w) => SBY[w].short).join(', ')}. Nimm einen neuen Streifen.` };
  }
  function chromaFixHelp(codes) {
    if (codes.includes('submerged')) return { small: 'Wo lag die Startlinie im Vergleich zum Flüssigkeitsspiegel?', concrete: 'Nimm einen neuen Streifen und fülle nur wenig Laufmittel ein, damit die Startlinie darüber liegt.' };
    if (codes.includes('penLine')) return { small: 'Welches Schreibgerät wandert selbst nicht mit?', concrete: 'Zeichne die Startlinie auf einem neuen Streifen mit Bleistift.' };
    if (codes.includes('short')) return { small: 'Wie weit ist das Laufmittel gestiegen?', concrete: 'Lass den nächsten Streifen länger in der Kammer (mit Deckel), bis die Front nahe am oberen Rand ist.' };
    if (codes.includes('overloaded')) return { small: 'Wie groß waren die Probenflecken?', concrete: 'Trage jede Probe nur ein- bis zweimal auf.' };
    return { small: 'Prüfe deine Chromatogramme im Vergleich.', concrete: 'Nimm einen neuen Streifen und wiederhole den Versuch sorgfältig.' };
  }

  // ------------------------------------------------------------ Destillation
  const D = {};
  D['D-1'] = {
    id: 'D-1', lab: 'distill', short: 'Ethanol/Wasser',
    title: 'Ethanol aus einem Ethanol-Wasser-Gemisch anreichern',
    problem: 'Baue eine Destillationsapparatur auf und destilliere das Ethanol-Wasser-Gemisch (30 % Ethanol). Sammle mindestens 5 mL Destillat, verfolge die Dampftemperatur und weise mit einer Brennprobe nach, dass das Destillat brennbar ist.',
    material: 'Heizpilz, Rundkolben, Siedesteine, Destillationsaufsatz, Thermometer, Liebigkühler, Kühlwasserschläuche, Vorstoß, Vorlage, Klemmen, Stopfen, Pipette, Porzellanschale, Stabfeuerzeug',
    evaluate(e) {
      const st = e.state;
      const problems = [];
      const dist = e.distillate();
      if (st.safety) problems.push({ code: 'safety', text: 'Der Versuch ist wegen einer Sicherheitsunterbrechung angehalten.' });
      if (dist.vol < 5) problems.push({ code: 'littleDist', text: `Bisher sind ${fmt(dist.vol, 1)} mL Destillat gesammelt – es sollen mindestens 5 mL sein.` });
      const good = st.distTotal > 0 ? st.distGood / st.distTotal : 0;
      if (dist.vol >= 1 && (good < 0.8 || !st.readings)) problems.push({ code: 'thermoWrong', text: st.parts.thermo ? 'Das Thermometer saß während der Destillation nicht im Dampfweg auf Höhe des seitlichen Abgangs – die gemessene Temperatur ist nicht die Dampftemperatur.' : 'Ohne Thermometer im Dampfweg wurde keine Dampftemperatur gemessen.' });
      const goodBurn = st.burns.find((b) => b.result === 'burns' && b.from !== 'flask');
      if (!goodBurn) {
        const last = st.burns[st.burns.length - 1];
        if (last && last.from === 'flask') problems.push({ code: 'burnFlask', text: 'Die Brennprobe stammte aus dem Kolben, nicht aus dem Destillat.' });
        else if (last) problems.push({ code: 'burnFailed', text: `Die letzte Brennprobe (${fmt(last.pct, 0)} % Ethanol) hat nicht dauerhaft gebrannt.` });
        else problems.push({ code: 'noBurn', text: 'Es fehlt noch die Brennprobe mit einer kleinen Destillatprobe.' });
      }
      const success = !problems.length;
      return {
        success, problems,
        snapshot: success ? { vol: r1(dist.vol), pct: Math.round(dist.pct), firstT: st.firstDrop && st.firstDrop.reading != null ? r1(st.firstDrop.reading) : null, tMin: r1(st.readings.min), tMax: r1(st.readings.max), rise: r1(st.readings.max - st.readings.min), burnPct: Math.round(goodBurn.pct), liquidPct: Math.round(e.liquidPct()) } : null
      };
    },
    help(e) {
      const st = e.state; const P = st.parts;
      if (!P.heater) return { small: 'Womit wird der Kolben erhitzt?', concrete: 'Stelle den Heizpilz auf und setze den Rundkolben hinein.' };
      if (!P.flask) return { small: 'Worin wird das Gemisch erhitzt?', concrete: 'Setze den Rundkolben in den Heizpilz.' };
      if (st.liquid.E + st.liquid.W <= 0) return { small: 'Der Kolben ist noch leer.', concrete: 'Fülle 100 mL des Gemischs ein (vor dem Aufsetzen des Aufsatzes).' };
      if (!P.chips) return { small: 'Wie verhinderst du, dass das Gemisch plötzlich aufschäumt?', concrete: st.liquid.T > 50 ? 'Lass den Kolben unter 50 °C abkühlen und gib dann Siedesteine hinein.' : 'Gib Siedesteine in den Kolben – vor dem Erhitzen.' };
      if (!P.head) return { small: 'Wohin soll der Dampf aus dem Kolben?', concrete: 'Setze den Destillationsaufsatz auf den Kolben.' };
      if (P.thermo !== 'vapor') return { small: P.thermo ? 'Welche Temperatur willst du messen – die der Flüssigkeit oder die des Dampfes, der in den Kühler strömt?' : 'Womit misst du die Dampftemperatur?', concrete: 'Setze das Thermometer so ein, dass die Kugel auf Höhe des seitlichen Abgangs im Dampfweg sitzt (Heizung dazu kurz ausschalten).' };
      if (!P.condenser) return { small: 'Wie wird der Dampf wieder flüssig?', concrete: 'Schließe den Liebigkühler an den seitlichen Abgang an.' };
      if (!P.hoses) return { small: 'Was kühlt den Kühler?', concrete: 'Schließe die Kühlwasserschläuche an: Zulauf unten, Ablauf oben.' };
      if (P.hoses === 'reversed') return { small: 'Füllt sich der Kühlmantel vollständig mit Wasser?', concrete: 'Drehe das Wasser ab und schließe die Schläuche um: Zulauf unten, Ablauf oben – dann ist der Mantel ganz gefüllt.' };
      if (P.stopper) return { small: 'Kann der Druck in der Apparatur entweichen?', concrete: 'Nimm den Stopfen von der Vorlage. Eine Destillationsapparatur muss am Ende offen sein.' };
      if (!P.receiver) return { small: 'Wo landet das Destillat?', concrete: 'Stelle eine Vorlage (Erlenmeyerkolben) unter das Ende des Kühlers bzw. den Vorstoß.' };
      if (!P.adapter) return { small: 'Tropft das Destillat sicher in die Vorlage?', concrete: 'Setze den Vorstoß an das Kühlerende.' };
      if (!P.clamps) return { small: 'Ist die Apparatur gesichert?', concrete: 'Ziehe die Klemmen am Stativ fest, damit die Schliffverbindungen dicht und stabil sind.' };
      if (st.cooling < 2) return { small: 'Reicht die Kühlung?', concrete: 'Drehe das Kühlwasser auf mittleren Durchfluss.' };
      if (st.heater === 0 && e.distillate().vol < 5) return { small: 'Was fehlt, damit etwas verdampft?', concrete: 'Schalte den Heizpilz ein (Stufe 2–3) und beobachte das Thermometer.' };
      if (st.heater === 4) return { small: 'Siedet das Gemisch zu heftig?', concrete: 'Stelle den Heizpilz auf Stufe 2 oder 3. Bei zu starkem Sieden wird Flüssigkeit mitgerissen.' };
      if (e.distillate().vol < 5) return { small: 'Beobachte Kolben, Thermometer und Kühler.', concrete: 'Warte (Zeitraffer), bis die Dampftemperatur steigt und Destillat in die Vorlage tropft. Lies dabei die Temperatur ab.' };
      const goodBurn = st.burns.find((b) => b.result === 'burns' && b.from !== 'flask');
      if (!goodBurn) {
        if (st.dish.E + st.dish.W > 0.05 && !st.dish.result) return { small: 'Die Probe ist in der Schale.', concrete: 'Entzünde die Probe in der Porzellanschale (nicht an der Apparatur!).' };
        const last = st.burns[st.burns.length - 1];
        if (last && last.result !== 'burns') return { small: 'Enthält deine Probe genug Ethanol?', concrete: 'Nimm die Probe aus dem früh gewonnenen Destillat (erste Fraktion). Spätere Anteile enthalten mehr Wasser. Schale vorher leeren.' };
        return { small: 'Wie zeigst du, dass das Destillat brennbar ist?', concrete: 'Entnimm mit der Pipette eine kleine Probe aus der Vorlage in die Porzellanschale und entzünde sie dort.' };
      }
      return { small: 'Alles erledigt?', concrete: 'Schalte die Heizung aus und prüfe das Ergebnis.' };
    },
    questions(s) {
      const rising = s.rise >= 1.0;
      return [
        { id: 'q1', type: 'number', prompt: 'Welche Dampftemperatur zeigte das Thermometer, während das Destillat gleichmäßig tropfte?', unit: '°C', check: (v) => v >= s.tMin - 1 && v <= s.tMax + 1, wrong: 'Lies die Anzeige am Thermometer bzw. im Temperaturverlauf ab (Dampftemperatur, nicht Kolbentemperatur).' },
        { id: 'q2', type: 'choice', prompt: 'Wie verhielt sich die Dampftemperatur während des Destillierens?', options: [['rise', 'Sie stieg langsam und stetig an.'], ['const78', 'Sie blieb genau bei 78 °C.'], ['jump', 'Sie sprang von 78 °C direkt auf 100 °C.'], ['flat', 'Sie blieb nahezu gleich.']], correct: rising ? 'rise' : 'flat', wrong: 'Sieh dir den Temperaturverlauf an.' },
        { id: 'q3', type: 'choice', prompt: 'Wie verlief die Brennprobe mit deinem Destillat?', options: [['blue', 'Es brannte mit bläulicher, kaum leuchtender Flamme.'], ['yellow', 'Es brannte mit hell leuchtender, rußender Flamme.'], ['none', 'Es ließ sich nicht entzünden.']], correct: 'blue', wrong: 'Erinnere dich an die Flamme in der Porzellanschale.' },
        { id: 'q4', type: 'choice', prompt: 'Was zeigt die bestandene Brennprobe?', options: [['flammable', 'Das Destillat ist brennbar – es enthält viel Ethanol, ist aber nicht unbedingt rein.'], ['pure', 'Das Destillat ist reines Ethanol.'], ['percent', 'Das Destillat enthält genau 78 % Ethanol.']], correct: 'flammable', wrong: 'Eine Brennprobe sagt nichts über die genaue Zusammensetzung.' },
        { id: 'g1', type: 'gap', prompt: 'Ergänze.', text: 'Ethanol siedet bei etwa {t78} °C, Wasser bei {t100} °C. Beim Erhitzen {verdampft} das Gemisch; der Dampf enthält mehr Ethanol als die Flüssigkeit. Im Kühler {kondensiert} der Dampf. Das Destillat enthält deshalb mehr {ethanol} als das Ausgangsgemisch. Die Trennung beruht auf den unterschiedlichen {siedetemp} der Stoffe.', gaps: [gap('t78'), gap('t100'), gap('verdampft'), gap('kondensiert'), gap('ethanol'), gap('siedetemp')] }
      ];
    },
    theory: [
      'Ethanol siedet bei 78 °C, Wasser bei 100 °C (Normaldruck). Ein Gemisch beginnt zwischen diesen Temperaturen zu sieden – hier bei etwa 85 °C.',
      'Der Dampf über dem siedenden Gemisch enthält mehr Ethanol als die Flüssigkeit. Im Kühler kondensiert er: Das Destillat ist ethanolreicher, aber kein reines Ethanol.',
      'Weil zuerst mehr Ethanol verdampft, wird die Flüssigkeit im Kolben wasserreicher. Ihre Siedetemperatur und die Dampftemperatur steigen deshalb langsam an – es gibt keinen Sprung von 78 °C auf 100 °C.',
      'Das Thermometer misst die Temperatur des Dampfes, der in den Kühler strömt; deshalb sitzt die Kugel auf Höhe des seitlichen Abgangs. Das Kühlwasser fließt unten hinein und oben heraus, damit der Mantel ganz gefüllt ist.',
      'Die Brennprobe zeigt, dass das Destillat brennbar ist. Über Reinheit oder den genauen Ethanolgehalt sagt sie nichts aus. Modellgrenze: Ethanol und Wasser bilden ein Azeotrop (ca. 96 % Ethanol); das wird hier vernachlässigt.'
    ],
    notebook(s) {
      return {
        title: 'Destillation eines Ethanol-Wasser-Gemischs',
        versuch: 'Ein Ethanol-Wasser-Gemisch (30 % Ethanol) wird mit Siedesteinen in einem Rundkolben erhitzt. Der Dampf strömt am Thermometer vorbei in den Liebigkühler (Kühlwasser unten hinein, oben heraus) und tropft als Destillat in die Vorlage. Eine kleine Probe des Destillats wird in einer Porzellanschale entzündet.',
        beobachtung: `Das Gemisch siedet. Die Dampftemperatur steigt auf etwa ${fmt(s.tMin, 0)} °C, das Destillat tropft in die Vorlage; während der Destillation steigt die Temperatur langsam weiter (bis ca. ${fmt(s.tMax, 0)} °C). Die Destillatprobe brennt mit bläulicher Flamme.`,
        erklaerung: 'Ethanol hat eine niedrigere Siedetemperatur als Wasser. Beim Sieden enthält der Dampf mehr Ethanol als die Flüssigkeit; im Kühler kondensiert er. Das Destillat ist deshalb ethanolreicher (brennbar), aber kein reines Ethanol. Die Flüssigkeit im Kolben wird wasserreicher, die Siedetemperatur steigt.',
        merksatz: 'Bei der Destillation trennt man Flüssigkeiten mit unterschiedlichen Siedetemperaturen durch Verdampfen und anschließendes Kondensieren. Der leichter siedende Stoff reichert sich im Destillat an.'
      };
    }
  };

  const ALL = Object.assign({}, K, C, D);
  const LABS = {
    classic: { id: 'classic', letter: 'A', name: 'Klassische Trennverfahren', tasks: ['K-01', 'K-02', 'K-03', 'K-04', 'K-05'] },
    chroma: { id: 'chroma', letter: 'B', name: 'Papierchromatographie', tasks: ['C-1', 'C-2', 'C-3'] },
    distill: { id: 'distill', letter: 'C', name: 'Destillation', tasks: ['D-1'] }
  };

  /** Prüft eine Antwort auf eine Frage. Rückgabe {ok, feedback, gaps?} */
  function checkAnswer(q, value) {
    if (q.type === 'choice') {
      if (value == null || value === '') return { ok: false, empty: true, feedback: 'Wähle eine Antwort.' };
      return value === q.correct ? { ok: true, feedback: 'Richtig.' } : { ok: false, feedback: q.wrong };
    }
    if (q.type === 'multi') {
      const v = (value || []).slice().sort();
      if (!v.length) return { ok: false, empty: true, feedback: 'Wähle mindestens eine Antwort.' };
      const c = q.correct.slice().sort();
      return v.length === c.length && v.every((x, i) => x === c[i]) ? { ok: true, feedback: 'Richtig.' } : { ok: false, feedback: q.wrong };
    }
    if (q.type === 'number') {
      const n = core.parseNum(value);
      if (!isFinite(n)) return { ok: false, empty: true, feedback: 'Gib eine Zahl ein.' };
      return q.check(n) ? { ok: true, feedback: 'Richtig.' } : { ok: false, feedback: q.wrong };
    }
    if (q.type === 'gap') {
      const res = q.gaps.map((g) => core.checkGap(g, (value || {})[g.id]));
      return { ok: res.every(core.gapOk), gaps: res, feedback: res.every(core.gapOk) ? 'Alle Lücken richtig.' : 'Noch nicht alle Lücken stimmen.' };
    }
    return { ok: false };
  }

  /** Wortauswahl (nur bei konkreter Hilfe): richtige Begriffe plus Ablenker, alphabetisch. */
  function wordbank(q) {
    if (q.type !== 'gap') return [];
    const words = q.gaps.map((g) => g.accept[0]);
    const distract = ['Absorption', 'Destillieren', 'Reinstoff', 'Dichte', 'Schmelztemperatur', 'Sieben', 'unlöslich', 'Masse'].filter((w) => !words.includes(w)).slice(0, 3);
    return words.concat(distract).sort((a, b) => a.localeCompare(b, 'de'));
  }

  return { ALL, LABS, checkAnswer, wordbank, GAPS: G, validLanes };
});
