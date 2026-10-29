# Build-Auftrag für Claude Code: SiVex – Halbtitrationslabor

Version des Auftrags: 1.0 · 27.10.2026

## Auftrag

Entwickle eine eigenständige, vollständig bedienbare SiVex-Browseranwendung für die Oberstufe: **„Halbtitrationslabor – pKₛ- und pKᵦ-Werte experimentell bestimmen“**. Grundlage ist das vorhandene **TitraLab 3 von Claude** mit seinem gelungenen Laboraufbau und seinen handlungsabhängigen Animationen. Übernimm und erweitere bewährte Teile gezielt. Liefere eine ausführbare Anwendung, lesbaren Quellcode, Web- und SCORM-1.2-Pakete sowie einen ehrlichen Testbericht. Ein Konzept, ein Mockup, eine vorberechnete Kurven-Galerie oder eine automatisch ablaufende Demonstration genügt nicht.

**Kernidee:** Die Schülerinnen und Schüler (SuS) erarbeiten die theoretische Begründung, planen und führen die Titration selbst durch, bestimmen Halbäquivalenzpunkte, berechnen ihre Ergebnisse eigenständig und vergleichen Messung, schulische Näherungsrechnung und Literaturwert. Die Titrationskurve ist während des Experiments ein fester, dynamisch wachsender Bestandteil.

**Nicht Teil dieses Auftrags:** Unterricht über Pufferwirkung, Pufferkapazität, Pufferherstellung oder die Auswahl von Puffersystemen; dafür ist später eine eigene App „Pufferfish“ vorgesehen. Keine entsprechende zusätzliche App, Navigation oder Platzhalter bauen. Die zur Halbtitration nötige Gleichgewichtsbegründung und das Konzentrationsverhältnis der korrespondierenden Partner bleiben natürlich Bestandteil dieses Labors.

Arbeite nach kurzer Bestandsaufnahme direkt an der Umsetzung und bis zum überprüften Ergebnis weiter. Routineentscheidungen selbst treffen und dokumentieren. Keine Rückfrage zu bereits festgelegten Anforderungen. Neuere ausdrückliche Anweisungen des Auftraggebers haben Vorrang.

## 1. Bestand lesen, bestehende Arbeiten erhalten

Lies geltende `AGENTS.md` sowie `README.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/MEBIS.md`, `apps/_template/README.md` und `apps/titration/README.md`. Prüfe vor Änderungen den Git-Arbeitsstand; fremde Änderungen und Löschungen nicht zurücksetzen.

Das ausgewählte TitraLab 3 liegt derzeit vollständig in diesen Archiven:

- `apps/titration/release/SiVex-Titration-Claude-v3-web.zip`
- `apps/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip`

Im Web-Archiv liegen die Laufzeitdateien unter `titration/`. Besonders relevant sind:

- `index.html`, `css/styles.css`
- `js/model/chemistry.js`, `indicators.js`, `config.js`, `evaluation.js`
- `js/experiment/experiment.js`
- `js/view/lab-renderer.js`, `geometry.js`, `chart.js`
- `js/ui/app.js`

Prüfe den tatsächlichen aktuellen Bestand: Inzwischen entpackter Quellcode hat Vorrang, wenn er nachweislich zum gewählten TitraLab 3 gehört. Andernfalls gezielt aus dem Release übernehmen und Herkunft dokumentieren. Nicht davon ausgehen, dass fehlende entpackte Dateien fehlenden Anwendungscode bedeuten. **TitraLab 2 ist verworfen und keine Grundlage.**

TitraLab 3 besitzt bereits Essigsäure, Ammoniak, eine Gleichgewichtsberechnung über Ladungsbilanzen, Indikatorfarben, Tropfen/Mischschlieren, eine Titrationskurve und Halbäquivalenzmarkierungen. Analysiere dies zuerst. Bestehendes Verhalten nicht ungeprüft als fachlich richtig oder für mehrprotonige Systeme geeignet behandeln.

Neue kanonische Anwendung: `apps/halbtitration/`. Das bestehende Titrationslabor und seine Release-Archive bleiben funktionsfähig und unverändert. Passende Ergänzungen der zentralen Übersicht sind zulässig. Keine Veröffentlichung, kein Push und keine PR-Erstellung als Teil dieses Auftrags.

## 2. Zielgruppe, Lehrplan und verbindliche Versuche

