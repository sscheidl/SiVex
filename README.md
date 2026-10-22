# SiVex – Simulationen und virtuelle Experimente

SiVex ist eine thematisch organisierte Sammlung interaktiver naturwissenschaftlicher Lernanwendungen für den schulischen Einsatz. Die Simulationen laufen eigenständig im Browser und sollen auch in mebis (ByCS) nutzbar sein.

## Anwendungen – Chemie

| Anwendung | Verzeichnis | Status |
| --- | --- | --- |
| **TitraLab 3 (Claude)** – Säure-Base-Titration | `apps/titration/` | **Ausgewählt**; läuft in mebis. **[⬇ SCORM 1.2](https://github.com/sscheidl/sivex/raw/main/apps/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip)** · [⬇ Web-ZIP](https://github.com/sscheidl/sivex/raw/main/apps/titration/release/SiVex-Titration-Claude-v3-web.zip). Import als entpackter Quellcode ausstehend |
| [Redoxlabor – Fehling- und Tollens-Probe](apps/redoxlabor/) | `apps/redoxlabor/` | **prototype** – Redoxlabor 1.2 (Claude Code; überarbeitet nach Prüfung vom 22.10.2026, mit Zuckern als Feststoffen), Quellcode im Repo. **[⬇ SCORM 1.2](https://github.com/sscheidl/sivex/raw/main/apps/redoxlabor/release/redoxlabor-1.2.0-scorm12.zip)** · [⬇ Web-ZIP](https://github.com/sscheidl/sivex/raw/main/apps/redoxlabor/release/redoxlabor-1.2.0-web.zip) · [Testbericht](apps/redoxlabor/docs/TESTBERICHT.md) |
| Esterbildung und chemisches Gleichgewicht | `apps/ester-gleichgewicht/` | In Planung |

Es gibt **keine separate ältere Titrationsversion** im Zielbestand. Die zuvor dokumentierte Codex-Version TitraLab 2 ist verworfen und wurde nicht als Quellcode eingecheckt.

## Vorschau

| TitraLab 3 – Säure-Base-Titration | Redoxlabor – Fehling- und Tollens-Probe |
| --- | --- |
| [![TitraLab 3](apps/titration/docs/titralab3-screenshot.png)](apps/titration/) | [![Redoxlabor](apps/redoxlabor/docs/screenshots/01-labortisch.png)](apps/redoxlabor/) |
| **[⬇ SCORM 1.2](https://github.com/sscheidl/sivex/raw/main/apps/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip)** · [⬇ Web-ZIP](https://github.com/sscheidl/sivex/raw/main/apps/titration/release/SiVex-Titration-Claude-v3-web.zip) | **[⬇ SCORM 1.2](https://github.com/sscheidl/sivex/raw/main/apps/redoxlabor/release/redoxlabor-1.2.0-scorm12.zip)** · [⬇ Web-ZIP](https://github.com/sscheidl/sivex/raw/main/apps/redoxlabor/release/redoxlabor-1.2.0-web.zip) |

## Aufbau

Die Verzeichnisse sind **nach Experiment**, nicht nach Fach oder Jahrgangsstufe sortiert. Fach und Jahrgangsstufen stehen in `sivex.json`; das ermöglicht eine spätere Zuordnung zu mehreren LehrplanPLUS-Lernbereichen. Weitere Fächer sind derzeit nicht geplant.

## Veröffentlichungswege

1. **Webserver:** Statische Dateien über HTTPS bereitstellen.
2. **mebis:** SCORM-1.2-ZIP pro Simulation als Aktivität „Lernpaket (SCORM)“ starten.

## Qualitätsgrundsätze

- Fachliche Richtigkeit und didaktische Angemessenheit
- Handlungsgekoppelte Reaktionen und Animationen
- Touchbedienbarkeit und verständliche Benutzerführung
- Keine personenbezogenen Schülerdaten an Drittanbieter
- Getestete Web- und mebis-Ausführung

Siehe [mebis-Konzept](docs/MEBIS.md), [Architektur](docs/ARCHITECTURE.md) und [Qualitätsregeln](docs/QUALITY.md).

## Code-Stand

Im Repository liegen derzeit Projektstruktur, Dokumentation und Manifeste. Die SCORM-1.2-Pakete liegen jeweils im Ordner `release/` der Anwendung: TitraLab 3 unter [`apps/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip`](apps/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip), das Redoxlabor unter [`apps/redoxlabor/release/`](apps/redoxlabor/release/). Das Redoxlabor ist zusätzlich als Quellcode mit Tests eingecheckt; bei TitraLab 3 steht der Import als entpackter Quellcode noch aus. Die Herkunft aus dem SCORM-Release ist beim Import zu kennzeichnen.

## Lizenz

Die Datei `LICENSE` enthält die MIT-Lizenz.
