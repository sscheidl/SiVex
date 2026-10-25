# Papierchromatographie

**Status: prototype** · Version 0.2.0 · Jahrgangsstufe 8/9 (NTG 8 / SG 9) · Baukasten [`shared/labkit`](../../shared/labkit/) 0.1.1

Eigenständige Browser-App: Farbstoffgemische mit Papierchromatographie trennen. Eine der drei Einzelanwendungen aus dem Trennlabor 1.0.0 ([Entscheidung](../../docs/decisions/2026-10-23-trennlabor-aufteilung.md)), neu gebaut: Das Fachmodell stammt aus den Altfassungen, Darstellung und Bedienung sind neu ([Bausteinliste](docs/UEBERNAHME.md)).

![Laborbühne während der Entwicklung](docs/screenshots/09-front-spaet.png)

## Im Labor

- **Große Entwicklungskammer** in der Mitte (etwa die halbe Bühnenbreite), darin das Chromatographiepapier mit Startlinie, Proben, aufsteigender Laufmittelfront und wandernden Farbzonen
- **Arbeitsfläche** links: Papier, Bleistift (Startlinie ziehen oder wegradieren), **Stifteständer mit sieben großen Stiften**
- **Laufmittel** rechts: Wasser und Ethanol-Wasser 1 : 1 (Volumenverhältnis). Jedes Antippen gießt eine Portion ein; wer zu viel eingießt, sieht, wie sich die Farbpunkte im Laufmittel lösen.
- Bedienung: Stift antippen → Auftragepunkt antippen (mehrmals = mehr Farbe) → Flasche antippen → Kammer antippen (einhängen, später herausnehmen). Alles geht auch über die Handlungsleiste und mit der Tastatur.
- Zeitraffer 1× / 10× / 30× und Pause; die Ergebnisse hängen nur von der Modellzeit ab.

## Aufgaben

| | Problemstellung |
| --- | --- |
| **A** | Gemisch oder ein Farbstoff? Schwarzer Filzstift mit einem Referenzfarbstoff |
| **B** | Gemeinsamer Bestandteil? Grün, Violett und Blau (Referenz) nebeneinander |
| **C** | Wasserfest? Wasserfester Stift in Wasser und in Ethanol-Wasser |
| **Frei** | alle sieben Proben, beide Laufmittel |

„Ergebnis prüfen“ wertet die tatsächlich entwickelten Papiere aus. Danach folgt ein Protokoll mit geschlossenen Fragen und Rückmeldung je Feld. Hilfe gibt es in drei Stufen (Tipp 1/3–3/3) auf Anforderung, „Lösung anzeigen“ ist getrennt und mit Rückfrage. Der **Hefteintrag** ist jederzeit über die Kopfzeile erreichbar. Der **Expertenmodus** ergänzt Frontmarkierung, Lineal und Rf-Werte.

## Entwicklung

```bash
npm install            # Playwright für die Browsertests (nutzt das installierte Edge)
npm start              # Entwicklungsserver http://localhost:8080 (bindet shared/labkit ein)
npm test               # Unit-Tests: Fachmodell, Aufgaben, Baukasten
npm run package        # Build dist/chromatographie + release/*.zip + SHA256SUMS.txt
npm run test:e2e       # Browsertests gegen dist/ (PW_CHANNEL=msedge)
npm run test:scorm     # SCORM-Paket im Mock-LMS, Web-ZIP per file://
```

| Datei | Inhalt |
| --- | --- |
| `js/model.js` | Fachmodell ohne DOM: Proben, Laufmittel, Front, Zonen, Handgriffe |
| `js/tasks.js` | Aufgaben, Ergebnisprüfung, Tipps, Protokollfragen, Rf-Prüfung, Hefteintrag (ohne DOM) |
| `js/render.js` | Canvas-2D-Renderer (liest nur den Modellzustand) |
| `js/ui.js`, `js/app.js` | Oberfläche, Trefferflächen, Bedienfeld, Zeitsteuerung |
| `labkit/` (beim Build aus `shared/labkit/`) | Grundstil, Trennlinie, Zeitschritte, Begriffsprüfung, SCORM |

## Dokumentation und Pakete

- [Fachmodell und Grenzen](docs/CHEMIE.md) · [Testbericht mit PASS/HOLD-Matrix](docs/TESTBERICHT.md) · [Bausteinliste](docs/UEBERNAHME.md)
- `release/chromatographie-0.2.0-web.zip` (Webserver oder lokal entpackt), `release/chromatographie-0.2.0-scorm12.zip` (mebis: „Lernpaket (SCORM)“, Darstellung „Neues Fenster“), Prüfsummen in `release/SHA256SUMS.txt`

Der Unterrichtseinsatz (`ready`) setzt den Test der Lehrkraft auf den Schul-iPads und in mebis voraus.
