# Testbericht Halbtitrationslabor 0.1.0

Stand 27.10.2026. Statusregeln nach [`docs/QUALITY.md`](../../../docs/QUALITY.md): **PASS**, **HOLD – failed**, **HOLD – incomplete**, **HOLD – unverified**.

**Testumgebung**

- Windows 11 Pro, Node.js 24.22.1
- Microsoft Edge (Chromium) über Playwright 1.56.1 (`channel: 'msedge'`), headless
- Tablet-Größen nur **emuliert** (Viewport + Touch-Ereignisse), kein echtes Gerät

**Prüfgegenstand**

- E2E-Läufe gegen den Build `dist/halbtitration/`
- Paketprüfung gegen die frisch entpackten ZIPs aus `release/`

**Rohdaten**

- `tests/e2e/results.json`
- `tests/e2e/packages-results.json`
- Screenshots in `docs/screenshots/`

## Gesamtbild

| Bereich | Status | Nachweis / Einschränkung |
| --- | --- | --- |
| Fachmodell und Auswertungslogik | **PASS** | 28 Unit-Tests (`npm test`), unabhängige Referenzrechnungen |
| Vollständiger Ablauf je Stoff (4 Versuche) | **PASS** | E1–E4 im Browser über die Oberfläche |
| Sonderfälle der Durchführung | **PASS** | E5–E7 |
| Animationen als Übergänge | **PASS** | E8: Zwischenzustände über 16 Einzelbilder in Echtzeit gemessen |
| Desktop 1440×900, Tablet 1180×820 und 1024×768 | **PASS (Emulation)** | E9; kein echtes iPad |
| Web- und SCORM-Paket | **PASS** | frisch entpackt, über HTTP und `file://` gestartet, SCORM mit Test-LMS |
| iPad mit Safari | **HOLD – unverified** | in dieser Umgebung nicht prüfbar |
| mebis-Import (SCORM) | **HOLD – unverified** | in dieser Umgebung nicht prüfbar |
| Fachliche Freigabe durch die Lehrkraft | **HOLD – unverified** | Datensatz und Näherungen siehe `CHEMIE.md` |

Der Status bleibt `prototype`, bis Lehrkraft, iPad und mebis die App freigegeben haben.

## 1. Fachmodell (`tests/unit/chemistry.test.js`, `lab.test.js`, `evaluation.test.js`)

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Bilanzen und Solver-Konvergenz | PASS | Ladungsbilanz-Residuum < 10⁻⁹ (relativ), Σα = 1, Stoffbilanz und Verdünnung für alle 4 Systeme, V = 0–40 mL in 0,25-mL-Schritten; Bisektion < 200 Iterationen |
| Unabhängige Referenzen | PASS | eigenes Sekantenverfahren (ohne Logarithmen) an 12 Volumina je System, Abweichung < 10⁻⁶ pH; kubische Gleichung für Essigsäure am Start; NaOH- bzw. HCl-Überschuss ± 0,01 |
| Kurven | PASS | stetig (< 1 pH je 0,01 mL), streng steigend (NaOH) bzw. fallend (HCl) bis 45 mL |
| Stufenstöchiometrie | PASS | V(ÄP) 10/20/30 und 12/24 mL; V(HÄP,2) = 15 bzw. 18 mL ≠ V(ÄP,2)/2 |
| Halbäquivalenz nicht erzwungen | PASS | Essigsäure 4,758 (Lit. 4,757), Ammoniak pH 9,243 und pOH 4,757; Phosphorsäure HÄP 1 = 2,48 statt 2,15, Glycin HÄP 1 = 2,57 statt 2,35 (dokumentierte Näherungsgrenze) |
| Spezies und Gegenionen | PASS | Glycin: Cl⁻ = c(Glycin), kein Zusatz-HCl; am 1. ÄP > 99 % Zwitterion bei Gesamtladung ≈ 0 |
| Phosphorsäure, 3. Stufe | PASS | Steigung um 30 mL unter einem Viertel der Steigung am 1. ÄP (kein erfundener Sprung) |
| Messsimulation | PASS | Volumenbilanz in jedem Zeitschritt; Bürettenstand = Anfang + Abgabe; Nachfüllen ohne Sprung; ohne Rührer nicht homogen; Ansprechzeit; Speichern/Wiederherstellen |
| Rechenprüfung | PASS | Dezimalkomma, Einheiten (mL, cm³, L), Vorzeichen, ungültige und leere Eingaben; Stufenfaktor-, Verdünnungs-, Einheiten- und V(ÄP,2)/2-Fehler; pK_B = pH als Fehler erkannt; korrekte Rechnung mit ungenauem Messwert = richtig; ΔpK/ΔpH mit Vorzeichen, Prozentangabe abgelehnt; einfache Näherung außerhalb der Gültigkeit erkannt |
| Indikatoreignung | PASS | Volumenfehler statt Namensvergleich, z. B. Phenolphthalein bei Ammoniak 14 % (ungeeignet), Glycin ÄP 2: kein Indikator geeignet |
| Fehlerzerlegung | PASS | Volumen-, Ablese-, Näherungs- und Rundungsanteil ergeben zusammen pK(exp.) − pK(Lit.) |

