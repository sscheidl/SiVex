# Umsetzung der Prüfung vom 22.10.2026

Bezug: [REVIEW-2026-10-22.md](REVIEW-2026-10-22.md) · Ausgangsstand: Commit `d9fe6a3` · Bearbeitung: Claude Code, 22.10.2026

## 1. Unabhängige Reproduktion vor jeder Änderung

Alle Befunde wurden vor der Überarbeitung mit einem eigenen Skript über die öffentliche Labor-API bzw. im Browser (Edge über Playwright) nachgestellt. Ausgangslage: 45/45 Unit-Tests bestanden (Node 24.19.0).

| Befund | Reproduktion (vorher) | bestätigt |
| --- | --- | --- |
| R1 | Fehling ansetzen, 60 s bei 80 °C ohne Probe, 120 s abkühlen, dann Propanon: Temperatur 20,0 °C, `outcome = negative`, Phase `observable`, Durchmischung 0,31 | ja |
| R2 | Fertiger Silberspiegel + Fehling I: `system = foreign`, Spiegel 1 → 0, Trübung RGB [172, 56, 30], Alpha 0,94 bei 20 °C | ja |
| R2 (CuO) | Fehling I + NaOH erhitzt (`cuo = 1`), dann Fehling II: Status `ready`, Trübungsalpha 0,9 → 0 | ja |
| R3 | Browser: Verfahren + Beobachtung + Notiz, Rest leer, „Speichern und auswerten“: Fehlermeldung, alle Auswahlen und Notiz leer | ja |
| R4 | Früh als „unvollständig“ protokolliert, weiter erwärmt: Befund jetzt positiv, Phase bleibt `evaluated` | ja |
| R5 | Umsatz 0,604, Trübungsalpha 0,768, kräftig orange: `outcome = unfinished`, `result = ungueltig` | ja |
| R6 | Tollens 10 min bei Raumtemperatur: Umsatz 0; positive Auswertung nur mit „grau“ wird als falsch bewertet | ja |
| Übersicht | Protokolle `[positiv, ungültig]` derselben Probe: `hasEvidence = false` | ja |

## 2. Änderungen

### Simulation (`js/chemistry.js`)

- **R1 – Beobachtungszeit statt Heizdosis:** `heatF`/`heatT` ersetzt durch `exposure`. Sie wächst nur bei gültigem, gebrauchsfertigem und durchmischtem Ansatz und beginnt bei **jeder Zugabe** neu. Bereits sichtbare Produkte bleiben dabei erhalten.
- **R2 – beständige Produkte:** `cu2o`, `ag`/`agFilm`, `cuo` und `darkening` sind eigene Mengen. Das optische Modell zeichnet sie unabhängig vom aktuellen Reagenzstatus, und ein Statuswechsel deutet kein Produkt mehr um. CuO mit nachträglich zugegebenem Fehling II ergibt den neuen Status `contaminated` („außerhalb des Modells“, kein gültiger Nachweis). `progress` bleibt als Anzeigewert für den Umsatz des aktuellen Nachweises.
- **R5 – getrennte Kriterien:** „positiv“ (Produkt deutlich sichtbar), „abgeschlossen“ (≥ 97 %, nur Anzeige) und „negativ“ (kein Produkt + ausreichende Beobachtungszeit). Unterschiedliche Titel und Erklärungen für „beginnende Veränderung“, „nicht erwärmt“, „nicht durchmischt“ und „Beobachtungszeit zu kurz“.
- **R6 – Tollens fachlich erweitert:** langsame Reaktion bei Raumtemperatur; Silber als Film oder fein verteilt, abhängig von der Temperatur. Positiv gilt „Silberspiegel“ **oder** „grau-schwarz“ (neues Feld `obsOneOf`). Braunes Ag₂O ist im Text ausdrücklich abgegrenzt.
- **Sichtbare Modellhinweise:** Jede Auswertung nennt den beschleunigten Versuch im Wasserbad und den Modellcharakter von Zeiten und Farbverlauf (`modelNote`). Hinweis auf übrig gebliebene Produkte aus früheren Zuständen (`leftoverNote`).
- `describe()`: sachliche Textbeschreibung des sichtbaren Zustands für Screenreader, ohne Deutung.

### Experimentsteuerung (`js/lab.js`)

