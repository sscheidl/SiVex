# Destillation 0.2.0 – Testbericht

**Stand:** 25.10.2026 · **Prüfgegenstand:** statischer Build `dist/destillation/` und die daraus gepackten Dateien `release/destillation-0.2.0-web.zip` und `release/destillation-0.2.0-scorm12.zip` (byte-identisch mit dem getesteten Build geprüft, PKG-1) · **Baukasten:** `shared/labkit` 0.1.1 (rückwärtskompatible Erweiterung um `minStage`; Chromatographie-Regression E12/E13 bestanden)

**Prüfumgebung:** Windows 11 Pro · Node.js 24.22.1 · Playwright 1.56.1 · Microsoft Edge 156.0.4314.42 (Chromium) headless über `channel: 'msedge'` · Desktop 1440×900, Tablet-Viewports 1180×820 und 1024×768 mit Touch-Emulation (`hasTouch`), schmal 820×1100

## Ergebnisübersicht

| Testart | Befehl | Ergebnis |
| --- | --- | --- |
| Unit- und Regressionstests: Fachmodell, Geometrie, Aufgaben, Baukasten | `npm test` | **47 / 47 bestanden (Modell 29, Geometrie 6, Aufgaben 7, Labkit 5)** |
| Build- und Paketprüfung | `npm run package` | **Build OK: 13 Dateien, 249,6 KiB, Labkit 0.1.1 – keine externen Ressourcen, keine absoluten Pfade, kein Netzwerkzugriff; Web-ZIP 78,4 KiB, SCORM-ZIP 78,7 KiB; zweimal gepackt → identische Prüfsummen** |
| Browser-End-to-End mit echter Bedienung | `npm run test:e2e` | **13 / 13 Szenarien bestanden** ([results.json](../tests/e2e/results.json)) |
| SCORM-Paket im Mock-LMS (eingebettet + neues Fenster), Web-ZIP per `file://` | `npm run test:scorm` | **16 / 16 Prüfungen bestanden** ([scorm-results.json](../tests/e2e/scorm-results.json)) |

**Gesamtstatus der Entwicklungsabnahme: PASS.** Alle entwicklerseitig prüfbaren Pflichtkriterien (Abschnitt 9 des Auftrags) sind erfüllt und belegt. Nicht blockierend und **nicht getestet**: echte Schul-iPads, mebis-Kursimport und Unterricht (Abschnitt 10 des Auftrags: Aufgabe der Lehrkraft). Der Status in `sivex.json` bleibt `prototype`.

Die Browsertests bedienen ausschließlich die gerenderte Oberfläche: Klicks und Tipps auf die Trefferflächen der Laborbühne, die Handlungsleiste, die Schalter für Heizung und Kühlwasser, das Bedienfeld, Tastatur sowie Ziehen an der Trennlinie (Maus und Touch über CDP). Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen, nie gesetzt (`tests/e2e/lib.mjs`). Abgelesene Temperaturen stammen aus der Anzeige (Textspiegel `#readout`), nicht aus dem Modell.

## Überarbeitung 0.2.0 nach der Durchsicht der Lehrkraft

