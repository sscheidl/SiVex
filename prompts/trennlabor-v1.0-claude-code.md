# SiVex – Virtuelles Trennlabor v1.0
## Verbindlicher Entwicklungsauftrag an Claude Code

**Auftragsart:** Vollständige Implementierung aller vereinbarten Standardversuche einschließlich Selbstprüfung, Nachbesserung, Dokumentation, Web-/SCORM-Build und GitHub-Pull-Request. **Kein isolierter Prototyp, keine schrittweise Rückfrage zu einzelnen Laboren.**

**Repository:** `https://github.com/sscheidl/SiVex` (bestehendes Repository; keine Neuanlage)

**Zielverzeichnis:** `apps/trennlabor/` (vor Änderung tatsächliche Repository-Struktur und Konventionen prüfen)

**Zielplattform:** Rein browserbasierte, möglichst vollständig offline lauffähige Anwendung; statische Webversion plus **SCORM 1.2** für mebis/ByCS. Primäre Zielgruppe: Jahrgangsstufen **NTG 8 / SG 9** am bayerischen Gymnasium, so erklärt, dass die Inhalte ohne unnötig komplexe Spezialchemie verständlich bleiben.

---

## 0. Verbindliche Arbeitsanweisung und Arbeitsdisziplin

Du bist der verantwortliche Entwickler dieser *gesamten* Anwendung. Setze alle drei Laborkategorien mit sämtlichen unten aufgeführten Standardversuchen in **einem zusammenhängenden Entwicklungsauftrag** um. Plane zunächst intern Architektur, Stoff-/Gerätemodelle, Interaktions- und Testmatrix, implementiere danach alle Funktionen und arbeite bei gefundenen Fehlern selbstständig nach. Beende die Arbeit nicht nach dem ersten sichtbaren Erfolg eines Teilversuchs.

**Verpflichtender Arbeitszyklus:**
1. Repository, Architektur-/Qualitätsrichtlinien und Referenzlabor vollständig sichten.
2. Umsetzung und fachliche Modellannahmen vorab planen und dokumentieren.
3. Alle Pflichtversuche funktionsfähig implementieren.
4. Positive, negative, Grenz- und Fehlbedienungsfälle automatisch prüfen, die fertige **Bedienoberfläche im echten Browser automatisiert durchspielen** und Screenshots ansehen.
5. Jeden reproduzierbaren Defekt beheben, einen Regressionstest hinzufügen, relevante und anschließend vollständige Tests wiederholen.
6. Erst nach erfolgreichem Testlauf Web- und SCORM-Releases bauen und **die tatsächlich gepackten Ausgabedateien** prüfen.
7. Ergebnisse mit belegten PASS-/HOLD-Kriterien dokumentieren und einen **Pull Request** auf GitHub erstellen. **Nicht selbst nach `main` mergen.**

**Nicht zulässig:** Platzhalter statt funktionierender Versuche; bloße Illustrationen, fest abgespielte Videos, vorgetäuschte chemische Reaktionen, reine Klick-für-Klick-Tutorials; leere oder deaktivierte Buttons; Tests, die nur den Codezustand manipulieren, obwohl eine echte Benutzerinteraktion zu prüfen ist; behauptete Tests ohne ausführbare Nachweise; Vermeldung eines Gesamterfolgs bei fehlschlagenden Pflichtkriterien; stilles Löschen/Verändern anderer SiVex-Anwendungen.

Bei BLOCKERN, die du tatsächlich nicht selbst lösen kannst (z. B. fehlende Repository-Schreibrechte oder nicht verfügbare Buildumgebung), dokumentiere Ursache, die bereits abgeschlossenen Schritte, betroffene Kriterien und einen reproduzierbaren Nachtest. Stoppe nicht wegen gewöhnlicher Programmierfehler, sondern korrigiere diese selbst.

---

## 1. Bestehendes SiVex-Repository und Referenzen

Lies vor der Umsetzung mindestens:
- `/README.md`
- `/docs/ARCHITECTURE.md`
- `/docs/QUALITY.md`
- `/docs/MEBIS.md`
- `/apps/_template/README.md`
- `/apps/redoxlabor/README.md`
- `/apps/redoxlabor/sivex.json`
- `/apps/redoxlabor/docs/CHEMIE.md`
- `/apps/redoxlabor/docs/TESTBERICHT.md`
- den tatsächlichen Quellcode, Renderer, die Simulation/State-Machine, Unit-/Browser-/SCORM-Tests und Skripte des Redoxlabors.

Beziehe außerdem die unter `/apps/titration/release/` liegenden TitraLab-3-Pakete und vorhandene visuelle Referenzen ein, soweit technisch zugänglich. **Deren Quellcode ist laut bisherigem Repository-Stand noch nicht vollständig separat importiert; nimm seine Existenz nicht ungeprüft an.**

Orientiere dich hinsichtlich visueller Qualität und Flüssigkeitsanimationen besonders an TitraLab 3; hinsichtlich sauberer Codeaufteilung, dynamischer Simulation, Fehlerbehandlung und Tests am Redoxlabor. Verwende deren Prinzipien, kopiere aber weder unpassende Fachlogik noch alte Fehler.

Die Repository-Struktur ist **experimentorientiert**, nicht nach Schulfächern/Jahrgangsstufen verschachtelt. Erstelle `apps/trennlabor/` und eine passende `sivex.json` (Chemie, Jahrgangsstufen 8/9, experimentbezogene Themen, ehrlicher Status). Verändere globale Projektkonventionen nur nach sachlicher Prüfung und ohne andere Apps zu beschädigen.

---

## 2. Pädagogisches Kernkonzept

