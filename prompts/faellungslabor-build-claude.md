# Build-Auftrag für Claude: SiVex – Fällungslabor

**Auftragsversion:** 1.0 · 16.11.2026  
**Repository:** sscheidl/SiVex  
**Neue Anwendung:** apps/faellungslabor/  
**Anzeigename:** Fällungslabor  
**Metadaten-ID:** chemie/faellungslabor  
**Ziel:** erste funktionsvollständige Version 1.0.0, fertige eigenständige HTML-Anwendung sowie Web- und mebis-SCORM-1.2-Paket.  
**Ausgangsbasis der Bestandsaufnahme:** main, Commit 5f063f89c84e022278a6c151462be4e5e5316055. Vor Arbeitsbeginn den aktuellen Stand prüfen.

## 0. Dein Auftrag

Baue dieses Labor vollständig, führe die unten genannten fachlichen und technischen Prüfungen durch, untersuche Fehler, korrigiere sie und prüfe die betroffenen Abläufe erneut. Liefere tatsächlich startbare Artefakte. Ein Konzept, eine Klickattrappe, ein statisches Endbild oder ein ungetesteter Zwischenstand erfüllt den Auftrag nicht.

Arbeite selbstständig durch Bestandsaufnahme, Implementierung, Build, Browserprüfung, Korrekturen und Paketprüfung. Routineentscheidungen anhand dieses Auftrags und des bestehenden SiVex-Codes treffen und dokumentieren. Neuere ausdrückliche Nutzeranweisungen haben Vorrang. Fehlende reale iPad-/mebis-Zugänge wahrheitsgemäß als HOLD – unverified ausweisen; dadurch nicht die mögliche Entwicklung und Auslieferung der übrigen Funktionen abbrechen.

Diese Spezifikation dokumentiert die endgültigen Gesprächsentscheidungen. Historische Vorschläge sind ausdrücklich ersetzt:
- Natriumbromid, NaBr, verwenden. Bariumbromid war ein Tippfehler und gehört nicht ins Labor.
- Auswertung durch geschlossene Aussagen-/Gleichungsauswahl. Kein verpflichtendes Ionenpuzzle, kein verpflichtender Gleichungsbaukasten und kein Freitext-Lückentext als Hauptaufgabe.
- Vollständige Ionengleichungen in den Aufgaben; gekürzte Gleichungen dürfen in der Zusammenfassung stehen.
- Kontrollversuche in einem eigenen unabhängigen Reiter. Keine Voraussetzung für andere Versuche.
- Carbonatlösung und Salpetersäure sind keine Reagenzien und keine Versuchsschritte. Mögliche Störungen und die Rolle des Ansäuerns ausschließlich in einer knappen optionalen Auswertung erläutern.
- Wasserproben liefern keine analytisch eindeutige Halogenidbestimmung.

## 1. Repository zuerst lesen und gezielt erweitern

Vor Änderungen Git-Arbeitsstand und geltende AGENTS.md prüfen; fremde Änderungen erhalten. Lies:
- README.md, docs/ARCHITECTURE.md, docs/QUALITY.md, docs/MEBIS.md und apps/_template/README.md.
- shared/labkit/README.md und DESIGN.md; passende Bausteine einschließlich js/learn.js, js/scorm.js und Splitter.
- TitraLab 3: apps/titration/js/view/lab-renderer.js, geometry.js, theme.js, js/ui/app.js, css/styles.css, Build-/Paketskripte und Browsertests.
- Redoxlabor: apps/redoxlabor/js/ui.js, chemistry.js und redox.js als Vorbild für Protokoll, Aussagen, Hilfen, Rückmeldungen und Ergebnisübersicht.
- Ein aktuelles Labkit-Modul, beispielsweise apps/pufferfish/, für Build, SCORM und Metadaten. Dessen alte inhaltliche Build-Aufträge gelten nicht als Anforderungen an dieses Labor.

TitraLab 3 ist die verbindliche Referenz für Glas, Meniskus, Tropfen und Flüssigkeitsdarstellung. Sein Quellcode liegt entpackt vor; keine alten ZIPs rekonstruieren. Übernommene Teile samt Herkunft dokumentieren, Fachlogik aus der Titration nicht unverändert in die Fällungschemie übernehmen.

Arbeite auf einem eigenen Implementierungsbranch, etwa feature/faellungslabor. Quellcode, Tests und Pakete dort sichern und zur Prüfung bereitstellen; kein automatischer Merge nach main und keine Veröffentlichung auf einem Live-Server. Den vorliegenden Auftragsbranch beziehungsweise die Auftragsdatei in die Arbeitsbasis übernehmen, wenn der Auftrag noch nicht auf main liegt.

Neue App nur unter apps/faellungslabor/. Zentrale README-Anwendungsübersicht und Architektur passend ergänzen; den bereits vorhandenen geplanten Eintrag ersetzen, nicht doppelt anlegen. Gemeinsame Bausteine bevorzugt verwenden. Änderungen an shared/labkit nur bei tatsächlichem Bedarf und mit Prüfungen betroffener Apps. Sonstige Chemielabore unverändert erhalten.

## 2. Fachlicher Umfang und vorbereitete Lösungen

Vorratslösungen stehen fertig bereit. Keine Herstellung aus Feststoffen, keine Waage, kein zusätzliches Syntheseexperiment.

