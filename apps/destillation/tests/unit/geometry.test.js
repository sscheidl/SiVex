// Geometrie der Apparatur: geschlossene Verbindungen bei jeder Bühnengröße (G-01, G-02). Aufruf: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../../js/geometry.js');

const SIZES = [[1046, 690], [1180 - 380, 600], [1024 - 300, 560], [420, 520], [1600, 900], [2400, 1300], [700, 900]];

test('G-01 Alle Sollverbindungen fallen exakt zusammen (mit und ohne Prüfplatz)', () => {
  for (const station of [true, false]) {
    const g = G.build({ station });
    for (const c of G.connections(g)) assert.ok(G.dist(c.a, c.b) < 1e-9, `${c.name}: Abstand ${G.dist(c.a, c.b)}`);
  }
});

test('G-01 Lagebedingungen (Kolben im Heizpilz, Spitze im Hals, Zulauf unten …)', () => {
  for (const station of [true, false]) {
    const g = G.build({ station });
    for (const c of G.checks(g)) assert.ok(c.ok, c.name);
  }
});

test('G-02 Gleichmäßige Skalierung: Verbindungen bleiben bei allen Bühnengrößen geschlossen, Szene vollständig sichtbar', () => {
  for (const station of [true, false]) {
    const g = G.build({ station });
    for (const [w, h] of SIZES) {
      const v = G.fit(g.bounds, w, h, 8);
      for (const c of G.connections(g)) {
        const a = G.toScreen(v, c.a), b = G.toScreen(v, c.b);
        assert.ok(G.dist(a, b) < 1e-6, `${w}×${h} ${c.name}`);
      }
      const p0 = G.toScreen(v, { x: g.bounds.x0, y: g.bounds.y0 }), p1 = G.toScreen(v, { x: g.bounds.x1, y: g.bounds.y1 });
      assert.ok(p0.x >= 7.99 && p0.y >= 7.99 && p1.x <= w - 7.99 && p1.y <= h - 7.99, `${w}×${h}: Szene innerhalb der Bühne`);
      // Seitenverhältnis bleibt erhalten (keine getrennte x/y-Skalierung)
      const d1 = G.toScreen(v, g.cond.c1), d0 = G.toScreen(v, g.cond.c0);
      const ang = Math.atan2(d1.y - d0.y, d1.x - d0.x) * 180 / Math.PI;
      assert.ok(Math.abs(ang - G.DIM.armAngle) < 1e-9, 'Kühlerneigung unverändert');
    }
  }
});

test('G-01 Schläuche beginnen und enden an den tatsächlichen Anschlüssen', () => {
  const g = G.build({ station: true });
  const ends = (pts) => [pts[0], pts[pts.length - 1]];
  for (const nz of ['low', 'high']) {
    const [a, b] = ends(g.hoseRoutes.inlet(nz));
    assert.ok(G.dist(a, g.tap.outlet) < 1e-9 && G.dist(b, g.nozzles[nz].tip) < 1e-9, 'Zulauf ' + nz);
    const [c, d] = ends(g.hoseRoutes.outlet(nz));
    assert.ok(G.dist(c, g.nozzles[nz].tip) < 1e-9 && G.dist(d, g.sink.drop) < 1e-9, 'Ablauf ' + nz);
    assert.equal((g.hoseRoutes.inlet(nz).length - 1) % 3, 0, 'Bézierkette');
    assert.equal((g.hoseRoutes.outlet(nz).length - 1) % 3, 0, 'Bézierkette');
  }
});

