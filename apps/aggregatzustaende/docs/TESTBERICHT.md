# Aggregatzustände 0.2.1 – Testbericht

Stand 29.10.2026 · Labkit 0.1.1 (unverändert) · Status **prototype**

0.2.1: Schema teilt sich den Bildbereich mit dem Versuch (größer), Gefäß füllt seinen Bildausschnitt, größere Schrift in der ganzen App. Alle Prüfungen wurden für 0.2.1 vollständig wiederholt.

0.2.0 setzte die Rückmeldung der Lehrkraft zu 0.1.0 um: geschlossenes System (Becherglas mit Uhrglas, Ofen im Schnitt mit glühenden Heizstäben), Eisenquader, Salzkruste, Legende der Teilchenebene, gestauchte Reglerskala bei Eisen und Kochsalz, zuschaltbares Schema der Phasenübergänge. Diese Prüfungen galten für 0.2.0.

Statusregeln nach [`docs/QUALITY.md`](../../../docs/QUALITY.md): **PASS** = geprüft, Nachweis dokumentiert · **HOLD – unverified** = Prüfung nicht möglich bzw. nicht durchgeführt.

## Zusammenfassung

| Bereich | Ergebnis | Nachweis |
| --- | --- | --- |
| Unit-Tests Modell, Reglerskala, Teilchen-Engine, Aufgaben | PASS 36/36 | `npm test`, Abschnitt 1 |
| Browserprüfung Edge (Desktop, Tablet- und Handy-Emulation) | PASS 16/16 | `tests/e2e/results.json`, Abschnitt 2 |
| Pakete: SCORM 1.2 (Mock-LMS eingebettet/neues Fenster), Web-ZIP über HTTP und file://, frisch entpackt | PASS 17/17 | `tests/e2e/scorm-results.json`, Abschnitt 3 |
| Visuelle Kontrolle der Bilder je Stoff und Zustand | PASS (Entwickler) | `docs/screenshots/`, Abschnitt 4 |
| Echtes iPad (Safari), Touch | **PASS** (Lehrkraft, 30.10.2026) | auf dem iPad mit Safari geprüft: sichtbar und bedienbar, Abläufe wie erwartet |
| mebis-Import (ByCS) | **HOLD – unverified** | nicht durchgeführt; nur Mock-LMS |
| Fachliche und didaktische Freigabe durch die Lehrkraft | **HOLD – unverified** | ausstehend |

Ohne mebis- und fachliche Lehrkraftprüfung bleibt der Status `prototype`.

## 1. Unit-Tests (`npm test`, 36 Tests)

**Zustandsmodell und Reglerskala** (`tests/unit/model.test.js`, 15 Tests)

- Gemeinsamer Datensatz der vier Stoffe mit Schmelz-/Siedetemperatur, Bereich und Symbolen.
- Für **jeden** Stoff: 1 °C unter, genau an und 1 °C über der Schmelztemperatur; Mitte des flüssigen Bereichs; 1 °C unter, genau an und 1 °C über der Siedetemperatur; Bereichsende und zurück zum Bereichsanfang. Genau an den Übergangstemperaturen liegen beide Zustände zu gleichen Teilen vor.
- Darstellung folgt dem Regler: nach 0,25 s etwa auf halbem Weg, nach 1 s fast, nach 1,2 s exakt.
- Schmelzen mit sichtbarer Mischung; Verdampfen, Kondensieren, Erstarren; Sprung fest → gasförmig läuft über die Flüssigkeit.
- 400 zufällige Reglerwerte in schneller Folge je Stoff: Anteile jederzeit gültig (Summe 1, keine NaN); danach erreicht jeder Zielwert seinen Endzustand.
- Stoffwechsel mitten im Sieden: Startzustand ohne laufenden Vorgang, Laufnummer erhöht, Reglerbereich des neuen Stoffes.
- Iod: kein Dampf bei 25 °C, langsam entstehender Dampf bei 95 °C (fest mit Dampf), flüssig bei 150 °C; keine Sublimation bei den anderen Stoffen.
- Kalte Oberfläche nur bei Iod; Kristalle wachsen bei 95 °C, kaum bei 25 °C, bleiben beim Abkühlen, verschwinden nach dem Ausblenden; Stoffmenge bleibt erhalten.
- Wiederherstellen nach Neuladen; ungültige Daten werden ignoriert.
- Reglerskala: Bereichsgrenzen, Schmelz- und Siedetemperatur über die Reglerposition exakt erreichbar (Hin- und Rückweg), monoton; bei Eisen und Kochsalz Übergänge bei 25 % bzw. 75 % des Reglers, bei Wasser linear.

