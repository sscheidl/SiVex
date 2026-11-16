// Versuchszustand und Bedienablauf ohne Browser: Buchung beim Eintreffen, Tropfenfolge, Grenzen der
// Anleitung, Fassungsvermögen, Absetzen/Schwenken, zeitabhängiges Auflösen, Bilanzen, Pause, Speicher.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../js/chem.js');
const M = require('../../js/model.js');

const TOL = 1e-6;
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const run = (L, s, dt = 1 / 60) => { for (let t = 0; t < s; t += dt) L.step(dt); };
const idle = (L, max = 60) => { let t = 0; while (L.busy() && t < max) { L.step(1 / 60); t += 1 / 60; } assert.ok(t < max, 'Handgriff endet'); };
function lab() { const L = M.create(); L.setWorldWidth(1100); return L; }
/** Probe einfüllen wie Lernende: Flasche → Reagenzglas, dann warten. */
function sample(L, key, slot) { L.selectBottle(key); run(L, 0.5); L.target(slot); idle(L); }
function reagent(L, key, slot) { L.selectBottle(key); run(L, 0.5); L.target(slot); idle(L); }
function dropsN(L, n) { for (let i = 0; i < n; i++) { assert.ok(L.dropOnce(), 'Tropfen ' + i); idle(L); } }
const forbidden = (L) => L.drain().filter((e) => e.type === 'forbidden');

test('Probe läuft mit eingestelltem Volumen ein; Ansatzkennung entsteht', () => {
  const L = lab();
  sample(L, 'nacl', 0);
  const t = L.tube(0);
  assert.ok(rel(t.V, 2.0) < TOL);
  assert.ok(rel(t.n.Na, 2e-4) < TOL && rel(t.n.X, 2e-4) < TOL);
  assert.equal(t.ansatz, 'A1');
  assert.equal(t.halide, 'Cl');
  L.setSampleVol(3); L.returnPipette(); idle(L);
  sample(L, 'nai', 1);
  assert.ok(rel(L.tube(1).V, 3.0) < TOL);
  assert.equal(L.tube(1).ansatz, 'A2');
});

test('Buchung erst beim Eintreffen: Tropfen im Flug ändert den Ansatz noch nicht', () => {
  const L = lab();
  sample(L, 'nabr', 0);
  reagent(L, 'agno3', 0);
  const V0 = L.tube(0).V;
  assert.ok(L.dropOnce());
  L.step(1 / 60);
  assert.equal(L.state.drops.length, 1, 'Tropfen fällt');
  assert.equal(L.tube(0).V, V0, 'noch nicht gebucht');
  assert.equal(L.tube(0).n.Ag, 0);
  idle(L);
  assert.ok(rel(L.tube(0).V - V0, 0.05) < TOL);
  assert.ok(rel(L.tube(0).n.Ag, 5e-6) < TOL);
  assert.ok(M.solidTotal(L.tube(0)) > 0, 'Fällung am Eintreffpunkt');
  assert.equal(L.tube(0).clouds.length, 1, 'lokale Wolke');
});

test('Tippen = genau ein Tropfen; schnelles Doppeltippen erzeugt keine Doppelbuchung', () => {
  const L = lab();
  sample(L, 'nacl', 0); reagent(L, 'agno3', 0);
  assert.ok(L.dropOnce());
  assert.equal(L.dropOnce(), false, 'zweiter Tipp innerhalb des Mindestintervalls');
  idle(L);
  assert.equal(L.tube(0).log.agDrops, 1);
});

test('Gedrückthalten: Tropfenfolge mit begrenztem Tempo, endet sofort beim Loslassen', () => {
  const L = lab();
  sample(L, 'nacl', 0); reagent(L, 'agno3', 0);
  L.startHold();
  run(L, 2.0);
  L.stopHold();
  const emitted = L.tube(0).log.agDrops + L.state.drops.length;
  // 1 + floor((2,0 − 0,45)/0,38) + 1 = 6 Tropfen in 2 s (≈ 3 Tropfen/s)
  assert.ok(emitted >= 5 && emitted <= 6, 'Tropfen: ' + emitted);
  idle(L); run(L, 2);
  assert.equal(L.tube(0).log.agDrops, emitted, 'nach dem Loslassen kein weiterer Tropfen');
  L.startHold(); run(L, 1); L.cancelInput(); idle(L); run(L, 1);
  const n2 = L.tube(0).log.agDrops; run(L, 2);
  assert.equal(L.tube(0).log.agDrops, n2, 'Abbruch (pointercancel/blur) beendet die Folge');
});