- **R4:** Protokolle speichern Simulationszeit, Temperatur und `interim`. Ein Reagenzglas gilt nur als „protokolliert/ausgewertet“, solange Zusammensetzung und Befund dem Protokoll entsprechen (`recordCurrent`). Ändert sich der Befund, erscheint ein Hinweis. Das Glas ist wieder „Beobachtung möglich“, und der alte Eintrag bleibt unverändert erhalten.
- **Übersicht:** `overview()` liefert den letzten Versuch und getrennt die letzte gültige Evidenz; `analysisResult()` bewertet ohne Ereignis (vorher doppelt in `ui.js`).
- Tollens-Lernhinweise im regulären Ablauf: „frisch ansetzen, nicht aufbewahren“ beim Fertigstellen, „Reste nicht aufbewahren – nach Anweisung der Lehrkraft entsorgen“ beim Austauschen.
- Hilfetexte: Tollens bei Raumtemperatur; positiver Befund ohne vollständigen Umsatz; Fehling-Hilfe „bis ein deutliches Ergebnis zu sehen ist“; neuer Fall „Versuch hat sich verändert“.

### Oberfläche (`js/ui.js`, `css/app.css`)

- **R3:** Formularentwürfe je Reagenzglas und Generation (nur im Arbeitsspeicher). Sie bleiben bei Validierungsfehlern, beim Schließen/Öffnen und beim Tabwechsel erhalten. Fehlende Teile sind rot markiert (`aria-invalid`), der Fokus springt auf das erste fehlende Feld.
- **R4:** Protokollkarten und Auswertung zeigen Zeitpunkt und „Zwischenstand“; im Bedienfeld steht „Dein Protokoll ist ein Zwischenstand …“.
- **Übersicht:** gültige Evidenz plus „letzter Versuch: ungültig“, wenn beides abweicht.
- **COOH-Hinweis** steht sichtbar über dem Redox-Trainer (vorher zugeklappt). Die Musterlösung zeigt zusätzlich die Carboxylat-Gleichungen, auch mit Beispielprobe.
- **Tablet-Beschriftung:** Reagenzien in zwei beschrifteten Gruppen (Fehling / Tollens) mit drei Spalten. Kein Umbruch mitten im Wort (`overflow-wrap: normal`, geschütztes Leerzeichen in „Fehling I“, weiche Trennstellen in „Silber­nitrat“, „Natron­lauge“, „Ammoniak­lösung“).
- **Bedienwege:** Ablauf als kompakte Punktzeile statt fünfzeiliger Liste. Die Gerätekarte (Wasserbad) bleibt unten im Panel angeheftet. Der Gasbrenner liegt unter „Weitere Geräte“; „In die Flamme halten (nicht empfohlen)“ erscheint nur bei brennendem Brenner.
- **Zugänglichkeit:** Strukturinfo per Enter/Leertaste bedienbar; Tastaturfokus und Scrollposition bleiben beim automatischen Neuzeichnen des Panels erhalten. Neu ist eine Live-Region mit `describe()`.
- Proben als „verdünnte Lösungen“ gekennzeichnet; in der Ethanal-Stoffinfo steht der Hinweis auf den Siedepunkt von etwa 21 °C.
- Siedeverzug ausdrücklich als geskriptetes Lernszenario gekennzeichnet.

### Darstellung (`js/render.js`)

- **Neutrale Lupe:** kein Wasserbad mehr hinter dem Reagenzglas, sondern immer der weiße Beobachtungshintergrund; Hinweis „aus dem Wasserbad gehoben betrachtet“.
- **Bläschen:** einzelne Entgasungsbläschen, die nach dem Aufheizen abklingen (je Glas und im Bad). Weniger Dunst über dem Bad, kein Dauersprudeln.
- **Sediment:** Cu₂O setzt sich in ruhender Flüssigkeit langsam ab, auch warm. Im heißen Bad hält Konvektion es teilweise in Schwebe; Schütteln oder Umsetzen wirbelt es auf.

### Gleichungen (`js/redox.js`)

- Neu `EQUATIONS_PRECISE` (Carboxylat). Die Schulschreibweise bleibt im Trainer; der Hinweistext stellt klar, dass sie ausgeglichen ist und nur die Teilchenform vereinfacht.

## 3. Fachliche Prüfung mit Quellen

| Frage | Ergebnis | Quelle |
| --- | --- | --- |
| Tollens: nur Silberspiegel positiv? | Nein. Spiegel und fein verteiltes, schwarzes (kolloidales) Silber gelten als positiver Befund. | Strathclyde, Kap. 7, S. 162; Chemguide |
| Tollens bei Raumtemperatur? | Möglich; mehrere Substrate bilden einen Spiegel bei Raumtemperatur, 3-Phenylpropanal wird bei RT so effizient oxidiert wie bei 70 °C. Warmes Wasserbad beschleunigt. | Strathclyde, Kap. 7, S. 163–164; RSC (Großversuch ohne Erwärmen, Schülerversuch mit Erwärmen) |
| Produkt R–COOH oder R–COO⁻? | Im alkalischen Ansatz Carboxylat. Die Schulschreibweise mit R–COOH ist ausgeglichen und kein Bilanzfehler, aber eine Vereinfachung. | RSC; Chemguide |
| Ethanal als Reinstoff? | Siedet bei ca. 21 °C → Proben als verdünnte Lösungen kennzeichnen | NIST WebBook |
| Fehling-Farben | Fehling I hellblau, II farblos, Mischung tiefblau, Cu₂O rotbraun | FU Berlin |

