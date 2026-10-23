# Trennlabor 1.0.0 – Testbericht

**Stand:** 22.10.2026 · **Prüfgegenstand:** statischer Build `dist/trennlabor/` sowie die gepackten Dateien `release/trennlabor-1.0.0-web.zip` und `release/trennlabor-1.0.0-scorm12.zip` (byte-identisch mit dem getesteten Quellstand geprüft)

**Prüfumgebung:** Windows 11 Pro · Node.js 24.21.0 · Playwright 1.57.0 (lokal vorhanden; das Projekt pinnt 1.56.1) · Microsoft Edge 155.0.4283.62 (Chromium) headless über `PW_CHANNEL=msedge` · Desktop 1440×900 sowie Tablet-Viewports 1180×820 und 1024×768 mit Touch-Emulation (`hasTouch`)

## Ergebnisübersicht

| Testart | Befehl | Ergebnis |
| --- | --- | --- |
| Unit-/Regressionstests der Fachmodelle und Aufgaben | `npm test` | **71 / 71 bestanden** (classic 29, chroma 13, distill 16, tasks 13) |
| Build- und Paketprüfung | `npm run package` | **Build OK**: 15 Dateien, 367,6 KiB; keine externen Ressourcen, keine absoluten Pfade, kein Netzwerkzugriff; Web-ZIP 108,5 KiB, SCORM-ZIP 108,8 KiB |
| Browser-End-to-End-Tests der echten Oberfläche | `PW_CHANNEL=msedge npm run test:e2e` | **23 / 23 bestanden** ([results.json](../tests/e2e/results.json)) |
| SCORM-Paket im simulierten LMS + Web-ZIP | `PW_CHANNEL=msedge npm run test:scorm` | **10 / 10 bestanden** ([scorm-results.json](../tests/e2e/scorm-results.json)) |

**Gesamtstatus der technischen Entwicklungsabnahme: PASS** – alle Kriterien aus Abschnitt 6.1 des Auftrags sind implementiert und durch ausführbare Tests bzw. Screenshots belegt. Die Praxistests auf Schul-Tablets, in mebis und im Unterricht sind nachgelagert und **nicht blockierend** (siehe unten). Der Repo-Status in `sivex.json` bleibt bis zur praktischen Freigabe `prototype`.

## Kriterien (Abschnitt 6.1)

