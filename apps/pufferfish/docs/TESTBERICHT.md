# Pufferfish 0.2.1 – Testbericht

Stand 29.10.2026 · Labkit 0.1.1 · Status **prototype** (Entwicklungsstand, **nicht** für den Unterricht freigegeben)

Statusregeln nach [`docs/QUALITY.md`](../../../docs/QUALITY.md): **PASS** = geprüft, Nachweis dokumentiert · **HOLD – failed** = reproduzierbarer Fehler · **HOLD – incomplete** = verbindliche Funktion fehlt · **HOLD – unverified** = Prüfung nicht möglich bzw. nicht durchgeführt.

## Zusammenfassung

| Bereich | Ergebnis | Nachweis |
| --- | --- | --- |
| Unit-Tests Modell, Zustand, Bewertung | PASS 60/60 | `npm test`, Abschnitt 2 |
| Browserprüfung (Chromium, 1440×900, Tablet-Emulation 1180×820, 1024×768, 768×1024) | PASS 24/24 | `tests/e2e/results.json`, Abschnitt 3 |
| Pakete: SCORM 1.2 (Mock-LMS eingebettet/neues Fenster), Web-ZIP über HTTP und file://, frisch entpackt | PASS 17/17 | `tests/e2e/scorm-results.json`, Abschnitt 4 |
| Abnahmekriterien P01–P16 des Änderungsauftrags 0.2.0 | PASS 16/16 (Entwicklerprüfung) | Abschnitt 5 |
| Visuelle Kontrolle der Screenshots | PASS | `docs/screenshots/`, Abschnitt 6 |
| Echtes Schul-iPad mit Safari | **HOLD – unverified** | nicht durchgeführt; nur Emulation in Chromium |
| Echter mebis-Import (ByCS) | **HOLD – unverified** | nicht durchgeführt; nur Mock-LMS |
| Fachlich-didaktische Freigabe durch die Lehrkraft | **HOLD – unverified** | ausstehend |

**Keine Freigabeempfehlung.** Die Entwicklerprüfungen bestätigen P01–P16, ersetzen aber weder die Prüfung auf einem echten iPad noch den mebis-Import noch die fachlich-didaktische Durchsicht. Der Stand bleibt `prototype`; `ready`, „unterrichtsfreigegeben“ und ein Merge nach `main` sind durch diese Tests nicht legitimiert.

Prüfumgebung: Node 22.22.0, Playwright 1.63.0 mit **Chromium 153.0.8010.12** (headless, Linux); keine Prüfung mit Edge, Safari oder Firefox.

## Nachtrag 0.2.1 (29.10.2026)

Prüfumgebung dieses Nachtrags: Windows 11, Node 24.22.1, Playwright 1.56.1 mit **Microsoft Edge 156.0.4314.50** (headless). Die Abschnitte ab „0.“ beschreiben die Prüfung von 0.2.0 (Chromium unter Linux).

| Bereich | Ergebnis | Nachweis |
| --- | --- | --- |
| Unit-Tests (inkl. Labkit) | PASS 66/66 | `npm test` (neu: Rühren an/aus beschleunigt die Mischung, Messwert unverändert) |
| Browserprüfung Edge, 1440×900 und Touch-Emulation 1180×820, 1024×768, 768×1024 | PASS 25/25 | `tests/e2e/results.json` |
| Pakete frisch entpackt: SCORM 1.2 im Mock-LMS (eingebettet, neues Fenster), Web-ZIP per HTTP und file:// | PASS 17/17 | `tests/e2e/scorm-results.json` |
| Echtes iPad, mebis-Import, fachliche Freigabe | **HOLD – unverified** | nicht durchgeführt |

Geprüfte Änderungen (neues Szenario **E23**, angepasst E03, E06, E08, E11, E13, E16–E19, E21):

- **Zugesetzte Gesamtmenge (nur Versuch 1):** Start „HCl 0,00 mL / NaOH 0,00 mL“ je Glas; zählt während der Zugabe mit; nach 1,0 mL in beide Gläser „HCl 1,00 mL“; Laugenreihe zeigt ihre eigene (frische) Menge, zurück zur Säurereihe bleibt die Menge erhalten; „Neue Reihe“ setzt auf 0,00 mL; Versuch 2 und 3 ohne Anzeige; Anzeige überdeckt bei keiner geprüften Bildschirmgröße andere Beschriftungen.
- **Flaschen und Pipetten antippen:** Flaschen sind Klickflächen ohne Zusatzbeschriftung (Maus, Touch, Tastatur, synchron mit der Leiste); Pipette im Ständer wählt den Pipettentyp; die Klickflächen überlappen sich nicht (E16–E19).
- **Rühren:** Schalter an/aus (`aria-pressed`); Rührfisch dreht sich sichtbar (Bildänderung), Mischung schneller, Messwerte identisch (Unit-Test).
- **Teilchenmodell:** Legende HAc/Ac⁻ mit Namen und H₂O; in der Pufferlösung entsteht bei HCl-Zugabe sichtbar H₂O, im Wasser nicht (dort 7 freie H₃O⁺-Symbole nach 2 mL).
- **Versuch 3 ohne Sperre:** sofort zugänglich, Rechnen vor dem Herstellen bleibt (E11).

