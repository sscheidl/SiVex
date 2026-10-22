/*
 * Redoxlabor – Chemie-Engine
 *
 * Reine Simulationslogik ohne DOM-Zugriff. Sie beschreibt
 *   1. die Stoffdaten (Proben und Reagenzien),
 *   2. den Inhalt eines Reagenzglases (in abstrakten Pipettenportionen),
 *   3. die daraus folgenden Teilchen/Phasen (analyze),
 *   4. die temperaturabhängige Reaktionskinetik (step),
 *   5. das optische Erscheinungsbild als physikalisches Modell (appearance),
 *   6. die fachliche Bewertung eines Versuchs (classify).
 *
 * Mengen werden bewusst nur als "Portionen" modelliert – die Simulation
 * vermittelt keine realen Konzentrations- oder Dosierungsangaben.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.RL = root.RL || {}).chem = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Stoffdaten
  // ---------------------------------------------------------------------------

  /**
   * chain/carbonyl beschreiben die Halbstrukturformel: Gruppen von links nach
   * rechts, an Position `carbonyl` steht das C-Atom der C=O-Gruppe.
   */
  const SAMPLES = [
    {
      id: 'ethanal', name: 'Ethanal', trivial: 'Acetaldehyd', cls: 'aldehyd',
      formula: 'C₂H₄O', condensed: 'CH₃–CHO', chain: ['CH3', 'C', 'H'], carbonyl: 1,
      reducing: true, rate: 1.0, R: 'CH₃', acid: 'Ethansäure', acidCondensed: 'CH₃–COOH'
    },
    {
      id: 'propanal', name: 'Propanal', trivial: 'Propionaldehyd', cls: 'aldehyd',
      formula: 'C₃H₆O', condensed: 'CH₃–CH₂–CHO', chain: ['CH3', 'CH2', 'C', 'H'], carbonyl: 2,
      reducing: true, rate: 0.93, R: 'CH₃–CH₂', acid: 'Propansäure', acidCondensed: 'CH₃–CH₂–COOH'
    },
    {
      id: 'butanal', name: 'Butanal', trivial: 'Butyraldehyd', cls: 'aldehyd',
      formula: 'C₄H₈O', condensed: 'CH₃–CH₂–CH₂–CHO', chain: ['CH3', 'CH2', 'CH2', 'C', 'H'], carbonyl: 3,
      reducing: true, rate: 0.86, R: 'CH₃–CH₂–CH₂', acid: 'Butansäure', acidCondensed: 'CH₃–CH₂–CH₂–COOH'
    },
    {
      id: 'propanon', name: 'Propanon', trivial: 'Aceton', cls: 'keton',
      formula: 'C₃H₆O', condensed: 'CH₃–CO–CH₃', chain: ['CH3', 'C', 'CH3'], carbonyl: 1,
      reducing: false, rate: 0
    },
    {
      id: 'butanon', name: 'Butanon', trivial: 'Ethylmethylketon', cls: 'keton',
      formula: 'C₄H₈O', condensed: 'CH₃–CO–CH₂–CH₃', chain: ['CH3', 'C', 'CH2', 'CH3'], carbonyl: 1,
      reducing: false, rate: 0
    },
    {
      id: 'pentan-2-on', name: 'Pentan-2-on', trivial: 'Methylpropylketon', cls: 'keton',
      formula: 'C₅H₁₀O', condensed: 'CH₃–CO–CH₂–CH₂–CH₃', chain: ['CH3', 'C', 'CH2', 'CH2', 'CH3'], carbonyl: 1,
      reducing: false, rate: 0
    }
  ];
  const SAMPLE_BY_ID = Object.fromEntries(SAMPLES.map((s) => [s.id, s]));

  const REAGENTS = [
    { id: 'fehling1', name: 'Fehling I', short: 'Fehling I', desc: 'Kupfer(II)-sulfat-Lösung', test: 'fehling', color: [95, 172, 236, 0.5] },
    { id: 'fehling2', name: 'Fehling II', short: 'Fehling II', desc: 'alkalische Kaliumnatriumtartrat-Lösung', test: 'fehling', color: [236, 244, 250, 0.1] },
    { id: 'agno3', name: 'Silbernitratlösung', short: 'AgNO₃', desc: 'Silbernitrat-Lösung, AgNO₃(aq)', test: 'tollens', color: [236, 244, 250, 0.1] },
    { id: 'naoh', name: 'Natronlauge', short: 'NaOH', desc: 'Natriumhydroxid-Lösung, NaOH(aq)', test: 'tollens', color: [236, 244, 250, 0.1] },
    { id: 'nh3', name: 'Ammoniaklösung', short: 'NH₃', desc: 'Ammoniak-Lösung, NH₃(aq) – wird tropfenweise zugegeben', test: 'tollens', color: [236, 244, 250, 0.1] }
  ];
  const REAGENT_BY_ID = Object.fromEntries(REAGENTS.map((r) => [r.id, r]));

  /** Fassungsvermögen eines Reagenzglases in Portionen (höchstens ca. halb voll). */
  const CAPACITY = 7;

  // Zeitkonstanten (Sekunden bei Temperaturfaktor 1). Real dauern die Versuche
  // einige Minuten; die Simulation rafft die Zeit für den Unterricht.
  const T = {
    ROOM: 20,
    FEHLING_REACTION: 12,
    TOLLENS_REACTION: 14,
    HEAT_FEHLING: 13,
    HEAT_TOLLENS: 14,
    CUO: 9,
    DARKEN: 10
  };

  // ---------------------------------------------------------------------------
  // Hilfsfunktionen
  // ---------------------------------------------------------------------------
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const smooth = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpColor = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  const stops = (list, x) => {
    if (x <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      if (x <= list[i][0]) {
        const t = (x - list[i - 1][0]) / (list[i][0] - list[i - 1][0]);
        return lerpColor(list[i - 1][1], list[i][1], t);
      }
    }
    return list[list.length - 1][1];
  };

  /** Temperaturfaktor der Fehling-Reaktion: unter ca. 40 °C keine beobachtbare Reaktion. */
  function fehlingTempFactor(temp) {
    if (temp <= 40) return 0;
    return Math.pow(Math.min((temp - 40) / 30, 1.3), 1.3);
  }
  /** Temperaturfaktor der Tollens-Reaktion: im Modell erst oberhalb von ca. 35 °C. */
  function tollensTempFactor(temp) {
    if (temp <= 35) return 0;
    return Math.min((temp - 35) / 25, 1.4);
  }

  // ---------------------------------------------------------------------------
  // Reagenzglasinhalt
  // ---------------------------------------------------------------------------
  function createContents() {
    return {
      portions: { fehling1: 0, fehling2: 0, agno3: 0, naoh: 0, nh3: 0 },
      sampleId: null,
      sampleAmount: 0,
      history: [],
      mix: 1, // 1 = homogen durchmischt
      temp: T.ROOM,
      maxTemp: T.ROOM,
      heatF: 0, // Wärmedosis bezogen auf Fehling-Bedingungen (1 = ausreichend erwärmt)
      heatT: 0, // Wärmedosis bezogen auf Tollens-Bedingungen
      progress: 0, // Umsatz der Nachweisreaktion 0..1 (Cu₂O bzw. Ag)
      darkening: 0, // Bildung von dunklem Silberpulver aus nicht gelöstem Ag₂O
      cuo: 0, // Zerfall von Cu(OH)₂ zu schwarzem CuO
      hotTollens: 0, // Sekunden Tollens-Reaktion oberhalb ca. 75 °C
      bumped: false, // Siedeverzug aufgetreten
      lost: 0 // herausgespritzter Volumenanteil
    };
  }

  function volume(c) {
    const p = c.portions;
    return p.fehling1 + p.fehling2 + p.agno3 + p.naoh + p.nh3 + c.sampleAmount;
  }

  function isSample(id) { return !!SAMPLE_BY_ID[id]; }
  function isReagent(id) { return !!REAGENT_BY_ID[id]; }

  /** Prüft, ob eine Zugabe möglich ist. Fachlich falsche Zugaben sind erlaubt – nur Unmögliches wird abgelehnt. */
  function canAdd(c, id) {
    if (!isSample(id) && !isReagent(id)) return { ok: false, reason: 'Unbekannter Stoff.' };
    if (c.bumped) return { ok: false, reason: 'Nach dem Siedeverzug ist dieser Ansatz unbrauchbar. Tausche das Reagenzglas aus.' };
    if (volume(c) + 1 > CAPACITY) return { ok: false, reason: 'Das Reagenzglas ist zu voll. Zum Erwärmen darf es höchstens etwa zur Hälfte gefüllt sein.' };
    if (isSample(id) && c.sampleId && c.sampleId !== id) {
      return { ok: false, reason: 'In diesem Reagenzglas ist bereits eine andere Stoffprobe. Für eine eindeutige Auswertung pro Reagenzglas nur eine Probe verwenden.' };
    }
    return { ok: true };
  }

  /** Gibt eine Portion zu. Gibt ein Objekt zurück, das den vorherigen Zustand für die Darstellung beschreibt. */
  function add(c, id) {
    const check = canAdd(c, id);
    if (!check.ok) return check;
    const before = volume(c);
    if (isSample(id)) {
      c.sampleId = id;
      c.sampleAmount += 1;
    } else {
      c.portions[id] += 1;
    }
    c.history.push(id);
    // Fehling-Lösungen und Stoffproben schichten sich zunächst auf und vermischen
    // sich erst durch Diffusion, Schütteln oder Konvektion beim Erwärmen.
    // Die Tollens-Reagenzien werden tropfenweise unter Umschwenken zugegeben.
    if (before > 0 && !(REAGENT_BY_ID[id] && REAGENT_BY_ID[id].test === 'tollens')) c.mix = Math.min(c.mix, 0.3);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Phasen im Reagenzglas
  // ---------------------------------------------------------------------------
  /**
   * Leitet aus dem Inhalt ab, welches Nachweissystem vorliegt und ob es korrekt
   * angesetzt ist.
   *   system: 'empty' | 'none' | 'fehling' | 'tollens' | 'foreign'
   *   status: 'ready' | 'incomplete' | 'cuoh2' | 'imbalanced' | 'precipitate' | 'foreign' | 'noReagent' | 'empty'
   */
  function analyze(c) {
    const p = c.portions;
    const cu = p.fehling1, tart = p.fehling2, ag = p.agno3, naoh = p.naoh, nh3 = p.nh3;
    const sample = c.sampleId ? SAMPLE_BY_ID[c.sampleId] : null;
    const base = naoh + nh3 + tart; // Fehling II ist ebenfalls alkalisch
    const res = {
      system: 'none', status: 'noReagent', reason: '', sample, reducing: !!(sample && sample.reducing),
      cuFree: 0, cuComplex: 0, cuOH2: 0, cuAmmine: 0, ag2o: 0, agComplex: 0, agFree: 0, valid: false
    };
    if (volume(c) === 0) { res.system = 'empty'; res.status = 'empty'; return res; }

    const hasCuSys = cu > 0 || tart > 0;
    if (hasCuSys && ag > 0) {
      res.system = 'foreign'; res.status = 'foreign';
      res.reason = 'Kupfer- und Silberreagenzien wurden vermischt. Diese Mischung gehört zu keinem der beiden Nachweise.';
      res.cuComplex = Math.min(cu, tart); res.cuFree = cu - res.cuComplex;
      return res;
    }
    if (cu > 0 && nh3 > 0) {
      res.system = 'foreign'; res.status = 'foreign';
      res.reason = 'Ammoniaklösung bildet mit Kupfer(II)-Ionen einen tiefblauen Kupfer-Ammin-Komplex. Das ist kein Fehling-Reagenz.';
      res.cuAmmine = cu;
      return res;
    }
    if (hasCuSys) {
      res.system = 'fehling';
      if (cu === 0) {
        res.status = 'incomplete'; res.reason = 'Fehling I (Kupfer(II)-sulfat-Lösung) fehlt – ohne Kupfer(II)-Ionen ist kein Nachweis möglich.';
      } else if (tart === 0) {
        if (naoh > 0) {
          res.status = 'cuoh2'; res.cuOH2 = cu;
          res.reason = 'Fehling II fehlt. Ohne Tartrat fällt mit Natronlauge hellblaues Kupfer(II)-hydroxid aus; beim Erhitzen bildet sich daraus schwarzes Kupfer(II)-oxid.';
        } else {
          res.status = 'incomplete'; res.cuFree = cu;
          res.reason = 'Fehling II fehlt. Die Kupfer(II)-sulfat-Lösung allein ist nicht alkalisch und enthält keinen Tartrat-Komplex.';
        }
      } else if (tart < cu) {
        res.status = 'imbalanced'; res.cuComplex = tart; res.cuOH2 = cu - tart;
        res.reason = 'Zu wenig Fehling II: Ein Teil der Kupfer(II)-Ionen fällt als Kupfer(II)-hydroxid aus. Fehling I und II zu gleichen Teilen mischen.';
      } else {
        res.status = 'ready'; res.cuComplex = cu; res.valid = true;
      }
      return res;
    }
    if (ag > 0) {
      res.system = 'tollens';
      if (base === 0) {
        res.status = 'incomplete'; res.agFree = ag;
        res.reason = 'Silbernitratlösung allein ist kein Tollens-Reagenz: Es fehlt die alkalische, ammoniakalische Silberlösung.';
        return res;
      }
      // Ag⁺ + OH⁻ → Ag₂O (braun); Ammoniak löst Ag₂O als [Ag(NH₃)₂]⁺.
      const dissolved = clamp(nh3 / (2 * ag));
      res.ag2o = ag * (1 - dissolved);
      res.agComplex = ag * dissolved;
      if (res.ag2o > 1e-9) {
        res.status = 'precipitate';
        res.reason = nh3 === 0
          ? 'Brauner Silberoxid-Niederschlag: Ammoniaklösung fehlt noch, um ihn als Silber-Ammin-Komplex zu lösen.'
          : 'Der braune Silberoxid-Niederschlag ist noch nicht vollständig gelöst – es fehlt noch Ammoniaklösung.';
      } else {
        res.status = 'ready'; res.valid = true;
      }
      return res;
    }
    res.system = 'none'; res.status = 'noReagent';
    res.reason = 'Es ist noch kein Nachweisreagenz im Reagenzglas.';
    return res;
  }

  /** Ist das Nachweisreagenz vollständig vorbereitet (inkl. Durchmischung)? */
  function reagentReady(c) {
    const a = analyze(c);
    return a.valid && c.mix >= 0.85;
  }

  // ---------------------------------------------------------------------------
  // Kinetik
  // ---------------------------------------------------------------------------
  /**
   * Zeitschritt. envTemp: Temperatur der Umgebung (Ständer/Wasserbad/Flamme),
   * tau: Zeitkonstante der Wärmeübertragung in s.
   */
  function step(c, dt, envTemp, tau) {
    if (dt <= 0) return;
    const vol = volume(c);
    const k = 1 - Math.exp(-dt / Math.max(0.05, tau || 6));
    c.temp += (envTemp - c.temp) * k;
    if (c.temp > c.maxTemp) c.maxTemp = c.temp;
    if (vol === 0) { c.mix = 1; return; }

    const fF = fehlingTempFactor(c.temp);
    const fT = tollensTempFactor(c.temp);
    // Durchmischung: langsame Diffusion, schnelle Konvektion in warmer Flüssigkeit.
    c.mix = Math.min(1, c.mix + dt * (0.012 + (c.temp > 35 ? 0.22 : 0)));

    c.heatF += dt * fF / T.HEAT_FEHLING;
    c.heatT += dt * fT / T.HEAT_TOLLENS;

    if (c.bumped) return; // Ansatz unbrauchbar – keine weitere Auswertung
    const a = analyze(c);
    if (a.system === 'fehling' && a.valid && a.reducing) {
      c.progress = Math.min(1, c.progress + dt * fF * c.mix * a.sample.rate / T.FEHLING_REACTION);
    } else if (a.system === 'tollens' && a.valid && a.reducing) {
      c.progress = Math.min(1, c.progress + dt * fT * c.mix * a.sample.rate / T.TOLLENS_REACTION);
      if (fT > 0 && c.temp > 75) c.hotTollens += dt;
    } else if (a.system === 'tollens' && a.status === 'precipitate' && a.reducing) {
      c.darkening = Math.min(1, c.darkening + dt * fT / T.DARKEN);
    }
    if (a.system === 'fehling' && (a.status === 'cuoh2' || a.status === 'imbalanced')) {
      c.cuo = Math.min(1, c.cuo + dt * fF / T.CUO);
    }
  }

  /** Wurde ausreichend erwärmt, um eine Beobachtung abschließend zu beurteilen? */
  function heatDose(c) {
    const a = analyze(c);
    return a.system === 'tollens' ? c.heatT : c.heatF;
  }

  function isReactive(c) {
    const a = analyze(c);
    return (a.system === 'fehling' || a.system === 'tollens') && a.valid && a.reducing;
  }

  /** Beobachtung möglich: positive Reaktion praktisch abgeschlossen bzw. ausreichend lange erwärmt. */
  function isObservable(c) {
    if (volume(c) === 0) return false;
    if (c.bumped) return true;
    if (isReactive(c)) return c.progress >= 0.97;
    return heatDose(c) >= 1;
  }

  // ---------------------------------------------------------------------------
  // Optisches Modell
  // ---------------------------------------------------------------------------
  const COL = {
    clear: [228, 240, 248],
    cuAqua: [92, 170, 235], // hellblaues [Cu(H₂O)₆]²⁺ (Fehling I)
    cuTartrate: [18, 46, 180], // tiefblauer Kupfer-Tartrat-Komplex (Fehling-Lösung)
    cuAmmine: [52, 40, 190], // tiefblau-violetter Kupfer-Ammin-Komplex
    cuOH2: [118, 176, 232], // hellblaues Kupfer(II)-hydroxid
    cuO: [32, 30, 30], // schwarzes Kupfer(II)-oxid
    ag2o: [104, 66, 36], // braunes Silberoxid
    agDark: [46, 46, 50] // fein verteiltes Silber (grau-schwarz)
  };
  // Cu₂O: kleine Partikel gelb-orange, größere ziegelrot.
  const CU2O_STOPS = [[0, [232, 196, 64]], [0.35, [230, 146, 42]], [0.7, [196, 80, 36]], [1, [172, 56, 30]]];
  // Beobachtete Gesamtfarbe der Fehling-Reaktionsmischung. Gelbes Cu₂O-Kolloid in
  // tiefblauer Lösung wirkt subtraktiv grün (die Lösung absorbiert Rot/Gelb, die
  // Partikel Blau); mit wachsender Partikelmenge und -größe dominiert Orange/Ziegelrot.
  const FEHLING_VIEW_STOPS = [
    [0.12, [30, 108, 172]], // blau-türkis
    [0.25, [52, 138, 116]], // blaugrün
    [0.4, [138, 150, 56]], // olivgrün / gelbgrün
    [0.55, [204, 146, 42]], // gelb-orange
    [0.72, [212, 102, 38]], // orange
    [0.88, [186, 70, 34]],
    [1, [168, 54, 30]] // ziegelrot
  ];

  /**
   * Gibt das Erscheinungsbild zurück:
   *  liquid: gelöste Farbe [r,g,b,a]
   *  turb: Trübung durch fein verteilte Feststoffe [r,g,b,a]
   *  flecks: sichtbare Partikel {color:[r,g,b], density 0..1, size}
   *  mirror: Bedeckung der Glaswand mit Silber 0..1, mirrorQuality 0..1
   */
  function appearance(c) {
    const vol = volume(c);
    if (vol === 0) return null;
    const a = analyze(c);
    const layers = []; // [color, strength]
    const conc = (n) => n / vol;

    // Gelöste farbige Teilchen
    if (a.cuFree > 0) layers.push([COL.cuAqua, clamp(0.3 + 0.35 * conc(a.cuFree), 0, 0.7)]);
    if (a.cuComplex > 0) {
      const remaining = a.cuComplex * (1 - 0.55 * c.progress);
      layers.push([COL.cuTartrate, clamp(0.55 + 0.9 * conc(remaining), 0, 0.92)]);
    }
    if (a.cuAmmine > 0) layers.push([COL.cuAmmine, clamp(0.55 + 0.9 * conc(a.cuAmmine), 0, 0.92)]);

    let liquid;
    if (layers.length === 0) {
      liquid = [...COL.clear, 0.1];
    } else {
      let keep = 1, r = 0, g = 0, b = 0, sum = 0;
      for (const [col, s] of layers) { keep *= 1 - s; r += col[0] * s; g += col[1] * s; b += col[2] * s; sum += s; }
      liquid = [r / sum, g / sum, b / sum, 1 - keep];
    }

    let turb = [0, 0, 0, 0];
    const flecks = { color: [0, 0, 0], density: 0, size: 1 };
    let mirror = 0, mirrorQuality = 1;

    if (a.system === 'fehling' || (a.system === 'foreign' && c.progress > 0)) {
      if (c.progress > 0) {
        // Cu₂O-Kolloid: Farbe wandert von gelb-orange nach ziegelrot, Trübung nimmt zu.
        const col = stops(CU2O_STOPS, c.progress);
        turb = [...col, 0.94 * smooth(0.03, 0.82, c.progress)];
        flecks.color = lerpColor(col, [150, 45, 25], 0.35);
        flecks.density = smooth(0.02, 0.9, c.progress);
        flecks.size = 0.8 + 0.8 * c.progress;
      }
      if (a.cuOH2 > 0) {
        const frac = clamp(a.cuOH2 / Math.max(1, c.portions.fehling1));
        const col = lerpColor(COL.cuOH2, COL.cuO, smooth(0, 1, c.cuo));
        const ta = (0.55 + 0.35 * frac) * (0.85 + 0.15 * c.cuo);
        turb = mixTurb(turb, [...col, ta]);
        flecks.color = lerpColor([90, 150, 215], COL.cuO, c.cuo);
        flecks.density = Math.max(flecks.density, 0.6);
        flecks.size = 1.6;
      }
    }

    if (a.system === 'tollens') {
      if (a.ag2o > 0) {
        const frac = a.ag2o / Math.max(1e-9, c.portions.agno3);
        const col = lerpColor(COL.ag2o, COL.agDark, c.darkening);
        turb = [...col, 0.25 + 0.65 * frac];
        flecks.color = lerpColor([70, 48, 32], [30, 30, 32], c.darkening);
        flecks.density = 0.25 + 0.75 * frac;
        flecks.size = 1.3;
      } else if (c.darkening > 0) {
        turb = [...COL.agDark, 0.35 * c.darkening];
      }
      if (a.valid && c.progress > 0) {
        // Kolloidales Silber färbt die Lösung zunächst grau, dann scheidet es sich an der Wand ab.
        const haze = 0.42 * smooth(0.02, 0.3, c.progress) * (1 - 0.45 * smooth(0.5, 1, c.progress));
        const hot = clamp(c.hotTollens / 6);
        turb = mixTurb(turb, [...lerpColor([120, 112, 104], COL.agDark, 0.5 + 0.5 * hot), haze + 0.2 * hot * c.progress]);
        flecks.color = [70, 70, 74];
        flecks.density = Math.max(flecks.density, 0.25 * smooth(0.05, 0.5, c.progress) + 0.4 * hot * c.progress);
        flecks.size = 0.8;
        mirror = smooth(0.08, 0.96, c.progress);
        mirrorQuality = 1 - 0.35 * hot;
      }
    }

    if (a.system === 'foreign' && c.progress === 0) {
      turb = mixTurb(turb, [120, 128, 120, 0.25]);
    }

    // body: sichtbare Gesamtfarbe des Reagenzglasinhalts (Lösung + Schwebstoffe)
    let body;
    if (a.system === 'fehling' && c.progress > 0 && a.cuOH2 === 0) {
      const start = [liquid[0], liquid[1], liquid[2]];
      const list = [[0, start]].concat(FEHLING_VIEW_STOPS);
      body = [...stops(list, c.progress), lerp(liquid[3], 0.97, smooth(0, 0.7, c.progress))];
    } else {
      const ta = turb[3];
      const la = liquid[3];
      const outA = ta + la * (1 - ta);
      body = outA > 0
        ? [0, 1, 2].map((i) => (turb[i] * ta + liquid[i] * la * (1 - ta)) / outA).concat(outA)
        : [...COL.clear, 0.1];
    }
    // Kupfer-Tartrat ist auch nach der Reaktion noch im Überschuss vorhanden (liquid).
    return { body, liquid, turb, flecks, mirror, mirrorQuality, system: a.system, status: a.status };
  }

  function mixTurb(t1, t2) {
    const a = 1 - (1 - t1[3]) * (1 - t2[3]);
    if (a <= 0) return [0, 0, 0, 0];
    const w1 = t1[3] / (t1[3] + t2[3]), w2 = 1 - w1;
    return [t1[0] * w1 + t2[0] * w2, t1[1] * w1 + t2[1] * w2, t1[2] * w1 + t2[2] * w2, a];
  }

  // ---------------------------------------------------------------------------
  // Fachliche Bewertung
  // ---------------------------------------------------------------------------
  const OBSERVATIONS = {
    tiefblau: 'Die Lösung ist tiefblau und bleibt tiefblau.',
    hellblau: 'Die Lösung ist hellblau und bleibt unverändert.',
    ziegelrot: 'Es bildet sich eine orange bis ziegelrote Trübung (Niederschlag).',
    klar: 'Die Lösung bleibt klar und farblos.',
    spiegel: 'An der Glaswand bildet sich ein silberner bzw. grau-silberner Belag (Silberspiegel).',
    grau: 'Die Lösung färbt sich grau bis schwarz.',
    braun: 'Ein brauner Niederschlag ist zu sehen.',
    hellblauNs: 'Ein hellblauer Niederschlag ist zu sehen.',
    schwarz: 'Es entsteht ein schwarzer Niederschlag.',
    keineVeraenderung: 'Beim Erwärmen ist keine Veränderung zu sehen.'
  };
  const RESULTS = {
    positiv: 'Positiver Nachweis',
    negativ: 'Negativer Nachweis',
    ungueltig: 'Kein gültiger Nachweis (Versuch unvollständig oder fehlerhaft)'
  };
  const INTERPRETATIONS = {
    reduzierend: 'Die Probe wirkt reduzierend: Sie wird oxidiert, das Reagenz wird reduziert.',
    nichtReduzierend: 'Die Probe zeigt unter diesen Bedingungen keine reduzierende Wirkung.',
    keineAussage: 'Aus diesem Versuch lässt sich keine Aussage über die Probe ableiten.'
  };
  const CLASSES = {
    aldehyd: 'Reduzierend wirkender Stoff – im Probensatz ein Aldehyd. Welcher Aldehyd, lässt sich mit dem Nachweis allein nicht sagen.',
    aldehydEindeutig: 'Der Stoff ist durch den Nachweis eindeutig identifiziert (z. B. „das ist Ethanal“).',
    keinAldehyd: 'Keine Aldehydgruppe nachweisbar – im Probensatz also ein Keton. Allein durch den Nachweis ist das nicht bewiesen.',
    ketonBewiesen: 'Der negative Nachweis beweist, dass der Stoff ein Keton ist.',
    keineAussage: 'Keine Zuordnung möglich.'
  };
  const METHODS = { fehling: 'Fehling-Probe', tollens: 'Tollens-Probe (Silberspiegelprobe)', keines: 'Kein vollständiges Nachweisverfahren' };

  /**
   * Fachliche Musterauswertung eines Reagenzglases.
   */
  function classify(c) {
    const a = analyze(c);
    const sample = a.sample;
    const heated = heatDose(c) >= 1;
    const out = {
      system: a.system, status: a.status, reason: a.reason,
      sampleId: sample ? sample.id : null,
      method: a.system === 'fehling' ? 'fehling' : a.system === 'tollens' ? 'tollens' : 'keines',
      outcome: 'invalid',
      result: 'ungueltig', interpretation: 'keineAussage', cls: 'keineAussage',
      obsRequired: [], obsOptional: [], strictObs: true,
      title: '', explanation: ''
    };
    const set = (req, opt) => { out.obsRequired = req; out.obsOptional = opt || []; };

    if (a.system === 'empty') {
      out.outcome = 'empty'; out.title = 'Leeres Reagenzglas'; out.explanation = 'Das Reagenzglas enthält noch nichts.';
      out.strictObs = false; return out;
    }
    if (c.bumped) {
      out.outcome = 'invalid'; out.title = 'Versuch ungültig – Siedeverzug';
      out.explanation = 'Durch direktes Erhitzen in der Flamme kam es zu einem Siedeverzug; ein Teil des Ansatzes ist herausgespritzt. Der Versuch muss im Wasserbad neu angesetzt werden.';
      out.strictObs = false; return out;
    }
    if (a.system === 'foreign' || a.system === 'none') {
      out.title = 'Kein gültiger Nachweis';
      out.explanation = a.reason + ' Setze ein neues Reagenzglas an.';
      out.strictObs = false; return out;
    }

    const isF = a.system === 'fehling';
    const testName = isF ? 'Fehling-Probe' : 'Tollens-Probe';

    if (!a.valid) {
      out.title = 'Kein gültiger Nachweis – Reagenz nicht korrekt angesetzt';
      out.explanation = a.reason + ' Ein Ergebnis dieses Ansatzes lässt keine Aussage über die Probe zu.';
      if (isF) {
        if (a.status === 'cuoh2' || a.status === 'imbalanced') {
          if (c.cuo > 0.5) set(['schwarz'], ['hellblauNs', 'ziegelrot', 'tiefblau']);
          else set(['hellblauNs'], ['schwarz', 'tiefblau', 'keineVeraenderung']);
          out.strictObs = c.progress === 0 && !a.reducing;
        } else if (c.portions.fehling1 > 0) set(['hellblau'], ['keineVeraenderung']);
        else set(['klar'], ['keineVeraenderung']);
      } else {
        if (a.status === 'precipitate') set(['braun'], c.darkening > 0.2 ? ['grau', 'schwarz'] : ['keineVeraenderung']);
        else set(['klar'], ['keineVeraenderung']);
      }
      return out;
    }

    // Reagenz korrekt angesetzt
    if (!sample) {
      out.title = 'Blindprobe ohne Stoffprobe';
      out.explanation = `Das ${testName.replace('-Probe', '-Reagenz')} wurde ohne Stoffprobe ${heated ? 'erwärmt' : 'beobachtet'}. Eine solche Blindprobe zeigt, dass das Reagenz allein keine positive Reaktion zeigt – über eine Stoffprobe sagt sie nichts aus.`;
      set(isF ? ['tiefblau'] : ['klar'], ['keineVeraenderung']);
      return out;
    }

    if (!isObservable(c)) {
      out.outcome = 'unfinished';
      out.title = heated || c.progress > 0 ? 'Versuch noch nicht abgeschlossen' : 'Noch nicht erwärmt – kein abgeschlossener Nachweis';
      out.explanation = heated || c.progress > 0
        ? 'Die Reaktion ist noch nicht abgeschlossen. Lass das Reagenzglas weiter im Wasserbad und beobachte erneut.'
        : `Die ${testName} benötigt Wärme. Ohne Erwärmen im Wasserbad läuft die Nachweisreaktion nicht in beobachtbarer Zeit ab – daraus darf noch kein Ergebnis abgeleitet werden.`;
      if (c.progress > 0.05) set([], isF ? ['tiefblau', 'ziegelrot'] : ['klar', 'grau', 'spiegel']);
      else set(isF ? ['tiefblau'] : ['klar'], ['keineVeraenderung']);
      out.strictObs = c.progress <= 0.05;
      return out;
    }

    if (a.reducing) {
      out.outcome = 'positive'; out.result = 'positiv'; out.interpretation = 'reduzierend'; out.cls = 'aldehyd';
      if (isF) {
        out.title = 'Positive Fehling-Probe';
        out.explanation = 'Beim Erwärmen bildet sich eine orange bis ziegelrote Trübung aus Kupfer(I)-oxid (Cu₂O). Die Kupfer(II)-Ionen wurden zu Kupfer(I) reduziert, die Aldehydgruppe der Probe wurde zur Carboxygruppe oxidiert. Die Probe wirkt reduzierend. Welcher Aldehyd vorliegt, lässt sich aus diesem Nachweis allein nicht ableiten – alle drei Aldehyde reagieren gleich.';
        set(['ziegelrot'], []);
      } else {
        out.title = 'Positive Tollens-Probe (Silberspiegel)';
        out.explanation = 'An der Glaswand scheidet sich elementares Silber als Silberspiegel ab. Die Silber(I)-Ionen des Silber-Ammin-Komplexes wurden zu Silber reduziert, die Aldehydgruppe der Probe wurde zur Carboxygruppe oxidiert. Die Probe wirkt reduzierend. Welcher Aldehyd vorliegt, lässt sich aus diesem Nachweis allein nicht ableiten.';
        set(['spiegel'], ['grau']);
      }
    } else {
      out.outcome = 'negative'; out.result = 'negativ'; out.interpretation = 'nichtReduzierend'; out.cls = 'keinAldehyd';
      out.title = `Negative ${testName}`;
      out.explanation = isF
        ? 'Die Lösung bleibt auch nach dem Erwärmen tiefblau, es bildet sich kein Kupfer(I)-oxid. Die Probe wirkt unter diesen Bedingungen nicht reduzierend. Ketone besitzen am Carbonyl-C-Atom kein Wasserstoffatom und werden daher nicht oxidiert. Ein negativer Nachweis allein beweist aber nicht, dass ein Keton vorliegt – auch z. B. Alkane oder Ethanol reagieren negativ.'
        : 'Die Lösung bleibt klar, an der Glaswand entsteht kein Silberspiegel. Die Probe wirkt unter diesen Bedingungen nicht reduzierend. Ketone besitzen am Carbonyl-C-Atom kein Wasserstoffatom und werden daher nicht oxidiert. Ein negativer Nachweis allein beweist aber nicht, dass ein Keton vorliegt – auch z. B. Alkane oder Ethanol reagieren negativ.';
      set(isF ? ['tiefblau'] : ['klar'], ['keineVeraenderung']);
    }
    return out;
  }

  /**
   * Bewertet die Eingaben eines Schülerprotokolls gegen die Musterauswertung.
   * answers: { method, observations: string[], result, interpretation, cls }
   */
  function gradeProtocol(model, answers) {
    const fb = {};
    fb.method = answers.method === model.method;
    const obs = new Set(answers.observations || []);
    if (model.strictObs) {
      const allowed = new Set([...model.obsRequired, ...model.obsOptional]);
      const missing = model.obsRequired.filter((k) => !obs.has(k));
      const wrong = [...obs].filter((k) => !allowed.has(k));
      fb.observations = missing.length === 0 && wrong.length === 0 && obs.size > 0;
      fb.obsMissing = missing; fb.obsWrong = wrong;
    } else {
      const allowed = new Set([...model.obsRequired, ...model.obsOptional]);
      const wrong = allowed.size ? [...obs].filter((k) => !allowed.has(k)) : [];
      fb.observations = obs.size > 0 && wrong.length === 0;
      fb.obsMissing = []; fb.obsWrong = wrong;
    }
    fb.result = answers.result === model.result;
    fb.interpretation = answers.interpretation === model.interpretation;
    fb.cls = answers.cls === model.cls;
    fb.allCorrect = fb.method && fb.observations && fb.result && fb.interpretation && fb.cls;
    return fb;
  }

  /** Molekülformel aus der Halbstrukturformel (für Selbsttests). */
  function formulaFromChain(sample) {
    let C = 0, H = 0;
    sample.chain.forEach((g) => {
      const m = /^C(H(\d?))?$/.exec(g);
      if (m) { C += 1; if (m[1]) H += m[2] ? +m[2] : 1; } else if (g === 'H') H += 1;
    });
    return { C, H, O: 1 };
  }

  return {
    SAMPLES, SAMPLE_BY_ID, REAGENTS, REAGENT_BY_ID, CAPACITY, TIMES: T,
    OBSERVATIONS, RESULTS, INTERPRETATIONS, CLASSES, METHODS,
    createContents, volume, canAdd, add, analyze, reagentReady, step,
    fehlingTempFactor, tollensTempFactor, heatDose, isReactive, isObservable,
    appearance, classify, gradeProtocol, formulaFromChain,
    util: { clamp, smooth, lerp, lerpColor }
  };
});
