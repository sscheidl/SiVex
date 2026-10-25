# Changelog – Destillation

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
