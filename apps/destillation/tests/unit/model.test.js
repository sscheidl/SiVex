// Unit- und Regressionstests des Fachmodells (ohne DOM). Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { M, act, setup, runUntil, vol } = require('./helpers.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} statt ${b} ± ${tol}`);
const balanceOk = (e, msg) => { const b = e.balance(); assert.ok(b.ok, `${msg || 'Bilanz'}: Abweichung ${b.error}`); };

test('M-03 Stoffdaten: gerundete Reinstoff-Siedetemperaturen, genau drei Gemische', () => {
  assert.equal(M.SUBSTANCES.P.bp, 56);
  assert.equal(M.SUBSTANCES.E.bp, 78);
  assert.equal(M.SUBSTANCES.W.bp, 100);
  assert.deepEqual(M.MIX_ORDER, ['ew', 'pw', 'pew']);
  assert.equal(M.MIXES.pew.expert, true);
  assert.equal(M.MIXES.ew.expert, false);
  for (const id of M.MIX_ORDER) near(vol(M.MIXES[id].comp), 100, 1e-9, `${id}: 100 mL`);
  // Reinstoffe sieden genau bei ihrer Siedetemperatur
  for (const k of M.KEYS) { const c = M.zero(); c[k] = 10; near(M.boilingPoint(c), M.SUBSTANCES[k].bp, 1e-9, k); }
});

test('M-03 Idealisiertes Trennmodell: Siedetemperatur zwischen den Reinstoffen, Dampf reich am leichter siedenden Stoff', () => {
  const c = { P: 0, E: 40, W: 60 };
  const T = M.boilingPoint(c);
  assert.ok(T > 78 && T < 81, 'Ethanol/Wasser siedet knapp über 78 °C: ' + T);
  const y = M.vaporFractions(c);
  assert.ok(y[1] > 0.999, 'Dampf praktisch reines Ethanol');
  const T2 = M.boilingPoint({ P: 40, E: 0, W: 60 });
  assert.ok(T2 > 56 && T2 < 59, 'Propanon/Wasser: ' + T2);
  // stetig: weniger Ethanol → höhere Siedetemperatur, kein Sprung
  let prev = 0;
  for (const e of [40, 20, 10, 5, 2, 1, 0.5, 0.1]) { const t = M.boilingPoint({ P: 0, E: e, W: 60 }); assert.ok(t > prev, 'monoton'); assert.ok(prev === 0 || t - prev < 3, 'kein Sprung: ' + prev + ' → ' + t); prev = t; }
});

test('S-03/M-01 Startzustand vormontiert, kalt; Heizen nur mit Füllung; Heizung schaltet sofort, Wärme fließt verzögert', () => {
  const e = M.createEngine();
  const st = e.state;
  assert.equal(st.filled, false);
  assert.equal(st.heater.on, false);
  assert.equal(st.water.on, false);
  assert.equal(st.thermo, 'high', 'Thermometer muss geprüft werden');
  assert.deepEqual(st.hoses, { inlet: null, outlet: null });
  assert.equal(st.receiver.present, true);
  assert.equal(act(e, 'setHeater', true).ok, false, 'leerer Kolben');
  act(e, 'fill');
  near(vol(st.flask.c), 100, 1e-9, 'Füllung');
  assert.equal(act(e, 'setHeater', true).ok, true);
  const T0 = st.flask.T;
  e.advance(2);
  assert.ok(st.flask.T - T0 < 0.5, 'kein Temperatursprung beim Einschalten');
  e.advance(120);
  assert.ok(st.flask.T > T0 + 5, 'Heizleistung erwärmt den Kolben');
  act(e, 'setHeater', false);
  const Tm = st.mantleT;
  e.advance(1);
  assert.ok(Math.abs(st.mantleT - Tm) < 2, 'Heizpilz kühlt verzögert ab');
});

