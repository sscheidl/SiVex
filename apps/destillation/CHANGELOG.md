# Changelog – Destillation

## 0.4.0 – 30.10.2026

Anpassung an die [iPad- und Bedienregeln](../../docs/QUALITY.md#ipad--und-bedienregeln-für-alle-apps) nach dem Unterrichtseinsatz der SiVex-Apps; Labkit 0.2.0.

- **Pause blockiert nicht mehr:** Ein in der Pause gestarteter Handgriff (Einfüllen, Siedesteine, Pipette, Feuerzeug) stand still, und alles Weitere wurde mit „Einen Moment – der letzte Handgriff ist noch nicht fertig“ abgewiesen. Jetzt beendet ein Handgriff die Pause (1×, mit Hinweis); tippt man während eines stillstehenden Handgriffs etwas an, läuft die Zeit wieder und der Handgriff zu Ende. Gemischwechsel und Neustart beginnen in Echtzeit.
- **Volle Vorlage läuft über:** Die Vorlage nimmt höchstens 120 mL auf; der Rest tropft wie bisher auf den Tisch, jetzt aber mit eigener Warnung („Die Vorlage ist voll und läuft über …“) statt der irreführenden Meldung „keine Vorlage“, und als Pfütze neben der Hebebühne sichtbar (auch beim Tropfen ohne Vorlage).
- **Eingaben gehen nicht verloren:** Endet ein Handgriff oder greift der Sicherheitsstopp, wird das Bedienfeld neu aufgebaut. Noch nicht bestätigte Eingaben werden vorher übernommen, Fokus und Schreibmarke zurückgegeben; Auswahllisten (Geräte benennen) nur nach Tastaturbedienung.

## 0.3.2 – 29.10.2026

Korrekturen nach Rückmeldung zu 0.3.1 und Brennprobe im Propanon-Versuch.

- Brennprobe auch in Aufgabe 2 (Propanon/Wasser): Prüfplatz mit Pipette, Porzellanschale und Stabfeuerzeug; Propanon brennt mit gelblicher, leuchtender Flamme (Ethanol bläulich). Aufgabe, Sicherheitshinweis, Auswertung, Protokollfrage 7 und Lösung ergänzt; Ethanol und Propanon verbrennen anteilig. Das Dreistoffgemisch bleibt ohne Brennprobe.
- Temperatureinbruch zwischen zwei Fraktionen flacher (Propanon/Wasser ≈ 11 K statt 26 K): Der schon mit Dampf gefüllte Aufsatz wird von der sich erwärmenden Restflüssigkeit warm gehalten. Vor dem ersten Sieden bleibt das Thermometer kalt.
- Nach „Neu beginnen“ blieben unter Umständen Siedeblasen im leeren Kolben stehen; Blasen, Tropfen, Spritzer und Wellen gehören jetzt zum jeweiligen Versuch.
- Spritzer beim Auftreffen der Tropfen fallen auf den Spiegel zurück und bleiben zwischen den Wänden. Vorher flogen sie eine feste Zeit weiter und erschienen bei wenig Inhalt als helle Punkte unter dem Erlenmeyerkolben auf dem Laborboy.
- Erklärmodus: Dampfteilchen oben im Rundkolben bleiben innerhalb der Kugel (dort ist sie schmaler).

## 0.3.1 – 29.10.2026

Fehlerbehebung (Korrekturauftrag „Flüssigkeitsanimation und Gefäßkollisionen“), keine neuen Funktionen. Ursachen und Nachweise im Abschnitt „Korrektur 0.3.1“ von `docs/TESTBERICHT.md`.

- Einfüllen: Der Strahl beginnt an der Ausgusskante des Becherglases, nicht in seiner Mitte. Die Kante wird aus Lage und Neigung berechnet; der Strahl fällt als Wurfparabel in den Trichter. Im Glas bleibt der Spiegel waagrecht, die Menge folgt dem Modell, und das Glas wird beim Leeren weiter geneigt – es fließt erst, wenn der Spiegel die Kante erreicht.
- Tropfen in die Vorlage enden an ihrem Spiegel bzw. Boden in der gezeichneten Lage, auch während sie abgenommen, zurückgestellt oder gewechselt wird; Wand und Boden sind undurchlässig, neben der Vorlage fallen sie auf den Laborboy.
- Volle Vorlage (120 mL bis zum Rand): Der Spiegel steigt bis in den Hals, weitere Tropfen laufen über die Öffnung ab (Tisch) – die Bilanz bleibt geschlossen.

## 0.3.0 – 25.10.2026

Überarbeitung nach der zweiten Durchsicht der Lehrkraft (17 Befunde; Ursachen und Regressionstests in `docs/TESTBERICHT.md`). Die Gestaltung bleibt erhalten.

- Start mit 1×; „Namen“ beim Start (auch nach Neuladen) aus und nach „Erkunden“
- Erklärmodus-Hinweis oben in der Leiste statt auf der Bühne, mit Farblegende; Dampfteilchen nach der Dampfzusammensetzung des Modells gefärbt (Ethanol rot, Wasser blau, Propanon grün) – nach dem Ethanol nur noch Wasser
- Füllmenge „Vorlage n: x,x mL“ in der Leiste nach „Diagramm“; Skala am Erlenmeyer ohne „mL“
- Kühler-Detail und Diagramm-Einblendung länger; keine Beschriftung ragt mehr über den Rand
- Diagramm antippen: bildschirmfüllend, erneut antippen oder Escape: klein
- Siedesteine: maßgeblich ist die Flüssigkeit im Kolben; die Meldung nennt ihre Temperatur (die Anzeige oben misst nur den Dampf)
- Leer destillierter Kolben kann nach dem Abkühlen neu befüllt werden
- Stopfen und Sicherheitsstopp „geschlossene Apparatur“ entfallen: Der Vorstoß hat eine Belüftung (Entscheidung in `docs/CHEMIE.md`)
- Flasche mit dem Gemisch und Siedesteine links bei den Materialien; Szene schmaler, Apparatur knapp 7 % größer
- Nach dem Abkühlen keine Blasen mehr (geglättete Siedewerte klingen auf genau 0 ab)
- Versuchszeit hält nach dem Ende des Versuchs an (Uhr und Diagramm), läuft beim erneuten Heizen weiter
- Ergebnisse: farbige Hinweise ohne Hintergrund
- Bedienknöpfe in einer Zeile (bei 1440 × 900; schmale Bühnen brechen um), Knopf „Vorlage“; Meldungen in einem festen Band oberhalb der Apparatur, lange Meldungen kleiner gesetzt

## 0.2.0 – 25.10.2026

Überarbeitung nach der ersten Durchsicht der Lehrkraft (siehe `docs/reviews/trennlabor-eindruecke-lehrkraft.md`).

- Kolben im Verhältnis zum Kühler etwa 20 % größer; Klemmen weggelassen, Schliffklemme am Hals richtig gedreht
- Laborarmatur am Ausguss; Zulaufschlauch liegt hinter der Vorlage auf dem Tisch
- Vorlage: Abnehmen stellt sie in gleicher Größe zum Prüfplatz (bzw. neben den Aufbau), Antippen stellt hin und zurück; saubere Skala; grauer Stopfen/Balken entfernt
- Probenahme nur aus der abgenommenen Vorlage; Pipette, Überführen und Anzünden als Bewegungsabläufe (Handgriffe im Modell mit festem Wirkzeitpunkt)
- Tropfen nach TitraLab 3: Fall mit Schwerkraft, Ringwellen, Spritzer, Strahl im Zeitraffer
- Keine orange Fläche mehr hinter dem Kolben
- Warnung, bevor nach dem Destillat der nächste Stoff (Wasser) übergeht
- „Namen“ und „Erkunden“ nur vor dem Versuch, dann ohne Handgriffe und Meldungen; Gemisch, Siedesteine, Armatur, Ausguss und Prüfplatz-Geräte erkundbar
- Meldungen oben in einem freien Band; Temperaturanzeige links neben dem Thermometer über dem Aufsatz
- Alle Bedienelemente unten; „Neu beginnen“ in der Kopfzeile; Temperatur-Zeit-Diagramm in allen Modi

## 0.1.0 – 25.10.2026

Erste Fassung als eigenständige App (Entwicklungsauftrag „SiVex – Destillationslabor“ vom 24.10.2026).

- Fertig montierte, maßstäblich plausible Apparatur aus gemeinsamen geometrischen Ankern (`js/geometry.js`); Verbindungen als Unit- und Browsertest
- Fachmodell mit Heizpilz-Wärmekapazität, idealisiertem Trennmodell für drei Gemische (Propanon 56 °C, Ethanol 78 °C, Wasser 100 °C), Aufsatz-Rücklauf, Kühlmantel mit Füllung/Wassertemperatur/Durchfluss, Kondensatfilm und Tropfen, exakte Stoffbilanz
- Heizung und Kühlwasser unabhängig EIN/AUS und regelbar; Thermometerlage mit Wirkung auf den Messwert; Brennprobe am getrennten Prüfplatz
- Fehlerfälle und Sicherheitsstopps mit Wiederanlauf nach Behebung
- Glas, Meniskus und Tropfen nach TitraLab 3; Siedeblasen, Kühlwasserströmung, Kühler-Detailansicht, Teilchen-Erklärmodus, Temperatur-Zeit-Diagramm (Experte)
- Aufgaben 1–3, Protokoll gegen eigene Messwerte, Tipps 1/3–3/3, Lösung mit Rückfrage, Ergebnisübersicht, Geräte-Trainer (12 Teile, Funktionen), Hefteintrag
- Web-ZIP und SCORM-1.2-ZIP mit Prüfsummen; Unit-, Browser- und Paketprüfungen
