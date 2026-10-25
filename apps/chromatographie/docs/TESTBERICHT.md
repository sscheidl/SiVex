# Papierchromatographie 0.1.0 – Testbericht

**Stand:** 25.10.2026 (nach Umstellung auf Labkit 0.1.1 vollständig neu getestet) · **Prüfgegenstand:** statischer Build `dist/chromatographie/` und die daraus gepackten Dateien `release/chromatographie-0.1.0-web.zip` und `release/chromatographie-0.1.0-scorm12.zip` (byte-identisch mit dem getesteten Build geprüft, PKG-1) · **Baukasten:** `shared/labkit` 0.1.1

**Prüfumgebung:** Windows 11 Pro · Node.js 24.22.1 · Playwright 1.56.1 · Microsoft Edge 156.0.4314.42 (Chromium) headless über `channel: 'msedge'` · Desktop 1440×900, Tablet-Viewports 1180×820, 1024×768 (Touch-Emulation `hasTouch`) und 768×1024

## Ergebnisübersicht

| Testart | Befehl | Ergebnis |
| --- | --- | --- |
| Unit- und Regressionstests: Fachmodell, Aufgaben, Baukasten | `npm test` | **49 / 49 bestanden** (Modell 32, Aufgaben 12, Labkit 5) |
| Build- und Paketprüfung | `npm run package` | **Build OK:** 12 Dateien, 140,3 KiB, Labkit 0.1.1; keine externen Ressourcen, keine absoluten Pfade, kein Netzwerkzugriff; Web-ZIP 46,3 KiB, SCORM-ZIP 46,5 KiB |
| Browser-End-to-End mit echter Bedienung | `npm run test:e2e` | **15 / 15 Szenarien bestanden** ([results.json](../tests/e2e/results.json)) |
| SCORM-Paket im Mock-LMS, Web-ZIP per `file://` | `npm run test:scorm` | **16 / 16 Prüfungen bestanden** ([scorm-results.json](../tests/e2e/scorm-results.json)) |

**Gesamtstatus der Entwicklungsabnahme: PASS.** Alle entwicklerseitig prüfbaren Pflichtkriterien (Abschnitt 7 des Auftrags) sind erfüllt und belegt. Nicht blockierend und **nicht getestet**: echte Schul-iPads, mebis und Unterricht (siehe unten). Der Status in `sivex.json` bleibt `prototype`.

Die Browsertests bedienen ausschließlich die gerenderte Oberfläche: Klicks und Tipps auf die Trefferflächen der Laborbühne, auf die Handlungsleiste und das Bedienfeld, Tastatur sowie Ziehen an der Trennlinie. Der Modellzustand wird nur gelesen, um Beobachtungen zu belegen (z. B. Zonenhöhen), nie gesetzt (`tests/e2e/lib.mjs`).

## Layoutentwürfe (Auftrag Abschnitt 9, Schritt 2)

Vor der Umsetzung wurden drei Anordnungen im Browser mit demselben Versuchsstand verglichen (Schwarz, Grün, Blau in Wasser, Front 5 cm über der Startlinie):

| Entwurf | Anordnung | Kammer (1440×900) | Befund | Screenshot |
| --- | --- | --- | --- | --- |
| **1 (gewählt)** | Arbeitsfläche und Stifteständer links, Kammer Mitte, Laufmittel rechts | 51 % breit, 76 % hoch | Ablauf liest sich von links nach rechts (vorbereiten → entwickeln), Flasche gießt von rechts, kurze Wege | `entwurf-1-1440x900.png`, `entwurf-1-1024x768.png` |
| 2 | Kammer links, Arbeitsfläche rechts | 51 % / 76 % | Gießweg kreuzt die Arbeitsfläche; Papier wandert gegen die Leserichtung | `entwurf-2-*.png` |
| 3 | liegende Stifte in einer Schale vorne | 50 % / 76 % | Aufschriften waagerecht lesbar, aber die Stifte überdecken sich, die Schale kostet Höhe | `entwurf-3-*.png` |

Nachbesserungen nach der Sichtprüfung von Entwurf 1: kräftigere Zonen und Flüssigkeit (auf hellem Grund kaum sichtbar), Stiftaufschriften verkürzt, eigene **kompakte Anordnung** für hochformatige Bühnen (Tablet mit Bedienfeld), Papier beim Einhängen über allen Geräten, Deckel beim Gießen seitlich, Strahl aus der Flaschenöffnung.