test('M-01 Heizstufe wirkt: höhere Stufe → schneller Siedebeginn, mehr Destillat', () => {
  const res = {};
  for (const h of ['low', 'mid', 'high']) {
    const e = setup({ heat: h });
    runUntil(e, (s) => s.drops.seq > 0, 4000, 1);
    res[h] = { first: e.state.t };
    e.advance(300);
    res[h].vol = vol(e.state.receiver.c);
  }
  assert.ok(res.low.first > res.mid.first && res.mid.first > res.high.first, JSON.stringify(res));
  assert.ok(res.high.vol > res.mid.vol && res.mid.vol > res.low.vol, JSON.stringify(res));
});

test('M-01/E-04 Heizung aus → kein Sieden; Heizstufe ist nicht die Dampftemperatur', () => {
  const e = setup({ heater: false });
  e.advance(1200);
  assert.ok(e.state.flask.T < 25, 'kalt bleibt kalt');
  assert.equal(e.state.drops.seq, 0);
  assert.equal(e.state.fx.boil, 0);
});

for (const [mix, key, lo, hi] of [['ew', 'E', 78, 81.5], ['pw', 'P', 56, 59]]) {
  test(`M-03/M-04 ${mix}: konsistente Fraktion, Dampftemperatur ${lo}–${hi} °C, Bilanz exakt`, () => {
    const e = setup({ mix });
    const st = e.state;
    runUntil(e, (s) => vol(s.receiver.c) >= 20, 4000, 2);
    balanceOk(e);
    const s = M.share(st.receiver.c);
    assert.ok(s[key] > 0.97, `${key}-Anteil ${s[key]}`);
    const snap = M.snapshot(st);
    const f = snap.fractions[0];
    assert.ok(f.Tmed >= lo && f.Tmed <= hi, 'Median ' + f.Tmed);
    assert.equal(f.thermoOk, true);
    assert.equal(f.main, key);
  });
}

test('M-03/M-04 Dreistoffgemisch: drei Abschnitte, Vorlagenwechsel, Fraktionen passen zu den Temperaturen', () => {
  const e = setup({ mix: 'pew', heat: 'mid' });
  const st = e.state;
  // Fraktion 1: Propanon – wechseln, sobald die Temperatur über 65 °C steigt
  runUntil(e, (s) => vol(s.receiver.c) > 1 && s.reading > 65, 4000, 1);
  act(e, 'changeReceiver');
  runUntil(e, (s) => vol(s.receiver.c) > 1 && s.reading > 88, 4000, 1);
  act(e, 'changeReceiver');
  runUntil(e, (s) => vol(s.receiver.c) > 3, 6000, 2);
  const snap = M.snapshot(st);
  const [f1, f2, f3] = snap.fractions;
  assert.equal(f1.main, 'P', JSON.stringify(f1.share));
  assert.equal(f2.main, 'E', JSON.stringify(f2.share));
  assert.equal(f3.main, 'W', JSON.stringify(f3.share));
  assert.ok(f1.Tmed > 56 && f1.Tmed < 60, 'F1 ' + f1.Tmed);
  assert.ok(f2.Tmed > 78 && f2.Tmed < 82, 'F2 ' + f2.Tmed);
  assert.ok(f3.Tmed > 98 && f3.Tmed <= 100.5, 'F3 ' + f3.Tmed);
  near(f1.vol, 30, 2, 'Propanon-Fraktion');
  near(f2.vol, 30, 2.5, 'Ethanol-Fraktion');
  assert.equal(st.series.filter((p) => p.change).length, 2, 'Wechsel im Diagramm markiert');
  balanceOk(e, 'Dreistoff');
  // Fraktionen bleiben erhalten, neue Vorlage startet leer
  assert.equal(st.fractions.length, 2);
  assert.equal(st.receiver.n, 3);
});

