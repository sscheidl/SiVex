# Trennverfahren – Fachmodell, Quellen und Parameter

Stand 0.2.0 · 29.10.2026 · Modellcode: [`js/model.js`](../js/model.js), Geometrie: [`js/geometry.js`](../js/geometry.js), Teilchenmodell: [`js/particles.js`](../js/particles.js)

Das Modell ist ein **kleines, bilanztreues Unterrichtsmodell**. Es koppelt Stoffbestand, Verteilung und Handlungen und soll die Beobachtungen fachlich richtig erklären. Es ist **keine** Strömungs- oder Kinetiksimulation; Zeiten sind beschleunigt, Mengen gerundet.

## 1. Stoffe, Gefäße, Bilanz

| Größe | Einheit | Bedeutung |
| --- | --- | --- |
| `water`, `oil` | mL | Wasser, Speiseöl |
| `sandC`, `sandF` | g | Sand: grobe Körner (90 %) und Feinanteil (10 %, „Schluff“) |
| `iron` | g | Eisenpulver |
| `saltS`, `saltD` | g | Kochsalz fest (Kristalle) bzw. gelöst |

Jedes Gefäß (Becherglas, Erlenmeyerkolben, Abdampfschale, Uhrglas, Porzellanschale, Trichter, Scheidetrichter) und der Magnet führen ihren Bestand. Was ein Gefäß verlässt, landet in einem anderen Gefäß oder in einem Verlusttopf: **verschüttet** (z. B. Filtrat ohne Vorlage), **verdampft** (nur Wasser), **verspritzt** (Salz beim Trockenlaufen). Wasser aus der Spritzflasche wird als Zugabe mitgeführt. Die Bilanz `Anfang + Zugabe = Gefäße + Magnet + Verlusttöpfe` wird in allen Unit-Tests nach jeder Handlungsfolge geprüft (Abweichung < 10⁻⁶).

Eine Trennung erzeugt **keine neuen Stoffe**: Kein Programmteil wandelt einen Stoff in einen anderen um; einzig gelöst ⇄ fest beim Kochsalz ist ein Zustandswechsel desselben Stoffes.

## 2. Teilmodelle

### Sedimentation und Dekantieren (Absetzfront)

Für jeden ungelösten Feststoff gibt es eine **Absetzfront**: Unterhalb der Front schwebt der Stoff gleichmäßig verteilt, darüber ist die Flüssigkeit klar. In Ruhe sinkt die Front mit einer festen Geschwindigkeit; die schwebende Menge lagert sich dabei als Bodensatz ab (Konzentration in der Schwebezone bleibt gleich). Das entspricht dem Bild einer sinkenden Trübungsgrenze, das man im Becherglas sieht.

- **Rühren** (Glasstab) wirbelt Bodensatz auf: Schwebanteil → Feststoff × Aufwirbelbarkeit; die Front springt an die Oberfläche.
- **Zügiges Gießen** bewegt die Quelle und wirbelt nach; **vorsichtiges Gießen** kaum.
- **Abgießen** nimmt die oberste Schicht: Liegt die Front darunter, ist das Dekantat klar; reicht die Schwebezone bis zur entnommenen Schicht, trägt die Flüssigkeit die entsprechende Sandmenge mit. Gegen Ende (weniger als 12 mL über dem Bodensatz) wird der Bodensatz zunehmend mitgerissen – „bis zum letzten Tropfen gießen“ spült Sand aus.

Folge: Zu frühes oder zu schnelles Abgießen ergibt ein trübes Dekantat; Absetzenlassen und erneutes Abgießen in ein drittes Gefäß korrigiert das.

### Lösen und Kristallisieren

- Kochsalz löst sich **nur in vorhandenem Wasser** und **höchstens bis zur Löslichkeitsgrenze** `c_sat(T) = 0,359 + 0,00041 · (T − 20 °C)` g je mL Wasser.
- Lösegeschwindigkeit ∝ Kristalloberfläche (m^2/3) × Untersättigung; ohne Rühren etwa 15 % der Geschwindigkeit mit Rühren.
- Übersteigt die gelöste Menge die Grenze (Wasser verdampft), kristallisiert der Überschuss als festes Salz aus. Ohne Wasser liegt alles Salz fest vor.
- Gelöstes Salz wird nie als Körnchen gezeichnet; die Lösung ist klar wie Wasser.

