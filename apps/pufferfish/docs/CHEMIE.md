# Pufferfish – Chemisches Modell, Parameter und Quellen

Stand 0.1.0 · 27.10.2026

## 1. Modell

**Ideales Konzentrationsmodell bei 25 °C.** Der pH-Wert jeder Probe folgt aus der vollständigen Ladungsbilanz mit Wasserautoprotolyse (`js/chem.js`, `solve`):

    c(H₃O⁺) + c(Na⁺) = c(OH⁻) + c(Cl⁻) + c(CH₃COO⁻) + c(H₂PO₄⁻) + 2·c(HPO₄²⁻) + 3·c(PO₄³⁻)

- Essigsäure/Acetat und **alle drei Protolysestufen** der Phosphorsäure werden über ihre Anteilsfunktionen berücksichtigt; Phosphat ist also nicht künstlich einprotonig.
- Na⁺ aus Natriumacetat, NaH₂PO₄, Na₂HPO₄ und NaOH sowie Cl⁻ aus HCl werden als Gegenionen bilanziert. Jede Zugabe erhöht das Gesamtvolumen.
- Die linke minus die rechte Seite wächst streng monoton mit c(H₃O⁺). Die Nullstelle wird per Bisektion in lg c(H₃O⁺) gesucht (Bereich 10⁻¹⁶ … 10² mol/L, Abbruch bei 10⁻¹³ in lg). Dadurch entstehen auch weit jenseits der Pufferkapazität weder negative Konzentrationen noch Logarithmusfehler. Der pH-Wert wird nicht auf 0–14 geklemmt; in den Standardversuchen liegt er zwischen etwa 1 und 13.
- **Formale Bilanz** (`formal`): die nach vollständigem stöchiometrischem Umsatz der starken Säure/Base verbliebenen Stoffmengen, mit denen in der Schule gerechnet wird. Sie wird getrennt von den Gleichgewichtsmengen aus `solve` geführt. Die Henderson-Hasselbalch-Rechnung (`hh`) liefert `null`, sobald ein Partner fehlt – negative oder verschwindende Restmengen werden nie logarithmiert. Die App zeigt dann „H-H nicht anwendbar“ und nennt den Überschuss; der interne Solver rechnet weiter.
- **Reaktionsweg einer Zugabe** (`doseAnalysis`): Aus dem Gleichgewicht vor und nach der Zugabe folgt über die Protonenbilanz, welcher Anteil der zugegebenen H₃O⁺ bzw. OH⁻ vom schwachen System umgesetzt wurde, welcher mit freiem OH⁻ bzw. H₃O⁺ neutralisiert wurde und welcher frei blieb. Der überwiegende Weg bestimmt die Zeitlupe (Protonenübertragung auf A⁻/HPO₄²⁻ bzw. von HA/H₂PO₄⁻, H₃O⁺ + OH⁻ → 2 H₂O oder „bleibt frei“). Beim Phosphat wird die zur Lage des pH passende Stufe gewählt.

## 2. Parameter

| Größe | Wert | Bemerkung |
| --- | --- | --- |
| Kw | 1,0 · 10⁻¹⁴ | 25 °C |
| pKₛ(CH₃COOH) | 4,75 | OpenStax-Tabelle: Kₐ = 1,8 · 10⁻⁵ → 4,74 |
| pKₛ₁/pKₛ₂/pKₛ₃ (H₃PO₄) | 2,15 / 7,20 / 12,35 | OpenStax: 2,12 / 7,21 / 12,38 (Abweichung ≤ 0,03) |
| pKₛ(NH₄⁺) (nur Aufgabe 5) | 9,25 | OpenStax über K_b(NH₃): 9,26 |
| pK′ Blut (nur Aufgabe 6) | 6,10 | effektiv, 37 °C, CO₂*/HCO₃⁻ |
| c(HCl), c(NaOH) | 0,100 mol/L | Maßlösungen |
| Tropfen | 0,050 mL | **vereinbarte Simulationsgröße**, keine Naturkonstante |
| Messpipette | 0,5 / 1,0 / 5,0 mL | Dosierhilfe für Kapazitätsuntersuchungen |
| Probenvolumen | 30,0 mL | alle Standardproben; aufgefüllter Puffer 300 mL im 400-mL-Glas |

Proben (`js/engine.js`, `SAMPLES`):

