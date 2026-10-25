/*
 * Papierchromatographie – Aufgaben, Ergebnisprüfung, Hilfen, Protokoll (ohne DOM)
 *
 * „Ergebnis prüfen“ wertet ausschließlich die tatsächlich entwickelten und
 * abgelegten Chromatogramme aus (st.archive), nie eine Klickfolge.
 * Hilfen: drei Stufen je Befund (Denkanstoß → Eingrenzung → konkrete Korrektur).
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('../../../shared/labkit/js/core.js') : root.LK.core;
  const model = isNode ? require('./model.js') : root.PC.model;
  const api = factory(core, model);
  if (isNode) module.exports = api;
  else (root.PC = root.PC || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function (core, M) {
  'use strict';
  const S = M.SAMPLE_BY_ID;

  // ------------------------------------------------------------------ Aufgaben
  const TASKS = {
    A: {
      id: 'A', short: 'A', title: 'Gemisch oder ein Farbstoff?',
      problem: 'Ist die Farbe eines schwarzen Filzstifts ein einziger Farbstoff oder ein Gemisch? Untersuche den schwarzen Filzstift zusammen mit mindestens einem Referenzfarbstoff auf einem Papier. Ordne die entstandenen Zonen zu.',
      material: 'Schwarzer Filzstift, Referenzfarbstoffe Blau und Gelb, Wasser oder Ethanol-Wasser 1 : 1'
    },
    B: {
      id: 'B', short: 'B', title: 'Gemeinsamer Bestandteil?',
      problem: 'Enthalten der grüne und der violette Filzstift einen gemeinsamen Farbstoff? Untersuche Grün, Violett und den blauen Referenzfarbstoff nebeneinander auf einem Papier.',
      material: 'Grüner und violetter Filzstift, blauer Referenzfarbstoff, Laufmittel nach Wahl'
    },
    C: {
      id: 'C', short: 'C', title: 'Wasserfest?',
      problem: 'Was bedeutet „wasserfest“ bei einem Stift? Vergleiche den wasserfesten schwarzen Stift in Wasser und in Ethanol-Wasser 1 : 1. Stelle fest, wann etwas wandert und ob etwas zurückbleibt.',
      material: 'Wasserfester schwarzer Stift, Wasser, Ethanol-Wasser 1 : 1, zwei Papiere'
    },
    free: {
      id: 'free', short: 'Frei', title: 'Freies Labor',
      problem: 'Untersuche beliebige Proben, auch Orange und Gelb, mit beiden Laufmitteln. Lege mehrere Chromatogramme ab und vergleiche sie unter „Ergebnisse“.',
      material: 'alle sieben Proben, beide Laufmittel'
    }
  };
  const TASK_ORDER = ['A', 'B', 'C', 'free'];

  // ------------------------------------------------------------------ Befunde
  const laneOf = (snap, id) => snap.lanes.findIndex((l) => l && l.sampleId === id);
  const zonesOf = (snap, id) => { const i = laneOf(snap, id); return i < 0 ? null : snap.zones[i]; };
  const overloaded = (snap, ids) => ids.some((id) => { const i = laneOf(snap, id); return i >= 0 && snap.lanes[i].n >= M.OVERLOAD; });
  const solventName = (id) => (id ? M.SOLVENTS[id].short : 'ohne Laufmittel');

  /** Allgemeine Gültigkeit eines Chromatogramms → Problem oder null. */
  function paperProblem(snap) {
    const q = snap.quality.issues;
    if (q.includes('submerged')) return { code: 'submerged', paper: snap.id, text: `Papier ${snap.n}: Der Flüssigkeitsspiegel lag über den Farbpunkten. Die Farbstoffe haben sich im Laufmittel gelöst – das Chromatogramm ist nicht auswertbar.` };
    if (q.includes('noLine')) return { code: 'noLine', paper: snap.id, text: `Papier ${snap.n}: Ohne Startlinie liegen die Proben nicht auf gleicher Höhe. Die Laufstrecken lassen sich so nicht vergleichen.` };
    if (q.includes('short')) return { code: 'short', paper: snap.id, text: `Papier ${snap.n}: Das Laufmittel ist nur ${core.fmt(snap.quality.run, 1)} cm über die Startlinie gestiegen. Die Zonen sind noch nicht vollständig getrennt.` };
    return null;
  }

  /** Ergebnis prüfen: Erfolg oder die wichtigste Abweichung (mit Code für die Hilfe). */
  function evaluate(taskId, st) {
    const papers = st.archive.slice().reverse(); // neueste zuerst
    const cur = st.paper;
    const developing = cur.state === 'chamber';
    const none = (code, text) => ({ ok: false, code, text, paper: null });
    if (taskId === 'free') return { ok: false, code: 'free', text: 'Im freien Labor gibt es keine vorgegebene Lösung. Vergleiche deine Chromatogramme unter „Ergebnisse“.' };

    if (taskId === 'A' || taskId === 'B') {
      const need = taskId === 'A' ? ['schwarz'] : ['gruen', 'violett', 'blau'];
      const hasRef = (p) => taskId === 'B' || laneOf(p, 'blau') >= 0 || laneOf(p, 'gelb') >= 0;
      const cand = papers.filter((p) => need.every((id) => laneOf(p, id) >= 0) && hasRef(p));
      if (!cand.length) {
        if (developing) return none('developing', 'Das Papier hängt noch in der Kammer. Beobachte die Entwicklung und nimm es heraus, wenn das Laufmittel weit genug gestiegen ist.');
        const partial = papers.find((p) => need.some((id) => laneOf(p, id) >= 0));
        if (taskId === 'A' && partial && laneOf(partial, 'schwarz') >= 0) return none('needRef', `Auf Papier ${partial.n} fehlt ein Referenzfarbstoff zum Vergleich.`);
        if (partial) return none('needSamples', `Für diese Aufgabe müssen ${taskId === 'A' ? 'der schwarze Filzstift und ein Referenzfarbstoff' : 'Grün, Violett und Blau (Referenz)'} auf demselben Papier entwickelt werden.`);
        return none('noPaper', 'Es gibt noch kein entwickeltes Chromatogramm mit den passenden Proben.');
      }
      // gültige Kandidaten bevorzugen
      let firstProblem = null;
      for (const p of cand) {
        const pr = paperProblem(p);
        if (pr) { firstProblem = firstProblem || pr; continue; }
        const ids = taskId === 'A' ? ['schwarz', laneOf(p, 'blau') >= 0 ? 'blau' : 'gelb'] : need;
        if (overloaded(p, ids)) { firstProblem = firstProblem || { code: 'overloaded', paper: p.id, text: `Papier ${p.n}: Mindestens ein Fleck wurde so oft betupft, dass die Zonen ineinanderlaufen. So ist nicht sicher zu erkennen, wie viele Farbstoffe es sind.` }; continue; }
        if (taskId === 'A') {
          const zb = zonesOf(p, 'schwarz');
          if (zb.length < 3) { firstProblem = firstProblem || { code: 'incomplete', paper: p.id, text: `Papier ${p.n} (${solventName(p.solvent)}): Der schwarze Filzstift zeigt nur ${zb.length} deutlich getrennte Zone${zb.length === 1 ? '' : 'n'}. Mit diesen Bedingungen werden nicht alle Farbstoffe getrennt.` }; continue; }
          const refId = laneOf(p, 'blau') >= 0 ? 'blau' : 'gelb';
          const ref = zonesOf(p, refId)[0];
          if (!zb.some((z) => Math.abs(z.s - ref.s) < 0.3)) { firstProblem = firstProblem || { code: 'incomplete', paper: p.id, text: `Papier ${p.n}: Keine Zone des schwarzen Stifts lässt sich der Referenz zuordnen.` }; continue; }
          return { ok: true, code: 'done', paper: p.id, text: `Papier ${p.n} (${solventName(p.solvent)}) belegt die Aufgabe: Der schwarze Filzstift ist deutlich in mehrere Zonen getrennt, die Referenz zeigt eine Zone.` };
        }
        const [zg, zv, zr] = need.map((id) => zonesOf(p, id));
        if (zg.length < 2 || zv.length < 2) { firstProblem = firstProblem || { code: 'incomplete', paper: p.id, text: `Papier ${p.n} (${solventName(p.solvent)}): ${zg.length < 2 ? 'Grün' : 'Violett'} zeigt nur eine Zone. Mit diesem Laufmittel werden die Farbstoffe nicht ausreichend getrennt.` }; continue; }
        const refS = zr[0].s;
        const match = (zs) => zs.some((z) => Math.abs(z.s - refS) < 0.3);
        if (!match(zg) || !match(zv)) { firstProblem = firstProblem || { code: 'incomplete', paper: p.id, text: `Papier ${p.n}: Die Zonen lassen sich der Referenz noch nicht eindeutig zuordnen.` }; continue; }
        return { ok: true, code: 'done', paper: p.id, text: `Papier ${p.n} (${solventName(p.solvent)}) belegt die Aufgabe: Grün und Violett sind getrennt und lassen sich mit der Referenz vergleichen.` };
      }
      if (developing) return Object.assign({}, firstProblem, { text: firstProblem.text + ' Das Papier in der Kammer ist noch nicht ausgewertet.' });
      return Object.assign({ ok: false }, firstProblem);
    }

    // Aufgabe C
    const wf = papers.filter((p) => laneOf(p, 'wasserfest') >= 0);
    const bySolvent = { water: null, etoh: null };
    let firstProblem = null;
    for (const p of wf) {
      if (bySolvent[p.solvent]) continue;
      const pr = paperProblem(p) || (overloaded(p, ['wasserfest']) ? { code: 'overloaded', paper: p.id, text: `Papier ${p.n}: Der wasserfeste Stift wurde so oft betupft, dass der Fleck verschmiert.` } : null);
      if (pr) { firstProblem = firstProblem || pr; continue; }
      bySolvent[p.solvent] = p;
    }
    if (bySolvent.water && bySolvent.etoh) {
      return { ok: true, code: 'done', paper: bySolvent.etoh.id, papers: [bySolvent.water.id, bySolvent.etoh.id], text: `Papier ${bySolvent.water.n} (Wasser) und Papier ${bySolvent.etoh.n} (Ethanol-Wasser) belegen die Aufgabe.` };
    }
    if (firstProblem && !(bySolvent.water || bySolvent.etoh)) return Object.assign({ ok: false }, firstProblem);
    if (developing && !wf.length) return none('developing', 'Das Papier hängt noch in der Kammer. Nimm es heraus, wenn das Laufmittel weit genug gestiegen ist.');
    if (!wf.length) return none('noPaper', 'Es gibt noch kein entwickeltes Chromatogramm mit dem wasserfesten Stift.');
    const missing = bySolvent.water ? 'etoh' : 'water';
    const have = bySolvent.water || bySolvent.etoh;
    if (firstProblem && firstProblem.paper !== (have && have.id)) return Object.assign({ ok: false }, firstProblem, { text: firstProblem.text + (have ? ` Mit ${solventName(have.solvent)} liegt schon ein brauchbares Chromatogramm vor (Papier ${have.n}).` : '') });
    return { ok: false, code: 'needOtherSolvent', missing, paper: have ? have.id : null, text: `Mit ${solventName(missing === 'water' ? 'etoh' : 'water')} liegt ein brauchbares Chromatogramm vor (Papier ${have.n}). Für den Vergleich fehlt noch eines mit ${solventName(missing)}.` };
  }

  // ------------------------------------------------------------------ Hilfen
  /** Aktueller Befund für die Hilfe – aus Prüfergebnis und laufendem Versuch. */
  function diagnose(taskId, st) {
    const p = st.paper;
    const r = evaluate(taskId, st);
    if (r.ok) return 'done';
    if (taskId === 'free') return 'free';
    // Laufender Versuch: Fehler zuerst dort zeigen, wo sie gerade passieren
    if (p.state === 'chamber' && p.submerged.some((x, i) => x && p.lanes[i])) return 'submerged';
    if (p.state === 'bench' && p.lanes.some(Boolean) && !p.line && r.code !== 'noLine') return 'noLine';
    if (p.state === 'bench' && st.chamber.level >= M.PAPER.lineY - 0.05 && p.lanes.some(Boolean)) return 'overfill';
    if (p.state === 'chamber' && !st.chamber.solvent) return 'noSolvent';
    return r.code;
  }

  const sampleList = (taskId) => ({ A: 'den schwarzen Filzstift und einen Referenzfarbstoff (Blau oder Gelb)', B: 'Grün, Violett und Blau (Referenz)', C: 'den wasserfesten Stift' }[taskId] || 'deine Proben');

  function hints(taskId, code, extra) {
    const solv = extra && extra.missing ? solventName(extra.missing) : 'dem anderen Laufmittel';
    const H = {
      noPaper: [
        'Was muss auf dem Papier sein, bevor das Laufmittel die Farbstoffe trennen kann?',
        `Du brauchst ein entwickeltes Papier mit ${sampleList(taskId)}.`,
        `Ziehe die Startlinie, tupfe ${sampleList(taskId)} je auf einen eigenen Punkt, gieße ein wenig Laufmittel ein, hänge das Papier ein und nimm es später heraus.`
      ],
      needSamples: [
        'Vergleichen kann man nur, was nebeneinander auf demselben Papier gelaufen ist.',
        `Auf einem Papier müssen ${sampleList(taskId)} stehen.`,
        `Nimm ein neues Papier, ziehe die Startlinie und tupfe ${sampleList(taskId)} auf je einen eigenen Punkt.`
      ],
      needRef: [
        'Woran erkennst du, welcher Farbstoff in einer Zone steckt?',
        'Ein Referenzfarbstoff auf demselben Papier zeigt, wie weit ein bekannter Farbstoff wandert.',
        'Nimm ein neues Papier und tupfe neben den schwarzen Filzstift den blauen oder gelben Referenzfarbstoff.'
      ],
      noLine: [
        'Von wo aus misst man, wie weit ein Farbstoff gewandert ist?',
        'Ohne Startlinie liegen die Farbpunkte auf unterschiedlicher Höhe.',
        'Nimm ein neues Papier und tippe zuerst auf den Bleistift, um die Startlinie zu ziehen. Setze die Punkte dann auf die Linie. (Immer mit Bleistift: Kugelschreiberfarbe würde im Laufmittel mitwandern.)'
      ],
      submerged: [
        'Sieh dir die Kammer genau an: Wo liegt der Flüssigkeitsspiegel im Vergleich zu den Farbpunkten?',
        'Die Farbpunkte lagen im Laufmittel und haben sich dort gelöst, statt mit dem Laufmittel im Papier nach oben zu wandern. (Das Laufmittel ist ja gefärbt.)',
        'Nimm das Papier heraus, leere die Kammer und gieße nur einmal oder zweimal ein, sodass der Spiegel unter der Startlinie bleibt. Nimm dann ein neues Papier.'
      ],
      overfill: [
        'Vergleiche die Höhe des Laufmittels in der Kammer mit der Höhe der Startlinie auf dem Papier.',
        'Der Spiegel steht schon so hoch wie die Startlinie oder höher. Hängt das Papier so ein, liegen die Punkte im Laufmittel.',
        'Leere die Kammer und gieße weniger ein (ein- oder zweimal), bevor du das Papier einhängst.'
      ],
      noSolvent: [
        'Was soll im Papier nach oben steigen?',
        'In der Kammer ist kein Laufmittel – so kann nichts wandern.',
        'Nimm das Papier heraus, gieße Laufmittel in die Kammer (Flasche antippen) und hänge das Papier wieder ein.'
      ],
      short: [
        'Wie weit ist das Laufmittel gestiegen, bevor du das Papier herausgenommen hast?',
        'Die Farbstoffe brauchen eine längere Laufstrecke, damit sich die Zonen deutlich voneinander lösen.',
        'Wiederhole den Versuch mit einem neuen Papier und nimm es erst heraus, wenn die Laufmittelfront weit oben ist (mindestens etwa 5 cm über der Startlinie).'
      ],
      overloaded: [
        'Sieh dir die Zonen der vielfach betupften Probe an: Sind sie scharf oder verschmiert?',
        'Zu viel Farbe auf einem Punkt macht die Zonen breit, sie laufen ineinander.',
        'Nimm ein neues Papier und tupfe jede Probe nur ein- oder zweimal auf.'
      ],
      incomplete: [
        'Sind wirklich alle Farbstoffe getrennt, oder könnten in einer Zone noch mehrere stecken?',
        'Nicht jedes Laufmittel trennt jede Probe. Mit dem verwendeten Laufmittel laufen zwei Farbstoffe gleich weit.',
        'Wiederhole den Versuch mit dem anderen Laufmittel: Leere die Kammer, gieße das andere Laufmittel ein und nimm ein neues Papier.'
      ],
      needOtherSolvent: [
        'Bei „wasserfest“ geht es um den Vergleich mit einem anderen Lösungsmittel.',
        `Ein brauchbares Chromatogramm hast du schon. Es fehlt eines mit ${solv}.`,
        `Leere die Kammer, gieße ${solv} ein und entwickle ein neues Papier mit dem wasserfesten Stift.`
      ],
      developing: [
        'Was geschieht gerade in der Kammer?',
        'Ausgewertet wird erst ein Papier, das aus der Kammer genommen wurde.',
        'Warte, bis die Laufmittelfront weit oben ist, und tippe dann auf die Kammer, um das Papier herauszunehmen.'
      ],
      done: [
        'Dein Versuch belegt die Aufgabe. Schau dir die Zonen in Ruhe an.',
        'Vergleiche die Höhe der Zonen über der Startlinie – gleiche Höhe heißt gleich weit gewandert.',
        'Beantworte jetzt die Fragen im Protokoll. Die Ergebnisse findest du auch unter „Ergebnisse“.'
      ],
      free: [
        'Welche Probe interessiert dich? Welches Laufmittel könnte sie trennen?',
        'Vergleiche dieselbe Probe in beiden Laufmitteln oder zwei Proben nebeneinander.',
        'Lege jedes entwickelte Papier ab und vergleiche sie unter „Ergebnisse“.'
      ]
    };
    return H[code] || H.noPaper;
  }

  // ------------------------------------------------------------------ Protokoll
  /**
   * Fragen je Aufgabe. type: one | many | gap. Richtige Antworten können vom
   * eigenen Chromatogramm abhängen (answerFor).
   */
  const QUESTIONS = {
    A: [
      { id: 'count', type: 'one', legend: '1. Wie viele Farbzonen zeigt der schwarze Filzstift auf deinem Chromatogramm?',
        options: { 1: 'eine', 2: 'zwei', 3: 'drei', 4: 'vier oder mehr' }, answerFor: (snap) => String(Math.min(4, zonesOf(snap, 'schwarz').length)),
        wrong: 'Zähle auf deinem Papier noch einmal die getrennten Farbzonen über dem schwarzen Punkt.' },
      { id: 'obs', type: 'many', legend: '2. Beobachtung (alles Zutreffende ankreuzen)',
        options: {
          sep: 'Der schwarze Fleck trennt sich in mehrere farbige Zonen.',
          match: 'Eine Zone des schwarzen Stifts liegt auf gleicher Höhe wie der Referenzfarbstoff.',
          ref1: 'Der Referenzfarbstoff bildet eine einzige Zone.',
          same: 'Alle Farbzonen des schwarzen Stifts wandern gleich weit.',
          stay: 'Der schwarze Fleck bleibt vollständig auf der Startlinie.',
          beyond: 'Die Zonen wandern über die Laufmittelfront hinaus.'
        }, correct: ['sep', 'match', 'ref1'],
        wrong: 'Vergleiche die Zonen auf deinem Papier mit jeder Aussage einzeln.' },
      { id: 'result', type: 'one', legend: '3. Ergebnis',
        options: {
          mix: 'Der schwarze Filzstift enthält ein Gemisch aus mehreren Farbstoffen.',
          single: 'Der schwarze Filzstift enthält einen einzigen schwarzen Farbstoff, der beim Wandern heller wird.',
          made: 'Das Laufmittel erzeugt die bunten Farben erst.',
          refmix: 'Der Referenzfarbstoff ist ebenfalls ein Gemisch.'
        }, correct: 'mix', wrong: 'Woher könnten verschiedene Farbzonen aus einem einzigen Punkt kommen?' },
      { id: 'why', type: 'one', legend: '4. Deutung',
        options: {
          ads: 'Die Farbstoffe lösen sich unterschiedlich gut im Laufmittel und haften unterschiedlich stark am Papier. Deshalb wandern sie verschieden weit.',
          abs: 'Das Papier saugt die Farbstoffe unterschiedlich stark in seine Fasern auf (Absorption).',
          heavy: 'Schwere Farbstoffe sinken nach unten, leichte steigen nach oben.',
          sieve: 'Das Papier hält große Farbstoffteilchen zurück wie ein Sieb.'
        }, correct: 'ads', wrong: 'Denke an die beiden Phasen: das Laufmittel und das Papier.' },
      { id: 'gap', type: 'gap', legend: '5. Fachbegriff: Das Papier bildet die … Phase.',
        gap: { accept: ['stationäre', 'stationaere', 'stationär', 'stationaer', 'feste'], forbid: [{ term: 'mobile', hint: 'Mobil (beweglich) ist das Laufmittel. Das Papier bewegt sich nicht.' }], hint: 'Gesucht ist das Wort für „unbeweglich, ortsfest“.' } },
      { id: 'limit', type: 'one', legend: '6. Was zeigt die eine Zone des Referenzfarbstoffs?',
        options: {
          noproof: 'Unter diesen Bedingungen ist kein zweiter Farbstoff zu erkennen – ein Beweis für einen Reinstoff ist das aber nicht.',
          proof: 'Sie beweist, dass der Referenzfarbstoff ein Reinstoff ist.',
          empty: 'Sie zeigt, dass der Referenzfarbstoff gar keinen Farbstoff enthält.'
        }, correct: 'noproof', wrong: 'Könnten zwei verschiedene Stoffe gleich weit wandern?' }
    ],
    B: [
      { id: 'common', type: 'one', legend: '1. Welche Farbstoffkomponente kommt in Grün und Violett gemeinsam vor?',
        options: { blau: 'die blaue', gelb: 'die gelbe', rot: 'die rote', keine: 'keine' }, correct: 'blau',
        wrong: 'Suche in den Bahnen von Grün und Violett je eine Zone auf derselben Höhe.' },
      { id: 'how', type: 'many', legend: '2. Woran erkennst du das? (alles Zutreffende ankreuzen)',
        options: {
          height: 'Grün und Violett haben je eine Zone auf derselben Höhe.',
          ref: 'Diese Zonen liegen auf derselben Höhe wie die Zone des blauen Referenzfarbstoffs.',
          colorOnly: 'Es reicht, dass die Zonen ähnlich gefärbt sind – die Laufstrecke spielt keine Rolle.',
          yr: 'Die gelbe Zone von Grün liegt auf derselben Höhe wie die rote Zone von Violett.'
        }, correct: ['height', 'ref'], wrong: 'Achte auf die Laufstrecke, nicht nur auf die Farbe.' },
      { id: 'green', type: 'one', legend: '3. Aus welchen Farbstoffen besteht der grüne Filzstift?',
        options: { gb: 'gelb und blau', gr: 'gelb und rot', g: 'nur aus einem grünen Farbstoff', rb: 'rot und blau' }, correct: 'gb',
        wrong: 'Welche Farben haben die beiden Zonen in der Bahn von Grün?' },
      { id: 'violet', type: 'one', legend: '4. Aus welchen Farbstoffen besteht der violette Filzstift?',
        options: { rb: 'rot und blau', gb: 'gelb und blau', v: 'nur aus einem violetten Farbstoff', gr: 'gelb und rot' }, correct: 'rb',
        wrong: 'Welche Farben haben die beiden Zonen in der Bahn von Violett?' },
      { id: 'same', type: 'one', legend: '5. Warum trägt man die Proben auf dasselbe Papier auf?',
        options: {
          cond: 'Nur bei gleichem Papier, gleichem Laufmittel und gleicher Laufzeit lassen sich Laufstrecken direkt vergleichen.',
          paper: 'Um Papier zu sparen – für das Ergebnis ist es gleichgültig.',
          mix: 'Damit sich die Farbstoffe der Proben auf dem Papier vermischen.'
        }, correct: 'cond', wrong: 'Wovon hängt ab, wie weit ein Farbstoff wandert?' }
    ],
    C: [
      { id: 'water', type: 'one', legend: '1. Was beobachtest du beim wasserfesten Stift mit Wasser?',
        options: { stay: 'Der Fleck bleibt auf der Startlinie.', split: 'Er trennt sich in mehrere Zonen.', all: 'Er wandert vollständig mit der Laufmittelfront.' }, correct: 'stay',
        wrong: 'Sieh dir das Papier an, das mit Wasser entwickelt wurde.' },
      { id: 'etoh', type: 'many', legend: '2. Was beobachtest du mit Ethanol-Wasser? (alles Zutreffende ankreuzen)',
        options: { up: 'Ein Teil des Farbstoffs wandert nach oben.', rest: 'Ein dunkler Rest bleibt auf der Startlinie.', nothing: 'Nichts bewegt sich.', gone: 'Der ganze Fleck verschwindet vom Papier.' },
        correct: ['up', 'rest'], wrong: 'Vergleiche die Startlinie und den Bereich darüber auf dem Papier mit Ethanol-Wasser.' },
      { id: 'why', type: 'one', legend: '3. Deutung',
        options: {
          sol: 'Die Farbstoffe des wasserfesten Stifts lösen sich nicht in Wasser, ein Teil löst sich aber im Ethanol-Wasser-Gemisch.',
          cold: 'Das Wasser war zu kalt, um den Farbstoff zu lösen.',
          paper: 'Mit Wasser saugt das Papier kein Laufmittel auf.',
          bleach: 'Ethanol bleicht den schwarzen Farbstoff aus.'
        }, correct: 'sol', wrong: 'Ist das Laufmittel bei beiden Papieren gestiegen? Was ist also verschieden?' },
      { id: 'gap', type: 'gap', legend: '4. Fachbegriff: Das Anhaften eines Stoffes an der Oberfläche des Papiers heißt …',
        gap: { accept: ['Adsorption'], forbid: [{ term: 'Absorption', hint: 'Absorption bedeutet Aufsaugen in das Innere. Gemeint ist das Anhaften an der Oberfläche – ähnliches Wort, ein Buchstabe anders.' }], hint: 'Gesucht ist der Fachbegriff für das Anhaften an einer Oberfläche.' } },
      { id: 'mean', type: 'one', legend: '5. Was bedeutet „wasserfest“ demnach?',
        options: {
          insol: 'Die Farbstoffe sind in Wasser unlöslich, in anderen Lösungsmitteln können sie sich lösen.',
          never: 'Die Farbe lässt sich mit keinem Lösungsmittel lösen.',
          dry: 'Die Tinte trocknet schneller als bei anderen Stiften.'
        }, correct: 'insol', wrong: 'Denke an das Ergebnis mit Ethanol-Wasser.' }
    ]
  };

  function correctFor(q, snap) { return q.answerFor ? q.answerFor(snap) : q.correct; }

  /** Antworten prüfen: je Feld richtig/falsch, Eingaben bleiben erhalten. */
  function grade(taskId, answers, snap) {
    const res = {};
    let all = true;
    for (const q of QUESTIONS[taskId] || []) {
      const a = answers[q.id];
      let ok = false, feedback = '', status = 'answered';
      if (q.type === 'gap') {
        const g = core.checkGap(q.gap, a);
        ok = core.gapOk(g);
        feedback = g.feedback;
        status = g.status;
      } else if (q.type === 'many') {
        const sel = new Set(Array.isArray(a) ? a : []);
        const cor = new Set(correctFor(q, snap));
        if (!sel.size) status = 'empty';
        ok = sel.size === cor.size && [...cor].every((k) => sel.has(k));
        if (!ok && sel.size) {
          const wrongSel = [...sel].filter((k) => !cor.has(k)).length;
          const missing = [...cor].filter((k) => !sel.has(k)).length;
          feedback = (wrongSel ? `${wrongSel} angekreuzte Aussage${wrongSel > 1 ? 'n trifft' : ' trifft'} nicht zu. ` : '') + (missing ? `Es fehlt noch ${missing === 1 ? 'eine zutreffende Aussage' : missing + ' zutreffende Aussagen'}. ` : '') + q.wrong;
        }
      } else {
        if (a == null || a === '') status = 'empty';
        ok = String(a) === String(correctFor(q, snap));
        if (!ok && status !== 'empty') feedback = q.wrong;
      }
      if (status === 'empty') feedback = 'Noch keine Antwort.';
      else if (ok && !feedback) feedback = 'Richtig.';
      res[q.id] = { ok, status, feedback };
      if (!ok) all = false;
    }
    return { fields: res, allCorrect: all };
  }

  const SOLUTIONS = {
    A: 'Unter geeigneten Bedingungen (Wasser als Laufmittel, Spiegel unter der Startlinie, Front weit genug gestiegen) trennt sich der schwarze Filzstift in drei Zonen: unten violett, in der Mitte blau, oben gelb. Die blaue Zone liegt auf der Höhe des blauen, die gelbe auf der Höhe des gelben Referenzfarbstoffs. Schwarz ist also ein Gemisch. Die Farbstoffe lösen sich unterschiedlich gut in der mobilen Phase (Laufmittel) und haften unterschiedlich stark an der stationären Phase (Papier, Adsorption). Der Referenzfarbstoff bildet eine Zone – ein Beweis für einen Reinstoff ist das nicht, denn verschiedene Stoffe können gleich weit wandern.',
    B: 'Mit Wasser zeigt Grün eine blaue und eine gelbe Zone, Violett eine rote und eine blaue. Die blauen Zonen von Grün und Violett liegen auf derselben Höhe wie der blaue Referenzfarbstoff. Gemeinsamer Bestandteil ist also der blaue Farbstoff. Entscheidend ist die gleiche Laufstrecke unter gleichen Bedingungen, nicht allein die Farbe. Mit Ethanol-Wasser 1 : 1 laufen Gelb und Blau fast gleich weit – Grün erscheint dann als eine Zone, die Trennung ist unzureichend.',
    C: 'Mit Wasser bleibt der wasserfeste Stift vollständig auf der Startlinie, obwohl das Laufmittel aufsteigt: Seine Farbstoffe sind in Wasser unlöslich. Mit Ethanol-Wasser 1 : 1 wandert ein blauschwarzer Farbstoff nach oben, ein grauschwarzer Rest (Pigment) bleibt auf der Startlinie. „Wasserfest“ heißt also: in Wasser unlöslich – in anderen Lösungsmitteln kann sich die Farbe lösen. Das Anhaften am Papier heißt Adsorption.',
    free: 'Im freien Labor gibt es keine Musterlösung. Vergleiche: Orange trennt sich in Gelb und Rot; die gelbe Zone liegt bei Orange, Grün und Schwarz auf derselben Höhe wie die gelbe Referenz.'
  };

  /** Richtige Antworten für „Lösung anzeigen“ (ohne eigenes Chromatogramm: Modellerwartung). */
  function solutionAnswers(taskId, snap) {
    const out = {};
    for (const q of QUESTIONS[taskId] || []) {
      if (q.type === 'gap') out[q.id] = q.gap.accept[0];
      else if (q.answerFor) out[q.id] = snap ? q.answerFor(snap) : '3';
      else out[q.id] = q.correct;
    }
    return out;
  }

  // ------------------------------------------------------------------ Expertenmodus: Rf
  /** Prüft gemessene Laufstrecken und Rf-Wert einer Zone eines abgelegten Chromatogramms. */
  function checkRf(snap, lane, zoneIdx, input) {
    const z = snap.zones[lane] && snap.zones[lane][zoneIdx];
    if (!z) return { ok: false, code: 'noZone', text: 'Wähle eine Zone aus.' };
    if (snap.frontAtTop) return { ok: false, code: 'frontAtTop', text: 'Auf diesem Papier ist das Laufmittel bis zum oberen Rand gestiegen. Die Front ist nicht bestimmbar – entwickle ein neues Papier und nimm es heraus, bevor die Front den Rand erreicht.' };
    if (snap.frontMark == null) return { ok: false, code: 'frontUnmarked', text: 'Auf diesem Papier wurde die Laufmittelfront nicht markiert. Ohne Front gibt es keinen Rf-Wert – markiere sie beim nächsten Papier gleich nach dem Herausnehmen.' };
    const start = snap.lanes[lane].y;
    const front = snap.frontMark - start;
    const dist = z.s;
    const rfv = dist / front;
    const f = core.parseNum(input.front), d = core.parseNum(input.dist), r = core.parseNum(input.rf);
    const fields = {
      front: { ok: Math.abs(f - front) <= 0.2, feedback: Number.isNaN(f) ? 'Noch kein Wert.' : Math.abs(f - front) <= 0.2 ? 'Richtig gemessen.' : 'Miss von der Startlinie bis zur Bleistiftmarkierung der Front.' },
      dist: { ok: Math.abs(d - dist) <= 0.2, feedback: Number.isNaN(d) ? 'Noch kein Wert.' : Math.abs(d - dist) <= 0.2 ? 'Richtig gemessen.' : 'Miss von der Startlinie bis zur Mitte der Zone.' },
      rf: { ok: false, feedback: '' }
    };
    // Rf aus den eigenen Messwerten folgerichtig berechnet?
    const own = !Number.isNaN(f) && !Number.isNaN(d) && f > 0 ? d / f : NaN;
    fields.rf.ok = !Number.isNaN(r) && Math.abs(r - rfv) <= 0.03 && (Number.isNaN(own) || Math.abs(r - own) <= 0.03);
    fields.rf.feedback = Number.isNaN(r) ? 'Noch kein Wert.' : fields.rf.ok ? 'Richtig berechnet.' : (!Number.isNaN(own) && Math.abs(r - own) > 0.03 ? 'Rf = Laufstrecke der Zone ÷ Laufstrecke der Front. Rechne mit deinen Messwerten nach.' : 'Prüfe zuerst deine Messwerte.');
    return { ok: fields.front.ok && fields.dist.ok && fields.rf.ok, fields, truth: { front, dist, rf: rfv } };
  }

  // ------------------------------------------------------------------ Hefteintrag
  const NOTEBOOK = {
    title: 'Papierchromatographie',
    lines: [
      'Mit der **Papierchromatographie** trennt man Farbstoffgemische.',
      '**Stationäre Phase:** das Papier. **Mobile Phase:** das **Laufmittel**, das im Papier nach oben steigt.',
      'Die Farbstoffe lösen sich unterschiedlich gut im Laufmittel (**Löslichkeit**) und haften unterschiedlich stark am Papier (**Adsorption**). Deshalb wandern sie verschieden weit.',
      'Ein **Gemisch** bildet mehrere Farbzonen. Wandert eine Zone unter gleichen Bedingungen so weit wie eine Referenz, ist es wahrscheinlich derselbe Farbstoff.',
      'Eine einzige Zone ist **kein Beweis** für einen Reinstoff.'
    ],
    rule: 'Startlinie mit Bleistift ziehen; der Laufmittelspiegel muss unter der Startlinie bleiben.',
    expert: 'Rf = Laufstrecke des Farbstoffs ÷ Laufstrecke der Laufmittelfront'
  };
  const notebookWords = () => [NOTEBOOK.title, ...NOTEBOOK.lines, NOTEBOOK.rule].join(' ').replace(/\*\*/g, '').split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;

  return { TASKS, TASK_ORDER, QUESTIONS, SOLUTIONS, NOTEBOOK, evaluate, diagnose, hints, grade, solutionAnswers, checkRf, notebookWords, laneOf, zonesOf };
});
