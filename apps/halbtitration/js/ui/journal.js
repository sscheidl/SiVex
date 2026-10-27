/*
 * Laborjournal und Auswertung
 * --------------------------
 * Reihenfolge der Schülerrechnungen:
 *  1 V(ÄP) aus Stöchiometrie · 2 Auswertung des Erstdurchgangs an der Kurve
 *  3 Zielvolumen V(HÄP) · 4 pK aus der eigenen Messung → Abgabe
 *  danach Freigabe: 5 Literaturwerte und theoretische pH-Werte ·
 *  6 Abweichungen · 7 Fehlerbetrachtung
 * Vor der Abgabe erscheinen keine Literatur- oder Modellwerte – weder in
 * der Kurve noch im Bericht oder im Export.
 */
(function (global) {
  'use strict';

  const NS = global.Halbtitration;
  const Chem = NS.Chemistry;
  const Ind = NS.Indicators;
  const Ev = NS.Evaluation;
  const C = NS.Content;
  const F = NS.Format;
  const fmt = F.fmt;
  const signed = F.signed;
  const COLORS = NS.TitrationChart.COLORS;

  let A = null;
  let chart = null;
  let rerenderTimer = null;

  const MARKER_COLORS = { eq1: '#0f7a52', eq2: '#0f7a52', half1: '#7a3fc2', half2: '#7a3fc2' };

  function x() { return A.exp(); }
  function e() { return A.es(); }
  function released() { return !!e().submission; }

  function seriesById(id) { return e().series.find(function (s) { return s.id === id; }) || null; }
  function survey() { return seriesById(e().evalSurvey) || e().series.filter(function (s) { return s.kind === 'survey'; }).slice(-1)[0] || null; }
  function half() { return seriesById(e().evalHalf) || e().series.filter(function (s) { return s.kind === 'half'; }).slice(-1)[0] || null; }

  function num(id) {
    const f = e().fields[id];
    if (!f) return NaN;
    const p = F.parseQuantity(f.input, /^(veq|vhalf|read_|cons_)/.test(id) ? 'mL' : null);
    return p.ok ? p.value : NaN;
  }

  function markerInfo(key) {
    const v = e().markers[key];
    if (!Number.isFinite(v)) return null;
    const s = survey();
    const ip = s ? Ev.interpolate(s.points, v) : null;
    return { v: v, pH: ip ? ip.pH : null, ip: ip };
  }

  function markerLabel(key) {
    const st = x().stages;
    return { eq1: st > 1 ? 'ÄP 1' : 'ÄP', eq2: 'ÄP 2', half1: st > 1 ? 'HÄP 1' : 'HÄP', half2: 'HÄP 2' }[key];
  }

  // ------------------------------------------------------------ Rechenbasis Halbäquivalenz

  function basisValues(stage) {
    const b = e().basis['half' + stage];
    const m1 = e().markers.eq1;
    const m2 = e().markers.eq2;
    if (b === 'stoich') return { v1: num('veq1'), v2: num('veq2'), kind: 'stoich' };
    if (b === 'derived') return { v1: m1, v2: Number.isFinite(m1) ? 2 * m1 : NaN, kind: 'derived' };
    return { v1: m1, v2: m2, kind: 'measured' };
  }

  // ------------------------------------------------------------ Felder

  function task(key) { return Ev.pkTasks(x()).find(function (t) { return t.key === key; }); }
  function theoryPoint(key) { return Ev.theoryPoints(x()).find(function (p) { return p.key === key; }); }

  function halfPoints() { const s = half(); return s ? s.points : []; }

  function measuredAt(pointKey) {
    if (pointKey === 'start') {
      const s = survey() || half();
      const p = s && s.points.find(function (q) { return q.v === 0; });
      return p ? { pH: p.pH, source: 'gemessen (V = 0 mL, ' + A.seriesLabel(s) + ')', kind: 'meas' } : null;
    }
    if (/^half/.test(pointKey)) {
      const stage = Number(pointKey.slice(4));
      const pH = num('phhalf' + stage);
      return Number.isFinite(pH) ? { pH: pH, source: 'gemessen (Halbtitration)', kind: 'meas' } : null;
    }
    const mi = markerInfo('eq1');
    if (!mi || !Number.isFinite(mi.pH)) return null;
    return { pH: Math.round(mi.pH * 100) / 100, source: (mi.ip && mi.ip.interpolated ? 'interpoliert' : 'gemessen') + ' an deinem ÄP-Marker (' + fmt(mi.v, 2) + ' mL)', kind: mi.ip && mi.ip.interpolated ? 'int' : 'meas' };
  }

  function ownPK(key) { return num('pk_' + key); }

  function checkFor(id, raw) {
    const ex = x();
    let m;
    if ((m = /^veq(\d)$/.exec(id))) return Ev.checkEquivalenceVolume(ex, Number(m[1]), raw);
    if ((m = /^read_start_(.+)$/.exec(id))) {
      const s = seriesById(m[1]);
      const l = A.lab();
      const actual = s && s.startReading !== null ? s.startReading : (s && A.activeSeries() === s && l.burette.filled ? Math.round(l.burette.reading * 100) / 100 : NaN);
      return Ev.checkReading(raw, actual);
    }
    if ((m = /^read_end_(.+)$/.exec(id))) {
      const s = seriesById(m[1]);
      return Ev.checkReading(raw, s && s.endpoint ? s.endpoint.reading : NaN);
    }
    if ((m = /^cons_(.+)$/.exec(id))) return Ev.checkConsumption(raw, num('read_start_' + m[1]), num('read_end_' + m[1]));
    if ((m = /^vhalf(\d)$/.exec(id))) return Ev.checkHalfVolume(Number(m[1]), raw, basisValues(Number(m[1])));
    if ((m = /^phhalf(\d)$/.exec(id))) return Ev.checkMeasuredPH(raw, halfPoints(), num('vhalf' + m[1]));
    if ((m = /^pk_(.+)$/.exec(id))) {
      const t = task(m[1]);
      return Ev.checkPK(t, raw, num('phhalf' + t.stage));
    }
    if ((m = /^th_(.+)$/.exec(id))) return Ev.checkTheoryPH(theoryPoint(m[1]), raw);
    if ((m = /^dpk_(.+)$/.exec(id))) return Ev.checkDifference(raw, ownPK(m[1]), Ev.literatureValue(ex, m[1]));
    if ((m = /^dph_(.+)$/.exec(id))) {
      const ms = measuredAt(m[1]);
      return Ev.checkDifference(raw, ms ? ms.pH : NaN, num('th_' + m[1]));
    }
    return { status: 'invalid', message: 'Unbekanntes Feld.' };
  }

  function checkField(id) {
    const input = document.getElementById('f-' + id);
    const f = e().fields[id] = e().fields[id] || {};
    if (input) f.input = input.value;
    const r = checkFor(id, f.input || '');
    f.status = r.status;
    f.message = r.message;
    f.kind = r.kind;
    f.tries = (f.tries || 0) + (r.status === 'empty' ? 0 : 1);
    if (r.point) f.point = r.point;
    A.save();
    if (/^read_/.test(id) && A.state.view === 'lab') A.renderLab();
    else render();
    const el = document.querySelector('[data-field="' + id + '"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function hintContext(id) {
    let m;
    if ((m = /^vhalf(\d)$/.exec(id))) return { basis: basisValues(Number(m[1])) };
    if ((m = /^phhalf(\d)$/.exec(id))) {
      const f = e().fields[id];
      const target = num('vhalf' + m[1]);
      let point = f && f.point;
      if (!point) {
        const pts = halfPoints();
        if (pts.length && Number.isFinite(target)) point = pts.reduce(function (b, p) { return Math.abs(p.v - target) < Math.abs(b.v - target) ? p : b; });
      }
      return { point: point };
    }
    if ((m = /^pk_(.+)$/.exec(id))) { const t = task(m[1]); return { task: t, pH: num('phhalf' + t.stage) }; }
    if ((m = /^th_(.+)$/.exec(id))) return { point: theoryPoint(m[1]) };
    if ((m = /^dpk_(.+)$/.exec(id))) return { a: ownPK(m[1]), b: Ev.literatureValue(x(), m[1]) };
    if ((m = /^dph_(.+)$/.exec(id))) { const ms = measuredAt(m[1]); return { a: ms ? ms.pH : NaN, b: num('th_' + m[1]) }; }
    if ((m = /^read_start_(.+)$/.exec(id))) { const s = seriesById(m[1]); return { value: s && s.startReading !== null ? s.startReading : A.lab().burette.reading }; }
    if ((m = /^read_end_(.+)$/.exec(id))) { const s = seriesById(m[1]); return { value: s && s.endpoint ? s.endpoint.reading : NaN }; }
    if ((m = /^cons_(.+)$/.exec(id))) return { value: num('read_end_' + m[1]) - num('read_start_' + m[1]) };
    return {};
  }

  function hintsFor(id) { return C.hints(x(), id, hintContext(id)); }

  async function nextHint(id) {
    const h = e().hints;
    const f = e().fields[id] || {};
    if ((h[id] || 0) === 2 && !(f.tries > 0)) {
      if (!(await A.confirmBox('Musterrechnung anzeigen?', 'Die dritte Hilfe zeigt die vollständige Rechnung. Sie wird erst nach einem eigenen Versuch empfohlen. Trotzdem anzeigen?', 'Anzeigen'))) return;
    }
    h[id] = Math.min(3, (h[id] || 0) + 1);
    A.save();
    if (/^read_/.test(id) && A.state.view === 'lab') A.renderLab();
    else render();
  }

  // ------------------------------------------------------------ Kurve

  function ensureChart() {
    if (chart) return chart;
    chart = new NS.TitrationChart(document.getElementById('evalChart'), {
      onRead: function (p, s) {
        document.getElementById('evalFoot').innerHTML = '<strong>' + A.esc(s.label) + '</strong>: V = ' + fmt(p.v, 2) + ' mL · pH = ' + fmt(p.pH, 2) + ' ' + A.pointStatus(p);
      },
      onMarker: function (key, v) {
        e().markers[key] = v;
        A.save();
        updateChart();
        footForMarker(key);
        clearTimeout(rerenderTimer);
        rerenderTimer = setTimeout(renderJournal, 250);
      },
    });
    return chart;
  }

  function footForMarker(key) {
    const mi = markerInfo(key);
    const foot = document.getElementById('evalFoot');
    if (!mi) { foot.textContent = ''; return; }
    let t = '<strong>Marker ' + markerLabel(key) + '</strong>: V = ' + fmt(mi.v, 2) + ' mL';
    if (mi.ip && Number.isFinite(mi.ip.pH)) t += ' · pH ≈ ' + fmt(mi.ip.pH, 2) + (mi.ip.interpolated ? ' <span class="badge int">interpoliert</span>' : ' <span class="badge meas">Messpunkt</span>');
    const gap = gapNote(key);
    if (gap) t += ' · <span class="badge warn">' + gap + '</span>';
    foot.innerHTML = t;
  }

  function gapNote(key) {
    const mi = markerInfo(key);
    if (!mi) return '';
    const s = survey();
    if (!s) return 'keine Messreihe';
    const g = Ev.gapAt(s.points, mi.v, /^eq/.test(key) ? 0.5 : 1.0);
    if (!g.gap) return '';
    return g.reason === 'outside' ? 'außerhalb der Messwerte – Datenlücke' : 'Datenlücke: Messpunkte ' + fmt(g.width, 2) + ' mL auseinander';
  }

  function updateChart() {
    const c = ensureChart();
    const ex = x();
    const st = e();
    const markers = ['eq1', 'eq2', 'half1', 'half2'].filter(function (k) { return k[k.length - 1] <= String(ex.stages); }).map(function (k) {
      const mi = markerInfo(k);
      return { key: k, v: mi ? mi.v : NaN, pH: mi ? mi.pH : NaN, label: markerLabel(k), color: MARKER_COLORS[k], interpolated: mi && mi.ip && mi.ip.interpolated };
    });
    const s = survey();
    const activeId = evalActive || (s ? s.id : (half() ? half().id : null));
    const data = {
      series: A.seriesForChart(),
      activeId: activeId,
      current: null,
      markers: markers,
      endpoints: s && s.endpoint ? [{ v: s.endpoint.v, label: 'Endpunkt' }] : [],
      target: null,
      band: st.view.band ? A.indicatorBand(s ? s.indicator : st.plan.indicator) : null,
      xMode: st.view.xMode === 'data' ? 'data' : 'capacity',
      model: null, litLines: [], approxPoints: [],
    };
    if (released()) {
      if (st.view.model) data.model = Chem.curve(ex, Math.min(ex.capacity, Math.max(10, maxV() + 2)), 300);
      if (st.view.lit) {
        const lit = Chem.LITERATURE[ex.id];
        data.litLines = lit.pKs.slice(0, ex.id === 'phosphoric' ? 2 : lit.pKs.length).map(function (p, i) {
          const name = ex.id === 'ammonia' ? 'pKₛ(NH₄⁺) = ' : 'pKₛ' + (lit.pKs.length > 1 ? i + 1 : '') + ' = ';
          return { pH: p, label: name + fmt(p, 2) + ' (Literatur)' };
        });
      }
      if (st.view.approx) {
        data.approxPoints = Ev.theoryPoints(ex).map(function (p) { return { v: p.v, pH: p.main, label: p.label }; });
      }
    }
    c.setData(data);
    legend(data);
  }

  let evalActive = null;

  function maxV() {
    let m = 0;
    e().series.forEach(function (s) { s.points.forEach(function (p) { if (p.v > m) m = p.v; }); });
    return m;
  }

  function legend(d) {
    let h = '';
    const hasS = e().series.some(function (s) { return s.kind === 'survey'; });
    const hasH = e().series.some(function (s) { return s.kind === 'half'; });
    if (hasS) h += '<span><i class="dot" style="background:' + COLORS.s1 + '"></i>Messreihe Erstdurchgang</span>';
    if (hasH) h += '<span><i class="dot" style="background:' + COLORS.s2 + '"></i>Messreihe Halbtitration</span>';
    h += '<span><i class="dot" style="background:' + COLORS.pale + '"></i>nicht aktive Reihe</span><span><i class="ring" style="border-color:#555"></i>nicht stabil</span>';
    if (d.markers.some(function (m) { return Number.isFinite(m.v); })) h += '<span><i class="dash" style="border-color:#0f7a52"></i>eigene Marker (ÄP/HÄP)</span><span><i class="ring" style="border-color:#7a3fc2"></i>Interpolation am Marker (mit Querstrich)</span>';
    if (d.band) h += '<span><i class="dot" style="background:rgba(214,28,132,0.3);border-radius:2px"></i>Umschlagsbereich</span>';
    if (d.approxPoints.length) h += '<span><i class="dia" style="background:' + COLORS.approx + '"></i>Näherungsrechnung</span>';
    if (d.model) h += '<span><i class="dash" style="border-color:' + COLORS.model + '"></i>Modellreferenz</span>';
    if (d.litLines.length) h += '<span><i class="dash" style="border-color:' + COLORS.lit + '"></i>Literatur-pKₛ</span>';
    document.getElementById('evalLegend').innerHTML = h;
  }

  // ------------------------------------------------------------ Darstellung

  function render() {
    if (A.state.view !== 'eval') return;
    renderTools();
    renderData();
    renderJournal();
    updateChart();
  }

  function renderTools() {
    const ex = x();
    const st = e();
    const c = ensureChart();
    const opts = function (kind) {
      return st.series.filter(function (s) { return s.kind === kind; }).map(function (s) {
        const sel = (kind === 'survey' ? survey() : half()) === s;
        return '<option value="' + s.id + '"' + (sel ? ' selected' : '') + '>' + A.esc(A.seriesLabel(s)) + ' (' + s.points.length + ' P.)</option>';
      }).join('');
    };
    let h = '<select id="selSurvey" aria-label="Erstdurchgang für die Auswertung">' + (opts('survey') || '<option value="">kein Erstdurchgang</option>') + '</select>' +
      '<select id="selHalf" aria-label="Halbtitration für die Auswertung">' + (opts('half') || '<option value="">keine Halbtitration</option>') + '</select>';
    h += '<button type="button" class="mini' + (c.mode === 'read' ? ' on' : '') + '" data-action="cmode" data-mode="read">Ablesen</button>';
    ['eq1', 'eq2', 'half1', 'half2'].forEach(function (k) {
      if (Number(k.slice(-1)) > ex.stages) return;
      h += '<button type="button" class="mini' + (c.mode === 'marker' && c.activeMarker === k ? ' on' : '') + '" data-action="cmode" data-mode="marker" data-marker="' + k + '">Marker ' + markerLabel(k) + '</button>';
    });
    h += '<button type="button" class="mini" data-action="xmode" data-target="eval">' + (st.view.xMode === 'data' ? 'Messbereich' : '0–50 mL') + '</button>';
    h += '<label class="chk"><input type="checkbox" id="evBand"' + (st.view.band ? ' checked' : '') + '> Umschlag</label>';
    h += '<label class="chk"' + (released() ? '' : ' title="erst nach Abgabe des eigenen Ergebnisses"') + '><input type="checkbox" id="evModel"' + (st.view.model ? ' checked' : '') + (released() ? '' : ' disabled') + '> Modellreferenz</label>';
    h += '<label class="chk"><input type="checkbox" id="evLit"' + (st.view.lit ? ' checked' : '') + (released() ? '' : ' disabled') + '> Literatur-pK</label>';
    h += '<label class="chk"><input type="checkbox" id="evApprox"' + (st.view.approx ? ' checked' : '') + (released() ? '' : ' disabled') + '> Näherung</label>';
    if (c.mode === 'marker' && c.activeMarker) {
      const mi = markerInfo(c.activeMarker);
      h += '<span class="field" style="margin:0"><span class="in"><input type="text" inputmode="decimal" id="markerIn" aria-label="Marker-Volumen in mL" value="' + (mi ? fmt(mi.v, 2) : '') + '" style="width:90px;min-height:44px"><span class="unit">mL</span><button type="button" class="mini" data-action="marker-set">Setzen</button><button type="button" class="mini" data-action="marker-clear">Löschen</button></span></span>';
    }
    document.getElementById('evalTools').innerHTML = h;
    document.getElementById('evalChartSub').textContent = c.mode === 'marker' ? 'Antippen oder ziehen setzt den Marker; Pfeiltasten verschieben ihn um 0,05 mL (Umschalt: 0,5 mL).' : 'Antippen zeigt den nächsten Messpunkt der aktiven Reihe.';
  }

  function renderData() {
    const s1 = survey();
    const s2 = half();
    let h = '';
    [s1, s2].forEach(function (s) {
      if (!s) return;
      const der = Ev.derivative(s.points);
      h += '<h3 style="margin:4px 0;font-size:14px">' + A.esc(A.seriesLabel(s)) + (s.endpoint ? ' · Endpunkt bei ' + fmt(s.endpoint.v, 2) + ' mL' : '') + '</h3>';
      h += '<table class="mtable"><thead><tr><th>V / mL</th><th>pH</th><th class="l">Status</th><th>ΔpH/ΔV bis zum nächsten Punkt</th></tr></thead><tbody>';
      const pts = s.points.slice().sort(function (a, b) { return a.v - b.v; });
      pts.forEach(function (p, i) {
        const d = der.find(function (q) { return i + 1 < pts.length && Math.abs(q.v - (p.v + pts[i + 1].v) / 2) < 1e-9; });
        h += '<tr><td>' + fmt(p.v, 2) + '</td><td>' + fmt(p.pH, 2) + '</td><td class="l">' + A.pointStatus(p) + '</td><td>' + (d ? fmt(d.slope, 2) + ' mL⁻¹ (ΔV ' + fmt(d.dv, 2) + ')' : '') + '</td></tr>';
      });
      h += '</tbody></table>';
    });
    if (!h) h = '<p style="color:var(--ink-3)">Noch keine Messreihen. Im Labor entsteht zuerst der Erstdurchgang.</p>';
    else h += '<div class="actions"><button type="button" class="btn small" data-action="csv">Messdaten als CSV speichern</button></div>';
    document.getElementById('evalData').innerHTML = h;
  }

  function sec(n, title, intro, body, locked) {
    return '<section class="jsec' + (locked ? ' locked' : '') + '"><h2><span class="n">' + n + '</span>' + title + '</h2>' + (intro ? '<p class="intro">' + intro + '</p>' : '') + body + '</section>';
  }

  function renderJournal() {
    if (A.state.view !== 'eval') return;
    const ex = x();
    const st = e();
    const s1 = survey();
    const s2 = half();
    const tasks = Ev.pkTasks(ex);
    const field = A.fieldHtml;
    let h = '<div class="box"><h3>Laborjournal <small>Versuch ' + ex.no + ': ' + A.esc(ex.short) + '</small></h3><div class="kv">' +
      '<span>Probe</span><span>' + fmt(ex.vSample, 2) + ' mL, c = ' + fmt(ex.cSample, 3) + ' mol/L; verdünnt mit ' + fmt(ex.vWater, 0) + ' mL Wasser</span>' +
      '<span>Maßlösung</span><span>' + A.esc(Chem.TITRANTS[ex.titrant].formula) + ', c = 0,100 mol/L</span>' +
      '<span>Indikator</span><span>' + A.esc(Ind.get(st.plan.indicator || 'none').name) + (ex.stages > 1 ? ' für den ' + st.plan.stage + '. ÄP' : '') + '</span>' +
      '<span>Messreihen</span><span>' + (st.series.length ? st.series.map(function (s) { return A.esc(A.seriesLabel(s)) + ' (' + s.points.length + ')'; }).join(', ') : 'noch keine') + '</span></div></div>';

    // 1 Stöchiometrie
    let b = field('veq1', ex.stages > 1 ? 'V(ÄP,1)' : 'V(ÄP)', 'mL');
    if (ex.stages > 1) b += field('veq2', 'V(ÄP,2)', 'mL');
    h += sec(1, 'Äquivalenzvolumen aus der Stöchiometrie', 'Aus den bekannten Ausgangsmengen berechnen' + (ex.stages > 1 ? ' – stufenbezogen.' : '.'), b);

    // 2 Erstdurchgang
    b = '';
    if (!s1 || !s1.points.length) b += '<p class="fb info">Noch kein Erstdurchgang aufgenommen.</p>';
    else {
      ['eq1', 'eq2'].forEach(function (k) {
        if (Number(k.slice(-1)) > ex.stages) return;
        const mi = markerInfo(k);
        const gap = gapNote(k);
        b += '<div class="field"><label>' + markerLabel(k) + ' aus deiner Kurve</label>' + (mi
          ? '<div>V = <strong>' + fmt(mi.v, 2) + ' mL</strong>' + (Number.isFinite(mi.pH) ? ', pH ≈ ' + fmt(mi.pH, 2) + (mi.ip.interpolated ? ' <span class="badge int">interpoliert</span>' : '') : '') + ' <span class="badge meas">gemessen</span>' + (gap ? ' <span class="badge warn">' + gap + '</span>' : '') + '</div>'
          : '<div class="sub">Wähle oben „Marker ' + markerLabel(k) + '“ und setze ihn in die Mitte des steilen Anstiegs bzw. Abfalls' + (ex.id === 'glycine' && k === 'eq2' ? ' – falls dort kein deutlicher Sprung erkennbar ist, leitest du V(ÄP,2) später aus V(ÄP,1) ab.' : '.') + '</div>') + '</div>';
        const ref = Chem.equivalenceVolumes(ex)[Number(k.slice(-1)) - 1];
        if (mi && st.fields['veq' + k.slice(-1)] && st.fields['veq' + k.slice(-1)].status === 'ok') {
          const d = Ev.deviation(mi.v, ref);
          b += '<div class="fb info">Abweichung vom stöchiometrischen Wert: ΔV = ' + signed(d.abs, 2) + ' mL; relativ ' + signed(d.rel, 1) + ' % <span class="sub">(Referenz und Nenner: V(ÄP' + (ex.stages > 1 ? ',' + k.slice(-1) : '') + ') stöchiometrisch = ' + fmt(ref, 2) + ' mL)</span></div>';
        }
      });
      if (s1.endpoint) {
        b += '<h3 style="font-size:14px;margin:12px 0 4px">Endpunkt mit ' + A.esc(Ind.get(s1.indicator).name) + '</h3>';
        b += field('read_start_' + s1.id, 'Anfangsstand', 'mL', 'aus dem Labor übernommen') + field('read_end_' + s1.id, 'Endstand am Endpunkt', 'mL') + field('cons_' + s1.id, 'Verbrauch bis zum Endpunkt', 'mL');
        b += indicatorBox(s1);
      } else if (s1.indicator && s1.indicator !== 'none') {
        b += '<p class="fb warn">Für diese Messreihe ist kein Endpunkt notiert. Der Indikator lässt sich deshalb nur an der Kurve beurteilen.</p>' + indicatorBox(s1);
      } else {
        b += '<p class="fb info">PH-metrische Auswertung ohne Indikator: Den Äquivalenzpunkt liefert allein deine Kurve.</p>';
      }
    }
    h += sec(2, 'Erstdurchgang an der eigenen Kurve auswerten', 'Äquivalenzpunkt(e) als Marker setzen. Nicht jeder Wendepunkt ist ein Äquivalenzpunkt; ordne die Sprünge den Stufen zu.', b);

    // 3 Zielvolumen
    b = '';
    for (let j = 1; j <= ex.stages; j++) {
      const opts = [['measured', 'gemessen (eigene Kurve)'], ['stoich', 'stöchiometrisch (Rechnung 1)']];
      if (j === 2) opts.splice(1, 0, ['derived', 'V(ÄP,1) gemessen, V(ÄP,2) = 2 · V(ÄP,1) abgeleitet']);
      b += '<div class="field"><label for="basis' + j + '">Rechenbasis für ' + markerLabel('half' + j) + '</label><select id="basis' + j + '" data-basis="half' + j + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (st.basis['half' + j] === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
      const bv = basisValues(j);
      b += '<div class="sub">' + basisText(j, bv) + '</div></div>';
      b += field('vhalf' + j, 'V(' + markerLabel('half' + j) + ') – Zielvolumen', 'mL');
    }
    h += sec(3, 'Zielvolumen der Halbtitration berechnen', 'Mit dem berechneten Volumen dosierst du im zweiten Durchgang selbst bis zum Halbäquivalenzpunkt (Zielmarke im Labor setzen).', b);

    // 4 pK
    b = '';
    if (!s2 || !s2.points.length) b += '<p class="fb info">Noch keine Halbtitration aufgenommen. Setze im Labor eine frische Probe für die Halbtitration an.</p>';
    for (let j = 1; j <= ex.stages; j++) b += field('phhalf' + j, 'pH am ' + markerLabel('half' + j) + ' (gemessen)', '', 'protokollierter Wert aus ' + (s2 ? A.esc(A.seriesLabel(s2)) : 'der Halbtitration'));
    tasks.forEach(function (t) {
      const sub = st.submission && Number.isFinite(st.submission.values[t.key]) ? 'abgegeben: ' + fmt(st.submission.values[t.key], 2) + (Number.isFinite(ownPK(t.key)) && Math.abs(ownPK(t.key) - st.submission.values[t.key]) > 0.0049 ? ' · aktuell korrigiert' : '') : '';
      b += field('pk_' + t.key, t.html + ' (experimentell)', '', sub);
    });
    if (!released()) b += '<div class="actions"><button type="button" class="btn primary" data-action="submit">Ergebnis abgeben und Literaturwerte freischalten</button></div>';
    else b += '<p class="fb ok">Abgegeben am ' + new Date(st.submission.at).toLocaleString('de-DE') + '. Korrekturen sind möglich; der ursprüngliche Wert bleibt zum Vergleich erhalten.</p>';
    h += sec(4, 'pK-Wert aus der eigenen Messung', ex.id === 'ammonia' ? 'Am HÄP gilt pOH ≈ pK_B und pH ≈ pKₛ(NH₄⁺) – zwei verschiedene Größen.' : (ex.id === 'glycine' ? 'Beide Glycinwerte sind pKₛ-Werte.' : 'Am HÄP gilt pH ≈ pKₛ der betrachteten Stufe.'), b);

    // 5–7 nach Freigabe
    if (!released()) {
      h += sec(5, 'Literaturwerte und theoretische pH-Werte', 'Wird nach der Abgabe deines experimentellen Ergebnisses freigeschaltet.', '', true);
      h += sec(6, 'Abweichungen', '', '', true);
      h += sec(7, 'Fehlerbetrachtung', '', '', true);
    } else {
      h += releasedSections();
    }
    h += '<div class="actions"><button type="button" class="btn" data-action="notebook">Hefteintrag anzeigen</button><button type="button" class="btn" data-action="report">Bericht drucken / als PDF</button></div>';
    const j = document.getElementById('journal');
    const scroll = j.scrollTop;
    j.innerHTML = A.subs(h);
    j.scrollTop = scroll;
  }

  function basisText(j, bv) {
    const f = function (v) { return Number.isFinite(v) ? fmt(v, 2) + ' mL' : '–'; };
    if (j === 1) return 'V(ÄP,1) = ' + f(bv.v1) + (bv.kind === 'stoich' ? ' (Rechnung 1)' : ' (Marker)');
    return 'V(ÄP,1) = ' + f(bv.v1) + ', V(ÄP,2) = ' + f(bv.v2) + ' ' + (bv.kind === 'derived' ? '<span class="badge der">abgeleitet</span>' : bv.kind === 'stoich' ? '<span class="badge">stöchiometrisch</span>' : '<span class="badge meas">gemessen</span>');
  }

  function indicatorBox(s) {
    const ex = x();
    const st = e();
    const stage = ex.stages > 1 ? st.plan.stage : 1;
    const ind = Ind.get(s.indicator);
    let h = '<div class="fb info"><strong>Indikatorprüfung (' + A.esc(ind.name) + ', ' + stage + '. ÄP):</strong> ';
    const mi = markerInfo('eq' + stage);
    if (s.endpoint && mi) {
      const d = s.endpoint.v - mi.v;
      h += 'Endpunkt − eigener ÄP-Marker = ' + signed(d, 2) + ' mL (aus deinen Daten). ';
    } else if (s.endpoint) h += 'Setze den ÄP-Marker, um Endpunkt und Äquivalenzpunkt deiner Kurve zu vergleichen. ';
    const f = st.fields['veq' + stage];
    if ((f && f.status === 'ok') || released()) {
      const r = Ev.indicatorSuitability(ex, ind.id, stage);
      if (r.key === 'phmetric') h += '';
      else if (r.vEnd === null) h += 'Rechnerisch wird der Umschlag (pH ≈ ' + fmt(ind.endpointPH, 1) + ') im Verlauf nicht erreicht → ungeeignet.';
      else h += 'Rechnerischer Umschlag (pH ≈ ' + fmt(ind.endpointPH, 1) + ') bei V ≈ ' + fmt(r.vEnd, 2) + ' mL; Indikatorfehler ' + signed(r.error, 2) + ' mL (' + fmt(r.rel, 1) + ' % von V(ÄP)) → <strong>' + r.label + '</strong>. ' + (r.key === 'unsuitable' ? 'Der Umschlag liegt nicht im steilen Abschnitt am gewählten ÄP. Für die pK-Bestimmung genügt die pH-Elektrode.' : '');
    } else h += 'Die rechnerische Bewertung erscheint, sobald Rechnung 1 (V(ÄP)) richtig ist.';
    return h + '</div>';
  }

  function releasedSections() {
    const ex = x();
    const st = e();
    const lit = Chem.LITERATURE[ex.id];
    const field = A.fieldHtml;
    const tasks = Ev.pkTasks(ex);
    let b = '<table class="data"><thead><tr><th>Größe</th><th>Literaturwert</th></tr></thead><tbody>';
    if (ex.id === 'ammonia') b += '<tr><td>pKₛ(NH₄⁺)</td><td class="num">' + fmt(lit.pKs[0], 2) + '</td></tr><tr><td>pK_B(NH₃) = 14,00 − pKₛ(NH₄⁺)</td><td class="num">' + fmt(lit.pKb, 2) + '</td></tr>';
    else lit.pKs.forEach(function (p, i) { b += '<tr><td>pKₛ' + (lit.pKs.length > 1 ? i + 1 : '') + (ex.id === 'phosphoric' && i === 2 ? ' (3. Stufe, nicht ausgewertet)' : '') + '</td><td class="num">' + fmt(p, 2) + '</td></tr>'; });
    b += '</tbody></table><p class="sub" style="font-size:12.5px;color:var(--ink-2)">Quelle: ' + A.esc(Chem.LITERATURE.source) + '. Bedingungen: ' + A.esc(Chem.LITERATURE.conditions) + '. pK_W = 14,00 (Modellannahme). Ein Literatur-pKₛ in einer pH-Rechnung ist eine Vorhersagegrundlage, keine zweite pK-Bestimmung.</p>';
    b += '<h3 style="font-size:14px;margin:10px 0 4px">Theoretische pH-Werte (Näherungsrechnung)</h3>';
    Ev.theoryPoints(ex).forEach(function (p) {
      b += field('th_' + p.key, 'pH am ' + p.label + ' (berechnet)', '', p.given ? A.esc(p.given) : '');
      const f = st.fields['th_' + p.key];
      if (f && (f.status === 'ok' || f.status === 'approx')) {
        b += '<div class="fb info">Modellreferenz (numerische Gleichgewichtsrechnung) bei V = ' + fmt(p.v, 2) + ' mL: pH = ' + fmt(p.model, 2) + ' · Abweichung Näherung − Modell: ' + signed(p.main - p.model, 2) + '</div>';
      }
    });
    let h = sec(5, 'Literaturwerte und theoretische pH-Werte', 'Berechne mit den Literaturwerten die pH-Werte an den charakteristischen Punkten. Verdünnung und Anfangsdissoziation beachten.', b);

    // Abweichungen
    b = '<h3 style="font-size:14px;margin:4px 0">pK-Werte</h3>';
    tasks.forEach(function (t) {
      const orig = st.submission.values[t.key];
      b += field('dpk_' + t.key, 'ΔpK für ' + t.html + ' = pK(exp.) − pK(Lit.)', '', 'pK(exp.) = ' + fmt(ownPK(t.key), 2) + (Number.isFinite(orig) && Math.abs(orig - ownPK(t.key)) > 0.0049 ? ' (ursprünglich ' + fmt(orig, 2) + ')' : '') + ', pK(Lit.) = ' + fmt(Ev.literatureValue(ex, t.key), 2));
    });
    b += '<h3 style="font-size:14px;margin:10px 0 4px">pH-Werte: gemessen − berechnet</h3>';
    Ev.theoryPoints(ex).forEach(function (p) {
      const ms = measuredAt(p.key);
      const th = num('th_' + p.key);
      if (!ms) { b += '<p class="fb warn">' + p.label + ': kein Messwert vorhanden (Datenlücke) – keine Differenz möglich.</p>'; return; }
      b += field('dph_' + p.key, 'ΔpH am ' + p.label, '', 'pH(gem.) = ' + fmt(ms.pH, 2) + ' <span class="badge ' + ms.kind + '">' + A.esc(ms.source) + '</span>, pH(ber.) = ' + (Number.isFinite(th) ? fmt(th, 2) : '–'));
    });
    b += decompositionHtml();
    h += sec(6, 'Abweichungen', 'Differenzen mit Vorzeichen; pH- und pK-Werte sind logarithmisch, deshalb keine Prozentangaben.', b);

    // Fehlerbetrachtung
    const rf = st.reflection;
    const rel = relevance();
    b = '<p class="intro">Welche Ursachen erklären die Abweichung deines pK-Werts vom Literaturwert? Kreuze alles Zutreffende an.</p>';
    Ev.CAUSES.forEach(function (c) {
      const on = rf.causes.indexOf(c.id) >= 0;
      let cls = '';
      let note = '';
      if (rf.checked && rel) {
        const r = rel[c.id];
        // Reale, in der Simulation nicht wirksame Ursache: Ankreuzen ist vertretbar, Weglassen kein Fehler
        if (r.real) { cls = on ? ' is-ok' : ''; note = r.why; }
        else if (on && r.relevant) cls = ' is-ok';
        else if (on && !r.relevant) { cls = ' is-bad'; note = 'trifft hier nicht zu: ' + r.why; }
        else if (!on && r.relevant) { cls = ' is-miss'; note = 'fehlt: ' + r.why; }
        else if (r.real) note = r.why;
      }
      b += '<label class="opt' + cls + '"><input type="checkbox" name="cause" value="' + c.id + '"' + (on ? ' checked' : '') + '> <span><span class="badge">' + c.group + '</span> ' + A.esc(c.text) + (note ? '<br><small>' + A.esc(note) + '</small>' : '') + '</span></label>';
    });
    b += '<div class="actions"><button type="button" class="btn primary" data-action="causes-check"' + (rel ? '' : ' disabled') + '>Auswahl prüfen</button></div>' + (rel ? '' : '<p class="fb warn">Für die Prüfung braucht es geprüfte pH-Werte der Halbtitration (Rechnung 4).</p>');
    b += '<div class="field"><label for="reflText">Eigene Begründung (wird nicht automatisch bewertet)</label><textarea id="reflText">' + A.esc(rf.text) + '</textarea></div>';
    h += sec(7, 'Fehlerbetrachtung', 'Unterscheide Durchführungs-/Messfehler, Rechenfehler und Abweichungen durch Näherung oder Modellgrenze.', b);
    return h;
  }

  function usedPoints() {
    const ex = x();
    const out = [];
    for (let j = 1; j <= ex.stages; j++) {
      const f = e().fields['phhalf' + j];
      if (f && f.point) out.push({ stage: j, point: f.point });
    }
    return out;
  }

  function decompositions() {
    const ex = x();
    const used = usedPoints();
    return Ev.pkTasks(ex).map(function (t) {
      const u = used.find(function (q) { return q.stage === t.stage; });
      return u ? { task: t, d: Ev.decompose(ex, t, u.point), point: u.point } : null;
    }).filter(Boolean);
  }

  function relevance() {
    const ds = decompositions();
    if (!ds.length) return null;
    return Ev.causeRelevance(ds.map(function (q) { return q.d; }), ds.map(function (q) { return q.point; }));
  }

  function decompositionHtml() {
    const ds = decompositions();
    if (!ds.length) return '';
    let h = '<h3 style="font-size:14px;margin:10px 0 4px">Woher kommt die Abweichung? (Modellanalyse)</h3><table class="data"><thead><tr><th>Größe</th><th>Durchführung: Volumen</th><th>Durchführung: Ablesung</th><th>Näherung/Modell</th><th>Rundung Lit.</th></tr></thead><tbody>';
    ds.forEach(function (q) {
      h += '<tr><td>' + q.task.html + '<br><small>Messpunkt ' + fmt(q.point.v, 2) + ' mL statt ' + fmt(q.d.vHalf, 2) + ' mL</small></td><td class="num">' + signed(q.d.volumeEffect, 2) + '</td><td class="num">' + signed(q.d.readingEffect, 2) + '</td><td class="num">' + signed(q.d.approximation, 2) + '</td><td class="num">' + signed(q.d.rounding, 2) + '</td></tr>';
    });
    h += '</tbody></table><p class="sub" style="font-size:12.5px;color:var(--ink-2)">Die Summe ergibt die Abweichung des gemessenen Werts vom Literaturwert. Volumen: anderes Volumen als der stöchiometrische HÄP; Ablesung: Wert vor Gleichgewicht bzw. Durchmischung; Näherung: Modell-pH am exakten HÄP − Modell-pK (Protolyse der Säure, Autoprotolyse, Nachbarstufen). Rechenfehler sind hier nicht enthalten.</p>';
    return h;
  }

  // ------------------------------------------------------------ Aktionen

  async function onAction(btn) {
    const a = btn.dataset.action;
    const c = ensureChart();
    switch (a) {
      case 'cmode':
        c.mode = btn.dataset.mode;
        c.activeMarker = btn.dataset.marker || null;
        if (c.mode === 'read') evalActive = null;
        renderTools();
        updateChart();
        if (c.activeMarker) footForMarker(c.activeMarker);
        document.getElementById('evalChart').focus();
        break;
      case 'marker-set': {
        const p = F.parseQuantity(document.getElementById('markerIn').value, 'mL');
        if (!p.ok) { A.toast(p.message || 'Bitte ein Volumen eingeben.', 'warn'); return; }
        e().markers[c.activeMarker] = Math.max(0, Math.min(50, p.value));
        A.save();
        render();
        footForMarker(c.activeMarker);
        break;
      }
      case 'marker-clear':
        delete e().markers[c.activeMarker];
        A.save();
        render();
        break;
      case 'submit': await submit(); break;
      case 'causes-check': {
        const rf = e().reflection;
        rf.causes = Array.prototype.slice.call(document.querySelectorAll('input[name="cause"]:checked')).map(function (i) { return i.value; });
        rf.checked = true;
        A.save();
        renderJournal();
        break;
      }
      case 'csv': csv(); break;
      default: break;
    }
  }

  function onChange(ev) {
    const t = ev.target;
    const st = e();
    if (t.id === 'selSurvey') { st.evalSurvey = t.value || null; A.save(); render(); }
    else if (t.id === 'selHalf') { st.evalHalf = t.value || null; A.save(); render(); }
    else if (t.dataset && t.dataset.basis) { st.basis[t.dataset.basis] = t.value; A.save(); renderJournal(); }
    else if (t.id === 'evBand') { st.view.band = t.checked; A.save(); updateChart(); }
    else if (t.id === 'evModel') { st.view.model = t.checked; A.save(); updateChart(); }
    else if (t.id === 'evLit') { st.view.lit = t.checked; A.save(); updateChart(); }
    else if (t.id === 'evApprox') { st.view.approx = t.checked; A.save(); updateChart(); }
    else if (t.id === 'reflText') { st.reflection.text = t.value; A.save(); }
    else if (t.name === 'cause') { st.reflection.causes = Array.prototype.slice.call(document.querySelectorAll('input[name="cause"]:checked')).map(function (i) { return i.value; }); A.save(); }
  }

  async function submit() {
    const ex = x();
    const st = e();
    const tasks = Ev.pkTasks(ex);
    // aktuelle Eingaben übernehmen
    tasks.forEach(function (t) { const el = document.getElementById('f-pk_' + t.key); if (el) (st.fields['pk_' + t.key] = st.fields['pk_' + t.key] || {}).input = el.value; });
    const missing = tasks.filter(function (t) { return !Number.isFinite(ownPK(t.key)); });
    if (missing.length) { A.toast('Trage zuerst alle experimentellen pK-Werte ein: ' + missing.map(function (t) { return t.label; }).join(', ') + '.', 'warn', 5000); return; }
    tasks.forEach(function (t) { if (!st.fields['pk_' + t.key].status || st.fields['pk_' + t.key].status === 'empty') checkSilently('pk_' + t.key); });
    for (let j = 1; j <= ex.stages; j++) if (st.fields['phhalf' + j] && !st.fields['phhalf' + j].tries) checkSilently('phhalf' + j);
    const wrong = tasks.filter(function (t) { return st.fields['pk_' + t.key].status !== 'ok'; });
    let text = 'Nach der Abgabe werden Literaturwerte, Modellreferenz und Näherungswerte sichtbar. Deine abgegebenen Werte bleiben als „ursprünglicher Versuchswert“ gespeichert.';
    if (wrong.length) text = '<strong>Achtung:</strong> Mindestens eine pK-Rechnung passt noch nicht zu deinem gemessenen pH-Wert. ' + text;
    if (!(await A.confirmBox('Ergebnis abgeben?', text, 'Abgeben'))) { renderJournal(); return; }
    const values = {};
    const pH = {};
    tasks.forEach(function (t) { values[t.key] = ownPK(t.key); });
    for (let j = 1; j <= ex.stages; j++) pH[j] = num('phhalf' + j);
    st.submission = { at: Date.now(), values: values, pH: pH };
    A.save(true);
    render();
    A.toast('Ergebnis abgegeben – Literaturwerte freigeschaltet.', 'ok');
  }

  function checkSilently(id) {
    const f = e().fields[id];
    if (!f) return;
    const r = checkFor(id, f.input || '');
    Object.assign(f, { status: r.status, message: r.message, kind: r.kind, tries: (f.tries || 0) + 1 });
    if (r.point) f.point = r.point;
  }

  // ------------------------------------------------------------ Export und Bericht

  function csvText() {
    const ex = x();
    const rows = ['Versuch;Messreihe;Zweck;V(Maßlösung) / mL;pH;Status;Indikator;Endpunkt V / mL'];
    e().series.forEach(function (s) {
      s.points.forEach(function (p) {
        rows.push([ex.title, s.no, s.kind === 'survey' ? 'Erstdurchgang' : 'Halbtitration', fmt(p.v, 2), fmt(p.pH, 2), p.stable && p.homogeneous !== false ? 'stabil' : 'nicht stabil', Ind.get(s.indicator).name, s.endpoint ? fmt(s.endpoint.v, 2) : ''].join(';'));
      });
    });
    return rows.join('\r\n') + '\r\n';
  }

  function csv() {
    try {
      const blob = new Blob(['﻿' + csvText()], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'halbtitration-' + x().id + '-messdaten.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (err) {
      A.toast('Export nicht möglich: ' + err.message, 'bad');
    }
  }

  function fieldLabel(id) {
    const ex = x();
    let m;
    if ((m = /^veq(\d)$/.exec(id))) return 'V(ÄP' + (ex.stages > 1 ? ',' + m[1] : '') + ') stöchiometrisch';
    if ((m = /^vhalf(\d)$/.exec(id))) return 'Zielvolumen ' + markerLabel('half' + m[1]);
    if ((m = /^phhalf(\d)$/.exec(id))) return 'pH am ' + markerLabel('half' + m[1]) + ' (gemessen)';
    if ((m = /^pk_(.+)$/.exec(id))) return task(m[1]).label + ' (experimentell)';
    if ((m = /^th_(.+)$/.exec(id))) return 'pH berechnet: ' + theoryPoint(m[1]).label;
    if ((m = /^dpk_(.+)$/.exec(id))) return 'ΔpK ' + task(m[1]).label;
    if ((m = /^dph_(.+)$/.exec(id))) return 'ΔpH ' + theoryPoint(m[1]).label;
    if ((m = /^read_start_(.+)$/.exec(id))) return 'Anfangsstand ' + m[1];
    if ((m = /^read_end_(.+)$/.exec(id))) return 'Endstand am Endpunkt ' + m[1];
    if ((m = /^cons_(.+)$/.exec(id))) return 'Verbrauch bis Endpunkt ' + m[1];
    return id;
  }

  function report() {
    const ex = x();
    const st = e();
    const esc = A.esc;
    const wasView = A.state.view;
    // Kurvenbild aus der Auswertungsansicht erzeugen (gleiche Freigaberegeln wie am Bildschirm)
    let img = '';
    try {
      if (wasView !== 'eval') A.setView('eval');
      updateChart();
      chart.draw(true);
      img = document.getElementById('evalChart').toDataURL('image/png');
    } catch (err) { img = ''; }
    let h = '<h1>Laborbericht · Halbtitration</h1><p>Versuch ' + ex.no + ': ' + esc(ex.short) + ' · erstellt am ' + new Date().toLocaleString('de-DE') + ' · Halbtitrationslabor (SiVex)</p>';
    h += '<section><h2>Planung</h2><p>Probe: ' + fmt(ex.vSample, 2) + ' mL ' + esc(ex.sampleName) + ', c = ' + fmt(ex.cSample, 3) + ' mol/L, verdünnt mit ' + fmt(ex.vWater, 0) + ' mL Wasser. Maßlösung: ' + esc(Chem.TITRANTS[ex.titrant].formula) + ', 0,100 mol/L. Indikator: ' + esc(Ind.get(st.plan.indicator || 'none').name) + (ex.stages > 1 ? ' (für den ' + st.plan.stage + '. ÄP)' : '') + '.</p></section>';
    if (img) h += '<section><h2>Titrationskurve</h2><img src="' + img + '" alt="Titrationskurve"></section>';
    h += '<section><h2>Messdaten</h2><div class="cols2">';
    st.series.forEach(function (s) {
      h += '<p><strong>' + esc(A.seriesLabel(s)) + '</strong>' + (s.endpoint ? ' – Endpunkt bei ' + fmt(s.endpoint.v, 2) + ' mL' : '') + '</p><table><tr><th>V / mL</th><th>pH</th><th>Status</th></tr>' + s.points.map(function (p) { return '<tr><td>' + fmt(p.v, 2) + '</td><td>' + fmt(p.pH, 2) + '</td><td>' + (p.stable && p.homogeneous !== false ? 'stabil' : 'nicht stabil') + '</td></tr>'; }).join('') + '</table>';
    });
    h += '</div></section><section><h2>Marker an der Kurve</h2><table><tr><th>Marker</th><th>V / mL</th><th>pH</th></tr>';
    ['eq1', 'eq2', 'half1', 'half2'].forEach(function (k) {
      const mi = markerInfo(k);
      if (mi) h += '<tr><td>' + markerLabel(k) + '</td><td>' + fmt(mi.v, 2) + '</td><td>' + (Number.isFinite(mi.pH) ? fmt(mi.pH, 2) + (mi.ip.interpolated ? ' (interpoliert)' : '') : '–') + '</td></tr>';
    });
    h += '</table></section><section><h2>Rechnungen</h2><table><tr><th>Größe</th><th>Eingabe</th><th>Prüfung</th></tr>';
    Object.keys(st.fields).forEach(function (id) {
      const f = st.fields[id];
      if (!f || !f.input) return;
      if (!released() && /^(th_|dpk_|dph_)/.test(id)) return;
      h += '<tr><td>' + esc(fieldLabel(id)) + '</td><td>' + esc(f.input) + '</td><td>' + esc(statusText(f)) + '</td></tr>';
    });
    h += '</table></section>';
    if (released()) {
      const lit = Chem.LITERATURE[ex.id];
      h += '<section><h2>Freigegebene Referenzen</h2><p>Literatur: ' + (ex.id === 'ammonia' ? 'pKₛ(NH₄⁺) = ' + fmt(lit.pKs[0], 2) + ', pK_B(NH₃) = ' + fmt(lit.pKb, 2) : lit.pKs.map(function (p, i) { return 'pKₛ' + (lit.pKs.length > 1 ? i + 1 : '') + ' = ' + fmt(p, 2); }).join(', ')) + '. Quelle: ' + esc(Chem.LITERATURE.source) + ' (' + esc(Chem.LITERATURE.conditions) + ').</p><p>Abgegebene Werte: ' + Ev.pkTasks(ex).map(function (t) { return esc(t.label) + ' = ' + fmt(st.submission.values[t.key], 2); }).join(', ') + '.</p></section>';
      h += '<section><h2>Fehlerbetrachtung</h2><ul>' + st.reflection.causes.map(function (c) { return '<li>' + esc(Ev.CAUSES.find(function (q) { return q.id === c; }).text) + '</li>'; }).join('') + '</ul><p>' + esc(st.reflection.text) + '</p></section>';
    } else {
      h += '<section><h2>Referenzen</h2><p>Literaturwerte und Modellreferenz sind noch nicht freigegeben (Ergebnis noch nicht abgegeben).</p></section>';
    }
    document.getElementById('report').innerHTML = A.subs(h);
    if (wasView !== 'eval') A.setView(wasView);
    setTimeout(function () { global.print(); }, 60);
  }

  function statusText(f) {
    return { ok: 'richtig', wrong: 'falsch', approx: 'Näherung außerhalb der Gültigkeit', 'measured-note': 'Messwert mit Hinweis', invalid: 'ungültig', nobasis: 'Basis fehlt', gap: 'Datenlücke' }[f.status] || 'nicht geprüft';
  }

  function frame() { if (chart) chart.draw(); }

  NS.Journal = {
    init: function (app) { A = app; },
    render: render,
    frame: frame,
    checkField: checkField,
    nextHint: nextHint,
    hintsFor: hintsFor,
    onAction: onAction,
    onChange: onChange,
    report: report,
    csvText: csvText,
    chart: function () { return chart; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
