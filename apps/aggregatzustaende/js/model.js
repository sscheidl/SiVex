/*
 * Aggregatzustände – Zustandsmodell (ohne DOM)
 *
 * Bewusst einfach: Der Regler setzt die Temperatur direkt (kein Heizen, keine
 * Wärmebilanz). Die Darstellung folgt mit kurzer Verzögerung (TAU), und der
 * Zustand wechselt weich über eine einzige Größe p:
 *   p = 0 fest · p = 1 flüssig · p = 2 gasförmig, Zwischenwerte = Mischung.
 * Ziel von p ergibt sich allein aus Temperatur und Stoffdaten; genau an der
 * Schmelz- bzw. Siedetemperatur liegen beide Zustände nebeneinander vor.
 * Iod: Ein kleiner Dampfanteil (Sublimation) und Kristalle an der kalten
 * Oberfläche (Resublimation) – dieselbe Logik, nur über Stoffdaten aktiviert.
 * Beide Ansichten (Stoff- und Teilchenebene) lesen dieselben Anteile shares().
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const S = isNode ? require('./substances.js') : root.AZ.substances;
  const api = factory(S);
  if (isNode) module.exports = api;
  else (root.AZ = root.AZ || {}).model = api;
})(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';

  const DT = 1 / 120;          // feste Modellschritte (s)
  const TAU = 0.25;            // Verzögerung der Darstellung gegenüber dem Regler (s)
  const MIN_RATE = 0.15;       // Mindestgeschwindigkeit der Darstellung (Anteil des Reglerbereichs je s)
  const PHASE_RATE = 0.85;     // Zustandswechsel: Einheiten von p je Sekunde (fest → flüssig ≈ 1,2 s)
  const VAPOR_TAU = 1.4;       // langsam entstehender Ioddampf (s)
  const CRYSTAL_RATE = 0.2;    // Anlagerung an der kalten Oberfläche je Sekunde und Gasanteil
  const CRYSTAL_MAX = 0.3;     // höchstens 30 % des Stoffes sitzen an der kalten Oberfläche
  const CRYSTAL_DECAY = 0.45;  // Rückgang nach dem Ausblenden (je Sekunde)
  const COLD_FADE = 2.2;       // Ein-/Ausblenden der kalten Oberfläche (je Sekunde)

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (t) => t * t * (3 - 2 * t);

  /** Ziel von p bei Temperatur T (genau an den Übergangstemperaturen: beide Zustände zu gleichen Teilen). */
  function phaseTarget(sub, T) {
    if (T < sub.mp) return 0;
    if (T === sub.mp) return 0.5;
    if (T < sub.bp) return 1;
    if (T === sub.bp) return 1.5;
    return 2;
  }
  /** Dampfanteil über dem festen bzw. flüssigen Stoff (nur Stoffe mit vapor, hier Iod). */
  function vaporTarget(sub, T) {
    if (!sub.vapor || T < sub.vapor.from) return 0;
    if (T >= sub.mp) return sub.vapor.max;
    return sub.vapor.max * smooth(clamp((T - sub.vapor.from) / (sub.mp - sub.vapor.from), 0, 1));
  }
  /** Anteile fest/flüssig/gasförmig aus p allein. */
  function baseShares(p) {
    if (p <= 1) return { s: 1 - p, l: p, g: 0 };
    return { s: 0, l: 2 - p, g: p - 1 };
  }
  function clampT(sub, T) { return clamp(Math.round(Number(T) / S.STEP) * S.STEP, sub.min, sub.max); }

  function freshState(id, T) {
    const sub = S.SUBSTANCES[id] || S.SUBSTANCES.water;
    const t0 = clampT(sub, T == null ? sub.start : T);
    const p = phaseTarget(sub, t0);
    return { sub: sub.id, Tset: t0, Tview: t0, p, v: vaporTarget(sub, t0), c: 0, cold: false, coldVis: 0, t: 0, seq: 1 };
  }

  function createModel(saved) {
    let st = freshState(saved && saved.sub, saved && saved.Tset);
    let carry = 0;
    const sub = () => S.SUBSTANCES[st.sub];

    function step(dt) {
      const s = sub();
      st.t += dt;
      // Darstellung folgt dem Regler weich und erreicht den eingestellten Wert exakt
      // (exponentiell, zum Schluss mit Mindestgeschwindigkeit: nach etwa 1 s angekommen)
      const d = st.Tset - st.Tview;
      const step = Math.max(Math.abs(d) * (1 - Math.exp(-dt / TAU)), MIN_RATE * (s.max - s.min) * dt);
      st.Tview = Math.abs(d) <= step ? st.Tset : st.Tview + Math.sign(d) * step;
      const pt = phaseTarget(s, st.Tview);
      const dp = pt - st.p;
      st.p = Math.abs(dp) <= PHASE_RATE * dt ? pt : st.p + Math.sign(dp) * PHASE_RATE * dt;
      const vt = st.p < 2 ? vaporTarget(s, st.Tview) : 0;
      st.v += (vt - st.v) * (1 - Math.exp(-dt / VAPOR_TAU));
      if (Math.abs(vt - st.v) < 1e-4) st.v = vt;
      // kalte Oberfläche (nur Iod): Kristalle wachsen aus dem Gas, solange sie eingeblendet ist
      const coldOn = st.cold && !!s.coldSurface;
      st.coldVis = clamp(st.coldVis + (coldOn ? 1 : -1) * COLD_FADE * dt, 0, 1);
      if (coldOn) {
        const g = gasShare();
        st.c = Math.min(CRYSTAL_MAX, st.c + CRYSTAL_RATE * g * dt * (1 - st.c / CRYSTAL_MAX + 0.05));
      } else st.c = Math.max(0, st.c - CRYSTAL_DECAY * dt);
    }
    /** Gasanteil ohne Kristalle an der kalten Oberfläche. */
    function gasShare() {
      const b = baseShares(st.p);
      return b.g + st.v * (b.s + b.l);
    }

    /** Modellzeit vorrücken (feste Schritte, unabhängig von der Bildrate). */
    function advance(sec) {
      carry += Math.min(0.25, Math.max(0, sec));
      let n = 0;
      while (carry >= DT - 1e-9) { step(DT); carry -= DT; n++; }
      return n;
    }

    /** Anteile des Stoffes: fest s, flüssig l, gasförmig g, an der kalten Oberfläche c (Summe 1). */
    function shares() {
      const b = baseShares(st.p);
      const k = 1 - st.c;
      return { s: b.s * (1 - st.v) * k, l: b.l * (1 - st.v) * k, g: (b.g + st.v * (b.s + b.l)) * k, c: st.c };
    }

    /** Laufender Vorgang (für Darstellung, Statustext und Bildschirmleser). */
    function process() {
      const s = sub();
      const pt = phaseTarget(s, st.Tview);
      if (st.p < pt - 1e-6) return st.p < 1 ? 'melting' : 'boiling';
      if (st.p > pt + 1e-6) return st.p > 1 ? 'condensing' : 'freezing';
      if (pt === 0.5) return 'atMelting';
      if (pt === 1.5) return 'atBoiling';
      if (s.vapor && st.p < 1 && st.v > 0.01) return 'subliming';
      return null;
    }
    /** Wachsen gerade Kristalle an der kalten Oberfläche? */
    const resubliming = () => st.cold && !!sub().coldSurface && st.c < CRYSTAL_MAX - 1e-3 && gasShare() > 0.01;

    function setTemp(T) { st.Tset = clampT(sub(), T); return st.Tset; }
    /** Stoffwechsel: sauberer Startzustand ohne laufende Übergänge des vorigen Stoffes. */
    function setSubstance(id) { const seq = st.seq; st = freshState(id); st.seq = seq + 1; carry = 0; return st; }
    function setCold(on) { st.cold = !!on && !!sub().coldSurface; return st.cold; }
    /** Wiederherstellen nach Neuladen (nur Stoff, Temperatur, kalte Oberfläche). */
    function restore(o) {
      if (!o || !S.SUBSTANCES[o.sub]) return;
      st = freshState(o.sub, o.Tset);
      if (o.cold) { st.cold = !!S.SUBSTANCES[o.sub].coldSurface; st.coldVis = st.cold ? 1 : 0; st.c = clamp(Number(o.c) || 0, 0, CRYSTAL_MAX); }
    }

    /** Vorherrschender Zustand in Worten. */
    function phaseWords() {
      const sh = shares();
      const parts = [['fest', sh.s], ['flüssig', sh.l], ['gasförmig', sh.g]].filter((x) => x[1] > 0.12).map((x) => x[0]);
      return parts.length ? parts.join(' und ') : 'gasförmig';
    }

    return {
      get state() { return st; }, get substance() { return sub(); },
      step, advance, shares, process, resubliming, setTemp, setSubstance, setCold, restore, phaseWords, gasShare
    };
  }

  return { createModel, phaseTarget, vaporTarget, baseShares, DT, TAU, PHASE_RATE, CRYSTAL_MAX };
});
