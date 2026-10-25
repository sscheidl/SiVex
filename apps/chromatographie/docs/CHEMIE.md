# Papierchromatographie – Fachmodell und Grenzen

**Stand:** 25.10.2026 (Version 0.2.0: Schwarz aus Gelb, Rot und Blau) · Jahrgangsstufe 8/9 (NTG 8 / SG 9) · Modell: `js/model.js`, Aufgaben: `js/tasks.js`

## 1. Was simuliert wird

Auf einem Chromatographiepapier (9 cm × 14 cm) werden bis zu drei Proben auf eine Bleistift-Startlinie 2,0 cm über der Unterkante getupft. Das Papier hängt in einer Entwicklungskammer (Glastrog mit Deckel), deren Boden mit Laufmittel bedeckt ist. Das Laufmittel steigt durch Kapillarkräfte im Papier auf und nimmt lösliche Farbstoffe mit. Weil die Farbstoffe unterschiedlich gut im Laufmittel löslich sind und unterschiedlich stark am Papier haften, wandern sie verschieden weit.

| Fachbegriff | im Modell |
| --- | --- |
| **stationäre Phase** | das Papier (Cellulosefasern mit gebundenem Wasser) |
| **mobile Phase** | das Laufmittel, das im Papier nach oben steigt |
| **Löslichkeit** | Anteil eines Farbstoffs, der sich vom Startfleck löst und mitwandert (`sol`) |
| **Adsorption** | Anhaften an der Papieroberfläche; je stärker, desto kürzer die Laufstrecke (kleiner `rf`) |
| **Laufmittelfront** | obere Grenze des feuchten Papiers |
| **Rf-Wert** (nur Expertenmodus) | Laufstrecke des Farbstoffs ÷ Laufstrecke der Front, beide ab Startlinie |

Absorption (Aufsaugen in das Innere eines Stoffes) ist **nicht** gemeint; die Lückenprüfung weist diesen Begriff gezielt zurück.

## 2. Modellregeln

1. **Laufmittelfront (Kapillarmodell nach Lucas-Washburn):** Ab dem Eintauchen gilt für die feuchte Strecke über dem Flüssigkeitsspiegel *w² = k · t*. Die Front steigt also fortlaufend und wird mit der Zeit langsamer. Am oberen Papierrand (14 cm) bleibt sie stehen; die Farbstoffe wandern dann noch etwas weiter, bis sie kurz unter dem Rand liegen.
2. **Wanderung:** Eine Komponente wandert erst, wenn die Front ihren Startfleck erreicht hat. Ihr Mittelpunkt liegt bei *Laufstrecke = Rf · (Frontstrecke über dem Fleck)*. So wandern die Komponenten schon während der Entwicklung sichtbar mit unterschiedlicher Geschwindigkeit.
3. **Löslichkeit:** Der lösliche Anteil `sol` wandert, der Rest bleibt auf der Startlinie.
4. **Zonenbreite:** Die halbe Zonenhöhe wächst mit der Fleckgröße und der Laufstrecke (Diffusion): *σ = 0,75 · r(n) + 0,08 · √s + 0,015 · s* mit dem Fleckradius *r(n) = 0,19 cm · √n* nach *n*-maligem Auftupfen.
5. **Überladung:** Ab dem vierten Auftupfen auf dieselbe Stelle ist der Fleck überladen. Die Zonen werden um 20 % breiter und ziehen einen Schweif nach unten (Länge 0,22 · s je Auftupfer über drei). Dadurch fließen benachbarte Zonen ineinander. Das Chromatogramm gilt dann für diese Bahn nicht als sauber getrennt.
6. **Getrennte Zonen:** Zwei Komponenten erscheinen als getrennte Zonen, wenn zwischen der Unterkante der oberen (einschließlich Schweif) und der Oberkante der unteren Zone mehr als 0,05 cm Abstand bleibt (Kanten bei 1,05 σ). Sonst verschmelzen sie zu einer Zone mit Mischfarbe. Gezeichnet wird subtraktiv (Farbschichten übereinander), Gelb und Blau ergeben also Grün.
7. **Startlinie unter dem Spiegel:** Liegt ein Farbfleck beim Einsetzen höchstens 0,05 cm über dem Flüssigkeitsspiegel, löst er sich in das Laufmittel (Halbwertszeit ca. 4 s): Das Laufmittel in der Kammer färbt sich, auf dem Papier bleibt nur ein blasser Rest. Das Chromatogramm ist ungültig.
8. **Ohne Startlinie** werden die Proben dort getupft, wo man sie ohne Hilfslinie hinsetzt (2,35 / 1,75 / 2,6 cm). Die Laufstrecken sind dann nicht vergleichbar; das Chromatogramm gilt als ungültig.
9. **Zu früh herausgenommen:** Unter 5 cm Frontstrecke über der Startlinie gilt die Trennung als unvollständig. Zonen, die sich bei kurzer Laufstrecke noch überlappen, verschmelzen nach Regel 6 tatsächlich auch im Bild.
10. **Feste Zeitschritte:** Das Modell rechnet in Schritten von 0,05 s Modellzeit. Pause und Zeitraffer ändern nur das Tempo, nie Bandenlage oder Bewertung (Unit- und Browser-Test F-06).

