# Destillation 0.3.0 – Testbericht

**Stand:** 25.10.2026 · **Prüfgegenstand:** statischer Build `dist/destillation/` und die daraus gepackten Dateien `release/destillation-0.3.0-web.zip` und `release/destillation-0.3.0-scorm12.zip` (byte-identisch mit dem getesteten Build geprüft, PKG-1) · **Baukasten:** `shared/labkit` 0.1.1 (in 0.3.0 unverändert)

**Prüfumgebung:** Windows 11 Pro · Node.js 24.22.1 · Playwright 1.56.1 · Microsoft Edge 156.0.4314.42 (Chromium) headless über `channel: 'msedge'` · Desktop 1440×900, Tablet-Viewports 1180×820, 1024×768 und 768×1024 (hoch) mit Touch-Emulation (`hasTouch`), schmal 820×1100

## Ergebnisübersicht

| Testart | Befehl | Ergebnis |
| --- | --- | --- |
| Unit- und Regressionstests: Fachmodell, Geometrie, Aufgaben, Baukasten | `npm test` | **54 / 54 bestanden (Modell 34, Geometrie 8, Aufgaben 7, Labkit 5)** – die 8 neuen Befund-Tests schlagen am Stand 0.2.0 fehl |
| Build- und Paketprüfung | `npm run package` | **Build OK: 13 Dateien, 259,7 KiB, Labkit 0.1.1 – keine externen Ressourcen, keine absoluten Pfade, kein Netzwerkzugriff; Web-ZIP 82,3 KiB, SCORM-ZIP 82,6 KiB; zweimal gepackt → identische Prüfsummen** |
| Browser-End-to-End mit echter Bedienung | `npm run test:e2e` | **17 / 17 Szenarien bestanden** ([results.json](../tests/e2e/results.json)) |
| SCORM-Paket im Mock-LMS (eingebettet + neues Fenster), Web-ZIP per `file://` | `npm run test:scorm` | **16 / 16 Prüfungen bestanden** ([scorm-results.json](../tests/e2e/scorm-results.json)) |

**Gesamtstatus der Entwicklungsabnahme: PASS.** Alle entwicklerseitig prüfbaren Pflichtkriterien (Abschnitt 9 des Auftrags) sind erfüllt und belegt. Nicht blockierend und **nicht getestet**: echte Schul-iPads, mebis-Kursimport und Unterricht (Abschnitt 10 des Auftrags: Aufgabe der Lehrkraft). Der Status in `sivex.json` bleibt `prototype`.

Die Browsertests bedienen ausschließlich die gerenderte Oberfläche: Klicks und Tipps auf die Trefferflächen der Laborbühne, die Handlungsleiste, die Schalter für Heizung und Kühlwasser, das Bedienfeld, Tastatur sowie Ziehen an der Trennlinie (Maus und Touch über CDP). Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen, nie gesetzt (`tests/e2e/lib.mjs`). Abgelesene Temperaturen stammen aus der Anzeige (Textspiegel `#readout`), nicht aus dem Modell.

## Änderungen in 0.3.0 – Befunde, Ursachen, Nachweise

Zweite Durchsicht der Lehrkraft, 17 Befunde. Die Gestaltung bleibt erhalten. Jeder Befund wurde zuerst am Stand 0.2.0 nachgestellt (Browser-Skript bzw. Modell in Node), dann behoben und mit einem gezielten Regressionstest abgesichert; die Regressionstests schlagen am Stand 0.2.0 fehl.

