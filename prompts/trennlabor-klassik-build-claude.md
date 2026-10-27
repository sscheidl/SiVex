# Build-Auftrag für Claude Code: SiVex – klassisches Trennlabor

Version des Auftrags: 1.0 · 27.10.2026

## Auftrag

Implementiere den letzten Aufgabenblock „Klassische Trennverfahren“ des virtuellen SiVex-Trennlabors vollständig: fünf selbstständig bedienbare Versuche, eigene Beobachtungen, abschließende Multiple-Choice-Kontrolle mit Fachbegriffs-Lückentext und als letzten Schritt einen Hefteintrag. Liefere lauffähigen Quellcode, geprüfte Web-/SCORM-Pakete und einen ehrlichen Testbericht. Arbeite bis zum ausführbaren Ergebnis; ein Konzept, ein Mockup oder eine automatisch abgespielte Versuchsanimation genügt nicht.

**Die fachliche und didaktische Grundlage ist `docs/TRENNLABOR-PLANUNG.md`.** Dieser Auftrag konkretisiert deren Umsetzung. Neuere ausdrückliche Anweisungen des Auftraggebers haben Vorrang. Die Planungsdatei muss zusammen mit diesem Auftrag im Checkout vorliegen. Fehlt sie, nutze den vollständigen Umfang dieses Auftrags und dokumentiere die fehlende Referenz; erfinde keine zusätzlichen Anforderungen.

## 1. Repository lesen und Arbeitsstand respektieren

Lies zuerst gegebenenfalls geltende `AGENTS.md` sowie:

- `README.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/MEBIS.md`.
- `docs/TRENNLABOR-PLANUNG.md`.
- `apps/redoxlabor/README.md`, `apps/redoxlabor/docs/REVIEW-2026-10-22.md`, `apps/redoxlabor/docs/REVIEW-2026-10-22-UMSETZUNG.md`, `apps/redoxlabor/docs/TESTBERICHT.md`.
- Den aktuellen Redoxlabor-Code, insbesondere `index.html`, `css/app.css`, `js/render.js`, `js/ui.js`, `js/lab.js`, Build-/Paket- und SCORM-Code.
- `apps/titration/README.md` und den Renderer im Web-Release `apps/titration/release/SiVex-Titration-Claude-v3-web.zip`, Archivpfad `titration/js/view/lab-renderer.js`.

Prüfe `git status` vor Änderungen. Beim Erstellen dieses Auftrags war `apps/trennlabor/` im Arbeitsbaum bereits als gelöscht markiert. Ein älterer Stand mit Klassik, Chromatographie und Destillation existiert in Git HEAD. Diese Information ist ein Befund, kein Auftrag, die Löschungen durch einen pauschalen Checkout rückgängig zu machen. Historische Dateien bei Bedarf gezielt lesen und geeignete Teile bewusst übernehmen; keine historischen Testberichte, Screenshots oder Releases als neue Nachweise ausgeben.

Ziel ist der kanonische Pfad `apps/trennlabor/`, keine dauerhafte zweite Produktionsvariante. Ist er weiterhin entfernt, lege den neuen klassischen Laborblock dort gezielt an. Existieren im tatsächlichen aktuellen Arbeitsstand bereits andere Trennlaborbereiche, integriere Klassik als letzten Aufgabenblock und erhalte diese Bereiche. Entwickle Chromatographie oder Destillation für diesen Auftrag nicht neu und lege keine leeren Platzhalter dafür an. Andere Apps bleiben unverändert. Zulässig sind passende Aktualisierungen der zentralen Übersicht und Dokumentation. Keine Veröffentlichung, kein Push und keine PR-Erstellung als Teil dieses Auftrags.

## 2. Verbindlicher Umfang

Zielgruppe ist der schulische Chemie-Anfangsunterricht, passend zur bisherigen Zuordnung Chemie NTG 8 / SG 9. Klare deutsche Sprache, vertraute Laborbegriffe und schrittweise Hilfen. Die fünf Versuche werden nacheinander bearbeitet; innerhalb eines Versuchs sollen die SuS selbst entscheiden und handeln.

