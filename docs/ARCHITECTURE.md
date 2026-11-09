# SiVex – Architektur

## Experimentorientiertes Monorepo

```text
apps/
  titration/          # TitraLab 3.2.1 (ready) – Säure-Base-Titration; Quellcode seit 3.1.0 entpackt, Referenz für Glas und Flüssigkeiten
  redoxlabor/
  trennverfahren/     # Trennverfahren 0.4.0 (prototype) auf Basis des Labkits
  chromatographie/    # Papierchromatographie 0.3.0 (prototype) auf Basis des Labkits
  destillation/       # Destillation 0.4.0 (prototype) auf Basis des Labkits
  halbtitration/      # Halbtitrationslabor 0.4.1 (prototype), Labkit-Hülle, Laboraufbau aus TitraLab 3
  pufferfish/         # Pufferfish 0.3.0 (prototype) – Puffer untersuchen, herleiten, berechnen und herstellen; Henderson-Hasselbalch
  aggregatzustaende/  # Aggregatzustände 0.3.0 (prototype) – Stoff- und Teilchenebene, eine Teilchen-Engine für vier Stoffe
  stechheber/         # Stechheber 0.1.0 (prototype) – Gleichgewichts-Reihe 1/3, Stoffebene (Modell)
  apfelkrieg/         # Apfelkrieg 0.1.0 (prototype) – Gleichgewichts-Reihe 2/3, Teilchenebene (Modell, Zufall)
  ester-gleichgewicht/ # Estergleichgewicht 0.1.0 (prototype) – Gleichgewichts-Reihe 3/3, beide Ebenen, K = 4
  _template/
shared/
  labkit/             # gemeinsamer Baukasten: Look, Bedienlogik, Diagramm (chart.js) und Lernweg-Mechanik (learn.js)
docs/
  decisions/          # begründete Architekturentscheidungen
prompts/
```

Verzeichnisse werden **nach Experiment**, nicht nach Fach oder Jahrgangsstufe angelegt. Fach, Unterrichtsthemen und Jahrgangsstufen werden je Anwendung über `sivex.json` erfasst.

## Leitlinien

- Eine Anwendung pro Experiment; unabhängig entwickelbar, testbar und verteilbar.
- **TitraLab 3 von Claude** ist die einzige gewählte Titrationsversion. TitraLab 2 wird nicht verwendet.
- Redoxlabor: Implementierung durch Codex / Claude, anschließend Review und Import.
- Das gebündelte Trennlabor 1.0.0 ist in Einzelanwendungen aufgegangen (Papierchromatographie, Destillation, Trennverfahren) und wird nicht weiterentwickelt; einheitlicher Look und einheitliche Bedienlogik über `shared/labkit/` ([Entscheidung](decisions/2026-10-23-trennlabor-aufteilung.md)). Es wurde am 25.10.2026 von `main` entfernt; der letzte Stand ist über die Tags `archiv/trennlabor-1.0.0` (Fassung B) und `archiv/trennlabor-ccr` (Fassung A) erreichbar.
- Die drei Gleichgewichts-Apps folgen gemeinsamen Kriterien und je drei Entwicklungsschritten ([Planung](GLEICHGEWICHT-PLANUNG.md)); ihr gemeinsames Gerüst (Diagramm, Balkenpaar, Lernweg-Mechanik) liegt ab Labkit 0.3.0 in `shared/labkit/`.
- Auf `main` liegt je Anwendung nur das aktuelle Release; frühere Pakete stehen in der Git-Historie.
- Gemeinsamer Code unter `shared/` enthält keine Fachlogik und wird beim Paketieren in jede App kopiert; jedes Web- und SCORM-Paket bleibt eigenständig und offline lauffähig.
- Browseranwendungen laufen nach Möglichkeit statisch ohne externes Backend.
- SCORM-1.2-Pakete werden für mebis erstellt und separat getestet.
- `ready` setzt fachliche und gerätespezifische Freigabe voraus.

## Status

Der Quellcode von TitraLab 3 liegt seit Version 3.1.0 (09.11.2026) entpackt unter `apps/titration/` – mit Build, Paketierung und Tests wie bei den übrigen Apps. Das Release 3.0 („Claude V3“, nur als ZIP) ist über die Git-Historie erreichbar. TitraLab nutzt das Labkit nicht; es bietet seit 3.1.0 zusätzlich zum dunklen ein helles Farbschema in den Labkit-Farben.
