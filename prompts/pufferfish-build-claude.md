# Build-Auftrag für Claude Code: SiVex – Pufferfish

Version des Auftrags: 1.0 · 27.10.2026

## Auftrag und Prioritäten

Entwickle **„Pufferfish – Warum bleibt der pH fast gleich?“**, eine eigenständige, ausführbare SiVex-Lernsimulation für Chemie Q13 auf erhöhtem Anforderungsniveau. Zentrale Themen: Pufferwirkung auf Stoff- und Teilchenebene, Herleitung und praktische Anwendung der Henderson-Hasselbalch-Gleichung, Pufferbereich, begrenzte Pufferkapazität und Beispiele in Natur und Technik.

**Der gewünschte neue Look ist ein Pipetten-/Tropfversuch mit transparenten Bechergläsern. Keine erneute Büretten-Titration als Hauptversuch.** Die SuS kennen das Titrationslabor bereits. Hier steht das unmittelbare Beobachten und Erklären im Mittelpunkt: „Warum verändert derselbe Tropfen den pH-Wert so unterschiedlich?“ Die bekannte Titration dient als kurze fachliche Brücke zum Säure-Base-Gemisch am Halbäquivalenzpunkt. Keine zweite vollständige Titrations-App innerhalb von Pufferfish bauen.

Verbindliche Lernfolge: **selbst experimentieren und beobachten → Teilchenvorgänge erklären → Henderson-Hasselbalch herleiten → selbst rechnen → Anwendungen beurteilen.** Stoffansicht, animierte Teilchenansicht und dynamisch wachsende pH-Kurve zeigen denselben experimentellen Zustand. Ein lustiger, sich aufpumpender Pufferfisch ist das originale animierte Logo.

Liefere lauffähigen Quellcode, Web- und SCORM-1.2-Pakete, Quellen-/Modellbeschreibung und einen ehrlichen Testbericht. Konzept, statische Infografik, automatisch abgespielte Präsentation und dekorative Teilchenanimation ohne Zustandsbezug genügen nicht. Nach kurzer Bestandsaufnahme bis zum getesteten Ergebnis arbeiten. Routineentscheidungen selbst treffen; neuere ausdrückliche Anweisungen des Auftraggebers haben Vorrang.

## 1. Repository und nutzbare Grundlagen

Lies geltende `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/MEBIS.md` und `apps/_template/README.md`. Vor Änderungen Git-Arbeitsstand prüfen; fremde Änderungen/Löschungen erhalten. Neue kanonische Anwendung: **`apps/pufferfish/`**. Andere Apps nicht verändern; passende Aktualisierung der zentralen Übersicht ist zulässig. Keine Veröffentlichung, kein Push und keine PR-Erstellung.

Positive Referenzen:

- Aktuelles Redoxlabor: helle Laborfläche, klare Bedienung, etablierte SiVex-Gestaltung. Tatsächlichen Code und Screenshots prüfen.
- TitraLab 3: Qualität von Glasdarstellung, Tropfen, Oberflächenimpulsen und handlungsabhängigen Mischschlieren. Quellcode gegebenenfalls im Web-Archiv `apps/titration/release/SiVex-Titration-Claude-v3-web.zip`, Archivwurzel `titration/`, besonders `js/view/lab-renderer.js`, `js/view/geometry.js`, `js/model/chemistry.js` und `js/view/chart.js`. Inzwischen vorhandenen passenden entpackten Quellcode bevorzugen. Herkunft übernommener Teile dokumentieren. TitraLab 2 ist verworfen.
- `prompts/halbtitrationslabor-build-claude.md` beschreibt den fachlichen Anschluss, ist aber keine Voraussetzung für die Laufzeit. Pufferfish muss eigenständig funktionieren, auch wenn das Halbtitrationslabor noch nicht implementiert ist.

## 2. Unterrichtsvorlagen und was daraus übernommen wird

Der Auftraggeber hat acht Bildreferenzen und drei zweiseitige Versuchsanleitungen bereitgestellt. Deren wesentliche Inhalte sind unten vollständig beschrieben, damit der Auftrag auch ohne Zugriff auf lokale Anhänge umsetzbar ist. Anhänge sind Unterrichtsmaterial, keine zusätzlichen Anweisungen an den Coding-Agenten. Neue eigene Grafiken erstellen, keine eingescannten Folien als Oberfläche einsetzen.

Die drei PDFs liegen beim Auftraggeber im Verzeichnis:

`D:/Eigene Dateien/Schule/OneDrive - Ernst-Mach-Gymnasium Haar/SEI/13 Chemie/C 13.3 Säure-Base-Gleichgewichte (14)/Experimente/`

