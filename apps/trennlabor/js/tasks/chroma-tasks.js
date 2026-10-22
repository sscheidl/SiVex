/*
 * Trennlabor – Aufgaben zur Papierchromatographie (C-1 bis C-4)
 * Alle Aufgaben teilen sich ein Labor: Eigene Chromatogramme (auch frühere,
 * abgelegte) beantworten die Fragen. Bewertet werden nur tatsächlich
 * entwickelte Chromatogramme.
 */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const chroma = node ? require('../model/chroma.js') : root.TL.chroma;
  const util = node ? require('../util.js') : root.TL.util;
  const api = factory(chroma, util);
  if (node) module.exports = api;
  else ((root.TL = root.TL || {}).tasks = root.TL.tasks || {}).chroma = api;
})(typeof self !== 'undefined' ? self : this, function (chroma, util) {
  'use strict';
  const { fmt } = util;
  const PEN = chroma.PEN_BY_ID;
  const FELT = ['black', 'green', 'purple', 'orange'];
  const COLOR_WORD = { yellow: 'gelb', blue: 'blau', red: 'rot', violet: 'violett', permBlack: 'schwarz', ballpoint: 'blau (Kugelschreiber)' };

  /** Alle entwickelten Chromatogramme (abgelegt und aktuelles) mit Befund. */
  function papers(lab) {
    const st = lab.state;
    const list = st.archive.map((p) => ({ p, r: lab.evaluatePaper(p) }));
    const cur = st.paper;
    if (cur && !cur.archived && (cur.state === 'drying' || cur.state === 'dry')) list.push({ p: cur, r: lab.evaluatePaper(cur) });
    return list;
  }
  const label = (x) => `Chromatogramm Nr. ${x.p.no}, ${chroma.ELUENTS[x.p.eluent].short}`;

  /** Letzte Bahn einer Probe, die die Bedingung erfüllt. */
  function lastLane(list, pen, pred) {
    for (let i = list.length - 1; i >= 0; i--) {
      const x = list[i];
      if (pred && !pred(x)) continue;
      const lane = x.r.lanes.find((l) => l.pen === pen);
      if (lane) return { x, lane };
    }
    return null;
  }

  const EVAL_HELP = {
    small: 'Deine Chromatogramme reichen aus. Sieh sie dir im Vergleich genau an: Farben, Anzahl der Zonen, Laufstrecken.',
    concrete: 'Öffne „Auswertung“ und nutze „Chromatogramme vergleichen“. Unter dem Lückentext steht jetzt eine Wortauswahl.'
  };

  /** Hilfe zum aktuellen Papier (gilt für alle Chromatographie-Aufgaben). */
  function paperHelp(lab) {
    const st = lab.state, p = st.paper;
    const ch = st.chamber;
    if (!p || p.archived) return { small: 'Was brauchst du als stationäre Phase?', concrete: 'Nimm ein neues Chromatographiepapier („Neues Papier“).' };
    if (p.state === 'fresh') {
      if (!p.line) return { small: 'Woran erkennst du später, wo die Proben gestartet sind?', concrete: 'Zeichne zuerst mit dem Bleistift eine Startlinie, etwa 1,5 cm über dem unteren Rand. Bleistift löst sich im Laufmittel nicht.' };
      if (p.line.tool === 'ballpoint') return { small: 'Löst sich Kugelschreiberfarbe im Laufmittel?', concrete: 'Die Startlinie ist mit Kugelschreiber gezogen; seine Farbe wandert mit. Nimm ein neues Papier und zeichne die Linie mit Bleistift.' };
      if (!p.spots.length) return { small: 'Wie bringst du die Probe auf das Papier?', concrete: 'Wähle einen Stift und eine Bahn und tupfe einen kleinen Punkt auf die Startlinie (1- bis 2-mal tupfen genügt).' };
      if (p.spots.some((s) => s.load >= chroma.OVERLOAD)) return { small: 'Wie groß sollte ein Probenfleck sein?', concrete: 'Der Fleck ist zu groß – die Zonen werden unscharf und laufen ineinander. Nimm ein neues Papier und tupfe nur 1- bis 2-mal.' };
      if (!ch.eluent) return { small: 'Was soll die Farbstoffe über das Papier transportieren?', concrete: 'Fülle ein Laufmittel in die Kammer – nur so hoch, dass die Startlinie deutlich darüber liegt.' };
      if (ch.level >= (p.line ? p.line.y : 1.5) - 0.15) return { small: 'Wo liegt die Startlinie im Vergleich zum Flüssigkeitsspiegel?', concrete: `Der Laufmittelspiegel (${fmt(ch.level)} cm) reicht bis an die Startlinie (${fmt(p.line ? p.line.y : 1.5)} cm). Gieße Laufmittel ab bzw. fülle weniger ein, oder ziehe die Startlinie höher.` };
      return { small: 'Alles vorbereitet?', concrete: 'Stelle das Papier in die Kammer und lege den Deckel auf.' };
    }
    if (p.state === 'developing') {
      if (p.submerged) return { small: 'Was passiert mit Proben, die im Laufmittel stehen?', concrete: 'Die Proben lösen sich im Laufmittel auf – dieses Chromatogramm wird unbrauchbar. Nimm es heraus und beginne mit einem neuen Papier; die Startlinie muss über dem Flüssigkeitsspiegel liegen.' };
      const left = chroma.PAPER_LEN - p.front;
      if (p.front >= chroma.PAPER_LEN - 0.05) return { small: 'Wo ist die Laufmittelfront jetzt?', concrete: 'Das Laufmittel hat den oberen Rand erreicht. Nimm das Papier heraus – die Front lässt sich jetzt nicht mehr sicher bestimmen.' };
      if (left < 3) return { small: 'Wie weit soll die Front steigen?', concrete: 'Die Front ist fast oben. Nimm das Papier jetzt heraus, bevor sie den Rand erreicht.' };
      return { small: 'Beobachte die Laufmittelfront und die Farbzonen.', concrete: 'Warte, bis die Front etwa 2 bis 3 cm unter dem oberen Rand ist (Zeitraffer). Dann Papier herausnehmen und die Front markieren.' };
    }
    if (p.state === 'drying' && !p.frontMark) return { small: 'Was musst du direkt nach dem Herausnehmen festhalten?', concrete: 'Markiere sofort die Laufmittelfront mit dem Bleistift – nach dem Trocknen ist sie nicht mehr zu sehen.' };
    return null;
  }

  // ============================================================ C-1
  const C1 = {
    id: 'C-1', lab: 'chroma', short: 'Mehrere Farbstoffe?',
    title: 'Welche Stifte enthalten mehrere Farbstoffe?',
    problem: 'Untersuche die Proben mit Papierchromatographie. Finde heraus, welche Stifte aus mehreren Farbstoffen bestehen. Vergleiche mit einem Referenzfarbstoff.',
    goal: 'Saubere Chromatogramme von mindestens drei Proben, darunter ein Filzstift mit mehreren Farbzonen und ein Referenzfarbstoff.',
    materials: ['7 Proben: Filzstifte Schwarz, Grün, Violett, Orange; Referenzfarbstoffe Blau und Gelb; wasserfester schwarzer Stift', 'Chromatographiepapier (breit, 3 Bahnen) oder schmaler Streifen', 'Bleistift, Kugelschreiber', 'Entwicklungskammer mit Deckel', 'Laufmittel: Wasser; Ethanol-Wasser-Gemisch 7 : 3'],
    check(lab) {
      const list = papers(lab).filter((x) => x.r.clean);
      const pens = new Set();
      let multi = null, ref = null;
      for (const x of list) for (const l of x.r.lanes) {
        pens.add(l.pen);
        if (FELT.includes(l.pen) && l.bands >= 2 && l.moved) multi = multi || { x, l };
        if (PEN[l.pen].reference && l.bands === 1 && l.moved) ref = ref || { x, l };
      }
      const all = papers(lab);
      const unclean = all.filter((x) => !x.r.clean).length;
      return {
        success: pens.size >= 3 && !!multi && !!ref,
        items: [
          { label: 'Saubere Chromatogramme von ≥ 3 Proben', ok: pens.size >= 3, detail: pens.size ? `${pens.size}: ${Array.from(pens).map((id) => PEN[id].name).join(', ')}` : 'noch keine' },
          { label: 'Filzstift mit mehreren Farbzonen', ok: !!multi, detail: multi ? `${PEN[multi.l.pen].name}: ${multi.l.bands} Zonen (${label(multi.x)})` : 'noch nicht' },
          { label: 'Referenzfarbstoff untersucht', ok: !!ref, detail: ref ? `${PEN[ref.l.pen].name}: 1 Zone (${label(ref.x)})` : 'noch nicht' },
          { label: 'Gestörte oder unbrauchbare Chromatogramme', ok: true, info: true, detail: String(unclean) }
        ]
      };
    },
    observations(lab) {
      const list = papers(lab).filter((x) => x.r.clean);
      const obs = [];
      for (const pen of chroma.PENS) {
        const f = lastLane(list, pen.id);
        if (!f) continue;
        obs.push({ id: 'n_' + pen.id, q: `Wie viele getrennte Farbzonen zeigt „${pen.name}“?`, type: 'number', correct: f.lane.bands, tol: 0, unit: 'Zonen', note: label(f.x) });
      }
      if (!obs.length) obs.push({ id: 'n_none', q: 'Wie viele Farbzonen zeigen deine Proben?', type: 'number', correct: null, unavailable: 'Entwickle zuerst ein sauberes Chromatogramm.' });
      const ref = chroma.PENS.filter((p) => p.reference).map((p) => lastLane(list, p.id)).find(Boolean);
      obs.push({ id: 'refMeaning', q: 'Was folgt daraus, dass der Referenzfarbstoff nur eine Farbzone ergibt?', type: 'choice',
        options: [['hint', 'Das spricht dafür, dass er ein Reinstoff ist – ein Beweis ist es nicht, denn zwei Farbstoffe könnten gleich weit wandern.'], ['proof', 'Damit ist bewiesen, dass er ein Reinstoff ist.'], ['mix', 'Er ist sicher ein Stoffgemisch.']],
        correct: ref ? 'hint' : null, unavailable: ref ? '' : 'Untersuche zuerst einen Referenzfarbstoff.' });
      return obs;
    },
    gaps: {
      text: 'Das Laufmittel ist die {mob} Phase, das Papier die {stat} Phase. Ein Farbstoff wandert umso weiter, je besser er sich im Laufmittel {loes} und je schwächer er an der Oberfläche des Papiers haftet. Dieses Anhaften von Teilchen an einer Oberfläche heißt {ads}. Ein Stift, dessen Probe mehrere Farbzonen ergibt, enthält ein {gem} aus Farbstoffen.',
      gaps: {
        mob: { accept: ['mobile', 'bewegliche', 'mobil', 'bewegte'], wrong: [{ terms: ['stationäre', 'stationär', 'feste', 'ruhende'], hint: 'Das Laufmittel bewegt sich durch das Papier.' }], hint: 'Bewegt sich das Laufmittel oder ruht es?' },
        stat: { accept: ['stationäre', 'stationär', 'ruhende', 'feste', 'unbewegliche'], wrong: [{ terms: ['mobile', 'mobil', 'bewegliche'], hint: 'Das Papier bleibt an seinem Platz.' }], hint: 'Das Papier bewegt sich nicht.' },
        loes: { accept: ['löst', 'auflöst'], hint: 'Was muss ein Farbstoff im Laufmittel tun, um mitzuwandern?' },
        ads: { accept: ['Adsorption', 'Adsorbtion'], wrong: [{ terms: ['Absorption', 'Absorbtion', 'Absorbieren'], hint: 'Absorption bedeutet Aufnahme ins Innere eines Stoffes. Hier lagern sich Teilchen an der Oberfläche an – das ist die Adsorption (mit d).' }], hint: 'Fachbegriff für das Anlagern an eine Oberfläche.' },
        gem: { accept: ['Gemisch', 'Stoffgemisch', 'Farbstoffgemisch'], wrong: [{ terms: ['Reinstoff'], hint: 'Mehrere Zonen bedeuten mehrere Stoffe.' }], hint: 'Mehrere Stoffe zusammen bilden ein …' }
      },
      bank: ['mobile', 'stationäre', 'löst', 'Adsorption', 'Absorption', 'Gemisch', 'Reinstoff']
    },
    theory: [
      'Bei der Papierchromatographie steigt das <b>Laufmittel</b> (mobile Phase) durch die feinen Fasern des Papiers nach oben. Das Papier ist die <b>stationäre Phase</b>.',
      'Erreicht das Laufmittel den Startfleck, <b>lösen</b> sich die Farbstoffe darin und werden mitgenommen. Gleichzeitig lagern sie sich immer wieder an der Papieroberfläche an: <b>Adsorption</b>.',
      'Jeder Farbstoff hat eine eigene Balance aus Löslichkeit im Laufmittel und Adsorption am Papier. Gut lösliche, schwach adsorbierte Farbstoffe wandern weit, stark adsorbierte bleiben zurück. So trennt sich ein <b>Farbstoffgemisch</b> in mehrere Zonen auf.',
      'Ein Farbstoff, der nur eine Zone ergibt, ist vermutlich ein <b>Reinstoff</b>. Ein sicherer Beweis ist das nicht: Zwei Farbstoffe könnten mit diesem Laufmittel zufällig gleich weit wandern.'
    ],
    notebook: () => ({
      title: 'Papierchromatographie von Filzstiftfarben',
      sections: [
        ['Versuch', 'Auf ein Chromatographiepapier wird mit Bleistift eine Startlinie gezogen. Auf die Linie werden kleine Punkte verschiedener Filzstifte und eines Referenzfarbstoffs getupft. Das Papier wird in eine Kammer mit wenig Laufmittel gestellt, sodass die Startlinie über dem Flüssigkeitsspiegel liegt.'],
        ['Beobachtung', 'Das Laufmittel steigt im Papier nach oben. Die Farbe des schwarzen Filzstifts trennt sich in mehrere farbige Zonen auf, ebenso die von Grün, Violett und Orange. Der Referenzfarbstoff bildet nur eine Zone.'],
        ['Erklärung', 'Das Laufmittel (mobile Phase) löst die Farbstoffe und transportiert sie durch das Papier (stationäre Phase). Die Farbstoffe haften unterschiedlich stark am Papier (Adsorption) und lösen sich unterschiedlich gut im Laufmittel. Deshalb wandern sie verschieden weit.'],
        ['Merksatz', 'Die Chromatographie trennt Stoffgemische aufgrund unterschiedlicher Löslichkeit im Laufmittel und unterschiedlich starker Adsorption an der stationären Phase. Eine einzelne Zone ist ein Hinweis auf einen Reinstoff, aber kein Beweis.']
      ]
    }),
    help(lab) {
      if (C1.check(lab).success) return EVAL_HELP;
      const ph = paperHelp(lab);
      if (ph && lab.state.paper && !lab.state.paper.archived && lab.state.paper.state !== 'dry') return ph;
      const list = papers(lab).filter((x) => x.r.clean);
      if (!list.length) return ph || { small: 'Welche Proben möchtest du vergleichen?', concrete: 'Trage z. B. Schwarz, Grün und den blauen Referenzfarbstoff nebeneinander auf und entwickle mit Wasser.' };
      return { small: 'Hast du schon einen Stift und einen Referenzfarbstoff nebeneinander untersucht?', concrete: 'Trage auf einem neuen Papier z. B. Schwarz, Grün und den blauen Referenzfarbstoff auf drei Bahnen auf und entwickle mit Wasser.' };
    }
  };

  // ============================================================ C-2
  function commonPair(lab) {
    const list = papers(lab).filter((x) => x.r.clean);
    for (const el of ['water', 'ethanol']) {
      const g = lastLane(list, 'green', (x) => x.p.eluent === el);
      const v = lastLane(list, 'purple', (x) => x.p.eluent === el);
      if (g && v && g.lane.moved && v.lane.moved) return { el, g, v };
    }
    return null;
  }
  const C2 = {
    id: 'C-2', lab: 'chroma', short: 'Gemeinsamer Farbstoff',
    title: 'Haben Grün und Violett einen gemeinsamen Farbstoff?',
    problem: 'Der grüne und der violette Filzstift sehen ganz verschieden aus. Prüfe mit der Chromatographie, ob sie trotzdem einen gleichen Farbstoff enthalten.',
    goal: 'Saubere Chromatogramme von Grün und Violett mit demselben Laufmittel – am besten nebeneinander auf einem Papier.',
    materials: C1.materials,
    check(lab) {
      const pair = commonPair(lab);
      return {
        success: !!pair,
        items: [
          { label: 'Grün und Violett mit gleichem Laufmittel entwickelt', ok: !!pair, detail: pair ? `${label(pair.g.x)}${pair.g.x.p.no === pair.v.x.p.no ? ' (nebeneinander)' : ` und ${label(pair.v.x)}`}` : 'noch nicht' }
        ]
      };
    },
    observations(lab) {
      const pair = commonPair(lab);
      let common = null;
      if (pair) {
        const both = pair.g.lane.comps.filter((cid) => pair.v.lane.comps.includes(cid));
        common = both.length ? both[0] : 'none';
      }
      return [
        { id: 'common', q: 'Welche Farbzone kommt bei Grün und bei Violett auf gleicher Höhe vor?', type: 'choice',
          options: [['yellow', 'eine gelbe Zone'], ['blue', 'eine blaue Zone'], ['red', 'eine rote Zone'], ['violet', 'eine violette Zone'], ['none', 'keine']],
          correct: common, unavailable: pair ? '' : 'Entwickle zuerst Grün und Violett mit demselben Laufmittel.', note: pair ? label(pair.g.x) : '' },
        { id: 'why', q: 'Woran erkennst du, dass es derselbe Farbstoff ist?', type: 'choice',
          options: [['same', 'gleiche Farbe und gleiche Laufstrecke beim selben Laufmittel'], ['color', 'nur an der gleichen Farbe'], ['size', 'an der gleichen Größe der Flecken']], correct: pair ? 'same' : null,
          unavailable: pair ? '' : 'Entwickle zuerst Grün und Violett mit demselben Laufmittel.' }
      ];
    },
    gaps: {
      text: 'Gleiche Farbstoffe wandern mit demselben Laufmittel gleich {weit}. Grün und Violett enthalten beide den {farbe} Farbstoff. Grün enthält außerdem einen gelben, Violett einen {rot} Farbstoff.',
      gaps: {
        weit: { accept: ['weit', 'hoch', 'schnell'], hint: 'Vergleiche die Laufstrecken.' },
        farbe: { accept: ['blauen', 'blau'], wrong: [{ terms: ['gelben', 'roten', 'gelb', 'rot'], hint: 'Schau, welche Zone in beiden Bahnen auf gleicher Höhe liegt.' }], hint: 'Welche Farbe hat die gemeinsame Zone?' },
        rot: { accept: ['roten', 'rot', 'pinken', 'magentafarbenen'], wrong: [{ terms: ['blauen', 'gelben'], hint: 'Welche Zone hat nur Violett?' }], hint: 'Welche Zone hat nur Violett?' }
      },
      bank: ['weit', 'blauen', 'roten', 'gelben']
    },
    theory: [
      'Bei gleichem Laufmittel und gleichem Papier wandert ein bestimmter Farbstoff immer gleich weit. Zonen gleicher Farbe auf gleicher Höhe stammen deshalb sehr wahrscheinlich vom selben Farbstoff.',
      'Grün entsteht hier aus Gelb und Blau, Violett aus Rot und Blau. Beide Stifte enthalten denselben blauen Farbstoff. Am sichersten vergleicht man, wenn die Proben nebeneinander auf demselben Papier laufen.'
    ],
    notebook: () => ({
      title: 'Vergleich von Farbstoffen durch Chromatographie',
      sections: [
        ['Versuch', 'Grüner und violetter Filzstift werden nebeneinander auf dieselbe Startlinie getupft und mit demselben Laufmittel entwickelt.'],
        ['Beobachtung', 'Grün trennt sich in eine gelbe und eine blaue Zone, Violett in eine rote und eine blaue Zone. Die blauen Zonen liegen auf gleicher Höhe.'],
        ['Erklärung', 'Ein Farbstoff wandert unter gleichen Bedingungen immer gleich weit. Gleiche Farbe und gleiche Laufstrecke zeigen, dass beide Stifte denselben blauen Farbstoff enthalten.'],
        ['Merksatz', 'Mit der Chromatographie lassen sich Stoffe in verschiedenen Gemischen durch Vergleich ihrer Laufstrecken wiedererkennen.']
      ]
    }),
    help(lab) {
      if (C2.check(lab).success) return EVAL_HELP;
      const ph = paperHelp(lab);
      if (ph && lab.state.paper && !lab.state.paper.archived && lab.state.paper.state !== 'dry') return ph;
      return { small: 'Wie kannst du zwei Stifte am besten vergleichen?', concrete: 'Nimm das breite Papier, trage Grün und Violett auf zwei Bahnen derselben Startlinie auf und entwickle mit Wasser.' };
    }
  };

  // ============================================================ C-3
  function permInfo(lab) {
    const list = papers(lab).filter((x) => x.r.usable && !x.r.issues.includes('overload'));
    const w = lastLane(list, 'perm', (x) => x.p.eluent === 'water');
    const e = lastLane(list, 'perm', (x) => x.p.eluent === 'ethanol');
    return { w, e };
  }
  const C3 = {
    id: 'C-3', lab: 'chroma', short: 'Wasserfester Stift',
    title: 'Was geschieht mit dem wasserfesten Stift?',
    problem: 'Untersuche den wasserfesten schwarzen Stift mit beiden Laufmitteln. Was geschieht mit seiner Farbe in Wasser, was im Ethanol-Wasser-Gemisch?',
    goal: 'Brauchbare Chromatogramme des wasserfesten Stifts mit Wasser und mit dem Ethanol-Wasser-Gemisch.',
    materials: C1.materials,
    check(lab) {
      const { w, e } = permInfo(lab);
      return {
        success: !!w && !!e,
        items: [
          { label: 'Wasserfester Stift mit Wasser', ok: !!w, detail: w ? label(w.x) : 'noch nicht' },
          { label: 'Wasserfester Stift mit Ethanol-Wasser-Gemisch', ok: !!e, detail: e ? label(e.x) : 'noch nicht' }
        ]
      };
    },
    observations(lab) {
      const { w, e } = permInfo(lab);
      const opts = [['stays', 'Die Farbe bleibt auf der Startlinie.'], ['moves', 'Die Farbe wandert mit dem Laufmittel nach oben.'], ['gone', 'Die Farbe verschwindet ganz.']];
      return [
        { id: 'water', q: 'Was geschieht mit dem wasserfesten Stift im Laufmittel Wasser?', type: 'choice', options: opts, correct: w ? (w.lane.moved ? 'moves' : 'stays') : null, unavailable: w ? '' : 'Entwickle den wasserfesten Stift zuerst mit Wasser.', note: w ? label(w.x) : '' },
        { id: 'ethanol', q: 'Was geschieht mit ihm im Ethanol-Wasser-Gemisch?', type: 'choice', options: opts, correct: e ? (e.lane.moved ? 'moves' : 'stays') : null, unavailable: e ? '' : 'Entwickle ihn auch mit dem Ethanol-Wasser-Gemisch.', note: e ? label(e.x) : '' }
      ];
    },
    gaps: {
      text: 'Der Farbstoff des wasserfesten Stifts ist in Wasser {unl}. Er bleibt deshalb auf der {start} liegen. Im Ethanol-Wasser-Gemisch ist er {loesl} und wandert mit dem {lm}.',
      gaps: {
        unl: { accept: ['unlöslich', 'nicht löslich', 'kaum löslich', 'schwer löslich', 'wasserunlöslich'], wrong: [{ terms: ['löslich', 'gut löslich'], hint: 'Er wandert in Wasser nicht.' }], hint: 'Warum wandert er in Wasser nicht?' },
        start: { accept: ['Startlinie', 'Start', 'Startpunkt', 'Auftragsstelle'], hint: 'Wo wurde die Probe aufgetragen?' },
        loesl: { accept: ['löslich', 'gut löslich'], wrong: [{ terms: ['unlöslich', 'nicht löslich'], hint: 'Hier wandert er.' }], hint: 'Warum wandert er hier?' },
        lm: { accept: ['Laufmittel', 'Fließmittel', 'Lösungsmittel', 'Laufmittelgemisch'], hint: 'Womit wandert die Farbe nach oben?' }
      },
      bank: ['unlöslich', 'löslich', 'Startlinie', 'Laufmittel']
    },
    theory: [
      'Ein Farbstoff kann nur wandern, wenn er sich im Laufmittel <b>löst</b>. Die Farbe eines wasserfesten Stifts ist in Wasser unlöslich – sie bleibt auf der Startlinie.',
      'Im Ethanol-Wasser-Gemisch löst sich dieser Farbstoff. Das Laufmittel entscheidet also mit, ob und wie weit ein Stoff wandert. Deshalb gibt man bei einem Chromatogramm immer das Laufmittel an.'
    ],
    notebook: () => ({
      title: 'Einfluss des Laufmittels',
      sections: [
        ['Versuch', 'Die Farbe eines wasserfesten schwarzen Stifts wird einmal mit Wasser und einmal mit einem Ethanol-Wasser-Gemisch (7 : 3) chromatographiert.'],
        ['Beobachtung', 'Mit Wasser bleibt der Fleck auf der Startlinie. Mit dem Ethanol-Wasser-Gemisch wandert die Farbe nach oben.'],
        ['Erklärung', 'Der Farbstoff ist in Wasser unlöslich und kann deshalb nicht mit dem Laufmittel wandern. Im Ethanol-Wasser-Gemisch ist er löslich und wird mitgenommen.'],
        ['Merksatz', 'Nur Stoffe, die sich im Laufmittel lösen, wandern bei der Chromatographie. Die Wahl des Laufmittels beeinflusst das Ergebnis.']
      ]
    }),
    help(lab) {
      if (C3.check(lab).success) return EVAL_HELP;
      const ph = paperHelp(lab);
      if (ph && lab.state.paper && !lab.state.paper.archived && lab.state.paper.state !== 'dry') return ph;
      const { w } = permInfo(lab);
      return w ? { small: 'Du hast den Stift mit Wasser untersucht. Was fehlt zum Vergleich?', concrete: 'Nimm ein neues Papier, trage den wasserfesten Stift auf und entwickle mit dem Ethanol-Wasser-Gemisch (Kammer vorher leeren und neu füllen).' }
        : { small: 'Wie verhält sich der wasserfeste Stift in Wasser?', concrete: 'Trage den wasserfesten Stift auf und entwickle mit Wasser. Danach dasselbe mit dem Ethanol-Wasser-Gemisch.' };
    }
  };

  // ============================================================ C-4 (Expertenmodus)
  function rfPaper(lab) {
    const list = papers(lab).filter((x) => x.r.clean && x.r.frontValid && x.p.line);
    return list.length ? list[list.length - 1] : null;
  }
  const C4 = {
    id: 'C-4', lab: 'chroma', short: 'Rf-Werte (Experte)', expert: true,
    title: 'Expertenmodus: Laufstrecken und Rf-Werte bestimmen',
    problem: 'Miss in einem eigenen Chromatogramm die Laufstrecke des Laufmittels und der Farbzonen und berechne die Rf-Werte: Rf = Laufstrecke des Stoffes / Laufstrecke des Laufmittels (jeweils ab der Startlinie).',
    goal: 'Ein sauberes Chromatogramm mit markierter, gültiger Laufmittelfront.',
    materials: C1.materials,
    check(lab) {
      const x = rfPaper(lab);
      const any = papers(lab).filter((y) => y.r.clean);
      const noFront = any.find((y) => !y.r.frontValid);
      return {
        success: !!x,
        items: [{ label: 'Sauberes Chromatogramm mit gültig markierter Front', ok: !!x, detail: x ? label(x) : noFront ? `${label(noFront)}: Front nicht oder nicht sicher markiert` : 'noch nicht' }]
      };
    },
    observations(lab) {
      const x = rfPaper(lab);
      if (!x) {
        return [{ id: 'rf_none', q: 'Rf-Werte', type: 'number', correct: null, unavailable: 'Ohne sicher markierte Laufmittelfront und Startlinie lässt sich kein Rf-Wert bestimmen.' }];
      }
      const p = x.p;
      const front = p.frontMark.y - p.line.y;
      const obs = [{ id: 'front', q: 'Laufstrecke des Laufmittels (Startlinie bis Front)', type: 'number', correct: +front.toFixed(2), tol: 0.2, unit: 'cm', note: label(x) }];
      const seen = new Set();
      for (const lane of x.r.lanes) {
        for (const b of lane.bandList) {
          if (b.atStart || b.comps.length !== 1 || seen.has(b.comps[0])) continue;
          seen.add(b.comps[0]);
          const rf = (b.y - p.line.y) / front;
          obs.push({ id: 'rf_' + b.comps[0], q: `Rf-Wert der ${COLOR_WORD[b.comps[0]]}en Zone (Bahn ${lane.lane + 1}: ${PEN[lane.pen].name})`, type: 'number', correct: +rf.toFixed(3), tol: 0.03, unit: '', note: label(x) });
          if (obs.length >= 4) break;
        }
        if (obs.length >= 4) break;
      }
      return obs;
    },
    gaps: {
      text: 'Der Rf-Wert ist der Quotient aus der Laufstrecke des {stoff} und der Laufstrecke des {lm}. Er liegt immer zwischen {null} und 1 und gilt nur für ein bestimmtes Laufmittel.',
      gaps: {
        stoff: { accept: ['Stoffes', 'Stoffs', 'Farbstoffs', 'Farbstoffes', 'Stoff', 'Farbstoff'], hint: 'Welche Strecke steht im Zähler?' },
        lm: { accept: ['Laufmittels', 'Laufmittel', 'Laufmittelfront', 'Fließmittels'], hint: 'Welche Strecke steht im Nenner?' },
        null: { accept: ['0', 'null'], hint: 'Kleinster möglicher Wert.' }
      },
      bank: ['Stoffes', 'Laufmittels', '0']
    },
    theory: [
      'Der <b>Rf-Wert</b> (Retentionsfaktor) vergleicht die Laufstrecke eines Stoffes mit der des Laufmittels: Rf = s(Stoff) / s(Laufmittel), beide ab der Startlinie gemessen. Man misst bis zur Mitte der Zone.',
      'Ohne markierte Front – oder wenn das Laufmittel bis zum Papierrand gestiegen ist – kann man den Rf-Wert nicht bestimmen.',
      'Rf-Werte hängen vom Laufmittel, dem Papier und der Temperatur ab. Man vergleicht sie deshalb nur unter gleichen Bedingungen.'
    ],
    notebook: (lab) => {
      const x = rfPaper(lab);
      const p = x && x.p;
      return {
        title: 'Rf-Werte in der Papierchromatographie',
        sections: [
          ['Versuch', 'Nach der Entwicklung wird die Laufmittelfront sofort markiert. Mit einem Lineal werden die Laufstrecken von der Startlinie bis zur Front und bis zur Mitte jeder Zone gemessen.'],
          ['Beobachtung', p ? `Laufmittel: ${chroma.ELUENTS[p.eluent].name}. Laufstrecke des Laufmittels: ${fmt(p.frontMark.y - p.line.y)} cm.` : 'Laufstrecken gemessen.'],
          ['Erklärung', 'Rf = Laufstrecke des Stoffes / Laufstrecke des Laufmittels. Ein großer Rf-Wert bedeutet: Der Stoff löst sich gut im Laufmittel und wird wenig adsorbiert.'],
          ['Merksatz', 'Unter gleichen Bedingungen hat jeder Stoff einen bestimmten Rf-Wert zwischen 0 und 1.']
        ]
      };
    },
    help(lab) {
      if (C4.check(lab).success) return { small: 'Miss mit dem Lineal in der Vergleichsansicht von der Startlinie aus.', concrete: 'Öffne „Chromatogramme vergleichen“, tippe auf die Mitte einer Zone: Das Lineal zeigt die Laufstrecke. Rf = Stoffstrecke / Laufmittelstrecke.' };
      const ph = paperHelp(lab);
      if (ph) return ph;
      return { small: 'Was brauchst du für einen Rf-Wert außer der Zone?', concrete: 'Entwickle ein neues Chromatogramm, nimm es rechtzeitig heraus und markiere sofort die Laufmittelfront.' };
    }
  };

  const TASKS = [C1, C2, C3, C4];
  for (const t of TASKS) t.createEngine = () => chroma.create();
  return { TASKS, papers, paperHelp, EVAL_HELP };
});