| Rückmeldung | Umsetzung | Nachweis |
| --- | --- | --- |
| Klemmen am Kolbenhals (90° verdreht) und am Kühler weglassen | Klemmbacken und zweites Stativ entfernt; Stativarm hinter dem Hals; Schliffklemme am Hals um 90° gedreht | `01-start-vormontiert.png`, Unit `G-01 …` (Verbindung „Stativklemme ↔ Kühlmantel“ entfällt) |
| Wasserzulauf-Konstruktion seltsam | Laborarmatur am Ausguss, Zulaufschlauch aus der Armatur hinter der Vorlage zum unteren Anschluss | neue Sollverbindung „Zulaufschlauch ↔ Laborarmatur“, Lageprüfung „Armatur am Ausguss“; `04`, `40-layout-*` |
| Feuerzeug neigt sich zur Pipette; Animation beim Anzünden und bei der Probenahme | Neigung zur Schale; Handgriffe `sample`, `toDish`, `light` im Modell mit festem Wirkzeitpunkt, Darstellung der Bewegung aus dem Handgriff | E01 `09a-probe-wird-entnommen.png`, `09b-probe-wird-ueberfuehrt.png`, `09c-zuenden-funke.png`, `09-brennprobe-blaue-flamme.png` |
| Tropfen/Flüssigkeit wie im TitraLab | Fall mit Schwerkraft (2600 Einheiten/s² wie TitraLab 3), Ringwellen, Spritzer, Wellen der Oberfläche, Strahl im Zeitraffer | E01 Bildfolge der Vorlage verschieden; `07`, `08` |
| grauer Stopfen und Balken hinter der Vorlage | Stopfen vom Tisch und Kurbel des Laborboys entfernt; Stopfen als Schalter in der Fußleiste, sichtbar nur aufgesetzt | E09 (Stopfen über die Fußleiste) |
| Namen/Erkunden während des Versuchs sperren; beim Erkunden keine Fehlermeldungen; Ethanol und Siedesteine ergänzen | Namen/Erkunden nur vor dem Versuch, sonst deaktiviert; währenddessen alle Handgriffe gesperrt, keine Meldungen; Gemisch, Siedesteine (Schälchen), Armatur, Ausguss, Pipette, Schale, Feuerzeug erkundbar | E10 (gesperrte Schalter, keine Bühnen-Handgriffe, keine Meldung, Gemisch/Siedesteine erkundbar, nach dem Einfüllen gesperrt), `31`, `31b` |
| Kommentare oben an freier Stelle; Temperaturanzeige links neben dem Thermometer | Meldeband oben (54 px, Szene darunter eingepasst); Anzeige über dem Aufsatz links neben dem Stiel | `07`, `09`; Lageprüfung „Digitalanzeige über dem Aufsatz“ |
| Skala am Erlenmeyer; Vorlage beim Wegstellen gleich groß; Antippen hin und zurück | Skala 20–80 mL auf einer Linie; abgenommene Vorlage in voller Größe am Prüfplatz bzw. neben dem Aufbau (mit Bewegung); Antippen und „Vorlage abnehmen/unterstellen“ in beide Richtungen | E09 (Antippen ab/zurück), E01 (`09a`) |
| orange „Phase“ beim Sieden | Glut hinter dem Kolben entfernt, Heizgewebe neutral; Hitze nur an der Heizschicht im Schnitt | `06-sieden-blasen.png` |
| Probenahme nur mit abgebauter Vorlage | Modell lehnt Probe aus der montierten Vorlage ab | Unit `E-06 Brennprobe …`, E01 (Versuch an montierter Vorlage ohne Wirkung) |
| Warnung vor dem Übertritt des Wassers | Warnung je Vorlage, sobald < 5 % des gesammelten Stoffs im Kolben übrig sind | Unit `M-03 Warnung, bevor nach dem Ethanol das Wasser übergeht`, E02 |
| Siedediagramm immer | Diagramm in allen Modi | E03, E11 |
| „Versuch neu beginnen“ in die Kopfzeile; Thermometer/Vorlage in die Fußleiste | „Neu beginnen“ in der Kopfzeile (Rückfrage im Bedienfeld); alle Bedienelemente in zwei Zeilen unten | E12 (Sichtbarkeit aller Bedienelemente bei drei Größen) |
| Kolben im Verhältnis zum Kühler ≈ 20 % größer, Geräte und Verbindungen angleichen | Kolben 46 → 50, Kühler 390 → 355 (Verhältnis +19 %); Heizpilz, Laborboy, Aufsatz, Vorstoß, Vorlage und Schläuche folgen über die Anker | Unit `G-01 …`, `G-02 …`; E12 misst alle Verbindungen am Bildschirm |

## Korrekturzyklus (Auszug)

Gefunden durch Browserdurchläufe und Sichtprüfung, behoben und erneut geprüft:

