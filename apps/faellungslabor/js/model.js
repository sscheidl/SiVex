/*
 * Fällungslabor – zentraler Versuchszustand und Bedienablauf (ohne DOM, in Node testbar)
 *
 * Je Reiter („Fällungsreaktionen“, „Kontrollversuche“) ein Ständer mit Reagenzgläsern.
 * Ein Reagenzglas führt einen Ansatz: Volumen, eingebrachte Stoffmengen (Na⁺, NO₃⁻, Ag, X, NH₃,
 * bei Wasserproben die fällbaren Äquivalente F) und den Feststoff in drei Bereichen:
 *   Wolken (frisch gefällt am Eintreffpunkt) → Schwebe (verteilt) → Bodensatz (abgesetzt).
 * Die Feststoffmenge folgt dem Fachmodell (chem.js): Fällung sofort beim Eintreffen eines Tropfens,
 * Auflösen (Ammoniak) als zeitlicher Vorgang; Schwenken wirbelt den Bodensatz wieder auf.
 *
 * Bedienablauf: Flasche antippen (Pipette aufnehmen) → Reagenzglas wählen (Pipette fährt hin) →
 * Proben laufen als Strahl aus, Reagenzien tropfenweise (Tippen = 1 Tropfen, Halten = Folge).
 * Gebucht wird erst beim Eintreffen an der Oberfläche. Vorgänge außerhalb der Anleitung werden
 * vor jedem Stofftransfer abgefangen (rule); der Zustand bleibt dann unverändert.
 * Renderer und Bedienfeld lesen nur; sie verändern den Zustand ausschließlich über diese API.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const chem = isNode ? require('./chem.js') : root.FL.chem;
  const geo = isNode ? require('./geometry.js') : root.FL.geometry;
  const api = factory(chem, geo);
  if (isNode) module.exports = api;
  else (root.FL = root.FL || {}).model = api;
})(typeof self !== 'undefined' ? self : this, function (C, G) {
  'use strict';

  // ------------------------------------------------------------------ Reiter und Zeiten
  const TABS = {
    main: { id: 'main', prefix: 'A', title: 'Fällungsreaktionen', maxTubes: 6, startTubes: 3, bottles: ['nacl', 'nabr', 'nai', 'agno3', 'nh3dil', 'nh3conc', 'water'], samples: ['nacl', 'nabr', 'nai'] },
    control: { id: 'control', prefix: 'K', title: 'Kontrollversuche', maxTubes: 4, startTubes: 4, bottles: ['nacl', 'water', 'tap', 'mineral', 'agno3'], samples: ['nacl', 'water', 'tap', 'mineral'] }
  };
  const SAMPLE_VOLUMES = [1, 2, 3];
  const SPEEDS = [0, 1, 5];

  // Didaktische Visualisierungszeiten bei 1× (Sekunden) – keine Messwerte.
  const T = {
    cloud: 3.0,        // lokale Wolke → verteilte Trübung
    settle: 40,        // Absetzfront erreicht den Boden
    shake: 1.3,        // Schwenkbewegung
    kSusp: 0.9,        // Auflösegeschwindigkeit des schwebenden Feststoffs (1/s, bei voller Triebkraft) – 1.1.0: vorher 0,30
    kSed: 0.25,        // Auflösegeschwindigkeit des Bodensatzes (1/s) – 1.1.0: vorher 0,05
    floorRate: 0.03,   // Mindestumsatz je s (Anteil der Höchstmenge) bei voller Triebkraft – 1.1.0: vorher 0,01
    pour: 2.4,         // Ausgießen: Anheben 0–0,6 s, Ausgießen 0,6–1,7 s, Zurückstellen bis 2,4 s
    pourReduced: 0.8,  // bei reduzierter Bewegung: nur kurzes Ausblenden
    lift: 0.32,        // Pipette aufnehmen
    moveSpeed: 1600,   // Pipettenweg (Welt/s)
    minMove: 0.28,
    holdFirst: 0.45,   // Halten: Abstand nach dem ersten Tropfen
    holdEvery: 0.38,   // Halten: Tropfenfolge (≈ 2,6 Tropfen/s)
    tapMin: 0.16,      // Mindestabstand einzelner Tropfen beim schnellen Tippen
    flowSample: 1.0,   // Probe aus der Messpipette (mL/s)
    flowHelper: 0.8    // Dosierhilfe für größere Mengen (mL/s)
  };
  const EPS = 1e-15;

  // ------------------------------------------------------------------ Ansatz
  function makeTube(slot) {
    return {
      slot, ansatz: null, sample: null, model: null, halide: null, V: 0,
      n: { Na: 0, NO3: 0, Ag: 0, X: 0, N: 0, F: 0 },
      clouds: [], susp: 0, sed: 0, front: 0, shake: 0, rev: 0,
      log: { sampleV: 0, agV: 0, agDrops: 0, nh3dilV: 0, nh3concV: 0, waterV: 0 },
      maxSolid: 0
    };
  }
  const isEmpty = (t) => !(t.V > 0);
  const solidTotal = (t) => t.clouds.reduce((s, c) => s + c.m, 0) + t.susp + t.sed;
  /** Chemische Kenngrößen eines Ansatzes für das Fachmodell. */
  function chemOf(t) {
    if (t.model === 'water') return { water: true, Ag: t.n.Ag, F: t.n.F };
    return { V: t.V, Ag: t.n.Ag, X: t.n.X, N: t.n.N, halide: t.halide };
  }
  function eqSolid(t) {
    if (t._eqRev !== t.rev) { t._eqRev = t.rev; t._pEq = C.solidAtEquilibrium(chemOf(t)); }
    return t._pEq;
  }
  /** Gelöste Stoffmengen (mol) und Gleichgewichtsdaten – nur lesen. */
  function species(t) {
    const p = solidTotal(t);
    const out = { V: t.V, solid: p, Na: t.n.Na, NO3: t.n.NO3, Ag: t.n.Ag, X: t.n.X, N: t.n.N, F: t.n.F,
      dissolvedAg: t.n.Ag - p, dissolvedX: t.model === 'water' ? 0 : t.n.X - p, pEq: eqSolid(t) };
    if (t.model === 'halide' && t.V > 0) {
      const e = C.equilibrium(chemOf(t));
      out.complexedAg = (e.agNH3 + e.agNH3_2) * t.V / 1000;
      out.freeNH3 = e.nh3 * t.V / 1000;
    }
    return out;
  }

  /** Sichtbare Trübung (0…0,85) aus der Feststoffkonzentration in mmol/L (Darstellungsparameter). */
  function turbidity(cmM) { return cmM > 0 ? 0.85 * (1 - Math.exp(-Math.sqrt(cmM / 4))) : 0; }

  /** Volumenanteil in mL und Stoffmengen eines Portions-Eintrags buchen. */
  function book(tab, t, key, vol, xoff) {
    const sol = C.SOLUTIONS[key];
    const cfg = TABS[tab];
    const asSample = cfg.samples.includes(key);
    if (asSample && !t.sample) {
      t.sample = key;
      if (sol.halide) { t.model = 'halide'; t.halide = sol.halide; }
      else { t.model = 'water'; t.halide = null; }
    }
    t.V += vol;
    const L = vol / 1000;
    const ions = sol.ions || {};
    if (ions.Na) t.n.Na += ions.Na * L;
    if (ions.NO3) t.n.NO3 += ions.NO3 * L;
    if (ions.Ag) t.n.Ag += ions.Ag * L;
    if (ions.X) t.n.X += ions.X * L;
    if (ions.N) t.n.N += ions.N * L;
    if (sol.water && C.WATER[sol.water]) t.n.F += C.WATER[sol.water].F * L;
    if (asSample) t.log.sampleV += vol;
    else if (key === 'agno3') { t.log.agV += vol; t.log.agDrops += 1; }
    else if (key === 'nh3dil') t.log.nh3dilV += vol;
    else if (key === 'nh3conc') t.log.nh3concV += vol;
    else if (key === 'water') t.log.waterV += vol;
    t.rev++;
    // Fällung sofort am Eintreffpunkt (lokale Wolke); Auflösen läuft zeitabhängig in stepTube
    const p = solidTotal(t), pEq = eqSolid(t);
    let formed = 0;
    if (pEq > p + EPS) { formed = pEq - p; t.clouds.push({ m: formed, x: xoff || 0, age: 0 }); }
    t.maxSolid = Math.max(t.maxSolid, solidTotal(t));
    return formed;
  }

  function mergeCloud(t, m) {
    if (!(m > 0)) return;
    t.front = t.susp + m > 0 ? t.front * t.susp / (t.susp + m) : 0;
    t.susp += m;
  }
  function stepTube(t, dt) {
    if (!(dt > 0)) return;
    if (t.shake > 0) t.shake = Math.max(0, t.shake - dt);
    // Wolken verteilen sich
    for (const c of t.clouds) c.age += dt;
    const done = t.clouds.filter((c) => c.age >= T.cloud);
    if (done.length) { t.clouds = t.clouds.filter((c) => c.age < T.cloud); for (const c of done) mergeCloud(t, c.m); }
    // Absetzen (nicht während des Schwenkens): Konzentration unter der Front bleibt gleich
    if (t.susp > 0 && t.shake <= 0) {
      const f2 = Math.min(1, t.front + dt / T.settle);
      const s2 = f2 >= 1 ? 0 : t.susp * (1 - f2) / (1 - t.front);
      t.sed += t.susp - s2; t.susp = s2; t.front = f2;
    } else if (!(t.susp > 0)) t.susp = 0;
    // Auflösen bis zur Gleichgewichtsmenge
    const p = solidTotal(t), pEq = eqSolid(t);
    if (p > pEq + EPS) {
      const drive = 1 - pEq / p;
      const parts = [];
      for (const c of t.clouds) parts.push({ get: () => c.m, set: (v) => { c.m = v; }, k: T.kSusp });
      parts.push({ get: () => t.susp, set: (v) => { t.susp = v; }, k: T.kSusp });
      parts.push({ get: () => t.sed, set: (v) => { t.sed = v; }, k: T.kSed });
      // erster Ordnung je Bereich, dazu ein kleiner Mindestumsatz (1 % der Höchstmenge je s bei voller
      // Triebkraft), damit Reste nicht endlos sichtbar „nachschleichen“
      const floor = T.floorRate * t.maxSolid * drive * dt;
      const loss = parts.map((q) => q.get() * (1 - Math.exp(-q.k * drive * dt)) + floor * q.get() / p);
      const sum = loss.reduce((s, v) => s + v, 0);
      const excess = p - pEq;
      // Nahe am Gleichgewicht den Rest anteilig entfernen (keine endlose Annäherung)
      const scale = excess < 1e-13 * Math.max(1e-6, t.maxSolid) || sum > excess ? excess / Math.max(sum, EPS) : 1;
      const useLoss = sum > 0 ? loss.map((v) => v * scale) : parts.map((q) => q.get() / p * excess);
      parts.forEach((q, i) => q.set(Math.max(0, q.get() - useLoss[i])));
      t.clouds = t.clouds.filter((c) => c.m > EPS * 1e-3);
    } else if (pEq > p + EPS) {
      mergeCloud(t, pEq - p); // nur nach Wiederherstellung denkbar
    }
    if (t.susp < 1e-18) { t.susp = 0; }
    if (t.sed < 1e-18) t.sed = 0;
  }
  function shakeTube(t) {
    for (const c of t.clouds) t.susp += c.m;
    t.clouds = [];
    t.susp += t.sed; t.sed = 0; t.front = 0; t.shake = T.shake;
  }

  // ------------------------------------------------------------------ Grenzen der Anleitung
  /**
   * Prüft einen Transfer vor jedem Stoffübergang. Ergebnis: null (zulässig) oder kurzer Grund.
   * Die Rückmeldung beschreibt den Versuchsumfang, keine chemische Unmöglichkeit.
   */
  function rule(tab, key, t) {
    const cfg = TABS[tab];
    if (!cfg.bottles.includes(key)) return 'Diese Lösung gehört nicht zu diesem Versuchsteil.';
    if (cfg.samples.includes(key)) {
      if (isEmpty(t)) return null;
      // dieselbe Probelösung darf jederzeit nachgegeben werden (1.1.0), eine andere nicht
      if (t.sample !== key) return 'In diesem Reagenzglas ist schon eine andere Probe. Nimm ein leeres Reagenzglas.';
      return null;
    }
    if (isEmpty(t)) return 'Gib zuerst eine Probelösung in das Reagenzglas.';
    if (key === 'agno3') return null;
    if (key === 'nh3dil' || key === 'nh3conc') return t.log.agV > 0 ? null : 'Ammoniaklösung kommt erst zu einem Ansatz mit Silbernitratlösung.';
    if (key === 'water') return null;
    return 'Dieser Vorgang ist hier nicht vorgesehen.';
  }

  // ------------------------------------------------------------------ Labor (Bedienablauf)
  function makeTab(id) {
    const cfg = TABS[id];
    return { id, counter: 0, visible: cfg.startTubes, sel: null, tubes: Array.from({ length: cfg.maxTubes }, (_, i) => makeTube(i)), archive: [], waste: emptyWaste() };
  }

  function emptyWaste() { return { V: 0, Na: 0, NO3: 0, Ag: 0, X: 0, N: 0, F: 0, solid: 0 }; }
  /** Glas aus dem Ständer nehmen: nachfolgende Gläser rücken auf, Kennungen wandern mit ihrem Inhalt. */
  function spliceTube(tb, slot) {
    tb.tubes.splice(slot, 1);
    tb.tubes.push(makeTube(tb.tubes.length));
    tb.tubes.forEach((t, i) => { t.slot = i; });
    tb.visible = Math.max(1, tb.visible - 1);
    if (tb.sel === slot) tb.sel = Math.min(slot, tb.visible - 1);
    else if (tb.sel != null && tb.sel > slot) tb.sel--;
  }

  function create(saved) {
    const st = {
      v: 1, time: 0, speed: 1, tab: 'main', worldW: 1000, scale: 0.6,
      tabs: { main: makeTab('main'), control: makeTab('control') },
      sampleVol: { main: 2, control: 2 },
      pip: { key: null, tab: null, phase: 'rest', x: 0, y: 0, from: null, to: null, t: 0, dur: 0, over: null, content: 0, next: null },
      drops: [], hold: null, stream: null, burst: null, lastDrop: -1, uid: 1, events: [], pour: null, reduced: false
    };
    if (saved) restore(st, saved);

    const tabState = (id) => st.tabs[id || st.tab];
    const cfg = (id) => TABS[id || st.tab];
    const emit = (type, data) => { st.events.push(Object.assign({ type }, data || {})); if (st.events.length > 50) st.events.shift(); };
    const busy = () => !!st.pour || !!st.pip.autoReturn || st.pip.phase === 'move' || st.pip.phase === 'lift' || st.pip.phase === 'back' || !!st.stream || !!st.hold || !!st.burst || st.drops.length > 0 ||
      Object.values(st.tabs).some((tb) => tb.tubes.some((t) => t.shake > 0));
    /** Bedienen beendet die Pause (SiVex-Regel 4). */
    function wake() { if (st.speed === 0) { st.speed = 1; emit('toast', { text: 'Pause beendet – die Zeit läuft wieder mit 1×.' }); } }

    // ---------------- Positionen
    function layout(tab) { return G.bottleLayout(tab || st.tab, st.worldW, st.scale); }
    function bottlePos(key, tab) { const b = layout(tab).bottles[key]; return b ? b.x : st.worldW / 2; }
    function tubePos(slot, tab) { const tb = tabState(tab); return G.tubeX(slot, tb.visible, st.worldW); }
    function restPos(key, tab) { const b = layout(tab).bottles[key]; const p = G.pipetteRest(b ? b.x : st.worldW / 2, b && b.h); return { x: p.x, y: p.y }; }
    function heldPos(key, tab) { const p = restPos(key, tab); return { x: p.x, y: p.y - G.LIFT }; }
    function overPos(slot, tab) { const p = G.pipetteOver(tubePos(slot, tab)); return { x: p.x, y: p.y }; }
    function moveTo(to, phase, then) {
      const p = st.pip;
      const d = Math.hypot(to.x - p.x, to.y - p.y);
      Object.assign(p, { phase, from: { x: p.x, y: p.y }, to, t: 0, dur: Math.max(T.minMove, d / T.moveSpeed), next: then || null });
    }
    function placePipette() {
      const p = st.pip;
      if (!p.key) return;
      if (p.phase === 'over' && p.over != null) Object.assign(p, overPos(p.over, p.tab));
      else if (p.phase === 'held') Object.assign(p, heldPos(p.key, p.tab));
    }

    // ---------------- Pipette
    function stopFlow() { st.hold = null; st.stream = null; st.burst = null; }
    function forbidden(reason) {
      const p = st.pip;
      emit('forbidden', { text: 'Dieser Vorgang entspricht nicht der Experimentieranleitung.', reason, x: p.x, y: p.y });
    }
    /** Flasche antippen: Pipette aufnehmen; erneutes Antippen der gleichen Flasche stellt sie zurück. */
    function selectBottle(key) {
      if (!cfg().bottles.includes(key)) return false;
      wake();
      const p = st.pip;
      if (p.key === key && p.tab === st.tab) { returnPipette(); return true; }
      if (p.key) { stopFlow(); landAll(); }
      p.autoReturn = false;
      const r = restPos(key, st.tab);
      Object.assign(p, { key, tab: st.tab, over: null, x: r.x, y: r.y, content: 1 });
      moveTo(heldPos(key, st.tab), 'lift', 'held');
      return true;
    }
    /** Pipetteninhalt in eine Vorratsflasche geben: nicht vorgesehen, kein Stofftransfer. */
    function toBottle(key) {
      if (!st.pip.key || st.pip.tab !== st.tab) return false;
      wake();
      forbidden(key === st.pip.key ? 'Die Pipette wird nur zum Zugeben in Reagenzgläser benutzt.' : 'Lösungen werden nicht in Vorratsflaschen umgefüllt.');
      return false;
    }
    function returnPipette() {
      const p = st.pip;
      p.autoReturn = false;
      if (!p.key) return;
      stopFlow();
      moveTo(restPos(p.key, p.tab), 'back', 'rest');
    }
    /** Reagenzglas als Ziel wählen. Proben laufen sofort mit dem eingestellten Volumen aus. */
    function target(slot) {
      const tb = tabState();
      const t = tb.tubes[slot];
      if (!t || slot >= tb.visible) return false;
      tb.sel = slot;
      const p = st.pip;
      if (st.pour && st.pour.tab === st.tab && st.pour.slot === slot) { emit('toast', { text: 'Dieses Glas wird gerade ausgegossen.' }); return false; }
      if (!p.key || p.tab !== st.tab) return 'select';
      wake();
      const reason = rule(st.tab, p.key, t);
      if (reason) { forbidden(reason); return false; }
      if (p.phase === 'over' && p.over === slot) {
        if (isSampleKey(p.key)) return startSample(slot);
        return dropOnce();
      }
      stopFlow();
      p.autoReturn = false;
      p.over = slot;
      moveTo(overPos(slot, st.tab), 'move', 'over');
      if (isSampleKey(p.key)) p.pending = { kind: 'sample' }; else p.pending = null;
      return true;
    }
    const isSampleKey = (key) => cfg().samples.includes(key);
    function ready() { const p = st.pip; return p.key && p.tab === st.tab && p.phase === 'over' && p.over != null; }
    function inflight(tab, slot) { return st.drops.filter((d) => d.tab === tab && d.slot === slot).reduce((s, d) => s + d.vol, 0); }
    function fits(slot, vol) {
      const t = tabState(st.pip.tab).tubes[slot];
      return t.V + inflight(st.pip.tab, slot) + vol <= C.CAPACITY_ML + 1e-9;
    }
    function full() { stopFlow(); emit('full', { slot: st.pip.over, text: 'Reagenzglas ist voll.' }); }
    function release(stream) {
      const p = st.pip;
      const t = tabState(p.tab).tubes[p.over];
      const reason = rule(p.tab, p.key, t);
      if (reason) { stopFlow(); forbidden(reason); return false; }
      if (!fits(p.over, C.DROP_ML)) { full(); return false; }
      if (!t.ansatz && isSampleKey(p.key)) { const tb = tabState(p.tab); tb.counter++; t.ansatz = TABS[p.tab].prefix + tb.counter; }
      const xoff = stream ? 0 : (Math.random() - 0.5) * 0.18;
      st.drops.push({ id: st.uid++, tab: p.tab, slot: p.over, key: p.key, vol: C.DROP_ML, t: 0, x: p.x, y0: p.y + 8, xoff, stream: !!stream });
      st.lastDrop = st.time;
      p.squeeze = 1;
      return true;
    }
    /** Ein Tropfen (Tippen). Schnelles Tippen wird auf das Mindestintervall begrenzt. */
    function dropOnce() {
      if (!ready() || isSampleKey(st.pip.key)) return false;
      wake();
      if (st.stream || st.burst) return false;
      if (st.time - st.lastDrop < T.tapMin) return false;
      return release(false);
    }
    /** Gedrückthalten: erster Tropfen sofort, dann begrenzte Folge einzelner Tropfen. */
    function startHold() {
      if (!ready() || isSampleKey(st.pip.key)) return false;
      wake();
      if (st.hold || st.stream || st.burst) return false;
      const ok = st.time - st.lastDrop >= T.tapMin ? release(false) : true;
      if (ok) st.hold = { next: st.time + T.holdFirst };
      return ok;
    }
    function stopHold() { st.hold = null; }
    /** Mehrere Tropfen nacheinander (z. B. 5 Tropfen für vergleichbare Mengen). */
    function drops(n) {
      if (!ready() || isSampleKey(st.pip.key)) return false;
      wake();
      if (st.hold || st.stream || st.burst) return false;
      if (!release(false)) return false;
      if (n > 1) st.burst = { left: n - 1, next: st.time + T.holdEvery };
      return true;
    }
    /** Dosierhilfe: größere Menge (mL) sichtbar als Strahl aus der Pipette. */
    function dose(vol) {
      if (!ready() || isSampleKey(st.pip.key)) return false;
      wake();
      if (st.hold || st.stream || st.burst) return false;
      st.stream = { left: Math.round(vol / C.DROP_ML), rate: T.flowHelper, acc: 0 };
      return true;
    }
    function startSample(slot) {
      const p = st.pip;
      if (st.stream) return false;
      const t = tabState(p.tab).tubes[slot];
      const reason = rule(p.tab, p.key, t);
      if (reason) { forbidden(reason); return false; }
      const vol = st.sampleVol[p.tab] || 2;
      if (!fits(slot, vol)) { full(); return false; }
      st.stream = { left: Math.round(vol / C.DROP_ML), rate: T.flowSample, acc: 0, sample: true };
      return true;
    }

    // ---------------- Tropfen und Buchung beim Eintreffen
    function landDrop(d) {
      const t = st.tabs[d.tab].tubes[d.slot];
      const formed = book(d.tab, t, d.key, d.vol, d.xoff);
      emit('land', { tab: d.tab, slot: d.slot, key: d.key, vol: d.vol, xoff: d.xoff, stream: d.stream, formed });
    }
    /** Alle Tropfen im Flug sofort ankommen lassen (Handgriff abschließen). */
    function landAll() { const ds = st.drops; st.drops = []; for (const d of ds) landDrop(d); }

    function stepPipette(dt) {
      const p = st.pip;
      // Nach dem Abgeben einer Probe kehrt die Messpipette selbst in ihre Flasche zurück,
      // sobald der letzte Anteil angekommen ist (erneutes Antippen des Glases wählt es dann nur aus)
      if (p.autoReturn && p.phase === 'over' && !st.drops.some((d) => d.tab === p.tab && d.key === p.key)) { p.autoReturn = false; moveTo(restPos(p.key, p.tab), 'back', 'rest'); }
      if (p.squeeze > 0) p.squeeze = Math.max(0, p.squeeze - dt * 5);
      if (p.phase === 'lift' || p.phase === 'move' || p.phase === 'back') {
        p.t += dt;
        const k = Math.min(1, p.t / p.dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const lift = p.phase === 'move' ? Math.sin(Math.PI * k) * 40 : 0;
        p.x = p.from.x + (p.to.x - p.from.x) * e;
        p.y = p.from.y + (p.to.y - p.from.y) * e - lift;
        if (k >= 1) {
          const nx = p.next;
          p.phase = nx || 'held';
          if (p.phase === 'rest') { p.key = null; p.tab = null; p.over = null; p.content = 0; }
          if (p.phase === 'over' && p.pending && p.pending.kind === 'sample') { p.pending = null; startSample(p.over); }
        }
      }
    }
    function stepFlow(dt) {
      if (!ready()) { st.hold = null; st.burst = null; st.stream = null; return; }
      if (st.hold && st.time >= st.hold.next) { if (release(false)) st.hold && (st.hold.next = st.time + T.holdEvery); }
      if (st.burst && st.time >= st.burst.next) {
        if (release(false)) { st.burst.left--; st.burst.next = st.time + T.holdEvery; if (st.burst.left <= 0) st.burst = null; } else st.burst = null;
      }
      if (st.stream) {
        const s = st.stream;
        s.acc += dt * s.rate;
        while (st.stream && s.acc >= C.DROP_ML - 1e-12 && s.left > 0) {
          s.acc -= C.DROP_ML;
          if (!release(true)) break;
          s.left--;
        }
        if (st.stream && s.left <= 0) { st.stream = null; if (s.sample) st.pip.autoReturn = true; }
      }
    }
    function stepDrops(dt) {
      const keep = [];
      for (const d of st.drops) {
        d.t += dt;
        const t = st.tabs[d.tab].tubes[d.slot];
        const fall = 0.5 * G.GRAV * d.t * d.t;
        d.y = d.y0 + fall;
        if (d.y >= G.surfaceY(t.V)) landDrop(d); else keep.push(d);
      }
      st.drops = keep;
    }

    /** Zeitschritt in Echtzeit-Sekunden; Pause und Zeitraffer wirken hier. */
    function step(dtReal) {
      const dtr = Math.min(0.1, Math.max(0, dtReal));
      const speed = busy() ? Math.min(st.speed, 1) : st.speed;
      const dt = dtr * speed;
      if (!(dt > 0)) return 0;
      // feste Teilschritte für reproduzierbare Abläufe
      const n = Math.max(1, Math.ceil(dt / 0.02));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        st.time += h;
        stepPipette(h);
        stepFlow(h);
        stepDrops(h);
        stepPour(h);
        for (const id of Object.keys(st.tabs)) for (const t of st.tabs[id].tubes) stepTube(t, h);
      }
      return dt;
    }

    // ---------------- Weitere Handgriffe
    function shake(slot) {
      const tb = tabState();
      const t = tb.tubes[slot];
      if (!t || isEmpty(t) || pourBusy(st.tab, slot)) return false;
      wake();
      tb.sel = slot;
      shakeTube(t);
      return true;
    }
    // ---------------- Ausgießen (Spülen bzw. Entfernen eines gefüllten Glases)
    const pourBusy = (tab, slot) => !!st.pour && st.pour.tab === tab && st.pour.slot === slot;
    /** Dosierungen in dieses Glas beenden; Tropfen im Flug kommen noch an (vor Slot-Änderungen). */
    function releaseTube(tab, slot) {
      const p = st.pip;
      if (p.tab === tab && p.over === slot) stopFlow();
      landAll();
      if (p.tab === tab && p.over === slot && (p.phase === 'over' || p.phase === 'move')) { p.autoReturn = false; p.over = null; p.pending = null; p.phase = 'held'; placePipette(); }
    }
    /** Inhalt anteilig in den Silberabfall: Rest r (0…1) des Anfangsinhalts bleibt im Glas. */
    function drainTo(pr, r) {
      const t = st.tabs[pr.tab].tubes[pr.slot], w = st.tabs[pr.tab].waste, c = pr.content;
      const keep = Math.max(0, Math.min(1, r));
      const out = (pr.left - keep);
      if (!(out > 0)) return;
      w.V += c.V * out; w.solid += c.solid * out;
      for (const k of Object.keys(c.n)) w[k] += c.n[k] * out;
      pr.left = keep;
      t.V = c.V * keep;
      for (const k of Object.keys(c.n)) t.n[k] = c.n[k] * keep;
      t.susp = c.solid * keep; t.sed = 0; t.clouds = []; t.front = 0;
      t.rev++;
    }
    /** Handgriff abschließen: Glas exakt leer, Rest in den Abfall, ggf. Glas entfernen. */
    function finishPour() {
      const pr = st.pour;
      if (!pr) return false;
      drainTo(pr, 0);
      const tb = st.tabs[pr.tab];
      tb.tubes[pr.slot] = makeTube(pr.slot);
      st.pour = null;
      if (pr.remove) {
        removeSlot(pr.tab, pr.slot);
        emit('removed', { tab: pr.tab, slot: pr.slot });
      }
      emit('poured', { tab: pr.tab, slot: pr.slot, ansatz: pr.ansatz, remove: !!pr.remove });
      if (st.pip.tab === pr.tab) placePipette();
      return true;
    }
    /**
     * Glas aus dem Ständer nehmen, ohne dass Bezüge auf ein anderes Glas springen: Tropfen im Flug
     * (auch in andere Gläser, die während des Ausgießens dosiert wurden) kommen vorher in ihrem Glas an;
     * eine Pipette über einem nachrückenden Glas folgt ihm (auch mitten in der Bewegung).
     */
    function removeSlot(tab, slot) {
      landAll();
      spliceTube(st.tabs[tab], slot);
      const p = st.pip;
      if (p.tab === tab && p.over != null && p.over > slot) {
        p.over--;
        if (p.phase === 'move') p.to = overPos(p.over, tab);
      }
    }
    function stepPour(dt) {
      const pr = st.pour;
      if (!pr) return;
      pr.t += dt;
      const k = pr.t / pr.dur;
      // Ausgießphase: bei voller Bewegung 25–70 % der Dauer, sonst gleichmäßig
      const a = st.reduced ? 0 : 0.25, b = st.reduced ? 1 : 0.7;
      drainTo(pr, 1 - Math.max(0, Math.min(1, (k - a) / (b - a))));
      if (k >= 1) finishPour();
    }
    /**
     * Ausgießen beginnen. Archiviert den Ansatz genau einmal (beim Start), kippt den Feststoff mit
     * auf (Schräglage), Stoffmengen fließen anteilig in den Silberabfall. remove: Glas danach entfernen.
     */
    function pour(slot, opts) {
      const tb = tabState(), t = tb.tubes[slot];
      if (!t || slot >= tb.visible || isEmpty(t) || st.pour) return false;
      if (opts && opts.remove && tb.visible <= 1) return false;
      wake();
      releaseTube(st.tab, slot);
      const solid = solidTotal(t);
      tb.archive.push({ ansatz: t.ansatz, sample: t.sample, log: Object.assign({}, t.log), rev: t.rev, ended: Math.round(st.time), content: { V: t.V, n: Object.assign({}, t.n), solid } });
      shakeTube(t); t.shake = 0;
      st.pour = { tab: st.tab, slot, t: 0, dur: st.reduced ? T.pourReduced : T.pour, remove: !!(opts && opts.remove), ansatz: t.ansatz, left: 1, content: { V: t.V, n: Object.assign({}, t.n), solid } };
      tb.sel = slot;
      return true;
    }
    /** Spülen = Ausgießen in den Silberabfall; der Ansatz bleibt in der Ergebnisübersicht. */
    function rinse(slot) { return pour(slot, { remove: false }); }
    /**
     * „− Glas“: leeres Glas sofort entfernen; gefülltes nur mit confirmed (sonst 'confirm') und
     * dann über das Ausgießen. Mindestens ein Glas bleibt; Ergebnis 'min' am Minimum.
     */
    function removeTube(slot, confirmed) {
      const tb = tabState(), t = tb.tubes[slot];
      if (slot == null || !t || slot >= tb.visible) return false;
      if (tb.visible <= 1) return 'min';
      if (st.pour) return false;
      if (!isEmpty(t)) return confirmed ? pour(slot, { remove: true }) : 'confirm';
      wake();
      releaseTube(st.tab, slot);
      removeSlot(st.tab, slot);
      placePipette();
      emit('removed', { tab: st.tab, slot });
      return true;
    }
    function addTube() {
      const tb = tabState();
      if (tb.visible >= TABS[st.tab].maxTubes) return false;
      tb.visible++;
      placePipette();
      return true;
    }
    function setTab(id) {
      if (!TABS[id] || id === st.tab) return false;
      // laufenden Handgriff abschließen, Pipette zurück, Zeit 1×
      stopFlow(); landAll(); finishPour();
      if (st.pip.key) Object.assign(st.pip, { key: null, tab: null, phase: 'rest', over: null, content: 0 });
      if (st.speed === 0) st.speed = 1;
      st.tab = id;
      return true;
    }
    function setSpeed(v) { if (SPEEDS.includes(v)) { st.speed = v; return true; } return false; }
    function setSampleVol(v) { if (SAMPLE_VOLUMES.includes(v)) { st.sampleVol[st.tab] = v; return true; } return false; }
    /** Weltbreite und Maßstab der Bühne (Bildschirmpixel je Welteinheit) – bestimmen die Flaschenlage. */
    function setWorldWidth(W, scale) {
      const sc = scale > 0 ? scale : st.scale;
      if (Math.abs(W - st.worldW) > 0.5 || Math.abs(sc - st.scale) > 1e-6) { st.worldW = W; st.scale = sc; placePipette(); }
    }
    /** Alle Abbruchwege (Loslassen, Abbruch, Fokusverlust, Tabwechsel) enden hier. */
    function cancelInput() { st.hold = null; st.burst = null; }
    /** Fokusverlust oder verborgener Tab: jede Dosierung endet, Tropfen im Flug kommen an. */
    function cancelAll() { stopFlow(); landAll(); finishPour(); }
    function setReducedMotion(v) { st.reduced = !!v; }
    function drain() { const e = st.events; st.events = []; return e; }

    function snapshot() {
      const tabs = {};
      for (const id of Object.keys(st.tabs)) {
        const tb = st.tabs[id];
        const copy = { counter: tb.counter, visible: tb.visible, sel: tb.sel, archive: tb.archive.slice(), waste: Object.assign({}, tb.waste), tubes: tb.tubes.map((t) => {
          const o = JSON.parse(JSON.stringify(t)); delete o._eqRev; delete o._pEq; o.clouds = []; o.susp = t.susp + t.clouds.reduce((s, c) => s + c.m, 0); o.shake = 0; return o;
        }) };
        // laufendes Ausgießen gilt im Speicher als abgeschlossen (bereits archiviert, Rest im Abfall)
        const pr = st.pour;
        if (pr && pr.tab === id) {
          const c = pr.content;
          copy.waste.V += c.V * pr.left; copy.waste.solid += c.solid * pr.left;
          for (const k of Object.keys(c.n)) copy.waste[k] += c.n[k] * pr.left;
          copy.tubes[pr.slot] = makeTube(pr.slot);
          if (pr.remove) {
            copy.tubes.splice(pr.slot, 1); copy.tubes.push(makeTube(copy.tubes.length)); copy.tubes.forEach((t, i) => { t.slot = i; });
            copy.visible = Math.max(1, copy.visible - 1);
            if (copy.sel === pr.slot) copy.sel = Math.min(pr.slot, copy.visible - 1); else if (copy.sel != null && copy.sel > pr.slot) copy.sel--;
          }
        }
        tabs[id] = copy;
      }
      return { v: 1, time: st.time, tab: st.tab, speed: st.speed === 0 ? 1 : st.speed, sampleVol: st.sampleVol, tabs };
    }

    return {
      state: st, TABS, busy, selectBottle, returnPipette, toBottle, target, dropOnce, startHold, stopHold, drops, dose, shake, rinse, pour, removeTube, addTube,
      setTab, setSpeed, setSampleVol, setWorldWidth, setReducedMotion, cancelInput, cancelAll, finishPour, step, drain, snapshot, landAll, pourBusy,
      tube: (slot, tab) => tabState(tab).tubes[slot], tab: (id) => tabState(id),
      tubePos, bottlePos, overPos, restPos, inflight, ready, layout
    };
  }

  /** Gespeicherten Zustand übernehmen (stabil: keine Tropfen im Flug, Pipetten in den Flaschen, nicht pausiert). */
  function restore(st, s) {
    if (!s || s.v !== 1 || !s.tabs) return;
    st.time = +s.time || 0;
    st.tab = TABS[s.tab] ? s.tab : 'main';
    st.speed = SPEEDS.includes(s.speed) && s.speed > 0 ? s.speed : 1;
    if (s.sampleVol) for (const k of Object.keys(TABS)) if (SAMPLE_VOLUMES.includes(s.sampleVol[k])) st.sampleVol[k] = s.sampleVol[k];
    for (const id of Object.keys(TABS)) {
      const src = s.tabs[id];
      if (!src) continue;
      const tb = st.tabs[id];
      tb.counter = src.counter | 0;
      tb.visible = Math.min(TABS[id].maxTubes, Math.max(1, src.visible | 0 || TABS[id].startTubes));
      if (src.waste) for (const k of Object.keys(tb.waste)) tb.waste[k] = C.finite(src.waste[k]) && src.waste[k] > 0 ? src.waste[k] : 0;
      tb.sel = src.sel == null || (src.sel | 0) >= tb.visible ? null : src.sel | 0;
      tb.archive = Array.isArray(src.archive) ? src.archive : [];
      (src.tubes || []).forEach((t, i) => {
        if (i >= tb.tubes.length || !t) return;
        const d = makeTube(i);
        const num = (v) => (C.finite(v) && v > 0 ? v : 0);
        Object.assign(d, { ansatz: t.ansatz || null, sample: t.sample || null, model: t.model || null, halide: t.halide || null, V: num(t.V), rev: t.rev | 0, front: Math.min(1, num(t.front)), maxSolid: num(t.maxSolid) });
        for (const k of Object.keys(d.n)) d.n[k] = num(t.n && t.n[k]);
        for (const k of Object.keys(d.log)) d.log[k] = num(t.log && t.log[k]);
        d.susp = num(t.susp) + (Array.isArray(t.clouds) ? t.clouds.reduce((a, c) => a + num(c && c.m), 0) : 0);
        d.sed = num(t.sed);
        tb.tubes[i] = d;
      });
    }
  }

  return { TABS, SAMPLE_VOLUMES, SPEEDS, T, makeTube, book, stepTube, shakeTube, solidTotal, species, rule, turbidity, chemOf, create, isEmpty };
});
