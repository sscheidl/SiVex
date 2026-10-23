# Trennlabor – Fachmodell, Stoffdaten und Modellgrenzen

Dieses Dokument beschreibt alle fachlich relevanten Annahmen der Simulation. Die Modelle sind **didaktisch vereinfacht**, aber so gebaut, dass sie für die Jahrgangsstufen NTG 8 / SG 9 nichts Falsches vermitteln. Jede sichtbare Veränderung entsteht aus einem gerechneten Zustand – es gibt keine fest abgespielten Ergebnisse.

Quellcode der Modelle: [`js/classic.js`](../js/classic.js), [`js/chroma.js`](../js/chroma.js), [`js/distill.js`](../js/distill.js); Bewertung, Hilfe und Auswertung: [`js/tasks.js`](../js/tasks.js).

## 1. Grundsätze für alle Labore

| Grundsatz | Umsetzung |
| --- | --- |
| **Stoffbilanz** | Jede Stoffmenge (g bzw. mL) liegt in genau einem Gefäß oder in einem Verlusttopf (verschüttet, Ausguss, verdampft, verspritzt, entwichener Dampf, verbrannt). Wasser aus Spritzflasche/Wasserkocher wird als Zugabe gezählt. Die Unit-Tests prüfen die Bilanz nach jedem Versuch auf 10⁻⁶ genau. |
| **Feste Zeitschritte** | Das Modell rechnet immer in Schritten von 0,05 s Modellzeit (`core.createClock`). Pause und Zeitraffer (1×, 5×, 20×, 50×) ändern nur, wie viele Schritte pro Sekunde Echtzeit ausgeführt werden – nie das Ergebnis (Unit-Tests „Zeitraffer …“, Browser-Test A-04). |
| **Handlungen dauern** | Gießen, Rühren, Einfüllen, Umstellen usw. sind Vorgänge mit Dauer; der Stofftransport geschieht anteilig während der Animation. Laufende Handlungen werden auch im Zeitraffer höchstens mit doppelter Geschwindigkeit gezeigt. |
| **Bewertung am Zustand** | „Ergebnis prüfen“ bewertet die aktuell vorhandenen Fraktionen (Gefäßinhalte), nicht die Reihenfolge der Klicks. Der Erfolgszustand wird eingefroren; spätere Änderungen machen eine gelöste Aufgabe nicht rückwirkend falsch. |

## 2. Klassische Trennverfahren (K-01 bis K-05)

### 2.1 Stoffe

| Stoff | Eigenschaften im Modell | Begründung / Literaturwert |
| --- | --- | --- |
| Sand (Quarz) | unlöslich, Dichte 2,65 g/cm³, Schüttdichte 1,5 g/mL | Quarz ρ ≈ 2,65 g/cm³; trockener Sand 1,4–1,7 g/mL |
| Kochsalz (NaCl) | löslich; Sättigung 0,357 g/mL Wasser bei 20 °C, linear auf ≈ 0,385 g/mL bei 100 °C | 35,9 g/100 g Wasser (20 °C), 39,1 g/100 g (100 °C) |
| Eisenspäne | magnetisch, unlöslich, Dichte 7,87 g/cm³ | ferromagnetisch |
| Speiseöl | nicht mit Wasser mischbar, Dichte 0,92 g/mL | Pflanzenöle 0,91–0,93 g/mL |
| Wasser | c = 4,18 J/(g·K), Verdampfungsenthalpie 2257 J/g, Siedetemperatur 100 °C | Normaldruck |
| Hibiskusblüten (getrocknet) | 4 g mit 40 Farbstoff-Einheiten; nehmen 2,5 mL Wasser je g auf | Farbstoffe sind wasserlösliche Anthocyane; der Tee enthält außerdem Fruchtsäuren u. a. |

Farbstoffmengen werden in **relativen Einheiten** geführt; die Farbe der Lösung ergibt sich aus der Konzentration (Einheiten je mL), nicht aus einer festen Farbvorgabe.

### 2.2 Vorgänge

