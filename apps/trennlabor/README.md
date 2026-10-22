# SiVex · Virtuelles Trennlabor 1.0

Ein frei bedienbares 2D-Labor für Chemie NTG 8 / SG 9. Statisch, offline, ohne Konten oder externe APIs. **Status `prototype`** bis zur schulpraktischen Freigabe. Technische Prüfergebnisse und vollständige Kriterienmatrix: [Testbericht](docs/TESTBERICHT.md).

## Enthaltene Aufgaben

| Aufgabe | Inhalt |
| --- | --- |
| K-01 | Sand/Wasser: Sedimentieren, Dekantieren oder Filtrieren; trübes Dekantat korrigieren |
| K-02 | Sand/Kochsalz: selektiv lösen, filtrieren, Filtrat eindampfen; festes Salz gewinnen |
| K-03 | Eisen/Sand/Kochsalz: Magnettrennung mit Extraktion, Filtration und Eindampfen kombinieren |
| K-04 | Öl/Wasser: Scheidetrichter, Hahn, Phasengrenze, wechselnde Auffanggefäße |
| K-05 | Hibiskustee: temperaturabhängige Extraktion und Pflanzenreste abtrennen; Tee bleibt Gemisch |
| Chromatographie | Sieben definierte Proben, Wasser und Ethanol/Wasser 60:40, bis zu drei Proben nebeneinander, Vergleichsarchiv, optional Rf |
| Destillation | Ethanol/Wasser (30 Massen-% Ethanol), eigener Aufbau, gekoppeltes Heiz-/Kühlmodell, gut ablesbare Dampftemperatur, getrennte virtuelle Brennprobe |

## Sofort starten

`index.html` direkt im Browser öffnen. Alle Ressourcen liegen lokal, klassische Skripte funktionieren auch per `file://`. Oder im Verzeichnis `apps/trennlabor/`:

```sh
node scripts/serve.mjs . 8080
```

Dann im Browser `http://localhost:8080/` öffnen. Der Entwicklungsserver bindet nur an den lokalen Rechner. Zum Verteilen den statischen Build auf einem Webserver bereitstellen oder das SCORM-Paket hochladen. Keine serverseitige Node-Laufzeit im Schulbetrieb nötig.

## Bedienkonzept

Bereich und Aufgabe wählen. Einklappbare Gerätegruppen enthalten alle Handlungen als beschriftete Buttons, Auswahlfelder oder Schalter. Geräte werden durch Auswahl an ihren geeigneten Bühnenpositionen aufgestellt; es gibt keine versteckten Trefferzonen. Gefäße lassen sich frei als Quelle und Ziel wählen; mehrere sinnvolle Reihenfolgen sind möglich. Die Bühne zeigt tatsächliche Mengen, Phasen und zeitliche Vorgänge. Pause und 1×/4×/10× ändern nur die Zeitsteuerung.

Beobachtungen, Zonenzahl bzw. Messwert und Fachbegriffe selbst eingeben. Richtige Antworten und Entwürfe bleiben bei Fehlern erhalten. Genau drei Hilfezustände: keine, kleine, konkrete Hilfe. Nach wiederholten Fehlern wird Hilfe angeboten. Erst nach erreichtem Trennziel und korrekter Auswertung werden Theorieabschnitte und ein vollständiger Muster-Hefteintrag freigeschaltet. Diesen schreiben Lernende selbst ins Heft. Ein abgeschlossener Versuch bleibt mit Beobachtungszeitpunkt gespeichert.

Sitzungsdaten liegen ausschließlich im Browser-`sessionStorage`; kein dauerhafter LMS-Speicher. Wechsel und Schließen eines Panels erhalten Zustände und Entwürfe. „Aktuellen Versuch neu beginnen“ erneuert nur den gewählten Ansatz; abgeschlossene Einträge und andere Versuche bleiben erhalten. Bei der Chromatographie bleibt das Vergleichsarchiv bestehen.

