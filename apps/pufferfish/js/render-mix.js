/*
 * Pufferfish – Mischungsverhältnis-Diagramm für Versuch 3 (HTML/CSS, kein Canvas)
 *
 * Ersetzt das Teilchenmodell in Versuch 3. Alle Größen stammen aus den
 * tatsächlich zugegebenen Stoffmengen des Becherglases (engine → chem.pairAmounts):
 *   • Anteile: ein gestapelter 100-%-Balken HA | A⁻ (Verhältnis),
 *   • absolute Stoffmengen: zwei Säulen mit gemeinsamer mmol-Achse (Kapazität),
 *   • Zahlen: n(HA), n(A⁻), n(A⁻)/n(HA), Volumina,
 *   • pH-Wert erst nach „Mischen und pH messen“ (Messwert) samt Rechenwert aus dem Verhältnis.
 * Während der Rechenphase gibt es keinen Soll-Balken und keinen Soll-Wert.
 */
(function (root) {
  'use strict';
  const fmt = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  class MixView {
    constructor(el) {
      this.el = el; this.sig = '';
      el.innerHTML = `
        <div class="mx-grid">
          <section class="mx-part" aria-label="Anteile im Becherglas">
            <h3>Anteile (Stoffmengenverhältnis)</h3>
            <div class="mx-bar" role="img" aria-label="Anteile von Säure und Base"><div class="seg acid"></div><div class="seg base"></div></div>
            <p class="mx-ratio"></p>
          </section>
          <section class="mx-part" aria-label="Absolute Stoffmengen">
            <h3>Stoffmengen in mmol (gemeinsame Achse)</h3>
            <div class="mx-cols" role="img" aria-label="Absolute Stoffmengen von Säure und Base">
              <div class="axis"><span class="top"></span><span class="mid"></span><span class="zero">0</span></div>
              <div class="col"><div class="stack"><div class="fill acid"></div></div><b class="val acidv"></b><span class="nm acidn"></span></div>
              <div class="col"><div class="stack"><div class="fill base"></div></div><b class="val basev"></b><span class="nm basen"></span></div>
            </div>
          </section>
          <section class="mx-part mx-result" aria-label="Volumina und pH-Wert">
            <h3>Volumina und pH-Wert</h3>
            <p class="mx-vols"></p>
            <p class="mx-ph"></p>
          </section>
        </div>
        <div class="mx-legend"></div>`;
      this.q = (s) => el.querySelector(s);
    }

    /**
     * d: { system (chem.SYSTEMS-Eintrag oder null), nAcid, nBase, vAcid, vBase, V, measure: {pH, hh} | null, measuring: bool }
     */
    update(d) {
      const sig = JSON.stringify([d.system && d.system.id, +d.nAcid.toFixed(4), +d.nBase.toFixed(4), +d.vAcid.toFixed(3), +d.vBase.toFixed(3), d.measure && +d.measure.pH.toFixed(3), d.measuring]);
      if (sig === this.sig) return;
      this.sig = sig;
      const S = d.system;
      const aF = S ? S.acid.formula : 'HA', bF = S ? S.base.formula : 'A⁻';
      const n = d.nAcid + d.nBase;
      const pA = n > 0 ? d.nAcid / n : 0, pB = n > 0 ? d.nBase / n : 0;
      const segA = this.q('.seg.acid'), segB = this.q('.seg.base');
      segA.style.flexBasis = (pA * 100).toFixed(2) + '%'; segB.style.flexBasis = (pB * 100).toFixed(2) + '%';
      segA.textContent = pA > 0.1 ? `HA ${fmt(pA * 100, 0)} %` : (pA > 0.03 ? fmt(pA * 100, 0) + ' %' : '');
      segB.textContent = pB > 0.1 ? `A⁻ ${fmt(pB * 100, 0)} %` : (pB > 0.03 ? fmt(pB * 100, 0) + ' %' : '');
      this.q('.mx-bar').classList.toggle('empty', !(n > 0));
      this.q('.mx-bar').setAttribute('aria-label', n > 0 ? `Anteile: Säure HA ${fmt(pA * 100, 0)} Prozent, Base A⁻ ${fmt(pB * 100, 0)} Prozent` : 'Noch nichts zugegeben');
      this.q('.mx-ratio').innerHTML = n <= 0
        ? 'Noch nichts zugegeben. Dosiere die Stammlösungen mit der Messpipette.'
        : (d.nAcid > 0 && d.nBase > 0
          ? `<b>n(A⁻) / n(HA) = ${fmt(d.nBase / d.nAcid, 2)}</b> &nbsp;(${fmt(d.nBase, 3)} mmol : ${fmt(d.nAcid, 3)} mmol)`
          : `<b>n(A⁻) / n(HA) = ${d.nAcid > 0 ? '0' : '∞'}</b> &nbsp;– es fehlt ${d.nAcid > 0 ? 'die Base A⁻' : 'die Säure HA'}: kein Puffer`);
      // absolute Säulen
      const max = Math.max(3.0, Math.ceil(Math.max(d.nAcid, d.nBase) * 2) / 2);
      this.q('.fill.acid').style.height = (100 * d.nAcid / max).toFixed(2) + '%';
      this.q('.fill.base').style.height = (100 * d.nBase / max).toFixed(2) + '%';
      this.q('.axis .top').textContent = fmt(max, 1);
      this.q('.axis .mid').textContent = fmt(max / 2, 2);
      this.q('.acidv').textContent = fmt(d.nAcid, 3);
      this.q('.basev').textContent = fmt(d.nBase, 3);
      this.q('.acidn').innerHTML = `HA<br><small>${esc(aF)}</small>`;
      this.q('.basen').innerHTML = `A⁻<br><small>${esc(bF)}</small>`;
      // Volumina und pH
      this.q('.mx-vols').innerHTML = S
        ? `V(${esc(S.base.stockFormula)}-Lösung, Base) = <b>${fmt(d.vBase, 1)} mL</b><br>V(${esc(S.acid.stockFormula)}-Lösung, Säure) = <b>${fmt(d.vAcid, 1)} mL</b><br>Gesamtvolumen = <b>${fmt(d.V, 1)} mL</b>`
        : 'Wähle zuerst Ziel-pH und Puffersystem.';
      this.q('.mx-ph').innerHTML = d.measuring
        ? '<span class="mix">pH-Messelektrode: mischt und misst …</span>'
        : d.measure
          ? `gemessener pH-Wert: <b class="big">${fmt(d.measure.pH, 2)}</b>${d.measure.hh != null ? `<br><span class="lk-muted">Rechenwert aus diesem Verhältnis (Henderson-Hasselbalch): ${fmt(d.measure.hh, 2)}</span>` : ''}`
          : '<span class="lk-muted">pH-Wert: noch nicht gemessen – erst „Mischen und pH messen“.</span>';
      this.q('.mx-legend').innerHTML = `<span class="sym"><span class="chip dash" style="background:#5f3dc4">HA</span><span class="symname">saure Form ${esc(aF)} (Säure)</span></span><span class="sym"><span class="chip" style="background:#0b7285">A⁻</span><span class="symname">basische Form ${esc(bF)} (Base)</span></span>`;
    }
  }

  (root.PF = root.PF || {}).MixView = MixView;
})(typeof self !== 'undefined' ? self : this);