| Befund | Ursache | Behebung |
| --- | --- | --- |
| Destillat „riss“ nach dem Ethanol schlagartig das Wasser mit | gespeicherte Wärme wurde als Verdampfungsleistung gezählt (Schwelle „heftiges Sieden“) | nur tatsächlich verbrauchte Verdampfungsenergie zählt; Unit-Test Bilanz/Plateaus |
| Thermometer zeigte 75–76 °C statt Dampftemperatur | Sieden wechselte von Schritt zu Schritt; ungeglättete Ankopplung | Siedebedingung über die verfügbare Energie, geglättete Dampfankopplung |
| Spurenreste pendelten endlos zwischen Kolben und Aufsatz | Rücklauf gab auch letzte Reste zurück | aufgebrauchte Stoffe ziehen mit dem Dampf weiter |
| Thermometerkugel „zu hoch“ lag außerhalb des Aufsatzes | Abgang zu nah an der Oberkante | Abgang tiefer, Lageprüfung in `geometry.checks` |
| Handlungsleiste zweizeilig bei 1440 px, Schalterleiste zweizeilig bei 1024 px | zu lange Beschriftungen | gruppierte Thermometer-Tasten, kurze Ansicht-Tasten, kompaktere Schalter |
| Beschriftungen überlappten (Stativ/Rundkolben, Destillat/Vorlagen-Etikett) | frei gewählte Schildpositionen | Schilder in freien Spalten neben dem Stativ und der Vorlage |
| Digitalanzeige auf Tablets zu klein, Sicherheitsleiste verdeckte sie | Anzeige rein weltskaliert; Leiste mittig | Mindestgröße 150 × 66 px; Leiste rechts oben |
| Vorlage mit 14 mL kaum erkennbar | Flüssigkeit zu blass auf hellem Glas | kräftigere Füllung mit Spiegellinie |
| Beim ersten Bild wurden alte Tropfen als Strahl gezeigt | Tropfenliste beim Laden nachgeholt | Tropfen erst ab dem aktuellen Stand |
| Ablaufschlauch-Ende bei 1180 px vom Stopfen verdeckt (E12) | 44-px-Trefferflächen überlappten | Schlauchende im Ausguss; E12 prüft jetzt jede Trefferfläche auf Verdeckung |
| Nach „Verstanden“ sofort zweiter Stopp „geschlossene Apparatur“ (E09) | nachsiedender Dampf bei noch aufgesetztem Stopfen | Stopp im Betrieb nur bei eingeschalteter Heizung; Unit-Test |

## PASS/HOLD-Matrix (Abschnitt 9)

