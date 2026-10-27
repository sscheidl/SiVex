# Pufferfish 0.1.0 – Testbericht

Stand 27.10.2026 · Labkit 0.1.1 · Status **prototype**

Statusregeln nach [`docs/QUALITY.md`](../../../docs/QUALITY.md): **PASS** = geprüft, Nachweis dokumentiert · **HOLD – unverified** = Prüfung nicht möglich bzw. nicht durchgeführt.

## Zusammenfassung

| Bereich | Ergebnis | Nachweis |
| --- | --- | --- |
| Unit-Tests Modell, Zustand, Bewertung (+ Labkit) | PASS 36/36 | `npm test`, Abschnitt 1 |
| Browserprüfung Edge (Desktop 1440×900, Tablet-Emulation 1180×820 und 1024×768) | PASS 17/17 | `tests/e2e/results.json`, Abschnitt 2 |
| Pakete: SCORM 1.2 (Mock-LMS eingebettet/neues Fenster), Web-ZIP über HTTP und file://, frisch entpackt | PASS 17/17 | `tests/e2e/scorm-results.json`, Abschnitt 3 |
| Visuelle Kontrolle der Screenshots | PASS | `docs/screenshots/`, Abschnitt 4 |
| Echtes iPad (Safari) | **HOLD – unverified** | nicht durchgeführt |
| mebis-Import (ByCS) | **HOLD – unverified** | nicht durchgeführt; nur Mock-LMS |
| Fachliche Freigabe durch die Lehrkraft | **HOLD – unverified** | ausstehend |

Ohne iPad-, mebis- und Lehrkraftprüfung bleibt der Status `prototype`.

## 1. Unit-Tests (`npm test`)

**Modell gegen unabhängige Referenzen** (`tests/unit/chem.test.js`, 13 Tests) – Erwartungswerte aus geschlossenen Formeln, nicht aus dem Solver:

- Wasser nach HCl/NaOH: exakte quadratische Lösung h² − c·h − Kw = 0 (Abweichung < 10⁻⁹); ein Tropfen HCl in 30 mL → pH 3,779.
- Essigsäure 0,100 mol/L (schwache-Säure-Näherung, pH 2,88), Natriumacetat 0,100 mol/L (K_b = Kw/Kₛ).
- Acetatpuffer 1 : 1, 10 : 1, 1 : 10 und zehnfach verdünnt: exakte quadratische Lösung h² + (C_b + Kₛ)h − Kₛ·C_a = 0.
- Bekannter Zugabefall (Aufgabe 4): formal 4,00/6,00 mmol, H-H und Modell pH 4,574.
- Phosphat: Ladungs- und Massenbilanzresiduen (relativ < 10⁻⁹) für 0–60 mL HCl/NaOH, keine negativen Spezies; Anfangs-pH 7,20; jenseits von 15 mL HCl wirkt die erste Stufe (formal 0,75/2,25 mmol bei 22,5 mL).
- Ganze Zugabekurven (600 × 0,05 mL) für sechs Proben und beide Reagenzien: monoton, endlich, Volumen korrekt; Pufferwirkung beginnt sofort (keine künstliche Konstanz) und nimmt zur Erschöpfung hin ab.
- Verdünnung: gleicher Anfangs-pH, zehnfach verdünnt hergestellt > 10-fache Änderung, aufgefüllte Probe ≈ gleiche Änderung.
- Grenzfälle: großer Laugenüberschuss (pH > 12,9, nicht geklemmt), ungültige Eingaben, H-H gibt bei fehlendem Partner `null`.
- Reaktionsweg: Gemisch + HCl → schwaches System; Wasser + NaOH → frei; angesäuertes Wasser + NaOH → H₃O⁺ + OH⁻; Phosphat + NaOH → Stufe 2; nach Erschöpfung → frei.

**Zustandsablauf** (`tests/unit/engine.test.js`, 10 Tests): erst Ankunft, dann Mischphase, dann Messpunkt; gleiche Zugaben im Vergleichsmodus; Doppelklick erzeugt keine zweite Dosierung; Säure-/Laugenreihe getrennt; Gegenprobe gekennzeichnet; frische Probe, Ansatz ändern, neue Reihe; Weiterdosieren bis zum vollen Glas ohne NaN; Pause und kleine/große Zeitschritte liefern identische Messwerte; Speichern mitten in einer Zugabe und Wiederherstellen.

**Bewertung** (`tests/unit/learn.test.js`, 8 Tests): Dezimalkomma, „2 : 1“, „10^0,3“; alle sechs Aufgaben mit Rundungstoleranz; falscher Quotient, nicht aufgelöster Logarithmus, Stöchiometriefehler, falsche Einheit (mol statt mmol, mol/L) jeweils getrennt erkannt; Stammlösungsfalle in der Herleitung; Beobachtungen nur mit eigener Messung „belegt“; Freitext wird nicht bewertet.