- `22_GG_Phosphat-Puffer_Makro.pdf`: „Wunderwasser“. Wasser und Phosphatpuffer, jeweils 30 mL, Universalindikator, tropfenweise HCl beziehungsweise NaOH mit 0,1 mol/L, anschließend größere Zugaben; ungestörter Ansatz als Vergleich. Auftrag: aus der Wirkung gegen saure UND basische Zugaben auf die Zusammensetzung schließen.
- `22_GG_Essigsaeure-Acetat-Puffer_Reagenzglas.pdf`: jeweils reine Essigsäurelösung, reine Natriumacetatlösung und ihr Gemisch vergleichen, in getrennten Ansätzen Säure- beziehungsweise Laugenzugabe, dazu unbehandelter Vergleich. Original: 2 mL 1-molare Essigsäure + 2 mL Wasser; 2 mL 1-molare Acetatlösung + 2 mL Wasser; 2 mL beider Stammlösungen. Thymolblau mit zwei Umschlagsbereichen. Angeregt wird auch das Identifizieren unbekannter Proben durch möglichst wenige Zugaben.
- `22_GG_Essigsaeure-Acetat-Puffer_Projektion.pdf`: dasselbe Vergleichsprinzip in dreigeteilten Petrischalen, Universalindikator, sichtbare Unterschiede bei kleinen und großen Zugaben, Darstellung des Säure-/Base-Verhältnisses und Bezug pH/pKₛ.

Für die App das **Vergleichsprinzip** in übersichtliche Bechergläser mit Pipetten übertragen. Keine neun kleinen Gefäße gleichzeitig und keine zusätzliche Petrischalen-/Reagenzglas-App bauen. Die Originalkonzentrationen nicht ungeprüft übernehmen; unten stehen klare, moderate Simulationsparameter.

Fachliche Präzisierungen gegenüber den Vorlagen:

1. Ein Puffer hält den pH nicht exakt konstant. Die Änderung beginnt bei jeder Zugabe, zunächst gering und mit fortschreitender Umwandlung zunehmend stärker. Kein künstlicher Sprung von „unverändert“ zu „erschöpft“.
2. „pH = pKₛ“ bezeichnet die Mitte eines geeigneten Puffersystems bei gleichen Gleichgewichtskonzentrationen; nicht den gesamten Pufferbereich. Die gebräuchliche Näherung für den Bereich ist pKₛ ± 1.
3. Ein Acetatpuffer mit etwa gleichen Anteilen startet bei etwa pH 4,75, nicht automatisch bei pH 7. Die Bildreferenz mit Anfangs-pH 7, anschließend 5,7 und fehlenden Konzentrationen nicht als berechenbaren Standardfall kopieren.
4. In der Phosphat-PDF ist die Rezeptur inkonsistent zur behaupteten Äquimolarität: 1,78 g Na₂HPO₄·2H₂O auf 100 mL entsprechen etwa 0,10 mol/L, 0,78 g NaH₂PO₄·2H₂O dagegen etwa 0,05 mol/L. Das ist ungefähr 2:1, nicht 1:1. Kein widersprüchliches Rezept implementieren. Eine definierte Phosphat-Modelllösung verwenden; ein zertifizierter pH-7-Kalibrierpuffer ist nicht automatisch ein ideales 1:1-Gemisch mit pH 7,00.
5. Die drei schematischen Bereiche um pH 2/7/12 in der ersten Bildreferenz gehören zu unterschiedlichen Stufen eines mehrprotonigen Systems, nicht zu drei Bereichen des Acetatpuffers. Solche Bereiche nur stufenbezogen mit passenden Daten zeigen.
6. Beim Blutbeispiel mit 37 °C und pK′ ≈ 6,1 handelt es sich um das effektive CO₂/Hydrogencarbonat-System. Siehe die genaue Aufgabenfestlegung unten; nicht als Verhältnis zu ausschließlich molekularer H₂CO₃ ausgeben.

## 3. Experimentieroberfläche und Lernweg

### Einstieg: „Wasser oder Wunderwasser?“

Hauptansicht: zwei große Bechergläser nebeneinander, gleiche Anfangsvolumina, Wasser links, zunächst als „Wunderwasser“ bezeichnete Phosphatpufferlösung rechts. Vorhersage festhalten lassen, dann selbst dosieren. Kurzer Hinweis, dass es sich bei der zweiten Probe um eine vorbereitete Modelllösung handelt; keine Zauberei als Erklärung.

- Standard: je **30,0 mL**. Phosphat formal **c(H₂PO₄⁻) = c(HPO₄²⁻) = 0,050 mol/L**; Natriumgegenionen bilanziert. Bei 25 °C im idealisierten Modell Anfangs-pH nahe pKₛ,2, ungefähr 7,20. Wasser im Modell rein und CO₂-frei, Anfangs-pH nahe 7,00. Nicht durch versteckte Anpassung exakt gleiche Anfangswerte erzwingen.
- HCl und NaOH jeweils **0,100 mol/L**; Standardtropfen **0,050 mL** als vereinbarte Simulationsgröße, nicht Naturkonstante.
- Pipetten sichtbar auswählen und dosieren: ein Tropfen, fünf Tropfen nacheinander; größere Zugaben beispielsweise 0,5/1,0/5,0 mL als klar beschriftete Dosierhilfe für Kapazitätsuntersuchungen. Bei großen Mengen passende Messpipette statt eines riesigen einzelnen Tropfens zeigen.
- Im Vergleichsmodus dieselbe Zugabe nacheinander sichtbar in beide Gläser geben. Quelle, Tropfenweg und tatsächliches Ankommen koppeln. SuS steuern jeden Dosierschritt; keine minutenlange automatische Versuchskette.
- Für Säure- und Laugenreihe frische Ansätze verwenden; beide Reihen speichern. Beim Wechsel keinen bereits angesäuerten Ansatz stillschweigend als frisch behandeln. Bewusstes Mischen beider Reagenzien ist für den Pflichtumfang nicht nötig.
- Unbehandelten Referenzzustand als gut erkennbare kleine Referenzprobe oder gespeicherte Farb-/pH-Referenz zeigen. Kein drittes großes Glas nötig, wenn das Layout dadurch überladen wird.
- Universalindikatorfarbe und pH-Messanzeige reagieren synchron nach Mischung. Universalfarben als dokumentiertes schematisches Indikatormodell; keine vorgetäuschte exakte Produktkalibrierung. Farbe lässt sich ausblenden, pH und Messwerte bleiben zugänglich.
- SuS beobachten und formulieren zunächst selbst: Welche Probe verändert sich stärker? Was muss die zweite Probe enthalten, wenn sie beide Zugaben abmildert? Die genaue Phosphatzusammensetzung nach eigener Deutung und in der Theoriephase aufdecken; keine Zahlenlösungen durch Export oder versteckte Voransichten vorwegnehmen.