| Nr. | Befund (nachgestellt) | Ursache | Behebung | Regressionstest |
| --- | --- | --- | --- | --- |
| 1 | „Namen“ stand vor „Erkunden“; nach „Namen“ an und Neuladen war die Beschriftung beim Start wieder an | Reihenfolge im Code; der Oberflächenzustand (`labelsOn`) wurde aus der Sitzung wiederhergestellt | Reihenfolge Erkunden · Namen · Kühler · Teilchen · Diagramm; Namen, Erkunden und das große Diagramm werden beim Start nie wiederhergestellt | E13 (Reihenfolge; aus beim Start und nach Neuladen) |
| 2 | Hinweis „Erklärmodus: Dampfteilchen …“ unten rechts auf der Bühne (y = 650 von 682 px), über Laborbereichen | als Element unten in der Bühne verankert | Hinweis links in der Leiste über der Bühne, mit Farblegende der Stoffe | E14 (Hinweis endet oberhalb der Bühne, enthält „in Wirklichkeit unsichtbar“ und die Legende) |
| 3 | „Vorlage 1: x,x mL“ auf dem Laborboy unter dem Erlenmeyer | Schild im Canvas gezeichnet | Anzeige in der Leiste direkt nach „Diagramm“ (abgenommen: „(abgenommen)“); kein Schild mehr auf der Bühne | E14 (kein gezeichneter „Vorlage n:“-Text, Anzeige = Modellvolumen, steht nach „Diagramm“), `47-leiste-vorlage.png` |
| 4 | Skala „40 mL“ passte kaum auf den Kolben | Einheit an der Skalenzahl | nur „40“ und „80“ | E14 (gezeichnete Texte „40“, „80“, kein „… mL“), `48-skala-ohne-ml.png` |
| 5 | Detail „Liebigkühler im Schnitt“: Zeile 354 px, Platz 302 px – „← strömt zum Ablauf“ ragte hinaus | Einblendfläche begann erst über dem Kühler (395 mm breit) | Fläche reicht vom Thermometer bis über den Ausguss (≈ 590 mm); passt die Zeile trotzdem nicht (kleine Bühnen), steht die Strömungsrichtung in der unteren Wasserzeile | Unit „Befund 5 …“ (Platz ≥ 360 px bei 1440 × 900); E15 misst alle gezeichneten Texte der Einblendung bei 1440×900, 1180×820, 1024×768, 768×1024 (`35-kuehler-detail-*`) |
| 6 | „Halt: Siedesteine nie in heiße Flüssigkeit …“ bei Anzeige 20,0 °C | Die Logik prüft richtig die **Flüssigkeit** im Kolben (nachgestellt: Flüssigkeit 60 °C, Heizpilz 59 °C, Anzeige 20,0 °C). Vor dem Sieden erreicht kein Dampf das Thermometer im Aufsatz – die Lernenden sahen die Flüssigkeitstemperatur aber nirgends | Logik beibehalten (Flüssigkeit > 50 °C); die Meldung nennt jetzt die Flüssigkeitstemperatur und erklärt, dass das Thermometer oben nur den Dampf misst; Tipp zum Siedeverzug angepasst | Unit „Befund 6 …“ (Anzeige < 21 °C, Meldung „etwa 6x °C“, unter 50 °C erlaubt, auch wenn der Heizpilz wärmer ist); E08 (über die Oberfläche, Zahl = Modellwert ± 1 K), `23b-siedesteine-heisse-fluessigkeit.png` |
| 7 | Teilchen im Erklärmodus immer einheitlich orange | feste Farbe, keine Kopplung an das Modell | Modell liefert die Stoffmengenanteile des aufsteigenden (`fx.vy`) und des in den Kühler strömenden Dampfs (`fx.py`); jedes Teilchen hat eine feste Zufallszahl, die Anteile teilen sie auf: Ethanol rot, Wasser blau, Propanon grün (auch im Kühler-Detail, mit Legende) | Unit „Befund 7 …“ (Ethanol-Abschnitt > 95 % Ethanol, bei > 99,5 °C exakt [0, 0, 1]); E14 zählt Teilchenpixel im seitlichen Abgang: Ethanol-Abschnitt rot 99 / blau 0 px, bei 99,8 °C blau 103 / rot 0 px (`34b`, `34c`) |
| 8 | Nach dem Trockenlauf (2,4 mL im Kolben) meldete „Einfüllen“ „Der Kolben ist schon befüllt (100 mL)“, der Knopf blieb gesperrt; Heizen verlangte einen Neubeginn | `fill()` prüfte nur das Merkmal „befüllt“, nicht die Menge | Unter 15 mL (Schwelle der Warnung „nur noch wenig Flüssigkeit“) ist „Einfüllen“ wieder frei – nach dem Abkühlen (sonst „noch warm“); +100 mL zum Rest, die Bilanz zählt beide Füllungen; danach wird ohne Neubeginn weiter geheizt | Unit „Befund 8 …“ (heiß abgelehnt, Rest + 100 mL, Bilanz, voll wieder gesperrt, neues Destillat, weiterhin Versuch 1); E09 (Trockenlauf → Einfüllen frei → „noch warm“ → nach dem Abkühlen per Flasche neu befüllt → Heizen), `26b-neu-befuellt.png` |
| 9 | Stopfen auf der Vorlage → „Sicherheitsstopp: geschlossene Apparatur“, obwohl der Vorstoß eine Belüftungsolive hat | fachlich unstimmiger Fehlfall | fachlich geprüft und entschieden: Stopfen und Stopp entfallen (Begründung in `docs/CHEMIE.md`, „Entscheidung: kein Stopfen an der Vorlage“); die Vorstoß-Info nennt die Belüftung; alte Sitzungszustände werden bereinigt | Unit „Befund 9 …“ (Handlung unbekannt, kein Stopp, Destillation läuft, alter Zustand mit Stopfen bereinigt); E09 (kein Knopf, kein „Stopfen“ in der Bedienleiste, Heizen ohne Stopp) |
| 10 | Flasche und Siedesteine standen zwischen Heizpilz und Vorlage | Lage in `geometry.js` | Flasche links neben dem Stativ, Siedestein-Schälchen vor dem Stativfuß links der Stange; Prüfplatz links daneben, kompakter | Unit „Befund 10/11 …“, neue Lageprüfung in `geometry.checks` |
| 11 | Apparatur klein (Szene 1210 mm breit, Maßstab 0,851 px/mm bei 1440 × 900) | breite Randbereiche (Prüfplatz, Ausguss, Ränder), zweizeilige Bedienleiste | Szene 1134 mm breit (Prüfplatz 300 → 240 mm, Ausguss näher an der Vorlage, Stativfuß kürzer, Siedesteine vor dem Stativfuß), einzeilige Bedienleiste → Maßstab 0,908 statt 0,851 (+ 6,7 %) bei 1440 × 900, ebenso + 6,7 % bei 1180×820, 1024×768, 768×1024 | Unit „Befund 10/11 …“ (≤ 1135 mm, ≥ + 6 %); E12 vergleicht bei jeder Größe mit dem Maßstab von 0.2.0 (≥ + 6 %) |
| 12 | Diagramm ließ sich nicht vergrößern (keine Trefferfläche) | – | Antippen des Diagramms: bildschirmfüllend über der Bühne (unterhalb des Meldungsbands), erneutes Antippen oder Escape: wieder klein | E15 bei vier Ansichten (`45-diagramm-gross-*`) |
| 13 | Nach dem Abkühlen auf 20,0 °C stiegen weiter Blasen auf (≈ 6 je Sekunde) | Der geglättete Siedewert klang exponentiell ab und blieb als Rest 4 · 10⁻³²³ stehen; der Renderer wertete jeden Wert > 0 als Sieden | Geglättete Effektwerte werden nach dem Abklingen unter einer Schwelle exakt 0; der Renderer prüft zusätzlich eine Schwelle | Unit „Befund 13 …“ (alle Effektwerte 0 nach dem Abkühlen, schon 10 s nach dem letzten Dampf); E16 (Kolben 21 °C, Bild unverändert), `46-abgekuehlt-ohne-blasen.png` |
| 14 | Hellgrüner Hintergrund hinter „Brennprobe: bläuliche Flamme“ | Pillen-Stil | farbige Hinweise ohne Hintergrund (grün, orange, rot) | E01 (berechneter Hintergrund transparent, Schrift grün), `16b-ergebnisse-brennprobe.png` |
| 15 | Start mit 10× | Voreinstellung | Start mit 1×, auch nach Neuladen | E13 (1× gedrückt, Modellzeit läuft in Echtzeit) |
| 16 | Uhr lief nach dem Versuch weiter (13:59 → 15:30 in 3 s bei 30×) | Uhr zeigte die Modellzeit | Versuchszeit `tx`: steht, sobald Destillat aufgefangen, die Heizung aus ist, kein Dampf mehr übergeht und der Kühler leer gelaufen ist (■ an der Uhr); das Diagramm nutzt dieselbe Zeit; läuft beim erneuten Heizen weiter | Unit „Befund 16 …“; E16 (Uhr steht über 2,5 s bei 30× und während des Abkühlens, läuft nach erneutem Heizen weiter), `49-uhr-angehalten.png` |
| 17 | Bedienknöpfe in zwei Zeilen; Knopf „Vorlage abnehmen/unterstellen“ | zwei Reihen im HTML, breite Schalter | eine Reihe (Handgriffe, Heizung, Kühlwasser), kompaktere Knöpfe; Knopf „Vorlage“ (die Bedeutung bleibt als Bildschirmleser-Text und Tooltip); auf schmaler Bühne bricht die Reihe um | E13 (eine Zeile bei 1440 × 900 beim Start und mit „Eingefüllt ✓“ + Heizung EIN), `44-bedienzeile-1440x900.png` |

