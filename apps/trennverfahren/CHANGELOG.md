# Änderungen – Trennverfahren

## 0.2.0 – 29.10.2026 (prototype)

Korrektur- und Erweiterungsauftrag nach der gemeinsamen Durchsicht vom 29.10.2026.

**Behobene Fehler (P0)**
- Hinweisbereich wächst mit dem Inhalt: Neustartbestätigung mit vollem Text und beiden Knöpfen, lange Meldungen ohne Abschneiden.
- Gießstrahl, Spritzer und Tropfen enden am tatsächlichen Spiegel bzw. Innenboden des Zielgefäßes und treffen innerhalb der Öffnung; nichts läuft mehr durch Glas, Boden oder Tisch.
- Spritzflasche: Der Wasserstrahl war wegen eines Koordinatenfehlers nie sichtbar. Jetzt sichtbar von der Düse bis in die Öffnung (auch bei leeren Gefäßen und beim Filter); Wasser fließt genau in der Strahlphase.
- Versuch 4: Schütteln ist kein Abschlusskriterium mehr. Sauber getrennte Fraktionen sind ein voller Erfolg.
- Trennprinzipien fachlich eindeutig: „Dichte“ statt „der schwerere Stoff“, Löslichkeit ausdrücklich für Feststoffe, Nichtmischbarkeit eigens; Unlöslichkeit als Voraussetzung (V1, V2) und das Löslichkeitskreuz bei V4 gelten nicht als Fehler, sondern werden erläutert.

**Neue Handgriffe und Bedienung (P1)**
- V2: Filterpapier mit (feuchtem) Rückstand auf ein Uhrglas legen; Erfolg bleibt erhalten.
- V3: Kristalle nach dem Abkühlen (unter 45 °C) mit dem Spatel auf ein Uhrglas überführen.
- V4: Stopfen als eigenes Objekt auf der Ablage (sichtbare Bewegung), Hahn direkt am Scheidetrichter (Maus, Touch, Tastatur: zu → Tropfen → offen), Schütteln nur außerhalb des Rings in der Hand mit Stopfen und geschlossenem Hahn, Rückgießen aus jedem Becherglas mit verständlicher Begründung bei offenem Hahn.
- Protokoll: Speichern nach beiden Textfeldern; Zwischenstand enthält Beobachtung und Erklärung; Freitexte sind ausdrücklich unbewertet; Musterbeobachtung zum Selbstvergleich nach erreichtem Trennziel; Beobachtungsfragen ohne vorweggenommene Antworten.
- Laborfläche: Wandablage für Werkzeuge, engere Aufbauten (größere Geräte), etwas dunklerer Hintergrund, deutlicherer Dampf; Teilchenmodell auch auf Tablets seitlich statt darunter.
- „Dampf“ fachlich korrekt: Wasserdampf ist unsichtbar, die weiße Wolke sind kondensierte Tröpfchen.
- V3: Vergleichsbilder im Teilchenmodell – reines Wasser, festes Kochsalz (Ionengitter), Kochsalzlösung.

**Zurückgestellt (P2):** Kochsalz mit dem Löffel selbst dosieren (V3) – nicht umgesetzt.

## 0.1.0 – 27.10.2026 (prototype)

Erste lauffähige Fassung nach dem [Build-Auftrag „klassisches Trennlabor“](../../prompts/trennlabor-klassik-build-claude.md) und der [Trennlabor-Planung](../../docs/TRENNLABOR-PLANUNG.md).

- Fünf Versuche mit selbstständiger Bedienung: Dekantieren, Filtrieren, Eindampfen, Scheiden, Trennkette Eisen/Sand/Kochsalz.
- Bilanztreues Fachmodell mit Absetzfront, Löslichkeitsgrenze, Filterrückhalt und Restfeuchte, Emulsion/Entmischung, Scheidetrichter mit Stopfen und Hahn, Magnet, Heizplatte mit Trägheit.
- Laborgrafik in Canvas 2D: Glasgefäße mit Meniskus und Glanz, waagrechter Spiegel beim Kippen, Strahl vom Ausguss, Tropfen, gedämpfte Wellen und Ringwellen (nach TitraLab 3), sichtbare Sedimentation, Kristallbildung, Dunst.
- Zuschaltbares, zustandsabhängiges Teilchenmodell in eigenem Bereich; Schalter für Gerätenamen; Hinweisbereich oberhalb der Laborfläche.
- Protokoll mit freier Beobachtung und Zwischenständen, Einordnung, Trennprinzip; Kontrolle (10 MC + Lückentext mit 10 Begriffen); Hefteintrag nach abgeschlossenem Lernablauf.
- Web- und SCORM-1.2-Paket, Labkit 0.1.1.

Historischer Code des Trennlabors 1.0.0 wurde nur gesichtet (Fachmodell der Fassung B, Tag `archiv/trennlabor-1.0.0`) und nicht übernommen; Fachmodell, Grafik und Oberfläche sind neu. Übernommen wurden Build-, Paket- und Testgerüst (über die Destillation, ursprünglich Fassung B) sowie der gemeinsame Baukasten `shared/labkit`.