## PASS/HOLD-Matrix (Abschnitt 7)

| ID | Status | Nachweis |
| --- | --- | --- |
| G-01 | PASS | E13: Kammer in allen Pflichtansichten das größte Objekt. 1440×900: 51 % der Bühnenbreite, 76 % der Bühnenhöhe; 1180×820: 56 % / 73 %; 1024×768: 56 % / 68 %; 768×1024: 51 % / 74 %. Papier 9 cm × 14 cm bei 26–35 px/cm, drei Bahnen klar unterscheidbar. Sichtprüfung: `09-front-spaet.png`, `11-endbild-chromatogramm.png`, `40-ansicht-*.png`. **Abweichung vom Richtwert:** bei 1024×768 mit geöffnetem Bedienfeld 68 % statt 70 % Höhe; mit eingeklapptem Bedienfeld rund 79 %. |
| G-02 | PASS | Sieben Filzstifte, je 0,95 cm × 4,6 cm (34 px breit bei 1440×900) mit Kappe, Clip, schattiertem Schaft, Farbband und Aufschrift; gewählter Stift wird angehoben, die Kappe ist ab und die Filzspitze sichtbar. Beim Auftupfen fährt die Spitze zum Punkt, drückt auf, der Fleck entsteht in der Bewegung (Wirkung bei 50 % des Handgriffs). `03-probenauftrag-stift-tupft.png`. Etiketten als Text, nicht nur Farbe. |
| G-03 | PASS | Bleistift antippen bzw. „Startlinie ziehen“ zieht die feste Linie bei 2,0 cm (sichtbare Bleistiftbewegung, `02-startlinie-wird-gezogen.png`); erneutes Antippen radiert sie weg, solange keine Probe darauf ist. Keine Höhen- oder Werkzeugwahl. Unit `B-03 Zurücknehmen …`. |
| G-04 | PASS | E01: Front 3,0 → 5,5 → 9,0 → 12,0 cm in vier Screenshots (`07`–`10`), Zonen steigen in jedem Stand, drei Komponenten mit verschiedener Geschwindigkeit; Messreihe von 12 Werten ohne Sprung > 0,4 cm. Zonen sind schon während der Entwicklung sichtbar. Unit: Front wird langsamer (Washburn). |
| G-05 | PASS | E12 (1180×820, Touch): Bedienfeld 354 → Maus 481 → Pfeiltasten 433 → Touch-Ziehen 300 px; Breite nach Neuladen gemerkt; Doppelklick → 354 px; Bühne bleibt ≥ 420 px (gemessen 546 px bei maximaler Breite). `37-trennlinie-breites-bedienfeld.png`, `38-bedienfeld-eingeklappt.png`. Labkit-Unit-Test der Grenzen. |
| G-06 | PASS | E13: in 1440×900, 1180×820, 1024×768 und 768×1024 kein horizontales Scrollen, keine Schaltfläche, Trefferfläche, Eingabe oder Karte außerhalb des Bildschirms bzw. Bedienfelds (auch im Expertenmodus mit Rf-Formular), alle Bedienelemente ≥ 36 px, Trefferflächen auf der Bühne ≥ 44 px. Ab 900 px Trennlinie, darunter Bühne und Bedienfeld untereinander. `40-*`, `41-*`. |
| F-01 | PASS | Unit `F-01 Datensatz`: 7 Proben, Wasser und Ethanol-Wasser 1 : 1, drei Bahnen gleichzeitig (E01–E04 mit drei Proben). |
| F-02 | PASS | Unit: alle 14 Kombinationen Probe × Laufmittel bei 5, 8 und 11 cm Laufstrecke; in Wasser Schwarz 3, Grün 2, Violett 2, Orange 2, Referenzen je 1 Zone. E01 (Schwarz 3), E02 (Grün 2, Violett 2, Blau 1), E03 (Blau 1, Gelb 1), E04 (Orange 2). |
| F-03 | PASS | E02: Blau-Referenz s = 4,96 cm; die blaue Zone von Grün und von Violett liegt ebenfalls bei 4,96 cm, alle übrigen Zonen mehr als 0,8 cm davon entfernt. Geprüft wird die relative Laufstrecke, nicht die Farbe. `21-aufgabe-b-gemeinsamer-blauer-farbstoff.png`. |
| F-04 | PASS | E05: Wasser – eine Zone bei s = 0,00 cm (bleibt auf der Startlinie, obwohl die Front 8 cm steigt); Ethanol-Wasser – Rest an der Startlinie und blauschwarze Zone bei 4,2 cm. `24-…`, `25-…`. |
| F-05 | PASS | E06 Spiegel über der Startlinie: Laufmittel färbt sich (Wert 0,49), keine Zonen, „Noch nicht belegt“ mit Begründung (`26`–`28`); E07 viermal getupft: 2 statt 3 Zonen, verschmiert, Aufgabe nicht belegt (`29`, `30`); E08 zu früh (2 Zonen) und Ethanol-Wasser (2 Zonen) jeweils nicht belegt (`31`); E02 Ethanol-Wasser bei Aufgabe B nicht belegt (`20`). Unit-Tests dazu. |
| F-06 | PASS | E14: fünf Stände mit 10×, Pause, 30×, 1×, 30× → Zonenlagen identisch (6 Nachkommastellen) mit einer unabhängigen Referenzrechnung bei gleicher Entwicklungszeit; Pause hält die Modellzeit an. Unit `F-06 …` (gleiche Modellzeit bei drei Stückelungen → identischer Zustand). Bewertung hängt nur vom Zustand ab. |
| F-07 | PASS | Hefteintrag (`35-hefteintrag-ohne-versuch.png`): stationäre Phase = Papier, mobile Phase = Laufmittel, Löslichkeit, Adsorption; „Eine einzige Zone ist kein Beweis für einen Reinstoff“. Protokoll A, Frage 6, und Musterlösung nennen die Ein-Zonen-Grenze. „Absorption“ ist Distraktor und wird in der Lücke gezielt zurückgewiesen (E05). Rf nur im Expertenmodus (E10: Standardmodus ohne Rf-Anzeige, Lineal und Frontmarkierung). |
| B-01 | PASS | Alle Hauptschritte über Tippen/Klicken auf der Bühne und über die Handlungsleiste (E01–E13); vollständiger Ablauf per Touch (E12, E13); Tastatur: Bleistift, Stift und Auftragepunkt per Tab/Enter/Leertaste, sichtbarer Fokusrahmen (E12). Ziehen wird nirgends benötigt. |
| B-02 | PASS | Drei Aufgaben und freies Labor durchgespielt (E01, E02, E05, E04). Alternative Wege: gelbe statt blaue Referenz, andere Bahnreihenfolge, zweimal Eingießen, zweimal Tupfen (Unit `B-02 …`); Aufgabe B mit beliebiger Bahnfolge (E02); Aufgabe C mit wasserfestem Stift auf beliebigem Punkt (E05). |
| B-03 | PASS | Startlinie radieren, Stift zurückstellen, Kammer leeren, Laufmittel wechseln, neues Papier ohne Verlust abgelegter Chromatogramme; Neuladen behält Versuch und Archiv (E09, E15, Unit `B-03 …`). |
| L-01 | PASS | `tasks.evaluate` wertet nur abgelegte Chromatogramme aus (Zonenzahl, Zonenhöhe relativ zur Referenz, Gültigkeit). Unit `L-01 …` (A, B, C), E01/E02/E05/E08: gleiche Klickfolge mit anderem Laufmittel oder Füllstand → anderes Ergebnis. |
| L-02 | PASS | E06: nach einem Fehlversuch kein Angebot, nach zwei Fehlversuchen „Möchtest du einen Tipp?“, nichts ungefragt eingeblendet; Tipp 1/3 Denkanstoß, 2/3 Eingrenzung, 3/3 konkrete Korrektur, passend zum Befund (Überfüllung); keine vierte Stufe. E08: Tipp 3/3 bei zu früh herausgenommenem Papier. Unit: 14 Befunde × 3 Stufen. |
| L-03 | PASS | E01: sechs Felder (Auswahl, Ankreuzen, Lücke) – 1 von 6 richtig, fünf Felder einzeln als falsch markiert, richtige Eingabe bleibt erhalten, nach Korrektur „Alles richtig ausgewertet!“; E05: Absorption → gezielte Rückmeldung, nach Korrektur richtig. Unit: teilweise richtig, falsch, leer, Tippfehler. |
| L-04 | PASS | E09: zwei Papiere (Wasser, Ethanol-Wasser) nebeneinander mit Bedingungen und Miniatur-Chromatogramm, „Größer ansehen“, früherer Befund unverändert (`32-ergebnisse-vergleich.png`). E10: Front markiert, Lineal (0 = Startlinie), Front 9,01 cm, Zone 5,59 cm, Rf 0,62; falscher Rf erkannt; Front am oberen Rand → nicht markierbar mit Begründung (`33`, `34`). Unit: Rf ohne Markierung bzw. bei Front am Rand nicht bestimmbar, getrocknete Front nicht mehr markierbar. |
| L-05 | PASS | E11: Hefteintrag ohne jeden Versuch über die Kopfzeile erreichbar, 95 Wörter in der Ansicht (Unit: 80–120 Wörter ohne Hinweiszeile), unabhängig von Messwerten. „Lösung anzeigen“ ohne gelungenen Versuch: Rückfrage, Abbrechen möglich, danach Musterlösung und markierte richtige Antworten (`36-loesung-ohne-versuch.png`). |
| T-01 | PASS | `npm test`: 49/49 (alle Proben und Laufmittel, Fehlerfälle, Zeitraffer, Zurücknehmen, Aufgaben, Hilfen, Protokoll, Rf, Hefteintrag, Labkit). |
| T-02 | PASS | 15 Szenarien bedienen nur die Oberfläche (`tests/e2e/lib.mjs`: `tapHit`, `clickAct`, Formularfelder, Tastatur, Zeigerereignisse an der Trennlinie); Zustand nur gelesen. |
| T-03 | PASS | Screenshots in `docs/screenshots/` (Liste unten) und **inhaltlich angesehen** (siehe Sichtprüfung). |
| T-04 | PASS | Build-Prüfung (keine externen Verweise, keine Netzwerk-APIs); E15: 33 Anfragen über alle Szenarien, davon 0 extern, 0 Konsolenfehler; WEB-2: entpacktes Web-ZIP per `file://` bedient, Aufgabe A belegt, keine Netzanfragen, keine Fehler. |
| T-05 | PASS | SCORM-1–3 (Manifest, alle Dateien gelistet, relative Verweise); im Mock-LMS eingebettet und im neuen Fenster mit echter Bedienung (Versuch, Aufgabe A belegt); `LMSInitialize`/`LMSFinish` je genau einmal; kein `LMSGetValue`/`LMSSetValue`/`LMSCommit`. `50-scorm-iframe.png`, `50-scorm-popup.png`. |
| T-06 | PASS | README, `docs/CHEMIE.md`, `docs/UEBERNAHME.md` (Bausteinliste A/B/Codex/neu), dieser Testbericht, `CHANGELOG.md`, Tests, `release/SHA256SUMS.txt`, Screenshots; Pull Request gegen `main`. |

