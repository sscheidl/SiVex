# Fachmodell · Trennlabor 1.0

Dies sind reproduzierbare Unterrichtsmodelle, keine Messdaten realer Stiftmarken und keine Anleitung für reale Experimente. Quellen stützen die qualitativen Zusammenhänge; ausdrücklich als Modellparameter bezeichnete Zahlen sind didaktische Festlegungen. Implementierung: `js/chemistry.js`, Bewertung: `js/lab.js`.

## Mengen, Phasen und Bilanz

Alle Stoffmengen werden in Gramm geführt. Wasserzugabe ist auf insgesamt 500 g je klassischem Versuch begrenzt (höchstens 150 g je Zugabe). Ein Stoffvektor enthält Wasser, Sand, festes Salz, gelöstes Salz, Eisen, Öl, Blütenreste, gebundenen und gelösten Modellfarbstoff. Temperatur, Rührzeit und Absetzgrad sind zusätzliche Größen. Festes + gelöstes Salz sowie gebundener + gelöster Farbstoff bleiben jeweils erhalten. Wasser, das verdampft, wird ausdrücklich im Dampfbehälter mitgeführt. Verworfenes und übergelaufenes Material liegt im Verlustbehälter und ist nicht zurückholbar. Die Bilanzansicht zählt auch diese Mengen.

| Aufgabe | Ausgangsansatz in Becherglas A |
| --- | --- |
| K-01 | 10 g Sand + 80 g Wasser, 20 °C |
| K-02 | 10 g Sand + 10 g festes Kochsalz, 20 °C |
| K-03 | 8 g Eisen + 10 g Sand + 10 g festes Kochsalz, 20 °C |
| K-04 | 60 g Wasser + 40 g Modellöl, 20 °C |
| K-05 | 4 g Blütenmatrix + 1 g darin gebundener Modellfarbstoff, 20 °C |
| D | Höchstens 100 g Vorrat: 30 Massen-% Ethanol + 70 Massen-% Wasser, 20 °C |

Die Aufteilung der Hibiskusblüten in Matrix und Farbstoff ist ein didaktisches Massenmodell, keine analytische Angabe zur realen Zusammensetzung. Öl ist im Modell wasserunlöslich, weniger dicht als Wasser und nicht flüchtig. Sand, Eisen und Pflanzenmatrix sind im angebotenen Wasser unlöslich. Es gibt keine chemischen Reaktionen in den klassischen Trennversuchen.

## Klassische Trennverfahren

