# Trennlabor – fachliche Modelle, Stoffdaten und Grenzen

Dieses Dokument beschreibt alle fachlich relevanten Modellregeln der drei Labore. Jeder Parameter steht so im Quellcode (`js/model/*.js`, `js/tasks/*.js`); die Unit-Tests (`tests/unit/`) prüfen die Regeln. Die Modelle sind **didaktisch vereinfacht**, sollen aber nichts Falsches vermitteln. Wo Werte bewusst gesetzt (nicht gemessen) sind, steht das dabei.

## 1. Gemeinsame Grundsätze

- **Feste Zeitschritte:** Jedes Modell rechnet in festen Schritten (klassisch 0,05 s, Chromatographie 0,25 s, Destillation 0,1 s simulierte Zeit). Zeitraffer und Bildrate bestimmen nur, wie viele Schritte pro Sekunde laufen – das Ergebnis hängt allein von der simulierten Zeit und den Handlungen ab (Unit-Tests „A-04“).
- **Zeitraffer je Labor:** A ×6, B ×20, C ×12; dazu wählbar 1×, 4×, 10× und Pause. Angezeigt wird die simulierte Versuchszeit.
- **Stoffbilanz:** Stoffe werden nur zwischen Gefäßen verschoben. Verluste sind eigene Posten: Ausguss, Tisch (verschüttet/übergelaufen/ohne Auffanggefäß), verdampft, verspritzt (klassisch); ausgetreten am Kühlerende, ausgetreten an undichten Verbindungen, Tisch, verbrannt (Brennprobe), verworfen (Destillation). Die Bilanz wird in Tests nach zufälligen Handlungsfolgen geprüft (Abweichung < 10⁻⁶).
- **Bewertung aus dem Zustand:** Erfolgskriterien und richtige Beobachtungsantworten werden aus dem tatsächlichen Versuchszustand berechnet, nicht aus einer Handlungsreihenfolge. Beim ersten Erreichen des Ziels (und nur, wenn gerade keine Handlung läuft) wird ein Schnappschuss angelegt; die Auswertung bezieht sich darauf, damit späteres Herumprobieren einen gelungenen Versuch nicht rückwirkend falsch macht.

## 2. Klassische Trennverfahren (`js/model/classic.js`)

### 2.1 Gefäßinhalt

Jedes Gefäß enthält Wasser (mL), Öl (mL, davon fein verteiltes Öl „disp“), gelöstes Kochsalz (g), gelöste Hibiskusfarbstoffe (mg), in Blütenteilen gebundene Farbstoffe (mg) und Feststoffteilchen. Jede Feststoffart liegt **abgesetzt** oder **aufgewirbelt** vor:

| Feststoff | Absetzzeit τ | Aufwirbelbarkeit | Bemerkung |
| --- | --- | --- | --- |
| Sand, grob (90 % des Sandes) | 2,5 s | 0,6 | |
| Sand, fein (10 % des Sandes) | 30 s | 1,0 | verursacht die länger anhaltende Trübung |
| Eisenpulver | 1,5 s | 0,3 | magnetisch |
| Kochsalz, fest | 1,5 s | 0,5 | löst sich bis zur Sättigung |
| Hibiskusblüten (Stücke) | 40 s | 1,0 | bleiben im Teesieb und im Filter |
| feine Pflanzenteilchen (5 % der Blüten) | 90 s | 1,0 | gehen zur Hälfte durch das Teesieb |

**Bewegung („agit“, 0–1):** Rühren setzt sie für 3 s auf 1; zügiges Ausgießen 0,4; vorsichtiges Abgießen 0,01; Wasserzugabe 0,25. Sie klingt mit τ = 1 s ab. Der aufgewirbelte Anteil strebt `agit · Aufwirbelbarkeit` an (Aufwirbeln τ = 0,3 s), sonst setzt sich der Feststoff mit der Absetzzeit ab (exponentiell).

**Trübung** = aufgewirbelte Feststoffe in g je 100 mL Flüssigkeit: < 0,1 „klar“, < 0,6 „leicht trüb“, sonst „trüb“.

### 2.2 Lösen, Sättigung, Kristallisation

