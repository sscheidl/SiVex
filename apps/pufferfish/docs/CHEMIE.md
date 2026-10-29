# Pufferfish – Chemisches Modell, Parameter und Quellen

Stand 0.2.0 · 29.10.2026

## 1. Modell

**Ideales Konzentrationsmodell bei 25 °C.** Der pH-Wert jeder Probe folgt aus der vollständigen Ladungsbilanz mit Wasserautoprotolyse (`js/chem.js`, `solve`):

    c(H₃O⁺) + c(Na⁺) + c(NH₄⁺) = c(OH⁻) + c(Cl⁻) + c(CH₃COO⁻) + c(H₂PO₄⁻) + 2·c(HPO₄²⁻) + 3·c(PO₄³⁻)

- Essigsäure/Acetat, **alle drei Protolysestufen** der Phosphorsäure und – neu in 0.2.0 – **Ammonium/Ammoniak** werden über ihre Anteilsfunktionen berücksichtigt; Phosphat ist also nicht künstlich einprotonig.
- Na⁺ aus Natriumacetat, NaH₂PO₄, Na₂HPO₄ und NaOH sowie Cl⁻ aus HCl und NH₄Cl werden als Gegenionen bilanziert. Jede Zugabe erhöht das Gesamtvolumen.
- Die linke minus die rechte Seite wächst streng monoton mit c(H₃O⁺) (alle Anteilsfunktionen der Kationen steigen, die der Anionen fallen mit c(H₃O⁺)). Die Nullstelle wird per Bisektion in lg c(H₃O⁺) gesucht (Bereich 10⁻¹⁶ … 10² mol/L, Abbruch bei 10⁻¹³ in lg). Dadurch entstehen auch weit jenseits der Pufferkapazität weder negative Konzentrationen noch Logarithmusfehler. Der pH-Wert wird nicht auf 0–14 geklemmt.
- **NH₄⁺/NH₃ ist ein eigenes System** (kein Umweg über pK_B): Kₛ(NH₄⁺) = 10⁻⁹·²⁵ geht direkt als Anteilsfunktion c(NH₄⁺) = N · h/(h + Kₛ) in die Ladungsbilanz ein. Die Stickstoffmenge N (NH₄⁺ + NH₃) ist erhalten (Massenbilanz). NH₄Cl bringt zusätzlich Cl⁻ in die Bilanz.
- **Formale Bilanz** (`formal`): die nach vollständigem stöchiometrischem Umsatz der starken Säure/Base verbliebenen Stoffmengen, mit denen in der Schule gerechnet wird. Für Ammonium: n(NH₄⁺) = n(Cl⁻) − n(Na⁺), begrenzt auf 0 … N; ein Überschuss ist Überschuss starker Säure bzw. Base. Sie wird getrennt von den Gleichgewichtsmengen aus `solve` geführt. Die Henderson-Hasselbalch-Rechnung (`hh`) liefert `null`, sobald ein Partner fehlt – negative oder verschwindende Restmengen werden nie logarithmiert.
- **Reaktionsweg einer Zugabe** (`doseAnalysis`): Aus dem Gleichgewicht vor und nach der Zugabe folgt über die Protonenbilanz, welcher Anteil der zugegebenen H₃O⁺ bzw. OH⁻ vom schwachen System umgesetzt wurde. Die Oberfläche von 0.2.0 zeigt keine Reaktionsanimation mehr; die Funktion ist als geprüfte Modellfunktion erhalten.
- **Stammlösungen** (`STOCKS`): HCl, NaOH, CH₃COOH, CH₃COONa, NaH₂PO₄, Na₂HPO₄, NH₄Cl, NH₃(aq), jeweils 0,100 mol/L; `add` addiert Volumen und die in der Tabelle hinterlegten Stoffmengen je mL. Es gibt **kein Carbonat-Puffersystem**.
- **Herstellungsplan** (`planMix`): Verhältnis r = n(A⁻)/n(HA) = 10^(pH − pKₛ); mit n = c·V und V(Säure) + V(Base) = 30,0 mL folgt V(Säure) = V/(1 + r·c_S/c_B), V(Base) = V − V(Säure) (bei gleichen Konzentrationen V(Base)/V(Säure) = r). Der Plan dient nur der Rückmeldung; der Messwert im Versuch kommt **ausschließlich aus `solve`** und wird nie an den Sollwert angepasst.