| Nr. | Versuch | Pflicht-Handlungen und Lernergebnis |
| --- | --- | --- |
| 1 | Sand und Wasser: sedimentieren und dekantieren | Aufrühren, absetzen lassen, vorsichtig abgießen; zu frühes bzw. schnelles Gießen erzeugt nachvollziehbar ein trübes Dekantat; erneut absetzen und korrigieren können |
| 2 | Sand und Wasser: filtrieren | Frischer Ansatz; Trichter, Papier und Vorlage selbst einrichten; Suspension aufgeben; Sand als Rückstand, Wasser als Filtrat; Ergebnis mit Dekantieren vergleichen |
| 3 | Kochsalzlösung: eindampfen | Klare Salzlösung in Abdampfschale bearbeiten, Heizung steuern, Wasserverlust und Kristallbildung beobachten; Salz gewinnen, Wasser wird hier nicht zurückgewonnen |
| 4 | Öl und Wasser: scheiden | Schütteln, vorübergehende Emulsion beobachten, entmischen lassen; Scheidetrichter einsetzen, Hahn steuern, untere Phase auffangen, Vorlage wechseln, Öl gesondert sammeln |
| 5 | Eisen, Sand und Kochsalz: eigene Trennkette | Alle drei Feststoffe getrennt gewinnen; Magnettrennung, Extraktion mit Wasser, Filtration und Eindampfen sinnvoll kombinieren |

Naheliegender Weg in Versuch 5: Magnet → Salz mit Wasser herauslösen → Sand abfiltrieren → Filtrat eindampfen. Andere fachlich funktionierende Reihenfolgen zulassen. Kein Zusatzversuch mit Tee; keine Erweiterung des Stoffkatalogs oder zusätzliche Trennverfahren erforderlich.

Die Lernziele müssen im Experiment und in der Auswertung vorkommen:

- Homogen/heterogen unterscheiden; Lösung, Suspension, Emulsion und Gemenge konkret benennen.
- **Stoffebene:** Was ist sichtbar, welche Stoffe bzw. Phasen befinden sich wo?
- **Teilchenebene:** Wie sind die Bestandteile verteilt, was verändert sich beim Trennen?
- **Aggregatzustände:** Was ist fest/flüssig/gasförmig, wo findet ein Zustandswechsel statt?
- **Kenneigenschaften/Trennprinzip:** unterschiedliche Löslichkeit, Dichte, Magnetismus und Flüchtigkeit; bei Filtration zusätzlich Korngröße im Verhältnis zu den Filterporen.

Korngröße ist ein Trennkriterium und nicht dieselbe Art charakteristischer Stoffeigenschaft wie Dichte oder Löslichkeit. Fachlich präzise bleiben, ohne den Lernablauf mit Fachsystematik zu überladen.

## 3. Fachmodell und Zustände

Baue ein kleines, überprüfbares Modell, das Stoffbestand, Verteilung und Handlungen tatsächlich koppelt. Verwende nachvollziehbare Mengen und Einheiten; Modellparameter und beschleunigte Zeiten dokumentieren. Keine Scheingenauigkeit und keine Behauptung einer quantitativ exakten Strömungsberechnung.

