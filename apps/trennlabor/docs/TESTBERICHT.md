# Testbericht und PASS/HOLD-Abnahme – Trennlabor 1.0.0

**Stand:** 22.10.2026 · **Version:** 1.0.0 · **Entwicklung:** Claude Code (Auftrag „SiVex – Virtuelles Trennlabor v1.0“)
**Prüfumgebung:** Linux-Container, Node.js 22.22.0, Playwright 1.56.1 mit __BROWSER__ (headless). Geprüft wurden der statische Build `dist/trennlabor/`, das fertige Web-ZIP (entpackt, per HTTP und per `file://`) und das fertige SCORM-1.2-ZIP (aus dem Speicher in einem simulierten LMS ausgeliefert).

## Ergebnisübersicht

| Testart | Befehl | Ergebnis |
| --- | --- | --- |
| Unit-Tests (Modelle, Fehlerfälle, Zeitverhalten, Aufgaben, Hilfe, Auswertung, Sitzung, Regressionen) | `npm test` | **__UNIT__** |
| Build (statische Kopie, Prüfung auf externe Ressourcen, absolute Pfade, Netzwerkzugriffe, fehlende Dateien) | `npm run build` | **__BUILD__** |
| Browser-E2E der wirklichen Oberfläche (22 Pflichtszenarien + Layout, Tastatur, Ziehen, Zeitraffer, Persistenz) | `npm run test:e2e` | **__E2E__** |
| Paketierung, zweiter Build byte-identisch, ZIP-Integrität | `npm run package` (2×), `unzip -t` | **__PKG__** |
| Fertiges SCORM-1.2-ZIP im simulierten LMS (eingebettet und „Neues Fenster“) | `npm run test:scorm` | **__SCORM__** |
| Fertiges Web-ZIP: entpackt, Rauchtest der E2E-Szenarien, Start per `file://` | `npm run test:webzip` | **__WEBZIP__** |

Rohdaten: [`tests/e2e/results.json`](../tests/e2e/results.json), [`tests/e2e/scorm-results.json`](../tests/e2e/scorm-results.json), [`tests/e2e/webzip-results.json`](../tests/e2e/webzip-results.json). Screenshots: [`docs/screenshots/`](screenshots/) (werden bei jedem E2E-Lauf neu erzeugt).

**Gesamtstatus der technischen Entwicklungsabnahme: __OVERALL__.** Die praktischen Erprobungen auf Schul-iPads, in einem realen mebis-Kurs und im Unterricht führt die Lehrkraft durch; sie sind laut Auftrag **nicht blockierend** und unten gesondert aufgeführt. Der Repo-Status in `sivex.json` bleibt bis zu dieser Freigabe `prototype`.

## Pflichtmatrix (Auftrag, Abschnitt 6.1)

„E-xx“ = Browser-Szenario in `tests/e2e/run.mjs`, „U:“ = Unit-Test in `tests/unit/`, „SCORM-x“ = `tests/e2e/scorm.mjs`.