Befunde während der Prüfung (behoben und gezielt nachgeprüft):

| Befund | Ursache | Behebung |
| --- | --- | --- |
| E02: unzulässiger Begriff in ausgelieferter Datei | Code-Kommentar nannte die ¼×-Stufe „Zeitlupe“ | Kommentar umformuliert |
| E13 hing (Journal-Export) | mit der Playwright-Uhr löst Edge unter Windows keinen Download aus (Testumgebung; die App exportiert normal) | E13 läuft mit echter Uhr |
| E17/E18: Klickflächen überlappten bei 1180/1024 px | Mindestbreite der Pipetten-Klickflächen zu groß | Breite auf die Mitte zwischen Nachbarn begrenzt |
| Glasname bei 1024 px zu stark gekürzt | Platz für die Mengenanzeige | Platz zwischen Schild und Anzeige neu aufgeteilt; „Pufferlösung“ bei 1024 px leicht gekürzt, vollständig in der Teilchenkarte |

Pakete: `release/pufferfish-0.2.1-web.zip` (SHA-256 `0757a564b54875e311a74cf7906f3f73a8221f9d01b76dda7eab37127c4a08cc`), `release/pufferfish-0.2.1-scorm12.zip` (SHA-256 `63754fbc2a83b15362cb08eded8d5c33d70e8dce609802b0fd4beb35547fa64d`). Screenshot der Neuerungen: `docs/screenshots/14-versuch1-menge-ruehrfisch.png`.

## 0. Ausgangslage 0.1.0 (vor der Umsetzung)

`main` bei 98798c1, `apps/pufferfish/` 0.1.0. Ausgangsprüfung: `npm test` 31/31, `npm run test:e2e` 17/17 PASS (Chromium).

Gemessene Ist-Werte (Startansicht, Becherglashöhe in Bildschirmpixeln):

| Viewport | 0.1.0 Laborbild (Canvas) | 0.1.0 Becherglas | 0.1.0 Dosierleiste |
| --- | --- | --- | --- |
| 1440×900 | 592×289 px | **126 px** | 222 px hoch |
| 1180×820 | 436×248 px | 108 px | 311 px hoch |
| 1024×768 | 354×248 px | 91 px | 311 px hoch |
| 768×1024 | 746×338 px | 148 px | – |

Bekannte Mängel und Regressionsrisiken der Ausgangsfassung, die diese Fassung behebt bzw. absichert:

1. Reiterleiste im Bedienfeld breiter als das Bedienfeld (1440 px: 364 px statt 345 px; 1180/1024 px: 321 statt 299 px) – der letzte Reiter „Hefteintrag“ war abgeschnitten.
2. Schrittnavigation (Labor/Herleitung/Rechnen/Anwendungen) nur 40 px hoch (< 44 px Touchziel).
3. Dosierleiste: alle Mengenschaltflächen dunkel gefüllt (Aktion und Auswahl nicht unterscheidbar), Zugabe schon beim Antippen der Menge; keine Lösungswahl in der Dosierleiste, Flaschen nicht bedienbar.
4. pH-Kurve immer sichtbar neben zweiteiliger Teilchenzone und eigener Zeitlupenbühne; Laborbild klein.
5. Antwortlisten nicht gemischt: In den Erklärungsfragen x1–x3, q31 und den Anwendungen a1/a4 stand die richtige Antwort jeweils an erster Stelle.
6. Freitext „In eigenen Worten …“ ohne konkrete Frage; verpflichtende Vermutung vor dem ersten Tropfen; verdeckte Probe samt Aufdeckung.
7. Versuch 3 (Verhältnis und Reserve) und Versuch 4 (Verdünnung) entsprachen nicht dem neuen Lernweg.
8. NH₄⁺/NH₃ war nur eine Zahl (pKₛ in Aufgabe 5), kein experimentelles System im Solver.
9. Speicherstand `sivex.pufferfish.v1` mit Versuchen, die es nicht mehr gibt.

## 1. Modellannahmen Versuch 3 (Auszug, vollständig in [`CHEMIE.md`](CHEMIE.md))

Ideales Konzentrationsmodell bei 25 °C; beide Stammlösungen 0,100 mol/L, Gesamtvolumen 30,0 mL; Berechnung über Stoffmengen (n = c · V, n(A⁻)/n(HA) = 10^(pH − pKₛ)); NH₃(aq) als geschlossenes System ohne Flüchtigkeit; keine Aktivitäten; pKₛ ± 1 ist eine Faustregel. Der Messwert kommt ausschließlich aus dem Ladungsbilanz-Solver und wird nie an den Sollwert angepasst.