- **Sedimentieren:** Absetzgrad 0…1 steigt in Ruhe mit 0,075/s, erreicht also nach ca. 13,4 Modellssekunden vollständiges Absetzen. Rühren hält ihn bei 0. Die Körnerdarstellung hängt von diesem Wert ab. Es handelt sich um ein stark beschleunigtes, einheitliches Korngrößenmodell.
- **Dekantieren:** 92 % der Flüssigkeit werden über 6 s umgefüllt. Mitgenommener Feststoffanteil = 0,03 + 0,65 × (1 − Absetzgrad). Schnelles Gießen dauert 2 s und nimmt 55 % des Feststoffs mit. Keine ideale verlustfreie Dekantierung; Absetzen und erneutes Filtrieren bleiben möglich.
- **Lösen:** Vereinfachte Salzkapazität 0,36 g pro g Wasser bei allen angebotenen Temperaturen. Lösen höchstens 2 g/s beim Rühren (8 s Rührwirkung), sonst 0,1 g/s. Ein fehlender Wasseranteil verhindert das Lösen. Nach Wasserverlust kristallisiert Überschuss aus. Die schwache reale Temperaturabhängigkeit der NaCl-Löslichkeit wird vernachlässigt.
- **Filtrieren:** Transfer über 8 s. Korrektes Papier hält alle vorhandenen unlöslichen Feststoffe einschließlich ungelösten Salzes zurück; gelöstes Salz und Farbstoff passieren. Undichtes Papier hält 50 %, fehlendes Papier 0 % zurück. Ein trockener Ansatz landet somit als weiterhin gemischter Rückstand im Filter; das ist keine Salztrennung. Ohne montiertes Auffanggefäß geht der Ansatz verloren. Das grobe Blütensieb verwendet dieselbe Rückhaltefunktion, da nur einheitlich große Pflanzenreste modelliert sind; keine Aussage über beliebige reale Siebe.
- **Magnet:** Nur Eisen wird über 4 s zum Magnetbehälter übertragen. Entfernen/Umfüllen des Eisens löscht keine Stoffe. Das Modell vernachlässigt anhaftende Feuchte.
- **Umfüllen:** Beliebige angebotene Gefäße als Quelle/Ziel; proportionaler Transfer über 5 s. Aktive Transfers lassen sich nicht überlagern. Bei Überlauf geht die überschüssige Zusammensetzung proportional verloren. Kapazitäten: Becherglas 250 g, Schale 180 g, Scheidetrichter 120 g. Dies sind vereinfachte Kapazitätsgrenzen, keine exakten Volumenberechnungen.
- **Scheiden:** Nach dem Absetzen fließt zuerst die untere Wasserphase, dann Öl, mit 2 g/s. Ohne Absetzen werden beide proportional abgeführt. Der Hahn kann jederzeit geschlossen werden; eine selbst gewählte Portionsgrenze schließt zusätzlich automatisch. Zu große Portionen erzeugen Mischfraktionen; fehlende Vorlage erzeugt Verlust. Noch nicht getrennte Gefäßinhalte lassen sich zurück in den Trichter füllen.
- **Eindampfen:** Nur die Abdampfschale wird geheizt. Temperaturanstieg bis 100 °C: 8 × Leistung °C/s. Erst dort verdampfen bis zu 2,5 × Leistung g Wasser/s. Bei abnehmender Wassermenge kristallisiert tatsächlich vorhandenes gelöstes Salz. Verunreinigungen bleiben ebenfalls zurück. Dampf wird in der Bilanz geführt; ohne Salz entstehen keine Salzkristalle. Kalte Gefäße nähern sich mit Zeitkonstante 1000 s wieder 20 °C.
- **Extraktion:** Pro Schritt wird gebundener Farbstoff in gelösten umgewandelt: Rate = gebundene Menge × [0,002 + (T − 20) × 0,0012] / s, beim Rühren verdoppelt. Temperatur beim Mischen als massengewichteter Mittelwert, vereinfachte gleiche Wärmekapazitäten. Kalte Extraktion ist langsamer, aber möglich; Zeitraffer vermeidet langes Warten. Farbstoff bleibt nach dem Filtrieren im Wasser. Der Tee ist ein Stoffgemisch; pH-Effekte und Farbstoffabbau werden nicht modelliert.

**Erfolg:** Mindestens 80 % jedes Zielstoffs müssen in einer eigenen, ausreichend reinen Fraktion liegen. Fremdstoffe unter 0,4 g; Wasser wird bei Sand und Eisen als anhaftende Feuchte zugelassen. Festes Salz muss dagegen praktisch wasserfrei und sandfrei sein. K-05: mindestens 20 g Wasser mit 0,35 g gelöstem Farbstoff, unter 0,1 g Pflanzenresten/gebundenem Farbstoff sowie mindestens 3,2 g getrennte Pflanzenmatrix. Die Anzeige nennt erst dann das Trennziel erreicht. Ein gleicher Gesamtstoffbestand allein zählt nicht als Trennung.

## Chromatographie: explizites Modelldatenset

100 mm Papierhöhe; Startlinie standardmäßig 15 mm, Laufmittelspiegel 5 mm. Breites Papier: bis zu drei nebeneinander liegende Proben, schmales Papier: eine. Die Proben teilen sich dieselben definierten Farbstoffe Blau/Gelb/Rot; gemeinsame Komponenten haben bei gleichem Laufmittel dieselbe Laufstrecke. Das allein ist bei realen unbekannten Stoffen kein eindeutiger Identitätsnachweis.

| Modellprobe | Komponenten |
| --- | --- |
| Schwarz wasserlöslich | Gelb, Rot, Blau |
| Grün wasserlöslich | Gelb, Blau |
| Violett wasserlöslich | Rot, Blau |
| Orange wasserlöslich | Gelb, Rot |
| Referenz Blau | ausschließlich Blau |
| Referenz Gelb | ausschließlich Gelb |
| Schwarz wasserfest | ein eigener Schwarzanteil |

| Relative Stoffstrecke / Laufmittelstrecke | Wasser | Ethanol/Wasser 60:40 (Volumen) |
| --- | --- | --- |
| Blau | 0,42 | 0,65 |
| Gelb | 0,78 | 0,85 |
| Rot | 0,60 | 0,48 |
| Wasserfester Schwarzanteil | 0,00 | 0,30 |

