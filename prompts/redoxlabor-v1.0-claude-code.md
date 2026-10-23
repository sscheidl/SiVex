# Benchmark: Redoxlabor 1.0 (One-Shot) – Claude Code

| Feld | Wert |
| --- | --- |
| Auftrag | „Entwicklungsauftrag: Virtuelles Redoxlabor – Fehling- und Tollens-Probe“, Version 1.0, One-Shot-Benchmark (Text liegt beim Auftraggeber) |
| Agent | Claude Code (Cloud-Sitzung) |
| Datum | 22.10.2026 |
| Branch | `claude/redoxlabor-v1` |
| Ergebnis | `apps/redoxlabor/` – Status `prototype` |
| Technik | statisches HTML/CSS/JavaScript, Canvas 2D, keine Laufzeitabhängigkeiten |

## PASS/HOLD

| Prüfbereich | Ergebnis |
| --- | --- |
| Chemische Korrektheit | PASS |
| Experimentelle Interaktivität | PASS |
| Grafische Qualität | PASS |
| Didaktische Funktionen | HOLD – nicht verifiziert (D-08: kein Test mit Lernenden) |
| Technische Qualität | HOLD – nicht verifiziert (kein echtes iPad/WebKit) |
| Gesamtprojekt | HOLD – nicht verifiziert |

Nachweise: 45 Unit-Tests, 26 Browser-Prüfungen (Chromium) mit Pixelmessungen und Screenshots. Einzelheiten im [Testbericht](../apps/redoxlabor/docs/TESTBERICHT.md).

**Nachtrag 23.10.2026:** Der iPad-Gerätetest (Safari, iPadOS 26.6.2) wurde von der Lehrkraft bestanden, zuletzt mit Version 1.3.1. Damit ist „Technische Qualität“ PASS; offen bleibt nur D-08 (Test mit Lernenden). Aktueller Stand: [Testbericht, Nachtrag 6](../apps/redoxlabor/docs/TESTBERICHT.md).
