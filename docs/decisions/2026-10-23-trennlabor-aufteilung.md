# Entscheidung: Trennlabor in drei Einzelanwendungen aufteilen

**Datum:** 23.10.2026 · **Status:** beschlossen, Umsetzung nach Review · **Betrifft:** Trennlabor 1.0.0 (Fassungen A und B), neue Apps `trennverfahren`, `chromatographie`, `destillation`, gemeinsamer Baukasten `shared/labkit/`

## Ausgangslage

Der Masterauftrag [„SiVex – Virtuelles Trennlabor v1.0“](../../prompts/trennlabor-v1.0-claude-code.md) hat drei Versuchsbereiche in **einer** Anwendung gebündelt: klassische Trennverfahren (K-01 bis K-05), Papierchromatographie und Destillation Ethanol/Wasser.

Daraus sind zwei vollständige, unabhängig entstandene Fassungen hervorgegangen:

| Fassung | Branch | Commit | Herkunft |
| --- | --- | --- | --- |
| A | `ccr-ade6cdbf-5npcyu` (PR #9, geschlossen) | `486f370` | Claude Code, Cloud-Sitzung |
| B | `trennlabor/v1.0` (PR #11, offen) | `a5d6d0e` | Claude Code, Desktop-Sitzung; nach einem Absturz der App wurde der Auftrag neu gestartet |

Ein früherer Codex-Versuch (PR #10) wurde verworfen. Beide Fassungen erfüllen laut eigenem Testbericht alle Pflichtkriterien und werden derzeit unabhängig geprüft ([Prüfauftrag](../../prompts/trennlabor-review-codex.md)) sowie von der Lehrkraft in mebis erprobt.

Der Praxistest zeigt **erhebliche Unterschiede**: Beide Fassungen haben Stärken und Schwächen, und diese verteilen sich **je Versuchsbereich unterschiedlich**. Außerdem sind grundlegende Änderungen an Bedienung, Ablauf und Optik nötig.

## Entscheidung

1. Das Trennlabor wird **nachträglich in drei eigenständige Anwendungen** aufgeteilt:

   | App | Verzeichnis | Inhalt aus dem Masterauftrag |
   | --- | --- | --- |
   | Trennverfahren | `apps/trennverfahren/` | Abschnitt 3A: K-01 Sand/Wasser, K-02 Sand/Kochsalz, K-03 Eisen/Sand/Kochsalz, K-04 Öl/Wasser, K-05 Hibiskustee |
   | Papierchromatographie | `apps/chromatographie/` | Abschnitt 3B: 7 Modellproben, 2 Laufmittel, Expertenmodus mit Rf |
   | Destillation | `apps/destillation/` | Abschnitt 3C: nur Ethanol/Wasser, Temperaturverlauf, Brennprobe |

2. **Einheitlicher Look und einheitliche Bedienlogik** bleiben verbindlich. Was alle drei Apps gleich machen, liegt einmal im gemeinsamen Baukasten [`shared/labkit/`](../../shared/labkit/README.md) und wird beim Paketieren in jede App kopiert.

3. Jede App wird **für sich** analysiert, weiterentwickelt, getestet und veröffentlicht. Für jeden Bereich wird nach Review und Praxistest entschieden, ob Fassung A oder B die Basis wird und was aus der anderen übernommen wird.

## Begründung

### 1. Die drei Bereiche teilen keine Fachlogik

In beiden Fassungen sind die drei Fachmodelle vollständig voneinander getrennt; kein Modell greift auf ein anderes zu (A: `js/model/classic.js`, `chroma.js`, `distill.js`; B: `js/classic.js`, `chroma.js`, `distill.js`). Gemeinsam sind nur Hülle, Bedienung, Zeitsteuerung, Hilfe- und Auswertungsablauf, Lückentextprüfung und SCORM-Anbindung. Die Bündelung in einer App bringt fachlich nichts, koppelt aber Tests, Releases und Fehler aneinander.

### 2. So ist SiVex ohnehin gedacht

[`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) legt fest: *„Eine Anwendung pro Experiment; unabhängig entwickelbar, testbar und verteilbar.“* Das gebündelte Trennlabor ist davon abgewichen. Die Aufteilung stellt den Grundsatz wieder her.

### 3. Unterricht: ein Thema, eine Aktivität

Die Bereiche gehören zu unterschiedlichen Unterrichtsphasen. Eine Lehrkraft setzt in einer Stunde meist nur einen davon ein. Mit drei Apps

- wird in mebis genau die passende Aktivität angelegt, ohne Laborauswahl und ohne Ablenkung durch die anderen Bereiche,
- startet die App direkt im Versuch, und der Einstieg ist für Jahrgangsstufe 8/9 einfacher,
- sind die Pakete kleiner und laden auf Schul-iPads schneller.

### 4. Bessere Qualität durch kleinere Prüfeinheiten

- Review und PASS/HOLD-Abnahme je App sind überschaubar; ein HOLD in der Destillation blockiert die Chromatographie nicht.
- Eine Änderung an einem Bereich erzwingt keinen erneuten Praxistest der anderen.
- Jede App hat eine eigene Versionsnummer und eigene Release-ZIPs; Korrekturen lassen sich gezielt veröffentlichen.

### 5. Das Beste aus beiden Fassungen

Weil Stärken und Schwächen je Bereich verschieden verteilt sind, kann je App eine andere Fassung die Basis sein (zum Beispiel Chromatographie aus der einen, Destillation aus der anderen). In einer gemeinsamen App wäre das nur mit großem Integrationsaufwand möglich.

### 6. Weniger Konflikte bei paralleler Arbeit

Die doppelte Umsetzung ist entstanden, weil ein großer Auftrag nach einem App-Absturz erneut anlief. Kleinere, getrennte Aufträge je App mit eigenem Branch und PR verringern dieses Risiko und machen Doppelarbeit früh sichtbar.

## Warum ein gemeinsamer Baukasten

Ohne gemeinsame Basis würden die drei Apps schnell auseinanderlaufen: andere Farben, andere Knöpfe, andere Hilfelogik. Für Schülerinnen und Schüler sollen sie sich wie **ein** Labor anfühlen. Deshalb gehört alles, was nicht fachspezifisch ist, in `shared/labkit/` (Umfang und Regeln siehe dortige README). Fachmodelle, Aufgaben, Texte und Gerätegrafiken bleiben in der jeweiligen App.

## Verworfene Alternativen

| Alternative | Warum nicht |
| --- | --- |
| Eine App mit drei Laboren beibehalten | Gekoppelte Releases und Tests, keine Mischung der Fassungen je Bereich, widerspricht dem Architekturgrundsatz |
| Drei völlig unabhängige Apps ohne gemeinsamen Code | Look und Bedienlogik laufen auseinander; Korrekturen (z. B. an der Lückentextprüfung oder am SCORM-Adapter) müssten dreifach gemacht werden |
| Gemeinsame Bibliothek zur Laufzeit von einer zentralen Adresse laden | Verstößt gegen Offline-Betrieb und eigenständige SCORM-Pakete (`docs/MEBIS.md`) |

## Folgen

- **Drei mebis-Aktivitäten** statt einer. Querverweise zwischen den Apps sind innerhalb eines SCORM-Pakets nicht möglich; die Übersicht leistet das Repo-README bzw. der Kurs.
- **Der Baukasten muss gepflegt werden.** Er bekommt eine eigene Versionsnummer; jede App vermerkt im Testbericht, mit welcher Baukasten-Version sie gebaut wurde. Änderungen am Baukasten werden in allen drei Apps getestet.
- **Trennlabor 1.0.0** wird nicht auf `main` übernommen. Die Fassungen A und B bleiben auf ihren Branches als Quelle und Referenz erhalten und werden nicht gelöscht. Andere SiVex-Anwendungen und deren Releases sind nicht betroffen.
- Die neuen Apps beginnen mit Status `planned` und erhalten ihre erste Version erst nach Abnahme.

## Vorgehen

| Phase | Inhalt | Ergebnis |
| --- | --- | --- |
| 0 – Vorbereitung | diese Entscheidung, App-Gerüste, Umfang des Baukastens | Branch `trennlabor/aufteilung` |
| 1 – Bewertung | Codex-Review beider Fassungen, eigene Eindrücke der Lehrkraft aus dem mebis-Test | je Bereich: Basis A oder B, Übernahmeliste, Liste der grundlegenden Änderungen |
| 2 – Gestaltungs- und Bedienregeln | einheitliche Regeln für Look, Bedienung und Ablauf festlegen, **bevor** Code verschoben wird | `shared/labkit/DESIGN.md` |
| 3 – Baukasten | gemeinsame Bausteine aus A/B zusammenführen, mit eigenen Tests | `shared/labkit/` |
| 4 – Apps | je App eigener Auftrag, Branch und PR; Basis-Fassung übernehmen, Übernahmeliste und Änderungen umsetzen | drei Apps mit Tests, Testbericht, Web- und SCORM-ZIP |
| 5 – Praxistest | iPad/Safari, mebis, Unterricht je App | Status `prototype` → `ready` |

Die Reihenfolge der Apps in Phase 4 legt die Lehrkraft nach dem Review fest.

## Offene Punkte

- Endgültige Namen und Kennungen der Apps (Vorschlag: `chemie/trennverfahren`, `chemie/chromatographie`, `chemie/destillation`)
- Ob die Masterauftrags-Kriterien A-01 bis T-08 je App aufgeteilt oder für die Neufassung überarbeitet werden
- Ob Redoxlabor und Titration später ebenfalls auf den Baukasten umgestellt werden (nicht Teil dieser Entscheidung; dort keine Änderungen)