**Teilchen-Engine** (`tests/unit/particles.test.js`, 12 Tests)

- Eine Engine, 48 Teilchen für jeden Stoff; Kochsalz 24 + 24 im Schachbrettmuster.
- **Visuelles Abnahmekriterium als Kennzahlen**, für jeden Stoff gemittelt über mehrere Zeitpunkte: fest = auf Gitterplätzen (Abweichung < 0,5 Teilchenradien) und dicht; flüssig = dicht (mittlerer Nachbarabstand < 1,3), unten im Raum, in Bewegung (2,5–20 Einheiten/s); gasförmig = große Abstände (> 1,3), ganzer Raum (> 70 % der Höhe), mindestens doppelt so schnell wie die Flüssigkeit.
- Teilchenzahl und Teilchengröße bleiben bei allen Übergängen in beide Richtungen und raschen Wechseln erhalten; alle Teilchen bleiben im Darstellungsraum; Zahl je Zustand passt zum Modell.
- Schmelzen löst zuerst obere/äußere Plätze, Erstarren ordnet wieder; Flüssigkeit tauscht Nachbarn (Wasser, Eisen > 50 % in 6 s); Schwingung im Feststoff nimmt mit der Temperatur zu.
- Kochsalz im Gas paarweise (je ein Teilchen beider Sorten), in der Schmelze ohne Paare.
- Iod: Teilchen verlassen den Feststoff (Sublimation), lagern sich an der kalten Fläche oben an und werden nach dem Ausblenden wieder frei.
- Gleicher Startwert ergibt gleiche Bewegung (reproduzierbar).

**Aufgaben** (`tests/unit/tasks.test.js`, 9 Tests): Musterlösungen vollständig richtig; leere Antworten; einzelne falsche Lücken mit konkretem Beobachtungshinweis; keine Lösungen in Lückentext-Klammern; Fehlvorstellungen (Teilchen bewegen sich im Feststoff nicht, werden größer, verschwinden, Anziehung verschwindet ganz, Teilchen schmelzen) mit passender Rückmeldung; Gegenrichtung und Nicht-Übergänge (Lösen, Verbrennen) erkannt; Iod-Aufgabe; Hefteintrag 80–130 Wörter mit allen Zuständen, sechs Übergängen und Kenneigenschaften.

## 2. Browserprüfung (`npm run test:e2e`)

Edge 156.0.4314.50 über Playwright 1.56.1, gegen den gebauten Stand `dist/aggregatzustaende`. Die Tests bedienen nur die Oberfläche (Klicks, Tipps, Tastatur, Ziehen); der Modellzustand wird ausschließlich gelesen. Ergebnis des letzten Laufs: **16/16 PASS** (15 Szenarien und die Netzprüfung).