Löslichkeit von Natriumchlorid in Wasser (g je mL ≈ g je g Wasser), linear interpoliert: 0 °C 0,357 · 20 °C 0,359 · 40 °C 0,364 · 60 °C 0,371 · 80 °C 0,380 · 100 °C 0,392 [1, 2]. Das Salz löst sich mit der Geschwindigkeitskonstante k = 0,015 s⁻¹ + 0,6 s⁻¹ · agit (+ 0,05 s⁻¹, wenn Wasser durch einen Filter fließt), höchstens bis zur Sättigung. Übersättigte Lösung kristallisiert mit τ = 0,8 s aus. Folge: 10 mL Wasser lösen von 5 g Salz nur etwa 3,6 g (Unit-Test).

### 2.3 Gießen

| Art | Rate | Wirkung |
| --- | --- | --- |
| Vorsichtig abgießen | 5 mL/s | Flüssigkeit von oben (zuerst eine abgesetzte Ölschicht, dann die wässrige Phase mit allem Gelösten und Aufgewirbelten); der Bodensatz bleibt mit einer Restflüssigkeit von 1,5 mL + 0,3 mL je g Bodensatz zurück |
| Zügig ausgießen | 15 mL/s | wie oben, aber der Bodensatz wird aufgewirbelt (agit 0,4) und zu einem großen Teil mitgerissen |
| Vollständig umfüllen | 12 mL/s | zuerst die Flüssigkeit, dann rutscht der Bodensatz hinterher; etwa 2 % bleiben an der Glaswand (mit Wasser nachspülbar) |

Fassungsvermögen: Becherglas 250 mL, Trichter 55 mL, Abdampfschale 70 mL, Scheidetrichter 250 mL. Was nicht hineinpasst, läuft über und geht auf dem Tisch verloren. Beim vorsichtigen Gießen und beim Umfüllen in den Trichter wird so dosiert, dass er nicht überläuft (wie beim realen portionsweisen Eingießen); zügiges Gießen kann ihn überlaufen lassen.

### 2.4 Filtrieren und Sieben

| Einsatz im Trichter | Durchfluss (bei vollem Trichter) | zurückgehalten | Rückhalt Flüssigkeit |
| --- | --- | --- | --- |
| Filterpapier, gefaltet | 0,35 mL/s | alle Feststoffe | 2,5 mL im Papier |
| Filterpapier, ungefaltet hineingedrückt | 0,45 mL/s | Feststoffe größtenteils, aber an der Seite läuft Suspension vorbei: feiner Sand und feine Pflanzenteilchen zu 50 %, grober Sand zu 15 %, übrige zu 10 % des mitfließenden Anteils | 2,5 mL |
| Teesieb | 3 mL/s | nur Blütenstücke; feine Pflanzenteilchen zu 50 % durch, Sand und Salzkristalle ganz durch | 0,3 mL |
| ohne Einsatz | 4 mL/s | nichts (auch trockene Feststoffe rieseln durch) | – |

Der Durchfluss sinkt mit abnehmender Füllhöhe (Faktor 0,3–1). Gelöste Stoffe (Salz, Farbstoffe) laufen immer mit der Flüssigkeit hindurch – **festes Salz lässt sich durch Filtrieren nicht gewinnen**. Öl läuft ebenfalls durch das Papier (langsamer, 60 % der Rate): Öl und Wasser werden so nicht getrennt. Steht kein Gefäß unter dem Trichter, tropft das Filtrat auf den Tisch (Verlust). Ein trockenes Sand-Salz-Gemisch bleibt vollständig im Filter liegen – gibt man danach Wasser darauf, löst sich das Salz und läuft als Lösung durch (fachlich richtig, also auch als Korrektur möglich).

### 2.5 Eindampfen

Abdampfschale (70 mL) auf Dreifuß mit Drahtnetz und Gasbrenner. Wirksame Heizleistung: kleine Flamme 90 W, große Flamme 220 W; Wärmeverlust 0,2 W/K; Wärmekapazität Inhalt (Wasser 4,18 J/(g·K)) + 80 J/K Schale. Bis 100 °C wird erwärmt, danach verdampft Wasser mit der Verdampfungswärme 2257 J/g [1]: große Flamme etwa 0,09 mL/s, kleine etwa 0,033 mL/s (50 mL also rund 9 bzw. 25 Minuten Versuchszeit). Sobald die Lösung gesättigt ist, kristallisiert Salz aus. **Spritzen:** Bei großer Flamme springen fast trockene Kristalle (weniger als 3 mL Wasser) heraus – 0,4 % je Sekunde, im trockenen Zustand 0,1 % je Sekunde; bei kleiner Flamme nicht. Wird eine Sand-Suspension eingedampft, bleibt ein Gemisch aus Sand und Salz zurück. Ohne Lösung entsteht kein Salz.

