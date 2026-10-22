/*
 * Redoxlabor – Start
 * Verbindet Experimentsteuerung, Darstellung und Bedienoberfläche und
 * betreibt die Animationsschleife.
 */
(function (root) {
  'use strict';
  const RL = root.RL;
  const errors = [];
  root.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
  root.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

  function start() {
    const canvas = document.getElementById('lab');
    const lab = RL.lab.createLab({ mode: 'learn' });
    const renderer = RL.render.createRenderer(canvas, lab);
    const ui = RL.ui.createUI(lab, renderer, canvas);

    const stage = document.getElementById('stage');
    const onResize = () => renderer.resize();
    if (root.ResizeObserver) new ResizeObserver(onResize).observe(stage);
    root.addEventListener('resize', onResize);
    renderer.resize();

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      // Simulation in kleinen Schritten, damit auch bei niedriger Bildrate stabil
      let rest = dt;
      while (rest > 0) { const h = Math.min(0.02, rest); lab.update(h); rest -= h; }
      renderer.frame(dt);
      root.requestAnimationFrame(loop);
    }
    root.requestAnimationFrame(loop);

    // Schnittstelle für automatisierte Tests und Diagnose (keine personenbezogenen Daten)
    root.RedoxLab = { lab, renderer, ui, chem: RL.chem, redox: RL.redox, errors };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof self !== 'undefined' ? self : this);