Zusätzlich gefunden und behoben:

| Befund | Ursache | Behebung |
| --- | --- | --- |
| Zweizeilige Meldungen überdeckten den Kopf der Einblendungen (Bild der Lehrkraft: „Halt …“ über „Liebigkühler im Schnitt“) | Meldung frei oben verankert, Band nur 54 px | festes Meldungsband (58 px, zwei Zeilen) oberhalb der Szene wie in der Papierchromatographie; lange Meldungen kleiner gesetzt |
| Nach dem Zusammenrücken lag das lose Ablaufschlauch-Ende bei 1024 × 768 unter der Touch-Fläche der Trennlinie | Trefferfläche reichte bis an den rechten Rand | Trefferflächen halten 16 px Abstand zum rechten Rand; Ausguss so breit, dass sich die Schlauchenden nicht verdecken (E12 prüft die Verdeckung) |
| Schilder „Heizpilz“ und „Siedesteine“ überlappten nach dem Umstellen | Schildposition | Heizpilz-Schild rechts vom Heizpilz |
| E01/SCORM: gewählte Pipette ließ sich nicht wieder antippen | Prüfplatz zunächst zu stark verkleinert (Pipette–Feuerzeug 28 mm), die Trefferfläche des Feuerzeugs lag darüber | wieder 48 mm Abstand wie in 0.2.0 (Prüfplatz 240 mm) |
| E10: Siedesteine im Modus „Erkunden“ nicht antippbar | die große Stativfläche lag über dem Schälchen vor dem Stativfuß | Stativ zuunterst in der Reihenfolge der Trefferflächen |