### 2.6 Magnet

Ein Durchgang des Magneten (in Folie) holt 85 % des Eisens aus dem gewählten Gefäß (auch aus Suspensionen und aus dem Filterrückstand) und legt es auf dem Uhrglas ab. Sand und Salz werden nicht angezogen (keine Mitnahme im Modell).

### 2.7 Öl und Wasser, Scheidetrichter

Speiseöl (Dichte ≈ 0,92 g/mL) ist leichter als Wasser (1,00 g/mL) und nicht mischbar [1]. Rühren oder Schütteln (mit Stopfen) verteilt bis zu 60 % des Öls als Tröpfchen im Wasser (Emulsion, τ = 0,5 s); in Ruhe fließen die Tröpfchen mit τ = 15 s wieder zusammen. Der Hahn lässt von unten ab: zuerst die wässrige Phase (samt verteiltem Öl), dann die Ölschicht. Hahn offen 1 mL/s, tropfenweise 0,15 mL/s. Mit aufgesetztem Stopfen entsteht ein Unterdruck: Nach etwa 1,5 mL stockt der Abfluss. Schütteln ohne Stopfen verspritzt 12 % des Inhalts. Oben ausgießen gibt zuerst die Ölschicht ab (zweiter, ebenfalls zulässiger Weg).

### 2.8 Extraktion (Hibiskustee)

Getrocknete Blüten enthalten im Modell 100 mg ausziehbare Farb- und Geschmacksstoffe je g (Modellgröße). Die roten Farbstoffe des Hibiskus sind wasserlösliche Anthocyane (v. a. Delphinidin- und Cyanidin-3-sambubiosid) [7]. Die Farbstoffe gehen erst bei Kontakt mit Wasser mit der Geschwindigkeitskonstante

k(T) = 1/150 s · exp(−3940 K · (1/T − 1/363,15 K)) · (1 + 0,6 · agit)

ins Wasser über (Arrhenius-Ansatz; k(90 °C) ≈ 1/150 s, k(20 °C) ≈ 1/2000 s, d. h. heiß etwa 13-mal schneller). Heißes Wasser aus dem Wasserkocher hat 90 °C und kühlt im Becherglas mit τ = 900 s ab. Die Farbintensität im Bild folgt der Konzentration (mg/mL). **Filtrieren oder Sieben entfernt nur Pflanzenteile, nie die gelösten Stoffe** – der Tee bleibt ein Stoffgemisch.

### 2.9 Ausgangsmengen und Erfolgskriterien

| Aufgabe | Ausgangszustand | Erfolg (aus dem Zustand berechnet) |
| --- | --- | --- |
| K-01 | 100 mL Wasser + 15 g Sand, aufgerührt | ≥ 60 mL **klares** Wasser in einem Becherglas mit ≤ 0,3 g Sand; ≥ 12 g Sand außerhalb dieser Fraktion (Bodensatz mit ≤ 30 mL Wasser oder Filterrückstand, auch verteilt) |
| K-02 | 10 g Sand + 5 g Kochsalz, trocken | Sand ≥ 8 g mit ≤ 1 g Salz; **festes** Kochsalz ≥ 3 g in der Abdampfschale, ≤ 0,5 mL Wasser, ≤ 0,15 g Sand |
| K-03 | 5 g Eisen + 10 g Sand + 5 g Kochsalz | wie K-02, zusätzlich ≥ 4 g Eisen auf dem Uhrglas (≤ 0,25 g Fremdstoffe), Sandfraktion ≤ 0,5 g Eisen, Salzfraktion ≤ 0,15 g Eisen |
| K-04 | 60 mL Wasser + 40 mL Öl, verrührt | Becherglas mit ≥ 45 mL Wasser und ≤ 5 % Öl **und** Becherglas mit ≥ 30 mL Öl und ≤ 5 % Wasser |
| K-05 | 8 g Hibiskusblüten (4 Portionen), Wasser kalt/heiß | je ein Ansatz mit kaltem (≤ 30 °C) und heißem (≥ 70 °C) Wasser mit ≥ 2 min Ziehzeit; Tee ≥ 40 mL, ≥ 1 mg Farbstoffe/mL, keine Blütenstücke, ≤ 0,25 g feine Teilchen |

