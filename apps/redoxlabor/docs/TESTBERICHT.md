# Testbericht und PASS/HOLD-Abnahme – Redoxlabor

## Nachtrag 22.10.2026 – Überarbeitung nach unabhängiger Prüfung

**Anlass:** [REVIEW-2026-10-22.md](REVIEW-2026-10-22.md) · **Umsetzung:** [REVIEW-2026-10-22-UMSETZUNG.md](REVIEW-2026-10-22-UMSETZUNG.md)
**Prüfumgebung:** Windows 11 Pro, Node.js 24.19.0, Microsoft Edge 155.0.4283.62 über Playwright 1.62.1 (`PW_CHANNEL=msedge`, headless). Das Projekt pinnt Playwright 1.56.1; hier lief die lokal vorhandene neuere Version. Geprüft wurde der statische Build `dist/redoxlabor/`.

| Testart | Umfang | Ergebnis |
| --- | --- | --- |
| Unit-Tests | 62 Tests: 45 bisherige (3 an die korrigierte Chemie angepasst: Tollens bei Raumtemperatur, „grau“ als positive Beobachtung, Farbverlauf über `cu2o`) + 16 Regressionstests R1–R6/Übersicht (`tests/unit/regression.test.js`) + 1 Test der Carboxylat-Gleichungen | **62/62 bestanden** |
| Build | statische Kopie, Prüfung auf externe Ressourcen, absolute Pfade, Netzwerkzugriffe | **OK** (11 Dateien, 256 KiB) |
| Browser-Tests | 26 bisherige Prüfungen (angepasst: Verlauf bis Reaktionsende statt bis zur ersten Beobachtbarkeit, Gasbrenner unter „Weitere Geräte“) + 6 neue: R3 (Formularentwurf, Markierung, Fokus), R4 (Zwischenstand im Panel und Protokoll), neutrale Lupe (Pixel), R2 (Silberbelag bleibt nach Fehling I, Pixel), Tablet-Beschriftung 1024×768 und 1180×820 | **32/32 bestanden** (209 s; zweiter Lauf, der erste ergab ebenfalls 32/32) |
| SCORM-Paket | 9 Prüfungen mit simuliertem LMS, Paket aus dem überarbeiteten Build | **9/9 bestanden** – keine `LMSGetValue`/`LMSSetValue`-Aufrufe |

Das SCORM-Paket wurde für diesen Test zunächst nur vorübergehend erzeugt.

**Release 1.1.0 (22.10.2026):** `redoxlabor-1.1.0-web.zip` und `redoxlabor-1.1.0-scorm12.zip` aus dem überarbeiteten Stand gebaut. Prüfung: zweiter Build byte-identisch (Prüfsummen gleich), ZIP-Integrität OK (Web 11 Einträge, SCORM 12 inkl. `imsmanifest.xml`, Manifest-Version 1.1.0), SCORM-Prüfung mit simuliertem LMS gegen das fertige Paket **9/9 bestanden**, Unit-Tests 62/62. Die Pakete 1.0.0 liegen unverändert daneben (alter Stand).

**Nicht durchgeführt:** Test auf einem echten iPad mit Safari/WebKit, Import in einen echten mebis-Kurs, Unterrichtstest mit Lernenden, vollständiges Accessibility-Audit (Screenreader-Ausgabe nur strukturell umgesetzt, nicht mit VoiceOver/NVDA geprüft). Der Gesamtstatus bleibt deshalb **HOLD – nicht verifiziert**.

Neue Screenshots: `review-r2-silber-bleibt.png`, `review-r3-entwurf-bleibt.png`, `review-r4-zwischenstand.png`, `review-lupe-neutral.png`, `review-panel-1024x768.png`, `review-panel-1180x820.png`. Alle übrigen Screenshots in `docs/screenshots/` wurden mit dem überarbeiteten Stand neu erzeugt.

---

## Erstfassung (Redoxlabor 1.0)


**Stand:** 22.10.2026 · **Prüfumgebung:** Linux-Container, Node.js 22, Chromium (Playwright 1.56.1, headless) · **Geprüft wurde der statische Build** `dist/redoxlabor/`.

## Ergebnisübersicht

| Prüfbereich | Ergebnis |
| --- | --- |
| Chemische Korrektheit (C-01 – C-11) | **PASS** |
| Experimentelle Interaktivität (E-01 – E-10) | **PASS** |
| Grafische Qualität (V-01 – V-08) | **PASS** (V-08 auf Tablet-Viewports in Chromium; echtes iPad offen, siehe T-04/T-05) |
| Didaktische Funktionen (D-01 – D-08) | **HOLD – nicht verifiziert** (nur D-08: kein Test mit Lernenden) |
| Technische Qualität (T-01 – T-10) | **HOLD – nicht verifiziert** (nur iPad-Gerätetest: kein iPad verfügbar) |
| **Gesamtprojekt** | **HOLD – nicht verifiziert** |