Nicht selbst geprüft: die im Prüfbericht genannte UCL-Arbeit (Abschnitt 2.6.6). Das PDF ist ein Scan ohne Textebene und wurde nicht ausgewertet.

## 4. Testnachweise

Umgebung: Windows 11, Node 24.19.0, Microsoft Edge 155 über Playwright 1.62.1. Einzelheiten im [Testbericht](TESTBERICHT.md).

| Testart | Ergebnis |
| --- | --- |
| Unit-Tests (`node --test tests/unit/*.test.js`) | **62/62** – davon 16 neue Regressionstests in `tests/unit/regression.test.js` und 1 neuer Gleichungstest |
| Browser-Tests (`PW_CHANNEL=msedge node tests/e2e/run.mjs`) | **32/32** – davon 6 neue (R2, R3, R4, neutrale Lupe, Tablet-Beschriftung 1024 und 1180) |
| SCORM-Prüfung mit simuliertem LMS | **9/9** – weiterhin nur `LMSInitialize`/`LMSFinish` |
| Build-Prüfung (keine externen Ressourcen, keine Netzwerkzugriffe) | OK – Offlinebetrieb unverändert |

Die Regressionstests decken jede Reproduktion aus Abschnitt 1 ab und zusätzlich:
- geänderte Reihenfolge und zusätzliche Portionen: eine Zugabe nach positivem Befund setzt die Beobachtungszeit zurück, das Produkt bleibt erhalten;
- Cu₂O bleibt nach Silbernitrat-Zugabe erhalten;
- Zwischenprotokolle;
- die Abwesenheit falsch negativer Befunde für alle Aldehyde, beide Nachweise und fünf Temperaturbedingungen.

Bestehende Tests, die eine fachliche Annahme festschrieben, wurden **angepasst und begründet**:
- „Tollens reagiert ohne Wärme nicht“ prüft jetzt eine langsame Reaktion bei Raumtemperatur;
- „grau allein ist falsch“ akzeptiert jetzt fein verteiltes Silber und lehnt braunes Ag₂O ab.

Die Tests sichern das Modell ab; die fachliche Begründung liefern die Quellen in Abschnitt 3.

**Nicht durchgeführt:** echtes iPad/Safari, echter mebis-Kurs, Unterrichtstest, Screenreader-Test.

## 5. Verbleibende offene Punkte

1. **Release:** `release/redoxlabor-1.0.0-*.zip` enthalten noch den alten Stand. Ein neues Release (z. B. 1.1.0) mit Versionsnummer, Paketen und Prüfsummen ist eine eigene Entscheidung; die Download-Links im README zeigen bis dahin auf 1.0.0.
2. **Geräte- und LMS-Tests:** iPad mit Safari (WebKit) und Import in einen echten mebis-Kurs stehen weiterhin aus.
3. **Zugänglichkeit:** Fokus- und Tastaturverbesserungen sowie die Live-Region sind umgesetzt, aber nicht mit VoiceOver/NVDA geprüft. Die Canvas-Bedienung (Ziehen, Antippen auf dem Labortisch) hat Panel-Äquivalente; ein vollständiges Audit fehlt.
4. **Modellgrenzen, bewusst offen gelassen:**
   - Lösen von CuO in Tartrat („außerhalb des Modells“);
   - Glasreinheit als Einflussgröße für den Silberspiegel;
   - Schwellenwerte für „deutlich sichtbar“ (Cu₂O 45 %, Ag 30 %), Zeitkonstanten und Geschwindigkeitsfaktoren sind didaktisch gesetzt, nicht gemessen;
   - die Raumtemperaturreaktion der Tollens-Probe ist für alle drei Aldehyde gleich langsam modelliert.
5. **Entsorgung:** Die App nennt nur „nicht aufbewahren – nach Anweisung der Lehrkraft entsorgen“. Konkrete Wege hängen von regionalen Schulregeln ab und sollten fachdidaktisch ergänzt werden.
6. **Formularentwürfe** leben nur im Arbeitsspeicher; nach einem Neuladen der Seite sind sie weg (abgeschlossene Protokolle bleiben wie bisher im `sessionStorage`).
7. **Playwright-Version:** Das Projekt pinnt 1.56.1, geprüft wurde mit 1.62.1 und Edge. Mit `npm install` und Chromium sollte der Lauf einmal wiederholt werden.