### Filtrieren

- Ein Rundfilter hält **alle ungelösten Körner** zurück (Sand, Eisen, ungelöste Salzkristalle). Wasser und **gelöstes Salz** passieren.
- Der Ablauf hängt von der Füllhöhe ab (`q = V/6 s`, höchstens 2,5 mL/s); der Trichter fasst 45 mL über dem Papier. Läuft er fast voll, stoppt das Gießen mit einem Hinweis – nachgießen, wenn Flüssigkeit durchgelaufen ist.
- Im nassen Papier bleiben 1,2 mL, im Rückstand je g Sand 0,25 mL (Feinanteil 0,3 mL, Eisen 0,08 mL, Salzkristalle 0,12 mL) Flüssigkeit hängen – mit dem darin gelösten Salz. Nachspülen verdünnt diese anhaftende Lösung.
- **Versuch 5 (ab 0.3.0, vollständige Trennschritte):** Der Rückstand tropft vollständig ab; das gelöste Salz geht also ganz ins Filtrat, Nachspülen ist nicht nötig (schadet aber nicht). Ungelöstes Salz bleibt liegen – zu wenig Wasser zum Lösen bleibt ein Fehler, den Nachspülen korrigiert.
- **Ohne Papier** läuft alles samt Sand durch das Trichterrohr. **Trocken** auf den Filter gegebenes Sand-Salz-Gemenge bleibt vollständig liegen; erst Wasser löst das Salz heraus.
- Steht nichts unter dem Trichter, tropft das Filtrat auf den Tisch (Verlusttopf „verschüttet“, sichtbar als Pfütze).
- **Filterpapier entnehmen:** Wenn nichts mehr tropft, wird das Papier samt feuchtem Rückstand (Sand, ggf. ungelöstes Salz, anhaftende Lösung) vollständig auf ein leeres Uhrglas gelegt. Der Trichter ist danach leer und kann ein neues Papier aufnehmen.
- **Spritzflasche:** 5 oder 20 mL; das Wasser fließt nur während der sichtbaren Strahlphase des Handgriffs (nach 0,35 s bis 0,25 s vor Ende), bilanziert als Zugabe.

### Scheiden (Öl/Wasser)

- Öl ist im Modell **nicht mit Wasser mischbar** und hat die **geringere Dichte**: Ohne Schütteln liegen zwei Schichten vor, Öl oben.
- **Schütteln** ist ein freiwilliger Zusatzversuch: nur außerhalb des Stativrings („in der Hand“), mit aufgesetztem Stopfen und geschlossenem Hahn. Es erzeugt eine Emulsion: Ein Anteil `emul` des Öls ist als Tröpfchen im Wasser verteilt. In Ruhe nimmt `emul` mit τ = 10 s ab (Tröpfchen steigen auf und vereinigen sich). Druck ablassen ist bei Speiseöl/Wasser nicht nötig (keine Gasentwicklung) und wird nicht verlangt. Herausnehmen ist nur mit Stopfen und geschlossenem Hahn möglich; ein in der Hand geöffneter Hahn lässt Flüssigkeit auf den Tisch tropfen (Verlusttopf „verschüttet“).
- Der Hahn lässt die **untere Schicht zuerst** ab: Wasser mit den noch verteilten Öltröpfchen. Nähert sich die Grenzfläche dem Hahn (weniger als 2,5 mL Wasser), wird zunehmend Öl mitgezogen – kein perfekter Schnitt. Stufen: zu / Tropfen (0,6 mL/s) / offen (4 mL/s).
- Mit aufgesetztem Stopfen kann keine Luft nachströmen: Nach etwa 0,8 mL kommt der Fluss zum Stillstand (Hinweis). Der Stopfen ist ein eigenes Objekt auf der Ablage und bewegt sich sichtbar zur Öffnung und zurück.
- Nachgießen in den Scheidetrichter (z. B. eine verunreinigte Fraktion aus einem beliebigen Becherglas) setzt voraus: Scheidetrichter im Ring, Stopfen ab, **Hahn geschlossen** – sonst wird mit Begründung abgewiesen.
- Folgen: Zu früh abgelassen → Öltröpfchen im Wasser; zu spät geschlossen → Öl in der Wasserfraktion. Zurückgießen und erneut scheiden korrigiert.

