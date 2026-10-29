# Auftrag für Claude Code: Halbtitrationslabor überarbeiten

Stand: 29.10.2026 · Referenz für den Review: `main`, Commit `9bd514b`

## Auftrag und Ziel

Überarbeite die bestehende SiVex-App unter `apps/halbtitration/` vollständig bis zum ausführbaren, geprüften Ergebnis. **Erhalte das tragfähige chemische Modell und die gelungene TitraLab-Apparatur. Ändere den Lernweg und die Oberfläche so, dass der eigene Versuch im Mittelpunkt steht und sich die App wie die anderen aktuellen SiVex-Apps bedienen lässt.** Behebe außerdem die unten beschriebenen Fehler der Auswertungslogik.

Die Schülerinnen und Schüler (SuS) kennen bereits die normale Säure-Base-Titration, Säure-/Basenstärke mit pKₛ-/pKᵦ-Werten sowie die zugehörigen Rechnungen. Zielgruppe bleibt Q13 Chemie, erhöhtes Anforderungsniveau, Gymnasium Bayern. Neu ist für sie die **experimentelle Bestimmung eines pK-Werts durch Halbtitration** und anschließend die Übertragung auf Basen und mehrprotonige Systeme.

Der gegenwärtige Einstieg ist für diese Lerngruppe zu theorielastig. Fünf Theorieblöcke mit Verständnisfragen und eine lange Planungsseite vor dem Experiment sind zu ersetzen. Die neue Reihenfolge lautet:

**Kurzer Auftrag → selbst titrieren → halben Umsatz untersuchen → gezielt halbtitrieren → Zusammenhang am eigenen Ergebnis begründen → vergleichen und sichern.**

Dies ist ein Umsetzungsauftrag, kein reiner Konzept- oder Reviewauftrag. Triff Routineentscheidungen selbst und arbeite bis zu funktionierenden, überprüften Web- und SCORM-Paketen weiter. Keine Veröffentlichung, kein Push und keine PR-Erstellung.

## 1. Bestand lesen und eigene Arbeit sauber abgrenzen

Lies vor Änderungen:

- geltende `AGENTS.md`;
- `README.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/MEBIS.md`;
- `shared/labkit/README.md` und `shared/labkit/DESIGN.md`;
- `apps/halbtitration/README.md` sowie die zugehörigen Dateien `docs/CHEMIE.md`, `BEDIENUNG.md`, `TESTBERICHT.md` und `UEBERNAHME.md`;
- `docs/reviews/halbtitration-2026-10-29/REVIEW.md` einschließlich der Bildnachweise, soweit im Checkout vorhanden;
- die aktuelle Oberfläche von Pufferfish und mindestens einer Trenn-App als Referenz für App-Hülle, Aufgaben, Hilfen und Ergebnisübersicht; Redoxlabor bleibt Referenz für Selbstkontrolle und Trainer.

Prüfe den tatsächlichen Git-Stand. Der Review wurde an `9bd514b` durchgeführt. Im früher vom Chat bereitgestellten Arbeitsordner war noch ein alter Branch mit lokalen Änderungen und Löschungen aktiv. **Nicht blind voraussetzen, dass das aktuelle Verzeichnis auf main steht. Keine fremden Änderungen, Löschungen oder unversionierten Dateien zurücksetzen, überschreiben oder bereinigen.** Nutze einen geeigneten aktuellen Checkout bzw. eine isolierte Arbeitskopie. Falls du eine neue Branch anlegst, verwende den Präfix `codex/`, sofern keine neuere ausdrückliche Vorgabe gilt.

Dieser Auftrag ersetzt beim ursprünglichen `prompts/halbtitrationslabor-build-claude.md` insbesondere:

- den Einstieg „Theorie und Planung zuerst“;
- die verpflichtende ausführliche Vorabplanung zur Indikatorwahl;
- obligatorische Wiederholungsrechnungen zu Start- und ÄP-pH als Voraussetzung für den Kernlernweg;
- die gleichrangige Präsentation aller vier Versuche als identische lange Pflichtdurchläufe.

Die übrigen fachlichen Anforderungen, eigenständigen Schülerhandlungen, Offlinefähigkeit und Auslieferungsanforderungen bleiben erhalten. Alle vier bestehenden Versuche bleiben vollständig bedienbar. Keine zweite Halbtitrations-App und keine alternative Produktionsfassung anlegen.

## 2. Neuer Einstieg: Essigsäure im Labor

