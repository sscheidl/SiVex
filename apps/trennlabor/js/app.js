/*
 * Trennlabor – Start
 * Erzeugt die Bedienoberfläche und stellt eine Diagnose-Schnittstelle für
 * automatisierte Tests bereit (keine personenbezogenen Daten).
 */
(function (root) {
  'use strict';
  const errors = [];
  root.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
  root.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

  function start() {
    const ui = root.TL.ui.createUI();
    ui.start();
    root.Trennlabor = { ui, TL: root.TL, errors, uiErrors: ui.errors };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof self !== 'undefined' ? self : this);