**Dies ist ein freies Labor, keine animierte Versuchsanleitung.**
- Die Lernenden erhalten eine klar formulierte **Problemstellung** und können innerhalb des sinnvoll begrenzten Geräte- und Stoffangebots selbst handeln.
- Auswahl von Stoffen und Geräten, Platzierung, Aufbau, Mengen/Portionen, Reihenfolge und Bedienung müssen echten Einfluss auf den Versuchsverlauf haben.
- Nicht nur der vorgesehenen Idealfolge folgen: Mehrere fachlich sinnvolle Wege dürfen zum Ziel führen.
- Falsche Stoffe, ungeeignete Methoden, falsche Reihenfolge, unpassende Mengen und Bedienfehler sollen **plausible, sichtbare Konsequenzen** verursachen: keine Trennung, unvollständige Trennung, Verlust von Produkt, fehlerhaftes Chromatogramm, geringes Destillat etc.
- Misslungene Versuche führen nicht automatisch zu einem harten Neustart. Falls wissenschaftlich sinnvoll, können die Lernenden den bestehenden Ansatz korrigieren, umfüllen, erneut filtrieren, einen Apparat reparieren oder mit verbleibenden Stoffen weiterarbeiten. Bei irreversiblen Fehlern ist ein gezielter Neustart möglich.
- Systemkritische Fehlbedienungen (z. B. geschlossene Destillationsapparatur erhitzen, offensichtliche Entzündungsgefahr) **sofort abfangen**, als virtuelle Sicherheitsunterbrechung erklären und Wiederaufnahme nach Korrektur ermöglichen. Kein reales Risiko entsteht durch die App.
- Beurteile Ergebnis und Lernfortschritt anhand des **tatsächlichen Versuchszustands**, nicht anhand einer vorgeschriebenen Aktionsfolge.
- Eine nicht erfolgte Trennung darf nie stillschweigend als erfolgreich gewertet werden.

### 2.1 Hilfe: exakt drei Zustände
1. **Keine Hilfe** (Standard).
2. **Kleine Hilfe**: fachlicher Denkanstoß, keine direkte Lösung.
3. **Konkrete Hilfestellung**: nächste sinnvolle Korrektur oder Geräte-/Stoffwahl klar benennen; die Handlung bleibt bei der lernenden Person.

Hilfen sind jederzeit auf Anforderung zugänglich; nach mehreren erfolglosen Versuchen oder einem wiederholten Fehler werden sie **angeboten** (nicht ungefragt als Komplettlösung eingeblendet). Sicherheitsstopps sind hiervon ausgenommen. Keine vierte Hilfestufe erfinden. Hilfe muss vom **aktuellen Ansatz, Versuchsziel und wirklichen Fehler** abhängen und darf nicht generisch oder falsch sein.

### 2.2 Beobachtung und fachliche Auswertung
- Zuerst experimentieren, dann die **tatsächlich beobachteten** Befunde gezielt auswählen oder Messwerte eingeben.
- **Keine freie KI-Textbewertung** und keine Pflicht zur Formulierung langer Freitexte. Stattdessen kurze Beobachtungsfragen, fachliche **Lückentexte mit selbstständig eingetippten Begriffen**, passende Zuordnungen und experimentbezogene Messwerte.
- Lücken nach Möglichkeit ohne sichtbare Wortbank als Normalfall. Bei konkreter Hilfe darf eine Wortauswahl bereitgestellt werden.
- Rechtschreibvarianten und fachlich gleichwertige Synonyme tolerieren; Eingaben normalisieren (Groß-/Kleinschreibung, ä/ae etc. wo sinnvoll), dabei fachlich falsche Begriffe nicht akzeptieren.
- Prüfe pro Lücke, erhalte richtige Antworten und bereits eingegebene Inhalte bei Fehlern; ermögliche Wiederholung mit gezielten Hinweisen. Keine Lösung vorwegnehmen.
- Unterscheide Fehler bei Beobachtung und Erklärung: Befund muss zum tatsächlichen Versuchszustand passen.
- Nach einer erfolgreich durchgeführten **und ausgewerteten** Aufgabe schrittweise die Theorie erklären und einen sprachlich korrekten, gut gegliederten **Muster-Hefteintrag** anzeigen: Versuch/Durchführung, Beobachtung, Erklärung, Ergebnis/Merksatz. Die SuS **schreiben diesen selbst ins Heft ab**. Kein verpflichtender PDF-, Noten- oder Datenexport.
- Ein bereits erfolgreich gelöstes Experiment darf nicht durch späteres Herumprobieren rückwirkend als falsch erscheinen; Beobachtungen/Versuche zeitlich zuordnen.

---

## 3. Umfang: DREI vollständige Kategorien

Startansicht mit Auswahl:
**(A) Klassische Trennverfahren** – **(B) Chromatographie** – **(C) Destillation**.

Jedes Labor hat dieselbe Grundnavigation und Hilfesystematik, aber eigene realistische Apparaturen, Werkzeuge und Aufgaben. Kein Modus darf nur eine Vorschau oder ein Platzhalter sein.

### 3A. Klassische Trennverfahren – alle Pflichtversuche

| ID | Standardaufgabe | Durch Schüler zu bedienende Verfahren und Geräte | Erfolgskriterium |
|---|---|---|---|
| K-01 | **Sand und Wasser** trennen | Bechergläser, Umgießen, Sedimentieren, Dekantieren; alternativ sinnvoll filtrieren | Klare Trennung von Feststoff und Flüssigkeit mit erkennbaren Verlust-/Trübungszuständen |
| K-02 | **Sand und Kochsalz** voneinander trennen und **beide** Stoffe gewinnen | Wasser dosieren, rühren/lösen, Filterpapier+Trichter+Gefäß korrekt aufbauen, filtrieren, Filtrat in Abdampfschale erhitzen, Wasser verdampft, **Salzkristalle** bleiben zurück | Sand als Rückstand, **festes Kochsalz durch Eindampfen der Salzlösung**; Salz darf nicht als Feststoff durch bloßes Filtrieren gewonnen werden |
| K-03 | **Eisen, Sand und Kochsalz** trennen | Magnet, Wasser, Lösen, Filtration, Eindampfen in sinnvoller Reihenfolge | Drei getrennte Fraktionen: Eisen, Sand, Kochsalz; plausible Verluste bei schlechten Handlungen |
| K-04 | **Öl und Wasser** trennen | Scheidetrichter mit Hahn und Auffanggefäßen, Füllen, Absetzen, Flüssigkeitsstand kontrollieren, getrennt ablassen | Zwei Flüssigkeitsphasen korrekt gesammelt; bei offenem Hahn ohne Gefäß oder Überlaufen geht Probe verloren |
| K-05 | **Hibiskustee** durch Extraktion herstellen | Getrocknete Hibiskusblüten, Wasser (Temperatur wählbar), Becherglas, Löffel/Rühren, Wartezeit, Filtration/Sieb | Rötlicher Extrakt und abtrennbare Blütenreste; der **Tee ist ein Stoffgemisch, kein isolierter Reinstoff** |