## 2. Parameter

| Größe | Wert | Bemerkung |
| --- | --- | --- |
| Kw | 1,0 · 10⁻¹⁴ | 25 °C |
| pKₛ(CH₃COOH) | 4,75 | OpenStax-Tabelle: Kₐ = 1,8 · 10⁻⁵ → 4,74 |
| pKₛ₁/pKₛ₂/pKₛ₃ (H₃PO₄) | 2,15 / 7,20 / 12,35 | OpenStax: 2,12 / 7,21 / 12,38 (Abweichung ≤ 0,03) |
| pKₛ(NH₄⁺) | 9,25 | OpenStax über K_b(NH₃) = 1,8 · 10⁻⁵: 9,26; Vorgabe des Auftrags 9,25 |
| pK′ Blut (nur Aufgabe 6) | 6,10 | effektiv, 37 °C, CO₂*/HCO₃⁻ |
| c(HCl), c(NaOH), alle Stammlösungen | 0,100 mol/L | |
| Tropfen | 0,050 mL | **vereinbarte Simulationsgröße**, keine Naturkonstante |
| Messpipette | 0,5 / 1,0 / 5,0 mL (Versuch 3: zusätzlich 10,0 mL) | Dosierhilfe |
| Probenvolumen Versuche 1, 2 | 30,0 mL | |
| Gesamtvolumen Versuch 3 | 30,0 mL | Modellannahme der ersten Fassung |

Proben (`js/engine.js`, `SAMPLES`):

| Versuch | Probe | Zusammensetzung | Anfangs-pH (Modell) |
| --- | --- | --- | --- |
| 1 | Wasser | CO₂-freies Modellwasser | 7,00 |
| 1 | Pufferlösung | Phosphatpuffer, c(H₂PO₄⁻) = c(HPO₄²⁻) = 0,050 mol/L (Na-Salze); die Zusammensetzung steht in Aufgabe 1 (Erklärung) und in der Herleitung | 7,20 |
| 2 | Essigsäure | 0,100 mol/L | 2,88 |
| 2 | Natriumacetat | 0,100 mol/L | 8,88 |
| 2 | Gemisch 1 : 1 | je 0,050 mol/L | 4,75 |
| 3 | hergestellter Puffer | Mischung der beiden Stammlösungen (Acetat, Phosphat oder Ammonium/Ammoniak) | aus dem Modell |

Standardaufgaben Versuch 3 (30,0 mL, beide Stammlösungen 0,100 mol/L):

| Ziel-pH | System | n(A⁻)/n(HA) | V(Säure-Lösung) | V(Base-Lösung) | Solver | H-H |
| --- | --- | --- | --- | --- | --- | --- |
| 5,05 | Acetat (pKₛ 4,75) | 1,995 | 10,02 mL (≈ 10) | 19,98 mL (≈ 20) | 5,050 | 5,050 |
| 6,90 | Phosphat (pKₛ 7,20) | 0,501 | 19,98 mL (≈ 20) | 10,02 mL (≈ 10) | 6,900 | 6,900 |
| 9,55 | Ammonium/Ammoniak (pKₛ 9,25) | 1,995 | 10,02 mL (≈ 10) | 19,98 mL (≈ 20) | 9,549 | 9,550 |

Mit auf ganze mL gerundeten Volumina (10/20 bzw. 20/10 mL) misst das Modell 5,051 / 6,899 / 9,550. Vertauschte Volumina ergeben 4,45 / 7,50 / 8,95 – ein Fehler im Verhältnis ändert den Messwert also nachweisbar. Weitere Ziel-pH-Werte sind im Bereich pKₛ ± 1 des gewählten Systems erlaubt (Acetat 3,75–5,75; Phosphat 6,20–8,20; Ammonium/Ammoniak 8,25–10,25). Außerhalb – und in den Lücken zwischen den Bereichen, z. B. pH 5,95 – weist die App den Wert bzw. das System mit Begründung zurück. **pKₛ ± 1 ist eine Faustregel (Näherung)**, keine harte Wirksamkeitsgrenze; am Rand (|pH − pKₛ| ≥ 0,85) weist die App darauf hin.

## 3. Darstellungsmodelle (bewusst schematisch)

