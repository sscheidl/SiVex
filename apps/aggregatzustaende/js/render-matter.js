/*
 * Aggregatzustände – Stoffebene (Canvas 2D, HiDPI)
 *
 * Geschlossene Gefäße in der Bildmitte: Becherglas mit aufgelegtem Uhrglas
 * (Wasser, Iod) bzw. Keramiktiegel in einem Ofen, im Schnitt gezeichnet
 * (Eisen, Kochsalz – Glas würde bei diesen Temperaturen schmelzen). Die
 * Heizstäbe glühen je nach Temperatur. Glas, Flüssigkeit, Meniskus und Oberflächenwellen nach
 * TitraLab 3 (titration/js/view/lab-renderer.js; Wellengleichung wie in
 * apps/pufferfish/js/render-lab.js). Gas wird als weiche, aufsteigende
 * Wölkchen sichtbar gemacht – bewusst vereinfacht, die Kennzeichnung steht
 * außerhalb des Bildes.
 * Alle Mengen kommen aus model.shares(); der Renderer verändert das Modell nie.
 * Die Effekte (Wölkchen, Blasen, Tropfen) sind reine Darstellung.
 */
(function (root) {
  'use strict';
  const SW = 1000, SH = 640, BENCH = 560;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(a, 0, 1).toFixed(3)})`;
  const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  function rr(ctx, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Becherglas
  const BX = 500, BIH = 172, BTOP = 150, BFLOOR = 548, GLASS = 6;
  const B_AREA = 2 * BIH * 140;          // Fläche der vollständig flüssigen Probe (Füllhöhe 140)
  // Tiegel
  const CX = 500, RIM_Y = 360, RIM_RX = 300, RIM_RY = 86, IN_RX = 282, IN_RY = 79, PERSP = IN_RY / IN_RX;
  const BASE_Y = 516, BASE_RX = 214, BASE_RY = 58, CFLOOR = 452, FLOOR_RX = 228, CFULL = 398;
  const WAVE_N = 42;
  // Ofen (Weltkoordinaten): Gehäuse und Kammer; der Tiegel wird verkleinert in die Kammer gestellt
  const OX0 = 140, OX1 = 860, OY0 = 92, OFX0 = 206, OFX1 = 794, OFY0 = 156, OFY1 = 532;
  const CK = 0.72, CTX = 500 * (1 - CK), CTY = 526 - 574 * CK;   // Tiegel → Welt: x' = CTX + CK·x, y' = CTY + CK·y
  const cmap = (x, y) => ({ x: CTX + CK * x, y: CTY + CK * y });

  /** Glühfarbe nach Temperatur (schematisch, nach der Farbe glühender Körper). */
  const GLOW = [[600, [110, 25, 8]], [900, [190, 60, 20]], [1200, [240, 100, 30]], [1500, [255, 150, 52]], [2000, [255, 205, 112]], [2900, [255, 244, 214]]];
  function glowColor(T) {
    if (T <= GLOW[0][0]) return GLOW[0][1].slice();
    for (let i = 1; i < GLOW.length; i++) if (T <= GLOW[i][0]) return mix(GLOW[i - 1][1], GLOW[i][1], (T - GLOW[i - 1][0]) / (GLOW[i][0] - GLOW[i - 1][0]));
    return GLOW[GLOW.length - 1][1].slice();
  }

  /** Weiches Wölkchen als Bildvorlage (mehrere überlagerte, unscharfe Kreise). */
  function makeSprite(rgb, seed, coreAlpha) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const R = mulberry32(seed);
    // große, sehr weiche Grundwolke und einige weiche Ausbuchtungen – kein scharfer Rand
    const base = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
    base.addColorStop(0, rgba(rgb, coreAlpha * 0.55)); base.addColorStop(0.5, rgba(rgb, coreAlpha * 0.3)); base.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 6; i++) {
      const x = 64 + (R() - 0.5) * 44, y = 64 + (R() - 0.5) * 36, r = 18 + R() * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(rgb, coreAlpha * 0.4)); g.addColorStop(0.6, rgba(rgb, coreAlpha * 0.14)); g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    return c;
  }

  class MatterRenderer {
    constructor(canvas, model) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.model = model;
      this.view = { w: 0, h: 0, dpr: 1, scale: 1, ox: 0, oy: 0 };
      this.sprites = {};
      this.time = 0;
      this.reset();
    }
    /** Effekte verwerfen (Stoffwechsel): nichts vom vorigen Stoff wandert mit. */
    reset() {
      const sub = this.model.substance;
      this.subId = sub.id;
      this.puffs = []; this.bubbles = []; this.bursts = []; this.drops = [];
      this.waveH = new Float32Array(WAVE_N); this.waveV = new Float32Array(WAVE_N);
      this.spawnAcc = 0; this.bubbleAcc = 0; this.dropAcc = 0; this.haze = 0;
      const R = mulberry32(sub.id.length * 977 + 13);
      // feste Lage der Kristalle/Würfel/Plättchen, damit nichts flackert
      this.flakes = []; this.cubes = []; this.crystals = []; this.cracks = [];
      // Iodplättchen: dichter Haufen, die oberen liegen über den unteren
      for (let i = 0; i < 95; i++) {
        const u = R() * 2 - 1;
        const v = Math.sqrt(R()) * (1 - u * u) * (0.8 + 0.2 * R());
        this.flakes.push({ u, v, size: 13 + R() * 11, ang: (R() - 0.5) * 2.6, shade: R(), glint: R() });
      }
      // Kochsalzwürfel: Haufen auf dem Tiegelboden (u quer, w in die Tiefe, v Höhe)
      while (this.cubes.length < 90) {
        const u = R() * 2 - 1, w = R() * 2 - 1;
        const q = u * u + w * w;
        if (q > 1) continue;
        this.cubes.push({ u, w, v: Math.sqrt(R()) * (1 - q) * (0.85 + 0.15 * R()), size: 18 + R() * 11, shade: R(), tilt: (R() - 0.5) * 0.3 });
      }
      this.flakes.sort((a, b) => a.v - b.v);
      this.cubes.sort((a, b) => (a.w * 1.6 + a.v) - (b.w * 1.6 + b.v));
      for (let i = 0; i < 48; i++) {
        const x = BX - 165 + (i + 0.5) * (330 / 48) + (R() - 0.5) * 4;
        this.crystals.push({ x, len: 9 + R() * 11, wid: 3 + R() * 3, ang: (R() - 0.5) * 0.9, order: R() });
      }
      this.crystals.sort((a, b) => Math.abs(a.x - BX) * 0.004 + a.order - (Math.abs(b.x - BX) * 0.004 + b.order));
      for (let i = 0; i < 9; i++) this.cracks.push({ x0: R(), y0: R(), x1: R(), y1: R(), bend: (R() - 0.5) * 0.4 });
      this.iceBubbles = Array.from({ length: 22 }, () => ({ x: R(), y: R(), r: 0.8 + R() * 2.2 }));
      this.iceY = null;
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, root.devicePixelRatio || 1);
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      if (w === this.view.w && h === this.view.h && dpr === this.view.dpr) return false;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      const scale = Math.min(w / SW, h / SH);
      Object.assign(this.view, { w, h, dpr, scale, ox: (w - SW * scale) / 2, oy: (h - SH * scale) / 2 });
      this.bg = null;
      return true;
    }
    sprite(rgb) {
      const key = rgb.join(',');
      if (!this.sprites[key]) {
        this.sprites[key] = [makeSprite(rgb, 11, 0.9), makeSprite(rgb, 29, 0.9), makeSprite(rgb, 47, 0.9)];
        this.sprites[key + 'h'] = makeSprite([70, 85, 105], 11, 0.5);
      }
      return this.sprites[key];
    }

    // ------------------------------------------------------------ Geometrie der Probe
    /** Beherglas: Flüssigkeitsspiegel und (bei Wasser) die schwimmende Eisscholle. */
    beakerLevels(sh) {
      const sub = this.model.substance;
      const innerW = 2 * BIH;
      if (sub.solidFloats) {
        const area = sh.s * B_AREA * 1.09;
        const w = (innerW - 8) * (0.5 + 0.5 * Math.pow(sh.s, 0.35));
        const h = w > 0 ? area / w : 0;
        const liq = sh.l * B_AREA;
        let surfH = (liq + 0.9 * area) / innerW;          // Scholle schwimmt
        let top;
        if (0.9 * h > surfH) {                            // zu wenig Wasser: Eis liegt auf dem Boden
          surfH = innerW - w > 1 ? Math.min(h, liq / (innerW - w)) : 0;
          top = BFLOOR - h;
        } else top = BFLOOR - surfH - 0.1 * h;
        return { surf: BFLOOR - surfH, liq, ice: sh.s > 0.004 ? { x: BX - w / 2, y: top, w, h, r: Math.min(h / 2, 3 + 18 * (1 - sh.s)) } : null };
      }
      const surfH = (sh.l * B_AREA * (1 + 0.8 * sh.s)) / innerW;
      return { surf: BFLOOR - surfH, liq: sh.l * B_AREA, ice: null };
    }
    crucibleLevel(sh) {
      const f = sh.l * (1 + 0.6 * sh.s);
      return CFLOOR - clamp(f, 0, 1.15) * (CFLOOR - CFULL);
    }
    /** Halbachse des Tiegelinneren auf Höhe y (konische Wand). */
    crucibleRx(y) { return lerp(IN_RX, FLOOR_RX, clamp((y - RIM_Y) / (CFLOOR - RIM_Y), 0, 1)); }
    /** Oberkante der Probe, an der Gas entsteht. */
    sourceTop(sh, sub) {
      if (sub.vessel === 'beaker') {
        const L = this.beakerLevels(sh);
        if (sh.l > 0.02) return { x0: BX - BIH + 12, x1: BX + BIH - 12, y: L.surf };
        if (sub.solid === 'flakes') { const hw = 110 * (0.45 + 0.55 * Math.sqrt(sh.s)); return { x0: BX - hw, x1: BX + hw, y: BFLOOR - 6 - 70 * Math.pow(sh.s, 0.6) * 0.7 }; }
        return { x0: BX - BIH + 12, x1: BX + BIH - 12, y: L.ice ? L.ice.y : BFLOOR - 4 };
      }
      const y = this.crucibleLevel(sh);
      const rx = this.crucibleRx(y) * 0.8;
      const a = cmap(CX - rx, y - 4), b = cmap(CX + rx, y - 4);
      return { x0: a.x, x1: b.x, y: a.y };
    }
    /** Innenraum des geschlossenen Gefäßes (Becherglas unter dem Uhrglas bzw. Ofenkammer) als Pfad. */
    interiorPath(ctx, beaker) {
      ctx.beginPath();
      if (!beaker) { ctx.rect(OFX0, OFY0, OFX1 - OFX0, OFY1 - OFY0); return; }
      for (let i = 0; i <= 24; i++) { const x = BX - BIH + (i / 24) * 2 * BIH; ctx[i ? 'lineTo' : 'moveTo'](x, this.glassUnder(x)); }
      ctx.lineTo(BX + BIH, BFLOOR); ctx.lineTo(BX - BIH, BFLOOR); ctx.closePath();
    }
    /** Unterseite des Uhrglases (Deckel, bei Iod zugleich die kalte Oberfläche) bei x. */
    glassUnder(x) { const dx = (x - BX) / 206; return BTOP - 3 + 24 * (1 - dx * dx); }

    // ------------------------------------------------------------ Effekte fortschreiben
    update(dt) {
      const m = this.model, sub = m.substance, st = m.state;
      if (sub.id !== this.subId || st.seq !== this.seq) { this.seq = st.seq; this.reset(); }
      this.time += dt;
      const sh = m.shares();
      const proc = m.process();
      const R = Math.random;
      const beaker = sub.vessel === 'beaker';
      const T = st.Tview;
      const boiling = T >= sub.bp && sh.l > 0.015;
      const condensing = proc === 'condensing' || (sh.g > 0.02 && T < sub.bp && !sub.vapor);

      // Oberflächenwellen (TitraLab 3): ständig leicht bewegt, beim Sieden stärker
      const h = this.waveH, v = this.waveV;
      const amb = sub.vessel === 'beaker' ? (0.35 + (boiling ? 2.5 : 0) + 0.6 * clamp((T - sub.mp) / (sub.bp - sub.mp), 0, 1)) : 0.8 + (boiling ? 2 : 0);
      if (R() < dt * 9) v[2 + Math.floor(R() * (WAVE_N - 4))] += (R() - 0.5) * 6 * amb;
      const sub2 = Math.max(2, Math.ceil(dt / 0.004)), sdt = dt / sub2;
      for (let k = 0; k < sub2; k++) {
        for (let j = 0; j < WAVE_N; j++) {
          const l = h[j > 0 ? j - 1 : 1], r = h[j < WAVE_N - 1 ? j + 1 : WAVE_N - 2];
          v[j] += (1500 * (l + r - 2 * h[j]) - 3.2 * v[j] - 34 * h[j]) * sdt;
        }
        for (let j = 0; j < WAVE_N; j++) { v[j] = clamp(v[j], -140, 140); h[j] = clamp(h[j] + v[j] * sdt, -4.5, 4.5); }
      }

      // Gaswölkchen: Anzahl folgt dem Gasanteil des Modells
      const gasVis = sh.g;
      this.haze += (gasVis - this.haze) * Math.min(1, dt * 1.6);
      const maxPuffs = beaker ? 56 : 50;
      const want = gasVis > 0.004 ? Math.round(maxPuffs * Math.min(1, gasVis < 0.3 ? 0.06 + gasVis * 2.2 : 0.35 + gasVis * 0.65)) : 0;
      const live = this.puffs.filter((p) => !p.dying).length;
      const src = this.sourceTop(sh, sub);
      const condensed = sh.s + sh.l;
      if (live < want) {
        this.spawnAcc += dt * (boiling || proc === 'boiling' ? 34 : 18);
        while (this.spawnAcc >= 1 && this.puffs.length < maxPuffs * 1.4) {
          this.spawnAcc -= 1;
          let x, y, vy;
          if (condensed > 0.04) { x = lerp(src.x0, src.x1, R()); y = src.y - 4; vy = -(34 + 30 * R()); }
          else if (beaker) { x = BX + (R() - 0.5) * 2 * (BIH - 30); y = lerp(BTOP + 40, BFLOOR - 30, R()); vy = -(12 + 16 * R()); }
          else { x = lerp(OFX0 + 50, OFX1 - 50, R()); y = lerp(OFY0 + 50, OFY1 - 60, R()); vy = -(12 + 14 * R()); }
          this.puffs.push({ x, y, vx: (R() - 0.5) * 14, vy, r0: 22 + 12 * R(), age: 0, life: (beaker ? 5 : 3.8) + 2 * R(), seed: R() * 100, k: Math.floor(R() * 3), dying: false });
        }
      } else this.spawnAcc = 0;
      if (live > want + 1) {
        // überzählige Wölkchen lösen sich auf (Kondensieren/Resublimieren)
        let extra = live - want;
        for (const p of this.puffs) { if (extra <= 0) break; if (!p.dying) { p.dying = true; p.life = Math.min(p.life, p.age + 0.9 + R() * 0.6); extra--; } }
      }
      this.puffs = this.puffs.filter((p) => {
        p.age += dt;
        const sway = Math.sin(this.time * 0.9 + p.seed) * 9 + Math.sin(this.time * 2.1 + p.seed * 2) * 4;
        p.x += (p.vx + sway) * dt;
        p.y += p.vy * dt;
        if (condensing && p.dying) p.vy += 30 * dt;                       // beim Kondensieren sinken die letzten Wölkchen ab
        const r = p.r0 + 46 * Math.min(1, p.age / 3);
        // geschlossenes Gefäß: Wände und Deckel bzw. Ofendecke halten das Gas zurück
        const xl = beaker ? BX - BIH : OFX0, xr = beaker ? BX + BIH : OFX1;
        if (p.x < xl + r * 0.45) { p.x = Math.max(p.x, xl + r * 0.2); p.vx = Math.abs(p.vx) * 0.5 + 20 * dt; }
        if (p.x > xr - r * 0.45) { p.x = Math.min(p.x, xr - r * 0.2); p.vx = -Math.abs(p.vx) * 0.5 - 20 * dt; }
        const ceil = (beaker ? this.glassUnder(p.x) : OFY0) + r * 0.35;
        if (p.y < ceil) { p.y = ceil; p.vy = Math.max(0, p.vy * -0.1); p.vx += Math.sign(p.x - BX || 1) * 16 * dt; if (!p.dying) p.life = Math.max(p.life, p.age + 1.2); }
        return p.age < p.life && p.y > -60;
      });

      // Siedeblasen (Becherglas) bzw. platzende Blasen an der Schmelzoberfläche (Tiegel)
      if (boiling) {
        this.bubbleAcc += dt * (beaker ? 26 : 10) * (0.4 + sh.l);
        while (this.bubbleAcc >= 1) {
          this.bubbleAcc -= 1;
          if (beaker) this.bubbles.push({ x: BX + (R() - 0.5) * 2 * (BIH - 14), y: BFLOOR - 3, r: 1.2, vy: -(50 + 60 * R()), wob: R() * 6 });
          else { const y = this.crucibleLevel(sh), rx = this.crucibleRx(y); const a = R() * TAU, q = Math.sqrt(R()) * 0.75; this.bursts.push({ x: CX + Math.cos(a) * rx * q, y: y + Math.sin(a) * rx * PERSP * q, age: 0, life: 0.55 }); }
        }
      }
      const surf = beaker ? this.beakerLevels(sh).surf : 0;
      this.bubbles = this.bubbles.filter((b) => {
        b.y += b.vy * dt; b.r = Math.min(6, b.r + dt * 7); b.x += Math.sin(this.time * 8 + b.wob) * 10 * dt;
        if (b.y - b.r <= surf + 2 || sh.l < 0.01) {
          const j = clamp(Math.round(((b.x - (BX - BIH)) / (2 * BIH)) * (WAVE_N - 1)), 1, WAVE_N - 2);
          v[j] -= 18; return false;
        }
        return true;
      });
      this.bursts = this.bursts.filter((b) => { b.age += dt; return b.age < b.life; });

      // Kondenströpfchen an der Innenwand des Becherglases
      if (beaker && condensing && sh.g > 0.03) {
        this.dropAcc += dt * 9;
        while (this.dropAcc >= 1) {
          this.dropAcc -= 1;
          const k = R();
          if (k < 0.4) { const x = BX + (R() - 0.5) * 2 * (BIH - 20); this.drops.push({ x, y: this.glassUnder(x) + 2, r: 0.6, vy: 0, age: 0 }); } // unter dem Deckel
          else this.drops.push({ x: k < 0.7 ? BX - BIH + 3 : BX + BIH - 3, y: lerp(BTOP + 30, surf - 20, R()), r: 0.6, vy: 0, age: 0 });
        }
      }
      this.drops = this.drops.filter((d) => {
        d.age += dt;
        if (d.r < 3.2) d.r += dt * 2.2; else { d.vy += 120 * dt; d.y += d.vy * dt; }
        return d.y < surf - 1 && d.age < 6;
      });
    }

    // ------------------------------------------------------------ Zeichnen
    frame(dt, visible) {
      this.update(dt);
      if (!visible) return;
      if (this.resize()) this.bg = null;
      const ctx = this.ctx, v = this.view;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.bg) this.renderBackground();
      ctx.drawImage(this.bg, 0, 0);
      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      const sub = this.model.substance;
      const sh = this.model.shares();
      if (sub.vessel === 'beaker') this.drawBeaker(ctx, sub, sh);
      else this.drawCrucible(ctx, sub, sh);
      this.drawPuffs(ctx, sub);
    }

    renderBackground() {
      const c = this.bg || document.createElement('canvas');
      c.width = this.canvas.width; c.height = this.canvas.height;
      const ctx = c.getContext('2d'), v = this.view;
      const W = c.width, H = c.height;
      const wall = ctx.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#c4cfda'); wall.addColorStop(1, '#aebccb');
      ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
      ctx.setTransform(v.scale * v.dpr, 0, 0, v.scale * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
      const wx0 = -v.ox / v.scale, wx1 = (v.w - v.ox) / v.scale, wy0 = -v.oy / v.scale, wy1 = (v.h - v.oy) / v.scale;
      ctx.strokeStyle = 'rgba(80,100,120,0.13)'; ctx.lineWidth = 1;
      for (let x = Math.floor(wx0 / 80) * 80; x < wx1; x += 80) { ctx.beginPath(); ctx.moveTo(x, wy0); ctx.lineTo(x, BENCH); ctx.stroke(); }
      for (let y = BENCH - 80; y > wy0; y -= 80) { ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke(); }
      const glow = ctx.createRadialGradient(500, 300, 40, 500, 300, 620);
      glow.addColorStop(0, 'rgba(255,255,255,0.32)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(wx0, wy0, wx1 - wx0, BENCH - wy0);
      const bench = ctx.createLinearGradient(0, BENCH, 0, wy1);
      bench.addColorStop(0, '#8d9aa8'); bench.addColorStop(0.05, '#7c8997'); bench.addColorStop(1, '#66727f');
      ctx.fillStyle = bench; ctx.fillRect(wx0, BENCH, wx1 - wx0, wy1 - BENCH + 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(wx0, BENCH, wx1 - wx0, 2);
      this.bg = c;
    }

    shadow(ctx, x, y, rx, ry, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, `rgba(20,30,40,${a})`); g.addColorStop(1, 'rgba(20,30,40,0)');
      ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill(); ctx.restore();
    }

    // ------------------------------------------------------------ Becherglas
    beakerPath(ctx, inset) {
      const l = BX - BIH - GLASS + inset, r = BX + BIH + GLASS - inset, b = BFLOOR + GLASS - inset, t = BTOP;
      ctx.beginPath(); ctx.moveTo(l, t); ctx.lineTo(l, b - 14); ctx.quadraticCurveTo(l, b, l + 14, b); ctx.lineTo(r - 14, b); ctx.quadraticCurveTo(r, b, r, b - 14); ctx.lineTo(r, t);
    }
    liquidPath(ctx, surf, menis) {
      const l = BX - BIH, r = BX + BIH, h = this.waveH;
      ctx.beginPath();
      ctx.moveTo(l, surf - menis);
      for (let j = 0; j < WAVE_N; j++) {
        const x = l + (j / (WAVE_N - 1)) * (r - l);
        const edge = Math.min(j, WAVE_N - 1 - j);
        const m = edge < 3 ? menis * Math.pow(1 - edge / 3, 2) : 0;
        // sanfte, ständige Bewegung der Oberfläche (zusätzlich zu den angeregten Wellen)
        const swell = edge < 2 ? 0 : 1.1 * Math.sin(j * 0.45 + this.time * 1.7) + 0.7 * Math.sin(j * 0.21 - this.time * 1.1);
        ctx.lineTo(x, surf + h[j] + swell - m);
      }
      ctx.lineTo(r, BFLOOR - 12); ctx.quadraticCurveTo(r, BFLOOR, r - 12, BFLOOR); ctx.lineTo(l + 12, BFLOOR); ctx.quadraticCurveTo(l, BFLOOR, l, BFLOOR - 12); ctx.closePath();
    }
    drawBeaker(ctx, sub, sh) {
      const st = this.model.state;
      const L = this.beakerLevels(sh);
      this.shadow(ctx, BX, BENCH + 2, BIH * 1.3, 12, 0.35);
      // Rückwand
      this.beakerPath(ctx, 0); ctx.closePath();
      const back = ctx.createLinearGradient(BX - BIH, 0, BX + BIH, 0);
      back.addColorStop(0, 'rgba(190,212,232,0.42)'); back.addColorStop(0.5, 'rgba(255,255,255,0.22)'); back.addColorStop(1, 'rgba(190,212,232,0.4)');
      ctx.fillStyle = back; ctx.fill();

      ctx.save();
      this.beakerPath(ctx, GLASS); ctx.closePath(); ctx.clip();
      // Feststoff (vor der Flüssigkeit, damit der eingetauchte Teil getönt wirkt)
      if (sub.solid === 'iceblock' && L.ice) this.drawIce(ctx, L.ice, sh, st);
      if (sub.solid === 'flakes' && sh.s > 0.003) this.drawFlakes(ctx, sh);
      // Flüssigkeit
      if (sh.l > 0.002) {
        const col = sub.look.liquid;
        const a = sub.look.liquidAlpha * clamp(sh.l * 12, 0.3, 1);
        this.liquidPath(ctx, L.surf, 4);
        const grad = ctx.createLinearGradient(0, L.surf, 0, BFLOOR);
        grad.addColorStop(0, rgba(col, a * 0.85)); grad.addColorStop(1, rgba(mix(col, [20, 30, 50], 0.12), Math.min(0.97, a * 1.08)));
        ctx.fillStyle = grad; ctx.fill();
        const side = ctx.createLinearGradient(BX - BIH, 0, BX + BIH, 0);
        side.addColorStop(0, 'rgba(30,50,70,0.16)'); side.addColorStop(0.25, 'rgba(30,50,70,0)'); side.addColorStop(0.75, 'rgba(30,50,70,0)'); side.addColorStop(1, 'rgba(30,50,70,0.18)');
        ctx.fillStyle = side; ctx.fill();
        // Blasen
        ctx.save(); this.liquidPath(ctx, L.surf, 4); ctx.clip();
        for (const b of this.bubbles) {
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
          ctx.strokeStyle = sub.id === 'iodine' ? 'rgba(200,150,220,0.7)' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
        // Oberfläche: Glanzlinie und flache Spiegelung
        ctx.fillStyle = rgba(mix(col, [255, 255, 255], 0.5), 0.28);
        ctx.beginPath(); ctx.ellipse(BX, L.surf, BIH, 4.5, 0, 0, TAU); ctx.fill();
        this.liquidPath(ctx, L.surf, 4);
        ctx.strokeStyle = sub.id === 'iodine' ? 'rgba(190,140,200,0.55)' : 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.3; ctx.stroke();
        // Schwimmendes Eis: Teil über der Wasserlinie nochmals ohne Tönung
        if (sub.solid === 'iceblock' && L.ice) {
          ctx.save(); ctx.beginPath(); ctx.rect(BX - BIH, BTOP - 40, 2 * BIH, L.surf - (BTOP - 40)); ctx.clip();
          this.drawIce(ctx, L.ice, sh, st); ctx.restore();
        }
      }
      // Kondenströpfchen
      for (const d of this.drops) {
        const g = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0.2, d.x, d.y, d.r);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, sub.id === 'iodine' ? 'rgba(90,40,90,0.6)' : 'rgba(150,190,220,0.55)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.85, d.r, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // Vorderes Glas
      this.beakerPath(ctx, 0);
      ctx.strokeStyle = 'rgba(70,100,130,0.8)'; ctx.lineWidth = 1.8; ctx.stroke();
      this.beakerPath(ctx, GLASS);
      ctx.strokeStyle = 'rgba(70,100,130,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(70,100,130,0.65)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(BX, BTOP, BIH + GLASS / 2, 4, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(BX - BIH - GLASS, BTOP); ctx.quadraticCurveTo(BX - BIH - GLASS - 9, BTOP - 4, BX - BIH - GLASS - 12, BTOP - 9); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(BX - BIH + 8, BTOP + 12, 4, BFLOOR - BTOP - 40);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(BX + BIH - 14, BTOP + 26, 2.5, BFLOOR - BTOP - 70);
      // Skalenstriche ohne Zahlen
      ctx.strokeStyle = 'rgba(60,85,110,0.55)'; ctx.lineWidth = 1;
      for (let i = 1; i <= 6; i++) { const y = BFLOOR - i * 46; ctx.beginPath(); ctx.moveTo(BX - BIH + 22, y); ctx.lineTo(BX - BIH + (i % 2 ? 34 : 46), y); ctx.stroke(); }
      this.drawLid(ctx, st);
    }

    drawIce(ctx, ice, sh, st) {
      const melting = sh.l > 0.01;
      const bob = melting ? Math.sin(this.time * 1.3) * 1.2 : 0;
      const x = ice.x, y = ice.y + bob, w = ice.w, h = ice.h;
      ctx.save();
      rr(ctx, x, y, w, h, ice.r);
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(246,251,255,0.92)'); g.addColorStop(0.5, 'rgba(214,234,248,0.82)'); g.addColorStop(1, 'rgba(188,216,238,0.86)');
      ctx.fillStyle = g; ctx.fill();
      ctx.clip();
      // Risse und eingeschlossene Luftbläschen (milchiges Eis)
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.1;
      for (const c of this.cracks) {
        ctx.beginPath(); ctx.moveTo(x + c.x0 * w, y + c.y0 * h);
        ctx.quadraticCurveTo(x + (c.x0 + c.x1) * w / 2 + c.bend * w, y + (c.y0 + c.y1) * h / 2, x + c.x1 * w, y + c.y1 * h); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const b of this.iceBubbles) { ctx.beginPath(); ctx.arc(x + b.x * w, y + b.y * h, b.r, 0, TAU); ctx.fill(); }
      const top = ctx.createLinearGradient(0, y, 0, y + 16);
      top.addColorStop(0, 'rgba(255,255,255,0.85)'); top.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = top; ctx.fillRect(x, y, w, 16);
      ctx.restore();
      rr(ctx, x, y, w, h, ice.r);
      ctx.strokeStyle = melting ? 'rgba(255,255,255,0.95)' : 'rgba(170,200,225,0.9)'; ctx.lineWidth = melting ? 1.8 : 1.3; ctx.stroke();
      if (melting) { // nasser Glanz beim Schmelzen
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x + w * 0.12, y + 3, w * 0.3, 2);
      }
    }

    drawFlakes(ctx, sh) {
      const s = sh.s;
      const hw = 132 * (0.45 + 0.55 * Math.sqrt(s)), ph = 70 * Math.pow(s, 0.6), k = 0.55 + 0.45 * Math.pow(s, 0.4);
      const alpha = clamp(s * 25, 0, 1);
      ctx.save(); ctx.globalAlpha = alpha;
      // dunkler Grundkörper des Haufens, damit keine Lücken zwischen den Plättchen entstehen
      ctx.beginPath(); ctx.moveTo(BX - hw, BFLOOR - 2);
      for (let i = 0; i <= 24; i++) { const u = -1 + i / 12; ctx.lineTo(BX + u * hw * 0.96, BFLOOR - 4 - ph * 0.82 * (1 - u * u)); }
      ctx.lineTo(BX + hw, BFLOOR - 2); ctx.closePath();
      ctx.fillStyle = '#231e2b'; ctx.fill();
      for (const f of this.flakes) {
        const x = BX + f.u * hw, y = BFLOOR - 4 - f.v * ph;
        const L = f.size * k, Wd = L * 0.55;
        ctx.save(); ctx.translate(x, y); ctx.rotate(f.ang);
        ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(-L * 0.1, -Wd / 2); ctx.lineTo(L / 2, -Wd * 0.08); ctx.lineTo(L * 0.12, Wd / 2); ctx.closePath();
        const g = ctx.createLinearGradient(-L / 2, -Wd / 2, L / 2, Wd / 2);
        const d = 20 + f.shade * 16;
        const hi = f.glint > 0.62 ? [150, 144, 172] : [d + 42, d + 36, d + 58];
        g.addColorStop(0, `rgb(${d + 6},${d},${d + 14})`); g.addColorStop(0.42 + f.glint * 0.2, `rgb(${hi[0]},${hi[1]},${hi[2]})`); g.addColorStop(1, `rgb(${d},${d - 4},${d + 10})`);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(120,80,160,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    /** Uhrglas als Deckel (immer); bei Iod mit Eis als kalte Oberfläche und Kristallen an der Unterseite. */
    drawLid(ctx, st) {
      ctx.save();
      const span = 206;
      // Iodkristalle an der Unterseite (Resublimation)
      const n = Math.round((st.c / 0.3) * this.crystals.length * 1.0);
      for (let i = 0; i < Math.min(n + 1, this.crystals.length); i++) {
        const c = this.crystals[i];
        const grow = i < n ? 1 : (st.c / 0.3) * this.crystals.length - n;
        if (grow <= 0.02) continue;
        const y = this.glassUnder(c.x) + 0.5;
        const len = c.len * (0.4 + 0.6 * grow), wd = c.wid * (0.5 + 0.5 * grow);
        ctx.save(); ctx.translate(c.x, y); ctx.rotate(c.ang);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-wd / 2, len * 0.45); ctx.lineTo(0, len); ctx.lineTo(wd / 2, len * 0.45); ctx.closePath();
        const g = ctx.createLinearGradient(-wd, 0, wd, len);
        g.addColorStop(0, '#1f1a26'); g.addColorStop(0.5, '#6f6886'); g.addColorStop(1, '#19151f');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(160,110,200,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.restore();
      }
      // Uhrglas
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const x = BX - span + (i / 40) * 2 * span; const y = this.glassUnder(x) - 4.5; ctx[i ? 'lineTo' : 'moveTo'](x, y); }
      for (let i = 40; i >= 0; i--) { const x = BX - span + (i / 40) * 2 * span; ctx.lineTo(x, this.glassUnder(x)); }
      ctx.closePath();
      ctx.fillStyle = 'rgba(214,232,246,0.55)'; ctx.fill();
      ctx.strokeStyle = 'rgba(70,100,130,0.75)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(BX - 110, this.glassUnder(BX - 110) - 3, 46, 1.4, 0.06, 0, TAU); ctx.fill();
      // kalte Oberfläche: Eis und kaltes Wasser in der Mulde
      ctx.globalAlpha = st.coldVis;
      if (st.coldVis <= 0.01) { ctx.restore(); return; }
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const x = BX - 120 + (i / 30) * 240; ctx[i ? 'lineTo' : 'moveTo'](x, this.glassUnder(x) - 5); }
      ctx.lineTo(BX + 120, BTOP + 4); ctx.lineTo(BX - 120, BTOP + 4); ctx.closePath();
      ctx.fillStyle = 'rgba(170,205,235,0.55)'; ctx.fill();
      const cubes = [[-70, 13], [-18, 16], [36, 14], [84, 12]];
      for (const [dx, s] of cubes) {
        const x = BX + dx, y = this.glassUnder(x) - 5 - s * 1.2;
        rr(ctx, x - s, y, 2 * s, s * 1.35, 3.5);
        ctx.fillStyle = 'rgba(236,246,255,0.88)'; ctx.fill();
        ctx.strokeStyle = 'rgba(150,190,220,0.9)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - s + 3, y + 3, s * 0.7, 2);
      }
      // Reif auf der Unterseite
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 34; i++) { const x = BX - 192 + i * 11.6; ctx.fillRect(x, this.glassUnder(x) - 1, 2, 1.4); }
      ctx.restore();
    }

    // ------------------------------------------------------------ Tiegel
    /** Ofen im Schnitt: Gehäuse, Kammer aus Schamottesteinen, Heizstäbe (Farbe nach Temperatur). */
    drawFurnace(ctx, T) {
      const heat = clamp((T - 450) / 1500, 0, 1);
      const glow = glowColor(T + 60);
      this.shadow(ctx, 500, BENCH + 2, 400, 16, 0.4);
      // Kammer-Rückwand
      const wallC = mix([88, 72, 62], glow, heat * 0.5);
      const back = ctx.createLinearGradient(0, OFY0, 0, OFY1);
      back.addColorStop(0, rgba(mix(wallC, [30, 24, 20], 0.35), 1)); back.addColorStop(1, rgba(wallC, 1));
      ctx.fillStyle = back; ctx.fillRect(OFX0, OFY0, OFX1 - OFX0, OFY1 - OFY0);
      ctx.strokeStyle = rgba(mix(wallC, [20, 15, 12], 0.5), 0.7); ctx.lineWidth = 1.2;
      for (let y = OFY0 + 30, row = 0; y < OFY1; y += 30, row++) {
        ctx.beginPath(); ctx.moveTo(OFX0, y); ctx.lineTo(OFX1, y); ctx.stroke();
        for (let x = OFX0 + (row % 2 ? 40 : 0); x < OFX1; x += 80) { ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x, y); ctx.stroke(); }
      }
      // Heizstäbe an beiden Seitenwänden: Wendeln, die mit der Temperatur heller glühen
      const coil = mix([70, 58, 52], glow, clamp((T - 450) / 700, 0, 1));
      for (const x of [OFX0 + 18, OFX0 + 44, OFX1 - 44, OFX1 - 18]) {
        if (heat > 0.05) {
          const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
          g.addColorStop(0, rgba(glow, 0)); g.addColorStop(0.5, rgba(glow, 0.35 * heat)); g.addColorStop(1, rgba(glow, 0));
          ctx.fillStyle = g; ctx.fillRect(x - 26, OFY0 + 20, 52, OFY1 - OFY0 - 50);
        }
        ctx.strokeStyle = rgba(mix(coil, [20, 18, 16], 0.35), 1); ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, OFY0 + 26); ctx.lineTo(x, OFY1 - 34); ctx.stroke();
        ctx.strokeStyle = rgba(coil, 1); ctx.lineWidth = 3.2;
        ctx.beginPath();
        for (let y = OFY0 + 30; y <= OFY1 - 38; y += 3) ctx[y === OFY0 + 30 ? 'moveTo' : 'lineTo'](x + 7 * Math.sin((y - OFY0) * 0.42), y);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      // Sockel aus Schamottestein unter dem Tiegel
      ctx.fillStyle = rgba(mix([196, 170, 138], glow, heat * 0.3), 1);
      ctx.fillRect(500 - 150, 518, 300, OFY1 - 518);
      ctx.fillStyle = rgba(mix([214, 190, 158], glow, heat * 0.3), 1);
      ctx.fillRect(500 - 150, 514, 300, 6);
    }
    /** Schnittfläche des Ofengehäuses (vor der Kammer gezeichnet: Wand, Decke, Boden). */
    drawFurnaceCut(ctx) {
      ctx.save();
      ctx.beginPath(); ctx.rect(OX0, OY0, OX1 - OX0, BENCH - OY0); ctx.rect(OFX0, OFY0, OFX1 - OFX0, OFY1 - OFY0);
      ctx.fillStyle = '#d6c2a4'; ctx.fill('evenodd');
      ctx.clip('evenodd');
      ctx.strokeStyle = 'rgba(120,96,70,0.35)'; ctx.lineWidth = 1;
      for (let k = -600; k < 900; k += 14) { ctx.beginPath(); ctx.moveTo(OX0 + k, OY0); ctx.lineTo(OX0 + k + 470, BENCH); ctx.stroke(); }
      ctx.restore();
      // Blechmantel außen
      ctx.strokeStyle = '#59626d'; ctx.lineWidth = 10;
      ctx.strokeRect(OX0 + 5, OY0 + 5, OX1 - OX0 - 10, BENCH - OY0 - 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(OX0 + 1, OY0 + 1, OX1 - OX0 - 2, BENCH - OY0 - 1);
      ctx.strokeStyle = 'rgba(90,70,50,0.6)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(OFX0, OFY0, OFX1 - OFX0, OFY1 - OFY0);
    }
    drawCrucible(ctx, sub, sh) {
      const st = this.model.state;
      const T = st.Tview;
      const heat = clamp((T - 550) / 2000, 0, 1);
      const glow = glowColor(T);
      const iron = sub.id === 'iron';
      this.drawFurnace(ctx, T);
      ctx.save();
      ctx.beginPath(); ctx.rect(OFX0, OFY0, OFX1 - OFX0, OFY1 - OFY0); ctx.clip();
      ctx.save();
      ctx.translate(CTX, CTY); ctx.scale(CK, CK);
      this.shadow(ctx, CX, BASE_Y + BASE_RY - 4, BASE_RX * 1.2, 22, 0.4);
      // Inneres: Rückwand im Schatten, Boden heller (sichtbar durch die Öffnung)
      ctx.save();
      ctx.beginPath(); ctx.ellipse(CX, RIM_Y, IN_RX, IN_RY, 0, 0, TAU); ctx.clip();
      const wallC = mix([196, 189, 178], glow, heat * (iron ? 0.45 : 0.2));
      const inner = ctx.createLinearGradient(0, RIM_Y - IN_RY, 0, RIM_Y + IN_RY);
      inner.addColorStop(0, rgba(mix(wallC, [60, 55, 50], 0.45), 1)); inner.addColorStop(0.6, rgba(mix(wallC, [60, 55, 50], 0.18), 1)); inner.addColorStop(1, rgba(wallC, 1));
      ctx.fillStyle = inner; ctx.fillRect(CX - IN_RX, RIM_Y - IN_RY, 2 * IN_RX, 2 * IN_RY);
      ctx.fillStyle = rgba(mix(wallC, [255, 255, 255], 0.12), 1);
      ctx.beginPath(); ctx.ellipse(CX, CFLOOR, FLOOR_RX, FLOOR_RX * PERSP, 0, 0, TAU); ctx.fill();
      ctx.restore();

      const ys = this.crucibleLevel(sh);
      const hasLiq = sh.l > 0.003;
      // Feststoff (ganz), danach die Schmelze, danach der Teil über der Schmelze
      const drawSolid = (clipY) => {
        if (sh.s <= 0.003) return;
        ctx.save();
        if (clipY != null) { ctx.beginPath(); ctx.rect(0, 0, SW, clipY); ctx.clip(); }
        if (sub.solid === 'ingot') this.drawIngot(ctx, sh, T, glow);
        else this.drawCubes(ctx, sh, T, glow);
        ctx.restore();
      };
      drawSolid(null);
      if (hasLiq) {
        const rx = this.crucibleRx(ys), ry = rx * PERSP;
        ctx.save();
        ctx.beginPath(); ctx.ellipse(CX, RIM_Y, IN_RX, IN_RY, 0, 0, TAU); ctx.clip();
        let col, a;
        if (iron) { col = mix(glow, [255, 255, 255], 0.1); a = 1; }
        else { col = mix(sub.look.liquid, glow, 0.08 + heat * 0.18); a = sub.look.liquidAlpha; }
        const g = ctx.createRadialGradient(CX - rx * 0.25, ys - ry * 0.35, rx * 0.05, CX, ys, rx);
        g.addColorStop(0, rgba(mix(col, [255, 255, 255], iron ? 0.55 : 0.4), a));
        g.addColorStop(0.65, rgba(col, a));
        g.addColorStop(1, rgba(mix(col, iron ? [150, 50, 10] : [110, 100, 90], 0.3), a));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(CX, ys, rx, ry, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.ellipse(CX, ys, rx, ry, 0, 0, TAU); ctx.clip();
        // Schlieren auf der glühenden Schmelze bzw. Lichtreflexe auf der klaren Salzschmelze
        for (let i = 0; i < 7; i++) {
          const ph = this.time * (0.22 + i * 0.05) + i * 1.9;
          const x = CX + Math.sin(ph) * rx * 0.6, y = ys - ry * 0.6 + i * ry * 0.19 + Math.cos(ph * 1.3) * 3 + this.waveH[(i * 5) % WAVE_N] * 0.8;
          ctx.fillStyle = iron ? `rgba(170,60,10,${(0.16 * (0.6 + 0.4 * Math.sin(ph * 1.7))).toFixed(3)})` : `rgba(255,255,255,${(0.42 * (0.6 + 0.4 * Math.sin(ph * 2))).toFixed(3)})`;
          ctx.beginPath(); ctx.ellipse(x, y, rx * (0.18 + 0.06 * Math.sin(ph)), iron ? 4 : 2.2, 0, 0, TAU); ctx.fill();
        }
        if (!iron) { // Spiegelung des Fensters
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath(); ctx.ellipse(CX - rx * 0.35, ys - ry * 0.35, rx * 0.22, ry * 0.12, -0.05, 0, TAU); ctx.fill();
        }
        for (const b of this.bursts) {
          const t = b.age / b.life, rad = 4 + t * 24;
          ctx.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - t)).toFixed(3)})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(b.x, b.y, rad, rad * PERSP, 0, 0, TAU); ctx.stroke();
          if (t < 0.3) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(b.x, b.y - 4 - t * 26, 2, 0, TAU); ctx.fill(); }
        }
        ctx.restore();
        // Rand der Schmelze an der Tiegelwand
        ctx.strokeStyle = iron ? 'rgba(255,245,215,0.75)' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(CX, ys, rx, ry, 0, Math.PI, TAU); ctx.stroke();
        ctx.restore();
        // Teil des Feststoffs über der Schmelze
        drawSolid(this.waterline(ys, sh));
      }
      // Außenwand
      ctx.beginPath();
      ctx.ellipse(CX, RIM_Y, RIM_RX, RIM_RY, 0, 0, Math.PI);
      ctx.lineTo(CX - BASE_RX, BASE_Y);
      ctx.ellipse(CX, BASE_Y, BASE_RX, BASE_RY, 0, Math.PI, 0, true);
      ctx.closePath();
      const cer = [232, 228, 220];
      const outer = ctx.createLinearGradient(CX - RIM_RX, 0, CX + RIM_RX, 0);
      outer.addColorStop(0, rgba(mix(cer, [80, 75, 70], 0.42), 1)); outer.addColorStop(0.3, rgba(mix(cer, [255, 255, 255], 0.35), 1)); outer.addColorStop(0.65, rgba(cer, 1)); outer.addColorStop(1, rgba(mix(cer, [70, 65, 60], 0.5), 1));
      ctx.fillStyle = outer; ctx.fill();
      // Wärmeschein vom Rand nach unten abnehmend
      if (heat > 0.05) {
        const hg = ctx.createLinearGradient(0, RIM_Y, 0, BASE_Y + BASE_RY);
        hg.addColorStop(0, rgba(glow, heat * (iron ? 0.35 : 0.18))); hg.addColorStop(1, rgba(glow, 0));
        ctx.fillStyle = hg; ctx.fill();
      }
      ctx.strokeStyle = 'rgba(90,80,70,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
      // Randwulst (oberer Ring)
      ctx.beginPath(); ctx.ellipse(CX, RIM_Y, RIM_RX, RIM_RY, 0, 0, TAU); ctx.ellipse(CX, RIM_Y, IN_RX, IN_RY, 0, 0, TAU, true);
      ctx.fillStyle = rgba(mix(mix(cer, [255, 255, 255], 0.25), glow, heat * (iron ? 0.45 : 0.25)), 1); ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(90,80,70,0.45)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.ellipse(CX, RIM_Y, RIM_RX, RIM_RY, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(CX, RIM_Y, IN_RX, IN_RY, 0, 0, TAU); ctx.stroke();
      // Glanzlicht der Keramik
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(CX - 170, RIM_Y + 96, 30, 11, -0.25, 0, TAU); ctx.fill();
      // Glühen der Umgebung (heißes Eisen, heißes Kochsalz)
      if (sub.glow && heat > 0.05) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const k = iron ? heat * 0.3 : heat * 0.15;
        const gg = ctx.createRadialGradient(CX, RIM_Y, 40, CX, RIM_Y, 460);
        gg.addColorStop(0, rgba(glow, k * 0.6)); gg.addColorStop(1, rgba(glow, 0));
        ctx.fillStyle = gg; ctx.fillRect(CX - 480, RIM_Y - 460, 960, 920);
        ctx.restore();
      }
      ctx.restore();
      ctx.restore();
      this.drawFurnaceCut(ctx);
    }

    /** Eisenquader (Weltmaße im Tiegel; Tiefe schräg nach hinten oben). */
    ingotBox(s) {
      const k = Math.cbrt(s);
      const w = 232 * (0.3 + 0.7 * k), h = 88 * Math.pow(k, 0.9), d = 118 * (0.4 + 0.6 * k);
      return { w, h, dx: d * 0.36, dy: -d * 0.27, front: CFLOOR + 18, r: Math.min(h / 2, 1 + 16 * (1 - s)) };
    }
    /** Bildschirmhöhe, oberhalb derer der Feststoff aus der Schmelze ragt (Vorderseite). */
    waterline(ys, sh) {
      if (this.model.substance.solid === 'ingot') return ys + 18;
      return ys + 6;
    }
    drawIngot(ctx, sh, T, glow) {
      const b = this.ingotBox(sh.s);
      const melting = sh.l > 0.01;
      const hot = clamp(0.1 + 0.28 * (T - 1400) / 138, 0.1, 0.42);
      const x0 = CX - (b.w + b.dx) / 2, top = b.front - b.h;
      const r = b.r;
      ctx.save();
      ctx.lineJoin = 'round';
      const face = (pts, fill, glowA) => {
        ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        ctx.fillStyle = rgba(glow, glowA); ctx.fill();
        ctx.strokeStyle = melting ? rgba(mix(glow, [255, 255, 255], 0.55), 0.95) : 'rgba(45,50,58,0.7)';
        ctx.lineWidth = melting ? 2 + r * 0.25 : 1.2; ctx.stroke();
      };
      // rechte Seite (im Schatten), Oberseite (hell), Vorderseite
      const side = ctx.createLinearGradient(x0 + b.w, 0, x0 + b.w + b.dx, 0);
      side.addColorStop(0, '#5d6670'); side.addColorStop(1, '#46505a');
      face([[x0 + b.w, top], [x0 + b.w + b.dx, top + b.dy], [x0 + b.w + b.dx, b.front + b.dy], [x0 + b.w, b.front]], side, hot * 0.9);
      const tg = ctx.createLinearGradient(x0, top + b.dy, x0 + b.w, top);
      tg.addColorStop(0, '#c3cad2'); tg.addColorStop(0.42, '#f4f7fa'); tg.addColorStop(0.6, '#cfd6dd'); tg.addColorStop(1, '#a3acb6');
      face([[x0, top], [x0 + b.w, top], [x0 + b.w + b.dx, top + b.dy], [x0 + b.dx, top + b.dy]], tg, hot * 0.75);
      const fg = ctx.createLinearGradient(0, top, 0, b.front);
      fg.addColorStop(0, '#a4adb7'); fg.addColorStop(0.55, '#7e8892'); fg.addColorStop(1, '#5f6872');
      face([[x0, top], [x0 + b.w, top], [x0 + b.w, b.front], [x0, b.front]], fg, hot);
      // gebürsteter Metallglanz
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x0 + b.w * 0.08, top + b.h * 0.2, b.w * 0.55, Math.max(1.5, b.h * 0.05));
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x0 + b.w * 0.08, top + b.h * 0.42, b.w * 0.4, Math.max(1, b.h * 0.03));
      ctx.restore();
    }

    drawCubes(ctx, sh, T, glow) {
      const s = sh.s;
      const hw = 238 * (0.4 + 0.6 * Math.sqrt(s)), ph = 128 * Math.pow(s, 0.6), k = 0.5 + 0.5 * Math.pow(s, 0.4);
      const tint = clamp((T - 700) / 900, 0, 1) * 0.2;
      const alpha = clamp(s * 25, 0, 1);
      ctx.save(); ctx.globalAlpha = alpha;
      // weiße Salzkruste auf dem Tiegelboden, darauf die Kristallwürfel
      const crx = FLOOR_RX * 0.94 * (0.45 + 0.55 * Math.sqrt(s)), cry = crx * PERSP, ct = 14 * (0.35 + 0.65 * s);
      const ccy = CFLOOR + 6;
      ctx.fillStyle = rgba(mix([214, 220, 228], glow, tint), 1);
      ctx.beginPath(); ctx.ellipse(CX, ccy, crx, cry, 0, 0, Math.PI); ctx.lineTo(CX - crx, ccy - ct); ctx.ellipse(CX, ccy - ct, crx, cry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
      const top = ctx.createRadialGradient(CX - crx * 0.3, ccy - ct - cry * 0.3, 10, CX, ccy - ct, crx);
      top.addColorStop(0, rgba(mix([255, 255, 255], glow, tint * 0.6), 1)); top.addColorStop(1, rgba(mix([226, 232, 238], glow, tint), 1));
      ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(CX, ccy - ct, crx, cry, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(150,165,180,0.35)';
      for (let i = 0; i < 70; i++) { const a = i * 2.39996, q = Math.sqrt((i + 0.5) / 70); ctx.fillRect(CX + Math.cos(a) * crx * q * 0.95, ccy - ct + Math.sin(a) * cry * q * 0.95, 2.2, 1.4); }
      ctx.strokeStyle = 'rgba(150,165,180,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(CX, ccy - ct, crx, cry, 0, 0, TAU); ctx.stroke();
      for (const c of this.cubes) {
        const a = c.size * k;
        const x = CX + c.u * hw * 0.92, y = ccy - ct + c.w * crx * PERSP * 0.8 - c.v * ph + 4;
        const sh0 = 0.9 + c.shade * 0.1;
        const front = mix([232 * sh0, 237 * sh0, 242 * sh0], glow, tint), top = mix([255, 255, 255], glow, tint * 0.7), side = mix([190 * sh0, 201 * sh0, 212 * sh0], glow, tint);
        const dx = a * 0.34, dy = a * 0.3;
        ctx.save(); ctx.translate(x, y); ctx.rotate(c.tilt);
        ctx.fillStyle = rgba(front, 1); ctx.fillRect(-a / 2, -a, a, a);
        ctx.beginPath(); ctx.moveTo(-a / 2, -a); ctx.lineTo(a / 2, -a); ctx.lineTo(a / 2 + dx, -a - dy); ctx.lineTo(-a / 2 + dx, -a - dy); ctx.closePath();
        ctx.fillStyle = rgba(top, 1); ctx.fill();
        ctx.beginPath(); ctx.moveTo(a / 2, -a); ctx.lineTo(a / 2 + dx, -a - dy); ctx.lineTo(a / 2 + dx, -dy); ctx.lineTo(a / 2, 0); ctx.closePath();
        ctx.fillStyle = rgba(side, 1); ctx.fill();
        ctx.strokeStyle = 'rgba(105,120,138,0.6)'; ctx.lineWidth = 0.8;
        ctx.strokeRect(-a / 2, -a, a, a);
        ctx.beginPath(); ctx.moveTo(-a / 2, -a); ctx.lineTo(-a / 2 + dx, -a - dy); ctx.lineTo(a / 2 + dx, -a - dy); ctx.lineTo(a / 2 + dx, -dy); ctx.lineTo(a / 2, 0); ctx.moveTo(a / 2, -a); ctx.lineTo(a / 2 + dx, -a - dy); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // ------------------------------------------------------------ Gaswölkchen
    drawPuffs(ctx, sub) {
      const rgb = sub.look.gas;
      const white = rgb[0] > 240 && rgb[1] > 240;
      const beakerV = sub.vessel === 'beaker';
      ctx.save();
      this.interiorPath(ctx, beakerV); ctx.clip();
      // gleichmäßiger Dunst: Das Gas füllt den Raum (Stärke folgt dem Gasanteil)
      if (this.haze > 0.01) {
        const beaker = sub.vessel === 'beaker';
        const cx = beaker ? BX : 500, cy = beaker ? 350 : 320, rx = beaker ? 260 : 360, ry = beaker ? 260 : 220;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
        const k = this.haze * (white ? 0.34 : 0.42);
        g.addColorStop(0, rgba(rgb, k)); g.addColorStop(0.6, rgba(rgb, k * 0.7)); g.addColorStop(1, rgba(rgb, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (!this.puffs.length) { ctx.restore(); return; }
      const sp = this.sprite(rgb), halo = this.sprites[rgb.join(',') + 'h'];
      for (const p of this.puffs) {
        const r = p.r0 + 46 * Math.min(1, p.age / 3);
        const fin = Math.min(1, p.age / 0.45), fout = clamp((p.life - p.age) / (p.life * 0.4), 0, 1);
        const a = fin * fout * (white ? 0.85 : 0.6) * (1 - 0.35 * this.haze);
        if (a <= 0.01) continue;
        if (white) { ctx.globalAlpha = a * 0.12; ctx.drawImage(halo, p.x - r * 1.1, p.y - r * 1.05, r * 2.2, r * 2.1); }
        ctx.globalAlpha = a;
        ctx.drawImage(sp[p.k], p.x - r, p.y - r, 2 * r, 2 * r);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  (root.AZ = root.AZ || {}).renderMatter = { MatterRenderer, glowColor, SW, SH };
})(typeof self !== 'undefined' ? self : this);