**Begründung des Gesamt-HOLD:** Kein Kriterium ist fehlgeschlagen und keine Pflichtfunktion fehlt. Zwei verpflichtende Nachweise konnten in dieser Umgebung nicht erbracht werden: (1) der Test auf einem echten iPad mit Safari (die Browser-Tests liefen in Chromium mit Touch-Emulation; WebKit war nicht verfügbar) und (2) die Verständlichkeit für Lernende der Jahrgangsstufe 10 (D-08), die sich nur mit einer Schülergruppe prüfen lässt. Nach bestandenem iPad- und Klassentest kann der Gesamtstatus auf PASS gesetzt werden.

## Ausgeführte Tests

| Testart | Umfang | Ergebnis |
| --- | --- | --- |
| Unit-Tests (`npm test`) | 45 Tests: Stoffdaten, Farbmodell, alle 6 Proben × 2 Nachweise, Fehlerfälle, Zustandsmaschine, Hilfen, Modi, Protokollbewertung, Gleichungsbilanzen, Trainer | **45/45 bestanden** |
| Build (`npm run build`) | statische Kopie; Prüfung auf externe Ressourcen, absolute Pfade, Netzwerkzugriffe, fehlende Dateien | **OK** (10 Dateien, 227 KiB) |
| Browser-Tests (`npm run test:e2e`) | 26 Prüfungen mit echter Bedienung (Maus, Touch-Antippen, Drag-and-drop), Pixelmessungen in der gerenderten Lupe über die Zeit, Screenshots | **26/26 bestanden** (167 s; zweimal hintereinander stabil, siehe unten) |
| Start per `file://` und `npm start` | manuell per Skript | App startet fehlerfrei; HTTP 200 |
| SCORM-Paket (`npm run test:scorm`) | 9 Prüfungen: Manifest (SCORM 1.2, SCO, alle Dateien gelistet, keine externen Ressourcen), Start im simulierten LMS eingebettet und als neues Fenster, Kernversuch Fehling/Ethanal, `LMSInitialize`/`LMSFinish`, keine Datenübertragung | **9/9 bestanden** ([`scorm-results.json`](../tests/e2e/scorm-results.json), Screenshot `17-scorm-im-mock-lms.png`) |
| Paketierung (`npm run package`) | Web-ZIP und SCORM-ZIP, Integritätstest mit `unzip -t`, zweiter Build byte-identisch | **OK** |

Rohdaten: [`tests/e2e/results.json`](../tests/e2e/results.json). Screenshots: [`docs/screenshots/`](screenshots/).

## 1. Chemische Korrektheit

**Implementierung:** `js/chemistry.js` (Teilchen-/Phasenmodell, temperaturabhängige Kinetik, optisches Modell), `js/redox.js` (Gleichungen, Formelparser). Details: [CHEMIE.md](CHEMIE.md).

| ID | Status | Nachweis (tatsächlich beobachtet) |
| --- | --- | --- |
| C-01 | PASS | Gerenderte Lupe, Fehling I: Farbton 207°, Helligkeit 0,76, Buntheit 101/255 → hellblau, klar (keine Trübung). Unit-Test Farbmodell. Screenshot `02-…` |
| C-02 | PASS | Fehling II: Buntheit 9/255, Helligkeit 0,95 → farblos, klar. Screenshot `02-…` |
| C-03 | PASS | Nach Zugabe Schichtung sichtbar (`02b-…`), nach Schütteln Farbton 229°, Helligkeit 0,47 → tiefblau (deutlich dunkler als Fehling I). `03-…` |
| C-04 | PASS | Unit-Test: Ethanal, Propanal, Butanal → positiv (Umsatz > 97 %, Trübung > 0,85, Farbton ziegelrot). Browser: Ethanal (F-01, Maus) und Propanal (F-02, Touch) positiv, Endfarbton 10° bzw. 12° |
| C-05 | PASS | Unit-Test: alle drei Ketone negativ, Umsatz 0, keine Trübung. Browser N-01 (Propanon, offline): blau (228°), Ergebnis „negativ“. `06-…` |
| C-06 | PASS | Farbverlauf F-01: 9 unterscheidbare Farbtonstufen von 229° (blau) über blaugrün/gelbgrün bis 10° (ziegelrot). Kontaktbogen `seq-fehling-ethanal.png` |
| C-07 | PASS | Unit-Test alle drei Aldehyde; Browser: Ethanal (F-03) und Butanal (F-04, Drag-and-drop) mit Silberspiegel |
| C-08 | PASS | Unit-Test alle drei Ketone; Browser N-02 (Butanon): Spiegelbedeckung 0, Anteil dunkler Pixel 0,0003, Lösung klar. `15-…` |
| C-09 | PASS | F-03: Belag wächst nur unterhalb des Flüssigkeitsspiegels (dunkle Pixel oberhalb: 0), Anteil dunkler Pixel 0,0003 → 0,45. `08-…`, `seq-tollens-ethanal.png` |
| C-10 | PASS | Unit-Tests: Atom- und Ladungsbilanz aller 6 Gleichungen über einen Formelparser; Gesamt = Oxidation + Reduktion; Elektronenzahlen gleich. Im Browser angezeigte Bilanz: R 1/1, C 1/1, H 5/5, O 5/5, Cu 2/2, Ladung 0/0 |
| C-11 | PASS | Unit-Test: Produkt stets `R-COOH`, kein Carboxylat; fachlicher Hinweis zur Vereinfachung im Trainer vorhanden |

