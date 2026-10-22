/*
 * Trennlabor – Modell „Destillation Ethanol/Wasser“ (ohne DOM)
 *
 * Didaktisch vereinfachtes, stetiges und stoffbilanztreues Modell
 * (docs/CHEMIE.md, Abschnitt 4):
 *  - Siedetemperatur des Gemischs und Dampfzusammensetzung aus tabellierten
 *    Gleichgewichtsdaten bei 101,3 kPa (lineare Interpolation). Das Azeotrop
 *    (≈ 95,6 % Massenanteil) wird bewusst vernachlässigt: Oberhalb von
 *    x = 0,75 wird linear zu reinem Ethanol (78 °C) interpoliert.
 *  - Einstufige („einfache“) Destillation: Der Dampf hat stets die
 *    Gleichgewichtszusammensetzung zum aktuellen Kolbeninhalt (Rayleigh).
 *  - Energiebilanz: Heizleistung minus Wärmeverlust erwärmt den Kolben bis zur
 *    Siedetemperatur; danach verdampft sie Flüssigkeit.
 *  - Der Dampf muss erst den Aufsatz erwärmen, bevor er Thermometer und Kühler
 *    erreicht; der Kühler kondensiert nur so viel, wie seine Kühlleistung erlaubt.
 * Volumina in mL, Volumenkontraktion beim Mischen vernachlässigt.
 */
