# Fällungslabor 1.0.0 – Testbericht

Stand **16.11.2026** · Status **prototype** · Labkit 0.3.0 · geprüfter Quellstand: Branch `feature/faellungslabor`, Commit `0f8a1e2` (Code, Tests und Artefakte; spätere Commits ändern nur Dokumentation).

Statusregeln nach [`docs/QUALITY.md`](../../../docs/QUALITY.md) und Auftrag Abschnitt 12: **PASS** = tatsächlich geprüft, Nachweis dokumentiert · **HOLD – failed** · **HOLD – incomplete** · **HOLD – unverified**.

## Zusammenfassung

| Bereich | Ergebnis |
| --- | --- |
| Entwicklungs-PASS (FL01–FL31) | **31/31 PASS** – alle mit Nachweis; Artefakte frisch aus identischem Quellstand |
| Unterrichtsfreigabe (FL32–FL34) | **HOLD – unverified** (kein echtes iPad, kein mebis-Import, keine Lehrkraftabnahme in dieser Umgebung) |
| `sivex.json` | `status: prototype` (bleibt bis FL32–FL34 bestätigt sind) |

**Keine Freigabeempfehlung für den Unterricht.** Entwicklungsseitig ist das Labor funktionsvollständig und paketiert.

## Prüfumgebung und ausgeführte Befehle

- Linux-Container, Node.js 22.23.4, npm 10.9.9, Playwright 1.56.1, **Chrome for Testing 153.0.8010.12** (headless). Kein Edge, Safari, Firefox; **kein echtes Gerät**. Touch: Playwright-Emulation (`hasTouch`, `tap`) bzw. CDP-Touchereignisse – als **emuliert** gekennzeichnet.
- Prüfling der Browsertests: `release/faellungslabor-1.0.0-web.zip`, frisch in einen leeren Temp-Ordner außerhalb des Repositorys entpackt und per HTTP ausgeliefert; Paketprüfungen zusätzlich per `file://`. Externe Netze in allen Browserkontexten blockiert.
- Zeit in den Browsertests über die Playwright-Uhr (virtuell beschleunigt, gleiche Abläufe); E20 in Echtzeit.

```sh
cd apps/faellungslabor
rm -rf node_modules dist && npm ci        # added 2 packages
npm run test:all                          # Exit 0, Laufzeit 5 min 11 s
#   npm test          → 36/36   (tests/unit/*.test.js)
#   npm run package   → Build OK: 17 Dateien, Version 1.0.0, Labkit 0.3.0; 3 Artefakte + SHA256SUMS
#   npm run test:e2e  → 21/21   (tests/e2e/results.json)
#   npm run test:scorm→ 14/14   (tests/e2e/scorm-results.json)
cd ../../shared/labkit && npm test        # 8/8 (Labkit unverändert)
```

Gegenprobe Fehlerstatus (Kopie außerhalb des Repos): falsche Version in `sivex.json` → `npm run build` Exit 1; absichtlich falscher Unit-Test → `npm test` Exit 1 und `npm run test:all` Exit 1.

Prüfsummen (`release/SHA256SUMS.txt`):

```text
edc12f8be95e4c882ebc630c4b5f91d976d4d396c0161a95d7d22f656dcbf3a3  faellungslabor-1.0.0.html
50f4449c6335e9ee171d2d310d5ea890cf1cda8058b0f39a4eeedcac20c38efd  faellungslabor-1.0.0-web.zip
2a667234851c01a214af9a61c0fd655841bb00bb4adcac3e75d59a3955b140a0  faellungslabor-1.0.0-scorm12.zip
```

## PASS/HOLD-Matrix FL01–FL34

Datum aller Entwicklerprüfungen: 16.11.2026. „Viewport“ ohne Angabe: 1440×900 (emuliert, Desktop-Chromium). Screenshots in `docs/screenshots/`, Messwerte in `docs/evidence/`.