Zielgruppe: Gymnasium Bayern, Q13, erhöhtes Anforderungsniveau (eA), besonders C13 Lernbereich 3 „Säure-Base-Gleichgewichte – Quantitative Analytik und deren Anwendung“. Präzise deutsche Sprache; experimentelles Denken und eigenständiges Rechnen statt einer Folge von Bestätigungsbuttons.

Vier vollständig implementierte Versuche:

| Versuch | Probe und Maßlösung | Schwerpunkt |
| --- | --- | --- |
| 1 | Essigsäure + Natronlauge | Einprotonige schwache Säure, pKₛ-Bestimmung, grundlegender Arbeitsablauf |
| 2 | Ammoniaklösung + Salzsäure | Schwache Base, fallende Kurve, pOH/pKᵦ und korrespondierende Säure unterscheiden |
| 3 | Phosphorsäure + Natronlauge | Mehrprotonigkeit, erste zwei experimentell zugängliche Stufen, Halbäquivalenzpunkte richtig zuordnen |
| 4 | Glycinhydrochlorid + Natronlauge | Zwei pKₛ-Werte, Kation → Zwitterion → Anion, Verbindung zur Aminosäurechemie |

Als typische Referenzwerte kommen bei etwa 25 °C pKₛ(Essigsäure) ≈ 4,75, pKᵦ(Ammoniak) ≈ 4,75, Phosphorsäure ≈ 2,15 / 7,20 / 12,35 und Glycin ≈ 2,34 / 9,60 infrage. Das sind Ausgangswerte zur Quellenprüfung, keine Aufforderung, Messpunkte darauf festzusetzen. Wähle je Stoff einen konsistenten dokumentierten Datensatz und nenne Quelle, Temperatur und soweit bekannt Bedingungen. Unterschiedliche Literaturtabellen nicht stillschweigend vermischen.

Wähle realistische Konzentrationen, Probevolumina und Bürettenkapazitäten, mit denen die vorgesehenen Stufen tatsächlich erreichbar sind. Alle Standardversuche müssen ohne Sackgasse abschließbar sein. Für die theoretische Kontrollrechnung sind Ausgangskonzentrationen verfügbar; der gesuchte pK-Wert bleibt bis zur eigenen experimentellen Auswertung verborgen. Ein zusätzlicher Modus mit unbekannter Konzentration ist nicht erforderlich.

## 3. Fachliche Leitplanken – verbindlich

### Begriffe und Indikatorwahl

- Äquivalenzpunkt: stöchiometrischer Umsatz der jeweils betrachteten Stufe. Endpunkt: experimentell beobachtetes Abbruchkriterium, etwa die bleibende Indikatorfarbe. Beides stimmt nicht automatisch überein.
- Halbäquivalenzpunkt: halber stöchiometrischer Umsatz innerhalb der betrachteten Protolysestufe. Hier wird der pK-Wert bestimmt.
- Neutralpunkt: pH = pOH, bei 25 °C ungefähr pH 7; kein allgemeines Synonym für Äquivalenzpunkt.
- Umschlagsbereich des Indikators zum steilen Abschnitt am gewählten Äquivalenzpunkt zuordnen, nicht zum flachen Abschnitt am Halbäquivalenzpunkt. Ein Indikator ersetzt die pH-Elektrode für die pK-Bestimmung nicht.
- Nicht pauschal von „dem zweiten Wendepunkt“ sprechen. Stufen und Punkte nach ihrer chemischen Funktion beschriften; nicht jeder mathematische Wendepunkt ist ein Äquivalenzpunkt.
- Bei Mehrprotonigen ausdrücklich festlegen, welcher Äquivalenzpunkt mit einem Indikator erfasst werden soll. Ein Indikator muss nicht alle Stufen abdecken. Schlechte oder fehlende Indikatoreignung darf ein fachlich richtiges Ergebnis sein; die pH-metrische Auswertung bleibt möglich.

### Theorie der Halbtitration

