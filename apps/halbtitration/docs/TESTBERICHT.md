# Testbericht Halbtitrationslabor 0.3.0

## Nachtrag 0.3.0 (30.10.2026) – iPad- und Bedienregeln

| Prüffall | Status | Nachweis |
| --- | --- | --- |
| Titrierkolben höchstens 120 mL; Schrittzugabe begrenzt, Hahn schließt, Meldung „voll“ | **PASS** | `lab.test.js` (0.3.0) |
| Fokus nach Neuaufbau (Messpunkt) | **PASS** (simulierte Seite) | fokussiertes Element nach `refresh()` wieder fokussiert |
| Unit-Tests | **PASS** 35/35 | `npm test` |
| Browserabnahme, Paketprüfung, iPad | **HOLD – unverified** | `npm run test:all` auf dem Entwicklungsrechner |

---

Frühere Fassung des Berichts:

## Testbericht Halbtitrationslabor 0.2.2

Stand 29.10.2026. Statusregeln nach [`docs/QUALITY.md`](../../../docs/QUALITY.md): **PASS**, **HOLD – failed**, **HOLD – incomplete**, **HOLD – unverified**.

**Umgebung**

- Windows 11 Pro, Node.js 24.22.1
- Microsoft Edge (Chromium) über Playwright 1.56.1 (`channel: 'msedge'`), headless
- Tablet-Größen nur **emuliert**: Viewport und Touch-Ereignisse, kein echtes Gerät

**Prüfgegenstand**

- Browserabläufe gegen den Build `dist/halbtitration/` (inkl. `labkit/` 0.1.1)
- Paketprüfung gegen die frisch entpackten ZIPs aus `release/`

**Rohdaten**

- `tests/e2e/results.json`
- `tests/e2e/packages-results.json`
- Screenshots in `docs/screenshots/`

Grundlage: Review vom 29.10.2026 (Stand `9bd514b`, Befunde A–D) und Überarbeitungsauftrag (0.2.0); Rückmeldung der Lehrkraft zur Bedienung im Labor (0.2.1). Alle Prüfungen unten liefen mit dem Stand 0.2.2: Messpunkte entstehen nur noch automatisch bei stabiler Anzeige; es gibt keinen Knopf „Messwert übernehmen“ und keinen Erfassungsumschalter mehr (E1 prüft, dass beide fehlen). Szenarien zu zu früher manueller Ablesung entfallen; ohne Rühren entsteht erst nach stabiler Anzeige ein Punkt (E7).

**Neu in 0.2.1 geprüft (E1):**

- Vorbereitung in der Reihenfolge ① Bürette ② pH-Meter ③ Probe ④ Indikator ⑤ Rührer ⑥ Elektrode.
- Die Erfassung steht standardmäßig auf „automatisch“.
- Wählt man an der Bürette die falsche Maßlösung, bleibt sie leer, und das Bedienfeld gibt eine Rückmeldung.
- Nach einer Zugabe entsteht automatisch ein stabiler Messpunkt.
- Indikatorzugabe über den Knopf im Labor (E4, E8).

## Gesamtbild

| Bereich | Status | Nachweis / Einschränkung |
| --- | --- | --- |
| Fachmodell, Auswertung, Speichermigration | **PASS** | 33 Unit-Tests (`npm test`): 28 bisherige, 3 neue zu den Befunden B und C und zur Markerprüfung, 2 zur Migration |
| Befund A – veraltete Prüfzustände | **PASS** | E5 |
| Befund B – Abgabe ohne Messreihe, Musterlösung | **PASS** | E6, Unit-Test |
| Befund C – „am Zielvolumen“ ohne Ziel | **PASS** | E6, Unit-Test |
| Befund D – Speziesdarstellung | **PASS** | E3, E4 |
| Essigsäure (Kern), vollständig | **PASS** | E1 |
| Ammoniak (Transfer), vollständig | **PASS** | E2 |
| Phosphorsäure und Glycin (Vertiefungen), vollständig | **PASS** | E3, E4 |
| Durchführung und Speicherung | **PASS** | E7 |
| Animation als Übergang | **PASS** | E8, Echtzeit |
| Desktop 1440×900, Tablet 1180×820 und 1024×768 | **PASS (Emulation)** | E9; kein echtes iPad |
| Web- und SCORM-Paket | **PASS** | frisch entpackt, über HTTP und `file://` gestartet, SCORM mit Test-LMS, reproduzierbar |
| iPad mit Safari | **HOLD – unverified** | in dieser Umgebung nicht prüfbar |
| mebis-Import | **HOLD – unverified** | in dieser Umgebung nicht prüfbar |
| Fachliche und didaktische Freigabe durch die Lehrkraft | **HOLD – unverified** | neuer Lernweg, Fragen, Trainer und Toleranzen |

