/*
 * Trennverfahren – Laborbühne (Canvas 2D)
 *
 * Liest den Modellzustand und zeichnet ihn; verändert ihn nie.
 * Glas, Meniskus, gedämpfte Oberflächenwellen, Tropfenimpulse und Ringwellen nach
 * TitraLab 3 (titration/js/view/lab-renderer.js), übertragen auf neue Gefäßformen
 * und den hellen Hintergrund. Flüssigkeitsspiegel bleiben beim Neigen waagrecht
 * (geometry.js); Strahl, Tropfen, Absetzfront, Bodensatz, Emulsionströpfchen,
 * Kristalle und Dunst folgen ausschließlich den Modellgrößen.
 * Visuelle Effekte laufen nur, solange die Versuchszeit läuft (Pause hält alles an).
 */
(function (root) {
  'use strict';
  const G = root.TV.geometry;
  const Mo = root.TV.model;
  const { clamp, lerp, easeInOut } = root.LK.core;
  const TAU = Math.PI * 2;
  const GRAV = 9000; // Weltpixel/s² (≈ 0,8 g bei 1,25 px/mm, damit Strahlen sichtbar bleiben)
  const WAVE_N = 28;
  /** Gezeichneter Tropfen ≈ realer Tropfen (0,05 mL); ab etwa 8 bis 14 Tropfen/s wird daraus ein Rinnsal. */
  const DROP_V = 0.05;
  const STREAM_ON = [8, 14];
  const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

  const COL = {
    water: [140, 190, 232], waterA: 0.3,
    oil: [226, 182, 44], oilA: 0.62,
    sandC: '#c9a56b', sandF: '#a99a86', iron: '#4a4f57', salt: '#f7f7f4',
    glass: 'rgba(98,128,160,0.85)', glassThin: 'rgba(98,128,160,0.35)', glassBack: 'rgba(210,228,245,0.22)'
  };

  // Deterministischer Zufall (für Körner, Kristalle, Fliesen)
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function createRenderer(canvas, getEngine, getView) {
    const ctx = canvas.getContext('2d');
    const view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };
    let vis = {}; // visuelle Zustände je Objekt
    let fx = { drops: [], splashes: [], mist: [], flyers: [], puddles: [], bubbles: [], jets: [] };
    let curExp = null;
    let time = 0;
    let reduce = false;
    try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }

    function V(id) {
      if (!vis[id]) {
        const r = rng(id.charCodeAt(0) * 977 + (id.charCodeAt(1) || 7) * 131);
        vis[id] = {
          h: new Float32Array(WAVE_N), v: new Float32Array(WAVE_N), rings: [], th: 0, surf: null,
          grains: Array.from({ length: 140 }, (_, i) => ({ u: r(), v: (i + r()) / 140, ph: r() * TAU, s: 0.7 + r() * 0.7, k: r() })),
          drops: Array.from({ length: 80 }, (_, i) => ({ u: r(), v: r(), ph: r() * TAU, s: 0.6 + r() * 0.9, k: i / 80 })),
          crystals: Array.from({ length: 60 }, () => ({ a: r() * TAU, rr: 0.35 + r() * 0.62, s: 0.6 + r() * 0.8, rot: r() * 0.8 })),
          dripAcc: 0, streamOn: 0
        };
      }
      return vis[id];
    }
    function impulse(id, u, strength) {
      if (reduce) return;
      const w = V(id);
      const idx = clamp(Math.round(u * (WAVE_N - 1)), 1, WAVE_N - 2);
      for (let k = -3; k <= 3; k++) { const i = idx + k; if (i >= 0 && i < WAVE_N) w.v[i] += strength * Math.exp(-(k * k) / 3); }
    }

    // ------------------------------------------------------------------ Ansicht
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      view.dpr = dpr; view.w = r.width; view.h = r.height;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      fit();
    }
    function fit() {
      const e = getEngine();
      const W = e.exp.width;
      const top = e.exp.viewTop || 0;
      const s = Math.min(view.w / W, view.h / (G.H - top));
      view.scale = s;
      view.ox = (view.w - W * s) / 2;
      view.oy = view.h - G.H * s;
    }
    const base = () => ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, view.dpr * view.ox, view.dpr * view.oy);
    function applyPose(p) { ctx.translate(p.x, p.y); if (p.th) ctx.rotate(p.th); ctx.translate(-(p.ax || 0), -(p.ay || 0)); }

    // ------------------------------------------------------------------ Posen
    const slotOf = (st, id) => Mo.slotOf(st, id);
    function homePose(st, o, slotId) {
      const slot = slotOf(st, slotId || o.at);
      if (o.type === 'stopper' && st.objs[o.at] && st.objs[o.at].type === 'sep') { const sp = homePose(st, st.objs[o.at]); return { x: sp.x, y: sp.y - 212, th: 0, ax: 0, ay: 0, onSep: true }; }
      if (!slot) return { x: 0, y: G.BASE_Y, th: 0, ax: 0, ay: 0 };
      const p = G.placePose(o.type, slot);
      if (['magnet', 'rod', 'paper', 'stopper', 'wash'].includes(o.type)) return { x: slot.x, y: slot.kind === 'shelf' ? G.SHELF_Y : slot.kind === 'front' ? G.FRONT_Y : G.BASE_Y, th: 0, ax: 0, ay: 0 };
      return Object.assign({ ax: 0, ay: 0 }, p);
    }
    function lipPose(o, pose) { const L = G.LIP[o.type]; return { x: pose.x + L[0], y: pose.y + L[1], ax: L[0], ay: L[1], th: pose.th || 0 }; }

    /** Füllung in Flächeneinheiten (für gekippte Gefäße). */
    const areaFill = (o) => G.areaOf(o.type, G.fillVolume(o.c));

    function targetPose(st, o) {
      const p = homePose(st, o);
      return p;
    }

    /** Aktuelle Pose eines Objekts unter Berücksichtigung laufender Handgriffe. */
    function poseOf(st, o, dt) {
      const op = st.op;
      const w = V(o.id);
      if (op && op.type === 'move' && op.v === o.id) {
        const a = homePose(st, o, op.from), b = homePose(st, o, op.to);
        const p = easeInOut(clamp(op.t / op.dur, 0, 1));
        return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) - Math.sin(Math.PI * p) * 40, th: lerp(a.th || 0, b.th || 0, p), ax: 0, ay: 0, moving: true };
      }
      if (op && op.type === 'pour' && op.src === o.id) {
        const home = homePose(st, o);
        const dst = st.objs[op.dst];
        const dpose = homePose(st, dst);
        const tgt = G.pourTarget(dst.type, dpose);
        const solid = Mo.liq(o.c) < 0.5;
        const need = solid ? lerp(1.35, 0.95, clamp(Mo.solids(o.c) / 20, 0, 1)) : G.pourAngle(o.type, areaFill(o));
        if (op.phase === 'go' && w.th0 == null) {
          w.th0 = Math.max(0.25, need - (solid ? 0.35 : 0.05));
          // Gefäßkörper darf das Ziel nicht berühren: notfalls höher ansetzen
          const ext = G.EXTENT[o.type];
          const corners = [[ext.x0, ext.y0], [ext.x0, ext.y1], [ext.x1, ext.y1], [ext.x1 * 0.5, ext.y1]];
          const lp = { x: tgt.x, y: tgt.y, ax: G.LIP[o.type][0], ay: G.LIP[o.type][1], th: w.th0 };
          const low = Math.max(...G.transform(corners, lp).filter((q) => Math.abs(q[0] - tgt.x) < tgt.r + 60).map((q) => q[1]), -1e9);
          w.lift = Math.max(0, low - (tgt.top - 10));
          w.th = 0;
        }
        const P1 = { x: tgt.x, y: tgt.y - (w.lift || 0), ax: G.LIP[o.type][0], ay: G.LIP[o.type][1] };
        const P0 = lipPose(o, home);
        if (op.phase === 'go') {
          const p = easeInOut(clamp(op.t / op.dur, 0, 1));
          w.th = lerp(0, w.th0, p);
          return { x: lerp(P0.x, P1.x, p), y: lerp(P0.y, P1.y, p) - Math.sin(Math.PI * p) * 20, ax: P1.ax, ay: P1.ay, th: w.th, pouring: true, lip: P1 };
        }
        if (op.phase === 'flow') {
          const extra = solid ? 0 : (st.pourSpeed === 'fast' ? 0.13 : 0.05);
          const goal = Math.min(2.25, need + extra);
          w.th += (goal - w.th) * (1 - Math.exp(-dt * 5));
          w.thBack = w.th;
          return { x: P1.x, y: P1.y, ax: P1.ax, ay: P1.ay, th: w.th, pouring: true, lip: P1, flowing: true };
        }
        const p = easeInOut(clamp(op.t / op.dur, 0, 1));
        const th = lerp(w.thBack || w.th, 0, p);
        return { x: lerp(P1.x, P0.x, p), y: lerp(P1.y, P0.y, p) - Math.sin(Math.PI * p) * 14, ax: P1.ax, ay: P1.ay, th, pouring: true, lip: P1 };
      }
      if (w.th0 != null && !(op && op.type === 'pour' && op.src === o.id)) { w.th0 = null; w.lift = 0; }
      if (op && op.type === 'shake' && op.v === o.id) {
        const p = homePose(st, o);
        const env = Math.sin(Math.PI * clamp(op.t / op.dur, 0, 1));
        return Object.assign({}, p, { th: Math.sin(op.t * TAU * 1.6) * 0.32 * env, ax: 0, ay: -150, y: p.y - 150 - env * 22 });
      }
      return homePose(st, o);
    }

    // ------------------------------------------------------------------ Hintergrund
    function drawBackground(W) {
      const g = ctx.createLinearGradient(0, 0, 0, G.BENCH_TOP);
      g.addColorStop(0, '#dfe5ec'); g.addColorStop(1, '#d2d9e1');
      ctx.fillStyle = g; ctx.fillRect(-400, -200, W + 800, G.BENCH_TOP + 200);
      // dezente Fliesenfugen
      ctx.strokeStyle = 'rgba(140,153,168,0.28)'; ctx.lineWidth = 1;
      for (let y = G.BENCH_TOP - 60; y > -200; y -= 60) { ctx.beginPath(); ctx.moveTo(-400, y); ctx.lineTo(W + 400, y); ctx.stroke(); }
      for (let x = -400, i = 0; x < W + 400; x += 60, i++) { ctx.beginPath(); ctx.moveTo(x, -200); ctx.lineTo(x, G.BENCH_TOP); ctx.stroke(); }
      // Tischplatte
      const t = ctx.createLinearGradient(0, G.BENCH_TOP, 0, G.BENCH_FRONT);
      t.addColorStop(0, '#d4dbe2'); t.addColorStop(1, '#c4ccd5');
      ctx.fillStyle = t; ctx.fillRect(-400, G.BENCH_TOP, W + 800, G.BENCH_FRONT - G.BENCH_TOP);
      ctx.fillStyle = '#a9b3be'; ctx.fillRect(-400, G.BENCH_FRONT, W + 800, 4);
      const f = ctx.createLinearGradient(0, G.BENCH_FRONT + 4, 0, G.H + 40);
      f.addColorStop(0, '#8e98a4'); f.addColorStop(1, '#6f7985');
      ctx.fillStyle = f; ctx.fillRect(-400, G.BENCH_FRONT + 4, W + 800, G.H + 200);
    }
    function shadow(x, y, w, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, w);
      g.addColorStop(0, `rgba(40,55,70,${a})`); g.addColorStop(1, 'rgba(40,55,70,0)');
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.18); ctx.translate(-x, -y);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, w, 0, TAU); ctx.fill(); ctx.restore();
    }

    // ------------------------------------------------------------------ Stativ, Heizplatte
    function drawStand(x, rodX, top, ringY, ringR, part) {
      if (part === 'back') {
        shadow(rodX + 10, G.BASE_Y + 2, 70, 0.25);
        // Fuß
        const fg = ctx.createLinearGradient(0, G.BASE_Y - 12, 0, G.BASE_Y);
        fg.addColorStop(0, '#5d6670'); fg.addColorStop(1, '#353c45');
        ctx.fillStyle = fg; roundRect(ctx, rodX - 52, G.BASE_Y - 11, 120, 12, 3); ctx.fill();
        // Stange
        const rg = ctx.createLinearGradient(rodX - 4, 0, rodX + 4, 0);
        rg.addColorStop(0, '#8d97a3'); rg.addColorStop(0.45, '#eef2f6'); rg.addColorStop(1, '#7c8692');
        ctx.fillStyle = rg; ctx.fillRect(rodX - 4, top, 8, G.BASE_Y - 11 - top);
        // Muffe und Arm
        ctx.fillStyle = '#2f353d'; roundRect(ctx, rodX - 9, ringY - 9, 18, 18, 3); ctx.fill();
        const ag = ctx.createLinearGradient(0, ringY - 3, 0, ringY + 3);
        ag.addColorStop(0, '#c5ccd4'); ag.addColorStop(1, '#6f7884');
        ctx.fillStyle = ag; ctx.fillRect(x + ringR, ringY - 2.5, rodX - 9 - x - ringR, 5);
        // hintere Ringhälfte
        ctx.strokeStyle = '#6c7682'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(x, ringY, ringR, ringR * 0.22, 0, Math.PI, TAU); ctx.stroke();
      } else {
        ctx.strokeStyle = '#8a949f'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(x, ringY, ringR, ringR * 0.22, 0, 0, Math.PI); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, ringY - 1, ringR, ringR * 0.22, 0, 0.2, Math.PI - 0.2); ctx.stroke();
      }
    }
    function drawPlate(st, x) {
      const p = st.plate;
      const w = G.PLATE.w, h = G.PLATE.h, top = G.PLATE_TOP;
      shadow(x, G.BASE_Y + 2, w * 0.6, 0.3);
      const bg = ctx.createLinearGradient(0, top, 0, G.BASE_Y);
      bg.addColorStop(0, '#e9edf1'); bg.addColorStop(1, '#b8c1ca');
      ctx.fillStyle = bg; roundRect(ctx, x - w / 2, top + 6, w, h - 6, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(70,85,100,0.4)'; ctx.lineWidth = 1; ctx.stroke();
      // Heizfläche
      const heat = clamp((p.T - 30) / 300, 0, 1);
      const hg = ctx.createLinearGradient(0, top, 0, top + 8);
      hg.addColorStop(0, rgba([lerp(70, 235, heat), lerp(76, 80, heat), lerp(84, 40, heat)], 1));
      hg.addColorStop(1, '#2b3036');
      ctx.fillStyle = hg; roundRect(ctx, x - w / 2 + 8, top, w - 16, 9, 3); ctx.fill();
      if (heat > 0.05) {
        const gl = ctx.createRadialGradient(x, top + 2, 4, x, top + 2, w * 0.55);
        gl.addColorStop(0, `rgba(255,120,40,${0.35 * heat})`); gl.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - w, top - 30, w * 2, 40);
      }
      // Kontrolllampe und Stufenanzeige (Punkte)
      const on = p.level > 0;
      ctx.fillStyle = on ? '#ff6a2a' : '#8b95a0';
      ctx.beginPath(); ctx.arc(x + w / 2 - 22, top + 22, 5, 0, TAU); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,106,42,0.3)'; ctx.beginPath(); ctx.arc(x + w / 2 - 22, top + 22, 9, 0, TAU); ctx.fill(); }
      for (let i = 0; i < 2; i++) { ctx.fillStyle = i < p.level ? '#ff8a3c' : '#c3cbd3'; ctx.fillRect(x - w / 2 + 50 + i * 14, top + 19, 10, 6); }
      // Drehknopf (am Gerät bedienbar): Skala 0 · 1 · 2 und Zeiger
      const kx = x - w / 2 + 25, ky = top + 21;
      ctx.font = `700 7px ${FONT}`; ctx.fillStyle = '#56616d'; ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) { const a = -Math.PI * 0.85 + i * Math.PI * 0.35; ctx.fillText(String(i), kx + Math.cos(a) * 15, ky + Math.sin(a) * 15 + 2.5); }
      ctx.fillStyle = '#2f363f'; ctx.beginPath(); ctx.arc(kx, ky, 10, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(kx, ky, 8.5, 0, TAU); ctx.stroke();
      const ka = -Math.PI * 0.85 + p.level * Math.PI * 0.35;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(kx + Math.cos(ka) * 2, ky + Math.sin(ka) * 2); ctx.lineTo(kx + Math.cos(ka) * 8, ky + Math.sin(ka) * 8); ctx.stroke(); ctx.lineCap = 'butt';
    }

    // ------------------------------------------------------------------ Flüssigkeit in Glasgefäßen
    /** Pfad des Innenraums (lokal). */
    function interiorPath(type) {
      const poly = G.interiorPoly(type);
      ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.closePath();
    }
    /** Wellige waagrechte Fläche: alles unterhalb des Spiegels (Welt), innerhalb des Clippings. */
    function wavyBelow(w, level, xa, xb, amp, vortex) {
      const pad = 200;
      ctx.beginPath();
      ctx.moveTo(xa - pad, level + (w ? w.h[0] * amp : 0));
      for (let i = 0; i < WAVE_N; i++) {
        const u = i / (WAVE_N - 1);
        const rel = (u - 0.5) * 2;
        const vx = vortex ? vortex * Math.exp(-rel * rel * 5) - vortex * 0.25 : 0;
        ctx.lineTo(xa + u * (xb - xa), level + (w ? w.h[i] * amp : 0) + vx);
      }
      ctx.lineTo(xb + pad, level + (w ? w.h[WAVE_N - 1] * amp : 0));
      ctx.lineTo(xb + pad, level + 900); ctx.lineTo(xa - pad, level + 900); ctx.closePath();
    }
    function surfaceSpan(polyW, level) {
      const cl = G.clipBelow(polyW, level - 0.01);
      let xa = Infinity, xb = -Infinity;
      for (const p of cl) if (Math.abs(p[1] - level) < 0.6) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); }
      if (!isFinite(xa)) { for (const p of cl) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); } }
      return [xa, xb];
    }

    /** Glasgefäß (Becherglas, Erlenmeyerkolben) mit Inhalt, ggf. geneigt. */
    function drawGlassVessel(st, o, pose) {
      const type = o.type, c = o.c, w = V(o.id);
      const polyL = G.interiorPoly(type);
      const polyW = G.transform(polyL, pose);
      const bedV = G.bedVolume(c);
      const fillV = G.fillVolume(c);
      const liquid = Mo.liq(c);
      const off = G.BASE_OFFSET[type];
      if (!pose.th) shadow(pose.x, G.BASE_Y + 2, type === 'erlenmeyer' ? 62 : 52, 0.22);
      // Rückwand
      ctx.save(); applyPose(pose);
      glassBody(type, 'back');
      ctx.restore();

      ctx.save(); applyPose(pose); interiorPath(type); ctx.clip(); base();
      let level = null, xa = 0, xb = 0;
      if (liquid > 0.02) {
        level = G.levelFor(polyW, G.areaOf(type, fillV));
        [xa, xb] = surfaceSpan(polyW, level);
        w.surf = { y: level, xa, xb, id: o.id };
        const amp = 1;
        const stirring = st.op && st.op.type === 'stir' && st.op.v === o.id;
        const vortex = stirring && !reduce ? 3.5 * Math.min(1, o.agit) : 0;
        // Wasserphase (mit gelöstem Salz: farblos klar wie Wasser)
        wavyBelow(w, level, xa, xb, amp, vortex);
        const top = level, bot = Math.max(...polyW.map((p) => p[1]));
        const wg = ctx.createLinearGradient(0, top, 0, bot);
        wg.addColorStop(0, rgba(COL.water, COL.waterA * 0.8)); wg.addColorStop(1, rgba(COL.water, COL.waterA * 1.25));
        ctx.fillStyle = wg; ctx.fill();
        // Öl obenauf (nicht emulgierter Anteil)
        const oilLayer = c.oil * (1 - o.emul);
        if (oilLayer > 0.05) {
          const ifl = G.levelFor(polyW, G.areaOf(type, Math.max(0, fillV - oilLayer)));
          ctx.save(); wavyBelow(w, level, xa, xb, amp, vortex); ctx.clip();
          ctx.fillStyle = rgba(COL.oil, COL.oilA);
          ctx.fillRect(-500, level - 30, 3000, ifl - level + 30);
          // Grenzfläche Öl/Wasser
          ctx.strokeStyle = 'rgba(176,132,20,0.75)'; ctx.lineWidth = 1.2;
          const [ia, ib] = surfaceSpan(polyW, ifl);
          ctx.beginPath(); ctx.moveTo(ia, ifl); ctx.lineTo(ib, ifl); ctx.stroke();
          ctx.restore();
        }
        // Emulsion: milchige Trübung und Öltröpfchen in der Wasserphase
        if (o.emul > 0.01 && c.oil > 0.05) {
          ctx.save(); wavyBelow(w, level, xa, xb, amp, vortex); ctx.clip();
          ctx.fillStyle = `rgba(238,222,160,${(0.5 * o.emul).toFixed(3)})`;
          ctx.fillRect(-500, level - 30, 3000, 900);
          drawDroplets(o, w, polyW, level, bot);
          ctx.restore();
        }
        // Schwebstoffe: Trübung (Feinanteil) und Körner (grob, Eisen, Salz) unterhalb der Absetzfront
        ctx.save(); wavyBelow(w, level, xa, xb, amp, vortex); ctx.clip();
        drawSuspension(o, w, polyW, polyL, pose, bedV);
        ctx.restore();
        // Spiegel: 2,5D-Ellipse, Glanzlinie und Meniskus
        const rx = (xb - xa) / 2, cx = (xa + xb) / 2;
        const ry = Math.min(6, rx * 0.09) * Math.max(0.25, Math.cos(pose.th || 0));
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.ellipse(cx, level, rx, ry, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < WAVE_N; i++) {
          const u = i / (WAVE_N - 1); const rel = (u - 0.5) * 2;
          const vx = vortex ? vortex * Math.exp(-rel * rel * 5) - vortex * 0.25 : 0;
          const x = xa + u * (xb - xa), y = level + w.h[i] + vx;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(90,120,150,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xa, level - 2.6); ctx.quadraticCurveTo(xa + 1, level + w.h[0], xa + 6, level + w.h[1]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xb, level - 2.6); ctx.quadraticCurveTo(xb - 1, level + w.h[WAVE_N - 1], xb - 6, level + w.h[WAVE_N - 2]); ctx.stroke();
        for (const r of w.rings) {
          const t = r.age / r.life, rr = 3 + t * rx * 0.8;
          ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - t)).toFixed(3)})`;
          ctx.beginPath(); ctx.ellipse(r.x, level, rr, rr * 0.1 + 0.6, 0, 0, TAU); ctx.stroke();
        }
      } else w.surf = { y: Math.max(...polyW.map((p) => p[1])) - G.heightOf(type, bedV), xa: pose.x - 30, xb: pose.x + 30, id: o.id, empty: true };
      // Bodensatz (lokal, haftet am Boden)
      if (bedV > 0.01) { ctx.save(); applyPose(pose); drawBed(o, off, liquid > 0.3); ctx.restore(); }
      ctx.restore();
      // Vorderglas
      ctx.save(); applyPose(pose); glassBody(type, 'front'); ctx.restore();
    }

    function drawDroplets(o, w, polyW, level, bot) {
      const n = Math.round(80 * clamp(o.emul * 1.1, 0, 1));
      const ys = level, ye = bot;
      let xmin = Infinity, xmax = -Infinity;
      for (const p of polyW) { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); }
      ctx.fillStyle = 'rgba(214,166,30,0.78)';
      for (let i = 0; i < n; i++) {
        const d = w.drops[i];
        const rise = (1 - o.emul) * 0.85;
        const vy = clamp(d.v * (1 - rise) + 0.02 * Math.sin(time * 0.7 + d.ph), 0.02, 0.98);
        const y = ye - (ye - ys) * (1 - vy) * 0.98;
        const x = xmin + 6 + (xmax - xmin - 12) * d.u + Math.sin(time * 1.3 + d.ph) * 3 * o.agit;
        ctx.beginPath(); ctx.arc(x, y, 1.6 * d.s + 1.2 * o.emul, 0, TAU); ctx.fill();
      }
    }

    /** Absetzfront und Schwebkörner. */
    function drawSuspension(o, w, polyW, polyL, pose, bedV) {
      const c = o.c;
      const type = o.type;
      const bot = Math.max(...polyW.map((p) => p[1]));
      const L = Mo.liq(c);
      const bedTopArea = G.areaOf(type, bedV);
      const zone = (k) => {
        const s = o.susp[k];
        if (s.m < 1e-4 || s.fv < 0.05) return null;
        const yTop = G.levelFor(polyW, G.areaOf(type, bedV + Math.max(0, s.fv - G.PORE * bedV)));
        const yBed = G.levelFor(polyW, bedTopArea);
        return { yTop, yBed, C: s.m / s.fv, f: s.fv / Math.max(L, 1) };
      };
      // Feinanteil: Trübung
      const zf = zone('sandF');
      if (zf) {
        const a = clamp(zf.C * 22, 0, 0.75);
        const g = ctx.createLinearGradient(0, zf.yTop - 4, 0, zf.yTop + 6);
        g.addColorStop(0, 'rgba(160,140,110,0)'); g.addColorStop(1, `rgba(160,140,110,${a.toFixed(3)})`);
        ctx.fillStyle = g; ctx.fillRect(-500, zf.yTop - 4, 3000, 10);
        ctx.fillStyle = `rgba(160,140,110,${a.toFixed(3)})`; ctx.fillRect(-500, zf.yTop + 6, 3000, bot - zf.yTop);
      }
      // grobe Körner
      const sets = [['sandC', COL.sandC, 2.1, 7], ['iron', COL.iron, 1.8, 10], ['saltS', '#ffffff', 1.7, 8]];
      let xmin = Infinity, xmax = -Infinity;
      for (const p of polyW) { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); }
      const stirring = o.agit;
      for (const [k, col, size, perG] of sets) {
        const z = zone(k);
        if (!z) continue;
        const ref = Math.max(c[k], 1);
        const f = clamp(o.susp[k].m / ref, 0, 1);
        const nMax = Math.min(140, Math.round(ref * perG));
        ctx.fillStyle = col;
        ctx.strokeStyle = k === 'saltS' ? 'rgba(120,130,140,0.6)' : 'rgba(60,45,25,0.25)';
        ctx.lineWidth = 0.6;
        for (let i = 0; i < nMax; i++) {
          const g = w.grains[i];
          const vv = g.v;
          if (vv < 1 - f) continue;
          const rel = (vv - (1 - f)) / Math.max(f, 1e-3);
          const y = z.yBed - (z.yBed - z.yTop) * rel + Math.cos(g.ph + time * 3) * 5 * stirring;
          const x = xmin + 5 + (xmax - xmin - 10) * ((g.u + Math.sin(g.ph + time * (2 + 3 * stirring)) * 0.18 * stirring + 1) % 1);
          const s = size * g.s;
          ctx.beginPath();
          ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.2, y - s * 0.8); ctx.lineTo(x + s, y - s * 0.3); ctx.lineTo(x + s * 0.4, y + s * 0.7); ctx.closePath();
          ctx.fill(); if (k === 'saltS') ctx.stroke();
        }
      }
    }

    /** Bodensatz im lokalen Gefäßsystem (Schichten nach Absetzgeschwindigkeit; trocken: Gemenge). */
    function drawBed(o, off, wet) {
      const c = o.c, type = o.type;
      const suspended = (k) => Math.min(c[k], o.susp[k].m);
      const amt = { iron: c.iron - suspended('iron'), saltS: c.saltS - suspended('saltS'), sandC: c.sandC - suspended('sandC'), sandF: c.sandF - suspended('sandF') };
      const rnd = rng(o.id.charCodeAt(0) * 31 + 5);
      const layers = wet ? ['iron', 'saltS', 'sandC', 'sandF'] : ['mix'];
      let cum = 0;
      for (const k of layers) {
        const vol = k === 'mix' ? (amt.iron / G.BULK.iron + amt.saltS / G.BULK.saltS + amt.sandC / G.BULK.sandC + amt.sandF / G.BULK.sandF) : amt[k] / G.BULK[k];
        if (vol < 0.005) continue;
        const h0 = G.heightOf(type, cum), h1 = G.heightOf(type, cum + vol);
        cum += vol;
        const y0 = off - h0, y1 = off - h1;
        const r1 = G.rAt(type, h1), r0 = G.rAt(type, h0);
        const top = y1 - (k === 'sandF' || k === 'mix' ? 0 : 0);
        ctx.beginPath();
        ctx.moveTo(-r0, y0); ctx.lineTo(-r1, top + 1.5);
        ctx.quadraticCurveTo(0, top - Math.min(4, (h1 - h0) * 0.3), r1, top + 1.5);
        ctx.lineTo(r0, y0); ctx.closePath();
        const colr = k === 'mix' ? '#b89f78' : k === 'iron' ? COL.iron : k === 'saltS' ? '#f2f2ee' : k === 'sandF' ? COL.sandF : COL.sandC;
        ctx.fillStyle = colr; ctx.fill();
        if (wet && k !== 'saltS') { ctx.fillStyle = 'rgba(40,60,80,0.16)'; ctx.fill(); }
        // Körnung
        const n = Math.min(260, Math.round((h1 - h0) * r1 * 0.5));
        for (let i = 0; i < n; i++) {
          const yy = lerp(y0 - 1, top + 2, rnd()), rr = G.rAt(type, off - yy) - 2;
          const xx = (rnd() * 2 - 1) * rr;
          let cc;
          if (k === 'mix') { const q = rnd() * (amt.iron + amt.saltS + amt.sandC + amt.sandF); cc = q < amt.iron ? '#3b3f46' : q < amt.iron + amt.saltS ? '#ffffff' : q < amt.iron + amt.saltS + amt.sandC ? '#d8b77d' : '#9d8f7c'; }
          else cc = k === 'iron' ? (rnd() < 0.5 ? '#2f333a' : '#6b717a') : k === 'saltS' ? (rnd() < 0.5 ? '#ffffff' : '#d9dde2') : k === 'sandF' ? '#8f8270' : (rnd() < 0.5 ? '#e1c48f' : '#a8875a');
          ctx.fillStyle = cc; ctx.fillRect(xx, yy, 1.6, 1.6);
        }
      }
    }

    /** Glaskörper (lokal): 'back' Rückwand, 'front' Konturen, Glanz, Skala. */
    function glassBody(type, part) {
      if (type === 'beaker') {
        const x0 = -43.5, x1 = 43.5, top = -121;
        if (part === 'back') {
          const g = ctx.createLinearGradient(x0, 0, x1, 0);
          g.addColorStop(0, 'rgba(200,220,240,0.30)'); g.addColorStop(0.5, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(200,220,240,0.26)');
          ctx.fillStyle = g; roundRect(ctx, x0, top, x1 - x0, -top, 5); ctx.fill();
          return;
        }
        ctx.strokeStyle = COL.glass; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x0 - 1.5, top - 1); ctx.lineTo(x0, top + 2); ctx.lineTo(x0, -5); ctx.quadraticCurveTo(x0, 0, x0 + 5, 0);
        ctx.lineTo(x1 - 5, 0); ctx.quadraticCurveTo(x1, 0, x1, -5); ctx.lineTo(x1, top + 4); ctx.quadraticCurveTo(x1 + 1, top - 1, x1 + 4, top - 3.5);
        ctx.stroke();
        ctx.strokeStyle = COL.glassThin; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-41, top + 3); ctx.lineTo(-41, -3); ctx.lineTo(41, -3); ctx.lineTo(41, top + 4); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,150,180,0.7)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.ellipse(-1, top, 44, 2.6, 0, 0, TAU); ctx.stroke();
        // Glanz
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x0 + 5, top + 12, 3, -top - 28);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x1 - 9, top + 18, 2, -top - 40);
        // Skala
        ctx.strokeStyle = 'rgba(70,90,110,0.55)'; ctx.fillStyle = 'rgba(70,90,110,0.7)'; ctx.lineWidth = 1;
        ctx.font = `600 7.5px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (const ml of [50, 100, 150, 200]) {
          const y = -3 - G.heightOf('beaker', ml);
          ctx.beginPath(); ctx.moveTo(-24, y); ctx.lineTo(-12, y); ctx.stroke();
          ctx.fillText(String(ml), -9, y);
        }
        return;
      }
      if (type === 'erlenmeyer') {
        if (part === 'back') {
          ctx.fillStyle = 'rgba(210,228,245,0.22)';
          erlPath(0); ctx.fill();
          return;
        }
        ctx.strokeStyle = COL.glass; ctx.lineWidth = 1.6; erlPath(0); ctx.stroke();
        ctx.strokeStyle = COL.glassThin; ctx.lineWidth = 1; erlPath(2.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,150,180,0.75)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(0, -181, 21, 2.4, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.moveTo(-44, -14); ctx.lineTo(-17, -118); ctx.lineTo(-14, -118); ctx.lineTo(-40, -14); ctx.closePath(); ctx.fill();
        ctx.fillRect(-15, -172, 2, 44);
        ctx.strokeStyle = 'rgba(70,90,110,0.5)'; ctx.fillStyle = 'rgba(70,90,110,0.7)'; ctx.lineWidth = 1;
        ctx.font = `600 7.5px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (const ml of [50, 100, 150]) {
          const h = G.heightOf('erlenmeyer', ml), y = -3 - h, r = G.rAt('erlenmeyer', h);
          ctx.beginPath(); ctx.moveTo(r * 0.15, y); ctx.lineTo(r * 0.45, y); ctx.stroke();
          ctx.fillText(String(ml), r * 0.5, y);
        }
      }
    }
    function erlPath(inset) {
      const e = 2.5 - inset;
      ctx.beginPath();
      ctx.moveTo(-18 - e + 2.5, -181);
      ctx.lineTo(-18 - e + 2.5, -128);
      ctx.lineTo(-49 - e, -9);
      ctx.quadraticCurveTo(-50 - e, -inset, -42, -inset);
      ctx.lineTo(42, -inset);
      ctx.quadraticCurveTo(50 + e, -inset, 49 + e, -9);
      ctx.lineTo(18 + e - 2.5, -128);
      ctx.lineTo(18 + e - 2.5, -181);
    }

    // ------------------------------------------------------------------ Schalen (Porzellan, Uhrglas): leicht von oben
    const PERSP = 0.3; // sin des Blickwinkels
    function drawDish(st, o, pose) {
      const type = o.type, c = o.c, w = V(o.id);
      const R = G.rAt(type, G.topH(type)), D = G.topH(type);
      const glass = type === 'watch';
      if (!pose.th) shadow(pose.x, G.BASE_Y + 1, R + 8, 0.2);
      ctx.save(); applyPose(pose);
      const rimY = -D - (type === 'watch' ? 2 : 6);
      const cy = rimY;
      const sy = (h) => cy + (D - h) * Math.cos(Math.asin(PERSP)) * 0.9;
      // Außenseite
      ctx.beginPath();
      ctx.moveTo(-R - 3, rimY);
      ctx.bezierCurveTo(-R - 2, rimY + D * 0.75, -R * 0.45, 0, 0, 0);
      ctx.bezierCurveTo(R * 0.45, 0, R + 2, rimY + D * 0.75, R + 3, rimY);
      ctx.ellipse(0, rimY, R + 3, (R + 3) * PERSP, 0, 0, Math.PI);
      const og = ctx.createLinearGradient(-R, 0, R, 0);
      if (glass) { og.addColorStop(0, 'rgba(190,212,235,0.45)'); og.addColorStop(0.5, 'rgba(240,248,255,0.25)'); og.addColorStop(1, 'rgba(190,212,235,0.4)'); }
      else { og.addColorStop(0, '#d9dde2'); og.addColorStop(0.35, '#ffffff'); og.addColorStop(1, '#c4cad2'); }
      ctx.fillStyle = og; ctx.fill();
      ctx.strokeStyle = glass ? COL.glass : 'rgba(110,120,135,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
      if (type !== 'watch') { ctx.fillStyle = glass ? 'rgba(0,0,0,0)' : '#cfd5dc'; roundRect(ctx, -R * 0.42, -4, R * 0.84, 5, 2); ctx.fill(); }
      // Innenfläche (Öffnung)
      ctx.beginPath(); ctx.ellipse(0, rimY, R, R * PERSP, 0, 0, TAU);
      const ig = ctx.createRadialGradient(-R * 0.2, rimY - 2, 2, 0, rimY, R);
      if (glass) { ig.addColorStop(0, 'rgba(235,244,252,0.6)'); ig.addColorStop(1, 'rgba(180,205,230,0.5)'); }
      else { ig.addColorStop(0, '#ffffff'); ig.addColorStop(1, '#dde2e8'); }
      ctx.fillStyle = ig; ctx.fill();
      ctx.save(); ctx.clip();
      if (o.paper) { ctx.fillStyle = '#fbfbf8'; ctx.beginPath(); ctx.ellipse(0, rimY + 2, R * 0.92, R * 0.92 * PERSP, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(150,158,168,0.7)'; ctx.lineWidth = 1; ctx.stroke(); ctx.strokeStyle = 'rgba(170,178,188,0.55)'; ctx.beginPath(); ctx.moveTo(-R * 0.8, rimY + 2); ctx.lineTo(R * 0.8, rimY + 2); ctx.moveTo(0, rimY + 2 - R * 0.28); ctx.lineTo(0, rimY + 2 + R * 0.28); ctx.stroke(); }
      const liquid = Mo.liq(c);
      const fill = G.fillVolume(c);
      const bedV = G.bedVolume(c);
      // Feststoffe (Kristalle, Eisen, Sand, Gemenge)
      const hb = G.heightOf(type, bedV);
      if (bedV > 0.005) drawDishSolids(o, w, R, D, sy, hb, liquid);
      if (liquid > 0.02) {
        const h = G.heightOf(type, fill), r = G.rAt(type, h), y = sy(h);
        const oil = c.oil > 0.05 && c.water < 0.05;
        ctx.fillStyle = oil ? rgba(COL.oil, 0.55) : 'rgba(170,205,235,0.42)';
        ctx.beginPath(); ctx.ellipse(0, y, r, r * PERSP, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(0, y, r - 1, r * PERSP - 0.5, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
        ctx.strokeStyle = 'rgba(80,110,140,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, y, r, r * PERSP, 0, 0, TAU); ctx.stroke();
        // Wellen als Ringe
        for (const rr of w.rings) {
          const t = rr.age / rr.life, rad = 2 + t * r * 0.8;
          ctx.strokeStyle = `rgba(255,255,255,${(0.7 * (1 - t)).toFixed(3)})`;
          ctx.beginPath(); ctx.ellipse(rr.dx || 0, y, rad, rad * PERSP, 0, 0, TAU); ctx.stroke();
        }
        // Siedeblasen nur beim tatsächlichen Sieden
        if (o.boil) for (const b of fx.bubbles.filter((q) => q.id === o.id)) {
          ctx.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - b.age / b.life)).toFixed(3)})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(b.u * r * 0.8, y + b.v * r * PERSP * 0.7, b.s * (0.5 + b.age / b.life), b.s * 0.5 * (0.5 + b.age / b.life), 0, 0, TAU); ctx.stroke();
        }
        w.surf = { y: pose.y + y + 1, xa: pose.x - r, xb: pose.x + r, id: o.id, dish: true };
        // Kristalle an der Oberfläche/am Rand der Flüssigkeit (sichtbar durch die klare Lösung)
        if (c.saltS > 0.01) drawCrystals(o, w, r, y, false);
      } else w.surf = { y: pose.y + sy(hb) + 1, xa: pose.x - R * 0.5, xb: pose.x + R * 0.5, id: o.id, dish: true, empty: true };
      ctx.restore();
      // Rand
      ctx.strokeStyle = glass ? 'rgba(110,140,170,0.85)' : 'rgba(150,158,168,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, rimY, R + 1.5, (R + 1.5) * PERSP, 0, 0, TAU); ctx.stroke();
      if (type === 'dish') { ctx.fillStyle = '#e8ecf0'; ctx.beginPath(); ctx.moveTo(-R - 2, rimY); ctx.lineTo(-R - 11, rimY - 3); ctx.lineTo(-R - 9, rimY + 3); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    function drawDishSolids(o, w, R, D, sy, hb, liquid) {
      const c = o.c;
      const r = G.rAt(o.type, hb), y = sy(hb);
      const tot = c.iron + c.saltS + Mo.sand(c);
      if (o.type === 'dish' && c.saltS > 0 && tot - c.saltS < 0.05) { if (liquid < 0.02) drawCrystals(o, w, Math.max(r, R * 0.6), y, true); return; }
      const rnd = rng(o.id.charCodeAt(0) * 13 + 3);
      // Hügel
      const hr = Math.max(r, R * 0.35);
      ctx.beginPath(); ctx.ellipse(0, y, hr, hr * PERSP + Math.min(6, hb * 0.3), 0, 0, TAU);
      const mix = (c.iron * 0.3 + Mo.sand(c) * 0.75 + c.saltS * 0.98) / Math.max(tot, 1e-3);
      ctx.fillStyle = c.iron / Math.max(tot, 1e-3) > 0.9 ? '#555a62' : `rgb(${(150 + 90 * mix) | 0},${(130 + 100 * mix) | 0},${(100 + 120 * mix) | 0})`;
      ctx.fill();
      if (liquid > 0.3) { ctx.fillStyle = 'rgba(40,60,80,0.15)'; ctx.fill(); }
      const n = Math.min(420, Math.round(tot * 22));
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, rr = Math.sqrt(rnd()) * hr;
        const x = Math.cos(a) * rr, yy = y + Math.sin(a) * rr * PERSP - (1 - rr / hr) * Math.min(5, hb * 0.3);
        const q = rnd() * tot;
        ctx.fillStyle = q < c.iron ? (rnd() < 0.5 ? '#2d3137' : '#6c727b') : q < c.iron + c.saltS ? '#ffffff' : (rnd() < 0.5 ? '#dcc08b' : '#a58558');
        ctx.fillRect(x, yy, 1.8, 1.8);
      }
    }
    function drawCrystals(o, w, r, y, dry) {
      const n = Math.min(60, Math.round(o.c.saltS * 7));
      for (let i = 0; i < n; i++) {
        const k = w.crystals[i];
        const grow = clamp(o.c.saltS * 7 - i, 0, 1);
        const rr = dry ? k.rr * r : (0.78 + k.rr * 0.22) * r;
        const x = Math.cos(k.a) * rr, yy = y + Math.sin(k.a) * rr * PERSP;
        const s = (1.6 + 2.4 * k.s) * grow * (dry ? 1.2 : 1);
        ctx.save(); ctx.translate(x, yy); ctx.rotate(k.rot);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = 'rgba(120,135,150,0.75)'; ctx.lineWidth = 0.6; ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }

    // ------------------------------------------------------------------ Trichter
    function drawFunnel(st, o, pose) {
      const out = st.op && st.op.type === 'paperOut' && st.op.v === o.id;
      const c = out ? Mo.zero() : o.c, w = V(o.id);
      const paper = o.paper && !out;
      ctx.save(); applyPose(pose);
      const R = 42, Hc = 66;
      // Rückwand
      ctx.fillStyle = 'rgba(210,228,245,0.25)';
      ctx.beginPath(); ctx.moveTo(-R - 2, -Hc); ctx.lineTo(-5, -2); ctx.lineTo(-5, 88); ctx.lineTo(5, 88); ctx.lineTo(5, -2); ctx.lineTo(R + 2, -Hc); ctx.closePath(); ctx.fill();
      // Inhalt im Kegel
      const bedV = G.bedVolume(c), fill = G.fillVolume(c);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-R + (paper ? 3 : 0), -Hc + (paper ? 4 : 0)); ctx.lineTo(0, -1); ctx.lineTo(R - (paper ? 3 : 0), -Hc + (paper ? 4 : 0)); ctx.closePath(); ctx.clip();
      if (Mo.liq(c) > 0.02) {
        const h = G.heightOf('funnel', fill), r = G.rAt('funnel', h), y = -h;
        ctx.fillStyle = c.oil > c.water ? rgba(COL.oil, 0.6) : rgba(COL.water, 0.4);
        ctx.fillRect(-R, y, 2 * R, h + 2);
        if (Mo.sand(c) + c.iron > 0.05 && !paper) { ctx.fillStyle = 'rgba(160,140,110,0.5)'; ctx.fillRect(-R, y, 2 * R, h + 2); }
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); for (let i = 0; i < WAVE_N; i++) { const u = i / (WAVE_N - 1); const x = -r + 2 * r * u; if (i) ctx.lineTo(x, y + w.h[i] * 0.7); else ctx.moveTo(x, y + w.h[i] * 0.7); } ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(0, y, r, r * 0.12, 0, 0, TAU); ctx.fill();
        for (const rr of w.rings) { const t = rr.age / rr.life, rad = 2 + t * r * 0.8; ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - t)).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(rr.dx || 0, y, rad, rad * 0.12, 0, 0, TAU); ctx.stroke(); }
        w.surf = { y: pose.y + y, xa: pose.x - r, xb: pose.x + r, id: o.id };
      } else w.surf = { y: pose.y - G.heightOf('funnel', bedV) - 2, xa: pose.x - 10, xb: pose.x + 10, id: o.id, empty: true };
      if (bedV > 0.005) {
        const hb = G.heightOf('funnel', bedV), rb = G.rAt('funnel', hb);
        ctx.beginPath(); ctx.moveTo(-rb, -hb); ctx.quadraticCurveTo(0, -hb - Math.min(5, hb * 0.25), rb, -hb); ctx.lineTo(0, -1); ctx.closePath();
        const tot = Mo.solids(c);
        const mix = (c.iron * 0.3 + Mo.sand(c) * 0.75 + c.saltS) / Math.max(tot, 1e-3);
        ctx.fillStyle = `rgb(${(150 + 85 * mix) | 0},${(128 + 95 * mix) | 0},${(95 + 110 * mix) | 0})`; ctx.fill();
        if (c.water > 0.2) { ctx.fillStyle = 'rgba(40,60,80,0.15)'; ctx.fill(); }
        const rnd = rng(77);
        const n = Math.min(260, Math.round(tot * 18));
        for (let i = 0; i < n; i++) {
          const yy = -rnd() * hb, rr = G.rAt('funnel', -yy) - 1.5, xx = (rnd() * 2 - 1) * rr;
          const q = rnd() * tot;
          ctx.fillStyle = q < c.iron ? '#3a3e45' : q < c.iron + c.saltS ? '#ffffff' : (rnd() < 0.5 ? '#dcc08b' : '#a58558');
          ctx.fillRect(xx, yy, 1.6, 1.6);
        }
      }
      ctx.restore();
      // Filterpapier
      if (paper) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.moveTo(-R + 3, -Hc + 4); ctx.lineTo(0, -2); ctx.lineTo(R - 3, -Hc + 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(150,160,170,0.8)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = 'rgba(170,178,188,0.6)';
        ctx.beginPath(); ctx.moveTo(-R * 0.35, -Hc + 6); ctx.lineTo(-1, -4); ctx.moveTo(R * 0.2, -Hc + 5); ctx.lineTo(1, -4); ctx.stroke();
        if (c.water > 0.1 || st.flags.filtered > 0) { ctx.fillStyle = 'rgba(150,190,225,0.18)'; ctx.beginPath(); ctx.moveTo(-R + 3, -Hc + 4); ctx.lineTo(0, -2); ctx.lineTo(R - 3, -Hc + 4); ctx.closePath(); ctx.fill(); }
      }
      // Flüssigkeit im Rohr, wenn es läuft
      const flow = st.drip.F;
      if (flow > 0.01 && pose.y === G.RING.funnelApex) {
        ctx.fillStyle = rgba(COL.water, 0.55);
        ctx.fillRect(-1.6, -1, 3.2, flow > 0.8 ? 89 : 30);
      }
      // Glas
      ctx.strokeStyle = COL.glass; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-R - 3, -Hc - 1); ctx.lineTo(-5, -3); ctx.lineTo(-4.5, 86); ctx.lineTo(-3.5, 90); ctx.moveTo(3.5, 90); ctx.lineTo(4.5, 86); ctx.lineTo(5, -3); ctx.lineTo(R + 3, -Hc - 1); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,150,180,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(0, -Hc - 1, R + 3, 3, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(-R + 4, -Hc + 6); ctx.lineTo(-8, -8); ctx.lineTo(-6, -8); ctx.lineTo(-R + 8, -Hc + 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function drawFunnelHolder(x) {
      const top = G.BASE_Y - 46;
      shadow(x, G.BASE_Y + 1, 40, 0.2);
      const g = ctx.createLinearGradient(x - 34, 0, x + 34, 0);
      g.addColorStop(0, '#b98d5c'); g.addColorStop(0.5, '#d9b07e'); g.addColorStop(1, '#a87c4d');
      ctx.fillStyle = g; roundRect(ctx, x - 30, top, 60, 46, 4); ctx.fill();
      ctx.fillStyle = '#6e4f2f'; ctx.beginPath(); ctx.ellipse(x, top + 1, 9, 2.4, 0, 0, TAU); ctx.fill();
    }
    function drawSepCradle(x) {
      shadow(x + 70, G.BASE_Y + 1, 110, 0.2);
      ctx.fillStyle = '#c69a68';
      roundRect(ctx, x - 36, G.BASE_Y - 16, 16, 16, 3); ctx.fill();
      roundRect(ctx, x + 150, G.BASE_Y - 22, 16, 22, 3); ctx.fill();
      ctx.fillStyle = '#a77d50'; ctx.fillRect(x - 40, G.BASE_Y - 4, 212, 4);
    }

    // ------------------------------------------------------------------ Scheidetrichter
    function sepPath(inset) {
      const p = G.PROFILES.sep;
      const e = 2.5 - inset;
      ctx.beginPath();
      ctx.moveTo(-(p[0][1] + e), -p[0][0]);
      for (const [h, r] of p) ctx.lineTo(-(r + e), -h);
      for (let i = p.length - 1; i >= 0; i--) ctx.lineTo(p[i][1] + e, -p[i][0]);
      ctx.closePath();
    }
    function drawSep(st, o, pose) {
      const c = o.c, w = V(o.id);
      ctx.save(); applyPose(pose);
      ctx.fillStyle = 'rgba(210,228,245,0.25)'; sepPath(0); ctx.fill();
      const total = Mo.liq(c);
      if (total > 0.02) {
        ctx.save(); sepPath(2.5); ctx.clip();
        const wp = c.water + c.oil * o.emul;
        const hT = G.heightOf('sep', total), hW = G.heightOf('sep', wp);
        const shaking = st.op && st.op.type === 'shake' && st.op.v === o.id;
        const rT = G.rAt('sep', hT);
        // Wasserphase
        ctx.fillStyle = rgba(COL.water, 0.42);
        ctx.fillRect(-60, -hW, 120, hW + 2);
        if (o.emul > 0.01) {
          ctx.fillStyle = `rgba(238,222,160,${(0.55 * o.emul).toFixed(3)})`; ctx.fillRect(-60, -hT, 120, hT + 2);
          ctx.fillStyle = 'rgba(214,166,30,0.8)';
          const n = Math.round(80 * clamp(o.emul * 1.1, 0, 1));
          for (let i = 0; i < n; i++) {
            const d = w.drops[i];
            const rise = (1 - o.emul) * 0.85;
            const vy = clamp(d.v * (1 - rise) + 0.02 * Math.sin(time * 0.7 + d.ph), 0.02, 0.98);
            const h = hW * vy, rr = G.rAt('sep', h) - 3;
            const x = (d.u * 2 - 1) * rr + (shaking ? Math.sin(time * 9 + d.ph) * 4 : 0);
            ctx.beginPath(); ctx.arc(x, -h, 1.4 * d.s + 1.1 * o.emul, 0, TAU); ctx.fill();
          }
        }
        // Ölschicht
        const oilL = c.oil * (1 - o.emul);
        if (oilL > 0.05) {
          ctx.fillStyle = rgba(COL.oil, COL.oilA);
          ctx.fillRect(-60, -hT, 120, hT - hW);
          ctx.strokeStyle = 'rgba(176,132,20,0.8)'; ctx.lineWidth = 1.3;
          const rW = G.rAt('sep', hW);
          ctx.beginPath(); ctx.moveTo(-rW, -hW); ctx.lineTo(rW, -hW); ctx.stroke();
        }
        // Spiegel
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); for (let i = 0; i < WAVE_N; i++) { const u = i / (WAVE_N - 1); const x = -rT + 2 * rT * u; const y = -hT + w.h[i] * 0.8; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(0, -hT, rT, rT * 0.1, 0, 0, TAU); ctx.fill();
        ctx.restore();
        w.surf = { y: pose.y - hT, xa: pose.x - rT, xb: pose.x + rT, id: o.id };
      } else w.surf = { y: pose.y - 4, xa: pose.x - 3, xb: pose.x + 3, id: o.id, empty: true };
      // Auslauf mit Flüssigkeit
      if (st.drip.S > 0.01 && !pose.lying) {
        const outCol = c.water > 0.01 ? rgba(COL.water, 0.6) : rgba(COL.oil, 0.8);
        ctx.fillStyle = outCol; ctx.fillRect(-1.5, 0, 3, st.drip.S > 1.5 ? 78 : 22);
      }
      // Glas
      ctx.strokeStyle = COL.glass; ctx.lineWidth = 1.6; sepPath(0); ctx.stroke();
      ctx.strokeStyle = COL.glassThin; ctx.lineWidth = 1; sepPath(2.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(-34, -70); ctx.quadraticCurveTo(-40, -120, -34, -160); ctx.lineTo(-31, -160); ctx.quadraticCurveTo(-36, -120, -31, -70); ctx.closePath(); ctx.fill();
      // Auslaufrohr
      ctx.strokeStyle = COL.glass; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(-3, 78); ctx.moveTo(3.5, 0); ctx.lineTo(3, 78); ctx.stroke();
      // Hahn (Küken): Griff waagrecht = geschlossen, schräg = Tropfen, senkrecht = offen
      ctx.fillStyle = 'rgba(200,215,230,0.9)'; roundRect(ctx, -11, 6, 22, 12, 4); ctx.fill();
      ctx.strokeStyle = COL.glass; ctx.lineWidth = 1; ctx.stroke();
      const ang = [0, Math.PI / 4, Math.PI / 2][o.cock];
      ctx.save(); ctx.translate(16, 12); ctx.rotate(ang);
      ctx.fillStyle = '#2f6fd0'; roundRect(ctx, -3, -13, 6, 26, 3); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2f6fd0'; ctx.beginPath(); ctx.arc(10, 12, 4, 0, TAU); ctx.fill();
      // Stopfen
      if (o.stopper && !(st.op && st.op.type === 'stopper')) {
        ctx.fillStyle = '#d4dbe3'; roundRect(ctx, -11, -232, 22, 22, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(90,105,120,0.8)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#b8c2cd'; roundRect(ctx, -15, -236, 30, 7, 3); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(120,150,180,0.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, -215, 14.5, 2.5, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------ Werkzeuge
    function drawRod(pose, inUse) {
      ctx.save(); applyPose(pose);
      if (!inUse) { shadow(0, 4, 70, 0.15); }
      const g = ctx.createLinearGradient(0, -3, 0, 3);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(170,200,230,0.7)'); g.addColorStop(1, 'rgba(120,150,180,0.85)');
      ctx.fillStyle = g; roundRect(ctx, -72, -6, 144, 5, 2.5); ctx.fill();
      ctx.restore();
    }
    function drawRodInVessel(st, o, op) {
      const w = V(o.id);
      const s = w.surf;
      if (!s) return;
      const p = clamp(op.t / op.dur, 0, 1);
      const env = Math.min(1, p * 6, (1 - p) * 6);
      const cx = (s.xa + s.xb) / 2, rx = (s.xb - s.xa) / 2;
      const bottom = s.y + (o.type === 'dish' ? 4 : Math.max(10, (G.BASE_Y - s.y) - 14));
      const tx = cx + Math.sin(op.t * 8) * rx * 0.55 * env;
      const ty = Math.min(bottom, s.y + 30) + Math.cos(op.t * 8) * 3;
      const ang = 0.32 + Math.sin(op.t * 8) * 0.08;
      const len = 170;
      const x2 = tx + Math.sin(ang) * len, y2 = ty - Math.cos(ang) * len;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(140,175,210,0.9)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(tx + (s.y - ty) * Math.tan(ang), s.y); ctx.stroke();
      // unter der Oberfläche leicht versetzt (Brechung)
      ctx.strokeStyle = 'rgba(140,175,210,0.6)';
      ctx.beginPath(); ctx.moveTo(tx + (s.y - ty) * Math.tan(ang) + 2, s.y); ctx.lineTo(tx + 2, ty); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x2 - 1.5, y2); ctx.lineTo(tx + (s.y - ty) * Math.tan(ang) - 1.5, s.y); ctx.stroke();
      ctx.restore();
    }
    function drawPaperStack(pose, gone) {
      ctx.save(); applyPose(pose);
      shadow(0, 3, 44, 0.15);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === 2 ? '#ffffff' : '#f1f3f5';
        ctx.beginPath(); ctx.ellipse(i * 1.5, -2 - i * 2.2, 36, 8, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(140,150,160,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.restore();
    }
    function drawPaperFlying(st, op) {
      const f = st.objs[op.v];
      const p = clamp(op.t / op.dur, 0, 1);
      const from = homePose(st, st.objs.paper), to = homePose(st, f);
      const e = easeInOut(Math.min(1, p * 1.4));
      const x = lerp(from.x, to.x, e), y = lerp(from.y - 10, to.y - 50, e) - Math.sin(Math.PI * e) * 40;
      ctx.save(); ctx.translate(x, y);
      const fold = clamp((p - 0.5) * 2.5, 0, 1);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(140,150,160,0.7)';
      ctx.beginPath();
      if (fold < 0.05) ctx.ellipse(0, 0, 36, 9, 0, 0, TAU);
      else { ctx.moveTo(-38 * (1 - fold * 0.1), -10 * fold); ctx.lineTo(0, 40 * fold); ctx.lineTo(38 * (1 - fold * 0.1), -10 * fold); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    function drawWashBottle(pose) {
      ctx.save();
      if (pose.flip) { ctx.translate(pose.x, pose.y); ctx.rotate(pose.th); ctx.scale(-1, 1); ctx.translate(-38, 134); }
      else applyPose(pose);
      if (!pose.th) shadow(0, 2, 34, 0.2);
      const bg = ctx.createLinearGradient(-26, 0, 26, 0);
      bg.addColorStop(0, 'rgba(225,232,240,0.95)'); bg.addColorStop(0.5, 'rgba(250,252,255,0.95)'); bg.addColorStop(1, 'rgba(210,220,230,0.95)');
      ctx.fillStyle = bg; roundRect(ctx, -26, -104, 52, 104, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(110,125,140,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(160,200,235,0.45)'; roundRect(ctx, -23, -70, 46, 67, 8); ctx.fill();
      ctx.fillStyle = '#2f6fd0'; roundRect(ctx, -12, -118, 24, 15, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(235,240,245,0.95)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -118); ctx.lineTo(0, -138); ctx.quadraticCurveTo(2, -146, 14, -146); ctx.lineTo(38, -134); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,135,150,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center';
      if (pose.flip) { ctx.save(); ctx.scale(-1, 1); ctx.fillText('H₂O', 0, -36); ctx.restore(); } else ctx.fillText('H₂O', 0, -36);
      ctx.restore();
    }
    const washNozzle = (pose) => { if (pose.ax === 38 && pose.ay === -134) return { x: pose.x, y: pose.y }; const q = G.toWorld(pose, 38, -134); return { x: q[0], y: q[1] }; };
    function drawMagnet(pose, iron, vertical) {
      ctx.save(); applyPose(pose);
      if (!vertical && !pose.th) shadow(0, 3, 56, 0.18);
      // Stabmagnet: rot (N) und grün (S)
      ctx.fillStyle = '#d63a3a'; roundRect(ctx, -48, -18, 48, 16, 2); ctx.fill();
      ctx.fillStyle = '#2f9a57'; roundRect(ctx, 0, -18, 48, 16, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `700 10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('N', -40, -10); ctx.fillText('S', 40, -10);
      // Kunststofftüte
      ctx.fillStyle = 'rgba(235,242,250,0.45)'; roundRect(ctx, -54, -22, 112, 24, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(150,170,190,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      // Eisenbart am Nordpol (links)
      if (iron > 0.01) {
        const rnd = rng(17);
        const n = Math.min(160, Math.round(iron * 30));
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (rnd() - 0.5) * 2.6, r = 2 + rnd() * (4 + Math.sqrt(iron) * 4);
          ctx.fillStyle = rnd() < 0.5 ? '#2d3137' : '#5d636c';
          ctx.fillRect(-54 - Math.cos(a) * r * 0.6 - 2, -10 + Math.sin(a - Math.PI / 2) * r, 1.8, 1.8);
        }
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------ Effekte
    function updateEffects(st, dt, k) {
      time += dt;
      // Wellen (1D-Wellengleichung mit Dämpfung, nach TitraLab 3)
      for (const id in vis) {
        const w = vis[id];
        const sub = Math.max(2, Math.ceil(dt / 0.005)), sdt = dt / sub;
        for (let s = 0; s < sub; s++) {
          for (let i = 0; i < WAVE_N; i++) {
            const l = w.h[i > 0 ? i - 1 : 1], r = w.h[i < WAVE_N - 1 ? i + 1 : WAVE_N - 2];
            const vl = w.v[i > 0 ? i - 1 : 1], vr = w.v[i < WAVE_N - 1 ? i + 1 : WAVE_N - 2];
            const acc = 1500 * (l + r - 2 * w.h[i]) + 35 * (vl + vr - 2 * w.v[i]) - 3.2 * w.v[i] - 36 * w.h[i];
            w.v[i] += acc * sdt;
          }
          for (let i = 0; i < WAVE_N; i++) { w.v[i] = clamp(w.v[i], -150, 150); w.h[i] = clamp(w.h[i] + w.v[i] * sdt, -4, 4); }
        }
        w.rings = w.rings.filter((r) => (r.age += dt) < r.life);
      }
      // Rührbewegung, Schütteln, Sieden regen die Oberfläche an
      for (const id of st.order) {
        const o = st.objs[id];
        if (!o.c) continue;
        if (o.agit > 0.2 && Math.random() < dt * 8 * o.agit) impulse(id, 0.15 + Math.random() * 0.7, (Math.random() - 0.5) * 9 * o.agit);
        if (o.boil && Math.random() < dt * 14) {
          impulse(id, Math.random(), (Math.random() - 0.5) * 6);
          fx.bubbles.push({ id, u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, s: 1.2 + Math.random() * 2.2, age: 0, life: 0.5 + Math.random() * 0.4 });
        }
        // Dunst (kondensiertes Wasser) über heißer Flüssigkeit; der Wasserdampf selbst bleibt unsichtbar
        if (o.evap > 0.004 && o.temp > 60 && vis[id] && vis[id].surf) {
          const s = vis[id].surf;
          const k = clamp(o.evap / 0.12, 0, 1);
          if (Math.random() < dt * (5 + 30 * k)) fx.mist.push({ x: lerp(s.xa, s.xb, 0.2 + Math.random() * 0.6), y: s.y - 24 - Math.random() * 10, vx: (Math.random() - 0.5) * 12, vy: -22 - Math.random() * 18, r: 7 + Math.random() * 9, age: 0, life: 1.9 + Math.random() * 1.5, a: 0.3 + 0.35 * k });
        }
      }
      fx.bubbles = fx.bubbles.filter((b) => (b.age += dt) < b.life);
      fx.mist = fx.mist.filter((m) => { m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt; m.r += dt * 8; return m.age < m.life; });
      fx.splashes = fx.splashes.filter((p) => { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += GRAV * 0.5 * dt; if (p.x0 != null) p.x = clamp(p.x, p.x0, p.x1); return p.age < p.life && !(p.floor != null && p.vy > 0 && p.y > p.floor); });
      // Tropfen und Rinnsal aus Trichter und Scheidetrichter. Die sichtbare Tropfenzahl je s
      // entscheidet über die Darstellung: einzelne Tropfen → Tropfenkette → zusammenhängendes Rinnsal
      // (wie in der Destillation). Reine Darstellung, das Modell bleibt unberührt.
      for (const dr of dripSources(st)) {
        const w = V(dr.id);
        const q = st.drip[dr.key] || 0;
        w.qs = (w.qs || 0) + (q - (w.qs || 0)) * (1 - Math.exp(-dt / 0.25));
        if (q < 0.004) w.qs = Math.min(w.qs, q * 4);
        const rv = q * (k || 1) / DROP_V;
        w.streamK = clamp(((w.qs * (k || 1) / DROP_V) - STREAM_ON[0]) / (STREAM_ON[1] - STREAM_ON[0]), 0, 1);
        if (q < 0.004) { w.dripAcc = 0; w.streamK = 0; continue; }
        if (w.streamK >= 1) { w.dripAcc = 0; continue; }
        w.dripAcc += rv * dt;
        let n = 0;
        while (w.dripAcc >= 1 && n++ < 4) {
          w.dripAcc -= 1;
          fx.drops.push({ x: dr.tip.x, y: dr.tip.y + dripR() * 0.6, t: 0, y0: dr.tip.y + dripR() * 0.6, recv: dr.recv ? dr.recv.id : null, oil: dr.oil });
        }
        if (w.dripAcc > 1) w.dripAcc = 1;
      }
      // Rinnsal: Auftreffimpulse und Ringwellen wie beim Gießen, ohne Gefäß eine Pfütze
      for (const dr of dripSources(st)) {
        const w = V(dr.id);
        if (!(w.streamK > 0.3) || !(st.drip[dr.key] > 0.004)) continue;
        const target = dr.recv && Mo.objAt(st, dr.recv.at) === dr.recv ? catchAt(st, dr.recv) : null;
        if (target) {
          const u = clamp((dr.tip.x - target.x0) / Math.max(1, target.x1 - target.x0), 0, 1);
          if (Math.random() < dt * 24) impulse(dr.recv.id, u, 6 + 6 * w.streamK);
          if (Math.random() < dt * 9) { V(dr.recv.id).rings.push({ x: dr.tip.x, dx: dr.tip.x - target.cx, age: 0, life: 0.7 }); if (V(dr.recv.id).rings.length > 8) V(dr.recv.id).rings.shift(); }
        } else if (Math.random() < dt * 6) addPuddle(dr.tip.x, dr.oil);
      }
      fx.drops = fx.drops.filter((d) => {
        d.t += dt;
        d.y = d.y0 + 0.5 * GRAV * d.t * d.t;
        const ro = d.recv ? st.objs[d.recv] : null;
        const target = ro && Mo.objAt(st, ro.at) === ro ? catchAt(st, ro) : null;
        const yHit = target ? target.y : G.BASE_Y + 4;
        if (d.y >= yHit) {
          if (target) {
            const u = clamp((d.x - target.x0) / Math.max(1, target.x1 - target.x0), 0, 1);
            impulse(d.recv, u, 16);
            V(d.recv).rings.push({ x: d.x, dx: d.x - target.cx, age: 0, life: 0.8 });
            if (V(d.recv).rings.length > 8) V(d.recv).rings.shift();
          } else {
            addPuddle(d.x, d.oil);
            for (let i = 0; i < 2; i++) fx.splashes.push({ x: d.x, y: G.BASE_Y + 2, vx: (Math.random() - 0.5) * 80, vy: -90 - Math.random() * 60, age: 0, life: 0.3, oil: d.oil, floor: G.BASE_Y + 4 });
          }
          return false;
        }
        return true;
      });
      // Strahl beim Gießen: Auftreffimpulse
      const op = st.op;
      if (op && op.type === 'pour' && op.phase === 'flow' && op.rate > 0.05) {
        const s = catchAt(st, st.objs[op.dst]);
        if (s && streamHit) {
          const u = clamp((streamHit.x - s.x0) / Math.max(1, s.x1 - s.x0), 0, 1);
          if (Math.random() < dt * 30) impulse(op.dst, u, (st.pourSpeed === 'fast' ? 14 : 7) * (0.6 + Math.random() * 0.8));
          if (Math.random() < dt * (st.pourSpeed === 'fast' ? 16 : 5)) {
            V(op.dst).rings.push({ x: streamHit.x, dx: streamHit.x - s.cx, age: 0, life: 0.7 });
            if (V(op.dst).rings.length > 8) V(op.dst).rings.shift();
          }
          // Spritzer bleiben im Gefäß: Sie steigen kurz auf und fallen auf den Spiegel zurück
          if (st.pourSpeed === 'fast' && !op.dry && Math.random() < dt * 20) fx.splashes.push({ x: streamHit.x, y: streamHit.y - 1, vx: (Math.random() - 0.5) * 60, vy: -70 - Math.random() * 50, age: 0, life: 0.3, floor: streamHit.y, x0: s.x0, x1: s.x1 });
        }
      }
      if (op && op.type === 'wash' && washActive(op)) {
        if (Math.random() < dt * 20) impulse(op.v, 0.4 + Math.random() * 0.2, 9);
      }
      if (op && op.type === 'magdrop' && op.t > 1.0 && op.t < 1.5) {
        if (Math.random() < dt * 10) impulse(op.v, 0.5, 6);
      }
    }
    function addPuddle(x, oil) {
      const p = fx.puddles.find((q) => Math.abs(q.x - x) < 30 && q.oil === oil);
      if (p) p.r = Math.min(70, p.r + 0.6); else fx.puddles.push({ x, r: 6, oil });
    }

    // ------------------------------------------------------------------ Strahl
    let streamHit = null;
    function drawStream(st, srcPose) {
      const op = st.op;
      streamHit = null;
      if (!op || op.type !== 'pour' || op.phase !== 'flow' || op.rate < 0.02) return;
      const src = st.objs[op.src], dst = st.objs[op.dst];
      const lip = { x: srcPose.x, y: srcPose.y };
      const s = catchAt(st, dst);
      const yHit = s.y;
      const dry = op.dry;
      const fall = Math.max(4, yHit - lip.y);
      const tHit = Math.sqrt(2 * fall / GRAV);
      // waagrechte Geschwindigkeit so, dass der Strahl innerhalb der Öffnung auf den Spiegel trifft
      const want = lip.x + (dry ? 18 : 26 + op.rate * 3) * tHit;
      const xHit = clamp(want, s.x0, s.x1);
      const vx = (xHit - lip.x) / tHit;
      streamHit = { x: xHit, y: yHit };
      if (dry) {
        // Körnerrieseln
        const rnd = rng(Math.floor(time * 30));
        const n = Math.round(12 + op.rate * 5);
        for (let i = 0; i < n; i++) {
          const tt = rnd() * tHit;
          const x = lip.x + vx * tt + (rnd() - 0.5) * 6, y = lip.y + 0.5 * GRAV * tt * tt;
          const q = rnd() * Math.max(Mo.solids(src.c), 0.01);
          ctx.fillStyle = q < src.c.iron ? '#3a3e45' : q < src.c.iron + src.c.saltS ? '#ffffff' : '#c9a56b';
          ctx.fillRect(x, y, 2, 2);
        }
        return;
      }
      const width = clamp(1.4 + Math.sqrt(op.rate) * 1.1, 1.6, 6);
      const oilFrac = src.c.oil * (1 - src.emul) > 0.3 ? 1 : src.c.oil > 0.05 ? 0.4 : 0;
      const turb = (src.susp.sandF.m + src.susp.sandC.m) / Math.max(Mo.liq(src.c), 1);
      const col = oilFrac > 0.5 ? rgba(COL.oil, 0.8) : turb > 0.004 ? `rgba(175,155,120,${clamp(0.45 + turb * 20, 0.45, 0.85).toFixed(3)})` : 'rgba(150,196,232,0.6)';
      ctx.save();
      ctx.strokeStyle = col; ctx.lineCap = 'round';
      ctx.beginPath();
      const N = 16;
      for (let i = 0; i <= N; i++) {
        const tt = tHit * i / N;
        const x = lip.x + vx * tt, y = lip.y + 0.5 * GRAV * tt * tt;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.lineWidth = width; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(0.8, width * 0.3); ctx.stroke();
      ctx.restore();
    }
    const washActive = (op) => op.t > Mo.WASH_WIN[0] && op.t < op.dur - Mo.WASH_WIN[1];
    function drawWashJet(st, op) {
      const pose = washPose(st, op);
      if (!pose || !washActive(op)) return;
      const n = washNozzle(pose);
      const s = catchAt(st, st.objs[op.v]);
      const hit = { x: clamp(s.cx + 4, s.x0, s.x1), y: s.y };
      const cx = n.x + (hit.x - n.x) * 0.55, cy = Math.min(n.y, hit.y) - 14;
      // Anfang und Ende: Strahl wächst bzw. reißt ab
      const head = clamp((op.t - Mo.WASH_WIN[0]) / 0.12, 0, 1), tail = clamp((op.dur - Mo.WASH_WIN[1] - op.t) / 0.12, 0, 1);
      const seg = (u) => ({ x: (1 - u) * (1 - u) * n.x + 2 * (1 - u) * u * cx + u * u * hit.x, y: (1 - u) * (1 - u) * n.y + 2 * (1 - u) * u * cy + u * u * hit.y });
      ctx.save(); ctx.lineCap = 'round';
      for (const [col, wdt] of [['rgba(70,140,215,0.85)', 3], ['rgba(225,240,255,0.9)', 1.1]]) {
        ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.beginPath();
        for (let i = 0; i <= 16; i++) { const u = (1 - tail) + (head - (1 - tail)) * i / 16; const q = seg(clamp(u, 0, 1)); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
        ctx.stroke();
      }
      ctx.restore();
      washHit = hit;
    }
    let washHit = null;
    function washPose(st, op) {
      const bottle = st.objs.wash;
      if (!bottle) return null;
      const home = homePose(st, bottle);
      const tgt = st.objs[op.v];
      const tp = homePose(st, tgt);
      const open = G.openingOf(tgt.type, tp);
      const p = clamp(op.t / op.dur, 0, 1);
      const e = easeInOut(Math.min(1, p * 3.5)), back = easeInOut(clamp((p - 0.82) * 5.5, 0, 1));
      const k = e * (1 - back);
      // Düse (lokal 38/−134) über der Öffnung; am linken Rand von rechts (gespiegelt) heranführen,
      // unter der Wandablage unterhalb des Bretts, sonst hoch genug über den Nachbargeräten
      const ex = getEngine().exp;
      const shelf = ex.slots.filter((q) => q.kind === 'shelf').map((q) => q.x);
      const under = shelf.length && open.x > Math.min(...shelf) - 80 && open.x < Math.max(...shelf) + 80 && open.top > G.SHELF_Y;
      const flip = open.x - 150 < 0;
      const dx = Math.min(open.r * 0.55, 26) + 8;
      const noz = { x: open.x + (flip ? dx : -dx), y: under ? Math.min(open.top - 40, Math.max(G.SHELF_Y + 42, open.top - 110)) : Math.max(open.top - 190, (ex.viewTop || 0) + 24) };
      const from = { x: home.x + 38, y: home.y - 134 };
      return { x: lerp(from.x, noz.x, k), y: lerp(from.y, noz.y, k), ax: 38, ay: -134, th: k * (flip ? -0.5 : 0.5), flip: flip && k > 0.02 };
    }
    function magnetPose(st) {
      const m = st.objs.mag;
      const home = homePose(st, m);
      const op = st.op;
      if (!op || (op.type !== 'magnet' && op.type !== 'magdrop')) return { pose: home, vertical: false };
      const tgt = st.objs[op.v];
      const tp = homePose(st, tgt);
      const open = tgt.type === 'funnel' ? { x: tp.x, top: tp.y - 66 } : G.openingOf(tgt.type, tp);
      const surfY = catchAt(st, tgt).y;
      const p = op.t;
      let k, dip;
      if (op.type === 'magnet') { k = easeInOut(clamp(p / 0.7, 0, 1)) * (1 - easeInOut(clamp((p - 1.9) / 0.7, 0, 1))); dip = clamp((p - 0.6) / 0.3, 0, 1) * (1 - clamp((p - 1.8) / 0.3, 0, 1)); }
      else { k = easeInOut(clamp(p / 0.7, 0, 1)) * (1 - easeInOut(clamp((p - 1.2) / 0.6, 0, 1))); dip = 0; }
      const hoverY = open.top - 70;
      const tipY = lerp(hoverY, surfY + (tgt.type === 'funnel' ? 6 : 4), dip);
      // senkrecht: Nordpol unten, Spitze bei tipY
      const goal = { x: open.x + 6, y: tipY - 54, th: -Math.PI / 2 };
      return { pose: { x: lerp(home.x, goal.x, k), y: lerp(home.y, goal.y, k), th: lerp(0, goal.th, k), ax: 0, ay: -10 }, vertical: k > 0.5, tip: { x: goal.x, y: tipY }, k };
    }

    // ------------------------------------------------------------------ Auftreffpunkt in Zielgefäßen
    /**
     * Spiegel (bzw. Innenboden) und nutzbare Breite eines Zielgefäßes in Weltkoordinaten,
     * berechnet aus dem Modellzustand und der Gefäßgeometrie – Strahlen und Tropfen enden dort.
     */
    function catchAt(st, o) {
      const pose = homePose(st, o);
      const c = o.c || Mo.zero();
      const fillV = G.fillVolume(c);
      switch (o.type) {
        case 'beaker': case 'erlenmeyer': {
          const h = G.heightOf(o.type, fillV), r = Math.min(G.rAt(o.type, Math.max(h, 3)), G.rAt(o.type, G.topH(o.type)));
          return { y: pose.y + G.BASE_OFFSET[o.type] - h, x0: pose.x - r + 5, x1: pose.x + r - 5, cx: pose.x };
        }
        case 'funnel': {
          const h = Math.max(4, G.heightOf('funnel', fillV)), r = G.rAt('funnel', h);
          return { y: pose.y - h, x0: pose.x - r + 3, x1: pose.x + r - 3, cx: pose.x };
        }
        case 'sep': {
          const h = Math.max(3, G.heightOf('sep', Mo.liq(c)));
          return { y: pose.y - h, x0: pose.x - 8, x1: pose.x + 8, cx: pose.x };
        }
        case 'dish': case 'bowl': case 'watch': {
          const D = G.topH(o.type), rimY = pose.y - D - (o.type === 'watch' ? 2 : 6);
          const h = Math.max(1, G.heightOf(o.type, fillV)), r = G.rAt(o.type, h);
          return { y: rimY + (D - h) * Math.cos(Math.asin(PERSP)) * 0.9, x0: pose.x - r * 0.7, x1: pose.x + r * 0.7, cx: pose.x };
        }
        default: return { y: pose.y, x0: pose.x - 10, x1: pose.x + 10, cx: pose.x };
      }
    }

    // ------------------------------------------------------------------ Wandablage, Stopfen, Hände, Entnahmen
    function drawShelf(ex) {
      const xs = ex.slots.filter((s) => s.kind === 'shelf').map((s) => s.x);
      if (!xs.length) return;
      const x0 = Math.min(...xs) - 75, x1 = Math.max(...xs) + 75, y = G.SHELF_Y;
      ctx.fillStyle = 'rgba(40,55,70,0.12)'; ctx.fillRect(x0 + 4, y + 10, x1 - x0, 6);
      const g = ctx.createLinearGradient(0, y, 0, y + 12);
      g.addColorStop(0, '#f4f1ea'); g.addColorStop(1, '#cfc8b8');
      ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, 12);
      ctx.strokeStyle = 'rgba(110,100,80,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x0, y, x1 - x0, 12);
      ctx.fillStyle = '#9aa3ad';
      for (const bx of [x0 + 20, x1 - 28]) { ctx.beginPath(); ctx.moveTo(bx, y + 12); ctx.lineTo(bx + 8, y + 12); ctx.lineTo(bx + 8, y + 40); ctx.closePath(); ctx.fill(); }
    }
    /** Stopfen (Kunststoff), Oberkante bei y. */
    function drawStopper(x, y) {
      ctx.fillStyle = '#d4dbe3'; roundRect(ctx, x - 11, y + 4, 22, 20, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(90,105,120,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#b8c2cd'; roundRect(ctx, x - 15, y, 30, 7, 3); ctx.fill(); ctx.stroke();
    }
    function drawStopperFlying(st, op) {
      const s = st.objs[op.v], so = st.objs.stop;
      const shelf = so ? Mo.slotOf(st, so.home) : null;
      const sp = homePose(st, s);
      const a = { x: shelf ? shelf.x : sp.x - 120, y: G.SHELF_Y - 24 }, b = { x: sp.x, y: sp.y - 236 };
      const p = easeInOut(clamp(op.t / op.dur, 0, 1));
      const [from, to] = op.on ? [a, b] : [b, a];
      drawStopper(lerp(from.x, to.x, p), lerp(from.y, to.y, p) - Math.sin(Math.PI * p) * 45);
    }
    /** Hände halten den Scheidetrichter außerhalb des Rings (am Stopfen und am Hahn). */
    function drawHands(pose) {
      if (!pose) return;
      ctx.save(); applyPose(pose);
      ctx.fillStyle = 'rgba(214,226,240,0.95)'; ctx.strokeStyle = 'rgba(100,120,140,0.8)'; ctx.lineWidth = 1.2;
      roundRect(ctx, -24, -236, 48, 18, 9); ctx.fill(); ctx.stroke();
      roundRect(ctx, -18, 2, 44, 20, 9); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    function drawPaperOut(st, op) {
      const f = st.objs[op.v], d = st.objs[op.dst];
      const a = homePose(st, f), b = homePose(st, d);
      const p = easeInOut(clamp(op.t / op.dur, 0, 1));
      const x = lerp(a.x, b.x, p), y = lerp(a.y - 30, b.y - 30, p) - Math.sin(Math.PI * p) * 60;
      const flat = clamp((p - 0.75) * 4, 0, 1);
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(140,150,160,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-34, -36 * (1 - flat)); ctx.lineTo(0, 30 * (1 - flat) + 4 * flat); ctx.lineTo(34, -36 * (1 - flat)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = Mo.sand(f.c) + f.c.iron > 0.05 ? '#b49a70' : 'rgba(150,190,225,0.5)';
      ctx.beginPath(); ctx.moveTo(-14, 6 * (1 - flat)); ctx.quadraticCurveTo(0, -4, 14, 6 * (1 - flat)); ctx.lineTo(0, 28 * (1 - flat) + 6 * flat); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function drawScrape(st, op) {
      const s = st.objs[op.v], d = st.objs[op.dst];
      const a = homePose(st, s), b = homePose(st, d);
      const ca = catchAt(st, s), cb = catchAt(st, d);
      const strokes = 3, u = clamp(op.t / op.dur, 0, 1) * strokes, k = Math.floor(Math.min(u, strokes - 0.001)), f = u - k;
      const go = f < 0.5 ? easeInOut(f * 2) : 1 - easeInOut((f - 0.5) * 2);
      const x = lerp(ca.cx, cb.cx, go), y = lerp(ca.y - 6, cb.y - 10, go) - Math.sin(Math.PI * go) * 40;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
      ctx.fillStyle = '#9aa4b0'; roundRect(ctx, -4, -70, 5, 62, 2); ctx.fill();
      ctx.fillStyle = '#c3cbd4'; roundRect(ctx, -9, -10, 15, 12, 3); ctx.fill();
      if (f < 0.5) {
        const c = Mo.solids(s.c) > 0.01 || !op.moved ? s.c : op.moved, tot = Math.max(1e-6, Mo.solids(c));
        const cols = [[c.iron / tot, '#3a3e45'], [Mo.sand(c) / tot, '#c9a56b'], [c.saltS / tot, '#ffffff']];
        const pick = (q) => { let acc = 0; for (const [w, col] of cols) { acc += w; if (q <= acc) return col; } return Mo.solids(c) > 0.01 ? '#ffffff' : 'rgba(150,196,232,0.9)'; };
        for (let i = 0; i < 6; i++) { ctx.fillStyle = Mo.solids(c) > 0.01 ? pick((i + 0.5) / 6) : 'rgba(150,196,232,0.9)'; ctx.fillRect(-7 + i * 2.2, -13 - (i % 2) * 2, 2.4, 2.4); }
      }
      ctx.restore();
      void a; void b;
    }

    // ------------------------------------------------------------------ Hauptzeichnung
    let last = null;
    function frame(wallDt, running, rate) {
      const e = getEngine();
      const st = e.state;
      if (curExp !== e) { curExp = e; vis = {}; fx = { drops: [], splashes: [], mist: [], flyers: [], puddles: [], bubbles: [], jets: [] }; fit(); }
      const dt = running ? Math.min(0.05, wallDt) : 0;
      if (dt > 0) updateEffects(st, dt, rate);
      const W = e.exp.width;
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#d6dce3'; ctx.fillRect(0, 0, view.w, view.h);
      base();
      drawBackground(W);
      const ex = e.exp;
      // Pfützen auf dem Tisch (verschüttete Anteile)
      for (const p of fx.puddles) { ctx.fillStyle = p.oil ? 'rgba(226,182,44,0.45)' : 'rgba(150,190,225,0.45)'; ctx.beginPath(); ctx.ellipse(p.x, G.BASE_Y + 6, p.r, p.r * 0.16, 0, 0, TAU); ctx.fill(); }
      // Feste Einrichtungen (hinten)
      const ring = ex.slots.find((s) => s.kind === 'ring');
      const sring = ex.slots.find((s) => s.kind === 'sepring');
      const plate = ex.slots.find((s) => s.kind === 'plate');
      if (ring) drawStand(ring.x, ring.x + G.RING.standDx, G.RING.standTop, G.RING.ringY, 38, 'back');
      if (sring) drawStand(sring.x, sring.x + G.SEPR.standDx, G.SEPR.standTop, G.SEPR.ringY, 34, 'back');
      drawShelf(ex);
      for (const s of ex.slots) if (s.holder && s.kind === 'bench') { const ob = Mo.objAt(st, s.id) || st.order.map((i) => st.objs[i]).find((o) => o.home === s.id); if (ob && ob.type === 'funnel') drawFunnelHolder(s.x); if (ob && ob.type === 'sep') drawSepCradle(s.x); }
      if (plate) drawPlate(st, plate.x);

      const sel = getView().selected;
      const poses = {};
      const op = st.op;
      for (const id of st.order) poses[id] = (st.objs[id].c || ['funnel', 'sep', 'stopper'].includes(st.objs[id].type)) ? poseOf(st, st.objs[id], dt) : homePose(st, st.objs[id]);
      // Zeichenreihenfolge: hinten → Sonderplätze → vorne → bewegte
      const order = st.order.slice().sort((a, b) => rank(st, a, poses) - rank(st, b, poses));
      for (const id of order) drawObject(st, st.objs[id], poses[id], sel === id);
      if (ring) drawStand(ring.x, ring.x + G.RING.standDx, G.RING.standTop, G.RING.ringY, 38, 'front');
      if (sring) drawStand(sring.x, sring.x + G.SEPR.standDx, G.SEPR.standTop, G.SEPR.ringY, 34, 'front');
      // Handgriffe
      if (op && op.type === 'pour') { const sp = poses[op.src]; drawStream(st, sp); }
      else streamHit = null;
      if (op && op.type === 'stir') drawRodInVessel(st, st.objs[op.v], op);
      if (op && op.type === 'wash') { drawWashJet(st, op); }
      if (op && op.type === 'paper') drawPaperFlying(st, op);
      if (op && op.type === 'paperOut') drawPaperOut(st, op);
      if (op && op.type === 'scrape') drawScrape(st, op);
      if (op && op.type === 'stopper') drawStopperFlying(st, op);
      if (st.objs.S && st.objs.S.at === 'hand') drawHands(poses.S);
      // Magnet
      if (st.objs.mag) {
        const mp = magnetPose(st);
        if (op && op.type === 'magnet' && mp.tip) {
          // Eisenkörner springen zum Magneten
          const p = clamp((op.t - 0.75) / 1.1, 0, 1);
          if (p > 0 && p < 1 && op.taken) {
            const rnd = rng(5);
            const s = catchAt(st, st.objs[op.v]);
            const n = Math.round(Math.min(60, op.taken * 10));
            for (let i = 0; i < n; i++) {
              const sx = lerp(s.x0, s.x1, 0.2 + rnd() * 0.6), sy = s.y + rnd() * 4;
              const q = clamp(p * 1.4 - rnd() * 0.4, 0, 1);
              ctx.fillStyle = '#353940';
              ctx.fillRect(lerp(sx, mp.tip.x + (rnd() - 0.5) * 10, q), lerp(sy, mp.tip.y + 2, q), 2, 2);
            }
          }
        }
        if (op && op.type === 'magdrop' && op.t > 0.9 && op.t < 1.6) {
          const s = catchAt(st, st.objs[op.v]);
          const rnd = rng(9);
          const q = clamp((op.t - 0.9) / 0.6, 0, 1);
          ctx.fillStyle = '#353940';
          for (let i = 0; i < 40; i++) { const x = mp.tip.x + (rnd() - 0.5) * 18, y0 = mp.tip.y; const yy = lerp(y0, s.y, clamp(q * 1.3 - rnd() * 0.3, 0, 1)); ctx.fillRect(x, yy, 2, 2); }
        }
        // Eisen am Magneten: während des Anziehens wächst der Bart mit den ankommenden Körnern
        const holding = st.objs.mag.c.iron;
        const ironShown = op && op.type === 'magnet' && op.done ? Math.max(0, holding - op.taken * (1 - clamp((op.t - 0.75) / 1.1, 0, 1))) : holding;
        drawMagnet(mp.pose, ironShown, mp.vertical);
        if (sel === 'mag') highlight(mp.pose, G.EXTENT.magnet);
      }
      // Spritzer, Tropfen, Dunst
      drawDripStreams(st);
      for (const d of fx.drops) drawDrop(d.x, d.y, d.oil, null, 1.05 + Math.min(0.5, GRAV * d.t / 2600));
      for (const p of fx.splashes) { ctx.fillStyle = p.oil ? 'rgba(226,182,44,0.8)' : 'rgba(200,225,245,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, TAU); ctx.fill(); }
      for (const m of fx.mist) {
        const t = m.age / m.life, a = m.a * Math.sin(Math.PI * t);
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`); g.addColorStop(0.65, `rgba(246,249,252,${(a * 0.55).toFixed(3)})`); g.addColorStop(1, 'rgba(240,244,248,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      }
      last = { poses };
    }
    /**
     * Tropfenradius in Weltpixeln: real ≈ 2,3 mm (≈ 2,9 px), leicht überzeichnet und so, dass ein
     * Tropfen auch bei kleinem Maßstab (kleine Bildschirme, Teilchenmodell daneben) mindestens
     * etwa 3 Bildschirmpixel Radius hat.
     */
    const dripR = () => clamp(4.2 / Math.max(view.scale, 0.2), 4.6, 6.4);
    /** Quellen, aus denen gerade etwas tropfen kann: Trichter (im Ring) und Scheidetrichter. */
    function dripSources(st) {
      const out = [];
      for (const [key, id, tipFn, slot] of [['F', 'F', G.funnelTip, 'under'], ['S', 'S', G.sepTip, 'sepunder']]) {
        const src = st.objs[id];
        if (!src) continue;
        const tip = tipFn(homePose(st, src));
        const recv = key === 'S' && src.at !== 'sepring' ? null : Mo.objAt(st, slot);
        out.push({ key, id, tip, recv, oil: key === 'S' && src.c.water < 0.02 });
      }
      return out;
    }
    /** Auftreffpunkt unter einer Tropfquelle (Spiegel bzw. Innenboden des Auffanggefäßes oder Tisch). */
    function dripTarget(st, dr) {
      const t = dr.recv && Mo.objAt(st, dr.recv.at) === dr.recv ? catchAt(st, dr.recv) : null;
      return t ? { x: dr.tip.x, y: t.y, into: dr.recv.id, x0: t.x0, x1: t.x1 } : { x: dr.tip.x, y: G.BASE_Y + 4, into: null };
    }
    let dripHit = {};
    /** Rinnsal: zusammenhängender, nach unten schmaler werdender Strahl mit wandernden Verdickungen. */
    function drawDripStreams(st) {
      dripHit = {};
      for (const dr of dripSources(st)) {
        const w = vis[dr.id];
        const q = st.drip[dr.key] || 0;
        const hang = w && q >= 0.004 && w.streamK < 1 ? w.dripAcc || 0 : 0;
        const r = dripR();
        // hängender Tropfen an der Spitze wächst und reißt ab
        if (hang > 0.05) {
          const rr = r * (0.45 + 0.55 * Math.cbrt(hang));
          drawDrop(dr.tip.x, dr.tip.y + rr * 0.55, dr.oil, rr, 0.85);
        }
        if (!w || !(w.streamK > 0) || q < 0.004) continue;
        const tg = dripTarget(st, dr);
        dripHit[dr.id] = tg;
        const a = w.streamK;
        const top = dr.tip.y, len = Math.max(4, tg.y - top);
        const wTop = Math.max(clamp(1.8 + Math.sqrt(w.qs) * 1.4, 2.4, 5.2), 3 / Math.max(view.scale, 0.2));
        const wBot = wTop * 0.62;
        const col = dr.oil ? [205, 160, 30] : [80, 140, 210];
        ctx.save();
        ctx.globalAlpha = a;
        const g = ctx.createLinearGradient(dr.tip.x - wTop, 0, dr.tip.x + wTop, 0);
        g.addColorStop(0, rgba(col, 0.85)); g.addColorStop(0.5, dr.oil ? 'rgba(250,222,120,0.95)' : 'rgba(190,222,252,0.95)'); g.addColorStop(1, rgba(col, 0.85));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(dr.tip.x - wTop / 2, top); ctx.lineTo(dr.tip.x + wTop / 2, top);
        ctx.lineTo(dr.tip.x + wBot / 2, top + len); ctx.lineTo(dr.tip.x - wBot / 2, top + len);
        ctx.closePath(); ctx.fill();
        // Verdickungen wandern nach unten und zeigen die Fließrichtung
        ctx.fillStyle = rgba(col, 0.9);
        const sp = 24, off = (time * 260) % sp;
        for (let y = top + off; y < top + len - 2; y += sp) {
          const u = (y - top) / len, ww = lerp(wTop, wBot, u) * 0.75;
          ctx.beginPath(); ctx.ellipse(dr.tip.x, y, ww, ww * 1.5, 0, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
    function drawDrop(x, y, oil, r, stretch) {
      r = r || dripR();
      const s = stretch || 1.15;
      ctx.fillStyle = oil ? 'rgba(226,182,44,0.92)' : 'rgba(140,190,235,0.92)';
      ctx.beginPath(); ctx.moveTo(x, y - r * 1.7 * s); ctx.quadraticCurveTo(x + r * 1.05, y - r * 0.35, x + r * 0.62, y + r * 0.45);
      ctx.arc(x, y + r * 0.2, r * 0.66, 0.35, Math.PI - 0.35); ctx.quadraticCurveTo(x - r * 1.05, y - r * 0.35, x, y - r * 1.7 * s); ctx.fill();
      ctx.strokeStyle = oil ? 'rgba(150,110,10,0.55)' : 'rgba(70,120,175,0.55)'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(x - r * 0.28, y - r * 0.15, r * 0.16, r * 0.3, -0.3, 0, TAU); ctx.fill();
    }
    function rank(st, id, poses) {
      const o = st.objs[id], p = poses[id];
      if (p.pouring || p.moving) return 50;
      if (st.op && st.op.type === 'wash' && o.type === 'wash') return 52;
      if (o.at === 'under' || o.at === 'sepunder') return 20;
      if (o.at === 'ring' || o.at === 'sepring') return 10;
      if (o.type === 'magnet') return 60;
      if (o.type === 'stopper') return 30;
      if (o.at === 'hand') return 45;
      const slot = Mo.slotOf(st, o.at);
      if (slot && slot.kind === 'front') return 40;
      if (slot && slot.kind === 'shelf') return 2;
      return 5;
    }
    function drawObject(st, o, pose, selected) {
      const op = st.op;
      switch (o.type) {
        case 'beaker': case 'erlenmeyer': drawGlassVessel(st, o, pose); break;
        case 'dish': case 'bowl': case 'watch': drawDish(st, o, pose); break;
        case 'funnel': drawFunnel(st, o, pose); break;
        case 'sep': drawSep(st, o, pose); break;
        case 'rod': if (!(op && op.type === 'stir')) drawRod(pose, false); break;
        case 'paper': drawPaperStack(pose); break;
        case 'wash': drawWashBottle(op && op.type === 'wash' ? washPose(st, op) : pose); break;
        case 'magnet': break; // separat (über allem)
        case 'stopper': if (!pose.onSep && !(op && op.type === 'stopper')) drawStopper(pose.x, pose.y - 24); break;
      }
      if (selected && o.type !== 'magnet') highlight(pose, o.type === 'stopper' && pose.onSep ? { x0: -18, x1: 18, y0: -24, y1: 2 } : G.EXTENT[o.type]);
    }
    function highlight(pose, ext) {
      if (!ext) return;
      ctx.save(); applyPose(pose);
      ctx.strokeStyle = 'rgba(31,111,209,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      roundRect(ctx, ext.x0 - 6, ext.y0 - 6, ext.x1 - ext.x0 + 12, ext.y1 - ext.y0 + 12, 10); ctx.stroke();
      ctx.restore();
    }

    // ------------------------------------------------------------------ Trefferflächen
    /** Weltrechtecke für Objekte (aktuelle Pose) und freie Sonderplätze. */
    function boxes() {
      const e = getEngine(), st = e.state;
      const out = [];
      const rect = (pose, ext) => {
        const pts = G.transform([[ext.x0, ext.y0], [ext.x1, ext.y0], [ext.x1, ext.y1], [ext.x0, ext.y1]], Object.assign({ ax: 0, ay: 0 }, pose));
        return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) };
      };
      for (const id of st.order) {
        const o = st.objs[id];
        let pose = homePose(st, o);
        let ext = G.EXTENT[o.type];
        if (o.type === 'stopper' && pose.onSep) ext = { x0: -22, x1: 22, y0: -26, y1: 2 };
        if (o.type === 'sep' && !pose.lying) ext = { x0: -46, x1: 46, y0: o.stopper ? -206 : -232, y1: -2 };
        const r = rect(pose, ext);
        if (o.at === 'ring' && Mo.objAt(st, 'under')) r.y1 = Math.min(r.y1, G.RING.funnelApex + 60);
        if (o.type === 'funnel' && o.at !== 'ring') r.y1 = Math.min(r.y1, G.BASE_Y - 4);
        if (o.at === 'sepring' && Mo.objAt(st, 'sepunder')) r.y1 = Math.min(r.y1, G.SEPR.origin + 66);
        out.push(Object.assign({ id, kind: 'obj' }, r));
        // Hahn als eigene Trefferfläche am gezeichneten Scheidetrichter
        if (o.type === 'sep' && !pose.lying) out.push({ id: 'cock', kind: 'part', x0: pose.x - 4, x1: pose.x + 36, y0: pose.y + 1, y1: pose.y + 24 });
      }
      // Drehknopf der Heizplatte als eigene Trefferfläche (zuletzt, damit er über dem Gefäß liegt)
      const plateSlot = st.plate && e.exp.slots.find((q) => q.kind === 'plate');
      const knob = plateSlot ? { id: 'knob', kind: 'part', x0: plateSlot.x - G.PLATE.w / 2 + 9, x1: plateSlot.x - G.PLATE.w / 2 + 41, y0: G.PLATE_TOP + 8, y1: G.PLATE_TOP + 36 } : null;
      const slots = [];
      for (const s of e.exp.slots) {
        if (Mo.objAt(st, s.id)) continue;
        if (s.kind === 'hand' && !(st.objs.S && st.objs.S.at === 'sepring')) continue;
        let r;
        if (s.kind === 'ring') r = { x0: s.x - 48, x1: s.x + 48, y0: G.RING.ringY - 70, y1: G.RING.ringY + 40 };
        else if (s.kind === 'under') r = { x0: s.x - 50, x1: s.x + 50, y0: G.BASE_Y - 150, y1: G.BASE_Y };
        else if (s.kind === 'sepring') r = { x0: s.x - 48, x1: s.x + 48, y0: G.SEPR.ringY - 140, y1: G.SEPR.ringY + 40 };
        else if (s.kind === 'sepunder') r = { x0: s.x - 50, x1: s.x + 50, y0: G.BASE_Y - 110, y1: G.BASE_Y };
        else if (s.kind === 'plate') r = { x0: s.x - 70, x1: s.x + 70, y0: G.PLATE_TOP - 40, y1: G.BASE_Y };
        else if (s.kind === 'front') r = { x0: s.x - 50, x1: s.x + 50, y0: G.FRONT_Y - 20, y1: G.FRONT_Y + 6 };
        else if (s.kind === 'shelf') r = { x0: s.x - 40, x1: s.x + 40, y0: G.SHELF_Y - 40, y1: G.SHELF_Y };
        else if (s.kind === 'hand') r = { x0: s.x - 46, x1: s.x + 46, y0: G.HAND.origin - 210, y1: G.HAND.origin };
        else r = { x0: s.x - 48, x1: s.x + 48, y0: G.BASE_Y - 124, y1: G.BASE_Y };
        slots.push(Object.assign({ id: s.id, kind: 'slot' }, r));
      }
      // freie Plätze zuerst (liegen in der Stapelfolge unter den Geräten), Drehknopf zuletzt
      return slots.concat(out, knob ? [knob] : []);
    }
    /** Weltrechteck → Bildschirmrechteck (CSS-Pixel relativ zum Canvas). */
    const toScreen = (r) => ({ x: view.ox + r.x0 * view.scale, y: view.oy + r.y0 * view.scale, w: (r.x1 - r.x0) * view.scale, h: (r.y1 - r.y0) * view.scale });
    const worldX = (x) => view.ox + x * view.scale;

    return { frame, resize, fit, boxes, toScreen, worldX, worldY: (y) => view.oy + y * view.scale, catchAt: (id) => catchAt(getEngine().state, getEngine().state.objs[id]), get streamHit() { return streamHit; }, get washHit() { return washHit; }, get dripHit() { return dripHit; }, view, get time() { return time; }, get vis() { return vis; }, get last() { return last; } };
  }

  (root.TV = root.TV || {}).render = { createRenderer, COL };
})(typeof self !== 'undefined' ? self : this);