| ID | Prüfung | Ergebnis |
| --- | --- | --- |
| E01 | Start: Wasser, Stoffebene, 20 °C, flüssig; Markierungen „Schmelztemperatur 0 °C“ und „Siedetemperatur 100 °C“; Kennzeichnung der Gasphase; keine kalte Oberfläche; kein Text oder Bedienelement über dem Bild | PASS |
| E02 | Regler: Mausklick setzt Wert und Anzeige sofort, Bild folgt in 791 ms; Pfeile ±1, Bild ↓ −10, Ende/Pos1; `aria-valuetext` mit Einheit; Antippen der Schiene (Touch-Emulation 1180×820), Regler 44 px hoch | PASS |
| E03 | Alle vier Stoffe per Tastatur auf 1 °C unter/genau an/1 °C über Schmelz- und Siedetemperatur: erwarteter Zustand, 48 Teilchen, Bildbeschreibung mit Temperatur; 24 Bilder (je Stoff fest/flüssig/gasförmig auf beiden Ebenen) | PASS |
| E04 | Zwischenbilder: Wasser schmilzt (Mischung), verdampft (Siedeblasen), kondensiert (Tropfen an Deckel und Glaswand), erstarrt; Teilchenebene beim Schmelzen | PASS |
| E05 | Ebenenwechsel mitten im Verdampfen: gleiche Temperatur und Laufnummer, Übergang läuft weiter (p 1,21 → 1,39), Bild vollständig für die gewählte Ebene, Hinweisleiste passend | PASS |
| E06 | Regler 60-mal schnell hin und her gezogen (Stoff- und Teilchenebene): 48 Teilchen, > 20 Bilder/s, danach stabil flüssig; genau an der Siedetemperatur beide Zustände | PASS |
| E07 | Stoffwechsel mitten im Sieden: Eisen fest bei 1400 °C, keine Wölkchen/Blasen vom Wasser, Regler am Bereichsanfang, Markierungen 1538/2862 °C bei 25 % und 75 % des Reglers (gestauchte Skala); Kochsalz, Iod, Wasser jeweils ohne laufenden Vorgang | PASS |
| E08 | Iod: Schaltfläche nur bei Iod; bei 95 °C fest mit Dampf (17 Wölkchen, Gasteilchen), kein Dampf über dem Uhrglas (geschlossenes Gefäß); kalte Oberfläche: Kristalle wachsen, 8 Teilchen an der Fläche; flüssig bei 150 °C; Ausblenden baut die Kristalle ab | PASS |
| E09 | Trennlinie: Maus (400 → 567 px), Mindestbreite 300 px, Tastatur ±24 px, Höchstbreite ≤ 620 px bei Bühne ≥ 460 px, Doppelklick und Pos1 setzen zurück; Touch über Zeigerereignisse (330 → 450 px), Trefferfläche ≥ 44 px | PASS |
| E10 | 1920×1080, 1440×900, 1280×800, 1180×820, 1024×768, 820×1180, 768×1024, 390×844 (unter 1200 px mit Touch): Wasser und Iod auf beiden Ebenen ohne Überdeckung, kein waagrechtes Scrollen, Bild ≥ 240 px hoch, Regler breit genug, Markierungen weder überlappend noch abgeschnitten, alle Knöpfe ≥ 44 × 44 px, ab 900 px Regler ohne Scrollen sichtbar; zusätzlich mit eingeblendetem Schema auf beiden Ebenen ohne Überdeckung | PASS |
| E11 | Animation bei gleichbleibender Temperatur: Wasseroberfläche bewegt sich; bei −20, 50 und 120 °C bewegen sich > 40 von 48 Teilchen und das Bild ändert sich; Gaswölkchen bewegen sich | PASS |
| E12 | Aufgaben über die Oberfläche: 8 richtig/1 falsch markiert mit konkretem Hinweis; Tipp erst nach zwei Fehlversuchen angeboten (nicht eingeblendet), drei Stufen, keine vierte; Lösung mit Rückfrage; eigene Antworten bleiben erhalten; Schritt 2 „4 von 5“ mit Hinweis auf die Symbolgröße; Antworten nach Neuladen erhalten; Schritt 3 vollständig | PASS |
| E13 | Hefteintrag über die Kopfzeile ohne gelöste Aufgaben, alle Fachbegriffe; Druck erzeugt Arbeitsblatt, Druckansicht zeigt nur das Blatt (905 px ≈ eine A4-Seite); Ergebnisse vermerken beobachtete Zustände und die Sublimation | PASS |
| E14 | Tab-Reihenfolge erreicht Stoffwahl, Ebenen, Regler, Trennlinie; Enter wählt den Stoff; Fokusrahmen sichtbar; Zustand als Text für Bildschirmleser; Auswahl über `aria-pressed` | PASS |
| E15 | Schema im Bildbereich: anfangs aus, zuschaltbar (Versuch 1006 → 604 px breit, keine Überdeckung); Schmelzen und Erstarren hervorgehoben, danach kein laufender Übergang, Kasten „flüssig“ gefärbt und umrandet; an der Siedetemperatur beide Richtungen; Iod: Sublimieren, mit kalter Oberfläche Resublimieren; bleibt nach Neuladen eingeblendet; 1024×768 und 820×1180 ohne Überdeckung und ohne waagrechtes Scrollen | PASS |
| NET | 364 Anfragen, alle lokal | PASS |

Hinweis: E10 nutzt **Emulation** im Desktop-Edge; das ersetzt keinen Test auf dem iPad.

## 3. Pakete (`npm run package`, `npm run test:scorm`)

