# Fällungslabor 1.1.0 – Silberhalogenide und Ionennachweise

**Status: prototype** – entwicklungsseitig vollständig und paketiert; Prüfung auf einem echten iPad, mebis-Import und fachliche Abnahme durch die Lehrkraft stehen aus ([Testbericht](docs/TESTBERICHT.md)). Nicht für den Unterricht freigegeben.

**Neu in 1.1.0** ([CHANGELOG](CHANGELOG.md)): größere, gruppierte Flaschenetiketten ohne Konzentrationsangaben (Konzentration in der Infokarte), „− Glas“, sichtbares Ausgießen in den Behälter „Silberabfälle“, schneller sichtbares Auflösen mit Ammoniak (Gleichgewichte unverändert), dieselbe Probe darf nachgegeben werden, Antworten je Durchgang gemischt.

Die Lernenden geben Silbernitratlösung tropfenweise zu Natriumchlorid-, Natriumbromid- und Natriumiodidlösung, sehen am Eintreffpunkt jedes Tropfens eine Wolke entstehen, die sich verteilt und absetzt, schwenken, vergleichen die Farben und prüfen in einer Erweiterung die Löslichkeit in verdünnter und konzentrierter Ammoniaklösung. Ein unabhängiger Kontrollteil zeigt Positivkontrolle, Blindprobe sowie Leitungs- und Mineralwasser. Auswahlaufgaben (Beobachtungen, Zuschauerionen, vollständige Ionengleichungen, Ammoniak; Kontrollen getrennt) mit Hilfe in drei Stufen und Lösung auf Anforderung; kurzer Hefteintrag jederzeit.

Jahrgangsstufen 8 (NTG, LehrplanPLUS LB 4: Ionennachweise durch Fällungsreaktionen) und 9 (Ionen und Salze, als Ergänzung); Ammoniak als Erweiterung. Fachmodell: [docs/CHEMIE.md](docs/CHEMIE.md) · Bedienung: [docs/BEDIENUNG.md](docs/BEDIENUNG.md) · Quellen und Sicherheitsdatenblätter: [docs/QUELLEN.md](docs/QUELLEN.md) · Entscheidungen: [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).

## Artefakte (release/)

| Datei | Zweck |
| --- | --- |
| [`faellungslabor-1.1.0.html`](release/faellungslabor-1.1.0.html) | eine einzelne Datei – per Doppelklick öffnen, läuft offline |
| [`faellungslabor-1.1.0-web.zip`](release/faellungslabor-1.1.0-web.zip) | statische Web-App (Ordner `faellungslabor/` mit `index.html`) für Webserver oder lokal |
| [`faellungslabor-1.1.0-scorm12.zip`](release/faellungslabor-1.1.0-scorm12.zip) | SCORM-1.2-Lernpaket für mebis |
| [`SHA256SUMS.txt`](release/SHA256SUMS.txt) | Prüfsummen der drei Dateien |

### mebis (Lehrkraft)

1. Im Kurs „Aktivität oder Material anlegen“ → „Lernpaket (SCORM)“, die Datei `faellungslabor-1.1.0-scorm12.zip` hochladen.
2. Unter „Darstellung“ → „Lernpaket anzeigen“: **„Neues Fenster“** (bevorzugt, mehr Platz). Eingebettet läuft die App grundsätzlich auch.
3. Es werden keine Noten, Antworten, Fortschritte oder personenbezogenen Daten an mebis übertragen; die App meldet sich nur an und ab (LMSInitialize/LMSFinish).

Der tatsächliche Import in mebis wurde weder für 1.0.0 noch für 1.1.0 durchgeführt (FL33/FK20: HOLD – unverified). Hinweise: [docs/MEBIS.md](../../docs/MEBIS.md).

### Hinweise für die Lehrkraft

- Konzentrationen (auf der Bühne nicht angeschrieben, in der Infokarte jeder Flasche): AgNO₃ und NaCl/NaBr/NaI je 0,100 mol/L; Ammoniaklösung verdünnt 2,0 mol/L, konzentriert 25 % (≈ 13,3 mol/L); Tropfen 0,050 mL; Reagenzglas 20 mL. Die Lernenden müssen nichts berechnen.
- Ob sich ein Niederschlag löst, hängt im Modell – wie im Realversuch – von der Menge Ammoniaklösung und vom Halogenidüberschuss ab. Sehr wenig Silberbromid (1–2 Tropfen AgNO₃) kann sich auch in viel verdünnter Ammoniaklösung lösen; mit 5–10 Tropfen und üblichen Mengen zeigt sich die erwartete Abstufung.
- Leitungs- und Mineralwasser sind feste Modellproben; das Labor behauptet nicht, dass jedes Wasser so reagiert, und lässt keine Halogenidzuordnung zu.
- Keine Lichtzersetzung, kein Ansäuern, keine Carbonat- oder Salpetersäureflasche (nur als freiwillige Erläuterung im Kontrollteil).

## Entwicklung

Voraussetzungen: Node.js ≥ 20 (geprüft mit 22.23), für Browsertests Playwright 1.56.1 mit einem Chromium-basierten Browser (Edge, Chrome oder `npx playwright install chromium`; ein anderer Browser über `PW_EXECUTABLE=/pfad/zum/browser`).

```sh
cd apps/faellungslabor
npm ci                # Playwright (nur für Tests)
npm test              # Unit-/Modelltests (Node, ohne Browser)
npm run build         # statischer Build dist/faellungslabor + Prüfung (externe Ressourcen, Versionen)
npm run package       # Build + release/: Einzeldatei, Web-ZIP, SCORM-ZIP, SHA256SUMS.txt
npm run test:e2e      # Browserprüfung auf dem frisch entpackten Web-ZIP: E01–E21 und Korrekturfälle FK01–FK19 (nach package)
npm run test:scorm    # Einzeldatei, Web-ZIP (file:// und HTTP), SCORM-Struktur, Mock-LMS, Paketidentität
npm run test:all      # alles in dieser Reihenfolge; Abbruch mit Fehlerstatus beim ersten Fehler
npm start             # Entwicklungsserver http://localhost:8080 (Quellstand)
```

Laufzeit `test:all` etwa 12–15 Minuten. Ergebnisse: `tests/e2e/results.json` (E01–E21), `tests/e2e/korrektur-results.json` (FK01–FK19), `tests/e2e/scorm-results.json`, Screenshots in `docs/screenshots/`, Messwerte in `docs/evidence/`.

Aufbau: klassische Skripte ohne ES-Module und ohne `fetch` (dadurch auch per `file://` lauffähig). `js/chem.js` (Gleichgewichte), `js/geometry.js`, `js/model.js` (Ansätze, Pipette, Tropfen, Grenzen der Anleitung – alles ohne DOM), `js/tasks.js` (Aufgaben, Hefteintrag), `js/ghs.js`, `js/render.js` (Canvas: Grundebene und Bewegungsebene), `js/ui.js` (Bedienfeld), `js/app.js` (Bühne, Eingaben, Speicher). Labkit 0.3.0 unverändert.
