# Fällungslabor 1.1.0 – Testbericht

Stand **16.11.2026** · Status **prototype** · Labkit 0.3.0 · geprüfter Quellstand: Branch `fix/faellungslabor-1.1`, Commit `d939913` (Code und Tests; der folgende Commit enthält nur die daraus gebauten Artefakte, Belege und Dokumentation).

Auftrag: [`prompts/faellungslabor-korrekturauftrag-claude.md`](../../../prompts/faellungslabor-korrekturauftrag-claude.md) (Revision 1). Statusregeln nach [`docs/QUALITY.md`](../../../docs/QUALITY.md): **PASS** = tatsächlich geprüft, Nachweis dokumentiert · **HOLD – failed** · **HOLD – incomplete** · **HOLD – unverified**.

## Zusammenfassung

| Bereich | Ergebnis |
| --- | --- |
| Korrekturfälle FK01–FK19 | **19/19 PASS** (FK01–FK16, FK19 als eigene Browserszenarien; FK17 über E01–E21; FK18 über P/S/L und die Browserläufe auf den frisch entpackten Paketen) |
| FK20 reales iPad und mebis | **HOLD – unverified** (kein Gerät, kein mebis-Zugang in dieser Umgebung) |
| Regression FL01–FL31 | **31/31 PASS** auf 1.1.0 |
| Unterrichtsfreigabe FL32–FL34 | **HOLD – unverified** |
| `sivex.json` | `status: prototype` |

**Keine Freigabeempfehlung für den Unterricht.** Entwicklungsseitig sind alle sieben Korrekturthemen umgesetzt und geprüft; iPad, mebis und die fachlich-visuelle Abnahme der neuen Version stehen aus.

## Prüfumgebung und ausgeführte Befehle

- Linux-Container, Node.js 22.23.4, Playwright 1.56.1, **Chrome for Testing 153.0.8010.12** (headless). Kein Safari/WebKit, kein Edge, Firefox; **kein echtes Gerät**. Touch: Playwright-Emulation – als **emuliert** gekennzeichnet.
- Prüfling der Browsertests: `release/faellungslabor-1.1.0-web.zip`, frisch in einen leeren Temp-Ordner außerhalb des Repositorys entpackt, per HTTP; Einzeldatei und Web-ZIP zusätzlich per `file://`; SCORM-ZIP im Mock-LMS. Externe Netze in allen Browserkontexten blockiert.
- Zeit: Playwright-Uhr (virtuell); Zeitreihen der Korrekturfälle (FK09, FK11) in **Modellzeit bei 1×** gemessen (`lab.state.time`, bei 1× = Uhrzeit), ab Ende der Zugabe.

```sh
cd apps/faellungslabor
rm -rf node_modules dist && npm ci
npm run test:all                          # Exit 0, Laufzeit 9 min 04 s
#   npm test          → 55/55   (tests/unit/*.test.js, davon neu: korrektur.test.js, tasks.test.js FK14–FK16)
#   npm run package   → Build OK: 17 Dateien, 243,9 KiB, Version 1.1.0, Labkit 0.3.0; 3 Artefakte + SHA256SUMS
#   npm run test:e2e  → 21/21 (tests/e2e/results.json) und 18/18 (tests/e2e/korrektur-results.json: FK01–FK16, FK19, Netz/Konsole)
#   npm run test:scorm→ 14/14   (tests/e2e/scorm-results.json)
cd ../../shared/labkit && npm test        # 8/8 (Labkit unverändert)
```

Prüfsummen (`release/SHA256SUMS.txt`; `release/` enthält nur 1.1.0):

```text
4102973a43a510e74e2110644dd9ee78941e023c597dab8ea15cb69d561d4ce5  faellungslabor-1.1.0.html
56f03b409278a13b61e4a9ce7b0a649c9249eac6d8bec6d355eba13f92196f6c  faellungslabor-1.1.0-web.zip
fec17f1ce00d65c82a54e2de38845fcf0fc22dd185dbff11f1dab96cbda3a10c  faellungslabor-1.1.0-scorm12.zip
```

## Korrekturfälle FK01–FK20

Viewport ohne Angabe: 1180×820 (emuliert). Vorher-Belege: `screenshots/vorher-1.0.0-*.png`, `evidence/vorher-1.0.0.json` (gleiches Messverfahren).

