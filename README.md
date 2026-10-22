# SiVex – Simulationen und virtuelle Experimente

SiVex ist eine thematisch organisierte Sammlung interaktiver naturwissenschaftlicher Lernanwendungen für den schulischen Einsatz. Die Simulationen laufen eigenständig im Browser und sollen auch in mebis (ByCS) nutzbar sein.

## Anwendungen – Chemie

| Anwendung | Verzeichnis | Status |
| --- | --- | --- |
| **TitraLab 3 (Claude)** – Säure-Base-Titration | `apps/chemie/titration/` | **Ausgewählt**; läuft in mebis. Download: [SCORM 1.2](apps/chemie/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip). Import als entpackter Quellcode ausstehend |
| [Redoxlabor – Fehling- und Tollens-Probe](apps/chemie/redoxlabor/) | `apps/chemie/redoxlabor/` | **prototype** – Redoxlabor 1.0 (Claude Code), Quellcode im Repo. Download: [SCORM 1.2](apps/chemie/redoxlabor/release/redoxlabor-1.0.0-scorm12.zip) · [Web-ZIP](apps/chemie/redoxlabor/release/redoxlabor-1.0.0-web.zip) · [Testbericht](apps/chemie/redoxlabor/docs/TESTBERICHT.md) |
| Esterbildung und chemisches Gleichgewicht | `apps/chemie/ester-gleichgewicht/` | In Planung |

Es gibt **keine separate ältere Titrationsversion** im Zielbestand. Die zuvor dokumentierte Codex-Version TitraLab 2 ist verworfen und wurde nicht als Quellcode eingecheckt.

## Aufbau

Die Verzeichnisse sind **nach Fach und Experiment**, nicht nach Jahrgangsstufe sortiert. Jahrgangsstufen stehen in `sivex.json`; das ermöglicht eine spätere Zuordnung zu mehreren LehrplanPLUS-Lernbereichen. Weitere Fächer sind derzeit nicht geplant.

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

Im Repository liegen derzeit Projektstruktur, Dokumentation und Manifeste. Die SCORM-1.2-Pakete liegen jeweils im Ordner `release/` der Anwendung: TitraLab 3 unter [`apps/chemie/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip`](apps/chemie/titration/release/SiVex-Titration-Claude-v3-mebis-SCORM12.zip), das Redoxlabor unter [`apps/chemie/redoxlabor/release/`](apps/chemie/redoxlabor/release/). Das Redoxlabor ist zusätzlich als Quellcode mit Tests eingecheckt; bei TitraLab 3 steht der Import als entpackter Quellcode noch aus. Die Herkunft aus dem SCORM-Release ist beim Import zu kennzeichnen.

## Lizenz

Die Datei `LICENSE` enthält die MIT-Lizenz.
