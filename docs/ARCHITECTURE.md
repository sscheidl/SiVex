# Architektur

## Monorepo nach Experiment

```text
apps/
  chemie/
    titration/
      claude-v3/          # vorgesehener Import des getesteten SCORM-Releases
    redoxlabor/
    ester-gleichgewicht/
  _template/
docs/
prompts/
```

Eine Anwendung liegt in `apps/<fach>/<slug>/`, startet über `index.html` und bringt sämtliche benötigten lokalen Browserressourcen selbst mit. Eine `sivex.json` beschreibt Kennung, Titel, Fach, Jahrgangsstufen und Status (`planned`, `prototype`, `ready`).

## Grundprinzipien

- Experimente unabhängig voneinander entwickeln, testen und deployen.
- Für die Titration ist **Claude V3** verbindlich ausgewählt; die Codex-Titration ist verworfen.
- Redoxlabor wird extern durch Codex / Claude entwickelt und erst nach Review importiert.
- Statisches Deployment ohne serverseitige Anwendungslogik.
- SCORM-1.2-Pakete für mebis mit eigenen Testnachweisen.
- `ready` verlangt fachliche und gerätespezifische Freigabe.

## Status

Der vollständige Claude-V3-Code ist im geprüften `main`-Stand derzeit **nicht** enthalten. Das getrennt bereitgestellte Importarchiv muss noch eingespielt werden.
