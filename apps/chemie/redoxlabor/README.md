# Redoxlabor: Fehling- und Tollens-Probe

**Status: prototype** (fachlich und im Desktop-Browser geprüft; Test auf echten Schul-iPads und in mebis steht noch aus – siehe [Testbericht](docs/TESTBERICHT.md))

Virtuelles Chemielabor für die Jahrgangsstufe 10 (NTG). Die Lernenden setzen Fehling- und Tollens-Reagenz selbst an, geben Stoffproben (drei Aldehyde, drei Ketone) zu, erwärmen im Wasserbad, beobachten die Reaktion in einer Lupe, protokollieren und erarbeiten anschließend die Redoxgleichungen.

![Labortisch](docs/screenshots/01-labortisch.png)

| Fehling-Probe mit Ethanal | Tollens-Probe mit Ethanal |
| --- | --- |
| ![Fehling-Verlauf](docs/screenshots/seq-fehling-ethanal.png) | ![Tollens-Verlauf](docs/screenshots/seq-tollens-ethanal.png) |

## Starten

Die Anwendung ist vollständig statisch (HTML, CSS, JavaScript) und braucht weder Server-Logik noch Internet.

| Weg | Vorgehen |
| --- | --- |
| Direkt | `index.html` im Browser öffnen (funktioniert auch per `file://`). |
| Lokaler Testserver | `npm start` → <http://localhost:8080/> (Node.js ≥ 18, keine Abhängigkeiten nötig) |
| Webserver | `npm run build` und den Ordner `dist/redoxlabor/` per HTTPS auf einen beliebigen Webserver hochladen. Alle Pfade sind relativ. |

Empfohlene Browser: aktuelle Versionen von Safari (iPadOS), Chrome, Edge, Firefox.

## Bedienung (Kurzfassung)

1. **Reagenzglas wählen** – im Ständer antippen (oder Nummer im Bedienfeld).
2. **Reagenz ansetzen** – Reagenzflaschen antippen: Die Pipette gibt eine Portion in das gewählte Reagenzglas. Alternativ Flasche auf das Reagenzglas ziehen.
   - Fehling: Fehling I + Fehling II, dann *Schütteln* → tiefblaue Lösung
   - Tollens: Silbernitrat → Natronlauge (brauner Niederschlag) → Ammoniaklösung tropfenweise, bis die Lösung klar ist
3. **Stoffprobe zugeben** – Probenflasche antippen.
4. **Erwärmen** – Heizplatte einschalten (60 °C / 80 °C), Reagenzglas *Ins Wasserbad* stellen (oder auf das Wasserbad ziehen).
5. **Beobachten** – in der Lupe vor weißem Hintergrund.
6. **Beobachtung festhalten** – Protokoll ausfüllen, auswerten lassen oder Lösung anzeigen.
7. **Redox-Trainer** – bei positiven Nachweisen die Redoxgleichungen in sechs Schritten erarbeiten.

Alle Handlungen sind ohne Drag-and-drop durch Antippen erreichbar. Die **Hilfe** gibt drei Stufen (Denkimpuls → Konkretisierung → Anleitung) passend zum aktuellen Versuchszustand. **Neustart** setzt nur den Aufbau oder alles zurück. Im **Analysemodus** heißen die Proben A–F und werden bei jedem Neustart neu gemischt.

## Aufbau

```text
index.html            Einstieg
css/app.css           Gestaltung, responsives Layout
js/chemistry.js       Chemie-Engine: Stoffdaten, Teilchen/Phasen, Kinetik, optisches Modell, Bewertung (ohne DOM)
js/lab.js             Experimentsteuerung: Zustandsmaschine, Handlungen, Hilfen, Protokoll (ohne DOM)
js/redox.js           Redoxgleichungen, Formelparser (Atom-/Ladungsbilanz), Redoxtrainer
js/render.js          Canvas-2D-Darstellung des Labortisches (liest nur den Zustand)
js/ui.js              Bedienfeld, Eingabe (Tippen/Ziehen), Hilfe, Auswertung, Dialoge
js/structures.js      Halbstrukturformeln als SVG
js/app.js             Start und Animationsschleife
scripts/              Build (statische Kopie + Prüfungen) und Testserver
tests/unit/           Node-Tests (Chemie, Zustandsmaschine, Gleichungen)
tests/e2e/run.mjs     Browser-Tests mit Playwright (Pixelmessungen, Screenshots)
docs/                 Chemische Modellierung, Testbericht, Screenshots
```

Die Trennung ist strikt: `chemistry.js` und `lab.js` laufen auch in Node und enthalten keine Grafik. Der Renderer zeichnet ausschließlich aus dem Zustand der Experimentsteuerung und dem optischen Modell der Chemie-Engine; Reaktionen werden nie durch einen Zeitablauf seit Programmstart ausgelöst, sondern durch die Wärmedosis, die ein korrekt angesetztes Reagenzglas mit geeigneter Probe im Wasserbad erhält.

Fachliche Einzelheiten: [docs/CHEMIE.md](docs/CHEMIE.md).

## Tests

```bash
npm test            # 45 Unit-Tests (Node, ohne Abhängigkeiten)
npm run build       # statischer Build + Prüfung auf externe Ressourcen/absolute Pfade
npm install         # einmalig für die Browser-Tests (Playwright)
npm run test:e2e    # 26 Browser-Prüfungen, schreibt Screenshots nach docs/screenshots/
```

Für die Browser-Tests wird Chromium benötigt (`npx playwright install chromium`, falls nicht vorhanden). Ergebnisse: `tests/e2e/results.json`, Bericht: [docs/TESTBERICHT.md](docs/TESTBERICHT.md).

## Datenschutz

Keine Anmeldung, keine Server, keine externen Dienste, keine Analyse-Skripte. Protokolleinträge und Modus werden nur im `sessionStorage` des eigenen Browsers abgelegt und beim Schließen des Tabs verworfen.

## Technische Einschränkungen

- **iPad:** Touch-Bedienung und Tablet-Layout sind in Chromium mit Touch-Emulation (1180×820, 1024×768) geprüft, aber **nicht auf einem echten iPad mit Safari**. Dieser Gerätetest ist offen.
- **mebis/SCORM:** nicht Teil dieses Auftrags; die App ist für den Import vorbereitet (statisch, relative Pfade, keine externen Ressourcen), aber nicht in mebis getestet.
- **Zeitraffer:** Reaktionen laufen in 10–25 s statt in Minuten ab. Mengen sind abstrakte „Portionen“ – die Anwendung ist keine Herstellungs- oder Dosieranleitung.
- **Darstellung:** 2,5D-Canvas-Grafik statt physikalischer Strömungs- oder Lichtsimulation; das Absetzen von Cu₂O ist vereinfacht.
- Glucose/Fructose (Expertenmodus) sind nicht umgesetzt.
- Sehr alte Browser ohne `CanvasPattern.setTransform` zeigen die Trübungstextur gröber; die Funktion bleibt erhalten.