Diese Werte sind **virtuelle Retentionsparameter**, keine Literatur-Rf-Werte. Sie stehen für die kombinierte Wirkung von Löslichkeit und Bindung an die stationäre Phase. Die Ethanolmischung ist ausdrücklich ein anderes Laufmittel; beispielsweise verändern Rot und Blau ihre relative Reihenfolge. Der Wasserfestanteil ist in Wasser im Modell unlöslich und bleibt an der Startlinie, in der Ethanolmischung wandert er.

Die kapillare Front folgt `h(t) = min(100, sqrt(h0² + 90 × k × t))` mm, k = 1 für Wasser, 1,1 für die Ethanolmischung. Eine Zone liegt bei `Startlinie + Rf × max(0, Front − Startlinie)`. Die Zone bewegt sich erst, wenn die Front die Startlinie passiert hat. Punktmenge 1…5 verbreitert die Banden kontinuierlich (Halbhöhe 2 + 1,6 × Menge; ab großer Menge zusätzlich unscharf). Ein Kugelschreiber fügt eine rote Störspur mit relativem Weg 0,55 hinzu. Untergetauchte Punkte werden in die Kammer ausgewaschen; keine erfundene saubere Auftrennung. Ein kurzer Lauf bleibt unvollständig. Am oberen Rand bleibt die Bandenbeobachtung erhalten, die Front wird unbestimmbar.

Das Schulmodell nennt Papier die stationäre Phase und erläutert Adsorption/Anlagerung. Reale Papierchromatographie enthält auch Verteilung an im Papier gebundenem Wasser; das wird bewusst nicht zu einem molekularen Detailmodell erweitert. **Adsorption**, nicht Absorption. Eine Zone beweist bei unbekannten Proben keine Reinheit. Die Referenzen sind im Datensatz definierte Einkomponentenproben.

Expertenmodus: Rf = Stoffweg ab Startlinie / markierter Laufmittelweg ab Startlinie. Ohne gültige markierte Front, bei Randüberschreitung oder ausgewaschenen Punkten kein Zahlenwert. Im Standardmodus ist keine Rf-Berechnung erforderlich. Vergleichschromatogramme sind unabhängige Kopien bereits beobachteter Ansätze.

## Ethanol/Wasser-Destillation

Keine Salzwasser- oder Farbstoffdestillation. Die Massebilanz führt beide Komponenten getrennt in Kolben, Destillat, Dampfverlust, entnommener Probe und verwendeter Brennprobe. Bei der Brennprobe wird nur der qualitative Ausgang modelliert, kein stöchiometrisches Verbrennungsprodukt; der Bilanzposten heißt deshalb „verwendete Probe“.

Für den Ethanolmassenanteil x im Kolben:

