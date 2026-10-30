/*
 * Papierchromatographie – Fachmodell (ohne DOM)
 *
 * Datensatz und Regeln: docs/CHEMIE.md. Grundlage ist das Modell aus
 * Trennlabor 1.0.0, Fassung B (js/chroma.js); Zusammensetzung von Schwarz aus
 * Fassung A. Längen in cm, gemessen von der Unterkante des Papiers.
 *
 * Handlungen (act) prüfen die Voraussetzungen und starten einen kurzen
 * Handgriff (st.op). Seine Wirkung tritt zu einem festen Zeitpunkt des
 * Handgriffs ein; so zeigt die Darstellung die Bewegung, und das Ergebnis
 * hängt trotzdem nur von der Modellzeit ab.
 */
(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('../../../shared/labkit/js/core.js') : root.LK.core;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.PC = root.PC || {}).model = api;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { clone } = core;

  // ------------------------------------------------------------------ Daten
  /** Farbstoffkomponenten: sol = löslicher (wandernder) Anteil, rf = relative Laufstrecke. */
  const COMPONENTS = {
    G: { name: 'gelber Farbstoff', colorName: 'gelb', rgb: [240, 196, 20], water: { sol: 1, rf: 0.82 }, etoh: { sol: 1, rf: 0.70 } },
    B: { name: 'blauer Farbstoff', colorName: 'blau', rgb: [30, 100, 220], water: { sol: 1, rf: 0.62 }, etoh: { sol: 1, rf: 0.74 } },
    R: { name: 'roter Farbstoff', colorName: 'rot', rgb: [222, 38, 70], water: { sol: 1, rf: 0.40 }, etoh: { sol: 1, rf: 0.55 } },
    WS: { name: 'alkohollöslicher Schwarzfarbstoff', colorName: 'blauschwarz', rgb: [48, 46, 96], water: { sol: 0, rf: 0 }, etoh: { sol: 0.8, rf: 0.60 } },
    P: { name: 'schwarzes Pigment (unlöslich)', colorName: 'grauschwarz', rgb: [40, 40, 44], water: { sol: 0, rf: 0 }, etoh: { sol: 0, rf: 0 } }
  };

  /** Sieben definierte Modellproben (keine Aussage über reale Stiftmarken). */
  const SAMPLES = [
    { id: 'schwarz', name: 'Schwarzer Filzstift (wasserlöslich)', label: 'Schwarz', rgb: [38, 36, 44], parts: [['G', 0.30], ['R', 0.30], ['B', 0.40]] },
    { id: 'gruen', name: 'Grüner Filzstift (wasserlöslich)', label: 'Grün', rgb: [30, 140, 70], parts: [['G', 0.55], ['B', 0.45]] },
    { id: 'violett', name: 'Violetter Filzstift (wasserlöslich)', label: 'Violett', rgb: [124, 52, 168], parts: [['R', 0.5], ['B', 0.5]] },
    { id: 'orange', name: 'Oranger Filzstift (wasserlöslich)', label: 'Orange', rgb: [240, 124, 28], parts: [['G', 0.6], ['R', 0.4]] },
    { id: 'blau', name: 'Blauer Referenzfarbstoff', label: 'Blau', sub: 'Referenz', rgb: [30, 100, 220], parts: [['B', 1]], reference: true },
    { id: 'gelb', name: 'Gelber Referenzfarbstoff', label: 'Gelb', sub: 'Referenz', rgb: [240, 196, 20], parts: [['G', 1]], reference: true },
    { id: 'wasserfest', name: 'Wasserfester schwarzer Stift', label: 'Wasserfest', sub: 'schwarz', rgb: [26, 26, 30], parts: [['WS', 0.7], ['P', 0.3]] }
  ];
  const SAMPLE_BY_ID = Object.fromEntries(SAMPLES.map((s) => [s.id, s]));

  const SOLVENTS = {
    water: { id: 'water', name: 'Wasser', short: 'Wasser', k: 0.12, flammable: false, rgb: [118, 176, 228] },
    etoh: { id: 'etoh', name: 'Ethanol-Wasser-Gemisch 1 : 1 (Volumenverhältnis)', short: 'Ethanol-Wasser 1 : 1', k: 0.075, flammable: true, rgb: [162, 172, 214] }
  };

  const PAPER = { width: 9, height: 14, lanesX: [1.8, 4.5, 7.2], lineY: 2.0 };
  /** Höhe der Flecken ohne Startlinie (von Hand gesetzt, nicht auf einer Linie). */
  const NOLINE_Y = [2.35, 1.75, 2.6];
  const PORTION = 0.7;        // cm Spiegelhöhe je Eingießen
  const MAX_PORTIONS = 4;
  const MIN_RUN = 5;          // cm Frontstrecke über der Startlinie für eine vollständige Trennung
  const OVERLOAD = 4;         // ab so vielen Auftupfern ist der Fleck überladen
  const MAX_DABS = 6;
  const FRONT_VISIBLE = 90;   // s: so lange ist die nasse Front nach dem Herausnehmen erkennbar
  const TOP_GAP = 0.35;       // so nah kommen Zonen höchstens an den oberen Rand
  const MIN_AMOUNT = 0.05;    // kleinere Mengen sind nicht mehr als Zone erkennbar

  /** Dauer der Handgriffe (s Modellzeit) und Zeitpunkt ihrer Wirkung (Anteil). */
  const OPS = {
    line: { dur: 1.1, at: 1 }, erase: { dur: 0.8, at: 1 }, spot: { dur: 1.0, at: 0.5 },
    pour: { dur: 1.8, at: 1 }, empty: { dur: 1.2, at: 1 }, insert: { dur: 1.6, at: 1 },
    remove: { dur: 1.4, at: 0 }, newPaper: { dur: 0.7, at: 0.5 }, mark: { dur: 0.8, at: 1 }
  };

  const spotRadius = (n) => 0.19 * Math.sqrt(Math.max(1, n));

  function newPaper(n) {
    return {
      n, line: false, lanes: [null, null, null], state: 'bench', // bench | chamber | removed
      solvent: null, level: 0, contact: false, devTime: 0, front: 0, frontAtTop: false,
      submerged: [false, false, false], dissolved: [0, 0, 0], insertedAt: null, removedAt: null, frontMark: null
    };
  }

  function initialState() {
    return {
      v: 1, time: 0, seq: 0, paperCount: 1, paper: newPaper(1),
      chamber: { solvent: null, portions: 0, level: 0, tint: [0, 0, 0, 0] },
      archive: [], expert: false, op: null, log: []
    };
  }

  // ------------------------------------------------------------------ Zonen
  /** Virtuelle Frontstrecke über dem Boden (läuft am oberen Rand rechnerisch weiter). */
  function virtualFront(p) {
    if (!p.contact) return 0;
    return p.level + Math.sqrt(SOLVENTS[p.solvent].k * p.devTime);
  }

  /** Einzelne Komponentenbanden aller Bahnen (Mittelpunkt y, halbe Höhe sigma, Schweif tail). */
  function bands(p) {
    const out = [];
    const phiV = virtualFront(p);
    p.lanes.forEach((l, i) => {
      if (!l) return;
      const r = spotRadius(l.n);
      const over = l.n >= OVERLOAD;
      for (const [cid, share] of SAMPLE_BY_ID[l.sampleId].parts) {
        const amount = share * Math.min(l.n, 3 + (l.n - 3) * 0.6) * (1 - p.dissolved[i]);
        if (amount <= 0) continue;
        const prm = p.contact ? COMPONENTS[cid][p.solvent] : { sol: 0, rf: 0 };
        const phi = Math.max(0, phiV - l.y);
        const sol = phi > 0 ? prm.sol : 0;
        const s = Math.min(prm.rf * phi, PAPER.height - TOP_GAP - l.y);
        const base = { lane: i, comp: cid, x: PAPER.lanesX[i] };
        if (sol > 0) {
          let sigma = 0.75 * r + 0.08 * Math.sqrt(s) + 0.015 * s;
          if (over) sigma *= 1.2;
          const tail = over ? Math.min(s, 0.22 * s * (l.n - 3)) : 0;
          out.push(Object.assign({}, base, { y: l.y + s, s, sigma, tail, amount: amount * sol, moving: true }));
        }
        if (sol < 1) out.push(Object.assign({}, base, { y: l.y, s: 0, sigma: 0.75 * r * (over ? 1.2 : 1), tail: 0, amount: amount * (1 - sol), moving: false }));
      }
    });
    return out;
  }

  function zoneColor(comps) {
    const u = [...new Set(comps)].sort().join('+');
    const names = { G: 'gelb', B: 'blau', R: 'rot', WS: 'blauschwarz', P: 'grauschwarz', 'B+G': 'grün', 'B+R': 'violett', 'G+R': 'orange', 'B+G+R': 'schwarz', 'P+WS': 'schwarz' };
    return names[u] || 'dunkel gemischt';
  }

  /**
   * Sichtbare Farbzonen einer Bahn, von unten nach oben. Komponenten, deren
   * Kanten (einschließlich Schweif) sich berühren, bilden eine gemeinsame Zone.
   */
  function zones(p, lane) {
    const l = p.lanes[lane];
    if (!l) return [];
    const list = bands(p).filter((b) => b.lane === lane && b.amount >= MIN_AMOUNT).sort((a, b) => a.y - b.y);
    const groups = [];
    for (const b of list) {
      const lo = b.y - 1.05 * b.sigma - b.tail, hi = b.y + 1.05 * b.sigma;
      const g = groups[groups.length - 1];
      if (g && lo - g.hi < 0.05) {
        g.items.push(b); g.hi = Math.max(g.hi, hi); g.lo = Math.min(g.lo, lo);
      } else groups.push({ items: [b], lo, hi });
    }
    return groups.map((g) => {
      const amount = g.items.reduce((a, b) => a + b.amount, 0);
      const y = g.items.reduce((a, b) => a + b.y * b.amount, 0) / amount;
      const comps = g.items.map((b) => b.comp);
      const s = Math.max(0, y - l.y);
      return { y, s, lo: g.lo, hi: g.hi, amount, comps: [...new Set(comps)], color: zoneColor(comps), atStart: s < 0.3, moving: g.items.some((b) => b.moving) };
    });
  }

  /** Liegen aufgetragene Punkte nicht auf der Startlinie (fehlt sie, oder wurde sie erst danach gezogen)? */
  const offLine = (p) => p.lanes.some((l) => l && (!p.line || Math.abs(l.y - PAPER.lineY) > 0.01));
  const OFFLINE_TEXT = 'Die Probenpunkte liegen nicht auf einer gemeinsamen Startlinie. Verwende neues Papier und zeichne zuerst die Startlinie.';

  /** Güte eines Chromatogramms. */
  function quality(p) {
    const issues = [];
    const used = p.lanes.some(Boolean);
    if (!used) issues.push('noSample');
    if (!p.line) issues.push('noLine');
    else if (offLine(p)) issues.push('offLine');
    if (p.state !== 'removed') issues.push('notRemoved');
    else if (!p.contact) issues.push('noSolvent');
    if (p.submerged.some((x, i) => x && p.lanes[i])) issues.push('submerged');
    const run = p.contact ? p.front - PAPER.lineY : 0;
    if (p.contact && run < MIN_RUN) issues.push('short');
    if (p.lanes.some((l) => l && l.n >= OVERLOAD)) issues.push('overloaded');
    if (p.frontAtTop) issues.push('frontAtTop');
    const fatal = ['noSample', 'noLine', 'offLine', 'notRemoved', 'noSolvent', 'submerged', 'short'];
    return { valid: !issues.some((i) => fatal.includes(i)), issues, run };
  }

  /** Startpunkt der Laufstrecke einer Bahn (Startlinie bzw. Fleck). */
  const laneStart = (p, lane) => (p.lanes[lane] ? p.lanes[lane].y : PAPER.lineY);

  /** Rf-Wert einer Zone; null, wenn die Front nicht markiert oder nicht auswertbar ist. */
  function rf(p, lane, zone) {
    if (p.frontMark == null || p.frontAtTop) return null;
    const f = p.frontMark - laneStart(p, lane);
    if (f <= 0.2) return null;
    return zone.s / f;
  }

  function snapshot(p, time) {
    return {
      id: 'P' + p.n, n: p.n, time, solvent: p.solvent, line: p.line, level: p.level,
      lanes: clone(p.lanes), front: p.front, frontAtTop: p.frontAtTop, frontMark: p.frontMark,
      contact: p.contact, devTime: p.devTime, submerged: clone(p.submerged), dissolved: clone(p.dissolved),
      state: 'removed', removedAt: p.removedAt, quality: quality(p),
      zones: p.lanes.map((l, i) => (l ? zones(p, i) : null))
    };
  }

  // ------------------------------------------------------------------ Engine
  function createEngine(saved) {
    const bus = core.emitter();
    const st = saved && saved.v === 1 ? clone(saved) : initialState();
    const clock = core.createClock({ step });
    const msg = (text, kind, code) => {
      st.seq++;
      const e = { t: st.time, kind: kind || 'info', text, code: code || null, n: st.seq };
      st.log.push(e);
      if (st.log.length > 100) st.log.splice(0, st.log.length - 100);
      bus.emit('message', e);
      return e;
    };
    const fail = (text, code) => { msg(text, 'warn', code); return { ok: false, message: text, code }; };
    const ok = (text, extra) => { if (text) msg(text, 'info'); return Object.assign({ ok: true, message: text || '' }, extra || {}); };
    const P = () => st.paper;
    const busy = () => !!st.op;
    const start = (type, args) => { st.op = Object.assign({ type, t: 0, dur: OPS[type].dur, at: OPS[type].at, applied: false }, args || {}); if (OPS[type].at === 0) applyOp(st.op); };

    // ----- Handlungen
    function newSheet() {
      if (P().state === 'chamber') return fail('Nimm zuerst das Papier aus der Kammer.', 'inChamber');
      const p = P();
      if (p.state === 'bench' && !p.line && !p.lanes.some(Boolean)) return fail('Ein unbenutztes Papier liegt schon bereit.', 'paperUnused');
      start('newPaper');
      return ok(p.state === 'bench' ? 'Das vorbereitete Papier wird weggelegt; ein neues Papier liegt bereit.' : 'Ein neues Papier liegt bereit. Das entwickelte Chromatogramm bleibt unter „Ergebnisse“ erhalten.');
    }

    function drawLine() {
      const p = P();
      if (p.state !== 'bench') return fail(p.state === 'chamber' ? 'Das Papier steht in der Kammer. Die Startlinie zieht man vorher.' : 'Dieses Papier ist schon entwickelt. Nimm für einen neuen Versuch ein neues Papier.', 'lineLate');
      if (p.line) return eraseLine();
      start('line');
      return ok('Startlinie mit Bleistift gezogen.');
    }

    function eraseLine() {
      const p = P();
      if (p.state !== 'bench') return fail('Die Startlinie lässt sich jetzt nicht mehr entfernen.', 'eraseLate');
      if (!p.line) return fail('Auf dem Papier ist keine Startlinie.', 'noLine');
      if (p.lanes.some(Boolean)) return fail('Beim Radieren würden die Farbpunkte verwischen. Nimm lieber ein neues Papier.', 'eraseSpots');
      start('erase');
      return ok('Startlinie wegradiert.');
    }

    function spot(lane, sampleId) {
      const p = P();
      if (p.state !== 'bench') return fail(p.state === 'chamber' ? 'Proben trägt man auf, bevor das Papier in die Kammer kommt.' : 'Dieses Papier ist schon entwickelt. Nimm ein neues Papier.', 'spotLate');
      if (!(lane >= 0 && lane < 3)) return fail('Tippe auf einen der drei Auftragepunkte.', 'lane');
      const s = SAMPLE_BY_ID[sampleId];
      if (!s) return fail('Wähle zuerst einen Stift aus dem Stifteständer.', 'noPen');
      const l = p.lanes[lane];
      if (l && l.sampleId !== sampleId) return fail(`Auf Punkt ${lane + 1} ist schon ${SAMPLE_BY_ID[l.sampleId].label}. Nimm einen freien Punkt.`, 'laneTaken');
      if (l && l.n >= MAX_DABS) return fail('Mehr Farbe passt an diese Stelle nicht.', 'maxDabs');
      start('spot', { lane, sampleId });
      return ok('');
    }

    function pour(solvent) {
      if (!SOLVENTS[solvent]) return fail('Unbekanntes Laufmittel.', 'solvent');
      const ch = st.chamber;
      if (P().state === 'chamber') return fail('Gieße das Laufmittel ein, bevor das Papier in der Kammer hängt.', 'pourWithPaper');
      if (ch.solvent && ch.solvent !== solvent) return fail(`In der Kammer ist schon ${SOLVENTS[ch.solvent].short}. Leere sie zuerst, wenn du das Laufmittel wechseln willst.`, 'otherSolvent');
      if (ch.portions >= MAX_PORTIONS) return fail('Die Kammer ist voll – mehr Laufmittel passt nicht sinnvoll hinein.', 'full');
      start('pour', { solvent, from: ch.level });
      return ok(SOLVENTS[solvent].flammable ? 'Ethanol-Wasser eingegossen. Achtung: entzündlich – keine offene Flamme, Kammer abdecken.' : 'Wasser eingegossen.');
    }

    function emptyChamber() {
      if (P().state === 'chamber') return fail('Nimm zuerst das Papier aus der Kammer.', 'inChamber');
      if (!st.chamber.solvent) return fail('Die Kammer ist schon leer.', 'empty');
      start('empty', { from: st.chamber.level });
      return ok('Kammer ausgegossen und ausgespült.');
    }

    function insert() {
      const p = P();
      if (p.state === 'chamber') return fail('Das Papier steht schon in der Kammer.', 'inChamber');
      if (p.state === 'removed') return fail('Dieses Papier ist schon entwickelt. Nimm für einen neuen Versuch ein neues Papier.', 'used');
      start('insert');
      return ok('Papier in die Kammer gehängt, Deckel aufgelegt.');
    }

    function remove() {
      if (P().state !== 'chamber') return fail('Es hängt kein Papier in der Kammer.', 'notInChamber');
      start('remove');
      return ok('');
    }

    function markFront() {
      const p = P();
      if (!st.expert) return fail('Die Front markiert man im Expertenmodus.', 'noExpert');
      if (p.state !== 'removed') return fail('Die Front markiert man, sobald das Papier aus der Kammer genommen ist.', 'markWhen');
      if (p.frontMark != null) return fail('Die Front ist schon markiert.', 'marked');
      if (!p.contact) return fail('Auf diesem Papier ist kein Laufmittel gestiegen – es gibt keine Front.', 'noFront');
      if (p.frontAtTop) return fail('Das Laufmittel ist bis zum oberen Rand gestiegen. Wo die Front gestanden hätte, lässt sich nicht feststellen; Rf-Werte sind so nicht bestimmbar.', 'frontAtTop');
      if (st.time - p.removedAt > FRONT_VISIBLE) return fail('Das Papier ist schon getrocknet – die Front ist nicht mehr sicher zu erkennen.', 'frontDry');
      start('mark');
      return ok('');
    }

    function setExpert(on) { st.expert = !!on; return ok(); }

    const ACTIONS = { newSheet, drawLine, eraseLine, spot, pour, emptyChamber, insert, remove, markFront, setExpert };
    function act(name, ...args) {
      const fn = ACTIONS[name];
      if (!fn) return fail('Unbekannte Handlung ' + name);
      if (busy() && name !== 'setExpert') return fail('Einen Moment – der letzte Handgriff ist noch nicht fertig.', 'busy');
      const r = fn(...args);
      bus.emit('change', { action: name, result: r });
      return r;
    }

    // ----- Wirkung der Handgriffe
    function applyOp(op) {
      op.applied = true;
      const p = P();
      const ch = st.chamber;
      switch (op.type) {
        case 'newPaper':
          st.paperCount += 1;
          st.paper = newPaper(st.paperCount);
          break;
        case 'line': p.line = true; break;
        case 'erase': p.line = false; break;
        case 'spot': {
          const l = p.lanes[op.lane];
          if (l) l.n += 1;
          else p.lanes[op.lane] = { sampleId: op.sampleId, n: 1, y: p.line ? PAPER.lineY : NOLINE_Y[op.lane] };
          const n = p.lanes[op.lane].n;
          const name = SAMPLE_BY_ID[op.sampleId].label;
          if (n === 1) msg(`${name} auf Punkt ${op.lane + 1} aufgetupft.`, 'info', 'spot');
          else if (n >= OVERLOAD) msg(`Punkt ${op.lane + 1} ist jetzt ${n}-mal betupft – der Fleck wird sehr groß.`, 'warn', 'overload');
          else msg(`${name} auf Punkt ${op.lane + 1} erneut aufgetupft (${n}×).`, 'info', 'spot');
          break;
        }
        case 'pour':
          ch.solvent = op.solvent;
          ch.portions += 1;
          ch.level = ch.portions * PORTION;
          break;
        case 'empty':
          st.chamber = { solvent: null, portions: 0, level: 0, tint: [0, 0, 0, 0] };
          break;
        case 'insert':
          p.state = 'chamber';
          p.insertedAt = st.time;
          if (!ch.solvent) msg('In der Kammer ist kein Laufmittel – das Papier hängt trocken.', 'warn', 'dryChamber');
          if (!p.lanes.some(Boolean)) msg('Auf dem Papier ist noch keine Probe.', 'warn', 'noSampleInsert');
          else if (offLine(p)) msg(OFFLINE_TEXT, 'warn', 'offLine');
          break;
        case 'remove': {
          p.state = 'removed';
          p.removedAt = st.time;
          const run = p.contact ? p.front - PAPER.lineY : 0;
          if (p.contact && p.lanes.some(Boolean)) {
            st.archive.push(snapshot(p, st.time));
            if (st.archive.length > 12) st.archive.shift();
            msg(`Papier ${p.n} herausgenommen und unter „Ergebnisse“ abgelegt.` + (run < MIN_RUN ? ' Die Front ist noch nicht weit gestiegen.' : ''), run < MIN_RUN ? 'warn' : 'info', 'archive');
          } else msg('Papier herausgenommen.', 'info', 'removed');
          break;
        }
        case 'mark': {
          p.frontMark = p.front;
          const a = st.archive.find((x) => x.n === p.n);
          if (a) a.frontMark = p.frontMark;
          msg('Laufmittelfront mit Bleistift markiert.', 'info', 'mark');
          break;
        }
      }
    }

    // ----- Zeitschritt
    function step(dt) {
      st.time += dt;
      const op = st.op;
      if (op) {
        op.t += dt;
        if (op.type === 'pour') st.chamber.level = op.from + PORTION * core.clamp((op.t / op.dur - 0.3) / 0.55, 0, 1);
        if (op.type === 'empty') st.chamber.level = op.from * (1 - core.clamp((op.t / op.dur - 0.2) / 0.6, 0, 1));
        if (!op.applied && op.t >= op.at * op.dur - 1e-9) applyOp(op);
        if (op.t >= op.dur - 1e-9) { st.op = null; bus.emit('change', { action: 'opDone', op: op.type }); }
      }
      const p = P();
      const ch = st.chamber;
      if (p.state !== 'chamber') return;
      if (!p.contact) {
        if (!ch.solvent || ch.level < 0.05) return;
        p.contact = true;
        p.solvent = ch.solvent;
        p.level = ch.level;
        p.lanes.forEach((l, i) => { if (l && l.y <= p.level + 0.05) p.submerged[i] = true; });
        if (p.submerged.some(Boolean)) msg('Der Flüssigkeitsspiegel liegt über den Farbpunkten.', 'warn', 'submerged');
      }
      p.devTime += dt;
      const fv = virtualFront(p);
      p.front = Math.min(PAPER.height, fv);
      if (fv >= PAPER.height && !p.frontAtTop) {
        p.frontAtTop = true;
        msg('Das Laufmittel hat den oberen Rand des Papiers erreicht.', 'warn', 'frontAtTop');
      }
      p.submerged.forEach((sub, i) => {
        if (!sub || !p.lanes[i] || p.dissolved[i] >= 0.97) return;
        const d = (1 - p.dissolved[i]) * (1 - Math.exp(-dt / 6));
        p.dissolved[i] += d;
        const s = SAMPLE_BY_ID[p.lanes[i].sampleId];
        const w = d * p.lanes[i].n * 0.25;
        const t = ch.tint;
        const a = t[3] + w;
        for (let c = 0; c < 3; c++) t[c] = (t[c] * t[3] + s.rgb[c] * w) / a;
        t[3] = Math.min(0.85, a);
      });
    }

    return {
      state: st, act, step, clock, on: bus.on, busy,
      advance: (sec) => clock.advance(sec),
      bands: () => bands(st.paper), zones: (lane) => zones(st.paper, lane), quality: () => quality(st.paper)
    };
  }

  return {
    createEngine, initialState, newPaper, offLine, OFFLINE_TEXT, COMPONENTS, SAMPLES, SAMPLE_BY_ID, SOLVENTS, PAPER, NOLINE_Y, PORTION, MAX_PORTIONS,
    MIN_RUN, OVERLOAD, MAX_DABS, FRONT_VISIBLE, OPS, spotRadius, virtualFront, bands, zones, zoneColor, quality, rf, laneStart, snapshot
  };
});