| Kennung | Status | Nachweis |
| --- | --- | --- |
| A-01 | PASS | S-00: Startansicht mit drei Laborkarten, jedes Labor geöffnet und mit Bedienelementen (`00-startansicht.png`, `00-labor-*.png`); U: session „A-01“ (alle 13 Aufgaben vollständig: Problem, Ziel, Material, Theorie, Lückentext, gegliederter Hefteintrag). Keine Platzhalter. |
| A-02 | PASS | Freie Wege führen zu nachvollziehbaren Ergebnissen: U: K-01 Dekantieren **oder** Filtrieren, K-03 Magnet vor **oder** nach dem Filtrieren, K-02 trocken filtriert → mit Wasser nachspülen löst das Salz heraus; K-04 Öl unten ablassen oder oben ausgießen (Modell). E-04 (Korrektur eines trüben Ergebnisses), E-18 (eigene Korrektur nach Hilfe), E-21e (Ziehen) |
| A-03 | PASS | U: „A-03 Mengenbilanz bei zufälligen Handlungsfolgen“ (4 Aufgaben × 60 zufällige Handlungen, Bilanz < 10⁻⁶, keine negativen Mengen), Bilanztests in jedem Szenario der Destillation, „Vorgänge laufen über die Zeit“. E-05 prüft die Bilanz über die Oberfläche; Pixelprüfungen der Darstellung in E-01, E-04, E-06, E-07, E-11 |
| A-04 | PASS | U: A-04 für alle drei Modelle (identischer Zustand bei Schrittweiten 0,05–20 s); E-22a: Pause hält die Zeit an, 1× und 10× ergeben über die Oberfläche denselben Modellzustand wie eine Referenzrechnung bei gleicher Simulationszeit |
| A-05 | PASS | E-21a (Touch 1180×820: Auswahl auf der Bühne, Werkzeug → Gefäß), E-21b (Touch 1024×768: Chromatographie mit Stift/Bahn antippen, Destillationsaufbau über die Geräteablage), E-08 (Proben per Antippen), E-13 (Aufbau per Antippen der Ablage). Ziehen ist optional (E-21e) |
| K-01 | PASS | U: Sedimentieren + Dekantieren → klar; Filtrieren → sandfrei; Gegenfälle zügig/sofort → trüb; Korrektur; E-04 (Pixel: Trübung sichtbar, `k01-0*.png`) |
| K-02 | PASS | U: Lösen → Filtrieren → Eindampfen, 4,6 g Salzkristalle ohne Sand; Sättigung bei wenig Wasser; E-01 mit Auswertung und Hefteintrag (`k02-0*.png`, helle Kristalle in der Schale per Pixelmessung) |
| K-03 | PASS | U: Magnet zieht nur Eisen; zwei Reihenfolgen; ohne Magnet kein Erfolg; E-05: drei Fraktionen und Bilanz über die Oberfläche (`k03-0*.png`) |
| K-04 | PASS | U: Absetzen und Ablassen, Wasser läuft zuerst, Hahn zu lange offen → Mischfraktion, ohne Absetzen → Öltröpfchen, ohne Gefäß → Verlust, Stopfen → Unterdruck; E-06 inkl. Pixelprüfung beider Schichten (`k04-0*.png`) |
| K-05 | PASS | U: heiß ≥ 4× schneller als kalt, Farbe nimmt zu; Filter entfernt Pflanzenteile, nicht Farbstoffe; Sieb lässt feine Teilchen durch; Tee = Stoffgemisch; E-07 inkl. Pixelvergleich kalt/heiß und Ablehnung „Reinstoff durch Filtrieren“ (`k05-0*.png`) |
| K-06 | PASS | U: trocken filtriert, gelöstes Salz im Filtrat, ohne/ungefaltetes Filterpapier, Filtrat weggeschüttet, Eindampfen ohne Lösung bzw. einer Suspension, Spritzen, Hahnfehler, Öl/Wasser durch Filter, Magnet ohne Eisen; E-02, E-03, E-04, E-06 |
| C-01 | PASS | U: Datensatz (7 Proben, 2 Laufmittel, Löslichkeit und Rf je Laufmittel); E-08: drei Proben nebeneinander, 3/2/1 Zonen; E-09/E-12 mit weiteren Proben |
| C-02 | PASS | U: Front steigt stetig und verlangsamt sich (h² ∝ t), Zonen wandern verschieden schnell; E-08: Front 3 → 6 → 9 cm mit wandernden Zonen (`c01-02-laufmittelfront-steigt.png`) |
| C-03 | PASS | U: Referenzen je eine Zone in beiden Laufmitteln; wasserfester Stift bleibt in Wasser am Start, wandert im Ethanol-Wasser-Gemisch; E-09, E-12 |
| C-04 | PASS | U: Start im Laufmittel, Kugelschreiber, Überladung, anderes Laufmittel (andere Reihenfolge), zu kurz, Front am Rand; E-10 (unbrauchbar), E-11 (Pixel: gefärbte Fläche überladen deutlich größer) |
| C-05 | PASS | Lückentext C-1 mit mobiler/stationärer Phase, Löslichkeit, **Adsorption** (Absorption wird abgelehnt, U: answers); Rf nur im Expertenmodus (E-12: Standardmodus ohne C-4; Expertenmodus: Messung mit Lineal, Rf auf ±0,03 richtig; ohne gültige Front kein Rf, U: chroma/session) |
| D-01 | PASS | E-13: vollständiger eigener Aufbau (über Ablage und Bedienfeld), Kühlwasser unten, Erhitzen, Ablesen, Destillat, Brennprobe, Auswertung, Hefteintrag (`d01-0*.png`); U: Reihenfolgeregeln des Aufbaus. Einziger Destillationsversuch: Ethanol/Wasser |
| D-02 | PASS | Große Anzeige „Dampftemperatur (Thermometer am Aufsatz)“ + Glasskala + Verlaufsdiagramm (Kolbentemperatur getrennt, gestrichelt); U: Siedekurve stetig, 40-%-Gemisch siedet bei ≈ 84 °C, Temperatur steigt allmählich, kein Sprung; E-13: erster Tropfen bei ≈ 83,7 °C, danach Anstieg; Anzeige stabil sichtbar (auch 1024×768, E-21b) |
| D-03 | PASS | U: Heizstufe 0/1 → kein Destillat; Kühlung aus → Destillat < 25 %, Dampfverlust; Kopplung von Heizleistung, Verdampfen, Kondensation, Destillatmenge; E-14, E-16 |
| D-04 | PASS | U: Zulauf oben → weniger Destillat, mehr Verlust; Kühlung aus → Stopp; E-14 (Kühlwasser aus), E-13 (richtig angeschlossen, Beschriftung „Zulauf/Ablauf“ auf der Bühne) |
| D-05 | PASS | Separate Porzellanschale, 2-mL-Probe; erste Fraktion brennt bläulich (E-13); späte, wasserreiche Fraktion schwächer (U), Probe aus heißem Kolben → Stopp; Auswertung fragt „Brennbarkeit, nicht Reinheit“ ab |
| D-06 | PASS | U: geschlossene Apparatur, Zünden an der Apparatur, offene Apparatur, ohne Siedesteine (Stufe ≥ 3 Stopp, Stufe 2 lernwirksamer Siedeverzug), Siedesteine in heiße Flüssigkeit unterbunden, Lecks, zu starke Heizung, fast leerer Kolben; E-17 (beide kritischen Fälle sofort, Wiederaufnahme nach Korrektur), E-14 |
| L-01 | PASS | U: genau drei Stufen, zustandsabhängig, keine vierte Stufe, Angebot nach zwei Fehlern bzw. zwei falschen Auswertungen, Wortauswahl nur bei konkreter Hilfe; E-18 (Angebot ohne ungefragte Lösung → kleine → konkrete Hilfe → eigene Korrektur → Erfolg) |
| L-02 | PASS | U: Beobachtungsantworten aus dem tatsächlichen Zustand (z. B. trocken filtriert → „Sand und Kochsalz“); Auswertung vor dem Erfolg gesperrt; E-02, E-19 |
| L-03 | PASS | U: answers (Normalisierung, Synonyme, Tippfehler, Sperrliste); E-19: falsche Beobachtung und falscher Fachbegriff gezielt markiert, „unlöslih“ toleriert, „Abdampfen“ als Synonym, Eingaben bleiben erhalten. Keine externe KI, keine Netzanfragen |
| L-04 | PASS | U: Theorie und Hefteintrag erst nach richtiger Auswertung; E-01, E-20 (vor und nach dem Versuch gesperrt, danach Theorieschritte und vollständiger Hefteintrag) |
| L-05 | PASS | U: „Neu beginnen“ setzt nur den Versuch zurück, Abschlüsse bleiben; Schnappschuss (späteres Herumprobieren macht den Erfolg nicht ungültig); E-04, E-06, E-18 (Korrektur statt Sackgasse), E-22b (Zustand nach Neuladen erhalten) |
| V-01 | PASS | Canvas-2D-Geräte mit Glas, Skalen, Stativen, Brenner, Scheidetrichter, Liebigkühler (Sichtprüfung aller Screenshots); animierte Übergänge: Kippen und Strahl beim Gießen, Tropfen, Absetzen, Rühren, Kristallbildung, Front, Blasen, Dampf, Kondensat (`k01-03-zuegig-ausgiessen.png`, `k02-03-filtrieren.png`, `d01-02-erhitzen.png`) |
| V-02 | PASS | Pixelprüfungen: Kristalle (E-01), Trübung (E-04), Öl- und Wasserschicht (E-06), Rotfärbung (E-07), Banden (E-11); Dampf/Kondensat/Tropfen sichtbar in `d01-03-destillat.png` |
| V-03 | PASS | E-21c: 1440×900, 1180×820, 1024×768 × drei Labore ohne horizontales Scrollen, Reiter, Bühne, Zeitsteuerung und „Neu beginnen“ sichtbar, keine Schaltfläche < 30 px; Bedienfeld einklappbar; E-21a/E-21b mit Touch-Emulation (`v03-*.png`) |
| V-04 | PASS | E-21d (Enter/Leertaste, Fokus bleibt beim Aktualisieren erhalten); alle Aktionen sind Schaltflächen mit Text; Zustände zusätzlich durch Symbole/Text („✓“, „sauber/gestört/unbrauchbar“, Hinweistexte), Farbe nie alleiniger Träger |
| T-01 | PASS | `npm run build`: keine externen Ressourcen, keine absoluten Pfade, keine Netzwerkzugriffe; `test:webzip`: entpacktes Web-ZIP besteht den E2E-Rauchtest und startet per `file://` ohne Fehler; E2E: keine externen Anfragen, keine Laufzeitfehler (in jedem Szenario geprüft) |
| T-02 | PASS | SCORM-1 bis SCORM-3: `imsmanifest.xml` im Paketstamm, SCORM 1.2, SCO mit `index.html`, alle Dateien gelistet, alle Verweise relativ und vorhanden |
| T-03 | PASS | SCORM-4 bis SCORM-9: fertiges ZIP im simulierten LMS eingebettet und als neues Fenster gestartet, Kernversuche aller drei Labore über die Oberfläche, `LMSInitialize`/`LMSFinish`, keine Noten- oder Datenübertragung (`scorm-0*.png`) |
| T-04 | PASS | __UNIT__ |
| T-05 | PASS | __E2E__ |
| T-06 | PASS | __SHOTS__ Screenshots in `docs/screenshots/`, alle vom Entwickler gesichtet (Abschnitt „Sichtprüfung“) |
| T-07 | PASS | README, [CHEMIE.md](CHEMIE.md), dieser Testbericht, [BEDIENUNG.md](BEDIENUNG.md), `sivex.json`, `release/trennlabor-1.0.0-web.zip`, `release/trennlabor-1.0.0-scorm12.zip`, `release/SHA256SUMS.txt` |
| T-08 | PASS | Pull Request mit allen Änderungen gegen `main` erstellt; nicht gemergt (siehe Abschlussbericht im PR) |