Füllmenge: Jedes Eingießen hebt den Spiegel um 0,7 cm (höchstens viermal). Ein- oder zweimal Eingießen (0,7 cm bzw. 1,4 cm) ist geeignet, ab dem dritten Mal (2,1 cm) liegt der Spiegel über der Startlinie. Zentimeterwerte werden nicht angezeigt; man sieht den Spiegel an der Kammer.

## 3. Modelldatensatz

Alle Proben sind **definierte Modellproben**. Sie sagen nichts über reale Stiftmarken aus. Reale Filzstifte enthalten je nach Hersteller andere und oft mehr Farbstoffe.

### Laufmittel

| Laufmittel | k (cm²/s) | Hinweis |
| --- | --- | --- |
| Wasser | 0,12 | Front 5 cm über der Startlinie nach ca. 4,5 min, am oberen Rand nach ca. 22 min (Modellzeit) |
| Ethanol-Wasser 1 : 1 (Volumenverhältnis) | 0,075 | Gemisch ist zäher, die Front steigt langsamer; entzündlich (GHS02): keine offene Flamme, Kammer abdecken |

### Farbstoffkomponenten

| Komponente | Farbe | Wasser: sol / Rf | Ethanol-Wasser 1 : 1: sol / Rf |
| --- | --- | --- | --- |
| G | gelb | 1 / 0,82 | 1 / 0,70 |
| B | blau | 1 / 0,62 | 1 / 0,74 |
| R | rot | 1 / 0,40 | 1 / 0,55 |
| WS | blauschwarz, alkohollöslich | 0 / – | 0,80 / 0,60 |
| P | grauschwarz, Pigment (unlöslich) | 0 / – | 0 / – |

### Proben

| Probe | Anteile | Wasser | Ethanol-Wasser 1 : 1 |
| --- | --- | --- | --- |
| Schwarzer Filzstift (wasserlöslich) | G 0,30 · R 0,30 · B 0,40 | **3 Zonen** (rot, blau, gelb) | 2 Zonen (rot; G und B verschmelzen zu einer grünen Zone)¹ |
| Grüner Filzstift (wasserlöslich) | G 0,55 · B 0,45 | **2 Zonen** (blau, gelb) | **1 grüne Zone** (nicht getrennt) |
| Violetter Filzstift (wasserlöslich) | R 0,50 · B 0,50 | **2 Zonen** (rot, blau) | 2 Zonen (rot, blau)¹ |
| Oranger Filzstift (wasserlöslich) | G 0,60 · R 0,40 | **2 Zonen** (rot, gelb) | 2 Zonen (rot, gelb, dicht beieinander)¹ |
| Blauer Referenzfarbstoff | B 1 | 1 Zone | 1 Zone |
| Gelber Referenzfarbstoff | G 1 | 1 Zone | 1 Zone |
| Wasserfester schwarzer Stift | WS 0,70 · P 0,30 | bleibt vollständig auf der Startlinie | WS wandert, ein grauschwarzer Rest (P) bleibt zurück |

