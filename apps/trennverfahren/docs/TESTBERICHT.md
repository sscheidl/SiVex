# Trennverfahren – Testbericht

Statusbegriffe nach [`docs/QUALITY.md`](../../../docs/QUALITY.md) · Gesamtstatus: **prototype**

## 0.3.2 – Stand 30.10.2026

Korrekturen nach dem Unterrichtseinsatz. Prüfung in der Entwicklungsumgebung ohne Browser; die Abläufe wurden in einer simulierten Seite (jsdom) mit dem App-Code nachgespielt.

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| TV37 | Pause in einem Versuch blockiert keinen anderen; Wechsel schließt Handgriffe ab, Zeit 1×; Bedienen beendet die Pause | **PASS** (simulierte Seite) · Browser **HOLD** | vier Fälle nachgespielt (Pause + Wechsel, Pause mitten im Handgriff, Pause + neuer Handgriff, Wechsel beim Gießen); E13 ergänzt |
| TV38 | Auffanggefäß unter Trichter bzw. Hahn höchstens randvoll, Überschuss auf den Tisch, Warnung | **PASS** | `model.test.js` (V2, V4); Bilanz erhalten |
| TV39 | Auswahlliste springt nach Antippen nicht erneut auf; nach Tastaturbedienung behält sie den Fokus | **PASS** (simulierte Seite) · iPad **HOLD** | Wahl per Zeiger und per Tastatur nachgespielt |
| – | Unit-Tests | **PASS** 60/60 | `npm test` |
| – | Browserabnahme E1–E13, Paketprüfung | **HOLD – unverified** | `npm run test:all` auf dem Entwicklungsrechner |

## 0.3.1 – Stand 30.10.2026

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| iPad mit Safari: sichtbar, bedienbar, Abläufe | **PASS** (Lehrkraft, 30.10.2026, Stand 0.3.0) | manuelle Prüfung auf dem Gerät über mebis |
| TV36: keine Sackgasse nach abgewiesenem Ziel (Fehlerbericht V5: Magnet blieb gewählt, Uhrglas nicht mehr wählbar) | **PASS** (simulierte Seite) · Browser **HOLD** | Ablauf in einer simulierten Seite (jsdom) mit dem ausgelieferten Code nachgespielt: vorher Sackgasse, jetzt Uhrglas → Becherglas A erfolgreich; Unit-Tests 58/58; E13 ergänzt |
| mebis-Import und -Start | **PASS** (Lehrkraft, 30.10.2026, Stand 0.3.0) | SCORM-Paket in mebis gestartet und auf dem iPad bedient; 0.3.1 ersetzt es mit der Korrektur der Auswahl |
| fachliche Durchsicht, Unterrichtserprobung | **HOLD – unverified** | ausstehend |

## 0.3.0 – Stand 30.10.2026

Grundlage: Durchsicht vom 30.10.2026 (Tropfen, Teilchenmodell, V3 Spatel, V4 Teilchenebene, V5 vollständige Trennschritte, Heizplatte am Gerät, Uhrglas weitergeben). Entwicklungsprüfung in einer Linux-Umgebung **ohne Browser**: Modell und Darstellungslogik sind durch Unit-Tests abgedeckt, die Zeichnung wurde mit einer Canvas-Bibliothek ohne Browser gerendert und gesichtet. **Browserabnahme (E1–E13) und Paketprüfung im Browser stehen aus (HOLD – unverified).**

| | |
| --- | --- |
| System | Linux (Ubuntu 24.04), Node.js 22.23.4 |
| Browser | – (keiner verfügbar; Playwright-Browser ließen sich in dieser Umgebung nicht laden) |
| Sichtprüfung | Renderer und Teilchenansicht in Node mit `@napi-rs/canvas` gerendert (nicht Teil des Repositorys) |
| Pakete | `release/trennverfahren-0.3.0-web.zip`, `release/trennverfahren-0.3.0-scorm12.zip` (`npm run package`: Build OK, 14 Dateien), Prüfsummen in `release/SHA256SUMS.txt` |

