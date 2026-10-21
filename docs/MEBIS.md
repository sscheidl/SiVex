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
- **OPEN:** Die HTML-Inhalte erscheinen im eingebetteten mebis-Fenster verkleinert; eine Vollbildoption wurde bislang nicht gefunden.
- **OPEN:** Vollständige Bedienbarkeit auf Schüler-iPads, Layout und echte Fullscreen-Option noch nicht abschließend verifiziert.

Diese Befunde nicht mit einer vollständigen mebis- oder iPad-Freigabe gleichsetzen.

## Nächste Maßnahme A: SCORM-Aktivität konfigurieren

Bei der SCORM-Aktivität in mebis „Einstellungen bearbeiten“ → „Ausführliche Eingabe“ → „Darstellung“ prüfen (die konkrete ByCS-Konfiguration kann Optionen einschränken):

1. „Lernpaket anzeigen“: falls verfügbar, „Neues Fenster“ gegen „Aktuelles Fenster“ testen.
2. Fensterbreite möglichst voll ausnutzen; bei Moodle kann „100 %“ für die Bühnenbreite genutzt werden.
3. Kursstruktur, Vorschalt- oder Übersichtsseiten bei nur einem Lernobjekt ausblenden bzw. überspringen, soweit verfügbar.
4. Popup-Sperren und Navigation zurück zum Kurs kontrollieren.

Moodle-Dokumentation: https://docs.moodle.org/502/en/Using_SCORM

Wichtig: Die oben genannten Einstellungen sind in Moodle dokumentiert; ihre konkrete Verfügbarkeit in mebis ist nicht bestätigt.

## Nächste Maßnahme B: Responsives SiVex-Layout

Jede Anwendung soll neben der normalen Webserver-Ansicht einen automatisch aktivierten Kompaktmodus für eingebettete SCORM-Anzeigen haben:

- Keine feste Mindestbreite, die zu horizontalem Scrollen oder Miniaturskalierung zwingt.
- Laborgrafiken proportional skalieren, ohne Touchziele unbedienbar klein zu machen.
- Steuer- und Auswertungsbereiche bei geringem Platz platzsparend anordnen oder einklappen.
- Animationslogik und chemisches Berechnungsmodell bleiben unverändert.
- Optional einen „Vollbild“-Button anbieten, aber nur als progressive Erweiterung: Fullscreen API und iPad-/iframe-Berechtigungen können ihn einschränken.
- Für Kompaktansicht und Vollbild die tatsächliche Sichtbarkeit aller wesentlichen Kontrollen durch Browser-Screenshots oder manuelle Tests verifizieren.

## Alternative: Webserver

Die gebaute Anwendung direkt auf einem statischen HTTPS-Webserver hosten und im Kurs verlinken. Eine Einbettung als iframe ist abhängig von den Sicherheitsrichtlinien des Schulservers und der Lernplattform und muss gesondert getestet werden.

## Noch offene Abnahmetests

1. Anzeigeoptionen der mebis-SCORM-Aktivität testen (aktuelles/neues Fenster).
2. Start und Bedienung mit aktuellem iPad-Safari und Desktop-Browser.
3. Darstellung von Animationen, Diagrammen, Flüssigkeiten und Touch-Steuerung, auch bei beengten Fenstern.
4. Erneuter Start nach Kurswechsel und Neuladen; keine Cache- oder Offline-Fehler.
5. Keine externen Ressourcenanfragen oder Übertragung personenbezogener Daten.

ByCS-Dokumentation: https://www.bycs.de/hilfe-und-tutorials/lernplattform/lernpaket-anlegen/index.html