[Bedienhinweise](docs/BEDIENUNG.md) · [Fachmodell und Quellen](docs/CHEMIE.md) · [Architektur-/Prüfplan](docs/PLAN.md)

## Release-Pakete

- [Web-ZIP](release/trennlabor-1.0.0-web.zip): entpacken, `trennlabor/index.html` öffnen oder gesamten Unterordner auf einem statischen Server bereitstellen.
- [SCORM 1.2](release/trennlabor-1.0.0-scorm12.zip): unverändert in mebis als „Lernpaket (SCORM)“ hochladen; Darstellung „Neues Fenster“ wählen. `imsmanifest.xml` liegt im ZIP-Stamm.
- [SHA-256-Prüfsummen](release/SHA256SUMS.txt).

Der Adapter verwendet nur `LMSInitialize` und `LMSFinish`. Er liest/schreibt keine Noten, Schülerdaten oder Fortschritte. Ohne LMS bleibt er inaktiv. Beide tatsächlich erzeugten ZIPs werden für die Paketprüfung entpackt und im Browser bedient.

## Entwicklung und Tests

Node.js ≥18; Python ≥3.10 für die ZIP-/XML-Prüfung. Keine Laufzeitabhängigkeiten. Einmalig für Browserprüfungen: `pnpm install --frozen-lockfile` (alternativ `npm install`), dann `node node_modules/playwright/cli.js install chromium`. Mit vorhandenem Browser alternativ `PW_CHANNEL=msedge` oder `chrome` setzen. Der eingecheckte pnpm-Lock fixiert die Testabhängigkeit Playwright 1.56.1.

Im App-Verzeichnis:

```sh
node --test tests/unit/*.test.js
node tests/e2e/run.mjs
node scripts/package.mjs
node tests/e2e/packages.mjs
```

Die gleichen Befehle sind als `npm test`, `npm run test:e2e`, `npm run package`, `npm run test:scorm` hinterlegt. `package.mjs` baut die statischen Dateien und beide ZIPs deterministisch mit festen Zeitstempeln. Tests starten eigene lokale Server auf 8181 bzw. 8282. Browserprüfungen bedienen echte HTML-Kontrollen, nicht interne Modell-APIs; nur die Browseruhr beschleunigt die reguläre Animationsschleife. Sie laufen auf Desktop und Tablet mit Touch-Emulation, speichern Screenshots sowie JSON-Rohberichte unter `tests/e2e/`. Vollständige Testumgebung und Ergebnisse siehe Testbericht.

## Aufbau und Grenzen

`js/chemistry.js`: Stoffmodelle ohne DOM. `js/lab.js`: Aktionen, feste Zeitschritte, Ziele, Hilfe, Antworten und eingefrorene Erfolgsprotokolle. `js/render.js`: ausschließlich zustandsabhängige SVG-Ausgabe. `js/ui.js`: Bedienung, Sitzungsdaten und Animationsschleife. `js/scorm.js`: bestehender minimaler SiVex-Adapter. Build-/ZIP-Skripte vom Redoxlabor übernommen und auf dieses App-Verzeichnis begrenzt. Die TitraLab-3-Releases wurden als visuelle/strukturelle Referenz eingesehen, kein ungeprüfter Quellcodeimport.

Vereinfachte Stoff-, Zeit-, Retentions-, Kühl- und Gemischmodelle; keine Forschungssimulation und keine Vorhersage realer Ausbeuten. In der Destillation keine Azeotropie. Beim Tee keine Reinheitsbehauptung, bei einer Bande kein allgemeiner Reinheitsbeweis und bei der Brennprobe kein Reinheits-/Gehaltsnachweis. Details sind im Fachmodell offengelegt.

Echte Schul-Tablets/Safari, realer mebis-Kurs und Unterrichtserprobung sind nachgelagerte Lehrkraftprüfungen; sie blockieren den technischen Entwicklungsabschluss nicht.
