# Pufferfish – Herkunft übernommener Teile

| Baustein in Pufferfish | Herkunft | Anpassung |
| --- | --- | --- |
| `labkit/js/core.js`, `splitter.js`, `scorm.js`, `labkit/css/labkit.css` | `shared/labkit/` 0.1.1 (unverändert, beim Bauen kopiert) | keine; app-eigene Farben/Layout in `css/app.css` |
| Glas, Flüssigkeit, Meniskus, Tropfen, Oberflächenwellen, Ringwellen, Spritzer, Mischschlieren (`js/render-lab.js`) | TitraLab 3, `titration/js/view/lab-renderer.js` (`_drawDrop`, `_liquidPath`, `_drawFlask`, `_drawPlumes`, Wellengleichung in `_update`) aus `apps/titration/release/SiVex-Titration-Claude-v3-web.zip` | Zylinder-Bechergläser statt Erlenmeyerkolben, heller Laborhintergrund, Meniskus an der Wand ausdrücklich modelliert, Schliere an die Mischzeitkonstante des Messwerts gekoppelt |
| Füllstand aus Gefäßgeometrie (`js/geometry.js`) | TitraLab 3, `titration/js/view/geometry.js` (Prinzip `heightForVolume`) | h = V / (π r²) für Zylinder |
| Indikatorfarbe als Funktion des berechneten pH | Prinzip aus TitraLab 3, `titration/js/model/indicators.js` | schematischer Universalindikator (Farbstufen statt Lambert-Beer-Mischung eines Einzelindikators) |
| Diagrammachsen (`js/chart.js`) | Prinzip TitraLab 3, `titration/js/view/chart.js` | eigene, kleinere Umsetzung; nur protokollierte Punkte |
| Auswertung: „Antworten prüfen“, Tipp 1/3–3/3, „Lösung anzeigen“ mit Rückfrage, Hefteintrag | Redoxlabor (`apps/redoxlabor/js/ui.js`) bzw. `shared/labkit/DESIGN.md` Abschnitt 6, Umsetzung wie `apps/destillation/js/ui.js` | eigene Inhalte |
| `scripts/build.mjs`, `scripts/package.mjs`, `scripts/serve.mjs` | `apps/destillation/scripts/` (dort aus Trennlabor 1.0.0, Fassung B) | Namen/Pfade, Zeitstempel 27.10.2026 |
| `tests/e2e/lib.mjs`, `tests/e2e/scorm.mjs` (Mock-LMS, ZIP-Leser) | `apps/destillation/tests/e2e/` | eigene Szenarien; Pakete werden frisch auf Platte entpackt und über HTTP gestartet |

Neu entwickelt: chemisches Modell (`js/chem.js`), Zustandsablauf mit Dosierwarteschlange und Mischphase (`js/engine.js`), Teilchenebene mit Zeitlupe (`js/render-particles.js`), Lerninhalte und Bewertung (`js/learn.js`), Oberfläche (`js/ui.js`, `js/app.js`), Pufferfish-Logo (SVG/CSS in `index.html`/`css/app.css`).

Abweichung von `shared/labkit/DESIGN.md` („keine Maskottchen“): Das animierte Pufferfisch-Logo ist ausdrücklicher Auftrag. Es ist rein dekorativ, zeigt keine Messgröße und lässt sich abschalten. Pufferfish ist keine Trenn-App; der Baukasten wird nur genutzt, nicht verändert.
