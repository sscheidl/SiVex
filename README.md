# SiVex – Simulationen und virtuelle Experimente

SiVex ist eine thematisch organisierte Sammlung interaktiver naturwissenschaftlicher Lernanwendungen für den schulischen Einsatz. Die Simulationen laufen eigenständig im Browser und sollen auch in mebis (ByCS) nutzbar sein.

## Anwendungen – Chemie

| Anwendung | Verzeichnis | Status |
| --- | --- | --- |
| **TitraLab 3 (Claude)** – Säure-Base-Titration | `apps/chemie/titration/` | **Ausgewählt**; lauffähiges SCORM-1.2-Release liegt vor, Quellcode-Import ins Repo ausstehend |
| [Redoxlabor – Fehling- und Tollens-Probe](apps/chemie/redoxlabor/) | `apps/chemie/redoxlabor/` | **prototype** – Redoxlabor 1.0 (Claude Code), lauffähig im Repo; Test auf Schul-iPads und in mebis ausstehend ([Testbericht](apps/chemie/redoxlabor/docs/TESTBERICHT.md)) |
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

Im Repository liegen derzeit Projektstruktur, Dokumentation und Manifeste. **Die lauffähigen Dateien von TitraLab 3 (Claude) fehlen auf GitHub noch.** Das SCORM-Release wurde außerhalb des Repositories entpackt und als importierbares Quellcodearchiv aufbereitet; der Import ist ausstehend. Die Herkunft aus dem SCORM-Release ist beim Import zu kennzeichnen.

## Lizenz

Die Datei `LICENSE` enthält die MIT-Lizenz.
