# Aggregatzustände – fachliche Grundlagen und Vereinfachungen

Stand 0.2.0 (prototype). Zielgruppe: Gymnasium Bayern, Chemie Jgst. 8 (NTG) bzw. 9 (SG). Die fachliche Freigabe durch die Lehrkraft steht aus.

## 1. Temperaturwerte

Werte bei Normaldruck (1013 hPa), gerundet auf ganze Grad Celsius. Grundlage sind die Tabellenwerte im CRC Handbook of Chemistry and Physics (Abschnitt „Physical Constants of Inorganic Compounds“) bzw. die IUPAC-Festlegung für Wasser; sie stimmen mit den in Schulbüchern üblichen Angaben überein.

| Stoff | Schmelztemperatur | Siedetemperatur | Darstellungsbereich des Reglers | Startwert |
| --- | ---: | ---: | ---: | ---: |
| Wasser | 0 °C | 100 °C | −30 bis 130 °C | 20 °C (flüssig) |
| Iod (I₂) | 114 °C (113,7 °C) | 184 °C (184,4 °C) | 20 bis 220 °C | 25 °C (fest) |
| Eisen | 1538 °C | 2862 °C | 1400 bis 3000 °C | 1400 °C (fest) |
| Kochsalz (Natriumchlorid) | 801 °C | 1465 °C | 700 bis 1600 °C | 700 °C (fest) |

Die Bereiche sind **didaktische Darstellungsbereiche**, keine Messbereiche einer Heizung. Sie umfassen jeweils beide Übergangstemperaturen mit Abstand nach unten und oben.

**Reglerskala:** Bei Wasser und Iod ist die Skala linear. Bei Eisen und Kochsalz ist sie bewusst **gestaucht** (stückweise linear): Die Schmelztemperatur liegt bei einem Viertel, die Siedetemperatur bei drei Vierteln der Reglerlänge. Fest, flüssig und gasförmig erhalten so etwa gleich viel Reglerweg, obwohl der flüssige Bereich viel breiter ist. Die Markierungen und die Temperaturanzeige bleiben korrekt; mit der Tastatur lässt sich weiterhin jedes Grad einzeln einstellen. Alle Werte stehen in einem gemeinsamen Datensatz (`js/substances.js`); es gibt keine stoffspezifische Simulationslogik.

## 2. Zustandsmodell (Stoffebene und Teilchenebene gemeinsam)

- Der Regler stellt die Temperatur **direkt** ein. Es gibt kein Erhitzen, keine Wärmeleistung und keine Energiebilanz. Die Temperaturanzeige folgt sofort; das Bild folgt weich mit kurzer Verzögerung (nach etwa 1 s angekommen).
- Der Zustand wird über eine einzige Größe beschrieben: 0 = fest, 1 = flüssig, 2 = gasförmig. Zwischenwerte sind Mischungen. Ein Wechsel dauert gut eine Sekunde; dabei sind fest und flüssig bzw. flüssig und gasförmig für einen Augenblick nebeneinander zu sehen. Ein Sprung von fest nach gasförmig läuft über die Flüssigkeit (Schmelzen, dann Verdampfen).
- **Genau an** der Schmelz- bzw. Siedetemperatur liegen beide Zustände dauerhaft zu gleichen Teilen nebeneinander vor. Das ist ein konsistenter Modellzustand: Bei der Übergangstemperatur können beide Phasen koexistieren. Wie viel jeweils vorliegt, hängt in Wirklichkeit von der zugeführten Wärme ab – diese bildet das Modell bewusst nicht ab.
- Stoffebene und Teilchenebene lesen **dieselben Anteile** (fest, flüssig, gasförmig, an der kalten Oberfläche). Der Wechsel der Ansicht setzt nichts zurück.

## 3. Teilchenebene

**Schematisch, nicht maßstabsgetreu.** Die Symbole sind keine Molekülstrukturzeichnungen; sie stehen für „ein Teilchen dieses Stoffes“:

| Stoff | Symbol |
| --- | --- |
| Wasser | blaues Dreieck |
| Iod | violettes Rechteck |
| Eisen | silbergraue, leicht glänzende Kugel |
| Kochsalz | kleine dunkelgraue und größere grüne Kugeln (zwei Teilchensorten) |

Eine einzige Engine (`js/particles.js`) mit 48 Teilchen für alle Stoffe; die Stoffe unterscheiden sich nur über Gitterart, Abstände und Symbol.