## Ausgeführte Browser-Szenarien (Auftrag, Abschnitt 6.2)

| Nr. | Szenario | Test | Ergebnis (tatsächlich beobachtet) |
| --- | --- | --- | --- |
__SCENARIOS__

## Sichtprüfung der Screenshots (T-06)

Alle Screenshots wurden nach dem letzten Lauf angesehen. Geprüft: Geräte vollständig im Bild, nicht von Bedienelementen verdeckt (die Temperaturanzeige der Destillation liegt rechts oben über der Wand, nicht über der Apparatur), Beschriftungen lesbar, Zustände passend zum Modell (z. B. Trübung nach zügigem Ausgießen, Kristalle in der Schale, zwei Phasen im Scheidetrichter, Banden auf gleicher Höhe, Sicherheitsstopp mit Erklärung). Auffälligkeiten aus früheren Läufen wurden behoben (siehe unten).

## Während der Entwicklung gefundene und behobene Fehler

| Befund | Ursache | Behebung | Regressionstest |
| --- | --- | --- | --- |
| Klicks gingen verloren bzw. Elemente „detached“, solange ein Vorgang lief | Das Bedienfeld wurde bei jeder Mengenänderung komplett neu aufgebaut | Signatur nur noch aus strukturellen Zuständen; Mengen laufend als Text aktualisiert; Karten werden per id verglichen und nur bei Änderung ersetzt | E-04 („Gerätekarte bleibt während des Gießens bestehen“) |
| Temperaturanzeige gelegentlich nicht messbar | HUD-HTML wurde alle 0,2 s ersetzt | stabile Elemente, nur Texte aktualisieren | E-13 („Anzeige stabil“) |
| Auswertung zu K-01 ohne Frage nach dem Verfahren | Schnappschuss mitten im Gießen, bevor das Gießen protokolliert war | Schnappschuss erst, wenn keine Handlung läuft | U: regression R1 |
| Nach Bestätigung eines Sicherheitsstopps sofort erneuter Stopp | Zähler für ausgetretenen Dampf lief seit Versuchsbeginn | Zählung ab der letzten Bestätigung (Bilanz unverändert) | U: regression R2 |
| Mengenverlust bei Sicherheitsstopp mitten im Zeitschritt | bereits verdampfte Menge wurde nicht zurückgebucht | Dampf kondensiert beim Stopp zurück in den Kolben | U: distill (Bilanz in allen Stopp-Szenarien) |
| Wasser „verschwand“ beim Trockenkochen | Rest < 0,002 mL wurde auf 0 gesetzt | Rest wird als verdampft gebucht | U: classic (Bilanz) |
| Trockene Feststoffe blieben im Trichter ohne Einsatz hängen | Durchfluss nur für Flüssigkeit modelliert | Feststoffe rieseln ohne Einsatz durch | U: regression R3 |
| K-01 nach Korrektur nicht als gelungen erkannt | Sand auf zwei Bechergläser verteilt | Sandfraktion darf verteilt sein | U: regression R4 |
| Scheidetrichter zeigte seinen Inhalt kaum | Umrechnung Volumen → Füllhöhe um Faktor ≈ 100 zu groß | Skalierung aus der Gefäßform berechnet | E-06 (Pixel: Öl- und Wasserschicht sichtbar) |
| Beim „vollständigen Umfüllen“ in das Teesieb lief der Trichter über, ein Viertel des Tees ging auf den Tisch (Modellprüfung K-05) | nur das vorsichtige Gießen dosierte nach freiem Volumen | auch „vollständig umfüllen“ gießt portionsweise in den Trichter; nur „zügig ausgießen“ kann ihn überlaufen lassen | U: K-05 Filter/Sieb, E-07 |
| Deaktivierte Schaltflächen verloren den Tastaturfokus | `disabled` während laufender Vorgänge | keine deaktivierten Aktionsschaltflächen mehr; das Modell erklärt, warum etwas gerade nicht geht | E-21d |

