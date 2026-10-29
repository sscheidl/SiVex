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

test('Befund 9: Vorstoß mit Belüftung – kein Stopfen, kein Stopp „geschlossene Apparatur“; alte Zustände werden bereinigt', () => {
  const e = setup({ heater: false });
  assert.equal(e.act('toggleStopper').code, 'unknown', 'Handlung „Stopfen“ gibt es nicht mehr');
  assert.ok(!('closed' in M.SAFETY), 'kein Sicherheitsstopp „geschlossene Apparatur“');
  assert.ok(!('stopper' in e.state.receiver), 'Vorlage ohne Stopfen');
  assert.equal(act(e, 'setHeater', true).ok, true);
  runUntil(e, (s) => vol(s.receiver.c) > 5, 3000, 1);
  assert.equal(e.state.safety, null, 'Destillation läuft ohne Stopp');
  // gespeicherter Zustand einer älteren Fassung mit aufgesetztem Stopfen und offenem Stopp
  const old = JSON.parse(JSON.stringify(e.state));
  old.receiver.stopper = true;
  old.safety = { code: 'closed', title: 'Sicherheitsstopp: geschlossene Apparatur', text: '', fix: '', t: 1 };
  delete old.tx;
  const e2 = M.createEngine(old);
  assert.equal(e2.state.safety, null);
  assert.ok(!('stopper' in e2.state.receiver));
  assert.equal(e2.state.tx, e2.state.t, 'Versuchszeit aus der Modellzeit übernommen');
});

test('Befund 6: Siedesteine – maßgeblich ist die Flüssigkeit im Kolben, die Meldung nennt ihre Temperatur', () => {
  const e = setup({ stones: false, heater: true });
  // ohne Siedesteine aufheizen, bis die Flüssigkeit 60 °C hat – das Thermometer oben zeigt noch Raumtemperatur
  assert.ok(runUntil(e, (s) => s.flask.T >= 60, 2000, 0.5));
  act(e, 'setHeater', false);
  const st = e.state;
  assert.ok(st.reading < 21, 'Dampftemperatur noch ≈ 20 °C: ' + st.reading);
  const r = act(e, 'addStones');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'stonesHot');
  assert.match(r.message, /Flüssigkeit im Kolben ist noch etwa 6\d °C heiß/);
  assert.match(r.message, /Thermometer oben misst nur den Dampf/);
  // abkühlen lassen: unter 50 °C Flüssigkeit sind Siedesteine erlaubt, auch wenn der Heizpilz noch wärmer ist
  assert.ok(runUntil(e, (s) => s.flask.T < 49.9, 4000, 1));
  assert.ok(st.mantleT > st.flask.T - 1, 'Heizpilz nicht kälter als die Flüssigkeit');
  assert.equal(act(e, 'addStones').ok, true);
  assert.equal(st.stones, true);
});

test('Befund 8: Leer destillierter Kolben darf neu befüllt werden; danach läuft der Versuch weiter', () => {
  const e = setup({ heat: 'high', flow: 'high' });
  runUntil(e, (s) => !!s.safety, 20000, 5);
  const st = e.state;
  assert.equal(st.safety.code, 'dry');
  act(e, 'ackSafety');
  // noch heiß: abgelehnt mit Hinweis auf die Wärme, nicht „schon befüllt“
  let r = act(e, 'fill');
  assert.equal(r.code, 'hot');
  assert.ok(runUntil(e, (s) => s.flask.T < 40 && s.mantleT < 45, 20000, 10));
  const before = vol(st.flask.c);
  assert.ok(before < M.REFILL_BELOW);
  r = act(e, 'fill');
  assert.equal(r.ok, true, r.message);
  near(vol(st.flask.c), before + M.FILL_VOLUME, 1e-6, 'Kolben enthält Rest + 100 mL');
  near(vol(st.charged), 2 * M.FILL_VOLUME, 1e-6, 'Bilanz zählt beide Füllungen');
  balanceOk(e, 'Bilanz nach dem Nachfüllen');
  // ein voller Kolben bleibt gesperrt
  assert.equal(act(e, 'fill').code, 'filled');
  // Heizen ist wieder möglich, ohne den Versuch neu zu beginnen
  assert.equal(act(e, 'setHeater', true).ok, true);
  const v0 = vol(st.receiver.c);
  runUntil(e, (s) => vol(s.receiver.c) > v0 + 3, 4000, 1);
  assert.ok(vol(st.receiver.c) > v0 + 3, 'neues Destillat');
  assert.equal(st.run, 1, 'kein neuer Versuch nötig');
});