Die Zonenzahlen in **Wasser** gelten für sachgerechte Bedingungen: Startlinie, ein- bis dreimal getupft, Spiegel unter der Startlinie, Front mindestens 5 cm über der Startlinie.

¹ In **Ethanol-Wasser** liegen die getrennten Zonen von Schwarz, Violett und Orange dicht beieinander. Ob sie getrennt erscheinen, hängt von Laufstrecke und Farbmenge ab:

| Probe in Ethanol-Wasser 1 : 1 | 5 cm Frontstrecke, 1× / 2× / 3× getupft | 8 cm, 1× / 2× / 3× | 11 cm, 1× / 2× / 3× |
| --- | --- | --- | --- |
| Schwarz | 2 / **1** / **1** | 2 / 2 / 2 | 2 / 2 / 2 |
| Violett | 2 / 2 / **1** | 2 / 2 / 2 | 2 / 2 / 2 |
| Orange | 2 / **1** / **1** | 2 / 2 / 2 | 2 / 2 / 2 |
| Grün | 1 / 1 / 1 | 1 / 1 / 1 | 1 / 1 / 1 |

Bei 5 cm Frontstrecke zeigen also Orange mit zwei oder drei Auftupfern und Violett mit drei Auftupfern noch **eine** Zone; erst bei längerer Laufstrecke werden die beiden Farbstoffe sichtbar getrennt. Grün bleibt in Ethanol-Wasser immer eine Zone. Die Hilfe nennt deshalb bei unvollständiger Trennung Laufmittel, Laufstrecke und Farbmenge. Die Unit-Tests (`tests/unit/model.test.js`) prüfen sie für alle 14 Kombinationen aus Probe und Laufmittel sowie die Tabelle für Ethanol-Wasser.

### Didaktische Absicht des Datensatzes

- **Wasser ist das geeignete Laufmittel für die wasserlöslichen Filzstifte** (Aufgaben A und B). So arbeitet man auch im Schulversuch.
- **Ethanol-Wasser 1 : 1 trennt Gelb und Blau nicht.** Grün erscheint dort als *eine* Zone. Das zeigt zweierlei: Nicht jedes Laufmittel eignet sich für jede Probe, und **eine Zone ist kein Beweis für einen Reinstoff**.
- **Wasserfester Stift** (Aufgabe C): Seine Farbstoffe lösen sich nicht in Wasser, wohl aber teilweise im ethanolhaltigen Gemisch; ein Pigmentanteil bleibt zurück.
- **Einheitliche Farblogik:** Es gibt genau drei wasserlösliche Farbstoffe – Gelb (G), Rot (R) und Blau (B). Jede gemischte Farbe ist aus ihnen zusammengesetzt: Schwarz = Gelb + Rot + Blau, Grün = Gelb + Blau, Violett = Rot + Blau, Orange = Gelb + Rot. Ein Farbstoff wandert unter gleichen Bedingungen in jeder Probe gleich weit (Unit-Test „Gemeinsame Komponenten …“). Die Chromatographie **trennt die vorhandenen Farbstoffe**, sie erzeugt keine neuen Farben.
- **Gemeinsame Komponente:** Grün und Violett enthalten denselben blauen Farbstoff B. Er läuft in derselben Entwicklung genau so weit wie der blaue Referenzfarbstoff (Aufgabe B). Geprüft wird die **relative Laufstrecke**, nicht die Bildschirmfarbe.