- Mengen pro Gefäß und Fraktion führen; festes/gelöstes Salz unterscheiden. Rückstand, anhaftende Flüssigkeit, Dampf und gegebenenfalls verschüttete Anteile nicht einfach verschwinden lassen.
- Salz löst sich nur bei vorhandenem Wasser und bis zur modellierten Löslichkeitsgrenze. Umrühren beeinflusst die Geschwindigkeit. Beim Wasserverlust bildet sich festes Salz; ungelöstes Salz kann als Feststoff im Filter verbleiben.
- Filter hält ausreichend große ungelöste Körner zurück. Wasser und gelöste Salzbestandteile passieren. Trockenes Filtrieren trennt ein Sand-Salz-Gemenge nicht.
- Sedimentation hängt an Ruhe bzw. Aufwirbelung; Gießtempo und Absetzgrad beeinflussen die Mitnahme von Sand.
- Öl ist im gewählten Modell nicht mit Wasser mischbar und weniger dicht. Nach Entmischung liegt Wasser unten. Im Scheidetrichter sind Phasengrenze, Ausfluss und Auffanggefäß gekoppelt. Zu spätes Schließen kann Fraktionen verunreinigen.
- Nur Eisen wird vom angebotenen Magneten angezogen. Bereits abgetrennte Bestandteile bleiben auch nach Folgehandlungen erhalten.
- Beim Eindampfen verdampft Wasser; Salz wird nicht gasförmig und ist zuvor nicht geschmolzen. Keine fortlaufenden Siedeblasen bei kalter Flüssigkeit. Wasserdampf selbst ist unsichtbar; sichtbarer Dunst besteht aus kondensiertem Wasser.
- Eine klare Salzlösung ist ein homogenes Gemisch. Ein zweischichtiges Öl-Wasser-Gemisch ist heterogen; „Emulsion“ bezeichnet hier den Zustand mit verteilten Flüssigkeitströpfchen nach dem Schütteln.

Definiere je Versuch sinnvolle, erreichbare Trennziele anhand des tatsächlichen Bestands in getrennten Fraktionen, nicht anhand einer starren Liste angeklickter Buttons. Begründe Toleranzen und Mengenschwellen. Besonders Versuch 1 darf nicht erst bei unrealistisch perfekter verlustfreier Trennung abschließbar sein. Ein noch unvollständiger oder misslungener Versuch soll beobachtet und nachvollziehbar verbessert werden können.

Belege fachlich nichttriviale Modellannahmen mit geeigneten Primär-/Bildungsquellen und dokumentiere bewusst gesetzte Unterrichtsparameter getrennt von Literaturwerten.

## 4. Interaktion und Animation – höchste Priorität

**Gewünscht ist eine professionelle, authentisch wirkende 2D-Laborgrafik mit handlungsabhängigen Flüssigkeitsbewegungen.** Dafür ausreichend Implementierungs- und Prüfzeit einplanen. Keine bloßen Vorher-Nachher-Bilder, keine Mengenänderungen ohne sichtbaren Transfer und keine minutenlangen automatisch vorgegebenen Abläufe nach einem einzigen Startknopf.

Die Titration war die erste App und hat einen älteren Gestaltungsstandard. **Ihre Flüssigkeitsanimation ist ausdrücklich eine positive Referenz; ihr dunkles Design ist keine Gestaltungsanforderung.** Im Titrationsrenderer insbesondere gedämpfte Oberflächenwellen, Tropfenimpulse, fallende Tropfen, Mischschlieren und rührabhängige Oberflächenbewegung untersuchen. Passende Prinzipien auf neue Gefäßgeometrien und den hellen Hintergrund übertragen; Zahlenwerte und Indikatoreffekte nicht blind kopieren.

Pflichtmerkmale:

- Plausible Geräteproportionen, transparente Glaswände, Glanzkanten, sichtbare Menisken und Phasengrenzen.
- Beim Neigen bleibt die freie Flüssigkeitsoberfläche näherungsweise horizontal. Strahl beginnt am Ausguss und trifft im Zielgefäß auf. Quelle verliert während desselben Transfers Flüssigkeit, in dem das Ziel gefüllt wird. Ein Stoppen beendet den Transfer konsistent.
- Oberflächen werden durch Gießen, Tropfen und Rühren angeregt; Bewegung klingt in Ruhe ab. Keine permanente unmotivierte Wellenbewegung.
- Sand bewegt sich beim Rühren mit, sedimentiert sichtbar und bildet einen wachsenden Bodensatz. Erneutes Rühren wirbelt vorhandenen Sand auf.
- Im Filter sammelt sich zunächst Flüssigkeit, Filtrat tropft in die Vorlage, Rückstand bleibt liegen. Papier und Vorlage sind vom Lernenden einzusetzen. Nachgießen und Kapazitätsgrenzen plausibel behandeln.
- Beim Eindampfen: sichtbare Aufheizphase, sinkender Flüssigkeitsstand, entstehende und wachsende Kristalle. Heizung ist steuerbar, Trockenlaufen wird verständlich behandelt.
- Öltröpfchen entstehen beim Schütteln und sammeln sich wieder zu einer Phase. Im Scheidetrichter sinkt die Grenzfläche passend zum Abfluss; die falsche Hahn-/Vorlagenbedienung ist sichtbar wirksam.
- Magnettrennung zeigt die Bewegung der Eisenkörner und deren Ablage im Sammelgefäß.