Kurze Anknüpfung an Bekanntes: Bei der Halbtitration entstehen schwache Säure und korrespondierende Base nebeneinander. Eine kompakte bekannte Titrationsskizze darf als ausdrücklich gekennzeichnete Rückblickgrafik erscheinen. Kein neuer Bürettenaufbau, keine erneute komplette Titrationsdurchführung und kein verpflichtender Wechsel in eine andere App.

### Erklären und vertiefen: „Warum braucht es beide Partner?“

Zweiter Versuch mit Acetatsystem. Essigsäure, Natriumacetat und Essigsäure/Acetat-Gemisch vergleichen. Drei große Gefäße nur bei ausreichendem Platz; sonst zwei aktive Proben und ein verständlicher Umschalter für die dritte, ohne gespeicherte Ansätze zu verlieren.

Definierte Ausgangsdaten bei 25 °C, jeweils 30,0 mL:

- Essigsäure allein: analytische Konzentration 0,100 mol/L.
- Natriumacetat allein: analytische Konzentration 0,100 mol/L.
- Gemisch: formal je 0,050 mol/L Essigsäure und Acetat, insgesamt 0,100 mol/L Acetatsystem.

Alle drei Proben besitzen damit dieselbe Gesamtmenge des Acetatsystems, aber unterschiedliche Zusammensetzung. Gleiche HCl-/NaOH-Zugaben wie im Einstieg. SuS sagen vorher, welche Probe saure, welche basische Zugaben besonders gut abmildert, und prüfen ihre Vermutung.

Essigsäure allein kann zugesetzte Base umsetzen; Acetat allein kann zugesetzte Säure umsetzen. Dabei entsteht jeweils der korrespondierende Partner. Nicht pauschal „reine schwache Säure/Acetatlösung kann niemals puffern“ behaupten. Das Gemisch besitzt bereits beide Partner in nennenswerter Menge und wirkt in beide Richtungen. Anfangs-pH-Werte der drei Ansätze sind verschieden und werden nicht künstlich angeglichen.

### Kapazität, Verhältnis und Verdünnung untersuchen

Im Acetatversuch mindestens drei gezielte Untersuchungen ermöglichen:

1. **Weiterdosieren:** Der wirksame Bereich wird verlassen; bei Aufbrauchen einer formal vorhandenen Komponente dominiert schließlich der Säure-/Basenüberschuss. Der Solver rechnet weiter, ohne negative Stoffmengen oder Logarithmusfehler.
2. **Verhältnis ändern:** Bei gleicher Gesamtmenge HA:A⁻ variieren, etwa 1:1, 1:10 und 10:1. Anfangs-pH und Reserven für weitere Säure-/Laugenzugabe vergleichen. Das Ändern der Startmischung legt einen neuen Ansatz an, keine kostenlose Stoffumwandlung während einer laufenden Messung.
3. **Verdünnung:** Zwei gleiche Volumina mit gleichem Verhältnis, aber zehnfach verschiedener Gesamtkonzentration vergleichen. Anfangs-pH im geeigneten Bereich annähernd gleich, Widerstand gegen dieselbe Zugabe deutlich verschieden. Davon unterscheiden: Wasserzugabe zu einer bestehenden Probe erhält zunächst die Stoffmengen und damit ihre gesamte stöchiometrische Reserve, senkt aber Konzentration und Kapazität pro Volumen. Nicht automatisch zehnfach kleinere Gesamtreserve behaupten, wenn dieselbe Probe bloß auf zehnfaches Volumen verdünnt wurde.

Bei Phosphat kann nach Verlassen des H₂PO₄⁻/HPO₄²⁻-Bereichs eine weitere Protolysestufe wirksam werden. Nicht behaupten, das gesamte Phosphatsystem sei dann chemisch funktionslos. Die einfache Kapazitätserschöpfung vorrangig am Acetatsystem erklären.

Ein zusätzlicher „Unbekannte Probe“-Rätselmodus aus der Reagenzglasvorlage ist optional, erst nach Fertigstellung des Pflichtumfangs.

## 4. Stoff- und Teilchenebene als synchronisierte Hauptfunktion

Stoffansicht und Teilchenansicht müssen gleichzeitig beobachtbar sein. Eine reservierte Vergrößerungsansicht pro aktiver Probe ist möglich; keine schwebende Lupe, die Gläser oder Bedienelemente verdeckt. Legende und Modellcharakter klar sichtbar. Beschriftungen nicht nur per Hover.