- Aus Protolysegleichgewicht und MWG die Konzentrationsform der Henderson-Hasselbalch-Gleichung herleiten: pH = pKₛ + lg[c(A⁻)/c(HA)]. Bei gleichen Gleichgewichtskonzentrationen gilt im idealen Konzentrationsmodell pH = pKₛ.
- Am stöchiometrischen Halbäquivalenzvolumen gilt diese Gleichheit im Allgemeinen **näherungsweise**. Anfangsdissoziation, Wasserautoprotolyse und weitere Protolysestufen können Abweichungen verursachen. Besonders den ersten Phosphorsäure- und Glycin-Halbäquivalenzpunkt nicht künstlich auf den Literatur-pKₛ setzen.
- Für Ammoniak am Halbäquivalenzpunkt: pOH ≈ pKᵦ; pKᵦ ≈ pK𝑤 − pH. Gleichzeitig gilt pH ≈ pKₛ(NH₄⁺). pKₛ(NH₄⁺) und pKᵦ(NH₃) sind verschiedene Größen.
- Beide Glycinwerte sind **pKₛ-Werte**. Der zweite beschreibt die Protonenabgabe der Ammoniumgruppe, nicht unmittelbar einen pKᵦ-Wert.
- Bei 25 °C pK𝑤 = 14,00 als dokumentierte Modellannahme verwenden. Keine variable Temperatur nötig; Literatur und Messmodell müssen vergleichbare Bedingungen besitzen.

### Mehrprotonige Systeme

- Für Titration der definierten protonierten Ausgangsform mit NaOH gilt stufenbezogen: V(HÄP,1) = V(ÄP,1)/2; V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)]/2. **Nicht V(ÄP,2)/2 als zweiten Halbäquivalenzpunkt verwenden.**
- Phosphorsäure: alle drei Gleichgewichte im Modell berücksichtigen, Schwerpunkt der Schülerauswertung auf den ersten beiden Stufen. Unter üblichen wässrigen Bedingungen keinen ausgeprägten dritten Sprung erfinden. Näherung pH ≈ pKₛ,j nur mit passender Gültigkeit behaupten.
- Glycin: mit definiertem Glycinhydrochlorid beginnen; Chlorid als Gegenion berücksichtigen. Keine beliebige zusätzliche Salzsäuremenge unbilanziert hinzufügen. Eine neutrale Glycinlösung startet überwiegend als Zwitterion und liefert bei bloßer NaOH-Zugabe nicht denselben vollständigen Titrationsweg.
- Spezies korrekt zeigen: H₃N⁺–CH₂–COOH, H₃N⁺–CH₂–COO⁻, H₂N–CH₂–COO⁻. Das Zwitterion besitzt innere Ladungen, bei insgesamt null Ladung.
- Der erste Glycin-Äquivalenzbereich führt überwiegend zum Zwitterion; hier ist der isoelektrische Punkt als kurze Zuordnung möglich. Keine eigene umfangreiche pI-Lerneinheit hinzufügen. Gleichgewichte nicht als ausnahmslos reine Spezies darstellen.
- Nicht jeder stöchiometrische Äquivalenzpunkt ist als scharfer Sprung zuverlässig messbar. Falls V(ÄP,2) etwa beim Glycin nicht belastbar aus der Kurve bestimmbar ist, darf es bei definierter Ausgangszusammensetzung aus Stöchiometrie beziehungsweise V(ÄP,1) abgeleitet werden. Die SuS müssen dies selbst rechnen; gemessene und abgeleitete Größen kennzeichnen.

## 4. Chemisches Modell und Messsimulation

Trenne Chemieberechnung, experimentellen Zustand, Messgerät, Darstellung und Auswertungslogik. Nutze für die interne pH-Berechnung ein durchgängiges numerisches Gleichgewichtsmodell mit Stoff-, Ladungs- und Volumenbilanzen sowie Wasserautoprotolyse. Mehrprotonige Verteilungen und Glycin-Gegenionen explizit berücksichtigen. pH stabil etwa über eine Nullstellensuche in log[H₃O⁺] berechnen. Einheiten und Eingabebereiche eindeutig festlegen.

Keine Kurven aus dekorativen Splines, keine erzwungenen pK-Treffer und keine stückweise zusammengesetzten pH-Formeln mit Sprüngen. Die schulischen Näherungsformeln sind **Gegenstand der Schülerrechnung**, nicht Ersatz für den internen durchgängigen Solver. SuS müssen keinen numerischen Bilanzsolver programmieren oder von Hand nachrechnen.

Volumenänderung durch Maßlösung und gegebenenfalls zugesetztes Wasser berücksichtigen. Stoffmengenänderungen entstehen durch tatsächliche Handlungen. Bürettenfüllung, abgegebenes Volumen, Kolbeninhalt und Messprotokoll müssen konsistent bleiben; Nachfüllen darf keine versteckten Sprünge erzeugen.