`release/aggregatzustaende-0.2.1-scorm12.zip` (59,4 KiB, 15 Dateien + `imsmanifest.xml`) und `release/aggregatzustaende-0.2.1-web.zip` (59,3 KiB), Prüfsummen in `release/SHA256SUMS.txt`. Ergebnis: **17/17 PASS** – Manifest SCORM 1.2 mit allen Dateien, nur relative Verweise; im Mock-LMS eingebettet und als neues Fenster: genau ein `LMSInitialize`, beim Schließen genau ein `LMSFinish`, keine `LMSGetValue`/`LMSSetValue`/`LMSCommit`; Iod gewählt, per Tastatur auf 95 °C, Teilchenebene, Antwort geprüft; Web-ZIP frisch entpackt per HTTP und `file://` bedienbar; keine Konsolenfehler, keine externen Anfragen.

## 4. Visuelle Kontrolle

Die Bilder in `docs/screenshots/` (aus E03–E13 und dem Paketlauf) wurden durchgesehen: Eis milchig und schwimmend beim Schmelzen; Wasser mit Meniskus und Wellen; Siedeblasen; weißer bzw. violetter Dunst füllt das Gefäß; Iodkristalle dunkel-metallisch, Kristalle am Uhrglas; Ofen mit Heizstäben, die mit der Temperatur heller glühen; Eisenquader silbergrau, Schmelze glühend; Kochsalz weiße Würfel auf Salzkruste, Schmelze klar; Dampf bleibt im Becherglas unter dem Uhrglas bzw. in der Ofenkammer; Schema hebt den laufenden Übergang hervor; Teilchenebene je Zustand eindeutig. Die Bewertung „überzeugend“ ist eine Einschätzung des Entwicklers und gehört zur ausstehenden Lehrkraftprüfung.

## 5. Abweichungen und begründete Entscheidungen

- **Canvas 2D statt WebGL** für die Teilchenebene (≈ 50 flache Symbole; robuster und wartbarer, im Repository gibt es keinen WebGL-Baustein) – siehe `docs/CHEMIE.md`, Abschnitt 7.
- **Tiegel im Ofen statt Glasgefäß** für Eisen und Kochsalz (Glas würde erweichen); der Ofen ist im Schnitt gezeichnet und geschlossen.
- **Gestauchte Reglerskala** bei Eisen und Kochsalz (nicht maßstäblich, dafür besser bedienbar); Markierungen und Anzeige bleiben korrekt.
- **Kochsalz im Dampf als Ionenpaare**, nicht als freie Ionen (fachliche Begründung in `docs/CHEMIE.md`).
- **Schema mit Fachbegriffen immer sichtbar** (Entscheidung der Lehrkraft); Schritt 3 dient damit der Wiederholung.
- **Glühendes Eisen** fest bewusst silbergrau mit Glühschein, damit fest und flüssig unterscheidbar bleiben.
- **Lernweg ohne Sperre:** Die drei Schritte sind frei wählbar (der Bauauftrag verlangt einen gemeinsamen, nicht gestuften Weg); der Hefteintrag ist jederzeit erreichbar.
- **Kein Zustandsname im Bild oder in der Statusleiste**, damit die Beobachtungsaufgaben nicht vorweggenommen werden; für Bildschirmleser steht der Zustand in der Bildbeschreibung und einer Live-Region.
- Übersichtszeilen in `README.md` und `docs/ARCHITECTURE.md` des Repositorys folgen in einem eigenen kleinen PR nach dem Merge.

## 6. Offene manuelle Abnahme (iPad/Safari, mebis, Lehrkraft)

1. ✓ **iPad/Safari** (30.10.2026 erledigt, siehe oben): Regler mit dem Finger ziehen (auch schnell hin und her) und antippen; Stoff- und Ebenenwahl; Trennlinie mit dem Finger; Bildrate der Teilchenebene und der Gaswölkchen flüssig?
2. **iPad hoch und quer:** keine Überdeckung, Markierungen am Regler lesbar, Bedienfeld scrollt.
3. **Kalte Oberfläche bei Iod:** Kristalle wachsen sichtbar; Ausblenden.
4. **Schema** auf dem iPad hoch und quer: lesbar, bewegte Pfeile flüssig.
5. **mebis:** SCORM-ZIP als „Lernpaket (SCORM)“, Darstellung „Neues Fenster“; Start, Neuladen, keine Bewertung im Kurs.
6. **Lehrkraft fachlich:** Temperaturwerte und Rundung; Darstellung von Eis, Iod, Eisen, Kochsalz; Kochsalz-Ionenpaare im Gas, Ofen und gestauchte Skala; Formulierungen der Aufgaben und Fehlvorstellungen; Hefteintrag (≈ 100 Wörter, etwa 5 Minuten Abschreibzeit); Arbeitsblatt-Ausdruck.
