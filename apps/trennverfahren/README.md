# Trennverfahren – Stoffgemische trennen

**Status: planned** · Jahrgangsstufe 8/9 (NTG 8 / SG 9)

Eine der drei Einzelanwendungen, die aus dem Trennlabor 1.0.0 hervorgehen. Begründung und Vorgehen: [Entscheidung zur Aufteilung des Trennlabors](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md). Look und Bedienlogik kommen aus dem gemeinsamen Baukasten [`shared/labkit/`](../../shared/labkit/README.md).

## Umfang

Grundlage ist Abschnitt 3A des [Masterauftrags](../../prompts/trennlabor-v1.0-claude-code.md):

- K-01 Sand/Wasser: Sedimentieren, Dekantieren, Filtrieren
- K-02 Sand/Kochsalz: Lösen, Filtrieren, Eindampfen – Sand **und** festes Salz zurückgewinnen
- K-03 Eisen/Sand/Kochsalz: Magnettrennung, dann wie K-02
- K-04 Öl/Wasser: Scheidetrichter mit Stopfen und Hahn, Absetzen, Ablassen
- K-05 Hibiskustee: Extraktion kalt/heiß; Tee bleibt ein Stoffgemisch

## Ausgangsmaterial

Übernommen wird **bausteinweise**, was korrekt ist, gefällt und funktioniert; Fehlendes wird geändert oder ergänzt (siehe [Entscheidung](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md), Punkt 4). Grundlage sind das [Codex-Review](../../prompts/trennlabor-review-codex.md) und die [Eindrücke der Lehrkraft](../../docs/reviews/trennlabor-eindruecke-lehrkraft.md). Pfade jeweils unter `apps/trennlabor/`:

| Fassung A (`486f370`, Tag `archiv/trennlabor-ccr`) | Fassung B (`a5d6d0e`, auf `main`) |
| --- | --- |
| `js/model/classic.js` | `js/classic.js` |
| `js/tasks/classic-tasks.js` | K-Aufgaben in `js/tasks.js` |
| `js/render/classic-render.js` | `js/render-classic.js` |
| `tests/unit/classic.test.js` | `tests/unit/classic.test.js` |

Der Codex-Versuch (PR #10, `dde56a0`) ist nicht nach Bereichen getrennt: Fachlogik in `js/chemistry.js` und `js/lab.js`, Darstellung als SVG in `js/render.js`. Wie man A und den Codex-Versuch holt, steht in der Entscheidung unter „Ausgangslage“.

Noch kein lauffähiger Stand eingecheckt.