| Kennung | Status | Nachweis |
| --- | --- | --- |
| A-01 | PASS | E2E `A-01`: drei Laborkarten, jedes Labor geöffnet, ≥ 5 aktive Bedienelemente und ≥ 5 Trefferflächen je Bühne; `01-startansicht.png`, `02-*-leer.png`. Alle drei Labore in SCORM-5/-8 bedient. |
| A-02 | PASS | Unit `Alternative Wege führen ebenfalls zum Ziel` (K-01 per Filtrieren, K-02 per Dekantieren+Nachspülen statt Filtrieren, K-05 kalt+Heizplatte+Filter; K-04 ohne Scheidetrichter ungenauer); E2E-04 (Dekantieren nach Korrektur bzw. direkt), E2E-07 (heiß/kalt), K-03-Unit (Magnet am nassen Filterrückstand). Bewertung ausschließlich am Zustand (`tasks.js`). |
| A-03 | PASS | Mengenbilanz in allen Klassisch-Unit-Tests (`balance()` auf 10⁻⁶), Destillation `balance()` (Ethanol/Wasser inkl. verbrannt, entwichen, verschüttet); Renderer liest nur Zustand (Überarbeitung: kein Schreibzugriff des Renderers). |
| A-04 | PASS | Unit `Zeitraffer …` in allen drei Modellen (identischer Zustand bei unterschiedlichen Schrittweiten); E2E `A-04`: Pause hält die Modellzeit an; App-Zustand bei 1× und 50× gleich dem Referenzmodell bei gleicher Modellzeit. |
| A-05 | PASS | Alle Handlungen als Schaltflächen im Bedienfeld; Bühnen-Trefferflächen für Auswahl/Ziele. E2E-08 vollständig per Touch auf der Bühne (Proben, Auftragepunkte, Kammer); E2E-21 per Touch; Ziehen nur als Zusatz (E2E-04). |
| K-01 | PASS | E2E-04: trübe Ausgangslage, Sedimentieren, „zügig“ → Sand in B (trüb, erkannt), Absetzen + vorsichtiges Umgießen (durch Ziehen) → gelöst (93,7 mL klar); Gegenprobe vorsichtig → gelöst. Unit: ohne Papier läuft Sand durch, flaches Papier trüb, ohne Auffanggefäß Verlust, Rühren im Trichter reißt Papier. `20–23-k01-*.png` |
| K-02 | PASS | E2E-01: Lösen → Filtrieren → Filtrat in Abdampfschale → Eindampfen → Kristalle, Waage 4,5 g, Auswertung, Hefteintrag. `11–16-k02-*.png`. Unit: Salz bleibt im Filtrat, Filtrieren erzeugt kein festes Salz. |
| K-03 | PASS | E2E-05: Magnet 3× (4,997 g Eisen, Sand/Salz unverändert) → Abstreifen → K-02-Weg → drei Fraktionen. Unit: Magnet erfasst nur Eisen; ohne Magnet Eisen im Sand, Korrektur am Filterrückstand. `24–25-k03-*.png` |
| K-04 | PASS | E2E-06: Emulsion → zwei Phasen → Hahn offen/Spalt/zu → Wasser in B, Öl in C → gelöst; Hahn zu lange offen → Mischfraktion erkannt. Unit: offener Hahn ohne Gefäß → Verlust; Ablassen vor Phasentrennung → Mischfraktion; Filtrieren trennt nicht. `26–29-k04-*.png` |
| K-05 | PASS | E2E-07: nach 120 s kalt 0,103 vs. heiß 0,335 Einheiten/mL; Teesieb hält Blüten zurück, Farbstoff geht durch; Antwort „Reinstoff“ abgelehnt. Unit: zu kurz/Blüten im Tee → kein Erfolg. `30–32-k05-*.png` |
| K-06 | PASS | E2E-02 (trocken filtriert), E2E-03 (Filtrat verworfen → 0 g Salz), E2E-04, E2E-06; Unit: Suspension eindampfen → Salz mit Sand, Abdampfen ohne Lösung → kein Salz, hohe Heizstufe → Verspritzen, Magnet nur Eisen. Keiner dieser Fälle gilt als gelöst. |
| C-01 | PASS | Unit `Datensatz` (7 Proben, 2 Laufmittel); E2E-08 (drei Proben nebeneinander), E2E-11 (Vergleich dreier Chromatogramme, `38-c04-vergleich-*.png`). |
| C-02 | PASS | E2E-08: Front steigt kontinuierlich (Messreihe), Schwarz 3 / Grün 2 / Blau 1 Zonen, gemeinsamer blauer Farbstoff auf gleicher Höhe; Unit: Front verlangsamt sich (Washburn). `33–34-c01-*.png` |
| C-03 | PASS | E2E-12 (Referenz eine Zone), E2E-09 (wasserfest in Wasser bleibt auf der Startlinie, in Ethanol-Wasser wandert ein Teil). `35–36-*.png` |
| C-04 | PASS | E2E-10 (Startlinie unter dem Spiegel → ungültig, Fehler benannt), E2E-11 (überladen σ 0,34 → 0,45 cm, Kugelschreiber-Linie ungültig), Unit: Grün in Ethanol-Wasser nicht aufgelöst, Entwicklung zu kurz, Front am Rand, Front eingetrocknet, Deckel. |
| C-05 | PASS | E2E-08 (Lückentext: „Absorption“ gezielt abgelehnt, „Adsorption“ akzeptiert); E2E-12: im Standardmodus keine Rf-Anzeige, im Expertenmodus Rf = 0,60 = 4,0 cm ÷ 6,58 cm (Abweichung < 0,02). Unit: Rf null bei Front am Rand. `39-c05-*.png` |
| D-01 | PASS | E2E-13: vollständiger Aufbau ausschließlich über die Oberfläche; Labor enthält nur den Ethanol-Wasser-Versuch. `40-d01-aufbau-fertig.png` |
| D-02 | PASS | E2E-13: abgelesene Dampftemperatur 85,9 °C während des Tropfens; Unit: Siedebeginn 84–87 °C, stetiger Anstieg ohne Sprung > 1,5 K je Messpunkt, Maximum < 95 °C; Antwort „78 °C → 100 °C sprunghaft“ abgelehnt. Große Anzeige + Verlauf: `42-d01-destillat-tropft.png`. |
| D-03 | PASS | E2E-14: gleiche Modellzeit, mit Kühlung 30,8 mL, ohne 3,8 mL, 28,4 mL entwichener Dampf; E2E-16: Heizung 0 → 0 mL; Unit: Überheizen → wasserreicheres Destillat, ohne Vorlage → Verlust. |
| D-04 | PASS | Unit: Schläuche vertauscht → < 70 % Destillat, Kühlwirkung kleiner; E2E-14 (aus); Darstellung Zulauf/Ablauf beschriftet. `45-d02-*.png` |
| D-05 | PASS | E2E-13: Probe aus der Vorlage in der getrennten Porzellanschale → bläuliche Flamme; Antwort „reines Ethanol“ nicht korrekt. Unit: späte wasserreiche Fraktion brennt nicht, erste Fraktion brennt; Probe aus dem heißen Kolben → Stopp. `43-d01-brennprobe.png` |
| D-06 | PASS | E2E-17: geschlossene Apparatur → sofortiger Stopp, Heizung aus, Fortsetzen erst nach Entfernen des Stopfens; Zünden an der Apparatur → Stopp (`47/48-d05-*.png`). Unit: offene Apparatur, Siedeverzug, Trockenlaufen, Siedesteine in heiße Flüssigkeit abgelehnt. Ungefährliche Fehler (Kühlung, Thermometer, Vorlage) laufen weiter (E2E-14/-15). |
| L-01 | PASS | E2E-02: zweimal gescheitert → Hilfe angeboten (nicht eingeblendet), genau drei Stufen, kleine Hilfe zum Fehler passend, konkrete Hilfe nennt Korrektur, Korrektur wirkt, Hilfe passt sich dem neuen Zustand an. `17/18-hilfe-*.png`; Unit `Hilfe ist zustandsabhängig`. |
| L-02 | PASS | E2E-01: keine Fragen vor gelungenem Versuch; Fragen nutzen eigene Messwerte (Waage). Unit: Fragen aus eingefrorenem Schnappschuss, Zonenzahlen aus eigenem Chromatogramm, nur abgelesene Temperaturen. |
| L-03 | PASS | E2E-01: falsche Beobachtung → gezieltes Feedback; vertauschter Fachbegriff gezielt abgelehnt; richtige Antworten bleiben gesperrt erhalten; „Loeslichkeit“ und „kristalisiert“ (Tippfehler mit Hinweis) akzeptiert. Unit `Lückentext …` (4 Tests). Keine externe KI, keine Netzwerkzugriffe. |
| L-04 | PASS | E2E-01/-13: Hefteintrag erst nach vollständiger Auswertung und Theorie; enthält Versuch/Durchführung, Beobachtung, Erklärung, Ergebnis/Merksatz. `16-k02-hefteintrag.png`, `44-d01-hefteintrag.png` |
| L-05 | PASS | E2E-02 (trockener Filter → Rückstand überführen, lösen), E2E-04 (trübes Ergebnis korrigiert), Unit K-04 (Mischfraktion zurückgießen), K-03 (Eisen aus Filterrückstand), Siedeverzug → abkühlen, Siedesteine, fortsetzen. „Neu beginnen“: nur Aufbau oder ganze Aufgabe (E2E-04, E2E-07). |
| V-01 | PASS | Sichtprüfung der Screenshots: Bechergläser mit Skala, Erlenmeyerkolben, Porzellanschalen in Aufsicht, Trichter mit gefaltetem Papier, Scheidetrichter mit Hahn, Heizplatte, Destillationsapparatur mit Liebigkühler; Gießen, Rühren, Tropfen, Magnet, Pipette, Einstellen des Streifens animiert. |
| V-02 | PASS | Sediment/Trübung (`20/21-k01`), Kristalle (`14-k02`), Phasen/Emulsion (`26/27-k04`), Banden/Laufmittelfront (`33/34-c01`, `38-c04`), Sieden/Dampf/Kondensat/Tropfen (`41/42-d01`). |
| V-03 | PASS | E2E-21 bei 1180×820 und 1024×768 mit Touch: kein horizontales Scrollen, Bühne ≥ 55 % der Breite, alle Trefferflächen vollständig sichtbar, Touchziele ≥ 34 px, Bedienfeld einklappbar; K-01 per Antippen gelöst. Desktop 1440×900 in allen übrigen Tests. `50-tablet-*.png` |
| V-04 | PASS | E2E `V-04`: Labor per Tab/Enter öffnen, Gefäß wählen, Handlung auslösen (Enter/Leertaste) mit Wirkung; sichtbarer Fokusrahmen (`:focus-visible`). Zustände zusätzlich in Text (Hahn zu/Spalt/offen, Heizplatte AUS/NIEDRIG/HOCH, Häkchen mit Bildschirmlesertext). |
| T-01 | PASS | `npm run package` (Build-Prüfung); E2E `T-01` gegen `dist/`: 28 Anfragen, 0 extern, offline weiter bedienbar, Neuladen behält Zwischenstand; keine Konsolenfehler in allen E2E-Szenarien. |
| T-02 | PASS | SCORM-1 bis SCORM-3: Manifest im Paketstamm, SCORM 1.2, SCO `index.html`, alle 15 Dateien gelistet, alle Verweise relativ. |
| T-03 | PASS | SCORM-4 bis SCORM-9: gepacktes ZIP im Mock-LMS (iframe und neues Fenster) gestartet, alle drei Labore bedient, LMSInitialize/LMSFinish genau einmal, keine LMSSetValue/LMSGetValue. `60-scorm-im-mock-lms.png` |
| T-04 | PASS | `npm test`: 71/71 |
| T-05 | PASS | `npm run test:e2e`: 23/23 (alle drei Labore, alle Pflicht-Fehlversuche) |
| T-06 | PASS | 51 Screenshots in `docs/screenshots/` (Start, Zwischenzustände, Abschluss, Fehlversuche, Tablet); Sichtprüfung siehe unten |
| T-07 | PASS | README, `docs/CHEMIE.md`, `docs/TESTBERICHT.md`, `docs/BEDIENUNG.md`, `sivex.json`, Web-ZIP, SCORM-ZIP, `SHA256SUMS.txt` |
| T-08 | PASS | Pull Request mit allen Änderungen auf Branch `trennlabor/v1.0` gegen `main`, kein Merge (Link im PR/Abschlussbericht) |