**Grenzen:** Die Bedienzeile passt bei 1440 × 900 im Standardmodus in eine Zeile; im Expertenmodus („Vorlage wechseln“) und auf Tablet-Bühnen (≈ 700–800 px breit) bricht sie in zwei Zeilen um (Tippflächen bleiben 44 px). Die Apparatur ist knapp 7 % größer – mehr lässt der Prüfplatz mit seinen Tippflächen (Pipette und Feuerzeug brauchen 48 mm Abstand) nicht zu; links stehen weiterhin Prüfplatz und Materialien, deshalb liegt sie leicht rechts der Bühnenmitte. Mit eingeschaltetem Erklärmodus braucht die Leiste auf Tablets zwei Zeilen.

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
| S-03 | PASS | E01 (Maus) und E05/E07 (Touch): Gemisch einfüllen mit sichtbarem Trichter/Becherglas (`02`), Siedesteine (`03`), Thermometer ▼ auf Höhe des Abgangs, Schläuche durch Antippen von Schlauchende und Anschluss, **Kühlwasser EIN/AUS** und **Heizung EIN/AUS** als getrennte beschriftete Schalter, Heizstufe niedrig/mittel/hoch, Durchfluss gering/mittel/stark; E07 schaltet beide unabhängig (Wasser ein bei kalter Apparatur, aus/an ohne Heizung, Beschriftungen „Heizung EIN“, „Kühlwasser AUS“ geprüft). Auffangen, Vorlage abnehmen/unterstellen per Fußleiste („Vorlage“) oder Antippen (E09), Vorlagenwechsel (E03), Neubefüllen nach dem Leerdestillieren (E09). Alle Bedienelemente unten in einer Zeile (E13). |
| S-04 | PASS | Unit `L-02/L-04/S-04 Geräte-Trainer`: 12 Teile inkl. Kühlwasserzulauf/-ablauf, Vorlage ≠ Destillat (gezielte Rückmeldung „Vorlage ist das Gefäß …“); E10: Zuordnung falsch → 1 von 12 mit Erklärung → 12/12 (`29`, `30`); „Erkunden“ hebt Gerät hervor und zeigt Funktion (`31`); „Namen“ beschriftet alle Teile (`42-beschriftung-*`). |
| M-01 | PASS | Unit `M-01 Heizstufe wirkt` (niedrig/mittel/hoch → Siedebeginn später/früher, Destillat weniger/mehr), `M-01/E-04 Heizung aus → kein Sieden`, `S-03/M-01 … Heizung schaltet sofort, Wärme fließt verzögert`; E07: Heizpilz niedrig 57 °C → hoch 83 °C, kein Temperatursprung beim Einschalten. |
| M-02 | PASS | Unit `M-02/E-03 Thermometerlage` (richtig 79–81 °C, zu hoch > 10 K zu niedrig, zu tief zu hoch), `M-02/G-10 Temperaturverlauf` (stetig, < 3 K/s); E06: zu hoch 62,0 °C → korrigiert 79,2 °C, abgelesen aus der Anzeige. |
| M-03 | PASS | Unit `M-03 Idealisiertes Trennmodell`, `M-03/M-04 ew` (E > 97 %, 78–81,5 °C), `pw` (P > 97 %, 56–59 °C), `Dreistoffgemisch` (P/E/W bei 57/79/100 °C, 30/30 mL); E02: 57,2 °C, 100 % Propanon; E03: Fraktionen P 57,6 °C · E 79,3 °C · W 99,9 °C. Modellgrenze in App, CHEMIE.md, Hefteintrag. |
| M-04 | PASS | Unit `M-04 Bilanz in allen Gemischen` (alle 60 s über 30 min, Abweichung < 10⁻⁶ mL) und Bilanzprüfung in allen Fehlerfällen (Siedeverzug, ohne Kühlung, hohe Heizung, ohne Vorlage, Brennprobe); E01 prüft `engine.balance()` am Ende; Expertenmodus zeigt die Bilanz (`16-ergebnisse-experte.png`). |
| M-05 | PASS | Unit `M-05/E-01 Kühlleistung wirkt`, `M-05 Kühlwasser AUS während des Betriebs` (stehendes Wasser kühlt kurz weiter, Manteltemperatur > 40 °C, danach Dampf), `M-05 Durchfluss wirkt bei starker Heizung`; E04: bei gleicher Modellzeit 12,4 mL mit vs. 3,5 mL ohne Kühlung, 4,1 mL Dampfverlust; E07: Kondensation 4,8 → 2,5 mL/min nach „Kühlwasser AUS“. |
| M-06 | PASS | Unit `M-06 Feste Zeitschritte` (Stückelung 1,5 s vs. 0,37 s → identischer Zustand auf 9 Stellen); Labkit-Test der Schrittzahl; E11: Pause friert Bild und Modell ein (pixelgleiche Folgebilder). |
| G-01 | PASS | Unit `G-01 Alle Sollverbindungen` (11 Verbindungen < 10⁻⁹), `G-01 Lagebedingungen` (19 Bedingungen), `G-01 Schläuche …`, `G-01 Richtige Schlauchführung kreuzt nichts`; E12 misst alle Verbindungen am Bildschirm (< 0,5 px) bei 1440×900, 1180×820, 1024×768, 768×1024 (`40-layout-*`). Sichtprüfung siehe unten. |
| G-02 | PASS | Unit `G-02 Gleichmäßige Skalierung` (7 Bühnengrößen, Kühlerneigung unverändert); E12: Splitter mit Maus dreimal, Touch (CDP), Pfeiltasten, Pos1 und Doppelklick – nach jedem Schritt Verbindungen, Szenengrenzen, Bedienelemente, Trefferflächen ≥ 44 px und deren Verdeckungsfreiheit geprüft (`41-splitter-gezogen-*`). |
| G-03 | PASS | Glas/Meniskus/Glanz nach TitraLab 3; E01: Füllstand steigt beim Einfüllen (Messreihe), sinkt beim Sieden in vier Folgemessungen; Unit `G-03 Füllstände aus dem Volumen`. `02`, `06`, `08`. |
| G-04 | PASS | E01: keine Blasen beim Aufheizen (`05`), Blasen beim Sieden (`06`); E11: Bildausschnitt des Kolbens ändert sich beim Sieden, bleibt in der Pause gleich; Blasenrate aus `fx.boil` (Heizleistung), Siedekeime nur mit Siedesteinen, ohne Siedesteine Siedeverzug (`23`). |
| G-05 | PASS | Dampf unsichtbar in allen Standardbildern (`06`, `07`); Teilchen nur im gekennzeichneten Erklärmodus (`34-erklaermodus-teilchen.png`, Hinweis „in Wirklichkeit unsichtbar“ oben in der Leiste) und in der Detailansicht, gefärbt nach der Dampfzusammensetzung (E14, `34b`, `34c`); Dampfaustritt zurückhaltend mit Warnhinweis (`18`, `22`). |
| G-06 | PASS | Kondensatfilm und rinnende Tropfen im Innenrohr (`33-zustand-kondensierend.png`), Film im Vorstoß, hängender Tropfen an der Spitze, einzelne fallende Tropfen (E01: Vorlage-Bildfolge verschieden, Tropfenzähler steigt); Tropfenrate aus Kondensationsrate (Unit `M-05 …`). |
| G-07 | PASS | Mantel füllt sich nach „Kühlwasser EIN“ von unten (E01 `04`, Unit `S-03 Schläuche`), Strömungspfeile vom unteren zum oberen Anschluss, im Mantel und nicht im Innenrohr (`33`, `35`); E11: Bildfolge des Kühlers ändert sich; E07: stärkerer Durchfluss → kälteres Mantelwasser; vertauscht: nur dünner Wasserfilm am Boden (`18`). |
| G-08 | PASS | Vorlage mit Spiegel, Meniskus, Ringwellen und Skala 20–80 („40“, „80“ ohne Einheit), Füllmenge in der Leiste über der Bühne (`08`, `47`, `48`); abgenommen in gleicher Größe (`09a`); E03: Wechsel animiert (`14-vorlagenwechsel-animiert.png`), alte Vorlagen bleiben mit Volumen auf dem Tisch, neue startet leer (Unit `Dreistoffgemisch`). |
| G-09 | PASS | „Kühler“ blendet den Schnitt ein: zwei getrennte Räume, Wärmeübergangspfeile, Kondensat, Werte aus dem Modell (`35-kuehler-detail.png`, `18`/`19` vertauscht → korrigiert); E11 prüft gleichzeitig Kondensation und gefüllten Mantel im Modell. |
| G-10 | PASS | Thermometer in Einbaulage im Aufsatz mit Skala 0–110 °C und Flüssigkeitssäule, große Digitalanzeige daneben (Mindestgröße 150 × 66 px), Geometrieprüfung „Digitalanzeige links vom Thermometer“; Sicherheitsleiste verdeckt sie nicht (`17`, `23`). |
| G-11 | PASS | E03 `15-experte-diagramm-fraktionen.png`: Achsen ϑ in °C und t in min, Reinstofflinien 56/78/100 °C, Kurve mit drei Abschnitten, Wechselmarken V2/V3 (Unit: 2 Markierungen); zuschaltbar in allen Modi. |
| E-01 | PASS | Unit `M-05/E-01` (weniger Destillat, Verlust gebucht, Warnung `escape`, Stopp `vapor`, Korrektur → wieder Destillat ohne Verlust); E04 (`17-ohne-kuehlung-stopp.png`). |
| E-02 | PASS | Unit `E-02 Vertauschte Schläuche` (Mantel 12 %, mehr Verlust, weniger Destillat, Fehler gezählt, Korrektur → Mantel voll); E05 per Touch: 0,5 mL Verlust und Warnung, Umstecken, danach +0,00 mL Verlust (`18`, `19`). |
| E-03 | PASS | Unit `E-03 Thermometer nur im sicheren Zustand verstellbar`; E06: Messwert zu niedrig, Protokoll meldet „Thermometerkugel saß nicht auf Höhe …“, Ergebnis nicht belegt, Verstellen während des Siedens gesperrt, nach Korrektur 79,2 °C (`20`, `21`). |
| E-04 | PASS | Unit `E-04 Ohne Siedesteine`, `E-04 Zu hohe Heizleistung` (Warnung, unreineres Destillat), `E-04 Vorlage fehlt`; E08 (`23`), E09 (`24`). |
| E-05 | PASS | Unit `E-05 Trockenlauf`, `Befund 8 …` (Neubefüllen), `Befund 9 …` (kein Stopfen: Vorstoß belüftet, Entscheidung in CHEMIE.md), `E-05/E-06 Zünden …, heißer Kolben`; E09: Zünden am Kühler → Stopp (`25`), kein Stopfen, Trockenlauf → Stopp (`26`) → nach dem Abkühlen neu befüllt (`26b`). |
| E-06 | PASS | Unit `E-06 Brennprobe …` (Probe, Schale, Zünden, Flamme, Verbrauch, begrenzte Dauer, keine Zweitzündung) und `Schwellen und nur bei Ethanol/Wasser`; E01: Probe an der montierten Vorlage abgelehnt, Vorlage abnehmen → Pipette → Vorlage → Schale → Feuerzeug → Schale als Bewegungsabläufe (`09a`–`09c`), keine Flamme ohne Zünden, bläuliche Flamme (`09`); Protokollfrage widerlegt „Flamme beweist reines Ethanol“. |
| L-01 | PASS | Unit `L-01 Ergebnis prüfen …`, `L-01 Aufgaben 2 und 3 …`, `L-01 Beobachtungsfrage richtet sich nach dem eigenen Versuch`; Messwertfelder gegen Median der eigenen Anzeige (±1,5 K) und das eigene Volumen; E01 trägt die abgelesene Temperatur ein. |
| L-02 | PASS | Unit `L-01/L-02 Protokoll`; E10: falsch → teilweise (richtige Felder bleiben, Eingaben erhalten) → richtig (`27`, `28`); E01 vollständig richtig (`11`). |
| L-03 | PASS | Unit `L-03 Drei Tipps je Befund`; E10: Tipp-Angebot nach zwei Fehlversuchen, Tipp 1/3–3/3, „Lösung anzeigen“ mit Rückfrage; Trainer mit eigenen Tipps und Lösung. |
| L-04 | PASS | Unit `L-02/L-04/S-04`; E10 Trainer 12/12 und Funktionsfragen; Trainer-Abschnitt „Was passiert bei der Destillation?“ (Siedetemperatur, Verdampfen, Kondensieren, Kühlung). |
| L-05 | PASS | Unit `L-05 Hefteintrag` (80–130 Wörter, Modellgrenze); E10: Hefteintrag ohne Versuch (`12-hefteintrag.png` aus E01). |
| U-01 | PASS | E12: 1440×900 (Maus), 1180×820, 1024×768 und 768×1024 hoch (Touch): Szene vollständig, Schalter/Handlungsleiste/Ansicht sichtbar, Trefferflächen ≥ 44 px und unverdeckt (Start und nach dem Aufbau), Maßstab ≥ 6 % größer als in 0.2.0; schmal 820 px gestapelt (`43`); E15 Kühler-Detail und großes Diagramm in allen vier Ansichten. |
| U-02 | PASS | E05/E07 komplett per Tipp, E01 per Klick; Fokusrahmen `:focus-visible`, alle Bühnengeräte als Schaltflächen mit `aria-label`; Splitter Maus/Touch/Tastatur/Pos1/Doppelklick (E12). |
| T-01 | PASS | `npm test`: 54 / 54 bestanden (Modell 34, Geometrie 8, Aufgaben 7, Labkit 5). |
| T-02 | PASS | 17 Szenarien bedienen nur die Oberfläche (`tests/e2e/lib.mjs`), komplette Versuche statt Start/Ende (E01–E03 vollständig, E04–E09 mit Korrektur, E13–E16 je Befund). Gelesen werden nur Modellzustand, gezeichnete Texte und Pixel der Bühne. |
| T-03 | PASS | 72 Screenshots aus echten Zwischenzuständen inkl. verstelltem Splitter und vier Ansichten; Bildfolgen-Vergleiche in E01/E11/E16, Pixelzählung der Teilchenfarben in E14; neue und geänderte Bilder angesehen (siehe Sichtprüfung). |
| T-04 | PASS | Build-Prüfung (keine externen Verweise/Netz-APIs); E2E-Gesamtlauf 312 Anfragen, alle lokal; WEB-2 und SCORM-*-5 ohne externe Anfragen und Konsolenfehler. |
| T-05 | PASS | `npm run test:scorm` 16 / 16 Prüfungen bestanden: Manifest, Dateiliste, relative Verweise, byte-identisch mit Build, eingebettet und neues Fenster (Aufgabe 1 über die Oberfläche belegt, LMSInitialize/LMSFinish je einmal, keine Werte), Web-ZIP per `file://` (`50-scorm-*`, `51-web-zip-file.png`). |
| T-06 | PASS | README, CHANGELOG, `sivex.json` (0.3.0, Labkit 0.1.1, prototype), CHEMIE.md (Entscheidung Stopfen), BEDIENUNG.md, dieser Bericht, Übersichtszeilen in `README.md`/`docs/ARCHITECTURE.md`, Pakete mit `SHA256SUMS.txt` (zweimal gebaut, identisch); PR gegen `main`, kein Merge ohne Freigabe. |