- **Universalindikator:** lineare Interpolation zwischen typischen Farbstufen (rot – orange – gelb – grün – blau – violett). Keine Kalibrierung eines bestimmten Produkts. Die Indikatorstoffmenge bleibt konstant, die Farbe wird bei Zugabe schwächer (Verdünnung). Ohne Indikator bleiben Lösungen farblos; die Farbe ist abschaltbar, pH-Anzeige und Messwerte bleiben. **In Versuch 3 bleibt die Lösung farblos** (der pH-Wert kommt erst von der pH-Messelektrode).
- **Mischschlieren:** Die Schliere zeigt die Indikatorfarbe des lokal noch wenig vermischten Bereichs (Zugabe + wachsender Anteil der Lösung, aus dem Modell berechnet). Umrühren verkürzt Mischzeit und Schliere. Die Zeitkonstanten (1,6 s ohne, 0,3 s mit Rühren) sind didaktisch gewählt, keine gemessenen Mischzeiten.
- **Messwert (Versuche 1, 2):** Nach dem Auftreffen zeigt das pH-Messgerät „mischt …“ mit gleitendem Wert. Erst wenn die Mischung praktisch abgeschlossen ist, wird der stabile Modellwert als Kurvenpunkt protokolliert.
- **Messwert (Versuch 3):** Das Becherglas zeigt „pH –, nicht gemessen“, bis „Mischen und pH messen“ ausgelöst wird (3,0 s Modellzeit, Umrühren). Danach steht der Modellwert (`solve` der tatsächlich zugegebenen Stoffmengen) im Anzeigeschild, im Diagramm und im Messprotokoll. Weitere Zugabe verwirft den Anzeigewert; das Messprotokoll bleibt.
- **Teilchenmodell (Versuche 1, 2):** eine schematische Ansicht je Probe; jedes Teilchen ist eine beschriftete Plakette (Formel, Farbe, saure Form gestrichelt umrandet), keine Molekülzeichnung. 1 Symbol ≙ 0,2 mmol Puffer-Teilchen; die Symbolzahlen folgen dem Gleichgewicht (größte Reste). Freie H₃O⁺/OH⁻ sind stark vergrößert hervorgehoben; ihre Anzahl wächst um 1,5 Symbole je pH-Einheit Abstand von 7 (logarithmisch, nicht maßstäblich). Na⁺/Cl⁻ sind ausgeblendet, Wasser ist Hintergrund. Der pH-Wert stammt nie aus einer Zählung von Symbolen. Eine Protonenübertragungs-Zeitlupe gibt es nicht mehr.
- **Mischungsverhältnis-Diagramm (Versuch 3):** gestapelter 100-%-Balken HA | A⁻, zwei Säulen mit gemeinsamer mmol-Achse und die Zahlen n(HA), n(A⁻), n(A⁻)/n(HA) – alle aus `pairAmounts` der **tatsächlich zugegebenen** Stoffmengen. Während der Rechenphase gibt es keinen Soll-Balken; der Ziel-pH steht nur im Aufgabentext und (rot gestrichelt) in der pH-Kurve.
- **pH-Kurve (Versuch 3):** Messpunkte pH gegen lg[n(A⁻)/n(HA)] mit der idealen Geraden pH = pKₛ + lg x; Punkte erscheinen erst nach einer Messung.
- **Zeiten** (Fallzeit, Pipettenwege, Mischzeit) sind verlangsamt und keine Geschwindigkeitskonstanten.

## 4. Bewusste Korrekturen gegenüber den Unterrichtsvorlagen