| Versuch | Probe | Zusammensetzung | Anfangs-pH (Modell) |
| --- | --- | --- | --- |
| 1 | Wasser | CO₂-freies Modellwasser | 7,00 |
| 1 | „Wunderwasser“ | c(H₂PO₄⁻) = c(HPO₄²⁻) = 0,050 mol/L (Na-Salze) | 7,20 |
| 2 | Essigsäure | 0,100 mol/L | 2,88 |
| 2 | Natriumacetat | 0,100 mol/L | 8,88 |
| 2 | Gemisch 1 : 1 | je 0,050 mol/L | 4,75 |
| 3 | HA : A⁻ = 10 : 1 / 3 : 1 / 1 : 1 / 1 : 3 / 1 : 10 | gesamt 0,100 mol/L | 3,76 … 5,75 |
| 4 | Puffer 0,10 / 0,010 mol/L | 1 : 1, je 30 mL | 4,75 / 4,75 |
| 4 | Puffer aufgefüllt | 30 mL 0,10 mol/L + 270 mL Wasser | 4,75 |

Alle Anfangswerte ergeben sich aus dem Modell; keine Probe wird versteckt auf einen Zielwert angepasst. Wasser und Phosphatpuffer starten deshalb verschieden (7,00 und 7,20).

## 3. Darstellungsmodelle (bewusst schematisch)

- **Universalindikator:** lineare Interpolation zwischen typischen Farbstufen (rot – orange – gelb – grün – blau – violett). Keine Kalibrierung eines bestimmten Produkts. Die Indikatorstoffmenge bleibt konstant, die Farbe wird bei Zugabe schwächer (Verdünnung). Ohne Indikator bleiben Lösungen farblos; die Farbe ist abschaltbar, pH-Anzeige und Messwerte bleiben.
- **Mischschlieren:** Die Schliere zeigt die Indikatorfarbe des lokal noch wenig vermischten Bereichs (Zugabe + wachsender Anteil der Lösung, aus dem Modell berechnet). Umrühren verkürzt Mischzeit und Schliere. Die Zeitkonstanten (1,6 s ohne, 0,3 s mit Rühren) sind didaktisch gewählt, keine gemessenen Mischzeiten.
- **Messwert:** Nach dem Auftreffen zeigt das pH-Messgerät „mischt …“ mit gleitendem Wert. Erst wenn die Mischung praktisch abgeschlossen ist (und die Zeitlupe der ersten Zugabe abgelaufen ist), wird der stabile Modellwert als Kurvenpunkt protokolliert.
- **Teilchenebene:** 1 Symbol ≙ 0,125 mmol Puffer-Teilchen; die Symbolzahlen folgen dem Gleichgewicht (größte Reste), sodass Stoffmengen- und Verdünnungsunterschiede sichtbar werden (Puffer 0,010 mol/L: nur zwei Symbole). Freie H₃O⁺/OH⁻ sind stark vergrößert hervorgehoben; ihre Anzahl wächst um 1,5 Symbole je pH-Einheit Abstand von 7 (logarithmisch, nicht maßstäblich). Na⁺/Cl⁻ sind ausgeblendet, Wasser ist Hintergrund. Der pH-Wert stammt nie aus einer Zählung von Symbolen.
- **Zeitlupe:** eine schematische, zeitlich vergrößerte Folge je Zugabe – Zugabe trifft ein → Annäherung → Protonenübertragung (Proton auf einem Bogen) → Produkte trennen sich → Bestand aktualisiert. Ein Tropfen (0,005 mmol) wandelt kein ganzes Symbol um; der Bestand ändert sich erst, wenn die Stoffmengen eine Symbolschwelle überschreiten. Atom- und Ladungserhaltung sind in jeder Folge erfüllt.
- **Zeiten** (Fallzeit, Pipettenwege, Zeitlupe) sind verlangsamt und keine Geschwindigkeitskonstanten.

## 4. Bewusste Korrekturen gegenüber den Unterrichtsvorlagen

