# SiVex-Labkit – gemeinsamer Baukasten der Trenn-Apps

**Status: planned** · noch kein Code eingecheckt · Begründung: [Entscheidung zur Aufteilung des Trennlabors](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md)

Der Baukasten sorgt dafür, dass sich [Trennverfahren](../../apps/trennverfahren/), [Papierchromatographie](../../apps/chromatographie/) und [Destillation](../../apps/destillation/) wie **ein** Labor anfühlen: gleicher Look, gleiche Bedienlogik, gleicher Ablauf von der Aufgabe bis zum Hefteintrag.

## Was hineingehört – und was nicht

| In den Baukasten | In die jeweilige App |
| --- | --- |
| Farben, Typografie, Abstände, Symbole (CSS-Variablen) | Fachmodell (Stoffe, Mengen, Temperaturen, Laufmittel) |
| Seitenhülle: Kopfzeile, Bühne, einklappbares Bedienfeld, Tablet-Layout | Aufgaben, Erfolgskriterien, Fehlerfälle |
| Bedienmuster: Tippen statt Ziehen, Tastatur, Fokus, Touch-Zielgrößen, Rückmeldungen | Gerätegrafiken und Versuchsbühne |
| Zeitsteuerung: feste Zeitschritte, Pause, Zeitraffer-Stufen | Texte: Problemstellung, Hilfen, Theorie, Hefteintrag |
| Ablauf: Aufgabe → Versuch → „Ergebnis prüfen“ → Auswertung → Theorie → Hefteintrag | `CHEMIE.md`, Testbericht, Screenshots |
| Hilfe in genau drei Stufen (Mechanik, nicht Inhalt) | |
| Lückentext- und Messwertprüfung (Normalisierung, Synonyme, Tippfehler, Sperrliste) | Begriffe, Synonyme und Sperrwörter je Aufgabe |
| Sitzungsspeicher (`sessionStorage`), „Versuch neu beginnen“ | |
| Canvas-Grundlagen: HiDPI, Glas, Flüssigkeit, Beschriftung | |
| SCORM-1.2-Adapter, Build, Paketierung, Entwicklungsserver | `sivex.json`, Manifest-Titel |
| Testhilfen: Unit-Helfer, Browser-Rahmen, Mock-LMS, ZIP-Prüfung | app-eigene Unit- und Browser-Tests |

**Regel:** Im Baukasten steht keine Chemie. Sobald eine Funktion einen Stoff, ein Gerät oder eine Aufgabe kennt, gehört sie in die App.

## Technische Regeln

- **Offline und eigenständig:** Der Baukasten wird beim Bauen in `dist/<app>/labkit/` kopiert. Kein Laden zur Laufzeit von außerhalb des App-Pakets, kein CDN, keine Netzzugriffe. Jedes Web- und SCORM-ZIP bleibt für sich lauffähig, auch per `file://`.
- **Keine Abhängigkeit zwischen den Apps.** Apps importieren nur aus dem Baukasten, nie aus einer anderen App.
- **Versioniert:** eigene Versionsnummer in `shared/labkit/package.json`; jede App nennt im Testbericht die Baukasten-Version, mit der sie gebaut wurde.
- **Eigene Tests** für alle Bausteine. Änderungen am Baukasten werden gegen alle drei Apps getestet, bevor sie gemergt werden.
- **Gestaltungs- und Bedienregeln** werden zuerst in `DESIGN.md` festgelegt (nach Review und Praxistest), erst danach wird Code zusammengeführt.

## Bestand in den beiden Fassungen

Ausgangsmaterial für den Baukasten. Welche Umsetzung jeweils übernommen wird, entscheidet sich nach dem Review.

| Baustein | Fassung A (`486f370`) | Fassung B (`a5d6d0e`) |
| --- | --- | --- |
| Hilfsfunktionen, feste Zeitschritte | `js/util.js` | `js/core.js` (`createClock`, `STEP`) |
| Lückentext- und Messwertprüfung | `js/answers.js` | `js/core.js` (`checkGap`, `parseNum`) |
| Ablauf, Hilfestufen, Auswertung, Freischaltung | `js/session.js` | allgemeiner Teil von `js/tasks.js` |
| Seitenhülle und Bedienfeld | `js/ui.js`, `css/app.css`, `index.html` | `js/ui.js`, `css/app.css`, `index.html` |
| Zeichenhilfen Canvas 2D | `js/render/common.js` | `js/gfx.js` |
| SCORM-1.2-Adapter | `js/scorm.js` | `js/scorm.js` |
| Build, Paket, Server | `scripts/build.mjs`, `package.mjs`, `serve.mjs` | `scripts/build.mjs`, `package.mjs`, `serve.mjs` |
| Testhilfen | `tests/unit/helpers.js`, `tests/e2e/zip.mjs`, Mock-LMS in `tests/e2e/scorm.mjs` | `tests/unit/helpers.js`, Mock-LMS in `tests/e2e/scorm.mjs` |

Die Build- und Paketskripte beider Fassungen gehen auf die des Redoxlabors zurück. Das Redoxlabor selbst bleibt unverändert.

## Gestalterische Vorbilder

- **Flüssigkeiten, Tropfen, Meniskus, Glasgefäße:** TitraLab 3 (`apps/titration/release/SiVex-Titration-Claude-v3-web.zip` → `titration/js/view/lab-renderer.js`, `geometry.js`)
- **Verschiebbare Trennlinie Labor | Bedienfeld:** TitraLab 3 (`titration/js/ui/app.js` → `bindSplitter`, `titration/css/styles.css` → `.splitter`)

Siehe [Eindrücke der Lehrkraft](../../docs/reviews/trennlabor-eindruecke-lehrkraft.md), G-03 und G-04.