## 3. Papierchromatographie (`js/model/chroma.js`)

### 3.1 Datensatz (explizit, reproduzierbar)

Die Proben sind **definierte virtuelle Modellproben** – keine Aussage über reale Stiftmarken.

| Probe | Komponenten (Anteile) |
| --- | --- |
| Schwarz (wasserlöslicher Filzstift) | gelb 0,30 · blau 0,35 · violett 0,35 (**drei** Komponenten) |
| Grün | gelb 0,55 · blau 0,45 |
| Violett | rot 0,50 · blau 0,50 |
| Orange | gelb 0,60 · rot 0,40 |
| Blau (Referenz) | blau 1 (**eine** Komponente) |
| Gelb (Referenz) | gelb 1 (**eine** Komponente) |
| Wasserfest schwarz | schwarzer Farbstoff 1 |

| Komponente | Wasser: löslicher Anteil s / Rf | Ethanol-Wasser 7 : 3: s / Rf |
| --- | --- | --- |
| gelber Farbstoff | 1 / 0,82 | 1 / 0,45 |
| blauer Farbstoff | 1 / 0,60 | 1 / 0,85 |
| roter Farbstoff | 1 / 0,38 | 1 / 0,68 |
| violetter Farbstoff | 1 / 0,15 | 1 / 0,32 |
| schwarzer, wasserunlöslicher Farbstoff | **0 / –** (bleibt auf der Startlinie) | 0,85 / 0,74 (15 % bleiben am Start) |
| Kugelschreiberfarbstoff (Startlinie) | 0,15 / 0,25 | 0,90 / 0,90 |
| Graphit (Bleistift) | 0 / – | 0 / – |

Damit enthält der Datensatz: einen **unlöslichen, auf der Startlinie bleibenden** Farbstoff (wasserfest in Wasser), Komponenten mit deutlich verschiedener Wanderung, zwei Stifte mit **gemeinsamer Komponente** (Grün und Violett: blau; Schwarz und Grün: gelb und blau) und ein Laufmittel, das die Reihenfolge ändert (Gelb läuft in Wasser am weitesten, im Ethanol-Wasser-Gemisch der blaue Farbstoff).

**Modellvorstellung (Schule):** Der Rf-Wert fasst das Verhältnis aus Löslichkeit im Laufmittel (mobile Phase) und Adsorption an der Papieroberfläche (stationäre Phase, vereinfachendes Schulmodell) zusammen. Ein großer Rf-Wert bedeutet: gut löslich, schwach adsorbiert. Ein Stoff mit s = 0 wird nicht mitgenommen.

### 3.2 Laufmittelfront

Papier 15 cm lang; breites Blatt 9 cm (3 Bahnen), Streifen 3 cm (1 Bahn). Die Front steigt nach Lucas-Washburn [4]: h² = h₀² + k·t, beginnend an der Füllhöhe h₀. k(Wasser) = 0,11 cm²/s (10 cm in etwa 15 min), k(Ethanol-Wasser 7 : 3) = 0,065 cm²/s – langsamer, weil Ethanol-Wasser-Gemische eine höhere Viskosität und eine geringere Oberflächenspannung als Wasser haben [1, 5]. Ohne Deckel verdunstet Laufmittel vom Papier: k × 0,85 und eine unruhigere Front.

### 3.3 Zonen

Eine Zone beginnt erst zu wandern, wenn die Front den Startfleck erreicht. Ihr Mittelpunkt liegt bei y = y₀ + Rf · (h − y₀). Ist die Front am oberen Rand angekommen, wandern die Zonen mit einer gedachten Front weiter (bis höchstens knapp unter den Rand) – die Front selbst ist dann **nicht mehr bestimmbar**.

