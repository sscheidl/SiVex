# SiVex – Simulationen und virtuelle Experimente

SiVex ist eine modular aufgebaute Sammlung interaktiver naturwissenschaftlicher Lernanwendungen für den schulischen Einsatz. Jede Simulation läuft eigenständig im Browser und soll sowohl auf Tablets als auch in der ByCS-Lernplattform (mebis) nutzbar sein.

## Anwendungen

| Anwendung | Verzeichnis | Status |
| --- | --- | --- |
| Säure-Base-Titration | `apps/chemie/titration/` | Prototyp; fachliche Freigabe offen |
| Fehling- und Tollens-Probe | `apps/chemie/redoxlabor/` | In Planung |
| Esterbildung und chemisches Gleichgewicht | `apps/chemie/ester-gleichgewicht/` | In Planung |

Die Struktur ist nach Fächern und Experimenten, nicht nach KI-Modellen sortiert. Claude-Code- und Codex-Varianten werden über Branches und Pull Requests verglichen.

## Veröffentlichungswege

1. **Webserver:** Statische Dateien über HTTPS bereitstellen.
2. **mebis:** SCORM-1.2-ZIP pro Simulation bauen und im Kurs als Aktivität „Lernpaket (SCORM)“ starten.

Für Schülerinnen und Schüler sind keine KI-Konten und kein Backend erforderlich. Ein im Repository vorgesehener Paketierungsprozess erzeugt den Webkatalog und die SCORM-Archive. Ein erfolgreicher Export ersetzt keinen Funktionstest im echten mebis-Kurs auf Schul-iPads.

## Qualitätsgrundsätze

- Wissenschaftliche Richtigkeit und didaktische Angemessenheit
- Reaktionen und Animationen sind an die Handlungen der Lernenden gekoppelt
- Touch-Bedienbarkeit, klare Benutzerführung und möglichst barrierearme Gestaltung
- Keine personenbezogenen Schülerdaten an externe Dienste
- PASS/HOLD-Kriterien und dokumentierte Testnachweise je Experiment

Siehe [mebis-Konzept](docs/MEBIS.md), [Architektur](docs/ARCHITECTURE.md) und [Qualitätsregeln](docs/QUALITY.md).

## Stand des Repositories

Das GitHub-Repository ist angelegt. Die vollständigen bereits lokal vorbereiteten Simulationsquellen und Build-Werkzeuge werden separat synchronisiert. Fehlende Dateien in `apps/` oder `tools/` sind derzeit **noch nicht hochgeladen**.

## Lizenz

Eine Lizenz ist noch nicht festgelegt. Ein öffentlich einsehbares Repository bedeutet nicht automatisch, dass eine freie Nachnutzungslizenz eingeräumt ist.
