/*
 * Experimentsteuerung: eine Probe am Titrierstand
 * ----------------------------------------------
 * Bürette mit Hahn, Tropfenbildung, fallende Tropfen (Bürettenteil aus
 * TitraLab 3 übernommen), dazu Probenvorbereitung, Durchmischung,
 * pH-Elektrode mit Ansprechzeit und Kalibrierung. Kein DOM-Code.
 *
 * Volumenbuchhaltung (mL):
 *   dispensed – aus der Bürette in diese Probe abgegeben (Grundlage der x-Achse)
 *   hanging   – Tropfen an der Bürettenspitze
 *   drops     – fallende Tropfen
 *   delivered – in der Lösung angekommen
 *   unmixed   – angekommen, aber noch nicht mit der Lösung am Sensor vermischt
 * Stets gilt dispensed = delivered + hanging + Σ drops.
 * reading – Bürettenstand (Meniskus); wächst mit jeder Abgabe um dasselbe
 * Volumen; Nachfüllen senkt nur den Stand, nicht dispensed (keine Sprünge).
 *
 * Messkette: Die Elektrode sieht den vermischten Teil der Lösung
 * (Zusammensetzung bei delivered − unmixed). Die Anzeige folgt diesem Wert
 * mit einer Ansprechzeit (Verzögerung 1. Ordnung). „Stabil“ meldet das
 * Gerät wie ein reales pH-Meter über die Drift der Anzeige.
 */
