# Änderungen – Trennverfahren

## 0.1.0 – 27.10.2026 (prototype)

Erste lauffähige Fassung nach dem [Build-Auftrag „klassisches Trennlabor“](../../prompts/trennlabor-klassik-build-claude.md) und der [Trennlabor-Planung](../../docs/TRENNLABOR-PLANUNG.md).

- Fünf Versuche mit selbstständiger Bedienung: Dekantieren, Filtrieren, Eindampfen, Scheiden, Trennkette Eisen/Sand/Kochsalz.
- Bilanztreues Fachmodell mit Absetzfront, Löslichkeitsgrenze, Filterrückhalt und Restfeuchte, Emulsion/Entmischung, Scheidetrichter mit Stopfen und Hahn, Magnet, Heizplatte mit Trägheit.
- Laborgrafik in Canvas 2D: Glasgefäße mit Meniskus und Glanz, waagrechter Spiegel beim Kippen, Strahl vom Ausguss, Tropfen, gedämpfte Wellen und Ringwellen (nach TitraLab 3), sichtbare Sedimentation, Kristallbildung, Dunst.
- Zuschaltbares, zustandsabhängiges Teilchenmodell in eigenem Bereich; Schalter für Gerätenamen; Hinweisbereich oberhalb der Laborfläche.
- Protokoll mit freier Beobachtung und Zwischenständen, Einordnung, Trennprinzip; Kontrolle (10 MC + Lückentext mit 10 Begriffen); Hefteintrag nach abgeschlossenem Lernablauf.
- Web- und SCORM-1.2-Paket, Labkit 0.1.1.

Historischer Code des Trennlabors 1.0.0 wurde nur gesichtet (Fachmodell der Fassung B, Tag `archiv/trennlabor-1.0.0`) und nicht übernommen; Fachmodell, Grafik und Oberfläche sind neu. Übernommen wurden Build-, Paket- und Testgerüst (über die Destillation, ursprünglich Fassung B) sowie der gemeinsame Baukasten `shared/labkit`.