Makroansicht: transparente Glaswände, plausibler Meniskus, korrekt steigender Flüssigkeitsstand, sichtbare fallende Tropfen, kurzzeitige lokale Mischschlieren bei Indikator, Abklingen nach Umrühren. Ungefärbte Säure-/Basenlösungen nicht ohne Indikator von sich aus rot/blau darstellen. Langsames Schwenken oder Rühren als eigene Handlung, Pause und anschauliche Zeitlupe anbieten.

Teilchenansicht zeigt **wirkliche Protonenübertragung** statt des bloßen Verschwindens eines Icons:

- A⁻ + H₃O⁺ → HA + H₂O.
- HA + OH⁻ → A⁻ + H₂O.
- Bei Phosphat: HPO₄²⁻ + H₃O⁺ → H₂PO₄⁻ + H₂O; H₂PO₄⁻ + OH⁻ → HPO₄²⁻ + H₂O.
- In Wasser bleibt nach entsprechender Zugabe ein deutlicher H₃O⁺- beziehungsweise OH⁻-Überschuss; bei Begegnung beider: H₃O⁺ + OH⁻ → 2 H₂O.

Reaktion in einer langsam beobachtbaren Sequenz: Zugabe trifft ein → Teilchen nähern sich → Protonenübertragung wird hervorgehoben → Produkte trennen sich → Bestandsdarstellung aktualisiert sich. Atom- und Ladungserhaltung beachten. HA und A⁻ besitzen erkennbar dasselbe Grundgerüst; bei HA kommt ein gebundenes Proton hinzu. Beim Phosphat die bereits vorhandenen negativen Ladungen korrekt unterscheiden. Keine Acetat-„Moleküle“ als ungeladene Base beschriften.

Alle Teilchen bewegen sich im Modell; Gleichgewicht ist dynamisch. Pufferung ist Umwandlung einer starken Säure/Base in einen schwächeren Partner, kein bloßes Einsaugen, Wegsperren oder Vernichten von Ionen. Das Fischlogo ist kein chemischer Ionenspeicher.

Quantitative Daten und Animation sauber koppeln:

- Ein zentraler Zustand führt Mengen, Volumina und Gleichgewichtsverteilung. Renderer, Kurve, Journal und Verhältnisanzeige lesen daraus.
- Repräsentative Symbole mit erklärtem Darstellungsmaßstab verwenden. Keine Behauptung, dass die wenigen sichtbaren Symbole die reale Konzentration freier H₃O⁺-Ionen maßstäblich zeigen.
- Für kurzlebige zugegebene Ionen eine als schematisch/zeitlich vergrößert markierte Reaktionsansicht verwenden. Dauerhaft angezeigte Speziesanteile mit dem Gleichgewicht vereinbar halten.
- Pro Tropfen nicht willkürlich ein ganzes Puffersymbol umwandeln, wenn Tropfenmenge und Symbolmaßstab nicht dazu passen. Sichere Strategie: schematisches Reaktionsereignis plus quantitative Stoffmengen-/Anteilsbalken; sichtbare Symbolanteile repräsentativ anpassen.
- Seltene Spezies können zur Beobachtung vergrößert hervorgehoben werden; daraus darf keine falsche pH-Berechnung entstehen. pH stammt aus dem Modell, nicht aus einer Zählung sichtbarer Icons oder zufälliger Bildschirmkollisionen.
- Gegenionen im Modell bilanzieren; in der Animation dürfen sie zur Übersicht ausgeblendet werden, mit Legendenhinweis. Wasser als Hintergrund/Reaktionspartner darstellen, nicht als einige wenige maßstäblich gezählte Moleküle.
- Beim Pausieren/Schrittmodus bleiben Makro-/Teilchenzustand und Messreihe konsistent. Doppelklick oder schneller Reagenzwechsel darf keine doppelte oder verlorene Dosierung erzeugen.

## 5. Dynamische Kurve: pH gegen tatsächlich zugegebene Menge

Parallel zum Experiment wächst eine **pH-Zugabekurve**; bei der kontinuierlichen Zugabe einer einzigen Maßlösung ist dies eine Titrationskurve. Sie ist Teil der Messung, kein vorgegebenes Dekorationsbild.

