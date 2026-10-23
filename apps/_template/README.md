# SiVex-Anwendungsvorlage

Neue Experimente unter `apps/<slug>/` anlegen.

Pflichtdateien für lauffähige Module:

- `index.html` – Browser-Einstieg
- `sivex.json` – Metadaten mit `id`, `title`, `description`, `subject`, `grades`, `status`
- README und dokumentierte fachliche Tests

Verbindliche Gestaltungsmerkmale (Flüssigkeiten und Glasgefäße wie im TitraLab 3, verschiebbare Trennlinie zwischen Labor und Bedienfeld): siehe [`docs/QUALITY.md`](../../docs/QUALITY.md).

Verbindliche Lern- und Auswertungsstruktur (Protokoll, Ergebnisübersicht, Trainer nach dem Redoxlabor; Selbstkontrolle mit Hilfe und Lösung auf Anforderung; Zusammenfassung fürs Heft am Schluss): ebenfalls [`docs/QUALITY.md`](../../docs/QUALITY.md).

Status `planned` → `prototype` → `ready`. `ready` erst nach fachlicher Prüfung, Tablet-Test und mebis-End-to-End-Test.

Keine serverseitige Laufzeitabhängigkeit und keine externe Schülerdatenverarbeitung.