(function (root, factory) {
  const util = typeof module === 'object' && module.exports ? require('../util.js') : root.TL.util;
  const api = factory(util);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).distill = api;
})(typeof self !== 'undefined' ? self : this, function (util) {
  'use strict';
  const { clamp, interp, clone, fmt } = util; // eslint-disable-line no-unused-vars

  const H = 0.1;
  const ROOM = 20;
  const RHO_E = 0.789, M_E = 46.07, RHO_W = 0.998, M_W = 18.02;
  const DH_E = 38600, DH_W = 40700; // J/mol am Siedepunkt
  const MIX_PHI = 0.4; // Ausgangsgemisch: 40 % Ethanol (Volumenanteil)
  const PORTION = 25; // mL je Einfüllen
  const MAX_FILL = 150; // mL (Rundkolben 250 mL höchstens zu etwa zwei Dritteln füllen)

  // Siedetemperatur (°C) über Stoffmengenanteil x(Ethanol) in der Flüssigkeit
  const BUBBLE = [[0, 100], [0.019, 95.5], [0.0721, 89.0], [0.0966, 86.7], [0.1238, 85.3], [0.1661, 84.1], [0.2337, 82.7],
    [0.2608, 82.3], [0.3273, 81.5], [0.3965, 80.7], [0.5079, 79.8], [0.5732, 79.3], [0.6763, 78.74], [0.7472, 78.41], [1, 78.0]];
  // Stoffmengenanteil Ethanol im Dampf y(x)
  const VAPOR = [[0, 0], [0.019, 0.17], [0.0721, 0.3891], [0.0966, 0.4375], [0.1238, 0.4704], [0.1661, 0.5089], [0.2337, 0.5445],
    [0.2608, 0.558], [0.3273, 0.5826], [0.3965, 0.6122], [0.5079, 0.6564], [0.5732, 0.6841], [0.6763, 0.7385], [0.7472, 0.7815], [1, 1]];

  const HEAT_W = [0, 30, 90, 150, 260]; // Heizpilz-Stufen (W)
  const HEAT_NAMES = ['aus', 'Stufe 1 (schwach)', 'Stufe 2', 'Stufe 3', 'Stufe 4 (maximal)'];
  const COOL_W = [12, 90, 220, 400]; // Kühlleistung (W) je Durchfluss; 0 = nur Luftkühlung
  const COOL_NAMES = ['aus', 'schwach', 'mittel', 'stark'];
  const HEAD_WARM_J = 3000;
  const ESC_WARN = 0.5, ESC_STOP = 4; // mL Ethanol, die als Dampf austreten

  const xOf = (E, W) => {
    const nE = E * RHO_E / M_E, nW = W * RHO_W / M_W;
    return nE + nW > 0 ? nE / (nE + nW) : 0;
  };
  const bubbleT = (x) => interp(BUBBLE, clamp(x, 0, 1));
  const vaporY = (x) => interp(VAPOR, clamp(x, 0, 1));
  /** Volumenanteil Ethanol einer Flüssigkeit. */
  const phiOf = (c) => (c.E + c.W > 1e-9 ? c.E / (c.E + c.W) : 0);

  /**
   * Brennprobe im Modell: Bei Raumtemperatur brennt eine kleine Probe nur, wenn ihr
   * Flammpunkt darunter liegt. Ethanol-Wasser: Flammpunkt ≈ 26 °C bei 40 %,
   * ≈ 24 °C bei 50 %, ≈ 29 °C bei 30 % (Literatur, s. CHEMIE.md). Modell:
   * ab 45 % anhaltende bläuliche Flamme, 30–45 % kurzes Aufflackern, darunter nicht.
   */
  function burnResult(phi) {
    if (phi >= 0.45) return 'burns';
    if (phi >= 0.30) return 'flicker';
    return 'none';
  }

  const empty = () => ({ E: 0, W: 0 });

  function create() {
    const ev = util.emitter();
    const st = {
      kind: 'distill', t: 0,
      parts: { mantle: false, flask: false, head: false, thermo: null, cooler: false, hoseIn: null, adapter: false, clamps: false },
      stones: false, stonesHot: false,
      flask: { E: 0, W: 0, T: ROOM },
      heater: 0, power: 0, cool: 0,
      headWarm: 0, thermoT: ROOM,
      receivers: { A: empty(), B: empty(), C: empty() },
      receiverAt: null, receiverStopper: false,
      coolerHold: empty(),
      lost: { escaped: empty(), table: empty(), leak: empty(), burned: empty(), waste: empty() },
      dish: null,
      burnTests: [],
      firstDrop: null,
      collect: [], // Messdaten während des Übergehens: {t, read, pos, receiver}
      tempLog: [],
      safety: null,
      bumps: 0,
      fx: { boil: 0, vapor: 0, drip: 0, escape: 0, leak: 0, bump: 0, flame: 0 },
      warned: {},
      log: [],
      filled: 0
    };
    const stepper = util.stepper(H, step);
    const log = (type, data) => { st.log.push(Object.assign({ t: +st.t.toFixed(1), type }, data)); };
    const msg = (text, kind) => ev.emit('message', { text, kind: kind || 'info' });
    const mistake = (key) => { log('mistake', { key }); ev.emit('mistake', { key }); };
    const fail = (text, key) => { msg(text, 'warn'); if (key) mistake(key); return { ok: false, message: text }; };
    const flaskVol = () => st.flask.E + st.flask.W;
    const hot = () => st.flask.T > 40 || st.headWarm > 0.25;

    function stop(code, title, text, fix) {
      st.safety = { code, title, text, fix, t: st.t };
      st.heater = 0;
      log('safety', { code });
      ev.emit('safety', st.safety);
      ev.emit('change', {});
      return { ok: false, safety: true, message: title };
    }
    function ackSafety() {
      if (!st.safety) return { ok: false };
      log('ack', { code: st.safety.code });
      st.safety = null;
      st.warned.esc = false;
      ev.emit('change', {});
      return { ok: true };
    }
    const blocked = () => (st.safety ? fail('Erst den Sicherheitsstopp bestätigen.') : null);

    /** Vollständig geschlossenes System: kein Weg ins Freie. */
    function closedSystem() {
      const p = st.parts;
      return p.flask && p.head && !!p.thermo && p.cooler && p.adapter && st.receiverAt && st.receiverStopper;
    }
    /** Offene Stelle, an der Dampf unkontrolliert austreten würde (vor dem Kühler). */
    function openLeak() {
      const p = st.parts;
      if (!p.head) return 'neck';
      if (!p.thermo) return 'top';
      if (!p.cooler) return 'side';
      return null;
    }

    // ---------------------------------------------------------- Aufbau
    const PART_NAMES = { mantle: 'Heizpilz', flask: 'Rundkolben', head: 'Destillationsaufsatz', thermo: 'Thermometer', cooler: 'Liebigkühler', adapter: 'Vorstoß', clamps: 'Klemmen' };
    function place(part, opt) {
      const b = blocked(); if (b) return b;
      const p = st.parts;
      switch (part) {
        case 'mantle': p.mantle = true; break;
        case 'flask': p.flask = true; break;
        case 'head':
          if (!p.flask) return fail('Setze zuerst den Rundkolben ein.');
          p.head = true; break;
        case 'thermo':
          if (!p.head) return fail('Das Thermometer gehört in den Destillationsaufsatz.');
          if (!['correct', 'high', 'deep'].includes(opt)) opt = 'correct';
          p.thermo = opt;
          if (opt !== 'correct') mistake('thermoPos');
          break;
        case 'cooler':
          if (!p.head) return fail('Der Kühler wird an den seitlichen Ansatz des Aufsatzes angeschlossen.');
          p.cooler = true; break;
        case 'hoses':
          if (!p.cooler) return fail('Schließe die Schläuche an den Kühler an – setze ihn zuerst ein.');
          p.hoseIn = opt === 'top' ? 'top' : 'bottom';
          if (p.hoseIn === 'top') mistake('hoseTop');
          break;
        case 'adapter':
          if (!p.cooler) return fail('Der Vorstoß kommt an das Ende des Kühlers.');
          p.adapter = true; break;
        case 'clamps':
          if (!p.head) return fail('Es gibt noch keine Verbindungen zum Sichern.');
          p.clamps = true; break;
        default: return fail('Unbekanntes Teil.');
      }
      log('place', { part, opt: opt || null });
      ev.emit('change', {});
      return { ok: true };
    }

    function remove(part) {
      const b = blocked(); if (b) return b;
      const p = st.parts;
      if (hot() && part !== 'clamps') return fail('Die Apparatur ist noch heiß. Erst abkühlen lassen, dann umbauen.');
      if (part === 'flask' && (p.head)) return fail('Nimm zuerst den Aufsatz ab.');
      if (part === 'head' && (p.cooler || p.thermo)) return fail('Nimm zuerst Thermometer und Kühler ab.');
      if (part === 'cooler' && (p.adapter || p.hoseIn)) return fail('Nimm zuerst Vorstoß und Schläuche ab.');
      if (part === 'flask' && flaskVol() > 0.1) return fail('Der Kolben ist gefüllt. Er bleibt eingespannt.');
      if (part === 'thermo') p.thermo = null;
      else if (part === 'hoses') { p.hoseIn = null; st.cool = 0; }
      else if (part in p) p[part] = false;
      else return fail('Unbekanntes Teil.');
      log('remove', { part });
      ev.emit('change', {});
      return { ok: true };
    }

    function fill() {
      const b = blocked(); if (b) return b;
      if (!st.parts.flask) return fail('Setze zuerst den Rundkolben ein.');
      if (st.parts.head) return fail('Gefüllt wird vor dem Aufsetzen des Destillationsaufsatzes (Trichter in den Kolbenhals).');
      if (flaskVol() + PORTION > MAX_FILL + 0.01) return fail('Der Kolben darf höchstens zu etwa zwei Dritteln gefüllt sein.');
      if (st.flask.T > 40) return fail('Nicht in einen heißen Kolben nachfüllen.');
      const E = PORTION * MIX_PHI, W = PORTION - E;
      const C0 = heatCap(), Cn = E * RHO_E * 2.44 + W * 4.18;
      st.flask.T = (st.flask.T * C0 + ROOM * Cn) / (C0 + Cn);
      st.flask.E += E; st.flask.W += W;
      st.filled += PORTION;
      log('fill', { amount: PORTION });
      ev.emit('change', {});
      return { ok: true };
    }

    function addStones() {
      const b = blocked(); if (b) return b;
      if (!st.parts.flask) return fail('Setze zuerst den Rundkolben ein.');
      if (st.stones) return fail('Im Kolben sind schon Siedesteine.');
      if (st.flask.T > 50) {
        mistake('stonesHot');
        return fail('Halt: Siedesteine nie in heiße Flüssigkeit geben – die Flüssigkeit kann schlagartig aufschäumen und herausspritzen. Erst abkühlen lassen.');
      }
      if (st.parts.head) return fail('Nimm den Aufsatz kurz ab: Siedesteine kommen durch den Kolbenhals.');
      st.stones = true;
      log('stones', {});
      ev.emit('change', {});
      return { ok: true };
    }

    function setHeater(level) {
      const b = blocked(); if (b) return b;
      level = clamp(level | 0, 0, 4);
      if (level > 0 && !st.parts.mantle) return fail('Es ist kein Heizpilz unter dem Kolben.');
      if (level > 0 && !st.parts.flask) return fail('Im Heizpilz steckt kein Kolben.');
      st.heater = level;
      log('heater', { level });
      if (level > 0 && closedSystem()) {
        return stop('closed', 'Sicherheitsstopp: geschlossene Apparatur',
          'Du wolltest eine vollständig geschlossene Apparatur erhitzen. Der entstehende Dampf kann nicht entweichen, der Druck steigt – die Glasapparatur könnte bersten.',
          'Entferne den Stopfen von der Vorlage. Eine Destillationsapparatur muss am Ende (Vorstoß/Vorlage) offen sein.');
      }
      if (level > 0 && flaskVol() < 0.5) {
        return stop('empty', 'Sicherheitsstopp: leerer Kolben',
          'Ein leerer Kolben im Heizpilz würde überhitzen.', 'Fülle zuerst das Ethanol-Wasser-Gemisch ein.');
      }
      if (level === 1 && !st.warned.weak) { st.warned.weak = true; }
      ev.emit('change', {});
      return { ok: true };
    }

    function setCooling(level) {
      const b = blocked(); if (b) return b;
      level = clamp(level | 0, 0, 3);
      if (level > 0 && !st.parts.hoseIn) return fail('Schließe zuerst die Kühlwasserschläuche an den Kühler an.');
      st.cool = level;
      log('cool', { level });
      ev.emit('change', {});
      return { ok: true };
    }

    function placeReceiver(id) {
      const b = blocked(); if (b) return b;
      if (id && !st.receivers[id]) return fail('Unbekannte Vorlage.');
      if (st.receiverAt === id) return { ok: true };
      st.receiverAt = id || null;
      st.receiverStopper = false;
      log('receiver', { id: id || null });
      ev.emit('change', {});
      return { ok: true };
    }

    function setReceiverStopper(on) {
      const b = blocked(); if (b) return b;
      if (!st.receiverAt) return fail('Unter dem Vorstoß steht keine Vorlage.');
      st.receiverStopper = !!on;
      if (on) {
        mistake('closedReceiver');
        if (st.heater > 0 || st.flask.T > 60) {
          return stop('closed', 'Sicherheitsstopp: geschlossene Apparatur',
            'Mit dem Stopfen auf der Vorlage ist die heiße Apparatur vollständig geschlossen. Der Dampf kann nicht entweichen, der Druck steigt.',
            'Nimm den Stopfen wieder ab. Eine Destillationsapparatur bleibt am Ende offen.');
        }
      }
      ev.emit('change', {});
      return { ok: true };
    }

    // ---------------------------------------------------------- Probe und Brennprobe
    function takeSample(source) {
      const b = blocked(); if (b) return b;
      if (source === 'flask') {
        if (st.flask.T > 40 || st.heater > 0) {
          return stop('hotSample', 'Sicherheitsstopp: heiße Apparatur öffnen',
            'Aus dem heißen Kolben entnimmt man keine Probe: Die Apparatur müsste geöffnet werden, heißer, brennbarer Dampf würde austreten.',
            'Proben werden aus der Vorlage genommen – das ist das Destillat. Den Kolbenrückstand erst nach dem Abkühlen prüfen.');
        }
        if (st.parts.head) return fail('Der Kolben ist mit dem Aufsatz verschlossen. Für eine Probe des Rückstands die Apparatur nach dem Abkühlen öffnen.');
        return moveSample(st.flask, 'Kolbenrückstand');
      }
      const r = st.receivers[source];
      if (!r) return fail('Unbekannte Quelle.');
      if (r.E + r.W < 0.3) { mistake('emptySample'); return fail('In dieser Vorlage ist (noch) kein Destillat.'); }
      return moveSample(r, `Vorlage ${'ABC'.indexOf(source) + 1}`, source);
    }
    function moveSample(c, label, source) {
      if (st.dish && st.dish.E + st.dish.W > 0.01) { st.lost.waste.E += st.dish.E; st.lost.waste.W += st.dish.W; }
      const v = Math.min(2, c.E + c.W);
      const f = v / (c.E + c.W);
      const s = { E: c.E * f, W: c.W * f, label, source: source || 'flask', burned: false };
      c.E -= s.E; c.W -= s.W;
      st.dish = s;
      log('sample', { source: s.source, phi: +phiOf(s).toFixed(3), vol: +v.toFixed(2) });
      msg(`${fmt(v)} mL Probe (${label}) in die Porzellanschale für die Brennprobe gegeben.`);
      ev.emit('change', {});
      return { ok: true };
    }

    function ignite(target) {
      const b = blocked(); if (b) return b;
      if (target !== 'dish') {
        mistake('igniteApparatus');
        return stop('igniteApparatus', 'Sicherheitsstopp: Zünden an der Apparatur',
          'An der Destillationsapparatur wird niemals gezündet: Dort befinden sich heißer Ethanoldampf und brennbare Flüssigkeit. Ein Brand könnte auf die ganze Apparatur übergreifen.',
          'Entnimm eine kleine Probe des Destillats in die Porzellanschale und führe die Brennprobe dort durch – getrennt von der Apparatur.');
      }
      if (!st.dish || st.dish.E + st.dish.W < 0.05) return fail('In der Porzellanschale ist keine Probe.');
      if (st.dish.burned) return fail('Diese Probe wurde schon geprüft. Entnimm eine neue Probe.');
      const phi = phiOf(st.dish);
      const result = burnResult(phi);
      const burnShare = result === 'burns' ? 1 : result === 'flicker' ? 0.25 : 0;
      const burned = st.dish.E * burnShare;
      st.dish.E -= burned; st.lost.burned.E += burned;
      st.dish.burned = true; st.dish.result = result;
      st.fx.flame = result === 'none' ? 0 : result === 'flicker' ? 2.5 : 9;
      st.burnTests.push({ t: +st.t.toFixed(1), source: st.dish.source, label: st.dish.label, phi: +phi.toFixed(3), result });
      log('burn', { source: st.dish.source, result });
      msg(result === 'burns' ? 'Die Probe brennt mit bläulicher, kaum leuchtender Flamme.' : result === 'flicker' ? 'Die Probe flackert kurz auf und erlischt.' : 'Die Probe lässt sich nicht entzünden.', result === 'none' ? 'warn' : 'info');
      if (result === 'none' && st.dish.source !== 'flask') mistake('burnFail');
      ev.emit('change', {});
      return { ok: true, result };
    }

    function emptyReceiver(id) {
      const b = blocked(); if (b) return b;
      const r = st.receivers[id];
      if (!r) return fail('Unbekannte Vorlage.');
      st.lost.waste.E += r.E; st.lost.waste.W += r.W; r.E = 0; r.W = 0;
      ev.emit('change', {});
      return { ok: true };
    }

    // ---------------------------------------------------------- Zeitschritt
    /** Sicherheitsstopp mitten im Schritt: noch nicht verteilter Dampf kondensiert zurück in den Kolben. */
    function bail(e, w, ...args) { st.flask.E += e; st.flask.W += w; return stop(...args); }
    function heatCap() { return st.flask.E * RHO_E * 2.44 + st.flask.W * 4.18 + 150; }

    function step(h) {
      if (st.safety) return;
      st.t += h;
      const f = st.flask;
      const fx = st.fx;
      fx.flame = Math.max(0, fx.flame - h);
      fx.bump = Math.max(0, fx.bump - h * 2);
      // Heizpilz erwärmt sich und kühlt verzögert ab
      const target = st.parts.mantle && st.parts.flask ? HEAT_W[st.heater] : 0;
      st.power += (target - st.power) * (1 - Math.exp(-h / 20));
      const V = flaskVol();
      const x = xOf(f.E, f.W);
      const Tb = bubbleT(x);
      const loss = 0.5 * (f.T - ROOM);
      let vapE = 0, vapW = 0, Qvap = 0;
      fx.boil = 0;
      if (V > 0.05) {
        const C = heatCap();
        if (f.T < Tb - 1e-6) {
          f.T = Math.min(Tb, f.T + (st.power - loss) / C * h);
        } else {
          const net = st.power - loss;
          if (net > 0) {
            f.T = Tb;
            const y = vaporY(x);
            const dH = y * DH_E + (1 - y) * DH_W;
            const n = net / dH * h; // mol
            let mlE = n * y * M_E / RHO_E, mlW = n * (1 - y) * M_W / RHO_W;
            const s = Math.min(1, (f.E / Math.max(mlE, 1e-12)), (f.W / Math.max(mlW, 1e-12)));
            mlE = Math.min(f.E, mlE * Math.min(1, s)); mlW = Math.min(f.W, mlW * Math.min(1, s));
            f.E -= mlE; f.W -= mlW;
            vapE = mlE; vapW = mlW; Qvap = net;
            fx.boil = clamp(net / 150, 0.15, 1);
          } else {
            f.T += net / C * h;
          }
        }
      } else if (st.power > 1) {
        f.T += (st.power - loss) / 150 * h;
      } else f.T = ROOM + (f.T - ROOM) * Math.exp(-h / 300);

      // Sicherheitsprüfungen im Betrieb
      if (vapE + vapW > 0) {
        const leak = openLeak();
        if (leak && f.E > 0.5) {
          const where = leak === 'neck' ? 'aus dem offenen Kolbenhals' : leak === 'top' ? 'aus der oberen Öffnung des Aufsatzes (Thermometer fehlt)' : 'aus dem seitlichen Ansatz – der Kühler fehlt';
          mistake('openApparatus');
          return void bail(vapE, vapW, 'open', 'Sicherheitsstopp: Dampf tritt offen aus',
            `Brennbarer Ethanoldampf strömt ${where}. In der Nähe der Heizquelle besteht Brandgefahr.`,
            'Baue die Apparatur vollständig auf: Destillationsaufsatz mit Thermometer, Liebigkühler und Vorstoß. Nur das Ende hinter dem Kühler bleibt offen.');
        }
        if (!st.stones) {
          st.bumpAcc = (st.bumpAcc || 0) + h * (0.3 + 0.25 * st.heater);
          if (st.bumpAcc > 1.5) {
            st.bumpAcc = 0; st.bumps++; fx.bump = 1;
            if (st.heater >= 3) {
              mistake('bumping');
              return void bail(vapE, vapW, 'bumping', 'Sicherheitsstopp: Siedeverzug',
                'Ohne Siedesteine überhitzt die Flüssigkeit und siedet dann stoßartig auf. Bei starker Heizung kann siedendes Gemisch durch die Apparatur geschleudert werden.',
                'Lass den Kolben abkühlen, gib Siedesteine in die kalte Flüssigkeit und erhitze dann erneut.');
            }
            if (!st.warned.bump) { st.warned.bump = true; msg('Die Flüssigkeit siedet stoßweise (Siedeverzug) – es fehlen Siedesteine.', 'warn'); mistake('noStones'); }
            // Stoß reißt etwas Kolbeninhalt mit in den Dampfweg
            const sp = Math.min(0.4, flaskVol() * 0.004);
            const fr = sp / Math.max(flaskVol(), 1e-9);
            const dE = f.E * fr, dW = f.W * fr; f.E -= dE; f.W -= dW; vapE += dE; vapW += dW;
          }
        }
      }
      if (st.heater > 0 && V > 0 && V < 10 && f.E + f.W < 10) {
        return void bail(vapE, vapW, 'dry', 'Sicherheitsstopp: Kolben fast leer',
          'Im Kolben ist kaum noch Flüssigkeit. Eine Destillation wird nie bis zur Trockne betrieben – der Kolben könnte überhitzen und springen.',
          'Heizung ausgeschaltet lassen. Für einen neuen Durchgang die Apparatur abkühlen lassen und neu befüllen.');
      }

      // Aufsatz erwärmen: zunächst kondensiert der Dampf an der kalten Glaswand und fließt zurück
      let pE = vapE, pW = vapW;
      if (Qvap > 0) {
        if (st.headWarm < 1) {
          st.headWarm = Math.min(1, st.headWarm + Qvap * h / HEAD_WARM_J);
          f.E += pE; f.W += pW; pE = 0; pW = 0; // Rückfluss
        }
      } else st.headWarm *= Math.exp(-h / 60);

      // Undichte Verbindungen ohne Klemmen: ein Teil des Dampfs entweicht
      fx.leak = 0;
      if ((pE + pW) > 0 && !st.parts.clamps) {
        const lE = pE * 0.2, lW = pW * 0.2;
        pE -= lE; pW -= lW; st.lost.leak.E += lE; st.lost.leak.W += lW;
        fx.leak = 1;
        if (!st.warned.leak) { st.warned.leak = true; msg('An den ungesicherten Schliffverbindungen tritt Dampf aus. Sichere die Verbindungen mit Klemmen.', 'warn'); mistake('unsecured'); }
        if (st.lost.leak.E > ESC_STOP) {
          return void bail(pE, pW, 'leak', 'Sicherheitsstopp: undichte Apparatur',
            'An den Verbindungen ist so viel brennbarer Dampf ausgetreten, dass Brandgefahr besteht.',
            'Heizung aus, abkühlen lassen und die Schliffverbindungen mit Klemmen sichern.');
        }
      }

      // Kühler
      fx.vapor = clamp((pE + pW) / h / 0.25, 0, 1);
      fx.drip = 0; fx.escape = 0;
      let escStop = false;
      if (pE + pW > 0) {
        let cap = COOL_W[st.parts.hoseIn ? st.cool : 0];
        if (!st.parts.cooler) cap = 0;
        if (st.parts.hoseIn === 'top' && st.cool > 0) cap *= 0.25;
        const load = Qvap;
        const fc = cap > 0 ? cap / Math.pow(Math.pow(cap, 6) + Math.pow(load, 6), 1 / 6) : 0;
        let cE = pE * fc, cW = pW * fc;
        const eE = pE - cE, eW = pW - cW;
        st.lost.escaped.E += eE; st.lost.escaped.W += eW;
        fx.escape = clamp((eE + eW) / h / 0.08, 0, 1);
        if (eE + eW > 1e-6) {
          if (st.lost.escaped.E > ESC_WARN && !st.warned.esc) {
            st.warned.esc = true;
            msg('Am Ende des Kühlers tritt unkondensierter Dampf aus – die Kühlung reicht nicht.', 'warn');
            mistake('weakCooling');
          }
          if (st.lost.escaped.E > ESC_STOP) escStop = true;
        }
        // Kondensat läuft durch den Kühler (kleiner Vorrat im Kühlrohr), dann tropft es
        const hold = st.coolerHold;
        hold.E += cE; hold.W += cW;
        let dE = 0, dW = 0;
        const hv = hold.E + hold.W;
        if (hv > 0.25) { const fr = (hv - 0.25) / hv; dE = hold.E * fr; dW = hold.W * fr; hold.E -= dE; hold.W -= dW; }
        cE = dE; cW = dW;
        if (cE + cW > 0) {
          fx.drip = clamp((cE + cW) / h / 0.12, 0.1, 1);
          const r = st.receiverAt ? st.receivers[st.receiverAt] : null;
          if (r) { r.E += cE; r.W += cW; } else {
            st.lost.table.E += cE; st.lost.table.W += cW;
            if (!st.warned.table) { st.warned.table = true; msg('Unter dem Vorstoß steht keine Vorlage – das Destillat tropft auf den Tisch.', 'warn'); mistake('noReceiver'); }
          }
          if (!st.firstDrop) {
            st.firstDrop = { t: +st.t.toFixed(1), read: reading(), pos: st.parts.thermo };
            log('firstDrop', { read: st.firstDrop.read, pos: st.parts.thermo });
            msg('Die ersten Tropfen Destillat fallen.', 'success');
          }
          if (st.collect.length === 0 || st.t - st.collect[st.collect.length - 1].t >= 2) {
            st.collect.push({ t: +st.t.toFixed(1), read: reading(), pos: st.parts.thermo, receiver: st.receiverAt });
          }
        }
      }

      if (escStop) {
        return void stop('escape', 'Sicherheitsstopp: Ethanoldampf tritt aus',
          'Der Kühler kondensiert den Dampf nicht vollständig. Brennbarer Ethanoldampf strömt aus dem Vorstoß in den Raum.',
          'Kühlwasser richtig anschließen (unten hinein, oben heraus), den Durchfluss erhöhen oder schwächer heizen.');
      }

      // Thermometer
      // Der Dampf erreicht die Thermometerkugel erst, wenn der Aufsatz durchgewärmt ist
      const reach = util.smooth((st.headWarm - 0.5) / 0.4);
      const headTarget = ROOM + (Tb - ROOM) * reach + (f.T - ROOM) * 0.04 * (1 - reach);
      let target2 = headTarget;
      if (st.parts.thermo === 'high') target2 = ROOM + (headTarget - ROOM) * 0.55;
      if (st.parts.thermo === 'deep') target2 = f.T + (vapE + vapW > 0 ? 1.5 + 0.8 * st.heater : 0);
      st.thermoT += (target2 - st.thermoT) * (1 - Math.exp(-h / 2.5));

      if (st.tempLog.length === 0 || st.t - st.tempLog[st.tempLog.length - 1].t >= 3) {
        st.tempLog.push({ t: +st.t.toFixed(1), read: st.parts.thermo ? +st.thermoT.toFixed(2) : null, flask: +f.T.toFixed(2) });
        if (st.tempLog.length > 1500) st.tempLog.splice(0, st.tempLog.length - 1500);
      }
    }

    /** Anzeige des Thermometers in °C; null ohne Thermometer. */
    function reading() { return st.parts.thermo ? +st.thermoT.toFixed(1) : null; }

    function totals() {
      const t = { E: 0, W: 0 };
      const add = (c) => { if (c) { t.E += c.E; t.W += c.W; } };
      add(st.flask); add(st.coolerHold); Object.values(st.receivers).forEach(add); Object.values(st.lost).forEach(add); add(st.dish);
      return t;
    }

    function exportState() { return clone(st); }
    function importState(s) { Object.keys(st).forEach((k) => delete st[k]); Object.assign(st, clone(s)); stepper.reset(); ev.emit('change', { reason: 'import' }); }

    return {
      state: st, H, on: ev.on,
      update(dt) { return stepper.advance(dt); },
      advance(s) { return stepper.advance(s); },
      busy: () => false,
      place, remove, fill, addStones, setHeater, setCooling, placeReceiver, setReceiverStopper,
      takeSample, ignite, emptyReceiver, ackSafety, reading, totals, closedSystem,
      flaskVol, phiOf, xOf, bubbleT, vaporY,
      exportState, importState
    };
  }

  return { create, bubbleT, vaporY, xOf, phiOf, burnResult, HEAT_W, HEAT_NAMES, COOL_W, COOL_NAMES, MIX_PHI, PORTION, MAX_FILL, BUBBLE, VAPOR };
});