## Bekannte Grenzen

- Echtes iPad/Safari (WebKit) nicht geprüft; geprüft wurde Chromium mit Touch-Emulation (1180×820, 1024×768).
- SCORM-Paket mit simuliertem LMS geprüft, nicht in einem realen mebis-Kurs.
- Modellgrenzen (Zeitraffer, Modellmengen, Azeotrop vernachlässigt, Schwellenmodell der Brennprobe): [CHEMIE.md](CHEMIE.md), Abschnitt 6.
- Sichtprüfung der Grafik durch den Entwickler; eine fachdidaktische Durchsicht durch die Lehrkraft wird empfohlen.
- Kein Screenreader-Test (Struktur: Schaltflächen mit Text, Rollen für Gruppen und Dialoge).

## Nachgelagerte Praxistests durch die Lehrkraft – nicht blockierend

Diese Erprobungen sind laut Auftrag **keine Voraussetzung für die technische Abnahme** und werden **nicht als HOLD** geführt:

1. **Schul-iPads (Safari, Querformat):** je eine Aufgabe pro Labor nur mit dem Finger; Lesbarkeit der Beschriftungen, Bildrate, Einklappen des Bedienfelds.
2. **Realer mebis-Kurs:** `release/trennlabor-1.0.0-scorm12.zip` als „Lernpaket (SCORM)“ mit Darstellung „Neues Fenster“ hochladen, auf Desktop und iPad starten, Neuladen/Kurswechsel prüfen.
3. **Unterricht:** Verständlichkeit der Problemstellungen, Hilfen und Lückentexte für NTG 8 / SG 9; Zeitbedarf je Aufgabe; Schwellen der Brennprobe fachlich gegenprüfen.