Beim ersten Öffnen erscheinen das Labor, die leere Messkurve und ein kurzer Arbeitsauftrag, etwa:

> Bestimme den pKₛ-Wert einer Essigsäurelösung mithilfe einer Titration und einer pH-Messung. Nimm zunächst eine Titrationskurve auf und bestimme das Äquivalenzvolumen.

Zeige die notwendigen Ausgangsdaten kompakt. Vermeide einen Begriffsblock, die fertige Halbtitrationsregel, eine vollständige Herleitung oder einen Eingangstest als vorgeschaltete Seite. Bekanntes steht als freiwillige Hilfe zur Verfügung. Der Hefteintrag bleibt entsprechend den SiVex-Regeln jederzeit bewusst aufrufbar.

Die SuS wählen die passende Maßlösung und führen die vertraute Titration selbst aus. Eine separate lange Planungsseite ist dafür nicht nötig. Die bestehenden Gerätehandlungen bleiben nutzbar. Vorbereitung und Kalibrierung sollen verständlich, kompakt und handlungsgebunden sein. Sie dürfen den Lernweg nicht durch wiederholte, inhaltsarme Bestätigungsschritte dominieren.

Für den Kerndurchgang ist die **pH-metrische Auswertung** maßgeblich. Ein Indikator kann als zusätzliche Beobachtung gewählt werden. Die ausführliche Indikatorbegründung, Zielstufenauswahl und quantitative Eignungsprüfung sind eine freiwillige Vertiefung. Geeignete und ungeeignete Indikatoren müssen weiterhin fachlich sinnvoll untersucht werden können. Ohne Indikator darf keine Indikatorfrage den Ablauf blockieren.

Die Kurve entsteht ausschließlich aus tatsächlich übernommenen Messpunkten. Keine Zukunftskurve und keine vorweggenommenen Sollmarker. Die SuS bestimmen den ÄP aus ihrer eigenen Kurve. Ein berechnetes stöchiometrisches Äquivalenzvolumen kann anschließend als Kontrolle dienen; es ersetzt nicht die Untersuchung der eigenen Messung.

## 3. Halbtitration aus dem Versuch entwickeln

Nach der ersten Kurvenauswertung führt ein kurzer Untersuchungsimpuls zur neuen Idee:

> Betrachte die Hälfte deines Äquivalenzvolumens. Wie viel Essigsäure wurde bis dahin umgesetzt? Welche Stoffmengen von Essigsäure und Acetat liegen dann näherungsweise vor?

Die SuS sollen die Bedeutung dieses Punkts mit gestuften Hilfen erschließen können. Sie müssen den besonderen Punkt nicht ohne Anhaltspunkt erraten.

Verwende wenige, aufeinander bezogene Aufgaben zu:

1. Umsatz bei halbem Äquivalenzvolumen;
2. verbleibender Säure und gebildeter korrespondierender Base;
3. näherungsweise gleichem Stoffmengen- und Konzentrationsverhältnis;
4. selbst berechnetem Halbäquivalenzvolumen aus der eigenen Rechenbasis.

Geschlossene Antwortformate eignen sich für die Deutung; Volumina und Rechenergebnisse tragen die SuS selbst ein. Keine automatischen Ergebnisfelder für die gesuchten Größen.

Danach setzen die SuS eine **frische, gleich große Probe** an und dosieren selbst bis zu ihrem Zielvolumen. Die erste Reihe bleibt erhalten und kann als blasse Referenz erscheinen. Kalibrierung und vorbereitete Bürette bleiben erhalten; erforderliches Nachfüllen wird konsistent behandelt. Eine neue Probe erfordert keine Wiederholung bereits erledigter Gerätevorbereitung ohne fachlichen Grund.

Erhalte freie Dosierung, kleine Zugaben/Tropfen, selbst gesetzte Zielmarke, Misch- und Sensoransprechzeit. Kein automatischer Stopp am geheimen HÄP und keine Schaltfläche zum perfekten Halbtitrieren. Überschießen muss Folgen haben und durch eine weitere frische Probe korrigierbar sein.

## 4. Neue Beziehung am eigenen Ergebnis begründen

Die Begründung erfolgt am eigenen Versuch, mit dem bekannten MWG:

```text
HA + H₂O ⇌ H₃O⁺ + A⁻
Kₛ = c(H₃O⁺) · c(A⁻) / c(HA)

Bei c(A⁻) ≈ c(HA):
Kₛ ≈ c(H₃O⁺)
⇒ pKₛ ≈ pH
```