Labkit-Tests (5) laufen mit.

## 2. Browserprüfung (`npm run test:e2e`)

Edge 156.0.4314.50 über Playwright 1.56.1, gegen den gebauten Stand `dist/pufferfish`. Die Tests bedienen nur die Oberfläche (Klicks, Tipps, Tastatur); der Modellzustand wird ausschließlich gelesen. Ergebnis des letzten Laufs: **17/17 PASS** (`tests/e2e/results.json`).

| ID | Prüfung | Ergebnis |
| --- | --- | --- |
| E01 | Logo pumpt sich beim Start auf (Skalierung 1,31), endet wieder, per Klick und Enter erneut auslösbar; Logo-Box und Kopfzeile ändern ihre Größe nicht; mit `prefers-reduced-motion` keine Animation | PASS |
| E02 | Versuch 1: Dosieren erst nach Vermutung (oder bewusstem Überspringen); Tropfen im Flug ohne Gleichgewichtsanzeige; Glas A vor Glas B; Mischstatus und Indikatorschliere nach Ankunft; Messwerte = Modell (Wasser 3,779, Phosphat 7,197); 1 + 5 Tropfen + 1 mL ergeben 8 Messpunkte | PASS |
| E03 | Laugenreihe beginnt mit frischen Proben; Säurereihe bleibt erhalten; Gegenprobe im Titel und Hinweis gekennzeichnet; im angesäuerten Wasser Zeitlupe H₃O⁺ + OH⁻ → 2 H₂O | PASS |
| E04 | Wunderwasser-Teilchenansicht bis zur Deutung gesperrt; Beobachtung gegen eigene Messreihen bewertet; Zeitlupe H₂PO₄⁻ + OH⁻ (Annäherung, Übertragung, Produkte als drei verschiedene Bilder) und HPO₄²⁻ + H₃O⁺; Bestand HPO₄²⁻ 12 → 16 Symbole bei konstanter Gesamtzahl 24; Volumen 35,05 mL | PASS |
| E05 | Versuch 2, Säure und Lauge: Messwerte = Modell; Reaktionswege (Essigsäure + HCl frei, Acetat + HCl umgesetzt, Essigsäure + NaOH umgesetzt, Acetat + NaOH frei); Zeitlupe abschaltbar ohne Einfluss auf Messung; Startwerte 2,88 / 8,88 / 4,75 | PASS |
| E06 | Versuch 3: 13 × 5 mL bis „zu voll“, keine NaN, monoton; 10 : 1 endet bei pH 1,18 (Säureüberschuss); „Ansatz ändern“ legt neuen Ansatz an | PASS |
| E07 | Versuch 4: ΔpH bei 1 mL HCl 0,058 / 0,676 / 0,058 (unverdünnt / zehnfach verdünnt hergestellt / aufgefüllt) | PASS |
| E08 | Doppelklick + Klick → genau eine Zugabe; Reihenwechsel während der Zugabe abgewiesen; Pause friert Tropfen und Zeit ein; Dosieren in der Pause abgewiesen; „Schritt“ = 0,2 s | PASS |
| E09 | Neuladen stellt Messreihen, Antworten (inkl. Freitext), Auflösung und Einstellungen wieder her; keine halbe Zugabe | PASS |
| E10 | Herleitung vor der Deutung gesperrt; falsche Eingaben markiert, Tipp 1/3; alle sieben Schritte gelöst; danach pKₛ-Schalter und formale Stoffmengen im Labor | PASS |
| E11 | Rechenweg nur nach Rückfrage; falscher Quotient, nicht aufgelöster Logarithmus, Einheit, Stöchiometrie getrennt erklärt; alle sechs Aufgaben mit Dezimalkomma und gemischten Einheiten richtig; danach Anwendungen frei | PASS |
| E12 | Journal-Export enthält Vermutung und Messdaten, keine Musterlösung; Hefteintrag 126 Wörter; Anwendungen vor den Rechnungen gesperrt, vier Fälle mit Rückmeldung | PASS |
| E13 | 1180×820, **Emulation** mit Touch: kein Querscrollen, Labor und Teilchenansicht sichtbar, Bedienelemente ≥ 40 px (Dosier-/Zieltasten 44 px), Kurve per Scrollen erreichbar ohne Zurücksetzen | PASS |
| E14 | 1024×768, **Emulation** mit Touch: wie E13, zusätzlich Herleitung und Aufgaben ohne Querscrollen | PASS |
| E15 | Tab + Enter dosiert; Trennlinie mit Pfeiltaste +24 px, Doppelklick setzt zurück | PASS |
| NET | 255 Anfragen, alle lokal | PASS |
| CON | keine Konsolen- oder Seitenfehler | PASS |

Hinweis: Die Tablet-Prüfung ist eine Geräteemulation in Edge, kein Test auf einem echten iPad.