- Didaktische Siedekurve `T = 100 − 22 × sqrt(x)` °C. Sie liefert stetige Übergänge zwischen den gerundeten Reinstoffwerten 100 und 78 °C. Bei x = 0,30 beginnt Sieden bei etwa 88 °C. **Die Gemischkurve ist keine reale VLE-Kurve.**
- Der Dampf hat den vereinfachten Anteil `y = 4x / (1 + 3x)` (relative Flüchtigkeit 4). Diese empirische Unterrichtsregel wird hier auf Massenanteile angewandt; keine quantitative Raoult-/Dalton-Rechnung. Sie sichert im Modell y > x für 0 < x < 1.
- Vor dem Sieden steigt die Kolbentemperatur mit `(10 × Heizleistung − 0,3) × 100 / Kolbenmasse` °C/s bis zur jeweils aktuellen Siedetemperatur. Kleinere Ansätze werden schneller warm. Die vereinfachte Heizregel ersetzt eine detaillierte Wärmekapazitäts-/Leistungsrechnung.
- Erst bei Erreichen der Siedekurve verdampfen `1,8 × max(0, Leistung − 0,12)` g/s, ohne Siedesteine Faktor 0,55 (unruhiger, ineffizienterer Betrieb). Wärmeverluste sind als feste Leistungsschwelle enthalten. Der Stoffabzug ändert x und damit Temperatur und Dampfzusammensetzung.
- Thermometer im Dampfweg nähert sich bei Dampftransport der Siedetemperatur mit Faktor 2/s; ohne Dampf nähert es sich 20 °C (0,08/s, ohne Heizung 0,1/s). Ein Thermometer in der Flüssigkeit zeigt ausdrücklich Kolbentemperatur und zählt nicht als gültige Dampfmessung.
- Kondensationsgrad bei richtiger Richtung = Durchflussanteil 0…1. Bei umgekehrter Richtung nur 20 % davon; ohne Wasser 0. Fehlende Vorlage sammelt nichts. Nicht aufgefangenes Material geht in den expliziten virtuellen Dampfverlust. Die vereinfachte Kühlregel vermittelt den Zusammenhang, keine exakte Kühlleistung.
- Unter 5 g Rest wird die Heizung gestoppt; Überheizen bei Leistung >85 %, fehlende Halterungen/Verbindungen sowie geschlossene Apparatur führen sofort zum Sicherheitsstopp. Auch eine bereits heiße Apparatur darf bei ausgeschalteter Heizung nicht verschlossen werden. Nach Korrektur kann mit verbleibendem Ansatz weitergearbeitet werden. Siedesteine ab >40 °C werden abgefangen.
- Die Entnahme überträgt **1 g** proportional aus dem tatsächlichen Destillat in die getrennte Schale. Ab 45 Massen-% Ethanol besteht im virtuellen Modell die Brennprobe; darunter keine anhaltende Flamme. Diese Grenze ist ein didaktischer Parameter, keine allgemeingültige Brennbarkeitsgrenze realer Gemische. Temperatur und Zündbedingungen sind real ebenfalls entscheidend. Verwendete Probe wird separat bilanziert. Eine Zündung am Destillationsaufbau wird immer unterbrochen.

Erfolg: mindestens 3 g gesammeltes Destillat mit Ethanolanteil >31 %, korrektes Thermometer, richtige Kühlrichtung mit mindestens 50 % Durchfluss, erfolgreiche getrennte Brennprobe, kein offener Sicherheitsstopp. Dazu müssen Beobachtung, aktuelle Dampftemperatur (±2 °C) und Fachbegriffe richtig ausgewertet werden. Kein Reinheitsnachweis durch Flamme. Azeotropie, Volumenkontraktion, nichtideales VLE und Trennkolonnen sind bewusst außerhalb des Modells. Es darf nicht zur Vorhersage realer Ausbeuten oder Alkoholgehalte verwendet werden.

## Quellen und Einordnung

Abgerufen am 22.10.2026. Die Anwendung selbst lädt keine Quellen oder Daten nach.

- [Royal Society of Chemistry: Sand und Salz durch Filtration und Eindampfen trennen](https://edu.rsc.org/experiments/separating-sand-and-salt-by-filtering-and-evaporation/386.article): lösliches Salz/insolubler Sand, Filtrat und Eindampfen.
- [RSC: Paper chromatography, practical videos 14–16](https://edu.rsc.org/mixtures-and-separation/paper-chromatography-practical-videos-14-16-years/4018537.article): Bleistiftlinie, Probenplätze, Laufmittelfront; [Begleitmaterial](https://edu.rsc.org/download?ac=531296) zu Fehlern durch Kugelschreiber und zu langes Entwickeln.
- [RSC: Chromatography](https://edu.rsc.org/resources/chromatography/11333.article), [Unterrichtsressource zur Verteilungschromatographie](https://edu.rsc.org/download?ac=12451): Einordnung des vereinfachten Papier-/Adsorptionsmodells und seiner Grenzen.
- [RSC: Teaching distillation’s apparatus and stages](https://edu.rsc.org/mixtures-and-separation/teaching-distillations-apparatus-and-stages/4022439.article): Dampftemperaturmessung, Kühlkondensation und ethanolreicheres Destillat.
- [NIST Chemistry WebBook: Ethanol, Normal boiling point](https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Type=TBOIL): Messwerte um 351,44 K, also etwa 78,3 °C. Im Lerntext gerundet 78 °C.

Die beschleunigten Geschwindigkeiten, Verluste, Reinheitsgrenzen, Retentionswerte und Gemisch-/Brennmodelle sind eigene, in den Tests reproduzierte didaktische Festlegungen. Aus den Quellen werden keine realen Markenparameter oder exakten Gemischkurven abgeleitet.
