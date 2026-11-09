# Änderungen

## 3.2.1 – 09.11.2026

Korrektur nach Rückmeldung der Lehrkraft zu 3.2.0: Ungeduldiges Auf- und Zudrehen des Hahns erzeugte Knicke und Stufen in der Messkurve, weil jeder Zwischenstand der nachlaufenden Anzeige aufgezeichnet wurde.

- **Messkurve wieder glatt:** Je angekommenem Tropfen wird der eingeschwungene pH aufgezeichnet (wie 3.1 – so, wie man real wartet, bis die Anzeige steht). Kolben, Messgerät und der pulsierende Live-Punkt im Diagramm zeigen weiterhin die träge Anzeige; der Live-Punkt gleitet auf die Kurve. Die Kurve ist damit unabhängig von der Hahnbedienung identisch mit der Modellkurve, und der Äquivalenzpunkt aus der Kurve verschiebt sich auch bei schnellem Tropfen nicht mehr.
- Tests: Unit-Test „ungeduldige Bedienung“ (Strahl auf/zu im Wechsel → Kurve monoton, jeder Punkt auf der Modellkurve); 28/28, E1–E9.

## 3.2.0 – 09.11.2026

Rückmeldung der Lehrkraft nach dem iPad-Test von 3.1.0 (Lesbarkeit, Trennlinien und Farbschema bestätigt): Bei stark/stark sprang die Indikatorfarbe innerhalb eines Tropfens von Gelb nach Blau – im Schülerversuch bleibt die Lösung bei Bromthymolblau einige Sekunden grün, und wer langsam titriert, hat Zeit, den Endpunkt zu notieren.

- **Durchmischung (sichtbarer pH):** Indikatorfarbe und Elektrodenanzeige folgen dem berechneten Gleichgewichts-pH jetzt mit einer Zeitkonstante – 3 s mit Rührer, 8 s ohne (`Experiment.pHMeasured`, `DEFAULTS.mixTauStirred/mixTauStill`). Am Äquivalenzpunkt durchläuft die Lösung dadurch sichtbar die Mischfarbe (BTB: Grün ≈ 1,5–2 s mit, ≈ 4–5 s ohne Rührer); ein zügiger Strahl überfährt den Umschlag. Die Chemie bleibt ideal (carbonatfrei): Modellkurve der Lehrkraft, Äquivalenzpunkt und Auswertung sind unverändert. Die Messkurve zeichnete in 3.2.0 den gemessenen pH (in 3.2.1 zurückgenommen, siehe oben). Anzeige-Untertitel „mischt sich …“ bzw. „ohne Rühren – langsam“ während des Einschwingens; Lehrkraft-Info zeigt pH (Modell, durchmischt) und pH (Anzeige/Farbe). Der Rührer bekommt damit eine spürbare Funktion.
- **Kurzer Hinweis in der Auswertung** (Karte „Messwerte“): Mischfarbe durch Verteilen des letzten Tropfens; im Realversuch hält das Grün oft länger (Carbonat in der Natronlauge, CO₂ aus der Luft) – das Modell rechnet ohne beides. Bewusst kein Carbonat-Schalter und keine Schulter in der Kurve: Puffer sind Thema von Halbtitrationslabor und Pufferfish.
- Kurzanleitung ergänzt; Service-Worker-Cache `titrierlabor-v6`.
- Tests: 28 Unit-Tests (neu: Experiment – Verzögerung der Anzeige, Grünfenster mit/ohne Rührer, Punkt-Aktualisierung, langsam vs. Strahl, Volumenbuchhaltung), Browserabnahme E1–E9 (neu E9: Grünphase in Echtzeit mit Screenshot, Hinweis in der Auswertung).

## 3.1.0 – 09.11.2026

Rückmeldung der Lehrkraft aus dem iPad-Test von TitraLab 3 und Angleichung an die übrigen SiVex-Apps. Chemisches Modell, Ablauf und Auswertung sind unverändert.

