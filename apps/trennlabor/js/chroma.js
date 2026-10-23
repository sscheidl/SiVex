/*
 * Trennlabor – Fachmodell „Papierchromatographie“ (ohne DOM)
 *
 * Explizites Modelldatenset: Farbstoffkomponenten mit relativer Laufstrecke
 * (Rf) und löslichem Anteil je Laufmittel. Die Laufmittelfront steigt nach dem
 * Kapillarmodell (Washburn: Strecke² ~ Zeit); jede Komponente wandert mit
 * Rf × Frontstrecke. Nicht lösliche Anteile bleiben auf der Startlinie.
 * Bandenbreite wächst mit Punktgröße und Laufstrecke (Diffusion).
 */
(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('./core.js') : root.TL.core;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).chroma = api;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { clamp, clone } = core;

  /** Farbstoffkomponenten (Modellfarbstoffe). rf: relative Laufstrecke, sol: löslicher (wandernder) Anteil. */
  const COMPONENTS = {
    G: { name: 'gelber Farbstoff', colorName: 'gelb', rgb: [236, 196, 22], water: { rf: 0.80, sol: 1 }, etoh: { rf: 0.76, sol: 1 } },
    B: { name: 'blauer Farbstoff', colorName: 'blau', rgb: [32, 96, 214], water: { rf: 0.60, sol: 1 }, etoh: { rf: 0.82, sol: 1 } },
    R: { name: 'roter Farbstoff', colorName: 'rot', rgb: [218, 36, 72], water: { rf: 0.42, sol: 1 }, etoh: { rf: 0.60, sol: 1 } },
    V: { name: 'violetter Farbstoff', colorName: 'violett', rgb: [104, 44, 160], water: { rf: 0.22, sol: 0.95 }, etoh: { rf: 0.45, sol: 1 } },
    WS: { name: 'alkohollöslicher Schwarzfarbstoff', colorName: 'blauschwarz', rgb: [52, 44, 92], water: { rf: 0, sol: 0 }, etoh: { rf: 0.62, sol: 0.85 } },
    P: { name: 'Pigment (unlöslich)', colorName: 'schwarz', rgb: [34, 34, 38], water: { rf: 0, sol: 0 }, etoh: { rf: 0, sol: 0 } },
    K: { name: 'Kugelschreiberpaste', colorName: 'blau', rgb: [38, 52, 168], water: { rf: 0.05, sol: 0.12 }, etoh: { rf: 0.72, sol: 0.9 } }
  };
  /** Sieben Proben (definierte Modellproben, keine Aussage über reale Marken). */
  const SAMPLES = [
    { id: 'schwarz', name: 'Schwarzer Filzstift (wasserlöslich)', short: 'Schwarz', rgb: [40, 34, 46], parts: [['V', 0.5], ['R', 0.25], ['G', 0.25]] },
    { id: 'gruen', name: 'Grüner Filzstift (wasserlöslich)', short: 'Grün', rgb: [40, 150, 80], parts: [['G', 0.5], ['B', 0.5]] },
    { id: 'violett', name: 'Violetter Filzstift (wasserlöslich)', short: 'Violett', rgb: [120, 50, 160], parts: [['R', 0.5], ['B', 0.5]] },
    { id: 'orange', name: 'Oranger Filzstift (wasserlöslich)', short: 'Orange', rgb: [240, 130, 30], parts: [['G', 0.55], ['R', 0.45]] },
    { id: 'blau', name: 'Blauer Referenzfarbstoff', short: 'Blau (Ref.)', rgb: [32, 96, 214], parts: [['B', 1]] },
    { id: 'gelb', name: 'Gelber Referenzfarbstoff', short: 'Gelb (Ref.)', rgb: [236, 196, 22], parts: [['G', 1]] },
    { id: 'wasserfest', name: 'Wasserfester schwarzer Stift', short: 'Wasserfest', rgb: [30, 30, 36], parts: [['WS', 0.7], ['P', 0.3]] }
  ];
  const SAMPLE_BY_ID = Object.fromEntries(SAMPLES.map((s) => [s.id, s]));
  const SOLVENTS = {
    water: { name: 'Wasser', D: 0.11, flammable: false },
    etoh: { name: 'Ethanol-Wasser-Gemisch 1:1 (V/V)', short: 'Ethanol-Wasser 1:1', D: 0.065, flammable: true }
  };
  const PAPER = { height: 12, width: 6, lanes: [1.5, 3.0, 4.5] };
  const LINE_HEIGHTS = [1.0, 1.5, 2.0];
  const LEVELS = { low: 0.5, mid: 1.0, high: 2.0 };
  const FRONT_VISIBLE = 40; // s, so lange ist die nasse Front nach dem Herausnehmen erkennbar
  const MIN_RUN = 4.5;      // cm Mindestlaufstrecke für eine aussagekräftige Trennung
  const EVAP = { closed: 0.0005, open: 0.006 };

  function newPaper(n) {
    return {
      n, line: null, lanes: [null, null, null], state: 'bench', // bench | chamber | removed
      wet: 0, flow: 0, front: 0, insertedAt: null, removedAt: null,
      frontMarked: null, frontAtTop: false, submerged: false, dissolved: 0, solvent: null, lid: null
    };
  }

  function initialState() {
    return {
      lab: 'chroma', time: 0, seq: 0, paperCount: 1,
      paper: newPaper(1),
      chamber: { solvent: null, level: 0, lid: false, tint: [0, 0, 0, 0] },
      archive: [], expert: false, log: [], flags: {}, op: null
    };
  }

  /** Spotgröße: Radius in cm aus Zahl der Auftragungen. */
  const spotRadius = (n) => 0.13 * Math.sqrt(Math.max(1, n));

  /**
   * Momentane Lage aller Komponenten auf dem Papier.
   * Rückgabe je Bahn: [{comp, y (cm über Papierunterkante), sigma, amount, moving, tail}]
   */
  function bands(paper) {
    const out = [];
    if (!paper.line) return out;
    const y0 = paper.line.y;
    const solvent = paper.solvent;
    const phi = Math.max(0, paper.flow); // virtuelle Frontstrecke über der Startlinie
    const maxS = PAPER.height - 0.15 - y0;
    const addLane = (lane, laneIdx, parts, n, wide) => {
      const r = spotRadius(n);
      for (const [cid, share] of parts) {
        const comp = COMPONENTS[cid];
        const amount = share * n * (1 - paper.dissolved);
        if (amount <= 0) continue;
        const p = solvent ? comp[solvent] : { rf: 0, sol: 0 };
        const solShare = solvent && paper.flow > 0 ? p.sol : 0;
        const s = Math.min(maxS, p.rf * phi);
        const sigma = r * 0.85 + (s > 0 ? 0.075 * Math.sqrt(s) + 0.02 * s : 0);
        const over = Math.max(0, n - 2);
        if (solShare > 0 && amount * solShare > 0.02) {
          out.push({ lane: laneIdx, comp: cid, y: y0 + s, s, sigma, amount: amount * solShare, moving: true, tail: over * 0.35 * Math.min(1, s / 2), wide });
        }
        if (solShare < 1) out.push({ lane: laneIdx, comp: cid, y: y0, s: 0, sigma: r * 0.85, amount: amount * (1 - solShare), moving: false, tail: 0, wide });
      }
    };
    paper.lanes.forEach((l, i) => { if (l) addLane(l, i, SAMPLE_BY_ID[l.sampleId].parts, l.n, false); });
    if (paper.line.tool === 'pen') addLane(null, -1, [['K', 1]], 1.4, true);
    return out;
  }

  /**
   * Sichtbare Farbzonen einer Bahn: Komponenten, deren Zentren dichter liegen
   * als ihre Breiten, verschmelzen zu einer Zone (nicht aufgelöst).
   */
  function zones(paper, laneIdx) {
    const list = bands(paper).filter((b) => b.lane === laneIdx && b.amount > 0.04).sort((a, b) => a.y - b.y);
    const zs = [];
    for (const b of list) {
      const last = zs[zs.length - 1];
      if (last && Math.abs(b.y - last.y) < 1.15 * (b.sigma + last.sigma) * 0.8 + 0.12) {
        const tot = last.amount + b.amount;
        last.y = (last.y * last.amount + b.y * b.amount) / tot;
        last.sigma = Math.max(last.sigma, b.sigma) + Math.abs(b.y - last.y) * 0.3;
        last.amount = tot; last.comps.push(b.comp); last.moving = last.moving || b.moving;
      } else zs.push({ y: b.y, sigma: b.sigma, amount: b.amount, comps: [b.comp], moving: b.moving });
    }
    const y0 = paper.line ? paper.line.y : 0;
    return zs.map((z) => Object.assign(z, { s: Math.max(0, z.y - y0), atStart: z.y - y0 < 0.25, color: zoneColor(z.comps) }));
  }
  function zoneColor(comps) {
    const uniq = [...new Set(comps)];
    if (uniq.length === 1) return COMPONENTS[uniq[0]].colorName;
    const names = uniq.map((c) => COMPONENTS[c].colorName);
    if (names.includes('gelb') && names.includes('blau')) return 'grün';
    if (names.includes('rot') && names.includes('blau')) return 'violett';
    if (names.includes('gelb') && names.includes('rot')) return 'orange';
    return 'gemischt';
  }

  /** Güte eines Chromatogramms: Liste von Befunden. */
  function quality(paper) {
    const issues = [];
    if (!paper.line) issues.push('noLine');
    else if (paper.line.tool === 'pen') issues.push('penLine');
    if (!paper.lanes.some(Boolean)) issues.push('noSample');
    if (paper.submerged) issues.push('submerged');
    if (!paper.solvent) issues.push('noSolvent');
    const run = paper.line ? paper.front - paper.line.y : 0;
    if (run < MIN_RUN) issues.push('short');
    if (paper.lanes.some((l) => l && l.n >= 3)) issues.push('overloaded');
    if (paper.state !== 'removed') issues.push('notRemoved');
    if (paper.frontAtTop) issues.push('frontAtTop');
    else if (paper.frontMarked == null) issues.push('frontUnmarked');
    const fatal = ['noLine', 'penLine', 'noSample', 'submerged', 'noSolvent', 'short', 'notRemoved'];
    return { valid: !issues.some((i) => fatal.includes(i)), issues, run };
  }

  /** Rf-Wert einer Zone; null, wenn die Front unbekannt ist. */
  function rf(paper, zone) {
    if (!paper.line || paper.frontAtTop || paper.frontMarked == null) return null;
    const front = paper.frontMarked - paper.line.y;
    if (front <= 0.2) return null;
    return zone.s / front;
  }

  function snapshot(paper, time) {
    const q = quality(paper);
    return {
      id: 'C' + paper.n, n: paper.n, time, solvent: paper.solvent, lid: paper.lid,
      line: clone(paper.line), lanes: clone(paper.lanes), front: paper.front, flow: paper.flow,
      frontMarked: paper.frontMarked, frontAtTop: paper.frontAtTop, submerged: paper.submerged, dissolved: paper.dissolved,
      quality: q,
      zones: paper.lanes.map((l, i) => (l ? zones(paper, i).map((z) => ({ y: z.y, s: z.s, sigma: z.sigma, amount: z.amount, comps: z.comps, color: z.color, atStart: z.atStart, moving: z.moving })) : null))
    };
  }

  // =================================================================== Engine
  function createEngine(saved) {
    const bus = core.emitter();
    const st = saved ? clone(saved) : initialState();
    const clock = core.createClock({ step });
    const msg = (text, kind, code) => {
      st.seq++;
      const e = { t: st.time, kind: kind || 'info', text, code: code || null, n: st.seq };
      st.log.push(e); if (st.log.length > 200) st.log.splice(0, st.log.length - 200);
      bus.emit('message', e);
      return e;
    };
    const fail = (text, code) => { msg(text, 'warn', code); return { ok: false, message: text, code }; };
    const ok = (text, extra) => { if (text) msg(text, 'info'); return Object.assign({ ok: true, message: text || '' }, extra || {}); };
    const P = () => st.paper;
    const busy = () => !!st.op;

    function newSheet() {
      if (busy()) return fail('Warte, bis die laufende Handlung abgeschlossen ist.', 'busy');
      if (P().state === 'chamber') return fail('Nimm zuerst den Streifen aus der Kammer.', 'inChamber');
      st.paperCount += 1;
      st.paper = newPaper(st.paperCount);
      return ok('Ein neuer Streifen Chromatographiepapier liegt bereit.');
    }

    function drawLine(tool, y) {
      const p = P();
      if (busy()) return fail('Warte kurz.', 'busy');
      if (p.state !== 'bench') return fail('Die Startlinie wird auf dem trockenen Papier gezeichnet, bevor es in die Kammer kommt.', 'lineLate');
      if (p.line) return fail('Auf diesem Streifen ist schon eine Startlinie. Nimm für eine neue Linie einen neuen Streifen.', 'lineExists');
      if (!LINE_HEIGHTS.includes(Number(y))) return fail('Wähle eine Höhe für die Startlinie.', 'lineHeight');
      if (tool !== 'pencil' && tool !== 'pen') return fail('Wähle ein Schreibgerät.', 'lineTool');
      p.line = { tool, y: Number(y) };
      st.op = { type: 'line', t: 0, dur: 1.0 };
      return ok(`Startlinie mit ${tool === 'pencil' ? 'Bleistift' : 'Kugelschreiber'} ${core.fmt(y, 1)} cm über der Unterkante gezogen.`);
    }

    function spot(lane, sampleId) {
      const p = P();
      if (busy()) return fail('Warte kurz.', 'busy');
      if (p.state !== 'bench') return fail('Proben werden auf das Papier aufgetragen, bevor es in die Kammer kommt.', 'spotLate');
      if (!p.line) return fail('Zeichne zuerst eine Startlinie, damit alle Proben auf gleicher Höhe beginnen.', 'spotNoLine');
      if (!(lane >= 0 && lane < 3)) return fail('Wähle einen Auftragepunkt.', 'lane');
      const s = SAMPLE_BY_ID[sampleId];
      if (!s) return fail('Wähle eine Probe.', 'sample');
      const l = p.lanes[lane];
      if (l && l.sampleId !== sampleId) return fail(`Auf Punkt ${lane + 1} ist schon ${SAMPLE_BY_ID[l.sampleId].short}. Nimm einen anderen Punkt.`, 'laneTaken');
      if (l) { l.n = Math.min(6, l.n + 1); } else p.lanes[lane] = { sampleId, n: 1 };
      st.op = { type: 'spot', lane, t: 0, dur: 0.8 };
      const n = p.lanes[lane].n;
      if (n >= 3) msg(`Punkt ${lane + 1} wurde ${n}-mal betupft – der Fleck wird groß und breit.`, 'warn', 'overload');
      return ok(n === 1 ? `${s.short} als kleiner Punkt auf Position ${lane + 1} aufgetragen.` : `${s.short} auf Position ${lane + 1} erneut aufgetupft (${n}×).`);
    }

    function fill(solvent, levelKey) {
      if (busy()) return fail('Warte kurz.', 'busy');
      if (!SOLVENTS[solvent]) return fail('Wähle ein Laufmittel.', 'solvent');
      const lv = LEVELS[levelKey];
      if (!lv) return fail('Wähle eine Füllmenge.', 'level');
      const ch = st.chamber;
      if (ch.solvent && ch.solvent !== solvent) return fail('In der Kammer ist bereits ein anderes Laufmittel. Leere sie zuerst.', 'otherSolvent');
      if (P().state === 'chamber') return fail('Nimm den Streifen heraus, bevor du Laufmittel nachfüllst.', 'fillWithPaper');
      ch.solvent = solvent;
      ch.level = Math.min(3, Math.max(ch.level, lv));
      st.op = { type: 'fill', t: 0, dur: 1.2 };
      return ok(`${SOLVENTS[solvent].name} eingefüllt – Füllhöhe ${core.fmt(ch.level, 1)} cm.` + (SOLVENTS[solvent].flammable ? ' Hinweis: Das Gemisch ist entzündlich – keine offene Flamme in der Nähe.' : ''));
    }

    function emptyChamber() {
      if (busy()) return fail('Warte kurz.', 'busy');
      if (P().state === 'chamber') return fail('Nimm zuerst den Streifen aus der Kammer.', 'inChamber');
      st.chamber = { solvent: null, level: 0, lid: st.chamber.lid, tint: [0, 0, 0, 0] };
      return ok('Kammer geleert und ausgespült.');
    }

    function setLid(on) {
      st.chamber.lid = !!on;
      if (P().state === 'chamber') P().lid = P().lid || !!on;
      return ok(on ? 'Deckel aufgelegt.' : 'Deckel abgenommen.');
    }

    function insert() {
      const p = P();
      if (busy()) return fail('Warte kurz.', 'busy');
      if (p.state === 'chamber') return fail('Der Streifen steht schon in der Kammer.', 'inChamber');
      if (p.state === 'removed') return fail('Dieser Streifen wurde schon entwickelt. Nimm für einen neuen Versuch einen neuen Streifen.', 'used');
      if (!p.lanes.some(Boolean)) msg('Auf dem Streifen ist noch keine Probe.', 'warn', 'noSampleInsert');
      p.state = 'chamber';
      p.insertedAt = st.time;
      p.lid = st.chamber.lid;
      st.op = { type: 'insert', t: 0, dur: 1.4 };
      if (!st.chamber.solvent) msg('Die Kammer enthält kein Laufmittel – der Streifen hängt trocken.', 'warn', 'dryChamber');
      return ok('Streifen in die Entwicklungskammer gestellt.');
    }

    function remove() {
      const p = P();
      if (busy()) return fail('Warte kurz.', 'busy');
      if (p.state !== 'chamber') return fail('Der Streifen steht nicht in der Kammer.', 'notInChamber');
      p.state = 'removed';
      p.removedAt = st.time;
      st.op = { type: 'remove', t: 0, dur: 1.2 };
      return ok('Streifen herausgenommen. Markiere die Laufmittelfront, solange sie noch nass und gut sichtbar ist.');
    }

    function markFront() {
      const p = P();
      if (p.state !== 'removed') return fail('Die Front wird nach dem Herausnehmen mit Bleistift markiert.', 'markWhen');
      if (p.frontMarked != null) return fail('Die Front ist bereits markiert.', 'marked');
      if (p.frontAtTop) return fail('Das Laufmittel ist bis zum oberen Papierrand gestiegen – wo die Front gestanden hätte, lässt sich nicht mehr feststellen.', 'frontAtTop');
      if (p.wet <= 0.3) return fail('Auf diesem Streifen ist das Laufmittel nicht gestiegen – es gibt keine Front.', 'noFront');
      if (st.time - p.removedAt > FRONT_VISIBLE) return fail('Das Papier ist schon getrocknet – die Laufmittelfront ist nicht mehr sicher zu erkennen.', 'frontDry');
      p.frontMarked = p.front;
      return ok(`Laufmittelfront mit Bleistift markiert (${core.fmt(p.front, 1)} cm über der Unterkante).`);
    }

    function archive() {
      const p = P();
      if (p.state !== 'removed') return fail('Lege das Chromatogramm erst ab, wenn der Streifen entwickelt und herausgenommen ist.', 'archiveEarly');
      if (st.archive.some((a) => a.n === p.n)) return fail('Dieses Chromatogramm liegt schon im Vergleich.', 'archived');
      const snap = snapshot(p, st.time);
      st.archive.push(snap);
      if (st.archive.length > 8) st.archive.shift();
      msg(`Chromatogramm ${snap.id} zum Vergleich abgelegt.`, 'info', 'archive');
      return ok('', { snap });
    }

    function removeArchived(id) {
      st.archive = st.archive.filter((a) => a.id !== id);
      return ok();
    }

    function setExpert(on) { st.expert = !!on; return ok(); }

    function act(name, ...args) {
      const fn = { newSheet, drawLine, spot, fill, emptyChamber, setLid, insert, remove, markFront, archive, removeArchived, setExpert }[name];
      if (!fn) return fail('Unbekannte Handlung ' + name);
      const r = fn(...args);
      bus.emit('change', { action: name, result: r });
      return r;
    }

    function step(dt) {
      st.time += dt;
      if (st.op) { st.op.t += dt; if (st.op.t >= st.op.dur) { st.op = null; bus.emit('change', { action: 'opDone' }); } }
      const p = P();
      const ch = st.chamber;
      if (p.state === 'chamber' && (!st.op || st.op.type !== 'insert')) {
        if (ch.solvent && ch.level > 0) {
          p.solvent = p.solvent || ch.solvent;
          if (p.solvent !== ch.solvent) p.solvent = ch.solvent;
          if (p.line && ch.level >= p.line.y - 0.05 && !p.submerged) {
            p.submerged = true;
            msg('Die Startlinie liegt unter dem Flüssigkeitsspiegel: Die Farbpunkte lösen sich direkt im Laufmittel.', 'warn', 'submerged');
          }
          if (p.submerged && p.dissolved < 0.92) {
            const d = (0.95 - p.dissolved) * (1 - Math.exp(-dt / 3));
            p.dissolved += d;
            // Kammerflüssigkeit färbt sich
            ch.tint[3] = Math.min(0.5, ch.tint[3] + d * 0.4);
          }
          const D = SOLVENTS[ch.solvent].D;
          const ev = ch.lid ? EVAP.closed : EVAP.open;
          if (!ch.lid) p.lid = false;
          const v = Math.max(0, D / (2 * Math.max(0.25, p.wet)) - ev);
          const dd = v * dt;
          p.wet += dd;
          const top = PAPER.height;
          p.front = Math.min(top, ch.level + p.wet);
          if (p.front >= top - 1e-6 && !p.frontAtTop) {
            p.frontAtTop = true;
            msg('Das Laufmittel hat den oberen Rand des Papiers erreicht.', 'warn', 'frontAtTop');
          }
          // Frontstrecke über der Startlinie (läuft am oberen Rand virtuell weiter)
          if (p.line) {
            const above = Math.max(0, ch.level + p.wet - p.line.y);
            p.flow = above;
          }
        }
      }
    }

    return {
      state: st, act, step, clock, advance: (sec) => clock.advance(sec), on: bus.on,
      bands: () => bands(st.paper), zones: (lane) => zones(st.paper, lane), quality: () => quality(st.paper),
      rf: (zone) => rf(st.paper, zone), busy
    };
  }

  return { createEngine, initialState, COMPONENTS, SAMPLES, SAMPLE_BY_ID, SOLVENTS, PAPER, LINE_HEIGHTS, LEVELS, FRONT_VISIBLE, MIN_RUN, bands, zones, quality, rf, snapshot, spotRadius };
});