Der Status bleibt `prototype`.

## 1. Unit-Tests

Bisherige Prüfungen, weiterhin PASS:

- Bilanzen und Solver gegen eine unabhängige Sekanten-Referenz
- Kurvenstetigkeit
- Stufenstöchiometrie
- nicht erzwungene Halbäquivalenzwerte
- Glycin-Gegenion
- kein dritter Phosphorsäuresprung
- Messsimulation
- Rechenprüfungen
- Indikatoreignung
- Fehlerzerlegung

Neu:

| Test | Status | Nachweis |
| --- | --- | --- |
| Befund C | PASS | `checkMeasuredPH('4.76', [{v:12,…}], NaN)` → `present` („Zuordnung … offen“), nicht mehr „am Zielvolumen“. Mit Ziel werden Zieltreffer (`target.ok`, `dv`) und Messstatus (`quality`) getrennt ausgewiesen. |
| Befund B | PASS | `evidence`: Ohne Ziel, Reihe und passenden Messpunkt gibt es 3 blockierende Gründe. Ein pH-Wert ohne zugehörigen Punkt blockiert. Eine ungenaue echte Messung wird mit 5 Kennzeichnungen angenommen. |
| ÄP-Marker an der eigenen Kurve | PASS | steilster Abschnitt → ok; Pufferbereich → „kein deutlicher Sprung“; außerhalb der Messwerte → Datenlücke; grobe 2-mL-Messung → Hinweis; fallende Kurve (Ammoniak); Glycin ÄP 2 → „kein deutlicher Sprung“ |
| Migration 0.1.0 | PASS | Messreihen, Marker und Eingaben bleiben. Prüfstatus und Ablesefelder entfallen. Die alte Abgabe wird `legacySubmission` und schaltet nichts frei. Eine falsche alte Maßlösungswahl gilt nicht als gelöst. Kalibrierung und Bürette werden übernommen. |

## 2. Browserabläufe (`tests/e2e/run.mjs`)

Alle Handlungen laufen über Klicks, Tippen und Eingaben. Die Laborzeit läuft mit `?speed=25`; E8 läuft in Echtzeit.

| Szenario | Status | Inhalt |
| --- | --- | --- |
| E1 Essigsäure (Kern, inkl. 0.2.1-Bedienung) | PASS | Siehe unten. |
| E2 Ammoniak (Transfer) | PASS | Siehe unten. |
| E3 Phosphorsäure (Vertiefung) | PASS | Siehe unten. |
| E4 Glycin (Vertiefung) | PASS | Siehe unten. |
| E5 Prüfstatus (Befund A) | PASS | Siehe unten. |
| E6 Nachweis und Musterlösung (Befunde B, C) | PASS | Siehe unten. |
| E7 Durchführung und Speicherung | PASS | Siehe unten. |
| E8 Animation | PASS | Siehe unten. |
| E9 Größen und Bedienung | PASS (Emulation) | Siehe unten. |

**E1 Essigsäure (Kern)**

- Start im Labor mit Auftrag und leerer Kurve; kein Theorieblock, kein Eingangstest.
- Die falsche Maßlösung an der Bürette wird erkannt; die Bürette bleibt leer.
- Bei automatischer Erfassung wächst die Kurve ohne Klick.
- Falsche Antwort zum halben Umsatz → Tipp 1/3.
- Kein Kurvenpunkt vor der ersten Messung (Pixelzählung).
- Titrationskurve → ÄP-Marker an der eigenen Kurve geprüft → Fragen zum halben Umsatz → V(HÄP) → frische Probe, Zielmarke, Halbtitration → pH am Ziel → MWG-Trainer.
- pK falsch (14 − pH) → richtig.
- Vor der Abgabe keine Literatur und keine Modellschalter.
- Abgabe → Literatur → ΔpK → Fehlerdeutung → Ergebnisübersicht → Hefteintrag → Bericht mit Kurvenbild und Referenzen.
- Start-/ÄP-pH-Rechnungen waren nicht nötig.