Lernende wählen Geräte und Gefäße, dosieren Wasser, rühren, warten, gießen und stoppen, steuern Heizung/Hahn und wechseln Auffanggefäße. Direktes Antippen auf der Bühne soll nutzbar sein. Drag-and-drop kann ergänzen; jeder wesentliche Vorgang muss auch durch verständliche Klick-/Touch-Kontrollen und Tastatur bedienbar sein. Laufende Prozesse über Pause und geeignete Zeitbeschleunigung beobachten können; Teilchenmodell und Makroansicht laufen synchron.

## 5. Helle SiVex-Gestaltung und logischer Bildaufbau

**Visuelle Referenz ist das aktuelle helle Redoxlabor:** kompakte dunkle Kopfzeile, große helle Laborfläche, ruhige neutrale Hintergründe, rechtes Bedienfeld, konsistente Typografie, Schaltflächen und Karten. Bestehende Screenshots ansehen. Nicht jeden alten Layoutfehler übernehmen.

- Klare Arbeitsplätze für Ausgangsgemisch, Bearbeitung und Auffanggefäße. Logische räumliche Beziehungen und ausreichender Abstand.
- **Einblendungen oberhalb des Experiments:** reservierter Hinweisbereich für Aufgabenimpuls, Meldungen und Hilfen, außerhalb der Gerätefläche. Weder Toasts noch Hilfekarten dürfen Geräte, Flüssigkeitsoberflächen oder Bedienziele überdecken. Lange Erläuterungen in den Bedien-/Auswertungsbereich verlagern.
- Text und Geräte besitzen eigene Layoutbereiche. Beschriftungen in festen Feldern an den Geräteplätzen; keine willkürlich auf die Apparatur geschriebenen Namen. Auch während Gießen und Schütteln keine Text-Geräte-Kollision.
- Steuerung kompakt und kontextbezogen. „Hahn schließen“, „Gießen stoppen“ und „Heizung aus“ bleiben erreichbar, ohne andere Inhalte zu verdecken.
- Teilchen-/Detailansicht bekommt einen reservierten Bereich, gegebenenfalls durch echte Neuaufteilung des Layouts. Keine schwebende Karte über dem Experiment. Verständliche Umordnung auf kleineren Bildschirmen, keine globale Miniaturskalierung.
- Richtwert für Touchziele mindestens 44 CSS-Pixel. Lesbare Schrift und sinnvolle Wortumbrüche. Keine horizontale Seitenüberbreite.

### Zwei unabhängige Schalter in der Kopfzeile

1. **Teilchenmodell** – standardmäßig aus; synchronisierte, schematische Teilchenansicht des ausgewählten Gefäßes bzw. aktuellen Trennschritts ein-/ausblenden.
2. **Gerätenamen** – standardmäßig an; Namen auf der Laborfläche ein-/ausblenden. Aktionsbeschriftungen, zugängliche Namen und Bedienhilfen bleiben vorhanden.

Schalter zeigen ihren Zustand, sind mit Maus/Touch/Tastatur bedienbar und behalten ihren Zustand beim Wechseln der Aufgaben oder Auswertungsansichten. Beide gleichzeitig aktiv: weiterhin überlappungsfreier Aufbau. Kopfzeile muss auch bei 1024×768 lesbar und bedienbar bleiben.

## 6. Einfaches, zustandsabhängiges Teilchenmodell