## 2. Unit-Tests (`npm test`): 60/60

**Chemisches Modell** (`tests/unit/chem.test.js`, 22 Tests). Die Erwartungswerte stammen aus geschlossenen Formeln bzw. aus **unabhängig implementierten** numerischen Verfahren (andere Wurzelsuche, andere Parametrisierung), nicht aus `chem.js`:

- Wasser, Essigsäure, Natriumacetat, Acetatpuffer, Aufgabe 4, Phosphat (Bilanzresiduen, Mehrprotonigkeit), ganze Zugabekurven, Verdünnung, Grenzfälle, Reaktionsweg, Indikatorfarben – unverändert aus 0.1.0 und weiter PASS.
- **Ammonium/Ammoniak:** Start-pH gegen die kubische Gleichung h³ + (K + m − x + C)h² + ((m − x)K − Kw)h − Kw·K = 0 (Wurzel mit eigener Bisektion in h) für sechs Zusammensetzungen (|Δ| ≤ 10⁻⁶); NH₄Cl 0,100 mol/L ≈ 5,13 und NH₃ 0,100 mol/L ≈ 11,13 (pKₛ(NH₄⁺) direkt, nicht aus pK_B abgeleitet); Ladungs- und Massenbilanz-Residuen (relativ < 10⁻⁹) und Referenz für 0–60 mL HCl bzw. NaOH; formale Bilanz (NH₄⁺ = n(Cl⁻) − n(Na⁺), Überschuss, `hh` liefert `null` ohne Partner).
- **Phosphat gegen Brent-Verfahren** mit α-Anteilen aus kumulierten pKₛ (|Δ| ≤ 10⁻⁸); **Acetat gegen die kubische Gleichung**.
- **Versuch 3, Standardaufgaben** (30 mL, 0,100 mol/L): Solver ↔ unabhängige Referenz ≤ 0,02 pH **und** Solver ↔ Ziel-pH ≤ 0,05 pH (P12); vertauschte Volumina und zu wenig Base ändern den pH-Wert nachweisbar; 1 : 1-Mischung bei pKₛ; Gleichgewichtsmengen ≈ formale Mengen über den ganzen Bereich pKₛ ± 1.
- `assessTarget`/`suitableSystems`: Randlage, Zurückweisung, Lücke zwischen den Systemen; `STOCKS`: Stoffmengen je mL, unbekannte Lösung wird abgewiesen; genau drei Systeme, kein Carbonat.

Ergebnis der Standardaufgaben (`planMix`, `mixComp`, `solve`; Referenz = Brent bzw. kubische Gleichung):

| Ziel-pH | System | V(Säure) / V(Base) | Solver | Referenz | \|Solver − Referenz\| | H-H | Solver − Ziel | mit ganzen mL (10/20 bzw. 20/10) | Volumina vertauscht |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5,05 | Acetat | 10,016 / 19,984 mL | 5,0502 | 5,0502 | 3 · 10⁻¹⁴ | 5,0500 | +0,0002 | 5,0512 | 4,451 |
| 6,90 | Phosphat | 19,984 / 10,016 mL | 6,9000 | 6,9000 | 2 · 10⁻¹⁴ | 6,9000 | 0,0000 | 6,8990 | 7,500 |
| 9,55 | Ammonium/Ammoniak | 10,016 / 19,984 mL | 9,5493 | 9,5493 | 2 · 10⁻¹⁴ | 9,5500 | −0,0007 | 9,5503 | 8,950 |

Die Übereinstimmung Solver ↔ Referenz bis 10⁻¹⁴ bedeutet: Die Zahlen werden korrekt berechnet. Sie bedeutet **nicht**, dass das ideale Modell reale Lösungen trifft (Aktivitäten, Flüchtigkeit von NH₃ – siehe CHEMIE.md, Abschnitt 5). Die geforderten Toleranzen (0,02 bzw. 0,05) werden eingehalten; eine `HOLD – failed`-Einstufung von P12 war nicht nötig.

**Zustandsablauf** (`tests/unit/engine.test.js`, 21 Tests): drei Versuche, Versuch 4 nicht erreichbar; erst Ankunft, dann Mischphase, dann Messpunkt; Doppelklick erzeugt keine zweite Dosierung und kein Wechsel während der Zugabe; Lösung → Pipette → Menge als ein Zustand; Säure-/Laugenreihe getrennt, Gegenprobe, nichts wird überschrieben; neue Reihe, frische Probe; Weiterdosieren ohne NaN; Pause/Schritt; Weltbreite; **Versuch 3:** nur Messpipette und Stammlösungen (keine HCl/NaOH-Vorauswahl), kein pH-Wert vor dem Messen, Messwert = Modell, weitere Zugabe verwirft den Anzeigewert, falsches Verhältnis verändert den Messwert, drei Standardaufgaben, Systemwechsel, Experimentwechsel; zweites Messen am unveränderten Glas und Systemwechsel während der Messung werden abgewiesen; Speichern (Version 2) mitten in einer Zugabe, **0.1.0-Speicherstand wird abgewiesen und lässt den Zustand unverändert**, Wiederherstellen von Versuch 3.