**E2 Ammoniak (Transfer)**

- Fallende Kurve.
- pK_B = pH wird als Fehler mit pOH-Hinweis gemeldet; pK_B = 14 − pH und pKₛ(NH₄⁺) = pH sind richtig.
- Die Literaturlinie auf der pH-Achse heißt ausschließlich „pKₛ(NH₄⁺)“.
- Der Trainer ordnet pOH ≈ pK_B, pK_B ≈ 14,00 − pH und pH ≈ pKₛ(NH₄⁺) zu.

**E3 Phosphorsäure (Vertiefung)**

- Direkt anwählbar.
- Der Fehler V(ÄP,2)/2 wird erkannt.
- Die Speziesdarstellung vor der Abgabe ist „schematisch“, ohne „geringe Anteile“.
- Beide Stufen: Marker 10/20 mL, V(HÄP) 5/15 mL.
- Gemessener HÄP 1 liegt > 0,2 über pKₛ₁ und wird als „näherungsweise pK-Bestimmung“ erklärt.
- Gleichgewichtsanteile nach der Freigabe: 4 Werte, Summe 100 %.

**E4 Glycin (Vertiefung)**

- Bromthymolblau über den Indikatorknopf im Labor, mit Endpunkt.
- ÄP 1 ok; ÄP 2 → „kein deutlicher Sprung“.
- V(ÄP,2) abgeleitet und gekennzeichnet, V(HÄP,2) = 18 mL.
- pKₛ2 = 14 − pH wird als Fehler erkannt.
- Zwitterion und Cl⁻-Gegenion werden genannt; die Indikatoruntersuchung ist vorhanden.
- HÄP 1 liegt > 0,1 über pKₛ₁.

**E5 Prüfstatus (Befund A)**

- V(ÄP) 24 richtig → Änderung auf 30 → sofort „Geändert – erneut prüfen“, nicht grün; auch nach dem Neuladen.
- Marker per Zeiger verschoben → ÄP- und HÄP-Prüfung veraltet.
- Rechenbasis gewechselt → veraltet; zurück → wieder gültig.
- pH geändert → pK veraltet.
- Neue Halbtitrationsreihe → Nachweis veraltet; die Abgabe prüft neu und blockiert, weil der pH-Wert in der aktuellen Reihe fehlt.
- Abgabe mit gültigem Nachweis → spätere Korrektur ändert die Momentaufnahme nicht und wird als „aktuell korrigiert“ angezeigt.

**E6 Nachweis und Musterlösung (Befunde B, C)**

- Frischer Stand, nur pK eingetragen → Abgabe verweigert (Zielvolumen und Messreihe fehlen).
- „Musterlösung ansehen“: keine Abgabe, keine erfundenen Messwerte; in der Ergebnisübersicht „Musterlösung angesehen – kein eigener Versuch“.
- pH vor dem Zielvolumen → nur „vorhanden, Zuordnung offen“.
- Überschießen auf 12,50 mL → automatischer Messpunkt bei 12,50 mL, Rückmeldung „12,50 mL statt …“.
- Richtige Rechnung daraus wird erkannt; die Abgabe wird mit Kennzeichnung angenommen.

**E7 Durchführung und Speicherung**

- Ohne Rühren: instabil und inhomogen.
- Neue Probe verlangt keine erneute Bürettenfüllung oder Kalibrierung.
- Versuchswechsel: Kalibrierung bleibt, HCl-Bürette getrennt, Reihen bleiben.
- Neuladen stellt alles wieder her.
- Gesamtes Labor zurücksetzen funktioniert.
- Alter 0.1.0-Stand: übernommen, nicht freigeschaltet, Prüfungen offen.
- Speicher wirft Ausnahmen: Hinweis erscheint, App bleibt bedienbar.

**E8 Animation**