test('Grenzen der Anleitung: kein Stofftransfer, kurzer Hinweis, danach weiter bedienbar', () => {
  const L = lab();
  sample(L, 'nacl', 0); L.drain();
  // NH₃ vor dem Silbernitrat
  L.selectBottle('nh3dil'); run(L, 0.5);
  const before = JSON.stringify(L.tube(0));
  assert.equal(L.target(0), false);
  let f = forbidden(L);
  assert.equal(f.length, 1);
  assert.equal(f[0].text, 'Dieser Vorgang entspricht nicht der Experimentieranleitung.');
  idle(L); run(L, 1);
  assert.equal(JSON.stringify(L.tube(0)), before, 'Zustand unverändert');
  // zweite, andere Probelösung in denselben Ansatz
  L.selectBottle('nabr'); run(L, 0.5);
  assert.equal(L.target(0), false); f = forbidden(L); assert.equal(f.length, 1);
  // Silbernitrat in ein leeres Glas
  L.selectBottle('agno3'); run(L, 0.5);
  assert.equal(L.target(1), false); f = forbidden(L); assert.equal(f.length, 1);
  assert.equal(L.tube(1).V, 0);
  // korrekte Handlung bleibt möglich
  assert.equal(L.target(0), true); idle(L);
  assert.ok(L.dropOnce()); idle(L);
  assert.equal(L.tube(0).log.agDrops, 1);
  // jetzt ist NH₃ zulässig, auch wiederholt
  L.selectBottle('nh3dil'); run(L, 0.5);
  assert.equal(L.target(0), true); idle(L);
  assert.ok(L.dropOnce()); idle(L); run(L, 0.3); assert.ok(L.dropOnce()); idle(L);
  assert.ok(rel(L.tube(0).log.nh3dilV, 0.1) < TOL);
  assert.equal(M.rule('control', 'nh3dil', L.tube(0)) !== null, true, 'kein Ammoniak im Kontrollteil');
});

test('Fassungsvermögen: aktive Zugabe stoppt, „Reagenzglas ist voll“, Bilanz bleibt', () => {
  const L = lab();
  L.setSampleVol(3); sample(L, 'nacl', 0); reagent(L, 'agno3', 0);
  L.dropOnce(); idle(L);
  L.selectBottle('water'); run(L, 0.5); L.target(0); idle(L); L.drain();
  for (let i = 0; i < 40; i++) { L.dose(1.0); idle(L, 120); }
  const t = L.tube(0);
  assert.ok(t.V <= C.CAPACITY_ML + 1e-9, 'nicht überfüllt: ' + t.V);
  assert.ok(t.V > C.CAPACITY_ML - 0.051, 'bis an die Grenze');
  assert.ok(L.drain().some((e) => e.type === 'full' && e.text === 'Reagenzglas ist voll.'));
  assert.ok(rel(t.V, 3 + 0.05 + t.log.waterV) < TOL, 'Volumenbilanz');
  assert.ok(rel(t.n.Ag + M.solidTotal(t) * 0, 5e-6) < TOL);
});