1. Ein Puffer hält den pH-Wert **nicht exakt** konstant: Die Kurven zeigen von der ersten Zugabe an eine (kleine) Änderung, die mit fortschreitender Umwandlung zunimmt. Kein Sprung von „unverändert“ zu „erschöpft“ (Unit-Test „Zugabekurven“).
2. pH = pKₛ ist die **Mitte** eines Puffersystems bei gleichen Anteilen, nicht der ganze Bereich; die Faustregel pKₛ ± 1 wird als solche bezeichnet (Diagrammband „Faustregel ± 1“).
3. Der Acetatpuffer 1 : 1 startet bei pH 4,75, nicht bei pH 7. Die Bildreferenz mit Anfangs-pH 7 und ohne Konzentrationen wurde nicht übernommen.
4. **Phosphat-Rezept der Vorlage inkonsistent:** 1,78 g Na₂HPO₄·2H₂O ≈ 0,10 mol/L und 0,78 g NaH₂PO₄·2H₂O ≈ 0,05 mol/L auf 100 mL ergeben etwa 2 : 1, nicht 1 : 1. Die App verwendet eine definierte 1 : 1-Modelllösung (je 0,050 mol/L). Ein zertifizierter pH-7-Kalibrierpuffer ist kein ideales 1 : 1-Gemisch mit pH 7,00 (vgl. NBS-Phosphatstandard 0,025/0,025 mol/kg: pH 6,863 bei 25 °C).
5. Die drei Bereiche um pH 2/7/12 gehören zu den drei Stufen der Phosphorsäure, nicht zum Acetatpuffer. In der App werden Bereiche nur stufenbezogen gezeigt (Versuch 1: nur pKₛ₂).
6. **Blut:** effektives System CO₂* = CO₂(aq) + H₂CO₃ mit pK′ ≈ 6,1 bei 37 °C; c(CO₂*) ≈ α · pCO₂ (α ≈ 0,03 mmol/(L·mmHg)). Das Verhältnis ≈ 20 : 1 bezieht sich auf HCO₃⁻ zu CO₂*, nicht auf molekulare H₂CO₃ (echter pKₛ ≈ 3,5). Der effektive Wert wird nicht mit dem 25-°C-Labormodell vermischt. 20 : 1 liegt außerhalb der Faustregel; erklärt wird das über das offene System (Lunge, Niere), ohne „Blut ist kein Puffer“ zu behaupten.
7. Reine Essigsäure bzw. reine Acetatlösung „können nicht puffern“ wird **nicht** behauptet: Essigsäure setzt zugegebene Lauge um (es entsteht Acetat), Acetat setzt Säure um (es entsteht Essigsäure). Das zeigen Kurven und Zeitlupe.
8. Wasserzugabe zu einem bestehenden Puffer erhält die Stoffmengen und damit die Gesamtreserve; nur die Kapazität pro Volumen sinkt (Versuch 4, Probe „aufgefüllt“). Davon unterschieden: zehnfach verdünnt hergestellter Puffer gleichen Volumens mit einem Zehntel der Stoffmengen.
9. Die Vorlagenkonzentrationen (1-molare Stammlösungen, 4 M bei Schunk) wurden nicht übernommen; es gelten die moderaten Parameter aus Abschnitt 2.

## 5. Grenzen des Modells

- **Aktivität und Ionenstärke** werden nicht berücksichtigt. Reale Pufferlösungen weichen deshalb um einige Hundertstel bis Zehntel vom idealen Wert ab (z. B. Phosphatpuffer 0,05/0,05 mol/L real deutlich unter 7,20).
- **Konstanten** gelten für 25 °C; temperaturabhängige pKₛ-Werte werden nicht modelliert (Ausnahme: der fest vorgegebene effektive Blutwert in Aufgabe 6).
- **Modellwasser ist CO₂-frei**; reales, an der Luft stehendes Wasser ist leicht sauer (oft pH 5–6) und muss nicht pH 7 haben.
- Keine kinetische oder thermodynamische Simulation: Säure-Base-Reaktionen werden als augenblicklich im Gleichgewicht angenommen; Animationszeiten sind didaktisch.
- Indikatorfarben sind schematisch; die Indikatorsäure selbst wird in der Bilanz vernachlässigt.

## 6. Quellen (geprüft am 27.10.2026)

| Aussage | Quelle |
| --- | --- |
| H-H-Gleichung pH = pKₐ + lg([A⁻]/[HA]); Kapazität hängt von den Stoffmengen der Partner ab; ein Puffer braucht vergleichbare Mengen, unter etwa 10 % eines Partners kaum noch wirksam (entspricht pKₛ ± 1) | OpenStax Chemistry 2e, 14.6 „Buffers“ (Abschnitte „The Henderson-Hasselbalch Equation“, „Buffer Capacity“, „Selection of Suitable Buffer Mixtures“), https://openstax.org/books/chemistry-2e/pages/14-6-buffers |
| Kₐ-Werte 25 °C (Essigsäure, Phosphorsäure-Stufen), K_b(NH₃) | OpenStax Chemistry 2e, Anhang H und I |
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
