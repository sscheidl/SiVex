# Fachmodell, Quellen und Näherungsgrenzen

Stand 0.1.0 (27.10.2026). Zielgruppe: Gymnasium Bayern, Q13 Chemie, erhöhtes Anforderungsniveau, Lernbereich 3 „Säure-Base-Gleichgewichte – Quantitative Analytik und deren Anwendung“ ([LehrplanPLUS](https://www.lehrplanplus.bayern.de/fachlehrplan/gymnasium/13/chemie/erhoeht)).

## 1. Versuche und Mengen

Alle Proben: 20,00 mL (Vollpipette), anschließend 30 mL destilliertes Wasser. Ohne Verdünnung wären die Glasmembran und das Diaphragma der Elektrode im 100-mL-Erlenmeyerkolben nicht bedeckt. Das Modell rechnet mit genau 30 mL. Maßlösungen NaOH und HCl haben je 0,100 mol/L, die Bürette fasst 50 mL bei einer Ablesung auf 0,01 mL.

| Versuch | Probe | Maßlösung | V(ÄP) stöchiometrisch | V(HÄP) |
| --- | --- | --- | --- | --- |
| 1 | Essigsäure, 0,120 mol/L | NaOH | 24,00 mL | 12,00 mL |
| 2 | Ammoniaklösung, 0,090 mol/L | HCl | 18,00 mL | 9,00 mL |
| 3 | Phosphorsäure, 0,050 mol/L | NaOH | 10,00 / 20,00 (30,00) mL | 5,00 / 15,00 mL |
| 4 | Glycinhydrochlorid, 0,060 mol/L | NaOH | 12,00 / 24,00 mL | 6,00 / 18,00 mL |

Alle Standardversuche lassen sich mit einer Bürettenfüllung abschließen. Der Erstdurchgang braucht höchstens etwa 28 mL, die Halbtitration höchstens 18 mL. Zwischen zwei Proben kann nachgefüllt werden.

Die Ausgangskonzentrationen stehen in der Planung. Die gesuchten pK-Werte erscheinen erst nach der Abgabe des eigenen Ergebnisses.

## 2. Gleichgewichtsmodell (`js/model/chemistry.js`)

Jedes Protolysesystem wird als mehrstufige Säure HₙA beschrieben. z₀ ist die Ladung der vollständig protonierten Form:

| System | z₀ | Formen (0, 1, 2 … abgegebene Protonen) |
| --- | --- | --- |
| Essigsäure | 0 | CH₃COOH, CH₃COO⁻ |
| Ammoniak | +1 | NH₄⁺, NH₃ (die Probe wird als NH₃ eingesetzt) |
| Phosphorsäure | 0 | H₃PO₄, H₂PO₄⁻, HPO₄²⁻, PO₄³⁻ (alle drei Stufen im Modell) |
| Glycin | +1 | H₃N⁺–CH₂–COOH, H₃N⁺–CH₂–COO⁻, H₂N–CH₂–COO⁻; Cl⁻ als Gegenion |

Die Anteile der Formen sind α_j ∝ (K₁·…·K_j) / c(H₃O⁺)^j. Gelöst wird bei jeder Zusammensetzung die Ladungsbilanz

  c(H₃O⁺) + c(Na⁺) + C · Σ α_j (z₀ − j) = c(OH⁻) + c(Cl⁻),   c(OH⁻) = K_W / c(H₃O⁺)

mit Stoff- und Volumenbilanzen:

- C = c(Probe) · 20 mL / V(gesamt)
- Na⁺ bzw. Cl⁻ stammen aus der Maßlösung.
- Beim Glycinhydrochlorid kommt Cl⁻ zusätzlich aus der Probe, genau 1 mol je mol Glycin. Es wird keine weitere Salzsäure zugesetzt.
- V(gesamt) = 20 mL + 30 mL + V(Maßlösung).

Die linke minus die rechte Seite steigt streng monoton in c(H₃O⁺). Gelöst wird durch Bisektion in lg c(H₃O⁺) mit einer Genauigkeit unter 10⁻¹² in lg. Es gibt keine stückweisen Formeln, keine Splines und keine an Literaturwerte angepassten Punkte. Die schulischen Näherungsformeln (Abschnitt 4) sind ausschließlich Gegenstand der Schülerrechnung.

Annahmen und Einheiten:

- 25 °C, pK_W = 14,00 als dokumentierte Modellannahme (tabelliert sind 13,995)
- ideal verdünnte Lösung, also Aktivitäten gleich Konzentrationen
- NaOH und HCl vollständig protolysiert
- Volumina additiv
- Der Indikator hat keinen Einfluss auf den pH-Wert.
- Einheiten: mL, mol/L, mmol

## 3. Literaturdaten

Durchgängig ein Datensatz:

> A. E. Martell, R. M. Smith: *Critical Stability Constants*, Bd. 1–4, Plenum, New York 1974–1976. Tabelliert in D. Harvey: *Analytical Chemistry 2.1*, Anhang 16.11 „Acid Dissociation Constants“ (LibreTexts). Bedingungen: 25 °C, Ionenstärke 0 (thermodynamische Werte).

| Größe | Modell (Tabellenwert) | Literatur für die Schülerrechnung (gerundet) |
| --- | --- | --- |
| pKₛ(CH₃COOH) | 4,757 | 4,76 |
| pKₛ(NH₄⁺) | 9,244 | 9,24; pK_B(NH₃) = 14,00 − 9,24 = 4,76 |
| pKₛ1/2/3(H₃PO₄) | 2,148 / 7,199 / 12,35 | 2,15 / 7,20 / 12,35 |
| pKₛ1/2(Glycin) | 2,350 / 9,778 | 2,35 / 9,78 |

Abweichungen zu den im Auftrag genannten Ausgangswerten:

- **Glycin:** Häufige Schultabellen nennen 2,34 / 9,60. Diese Werte stammen aus anderen Tabellen und gelten meist für eine Ionenstärke um 0,1 mol/L. Der Wert 9,60 wurde deshalb nicht mit den I = 0-Werten der übrigen Stoffe gemischt.
- **Phosphorsäure:** Der Datensatz enthält 12,35 für die dritte Stufe. Diese Stufe ist in der Schülerauswertung nicht vorgesehen.

Die Lehrkraft kann diese Wahl fachlich prüfen und bei Bedarf in `LITERATURE` und `SYSTEMS` ändern. Beide müssen dann aus derselben Tabelle stammen.

## 4. Halbäquivalenzpunkt und Näherungen

Am stöchiometrischen HÄP gilt pH = pKₛ nur näherungsweise. Das Modell erzwingt keine Treffer; die Abweichungen ergeben sich aus der Gleichgewichtsrechnung:

| Punkt | Modell-pH | Näherung | Ursache der Differenz |
| --- | --- | --- | --- |
| Essigsäure HÄP (12,00 mL) | 4,758 | 4,757 | vernachlässigbar |
| Ammoniak HÄP (9,00 mL) | 9,243 (pOH 4,757) | 9,244 | vernachlässigbar |
| Phosphorsäure HÄP 1 (5,00 mL) | 2,48 | 2,15 | starke erste Stufe: H₃PO₄ protolysiert selbst erheblich, c(H₂PO₄⁻) > c(H₃PO₄) |
| Phosphorsäure HÄP 2 (15,00 mL) | 7,20 | 7,20 | gering |
| Glycin HÄP 1 (6,00 mL) | 2,57 | 2,35 | wie oben, Carboxygruppe |
| Glycin HÄP 2 (18,00 mL) | 9,77 | 9,78 | gering (OH⁻-Beitrag) |

Schulische Rechenansätze, die die App prüft (`Evaluation.theoryPoints`):

- **Startpunkt, schwache Säure bzw. Base:** pH = ½(pKₛ − lg c₀) bzw. pOH = ½(pK_B − lg c₀), mit c₀ nach dem Verdünnen. Gültig ist das bei einem Protolysegrad unter etwa 5 %. Bei Phosphorsäure (≈ 44 %) und Glycin (≈ 35 %) ist der quadratische Ansatz K = x²/(c₀ − x) nötig. Die einfache Näherung wird dort als „rechnerisch richtig, aber außerhalb der Gültigkeit“ erkannt.
- **HÄP:** pH = pKₛ bzw. pH = 14,00 − pK_B.
- **ÄP Essigsäure und Ammoniak:** Acetat bzw. NH₄⁺ als schwache Base bzw. Säure, mit c = n / V(gesamt) (Verdünnung durch die Maßlösung!).
- **1. ÄP Phosphorsäure und Glycin (Ampholyt):** pH ≈ ½(pKₛ1 + pKₛ2). Beim Glycin ist das der isoelektrische Punkt.

Die Modellreferenz (numerischer Solver) wird nach der Freigabe zusätzlich angezeigt. Näherungen und Modell werden getrennt beschriftet.

## 5. Mehrprotonige Systeme

- **Stufenbezogene Volumina:** V(HÄP,1) = V(ÄP,1)/2 und V(HÄP,2) = [V(ÄP,1) + V(ÄP,2)]/2. Die Eingabe V(ÄP,2)/2 wird gezielt erkannt und erklärt.
- **Phosphorsäure:** Im Modell wirken alle drei Gleichgewichte. Um V = 30 mL gibt es keinen ausgeprägten dritten Sprung; ein Unit-Test prüft das.
- **Glycin:** Der zweite Äquivalenzpunkt (24 mL, pH ≈ 11) zeigt keinen belastbaren Sprung. Die SuS können V(ÄP,2) = 2 · V(ÄP,1) aus der definierten Ausgangszusammensetzung ableiten. Die Rechenbasis ist dann als „abgeleitet“ gekennzeichnet.
- **Speziesanzeige im Labor:** Hervorgehoben werden die nach der Stöchiometrie überwiegenden Formen. Gleichgewichtsanteile erscheinen nicht, weil sie den HÄP verraten würden. Ein Hinweis stellt klar, dass auch Nachbarformen vorliegen.

## 6. Indikatoren

Die Farben stammen aus TitraLab 3: Lambert-Beer-Mischung der Formen HIn/In⁻. Die Umschlagsbereiche sind übliche Tabellenwerte:

| Indikator | Bereich |
| --- | --- |
| Methylorange | 3,1–4,4 |
| Methylrot | 4,4–6,2 |
| Bromthymolblau | 6,0–7,6 |
| Phenolphthalein | 8,2–10,0 |
| Thymolphthalein | 9,3–10,5 |

Als Endpunkt-pH gilt bei zweifarbigen Indikatoren die Mischfarbe (pKₛ(HIn)). Bei einfarbigen Indikatoren ist es das erste deutliche Auftreten bzw. Verschwinden der Farbe (Anteil In⁻ ≈ 10 %).

Bewertet wird nach dem Volumenfehler V(Umschlag) − V(ÄP), nicht nach dem Namen:

- geeignet: bis 0,5 %
- bedingt geeignet: bis 3 %
- ungeeignet: darüber

Begründung der Grenzen: Die Ablesung von 0,02 mL bei etwa 20 mL entspricht 0,1 %; 0,5 % ist eine übliche Schulgenauigkeit. Ergebnisse der Modellrechnung:

| Versuch, ÄP | geeignet | bedingt | ungeeignet |
| --- | --- | --- | --- |
| Essigsäure | Phenolphthalein, Thymolphthalein | Bromthymolblau (0,6 %) | Methylrot, Methylorange |
| Ammoniak | Methylrot, Methylorange (0,5 %) | Bromthymolblau | Phenolphthalein (14 %), Thymolphthalein |
| Phosphorsäure, ÄP 1 | – | Methylrot (0,6 %), Methylorange (2,4 %) | übrige |
| Phosphorsäure, ÄP 2 | Thymolphthalein | Phenolphthalein (2,6 %) | übrige |
| Glycin, ÄP 1 | Methylrot, Bromthymolblau | – | übrige |
| Glycin, ÄP 2 | – | – | alle; nur pH-metrisch auswertbar |

In der Planung prüft die App nur die Stimmigkeit der Wahl mit der eigenen Erwartung am ÄP. Die quantitative Bewertung erscheint nach dem Erstdurchgang an der eigenen Kurve, sobald V(ÄP) richtig berechnet ist. Schlechte Eignung ist ein zulässiges Ergebnis: Die pK-Bestimmung erfolgt immer pH-metrisch.

## 7. Messsimulation (`js/experiment/lab.js`)

- Tropfen zu 0,05 mL, Fließrate 0,01 bis 1,0 mL/s. Das Volumen kommt erst beim Aufprall in die Lösung. Die Bilanz dispensed = delivered + hängender Tropfen + fallende Tropfen gilt in jedem Zeitschritt.
- Bürettenstand = Anfangsstand + abgegebenes Volumen. Nachfüllen ändert nur den Stand, nie das abgegebene Volumen.
- **Durchmischung:** Frisch angekommene Maßlösung bleibt zunächst unvermischt. Der Rest zerfällt exponentiell, mit Rührer in τ = 1 s, ohne Rührer in τ = 45 s. Die Elektrode sieht nur den vermischten Teil.
- **Elektrode:** Ansprechzeit τ = 2,2 s, Anzeige auf 0,01 gerundet. „Stabil“ meldet das Gerät nach 2 s, in denen die Drift unter 0,004 pH/s bleibt – wie ein reales pH-Meter, also ohne Kenntnis des Modells.
- **Messstatus:** Mit protokolliert werden stabil, Zugabe abgeschlossen und durchmischt. Ein Wert gilt als durchmischt, wenn der unvermischte Rest den pH um weniger als 0,003 verschiebt.
- Kein Zufallsrauschen. Fehler entstehen nur durch Handlungen: Volumen nicht getroffen, zu frühe Übernahme, kein Rühren, Ablesefehler an der Bürette.
- Kalibrierung mit zwei Puffern ist eine Gerätevorbereitung (Handlung mit 3 s Dauer). Ein Kalibrierfehler wird nicht simuliert.

## 8. Fehlerbetrachtung nach der Freigabe

Die Abweichung pK(exp.) − pK(Lit.) wird zerlegt in:

1. **Durchführung, Volumen:** Modell-pH am gemessenen Volumen minus Modell-pH am stöchiometrischen HÄP
2. **Durchführung, Ablesung:** Anzeige minus Gleichgewichts-pH, also vor dem Gleichgewicht oder vor der Durchmischung abgelesen
3. **Näherung/Modell:** Modell-pH am HÄP minus Modell-pK
4. **Rundung des Literaturwerts**

Rechenfehler werden getrennt über die Feldprüfung gemeldet. Eine korrekte Rechnung mit ungenauem eigenen Messwert gilt als rechnerisch richtig.

## 9. Grenzen

- **Aktivitäten:** Das Modell rechnet ideal mit den thermodynamischen Konstanten (I = 0). Reale Messungen bei I ≈ 0,05–0,1 mol/L liefern merklich kleinere scheinbare pKₛ-Werte; beim Glycin liegt pKₛ2 dann etwa bei 9,6. In der Simulation hat diese Ursache keine Wirkung. Die Fehlerbetrachtung kennzeichnet sie als „im realen Labor relevant“.
- **Feste Bedingungen:** Keine Temperaturabhängigkeit, kein CO₂-Eintrag, keine Elektrodenfehler wie Alkalifehler, Drift oder Kalibrierfehler.
- **Endpunkt:** Den beobachteten Endpunkt setzen die Lernenden selbst. Die rechnerische Bewertung nutzt einen festen Endpunkt-pH je Indikator.
- **Wasserzugabe:** Die 30 mL Wasser sind im Modell exakt. Real misst man sie mit dem Messzylinder ab; die Wirkung auf pH(HÄP) wäre gering.

## Quellen

- OpenStax: Chemistry: Atoms First 2e, 14.7 Acid-Base Titrations – https://openstax.org/books/chemistry-atoms-first-2e/pages/14-7-acid-base-titrations
- UMass Boston, Ch104 (schwache Basen, pOH am HÄP) – https://alpha.chem.umb.edu/chemistry/ch104/carter/files/104overheads/Ch104BrownCh17ov2.pdf
- Universität Köln, Quantitative Analyse, Seminar 3 (mehrprotonige Säuren, Erkennbarkeit von Stufen) – https://www.uni-koeln.de/math-nat-fak/anorgchem/meyer/mitarbeit/pantenburg/praktikum/ws11_12/QuantiSeminar3.pdf
- Universität Greifswald, Glaselektrode und Titration von Glycinhydrochlorid – https://biochemie.uni-greifswald.de/storages/uni-greifswald/fakultaet/mnf/biochemie/delcea/Teaching/W03-Glaselektrode_Bcs.pdf (der Text des PDFs ließ sich in dieser Umgebung nicht auslesen; die Glycinwerte stammen deshalb aus dem oben genannten Datensatz)
- Universität Bayreuth, Aminosäuren – https://daten.didaktikchemie.uni-bayreuth.de/umat/aminosaeuren/Aminosaeuren.pdf
- Huefner/Richmond, Indikatorvergleich bei Ammoniak – https://doi.org/10.1007/s00897000392a
- Martell/Smith über D. Harvey, Analytical Chemistry 2.1, Anhang 16.11 – https://chem.libretexts.org/Bookshelves/Analytical_Chemistry/Analytical_Chemistry_2.1_by_David_Harvey/Analytical_Chemistry_2.1_(Harvey)/16%3A_Appendix/16.11%3A__Acid_Dissociation_Constants

Die Inhalte der übrigen Quellen wurden für diese Fassung nicht im Einzelnen ausgewertet. Die fachliche Prüfung durch die Lehrkraft steht aus.