- **Fest:** regelmäßige Anordnung auf festen Plätzen; die Teilchen schwingen um ihre Plätze, mit der Temperatur stärker.
- **Flüssig:** eng beisammen, ungeordnet, ständig in Bewegung; die Teilchen gleiten aneinander vorbei und wechseln ihre Nachbarn. Sie bleiben unten im Raum und bilden eine Oberfläche.
- **Gasförmig:** große Abstände, schnelle geradlinige Bewegung mit unterschiedlichen Geschwindigkeiten, Zusammenstöße mit Richtungswechsel, Abprallen an den Wänden. Die mittlere Geschwindigkeit steigt mit der Temperatur.
- **Übergänge:** Beim Schmelzen lösen sich zuerst Teilchen oben und außen aus dem Gitter, beim Erstarren füllen sich die Plätze von unten innen. Beim Verdampfen verlassen die obersten Teilchen der Flüssigkeit diese, beim Kondensieren kehren die untersten Gasteilchen zurück. Die Bewegungsart geht weich über. Kein Teilchen entsteht, verschwindet oder ändert seine Größe.
- **Anziehung** wird nicht als Pfeil oder Zahl gezeigt. Sie wird an den Zuständen sichtbar: fester Zusammenhalt im Feststoff, Zusammenbleiben in der Flüssigkeit, weitgehend unabhängiger Flug im Gas. Die App behauptet nirgends, die Anziehung verschwinde bei hoher Temperatur; eine Aufgabe greift diese Fehlvorstellung ausdrücklich auf.

### Sonderfälle, bewusst minimal

- **Eis:** Das Gitter des Eises ist etwas weiter als die Packung im flüssigen Wasser. Das deutet die geringere Dichte von Eis an (ohne zusätzliche Logik). Auf der Stoffebene schwimmt schmelzendes Eis auf dem Wasser.
- **Kochsalz:** Die Legende nennt die beiden Teilchensorten **Natrium-Ion (Na⁺)** und **Chlorid-Ion (Cl⁻)**. Im Feststoff wechseln sie sich regelmäßig ab (Schachbrettmuster als 2D-Schnitt durch das Steinsalzgitter), in der Schmelze bewegen sie sich einzeln. Im Gas treten sie als **Ionenpaare (NaCl)** auf. Das ist fachlich begründet: Gasförmiges Natriumchlorid besteht aus NaCl-Einheiten und einem beträchtlichen Anteil Doppeleinheiten (Na₂Cl₂); freie Na⁺- und Cl⁻-Ionen kommen praktisch nicht vor. Die Trennung eines Paares in freie Ionen erfordert rund 5,5 eV, die mittlere Wärmeenergie bei 1465 °C beträgt nur etwa 0,15 eV (selbst die Trennung in Atome, etwa 4,2 eV, spielt keine Rolle). Die Doppeleinheiten werden zur Vereinfachung nicht gezeigt. Ionenbindung und Ladungen werden nicht vertieft; es gibt keine Pflichtaufgabe dazu.

## 4. Stoffebene

- **Geschlossenes System:** Alle Stoffe befinden sich in geschlossenen Gefäßen, damit der gasförmige Stoff nicht entweicht und beim Abkühlen wieder zurückkehren kann (die Stoffmenge bleibt erhalten, wie auf der Teilchenebene).
- **Gefäße:** Wasser und Iod im Becherglas mit aufgelegtem Uhrglas als Deckel (Glas und Flüssigkeit nach TitraLab 3, Wellen nach `apps/pufferfish`). Der Dampf sammelt sich unter dem Deckel; beim Abkühlen bilden sich Tröpfchen am Deckel und an der Wand. Eisen und Kochsalz in einem weiten Keramiktiegel, der in einem **Ofen** steht – im Schnitt gezeichnet, damit man hineinsieht. Ein Glasgefäß würde bei diesen Temperaturen erweichen. Die Kammer aus Schamottesteinen ist geschlossen; die **Heizstäbe** an den Seitenwänden glühen je nach Temperatur von dunkelrot (um 700 °C) bis gelblich-weiß (um 3000 °C). Tiegel- und Ofenmaterial sind bei fast 3000 °C idealisiert.
- **Wasser:** Eis milchig-weiß mit Rissen und Luftbläschen, schmelzend schwimmend; flüssiges Wasser klar und leicht bläulich mit Meniskus und Oberflächenwellen; beim Sieden Blasen, an der Siedetemperatur dauerhaft siedend.
- **Iod:** fester Haufen dunkler, metallisch glänzender Kristallplättchen; Schmelze dunkel violettbraun; Dampf violett.
- **Eisen:** fester Quader silbergrau mit leichtem Glühschein; Schmelze hell glühend (Farbe nach Temperatur von orange bis gelblich-weiß, schematisch). Reales Eisen glüht schon bei 1400 °C hell gelborange; die Darstellung zeigt den Barren bewusst metallisch grau mit Glühschein, damit fest und flüssig deutlich unterscheidbar bleiben.
- **Kochsalz:** weiße Würfelkristalle auf einer Salzkruste; Schmelze klar und farblos mit Lichtreflexen, im heißen Tiegel leicht vom Glühen getönt.
- **Übergänge** zeigen Zwischenbilder: schrumpfende, schwimmende bzw. einsinkende Feststoffe, steigende und sinkende Flüssigkeitsspiegel, Siedeblasen bzw. platzende Blasen an der Schmelze, aufsteigende bzw. absinkende und sich auflösende Gaswölkchen, Kondenströpfchen an der Glaswand.