- Fleckradius: 0,18 cm + 0,12 cm je weiterem Auftupfen. Ab 4 Auftupfern („überladen“) ist die Zone 1,6-mal breiter und zieht einen Schwanz; Zonen laufen dann ineinander.
- Zonenbreite: σ = Fleckradius (·1,6 bei Überladung) + 0,09 cm · √Laufstrecke.
- Sichtbar getrennte Zonen: Zonen, deren Abstand kleiner als 1,1 · (σ₁ + σ₂) ist, zählen als eine Zone.
- Startlinie mit Kugelschreiber: Der Kugelschreiberfarbstoff wandert als breite Spur über das ganze Papier mit.
- **Startlinie unter dem Laufmittelspiegel** (Füllhöhe ≥ Startlinie − 0,15 cm): Die Farbstoffe lösen sich mit τ = 8 s in den Laufmittelvorrat; das Laufmittel färbt sich, das Chromatogramm ist unbrauchbar.
- Ethanol-Wasser-Gemisch: Hinweis auf Entflammbarkeit (GHS-Flammensymbol) [2]; die App unterstellt keinen realen Betrieb.

### 3.4 Gültigkeit und Rf-Wert

Ein Chromatogramm ist **brauchbar**, wenn der Start nicht im Laufmittel lag, mindestens eine Probe aufgetragen ist und die Front mindestens 4 cm über die Startlinie gestiegen ist; **sauber**, wenn zusätzlich keine Kugelschreiberlinie und kein überladener Fleck vorliegt. Die Front ist nach dem Herausnehmen 90 s (Versuchszeit) sichtbar und muss in dieser Zeit markiert werden; liegt sie am oberen Rand, ist die Markierung ungültig. Rf = (Zonenmitte − Startlinie) / (markierte Front − Startlinie); ohne gültige Markierung oder Startlinie ist kein Rf-Wert bestimmbar. Im Expertenmodus misst ein Lineal-Werkzeug Laufstrecken ab der Startlinie (auf 0,1 cm gerundet); akzeptiert wird ein Rf-Wert mit ±0,03 Abweichung vom Wert des eigenen Chromatogramms.

### 3.5 Erfolgskriterien

| Aufgabe | Erfolg |
| --- | --- |
| C-1 | saubere Chromatogramme von ≥ 3 Proben, darunter ein Filzstift mit ≥ 2 Zonen und ein Referenzfarbstoff mit genau 1 Zone |
| C-2 | Grün und Violett mit demselben Laufmittel sauber entwickelt (auch auf zwei Papieren) |
| C-3 | wasserfester Stift brauchbar mit Wasser **und** mit Ethanol-Wasser entwickelt |
| C-4 | sauberes Chromatogramm mit gültig markierter Front (nur Expertenmodus) |

Die richtigen Antworten (Anzahl der Zonen, gemeinsamer Farbstoff, Wanderung, Rf-Werte) werden aus den eigenen Chromatogrammen berechnet. Eine einzelne Zone wird ausdrücklich nur als **Hinweis**, nicht als Beweis für einen Reinstoff gewertet.

## 4. Destillation Ethanol/Wasser (`js/model/distill.js`)

### 4.1 Ausgangsgemisch

Ethanol-Wasser-Gemisch mit **40 % Ethanol (Volumenanteil)**, in Portionen zu 25 mL, höchstens 150 mL im 250-mL-Rundkolben (etwa zwei Drittel). Volumenkontraktion beim Mischen wird vernachlässigt. Stoffmengenanteil: ρ(Ethanol) = 0,789 g/mL, M = 46,07 g/mol; ρ(Wasser) = 0,998 g/mL, M = 18,02 g/mol [1] → x(Ethanol) ≈ 0,171.

### 4.2 Gleichgewicht (Siedetemperatur und Dampfzusammensetzung)

Tabellierte Gleichgewichtsdaten bei 101,3 kPa nach Carey und Lewis [3], linear interpoliert:

| x(Ethanol) Flüssigkeit | 0 | 0,019 | 0,072 | 0,097 | 0,124 | 0,166 | 0,234 | 0,261 | 0,327 | 0,397 | 0,508 | 0,573 | 0,676 | 0,747 | 1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Siedetemperatur / °C | 100 | 95,5 | 89,0 | 86,7 | 85,3 | 84,1 | 82,7 | 82,3 | 81,5 | 80,7 | 79,8 | 79,3 | 78,74 | 78,41 | 78,0 |
| y(Ethanol) Dampf | 0 | 0,170 | 0,389 | 0,438 | 0,470 | 0,509 | 0,545 | 0,558 | 0,583 | 0,612 | 0,656 | 0,684 | 0,739 | 0,782 | 1 |

**Modellgrenze Azeotrop:** Real bilden Ethanol und Wasser ein Azeotrop (≈ 95,6 % Massenanteil Ethanol, 78,2 °C) [6]; durch einfache Destillation erhält man nie reines Ethanol. Oberhalb von x = 0,75 wird im Modell linear zu reinem Ethanol (78,0 °C) interpoliert; der Dampf ist dort stets etwas ethanolreicher als die Flüssigkeit. Im Unterrichtsversuch (Start bei x ≈ 0,17) wird dieser Bereich nie erreicht; die Grenze ist in der Theorie der App erwähnt.

**Folgerungen, die das Modell richtig zeigt:** Das 40-%-Gemisch siedet bei etwa **84 °C**, nicht bei 78 °C. Das erste Destillat hat etwa 77 % Ethanol (Volumenanteil), ist also ethanolreicher, aber nicht rein. Weil zuerst bevorzugt Ethanol verdampft, wird der Kolbeninhalt wasserreicher, und die Dampftemperatur **steigt allmählich** (z. B. 84 → 86 °C nach 23 mL Destillat) – es gibt keinen Sprung von 78 auf 100 °C.

### 4.3 Energie und Stofftransport

- **Heizpilz:** Stufe 1–4 mit 30, 90, 150, 260 W; die Heizleistung folgt der Einstellung verzögert (τ = 20 s). Wärmeverlust des Kolbens 0,5 W/K. Stufe 1 reicht nicht zum Sieden (Gleichgewicht bei etwa 80 °C < 84 °C).
- **Sieden:** Unterhalb der Siedetemperatur erwärmt die Nettoleistung den Inhalt (Wärmekapazität Ethanol 2,44 J/(g·K), Wasser 4,18 J/(g·K), Glas 150 J/K). Am Siedepunkt verdampft sie Stoffmenge mit der Verdampfungsenthalpie y·38,6 + (1−y)·40,7 kJ/mol [1]; Zusammensetzung des Dampfes = y(x). Einstufige Destillation (Rayleigh), kein Rückfluss außer beim Anwärmen.
- **Aufsatz:** Bevor der Dampf Thermometer und Kühler erreicht, muss er den Aufsatz erwärmen (3000 J); bis dahin kondensiert er an der Glaswand und fließt zurück.
- **Kühler:** Kühlleistung bei Durchfluss aus/schwach/mittel/stark: 12 (nur Luft)/90/220/400 W. **Zulauf oben** statt unten: der Mantel bleibt größtenteils leer → 25 % der Leistung. Kondensierter Anteil f = K / (K⁶ + Q⁶)^(1/6) mit Kühlleistung K und Dampfleistung Q. Der Rest tritt am Kühlerende als Dampf aus (Verlust). Im Kühlrohr verbleiben 0,25 mL, bevor es tropft.
- **Ohne Klemmen:** 20 % des Dampfes treten an den Schliffverbindungen aus.
- **Ohne Vorlage** tropft das Destillat auf den Tisch.

### 4.4 Thermometer

Anzeige mit τ = 2,5 s; ohne Dampfstrom (Heizung aus) kühlt die Thermometerkugel im heißen Aufsatz nur langsam ab (τ = 90 s). Am **seitlichen Abgang** (richtig) zeigt es die Siedetemperatur des Gemischs, sobald der Dampf die Thermometerkugel erreicht (ab einer Aufsatz-Erwärmung von 50–90 %). **Zu hoch** (außerhalb des Dampfstroms): nur 55 % des Anstiegs über Raumtemperatur (z. B. 55 °C statt 84 °C). **In der Flüssigkeit:** Temperatur des Kolbeninhalts, beim Sieden zusätzlich überhitzt um 1,5 °C + 0,8 °C je Heizstufe. Messwerte mit falscher Thermometerposition werden in der Auswertung **nicht** als verwertbare Messung gewertet. Das Verlaufsdiagramm zeigt die Thermometeranzeige (durchgezogen) und – deutlich unterschieden – die Kolbentemperatur als Modellwert (gestrichelt).