| Vorgang | Modellregel | Parameter |
| --- | --- | --- |
| **Aufwirbeln / Sedimentieren** | Anteil schwebenden Sandes `susp`. Rühren/Gießen hebt ihn an; in Ruhe nimmt er exponentiell ab – erst schnell (grobe Körner), dann langsamer (feine Anteile). | τ = 4,5 s (bis 12 % schwebend), danach τ = 22 s |
| **Dekantieren „vorsichtig“** | Flüssigkeit über dem Bodensatz wird abgegossen; schwebender Sand geht anteilig mit; im Bodensatz bleibt Restflüssigkeit. | Rest: 1,2 mL + 0,25 mL/g Bodensatz (+ 2,5 mL/g Blüten) |
| **Dekantieren „zügig“** | wirbelt den Bodensatz auf (`susp` ≥ 40 %), reißt Eisen (8 %) und Salzkristalle (15 %) mit | trübes Ergebnis, erneutes Absetzen möglich |
| **„Obere Schicht abgießen“** | bei Öl/Wasser: Ölschicht, halbe Emulsion und etwas untere Phase gehen mit | ungenauer als der Scheidetrichter |
| **Filtrieren** | Flüssigkeit mit Gelöstem läuft durch; Feststoffe bleiben je nach Papier zurück. Im Rückstand bleibt Flüssigkeit (1 mL Papier + 0,25 mL/g). Was nicht in ein Gefäß tropft, ist verschüttet. Der Trichter fasst 120 mL; es wird portionsweise nachgegossen. | gefaltet: 1,6 mL/s, kein Feststoff im Filtrat · flach aufgelegt: 2,6 mL/s, 30 % des Schwebstoffs gehen durch · gerissen (Rühren im Filter): 65 % · ohne Papier: alles läuft durch, auch trockener Sand rieselt |
| **Lösen von Kochsalz** | Lösegeschwindigkeit ∝ fester Menge; Rühren und Wärme beschleunigen; nie über die Sättigung | k = (0,03 + 0,55·Rühren)·(1 + (T−20 °C)/40 K) s⁻¹ |
| **Kristallisation** | Was die Sättigung überschreitet, liegt sofort als Kristall vor; ohne Wasser ist alles Salz fest | — |
| **Erwärmen / Eindampfen** | Energiebilanz: Heizleistung × Wirkungsgrad des Gefäßes − Wärmeverlust; ab 100 °C geht die Nettoleistung ins Verdampfen | Heizplatte niedrig 150 W, hoch 400 W; Wirkungsgrad Schale 0,85, Becherglas 0,75; Verlust 0,6 W/K; ohne Heizung Abkühlen mit τ = 300 s |
| **Verspritzen** | Hohe Heizstufe, < 4 mL Wasser und Salz in der Schale: 0,6 % des festen Salzes je Sekunde springen heraus (bilanzierter Verlust, Warnung) | Hinweis „Heizung niedriger stellen“ |
| **Magnettrennung** | Magnet erfasst bei jedem Durchgang 92 % (trocken) bzw. 80 % (nass) des vorhandenen Eisens – **nie** Sand oder Salz | mehrere Durchgänge nötig |
| **Scheidetrichter** | Öl und Wasser bilden nach dem Mischen eine Emulsion (emulgierte Anteile beider Phasen), die in Ruhe zerfällt. Beim Öffnen läuft von unten zuerst freies Wasser, dann Emulsion, dann Öl. | Zerfall τ = 25 s; Ablauf 2,4 mL/s (offen) bzw. 0,6 mL/s (Spalt) |
| **Extraktion (Hibiskus)** | Farbstoff wandert aus den Blüten ins Wasser bis zum Gleichgewichtsanteil V/(V + 2,5 mL/g·m); Geschwindigkeit steigt mit Temperatur und Rühren | k = (1/520 s)·e^{0,036·(T−20 °C)}·(1 + 1,5·Rühren) → bei 90 °C etwa 12-mal schneller als bei 20 °C |
| **Sieb** | hält Blütenstücke vollständig zurück, Sand nur zu 8 % | Maschenweite größer als Sandkörner |
| **Überlaufen** | Mehr als das Nennvolumen läuft über (verschüttet) | Becherglas 250 mL, Schale 100 mL, Uhrglas 15 mL |

### 2.3 Sicherheitslogik