| ID | Prüfverfahren · Eingangsdaten · Schritte | Soll | Ist | Status | Nachweis |
| --- | --- | --- | --- | --- | --- |
| FL01 | Browser E01 + Dateiprüfung: App starten, Titel/Version/Reiter lesen; `sivex.json`, zentrale README, ARCHITECTURE | neuer Name, Pfad `apps/faellungslabor/`, Metadaten, Übersichtslinks, Apps erhalten | Titel „Fällungslabor – SiVex“, Version 1.0.0 in UI/Metadaten/Manifest; `chemie/faellungslabor`; geplanter README-Eintrag ersetzt (kein Duplikat), Links auf App, Artefakte, Testbericht; Labkit und andere Apps unverändert (git diff, Labkit-Tests 8/8) | PASS | E01, `01-start-1440x900.png` |
| FL02 | E02: Etiketten und Karten aller Flaschen lesen; Unit „Konstanten“ | AgNO₃, NaCl/NaBr/NaI 0,100 M; NH₃-Werte konsistent; kein BaBr₂/Carbonat/HNO₃ | Etiketten/Karten/Modell/Doku: 0,100 mol/L; NH₃ 2,0 mol/L und 25 % ≙ 13,3 mol/L überall gleich; keine Barium-, Carbonat- oder Säureflasche (Text- und Flaschenprüfung, auch Kontrollteil) | PASS | E02, E13, `CHEMIE.md` §1 |
| FL03 | E03: drei Proben selbst füllen, je 8 Tropfen per Klick, absetzen, Pixel im Bodensatz messen | richtige Produkte und Farben, Referenz dokumentiert | AgCl/AgBr/AgI im Modell; Gelbanteil 0,010 / 0,128 / 0,264 (weiß < creme < blassgelb, AgI < 0,45); keine Produktnamen auf der Bühne; Referenzen RSC, chemguide, UC Davis | PASS | `03e-drei-faellungen-abgesetzt.png`, `evidence/E03-farben.json`, `CHEMIE.md` §7 |
| FL04 | E03/E04: Tropfen im Flug abfragen; Tippen per Maus, Touch (emuliert), Enter; Halten 2 s (Maus), 1,3 s (Leertaste) | sichtbare Einzel-/Dauertropfen, richtiges Ziel, Buchung beim Eintreffen | im Flug: 1 Tropfen, Glas unverändert; nach Eintreffen +0,05 mL und Wolke; je Tipp genau 1 Tropfen (keine Doppelauslösung Touch→Klick); Halten 2 s → 6, Leertaste 1,3 s → 4; danach kein Nachtropfen | PASS | `03a-tropfen-im-flug.png`, `03b-wolke-am-eintreffpunkt.png`, E04 |
| FL05 | E05: Spiegelhöhe während einer 1-mL-Zugabe abfragen, dann bis zum Rand dosieren | steigender Füllstand, Meniskus, Clipping, Kapazität | Spiegel steigt während des Strahls; Meniskus an der Wand; Flüssigkeit im Glas geclippt; Stopp bei 20,000 mL mit „Reagenzglas ist voll“; Volumenbilanz 10⁻⁶ | PASS | `05a-strahl-dosierhilfe.png`, `05b-reagenzglas-voll.png` |
| FL06 | E03 Bildfolge; E07 Trübung bei 1/15/31 Tropfen | mehrere Zwischenbilder, handlungsabhängige Verteilung | Bildfolge Tropfen → Wolke am Eintreffpunkt → Ausbreitung → Trübung; Trübung 0,79 / 0,69 / 0,00 je nach Menge und Volumen | PASS | `03a`–`03d`, `07-mengen-1-15-31-tropfen.png` |
| FL07 | E06: 3 mL NaI + 12 Tropfen; Bilder bei 0, 18, 48 s; Schwenken; Helligkeit oben gemessen | Absetzen, klarerer Überstand, Resuspension, Menge erhalten | Front 0,3–0,7 nach 18 s; Helligkeit oben 0,574 → 0,252 → (geschwenkt) 0,706; Feststoff vor/nach identisch (10⁻⁶) | PASS | `06a`–`06e`, `evidence/E06-ueberstand.json` |
| FL08 | E07 + Unit R1–R3: Nullzugabe, 1/15/31 Tropfen, Probe 1/3 mL, Ag-Überschuss | plausibel, kein unbegrenzter Feststoff, keine NaN | Nullzugabe klar; 31 Tropfen auf 1 mL: Feststoff = 1,0·10⁻⁴ mol (Cl⁻ limitierend); 15 Tropfen: Ag⁺ limitierend; Zustand ohne NaN/∞/negativ; Raster-Unit ohne Ausreißer | PASS | E07, `chem.test.js` R1–R3 |
| FL09 | E08: NaBr + 9 Tropfen + 0,5 mL Wasser + 1,05 mL NH₃ konz.; Sollwerte aus gezählten Bedienschritten; Unit „Bilanzen“ | Bilanzen innerhalb festgelegter Toleranz | V, Ag, NO₃⁻, Na⁺, Br⁻, NH₃: max. relative Abweichung 1,6·10⁻¹⁵ (Toleranz 10⁻⁶ vorab festgelegt); Feststoff + gelöst = gesamt | PASS | `evidence/E08-bilanz.json`, `model.test.js` |
| FL10 | E09: AgCl (10 Tr.) + 0,5 mL NH₃ verd., später +1,0 mL; Bildfolge | Rest bei zu wenig, sichtbares Auflösen bei genug | Rest 66 % (Handrechnung R4: 66,2 %); danach 0,50 → 0,43 → 0,37 → 0,33 → vollständig gelöst | PASS | `09a`–`09c-*`, `evidence/E09-agcl.json`, R4/R5 |
| FL11 | E10: zwei frische, gleich angesetzte NaBr-Gläser (10 Tr.), je 2,5 mL verd. bzw. konz. | verd. weitgehend beständig, konz. löslich, Mengenreferenz | Rest 97 % (verd.) bzw. 7 % (konz.); Referenz R6/R7 97,3 % / 6,9 % | PASS | `10-agbr-verduennt-links-konzentriert-rechts.png`, R6/R7/R9 |
| FL12 | E11: NaI (10 Tr.) + 6 mL NH₃ konz., schwenken, 30 s | sichtbarer AgI-Rest | 99,9 % Rest, Gelbanteil > 0,12 im Bodensatz | PASS | `11-agi-mit-6-ml-konz-nh3.png`, R8 |
| FL13 | E12: NH₃ vor AgNO₃; zweite andere Probe; AgNO₃ in leeres Glas; Pipette auf Flasche ziehen | kein Transfer, kurzer Hinweis, weiter bedienbar | 4/4 abgewiesen mit Zeichen, Text „Dieser Vorgang entspricht nicht der Experimentieranleitung.“, Begründung, `role=alert`; Zustand unverändert; Zeichen verschwindet nach 3 s; danach AgNO₃ und wiederholtes NH₃ möglich; bei reduzierter Bewegung ohne Wackeln (CSS-Regel; im Browser nicht gesondert geprüft) | PASS | `12a-verbotszeichen-nh3-vor-agno3.png`, `evidence/E12-grenzen.json` |
| FL14 | E13 (Kontrollteil zuerst), E14 (Hauptaufgaben 3/3 ohne Kontrollbesuch), E15 | unabhängig, Zustände getrennt | Kontrollteil zuerst bedienbar; Hauptteil danach leer; Rückwechsel erhält Kontrollansätze; Pflichtfortschritt 3/3 mit Kontrollzähler 0; Eingaben bleiben beim Reiterwechsel | PASS | E13, E14 |
| FL15 | E13: NaCl / dest. Wasser / Leitungs- / Mineralwasser je 2 mL + 5 Tropfen | NaCl positiv, Wasser klar, vergleichbar | gleiche Volumina (2,25 mL) und Tropfenzahl; Blindprobe 0 mol Feststoff; Helligkeit K1–K4 0,71 / 0,25 / 0,46 / 0,51 | PASS | `13a-kontrollen-trueb-verteilt.png`, `evidence/E13-kontrollen.json` |
| FL16 | E13: Auswertung, Lösung, Erläuterung prüfen | beide plausibel trüb, Mischfällung/Grenzen erklärt, keine Zuordnung | Wasserproben sichtbar trüb; verbindliche Aussage wörtlich; keine Halogenid- oder Gleichungsaufgabe zur Wasserprobe; Ansäuern nur in zugeklappter Erläuterung, keine Säureflasche | PASS | `13b-kontrolle-auswertung.png` |
| FL17 | E14 + Unit: leer, alles, teilweise, Fehlvorstellung, richtig; Korrektur | Formate korrekt unterschieden | leer: 0 von 4; „alles“: nicht bestanden, je falscher Aussage Begründung; teilweise: „2 … treffen zu. Es fehlen noch 2 …“; Na⁺-Fehlvorstellung konkret; nach Korrektur richtig | PASS | `14a-aufgabe-1-richtig.png`, `tasks.test.js` |
| FL18 | E14 + Unit: drei Gleichungsfragen | aq/s, Ladungen, Zuschauerionen; gekürzte erläutert | richtige Optionen exakt wie im Auftrag; gekürzte Gleichung → „Die Fällungsreaktion ist richtig dargestellt. Ergänze die Zuschauerionen …“; Distraktoren: Zustand, Feststoff, Ladung, Salzformeln, fehlende Zuschauer rechts; keine reinen Vertauschungen | PASS | `14b-gleichung-gekuerzt-rueckmeldung.png` |
| FL19 | E14/E15: Tipps 1–3, Lösung mit Rückfrage, Rückkehr zu eigenen Antworten; Produktnamen | Hilfen bedienbar, bewusste Lösung, keine Vorwegnahme | Tipp 1/3–3/3; Rückfrage vor der Lösung; „Eigene Antworten zeigen“; Bühne und Protokoll ohne Niederschlagsnamen | PASS | `14c-ammoniak-loesung-angefordert.png`, E15 |
| FL20 | E16 + Unit: Hefteintrag ohne Versuch über die Kopfzeile; Kurzfassung | immer erreichbar, knapp, Farben/NH₃/Zuschauerionen, eine Gleichung; Kontrolle separat | sofort erreichbar; 83 Wörter + Gleichung (Unit, mit Legende), 91 inkl. Überschrift (Browser); Pflichtinhalte; Kontroll-Kurzfassung 36 Wörter nur im Kontrollteil | PASS | `16a-hefteintrag-sofort.png`, `16b-kurzfassung-kontrollen.png` |
| FL21 | E17: Zustand vor/nach Umschalten vergleichen; Bodensatz gegen Überstand messen | gleiche Chemie, beide Varianten brauchbar | Zustand (Zeit, Mengen, Front) identisch; Farbabstand Bodensatz/Überstand ≥ 0,137 in beiden Varianten, weißer Bodensatz hebt sich auch in der Helligkeit ab | PASS | `17a-hintergrund-dunkel.png`, `17b-hintergrund-hell.png`, `evidence/E17-kontrast.json` |
| FL22 | E02 (Touch-Emulation 1180×820) + `QUELLEN.md` | Lösungen/SDB belegt, Karten touchbedienbar | 9 Karten per Tippen geöffnet, Piktogramme je Lösung wie belegt, Wasser ohne Symbole, Karte vollständig im Bild, Schließen per Knopf/Escape; Ableitungen gekennzeichnet | PASS | `02-ghs-karte-*.png`, `QUELLEN.md` |
| FL23 | E18: 1024×768, 1180×820, 1440×900, 1920×1080, 820×1180 (emuliert); Splitter Maus/Tastatur/Doppelklick/Touch (CDP) | alles bedienbar, kein Clipping | kein horizontales Scrollen; Reagenzglas 79×277 bis 127×449 px; Bedienelemente im Bild; Bedienfeld und Gleichungen ohne Abschneiden; Splitter ±24 px, max. 620 px, Rücksetzen, Fingerzug | PASS | `18-format-*.png`, `evidence/E18-formate.json` |
| FL24 | E04, E19: Halten mit pointercancel, blur, verborgenem Tab; Wechsel des Versuchsteils während Dosierhilfe | Ende in allen Fällen, keine Doppel-/Hintergrunddosierung | jeweils keine weiteren Tropfen nach dem Abbruch; Teilwechsel beendet Zugabe, Pipette zurück | PASS | E04, E19 |
| FL25 | E20 (Echtzeit): Pause, Bedienen in Pause, Neuladen während gedrückter Dosierung, Spülen, Gesamtreset (Abbrechen/Ja), Speicher gesperrt | keine Blockade, gezielter Reset, Reload/Storage-Fehler ok | Pause hält an; Tropfen beendet Pause mit Hinweis; nach Reload: 1×, nichts im Flug, Pipette zurück, Ansatz A1 erhalten; Spülen leert nur Glas; Gesamtreset nur nach Bestätigung; mit gesperrtem `localStorage`/`sessionStorage` voll bedienbar | PASS | E20 |
| FL26 | P04, S01, S02: Einzeldatei in leeren Temp-Ordner kopiert, `file://` und HTTP, Kernablauf | volle Funktion offline ohne Quellordner | 12 Skripte, 2 Stylesheets, Piktogramme eingebettet; je 1 Anfrage (die Datei selbst); Haupt-, Ammoniak-, Kontroll-, Aufgaben- und Hefteintragsablauf ohne Fehler | PASS | `50-einzeldatei-file.png`, `scorm-results.json` |
| FL27 | P03, S03, S04: Web-ZIP frisch entpackt, `file://` und HTTP; alle Browsertests E01–E21 auf diesem Paket | vollständige statische App | 17 Dateien, identisch mit SCORM-Inhalt; beide Zugänge mit Kernablauf fehlerfrei; E01–E21 auf dem entpackten Paket | PASS | `51-web-zip-file.png` |
| FL28 | P01, P02: Manifest und Dateien | Manifest im Stamm, gültige Referenzen | `imsmanifest.xml` im Stamm, kein verschachteltes Manifest, SCORM 1.2/ADL, IMS- und ADLCP-Namespaces, ein SCO `index.html`, Manifest = ZIP-Inhalt (17 Dateien), nur relative interne Verweise | PASS | `scorm-results.json` |
| FL29 | L01–L05: Mock-LMS iframe/neues Fenster mit API, ohne API, `LMSInitialize` → 'false', `LMSInitialize` wirft | Init/Finish, Fehlerpfade, keine Lern-/Personendaten | mit API: genau `LMSInitialize` + `LMSFinish`; ohne API: keine Aufrufe; Fehlerpfade: ein Init-Versuch, kein Finish, keine Schleife, keine Konsolenfehler; nie `LMSGetValue`/`LMSSetValue`/`LMSCommit`; App jeweils bedienbar | PASS | `52-scorm-iframe.png`, `52-scorm-popup.png`, `evidence/scorm-lms-aufrufe.json` |
| FL30 | E21 + S01–S04: externe Netze blockiert, frische Kontexte | alles offline vollständig, keine Konsolenfehler | 390 Seitenanfragen in E01–E20, extern 0; Konsolen-/Seitenfehler 0; Paketprüfungen ebenso. (Chrome selbst versucht im Container Verbindungen zu Google-Diensten – Browserprozess, nicht die Seite; vom Proxy abgelehnt, ohne Einfluss.) | PASS | `results.json` E21 |
| FL31 | P05 + Build-Prüfung | Versionen, frischer Build, SHA256SUMS, Quellstand | 1.0.0 in `package.json`, `sivex.json`, App, Oberfläche, Manifest, Dateinamen; SHA256SUMS für alle 3 Artefakte korrekt; keine alten Pakete; alle 17 Laufzeitdateien byte-gleich mit dem Quellstand | PASS | `scorm-results.json` P05 |
| FL32 | – | echtes iPad/Safari | **nicht durchgeführt** (kein Gerät in dieser Umgebung); nur Emulation (FL23/FL24) | **HOLD – unverified** | – |
| FL33 | – | frischer mebis-Import, neues Fenster, Zielgerät | **nicht durchgeführt** (kein mebis-Zugang); nur Mock-LMS (FL29) | **HOLD – unverified** | – |
| FL34 | – | Lehrkraft bestätigt Modell, Texte, Farben | **ausstehend** | **HOLD – unverified** | – |