Lass die SuS die Kürzung und Schlussfolgerung in einem kurzen Trainer bzw. einer geführten Zuordnung selbst vollziehen. Nutze das bestehende SiVex-Muster mit „Prüfen“, konkreter Feldrückmeldung, drei Hilfestufen und bewusst angeforderter Lösung. Keine lange Herleitung als Lesetext vor dem Experiment.

Die vollständige Henderson-Hasselbalch-Gleichung bleibt als freiwillige Vertiefung erreichbar. Keine neue Lerneinheit zu Pufferwirkung, Pufferkapazität oder Pufferherstellung ergänzen; diese Inhalte gehören zu Pufferfish. Für das Kernziel dieser App genügt zunächst der direkte MWG-Zusammenhang am HÄP.

Anschließend bestimmen die SuS ihren experimentellen pKₛ-Wert aus der eigenen pH-Messung, reichen ihn ein und vergleichen mit dem freigegebenen Literaturwert. Knappe Fehlerdeutung und Hefteintrag sichern das Ergebnis.

Die bereits vorhandenen Rechnungen zu Start-pH und ÄP-pH bleiben als **Wiederholung/Vertiefung** nutzbar. Sie sind keine Voraussetzung für den Abschluss der eigentlichen pK-Bestimmung. Auch die umfangreiche Fehlerzerlegung ist ein Zusatz zur zunächst verständlichen Unterscheidung von Mess-/Durchführungsfehler, Rechenfehler und Näherungsgrenze.

## 5. Die anderen drei Versuche sinnvoll einordnen

### Ammoniak als Transfer

Arbeitsfrage: „Was ändert sich, wenn die Probe eine schwache Base ist?“ Die SuS untersuchen die fallende Kurve und übertragen den halben Umsatz auf das Basengleichgewicht. Die neue Zuordnung wird erst hier erarbeitet:

- am HÄP pOH ≈ pKᵦ;
- bei 25 °C pKᵦ ≈ 14,00 − pH;
- der gemessene pH entspricht näherungsweise pKₛ(NH₄⁺).

Diese verschiedenen Größen eindeutig beschriften. Keine pKᵦ-Literaturlinie fälschlich auf der pH-Achse zeigen. Bekannte Gerätevorbereitung und bereits verstandene Säureaufgaben nicht als komplette Text- und Fragenfolge wiederholen.

### Phosphorsäure und Glycin als Vertiefungen

Beide bleiben direkt anwählbar und vollständig ausführbar; ein erfolgreicher Essigsäuredurchgang ist keine technische Zugangssperre. Benenne ihre zusätzlichen Untersuchungsziele klar:

- zwei Protolysestufen und die zugehörigen ÄP/HÄP zuordnen;
- V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)]/2 verstehen;
- schwache oder fehlende Sprünge erkennen;
- Grenzen der einfachen Beziehung pH ≈ pKₛ untersuchen.

Die bisherigen Standardparameter liefern am ersten HÄP ungefähr:

| System | Modell-pH | pKₛ₁ des Modells | Differenz |
| --- | ---: | ---: | ---: |
| Phosphorsäure | 2,480 | 2,148 | +0,332 |
| Glycin | 2,572 | 2,350 | +0,222 |

Diese Abweichungen dürfen **nicht durch erzwungene pK-Treffer, dekorative Kurven oder unbegründete Änderungen der Konstanten beseitigt werden**. Die quantitative Näherungsgrenze ist hier Lerngegenstand. Bezeichne ein schlichtes Ablesen des ersten Halbäquivalenz-pH entsprechend als näherungsweise pK-Bestimmung und erläutere die systematische Abweichung nach dem eigenen Ergebnis.

Erhalte alle drei Phosphorsäuregleichgewichte im Solver, ohne einen ausgeprägten dritten Sprung zu erfinden. Glycin startet als definiertes Glycinhydrochlorid mit Chlorid-Gegenion. Beide gesuchten Glycinwerte sind pKₛ-Werte. Ein nicht belastbar sichtbarer zweiter ÄP darf aus Stöchiometrie bzw. dem ersten ÄP abgeleitet werden; die SuS rechnen selbst und die Herkunft wird gekennzeichnet.

## 6. Nachgewiesene Fehler verbindlich beheben

### A. Veraltete grüne Prüfzustände