- **Quellcode im Repository:** Die Laufzeitdateien liegen erstmals entpackt unter `apps/titration/` (bisher nur als ZIP im Ordner `release/`). Ausgangspunkt ist das Web-Paket `SiVex-Titration-Claude-v3-web.zip` (SHA-256 `45a4b60c…6530f`), unverändert übernommen im ersten Commit des Branches. Dazu kommen wie bei den anderen Apps `package.json`, `scripts/` (Entwicklungsserver, Build mit Prüfung, Paketierung mit Prüfsummen), `tests/unit/` und `tests/e2e/`. Die Pakete heißen jetzt `titration-<version>-web.zip` und `titration-<version>-scorm12.zip`; das SCORM-Manifest wird wie bei den übrigen Apps erzeugt (`scormtype="sco"`).
- **Kurve neben der Apparatur (ab 900 px Breite):** Die Titrationskurve stand bisher als flache Schublade unter dem Laboraufbau – auf dem iPad quer blieben für pH 0–14 nur etwa 180 px, die pH-Achse war extrem gestaucht. Jetzt steht die Kurve **rechts neben der Apparatur in voller Höhe** (iPad quer ≈ 450 px Zeichenfläche statt 180). Die quadratische Laborszene nutzt die schmalere Spalte besser als vorher die breite, flache Fläche. In der Auswertung bekommt die Kurve mehr Breite (56 % statt 44 %). Im Hochformat (unter 900 px) bleibt die Kurve unter der Apparatur, erhält dort aber die Hälfte der Bühne statt 38 %.
- **Zweite Trennlinie** zwischen Apparatur und Kurve: ziehen (Maus, Finger), Pfeiltasten in 24-px-Schritten, Doppelklick stellt den Standard her; der Apparatur bleiben mindestens 320 px. Die Breite wird lokal im Browser gemerkt (`titrierlabor.chartWidth`). Im Hochformat ausgeblendet.
- **Kurve maximieren (⤢):** Schaltfläche über der Kurve blendet die Apparatur aus und gibt der Kurve die ganze Bühne – zum Ablesen des Äquivalenzpunkts, besonders im Hochformat. ⤡ bzw. Ausblenden der Kurve stellt die Ansicht wieder her.
- **Farbschema hell/dunkel:** ☀/☾ in der Kopfzeile. Dunkel ist der bisherige Standard; hell folgt dem Labkit der übrigen SiVex-Apps (helle Fliesenwand, graue Tischplatte, weißes Bedienfeld, dunkle Kopfzeile). Oberfläche über CSS-Variablen (`data-theme` am `<html>`), Laborgrafik und Diagramm über Paletten in `js/view/theme.js`; Glaskonturen, Skalen, Etiketten, Lupe, Hinweise, Raster, Achsen und Markerfarben sind je Schema abgestimmt, Flüssigkeits- und Indikatorfarben bleiben gleich. Die Wahl wird lokal gemerkt (`titrierlabor.theme`) und vor dem ersten Zeichnen angewandt (kein Aufblitzen).
- **Versionsnummer** hinter dem App-Titel (`v3.1.0`, Tooltip mit Paketname); `npm run package` bricht ab, wenn sie nicht zu `package.json` und `sivex.json` passt. Versionierung ab jetzt dreistellig wie bei den anderen Apps (3.0.0 = bisheriges Release „Claude V3“).
- Kleineres: Etiketten (Maßlösung, Probelösung) bleiben bei schmaler Bühne im sichtbaren Ausschnitt; auf schmalen Diagrammen entfällt das Wort „Umschlagsbereich“ vor dem Indikatornamen; Elektrodenkabel im hellen Schema grau statt schwarz; Kurzanleitung um Kurve neben der Apparatur, ⤢ und Farbschema ergänzt; Service-Worker-Cache `titrierlabor-v5` mit `theme.js`; `sivex.json` beschreibt die App (Status `prototype`, bis 3.1.0 auf dem iPad geprüft ist – 3.0 bleibt bis dahin das Paket im Einsatz).
- Tests: 22 Unit-Tests (Chemie: Äquivalenzvolumen, pH-Verlauf aller vier Proben, Halbäquivalenz = pKₛ, Ladungsbilanz, Verdünnung, ÄP aus Messdaten; Konfiguration; Auswertung mit Fehlerhinweisen; Farbschema), Browserabnahme E1–E8 (Desktop 1440 × 900, iPad quer 1080 × 735 und hoch 810 × 1005, beide Schemata).

## 3 (3.0.0) – 23.10.2026

Ausgewählte Titrationsversion „TitraLab 3 von Claude“ als SCORM-1.2- und Web-Paket im Repository; von der Lehrkraft in mebis sowie auf dem iPad (Safari, iPadOS 26.6.2), in Edge und Firefox geprüft. Quellcode nur im Paket.