### Magnettrennung

Der Magnet (in einer Kunststofftüte) zieht **nur Eisen** an. Ab 0.3.0 ist die Trennung nach einer festen Zahl von Durchgängen **restlos** (keine Restmenge, die nie ganz verschwindet):

- trockenes Gemisch: 1. Durchgang ¾ des Eisens, 2. Durchgang der Rest;
- nasses Gemisch oder Filterrückstand: 60 %, dann 75 % des Rests, im 3. Durchgang der Rest.

Die Durchgänge werden je Gefäß gezählt; kommt danach wieder Eisen hinzu, beginnt die Zählung neu. Nach jedem Durchgang meldet die App, ob im Gemisch noch Eisenkörner zu sehen sind. Am Eisen haftet keine Lösung. Abstreifen über einem Gefäß überführt das Eisen dorthin. Sand und Salz bleiben unverändert liegen.

### Heizen und Eindampfen

- Heizplatte mit Trägheit: Plattentemperatur strebt 180 °C (niedrig) bzw. 330 °C (hoch) an (τ 12 s beim Aufheizen, 40 s beim Abkühlen); Wärmestrom in die Schale 1,5 W/K × (T_Platte − T_Inhalt).
- Inhalt mit Wärmekapazität (Wasser 4,18 J/(g·K), Salz 0,85, Schale 90 J/K) und Wärmeverlust 0,35 W/K.
- Unter der Siedetemperatur verdunstet wenig Wasser (stark temperaturabhängig). Beim **Sieden** geht die überschüssige Leistung vollständig in die Verdampfung (2257 J/g). Siedetemperatur der Lösung: 100 °C + 8 K × Sättigungsgrad (gesättigte Sole ≈ 108 °C).
- **Siedeblasen nur beim Sieden**; keine Blasen bei kalter Lösung.
- **Wasserdampf ist unsichtbar.** Gasförmiges Wasser sieht man nicht. Über der heißen Flüssigkeit wird erst mit Abstand eine weiße Wolke gezeichnet – in Schülertexten „Dampf“ genannt; sie besteht aus kondensierten Wassertröpfchen. Der Hintergrund ist dafür etwas dunkler als in 0.1.0.
- **Abkühlen und Entnehmen:** Kristalle lassen sich erst unter 45 °C (Unterrichtsparameter `HANDLE_T`) und ohne restliche Lösung (≤ 1 mL Wasser) mit dem Spatel auf ein leeres Uhrglas (oder in ein Becherglas bzw. eine Porzellanschale) überführen. Ab 0.3.0 in **drei Portionen**, je Spatelgang ein Drittel – die Kristallfläche auf dem Uhrglas wächst sichtbar; am Ende ist die gesamte Masse samt Restfeuchte übertragen.
- **Uhrglas weitergeben (ab 0.3.0):** Der Inhalt eines Uhrglases (Feststoffe, ggf. mit Restfeuchte; auch der Rückstand auf einem abgelegten Filterpapier – das Papier bleibt liegen) lässt sich mit dem Spatel in ein Becherglas, einen Erlenmeyerkolben, eine Porzellanschale oder die abgekühlte Abdampfschale geben, ebenfalls in drei Portionen. So ist das Uhrglas keine Sackgasse mehr.
- Salz wird nicht gasförmig und schmilzt nicht (Schmelztemperatur ≈ 801 °C wird nie erreicht).
- **Trockenlaufen:** Ist auf hoher Stufe nur noch wenig Wasser (< 1,5 mL) über reichlich Kristallen, spritzen Salzkristalle heraus (Verlusttopf „verspritzt“, Warnung „herunterschalten oder ausschalten – die Restwärme genügt“). Ist die Schale trocken und weiter heiß, erscheint „Heizplatte ausschalten“.

### Teilchenmodell (Darstellung, ab 0.3.0)