1. Ein Puffer hält den pH-Wert **nicht exakt** konstant: Die Kurven zeigen von der ersten Zugabe an eine (kleine) Änderung, die mit fortschreitender Umwandlung zunimmt. Kein Sprung von „unverändert“ zu „erschöpft“ (Unit-Test „Zugabekurven“).
2. pH = pKₛ ist die **Mitte** eines Puffersystems bei gleichen Anteilen, nicht der ganze Bereich; die Faustregel pKₛ ± 1 wird als solche bezeichnet (Diagrammband „Faustregel ± 1“, Hinweise in Versuch 3).
3. Der Acetatpuffer 1 : 1 startet bei pH 4,75, nicht bei pH 7. Die Bildreferenz mit Anfangs-pH 7 und ohne Konzentrationen wurde nicht übernommen.
4. **Phosphat-Rezept der Vorlage inkonsistent:** 1,78 g Na₂HPO₄·2H₂O ≈ 0,10 mol/L und 0,78 g NaH₂PO₄·2H₂O ≈ 0,05 mol/L auf 100 mL ergeben etwa 2 : 1, nicht 1 : 1. Die App verwendet eine definierte 1 : 1-Modelllösung (je 0,050 mol/L). Ein zertifizierter pH-7-Kalibrierpuffer ist kein ideales 1 : 1-Gemisch mit pH 7,00 (vgl. NBS-Phosphatstandard 0,025/0,025 mol/kg: pH 6,863 bei 25 °C).
5. Die drei Bereiche um pH 2/7/12 gehören zu den drei Stufen der Phosphorsäure, nicht zum Acetatpuffer. In der App werden Bereiche nur stufenbezogen gezeigt (Versuch 1: nur pKₛ₂).
6. **Blut:** effektives System CO₂* = CO₂(aq) + H₂CO₃ mit pK′ ≈ 6,1 bei 37 °C; c(CO₂*) ≈ α · pCO₂ (α ≈ 0,03 mmol/(L·mmHg)). Das Verhältnis ≈ 20 : 1 bezieht sich auf HCO₃⁻ zu CO₂*, nicht auf molekulare H₂CO₃ (echter pKₛ ≈ 3,5). Der effektive Wert wird nicht mit dem 25-°C-Labormodell vermischt. 20 : 1 liegt außerhalb der Faustregel; erklärt wird das über das offene System (Lunge, Niere), ohne „Blut ist kein Puffer“ zu behaupten.
7. Reine Essigsäure bzw. reine Acetatlösung „können nicht puffern“ wird **nicht** behauptet: Essigsäure setzt zugegebene Lauge um (es entsteht Acetat), Acetat setzt Säure um (es entsteht Essigsäure). Die Kurven und das Teilchenmodell zeigen das; Aufgaben und Rückmeldungen formulieren es entsprechend (Versuch 2).
8. Wasserzugabe zu einem Puffer erhält die Stoffmengen und damit die Gesamtreserve; nur die Kapazität pro Volumen sinkt. Die Einsicht „Kapazität hängt von den vorhandenen Stoffmengen ab“ steht in der Herleitung (Abschnitt „Pufferbereich ≠ Pufferkapazität“) und im Hefteintrag, nicht mehr als eigener Versuch (der frühere Versuch 4 „Verdünnung“ entfällt in 0.2.0).
9. Die Vorlagenkonzentrationen (1-molare Stammlösungen, 4 M bei Schunk) wurden nicht übernommen; es gelten die moderaten Parameter aus Abschnitt 2.

## 5. Grenzen des Modells

- **Aktivität und Ionenstärke** werden nicht berücksichtigt. Reale Pufferlösungen weichen deshalb um einige Hundertstel bis Zehntel vom idealen Wert ab (z. B. Phosphatpuffer 0,05/0,05 mol/L real deutlich unter 7,20; 0,1 mol/L-Lösungen haben bereits eine merkliche Ionenstärke).
- **Konstanten** gelten für 25 °C; temperaturabhängige pKₛ-Werte werden nicht modelliert (Ausnahme: der fest vorgegebene effektive Blutwert in Aufgabe 6). Der pKₛ von NH₄⁺ sinkt mit steigender Temperatur deutlich (≈ −0,03 je K).
- **NH₃(aq) wird als idealisiertes, geschlossenes System behandelt.** Reale Ammoniaklösungen verlieren NH₃ an die Luft (Flüchtigkeit); in der App bleibt die Stoffmenge erhalten. Auch Aktivitätseffekte und Ionenstärke fehlen (Cl⁻ aus NH₄Cl, Na⁺ aus Salzen).
- **Modellwasser ist CO₂-frei**; reales, an der Luft stehendes Wasser ist leicht sauer (oft pH 5–6) und muss nicht pH 7 haben. Offene Systeme (Blut, Gewässer) sind nur in den Anwendungen beschrieben, nicht simuliert.
- Keine kinetische oder thermodynamische Simulation: Säure-Base-Reaktionen werden als augenblicklich im Gleichgewicht angenommen; Animationszeiten sind didaktisch.
- Indikatorfarben sind schematisch; die Indikatorsäure selbst wird in der Bilanz vernachlässigt.
- Die Gleichung pH = pKₛ + lg[n(A⁻)/n(HA)] gilt hier mit formalen Stoffmengen als Näherung; die Rechnung im Versuch ist trotzdem genau genug, um die Standardaufgaben auf ≤ 0,05 pH zu treffen (Abschnitt 2).

