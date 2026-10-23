# Papierchromatographie

**Status: planned** · Jahrgangsstufe 8/9 (NTG 8 / SG 9)

Eine der drei Einzelanwendungen, die aus dem Trennlabor 1.0.0 hervorgehen. Begründung und Vorgehen: [Entscheidung zur Aufteilung des Trennlabors](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md). Look und Bedienlogik kommen aus dem gemeinsamen Baukasten [`shared/labkit/`](../../shared/labkit/README.md).

## Umfang

Grundlage ist Abschnitt 3B des [Masterauftrags](../../prompts/trennlabor-v1.0-claude-code.md):

- Sieben Modellproben (u. a. schwarzer, grüner, violetter, oranger Filzstift, zwei Referenzfarbstoffe, wasserfester Stift)
- Zwei Laufmittel: Wasser und eine genau bezeichnete Ethanol-Wasser-Mischung
- Aufgaben: mehrere Farbstoffe, gemeinsamer Farbstoff Grün/Violett, wasserfester Stift
- Expertenmodus mit Laufstrecken und Rf-Werten

## Ausgangsmaterial

Welche Fassung die Basis wird, wird nach dem [Codex-Review](../../prompts/trennlabor-review-codex.md) und dem Praxistest in mebis entschieden. Pfade jeweils unter `apps/trennlabor/`:

| Fassung A (`486f370`, Branch `ccr-ade6cdbf-5npcyu`) | Fassung B (`a5d6d0e`, Branch `trennlabor/v1.0`) |
| --- | --- |
| `js/model/chroma.js` | `js/chroma.js` |
| `js/tasks/chroma-tasks.js` | C-Aufgaben in `js/tasks.js` |
| `js/render/chroma-render.js` | `js/render-chroma.js` |
| `tests/unit/chroma.test.js` | `tests/unit/chroma.test.js` |

Bereits bekannte Unterschiede, die im Review bewertet werden:

- Laufmittel Ethanol-Wasser: A 7 : 3, B 1 : 1

Noch kein lauffähiger Stand eingecheckt.