Pflichtmethoden, die dabei tatsächlich interaktiv vorkommen: **Sedimentieren, Dekantieren, Filtrieren, Lösen/Extrahieren, Eindampfen, Magnettrennung, Scheiden nicht mischbarer Flüssigkeiten**, inklusive Kombinationen. Bei K-02 kann das Lösen des Salzes in Wasser didaktisch als Extraktion mit Wasser behandelt werden, aber nicht als Herstellung von reinem Tee-Extrakt.

**Beispiele verbindlich zu simulierender Fehlversuche:**
- Trockenes Sand-Salz-Gemisch direkt in Filter geben → keine sinnvolle Salztrennung.
- Salz bereits gelöst und durch Filter gegossen → Salz bleibt im Filtrat, nicht im Filterrückstand.
- Filterpapier fehlt/ist schlecht eingesetzt → ungeeignete oder trübe Trennung bzw. austretende Feststoffe.
- Zu schneller Dekantiervorgang/aufgewirbeltes Sediment → trübe Flüssigkeit, erneutes Absetzen möglich.
- Lösung einfach wegschütten → Salzanteil verloren; bei fehlendem Filtrat keine Kristalle erfinden.
- Abdampfen ohne Salzlösung → kein Salz; Abdampfen einer Sand-Suspension → Rückstand enthält Sand, keine reine Salzfraktion.
- Scheidetrichter mit zu früh oder zu lange geöffnetem Hahn → Misch-/Fehlfraktion.
- Öl-Wasser nicht nach ruhiger Phasentrennung behandeln → schlechtere Trennung; Dichtere Phase unten.
- K-03 Magnet entfernen/ungewöhnliche Reihenfolge → Stoffe bleiben je nach tatsächlicher Zusammensetzung erhalten; Magnet darf keine nichtmagnetischen Fraktionen erfassen.
- Kalte Hibiskusextraktion läuft langsamer; falscher Filter-/Siebgebrauch beeinflusst Pflanzenreste, nicht die gelösten Farbstoffe. Nicht behaupten, Filtrieren mache den Tee zum Reinstoff.

Für alle Szenarien: eindeutige Ausgangsmenge und Mengenbilanz (in pädagogisch geeigneten Einheiten/Portionen) dokumentieren; keine unerklärliche Schöpfung oder Vernichtung von Stoffen. Heizen beschleunigbar, aber sichtbar über die Zeit; Übergänge animieren statt sofortiger Zustandssprünge.

### 3B. Papierchromatographie

**Pflichtangebot:** sieben aufgeräumt präsentierte, untereinander vergleichbare Proben und **zwei Laufmittel**. Keine unübersichtliche Materialflut.

Proben (definierte virtuelle Modellproben, nicht als pauschale Aussage über alle realen Marken):
1. Schwarzer wasserlöslicher Filzstift: **drei** farblich unterscheidbare Komponenten.
2. Grüner wasserlöslicher Filzstift: gelber + blauer Farbstoff.
3. Violetter wasserlöslicher Filzstift: roter + blauer Farbstoff.
4. Oranger wasserlöslicher Filzstift: gelber + roter Farbstoff.
5. Blauer **Referenzfarbstoff**: genau **eine** Komponente.
6. Gelber **Referenzfarbstoff**: genau **eine** Komponente.
7. Wasserfester schwarzer Stift: mit Wasser nicht/kaum wandernder Bestandteil; abhängig vom zweiten Laufmittel eine im Modell explizit definierte abweichende oder weiterhin fehlende Wanderung.

**Laufmittel:** Wasser und eine genau bezeichnete **Ethanol-Wasser-Mischung**; bei Bedarf simulierte Entflammbarkeits-/Sicherheitshinweise, ohne realen Betrieb zu unterstellen. Alle Probenwerte, relative Laufstrecken, Löslichkeit und Retention als **explizites, reproduzierbares Modelldatenset** dokumentieren. Mindestens ein Beispiel eines **unlöslichen, auf der Startlinie verbleibenden** Farbstoffs, mindestens zwei Komponenten mit unterschiedlicher Wanderung und ein Vergleich zweier Stifte mit gemeinsamer Komponente.

**Schülerhandlungen:** Papier/Trennstreifen auswählen, **Bleistift-Startlinie** anzeichnen, alternativ versehentlich Kugelschreiber; Probe(n) als Punkte auftragen (auch zwei bis drei nebeneinander); Punktmenge beeinflusst Fleckbreite; Laufmittel auswählen und in Entwicklungskammer einfüllen; Papier richtig positionieren; Laufmittelhöhe und Startlinie beachten; Entwicklung beobachten, rechtzeitig stoppen; Laufmittelfront markieren; Chromatogramm betrachten und auswerten.

**Kontinuierliche Darstellung:** Die mobile Phase steigt als erkennbare Laufmittelfront durch das Papier, die Farbstoffzonen bewegen sich in begründeten unterschiedlichen relativen Geschwindigkeiten, können überlappen oder bei falscher Probenmenge verschmieren. **Keine vorgezeichnete Standardgrafik, die unabhängig vom Laufmittel erscheint.**