| Lösung | Festlegung | Einsatz |
|---|---|---|
| Silbernitrat, AgNO₃(aq) | 0,100 mol/L | tropfenweise Fällungsreagenz |
| Natriumchlorid, NaCl(aq) | 0,100 mol/L | Chloridprobe |
| Natriumbromid, NaBr(aq) | 0,100 mol/L | Bromidprobe |
| Natriumiodid, NaI(aq) | 0,100 mol/L | Iodidprobe |
| Verdünnte Ammoniaklösung, NH₃(aq) | konkrete Konzentration festlegen, siehe unten | erweiterte Löslichkeitsprüfung |
| Konzentrierte Ammoniaklösung, NH₃(aq) | konkrete Konzentration festlegen, siehe unten | erweiterte Löslichkeitsprüfung |
| Destilliertes Wasser | idealisierte halogenidfreie Modellprobe | negative Blindprobe; bei Bedarf Wasserzugabe |
| Leitungswasser | feste dokumentierte repräsentative Modellprobe | Alltagsprobe im Kontrollreiter |
| Mineralwasser | feste dokumentierte repräsentative Modellprobe | Alltagsprobe im Kontrollreiter |

Entwicklungsstartwerte: 2,00 mL vorgelegte Probe; bei Bedarf wählbar 1,00 / 2,00 / 3,00 mL. Einheitlicher Modell-Tropfen 0,050 mL, ausdrücklich Simulationsparameter und keine allgemeine Naturkonstante. Große Reagenzgläser mit ausreichend Reserve, beispielsweise 20 mL Fassungsvermögen. Tatsächliche Volumina und Reagenzkonzentrationen anzeigen.

Ammoniak: Als Arbeitsstartwerte sind 2,0 mol/L und 13,0 mol/L geeignet zu untersuchen, nicht als bereits validierte Versuchsvorschrift ausgeben. Überprüfe anhand verlässlicher Quellen und unabhängiger Referenzfälle die tatsächlichen Mengenverhältnisse, Verdünnung und den benötigten Überschuss. Falls fachlich erforderlich, diese Startwerte begründet anpassen. Danach konkrete Konzentrationen konsistent auf Etiketten, im Modell, in der Anleitung und Dokumentation verwenden. Bei Massenprozent/Molarität Umrechnung und Annahmen offenlegen.

Primäre Lernziele:
1. Aus gelösten Ionen entsteht ein schwer löslicher Feststoff.
2. AgCl, AgBr und AgI unterscheiden sich in Erscheinungsbild und Löslichkeit gegenüber Ammoniak.
3. Na⁺ und NO₃⁻ bleiben als Zuschauerionen gelöst.
4. Vollständige Ionengleichungen enthalten auch Zuschauerionen und Zustandsangaben.
5. Kontrollansätze helfen bei der Beurteilung einer Beobachtung; die Alltagswasserproben sind keine eindeutigen Halogenidanalysen.

Zielniveau: Gymnasium, Einführung in Ionen/Fällungsreaktionen und qualitative Nachweise; Ammoniak als Erweiterung. Metadaten-Jahrgänge nach Abgleich mit dem tatsächlichen bayerischen Lehrplan begründen, nicht ungeprüft Q13 aus Pufferfish kopieren.

## 3. Oberfläche und unabhängige Bereiche

### 3.1 Reiter „Fällungsreaktionen“

Drei große Reagenzgläser in einem Ständer gleichzeitig vergleichbar zeigen; weitere frische Ansätze für die Ammoniakprüfung ermöglichen. Reagenzgläser klar mit Probe und Ansatzkennung beschriften. Die Stoffnamen der entstehenden Niederschläge vor der eigenen Zuordnung nicht automatisch einblenden.

SuS wählen eine fertige Natriumhalogenidlösung, pipettieren ein bekanntes Volumen in das gewählte Reagenzglas und geben AgNO₃ tropfenweise hinzu. Sie können schwenken, absetzen lassen, erneut aufschwenken und Beobachtungen vergleichen.

Erweiterung „Ammoniakprüfung“ innerhalb dieses Bereichs: verdünnte oder konzentrierte Ammoniaklösung zu einem bereits gefällten Ansatz zugeben. Zwei frisch gleich angesetzte Proben vergleichbar nebeneinander untersuchen können. Keine versteckte Umwandlung einer benutzten Probe in eine frische Probe. Frische Vergleichsansätze nachvollziehbar herstellen.

Fällungsversuche können ohne Durchführung der optionalen Ammoniakerweiterung abgeschlossen werden. Die Erweiterung muss dennoch vollständig implementiert, ansteuerbar und getestet sein.

### 3.2 Reiter „Kontrollversuche“

Von Beginn an separat aufrufbar; Hauptversuche, Ergebnisübersicht und Hefteintrag bleiben ohne Besuch dieses Reiters nutzbar. Umgekehrt lässt sich der Kontrollreiter vor den Hauptversuchen durchführen.

Kurze Erklärung und direkt durchführbare Ansätze:
- Positivkontrolle: bekannte NaCl-Lösung + AgNO₃.
- Negative Blindprobe: destilliertes Wasser + AgNO₃.
- Alltagsproben: Leitungswasser und Mineralwasser + AgNO₃, wählbar und vergleichbar.

Gleiche Probenvolumina und vergleichbare Silbernitratmengen anbieten. Blindprobe ohne sichtbare Fällung; Positivkontrolle mit weißem AgCl-Niederschlag. Für beide hinterlegten Alltagswasserproben eine plausible Fällung eines Stoffgemischs zeigen. Zusammensetzung, Modellparameter und Grenzen dokumentieren; nicht behaupten, jedes reale Leitungs-/Mineralwasser müsse gleich reagieren.

Hier wird nur gezeigt, dass die ausgewählten Wasserproben gelöste Ionen enthalten, die mit Ag⁺ schwer lösliche Verbindungen bilden. Keine sichere Zuordnung zu Chlorid/Bromid/Iodid, keine Halogenid-Formelaufgabe zur Wasserprobe und keine pauschale Gleichsetzung „Trübung = Chloridnachweis“.

Verbindliche Aussage der Auswertung: „Leitungs- und Mineralwasser enthalten verschiedene gelöste Ionen. Bei Zugabe von Silbernitratlösung können mehrere schwer lösliche Silberverbindungen entstehen. Der Niederschlag kann deshalb ein Stoffgemisch sein. Welche Ionen darin enthalten sind, lässt sich mit diesem Versuch allein nicht eindeutig feststellen.“