Ein Gefäß mit Öl auf der eingeschalteten Heizplatte löst eine **Sicherheitsunterbrechung** aus (Heizplatte aus; Fortsetzen erst nach Entfernen des Gefäßes). Heiße Gefäße auf der eingeschalteten Heizplatte lassen sich nicht anfassen. In K-04 steht keine Heizplatte bereit, weil Erhitzen zur Trennung nicht gebraucht wird.

### 2.4 Erfolgskriterien (Auszug, vollständig in `tasks.js`)

| Aufgabe | gelöst, wenn … |
| --- | --- |
| K-01 | ein anderes Gefäß ≥ 70 mL Wasser enthält mit ≤ 0,25 g Sand und ≤ 0,04 g Schwebstoff; ≥ 8,5 g Sand liegen getrennt davon |
| K-02 | eine Schale/Gefäß ≥ 3,0 g **festes** Kochsalz enthält, ≤ 0,5 mL Wasser, ≤ 0,2 g Sand; ≥ 8 g Sand liegen in salzarmen Fraktionen. Salz im Filtrat ohne Eindampfen zählt nicht. |
| K-03 | zusätzlich eine Eisenfraktion ≥ 4 g ohne Sand/Salz (auch am Magneten) |
| K-04 | ≥ 40 mL Wasser mit ≤ 2 mL Öl und ≥ 40 mL Öl mit ≤ 2 mL Wasser in je eigenen Gefäßen |
| K-05 | ≥ 60 mL Tee mit kräftiger Farbe (≥ 0,11 Einheiten/mL) und ohne Blütenreste; Blüten abgetrennt. Der Tee wird ausdrücklich als **Stoffgemisch** ausgewertet. |

### 2.5 Grenzen

- Keine echte Korngrößenverteilung; zwei Zeitkonstanten ersetzen die Stokes-Sinkgeschwindigkeiten. Die Zeiten sind verkürzt, aber in der richtigen Reihenfolge (Sand setzt sich in Sekunden bis Minuten, Eindampfen dauert Minuten).
- Eisen rostet im Modell nicht (in der Theorie wird erwähnt, dass es in Salzwasser rosten würde).
- Verdunstung bei Raumtemperatur, Löslichkeit von Salz in Öl und Wärmeübergang zwischen Gefäßen werden vernachlässigt.
- Farbstoffeinheiten der Hibiskusblüten sind relativ; die Farbe ist eine qualitative Abbildung der Konzentration.

## 3. Papierchromatographie

### 3.1 Modelldatenset (explizit, reproduzierbar)

Die Proben sind **definierte Modellproben** und keine Aussage über reale Marken. Rf = Laufstrecke des Stoffes ÷ Laufstrecke der Front (ab der Startlinie); `löslich` = Anteil des Fleckes, der mit dem Laufmittel wandert (der Rest bleibt auf der Startlinie).

| Komponente | Farbe | Wasser: Rf / löslich | Ethanol-Wasser 1:1 (V/V): Rf / löslich |
| --- | --- | --- | --- |
| G | gelb | 0,80 / 1 | 0,76 / 1 |
| B | blau | 0,60 / 1 | 0,82 / 1 |
| R | rot | 0,42 / 1 | 0,60 / 1 |
| V | violett | 0,22 / 0,95 | 0,45 / 1 |
| WS | blauschwarz (alkohollöslich) | 0 / **0** | 0,62 / 0,85 |
| P | schwarzes Pigment | 0 / **0** | 0 / **0** |
| K | Kugelschreiberpaste | 0,05 / 0,12 | 0,72 / 0,9 |

| Nr. | Probe | Komponenten (Anteile) | erwartete Beobachtung |
| --- | --- | --- | --- |
| 1 | Schwarzer Filzstift (wasserlöslich) | V 0,5 · R 0,25 · G 0,25 | drei Zonen (violett, rot, gelb) |
| 2 | Grüner Filzstift | G 0,5 · B 0,5 | Wasser: gelb + blau; Ethanol-Wasser: Gelb und Blau laufen fast gleich weit → **eine** grüne Zone |
| 3 | Violetter Filzstift | R 0,5 · B 0,5 | rot + blau; **blau gemeinsam mit Grün** |
| 4 | Oranger Filzstift | G 0,55 · R 0,45 | gelb + rot |
| 5 | Blauer Referenzfarbstoff | B 1 | genau eine Zone |
| 6 | Gelber Referenzfarbstoff | G 1 | genau eine Zone |
| 7 | Wasserfester schwarzer Stift | WS 0,7 · P 0,3 | Wasser: bleibt vollständig auf der Startlinie; Ethanol-Wasser: blauschwarzer Teil wandert, Pigment bleibt |