| ID | Prüfverfahren · Schritte | Soll | Ist | Status | Nachweis |
| --- | --- | --- | --- | --- | --- |
| FK01 | Browser: 1024×768, 1180×820, 820×1180 × hell/dunkel × Haupt-/Kontrollteil (12 Ansichten); berechnete Schriftgröße und Zeilenbox jedes Etiketts, Überlauf, Abstände, Gruppen, Eindeutigkeit | größere Namen/Formeln, klarer Abstand, NH₃ eindeutig | Formel 18 px, Name 14 px (vorher Flaschenname 6,2–6,8 px), „verdünnt“/„konzentriert“/„destilliert“ 14 px fett; kein Überlauf, nichts abgeschnitten; Abstand 6 px in der Gruppe, 18 px zwischen Gruppen; Überschriften „Probelösungen · Nachweis- und Prüfreagenzien · zum Verdünnen“ bzw. „Positivkontrolle · Blindprobe · Wasserproben · Nachweisreagenz“; keine doppelten Etiketten; Wasser getrennt | PASS | `nachher-1.1.0-{1024x768,1180x820,820x1180}-{dark,light}[-kontrolle].png`, `evidence/FK01-etiketten.json` |
| FK02 | Browser (Touch emuliert): je Flasche beider Teile Treffer an Etikettmitte und Infoleiste (`elementFromPoint`), Antippen → Pipette, Lage der Pipette, Infokarte; Pipette über einem Glas | Objekt, Pipette, Trefferfläche deckungsgleich; Karten erreichbar | 12/12: Etikett trifft genau seine Flasche, Infoleiste genau ihre Karte; aufgenommene Pipette steht ±1,5 px über der Etikettmitte; Pipette über einem Glas liegt obenauf und ist bedienbar | PASS | FK02 |
| FK03 | Browser: „− Glas“ ohne Auswahl; leeres Glas zwischen zwei gefüllten; +/− bis 6 bzw. 1; Kontrollteil 4→1; Reload; Tastatur | gewähltes Glas weg, Grenzen, ≥ 1 bleibt | Hinweis ohne Auswahl; leeres Glas 2 entfernt, A1/A2 bleiben; Obergrenze 6 (Haupt) bzw. 4 (Kontrolle), „Mindestens ein Reagenzglas bleibt im Ständer.“; Trefferflächen = Gläser; nach Reload gleicher Stand; Enter auf Glas und Knöpfen | PASS | FK03, Unit FK03/FK16 |
| FK04 | Browser: A1 (NaCl + 5 Tr.) mit gespeicherter Beobachtung, A2 (NaBr); „− Glas“ auf A1, Abbrechen, dann bestätigen | Rückfrage, Abbrechen neutral, Daten erhalten | Rückfrage nennt Glas, Volumen und Ansatz; Abbrechen: Zustand identisch; Bestätigen: Ausgießen, Glas weg, A2 rückt auf; A1 genau einmal archiviert, Abfall = Inhalt (V, 5 Tropfen Ag); Protokolleintrag und Ergebnisübersicht „Ansatz beendet“; nächste Kennung A3 | PASS | `nachher-1.1.0-glas-entfernen-rueckfrage.png` |
| FK05 | Browser: Dauertropfen (Maus gedrückt) in A2, währenddessen „− Glas“ + Bestätigen (zweiter Finger, Skript-Klick), danach loslassen | keine Geistertropfen, keine Doppelbuchung | Dosierung beim Entfernen beendet; A1 erhält keinen Tropfen; Archiv A2 = gelandete Tropfen, Abfall-Silber = archivierte Tropfen; nichts im Flug; danach normal weiter | PASS | FK05, Unit FK05 |
| FK06 | Browser + Unit: je Halogenid 2 mL + 5 Tr., dieselbe Probe erneut; andere Probe; 3-mL-Portionen bis zur Grenze | erlaubt, Mengen/Volumen/Revision richtig | Cl/Br/I: gleicher Ansatz, Revision steigt, V +2,00 mL, X⁻ gesamt 4,0·10⁻⁴ mol, Ag unverändert; andere Probe abgewiesen; Grenze 20 mL eingehalten (19,25 mL, nächste Portion würde überlaufen) | PASS | `evidence/FK06-gleiche-probe.json`, `korrektur.test.js` |
| FK07 | Browser + Unit: AgCl + 1 mL NH₃ verd. gelöst, dann NaCl erneut, schwenken; Br/I nach NH₃ konz. | erlaubt, Gleichgewicht konsistent | Stoffmengen gesamt exakt; Feststoff = `solidAtEquilibrium` (hier 0 %, NH₃ reicht); Unit zeigt Wiederausfällung bei knapper NH₃-Menge; Br/I nach NH₃ erlaubt | PASS | `evidence/FK07-nach-nh3.json`, `korrektur.test.js` |
| FK08 | Browser: NH₃ verd./konz. vor AgNO₃, andere Probe, AgNO₃ und Wasser in leeres Glas, Umfüllen, volles Glas | weiterhin abgefangen, Berechtigtes frei | 6/6 abgewiesen, Zustand unverändert; danach AgNO₃ und NH₃ möglich; Kapazität 20 mL | PASS | FK08, E12 |
| FK09 | Browser, 1×, ab Ende der Zugabe; 10 Tr. AgNO₃, abgesetzt (50 s): (a) AgCl + 1,0 mL NH₃ verd. ohne Schwenken, Bilder 0/1/2/5/10 s; (b) dasselbe, einmal geschwenkt; (c) AgBr + 3,0 mL NH₃ konz., einmal geschwenkt | sichtbarer Beginn 1–2 s, klar 5–10 s, Konstanten unverändert | Feststoffanteil (a) 0,85 → 0,64 → 0,47 → 0,16 → 0,00 (1.0.0: 0,97 → 0,85 (2 s) → 0,70 (5 s) → 0,50 (10 s) → 0,22 (20 s)); (b) 0,69 → 0,28 → 0,10 → 0,00 (5 s); (c) 0,45 → 0,18 → 0,05 → 0,00 (5 s); Bodensatz-Helligkeit im Bild deutlich gesunken; nur Darstellungsraten geändert | PASS | `nachher-1.1.0-nh3-agcl-bodensatz-{0,1,2,5,10}s.png`, `nachher-1.1.0-nh3-agcl-geschwenkt-2s.png`, `evidence/FK09-aufloesen.json`, `CHEMIE.md` §5a |
| FK10 | Browser: AgCl + 0,5 mL verd.; AgBr + 1 mL verd.; AgI + 6 mL konz.; AgCl + 3 mL Wasser; je geschwenkt, 30 s; Konstanten gelesen | Rest bleibt, AgI bleibt, Wasser kein Ersatz | Rest AgCl 0,66, AgBr 1,00, AgI 0,999, Wasser 1,0000; pKₗ 9,74/12,30/16,08, lg K₁ 3,31, lg K₂ 3,91 unverändert. Hinweis: AgBr (10 Tr.) + 2,5 mL konz. lässt im Gleichgewicht ≈ 7 % (E10), 3 mL lösen vollständig | PASS | `nachher-1.1.0-nh3-grenzfaelle.png`, `evidence/FK10-grenzfaelle.json` |
| FK11 | Browser: A1 (NaCl + 6 Tr.) spülen, A2 daneben; 7 Bilder bei 0,12–2,3 s Modellzeit; Lage, Winkel, Lippe, Pixel der Bewegungsebene im Strahl; Bilanz | Anheben, Kippen, Strahl ins Abfallziel, leer zurück, 1× archiviert | Dauer 2,4 s; „wird ausgegossen …“ am Glas; Kippwinkel 112°; Lippe über der Öffnung des beschrifteten Behälters „Silberabfälle“; Strahl zwischen Lippe und Öffnung sichtbar (Deckkraft > 60/255); Füllstand sinkt monoton; danach leer im Ständer, A1 einmal archiviert, Abfall 2,30 mL und 6 Tropfen Ag; A2 unverändert | PASS | `nachher-1.1.0-ausgiessen-1…7.png`, `evidence/FK11-ausgiessen.json` |
| FK12 | Browser: Ausgießen mit 5-fachem Klick, Pause, Teilwechsel, Fokusverlust (`blur`), Reload mitten im Vorgang, gleichzeitiges „− Glas“, `prefers-reduced-motion` | stabil, keine Doppelbuchung | in allen 7 Fällen: Glas leer, A1 genau einmal archiviert, Abfall einfach gebucht, A2 erhalten, danach bedienbar (A3); Pause hält das Ausgießen an; Teilwechsel/Fokusverlust/Reload schließen es sofort ab; reduzierte Bewegung: 0,8 s im Ständer ohne Kippen | PASS | FK12, Unit FK11/FK12 |
| FK13 | Browser: Bühnentext und ARIA beider Teile nach Konzentrationen durchsuchen; 6 Infokarten; Modellwerte | Bühne kompakt, Werte in Karte, Modell erhalten | keine Konzentration auf der Bühne; Karten „Konzentration: c = 0,100 mol/L“ bzw. „c = 2,0 mol/L (w ≈ 3,4 %)“ bzw. „c ≈ 13,3 mol/L (w = 25 %)“; Modell 0,1 / 2,0 / 13,3 mol/L | PASS | `nachher-1.1.0-infokarte-nh3-konz.png` |
| FK14 | Browser mit `#seed=1, 7, 42, 1234, 98765` + Unit (6 Startwerte, Gleichverteilung über 12 000 Startwerte) | unterschiedliche Permutationen, Bewertung über IDs | alle 9 Fragen (Auswahl, Mehrfachauswahl, Zuordnungen, Gleichungen) unterschiedlich gemischt; richtige Gleichung an Position 1/1/4/4/1; Gleichungen als Ganzes; richtige Antworten über IDs ergeben „Alles richtig“ | PASS | `nachher-1.1.0-aufgaben-gemischt-seed42.png`, `evidence/FK14-reihenfolgen.json`, `tasks.test.js` |
| FK15 | Browser: Antworten, Prüfen, Tipp, Reiter-/Teilwechsel, Reload; „Neuer Durchgang …“ abbrechen und bestätigen | stabil bis zum neuen Durchgang | Reihenfolge und Auswahl unverändert über alle Schritte und Reload; Abbrechen behält den Startwert; Bestätigen: neuer Startwert, Antworten gelöscht, neu gemischt | PASS | FK15, Unit FK15 |
| FK16 | Browser: Sitzung im 1.0.0-Format (Buchstaben) vorbelegt; beschädigter und gesperrter Speicher | korrekt migriert oder erklärt | Hinweis „Gespeicherte Antworten aus Version 1.0 übernommen …“ einmal; eqCl „c“ → `full` usw., Mehrfachauswahl auf IDs; neu bewertet weiterhin richtig, Fortschritt 3/3; nach Reload stabil; kaputter Speicher → frischer Start, gesperrter Speicher → bedienbar, keine Fehler | PASS | `nachher-1.1.0-migration-1-0.png`, Unit FK16 |
| FK17 | Regression E01–E21 auf 1.1.0 (Kernversuche, NH₃, Kontrollen, Gleichungen, Hilfen, Hefteintrag, Formate, Abbruchwege, Speicher) | gesamter Lernweg weiter funktionsfähig | 21/21 PASS; Hauptteil 3/3 ohne Kontrollbesuch; Hefteintrag 91 Wörter (inkl. Überschrift) | PASS | `tests/e2e/results.json` |
| FK18 | P01–P05, S01–S04, L01–L05 auf den frisch erzeugten Paketen; E/FK-Läufe auf dem frisch entpackten Web-ZIP | Pakete isoliert, offline, file/HTTP, Mock-LMS | 14/14 PASS: Einzeldatei (233,0 KiB) und Web-ZIP per `file://` und HTTP mit Kernablauf, SCORM-Manifest im Stamm, Mock-LMS nur `LMSInitialize`/`LMSFinish`; 0 externe Anfragen, 0 Konsolenfehler (E21, FK-Netz) | PASS | `tests/e2e/scorm-results.json`, `50`–`52-*.png` |
| FK19 | Browserlauf FK19 + P05: Version in package.json, sivex.json, App, Oberfläche, Manifest, Dateinamen; SHA256SUMS; Paketinhalt gegen Quelle | 1.1.0 überall, aktuelle Prüfsummen, Quellstand dokumentiert | überall 1.1.0; nur 1.1.0-Dateien in `release/`; Prüfsummen stimmen; js/css im Paket byte-gleich mit Commit `d939913` | PASS | FK19, P05 |
| FK20 | – | 1.1.0 auf echtem iPad und frisch in mebis | **nicht durchgeführt** (kein Gerät, kein mebis-Zugang) | **HOLD – unverified** | – |