**Lerninhalte und Bewertung** (`tests/unit/learn.test.js`, 17 Tests): Zahlenlesen; alle sechs Aufgaben mit getrennter Fehlerdiagnose; Beobachtungen nur mit eigener Messung belegt; **keine Vermutung, kein „Wunderwasser“** in den Lerninhalten; Leitfragen mit Erwartung und Hinweis „wird nicht bewertet“; **stabile gemischte Antwortreihenfolge** (gleicher Seed → gleiche Reihenfolge, gespeichert, Permutation, Bewertung unabhängig von der Position); **Verteilung der richtigen Antwort über 600 Sitzungen** je Frage innerhalb ±0,07 der Erwartung (nicht systematisch an erster Stelle); Zielwert- und Systemmeldungen; Prüfung der Schülerrechnung (Quotient vertauscht, Logarithmus, Säure/Base vertauscht, Summe, Format, Bereich; Phosphat mit r < 1); Auswertung mit konkreter Ursache (Volumina, Gesamtvolumen, Rechenfehler, fehlender Partner).

Labkit-Tests (5, `shared/labkit`) laufen unverändert mit: 5/5.

## 3. Browserprüfung (`npm run test:e2e`): 24/24

Chromium 153 über Playwright 1.63.0, gegen den gebauten Stand `dist/pufferfish`. Die Tests bedienen nur die Oberfläche (Klicks, Tipps, Tastatur); der Modellzustand wird ausschließlich gelesen. Zugaben laufen über die Playwright-Uhr (`page.clock`) etwa dreimal schneller als in Echtzeit; Animationen, `requestAnimationFrame` und Mischzeiten sind dieselben Abläufe. Laufzeit des Gesamtlaufs: 3 min 55 s.