Das Datenset erfüllt die Vorgaben: unlöslicher, auf der Startlinie verbleibender Farbstoff (P, WS in Wasser), mehrere Komponenten mit unterschiedlicher Wanderung, gemeinsamer Farbstoff in zwei Stiften (B in Grün und Violett) sowie ein Laufmittel, das die Trennung verändert (Grün in Ethanol-Wasser).

### 3.2 Laufmittelfront und Banden

- **Front (Kapillarsteigen nach Washburn):** Strecke² ∝ Zeit. Im Modell dh/dt = D/(2h) − v_Verdunstung mit D(Wasser) = 0,11 cm²/s und D(Ethanol-Wasser) = 0,065 cm²/s (zähflüssiger, steigt langsamer). Ohne Deckel verdunstet Laufmittel (0,006 cm/s statt 0,0005 cm/s): Die Front wird langsamer und bleibt bei Ethanol-Wasser unterhalb des Randes stehen.
- **Lage einer Komponente:** s = Rf × (Front − Startlinie); begrenzt durch den oberen Papierrand. Das Laufmittel steigt sichtbar; die Zonen wandern mit ihrer jeweiligen relativen Geschwindigkeit.
- **Bandenbreite:** σ = 0,85·r_Fleck + 0,075·√s + 0,02·s mit r_Fleck = 0,13 cm·√(Anzahl Auftragungen). Ab dem dritten Auftupfen gilt der Fleck als überladen: zusätzlich ein Schweif zwischen Start und Zone.
- **Getrennte Zonen:** Zwei Komponenten gelten als getrennt sichtbar, wenn ihr Abstand größer als etwa 0,9·(σ₁ + σ₂) + 0,12 cm ist; sonst verschmelzen sie zu einer Zone (Mischfarbe). Auf dieser Zählung beruhen die Beobachtungsfragen – die richtige Antwort hängt vom eigenen Chromatogramm ab.

### 3.3 Fehlerbilder

| Fehler | Modellfolge |
| --- | --- |
| Startlinie unter dem Flüssigkeitsspiegel | Proben lösen sich mit τ = 3 s ins Laufmittel (Kammer färbt sich), Chromatogramm ungültig |
| Kugelschreiber statt Bleistift | Tinte (K) wird als Linie über die ganze Breite mitentwickelt: in Wasser schwacher Schleier knapp über der Linie, in Ethanol-Wasser deutlicher blauer Streifen → ungültig |
| zu großer Fleck | breitere, verschmierte Zonen mit Schweif, können überlappen |
| ungeeignetes Laufmittel | wasserfester Stift wandert in Wasser nicht; Grün in Ethanol-Wasser nicht aufgetrennt |
| Entwicklung zu kurz | < 4,5 cm Frontstrecke → ungültig, Zonen oft noch nicht getrennt |
| Front bis zum Rand | Front nicht bestimmbar (Rf = „nicht bestimmbar“), Zonen bleiben auswertbar |
| Front nicht rechtzeitig markiert | Front 40 s nach dem Herausnehmen eingetrocknet, Markieren nicht mehr möglich |

### 3.4 Theorie im Standardmodus und Expertenmodus

Standardmodus: mobile Phase (Laufmittel), stationäre Phase (Papier, vereinfacht), Löslichkeit im Laufmittel, unterschiedlich starke **Adsorption** an der Papieroberfläche. „Absorption“ wird in den Lückentexten gezielt zurückgewiesen. Eine einzelne Zone ist **kein** Reinheitsbeweis (Vorbehalt in Frage und Theorie).

Expertenmodus (zuschaltbar): Lineal, Messtabelle mit Laufstrecken und Rf = s ÷ Frontstrecke; bei unbekannter Front „–“ bzw. „nicht bestimmbar“. Rf wird im Standardmodus weder angezeigt noch verlangt.

### 3.5 Grenzen