- Zwei Kurven im selben Diagramm vergleichen Wasser und Puffer bei gleicher Zugabe. Eindeutige Legende, unterschiedliche Linien-/Punktsymbole und Farben.
- x-Achse: zugegebenes Volumen der eindeutig bezeichneten HCl- oder NaOH-Lösung in mL; Konzentration angeben. y-Achse: pH. Start bei tatsächlich gemessenem Ausgangswert.
- Säure- und Basenreihe als getrennte frische Messreihen verwalten. Keine fortlaufende x-Achse „Gesamtvolumen“, auf der wechselnde HCl-/NaOH-Zugaben fälschlich wie eine einzige Titration aussehen. Vergleich alter Reihen über klar beschriftete Auswahl ermöglichen.
- Kurve nur bis zum tatsächlich dosierten und aufgenommenen Wert zeichnen. Verbindungslinie/Interpolation und Messpunkte unterscheiden; kein Vorzeichnen zukünftiger Werte.
- Während des Mischens Status zeigen, anschließend stabilen Modell-/Messwert protokollieren. Keine sofortige Gleichgewichtsanzeige vor Eintreffen des Tropfens.
- Nach der Theoriephase pKₛ und näherungsweisen Bereich pKₛ ± 1 zuschaltbar einzeichnen. Grenzen als Faustregel, keine harte Wirksamkeitsgrenze. Nur passende Stufe des jeweiligen Systems markieren.
- Optional zweite Darstellung pH gegen Anteil A⁻/(HA + A⁻) als Auswertungsansicht, analog zur PDF. Sie ist ein Zusammensetzungsdiagramm und nicht dieselbe x-Achse wie das Zugabevolumen. Kurven/Diagrammarten nicht unbeschriftet austauschen.
- Knappe quantitative Anzeigen: n(HA), n(A⁻), Verhältnis, zugegebene Stoffmenge, ΔpH und Gesamtvolumen. Vor der Theorie Zahlen so dosieren, dass sie Beobachtung unterstützen und keine fertige Rechnung vorwegnehmen.

## 6. Theorie: aus der beobachteten Reaktion zur Puffergleichung

Nach eigener Beobachtung und Deutung eine kurze, vollständige Herleitung als interaktive Folge, nicht als überladene Textwand:

1. HA + H₂O ⇌ A⁻ + H₃O⁺.
2. Im idealisierten Konzentrationsmodell: Kₛ = c(H₃O⁺) · c(A⁻)/c(HA), mit üblichem Bezug auf die Standardkonzentration. Schulnotation verständlich halten.
3. Nach c(H₃O⁺) umstellen.
4. Negativen dekadischen Logarithmus anwenden und Vorzeichen/Kehrwert erklären.
5. **pH = pKₛ + lg[c(A⁻)/c(HA)].**
6. Im selben Gemisch kann das Verhältnis durch n(A⁻)/n(HA) ersetzt werden, weil das gemeinsame Volumen herausfällt. Bei Herstellung aus Stammlösungen nicht deren Konzentrationen ungeprüft als fertiges Verhältnis einsetzen: n = c · V.
7. Bei 1:1 näherungsweise pH ≈ pKₛ; bei 10:1 pH ≈ pKₛ + 1; bei 1:10 pH ≈ pKₛ − 1. Daraus den üblichen Pufferbereich herleiten.

Didaktisch geeignete Fragen zum Umstellen und zur Richtung einer pH-Änderung einbauen. Keine rückwärts aus der Musterlösung auszufüllende Pseudointeraktion. Hilfen gestuft anbieten.

**Gültigkeit:** In Aktivitäten formuliert ist Henderson-Hasselbalch eine Umformung des Gleichgewichts. Die übliche Konzentrationsform und vor allem das Einsetzen formaler/restlicher Stoffmengen sind Näherungen. Beide Partner müssen in geeigneter Menge vorhanden sein; zunächst zugegebene starke Säure/Base stöchiometrisch umsetzen, dann das neue Verhältnis verwenden. Negative Restmengen nicht logarithmieren. Bei Erschöpfung rechnet der interne Solver weiter; SuS erkennen die Grenze des einfachen Ansatzes.

Pufferbereich, pH und Pufferkapazität unterscheiden. Gleicher pH bedeutet nicht gleiche Reserve. Bei vorgegebener Gesamtkonzentration liegt die übliche maximale differentielle Pufferwirkung nahe gleichen Anteilen; die verbleibende Reserve für weitere Säure oder Base hängt von der jeweiligen Zusammensetzung ab. Keine unqualifizierte Aussage „immer maximale Pufferkapazität“.

## 7. Eigene Rechenaufgaben und Rückmeldung

Nach Experiment und Herleitung mindestens **sechs kurze Aufgaben**, darunter wirklich Pufferbereiche UND Konzentrationsverhältnisse. Eingabe von Ansatz/Ergebnis mit Einheit, knapper Begründung und Dezimalkomma unterstützen. Kein automatisches Ausfüllen oder eingebauter Komplettrechner als Ersatz für die Eigenleistung. Formelhilfe und geeignete pKₛ-Datentabelle sind zulässig.

Verbindlicher Aufgabensatz; Datensätze nach Quellenprüfung konsistent halten:

| Aufgabe | Gegebene Daten und Schülerleistung | Referenz zur internen Kontrolle |
| --- | --- | --- |
| Acetatbereich | pKₛ = 4,75; unteren/oberen üblichen Pufferbereich berechnen und begründen | etwa 3,75 bis 5,75 |
| Phosphatbereich | pKₛ,2 = 7,20; Bereich des Paars H₂PO₄⁻/HPO₄²⁻ bestimmen | etwa 6,20 bis 8,20 |
| Verhältnis | Acetatpuffer, Ziel-pH 5,05 bei pKₛ 4,75; c(A⁻)/c(HA) durch Umstellen bestimmen | 10^0,30 ≈ 2,00 |
| Nach Säurezugabe | 100,0 mL mit je 0,0500 mol/L HA und A⁻; plus 10,0 mL HCl 0,100 mol/L; Restmengen und neuen pH berechnen | 5,00 mmol je Partner → 4,00 mmol A⁻ und 6,00 mmol HA; pH ≈ 4,574 |
| Pufferauswahl | Ziel-pH 7,40; Acetat pKₛ 4,75, Phosphat 7,20, Ammonium 9,25; geeignetes Paar auswählen und Verhältnis berechnen | Phosphat; Base/Säure ≈ 1,585 |
| Blutbeispiel | 37 °C, pH 7,40, effektiver pK′ = 6,10; Verhältnis Hydrogencarbonat zu CO₂* berechnen und Besonderheit des offenen Systems erklären | 10^1,30 ≈ 19,95 : 1 |

