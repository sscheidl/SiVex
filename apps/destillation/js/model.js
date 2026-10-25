/*
 * Destillation – Fachmodell (ohne DOM)
 *
 * Idealisiertes, stoff- und energiebilanztreues Modell einer einfachen
 * Destillation (docs/CHEMIE.md):
 *  - Heizpilz mit eigener Wärmekapazität: EIN/AUS schaltet die elektrische
 *    Leistung sofort, der Pilz gibt seine Wärme aber verzögert ab.
 *  - Kolbeninhalt mit Wärmekapazität; Siedetemperatur und Dampfzusammensetzung
 *    aus einem idealisierten Trennmodell mit hoher Trennschärfe (K_SHARP):
 *    Der Dampf besteht praktisch nur aus dem am niedrigsten siedenden noch
 *    vorhandenen Stoff. Reale Azeotrope (Ethanol/Wasser) werden bewusst
 *    vernachlässigt. Übergänge sind stetig.
 *  - Der Dampf erwärmt zuerst den Destillationsaufsatz (Rücklauf in den Kolben),
 *    erreicht dann Thermometer und Liebigkühler.
 *  - Kühlmantel mit Füllstand, Wassertemperatur und Durchfluss; falsch
 *    angeschlossene Schläuche füllen den Mantel nur teilweise. Was der Kühler
 *    nicht kondensieren kann, tritt am Vorstoß als Dampf aus (Verlust).
 *  - Kondensat läuft als Film durch das Innenrohr und fällt in einzelnen
 *    Tropfen (DROP_VOL) aus dem Vorstoß – in die Vorlage oder auf den Tisch.
 * Mengen in mL der reinen Stoffe (Volumenkontraktion vernachlässigt),
 * Temperaturen in °C, Leistungen in W, Zeit in s Modellzeit.
 */
