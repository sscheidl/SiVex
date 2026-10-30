# Trennverfahren – Stoffgemische trennen

**Status: prototype 0.3.1** · Chemie Jahrgangsstufe 8/9 (NTG 8 / SG 9) · Labkit 0.1.1

Virtuelles Labor zum letzten Aufgabenblock „Klassische Trennverfahren“: Die Lernenden führen fünf Versuche selbst durch, notieren eigene Beobachtungen, prüfen ihr Wissen in einer gemeinsamen Kontrolle und schreiben am Schluss einen Hefteintrag ab.

| Nr. | Versuch | Was die Lernenden tun |
| --- | --- | --- |
| 1 | Sand und Wasser: sedimentieren und dekantieren | aufrühren, absetzen lassen, vorsichtig abgießen und rechtzeitig stoppen; trübes Dekantat erneut absetzen lassen und abgießen |
| 2 | Sand und Wasser: filtrieren | Filterpapier einlegen, Trichter in den Ring setzen, Vorlage unterstellen, aufrühren, gießen, nachgießen, Rest ausspülen, Filterpapier mit Rückstand auf das Uhrglas legen |
| 3 | Kochsalzlösung: eindampfen | Lösung in die Abdampfschale gießen, Heizplatte steuern (auch direkt am Drehknopf), Trockenlaufen vermeiden, Kristalle nach dem Abkühlen portionsweise mit dem Spatel auf das Uhrglas überführen |
| 4 | Öl und Wasser: scheiden | Scheidetrichter einhängen, befüllen, untere Schicht über den Hahn (direkt am Gerät) ablassen, Vorlage wechseln, Öl gesondert auffangen; freiwillig: mit Stopfen außerhalb des Rings schütteln und die Entmischung beobachten; verunreinigte Fraktionen zurückgießen |
| 5 | Eisen, Sand und Kochsalz: eigene Trennkette | Magnet (trocken zwei, nass drei Durchgänge), Extraktion mit Wasser, Filtration oder Dekantieren, Eindampfen – in eigener, fachlich sinnvoller Reihenfolge; jeder richtig ausgeführte Schritt trennt vollständig |

Grundlage: [Build-Auftrag](../../prompts/trennlabor-klassik-build-claude.md) und [Trennlabor-Planung](../../docs/TRENNLABOR-PLANUNG.md); einheitlicher Stil über den Baukasten [`shared/labkit/`](../../shared/labkit/README.md) ([Entscheidung zur Aufteilung des Trennlabors](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md)).

## Download

- **SCORM 1.2 für mebis:** [`release/trennverfahren-0.3.1-scorm12.zip`](release/trennverfahren-0.3.1-scorm12.zip) – in mebis als „Lernpaket (SCORM)“, Darstellung „Neues Fenster“
- **Web/offline:** [`release/trennverfahren-0.3.1-web.zip`](release/trennverfahren-0.3.1-web.zip) – entpacken und `trennverfahren/index.html` öffnen (auch ohne Internet, per Doppelklick)
- Prüfsummen: [`release/SHA256SUMS.txt`](release/SHA256SUMS.txt)

## Lernen

