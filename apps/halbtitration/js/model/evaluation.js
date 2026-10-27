/*
 * Auswertungslogik: Schülerrechnungen prüfen, Messdaten auswerten
 * --------------------------------------------------------------
 * Grundsätze:
 *  - Rechnungen werden gegen die EIGENEN Messwerte bzw. die gewählte
 *    Rechenbasis geprüft, nicht gegen den geheimen Modellwert. Eine korrekte
 *    Rechnung mit ungenauem Messwert ist rechnerisch richtig.
 *  - Toleranzen folgen aus der Auflösung: pH-Meter 0,01 → pH/pK ± 0,01;
 *    Bürette 0,01 mL → Volumenrechnungen ± 0,01 mL (Rundung der Lernenden);
 *    Näherungsrechnungen mit gerundeten Zwischenwerten ± 0,03.
 *  - Rückmeldungen nennen die Fehlerart: Rechnung, Durchführung/Messung,
 *    Näherung/Modellgrenze.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});
  if (!NS.Chemistry && typeof require === 'function') require('./chemistry.js');
  if (!NS.Indicators && typeof require === 'function') require('./indicators.js');
  if (!NS.Format && typeof require === 'function') require('./format.js');
  const Chem = NS.Chemistry;
  const Ind = NS.Indicators;
  const F = NS.Format;

  const TOL = {
    volumeCalc: 0.011, // mL
    pK: 0.011,
    pHApprox: 0.031,
    readingMatch: 0.0051, // pH-Eingabe muss einem protokollierten Wert entsprechen
    buretteReading: 0.021, // mL Ablesung der Bürette
  };

  function near(a, b, tol) { return Math.abs(a - b) <= tol; }

  /** Gemeinsame Eingangsprüfung: leer / ungültig / Zahl */
  function readInput(raw, unit) {
    const p = F.parseQuantity(raw, unit || null);
    if (p.empty) return { status: 'empty', message: 'Noch keine Eingabe.' };
    if (!p.ok) return { status: 'invalid', message: p.message };
    return { status: 'number', value: p.value };
  }

  function result(status, value, message, kind) {
    return { status: status, value: value, message: message || null, kind: kind || null };
  }

  // ------------------------------------------------------------ Aufgabenlisten

  /** Zu bestimmende Größen je Versuch */
  function pkTasks(exp) {
    if (exp.id === 'ammonia') {
      return [
        { key: 'pKb', stage: 1, label: 'pK_B(NH₃)', html: 'pK<sub>B</sub>(NH<sub>3</sub>)', from: 'pOH' },
        { key: 'pKsNH4', stage: 1, label: 'pKₛ(NH₄⁺)', html: 'pK<sub>S</sub>(NH<sub>4</sub><sup>+</sup>)', from: 'pH' },
      ];
    }
    if (exp.stages === 1) {
      return [{ key: 'pKs1', stage: 1, label: 'pKₛ(CH₃COOH)', html: 'pK<sub>S</sub>(CH<sub>3</sub>COOH)', from: 'pH' }];
    }
    const names = exp.id === 'phosphoric'
      ? [['pKₛ₁', 'H₃PO₄ / H₂PO₄⁻'], ['pKₛ₂', 'H₂PO₄⁻ / HPO₄²⁻']]
      : [['pKₛ₁', '–COOH-Gruppe'], ['pKₛ₂', '–NH₃⁺-Gruppe']];
    return names.map(function (n, i) {
      return { key: 'pKs' + (i + 1), stage: i + 1, label: n[0] + ' (' + n[1] + ')', html: 'pK<sub>S' + (i + 1) + '</sub> (' + n[1] + ')', from: 'pH' };
    });
  }

  /** Literaturwert zu einer Aufgabe */
  function literatureValue(exp, key) {
    const lit = Chem.LITERATURE[exp.id];
    if (key === 'pKb') return lit.pKb;
    if (key === 'pKsNH4') return lit.pKs[0];
    return lit.pKs[Number(key.slice(3)) - 1];
  }

  // ------------------------------------------------------------ Rechnung 1: V(ÄP)

  /**
   * Äquivalenzvolumen aus Stöchiometrie: V(ÄP,j) = j · c(Probe) · V(Probe) / c(Maßlösung).
   */
  function checkEquivalenceVolume(exp, stage, raw) {
    const r = readInput(raw, 'mL');
    if (r.status !== 'number') return result(r.status, null, r.message);
    const eq = Chem.equivalenceVolumes(exp)[stage - 1];
    const x = r.value;
    if (near(x, eq, Math.max(TOL.volumeCalc, eq * 0.0005))) return result('ok', x, 'Richtig berechnet.', 'calc');
    const n = exp.cSample * exp.vSample;
    const diag = [];
    if (stage > 1 && near(x, eq / stage, 0.02)) diag.push('Für die ' + stage + '. Stufe müssen ' + stage + ' Protonen je Teilchen abgegeben sein: Stufenfaktor ' + stage + ' fehlt.');
    else if (near(x, eq * 1000, eq) || near(x, eq / 1000, eq / 500)) diag.push('Abweichung um den Faktor 1000 – Einheiten (mL ↔ L) prüfen.');
    else if (near(x, (stage * exp.cSample * (exp.vSample + exp.vWater)) / exp.cTitrant, 0.02)) diag.push('Das zugegebene Wasser verdünnt nur – die Stoffmenge der Probe hängt nur von V(Probe) = ' + F.fmt(exp.vSample, 2) + ' mL ab.');
    else if (near(x, (exp.cTitrant * exp.vSample) / exp.cSample, 0.02)) diag.push('c(Probe) und c(Maßlösung) sind vertauscht.');
    else diag.push('Ansatz: n(Probe) = c(Probe) · V(Probe) = ' + F.fmt(n, 2) + ' mmol; zum ' + stage + '. Äquivalenzpunkt braucht es ' + (stage === 1 ? 'die gleiche' : 'die ' + stage + '-fache') + ' Stoffmenge an Maßlösung.');
    return result('wrong', x, diag.join(' '), 'calc');
  }

  // ------------------------------------------------------------ Rechnung 2: V(HÄP)

  /**
   * Zielvolumen des Halbäquivalenzpunkts aus einer Rechenbasis
   * basis = { v1, v2 } (mL; v2 nur für Stufe 2).
   */
  function checkHalfVolume(stage, raw, basis) {
    const r = readInput(raw, 'mL');
    if (r.status !== 'number') return result(r.status, null, r.message);
    const x = r.value;
    if (!basis || !Number.isFinite(basis.v1) || (stage === 2 && !Number.isFinite(basis.v2))) {
      return result('nobasis', x, 'Erst die Rechenbasis festlegen: Welches Äquivalenzvolumen verwendest du?');
    }
    const expected = stage === 1 ? basis.v1 / 2 : (basis.v1 + basis.v2) / 2;
    if (near(x, expected, TOL.volumeCalc)) return result('ok', x, 'Richtig berechnet.', 'calc');
    let msg;
    if (stage === 2 && near(x, basis.v2 / 2, TOL.volumeCalc)) {
      msg = 'V(ÄP,2)/2 liegt am ersten Äquivalenzpunkt, nicht in der Mitte der zweiten Stufe. Die zweite Stufe beginnt bei V(ÄP,1): V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)] / 2.';
    } else if (stage === 2 && near(x, basis.v1 / 2, TOL.volumeCalc)) {
      msg = 'Das ist der erste Halbäquivalenzpunkt. Gesucht ist die Mitte der zweiten Stufe.';
    } else if (near(x, stage === 1 ? basis.v1 : basis.v2, TOL.volumeCalc)) {
      msg = 'Das ist das Äquivalenzvolumen. Am Halbäquivalenzpunkt ist die Stufe erst zur Hälfte umgesetzt.';
    } else {
      msg = stage === 1 ? 'Ansatz: Halbe Stoffmenge an Maßlösung bis zum ersten Äquivalenzpunkt.' : 'Ansatz: Mitte zwischen erstem und zweitem Äquivalenzpunkt.';
    }
    return result('wrong', x, msg, 'calc');
  }

  // ------------------------------------------------------------ Bürettenablesung

  function checkReading(raw, actual) {
    const r = readInput(raw, 'mL');
    if (r.status !== 'number') return result(r.status, null, r.message);
    if (!Number.isFinite(actual)) return result('nobasis', r.value, 'Noch kein Bürettenstand vorhanden.');
    if (near(r.value, actual, TOL.buretteReading)) return result('ok', r.value, 'Ablesung passt (± 0,02 mL).', 'measure');
    return result('wrong', r.value, 'Ablesung weicht ab. Unterkante des Meniskus auf Augenhöhe in der Ablesehilfe ablesen; die Skala zählt von oben nach unten.', 'measure');
  }

  /** Verbrauch = Endstand − Anfangsstand (gegen die eigenen Ablesungen) */
  function checkConsumption(raw, start, end) {
    const r = readInput(raw, 'mL');
    if (r.status !== 'number') return result(r.status, null, r.message);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return result('nobasis', r.value, 'Zuerst Anfangs- und Endstand eintragen.');
    const d = end - start;
    if (near(r.value, d, TOL.volumeCalc)) return result('ok', r.value, 'Richtig: Endstand − Anfangsstand.', 'calc');
    if (near(r.value, -d, TOL.volumeCalc)) return result('wrong', r.value, 'Vorzeichen: Der Bürettenstand nimmt beim Ablassen zu; Verbrauch = Endstand − Anfangsstand.', 'calc');
    if (near(r.value, end, TOL.volumeCalc)) return result('wrong', r.value, 'Das ist der Endstand. Der Anfangsstand lag nicht bei 0,00 mL.', 'calc');
    return result('wrong', r.value, 'Verbrauch = Endstand − Anfangsstand.', 'calc');
  }

  // ------------------------------------------------------------ Rechnung 3: pK

  /**
   * Prüft den eingegebenen pH-Wert gegen die protokollierten Messpunkte
   * der Halbtitration und den pK-Wert gegen diesen pH-Wert.
   * @param {object[]} points Messpunkte der Halbtitrationsreihe(n)
   * @param {number} target eigenes Zielvolumen (mL) oder NaN
   */
  function checkMeasuredPH(raw, points, target) {
    const r = readInput(raw, null);
    if (r.status !== 'number') return result(r.status, null, r.message);
    const pts = (points || []).filter(function (p) { return Number.isFinite(p.pH); });
    if (!pts.length) return result('gap', r.value, 'In der Halbtitration wurde noch kein pH-Wert protokolliert (Datenlücke).', 'measure');
    const matches = pts.filter(function (p) { return near(p.pH, r.value, TOL.readingMatch); });
    if (!matches.length) {
      return result('wrong', r.value, 'Dieser pH-Wert steht nicht in deiner Halbtitrations-Messreihe. Trage den protokollierten Wert am Zielvolumen ein.', 'measure');
    }
    // Den Punkt wählen, der dem Zielvolumen am nächsten liegt
    let best = matches[0];
    if (Number.isFinite(target)) matches.forEach(function (p) { if (Math.abs(p.v - target) < Math.abs(best.v - target)) best = p; });
    const notes = [];
    if (Number.isFinite(target) && Math.abs(best.v - target) > 0.025) {
      notes.push('Messpunkt bei V = ' + F.fmt(best.v, 2) + ' mL statt am eigenen Zielvolumen ' + F.fmt(target, 2) + ' mL (' + F.signed(best.v - target, 2) + ' mL).');
    }
    if (!best.stable) notes.push('Der Wert wurde übernommen, bevor die Anzeige stabil war.');
    if (best.homogeneous === false) notes.push('Die Lösung war beim Ablesen noch nicht durchmischt.');
    const status = notes.length ? 'measured-note' : 'ok';
    return Object.assign(result(status, r.value, notes.length ? notes.join(' ') : 'Protokollierter Messwert am Zielvolumen.', 'measure'), { point: best });
  }

  /** pK aus dem eigenen pH-Wert: pKₛ = pH bzw. pK_B = pK_w − pH */
  function checkPK(task, raw, pHOwn) {
    const r = readInput(raw, null);
    if (r.status !== 'number') return result(r.status, null, r.message);
    if (!Number.isFinite(pHOwn)) return result('nobasis', r.value, 'Zuerst den gemessenen pH-Wert eintragen.');
    const expected = task.from === 'pOH' ? Chem.PKW - pHOwn : pHOwn;
    if (near(r.value, expected, TOL.pK)) return result('ok', r.value, 'Rechnerisch richtig aus deinem Messwert.', 'calc');
    let msg;
    if (task.from === 'pOH' && near(r.value, pHOwn, TOL.pK)) {
      msg = 'Am Halbäquivalenzpunkt gilt pOH ≈ pK_B, nicht pH ≈ pK_B. Dein pH-Wert entspricht pKₛ(NH₄⁺). pK_B = pK_w − pH.';
    } else if (task.from === 'pH' && near(r.value, Chem.PKW - pHOwn, TOL.pK)) {
      msg = 'Hier ist ein pKₛ-Wert gesucht: Am Halbäquivalenzpunkt gilt pH ≈ pKₛ (ohne Umrechnung über pK_w).';
    } else {
      msg = task.from === 'pOH' ? 'Ansatz: pOH = pK_w − pH mit pK_w = 14,00; am HÄP gilt pOH ≈ pK_B.' : 'Ansatz: Am Halbäquivalenzpunkt gilt c(Säure) ≈ c(korrespondierende Base) → pH ≈ pKₛ.';
    }
    return result('wrong', r.value, msg, 'calc');
  }

  // ------------------------------------------------------------ Rechnung 4: theoretische pH-Werte

  function weakQuadratic(pK, c) {
    const K = Math.pow(10, -pK);
    const x = (-K + Math.sqrt(K * K + 4 * K * c)) / 2;
    return { p: -Math.log10(x), alpha: x / c };
  }
  function weakSimple(pK, c) { return 0.5 * (pK - Math.log10(c)); }

  /**
   * Charakteristische Punkte mit schulischen Näherungen (aus Literaturwerten).
   * main: erwartete Rechnung; alts: weitere erkannte Ansätze.
   */
  function theoryPoints(exp) {
    const lit = Chem.LITERATURE[exp.id];
    const eq = Chem.equivalenceVolumes(exp);
    const v0 = exp.vSample + exp.vWater;
    const c0 = (exp.cSample * exp.vSample) / v0;
    const n = exp.cSample * exp.vSample;
    const pts = [];
    const dil = 'c₀ = c(Probe) · V(Probe) / V(gesamt) = ' + F.fmt(c0, 4) + ' mol/L (nach dem Verdünnen auf ' + F.fmt(v0, 0) + ' mL)';

    if (exp.id === 'acetic' || exp.id === 'phosphoric' || exp.id === 'glycine') {
      const pK1 = lit.pKs[0];
      const q = weakQuadratic(pK1, c0);
      const s = weakSimple(pK1, c0);
      const valid = q.alpha < 0.05;
      pts.push({
        key: 'start', v: 0, label: 'Startpunkt (V = 0 mL)',
        main: valid ? s : q.p,
        alts: valid ? [{ value: q.p, label: 'quadratische Lösung', ok: true }]
          : [{ value: s, label: 'einfache Näherung pH = ½(pKₛ₁ − lg c₀)', ok: false, note: 'Die einfache Näherung setzt voraus, dass nur ein kleiner Teil der Säure protolysiert. Hier sind es etwa ' + F.fmt(q.alpha * 100, 0) + ' % – die quadratische Lösung ist nötig.' }],
        approach: valid ? 'pH = ½(pKₛ − lg c₀)' : 'quadratischer Ansatz: Kₛ = x² / (c₀ − x), x = c(H₃O⁺)',
        given: dil, alpha: q.alpha, cGiven: c0,
      });
    } else {
      const pKb = lit.pKb;
      const q = weakQuadratic(pKb, c0);
      const s = weakSimple(pKb, c0);
      pts.push({
        key: 'start', v: 0, label: 'Startpunkt (V = 0 mL)',
        main: Chem.PKW - s, alts: [{ value: Chem.PKW - q.p, label: 'quadratische Lösung', ok: true }],
        approach: 'pOH = ½(pK_B − lg c₀), pH = pK_w − pOH', given: dil, alpha: q.alpha, cGiven: c0,
      });
    }

    if (exp.id === 'ammonia') {
      pts.push({ key: 'half1', v: eq[0] / 2, label: 'Halbäquivalenzpunkt', main: Chem.PKW - lit.pKb, alts: [], approach: 'pOH = pK_B → pH = pK_w − pK_B (= pKₛ(NH₄⁺))', given: '' });
    } else {
      for (let j = 1; j <= exp.stages; j++) {
        pts.push({ key: 'half' + j, v: Chem.halfVolume(exp, j), label: (exp.stages > 1 ? j + '. ' : '') + 'Halbäquivalenzpunkt', main: lit.pKs[j - 1], alts: [], approach: 'pH = pKₛ' + (exp.stages > 1 ? j : '') + ' (Henderson-Hasselbalch, c(HA) = c(A⁻))', given: '' });
      }
    }

    if (exp.id === 'acetic') {
      const cA = n / (v0 + eq[0]);
      const pKb = Chem.PKW - lit.pKs[0];
      pts.push({ key: 'eq1', v: eq[0], label: 'Äquivalenzpunkt', main: Chem.PKW - weakSimple(pKb, cA), alts: [], approach: 'Acetat als schwache Base: pK_B = pK_w − pKₛ, pOH = ½(pK_B − lg c(A⁻)), pH = pK_w − pOH', given: 'c(CH₃COO⁻) = n / V(gesamt) = ' + F.fmt(cA, 4) + ' mol/L bei V(gesamt) = ' + F.fmt(v0 + eq[0], 2) + ' mL' });
    } else if (exp.id === 'ammonia') {
      const cB = n / (v0 + eq[0]);
      pts.push({ key: 'eq1', v: eq[0], label: 'Äquivalenzpunkt', main: weakSimple(lit.pKs[0], cB), alts: [], approach: 'NH₄⁺ als schwache Säure: pH = ½(pKₛ(NH₄⁺) − lg c(NH₄⁺))', given: 'c(NH₄⁺) = n / V(gesamt) = ' + F.fmt(cB, 4) + ' mol/L bei V(gesamt) = ' + F.fmt(v0 + eq[0], 2) + ' mL' });
    } else {
      pts.push({ key: 'eq1', v: eq[0], label: '1. Äquivalenzpunkt (Ampholyt)', main: 0.5 * (lit.pKs[0] + lit.pKs[1]), alts: [], approach: 'Ampholyt: pH ≈ ½(pKₛ₁ + pKₛ₂), näherungsweise unabhängig von der Konzentration', given: exp.id === 'glycine' ? 'Am 1. ÄP liegt überwiegend das Zwitterion vor (isoelektrischer Punkt).' : 'Am 1. ÄP liegt überwiegend H₂PO₄⁻ vor.' });
    }
    pts.forEach(function (p) { p.model = Chem.phAt(exp, p.v); });
    return pts;
  }

  function checkTheoryPH(point, raw) {
    const r = readInput(raw, null);
    if (r.status !== 'number') return result(r.status, null, r.message);
    if (near(r.value, point.main, TOL.pHApprox)) return result('ok', r.value, 'Richtig (Näherungsrechnung).', 'calc');
    for (const a of point.alts) {
      if (near(r.value, a.value, TOL.pHApprox)) {
        return a.ok ? result('ok', r.value, 'Richtig (' + a.label + ').', 'calc')
          : result('approx', r.value, 'Rechnerisch richtig mit dem Ansatz „' + a.label + '“. ' + (a.note || ''), 'approx');
      }
    }
    if (point.key === 'start' && near(r.value, Chem.PKW - point.main, TOL.pHApprox)) {
      return result('wrong', r.value, 'Du hast pOH statt pH angegeben (oder umgekehrt).', 'calc');
    }
    return result('wrong', r.value, 'Ansatz prüfen: ' + point.approach + '.', 'calc');
  }

  // ------------------------------------------------------------ Rechnung 5: Abweichungen

  /** ΔpK = pK(exp) − pK(Lit) bzw. ΔpH = pH(gem) − pH(ber), mit Vorzeichen */
  function checkDifference(raw, a, b) {
    const r = readInput(raw, null);
    if (r.status !== 'number') return result(r.status, null, r.message);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return result('nobasis', r.value, 'Es fehlen noch Werte für die Differenz.');
    const d = a - b;
    if (near(r.value, d, TOL.pK)) return result('ok', r.value, 'Richtig (mit Vorzeichen).', 'calc');
    if (near(r.value, -d, TOL.pK) && Math.abs(d) > TOL.pK) return result('wrong', r.value, 'Vorzeichen vertauscht: Differenz = gemessen/experimentell − Referenz.', 'calc');
    if (Math.abs(b) > 1e-9 && near(r.value, (d / b) * 100, 0.6)) return result('wrong', r.value, 'pH- und pK-Werte sind logarithmische Größen: Gefragt ist die Differenz, keine Prozentangabe.', 'calc');
    return result('wrong', r.value, 'Differenz bilden: Wert − Referenzwert.', 'calc');
  }

  /** Absolute und relative Abweichung mit benannter Referenz (kein Teilen durch null) */
  function deviation(value, reference) {
    const abs = value - reference;
    const rel = Math.abs(reference) > 1e-12 ? (abs / reference) * 100 : null;
    return { abs: abs, rel: rel };
  }

  // ------------------------------------------------------------ Indikator

  /**
   * Eignung eines Indikators für den gewählten Äquivalenzpunkt: Volumenfehler
   * zwischen theoretischem Umschlag (Endpunkt-pH) und Äquivalenzvolumen.
   * Grenzen: ≤ 0,5 % geeignet, ≤ 3 % bedingt geeignet (Ablesung 0,02 mL bei
   * ca. 20 mL ≈ 0,1 %; übliche Schulgenauigkeit ≈ 0,5 %).
   */
  function indicatorSuitability(exp, indicatorId, stage) {
    const ind = Ind.get(indicatorId);
    if (ind.endpointPH === null) return { key: 'phmetric', label: 'pH-metrisch (ohne Indikator)', vEnd: null, error: null, rel: null };
    const vEq = Chem.equivalenceVolumes(exp)[stage - 1];
    const vEnd = Chem.volumeAtPH(exp, ind.endpointPH);
    if (vEnd === null) return { key: 'never', label: 'ungeeignet – Umschlag wird im Verlauf nicht erreicht', vEnd: null, error: null, rel: null };
    const err = vEnd - vEq;
    const rel = Math.abs(err / vEq) * 100;
    let key = 'unsuitable';
    let label = 'ungeeignet';
    if (rel <= 0.5) { key = 'suitable'; label = 'geeignet'; }
    else if (rel <= 3) { key = 'limited'; label = 'bedingt geeignet'; }
    return { key: key, label: label, vEnd: vEnd, error: err, rel: rel };
  }

  /**
   * Vertretbare qualitative Lagen des pH-Werts am Äquivalenzpunkt (für die
   * Planung): 'acidic' pH < 6,5 · 'neutral' 6,5–7,5 · 'basic' pH > 7,5.
   * Begründbar ohne pK-Zahlenwerte aus den Teilchen am ÄP (korrespondierende
   * Base bzw. Säure, Ampholyt).
   */
  function eqCategories(exp, stage) {
    const table = {
      acetic: [['basic']],
      ammonia: [['acidic']],
      phosphoric: [['acidic'], ['basic']],
      glycine: [['acidic', 'neutral'], ['basic']],
    };
    return table[exp.id][stage - 1];
  }

  // ------------------------------------------------------------ Kurvenwerkzeuge

  function sortPoints(points) {
    return (points || []).filter(function (p) { return Number.isFinite(p.v) && Number.isFinite(p.pH); })
      .slice().sort(function (a, b) { return a.v - b.v; });
  }

  /**
   * pH an der Stelle v aus Messpunkten. Gibt an, ob interpoliert wurde und
   * wie groß die Lücke der umgebenden Messpunkte ist.
   */
  function interpolate(points, v) {
    const pts = sortPoints(points);
    if (!pts.length) return null;
    if (v < pts[0].v - 1e-9 || v > pts[pts.length - 1].v + 1e-9) return { pH: null, outside: true, interpolated: false, gap: null };
    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i].v - v) < 0.005) return { pH: pts[i].pH, outside: false, interpolated: false, gap: 0, point: pts[i] };
    }
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].v >= v) {
        const a = pts[i - 1];
        const b = pts[i];
        const t = (v - a.v) / (b.v - a.v);
        return { pH: a.pH + t * (b.pH - a.pH), outside: false, interpolated: true, gap: b.v - a.v, bracket: [a, b] };
      }
    }
    return null;
  }

  /** Erste Ableitung ΔpH/ΔV zwischen benachbarten Messpunkten (ungleichmäßige Abstände) */
  function derivative(points) {
    const pts = sortPoints(points);
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const dv = pts[i].v - pts[i - 1].v;
      if (dv <= 1e-6) continue;
      out.push({ v: (pts[i].v + pts[i - 1].v) / 2, slope: (pts[i].pH - pts[i - 1].pH) / dv, dv: dv });
    }
    return out;
  }

  /** Datenlücke um v: Abstand der umgebenden Messpunkte > maxGap mL */
  function gapAt(points, v, maxGap) {
    const ip = interpolate(points, v);
    if (!ip || ip.outside) return { gap: true, reason: 'outside' };
    if (ip.interpolated && ip.gap > (maxGap || 1.0)) return { gap: true, reason: 'sparse', width: ip.gap };
    return { gap: false };
  }

  // ------------------------------------------------------------ Fehlerbetrachtung

  /**
   * Zerlegt die Abweichung eines experimentellen pK-Werts (nach Freigabe):
   *  Durchführung: Volumen nicht am HÄP + Ablesung vor Gleichgewicht
   *  Näherung/Modell: pH(Modell am HÄP) − pK(Modell)
   *  Rundung des Literaturwerts
   */
  function decompose(exp, task, point) {
    const sys = Chem.SYSTEMS[exp.system];
    const vHalf = Chem.halfVolume(exp, task.stage);
    const pHmodelAtPoint = Chem.phAt(exp, point.v);
    const pHmodelAtHalf = Chem.phAt(exp, vHalf);
    const pKaModel = sys.pKa[task.stage - 1];
    const toQuantity = function (pH) { return task.from === 'pOH' ? Chem.PKW - pH : pH; };
    const lit = literatureValue(exp, task.key);
    const modelValue = task.from === 'pOH' ? Chem.PKW - pKaModel : pKaModel;
    return {
      vHalf: vHalf,
      dV: point.v - vHalf,
      volumeEffect: toQuantity(pHmodelAtPoint) - toQuantity(pHmodelAtHalf),
      readingEffect: toQuantity(point.pH) - toQuantity(pHmodelAtPoint),
      approximation: toQuantity(pHmodelAtHalf) - modelValue,
      rounding: modelValue - lit,
      literature: lit,
    };
  }

  /** Mögliche Fehlerursachen; relevant wird aus den eigenen Daten bestimmt */
  const CAUSES = [
    { id: 'volume', group: 'Durchführung', text: 'Das Zielvolumen am Halbäquivalenzpunkt wurde nicht genau getroffen (zu viel oder zu wenig Maßlösung).' },
    { id: 'early', group: 'Durchführung', text: 'Der pH-Wert wurde abgelesen, bevor die Anzeige stabil war.' },
    { id: 'stir', group: 'Durchführung', text: 'Die Lösung war beim Ablesen nicht vollständig durchmischt (Rührer aus).' },
    { id: 'approx', group: 'Näherung/Modell', text: 'Die Gleichung pH = pKₛ gilt am stöchiometrischen HÄP nur näherungsweise (Protolyse der Säure selbst, Autoprotolyse, benachbarte Stufen).' },
    { id: 'activity', group: 'Näherung/Modell', text: 'Literaturwerte sind thermodynamische Werte (Aktivitäten, I = 0); gerechnet wird mit Konzentrationen.' },
    { id: 'titrant', group: 'Durchführung', text: 'Die Konzentration der Maßlösung war ungenau bekannt.' },
  ];

  /**
   * Relevanz der Ursachen für die eigene Messung.
   * @param {object[]} decomps Ergebnisse von decompose je pK-Aufgabe
   * @param {object[]} pointsUsed verwendete Messpunkte
   */
  function causeRelevance(decomps, pointsUsed) {
    const rel = {};
    const maxAbs = function (f) { return decomps.reduce(function (m, d) { return Math.max(m, Math.abs(f(d))); }, 0); };
    rel.volume = { relevant: maxAbs(function (d) { return d.dV; }) >= 0.05, why: 'größte Volumenabweichung vom HÄP: ' + F.fmt(maxAbs(function (d) { return d.dV; }), 2) + ' mL (Wirkung bis ' + F.fmt(maxAbs(function (d) { return d.volumeEffect; }), 2) + ' pH-Einheiten)' };
    const early = pointsUsed.some(function (p) { return !p.stable; });
    const unmixed = pointsUsed.some(function (p) { return p.homogeneous === false || p.stirred === false; });
    rel.early = { relevant: early, why: early ? 'mindestens ein verwendeter Wert war als „nicht stabil“ protokolliert' : 'alle verwendeten Werte waren stabil' };
    rel.stir = { relevant: unmixed, why: unmixed ? 'mindestens ein verwendeter Wert wurde ohne Rühren bzw. vor der Durchmischung abgelesen' : 'beim Ablesen war gerührt und durchmischt' };
    const ap = maxAbs(function (d) { return d.approximation; });
    rel.approx = { relevant: ap >= 0.03, why: 'Modellabweichung am stöchiometrischen HÄP: bis ' + F.fmt(ap, 2) + ' pH-Einheiten' };
    rel.activity = { relevant: false, real: true, why: 'in dieser Simulation nicht wirksam (das Modell rechnet ideal mit denselben Konstanten), im realen Labor aber eine wichtige Ursache' };
    rel.titrant = { relevant: false, why: 'in der Simulation ist c(Maßlösung) exakt; außerdem hängt der pH-Wert am HÄP kaum davon ab' };
    return rel;
  }

  const api = {
    TOL: TOL,
    pkTasks: pkTasks,
    literatureValue: literatureValue,
    checkEquivalenceVolume: checkEquivalenceVolume,
    checkHalfVolume: checkHalfVolume,
    checkReading: checkReading,
    checkConsumption: checkConsumption,
    checkMeasuredPH: checkMeasuredPH,
    checkPK: checkPK,
    theoryPoints: theoryPoints,
    checkTheoryPH: checkTheoryPH,
    checkDifference: checkDifference,
    deviation: deviation,
    indicatorSuitability: indicatorSuitability,
    eqCategories: eqCategories,
    interpolate: interpolate,
    derivative: derivative,
    gapAt: gapAt,
    decompose: decompose,
    CAUSES: CAUSES,
    causeRelevance: causeRelevance,
    weakQuadratic: weakQuadratic,
    weakSimple: weakSimple,
  };

  NS.Evaluation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