Reproduktion im bisherigen Stand: Essigsäure → Auswertung → V(ÄP) = 24 prüfen → auf 30 ändern. Das Feld bleibt grün und zeigt weiterhin „Richtig berechnet“.

Die Eingabehandler in `js/ui/app.js` ändern `f.input`, entwerten aber die alte Prüfung nicht. Auch Marker-, Rechenbasis- oder Messreihenwechsel können abhängige Rückmeldungen veralten lassen. `submit()` in `js/ui/journal.js` prüft bereits bewertete pK-Felder nicht generell erneut.

**Gefordertes Verhalten:**

- Prüfungen an aktuelle Eingabe, relevante Rechenbasis und tatsächlichen Messnachweis binden.
- Bei Änderungen die betroffenen Rückmeldungen unmittelbar als ungeprüft/„erneut prüfen“ markieren; die alte grüne Bestätigung darf nicht fortbestehen.
- Abhängigkeiten berücksichtigen: etwa ÄP-Marker → HÄP-Rechnung; verwendeter Messpunkt/pH → pK-Rechnung → Differenz und Fehlerdeutung.
- Beim Ändern oder Ersetzen eines Messpunkts sowie beim Wechsel der ausgewerteten Reihe veraltete Punktnachweise erkennen.
- Bei Abgabe die aktuellen Daten neu bewerten.
- Bereits eingereichte Versuchswerte als unveränderliche historische Momentaufnahme erhalten; spätere Korrekturen getrennt anzeigen.

### B. Ergebnisabgabe ohne Messreihe

Reproduktion: Frischer Stand → direkt Auswertung → nur einen numerischen pK-Wert eintragen → abgeben. Ein allgemeiner Warnhinweis reicht bisher, um Referenzen freizuschalten und die Zahl als eigenen Versuchswert zu speichern.

**Gefordertes Verhalten:** Für die Abgabe eines **eigenen experimentellen Ergebnisses** müssen ein gültiges eigenes Zielvolumen, ein tatsächlich protokollierter Messpunkt der gewählten Halbtitrationsreihe sowie die Zuordnung der eigenen pH-Angabe zu diesem Punkt vorliegen. Zahlen dürfen nicht ohne experimentellen Nachweis als eigener Versuch eingereicht werden.

Die App darf weiterhin eigene Ergebnisse mit ungenauer Dosierung, überschrittenem Zielvolumen, früher Ablesung oder falscher Rechnung zur Reflexion annehmen, wenn ihre Herkunft nachvollziehbar und der jeweilige Mangel ausdrücklich gekennzeichnet ist. **Nicht nur perfekte oder richtige Ergebnisse zur Abgabe zulassen.**

Davon getrennt bleibt „Lösung anzeigen“ auch ohne gelungenen Versuch verfügbar, entsprechend den SiVex-Regeln. Bewusstes Aufrufen einer Musterlösung wird als solches gespeichert/angezeigt und nicht als eigene Messung oder eigener abgegebener Versuch ausgegeben. Keine künstlichen Messreihen oder ausgefüllten eigenen Ergebnisfelder erzeugen.

### C. Bestätigung „am Zielvolumen“ ohne Ziel

Die bisherige Funktion `Evaluation.checkMeasuredPH('4.76', [{v:12,pH:4.76,stable:true}], NaN)` bestätigt „Protokollierter Messwert am Zielvolumen“.

Ohne gültiges Zielvolumen darf die App nur bestätigen, dass der pH-Wert in der Messreihe vorkommt. Die Zuordnung zum HÄP bleibt offen. Mit Zielvolumen sind Übereinstimmung, Abweichung und Messstatus getrennt auszuweisen. Die rechnerisch richtige Ableitung eines pK-Werts ist kein Beleg dafür, tatsächlich am HÄP gemessen zu haben.

### D. Speziesdarstellung und Gleichgewicht

Die aktuelle Hervorhebung verwendet `Chemistry.stoichiometricForms()`. Der Begleittext behauptet geringe Anteile benachbarter Formen. Der Solver berechnet jedoch am Start etwa 44,4 % Dihydrogenphosphat bzw. 34,8 % Glycin-Zwitterion.