## Regression: PASS/HOLD-Matrix FL01–FL34 auf 1.1.0

Alle Prüfungen der Version 1.0.0 wurden auf den 1.1.0-Paketen erneut ausgeführt (E01–E21, P01–P05, S01–S04, L01–L05, Unit). Geänderte Erwartungen wegen der beauftragten Korrekturen sind in der Spalte „Ist“ mit **1.1.0:** gekennzeichnet. Datum: 16.11.2026. „Viewport“ ohne Angabe: 1440×900 (emuliert, Desktop-Chromium). Screenshots in `docs/screenshots/`, Messwerte in `docs/evidence/`.

| ID | Prüfverfahren · Eingangsdaten · Schritte | Soll | Ist | Status | Nachweis |
| --- | --- | --- | --- | --- | --- |
| FL01 | Browser E01 + Dateiprüfung: App starten, Titel/Version/Reiter lesen; `sivex.json`, zentrale README, ARCHITECTURE | neuer Name, Pfad `apps/faellungslabor/`, Metadaten, Übersichtslinks, Apps erhalten | Titel „Fällungslabor – SiVex“, Version **1.1.0** in UI/Metadaten/Manifest; `chemie/faellungslabor`; geplanter README-Eintrag ersetzt (kein Duplikat), Links auf App, Artefakte, Testbericht; Labkit und andere Apps unverändert (git diff, Labkit-Tests 8/8) | PASS | E01, `01-start-1440x900.png` |
| FL02 | E02: Etiketten und Karten aller Flaschen lesen; Unit „Konstanten“ | AgNO₃, NaCl/NaBr/NaI 0,100 M; NH₃-Werte konsistent; kein BaBr₂/Carbonat/HNO₃ | **1.1.0:** Etiketten zeigen Formel, Name und Zusatz (keine Konzentration), die Infokarten „Konzentration: …“; Karten/Modell/Doku: 0,100 mol/L; NH₃ 2,0 mol/L und 25 % ≙ 13,3 mol/L überall gleich; keine Barium-, Carbonat- oder Säureflasche (Text- und Flaschenprüfung, auch Kontrollteil) | PASS | E02, E13, `CHEMIE.md` §1 |
| FL03 | E03: drei Proben selbst füllen, je 8 Tropfen per Klick, absetzen, Pixel im Bodensatz messen | richtige Produkte und Farben, Referenz dokumentiert | AgCl/AgBr/AgI im Modell; Gelbanteil 0,010 / 0,128 / 0,264 (weiß < creme < blassgelb, AgI < 0,45); keine Produktnamen auf der Bühne; Referenzen RSC, chemguide, UC Davis | PASS | `03e-drei-faellungen-abgesetzt.png`, `evidence/E03-farben.json`, `CHEMIE.md` §7 |
| FL04 | E03/E04: Tropfen im Flug abfragen; Tippen per Maus, Touch (emuliert), Enter; Halten 2 s (Maus), 1,3 s (Leertaste) | sichtbare Einzel-/Dauertropfen, richtiges Ziel, Buchung beim Eintreffen | im Flug: 1 Tropfen, Glas unverändert; nach Eintreffen +0,05 mL und Wolke; je Tipp genau 1 Tropfen (keine Doppelauslösung Touch→Klick); Halten 2 s → 6, Leertaste 1,3 s → 4; danach kein Nachtropfen | PASS | `03a-tropfen-im-flug.png`, `03b-wolke-am-eintreffpunkt.png`, E04 |
| FL05 | E05: Spiegelhöhe während einer 1-mL-Zugabe abfragen, dann bis zum Rand dosieren | steigender Füllstand, Meniskus, Clipping, Kapazität | Spiegel steigt während des Strahls; Meniskus an der Wand; Flüssigkeit im Glas geclippt; Stopp bei 20,000 mL mit „Reagenzglas ist voll“; Volumenbilanz 10⁻⁶ | PASS | `05a-strahl-dosierhilfe.png`, `05b-reagenzglas-voll.png` |
| FL06 | E03 Bildfolge; E07 Trübung bei 1/15/31 Tropfen | mehrere Zwischenbilder, handlungsabhängige Verteilung | Bildfolge Tropfen → Wolke am Eintreffpunkt → Ausbreitung → Trübung; Trübung 0,79 / 0,69 / 0,00 je nach Menge und Volumen | PASS | `03a`–`03d`, `07-mengen-1-15-31-tropfen.png` |
| FL07 | E06: 3 mL NaI + 12 Tropfen; Bilder bei 0, 18, 48 s; Schwenken; Helligkeit oben gemessen | Absetzen, klarerer Überstand, Resuspension, Menge erhalten | Front 0,3–0,7 nach 18 s; Helligkeit oben 0,574 → 0,252 → (geschwenkt) 0,706; Feststoff vor/nach identisch (10⁻⁶) | PASS | `06a`–`06e`, `evidence/E06-ueberstand.json` |
| FL08 | E07 + Unit R1–R3: Nullzugabe, 1/15/31 Tropfen, Probe 1/3 mL, Ag-Überschuss | plausibel, kein unbegrenzter Feststoff, keine NaN | Nullzugabe klar; 31 Tropfen auf 1 mL: Feststoff = 1,0·10⁻⁴ mol (Cl⁻ limitierend); 15 Tropfen: Ag⁺ limitierend; Zustand ohne NaN/∞/negativ; Raster-Unit ohne Ausreißer | PASS | E07, `chem.test.js` R1–R3 |
| FL09 | E08: NaBr + 9 Tropfen + 0,5 mL Wasser + 1,05 mL NH₃ konz.; Sollwerte aus gezählten Bedienschritten; Unit „Bilanzen“ | Bilanzen innerhalb festgelegter Toleranz | V, Ag, NO₃⁻, Na⁺, Br⁻, NH₃: max. relative Abweichung 1,6·10⁻¹⁵ (Toleranz 10⁻⁶ vorab festgelegt); Feststoff + gelöst = gesamt | PASS | `evidence/E08-bilanz.json`, `model.test.js` |
| FL10 | E09: AgCl (10 Tr.) + 0,5 mL NH₃ verd., später +1,0 mL; Bildfolge | Rest bei zu wenig, sichtbares Auflösen bei genug | Rest 66 % (Handrechnung R4: 66,2 %); **1.1.0:** schnellere Darstellung, Abtastung alle 0,5 s nach weiteren 1,0 mL: 0,35 → 0,28 → 0,22 → 0,17 → vollständig gelöst | PASS | `09a`–`09c-*`, `evidence/E09-agcl.json`, R4/R5 |
| FL11 | E10: zwei frische, gleich angesetzte NaBr-Gläser (10 Tr.), je 2,5 mL verd. bzw. konz. | verd. weitgehend beständig, konz. löslich, Mengenreferenz | Rest 97 % (verd.) bzw. 7 % (konz.); Referenz R6/R7 97,3 % / 6,9 % | PASS | `10-agbr-verduennt-links-konzentriert-rechts.png`, R6/R7/R9 |
| FL12 | E11: NaI (10 Tr.) + 6 mL NH₃ konz., schwenken, 30 s | sichtbarer AgI-Rest | 99,9 % Rest, Gelbanteil > 0,12 im Bodensatz | PASS | `11-agi-mit-6-ml-konz-nh3.png`, R8 |
| FL13 | E12 + FK08: NH₃ vor AgNO₃; zweite **andere** Probe; AgNO₃ in leeres Glas; Pipette auf Flasche ziehen | kein Transfer, kurzer Hinweis, weiter bedienbar | 4/4 abgewiesen mit Zeichen, Text „Dieser Vorgang entspricht nicht der Experimentieranleitung.“, Begründung, `role=alert`; Zustand unverändert; Zeichen verschwindet nach 3 s; danach AgNO₃ und wiederholtes NH₃ möglich; **1.1.0:** dieselbe Probe ist jetzt erlaubt (FK06/FK07), andere Probe weiterhin abgewiesen; bei reduzierter Bewegung ohne Wackeln (CSS-Regel; im Browser nicht gesondert geprüft) | PASS | `12a-verbotszeichen-nh3-vor-agno3.png`, `evidence/E12-grenzen.json` |
| FL14 | E13 (Kontrollteil zuerst), E14 (Hauptaufgaben 3/3 ohne Kontrollbesuch), E15 | unabhängig, Zustände getrennt | Kontrollteil zuerst bedienbar; Hauptteil danach leer; Rückwechsel erhält Kontrollansätze; Pflichtfortschritt 3/3 mit Kontrollzähler 0; Eingaben bleiben beim Reiterwechsel | PASS | E13, E14 |
| FL15 | E13: NaCl / dest. Wasser / Leitungs- / Mineralwasser je 2 mL + 5 Tropfen | NaCl positiv, Wasser klar, vergleichbar | gleiche Volumina (2,25 mL) und Tropfenzahl; Blindprobe 0 mol Feststoff; Helligkeit K1–K4 0,71 / 0,25 / 0,46 / 0,51 | PASS | `13a-kontrollen-trueb-verteilt.png`, `evidence/E13-kontrollen.json` |
| FL16 | E13: Auswertung, Lösung, Erläuterung prüfen | beide plausibel trüb, Mischfällung/Grenzen erklärt, keine Zuordnung | Wasserproben sichtbar trüb; verbindliche Aussage wörtlich; keine Halogenid- oder Gleichungsaufgabe zur Wasserprobe; Ansäuern nur in zugeklappter Erläuterung, keine Säureflasche | PASS | `13b-kontrolle-auswertung.png` |
| FL17 | E14 + Unit: leer, alles, teilweise, Fehlvorstellung, richtig; Korrektur | Formate korrekt unterschieden | leer: 0 von 4; „alles“: nicht bestanden, je falscher Aussage Begründung; teilweise: „2 … treffen zu. Es fehlen noch 2 …“; Na⁺-Fehlvorstellung konkret; nach Korrektur richtig | PASS | `14a-aufgabe-1-richtig.png`, `tasks.test.js` |
| FL18 | E14 + Unit: drei Gleichungsfragen | aq/s, Ladungen, Zuschauerionen; gekürzte erläutert | richtige Optionen exakt wie im Auftrag; gekürzte Gleichung → „Die Fällungsreaktion ist richtig dargestellt. Ergänze die Zuschauerionen …“; Distraktoren: Zustand, Feststoff, Ladung, Salzformeln, fehlende Zuschauer rechts; keine reinen Vertauschungen | PASS | `14b-gleichung-gekuerzt-rueckmeldung.png` |
| FL19 | E14/E15: Tipps 1–3, Lösung mit Rückfrage, Rückkehr zu eigenen Antworten; Produktnamen | Hilfen bedienbar, bewusste Lösung, keine Vorwegnahme | Tipp 1/3–3/3; Rückfrage vor der Lösung; „Eigene Antworten zeigen“; Bühne und Protokoll ohne Niederschlagsnamen | PASS | `14c-ammoniak-loesung-angefordert.png`, E15 |
| FL20 | E16 + Unit: Hefteintrag ohne Versuch über die Kopfzeile; Kurzfassung | immer erreichbar, knapp, Farben/NH₃/Zuschauerionen, eine Gleichung; Kontrolle separat | sofort erreichbar; 83 Wörter + Gleichung (Unit, mit Legende), 91 inkl. Überschrift (Browser); Pflichtinhalte; Kontroll-Kurzfassung 36 Wörter nur im Kontrollteil | PASS | `16a-hefteintrag-sofort.png`, `16b-kurzfassung-kontrollen.png` |
| FL21 | E17: Zustand vor/nach Umschalten vergleichen; Bodensatz gegen Überstand messen | gleiche Chemie, beide Varianten brauchbar | Zustand (Zeit, Mengen, Front) identisch; Farbabstand Bodensatz/Überstand ≥ 0,137 in beiden Varianten, weißer Bodensatz hebt sich auch in der Helligkeit ab | PASS | `17a-hintergrund-dunkel.png`, `17b-hintergrund-hell.png`, `evidence/E17-kontrast.json` |
| FL22 | E02 (Touch-Emulation 1180×820) + `QUELLEN.md` | Lösungen/SDB belegt, Karten touchbedienbar | 9 Karten per Tippen geöffnet, Piktogramme je Lösung wie belegt, Wasser ohne Symbole, Karte vollständig im Bild, Schließen per Knopf/Escape; Ableitungen gekennzeichnet | PASS | `02-ghs-karte-*.png`, `QUELLEN.md` |
| FL23 | E18: 1024×768, 1180×820, 1440×900, 1920×1080, 820×1180 (emuliert); Splitter Maus/Tastatur/Doppelklick/Touch (CDP) | alles bedienbar, kein Clipping | kein horizontales Scrollen; Reagenzglas **1.1.0:** 77×273 (1024×768) bis 137×483 px (1920×1080) – trotz größerer Etiketten etwa wie in 1.0.0 (79×277); Bedienelemente im Bild; Bedienfeld und Gleichungen ohne Abschneiden; Splitter ±24 px, max. 620 px, Rücksetzen, Fingerzug | PASS | `18-format-*.png`, `evidence/E18-formate.json` |
| FL24 | E04, E19: Halten mit pointercancel, blur, verborgenem Tab; Wechsel des Versuchsteils während Dosierhilfe | Ende in allen Fällen, keine Doppel-/Hintergrunddosierung | jeweils keine weiteren Tropfen nach dem Abbruch; Teilwechsel beendet Zugabe, Pipette zurück | PASS | E04, E19 |
| FL25 | E20 (Echtzeit): Pause, Bedienen in Pause, Neuladen während gedrückter Dosierung, Spülen, Gesamtreset (Abbrechen/Ja), Speicher gesperrt | keine Blockade, gezielter Reset, Reload/Storage-Fehler ok | Pause hält an; Tropfen beendet Pause mit Hinweis; nach Reload: 1×, nichts im Flug, Pipette zurück, Ansatz A1 erhalten; Spülen leert nur dieses Glas (**1.1.0:** sichtbar ausgegossen, Test wartet das Ende ab); Gesamtreset nur nach Bestätigung; mit gesperrtem `localStorage`/`sessionStorage` voll bedienbar | PASS | E20 |
| FL26 | P04, S01, S02: Einzeldatei in leeren Temp-Ordner kopiert, `file://` und HTTP, Kernablauf | volle Funktion offline ohne Quellordner | 12 Skripte, 2 Stylesheets, Piktogramme eingebettet (233,0 KiB); je 1 Anfrage (die Datei selbst); Haupt-, Ammoniak-, Kontroll-, Aufgaben- und Hefteintragsablauf ohne Fehler | PASS | `50-einzeldatei-file.png`, `scorm-results.json` |
| FL27 | P03, S03, S04: Web-ZIP frisch entpackt, `file://` und HTTP; alle Browsertests E01–E21 auf diesem Paket | vollständige statische App | 17 Dateien, identisch mit SCORM-Inhalt; beide Zugänge mit Kernablauf fehlerfrei; E01–E21 auf dem entpackten Paket | PASS | `51-web-zip-file.png` |
| FL28 | P01, P02: Manifest und Dateien | Manifest im Stamm, gültige Referenzen | `imsmanifest.xml` im Stamm, kein verschachteltes Manifest, SCORM 1.2/ADL, IMS- und ADLCP-Namespaces, ein SCO `index.html`, Manifest = ZIP-Inhalt (17 Dateien), nur relative interne Verweise | PASS | `scorm-results.json` |
| FL29 | L01–L05: Mock-LMS iframe/neues Fenster mit API, ohne API, `LMSInitialize` → 'false', `LMSInitialize` wirft | Init/Finish, Fehlerpfade, keine Lern-/Personendaten | mit API: genau `LMSInitialize` + `LMSFinish`; ohne API: keine Aufrufe; Fehlerpfade: ein Init-Versuch, kein Finish, keine Schleife, keine Konsolenfehler; nie `LMSGetValue`/`LMSSetValue`/`LMSCommit`; App jeweils bedienbar | PASS | `52-scorm-iframe.png`, `52-scorm-popup.png`, `evidence/scorm-lms-aufrufe.json` |
| FL30 | E21 + S01–S04: externe Netze blockiert, frische Kontexte | alles offline vollständig, keine Konsolenfehler | 390 Seitenanfragen in E01–E20, extern 0; Konsolen-/Seitenfehler 0; Paketprüfungen ebenso. (Chrome selbst versucht im Container Verbindungen zu Google-Diensten – Browserprozess, nicht die Seite; vom Proxy abgelehnt, ohne Einfluss.) | PASS | `results.json` E21 |
| FL31 | P05 + Build-Prüfung | Versionen, frischer Build, SHA256SUMS, Quellstand | **1.1.0** in `package.json`, `sivex.json`, App, Oberfläche, Manifest, Dateinamen; SHA256SUMS für alle 3 Artefakte korrekt; keine alten Pakete (1.0.0-Dateien entfernt); alle 17 Laufzeitdateien byte-gleich mit dem Quellstand | PASS | `scorm-results.json` P05 |
| FL32 | – | echtes iPad/Safari | **nicht durchgeführt** – weder für 1.0.0 noch für 1.1.0 (kein Gerät in dieser Umgebung); nur Emulation | **HOLD – unverified** | – |
| FL33 | – | frischer mebis-Import, neues Fenster, Zielgerät | **nicht durchgeführt** – weder für 1.0.0 noch für 1.1.0 (kein mebis-Zugang); nur Mock-LMS (FL29) | **HOLD – unverified** | – |
| FL34 | – | Lehrkraft bestätigt Modell, Texte, Farben | **ausstehend** für 1.1.0 (das Feedback zu 1.0.0 ist in diese Version eingeflossen) | **HOLD – unverified** | – |