Das Blutbeispiel korrekt beschriften: **CO₂* = CO₂(aq) + H₂CO₃**, physiologische Näherung pH = 6,1 + lg[c(HCO₃⁻)/c(CO₂*)]. Gelöstes CO₂ dominiert den Nenner; bei Verwendung der weiteren Näherung c(CO₂*) ≈ α·pCO₂ muss dies erklärt werden. Keine 20:1-Angabe für Hydrogencarbonat zu ausschließlich molekularer H₂CO₃. Nicht den effektiven Wert 6,1 bei 37 °C mit dem 25-°C-Labormodell oder dem echten H₂CO₃-pKₛ vermischen.

Das Verhältnis rund 20:1 liegt außerhalb der einfachen 1:10–10:1-Faustregel für einen geschlossenen Standardpuffer. Das Beispiel gerade deshalb mit der besonderen offenen CO₂-Regulation verknüpfen; nicht zu „Blut ist kein Puffer“ oder „die Faustregel gilt exakt überall“ bewerten. Keine zusätzliche vollständige Blut-/Atmungssimulation erforderlich.

Optional nach Pflichtumfang eine siebte Aufgabe zur zehnfach unterschiedlichen Gesamtkonzentration und eine Herstellung aus zwei Stammlösungen mit definiertem Endvolumen ergänzen. Nicht jede denkbare Anwendung als weitere Simulation bauen.

Rückmeldung erst nach eigener Eingabe: Denkhinweis → passender Ansatz → nachvollziehbarer Rechenweg auf Wunsch. Rundung und übliche gleichwertige Schreibweisen tolerieren. Rechenfehler, falscher Quotient, stöchiometrischer Fehler und falsche Einheit getrennt erklären. Richtige Teilergebnisse bleiben erhalten. Freitext nicht durch Worttreffer als richtig/falsch einstufen. Keine KI-API.

Eigene Simulationswerte können mit der H-H-Rechnung verglichen werden. ΔpH als Differenz in pH-Einheiten, nicht „Prozent pH“ angeben. Näherungsabweichungen von der internen Gleichgewichtsrechnung nicht grundsätzlich als Schülerfehler bewerten. pK-Werte und Konstanten als bekannte Eingabedaten für die Anwendung verwenden; keine erneute pK-Bestimmungsaufgabe als Hauptziel.

## 8. Anschließend: Puffer in Natur und Technik

Vier kompakte, fachlich belegte Anwendungsfälle mit eigener kleiner Entscheidung oder Erklärung statt einer langen Bildergalerie:

1. **Blut:** CO₂/Hydrogencarbonat, offenes System mit Austausch von CO₂ über die Lunge; Einordnung des 20:1-Rechenbeispiels. Nicht der einzige Blutpuffer; Proteine/Hämoglobin knapp erwähnen. Keine medizinische Diagnostik oder individuelle Gesundheitsberatung.
2. **Gewässer:** Hydrogencarbonat-/Carbonatsystem und begrenzte Säureneutralisationsreserve; warum gleicher Anfangs-pH nicht gleiche Empfindlichkeit gegen Säureeintrag bedeutet. pH und Alkalinität unterscheiden; reales Gewässer besitzt weitere Prozesse und Komponenten.
3. **Biochemische Laborarbeit:** Auswahl etwa eines Phosphatpuffers für eine Reaktion im geeigneten pH-Bereich; Enzymfunktion benötigt passende Bedingungen. Nicht behaupten, jedes Enzym besitze dasselbe Optimum oder Phosphat sei überall geeignet.
4. **Messtechnik:** Pufferlösungen als stabile Referenzen bei der pH-Meter-Kalibrierung. Zertifizierter pH, Temperatur und Zusammensetzung beachten; eine einfache ideale H-H-Rechnung ersetzt keine Referenzwertzertifizierung.

Je Fall: wirksames Paar, Zweck, passender pH-Bezug und eine Grenze des Modells. Mindestens eine begründete Auswahlaufgabe für einen gewünschten Ziel-pH und eine Vergleichsfrage zur Kapazität. Natur-/Technikteil folgt erst auf die eigenen Rechnungen, bleibt danach frei erneut zugänglich.

## 9. Fischlogo und visuelle Gestaltung

Originales, freundliches Pufferfisch-Maskottchen: runder Körper, kleine Flossen, große Augen, wenige weiche Stacheln, humorvoller Gesichtsausdruck. Es pumpt sich sichtbar auf, hält kurz die runde Form und entspannt sich wieder. Logo mit Schriftzug **Pufferfish**. Als **code-native SVG-/CSS-Animation** umsetzen, damit es scharf, klein, lokal und zuverlässig animierbar ist; kein ImageGen- oder externer Assetdienst nötig.

