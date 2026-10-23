# Destillation Ethanol/Wasser

**Status: planned** · Jahrgangsstufe 8/9 (NTG 8 / SG 9)

Eine der drei Einzelanwendungen, die aus dem Trennlabor 1.0.0 hervorgehen. Begründung und Vorgehen: [Entscheidung zur Aufteilung des Trennlabors](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md). Look und Bedienlogik kommen aus dem gemeinsamen Baukasten [`shared/labkit/`](../../shared/labkit/README.md).

## Umfang

Grundlage ist Abschnitt 3C des [Masterauftrags](../../prompts/trennlabor-v1.0-claude-code.md):

- Nur Ethanol/Wasser mit festgelegter Ausgangszusammensetzung
- Eigener Aufbau: Kolben, Siedesteine, Heizquelle, Thermometer im Dampfweg, Liebigkühler (Wasser unten hinein, oben heraus), Vorlage
- Große Temperaturanzeige und Temperaturverlauf; kein Sprung von 78 °C auf 100 °C
- Getrennte Brennprobe; Sicherheitsstopps (geschlossene Apparatur, Zünden an der Apparatur)

## Ausgangsmaterial

Übernommen wird **bausteinweise**, was korrekt ist, gefällt und funktioniert; Fehlendes wird geändert oder ergänzt (siehe [Entscheidung](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md), Punkt 4). Grundlage sind das [Codex-Review](../../prompts/trennlabor-review-codex.md) und die [Eindrücke der Lehrkraft](../../docs/reviews/trennlabor-eindruecke-lehrkraft.md). Pfade jeweils unter `apps/trennlabor/`:

| Fassung A (`486f370`, Tag `archiv/trennlabor-ccr`) | Fassung B (`a5d6d0e`, auf `main`) |
| --- | --- |
| `js/model/distill.js` | `js/distill.js` |
| `js/tasks/distill-tasks.js` | D-Aufgabe in `js/tasks.js` |
| `js/render/distill-render.js` | `js/render-distill.js` |
| `tests/unit/distill.test.js` | `tests/unit/distill.test.js` |

Der Codex-Versuch (PR #10, `dde56a0`) ist nicht nach Bereichen getrennt: Fachlogik in `js/chemistry.js` und `js/lab.js`, Darstellung als SVG in `js/render.js`. Wie man A und den Codex-Versuch holt, steht in der Entscheidung unter „Ausgangslage“.

Bereits bekannte Unterschiede, die im Review bewertet werden:

- Ausgangsgemisch: A 40 % Ethanol, B 30 % Ethanol
- Heizquelle: A Heizpilz mit Stufen, B Heizplatte AUS/NIEDRIG/HOCH
- Zu schwache Kühlung: in B Warnung, Versuch läuft weiter (Wirkung auf die Destillatmenge wird im Review geprüft)

Noch kein lauffähiger Stand eingecheckt.
