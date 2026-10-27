# Trennverfahren 0.1.0 – Testbericht

Stand 27.10.2026 · Statusbegriffe nach [`docs/QUALITY.md`](../../../docs/QUALITY.md) · Gesamtstatus: **prototype** (echte iPad-, mebis- und Unterrichtsprüfung offen)

## Umgebung

| | |
| --- | --- |
| System | Windows 11 Pro (10.0.26300) |
| Node.js | 24.22.1 |
| Browser | Microsoft Edge 156.0.4314.50 über Playwright 1.56.1 (`channel: msedge`) |
| Baukasten | Labkit 0.1.1 (unverändert) |
| Pakete | `release/trennverfahren-0.1.0-web.zip`, `release/trennverfahren-0.1.0-scorm12.zip`, Prüfsummen in `release/SHA256SUMS.txt` |

## Ausgeführte Befehle

```bash
npm test                  # 40 Unit-Tests (Modell 25, Aufgaben 7, Geometrie 3, Labkit 5)
npm run package           # Build-Prüfung (keine externen Ressourcen/absoluten Pfade/Netzzugriffe), Web- und SCORM-ZIP
node tests/e2e/run.mjs    # Szenarien E1–E8 (10 Läufe) über die gerenderte Oberfläche
node tests/e2e/scorm.mjs  # 16 Paketprüfungen auf den ausgelieferten ZIP-Dateien
```

Ergebnisse maschinenlesbar: [`tests/e2e/results.json`](../tests/e2e/results.json), [`tests/e2e/scorm-results.json`](../tests/e2e/scorm-results.json).

**Reihenfolge:** Der vollständige Lauf (Unit, Paket, E1–E8, Pakete) erfolgte auf dem finalen Code. Danach wurde nur noch ein Text der Materialliste von Versuch 5 berichtigt („Becherglas A“ statt „Bechergläser A und B“); anschließend wurden Unit-Tests, Paketbau, E1 (Pflichtablauf) und alle 16 Paketprüfungen erneut ausgeführt – die ausgelieferten ZIP-Dateien sind die danach gebauten.

## Ergebnisse je Abnahmebereich