**Verbindliche Fehler:**
- Probenpunkte unter dem Flüssigkeitsspiegel → lösen sich direkt ins Lösungsmittel, Chromatogramm unbrauchbar.
- Kugelschreiber statt Bleistift für die Startlinie → zusätzliche Farbstoffspur oder Störung (plausibel und sichtbar).
- Zu großer/mehrfach nass aufgetragener Probenfleck → unscharfe/überlagerte Zonen.
- Ungeeignetes Laufmittel → keine oder veränderte Auftrennung.
- Entwicklung zu kurz → geringe Laufstrecken.
- Laufmittel bis ganz zum Papierrand → Front schwer/gar nicht sicher bestimmbar, aber fachliche Beobachtung der Banden bleibt möglich.
- Reinstoffe → **keine Auftrennung in mehrere Farbstoffe**; eine einzelne Bande ist **kein allgemeiner Beweis** für Reinheit einer unbekannten Probe, da Komponenten zusammenlaufen könnten. Diesen Vorbehalt in Erklärung/Wertung kurz berücksichtigen.

**Theorie für Standardmodus (NTG 8 / SG 9):** Mobile Phase (Laufmittel), stationäre Phase (Papier; vereinfachendes Schulmodell), Löslichkeit im Laufmittel sowie unterschiedlich starke **Adsorption**/Anlagerung an die stationäre Phase. *Adsorption* korrekt schreiben, nicht *Absorption*. Keine aufwendigen molekularen Wechselwirkungsmodelle.

**Expertenmodus:** Optional einschaltbare Messung der Laufstrecke und **Rf-Werte** (`Stoffstrecke / Laufmittelstrecke`) mit korrekter Behandlung fehlender/ungültiger Frontwerte. Im Normalmodus weder Rf-Berechnung noch mathematische Spezialbegriffe voraussetzen.

**Aufgabenbeispiele:** „Welcher Stift enthält mehrere Farbstoffe?“, „Haben Grün und Violett einen gemeinsamen blauen Farbstoff?“, „Was geschieht mit wasserfestem Stift in Wasser?“ Aufgaben müssen sich durch eigene Chromatogramme beantworten lassen.

### 3C. Destillation – **nur Ethanol/Wasser**

**Einziger Pflichtansatz:** Ethanol-Wasser-Gemisch mit festgelegter und dokumentierter Ausgangszusammensetzung (pädagogisch zweckmäßige Mischung). **Keine** Salzwasser- oder gefärbte-Wasser-Destillation; Salzgewinnung gehört zu K-02.

**Ausstattung:** Rundkolben/Destillierkolben, geeignete Heizquelle/Heizpilz, Destillationsaufsatz, gut ablesbares **Thermometer an korrekter Position im Dampfweg**, Liebigkühler, korrekte Schlauchanschlüsse für Kühlwasser **unten hinein, oben heraus**, auffangendes Gefäß, Stativ/Halterungen, erforderliche Verbindungsteile, Siedesteine vor dem Erhitzen und kleine getrennte Probenentnahmevorrichtung für virtuelle Brennprobe.

**Interaktion:** SuS bauen selbst auf, füllen Stoffgemisch ein, befestigen und positionieren Thermometer, verbinden Kühler korrekt, schalten Kühlwasser ein und regeln den Durchfluss, schalten Heizung ein und regulieren sie, beobachten Flüssigkeitsstand, Blasenbildung, Dampf, Kondensation und Tropfen in der Vorlage, lesen tatsächliche Messwerte ab, entnehmen eine kleine Destillatprobe und führen einen **getrennten virtuellen Brennversuch** durch.

**Temperaturanzeige ist zentral:**
- Groß, kontrastreich, eindeutig °C, gut ablesbare Skala oder Digitalanzeige zusätzlich zur sichtbaren Glasskala.
- Sichtbar aktualisierter Temperaturverlauf, mindestens die **Dampftemperatur am Destillationsaufsatz**; bei Darstellung zusätzlicher Kolbentemperatur unbedingt klar unterscheiden.
- Unterrichtlich zentrale Reinstoff-Siedetemperaturen bei Normaldruck: Ethanol ca. **78 °C**, Wasser ca. **100 °C**. Nicht unterstellen, dass das Gemisch zunächst exakt bei 78 °C siedet und anschließend schlagartig auf 100 °C springt.
- Beim Ethanol-Wasser-Gemisch wird zunächst ein **ethanolreicheres**, nicht zwingend reines Destillat gewonnen. Zusammensetzung und Temperatur ändern sich über den Verlauf. Ein **didaktisch vereinfachtes, stetiges und stoffbilanztreues** Modell reicht; Azeotropie darf bewusst vernachlässigt werden. Diese Modellgrenze intern und ggf. kurz in der Experteninformation dokumentieren.
- Heizen, Temperatur, Verdampfung, Kühlung, kondensierte Menge, Restmengen und Zusammensetzung sind gekoppelt. **Kein automatisches Destillat ohne hinreichende Erwärmung und Dampftransport.**
- Zu geringe Kühlung reduziert Kondensatmenge bzw. führt zu Verlust von Dampf im virtuellen System, statt unbegründet gleich viel Destillat zu erzeugen.

**Brennprobe:** Nur nach Entnahme einer **kleinen Probe in einer separat vorgesehenen Schale**. Bei geeigneter, im Modell dokumentierter Ethanolkonzentration bläuliche, nicht leuchtende Flamme. Sehr wasserreiche Probe kann die Brennprobe nicht bestehen. Die Brennprobe **belegt Brennbarkeit unter diesen Bedingungen**, nicht Reinheit oder einen exakten Alkoholgehalt. **Kein Zünden am eigentlichen Destillationsaufbau**; dort Sicherheitsstopp. Ungeeignete/sicherheitskritische Aufbauten und vollständig geschlossene heiße Systeme sofort abfangen.