Kein statisches Erklärbild: Der aktuelle Inhalt und seine Entwicklung bestimmen die Darstellung. Bezug zum gewählten Gefäß, Legende und Modellcharakter klar nennen. Stoffe durch Form/Symbol und Farbe unterscheiden. Die sichtbaren Symbole sind repräsentativ, keine exakten Teilchenzahlen oder realen Maßstäbe.

- Wasser als einfache, konsistent verwendete Teilchensymbole; keine atomistische Detailanimation erforderlich.
- Sandkörner als feste Verbände darstellen; erläutern, dass ein Korn selbst aus sehr vielen Teilchen besteht. Verteilung, Absinken und Wiederaufwirbeln dem Makrozustand zuordnen.
- Gelöstes Kochsalz mit vereinfachten Na⁺-/Cl⁻-Symbolen zwischen Wasserteilchen zeigen. Keine erfundenen Kochsalzmoleküle oder weiterhin sichtbaren festen Salzkrümel für gelöstes Salz. Keine Hydrathüllen erforderlich.
- Filtration: Sandkörner bleiben im Rückstand; Wasser und gelöste Salzbestandteile passieren. Die schematisch nebeneinander dargestellten Größenordnungen ausdrücklich nicht als maßstäbliches Porenmodell ausgeben.
- Eindampfen: Wasser verlässt die Flüssigkeit, Salzbestandteile bleiben und ordnen sich zu Kristallen. „Gelöst“ nicht als eigenen Aggregatzustand oder Schmelzen erklären.
- Öl/Wasser: unterschiedliche Teilchensorten in getrennten Bereichen; Tröpfchen sind Ansammlungen vieler Ölteilchen, keine einzelnen Moleküle. Die Schüttel-/Entmischungsentwicklung abbilden.
- Magnettrennung: Eisenverbände bewegen sich zum Magneten; keine Umwandlung anderer Stoffe in Eisen.

Bei Pause halten die Vorgänge in beiden Darstellungen an. Ein-/Ausblenden verändert weder Mengen noch laufende Vorgänge. Beschreibender Text unterscheidet Beobachtung und Modellinterpretation.

## 7. Beobachtung, Lernkontrolle und abschließender Hefteintrag

Die feste Folge lautet: **fünf Versuche durchführen und selbst beobachten → gemeinsame Multiple-Choice-Kontrolle und Fachbegriffs-Lückentext → Hefteintrag.** Keine komplette Musterlösung vor der eigenen Arbeit anzeigen.

### Während der Versuche

Freies Beobachtungsfeld pro Versuch, Einordnung des Gemischs und knappe Auswertung ermöglichen. Beobachtung nicht nur aus einem vorgegebenen Erfolgssatz auswählen. Freitext nicht durch starren Wortvergleich als fachlich richtig/falsch einstufen. Beobachtung und Erklärung klar trennen, z. B. „Sand sammelt sich am Boden“ gegenüber „Sand ist unlöslich und dichter als Wasser“.

Entwürfe und fertige Beobachtungen lokal sichern. Fehlerhafte Antworten, Prüfen, Schließen/Öffnen, Aufgabe wechseln oder Ansichten umschalten löschen keine Eingaben. Zwischenstände besitzen einen Zeitpunkt/Zustandsbezug und bleiben als solche erhalten; der Versuch kann weiterlaufen und erneut beobachtet werden. Ein bewusstes Zurücksetzen betrifft nur den gewählten Ansatz, nicht alle bisherigen Arbeiten. Sitzungswiederherstellung nach Neuladen im selben Tab ermöglichen; keine serverseitige Speicherung.

### Vorletzter Schritt: Kontrolle

Erstelle etwa 8–10 verständliche Aussagen, als Multiple-Choice-Aufgaben mit klarer Angabe zur möglichen Mehrfachauswahl, sowie einen kurzen Lückentext mit etwa 8–10 Fachbegriffen. Alle fünf Versuche und alle vier Perspektiven abdecken. Aussagen sinnvoll gruppieren; nicht nur Verfahrensnamen abfragen.

