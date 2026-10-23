# SiVex – Architektur

## Experimentorientiertes Monorepo

```text
apps/
  titration/
    titralab3/        # geplanter Import des Claude-V3-Releases
  redoxlabor/
  trennlabor/         # klassische Trennverfahren, Chromatographie, Destillation (Jgst. 8/9)
  trennverfahren/     # geplant – aus dem Trennlabor 1.0.0 (Abschnitt 3A)
  chromatographie/    # geplant – aus dem Trennlabor 1.0.0 (Abschnitt 3B)
  destillation/       # geplant – aus dem Trennlabor 1.0.0 (Abschnitt 3C)
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
- Trennlabor: Implementierung durch Claude Code nach dem Muster des Redoxlabors (DOM-freie Fachmodelle, Canvas-Renderer, Unit-/Browser-/SCORM-Tests).
- Trennlabor 1.0.0 wird anschließend in die drei Einzelanwendungen Trennverfahren, Papierchromatographie und Destillation aufgeteilt; einheitlicher Stil, einheitliche Bedien- und Auswertungslogik über `shared/labkit/`, Inhalte je App unabhängig ([Entscheidung](decisions/2026-10-23-trennlabor-aufteilung.md)).
- Gemeinsamer Code unter `shared/` enthält keine Fachlogik und wird beim Paketieren in jede App kopiert; jedes Web- und SCORM-Paket bleibt eigenständig und offline lauffähig.
- Browseranwendungen laufen nach Möglichkeit statisch ohne externes Backend.
- SCORM-1.2-Pakete werden für mebis erstellt und separat getestet.
- `ready` setzt fachliche und gerätespezifische Freigabe voraus.

## Status

Die Quellcode-Dateien des TitraLab-3-Releases müssen noch auf GitHub importiert werden. Das aktuell eingecheckte Experimentverzeichnis enthält daher nur Dokumentation und Metadaten.