**Verbindliche Fehler:** Kühlwasser fehlt/zu schwach/falsch angeschlossen; Thermometer fehlt oder sitzt falsch (Temperatur unbrauchbar); Heizquelle aus bzw. unzureichend; Heizung übermäßig hoch mit plausiblem Folgenmodell/Stopps; leeres Auffanggefäß/fehlende Vorlage; ungesicherte oder offene Apparaturverbindung; zu geringe Menge; Siedesteine erst in heiße Flüssigkeit geben (unterbinden/erläutern); falsche Probenentnahme; Brennprobe mit zu wasserreicher Fraktion; falsche Erwärmungs-/Messwertinterpretation. **Kein vollständiger geschlossener Aufbau unter Wärmeeinwirkung.**

**Fachliche Auswertung:** Wasser und Ethanol können bei unterschiedlichen Temperaturen verdampfen; erhöhter Ethanolanteil des Destillats, Verdampfen, Kondensieren, Wärme/Kühlung, Temperaturmessung und Brennbarkeit als qualitativer Nachweis. Keine quantitative VLE-, Azeotropie- oder Fraktionierkolonnenpflicht.

---

## 4. Konsistente Simulationsarchitektur

Entscheide technische Details begründet, orientiere dich aber am vorhandenen Redoxlabor:
- **Domänenmodell/Chemie-Engine ohne DOM**, zentraler Zustand mit Stoffanteilen, Mengen, Phasen, Temperatur, Gerätzustand und Ereignissen.
- **Experimentsteuerung / State-Machine** ohne grafische Abhängigkeit: erlaubte Handlungen, Ablauf, irreversible Verluste, Fehler, Hilfe und Bewertungslogik.
- **Renderer** zeichnet ausschließlich aus dem berechneten Zustand; zustandsgekoppelte kontinuierliche Animationen (Filtration/Tropfen, Flüssigkeitsspiegel, Sediment, Rühren, Phasengrenze, Auflösen, Kristallbildung, Laufmittelfront, Dampf und Kühlkondensation).
- **UI**: realistische, übersichtliche 2D-Laboransicht (Canvas 2D / SVG / WebGL nur dort, wo sinnvoll); kein 3D-Zwang. Geräte mit visuell realistischer, gut lesbarer Skalierung und glaubwürdigen Proportionen. Orientiere dich an den im Repo vorhandenen Screenshots und Referenzanimationen.
- Klare, ausreichend große Bedienelemente. **Tippen/Klicken als vollständige Alternative zu Drag-and-drop**, für Touch und Tastaturbedienung. Geräteauswahl und Platzierung mit sinnvollen Rückmeldungen; keine zufälligen Trefferzonen.
- Mobile/Tablet-Layouts: Versuchsbühne bleibt groß genug, Bedienbereich aus-/einklappbar, wichtige Anzeigen sichtbar und nicht abgeschnitten; keine horizontalen Miniscrollflächen.
- **Materialbestand je Versuch bewusst begrenzt**, damit die SuS selbstständig entscheiden, aber nicht mit 30 irrelevanten Chemikalien spielen.
- **Zeitsteuerung**: Pause, normaler Ablauf und sinnvoll begrenzte Zeitraffung; keine Echtzeit-Wartezeiten über viele Minuten. Zeitskalierung darf Ergebnis oder Mengenbilanzen nicht ändern.
- **Neu beginnen**: wahlweise nur aktuelle Apparatur/aktuellen Versuch zurücksetzen, ohne alle anderen abgeschlossenen Aufgaben zu löschen.
- **Offline:** keine externe API, kein CDN, keine Analytik, keine personenbezogene Datenübertragung. Bei SCORM keine Schüleranmeldung bei Drittanbietern; entsprechend vorhandener mebis-Vorgaben keine verpflichtende Noten-/Fortschrittsübermittlung.
- **Persistenz:** Innerhalb der Browser-Sitzung Bedienungszustand/Antwortentwürfe für versehentliches Panel-Schließen erhalten; einen neuen Versuch gezielt starten können. Keine behauptete dauerhafte LMS-Speicherung.
- Eigenständige `index.html`, `sivex.json`, README, Dokumentation, Tests, Web-/SCORM-Pakete im vorgesehenen App-Verzeichnis.

### 4.1 Formale und fachliche Modellgrenzen

Schreibe `docs/CHEMIE.md` mit allen Stoffen, Stoffeigenschaften, Mengen-/Temperaturmodellen, Chromatographie-Laufmittelparametern, didaktischen Näherungen und expliziten Grenzen. Jeder fachlich wichtige Parameter muss eine begründete Modellregel besitzen. Nutze Fachliteratur und zuverlässige Quellen für nicht triviale Behauptungen. Bei Stoffgemischen nie einfach per Index eine magische Farb- oder Ergebnisausgabe erzwingen: Übergänge müssen von den relevanten Eingabeparametern abhängen. Die Modelle müssen *nicht* Forschungssimulationen sein, aber **nicht falsch unterrichtet werden**.

---

## 5. Benutzeroberfläche und Lernworkflow

Die Laboroberfläche soll hochwertig, sachlich und optisch nahe an den vorhandenen SiVex-Anwendungen wirken; **kein billiges Comicdesign und keine aneinandergereihten Textformulare**. Schwerpunkte: realistische Geräte, klare Animationen, gut sichtbarer Stoff- und Temperaturzustand, geringe Ablenkung.