## Sichtprüfung der Screenshots

Angesehen wurden alle Zustände, in denen sich die Darstellung ändert. Dabei gefundene und behobene Mängel sind fett markiert.

- `entwurf-1/2/3-*`: Vergleich der Anordnung (s. o.). **Zonen und Laufmittel zu blass, Stiftaufschriften abgeschnitten** → behoben.
- `03`: Spitze des schwarzen Stifts liegt am Auftragepunkt 1, Hilfskreise für freie Punkte sichtbar.
- `05`: Flasche über der Kammer gekippt, Strahl aus der Öffnung bis zum Spiegel, Deckel zur Seite. **Deckel kreuzte die Flasche, Strahl begann neben der Öffnung** → behoben.
- `06`: Papier wird über die Geräte zur Kammer geführt, Deckel angehoben. **Papier lag unter dem Bleistift, ragte oben aus der Bühne, Haltedrähte quer** → behoben.
- `07`–`10`: Front steigt, drei Zonen von Schwarz und die Referenzen wandern sichtbar; Spiegel mit Meniskus, Glanzlichter nur am Rand.
- `11`: getrocknetes Chromatogramm auf der Arbeitsfläche: Schwarz violett/blau/gelb, Blau und Gelb auf gleicher Höhe wie die Zonen von Schwarz.
- `27`: Spiegel deutlich über der Startlinie, Laufmittel dunkel gefärbt, auf dem Papier nur blasse Reste.
- `30`: überladene Bahn mit breiten, nach unten verschmierten Zonen neben der sauberen Bahn.
- `33`: Lineal mit 0 auf der Startlinie, gestrichelte Frontmarkierung. **Rf-Eingabefelder ragten über das Bedienfeld** → behoben, E13 prüft jetzt auch Eingabefelder (Regressionstest).
- `40-*`/`41-*`: Tablet- und Hochformatansichten; Handlungsleiste bricht nur im Expertenmodus bei 1024 px in zwei Zeilen um. **Lineal und Bleistift berührten sich in der kompakten Anordnung** → Bleistift verschoben.