## 2. Browserabläufe (`tests/e2e/run.mjs`)

Alle Schritte laufen über Klicks und Eingaben. Die Laborzeit läuft im Test 25-fach beschleunigt (`?speed=25`); E8 prüft die Animationen in Echtzeit.

| Szenario | Status | Inhalt |
| --- | --- | --- |
| E1 Essigsäure | PASS | Theoriefrage falsch → Tipp → richtig; Planung; Vorbereitung; Erstdurchgang mit Phenolphthalein-Endpunkt; Endstand und Verbrauch; V(ÄP), Marker, V(HÄP); frische Probe, Zielmarke, Halbtitration; pK falsch (14 − pH) → richtig; vor der Abgabe keine Literatur, Modellreferenz gesperrt, Bericht ohne Referenzen; Abgabe; theoretische pH-Werte; ΔpK (Vorzeichenfehler erkannt), ΔpH; Fehlerbetrachtung; Bericht mit Kurvenbild |
| E2 Ammoniak | PASS | fallende Kurve, Methylrot-Endpunkt; pK_B = pH als Fehler mit Hinweis auf pOH; pK_B = 14 − pH und pKₛ(NH₄⁺) = pH richtig; Literaturlinie heißt „pKₛ(NH₄⁺)“, keine pK_B-Linie auf der pH-Achse |
| E3 Phosphorsäure | PASS | Stufenfaktor-Fehler und V(ÄP,2)/2-Fehler erkannt; beide Stufen gemessen; HÄP 1 weicht > 0,2 vom pKₛ1 ab; Startpunkt mit einfacher Näherung als „außerhalb der Gültigkeit“ erkannt |
| E4 Glycinhydrochlorid | PASS | Bromthymolblau am 1. ÄP; V(ÄP,2) als „abgeleitet“ (2 · V(ÄP,1)) gekennzeichnet; pKₛ2 = 14 − pH als Fehler erkannt; Zwitterion und Cl⁻ in der Speziesanzeige |
| E5 Durchführung | PASS | Elektrode ohne Kalibrierung bzw. Verdünnung verweigert; keine Zugabe mit Luftblase oder ohne Anfangsstand; falscher Anfangsstand erkannt; ohne Rühren instabil und inhomogen; zu frühe Übernahme als „nicht stabil“; Rühren ändert die Anzeige; Überschießen der Zielmarke gemeldet; „Neue Probe“ erhält alle Reihen; „Messreihe wiederholen“ verwirft nur die aktive; Neuladen stellt Ansicht, Reihen, Kalibrierung, Bürette und Eingaben wieder her; Versuchswechsel ohne Verlust; „Gesamtes Labor zurücksetzen“ |
| E6 Indikator und Datenlücke | PASS | Methylorange bei Essigsäure: Planungshinweis, an der Kurve „ungeeignet“; Datenlücke am ÄP bei 2-mL-Schritten gemeldet; ohne Indikator keine Endpunkt- und Indikatorschritte; fehlende Halbtitration als Datenlücke; Einheit L, ungültige und leere Eingabe |
| E7 Speicherfehler | PASS | `localStorage.setItem` wirft: Hinweis erscheint, App bleibt bedienbar |
| E8 Animation | PASS | in Echtzeit nach einer 0,2-mL-Zugabe kurz vor dem ÄP: fallende Tropfen, Mischschlieren (lokal pink bei sonst farbloser Lösung) und Oberflächenimpulse beobachtet, Volumen steigt schrittweise; offener Hahn; ohne Rührer nach 6 s keine Wellen (max. Auslenkung < 0,05); Tasten D und M |
| E9 Größen und Trennlinie | PASS (Emulation) | 1440×900, 1180×820 (Touch), 1024×768 (Touch): keine horizontale Überbreite, alle Knöpfe im Bedienfeld, Phasen und Kopfzeile ≥ 44 px hoch; Antippen des Hahns im Bild öffnet und schließt; Trennlinie per Pfeiltasten und Ziehen |