(function (global) {
  'use strict';

  const NS = (global.Halbtitration = global.Halbtitration || {});
  if (!NS.Chemistry && typeof require === 'function') require('../model/chemistry.js');
  const Chem = NS.Chemistry;

  const EPS = 1e-9;

  const DEFAULTS = {
    capacity: 50, // mL Skala der Bürette
    dropVolume: 0.05, // mL je Tropfen
    minFlow: 0.01, // mL/s
    maxFlow: 1.0, // mL/s (Hahn ganz offen)
    releaseDelay: 0.22, // s bis ein Resttropfen abfällt
    fallTime: 0.3, // s, wird von der Grafik aus der Fallhöhe gesetzt
    mixTauStirred: 1.0, // s Mischzeit mit Rührer
    mixTauStill: 45, // s Mischzeit ohne Rührer (Konvektion, Diffusion)
    sensorTau: 2.2, // s Ansprechzeit der Glaselektrode
    driftLimit: 0.004, // pH/s: darunter gilt die Anzeige als ruhig
    stableHold: 2.0, // s ruhige Anzeige bis „stabil“
    pipetteTime: 2.4, // s Pipettieren
    waterTime: 1.8, // s Wasser zugeben
  };

  /** Fließgeschwindigkeit für eine Einzelzugabe: kleine Mengen langsam, große zügig */
  function stepRate(volume) {
    return Math.min(0.8, Math.max(0.1, volume * 0.9));
  }

  class Lab {
    /**
     * @param {object} exp Versuch aus Chemistry.EXPERIMENTS
     * @param {object} [options] Überschreibt DEFAULTS
     */
    constructor(exp, options) {
      this.exp = exp;
      const o = Object.assign({}, DEFAULTS, options || {});
      Object.assign(this, {
        capacity: o.capacity, dropVolume: o.dropVolume, minFlow: o.minFlow, maxFlow: o.maxFlow,
        releaseDelay: o.releaseDelay, fallTime: o.fallTime, mixTauStirred: o.mixTauStirred,
        mixTauStill: o.mixTauStill, sensorTau: o.sensorTau, driftLimit: o.driftLimit,
        stableHold: o.stableHold, pipetteTime: o.pipetteTime, waterTime: o.waterTime,
      });
      this.timeScale = 1;
      this._listeners = {};

      // Gerätezustand, der eine neue Probe überdauert
      this.burette = { rinsed: false, filled: false, bubble: false, reading: null };
      this.calibration = 0; // 0 = nicht kalibriert, 1 = pH 7 ok, 2 = vollständig
      this.stirrer = false;
      this.flowRate = 0.1;
      this.newSample();
    }

    on(type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
      return this;
    }

    _emit(type, payload) {
      (this._listeners[type] || []).forEach(function (fn) { fn(payload); });
    }

    /** Frische Probe: Kolben leer, Bürette und Kalibrierung bleiben erhalten */
    newSample() {
      this.sample = 0; // pipettiertes Probevolumen (mL, animiert)
      this.water = 0;
      this.pipetting = null; // {kind:'sample'|'water', t}
      this.indicator = null;
      this.electrodeIn = false;
      this.dispensed = 0;
      this.delivered = 0;
      this.hanging = 0;
      this.drops = [];
      this.unmixed = 0;
      this.valveOpen = false;
      this.step = null;
      this.releaseTimer = 0;
      this.time = 0;
      this.sensor = null; // angezeigter pH-Wert (ungerundet)
      this.calTimer = 0;
      this.calRunning = 0;
      this.quietTime = 0;
      this._lastSensor = null;
      this._stateCache = null;
      this._bulkCache = null;
    }

    // ---------- Abgeleitete Größen ----------

    get sampleReady() { return this.sample >= this.exp.vSample - EPS && !this.pipetting; }
    get waterReady() { return this.water >= this.exp.vWater - EPS && !this.pipetting; }

    /** Flüssigkeitsvolumen im Kolben (mL) – für Füllstand und Tropfenweg */
    get liquidVolume() { return this.sample + this.water + this.delivered; }

    get buretteReady() { return this.burette.filled && !this.burette.bubble; }

    get remaining() {
      if (!this.burette.filled) return 0;
      return Math.max(0, this.capacity - this.burette.reading);
    }

    get isEmpty() { return this.remaining <= EPS; }

    get isFlowing() { return this.valveOpen || this.step !== null; }

    get currentFlow() {
      if (this.step) return this.step.rate;
      return this.valveOpen ? this.flowRate : 0;
    }

    /** Hahnöffnung 0 … 1 (Darstellung des Griffs) */
    get valveOpening() {
      const q = this.currentFlow;
      if (q <= 0) return 0;
      const t = Math.log(q / this.minFlow) / Math.log(this.maxFlow / this.minFlow);
      return 0.25 + 0.75 * Math.min(1, Math.max(0, t));
    }

    get isSettled() { return !this.isFlowing && this.hanging === 0 && this.drops.length === 0; }

    /** Gleichgewichtszustand der gesamten (homogen gedachten) Lösung */
    get state() {
      if (!this._stateCache || this._stateCache.v !== this.delivered) {
        this._stateCache = Chem.state(this.exp, this.delivered);
      }
      return this._stateCache;
    }

    /** Zustand des vermischten Anteils, den die Elektrode sieht */
    get bulkState() {
      const v = Math.max(0, this.delivered - this.unmixed);
      if (!this._bulkCache || this._bulkCache.v !== v) this._bulkCache = Chem.state(this.exp, v);
      return this._bulkCache;
    }

    /**
     * Ist die Lösung am Sensor praktisch homogen? Maßgeblich ist die Wirkung
     * des unvermischten Rests auf den pH-Wert (< 0,003), nicht sein Volumen.
     */
    get homogeneous() {
      if (this.unmixed < 1e-4) return true;
      return Math.abs(this.bulkState.pH - this.state.pH) < 0.003;
    }

    /** Kann das pH-Meter messen? */
    get meterReady() { return this.calibration >= 2 && this.electrodeIn && !this.calRunning; }

    /** Anzeige stabil (Drift unter dem Grenzwert für stableHold Sekunden) */
    get stable() { return this.meterReady && this.quietTime >= this.stableHold; }

    /** Angezeigter pH-Wert, auf die Geräteauflösung 0,01 gerundet */
    get displayPH() {
      if (!this.meterReady || this.sensor === null) return null;
      return Math.round(this.sensor * 100) / 100;
    }

    /** Abgegebenes Volumen in der Ableseauflösung der Bürette (0,01 mL) */
    get addedRounded() { return Math.round(this.dispensed * 100) / 100; }

    // ---------- Vorbereitung ----------

    pipetteSample() {
      if (this.sample > 0 || this.pipetting) return false;
      this.pipetting = { kind: 'sample', t: 0 };
      this._emit('prep', { action: 'sample' });
      return true;
    }

    addWater() {
      if (!this.sampleReady || this.water > 0 || this.pipetting) return false;
      this.pipetting = { kind: 'water', t: 0 };
      this._emit('prep', { action: 'water' });
      return true;
    }

    rinseBurette() {
      if (this.isFlowing) return false;
      this.burette.rinsed = true;
      this._emit('prep', { action: 'rinse' });
      return true;
    }

    /**
     * Bürette füllen: über die Nullmarke einfüllen, dann auf einen Stand
     * knapp unter null einstellen. Eine Luftblase in der Spitze bleibt,
     * bis sie entfernt wird. start: eingestellter Stand in mL.
     */
    fillBurette(start) {
      if (this.isFlowing || this.hanging > 0 || this.drops.length) return false;
      const s = Number.isFinite(start) ? start : 0.4;
      const wasFilled = this.burette.filled;
      this.burette.filled = true;
      this.burette.reading = s;
      if (!wasFilled) this.burette.bubble = true;
      this._emit('prep', { action: wasFilled ? 'refill' : 'fill', reading: s });
      return true;
    }

    /** Luftblase entfernen: kurz in ein Abfallgefäß ablaufen lassen (nicht in die Probe) */
    purgeTip(drain) {
      if (!this.burette.filled || !this.burette.bubble) return false;
      const d = Number.isFinite(drain) ? drain : 0.2;
      this.burette.bubble = false;
      this.burette.reading = Math.min(this.capacity, this.burette.reading + d);
      this._emit('prep', { action: 'purge', reading: this.burette.reading });
      return true;
    }

    /** Kalibrierschritt mit Pufferlösung (1: pH 7,00; 2: zweiter Puffer). Dauer ca. 3 s. */
    calibrate(stepNo) {
      if (this.calRunning || this.electrodeIn) return false;
      if (stepNo !== this.calibration + 1 && !(stepNo === 1 && this.calibration >= 2)) return false;
      if (stepNo === 1) this.calibration = 0;
      this.calRunning = stepNo;
      this.calTimer = 0;
      this._emit('prep', { action: 'cal-start', step: stepNo });
      return true;
    }

    /** Elektrode spülen und eintauchen. Diaphragma muss bedeckt sein. */
    immerseElectrode() {
      if (this.electrodeIn) return { ok: true };
      if (this.calibration < 2 || this.calRunning) return { ok: false, reason: 'calibrate' };
      if (!this.sampleReady) return { ok: false, reason: 'sample' };
      if (!this.waterReady) return { ok: false, reason: 'depth' };
      this.electrodeIn = true;
      this.sensor = 7.0; // Elektrode kommt aus dem Spülwasser
      this.quietTime = 0;
      this._emit('prep', { action: 'electrode' });
      return { ok: true };
    }

    liftElectrode() {
      if (!this.electrodeIn) return false;
      this.electrodeIn = false;
      this.sensor = null;
      this.quietTime = 0;
      this._emit('prep', { action: 'electrode-out' });
      return true;
    }

    addIndicator(id) {
      if (!this.sampleReady || this.indicator) return false;
      this.indicator = id;
      this._emit('prep', { action: 'indicator', id: id });
      return true;
    }

    setStirrer(on) {
      this.stirrer = !!on;
      this._emit('stirrer', { on: this.stirrer });
    }

    // ---------- Dosieren ----------

    canDose() {
      if (!this.buretteReady) return 'burette';
      if (!this.sampleReady) return 'sample';
      // Das Modell rechnet mit der verdünnten Probe (Probe + Wasser)
      if (!this.waterReady) return 'water';
      if (this.isEmpty) return 'empty';
      return null;
    }

    setFlowRate(q) {
      if (!Number.isFinite(q)) return;
      this.flowRate = Math.min(this.maxFlow, Math.max(this.minFlow, q));
    }

    openValve() {
      const why = this.canDose();
      if (why) { this._emit('blocked', { reason: why }); return false; }
      this.step = null;
      this.valveOpen = true;
      this.releaseTimer = 0;
      this._emit('valve', { open: true });
      return true;
    }

    closeValve() {
      const was = this.isFlowing;
      this.valveOpen = false;
      this.step = null;
      this.releaseTimer = 0;
      if (was) this._emit('valve', { open: false });
    }

    toggleValve() {
      if (this.valveOpen) this.closeValve();
      else this.openValve();
      return this.valveOpen;
    }

    /** Gezielte Zugabe; mehrere Zugaben addieren sich. Bürettenende wird nie überschritten. */
    addVolume(volume) {
      if (!Number.isFinite(volume) || volume <= 0) return { accepted: 0 };
      const why = this.canDose();
      if (why) { this._emit('blocked', { reason: why }); return { accepted: 0, blocked: why }; }
      if (this.valveOpen) this.valveOpen = false;
      const base = this.step ? this.step.target : this.dispensed;
      const room = this.capacity - this.burette.reading - (base - this.dispensed);
      const accepted = Math.max(0, Math.min(volume, room));
      if (accepted <= EPS) { this._emit('empty', {}); return { accepted: 0 }; }
      const target = base + accepted;
      this.step = { target: target, rate: stepRate(target - this.dispensed) };
      this.releaseTimer = 0;
      if (accepted < volume - EPS) this._emit('limited', { requested: volume, accepted: accepted });
      return { accepted: accepted };
    }

    // ---------- Zeitschritt ----------

    update(dtReal) {
      if (!(dtReal > 0)) return;
      const dtAll = Math.min(dtReal, 0.1) * this.timeScale;
      // Bei Zeitraffer in kleinen Teilschritten rechnen (gleiches Verhalten wie in Echtzeit)
      const n = Math.max(1, Math.ceil(dtAll / 0.05));
      for (let i = 0; i < n; i++) this._step(dtAll / n);
    }

    _step(dt) {
      this.time += dt;

      // Pipettieren / Wasser zugeben
      if (this.pipetting) {
        const p = this.pipetting;
        p.t += dt;
        if (p.kind === 'sample') {
          this.sample = Math.min(this.exp.vSample, (this.exp.vSample * p.t) / this.pipetteTime);
          if (this.sample >= this.exp.vSample - EPS) { this.sample = this.exp.vSample; this.pipetting = null; this._emit('prep', { action: 'sample-done' }); }
        } else {
          this.water = Math.min(this.exp.vWater, (this.exp.vWater * p.t) / this.waterTime);
          if (this.water >= this.exp.vWater - EPS) { this.water = this.exp.vWater; this.pipetting = null; this._emit('prep', { action: 'water-done' }); }
        }
      }

      // Kalibrierung
      if (this.calRunning) {
        this.calTimer += dt;
        if (this.calTimer >= 3) {
          const done = this.calRunning;
          this.calibration = done;
          this.calRunning = 0;
          this._emit('prep', { action: 'cal-done', step: done });
        }
      }

      // 1) Ausfluss in den hängenden Tropfen
      if (this.isFlowing) {
        let amount = this.currentFlow * dt;
        if (this.step) amount = Math.min(amount, this.step.target - this.dispensed);
        amount = Math.min(amount, this.capacity - this.burette.reading);
        if (amount > 0) {
          this.dispensed += amount;
          this.hanging += amount;
          this.burette.reading += amount;
        }
        if (this.step && this.step.target - this.dispensed <= EPS) {
          this.dispensed = this.step.target;
          this.step = null;
          this._emit('step-done', {});
          this._emit('valve', { open: false });
        }
        if (this.capacity - this.burette.reading <= EPS) {
          this.burette.reading = this.capacity;
          const was = this.isFlowing;
          this.valveOpen = false;
          this.step = null;
          if (was) this._emit('valve', { open: false });
          this._emit('empty', {});
        }
      }

      // 2) Tropfenablösung
      while (this.hanging >= this.dropVolume - EPS) this._release(Math.min(this.dropVolume, this.hanging));
      if (!this.isFlowing && this.hanging > EPS) {
        this.releaseTimer += dt;
        if (this.releaseTimer >= this.releaseDelay) this._release(this.hanging);
      } else {
        this.releaseTimer = 0;
      }

      // 3) Fallende Tropfen
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.t += dt;
        if (d.t >= this.fallTime) {
          this.drops.splice(i, 1);
          this.delivered += d.vol;
          this.unmixed += d.vol;
          this._settle();
          this._emit('drop-landed', { vol: d.vol, x: d.x });
        }
      }
      this._settle();

      // 4) Durchmischung
      if (this.unmixed > 0) {
        const tau = this.stirrer ? this.mixTauStirred : this.mixTauStill;
        this.unmixed *= Math.exp(-dt / tau);
        if (this.unmixed < 1e-7) this.unmixed = 0;
      }

      // 5) Messkette
      if (this.meterReady) {
        const target = this.bulkState.pH;
        if (this.sensor === null) this.sensor = target;
        const prev = this.sensor;
        this.sensor += (target - this.sensor) * (1 - Math.exp(-dt / this.sensorTau));
        const drift = Math.abs(this.sensor - prev) / dt;
        if (drift < this.driftLimit) this.quietTime += dt;
        else this.quietTime = 0;
      } else {
        this.quietTime = 0;
      }
    }

    _release(vol) {
      this.hanging = Math.max(0, this.hanging - vol);
      if (this.hanging < EPS) this.hanging = 0;
      this.drops.push({ vol: vol, t: 0, x: (Math.random() - 0.5) * 0.6 });
      this.releaseTimer = 0;
      this._emit('drop-released', { vol: vol });
    }

    _settle() {
      if (this.drops.length === 0 && this.hanging === 0 && !this.isFlowing) {
        const diff = this.dispensed - this.delivered;
        if (diff > 0) this.unmixed += diff;
        this.delivered = this.dispensed;
      }
      if (this.delivered > this.dispensed) this.delivered = this.dispensed;
    }

    /**
     * Momentaufnahme des Messgeräts für das Protokoll. Gespeichert werden
     * nur Größen, die die Lernenden ablesen könnten, plus der Messstatus.
     */
    reading() {
      return {
        v: this.addedRounded,
        pH: this.displayPH,
        stable: this.stable,
        settled: this.isSettled,
        homogeneous: this.homogeneous,
        stirred: this.stirrer,
        buretteReading: this.burette.reading === null ? null : Math.round(this.burette.reading * 100) / 100,
      };
    }

    /** Zustand für die lokale Speicherung (fallende Tropfen gelten als angekommen) */
    toJSON() {
      const pending = this.dispensed - this.delivered;
      return {
        burette: Object.assign({}, this.burette),
        calibration: this.calibration,
        stirrer: this.stirrer,
        flowRate: this.flowRate,
        sample: this.pipetting && this.pipetting.kind === 'sample' ? this.exp.vSample : this.sample,
        water: this.pipetting && this.pipetting.kind === 'water' ? this.exp.vWater : this.water,
        indicator: this.indicator,
        electrodeIn: this.electrodeIn,
        dispensed: this.step ? this.step.target : this.dispensed,
        unmixed: this.unmixed + pending,
        readingOffset: this.step ? this.step.target - this.dispensed : 0,
      };
    }

    restore(s) {
      if (!s) return;
      this.burette = Object.assign({ rinsed: false, filled: false, bubble: false, reading: null }, s.burette || {});
      if (this.burette.reading !== null && s.readingOffset) this.burette.reading += s.readingOffset;
      this.calibration = s.calibration >= 2 ? 2 : s.calibration === 1 ? 1 : 0;
      this.stirrer = !!s.stirrer;
      if (Number.isFinite(s.flowRate)) this.flowRate = s.flowRate;
      this.sample = Number(s.sample) || 0;
      this.water = Number(s.water) || 0;
      this.indicator = s.indicator || null;
      this.electrodeIn = !!s.electrodeIn && this.calibration >= 2 && this.waterReady;
      this.dispensed = Math.max(0, Number(s.dispensed) || 0);
      this.delivered = this.dispensed;
      this.unmixed = Math.max(0, Number(s.unmixed) || 0);
      this.sensor = this.electrodeIn ? this.bulkState.pH : null;
    }

    /** Für Tests: Zeitspanne in festen Schritten simulieren */
    simulate(seconds, dt) {
      const h = dt || 1 / 60;
      for (let t = 0; t < seconds - 1e-9; t += h) this.update(h);
    }
  }

  Lab.DEFAULTS = DEFAULTS;
  NS.Lab = Lab;
  if (typeof module !== 'undefined' && module.exports) module.exports = Lab;
})(typeof globalThis !== 'undefined' ? globalThis : this);