Ersetze die irreführende Aussage. Eine schematische Reaktionsfolge ist als solche zu kennzeichnen und darf nicht als tatsächliche Mengenverteilung erscheinen. Wenn Gleichgewichtsanteile gezeigt werden, müssen sie aus dem vorhandenen Solver stammen. Exakte Anteile bzw. automatische Umsatzwerte, die gesuchte Lösungspunkte vorwegnehmen, erst passend zur Bearbeitung oder nach bewusst angeforderter Hilfe anzeigen. Keine neue umfangreiche Teilchenanimation als Pflichtumfang.

## 7. Oberfläche, Grafik und Bedienung an SiVex angleichen

Nutze die aktuelle App-Hülle und Bedienmuster des vorhandenen **Labkits**, soweit sie passen. Prüfe dafür die tatsächlich implementierten Bausteine und die aktuellen Apps. Übernimm nicht lediglich ähnliche Farben. Die Fachlogik und Titrationsapparatur bleiben in der Halbtitrations-App. Keine app-spezifische Chemie in `shared/` verschieben.

- **Start im Labor.** Ersetze die dominante nummerierte Navigation „Theorie → Planung → Labor → Auswertung“. Aufgabe, Protokoll/Ergebnisse, kurze Herleitung und Hefteintrag sollen nach den bekannten SiVex-Mustern erreichbar sein. Die laufende Messung und ihre Daten bleiben beim Wechsel erhalten.
- **Apparatur erhalten.** Bürette, Stativ, Tropfenweg, Kolben, Rührer, Elektrode, Meniskus und Mischschlieren bleiben groß, räumlich stimmig und an den Experimentzustand gekoppelt. Keine generische Dashboard-Szene als Ersatz.
- **Vorbereitung kompakt.** Erledigte Vorbereitungsgruppen einklappen und ihren Status knapp zeigen. Bei Bedarf wieder öffnen können. Die wesentlichen Messhandlungen dürfen nicht unter langen Listen verschwinden.
- **Messbedienung zusammenhalten.** Dosiermenge, Zugeben, Hahn öffnen/schließen, pH-/Volumenanzeige und Messwertübernahme sind gemeinsam erreichbar, ohne zwischen entfernten Abschnitten zu scrollen. Nicht sämtliche Handlungen gleichzeitig mit gleichem Gewicht anzeigen.
- **Labor und Kurve gleichzeitig sichtbar.** Die Titrationskurve ist ein Messinstrument und bleibt während des Experiments sichtbar. Ein ausschließliches Umschalten zwischen Labor und Kurve genügt nicht. Auf Tablets die bisherigen drei schmalen Spalten entlasten; Bedienfeld einklappbar und sinnvoll dimensionierbar gestalten.
- **Werkzeuge passend zur Aufgabe.** Erst Messdaten und ÄP-Auswertung, danach HÄP-Hilfen; spätere Vergleichswerkzeuge bei Bedarf. Keine permanente Ansammlung von Markern, Referenzschaltern und Ableitungsoptionen. Vorhandene Datenbereichsansicht besser auffindbar machen. Achsen dürfen nur aus Gerätekapazität oder bereits verfügbaren Daten skaliert werden, nicht aus geheimen ÄP-Volumina.
- **Bürettenablesung konsistent.** Da Ablesen bekannt ist, im normalen Kernlernweg die sichtbare digitale Ablesung sinnvoll übernehmen und redundante Pflichtprüfungen vermeiden. Lupe und bewusste Ableseübung können als freiwilliges Angebot bleiben; dabei die zu übende Antwort nicht gleichzeitig digital vorsagen. Anfangsstand, Endstand und Verbrauch bleiben fachlich korrekt unterschieden.
- **Ergebnisübersicht.** Eigene Versuche kompakt vergleichen: System, Stufe, eigenes ÄP-Volumen und Herkunft, Zielvolumen, tatsächliches Messvolumen, gemessener pH mit Status, bestimmter pK-Wert und nach Freigabe Literatur/Differenz. Messwerte, Ableitungen, Korrekturen und Musterlösungen unterscheiden.
- **Hilfen und Hefteintrag.** Drei zustandsbezogene Hilfestufen, bewusst angeforderte Lösung, präzise deutsche Rückmeldungen. Kurzer Hefteintrag ungefähr im bestehenden SiVex-Umfang. Keine Punkte, Belohnungsmechanik oder zusätzlichen Inhaltsmodule.

Teste die Anordnung bei **1440×900, 1180×820 und 1024×768**. Keine globale Verkleinerung zu winzigen Gerätebeschriftungen, keine horizontale Überbreite. Wichtige Touchziele etwa 44 CSS-Pixel oder größer; Maus, Touch und Tastatur müssen dieselben Funktionen erreichen.