## 6. Vorschläge zur Weiterentwicklung

### Kontrollversuche und Hypothesen

- **Blindprobe und Vergleichsproben nebeneinander:** Das Labor hat bereits vier Reagenzgläser. Eine Aufgabe „Kontrollreihe“ verlangt je Nachweis Blindprobe (Reagenz ohne Probe), bekannte Positivprobe (Ethanal), bekannte Negativprobe (Propanon) und unbekannte Probe. Die Auswertung prüft, ob die Kontrollen das Erwartete zeigen, bevor sie die unbekannte Probe einordnet. Technisch genügt eine Gruppierung von Protokollen nach Versuchsreihe; `classify()` liefert die Blindprobe schon heute.
- **Vorhersage vor dem Versuch:** Vor dem Einstellen ins Wasserbad wählen die Lernenden die erwartete Beobachtung samt Begründung (Strukturmerkmal). Nach dem Versuch erscheinen Vorhersage und Beobachtung nebeneinander; der Widerspruch wird zum Gesprächsanlass.
- **Versuchshistorie:** Die neuen Felder `simTime`/`temp` je Protokoll sind die Grundlage für eine Zeitleiste je Reagenzglas (Zugaben, Temperatur, eigene Beobachtungsmarken), die im Protokoll mit ausgegeben wird.

### Teilchenansicht

- **Umschaltbare dritte Ebene neben Labortisch und Lupe:** Ausschnitt an der Grenzfläche mit Cu(II)-Tartrat-Komplexen bzw. [Ag(NH₃)₂]⁺ und Aldehyd-Molekülen, gekoppelt an den tatsächlichen Umsatz des gewählten Reagenzglases (`cu2o`, `ag`).
- **Elektronenübertragung schematisch** als Pfeil zwischen Reaktionspartnern beim Zusammentreffen (Oxidationszahl C +I → +III; Cu +II → +I bzw. Ag +I → 0) – keine frei durch die Lösung fliegenden Elektronen.
- **Brücke zur Beobachtung:** Cu⁺-Ionen fügen sich sichtbar zu Cu₂O-Partikeln zusammen, Ag-Atome lagern sich an der Glaswand an. Ein Zähler „2 e⁻ je Aldehyd-Molekül“ verbindet die Ansicht mit dem Redox-Trainer.
- **Ketone:** In der Teilchenansicht zeigt sich, dass am Carbonyl-C kein H-Atom vorhanden ist – kein Elektronenübergang.

### Differenzierter Zucker-Expertenmodus

Eigener Modus mit eigenem, geprüftem Modell, damit die Regel „Aldehyd positiv, Keton negativ“ des Grundmodus nicht verwässert wird:

| Probe | Erwartung | Erklärung im Modus |
| --- | --- | --- |
| Glucose | Fehling und Tollens positiv | Aldose; offenkettige Form mit Aldehydgruppe im Gleichgewicht mit der Ringform |
| Fructose | positiv | Ketose; im alkalischen Reagenz über Endiol-Zwischenstufe zu Aldosen umgelagert (Lobry-de-Bruyn-van-Ekenstein). Ausdrücklich **nicht** „Ketone reagieren doch“ |
| Saccharose | negativ | keine freie halbacetalische OH-Gruppe; positiv erst nach saurer Hydrolyse (optional als zweiter Schritt mit Neutralisation) |
| später Benzaldehyd | Tollens positiv, Fehling schwach bzw. negativ | Aussagekraft der Nachweise unterscheidet sich; eigenes, gesondert belegtes Modell |

Die Umlagerung sollte als langsamer, temperaturabhängiger Vorgleichgewichtsschritt modelliert werden, damit Fructose erkennbar verzögert reagiert und die Begründung beobachtbar wird. Jede Erweiterung braucht eigene Regressionstests und vorab eine fachliche Quellenprüfung.

### Weitere Schritte

- **Variablenversuche:** Temperatur, Probenkonzentration (in Portionen), Mischen und Glasreinheit als einstellbare Einflussgrößen statt unbegründeter Stoffgeschwindigkeiten; der Modellcharakter bleibt sichtbar.
- **Schülerprotokoll exportieren:** Druckansicht bzw. PDF aus dem Browser, ohne Server. Das datensparsame SCORM-Konzept bleibt erhalten; Notenübertragung wäre eine eigene Produktentscheidung.
- Danach echte iPad-/Safari- und mebis-Tests sowie ein kurzer Unterrichtstest.