Andere Anionen, beispielsweise Carbonat, und die analytische Rolle von Salpetersäure dürfen nur in einer optionalen knappen Erläuterung vorkommen. Dafür keine zusätzlichen Flaschen, Bedienaktionen oder Pflichtaufgaben einbauen. Keine zusätzliche Wasseranalytik-Engine entwickeln; ein dokumentiertes, handlungsabhängiges phänomenologisches Mischfällungsmodell genügt. Dieses klar von der speziesbezogenen Halogenidmodellierung unterscheiden.

### 3.3 Auswertung und Hefteintrag

Ergebnisübersicht mit gespeicherten Ansätzen und optionaler Ammoniakbehandlung. Ein eigener gut zugänglicher Bereich für den kurzen Hefteintrag. Kontrollversuche separat auswerten, nicht in die Pflichtfortschrittsberechnung des Hauptversuchs aufnehmen.

## 4. Geräte, Bedienung und sichtbare Vorgänge

### 4.1 Pipetten und Flüssigkeitstransfer

- Jede Vorratsflasche hat eine eigene zugeordnete Pipette; keine zusätzliche Kontaminationssimulation.
- Flasche antippen, Probe aufnehmen, Zielreagenzglas wählen und Flüssigkeit sichtbar überführen. Die Bedienung muss auch ohne präzises Drag-and-drop funktionieren.
- AgNO₃: Antippen = ein Tropfen; Gedrückthalten = kontinuierliche Folge einzelner Tropfen. Tempo begrenzen, damit Tropfen und Wolken erkennbar bleiben.
- Dosierung bei pointerup, pointercancel, Fokusverlust, Tabwechsel und vollem Ziel zuverlässig beenden. Maus und Tastatur als gleichwertige Bedienwege.
- Für größere Ammoniakmengen zusätzlich eine klar bezeichnete Dosierhilfe mit sichtbarer Pipettenüberführung anbieten. Ein größeres Volumen nicht als riesigen einzelnen Tropfen darstellen.
- Flüssigkeit erst bei tatsächlichem Eintreffen im Ziel buchen; abweichende Architektur ist möglich, wenn Animation und Bilanz nachweislich konsistent bleiben.
- Fallende Tropfen enden an der Flüssigkeitsoberfläche beziehungsweise am inneren Boden. Kein Durchdringen von Glas, Flüssigkeit oder Tisch; sauberer Flüssigkeits-Clip und erkennbarer Meniskus.
- Aktive Zugabe bei ausgeschöpfter Kapazität stoppen und „Reagenzglas ist voll“ anzeigen. Volumen- und Stoffbilanz bleiben erhalten. Keine unsichtbare Überfüllung.
- Ein Vorgang darf nicht doppelt durch Touch- und Mouse-Ereignisse ausgelöst werden.

### 4.2 Handlungsabhängige Niederschlagsdarstellung

Verbindlich: lokale Wolkenbildung am Eintreffpunkt des AgNO₃-Tropfens → Verteilung/Trübung → zeitabhängiges Absetzen. Schwenken als eigene sichtbare Handlung; abgesetzter Niederschlag wird wieder suspendiert.

| Feststoff | Optische Zielwirkung |
|---|---|
| AgCl | weiß |
| AgBr | cremefarben bis schwach gelb |
| AgI | erkennbar blassgelb, deutlich von AgBr unterscheidbar, nicht grell schwefelgelb |

Farben anhand realer Referenzaufnahmen und fachlicher Quellen prüfen, Herkunft und Abweichungen dokumentieren. Reale Referenzen im Entwicklernachweis; für die Laufzeit eigene Grafiken und rechtssicher verwendete lokale Assets. Niederschlagsmenge, Trübungsdichte, aufgewirbelter Anteil und Sediment müssen zum Modell passen. Keine identische maximale Trübung unabhängig von Tropfenzahl oder Resthalogenid.

Nicht den gesamten Ansatz als gleichmäßig deckende Farbfläche übermalen. Glas, klare Überstandsflüssigkeit und Sediment bleiben erkennbar. Ammoniakzugabe führt bei geeigneten Bedingungen zu sichtbar fortschreitendem Auflösen; Wasserzugabe ist hiervon zu unterscheiden.

Hell/dunkel umschaltbarer Hintergrund beziehungsweise Kontrastschirm hinter den Reagenzgläsern. Der Wechsel verändert keine chemischen Zustände, Modellzeit oder Niederschlagsmenge. In beiden Varianten lesbare Gefäßränder, Etiketten und Bedienung. Keine unbeauftragte Lichtzersetzungsfunktion.

Pause und 1× / beschleunigte Zeit anbieten. Sedimentations- und Mischzeiten sind didaktische Visualisierungsparameter, keine behaupteten experimentell exakten Messwerte. Bedienung beendet die Pause nach SiVex-Regel; Tabwechsel und Neuladen erzeugen keine blockierten oder doppelt laufenden Handgriffe.

### 4.3 Vorgehensgrenzen dezent kenntlich machen

Vorgänge außerhalb der Experimentieranleitung vor dem Stofftransfer abfangen, beispielsweise NH₃ vor der Silbernitratprobe, eine zweite andere Probelösung in denselben Ansatz oder Umfüllen in Vorratsflaschen.

Kurzes Verbotszeichen an der Pipette und Text: „Dieser Vorgang entspricht nicht der Experimentieranleitung.“ Zustand unverändert lassen; anschließend korrekte Aktion weiterhin möglich. Das Zeichen hat einen zugänglichen Text und verschwindet wieder. Ein wackelnder erhobener Zeigefinger ist optional, das dezente Symbol genügt. Bei reduzierter Bewegung keine Wackelanimation.

