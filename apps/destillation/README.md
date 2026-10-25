# Destillation

**Status: prototype** · Version 0.1.0 · Jahrgangsstufe 8/9 (NTG 8 / SG 9), optionaler Expertenmodus · Baukasten [`shared/labkit`](../../shared/labkit/) 0.1.0

Eigenständige Browser-App: Flüssigkeitsgemische mit einer **fertig montierten Destillationsapparatur** trennen. Eine der drei Einzelanwendungen aus dem Trennlabor 1.0.0 ([Entscheidung](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md)), als **Neustart** gebaut: Ideen und Sicherheitslogik aus den Altfassungen A/B, Glasdarstellung nach TitraLab 3, Fachmodell, Geometrie und Darstellung neu ([Bausteinmatrix](docs/UEBERNAHME.md)).

![Laborbühne während der Destillation](docs/screenshots/07-kondensat-tropfen.png)

## Im Labor

- **Apparatur ab Start montiert:** Stativ mit Klemmen, Heizpilz (aufgeschnitten gezeichnet) auf Laborboy, Rundkolben, Destillationsaufsatz mit Thermometer, Liebigkühler, Vorstoß, Vorlage. Alle Teile hängen an gemeinsamen geometrischen Ankern und bleiben bei jeder Bildschirmgröße verbunden.
- **Selbst bedient:** Gemisch einfüllen (sichtbarer Füllvorgang), Siedesteine zugeben, Thermometer prüfen und auf Höhe des seitlichen Abgangs schieben (Start absichtlich zu hoch), Kühlwasserschläuche durch Antippen anschließen, **Heizung EIN/AUS** mit Heizstufe, **Kühlwasser EIN/AUS** mit Durchfluss – unabhängig voneinander –, Destillat auffangen, im Expertenmodus Vorlage wechseln.
- **Sichtbare Vorgänge aus dem Modell:** Füllstand mit Meniskus sinkt, Siedeblasen je nach Heizleistung, Dampf unsichtbar (zuschaltbarer, gekennzeichneter Teilchen-Erklärmodus), Kondensatfilm und Tropfen im Innenrohr, einzelne Tropfen in die Vorlage, Kühlwasser strömt im Mantel von unten nach oben, Kühler-Detailansicht mit beiden Strömungsräumen.
- **Große Digitalanzeige** der Dampftemperatur direkt neben dem klassischen Thermometer; Temperatur-Zeit-Diagramm im Expertenmodus.
- **Brennprobe** am getrennten Prüfplatz: Pipette → Vorlage → Porzellanschale → Stabfeuerzeug → bläuliche Flamme (nur Ethanol/Wasser).
- **Fehler mit Folgen:** Kühlung aus, Schläuche vertauscht, Thermometer falsch, Heizung zu schwach/zu stark, Siedesteine fehlen, Vorlage fehlt, Apparatur verschlossen, Trockenlauf, Zünden an der Apparatur.

## Aufgaben

| | Gemisch | Lernziel |
| --- | --- | --- |
| **1** | Ethanol + Wasser (40 + 60 mL) | Sieden, Verdampfen, Kondensieren, Dampftemperatur, Kühlung, Destillat, Brennprobe |
| **2** | Propanon + Wasser (40 + 60 mL) | größerer Unterschied der Siedetemperaturen, Vergleich |
| **3** (Experte) | Propanon + Ethanol + Wasser (30 + 30 + 40 mL) | drei Abschnitte, Vorlagenwechsel, Fraktionen, Temperaturkurve |

Die Simulation nimmt eine **idealisierte, weitgehend vollständige Trennung** an (Azeotrop Ethanol/Wasser vernachlässigt); das steht in der App und in [CHEMIE.md](docs/CHEMIE.md). Ablauf nach Redoxlabor: Ergebnis prüfen → Protokoll mit eigenen Messwerten und Rückmeldung je Feld → Tipps 1/3–3/3 → Lösung mit Rückfrage → Geräte-Trainer → Hefteintrag (immer erreichbar).

## Entwicklung

```bash
npm install            # Playwright für die Browsertests (nutzt das installierte Edge)
npm start              # Entwicklungsserver http://localhost:8080 (bindet shared/labkit ein)
npm test               # Unit-Tests: Fachmodell, Geometrie, Aufgaben, Baukasten
npm run package        # Build dist/destillation + release/*.zip + SHA256SUMS.txt
npm run test:e2e       # Browsertests gegen dist/ (PW_CHANNEL=msedge, ONLY=E01,E05 für einzelne)
npm run test:scorm     # SCORM-Paket im Mock-LMS (eingebettet + neues Fenster), Web-ZIP per file://
```

| Datei | Inhalt |
| --- | --- |
| `js/model.js` | Fachmodell ohne DOM: Heizpilz, Kolben, idealisiertes Trennmodell, Aufsatz, Kühlmantel, Tropfen, Brennprobe, Sicherheit, Bilanz |
| `js/geometry.js` | Apparatur in einem Koordinatensystem, Anker, Sollverbindungen, Skalierung (ohne DOM) |
| `js/tasks.js` | Aufgaben, Ergebnisprüfung, Tipps, Protokoll, Geräte-Trainer, Hefteintrag (ohne DOM) |
| `js/render.js` | Canvas-2D-Renderer (liest nur Modell und Geometrie) |
| `js/ui.js`, `js/app.js` | Oberfläche, Trefferflächen, Schalter, Bedienfeld, Zeitsteuerung |

## Dokumentation und Pakete

- [Fachmodell und Grenzen](docs/CHEMIE.md) · [Bedienung](docs/BEDIENUNG.md) · [Testbericht mit PASS/HOLD-Matrix](docs/TESTBERICHT.md) · [Bausteinmatrix A/B/C](docs/UEBERNAHME.md)
- `release/destillation-0.1.0-web.zip` (Webserver oder lokal entpackt), `release/destillation-0.1.0-scorm12.zip` (mebis: „Lernpaket (SCORM)“, Darstellung „Neues Fenster“), Prüfsummen in `release/SHA256SUMS.txt`

Der Unterrichtseinsatz (`ready`) setzt den Test der Lehrkraft auf den Schul-iPads und in mebis voraus.