## Gefundene und behobene Fehler in der Korrekturschleife 1.1.0

| Befund (Test/Screenshot) | Korrektur | erneut geprüft |
| --- | --- | --- |
| Infoleiste eines Etiketts verdeckte die Trefferfläche der Pipette über einem Glas (E06/E10: Klick abgefangen) | Pipette liegt in der Ebene der Trefferflächen obenauf | E06, E10, FK02 |
| „konzentriert“ passte bei 14 px nicht ins 88-px-Etikett (Umbruch, Überlauf) | Etikett 90 px, engere Laufweite, weiches Trennzeichen; Sicherung für fremde Systemschriften (`tight`) | FK01 |
| schmale Bühne (breites Bedienfeld): auch Kompaktetiketten liefen über den Rand | Kompaktetikett passt seine Breite an (mind. 54 px), Name ausgeblendet, Formel bleibt 18 px | Sichtprüfung 1024 px mit 460-px-Bedienfeld |
| Bedienleiste bei 1024 px zweizeilig durch „− Glas“ (kleinere Gläser) | engere Abstände in der Leiste, Bedienfeld standardmäßig `clamp(300px, 28vw, 420px)` | E18 (Glas 77×273 px, vorher 79×277) |
| Gruppenüberschrift „Nachweisreagenz“ um 2 px abgeschnitten | Überschriften 12 px | FK01 |
| Beschriftung „Silberabfälle“ überdeckte den Behälter | Beschriftung unter dem Behälter auf dem Tisch | FK11, Sichtprüfung |
| FK09-Entwurf: AgBr mit 2,5 mL konz. NH₃ wird nie ganz klar | kein Darstellungsfehler: Gleichgewichtsrest ≈ 7 % (unverändert, vgl. E10). Referenzfall auf 3,0 mL („ausreichend“) gesetzt; Konstanten nicht angepasst | FK09, FK10 |
| FK19 meldete „Paket ≠ Quelle“ nach einer späten Textänderung | Pakete aus dem eingecheckten Quellstand neu erzeugt | vollständiger Lauf ab `npm ci` |