Diese Rückmeldung beschreibt den Versuchsumfang, keine chemische Unmöglichkeit. Sinnvolle Handlungen wie weitere AgNO₃-Zugabe, Schwenken und erneute Ammoniakzugabe dürfen nicht durch starre Klickfolgen blockiert werden. Keine Pflicht, erst Kontrollversuche zu erledigen.

### 4.4 Gefahrstoffinformationen

Vorratsflaschen mit korrektem Namen, Formel und Konzentration. Passende GHS-Piktogramme für die konkret enthaltene Lösung, wo vorgeschrieben; Wasser erhält keine erfundenen Gefahrensymbole. Antippen öffnet eine lesbare Informationskarte mit Stoff-/Lösungsdaten, Signalwort und knappen relevanten Gefahren-/Schutzhinweisen.

Piktogramme und Einstufung aus aktuellen geeigneten Sicherheitsdatenblättern für die tatsächliche Lösung ableiten. Kein ungeprüftes Übertragen der Reinstoffkennzeichnung auf verdünnte Lösungen. Quelle, Datum/Version, Konzentration und Zuordnung in docs/QUELLEN.md dokumentieren. Quellen werden zur Laufzeit nicht geladen. Informationskarte ohne Hover erreichbar, schließbar und auf dem iPad ohne Clipping lesbar. Keine pauschalen Aussagen zur rechtlichen Zulässigkeit realer Schulversuche erzeugen.

## 5. Fachmodell und Grenzen

Ein zentraler testbarer Zustand je Ansatz führt mindestens Volumen, eingebrachte Stoffmengen, gelöste Ag-/Halogenidbestände, Zuschauerionen, gefällten/komplexierten Silberanteil und den suspendierten/abgesetzten Feststoffanteil. DOM-freie Fachlogik von Darstellung und Aufgaben trennen.

Für die Hauptproben:
- Niederschlagsbildung stöchiometrisch begrenzt; Löslichkeit/Gleichgewichte in einem dokumentierten geeigneten Schulmodell berücksichtigen.
- Weitere AgNO₃-Zugabe nach weitgehender Halogenidaufzehrung erzeugt keinen unbegrenzten zusätzlichen Feststoff.
- AgCl löst sich bei ausreichender verdünnter NH₃-Zugabe; AgBr bleibt dabei im typischen Versuchsbereich weitgehend bestehen und löst sich bei ausreichender konzentrierter Zugabe; AgI bleibt sichtbar bestehen.
- Das Auflösen hängt von vorhandener Feststoffmenge, freiem Ammoniak, Verdünnung und Halogenidüberschuss ab. Kein binärer Flaschenname-Schalter, der unabhängig von der Zugabemenge alles auflöst.
- Geeigneter Ansatz: gekoppeltes Löslichkeits-/Komplexgleichgewichtsmodell; eine begründete und gegen Referenzfälle geprüfte quantitative Näherung ist zulässig. Keine unnötige allgemeine Speziationsengine.
- Gelöstes Silber wird durch NH₃ als Diamminsilber(I)-Komplex gebunden. Fällung/Komplexierung erzeugen keine Atome oder Ladung. Komplexgleichungen sind erläuternde Vertiefung, keine Pflichtaufgabe.
- Volumenänderung, Restkonzentrationen und Wiederaufschwenken konsistent behandeln. Wasser erzeugt keine zusätzlichen Ionen.
- Keine NaCl-/NaBr-/NaI-Moleküle in wässriger Lösung behaupten.

Zu Quellenkonstanten Temperatur, Einheiten und Näherungsbereich nennen. Unabhängige Referenzwerte oder nachvollziehbare Handrechnungen verwenden; den Solver nicht mit seinen eigenen Ergebnissen als Sollwert bestätigen. Toleranzen vor dem Vergleich festlegen. Für repräsentative Mengenbilanzen relative Abweichung höchstens 10⁻⁶ beziehungsweise dokumentierte strengere Solver-/Absoluttoleranz bei winzigen Beständen. Niemals negative Stoffmengen, NaN oder unendliche Werte.

Eine zusätzliche animierte Teilchenansicht ist für diesen Auftrag nicht erforderlich. Vorrang haben die handlungsabhängige Makroansicht und die korrekte Auswertung.

## 6. Lernkontrolle: richtige und falsche Aussagen

Geschlossene Auswahlformate nach dem SiVex-Muster. Je Themenblock wenige präzise Fragen, keine lange Prüfungsmaschine.

Verbindliche Aufgaben:
1. Beobachtungen der drei Fällungen richtig zuordnen: Trübung, Farbe, Absetzen, Schwenken.
2. Reagierende Ionen und Zuschauerionen unterscheiden.
3. Für jede der drei Halogenidproben die richtige vollständige Ionengleichung auswählen.
4. In der optionalen Ammoniakerweiterung Löslichkeitsbeobachtungen und Schlussfolgerungen zuordnen.
5. Im unabhängigen Kontrollreiter Zweck von positiver/negativer Kontrolle und Grenzen der Wasserprobe beurteilen.

Kennzeichnung: „Wähle eine richtige Antwort“ oder „Wähle alle zutreffenden Aussagen“. Im Mehrfachauswahlfall ist nur die exakte richtige Auswahlmenge vollständig richtig; richtige Teilantworten trotzdem konkret rückmelden. Weder „alles ankreuzen“ noch eine leere Auswahl darf Erfolg ergeben. Fachlich mehrdeutige oder nur durch Wortklauberei falsche Distraktoren vermeiden.

Beispiele typischer Fehlvorstellungen: Na⁺ sei Bestandteil des Niederschlags; alle Ionen verschwänden aus der Flüssigkeit; eine Trübung belege in einer beliebigen Wasserprobe eindeutig Chlorid; beide NH₃-Konzentrationen wirkten auf alle Niederschläge gleich.

Richtige vollständige Ionengleichungen, alle Ladungen und Zustandsangaben sichtbar setzen:

