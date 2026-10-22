# SiVex – Architektur

## Fach- und experimentorientiertes Monorepo

```text
apps/
  chemie/
    titration/
      titralab3/        # geplanter Import des Claude-V3-Releases
    redoxlabor/
    ester-gleichgewicht/
  _template/
docs/
prompts/
```

Verzeichnisse werden **nach Fach und Experiment**, nicht nach Jahrgangsstufe angelegt. Unterrichtsthemen und Jahrgangsstufen werden je Anwendung über `sivex.json` erfasst.

## Leitlinien

- Eine Anwendung pro Experiment; unabhängig entwickelbar, testbar und verteilbar.
- **TitraLab 3 von Claude** ist die einzige gewählte Titrationsversion. TitraLab 2 wird nicht verwendet.
- Redoxlabor: Implementierung durch Codex / Claude, anschließend Review und Import.
- Browseranwendungen laufen nach Möglichkeit statisch ohne externes Backend.
- SCORM-1.2-Pakete werden für mebis erstellt und separat getestet.
- `ready` setzt fachliche und gerätespezifische Freigabe voraus.

## Status

Die Quellcode-Dateien des TitraLab-3-Releases müssen noch auf GitHub importiert werden. Das aktuell eingecheckte Experimentverzeichnis enthält daher nur Dokumentation und Metadaten.