Zentrale überprüfbare Inhalte:

- Klar bedeutet nicht rein; Salzlösung ist homogen, Suspension und Emulsion sind heterogen.
- Filter trennt ungelöste Körner, entfernt jedoch gelöstes Salz nicht.
- Extrahieren löst Salz heraus; anschließende Filtration ist ein eigener Schritt.
- Beim Eindampfen geht Wasser von flüssig zu gasförmig über, Salz kristallisiert.
- Nichtmischbarkeit und Dichte ermöglichen das Scheiden der angebotenen Flüssigkeiten.
- Eisen wird magnetisch abgetrennt; Stofftrennung erzeugt keine neuen Stoffe durch eine chemische Reaktion.
- Gelöstes Salz ist nicht flüssiges/geschmolzenes Salz; Öltröpfchen und Sandkörner bestehen aus vielen Teilchen.

Lückentext sichert u. a. Lösung, Suspension, Emulsion, Gemenge, Filtrat, Rückstand, Extraktion und Verfahrensbegriffe. Groß-/Kleinschreibung und fachlich gleichwertige Schreibweisen tolerant behandeln. Kleine Hilfe und konkrete Hilfestellung anbieten. Fehler gezielt erklären, nur betroffene Antworten korrigieren lassen. Richtige Eingaben bleiben erhalten. Freie Beobachtungsformulierungen dürfen die Freischaltung nicht durch eine vermeintliche Sprachprüfung blockieren.

### Letzter Schritt: Hefteintrag

Nach bearbeiteten Versuchen und korrigierter Kontrolle den abschließenden Hefteintrag freischalten. Vollständigen, schülergerechten Inhalt implementieren; keine Platzhalter. Die SuS schreiben ihn selbst ins Heft. Eigene Beobachtungen bleiben zum Vergleich zugänglich.

Der Hefteintrag umfasst:

1. Reinstoff/Stoffgemisch, homogen/heterogen und die vier untersuchten Gemischarten.
2. Pro Versuch dieselben Rubriken: Ausgangsgemisch und Benennung, Beobachtung auf **Stoffebene**, Erklärung auf **Teilchenebene**, **Aggregatzustände** und deren Änderungen, **Kenneigenschaft/Trennprinzip**, Ergebnis.
3. Eisen/Sand/Salz als begründete Trennkette.
4. Passende schematische Teilchenbilder, mindestens zum Vergleich Suspension/Lösung und gelöstes Salz/Kristall. Die Bilder im Hefteintrag sind unabhängig vom aktuellen Kopfzeilenschalter sichtbar.
5. Merksatz zur Trennung vorhandener Bestandteile ohne chemische Stoffumwandlung sowie Hinweis „gelöst“ ist kein zusätzlicher Aggregatzustand.

Kompakte Versuchskarten statt einer unlesbar breiten Gesamttabelle verwenden. Aggregatzustände nur dort als Änderung darstellen, wo tatsächlich ein Phasenwechsel stattfindet; Filtrieren macht einen gelösten Stoff nicht fest.

## 8. Konkrete Erfahrungen aus den bestehenden Apps übernehmen

Aus der dokumentierten Redoxlabor-Überarbeitung verbindlich berücksichtigen:

- Neutraler Beobachtungshintergrund; Farbe oder Trübung nicht durch dahinterliegende farbige Apparaturen verfälschen.
- Plausible Sedimentation und erneutes Aufwirbeln, Bläschen nur bei passenden Ursachen; keine dekorative Dauersiedegrafik.
- Bestehender Stoffbestand bleibt bei Folgehandlungen bestehen; ein Statuswechsel darf keine Stoffe entfernen oder in andere umdeuten.
- Entwürfe, Tastaturfokus und Scrollposition beim Neuzeichnen erhalten; fehlende Felder gezielt markieren.
- Frühere Protokolle als Zwischenstände speichern; aktueller Zustand darf erneut ausgewertet werden.
- Kompakte Ablaufanzeige, gut erreichbare Gerätesteuerung, lesbare Bezeichnungen und ausreichend große Trefferflächen.
- Beschreibende zugängliche Textausgabe zum sichtbaren Zustand und Bedienalternativen zu direktem Ziehen.