| ID | Kriterium | Prüfung | Ergebnis |
| --- | --- | --- | --- |
| E01 | – | Logo pumpt sich beim Start auf (Skalierung 1,36), endet wieder, per Klick und Enter erneut auslösbar, keine Layoutsprünge; mit `prefers-reduced-motion` keine Animation | PASS |
| E02 | P01, P02, P03 | Frische Sitzung: genau drei Versuchsknöpfe; „A · Wasser“ und „B · Pufferlösung“ von Beginn an; kein Vermutungsformular; erste Zugabe ohne jede Vorabantwort; Textsuche (sichtbarer Text **und** aria-label/title/placeholder) in Labor, allen Reitern, allen Versuchen und Seiten sowie in den ausgelieferten Dateien: keine Treffer für Verdünnung, Wunderwasser, Vermutung, Zeitlupe | PASS |
| E03 | P05 | Flasche antippen ↔ Umschalter HCl/NaOH synchron (Maus, Touch, Enter/Leertaste, in beide Richtungen); Reihenfolge Lösung → Pipette → Menge → Ziel → Zugabe in DOM und Anzeige; genau eine Auswahl je Gruppe; ausgewählt dunkel (Leuchtdichte < 0,2), nicht ausgewählt hell (> 0,85); alle Touchziele ≥ 44 × 44 px; während der Zugabe `disabled` (abgeblendet, gestrichelt) ≠ nicht ausgewählt, kein Wechsel der Lösung | PASS |
| E04 | P05, P14 | Laugenreihe mit frischen Ansätzen (Hinweis), Säurereihe bleibt erhalten, mehrfaches Umschalten überschreibt nichts; Gegenprobe im Umschalter, im Bühnenhinweis und in der Ergebnisliste gekennzeichnet; frische Laugenreihe bleibt erhalten | PASS |
| E05 | P07, P14 | Versuch 1: Tropfen im Flug ohne Gleichgewichtsanzeige, Glas A vor Glas B, Mischstatus, Schliere; Messwerte = Modell (Wasser 3,779, Pufferlösung 7,197); **ein** Teilchenmodell mit Legende (H₂PO₄⁻, HPO₄²⁻, H₃O⁺, OH⁻) und Hinweis „nicht maßstäblich“; keine Zeitlupenelemente oder -funktionen; Symbolzahlen = Modell (HPO₄²⁻ > H₂PO₄⁻ nach NaOH) | PASS |
| E06 | P02, P07, P14 | Versuch 2 ohne Vorabantwort: Startwerte 2,88 / 8,88 / 4,75; Messwerte = Modell für Säure und Lauge; Essigsäure setzt NaOH um, Natriumacetat nimmt HCl auf (keine „reagiert nicht“-Aussage); Legende CH₃COOH/CH₃COO⁻ | PASS |
| E07 | P06 | pH-Kurve beim Start verborgen (Teilchenmodell gewählt); Kurve ersetzt das Teilchenmodell auf **derselben Fläche**; Laborbild unverändert; dosieren → wechseln → dosieren → zurück → wechseln: alle 8 Messpunkte, auch als Pixel im Kurvenbild; mehrfaches Umschalten ohne Verlust; Auswahl je Versuch | PASS |
| E08 | P04 | 1440×900: Becherglas **179 px** statt 126 px (+42 %, gefordert ≥ +25 %); jede Elektrode mit sichtbarem „pH-Messelektrode“; alle Schilder im Laborbild, ohne Überdeckung untereinander; pH-Anzeige unter dem zugehörigen Glas; Laborbild größer als die Zusatzansicht | PASS |
| E09 | P08, P09 | Leitfragen Versuch 1/2 mit Erwartung und Hinweis; Antwortreihenfolge stabil nach Reiterwechsel, „Antworten prüfen“ und **Neuladen**; Bewertung nach Antwort-ID (richtig/falsch/teilweise, Mehrfachauswahl in beliebiger Reihenfolge); Freitext unbewertet im Journal; **12 Sitzungen**: richtige Antwort nicht systematisch an erster Stelle, im letzten Lauf 19 % statt ≈ 29 % Erwartung (Seed je Sitzung zufällig) | PASS |
| E10 | P14, P08 | Herleitung erst nach der Deutung freigeschaltet; Fehler markiert, Tipps; alle sieben Schritte; **Versuch 3 danach offen, Anwendungen weiter von den sechs Aufgaben abhängig**; formale Stoffmengen und H-H-Vergleich an den Proben, pKₛ ± 1 im Diagramm; Rechenweg nur nach Rückfrage; Fehlerarten getrennt erkannt; alle sechs Aufgaben | PASS |
| E11 | P10, P05 | Versuch 3 vor der Herleitung gesperrt; Systemwahl und Rechnung zuerst: Acetat und Ammonium für pH 6,90 abgewiesen (Faustregel pKₛ ± 1), Phosphat akzeptiert; 5,95 (Lücke), 12 und „abc“ zurückgewiesen, 4,3 akzeptiert; keine HCl/NaOH, nur Messpipette; Zugeben erst nach der Rechnung (Hinweis, abgeblendet); Fehlerursachen benannt; keine Lösung vorweggenommen; **Formel in jeder Phase sichtbar** | PASS |
| E12 | P10, P11, P12, P13 | Versuch 3 für **pH 5,05 / 6,90 / 9,55**: Diagramm folgt den tatsächlich zugegebenen Stoffmengen (auch im Zwischenzustand während der Dosierung, „kein Puffer“ bei einem Partner); kein pH-Wert vor dem Messen; Messwert = Modell (5,051 / 6,899 / 9,550) innerhalb 0,05; Gegenüberstellung Rechnung/Volumina/Messwert/Abweichung; Kurve ersetzt das Diagramm, Formel bleibt sichtbar, Punkt im Bild; zu viel Base → höherer Messwert mit Ursache; Fragen, Journal, „Neu ansetzen“ | PASS |
| E13 | P09, P14 | Journal mit Leitfrage und unbewerteter Antwort, ohne Musterlösung; Export; Hefteintrag; Anwendungen (vier Fälle) | PASS |
| E14 | P14 | Neuladen stellt Messreihen, Antworten, Auswahl, Kurvenansicht und Versuch 3 (System, Rechnung, Messwert) wieder her; **0.1.0-Speicherstand bleibt unverändert** und wird ignoriert | PASS |
| E15 | P14 | Doppelklick + Klick → genau eine Zugabe; Lösungswechsel während der Zugabe abgewiesen; Pause friert Tropfen und Zeit ein; Dosieren in der Pause abgewiesen; „Schritt“ = 0,2 s; Strahl der Messpipette und steigender Füllstand | PASS |
| E16–E19 | P15 | 1440×900, 1180×820, 1024×768, 768×1024 (die drei letzten mit Touch-Emulation): kein Querscrollen; **jedes** Bedienelement (Dosierleiste, Flaschen, Umschalter, Versuchsknöpfe, Schrittnavigation, Reiter) sichtbar, nicht überdeckt (`elementFromPoint`), ≥ 44 px; Labor- und Zusatzansicht nutzbar; alle Schilder im Laborbild ohne Überdeckung; Versuch 1 und Versuch 3; Formel im sichtbaren Bereich; Herleitungsseite ohne Querscrollen | PASS |
| E20 | P05, P14 | Tab/Enter wählt Lösung und Menge und dosiert; Trennlinie mit Pfeiltaste +24 px, Doppelklick setzt zurück; sichtbarer Fokus | PASS |
| E21 | P14, P15 | Zufallsbedienung mit festem Seed (Versuche 1–3, Reiter, Seiten, Zurücksetzen, Eingaben inkl. Unsinnswerten): keine Seiten- oder Konsolenfehler | PASS |
| E22 | P05, P14 | Ziel-/Systemwechsel während Zugabe **und Messung** abgewiesen, Zeitschleife läuft weiter, UI und Engine bleiben gleich; zweites Messen abgewiesen; geänderte Rechnung verwirft das alte Prüfergebnis; bei Gegenprobe zeigen Flaschen und Umschalter denselben Zustand | PASS |
| NET | P16 | alle Anfragen lokal | PASS |
| CON | P15 | keine Konsolen- oder Seitenfehler | PASS |