### Browser-Szenarien

| Szenario | Status | Inhalt | Ergebnis |
| --- | --- | --- | --- |
| E01 | PASS | Standard 1 komplett: befüllen → Siedesteine → Kühlwasser EIN → Heizung EIN → Sieden → Ablesen → Destillat → Brennprobe → AUS → Auswertung → Hefteintrag | T 79,1 °C, Destillat 13,2 mL, Flamme bläulich |
| E02 | PASS | Standard 2 komplett: Propanon/Wasser, klar andere Temperatur, abgrenzbare Fraktion | T 57,2 °C, Propanon-Anteil 100 % |
| E03 | PASS | Expertenmodus: drei Komponenten, Vorlagenwechsel, Fraktionen und Temperaturkurve | [[1,"P",30,57.6],[2,"E",30,79.3],[3,"W",3,99.9]] |
| E04 | PASS | Ohne Kühlung vs. mit korrekter Kühlung bei gleicher Modellzeit | t = 843 s: mit Kühlung 12,7 mL, ohne 3,5 mL, Verlust 4,1 mL (Dampftemperatur 79,2 °C; Vorlage 12,7 mL / Dampftemperatur 79,1 °C; Vorlage 3,5 mL) |
| E05 | PASS | Falsch angeschlossene Schläuche, Wirkung, Korrektur | Mantelfüllung vertauscht 0.12, Verlust 0,5 mL → nach Korrektur +0.00 mL |
| E06 | PASS | Falsche Thermometerlage vs. richtige: Messwert und Auswertungsfeedback | zu hoch 62,0 °C → richtig 79,2 °C |
| E07 | PASS | Heizpilz EIN/AUS + Stufe, Kühlwasser unabhängig EIN/AUS + Durchfluss, plausibler Verlauf | Heizpilz niedrig 57 °C → hoch 83 °C; Kondensation 4.8 → 2.5 mL/min |
| E08 | PASS | Siedesteine fehlen: Stopp, Ursache, Korrektur, Wiederaufnahme | Siedeverzug → Siedesteine abgelehnt (Anzeige 20,9 °C, Flüssigkeit 79,7 °C) → Abkühlen → Siedesteine → Destillat |
| E09 | PASS | Vorlage fehlt / Zünden am Aufbau / kein Stopfen (Befund 9) / Trockenlauf und Neubefüllen (Befund 8) | Tisch statt Vorlage, Zünden, kein Stopfen, Trockenlauf gestoppt, neu befüllt (2.4 → 102.4 mL) |
| E10 | PASS | Lernsystem: richtig / teilweise / falsch, drei Tipps, Lösung, Geräte-Trainer, Hefteintrag ohne Versuch | Tipps 1–3, Lösung mit Rückfrage, Protokoll falsch → teilweise → richtig, Trainer 12/12 |
| E11 | PASS | Grafik-Zwischenstände und fortlaufende Bildfolgen (Pause hält an) | Blasen/Strömung bewegen sich, Pause friert ein |
| E12 | PASS | Responsive 1440×900, 1180×820, 1024×768, 768×1024 (Touch), Trennlinie Maus/Touch/Tastatur/Doppelklick, Verbindungen intakt; Apparatur größer (Befund 11) | 1440×900 ok, 1180×820 ok, 1024×768 ok, 768×1024 gestapelt ok (Maßstab 0.663), schmal gestapelt |
| E13 | PASS | Befunde 1, 15, 17: Start mit 1×, „Namen“ aus und nach „Erkunden“ (auch nach Neuladen); Bedienknöpfe in einer Zeile, Knopf „Vorlage“ | Ansicht: explore · labels · detail · explain · chart; Bedienleiste mit 8 Elementen in einer Zeile |
| E14 | PASS | Befunde 2, 3, 4, 7: Erklärhinweis oben ohne Überdeckung, Vorlagen-Anzeige nach „Diagramm“, Skala ohne „mL“, Teilchen nach Dampfzusammensetzung (Ethanol rot, bei 99,9 °C nur Wasser blau) | Ethanol: rot 103/blau 0 px; 99,6 °C: blau 41/rot 0 px |
| E15 | PASS | Befunde 5, 12: Kühler-Detail ohne überstehende Beschriftung; Diagramm antippen → bildschirmfüllend → antippen/Escape → klein (vier Ansichten) | 1440×900 ok, 1180×820 ok, 1024×768 ok, 768×1024 ok |
| E16 | PASS | Befunde 13, 16: Uhr steht nach dem Versuch und läuft beim erneuten Heizen weiter; nach dem Abkühlen auf 20 °C keine Blasen | Uhr 13:14 angehalten, nach erneutem Heizen 13:15; Kolben 21,0 °C ohne Blasen |
| T04 | PASS | Keine externen Ressourcen, keine Konsolenfehler | 312 Anfragen, alle lokal |

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
| `16b-ergebnisse-brennprobe.png` | Ergebnisse: „Brennprobe: bläuliche Flamme“ grün ohne Hintergrund (Befund 14) |
| `17-ohne-kuehlung-stopp.png` | ohne Kühlung: Dampfverlust, Sicherheitsstopp |
| `18-schlaeuche-vertauscht-detail.png` | Schläuche vertauscht + Detailansicht |
| `19-schlaeuche-korrigiert-detail.png` | Schläuche korrigiert + Detailansicht |
| `20-thermometer-zu-hoch.png` | Thermometer zu hoch |
| `21-thermometer-korrigiert.png` | Thermometer korrigiert |
| `22-kuehlwasser-aus-dampf-tritt-aus.png` | Kühlwasser aus: Dampf tritt aus |
| `23-siedeverzug-stopp.png` | Siedeverzug-Stopp |
| `23b-siedesteine-heisse-fluessigkeit.png` | Siedesteine abgelehnt: Meldung nennt die Flüssigkeitstemperatur (Befund 6) |
| `24-vorlage-fehlt.png` | Vorlage fehlt |
| `25-stopp-zuenden-am-aufbau.png` | Stopp: Zünden an der Apparatur |
| `26-stopp-trockenlauf.png` | Stopp: Trockenlauf |
| `26b-neu-befuellt.png` | nach dem Trockenlauf abgekühlt und neu befüllt (Befund 8) |
| `27-protokoll-falsch.png` | Protokoll falsch markiert |
| `28-protokoll-teilweise-verbessert.png` | Protokoll teilweise verbessert |
| `29-trainer-nummern.png` | Geräte-Trainer mit Nummern |
| `30-trainer-geloest.png` | Trainer gelöst |
| `31-geraete-erkunden.png` | Geräte erkunden (Hervorhebung + Funktion), Bedienung gesperrt |
| `31b-beschriftung-vor-dem-versuch.png` | Beschriftung vor dem Versuch, Bedienung gesperrt |
| `32-zustand-kalt.png` | Zustand kalt |
| `33-zustand-kondensierend.png` | Kühler: Strömung und Kondensat (Ausschnitt) |
| `34-erklaermodus-teilchen.png` | Erklärmodus Teilchen |
| `34b-teilchen-ethanol.png` | Erklärmodus: Hinweis mit Legende oben, rote Ethanolteilchen (Befunde 2, 7) |
| `34c-teilchen-wasser.png` | Erklärmodus bei 99,8 °C: nur blaue Wasserteilchen (Befund 7) |
| `35-kuehler-detail.png` | Kühler-Detailansicht |
| `35-kuehler-detail-<Ansicht>.png` | Kühler-Detail bei 1440×900, 1180×820, 1024×768, 768×1024: Beschriftung innerhalb der Einblendung (Befund 5) |
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
| `40-layout-768x1024.png`, `42-beschriftung-768x1024.png` | Tablet hoch (gestapelt) |
| `44-bedienzeile-1440x900.png` | Bedienknöpfe in einer Zeile (Befund 17) |
| `45-diagramm-gross-<Ansicht>.png` | Diagramm bildschirmfüllend (Befund 12) |
| `46-abgekuehlt-ohne-blasen.png` | Kolben nach dem Abkühlen ohne Blasen (Befund 13) |
| `47-leiste-vorlage.png` | Leiste: Ansicht, danach „Vorlage 1: … mL“ (Befund 3) |
| `48-skala-ohne-ml.png` | Vorlage mit Skala „40“/„80“ (Befund 4) |
| `49-uhr-angehalten.png` | Uhr nach dem Versuch angehalten (■) (Befund 16) |
| `50-scorm-iframe.png` | SCORM im Mock-LMS iframe |
| `50-scorm-popup.png` | SCORM im Mock-LMS popup |
| `51-web-zip-file.png` | Web-ZIP per file:// |

