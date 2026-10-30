# Änderungen – Trennverfahren

## 0.3.1 – 30.10.2026 (prototype)

**Behoben (schwerwiegend):** Sackgasse in Versuch 5. Nach dem Magnetscheiden blieb der Magnet gewählt; jedes weitere Antippen – auch von Uhrglas, Becherglas A oder Porzellanschale – wurde als „Magnet durchziehen“ gedeutet und mit „kein Eisen“ abgewiesen. Lag das Gemenge auf dem Uhrglas, kam man nicht weiter.

- Wird ein angetipptes Gefäß als Ziel abgewiesen, wechselt die Auswahl jetzt auf dieses Gefäß; die Begründung bleibt sichtbar. Das gilt für alle Werkzeuge und Gefäße (Glasstab, Spritzflasche, Filterpapier, Spatel, Gießen). Kein Gerät bleibt mehr „hängen“.
- Ein Magnet, an dem Eisen hängt, bleibt bei einem ungeeigneten Ziel gewählt (das Eisen geht nicht verloren); nach erfolgreichem Durchziehen bleibt er wie bisher für weitere Durchgänge gewählt.
- Browserszenario E13 spielt den gemeldeten Ablauf nach (Gemenge auf dem Uhrglas, Eisen in die Porzellanschale, dann Uhrglas → Becherglas A ohne Abwählen des Magneten).

**Geprüft:** auf dem iPad mit Safari (Lehrkraft, 30.10.2026, Stand 0.3.0): sichtbar und bedienbar, Abläufe wie erwartet.

## 0.3.0 – 30.10.2026 (prototype)

Überarbeitung nach der Durchsicht vom 30.10.2026 (Grafik, Teilchenmodell, V3–V5).

**Tropfen und Rinnsal**
- Tropfen aus Trichter und Scheidetrichter sind größer (≈ 0,05 mL, leicht überzeichnet; bei kleinem Maßstab nicht unter etwa 3 Bildschirmpixel Radius) und fallen gestreckt; an der Spitze wächst ein hängender Tropfen und reißt ab.
- Nach der sichtbaren Tropfenzahl geht die Darstellung von einzelnen Tropfen über eine Tropfenkette in ein zusammenhängendes, nach unten schmaler werdendes Rinnsal über (wie in der Destillation): volles Filter und offener Hahn zeigen einen Strahl, wenig Durchfluss und „Tropfen“ einzelne Tropfen. Das Rinnsal endet am Spiegel des Auffanggefäßes und regt dort Wellen an.

**Teilchenmodell**
- Wasserteilchen als **blaue Dreiecke** (wie in „Aggregatzustände“); alle Symbole etwa doppelt so groß; Na⁺ und Cl⁻ mit deutlich lesbarem Ladungszeichen; Legende mit passenden Symbolen.
- Neu aufgebaute Verteilung: Teilchen haben Plätze relativ zu ihrer Phase und bewegen sich ungeordnet darum. Ölteilchen füllen die ganze Ölschicht (vorher nur an der Grenzfläche), reines Öl bildet keine Schichten, Wasser verteilt sich gleichmäßig.
- Schütteln (V4): Öltröpfchen (Ansammlungen von Ölteilchen) in der Wasserphase, ohne Wasser im Innern und ohne Überlappung; in Ruhe steigen sie auf und vereinigen sich zur Schicht – passend zur Entmischung im Scheidetrichter.
- Deutlich mehr Salzteilchen: Lösungen bis 36 Ionenpaare (mit der Flüssigkeitsmenge abnehmend), festes Salz als große Ionengitter (10 Ionen je g).
- Gemenge (V5): Kochsalz als kleine Kristalle zwischen Sand- und Eisenkörnern; Eisen- und Sandkörner proportional zur Masse.
- Magnet: Nur die erfassten Eisenkörner wandern zum Magneten und verlassen mit ihm das Bild; die übrigen bleiben liegen – nichts fällt mehr zurück ins Gemisch.

**Handgriffe**
- V3: Der Spatel überführt die Kristalle in drei Portionen; die Kristallfläche auf dem Uhrglas wächst mit jeder Portion.
- Uhrglas ist keine Sackgasse mehr: Sein Inhalt (auch der Rückstand vom Filterpapier) lässt sich mit dem Spatel in Becherglas, Erlenmeyerkolben, Porzellanschale oder Abdampfschale weitergeben.
- Heizplatten (V3, V5) direkt am Gerät bedienbar: Drehknopf antippen (Maus, Touch, Tastatur), aus → niedrig → hoch → aus.

**Versuch 5: vollständige Trennschritte**
- Jeder richtig ausgeführte Schritt trennt vollständig. Magnet: trocken zwei Durchgänge (¾, dann der Rest), nass drei – danach ist das Eisen restlos entfernt; kein anhaftender Flüssigkeitsfilm mehr. Die Meldung sagt nach jedem Durchgang, ob noch Eisenkörner zu sehen sind.
- Filtration: Der Rückstand tropft vollständig ab, das gelöste Salz geht ganz ins Filtrat; Nachspülen ist nicht mehr nötig (bleibt möglich). Zu wenig Wasser zum Lösen bleibt ein Fehler (ungelöstes Salz im Filter), den Nachspülen korrigiert.
- Trennprinzip: Wer in der Kette dekantiert hat, bekommt das Kreuz „Dichte“ als richtig gewertet (ohne Filtration wird dann Dichte statt Korngröße verlangt); sonst bleibt es „nicht nötig, aber nicht falsch“.

**Tests:** 58 Unit-Tests (neu: Magnetdurchgänge, vollständige Filtration, Spatel-Portionen, Uhrglas weitergeben, Dekantieren, Trennprinzip V5, Teilchenansicht ohne Zeichnen); neues Browserszenario E13 für die Neuerungen (noch auszuführen, siehe Testbericht).

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