```bash
npm test          # 58 Unit-Tests: Modell 37, Aufgaben 9, Teilchenansicht 4, Geometrie 3, Labkit 5 – alle PASS
npm run package   # Build-Prüfung, Web- und SCORM-ZIP 0.3.0, Prüfsummen
```

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| TV22 | Tropfen größer, hängender Tropfen, Übergang Tropfen → Rinnsal nach Durchfluss | **PASS** (Sichtprüfung) · Browser **HOLD** | gerenderte Bildfolgen V2 (volles Filter: Rinnsal bis in den Kolben; wenig Durchfluss: einzelne Tropfen mit hängendem Tropfen) und V4 (Hahn „Tropfen“ / „offen“); E13 prüft `streamK` und Auftreffpunkt im Browser |
| TV23 | Teilchensymbole: Wasser als blaues Dreieck, Ionenladungen lesbar, etwa doppelte Größe, Legende passend | **PASS** (Sichtprüfung) · Browser **HOLD** | gerenderte Teilchenbilder V1–V5 und Vergleichsbilder V3; E8 (Legende) und E13 im Browser |
| TV24 | Gleichmäßige Verteilung: Öl in der ganzen Ölphase, reines Öl ohne Schichten, keine Randreihen | **PASS** | `particles.test.js` (Höhen- und Randverteilung, Spanne der Ölteilchen > 80 % der Ölphase) |
| TV25 | Schütteln: Öltröpfchen im Wasser, kein Wasser im Tröpfchen, keine Überlappung, Entmischung in Ruhe | **PASS** | `particles.test.js`; achtfach wiederholt ohne Ausreißer |
| TV26 | Magnet auf Teilchenebene: erfasste Körner verlassen das Bild, übrige bleiben liegen, nichts fällt zurück | **PASS** | `particles.test.js` |
| TV27 | Mehr Salzteilchen; Gemenge mit Salzkristallen zwischen den Körnern | **PASS** (Sichtprüfung) | `particles.test.js` (Mengen) und gerenderte Bilder V3/V5 |
| TV28 | V3: Spatel in drei Portionen, Menge auf dem Uhrglas wächst | **PASS** | `model.test.js` (Zwischenstände ⅓, ⅔, 3/3, Bilanz); E13 im Browser **HOLD** |
| TV29 | Uhrglas weitergeben (Gemenge, Eisen, Rückstand vom Filterpapier; Papier bleibt) | **PASS** | `model.test.js` (V5, V2) |
| TV30 | Heizplatte am Gerät (Maus, Touch, Tastatur), Trefferfläche überdeckt die Schale nicht | **PASS** (Logik) · Browser **HOLD** | Trefferflächen bei vier Bühnengrößen geprüft (Knopf verdeckt die Mitte der Abdampfschale nie); E13 im Browser |
| TV31 | V5: Magnet trocken 2 / nass 3 Durchgänge restlos; Zählung beginnt bei neuem Eisen neu | **PASS** | `model.test.js` |
| TV32 | V5: Filtration vollständig, ungelöstes Salz bei zu wenig Wasser bleibt Fehler | **PASS** | `model.test.js` (inkl. bestehendem Korrekturfall „Nachspülen korrigiert“) |
| TV33 | V5: Dichte richtig bei Dekantieren, Korngröße entbehrlich ohne Filtration | **PASS** | `tasks.test.js`, `model.test.js` (Dekantieren erkannt, Aufgießen einer Suspension nicht) |
| TV34 | Altfälle TV01–TV21 | **PASS** (Unit) · Browser **HOLD** | alle bisherigen Unit-Tests grün; Browserszenarien E1–E12 sind an die Neuerungen angepasst geprüft (Code-Durchsicht), aber nicht ausgeführt |
| TV35 | Web-/SCORM-Paket im Browser | **HOLD – unverified** | `npm run test:scorm` steht aus |

**Auf dem Entwicklungsrechner auszuführen:** `npm run test:all` (Unit, Paket, E1–E13, Paketprüfung). Danach diesen Abschnitt mit den Ergebnissen ergänzen und die Screenshots `70`–`77` (E13) sichten. Weiter ausstehend wie bei 0.2.0: iPad/Safari, mebis, fachliche Durchsicht, Unterrichtserprobung.

## Abnahme 0.2.0 – Stand 29.10.2026 (Browser)

Grundlage: Korrekturauftrag „Trennverfahren 0.2.0“ (P0, P1, P2). Die folgenden Ergebnisse gelten für 0.2.0; die Prüfsummen beziehen sich auf die damaligen Pakete (in der Git-Historie).

### Umgebung

| | |
| --- | --- |
| System | Windows 11 Pro (10.0.26300) |
| Node.js | 24.22.1 |
| Browser | Microsoft Edge 156.0.4314.50 über Playwright 1.56.1 (`channel: msedge`) |
| Baukasten | Labkit 0.1.1 (unverändert) |
| Pakete | `release/trennverfahren-0.2.0-web.zip`, `release/trennverfahren-0.2.0-scorm12.zip`, Prüfsummen in `release/SHA256SUMS.txt` |

