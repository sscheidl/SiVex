# Fachliche und technische Qualitätssicherung

## Statusregeln

- **PASS:** Erfolgreich überprüft; Nachweis dokumentiert.
- **HOLD – failed:** Konkreter Fehler gefunden.
- **HOLD – incomplete:** Verpflichtende Funktion fehlt.
- **HOLD – unverified:** Prüfung nicht möglich / Nachweis fehlt.

## Mindestprüfung je Experiment

1. Fachliche Modelle und Grenzen dokumentieren.
2. Positive, negative und Grenzfälle prüfen.
3. Beobachtbare Reaktionen müssen von Schülerhandlungen abhängen.
4. Animationen als tatsächliche Übergänge prüfen, nicht nur Endzustände.
5. Touchbedienung auf iPad, nicht nur Maus auf Desktop.
6. Verständliche Beschriftungen und keine zwingende rein farbliche Informationsübermittlung.
7. Keine personenbezogenen Daten an Drittanbieter.
8. Prüfung des Webserver-Builds und eines SCORM-Imports in mebis.

Ein bestandener Build bedeutet noch keine fachliche Freigabe.

## Verbindliche Gestaltungsmerkmale für weitere Apps

Festgelegt am 23.10.2026 nach dem Praxistest von TitraLab 3, Redoxlabor und Trennlabor (iPad mit Safari, Edge und Firefox unter Windows 11). Gilt für alle neuen und alle grundlegend überarbeiteten SiVex-Apps; Abweichungen sind im Testbericht zu begründen.

### Flüssigkeiten und Glasgefäße wie im TitraLab 3

Die Darstellung von Flüssigkeiten im TitraLab 3 ist der Maßstab: fallende **Tropfen**, Flüssigkeitsspiegel mit **Meniskus** (z. B. im Erlenmeyerkolben) und die Darstellung der **Glasgefäße**. Neue Apps übernehmen diesen Lösungsansatz, statt eigene Varianten zu entwickeln.

- **Referenz:** `apps/titration/release/SiVex-Titration-Claude-v3-web.zip` → `titration/js/view/lab-renderer.js` (Gefäße, Flüssigkeit, Meniskus, Tropfen) und `titration/js/view/geometry.js`
- Der TitraLab-Quellcode ist noch nicht entpackt eingecheckt (siehe `apps/titration/README.md`). Die Übernahme wird einfacher, sobald der geplante Import erledigt ist; das TitraLab selbst wird dafür nicht verändert.
- Flüssigkeitsmenge, Spiegelhöhe und Tropfen hängen weiterhin ausschließlich vom Modellzustand ab.

### Verschiebbare Trennlinie zwischen Labor und Bedienfeld

Wie im TitraLab 3 lassen sich die Laborbühne und das Bedienfeld über eine Trennlinie **horizontal in der Breite verschieben**. Das erhöht die Flexibilität und verbessert die Ablesbarkeit auf unterschiedlichen Bildschirmen.

- Bedienung mit Maus, Finger (Touch-Fläche mindestens 44 px breit) und Tastatur (Pfeiltasten); Doppelklick setzt die Standardbreite zurück
- Sinnvolle Mindest- und Höchstbreiten, damit weder Bühne noch Bedienfeld unbrauchbar schmal werden
- Gewählte Breite nur lokal im Browser merken (keine Übertragung)
- Auf schmalen Bildschirmen (TitraLab 3: unter 900 px) Bühne und Bedienfeld untereinander anordnen, Trennlinie ausblenden
- **Referenz:** `titration/js/ui/app.js` (`setPanelWidth`, `bindSplitter`) und `titration/css/styles.css` (`.splitter`)

### Prüfung

Zusätzlich zur Mindestprüfung: Tropfen und Meniskus als tatsächliche Übergänge prüfen (nicht nur Endzustände), Trennlinie per Maus, Finger und Tastatur bei Desktop- und Tablet-Breiten verschieben und dabei kontrollieren, dass Bühne und Bedienfeld lesbar und bedienbar bleiben.

## iPad- und Bedienregeln für alle Apps

Festgelegt am 30.10.2026 nach dem Unterrichtseinsatz von Trennverfahren und Aggregatzuständen auf Schul-iPads (iPad 8. Generation, Safari, meist Querformat; Start aus mebis im neuen Fenster). Gilt für alle bestehenden und neuen SiVex-Apps; Begründung: [Entscheidung](decisions/2026-10-30-ipad-bedienregeln.md). Die Bausteine für Regel 1 und 2 liegen ab Labkit 0.2.0 im gemeinsamen Baukasten.

