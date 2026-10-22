/*
 * Trennlabor – Start
 * Verbindet Sitzung, Darstellung und Bedienoberfläche und betreibt die
 * Animationsschleife. Die Simulation rechnet in festen Zeitschritten
 * (TL.util.stepper); die Bildrate beeinflusst nur die Darstellung.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const errors = [];
  root.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
  root.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

  function start() {
    const canvas = document.getElementById('lab');
    const stage = TL.render.createStage(canvas);
    const session = TL.session.createSession();
    const renderers = {
      classic: TL.render.classic.create(stage),
      chroma: TL.render.chroma.create(stage),
      distill: TL.render.distill.create(stage)
    };
    const ui = TL.ui.createUI(session, stage, renderers);

    const onResize = () => stage.resize();
    if (root.ResizeObserver) new ResizeObserver(onResize).observe(document.getElementById('stage'));
    root.addEventListener('resize', onResize);
    stage.resize();

    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const lab = session.state.lab;
      if (lab) {
        session.update(dt);
        stage.begin();
        renderers[lab].frame(session.engine(), Object.assign({}, ui.ui, { selected: ui.ui.selected[lab], view: ui.ui.chromaView, expert: session.state.expert }), dt);
      }
      ui.frame(dt);
      root.requestAnimationFrame(loop);
    }
    root.requestAnimationFrame(loop);

    // Schnittstelle für automatisierte Tests und Diagnose (keine personenbezogenen Daten)
    root.Trennlabor = { session, stage, ui, renderers, errors, TL };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof self !== 'undefined' ? self : this);