test('M-02/G-10 Temperaturverlauf: Aufheizen, Plateau, Abfall zwischen den Stoffen, Abkühlen nach dem Ausschalten', () => {
  const e = setup({});
  const st = e.state;
  const readings = [];
  for (let i = 0; i < 1900; i++) { e.advance(1); readings.push(st.reading); }
  // stetig: kein Sprung über 3 K je Sekunde
  for (let i = 1; i < readings.length; i++) assert.ok(Math.abs(readings[i] - readings[i - 1]) < 3, `Sprung bei ${i}: ${readings[i - 1]} → ${readings[i]}`);
  assert.ok(Math.max(...readings) > 95, 'erreicht nach dem Ethanol den Wasserabschnitt');
  act(e, 'setHeater', false);
  const hot = st.reading;
  e.advance(900);
  assert.ok(st.reading < hot - 15, 'Temperatur fällt nach dem Abschalten: ' + st.reading);
  assert.equal(st.fx.vapor, 0, 'Sieden endet');
  const drops = st.drops.seq;
  e.advance(120);
  assert.equal(st.drops.seq, drops, 'Tropfen laufen aus und hören auf');
});

test('M-02/E-03 Thermometerlage beeinflusst den Messwert', () => {
  const r = {};
  for (const pos of ['high', 'correct', 'low']) {
    const e = setup({ thermo: pos });
    runUntil(e, (s) => vol(s.receiver.c) >= 10, 4000, 2);
    r[pos] = M.snapshot(e.state).fractions[0];
  }
  assert.ok(r.correct.Tmed > 78 && r.correct.Tmed < 81, 'richtig ' + r.correct.Tmed);
  assert.ok(r.high.Tmed < r.correct.Tmed - 10, 'zu hoch: deutlich zu niedrig ' + r.high.Tmed);
  assert.ok(r.low.Tmed > r.correct.Tmed + 2, 'zu tief: zu hoch ' + r.low.Tmed);
  assert.equal(r.high.thermoOk, false);
  assert.equal(r.low.thermoOk, false);
  assert.equal(r.correct.thermoOk, true);
});

test('E-03 Thermometer nur im sicheren Zustand verstellbar, danach korrekt', () => {
  const e = setup({ thermo: 'high' });
  runUntil(e, (s) => s.fx.vapor > 0.01, 3000, 1);
  assert.equal(act(e, 'thermoDown').ok, false, 'nicht während des Siedens');
  act(e, 'setHeater', false);
  runUntil(e, (s) => s.fx.vapor === 0 && s.fx.pass < 1e-4, 1200, 1);
  assert.equal(act(e, 'thermoDown').ok, true);
  assert.equal(e.state.thermo, 'correct');
});

test('M-05/E-01 Kühlleistung wirkt: ohne Kühlung weniger Destillat, Verlust gebucht, Warnung und Stopp', () => {
  const T = 800;
  const a = setup({});
  a.advance(T);
  const b = setup({ water: false });
  const msgs = [];
  b.on('message', (m) => msgs.push(m.code));
  b.advance(T);
  const va = vol(a.state.receiver.c), vb = vol(b.state.receiver.c);
  assert.ok(va > 5, 'mit Kühlung Destillat ' + va);
  assert.ok(vb < va * 0.5, `ohne Kühlung deutlich weniger: ${vb} vs ${va}`);
  assert.ok(vol(b.state.lost.vapor) > 1, 'Dampfverlust gebucht');
  assert.ok(msgs.includes('escape'), 'Warnung');
  assert.equal(b.state.safety && b.state.safety.code, 'vapor', 'Sicherheitsstopp');
  assert.equal(b.state.heater.on, false);
  balanceOk(b, 'ohne Kühlung');
  // Korrektur: Kühlung einschalten, Stopp bestätigen, weiter heizen
  act(b, 'ackSafety');
  assert.equal(act(b, 'setHeater', true).ok, false, 'erst Kühlung');
  act(b, 'connectHose', 'inlet', 'low'); act(b, 'connectHose', 'outlet', 'high'); act(b, 'setWater', true);
  assert.equal(act(b, 'setHeater', true).ok, true);
  const v0 = vol(b.state.receiver.c), l0 = vol(b.state.lost.vapor);
  b.advance(300);
  assert.ok(vol(b.state.receiver.c) > v0 + 5, 'nach Korrektur wieder Destillat');
  assert.ok(vol(b.state.lost.vapor) - l0 < 0.2, 'kaum noch Verlust');
});