Angepasste Erwartungen der Regressionstests (beauftragte Verhaltensänderungen, keine Abschwächung): E02 prüft Etiketten ohne Konzentration und die Konzentration in der Karte; E09 tastet wegen des schnelleren Auflösens alle 0,5 s statt 1,5 s ab (fortschreitend, nicht schlagartig); E14 verwendet die fachlichen Antwort-IDs statt Buchstaben; E15/E20 warten das sichtbare Ausgießen ab.

## Korrekturschleife 1.0.0 (unverändert dokumentiert)

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
- Die Schriftmessungen (FK01) gelten für die Systemschrift des Containers; mit der iPad-Schrift können Breiten leicht abweichen (Sicherung `tight` vorhanden, Prüfung Teil von FK20).
- Touch und Tablet-Formate emuliert; Bildschirmtastatur, echtes Fingerverhalten und Safari-Eigenheiten (Auswahllisten, Zoom) nicht geprüft.
- Farben nur gegen Textbeschreibungen fotografisch dokumentierter Versuche abgeglichen, nicht pixelgenau gegen Fotos (Teil von FL34).
- Mock-LMS statt mebis; „Neues Fenster“ von mebis auf Schul-iPads offen (FL33).

## Nächste Prüfschritte (reproduzierbar)

1. **FK20/FL32:** `release/faellungslabor-1.1.0.html` oder Web-ZIP auf ein Schul-iPad (Safari, Querformat und Hochformat): Probe füllen, Tropfen tippen und halten, Ammoniak-Dosierhilfe, Schwenken, Kontrollteil, Aufgaben (Auswahllisten!), Hefteintrag, GHS-Karte, Trennlinie mit dem Finger; neu: Lesbarkeit der Etiketten mit iPad-Schrift, „− Glas“, Spülen/Ausgießen, „Neuer Durchgang“.
2. **FK20/FL33:** `release/faellungslabor-1.1.0-scorm12.zip` frisch in mebis importieren, Darstellung „Neues Fenster“, auf dem iPad starten, einmal Haupt- und Kontrollablauf, Neuladen.
3. **FL34:** Lehrkraft prüft die neue Version fachlich-visuell: Etiketten und Gruppen (`nachher-1.1.0-*`), Auflösegeschwindigkeit (`nachher-1.1.0-nh3-*`), Ausgießen (`nachher-1.1.0-ausgiessen-*`), Modell (`docs/CHEMIE.md` §5a/5b), Farben (`03e`, `10`, `11`, `13a`, `17a/b`).

Erst wenn FK20 und FL32–FL34 für genau diese Version bestanden sind, `sivex.json` auf `ready` setzen.