### 1. Auswahlmenüs überlappen keinen Text

Auswahllisten (`<select>`) in Bedienfeldern, Protokollen und Lückentexten dürfen bei schmalem Bedienfeld nie angrenzenden Text überdecken.

- Zeilen „Text | Auswahl“ umbrechen: Ist nicht genug Platz, rutscht die Auswahl unter den Text und nimmt die volle Breite ein (Labkit: `.lk-choice`).
- Auswahllisten dürfen schmaler werden als ihr längster Eintrag (`max-width: 100%`, `min-width: 0`); Safari kürzt den sichtbaren Text, die Liste zeigt beim Antippen alle Einträge vollständig.
- Lange Wörter dürfen umbrechen (`overflow-wrap: anywhere`, `hyphens: auto` bei `lang="de"`).

### 2. Auswahllisten springen nicht von selbst auf

Safari auf dem iPad öffnet eine Auswahlliste, sobald sie den Fokus erhält. Wird das Bedienfeld nach einer Eingabe neu aufgebaut, bekommt eine Auswahlliste den Fokus deshalb **nur nach Tastaturbedienung** zurück (Labkit: `LK.core.restoreFocus`). Andere Felder (Textfelder, Knöpfe) werden wie bisher wieder fokussiert.

### 3. Gefäße haben ein Fassungsvermögen

- **Aktives Zugeben** (Gießen, Pipette, Bürette, Spritzflasche in ein Gefäß) stoppt bzw. wird abgewiesen mit „… ist voll“.
- **Was von selbst nachläuft** (Filtrat, Ablauf am Hahn, Destillat, Tropfen) lässt ein volles Auffanggefäß **überlaufen**: Das Gefäß bleibt randvoll, der Überschuss geht in einen Verlusttopf („verschüttet“), sichtbar als Pfütze, mit einer Warnung.
- Bilanz bleibt erhalten; kein Gefäß nimmt mehr auf, als hineinpasst.

### 4. Pause blockiert nie

- **Bedienen beendet die Pause:** Startet jemand bei angehaltener Zeit einen Handgriff oder tippt während eines angehaltenen Handgriffs etwas an, läuft die Zeit wieder mit 1× (kurze Meldung). Ein Handgriff darf nie unsichtbar stillstehen und alles Weitere mit „Warte …“ abweisen.
- **Versuchswechsel** (Apps mit mehreren Versuchen): Laufendes Gießen wird gestoppt, ein angefangener Handgriff im verlassenen Versuch abgeschlossen, die Zeit auf 1× gestellt.
- Eine gespeicherte Sitzung startet nie pausiert.

### In Erprobung (noch keine Regel)

- **Kompakte Bedienung direkt am Gerät:** Die Leiste unter der Laborbühne braucht auf dem iPad bis zu drei Zeilen. Geprüft wird eine Testvariante des Trennverfahrens mit Einstellungen als kleine Schaltflächen am gewählten Gerät (Gießtempo, Wassermenge, Schütteln, Stopp beim Gießen) und ohne Zielknöpfe. Erst nach Vergleich im Unterricht wird daraus eine Regel.
- **mebis und Pop-up-Blocker:** Darstellung „Neues Fenster“ bleibt. Zu prüfen: Mit „Struktur der Inhaltsseite überspringen: Nie“ öffnet das Fenster nach dem Antippen von „Eintreten“ auch bei eingeschaltetem Pop-up-Blocker (siehe [`MEBIS.md`](MEBIS.md)).

### Prüfung

Zusätzlich zur Mindestprüfung: Bedienfeld auf die kleinste Breite ziehen und alle Auswahllisten ansehen; jede Auswahlliste per Antippen und per Tastatur bedienen; jedes Auffanggefäß bis zum Überlaufen füllen; in jedem Versuch pausieren, Versuch wechseln und weiterarbeiten.

## Verbindliche Lern- und Auswertungsstruktur für weitere Apps

Festgelegt am 23.10.2026. Vorbild ist das **Redoxlabor** mit Protokoll, Ergebnisübersicht und Redox-Trainer. Die Bausteine lassen sich nicht 1:1 auf jedes Labor übertragen; das **Grundprinzip**, der **Aufbau** und die **Art der Fragestellungen** sind aber einheitlich zu übernehmen, damit alle SiVex-Apps gleich funktionieren und gleich aussehen.

### Grundsatz: Selbstkontrolle

Die Schülerinnen und Schüler müssen ihre **eigene Beobachtung** und die daraus gewonnenen **Erkenntnisse selbst überprüfen** können, und bei Bedarf Hilfe oder die Lösung anfordern.