## 3. Pakete (`npm run test:scorm`)

Beide ZIPs werden frisch in leere Temp-Ordner entpackt und von dort über HTTP gestartet; der Quellcodeordner wird nicht benutzt. Ergebnis: **17/17 PASS** (`tests/e2e/scorm-results.json`).

- `imsmanifest.xml` im Paketstamm, SCORM 1.2, SCO mit Startpunkt `index.html`; Manifest listet alle 16 Dateien (inkl. `labkit/`); alle 14 Verweise relativ und vorhanden.
- Mock-LMS eingebettet (iframe) und „Neues Fenster“: `LMSInitialize` genau einmal, `LMSFinish` beim Schließen genau einmal, keine `LMSGetValue`/`LMSSetValue`/`LMSCommit`; Versuch über die Oberfläche bedient, Messwerte korrekt; keine Konsolenfehler, keine externen Anfragen.
- Web-ZIP über HTTP und per `file://` bedienbar, keine fremden Anfragen; alle 45 Ressourcenanfragen aus den entpackten Paketen bedient.

| Paket | Größe | SHA-256 |
| --- | --- | --- |
| `release/pufferfish-0.1.0-web.zip` | 78,3 KiB | `7321adf2a693d7f7fbe13ddd4ab0c3eeb1009cd635d267fe6b6b57315ed930c9` |
| `release/pufferfish-0.1.0-scorm12.zip` | 78,6 KiB | `0544f2db6c1d97a6096e3b988a7565ce17df69f99dbbb8473e110b2e554471ff` |

## 4. Visuelle Kontrolle

Alle Screenshots wurden nach dem letzten Lauf angesehen. Desktop 1440×900: Labor, Tropfen im Flug (`03`), Schliere beim Mischen (`04`), Kurve (`05`), Zeitlupe Annäherung/Protonenübertragung/Produkte (`06`–`08`, Phosphat + OH⁻) und Säure → Phosphat (`09`), Versuche 2–4 (`10`–`13`), Herleitung (`14`, `15`), Labor nach der Herleitung mit pKₛ-Band und formalen Stoffmengen (`16`), Aufgaben-Rückmeldung (`17`, `18`), Hefteintrag (`19`), Anwendungen (`20`). Tablet-Emulation: `21` (1180×820), `22`–`24` (1024×768: Labor, Herleitung, Aufgaben). Logo im aufgepumpten Zustand: `01`.

Befunde während der Entwicklung (behoben und gezielt nachgeprüft):

| Befund | Behebung |
| --- | --- |
| Teilchenansicht des Wassers fälschlich gesperrt (`undefined` statt `false`) | Sperrstatus als Boolean |
| Laborbühne zu klein, Bedienleiste zu hoch, Diagramm abgeschnitten | Messwerte in die Probenkarten verlegt, Bühne oben beschnitten, Dosierleiste auf drei Zeilen |
| Zeitlupe: Phase, Teilchen und Gleichung überlagert | drei getrennte Bänder, schmale Variante bei < 250 px |
| Indikatorschliere im 400-mL-Glas länger sichtbar als die Mischphase | Schliere an dieselbe Zeitkonstante wie den Messwert gekoppelt |
| Symbole blieben in der Pause halb eingeblendet | Ein-/Ausblenden in Echtzeit (nur Optik) |
| Anzeigeschilder überlappten bei 1024 px | kompakte Schilder (Buchstabe + pH) bei kleinem Maßstab |
| Richtige Antwort stand in mehreren Auswahlfeldern stets an erster Stelle | feste, gemischte Reihenfolge je Feld |
| Auswahlfelder der Gleichung in Herleitungsschritt 1 untereinander | in einer Zeile |

## 5. Offene Punkte

1. **iPad mit Safari** (echtes Gerät, Touch, „Neues Fenster“ aus mebis): nicht geprüft. Die Tablet-Prüfung oben ist eine **Emulation** in Edge.
2. **mebis-Import** des SCORM-Pakets: nicht geprüft (nur Mock-LMS).
3. **Fachliche Durchsicht** durch die Lehrkraft, insbesondere Formulierungen der Protokoll- und Anwendungsfragen sowie die Wahl der Simulationsparameter.
4. Die optionale zweite Darstellung pH gegen Anteil A⁻/(HA + A⁻) und der optionale Rätselmodus „Unbekannte Probe“ sind nicht umgesetzt (laut Auftrag optional).
5. Die zentrale Übersicht (`README.md`, `docs/ARCHITECTURE.md` im Repository-Stamm) ist bewusst nicht geändert, um Konflikte mit parallelen App-PRs zu vermeiden; die Zeile wird nach dem Merge separat nachgetragen.
6. Kein Service Worker: Die App läuft aus dem Paket offline; ein eigener Cache ist nicht nötig.