test('G-01 Richtige Schlauchführung kreuzt nichts: Zulauf unter dem Kühler, Ablauf darüber', () => {
  const g = G.build({ station: true });
  const sample = (pts, n) => { const out = []; for (let i = 0; i + 3 < pts.length; i += 3) for (let k = 0; k <= n; k++) out.push(G.cubic(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], k / n)); return out; };
  // Abstand eines Punkts zur Kühlerachse (vorzeichenbehaftet: + = unterhalb)
  const below = (p) => { const d = g.cond.d, c0 = g.cond.c0; return (p.x - c0.x) * (-d.y) + (p.y - c0.y) * d.x; };
  const along = (p) => { const d = g.cond.d, c0 = g.cond.c0; return (p.x - c0.x) * d.x + (p.y - c0.y) * d.y; };
  for (const p of sample(g.hoseRoutes.inlet('low'), 30)) {
    const s = along(p);
    if (s > 0 && s < g.cond.len) assert.ok(below(p) > G.DIM.jacketHW - 0.5, 'Zulauf bleibt unter dem Kühler');
  }
  for (const p of sample(g.hoseRoutes.outlet('high'), 30)) {
    const s = along(p);
    if (s > 0 && s < g.cond.len + 60) assert.ok(below(p) < -G.DIM.jacketHW + 0.5, 'Ablauf bleibt über Kühler und Vorstoß');
    assert.ok(p.y <= g.sink.drop.y + 1e-9, 'Ablauf über dem Tisch');
    if (p.x > g.receiver.x - 60 && p.x < g.receiver.x + 60) assert.ok(p.y < g.adapter.a1.y - 40, 'Ablauf über der Vorlage');
  }
});

test('Befund 10/11: Flasche und Siedesteine links bei den Materialien; Szene schmaler, Apparatur größer', () => {
  for (const station of [true, false]) {
    const g = G.build({ station });
    assert.ok(g.bottle.x + g.bottle.w / 2 < g.stand1.base.x0 && g.stonesDish.x + g.stonesDish.w / 2 < g.stand1.rodX, 'links vom Stativ bzw. von der Stativstange');
    assert.ok(g.bottle.x - g.bottle.w / 2 > g.bounds.x0 && g.stonesDish.x + g.stonesDish.w / 2 < g.stand1.rodX, 'innerhalb der Szene, nicht unter dem Kühler');
    if (station) assert.ok(g.station.x1 < g.bottle.x - g.bottle.w / 2, 'Prüfplatz links daneben');
  }
  // Fassung 0.2.0: Szene 1210 mm breit (mit Prüfplatz) → Maßstab bei 1046 × 690 px 0,851 px/mm
  const g = G.build({ station: true });
  const w = g.bounds.x1 - g.bounds.x0;
  assert.ok(w <= 1135, 'Szene höchstens 1135 mm breit (0.2.0: 1210 mm): ' + w.toFixed(0));
  const s = G.fit(g.bounds, 1046, 734, 8, 58).scale;
  assert.ok(s >= 0.851 * 1.06, 'Apparatur bei 1440 × 900 mindestens 6 % größer: ' + s.toFixed(3));
});

test('Befund 5: Einblendfläche lang genug für die Beschriftung des Kühlwassers', () => {
  const g = G.build({ station: true });
  const o = g.overlay;
  // längste Zeile: „Kühlwasser im Mantel · 15 °C · Durchfluss mittel  ← strömt zum Ablauf“ ≈ 354 px bei 11 px Schrift
  for (const [w, h] of [[1046, 734], [1180 - 380, 680], [1024 - 300, 600]]) {
    const v = G.fit(g.bounds, w, h, 8, 58);
    const room = (o.x1 - o.x0 - 40) * v.scale;
    if (w >= 1000) assert.ok(room >= 360, `${w}×${h}: Platz ${room.toFixed(0)} px`);
    else assert.ok(room >= 300, `${w}×${h}: Platz ${room.toFixed(0)} px (Rest bricht in eine zweite Zeile um)`);
  }
});

test('G-03 Füllstände aus dem Volumen: monoton, Kolben 100 mL unter dem Hals, Vorlage bis 100 mL', () => {
  const g = G.build({ station: false });
  let prev = Infinity;
  for (let v = 0; v <= 200; v += 10) { const l = G.flaskLevel(g, v); assert.ok(l.y < prev || v === 0); prev = l.y; }
  assert.ok(G.flaskLevel(g, 100).y > g.neck.y0, 'Füllung im Kugelteil');
  prev = Infinity;
  for (let v = 0; v <= 100; v += 5) { const l = G.receiverLevel(g, v); assert.ok(l.y < prev || v === 0); prev = l.y; }
  assert.ok(G.receiverVolumeAt(g, g.receiver.h - 34) > 100, 'Skala bis 100 mL passt in den Kegel');
});