Falls eine Änderung am gemeinsamen Labkit wirklich notwendig wird, halte sie klein und rückwärtskompatibel und prüfe die betroffenen bisherigen Nutzer. Bevorzuge vorhandene Bausteine und app-lokale Ergänzungen. Andere Apps nicht im Rahmen dieses Auftrags umgestalten.

## 8. Fachmodell, Daten und bestehende Funktionen erhalten

Erhalte die Trennung zwischen Chemie, Laborzustand, Messgerät, Renderer und Auswertung. Der bestehende durchgängige Gleichgewichtssolver ist die Grundlage. Änderungen daran nur für einen konkret belegten Fehler; dokumentiere dann Ursache und unabhängige Prüfung.

Verbindlich bleiben:

- Stoff-, Ladungs- und Volumenbilanzen, Verdünnung und Wasserautoprotolyse;
- 25 °C und dokumentiertes pK𝑤 = 14,00;
- keine erzwungenen Halbäquivalenz-pK-Treffer;
- klare Trennung von Äquivalenzpunkt, Indikator-Endpunkt und Neutralpunkt;
- stufenrichtige Halbäquivalenzvolumina;
- unverfälschte eigene Messreihen, endliche Dosier-/Ableseauflösung, Mischen und Sensoransprechzeit;
- konsistente Bürettenbilanz und kein Rückgängigmachen verbrauchter Maßlösung;
- getrennte Rückmeldung für Rechnung, Messung/Durchführung und Näherung/Modellgrenze;
- Dezimalkomma, sinnvolle Rundungen und passende Einheiten;
- ΔpK und ΔpH mit Vorzeichen; keine prozentuale pK-/pH-Abweichung;
- Literaturdaten und Modellreferenz erst nach eigener Abgabe oder bewusster Anforderung einer Lösung; kein unbemerkter Lösungszugriff über Export, Kurvenmarker oder Beschriftungen;
- Export/Druck mit eigenen Messdaten, Kurve, Rechnungen, freigegebenen Referenzen und Reflexion.

Der verwendete Glycinwert pKₛ₂ ≈ 9,78 ist im dokumentierten Datensatz enthalten. Nicht allein wegen abweichender Schulwerte auf 9,60 ändern. Datenquelle, Bedingungen, Rundung und Modell müssen konsistent bleiben. Die Unterschiede zu Pufferfish bei verwendeten Rundungen/Datensätzen knapp und nachvollziehbar dokumentieren; keine umfassende gemeinsame Chemiebibliothek als Nebenprojekt entwickeln.

Erhalte bestehende lokale Messdaten und Eingaben soweit fachlich zuordenbar. Bei Änderungen des Speicherformats Versionierung/Migration vorsehen. Vorhandene Daten nicht stillschweigend löschen, alte Literaturfreigaben nicht fälschlich als neue erfolgreiche Bearbeitung werten. Fehler beim lokalen Speichern dürfen die App nicht blockieren.

„Neue Probe“, „Messreihe wiederholen“ und „gesamtes Labor zurücksetzen“ behalten unterschiedliche, verständliche Bedeutungen. Eine neue Probe löscht keine gespeicherten Reihen oder Rechnungen.

## 9. Prüfen, selbst korrigieren und ausliefern

Führe die Anwendung wirklich aus und behebe gefundene Fehler. Vorhandene 28 Unit-Tests bestanden im Review; das ersetzt nicht die Prüfung der neuen Abläufe. Ergänze gezielte Regressionstests für die gefundenen Fehler, keine massenhaften Tests von Implementierungsdetails.

### Verbindliche Nachweise