test('Befund 7: Dampfzusammensetzung aus dem Modell – beim Ethanol-Abschnitt Ethanol, bei 99,9 °C nur Wasser', () => {
  const e = setup({ heat: 'high', flow: 'high' });
  const st = e.state;
  assert.ok(runUntil(e, (s) => s.fx.pass > 1e-4 && s.flask.c.E > 10, 3000, 1));
  assert.ok(st.fx.vy[1] > 0.95 && st.fx.py[1] > 0.95, 'Ethanol-Abschnitt: Dampf ≈ Ethanol ' + st.fx.vy);
  assert.ok(runUntil(e, (s) => s.flask.c.E === 0 && s.reading > 99.5 && s.fx.pass > 1e-4, 8000, 1), 'Wasser-Abschnitt erreicht');
  assert.deepEqual(st.fx.vy.map((x) => Math.round(x * 1000) / 1000), [0, 0, 1], 'nur Wasser verdampft');
  assert.deepEqual(st.fx.py.map((x) => Math.round(x * 1000) / 1000), [0, 0, 1], 'nur Wasser kondensiert');
});

test('Befund 13: Nach dem Abkühlen klingen Sieden und Siedekeime auf genau 0 ab', () => {
  const e = setup();
  const st = e.state;
  runUntil(e, (s) => vol(s.receiver.c) > 3, 3000, 1);
  assert.ok(st.fx.boil > 0.05);
  act(e, 'setHeater', false);
  assert.ok(runUntil(e, (s) => s.flask.T < 21, 20000, 10), 'abgekühlt');
  for (const k of ['boil', 'nucleate', 'vapor', 'pass', 'cond', 'violent', 'carry']) assert.equal(st.fx[k], 0, k);
  // bereits wenige Sekunden nach dem Ende des Siedens
  const e2 = setup();
  runUntil(e2, (s) => vol(s.receiver.c) > 3, 3000, 1);
  act(e2, 'setHeater', false);
  runUntil(e2, (s) => s.fx.vapor === 0, 3000, 1);
  e2.advance(10);
  assert.equal(e2.state.fx.boil, 0, 'kein Sieden 10 s nach dem letzten Dampf');
});

test('Befund 16: Versuchszeit steht nach dem Ende des Versuchs und läuft beim erneuten Heizen weiter', () => {
  const e = setup();
  const st = e.state;
  e.advance(30);
  near(st.tx, st.t, 1e-9, 'vor dem Ende: Versuchszeit = Modellzeit');
  runUntil(e, (s) => vol(s.receiver.c) > 4, 3000, 1);
  act(e, 'setHeater', false);
  assert.ok(runUntil(e, (s) => s.ended, 3000, 1), 'Versuch beendet');
  const tx = st.tx, n = st.series.length;
  e.advance(600);
  assert.equal(st.tx, tx, 'Uhr steht');
  assert.equal(st.series.length, n, 'Diagramm zeichnet nicht weiter');
  assert.ok(st.t > tx + 590, 'Modell (Abkühlen) läuft weiter');
  act(e, 'setHeater', true);
  e.advance(20);
  assert.ok(!st.ended && st.tx > tx + 19, 'läuft beim erneuten Heizen weiter');
  assert.ok(st.series[st.series.length - 1].t <= st.tx + 1e-9, 'Diagramm über der Versuchszeit');
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
  assert.equal(act(e, 'takeSample', 'receiver').ok, false, 'nicht aus der montierten Vorlage');
  act(e, 'setHeater', false);
  act(e, 'toggleReceiver');
  assert.equal(e.state.receiver.present, false, 'Vorlage abgenommen');
  assert.equal(act(e, 'takeSample', 'receiver').ok, true);
  assert.ok(e.state.pipette);
  assert.equal(act(e, 'sampleToDish').ok, true);
  const E0 = e.state.dish.c.E;
  act(e, 'ignite', 'dish');
  assert.equal(e.state.dish.result, 'burns', 'Ergebnis nach dem Zünd-Handgriff');
  assert.ok(e.state.burnTests.length === 1);
  e.advance(1);
  assert.ok(e.state.fx.flame > 0.2, 'Flamme sichtbar');
  e.advance(30);
  assert.ok(!e.state.dish.burning, 'begrenzte Brenndauer');
  assert.ok(e.state.dish.c.E < E0 * 0.5, 'Ethanol verbraucht');
  assert.equal(e.state.fx.flame, 0);
  balanceOk(e, 'Brennprobe');
  assert.equal(act(e, 'ignite', 'dish').ok, false, 'geprüfte Probe nicht erneut');
});

test('E-06 Brennprobe: Schwellen; Ethanol- und Propanon-Versuch, nicht im Dreistoffgemisch', () => {
  assert.equal(M.burnResult({ P: 0, E: 0.9, W: 0.1 }), 'burns');
  assert.equal(M.burnResult({ P: 0, E: 0.4, W: 0.6 }), 'flicker');
  assert.equal(M.burnResult({ P: 0, E: 0.2, W: 0.8 }), 'none');
  assert.equal(M.burnResult({ P: 0.9, E: 0, W: 0.1 }), 'burns');
  const x = setup({ mix: 'pew' });
  runUntil(x, (s) => vol(s.receiver.c) >= 3, 3000, 1);
  act(x, 'toggleReceiver');
  assert.equal(act(x, 'takeSample', 'receiver').code, 'noBurnTest', 'Dreistoffgemisch ohne Brennprobe');
});

