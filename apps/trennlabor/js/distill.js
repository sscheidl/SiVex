/*
 * Trennlabor – Fachmodell „Destillation von Ethanol/Wasser“ (ohne DOM)
 *
 * Energie- und Stoffbilanz eines Rundkolbens auf dem Heizpilz:
 *  - Flüssigkeit erwärmt sich mit der Heizleistung (abzüglich Wärmeverlust).
 *  - Ab der Siedetemperatur des Gemisches (abhängig vom Ethanolanteil der
 *    Flüssigkeit) verdampft sie; der Dampf ist ethanolreicher als die Flüssigkeit
 *    (Gleichgewichtsdaten bei Normaldruck, Azeotrop bewusst vernachlässigt).
 *  - Der Dampf erwärmt zuerst den Destillationsaufsatz; erst dann erreicht er
 *    Thermometer und Kühler. Der Kühler kondensiert je nach Kühlwasser einen
 *    Anteil, der Rest entweicht.
 *  - Sicherheitskritische Zustände (geschlossenes System, offene Apparatur,
 *    Siedeverzug, Trockenlaufen, Zünden an der Apparatur) stoppen sofort.
 */
(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('./core.js') : root.TL.core;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.TL = root.TL || {}).distill = api;
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  const { clamp, clone, interp } = core;

  const ROOM = 20;
  // Siede- und Gleichgewichtsdaten Ethanol/Wasser bei 1013 hPa:
  // [Stoffmengenanteil Ethanol in der Flüssigkeit x, im Dampf y, Siedetemperatur °C]
  const VLE = [
    [0.0, 0.0, 100.0], [0.019, 0.170, 95.5], [0.0721, 0.3891, 89.0], [0.0966, 0.4375, 86.7],
    [0.1238, 0.4704, 85.3], [0.1661, 0.5089, 84.1], [0.2337, 0.5445, 82.7], [0.2608, 0.558, 82.3],
    [0.3273, 0.5826, 81.5], [0.3965, 0.6122, 80.7], [0.5079, 0.6564, 79.8], [0.5732, 0.6841, 79.3],
    [0.6763, 0.7385, 78.74], [0.7472, 0.7815, 78.41], [0.8943, 0.8943, 78.15], [1.0, 1.0, 78.3]
  ];
  // Vereinfachung: monoton bis zum reinen Ethanol (Azeotrop vernachlässigt)
  const T_TABLE = VLE.map((r) => [r[0], r[2]]).map((r, i, a) => (i === a.length - 1 ? [1.0, 78.1] : r));
  const Y_TABLE = VLE.map((r) => [r[0], r[1]]);
  const boilT = (x) => interp(T_TABLE, clamp(x, 0, 1));
  const vapY = (x) => interp(Y_TABLE, clamp(x, 0, 1));

  const MOL = { E: 0.789 / 46.07, W: 0.998 / 18.015 }; // mol je mL
  const HVAP = { E: 38600, W: 40650 }; // J/mol
  const CP = { E: 2.44 * 0.789, W: 4.18 * 0.998 }; // J/(K·mL)
  const C_FLASK = 120, C_HEAD = 60;
  const HEATER_W = [0, 80, 150, 220, 320];
  const START_FRACTION = 0.30; // Ausgangsgemisch: 30 % (V/V) Ethanol
  const FILLS = [25, 100, 175];
  const FLASK_CAP = 250;
  const BURN = { burns: 55, flicker: 40 }; // % (V/V) Ethanol der Probe bei Raumtemperatur
  const SAMPLE_ML = 2;

  const PARTS = ['heater', 'flask', 'chips', 'head', 'thermo', 'condenser', 'hoses', 'adapter', 'receiver', 'clamps', 'stopper'];
  const PART_NAMES = {
    heater: 'Heizpilz', flask: 'Rundkolben (250 mL)', chips: 'Siedesteine', head: 'Destillationsaufsatz', thermo: 'Thermometer',
    condenser: 'Liebigkühler', hoses: 'Kühlwasserschläuche', adapter: 'Vorstoß', receiver: 'Vorlage (Erlenmeyerkolben)',
    clamps: 'Klemmen am Stativ', stopper: 'Stopfen auf der Vorlage'
  };
  const DEPENDS = { flask: 'heater', chips: 'flask', head: 'flask', thermo: 'head', condenser: 'head', hoses: 'condenser', adapter: 'condenser', clamps: 'condenser', stopper: 'receiver' };

  function initialState() {
    return {
      lab: 'distill', time: 0, seq: 0,
      parts: { heater: false, flask: false, chips: false, head: false, thermo: null, condenser: false, hoses: null, adapter: false, receiver: false, clamps: false, stopper: false },
      heater: 0, cooling: 0,
      liquid: { E: 0, W: 0, T: ROOM, superheat: 0 },
      head: { T: ROOM }, sensor: null,
      vaporRate: 0, passRate: 0, condRate: 0,
      receiver: { E: 0, W: 0 }, fractions: [], hold: { E: 0, W: 0 }, dripRate: 0,
      dish: { E: 0, W: 0, from: null, burning: 0, result: null, t: null },
      burns: [],
      lost: { vapor: { E: 0, W: 0 }, spilled: { E: 0, W: 0 }, waste: { E: 0, W: 0 }, burned: { E: 0, W: 0 } },
      added: { E: 0, W: 0 },
      firstDrop: null, readings: null, distGood: 0, distTotal: 0, maxHeadT: null,
      curve: [], safety: null, log: [], flags: {}, op: null
    };
  }

  const xOf = (E, W) => { const nE = E * MOL.E, nW = W * MOL.W; return nE + nW > 0 ? nE / (nE + nW) : 0; };
  const volPct = (E, W) => (E + W > 0 ? 100 * E / (E + W) : 0);
  /** Volumenanteil im Dampf aus Stoffmengenanteil y. */
  function vaporSplit(y) {
    // Volumina je mol: E 58,4 mL, W 18,05 mL
    const vE = y / MOL.E, vW = (1 - y) / MOL.W;
    return { fE: vE / (vE + vW), molPerMl: 1 / (vE + vW) };
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
    const once = (key, text, kind, code) => { if (!st.flags[key]) { st.flags[key] = true; msg(text, kind || 'warn', code); } };
    const P = st.parts;
    const vol = () => st.liquid.E + st.liquid.W;
    const hot = () => st.heater > 0 || st.liquid.T > 50;

    function safetyStop(code, text) {
      if (st.safety) return;
      st.safety = { code, text, t: st.time };
      st.heater = 0;
      msg(text, 'safety', code);
      bus.emit('safety', st.safety);
    }

    /** Sicherheitsprüfung beim Heizen. Gibt true zurück, wenn gestoppt wurde. */
    function checkHeating() {
      if (st.heater === 0 || st.safety) return false;
      if (P.stopper) { safetyStop('closed', 'Sicherheitsunterbrechung: Die Apparatur ist vollständig geschlossen (Stopfen auf der Vorlage). Beim Erhitzen steigt der Druck – das Glas kann bersten. Die Heizung wurde ausgeschaltet. Eine Destillationsapparatur muss am Ende offen sein.'); return true; }
      if (vol() > 0 && !P.head) { safetyStop('openFlask', 'Sicherheitsunterbrechung: Der Kolben ist offen. Beim Erhitzen träten brennbare Ethanoldämpfe direkt über dem Heizpilz aus. Die Heizung wurde ausgeschaltet. Setze zuerst den Destillationsaufsatz und den Kühler auf.'); return true; }
      if (vol() > 0 && P.head && !P.condenser) { safetyStop('openHead', 'Sicherheitsunterbrechung: Am seitlichen Abgang des Aufsatzes fehlt der Kühler. Brennbarer Ethanoldampf würde ungekühlt austreten. Die Heizung wurde ausgeschaltet.'); return true; }
      return false;
    }

    function resume() {
      if (!st.safety) return ok();
      const code = st.safety.code;
      if (code === 'closed' && P.stopper) return fail('Nimm zuerst den Stopfen von der Vorlage.', 'safetyPending');
      if (code === 'openFlask' && !P.head) return fail('Setze zuerst den Destillationsaufsatz auf.', 'safetyPending');
      if (code === 'openHead' && !P.condenser) return fail('Schließe zuerst den Kühler an.', 'safetyPending');
      if (code === 'bump' && !P.chips) return fail('Lass den Kolben abkühlen und gib dann Siedesteine hinein.', 'safetyPending');
      if (code === 'dry' && vol() < 10) return fail('Der Kolben ist fast leer. Lass ihn abkühlen und fülle Gemisch nach (Aufsatz vorher abnehmen) oder beende den Versuch.', 'safetyPending');
      st.safety = null;
      return ok('Versuch fortgesetzt. Die Heizung ist aus – schalte sie bei Bedarf wieder ein.');
    }

    const guard = () => (st.safety ? fail('Der Versuch ist wegen einer Sicherheitsunterbrechung angehalten. Behebe die Ursache und setze fort.', 'safety') : st.op ? fail('Warte, bis die laufende Handlung abgeschlossen ist.', 'busy') : null);

    function mount(part, option) {
      if (st.op) return fail('Warte, bis die laufende Handlung abgeschlossen ist.', 'busy');
      if (st.safety && !['head', 'condenser', 'chips'].includes(part)) return fail('Der Versuch ist wegen einer Sicherheitsunterbrechung angehalten. Behebe die Ursache und setze fort.', 'safety');
      if (!PARTS.includes(part)) return fail('Unbekanntes Teil.', 'part');
      const dep = DEPENDS[part];
      if (dep && !P[dep]) return fail(`${PART_NAMES[part]}: Zuerst wird ${PART_NAMES[dep]} benötigt.`, 'order-' + part);
      if (part === 'chips') {
        if (P.chips) return fail('Im Kolben liegen bereits Siedesteine.', 'have');
        if (st.liquid.T > 50) return fail('Siedesteine nie in heiße Flüssigkeit geben! Die Flüssigkeit könnte schlagartig aufschäumen (Siedeverzug). Lass den Kolben zuerst unter 50 °C abkühlen.', 'chipsHot');
      }
      if (part === 'thermo') {
        if (!['vapor', 'high', 'liquid'].includes(option)) return fail('Wähle die Position des Thermometers.', 'thermoPos');
        if (P.thermo === option) return ok();
        if (P.thermo && st.heater > 0) return fail('Verstelle das Thermometer nur bei ausgeschalteter Heizung.', 'thermoHot');
        P.thermo = option;
        st.op = { type: 'mount', part, t: 0, dur: 0.8 };
        return ok({ vapor: 'Thermometer eingesetzt: Die Kugel sitzt auf Höhe des seitlichen Abgangs im Dampfweg.', high: 'Thermometer eingesetzt: Die Kugel sitzt weit oberhalb des seitlichen Abgangs.', liquid: 'Thermometer eingesetzt: Die Kugel taucht in die Flüssigkeit im Kolben.' }[option]);
      }
      if (part === 'hoses') {
        if (!['correct', 'reversed'].includes(option)) return fail('Wähle, wie die Schläuche angeschlossen werden.', 'hosePos');
        if (st.cooling > 0) return fail('Drehe zuerst das Kühlwasser ab.', 'hoseWater');
        P.hoses = option;
        st.op = { type: 'mount', part, t: 0, dur: 0.8 };
        return ok(option === 'correct' ? 'Schläuche angeschlossen: Zulauf unten, Ablauf oben.' : 'Schläuche angeschlossen: Zulauf oben, Ablauf unten.');
      }
      if (P[part]) return fail(`${PART_NAMES[part]} ist bereits angebracht.`, 'have');
      if (part === 'head' && st.safety && st.safety.code !== 'openFlask') return fail('Versuch angehalten.', 'safety');
      if (part === 'condenser' && st.safety && st.safety.code !== 'openHead') return fail('Versuch angehalten.', 'safety');
      P[part] = true;
      st.op = { type: 'mount', part, t: 0, dur: 0.9 };
      if (part === 'stopper') msg('Die Vorlage ist jetzt luftdicht verschlossen.', 'warn', 'stopperOn');
      if (part === 'clamps') return ok('Kolbenhals und Kühler sind am Stativ festgeklemmt.');
      return ok(`${PART_NAMES[part]} angebracht.`);
    }

    function unmount(part) {
      if (st.op) return fail('Warte, bis die laufende Handlung abgeschlossen ist.', 'busy');
      if (!PARTS.includes(part) || !P[part]) return fail('Dieses Teil ist nicht angebracht.', 'notMounted');
      const dependents = Object.keys(DEPENDS).filter((k) => DEPENDS[k] === part && P[k] && k !== 'chips');
      if (dependents.length) return fail(`Nimm zuerst ab: ${dependents.map((d) => PART_NAMES[d]).join(', ')}.`, 'unmountOrder');
      const free = ['stopper', 'receiver', 'thermo'];
      if (part === 'thermo' && st.heater > 0) return fail('Verstelle das Thermometer nur bei ausgeschalteter Heizung.', 'thermoHot');
      if (!free.includes(part) && hot()) return fail('Die Apparatur ist heiß. Schalte die Heizung aus und lass sie unter 50 °C abkühlen, bevor du sie zerlegst.', 'hotApparatus');
      if (part === 'hoses' && st.cooling > 0) return fail('Drehe zuerst das Kühlwasser ab.', 'hoseWater');
      if (part === 'flask' && vol() > 0) return fail('Der Kolben ist gefüllt. Lass ihn so stehen oder beginne den Versuch neu.', 'flaskFull');
      if (part === 'receiver' && st.receiver.E + st.receiver.W > 0.05) {
        st.fractions.push({ E: st.receiver.E, W: st.receiver.W, n: st.fractions.length + 1, t: st.time });
        st.receiver = { E: 0, W: 0 };
        msg('Die Vorlage mit dem Destillat wurde beiseitegestellt (Fraktion ' + st.fractions.length + ').', 'info', 'fractionStored');
      }
      if (part === 'thermo') { P.thermo = null; st.sensor = null; } else P[part] = part === 'hoses' ? null : false;
      if (part === 'condenser') P.clamps = false;
      st.op = { type: 'unmount', part, t: 0, dur: 0.7 };
      return ok(`${PART_NAMES[part]} abgenommen.`);
    }

    function fill(ml) {
      const g = guard(); if (g) return g;
      if (!P.flask) return fail('Stelle zuerst den Rundkolben auf den Heizpilz.', 'noFlask');
      if (P.head) return fail('Fülle das Gemisch mit einem Trichter ein, bevor der Destillationsaufsatz aufgesetzt wird.', 'fillLate');
      if (st.liquid.T > 50) return fail('Der Kolben ist noch heiß. Lass ihn abkühlen.', 'fillHot');
      ml = Number(ml);
      if (!FILLS.includes(ml)) return fail('Wähle eine Füllmenge.', 'fillAmount');
      if (vol() + ml > FLASK_CAP - 10) return fail('So viel passt nicht mehr in den Kolben.', 'fillFull');
      const E = ml * START_FRACTION, W = ml - E;
      const hc = vol() > 0 ? (st.liquid.E * CP.E + st.liquid.W * CP.W) : 0;
      st.liquid.T = (st.liquid.T * hc + ROOM * (E * CP.E + W * CP.W)) / (hc + E * CP.E + W * CP.W);
      st.liquid.E += E; st.liquid.W += W;
      st.added.E += E; st.added.W += W;
      st.op = { type: 'fill', t: 0, dur: 1.4 };
      if (vol() > FLASK_CAP * 2 / 3) msg('Der Kolben ist mehr als zu zwei Dritteln gefüllt. Beim Sieden kann Flüssigkeit in den Aufsatz schäumen.', 'warn', 'overfill');
      if (vol() < 40) msg('Das ist nur wenig Gemisch – es reicht für eine kurze Destillation, der Kolben läuft schnell leer.', 'info', 'littleFill');
      return ok(`${ml} mL Ethanol-Wasser-Gemisch (30 % Ethanol, V/V) eingefüllt.`);
    }

    function setHeater(level) {
      level = clamp(Math.round(Number(level) || 0), 0, 4);
      if (st.safety && level > 0) return fail('Erst nach Behebung der Sicherheitsunterbrechung weiterheizen.', 'safety');
      if (level > 0 && !P.heater) return fail('Es ist kein Heizpilz aufgebaut.', 'noHeater');
      if (level > 0 && !P.flask) return fail('Auf dem Heizpilz steht kein Kolben.', 'noFlask');
      if (level > 0 && vol() <= 0) return fail('Der Kolben ist leer – ein leerer Kolben wird nicht erhitzt.', 'emptyFlask');
      st.heater = level;
      if (checkHeating()) return { ok: false, safety: true, message: st.safety.text, code: st.safety.code };
      if (level === 4) msg('Höchste Heizstufe: Das Gemisch siedet sehr heftig.', 'warn', 'heaterMax');
      return ok(level ? `Heizpilz auf Stufe ${level}.` : 'Heizpilz ausgeschaltet.');
    }

    function setCooling(level) {
      level = clamp(Math.round(Number(level) || 0), 0, 3);
      if (level > 0 && !P.hoses) return fail('Schließe zuerst die Kühlwasserschläuche an den Kühler an.', 'noHoses');
      st.cooling = level;
      return ok(level ? `Kühlwasser: ${['', 'schwacher', 'mittlerer', 'starker'][level]} Durchfluss.` : 'Kühlwasser abgedreht.');
    }

    function changeReceiver() {
      if (!P.receiver) return fail('Es steht keine Vorlage unter dem Vorstoß.', 'noReceiver');
      if (P.stopper) return fail('Nimm zuerst den Stopfen ab.', 'stopper');
      if (st.receiver.E + st.receiver.W < 0.05) return fail('Die Vorlage ist noch leer.', 'receiverEmpty');
      st.fractions.push({ E: st.receiver.E, W: st.receiver.W, n: st.fractions.length + 1, t: st.time });
      st.receiver = { E: 0, W: 0 };
      st.op = { type: 'swap', t: 0, dur: 1.2 };
      return ok(`Vorlage gewechselt. Fraktion ${st.fractions.length} steht beiseite.`);
    }

    function takeSample(src) {
      if (st.op) return fail('Warte, bis die laufende Handlung abgeschlossen ist.', 'busy');
      if (st.safety && src === 'flask') return fail('Der Versuch ist angehalten.', 'safety');
      if (st.dish.E + st.dish.W > 0.01) return fail('In der Porzellanschale ist noch eine Probe. Leere sie zuerst.', 'dishFull');
      let pool;
      if (src === 'receiver') {
        if (!P.receiver) return fail('Es steht keine Vorlage bereit.', 'noReceiver');
        if (P.stopper) return fail('Die Vorlage ist mit einem Stopfen verschlossen.', 'stopper');
        pool = st.receiver;
      } else if (src && src.startsWith('fraction')) {
        pool = st.fractions[Number(src.split(':')[1]) - 1];
        if (!pool) return fail('Diese Fraktion gibt es nicht.', 'noFraction');
      } else if (src === 'flask') {
        if (hot()) { safetyStop('hotOpen', 'Sicherheitsunterbrechung: Die heiße Apparatur darf zur Probenahme nicht geöffnet werden – heißer, brennbarer Dampf würde austreten. Die Heizung wurde ausgeschaltet.'); return { ok: false, safety: true, message: st.safety.text, code: 'hotOpen' }; }
        if (P.head) return fail('Der Kolben ist mit dem Aufsatz verschlossen. Für eine Probe aus dem Kolben müsstest du die Apparatur abbauen.', 'flaskClosed');
        pool = st.liquid;
      } else return fail('Wähle, woraus du die Probe entnimmst.', 'sampleSrc');
      const tot = pool.E + pool.W;
      if (tot < 0.3) return fail('Darin ist zu wenig Flüssigkeit für eine Probe.', 'sampleEmpty');
      const take = Math.min(SAMPLE_ML, tot);
      const f = take / tot;
      const E = pool.E * f, W = pool.W * f;
      pool.E -= E; pool.W -= W;
      st.dish = { E, W, from: src, burning: 0, result: null, t: st.time };
      st.op = { type: 'sample', src, t: 0, dur: 1.5 };
      return ok(`Mit der Pipette ${core.fmt(take, 1)} mL in die Porzellanschale gegeben.`);
    }

    function cleanDish() {
      if (st.dish.burning > 0) return fail('Warte, bis die Flamme erloschen ist.', 'burning');
      st.lost.waste.E += st.dish.E; st.lost.waste.W += st.dish.W;
      st.dish = { E: 0, W: 0, from: null, burning: 0, result: null, t: null };
      return ok('Porzellanschale geleert und gesäubert.');
    }

    function ignite(target) {
      if (st.safety) return fail('Versuch angehalten.', 'safety');
      if (target !== 'dish') {
        safetyStop('igniteApparatus', 'Sicherheitsunterbrechung: An der Destillationsapparatur wird niemals gezündet! Dort treten brennbare Ethanoldämpfe auf. Die Brennprobe erfolgt nur mit einer kleinen Probe in der getrennten Porzellanschale.');
        return { ok: false, safety: true, message: st.safety.text, code: 'igniteApparatus' };
      }
      if (st.dish.burning > 0) return fail('Die Probe brennt bereits.', 'burning');
      const tot = st.dish.E + st.dish.W;
      if (tot < 0.05) return fail('Die Porzellanschale ist leer. Entnimm zuerst eine kleine Probe.', 'dishEmpty');
      const pct = volPct(st.dish.E, st.dish.W);
      let result;
      if (pct >= BURN.burns) { result = 'burns'; st.dish.burning = 1; }
      else if (pct >= BURN.flicker) { result = 'flicker'; st.dish.burning = 0.25; }
      else result = 'none';
      st.dish.result = result;
      st.burns.push({ t: st.time, from: st.dish.from, pct, result });
      st.op = { type: 'ignite', t: 0, dur: 1.0 };
      return ok({ burns: 'Die Probe brennt mit einer bläulichen, kaum leuchtenden Flamme.', flicker: 'Die Probe flammt kurz auf und erlischt sofort wieder.', none: 'Die Probe lässt sich nicht entzünden.' }[result], { result });
    }

    function act(name, ...args) {
      const fn = { mount, unmount, fill, setHeater, setCooling, changeReceiver, takeSample, cleanDish, ignite, resume }[name];
      if (!fn) return fail('Unbekannte Handlung ' + name);
      const r = fn(...args);
      bus.emit('change', { action: name, result: r });
      return r;
    }

    /** Wirkungsgrad des Kühlers (Anteil des Dampfes, der kondensiert). */
    function condEfficiency() {
      if (!P.condenser) return 0;
      if (!P.hoses || st.cooling === 0) return 0.12; // nur Luftkühlung
      const base = [0, 0.78, 0.97, 0.995][st.cooling];
      return P.hoses === 'correct' ? base : base * 0.55;
    }

    function step(dt) {
      st.time += dt;
      if (st.op) { st.op.t += dt; if (st.op.t >= st.op.dur) st.op = null; }
      const L = st.liquid;
      const V = vol();
      const power = st.safety ? 0 : HEATER_W[st.heater];
      const hc = L.E * CP.E + L.W * CP.W + C_FLASK;
      const loss = 0.9 * (L.T - ROOM);
      const x = xOf(L.E, L.W);
      const Tb = boilT(x);
      st.vaporRate = 0; st.passRate = 0; st.condRate = 0;
      if (st.heater > 0 && checkHeating()) return;
      if (V > 0) {
        // Mit Siedesteinen siedet das Gemisch, sobald die Siedetemperatur erreicht ist;
        // Wärme oberhalb davon geht vollständig ins Verdampfen.
        let boilPower = 0;
        const reach = L.T + (power - loss) / hc * dt;
        if (P.chips && power > 0 && reach >= Tb - 1e-9) {
          boilPower = Math.max(0, power - loss - Math.max(0, hc * (Tb - L.T) / dt));
          L.T = Tb;
        }
        if (!boilPower && (L.T < Tb || (!P.chips && power > 0 && L.superheat < 4))) {
          L.T += (power - loss) / hc * dt;
          if (L.T > Tb) {
            if (P.chips) L.T = Tb;
            else {
              L.superheat = L.T - Tb;
              if (L.superheat >= 4 && power > 0) {
                safetyStop('bump', 'Sicherheitsunterbrechung: Siedeverzug! Ohne Siedesteine hat sich die Flüssigkeit über ihre Siedetemperatur erhitzt und ist schlagartig aufgeschäumt. Die Heizung wurde ausgeschaltet. Lass den Kolben unter 50 °C abkühlen und gib dann Siedesteine hinein.');
                L.T = Tb;
              }
            }
          } else L.superheat = 0;
        } else {
          L.T = Tb; L.superheat = 0;
          const net = boilPower || (power - loss);
          if (net > 0) {
            const y = vapY(x);
            const hv = y * HVAP.E + (1 - y) * HVAP.W;
            let nDot = net / hv; // mol/s
            const { fE, molPerMl } = vaporSplit(y);
            let mlDot = nDot / molPerMl;
            mlDot = Math.min(mlDot, V / dt);
            let dE = mlDot * fE * dt, dW = mlDot * (1 - fE) * dt;
            dE = Math.min(dE, L.E); dW = Math.min(dW, L.W);
            st.vaporRate = (dE + dW) / dt;
            // Dampf erwärmt zuerst den Aufsatz (Kondensat läuft zurück)
            const vapPower = net;
            const needHead = Math.max(0, C_HEAD * (Tb - st.head.T) / dt) + 0.25 * (st.head.T - ROOM);
            const toHead = Math.min(vapPower, needHead);
            const passFrac = vapPower > 0 ? clamp((vapPower - toHead) / vapPower, 0, 1) : 0;
            st.head.T += (toHead - 0.25 * (st.head.T - ROOM)) / C_HEAD * dt;
            if (st.head.T > Tb) st.head.T = Tb;
            let pE = dE * passFrac, pW = dW * passFrac;
            // Mitreißen von Flüssigkeit bei sehr heftigem Sieden oder überfülltem Kolben
            let ent = 0;
            if (st.heater === 4) ent += 0.18;
            if (V > FLASK_CAP * 2 / 3) ent += 0.35;
            if (ent > 0 && passFrac > 0) {
              const share = (pE + pW) * ent;
              const eE = Math.min(L.E - dE, share * L.E / V), eW = Math.min(L.W - dW, share * L.W / V);
              pE += Math.max(0, eE); pW += Math.max(0, eW);
              L.E -= Math.max(0, eE); L.W -= Math.max(0, eW);
              once('entrain', 'Das Gemisch siedet so heftig, dass Flüssigkeitströpfchen in den Aufsatz mitgerissen werden. Das Destillat wird dadurch wasserreicher.', 'warn', 'entrain');
            }
            L.E -= pE; L.W -= pW; // Rest kondensiert im Aufsatz und läuft zurück
            if (L.E < 1e-9) L.E = 0; if (L.W < 1e-9) L.W = 0;
            st.passRate = (pE + pW) / dt;
            if (pE + pW > 0) {
              // Undichte Verbindungen ohne Klemmen
              const leak = P.clamps ? 0 : 0.08;
              if (leak) once('leak', 'Die Schliffverbindungen sind nicht festgeklemmt: An den Verbindungen tritt etwas Dampf aus.', 'warn', 'leak');
              const eff = condEfficiency();
              const cE = pE * (1 - leak) * eff, cW = pW * (1 - leak) * eff;
              st.lost.vapor.E += pE - cE; st.lost.vapor.W += pW - cW;
              if (eff < 0.6) once('vaporEscape-' + st.cooling + (P.hoses || ''), 'Aus dem Ende des Kühlers entweicht Dampf – der Kühler kondensiert ihn nicht vollständig. Ethanoldampf ist brennbar.', 'warn', 'vaporEscape');
              // ohne Vorstoß geht ein Teil am Gefäß vorbei
              const miss = P.adapter ? 0 : 0.3;
              const toRec = 1 - miss;
              st.hold.E += cE * toRec; st.hold.W += cW * toRec; st.hold.dest = P.receiver;
              const spillE = cE * miss, spillW = cW * miss;
              st.lost.spilled.E += spillE; st.lost.spilled.W += spillW;
              if (!P.adapter && P.receiver) once('noAdapter', 'Ohne Vorstoß tropft ein Teil des Destillats neben die Vorlage.', 'warn', 'noAdapter');
              st.condRate = (cE + cW) * toRec / dt;
            }
            if (V - (st.vaporRate * dt) < 8 && power > 0) {
              safetyStop('dry', 'Sicherheitsunterbrechung: Im Kolben ist kaum noch Flüssigkeit. Ein fast leerer Kolben überhitzt und kann springen. Die Heizung wurde ausgeschaltet.');
            }
          }
        }
        if (power === 0) { if (L.T > ROOM) L.T = Math.max(ROOM, L.T - loss / hc * dt); L.superheat = 0; }
      } else {
        L.T = ROOM + (L.T - ROOM) * Math.exp(-dt / 60);
      }
      // Kondensat läuft durch Kühler und Vorstoß (einige Sekunden) und tropft in die Vorlage
      if (st.hold.E + st.hold.W > 1e-9) {
        const f = 1 - Math.exp(-dt / 6);
        const hE = st.hold.E * f, hW = st.hold.W * f;
        st.hold.E -= hE; st.hold.W -= hW;
        if (P.receiver) {
          st.receiver.E += hE; st.receiver.W += hW;
          st.distTotal += hE + hW;
          if (P.thermo === 'vapor') st.distGood += hE + hW;
          st.dripRate = (hE + hW) / dt;
          if (!st.firstDrop && st.receiver.E + st.receiver.W > 0.05) {
            st.firstDrop = { t: st.time, reading: st.sensor, thermo: P.thermo, x: xOf(L.E, L.W) };
            msg('Die ersten Tropfen Destillat fallen in die Vorlage.', 'info', 'firstDrop');
          }
        } else {
          st.lost.spilled.E += hE; st.lost.spilled.W += hW;
          st.dripRate = (hE + hW) / dt;
          once('noReceiver', 'Unter dem Kühler steht keine Vorlage – das Destillat tropft auf den Tisch.', 'warn', 'noReceiverDrip');
        }
      } else st.dripRate = 0;
      // Aufsatz kühlt ohne Dampfzufuhr ab
      if (st.passRate === 0 && st.vaporRate === 0) st.head.T = ROOM + (st.head.T - ROOM) * Math.exp(-dt / 90);
      // Thermometeranzeige (Sensor mit Verzögerung)
      const pos = P.thermo;
      if (!pos) st.sensor = null;
      else {
        let target, tau;
        if (pos === 'liquid') { target = V > 0 ? L.T : st.head.T; tau = 3; }
        else if (pos === 'vapor') { target = st.passRate > 0 ? Tb : st.head.T; tau = st.passRate > 0 ? 2 : 10; }
        else { target = ROOM + (st.head.T - ROOM) * 0.86; tau = 25; }
        if (st.sensor == null) st.sensor = ROOM;
        st.sensor += (target - st.sensor) * (1 - Math.exp(-dt / tau));
      }
      if (st.sensor != null && st.passRate > 0) st.maxHeadT = Math.max(st.maxHeadT || 0, st.sensor);
      // Messwerte während gleichmäßigen Tropfens (Thermometer im Dampfweg), für die Auswertung
      if (st.firstDrop && st.dripRate > 0.005 && P.thermo === 'vapor' && st.sensor != null && st.time - st.firstDrop.t > 8) {
        const r = st.readings || (st.readings = { min: st.sensor, max: st.sensor, first: st.sensor, last: st.sensor, n: 0 });
        r.min = Math.min(r.min, st.sensor); r.max = Math.max(r.max, st.sensor); r.last = st.sensor; r.n++;
      }
      // Brennende Probe
      if (st.dish.burning > 0) {
        const burnE = Math.min(st.dish.E, 0.04 * dt);
        st.dish.E -= burnE; st.lost.burned.E += burnE;
        if (volPct(st.dish.E, st.dish.W) < BURN.flicker || st.dish.E < 0.02) st.dish.burning = 0;
        else if (st.dish.result === 'flicker') { st.dish.burning -= dt; if (st.dish.burning <= 0) st.dish.burning = 0; }
      }
      // Temperaturverlauf (alle 2 s Modellzeit)
      const last = st.curve[st.curve.length - 1];
      if (!last || st.time - last.t >= 2 - 1e-6) {
        st.curve.push({ t: Math.round(st.time * 10) / 10, head: st.sensor == null ? null : Math.round(st.sensor * 10) / 10, flask: Math.round(L.T * 10) / 10, dist: Math.round((st.receiver.E + st.receiver.W + st.fractions.reduce((s, f) => s + f.E + f.W, 0)) * 100) / 100, pos: P.thermo });
        if (st.curve.length > 900) st.curve.splice(0, st.curve.length - 900);
      }
    }

    // ----------------------------------------------------------- Abfragen
    function totals() {
      const t = { E: 0, W: 0 };
      const add = (o) => { t.E += o.E; t.W += o.W; };
      add(st.liquid); add(st.receiver); add(st.hold); st.fractions.forEach(add); add(st.dish);
      Object.values(st.lost).forEach(add);
      return t;
    }
    const distillate = () => {
      const all = [st.receiver].concat(st.fractions);
      const E = all.reduce((s, f) => s + f.E, 0), W = all.reduce((s, f) => s + f.W, 0);
      return { E, W, vol: E + W, pct: volPct(E, W) };
    };

    return {
      state: st, act, step, clock, advance: (sec) => clock.advance(sec), on: bus.on,
      totals, distillate, condEfficiency, boilingPoint: () => boilT(xOf(st.liquid.E, st.liquid.W)),
      liquidPct: () => volPct(st.liquid.E, st.liquid.W), receiverPct: () => volPct(st.receiver.E, st.receiver.W)
    };
  }

  return { createEngine, initialState, VLE, boilT, vapY, xOf, volPct, PARTS, PART_NAMES, DEPENDS, HEATER_W, FILLS, BURN, START_FRACTION, FLASK_CAP, SAMPLE_ML };
});