test('Absetzen und Schwenken: Feststoffmenge bleibt erhalten, Front wandert, Aufwirbeln', () => {
  const L = lab();
  sample(L, 'nacl', 0); reagent(L, 'agno3', 0); dropsN(L, 10);
  const t = L.tube(0);
  const p0 = M.solidTotal(t);
  run(L, 3.2);
  assert.equal(t.clouds.length, 0, 'Wolken verteilt');
  assert.ok(t.susp > 0.9 * p0);
  run(L, 15);
  assert.ok(t.front > 0.3 && t.front < 0.6, 'Absetzfront unterwegs: ' + t.front);
  assert.ok(t.sed > 0 && t.susp > 0);
  assert.ok(rel(M.solidTotal(t), p0) < TOL);
  run(L, 40);
  assert.equal(t.susp, 0); assert.ok(rel(t.sed, p0) < TOL, 'vollständig abgesetzt');
  L.shake(0);
  assert.ok(rel(t.susp, p0) < TOL && t.sed === 0 && t.front === 0, 'wieder aufgewirbelt');
  idle(L);
  assert.ok(rel(M.solidTotal(t), p0) < TOL, 'keine Mengenerzeugung oder -vernichtung');
});

test('Trübung hängt von der Tropfenzahl ab (keine identische Maximaltrübung)', () => {
  const vis = (n) => {
    const L = lab(); sample(L, 'nacl', 0); reagent(L, 'agno3', 0); dropsN(L, n); run(L, 3.2);
    const t = L.tube(0); return M.turbidity(t.susp / (t.V / 1000) * 1000);
  };
  const a = vis(1), b = vis(5), c = vis(20);
  assert.ok(a > 0.2 && a < b && b < c, `${a} < ${b} < ${c}`);
  assert.ok(c - a > 0.25);
});

test('NH₃: zeitlich fortschreitendes Auflösen von AgCl, mengenabhängig; AgI bleibt', () => {
  const L = lab();
  sample(L, 'nacl', 0); reagent(L, 'agno3', 0); dropsN(L, 10); run(L, 4);
  const p0 = M.solidTotal(L.tube(0));
  // zu wenig: 0,5 mL verdünnt → Rest bleibt
  L.selectBottle('nh3dil'); run(L, 0.5); L.target(0); idle(L);
  L.dose(0.5); idle(L);
  run(L, 1.0);
  const mid = M.solidTotal(L.tube(0));
  assert.ok(mid < p0 && mid > 0.6 * p0, 'Auflösen läuft sichtbar: ' + mid / p0);
  run(L, 40); L.shake(0); run(L, 30);
  const rest = M.solidTotal(L.tube(0));
  const ref = C.equilibrium({ V: L.tube(0).V, Ag: L.tube(0).n.Ag, X: L.tube(0).n.X, N: L.tube(0).n.N, halide: 'Cl' }).solid;
  assert.ok(rest > 0.4 * p0, 'zu kleine Menge: Rest bleibt');
  assert.ok(Math.abs(rest - ref) < 1e-3 * p0, 'nähert sich dem Gleichgewicht');
  // ausreichend: weitere 1,0 mL → vollständig gelöst
  L.dose(1.0); idle(L); run(L, 30); L.shake(0); run(L, 30);
  assert.ok(M.solidTotal(L.tube(0)) < 1e-12, 'AgCl gelöst');
  // AgI mit konzentrierter NH₃
  sample(L, 'nai', 1); reagent(L, 'agno3', 1); dropsN(L, 10); run(L, 4);
  const q0 = M.solidTotal(L.tube(1));
  L.selectBottle('nh3conc'); run(L, 0.5); L.target(1); idle(L);
  L.dose(1.0); idle(L); L.dose(1.0); idle(L); L.dose(1.0); idle(L); L.dose(1.0); idle(L); L.dose(1.0); idle(L);
  run(L, 30); L.shake(1); run(L, 30);
  assert.ok(M.solidTotal(L.tube(1)) / q0 > 0.95, 'AgI bleibt sichtbar');
});

