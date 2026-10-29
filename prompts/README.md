# Entwicklungsaufträge und Benchmarks

Versionierte Entwicklungs-Prompts für KI-gestützte Implementierung und Reviews ablegen. Zu jedem Benchmark Modell, Auftrag, Ergebnis, Einschränkungen und PASS/HOLD-Nachweise dokumentieren.

Varianten unterschiedlicher Coding-Agenten über Git-Branches oder Pull Requests bearbeiten, nicht als dauerhafte parallele Produktionsanwendungen.

## Build-Aufträge

- [Claude Code: klassisches Trennlabor](trennlabor-klassik-build-claude.md) – fünf aufeinander aufbauende Versuche, helle SiVex-Gestaltung, interaktive Flüssigkeitsanimation, zuschaltbares Teilchenmodell, Lernkontrolle und Hefteintrag. Grundlage: [Trennlabor-Planung](../docs/TRENNLABOR-PLANUNG.md). Umgesetzt als [`apps/trennverfahren/`](../apps/trennverfahren/) 0.2.0 (prototype) statt im Auftrag genannten Pfad `apps/trennlabor/`, weil die Aufteilungsentscheidung vom 23.10.2026 diesen Block der App Trennverfahren zuordnet.
- [Claude Code: Halbtitrationslabor – ursprünglicher Build-Auftrag](halbtitrationslabor-build-claude.md) – vier Stoffsysteme, TitraLab-3-Apparatur, Messkurve und eigene Schülerrechnungen. Aktueller Stand: [`apps/halbtitration/`](../apps/halbtitration/) 0.2.2 (prototype).
- [Claude Code: Halbtitrationslabor überarbeiten](halbtitrationslabor-ueberarbeitung-claude.md) – historischer Überarbeitungsauftrag auf Grundlage des [Reviews zu `9bd514b`](../docs/reviews/halbtitration-2026-10-29/REVIEW.md). Der aktuelle Stand enthält den überarbeiteten Lernweg und die nachfolgenden Bedienkorrekturen; das Review dokumentiert den damaligen Stand.
- [Claude Code: Pufferfish](pufferfish-build-claude.md) – Puffer untersuchen, herleiten, berechnen und herstellen. Umgesetzt als [`apps/pufferfish/`](../apps/pufferfish/) 0.2.2 (prototype).