| ID | Status | Nachweis |
| --- | --- | --- |
| S-01 | PASS | Unit `M-03 Stoffdaten` (genau `ew`, `pw`, `pew`; nur `pew` mit `expert`), `S-01 Dreistoffgemisch nur im Expertenmodus`; E03: Aufgabe 3 erscheint erst nach „Expertenmodus“. Keine Laborauswahl, keine weiteren Gemische, keine Erdölfraktionierung. |
| S-02 | PASS | E01 `01-start-vormontiert.png`: Stativ, Heizpilz auf Laborboy, Rundkolben, Aufsatz, Thermometer, Liebigkühler, Vorstoß, leere Vorlage sind montiert; Modell-Startzustand (Unit `S-03/M-01 Startzustand`). Kein Zusammenbau. |
| S-03 | PASS | E01 (Maus) und E05/E07 (Touch): Gemisch einfüllen mit sichtbarem Trichter/Becherglas (`02`), Siedesteine (`03`), Thermometer ▼ auf Höhe des Abgangs, Schläuche durch Antippen von Schlauchende und Anschluss, **Kühlwasser EIN/AUS** und **Heizung EIN/AUS** als getrennte beschriftete Schalter, Heizstufe niedrig/mittel/hoch, Durchfluss gering/mittel/stark; E07 schaltet beide unabhängig (Wasser ein bei kalter Apparatur, aus/an ohne Heizung, Beschriftungen „Heizung EIN“, „Kühlwasser AUS“ geprüft). Auffangen, Vorlage abnehmen/unterstellen per Fußleiste oder Antippen (E09), Vorlagenwechsel (E03). Alle Bedienelemente unten. |
| S-04 | PASS | Unit `L-02/L-04/S-04 Geräte-Trainer`: 12 Teile inkl. Kühlwasserzulauf/-ablauf, Vorlage ≠ Destillat (gezielte Rückmeldung „Vorlage ist das Gefäß …“); E10: Zuordnung falsch → 1 von 12 mit Erklärung → 12/12 (`29`, `30`); „Erkunden“ hebt Gerät hervor und zeigt Funktion (`31`); „Namen“ beschriftet alle Teile (`42-beschriftung-*`). |
| M-01 | PASS | Unit `M-01 Heizstufe wirkt` (niedrig/mittel/hoch → Siedebeginn später/früher, Destillat weniger/mehr), `M-01/E-04 Heizung aus → kein Sieden`, `S-03/M-01 … Heizung schaltet sofort, Wärme fließt verzögert`; E07: Heizpilz niedrig 57 °C → hoch 83 °C, kein Temperatursprung beim Einschalten. |
| M-02 | PASS | Unit `M-02/E-03 Thermometerlage` (richtig 79–81 °C, zu hoch > 10 K zu niedrig, zu tief zu hoch), `M-02/G-10 Temperaturverlauf` (stetig, < 3 K/s); E06: zu hoch 62,0 °C → korrigiert 79,2 °C, abgelesen aus der Anzeige. |
| M-03 | PASS | Unit `M-03 Idealisiertes Trennmodell`, `M-03/M-04 ew` (E > 97 %, 78–81,5 °C), `pw` (P > 97 %, 56–59 °C), `Dreistoffgemisch` (P/E/W bei 57/79/100 °C, 30/30 mL); E02: 57,2 °C, 100 % Propanon; E03: Fraktionen P 57,6 °C · E 79,3 °C · W 99,9 °C. Modellgrenze in App, CHEMIE.md, Hefteintrag. |
| M-04 | PASS | Unit `M-04 Bilanz in allen Gemischen` (alle 60 s über 30 min, Abweichung < 10⁻⁶ mL) und Bilanzprüfung in allen Fehlerfällen (Siedeverzug, ohne Kühlung, hohe Heizung, ohne Vorlage, Brennprobe); E01 prüft `engine.balance()` am Ende; Expertenmodus zeigt die Bilanz (`16-ergebnisse-experte.png`). |
| M-05 | PASS | Unit `M-05/E-01 Kühlleistung wirkt`, `M-05 Kühlwasser AUS während des Betriebs` (stehendes Wasser kühlt kurz weiter, Manteltemperatur > 40 °C, danach Dampf), `M-05 Durchfluss wirkt bei starker Heizung`; E04: bei gleicher Modellzeit 12,4 mL mit vs. 3,5 mL ohne Kühlung, 4,1 mL Dampfverlust; E07: Kondensation 4,8 → 2,5 mL/min nach „Kühlwasser AUS“. |
| M-06 | PASS | Unit `M-06 Feste Zeitschritte` (Stückelung 1,5 s vs. 0,37 s → identischer Zustand auf 9 Stellen); Labkit-Test der Schrittzahl; E11: Pause friert Bild und Modell ein (pixelgleiche Folgebilder). |
| G-01 | PASS | Unit `G-01 Alle Sollverbindungen` (11 Verbindungen < 10⁻⁹), `G-01 Lagebedingungen` (15 Bedingungen), `G-01 Schläuche …`, `G-01 Richtige Schlauchführung kreuzt nichts`; E12 misst alle Verbindungen am Bildschirm (< 0,5 px) bei 1440×900, 1180×820, 1024×768 (`40-layout-*`). Sichtprüfung siehe unten. |
| G-02 | PASS | Unit `G-02 Gleichmäßige Skalierung` (7 Bühnengrößen, Kühlerneigung unverändert); E12: Splitter mit Maus dreimal, Touch (CDP), Pfeiltasten, Pos1 und Doppelklick – nach jedem Schritt Verbindungen, Szenengrenzen, Bedienelemente, Trefferflächen ≥ 44 px und deren Verdeckungsfreiheit geprüft (`41-splitter-gezogen-*`). |
| G-03 | PASS | Glas/Meniskus/Glanz nach TitraLab 3; E01: Füllstand steigt beim Einfüllen (Messreihe), sinkt beim Sieden in vier Folgemessungen; Unit `G-03 Füllstände aus dem Volumen`. `02`, `06`, `08`. |
| G-04 | PASS | E01: keine Blasen beim Aufheizen (`05`), Blasen beim Sieden (`06`); E11: Bildausschnitt des Kolbens ändert sich beim Sieden, bleibt in der Pause gleich; Blasenrate aus `fx.boil` (Heizleistung), Siedekeime nur mit Siedesteinen, ohne Siedesteine Siedeverzug (`23`). |
| G-05 | PASS | Dampf unsichtbar in allen Standardbildern (`06`, `07`); Teilchen nur im gekennzeichneten Erklärmodus (`34-erklaermodus-teilchen.png`, Hinweis „in Wirklichkeit unsichtbar“) und in der Detailansicht; Dampfaustritt zurückhaltend mit Warnhinweis (`18`, `22`). |
| G-06 | PASS | Kondensatfilm und rinnende Tropfen im Innenrohr (`33-zustand-kondensierend.png`), Film im Vorstoß, hängender Tropfen an der Spitze, einzelne fallende Tropfen (E01: Vorlage-Bildfolge verschieden, Tropfenzähler steigt); Tropfenrate aus Kondensationsrate (Unit `M-05 …`). |
| G-07 | PASS | Mantel füllt sich nach „Kühlwasser EIN“ von unten (E01 `04`, Unit `S-03 Schläuche`), Strömungspfeile vom unteren zum oberen Anschluss, im Mantel und nicht im Innenrohr (`33`, `35`); E11: Bildfolge des Kühlers ändert sich; E07: stärkerer Durchfluss → kälteres Mantelwasser; vertauscht: nur dünner Wasserfilm am Boden (`18`). |
| G-08 | PASS | Vorlage mit Spiegel, Meniskus, Ringwellen und Skala 20–80 mL, Volumenetikett am Laborboy (`08`); abgenommen in gleicher Größe (`09a`); E03: Wechsel animiert (`14-vorlagenwechsel-animiert.png`), alte Vorlagen bleiben mit Volumen auf dem Tisch, neue startet leer (Unit `Dreistoffgemisch`). |
| G-09 | PASS | „Kühler“ blendet den Schnitt ein: zwei getrennte Räume, Wärmeübergangspfeile, Kondensat, Werte aus dem Modell (`35-kuehler-detail.png`, `18`/`19` vertauscht → korrigiert); E11 prüft gleichzeitig Kondensation und gefüllten Mantel im Modell. |
| G-10 | PASS | Thermometer in Einbaulage im Aufsatz mit Skala 0–110 °C und Flüssigkeitssäule, große Digitalanzeige daneben (Mindestgröße 150 × 66 px), Geometrieprüfung „Digitalanzeige links vom Thermometer“; Sicherheitsleiste verdeckt sie nicht (`17`, `23`). |
| G-11 | PASS | E03 `15-experte-diagramm-fraktionen.png`: Achsen ϑ in °C und t in min, Reinstofflinien 56/78/100 °C, Kurve mit drei Abschnitten, Wechselmarken V2/V3 (Unit: 2 Markierungen); zuschaltbar in allen Modi. |
| E-01 | PASS | Unit `M-05/E-01` (weniger Destillat, Verlust gebucht, Warnung `escape`, Stopp `vapor`, Korrektur → wieder Destillat ohne Verlust); E04 (`17-ohne-kuehlung-stopp.png`). |
| E-02 | PASS | Unit `E-02 Vertauschte Schläuche` (Mantel 12 %, mehr Verlust, weniger Destillat, Fehler gezählt, Korrektur → Mantel voll); E05 per Touch: 0,5 mL Verlust und Warnung, Umstecken, danach +0,00 mL Verlust (`18`, `19`). |
| E-03 | PASS | Unit `E-03 Thermometer nur im sicheren Zustand verstellbar`; E06: Messwert zu niedrig, Protokoll meldet „Thermometerkugel saß nicht auf Höhe …“, Ergebnis nicht belegt, Verstellen während des Siedens gesperrt, nach Korrektur 79,2 °C (`20`, `21`). |
| E-04 | PASS | Unit `E-04 Ohne Siedesteine`, `E-04 Zu hohe Heizleistung` (Warnung, unreineres Destillat), `E-04 Vorlage fehlt`; E08 (`23`), E09 (`24`). |
| E-05 | PASS | Unit `E-05 Geschlossene Apparatur` (inkl. Bestätigen-dann-Öffnen), `E-05 Trockenlauf`, `E-05/E-06 Zünden …, heißer Kolben`; E09: Zünden am Kühler → Stopp (`25`), Stopfen im Betrieb → Stopp, Öffnen → Wiederanlauf, Trockenlauf → Stopp (`26`). |
| E-06 | PASS | Unit `E-06 Brennprobe …` (Probe, Schale, Zünden, Flamme, Verbrauch, begrenzte Dauer, keine Zweitzündung) und `Schwellen und nur bei Ethanol/Wasser`; E01: Probe an der montierten Vorlage abgelehnt, Vorlage abnehmen → Pipette → Vorlage → Schale → Feuerzeug → Schale als Bewegungsabläufe (`09a`–`09c`), keine Flamme ohne Zünden, bläuliche Flamme (`09`); Protokollfrage widerlegt „Flamme beweist reines Ethanol“. |
| L-01 | PASS | Unit `L-01 Ergebnis prüfen …`, `L-01 Aufgaben 2 und 3 …`, `L-01 Beobachtungsfrage richtet sich nach dem eigenen Versuch`; Messwertfelder gegen Median der eigenen Anzeige (±1,5 K) und das eigene Volumen; E01 trägt die abgelesene Temperatur ein. |
| L-02 | PASS | Unit `L-01/L-02 Protokoll`; E10: falsch → teilweise (richtige Felder bleiben, Eingaben erhalten) → richtig (`27`, `28`); E01 vollständig richtig (`11`). |
| L-03 | PASS | Unit `L-03 Drei Tipps je Befund`; E10: Tipp-Angebot nach zwei Fehlversuchen, Tipp 1/3–3/3, „Lösung anzeigen“ mit Rückfrage; Trainer mit eigenen Tipps und Lösung. |
| L-04 | PASS | Unit `L-02/L-04/S-04`; E10 Trainer 12/12 und Funktionsfragen; Trainer-Abschnitt „Was passiert bei der Destillation?“ (Siedetemperatur, Verdampfen, Kondensieren, Kühlung). |
| L-05 | PASS | Unit `L-05 Hefteintrag` (80–130 Wörter, Modellgrenze); E10: Hefteintrag ohne Versuch (`12-hefteintrag.png` aus E01). |
| U-01 | PASS | E12: 1440×900 (Maus), 1180×820 und 1024×768 (Touch): Szene vollständig, Schalter/Handlungsleiste/Ansicht sichtbar, Trefferflächen ≥ 44 px und unverdeckt (Start und nach dem Aufbau); schmal 820 px gestapelt (`43`). |
| U-02 | PASS | E05/E07 komplett per Tipp, E01 per Klick; Fokusrahmen `:focus-visible`, alle Bühnengeräte als Schaltflächen mit `aria-label`; Splitter Maus/Touch/Tastatur/Pos1/Doppelklick (E12). |
| T-01 | PASS | `npm test`: 47 / 47 bestanden (Modell 29, Geometrie 6, Aufgaben 7, Labkit 5). |
| T-02 | PASS | 13 Szenarien bedienen nur die Oberfläche (`tests/e2e/lib.mjs`), komplette Versuche statt Start/Ende (E01–E03 vollständig, E04–E09 mit Korrektur). |
| T-03 | PASS | 48 Screenshots aus echten Zwischenzuständen inkl. verstelltem Splitter; Bildfolgen-Vergleiche in E01/E11; alle Bilder angesehen (siehe Sichtprüfung). |
| T-04 | PASS | Build-Prüfung (keine externen Verweise/Netz-APIs); E2E-Gesamtlauf 204 Anfragen, alle lokal; WEB-2 und SCORM-*-5 ohne externe Anfragen und Konsolenfehler. |
| T-05 | PASS | `npm run test:scorm` 16 / 16 Prüfungen bestanden: Manifest, Dateiliste, relative Verweise, byte-identisch mit Build, eingebettet und neues Fenster (Aufgabe 1 über die Oberfläche belegt, LMSInitialize/LMSFinish je einmal, keine Werte), Web-ZIP per `file://` (`50-scorm-*`, `51-web-zip-file.png`). |
| T-06 | PASS | README, CHANGELOG, `sivex.json` (0.2.0, Labkit 0.1.1, prototype), CHEMIE.md, BEDIENUNG.md, UEBERNAHME.md, dieser Bericht, Pakete mit `SHA256SUMS.txt` (zweimal gebaut, identisch); PR als Entwurf, kein Merge. |