test('AgBr: verdünnt weitgehend beständig, konzentriert bei geeigneter Menge löslich', () => {
  const L = lab();
  for (const s of [0, 1]) { sample(L, 'nabr', s); reagent(L, 'agno3', s); dropsN(L, 10); L.returnPipette(); idle(L); }
  run(L, 4);
  const p0 = M.solidTotal(L.tube(0));
  L.selectBottle('nh3dil'); run(L, 0.5); L.target(0); idle(L); L.dose(1.0); idle(L); L.dose(1.0); idle(L); L.dose(0.5); idle(L);
  L.selectBottle('nh3conc'); run(L, 0.5); L.target(1); idle(L); L.dose(1.0); idle(L); L.dose(1.0); idle(L); L.dose(0.5); idle(L);
  run(L, 30); L.shake(0); L.shake(1); run(L, 40);
  assert.ok(M.solidTotal(L.tube(0)) / p0 > 0.9, 'verdünnt: > 90 % bleiben');
  assert.ok(M.solidTotal(L.tube(1)) / p0 < 0.15, 'konzentriert: weitgehend gelöst');
  assert.notEqual(L.tube(0).ansatz, L.tube(1).ansatz, 'zwei getrennte, gleich angesetzte Ansätze');
});

test('Bilanzen über einen vollständigen Ablauf (Toleranz 1e-6 relativ)', () => {
  const L = lab();
  sample(L, 'nacl', 0); reagent(L, 'agno3', 0); dropsN(L, 12);
  L.selectBottle('water'); run(L, 0.5); L.target(0); idle(L); L.dose(1.0); idle(L);
  L.selectBottle('nh3dil'); run(L, 0.5); L.target(0); idle(L); L.dose(1.0); idle(L);
  for (let i = 0; i < 600; i++) {
    L.step(0.05);
    const t = L.tube(0), sp = M.species(t);
    for (const k of ['V', 'solid', 'Na', 'NO3', 'Ag', 'X', 'N', 'dissolvedAg', 'dissolvedX']) assert.ok(isFinite(sp[k]) && sp[k] >= -1e-18, k + '=' + sp[k]);
  }
  const t = L.tube(0);
  const ref = { V: 2 + 12 * 0.05 + 1 + 1, Na: 2e-4, NO3: 12 * 5e-6, Ag: 12 * 5e-6, X: 2e-4, N: 1e-3 * 2.0 };
  for (const k of Object.keys(ref)) assert.ok(rel(k === 'V' ? t.V : t.n[k], ref[k]) < TOL, k);
  const sp = M.species(t);
  assert.ok(rel(sp.solid + sp.dissolvedAg, ref.Ag) < TOL, 'Silberbilanz');
  assert.ok(rel(sp.solid + sp.dissolvedX, ref.X) < TOL, 'Halogenidbilanz');
  assert.ok(rel(sp.Na, sp.NO3 + 1.4e-4) < TOL, 'Zuschauerionen unverändert (Na⁺ aus Probe, NO₃⁻ aus Reagenz)');
});

test('Kontrollversuche: positiv trüb, Blindprobe klar, Alltagswasser trüb (begrenzt)', () => {
  const L = lab();
  L.setTab('control');
  const keys = ['nacl', 'water', 'tap', 'mineral'];
  keys.forEach((k, i) => { L.selectBottle(k); run(L, 0.5); L.target(i); idle(L); });
  L.selectBottle('agno3'); run(L, 0.5);
  keys.forEach((k, i) => { L.target(i); idle(L); L.drops(5); idle(L, 30); });
  run(L, 4);
  const s = keys.map((k, i) => M.solidTotal(L.tube(i, 'control')));
  assert.ok(rel(s[0], 25e-6) < 1e-3, 'Positivkontrolle');
  assert.equal(s[1], 0, 'Blindprobe ohne Fällung');
  assert.ok(rel(s[2], C.WATER.tap.F * 2e-3) < TOL && s[3] > s[2], 'Wasserproben: begrenzte Mischfällung');
  assert.equal(L.tube(0, 'control').ansatz, 'K1');
  for (let i = 0; i < 4; i++) assert.equal(L.tube(i, 'control').log.agDrops, 5, 'vergleichbare AgNO₃-Mengen');
  assert.ok(M.turbidity(s[2] / 2.25e-3 * 1000) > 0.2, 'Leitungswasser sichtbar trüb');
  // Hauptteil unberührt
  assert.ok(L.tab('main').tubes.every((t) => t.V === 0));
});