Modell zunächst bei 25 °C als idealisierte Konzentrationsrechnung implementieren; Aktivitätskoeffizienten nicht stillschweigend als exakt berücksichtigt behaupten. Abweichungen zwischen thermodynamischen Literaturwerten und Konzentrationsmodell als Grenze dokumentieren. Nicht willkürlich Zufallsrauschen hinzufügen, um „Praxis“ vorzutäuschen. Im Standardmodus genügen endliche Dosier-/Ableseauflösung, Mischzeit, Sensoransprechzeit, Indikator-Endpunkt und reale Schülerentscheidungen. Optionaler Fehlermodus nur nach Fertigstellung des Pflichtumfangs.

## 5. Lernweg und selbstständiger Laborablauf

### A. Theorie und Planung

Kurze, fachlich vollständige Theorie mit Protolysegleichungen, MWG, Halbäquivalenzbegründung und Säure-/Base-Unterscheidung. Kleine Verständnisfragen, etwa warum eine Base nicht einfach pKᵦ = pH liefert. Keine gesuchten Zahlenwerte oder komplette Rechnung vorwegnehmen.

SuS wählen Versuch, passende Maßlösung, einen Indikator und begründen die Wahl. Eine lokale Indikatortabelle mit Farben und Umschlagsbereichen steht zur Verfügung; keine fertige Versuchskurve als Entscheidungshilfe vorab zeigen. Geeignete Auswahl umfasst mindestens Phenolphthalein, Bromthymolblau, Methylorange, Methylrot und „ohne Indikator / pH-metrisch“. Mehrere vertretbare Entscheidungen anhand der konkreten Kurve und des resultierenden Volumenfehlers akzeptieren. Ein bloßer Namensvergleich „richtiger Indikator“ genügt nicht.

### B. Erster Durchgang: Äquivalenzvolumen untersuchen

- Geräte vorbereiten, Probe pipettieren, Bürette vorspülen/befüllen und Spitze füllen, Anfangsstand festhalten.
- pH-Meter vor der Messung über eine kurze Kalibrierhandlung betriebsbereit machen. Kalibrierstandards sind Gerätevorbereitung, kein Unterrichtsmodul über Puffer. Elektrode spülen und geeignet eintauchen.
- Gewählten Indikator in kleiner Menge zugeben; rühren und pH-Ausgangswert aufnehmen.
- Dosiergeschwindigkeit selbst steuern, Einzelzugaben/Tropfen auslösen, Hahn schließen, mischen und stabilen Messwert übernehmen. Gegen Ende feinere Dosierung ermöglichen, aber nicht automatisch am intern bekannten Äquivalenzpunkt abbremsen oder stoppen.
- Beobachteten Indikator-Endpunkt selbst markieren. Einige Messpunkte darüber hinaus aufnehmen können; Messung endet durch Schülerhandlung.
- Bürettenverbrauch aus Anfangs-/Endstand bestimmen; Äquivalenzpunkt selbst an der eigenen Kurve untersuchen. Mehrere benötigte Stufen aufnehmen und zuordnen.

### C. Zweiter Durchgang: gezielte Halbtitration

- Frische, gleich große Probe ansetzen. Erste Messreihe bleibt gespeichert.
- SuS berechnen das Zielvolumen für den gewählten Halbäquivalenzpunkt selbst, bei Mehrprotonigen ausdrücklich stufenbezogen.
- SuS dosieren selbst bis zum berechneten Volumen. Keine Schaltfläche „perfekt halbtitrieren“ und kein automatisches Stoppen am geheimen Modellwert. Ein von ihnen selbst gesetzter Zielmarker darf als Arbeitsmittel dienen.
- Mischen, stabilen pH ablesen und eigenen pKₛ-/pKᵦ-Wert bestimmen.
- Bei Mehrprotonigen können zwei gezielte Ansätze für die beiden Stufen oder eine frische Probe mit Messstopp am ersten und Weiterdosieren zum zweiten Halbäquivalenzpunkt verwendet werden. Verbrauch immer kumulativ und verständlich darstellen.
- Überschießen hat Konsequenzen; neue Probe und Wiederholung müssen möglich sein. Keine „Zurück“-Taste, die verbrauchte Maßlösung aus dem Kolben entfernt.

### D. Eigene Rechnung, Vergleich und Reflexion

Das Laborjournal sammelt Messwerte, selbst eingetragene Rechenergebnisse, Einheiten und kurze Begründungen. Messdaten dürfen übertragen/exportiert werden; gesuchte Ergebnisse werden dabei nicht automatisch vorab ausgefüllt.

Verbindliche Schülerrechnungen:

