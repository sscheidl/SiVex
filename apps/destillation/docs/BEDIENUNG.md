# Destillation – Bedienung

## Aufbau der Oberfläche

| Bereich | Inhalt |
| --- | --- |
| Kopfzeile | Zeitraffer (❚❚ Pause, 1×, 10×, 30×; Start immer mit 1×), Versuchszeit (steht ■, sobald der Versuch beendet ist; läuft beim erneuten Heizen weiter), **Neu beginnen**, Expertenmodus, Hefteintrag, Bedienfeld ein/aus |
| Leiste über der Bühne | links im Erklärmodus der Hinweis „Dampfteilchen (in Wirklichkeit unsichtbar)“ mit Farblegende; Ansicht: Erkunden und Namen (nur vor dem Versuch, beim Start aus), Kühler, Teilchen, Diagramm; danach die Füllmenge „Vorlage n: x,x mL“ |
| Laborbühne | fertig montierte Apparatur; links Prüfplatz, Flasche mit dem Gemisch und Siedesteine; alle Geräte sind antippbar (unsichtbare, mit Tab erreichbare Schaltflächen); Meldungen erscheinen oben in einem festen Band oberhalb der Apparatur |
| Fußleiste (alle Bedienelemente, eine Zeile; auf schmalen Bühnen umgebrochen) | Einfüllen, Siedesteine, Thermometer ▲/▼, Vorlage (abnehmen/unterstellen), (Experte) Vorlage wechseln, **Heizung EIN/AUS** + Heizstufe niedrig/mittel/hoch, **Kühlwasser EIN/AUS** + Durchfluss gering/mittel/stark – Heizung und Kühlwasser unabhängig voneinander |
| Trennlinie | Breite des Bedienfelds mit Maus, Finger (44 px Griff) oder Pfeiltasten; Doppelklick oder Pos1 setzt zurück |
| Bedienfeld | Reiter Aufgabe · Ergebnisse · Trainer · Hefteintrag |

Unter 900 px Breite stehen Bühne und Bedienfeld untereinander, die Trennlinie ist ausgeblendet.

## Ein Versuch Schritt für Schritt (Standard 1)

Die Reihenfolge ist frei, soweit sie physikalisch und sicherheitstechnisch vertretbar ist. Fehler zeigen Folgen.

1. **Gemisch einfüllen:** Flasche antippen oder „Einfüllen“. Trichter und Becherglas erscheinen, der Spiegel im Kolben steigt.
2. **Siedesteine:** Schälchen antippen oder „Siedesteine“ (nur solange die Flüssigkeit im Kolben höchstens 50 °C hat; die Meldung nennt sonst ihre Temperatur).
3. **Thermometer prüfen:** Es sitzt am Anfang zu hoch. Mit „Thermometer ▼“ die Kugel auf Höhe des seitlichen Abgangs schieben (nur bei ausgeschalteter Heizung und ohne Sieden).
4. **Kühlwasser anschließen:** freies Schlauchende an der Laborarmatur (Zulauf, hängt ins Becken) antippen, dann einen Anschluss am Kühler; ebenso das Ende am Ausguss (Ablauf). Ein angeschlossener Stutzen wird durch erneutes Antippen wieder frei (nur bei abgedrehtem Wasser).
5. **Kühlwasser EIN**, Durchfluss wählen. Das Wasser füllt den Mantel sichtbar von unten nach oben.
6. **Heizung EIN**, Heizstufe wählen (mittel). Zeitraffer 10× oder 30×.
7. **Beobachten:** Siedeblasen, Thermometer und Digitalanzeige, Kondensat im Innenrohr, Tropfen in die Vorlage.
8. **Heizung AUS**, sobald die Temperatur über den Abschnitt steigt (die App warnt vorher, bevor Wasser übergeht).
9. **Brennprobe** (nur Ethanol/Wasser): „Vorlage“ antippen (abnehmen) – sie kommt zum Prüfplatz. Pipette antippen → Vorlage antippen (Probe wird gezogen) → Porzellanschale antippen (Probe wird überführt) → Stabfeuerzeug antippen → Schale antippen (Feuerzeug fährt hin, Funke, Flamme). Danach Vorlage antippen, um sie zurückzustellen; Kühlwasser AUS.
10. **Auswertung:** „Ergebnis prüfen“, Protokoll ausfüllen, „Antworten prüfen“; Tipps 1/3–3/3; „Lösung anzeigen“.

## Weitere Bedienelemente

- **Vorlage** (abnehmen bzw. unterstellen) oder Antippen der Vorlage (hin und zurück); im Expertenmodus zusätzlich **Vorlage wechseln** (alte Vorlage wandert auf den Tisch und bleibt erhalten).
- **Einfüllen** nach dem Leerdestillieren: Ist der Kolben fast leer (< 15 mL), wird „Einfüllen“ nach dem Abkühlen wieder frei; der Versuch läuft weiter.
- **Neu beginnen** (Kopfzeile, mit Rückfrage): Apparatur in den Startzustand, frühere Vorlagen bleiben unter „Ergebnisse“.
- **Namen:** Beschriftung aller Geräte. **Erkunden:** Gerät antippen → Hervorhebung, Name und Funktion. Beides nur vor dem Versuch; solange sind alle Handgriffe gesperrt und es erscheinen keine Meldungen. **Kühler:** vergrößerter Schnitt durch den Liebigkühler (gleicher Modellzustand). **Teilchen:** Erklärmodus mit Dampfteilchen, ausdrücklich gekennzeichnet (Dampf ist in Wirklichkeit unsichtbar). **Diagramm:** Temperatur-Zeit-Diagramm (in allen Modi); Antippen zeigt es bildschirmfüllend über der Bühne, erneutes Antippen oder Escape verkleinert es wieder. Im Erklärmodus sind die Teilchen nach Stoffen gefärbt (Ethanol rot, Wasser blau, Propanon grün).
- **Trainer:** Nummern an der Apparatur benennen, Funktionen zuordnen, Kurztheorie.

## Tastatur

Tab erreicht alle Schaltflächen und die Geräte auf der Bühne (Fokusrahmen sichtbar), Enter/Leertaste löst aus. Trennlinie: Pfeiltasten ± 24 px, Pos1 = Standardbreite.

## Für Lehrkräfte

- Start: `index.html` (Webserver oder `file://`) bzw. SCORM-Paket in mebis („Lernpaket anzeigen: Neues Fenster“ empfohlen, siehe `docs/MEBIS.md`).
- Keine Datenübertragung an das LMS; Sitzungsstand nur in `sessionStorage` des Browsers.
- Ein vollständiger Versuch dauert bei 30× etwa 1–2 Minuten, der Expertenversuch 2–3 Minuten.