### 4.5 Sicherheitsregeln (Sicherheitsstopp)

Orientiert an den Grundsätzen der Richtlinie zur Sicherheit im Unterricht (RiSU) [8]:

| Situation | Reaktion |
| --- | --- |
| Heizen einer **vollständig geschlossenen** Apparatur (Stopfen auf der Vorlage) | sofortiger Stopp beim Einschalten bzw. beim Verschließen der heißen Apparatur |
| **Zünden an der Apparatur** | sofortiger Stopp |
| Sieden bei **offener** Apparatur (ohne Aufsatz, ohne Thermometer/Verschluss oben, ohne Kühler) | Stopp beim Sieden (brennbarer Dampf) |
| Sieden **ohne Siedesteine** | Stufe ≥ 3: Stopp (Siedeverzug); Stufe ≤ 2: stoßweises Sieden, Spritzer (0,4 % des Inhalts je Stoß) gelangen ins Destillat |
| **Siedesteine in heiße Flüssigkeit** (> 50 °C) | Handlung wird unterbunden und erklärt |
| Austretender Dampf am Kühlerende (Kühlung zu schwach/aus, Heizung zu stark) | Warnung ab 0,5 mL Ethanol, Stopp ab 4 mL (gezählt ab dem letzten Stopp) |
| Undichte Verbindungen | Warnung; Stopp ab 4 mL ausgetretenem Ethanol |
| Kolben fast leer (< 10 mL) bei eingeschalteter Heizung | Stopp („nie bis zur Trockne“) |
| Probe aus dem **heißen** Kolben | Stopp (Apparatur nicht öffnen) |
| Leerer Kolben beim Einschalten | Stopp |

Bei einem Stopp wird die Heizung (virtuell) ausgeschaltet und die Zeit angehalten, bis der Hinweis bestätigt wird; danach kann der Aufbau korrigiert werden. Dampf, der im Moment des Stopps noch nicht verteilt war, kondensiert zurück in den Kolben (Bilanz bleibt erhalten).

### 4.6 Brennprobe

Eine Probe von 2 mL wird aus einer Vorlage (oder nach dem Abkühlen aus dem Kolben) in eine separate Porzellanschale gegeben und dort mit dem Stabfeuerzeug entzündet. Bei Raumtemperatur brennt eine wässrige Ethanollösung nur, wenn ihr Flammpunkt darunter liegt; für 40–50 % Ethanol liegt der Flammpunkt in der Größenordnung von 25 °C, bei geringerem Ethanolanteil deutlich höher (reines Ethanol: 12 °C) [2, 9]. **Didaktisch gesetzte Schwellen:** ab 45 % (Volumenanteil) brennt die Probe mit **bläulicher, kaum leuchtender Flamme** (Ethanol vollständig verbrannt), 30–45 % flackert sie kurz auf (25 % des Ethanols verbrennen), darunter lässt sie sich nicht entzünden. Die Brennprobe belegt **Brennbarkeit unter diesen Bedingungen**, nicht Reinheit oder einen genauen Ethanolgehalt; die App fragt das in der Auswertung ab.

### 4.7 Erfolgskriterium D-1

Vorlage mit ≥ 5 mL Destillat (Modell: ≥ 50 % Ethanol), **verwertbare Temperaturmessung** (Thermometer bei allen Messpunkten während des Übergehens am seitlichen Abgang) und eine **positive Brennprobe einer Destillatprobe**. Die Antwort „Dampftemperatur beim ersten Tropfen“ wird mit ±1,5 °C gegen die eigene Messung geprüft; „Temperaturverlauf“ ist „stieg allmählich an“, wenn die eigenen Messwerte um mindestens 0,8 °C stiegen, sonst „blieb fast gleich, deutlich über 78 °C“.

## 5. Auswertung ohne KI (`js/answers.js`)