1. Äquivalenzvolumen aus bekannten Ausgangsmengen und Stöchiometrie, bei Mehrprotonigen mit dem richtigen Stufenfaktor.
2. Zielvolumen des jeweiligen Halbäquivalenzpunkts.
3. Experimenteller pKₛ beziehungsweise pKᵦ aus eigener pH-Messung.
4. Nach Freigabe der Literaturwerte theoretische pH-Werte an ausgewählten charakteristischen Punkten: Start, Halbäquivalenz und mindestens ein geeigneter Äquivalenzpunkt.
5. Abweichungen sowie eine begründete Fehlerbetrachtung.

Wähle pro Versuch passende, für Q13 eA zugängliche Rechenansätze. Bei nötiger genauerer Behandlung beispielsweise die quadratische Lösung des einprotonigen Protolyseansatzes als gestufte Hilfe anbieten; am Ampholytpunkt die begründete Näherung pH ≈ ½(pKₛ,1 + pKₛ,2). Anfangsdissoziation und Verdünnung nicht übergehen. Kein Zwang, die vollständige mehrprotonige Ladungsbilanz von Hand zu lösen. Gültigkeitsgrenzen von Näherungen erläutern; nicht jeden gemessenen Punkt schematisch mit derselben Formel behandeln.

**Informationsfolge:** Zuerst experimentellen pK-Wert selbst bestimmen und zur Überprüfung abgeben. Danach Literaturdaten freischalten, damit die SuS damit theoretische pH-Werte berechnen. Ein Literatur-pKₛ in einer pH-Rechnung ist eine Vorhersagegrundlage, keine zweite unabhängige pKₛ-Bestimmung. Nachträgliche Korrektur ermöglichen und den ursprünglichen Versuchswert zum Vergleich erhalten.

Abweichungen:

- ΔpK = pK(experimentell) − pK(Literatur), mit Vorzeichen; zusätzlich Betrag möglich. Nicht als Standard prozentuale pK-Abweichungen verlangen, weil die Skala logarithmisch ist.
- ΔpH = pH(gemessen) − pH(berechnet), mit Vorzeichen. Nicht „Prozent pH“ berechnen lassen.
- Für Volumina und Konzentrationen absolute und relative Abweichung sinnvoll anbieten; Referenz und Nenner ausdrücklich benennen. Kein Teilen durch null.
- Optional nach Erfüllung des Pflichtumfangs: pK in K umrechnen und relative K-Abweichung untersuchen.

Rückmeldungen trennen **Mess-/Durchführungsfehler**, **Rechenfehler** und **Abweichungen aufgrund von Näherung oder Modellgrenze**. Korrekte Rechnung mit einem ungenauen eigenen Messwert als rechnerisch korrekt erkennen. Nicht alle Werte ausschließlich gegen den geheimen Idealwert prüfen.

Eingaben mit Dezimalkomma, üblichen Rundungen und passenden Einheiten akzeptieren. Toleranzen aus Aufgabe und Messauflösung begründen; keine universelle willkürliche Prozentgrenze für pH, Volumen und pK. Freitexte nicht durch Worttreffer als wissenschaftlich richtig/falsch bewerten.

Hilfen sind gestuft: Denkimpuls → passender Ansatz → nachvollziehbare Musterrechnung auf ausdrücklichen Wunsch nach eigener Bearbeitung. Literaturdaten, interne Sollwerte und Musterlösung nicht durch Geräteetiketten, Export oder vorzeitige Kurvenmarkierungen verraten. Keine KI-API zur Antwortbewertung.

## 6. Dynamische Kurve und Auswertungswerkzeuge

Die pH-Volumen-Kurve ist ein zentrales Messinstrument, kein nachträgliches Ergebnisbild. Auf Desktop und Tablet gleichzeitig mit den wesentlichen Laborhandlungen sinnvoll nutzbar halten.