Becherglashöhe in Bildschirmpixeln, gemessen mit dem 0.1.0- und dem 0.2.0-Build:

| Viewport | 0.1.0 | 0.2.0 | Änderung |
| --- | --- | --- | --- |
| 1440×900 | 126 px | 179 px | **+42 %** |
| 1180×820 | 108 px | 158 px | +46 % |
| 1024×768 | 91 px | 141 px | +55 % |
| 768×1024 | 148 px | 188 px | +27 % |

Hinweis: Die Tablet-Prüfungen sind **Geräteemulationen in Chromium**, kein Test auf einem echten iPad mit Safari. Auf kleinen Tablets liegt die Zusatzansicht unterhalb von Laborbild und Dosierleiste (Bühne scrollbar); Laborbild und Bedienelemente sind dort ohne Scrollen erreichbar.

Ersetzte und beibehaltene Alt-Tests (P14): Logo (E01), Reihen/Gegenprobe (E03 → E04), Schnellbedienung (E08 → E15), Neuladen (E09 → E14), Herleitung/Rechnen (E10, E11 → E10), Anwendungen/Journal (E12 → E13), Tablet (E13, E14 → E17, E18), Tastatur/Trennlinie (E15 → E20) bleiben erhalten oder sind angepasst; die Szenarien zu Vermutung, Wunderwasser-Aufdeckung, Zeitlupe, Versuch 3 (alt) und Versuch 4 (Verdünnung) sind durch E02, E05–E07, E09, E11 und E12 ersetzt.

## 4. Pakete (`npm run package`, `npm run test:scorm`): 17/17

Beide ZIPs werden frisch in leere Temp-Ordner entpackt und von dort über HTTP gestartet; der Quellcodeordner wird nicht benutzt.

- `imsmanifest.xml` im Paketstamm, SCORM 1.2, SCO mit Startpunkt `index.html`; Manifest listet alle 17 Dateien (inkl. `labkit/`); alle 15 Verweise relativ und vorhanden; Web-ZIP enthält dieselben Laufzeitdateien; `SHA256SUMS.txt` nennt beide Pakete.
- Mock-LMS eingebettet (iframe) und „Neues Fenster“: `LMSInitialize` genau einmal, `LMSFinish` beim Schließen genau einmal, keine `LMSGetValue`/`LMSSetValue`/`LMSCommit` (keine Noten, Antworten, Personendaten); **Versuch 1 und Versuch 3 über die Oberfläche bedient**, Messwerte korrekt; keine Konsolenfehler, keine externen Anfragen.
- Web-ZIP über HTTP und per `file://` bedienbar (ebenfalls mit Versuch 3), keine fremden Anfragen; alle Ressourcen aus den entpackten Paketen geladen.

| Paket | Größe | SHA-256 |
| --- | --- | --- |
| `release/pufferfish-0.2.0-web.zip` | 93,2 KiB (95 479 Byte) | `3b09bd41706f6d0674938c9a05b2aed6d19c5841c1d291b89bb718e0f6ab5192` |
| `release/pufferfish-0.2.0-scorm12.zip` | 93,6 KiB (95 806 Byte) | `f9b7f43f87c69d531b476a643108d4215f36747fb8cfc9fb3908ff2343c4e50b` |

Das Paket `0.1.0` wurde aus `release/` entfernt und bleibt über die Git-Historie (`main`, 98798c1) erhalten.

## 5. Abnahmekriterien P01–P16

