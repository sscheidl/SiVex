# mebis-/ByCS-Integration

## Ziel
SiVex-Simulationen sollen im mebis-Kurs unmittelbar im Browser starten, ohne Downloadzwang, Schülerkonto bei einem KI-Anbieter oder externe KI-API.

## Standard: SCORM 1.2

- Pro Anwendung aus statischen lokalen Dateien ein SCORM-ZIP erstellen.
- Das ZIP enthält `imsmanifest.xml` im Paketstamm und einen definierten Startpunkt `index.html`.
- In mebis im Kurs „Aktivität oder Material anlegen“ → „Lernpaket (SCORM)“ und das ZIP hochladen.
- Die App läuft innerhalb der Lernplattform; kein externer Server ist zum Laden ihrer Ressourcen erforderlich.
- In der ersten Stufe keine Rückmeldung von Noten, Fortschritten oder personenbezogenen Daten an mebis.

## Status der praktischen Erprobung (21.10.2026)

- **PASS (durch Lehrkraft bestätigt):** Das SCORM-Paket der Titrationssimulation lässt sich grundsätzlich in mebis einbinden und dort starten.
- **PASS (durch Lehrkraft bestätigt):** In den SCORM-Darstellungseinstellungen lässt sich das Lernpaket in einem **eigenen Browserfenster** öffnen. Dies ist die bevorzugte Darstellung für die SiVex-Simulationen.
- **BEKANNT:** Bei Anzeige innerhalb des mebis-Kursfensters wirkt die Simulation verkleinert; dafür ist gegenwärtig keine gesonderte Kompaktversion erforderlich.
- **PASS (durch Lehrkraft bestätigt, 23.10.2026):** TitraLab 3 und Redoxlabor (auch 1.3.1) laufen auf einem iPad mit Safari (iPadOS 26.6.2): funktionsfähig, bedienbar und lesbar. Zusätzlich in Edge und Firefox (jeweils aktuell) unter Windows 11 bestätigt. Beim Redoxlabor werden einige Grafikfehler getrennt behoben.
- **OPEN:** Verwaltete Schul-iPads mit Lerngruppe sowie das Fenster-/Tab-Verhalten von „Neues Fenster“ auf dem iPad sind noch nicht abschließend verifiziert.

Diese Befunde nicht mit einer vollständigen mebis- oder iPad-Freigabe gleichsetzen.

## Bestätigte Darstellung: separates Fenster

Bei der SCORM-Aktivität in mebis „Einstellungen bearbeiten“ → „Ausführliche Eingabe“ → „Darstellung“ prüfen (die konkrete ByCS-Konfiguration kann Optionen einschränken):

1. „Lernpaket anzeigen“: **„Neues Fenster“ (in mebis erfolgreich getestet)** wählen.
2. Fensterbreite möglichst voll ausnutzen; bei Moodle kann „100 %“ für die Bühnenbreite genutzt werden.
3. Kursstruktur, Vorschalt- oder Übersichtsseiten bei nur einem Lernobjekt ausblenden bzw. überspringen, soweit verfügbar.
4. Popup-Sperren und Navigation zurück zum Kurs kontrollieren.

Moodle-Dokumentation: https://docs.moodle.org/502/en/Using_SCORM

Wichtig: Die Option „Neues Fenster“ wurde in mebis praktisch bestätigt; weitere Darstellungseinstellungen können je nach ByCS-Konfiguration variieren.

## Responsives SiVex-Layout (nachrangig)

Das separate Browserfenster ist der bevorzugte Weg. Eine besondere Kompaktversion für eingebettete SCORM-Anzeigen ist **vorerst nicht erforderlich**; allgemeine Responsivität bleibt eine Qualitätsanforderung:

- Keine feste Mindestbreite, die zu horizontalem Scrollen oder Miniaturskalierung zwingt.
- Laborgrafiken proportional skalieren, ohne Touchziele unbedienbar klein zu machen.
- Steuer- und Auswertungsbereiche bei geringem Platz platzsparend anordnen oder einklappen.
- Animationslogik und chemisches Berechnungsmodell bleiben unverändert.
- Optional einen „Vollbild“-Button anbieten, aber nur als progressive Erweiterung: Fullscreen API und iPad-/iframe-Berechtigungen können ihn einschränken.
- Für Kompaktansicht und Vollbild die tatsächliche Sichtbarkeit aller wesentlichen Kontrollen durch Browser-Screenshots oder manuelle Tests verifizieren.

## Alternative: Webserver

Die gebaute Anwendung direkt auf einem statischen HTTPS-Webserver hosten und im Kurs verlinken. Eine Einbettung als iframe ist abhängig von den Sicherheitsrichtlinien des Schulservers und der Lernplattform und muss gesondert getestet werden.

## Noch offene Abnahmetests

1. Prüfen, wie „Neues Fenster“ auf Schul-iPads umgesetzt wird (Tab, separates Fenster, ggf. Pop-up-Sperre).
2. Start und vollständige Bedienung mit aktuellem iPad-Safari und Desktop-Browser.
3. Darstellung von Animationen, Diagrammen, Flüssigkeiten und Touch-Steuerung in der tatsächlich verfügbaren Fenstergröße.
4. Erneuter Start nach Kurswechsel und Neuladen; keine Cache- oder Offline-Fehler.
5. Keine externen Ressourcenanfragen oder Übertragung personenbezogener Daten.

ByCS-Dokumentation: https://www.bycs.de/hilfe-und-tutorials/lernplattform/lernpaket-anlegen/index.html
