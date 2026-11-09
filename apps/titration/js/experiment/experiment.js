/*
 * Experimentsteuerung
 * -------------------
 * Bildet die Bürette mit Hahn, Tropfenbildung an der Spitze, fallende
 * Tropfen und die Messwertaufzeichnung ab. Enthält keinen DOM-Code.
 *
 * Volumenbuchhaltung (alle Werte in mL):
 *   dispensed – aus der Bürette ausgeflossen (= Bürettenablesung)
 *   hanging   – Tropfen, der gerade an der Bürettenspitze hängt
 *   drops     – fallende Tropfen
 *   delivered – im Kolben angekommen (Grundlage der pH-Berechnung)
 * Es gilt stets: dispensed = delivered + hanging + Σ drops.
 * Grafik und Chemie lesen beide aus diesem Objekt, dadurch sind sie
 * synchron: Ein Tropfen verändert den pH-Wert genau in dem Moment, in
 * dem er die Flüssigkeitsoberfläche erreicht.
 */
(function (global) {
  'use strict';

  const NS = (global.Titrierlabor = global.Titrierlabor || {});
  if (!NS.Chemistry && typeof require === 'function') require('../model/chemistry.js');
  const Chem = NS.Chemistry;

  const EPS = 1e-9;

  const DEFAULTS = {
    capacity: 50, // mL
    dropVolume: 0.05, // mL, typischer Bürettentropfen
    minFlow: 0.01, // mL/s
    maxFlow: 1.2, // mL/s (Hahn ganz offen)
    releaseDelay: 0.22, // s bis ein Resttropfen nach dem Schließen abfällt
    fallTime: 0.32, // s Fallzeit Spitze → Oberfläche (wird von der Grafik aktualisiert)
  };

  /** Fließgeschwindigkeit für eine Einzelzugabe: kleine Mengen langsam, große zügig */
  function stepRate(volume) {
    return Math.min(0.8, Math.max(0.1, volume * 0.9));
  }

  class Experiment {
    /**
     * @param {{sampleType:'acid'|'base', cSample:number, vSample:number, cTitrant:number, indicator:string}} config
     * @param {object} [options]
     */
    constructor(config, options) {
      Chem.equivalenceVolume(config); // wirft bei ungültiger Konfiguration
      this.config = Object.freeze(Object.assign({}, config));
      const o = Object.assign({}, DEFAULTS, options || {});
      this.capacity = o.capacity;
      this.dropVolume = o.dropVolume;
      this.minFlow = o.minFlow;
      this.maxFlow = o.maxFlow;
      this.releaseDelay = o.releaseDelay;
      this.fallTime = o.fallTime;

      this.dispensed = 0;
      this.delivered = 0;
      this.hanging = 0;
      this.drops = [];
      this.valveOpen = false;
      this.flowRate = 0.1;
      this.step = null; // {target, rate}
      this.releaseTimer = 0;
      this.electrode = !!(options && options.electrode);
      this.points = [];
      this.endpoint = null; // notierte Bürettenablesung in mL
      this.pendingEndpoint = false; // Endpunkt wird notiert, sobald alle Tropfen angekommen sind
      this.time = 0;
      this._listeners = {};
      this._stateCache = null;
      if (this.electrode) this.recordPoint();
    }

    on(type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
      return this;
    }

    _emit(type, payload) {
      (this._listeners[type] || []).forEach(function (fn) { fn(payload); });
    }

    // ---------- Abgeleitete Größen ----------

    /** Bürettenablesung (verbrauchtes Volumen) in mL */
    get reading() { return this.dispensed; }

    get remaining() { return Math.max(0, this.capacity - this.dispensed); }

    get isEmpty() { return this.remaining <= EPS; }

    /** Fließt gerade Maßlösung aus der Bürette? */
    get isFlowing() { return this.valveOpen || this.step !== null; }

    /** Aktuelle Ausflussrate in mL/s */
    get currentFlow() {
      if (this.step) return this.step.rate;
      return this.valveOpen ? this.flowRate : 0;
    }

    /** Hahnöffnung 0 … 1 (für die Darstellung des Hahngriffs) */
    get valveOpening() {
      const q = this.currentFlow;
      if (q <= 0) return 0;
      const t = Math.log(q / this.minFlow) / Math.log(this.maxFlow / this.minFlow);
      return 0.25 + 0.75 * Math.min(1, Math.max(0, t));
    }

    get inFlight() {
      return this.drops.reduce(function (s, d) { return s + d.vol; }, 0);
    }

    get equivalenceVolume() { return Chem.equivalenceVolume(this.config); }

    /** Chemischer Zustand der Lösung im Kolben (berechnet aus delivered) */
    get state() {
      if (!this._stateCache || this._stateCache.vTitrant !== this.delivered) {
        this._stateCache = Chem.mixtureState(this.config, this.delivered);
      }
      return this._stateCache;
    }

    get pH() { return this.state.pH; }

    // ---------- Bedienung ----------

    setFlowRate(q) {
      if (!Number.isFinite(q)) return;
      this.flowRate = Math.min(this.maxFlow, Math.max(this.minFlow, q));
    }

    openValve() {
      if (this.isEmpty) {
        this._emit('empty', { reading: this.dispensed });
        return false;
      }
      this.step = null;
      this.valveOpen = true;
      this.pendingEndpoint = false; // weiter titrieren verwirft ein noch ausstehendes Notieren
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

    /**
     * Gezielte Zugabe eines Volumens (z. B. +1,00 / +0,10 / +0,02 mL).
     * Mehrere Zugaben werden addiert. Die Bürettenkapazität wird nie
     * überschritten.
     * @returns {{requested:number, accepted:number, limited:boolean}}
     */
    addVolume(volume) {
      if (!Number.isFinite(volume) || volume <= 0) {
        return { requested: volume, accepted: 0, limited: false };
      }
      if (this.valveOpen) this.valveOpen = false;
      const base = this.step ? this.step.target : this.dispensed;
      const target = Math.min(this.capacity, base + volume);
      const accepted = Math.max(0, target - base);
      const limited = accepted < volume - EPS;
      if (accepted <= EPS) {
        this._emit('empty', { reading: this.dispensed });
        return { requested: volume, accepted: 0, limited: true };
      }
      const rate = stepRate(this.step ? target - this.dispensed : volume);
      this.step = { target: target, rate: rate };
      this.releaseTimer = 0;
      if (limited) this._emit('limited', { requested: volume, accepted: accepted });
      return { requested: volume, accepted: accepted, limited: limited };
    }

    setElectrode(on) {
      this.electrode = !!on;
      if (this.electrode) this.recordPoint();
    }

    /** Ist alles ausgeflossene Volumen im Kolben angekommen (Hahn zu, kein Tropfen unterwegs)? */
    get isSettled() {
      return !this.isFlowing && this.hanging === 0 && this.drops.length === 0;
    }

    /**
     * Endpunkt notieren (Bürettenablesung, auf 0,01 mL gerundet).
     * Der Hahn wird geschlossen. Hängen oder fallen noch Tropfen, wird erst
     * notiert, wenn der letzte Tropfen im Kolben angekommen ist
     * (Ereignis 'endpoint'); bis dahin liefert die Methode null.
     */
    noteEndpoint() {
      if (this.isFlowing) this.closeValve();
      if (!this.isSettled) {
        this.pendingEndpoint = true;
        return null;
      }
      return this._recordEndpoint();
    }

    _recordEndpoint() {
      this.pendingEndpoint = false;
      this.endpoint = Math.round(this.delivered * 100) / 100;
      this._emit('endpoint', { v: this.endpoint });
      return this.endpoint;
    }

    recordPoint() {
      const s = this.state;
      const last = this.points[this.points.length - 1];
      if (last && Math.abs(last.v - s.vTitrant) < EPS) return;
      this.points.push({ v: s.vTitrant, pH: s.pH, t: this.time });
    }

    /**
     * pH-Wert einer lokalen „Schliere“: Ein Tropfen Maßlösung hat sich erst
     * mit mixedVolume mL der umgebenden Lösung vermischt. Berechnet mit
     * derselben Ladungsbilanz wie die Gesamtlösung.
     */
    plumePH(dropVol, mixedVolume) {
      const s = this.state;
      const vt = mixedVolume + dropVol;
      const cS = (s.cSampleTotal * mixedVolume) / vt;
      const cT = (s.cTitrantTotal * mixedVolume + this.config.cTitrant * dropVol) / vt;
      return -Math.log10(Chem.solveHydronium(this.config.sampleType, cS, cT));
    }

    // ---------- Zeitschritt ----------

    /** @param {number} dt Zeitschritt in s */
    update(dt) {
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      this.time += dt;

      // 1) Ausfluss aus der Bürette in den hängenden Tropfen
      if (this.isFlowing) {
        let amount = this.currentFlow * dt;
        if (this.step) amount = Math.min(amount, this.step.target - this.dispensed);
        amount = Math.min(amount, this.capacity - this.dispensed);
        if (amount > 0) {
          this.dispensed += amount;
          this.hanging += amount;
        }
        if (this.step && this.step.target - this.dispensed <= EPS) {
          this.dispensed = this.step.target;
          this.step = null;
          this._emit('step-done', { reading: this.dispensed });
          this._emit('valve', { open: false });
        }
        if (this.capacity - this.dispensed <= EPS) {
          this.dispensed = this.capacity;
          const wasFlowing = this.isFlowing;
          this.valveOpen = false;
          this.step = null;
          if (wasFlowing) this._emit('valve', { open: false });
          this._emit('empty', { reading: this.dispensed });
        }
      }

      // 2) Tropfenablösung
      while (this.hanging >= this.dropVolume - EPS) {
        const vol = Math.min(this.dropVolume, this.hanging);
        this._release(vol);
      }
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
          this._settle();
          if (this.electrode) this.recordPoint();
          this._emit('drop-landed', { vol: d.vol, x: d.x });
        }
      }
      this._settle();
      if (this.pendingEndpoint && this.isSettled) this._recordEndpoint();
    }

    _release(vol) {
      this.hanging = Math.max(0, this.hanging - vol);
      if (this.hanging < EPS) this.hanging = 0;
      this.drops.push({ vol: vol, t: 0, x: (Math.random() - 0.5) * 0.6 });
      this.releaseTimer = 0;
      this._emit('drop-released', { vol: vol });
    }

    /** Rundungsdrift vermeiden: Ist nichts mehr unterwegs, gilt delivered = dispensed */
    _settle() {
      if (this.drops.length === 0 && this.hanging === 0 && !this.isFlowing) {
        this.delivered = this.dispensed;
      }
      if (this.delivered > this.dispensed) this.delivered = this.dispensed;
    }

    /** Hilfsfunktion für Tests: simuliert eine Zeitspanne in festen Schritten */
    simulate(seconds, dt) {
      const h = dt || 1 / 60;
      for (let t = 0; t < seconds; t += h) this.update(h);
    }
  }

  Experiment.DEFAULTS = DEFAULTS;

  NS.Experiment = Experiment;
  if (typeof module !== 'undefined' && module.exports) module.exports = Experiment;
})(typeof globalThis !== 'undefined' ? globalThis : this);