### Browser-Szenarien

| Szenario | Status | Inhalt | Ergebnis |
| --- | --- | --- | --- |
| E01 | PASS | Standard 1 komplett: befüllen → Siedesteine → Kühlwasser EIN → Heizung EIN → Sieden → Ablesen → Destillat → Brennprobe → AUS → Auswertung → Hefteintrag | T 79,1 °C, Destillat 13,4 mL, Flamme bläulich |
| E02 | PASS | Standard 2 komplett: Propanon/Wasser, klar andere Temperatur, abgrenzbare Fraktion | T 57,2 °C, Propanon-Anteil 100 % |
| E03 | PASS | Expertenmodus: drei Komponenten, Vorlagenwechsel, Fraktionen und Temperaturkurve | [[1,"P",30,57.6],[2,"E",30,79.3],[3,"W",3,99.9]] |
| E04 | PASS | Ohne Kühlung vs. mit korrekter Kühlung bei gleicher Modellzeit | t = 846 s: mit Kühlung 12,3 mL, ohne 3,5 mL, Verlust 4,1 mL (Dampftemperatur 79,2 °C; Vorlage 12,3 mL / Dampftemperatur 79,1 °C; Vorlage 3,5 mL) |
| E05 | PASS | Falsch angeschlossene Schläuche, Wirkung, Korrektur | Mantelfüllung vertauscht 0.12, Verlust 0,5 mL → nach Korrektur +0.00 mL |
| E06 | PASS | Falsche Thermometerlage vs. richtige: Messwert und Auswertungsfeedback | zu hoch 62,0 °C → richtig 79,2 °C |
| E07 | PASS | Heizpilz EIN/AUS + Stufe, Kühlwasser unabhängig EIN/AUS + Durchfluss, plausibler Verlauf | Heizpilz niedrig 57 °C → hoch 83 °C; Kondensation 4.8 → 2.5 mL/min |
| E08 | PASS | Siedesteine fehlen: Stopp, Ursache, Korrektur, Wiederaufnahme | Siedeverzug → Abkühlen → Siedesteine → Destillat |
| E09 | PASS | Vorlage fehlt / Verschließen / Zünden am Aufbau / Trockenlauf | Tisch statt Vorlage, Zünden, Verschließen, Trockenlauf gestoppt |
| E10 | PASS | Lernsystem: richtig / teilweise / falsch, drei Tipps, Lösung, Geräte-Trainer, Hefteintrag ohne Versuch | Tipps 1–3, Lösung mit Rückfrage, Protokoll falsch → teilweise → richtig, Trainer 12/12 |
| E11 | PASS | Grafik-Zwischenstände und fortlaufende Bildfolgen (Pause hält an) | Blasen/Strömung bewegen sich, Pause friert ein |
| E12 | PASS | Responsive 1440×900, 1180×820, 1024×768 (Touch), Trennlinie Maus/Touch/Tastatur/Doppelklick, Verbindungen intakt | 1440×900 ok, 1180×820 ok, 1024×768 ok, schmal gestapelt |
| T04 | PASS | Keine externen Ressourcen, keine Konsolenfehler | 204 Anfragen, alle lokal |