- Symbole wie in „Aggregatzustände“: **Wasserteilchen als blaue Dreiecke**, Na⁺ (violett, kleiner) und Cl⁻ (grün, größer) mit deutlich lesbarem Ladungszeichen, Ölteilchen als gelbe Stäbchen, Sand- und Eisenkörner als Verbände sehr vieler Teilchen. Alle Symbole etwa doppelt so groß wie in 0.2.0.
- **Gleichmäßige Verteilung:** Jedes Teilchen hat einen Platz relativ zu seiner Phase (Ölphase, Wasserphase, Bodensatz) und bewegt sich thermisch darum; die Plätze wandern langsam ungeordnet. Dadurch füllen Ölteilchen die ganze Ölschicht (nicht nur die Grenzfläche), reines Öl bildet keine Schichten, und beim Befüllen entstehen keine Reihen.
- **Emulsion:** Nach dem Schütteln ist der Anteil `emul` des Öls auf Tröpfchen verteilt (bis zu 12, Fläche entsprechend ihrem Ölanteil, ohne Überlappung) – umgeben von Wasserteilchen, in Tröpfchen kein Wasser. In Ruhe steigen die Tröpfchen auf und vereinigen sich mit der Schicht, im Takt der Entmischung im Scheidetrichter.
- **Mengen:** Ionenzahl ∝ Konzentration × sichtbare Flüssigkeit (bei Sättigung 36 Paare für den ganzen Ausschnitt); festes Salz 10 Ionen je g (höchstens 96) als wenige große Kristalle bzw. – im Gemenge – als kleine Kristalle zwischen den Körnern; Eisenkörner ∝ Masse (1 Korn je 0,8 g), Sandkörner 1 je 1,6 g. Die Verhältnisse sind bewusst nicht maßstäblich (real ≈ 1 Ionenpaar auf 16 Wassermoleküle in gesättigter Lösung).
- **Magnet:** Nur die tatsächlich erfassten Eisenkörner wandern zum Magneten, bleiben dort und verlassen mit ihm das Bild; die übrigen bleiben im Gemisch liegen.

### Tropfen und Rinnsal (Darstellung, ab 0.3.0)

Aus Trichter und Scheidetrichter fallen gezeichnete Tropfen von ≈ 0,05 mL (realer Tropfen). Ihre Größe ist leicht überzeichnet und so begrenzt, dass ein Tropfen auch bei kleinem Maßstab gut zu sehen ist; an der Spitze wächst ein hängender Tropfen und reißt ab. Ab etwa 8 sichtbaren Tropfen je s geht die Darstellung in eine Tropfenkette und ab 14 je s in ein zusammenhängendes, nach unten schmaler werdendes Rinnsal über (wie in der Destillation). Das Rinnsal endet am Spiegel bzw. Innenboden des Auffanggefäßes. Reine Darstellung – das Modell rechnet unverändert mit dem Volumenstrom.

### Gefäßgeometrie und Flüssigkeitsdarstellung

Gefäße sind Rotationskörper mit realen Abmessungen (1 mm = 1,25 px; Becherglas 250 mL: Ø 70 mm innen, Füllhöhe 100 mL ≈ 30 mm). Füllhöhen ergeben sich aus dem Volumen. Beim Neigen bleibt der Spiegel **waagrecht**: Die Spiegelhöhe wird so bestimmt, dass die Querschnittsfläche unterhalb der Waagrechten der Füllung entspricht; der Neigungswinkel beim Gießen ist der Winkel, bei dem der Spiegel den Ausguss erreicht (plus wenige Grad je nach Gießtempo). Der Strahl beginnt am Ausguss und folgt einer Wurfparabel bis zum Spiegel des Ziels. Bodensatz haftet am Gefäßboden und kippt mit.

## 3. Trennziele und Toleranzen (Unterrichtsparameter)

Bewertet wird der **tatsächliche Bestand in getrennten Fraktionen**, nicht eine Klickfolge. Die Schwellen erlauben realistische Restmengen.

