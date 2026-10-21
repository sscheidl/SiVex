# mebis-/ByCS-Integration

## Ziel
SiVex-Simulationen sollen im mebis-Kurs unmittelbar im Browser starten, ohne Downloadzwang, Schülerkonto bei einem KI-Anbieter oder externe KI-API.

## Geplanter Standard: SCORM 1.2

- Pro Anwendung aus statischen lokalen Dateien ein SCORM-ZIP erstellen.
- Das ZIP enthält `imsmanifest.xml` im Paketstamm und einen definierten Startpunkt `index.html`.
- In mebis im Kurs „Aktivität oder Material anlegen“ → „Lernpaket (SCORM)“ und das ZIP hochladen.
- Die App läuft innerhalb der Lernplattform; kein externer Server ist zum Laden ihrer Ressourcen erforderlich.
- In der ersten Stufe keine Rückmeldung von Noten, Fortschritten oder personenbezogenen Daten an mebis.

## Alternative: Webserver

Die gebaute Anwendung direkt auf einem statischen HTTPS-Webserver hosten und im Kurs verlinken. Eine Einbettung als iframe ist abhängig von den Sicherheitsrichtlinien des Schulservers und der Lernplattform und muss gesondert getestet werden.

## Abnahmetests

1. Import des ZIP-Pakets in den tatsächlichen mebis-Kurs.
2. Start und Bedienung mit aktuellem iPad-Safari und Desktop-Browser.
3. Darstellung von Animationen, Diagrammen, Flüssigkeiten und Touch-Steuerung.
4. Erneuter Start nach Kurswechsel und Neuladen; keine Cache- oder Offline-Fehler.
5. Keine externen Ressourcenanfragen oder Übertragung personenbezogener Daten.

**Status:** Export vorbereitet; mebis-End-to-End-Test noch offen.

ByCS-Dokumentation: https://www.bycs.de/hilfe-und-tutorials/lernplattform/lernpaket-anlegen/index.html