### Sichtprüfung

Die Bilder wurden einzeln angesehen. Befunde der letzten Prüfung:

- Apparatur in allen drei Pflichtgrößen vollständig, Glas an allen Schliffen geschlossen (orange Schliffklemmen), Kühler fällt gleichmäßig zum Vorstoß ab, Tropfspitze ragt in den Hals der Vorlage, Laborboys tragen Heizpilz und Vorlage ohne Spalt.
- Zulaufschlauch verläuft kurz unter dem Kühler zur Armatur, Ablaufschlauch im Bogen über Kühler und Vorlage zum Ausguss – keine Kreuzung. Nur bei absichtlich vertauschten Schläuchen führt der Zulauf vor dem Kühler nach oben.
- Dampf ist unsichtbar; nur im gekennzeichneten Teilchenmodus und in der Detailansicht erscheinen Teilchen – rot (Ethanol), blau (Wasser), grün (Propanon) nach der Dampfzusammensetzung.
- Kühlwasser im Mantel bläulich mit Strömungspfeilen von unten nach oben; bei vertauschten Schläuchen nur ein dünner Wasserfilm am Boden.
- Siedeblasen nur beim Sieden, an den Siedesteinen beginnend; nach dem Abkühlen ruhig (`46`); Flamme überwiegend blau.
- 0.3.0 (alle vier Ansichten): Flasche und Siedestein-Schälchen links neben bzw. vor dem Stativfuß, Prüfplatz links daneben, Apparatur größer; Leiste über der Bühne mit Ansicht und „Vorlage 1: … mL“; Erklärhinweis mit Legende links in der Leiste (auf Tablets eigene Zeile); Meldungsband über der Apparatur, lange Meldungen in kleinerer Schrift zweizeilig (`23b`); Kühler-Detail mit allen Beschriftungen innerhalb der Einblendung (bei 1024×768 und 768×1024 steht „← strömt zum Ablauf“ in der unteren Wasserzeile); Diagramm groß über der ganzen Bühne; Bedienleiste bei 1440×900 einzeilig, auf Tablets zweizeilig; Beschriftungen und Trainer-Nummern ohne Überlappung (`42-*`, `29`, `31`).

## Nicht getestet / bekannte Einschränkungen

- **Echte Schul-iPads, mebis-Import, Unterricht:** nicht Teil dieses Auftrags (Lehrkraft). Touch wurde in Edge emuliert (Tipps, Touch-Ziehen über CDP).
- **Safari/WebKit und Firefox** wurden nicht automatisiert geprüft (installiert ist nur Edge). Die App nutzt nur Standard-Canvas-2D, Pointer Events und CSS Grid wie TitraLab 3 und Redoxlabor.
- **Idealisierte Trennung:** fachlich bewusst (Auftrag); die Grenze ist in App und CHEMIE.md benannt.
- **Zeitmaßstab:** Durchflussstufen (1/4/10 mL/s) und Heizleistungen sind didaktisch gewählt, keine Messwerte einer bestimmten Apparatur.
- **Labkit:** 0.3.0 ändert `shared/labkit` nicht (0.1.1 wie die Papierchromatographie); die Chromatographie bleibt unberührt.
