# Changelog

## 0.2.2 – 29.10.2026 (prototype)

- **Wechsel HCl ↔ NaOH beginnt immer mit frischen Ansätzen** (Wunsch der Lehrkraft): Bisher zeigte die Rückkehr zu einer schon benutzten Reihe deren alten Stand (z. B. angesäuertes Wasser), was irritierte. Jetzt wird eine benutzte Reihe beim Wechsel automatisch unter „Ergebnisse“ abgelegt (Hinweis erscheint) und Wasser/Pufferlösung starten wieder bei pH 7,00/7,20. Unbenutzte Reihen werden nicht abgelegt. Die Gegenprobe (bewusstes Weiterbehandeln derselben Ansätze) bleibt unverändert.

## 0.2.1 – 29.10.2026 (prototype)

Kleine Überarbeitung nach Rückmeldung der Lehrkraft. Status bleibt **prototype**.

- **Zugesetzte Gesamtmenge (nur Versuch 1):** neben jedem Glasschild „zugesetzt – HCl … mL / NaOH … mL“; zählt live mit, gehört zur Messreihe, „Neue Reihe“ setzt zurück. So sehen die SuS, wie viel mehr Säure/Lauge die Pufferlösung für dieselbe pH-Änderung braucht.
- **Flaschen und Pipetten direkt antippen:** unsichtbare Klickflächen über der Zeichnung (Tastatur, `aria-pressed`); die Beschriftungs-Schalter unter den Flaschen entfallen. Pipettenwahl im Ständer synchron mit der Dosierleiste.
- **Rührfisch:** „Umrühren“ (Glasstab) wird zum Schalter **Rühren an/aus**; in jedem Glas dreht sich ein Rührfisch (nach TitraLab 3), die Lösungen mischen sich schneller.
- **Teilchenmodell:** Essigsäure/Acetat als **HAc/Ac⁻** (Legende mit Namen, Ethanoat). Reagiert eine Zugabe mit dem Puffer, wandert H₃O⁺/OH⁻ zum Partner und es entsteht kurz **H₂O**; ohne Puffer häufen sich freie Ionen an. Wasser bleibt Hintergrund (fachliche Begründung in `docs/CHEMIE.md`).
- **Versuch 3 ohne Sperre:** auch ohne vorherige Herleitung zugänglich (Einzelstunde); erst rechnen, dann herstellen bleibt.

## 0.2.0 – 29.10.2026 (prototype)

Änderungs- und Erweiterungsauftrag 0.2.0 (Q13 eA). Status bleibt **prototype**; echtes iPad, mebis-Import und fachlich-didaktische Freigabe stehen aus (siehe Testbericht).

**Versuche**
- Genau **drei Versuche**: (1) Wasser und Pufferlösung, (2) Säure, Base und Gemisch, (3) Puffer gezielt herstellen. Versuch 4 „Verdünnung“ ist aus der Anwendung entfernt (Auswahl, Aufgaben, Freischaltungen, Tests); die Einsicht „Kapazität hängt von den Stoffmengen ab“ steht in Herleitung und Hefteintrag.
- Die beiden Proben von Versuch 1 heißen von Beginn an **„Wasser“ und „Pufferlösung“**; die verdeckte Probe samt Aufdeckung entfällt. **Keine verpflichtende Vermutung** in den Versuchen 1 und 2 – sofort dosieren, beobachten, auswerten.
- Freitext „In eigenen Worten …“ ersetzt durch **konkrete Leitfragen** (Versuch 1: Warum ändert sich der pH-Wert der Pufferlösung nach HCl weniger als bei Wasser? Versuch 2: Wie wirken CH₃COOH und CH₃COO⁻ zusammen? Versuch 3: Messwert gegen Ziel-pH) mit Erwartung und Hinweis „wird nicht bewertet“; Antworten stehen unbewertet im Journal. Versuch 2 erhält die Laugenzugabe als eigene Erklärungsfrage.
- **Versuch 3 neu:** Ziel-pH (5,05 · 6,90 · 9,55 oder eigener Wert) → Puffersystem (Acetat, Phosphat, Ammonium/Ammoniak) → selbst rechnen (n(A⁻)/n(HA) = 10^(pH − pKₛ), Volumina über n = c·V, 30,0 mL, je 0,100 mol/L) → Stammlösungen dosieren → pH-Messelektrode. Rückmeldung zur Rechnung mit konkreter Ursache; Auswertung stellt Rechnung, Volumina, Messwert und Abweichung gegenüber. Die Henderson-Hasselbalch-Gleichung bleibt im gesamten Versuch über der Laborbühne sichtbar.
- Herleitung liegt vor der Herstellung; Versuch 3 öffnet nach der Herleitung, die sechs Rechenaufgaben sind dafür nicht nötig.

