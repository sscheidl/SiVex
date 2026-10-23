# TitraLab 3 (Claude)

Virtuelle Säure-Base-Titration für SiVex.

![TitraLab 3 – Titrierlabor](docs/titralab3-screenshot.png)

## Download

**[⬇ SCORM-1.2-Paket herunterladen (SiVex-Titration-Claude-v3-mebis-SCORM12.zip)](https://github.com/sscheidl/sivex/raw/main/apps/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip)** · [⬇ Web-Version (SiVex-Titration-Claude-v3-web.zip)](https://github.com/sscheidl/sivex/raw/main/apps/titration/release/SiVex-Titration-Claude-v3-web.zip)

In mebis: Kurs → „Aktivität oder Material anlegen“ → „Lernpaket (SCORM)“ → ZIP hochladen → Darstellung „Neues Fenster“.

Webserver: Web-ZIP entpacken und den Ordner `titration/` per HTTPS bereitstellen. Prüfsummen: [`release/SHA256SUMS.txt`](release/SHA256SUMS.txt).

**Einzige ausgewählte Titrationsversion: TitraLab 3 von Claude.** Die frühere Codex-Variante TitraLab 2 wurde verworfen und gehört nicht zum Projektbestand.

## Aktueller Stand

- Das funktionsfähige SCORM-1.2-Release liegt im Repository unter [`release/`](release/) (Download siehe oben).
- Im Release enthalten: `index.html`, CSS, lesbare JavaScript-Module, Grafiken, Service Worker und `imsmanifest.xml`.
- Alle 10 JavaScript-Dateien haben den Syntaxcheck bestanden.
- Die praktische Einbindung in mebis und die Darstellung in einem separaten Browserfenster wurden bestätigt.
- Von der Lehrkraft am 23.10.2026 auf einem **iPad mit Safari (iPadOS 26.6.2)** sowie in **Edge** und **Firefox** (jeweils aktuell, Windows 11) geprüft: grundsätzlich funktionsfähig und lauffähig, bedienbar und gut erkennbar. Offen bleibt ein Test auf verwalteten Schul-iPads mit einer Lerngruppe.
- Der Anwendungscode ist vollständig im SCORM-Paket enthalten; als entpackter Quellcode (`titralab3/`) ist er noch nicht eingecheckt.

## Vorgesehener Quellcode-Import

`apps/titration/` bleibt die kanonische Anwendung. Die aus dem SCORM-Release rekonstruierte Ausgabe soll zunächst in `apps/titration/titralab3/` abgelegt werden. Dort muss sie mit `index.html` und ihren relativen Ressourcen lauffähig sein.

Die ursprüngliche lokale Entwicklungshistorie und nicht im Release enthaltene Hilfsdateien können nur aus weiteren Backups wiederhergestellt werden.