### Gasphase sichtbar dargestellt

Gase wie Wasserdampf, Eisen- oder Kochsalzdampf sind in Wirklichkeit unsichtbar (der weiße „Dampf“ über kochendem Wasser sind bereits wieder kondensierte Tröpfchen). Die App macht die Gasphase trotzdem als **weiche, transparente, aufsteigende Wölkchen** sichtbar, damit der Zustand beobachtbar wird. Unter dem Bild steht dauerhaft: „Gasphase zur Veranschaulichung sichtbar dargestellt.“ Nur Iod hat die violette Farbe seines tatsächlich farbigen Dampfes; bei Wasser, Eisen und Kochsalz sind die Wölkchen weiß. Eine Behauptung, reiner Wasserdampf sei weiß sichtbar, enthält die App nicht.

## 5. Iod: Sublimation und Resublimation

- Festes Iod hat schon bei Raumtemperatur einen merklichen Dampfdruck. In der App entsteht ab etwa 30 °C und deutlich ab etwa 60 °C langsam ein kleiner violetter Dampfanteil über dem Feststoff (höchstens 14 % des Stoffes, in rund 1,5 s aufgebaut) – **Sublimation** unterhalb der Schmelztemperatur.
- Zwischen 114 °C und 184 °C ist Iod regulär **flüssig** (mit Dampf darüber). Die App vermittelt also nicht, Iod bilde beim Erwärmen grundsätzlich keine Flüssigkeit; eine Aufgabe fragt genau danach.
- **Kalte Oberfläche** (nur bei Iod, jederzeit ein- und ausblendbar): Auf das Uhrglas über dem Becherglas wird Eis gelegt. Der violette Dampf sammelt sich darunter, an der Unterseite wachsen dunkle Iodkristalle – **Resublimation**. Auf der Teilchenebene lagern sich Gasteilchen an einer kalten Fläche oben regelmäßig an. Die Kristalle wachsen umso schneller, je mehr Gas vorhanden ist (bei 25 °C kaum), und bleiben beim Abkühlen erhalten. Höchstens 30 % des Stoffes setzen sich ab.
- Das ist eine **didaktische Sondervisualisierung**, keine Simulation mit zwei Temperaturzonen. Beim Ausblenden geht das abgelagerte Iod modellhaft wieder in die Probe zurück (die Kristalle verschwinden innerhalb etwa einer Sekunde), damit die Teilchenzahl auf der Teilchenebene erhalten bleibt.

## 6. Schema der Phasenübergänge

Zuschaltbar als Spalte neben dem Bild (nie darüber). Die drei Zustände sind Kästen, deren Farbe den Anteil des Stoffes in diesem Zustand zeigt; der Kasten mit dem größten Anteil ist umrandet. Läuft ein Übergang, wird sein Pfeil hervorgehoben und bewegt sich. Genau an der Schmelz- bzw. Siedetemperatur (beide Zustände nebeneinander) und bei Iod mit gleich bleibender Dampfmenge laufen **beide Richtungen** gleichzeitig – ein erster, unaufdringlicher Hinweis auf ein dynamisches Gleichgewicht, ohne den Begriff einzuführen. Die Fachbegriffe stehen im Schema immer; Schritt 3 der Aufgaben dient dann der Wiederholung.

## 7. Grenzen des Modells

- Kein Druck, keine Wärmemenge, keine Schmelz- oder Verdampfungsenthalpie, keine Siedepunktserhöhung, keine Unterkühlung oder Siedeverzug.
- Verdunsten unterhalb der Siedetemperatur wird nur bei Iod (als Sublimation bzw. Dampf über der Schmelze) gezeigt, nicht bei Wasser.
- Die Teilchenbewegung ist eine qualitative Animation (Federn, Zufallsstöße, elastische Stöße), keine Molekulardynamik. Teilchengrößen, Abstände und Geschwindigkeiten sind nicht maßstabsgetreu.
- Glühfarben, Gefäßmaterial und Wölkchen sind schematisch.

## 8. Technik: Canvas 2D statt WebGL (begründete Ausnahme)

Für SiVex ist WebGL bei Teilchenvisualisierungen grundsätzlich vorgesehen. Im Repository gibt es dafür bisher keinen Baustein. Die Teilchenebene zeigt knapp 50 flache 2D-Symbole; Canvas 2D ist dafür robuster (kein Kontextverlust auf dem iPad, keine Shader), wartbarer und mit den übrigen SiVex-Apps einheitlich. Die Rechenlast ist gering (48 Teilchen, 120 feste Rechenschritte je Sekunde). Diese Ausnahme ist im Testbericht vermerkt.
