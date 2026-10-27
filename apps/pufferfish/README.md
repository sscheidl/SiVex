# Pufferfish – Warum bleibt der pH fast gleich?

SiVex-Lernsimulation für **Chemie Q13 (erhöhtes Anforderungsniveau)**: Pufferwirkung auf Stoff- und Teilchenebene, Herleitung und Anwendung der Henderson-Hasselbalch-Gleichung, Pufferbereich, begrenzte Pufferkapazität, Puffer in Natur und Technik. **Status: prototype 0.1.0** (Labkit 0.1.1).

![Pufferfish – Labor, Teilchenebene und Kurve](docs/screenshots/16-labor-nach-herleitung.png)

## Lernweg

**Selbst experimentieren und beobachten → Teilchenvorgänge erklären → Henderson-Hasselbalch herleiten → selbst rechnen → Anwendungen beurteilen.**

- **Pipetten-/Tropfversuch mit transparenten Bechergläsern** – keine Büretten-Titration. Tropfpipette (1 oder 5 Tropfen à 0,050 mL) und Messpipette (0,5/1,0/5,0 mL), HCl und NaOH je 0,100 mol/L. Im Vergleichsmodus erhält jedes Glas nacheinander dieselbe Zugabe.
- **Vier Versuche:** 1 Wasser oder „Wunderwasser“ (Phosphatpuffer, Zusammensetzung wird nach der eigenen Deutung aufgedeckt) · 2 Essigsäure, Natriumacetat und Gemisch · 3 Verhältnis HA : A⁻ und Weiterdosieren über die Reserve · 4 Verdünnung (zehnfach verdünnt hergestellt vs. auf 300 mL aufgefüllt).
- **Synchronisiert:** Stoffansicht (Universalindikator, Schlieren, Meniskus, Füllstand), Teilchenebene mit Protonenübertragung in Zeitlupe und die wachsende pH-Zugabekurve lesen denselben Modellzustand.
- **Herleitung** in sieben Schritten mit Tipps, **sechs Rechenaufgaben** mit getrennter Fehlerdiagnose (Quotient, Logarithmus, Stöchiometrie, Einheit), **vier Anwendungen** (Blut, Gewässer, biochemisches Labor, Messtechnik), Journal mit Druck/Export, Hefteintrag.
- Originales, code-natives **Pufferfisch-Logo** (SVG/CSS), das sich beim Start und auf Antippen aufpumpt.

## Starten

- **Web:** `release/pufferfish-0.1.0-web.zip` entpacken und `pufferfish/index.html` öffnen (auch offline, auch per `file://`).
- **mebis:** `release/pufferfish-0.1.0-scorm12.zip` als „Lernpaket (SCORM)“ hochladen, Darstellung „Neues Fenster“ ([mebis-Hinweise](../../docs/MEBIS.md)). Es werden keine Noten, Antworten oder personenbezogenen Daten übertragen.
- **Entwicklung:** `npm start` (Server auf http://localhost:8080, Labkit wird aus `shared/labkit` eingebunden).

## Entwicklung und Prüfung

```bash
npm install          # nur Playwright (Edge wird genutzt: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)
npm test             # Unit-Tests: Modell gegen unabhängige Referenzen, Zustandsablauf, Bewertung
npm run package      # Build + Web-ZIP + SCORM-ZIP + SHA256SUMS.txt in release/
npm run test:e2e     # Browserprüfung (Edge) gegen dist/pufferfish
npm run test:scorm   # Pakete frisch entpacken und über HTTP/file:// starten, Mock-LMS
```

Prüfsummen: [`release/SHA256SUMS.txt`](release/SHA256SUMS.txt)

## Dokumentation

- [Chemisches Modell, Parameter, Quellen, Korrekturen der Vorlagen](docs/CHEMIE.md)
- [Bedienhinweise](docs/BEDIENUNG.md)
- [Testbericht](docs/TESTBERICHT.md)
- [Herkunft übernommener Teile](docs/UEBERNAHME.md)

## Dateien

| Datei | Inhalt |
| --- | --- |
| `js/chem.js` | Ladungsbilanz-Solver, formale Bilanz, H-H, Reaktionsweg einer Zugabe, Indikatorfarben (ohne DOM) |
| `js/geometry.js` | Weltkoordinaten der Bühne, Bechergläser, Füllhöhe aus Volumen (ohne DOM) |
| `js/engine.js` | zentraler Zustand: Proben, Messreihen, Dosierwarteschlange, Tropfen/Strahl, Mischphase, Speichern (ohne DOM) |
| `js/learn.js` | Protokolle, Herleitung, Aufgaben mit Fehlerdiagnose, Anwendungen, Hefteintrag (ohne DOM) |
| `js/render-lab.js` | Laborbühne (Canvas) |
| `js/render-particles.js` | Teilchenebene und Zeitlupe (Canvas) |
| `js/chart.js` | pH-Zugabekurve (Canvas) |
| `js/ui.js`, `js/app.js` | Oberfläche, Seiten, Journal, Zeitschleife |