- **Vier Perspektiven** in Versuch, Kontrolle und Hefteintrag: Stoffebene (Beobachtung), Teilchenebene (Erklärung), Aggregatzustände (nur dort ein Wechsel, wo er stattfindet), Kenneigenschaft/Trennprinzip (Dichte, Löslichkeit, Mischbarkeit, Magnetismus, Flüchtigkeit; Korngröße als Trennkriterium).
- **Eigene Beobachtung und Erklärung:** frei formuliert, gemeinsam als Zwischenstand mit Ansatz, Versuchszeit und Zustand speicherbar; ausdrücklich **unbewertet** (keine Scheinprüfung). Nach erreichtem Trennziel lässt sich eine Musterbeobachtung zum Selbstvergleich einblenden.
- **Einordnung und Trennprinzip:** geschlossene Formate mit ✓/✗, Begründung bei Fehlern, Tipp in drei Stufen, Vorgehen nach Rückfrage. Ein Versuch gilt als abgeschlossen, wenn das Trennziel im Versuch erreicht ist und Einordnung sowie Trennprinzip stimmen; fachlich vertretbare Zusatzkreuze (z. B. Unlöslichkeit als Voraussetzung) werden erläutert, nicht als Fehler gewertet.
- **Kontrolle:** 10 Multiple-Choice-Aufgaben in vier Gruppen und ein Lückentext mit 10 Fachbegriffen (tolerant bei Schreibweise und gleichwertigen Begriffen).
- **Hefteintrag:** erst nach Versuchen und korrigierter Kontrolle; vollständig, mit Versuchskarten, Trennkette, Teilchenbildern und Merksätzen.
- **Teilchenmodell:** zuschaltbar in der Kopfzeile, zustandsabhängig und synchron zur Laborfläche; Wasserteilchen als blaue Dreiecke, gut lesbare Ionenladungen, gleichmäßige Verteilung in jeder Phase, Öltröpfchen nach dem Schütteln; in Versuch 3 zusätzlich Vergleichsbilder reines Wasser, festes Kochsalz und Kochsalzlösung.

## Bedienung

Gerät antippen → Ziel antippen (oder Zielschaltfläche), erneutes Antippen stellt zurück; Hahn und Heizplatten-Drehknopf direkt am Gerät; Tastatur und Ziehen ebenfalls möglich. Ausführlich: [docs/BEDIENUNG.md](docs/BEDIENUNG.md).

## Entwicklung und Tests

```bash
npm install            # Playwright 1.56.1 (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1, nutzt installiertes Edge)
npm start              # http://localhost:8080 (bildet /labkit/ auf shared/labkit ab)
npm test               # Unit-Tests Modell, Geometrie, Aufgaben, Teilchenansicht + Labkit
npm run package        # Build-Prüfung, Web- und SCORM-ZIP, Prüfsummen
npm run test:e2e       # Browserabnahme E1–E13 (Screenshots und Bildfolgen in docs/screenshots)
npm run test:scorm     # Paketprüfung: Manifest, Mock-LMS, Pflichtablauf im Paket, file://
```

Aufbau: `js/model.js` (Fachmodell, ohne DOM), `js/geometry.js` (Gefäße, Spiegel, Posen), `js/tasks.js` (Aufgaben, Kontrolle, Hefteintrag), `js/render.js` (Laborbühne, Canvas 2D), `js/particles.js` (Teilchenmodell), `js/ui.js` (Oberfläche). Fachmodell und Parameter: [docs/CHEMIE.md](docs/CHEMIE.md). Prüfstand: [docs/TESTBERICHT.md](docs/TESTBERICHT.md).

Der Quellstand lädt den Baukasten unter `labkit/` – direkt per `index.html` startet daher nur der Build bzw. das Web-ZIP; im Quellstand `npm start` verwenden (wie bei Destillation und Papierchromatographie).

## Grenzen

- Status **prototype**: Auf dem iPad mit Safari geprüft (30.10.2026). Fachliche Freigabe durch die Lehrkraft, Test in mebis und Unterrichtserprobung stehen aus (siehe Testbericht).
- Vereinfachtes, beschleunigtes Unterrichtsmodell; die Zeitkonstanten sind keine Messwerte (siehe CHEMIE.md).
- Kein Versuch mit Hibiskustee (laut Auftrag nicht erforderlich).
- Zurückgestellt: Kochsalz mit dem Löffel selbst dosieren (P2 des Auftrags 0.2.0).
- 0.3.x: Browserabnahme (E1–E13) und Paketprüfung auf dem Entwicklungsrechner stehen noch aus (siehe Testbericht).

Änderungen: [CHANGELOG.md](CHANGELOG.md)
