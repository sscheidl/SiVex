/*
 * Trennverfahren – Aufgaben, Hilfen, Kontrolle und Hefteintrag (ohne DOM)
 *
 * Ablauf: fünf Versuche (Trennziel am Versuchszustand, eigene Beobachtung im
 * Freitext, Einordnung und Trennprinzip als geschlossene Formate) → gemeinsame
 * Kontrolle (Multiple Choice + Lückentext) → Hefteintrag.
 * Freitexte werden nie automatisch bewertet; geprüft wird nur, ob etwas notiert ist.
 */
(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('../../../shared/labkit/js/core.js') : root.LK.core;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TV = root.TV || {}).tasks = api;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const fx = (v, d) => core.fmt(v, d == null ? 1 : d);

  // ------------------------------------------------------------------ Gemeinsame Antwortoptionen
  const KINDS = [
    { id: 'loesung', label: 'Lösung' },
    { id: 'suspension', label: 'Suspension' },
    { id: 'emulsion', label: 'Emulsion' },
    { id: 'gemenge', label: 'Gemenge' },
    { id: 'reinstoff', label: 'Reinstoff (kein Gemisch)' }
  ];
  const PRINCIPLES = [
    { id: 'dichte', label: 'Dichte (der schwerere Stoff sinkt nach unten)' },
    { id: 'loes', label: 'Löslichkeit in Wasser (löslich / unlöslich)' },
    { id: 'misch', label: 'Mischbarkeit zweier Flüssigkeiten' },
    { id: 'korn', label: 'Korngröße im Vergleich zu den Filterporen (Trennkriterium)' },
    { id: 'magn', label: 'Magnetismus' },
    { id: 'fluecht', label: 'Flüchtigkeit: Wasser verdampft, Salz nicht' },
    { id: 'farbe', label: 'Farbe' }
  ];
  const PRINCIPLE_WHY = {
    dichte: 'Dichte: Was dichter ist, sinkt nach unten – beim Absetzen (Sand) und bei zwei Flüssigkeitsschichten (Öl oben).',
    loes: 'Löslichkeit: Sand löst sich nicht in Wasser, Kochsalz schon.',
    misch: 'Mischbarkeit: Öl und Wasser mischen sich nicht, deshalb entstehen zwei Schichten.',
    korn: 'Korngröße: Ungelöste Körner sind größer als die Poren des Filterpapiers. Das ist ein Trennkriterium, aber keine Kenneigenschaft des Stoffes.',
    magn: 'Magnetismus: Nur Eisen wird vom Magneten angezogen.',
    fluecht: 'Flüchtigkeit: Beim Erhitzen verdampft das Wasser, das Salz bleibt zurück.',
    farbe: 'Die Farbe hilft beim Erkennen, wird aber bei keinem dieser Verfahren zum Trennen genutzt.'
  };

  // ------------------------------------------------------------------ Versuche
  const EXP = {
    1: {
      goal: 'Trennziel: klares Wasser vom Sand trennen – durch Absetzen und Abgießen.',
      problem: 'In Becherglas A sind Sand und Wasser. Trenne möglichst klares Wasser vom Sand ab, ohne Filter. Rühre zuerst auf und beobachte, was dann passiert.',
      material: 'Becherglas A mit 100 mL Wasser und 20 g Sand, zwei leere Bechergläser (B, C), Glasstab',
      cls: { q: 'Sand und Wasser nach dem Aufrühren:', hom: 'het', kind: 'suspension' },
      prin: ['dichte', 'loes'],
      obsHint: 'Was siehst du nach dem Aufrühren, beim Warten und beim Abgießen? (Trübung, Bodensatz, Farbe …)',
      explHint: 'Warum setzt sich der Sand ab? Warum wird das abgegossene Wasser manchmal trüb?',
      tips: [
        () => 'Was passiert mit dem Sand, wenn das Gemisch eine Weile ruhig steht?',
        (st, ev) => !ok(ev, 'stirred') ? 'Wähle den Glasstab und tippe Becherglas A an, damit eine trübe Suspension entsteht. Beobachte dann den Bereich über dem Sand – mit dem Zeitraffer geht das Warten schneller.'
          : ok(ev, 'poured') && !ok(ev, 'clear') ? 'Dein abgegossenes Wasser enthält noch Sand. Lass es in diesem Becherglas wieder absetzen und gieße nur den klaren Teil vorsichtig in ein leeres Becherglas.'
          : 'Warte, bis die Flüssigkeit über dem Bodensatz klar ist. Gieße dann vorsichtig – zügiges Gießen wirbelt den Sand wieder auf.',
        () => 'Becherglas A antippen, dann Becherglas B antippen: Es wird vorsichtig gegossen. Tippe „Gießen stoppen“, bevor der Bodensatz zum Ausguss rutscht (etwa 25 mL bleiben über dem Sand). Ist das Wasser in B trüb: absetzen lassen und von B nach C abgießen.'
      ],
      solution: [
        'Glasstab wählen und Becherglas A antippen: Der Sand wird aufgewirbelt, das Gemisch ist trüb (Suspension).',
        'Warten (Zeitraffer 10× oder 30×), bis sich der Sand abgesetzt hat und das Wasser darüber klar ist (etwa 1–2 Minuten Versuchszeit).',
        'Becherglas A antippen, dann Becherglas B. „vorsichtig“ gießen und „Gießen stoppen“, solange noch etwas Wasser über dem Sand steht.',
        'Ergebnis: klares Wasser (Dekantat) in B, nasser Sand bleibt in A. Ein trübes Dekantat erneut absetzen lassen und in C abgießen.'
      ]
    },
    2: {
      goal: 'Trennziel: Sand als Rückstand und klares Wasser als Filtrat gewinnen.',
      problem: 'Ein frischer Ansatz Sand und Wasser soll vollständiger getrennt werden als beim Dekantieren. Richte die Filtration selbst ein und filtriere. Vergleiche mit Versuch 1.',
      material: 'Becherglas A mit 100 mL Wasser und 20 g Sand, Glasstab, Rundfilter, Trichter, Stativ mit Filtrierring, Erlenmeyerkolben, Becherglas B, Spritzflasche mit Wasser',
      cls: { q: 'Sand und Wasser nach dem Aufrühren:', hom: 'het', kind: 'suspension' },
      prin: ['korn', 'loes'],
      obsHint: 'Was siehst du im Filter, unter dem Trichter und im Auffanggefäß? Wie unterscheidet sich das Ergebnis von Versuch 1?',
      explHint: 'Warum bleibt der Sand im Papier, das Wasser aber nicht?',
      tips: [
        () => 'Was muss im Trichter liegen, damit der Sand zurückgehalten wird – und wohin soll die durchlaufende Flüssigkeit?',
        (st, ev) => !ok(ev, 'paper') ? 'Lege ein Filterpapier in den Trichter, setze den Trichter in den Ring am Stativ und stelle ein Auffanggefäß darunter, bevor du gießt.'
          : ok(ev, 'filtrate') && !ok(ev, 'residue') ? 'Ein Teil des Sandes ist noch in Becherglas A. Gib mit der Spritzflasche wenig Wasser dazu, rühre auf und gieße den Rest auf den Filter.'
          : 'Rühre auf und gieße die Suspension auf den Filter. Läuft der Trichter voll, warte, bis Flüssigkeit durchgelaufen ist, und gieße dann nach.',
        () => 'Filterpapier antippen → Trichter antippen (Papier einlegen). Trichter antippen → Ring am Stativ antippen. Erlenmeyerkolben antippen → Platz unter dem Trichter antippen. Glasstab → A (aufrühren), A → Trichter (gießen, „zügig“ ist hier in Ordnung). Rest mit der Spritzflasche ausspülen.'
      ],
      solution: [
        'Filterpapier in den Trichter legen, Trichter in den Filtrierring setzen, Erlenmeyerkolben als Vorlage darunterstellen.',
        'Gemisch aufrühren und auf den Filter gießen; bei vollem Trichter warten und nachgießen.',
        'Restlichen Sand mit wenig Wasser aus der Spritzflasche ausspülen und ebenfalls auf den Filter geben.',
        'Ergebnis: Sand bleibt als Rückstand im Filterpapier, klares Filtrat im Erlenmeyerkolben. Etwas Wasser bleibt im feuchten Rückstand hängen. Anders als beim Dekantieren gelangt kein Sand ins Wasser.'
      ]
    },
    3: {
      goal: 'Trennziel: festes Kochsalz aus der Kochsalzlösung gewinnen.',
      problem: 'In Becherglas A ist eine klare Kochsalzlösung. Gewinne das Salz als Feststoff zurück. Beobachte genau, was mit dem Wasser und mit dem Salz passiert.',
      material: 'Becherglas A mit 40 mL Kochsalzlösung (8 g Kochsalz gelöst), Abdampfschale auf einer Heizplatte, Glasstab',
      cls: { q: 'Die klare Kochsalzlösung ist …', hom: 'hom', kind: 'loesung' },
      prin: ['fluecht'],
      obsHint: 'Was siehst du beim Erhitzen, kurz vor dem Trocknen und danach? (Flüssigkeitsstand, Dunst, Blasen, Kristalle …)',
      explHint: 'Was geschieht mit dem Wasser und was mit dem Salz?',
      tips: [
        () => 'Welcher Bestandteil der Lösung lässt sich durch Erhitzen entfernen – und welcher bleibt zurück?',
        (st, ev) => st.objs.D.c.water + st.objs.D.c.saltD < 0.5 && st.objs.A.c.water > 1 ? 'Gieße die Lösung zuerst in die Abdampfschale, dann schalte die Heizplatte ein.'
          : st.plate && st.plate.level === 0 && st.objs.D.c.water > 1 ? 'Schalte die Heizplatte ein. Mit dem Zeitraffer siehst du schneller, wie der Flüssigkeitsstand sinkt.'
          : 'Wenn nur noch wenig Flüssigkeit da ist, beginnt das Salz zu spritzen. Schalte dann herunter oder aus – die Restwärme trocknet das Salz.',
        () => 'Becherglas A antippen → Abdampfschale antippen (gießen). Heizplatte „hoch“. Zeitraffer 30×. Wenn nur noch ein Rest Flüssigkeit da ist: Heizplatte „aus“ und warten, bis die Kristalle trocken sind.'
      ],
      solution: [
        'Kochsalzlösung in die Abdampfschale gießen und die Heizplatte einschalten.',
        'Die Lösung erwärmt sich, siedet schließlich; der Flüssigkeitsstand sinkt, am Rand bilden sich Kristalle.',
        'Kurz vor dem Trocknen die Heizplatte ausschalten; die Restwärme verdampft den Rest.',
        'Ergebnis: weiße Kochsalzkristalle in der Schale. Das Wasser ist als Wasserdampf entwichen und wird hier nicht zurückgewonnen.'
      ]
    },
    4: {
      goal: 'Trennziel: Wasser und Öl im Scheidetrichter getrennt auffangen.',
      problem: 'In Becherglas A sind Öl und Wasser. Schüttle beide im Scheidetrichter, beobachte, was dabei und danach passiert, und fange Wasser und Öl getrennt auf.',
      material: 'Becherglas A mit 50 mL Wasser und 50 mL Speiseöl, Scheidetrichter mit Stopfen und Hahn, Stativ mit Ring, Bechergläser B und C',
      cls: { q: 'Öl und Wasser direkt nach dem Schütteln:', hom: 'het', kind: 'emulsion' },
      prin: ['misch', 'dichte'],
      obsHint: 'Was siehst du beim Schütteln, beim Stehenlassen und beim Ablassen? (Tröpfchen, Trübung, Schichten, Grenzfläche …)',
      explHint: 'Warum liegt das Wasser unten? Warum entstehen nach dem Schütteln wieder zwei Schichten?',
      tips: [
        () => 'Welche Flüssigkeit liegt unten – und wo hat der Scheidetrichter seinen Auslauf?',
        (st, ev) => !ok(ev, 'shaken') ? 'Hänge den Scheidetrichter in den Ring, gieße das Gemisch hinein, setze den Stopfen auf und schüttle.'
          : (st.objs.S.emul > 0.15 ? 'Warte, bis sich wieder zwei klare Schichten gebildet haben, bevor du den Hahn öffnest.'
          : 'Nimm den Stopfen ab, stelle ein Becherglas unter den Hahn und lass die untere Schicht ab. Schließe den Hahn, wenn die Grenzfläche den Hahn erreicht – zuletzt auf „Tropfen“ stellen.'),
        () => 'Scheidetrichter → Ring. A → Scheidetrichter (gießen). „Stopfen auf“, „Schütteln“. Warten (Zeitraffer), bis die Tröpfchen verschwunden sind. „Stopfen ab“. B → Platz unter dem Hahn. Hahn „offen“, kurz vor der Grenzfläche „Tropfen“, dann „zu“. B zurück, C unter den Hahn, Hahn öffnen: Öl läuft in C.'
      ],
      solution: [
        'Scheidetrichter in den Ring hängen, Hahn zu, Gemisch hineingießen.',
        'Stopfen aufsetzen und schütteln: Öltröpfchen verteilen sich im Wasser – eine trübe Emulsion entsteht.',
        'Stehen lassen: Die Tröpfchen steigen auf und vereinigen sich wieder; es bilden sich zwei Schichten, Öl oben.',
        'Stopfen abnehmen, Becherglas B unter den Hahn, die untere Wasserschicht ablassen und an der Grenzfläche schließen.',
        'Vorlage wechseln (Becherglas C) und das Öl ablassen. Ergebnis: Wasser in B, Öl in C.'
      ]
    },
    5: {
      goal: 'Trennziel: Eisen, Sand und Kochsalz jeweils getrennt gewinnen.',
      problem: 'In der Porzellanschale ist ein Gemisch aus Eisenpulver, Sand und Kochsalz. Plane selbst, wie du die drei Stoffe nacheinander trennst, und gewinne jeden Stoff in einem eigenen Gefäß.',
      material: 'Porzellanschale mit 5 g Eisen, 10 g Sand, 5 g Kochsalz, Magnet in einer Kunststofftüte, Uhrglas, Spritzflasche, Becherglas A, Glasstab, Rundfilter, Trichter im Filtrierring mit Erlenmeyerkolben, Abdampfschale auf Heizplatte',
      cls: { q: 'Das Ausgangsgemisch aus Eisen, Sand und Kochsalz ist …', hom: 'het', kind: 'gemenge' },
      prin: ['magn', 'loes', 'korn', 'fluecht'],
      obsHint: 'Notiere deine Schritte und was du jeweils siehst (am Magneten, beim Lösen, im Filter, beim Eindampfen).',
      explHint: 'Welche Eigenschaft nutzt jeder Schritt? Warum ist die Reihenfolge sinnvoll?',
      tips: [
        () => 'Welcher der drei Stoffe lässt sich ohne Wasser abtrennen? Welcher löst sich in Wasser, welcher nicht?',
        (st, ev) => !ok(ev, 'iron') ? 'Fang mit dem Eisen an: Magnet antippen, dann die Porzellanschale – danach das Eisen auf dem Uhrglas abstreifen. Wiederhole das, bis kaum noch Eisen übrig ist.'
          : !ok(ev, 'sand') && st.objs.F.c.saltS > 0.05 ? 'Im Filter liegen noch ungelöste Salzkristalle. Spüle den Rückstand mit Wasser aus der Spritzflasche, damit sich das Salz löst.'
          : !ok(ev, 'sand') && st.objs.F.c.saltD > 0.6 ? 'Im feuchten Sand hängt noch Salzlösung. Spüle den Rückstand im Filter mit etwas Wasser nach.'
          : 'Löse das Salz mit Wasser heraus (rühren!), filtriere den Sand ab und dampfe das klare Filtrat ein.',
        () => 'Magnet → Schale, Magnet → Uhrglas (zweimal). Schale → Becherglas A (ausschütten). Spritzflasche (20 mL) → A, nochmals 20 mL; Glasstab → A. Filterpapier → Trichter. A → Trichter. Rückstand mit 5 mL nachspülen. Erlenmeyerkolben → Abdampfschale, Heizplatte „hoch“, kurz vor dem Trocknen „aus“.'
      ],
      solution: [
        'Magnettrennung: Mit dem Magneten (in der Tüte) das Eisen herausziehen und auf dem Uhrglas abstreifen – zwei- bis dreimal.',
        'Extraktion: Das Sand-Salz-Gemenge in ein Becherglas geben, Wasser zugeben und umrühren, bis sich das Salz gelöst hat. Der Sand löst sich nicht.',
        'Filtration: Die Suspension filtrieren. Sand bleibt als Rückstand im Filter; den Rückstand mit wenig Wasser nachspülen, damit keine Salzlösung darin hängen bleibt.',
        'Eindampfen: Das klare Filtrat (Kochsalzlösung) in der Abdampfschale eindampfen. Zurück bleibt festes Kochsalz.',
        'Andere Reihenfolge möglich: zuerst lösen und filtrieren, dann das Eisen mit dem Magneten aus dem Rückstand im Filter ziehen.'
      ]
    }
  };
  const ok = (ev, id) => !!(ev && ev.criteria.find((c) => c.id === id && c.ok));

  /** Prüft die Einordnung: { hom, kind } → je Feld richtig/falsch mit Rückmeldung. */
  function checkCls(n, ans) {
    const k = EXP[n].cls;
    const a = ans || {};
    const homOk = a.hom === k.hom;
    const kindOk = a.kind === k.kind;
    const fbHom = !a.hom ? 'Noch nicht gewählt.' : homOk ? 'Richtig.' : (k.hom === 'hom' ? 'Prüfe: Kannst du mit bloßem Auge (oder unter einer Lupe) verschiedene Bestandteile unterscheiden? Klar und einheitlich heißt homogen – auch wenn mehrere Stoffe enthalten sind.' : 'Prüfe: Man erkennt verschiedene Bestandteile (Körner, Trübung, Tröpfchen oder Schichten) – also ist das Gemisch heterogen.');
    const KH = { loesung: 'Eine Lösung ist klar und homogen – hier erkennt man aber Bestandteile.', suspension: 'Eine Suspension enthält ungelöste Feststoffteilchen in einer Flüssigkeit.', emulsion: 'In einer Emulsion sind Flüssigkeitströpfchen in einer anderen Flüssigkeit verteilt.', gemenge: 'Ein Gemenge besteht aus mehreren Feststoffen.', reinstoff: 'Ein Reinstoff besteht nur aus einem Stoff – hier sind aber mehrere Stoffe enthalten.' };
    const fbKind = !a.kind ? 'Noch nicht gewählt.' : kindOk ? 'Richtig.' : KH[a.kind] + ' Passt das zu deiner Beobachtung?';
    return { hom: { ok: homOk, fb: fbHom }, kind: { ok: kindOk, fb: fbKind }, all: homOk && kindOk };
  }
  /** Trennprinzip (alles Zutreffende): genau die richtige Menge. */
  function checkPrin(n, chosen) {
    const want = EXP[n].prin;
    const set = new Set(chosen || []);
    const missing = want.filter((x) => !set.has(x));
    const extra = [...set].filter((x) => !want.includes(x));
    const items = {};
    for (const p of PRINCIPLES) {
      const sel = set.has(p.id), should = want.includes(p.id);
      items[p.id] = sel === should ? (sel ? 'right' : null) : sel ? 'wrong' : 'missing';
    }
    let fb = '';
    if (!set.size) fb = 'Noch nichts angekreuzt.';
    else if (!missing.length && !extra.length) fb = 'Richtig. ' + want.map((x) => PRINCIPLE_WHY[x]).join(' ');
    else {
      const bits = [];
      if (extra.length) bits.push('Nicht zutreffend: ' + extra.map((x) => PRINCIPLE_WHY[x]).join(' '));
      if (missing.length) bits.push(`Es fehlt noch ${missing.length === 1 ? 'eine Eigenschaft' : missing.length + ' Eigenschaften'}, die bei diesem Versuch genutzt wird.`);
      fb = bits.join(' ');
    }
    return { ok: !missing.length && !extra.length && set.size > 0, items, fb };
  }

  // ------------------------------------------------------------------ Kontrolle: Multiple Choice
  const QUIZ_GROUPS = [
    { id: 'stoff', title: 'Gemische einordnen (Stoffebene)' },
    { id: 'teilchen', title: 'Teilchenebene' },
    { id: 'zustand', title: 'Aggregatzustände' },
    { id: 'prinzip', title: 'Kenneigenschaften und Trennprinzip' }
  ];
  const QUIZ = [
    { id: 'q1', group: 'stoff', multi: true, q: 'Welche Aussagen über die klare Kochsalzlösung aus Versuch 3 treffen zu?', opts: [
      { t: 'Sie ist ein Reinstoff, weil sie klar ist.', ok: false, why: 'Klar heißt nicht rein: Beim Eindampfen blieb Salz zurück – die Lösung enthielt also zwei Stoffe.' },
      { t: 'Sie ist ein homogenes Gemisch.', ok: true },
      { t: 'Beim Eindampfen blieb ein Feststoff zurück – also enthielt sie mehr als einen Stoff.', ok: true },
      { t: 'Eine klare Flüssigkeit ist immer ein Reinstoff.', ok: false, why: 'Auch Lösungen sind klar. Klarheit oder Farbe allein beweisen keine Reinheit.' }] },
    { id: 'q2', group: 'stoff', multi: true, q: 'Welche dieser Gemische sind heterogen?', opts: [
      { t: 'Sand und Wasser nach dem Aufrühren (Suspension)', ok: true },
      { t: 'Kochsalzlösung', ok: false, why: 'In der Kochsalzlösung erkennt man keine Bestandteile – sie ist homogen.' },
      { t: 'Öl und Wasser nach dem Schütteln (Emulsion)', ok: true },
      { t: 'Eisen, Sand und Kochsalz (Gemenge)', ok: true }] },
    { id: 'q3', group: 'teilchen', multi: false, q: 'Wie liegt gelöstes Kochsalz im Wasser vor?', opts: [
      { t: 'als winzige feste Salzkrümel, die man nur nicht sieht', ok: false, why: 'Gelöstes Salz ist nicht mehr fest: Die Kristalle sind in einzelne Teilchen zerfallen.' },
      { t: 'als einzelne Na⁺- und Cl⁻-Teilchen, die zwischen den Wasserteilchen verteilt sind', ok: true },
      { t: 'als geschmolzenes, flüssiges Salz', ok: false, why: 'Salz schmilzt erst bei etwa 800 °C. Beim Lösen schmilzt nichts.' },
      { t: 'gar nicht mehr – das Salz ist verschwunden', ok: false, why: 'Das Salz ist noch da: Beim Eindampfen kommt es als Feststoff zurück.' }] },
    { id: 'q4', group: 'teilchen', multi: true, q: 'Welche Aussagen über Sandkörner und Öltröpfchen stimmen?', opts: [
      { t: 'Ein einzelnes Sandkorn besteht aus sehr vielen Teilchen.', ok: true },
      { t: 'Ein Öltröpfchen ist ein einzelnes Ölteilchen.', ok: false, why: 'Ein Tröpfchen, das man sieht, enthält unvorstellbar viele Ölteilchen.' },
      { t: 'Ein Öltröpfchen ist eine Ansammlung vieler Ölteilchen.', ok: true },
      { t: 'Beim Filtrieren werden die Sandkörner in einzelne Teilchen zerlegt.', ok: false, why: 'Die Sandkörner bleiben unverändert im Filter liegen.' }] },
    { id: 'q5', group: 'zustand', multi: true, q: 'Was passiert beim Eindampfen der Kochsalzlösung?', opts: [
      { t: 'Wasser geht vom flüssigen in den gasförmigen Zustand über.', ok: true },
      { t: 'Das Salz wird gasförmig und entweicht mit dem Wasserdampf.', ok: false, why: 'Das Salz bleibt in der Schale zurück – es verdampft bei dieser Temperatur nicht.' },
      { t: 'Aus dem gelösten Salz bilden sich feste Kristalle.', ok: true },
      { t: 'Das Salz schmilzt zuerst und erstarrt dann.', ok: false, why: 'Die Lösung erreicht nur gut 100 °C; Kochsalz schmilzt erst bei etwa 800 °C.' }] },
    { id: 'q6', group: 'zustand', multi: false, q: 'Welche Aussage über „gelöst“ ist richtig?', opts: [
      { t: '„Gelöst“ ist ein vierter Aggregatzustand neben fest, flüssig und gasförmig.', ok: false, why: '„Gelöst“ beschreibt die Verteilung eines Stoffes in einem anderen, keinen Aggregatzustand.' },
      { t: 'Gelöstes Salz ist flüssiges Salz.', ok: false, why: 'Flüssig ist hier das Wasser. Das Salz ist in Teilchen zerteilt darin verteilt.' },
      { t: '„Gelöst“ heißt: Ein Stoff ist in einzelne Teilchen zerteilt in einem anderen verteilt. Das ist kein eigener Aggregatzustand.', ok: true }] },
    { id: 'q7', group: 'zustand', multi: false, q: 'Bei welchem Versuch findet tatsächlich ein Wechsel des Aggregatzustands statt?', opts: [
      { t: 'beim Filtrieren: Das gelöste Salz wird im Filter fest', ok: false, why: 'Gelöstes Salz geht durch das Filterpapier hindurch und bleibt gelöst.' },
      { t: 'beim Eindampfen: Wasser wird gasförmig, Salz kristallisiert aus', ok: true },
      { t: 'beim Scheiden: Öl wird beim Ablassen fest', ok: false, why: 'Öl und Wasser bleiben flüssig; sie werden nur getrennt aufgefangen.' },
      { t: 'beim Dekantieren: Der Sand wird beim Absetzen fest', ok: false, why: 'Der Sand war schon vorher fest – er sinkt nur nach unten.' }] },
    { id: 'q8', group: 'prinzip', multi: true, q: 'Was hält das Filterpapier zurück?', opts: [
      { t: 'ungelöste Sandkörner', ok: true },
      { t: 'gelöstes Kochsalz', ok: false, why: 'Gelöstes Salz liegt als winzige Teilchen vor und geht mit dem Wasser durch das Papier.' },
      { t: 'ungelöste Salzkristalle, wenn zu wenig Wasser zum Lösen da war', ok: true },
      { t: 'das Wasser', ok: false, why: 'Wasser läuft als Filtrat durch; nur ein kleiner Rest bleibt im feuchten Rückstand hängen.' }] },
    { id: 'q9', group: 'prinzip', multi: true, q: 'Warum lassen sich Öl und Wasser im Scheidetrichter trennen?', opts: [
      { t: 'Öl und Wasser sind nicht mischbar und bilden zwei Schichten.', ok: true },
      { t: 'Öl hat eine geringere Dichte als Wasser und schwimmt oben.', ok: true },
      { t: 'Allein mit der Dichte kann man beliebige Flüssigkeiten scheiden, auch mischbare.', ok: false, why: 'Mischbare Flüssigkeiten (z. B. Alkohol und Wasser) bilden keine Schichten – dafür braucht man ein anderes Verfahren (Destillation).' },
      { t: 'Die untere Schicht (Wasser) fließt durch den Hahn zuerst ab.', ok: true }] },
    { id: 'q10', group: 'prinzip', multi: true, q: 'Welche Aussagen zur Trennkette Eisen – Sand – Kochsalz stimmen?', opts: [
      { t: 'Der Magnet zieht nur das Eisen an.', ok: true },
      { t: 'Beim Extrahieren wird das Salz mit Wasser herausgelöst; das Abfiltrieren des Sandes ist ein eigener Schritt.', ok: true },
      { t: 'Trockenes Filtrieren trennt Sand und Kochsalz.', ok: false, why: 'Ohne Wasser ist das Salz nicht gelöst; die Kristalle bleiben mit dem Sand im Filter liegen.' },
      { t: 'Beim Trennen entstehen durch eine chemische Reaktion neue Stoffe.', ok: false, why: 'Eine Stofftrennung trennt nur vorhandene Bestandteile. Es entstehen keine neuen Stoffe.' },
      { t: 'Die Korngröße ist ein Trennkriterium beim Filtrieren, aber keine Kenneigenschaft wie die Dichte.', ok: true }] }
  ];

  function checkQuizItem(q, chosen) {
    const set = new Set(chosen || []);
    const res = q.opts.map((o, i) => ({ sel: set.has(i), ok: o.ok, why: o.why || '' }));
    const right = res.every((r) => r.sel === r.ok);
    let fb;
    if (!set.size) fb = 'Noch keine Antwort gewählt.';
    else if (right) fb = 'Richtig.';
    else {
      const wrongSel = res.filter((r) => r.sel && !r.ok).map((r) => r.why).filter(Boolean);
      const missing = res.filter((r) => !r.sel && r.ok).length;
      fb = wrongSel.join(' ') + (missing ? (wrongSel.length ? ' ' : '') + (q.multi ? `Es ${missing === 1 ? 'fehlt noch eine zutreffende Aussage' : 'fehlen noch ' + missing + ' zutreffende Aussagen'}.` : 'Wähle die zutreffende Aussage.') : '');
    }
    return { ok: right && set.size > 0, res, fb: fb.trim() };
  }

  // ------------------------------------------------------------------ Kontrolle: Lückentext
  const CLOZE = [
    { t: 'Sand und Wasser bilden nach dem Aufrühren eine ' },
    { gap: 'g1', accept: ['Suspension', 'Aufschlämmung'], forbid: [{ term: 'Emulsion', hint: 'Eine Emulsion besteht aus zwei Flüssigkeiten. Sand ist ein Feststoff.' }, { term: 'Lösung', hint: 'Sand löst sich nicht – das Gemisch ist trüb.' }], hint: 'Ungelöster Feststoff in einer Flüssigkeit.' },
    { t: '. Lässt man sie stehen, setzt sich der Sand ab. Dieses Absetzen heißt ' },
    { gap: 'g2', accept: ['Sedimentieren', 'Sedimentation', 'Absetzen', 'Absetzen lassen'], hint: 'Fachbegriff für das Absetzen am Boden.' },
    { t: '; das vorsichtige Abgießen der Flüssigkeit heißt ' },
    { gap: 'g3', accept: ['Dekantieren', 'Dekantation', 'Abgießen'], hint: 'Fachbegriff für das Abgießen über dem Bodensatz.' },
    { t: '. Beim Filtrieren bleibt der Sand als ' },
    { gap: 'g4', accept: ['Rückstand', 'Filterrückstand'], forbid: [{ term: 'Filtrat', hint: 'Das Filtrat ist die Flüssigkeit, die durch das Papier läuft.' }], hint: 'Was im Filterpapier liegen bleibt.' },
    { t: ' im Filterpapier; die klare Flüssigkeit darunter heißt ' },
    { gap: 'g5', accept: ['Filtrat'], forbid: [{ term: 'Rückstand', hint: 'Der Rückstand bleibt im Papier. Gesucht ist die durchgelaufene Flüssigkeit.' }, { term: 'Dekantat', hint: 'Dekantat heißt die abgegossene Flüssigkeit beim Dekantieren.' }], hint: 'Die durchgelaufene Flüssigkeit.' },
    { t: '. Kochsalz und Wasser ergeben eine klare ' },
    { gap: 'g6', accept: ['Lösung', 'Salzlösung', 'Kochsalzlösung'], forbid: [{ term: 'Suspension', hint: 'Eine Suspension ist trüb. Gelöstes Salz sieht man nicht.' }, { term: 'Emulsion', hint: 'Eine Emulsion besteht aus zwei Flüssigkeiten.' }], hint: 'Homogenes Gemisch, klar.' },
    { t: '. Beim ' },
    { gap: 'g7', accept: ['Eindampfen', 'Abdampfen'], forbid: [{ term: 'Verdampfen', hint: 'Das Wasser verdampft – gesucht ist aber der Name des Trennverfahrens.' }, { term: 'Destillieren', hint: 'Beim Destillieren wird der Dampf aufgefangen. Hier entweicht das Wasser.' }], hint: 'Name des Verfahrens, bei dem das Wasser verdampft und das Salz zurückbleibt.' },
    { t: ' verdampft das Wasser, und Salzkristalle bleiben zurück. Öl und Wasser bilden nach dem Schütteln eine ' },
    { gap: 'g8', accept: ['Emulsion'], forbid: [{ term: 'Suspension', hint: 'Eine Suspension enthält einen Feststoff. Öl ist flüssig.' }, { term: 'Lösung', hint: 'Öl löst sich nicht in Wasser – man sieht Tröpfchen.' }], hint: 'Flüssigkeitströpfchen in einer anderen Flüssigkeit.' },
    { t: '. Eisen, Sand und Kochsalz bilden zusammen ein ' },
    { gap: 'g9', accept: ['Gemenge', 'Feststoffgemenge'], forbid: [{ term: 'Gemisch', hint: 'Richtig, aber zu allgemein: Gesucht ist der Name für ein Gemisch aus Feststoffen.' }], hint: 'Gemisch aus Feststoffen.' },
    { t: '; das Herauslösen des Salzes mit Wasser heißt ' },
    { gap: 'g10', accept: ['Extraktion', 'Extrahieren'], forbid: [{ term: 'Filtration', hint: 'Das Filtrieren ist der nächste, eigene Schritt.' }, { term: 'Lösen', hint: 'Fast – gesucht ist der Fachbegriff für das Herauslösen eines Stoffes.' }], hint: 'Fachbegriff für das Herauslösen.' },
    { t: '.' }
  ];
  const GAPS = CLOZE.filter((x) => x.gap);
  const WORDBANK = ['Suspension', 'Sedimentieren', 'Dekantieren', 'Rückstand', 'Filtrat', 'Lösung', 'Eindampfen', 'Emulsion', 'Gemenge', 'Extraktion'].sort((a, b) => a.localeCompare(b, 'de'));

  function checkGaps(answers) {
    const out = {};
    let all = true;
    for (const g of GAPS) {
      const r = core.checkGap(g, (answers || {})[g.gap]);
      out[g.gap] = Object.assign({ ok: core.gapOk(r) }, r);
      if (!core.gapOk(r)) all = false;
    }
    return { all, items: out };
  }

  const QUIZ_TIPS = [
    'Denk an deine eigenen Beobachtungen: Was war klar, was trüb, was in Schichten? Was blieb im Filter, was lief durch?',
    'Achte bei jeder Aussage auf Kleinigkeiten wie „immer“, „allein“ oder „neue Stoffe“. Trennen heißt: Vorhandene Bestandteile werden nur getrennt.',
    'Unterscheide genau: „gelöst“ (Teilchen verteilt, klar) – „ungelöst“ (Körner, trüb) – „geschmolzen“ (erst bei hoher Temperatur). Wasser verdampft beim Eindampfen, Salz nicht.'
  ];
  const GAP_TIPS = [
    'Öffne die Begriffshilfe – alle gesuchten Wörter stehen dort.',
    'Achte darauf, ob ein Verfahren (z. B. …ieren) oder ein Ergebnis (z. B. Rückstand, Filtrat) gesucht ist.',
    'Reihenfolge der Lücken: Suspension, Sedimentieren, Dekantieren, Rückstand, Filtrat, Lösung, Eindampfen, Emulsion, Gemenge, Extraktion.'
  ];

  // ------------------------------------------------------------------ Hefteintrag
  const NOTEBOOK = {
    title: 'Stoffgemische trennen',
    intro: [
      'Ein **Reinstoff** besteht aus nur einem Stoff. Ein **Stoffgemisch** enthält mehrere Stoffe.',
      '**Homogen**: Man kann die Bestandteile nicht unterscheiden (einheitlich, klar). **Heterogen**: Man erkennt verschiedene Bestandteile (Körner, Trübung, Tröpfchen, Schichten).',
      'Klar bedeutet nicht rein: Auch eine Lösung ist klar.'
    ],
    kinds: [
      ['Lösung', 'homogen', 'Feststoff in Flüssigkeit gelöst', 'Kochsalzlösung'],
      ['Suspension', 'heterogen', 'ungelöster Feststoff in Flüssigkeit', 'Sand und Wasser, aufgerührt'],
      ['Emulsion', 'heterogen', 'Flüssigkeitströpfchen in einer anderen Flüssigkeit', 'Öl und Wasser, geschüttelt'],
      ['Gemenge', 'heterogen', 'mehrere Feststoffe', 'Eisen, Sand und Kochsalz']
    ],
    cards: [
      { n: 1, title: 'Sedimentieren und Dekantieren', mix: 'Sand und Wasser – aufgerührt eine **Suspension** (heterogen)',
        stoff: 'Das trübe Gemisch wird in Ruhe klar; der Sand sammelt sich als Bodensatz. Gießt man zu früh oder zu schnell, ist das abgegossene Wasser trüb.',
        teilchen: 'Sandkörner (jedes aus sehr vielen Teilchen) sinken zwischen den Wasserteilchen nach unten.',
        zustand: 'Sand fest, Wasser flüssig – kein Wechsel des Aggregatzustands.',
        prinzip: 'Sand ist unlöslich und hat eine größere **Dichte** als Wasser.',
        result: 'Fast klares Wasser (Dekantat); nasser Sand bleibt zurück. Die Trennung ist nicht vollständig.' },
      { n: 2, title: 'Filtrieren', mix: 'Sand und Wasser – **Suspension** (heterogen)',
        stoff: 'Im Filterpapier bleibt Sand liegen, darunter tropft klare Flüssigkeit.',
        teilchen: 'Wasserteilchen passen durch die Poren des Papiers, die viel größeren Sandkörner nicht.',
        zustand: 'Sand fest, Wasser flüssig – kein Wechsel des Aggregatzustands.',
        prinzip: '**Korngröße** im Vergleich zu den Filterporen (Trennkriterium); Sand ist unlöslich.',
        result: 'Sand als **Rückstand**, klares Wasser als **Filtrat**. Gründlicher als Dekantieren.' },
      { n: 3, title: 'Eindampfen', mix: 'Kochsalz in Wasser – **Lösung** (homogen, klar)',
        stoff: 'Die Lösung siedet, der Flüssigkeitsstand sinkt, am Rand und am Boden bilden sich weiße Kristalle.',
        teilchen: 'Wasserteilchen verlassen die Flüssigkeit. Die Na⁺- und Cl⁻-Teilchen bleiben zurück und ordnen sich zu Kristallen.',
        zustand: 'Wasser: flüssig → gasförmig. Salz: gelöst → fest (Kristalle). Das Salz schmilzt nicht und verdampft nicht.',
        prinzip: 'Unterschiedliche **Flüchtigkeit**: Wasser verdampft, Salz nicht.',
        result: 'Festes Kochsalz; das Wasser entweicht als Wasserdampf und wird nicht aufgefangen.' },
      { n: 4, title: 'Scheiden im Scheidetrichter', mix: 'Öl und Wasser – zwei Schichten (heterogen); geschüttelt eine **Emulsion**',
        stoff: 'Beim Schütteln wird das Gemisch trüb, in Ruhe bilden sich wieder zwei Schichten: Öl oben, Wasser unten.',
        teilchen: 'Öltröpfchen sind Ansammlungen vieler Ölteilchen; sie vereinigen sich wieder, Öl- und Wasserteilchen mischen sich nicht.',
        zustand: 'Öl und Wasser flüssig – kein Wechsel des Aggregatzustands.',
        prinzip: 'Öl und Wasser sind **nicht mischbar**; Öl hat die geringere **Dichte**.',
        result: 'Wasser wird unten zuerst abgelassen, danach das Öl in ein anderes Gefäß.' },
      { n: 5, title: 'Trennkette Eisen – Sand – Kochsalz', mix: 'Eisen, Sand und Kochsalz – **Gemenge** (heterogen)',
        stoff: 'Am Magneten hängt nur Eisen. Mit Wasser verschwindet das Salz (es löst sich), der Sand bleibt im Filter, aus dem Filtrat entstehen beim Eindampfen Kristalle.',
        teilchen: 'Eisenkörner werden angezogen; Salzkristalle zerfallen in Na⁺- und Cl⁻-Teilchen; Sandkörner bleiben unverändert.',
        zustand: 'Alle drei Stoffe sind am Anfang und am Ende fest. Nur beim Eindampfen wechselt Wasser von flüssig zu gasförmig.',
        prinzip: '**Magnetismus**, **Löslichkeit**, Korngröße (Filter), **Flüchtigkeit**.',
        result: 'Drei getrennte Feststoffe: Eisen, Sand und Kochsalz.' }
    ],
    chain: [
      ['Magnettrennung', 'Eisen wird vom Magneten angezogen.', 'Eisen'],
      ['Extraktion (Lösen)', 'Wasser zugeben und rühren: Kochsalz löst sich, Sand nicht.', 'Suspension aus Sand und Kochsalzlösung'],
      ['Filtration', 'Sand bleibt als Rückstand im Filter (mit wenig Wasser nachspülen).', 'Sand'],
      ['Eindampfen', 'Aus dem Filtrat verdampft das Wasser, Salz kristallisiert.', 'Kochsalz']
    ],
    merke: [
      'Bei einer **Stofftrennung** werden vorhandene Bestandteile aufgrund unterschiedlicher Eigenschaften getrennt. Es entstehen **keine neuen Stoffe** – es findet keine chemische Reaktion statt.',
      '**„Gelöst“ ist kein Aggregatzustand.** Gelöstes Salz ist weder flüssig noch geschmolzen: Es ist in einzelne Teilchen zerteilt im Wasser verteilt.',
      'Farbe oder Klarheit allein beweisen keine Reinheit.'
    ]
  };

  return {
    KINDS, PRINCIPLES, PRINCIPLE_WHY, EXP, checkCls, checkPrin,
    QUIZ_GROUPS, QUIZ, checkQuizItem, CLOZE, GAPS, WORDBANK, checkGaps, QUIZ_TIPS, GAP_TIPS, NOTEBOOK
  };
});