| ID | Status | Beleg |
| --- | --- | --- |
| P01 | **PASS** | E02: drei Versuchsknöpfe, Metadaten (`EXPERIMENTS` = e1–e3), keine erreichbare Verdünnung (Textsuche in Oberfläche und Dateien); Unit-Test „Genau drei Versuche“: `selectExperiment('e4')` wird abgewiesen |
| P02 | **PASS** | E02, E06: frische Sitzung, HCl/NaOH wählen, erste Zugabe ohne Vermutung (Versuch 1 und 2) |
| P03 | **PASS** | E02: „A · Wasser“, „B · Pufferlösung“ von Beginn an (Schilder, Teilchenmodell); Textsuche inkl. Attributtexten und ausgelieferter Dateien ohne „Wunderwasser“; Screenshots `01`, `02`, `04` |
| P04 | **PASS** | E08, E16–E19: Becherglas 179 px statt 126 px (+42 %); „pH-Messelektrode“ sichtbar an jeder Elektrode; Schilder ohne Überdeckung; Screenshots `01`, `vorher-0.1.0/01` |
| P05 | **PASS** | E03, E04, E20: Flasche und Umschalter synchron (Maus/Touch/Tastatur), Reihenfolge, nur Gewähltes dunkel, `aria-pressed`, disabled ≠ nicht ausgewählt |
| P06 | **PASS** | E07 (Versuch 1/2), E12 (Versuch 3): Kurve beim Start verborgen, ersetzt die Zusatzansicht, verlustfrei, alle Messpunkte (auch pixelweise) |
| P07 | **PASS** | E05, E06: eine Teilchenmodell-Ansicht mit Legende, keine Zeitlupe (DOM und Code); E12: Verhältnisdiagramm in Versuch 3 |
| P08 | **PASS** | E09, E10 und Unit-Tests: stabile gemischte Reihenfolge (Rerender, Neuladen, 12 Browser-Sitzungen, 600 Seeds je Frage), Bewertung nach Antwort-ID, Mehrfachauswahl |
| P09 | **PASS** | E09, E13, E12: konkrete Leitfragen, Erwartung sichtbar, unbewertet im Journal und Export |
| P10 | **PASS** | E11, E12: Versuch 3 beginnt mit Systemwahl und Rechnung; Formel über der Bühne in beiden Zusatzansichten sichtbar; Screenshots `05`–`08` |
| P11 | **PASS** | Unit-Tests: NH₄⁺/NH₃ im Solver mit Stoff- und Ladungsbilanz, unabhängige Referenzen (kubische Gleichung, Brent), positive und negative Fälle, Grenzfälle; Abschnitt 2 |
| P12 | **PASS** | Unit-Tests und E12: pH 5,05 / 6,90 / 9,55 bei 0,100 mol/L, 30 mL: Solver ↔ Referenz ≈ 10⁻¹⁴ (≤ 0,02), Solver ↔ H-H-Sollwert ≤ 0,0007 (≤ 0,05); abweichende Mischung ändert den Wert (4,45 / 7,50 / 8,95; im Browser zu viel Base → höher) |
| P13 | **PASS** | E12: Diagramm liest echte Stoffmengen (Säulen = `pairAmounts`, auch im Zwischenzustand), HA/A⁻, Zahlen, Legende; Messung erst nach „Mischen und pH messen“ |
| P14 | **PASS** | E04, E10, E13–E15, E20–E22, SCORM-Test, 60 Unit-Tests; veraltete V3-/V4-/Zeitlupen-Tests ersetzt (Abschnitt 3) |
| P15 | **PASS** | E16–E19 (1440×900, 1180×820, 1024×768, 768×1024; Touch-Emulation), CON ohne Konsolenfehler; Screenshots `09`–`11` |
| P16 | **PASS** | Abschnitt 2–4: `npm test`, `npm run package`, `npm run test:e2e`, `npm run test:scorm` erfolgreich; beide ZIPs frisch entpackt geprüft; Prüfsummen und Dokumentation vollständig; PR: https://github.com/sscheidl/SiVex/pull/33 |

Es gibt keine `HOLD – failed`- oder `HOLD – incomplete`-Punkte. **P12-Interpretation:** Die Toleranzen waren fachlich haltbar; der Solver wurde nicht angepasst.

## 6. Visuelle Kontrolle

Alle Screenshots (`docs/screenshots/`) wurden nach dem letzten Lauf angesehen. Vorher-Bilder von 0.1.0: `docs/screenshots/vorher-0.1.0/`.

| Phase | Vorher (0.1.0) | Nachher (0.2.0) |
| --- | --- | --- |
| Start Versuch 1 (1440×900) | `vorher-0.1.0/01-start-versuch1.png` | `01-start-versuch1.png` |
| Versuch 1 nach Zugabe | `vorher-0.1.0/02-tropfen-im-flug.png`, `04-zeitlupe-protonenuebertragung.png` | `02-versuch1-nach-zugabe.png` |
| pH-Kurve | `vorher-0.1.0/03-kurve-saeurereihe.png` | `03-versuch1-ph-kurve.png` |
| Versuch 2 | `vorher-0.1.0/05-versuch2-saeure.png` | `04-versuch2-nach-zugabe.png` |
| Versuch 3: Rechenphase | `vorher-0.1.0/06-versuch3-verhaeltnis-reserve-alt.png` (alter Versuch 3) | `05-versuch3-rechnung.png` |
| Versuch 3: Mischphase (Diagramm) | – | `06-versuch3-mischen-ac.png`, `…-ph.png`, `…-am.png`, `06-versuch3-mischen-1440x900.png` |
| Versuch 3: Messung, pH-Kurve | – | `07-versuch3-messung.png`, `08-versuch3-ph-kurve.png` |
| Tablet | `vorher-0.1.0/07-tablet-1180x820.png`, `08-tablet-1024x768.png` | `09-tablet-1180x820.png`, `10-tablet-1024x768.png`, `11-tablet-768x1024.png` |
| Herleitung, Aufgaben | – | `12-herleitung.png`, `13-aufgaben.png` |
| Pakete | – | `50-scorm-iframe.png`, `50-scorm-popup.png`, `51-web-zip-http.png` |