Rf-Werte hängen real von Papiersorte, Temperatur, Kammersättigung und Probenmenge ab; im Modell sind sie konstant. Die Kammersättigung wird nur über den Verdunstungsterm (Deckel) berücksichtigt. Die Farbstoffe sind Modellfarbstoffe.

## 4. Destillation von Ethanol/Wasser

### 4.1 Ausgangsgemisch

30 % (V/V) Ethanol, wählbare Füllung 25 / 100 / 175 mL im 250-mL-Rundkolben. 30 % ist pädagogisch zweckmäßig: deutlicher Siedebeginn (≈ 85 °C), ethanolreiches erstes Destillat (≈ 72 % V/V), das die Brennprobe besteht. Volumenkontraktion beim Mischen wird vernachlässigt.

### 4.2 Siede- und Dampfdaten

Gerundete Literaturwerte für das isobare Gleichgewicht Ethanol/Wasser bei 1013 hPa (x, y = Stoffmengenanteile Ethanol in Flüssigkeit bzw. Dampf):

| x | 0 | 0,019 | 0,072 | 0,097 | 0,124 | 0,166 | 0,234 | 0,327 | 0,397 | 0,508 | 0,573 | 0,676 | 0,747 | 0,894 | 1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| y | 0 | 0,170 | 0,389 | 0,438 | 0,470 | 0,509 | 0,545 | 0,583 | 0,612 | 0,656 | 0,684 | 0,739 | 0,782 | 0,894 | 1 |
| T/°C | 100,0 | 95,5 | 89,0 | 86,7 | 85,3 | 84,1 | 82,7 | 81,5 | 80,7 | 79,8 | 79,3 | 78,7 | 78,4 | 78,2 | 78,1* |

\* **Modellgrenze Azeotrop:** Real bildet Ethanol/Wasser bei x ≈ 0,894 (≈ 96 % V/V) ein Azeotrop mit Siedepunkt 78,2 °C; reines Ethanol siedet bei 78,3 °C. Das Modell setzt die Kurve monoton fort und vernachlässigt das Azeotrop bewusst; dieser Bereich wird bei einer einfachen Destillation des 30-%-Gemischs nicht erreicht. In der Theorie (Expertenhinweis) wird die Grenze genannt.

Zwischenwerte werden linear interpoliert. Es gibt **keine** Zweistufenfolge 78 °C → 100 °C: Die Dampftemperatur beginnt bei ≈ 85 °C und steigt stetig, weil die Flüssigkeit ethanolärmer wird.

### 4.3 Energie- und Stoffbilanz

| Größe | Modell |
| --- | --- |
| Heizpilz | Stufen 0–4: 0 / 80 / 150 / 220 / 320 W |
| Wärmekapazität | Ethanol 2,44 J/(g·K), Wasser 4,18 J/(g·K), Kolben 120 J/K; Wärmeverlust 0,9 W/K |
| Sieden | Ab der Siedetemperatur T_s(x) wird die Nettoleistung zum Verdampfen genutzt; Verdampfungsenthalpie 38,6 kJ/mol (Ethanol), 40,65 kJ/mol (Wasser), Dampf mit Zusammensetzung y(x) |
| Destillationsaufsatz | Der erste Dampf kondensiert am kalten Aufsatz (60 J/K) und läuft zurück; erst danach strömt Dampf zum Thermometer und in den Kühler. **Ohne ausreichende Erwärmung kein Destillat.** |
| Thermometer | Kugel am seitlichen Abgang: misst die Dampftemperatur (= T_s der Flüssigkeit, sobald Dampf strömt; Verzögerung 2 s). Kugel weit darüber: steht im toten Raum, zeigt etwa 86 % des Temperaturanstiegs des Aufsatzes, träge (25 s). Kugel in der Flüssigkeit: zeigt die Flüssigkeitstemperatur. Ohne Thermometer: keine Anzeige (Öffnung mit Stopfen verschlossen gedacht). |
| Kühler | kondensierter Anteil: Wasser schwach 0,78 · mittel 0,97 · stark 0,995; Schläuche vertauscht (Zulauf oben): Mantel nur halb gefüllt → × 0,55; ohne Kühlwasser nur Luftkühlung 0,12. Nicht Kondensiertes entweicht (Warnung „brennbarer Dampf“). |
| Undichtigkeit | ohne Klemmen 8 % Dampfverlust an den Schliffen |
| Vorstoß / Vorlage | ohne Vorstoß tropfen 30 % neben die Vorlage; ohne Vorlage tropft alles auf den Tisch; Laufzeit durch den Kühler τ = 6 s |
| Mitreißen | Stufe 4: 18 %, überfüllter Kolben (> 2/3): 35 % zusätzlich mitgerissene Flüssigkeit der Kolbenzusammensetzung → wasserreicheres Destillat |
| Fraktionen | „Vorlage wechseln“ stellt die bisherige Vorlage als Fraktion beiseite |