## Gefundene und behobene Fehler (Korrekturschleife)

| Befund (Screenshot/Test) | Korrektur | erneut geprüft |
| --- | --- | --- |
| Pipette über einem Glas lag hinter den HTML-Etiketten der Flaschen | Etiketten auf die Zeichnung verlegt, unsichtbare Schaltflächen darüber | E02, E18, Sichtprüfung |
| Pipettenhütchen am oberen Bühnenrand abgeschnitten | Höhenaufteilung und Pipettenlänge angepasst | Sichtprüfung |
| Bedienleiste bei 1024 px dreizeilig, Glasbeschriftung lief in die Leiste | kürzere Beschriftungen, feste Zeilenstruktur, höherer Beschriftungsstreifen | E18 |
| Fieldsets im schmalen Bedienfeld breiter als die Spalte (Auswahl abgeschnitten) | `min-width: 0` für Fieldsets, Umbruch der Legenden | E18 (Clipping-Prüfung) |
| Ergebnisübersicht: Hinweis nannte Silberbromid/-iodid vor der eigenen Zuordnung | neutral formuliert | E14 (Produktnamen-Prüfung) |
| Tabelle der Ergebnisübersicht im schmalen Feld zerbrochen („An-sa-tz“) | Einträge als Liste | E15 |
| erneutes Antippen eines Glases nach dem Probenfüllen hätte Probe nachgefüllt | Messpipette kehrt nach der Abgabe selbst zurück | Unit, E04/E07 |
| AgCl-Reste lösten sich asymptotisch nie ganz | kleiner Mindestumsatz beim Auflösen (dokumentiert) | Unit „NH₃ … AgCl“, E09 |
| heller Hintergrund: weißer Bodensatz kaum vom Überstand zu unterscheiden | Kontrastschirm „hell“ etwas dunkler, Flüssigkeit weniger getönt, Kante am Bodensatz | E17 |
| Reiter des Bedienfelds liefen bei 1024 px über | gleichmäßig verteilte Reiter („Protokoll“ statt „Beobachtung“) | E18 |