**Pro Aufgabenkarte:**
1. Auftrag/Problemstellung, ohne Lösung.
2. Geräte-/Chemikalienbereich und frei bedienbare Laborbühne.
3. Sichtbare, kontextabhängige Beobachtungen/Messwerte; bei Bedarf Zeitraffer.
4. Aufklappbare, dreistufige Hilfe.
5. Experimentgebundene Beobachtungsfragen, Lückentexte und ggf. Messwerteingaben; Rückmeldung ohne Freitext-KI.
6. Erfolgsnachweis auf Basis der *wirklichen Stoffe und Ergebnisse*.
7. Erst nach Erfolg: Theorie schrittweise erläutern und **vollständigen Muster-Hefteintrag zum Abschreiben** anzeigen.

Bei Chromatographie muss ein Vergleich mehrerer Chromatogramme möglich sein. Bei Destillation muss das Thermometer auch bei geöffneten UI-Elementen gut sichtbar und ein Messwert eindeutig ablesbar bleiben. Grundsätzlich darf die Lernoberfläche die Laborgeräte nicht verdecken.

**Sprache:** korrektes, einfach verständliches Deutsch. Keine übertrieben motivierenden KI-Floskeln oder belehrenden Phrasen. Fachbegriffe konsistent verwenden.

---

## 6. Selbstprüfung – zwingende PASS-/HOLD-Kriterien

**Definitionen:**
- `PASS`: Kriterium nachweislich vollständig implementiert **und** überprüft; ausführbare Tests / Screenshots / Testprotokoll belegen es.
- `HOLD – failed`: Reproduzierbarer Fehler oder ein verpflichtender Test schlägt fehl.
- `HOLD – incomplete`: Erforderliche Funktion ist nur teilweise vorhanden, ersetzt durch Dummy, fehlt oder funktioniert bloß auf einem glücklichen Idealpfad.
- `HOLD – unverified`: **Eine von Claude selbst durchzuführende Pflichtprüfung** konnte nicht ausgeführt werden. Grund und Nachtest angeben.

**Wichtige Ausnahme für die Abnahme durch Claude:** Der abschließende Test auf **echten Schul-Tablets**, in einem **realen mebis-Kurs** und im **Unterricht mit Lernenden** wird vom Auftraggeber selbst vorgenommen und ist **keine Voraussetzung für den technischen PASS**; dafür **keinen HOLD** setzen. Diese Praxiserprobungen unter „Lehrkraft-Nachtests (nicht blockierend)“ dokumentieren. Ein erfolgreicher Chromium-/Browser-Test mit Tablet-Touch-Emulation ist die für Claude verpflichtende UI-Prüfung. Echte iPads/Safari werden erst später vom Auftraggeber getestet. Die Repo-Statuskonvention `ready` kann bis zu dieser endgültigen praktischen Freigabe weiterhin `prototype` lauten – **nicht** mit einem HOLD für Claudes vollständig erledigte Entwicklungsarbeit verwechseln.

### 6.1 Pflichtmatrix (mindestens)

| Kennung | PASS nur wenn … |
|---|---|
| `A-01` | Alle **drei** Labore in der Startansicht erreichbar, vollständig bedienbar und ohne Platzhalter |
| `A-02` | Freie Gerätekombination und Handlungsreihenfolge führen zu einem physikalisch/chemisch nachvollziehbaren Ergebnis; nicht lediglich eine geskriptete Idealfolge |
| `A-03` | Modellzustände, Mengen, Phasen, Verluste und Renderer bleiben über die Zeit konsistent |
| `A-04` | Zeitraffer/Pause verändern nur Geschwindigkeit, nicht die fachliche Lösung |
| `A-05` | Alle vorgesehenen Aktionen sind alternativ per Tap/Klick ohne Drag-and-drop möglich |
| `K-01` | Sand-Wasser: Sedimentieren + Dekantieren oder Filtrieren führen zum korrekten Befund; Gegenfälle sichtbar |
| `K-02` | Sand-Salz: Lösen, Filtrieren, **Eindampfen** liefern nachweisbar getrennten Sand und festes Salz |
| `K-03` | Eisen/Sand/Salz vollständig trennbar; jeder Stoff bleibt mengenmäßig nachvollziehbar |
| `K-04` | Öl/Wasser im Scheidetrichter mit korrekt bedienbarem Hahn und echten zwei Phasen |
| `K-05` | Hibiskustee-Extraktion mit Temperatur-/Zeitwirkung und Filtrieren, aber nie als Reinstoff ausgegeben |
| `K-06` | Die genannten Fehlversuche liefern falsche/unvollständige Ergebnisse, keine automatische korrekte Trennung |
| `C-01` | Alle 7 definierten Proben, 2 Laufmittel, mehrere Proben nebeneinander benutzbar |
| `C-02` | Dynamische Laufmittelfront und getrennte/zurückbleibende Stoffkomponenten gemäß Datensatz |
| `C-03` | Reinstoff-Referenzen zeigen eine Zone, wasserunlösliche Komponente bleibt im passenden Fall stehen |
| `C-04` | Falsche Startlinie, falscher Flüssigkeitsstand, überladener Punkt und unpassendes Laufmittel produzieren plausible Abweichungen |
| `C-05` | Standardauswertung mobile/stationäre Phase, Löslichkeit, **Adsorption**; Experten-Rf korrekt und separat |
| `D-01` | Ethanol/Wasser-Apparatur vollständig und eigenständig aufbaubar; ausschließlich dieser Destillationsversuch |
| `D-02` | **Temperatur** am Dampfweg gut ablesbar und zeitlich/physikalisch gekoppelt; 78/100 °C nicht als falsche starre Zweistufenfolge dargestellt |
| `D-03` | Heizleistung, Mengen, Verdampfen, Dampf, Kondensation, Kühlwasser und Destillatmenge sind gekoppelt |
| `D-04` | Kühlwasser unten hinein/oben heraus; fehlende oder mangelhafte Kühlung verändert sichtbar das Resultat |
| `D-05` | Separate Destillat-Probe mit unter passenden Modellbedingungen bläulicher Brennprobe; kein falscher Reinheitsnachweis |
| `D-06` | Sicherheitskritische Fehler werden sofort abgefangen; ungefährliche Fehler bleiben lernwirksam |
| `L-01` | Genau drei Hilfezustände (keine/kleine/konkrete); abrufbar, nach wiederholtem Scheitern angeboten und zustandsbezogen |
| `L-02` | Beobachtungsantworten beziehen sich auf reale Versuchsergebnisse; keine Musterlösung vor eigenem Experiment |
| `L-03` | Auswertung mit automatisch geprüften Lückentexten, Synonymen und sinnvollen Eingabevarianten; keine externe KI |
| `L-04` | Nur nach korrektem Versuch und Auswertung erscheinen Theorie und **vollständiger Hefteintrag** |
| `L-05` | Fehlversuche korrigierbar oder gezielt wiederholbar, ohne dass Lernende in Sackgassen hängen bleiben |
| `V-01` | 2D-Geräte realistisch und wiedererkennbar; animierte Zustandsübergänge statt Sprungbilder |
| `V-02` | Glas/Flüssigkeit/Sediment, chromatographische Banden, Dampf/Kondensation bei passenden Zuständen sichtbar |
| `V-03` | Desktop- und Tablet-Auflösungen (z. B. 1440×900, 1180×820, 1024×768) ohne abgeschnittene Pflichtfunktionen; Touch-Emulation funktioniert |
| `V-04` | Wesentliche UI-Steuerung tastaturbedienbar; Beschriftungen lesbar; Farbe ist nicht das einzige Informationsträgermittel |
| `T-01` | Vollständiger offlinefähiger statischer Web-Build, ohne CDN/API/fehlende oder absolute Ressourcen |
| `T-02` | Vollständiger SCORM-1.2-Build mit korrektem `imsmanifest.xml`, Einstiegspunkt und relativen Pfaden |
| `T-03` | Fertiges SCORM-ZIP im simulierten LMS start-/bedienbar, nicht nur Quellcode oder Paketmanifest geprüft |
| `T-04` | Unit-Tests der Fachmodelle, Fehlerfälle und zeitlichen Zustandsübergänge vollständig grün |
| `T-05` | Browser-End-to-End-Tests der **wirklichen Bedienoberfläche** für alle drei Labore und zentrale Fehlversuche vollständig grün |
| `T-06` | Screenshot- und Sichtprüfung relevanter Zwischenzustände dokumentiert; keine leeren/überdeckten/abgeschnittenen Geräte |
| `T-07` | README, Fachmodell, Testbericht, Bedienhinweise, `sivex.json`, Web-ZIP und SCORM-ZIP vollständig |
| `T-08` | Pull Request auf GitHub enthält tatsächlich alle Änderungen und Tests, läuft gegenüber dem Branch-Stand; **kein Merge in `main`** |

