# Testbericht TitraLab 3 – Version 3.1.0

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
| iPad-Safari (echtes Gerät), mebis-Import, Lerngruppe | **HOLD – unverified** | durch die Lehrkraft zu prüfen; bis dahin bleibt 3.0 das Paket im Einsatz |

Sichtprüfung der Screenshots: Im hellen Schema sind Glaskonturen, Skala, Meniskus, Etiketten und Lupe lesbar; Indikatorfarbe im Kolben und pH-Anzeige unverändert. Im dunklen Schema entspricht die Darstellung v3.

Bekannte Grenzen: Die Trennlinie zwischen Apparatur und Kurve gibt es nur ab 900 px Breite. Die Werkzeugleiste der Kurve bricht in der schmalen Spalte auf zwei Zeilen um (beabsichtigt). SCORM-Manifest jetzt mit `scormtype="sco"` wie bei den übrigen Apps (v3: `asset`); beide Varianten laufen in mebis, der mebis-Import von 3.1.0 ist aber noch nicht erneut geprüft.

---

## 3 (23.10.2026) – Praxistest durch die Lehrkraft

Von der Lehrkraft auf einem iPad mit Safari (iPadOS 26.6.2) sowie in Edge und Firefox (Windows 11) geprüft: funktionsfähig, bedienbar, gut erkennbar; Einbindung in mebis (Darstellung „Neues Fenster“) bestätigt. Befund: Für die zuschaltbare Titrationskurve unter dem Laboraufbau bleibt auf dem iPad zu wenig Raum, die pH-Achse ist stark gestaucht → behoben in 3.1.0.
