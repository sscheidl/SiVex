# Halbtitrationslabor – pKₛ- und pK_B-Werte experimentell bestimmen

**Status: prototype 0.1.0** · Chemie Q13 (eA), LehrplanPLUS Gymnasium Bayern, Lernbereich 3 · statische Browseranwendung ohne Backend, Konto oder Netzzugriff

![Labor mit Erstdurchgang der Phosphorsäure](docs/screenshots/3-phosphorsaeure-1-erstdurchgang.png)

Die Schülerinnen und Schüler leiten die Halbtitration theoretisch her und planen den Versuch: Maßlösung, Äquivalenzpunkt, Indikator. Sie titrieren selbst mit Bürette und kalibrierter pH-Elektrode. Die Titrationskurve wächst dabei nur aus ihren eigenen Messpunkten. Aus der Kurve bestimmen sie Äquivalenzpunkte, rechnen das Zielvolumen aus und halbtitrieren eine frische Probe gezielt. Aus dem gemessenen pH-Wert bestimmen sie den pK-Wert.

Erst nach der Abgabe des eigenen Ergebnisses werden Literaturwerte und Modellreferenz freigeschaltet. Damit berechnen die SuS theoretische pH-Werte und werten Abweichungen aus.

| Versuch | Probe + Maßlösung | Schwerpunkt |
| --- | --- | --- |
| 1 | Essigsäure + NaOH | grundlegender Ablauf, pKₛ |
| 2 | Ammoniak + HCl | fallende Kurve, pOH ≈ pK_B, pKₛ(NH₄⁺) ≠ pK_B(NH₃) |
| 3 | Phosphorsäure + NaOH | zwei Stufen, V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)]/2, Näherungsgrenze am HÄP 1 |
| 4 | Glycinhydrochlorid + NaOH | zwei pKₛ-Werte, Kation → Zwitterion → Anion, abgeleitetes V(ÄP,2) |

Nicht enthalten ist eine Lerneinheit zu Pufferwirkung, -kapazität oder -herstellung; dafür ist die App „Pufferfish“ vorgesehen.

## Start

- **Ohne Installation:** Web-ZIP aus `release/` entpacken und `halbtitration/index.html` öffnen. Das funktioniert auch per `file://` und offline.
- **mebis:** `release/halbtitration-0.1.0-scorm12.zip` als „Lernpaket (SCORM)“ hochladen, Darstellung „Neues Fenster“ (siehe [`docs/MEBIS.md`](../../docs/MEBIS.md)). Es werden keine Noten, Fortschritte oder Personendaten übertragen.
- **Entwicklung:** `npm start`, dann http://localhost:8080/

```bash
npm install            # nur für Browserprüfungen: Playwright 1.56.1, nutzt das installierte Edge
npm test               # Modell- und Auswertungstests (node --test)
npm run build          # dist/halbtitration/ mit Prüfung auf externe Ressourcen und fehlende Dateien
npm run package        # release/: Web-ZIP, SCORM-1.2-ZIP, SHA256SUMS.txt (reproduzierbare Zeitstempel)
npm run test:e2e       # Browserprüfung, Screenshots in docs/screenshots/ (ONLY=E1,E8 für Auswahl)
npm run test:packages  # beide ZIPs frisch entpacken, über HTTP starten, SCORM mit Test-LMS
```

Playwright ohne Browser-Download installieren: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`.

## Aufbau

```text
index.html, css/app.css
js/model/       chemistry.js (Gleichgewichtssolver), indicators.js, evaluation.js (Rechenprüfung), format.js
js/experiment/  lab.js (Bürette, Tropfen, Mischung, Elektrode – ohne DOM)
js/view/        geometry.js, lab-renderer.js (aus TitraLab 3), chart.js (Titrationskurve)
js/ui/          content.js (Texte, Hilfen), store.js (lokale Speicherung), app.js (Ansichten, Labor), journal.js (Auswertung, Bericht)
js/scorm.js     minimaler SCORM-1.2-Adapter (nur LMSInitialize/LMSFinish)
tests/unit/     Modelltests mit unabhängigen Referenzrechnungen
tests/e2e/      Browserabläufe (run.mjs), Paketprüfung (packages.mjs)
docs/           CHEMIE.md, BEDIENUNG.md, TESTBERICHT.md, UEBERNAHME.md, screenshots/
```

## Herkunft

Laboraufbau, Tropfen, Meniskus, Ablese-Lupe, Schlieren und Trennlinie stammen aus **TitraLab 3** (`apps/titration/release/SiVex-Titration-Claude-v3-web.zip`). Sie sind auf die helle SiVex-Oberfläche umgestellt und erweitert. Build-, Paket- und SCORM-Skripte kommen aus dem Redoxlabor. Einzelheiten stehen in [`docs/UEBERNAHME.md`](docs/UEBERNAHME.md).

Die App hat keinen Service Worker und deshalb keine Cache-Kollision mit TitraLab 3.

## Bekannte Grenzen

- Ideales Konzentrationsmodell (Aktivitäten = Konzentrationen) mit thermodynamischen Konstanten (Martell & Smith, 25 °C, I = 0). Reale Messungen liefern wegen der Ionenstärke etwas kleinere pKₛ-Werte; siehe [`docs/CHEMIE.md`](docs/CHEMIE.md).
- Kein Zufallsrauschen und kein optionaler Fehlermodus. Abweichungen entstehen nur durch eigene Handlungen.
- Die Prüfung der pH-Erwartung in der Planung ist qualitativ. Die quantitative Indikatorbewertung folgt an der eigenen Kurve.
- Getestet mit Edge (Chromium) unter Windows 11, Tablet-Größen nur emuliert. **iPad-Safari und mebis sind noch nicht geprüft** (siehe [`docs/TESTBERICHT.md`](docs/TESTBERICHT.md)).