**Chemie**
- **NH₄⁺/NH₃ als experimentelles System** im Solver (Stickstoff-Massenbilanz, NH₄⁺ in der Ladungsbilanz, NH₄Cl liefert Cl⁻, formale Bilanz, pKₛ = 9,25 direkt); Stammlösungs-Tabelle `STOCKS`, Systemtabelle `SYSTEMS`, `planMix`, `assessTarget`. Kein Carbonatsystem.
- Unabhängige Referenztests (kubische Gleichung; Brent-Verfahren mit α-Anteilen für Phosphat) für alle drei Systeme, Ladungs- und Massenresiduen, Standardaufgaben mit Abweichung Solver ↔ Referenz ≈ 10⁻¹⁴ und Solver ↔ Ziel-pH ≤ 0,001.

**Oberfläche**
- Laborbild deutlich größer (Becherglas bei 1440×900: 179 px statt 126 px, +42 %), Gläser verteilen sich über die ganze Bühne; Beschriftungen als scharfe HTML-Schilder; **pH-Messelektrode sichtbar beschriftet**; pH-Anzeige unter dem zugehörigen Glas.
- Teilchenzone und Zeitlupen-Ansicht entfallen: In den Versuchen 1 und 2 gibt es **ein** vereinfachtes, schematisches Teilchenmodell mit Legende und Hinweis auf die Abstraktion; in Versuch 3 ein **Mischungsverhältnis-Diagramm** aus den tatsächlich zugegebenen Stoffmengen.
- **pH-Kurve beim Start verborgen**; Umschalter *Teilchenmodell | pH-Kurve* (Versuch 3: *Mischungsverhältnis | pH-Kurve*) am selben Platz, verlustfrei.
- Dosierleiste in der Reihenfolge **1 Lösung → 2 Pipette → 3 Menge → 4 Ziel → Zugabe**; die **Flaschen im Laborbild sind Schalter** und wählen synchron mit dem Umschalter HCl/NaOH; nur Ausgewähltes ist dunkel (`aria-pressed`, Häkchen), gesperrte Schalter sind abgeblendet und gestrichelt; Touchziele ≥ 44 px. Die Messpipette fasst 10 mL.
- Antwortlisten (Protokoll, Herleitung, Aufgaben, Anwendungen) in **stabiler, gespeicherter, je Sitzung gemischter Reihenfolge**; Bewertung nach Antwort-ID.

**Technik**
- Speicherstand auf Schlüssel `sivex.pufferfish.v2` umgestellt; 0.1.0-Daten werden weder gelesen noch verändert (Versuche und Proben der Vorversion existieren nicht mehr).
- Neue Tests: 60 Unit-Tests, 22 Browserszenarien (24 Prüfpunkte) mit Zuordnung zu den Abnahmekriterien P01–P16 (Playwright-Uhr für schnelle Zugaben, Zufallsbedienung), Paketprüfung mit Versuch 3. Eine unabhängige Code-Durchsicht fand vier Fehler (Einfrieren bei Wechsel während der Messung u. a.), alle behoben und mit Tests abgesichert.
- Pakete `pufferfish-0.2.0-web.zip` und `pufferfish-0.2.0-scorm12.zip` (0.1.0 bleibt über die Git-Historie erhalten).

## 0.1.0 – 27.10.2026 (prototype)

Erste eigenständige Fassung nach Build-Auftrag 1.0 vom 27.10.2026.

- Pipetten-/Tropfversuch mit Bechergläsern, vier Versuche (verdeckte Phosphatprobe, Acetat-Partner, Verhältnis und Kapazität, Verdünnung), getrennte Säure- und Laugenreihen, gekennzeichnete Gegenprobe.
- Ladungsbilanz-Modell mit Essigsäure/Acetat und drei Phosphatstufen; formale Bilanz und H-H-Vergleich nach der Herleitung.
- Teilchenebene mit repräsentativem Bestand und schematischer Zeitlupe der Protonenübertragung in beide Richtungen sowie H₃O⁺ + OH⁻.
- pH-Zugabekurve aus protokollierten Messpunkten, pKₛ ± 1 zuschaltbar, Vergleich gespeicherter Reihen.
- Herleitung (7 Schritte), 6 Rechenaufgaben, 4 Anwendungen, Journal mit Druck/Export, Hefteintrag.
- Animiertes Pufferfisch-Logo (SVG/CSS), reduzierte Bewegung.
- Web- und SCORM-1.2-Paket, Unit-, Browser- und Paketprüfungen.