1. **Prüfstatus:** Korrekte Eingabe prüfen → Eingabe ändern; Rechenbasis/Marker ändern; ausgewählte Reihe wechseln; benutzten Messpunkt ersetzen. Alte Bestätigungen dürfen nicht weiter gültig erscheinen. Bei Abgabe werden die aktuellen Daten bewertet. Historische Versuchswerte bleiben unverändert.
2. **Nachweis und Musterlösung:** Ohne Messreihe keine eigene experimentelle Abgabe. Ohne Ziel keine Bestätigung „am Zielvolumen“. Bewusst angeforderte Lösung ist auch ohne gelungenen Versuch möglich und klar getrennt. Vorzeitige/ungenau dosierte reale eigene Messung kann mit passender Kennzeichnung abgegeben werden; eine richtige Rechnung daraus wird als solche erkannt.
3. **Essigsäure vollständig:** Direkter Laborstart → Kurve → eigener ÄP → halber Umsatz → eigene Zielrechnung → frische Halbtitration → pH → kurze MWG-Begründung → eigener pK → Literaturvergleich → Ergebnisübersicht → Bericht. Ohne vorgeschaltete Theorieprüfung oder obligatorische Start-/ÄP-pH-Rechnungen.
4. **Ammoniak vollständig:** Transfer, fallende Kurve, eigene pOH-/pKᵦ-Umrechnung, richtige Bezeichnung der korrespondierenden Säure.
5. **Phosphorsäure und Glycin vollständig:** Direkter Einstieg in die Vertiefung möglich, beide vorgesehenen Stufen, korrekte zweite Halbäquivalenz und gegebenenfalls abgeleiteter zweiter ÄP. Näherungsabweichung der ersten Stufe korrekt erklärt; Speziesdarstellung stimmt mit ihrer Beschriftung überein.
6. **Durchführung und Speicherung:** Überschießen, ohne Rühren, frühe Ablesung, neue Probe, Wiederholung, Versuchswechsel, Neuladen, vorhandener alter Speicherstand sowie Speicherfehler. Keine verlorenen ersten Reihen und keine automatisch erfundenen Messwerte.
7. **Grafik und Bedienung:** Desktop und beide Tabletgrößen tatsächlich visuell prüfen, mit Screenshots vom Start, Messbetrieb, Trainer und Ergebnisvergleich. Tropfen/Mischen als Übergang beobachten. Wesentliche Messhandlungen gleichzeitig sichtbar. Touch-/Tastaturbedienung und Splitter prüfen. Emulation als Emulation benennen.
8. **Pakete:** Web- und SCORM-ZIP reproduzierbar erzeugen, frisch entpacken und unabhängig vom Quellcodeverzeichnis starten. Lokale Ressourcen, Startpfade, Manifest, fehlende Dateien, Konsole und Netzwerk prüfen. Kein Backend, Schülerlogin, CDN, KI-Dienst oder Datenversand ergänzen. SCORM ohne verpflichtende Noten-/Personendatenübertragung.

Version nach Repo-Konvention erhöhen, Status weiterhin `prototype`. README, Bedienung, Chemiedokumentation, Changelog und Testbericht auf den tatsächlich erreichten Stand bringen. Aktuelle Release-Dateien und SHA256-Prüfsummen nach der bestehenden Repo-Konvention bereitstellen. Historische Pakete nicht außerhalb dieser Konvention duplizieren.

Berichte jede Prüfung mit **PASS**, **HOLD – failed**, **HOLD – incomplete** oder **HOLD – unverified**, jeweils mit konkretem Nachweis. Ohne echten iPad-/Safari- bzw. mebis-Test keine entsprechende Freigabe behaupten. Fehlende Umgebungstests ausdrücklich offenlassen; sie rechtfertigen keine Platzhalter in der App.

## 10. Fertigkriterien und Abschluss

Der Auftrag ist abgeschlossen, wenn:

- die App im Labor mit kurzem Auftrag startet;
- die neue Halbtitrationsidee aus dem eigenen Versuch entwickelt und am bekannten MWG begründet wird;
- Essigsäure den Kernlernweg bildet, Ammoniak Transfer und die mehrprotonigen Systeme ausdrücklich Vertiefungen sind;
- alle vier Versuche weiter vollständig funktionieren;
- die vier beschriebenen Fehler behoben und gezielt geprüft sind;
- Labor, dynamische Kurve und Messbedienung auf Desktop/Tablet sinnvoll gemeinsam nutzbar sind;
- Aufbau, Hilfe, Selbstkontrolle, Ergebnisübersicht und Hefteintrag den aktuellen SiVex-Mustern entsprechen;
- Messdaten, Rechnungen und bewusst angeforderte Lösungen korrekt behandelt und gespeichert werden;
- Dokumentation, Tests sowie beide ausführbaren Release-Pakete aktualisiert sind.

Liefere am Ende eine kurze Übersicht: umgesetzter Lernweg, wesentliche Änderungen und Dateien, behobene Fehler, ausgeführte Prüfungen und konkrete offene Punkte, Startanweisung und Pfade der Pakete. Kein pauschales „alles funktioniert“, wenn Nachweise fehlen.