## 6. Quellen (geprüft am 27.10.2026)

| Aussage | Quelle |
| --- | --- |
| H-H-Gleichung pH = pKₐ + lg([A⁻]/[HA]); Kapazität hängt von den Stoffmengen der Partner ab; ein Puffer braucht vergleichbare Mengen, unter etwa 10 % eines Partners kaum noch wirksam (entspricht pKₛ ± 1) | OpenStax Chemistry 2e, 14.6 „Buffers“ (Abschnitte „The Henderson-Hasselbalch Equation“, „Buffer Capacity“, „Selection of Suitable Buffer Mixtures“), https://openstax.org/books/chemistry-2e/pages/14-6-buffers |
| Kₐ-Werte 25 °C (Essigsäure, Phosphorsäure-Stufen), K_b(NH₃) und damit pKₛ(NH₄⁺) ≈ 9,25 | OpenStax Chemistry 2e, Anhang H und I |
| Kapazitätsmaximum bei pH = pKₐ, Faustregel pKₐ ± 1 (Sekundärbeleg) | https://en.wikipedia.org/wiki/Buffer_solution, „Buffer capacity“ |
| Blut: pH = 6,1 + lg([HCO₃⁻]/(0,03 · pCO₂)); 24 mM / 1,2 mM ≈ 20 : 1 bei pH 7,4; Wirksamkeit trotz pK 6,1 durch offenes System | Kuwait University, Acid-Base Principles II, https://www.hsc.edu.kw/student/materials/course_notes/renal/OutAcid2.htm |
| 20 : 1, Lunge regelt CO₂, Niere HCO₃⁻ (Stunden bis Tage) | OpenStax Anatomy & Physiology 2e, 26.4, https://openstax.org/books/anatomy-and-physiology-2e/pages/26-4-acid-base-balance |
| Arterieller pH etwa 7,37–7,43 | MSD Manual Professional, Acid-Base Regulation |
| Echter pKₐ(H₂CO₃) = 3,49; scheinbarer pKₐ (inkl. CO₂(aq)) 6,35 bei 25 °C | Pines et al., J. Phys. Chem. B 2016, https://pmc.ncbi.nlm.nih.gov/articles/PMC5747581/ |
| Alkalinität = Säureneutralisationsvermögen, v. a. HCO₃⁻/CO₃²⁻, kein einzelner Stoff | USGS Water Science School, https://www.usgs.gov/water-science-school/science/alkalinity-and-water; USGS TWRI 9-A6, Abschnitt 6.6 |
| pH-Skala über zertifizierte Standardpuffer, temperaturabhängige pH(S), Bates-Guggenheim-Konvention; Phosphat 0,025/0,025 m: pH 6,863 (25 °C) | NBS SP 260-53 (Durst 1975), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nbsspecialpublication260-53.pdf |
| Lehrplan: Pufferwirkung erklären, Puffer auswählen; H-H am Acetatpuffer; Puffersäure/-base, Pufferkapazität; Carbonat- und Phosphatpuffer; Medizin, Umwelt, Technik | LehrplanPLUS Chemie 13 eA, LB 3, https://www.lehrplanplus.bayern.de/fachlehrplan/gymnasium/13/chemie/erhoeht |
| Vergleichsversuch Essigsäure ↔ Essigsäure/Acetat mit Indikator | Schunk, Experiment des Monats 02/2009, http://www.experimente.axel-schunk.de/edm0902.html |

Hinweise: „Pufferbereich“ und „Blutpuffer“ nennt der Lehrplan nicht ausdrücklich; beide sind Vertiefung (Carbonatpuffer und Medizinbezug sind gedeckt). OpenStax 14.6 rechnet beim Blut mit pKₐ 6,4 und kommt so zu einem Widerspruch zu pH 7,4 – die App verwendet stattdessen pK′ = 6,1 bei 37 °C. Die Unterrichts-PDFs des Auftraggebers sind Material, keine Laufzeitabhängigkeit; ihre Inhalte und Korrekturen stehen in Abschnitt 4.