- **Geschlossene Antwortformate:** Auswahl aus mehreren Möglichkeiten (eine richtige Antwort) und Ankreuzen (alles Zutreffende); Auswahlfelder in Gleichungen. Freie Eingaben nur, wo es fachlich nötig ist.
- **Plausible Falschantworten**, die typische Fehlvorstellungen aufgreifen.
- **Angemessener Schwierigkeitsgrad**, sodass die Lernenden ohne Lehrkraft prüfen können, ob sie richtig liegen.
- **Sofortige, konkrete Rückmeldung** je Feld (richtig/falsch markiert), keine Pauschalbewertung.
- **Hilfe auf Anforderung** in drei Stufen (Tipp 1/3 bis 3/3), passend zum jeweiligen Schritt.
- **Lösung anzeigen** ist immer möglich, aber bewusst anzufordern (bei unvollständiger Bearbeitung mit Rückfrage).
- Keine Noten- oder Fortschrittsübertragung an das LMS (siehe [`MEBIS.md`](MEBIS.md)).

### Bausteine (nach Redoxlabor)

| Baustein | Zweck | Aufbau im Redoxlabor |
| --- | --- | --- |
| **Protokoll** | eigene Beobachtung festhalten und deuten | an den tatsächlichen Versuchszustand gebunden; Formular in nummerierten Schritten: 1. Verfahren (Auswahl) → 2. Beobachtung (alles Zutreffende ankreuzen) → 3. Ergebnis → 4. Deutung → 5. Einordnung; „Speichern und auswerten“ markiert jedes Feld, „Lösung anzeigen“ auf Anforderung; Eingaben bleiben erhalten; Hinweis, wenn sich der Versuch seitdem verändert hat |
| **Ergebnisübersicht** | eigene Versuche vergleichen und verallgemeinern | Tabelle aller protokollierten Versuche mit dem zuletzt gültigen Ergebnis; im Analysemodus Einordnung prüfen und Auflösung auf Anforderung; Hinweis auf Grenzen des Verfahrens |
| **Trainer** | Erkenntnis schrittweise erarbeiten (im Redoxlabor: Redoxgleichungen) | nummerierte Schritte, jeder erst nach dem vorherigen freigeschaltet; Auswahlfelder; „Prüfen“ markiert Felder rot/grün; „Tipp n/3“, „Lösung dieses Schritts“, „Vollständige Musterlösung anzeigen“ |

Welche Bausteine ein Labor braucht und was der Trainer dort erarbeitet (z. B. Gleichungen, Rf-Werte, Begriffszuordnungen), richtet sich nach dem Thema. Bezeichnungen der Schaltflächen, Reihenfolge und Rückmeldeformen bleiben gleich.

**Referenz:** `apps/redoxlabor/js/ui.js` (`formHtml`, `feedbackHtml`, `overviewHtml`, `redoxHtml`), `apps/redoxlabor/js/redox.js` (`buildTrainer`, `checkStep`), Antwortoptionen in `apps/redoxlabor/js/chemistry.js` (`METHODS`, `OBSERVATIONS`, `RESULTS`, `INTERPRETATIONS`).

### Zusammenfassung fürs Heft am Schluss

Jedes Labor endet mit einer **kurzen Zusammenfassung zum Abschreiben ins Heft**:

- die **wichtigsten Fachbegriffe** mit knapper Bedeutung, die **wichtigsten Zusammenhänge** und, je nach Labor, die zugehörigen **Reaktionsgleichungen oder Definitionen**
- **kurz, sachlich, prägnant**: in etwa **5 Minuten in Stillarbeit** abschreibbar (Richtwert: rund 100 Wörter zuzüglich Gleichungen)
- **für alle erreichbar**, auch wenn der eigene Versuch nicht gelungen ist: Wer nicht mitgekommen ist, etwas falsch gemacht oder nicht aufgepasst hat, kann zumindest das Wichtigste übernehmen. Der Inhalt hängt deshalb nicht von den eigenen Messwerten ab.
- in allen Apps gleich gestaltet: Überschrift, Merksätze, Fachbegriffe hervorgehoben, Gleichungen in eigener Zeile

### Prüfung

Zusätzlich zur Mindestprüfung: richtige, teilweise richtige und falsche Antworten in jedem Baustein durchspielen (Markierung und Rückmeldung), alle Hilfestufen und „Lösung anzeigen“ auslösen, die Zusammenfassung ohne gelungenen Versuch aufrufen und die Abschreibzeit von etwa 5 Minuten realistisch einschätzen.