| Versuch | Ausgangsmengen | Ziel (alle Kriterien) | Begründung der Schwellen |
| --- | --- | --- | --- |
| 1 Dekantieren | 100 mL Wasser, 20 g Sand | einmal aufgerührt (≥ 50 % schwebend); ≥ 50 mL Wasser in anderem Becherglas mit ≤ 0,3 g Sand; ≥ 15 g Sand bleiben in A | Beim Dekantieren bleiben 20–30 mL über dem Sand stehen; 0,3 g in ≥ 50 mL ist „fast klar“. Eine verlustfreie Trennung ist nicht verlangt. |
| 2 Filtrieren | 100 mL Wasser, 20 g Sand | mindestens 30 mL durch ein Filterpapier im Ring filtriert; ≥ 60 mL Filtrat ohne Sand (≤ 0,05 g); ≥ 15 g Sand im Filterpapier – im Trichter **oder** mit dem Papier auf dem Uhrglas | ≈ 6 mL bleiben im nassen Rückstand; ein kleiner Sandrest im Becherglas wird toleriert. |
| 3 Eindampfen | 40 mL Lösung mit 8 g Kochsalz | ≥ 5,6 g Kristalle in der Schale **oder** nach dem Überführen auf dem Uhrglas; ≤ 1 mL Restwasser; ≥ 25 mL verdampft | 70 % Ausbeute erlaubt Reste im Becherglas und Spritzverluste. |
| 4 Scheiden | 50 mL Wasser, 50 mL Öl | ≥ 30 mL über den Hahn abgelassen (kein Schüttelkriterium – Schütteln ist freiwillig); Gefäß mit ≥ 40 mL Wasser und ≤ 1,5 mL Öl; anderes Gefäß mit ≥ 40 mL Öl und ≤ 1,5 mL Wasser | Mit „Tropfen“ an der Grenzfläche erreichbar (Test: 0,9 mL Öl im Wasser, 0,4 mL Wasser im Öl). |
| 5 Trennkette | 5 g Eisen, 10 g Sand, 5 g Kochsalz | Eisen ≥ 4 g mit ≤ 0,1 g Sand und ≤ 0,15 g Salz; Sand ≥ 7,5 g mit ≤ 0,3 g Eisen und ≤ 0,6 g Salz (fest + gelöst); Salz ≥ 3,5 g trocken (≤ 1 mL Wasser) mit ≤ 0,05 g Sand und Eisen | Jeder richtig ausgeführte Schritt trennt vollständig (0.3.0): zwei Magnetdurchgänge (nass drei) entfernen alles Eisen, das Filtrat nimmt alles gelöste Salz mit. Ungelöstes Salz (zu wenig Wasser) bleibt ein Fehler. |

Erreichte Ziele werden je Versuch mit Ansatz und Versuchszeit gespeichert; ein späteres Verändern des Ansatzes nimmt den Erfolg nicht zurück. „Ergebnis prüfen“ zeigt jederzeit den aktuellen Zustand.

### Bewertung des Trennprinzips (Protokoll)

Gefragt wird nach der Eigenschaft, die **unmittelbar** zum Trennen genutzt wird. Antwortoptionen sind nach Materialart getrennt formuliert (Dichte; Löslichkeit eines **Feststoffs** in Wasser; **Nichtmischbarkeit** zweier Flüssigkeiten; Korngröße gegenüber den Filterporen als Trennkriterium; Magnetismus; Flüchtigkeit). Drei Kategorien:

| Versuch | verlangt | nicht nötig, aber nicht falsch (mit Erläuterung) |
| --- | --- | --- |
| 1 Dekantieren | Dichte | Löslichkeit (Unlöslichkeit des Sandes ist die Voraussetzung) |
| 2 Filtrieren | Korngröße | Löslichkeit (Voraussetzung) |
| 3 Eindampfen | Flüchtigkeit | Löslichkeit (Ausgangslage) |
| 4 Scheiden | Nichtmischbarkeit, Dichte | Löslichkeit (gegenseitige Unlöslichkeit = Nichtmischbarkeit; das genauere Kreuz wird erläutert) |
| 5 Trennkette | Magnetismus, Löslichkeit, Korngröße, Flüchtigkeit | Dichte (wenn nicht dekantiert). **Ab 0.3.0:** Wurde in der Kette dekantiert (≥ 10 mL Flüssigkeit über einem Bodensatz abgegossen), zählt Dichte als richtig; ohne Filtration wird dann Dichte statt Korngröße verlangt. |