**Unabhängige Code-Durchsicht:** Ein getrennter Prüfer (ohne Kenntnis der Entwicklungsschritte) fand vier bestätigte Fehler, alle behoben und durch Tests abgesichert: (1) Zielwechsel während einer Messung ließ die Zeitschleife abbrechen (Dauer-Einfrieren) – Wechsel wird jetzt abgewiesen, die Zeitschleife fängt Bildfehler ab; (2) UI und Engine konnten bei Wechsel während einer Zugabe auseinanderlaufen; (3) altes Prüfergebnis der Rechnung blieb nach geänderter Eingabe stehen; (4) Flaschenschalter und Umschalter widersprachen sich bei Gegenprobe. Ferner: doppelte Messzeilen, zu enge Rundungstoleranzen am Rand des Pufferbereichs, veraltete Auswertungskarte nach „Neu ansetzen“. Die Durchsicht ist eine Modell-Review, kein Ersatz für die Lehrkraftprüfung.

Befunde während der Entwicklung (behoben und gezielt nachgeprüft):

| Befund | Behebung |
| --- | --- |
| Reiterleiste des Bedienfelds breiter als das Bedienfeld (auch in 0.1.0) | Reiter teilen sich die Breite, kleinere Schrift |
| Schilder verdeckten bei kleinem Maßstab den Fuß der Gläser | fester Streifen unter der Tischkante für Schilder und Flaschenschalter |
| Flaschenschalter am linken Rand abgeschnitten, Schild A überdeckte Schild B (1024 px) | Schalter nie über den Rand, Schildbreite an Nachbarabstand und Flaschenschalter angepasst |
| „Neu ansetzen“ in Versuch 1/2 sichtbar (`hidden` von `.lk-btn` überstimmt) | `[hidden]` erzwingt `display: none` |
| Dosierleiste brach auf Tablets in drei Zeilen um | Dosierschritte und Hilfen laufen in einem Fluss; Farbskala ohne Beschriftung auf Tablets |
| Schrittnavigation 40 px hoch | 44 px |
| Zielschaltflächen blieben während der Zugabe bedienbar | gesperrt wie die übrigen Auswahlfelder |
| Ablehnung eines eigenen Ziel-pH setzte das bisherige Ziel zurück | bisheriges Ziel bleibt, Hinweis unter dem Eingabefeld |
| Hefteintrag 160 Wörter | Hinweis zum Herstellen gekürzt (152 Wörter inkl. Gleichungen) |

## 7. Bekannte Grenzen

1. **Echtes Schul-iPad (Safari):** nicht geprüft (`HOLD – unverified`). Touch-, Layout- und Pixelprüfungen wurden nur in Chromium mit Touch-Emulation und Viewport-Größen durchgeführt.
2. **mebis-Import** des SCORM-Pakets: nicht geprüft (`HOLD – unverified`); nur Mock-LMS.
3. **Fachlich-didaktische Freigabe** durch die Lehrkraft (Formulierungen der Leitfragen und Rückmeldungen, Wahl der Parameter, Umfang des Versuchs 3): ausstehend (`HOLD – unverified`).
4. Modellgrenzen: ideale Lösungen ohne Aktivitäten, NH₃ ohne Flüchtigkeit, 25 °C; pKₛ ± 1 als Faustregel; Standardaufgaben bei 0,100 mol/L und 30,0 mL fest vorgegeben (CHEMIE.md, Abschnitte 1–2 und 5).
5. Auf Tablets unter 1100 px Breite liegt die Zusatzansicht unterhalb des sichtbaren Bereichs (Bühne scrollen); Labor, Dosierleiste und Formel sind ohne Scrollen sichtbar.
6. Der Speicherstand von 0.1.0 wird nicht übernommen (bewusst; Versuche und Proben der Vorversion existieren nicht mehr).
7. Browser außer Chromium (Edge, Firefox, Safari) wurden in dieser Umgebung nicht getestet; die Tests laufen mit Edge, wenn `PW_CHANNEL=msedge` gesetzt ist.

## 8. Reproduktion

```bash
cd apps/pufferfish
npm install                 # nur Playwright; PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1, wenn ein Browser vorhanden ist
npm test
npm run package
npm run test:e2e
npm run test:scorm
```