~~~text
Na⁺(aq) + Cl⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgCl(s) + Na⁺(aq) + NO₃⁻(aq)
Na⁺(aq) + Br⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgBr(s) + Na⁺(aq) + NO₃⁻(aq)
Na⁺(aq) + I⁻(aq)  + Ag⁺(aq) + NO₃⁻(aq) → AgI(s)  + Na⁺(aq) + NO₃⁻(aq)
~~~

Distraktoren gezielt zu falschem Feststoff, Ladung, Zustandsangabe oder fehlenden Zuschauerionen. Eine gekürzte Gleichung ist chemisch richtig, erfüllt aber diese Aufgabenstellung nicht; Rückmeldung entsprechend „Die Fällungsreaktion ist richtig dargestellt. Ergänze die Zuschauerionen zur vollständigen Ionengleichung.“ Nicht pauschal fachlich falsch nennen. Keine allein durch vertauschte Summanden erzeugten „falschen“ Optionen.

„Prüfen“ gibt konkrete Rückmeldung je Aussage/Aufgabe; Korrektur bleibt möglich. Hilfen in drei Stufen, „Lösung anzeigen“ bewusst anfordern. Kein automatisches Aufdecken der Produktnamen oder Musterlösungen während der Beobachtung. Eingaben und dokumentierte Ansätze bei Tab-/Themenwechsel erhalten. Wenn ein Ansatz verändert wird, zuvor gespeicherte Beobachtung dem alten Ansatz zuordnen und darauf hinweisen, statt sie stillschweigend umzuschreiben.

Optionale eigene Notiz unbewertet; keine automatische fachliche Freitextbewertung. Kein verpflichtender Ionenbaukasten und kein verpflichtendes manuelles Tippen komplexer Formeln auf dem iPad.

## 7. Kurzer Hefteintrag, immer zugänglich

Fester fachlich richtiger Text, unabhängig vom Versuchserfolg und ohne erfundene persönliche Messergebnisse. Von Anfang an erreichbar, als abschließende Sicherung gekennzeichnet. Richtwert 80–100 Wörter einschließlich knapper Legende, dazu höchstens eine kurze allgemeine Gleichung. In ungefähr fünf Minuten abschreibbar; kein mehrseitiger automatisch erzeugter Versuchsbericht.

Inhalt: Fällung als Feststoffbildung, Farben aller drei Silberhalogenide, Zuschauerionen und Ergebnisse der Ammoniakprüfung. Hier ist die vereinfachte Gleichung erlaubt:

~~~text
Ag⁺(aq) + X⁻(aq) → AgX(s), mit X = Cl, Br oder I.
~~~

Beispieltext als fachliche Grundlage:
„Silberionen bilden mit Chlorid-, Bromid- und Iodidionen schwer lösliche Silberhalogenide. Silberchlorid ist weiß, Silberbromid cremefarben bis schwach gelb und Silberiodid blassgelb. Die Niederschläge verursachen zunächst eine Trübung und können sich später absetzen. Natrium- und Nitrationen bleiben als Zuschauerionen gelöst. Silberchlorid löst sich bei ausreichender Zugabe verdünnter Ammoniaklösung. Silberbromid benötigt konzentrierte Ammoniaklösung; Silberiodid bleibt dabei ungelöst. Die Ammoniakprobe hilft, die Niederschläge zu unterscheiden.“

Sinnvoll um eine knappe Definition „Fällungsreaktion“ ergänzen, ohne den Richtwert zu überschreiten. Kurzfassung der Kontrollversuche separat im Kontrollreiter, etwa 30–45 Wörter. Diesen Zusatz nicht ungefragt an den Haupthefteintrag anhängen. Drucken/Kopieren kann optional angeboten werden und darf den sichtbaren kurzen Text nicht ersetzen.

## 8. Responsivität, Zugänglichkeit und Zustand

- Große Laborbühne und ausreichend große Reagenzgläser haben Vorrang; kein leerer oberer Raum bei winzigem Versuch am unteren Rand.
- Verschiebbare Trennlinie Labor/Bedienfeld nach TitraLab 3 und QUALITY.md: Maus, Finger, Tastatur, sinnvolle Grenzen und Rücksetzen. Unter schmaler Breite untereinander.
- Touchziele mindestens 44 × 44 CSS-Pixel; Menüs und Gleichungen dürfen nicht abgeschnitten sein. Lange Gleichungen können sinnvoll innerhalb der Karte umbrechen; keine globale horizontale Scrollpflicht.
- Große Gleichungen auf dem iPad lesbar; Ladungen und Indizes korrekt, auch ohne externe Schrift/Bibliothek. Darstellung funktioniert ohne Netzwerk.
- Hintergründe, Status, Auswahl und Rückmeldungen nicht ausschließlich durch Farben vermitteln. Fachliche Farbnamen erst in der Auswertung/Hilfe; zugängliche Beschreibungen ohne ungewollte Lösungsvorwegnahme.
- Fokus nach Touch-Eingaben darf native Auswahllisten nicht selbstständig öffnen. Bildschirmtastatur darf essenzielle Kontrollen nicht dauerhaft verdecken.
- Kurze Anleitung auf der Seite; keine technischen Implementierungsinformationen in der Schüleroberfläche.
- Neues Reagenzglas/Ansatz zurücksetzen und gesamten Lernstand zurücksetzen klar unterscheiden. Gesamtrücksetzen bestätigen.
- Ansätze, Antworten und Darstellungseinstellungen nur lokal speichern. Storage-Fehler abfangen; Anwendung funktioniert auch ohne verfügbaren Speicher.
- Nach Neuladen stabile Zustände wiederherstellen; keine halb fertige aktive Pipettierung oder pausierte Blockade. Der Kontrollreiter bleibt unabhängig.
- Keine zusätzlichen Schülerkonten, externen KI-Dienste oder Übertragung von Antworten, Noten, Fortschritten und personenbezogenen Daten.

## 9. Build, HTML und mebis-SCORM tatsächlich ausliefern

