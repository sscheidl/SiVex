# SiVex – Simulationen und virtuelle Experimente

SiVex ist eine modular aufgebaute Sammlung interaktiver naturwissenschaftlicher Lernanwendungen für den schulischen Einsatz. Jede Simulation läuft eigenständig im Browser und soll sowohl auf Tablets als auch in der ByCS-Lernplattform (mebis) nutzbar sein.

## Anwendungen

| Anwendung | Verzeichnis | Status |
| --- | --- | --- |
| Säure-Base-Titration | `apps/chemie/titration/` | **Claude V3 ausgewählt**; getestetes SCORM-1.2-Release vorhanden, Quellcode-Import nach GitHub ausstehend |
| Fehling- und Tollens-Probe | `apps/chemie/redoxlabor/` | In Entwicklung durch Codex / Claude; noch kein Code eingecheckt |
| Esterbildung und chemisches Gleichgewicht | `apps/chemie/ester-gleichgewicht/` | In Planung |

**Auswahlentscheidung:** Claude V3 ist die maßgebliche Titrationsversion. Die frühere Codex-Variante TitraLab 2 wird nicht weitergeführt und gehört nicht zum Zielstand dieses Repositories.

## Veröffentlichungswege

1. **Webserver:** Statische Dateien über HTTPS bereitstellen.
2. **mebis:** SCORM-1.2-ZIP pro Simulation bauen und im Kurs als Aktivität „Lernpaket (SCORM)“ starten.

Für Schülerinnen und Schüler sind keine KI-Konten und kein Backend erforderlich. Die endgültige Integration auf Schul-iPads muss separat getestet werden.

## Qualitätsgrundsätze

- Wissenschaftliche Richtigkeit und didaktische Angemessenheit
- Reaktionen und Animationen sind an die Handlungen der Lernenden gekoppelt
- Touch-Bedienbarkeit, klare Benutzerführung und möglichst barrierearme Gestaltung
- Keine personenbezogenen Schülerdaten an externe Dienste
- PASS/HOLD-Kriterien und dokumentierte Testnachweise je Experiment

Siehe [mebis-Konzept](docs/MEBIS.md), [Architektur](docs/ARCHITECTURE.md) und [Qualitätsregeln](docs/QUALITY.md).

## Stand des Repositories

Die GitHub-Projektstruktur und Dokumentation sind vorhanden. **Der lauffähige Claude-V3-Quellcode wurde bislang noch nicht eingecheckt.** Das vorhandene SCORM-1.2-Release enthält 14 lesbare Laufzeitdateien (HTML, CSS, JavaScript und Manifest); daraus wurde ein separat vorbereitetes Quellcodearchiv mit README erstellt. Dieser Rekonstruktionsstand ist noch in das Repository zu übertragen.

Das Redoxlabor wird unabhängig durch Codex und Claude entwickelt; hier liegen vorerst nur Anforderungen und Metadaten.

## Lizenz

Die Datei `LICENSE` enthält die MIT-Lizenz.