### 6.2 Konkrete automatisierte Ende-zu-Ende-Szenarien

Führe zusätzlich zu Unit-Tests mindestens diese Bedienfolgen im Browser aus; das genügt **nicht**, sie nur mit direkten internen State-API-Aufrufen zu simulieren:

1. **K-02 positiv:** trockenes Sand-Salz-Gemisch → Wasser → lösen → Filter korrekt aufbauen → filtrieren → Salzlösung in Abdampfschale → erhitzen → Kristalle → Auswertung → Hefteintrag.
2. **K-02 negativ:** ohne Wasser trocken filtrieren; Salz im Rückstand nicht fälschlich als getrennt melden.
3. **K-02 Verlust:** Filtrat verwerfen → anschließend kein Salz aus dem Nichts zurückgewinnen.
4. **K-01:** Sedimentieren, vorsichtiges und zu schnelles Dekantieren vergleichen; trübes Resultat korrigieren.
5. **K-03:** Magnet + Extraktion/Filtration/Eindampfen → alle drei Stoffe.
6. **K-04:** Scheidetrichter trennt beide Phasen; Hahnfehler erzeugt Mischfraktion/Verlust.
7. **K-05:** kaltes vs. warmes Wasser, reale Farbzunahme und Pflanzenreste abtrennen; Ergebnis bleibt Stoffgemisch.
8. **C-01 positiv:** Schwarz/Grün/Blau nebeneinander → Laufmittel steigt → verschiedene Banden; gemeinsamer Farbstoff erkennbar.
9. **C-02 negativ:** wasserfester Stift mit Wasser → Komponente wandert nicht.
10. **C-03 negativ:** Startlinie unter Flüssigkeit → keine gültige saubere Chromatographie.
11. **C-04 negativ:** zu viel Farbstoff → Flecken verbreitert; Kontrast zur Normalprobe sichtbar.
12. **C-05:** eine Reinstoffprobe → nur eine Bande; Standardmodus zeigt keine Rf-Pflicht, Expertenmodus berechnet numerisch korrekt.
13. **D-01 positiv:** Ethanol/Wasser-Aufbau vollständig → Kühlwasser unten anschließen → erhitzen → Temperatur ablesen → Destillat sammeln → separate Brennprobe → fachliche Auswertung.
14. **D-02 negativ:** Kühlwasser aus → deutlich veränderte Kondensatmenge, kein automatisch gleiches Ergebnis.
15. **D-03 negativ:** falsch positioniertes Thermometer → falsche/fehlende verlässliche Temperaturmessung, nicht als korrekt bestandene Messaufgabe werten.
16. **D-04 negativ:** Heizleistung 0 → auch nach Simulationszeit keine Destillatproduktion.
17. **D-05 kritisch:** Versuch, geschlossene Apparatur zu erhitzen oder an der heißen Destillationsapparatur zu zünden → sofortiger nachvollziehbarer Sicherheitsstopp.
18. **L-01:** wiederholter Fehlversuch → kleine Hilfe angeboten → konkrete Hilfe auf Wunsch → tatsächliche Korrektur möglich.
19. **L-02:** falsche Beobachtungsantwort und falsch geschriebener Fachbegriff → gezieltes Feedback; richtige Antworten bleiben erhalten, Synonyme werden erkannt.
20. **L-03:** Hefteintrag bleibt vor erfolgreicher Auswertung gesperrt und wird danach vollständig eingeblendet.
21. **V-01:** Sämtliche Kernaufgaben in mindestens Desktop- und Tablet-Browser-Viewports mit Tap/Klick abschließbar.
22. **T-01:** dieselben Nutzeraktionen über das **tatsächlich ausgelieferte** Web-/SCORM-Paket, keine kaputten Ressourcen und keine Laufzeitfehler in Konsole.