Modulare wartbare Quelle unter apps/faellungslabor/. Zusätzlich fertige Artefakte mit konsistenter Version 1.0.0:
- release/faellungslabor-1.0.0.html – eigenständig öffnende einzelne HTML-Datei mit eingebetteten lokalen Stilen/Skripten/Assets, ohne Nachladen aus dem Quellbaum.
- release/faellungslabor-1.0.0-web.zip – vollständige statische Web-App mit index.html und allen benötigten Dateien.
- release/faellungslabor-1.0.0-scorm12.zip – vollständiges SCORM-1.2-Paket für mebis.
- release/SHA256SUMS.txt – Prüfsummen für alle drei Nutzerartefakte.

Single-HTML und Web-App müssen frisch bereitgestellt ohne Internet und auch direkt über file:// funktionieren. Keine beim Doppelklick an CORS scheiternden ES-Modul-/fetch-Ladevorgänge. Paketierungsstrategie entsprechend wählen. Service Worker nur optional mit eigenem Scope/Cache; lokale Datei benötigt keinen Service Worker.

SCORM: imsmanifest.xml im ZIP-Stamm, gültige SCORM-1.2-Namespaces, genau definierter SCO-Startpunkt index.html, alle Ressourcen im Paket, keine fehlenden/außerhalb liegenden Pfade. Modul startet mit und ohne LMS-API sowie aus iframe und neuem Fenster. Ohne LMS keine Fehlermeldungsschleife. Init/Finish nach bestehendem Adapter; keine LMS-Daten zu Lernstand, Antworten oder Personen lesen oder schreiben. Im Mock alle LMS-Aufrufe protokollieren und unerlaubte GetValue-/SetValue-Nutzung ausschließen.

Bevorzugte mebis-Darstellung: neues Fenster; Einbettung bleibt grundsätzlich lauffähig. Installations-/Importanleitung für die Lehrkraft in README, keine Garantie einer nicht durchgeführten realen mebis-Prüfung.

Reproduzierbare Skripte mindestens:
~~~sh
cd apps/faellungslabor
npm ci
npm test
npm run build
npm run package
npm run test:e2e
npm run test:scorm
npm run test:all
~~~
Skripte passend implementieren; Reihenfolge, benötigte Laufzeit und Browserinstallation dokumentieren. Ein Fehler muss einen fehlgeschlagenen Prozessstatus liefern. Test:all muss Unit-/Modell-, Build-/Paket-, Browser- und Mock-SCORM-Prüfungen tatsächlich enthalten.

Pflichtdateien: index.html, sivex.json, package.json + Lockfile, README.md, CHANGELOG.md, docs/CHEMIE.md, docs/BEDIENUNG.md, docs/QUELLEN.md, docs/TESTBERICHT.md und nachvollziehbare Tests. App-Titel „Fällungslabor“ in App, Metadaten, Manifest und zentraler Übersicht. Zielversion an allen Stellen gleich. Funktionsvollständige Entwicklung und Unterrichtsfreigabe separat halten; siehe Abschnitt 12.

## 10. Verbindliche PASS/HOLD-Matrix

Jede Zeile braucht im Testbericht ID, Prüfverfahren, Eingangsdaten, Schritte, Soll/Ist, Status, Datum und konkreten Nachweis. Fachliche Zahlenfälle mit Eingaben, Konstanten und Toleranzen. Browsernachweise mit Browser/Version, Viewport und Kennzeichnung real/emuliert. Screenshots während laufender Übergänge, nicht nur Endbilder.