Alle anderen Kreuze (z. B. Farbe) sind falsch. Freitexte werden nicht bewertet.

## 4. Unterrichtsparameter (bewusst gesetzt, beschleunigt)

| Parameter | Wert im Modell | Realität / Begründung |
| --- | --- | --- |
| Absinken der Front (grober Sand / Feinanteil / Eisen / Salzkristalle) | 22 / 1,25 / 60 / 30 mL Säule je s | Grober Sand setzt sich in Sekunden, Schluff in Minuten ab; Feinanteil im Modell ≈ 80 s für 100 mL. Zeitraffer 10×/30× verkürzt das Warten. |
| Filterdurchfluss | ≤ 2,5 mL/s, τ = 6 s | Qualitatives Papier (Whatman Grade 1) braucht ca. 150 s für 100 mL im Herzberg-Test – das Modell ist etwa 4-fach schneller. |
| Gießen | vorsichtig 4 mL/s, zügig 12 mL/s; Feststoffe 3 bzw. 8 g/s | anschauliche Werte |
| Entmischung | τ = 10 s | Speiseöl/Wasser ohne Emulgator entmischt sich in etwa einer Minute (Klassenversuch); beschleunigt |
| Heizleistung | effektiv bis ≈ 300 W | Eindampfen von 40 mL dauert ≈ 7 min Versuchszeit (bei 30× ≈ 15 s) |
| Lösen | 0,6 · m^2/3 g/s bei Sättigung 0, Rühren × 6,7 | 5 g Salz in 40 mL lösen sich gerührt in wenigen Sekunden |
| Sand-Feinanteil | 10 % | erzeugt die länger anhaltende Trübung |
| Anhaftende Feuchte | 0,25 mL/g Sand, 1,2 mL Papier | Größenordnung feuchter Sand (Porenvolumen ≈ 35–40 %) |
| Zeitraffer während Handgriffen | höchstens 1× | Gießen, Ablassen und Bewegungen bleiben beobachtbar und stoppbar |

## 5. Literaturwerte