## Nicht getestet / offene Punkte (nicht blockierend)

- **Echte Schul-iPads (Safari/WebKit) und mebis:** nicht getestet. Geprüft wurde Edge (Chromium) mit Touch-Emulation. WebKit war nicht eingesetzt. Die Prüfung erfolgt durch die Lehrkraft nach dem Entwicklungs-PASS.
- **Unterrichtstest** (Verständlichkeit für Jahrgangsstufe 8/9, Abschreibzeit des Hefteintrags von etwa 5 Minuten): nur abgeschätzt (95 Wörter), nicht mit Lernenden geprüft.
- Bei **1024×768 mit geöffnetem Bedienfeld** erreicht die Kammer 68 % der Bühnenhöhe (Richtwert 70 %). Mit schmalerem oder eingeklapptem Bedienfeld wird sie größer.
- Die **Rf-Werte** sind Modellwerte (`CHEMIE.md`, Abschnitt 5).
- **Baukasten:** Dieser Branch baut direkt auf `main` auf und führt `shared/labkit` 0.1.1 selbst mit, identisch mit dem Branch der Destillation (Chromatographie und Destillation werden getrennt entwickelt). 0.1.1 ergänzt nur das optionale `minStage` im Splitter, das die Chromatographie nicht nutzt. Eine spätere Änderung am Baukasten muss in beiden Apps gleich nachgezogen werden.
- **PR #19** (aktualisierte Entscheidung) war bei Abschluss noch offen und wurde nicht verändert. Er berührt ebenfalls `shared/labkit/README.md` und `apps/chromatographie/README.md`.

