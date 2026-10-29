# Zusammenführung der lokalen und veröffentlichten SiVex-Stände

29.10.2026 · Arbeitsverzeichnis: `Playground/SiVex` · Ausgangspunkt: `main` bei `3a26038`.

## Übernommene Neuerungen

- Halbtitrationslabor **0.2.2**, Commit `3fb60af` (PR #46).
- Aggregatzustände **0.2.1**, Commit `3ac4d79` (PR #47). Die Konflikte in `README.md` und `docs/ARCHITECTURE.md` wurden aufgelöst; Pufferfish bleibt auf 0.2.2.
- Trennverfahren **0.2.0**, bisher nur im lokalen Claude-Worktree vorhanden. Quellcode, Dokumentation, Tests, Screenshots und Web-/SCORM-Pakete wurden mit `3052165` versioniert und übernommen. Temporäre Dateien unter `.work/` gehören nicht zur Lieferung.
- Beide historischen mebis-Sammelpakete aus `mebis-testpakete-2026-10-29`; ihre enthaltenen älteren App-Versionen sind im [Ordnerhinweis](../../mebis-testpakete/README.md) ausdrücklich dokumentiert. Aktuelle Downloads stehen in der Projektübersicht.
- Die bislang nur in der älteren Kopie `ChatGPT/SiVex` vorhandenen Halbtitrations-/Pufferfish-Entwicklungsaufträge und das [Halbtitrations-Review zum damaligen Stand `9bd514b`](halbtitration-2026-10-29/REVIEW.md). Bereits vorhandene Planungsdokumente mit identischem Text wurden beibehalten.

Die Projektübersicht, Architekturübersicht und der Auftragsindex nennen die aktuellen Versionen. Pufferfish 0.2.2 war bereits auf `main`.

## Erneute Integrationsprüfung

| Anwendung | Unit-Tests | Browser | Ausgelieferte Pakete |
| --- | --- | --- | --- |
| Halbtitrationslabor 0.2.2 | 33/33 PASS | E1–E9: 9/9 PASS | 4/4 PASS |
| Aggregatzustände 0.2.1 | 36/36 PASS | 16/16 PASS, einschließlich Netzwerkprüfung | 17/17 PASS |
| Trennverfahren 0.2.0 | 46/46 PASS, einschließlich Labkit | E1, E2 und E3 PASS: vollständiger Pflichtablauf mit fünf Versuchen, Touch und Tastatur | 16/16 PASS |

Der erneute Trennverfahren-Quellcode-Testlauf wurde nach den bestandenen E1–E3 gezielt beendet. Die komplette frühere Abnahme mit 15 Szenarien bleibt im [App-Testbericht](../../apps/trennverfahren/docs/TESTBERICHT.md) dokumentiert; sie wurde bei dieser Zusammenführung nicht vollständig wiederholt. Die ausgelieferten Web-/SCORM-Pakete wurden separat geprüft: eingebettet Versuch 1, im SCORM-Fenster und im offline geöffneten Web-ZIP jeweils alle fünf Versuche mit Kontrolle und Hefteintrag. Alle 16 Paketprüfungen bestanden.

Die drei integrierten Apps wurden jeweils mit `npm run package` neu gebaut. Der Vergleich mit den übernommenen Web-ZIPs ergab ausschließlich Unterschiede der Zeilenenden (LF/CRLF), keine Änderungen des Laufzeitinhalts. Die Prüfsummen der neu gebauten Archive stehen unter `apps/<anwendung>/release/SHA256SUMS.txt`; die expliziten Trennverfahren-Prüfsummen im App-Testbericht wurden angepasst.

Zusätzlich geprüft: **16 Release-Prüfsummen ohne Fehler**, alle direkten Download-Ziele der Projektübersicht vorhanden, sämtliche vor der Zusammenführung vorhandenen lokalen und Remote-Branches in der lokalen `main`-Historie enthalten.

Eine neue Prüfung auf einem echten iPad oder in mebis fand nicht statt; die bisherigen Freigabestatus der Apps bleiben bestehen.
