/*
 * Destillation – Aufgaben, Ergebnisprüfung, Hilfen, Protokoll, Geräte-Trainer (ohne DOM)
 *
 * „Ergebnis prüfen“ und das Protokoll werten ausschließlich die tatsächlich
 * gesammelten Vorlagen und Messwerte des eigenen Versuchs aus (model.snapshot),
 * nie eine Klickfolge oder feste Zahlen. Hilfen in drei Stufen je Befund
 * (Denkanstoß → Eingrenzung → konkrete Korrektur). Aufbau nach Redoxlabor bzw.
 * shared/labkit/DESIGN.md, Abschnitt 6.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('../../../shared/labkit/js/core.js') : root.LK.core;
  const model = isNode ? require('./model.js') : root.DS.model;
  const api = factory(core, model);
  if (isNode) module.exports = api;
  else (root.DS = root.DS || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function (core, M) {
  'use strict';
  const fmt = core.fmt;

  // ------------------------------------------------------------------ Aufgaben
  const TASKS = {
    ew: {
      id: 'ew', n: 1, short: '1 Ethanol/Wasser', title: 'Ethanol aus einem Ethanol-Wasser-Gemisch',
      problem: 'Gewinne aus dem Ethanol-Wasser-Gemisch ein ethanolreiches Destillat. Lies dabei die Dampftemperatur ab. Weise am getrennten Prüfplatz mit einer Brennprobe nach, dass dein Destillat brennbar ist.',
      material: 'Fertig aufgebaute Destillationsapparatur, Ethanol-Wasser-Gemisch (40 mL Ethanol + 60 mL Wasser), Siedesteine, Kühlwasser, Prüfplatz mit Pipette, Porzellanschale und Stabfeuerzeug'
    },
    pw: {
      id: 'pw', n: 2, short: '2 Propanon/Wasser', title: 'Propanon (Aceton) und Wasser trennen',
      problem: 'Trenne Propanon (Aceton) von Wasser. Lies die Dampftemperatur ab, während das Destillat übergeht, und vergleiche sie mit dem Ethanol-Wasser-Versuch. Propanon ist leicht entzündlich – eine Brennprobe gehört nicht zu dieser Aufgabe.',
      material: 'Fertig aufgebaute Destillationsapparatur, Propanon-Wasser-Gemisch (40 mL Propanon + 60 mL Wasser), Siedesteine, Kühlwasser'
    },
    pew: {
      id: 'pew', n: 3, short: '3 Dreistoffgemisch', title: 'Expertenmodus: drei Stoffe nacheinander auffangen', expert: true,
      problem: 'Trenne ein Gemisch aus Propanon, Ethanol und Wasser in Fraktionen. Wechsle die Vorlage, sobald die Temperatur zum nächsten Abschnitt ansteigt. Nutze das Temperatur-Zeit-Diagramm.',
      material: 'Fertig aufgebaute Destillationsapparatur, Gemisch aus 30 mL Propanon, 30 mL Ethanol und 40 mL Wasser, Siedesteine, Kühlwasser, mehrere Vorlagen'
    }
  };
  const TASK_ORDER = ['ew', 'pw', 'pew'];

  const MODEL_NOTE = 'Modellgrenze: Die Simulation nimmt eine idealisierte, weitgehend vollständige Trennung an. In einer echten einfachen Destillation trennen sich die Stoffe nur teilweise; Ethanol und Wasser lassen sich auf diese Weise nie vollständig trennen (Azeotrop bei etwa 96 % Ethanol). Die Siedetemperaturen der Reinstoffe bei etwa 1013 hPa: Propanon 56 °C, Ethanol 78 °C, Wasser 100 °C.';

  // ------------------------------------------------------------------ Befunde
  const SUB = M.SUBSTANCES;
  /** Fraktion, die zur Aufgabe am besten passt (meistes gewünschtes Produkt). */
  function mainFraction(taskId, snap, key) {
    const k = key || (taskId === 'pw' ? 'P' : 'E');
    const fr = snap.fractions.filter((f) => f.vol > 0.05);
    if (!fr.length) return null;
    return fr.slice().sort((a, b) => b.c[k] - a.c[k] || b.vol - a.vol)[0];
  }

  /** Ergebnis prüfen: Erfolg oder die wichtigste Abweichung (mit Code für die Hilfe). */
  function evaluate(taskId, st) {
    const snap = M.snapshot(st);
    const no = (code, text) => ({ ok: false, code, text });
    if (st.mix !== taskId) return no('otherMix', `Im Kolben ist ${st.filled ? '' : 'noch nicht '}das Gemisch dieser Aufgabe. Wähle die Aufgabe und beginne den Versuch neu.`);
    if (!st.filled) return no('notFilled', 'Der Kolben ist noch leer.');
    const fr = snap.fractions.filter((f) => f.vol > 0.05);
    const collected = fr.reduce((s, f) => s + f.vol, 0);
    if (!snap.condensed) {
      if (st.safety) return no('safety', 'Ein Sicherheitsstopp ist noch offen.');
      if (!st.stones && st.bumped) return no('noStones', 'Der Versuch wurde wegen eines Siedeverzugs gestoppt.');
      if (st.fx.vapor > 1e-5 && st.fx.escape > 1e-5) return no('noCooling', 'Es entsteht Dampf, aber kein Destillat: Der Dampf verlässt die Apparatur.');
      if (!st.heater.on && st.mantleT < 40) return no('noHeat', 'Es ist noch kein Destillat entstanden.');
      return no('heating', 'Es ist noch kein Destillat entstanden. Die Apparatur heizt auf.');
    }
    if (snap.lostTable > 0.5 && collected < 3) return no('noReceiver', 'Ein Teil des Destillats ist nicht in einer Vorlage gelandet.');
    if (taskId === 'pew') {
      const P = fr.find((f) => f.main === 'P' && f.vol >= 3);
      const E = fr.find((f) => f.main === 'E' && f.vol >= 3);
      if (!fr.some((f) => !f.current) && fr.length < 2) return no('noChange', 'Bisher ist alles in einer einzigen Vorlage gelandet.');
      if (!P || !E) {
        const mixed = fr.find((f) => f.main === 'mix' && f.vol >= 3);
        if (mixed) return no('mixedFraction', `In Vorlage ${mixed.n} sind zwei Stoffe vermischt.`);
        return no('needFractions', 'Es gibt noch keine ausreichend großen Fraktionen für Propanon und für Ethanol.');
      }
      if (P.thermoOk === false || E.thermoOk === false) return no('thermo', 'Während des Auffangens saß das Thermometer nicht an der richtigen Stelle.');
      return { ok: true, code: 'done', text: `Vorlage ${P.n} enthält überwiegend Propanon (übergegangen bei etwa ${fmt(P.Tmed, 0)} °C), Vorlage ${E.n} überwiegend Ethanol (bei etwa ${fmt(E.Tmed, 0)} °C).` };
    }
    const key = taskId === 'pw' ? 'P' : 'E';
    const f = mainFraction(taskId, snap, key);
    if (!f || f.vol + (taskId === 'ew' ? snap.burnTests.length * M.SAMPLE_ML : 0) < 5) return no('little', `Es sind erst ${fmt(collected, 1)} mL Destillat aufgefangen.`);
    if (f.thermoOk === false) return no('thermo', 'Während das Destillat überging, saß das Thermometer nicht an der richtigen Stelle. Die abgelesene Temperatur ist nicht die Dampftemperatur.');
    if (f.share[key] < 0.8) return no('impure', `Vorlage ${f.n} enthält nicht überwiegend ${SUB[key].name}.`);
    if (taskId === 'ew') {
      const tests = snap.burnTests;
      if (!tests.length) return no('noBurn', 'Die Brennprobe fehlt noch.');
      if (!tests.some((t) => t.result === 'burns')) return no('burnFail', 'Deine Probe hat nicht anhaltend gebrannt.');
      return { ok: true, code: 'done', text: `Vorlage ${f.n}: ${fmt(f.vol, 1)} mL ethanolreiches Destillat, übergegangen bei etwa ${fmt(f.Tmed, 1)} °C; die Probe brennt mit bläulicher Flamme.` };
    }
    return { ok: true, code: 'done', text: `Vorlage ${f.n}: ${fmt(f.vol, 1)} mL Destillat, übergegangen bei etwa ${fmt(f.Tmed, 1)} °C – deutlich niedriger als beim Ethanol.` };
  }

  /** Drei Hilfestufen je Befund. */
  function hints(code) {
    const H = {
      otherMix: ['Passen Aufgabe und Kolbeninhalt zusammen?', 'Jede Aufgabe hat ihr eigenes Gemisch.', 'Wähle oben die Aufgabe und tippe auf „Versuch neu beginnen“. Dann füllst du das passende Gemisch ein.'],
      notFilled: ['Womit soll destilliert werden?', 'Das Gemisch steht in der Flasche auf dem Tisch.', 'Tippe auf die Flasche oder auf „Gemisch einfüllen“.'],
      safety: ['Was zeigt die rote Meldung auf der Laborbühne?', 'Ein Sicherheitsstopp nennt Ursache und Abhilfe.', 'Lies die Meldung, tippe auf „Verstanden“ und behebe die genannte Ursache, bevor du wieder heizt.'],
      noStones: ['Was hat das heftige Aufwallen ausgelöst?', 'Ohne Siedekeime kann sich eine Flüssigkeit über ihre Siedetemperatur erhitzen.', 'Lass den Kolben unter 50 °C abkühlen (Thermometer im Kolben: Bühne beobachten), gib Siedesteine zu und heize erneut.'],
      noCooling: ['Wo bleibt der Dampf?', 'Der Dampf muss im Kühler wieder flüssig werden. Dafür braucht der Kühler Kühlwasser.', 'Schließe den Zulaufschlauch am unteren und den Ablaufschlauch am oberen Anschluss an und schalte das Kühlwasser EIN.'],
      noHeat: ['Woher kommt die Energie zum Verdampfen?', 'Der Heizpilz muss eingeschaltet sein; die Heizstufe bestimmt, wie schnell es geht.', 'Schalte unten „Heizung EIN“ und wähle die Stufe „mittel“. Warte, bis das Gemisch siedet.'],
      heating: ['Hab Geduld: Das Gemisch muss erst bis zur Siedetemperatur erwärmt werden.', 'Mit dem Zeitraffer (10× oder 30×) geht es schneller. Bei „niedrig“ reicht die Leistung kaum aus.', 'Wähle die Heizstufe „mittel“ und den Zeitraffer 30×. Beobachte Siedeblasen und Thermometer.'],
      noReceiver: ['Wohin fallen die Tropfen aus dem Vorstoß?', 'Unter dem Vorstoß muss die Vorlage stehen.', 'Tippe auf „Vorlage unterstellen“ oder auf die Vorlage, um sie wieder unter den Vorstoß zu stellen.'],
      little: ['Reicht die Menge schon für eine Auswertung?', 'Für die Aufgabe brauchst du mindestens 5 mL Destillat.', 'Lass die Destillation weiterlaufen, bis die Vorlage mindestens 5 mL enthält. Achte dabei auf die Temperatur.'],
      thermo: ['Wo misst dein Thermometer?', 'Gemessen werden soll die Temperatur des Dampfes, der in den Kühler strömt.', 'Heizung AUS, abwarten, bis nichts mehr siedet, dann das Thermometer verschieben: Die Kugel gehört genau auf Höhe des seitlichen Abgangs. Danach erneut destillieren.'],
      impure: ['Was ist in deiner Vorlage gelandet?', 'Steigt die Temperatur deutlich an, geht ein anderer Stoff über. Auch zu starkes Heizen reißt Flüssigkeit mit.', 'Fange nur auf, solange die Temperatur nahezu gleich bleibt, und heize höchstens auf „mittel“. Beginne bei Bedarf neu.'],
      noBurn: ['Wie weist man nach, dass das Destillat brennbar ist?', 'Die Brennprobe findet am getrennten Prüfplatz statt – nie an der Apparatur. Die Probe nimmt man aus der abgenommenen Vorlage.', 'Heizung aus, dann „Vorlage abnehmen“ – sie kommt zum Prüfplatz. Pipette antippen, dann die Vorlage, dann die Porzellanschale. Stabfeuerzeug antippen und die Schale antippen.'],
      burnFail: ['Wann brennt ein Ethanol-Wasser-Gemisch?', 'Nur wenn genug Ethanol enthalten ist. Was ist in deine Vorlage gelangt, nachdem die Temperatur gestiegen ist?', 'Nimm eine Probe aus einer Vorlage, die nur während des ersten Temperaturabschnitts gefüllt wurde. Beginne sonst neu und höre rechtzeitig auf.'],
      noChange: ['Wie trennt man die Stoffe in getrennte Gefäße?', 'Wenn die Temperatur auf den nächsten Abschnitt steigt, kommt ein anderer Stoff.', 'Tippe auf „Vorlage wechseln“, sobald die Temperatur nach dem ersten Abschnitt ansteigt.'],
      mixedFraction: ['Wann hast du die Vorlage gewechselt?', 'Im Temperatur-Zeit-Diagramm siehst du, wann die Temperatur ansteigt.', 'Wechsle die Vorlage genau dann, wenn die Temperatur den Abschnitt verlässt. Beginne bei Bedarf neu.'],
      needFractions: ['Welche Stoffe sollen getrennt werden?', 'Propanon geht zuerst über, Ethanol danach. Beide Fraktionen brauchen mindestens 3 mL.', 'Fange Propanon (um 57 °C) in Vorlage 1 auf, wechsle die Vorlage, fange Ethanol (um 79 °C) in Vorlage 2 auf.'],
      done: ['Dein Versuch belegt die Aufgabe.', 'Vergleiche Temperatur und Menge unter „Ergebnisse“.', 'Beantworte jetzt die Fragen im Protokoll.']
    };
    return H[code] || H.notFilled;
  }

  // ------------------------------------------------------------------ Protokoll
  const OBS = {
    plateau: 'Die Temperatur am Thermometer stieg zuerst an und blieb dann, während das Destillat überging, nahezu gleich.',
    drops: 'Im inneren Rohr des Kühlers bildeten sich Tropfen, die zum Vorstoß liefen.',
    heater: 'Das Thermometer zeigte die Temperatur des Heizpilzes an.',
    waterInner: 'Das Kühlwasser floss durch das innere Rohr des Kühlers.',
    smoke: 'Durch den Kühler zog eine weiße Rauchwolke – das war der Dampf.',
    coolUp: 'Das Kühlwasser hat die Siedetemperatur erhöht.'
  };
  const plateauSeen = (f) => !!f && f.thermoOk !== false && f.drops >= 20 && f.T90 - f.T10 <= 3;

  /** Messwertfeld: Vergleich mit dem eigenen Versuch (Toleranz). */
  function numQ(id, legend, unit, valueFor, tol, extra) {
    return Object.assign({ id, type: 'num', legend, unit, valueFor, tol }, extra || {});
  }

  function questions(taskId, snap) {
    const s = snap || { fractions: [], burnTests: [] };
    if (taskId === 'pew') return expertQuestions(s);
    const key = taskId === 'pw' ? 'P' : 'E';
    const f = mainFraction(taskId, s, key);
    const fLabel = f ? `Vorlage ${f.n}` : 'deiner Vorlage';
    const qs = [
      numQ('temp', `1. Dampftemperatur, während das Destillat in ${fLabel} überging (abgelesen)`, '°C', () => (f ? f.Tmed : null), 1.5, { thermoWarn: () => f && f.thermoOk === false }),
      numQ('vol', `2. Volumen des Destillats in ${fLabel}`, 'mL', () => (f ? f.vol : null), (v) => Math.max(0.6, v * 0.06)),
      { id: 'obs', type: 'many', legend: '3. Beobachtung (alles Zutreffende ankreuzen)', options: OBS,
        answerFor: (sn) => { const ff = mainFraction(taskId, sn, key); return [plateauSeen(ff) && 'plateau', sn.condensed && 'drops'].filter(Boolean); },
        wrong: 'Vergleiche jede Aussage mit dem, was du im Labor gesehen hast. Dampf ist bei diesen Stoffen unsichtbar.' },
      { id: 'result', type: 'one', legend: '4. Das Destillat in deiner Vorlage ist …',
        options: taskId === 'pw'
          ? { P: 'eine Flüssigkeit, die überwiegend aus Propanon besteht.', W: 'eine Flüssigkeit, die überwiegend aus Wasser besteht.', mix: 'ein Gemisch, etwa so zusammengesetzt wie der Kolbeninhalt.', vessel: 'das Glasgefäß unter dem Vorstoß.' }
          : { E: 'eine Flüssigkeit, die überwiegend aus Ethanol besteht.', W: 'eine Flüssigkeit, die überwiegend aus Wasser besteht.', mix: 'ein Gemisch, etwa so zusammengesetzt wie der Kolbeninhalt.', vessel: 'das Glasgefäß unter dem Vorstoß.' },
        answerFor: (sn) => { const ff = mainFraction(taskId, sn, key); return ff ? (ff.main === key || ff.main === 'W' ? ff.main : 'mix') : key; },
        wrong: 'Das Gefäß heißt Vorlage, die Flüssigkeit darin Destillat. Welcher Stoff siedet zuerst?' },
      { id: 'why', type: 'one', legend: '5. Deutung: Warum geht zuerst vor allem ' + SUB[key].name + ' über?',
        options: {
          bp: `${SUB[key].name} hat eine niedrigere Siedetemperatur als Wasser und verdampft deshalb zuerst.`,
          heavy: 'Wasser ist schwerer und bleibt deshalb im Kolben liegen.',
          cooler: 'Der Kühler hält das Wasser zurück und lässt nur ' + SUB[key].name + ' durch.',
          stones: 'Die Siedesteine binden das Wasser.'
        }, correct: 'bp', wrong: 'Welche Stoffeigenschaft entscheidet, welcher Stoff zuerst verdampft?' },
      taskId === 'pw'
        ? { id: 'gap', type: 'gap', legend: '6. Fachbegriff: Die Temperatur, bei der ein Reinstoff siedet, heißt …',
          gap: { accept: ['Siedetemperatur', 'Siedepunkt'], forbid: [{ term: 'Schmelztemperatur', hint: 'Beim Schmelzen wird ein Feststoff flüssig. Gesucht ist der Übergang flüssig → gasförmig.' }, { term: 'Schmelzpunkt', hint: 'Beim Schmelzen wird ein Feststoff flüssig. Gesucht ist der Übergang flüssig → gasförmig.' }], hint: 'Gesucht ist die Temperatur, bei der eine Flüssigkeit siedet.' } }
        : { id: 'gap', type: 'gap', legend: '6. Fachbegriff: Im Liebigkühler wird der Dampf wieder flüssig. Dieser Vorgang heißt …',
          gap: { accept: ['Kondensation', 'Kondensieren', 'kondensieren'], forbid: [{ term: 'Verdampfen', hint: 'Verdampfen geschieht im Kolben (flüssig → gasförmig). Im Kühler geschieht das Umgekehrte.' }, { term: 'Verdunsten', hint: 'Verdunsten ist ein Übergang flüssig → gasförmig. Im Kühler geschieht das Umgekehrte.' }, { term: 'Resublimation', hint: 'Resublimation führt vom Gas direkt zum Feststoff. Hier entsteht eine Flüssigkeit.' }], hint: 'Gesucht ist der Übergang gasförmig → flüssig.' } }
    ];
    if (taskId === 'ew') {
      qs.push({ id: 'burn', type: 'one', legend: '7. Was zeigt deine Brennprobe?', needs: 'burn',
        options: {
          burns: 'Das Destillat enthält so viel brennbaren Stoff (hier: Ethanol), dass es anhaltend brennt.',
          little: 'Das Destillat enthält Ethanol, aber zu wenig für eine anhaltende Flamme.',
          none: 'Das Destillat enthält zu wenig Ethanol, um sich zu entzünden.',
          pure: 'Die bläuliche Flamme beweist, dass das Destillat reines Ethanol ist.'
        },
        answerFor: (sn) => { const t = sn.burnTests[sn.burnTests.length - 1]; return t ? { burns: 'burns', flicker: 'little', none: 'none' }[t.result] : 'burns'; },
        wrong: 'Erinnere dich an deine Flamme. Eine Flamme zeigt Brennbarkeit – sie beweist keine Reinheit.' });
    }
    return qs;
  }

  function expertQuestions(s) {
    const fr = s.fractions.filter((f) => f.vol >= 0.5).slice(0, 4);
    const qs = [];
    fr.forEach((f, i) => {
      qs.push({ id: `f${f.n}main`, type: 'one', legend: `${i * 2 + 1}. Vorlage ${f.n} (${fmt(f.vol, 1)} mL): Hauptbestandteil`,
        options: { P: 'Propanon', E: 'Ethanol', W: 'Wasser', mix: 'Gemisch zweier Stoffe (Übergang)' },
        answerFor: (sn) => { const ff = sn.fractions.find((x) => x.n === f.n); return ff ? ff.main : 'mix'; },
        wrong: 'Bei welcher Temperatur ist diese Fraktion übergegangen? Vergleiche mit den Siedetemperaturen.' });
      qs.push(numQ(`f${f.n}temp`, `${i * 2 + 2}. Vorlage ${f.n}: Dampftemperatur beim Übergehen (abgelesen)`, '°C', (sn) => { const ff = sn.fractions.find((x) => x.n === f.n); return ff ? ff.Tmed : null; }, 2,
        { thermoWarn: (sn) => { const ff = sn.fractions.find((x) => x.n === f.n); return ff && ff.thermoOk === false; } }));
    });
    const k = fr.length * 2;
    qs.push({ id: 'curve', type: 'many', legend: `${k + 1}. Temperaturverlauf (alles Zutreffende ankreuzen)`,
      options: {
        order: 'Zuerst ging Propanon über, dann Ethanol, zuletzt Wasser.',
        between: 'Zwischen den Abschnitten stieg die Temperatur an – dort wechselt man die Vorlage.',
        same: 'Alle drei Stoffe gingen gleichzeitig über.',
        high: 'Der Stoff mit der höchsten Siedetemperatur ging zuerst über.'
      }, correct: ['order', 'between'], wrong: 'Sieh dir das Temperatur-Zeit-Diagramm an.' });
    qs.push({ id: 'gap', type: 'gap', legend: `${k + 2}. Fachbegriff: Die nacheinander aufgefangenen Destillatportionen nennt man …`,
      gap: { accept: ['Fraktionen', 'Fraktion'], forbid: [{ term: 'Vorlagen', hint: 'Vorlagen sind die Gefäße. Gesucht ist der Name der aufgefangenen Portionen.' }], hint: 'Gesucht ist ein Wort für „Teil, Anteil“ einer Destillation.' } });
    return qs;
  }

  function correctFor(q, snap) { return q.answerFor ? q.answerFor(snap) : q.correct; }

  /** Antworten prüfen: je Feld richtig/falsch, Eingaben bleiben erhalten. */
  function grade(taskId, answers, snap) {
    const res = {};
    let all = true;
    const qs = questions(taskId, snap);
    for (const q of qs) {
      const a = answers[q.id];
      let ok = false, feedback = '', status = 'answered';
      if (q.type === 'num') {
        const truth = q.valueFor(snap);
        const v = core.parseNum(a);
        if (truth == null) { status = 'nodata'; feedback = 'Dazu gibt es in deinem Versuch noch keinen Messwert.'; }
        else if (Number.isNaN(v)) status = 'empty';
        else {
          const tol = typeof q.tol === 'function' ? q.tol(truth) : q.tol;
          ok = Math.abs(v - truth) <= tol;
          feedback = ok ? 'Passt zu deinem Versuch.' : `Passt nicht zu deinem Versuch. Lies ${q.unit === '°C' ? 'die Digitalanzeige bzw. das Thermometer, während das Destillat tropft,' : 'die Angabe an der Vorlage'} noch einmal ab.`;
          if (q.thermoWarn && q.thermoWarn(snap)) { ok = false; feedback = 'Achtung: Die Thermometerkugel saß beim Auffangen nicht auf Höhe des seitlichen Abgangs. Dieser Messwert ist nicht die Dampftemperatur – korrigiere die Lage und miss neu.'; }
        }
      } else if (q.type === 'gap') {
        const g = core.checkGap(q.gap, a);
        ok = core.gapOk(g); feedback = g.feedback; status = g.status;
      } else if (q.type === 'many') {
        const sel = new Set(Array.isArray(a) ? a : []);
        const cor = new Set(correctFor(q, snap));
        if (!sel.size) status = 'empty';
        ok = sel.size === cor.size && [...cor].every((k) => sel.has(k));
        if (!ok && sel.size) {
          const wrongSel = [...sel].filter((k) => !cor.has(k)).length;
          const missing = [...cor].filter((k) => !sel.has(k)).length;
          feedback = (wrongSel ? `${wrongSel} angekreuzte Aussage${wrongSel > 1 ? 'n treffen' : ' trifft'} nicht zu. ` : '') + (missing ? `Es fehlt noch ${missing === 1 ? 'eine zutreffende Aussage' : missing + ' zutreffende Aussagen'}. ` : '') + q.wrong;
        }
      } else {
        if (q.needs === 'burn' && !(snap && snap.burnTests.length)) { status = 'nodata'; feedback = 'Führe zuerst die Brennprobe durch.'; }
        else if (a == null || a === '') status = 'empty';
        else { ok = String(a) === String(correctFor(q, snap)); if (!ok) feedback = q.wrong; }
      }
      if (status === 'empty') feedback = 'Noch keine Antwort.';
      else if (ok && !feedback) feedback = 'Richtig.';
      res[q.id] = { ok, status, feedback };
      if (!ok) all = false;
    }
    return { fields: res, allCorrect: all, count: qs.length };
  }

  /** Richtige Antworten für „Lösung anzeigen“ (aus dem eigenen Versuch, sonst Modellerwartung). */
  function solutionAnswers(taskId, snap) {
    const out = {};
    for (const q of questions(taskId, snap)) {
      if (q.type === 'gap') out[q.id] = q.gap.accept[0];
      else if (q.type === 'num') { const v = snap ? q.valueFor(snap) : null; out[q.id] = v == null ? '' : fmt(v, 1); }
      else out[q.id] = snap ? correctFor(q, snap) : q.correct || (q.type === 'many' ? [] : '');
    }
    return out;
  }

  const SOLUTIONS = {
    ew: 'Mit Siedesteinen, korrekt angeschlossenem Kühlwasser (unten hinein, oben heraus), Thermometerkugel auf Höhe des seitlichen Abgangs und Heizstufe „mittel“ siedet das Gemisch nach einigen Minuten. Die Dampftemperatur steigt und bleibt dann bei etwa 79–80 °C nahezu gleich: Im Modell geht praktisch nur Ethanol über (Siedetemperatur 78 °C). Der unsichtbare Dampf kondensiert im Innenrohr des Liebigkühlers, das Destillat tropft in die Vorlage. Die Probe brennt am Prüfplatz mit bläulicher Flamme – das zeigt Brennbarkeit, beweist aber keine Reinheit. Real ist das Destillat nie reines Ethanol.',
    pw: 'Propanon siedet bei 56 °C, also viel niedriger als Wasser (100 °C) und auch als Ethanol (78 °C). Die Dampftemperatur bleibt beim Übergehen bei etwa 57–58 °C. Wegen des großen Unterschieds der Siedetemperaturen lassen sich Propanon und Wasser auch real recht gut trennen. Danach steigt die Temperatur deutlich an.',
    pew: 'Die Temperaturkurve zeigt Abschnitte nahezu gleicher Temperatur: zuerst bei etwa 57 °C (Propanon), dann bei etwa 79 °C (Ethanol), schließlich bei 100 °C (Wasser). Zwischen den Abschnitten steigt die Temperatur an; dort wechselt man die Vorlage. So erhält man drei Fraktionen. Die Trennung ist im Modell idealisiert.'
  };

  // ------------------------------------------------------------------ Geräte-Trainer
  const PART_ORDER = ['flask', 'mantle', 'stones', 'head', 'thermo', 'condenser', 'inlet', 'outlet', 'adapter', 'receiver', 'distillate', 'stand'];
  const PART_NAMES = {
    flask: 'Rundkolben', mantle: 'Heizpilz', stones: 'Siedesteine', head: 'Destillationsaufsatz', thermo: 'Thermometer',
    condenser: 'Liebigkühler', inlet: 'Kühlwasserzulauf', outlet: 'Kühlwasserablauf', adapter: 'Vorstoß',
    receiver: 'Vorlage', distillate: 'Destillat', stand: 'Stativ mit Klemme',
    // nur im Modus „Erkunden“ (nicht Teil der Zuordnungsaufgabe)
    mixture: 'Gemisch (Vorratsflasche)', tap: 'Laborarmatur (Wasserhahn)', sink: 'Ausguss', pipette: 'Pipette', dish: 'Porzellanschale', lighter: 'Stabfeuerzeug'
  };
  const PART_INFO = {
    flask: 'Enthält das zu trennende Flüssigkeitsgemisch. Die runde Form verträgt das Erhitzen gut.',
    mantle: 'Elektrische Heizquelle, die den Rundkolben gleichmäßig erwärmt. Hier aufgeschnitten gezeichnet, damit man den Kolbeninhalt sieht. Eigener Schalter EIN/AUS und Heizstufe.',
    stones: 'Poröse Steinchen am Kolbenboden. Sie sorgen für gleichmäßiges Sieden und verhindern einen Siedeverzug. Vor dem Erhitzen zugeben, nie in heiße Flüssigkeit.',
    head: 'Verbindet Kolben, Thermometer und Kühler. Der Dampf steigt hinein und strömt durch den seitlichen Abgang in den Kühler.',
    thermo: 'Misst die Temperatur des Dampfes. Die Kugel gehört genau auf Höhe des seitlichen Abgangs – nicht in die Flüssigkeit.',
    condenser: 'Zwei getrennte Räume: Im Innenrohr strömt der Dampf und kondensiert; im äußeren Mantel fließt das Kühlwasser.',
    inlet: 'Unterer Anschluss des Kühlmantels: Hier strömt das kalte Wasser vom Wasserhahn hinein.',
    outlet: 'Oberer Anschluss des Kühlmantels: Hier fließt das erwärmte Wasser zum Ausguss. So füllt sich der Mantel ganz, ohne Luftblase.',
    adapter: 'Leitet das Destillat vom Kühler in die Vorlage. Die kleine Olive hält die Apparatur offen (Druckausgleich).',
    receiver: 'Das Auffanggefäß unter dem Vorstoß (hier ein Erlenmeyerkolben mit Skala).',
    distillate: 'Die in der Vorlage aufgefangene Flüssigkeit.',
    stand: 'Hält die Glasapparatur sicher. Die Stange mit Doppelmuffe fasst den Kolbenhals von hinten.',
    mixture: 'Vorratsflasche mit dem zu trennenden Flüssigkeitsgemisch (z. B. Ethanol und Wasser). Beide Flüssigkeiten sind farblos und vollständig mischbar – man sieht nur eine Flüssigkeit.',
    tap: 'Laborarmatur am Ausguss. Von hier fließt das Kühlwasser durch den Zulaufschlauch zum unteren Anschluss des Kühlers.',
    sink: 'Ausguss: Hierhin läuft das erwärmte Kühlwasser aus dem oberen Anschluss zurück.',
    pipette: 'Pasteurpipette mit Saughütchen: entnimmt eine kleine Probe aus der abgenommenen Vorlage.',
    dish: 'Porzellanschale am getrennten Prüfplatz: Hier wird die kleine Probe entzündet – nie an der Apparatur.',
    lighter: 'Stabfeuerzeug: zündet die Probe in der Porzellanschale mit Abstand an.'
  };
  const TRAINER_DISTRACTORS = ['Becherglas', 'Bunsenbrenner', 'Scheidetrichter'];
  const TRAINER_TERMS = () => PART_ORDER.map((id) => PART_NAMES[id]).concat(TRAINER_DISTRACTORS).sort((a, b) => a.localeCompare(b, 'de'));

  function gradeNames(answers) {
    const fields = {};
    let n = 0;
    PART_ORDER.forEach((id, i) => {
      const a = answers[id];
      const ok = a === PART_NAMES[id];
      if (ok) n++;
      let fb = '';
      if (!a) fb = 'Noch keine Antwort.';
      else if (ok) fb = 'Richtig.';
      else if ((id === 'receiver' && a === 'Destillat') || (id === 'distillate' && a === 'Vorlage')) fb = 'Vorsicht: Die Vorlage ist das Gefäß, das Destillat die Flüssigkeit darin.';
      else if ((id === 'inlet' && a === 'Kühlwasserablauf') || (id === 'outlet' && a === 'Kühlwasserzulauf')) fb = 'Zulauf und Ablauf vertauscht: Kühlwasser fließt unten hinein und oben heraus.';
      else fb = 'Das passt nicht zu Nummer ' + (i + 1) + '.';
      fields[id] = { ok, status: a ? 'answered' : 'empty', feedback: fb };
    });
    return { fields, correct: n, allCorrect: n === PART_ORDER.length };
  }
  const NAME_HINTS = [
    'Gehe dem Weg des Stoffes nach: Kolben → Aufsatz → Kühler → Vorstoß → Gefäß.',
    'Unterscheide genau: Vorlage (Gefäß) und Destillat (Flüssigkeit); Zulauf (unten) und Ablauf (oben) des Kühlwassers.',
    'Schalte „Beschriftung“ auf der Bühne ein oder tippe im Modus „Geräte erkunden“ auf die markierten Geräte – dort steht jeweils der Fachbegriff.'
  ];

  const FUNCTION_QUESTIONS = [
    { id: 'stones', legend: 'Wozu gibt man Siedesteine in den Kolben?', options: { even: 'Sie sorgen für gleichmäßiges Sieden und verhindern einen Siedeverzug.', fast: 'Sie erhitzen das Gemisch schneller.', bind: 'Sie binden das Wasser.', show: 'Sie zeigen an, wann die Flüssigkeit siedet.' }, correct: 'even' },
    { id: 'thermo', legend: 'Was misst das Thermometer am seitlichen Abgang?', options: { vapor: 'die Temperatur des Dampfes, der in den Kühler strömt', heater: 'die Temperatur des Heizpilzes', water: 'die Temperatur des Kühlwassers', room: 'die Raumtemperatur' }, correct: 'vapor' },
    { id: 'condenser', legend: 'Was geschieht im Liebigkühler?', options: { cond: 'Der Dampf gibt im Innenrohr Wärme an das Kühlwasser ab und kondensiert.', mix: 'Kühlwasser und Dampf vermischen sich.', heat: 'Der Dampf wird weiter erhitzt.', filter: 'Das Gemisch wird gefiltert.' }, correct: 'cond' },
    { id: 'flow', legend: 'Warum fließt das Kühlwasser unten hinein und oben heraus?', options: { full: 'So füllt sich der Mantel vollständig ohne Luftblase, und das kälteste Wasser kühlt am Ende des Kühlers (Gegenstrom).', up: 'Weil Wasser von selbst nach oben fließt.', fast: 'Damit das Wasser schneller abfließt.', none: 'Das ist gleichgültig.' }, correct: 'full' },
    { id: 'receiver', legend: 'Wie heißt das Gefäß, in dem das Destillat aufgefangen wird?', options: { v: 'Vorlage', d: 'Destillat', r: 'Rundkolben', a: 'Vorstoß' }, correct: 'v' },
    { id: 'distillate', legend: 'Wie heißt die aufgefangene Flüssigkeit?', options: { d: 'Destillat', v: 'Vorlage', k: 'Kühlwasser', r: 'Rückstand' }, correct: 'd' }
  ];
  const FUNCTION_HINTS = [
    'Denke an die beiden Vorgänge: Verdampfen im Kolben, Kondensieren im Kühler.',
    'Das Thermometer steckt im Dampf, nicht in der Flüssigkeit; Kühlwasser und Dampf berühren sich nie.',
    'Tippe im Modus „Geräte erkunden“ auf Siedesteine, Thermometer und Liebigkühler – die Kurzinfo nennt die Funktion.'
  ];
  function gradeFunctions(answers) {
    const fields = {};
    let n = 0;
    for (const q of FUNCTION_QUESTIONS) {
      const a = answers[q.id];
      const ok = a === q.correct;
      if (ok) n++;
      fields[q.id] = { ok, status: a ? 'answered' : 'empty', feedback: !a ? 'Noch keine Antwort.' : ok ? 'Richtig.' : 'Noch nicht richtig.' };
    }
    return { fields, correct: n, allCorrect: n === FUNCTION_QUESTIONS.length };
  }

  const THEORY = [
    ['Siedetemperatur', 'Jeder Reinstoff siedet bei einer bestimmten Temperatur (bei etwa 1013 hPa): Propanon 56 °C, Ethanol 78 °C, Wasser 100 °C. Die Siedetemperatur ist eine Stoffeigenschaft.'],
    ['Verdampfen', 'Im Kolben verdampft beim Sieden zuerst vor allem der Stoff mit der niedrigsten Siedetemperatur. Der Dampf ist unsichtbar.'],
    ['Kondensieren', 'Im Innenrohr des Liebigkühlers gibt der Dampf Wärme an das Kühlwasser ab und wird wieder flüssig. Die Tropfen laufen über den Vorstoß in die Vorlage.'],
    ['Kühlung', 'Kühlwasser und Dampf sind durch Glas getrennt. Ohne ausreichende Kühlung entweicht ein Teil des Dampfes – es entsteht weniger Destillat.']
  ];

  // ------------------------------------------------------------------ Hefteintrag
  const NOTEBOOK = {
    title: 'Destillation',
    lines: [
      'Bei der **Destillation** trennt man ein Flüssigkeitsgemisch aufgrund der unterschiedlichen **Siedetemperaturen** der Stoffe.',
      'Beim Erhitzen **verdampft** zuerst vor allem der Stoff mit der niedrigsten Siedetemperatur.',
      'Im **Liebigkühler** gibt der Dampf Wärme an das Kühlwasser ab und **kondensiert**. Das Kühlwasser fließt unten hinein und oben heraus.',
      'Die aufgefangene Flüssigkeit heißt **Destillat**, das Auffanggefäß **Vorlage**.',
      'Das **Thermometer** misst die Temperatur des Dampfes am seitlichen Abgang. **Siedesteine** verhindern einen Siedeverzug.'
    ],
    eq: 'Siedetemperaturen (1013 hPa): Propanon 56 °C · Ethanol 78 °C · Wasser 100 °C',
    rule: 'Eine einfache Destillation trennt meist nicht vollständig; Ethanol und Wasser lassen sich so nie ganz trennen.'
  };
  const notebookWords = () => [NOTEBOOK.title, ...NOTEBOOK.lines, NOTEBOOK.eq, NOTEBOOK.rule].join(' ').replace(/\*\*/g, '').split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;

  return {
    TASKS, TASK_ORDER, MODEL_NOTE, OBS, SOLUTIONS, NOTEBOOK, THEORY,
    PART_ORDER, PART_NAMES, PART_INFO, TRAINER_TERMS, NAME_HINTS, FUNCTION_QUESTIONS, FUNCTION_HINTS,
    evaluate, hints, questions, grade, solutionAnswers, gradeNames, gradeFunctions, notebookWords, mainFraction
  };
});