Zusätzlich geprüft: Tollens-Vorbereitung (AgNO₃ farblos → brauner Niederschlag mit NaOH, Farbton 27°, Helligkeit 0,41 → teilweise gelöst → klar, Buntheit 8/255), Fehlbedienungen (Fehling I + NaOH → Cu(OH)₂/CuO, Kupfer + Silber gemischt, Siedeverzug) werden nicht korrigiert, sondern fachlich als ungültig bewertet.

## 2. Experimentelle Interaktivität

**Implementierung:** Zustandsmaschine in `js/lab.js` mit 10 Phasen; Handlungen als zeitlich ablaufende Vorgänge (Pipettieren, Umsetzen, Schütteln), deren chemische Wirkung erst beim Eintropfen eintritt.

| ID | Status | Nachweis |
| --- | --- | --- |
| E-01 | PASS | Reagenzgläser, Reagenzien, Proben, Heizplatte, Brenner frei wählbar (Panel und Labortisch); F-02 vollständig per Antippen auf dem Labortisch |
| E-02 | PASS | Reagenzien müssen einzeln zugegeben werden; unvollständige Kombinationen ergeben keinen Nachweis (N-03, N-05) |
| E-03 | PASS | Ablauf erfordert Auswählen, Zugeben, Mischen, Probe, Erwärmen, Beobachten; Phasenfolge `notPrepared → … → evaluated` im Unit-Test geprüft |
| E-04 | PASS | Unit-Test (ohne Probe, nur Fehling II, ohne Wärme, Keton → kein Umsatz); Browser N-03, N-04 (25 s ohne Erwärmen: Umsatz 0) |
| E-05 | PASS | Unit-Test (kein Spiegel ohne Wärme); Browser N-05 (ohne Ammoniak): Umsatz 0, Spiegel 0 |
| E-06 | PASS | N-01, N-02 sowie Unit-Tests für alle Ketone |
| E-07 | PASS | Pixelmessung im Handlungsbereich: jede Bildänderung während der Zugabe 0,42–0,64 gegenüber Ruherauschen 0,056; Füllhöhe steigt in der Lupe allmählich (0 → 2 → 32 → 38 → 40 px); Schütteln 4,9–12,0 |
| E-08 | PASS | Aldehyd zugegeben, nicht erwärmt: Probe im Zustand, Phase „Stoffprobe hinzugegeben“, Umsatz 0, Darstellung blau (230°). Während des Umsetzens ist das Glas weder im Ständer noch im Bad. Ein hierbei gefundener Fehler wurde behoben (siehe unten) |
| E-09 | PASS | „Laboraufbau zurücksetzen“: alle Gläser leer, Heizplatte aus; erneute Durchführung möglich |
| E-10 | PASS | Negativer Nachweis (Propanon) im Protokoll vollständig richtig ausgewertet („Alles richtig ausgewertet!“) |

## 3. Grafische Qualität

**Implementierung:** Canvas-2D-Renderer (`js/render.js`) mit zur Laufzeit erzeugter Grafik: transparente Glasgeräte mit Kantenbrechung und Glanzlichtern, Flüssigkeiten mit Meniskus, Wellen und Schwappen, Strahl und Tropfen beim Pipettieren, Schichtung und Schlieren beim Mischen, Wolkentextur und Partikel für Niederschläge, Silberschicht aus wachsenden Keimen mit Metallverlauf, Wasserbad mit Blasen und Dampf, Brennerflamme, Siedeverzug mit Spritzern. Eine Lupe zeigt das aktive Reagenzglas vergrößert vor weißem Hintergrund. Keine Bilder oder Videos.