Jeden Test mit Skript oder ausführbarer Spezifikation belegen; Screenshots für Startansicht, wesentliche Zwischenzustände, erfolgreichen Abschluss und ausgewählte Fehlversuche ablegen. Tests **dürfen nicht** bestehen, wenn der jeweilige Pflichtgegenstand fehlt.

### 6.3 Umgang mit HOLD

Bei jedem `HOLD – failed` oder `HOLD – incomplete`: **Fehler reproduzieren → Ursache beheben → Regressionstest ergänzen → gesamte relevante Testmatrix wiederholen.** Nicht nach einer bloßen TODO-Liste abbrechen. Bei `HOLD – unverified` für selbst ausführbare Pflichttests zuerst Testumgebung einrichten, gegebenenfalls mit Alternativen (z. B. vorhandener Chrome/Edge-Kanal); wenn wirklich unlösbar, präzise begründen. Niemals PASS ohne Nachweis.

Der vom Auftraggeber selbst durchzuführende **echte Schul-Tablet-Test**, **echte mebis-Test** und **Unterrichtstest** stehen ausdrücklich **außerhalb dieser HOLD-Systematik** und sind lediglich als nachgelagerte Praxistests aufzulisten. Die technische Entwicklungsabnahme darf nach erfolgreichen automatisierten Browser-, Unit-, Paket- und SCORM-Tests **PASS** erhalten. Aus der Tatsache, dass du ein iPad nicht physisch bedienen kannst, darf kein HOLD entstehen.

---

## 7. Fertige Lieferobjekte

1. `apps/trennlabor/` mit vollständigem, wartbarem, sinnvoll modularisiertem Quellcode aller drei Labore.
2. Git-verwaltete, reproduzierbare **Web- und SCORM-1.2-ZIP-Pakete** in `apps/trennlabor/release/` (mit Versionskennung und SHA-256-Prüfsummen, sofern projektkonform).
3. `apps/trennlabor/README.md`: Installation/Start, Bedienkonzept, Standardversuche, Browser/SCORM, Grenzen.
4. `apps/trennlabor/docs/CHEMIE.md`: Modellannahmen, Stoffdaten und Vereinfachungen samt seriösen Quellen.
5. `apps/trennlabor/docs/TESTBERICHT.md`: jede PASS-/HOLD-Kennung, ausgeführte Tests, Umgebung, konkrete Nachweise, Screenshots und bekannte Grenzen.
6. `apps/trennlabor/docs/BEDIENUNG.md`: kurze Lehrkraft-/Schülerorientierung, Materialliste und Bedienungs-/Fehlerlogik, keine schrittweise Zwangsanleitung.
7. `apps/trennlabor/tests/`: Unit-, Regression-, Browser-End-to-End- und SCORM-Tests; dokumentierte Befehle zur erneuten Ausführung.
8. `apps/trennlabor/sivex.json` gemäß Repo-Standard.
9. Falls sinnvoll: projektkonformer Eintrag für das neue Labor in der Repository-Startdokumentation, **ohne** bestehende Links oder Anwendungen zu beschädigen.
10. Ein GitHub-Pull-Request mit verständlicher Zusammenfassung, Versionsstand, Testübersicht, Link zu Web-/SCORM-Artefakten und verbleibenden **nicht blockierenden Lehrkraft-Nachtests**.

**Wichtig:** Kein eigenmächtiges Löschen oder Ersetzen der Titrations- oder Redoxlabor-Releases. Keine direkte Übernahme nach `main`. Der Auftraggeber und anschließend ggf. Codex übernehmen unabhängige Prüfung und Freigabe.

---

## 8. Abschlussbericht – verbindliches Format

Schließe deinen Auftrag mit einem präzisen Statusbericht ab, der enthält:

1. GitHub-Repository, Branch, letzter Commit und **URL des Pull Requests**.
2. Vollständige Liste aller enthaltenen Standardversuche, ausdrücklich K-01 bis K-05, Chromatographie und Ethanol/Wasser-Destillation.
3. Stand der implementierten Fehler- und Hilfefälle.
4. Tabelle aller Kriterien aus Abschnitt 6.1 mit `PASS`, ggf. `HOLD` samt Begründung und Verweis auf die konkreten Tests/Screenshots.
5. Kommandos und tatsächlich beobachtete Resultate aller automatisierten Tests, inklusive der Web-/SCORM-Pakete.
6. Reproduzierbare Hinweise zum lokalen Browserstart und zum Upload in mebis als SCORM 1.2.
7. Gesonderter Abschnitt **„Nachgelagerte Praxistests durch Lehrkraft – nicht blockierend“**: echte Schul-Tablets, realer mebis-Kurs, Unterrichtsbeobachtung. **Nicht als HOLD einstufen.**

**Definition von „fertig zur Prüfung“:** Alle drei Laborbereiche sind funktional vollständig und alle selbst durchführbaren Pflichtprüfungen nachweislich PASS; vollständige PR-Lieferung liegt vor. Das finale fachliche und schulpraktische Freigabeurteil sowie der Merge nach `main` verbleiben beim Auftraggeber.

**BEGINNE JETZT.** Analysiere das bestehende Repository, lege einen separaten Feature-Branch an, implementiere in diesem Auftrag alle Pflichtversuche vollständig, teste und verbessere eigenständig und liefere erst danach den Pull Request.
