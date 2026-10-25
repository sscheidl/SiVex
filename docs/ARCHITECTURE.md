# SiVex – Architektur

## Experimentorientiertes Monorepo

```text
apps/
  titration/
    titralab3/        # geplanter Import des Claude-V3-Releases
  redoxlabor/
  trennverfahren/     # geplant – aus dem Trennlabor 1.0.0 (Abschnitt 3A)
  chromatographie/    # Papierchromatographie 0.2.0 (prototype) auf Basis des Labkits
  destillation/       # Destillation 0.2.0 (prototype) auf Basis des Labkits
  ester-gleichgewicht/
  _template/
shared/
  labkit/             # gemeinsamer Baukasten: Look und Bedienlogik der Trenn-Apps
docs/
  decisions/          # begründete Architekturentscheidungen
prompts/
```

Verzeichnisse werden **nach Experiment**, nicht nach Fach oder Jahrgangsstufe angelegt. Fach, Unterrichtsthemen und Jahrgangsstufen werden je Anwendung über `sivex.json` erfasst.

## Leitlinien

- Eine Anwendung pro Experiment; unabhängig entwickelbar, testbar und verteilbar.
- **TitraLab 3 von Claude** ist die einzige gewählte Titrationsversion. TitraLab 2 wird nicht verwendet.
- Redoxlabor: Implementierung durch Codex / Claude, anschließend Review und Import.
- Das gebündelte Trennlabor 1.0.0 ist in Einzelanwendungen aufgegangen (Papierchromatographie, Destillation; Trennverfahren geplant) und wird nicht weiterentwickelt; einheitlicher Look und einheitliche Bedienlogik über `shared/labkit/` ([Entscheidung](decisions/2026-10-23-trennlabor-aufteilung.md)). Es wurde am 25.10.2026 von `main` entfernt; der letzte Stand ist über die Tags `archiv/trennlabor-1.0.0` (Fassung B) und `archiv/trennlabor-ccr` (Fassung A) erreichbar.
- Auf `main` liegt je Anwendung nur das aktuelle Release; frühere Pakete stehen in der Git-Historie.
- Gemeinsamer Code unter `shared/` enthält keine Fachlogik und wird beim Paketieren in jede App kopiert; jedes Web- und SCORM-Paket bleibt eigenständig und offline lauffähig.
- Browseranwendungen laufen nach Möglichkeit statisch ohne externes Backend.
- SCORM-1.2-Pakete werden für mebis erstellt und separat getestet.
- `ready` setzt fachliche und gerätespezifische Freigabe voraus.

## Status

Die Quellcode-Dateien des TitraLab-3-Releases müssen noch auf GitHub importiert werden. Das aktuell eingecheckte Experimentverzeichnis enthält daher nur Dokumentation und Metadaten.
