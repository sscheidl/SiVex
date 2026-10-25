# Entscheidung: Trennlabor in drei Einzelanwendungen aufteilen

**Datum:** 23.10.2026 · **Aktualisiert:** 25.10.2026 (Vorgehen bausteinweise; Papierchromatographie und Destillation veröffentlicht, Trennlabor von `main` entfernt) · **Status:** beschlossen, in Umsetzung · **Betrifft:** Trennlabor 1.0.0 (Fassungen A und B, Codex-Versuch), neue Apps `trennverfahren`, `chromatographie`, `destillation`, gemeinsamer Baukasten `shared/labkit/`

## Ausgangslage

Der Masterauftrag [„SiVex – Virtuelles Trennlabor v1.0“](../../prompts/trennlabor-v1.0-claude-code.md) hat drei Versuchsbereiche in **einer** Anwendung gebündelt: klassische Trennverfahren (K-01 bis K-05), Papierchromatographie und Destillation Ethanol/Wasser.

Daraus sind zwei vollständige, unabhängig entstandene Fassungen hervorgegangen, dazu ein früherer Versuch mit Codex:

| Fassung | Commit | Fundort | Herkunft |
| --- | --- | --- | --- |
| A | `486f370` | Tag `archiv/trennlabor-ccr` (`3e395fd`, ergänzt nur zwei Prompts) und geschlossener PR #9 | Claude Code, Cloud-Sitzung |
| B | `a5d6d0e` | Tag `archiv/trennlabor-1.0.0`; bis 25.10.2026 auf `main` unter `apps/trennlabor/` (PR #11) | Claude Code, Desktop-Sitzung; nach einem Absturz der App wurde der Auftrag neu gestartet |
| Codex | `dde56a0` | geschlossener PR #10 | Codex; SVG statt Canvas, Fachlogik aller drei Bereiche gemeinsam in `js/chemistry.js` und `js/lab.js` |

Die Branches `ccr-ade6cdbf-5npcyu`, `trennlabor/v1.0` und `feat/trennlabor` gibt es nicht mehr. Alle drei Fassungen lassen sich jederzeit holen:

```bash
git fetch origin refs/tags/archiv/trennlabor-ccr:refs/tags/archiv/trennlabor-ccr refs/tags/archiv/trennlabor-1.0.0:refs/tags/archiv/trennlabor-1.0.0 refs/pull/10/head:refs/remotes/pr/10
```

Danach zum Beispiel `git show archiv/trennlabor-ccr:apps/trennlabor/js/model/chroma.js`, `git show archiv/trennlabor-1.0.0:apps/trennlabor/js/chroma.js` oder `git show pr/10:apps/trennlabor/js/chemistry.js`.

Der Codex-Versuch wurde als Ganzes verworfen. Die Fassungen A und B erfüllen laut eigenem Testbericht alle Pflichtkriterien; sie wurden unabhängig geprüft ([Prüfauftrag](../../prompts/trennlabor-review-codex.md)) und von der Lehrkraft in mebis erprobt ([Eindrücke der Lehrkraft](../reviews/trennlabor-eindruecke-lehrkraft.md)).

Der Praxistest zeigt **erhebliche Unterschiede**: Beide Fassungen haben Stärken und Schwächen, und diese verteilen sich **je Versuchsbereich unterschiedlich**. Außerdem sind grundlegende Änderungen an Bedienung, Ablauf und Optik nötig.

## Entscheidung

1. Das Trennlabor wird **nachträglich in drei eigenständige Anwendungen** aufgeteilt:

   | App | Verzeichnis | Inhalt aus dem Masterauftrag |
   | --- | --- | --- |
   | Trennverfahren | `apps/trennverfahren/` | Abschnitt 3A: K-01 Sand/Wasser, K-02 Sand/Kochsalz, K-03 Eisen/Sand/Kochsalz, K-04 Öl/Wasser, K-05 Hibiskustee |
   | Papierchromatographie | `apps/chromatographie/` | Abschnitt 3B: 7 Modellproben, 2 Laufmittel, Expertenmodus mit Rf |
   | Destillation | `apps/destillation/` | Abschnitt 3C: nur Ethanol/Wasser, Temperaturverlauf, Brennprobe |

2. **Einheitlich in allen drei Apps** sind Stil, Bedienlogik und Auswertungslogik. Was alle drei Apps gleich machen, liegt einmal im gemeinsamen Baukasten [`shared/labkit/`](../../shared/labkit/README.md) und wird beim Paketieren in jede App kopiert. Die Auswertungslogik folgt der [Lern- und Auswertungsstruktur nach dem Redoxlabor](../QUALITY.md#verbindliche-lern--und-auswertungsstruktur-für-weitere-apps) und umfasst vier Teile:

   | Teil | Was einheitlich ist |
   | --- | --- |
   | **Aufgaben** | Aufbau der Aufgabenstellung, geschlossene Antwortformate mit plausiblen Falschantworten, Erfolg am tatsächlichen Versuchszustand |
   | **Hilfestellung** | Hilfe auf Anforderung in drei Stufen (Tipp 1/3 bis 3/3), „Lösung anzeigen“ bewusst anzufordern |
   | **Verbesserung** | sofortige Rückmeldung je Feld, Eingaben bleiben erhalten, Korrektur und erneutes Prüfen ohne Neustart des Versuchs |
   | **Hefteintrag** | kurze Zusammenfassung zum Abschreiben am Schluss, für alle erreichbar, in allen Apps gleich gestaltet |

   Schaltflächen, Reihenfolge und Rückmeldeformen sind gleich; die **Inhalte** (Fachmodell, Aufgaben, Hilfetexte, Hefteintrag) gehören der jeweiligen App.

3. **Inhaltlich** wird jede App unabhängig analysiert, weiterentwickelt, getestet und veröffentlicht.

4. **Bausteinweise statt fassungsweise:** Es wird nicht „Fassung A oder B“ als Ganzes übernommen. Für jeden Baustein (Fachmodell, Aufgabe, Gerätegrafik, Bedienelement, Auswertungsschritt, Hilfsfunktion) wird aus den vorhandenen Fassungen A, B und dem Codex-Versuch das genommen, was **korrekt** ist (fachlich richtig, durch Tests belegt), **gefällt** (Eindrücke der Lehrkraft) und **funktioniert** (Praxistest auf iPad und in mebis). Was fehlt oder nicht passt, wird **geändert oder ergänzt**.

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

### 5. Das Beste aus allen Fassungen

Stärken und Schwächen sind nicht nur je Bereich, sondern auch innerhalb eines Bereichs verschieden verteilt: Eine Fassung hat vielleicht das überzeugendere Fachmodell, eine andere die bessere Gerätegrafik oder Rückmeldung. Deshalb wird bausteinweise ausgewählt. In kleinen, getrennten Apps lässt sich das mit überschaubarem Aufwand zusammenführen und prüfen; in einer gemeinsamen App wäre das nur mit großem Integrationsaufwand möglich.

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
- **Trennlabor 1.0.0** (Fassung B) wird nicht weiterentwickelt und wurde am 25.10.2026 von `main` entfernt (PR #26), samt Release-ZIPs. Alle Fassungen bleiben über die Tags `archiv/trennlabor-1.0.0` und `archiv/trennlabor-ccr` sowie die PR-Stände #9 und #10 erreichbar (siehe Ausgangslage). Andere SiVex-Anwendungen und deren Releases sind nicht betroffen.
- Die neuen Apps beginnen mit Status `planned` und erhalten ihre erste Version erst nach Abnahme. Papierchromatographie 0.1.0 und Destillation 0.2.0 stehen auf `prototype`.

## Vorgehen

| Phase | Inhalt | Ergebnis | Stand 25.10.2026 |
| --- | --- | --- | --- |
| 0 – Vorbereitung | diese Entscheidung, App-Gerüste, Umfang des Baukastens | Entscheidung, Gerüste | **erledigt** (PR #16) |
| 1 – Bewertung | Codex-Review, eigene Eindrücke der Lehrkraft aus dem mebis-Test | je App eine Bausteinliste: Baustein → Quelle (A, B oder Codex) mit Begründung (korrekt, gefällt, funktioniert) bzw. „neu“; dazu die nötigen Änderungen und Ergänzungen | Chromatographie und Destillation erledigt (je `docs/UEBERNAHME.md`); Trennverfahren offen |
| 2 – Gestaltungs-, Bedien- und Auswertungsregeln | einheitliche Regeln für Stil, Bedienung und die Auswertung (Aufgaben, Hilfestellung, Verbesserung, Hefteintrag) festlegen, **bevor** Code verschoben wird | `shared/labkit/DESIGN.md` | angelegt |
| 3 – Baukasten | gemeinsame Bausteine aus den Fassungen zusammenführen, mit eigenen Tests | `shared/labkit/` | Labkit 0.1.1 (Zeittakt, Splitter, SCORM, Stil) |
| 4 – Apps | je App eigener Auftrag, Branch und PR; Bausteinliste umsetzen, Inhalte unabhängig von den anderen Apps weiterentwickeln | drei Apps mit Tests, Testbericht, Web- und SCORM-ZIP | Papierchromatographie 0.1.0 (PR #23), Destillation 0.2.0 (PR #24); Trennverfahren offen |
| 5 – Praxistest | iPad/Safari, mebis, Unterricht je App | Status `prototype` → `ready` | offen |

Die Reihenfolge der Apps in Phase 4 legt die Lehrkraft fest.

## Offene Punkte

- Endgültige Namen und Kennungen der Apps (Vorschlag: `chemie/trennverfahren`, `chemie/chromatographie`, `chemie/destillation`)
- Ob die Masterauftrags-Kriterien A-01 bis T-08 je App aufgeteilt oder für die Neufassung überarbeitet werden
- Ob Redoxlabor und Titration später ebenfalls auf den Baukasten umgestellt werden (nicht Teil dieser Entscheidung; dort keine Änderungen)
