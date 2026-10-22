# TitraLab 3 (Claude)

Virtuelle Säure-Base-Titration für SiVex.

**Einzige ausgewählte Titrationsversion: TitraLab 3 von Claude.** Die frühere Codex-Variante TitraLab 2 wurde verworfen und gehört nicht zum Projektbestand.

## Aktueller Stand

- Das funktionsfähige SCORM-1.2-Release liegt außerhalb von GitHub vor.
- Im Release enthalten: `index.html`, CSS, lesbare JavaScript-Module, Grafiken, Service Worker und `imsmanifest.xml`.
- Alle 10 JavaScript-Dateien haben den Syntaxcheck bestanden.
- Die praktische Einbindung in mebis und die Darstellung in einem separaten Browserfenster wurden bestätigt.
- Der vollständige Test auf Schul-iPads steht noch aus.
- **Der eigentliche Anwendungscode ist noch nicht in diesem Repository eingecheckt.**

## Vorgesehener Quellcode-Import

`apps/chemie/titration/` bleibt die kanonische Anwendung. Die aus dem SCORM-Release rekonstruierte Ausgabe soll zunächst in `apps/chemie/titration/titralab3/` abgelegt werden. Dort muss sie mit `index.html` und ihren relativen Ressourcen lauffähig sein.

Die ursprüngliche lokale Entwicklungshistorie und nicht im Release enthaltene Hilfsdateien können nur aus weiteren Backups wiederhergestellt werden.