test('E-06 Brennprobe mit Propanon: gelbliche, leuchtende Flamme, Propanon verbrennt, Bilanz stimmt', () => {
  const e = setup({ mix: 'pw' });
  const msgs = [];
  e.on('message', (m) => msgs.push(m.text));
  runUntil(e, (s) => vol(s.receiver.c) >= 6, 3000, 1);
  act(e, 'setHeater', false);
  act(e, 'toggleReceiver');
  assert.equal(act(e, 'takeSample', 'receiver').ok, true, 'Probe aus der abgenommenen Vorlage');
  assert.equal(act(e, 'sampleToDish').ok, true);
  const P0 = e.state.dish.c.P;
  act(e, 'ignite', 'dish');
  assert.equal(e.state.dish.result, 'burns');
  assert.equal(e.state.dish.fuel, 'P');
  assert.equal(e.state.burnTests[0].fuel, 'P');
  assert.ok(msgs.some((t) => /gelblicher, leuchtender Flamme/.test(t)), 'Meldung nennt die gelbliche Flamme: ' + msgs.slice(-2).join(' | '));
  e.advance(1);
  assert.ok(e.state.fx.flame > 0.2, 'Flamme brennt an (erlischt nicht sofort)');
  e.advance(30);
  assert.ok(!e.state.dish.burning, 'begrenzte Brenndauer');
  assert.ok(e.state.dish.c.P < P0 * 0.5, 'Propanon verbraucht');
  balanceOk(e, 'Brennprobe Propanon');
});

test('M-03 Warnung, bevor nach dem Ethanol das Wasser übergeht', () => {
  const e = setup({});
  const msgs = [];
  e.on('message', (m) => msgs.push(m.code));
  runUntil(e, (s) => s.flask.c.E < 0.04 * s.charged.E, 4000, 1);
  e.advance(2);
  assert.ok(msgs.includes('breakthrough1'), 'Warnung ausgegeben: ' + msgs.join(','));
  assert.ok(M.share(e.state.receiver.c).E > 0.95, 'zum Zeitpunkt der Warnung ist das Destillat noch rein');
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

test('M-04 Volle Vorlage läuft über die Öffnung über: weitere Tropfen gehen auf den Tisch, Bilanz stimmt', () => {
  const e = setup({ heat: 'high' });
  assert.ok(runUntil(e, (st) => st.drops.list.length > 0, 1500), 'es tropft');
  const st = e.state, r = st.receiver;
  // Vorlage bis zum Rand füllen; das zugegebene Wasser zählt als eingesetzt, damit die Bilanz geschlossen bleibt
  const add = M.RECV_ML - vol(r.c);
  r.c.W += add; st.charged.W += add;
  const table0 = vol(st.lost.table), n0 = st.drops.seq;
  assert.ok(runUntil(e, (s) => s.drops.seq > n0 + 5, 600), 'weitere Tropfen');
  assert.ok(vol(r.c) <= M.RECV_ML + 1e-9, 'Vorlage nie über den Rand gefüllt: ' + vol(r.c));
  assert.ok(vol(st.lost.table) > table0 + 4 * M.DROP_VOL * 0.999, 'Überlauf landet auf dem Tisch');
  balanceOk(e, 'Bilanz mit Überlauf');
});

test('M-07 Einbruch zwischen den Fraktionen: Anzeige sinkt merklich, aber nicht bis zur Raumtemperatur; vor dem ersten Sieden bleibt sie kalt', () => {
  for (const [mix, plateau] of [['pw', 56], ['ew', 78]]) {
    const e = setup({ mix, heat: 'mid' });
    const st = e.state;
    let firstVapor = null, maxPlateau = 0, minAfter = Infinity, reached100 = false;
    for (let t = 0; t < 2400 && !reached100; t += 5) {
      e.advance(5);
      if (!st.headWet && st.flask.T < plateau - 3) firstVapor = st.reading; // Flüssigkeit warm, Aufsatz noch voll Luft
      const low = st.flask.c[mix === 'pw' ? 'P' : 'E'];
      if (low > 1) maxPlateau = Math.max(maxPlateau, st.reading);
      else if (maxPlateau > 0) minAfter = Math.min(minAfter, st.reading);
      if (st.reading > 99) reached100 = true;
    }
    assert.ok(firstVapor < 30, `${mix}: vor der Dampffront kalt (${firstVapor})`);
    assert.ok(Math.abs(maxPlateau - plateau) < 4, `${mix}: Plateau ${maxPlateau}`);
    const dip = maxPlateau - minAfter;
    assert.ok(dip > 5 && dip < 22, `${mix}: Einbruch ${dip.toFixed(1)} K`);
    assert.ok(minAfter > 40, `${mix}: kein Absturz zur Raumtemperatur (${minAfter.toFixed(1)} °C)`);
    assert.ok(reached100, `${mix}: danach Wasser bei 100 °C`);
  }
});