- x-Achse: tatsächlich zugegebenes Maßlösungsvolumen in mL; y-Achse: pH. Achsen, Einheiten und fallende/steigende Verläufe korrekt.
- Kurve wächst nur aus real aufgenommenen Daten. Keine Zukunftskurve, keine Modellpunkte als angeblich gemessene Werte. Aus Messpunkten gezeichnete Verbindung und Messpunkte unterscheidbar halten.
- Live-Sensoranzeige, aktuelle Position und protokollierter stabiler Messwert unterscheiden. Zwischenwerte während Misch-/Ansprechzeit nicht automatisch als belastbare Gleichgewichtsdaten speichern. Zu frühe manuelle Übernahme mit erkennbarem Messstatus zulassen.
- Keine Kurvenvorschau, die durch Achsenskalierung das geheime Äquivalenzvolumen exakt verrät. Gerätekapazität oder sinnvolle feste Bereiche verwenden; Zoom/Pan nur soweit nötig.
- Indikator-Umschlagsband zuschaltbar, ohne Lösungspunkte vorwegzunehmen.
- SuS wählen Äquivalenzpunkte und berechnete Halbäquivalenzvolumina zunächst selbst. Hilfslinien, verschiebbare Marker, Werteablesung und sinnvolle Interpolation unterstützen. Interpolierte Werte ausdrücklich kennzeichnen.
- Nach eigener Auswertung deutlich unterscheiden: Startpunkt, zugeordnete Äquivalenzpunkte, Halbäquivalenzpunkte, beobachteter Indikator-Endpunkt und gegebenenfalls theoretische Referenz. Keine irreführende Gleichsetzung von Messmarker und exaktem Modellpunkt.
- Fehlen Messwerte im relevanten Bereich, Datenlücke melden; kein angeblich experimentelles Ergebnis aus heimlichem Modellwissen ergänzen.
- Eine Ableitungsansicht kann die Auswertung ergänzen, ist keine Voraussetzung. Sie darf mehrere Stufen und ungleichmäßige Messabstände nicht falsch behandeln.
- Zweite Messreihe wächst ebenfalls dynamisch; erste Reihe kann blass als gespeicherte Referenz angezeigt werden. Klar benennen, welche Reihe aktiv ist.
- Theoretische Vergleichskurve und Literatur-pK-Markierungen erst nach eigener Auswertung zuschaltbar. Kurvenlegende unterscheidet „Messreihe“, „Interpolation“, „Näherungsrechnung“ und „Modellreferenz“, soweit angezeigt.

## 7. Laborbild, Animationen und Bedienung

Erhalte die Qualität und räumliche Logik des TitraLab-3-Aufbaus: Bürette am Stativ, Tropfenweg, geeignetes Probengefäß, Rührer und pH-Elektrode. Keine ersatzweise generische Dashboard-Darstellung mit einem winzigen statischen Laborbild. Ausreichend Platz für echte Geräteanimation und die dynamische Kurve reservieren.

TitraLab-3-Renderer als positive Referenz für Tropfen, Flüssigkeitsstände, Oberflächenimpulse, Mischschlieren und Rühren verwenden. Jede sichtbare Änderung muss zum selben experimentellen Zustand gehören. Vorübergehende lokale Indikatorfarbe an der Eintropfstelle von bleibender Gesamtfärbung unterscheiden. Ohne Rühren darf der Sensor nicht sofort einen perfekten homogenen Messwert behaupten. Keine permanenten dekorativen Wellen in ruhender Flüssigkeit.

Gestaltung an der aktuellen hellen SiVex-Oberfläche des Redoxlabors orientieren, ohne die gelungene Titrationsapparatur neu zu erfinden: helle Laborfläche, ruhige Farben, klare Typografie, kompakte Kopfzeile und konsistente Bedienelemente. Bestehende Screenshots und Anwendung bei Bedarf ansehen. Kein dunkles Alt-Design ungeprüft übernehmen.

- Theorie, Planung, Labor und Auswertung als verständliche Arbeitsphasen, aber kein überladenes Wizard-System. Laborjournal und Messreihe beim Wechsel erhalten.
- Hinweise oberhalb oder neben der Gerätefläche, nicht über Bürettenstand, Hahn, Elektrode oder Kurve legen. Beschriftungen dürfen Geräte und Messpunkte nicht verdecken.
- Wesentliche Touchziele ungefähr 44 CSS-Pixel oder größer; Maus, Touch und Tastatur bedienen dieselben Funktionen. Kein zwingendes Drag-and-drop und keine reine Farbcodierung.
- Desktop etwa 1440×900 und Tablet quer 1180×820 sowie 1024×768 prüfen. Keine globale Verkleinerung zu unlesbaren Geräten/Schriften, keine horizontale Seitenüberbreite. Auf schmalen Ansichten sinnvoll umordnen.
- Eingaben, Journal und Messreihen lokal speichern; nach Neuladen wiederherstellen. Speicherfehler abfangen, sodass die App weiter bedienbar bleibt. Keine Schülerkonten oder Datenübertragung.
- „Neue Probe“, „Messreihe wiederholen“ und „Gesamtes Labor zurücksetzen“ eindeutig unterscheiden. Eine neue Probe löscht keine bereits gespeicherten Rechnungen oder Messreihen.
- Ein kompakter, druckbarer/exportierbarer Laborbericht enthält die eigenen Messdaten, Kurve, Rechnungen, freigegebenen Referenzen und Reflexion. Export vor Lösungsfreigabe darf keine versteckten Lösungen offenlegen.