## Screenshots (aus echten Zwischenzuständen, inhaltlich angesehen)

Alle Bilder in [`docs/screenshots/`](screenshots/) stammen aus den Browsertests am Build (1440×900, sofern nicht anders benannt):

| Datei | Zustand |
| --- | --- |
| `01-start-vormontiert.png` | Start: Apparatur vormontiert, Kolben leer, Thermometer zu hoch, Schläuche frei |
| `02-befuellen-trichter.png` | Einfüllen mit Trichter und Becherglas |
| `03-siedesteine-fallen.png` | Siedesteine fallen in den Kolben |
| `04-kuehlwasser-fliesst-ein.png` | Kühlwasser füllt den Mantel von unten |
| `05-aufheizen.png` | Aufheizen (keine Blasen) |
| `06-sieden-blasen.png` | Sieden mit Blasen an den Siedesteinen |
| `07-kondensat-tropfen.png` | Kondensat und Tropfen, Dampftemperatur 79 °C |
| `08-vorlage-gefuellt.png` | Vorlage gefüllt |
| `09-brennprobe-blaue-flamme.png` | Brennprobe: bläuliche Flamme am Prüfplatz |
| `09a-probe-wird-entnommen.png` | Pipette zieht die Probe aus der abgenommenen Vorlage |
| `09b-probe-wird-ueberfuehrt.png` | Probe wird in die Porzellanschale überführt |
| `09c-zuenden-funke.png` | Feuerzeug an der Schale, Funke |
| `10-nach-dem-ausschalten.png` | nach dem Ausschalten |
| `11-protokoll-richtig.png` | Protokoll vollständig richtig |
| `12-hefteintrag.png` | Hefteintrag |
| `13-propanon-wasser.png` | Propanon/Wasser bei 57 °C |
| `14-vorlagenwechsel-animiert.png` | Vorlagenwechsel (Animation) |
| `15-experte-diagramm-fraktionen.png` | Experte: Diagramm mit drei Abschnitten und Fraktionen |
| `16-ergebnisse-experte.png` | Ergebnisübersicht mit Stoffbilanz |
| `17-ohne-kuehlung-stopp.png` | ohne Kühlung: Dampfverlust, Sicherheitsstopp |
| `18-schlaeuche-vertauscht-detail.png` | Schläuche vertauscht + Detailansicht |
| `19-schlaeuche-korrigiert-detail.png` | Schläuche korrigiert + Detailansicht |
| `20-thermometer-zu-hoch.png` | Thermometer zu hoch |
| `21-thermometer-korrigiert.png` | Thermometer korrigiert |
| `22-kuehlwasser-aus-dampf-tritt-aus.png` | Kühlwasser aus: Dampf tritt aus |
| `23-siedeverzug-stopp.png` | Siedeverzug-Stopp |
| `24-vorlage-fehlt.png` | Vorlage fehlt |
| `25-stopp-zuenden-am-aufbau.png` | Stopp: Zünden an der Apparatur |
| `26-stopp-trockenlauf.png` | Stopp: Trockenlauf |
| `27-protokoll-falsch.png` | Protokoll falsch markiert |
| `28-protokoll-teilweise-verbessert.png` | Protokoll teilweise verbessert |
| `29-trainer-nummern.png` | Geräte-Trainer mit Nummern |
| `30-trainer-geloest.png` | Trainer gelöst |
| `31-geraete-erkunden.png` | Geräte erkunden (Hervorhebung + Funktion), Bedienung gesperrt |
| `31b-beschriftung-vor-dem-versuch.png` | Beschriftung vor dem Versuch, Bedienung gesperrt |
| `32-zustand-kalt.png` | Zustand kalt |
| `33-zustand-kondensierend.png` | Kühler: Strömung und Kondensat (Ausschnitt) |
| `34-erklaermodus-teilchen.png` | Erklärmodus Teilchen |
| `35-kuehler-detail.png` | Kühler-Detailansicht |
| `40-layout-1024x768.png` | Layout 1024x768 |
| `40-layout-1180x820.png` | Layout 1180x820 |
| `40-layout-1440x900.png` | Layout 1440x900 |
| `41-splitter-gezogen-1024x768.png` | Splitter gezogen 1024x768 |
| `41-splitter-gezogen-1180x820.png` | Splitter gezogen 1180x820 |
| `41-splitter-gezogen-1440x900.png` | Splitter gezogen 1440x900 |
| `42-beschriftung-1024x768.png` | Beschriftung 1024x768 |
| `42-beschriftung-1180x820.png` | Beschriftung 1180x820 |
| `42-beschriftung-1440x900.png` | Beschriftung 1440x900 |
| `43-schmal-gestapelt.png` | schmal gestapelt (820 px) |
| `50-scorm-iframe.png` | SCORM im Mock-LMS iframe |
| `50-scorm-popup.png` | SCORM im Mock-LMS popup |
| `51-web-zip-file.png` | Web-ZIP per file:// |

