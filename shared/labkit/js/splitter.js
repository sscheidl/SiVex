/*
 * SiVex-Labkit – verschiebbare Trennlinie zwischen Laborbühne und Bedienfeld
 *
 * Nach TitraLab 3 (titration/js/ui/app.js: setPanelWidth, bindSplitter):
 * Maus, Finger, Tastatur (Pfeiltasten), Doppelklick setzt zurück; die Breite
 * wird nur lokal im Browser gemerkt.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.LK = root.LK || {}).splitter = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const MIN_PANEL = 300;
  const MAX_PANEL = 620;
  const MIN_STAGE = 420;
  const KEY_STEP = 24;

  /** Erlaubte Bedienfeldbreite bei gegebener Gesamtbreite (minStage: Mindestbreite der Bühne). */
  function clampPanelWidth(w, total, minStage) {
    const max = Math.max(MIN_PANEL, Math.min(MAX_PANEL, total - (minStage || MIN_STAGE)));
    return Math.round(Math.min(max, Math.max(MIN_PANEL, w)));
  }

  /**
   * opts: { splitter, container, panel, storageKey, onChange, minStage (optional, Standard MIN_STAGE) }
   * Die Breite wird als CSS-Variable --panel-w am Wurzelelement gesetzt.
   */
  function bindSplitter(opts) {
    const sp = opts.splitter;
    const doc = sp.ownerDocument;
    const rootEl = doc.documentElement;
    const store = (v) => { try { if (v == null) root.localStorage.removeItem(opts.storageKey); else root.localStorage.setItem(opts.storageKey, String(v)); } catch (e) { /* ohne Speicher */ } };
    const changed = () => { if (opts.onChange) opts.onChange(); };

    function set(w, save) {
      const total = opts.container.getBoundingClientRect().width;
      const width = clampPanelWidth(w, total, opts.minStage);
      rootEl.style.setProperty('--panel-w', width + 'px');
      sp.setAttribute('aria-valuenow', String(width));
      if (save) store(width);
      changed();
      return width;
    }
    function reset() {
      rootEl.style.removeProperty('--panel-w');
      sp.removeAttribute('aria-valuenow');
      store(null);
      changed();
    }

    let dragging = false;
    sp.addEventListener('pointerdown', (e) => {
      dragging = true;
      sp.classList.add('is-dragging');
      doc.body.classList.add('is-resizing');
      try { sp.setPointerCapture(e.pointerId); } catch (err) { /* ignorieren */ }
      e.preventDefault();
    });
    sp.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const box = opts.container.getBoundingClientRect();
      set(box.right - e.clientX - sp.getBoundingClientRect().width / 2, false);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      sp.classList.remove('is-dragging');
      doc.body.classList.remove('is-resizing');
      set(opts.panel.getBoundingClientRect().width, true);
    };
    sp.addEventListener('pointerup', end);
    sp.addEventListener('pointercancel', end);
    sp.addEventListener('dblclick', reset);
    sp.addEventListener('keydown', (e) => {
      if (e.key === 'Home') { e.preventDefault(); reset(); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const cur = opts.panel.getBoundingClientRect().width;
      set(cur + (e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP), true);
    });

    let saved = null;
    try { saved = parseFloat(root.localStorage.getItem(opts.storageKey)); } catch (e) { /* ohne Speicher */ }
    if (saved) set(saved, false);
    return { set, reset };
  }

  return { bindSplitter, clampPanelWidth, MIN_PANEL, MAX_PANEL, MIN_STAGE, KEY_STEP };
});