Keine zusätzliche Teilchenanimation als Pflichtumfang. Bei Glycin und Phosphorsäure genügen fachlich richtige, zustandsbezogene Struktur-/Speziesdarstellungen mit Legende. Keine überflüssigen Funktionsbereiche, Belohnungssysteme oder Lerninhalte ergänzen.

## 8. Technik und Auslieferung

- Statische Anwendung ohne notwendiges Backend, Schülerlogin, KI-API, externe Fonts oder CDN-Ressourcen. Bibliotheken bei Bedarf lokal bündeln; bestehende schlanke HTML/CSS/JavaScript-Struktur bevorzugen.
- Metadaten `sivex.json` mit konsistenter ID `chemie/halbtitration`, Titel, Beschreibung, Fach Chemie, Jahrgang 13, Themen, Version und Status `prototype`.
- README mit Start-/Build-/Test-/Paket-Anleitung, Herkunft übernommener TitraLab-Dateien und bekannten Grenzen.
- Fachmodell, verwendete Quellen und Näherungsgrenzen in `docs/CHEMIE.md`; Bedienung und Testnachweise getrennt dokumentieren.
- Reproduzierbare Skripte für lokalen Start, sinnvolle Tests und Paketierung.
- Release unter `apps/halbtitration/release/`: Web-ZIP, SCORM-1.2-ZIP und SHA256-Prüfsummen. SCORM: `imsmanifest.xml` im ZIP-Stamm, korrekter Launchpfad, vollständig lokale Ressourcen. Keine Noten-/Personendatenübermittlung als Pflichtfunktion.
- Bevorzugte mebis-Darstellung ist ein eigenes Browserfenster; keine besondere eingebettete Miniaturversion erforderlich. Responsive Bedienbarkeit bleibt Pflicht.
- Bestehenden Service Worker nicht mit alten Cache-Namen und URLs übernehmen. Cache-Kollisionen zwischen TitraLab und Halbtitrationslabor sowie veraltete Release-Dateien vermeiden.
- Abschluss mit präzisen Dateipfaden, Startanweisung, Prüfergebnissen und offenen Punkten. Ohne tatsächlichen Test in mebis oder auf einem echten iPad keine entsprechende Freigabe behaupten. Keine Deployment-Aktion durchführen.

## 9. Prüfen und selbst korrigieren

Nach Implementierung Anwendung wirklich ausführen, nicht nur Quellcode lesen. Sinnvolle Modelltests und Browserprüfungen schreiben; keine massenhaften Tests, die lediglich Implementierungsdetails wiederholen. Gefundene Fehler im eigenen Durchlauf beheben, anschließend gezielt nachprüfen.

### Fachmodell und Auswertung

- Ladungs-/Stoffbilanzresiduen, Verdünnung und Solver-Konvergenz für alle vier Stoffsysteme prüfen. Unabhängige Referenzfälle oder alternative nachvollziehbare Rechnungen nutzen; nicht Solver-Ausgabe gegen denselben Solver prüfen.
- Ganze Kurven einschließlich Start, beiderseits der Äquivalenzbereiche und des Maßlösungsüberschusses auf Kontinuität und plausible Richtung prüfen.
- Einprotonige Säure und Base: richtige Richtung, Halbäquivalenzzuordnung und Umrechnung pH/pOH/pKₛ/pKᵦ. Im Ammoniakversuch keine falsche pKᵦ-Markierung auf der pH-Achse.
- Phosphorsäure und Glycin: Stufenstöchiometrie und zweites Halbäquivalenzvolumen; Speziesverteilung und Gegenionen. Keine künstlich erzwungenen Halbäquivalenz-pK-Treffer; erwartete Näherungsabweichungen dokumentieren.
- Passende und unpassende Indikatorwahl, fehlender Umschlag, unterschiedliche Zielstufen sowie pH-metrische Auswertung ohne Indikator prüfen.
- Korrekte Rechnung mit ungenauem Messwert von falscher Rechnung unterscheiden. Dezimalkomma, Rundung, Einheiten, leere/ungültige Eingaben und Datenlücken prüfen.