test('M-05 Kühlwasser AUS während des Betriebs: Kondensation sinkt verzögert', () => {
  const e = setup({});
  runUntil(e, (s) => vol(s.receiver.c) > 5, 3000, 1);
  act(e, 'setWater', false);
  e.advance(5);
  assert.equal(e.state.fx.escape, 0, 'stehendes Wasser kühlt noch kurz');
  runUntil(e, (s) => s.fx.escape > 1e-4 || s.safety, 900, 1);
  assert.ok(e.state.fx.escape > 1e-4 || e.state.safety, 'danach entweicht Dampf');
  assert.ok(e.state.jacket.T > 40, 'Mantelwasser hat sich erwärmt: ' + e.state.jacket.T);
});

test('M-05 Durchfluss wirkt bei starker Heizung', () => {
  const lost = {};
  for (const f of ['low', 'high']) { const e = setup({ heat: 'high', flow: f }); e.advance(700); lost[f] = vol(e.state.lost.vapor); }
  assert.ok(lost.low > lost.high + 0.1, JSON.stringify(lost));
});

test('E-02 Vertauschte Schläuche: Mantel nur teilweise gefüllt, mehr Verlust, Korrektur behebt es', () => {
  const ok = setup({});
  const sw = setup({ hoses: 'swap' });
  ok.advance(900); sw.advance(900);
  assert.ok(sw.state.jacket.fill < 0.2, 'Mantel nur teilweise: ' + sw.state.jacket.fill);
  assert.ok(vol(sw.state.lost.vapor) > vol(ok.state.lost.vapor) + 0.5, 'mehr Dampfverlust');
  assert.ok(vol(sw.state.receiver.c) < vol(ok.state.receiver.c), 'weniger Destillat');
  assert.ok(sw.state.mistakes.hosesSwapped >= 1);
  // Korrektur
  if (sw.state.safety) act(sw, 'ackSafety');
  act(sw, 'setWater', false);
  act(sw, 'disconnectHose', 'high'); act(sw, 'disconnectHose', 'low');
  act(sw, 'connectHose', 'inlet', 'low'); act(sw, 'connectHose', 'outlet', 'high');
  act(sw, 'setWater', true);
  sw.advance(30);
  assert.ok(sw.state.jacket.fill > 0.99, 'Mantel nach Korrektur voll');
});

test('E-04 Ohne Siedesteine: Siedeverzug, Stopp, Wiederanlauf erst mit Siedesteinen nach Abkühlen', () => {
  const e = setup({ stones: false });
  runUntil(e, (s) => !!s.safety, 3000, 1);
  assert.equal(e.state.safety.code, 'bump');
  assert.ok(vol(e.state.lost.splash) > 0, 'verspritzt');
  balanceOk(e, 'Siedeverzug');
  act(e, 'ackSafety');
  assert.equal(act(e, 'setHeater', true).ok, false, 'ohne Siedesteine kein Wiederanlauf');
  assert.equal(act(e, 'addStones').ok, false, 'nicht in heiße Flüssigkeit');
  runUntil(e, (s) => s.flask.T < 50, 6000, 5);
  assert.equal(act(e, 'addStones').ok, true);
  assert.equal(act(e, 'setHeater', true).ok, true);
  runUntil(e, (s) => vol(s.receiver.c) > 5, 3000, 2);
  assert.ok(vol(e.state.receiver.c) > 5, 'danach normale Destillation');
});