### Ausgeführte Befehle und Reihenfolge

```bash
npm test                  # 46 Unit-Tests (Modell 30, Aufgaben 8, Geometrie 3, Labkit 5)
npm run package           # Build-Prüfung, Web- und SCORM-ZIP 0.2.0, Prüfsummen
node tests/e2e/run.mjs    # Browserszenarien E1–E12 (15 Läufe)
node tests/e2e/scorm.mjs  # 16 Paketprüfungen auf den ausgelieferten ZIP-Dateien
```

1. Gesamtlauf auf dem fertigen Code: 13 von 15 Browserszenarien PASS. E7 und E8 scheiterten, weil ihr **Testablauf** noch im Ring schüttelte – das weist 0.2.0 bewusst ab (P1.3). Testablauf korrigiert (Stopfen auf, in die Hand nehmen, schütteln, einhängen), E7 und E8 einzeln nachgelaufen: PASS.
2. Danach eine Korrektur am Code: Die Legende des Teilchenmodells nennt beim Vergleichsbild „festes Kochsalz“ keine Wasserteilchen mehr. Anschließend Unit-Tests (46/46), Paketbau, E8 und alle 16 Paketprüfungen (inklusive vollständigem Pflichtablauf im SCORM-Paket und im Web-ZIP) erneut ausgeführt. Die ausgelieferten ZIPs sind byte-identisch mit diesem Build (Prüfung PKG-1).

Prüfsummen der ausgelieferten Pakete (SHA-256):

```text
5e20d701251011639a06a737e7905e6f2b41b6ab9cbea772ecc3bd7a7f19f11c  trennverfahren-0.2.0-web.zip
55ccb9eefd134a65fb7d8e253b4218510b24ee37cfa0f23c68f4d42bc6be586c  trennverfahren-0.2.0-scorm12.zip
```

Ergebnisse maschinenlesbar: [`tests/e2e/results.json`](../tests/e2e/results.json) (Nachläufe vermerkt), [`tests/e2e/scorm-results.json`](../tests/e2e/scorm-results.json).

### PASS/HOLD-Matrix (TV01–TV21)