Lücken werden normalisiert (Kleinschreibung, ä→ae, ö→oe, ü→ue, ß→ss, Akzente, Leer- und Satzzeichen entfernt). Akzeptiert werden hinterlegte Begriffe und Synonyme (z. B. Sedimentieren/Sedimentation/Absetzen, Eindampfen/Verdampfen/Abdampfen, Extraktion/Extrahieren) sowie Tippfehler mit Damerau-Levenshtein-Abstand ≤ 1 (ab 5 Buchstaben) bzw. ≤ 2 (ab 10 Buchstaben) – mit Hinweis auf die richtige Schreibweise. Eine **Sperrliste** fachlich falscher, ähnlicher Begriffe hat Vorrang (z. B. Absorption statt Adsorption, Filtrat statt Rückstand, Destillieren statt Eindampfen, Suspension statt Emulsion) und liefert einen gezielten Hinweis. Ist eine Eingabe einem gesperrten Begriff mindestens so nahe wie einem richtigen, wird sie abgelehnt.

## 6. Didaktische Näherungen und Grenzen

- Mengen sind Modellwerte in Gramm, Milliliter und „mg Farbstoffe“; Zeiten laufen im Zeitraffer. Die App ist keine Herstellungs- oder Dosieranleitung.
- Absetzen, Lösen, Extraktion und Emulsionsbildung sind exponentielle Näherungen mit gesetzten Zeitkonstanten (Größenordnungen plausibel, nicht gemessen). Rosten von Eisen, Mitnahme von Sand durch Eisen, Hydrolyse oder Zersetzung der Farbstoffe werden nicht modelliert.
- Chromatographie: Rf-Werte und Löslichkeiten sind Modellwerte eines definierten Datensatzes. Temperatureinfluss und Papierqualität werden nicht berücksichtigt.
- Destillation: einstufig, ohne Kolonne; Azeotrop vernachlässigt; Wärmeverluste vereinfacht; die Brennprobe ist ein Schwellenmodell.
- Sicherheitsstopps zeigen typische Gefahren; sie ersetzen keine Gefährdungsbeurteilung für reale Versuche.

## 7. Quellen

1. Haynes, W. M. (Hrsg.): *CRC Handbook of Chemistry and Physics*. CRC Press (aktuelle Auflagen) – Löslichkeit von NaCl, Dichten, Wärmekapazitäten, Verdampfungsenthalpien, Viskosität und Oberflächenspannung von Ethanol-Wasser-Gemischen.
2. Institut für Arbeitsschutz der DGUV (IFA): *GESTIS-Stoffdatenbank*, Einträge Ethanol und Natriumchlorid (Siedetemperatur, Flammpunkt, Dichte, Wasserlöslichkeit, GHS-Kennzeichnung).
3. Carey, J. S.; Lewis, W. K.: Studies in Distillation – Liquid-Vapor Equilibria of Ethyl Alcohol-Water Mixtures. *Industrial & Engineering Chemistry* 24 (1932), 882–883; tabelliert u. a. in *Perry's Chemical Engineers' Handbook*.
4. Washburn, E. W.: The Dynamics of Capillary Flow. *Physical Review* 17 (1921), 273–283.
5. Schwedt, G.: *Chromatographische Trennmethoden*. Thieme, Stuttgart – Grundlagen der Papierchromatographie, Rf-Wert.
6. Atkins, P. W.; de Paula, J.: *Physikalische Chemie*. Wiley-VCH – Siedediagramme, Azeotrope.
7. Da-Costa-Rocha, I.; Bonnlaender, B.; Sievers, H.; Pischel, I.; Heinrich, M.: *Hibiscus sabdariffa* L. – A phytochemical and pharmacological review. *Food Chemistry* 165 (2014), 424–443.
8. Kultusministerkonferenz: *Richtlinie zur Sicherheit im Unterricht (RiSU)*, aktuelle Fassung – Umgang mit brennbaren Flüssigkeiten, Destillationsapparaturen, Siedeverzug.
9. Sicherheitsdatenblätter verdünnter Ethanollösungen (z. B. Ethanol 40–50 % V/V) – Flammpunkt in der Größenordnung von 25 °C. Die Schwellen der Brennprobe im Modell sind didaktisch gesetzt; eine Prüfung durch die Lehrkraft wird empfohlen.