| ID | Status | Nachweis |
| --- | --- | --- |
| V-01 | PASS | Screenshots `01`, `03`, `08`: Glas transparent (Hintergrund sichtbar), Ränder, Glanzlichter; Reagenzglas 1 : 7 (Breite : Höhe), Becherglas mit Graduierung. Visuelle Begutachtung |
| V-02 | PASS | Meniskus und Oberfläche sichtbar; Bewegung beim Zugeben und Schütteln gemessen (siehe E-07); Schichtung beim Mischen `02b-…` |
| V-03 | PASS | 9 Farbtonstufen, zeitlich getrennt aufgenommen (`seq-fehling-ethanal.png`: 0 %, 7 %, 22 %, 40 %, 57 %, 74 %, 100 %) |
| V-04 | PASS | Körnung (lokale Rauheit) der Lupe: klare Lösung 1,27 → Cu₂O-Suspension 3,62 (Kriterium ≥ doppelt); Partikel und Wolkentextur sichtbar `05-…` |
| V-05 | PASS | Anteil dunkler Pixel im Glas wächst in ≥ 4 Stufen (0 → 0,45); Belag nur an der benetzten Wand; Kontaktbogen `seq-tollens-ethanal.png` |
| V-06 | PASS | Silberfläche unbunt (Buntheit 0,04) mit großem Helligkeitsumfang quer über das Glas (141 gegenüber 14 bei klarer Lösung): Glanzlichter und dunkle Spiegelung. `08-…`, `08b-…` |
| V-07 | PASS | Mehrere zeitlich getrennte Zustände beider Hauptversuche (Kontaktbögen) sowie Bewegungsmessung |
| V-08 | PASS* | 1024×768, 1180×820, 1280×800, 1366×1024, 1920×1080: kein horizontales Scrollen, Labortisch ≥ 60 % der Breite, Touch-Ziele ≥ 40 px. `09-…`, `09b-…`. *In Chromium; echtes iPad siehe T-04/T-05 |

## 4. Didaktische Funktionen

| ID | Status | Nachweis |
| --- | --- | --- |
| D-01 | PASS | Lernmodus: Proben mit Namen, Summenformel und Halbstrukturformel (Info-Dialog, SVG) |
| D-02 | PASS | Analysemodus: Proben A–F, beim Neustart neu gemischt; Browser-Test mit zwei unbekannten Proben, Ergebnisübersicht, Einordnung prüfen, Auflösung (`16-…`) |
| D-03 | PASS | Drei Hilfestufen, aus dem aktuellen Zustand erzeugt; Unit-Test: fünf Situationen → fünf verschiedene Anleitungen; Browser: Kontextwechsel setzt die Hilfe zurück (`13-…`) |
| D-04 | PASS | Protokollformular zuerst ohne Lösung; Musterauswertung erscheint erst nach „Speichern und auswerten“ oder „Lösung anzeigen“ |
| D-05 | PASS | Positive und negative Fälle korrekt gedeutet; unzulässige Schlüsse („eindeutig Ethanal“, „Keton bewiesen“) werden als falsch markiert (Unit-Test) |
| D-06 | PASS | Trainer mit 6 Schritten (Zuordnung, Oxidationszahlen, Elektronen, Ausgleich, Teilgleichungen, Gesamtgleichung) für beide Nachweise; Browser-Test inkl. Fehlermarkierung und Tipp |
| D-07 | PASS | Musterlösung erst nach Bearbeitung oder ausdrücklicher Bestätigung; im Test vor dem Anfordern nicht sichtbar |
| D-08 | **HOLD – nicht verifiziert** | Gestaltungsmaßnahmen: Einführungsdialog, Beschriftungen auf dem Tisch, Lupe, Versuchsschritte-Liste, Hilfen, Rückmeldungen. Ein Test mit Lernenden der Jahrgangsstufe 10 wurde nicht durchgeführt |

## 5. Technische Qualität

