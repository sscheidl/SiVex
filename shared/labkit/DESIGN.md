# SiVex-Labkit – Gestaltungs- und Bedienregeln

**Version 0.1.0** · Stand 24.10.2026 · gilt für die Trenn-Apps (`trennverfahren`, `chromatographie`, `destillation`)

Grundlage: [Eindrücke der Lehrkraft](../../docs/reviews/trennlabor-eindruecke-lehrkraft.md) (G-01 bis G-04), [Qualitätsregeln](../../docs/QUALITY.md) und die [Entscheidung zur Aufteilung](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md). Diese Datei legt nur fest, was **alle** Apps gleich machen. Fachinhalte, Gerätegrafiken und Aufgaben gehören in die jeweilige App.

## 1. Leitgedanke

**Der Versuch steht im Mittelpunkt, nicht die Oberfläche.** Die Lernenden kennen die App nicht. Deshalb:

- Das zentrale Gerät ist das größte Objekt auf der Bühne. Keine Miniaturszene.
- Nur Auswahlmöglichkeiten anbieten, die für das Lernziel nötig sind (G-01). Fehler, die keinen Lerngewinn bringen, werden nicht als Schalter angeboten, sondern höchstens in Hilfe oder Theorie erwähnt.
- Keine feste Klickfolge als Erfolgskriterium. Bewertet wird der tatsächliche Versuchszustand.
- Sichtbare Folgen vor Belehrung: Ein Fehler zeigt sich zuerst im Labor, erst danach in Worten.

## 2. Seitenaufbau

| Bereich | Regel |
| --- | --- |
| Kopfzeile | dunkel, 52 px hoch: App-Name links; rechts nur globale Schalter (Zeitraffer, Expertenmodus falls vorhanden, Hefteintrag, Bedienfeld ein/aus) |
| Laborbühne | links, heller Laborhintergrund (Fliesenwand, Tischplatte), Canvas 2D in HiDPI; darüber eine schmale **Handlungsleiste** mit höchstens fünf Schaltflächen für die gerade sinnvollen Handlungen |
| Trennlinie | verschiebbar nach TitraLab 3 (siehe 4) |
| Bedienfeld | rechts, kompakt, einklappbar; Reiter in fester Reihenfolge **Aufgabe · Ergebnisse · Hefteintrag** |
| Meldungen | eine Zeile unten auf der Bühne, verschwindet nach einigen Sekunden; keine großen Hinweiskästen über dem Labor |

Ab 900 px Breite stehen Bühne und Bedienfeld nebeneinander, darunter untereinander (Trennlinie ausgeblendet). Kein horizontales Scrollen der Seite.

## 3. Bedienung

- **Tippen statt Ziehen.** Jede Handlung geht mit einem Klick oder Tipp. Ziehen ist höchstens eine zusätzliche Bedienart.
- **Gerät wählen → Ziel antippen.** Ein gewähltes Gerät ist deutlich hervorgehoben (angehoben, Rahmen, Name in Textform).
- **Erneutes Antippen stellt zurück** (G-02): ein gewähltes Gerät wird wieder abgelegt; ein leeres oder unbenutztes Gerät kehrt an seinen Platz zurück. Geht das physikalisch nicht, erscheint eine kurze Meldung mit Begründung.
- **Trefferflächen** auf der Bühne sind unsichtbare HTML-Schaltflächen über der Zeichnung: mit Tab erreichbar, mit Enter oder Leertaste auslösbar, mit `aria-label` beschriftet, mindestens 44 × 44 px.
- **Fokus** sichtbar mit `:focus-visible` (2 px Akzentrahmen).
- **Farbe nie allein:** Proben, Zustände und Rückmeldungen tragen immer auch Text oder Symbol (✓, ✗).
- **Zeitsteuerung:** Pause, 1×, 10×, 30×. Das Modell rechnet in festen Zeitschritten (`labkit.core.createClock`); Pause und Zeitraffer ändern nur das Tempo, nie das Ergebnis. Während einer Handanimation (Gießen, Auftupfen, Einsetzen) läuft die Zeit mit höchstens 1×, damit die Bewegung sichtbar bleibt.

## 4. Verschiebbare Trennlinie

Nach TitraLab 3 (`titration/js/ui/app.js`, `bindSplitter`):

- Maus, Finger (Trefferfläche 44 px breit), Tastatur (Pfeiltasten ± 24 px), Doppelklick setzt die Standardbreite zurück.
- Bedienfeld 300–620 px, die Bühne behält mindestens 420 px.
- Breite nur lokal im Browser merken (`localStorage`, mit `try`/`catch`).
- Umsetzung: `labkit/js/splitter.js`.

