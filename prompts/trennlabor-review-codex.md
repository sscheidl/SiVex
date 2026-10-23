# Prüfauftrag an Codex: Trennlabor 1.0.0 – Vergleich zweier Fassungen

Prüfe zwei unabhängig entstandene Umsetzungen desselben Auftrags [`prompts/trennlabor-v1.0-claude-code.md`](trennlabor-v1.0-claude-code.md) (Masterauftrag, verbindlicher Maßstab). Beide stammen aus Claude-Code-Sitzungen; die zweite entstand nach einem Absturz der Desktop-App, der den Auftrag neu gestartet hat. Ziel ist **nicht** die Wahl eines Siegers um jeden Preis, sondern eine belastbare Grundlage, um **eine Fassung als Basis zu nehmen und die besten Teile der anderen zu übernehmen**.

| | Fassung A | Fassung B |
| --- | --- | --- |
| Branch | `ccr-ade6cdbf-5npcyu` (PR #9, geschlossen) | `trennlabor/v1.0` (PR #11, offen) |
| App-Commit | `486f370` | `a5d6d0e` |
| Code-Aufbau | `js/model/`, `js/tasks/`, `js/render/`, `js/session.js`, Canvas 2D | `js/classic.js`, `chroma.js`, `distill.js`, `tasks.js`, `render-*.js`, `gfx.js`, Canvas 2D |
| Web-ZIP SHA-256 | `dbd97d17…` | `bf076f62…` |
| SCORM-ZIP SHA-256 | `9091228e…` | `a25ff04a…` |
| Laut Testbericht | Unit 79, Browser 28, SCORM 9, Web-ZIP 6 + `file://` | Unit 71, Browser 23, SCORM/Paket 10 |

Die vollständigen Prüfsummen stehen jeweils in `apps/trennlabor/release/SHA256SUMS.txt`. PR #10 (`feat/trennlabor`, SVG) ist ein verworfener früherer Versuch und **nicht** Prüfgegenstand.

## Rahmen

- **Nur prüfen, nichts an den Apps ändern.** Keine Commits auf die beiden Branches, keine neuen Release-ZIPs. Die Pakete 1.0.0 werden parallel in mebis getestet und dürfen nicht überschrieben werden.
- Ergebnis als Bericht auf einem eigenen Branch `review/trennlabor-vergleich` (von `main`): `docs/reviews/trennlabor-vergleich-<Datum>.md` plus Screenshots in einem Unterordner. Kein Merge.
- Titrations- und Redoxlabor sowie andere Apps nicht anfassen. Offline-Anforderung gilt auch für Testwerkzeuge im Paket (kein CDN, keine Analytik).
- Jeder Befund braucht einen **reproduzierbaren Nachweis**: Schrittfolge in der Oberfläche oder Unit-Test/Skript, erwartetes und tatsächliches Verhalten, Screenshot bzw. Zahlenwerte. Behauptungen der Testberichte nicht übernehmen, sondern selbst nachvollziehen.
- Fachliche Aussagen mit zuverlässigen Quellen belegen. Vereinfachungen, die der Masterauftrag ausdrücklich erlaubt (z. B. Azeotrop vernachlässigt), nicht als Fehler werten, wenn sie dokumentiert und nicht falsch unterrichtet sind.

## Vorgehen

1. Beide Branches auschecken. Je `npm install`, `npm test`, `npm run build`, `npm run package`, `npm run test:e2e`, `npm run test:scorm` (in A zusätzlich `npm run test:webzip`) ausführen und Ergebnisse protokollieren. Prüfen, ob ein erneutes Paketieren inhaltsgleiche ZIPs ergibt (B wurde unter Windows gebaut, Zeilenenden beachten) und ob die eingecheckten ZIPs zu `SHA256SUMS.txt` passen.
2. Die **fertigen ZIPs** beider Fassungen entpacken und im Browser bedienen (Desktop 1440×900, Tablet-Touch 1180×820 und 1024×768), Web-ZIP auch per `file://`. SCORM-ZIP in einem einfachen Mock-LMS starten (eingebettet und neues Fenster); keine `cmi`-Schreibzugriffe außer Initialize/Finish erwartet.
3. Alle Pflichtversuche in beiden Fassungen **selbst** durchspielen: K-01 bis K-05, Chromatographie C-1 bis C-3 und Rf im Expertenmodus, Destillation D-1 mit Brennprobe. Je Versuch mindestens einen korrekten Weg und die verbindlichen Fehler aus Abschnitt 3 des Masterauftrags.
4. Code lesen: Trennung Modell / Steuerung / Darstellung / UI, Mengenbilanz, feste Zeitschritte, Zustand vs. Darstellung, Fehlerbehandlung, Lesbarkeit und Wartbarkeit.

## Prüfdimensionen (je Fassung PASS/HOLD mit Nachweis)

1. **Pflichtmatrix** A-01 bis T-08 (Abschnitt 6.1) und die 22 E2E-Szenarien (6.2) – unabhängig nachgeprüft, nicht abgeschrieben.
2. **Fachlichkeit:** Stoffmodelle, Mengen und Phasen, Löslichkeit Kochsalz, Scheidetrichter-Volumen und Schichtfolge, Extraktion kalt/heiß, Chromatographie-Datensatz (7 Proben, Laufmittel, Rf, unlöslicher Farbstoff, gemeinsame Komponente Grün/Violett), Destillationsmodell (stetige Temperatur- und Zusammensetzungsänderung, kein Sprung 78 → 100 °C, Bilanz), Brennprobe-Schwellen, Theorie- und Hefteintragstexte (Adsorption, Vorbehalt „eine Bande ≠ Reinstoff“).
3. **Abläufe und Zustandslogik:** freie Reihenfolge, irreversible Verluste, Korrektur ohne Zwangsneustart, Sicherheitsstopps und Wiederaufnahme, Erfolg am tatsächlichen Zustand, Auswertung bezogen auf den eigenen Versuch, Freischaltung von Theorie/Hefteintrag erst nach Erfolg, „Neu beginnen“ nur für den aktuellen Versuch, Sitzungspersistenz.
4. **Hilfe** in genau drei Stufen, zustandsabhängig, Angebot nach wiederholtem Scheitern.
5. **Lückentexte ohne KI:** Synonyme, Umlaute, Tippfehlertoleranz, gezielte Ablehnung (Absorption), keine Falsch-Positiven bei grob falschen Antworten.
6. **Zeit:** Pause, Zeitraffer „sinnvoll begrenzt“, identische Ergebnisse und Bilanzen bei allen Zeitraffer-Stufen (z. B. gleicher Versuch bei 1× und Maximum vergleichen).
7. **Grafik und Animation:** realistische Proportionen und Skalierung, Lesbarkeit der Thermometer- und Messanzeigen, kontinuierliche zustandsgekoppelte Animationen (Tropfen, Spiegel, Sediment, Phasengrenze, Laufmittelfront, Dampf/Kondensat, Flamme), keine vorgezeichneten Ergebnisse, Stabilität bei Zeitraffer.
8. **Bedienung:** Tippen/Klicken als vollständige Alternative zum Ziehen, Tastatur und Fokus, Touch-Zielgrößen, einklappbares Bedienfeld, nichts abgeschnitten auf 1024×768, verständliche Rückmeldungen.
9. **Technik und Pakete:** keine externen Ressourcen, keine Netzzugriffe, Konsolenfehler, SCORM-Manifest, relative Pfade, `file://`, Paket-Reproduzierbarkeit.
10. **Tests:** Aussagekraft und Lücken der Test-Suites (prüfen sie Verhalten oder nur Existenz?), fehlende Regressionstests.

## Konkrete Prüfhypothesen

Diese Punkte sind beim Vergleich aufgefallen und **ausdrücklich zu verifizieren oder zu widerlegen** – sie sind keine feststehenden Befunde:

- **Laufmittel:** A verwendet Ethanol-Wasser 7 : 3, B 1 : 1. Welche Wahl ist mit dem Datensatz und typischen Schulversuchen besser begründet, und erfüllt Probe 7 (wasserfester Stift) jeweils die Vorgabe?
- **Destillation:** A 40 % Ethanol, Heizpilz mit Stufen; B 30 %, Heizplatte, Füllmengen 25/100/175 mL. Ist bei beiden „zu geringe Kühlung → weniger Kondensat bzw. Dampfverlust“ (Masterauftrag 3C) im Modell wirksam? B soll ungefährliche Fehler (Kühlung, Thermometer, Vorlage) weiterlaufen lassen – entsteht dabei trotzdem unbegründet gleich viel Destillat?
- **Thermometer falsch positioniert:** Wird ein unbrauchbarer Messwert erzeugt und in der Auswertung erkannt (B: Anzeige z. B. 86 % des Anstiegs)?
- **Zeitraffer:** A 1×/4×/10×, B 1×/5×/20×/50×. Ist 50× noch „sinnvoll begrenzt“, und bleiben bei 50× Bilanzen, Sicherheitsstopps und sichtbare Übergänge korrekt?
- **Brennprobe:** A Schwellenmodell, B ≥ 55 % brennt / 40–55 % flackert. Fachlich gegen Literatur prüfen.
- **Scheidetrichter, Hahn-Zwischenstellung, Mischfraktion, Stopfen/Unterdruck:** in beiden Fassungen gleichwertig?
- **Momentaufnahme bei Erfolg:** Wird der Erfolg erst festgehalten, wenn kein Vorgang mehr läuft (z. B. kein Gießen/Tropfen)?

## Lieferung

1. **Zusammenfassung** (max. eine Seite): Empfehlung, welche Fassung **Basis** wird, und warum.
2. **Vergleichstabelle** je Prüfdimension: A und B mit PASS/HOLD, Kurzbegründung, Nachweis-Link.
3. **Befundliste** je Fassung mit ID, Schwere (blockierend / wichtig / gering), Reproduktion, erwartetem und tatsächlichem Verhalten, Nachweis.
4. **Übernahmeliste „das Beste aus beiden“:** welche konkreten Teile der Nicht-Basis-Fassung übernommen werden sollten (Modellregel, Darstellung, Bedienweg, Test, Text), mit Datei/Funktion, Aufwandsschätzung und Risiko.
5. **Liste der ausgeführten Befehle** mit Ergebnissen sowie Browser- und Playwright-Version. Was nicht geprüft werden konnte (z. B. echtes iPad/Safari, echter mebis-Kurs), ausdrücklich als nicht geprüft kennzeichnen.

Falls die Lehrkraft Befunde aus ihrem mebis-Test dokumentiert hat, diese einbeziehen und der jeweiligen Fassung zuordnen.