test('E-04 Zu hohe Heizleistung: heftiges Sieden, mitgerissene Flüssigkeit verunreinigt das Destillat', () => {
  const mid = setup({}); const high = setup({ heat: 'high' });
  const msgs = []; high.on('message', (m) => msgs.push(m.code));
  runUntil(mid, (s) => vol(s.receiver.c) >= 20, 4000, 2);
  runUntil(high, (s) => vol(s.receiver.c) >= 20, 4000, 2);
  assert.ok(msgs.includes('violent'), 'Warnung heftiges Sieden');
  assert.ok(M.share(high.state.receiver.c).E < M.share(mid.state.receiver.c).E - 0.01, 'weniger rein');
  balanceOk(high, 'hoch');
});

test('E-04 Vorlage fehlt: Tropfen gehen verloren und zählen nicht als Destillat', () => {
  const e = setup({});
  act(e, 'toggleReceiver');
  assert.equal(e.state.receiver.present, false);
  runUntil(e, (s) => s.drops.seq > 40, 3000, 1);
  assert.equal(vol(e.state.receiver.c), 0);
  assert.ok(vol(e.state.lost.table) > 1);
  assert.equal(M.snapshot(e.state).collected, 0);
  act(e, 'toggleReceiver');
  e.advance(60);
  assert.ok(vol(e.state.receiver.c) > 0, 'nach dem Unterstellen wird aufgefangen');
  balanceOk(e);
});

test('E-05 Geschlossene Apparatur: Stopp beim Heizen mit Stopfen, Wiederanlauf nach dem Entfernen', () => {
  const e = setup({ heater: false });
  act(e, 'toggleStopper');
  const r = act(e, 'setHeater', true);
  assert.equal(r.safety, true);
  assert.equal(e.state.safety.code, 'closed');
  assert.equal(e.state.heater.on, false);
  act(e, 'ackSafety');
  act(e, 'toggleStopper');
  assert.equal(act(e, 'setHeater', true).ok, true);
  // Stopfen während des Betriebs
  e.advance(100);
  act(e, 'toggleStopper');
  assert.equal(e.state.safety.code, 'closed');
});

test('E-05 Trockenlauf: Stopp bevor der Kolben leer ist', () => {
  const e = setup({ heat: 'high', flow: 'high' });
  runUntil(e, (s) => !!s.safety, 20000, 5);
  assert.equal(e.state.safety.code, 'dry');
  assert.ok(vol(e.state.flask.c) > 0 && vol(e.state.flask.c) < 4);
  act(e, 'ackSafety');
  assert.equal(act(e, 'setHeater', true).ok, false, 'Neustart nötig');
  assert.equal(act(e, 'restart').ok, true);
  assert.equal(e.state.history.length, 1, 'Ergebnis archiviert');
  assert.equal(e.state.filled, false);
});

test('E-05/E-06 Zünden an der Apparatur stoppt; Probe aus heißem Kolben stoppt', () => {
  const e = setup({});
  e.advance(700);
  assert.equal(act(e, 'ignite', 'apparatus').safety, true);
  assert.equal(e.state.safety.code, 'ignite');
  act(e, 'ackSafety');
  assert.equal(act(e, 'takeSample', 'flask').safety, true);
  assert.equal(e.state.safety.code, 'hotSample');
});

test('E-06 Brennprobe: Probe aus der Vorlage, Schale, Zünden, bläuliche Flamme, Verbrauch', () => {
  const e = setup({});
  runUntil(e, (s) => vol(s.receiver.c) >= 6, 3000, 1);
  assert.equal(act(e, 'ignite', 'dish').ok, false, 'leere Schale');
  assert.equal(act(e, 'takeSample', 'receiver').ok, true);
  assert.ok(e.state.pipette);
  assert.equal(act(e, 'sampleToDish').ok, true);
  const E0 = e.state.dish.c.E;
  const r = act(e, 'ignite', 'dish');
  assert.equal(r.result, 'burns');
  e.advance(1);
  assert.ok(e.state.fx.flame > 0.2, 'Flamme sichtbar');
  e.advance(30);
  assert.ok(!e.state.dish.burning, 'begrenzte Brenndauer');
  assert.ok(e.state.dish.c.E < E0 * 0.5, 'Ethanol verbraucht');
  assert.equal(e.state.fx.flame, 0);
  balanceOk(e, 'Brennprobe');
  assert.equal(act(e, 'ignite', 'dish').ok, false, 'geprüfte Probe nicht erneut');
});