## 4. Vergleich mit den Altfassungen (Begründung der Werte)

| Punkt | Fassung A | Fassung B | Codex | gewählt |
| --- | --- | --- | --- | --- |
| Ethanol-Wasser | 7 : 3 | 1 : 1 | – | **1 : 1** wie im Auftrag festgelegt. Mit 7 : 3 würde Wasser stärker verdrängt, für wasserlösliche Lebensmittelfarbstoffe ist das Gemisch dann noch schlechter geeignet. Einen wissenschaftlich besseren Grund für 7 : 3 enthält Fassung A nicht. 1 : 1 ist im Schulversuch üblich und leicht herzustellen. |
| Schwarz | G + B + V | V + R + G | – | **G + R + B (neu, 0.2.0):** dieselben drei Farbstoffe wie in Grün, Violett und Orange; zwei davon haben eine Referenz (Zuordnung in Aufgabe A). In 0.1.0 enthielt Schwarz nach Fassung A einen eigenen violetten Farbstoff – gleichfarbig mit dem violetten Stift, aber chemisch verschieden. Das war ohne Erklärung verwirrend. |
| Wasserfest | nur ein alkohollöslicher Farbstoff | WS + Pigment | – | **WS + Pigment (B):** Der Auftrag verlangt, dass im zweiten Laufmittel ein Anteil wandert und ein anderer zurückbleiben kann. |
| Kapillarmodell | Washburn | Washburn | linear | **Washburn (A/B),** k-Werte von B leicht angepasst |
| Rf in Ethanol-Wasser | G 0,45 / B 0,85 | G 0,76 / B 0,82 | – | **G 0,70 / B 0,74:** Gelb und Blau fallen zusammen (Lerngelegenheit „ungeeignetes Laufmittel“, „eine Zone ≠ Reinstoff“) |
| Kugelschreiber-Startlinie | Schalter | Schalter | Auswahl | **entfällt** als Schalter (G-01 der Lehrkraft); nur noch als Hinweis in Hilfe und Hefteintrag |
| Höhe der Startlinie | 0,5–4 cm wählbar | 1 / 1,5 / 2 cm | mm-Eingabe | **fest 2,0 cm** (G-01) |

## 5. Grenzen des Modells

- Die Rf-Werte sind **gewählte Modellwerte** für die Lernziele, keine Messwerte bestimmter Farbstoffe. Reale Rf-Werte hängen von Papiersorte, Temperatur, Kammersättigung und Laufmittelzusammensetzung ab.
- Verdunstung, Kammersättigung, Randeffekte und unregelmäßige Fronten sind nicht modelliert. Der Deckel liegt während der Entwicklung immer auf (vereinfachter Handgriff ohne eigenen Lerngewinn).
- Die Zonenform ist eine idealisierte Glockenkurve; reale Zonen können asymmetrisch sein.
- **Eine Zone beweist keinen Reinstoff:** Verschiedene Stoffe können unter bestimmten Bedingungen gleich weit wandern. Erst gleiche Laufstrecken in mehreren verschiedenen Laufmitteln machen es wahrscheinlicher, dass eine Probe nur einen Farbstoff enthält. Die Referenzfarbstoffe sind als Einkomponentenproben **definiert**.
- Kugelschreiberpaste wäre in Ethanol löslich und würde als Streifen mitwandern. Deshalb zieht man die Startlinie mit Bleistift (Graphit ist unlöslich). Das erklärt die Hilfe; ein eigener Schalter ist dafür nicht vorgesehen.

## 6. Sicherheit

Ethanol und Ethanol-Wasser-Gemische mit hohem Ethanolanteil sind entzündlich (GHS02, H225 für Ethanol). Im Schulversuch: keine offene Flamme, Kammer abdecken, für Lüftung sorgen. Die App zeigt das GHS02-Symbol auf der Flasche und weist beim Eingießen darauf hin. Wasser ist unbedenklich.