### Sichtprüfung

Die Bilder wurden einzeln angesehen. Befunde der letzten Prüfung:

- Apparatur in allen drei Pflichtgrößen vollständig, Glas an allen Schliffen geschlossen (orange Schliffklemmen), Kühler fällt gleichmäßig zum Vorstoß ab, Tropfspitze ragt in den Hals der Vorlage, Laborboys tragen Heizpilz und Vorlage ohne Spalt.
- Zulaufschlauch verläuft kurz unter dem Kühler zur Armatur, Ablaufschlauch im Bogen über Kühler und Vorlage zum Ausguss – keine Kreuzung. Nur bei absichtlich vertauschten Schläuchen führt der Zulauf vor dem Kühler nach oben.
- Dampf ist unsichtbar; nur im gekennzeichneten Teilchenmodus und in der Detailansicht erscheinen orange Teilchen.
- Kühlwasser im Mantel bläulich mit Strömungspfeilen von unten nach oben; bei vertauschten Schläuchen nur ein dünner Wasserfilm am Boden.
- Siedeblasen nur beim Sieden, an den Siedesteinen beginnend; Flamme überwiegend blau.

## Nicht getestet / bekannte Einschränkungen

- **Echte Schul-iPads, mebis-Import, Unterricht:** nicht Teil dieses Auftrags (Lehrkraft). Touch wurde in Edge emuliert (Tipps, Touch-Ziehen über CDP).
- **Safari/WebKit und Firefox** wurden nicht automatisiert geprüft (installiert ist nur Edge). Die App nutzt nur Standard-Canvas-2D, Pointer Events und CSS Grid wie TitraLab 3 und Redoxlabor.
- **Idealisierte Trennung:** fachlich bewusst (Auftrag); die Grenze ist in App und CHEMIE.md benannt.
- **Zeitmaßstab:** Durchflussstufen (1/4/10 mL/s) und Heizleistungen sind didaktisch gewählt, keine Messwerte einer bestimmten Apparatur.
- **Labkit:** Dieser Branch baut direkt auf `main` auf und führt den Baukasten `shared/labkit` 0.1.1 (optionales `minStage`) selbst mit. Der Branch der Papierchromatographie enthält denselben Stand 0.1.1 unverändert; Chromatographie und Destillation werden getrennt entwickelt. Eine spätere Änderung am Baukasten muss in beiden Branches gleich nachgezogen werden.
