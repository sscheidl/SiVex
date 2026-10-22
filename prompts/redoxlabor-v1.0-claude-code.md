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