## Pflichtszenarien des Auftrags (Abschnitt 6.2)

| Nr. | Szenario | Test |
| --- | --- | --- |
| 1 | K-02 positiv bis Hefteintrag | E2E-01 |
| 2 | K-02 trocken filtrieren | E2E-02 |
| 3 | K-02 Filtrat verwerfen | E2E-03 |
| 4 | K-01 vorsichtig/zu schnell, Korrektur | E2E-04 |
| 5 | K-03 drei Stoffe | E2E-05 |
| 6 | K-04 Scheidetrichter, Hahnfehler | E2E-06 |
| 7 | K-05 kalt/warm, Stoffgemisch | E2E-07 |
| 8 | C-01 Schwarz/Grün/Blau | E2E-08 |
| 9 | wasserfester Stift in Wasser | E2E-09 |
| 10 | Startlinie unter Flüssigkeit | E2E-10 |
| 11 | zu viel Farbstoff | E2E-11 |
| 12 | Reinstoff, Rf im Expertenmodus | E2E-12 |
| 13 | D-01 positiv mit Brennprobe | E2E-13 |
| 14 | Kühlwasser aus | E2E-14 |
| 15 | Thermometer falsch | E2E-15 |
| 16 | Heizleistung 0 | E2E-16 |
| 17 | geschlossene Apparatur / Zünden an der Apparatur | E2E-17 |
| 18 | L-01 Hilfe angeboten, konkrete Hilfe, Korrektur | E2E-02 |
| 19 | L-02 falsche Antwort, Tippfehler, Synonyme | E2E-01, E2E-08 |
| 20 | L-03 Hefteintrag gesperrt/freigegeben | E2E-01 |
| 21 | Desktop- und Tablet-Viewports per Tap/Klick | alle E2E (1440×900), E2E-21-1180, E2E-21-1024 |
| 22 | ausgeliefertes Paket, keine kaputten Ressourcen, keine Konsolenfehler | T-01 (Build `dist/`), SCORM-1…9 (gepacktes ZIP) |