### Interaktion, Darstellung und Paket

- Je Stoff mindestens einen vollständigen Ablauf von Planung über erste Messreihe und frische Halbtitration bis eigener Rechnung, Literaturfreigabe und Bericht durchspielen. Bei Mehrprotonigen beide vorgesehenen pK-Stufen prüfen.
- Zusätzlich Überschießen, neue Probe, zu frühe Messwertübernahme, fehlendes Rühren, Kurs-/Versuchswechsel und Wiederherstellung nach Neuladen prüfen.
- Nachweisen, dass vor Schülerhandlungen keine Zukunftskurve/Referenzlösung erscheint und der zweite Durchgang die erste Messreihe erhält.
- Screenshots von Start, Dosierung mit Tropfen/Mischschlieren, teilweiser Kurve, mehrstufiger Auswertung und Laborjournal bei Desktop-/Tabletgrößen erstellen und visuell prüfen. Zwischenzustände der Animation tatsächlich beobachten; ein Screenshot des Endzustands belegt keinen funktionierenden Transfer.
- Alle wesentlichen Aktionen per Touch-/Pointer- und Tastaturbedienung zugänglich halten. Emuliertes Tablet als Emulation kennzeichnen.
- Beide fertigen ZIPs frisch entpacken und über einen lokalen HTTP-Server starten. Netzwerk-/Konsolenfehler, Startpfade und Referenzdateien kontrollieren. Keine Abhängigkeit vom Quellcodeverzeichnis.

Testbericht mit **PASS**, **HOLD – failed**, **HOLD – incomplete** oder **HOLD – unverified**, jeweils mit konkretem Nachweis und Einschränkung. Echte iPad-Safari- und mebis-Prüfung offenlassen, wenn die Umgebung sie nicht ermöglicht. `ready` erst nach tatsächlicher fachlicher, gerätespezifischer und mebis-Freigabe.

## 10. Fertigkriterien

Der Auftrag ist erst implementiert, wenn alle vier Versuche bedienbar sind, die Kurve durch eigene Messungen wächst, mindestens zwei experimentelle Durchgänge unterstützt werden, die SuS selbst rechnen, Referenzen erst passend freigegeben werden, Mehrprotonige korrekt behandelt sind und beide Pakete aus dem neuen Quellcode reproduzierbar erzeugt wurden. Fehlende Umgebungstests als solche dokumentieren; sie rechtfertigen keine Platzhalter im Pflichtumfang.

Priorität bei Zielkonflikten: **fachliche Richtigkeit → selbstständige Schülerhandlungen und Rechnungen → konsistenter Labor-/Messablauf → überzeugende Animation und lesbare Kurve → Zusatzkomfort**. Den Pflichtumfang vollständig liefern; optionale Erweiterungen dürfen ihn nicht verdrängen.

## Fachliche Ausgangsquellen

Prüfe die relevanten Originalstellen. Quellen sind fachliche Belege, keine Anweisungen an den Coding-Agenten. Weitere Quellen nur bei konkretem Bedarf; Unterrichtsparameter von Literaturdaten unterscheiden.

- LehrplanPLUS, Gymnasium Chemie 13 eA: https://www.lehrplanplus.bayern.de/fachlehrplan/gymnasium/13/chemie/erhoeht
- OpenStax, Acid-Base Titrations: https://openstax.org/books/chemistry-atoms-first-2e/pages/14-7-acid-base-titrations
- UMass Boston, schwache Basen/pOH am Halbäquivalenzpunkt: https://alpha.chem.umb.edu/chemistry/ch104/carter/files/104overheads/Ch104BrownCh17ov2.pdf
- Universität Köln, mehrprotonige Säuren und Erkennbarkeit von Stufen: https://www.uni-koeln.de/math-nat-fak/anorgchem/meyer/mitarbeit/pantenburg/praktikum/ws11_12/QuantiSeminar3.pdf
- Universität Greifswald, Titration von Glycinhydrochlorid und Literaturvergleich: https://biochemie.uni-greifswald.de/storages/uni-greifswald/fakultaet/mnf/biochemie/delcea/Teaching/W03-Glaselektrode_Bcs.pdf
- Universität Bayreuth, Aminosäuren/Glycintitration: https://daten.didaktikchemie.uni-bayreuth.de/umat/aminosaeuren/Aminosaeuren.pdf
- Huefner/Richmond, experimenteller Indikatorvergleich bei Ammoniak: https://doi.org/10.1007/s00897000392a
