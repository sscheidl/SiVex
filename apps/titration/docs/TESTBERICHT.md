# Testbericht TitraLab 3 – Version 3.2.1

## 3.2.0 / 3.2.1 (09.11.2026) – Durchmischung / sichtbarer pH

Umgebung wie 3.1.0 (Linux-Container, Node.js 22.23.4, Chromium über Playwright 1.63, Tablet-Größen emuliert). Alle Prüfungen für 3.2.1 erneut ausgeführt. Befund der Lehrkraft zu 3.2.0 (Knicke/Stufen in der Kurve bei ungeduldiger Hahnbedienung) in 3.2.1 behoben.

| Prüffall | Status | Nachweis |
| --- | --- | --- |
| Unit-Tests (Chemie, Konfiguration, Auswertung, Farbschema, Experiment) | **PASS** 28/28 | `npm test` |
| Letzter Tropfen HCl/NaOH mit BTB: Gleichgewichts-pH springt 4,2 → 9,6, Anzeige folgt verzögert, schwingt exakt ein | **PASS** | `tests/unit/experiment.test.js` |
| Grünfenster pH 6–7,6: mit Rührer 1–3 s, ohne Rührer 3–8 s, ohne > 2× mit | **PASS** (1,75 s / 4,7 s) | Unit |
| Messkurve: je Tropfen ein eingeschwungener Punkt; Strahl auf/zu im Wechsel → Kurve monoton, jeder Punkt auf der Modellkurve, Ableitung endlich | **PASS** | Unit |
| Langsam: Endpunkt im Grün = letzter Tropfen (25,02 mL); Strahl 1 mL/s bis Grün erkannt: > 25,3 mL (übertitriert) | **PASS** | Unit |
| Echtzeit im Browser: Kolben gelb → grün (Anzeige 7,1, „mischt sich …“) → blau; Hinweis in der Auswertung | **PASS** | E9, `10-btb-gruenphase-desktop.png` |
| Regressions E1–E8 (Layout, Trennlinien, Farbschema, Ablauf, Lehrkraft) | **PASS** 8/8 | `node tests/e2e/run.mjs` |
| Pakete reproduzierbar, Build-Prüfung | **PASS** | `release/SHA256SUMS.txt`, `npm run build` |
| iPad-Safari (3.2.x), mebis-Import | **HOLD – unverified** | 3.1.0 von der Lehrkraft auf dem iPad bestätigt (Lesbarkeit, Trennlinien, Farbschema); 3.2.0 kurz geprüft (Grünphase ja, Kurve mit Stufen → 3.2.1); 3.2.1 und mebis stehen aus |

---

## 3.1.0 (09.11.2026) – Quellcode-Import, Kurve neben der Apparatur, Farbschema, Versionsanzeige

Umgebung: Linux-Container, Node.js 22.23.4, Chromium über Playwright 1.63 (headless), Tablet-Größen nur emuliert (iPad 8. Generation quer 1080 × 735 CSS-px ≈ Safari ohne Leisten, hoch 810 × 1005; Desktop 1440 × 900). Browserabläufe gegen den Build `dist/titration/`. Rohdaten: `tests/e2e/results.json`, Screenshots in `docs/screenshots/`.

| Prüffall | Status | Nachweis |
| --- | --- | --- |
| Import: Dateien des Web-Pakets v3 unverändert übernommen (Web- und SCORM-Paket bis auf `imsmanifest.xml` identisch) | **PASS** | `diff -rq` beider entpackter Pakete; erster Commit des Branches |
| Unit-Tests Chemie, Konfiguration, Auswertung, Farbschema | **PASS** 22/22 | `npm test` |
| Kopfzeile zeigt `v3.1.0` = `package.json` = `sivex.json`; Paketierung bricht bei Abweichung ab | **PASS** | E1, `scripts/package.mjs` |
| Dunkles Schema Standard, keine Konsolenfehler, keine externen Anfragen | **PASS** | E1, `01-start-dunkel-desktop.png` |
| Farbschema umschalten, Canvas (Laborwand) folgt, nach Neuladen erhalten, zurück | **PASS** | E2, `02-start-hell-desktop.png` |
| iPad quer: Kurve rechts neben der Apparatur, gleiche Höhe, Trennlinie dazwischen, Zeichenfläche ≥ 420 px (v3: ≈ 180 px), Apparatur ≥ 280 px breit | **PASS** (448 px) | E3, `03-ipad-quer-kurve-rechts.png`, `04-…-hell.png` |
| Trennlinie Apparatur/Kurve: Ziehen, Speichern, Doppelklick setzt zurück | **PASS** | E4 |
| Kurve maximieren: Apparatur ausgeblendet, Kurve füllt die Bühne; zurück; Ausblenden der Kurve räumt auf | **PASS** | E5, `05-ipad-quer-kurve-maximiert.png` |
| iPad hoch: Kurve unter der Apparatur, Trennlinie ausgeblendet, Maximieren wirkt | **PASS** | E6, `06-…`, `07-…` |
| Ablauf Durchführung → Endpunkt notieren → Auswertung → Ergebnis prüfen (hell); Kurve in der Auswertung breiter | **PASS** | E7, `08-auswertung-hell-desktop.png` |
| Lehrkraftmodus, Kurzanleitung aktualisiert | **PASS** | E8, `09-lehrkraft-dunkel-desktop.png` |
| Build-Prüfung: keine externen Ressourcen, keine absoluten Pfade, Service Worker kennt alle Dateien | **PASS** | `npm run build` |
| Pakete reproduzierbar (zweimal gebaut, gleiche SHA-256) | **PASS** | `release/SHA256SUMS.txt` |
| iPad-Safari (echtes Gerät), mebis-Import, Lerngruppe | **PASS (iPad, Lehrkraft, 09.11.2026)**: gut lesbar, Fenster dynamisch verschiebbar, Umschaltung hell/dunkel gelungen · mebis **HOLD** | |

Sichtprüfung der Screenshots: Im hellen Schema sind Glaskonturen, Skala, Meniskus, Etiketten und Lupe lesbar; Indikatorfarbe im Kolben und pH-Anzeige unverändert. Im dunklen Schema entspricht die Darstellung v3.

Bekannte Grenzen: Die Trennlinie zwischen Apparatur und Kurve gibt es nur ab 900 px Breite. Die Werkzeugleiste der Kurve bricht in der schmalen Spalte auf zwei Zeilen um (beabsichtigt). SCORM-Manifest jetzt mit `scormtype="sco"` wie bei den übrigen Apps (v3: `asset`); beide Varianten laufen in mebis, der mebis-Import von 3.1.0 ist aber noch nicht erneut geprüft.

---

## 3 (23.10.2026) – Praxistest durch die Lehrkraft

Von der Lehrkraft auf einem iPad mit Safari (iPadOS 26.6.2) sowie in Edge und Firefox (Windows 11) geprüft: funktionsfähig, bedienbar, gut erkennbar; Einbindung in mebis (Darstellung „Neues Fenster“) bestätigt. Befund: Für die zuschaltbare Titrationskurve unter dem Laboraufbau bleibt auf dem iPad zu wenig Raum, die pH-Achse ist stark gestaucht → behoben in 3.1.0.