| ID | Prüfung | PASS | HOLD |
|---|---|---|---|
| FL01 | App/Integration | Richtiger neuer Name/Pfad/Metadaten; funktionierende Übersichtslinks; bestehende Apps erhalten | Doppelter Eintrag, fehlender Einstieg oder Regression |
| FL02 | Vorratslösungen | AgNO₃ und NaCl/NaBr/NaI jeweils 0,100 M; genaue NH₃-Werte konsistent; kein BaBr₂/Carbonat/HNO₃ als Reagenz | Falsches Salz, fehlende Lösung, inkonsistente oder zusätzliche ausgeschlossene Reagenzien |
| FL03 | Drei Fällungen | Alle drei selbst durchgeführt; richtige Produkte/Farben; Fachreferenz dokumentiert | Falsche Produkte, austauschbare/übertriebene Farben oder bloße Attrappe |
| FL04 | Aktive Tropfen | Einzel-/Dauertropfen sichtbar, korrektes Ziel, Bilanz zeitlich konsistent | Tropfen durch Glas/Tisch, Doppelbuchung, Menge vor falschem Ziel |
| FL05 | Flüssigkeit/Glas | Meniskus, steigender Füllstand, Clipping und Kapazität passend | Unsichtbare Zugabe, falscher Füllstand, Überfüllung |
| FL06 | Wolken/Trübung | Mehrere Zwischenbilder belegen lokale Wolke und handlungsabhängige Verteilung | Nur Endbild oder pauschaler Farbwechsel |
| FL07 | Sedimentation/Schwenken | Sichtbares Absetzen, klarerer Überstand und erneutes Suspendieren bei Erhaltung der Feststoffmenge | Feststoff verschwindet, Schwenken ohne Wirkung oder spontane Mengenerzeugung |
| FL08 | Mengen/Grenzen | Nullzugabe, 1/mehrere Tropfen, verschiedene Probenvolumina, Ag-Überschuss und Aufzehrung plausibel | Unbegrenzte Fällung, falscher limitierender Stoff, NaN/negative Werte |
| FL09 | Bilanzen | Silber-/Halogenid-/Zuschauerionen-/Volumenbilanz über vollständige Abläufe innerhalb festgelegter Toleranz | Ungeklärte Verluste/Erzeugung oder Toleranzen nachträglich passend gemacht |
| FL10 | NH₃/AgCl | Bei zu kleiner Menge ggf. Rest; bei ausreichender verdünnter Zugabe plausibles Auflösen | Sofortiges mengenunabhängiges Verschwinden oder keine Löslichkeit |
| FL11 | NH₃/AgBr | Verdünnt weitgehend beständig; konzentriert bei geeigneten Mengen sichtbar löslich | Wirkung vertauscht, unbegründete Flaschenname-Automatik oder keine Mengenreferenz |
| FL12 | NH₃/AgI | Sichtbarer AgI-Rest auch bei vorgesehener konzentrierter NH₃-Zugabe | AgI wird analog zu AgCl/AgBr vollständig gelöscht |
| FL13 | Grenzen der Anleitung | Ungültige Aktion ohne Stofftransfer, kurzer verständlicher Hinweis; danach weiter bedienbar | Still falsche Chemie, Stoffverlust, Sackgasse oder unnötige Pflichtschritte |
| FL14 | Kontrollen unabhängig | Hauptteil ohne Kontrollbesuch abschließbar; Kontrollteil zuerst nutzbar; Zustände separat erhalten | Kontrolle sperrt Hauptteil, Pflichtfortschritt vermischt oder Wechsel setzt alles zurück |
| FL15 | Positive/negative Kontrolle | NaCl positiv, destilliertes Wasser ohne sichtbare Fällung; vergleichbare Bedingungen | Falsche Blindprobe oder fehlende Durchführung |
| FL16 | Alltagswasser | Beide Modellproben plausibel trüb; Mischfällung/Grenzen erklärt; keine eindeutige Halogenidzuordnung | Trübung als sicherer Chloridnachweis, universelle Wasserbehauptung oder Säurepflicht |
| FL17 | Auswahlaufgaben | Richtig/teilrichtig/falsch/leer/alles gewählt fachlich korrekt unterschieden; Korrektur möglich | Beliebiges Anklicken besteht oder widersprüchliche Distraktoren |
| FL18 | Vollständige Gleichungen | Alle drei mit aq/s, richtigen Ladungen und Zuschauerionen; gekürzt als unvollständig erläutert | Nur gekürzte Gleichungen verlangt, falsche Zustände oder Zuschauerionen fehlen |
| FL19 | Hilfen/Lösungen | Alle Hilfestufen und bewusste Lösungsausgabe bedienbar; keine vorzeitige Produktauflösung | Automatische Musterlösung, kaputte Hilfen oder versteckte Pflicht zur Lösungsausgabe |
| FL20 | Hefteintrag | Immer erreichbar, knapp, sachlich, Farben/NH₃/Zuschauerionen + eine kurze Gleichung; Kontrolle separat | Hinter Erfolg gesperrt, unrichtiger oder zu langer Text |
| FL21 | Hell/dunkel | Gleicher Zustand/Mengen; Farben und Ränder auf beiden Hintergründen brauchbar | Themenwechsel verändert Chemie oder macht Ansatz unlesbar |
| FL22 | Etiketten/GHS | Konkrete Lösungen/SDB belegt; lesbare touchbedienbare Infokarten | Reinstoffkennzeichnung blind kopiert, erfundene Symbole oder Platzhalter |
| FL23 | Tablet/Desktop | 1024×768, 1180×820, 1440×900, 1920×1080 und Hochformat 820×1180: Labor, Gleichungen, Dialoge, Splitter bedienbar | Clipping, unlesbare Miniatur, unerreichbare Schaltflächen |
| FL24 | Eingabe/Abbruch | Maus, Tastatur und Touch-Emulation; Dauerzugabe endet bei Loslassen, Abbruch, Fokusverlust und Tabwechsel | Festhängende Pipette, Doppelauslösung oder Hintergrunddosierung |
| FL25 | Pause/Reset/Speicher | Kein blockierter Handgriff; gezielter Reset; Reload und Storage-Verweigerung funktionsfähig | Zustandsverlust ohne Hinweis, Resume-Doppelung oder Pause-Sackgasse |
| FL26 | Single-HTML | Frische einzelne Datei außerhalb des Repos per file:// und HTTP: volle Funktion, offline | Quellordner benötigt, Fetch-/Modulfehler, fehlende eingebettete Assets |
| FL27 | Web-ZIP | Frisch außerhalb des Repos entpackt; file:// und HTTP samt Haupt-/Kontroll-/Auswertungsablauf bestanden | Test nur gegen Quellcode/dist oder fehlende Ressourcen |
| FL28 | SCORM-Struktur | Frisches ZIP, Manifest im Stamm, gültige Referenzen und Startpfad, sämtliche Ressourcen lokal | Defektes Manifest, falscher SCO-Pfad oder verschachteltes Manifest ohne Start |
| FL29 | Mock-LMS | iframe + opener/neues Fenster, ohne API, Init/Finish und Fehlerpfade geprüft; keine Lern-/Personendatenaufrufe | Nur ZIP geöffnet, Mock fehlt, Abbruch oder unzulässige LMS-Datenzugriffe |
| FL30 | Netzwerk/Konsole | Frischer Cache, externe Netze blockiert: alle Artefakte vollständig; keine ungeklärten Konsolenfehler | CDN/Remote-Font/API nötig oder verdeckte Netzwerkfehler |
| FL31 | Paketidentität | Versionen, frischer Build, vollständige SHA256SUMS und ausgelieferter Quellstand stimmen überein | Alte ZIPs, falsche Versionen oder Prüfsummen |
| FL32 | Reales iPad | Auf tatsächlichem iPad/Safari vollständige Kernabläufe inkl. Touch/Layout geprüft und belegt | Fehler = failed; kein echtes Gerät = unverified, Emulation zählt separat |
| FL33 | Tatsächliches mebis | Frisch importiertes SCORM-Paket in mebis mit bevorzugtem neuem Fenster auf Zielgerät getestet | Fehler = failed; nur Mock oder kein Zugang = unverified |
| FL34 | Fachliche/visuelle Lehrkraftabnahme | Lehrkraft bestätigt Modell, Texte und Farben der ausgelieferten Version | Beanstandung = failed; noch nicht erfolgt = unverified |

