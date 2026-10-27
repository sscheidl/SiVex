# Herkunft übernommener Bausteine

Grundlage ist **TitraLab 3 von Claude**. In diesem Repository liegt es nur als Release vor; entpackter Quellcode ist nicht eingecheckt:

- `apps/titration/release/SiVex-Titration-Claude-v3-web.zip`

Die Dateien wurden am 27.10.2026 aus diesem Archiv (Pfad `titration/…`) gelesen. TitraLab 2 wurde nicht verwendet. Das Titrationslabor und seine Release-Archive bleiben unverändert.

| Neue Datei | Herkunft | Änderungen |
| --- | --- | --- |
| `js/view/geometry.js` | `titration/js/view/geometry.js` | unverändert bis auf den Namensraum `Halbtitration` |
| `js/view/lab-renderer.js` | `titration/js/view/lab-renderer.js` | auf die helle SiVex-Oberfläche umgefärbt (Wand, Bank, Glas, Skala, Lupe, Etiketten); neu: leere/befüllte Bürette mit Luftblase, bewegliche Elektrode, Kalibrieranzeige, Stabilitätsanzeige, eigene Zielmarke, Probe als Füllstand beim Pipettieren; Schlieren-pH über `Chemistry.plumePH`; Wellen nur durch Tropfen und Rührer |
| `js/experiment/lab.js` | Bürettenteil aus `titration/js/experiment/experiment.js` (Hahn, Einzelzugaben, Tropfenbildung, Fallzeit, Volumenbuchhaltung) | neu: Probenvorbereitung, Bürettenstand mit Nachfüllen, Durchmischung, Elektrode mit Ansprechzeit und Stabilitätskriterium, Kalibrierung, Speichern/Wiederherstellen |
| `js/model/indicators.js` | `titration/js/model/indicators.js` | Methylrot und Thymolphthalein ergänzt; Endpunkt-pH je Indikator |
| `js/model/chemistry.js` | Ansatz „Ladungsbilanz, Bisektion in lg c(H₃O⁺)“ aus `titration/js/model/chemistry.js` | neu geschrieben: allgemeines mehrstufiges System mit Gegenionen statt fester Einzelfälle |
| Trennlinie in `js/ui/app.js` | `setPanelWidth`/`bindSplitter` aus `titration/js/ui/app.js` | für zwei Ansichten verallgemeinert |
| `css/app.css` | Farben und Kopfzeile nach `apps/redoxlabor/css/app.css`; `.splitter` nach TitraLab 3 | eigenes Layout |
| `scripts/build.mjs`, `package.mjs`, `serve.mjs`, `js/scorm.js` | `apps/redoxlabor/scripts/…`, `apps/redoxlabor/js/scorm.js` | Namen, Pfade und Manifest angepasst |

Nicht übernommen:

- **Service Worker** von TitraLab 3 (`sw.js`, Cache-Präfix `titrierlabor-`): Die App kommt ohne Service Worker aus. So gibt es keine Cache-Kollision mit TitraLab und keine veralteten Release-Dateien.
- **Lehrkraftmodus mit Zufallskonzentration:** wird nicht benötigt.
- **Altes dunkles Design**

Bestehendes Verhalten von TitraLab 3 haben wir vor der Übernahme geprüft:

- Die Ladungsbilanz war für einprotonige Systeme korrekt.
- `halfEquivalence()` setzte V(ÄP)/2 voraus und ist für Mehrprotonige ungeeignet; das neue Modell rechnet stufenbezogen.
- Die automatische Punktaufnahme bei jedem Tropfen haben wir durch manuelle Übernahme mit Messstatus ersetzt.
- Die mitwachsende x-Achse haben wir durch die feste Bürettenskala bzw. einen auf 5 mL gerundeten Messbereich ersetzt.