Die Browser-Tests bedienen die Oberfläche wie Lernende (Playwright-Klicks im Bedienfeld, `touchscreen.tap` und Mausklicks auf die Trefferflächen der Bühne, Ziehen mit der Maus). Der Modellzustand wird nur **gelesen**, um zu warten (wie Beobachten) und Ergebnisse zu prüfen; er wird nie gesetzt.

## Sichtprüfung

Alle Screenshots wurden angesehen. Während der Entwicklung gefundene und behobene Darstellungsfehler: zu kleine, mittig „schwebende“ Bühne (Szenen verdichtet, unten verankert, Beschriftungen bei kleinem Maßstab automatisch größer), Thermometer von der Digitalanzeige verdeckt (Anzeige verlegt), Meldungen über der Thermometeranzeige (nach unten rechts verlegt), Porzellanschalen als Glas gezeichnet (jetzt undurchsichtig mit Aufsicht auf den Inhalt), Stativring durch den Scheidetrichter, zu breite Lückentextfelder, blasse Banden.

## Während der Prüfung gefundene und behobene Fehler

| Befund | Ursache | Behebung / Regressionstest |
| --- | --- | --- |
| K-02 im Volllauf: Abdampfschale wurde nie ganz trocken | Restwasser ≤ 0,001 mL fiel aus dem Siedezweig heraus | Restmengen verdampfen sofort; Unit „Regression: Restwasser …“ |
| Destillat floss nur halb so schnell wie berechnet | Siedeschritt wechselte zwischen Aufheizen und Verdampfen | Überschussleistung geht direkt ins Verdampfen; Unit D-01 (Destillatmenge) |
| Tipps im Bedienfeld gingen gelegentlich verloren | Bedienfeld wurde bei jeder Modelländerung neu aufgebaut | Neuaufbau nur bei geänderter Darstellung; E2E-Klickhilfe meldet „detached“ |
| Mehrfaches Auftupfen nicht möglich | Probe wurde beim zweiten Antippen abgewählt | Auswahl bleibt bestehen; E2E-11 |
| Emulsion trennte sich unrealistisch schnell | Zeitkonstante 9 s | 25 s; Unit K-04 „Ablassen vor der Phasentrennung“ |
| Probe aus der Vorlage während eines Stopps nicht möglich | Sicherheitssperre zu weit | nur Kolbenprobe gesperrt; Unit „Brennprobe …“ |
| Renderer schrieb einen Merker in den Modellzustand | Darstellungslogik | entfernt (Renderer nur lesend) |

