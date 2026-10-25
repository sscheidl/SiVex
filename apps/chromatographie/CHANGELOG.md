# Changelog – Papierchromatographie

## 0.2.0 – 25.10.2026

Überarbeitung nach der Durchsicht (acht Befunde), Gestaltung unverändert.

- **Auswertung:** Geänderte Protokollantworten und Rf-Eingaben gelten sofort als ungeprüft; „Alles richtig ausgewertet!“ bzw. „Richtig gemessen und berechnet“ verschwinden, unveränderte Felder behalten ihre Bewertung (auch nach Tabwechsel und Neuladen).
- **Musterlösung ohne eigenes Papier:** kein Laufzeitfehler mehr beim Bearbeiten des Begriffsfelds, Expertenmodus, Tabwechsel oder Neuladen.
- **Startlinie nachträglich gezogen:** Beim Einhängen werden die tatsächlichen Punktpositionen geprüft; Meldung „Die Probenpunkte liegen nicht auf einer gemeinsamen Startlinie …“; das Papier liefert keinen Aufgabennachweis, eigene Hilfe dazu.
- **Bezugspapier:** Ausgewertet wird das neueste passende Papier (Aufgabe C: je das neueste mit Wasser und mit Ethanol-Wasser); die ausgewerteten Papiere werden genannt und als Miniatur verlinkt; bei neuem Bezugspapier wird die alte Bewertung nicht übernommen; Verweise auf aus dem Archiv gefallene Papiere werden erkannt.
- **Farblogik:** Schwarz besteht jetzt aus Gelb, Rot und Blau (vorher eigener violetter Farbstoff); Texte sprechen vom Trennen der vorhandenen Farbstoffe; Dokumentation der Zonenzahlen in Ethanol-Wasser nach Laufstrecke und Farbmenge.
- **Meldungen** stehen in einem festen Band oberhalb von Kammer und Geräten.
- **Stifte** werden nach „Neues Papier“ und „Papier einhängen“ automatisch zurückgestellt und verschlossen.
- **Eingießen** mit dezenten Oberflächenwellen und Ringwelle, die danach abklingen.

## 0.1.0 – 24.10.2026

Erste Fassung als eigenständige App nach dem Entwicklungsauftrag für die Papierchromatographie.

- Fachmodell aus Trennlabor 1.0.0 (Fassung B), Zusammensetzung Schwarz aus Fassung A, Ethanol-Wasser 1 : 1, neue Rf-Werte in Ethanol-Wasser (`docs/CHEMIE.md`)
- Neue Laborbühne: große Entwicklungskammer mit Glas, Laufmittelspiegel und Meniskus nach TitraLab 3, Papier mit Startlinie, Proben, Front und wandernden Zonen; Arbeitsfläche mit Bleistift und Stifteständer (sieben große Filzstifte), Laufmittelflaschen
- Bedienung durch Antippen: Stift wählen → Punkt antippen, Flasche antippen (Portionen), Kammer antippen (einhängen/herausnehmen); Handlungsleiste, Tastatur, Trefferflächen ≥ 44 px
- Startlinie fest (Bleistift, 2 cm), keine Höhen- oder Werkzeugwahl
- Aufgaben A–C und freies Labor; Ergebnisprüfung am Chromatogramm; drei Tipps; Protokoll mit Rückmeldung je Feld; Musterlösung auf Anforderung; Ergebnisübersicht; Hefteintrag; Expertenmodus mit Frontmarkierung, Lineal und Rf
- Verschiebbare Trennlinie, kompakte Anordnung für Tablets, Zeitraffer 1×/10×/30×
- Gemeinsamer Baukasten `shared/labkit` 0.1.1 (Grundstil, Trennlinie, Zeitschritte, Begriffsprüfung, SCORM) mit `DESIGN.md`
- Web-ZIP und SCORM-1.2-ZIP mit Prüfsummen; Unit-, Browser- und Paketprüfungen
