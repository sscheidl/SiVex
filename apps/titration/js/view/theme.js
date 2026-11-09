/*
 * Farbschema (hell/dunkel)
 * ------------------------
 * Die Oberfläche wird über CSS-Variablen (data-theme am <html>) umgefärbt.
 * Laborgrafik und Diagramm zeichnen auf Canvas und lesen ihre Farben aus
 * den Paletten dieser Datei. „dunkel“ entspricht dem bisherigen TitraLab 3,
 * „hell“ folgt dem Labkit der übrigen SiVex-Apps (helle Fliesenwand, graue
 * Tischplatte, dunkle Glaskonturen und Schrift).
 *
 * Nur die Darstellung ändert sich – Chemie, Flüssigkeitsfarben
 * (Indikator) und Bedienung sind in beiden Schemata identisch.
 */
(function (global) {
  'use strict';

  const NS = (global.Titrierlabor = global.Titrierlabor || {});
  const STORAGE_KEY = 'titrierlabor.theme';

  const DARK = {
    name: 'dark',
    // Laborbühne
    wall0: '#16202b', wall1: '#0c1219',
    tile: 'rgba(255,255,255,0.025)',
    glow0: 'rgba(120,170,230,0.20)', glow1: 'rgba(80,120,180,0.07)',
    bench0: '#3a4757', bench1: '#283341', bench2: '#10161d',
    benchEdge: 'rgba(200,225,255,0.22)', benchGlow: 'rgba(140,180,230,0.16)',
    shadow: 1,
    // Glas
    glass: 'rgba(225,238,255,0.70)', glassIn: 'rgba(225,238,255,0.22)', glassRim: 'rgba(230,240,255,0.80)',
    glassRim2: 'rgba(235,245,255,0.85)', highlight: 1,
    dropEdge: 'rgba(235,245,255,0.6)', splash: 'rgba(225,240,255,0.7)', stream: 'rgba(235,245,255,0.55)',
    cable: '#11161c',
    // Skalen und Beschriftungen auf der Bühne
    tick: 'rgba(240,246,252,0.92)', scaleText: 'rgba(235,242,250,0.95)',
    scaleSub: 'rgba(200,215,232,0.75)', scaleSub2: 'rgba(200,215,232,0.6)',
    flaskMark: 'rgba(240,246,252,0.75)', flaskField: 'rgba(240,246,252,0.10)', flaskFieldText: 'rgba(240,246,252,0.65)',
    // Etiketten, Lupe, Hinweise
    tagBg: 'rgba(14,22,32,0.82)', tagBorder: 'rgba(140,190,240,0.30)', tagTitle: 'rgba(120,200,255,0.95)',
    tagText: '#e8eef5', tagLine: 'rgba(140,190,240,0.45)', tagDot: 'rgba(140,190,240,0.9)',
    lensBg0: '#24313f', lensBg1: '#121a23', lensLine: 'rgba(140,190,240,0.35)', lensLine2: 'rgba(140,190,240,0.7)',
    lensCaption: 'rgba(200,215,232,0.8)',
    hintRing: '90,200,255', hintBg: 'rgba(14,22,32,0.85)', hintText: '#bfe6ff', tapRing: '255,255,255',
    // Diagramm
    plotBg: 'rgba(255,255,255,0.02)', grid1: 'rgba(255,255,255,0.035)', grid2: 'rgba(255,255,255,0.07)', gridV: 'rgba(255,255,255,0.06)',
    neutral: 'rgba(160,190,220,0.45)', neutralText: 'rgba(160,190,220,0.7)',
    axis: 'rgba(220,230,240,0.55)', axisText: 'rgba(220,230,240,0.85)', axisTitle: 'rgba(160,200,240,0.95)',
    bandText: 'rgba(220,230,240,0.6)', emptyText: 'rgba(200,215,232,0.75)',
    eq: '61,245,138', half: 'rgba(255,200,90,0.8)', halfText: 'rgba(255,210,120,0.95)', teacher: 'rgba(255,190,90,0.55)',
    data: '#4cc9f0', dataGlow: 'rgba(76,201,240,0.25)', dataDot: '#d8f5ff', dataPulse: '76,201,240',
    deriv: '167,139,250', cursor: 'rgba(255,255,255,0.5)', cursorDot: '#ffffff',
    tooltipBg: 'rgba(14,22,32,0.92)', tooltipFg: '#e8eef5', tooltipBorder: 'rgba(140,190,240,0.4)',
    marker: '#ffb547',
  };

  const LIGHT = {
    name: 'light',
    wall0: '#f5f8fa', wall1: '#e7edf2',
    tile: 'rgba(40,70,100,0.06)',
    glow0: 'rgba(255,255,255,0.55)', glow1: 'rgba(255,255,255,0.20)',
    bench0: '#d5dde4', bench1: '#c3ccd5', bench2: '#aab5c0',
    benchEdge: 'rgba(255,255,255,0.8)', benchGlow: 'rgba(255,255,255,0.0)',
    shadow: 0.4,
    glass: 'rgba(70,100,132,0.62)', glassIn: 'rgba(70,100,132,0.24)', glassRim: 'rgba(70,100,132,0.80)',
    glassRim2: 'rgba(70,100,132,0.85)', highlight: 0.9,
    dropEdge: 'rgba(70,110,160,0.6)', splash: 'rgba(120,165,215,0.8)', stream: 'rgba(170,205,240,0.7)',
    cable: '#3a4552',
    tick: 'rgba(20,32,46,0.9)', scaleText: '#1f2f40',
    scaleSub: 'rgba(60,80,100,0.8)', scaleSub2: 'rgba(60,80,100,0.6)',
    flaskMark: 'rgba(40,60,80,0.75)', flaskField: 'rgba(255,255,255,0.75)', flaskFieldText: 'rgba(40,60,80,0.8)',
    tagBg: 'rgba(255,255,255,0.94)', tagBorder: 'rgba(70,100,130,0.30)', tagTitle: 'rgba(31,111,229,0.95)',
    tagText: '#1f2f40', tagLine: 'rgba(31,111,229,0.5)', tagDot: 'rgba(31,111,229,0.85)',
    lensBg0: '#f2f5f8', lensBg1: '#e3e9ef', lensLine: 'rgba(31,111,229,0.4)', lensLine2: 'rgba(31,111,229,0.7)',
    lensCaption: '#3d4b59',
    hintRing: '31,111,229', hintBg: 'rgba(255,255,255,0.94)', hintText: '#1f6fd1', tapRing: '31,111,229',
    plotBg: 'rgba(255,255,255,0.65)', grid1: 'rgba(30,50,70,0.06)', grid2: 'rgba(30,50,70,0.11)', gridV: 'rgba(30,50,70,0.09)',
    neutral: 'rgba(60,90,120,0.5)', neutralText: 'rgba(60,90,120,0.85)',
    axis: 'rgba(40,60,80,0.6)', axisText: '#1f2f40', axisTitle: '#1f6fd1',
    bandText: 'rgba(40,60,80,0.7)', emptyText: 'rgba(60,80,100,0.8)',
    eq: '28,138,74', half: 'rgba(168,100,10,0.8)', halfText: '#a8640a', teacher: 'rgba(190,110,20,0.6)',
    data: '#1f6fd1', dataGlow: 'rgba(31,111,209,0.2)', dataDot: '#0e3f7a', dataPulse: '31,111,209',
    deriv: '109,70,220', cursor: 'rgba(30,50,70,0.5)', cursorDot: '#1f2f40',
    tooltipBg: 'rgba(255,255,255,0.96)', tooltipFg: '#1f2f40', tooltipBorder: 'rgba(70,100,130,0.4)',
    marker: '#c77a00',
  };

  const PALETTES = { dark: DARK, light: LIGHT };
  const listeners = [];

  const api = {
    DEFAULT: 'dark',
    palette: DARK,
    get name() { return api.palette.name; },

    /** Gespeichertes Schema (oder Standard) */
    saved: function () {
      try {
        const s = global.localStorage.getItem(STORAGE_KEY);
        return PALETTES[s] ? s : api.DEFAULT;
      } catch (e) { return api.DEFAULT; }
    },

    /**
     * Schema anwenden: data-theme am <html>, Palette wechseln, Zuhörer benachrichtigen.
     * @param {string} name 'dark' | 'light'
     * @param {boolean} [save] in localStorage merken
     */
    set: function (name, save) {
      const pal = PALETTES[name] || DARK;
      api.palette = pal;
      if (global.document && document.documentElement) {
        document.documentElement.setAttribute('data-theme', pal.name);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', pal.name === 'light' ? '#1b2430' : '#0b1016');
      }
      if (save) {
        try { global.localStorage.setItem(STORAGE_KEY, pal.name); } catch (e) { /* ohne Speicher */ }
      }
      listeners.forEach(function (fn) { fn(pal); });
      return pal;
    },

    toggle: function () { return api.set(api.palette.name === 'dark' ? 'light' : 'dark', true); },
    onChange: function (fn) { listeners.push(fn); },
    PALETTES: PALETTES,
    STORAGE_KEY: STORAGE_KEY,
  };

  NS.Theme = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