test('Pause: nichts läuft; Bedienen beendet die Pause; Zeitraffer nur ohne Handgriff', () => {
  const L = lab();
  sample(L, 'nacl', 0); reagent(L, 'agno3', 0); dropsN(L, 3);
  L.setSpeed(0); L.drain();
  const f0 = L.tube(0).front;
  run(L, 3);
  assert.equal(L.tube(0).front, f0);
  assert.ok(L.dropOnce(), 'Bedienen in der Pause');
  assert.equal(L.state.speed, 1);
  assert.ok(L.drain().some((e) => e.type === 'toast'));
  L.setSpeed(5);
  assert.ok(L.busy());
  const dt = L.step(0.1);
  assert.ok(Math.abs(dt - 0.1) < 1e-12, 'während des Handgriffs höchstens 1×');
  idle(L);
  assert.ok(Math.abs(L.step(0.1) - 0.5) < 1e-12, 'danach 5×');
});

test('Reiterwechsel schließt den Handgriff ab; Pipette zurück; keine Hintergrunddosierung', () => {
  const L = lab();
  sample(L, 'nacl', 0); reagent(L, 'agno3', 0);
  L.startHold(); run(L, 0.6);
  const flying = L.state.drops.length;
  const booked = L.tube(0).log.agDrops;
  L.setTab('control');
  assert.equal(L.state.drops.length, 0);
  assert.equal(L.tube(0, 'main').log.agDrops, booked + flying, 'Tropfen im Flug gebucht, nicht verloren');
  assert.equal(L.state.pip.key, null);
  run(L, 3);
  assert.equal(L.tube(0, 'main').log.agDrops, booked + flying, 'keine weitere Dosierung');
  L.setTab('main');
  L.selectBottle('agno3'); run(L, 0.5); L.target(0); idle(L);
  L.startHold(); run(L, 0.6); L.cancelAll(); run(L, 2);
  const n = L.tube(0).log.agDrops; run(L, 2);
  assert.equal(L.tube(0).log.agDrops, n, 'Fokusverlust beendet die Folge');
});

test('Spülen beendet den Ansatz (archiviert); neue Probe erhält eine neue Kennung', () => {
  const L = lab();
  sample(L, 'nacl', 0); reagent(L, 'agno3', 0); dropsN(L, 2);
  L.returnPipette(); idle(L);
  assert.ok(L.rinse(0));
  assert.equal(L.tube(0).V, 0);
  assert.equal(L.tab().archive.length, 1);
  assert.equal(L.tab().archive[0].ansatz, 'A1');
  sample(L, 'nacl', 0);
  assert.equal(L.tube(0).ansatz, 'A2', 'keine versteckte Umwandlung in eine frische Probe');
});

test('Speichern/Wiederherstellen: stabil, nicht pausiert, nichts im Flug, Mengen erhalten', () => {
  const L = lab();
  sample(L, 'nai', 0); reagent(L, 'agno3', 0); dropsN(L, 4);
  L.startHold(); run(L, 0.3);
  L.setSpeed(0);
  const snap = JSON.parse(JSON.stringify(L.snapshot()));
  const R = M.create(snap); R.setWorldWidth(1100);
  assert.equal(R.state.speed, 1);
  assert.equal(R.state.drops.length, 0);
  assert.equal(R.state.pip.key, null);
  assert.equal(R.busy(), false);
  const a = L.tube(0), b = R.tube(0);
  assert.equal(b.ansatz, a.ansatz);
  assert.ok(rel(M.solidTotal(b), M.solidTotal(a)) < TOL);
  assert.equal(b.clouds.length, 0);
  // kaputte Daten führen nicht zu NaN
  const bad = M.create({ v: 1, tabs: { main: { tubes: [{ V: 'x', n: { Ag: -1, X: NaN }, susp: Infinity }] } } });
  assert.equal(bad.tube(0).V, 0); assert.equal(bad.tube(0).susp, 0);
});

test('Weitere Reagenzgläser für frische Vergleichsansätze (bis 6)', () => {
  const L = lab();
  assert.equal(L.tab().visible, 3);
  for (let i = 0; i < 5; i++) L.addTube();
  assert.equal(L.tab().visible, 6);
  assert.equal(L.addTube(), false);
});