| Bereich | Status | Nachweis |
| --- | --- | --- |
| **Fachmodell** | **PASS** | `tests/unit/model.test.js`: Bilanz nach jeder Handlungsfolge (Abweichung < 10⁻⁶, inkl. Spritzflasche, Verlusttöpfe); Löslichkeitsgrenze (Sättigung bei 5 mL, ungelöstes Salz bleibt fest), Lösen nur mit Wasser, Rühren ≥ 3× schneller; gelöstes Salz passiert das Papier, Sand und ungelöstes Salz nicht, trockenes Filtrieren trennt nicht; untere Wasserschicht fließt zuerst; Magnet nimmt nur Eisen; kein Sieden bei kalter Lösung, Salz wird nicht gasförmig, Kristalle entstehen bei Sättigung. |
| **Alle Versuche** | **PASS** | E1: alle fünf Versuche über echte Klicks einschließlich Beobachtung, Einordnung, Trennprinzip; Kontrolle mit Fehlern und Korrektur; Hefteintrag. Zusätzlich vollständig im SCORM-Paket (neues Fenster) und im entpackten Web-ZIP per `file://` (SCORM-popup-2, WEB-2). |
| **Korrekturen** | **PASS** | E4: zu früh/zügig dekantiert (3,3 g Sand im Dekantat) → absetzen, in C abgießen; ohne Papier filtriert (19,9 g Sand im Kolben, Warnung im Hinweisbereich); zu wenig Wasser (3,3 g ungelöstes Salz im Filter, Tipp 2/3 nennt das) → nachgespült (0,00 g); zu spät geschlossen (10 mL Öl im Wasser) → zurückgegossen und erneut geschieden; alternative Reihenfolge (lösen → filtrieren → Magnet am Rückstand → eindampfen) erreicht alle Ziele. Unit-Tests decken dieselben Fälle sowie Unterdruck bei Stopfen, Trichter-Überlauf und Filtrat ohne Vorlage ab. Keine Sackgasse gefunden; „Neu beginnen“ setzt nur den Ansatz zurück. |
| **Animation** | **PASS** | E7 (Bildfolgen in `docs/screenshots/anim/`, je 5–10 Bilder, 2× Auflösung): Aufrühren, Sedimentation (schwebend 17,3 → 1,9 g, monoton), Gießen (A 100 → 82 mL, B 0 → 18 mL im selben Transfer, Summe inkl. Verdunstung konstant), Wellen am Auftreffpunkt (Amplitude 1,06 → 0,000 nach dem Stoppen), Tropfen des Filtrats (11,0 → 17,9 mL, 9 von 10 Bildern verändert), Schütteln und Entmischen (Emulsion 1,00 → 0,32), Lösen (3,24 → 1,20 g fest), Eindampfen (Wasser 21,7 → 0,0 mL, Kristalle 0,0 → 7,8 g). Gemessen wurde jeweils während des laufenden Vorgangs. Bilder visuell gesichtet: waagrechter Spiegel im gekippten Glas, Strahl beginnt am Ausguss, Bodensatz haftet, Tropfen fallen aus dem Trichterrohr in den Kolben, Tröpfchen steigen auf. |
| **Teilchenmodell** | **PASS** | E8: Gefäßbezug und Legende passen (Lösung: Na⁺/Cl⁻, Text „kein eigener Aggregatzustand“); Filter (Poren-Text), Emulsion (Tröpfchen) dargestellt; Pause: Laborausschnitt, Teilchenbild und Versuchszeit bitgleich nach 1,2 s, nach Fortsetzen Bewegung; dreimaliges Umschalten ändert den Modellzustand nicht; Schalter bleibt über Reiter- und Versuchswechsel an. |
| **Kopfzeile** | **PASS** (Emulation) | Beide Schalter einzeln und kombiniert in E6 (alle Versuche, drei Größen), per Tastatur (E3), per Tipp im Tablet-Profil (E2), Zustand über Neuladen (E5). Bei 1024×768 vollständig sichtbar und bedienbar. |
| **Layout** | **PASS** | E6 bei 1024×768, 1180×820, 1920×1080, je Versuch alle vier Schalterkombinationen: keine horizontale Überbreite, Hinweisbereich oberhalb der Laborfläche, Namensfelder unterhalb, Teilchenmodell und Bedienleiste ohne Überlappung mit der Laborfläche, keine überlappenden Namensfelder, alle Bedienelemente ≥ 44 px; lange Meldung (Spritzwarnung) bei 1024/1180 auf zwei Zeilen gekürzt (Volltext als Tooltip), bei 1920 vollständig. Screenshots `40-layout-*`, `41-lange-meldung-*`. |
| **Touch/Tastatur** | **PASS** (Emulation) · echtes iPad **HOLD – unverified** | E2: Versuche 1, 3, 4 vollständig per `tap()` im Tablet-Profil (`hasTouch`); E3: Geräte, Zielschaltflächen, „Gießen stoppen“ und Schalter nur mit Tastatur, sichtbarer Fokus. Kein Test auf einem echten iPad mit Safari. |
| **Lernkontrolle** | **PASS** | E1: zuerst 5 falsche Optionen und 2 falsche Lücken markiert, Hefteintrag gesperrt, Antworten erhalten; nach Korrektur nur der betroffenen Felder vollständig richtig, Hefteintrag frei. `tasks.test.js`: Einfach-/Mehrfachauswahl, Teilantworten, Begründung jeder falschen Option, Lücken tolerant (Kleinschreibung, Synonyme, ein Tippfehler), Sperrwörter mit Erklärung. |
| **Vier Perspektiven** | **PASS** | Kontrolle in vier Gruppen (Stoffebene, Teilchenebene, Aggregatzustände, Trennprinzip); Hefteintrag mit denselben Rubriken je Versuchskarte; Aggregatzustandswechsel nur bei Versuch 3 (geprüft); Merksätze „keine neuen Stoffe“, „gelöst ist kein Aggregatzustand“. |
| **Speicherung** | **PASS** | E5: Entwurf und Zwischenstand bleiben über „Auswertung prüfen“ mit Fehler, Reiter-, Versuchs- und Ansichtswechsel und Neuladen erhalten; Schalterzustände bleiben; Neustart von Versuch 2 lässt Versuch 1 unberührt; Neustart von Versuch 1 erzeugt Ansatz 2, Notizen bleiben. |
| **Pakete** | **PASS** (simuliertes LMS) · mebis **HOLD – unverified** | `scorm.mjs` 16/16: Manifest im ZIP-Stamm, SCORM 1.2, alle 14 Dateien gelistet, Verweise relativ, Paket byte-identisch mit dem Build; Mock-LMS eingebettet (Versuch 1) und als neues Fenster (vollständiger Pflichtablauf): `LMSInitialize`/`LMSFinish` je genau einmal, keine `LMSGetValue`/`LMSSetValue`/`LMSCommit`; Web-ZIP entpackt per `file://` mit vollständigem Pflichtablauf ohne Netzanfragen. Ein echter Import in mebis wurde **nicht** geprüft. |