Die bisherigen Toasts des Redoxlabors nicht übernehmen, wenn sie über der Bühne liegen: In diesem Auftrag ist der Hinweisbereich oberhalb des Experiments verbindlich. Die Flüssigkeitseffekte der Titration gezielt verwenden; deren älteres dunkles Gesamtdesign nicht zum neuen Standard machen.

## 9. Technik und Lieferumfang

Statische Browseranwendung ohne Server-Laufzeit, externe APIs, Konten, CDNs, Webfonts oder Tracking. Alle Ressourcen lokal. Canvas 2D oder eine gleichwertige gut animierbare 2D-Lösung; Fachmodell, Versuchsteuerung, Renderer und UI nachvollziehbar trennen. Schulfähiger Offlinebetrieb aus den bereitgestellten Dateien; idealerweise wie bisher auch direkt über `index.html`. Falls dafür ein anderer Startweg nötig wird, vor Auslieferung mit dem Repo-Standard abgleichen und klar dokumentieren.

Reproduzierbare Build-/Paket-Skripte bereitstellen und nach allen letzten Änderungen ausführen. Mindestens liefern:

- `apps/trennlabor/index.html`, lokale Styles/JS/gegebenenfalls Assets.
- `apps/trennlabor/sivex.json` mit passender Beschreibung, Klassenstufen, Topics und Status `prototype`.
- `apps/trennlabor/README.md`: Start, Bedienung, Lernen, Tests, Grenzen und Release-Links.
- `apps/trennlabor/docs/CHEMIE.md`: Fachmodell, Quellen, Vereinfachungen und Parameter.
- `apps/trennlabor/docs/BEDIENUNG.md`, `apps/trennlabor/docs/TESTBERICHT.md`.
- Modell-/Regressionstests und Browserprüfungen mit Screenshots und Animationsnachweisen.
- Ein fertiges Web-ZIP und SCORM-1.2-ZIP unter `apps/trennlabor/release/`, nachvollziehbare Versionsnummer und SHA-256-Prüfsummen. Existierende andere Releases nicht überschreiben.

SCORM gemäß `docs/MEBIS.md`: Manifest im ZIP-Stamm, korrekter Einstieg, alle Ressourcen enthalten, kein externer Dienst. In dieser Ausbaustufe nur minimale LMS-An-/Abmeldung; keine Noten, Fortschritte oder personenbezogenen Daten an das LMS senden. Ohne LMS muss die App laufen. Bevorzugte mebis-Darstellung ist ein separates Fenster. Keine echte LMS-Prüfung behaupten, wenn nur eine simulierte API verwendet wurde.

Zentrale README/Architektur nur soweit nötig an den tatsächlich gelieferten Stand anpassen. Keine Behauptung bereits erteilter fachlicher oder schulpraktischer Freigaben. Status `ready` setzt die im Repo geforderten echten Prüfungen voraus.

## 10. Verbindliche Abnahme und Nachweise

Teste angemessen und gezielt, einschließlich folgender Fälle. Ein grüner Build oder einzelne Endzustands-Screenshots ersetzen diese Prüfungen nicht.