(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('../../../shared/labkit/js/core.js') : root.LK.core;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.DS = root.DS || {}).model = api;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { clamp, clone } = core;

  // ------------------------------------------------------------------ Stoffdaten
  /** bp: gerundete Siedetemperatur bei ca. 1013 hPa; rho g/mL; M g/mol; dH J/mol; cp J/(g·K). */
  const SUBSTANCES = {
    P: { id: 'P', name: 'Propanon', alt: 'Aceton', bp: 56, rho: 0.784, M: 58.08, dH: 29100, cp: 2.16, flammable: true },
    E: { id: 'E', name: 'Ethanol', bp: 78, rho: 0.789, M: 46.07, dH: 38600, cp: 2.44, flammable: true },
    W: { id: 'W', name: 'Wasser', bp: 100, rho: 0.998, M: 18.02, dH: 40700, cp: 4.18, flammable: false }
  };
  const KEYS = ['P', 'E', 'W'];

  /** Genau drei Stoffgemische, je eine feste Ausgangszusammensetzung (Volumen in mL, zusammen 100 mL). */
  const MIXES = {
    ew: { id: 'ew', name: 'Ethanol + Wasser', short: 'Ethanol/Wasser', comp: { P: 0, E: 40, W: 60 }, expert: false, label: '40 mL Ethanol + 60 mL Wasser' },
    pw: { id: 'pw', name: 'Propanon (Aceton) + Wasser', short: 'Propanon/Wasser', comp: { P: 40, E: 0, W: 60 }, expert: false, label: '40 mL Propanon + 60 mL Wasser' },
    pew: { id: 'pew', name: 'Propanon + Ethanol + Wasser', short: 'Dreistoffgemisch', comp: { P: 30, E: 30, W: 40 }, expert: true, label: '30 mL Propanon + 30 mL Ethanol + 40 mL Wasser' }
  };
  const MIX_ORDER = ['ew', 'pw', 'pew'];

  // ------------------------------------------------------------------ Modellparameter
  const ROOM = 20;           // °C Raumtemperatur
  const T_TAP = 15;          // °C Leitungswasser
  const K_SHARP = 1.5;       // 1/K Trennschärfe des idealisierten Trennmodells
  const FLASK_ML = 250;      // Rundkolben
  const C_GLASS = 150;       // J/K Kolbenglas
  const C_MANTLE = 400;      // J/K Heizpilz
  const K_MF = 4.0;          // W/K Heizpilz → gefüllter Kolben
  const K_MF_DRY = 1.2;      // W/K Heizpilz → leerer Kolben
  const K_ML = 0.6;          // W/K Heizpilz → Raum
  const K_FL = 0.5;          // W/K Kolben → Raum
  const C_HEAD = 90;         // J/K Destillationsaufsatz
  const K_HV = 4.0;          // W/K Dampf → Aufsatzwand
  const K_HL = 0.25;         // W/K Aufsatz → Raum
  const UA = 3.0;            // W/K Kühlmantel voll mit Wasser
  const UA_AIR = 0.35;       // W/K Luftkühlung des Innenrohrs
  const V_JACKET = 45;       // mL Wasser im Kühlmantel
  const K_JL = 0.2;          // W/K Mantel → Raum
  const SWAP_FILL = 0.12;    // Mantelfüllung bei vertauschten Schläuchen (Wasser läuft unten durch)
  const TAU_FILM = 5;        // s Verweilzeit des Kondensatfilms im Kühler
  const DROP_VOL = 0.05;     // mL je Tropfen
  const SUPERHEAT = 6;       // K Überhitzung ohne Siedesteine bis zum Siedeverzug
  const VIOLENT_W = 110;     // W Verdampfungsleistung, ab der es heftig siedet
  const CARRY = 0.0004;      // mL/(s·W) mitgerissene Flüssigkeit bei heftigem Sieden
  const FILL_VOLUME = 100;   // mL je Befüllung
  const SAMPLE_ML = 1;       // mL Probe für die Brennprobe
  const BURN_RATE = 0.08;    // mL/s Ethanol, die in der Porzellanschale verbrennen
  const HEAT = { low: { name: 'niedrig', P: 100 }, mid: { name: 'mittel', P: 150 }, high: { name: 'hoch', P: 250 } };
  const FLOW = { low: { name: 'gering', F: 1.0 }, mid: { name: 'mittel', F: 4.0 }, high: { name: 'stark', F: 10.0 } };
  const THERMO = {
    high: { name: 'Kugel oberhalb des seitlichen Abgangs', short: 'zu hoch' },
    correct: { name: 'Kugel auf Höhe des seitlichen Abgangs', short: 'Höhe des Abgangs' },
    low: { name: 'Kugel tief im Kolbenhals', short: 'zu tief' }
  };
  const THERMO_ORDER = ['high', 'correct', 'low'];
  const ESC_WARN = 0.05, ESC_STOP_FLAM = 4, ESC_STOP_ALL = 8; // mL ausgetretener Dampf (als Flüssigkeit gerechnet)
  const MAX_FRACTIONS = 6;
  const OPS = { fill: { dur: 5 }, stones: { dur: 1.4 }, burn: { dur: 0 } };

  // ------------------------------------------------------------------ Hilfen Stoffmengen
  const zero = () => ({ P: 0, E: 0, W: 0 });
  const vol = (c) => (c ? c.P + c.E + c.W : 0);
  const add = (to, c, f) => { const k = f == null ? 1 : f; to.P += c.P * k; to.E += c.E * k; to.W += c.W * k; return to; };
  const scaled = (c, f) => ({ P: c.P * f, E: c.E * f, W: c.W * f });
  /** Entnimmt v mL gleicher Zusammensetzung (oder alles). */
  function take(c, v) {
    const V = vol(c);
    if (V <= 1e-12) return zero();
    const f = Math.min(1, v / V);
    const out = scaled(c, f);
    c.P -= out.P; c.E -= out.E; c.W -= out.W;
    for (const k of KEYS) if (c[k] < 1e-12) c[k] = 0;
    return out;
  }
  const moles = (c) => KEYS.map((k) => (c[k] * SUBSTANCES[k].rho) / SUBSTANCES[k].M);
  /** Volumenanteile. */
  const share = (c) => { const V = vol(c); return V > 1e-12 ? { P: c.P / V, E: c.E / V, W: c.W / V } : zero(); };
  const heatCap = (c) => KEYS.reduce((s, k) => s + c[k] * SUBSTANCES[k].rho * SUBSTANCES[k].cp, 0);

  /** Stoffmengenanteile der Flüssigkeit. */
  function moleFractions(c) {
    const n = moles(c);
    const s = n[0] + n[1] + n[2];
    return s > 0 ? n.map((v) => v / s) : [0, 0, 0];
  }

  /**
   * Siedetemperatur des Gemischs im idealisierten Trennmodell:
   * Σ x_i · exp(K·(T − Tb_i)) = 1  ⇒  T = −ln(Σ x_i·exp(−K·Tb_i)) / K
   * Für einen Reinstoff ergibt sich genau seine Siedetemperatur.
   */
  function boilingPoint(c) {
    const x = moleFractions(c);
    let m = Infinity;
    KEYS.forEach((k, i) => { if (x[i] > 0) m = Math.min(m, SUBSTANCES[k].bp); });
    if (!isFinite(m)) return SUBSTANCES.W.bp;
    let s = 0;
    KEYS.forEach((k, i) => { if (x[i] > 0) s += x[i] * Math.exp(-K_SHARP * (SUBSTANCES[k].bp - m)); });
    return m - Math.log(s) / K_SHARP;
  }
  /** Stoffmengenanteile im Dampf über dem siedenden Gemisch. */
  function vaporFractions(c, T) {
    const x = moleFractions(c);
    const tb = T == null ? boilingPoint(c) : T;
    const y = KEYS.map((k, i) => x[i] * Math.exp(K_SHARP * (tb - SUBSTANCES[k].bp)));
    const s = y[0] + y[1] + y[2];
    return s > 0 ? y.map((v) => v / s) : [0, 0, 1];
  }

  /** Hauptbestandteil einer Flüssigkeit (≥ 80 % Volumenanteil) oder 'mix'. */
  function mainComponent(c) {
    const V = vol(c);
    if (V < 1e-6) return null;
    for (const k of KEYS) if (c[k] / V >= 0.8) return k;
    return 'mix';
  }

  /**
   * Brennprobe (Modellvereinfachung, docs/CHEMIE.md): Ethanol-Wasser-Gemische
   * brennen bei Raumtemperatur nur, wenn genug Ethanol enthalten ist.
   * ≥ 50 % Ethanol (Volumenanteil): anhaltende bläuliche Flamme;
   * 30–50 %: kurzes Aufflackern; darunter keine anhaltende Flamme.
   */
  const BURN_LIMITS = { burns: 0.5, flicker: 0.3, out: 0.25 };
  function burnResult(c) {
    const s = share(c);
    const phi = s.E + s.P;
    if (phi >= BURN_LIMITS.burns) return 'burns';
    if (phi >= BURN_LIMITS.flicker) return 'flicker';
    return 'none';
  }

  // ------------------------------------------------------------------ Zustand
  function newReceiver(n) {
    return { n, present: true, stopper: false, c: zero(), drops: 0, t0: null, t1: null, Tmin: null, Tmax: null, readings: [], badThermo: 0 };
  }

  function initialState(opts) {
    const o = opts || {};
    return {
      v: 1, t: 0, run: o.run || 1, seq: 0,
      mix: o.mix || 'ew', expert: !!o.expert,
      charged: zero(),               // insgesamt eingefülltes Gemisch (für die Bilanz)
      flask: { c: zero(), T: ROOM },
      filled: false, stones: false, bumped: false,
      thermo: 'high',                // Startzustand: Thermometer sitzt zu hoch – Lernende prüfen und korrigieren
      hoses: { inlet: null, outlet: null },
      heater: { on: false, level: 'mid' },
      water: { on: false, level: 'mid' },
      mantleT: ROOM, headT: ROOM, reading: ROOM,
      jacket: { fill: 0, T: ROOM },
      film: zero(),                  // Kondensat im Innenrohr des Kühlers
      tip: zero(),                   // hängender Tropfen am Vorstoß
      receiver: newReceiver(1),
      fractions: [],                 // abgestellte Vorlagen (Expertenmodus)
      lost: { vapor: zero(), table: zero(), splash: zero(), sample: zero(), burned: zero() },
      escSince: zero(),              // seit dem letzten Sicherheitsstopp ausgetretener Dampf
      pipette: null,                 // { c, from }
      dish: null,                    // { c, from, result, burning, phi0, t0 }
      burnTests: [],
      drops: { seq: 0, list: [] },
      fx: { boil: 0, nucleate: 0, vapor: 0, pass: 0, cond: 0, escape: 0, condZone: 0, flow: 0, flame: 0, violent: 0, bump: 0, carry: 0, Tb: SUBSTANCES.W.bp },
      series: [], nextSample: 0,
      safety: null, warned: {}, mistakes: {}, log: [], op: null,
      history: o.history || []       // Momentaufnahmen früherer Versuche (Ergebnisübersicht)
    };
  }

  // ------------------------------------------------------------------ Sicherheitsstopps
  const SAFETY = {
    bump: {
      title: 'Sicherheitsstopp: Siedeverzug',
      text: 'Ohne Siedesteine hat sich die Flüssigkeit über ihre Siedetemperatur erhitzt, ohne zu sieden. Dann ist sie schlagartig aufgewallt und ein Teil ist herausgespritzt.',
      fix: 'Heizung bleibt aus. Lass den Kolben unter 50 °C abkühlen, gib dann Siedesteine zu und heize erneut. Siedesteine nie in heiße Flüssigkeit geben.'
    },
    closed: {
      title: 'Sicherheitsstopp: geschlossene Apparatur',
      text: 'Die Vorlage ist mit einem Stopfen verschlossen. Der entstehende Dampf kann nicht entweichen, der Druck steigt – die Glasapparatur könnte bersten.',
      fix: 'Nimm den Stopfen von der Vorlage. Eine Destillationsapparatur bleibt am Ende offen.'
    },
    vapor: {
      title: 'Sicherheitsstopp: zu viel Dampf tritt aus',
      text: 'Der Kühler kondensiert den Dampf nicht vollständig. Am Vorstoß tritt Dampf aus – bei Ethanol und Propanon brennbar, bei Wasser heiß.',
      fix: 'Heizung bleibt aus. Prüfe die Kühlung: Schläuche richtig anschließen (Wasser unten hinein, oben heraus), Kühlwasser einschalten und ausreichend Durchfluss wählen. Dann wieder heizen.'
    },
    dry: {
      title: 'Sicherheitsstopp: Kolben läuft trocken',
      text: 'Im Kolben ist kaum noch Flüssigkeit, die Heizung läuft aber weiter. Ein trocken erhitzter Kolben kann springen; Rückstände können sich zersetzen.',
      fix: 'Heizung bleibt aus. Man destilliert nie bis zur Trockne. Beginne den Versuch neu – deine Vorlagen bleiben unter „Ergebnisse“ erhalten.'
    },
    ignite: {
      title: 'Sicherheitsstopp: Zünden an der Apparatur',
      text: 'An der Destillationsapparatur wird nie gezündet: Dort sind brennbare Flüssigkeit und brennbarer Dampf. Ein Brand könnte auf die ganze Apparatur übergreifen.',
      fix: 'Entnimm eine kleine Probe aus der Vorlage, gib sie in die Porzellanschale am getrennten Prüfplatz und zünde sie nur dort an.'
    },
    hotSample: {
      title: 'Sicherheitsstopp: heißen Kolben öffnen',
      text: 'Aus dem heißen Kolben entnimmt man keine Probe: Die Apparatur müsste geöffnet werden, heißer Dampf würde austreten.',
      fix: 'Proben für die Brennprobe nimmt man aus der Vorlage – dort ist das Destillat.'
    }
  };

  // ------------------------------------------------------------------ Engine
  function createEngine(saved) {
    const bus = core.emitter();
    const st = saved && saved.v === 1 ? clone(saved) : initialState();
    const clock = core.createClock({ step });

    const msg = (text, kind, code) => {
      st.seq++;
      const e = { t: +st.t.toFixed(2), kind: kind || 'info', text, code: code || null, n: st.seq };
      st.log.push(e);
      if (st.log.length > 150) st.log.splice(0, st.log.length - 150);
      bus.emit('message', e);
      return e;
    };
    const fail = (text, code) => { msg(text, 'warn', code); return { ok: false, message: text, code }; };
    const ok = (text, extra) => { if (text) msg(text, 'info'); return Object.assign({ ok: true, message: text || '' }, extra || {}); };
    const mistake = (key) => { st.mistakes[key] = (st.mistakes[key] || 0) + 1; };
    const warnOnce = (key, text) => { if (st.warned[key]) return; st.warned[key] = st.t; mistake(key); msg(text, 'warn', key); };
    const flaskV = () => vol(st.flask.c);
    const boiling = () => st.fx.vapor > 1e-5;
    const hotFlask = () => st.flask.T > 45;

    function stop(code) {
      const s = SAFETY[code];
      st.safety = { code, title: s.title, text: s.text, fix: s.fix, t: +st.t.toFixed(1) };
      st.heater.on = false;
      mistake('safety:' + code);
      msg(s.title, 'warn', 'safety');
      bus.emit('safety', st.safety);
      return { ok: false, safety: true, message: s.title, code };
    }

    // ----- Gemisch und Befüllen
    function selectMix(id) {
      const m = MIXES[id];
      if (!m) return fail('Unbekanntes Stoffgemisch.', 'mix');
      if (m.expert && !st.expert) return fail('Das Dreistoffgemisch gibt es im Expertenmodus.', 'noExpert');
      if (st.mix === id) return ok('');
      if (st.filled || st.charged.P + st.charged.E + st.charged.W > 0) return fail('Der Kolben ist schon befüllt. Für ein anderes Gemisch den Versuch neu beginnen.', 'filled');
      st.mix = id;
      return ok(`Stoffgemisch gewählt: ${m.name}.`);
    }

    function fill() {
      if (st.filled) return fail('Der Kolben ist schon befüllt (100 mL). Mehr passt nicht sinnvoll in den 250-mL-Kolben.', 'filled');
      if (st.heater.on) return fail('Erst einfüllen, dann heizen: Schalte die Heizung aus.', 'heaterOn');
      if (st.flask.T > 40 || st.mantleT > 45) return fail('Der Heizpilz ist noch warm. Lass ihn abkühlen, bevor du einfüllst.', 'hot');
      st.op = { type: 'fill', t: 0, dur: OPS.fill.dur, done: 0 };
      return ok(`${MIXES[st.mix].label} werden mit einem Trichter durch den Aufsatz in den Rundkolben gefüllt. Das Thermometer ist dafür kurz herausgenommen.`);
    }

    function addStones() {
      if (st.stones) return fail('Im Kolben sind schon Siedesteine.', 'stones');
      if (st.flask.T > 50) {
        mistake('stonesHot');
        return fail('Halt: Siedesteine nie in heiße Flüssigkeit geben – sie kann schlagartig aufschäumen und herausspritzen. Erst unter 50 °C abkühlen lassen.', 'stonesHot');
      }
      st.op = { type: 'stones', t: 0, dur: OPS.stones.dur };
      return ok('Zwei, drei Siedesteine werden durch den Aufsatz in den Kolben gegeben.');
    }

    // ----- Thermometer
    function setThermo(pos) {
      if (!THERMO[pos]) return fail('Unbekannte Thermometerposition.', 'thermo');
      if (pos === st.thermo) return ok('');
      if (st.heater.on || boiling() || st.fx.pass > 1e-4) return fail('Zum Verstellen des Thermometers die Heizung ausschalten und warten, bis nichts mehr siedet – sonst tritt am Thermometeradapter heißer Dampf aus.', 'thermoHot');
      st.thermo = pos;
      return ok(`Thermometer verschoben: ${THERMO[pos].name}.`);
    }
    function thermoUp() { const i = THERMO_ORDER.indexOf(st.thermo); return i > 0 ? setThermo(THERMO_ORDER[i - 1]) : fail('Höher geht es nicht: Das Thermometer steckt schon kaum noch im Aufsatz.', 'thermoTop'); }
    function thermoDown() { const i = THERMO_ORDER.indexOf(st.thermo); return i < 2 ? setThermo(THERMO_ORDER[i + 1]) : fail('Tiefer geht es nicht.', 'thermoBottom'); }

    // ----- Kühlwasserschläuche
    function connectHose(which, nozzle) {
      if (which !== 'inlet' && which !== 'outlet') return fail('Unbekannter Schlauch.', 'hose');
      if (nozzle !== 'low' && nozzle !== 'high') return fail('Unbekannter Anschluss.', 'nozzle');
      if (st.water.on) return fail('Erst den Wasserhahn zudrehen, dann umstecken.', 'waterOn');
      const other = which === 'inlet' ? 'outlet' : 'inlet';
      if (st.hoses[other] === nozzle) return fail(`An diesem Anschluss steckt schon der ${other === 'inlet' ? 'Zulaufschlauch (vom Wasserhahn)' : 'Ablaufschlauch (zum Ausguss)'}.`, 'nozzleTaken');
      st.hoses[which] = nozzle;
      const name = which === 'inlet' ? 'Zulaufschlauch (vom Wasserhahn)' : 'Ablaufschlauch (zum Ausguss)';
      return ok(`${name} am ${nozzle === 'low' ? 'unteren' : 'oberen'} Anschluss des Kühlers aufgesteckt.`);
    }
    function disconnectHose(nozzle) {
      if (st.water.on) return fail('Erst den Wasserhahn zudrehen, dann den Schlauch abziehen.', 'waterOn');
      const which = st.hoses.inlet === nozzle ? 'inlet' : st.hoses.outlet === nozzle ? 'outlet' : null;
      if (!which) return fail('An diesem Anschluss steckt kein Schlauch.', 'noHose');
      st.hoses[which] = null;
      return ok(`${which === 'inlet' ? 'Zulaufschlauch' : 'Ablaufschlauch'} abgezogen.`);
    }

    // ----- Heizpilz
    function setHeater(on) {
      on = !!on;
      if (on === st.heater.on) return ok('');
      if (!on) { st.heater.on = false; return ok('Heizung AUS. Der Heizpilz gibt seine Restwärme noch eine Weile ab.'); }
      if (st.safety) return fail('Erst den Sicherheitsstopp lesen und bestätigen.', 'safetyOpen');
      if (flaskV() < 1) return fail('Der Kolben ist leer – zuerst das Gemisch einfüllen.', 'empty');
      if (st.op && st.op.type === 'fill') return fail('Erst fertig einfüllen.', 'busy');
      if (st.receiver.present && st.receiver.stopper) { st.heater.on = true; return stop('closed'); }
      if (st.bumped && !st.stones) return fail('Nach dem Siedeverzug wird erst wieder geheizt, wenn Siedesteine im Kolben sind.', 'needStones');
      if (st.lastStop === 'vapor' && !st.water.on) return fail('Nach dem Dampfaustritt erst die Kühlung in Betrieb nehmen.', 'needCooling');
      if (st.lastStop === 'dry') return fail('Der Kolben ist fast leer. Beginne den Versuch neu.', 'needRestart');
      st.heater.on = true;
      if (!st.stones) mistake('noStones');
      return ok(`Heizung EIN (Stufe ${HEAT[st.heater.level].name}).`);
    }
    function setHeatLevel(level) {
      if (!HEAT[level]) return fail('Unbekannte Heizstufe.', 'level');
      st.heater.level = level;
      return ok(`Heizstufe ${HEAT[level].name}${st.heater.on ? '' : ' eingestellt (Heizung ist AUS)'}.`);
    }

    // ----- Kühlwasser
    function setWater(on) {
      on = !!on;
      if (on === st.water.on) return ok('');
      if (!on) { st.water.on = false; return ok('Kühlwasser AUS. Das Wasser im Mantel erwärmt sich jetzt.'); }
      if (!st.hoses.inlet || !st.hoses.outlet) return fail('Schließe zuerst beide Schläuche am Kühler an – sonst spritzt das Wasser aus dem offenen Ende.', 'hoseMissing');
      st.water.on = true;
      if (st.hoses.inlet === 'high') mistake('hosesSwapped');
      return ok(`Kühlwasser EIN (Durchfluss ${FLOW[st.water.level].name}).`);
    }
    function setFlow(level) {
      if (!FLOW[level]) return fail('Unbekannter Durchfluss.', 'flow');
      st.water.level = level;
      return ok(`Durchfluss ${FLOW[level].name}${st.water.on ? '' : ' eingestellt (Kühlwasser ist AUS)'}.`);
    }

    // ----- Vorlage
    function toggleReceiver() {
      const r = st.receiver;
      if (r.present) {
        r.present = false; r.stopper = false;
        if (boiling() || vol(st.film) > 0.01) mistake('noReceiver');
        return ok('Vorlage unter dem Vorstoß weggenommen.');
      }
      r.present = true;
      return ok('Vorlage wieder unter den Vorstoß gestellt.');
    }
    function toggleStopper() {
      const r = st.receiver;
      if (!r.present) return fail('Unter dem Vorstoß steht keine Vorlage.', 'noReceiver');
      if (r.stopper) { r.stopper = false; return ok('Stopfen von der Vorlage genommen – die Apparatur ist am Ende wieder offen.'); }
      r.stopper = true;
      mistake('stopper');
      if (st.heater.on || boiling() || st.flask.T > 40) return stop('closed');
      return ok('Stopfen auf die Vorlage gesetzt.');
    }
    function changeReceiver() {
      if (!st.expert) return fail('Vorlagen wechselt man im Expertenmodus.', 'noExpert');
      const r = st.receiver;
      if (vol(r.c) < 0.01) return fail('Diese Vorlage ist noch leer – ein Wechsel ist nicht nötig.', 'emptyReceiver');
      if (st.fractions.length + 1 >= MAX_FRACTIONS) return fail('Mehr Vorlagen stehen nicht bereit.', 'maxFractions');
      r.present = false; r.stopper = false; r.t1 = r.t1 == null ? st.t : r.t1;
      r.changedAt = +st.t.toFixed(1);
      st.fractions.push(r);
      st.receiver = newReceiver(r.n + 1);
      st.series.push({ t: +st.t.toFixed(1), T: +st.reading.toFixed(2), F: +st.flask.T.toFixed(2), change: r.n + 1 });
      return ok(`Vorlage ${r.n} (${core.fmt(vol(r.c), 1)} mL) abgestellt, leere Vorlage ${r.n + 1} untergestellt.`);
    }

    // ----- Probe und Brennprobe
    function takeSample(source) {
      if (source === 'flask') {
        mistake('hotSample');
        if (st.flask.T > 40 || st.heater.on) return stop('hotSample');
        return fail('Der Kolben ist mit dem Aufsatz verbunden. Proben nimmt man aus der Vorlage – dort ist das Destillat.', 'flaskSample');
      }
      if (st.mix !== 'ew') return fail('Die Brennprobe gehört zum Ethanol-Wasser-Versuch.', 'noBurnTest');
      if (st.pipette) return fail('In der Pipette ist schon eine Probe. Gib sie in die Porzellanschale.', 'pipetteFull');
      const r = source && source.startsWith('fraction:') ? st.fractions.find((f) => f.n === Number(source.slice(9))) : st.receiver;
      if (!r) return fail('Unbekannte Vorlage.', 'source');
      if (vol(r.c) < 0.3) return fail('In der Vorlage ist noch zu wenig Destillat für eine Probe.', 'emptySample');
      st.pipette = { c: take(r.c, SAMPLE_ML), from: r.n };
      return ok(`Mit der Pipette ${core.fmt(vol(st.pipette.c), 1)} mL Destillat aus Vorlage ${r.n} entnommen. Gib die Probe in die Porzellanschale.`);
    }
    function sampleToDish() {
      if (!st.pipette) return fail('In der Pipette ist keine Probe. Entnimm zuerst eine Probe aus der Vorlage.', 'pipetteEmpty');
      if (st.dish && st.dish.burning) return fail('In der Schale brennt noch eine Probe.', 'burning');
      if (st.dish) add(st.lost.sample, st.dish.c);
      st.dish = { c: st.pipette.c, from: st.pipette.from, result: null, burning: false, phi0: null };
      st.pipette = null;
      return ok('Probe in die Porzellanschale am getrennten Prüfplatz gegeben. Zünde sie mit dem Stabfeuerzeug an.');
    }
    function ignite(target) {
      if (target !== 'dish') { mistake('ignite'); return stop('ignite'); }
      const d = st.dish;
      if (!d || vol(d.c) < 0.02) return fail('In der Porzellanschale ist keine Probe.', 'dishEmpty');
      if (d.burning) return fail('Die Probe brennt bereits.', 'burning');
      if (d.result) return fail('Diese Probe ist schon geprüft. Entnimm für eine neue Brennprobe eine neue Probe.', 'tested');
      const s = share(d.c);
      d.phi0 = s.E + s.P;
      d.result = burnResult(d.c);
      d.t0 = st.t;
      d.burning = d.result !== 'none';
      d.flicker = d.result === 'flicker' ? 1.6 : 0;
      st.burnTests.push({ t: +st.t.toFixed(1), from: d.from, phi: +d.phi0.toFixed(3), result: d.result, run: st.run });
      if (d.burning) st.op = { type: 'burn', t: 0, dur: 0 };
      const text = { burns: 'Die Probe brennt mit bläulicher, kaum leuchtender Flamme.', flicker: 'Die Probe flackert kurz auf und erlischt.', none: 'Die Probe lässt sich nicht entzünden – keine anhaltende Flamme.' }[d.result];
      msg(text, d.result === 'none' ? 'warn' : 'info', 'burn');
      return { ok: true, result: d.result, message: text };
    }

    function ackSafety() {
      if (!st.safety) return fail('Es liegt kein Sicherheitsstopp vor.', 'noSafety');
      st.lastStop = st.safety.code;
      st.safety = null;
      st.escSince = zero();
      st.warned.escape = null;
      return ok('Sicherheitsstopp bestätigt. Behebe die Ursache, bevor du weiter heizt.');
    }

    /** Versuch neu beginnen: Apparatur in den Startzustand, frühere Ergebnisse bleiben erhalten. */
    function restart(mix) {
      const m = mix && MIXES[mix] ? mix : st.mix;
      if (MIXES[m].expert && !st.expert) return fail('Das Dreistoffgemisch gibt es im Expertenmodus.', 'noExpert');
      const hist = st.history.slice();
      if (st.filled) { hist.push(snapshot(st)); if (hist.length > 12) hist.shift(); }
      const fresh = initialState({ run: st.run + 1, mix: m, expert: st.expert, history: hist });
      for (const k of Object.keys(st)) delete st[k];
      Object.assign(st, fresh);
      clock.reset();
      return ok(`Versuch ${st.run}: Apparatur im Startzustand, Kolben leer. Gemisch: ${MIXES[m].name}.`);
    }

    function setExpert(on) { st.expert = !!on; if (!st.expert && MIXES[st.mix].expert && !st.filled && vol(st.charged) === 0) st.mix = 'ew'; return ok(); }

    const ACTIONS = { restart, selectMix, fill, addStones, setThermo, thermoUp, thermoDown, connectHose, disconnectHose, setHeater, setHeatLevel, setWater, setFlow, toggleReceiver, toggleStopper, changeReceiver, takeSample, sampleToDish, ignite, ackSafety, setExpert };
    const DURING_SAFETY = new Set(['restart', 'ackSafety', 'setHeater', 'setHeatLevel', 'setWater', 'setFlow', 'setExpert', 'toggleStopper', 'toggleReceiver']);
    function act(name, ...args) {
      const fn = ACTIONS[name];
      if (!fn) return fail('Unbekannte Handlung ' + name, 'unknown');
      if (st.op && (st.op.type === 'fill' || st.op.type === 'stones') && !['restart', 'setHeatLevel', 'setFlow', 'setExpert', 'setWater', 'setHeater'].includes(name)) return fail('Einen Moment – der letzte Handgriff ist noch nicht fertig.', 'busy');
      if (st.safety && !DURING_SAFETY.has(name)) return fail('Erst den Sicherheitsstopp lesen und bestätigen.', 'safetyOpen');
      if (st.safety && name === 'setHeater' && args[0]) return fail('Erst den Sicherheitsstopp lesen und bestätigen.', 'safetyOpen');
      const r = fn(...args);
      st.log.push({ t: +st.t.toFixed(2), act: name, args, ok: r.ok });
      bus.emit('change', { action: name, result: r });
      return r;
    }

    // ------------------------------------------------------------------ Zeitschritt
    function recordDrop(to, c) {
      st.drops.seq++;
      st.drops.list.push({ n: st.drops.seq, t: +st.t.toFixed(3), to });
      if (st.drops.list.length > 80) st.drops.list.splice(0, st.drops.list.length - 80);
      if (to === 'receiver') {
        const r = st.receiver;
        add(r.c, c);
        r.drops++;
        if (r.t0 == null) { r.t0 = +st.t.toFixed(1); msg(r.n === 1 ? 'Die ersten Tropfen Destillat fallen in die Vorlage.' : `Erste Tropfen in Vorlage ${r.n}.`, 'info', 'firstDrop'); }
        r.t1 = +st.t.toFixed(1);
        const T = st.reading;
        r.Tmin = r.Tmin == null ? T : Math.min(r.Tmin, T);
        r.Tmax = r.Tmax == null ? T : Math.max(r.Tmax, T);
        if (r.readings.length < 3000) r.readings.push(+T.toFixed(2));
        if (st.thermo !== 'correct') r.badThermo++;
      } else {
        add(st.lost.table, c);
        warnOnce('noReceiver', 'Das Destillat tropft auf den Tisch – unter dem Vorstoß steht keine Vorlage.');
      }
    }

    function step(h) {
      st.t += h;
      const f = st.flask;
      const fx = st.fx;
      const prevFx = Object.assign({}, fx);

      // --- Handgriffe
      const op = st.op;
      if (op) {
        op.t += h;
        if (op.type === 'fill') {
          const target = FILL_VOLUME * clamp((op.t / op.dur - 0.25) / 0.6, 0, 1);
          const d = target - op.done;
          if (d > 0) {
            const m = MIXES[st.mix].comp;
            const portion = { P: (m.P / 100) * d, E: (m.E / 100) * d, W: (m.W / 100) * d };
            const C0 = heatCap(f.c) + C_GLASS, Cn = heatCap(portion);
            f.T = (f.T * C0 + ROOM * Cn) / (C0 + Cn);
            add(f.c, portion); add(st.charged, portion);
            op.done = target;
          }
          if (op.t >= op.dur - 1e-9) { st.filled = true; st.op = null; bus.emit('change', { action: 'opDone', op: 'fill' }); }
        } else if (op.type === 'stones') {
          if (op.t >= op.dur - 1e-9) { st.stones = true; st.op = null; bus.emit('change', { action: 'opDone', op: 'stones' }); }
        } else if (op.type === 'burn' && !(st.dish && st.dish.burning)) {
          st.op = null;
          bus.emit('change', { action: 'opDone', op: 'burn' });
        }
      }

      // --- Heizpilz (elektrische Leistung schaltet sofort, Wärme fließt verzögert)
      const V = flaskV();
      const Pel = st.heater.on ? HEAT[st.heater.level].P : 0;
      const kmf = V > 0.5 ? K_MF : K_MF_DRY;
      const Qmf = kmf * (st.mantleT - f.T);
      st.mantleT += ((Pel - Qmf - K_ML * (st.mantleT - ROOM)) / C_MANTLE) * h;

      // --- Kolben: Erwärmen, Sieden, Siedeverzug
      const C = heatCap(f.c) + C_GLASS;
      const Tb = V > 1e-6 ? boilingPoint(f.c) : SUBSTANCES.W.bp;
      fx.Tb = Tb;
      const net = Qmf - K_FL * (f.T - ROOM);
      const vap = zero();
      let Qboil = 0;
      fx.boil = 0; fx.nucleate = 0; fx.bump = Math.max(0, fx.bump - h);
      if (V > 1e-6) {
        const limit = Tb + (st.stones ? 0 : SUPERHEAT);
        const E = (f.T - Tb) * C + net * h; // Energie oberhalb der Siedetemperatur in diesem Schritt
        if (st.stones && E > 0) {
          // Sieden: Energie verdampft Flüssigkeit, Temperatur bleibt bei der Siedetemperatur.
          // Ist ein Stoff aufgebraucht, steigt die Siedetemperatur; übrige Energie erwärmt
          // die Flüssigkeit weiter, bis sie den nächsten Stoff zum Sieden bringt.
          let rest = E, tb = Tb, used = 0;
          for (let it = 0; it < 3 && rest > 1e-9 && vol(f.c) > 1e-9; it++) {
            const y = vaporFractions(f.c, tb);
            const dHy = KEYS.reduce((s, k, i) => s + y[i] * SUBSTANCES[k].dH, 0);
            const n = rest / dHy;
            let exhausted = false;
            KEYS.forEach((k, i) => {
              const S = SUBSTANCES[k];
              const want = (n * y[i] * S.M) / S.rho;
              const got = Math.min(f.c[k], want);
              if (got < want - 1e-15) exhausted = true;
              vap[k] += got;
              f.c[k] -= got;
              if (f.c[k] < 1e-12) f.c[k] = 0;
              const q = ((got * S.rho) / S.M) * S.dH;
              rest -= q; used += q;
            });
            if (!exhausted || vol(f.c) < 1e-9) break;
            const next = boilingPoint(f.c);
            const Ceff = heatCap(f.c) + C_GLASS;
            if (tb + rest / Ceff < next) break;
            rest -= (next - tb) * Ceff;
            tb = next;
          }
          f.T = tb + Math.max(0, rest) / (heatCap(f.c) + C_GLASS);
          Qboil = used / h;
          fx.boil = clamp(Qboil / 120, 0.08, 1.4);
        } else if (f.T + (net * h) / C >= limit && !st.stones && net > 0) {
          // Siedeverzug: schlagartiges Aufsieden der überhitzten Flüssigkeit
          f.T += (net * h) / C;
          const Eex = (f.T - Tb) * C;
          const y = vaporFractions(f.c, Tb);
          const dHy = KEYS.reduce((s, k, i) => s + y[i] * SUBSTANCES[k].dH, 0);
          const n = Eex / dHy;
          KEYS.forEach((k, i) => { const S = SUBSTANCES[k]; const got = Math.min(f.c[k], (n * y[i] * S.M) / S.rho); vap[k] = got; f.c[k] -= got; });
          Qboil = Eex / h;
          f.T = Tb;
          add(st.lost.splash, take(f.c, Math.min(4, vol(f.c) * 0.04)));
          st.bumped = true;
          fx.bump = 1.5;
          stop('bump');
        } else {
          f.T += (net * h) / C;
          if (st.stones && net > 0 && f.T > Tb - 10) fx.nucleate = clamp((f.T - (Tb - 10)) / 10, 0, 1) * clamp(net / 60, 0.2, 1);
        }
      } else {
        f.T += (net * h) / C;
      }

      // Heftiges Sieden: Flüssigkeit wird mitgerissen
      const violent = Qboil > VIOLENT_W ? (Qboil - VIOLENT_W) : 0;
      fx.violent = violent > 0 ? clamp(violent / 80, 0.1, 1) : 0;
      let carried = zero();
      if (violent > 0 && vol(f.c) > 1) {
        carried = take(f.c, CARRY * violent * h);
        warnOnce('violent', 'Heftiges Sieden: Die Heizleistung ist zu hoch. Flüssigkeit aus dem Kolben wird mitgerissen und verunreinigt das Destillat.');
      }
      fx.carry = vol(carried) / h;

      // --- Destillationsaufsatz: Dampf erwärmt zuerst die Glaswand (Rücklauf)
      const nVap = KEYS.reduce((s, k) => s + (vap[k] * SUBSTANCES[k].rho) / SUBSTANCES[k].M, 0);
      const dHv = nVap > 0 ? KEYS.reduce((s, k) => s + (vap[k] * SUBSTANCES[k].rho / SUBSTANCES[k].M) * SUBSTANCES[k].dH, 0) / nVap : 0;
      const Qv = (nVap * dHv) / h; // W Dampfstrom in den Aufsatz
      const Tv = Tb;
      let pass = zero(), Qpass = 0;
      if (Qv > 0) {
        const Qhead = Math.min(Qv, K_HV * Math.max(0, Tv - st.headT));
        const fPass = 1 - Qhead / Qv;
        pass = scaled(vap, fPass);
        // Rücklauf: an der kühleren Aufsatzwand kondensierte Flüssigkeit läuft in den Kolben zurück
        // (ihre Kondensationswärme hat den Aufsatz erwärmt und geht über ihn an die Luft).
        // Letzte Reste eines aufgebrauchten Stoffs ziehen mit dem Dampf weiter, statt endlos
        // zwischen Kolben und Aufsatz zu pendeln.
        for (const k of KEYS) {
          if (f.c[k] === 0 && vap[k] > 0) pass[k] = vap[k];
          else f.c[k] += vap[k] * (1 - fPass);
        }
        Qpass = Qv * fPass;
        st.headT += ((Qhead - K_HL * (st.headT - ROOM)) / C_HEAD) * h;
      } else {
        st.headT += ((-K_HL * (st.headT - ROOM)) / C_HEAD) * h;
      }
      fx.vapor = vol(vap) / h;
      fx.pass = vol(pass) / h;
      if (Qpass > 0 && st.heater.on && st.receiver.present && st.receiver.stopper && !st.safety) stop('closed');

      // --- Kühlmantel
      const connected = !!(st.hoses.inlet && st.hoses.outlet);
      const correct = st.hoses.inlet === 'low' && st.hoses.outlet === 'high';
      const F = st.water.on && connected ? FLOW[st.water.level].F : 0;
      const fillTarget = F > 0 ? (correct ? 1 : SWAP_FILL) : (connected ? st.jacket.fill : 0);
      const j = st.jacket;
      const rate = F > 0 ? F / V_JACKET : connected ? 0 : 0.5;
      if (j.fill < fillTarget) j.fill = Math.min(fillTarget, j.fill + rate * h);
      else if (j.fill > fillTarget) j.fill = Math.max(fillTarget, j.fill - Math.max(rate, 0.3) * h);
      fx.flow = F;
      const Cj = Math.max(5, j.fill * V_JACKET * 4.18);
      const cap = Qpass > 0 ? UA * j.fill * Math.max(0, Tv - j.T) + UA_AIR * (1 - j.fill) * Math.max(0, Tv - ROOM) : 0;
      const Qc = Math.min(Qpass, cap);
      const fc = Qpass > 0 ? Qc / Qpass : 0;
      const Qwater = Qpass > 0 ? UA * j.fill * Math.max(0, Tv - j.T) * (Qc / Math.max(cap, 1e-9)) : 0;
      if (j.fill > 0.01) j.T += ((Qwater - F * 4.18 * (j.T - T_TAP) - K_JL * (j.T - ROOM)) / Cj) * h;
      else j.T += (ROOM - j.T) * (1 - Math.exp(-h / 20));
      fx.cond = (vol(pass) * fc) / h;
      fx.condZone = Qpass > 0 ? clamp(Qpass / Math.max(cap, 1e-9), 0.08, 1) : Math.max(0, fx.condZone - h * 0.2);
      add(st.film, pass, fc);
      add(st.film, carried);
      const esc = scaled(pass, 1 - fc);
      add(st.lost.vapor, esc); add(st.escSince, esc);
      fx.escape = vol(esc) / h;
      if (fx.escape > 1e-5) {
        if (!st.warned.escape && vol(st.escSince) > ESC_WARN) { st.warned.escape = st.t; mistake('escape'); msg('Am Vorstoß tritt Dampf aus: Der Kühler kondensiert nicht alles. Prüfe Kühlwasser und Schläuche.', 'warn', 'escape'); }
        const flam = st.escSince.P + st.escSince.E;
        if (!st.safety && (flam > ESC_STOP_FLAM || vol(st.escSince) > ESC_STOP_ALL)) stop('vapor');
      } else if (st.warned.escape && st.t - st.warned.escape > 60) st.warned.escape = null;

      // --- Kondensatfilm → Vorstoß → Tropfen
      const outV = vol(st.film) < 1e-4 ? vol(st.film) : vol(st.film) * (1 - Math.exp(-h / TAU_FILM));
      add(st.tip, take(st.film, outV));
      let guard = 0;
      while (vol(st.tip) >= DROP_VOL - 1e-12 && guard++ < 50) {
        const d = take(st.tip, DROP_VOL);
        recordDrop(st.receiver.present ? 'receiver' : 'table', d);
      }

      // --- Thermometer: misst dort, wo seine Kugel sitzt
      // Am Abgang umströmt der Dampf die Kugel, sobald er den Aufsatz passiert
      const passFrac = Qv > 0 ? Qpass / Qv : 0;
      st.passS = (st.passS || 0) + (passFrac - (st.passS || 0)) * (1 - Math.exp(-h / 2));
      const local = st.headT + (Tv - st.headT) * Math.min(1, st.passS * 3);
      let target, tau;
      if (st.thermo === 'correct') { target = local - 0.2 * st.passS; tau = 6; }
      else if (st.thermo === 'high') { target = ROOM + (local - ROOM) * 0.72; tau = 30; }
      else {
        // im Kolbenhals: nahe an der heißen Flüssigkeit, von Spritzern getroffen, Strahlung des Heizpilzes
        const near = 0.5 * st.headT + 0.5 * f.T;
        target = near + (f.T + 2 + 0.05 * Math.max(0, st.mantleT - f.T) - near) * Math.min(1, st.passS * 3 + (fx.boil > 0 ? 0.5 : 0));
        tau = 6;
      }
      if (st.op && st.op.type === 'fill') { target = ROOM; tau = 8; }
      st.reading += (target - st.reading) * (1 - Math.exp(-h / tau));

      // --- Brennprobe in der Porzellanschale
      const d = st.dish;
      fx.flame = 0;
      if (d && d.burning) {
        if (d.result === 'flicker') {
          d.flicker -= h;
          const b = Math.min(d.c.E, 0.02 * h);
          d.c.E -= b; st.lost.burned.E += b;
          fx.flame = clamp(d.flicker / 1.6, 0, 1) * 0.5;
          if (d.flicker <= 0) d.burning = false;
        } else {
          const s = share(d.c);
          const b = Math.min(d.c.E, BURN_RATE * h);
          d.c.E -= b; st.lost.burned.E += b;
          fx.flame = clamp((s.E - BURN_LIMITS.out) / 0.25, 0.25, 1);
          if (s.E < BURN_LIMITS.out || d.c.E < 0.005) { d.burning = false; msg('Die Flamme ist erloschen. In der Schale bleibt vor allem Wasser zurück.', 'info', 'burnOut'); }
        }
      }

      // --- Sicherheit: Trockenlauf
      const Vn = flaskV();
      if (st.filled && st.heater.on && !st.safety) {
        if (Vn < 15) warnOnce('lowVolume', 'Im Kolben ist nur noch wenig Flüssigkeit. Man destilliert nie bis zur Trockne – Heizung rechtzeitig ausschalten.');
        if (Vn < 4) stop('dry');
      }

      // --- Anzeigewerte glätten (Sieden und Tropfen wechseln von Schritt zu Schritt)
      const a = 1 - Math.exp(-h / 0.8);
      for (const k of ['boil', 'nucleate', 'vapor', 'pass', 'cond', 'escape', 'violent', 'carry']) fx[k] = prevFx[k] + (fx[k] - prevFx[k]) * a;
      if (fx.vapor < 1e-7) fx.vapor = 0;
      if (fx.escape < 1e-7) fx.escape = 0;

      // --- Messreihe (Temperatur-Zeit-Diagramm)
      if (st.t >= st.nextSample - 1e-9) {
        st.series.push({ t: +st.t.toFixed(1), T: +st.reading.toFixed(2), F: +f.T.toFixed(2) });
        st.nextSample = st.t + 2;
        if (st.series.length > 4000) st.series = st.series.filter((p, i) => i % 2 === 0 || p.change);
      }
    }

    // ------------------------------------------------------------------ Auswertungshilfen
    function totals() {
      const t = zero();
      add(t, st.flask.c); add(t, st.film); add(t, st.tip); add(t, st.receiver.c);
      st.fractions.forEach((r) => add(t, r.c));
      Object.values(st.lost).forEach((c) => add(t, c));
      if (st.pipette) add(t, st.pipette.c);
      if (st.dish) add(t, st.dish.c);
      return t;
    }
    function balance() {
      const t = totals();
      const err = Math.max(...KEYS.map((k) => Math.abs(t[k] - st.charged[k])));
      return { charged: clone(st.charged), totals: t, error: err, ok: err < 1e-6 };
    }

    return {
      state: st, act, step, clock, on: bus.on,
      busy: () => !!(st.op && st.op.type !== 'burn'),
      advance: (sec) => clock.advance(sec),
      balance, totals
    };
  }

  // ------------------------------------------------------------------ Versuchsübersicht (für Aufgaben und Ergebnisse)
  function median(a) {
    if (!a || !a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function quantile(a, q) {
    if (!a || !a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
  }
  function fractionInfo(r, st) {
    const V = vol(r.c);
    const tests = st.burnTests.filter((b) => b.from === r.n && b.run === st.run);
    return {
      n: r.n, vol: V, c: clone(r.c), share: share(r.c), main: mainComponent(r.c), drops: r.drops,
      t0: r.t0, t1: r.t1, Tmin: r.Tmin, Tmax: r.Tmax, Tmed: median(r.readings), T10: quantile(r.readings, 0.1), T90: quantile(r.readings, 0.9),
      thermoOk: r.drops > 0 ? r.badThermo / r.drops < 0.2 : null, badThermo: r.badThermo,
      burn: tests.length ? tests[tests.length - 1].result : null, current: r === st.receiver, changedAt: r.changedAt || null
    };
  }
  /** Momentaufnahme eines Versuchs: alle Vorlagen, Messwerte, Fehler (nur lesen). */
  function snapshot(st) {
    const all = st.fractions.concat([st.receiver]).filter((r) => r.drops > 0 || vol(r.c) > 0 || r === st.receiver);
    const fr = all.map((r) => fractionInfo(r, st));
    const collected = fr.reduce((s, f) => s + f.vol, 0);
    const maxT = st.series.reduce((m, p) => Math.max(m, p.T), -Infinity);
    return {
      run: st.run, mix: st.mix, t: st.t, filled: st.filled, stones: st.stones,
      fractions: fr, collected,
      lostVapor: vol(st.lost.vapor), lostTable: vol(st.lost.table), lostSplash: vol(st.lost.splash),
      burnTests: st.burnTests.filter((b) => b.run === st.run),
      mistakes: clone(st.mistakes), thermo: st.thermo, maxReading: isFinite(maxT) ? maxT : st.reading,
      condensed: st.drops.seq > 0, dropCount: st.drops.seq
    };
  }

  return {
    SUBSTANCES, KEYS, MIXES, MIX_ORDER, HEAT, FLOW, THERMO, THERMO_ORDER, SAFETY, OPS,
    ROOM, T_TAP, K_SHARP, FLASK_ML, FILL_VOLUME, DROP_VOL, SUPERHEAT, VIOLENT_W, SWAP_FILL, SAMPLE_ML, BURN_LIMITS, MAX_FRACTIONS,
    ESC_WARN, ESC_STOP_FLAM, ESC_STOP_ALL,
    zero, vol, share, take, moleFractions, boilingPoint, vaporFractions, mainComponent, burnResult, heatCap,
    initialState, newReceiver, createEngine, snapshot, median
  };
});
