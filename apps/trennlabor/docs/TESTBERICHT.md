# Technische Abnahme · Trennlabor 1.0.0

Datum: 22.10.2026 (Europe/Berlin). Repository: [sscheidl/SiVex](https://github.com/sscheidl/SiVex), Branch `feat/trennlabor`. Schulpraktische Freigabe und Merge verbleiben bei der Lehrkraft. `sivex.json` bleibt bewusst `prototype`.

## Stand der Prüfung

**Technischer Funktions- und Pakettest: PASS.** 39/39 Unit-/Regressionstests und 80/80 Browser-/Paketprüfungen bestanden: 38 am Quellcode, 19 aus dem entpackten Web-ZIP, 20 aus dem entpackten SCORM-ZIP im simulierten LMS, 3 zusätzliche Prüfungen (neues Fenster, file://, offline). Commit/Push/PR werden als letzter Lieferschritt nachgetragen.

Enthalten: K-01 Sand/Wasser, K-02 Sand/Kochsalz, K-03 Eisen/Sand/Kochsalz, K-04 Öl/Wasser, K-05 Hibiskustee, Papierchromatographie mit sieben Proben/zwei Laufmitteln sowie ausschließlich Ethanol/Wasser-Destillation. Fehler, Hilfen, Auswertung und Hefteintrag sind in allen Bereichen implementiert. Die Modelle sind in [CHEMIE.md](CHEMIE.md) einschließlich aller didaktischen Parameter und Grenzen dokumentiert.

## Umgebung und ausgeführte Befehle

Windows, Node.js 24.19.0, Python 3.12.10, Playwright 1.56.1, Chromium 141.0.7390.37. Desktop 1440×900; Tablet 1024×768 mit Touch; zusätzlicher Screenshot/Überlauftest 1180×820 mit Touch. Browseruhr beschleunigt die reguläre `requestAnimationFrame`-Schleife; Fachzustände werden im E2E-Test nicht direkt verändert oder über interne APIs gesetzt. Modelle werden separat in Node geprüft.

Im Verzeichnis `apps/trennlabor/`:

| Befehl | Tatsächlich beobachtetes Ergebnis |
| --- | --- |
| `node --test tests/unit/*.test.js` | 39 Tests, 39 bestanden, 0 fehlgeschlagen |
| `node tests/e2e/run.mjs` | 19 Szenarien × 2 Viewports = 38 bestanden, keine Konsolenfehler/externen Anfragen; zusätzlicher 1180×820-Layoutcheck erfolgreich |
| `node scripts/package.mjs` (zweimal) | Statischer Build: 8 Dateien; zwei Release-ZIPs; zweiter Build identische SHA-256-Summen |
| `python tests/check_packages.py` | Beide ZIPs: CRC und SHA-256 korrekt; relative Ressourcen vorhanden; SCORM-1.2-Manifest mit Einstieg, SCO-Typ und vollständiger Dateiliste geprüft; sichere Extraktion |
| `node tests/e2e/packages.mjs` | 42 Prüfungen bestanden: 19 Web-ZIP, 20 SCORM-iframe, 3 Zusatzprüfungen; keine Laufzeit-/Konsolenfehler oder externen Anfragen |
| `node --test ../redoxlabor/tests/unit/*.test.js` | Zusätzlich vorhandenes Redoxlabor: 74/74 bestanden; keine dortigen Dateien verändert |

Reproduzierbare Start-/Installationsbefehle stehen in der [README](../README.md). Rohberichte: [Quellcode-Browserlauf](../tests/e2e/results.json), [ZIP-Integrität](../tests/e2e/package-integrity.json), [Browser-Paketlauf](../tests/e2e/package-results.json). Die vom Auftrag vorgegebenen 22 Bedienfolgen sind in 19 Szenarien zusammengefasst: E01 umfasst Auswertung/Erfolgssperre/Hefteintrag, E02 wiederholten Fehler/Hilfe, E15 Thermometer und Heizleistung 0; alle Szenarien werden auf Desktop, Tablet und erneut in den Lieferpaketen ausgeführt.

## Kriterienmatrix

`U` = [Modelltests](../tests/unit/models.test.js), `R` = [Regressionen](../tests/unit/regression.test.js), `E` = [Browser-Szenarien](../tests/e2e/scenarios.mjs). E-Nummern entsprechen den Bezeichnern im JSON-Bericht. `P` = [Paket-/LMS-Test](../tests/e2e/packages.mjs) und [ZIP/XML-Prüfung](../tests/check_packages.py). Alle Funktions- und Paketkriterien wurden nachgewiesen; die PR-Lieferung wird zuletzt eingetragen. Die Pakete enthalten bytegenau die aktuellen Laufzeitdateien des Branches (zusätzliche Integritätsprüfung).

| Kennung | Status | Nachweis / Befund |
| --- | --- | --- |
| A-01 | PASS | E A-01, Aufgabenleiste; alle drei Bereiche und sieben Aufgaben bedienbar |
| A-02 | PASS | U alternative K-01-Verfahren und Magnet nach Lösen; E04 Korrektur ohne Neustart, freie Quelle/Ziel und Aufbauwahl |
| A-03 | PASS | U Bilanzen, expliziter Verlust/Dampf, Phasenwechsel; E01–E07 Mengenanzeige und tatsächliche Fraktionen |
| A-04 | PASS | U feste Zeitschritte/Pause/Zeitfaktor; E Pause und Sitzungszustand |
| A-05 | PASS | Alle E-Szenarien per HTML-Kontrollen; kompletter zweiter Durchlauf mit Touch ohne Drag-and-drop |
| K-01 | PASS | U beide Methoden und Trübung; E04 vorsichtig/schnell und erneute Filtration; Screenshot `desktop-05-dekantieren-trueb.png` |
| K-02 | PASS | U und E01 Sand im Filter, festes Salz erst nach Eindampfen; `desktop-02-salzkristalle.png` |
| K-03 | PASS | U und E05 drei Fraktionen; nur Eisen am Magnet; `desktop-06-drei-fraktionen.png` |
| K-04 | PASS | U und E06 Phasen, Portionswahl, Mischfraktion und Verlust; `desktop-07-phasentrennung.png` |
| K-05 | PASS | U und E07 kalt/warm; Farbstoff im Filtrat, Blüten getrennt, Tee bleibt Gemisch; `desktop-08-hibiskustee.png` |
| K-06 | PASS | U trocken, fehlendes/undichtes Papier, Verlust, Sandwasser abdampfen, Hahnfehler, unruhige Phase; E02–E07 sichtbare Folgen |
| C-01 | PASS | U Datensatz; E08 sieben Proben/zwei Laufmittel und drei Proben gleichzeitig |
| C-02 | PASS | U Front-/Stoffstrecken; E08 Banden bewegen sich zwischen zwei Zwischenständen; `desktop-09-chroma-zwischen.png`, `desktop-10-chroma-ergebnis.png` |
| C-03 | PASS | U Referenzen und Laufmittelwechsel; E09 wasserfest in Wasser am Start, E12 eine Referenzbande |
| C-04 | PASS | U und E10/E11 untergetauchte Punkte, Kugelschreiber, breite überladene Flecken; `desktop-12-punkte-ausgewaschen.png`, `desktop-13-kugelschreiber.png` |
| C-05 | PASS | U Rf ungültig ohne Front/bei Rand; E08 Theorie Adsorption, E12 optionaler Expertenwert 0,42; `desktop-14-rf.png` |
| D-01 | PASS | E13 alle Bauteile einzeln aufgestellt; ausschließlich Ethanol/Wasser verfügbar |
| D-02 | PASS | U stetige Gemischkurve; E13 Messung im Dampfweg und Zeitverlauf; `desktop-15-destillation-erwaermen.png` |
| D-03 | PASS | U Heiz-/Massen-/Zusammensetzungs-/Kühlkopplung; E13 kein Produkt vor Erwärmung, E16 ohne Heizung kein Produkt |
| D-04 | PASS | U alle Kühlfehler; E14 kein Kondensat bei Kühlwasser aus, expliziter Dampfverlust; `desktop-17-kuehlung-fehlt.png` |
| D-05 | PASS | U kleine/wasserreiche Probe, Bilanz; E13 1 g entnommen und bläuliche Flamme, Reinheit ausdrücklich nicht bewiesen; `desktop-16-destillation-flamme.png` |
| D-06 | PASS | U ungesichert/geschlossen/Überheizen/heiße Siedesteine, R heißes Verschließen; E17 Stopps und Wiederaufnahme |
| L-01 | PASS | U Zustandshinweise; E02 genau drei Zustände, Angebot nach Wiederholung, konkrete Hilfe nur angefordert |
| L-02 | PASS | E01 falsche Beobachtung getrennt rückgemeldet; R Zonenzahl an echte Probe gebunden; E08 Zonen und E13 Dampfmessung selbst eingegeben |
| L-03 | PASS | U Normalisierung/Synonyme; E01 LÖSLICH/Filtrat bleiben bei falscher dritter Lücke erhalten |
| L-04 | PASS | E01 vor Erfolg gesperrt, danach Theorie schrittweise + vollständiger Hefteintrag; E07/E08/E13 ebenfalls ausgewertet |
| L-05 | PASS | E04 trüben Ansatz korrigiert, E17 Aufbau repariert; Reset nur aktueller Versuch; alter Erfolg bleibt eingefroren |
| V-01 | PASS | SVG-Glasgeräte, Graduierung, Stativ, Kühler; Screenshots tatsächlich angesehen; keine gerenderten Videos |
| V-02 | PASS | E08 Zwischen-/Endstand, U/Renderer gekoppelte Sedimente/Füllhöhen, E13 Dampf und Tropfen; Sichtprüfung der Screenshots |
| V-03 | PASS | Alle 19 Szenarien in 1440×900 und 1024×768 Touch, zusätzlicher 1180×820-Check; keine horizontalen Überläufe |
| V-04 | PASS | Native beschriftete Controls, Fokusrahmen, Enter auf Pause; Stoff-/Bandnamen zusätzlich zur Farbe; `tablet-19-layout.png` |
| T-01 | PASS | Statischer Build, lokale Ressourcenprüfung; alle Quellcode-Browseranfragen lokal |
| T-02 | PASS | P ZIP/XML, SCORM 1.2, SCO, Einstieg index.html, alle Ressourcen relativ und vollständig; Prüfsummen korrekt |
| T-03 | PASS | 20 P-Szenarien im iframe, zusätzlich neues Fenster; LMSInitialize/LMSFinish genau einmal, keine anderen LMS-Datenaufrufe |
| T-04 | PASS | 39/39 U/R grün |
| T-05 | PASS | 38/38 E grün; alle drei Labore und zentrale Fehlversuche über die echte UI |
| T-06 | PASS | Start, Zwischenstände, Ergebnisse, Fehlerfälle und Tablet-Screenshots; Sichtprüfung unten dokumentiert |
| T-07 | PASS | README, Fachmodell, Bedienung, Testbericht, sivex.json, Screenshots, grüne Rohberichte und beide reproduzierbaren Release-ZIPs mit SHA-256 |
| T-08 | HOLD – unverified | Wird nach abgeschlossenem Testlauf mit Commit/Push/PR vervollständigt; kein Merge nach main |

## Sichtprüfung und behobene Defekte

Angesehen: Startansicht, klassischer Ausgangszustand, Sand-/Salzergebnis, drei Fraktionen, Öl-/Wasserfraktionen, Chromatographie-Zwischen-/Endzustand, Destillation mit Flamme, Tablet-Destillation. Die Screenshots liegen in [screenshots/](screenshots/). Geräte sind wiedererkennbar, Füllstände und Banden sichtbar; Thermometer ist zusätzlich digital groß lesbar. Auf Tablet sind alle Bedienelemente durch vertikales Scrollen erreichbar; keine horizontal abgeschnittenen Pflichtfunktionen. Einklappbare Gerätegruppen erhalten die Sicht auf die Bühne.

1. **SVG-ID kollidierte mit Wasserbutton:** Im ersten Browserlauf gefunden, verhinderte Wasserzugabe über den Button. Alle SVG-IDs jetzt pro Ausgabe eindeutig. Regression R und wiederholte E01–E07.
2. **Negative SVG-Rechteckhöhe bei Spuren von Flüssigkeit:** Browserkonsole deckte den Fehler bei Transfers auf. Höhe auf mindestens 0 begrenzt. Regression R und vollständiger erneuter E-Lauf ohne Konsolenfehler.
3. **Heiße Apparatur nach Ausschalten verschließbar:** Sicherheitsprüfung auf heiße geschlossene Systeme ausgedehnt, eigener Regressionstest.
4. **Beobachtungsauswertung konkretisiert:** Chromatographie prüft wirkliche Zonenzahl der ersten Probe, Destillation den tatsächlich abgelesenen Dampfwert. Keine automatische Anerkennung allein durch richtige Fachbegriffe.

Der erste Versuch mit installiertem Edge konnte in dieser Umgebung keine Screenshots erzeugen. Daraufhin wurde das zur fixierten Playwright-Version gehörende Chromium installiert und für alle dokumentierten Browserprüfungen verwendet. Kein verbleibender technischer Blocker daraus. Eine erste Testannahme „kein Sieden nach 12 Modellssekunden“ wurde auf 8 s korrigiert: Der 100-g-Ansatz erreicht die Modell-Siedetemperatur schon nach ungefähr 12 s. Das Modell war dabei konsistent; der zu spät gewählte Vorheiz-Messzeitpunkt war falsch.

Zusätzlich wurde die Testseite für das neue LMS-Fenster korrigiert: Ein einfacher `target="_blank"`-Link erzeugt im Browser standardmäßig keinen Opener. Der Mock deklariert nun ausdrücklich `rel="opener"`, um die von einem LMS bereitgestellte API-Erreichbarkeit über das aufrufende Fenster zu prüfen. Danach bestanden beide LMS-Startwege. Dies war ein Fehler der Testumgebung; der Adapter blieb unverändert.

## Bekannte Modellgrenzen und Start

Keine quantitative Vorhersage realer Kinetik, Löslichkeit, Stiftmarken, Gemisch-Siedekurven oder Brennbarkeitsgrenzen. Näherungen vollständig in CHEMIE.md. Kein Notenexport, keine permanente LMS-Persistenz und kein Backend. Ein virtuell verbrauchter Ansatz kann gezielt erneuert werden, übrige Aufgaben/erfolgreiche Einträge bleiben erhalten.

Lokal: `node scripts/serve.mjs . 8080`, dann `http://localhost:8080/`; alternativ `index.html` direkt öffnen. Web-ZIP entpacken und den Unterordner `trennlabor/` auf einen statischen Server kopieren. In mebis `release/trennlabor-1.0.0-scorm12.zip` unverändert als Lernpaket (SCORM 1.2) hochladen, bevorzugt in neuem Fenster anzeigen. Das Paket initialisiert/beendet nur die LMS-Sitzung; keine Noten-/Fortschritts- oder Schülerdatenaufrufe.

## Nachgelagerte Praxistests durch Lehrkraft – nicht blockierend

- Vollständige Bedienung auf echten Schul-Tablets, insbesondere Safari/iPadOS und Fensterverhalten.
- Import und Betrieb im realen mebis-Kurs, einschließlich Popup-/Fenstereinstellungen.
- Unterrichtsbeobachtung: Verständlichkeit für NTG 8 / SG 9, Hilfen und selbstständiger Hefteintrag.

Diese Prüfungen sind entsprechend dem Masterauftrag keine HOLD-Gründe für die technische Entwicklungsabnahme. Der spätere Statuswechsel `prototype` → `ready` und der Merge sind Entscheidungen des Auftraggebers.
