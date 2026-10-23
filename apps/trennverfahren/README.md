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

Welche Fassung die Basis wird, wird nach dem [Codex-Review](../../prompts/trennlabor-review-codex.md) und dem Praxistest in mebis entschieden. Pfade jeweils unter `apps/trennlabor/`:

| Fassung A (`486f370`, Branch `ccr-ade6cdbf-5npcyu`) | Fassung B (`a5d6d0e`, Branch `trennlabor/v1.0`) |
| --- | --- |
| `js/model/classic.js` | `js/classic.js` |
| `js/tasks/classic-tasks.js` | K-Aufgaben in `js/tasks.js` |
| `js/render/classic-render.js` | `js/render-classic.js` |
| `tests/unit/classic.test.js` | `tests/unit/classic.test.js` |

Noch kein lauffähiger Stand eingecheckt.