| ID | Prüffall | Status | Nachweis |
| --- | --- | --- | --- |
| TV01 | Kopfzeile + Neustartbestätigung auf 4 Viewports | **PASS** | E6 bei 1024×768, 1180×820, 1440×900, 1920×1080: Bestätigungstext, Versuchsnummer und Trennziel ohne Abschneiden, beide Knöpfe sichtbar, ≥ 44 px, per Tastatur „Abbrechen“, „Neu beginnen“ erzeugt neuen Ansatz; Kopfzeilenknöpfe vollständig im Fenster. Screenshots `42-neustart-*` |
| TV02 | Vorsichtig/zügig gießen V1–V4 | **PASS** | E9: Während des laufenden Gießens liegt der Treffpunkt des Strahls in jedem Bild innerhalb der Öffnung und genau am Spiegel bzw. Innenboden des Ziels (Abweichung < 0,6 Weltpixel), kein Verschütten. Bildfolgen `anim/tv02-v1-zuegig-leer-*`, `tv02-v1-vorsichtig-halbvoll-*`, `tv03-v3-abdampfschale-*`, `tv03-v4-scheidetrichter-*`; Vorher/Nachher `vergleich/*-giessen.png` |
| TV03 | Leere/halbvolle/fast volle Gefäße, Filter, Scheidetrichter | **PASS** | E9: leeres und teilweise gefülltes Becherglas, Trichter mit Papier (Tropfen landen in der Vorlage, nichts verschüttet), Uhrglas als fast volles Ziel (Gießen stoppt mit „Uhrglas ist voll“, nichts verschüttet), Abdampfschale, Scheidetrichter (Tropfen aus dem Hahn landen in Becherglas B). Bilanz nach den Folgen unverändert (< 10⁻⁶). Bildfolgen `anim/tv03-v2-trichter-*`, `tv03-v2-uhrglas-fast-voll-*`, `tv03-v4-tropfen-*` |
| TV04 | Spritzflasche: leer, Feststoffgemisch, Filter | **PASS** | Ursache des Fehlers in 0.1.0: Die Düsenposition war ein Zahlenpaar statt eines Punktes – der Strahl wurde nie gezeichnet. E9: Strahl in jeder aktiven Sprühphase sichtbar und trifft das Ziel (leeres Becherglas, Becherglas mit Sand, Filter), Wassermenge 5 bzw. 20 mL; Unit-Test: Wasser fließt nur während des Strahls. Bildfolgen `anim/tv04-spritzflasche-*`, Vorher/Nachher `vergleich/*-spritzflasche.png` |
| TV05 | Sedimentation, Filtration: fachliche Auswertung | **PASS** | `tasks.test.js`: V1 verlangt Dichte, V2 Korngröße; Löslichkeit als Voraussetzung wird erläutert („nicht nötig, aber nicht falsch“), nicht als Fehler gewertet; E11 im Browser (Markierung ○) |
| TV06 | Öl/Wasser ohne Schütteln | **PASS** | Unit-Test TV06 und E1/E2 (Pflichtablauf ohne Schütteln): Ziel erreicht, kein Schüttelkriterium mehr |
| TV07 | Optionales Schütteln außerhalb des Rings | **PASS** | E10: Schütteln im Ring wird mit sichtbarer Begründung abgewiesen; Stopfen auf → in die Hand → schütteln → einhängen → entmischen → Stopfen ab → Trennung erfolgreich; Unit-Test: Herausnehmen ohne Stopfen bzw. mit offenem Hahn abgewiesen. Screenshot `51-tv07-schuetteln-in-der-hand` |
| TV08 | Rückgießen verunreinigter Fraktion | **PASS** | E10: zu spät geschlossen (10 mL Öl im Wasser) → Rückgießen bei offenem Hahn mit Begründung abgewiesen → Hahn zu → zurückgegossen → erneut getrennt → Ziel erreicht; Unit-Test für Rückgießen aus A, B und C |
| TV09 | Bedienung Stopfen und Hahn | **PASS** | Stopfen als Objekt auf der Ablage mit sichtbarer Bewegung (E10, `50-tv07-stopfen-auf`); Hahn direkt am Gerät per Maus (E1, E10), Touch (E2) und Tastatur (E10); Zustand als Griffstellung und in der Beschriftung |
| TV10 | V2: Papier/Rückstand auf Uhrglas | **PASS** | Unit-Test: Sand und anhaftendes Wasser vollständig übertragen, während des Tropfens abgewiesen, Ziel bleibt erreicht; E1: im Pflichtablauf über die Oberfläche |
| TV11 | V3: Kristalle nach Abkühlung entnehmen | **PASS** | Unit-Test: heiß bzw. nass abgewiesen, nach Abkühlen unter 45 °C Masse erhalten, Ziel bleibt erreicht; E1 und E2 über die Oberfläche (Maus, Touch) |
| TV12 | Protokoll: Textfelder + Zwischenstand | **PASS** | E11: Speicherknopf nach beiden Feldern; Zwischenstand enthält Beobachtung, Erklärung, Ansatz, Versuchszeit, Zustand |
| TV13 | Freitext-Unsinn und fachliche Kontrolle | **PASS** | E11: Unsinnstext erhält keine Markierung; Abschluss allein über Trennziel und Auswertungsfragen (auch mit leeren Feldern); Musterbeobachtung nach erreichtem Ziel |
| TV14 | Schülertexte/Hefteintrag | **PASS** | `tasks.test.js`: keine Klammer-Aufzählungen und keine vorweggenommenen Beobachtungen in den Beobachtungsfragen, keine „schwerer“-Formulierung, Dampf: Wasserdampf unsichtbar, sichtbare Wolke = kondensierte Tröpfchen |
| TV15 | Laborlayout und Teilchenansicht auf 4 Viewports | **PASS** | E6: keine Überbreite, keine Überlappung, alle Bedienelemente ≥ 44 px, Laborfläche ≥ 250 px hoch. Maßstab mit Teilchenmodell **und** Namen: 1024×768 V1 0,89 · V2 0,54 · V3 0,80 · V4 0,66 · V5 0,59; 1180×820 V1 1,03 · V2 0,62 · V3 0,93 · V4 0,76 · V5 0,69 (0.1.0 bei 1024×768 mit Teilchenmodell: V5 0,49). Vorher/Nachher `vergleich/` |
| TV16 | Stoffbilanz nach allen neuen Handlungen | **PASS** | Unit-Tests prüfen nach jeder Handlungsfolge alle Stoffe (Abweichung < 10⁻⁶, inklusive Spritzflasche und Verlusttöpfe) sowie endliche, nicht negative Mengen |
| TV17 | Alternative Vorgehensweise V5, Altversuche | **PASS** | E4 (alternative Reihenfolge, alle Korrekturfälle) und Unit-Tests aller bisherigen Fälle |
| TV18 | Start/Stop/Pause/Zeitraffer während Aktionen | **PASS** | E12: Doppelklick erzeugt genau einen Gießvorgang; während des Gießens höchstens 1× (Anzeige „1×“); Pause hält Transfer an; Unit-Test: zweiter Handgriff während eines laufenden abgewiesen |
| TV19 | Web-/SCORM-Paket frisch gebaut und entpackt | **PASS** (simuliertes LMS) | `scorm.mjs` 16/16: Manifest im Stamm, alle Dateien gelistet, Paket = Build; Mock-LMS über HTTP eingebettet (Versuch 1) und als neues Fenster (vollständiger Pflichtablauf), nur `LMSInitialize`/`LMSFinish`; Web-ZIP entpackt per `file://` ohne Netz mit vollständigem Pflichtablauf |
| TV20 | Testdokumentation | **PASS** | dieser Bericht, `results.json`, `scorm-results.json`, Screenshots und Bildfolgen |
| TV21 | V3: Reinstoff/Stoffgemisch-Teilchenansicht | **PASS** | E8: Wasser / festes Kochsalz / Kochsalzlösung wählbar; Ionengitter, einzelne Ionen in Lösung, „kein eigener Aggregatzustand“, keine „NaCl-Moleküle“, Legende passend. Screenshots `55-tv21-*` |
| P2 | Kochsalz mit dem Löffel dosieren | **deferred** | nicht umgesetzt, als Folgeauftrag zurückgestellt |