In allen Szenarien wurden Konsolenfehler, Seitenfehler und Anfragen an fremde Hosts mitprotokolliert; aufgetreten ist keiner davon.

Ausdrücklich nachgewiesen:

- **Keine Zukunftskurve:** In allen vier Abläufen enthält die Kurve vor dem ersten Messpunkt keine farbigen Punkte (Pixelzählung).
- **Zweiter Durchgang:** Die erste Messreihe bleibt erhalten und erscheint blass.

## 3. Pakete (`tests/e2e/packages.mjs`)

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Struktur | PASS | Web-ZIP: alle Dateien unter `halbtitration/`. SCORM: `imsmanifest.xml` und `index.html` im Stamm, Schema 1.2, `adlcp:scormtype="sco" href="index.html"`; jede Datei im Manifest gelistet und vorhanden |
| Web-ZIP über HTTP | PASS | frisch entpackt (eigener ZIP-Leser), Planung → Labor → Messung → Auswertung, keine 4xx/5xx-Antwort, keine externe Anfrage, keine Konsolenfehler |
| SCORM-ZIP mit Test-LMS | PASS | im Rahmen mit `window.API`: `LMSInitialize` aufgerufen, kein `LMSSetValue` (keine Noten, keine Personendaten) |
| Web-ZIP per `file://` | PASS | Start ohne Server |
| Reproduzierbarkeit | PASS | zweimaliges `npm run package` ergibt identische SHA-256-Summen (feste Zeitstempel) |

Build-Prüfung (`npm run build`): keine externen Ressourcen, keine absoluten Pfade, keine Netzwerkaufrufe, alle Verweise aus `index.html` vorhanden. Einen Service Worker gibt es nicht, daher auch keine Cache-Kollision mit TitraLab 3.

## 4. Sichtprüfung der Screenshots

Visuell geprüft wurden:

| Screenshot | Inhalt |
| --- | --- |
| `01-start-theorie` | Start mit der Theorie |
| `1-essigsaeure-0-planung` | Planung |
| `6-tropfen-schliere` | Dosierung mit zwei fallenden Tropfen und rosa Schlieren |
| `1-…/3-…-1-erstdurchgang` | teilweise bzw. vollständige Kurve mit Endpunkt |
| `3-phosphorsaeure-2-auswertung-erstdurchgang` | mehrstufige Auswertung mit ÄP-1/ÄP-2-Markern |
| `*-4-freigabe-modell` | Laborjournal nach Freigabe mit Modellreferenz, Literaturlinien und Näherungsrauten |
| `5-ohne-ruehren` | Messung ohne Rühren |
| `8-…`, `9-…` | Tablet-Größen |

Bei der Durchsicht gefunden und behoben:

- Hinweise lagen über der Kurve; sie erscheinen jetzt über dem Bedienfeld, höchstens drei gleichzeitig.
- Bei 1024×768 schnitt die Messtabelle die Kurve ab.
- Phasenknöpfe waren nur 40 px hoch.
- Tropfen-Listener wurde bei jeder neuen Probe doppelt registriert (doppelte Schlieren).
- „Nicht durchmischt“ wurde zu streng über das Restvolumen statt über die pH-Wirkung bestimmt.

## 5. Offene Punkte

- **HOLD – unverified:** iPad mit Safari (Touch, Trennlinie, Lesbarkeit) und SCORM-Import in mebis mit Darstellung „Neues Fenster“.
- **HOLD – unverified:** fachliche Prüfung durch die Lehrkraft, besonders:
  - Datensatz Martell & Smith (I = 0) statt Schulwerten wie Glycin 9,60
  - Endpunkt-pH der Indikatoren und Eignungsgrenzen (0,5 % / 3 %)
  - Toleranzen der Rechenprüfung
- Optionale Erweiterungen sind nicht umgesetzt: pK → K mit relativer K-Abweichung und Fehlermodus. Der Pflichtumfang ist davon nicht betroffen.
- Die eingebaute Browseransicht der Desktop-App lieferte in dieser Sitzung keine Screenshots (Zeitüberschreitung); alle Bildnachweise stammen aus Edge über Playwright.