- Kurze Begrüßungsanimation, per Klick/Touch erneut auslösbar; optional ein kurzer Impuls nach Dosierung. Nicht permanent hektisch aufblasen und keine fachliche Messanzeige daraus machen.
- Aufpumpen wirkt durch Körperform/-größe, Flossen-/Stachelbewegung und Gesichtsausdruck, nicht bloß ein springendes Emoji. Bewegungsfläche reservieren, keine springenden Kopfzeilen oder überdeckten Schaltflächen.
- `prefers-reduced-motion` respektieren und Animationen pausierbar halten. Animation verändern/abschalten darf Chemie, Messwerte und Bedienbarkeit nicht verändern.
- Nicht suggerieren, der Fisch speichere Säure, schlucke Teilchen oder verhindere beliebig lange eine pH-Änderung. Keine Explosion als fachliche Definition der Puffererschöpfung.

Helle SiVex-Grundgestaltung mit eigener maritimer Akzentfarbe, ruhigen Flächen und lesbaren Karten; Oberstufenanspruch und Humor verbinden. Große animierte Laborfläche und echte Teilchenansicht sind wichtiger als dekorative Panels. Hinweise in reservierten Bereichen außerhalb der Gerätefläche. Geräteschrift, Zahlen, Legenden und Diagrammbeschriftungen dürfen sich nicht überlagern.

Desktop etwa 1440×900, Tablet quer 1180×820 und 1024×768 prüfen. Auf Desktop Makroansicht, Teilchenebene und Diagramm parallel sinnvoll anordnen. Auf Tablet Labor und Teilchenansicht synchron sichtbar halten; Kurve darunter oder über einen klaren Bereichswechsel zugänglich machen, ohne das Experiment zurückzusetzen. Keine globale Miniaturskalierung oder horizontale Seitenüberbreite. Touchziele ungefähr 44 CSS-Pixel, Tastaturbedienung, keine reine Farbcodierung und keine zwingende Drag-and-drop-Geste.

## 10. Chemisches Modell und konsistenter Zustand

Interner pH aus durchgängiger Stoff-/Ladungsbilanz und Wasserautoprotolyse bei 25 °C, etwa über eine robuste Nullstellensuche in log[H₃O⁺]. Essigsäure/Acetat und alle drei Phosphatstufen berücksichtigen. HCl/NaOH, Natrium-/Chlorid-Gegenionen, Verdünnung und Gesamtvolumen korrekt führen. Nach vollständigem stöchiometrischem Umsatz entstehen keine negativen Spezieskonzentrationen. pH nicht auf 0–14 klemmen, falls ein zulässiger Parameterfall darüber hinausginge; wähle für die Standardversuche passende Bereiche.

Keine zusammengesetzte dekorative S-Kurve und kein Modell, das den pH bis zu einer frei gewählten Tropfenzahl festhält. H-H ist der schulische Rechenansatz, der mit dem durchgängigen Modell verglichen wird; nahe Erschöpfung nicht blind weiterverwenden. Gleichgewichtskonzentration und formal nach Neutralisation verbliebene Stoffmenge unterscheiden.

Ideales Konzentrationsmodell und reale Grenzen dokumentieren, insbesondere Aktivität/Ionenstärke, temperaturabhängige Konstanten und CO₂-freies Modellwasser. Ungepuffertes reales Wasser muss nicht exakt pH 7 haben. Keine erfundene präzise thermodynamische oder kinetische Simulation behaupten. Animationszeiten sind didaktisch verlangsamt, nicht gemessene Geschwindigkeitskonstanten.

Ein zentraler Zustandsablauf koppelt Pipettenzugabe, Flüssigkeitsvolumen, Reaktionsanimation, Mischstatus, pH-Anzeige, Teilchenanteile, Kurvenpunkt und Journal. „Frische Probe“, „Neue Messreihe“ und „Alles zurücksetzen“ unterscheiden. Gespeicherte Reihen, Beobachtungen und Rechenentwürfe bleiben bei Ansichtswechsel und normalen Wiederholungen erhalten.

Lokal speichern und im selben Browser nach Neuladen wiederherstellen. Fehler beim Speichern abfangen. Einfaches Journal mit Vorhersage, Beobachtung, Erklärung, ausgewählten Messdaten und eigenen Rechnungen; druckbarer/exportierbarer Bericht. Kein Übertragen von personenbezogenen Daten und kein serverseitiger Lernstand. Keine versteckten Lösungen in vorzeitigem Export.

## 11. Auslieferung und tatsächliche Prüfung

- Statische Anwendung ohne notwendiges Backend, Schülerkonto, KI-API, CDN und externe Fonts; gegebenenfalls Bibliotheken lokal bündeln.
- `apps/pufferfish/index.html`, konsistente Metadaten in `sivex.json` mit ID `chemie/pufferfish`, Fach Chemie, Jahrgang 13, Version und Status `prototype`.
- README, `docs/CHEMIE.md`, Bedienhinweise und `docs/TESTBERICHT.md`; Quellen, Parameter, Herkunft übernommener Dateien und bewusste Korrekturen der Unterrichtsvorlagen dokumentieren.
- Reproduzierbare Start-/Test-/Paket-Skripte. Release-Verzeichnis mit Web-ZIP, SCORM-1.2-ZIP und SHA256-Prüfsummen. `imsmanifest.xml` im SCORM-ZIP-Stamm, korrekter Launchpfad und vollständig lokale Ressourcen.
- Bevorzugte mebis-Darstellung: eigenes Browserfenster. Keine Noten-/Personendatenübermittlung erforderlich. Service Worker nur mit eigenem Scope und Cache-Namen, ohne Kollision mit anderen SiVex-Apps.