**Präzisierte Prüfkriterien (offen dokumentiert):** E17 verlangte zunächst nur einen Helligkeitsunterschied Bodensatz/Überstand. Für den gelblichen AgI-Bodensatz vor hellem Grund ist der Farbton das trennende Merkmal; das Kriterium lautet jetzt: Farbabstand ≥ 0,08 für alle Gläser **und** Helligkeitsabstand > 0,035 für den weißen AgCl-Bodensatz in beiden Varianten. E14: Teilantwort-Text an die korrigierte Grammatik („Es fehlen noch 2 …“) angepasst. Kein Test wurde abgeschwächt, um einen Fehler zu verdecken.

## Grenzen dieser Prüfung

- Nur Chromium (Chrome for Testing 153); Safari/WebKit nicht geprüft – gerade für iPad relevant (FL32).
- Touch und Tablet-Formate emuliert; Bildschirmtastatur, echtes Fingerverhalten und Safari-Eigenheiten (Auswahllisten, Zoom) nicht geprüft.
- Farben nur gegen Textbeschreibungen fotografisch dokumentierter Versuche abgeglichen, nicht pixelgenau gegen Fotos (Teil von FL34).
- Mock-LMS statt mebis; „Neues Fenster“ von mebis auf Schul-iPads offen (FL33).

## Nächste Prüfschritte (reproduzierbar)

1. **FL32:** `release/faellungslabor-1.0.0.html` oder Web-ZIP auf ein Schul-iPad (Safari, Querformat und Hochformat): Probe füllen, Tropfen tippen und halten, Ammoniak-Dosierhilfe, Schwenken, Kontrollteil, Aufgaben (Auswahllisten!), Hefteintrag, GHS-Karte, Trennlinie mit dem Finger.
2. **FL33:** `release/faellungslabor-1.0.0-scorm12.zip` frisch in mebis importieren, Darstellung „Neues Fenster“, auf dem iPad starten, einmal Haupt- und Kontrollablauf, Neuladen.
3. **FL34:** Lehrkraft prüft Modell (`docs/CHEMIE.md`), Texte, Aufgaben, Hefteintrag und Farben (Screenshots `03e`, `10`, `11`, `13a`, `17a/b`).

Erst wenn FL32–FL34 für genau diese Version bestanden sind, `sivex.json` auf `ready` setzen.
