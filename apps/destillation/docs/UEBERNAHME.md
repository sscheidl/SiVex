# Destillation 0.1.0 – Baustein- und Übernahmematrix

Stand 25.10.2026. Grundlage: [Entscheidung zur Aufteilung](../../../docs/decisions/2026-10-23-trennlabor-aufteilung.md) („bausteinweise statt fassungsweise“), [Eindrücke der Lehrkraft](../../../docs/reviews/trennlabor-eindruecke-lehrkraft.md) und der Entwicklungsauftrag vom 24.10.2026.

Geprüfte Quellen:

| Kürzel | Stand | Dateien |
| --- | --- | --- |
| **A** | `486f370` (Tag `archiv/trennlabor-ccr`) | `apps/trennlabor/js/model/distill.js`, `js/render/distill-render.js`, `js/tasks/distill-tasks.js` |
| **B** | `a5d6d0e` (`main`, `apps/trennlabor/`) | `js/distill.js`, `js/render-distill.js`, `js/tasks.js`, `js/gfx.js` |
| **C** | `dde56a0` (PR #10, Codex) | `js/chemistry.js`, `js/lab.js` (SVG) |
| **T3** | TitraLab 3 Web-Release | `titration/js/view/lab-renderer.js`, `geometry.js`, `ui/app.js`, `css/styles.css` |
| **R** | Redoxlabor | Protokoll-, Rückmelde- und Lösungsablauf |
| **K** | Papierchromatographie 0.1.0 / Labkit 0.1.0 (PR #20) | Seitenhülle, Splitter, Zeittakt, Build/Paket/Mock-LMS |

Frühere Selbsttestberichte von A, B und C wurden nur als Hinweise genutzt. Die Screenshots der drei Fassungen zeigen: A und B beginnen mit leerer Bühne und Zusammenbau aus einer Geräteablage, Schläuche kreuzen sich (B) bzw. Anzeigen überdecken die Apparatur (A); C zeigt die Apparatur klein und mit weißen „Dampf“-Strichen im Kühlerrohr. Keine der drei Grafikroutinen wurde deshalb übernommen.

## Matrix

| Baustein | Quelle | Begründung |
| --- | --- | --- |
| **Fachmodell: Energiebilanz** (Heizleistung − Wärmeverlust erwärmt den Kolben, danach Verdampfen) | A/B (Idee), **neu** umgesetzt | A und B rechnen beide so; neu ist der Heizpilz mit eigener Wärmekapazität (EIN/AUS schaltet die elektrische Leistung sofort, Restwärme fließt verzögert nach) – vom Auftrag ausdrücklich verlangt. |
| **Fachmodell: Siedetemperatur und Dampfzusammensetzung** | **neu** | A/B nutzen Gleichgewichtsdaten Ethanol/Wasser (realistisch, aber nur ethanolreicher, nicht getrennt; nur zwei Stoffe). Der Auftrag verlangt eine *idealisierte, weitgehend vollständige Trennung* für drei Gemische einschließlich Propanon. Neu: eine geschlossene Formel mit Trennschärfe-Parameter (`K_SHARP`), stetig, für beliebig viele Stoffe, Reinstoffe sieden genau bei 56/78/100 °C. |
| **Aufsatz-Erwärmung vor dem Thermometer** (Rücklauf, verzögerter Messbeginn) | A/B | Fachlich richtig und in beiden Fassungen vorhanden; übernommen und mit geglätteter Ankopplung des Thermometers ergänzt. |
| **Thermometerlage** (zu hoch / richtig / zu tief) | A/B (Fehlfall), **neu** (Messwertmodell) | A/B kennen „zu hoch“ und „in der Flüssigkeit“; die Einbaulage „in der Flüssigkeit“ ist bei fertig montiertem Aufsatz nicht möglich → „Kugel tief im Kolbenhals“. Startzustand absichtlich „zu hoch“, damit Lernende prüfen. |
| **Kühlwasser** (Mantelfüllung, Wassertemperatur, Durchfluss, vertauschte Schläuche, stehendes Wasser erwärmt sich) | **neu** | A: Kühlleistung als feste Stufe; B: Warnung, Versuch läuft weiter (vom Review bemängelt). Neu ist ein Mantelmodell, in dem Durchfluss, Füllung und Wassertemperatur die Kondensation tatsächlich begrenzen; vertauschte Schläuche füllen den Mantel nur teilweise. |
| **Kondensat, Tropfen, Verluste, Stoffbilanz** | A (Bilanzidee), **neu** | A bucht Verluste in Kategorien; übernommen. Neu: Kondensatfilm mit Verweilzeit, einzelne Tropfen fester Größe (0,05 mL) mit Zähler, Verlust auf den Tisch ohne Vorlage. Bilanz in allen Tests < 10⁻⁶ mL. |
| **Brennprobe** (Probe aus der Vorlage, Schale, Zünden, Schwellen) | A/B (Schwellen, Sicherheitslogik), **neu** (Verbrauch, Flammendauer) | Schwellen 50 % / 30 % Volumenanteil nach A/B (Flammpunkt-Begründung in CHEMIE.md). Neu: Flamme aus dem Modell (verbrennt Ethanol, erlischt bei < 25 %), nur am getrennten Prüfplatz, nur bei Ethanol/Wasser. |
| **Sicherheitsstopps** (geschlossen, Dampf, Trockenlauf, Zünden, heißer Kolben, Siedeverzug) | A/B | Fälle und Texte weitgehend aus A/B; neu: Stopp bei kritischem Dampfverlust, Wiederanlauf erst nach Behebung der Ursache (Siedesteine, Kühlung, Stopfen). |
| **Apparaturgeometrie** | **neu** | A/B/C setzen Teile mit festen X/Y-Werten. Neu: `js/geometry.js` – ein Koordinatensystem, jedes Teil aus den Ankerpunkten des Vorgängers, Schläuche aus den Anschlusspunkten, gleichmäßige Skalierung der ganzen Szene; Sollverbindungen als Unit- und Browsertest. |
| **Renderer: Glas, Meniskus, Tropfen** | **T3** | Technik aus `lab-renderer.js`: Rückwand mit Verlauf, seitliche Abdunkelung, Spiegel als flache Ellipse mit Meniskus, Glanzlichter, Tropfen mit Lichtreflex; an den hellen Labkit-Hintergrund angepasst. |
| **Renderer: Apparatur** (Heizpilz im Schnitt, Liebigkühler mit zwei Räumen, Vorstoß, Schläuche ohne Kreuzung) | **neu** | Keine der Fassungen zeigt Mantelströmung von unten nach oben, Kondensatfilm im Innenrohr und unsichtbaren Dampf gemeinsam. |
| **Große Digitalanzeige + klassisches Thermometer** | A/B (Idee), **neu** | A/B haben Digitalanzeigen, die die Apparatur teilweise überdecken; neu: Anzeige links neben dem Thermometer, durch Geometrietest frei von Glasteilen, Mindestgröße auf Tablets. |
| **Temperatur-Zeit-Diagramm** | B (Idee), **neu** | B zeigt den Verlauf dauerhaft über der Apparatur; neu als zuschaltbare Einblendung im Expertenmodus mit Achsen, Einheiten, Reinstoff-Linien und Markierung der Vorlagenwechsel. |
| **Kühler-Detailansicht** | **neu** | In keiner Fassung vorhanden. |
| **Lernsystem** (Ergebnis prüfen, Protokoll, Tipps 1/3–3/3, Lösung mit Rückfrage) | **R** über **K** | Ablauf und Rückmeldeformen nach Redoxlabor bzw. Labkit-DESIGN; Inhalte neu. Messwertfelder prüfen gegen die eigenen Messwerte (Median der Thermometeranzeige beim Tropfen, Volumen der Vorlage). |
| **Geräte-Trainer** | A (Begriffsliste), **neu** | A nennt die Teile beim Aufbau; neu: zwölf Nummern an der fertigen Apparatur, Zuordnung mit plausiblen Alternativen, Funktionsfragen, Modus „Geräte erkunden“ mit Hervorhebung. |
| **Hefteintrag** | **neu** | ca. 100 Wörter nach DESIGN.md, unabhängig vom Versuch. |
| **Seitenhülle, Splitter, Zeittakt, SCORM** | **K** (Labkit 0.1.0) | unverändert genutzt; kein Framework-Neubau. |
| **Build, Paket, Mock-LMS-Test** | **K** (aus B) | Skripte der Chromatographie übernommen und angepasst. |
| **Tests** | **neu** | Unit-Tests (Modell, Geometrie, Aufgaben) und Browser-E2E (13 Szenarien über die Oberfläche) neu geschrieben. |

## Verworfen

- **Zusammenbau aus einer Geräteablage** (A, B): widerspricht dem Auftrag (Apparatur ab Start montiert).
- **Mengen- und Gemischmenüs** (A: Portionen à 25 mL, B: 25/100/175 mL, C: frei wählbare Masse): unnötige Auswahl (G-01 der Lehrkraft). Je Gemisch genau eine Füllung von 100 mL.
- **SVG-Renderer** (C): andere Technik als die übrigen SiVex-Labore, sichtbare „Dampf“-Striche im Kühler.
- **Gleichgewichtstabellen Ethanol/Wasser** (A, B): realistischer, aber nicht mit der verlangten idealisierten Trennung und drei Stoffen vereinbar; als Hintergrund in CHEMIE.md erwähnt.