### 4.4 Brennprobe

Nur mit einer kleinen Probe (2 mL) in der **getrennten Porzellanschale**. Ergebnis nach Ethanol-Volumenanteil der Probe bei Raumtemperatur:

| Ethanolanteil | Ergebnis im Modell |
| --- | --- |
| ≥ 55 % (V/V) | brennt mit bläulicher, kaum leuchtender Flamme, bis das Ethanol verbraucht ist |
| 40–55 % | flammt kurz auf, erlischt |
| < 40 % | nicht entzündbar |

Didaktische Festlegung in Anlehnung an die Flammpunkte von Ethanol-Wasser-Gemischen (Flammpunkt sinkt von etwa 26 °C bei 40 % auf etwa 13 °C bei 96 %): Wasserreiche Gemische lassen sich bei Raumtemperatur nicht oder nur kurz entzünden. Die Auswertung betont, dass die Brennprobe die **Brennbarkeit** zeigt, nicht Reinheit oder einen exakten Alkoholgehalt.

### 4.5 Sicherheitsunterbrechungen (sofort)

| Auslöser | Erklärung |
| --- | --- |
| Heizen mit Stopfen auf der Vorlage | geschlossene Apparatur – Überdruck, Glas kann bersten |
| Heizen ohne Aufsatz bzw. ohne Kühler | brennbare Ethanoldämpfe träten offen aus |
| Siedeverzug (ohne Siedesteine 4 K über T_s) | schlagartiges Aufschäumen |
| Kolben fast leer (< 8 mL) beim Heizen | Überhitzen, Glasbruch |
| Zünden an der Apparatur | Zündquelle an brennbarem Dampf |
| Probe aus heißem Kolben | heißer, brennbarer Dampf |

Siedesteine werden nicht in Flüssigkeit über 50 °C gegeben (Handlung wird mit Begründung abgelehnt). Ungefährliche Fehler (zu schwache Kühlung, falsches Thermometer, fehlende Vorlage, zu hohe Heizstufe) bleiben lernwirksam und werden nicht gestoppt.

### 4.6 Grenzen

Ein einstufiges Gleichgewicht ohne Rücklauf-Anreicherung; keine Druckabhängigkeit; Wärmeverlust und Aufsatzerwärmung vereinfacht; die Zeiten sind realistisch in der Größenordnung (Aufheizen einige Minuten, Destillat ≈ 5–9 mL/min bei Stufe 3) und werden mit dem Zeitraffer beschleunigt.

## 5. Quellen und Bezugswerte

- Löslichkeit von NaCl, Dichten, Wärmekapazitäten, Verdampfungsenthalpien: Standardtabellenwerte (z. B. CRC Handbook of Chemistry and Physics; GESTIS-Stoffdatenbank des IFA).
- Gleichgewichtsdaten Ethanol/Wasser bei Normaldruck: verbreitete Literaturdaten (z. B. Perry's Chemical Engineers' Handbook, Kapitel Destillation; DECHEMA Chemistry Data Series, Gmehling/Onken), gerundet.
- Kapillarsteigen in Papier: E. W. Washburn, „The Dynamics of Capillary Flow“, Physical Review 17 (1921) 273.
- Flammpunkte wässriger Ethanollösungen: Sicherheitsdatenblätter und GESTIS (Ethanol), Literaturwerte zu alkoholischen Lösungen (gerundet).
- Didaktik der Trennverfahren und der Papierchromatographie: LehrplanPLUS Bayern, Gymnasium, Chemie NTG 8 / SG 9 (Stoffgemische und Trennverfahren).

Alle Zahlenwerte der Modelle stehen zusätzlich als Konstanten im Quellcode und werden in den Unit-Tests verwendet.
