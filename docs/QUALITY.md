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