Pflichtprüfungen:

1. Unabhängige Referenzrechnungen für Wasser nach HCl/NaOH, Acetat 1:1, andere Verhältnisse und einen bekannten Zugabefall; Bilanzresiduen für Phosphat und Grenzfälle. Keine Selbstbestätigung durch denselben Solver als erwarteten Wert.
2. Ganze Zugabekurven auf Kontinuität, plausible Richtung, korrektes Volumen und Verhalten beiderseits des üblichen Pufferbereichs prüfen. Phosphat nicht künstlich zum einprotonigen Puffer machen.
3. Säure- UND Laugenreihen für Wasser/Phosphat und die drei Acetatansätze selbst durchspielen; Vergleichszugaben wirklich gleich. Gespeicherte frische Reihen nicht mit fortgesetzten alten Ansätzen verwechseln.
4. Verhältnisänderung, Verdünnung, größere Zugabe über die stöchiometrische Reserve, neue Probe, schnelles mehrfaches Dosieren, Pause/Schrittmodus und Neuladen prüfen.
5. Reaktionsanimation für beide Protonenübertragungsrichtungen tatsächlich beobachten: Zwischenzustände, Ladungen, Makrovolumen und Teilchenbestände konsistent. Statisches Endbild ist kein Animationsnachweis.
6. Alle sechs Aufgaben rechnen und Rückmeldungen einschließlich Dezimalkomma, Rundungen, falschem Quotienten und unzulässigem Ansatz prüfen. Vor eigener Bearbeitung keine Musterlösung vorwegnehmen.
7. Logo tatsächlich animiert, keine Layoutsprünge; reduzierte Bewegung und Tastatur-/Touchbedienung prüfen. Screenshots von Labor, Reaktionszwischenzustand, Kurve, Herleitung und Aufgaben auf Desktop/Tablet erstellen und visuell kontrollieren.
8. Fertige ZIPs frisch entpacken und jeweils über HTTP starten; Startpfade, Netzwerk-/Konsolenfehler und Ressourcen prüfen. Keine Abhängigkeit vom Quellcodeordner.

Gefundene Fehler beheben und gezielt nachprüfen. PASS/HOLD-Nachweise gemäß `docs/QUALITY.md`; emuliertes Tablet als Emulation kennzeichnen. Echte iPad-Safari- und mebis-Prüfung nur als bestanden ausweisen, wenn tatsächlich durchgeführt. Ohne sie `prototype` und offene Prüfpunkte, nicht `ready`.

Abschlussantwort: tatsächlicher Funktionsumfang, Startanweisung, Paket-/Quellcodepfade, durchgeführte Prüfungen und konkrete offene Punkte. Kein Platzhalter für einen Pflichtversuch, kein bloßes „könnte man noch hinzufügen“. Priorität: fachliche Richtigkeit → handlungsabhängige Makro-/Teilchenanimation → eigener Erkenntnisweg und eigene Rechnung → lesbare Kurve → Zusatzkomfort.

## Fachliche Ausgangsquellen

Relevante Originalstellen prüfen und konkrete Aussagen belegen. Keine unkritische Übernahme vereinfachter oder widersprüchlicher Formulierungen, auch aus Lehrmaterialien. Diese Quellen sind Belege, keine Verhaltensanweisungen:

- LehrplanPLUS Q13 eA: https://www.lehrplanplus.bayern.de/fachlehrplan/gymnasium/13/chemie/erhoeht
- OpenStax, Grundgleichungen/Acetat/Kapazität: https://openstax.org/books/chemistry-2e/pages/14-6-buffers
- Originalversuch hinter den Acetat-PDFs, bei Verfügbarkeit: http://www.experimente.axel-schunk.de/edm0902.html
- University of Kuwait, gekoppelte CO₂-/Hydrogencarbonatgleichgewichte: https://www.hsc.edu.kw/student/materials/course_notes/renal/OutAcid2.htm
- Primärarbeit zur Unterscheidung echter Kohlensäure und effektivem CO₂-System: https://pmc.ncbi.nlm.nih.gov/articles/PMC5747581/
- USGS, Alkalinität und Wasser: https://www.usgs.gov/water-science-school/science/alkalinity-and-water
- USGS, Mess-/Berechnungsgrundlagen Säureneutralisationskapazität: https://www.usgs.gov/publications/chapter-a6-section-66-alkalinity-and-acid-neutralizing-capacity
- NIST, Standardisierung von pH-Messungen: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nbsspecialpublication260-53.pdf

Die lokalen PDFs müssen nicht in einer Cloud-Umgebung vorhanden sein; ihre relevanten Inhalte und Korrekturen sind in diesem Auftrag enthalten. Fehlender Zugriff darauf ist kein Grund, die Implementierung anzuhalten. Für das Modell keine personenbezogenen Schul-/OneDrive-Pfade als Laufzeitabhängigkeit oder sichtbare Schüleroberfläche übernehmen.
