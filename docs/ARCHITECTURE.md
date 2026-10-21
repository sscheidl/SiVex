# Architektur

## Monorepo nach Experiment

```text
apps/
  chemie/
    titration/
    redoxlabor/
    ester-gleichgewicht/
  _template/
docs/
prompts/
tools/
.github/workflows/
```

Eine Anwendung liegt in `apps/<fach>/<slug>/`, startet über `index.html` und bringt sämtliche benötigten lokalen Browserressourcen selbst mit. Eine `sivex.json` beschreibt Kennung, Titel, Fach, Jahrgangsstufen und Status (`planned`, `prototype`, `ready`).

## Grundprinzipien

- Experimente unabhängig voneinander entwickeln, testen und deployen.
- Keine feste Ordnertrennung nach Claude/Codex: Varianten und Reviews über Git.
- Statisches Deployment ohne serverseitige Anwendungslogik.
- Gemeinsame Buildtools erzeugen Webkatalog und SCORM-Pakete.
- `dist/` enthält generierte Ausgaben, die nicht eingecheckt werden.
- `ready` verlangt fachliche und gerätespezifische Freigabe.

## Status

Die vollständige lokal vorbereitete Implementierung samt Exportwerkzeugen ist noch nicht in das neue GitHub-Repository synchronisiert.