## 5. Gestaltung

- **Farben** als CSS-Variablen in `labkit/css/labkit.css`: heller Grund `--bg`, dunkle Kopfzeile `--head`, Akzent `--accent` (Blau), Rückmeldung `--ok` (Grün), `--bad` (Rot), `--warn` (Bernstein).
- **Schrift:** Systemschrift (Segoe UI, SF, Helvetica), keine Webfonts. Fließtext 15 px, Bedienfeld mindestens 14 px.
- **Glas und Flüssigkeit** wie TitraLab 3: Rückwand mit leichtem Verlauf, Flüssigkeit mit seitlicher Abdunkelung, Spiegel als flache Ellipse mit Meniskus an der Glaswand, Vorderkanten und schmale Glanzlichter. Glanzlichter sind dezent und verdecken keine Beobachtung.
- **Keine Lernspiel-Optik:** keine Maskottchen, kein Konfetti, keine Punkte. Animationen nur, wo sie einen Vorgang zeigen.

## 6. Auswertungsablauf

Einheitlich nach dem Redoxlabor ([`QUALITY.md`](../../docs/QUALITY.md#verbindliche-lern--und-auswertungsstruktur-für-weitere-apps)):

1. **Aufgabe:** kurze Problemstellung, kein Schrittrezept.
2. **Ergebnis prüfen:** prüft den tatsächlichen Versuchszustand. Die Rückmeldung nennt, was das Ergebnis noch nicht belegt, ohne die Lösung vorwegzunehmen.
3. **Protokoll:** nummerierte Felder, geschlossene Formate (eine Antwort wählen, alles Zutreffende ankreuzen, punktuell eine Fachbegriffslücke). Schaltfläche **„Antworten prüfen“** markiert jedes Feld mit ✓/✗; Eingaben bleiben erhalten; richtige Felder bleiben richtig.
4. **Hilfe:** Schaltfläche **„Tipp“** zeigt auf Anforderung **Tipp 1/3** (Denkanstoß), **2/3** (Eingrenzung), **3/3** (konkrete Korrektur), passend zum aktuellen Zustand. Nach zwei erfolglosen Prüfungen wird Hilfe **angeboten**, nicht eingeblendet. Keine vierte Stufe.
5. **Lösung anzeigen:** getrennt und ausdrücklich anzufordern; bei unvollständiger Bearbeitung mit Rückfrage. Funktioniert auch ohne gelungenen Versuch.
6. **Ergebnisse:** alle eigenen Versuche nebeneinander, jeweils mit ihren Bedingungen und Befunden.
7. **Hefteintrag:** jederzeit über die Kopfzeile erreichbar, etwa 100 Wörter, unabhängig von eigenen Messwerten. Aufbau: Überschrift, Merksätze, Fachbegriffe fett, Gleichungen oder Definitionen in eigener Zeile.

## 7. Technik

- Statisch, offline, ohne externe Ressourcen. Relative Pfade; der Baukasten wird beim Bauen nach `dist/<app>/labkit/` kopiert.
- Fachmodell ohne DOM (in Node testbar). Der Renderer liest den Modellzustand und verändert ihn nie.
- SCORM 1.2 nur `LMSInitialize`/`LMSFinish`; keine Noten, Antworten, Freitexte oder personenbezogenen Daten (`labkit/js/scorm.js`).
- Sitzungsstand in `sessionStorage` (Neuladen behält den Versuch, ein neuer Tab beginnt neu).

## 8. Inhalt des Baukastens 0.1.0

| Datei | Inhalt |
| --- | --- |
| `js/core.js` | `clamp`, `lerp`, `fmt`, `clone`, `emitter`, feste Zeitschritte `createClock`, Begriffsprüfung `checkGap`, `parseNum` |
| `js/splitter.js` | verschiebbare Trennlinie (`bindSplitter`, `clampPanelWidth`) |
| `js/scorm.js` | SCORM-1.2-Anmeldung und -Abmeldung ohne Datenübertragung |
| `css/labkit.css` | Farben, Schrift, Kopfzeile, Splitter, Schaltflächen, Rückmeldungen, Reiter |
| `tests/` | Unit-Tests der Bausteine |

Aus den Fassungen übernommen: `createClock`, `checkGap`, `parseNum` und der SCORM-Adapter aus Fassung B (`apps/trennlabor/js/core.js`, `js/scorm.js`); die Splitter-Logik nach TitraLab 3. Weitere Bausteine kommen erst hinzu, wenn eine zweite App sie tatsächlich braucht.