## Screenshots

| Datei | Inhalt |
| --- | --- |
| `01-leere-kammer` | Startansicht, leere Kammer |
| `02-startlinie-wird-gezogen` | Bleistift zieht die Startlinie |
| `03-probenauftrag-stift-tupft` | Stift tupft auf Punkt 1 |
| `04-papier-vorbereitet` | drei Proben auf der Startlinie |
| `05-laufmittel-wird-eingegossen` | Gießen aus der Flasche |
| `06-papier-wird-eingehaengt` | Papier auf dem Weg in die Kammer |
| `07`–`10-front-…` | frühe, mittlere, späte, weit oben stehende Front |
| `11-endbild-chromatogramm` | entwickeltes Papier auf der Arbeitsfläche |
| `12`/`13-protokoll-…` | Protokoll teilweise richtig / alles richtig |
| `20`/`21-aufgabe-b-…` | Ethanol-Wasser unzureichend / gemeinsamer blauer Farbstoff |
| `22`–`25` | Referenzen, Orange/Grün/Gelb, wasserfest in Wasser und Ethanol-Wasser |
| `26`–`28` | Überfüllung vor und während der Entwicklung, drei Tipps |
| `29`/`30` | viermal getupft, überladen im Vergleich |
| `31` | zu früh herausgenommen |
| `32` | Ergebnisübersicht mit zwei Papieren |
| `33`/`34` | Expertenmodus: Front, Lineal, Rf geprüft |
| `35`/`36` | Hefteintrag und Musterlösung ohne Versuch |
| `37`/`38` | Trennlinie, eingeklapptes Bedienfeld |
| `40`/`41-ansicht-…` | Pflichtauflösungen, Expertenmodus auf Tablets |
| `50-scorm-…`, `51-web-zip-file` | SCORM im Mock-LMS, Web-ZIP per `file://` |
| `entwurf-…` | Layoutentwürfe 1–3 (vor der Nachbesserung) |

## Reproduzieren

```bash
cd apps/chromatographie
npm install
npm test
npm run package
npm run test:e2e
npm run test:scorm
sha256sum -c release/SHA256SUMS.txt   # bzw. Get-FileHash unter Windows
```
