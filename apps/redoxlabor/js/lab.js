/*
 * Redoxlabor – Experimentsteuerung
 *
 * Zentrale Zustandsmaschine des virtuellen Labors (ohne DOM). Sie verwaltet
 * Reagenzgläser, Geräte, laufende Handlungen (z. B. Pipettieren, Umsetzen) und
 * leitet daraus Versuchsphasen, kontextabhängige Hilfen und Protokolle ab.
 * Die Darstellung liest ausschließlich diesen Zustand.
 */
(function (root, factory) {
  const chem = typeof module === 'object' && module.exports ? require('./chemistry.js') : root.RL.chem;
  const api = factory(chem);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.RL = root.RL || {}).lab = api;
})(typeof self !== 'undefined' ? self : this, function (chem) {
  'use strict';

  const TUBE_COUNT = 4;
  const BATH_SLOTS = 2;
  const HOTPLATE_SETTINGS = [0, 60, 80];
  const ROOM = 20;
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Dauer der sichtbaren Handlungen in Sekunden
  const DUR = {
    add: 1.9, addDropwise: 2.7, applyAdd: 0.98, applyDropwise: 1.55,
    move: 1.35, shake: 1.1, bump: 1.8
  };
  const BUMP_AFTER = 2.6; // s in der Flamme bis zum Siedeverzug
  const BATH_COOLING = 25; // s, Zeitkonstante beim Abkühlen des Wasserbads

  const PHASES = [
    { id: 'notPrepared', label: 'Versuch nicht vorbereitet' },
    { id: 'provided', label: 'Reagenzglas bereitgestellt' },
    { id: 'partial', label: 'Reagenzien teilweise zugegeben' },
    { id: 'reagentReady', label: 'Reagenz vollständig vorbereitet' },
    { id: 'sampleAdded', label: 'Stoffprobe hinzugegeben' },
    { id: 'conditions', label: 'Reaktionsbedingungen eingestellt' },
    { id: 'running', label: 'Ansatz wird erwärmt – beobachten' },
    { id: 'observable', label: 'Beobachtung möglich' },
    { id: 'finished', label: 'Versuch beendet – Beobachtung protokolliert' },
    { id: 'evaluated', label: 'Auswertung abgeschlossen' }
  ];
  const PHASE_INDEX = Object.fromEntries(PHASES.map((p, i) => [p.id, i]));

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function createLab(options) {
    const opts = Object.assign({ mode: 'learn', random: Math.random }, options || {});
    const listeners = {};
    const emit = (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data));

    const state = {
      mode: opts.mode,
      samples: [], // [{key, label, sampleId}]
      tubes: [],
      activeTubeId: 1,
      armed: null, // {id} vorausgewählter Stoff
      bath: { setting: 0, temp: ROOM },
      burner: { on: false },
      op: null,
      time: 0,
      protocol: [],
      analysisAnswers: {},
      analysisChecked: false,
      analysisRevealed: false,
      runId: 1
    };

    function newTube(id) {
      return {
        id, generation: (state.tubes[id - 1] ? state.tubes[id - 1].generation + 1 : 1),
        place: 'rack', slot: id - 1, contents: chem.createContents(),
        flameTime: 0, recordedId: null, recordKey: null, evaluated: false, staleNotified: false
      };
    }

    /**
     * Kennung des beobachtbaren Zustands: Zusammensetzung und Befund. Ändert sie
     * sich nach dem Protokollieren (z. B. „noch nicht abgeschlossen“ → „positiv“),
     * gilt das Protokoll als Zwischenstand und der Versuch kann erneut
     * beobachtet und ausgewertet werden.
     */
    function observationKey(c) {
      return c.history.length + '|' + chem.classify(c).outcome;
    }
    /** Beschreibt das letzte Protokoll noch den aktuellen Zustand des Reagenzglases? */
    function recordCurrent(t) {
      return !!t.recordedId && t.recordKey === observationKey(t.contents);
    }

    /** Lernmodus: Aldehyde, Ketone und Zucker (beschriftet). Analysemodus: nur Aldehyde/Ketone als A–F. */
    const sampleIdsFor = (mode) => (mode === 'analysis' ? chem.BASIC_SAMPLE_IDS : chem.SAMPLES.map((s) => s.id));

    function setupSamples() {
      const ids = sampleIdsFor(state.mode);
      if (state.mode === 'analysis') {
        const mixed = shuffle(ids, opts.random);
        state.samples = mixed.map((sid, i) => ({ key: LETTERS[i], label: 'Probe ' + LETTERS[i], sampleId: sid }));
      } else {
        state.samples = ids.map((sid) => ({ key: sid, label: chem.SAMPLE_BY_ID[sid].name, sampleId: sid }));
      }
    }

    function resetBench() {
      state.tubes = [];
      for (let i = 1; i <= TUBE_COUNT; i++) state.tubes.push(newTube(i));
      state.activeTubeId = null;
      state.armed = null;
      state.bath = { setting: 0, temp: ROOM };
      state.burner = { on: false };
      state.op = null;
      state.runId += 1;
      emit('change', { reason: 'reset' });
    }

    function fullRestart(mode) {
      if (mode) state.mode = mode;
      state.protocol = [];
      state.analysisAnswers = {};
      state.analysisChecked = false;
      state.analysisRevealed = false;
      setupSamples();
      resetBench();
      emit('restart', { mode: state.mode });
    }

    // ------------------------------------------------------------------ Hilfen
    const tubeById = (id) => state.tubes.find((t) => t.id === id);
    const activeTube = () => tubeById(state.activeTubeId);
    const sampleEntry = (sampleId) => state.samples.find((s) => s.sampleId === sampleId);
    const substanceLabel = (id) => {
      if (chem.REAGENT_BY_ID[id]) return chem.REAGENT_BY_ID[id].name;
      const e = sampleEntry(id);
      return e ? e.label : id;
    };
    const message = (text, kind) => emit('message', { text, kind: kind || 'info' });
    const fail = (text) => { message(text, 'warn'); return { ok: false, message: text }; };
    const busy = () => !!state.op;

    function freeBathSlot() {
      for (let s = 0; s < BATH_SLOTS; s++) {
        if (!state.tubes.some((t) => t.place === 'bath' && t.slot === s)) return s;
      }
      return -1;
    }
    const flameOccupied = () => state.tubes.some((t) => t.place === 'flame');

    // ---------------------------------------------------------------- Aktionen
    function selectTube(id) {
      const t = tubeById(id);
      if (!t) return { ok: false };
      state.activeTubeId = id;
      emit('change', { reason: 'select' });
      if (state.armed && !busy()) {
        const armed = state.armed.id;
        state.armed = null;
        return addSubstance(id, armed);
      }
      return { ok: true };
    }

    /** Stoff antippen: mit aktivem Reagenzglas zugeben, sonst vormerken. */
    function chooseSubstance(id, targetTubeId) {
      const target = targetTubeId != null ? targetTubeId : state.activeTubeId;
      if (target == null) {
        state.armed = { id };
        emit('change', { reason: 'arm' });
        message(`${substanceLabel(id)} ausgewählt – tippe auf ein Reagenzglas.`);
        return { ok: true, armed: true };
      }
      return addSubstance(target, id);
    }

    function addSubstance(tubeId, id) {
      if (busy()) return fail('Warte, bis die aktuelle Handlung abgeschlossen ist.');
      const t = tubeById(tubeId);
      if (!t) return fail('Kein Reagenzglas ausgewählt.');
      if (t.place === 'flame') return fail('Nimm das Reagenzglas zuerst aus der Flamme, bevor du etwas zugibst.');
      const check = chem.canAdd(t.contents, id);
      if (!check.ok) return fail(check.reason);
      state.activeTubeId = tubeId;
      state.armed = null;
      const dropwise = id === 'nh3';
      const solid = chem.isSolid(id);
      state.op = {
        type: 'add', tubeId, substance: id, t: 0, dropwise, solid,
        dur: dropwise ? DUR.addDropwise : DUR.add,
        applyAt: dropwise ? DUR.applyDropwise : DUR.applyAdd, applied: false
      };
      message(dropwise
        ? `${substanceLabel(id)} wird tropfenweise in Reagenzglas ${tubeId} gegeben …`
        : solid ? `Eine Spatelspitze ${substanceLabel(id)} wird in Reagenzglas ${tubeId} gegeben …`
          : `${substanceLabel(id)} wird in Reagenzglas ${tubeId} pipettiert …`);
      emit('change', { reason: 'op' });
      return { ok: true };
    }

    function shake(tubeId) {
      if (busy()) return fail('Warte, bis die aktuelle Handlung abgeschlossen ist.');
      const t = tubeById(tubeId != null ? tubeId : state.activeTubeId);
      if (!t) return fail('Kein Reagenzglas ausgewählt.');
      if (chem.volume(t.contents) === 0) return fail('Das Reagenzglas ist leer – da gibt es nichts zu durchmischen.');
      if (t.place === 'flame') return fail('In der Flamme nicht schütteln – nimm das Reagenzglas zuerst heraus.');
      state.op = { type: 'shake', tubeId: t.id, t: 0, dur: DUR.shake, mixStart: t.contents.mix };
      emit('change', { reason: 'op' });
      return { ok: true };
    }

    /** place: 'rack' | 'bath' | 'flame' */
    function moveTube(tubeId, place) {
      if (busy()) return fail('Warte, bis die aktuelle Handlung abgeschlossen ist.');
      const t = tubeById(tubeId != null ? tubeId : state.activeTubeId);
      if (!t) return fail('Kein Reagenzglas ausgewählt.');
      if (t.place === place) return { ok: true, noop: true };
      let slot = 0;
      if (place === 'rack') slot = t.id - 1;
      else if (place === 'bath') {
        slot = freeBathSlot();
        if (slot < 0) return fail('Im Wasserbad ist kein Platz mehr frei.');
      } else if (place === 'flame') {
        if (!state.burner.on) return fail('Der Brenner ist nicht entzündet.');
        if (flameOccupied()) return fail('Es wird bereits ein Reagenzglas in der Flamme gehalten.');
      } else return fail('Unbekanntes Ziel.');
      state.activeTubeId = t.id;
      state.op = { type: 'move', tubeId: t.id, t: 0, dur: DUR.move, from: { place: t.place, slot: t.slot }, to: { place, slot } };
      t.place = 'moving';
      const names = { rack: 'in den Reagenzglasständer', bath: 'ins Wasserbad', flame: 'in die Brennerflamme' };
      message(`Reagenzglas ${t.id} wird mit dem Reagenzglashalter ${names[place]} gebracht.`);
      emit('change', { reason: 'op' });
      return { ok: true };
    }

    function replaceTube(tubeId) {
      if (busy()) return fail('Warte, bis die aktuelle Handlung abgeschlossen ist.');
      const t = tubeById(tubeId != null ? tubeId : state.activeTubeId);
      if (!t) return { ok: false };
      const fresh = newTube(t.id);
      fresh.generation = t.generation + 1;
      const wasTollens = t.contents.portions.agno3 > 0;
      state.tubes[t.id - 1] = fresh;
      state.activeTubeId = t.id;
      message(wasTollens
        ? `Reagenzglas ${t.id} wurde ersetzt. Silberhaltige Reste nicht aufbewahren – im Unterricht nach Anweisung der Lehrkraft entsorgen.`
        : `Reagenzglas ${t.id} wurde durch ein sauberes Reagenzglas ersetzt.`);
      emit('change', { reason: 'replace' });
      return { ok: true };
    }

    function setHotplate(setting) {
      if (!HOTPLATE_SETTINGS.includes(setting)) return { ok: false };
      state.bath.setting = setting;
      message(setting ? `Heizplatte eingeschaltet: Wasserbad wird auf ${setting} °C erwärmt.` : 'Heizplatte ausgeschaltet.');
      emit('change', { reason: 'hotplate' });
      return { ok: true };
    }
    function cycleHotplate() {
      const i = HOTPLATE_SETTINGS.indexOf(state.bath.setting);
      return setHotplate(HOTPLATE_SETTINGS[(i + 1) % HOTPLATE_SETTINGS.length]);
    }

    function toggleBurner(on) {
      const next = on == null ? !state.burner.on : !!on;
      if (!next && flameOccupied()) {
        // Flamme aus, Reagenzglas bleibt über dem Brenner – ungefährlich.
      }
      state.burner.on = next;
      message(next ? 'Gasbrenner entzündet (rauschende, blaue Flamme).' : 'Gasbrenner ausgeschaltet.');
      emit('change', { reason: 'burner' });
      return { ok: true };
    }

    // ------------------------------------------------------------- Simulation
    function envFor(t) {
      if (t.place === 'bath') return { temp: state.bath.temp, tau: 2.2 };
      if (t.place === 'flame') return state.burner.on ? { temp: 160, tau: 2.4 } : { temp: ROOM, tau: 8 };
      return { temp: ROOM, tau: 9 };
    }

    function finishOp(op) {
      const t = tubeById(op.tubeId);
      if (op.type === 'add' && !op.applied) applyAdd(op);
      if (op.type === 'move' && t) {
        t.place = op.to.place; t.slot = op.to.slot; t.flameTime = 0;
        if (op.to.place === 'bath' && state.bath.setting === 0) {
          message('Hinweis: Die Heizplatte ist ausgeschaltet – das Wasserbad ist kalt.', 'info');
        }
      }
      if (op.type === 'shake' && t) { t.contents.mix = 1; chem.dissolve(t.contents, 0.6); }
      state.op = null;
      emit('change', { reason: 'opDone', op });
    }

    function applyAdd(op) {
      const t = tubeById(op.tubeId);
      op.applied = true;
      if (!t) return;
      const before = chem.analyze(t.contents);
      const res = chem.add(t.contents, op.substance);
      if (!res.ok) { message(res.reason, 'warn'); return; }
      t.staleNotified = true; // nach einer Zugabe ist der Hinweis über die Phase sichtbar
      const after = chem.analyze(t.contents);
      emit('added', { tubeId: t.id, substance: op.substance, before, after });
      describeChange(t, op.substance, before, after);
    }

    /** Kurze sachliche Rückmeldung zum sichtbaren Ergebnis einer Zugabe. */
    function describeChange(t, id, before, after) {
      if (after.system === 'foreign' && before.system !== 'foreign') { message(after.reason, 'warn'); return; }
      if (chem.isSolid(id)) {
        message(chem.volume(t.contents) > 0
          ? 'Weiße Kristalle sinken zu Boden. Sie lösen sich langsam – schneller beim Schütteln oder im warmen Wasserbad.'
          : 'Die Kristalle liegen trocken im Reagenzglas. Gib das Nachweisreagenz dazu.', 'info');
        return;
      }
      if (after.system === 'fehling') {
        if (after.status === 'cuoh2' && before.status !== 'cuoh2') message('Ein hellblauer Niederschlag fällt aus.', 'info');
        else if (after.valid && !before.valid) message('Fehling I und II treffen aufeinander – es bildet sich eine tiefblaue Lösung. Durch Schütteln gut durchmischen.', 'info');
      }
      if (after.system === 'tollens') {
        if (after.status === 'precipitate' && before.status !== 'precipitate') message('Ein brauner Niederschlag bildet sich.', 'info');
        else if (after.status === 'precipitate' && id === 'nh3') message('Der braune Niederschlag löst sich teilweise auf.', 'info');
        else if (after.valid && before.status === 'precipitate') message('Der Niederschlag hat sich gelöst – die Lösung ist klar. Tollens-Reagenz immer frisch ansetzen und nicht aufbewahren.', 'info');
      }
    }

    function update(dt) {
      if (dt <= 0) return;
      state.time += dt;
      // Wasserbad
      // Heizen mit fester Leistung; Abkühlen nach dem Newtonschen Abkühlungsgesetz
      // (im selben Zeitraffer: von 80 °C in rund 30 s auf etwa 40 °C).
      const b = state.bath;
      const target = b.setting > 0 ? b.setting : ROOM;
      const diff = target - b.temp;
      if (diff > 0) b.temp += Math.min(diff, (diff > 8 ? 5.5 : 0.8 + diff * 0.6) * dt);
      else b.temp += Math.max(diff, -(b.temp - ROOM) * dt / BATH_COOLING);
      // Laufende Handlung
      const op = state.op;
      if (op) {
        op.t += dt;
        if (op.type === 'add' && !op.applied && op.t >= op.applyAt) applyAdd(op);
        if (op.type === 'shake') {
          const t = tubeById(op.tubeId);
          if (t) t.contents.mix = Math.max(t.contents.mix, op.mixStart + (1 - op.mixStart) * Math.min(1, op.t / op.dur));
        }
        if (op.t >= op.dur) finishOp(op);
      }
      // Reagenzgläser
      for (const t of state.tubes) {
        const env = envFor(t);
        const wasObservable = chem.isObservable(t.contents);
        chem.step(t.contents, dt, env.temp, env.tau);
        if (t.place === 'flame' && state.burner.on && chem.volume(t.contents) > 0 && !t.contents.bumped) {
          t.flameTime += dt;
          if (t.flameTime >= BUMP_AFTER && !state.op) triggerBump(t);
        }
        if (!wasObservable && chem.isObservable(t.contents) && !t.contents.bumped) {
          emit('observable', { tubeId: t.id });
          message(`Reagenzglas ${t.id}: Der Versuch kann jetzt beobachtet und protokolliert werden.`, 'success');
        }
        // Der Versuch lief nach dem Protokollieren weiter und zeigt jetzt einen anderen Befund.
        if (t.recordedId && !t.staleNotified && !recordCurrent(t)) {
          t.staleNotified = true;
          emit('change', { reason: 'stale' });
          message(`Reagenzglas ${t.id}: Der Versuch hat sich seit deinem Protokoll verändert. Dein Eintrag bleibt als Zwischenstand erhalten – beobachte erneut und werte erneut aus.`, 'info');
        }
      }
    }

    function triggerBump(t) {
      // Ohne Flüssigkeit kein Siedeverzug (leeres Glas oder nur trockener Feststoff)
      if (chem.volume(t.contents) === 0 || t.place !== 'flame') return;
      t.contents.bumped = true;
      t.contents.lost = 0.45;
      state.op = { type: 'bump', tubeId: t.id, t: 0, dur: DUR.bump };
      emit('change', { reason: 'bump' });
      emit('safety', {
        tubeId: t.id,
        system: chem.analyze(t.contents).system
      });
    }

    // ------------------------------------------------------------ Phasen/Hilfe
    function phaseOf(tubeId) {
      const t = tubeById(tubeId != null ? tubeId : state.activeTubeId);
      if (!t) return PHASES[0];
      const c = t.contents;
      const a = chem.analyze(c);
      const current = recordCurrent(t);
      let id;
      if (current && t.evaluated) id = 'evaluated';
      else if (current) id = 'finished';
      else if (a.system === 'empty') id = state.activeTubeId === t.id ? 'provided' : 'notPrepared';
      else if (chem.isObservable(c)) id = 'observable';
      else if (!c.sampleId) id = chem.reagentReady(c) ? 'reagentReady' : 'partial';
      else if (!a.valid) id = 'partial';
      else if (c.exposure > 0.02 || c.progress > 0.02) id = 'running';
      else if ((t.place === 'bath' && state.bath.setting > 0) || (t.place === 'flame' && state.burner.on)) id = 'conditions';
      else id = 'sampleAdded';
      const ph = PHASES[PHASE_INDEX[id]];
      let label = c.bumped && id === 'observable' ? 'Versuch abgebrochen (Siedeverzug)' : ph.label;
      if (id === 'observable' && !c.bumped && chem.isReactive(c) && !chem.isComplete(c)) label = 'Beobachtung möglich – Reaktion läuft noch';
      const stale = !!t.recordedId && !current;
      return { id: ph.id, label, index: PHASE_INDEX[id] + 1, total: PHASES.length, stale };
    }

    /** Kontextabhängige Hilfe in drei Stufen. */
    function help() {
      const t = activeTube();
      if (state.op) return { context: 'Handlung läuft', levels: ['Beobachte, was gerade passiert.', 'Warte, bis die Animation abgeschlossen ist.', 'Nach Abschluss der Handlung kannst du weiterarbeiten.'] };
      if (!t) {
        return { context: 'Kein Reagenzglas ausgewählt', levels: [
          'Für jeden Nachweis brauchst du zuerst ein geeignetes Gefäß.',
          'Im Reagenzglasständer stehen saubere Reagenzgläser bereit.',
          'Tippe auf ein leeres Reagenzglas im Ständer.'] };
      }
      const c = t.contents;
      const a = chem.analyze(c);
      const vol = chem.volume(c);
      const n = t.id;
      const H = (context, l1, l2, l3) => ({ context, levels: [l1, l2, l3] });

      if (c.bumped) return H('Siedeverzug', 'Ist dieser Ansatz noch auswertbar?', 'Ein Teil des Ansatzes ist herausgespritzt – das Ergebnis ist nicht verwertbar. Gefahrlos erwärmt man im Wasserbad.', `Nimm Reagenzglas ${n} aus der Flamme („In den Ständer“), tausche es aus („Austauschen“) und setze den Versuch neu an. Erwärme im Wasserbad.`);
      if (t.place === 'flame') return H('Reagenzglas in der Flamme', 'Ist direktes Erhitzen in der Flamme hier die geeignete Methode?', 'Beim direkten Erhitzen kann es zu einem Siedeverzug kommen. Für Fehling- und Tollens-Probe eignet sich ein Wasserbad.', `Nimm Reagenzglas ${n} sofort aus der Flamme: „In den Ständer“ oder „Ins Wasserbad“.`);
      const current = recordCurrent(t);
      if (current && !t.evaluated) return H('Beobachtung protokolliert', 'Was bedeutet deine Beobachtung?', 'Im Protokoll kannst du Ergebnis, Deutung und Stoffklasse eintragen und prüfen lassen.', 'Öffne „Auswertung“ und prüfe dein Protokoll.');
      if (current && t.evaluated) return H('Versuch ausgewertet', 'Welche Probe hast du noch nicht untersucht?', 'Vergleiche die Ergebnisse verschiedener Proben in der Ergebnisübersicht; bei positiven Nachweisen kannst du die Redoxreaktion erarbeiten.', 'Tausche das Reagenzglas aus oder nimm ein anderes Reagenzglas für die nächste Probe. Für positive Nachweise: „Redox-Trainer“ öffnen.');
      if (t.recordedId && chem.isObservable(c) && a.valid) return H('Versuch hat sich verändert', 'Dein Protokoll hält einen früheren Zwischenstand fest. Was siehst du jetzt?', 'Der frühere Eintrag bleibt erhalten. Für die Auswertung zählt eine Beobachtung des aktuellen Zustands.', 'Tippe erneut auf „Beobachtung festhalten“ und werte den aktuellen Zustand aus.');

      if (a.system === 'empty') {
        return H(`Reagenzglas ${n} ist leer`,
          'Welcher Nachweis soll es sein? Beide Nachweise beginnen mit dem Ansetzen eines Reagenzes.',
          'Fehling-Probe: Fehling I und Fehling II. Tollens-Probe: Silbernitratlösung, Natronlauge und Ammoniaklösung.',
          `Fehling-Probe: Tippe auf „Fehling I“, dann auf „Fehling II“. Tollens-Probe: Tippe zuerst auf „Silbernitratlösung“.`);
      }
      if (a.system === 'foreign' || a.system === 'none') {
        return H('Ansatz unbrauchbar', 'Passt diese Kombination zu einem der beiden Nachweise?', a.reason, `Tausche Reagenzglas ${n} aus („Austauschen“) und setze das Reagenz neu an.`);
      }
      const heatHint = (sys) => sys === 'fehling'
        ? ['Die Nachweisreaktion braucht Energie.', 'Die Fehling-Probe wird im heißen Wasserbad erwärmt (Heizplatte auf 80 °C, 60 °C reicht auch, dauert aber länger).']
        : ['Wie lässt sich die Nachweisreaktion schonend beschleunigen?', 'Bei Raumtemperatur kann sich Silber langsam abscheiden. Im warmen Wasserbad (ca. 60 °C) geht es in kurzer Zeit – nie direkt in der Flamme erhitzen.'];
      const bathStep = (sys) => {
        const temp = sys === 'fehling' ? 80 : 60;
        if (t.place !== 'bath' && state.bath.setting === 0) return `Schalte die Heizplatte auf ${temp} °C und stelle Reagenzglas ${n} ins Wasserbad.`;
        if (t.place !== 'bath') return `Stelle Reagenzglas ${n} ins Wasserbad („Ins Wasserbad“).`;
        if (state.bath.setting === 0) return `Schalte die Heizplatte ein (${temp} °C).`;
        return 'Warte im Wasserbad und beobachte das Reagenzglas in der Lupe.';
      };

      if (a.system === 'fehling') {
        if (!a.valid) {
          if (a.status === 'incomplete' && c.portions.fehling1 === 0) return H('Fehling-Reagenz unvollständig', 'Welcher Bestandteil des Fehling-Reagenzes enthält die Kupfer-Ionen?', 'Fehling I ist die blaue Kupfer(II)-sulfat-Lösung, Fehling II die farblose alkalische Tartrat-Lösung.', 'Gib Fehling I hinzu.');
          if (a.status === 'incomplete') return H('Fehling-Reagenz unvollständig', 'Das Fehling-Reagenz besteht aus zwei Lösungen. Ist schon beides im Reagenzglas?', 'Fehling II liefert die alkalische Lösung mit dem Tartrat, das die Kupfer(II)-Ionen als tiefblauen Komplex in Lösung hält.', 'Gib Fehling II hinzu (gleiche Menge wie Fehling I).');
          if (a.status === 'cuoh2') return H('Niederschlag statt Fehling-Lösung', 'Statt einer klaren tiefblauen Lösung ist ein Niederschlag entstanden. Woran liegt das?', a.reason, `Dieser Ansatz ist kein Fehling-Reagenz. Tausche Reagenzglas ${n} aus und mische Fehling I mit Fehling II.`);
          if (a.status === 'imbalanced') return H('Mischungsverhältnis', 'Stimmt das Verhältnis von Fehling I zu Fehling II?', a.reason, 'Gib noch eine Portion Fehling II hinzu.');
        }
        if (c.mix < 0.85 && !c.sampleId) return H('Fehling-Lösung noch nicht durchmischt', 'Sind beide Lösungen schon gleichmäßig vermischt?', 'Erst eine homogene, tiefblaue Lösung ist das gebrauchsfertige Fehling-Reagenz.', `Tippe auf „Schütteln“, um Reagenzglas ${n} zu durchmischen.`);
        if (!c.sampleId) return H('Fehling-Reagenz bereit', 'Das Reagenz ist angesetzt. Was soll nachgewiesen werden?', 'Gib nun eine Stoffprobe hinzu (Aldehyd oder Keton).', 'Tippe auf eine der Probenflaschen (z. B. „' + state.samples[0].label + '“).');
        if (!chem.isObservable(c)) {
          if (c.progress > 0.02) return H('Reaktion läuft', 'Beobachte die Farbe genau – was verändert sich?', 'Achte auf Farbe und Trübung der Mischung in der Lupe.', 'Lass das Reagenzglas im heißen Wasserbad, bis ein deutliches Ergebnis zu sehen ist.');
          const [l1, l2] = heatHint('fehling');
          return H('Probe zugegeben', l1, l2, bathStep('fehling'));
        }
        return H('Beobachtung möglich', 'Was hat sich im Vergleich zum Beginn verändert?', 'Halte deine Beobachtung fest – Farbe, Trübung, Niederschlag. Ein deutlich sichtbarer Niederschlag genügt; die Reaktion muss dafür nicht vollständig abgelaufen sein.', 'Tippe auf „Beobachtung festhalten“.');
      }

      // Tollens
      if (!a.valid) {
        if (a.status === 'incomplete') return H('Tollens-Reagenz unvollständig', 'Die Silber-Ionen müssen erst in eine geeignete Form gebracht werden.', 'Zuerst alkalisch machen (Natronlauge) – es bildet sich ein Niederschlag. Ammoniaklösung löst ihn als Silber-Ammin-Komplex.', 'Gib Natronlauge hinzu.');
        if (a.status === 'precipitate') return H('Niederschlag vorhanden', 'Der braune Niederschlag ist Silberoxid. Womit lässt er sich wieder auflösen?', 'Ammoniak bildet mit Silber(I)-Ionen den löslichen Komplex [Ag(NH₃)₂]⁺.', 'Gib tropfenweise Ammoniaklösung hinzu, bis der Niederschlag vollständig gelöst ist.');
      }
      if (!c.sampleId) return H('Tollens-Reagenz bereit', 'Die klare ammoniakalische Silberlösung ist fertig. Was fehlt noch?', 'Gib nun eine Stoffprobe hinzu (Aldehyd oder Keton).', 'Tippe auf eine der Probenflaschen (z. B. „' + state.samples[0].label + '“).');
      if (!chem.isObservable(c)) {
        if (c.progress > 0.02) return H('Reaktion läuft', 'Beobachte die Glaswand und die Lösung genau.', 'Achte auf die Innenseite des Reagenzglases unterhalb des Flüssigkeitsspiegels und auf eine graue Färbung der Lösung.', 'Lass das Reagenzglas im warmen Wasserbad, bis ein deutliches Ergebnis zu sehen ist.');
        const [l1, l2] = heatHint('tollens');
        return H('Probe zugegeben', l1, l2, bathStep('tollens'));
      }
      return H('Beobachtung möglich', 'Was siehst du an der Glaswand und in der Lösung?', 'Silber kann sich als Spiegel an der Glaswand oder fein verteilt als grau-schwarzer Niederschlag zeigen. Halte fest, was du siehst.', 'Tippe auf „Beobachtung festhalten“.');
    }

    // -------------------------------------------------------------- Protokoll
    function modelFor(tubeId) {
      const t = tubeById(tubeId);
      return t ? chem.classify(t.contents) : null;
    }

    function recordProtocol(tubeId, answers, opts2) {
      const t = tubeById(tubeId);
      if (!t) return null;
      const model = chem.classify(t.contents);
      const entry = sampleEntry(t.contents.sampleId);
      const graded = answers ? chem.gradeProtocol(model, answers) : null;
      const rec = {
        id: 'r' + (state.protocol.length + 1) + '-' + Math.round(state.time * 10),
        tubeId: t.id, generation: t.generation, mode: state.mode,
        sampleKey: entry ? entry.key : null, sampleLabel: entry ? entry.label : 'keine Probe',
        sampleId: t.contents.sampleId,
        model, answers: answers || null, graded,
        solutionShown: !!(opts2 && opts2.solutionShown),
        contents: Object.assign({}, t.contents.portions), sampleAmount: t.contents.sampleAmount,
        observable: chem.isObservable(t.contents),
        // Zeitpunkt der Beobachtung: Ein früher Eintrag ist ein Zwischenstand,
        // wenn der Versuch danach weiterlaufen kann.
        simTime: Math.round(state.time), temp: Math.round(t.contents.temp),
        interim: model.outcome === 'unfinished' || (model.outcome === 'positive' && !model.complete)
      };
      state.protocol.push(rec);
      t.recordedId = rec.id;
      t.recordKey = observationKey(t.contents);
      t.staleNotified = false;
      t.evaluated = !!(answers || rec.solutionShown);
      emit('protocol', rec);
      emit('change', { reason: 'protocol' });
      return rec;
    }

    const isEvidence = (rec) => rec && (rec.model.outcome === 'positive' || rec.model.outcome === 'negative');

    /**
     * Ergebnisübersicht je Probe und Verfahren: das zuletzt protokollierte
     * Ergebnis und – getrennt davon – die letzte gültige Evidenz. Ein später
     * gescheiterter Versuch löscht eine frühere gültige Beobachtung nicht.
     */
    function overview() {
      return state.samples.map((s) => {
        const row = { key: s.key, label: s.label, sampleId: s.sampleId, fehling: null, tollens: null, fehlingEvidence: null, tollensEvidence: null };
        for (const rec of state.protocol) {
          if (rec.sampleId !== s.sampleId) continue;
          const m = rec.model.method;
          if (m !== 'fehling' && m !== 'tollens') continue;
          row[m] = rec;
          if (isEvidence(rec)) row[m + 'Evidence'] = rec;
        }
        return row;
      });
    }

    /** Einordnung bewerten, ohne Ereignisse auszulösen. */
    function analysisResult(answers) {
      return overview().map((row) => {
        const truth = chem.SAMPLE_BY_ID[row.sampleId];
        const evidence = [row.fehlingEvidence, row.tollensEvidence].filter(Boolean);
        const answer = answers[row.key] || '';
        const expected = truth.reducing ? 'aldehyd' : 'keinAldehyd';
        return { key: row.key, answer, expected, correct: answer === expected, hasEvidence: evidence.length > 0 };
      });
    }

    /** Einordnung im Analysemodus prüfen. answers: {A:'aldehyd'|'keinAldehyd'} */
    function checkAnalysis(answers) {
      state.analysisAnswers = Object.assign({}, answers);
      state.analysisChecked = true;
      const result = analysisResult(state.analysisAnswers);
      emit('change', { reason: 'analysis' });
      return result;
    }

    function revealAnalysis() {
      state.analysisRevealed = true;
      emit('change', { reason: 'reveal' });
    }

    // ------------------------------------------------------------- Sitzung
    /** Nur Modus, Probenzuordnung und Protokoll – keine personenbezogenen Daten. */
    function exportSession() {
      return {
        v: 1, mode: state.mode, samples: state.samples, protocol: state.protocol,
        analysisAnswers: state.analysisAnswers, analysisChecked: state.analysisChecked, analysisRevealed: state.analysisRevealed
      };
    }
    function importSession(data) {
      if (!data || data.v !== 1 || !Array.isArray(data.samples)) return false;
      const mode = data.mode === 'analysis' ? 'analysis' : 'learn';
      const ids = data.samples.map((s) => s.sampleId).sort().join();
      if (ids !== sampleIdsFor(mode).slice().sort().join()) return false;
      state.mode = mode;
      state.samples = data.samples;
      state.protocol = Array.isArray(data.protocol) ? data.protocol : [];
      state.analysisAnswers = data.analysisAnswers || {};
      state.analysisChecked = !!data.analysisChecked;
      state.analysisRevealed = !!data.analysisRevealed;
      resetBench();
      emit('restart', { mode: state.mode });
      return true;
    }

    // ------------------------------------------------------------- Initialisierung
    setupSamples();
    resetBench();

    return {
      state, PHASES,
      on: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
      update, selectTube, chooseSubstance, addSubstance, shake, moveTube, replaceTube,
      setHotplate, cycleHotplate, toggleBurner, resetBench, fullRestart,
      phaseOf, help, modelFor, recordProtocol, recordCurrent, overview, analysisResult, checkAnalysis, revealAnalysis,
      tubeById, activeTube, sampleEntry, substanceLabel, busy, exportSession, importSession,
      setMode: (mode) => fullRestart(mode),
      // Für Tests: Simulation zeitraffend vorantreiben
      advance(seconds, stepSize) {
        const h = stepSize || 0.05;
        for (let s = 0; s < seconds; s += h) update(h);
      }
    };
  }

  return { createLab, PHASES, HOTPLATE_SETTINGS, TUBE_COUNT, BATH_SLOTS, DUR, BUMP_AFTER };
});
