/*
 * Estergleichgewicht – Teilchenebene (ohne DOM, Zeichnen in render.js)
 *
 * Hybrides Modell nach docs/GLEICHGEWICHT-PLANUNG.md: 40 Teilchen (20 je mol) bewegen sich
 * zufällig in einem Kasten. Die Reaktionsereignisse werden NICHT aus der Stoßphysik
 * bestimmt, sondern stochastisch aus denselben Ratengesetzen wie auf der Stoffebene gezogen
 * (Wahrscheinlichkeit je Zeitschritt ∝ Teilchenzahlen, Verhältnis der Konstanten = K = 4).
 * Erst dann wird ein passendes Paar zum Zusammenstoß animiert: Säure + Alkohol → Ester + Wasser
 * oder umgekehrt. K stimmt im Mittel, die Zahlen schwanken sichtbar.
 *
 * Teilchensorten: 0 Säure (S), 1 Alkohol (A), 2 Ester (E), 3 Wasser (W).
 * Eigene Zeitskala (Sekunden der Ansicht), unabhängig von den Tagen der Stoffebene.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.EG = root.EG || {}).particles = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const K = 4;
  const PER_MOL = 20;
  const KAPPA = 0.012;         // Hin-Ereignisse je Sekunde und Paar(S,A); bei 20·20 Paaren ≈ 4,8 Ereignisse/s zu Beginn
  const APPROACH = 0.55;       // s: Annäherung des Paares
  const FLASH = 0.25;          // s: Aufblitzen und Auseinanderfliegen
  const WINDOW = 10;           // s für „erfolgreiche Stöße pro 10 s“
  const R = [0.028, 0.026, 0.036, 0.02]; // relative Radien (Kastenbreite = 1)

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createSystem(seed) {
    const rand = rng(seed || 20261109);
    const sys = {
      parts: [],          // {type, x, y, vx, vy, busy}
      events: [],         // laufende Reaktionen {a, b, t, dir, cx, cy}
      log: [],            // [t, dir] abgeschlossene Reaktionen für die Rate
      t: 0, catalyst: false, aspect: 1.6
    };
    function spawn(type, x, y) {
      const ang = rand() * Math.PI * 2, v = 0.06 + rand() * 0.08;
      return { type, x: x == null ? rand() : x, y: y == null ? rand() : y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, busy: false };
    }
    const api = {
      state: sys, K, PER_MOL, WINDOW, R,
      /** Teilchen passend zu den Stoffmengen (mol) anlegen. */
      init(nMol) {
        sys.parts = []; sys.events = []; sys.log = []; sys.t = 0;
        nMol.forEach((n, type) => { for (let i = 0; i < Math.round(n * PER_MOL); i++) sys.parts.push(spawn(type)); });
      },
      counts() { const c = [0, 0, 0, 0]; for (const p of sys.parts) c[p.type]++; return c; },
      /** Freie (nicht in einer Reaktion befindliche) Teilchen einer Sorte. */
      free(type) { return sys.parts.filter((p) => p.type === type && !p.busy); },
      get Q() { const c = this.counts(); const d = c[0] * c[1]; return d > 0 ? (c[2] * c[3]) / d : Infinity; },
      /** Erfolgreiche Stöße pro WINDOW Sekunden, hin und zurück (gleitend). */
      rates() {
        const from = sys.t - WINDOW;
        let h = 0, r = 0;
        for (const e of sys.log) if (e[0] > from) { if (e[1] > 0) h++; else r++; }
        const span = Math.min(WINDOW, Math.max(1, sys.t));
        return { hin: h * WINDOW / span, rueck: r * WINDOW / span, window: WINDOW };
      },
      advance(dt) {
        sys.t += dt;
        const speedUp = sys.catalyst ? 3 : 1;
        // Bewegung
        for (const p of sys.parts) {
          if (p.busy) continue;
          p.x += p.vx * dt; p.y += p.vy * dt * sys.aspect;
          const r = R[p.type];
          if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx); } else if (p.x > 1 - r) { p.x = 1 - r; p.vx = -Math.abs(p.vx); }
          if (p.y < r * sys.aspect) { p.y = r * sys.aspect; p.vy = Math.abs(p.vy); } else if (p.y > 1 - r * sys.aspect) { p.y = 1 - r * sys.aspect; p.vy = -Math.abs(p.vy); }
          // leichte Richtungsänderung (Brownsche Bewegung)
          if (rand() < dt * 1.5) { const a = (rand() - 0.5) * 1.2, c = Math.cos(a), s_ = Math.sin(a); const vx = p.vx * c - p.vy * s_; p.vy = p.vx * s_ + p.vy * c; p.vx = vx; }
        }
        // Reaktionsereignisse aus den Ratengesetzen
        const S = this.free(0), A = this.free(1), E = this.free(2), W = this.free(3);
        const pHin = KAPPA * speedUp * S.length * A.length * dt;
        const pRueck = (KAPPA / K) * speedUp * E.length * W.length * dt;
        if (rand() < pHin && S.length && A.length) this.startEvent(S[Math.floor(rand() * S.length)], A[Math.floor(rand() * A.length)], 1);
        else if (rand() < pRueck && E.length && W.length) this.startEvent(E[Math.floor(rand() * E.length)], W[Math.floor(rand() * W.length)], -1);
        // laufende Ereignisse
        for (const e of sys.events) {
          e.t += dt;
          if (e.t < APPROACH) {
            const k = e.t / APPROACH, ease = k * k * (3 - 2 * k);
            e.a.x = e.ax + (e.cx - e.ax) * ease; e.a.y = e.ay + (e.cy - e.ay) * ease;
            e.b.x = e.bx + (e.cx - e.bx) * ease; e.b.y = e.by + (e.cy - e.by) * ease;
          } else if (!e.done) {
            e.done = true;
            // Umwandlung: S+A → E+W bzw. E+W → S+A; die Sorten tauschen paarweise
            if (e.dir > 0) { e.a.type = 2; e.b.type = 3; } else { e.a.type = 0; e.b.type = 1; }
            const ang = rand() * Math.PI * 2, v = 0.14;
            e.a.vx = Math.cos(ang) * v; e.a.vy = Math.sin(ang) * v; e.b.vx = -e.a.vx; e.b.vy = -e.a.vy;
            sys.log.push([sys.t, e.dir]);
            while (sys.log.length && sys.log[0][0] < sys.t - 60) sys.log.shift();
          } else {
            const k = (e.t - APPROACH) / FLASH;
            e.a.x = e.cx + e.a.vx * k * 0.3; e.a.y = e.cy + e.a.vy * k * 0.3 * sys.aspect;
            e.b.x = e.cx + e.b.vx * k * 0.3; e.b.y = e.cy + e.b.vy * k * 0.3 * sys.aspect;
          }
        }
        for (const e of sys.events.filter((x) => x.t >= APPROACH + FLASH)) { e.a.busy = false; e.b.busy = false; }
        sys.events = sys.events.filter((x) => x.t < APPROACH + FLASH);
      },
      startEvent(a, b, dir) {
        a.busy = true; b.busy = true;
        sys.events.push({ a, b, dir, t: 0, ax: a.x, ay: a.y, bx: b.x, by: b.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, done: false });
      },
      /** Phase eines Ereignisses für das Aufblitzen (0…1 während FLASH, sonst null). */
      flash(e) { return e.t >= APPROACH ? Math.min(1, (e.t - APPROACH) / FLASH) : null; }
    };
    return api;
  }

  return { K, PER_MOL, KAPPA, APPROACH, FLASH, WINDOW, R, rng, createSystem };
});