| Wert | im Modell | Quelle |
| --- | --- | --- |
| Löslichkeit Kochsalz in Wasser | 0,359 g/mL (20 °C), 0,392 g/mL (100 °C) | ≈ 358 g/L bei 22 °C ([chemie.de-Lexikon „Natriumchlorid“](https://www.chemie.de/lexikon/NaCl.html)); 360 g/L bei 20 °C ([Sicherheitsdatenblatt Carl Roth, 2015](https://www.wmi.badw.de/fileadmin/WMI/Intranet/Sicherheit/Sicherheitsdatenbaetter/Sicherheitsdatenblatt_Natriumchlorid_Roth_20150825.pdf)); 39,2 g/100 g bei 100 °C (CRC Handbook of Chemistry and Physics) |
| Schmelztemperatur Kochsalz | nur Text (≈ 801 °C) | 800–802 °C (Sicherheitsdatenblatt Carl Roth) |
| Siedetemperatur gesättigter Kochsalzlösung | ≈ 108 °C | 108,7 °C bei 1 atm ([Smith College, Phasendiagramm H₂O–NaCl](https://www.science.smith.edu/~jbrady/petrology/igrocks-diagrams/binary/ice-halite-third.php)); gemessen 108,1 °C bei 100,85 kPa ([IYPT 2010](https://2010.iypt.org/dl/heatandtemperature.pdf)) |
| Verdampfungsenthalpie Wasser | 2257 J/g | bei 100 °C, Standardwert (z. B. CRC Handbook) |
| spezifische Wärmekapazität Wasser | 4,18 J/(g·K) | Standardwert |
| Dichte Speiseöl / Wasser | 0,92 / 1,00 g/mL | Sonnenblumenöl ≈ 0,92 g/cm³ (Lebensmittelkunde, Standardwert) |
| Dichte Quarzsand / Eisen | 2,65 / 7,87 g/cm³ | Standardwerte; Schüttdichte Sand ≈ 1,5 g/cm³ (Darstellung des Bodensatzes) |
| Rückhalt Filterpapier | alle Körner | qualitatives Papier, z. B. Whatman Grade 1: Partikelrückhalt 11 µm ([Avantor/Cytiva](https://avantorsciences.com/ca/en/product/NA3948151/whatman-grade-1-qualitative-filter-paper-whatman-products-cytiva), [Sigma-Aldrich](https://www.sigmaaldrich.com/CA/en/product/aldrich/wha1001813)); Feinsand ≥ 63 µm, Ionen und Wassermoleküle < 1 nm |

Die verlinkten Online-Quellen wurden für diese Umsetzung am 27.10.2026 geprüft; als „Standardwert“ bzw. „CRC Handbook“ bezeichnete Werte sind gängige Tabellenwerte und wurden nicht gesondert nachgeschlagen – vor einer Freigabe bitte durch die Lehrkraft gegenprüfen. Die Literaturwerte bestimmen die Lage (Löslichkeit, Siedepunkterhöhung, Dichteverhältnis), die Zeitkonstanten sind Unterrichtsparameter (Abschnitt 4).

## 6. Vereinfachungen und Grenzen

- Volumenkontraktion beim Lösen, Temperaturabhängigkeit der Dichten und Verdunstung bei Raumtemperatur über Minuten sind vernachlässigt bzw. stark vereinfacht.
- Der Feinanteil des Sandes wird vom Papier vollständig zurückgehalten (reale Filtrate können anfangs leicht trüb sein).
- Öl wird nicht filtriert; Öl kommt nur in Versuch 4 vor. Emulgierte Wassertröpfchen im Öl werden nicht geführt.
- Eisen rostet im Modell nicht.
- Gefäßvolumina im gekippten Zustand werden über die Querschnittsfläche bestimmt (für zylindrische Bechergläser exakt, solange der Spiegel den Boden nicht schneidet; für den Erlenmeyerkolben eine Näherung).
- Gießen in sehr enge Öffnungen (Hals des Scheidetrichters) wird ohne zusätzlichen Trichter zugelassen.

## 7. Teilchenmodell (schematisch)

Das Teilchenmodell zeigt einen vergrößerten Ausschnitt des gewählten Gefäßes. **Anzahl und Lage der Symbole folgen dem Modellzustand** (Füllstand, Schwebanteil und Absetzfront, gelöstes und festes Salz, Öl als Schicht oder Tröpfchen, Filterdurchlauf, Verdampfen, Magnet). Symbole stehen stellvertretend für sehr viele Teilchen; weder Teilchenzahl noch Größenverhältnis sind maßstäblich.

| Stoff | Symbol |
| --- | --- |
| Wasser | kleiner blauer Kreis |
| gelöstes Kochsalz | Na⁺ (kleiner violetter Kreis mit +), Cl⁻ (größerer grüner Kreis mit −), einzeln zwischen den Wasserteilchen |
| festes Kochsalz | regelmäßiges Gitter aus Na⁺ und Cl⁻ |
| Öl | gelbe Ovale (andere Form als Wasser); Tröpfchen = Gruppe vieler Ölteilchen |
| Sand, Eisen | große unregelmäßige Körner mit Punkten („ein Korn besteht aus sehr vielen Teilchen“) |
| gasförmiges Wasser | einzelne, weit auseinander liegende Wasserteilchen über der Flüssigkeit |

Keine Hydrathüllen, keine „Kochsalzmoleküle“, keine festen Krümel für gelöstes Salz. Der Text unter dem Bild trennt **Beobachtung** (Stoffebene) und **Modell** (Teilchenebene).

**Versuch 3 – Vergleichsbilder (zuschaltbar über die Gefäßwahl im Teilchenmodell):** reines Wasser (Reinstoff, nur Wassermoleküle), festes Kochsalz (Reinstoff/Verbindung, Na⁺ und Cl⁻ im Ionengitter, keine „Kochsalzmoleküle“) und Kochsalzlösung (homogenes Gemisch, einzelne Ionen zwischen Wassermolekülen; „gelöst“ ist kein Aggregatzustand). Diese Bilder sind feste Vergleichszustände und stammen nicht aus dem laufenden Versuch; sie sind entsprechend gekennzeichnet.
