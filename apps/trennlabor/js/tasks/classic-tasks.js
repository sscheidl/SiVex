/*
 * Trennlabor – Aufgaben K-01 bis K-05 (klassische Trennverfahren)
 *
 * Jede Aufgabe beschreibt:
 *  - setup:        Ausgangszustand des Labors (Stoffe, Geräte)
 *  - check:        Erfolgskriterien – ausschließlich aus dem tatsächlichen Zustand
 *  - observations: Beobachtungsfragen; die richtige Antwort wird aus dem Zustand berechnet
 *  - gaps:         Lückentext mit akzeptierten Begriffen, Synonymen und Sperrliste
 *  - theory, notebook: erst nach erfolgreichem Versuch und Auswertung sichtbar
 *  - help:         Regeln für kleine und konkrete Hilfe, abhängig vom Zustand
 */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const classic = node ? require('../model/classic.js') : root.TL.classic;
  const util = node ? require('../util.js') : root.TL.util;
  const api = factory(classic, util);
  if (node) module.exports = api;
  else ((root.TL = root.TL || {}).tasks = root.TL.tasks || {}).classic = api;
})(typeof self !== 'undefined' ? self : this, function (classic, util) {
  'use strict';
  const { fmt } = util;
  const BEAKERS = ['B1', 'B2', 'B3'];
  const KEEP = ['B1', 'B2', 'B3', 'F', 'R', 'D', 'S', 'E'];

  // ------------------------------------------------------------ Hilfsfunktionen
  function ctx(lab) {
    const d = (id) => lab.describe(id);
    const all = KEEP.filter((id) => lab.container(id)).map(d);
    const beakers = BEAKERS.filter((id) => lab.container(id)).map(d);
    const lostSalt = ['waste', 'table', 'splatter'].reduce((s, id) => { const x = d(id); return s + x.salt + x.saltSolid; }, 0);
    const residue = () => {
      const f = lab.state.insert && (lab.state.insert === 'paper' || lab.state.insert === 'paperFlat') ? d('F') : null;
      const r = lab.container('R') ? d('R') : null;
      return [f, r].filter((x) => x && x.solids > 0.05);
    };
    const log = lab.state.log;
    const did = (type, pred) => log.some((e) => e.type === type && (!pred || pred(e)));
    return { lab, d, all, beakers, lostSalt, residue, log, did, st: lab.state };
  }
  const saltOf = (x) => x.salt + x.saltSolid;

  /** Beste klare Wasserfraktion (Becherglas mit viel Wasser und wenig Sand). */
  function bestWater(c, minWater) {
    const cands = c.beakers.filter((x) => x.water >= (minWater || 0) && x.oil < 1);
    cands.sort((a, b) => (a.sand - b.sand) || (b.water - a.water));
    return cands[0] || null;
  }

  const fmtG = (v) => `${fmt(v)} g`;
  const fmtMl = (v) => `${fmt(v, 0)} mL`;

  /** Zusammenfassung der Verluste für die Erfolgsliste. */
  function lossLine(lab, keys) {
    const b = lab.balance();
    const names = { water: 'Wasser', oil: 'Öl', salt: 'Kochsalz', sand: 'Sand', iron: 'Eisen', plant: 'Blütenreste', dye: 'Farbstoffe' };
    const parts = [];
    for (const k of keys) {
      const lost = b.where[k].filter((w) => w.lost && w.id !== 'vapor').reduce((s, w) => s + w.amount, 0);
      if (lost > 0.05) parts.push(`${names[k]} ${k === 'water' || k === 'oil' ? fmtMl(lost) : fmtG(lost)}`);
    }
    return { label: 'Verluste (Ausguss, Tisch, verspritzt)', ok: true, info: true, detail: parts.length ? parts.join(', ') : 'keine' };
  }

  // ------------------------------------------------------------ gemeinsame Hilfe-Regeln
  const R = {
    funnelNoReceiver: {
      when: (c) => c.st.F && (c.d('F').liquid > 3) && !c.lab.vesselAt('filter'),
      small: 'Wohin läuft die Flüssigkeit, die durch den Trichter tropft?',
      concrete: 'Unter dem Trichter fehlt ein Gefäß. Stelle sofort ein leeres Becherglas darunter (Becherglas antippen → „Unter den Trichter stellen“).'
    },
    sepNoReceiver: {
      when: (c) => c.st.S && c.st.tap > 0 && !c.lab.vesselAt('sep'),
      small: 'Wohin fließt die Flüssigkeit, wenn der Hahn offen ist?',
      concrete: 'Schließe den Hahn und stelle ein leeres Becherglas unter den Scheidetrichter.'
    },
    pouring: {
      when: (c) => c.st.op && c.st.op.type === 'pour',
      small: 'Beobachte genau, was beim Gießen mitgerissen wird.',
      concrete: 'Warte, bis das Umgießen beendet ist. Mit „Gießen stoppen“ kannst du jederzeit abbrechen.'
    },
    filtering: {
      when: (c) => c.st.F && c.st.insert && c.d('F').liquid > 3 && c.lab.vesselAt('filter'),
      small: 'Filtrieren braucht etwas Zeit.',
      concrete: 'Warte, bis die Flüssigkeit durch das Filterpapier gelaufen ist. Mit dem Zeitraffer geht es schneller.'
    }
  };

  /** Hilfe für die Auswertung, wenn der Versuch gelungen ist. */
  const EVAL_HELP = {
    small: 'Dein Versuch ist gelungen. Vergleiche jetzt deine Beobachtungen mit dem, was du im Labor gesehen hast, und überlege, wie die Verfahren heißen.',
    concrete: 'Öffne „Auswertung“. Fehlerhafte Lücken sind markiert; unter der Lückenaufgabe findest du jetzt eine Wortauswahl.'
  };

  function pickHelp(rules, c) {
    const val = (v) => (typeof v === 'function' ? v(c) : v);
    for (const r of rules) if (r.when(c)) return { key: r.key || '', small: val(r.small), concrete: val(r.concrete) };
    return null;
  }

  // ============================================================ K-01
  const K01 = {
    id: 'K-01', lab: 'classic', short: 'Sand und Wasser',
    title: 'Sand und Wasser trennen',
    problem: 'In Becherglas 1 ist frisch aufgerührtes, trübes Wasser mit Sand. Gewinne möglichst viel klares Wasser und trenne den Sand davon ab.',
    goal: 'Mindestens 60 mL klares Wasser in einem Becherglas (fast ohne Sand) und der Sand getrennt davon.',
    materials: ['Becherglas 1: 100 mL Wasser + 15 g Sand (aufgerührt)', 'zwei leere Bechergläser', 'Glasstab', 'Trichter mit Stativ, Filterpapier', 'Ausguss'],
    setup: { equip: { funnel: true }, vessels: { B1: { water: 100, sand: 15, stirred: true }, B2: {}, B3: {} } },
    check(lab) {
      const c = ctx(lab);
      const w = c.beakers.filter((x) => x.water >= 60 && x.sand <= 0.3 && x.turbidityClass === 'klar')[0];
      const any = bestWater(c, 20);
      // Sand gilt als abgetrennt, wenn er außerhalb der Wasserfraktion (Bodensatz mit wenig Wasser, Filterrückstand) liegt – auch auf mehrere Gefäße verteilt
      const sandParts = c.all.filter((x) => x.sand > 0.05 && x.water <= 30 && (!w || x.id !== w.id));
      const sandSum = sandParts.reduce((s, x) => s + x.sand, 0);
      const sandHome = sandSum >= 12 ? { name: sandParts.map((x) => x.name).join(' + '), sand: sandSum } : null;
      return {
        success: !!w && !!sandHome,
        items: [
          { label: 'Klares Wasser (≥ 60 mL, fast ohne Sand)', ok: !!w, detail: w ? `${w.name}: ${fmtMl(w.water)}, klar` : any ? `${any.name}: ${fmtMl(any.water)}, ${any.turbidityClass}, ${fmtG(any.sand)} Sand` : 'noch nicht' },
          { label: 'Sand abgetrennt (≥ 12 g)', ok: !!sandHome, detail: sandHome ? `${sandHome.name}: ${fmtG(sandHome.sand)}` : 'noch nicht' },
          lossLine(lab, ['water', 'sand'])
        ]
      };
    },
    observations(lab) {
      const c = ctx(lab);
      const w = bestWater(c, 20);
      const filtered = c.did('pour', (e) => e.to === 'F') && c.did('filtrate');
      const decanted = c.did('pour', (e) => BEAKERS.includes(e.from) && BEAKERS.includes(e.to));
      return [
        { id: 'settle', q: 'Was geschah mit dem Sand, als das Gemisch ruhig stand?', type: 'choice',
          options: [['bottom', 'Er setzte sich am Boden ab, das Wasser darüber wurde klarer.'], ['dissolve', 'Er löste sich im Wasser auf.'], ['float', 'Er sammelte sich an der Oberfläche.']], correct: 'bottom' },
        { id: 'water', q: 'Wie sieht dein abgetrenntes Wasser aus?', type: 'choice',
          options: [['klar', 'klar'], ['leicht trüb', 'leicht trüb'], ['trüb', 'trüb']], correct: w ? w.turbidityClass : null,
          unavailable: w ? '' : 'Du hast noch kein Wasser abgetrennt.', note: w ? `bezogen auf ${w.name}` : '' },
        { id: 'method', q: 'Mit welchem Verfahren hast du das Wasser vom Sand getrennt?', type: 'choice',
          options: [['decant', 'Sedimentieren und Dekantieren (Absetzen lassen, vorsichtig abgießen)'], ['filter', 'Filtrieren'], ['both', 'beides nacheinander'], ['evap', 'Eindampfen']],
          correct: filtered && decanted ? 'both' : filtered ? 'filter' : decanted ? 'decant' : null,
          unavailable: filtered || decanted ? '' : 'Du hast noch nicht umgegossen oder filtriert.' }
      ];
    },
    gaps: {
      text: 'Lässt man das Gemisch ruhig stehen, setzt sich der Sand am Boden ab. Dieses Trennverfahren heißt {sed}. Gießt man die überstehende Flüssigkeit vorsichtig ab, nennt man das {dek}. Beim {fil} hält das Filterpapier die Sandkörner zurück: Der Sand bleibt als {rue} im Filter, das klare Wasser läuft als {fit} hindurch.',
      gaps: {
        sed: { accept: ['Sedimentieren', 'Sedimentation', 'Absetzen', 'Absetzenlassen', 'Absetzen lassen'], wrong: [{ terms: ['Dekantieren', 'Dekantation'], hint: 'Dekantieren ist das Abgießen. Gesucht ist das Absetzen.' }], hint: 'Fachbegriff für das Absetzen eines Feststoffs.' },
        dek: { accept: ['Dekantieren', 'Dekantation', 'Abgießen'], wrong: [{ terms: ['Sedimentieren', 'Sedimentation'], hint: 'Sedimentieren ist das Absetzen. Gesucht ist das vorsichtige Abgießen.' }], hint: 'Fachbegriff für das vorsichtige Abgießen.' },
        fil: { accept: ['Filtrieren', 'Filtration', 'Filtern'], hint: 'Womit hält man Feststoffe mit einem Papier zurück?' },
        rue: { accept: ['Rückstand', 'Filterrückstand'], wrong: [{ terms: ['Filtrat'], hint: 'Das Filtrat ist die Flüssigkeit, die durchläuft.' }], hint: 'Was im Filter bleibt, heißt …' },
        fit: { accept: ['Filtrat'], wrong: [{ terms: ['Rückstand', 'Filterrückstand'], hint: 'Der Rückstand bleibt im Filter. Gesucht ist die durchgelaufene Flüssigkeit.' }], hint: 'Die durchgelaufene Flüssigkeit heißt …' }
      },
      bank: ['Sedimentieren', 'Dekantieren', 'Filtrieren', 'Rückstand', 'Filtrat', 'Eindampfen']
    },
    theory: [
      'Sand ist in Wasser unlöslich. Ein Gemisch aus einem unlöslichen Feststoff und einer Flüssigkeit heißt <b>Suspension</b>; sie ist trüb, weil die Feststoffteilchen das Licht streuen.',
      'Sandkörner haben eine größere Dichte als Wasser. In Ruhe sinken sie nach unten: Das ist das <b>Sedimentieren</b>. Feine Teilchen sinken langsamer – deshalb dauert es, bis das Wasser ganz klar ist.',
      'Beim <b>Dekantieren</b> gießt man die klare Flüssigkeit vorsichtig ab. Gießt man zu schnell, wird der Bodensatz aufgewirbelt und gelangt mit ins neue Gefäß.',
      'Beim <b>Filtrieren</b> sind die Poren des Filterpapiers kleiner als die Sandkörner. Das Papier hält den Sand als <b>Rückstand</b> zurück, das Wasser läuft als <b>Filtrat</b> hindurch.'
    ],
    notebook: () => ({
      title: 'Trennung von Sand und Wasser',
      sections: [
        ['Versuch', 'Ein aufgerührtes Gemisch aus Sand und Wasser wird ruhig stehen gelassen. Danach wird das Wasser vorsichtig in ein zweites Becherglas abgegossen. Alternativ wird das Gemisch durch einen Trichter mit Filterpapier filtriert.'],
        ['Beobachtung', 'Der Sand setzt sich nach kurzer Zeit am Boden ab, das Wasser darüber wird klar. Gießt man zu schnell ab, wird der Bodensatz aufgewirbelt und das Wasser bleibt trüb. Beim Filtrieren bleibt der Sand im Filterpapier zurück, das Filtrat ist klar.'],
        ['Erklärung', 'Sand ist in Wasser unlöslich und hat eine größere Dichte als Wasser. Die Sandkörner sinken deshalb zu Boden (Sedimentieren); das überstehende Wasser lässt sich abgießen (Dekantieren). Die Poren des Filterpapiers sind kleiner als die Sandkörner: Der Sand bleibt als Rückstand im Filter, das Wasser läuft als Filtrat hindurch.'],
        ['Merksatz', 'Eine Suspension (unlöslicher Feststoff in einer Flüssigkeit) trennt man durch Sedimentieren und Dekantieren oder durch Filtrieren.']
      ]
    })
  };

  // ============================================================ K-02 / K-03 gemeinsam
  function saltRules(c, task) {
    const D = c.st.D ? c.d('D') : null;
    const residues = c.residue();
    const keptSalt = c.all.reduce((s, x) => s + saltOf(x), 0);
    const keptSand = c.all.reduce((s, x) => s + x.sand, 0);
    const mix = c.beakers.find((x) => x.sand > 3 && saltOf(x) > 1);
    const solution = c.beakers.filter((x) => x.salt > 1 && x.sand < 0.5 && x.water > 3).sort((a, b) => b.salt - a.salt)[0];
    const turbidFiltrate = c.beakers.find((x) => x.salt > 1 && x.sand >= 0.5 && x.sand < 3);
    const hasWater = c.all.some((x) => x.water > 3);
    return [
      { when: () => keptSalt < 3, small: 'Wie viel Kochsalz ist noch in deinen Gefäßen? Schau in die Mengenbilanz.', concrete: 'Zu viel Salz ist verloren gegangen (Ausguss, Tisch oder verspritzt). Aus nichts lässt sich kein Salz gewinnen: Beginne die Aufgabe mit „Neu beginnen“ und bewahre die Salzlösung auf.' },
      { when: () => keptSand < 8, small: 'Wo ist dein Sand geblieben?', concrete: 'Zu viel Sand ist verloren gegangen. Beginne die Aufgabe mit „Neu beginnen“ neu.' },
      R.funnelNoReceiver,
      { when: () => task === 'K-03' && c.d('B1').iron > 1 && !hasWater, small: 'Welche besondere Eigenschaft hat Eisen, die Sand und Salz nicht haben?', concrete: 'Tippe Becherglas 1 an und setze den Magneten (in Folie) ein – mehrmals, bis kein Eisen mehr angezogen wird.' },
      { when: () => !hasWater && c.d('B1').sand > 8, small: 'Wie verhalten sich Sand und Kochsalz, wenn man Wasser dazugibt?', concrete: 'Gib Wasser in Becherglas 1 (z. B. 50 mL) und rühre mit dem Glasstab um, bis sich das Salz gelöst hat.' },
      { when: () => residues.some((r) => r.saltSolid > 0.5 && r.water < 1), small: 'Kann ein Filterpapier zwei trockene Feststoffe voneinander trennen?', concrete: 'Im Filter liegen Sand und Salz trocken übereinander – so wird nichts getrennt. Gieße Wasser in den Trichter: Das Salz löst sich und läuft als Lösung durch. Achte auf ein Becherglas unter dem Trichter.' },
      { when: () => c.beakers.some((x) => x.saltSolid > 0.3 && x.water > 5), small: 'Ist schon alles Kochsalz gelöst?', concrete: () => { const x = c.beakers.find((y) => y.saltSolid > 0.3 && y.water > 5); return x ? `In ${x.name} liegen noch ${fmtG(x.saltSolid)} festes Salz. Rühre weiter um${x.water < 20 ? ' und gib mehr Wasser zu – in wenig Wasser löst sich nur wenig Salz' : ''}.` : ''; } },
      R.pouring, R.filtering,
      { when: () => !!mix && (!c.st.insert || c.st.insert === 'sieve'), small: 'Mit welchem Gerät hält man den Sand zurück, lässt aber die Lösung durch?', concrete: 'Setze gefaltetes Filterpapier in den Trichter, stelle ein leeres Becherglas darunter und gieße das Gemisch in den Trichter.' },
      { when: () => !!mix && !c.lab.vesselAt('filter'), small: 'Wohin soll das Filtrat laufen?', concrete: 'Stelle ein leeres Becherglas unter den Trichter und gieße dann das Gemisch in den Trichter.' },
      { when: () => !!mix, small: 'Der Filter ist vorbereitet. Was fehlt noch?', concrete: () => `Gieße ${mix.name} in den Trichter (am besten „Vollständig umfüllen“, damit auch der Sand in den Filter kommt).` },
      { when: () => !!turbidFiltrate, small: 'Ist dein Filtrat wirklich klar?', concrete: () => `In ${turbidFiltrate.name} ist noch Sand – das Filterpapier fehlte oder saß nicht richtig. Filtriere die Lösung noch einmal durch gefaltetes Filterpapier.` },
      { when: () => D && D.sand > 0.15 && saltOf(D) > 0.2, small: 'Was ist außer Salz noch in der Abdampfschale?', concrete: 'In der Abdampfschale ist auch Sand – eingedampft wurde ein ungefiltertes Gemisch. So entsteht kein reines Salz. Lass die Schale abkühlen, gib Wasser dazu, gieße alles durch einen Filter und dampfe das klare Filtrat ein.' },
      { when: () => task === 'K-03' && D && D.iron > 0.15, small: 'Gehört Eisen in die Salzfraktion?', concrete: 'In der Abdampfschale ist Eisen. Entferne das Eisen vorher mit dem Magneten.' },
      { when: () => !!solution && !(D && D.water > 1), small: 'Wie bekommt man das gelöste Salz wieder als Feststoff?', concrete: () => `Gieße die Salzlösung aus ${solution.name} in die Abdampfschale und erhitze sie mit dem Brenner.` },
      { when: () => D && D.water > 0.3 && saltOf(D) > 0.5 && c.st.burner === 0, small: 'In der Schale ist Salzlösung. Was fehlt?', concrete: 'Schalte den Brenner unter der Abdampfschale ein (große Flamme), bis fast alles Wasser verdampft ist.' },
      { when: () => D && D.water > 0.3 && saltOf(D) > 0.5, small: 'Was geschieht mit dem Wasser beim Erhitzen?', concrete: D && D.water < 8 ? 'Fast fertig: Stelle jetzt auf kleine Flamme, damit das Salz nicht aus der Schale spritzt.' : 'Warte, bis das Wasser verdampft ist (Zeitraffer). Zum Schluss nur schwach erhitzen.' },
      { when: () => task === 'K-03' && c.d('E') && c.d('E').iron < 4, small: 'Ist das Eisen schon vollständig abgetrennt?', concrete: () => { const x = c.all.filter((y) => y.id !== 'E' && y.iron > 0.3).sort((a, b) => b.iron - a.iron)[0]; return x ? `In ${x.name} ist noch ${fmtG(x.iron)} Eisen. Setze dort den Magneten ein.` : 'Setze den Magneten mehrmals ein.'; } },
      { when: () => true, small: 'Kochsalz und Sand unterscheiden sich in ihrer Löslichkeit in Wasser.', concrete: 'Lösen – Filtrieren – Eindampfen: Wasser zugeben und rühren, das Gemisch filtrieren, das Filtrat in der Abdampfschale eindampfen.' }
    ];
  }

  function saltObservations(c, task) {
    const D = c.st.D ? c.d('D') : null;
    const res = c.residue();
    const dissolved = c.did('water') && (c.all.some((x) => x.salt > 1) || c.did('pour', (e) => e.to === 'D'));
    const resSand = res.reduce((s, r) => s + r.sand, 0), resSalt = res.reduce((s, r) => s + r.saltSolid, 0);
    let resAns = null;
    if (res.length || c.did('filtrate')) resAns = resSand > 1 && resSalt > 0.5 ? 'both' : resSand > 1 ? 'sand' : resSalt > 0.5 ? 'salt' : 'nothing';
    let dishAns = null;
    if (D && D.water < 0.5 && D.solids > 0.05) dishAns = D.sand > 0.15 || D.iron > 0.15 ? 'mix' : D.saltSolid > 0.3 ? 'crystals' : 'other';
    else if (D && D.water < 0.5 && c.did('burner', (e) => e.level > 0)) dishAns = 'nothing';
    const obs = [
      { id: 'dissolve', q: 'Was geschah mit dem Kochsalz, als du Wasser zugegeben und umgerührt hast?', type: 'choice',
        options: [['dissolved', 'Es löste sich auf und war nicht mehr zu sehen.'], ['settled', 'Es setzte sich wie der Sand am Boden ab.'], ['floated', 'Es schwamm an der Oberfläche.']],
        correct: dissolved ? 'dissolved' : null, unavailable: dissolved ? '' : 'Du hast noch kein Wasser zugegeben.' },
      { id: 'residue', q: 'Was blieb im Filterpapier zurück?', type: 'choice',
        options: [['sand', 'Sand'], ['salt', 'Kochsalz'], ['both', 'Sand und Kochsalz'], ['nothing', 'nichts']],
        correct: resAns, unavailable: resAns ? '' : 'Du hast noch nicht filtriert.' },
      { id: 'dish', q: 'Was blieb nach dem Eindampfen in der Abdampfschale zurück?', type: 'choice',
        options: [['crystals', 'weiße Salzkristalle'], ['mix', 'ein Gemisch aus Salz und anderen Feststoffen'], ['nothing', 'nichts'], ['other', 'ein anderer Feststoff']],
        correct: dishAns, unavailable: dishAns ? '' : 'Du hast noch nichts eingedampft.' }
    ];
    if (task === 'K-03') {
      const E = c.d('E');
      obs.unshift(
        { id: 'magnetWhat', q: 'Welche Stoffe hat der Magnet angezogen?', type: 'choice',
          options: [['iron', 'nur das Eisen'], ['ironsand', 'Eisen und Sand'], ['all', 'Eisen, Sand und Salz']], correct: E.iron > 0.5 ? 'iron' : null,
          unavailable: E.iron > 0.5 ? '' : 'Du hast den Magneten noch nicht erfolgreich eingesetzt.' }
      );
    }
    return obs;
  }

  function saltCheck(lab, task) {
    const c = ctx(lab);
    const sand0 = 10, salt0 = 5, iron0 = 5;
    const D = c.d('D');
    const sandHome = c.all.filter((x) => x.id !== 'D' && x.sand >= sand0 * 0.8).sort((a, b) => b.sand - a.sand)[0];
    const sandPure = sandHome && saltOf(sandHome) <= sand0 * 0.1 && (task !== 'K-03' || sandHome.iron <= 0.5);
    const saltOk = D.saltSolid >= salt0 * 0.6 && D.water <= 0.5 && D.sand <= 0.15 && D.iron <= 0.15;
    const items = [];
    if (task === 'K-03') {
      const E = c.d('E');
      items.push({ label: 'Eisen abgetrennt (≥ 4 g, rein)', ok: E.iron >= iron0 * 0.8 && E.sand + saltOf(E) <= 0.25, detail: E.iron > 0.01 ? `Uhrglas: ${fmtG(E.iron)} Eisen` : 'noch nicht' });
    }
    items.push({ label: 'Sand abgetrennt (≥ 8 g, fast salzfrei)', ok: !!sandPure,
      detail: sandHome ? `${sandHome.name}: ${fmtG(sandHome.sand)} Sand, ${fmtG(saltOf(sandHome))} Salz${task === 'K-03' ? `, ${fmtG(sandHome.iron)} Eisen` : ''}` : 'noch nicht' });
    items.push({ label: 'Festes Kochsalz durch Eindampfen (≥ 3 g, trocken, ohne Sand)', ok: saltOk,
      detail: D.solids > 0.01 || D.water > 0.5 ? `Abdampfschale: ${fmtG(D.saltSolid)} Salzkristalle, ${fmtMl(D.water)} Wasser, ${fmtG(D.sand)} Sand${task === 'K-03' ? `, ${fmtG(D.iron)} Eisen` : ''}` : 'noch nicht' });
    items.push(lossLine(lab, task === 'K-03' ? ['salt', 'sand', 'iron'] : ['salt', 'sand']));
    return { success: items.filter((i) => !i.info).every((i) => i.ok), items };
  }

  const SALT_THEORY = [
    'Kochsalz ist in Wasser <b>löslich</b>: Die Salzkristalle zerfallen in so kleine Teilchen, dass man sie nicht mehr sieht. Es entsteht eine klare <b>Lösung</b>. Sand ist <b>unlöslich</b> und bleibt als Feststoff erhalten.',
    'Beim <b>Filtrieren</b> passen die gelösten Salzteilchen durch die Poren des Filterpapiers, die Sandkörner nicht. Der Sand bleibt als <b>Rückstand</b> im Filter, die Salzlösung läuft als <b>Filtrat</b> hindurch. Festes Salz kann man deshalb nicht durch bloßes Filtrieren gewinnen.',
    'Beim <b>Eindampfen</b> verdampft das Wasser. Sobald die Lösung gesättigt ist, bilden sich Salzkristalle. Zum Schluss erhitzt man nur noch schwach, damit die Kristalle nicht aus der Schale springen.'
  ];

  // ============================================================ K-02
  const K02 = {
    id: 'K-02', lab: 'classic', short: 'Sand und Kochsalz',
    title: 'Sand und Kochsalz trennen',
    problem: 'In Becherglas 1 ist ein trockenes Gemisch aus Sand und Kochsalz. Trenne es so, dass du beide Stoffe getrennt zurückgewinnst – den Sand und das Kochsalz als Feststoff.',
    goal: 'Sand (≥ 8 g, fast salzfrei) und festes, trockenes Kochsalz (≥ 3 g) ohne Sand.',
    materials: ['Becherglas 1: 10 g Sand + 5 g Kochsalz (trocken)', 'zwei leere Bechergläser', 'Wasser (Spritzflasche)', 'Glasstab', 'Trichter mit Stativ, Filterpapier', 'Abdampfschale auf Dreifuß mit Brenner', 'Ausguss'],
    setup: { equip: { funnel: true, dish: true }, vessels: { B1: { sand: 10, saltSolid: 5 }, B2: {}, B3: {} } },
    check: (lab) => saltCheck(lab, 'K-02'),
    observations: (lab) => saltObservations(ctx(lab), 'K-02'),
    gaps: {
      text: 'Kochsalz ist in Wasser {loes}, Sand ist {unl}. Gibt man Wasser zu und rührt um, entsteht eine Salzlösung, in der der Sand liegt. Beim Filtrieren bleibt der Sand als {rue} im Filterpapier zurück, die Salzlösung läuft als {fil} hindurch. Beim {ein} verdampft das Wasser und das Kochsalz bleibt als Feststoff zurück.',
      gaps: {
        loes: { accept: ['löslich', 'gut löslich', 'wasserlöslich'], wrong: [{ terms: ['unlöslich', 'nicht löslich'], hint: 'Das Salz verschwindet im Wasser – es ist also …' }], hint: 'Wie verhält sich Salz in Wasser?' },
        unl: { accept: ['unlöslich', 'nicht löslich', 'wasserunlöslich'], wrong: [{ terms: ['löslich', 'wasserlöslich'], hint: 'Der Sand bleibt als Feststoff sichtbar.' }], hint: 'Wie verhält sich Sand in Wasser?' },
        rue: { accept: ['Rückstand', 'Filterrückstand'], wrong: [{ terms: ['Filtrat'], hint: 'Das Filtrat ist die Flüssigkeit, die durchläuft.' }], hint: 'Was im Filter bleibt, heißt …' },
        fil: { accept: ['Filtrat'], wrong: [{ terms: ['Rückstand', 'Filterrückstand'], hint: 'Gesucht ist die durchgelaufene Flüssigkeit.' }], hint: 'Die durchgelaufene Flüssigkeit heißt …' },
        ein: { accept: ['Eindampfen', 'Verdampfen', 'Abdampfen', 'Eindunsten', 'Verdunsten'], wrong: [{ terms: ['Destillieren', 'Destillation'], hint: 'Beim Destillieren fängt man den Dampf wieder auf. Hier lässt man das Wasser einfach verdampfen.' }, { terms: ['Kondensieren'], hint: 'Kondensieren ist das Flüssigwerden eines Dampfes.' }], hint: 'Wie heißt das Verfahren mit der Abdampfschale?' }
      },
      bank: ['löslich', 'unlöslich', 'Rückstand', 'Filtrat', 'Eindampfen', 'Destillieren']
    },
    theory: SALT_THEORY,
    notebook: () => ({
      title: 'Trennung von Sand und Kochsalz',
      sections: [
        ['Versuch', 'Ein Gemisch aus Sand und Kochsalz wird mit Wasser versetzt und umgerührt. Das Gemisch wird durch einen Trichter mit Filterpapier filtriert. Das Filtrat wird in einer Abdampfschale erhitzt, bis das Wasser verdampft ist.'],
        ['Beobachtung', 'Das Salz verschwindet beim Umrühren im Wasser, der Sand bleibt sichtbar. Im Filterpapier bleibt Sand zurück, das Filtrat ist klar. Beim Eindampfen entstehen in der Schale weiße Kristalle.'],
        ['Erklärung', 'Kochsalz ist in Wasser löslich, Sand ist unlöslich. Die gelösten Salzteilchen passen durch die Poren des Filterpapiers, die Sandkörner nicht: Der Sand bleibt als Rückstand im Filter, die Salzlösung läuft als Filtrat hindurch. Beim Eindampfen verdampft das Wasser, das Salz kristallisiert aus.'],
        ['Merksatz', 'Ein Gemisch aus einem löslichen und einem unlöslichen Feststoff trennt man durch Lösen, Filtrieren und Eindampfen.']
      ]
    }),
    help(lab) {
      const c = ctx(lab);
      if (K02.check(lab).success) return EVAL_HELP;
      return pickHelp(saltRules(c, 'K-02').map((r) => Object.assign({}, r, { when: () => r.when(c) })), c);
    }
  };

  // ============================================================ K-03
  const K03 = {
    id: 'K-03', lab: 'classic', short: 'Eisen, Sand und Kochsalz',
    title: 'Eisen, Sand und Kochsalz trennen',
    problem: 'In Becherglas 1 ist ein trockenes Gemisch aus Eisenpulver, Sand und Kochsalz. Gewinne alle drei Stoffe getrennt voneinander zurück.',
    goal: 'Drei Fraktionen: Eisen (≥ 4 g), Sand (≥ 8 g, fast salz- und eisenfrei), festes Kochsalz (≥ 3 g, trocken, rein).',
    materials: ['Becherglas 1: 5 g Eisenpulver + 10 g Sand + 5 g Kochsalz (trocken)', 'Magnet in Folie, Uhrglas', 'zwei leere Bechergläser', 'Wasser (Spritzflasche)', 'Glasstab', 'Trichter mit Stativ, Filterpapier', 'Abdampfschale auf Dreifuß mit Brenner', 'Ausguss'],
    setup: { equip: { funnel: true, dish: true, magnet: true }, vessels: { B1: { sand: 10, saltSolid: 5, iron: 5 }, B2: {}, B3: {} } },
    check: (lab) => saltCheck(lab, 'K-03'),
    observations: (lab) => saltObservations(ctx(lab), 'K-03'),
    gaps: {
      text: 'Eisen wird von einem Magneten angezogen, es ist {mag}. Sand und Kochsalz werden nicht angezogen. Nach dem Abtrennen des Eisens gibt man Wasser zu: Das Kochsalz {loest} sich, der Sand nicht. Durch {filt} trennt man den Sand ab, durch {ein} gewinnt man das Kochsalz aus der Lösung zurück.',
      gaps: {
        mag: { accept: ['magnetisch', 'ferromagnetisch', 'magnetisierbar'], hint: 'Welche Eigenschaft nutzt der Magnet?' },
        loest: { accept: ['löst', 'auflöst'], wrong: [{ terms: ['schmilzt'], hint: 'Schmelzen geschieht durch Erhitzen. Im Wasser geschieht etwas anderes.' }], hint: 'Was macht das Salz im Wasser?' },
        filt: { accept: ['Filtrieren', 'Filtration', 'Filtern'], hint: 'Welches Verfahren hält den Sand zurück?' },
        ein: { accept: ['Eindampfen', 'Verdampfen', 'Abdampfen', 'Eindunsten'], wrong: [{ terms: ['Destillieren', 'Destillation'], hint: 'Hier wird das Wasser nicht aufgefangen, sondern verdampft.' }], hint: 'Wie heißt das Verfahren mit der Abdampfschale?' }
      },
      bank: ['magnetisch', 'löst', 'Filtrieren', 'Eindampfen', 'schmilzt']
    },
    theory: [
      'Eisen ist <b>magnetisch</b>: Ein Magnet zieht die Eisenteilchen an, Sand und Kochsalz nicht. Diese <b>Magnettrennung</b> nutzt man zuerst, solange das Gemisch trocken ist. Mehrmaliges Durchführen erhöht die Ausbeute.',
      ...SALT_THEORY,
      'Die Reihenfolge der Trennschritte ist frei wählbar, solange jeder Schritt eine passende Eigenschaft nutzt. Trennt man das Eisen nicht zuerst ab, landet es zusammen mit dem Sand im Filter und kann dort mit dem Magneten herausgeholt werden.'
    ],
    notebook: () => ({
      title: 'Trennung von Eisen, Sand und Kochsalz',
      sections: [
        ['Versuch', 'Ein Magnet (in Folie) wird mehrmals durch das trockene Gemisch geführt. Zum Rest wird Wasser gegeben und umgerührt. Das Gemisch wird filtriert, das Filtrat in einer Abdampfschale eingedampft.'],
        ['Beobachtung', 'Der Magnet zieht nur das dunkle Eisenpulver an. Das Salz löst sich im Wasser, der Sand bleibt im Filterpapier zurück. Beim Eindampfen bleiben weiße Salzkristalle in der Schale.'],
        ['Erklärung', 'Eisen ist magnetisch, Sand und Kochsalz sind es nicht. Kochsalz ist in Wasser löslich, Sand unlöslich: Beim Filtrieren bleibt der Sand als Rückstand im Filter, die Salzlösung läuft als Filtrat durch. Beim Eindampfen verdampft das Wasser, das Salz bleibt zurück.'],
        ['Merksatz', 'Stoffgemische trennt man mithilfe unterschiedlicher Stoffeigenschaften (z. B. Magnetismus, Löslichkeit, Siedetemperatur). Mehrere Verfahren lassen sich nacheinander kombinieren.']
      ]
    }),
    help(lab) {
      const c = ctx(lab);
      if (K03.check(lab).success) return EVAL_HELP;
      return pickHelp(saltRules(c, 'K-03').map((r) => Object.assign({}, r, { when: () => r.when(c) })), c);
    }
  };

  // ============================================================ K-04
  const K04 = {
    id: 'K-04', lab: 'classic', short: 'Öl und Wasser',
    title: 'Öl und Wasser trennen',
    problem: 'In Becherglas 1 sind Speiseöl und Wasser gerade kräftig verrührt worden. Trenne die beiden Flüssigkeiten und fange beide getrennt in Bechergläsern auf.',
    goal: 'Wasser (≥ 45 mL) und Öl (≥ 30 mL) getrennt in Bechergläsern, jeweils höchstens 5 % der anderen Flüssigkeit.',
    materials: ['Becherglas 1: 60 mL Wasser + 40 mL Speiseöl (verrührt)', 'zwei leere Bechergläser', 'Scheidetrichter mit Stopfen und Hahn am Stativ', 'Glasstab', 'Trichter mit Filterpapier', 'Ausguss'],
    setup: { equip: { sep: true, funnel: true }, vessels: { B1: { water: 60, oil: 40, stirred: true, disp: 24 }, B2: {}, B3: {} } },
    check(lab) {
      const c = ctx(lab);
      const wf = c.beakers.filter((x) => x.water >= 45 && x.oil <= 0.05 * (x.water + x.oil)).sort((a, b) => b.water - a.water)[0];
      const of = c.beakers.filter((x) => x.oil >= 30 && x.water <= 0.05 * (x.water + x.oil)).sort((a, b) => b.oil - a.oil)[0];
      const wBest = c.beakers.slice().sort((a, b) => b.water - a.water)[0];
      const oBest = c.beakers.slice().sort((a, b) => b.oil - a.oil)[0];
      const pct = (x, k) => (x.water + x.oil > 0 ? Math.round(100 * x[k] / (x.water + x.oil)) : 0);
      return {
        success: !!wf && !!of,
        items: [
          { label: 'Wasserphase aufgefangen (≥ 45 mL, ≤ 5 % Öl)', ok: !!wf, detail: wf ? `${wf.name}: ${fmtMl(wf.water)} Wasser, ${pct(wf, 'oil')} % Öl` : wBest && wBest.water > 1 ? `${wBest.name}: ${fmtMl(wBest.water)} Wasser, ${pct(wBest, 'oil')} % Öl` : 'noch nicht' },
          { label: 'Ölphase aufgefangen (≥ 30 mL, ≤ 5 % Wasser)', ok: !!of, detail: of ? `${of.name}: ${fmtMl(of.oil)} Öl, ${pct(of, 'water')} % Wasser` : oBest && oBest.oil > 1 ? `${oBest.name}: ${fmtMl(oBest.oil)} Öl, ${pct(oBest, 'water')} % Wasser` : 'noch nicht' },
          lossLine(lab, ['water', 'oil'])
        ]
      };
    },
    observations(lab) {
      const c = ctx(lab);
      const usedSep = c.did('pour', (e) => e.to === 'S');
      return [
        { id: 'mix', q: 'Wie sah das Gemisch direkt nach dem Umrühren bzw. Einfüllen aus?', type: 'choice',
          options: [['cloudy', 'trüb, mit vielen Öltröpfchen; erst mit der Zeit bildeten sich zwei Schichten'], ['layers', 'sofort zwei klare Schichten'], ['clear', 'eine klare, einheitliche Flüssigkeit']], correct: 'cloudy' },
        { id: 'lower', q: 'Welche Flüssigkeit bildete die untere Schicht?', type: 'choice',
          options: [['water', 'Wasser'], ['oil', 'Öl'], ['none', 'Es gab keine Schichten.']], correct: usedSep || c.did('pour') ? 'water' : null,
          unavailable: usedSep || c.did('pour') ? '' : 'Beobachte zuerst die Schichten im Gefäß.' },
        { id: 'first', q: 'Welche Flüssigkeit läuft zuerst aus dem Hahn des Scheidetrichters?', type: 'choice',
          options: [['water', 'Wasser'], ['oil', 'Öl'], ['both', 'beide gleichzeitig']], correct: c.did('tap', (e) => e.tap > 0) ? 'water' : null,
          unavailable: c.did('tap', (e) => e.tap > 0) ? '' : 'Du hast den Hahn noch nicht geöffnet.' }
      ];
    },
    gaps: {
      text: 'Öl und Wasser sind nicht {misch}. Öl hat eine kleinere {dichte} als Wasser und schwimmt deshalb oben. Im {sch} lässt man die untere Schicht durch den geöffneten {hahn} ab. Ein Gemisch aus zwei nicht mischbaren Flüssigkeiten mit fein verteilten Tröpfchen heißt {emul}.',
      gaps: {
        misch: { accept: ['mischbar', 'ineinander löslich', 'ineinander mischbar', 'löslich'], hint: 'Die beiden Flüssigkeiten bilden immer wieder zwei Schichten.' },
        dichte: { accept: ['Dichte'], wrong: [{ terms: ['Masse', 'Gewicht', 'Schwere'], hint: 'Gemeint ist die Masse pro Volumen.' }], hint: 'Welche Stoffeigenschaft entscheidet, was oben schwimmt?' },
        sch: { accept: ['Scheidetrichter'], hint: 'Wie heißt das Gerät mit dem Hahn?' },
        hahn: { accept: ['Hahn', 'Ablasshahn', 'Glashahn'], hint: 'Womit öffnet man den Auslauf?' },
        emul: { accept: ['Emulsion'], wrong: [{ terms: ['Suspension'], hint: 'Eine Suspension ist ein Feststoff in einer Flüssigkeit.' }, { terms: ['Lösung'], hint: 'Eine Lösung ist klar und einheitlich.' }], hint: 'Fachbegriff für Flüssigkeitströpfchen in einer anderen Flüssigkeit.' }
      },
      bank: ['mischbar', 'Dichte', 'Scheidetrichter', 'Hahn', 'Emulsion', 'Suspension']
    },
    theory: [
      'Öl und Wasser lösen sich nicht ineinander. Beim Umrühren entsteht eine trübe <b>Emulsion</b>: Öltröpfchen sind im Wasser verteilt. In Ruhe fließen die Tröpfchen wieder zusammen.',
      'Öl hat eine kleinere <b>Dichte</b> als Wasser (Speiseöl etwa 0,92 g/mL, Wasser 1,00 g/mL). Deshalb bildet das Öl die obere, das Wasser die untere Schicht.',
      'Im <b>Scheidetrichter</b> lässt man nach dem Absetzen die untere Schicht durch den Hahn ab. Kurz vor der Grenzschicht öffnet man den Hahn nur noch wenig und schließt ihn, sobald die Grenze den Hahn erreicht. Die obere Schicht gießt man oben aus oder lässt sie in ein zweites Gefäß ab. Der Stopfen muss dabei abgenommen sein, sonst stockt der Abfluss.'
    ],
    notebook: () => ({
      title: 'Trennung von Öl und Wasser',
      sections: [
        ['Versuch', 'Ein verrührtes Gemisch aus Öl und Wasser wird in einen Scheidetrichter gefüllt und ruhig stehen gelassen. Dann wird die untere Schicht durch den Hahn in ein Becherglas abgelassen, die obere Schicht in ein zweites Becherglas.'],
        ['Beobachtung', 'Das Gemisch ist zunächst trüb. Nach kurzer Zeit bilden sich zwei Schichten: oben das gelbliche Öl, unten das Wasser. Beim Öffnen des Hahns läuft zuerst das Wasser heraus.'],
        ['Erklärung', 'Öl und Wasser sind nicht mischbar. Das Öl hat eine kleinere Dichte als Wasser und schwimmt oben. Die untere Schicht kann deshalb durch den Hahn abgelassen werden, ohne dass das Öl mitläuft.'],
        ['Merksatz', 'Nicht mischbare Flüssigkeiten mit unterschiedlicher Dichte trennt man im Scheidetrichter.']
      ]
    }),
    help(lab) {
      const c = ctx(lab);
      if (K04.check(lab).success) return EVAL_HELP;
      const S = c.d('S');
      const mixedBeaker = c.beakers.find((x) => x.water > 5 && x.oil > 5 && x.oil >= 0.25 * (x.water + x.oil));
      const waterOily = c.beakers.find((x) => x.water > 10 && x.oil > 0.05 * (x.water + x.oil) && x.oil < 0.25 * (x.water + x.oil));
      const rules = [
        R.sepNoReceiver,
        { when: () => c.st.tap > 0 && c.st.stopper, small: 'Warum läuft kaum etwas aus dem Hahn?', concrete: 'Nimm den Stopfen oben vom Scheidetrichter ab – sonst entsteht ein Unterdruck und der Abfluss stockt.' },
        { when: () => c.st.tap > 0 && S.water < 3 && S.oil > 5, small: 'Wo liegt die Grenzschicht gerade?', concrete: 'Die Grenzschicht erreicht gleich den Hahn. Stelle den Hahn auf „tropfenweise“ und schließe ihn, sobald nur noch Öl im Trichter ist.' },
        { when: () => c.st.insert && c.d('F').oil > 1, small: 'Kann Filterpapier zwei Flüssigkeiten trennen?', concrete: 'Beide Flüssigkeiten laufen durch das Filterpapier – so trennt man Öl und Wasser nicht. Nutze den Scheidetrichter.' },
        { when: () => S.liquid > 5 && S.disp > 2, small: 'Ist das Gemisch im Scheidetrichter schon klar in zwei Schichten getrennt?', concrete: 'Warte, bis die Trübung verschwunden ist und eine scharfe Grenzschicht zu sehen ist. Erst dann den Hahn öffnen.' },
        { when: () => S.water > 3 && S.oil > 3 && !c.lab.vesselAt('sep'), small: 'Wo soll die untere Schicht aufgefangen werden?', concrete: 'Stelle ein leeres Becherglas unter den Scheidetrichter, nimm den Stopfen ab und öffne dann den Hahn.' },
        { when: () => S.water > 3 && S.oil > 3, small: 'Welche Schicht kann man durch den Hahn zuerst ablassen?', concrete: 'Nimm den Stopfen ab und öffne den Hahn. Kurz vor der Grenzschicht auf „tropfenweise“ stellen, dann schließen.' },
        { when: () => S.water < 0.5 && S.oil > 5 && c.beakers.some((x) => x.water > 40), small: 'Das Wasser ist abgelassen. Wohin kommt das Öl?', concrete: 'Stelle ein zweites leeres Becherglas unter den Scheidetrichter und lass das Öl ab – oder gieße es oben aus („Ausgießen“).' },
        { when: () => !!waterOily, small: () => `Ist die Flüssigkeit in ${waterOily && waterOily.name} rein?`, concrete: () => `In ${waterOily && waterOily.name} schwimmt noch Öl – der Hahn war zu lange offen. Gieße die Mischung zurück in den Scheidetrichter, lass sie absetzen und lass die untere Schicht noch einmal ab.` },
        { when: () => !!mixedBeaker, small: 'Welches Gerät trennt zwei Flüssigkeitsschichten sauber?', concrete: () => `Gieße ${mixedBeaker && mixedBeaker.name} vollständig in den Scheidetrichter (Hahn geschlossen, Stopfen ab) und lass das Gemisch ruhig stehen.` },
        { when: () => true, small: 'Öl und Wasser unterscheiden sich in ihrer Dichte.', concrete: 'Fülle das Gemisch in den Scheidetrichter, warte auf zwei klare Schichten und lass die untere Schicht durch den Hahn ab.' }
      ];
      return pickHelp(rules.map((r) => Object.assign({}, r, { when: () => r.when(c) })), c);
    }
  };

  // ============================================================ K-05
  function teaInfo(c) {
    const tea = c.beakers.filter((x) => x.water >= 40 && x.petals <= 0.05).sort((a, b) => b.dyeConc - a.dyeConc)[0];
    const ex = c.st.extractions;
    const cold = ex.filter((e) => e.startT <= 30).sort((a, b) => b.contact - a.contact)[0];
    const hot = ex.filter((e) => e.startT >= 70).sort((a, b) => b.contact - a.contact)[0];
    return { tea, cold, hot };
  }
  const K05 = {
    id: 'K-05', lab: 'classic', short: 'Hibiskustee',
    title: 'Hibiskustee durch Extraktion herstellen',
    problem: 'Stelle aus getrockneten Hibiskusblüten einen Tee her, der keine Blütenreste mehr enthält. Finde dabei heraus, wie die Wassertemperatur das Herauslösen der Farbstoffe beeinflusst: Setze einen Ansatz mit kaltem und einen mit heißem Wasser an.',
    goal: 'Ein kräftig roter Tee (≥ 40 mL) ohne Blütenreste sowie je ein Ansatz mit kaltem und mit heißem Wasser (jeweils mindestens 2 min Ziehzeit).',
    materials: ['getrocknete Hibiskusblüten (Dose, 2 g je Portion, insgesamt 8 g)', 'Wasser kalt (Spritzflasche, 20 °C) und heiß (Wasserkocher, ca. 90 °C)', 'drei leere Bechergläser', 'Glasstab', 'Trichter mit Filterpapier, Teesieb', 'Ausguss'],
    setup: { equip: { funnel: true, sieve: true, kettle: true, hibiscus: true }, hibiscusStock: 8, vessels: { B1: {}, B2: {}, B3: {} } },
    check(lab) {
      const c = ctx(lab);
      const { tea, cold, hot } = teaInfo(c);
      const teaOk = tea && tea.dyeConc >= 1.0 && tea.frag <= 0.25;
      const min = (e) => (e ? `${fmt(e.contact / 60, 1)} min` : '–');
      return {
        success: !!teaOk && !!cold && cold.contact >= 120 && !!hot && hot.contact >= 120,
        items: [
          { label: 'Ansatz mit kaltem Wasser (≥ 2 min)', ok: !!cold && cold.contact >= 120, detail: cold ? `${lab.nameOf(cold.vessel)}: ${min(cold)}` : 'noch nicht' },
          { label: 'Ansatz mit heißem Wasser (≥ 2 min)', ok: !!hot && hot.contact >= 120, detail: hot ? `${lab.nameOf(hot.vessel)}: ${min(hot)}` : 'noch nicht' },
          { label: 'Tee ohne Blütenreste, kräftig rot (≥ 40 mL)', ok: !!teaOk, detail: tea ? `${tea.name}: ${fmtMl(tea.water)}, Farbstoffe ${fmt(tea.dyeConc)} mg/mL${tea.frag > 0.01 ? `, feine Teilchen ${fmtG(tea.frag)}` : ''}` : (() => { const b = c.beakers.filter((x) => x.water > 10).sort((a, b2) => b2.dyeConc - a.dyeConc)[0]; return b ? `${b.name}: ${fmtMl(b.water)}, ${b.petals > 0.05 ? 'enthält Blütenreste' : 'zu wenig'}` : 'noch nicht'; })() }
        ]
      };
    },
    observations(lab) {
      const c = ctx(lab);
      const { tea, cold, hot } = teaInfo(c);
      const both = cold && hot && cold.contact >= 60 && hot.contact >= 60;
      const filtered = c.did('filtrate');
      const insert = c.log.filter((e) => e.type === 'insert').map((e) => e.insert);
      return [
        { id: 'faster', q: 'Bei welcher Wassertemperatur färbte sich das Wasser schneller rot?', type: 'choice',
          options: [['hot', 'mit heißem Wasser'], ['cold', 'mit kaltem Wasser'], ['same', 'gleich schnell']], correct: both ? 'hot' : null,
          unavailable: both ? '' : 'Vergleiche zuerst einen kalten und einen heißen Ansatz.' },
        { id: 'kept', q: `Was hielt ${insert.includes('sieve') && !insert.includes('paper') ? 'das Teesieb' : 'das Filterpapier'} zurück?`, type: 'choice',
          options: [['plant', 'die Blütenreste'], ['dye', 'den roten Farbstoff'], ['water', 'einen Teil des Wassers als Feststoff']], correct: filtered ? 'plant' : null,
          unavailable: filtered ? '' : 'Du hast den Tee noch nicht abgesiebt oder filtriert.' },
        { id: 'pure', q: 'Ist dein abfiltrierter Hibiskustee ein Reinstoff?', type: 'choice',
          options: [['mixture', 'Nein – er ist ein Stoffgemisch: Wasser mit vielen gelösten Farb- und Geschmacksstoffen.'], ['pureFilter', 'Ja – durch das Filtrieren wurde er rein.'], ['pureDye', 'Ja – er besteht nur aus rotem Farbstoff.']], correct: tea ? 'mixture' : null,
          unavailable: tea ? '' : 'Stelle zuerst einen Tee ohne Blütenreste her.' }
      ];
    },
    gaps: {
      text: 'Heißes Wasser löst die Farb- und Geschmacksstoffe {schnell} aus den Blüten als kaltes. Das Herauslösen von Stoffen mithilfe eines Lösungsmittels nennt man {extr}. Hier ist das Lösungsmittel {wass}. Die festen Blütenreste trennt man anschließend durch {filt} ab. Der fertige Tee ist kein Reinstoff, sondern ein {gem}.',
      gaps: {
        schnell: { accept: ['schneller', 'rascher', 'besser'], wrong: [{ terms: ['langsamer'], hint: 'Vergleiche deine beiden Ansätze.' }], hint: 'Vergleiche heiß und kalt.' },
        extr: { accept: ['Extraktion', 'Extrahieren', 'Extrahierung'], wrong: [{ terms: ['Filtration', 'Filtrieren'], hint: 'Filtrieren trennt die Feststoffe ab. Gesucht ist das Herauslösen.' }], hint: 'Fachbegriff für das Herauslösen mit einem Lösungsmittel.' },
        wass: { accept: ['Wasser'], hint: 'Womit hast du die Blüten übergossen?' },
        filt: { accept: ['Filtrieren', 'Filtration', 'Sieben', 'Absieben', 'Abseihen', 'Filtern'], wrong: [{ terms: ['Extraktion', 'Extrahieren'], hint: 'Gesucht ist das Abtrennen der festen Reste.' }], hint: 'Wie trennt man feste Reste von einer Flüssigkeit?' },
        gem: { accept: ['Stoffgemisch', 'Gemisch', 'Lösung', 'Gemenge'], wrong: [{ terms: ['Reinstoff'], hint: 'Im Tee sind viele verschiedene Stoffe gelöst.' }], hint: 'Ein Stoff aus mehreren Stoffen heißt …' }
      },
      bank: ['schneller', 'langsamer', 'Extraktion', 'Wasser', 'Filtrieren', 'Stoffgemisch', 'Reinstoff']
    },
    theory: [
      'In den Hibiskusblüten stecken rote Farbstoffe, Fruchtsäuren und Geschmacksstoffe. Sie sind in Wasser <b>löslich</b>, die Zellwände der Blüten nicht.',
      'Beim Übergießen mit Wasser wandern die löslichen Stoffe aus den Blüten ins Wasser: Das ist die <b>Extraktion</b> mit dem Lösungsmittel Wasser. In heißem Wasser bewegen sich die Teilchen schneller – die Stoffe werden schneller herausgelöst.',
      'Durch <b>Sieben</b> oder <b>Filtrieren</b> trennt man die festen Blütenreste ab. Die gelösten Farbstoffe laufen mit dem Wasser hindurch. Ein feines Teesieb lässt kleine Teilchen durch, Filterpapier nicht.',
      'Der Tee bleibt ein <b>Stoffgemisch</b>: Wasser mit vielen gelösten Stoffen. Filtrieren macht ihn nicht zum Reinstoff, es entfernt nur die Feststoffe.'
    ],
    notebook: () => ({
      title: 'Extraktion: Herstellung von Hibiskustee',
      sections: [
        ['Versuch', 'Getrocknete Hibiskusblüten werden in zwei Bechergläsern mit kaltem bzw. heißem Wasser übergossen und einige Minuten stehen gelassen. Anschließend werden die Blütenreste durch ein Sieb oder Filterpapier abgetrennt.'],
        ['Beobachtung', 'Das Wasser färbt sich rot. Mit heißem Wasser geht das deutlich schneller als mit kaltem. Im Sieb bzw. Filter bleiben die Blütenreste zurück, der rote Tee läuft hindurch.'],
        ['Erklärung', 'Die Farb- und Geschmacksstoffe sind in Wasser löslich und werden aus den Blüten herausgelöst (Extraktion). In heißem Wasser bewegen sich die Teilchen schneller, die Extraktion läuft schneller ab. Die unlöslichen Blütenreste werden durch Filtrieren abgetrennt.'],
        ['Merksatz', 'Bei der Extraktion löst man Stoffe mit einem geeigneten Lösungsmittel aus einem Gemisch heraus. Der Tee ist ein Stoffgemisch, kein Reinstoff.']
      ]
    }),
    help(lab) {
      const c = ctx(lab);
      if (K05.check(lab).success) return EVAL_HELP;
      const { tea, cold, hot } = teaInfo(c);
      const withPlants = c.beakers.filter((x) => x.plant > 0.3);
      const rules = [
        R.funnelNoReceiver,
        { when: () => !withPlants.length && !c.did('hibiscus'), small: 'Woraus soll der Tee entstehen?', concrete: 'Gib Hibiskusblüten in ein Becherglas: Becherglas antippen → „Hibiskusblüten zugeben“ (2 g je Portion).' },
        { when: () => withPlants.some((x) => x.water < 5), small: 'Womit werden die Farbstoffe aus den Blüten gelöst?', concrete: () => { const x = withPlants.find((y) => y.water < 5); return `Übergieße die Blüten in ${x.name} mit Wasser – einmal kalt, in einem zweiten Becherglas heiß.`; } },
        { when: () => !hot && !!cold, small: 'Du hast nur einen kalten Ansatz. Womit vergleichst du ihn?', concrete: 'Gib Blüten in ein zweites Becherglas und übergieße sie mit heißem Wasser aus dem Wasserkocher.' },
        { when: () => !cold && !!hot, small: 'Du hast nur einen heißen Ansatz. Womit vergleichst du ihn?', concrete: 'Gib Blüten in ein zweites Becherglas und übergieße sie mit kaltem Wasser aus der Spritzflasche.' },
        { when: () => (cold && cold.contact < 120 && cold.open) || (hot && hot.contact < 120 && hot.open), small: 'Wie lange brauchen die Farbstoffe, um aus den Blüten ins Wasser zu gehen?', concrete: 'Lass beide Ansätze mindestens 2 Minuten ziehen (Zeitraffer). Umrühren beschleunigt das Herauslösen etwas.' },
        { when: () => c.st.F && c.d('F').liquid > 3 && c.st.insert === null, small: 'Was hält im Trichter die Blütenreste zurück?', concrete: 'Im Trichter fehlt ein Einsatz. Setze Filterpapier oder das Teesieb ein.' },
        R.pouring, R.filtering,
        { when: () => !tea && c.beakers.some((x) => x.water > 20 && x.petals > 0.05 && x.dyeConc > 0.5), small: 'Im Tee schwimmen noch Blüten. Wie trennt man sie ab?', concrete: 'Setze Filterpapier oder das Teesieb in den Trichter, stelle ein leeres Becherglas darunter und gieße den heißen Ansatz hinein.' },
        { when: () => tea && tea.frag > 0.25, small: 'Sind wirklich keine Pflanzenteilchen mehr im Tee?', concrete: 'Durch das Teesieb sind feine Teilchen gelaufen. Filtriere den Tee noch einmal durch Filterpapier.' },
        { when: () => tea && tea.dyeConc < 1, small: 'Ist dein Tee schon kräftig rot?', concrete: 'Der Tee ist noch zu hell. Lass die Blüten länger ziehen – am besten in heißem Wasser – und filtriere dann.' },
        { when: () => true, small: 'Welche Stoffe der Blüten lösen sich in Wasser?', concrete: 'Zwei Ansätze (kalt und heiß) ziehen lassen, dann den kräftigeren durch Filterpapier oder Sieb gießen.' }
      ];
      return pickHelp(rules.map((r) => Object.assign({}, r, { when: () => r.when(c) })), c);
    }
  };

  K01.help = function (lab) {
    const c = ctx(lab);
    if (K01.check(lab).success) return EVAL_HELP;
    const w = bestWater(c, 20);
    const rules = [
      R.funnelNoReceiver,
      { when: () => c.st.F && c.st.insert === null && c.did('pour', (e) => e.to === 'F'), small: 'Was soll im Trichter den Sand zurückhalten?', concrete: 'Im Trichter fehlt das Filterpapier – der Sand läuft mit hindurch. Setze „Filterpapier (gefaltet)“ ein und filtriere das trübe Wasser erneut.' },
      { when: () => c.st.insert === 'paperFlat', small: 'Liegt das Filterpapier dicht an der Trichterwand an?', concrete: 'Ein ungefaltetes Filterpapier liegt nicht dicht an; an der Seite läuft trübe Flüssigkeit vorbei. Nimm es heraus und setze ein gefaltetes Filterpapier ein.' },
      R.pouring, R.filtering,
      { when: () => c.d('B1').sand > 12 && c.d('B1').water > 60 && c.d('B1').turbidity > 0.6, small: 'Was passiert mit dem Sand, wenn das Gemisch eine Weile in Ruhe steht?', concrete: 'Warte, bis sich der Sand in Becherglas 1 abgesetzt hat (Zeitraffer nutzen). Gieße dann mit „Vorsichtig abgießen“ in ein leeres Becherglas ab – oder filtriere.' },
      { when: () => c.d('B1').sand > 12 && c.d('B1').water > 60, small: 'Der Sand liegt jetzt unten. Wie bekommst du das Wasser darüber in ein anderes Gefäß, ohne den Sand aufzuwirbeln?', concrete: 'Becherglas 1 antippen, Ziel Becherglas 2 wählen und „Vorsichtig abgießen“ benutzen.' },
      { when: () => w && w.turbidityClass !== 'klar', small: () => `Ist das Wasser in ${w && w.name} wirklich klar? Woher kommt die Trübung?`, concrete: () => `In ${w && w.name} schwebt mitgerissener Sand. Lass das Becherglas ruhig stehen, bis sich der Sand abgesetzt hat, und gieße dann vorsichtig in ein leeres Becherglas ab – oder filtriere mit gefaltetem Filterpapier.` },
      { when: () => w && w.sand > 0.3, small: () => `In ${w && w.name} liegt noch Sand.`, concrete: () => `Gieße das klare Wasser aus ${w && w.name} vorsichtig in ein leeres Becherglas ab; der Sand bleibt zurück.` },
      { when: () => !bestWater(c, 60) && lab.balance().where.water.filter((x) => x.lost).reduce((s, x) => s + x.amount, 0) > 40, small: 'Wie viel Wasser ist noch übrig?', concrete: 'Zu viel Wasser ist verloren gegangen. Beginne die Aufgabe mit „Neu beginnen“ noch einmal.' },
      { when: () => true, small: 'Sand und Wasser unterscheiden sich in Löslichkeit und Dichte. Welche Eigenschaft kannst du nutzen?', concrete: 'Lass den Sand absetzen und gieße das Wasser vorsichtig ab (Dekantieren) – oder gieße das Gemisch durch einen Trichter mit gefaltetem Filterpapier in ein leeres Becherglas.' }
    ];
    return pickHelp(rules.map((r) => Object.assign({}, r, { when: () => r.when(c) })), c);
  };

  const TASKS = [K01, K02, K03, K04, K05];
  for (const t of TASKS) t.createEngine = () => classic.create(util.clone(t.setup));
  return { TASKS, ctx, EVAL_HELP };
});