| Bereich | Nachzuweisendes Verhalten |
| --- | --- |
| Fachmodell | Bilanzen bleiben bei Transfers, Lösen, Kristallisation und Trennschritten konsistent; gelöstes Salz passiert Papier; die untere Wasserphase fließt zuerst; Magnet wirkt auf Eisen |
| Alle Versuche | Alle fünf Versuche über echte UI-Handlungen vollständig abschließen, einschließlich Beobachtung, gemeinsamer Kontrolle und Hefteintrag |
| Korrekturen | Zu früh dekantieren, Filtrieren ohne geeignetes Papier, ungelöstes Salz, verunreinigte Scheidefraktion und eine sinnvolle alternative Trennreihenfolge prüfen; keine unerklärbaren Sackgassen |
| Animation | Anfang, mehrere Zwischenzustände und Ende von Gießen, Tropfen, Wellen, Sedimentation, Phasentrennung, Lösen und Kristallbildung erfassen; räumliche Übergänge visuell ansehen |
| Teilchenmodell | Zustand passt zu Gefäß und Makroansicht; Lösen/Filtrieren/Eindampfen/Entmischen sichtbar; Pause und Zeitsteuerung synchron |
| Kopfzeile | Beide Schalter einzeln und kombiniert, nach Aufgaben-/Ansichtswechseln und auf Tablet bedienen; keine Zustandsverluste |
| Layout | Mindestens 1024×768, 1180×820 und 1920×1080; keine Text-Geräte-Kollision, kein horizontales Überlaufen, Hinweise oberhalb; beide Zusatzanzeigen aktiv und lange Rückmeldung mitprüfen |
| Touch/Tastatur | Alle wesentlichen Vorgänge per Antippen und beschrifteten Kontrollen; Tastaturfokus, bedienbare Schalter und erreichbare Stoppaktionen |
| Lernkontrolle | Falsche/richtige Mehrfachauswahl und Lücken, Korrektur, Begriffstoleranz, erhaltene Antworten; Hefteintrag erst nach abgeschlossenem Lernablauf |
| Vier Perspektiven | Stoffebene, Teilchenebene, Aggregatzustände und Kenneigenschaften in Kontrolle und Hefteintrag fachlich vorhanden |
| Speicherung | Notizen/Antworten über Fehler, Panelwechsel, Aufgabenwechsel und Neuladen im selben Tab erhalten; lokaler Versuch-Neustart löscht keine fremden Arbeiten |
| Pakete | Tatsächlich erzeugte Web-/SCORM-ZIPs entpacken, Ressourcen/Manifest prüfen, gepackte App im Browser starten und Pflichtablauf ausführen; simulierte LMS-An-/Abmeldung sowie Offlinebetrieb prüfen |

Für Animationen kurze Bildfolgen oder vergleichbare zeitliche Nachweise erstellen. Messungen müssen den laufenden Vorgang betreffen; Ruheflimmern ist kein Beleg für einen Transfer. Screenshots tatsächlich visuell prüfen und gefundene Probleme beheben. Tests für Mengen-/Bewertungsfehler müssen das fachliche Verhalten absichern und nicht bloß die implementierte Formel wiederholen.

Im Testbericht Umgebung, Befehle, Ergebnisse, Screenshot-/Bildfolgenpfade und Grenzen nennen. `PASS`, `HOLD – failed`, `HOLD – incomplete`, `HOLD – unverified` entsprechend `docs/QUALITY.md` verwenden. Echte iPad-/Safari-, mebis- und Unterrichtsprüfungen klar von Emulation trennen. Wenn solche Umgebungen fehlen, die übrige Implementierung und Paketprüfung trotzdem vollständig fertigstellen und die offene Prüfung ehrlich kennzeichnen.

## 11. Abschluss der Arbeit

Liefere eine kurze Abschlussmeldung mit:

1. Umgesetztem Verhalten und kanonischem Einstiegspfad.
2. Links/Pfaden zu Web-ZIP, SCORM-ZIP, Bedienung und Testbericht.
3. Tatsächlich ausgeführten Prüfungen und verbleibenden Einschränkungen.
4. Kurzem Hinweis, wie historischer Trennlaborcode verwendet bzw. ersetzt wurde und ob andere vorhandene Bereiche integriert wurden.

Arbeite innerhalb des beschriebenen Umfangs selbstständig. Routineentscheidungen bei Layout und Technik begründet treffen und umsetzen. Keine zusätzlichen Funktionen oder weiteren Versuchsblöcke einführen, um den Auftrag zu erweitern. Priorität: fachlich richtige, wirklich interaktive Versuche; überzeugende Flüssigkeitsanimation; klare überlappungsfreie helle Gestaltung; sinnvolles Teilchenmodell; vollständiger Lernabschluss.
