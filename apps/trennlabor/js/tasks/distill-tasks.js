/*
 * Trennlabor – Aufgabe D-1: Destillation eines Ethanol-Wasser-Gemischs
 */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const distill = node ? require('../model/distill.js') : root.TL.distill;
  const util = node ? require('../util.js') : root.TL.util;
  const api = factory(distill, util);
  if (node) module.exports = api;
  else ((root.TL = root.TL || {}).tasks = root.TL.tasks || {}).distill = api;
})(typeof self !== 'undefined' ? self : this, function (distill, util) {
  'use strict';
  const { fmt } = util;
  const RNAME = { A: 'Vorlage 1', B: 'Vorlage 2', C: 'Vorlage 3' };

  function info(lab) {
    const st = lab.state;
    const best = Object.entries(st.receivers).map(([id, r]) => ({ id, vol: r.E + r.W, phi: distill.phiOf(r) }))
      .sort((a, b) => b.vol - a.vol)[0];
    const goodRec = Object.entries(st.receivers).map(([id, r]) => ({ id, vol: r.E + r.W, phi: distill.phiOf(r) }))
      .filter((x) => x.vol >= 5 && x.phi >= 0.5).sort((a, b) => b.vol - a.vol)[0];
    const okReads = st.collect.filter((c) => c.pos === 'correct' && c.read != null);
    const measureValid = !!st.firstDrop && st.firstDrop.pos === 'correct' && st.collect.length > 0 && st.collect.every((c) => c.pos === 'correct');
    const burn = st.burnTests.filter((b) => b.source !== 'flask');
    const burnOk = burn.some((b) => b.result === 'burns');
    return { st, best, goodRec, okReads, measureValid, burn, burnOk };
  }

  const D1 = {
    id: 'D-1', lab: 'distill', short: 'Ethanol-Wasser-Gemisch',
    title: 'Destillation eines Ethanol-Wasser-Gemischs',
    problem: 'Baue eine Destillationsapparatur selbst auf und gewinne aus einem Ethanol-Wasser-Gemisch (40 % Ethanol, Volumenanteil) ein ethanolreicheres Destillat. Miss dabei die Dampftemperatur und weise mit einer Brennprobe nach, dass dein Destillat brennbar ist.',
    goal: 'Mindestens 5 mL Destillat mit verlässlicher Temperaturmessung (Thermometer am seitlichen Abgang) und eine positive Brennprobe einer kleinen Destillatprobe – getrennt von der Apparatur.',
    materials: ['Ethanol-Wasser-Gemisch, 40 % Ethanol (Vorratsflasche, 25 mL je Portion)', 'Heizpilz (Stufen 1–4)', 'Rundkolben 250 mL, Siedesteine', 'Destillationsaufsatz mit Thermometer', 'Liebigkühler mit Kühlwasserschläuchen', 'Vorstoß, drei Vorlagen (Erlenmeyerkolben), Stopfen', 'Klemmen, Stativ', 'Porzellanschale und Stabfeuerzeug für die Brennprobe'],
    check(lab) {
      const x = info(lab);
      return {
        success: !!x.goodRec && x.measureValid && x.burnOk,
        items: [
          { label: 'Destillat aufgefangen (≥ 5 mL)', ok: !!x.goodRec || (x.best && x.best.vol >= 5 && x.best.phi >= 0.5), detail: x.best && x.best.vol > 0.05 ? `${RNAME[x.best.id]}: ${fmt(x.best.vol)} mL` : 'noch nicht' },
          { label: 'Dampftemperatur verlässlich gemessen', ok: x.measureValid, detail: !x.st.firstDrop ? 'noch kein Destillat' : x.measureValid ? `erster Tropfen bei ${fmt(x.st.firstDrop.read)} °C` : 'Thermometer saß nicht am seitlichen Abgang bzw. fehlte – Messung nicht verwertbar' },
          { label: 'Brennprobe des Destillats positiv', ok: x.burnOk, detail: x.burn.length ? x.burn.map((b) => `${b.label}: ${b.result === 'burns' ? 'brennt' : b.result === 'flicker' ? 'flackert kurz' : 'brennt nicht'}`).join('; ') : 'noch nicht durchgeführt' }
        ]
      };
    },
    observations(lab) {
      const x = info(lab);
      const reads = x.okReads.map((c) => c.read);
      const rise = reads.length ? Math.max(...reads) - Math.min(...reads) : 0;
      const lastBurn = x.burn[x.burn.length - 1];
      return [
        { id: 'first', q: 'Bei welcher Dampftemperatur fielen die ersten Tropfen Destillat? (Ablesung am Thermometer)', type: 'number', unit: '°C', tol: 1.5,
          correct: x.measureValid ? x.st.firstDrop.read : null,
          unavailable: !x.st.firstDrop ? 'Es ist noch kein Destillat übergegangen.' : x.measureValid ? '' : 'Deine Temperaturmessung ist nicht verwertbar: Das Thermometer saß nicht auf Höhe des seitlichen Abgangs.' },
        { id: 'trend', q: 'Wie verhielt sich die Dampftemperatur, während Destillat überging?', type: 'choice',
          options: [['rise', 'Sie stieg allmählich an.'], ['flat', 'Sie blieb fast gleich – deutlich über 78 °C.'], ['const78', 'Sie blieb genau bei 78 °C stehen.'], ['jump', 'Sie lag erst bei 78 °C und sprang dann auf 100 °C.']],
          correct: x.measureValid && reads.length >= 3 ? (rise >= 0.8 ? 'rise' : 'flat') : null,
          unavailable: x.measureValid && reads.length >= 3 ? '' : 'Sammle zuerst bei richtig sitzendem Thermometer etwas Destillat.' },
        { id: 'flame', q: 'Wie verlief die Brennprobe deiner Destillatprobe?', type: 'choice',
          options: [['burns', 'Sie brannte mit bläulicher, kaum leuchtender Flamme.'], ['sooty', 'Sie brannte mit gelber, rußender Flamme.'], ['flicker', 'Sie flackerte kurz auf und erlosch.'], ['none', 'Sie ließ sich nicht entzünden.']],
          correct: lastBurn ? lastBurn.result : null, unavailable: lastBurn ? '' : 'Führe zuerst eine Brennprobe mit Destillat durch.' },
        { id: 'meaning', q: 'Was zeigt eine positive Brennprobe?', type: 'choice',
          options: [['flammable', 'Das Destillat enthält so viel Ethanol, dass es brennt.'], ['pure', 'Das Destillat ist reines Ethanol.'], ['exact', 'Das Destillat enthält genau 78 % Ethanol.']],
          correct: x.burnOk ? 'flammable' : null, unavailable: x.burnOk ? '' : 'Dafür brauchst du eine positive Brennprobe.' }
      ];
    },
    gaps: {
      text: 'Ethanol siedet bei etwa {e78} °C, Wasser bei {w100} °C. Beim Erhitzen des Gemischs geht bevorzugt der Stoff mit der niedrigeren {sied} in den Dampf über. Im Liebigkühler wird der Dampf abgekühlt und {kond}. Das aufgefangene {dest} enthält mehr Ethanol als das Ausgangsgemisch, ist aber kein Reinstoff. Dieses Trennverfahren heißt {dst}.',
      gaps: {
        e78: { accept: ['78', '78,3', '78,4', '78.3', '78.4'], hint: 'Siedetemperatur von reinem Ethanol bei Normaldruck.' },
        w100: { accept: ['100'], hint: 'Siedetemperatur von reinem Wasser bei Normaldruck.' },
        sied: { accept: ['Siedetemperatur', 'Siedepunkt', 'Siedetemp'], wrong: [{ terms: ['Schmelztemperatur', 'Schmelzpunkt'], hint: 'Gesucht ist die Temperatur, bei der eine Flüssigkeit siedet.' }, { terms: ['Dichte'], hint: 'Die Dichte spielt beim Verdampfen keine Rolle.' }], hint: 'Welche Stoffeigenschaft nutzt die Destillation?' },
        kond: { accept: ['kondensiert', 'verflüssigt', 'flüssig'], wrong: [{ terms: ['verdampft', 'verdunstet'], hint: 'Im Kühler wird aus Dampf wieder Flüssigkeit.' }], hint: 'Was geschieht mit Dampf beim Abkühlen?' },
        dest: { accept: ['Destillat'], wrong: [{ terms: ['Filtrat'], hint: 'Ein Filtrat entsteht beim Filtrieren.' }, { terms: ['Rückstand'], hint: 'Der Rückstand bleibt im Kolben.' }], hint: 'Wie heißt die aufgefangene Flüssigkeit?' },
        dst: { accept: ['Destillation', 'Destillieren', 'Destillation'], wrong: [{ terms: ['Eindampfen', 'Verdampfen'], hint: 'Beim Eindampfen wird der Dampf nicht aufgefangen.' }], hint: 'Wie heißt das Verfahren?' }
      },
      bank: ['78', '100', 'Siedetemperatur', 'kondensiert', 'Destillat', 'Destillation', 'Rückstand']
    },
    theory: [
      'Ethanol (Siedetemperatur ca. <b>78 °C</b>) und Wasser (<b>100 °C</b>) sind unbegrenzt mischbar. Das Gemisch siedet nicht bei einer festen Temperatur: Mit 40 % Ethanol beginnt es bei etwa 84 °C zu sieden.',
      'Im Dampf über dem siedenden Gemisch ist der Anteil des leichter flüchtigen Ethanols größer als in der Flüssigkeit. Der Dampf wird im <b>Liebigkühler</b> abgekühlt und <b>kondensiert</b>: Das <b>Destillat</b> ist ethanolreicher als das Ausgangsgemisch, aber kein reines Ethanol.',
      'Weil zuerst mehr Ethanol verdampft, wird der Kolbeninhalt immer wasserreicher. Seine Siedetemperatur und damit die Dampftemperatur steigen allmählich an – es gibt keinen Sprung von 78 °C auf 100 °C.',
      'Kühlwasser fließt <b>unten hinein und oben heraus</b>, damit der Kühlmantel ganz gefüllt ist. Das Thermometer sitzt auf Höhe des seitlichen Abgangs, damit es die Temperatur des übergehenden Dampfs misst. Siedesteine verhindern Siedeverzüge. Die Apparatur bleibt am Ende offen.',
      'Die <b>Brennprobe</b> zeigt, dass das Destillat genug Ethanol enthält, um bei Raumtemperatur zu brennen (bläuliche, kaum leuchtende Flamme). Über die Reinheit oder den genauen Ethanolgehalt sagt sie nichts aus. Modellgrenze: Die Simulation vernachlässigt, dass Ethanol und Wasser ein Azeotrop bilden (95,6 % Massenanteil Ethanol); durch einfache Destillation lässt sich also nie reines Ethanol gewinnen.'
    ],
    notebook: (lab) => {
      const st = lab.state;
      const reads = st.collect.filter((c) => c.pos === 'correct').map((c) => c.read);
      const t0 = st.firstDrop && st.firstDrop.read, t1 = reads.length ? reads[reads.length - 1] : null;
      return {
        title: 'Destillation eines Ethanol-Wasser-Gemischs',
        sections: [
          ['Versuch', 'Ein Ethanol-Wasser-Gemisch (40 % Ethanol) wird mit Siedesteinen in einem Rundkolben mit dem Heizpilz erhitzt. Der Dampf strömt am Thermometer vorbei in den Liebigkühler (Kühlwasser unten hinein, oben heraus) und wird in einer Vorlage aufgefangen. Eine kleine Probe des Destillats wird in einer Porzellanschale entzündet.'],
          ['Beobachtung', `Das Gemisch beginnt zu sieden, das Thermometer steigt rasch an. ${t0 != null ? `Die ersten Tropfen fallen bei etwa ${fmt(t0, 0)} °C` : 'Die ersten Tropfen fallen bei etwa 84 °C'}${t1 != null && t1 - t0 >= 0.8 ? `; die Dampftemperatur steigt langsam auf ${fmt(t1, 0)} °C` : '; die Dampftemperatur steigt während der Destillation langsam an'}. Das Destillat brennt mit bläulicher, kaum leuchtender Flamme.`],
          ['Erklärung', 'Ethanol hat eine niedrigere Siedetemperatur als Wasser. Der Dampf über dem siedenden Gemisch enthält deshalb mehr Ethanol als die Flüssigkeit. Im Kühler kondensiert der Dampf; das Destillat ist ethanolreicher und brennbar. Der Kolbeninhalt wird wasserreicher, die Siedetemperatur steigt.'],
          ['Merksatz', 'Bei der Destillation trennt man Flüssigkeiten mit unterschiedlichen Siedetemperaturen durch Verdampfen und anschließendes Kondensieren. Aus einem Ethanol-Wasser-Gemisch erhält man so ein ethanolreicheres, aber kein reines Destillat.']
        ]
      };
    },
    help(lab) {
      const x = info(lab);
      const st = lab.state, p = st.parts;
      const T = st.flask.T;
      if (D1.check(lab).success) return { small: 'Dein Versuch ist gelungen. Denke an die Temperaturwerte und die Siedetemperaturen der Reinstoffe.', concrete: 'Öffne „Auswertung“. Die Temperaturen kannst du am Verlaufsdiagramm ablesen. Unter dem Lückentext steht jetzt eine Wortauswahl.' };
      if (st.safety) return { small: 'Lies die Erklärung des Sicherheitsstopps genau.', concrete: st.safety.fix };
      const rules = [
        [() => !p.mantle || !p.flask, 'Womit und worin wird das Gemisch erhitzt?', 'Stelle den Heizpilz auf und spanne den Rundkolben darüber ein.'],
        [() => lab.flaskVol() < 1, 'Was soll destilliert werden?', 'Fülle das Ethanol-Wasser-Gemisch in den Kolben (z. B. 4 × 25 mL), solange der Aufsatz noch nicht aufgesetzt ist.'],
        [() => !st.stones && T < 50 && !p.head, 'Was verhindert stoßartiges Sieden?', 'Gib Siedesteine in die kalte Flüssigkeit, bevor du den Aufsatz aufsetzt.'],
        [() => !st.stones && T >= 50, 'Darf man Siedesteine in heiße Flüssigkeit geben?', 'Nein! Heizung aus und abkühlen lassen; erst dann Siedesteine zugeben.'],
        [() => !st.stones && p.head, 'Fehlt im Kolben noch etwas?', 'Es fehlen Siedesteine. Nimm den Aufsatz noch einmal ab (Apparatur kalt), gib Siedesteine hinein und setze den Aufsatz wieder auf.'],
        [() => !p.head, 'Wie kommt der Dampf vom Kolben zum Kühler?', 'Setze den Destillationsaufsatz auf den Kolben.'],
        [() => !p.thermo, 'Wo misst man die Temperatur des übergehenden Dampfs?', 'Setze das Thermometer in den Aufsatz – auf Höhe des seitlichen Abgangs.'],
        [() => p.thermo !== 'correct', 'Misst dein Thermometer wirklich den Dampf, der zum Kühler strömt?', p.thermo === 'deep' ? 'Das Thermometer steckt in der Flüssigkeit und misst die Kolbentemperatur. Setze es so ein, dass die Thermometerkugel auf Höhe des seitlichen Abgangs sitzt.' : 'Das Thermometer sitzt zu hoch, außerhalb des Dampfstroms. Setze es auf Höhe des seitlichen Abgangs.'],
        [() => !p.cooler, 'Wo wird der Dampf wieder flüssig?', 'Schließe den Liebigkühler an den seitlichen Abgang an.'],
        [() => !p.hoseIn, 'Was kühlt den Kühler?', 'Schließe die Kühlwasserschläuche an: Zulauf unten, Ablauf oben.'],
        [() => p.hoseIn === 'top', 'Ist der Kühlmantel ganz mit Wasser gefüllt?', 'Der Zulauf ist oben angeschlossen – das Wasser läuft unten gleich wieder ab, der Mantel bleibt halb leer. Schließe den Zulauf unten und den Ablauf oben an.'],
        [() => !p.adapter, 'Wie gelangt das Destillat in die Vorlage?', 'Setze den Vorstoß an das Ende des Kühlers.'],
        [() => !p.clamps, 'Sind alle Verbindungen gesichert?', 'Sichere die Schliffverbindungen mit Klemmen.'],
        [() => !st.receiverAt, 'Wohin tropft das Destillat?', 'Stelle eine leere Vorlage unter den Vorstoß.'],
        [() => st.receiverStopper, 'Darf die Apparatur ganz geschlossen sein?', 'Nimm den Stopfen von der Vorlage. Die Apparatur muss am Ende offen bleiben.'],
        [() => st.cool === 0, 'Was braucht der Kühler, damit er kühlt?', 'Drehe das Kühlwasser auf (mittel oder stark), bevor du heizt.'],
        [() => st.heater === 0 && !st.firstDrop, 'Wodurch beginnt das Gemisch zu sieden?', 'Schalte den Heizpilz ein, z. B. auf Stufe 3.'],
        [() => st.heater === 1 && T > 60 && !st.firstDrop, 'Reicht die Heizleistung zum Sieden?', 'Auf Stufe 1 wird das Gemisch nicht heiß genug, weil die Wärme wieder an die Umgebung abgegeben wird. Stelle eine höhere Stufe ein (2 oder 3).'],
        [() => st.heater >= 4 && st.cool < 3, 'Schafft der Kühler den vielen Dampf?', 'Bei maximaler Heizung reicht die Kühlung nicht. Heize schwächer (Stufe 3) oder kühle stärker.'],
        [() => !st.firstDrop, 'Beobachte Kolben, Thermometer und Kühler.', 'Warte, bis das Gemisch siedet und die ersten Tropfen in die Vorlage fallen (Zeitraffer). Lies dann das Thermometer ab.'],
        [() => !x.goodRec, 'Wie viel Destillat brauchst du?', 'Sammle mindestens 5 mL Destillat. Beobachte dabei die Dampftemperatur.'],
        [() => !x.burn.length, 'Wie zeigst du, dass das Destillat Ethanol enthält?', 'Entnimm aus der Vorlage eine kleine Probe in die Porzellanschale und entzünde sie dort – nicht an der Apparatur.'],
        [() => !x.burnOk, 'Woher stammte deine Probe?', 'Die Probe brannte nicht. Nimm eine Probe aus der ersten, ethanolreichen Fraktion (früh aufgefangenes Destillat).'],
        [() => !x.measureValid, 'War das Thermometer die ganze Zeit an der richtigen Stelle?', 'Deine Temperaturmessung ist nicht verwertbar. Lass die Apparatur abkühlen, leere bzw. tausche die Vorlage und destilliere erneut mit richtig sitzendem Thermometer.']
      ];
      for (const [w, s, c] of rules) if (w()) return { small: s, concrete: c };
      return { small: 'Überlege, was noch fehlt.', concrete: 'Prüfe die Erfolgsliste in der Auswertung.' };
    }
  };

  D1.createEngine = () => distill.create();
  return { TASKS: [D1] };
});
