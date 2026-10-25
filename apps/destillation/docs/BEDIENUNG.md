# Destillation – Bedienung

## Aufbau der Oberfläche

| Bereich | Inhalt |
| --- | --- |
| Kopfzeile | Zeitraffer (❚❚ Pause, 1×, 10×, 30×), Versuchszeit, Expertenmodus, Hefteintrag, Bedienfeld ein/aus |
| Handlungsleiste | links die gerade sinnvollen Handlungen (Einfüllen, Siedesteine, Thermometer ▲/▼, Vorlage weg/hin bzw. Vorlage wechseln); rechts „Ansicht“: Namen, Erkunden, Kühler, Teilchen, Diagramm (Experte) |
| Laborbühne | fertig montierte Apparatur; alle Geräte sind antippbar (unsichtbare, mit Tab erreichbare Schaltflächen) |
| Schalterleiste unten | **Heizung EIN/AUS** + Heizstufe niedrig/mittel/hoch; **Kühlwasser EIN/AUS** + Durchfluss gering/mittel/stark – unabhängig voneinander, immer sichtbar |
| Trennlinie | Breite des Bedienfelds mit Maus, Finger (44 px Griff) oder Pfeiltasten; Doppelklick oder Pos1 setzt zurück |
| Bedienfeld | Reiter Aufgabe · Ergebnisse · Trainer · Hefteintrag |

Unter 900 px Breite stehen Bühne und Bedienfeld untereinander, die Trennlinie ist ausgeblendet.

## Ein Versuch Schritt für Schritt (Standard 1)

Die Reihenfolge ist frei, soweit sie physikalisch und sicherheitstechnisch vertretbar ist. Fehler zeigen Folgen.

1. **Gemisch einfüllen:** Flasche antippen oder „Einfüllen“. Trichter und Becherglas erscheinen, der Spiegel im Kolben steigt.
2. **Siedesteine:** Schälchen antippen oder „Siedesteine“ (nur unter 50 °C).
3. **Thermometer prüfen:** Es sitzt am Anfang zu hoch. Mit „Thermometer ▼“ die Kugel auf Höhe des seitlichen Abgangs schieben (nur bei ausgeschalteter Heizung und ohne Sieden).
4. **Kühlwasser anschließen:** freies Schlauchende am Wasserhahn (Zulauf) antippen, dann einen Anschluss am Kühler; ebenso das Ende am Ausguss (Ablauf). Ein angeschlossener Stutzen wird durch erneutes Antippen wieder frei (nur bei abgedrehtem Wasser).
5. **Kühlwasser EIN**, Durchfluss wählen. Das Wasser füllt den Mantel sichtbar von unten nach oben.
6. **Heizung EIN**, Heizstufe wählen (mittel). Zeitraffer 10× oder 30×.
7. **Beobachten:** Siedeblasen, Thermometer und Digitalanzeige, Kondensat im Innenrohr, Tropfen in die Vorlage.
8. **Brennprobe** (nur Ethanol/Wasser): Pipette antippen → Vorlage antippen → Porzellanschale antippen → Stabfeuerzeug antippen → Schale antippen.
9. **Heizung AUS**, dann Kühlwasser AUS, sobald nichts mehr übergeht.
10. **Auswertung:** „Ergebnis prüfen“, Protokoll ausfüllen, „Antworten prüfen“; Tipps 1/3–3/3; „Lösung anzeigen“.

## Weitere Bedienelemente

- **Vorlage weg/hin** (Standard) bzw. **Vorlage wechseln** (Experte, alte Vorlage wandert auf den Tisch und bleibt erhalten).
- **Stopfen** neben der Vorlage: auf die Vorlage setzen verschließt die Apparatur (Fehlfall, Sicherheitsstopp beim Heizen).
- **Versuch neu beginnen** (Aufgabe): Apparatur in den Startzustand, frühere Vorlagen bleiben unter „Ergebnisse“.
- **Namen:** Beschriftung aller Geräte. **Erkunden:** Gerät antippen → Hervorhebung, Name und Funktion (Handlungen sind solange gesperrt). **Kühler:** vergrößerter Schnitt durch den Liebigkühler (gleicher Modellzustand). **Teilchen:** Erklärmodus mit Dampfteilchen, ausdrücklich gekennzeichnet (Dampf ist in Wirklichkeit unsichtbar). **Diagramm:** Temperatur-Zeit-Diagramm (Experte).
- **Trainer:** Nummern an der Apparatur benennen, Funktionen zuordnen, Kurztheorie.

## Tastatur

Tab erreicht alle Schaltflächen und die Geräte auf der Bühne (Fokusrahmen sichtbar), Enter/Leertaste löst aus. Trennlinie: Pfeiltasten ± 24 px, Pos1 = Standardbreite.

## Für Lehrkräfte

- Start: `index.html` (Webserver oder `file://`) bzw. SCORM-Paket in mebis („Lernpaket anzeigen: Neues Fenster“ empfohlen, siehe `docs/MEBIS.md`).
- Keine Datenübertragung an das LMS; Sitzungsstand nur in `sessionStorage` des Browsers.
- Ein vollständiger Versuch dauert bei 30× etwa 1–2 Minuten, der Expertenversuch 2–3 Minuten.