Alle E2E-Szenarien prüfen zusätzlich: keine Konsolenfehler, keine Anfragen außerhalb des App-Servers.

## Ausstehende Prüfungen (nicht in dieser Umgebung möglich)

| Prüfung | Status |
| --- | --- |
| iPad mit Safari (Touch, Leistung der Animation, Fenstergröße) | **HOLD – unverified** |
| Import und Start in mebis („Neues Fenster“) | **HOLD – unverified** |
| Fachliche Durchsicht durch die Lehrkraft (Modellannahmen, Toleranzen, Texte, Hefteintrag) | **HOLD – unverified** |
| Unterrichtserprobung (Bearbeitungsdauer, Verständlichkeit) | **HOLD – unverified** |

## Bekannte Grenzen und Beobachtungen

- Bei 1024×768 mit eingeblendetem Bedienfeld **und** Teilchenmodell wird die Laborfläche in Versuch 5 (breitester Aufbau) recht klein; Ausblenden des Bedienfelds oder Verschieben der Trennlinie schafft Platz. Bedienbarkeit und Überlappungsfreiheit sind gegeben (E6).
- Beim Schütteln wird der Inhalt des Scheidetrichters mit dem Glas mitgedreht (Schwappen), nicht als waagrechter Spiegel.
- Der Hefteintrag ist deutlich länger als der Richtwert von 100 Wörtern aus `QUALITY.md`, weil der Auftrag fünf vollständige Versuchskarten mit sechs Rubriken, Trennkette und Teilchenbilder verlangt.
- Abweichungen vom Labkit-Standard laut Auftrag: Hinweisbereich oberhalb statt Meldungsband auf der Bühne, Hefteintrag erst nach dem Lernablauf, freie Beobachtungstexte.
- Zeiten sind beschleunigt; die Modellparameter sind in [CHEMIE.md](CHEMIE.md) von Literaturwerten getrennt dokumentiert.
- Der Quellstand startet wie die anderen Labkit-Apps über `npm start`; per Doppelklick startet das gebaute Web-ZIP.

## Screenshots

`docs/screenshots/`: `01-start` · `02`–`06` je Versuch nach Abschluss · `07-kontrolle-falsch`/`-richtig` · `08-hefteintrag`, `08b-hefteintrag-bilder` · `10-tablet-touch` · `11-tastatur-fokus` · `20`–`24` Korrekturfälle · `30-speicherung-neuer-ansatz` · `40-layout-*`, `41-lange-meldung-*` · `50`–`53` Teilchenmodell · `60-scorm-*`, `61-web-zip-file` · Bildfolgen in `anim/`.