## Bekannte Grenzen

Siehe [CHEMIE.md](CHEMIE.md): didaktisch verkürzte Zeitkonstanten, Modellfarbstoffe mit festen Rf-Werten, Azeotrop Ethanol/Wasser bewusst vernachlässigt, Volumenkontraktion vernachlässigt, kein Rosten von Eisen. Zwischenstände nur im `sessionStorage` des Browserfensters. Auf 1024×768 ist die Laborbühne naturgemäß klein; das Bedienfeld lässt sich einklappen, alle Handlungen bleiben im Bedienfeld erreichbar. Die Browser-Tests liefen mit Edge (Chromium); WebKit/Safari wurde nicht automatisiert geprüft.

## Nachgelagerte Praxistests durch die Lehrkraft – nicht blockierend

Diese Prüfungen sind **kein HOLD** der technischen Abnahme; sie folgen vor dem Status `ready`:

1. **Echte Schul-iPads (Safari):** Touch-Bedienung aller drei Labore, Lesbarkeit der Bühnenbeschriftungen auf 10–11-Zoll-Displays, Leistung der Animationen, Verhalten beim Drehen und bei „Neues Fenster“.
2. **Realer mebis-Kurs:** Upload `release/trennlabor-1.0.0-scorm12.zip` als „Lernpaket (SCORM)“, Darstellung „Neues Fenster“, Start/Neustart nach Kurswechsel, Pop-up-Sperre, kein Datenversand.
3. **Unterricht:** Verständlichkeit der Problemstellungen und Hilfen für NTG 8 / SG 9, Zeitbedarf je Aufgabe, Qualität der Hefteinträge, Fachbegriff-Toleranz der Lückentexte.

## Erneute Ausführung

```bash
cd apps/trennlabor
npm install                      # Playwright für Browser-Tests
npm test
npm run package
PW_CHANNEL=msedge npm run test:e2e     # ohne PW_CHANNEL: Playwright-Chromium, sonst Edge/Chrome
PW_CHANNEL=msedge npm run test:scorm
```

Einzelne Szenarien: `ONLY=E2E-13,E2E-17 npm run test:e2e`.