Zusätzliche Regressionen bei gemeinsamen Änderungen nach dem tatsächlich betroffenen Umfang durchführen. Tests auf ausgelieferten Artefakten sind verpflichtend; bestandene Quellcode-Tests ersetzen sie nicht.

## 11. Arbeitsfolge und Korrekturschleife

1. Bestandsaufnahme und kurze Implementierungsentscheidung dokumentieren.
2. Stoffmodell mit unabhängigen Referenzfällen und Bilanzen entwickeln.
3. Hauptlabor einschließlich echter Übergänge und Touchbedienung bauen.
4. Ammoniakerweiterung und unabhängigen Kontrollreiter vollständig ergänzen.
5. Aussagen-/Gleichungsauswahl, Hilfen, Ergebnisübersicht und kurzen Hefteintrag einbauen.
6. GHS-/Quellenkarten, Responsivität, Zustandsspeicher und Randfälle prüfen.
7. HTML, Web-ZIP und SCORM-ZIP reproduzierbar erzeugen.
8. Alle entwicklungsseitig durchführbaren Matrixfälle ausführen; tatsächliche Screenshots/Bildfolgen visuell ansehen.
9. Fehler korrigieren; betroffene Tests und begründete Regressionen erneut ausführen. Nach letzter Codeänderung Pakete neu erzeugen und die betroffenen Paket-/Browserprüfungen gegen genau diese Artefakte wiederholen.
10. Vollständigen Testbericht und Abschluss mit Artefaktlinks/Dateipfaden liefern. Fehlende Nachweise ausdrücklich offenlassen.

Nicht bei „Tests grün“ stehen bleiben, wenn Screenshots sichtbare Fehler zeigen. Keine Testfälle abschwächen, um die Implementierung durchzubringen. Fehlende Ressourcen/Browserinstallation zunächst im erlaubten Rahmen beheben; nicht durch erfundene Prüfergebnisse ersetzen.

## 12. Abnahme und ehrlicher Status

- PASS: tatsächlich erfolgreich überprüft, mit Nachweis.
- HOLD – failed: konkreter Fehler nachgewiesen.
- HOLD – incomplete: Pflichtfunktion/Artefakt fehlt.
- HOLD – unverified: Prüfung nicht durchgeführt oder Nachweis fehlt.

**Entwicklungs-PASS:** FL01–FL31 vollständig nachgewiesen, Pflichtumfang funktionsvollständig, alle relevanten automatisierten Tests erfolgreich, HTML/Web-/SCORM-Artefakte frisch aus identischem Quellstand erstellt. Eine fehlende Erlaubnis oder ein echter technischer Blocker eines dieser Tests ist ein offener HOLD, kein stillschweigendes PASS.

**Unterrichtsfreigabe / ready:** zusätzlich FL32–FL34 für exakt die ausgelieferte Version erfolgreich. Ohne reales iPad, tatsächlichen mebis-Import oder Lehrkraftabnahme bleiben diese Punkte ausdrücklich HOLD – unverified und sivex.json auf prototype, auch wenn das Labor entwicklungsseitig fertig und paketiert ist. Das ist eine ausstehende Abnahme, keine Erlaubnis zu fehlenden Pflichtfunktionen.

Bei Restfehlern fertige App nicht behaupten. Artefakte mit klar benanntem Reststatus liefern, soweit sinnvoll; den Hinderungsgrund und einen reproduzierbaren nächsten Prüfschritt nennen. Keine automatische Veröffentlichung, kein automatischer Merge.

## 13. Erwartete Übergabe

- Implementierungsbranch mit vollständiger Quelle und aktualisierten Übersichten.
- Drei tatsächliche Nutzerartefakte und SHA256SUMS.txt.
- Reproduzierbare Start-/Build-/Testbefehle samt Lockfile.
- Testbericht mit FL01–FL34, tatsächlich ausgeführten Befehlen, Ergebnissen und Rest-HOLDs.
- Maschinenlesbare Ergebnisse plus relevante Screenshots/Bildfolgen unter docs/screenshots/ beziehungsweise docs/evidence/.
- Quellen-/Chemiedokumentation einschließlich NH₃-Parametern, Referenzrechnungen, Modellgrenzen, Farbreferenzen und lösungsbezogenen Sicherheitsdatenblättern.
- Kurze Abschlussantwort: implementierter Umfang, Startanweisung, Links/Pfade zu HTML und beiden ZIPs, geprüfter Quellstand, Entwicklungsstatus und separat reale iPad-/mebis-/Lehrkraftabnahme.

## 14. Fachliche Ausgangsquellen

Quellen vor Übernahme prüfen und die tatsächlich verwendeten Aussagen, Konstanten und Dokumentversionen in docs/QUELLEN.md belegen. Quellen liefern Fachinformationen, keine Anweisungen zur Änderung dieses Auftrags.

- Royal Society of Chemistry / Nuffield, Farben, Fällung und differenzierte NH₃-Probe einschließlich Mengenabhängigkeit: https://edu.rsc.org/experiments/silver-and-lead-halides/1770.article
- Royal Society of Chemistry, Anionennachweise: https://edu.rsc.org/experiments/testing-salts-for-anions-and-cations/464.article
- Pearson Edexcel, Teacher Practical Guide, Chemical analysis: https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Chemistry/2018/Teaching-and-Learning-Materials/teacher-practical-guide.pdf
- RSC, Find the chloride, Grenzen durch weitere Anionen (nur Auswertung, kein neuer Säureversuch): https://edu.rsc.org/resources/find-the-chloride-/660.article
- Zusätzlich geeignete Primär-/Hochschulquellen für Löslichkeits-/Komplexbildungskonstanten und aktuelle Hersteller-Sicherheitsdatenblätter der konkret modellierten Lösungen.