test('E-06 Brennprobe: Schwellen und nur bei Ethanol/Wasser', () => {
  assert.equal(M.burnResult({ P: 0, E: 0.9, W: 0.1 }), 'burns');
  assert.equal(M.burnResult({ P: 0, E: 0.4, W: 0.6 }), 'flicker');
  assert.equal(M.burnResult({ P: 0, E: 0.2, W: 0.8 }), 'none');
  const e = setup({ mix: 'pw' });
  runUntil(e, (s) => vol(s.receiver.c) >= 3, 3000, 1);
  assert.equal(act(e, 'takeSample', 'receiver').ok, false);
});

test('M-06 Feste Zeitschritte: gleiche Modellzeit → gleiches Ergebnis, unabhängig von der Taktung', () => {
  const a = setup({}); const b = setup({});
  for (let i = 0; i < 600; i++) a.advance(1.5); // „1×“ mit 60 Bildern … grob
  let t = 0; while (t + 0.37 <= 900) { b.advance(0.37); t += 0.37; }
  b.advance(900 - t);
  const pick = (s) => [s.t.toFixed(6), s.flask.T.toFixed(9), vol(s.receiver.c).toFixed(9), s.reading.toFixed(9), s.drops.seq];
  assert.deepEqual(pick(b.state), pick(a.state));
});

test('M-04 Bilanz in allen Gemischen über einen langen Versuch', () => {
  for (const mix of M.MIX_ORDER) {
    const e = setup({ mix });
    for (let i = 0; i < 30; i++) { e.advance(60); balanceOk(e, `${mix} @ ${e.state.t}`); }
  }
});

test('S-01 Dreistoffgemisch nur im Expertenmodus', () => {
  const e = M.createEngine();
  assert.equal(act(e, 'selectMix', 'pew').ok, false);
  act(e, 'setExpert', true);
  assert.equal(act(e, 'selectMix', 'pew').ok, true);
  act(e, 'fill');
  assert.equal(act(e, 'selectMix', 'ew').ok, false, 'nach dem Befüllen kein Wechsel ohne Neustart');
});

test('S-03 Schläuche: Zuordnung, Belegung, Umstecken nur bei abgedrehtem Wasser', () => {
  const e = M.createEngine();
  assert.equal(act(e, 'setWater', true).ok, false, 'ohne Schläuche');
  act(e, 'connectHose', 'inlet', 'low');
  assert.equal(act(e, 'connectHose', 'outlet', 'low').ok, false, 'belegt');
  act(e, 'connectHose', 'outlet', 'high');
  assert.equal(act(e, 'setWater', true).ok, true);
  assert.equal(act(e, 'disconnectHose', 'low').ok, false, 'Wasser läuft');
  e.advance(20);
  assert.ok(e.state.jacket.fill > 0.99, 'Mantel füllt sich von unten');
});

test('Neustart behält Ergebnisse, Snapshot unveränderlich', () => {
  const e = setup({});
  runUntil(e, (s) => vol(s.receiver.c) > 3, 3000, 1);
  const v = vol(e.state.receiver.c);
  act(e, 'restart', 'pw');
  assert.equal(e.state.mix, 'pw');
  assert.equal(e.state.run, 2);
  near(e.state.history[0].fractions[0].vol, v, 1e-9, 'archiviertes Volumen');
});
