/*
 * Redoxlabor – minimaler SCORM-1.2-Adapter
 *
 * Läuft die Anwendung als SCORM-Lernpaket (z. B. in mebis/Moodle), meldet sie
 * sich beim LMS an (LMSInitialize) und beim Verlassen wieder ab (LMSFinish).
 * Gemäß SiVex-mebis-Konzept werden KEINE Noten, Fortschritte oder
 * personenbezogenen Daten gelesen oder geschrieben.
 * Ohne LMS (Webserver, file://) tut das Skript nichts.
 */
(function (root) {
  'use strict';
  function findAPI(win) {
    for (let i = 0; win && i < 12; i++) {
      try { if (win.API && typeof win.API.LMSInitialize === 'function') return win.API; } catch (e) { return null; }
      if (!win.parent || win.parent === win) break;
      win = win.parent;
    }
    return null;
  }
  let api = null;
  try { api = findAPI(root) || (root.opener ? findAPI(root.opener) : null); } catch (e) { api = null; }
  const state = { available: !!api, initialized: false, finished: false };
  if (api) {
    try { state.initialized = String(api.LMSInitialize('')) === 'true'; } catch (e) { state.initialized = false; }
  }
  function finish() {
    if (!api || !state.initialized || state.finished) return;
    state.finished = true;
    try { api.LMSFinish(''); } catch (e) { /* LMS nicht erreichbar */ }
  }
  root.addEventListener('pagehide', finish);
  root.addEventListener('beforeunload', finish);
  (root.RL = root.RL || {}).scorm = { state, finish };
})(typeof self !== 'undefined' ? self : this);
