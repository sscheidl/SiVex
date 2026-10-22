/*
 * Trennlabor – Modell „Papierchromatographie“ (ohne DOM)
 *
 * Explizites, reproduzierbares Modelldatenset (docs/CHEMIE.md, Abschnitt 3):
 * Jede Farbstoffkomponente hat je Laufmittel einen Löslichkeitsanteil s
 * (Anteil, der sich vom Startfleck löst) und einen Retentionsfaktor Rf
 * (relative Laufstrecke; Ausdruck von Löslichkeit im Laufmittel gegenüber
 * Adsorption an der stationären Phase). Die Laufmittelfront steigt nach
 * Lucas-Washburn (h² ∝ t). Eine Zone wandert erst, wenn die Front den
 * Startfleck erreicht hat; ihr Mittelpunkt liegt bei y0 + Rf · (h − y0).
 *
 * Alle Längen in cm, gemessen von der Unterkante des Papiers.
 */
(function (root, factory) {
  const util = typeof module === 'object' && module.exports ? require('../util.js') : root.TL.util;
  const api = factory(util);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).chroma = api;
})(typeof self !== 'undefined' ? self : this, function (util) {
  'use strict';
  const { clamp, clone, fmt } = util;

  const H = 0.25; // Simulationsschritt in s
  const PAPER_LEN = 15; // cm
  const WET_VISIBLE = 90; // s: so lange ist die Front nach dem Herausnehmen noch sichtbar

  /** Laufmittel. k: Steiggeschwindigkeit der Front in cm²/s (h² = h0² + k·t). */
  const ELUENTS = {
    water: { id: 'water', name: 'Wasser', short: 'Wasser', k: 0.11, flammable: false, color: [150, 192, 228, 0.5] },
    ethanol: { id: 'ethanol', name: 'Ethanol-Wasser-Gemisch (7 : 3, Volumenanteile)', short: 'Ethanol-Wasser 7 : 3', k: 0.065, flammable: true, color: [176, 200, 222, 0.5] }
  };

  /** Farbstoffkomponenten: Farbe, je Laufmittel {s: löslicher Anteil, rf}. */
  const COMPONENTS = {
    yellow: { name: 'gelber Farbstoff', color: [242, 196, 22], water: { s: 1, rf: 0.82 }, ethanol: { s: 1, rf: 0.45 } },
    blue: { name: 'blauer Farbstoff', color: [28, 96, 214], water: { s: 1, rf: 0.6 }, ethanol: { s: 1, rf: 0.85 } },
    red: { name: 'roter Farbstoff', color: [222, 36, 94], water: { s: 1, rf: 0.38 }, ethanol: { s: 1, rf: 0.68 } },
    violet: { name: 'violetter Farbstoff', color: [104, 40, 150], water: { s: 1, rf: 0.15 }, ethanol: { s: 1, rf: 0.32 } },
    permBlack: { name: 'schwarzer, wasserunlöslicher Farbstoff', color: [38, 34, 46], water: { s: 0, rf: 0 }, ethanol: { s: 0.85, rf: 0.74 } },
    ballpoint: { name: 'Kugelschreiberfarbstoff', color: [40, 60, 160], water: { s: 0.15, rf: 0.25 }, ethanol: { s: 0.9, rf: 0.9 } },
    graphite: { name: 'Graphit (Bleistift)', color: [90, 90, 92], water: { s: 0, rf: 0 }, ethanol: { s: 0, rf: 0 } }
  };

  /** Die sieben Proben (definierte virtuelle Modellproben). */
  const PENS = [
    { id: 'black', name: 'Schwarz', long: 'schwarzer wasserlöslicher Filzstift', color: [40, 40, 44], comps: { yellow: 0.3, blue: 0.35, violet: 0.35 } },
    { id: 'green', name: 'Grün', long: 'grüner wasserlöslicher Filzstift', color: [40, 150, 70], comps: { yellow: 0.55, blue: 0.45 } },
    { id: 'purple', name: 'Violett', long: 'violetter wasserlöslicher Filzstift', color: [128, 50, 160], comps: { red: 0.5, blue: 0.5 } },
    { id: 'orange', name: 'Orange', long: 'oranger wasserlöslicher Filzstift', color: [240, 120, 30], comps: { yellow: 0.6, red: 0.4 } },
    { id: 'refBlue', name: 'Blau (Referenz)', long: 'blauer Referenzfarbstoff', color: [28, 96, 214], comps: { blue: 1 }, reference: true },
    { id: 'refYellow', name: 'Gelb (Referenz)', long: 'gelber Referenzfarbstoff', color: [242, 196, 22], comps: { yellow: 1 }, reference: true },
    { id: 'perm', name: 'Wasserfest schwarz', long: 'wasserfester schwarzer Stift', color: [30, 30, 36], comps: { permBlack: 1 } }
  ];
  const PEN_BY_ID = Object.fromEntries(PENS.map((p) => [p.id, p]));
  const PAPERS = {
    sheet: { id: 'sheet', name: 'Chromatographiepapier, breit (3 Bahnen)', lanes: 3, width: 9 },
    strip: { id: 'strip', name: 'Papierstreifen, schmal (1 Bahn)', lanes: 1, width: 3 }
  };

  // Fleckgröße (Radius in cm) je nach Anzahl Auftupfer
  const spotRadius = (load) => 0.18 + 0.12 * (load - 1);
  const OVERLOAD = 4;

  function create() {
    const ev = util.emitter();
    const st = {
      kind: 'chroma', t: 0,
      paper: null,
      chamber: { eluent: null, level: 0, lid: false },
      archive: [],
      nextNo: 1,
      log: [],
      selectedPen: 'black', selectedLane: 0, expert: false
    };
    const stepper = util.stepper(H, step);
    const log = (type, data) => { st.log.push(Object.assign({ t: +st.t.toFixed(1), type }, data)); };
    const msg = (text, kind) => ev.emit('message', { text, kind: kind || 'info' });
    const mistake = (key) => { log('mistake', { key }); ev.emit('mistake', { key }); };
    const fail = (text, key) => { msg(text, 'warn'); if (key) mistake(key); return { ok: false, message: text }; };

    function laneX(p, lane) { return (lane + 0.5) * PAPERS[p.type].width / PAPERS[p.type].lanes; }

    function newPaper(type) {
      if (st.paper && st.paper.state === 'developing') return fail('Nimm zuerst das Papier aus der Kammer.');
      if (st.paper && !st.paper.archived && st.paper.state !== 'fresh') archive();
      if (!PAPERS[type]) return fail('Unbekanntes Papier.');
      st.paper = {
        no: st.nextNo++, type, lanes: PAPERS[type].lanes, width: PAPERS[type].width,
        line: null, spots: [], zones: [], state: 'fresh', front: 0, frontVirtual: 0, tIn: 0, tOut: 0,
        eluent: null, level: 0, lid: false, frontMark: null, submerged: false, pool: 0, archived: false
      };
      log('paper', { type });
      ev.emit('change', {});
      return { ok: true };
    }

    function drawLine(tool, y) {
      const p = st.paper;
      if (!p) return fail('Nimm zuerst ein Papier.');
      if (p.state !== 'fresh') return fail('Die Startlinie zeichnet man vor dem Entwickeln.');
      if (p.spots.length) return fail('Zeichne die Startlinie vor dem Auftragen der Proben.');
      y = clamp(+y || 1.5, 0.5, 4);
      p.line = { tool, y };
      if (tool === 'ballpoint') mistake('ballpoint');
      log('line', { tool, y });
      ev.emit('change', {});
      return { ok: true };
    }

    function applySpot(penId, lane) {
      const p = st.paper;
      if (!p) return fail('Nimm zuerst ein Papier.');
      if (p.state !== 'fresh') return fail('Proben trägt man vor dem Entwickeln auf.');
      const pen = PEN_BY_ID[penId];
      if (!pen) return fail('Unbekannte Probe.');
      lane = clamp(lane | 0, 0, p.lanes - 1);
      let s = p.spots.find((x) => x.lane === lane);
      if (s && s.pen !== penId) return fail(`Auf Bahn ${lane + 1} ist schon ${PEN_BY_ID[s.pen].name}. Nimm eine freie Bahn.`);
      const y = p.line ? p.line.y : 1.5;
      if (!s) { s = { lane, pen: penId, load: 0, y, x: laneX(p, lane) }; p.spots.push(s); }
      s.load += 1;
      if (s.load === OVERLOAD) { msg('Der Fleck wird sehr groß – zu viel Probe macht die Farbzonen unscharf.', 'warn'); mistake('overload'); }
      log('spot', { pen: penId, lane, load: s.load });
      ev.emit('change', {});
      return { ok: true };
    }

    function fillChamber(eluent, level) {
      if (!ELUENTS[eluent]) return fail('Unbekanntes Laufmittel.');
      if (st.paper && st.paper.state === 'developing') return fail('Während der Entwicklung füllt man nichts nach.');
      st.chamber.eluent = eluent;
      st.chamber.level = clamp(+level || 1, 0.5, 3);
      log('fill', { eluent, level: st.chamber.level });
      if (ELUENTS[eluent].flammable) msg('Ethanol ist leicht entzündlich: keine offene Flamme in der Nähe, Kammer abdecken.', 'info');
      ev.emit('change', {});
      return { ok: true };
    }

    function emptyChamber() {
      if (st.paper && st.paper.state === 'developing') return fail('Nimm zuerst das Papier heraus.');
      st.chamber.eluent = null; st.chamber.level = 0;
      ev.emit('change', {});
      return { ok: true };
    }

    function setLid(on) { st.chamber.lid = !!on; if (st.paper && st.paper.state === 'developing') st.paper.lid = !!on; ev.emit('change', {}); return { ok: true }; }

    function insertPaper() {
      const p = st.paper;
      if (!p) return fail('Nimm zuerst ein Papier.');
      if (p.state !== 'fresh') return fail('Dieses Papier wurde schon entwickelt. Nimm ein neues.');
      if (!st.chamber.eluent) return fail('In der Kammer ist noch kein Laufmittel.');
      if (!p.spots.length) msg('Auf dem Papier ist noch keine Probe.', 'warn');
      p.state = 'developing';
      p.eluent = st.chamber.eluent; p.level = st.chamber.level; p.lid = st.chamber.lid;
      p.front = p.level; p.frontVirtual = p.level; p.tIn = 0;
      // Zonen anlegen: je Komponente der Probe und der Kugelschreiberlinie
      p.zones = [];
      for (const s of p.spots) {
        const pen = PEN_BY_ID[s.pen];
        for (const [cid, share] of Object.entries(pen.comps)) {
          const sol = COMPONENTS[cid][p.eluent].s;
          const amount = share * s.load;
          if (sol > 0) p.zones.push({ lane: s.lane, x: s.x, comp: cid, pen: s.pen, amount: amount * sol, y0: s.y, y: s.y, sigma: spotRadius(s.load), load: s.load, mobile: true });
          if (sol < 1) p.zones.push({ lane: s.lane, x: s.x, comp: cid, pen: s.pen, amount: amount * (1 - sol), y0: s.y, y: s.y, sigma: spotRadius(s.load) * 0.9, load: s.load, mobile: false });
        }
      }
      if (p.line && p.line.tool === 'ballpoint') {
        const sol = COMPONENTS.ballpoint[p.eluent].s;
        p.zones.push({ lane: -1, x: p.width / 2, comp: 'ballpoint', pen: null, amount: 0.6 * sol, y0: p.line.y, y: p.line.y, sigma: 0.12, load: 1, mobile: true, band: true });
      }
      // Liegen Startfleck oder -linie im Laufmittel?
      const y = p.line ? p.line.y : 1.5;
      if (p.level >= y - 0.15) {
        p.submerged = true;
        msg('Die Startlinie liegt im Laufmittel: Die Farbstoffe lösen sich direkt in der Flüssigkeit.', 'warn');
        mistake('submerged');
      }
      log('insert', { eluent: p.eluent, level: p.level, lid: p.lid });
      if (!st.chamber.lid) msg('Ohne Deckel verdunstet Laufmittel vom Papier; die Front steigt langsamer und ungleichmäßiger.', 'info');
      ev.emit('change', {});
      return { ok: true };
    }

    function removePaper() {
      const p = st.paper;
      if (!p || p.state !== 'developing') return fail('Es steht kein Papier in der Kammer.');
      p.state = 'drying'; p.tOut = 0;
      log('remove', { front: +p.front.toFixed(2), virtual: +p.frontVirtual.toFixed(2), t: +p.tIn.toFixed(0) });
      if (startDistance(p) < 4) { msg('Die Laufmittelfront ist noch nicht weit gestiegen – die Farbzonen liegen dicht beisammen.', 'warn'); mistake('tooShort'); }
      ev.emit('change', {});
      return { ok: true };
    }

    function markFront() {
      const p = st.paper;
      if (!p || p.state === 'fresh') return fail('Es gibt noch keine Laufmittelfront.');
      if (p.state === 'developing') return fail('Nimm das Papier zuerst aus der Kammer.');
      if (p.frontMark) return fail('Die Front ist schon markiert.');
      if (p.state === 'dry') return fail('Das Papier ist schon trocken – die Front ist nicht mehr zu erkennen.', 'frontLost');
      const atTop = p.front >= PAPER_LEN - 0.05;
      p.frontMark = { y: p.front, valid: !atTop };
      if (atTop) { msg('Das Laufmittel ist bis zum Papierrand gestiegen: Wo die Front gelegen hätte, lässt sich nicht sicher sagen.', 'warn'); mistake('frontAtTop'); }
      log('markFront', { y: +p.front.toFixed(2), valid: !atTop });
      ev.emit('change', {});
      return { ok: true };
    }

    function startDistance(p) { return p.front - (p.line ? p.line.y : 1.5); }

    function archive() {
      const p = st.paper;
      if (!p || p.state === 'fresh' || p.archived) return null;
      if (p.state === 'developing') return null;
      p.archived = true;
      const snap = clone(p);
      snap.result = evaluatePaper(p);
      st.archive.push(snap);
      log('archive', { no: p.no });
      ev.emit('change', {});
      return snap;
    }

    // ---------------------------------------------------------- Zeitschritt
    function step(h) {
      st.t += h;
      const p = st.paper;
      if (!p) return;
      if (p.state === 'developing') {
        p.tIn += h;
        const E = ELUENTS[p.eluent];
        const k = E.k * (p.lid ? 1 : 0.85);
        const prevFront = p.front;
        p.frontVirtual = Math.sqrt(p.frontVirtual * p.frontVirtual + k * h);
        p.front = Math.min(PAPER_LEN, p.frontVirtual);
        if (prevFront < PAPER_LEN && p.front >= PAPER_LEN) { msg('Das Laufmittel hat den oberen Papierrand erreicht.', 'warn'); log('frontTop', {}); }
        for (const z of p.zones) {
          if (p.submerged) {
            // Farbstoffe lösen sich im Laufmittelvorrat
            const d = z.amount * (1 - Math.exp(-h / 8));
            z.amount -= d; p.pool += d;
            continue;
          }
          if (!z.mobile) continue;
          if (p.frontVirtual <= z.y0) continue;
          const rf = COMPONENTS[z.comp][p.eluent].rf;
          const yv = z.y0 + rf * (p.frontVirtual - z.y0);
          z.y = Math.min(PAPER_LEN - 0.15, yv);
          const dist = Math.max(0, z.y - z.y0);
          z.sigma = spotRadius(z.load) * (z.load >= OVERLOAD ? 1.6 : 1) + 0.09 * Math.sqrt(dist) + (z.band ? 0.05 * dist : 0);
        }
      } else if (p.state === 'drying') {
        p.tOut += h;
        if (p.tOut >= WET_VISIBLE) { p.state = 'dry'; if (!p.frontMark) log('frontLostDry', {}); ev.emit('change', {}); }
      }
    }

    // ---------------------------------------------------------- Auswertung
    /** Sichtbar getrennte Zonen einer Bahn (zusammenfallende Zonen zählen als eine). */
    function laneBands(p, lane) {
      const zs = p.zones.filter((z) => z.lane === lane && z.amount > 0.08).sort((a, b) => a.y - b.y);
      const bands = [];
      for (const z of zs) {
        const last = bands[bands.length - 1];
        if (last && Math.abs(z.y - last.y) < 1.1 * (z.sigma + last.sigma)) {
          last.comps.push(z.comp); last.amount += z.amount;
          last.y = (last.y + z.y) / 2; last.sigma = Math.max(last.sigma, z.sigma);
        } else bands.push({ y: z.y, sigma: z.sigma, comps: [z.comp], amount: z.amount, atStart: Math.abs(z.y - z.y0) < 0.3 });
      }
      return bands;
    }

    /** Befund eines Chromatogramms: Gültigkeit, Störungen und Zonen je Bahn. */
    function evaluatePaper(p) {
      const issues = [];
      if (p.submerged) issues.push('submerged');
      if (p.line && p.line.tool === 'ballpoint') issues.push('ballpoint');
      if (p.spots.some((s) => s.load >= OVERLOAD)) issues.push('overload');
      if (startDistance(p) < 4) issues.push('tooShort');
      if (p.front >= PAPER_LEN - 0.05) issues.push('frontAtTop');
      if (!p.line) issues.push('noLine');
      const lanes = p.spots.map((s) => {
        const bands = laneBands(p, s.lane);
        const comps = Array.from(new Set(p.zones.filter((z) => z.lane === s.lane && z.amount > 0.08 && z.mobile && Math.abs(z.y - z.y0) > 0.3).map((z) => z.comp)));
        const moved = comps.length > 0;
        return { lane: s.lane, pen: s.pen, load: s.load, bands: bands.length, bandList: bands, comps, moved, overload: s.load >= OVERLOAD };
      });
      // „sauber“: auswertbar für die Aufgaben; zu große Flecken und Kugelschreiber stören
      const usable = !p.submerged && startDistance(p) >= 4 && p.spots.length > 0;
      const clean = usable && !issues.includes('ballpoint') && !issues.includes('overload');
      return { eluent: p.eluent, issues, lanes, usable, clean, frontValid: !!(p.frontMark && p.frontMark.valid) };
    }

    /** Rf-Wert einer Zone; null, wenn keine gültige Front oder Startlinie vorliegt. */
    function rfOf(p, zone) {
      if (!p.frontMark || !p.frontMark.valid || !p.line) return null;
      const s = p.frontMark.y - p.line.y;
      if (s <= 0.2) return null;
      return (zone.y - p.line.y) / s;
    }

    function exportState() { return clone(st); }
    function importState(s) { Object.keys(st).forEach((k) => delete st[k]); Object.assign(st, clone(s)); stepper.reset(); ev.emit('change', { reason: 'import' }); }

    return {
      state: st, H, on: ev.on,
      update(dt) { return stepper.advance(dt); },
      advance(s) { return stepper.advance(s); },
      busy: () => false,
      newPaper, drawLine, applySpot, fillChamber, emptyChamber, setLid, insertPaper, removePaper, markFront, archive,
      evaluatePaper, laneBands, rfOf, startDistance,
      setExpert(on) { st.expert = !!on; ev.emit('change', {}); return { ok: true }; },
      selectPen(id) { if (PEN_BY_ID[id]) st.selectedPen = id; ev.emit('change', {}); return { ok: true }; },
      selectLane(l) { st.selectedLane = l | 0; ev.emit('change', {}); return { ok: true }; },
      exportState, importState
    };
  }

  return { create, ELUENTS, COMPONENTS, PENS, PEN_BY_ID, PAPERS, PAPER_LEN, OVERLOAD, spotRadius, fmtRf: (v) => fmt(v, 2) };
});
