/*
 * Redoxlabor – Halbstrukturformeln als SVG
 * Die C=O-Gruppe wird ausgeschrieben (O mit Doppelbindung über dem Carbonyl-C),
 * wie in der Schule üblich.
 */
(function (root) {
  'use strict';
  const RL = root.RL;

  function groupSvg(text, x, y, size) {
    // Ziffern als Index
    let out = '';
    for (const ch of text) {
      if (/\d/.test(ch)) out += `<tspan font-size="${size * 0.68}" dy="${size * 0.28}">${ch}</tspan><tspan dy="${-size * 0.28}"></tspan>`;
      else out += ch;
    }
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle">${out}</text>`;
  }

  function widthOf(text, size) {
    let w = 0;
    for (const ch of text) w += /\d/.test(ch) ? size * 0.42 : ch === 'H' || ch === 'C' || ch === 'O' ? size * 0.72 : size * 0.6;
    return w;
  }

  /** Erzeugt die Halbstrukturformel einer Stoffprobe. */
  function structureSvg(sample, opts) {
    const size = (opts && opts.size) || 20;
    const gap = size * 0.9;
    const groups = sample.chain;
    const widths = groups.map((g) => widthOf(g, size));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (groups.length - 1) + size;
    const height = size * 3.6;
    const y = height - size * 0.7;
    let x = size / 2;
    let parts = '';
    const centers = [];
    groups.forEach((g, i) => {
      const cx = x + widths[i] / 2;
      centers.push(cx);
      parts += groupSvg(g, cx, y, size);
      x += widths[i];
      if (i < groups.length - 1) {
        parts += `<line x1="${x + gap * 0.18}" y1="${y - size * 0.34}" x2="${x + gap * 0.82}" y2="${y - size * 0.34}" stroke="currentColor" stroke-width="${size * 0.07}"/>`;
        x += gap;
      }
    });
    // C=O
    const cx = centers[sample.carbonyl];
    const yTop = size * 1.05;
    const yBot = y - size * 0.92;
    parts += `<line x1="${cx - size * 0.12}" y1="${yTop + size * 0.12}" x2="${cx - size * 0.12}" y2="${yBot}" stroke="currentColor" stroke-width="${size * 0.07}"/>`;
    parts += `<line x1="${cx + size * 0.12}" y1="${yTop + size * 0.12}" x2="${cx + size * 0.12}" y2="${yBot}" stroke="currentColor" stroke-width="${size * 0.07}"/>`;
    parts += `<text x="${cx}" y="${yTop}" font-size="${size}" text-anchor="middle" fill="#c0392b">O</text>`;
    return `<svg class="structure" viewBox="0 0 ${Math.ceil(total)} ${Math.ceil(height)}" width="${Math.ceil(total)}" height="${Math.ceil(height)}" role="img" aria-label="Halbstrukturformel ${sample.name}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="600" fill="currentColor">${parts}</svg>`;
  }

  RL.structures = { structureSvg };
})(typeof self !== 'undefined' ? self : this);