| ID | Status | Nachweis |
| --- | --- | --- |
| T-01 | PASS | Rein statisch; läuft per `file://`, `npm start` und von jedem Webserver |
| T-02 | PASS | Keine APIs, keine KI-Dienste, keine Abhängigkeiten zur Laufzeit |
| T-03 | PASS | In allen 26 Browser-Prüfungen keine `pageerror`- oder Konsolenfehler |
| T-04 | PASS* | Maus: alle Abläufe; Touch: F-02 und Hilfe ausschließlich per Antippen (Chromium, `hasTouch`); Drag-and-drop optional (F-04). *Echtes iPad nicht geprüft |
| T-05 | PASS* | Tablet-Querformat 1024×768 und 1180×820 ohne horizontales Scrollen. *Echtes iPad nicht geprüft |
| T-06 | PASS | N-01 vollständig mit `context.setOffline(true)` nach dem Laden durchgeführt |
| T-07 | PASS | `chemistry.js`/`lab.js` ohne DOM, in Node getestet; Renderer liest nur Zustand |
| T-08 | PASS | [README](../README.md) mit Start, Aufbau, Tests, Einschränkungen |
| T-09 | PASS | `npm test`, `npm run build`, `npm run test:e2e`, `npm start` erfolgreich ausgeführt |
| T-10 | PASS | 9 Anfragen, alle an den lokalen Testserver; keine externen; Daten nur im `sessionStorage` |
| iPad-Gerätetest | **HOLD – nicht verifiziert** | Kein iPad und keine WebKit-Engine in der Prüfumgebung. Offen: Safari-Rendering, Touch-Verhalten, Leistung, Fenster-/Tab-Verhalten in mebis |

## Während der Prüfung gefundene und behobene Fehler

1. **Unsichtbarer Dialog blockierte alle Klicks** – `display:grid` überschrieb das `hidden`-Attribut. Behoben durch globale Regel `[hidden]{display:none!important}`.
2. **Darstellung passte nicht zum Zustand (E-08):** Nach dem Auflösen des Ag₂O zeigte die Schichtungsdarstellung unten noch braun, obwohl die Lösung laut Zustand klar war. Behoben: Tollens-Reagenzien werden unter Umschwenken zugegeben (keine Schichtung); Schichtung nur, solange die Durchmischung im Zustand unvollständig ist.
3. **Auswertung markierte richtige/falsche Antworten nicht farbig** (CSS-Spezifität von `:has()`). Behoben.
4. **Beschriftung „Ammoniaklösung“ lief im Tablet-Panel über.** Behoben (kompakte Beschriftung, `minmax(0,1fr)`).
5. **Visuelle Verbesserungen nach Messung:** tiefblaue Lösung satter, Silberfilm deckender und kontrastreicher, Cu₂O-Körnung kräftiger, Spritzer beim Siedeverzug realistischer.

Korrekturen an der **Messmethodik** (nicht an der App), offen dokumentiert:

- „Farblos“ wird über die Buntheit (max − min der RGB-Werte) geprüft statt über die HSL-Sättigung, die bei fast weißen Farben irreführend hoch ist.
- Die Sonde für den Silberspiegel maß wegen eines Rechenfehlers nur das mittlere Fünftel des Glases; korrigiert. Das Metallkriterium wurde von der Standardabweichung auf den Helligkeitsumfang quer über das Glas (Median aus drei Höhen) umgestellt.
- Die Körnung wird als Median aus fünf Linien gemessen und mit der klaren tiefblauen Lösung verglichen (vorher eine Linie, verrauscht durch Siedebläschen).
- Bewegungskriterium für Zugaben: jede Bildänderung > 2× Ruherauschen und die stärkste > 5×, gemessen im Handlungsbereich; zusätzlich steigende Füllhöhe in der Lupe.

Nach diesen Änderungen lief die vollständige Suite zweimal hintereinander mit 26/26 durch.

## Verbleibende Einschränkungen

- Kein Test auf echtem iPad/Safari (WebKit) – **offen**.
- Kein Test mit Lernenden (D-08) – **offen**.
- SCORM-1.2-Paket nur mit simuliertem LMS geprüft; Import in einen echten mebis-Kurs **offen**.
- Zeitraffer und Portionsmodell; keine reale Kinetik, keine Strömungsmechanik.
- Tollens bei Raumtemperatur im Modell ohne Reaktion (real langsam möglich).
- Das Absetzen von Cu₂O ist vereinfacht dargestellt.
- Expertenmodus Glucose/Fructose nicht umgesetzt.
- Visuelle Kriterien (V-01, V-06) beruhen neben Messwerten auf Begutachtung der Screenshots durch den Entwickler; eine fachdidaktische Sichtprüfung durch die Lehrkraft wird empfohlen.

## Empfohlene nächste Prüfschritte

1. Build auf Schul-iPads in Safari öffnen (Querformat): kompletter Fehling- und Tollens-Versuch nur per Finger, Bildrate beobachten.
2. Kurzer Klassentest (2–3 Schülergruppen) zu D-08.
3. Danach `release/redoxlabor-1.1.0-scorm12.zip` in einem mebis-Testkurs („Neues Fenster“) hochladen und auf Schul-iPads starten.