- 16 Einzelbilder nach einer 0,2-mL-Zugabe kurz vor dem ÄP: fallende Tropfen, Mischschlieren (lokal pink bei farbloser Lösung) und Oberflächenimpulse; das Volumen steigt schrittweise.
- Ohne Rührer nach 6 s keine Wellen (< 0,05).
- Taste D erzeugt eine Zugabe, der Messpunkt folgt automatisch.

**E9 Größen und Bedienung**

- Geprüft bei 1440×900 (Maus), 1180×820 und 1024×768 (Touch).
- Keine horizontale Überbreite.
- Knöpfe in Dosierleiste, Kopfzeile, Versuchsleiste, Reitern und Kurvenwerkzeugen sind ≥ 44 px hoch.
- Labor, Kurve, Rührer, Zugeben und Hahn sind gleichzeitig im Bild.
- Antippen des Hahns im Bild öffnet und schließt.
- Bedienfeld einklappen verbreitert die Bühne.
- Trennlinie per Pfeiltasten und Ziehen.

In allen Szenarien wurden Konsolen- und Seitenfehler sowie fremde Netzwerkanfragen protokolliert; es gab keine.

## 3. Pakete (`tests/e2e/packages.mjs`)

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Struktur | PASS | Web-ZIP: alles unter `halbtitration/`, inkl. `labkit/`. SCORM: `imsmanifest.xml` und `index.html` im Stamm, Schema 1.2, Startpfad `index.html`, alle Dateien gelistet und vorhanden |
| Web-ZIP über HTTP | PASS | frisch entpackt (eigener ZIP-Leser); Glycin: Maßlösung, Vorbereitung, Messung, Ergebnisse; keine 4xx-Antworten, keine externen Anfragen, keine Konsolenfehler |
| SCORM mit Test-LMS | PASS | `LMSInitialize` aufgerufen, kein `LMSSetValue` |
| Web-ZIP per `file://` | PASS | Start ohne Server, Labkit geladen |
| Reproduzierbarkeit | PASS | zweimaliges `npm run package` ergibt identische SHA-256-Summen |

## 4. Sichtprüfung

Geprüft wurden:

- Start: `01-start`, `9-start-*`
- Messbetrieb: `9-messbetrieb-*`, `1-essigsaeure-1-kurve`, `*-2-halbtitration`
- Tropfen und Schlieren: `8-tropfen-schliere`
- Trainer: `*-3-trainer`
- Ergebnisvergleich: `1-essigsaeure-4-vergleich`, `1-essigsaeure-5-ergebnisse`, `6-musterloesung-ergebnisse`
- Vertiefung: `3-phosphorsaeure-4-vertiefung`
- ohne Rühren: `7-ohne-ruehren`
- eingeklapptes Bedienfeld: `9-ohne-bedienfeld-*`

Bei der Durchsicht gefunden und behoben:

- Die Dosierleiste war zu hoch und drückte die Apparatur klein; sie ist jetzt in einem Fluss angeordnet.
- Die Ergebnistabelle war zu breit fürs Bedienfeld; sie besteht jetzt aus Karten.
- Die Probennummer zählte nicht weiter.
- Die Beschriftung der Zielmarke verdeckte den ÄP-Marker.
- Ein Schritt klappte nach der Antwort zu, und Aufklappbereiche gingen beim Neuaufbau verloren.
- Ein gewählter Indikator wirkte nicht auf die unbenutzte Probe.
- Einige Knöpfe waren unter 44 px.

## 5. Offene Punkte

- **HOLD – unverified:** iPad mit Safari (Touch, Trennlinie, Lesbarkeit bei 1024×768) und der SCORM-Import in mebis.
- **HOLD – unverified:** didaktische Prüfung des neuen Lernwegs (Fragen, Trainer, Hilfen) und der Toleranzen durch die Lehrkraft; fachlich weiterhin der Datensatz Martell & Smith.
- Bei 1024×768 mit offenem Bedienfeld sind Apparatur und Kurve deutlich kleiner als am Desktop; einklappen hilft.
- Nicht umgesetzt, weil freiwillig: Ableseübung an der Bürette, Umrechnung pK → K, Fehlermodus.
- Die Übersichtszeile im Repo-README (Version 0.2.0, Download-Links) ist noch nicht aktualisiert. Sie wird nach dem Merge separat nachgetragen.