Zusätzlich weiter grün: E1 Pflichtablauf (jetzt mit Papier- und Kristallüberführung), E2 Touch, E3 Tastatur, E4 Korrekturen, E5 Speicherung, E7 Animation, E8 Teilchenmodell. Alle Szenarien prüfen außerdem: keine Konsolenfehler, keine Anfragen außerhalb des App-Servers.

### Ausstehende Prüfungen (nicht in dieser Umgebung möglich)

| Prüfung | Status |
| --- | --- |
| iPad mit Safari (Touch, Animation, Fenstergröße) – Tablet wurde nur in Edge emuliert | **HOLD – unverified** (für 0.2.0; ab 0.3.0 auf dem iPad geprüft, siehe oben) |
| Import und Start in mebis („Neues Fenster“) – geprüft nur im simulierten LMS | **HOLD – unverified** |
| Fachliche Durchsicht durch die Lehrkraft (Trennprinzip-Bewertung, Toleranzen, Texte) | **HOLD – unverified** |
| Unterrichtserprobung | **HOLD – unverified** |

### Bekannte Grenzen und Risiken für den Schulbetrieb

- Versuch 2 und 5 bleiben bei 1024×768 mit beiden Zusatzanzeigen die kleinsten Aufbauten (Maßstab 0,54 bzw. 0,59); Ausblenden des Bedienfelds oder Verschieben der Trennlinie vergrößert sie.
- Die Spritzflasche wird bei Zielen am linken Rand gespiegelt geführt, unter der Wandablage flacher – die Bewegung ist schematisch.
- Der Scheidetrichter wird zum Schütteln als „in der Hand“ gezeichnet (schematische Hände); sein Inhalt schwappt mit dem Glas.
- Zeiten sind beschleunigt; Parameter in [CHEMIE.md](CHEMIE.md).
- Echte Geräte- und Plattformprüfungen fehlen (siehe oben); bis dahin bleibt `sivex.json` auf `prototype`.

### Screenshots

`docs/screenshots/`: `01`–`08b` Pflichtablauf · `10` Tablet/Touch · `11` Tastatur · `20`–`24` Korrekturfälle · `30` Speicherung · `40-layout-*` (4 Viewports, alle Versuche) · `41-lange-meldung-*` · `42-neustart-*` · `43` Scheidetrichter-Tropfen · `50`–`53` Scheidetrichter (TV07, TV08) · `54` Protokoll · `55-tv21-*` Vergleichsbilder · `60`/`61` Pakete · `anim/` Bildfolgen (Gießen, Tropfen, Spritzflasche, Sedimentation, Entmischung, Lösen, Kristalle) · `vergleich/` Vorher (0.1.0) / Nachher (0.2.0) bei 1024×768 und 1180×820.
