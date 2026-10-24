# Papierchromatographie – Bausteinliste (Übernahme aus A, B, Codex)

Stand 24.10.2026 · Vorgehen nach der [Entscheidung zur Aufteilung](../../../docs/decisions/2026-10-23-trennlabor-aufteilung.md), Punkt 4 („bausteinweise statt fassungsweise“), und dem Auftrag „Neustart als eigenständige App“.

**Ausgangsbefund:** Alle drei Fassungen zeigen die Kammer als kleine Szene neben vielen Bedienelementen (A: Kammer ca. 25 % der Bühnenbreite, Stifte als kleine Kästchen; B: Kammer ca. 22 %, Kugelschreiber und Höhenwahl als Schalter; Codex: SVG-Miniatur mit Auswahllisten und Zahlenfeldern). Übernommen wird deshalb vor allem das Fachmodell. Darstellung und Bedienung sind neu.

| Baustein | Quelle | Begründung |
| --- | --- | --- |
| Kapillarmodell der Front (Lucas-Washburn, *w² = k·t*) | **A/B** | in beiden Fassungen gleich, fachlich plausibel und getestet; k-Werte angepasst (`docs/CHEMIE.md`) |
| Komponentenmodell (löslicher Anteil `sol`, relative Laufstrecke `rf`) | **B** | klar getrennt, DOM-frei, gut testbar; Rf-Werte in Ethanol-Wasser neu gewählt |
| Zusammensetzung Schwarz (Gelb + Blau + Violett) | **A** | zwei Komponenten haben eine Referenz → Zuordnung in Aufgabe A möglich |
| Wasserfester Stift (alkohollöslicher Farbstoff + Pigment) | **B** | erfüllt „ein Anteil wandert, ein anderer bleibt zurück“ |
| Laufmittel Ethanol-Wasser 1 : 1 | **B** | wie im Auftrag festgelegt; 7 : 3 aus A ohne fachlichen Mehrwert (Begründung in `CHEMIE.md`) |
| Zonenverschmelzung (überlappende Komponenten = eine Zone) | **B**, verändert | Kriterium über Zonenkanten inkl. Schweif; so zeigen Bild und Bewertung dasselbe |
| Überladung (breitere Zonen, Schweif) | **A/B**, verändert | ab vier Auftupfern; Schweif lässt benachbarte Zonen sichtbar ineinanderlaufen |
| Startlinie unter dem Spiegel (Auflösen, gefärbtes Laufmittel) | **B** | sichtbare Folge: Kammerflüssigkeit färbt sich |
| Frontmarkierung, Trocknen der Front, Front am Rand | **A/B** | nur noch im Expertenmodus |
| Feste Zeitschritte (`createClock`, 0,05 s) | **B** → Baukasten | Pause/Zeitraffer ändern das Ergebnis nicht |
| Begriffsprüfung (`checkGap`, Sperrliste „Absorption“) | **B** → Baukasten | bewährt, mit Tippfehlertoleranz |
| SCORM-1.2-Adapter | **B** → Baukasten | nur `LMSInitialize`/`LMSFinish` |
| Build- und Paketskripte, ZIP-Schreiber mit festen Zeitstempeln | **B** | reproduzierbare Pakete; Build kopiert jetzt zusätzlich `shared/labkit/` |
| Mock-LMS für SCORM-Tests | **B**, erweitert | zusätzlich: Laborbedienung im Paket, Web-ZIP per `file://` (Idee Web-ZIP-Test aus A) |
| Höhenwahl der Startlinie, Bleistift/Kugelschreiber | **entfällt** | Wunsch der Lehrkraft (G-01); Kugelschreiber nur noch als Hinweis |
| Füllhöhe als Auswahl (cm) | **neu** | Eingießen in Portionen an der Flasche; zu viel ist möglich und sichtbar |
| Deckel als eigener Schalter | **entfällt** | Deckel liegt bei der Entwicklung automatisch auf (kein Lerngewinn) |
| Laborbühne (Kammer ≈ 50 % Breite, ≈ 75 % Höhe), Glas, Flüssigkeit, Meniskus | **neu** | nach TitraLab 3 (`lab-renderer.js`), auf hellen Hintergrund angepasst |
| Große Filzstifte mit Kappe, Schaft, Aufschrift, Filzspitze; Auftupfbewegung | **neu** | Anforderung 2.2; keine Farbkästchen |
| Bleistift auf der Bühne (Linie ziehen/radieren als Bewegung) | **neu** | eine Handlung statt Menü |
| Unsichtbare, fokussierbare Trefferflächen über dem Canvas | **neu** | Tippen, Klicken und Tastatur auf dieselben Ziele |
| Verschiebbare Trennlinie | **TitraLab 3** → Baukasten | `setPanelWidth`/`bindSplitter` nachgebaut, Grenzen 300–620 px |
| Ergebnisprüfung am Chromatogramm (Zonen, Referenzhöhe) | **neu** | prüft abgelegte Papiere, nicht die Klickfolge; mehrere Wege zulässig |
| Drei Tipps je Befund, Angebot nach zwei Fehlversuchen | **A/B**-Mechanik, Inhalte **neu** | Stufen und Bezeichnungen nach `QUALITY.md` |
| Protokoll mit geschlossenen Fragen, Rückmeldung je Feld | **Redoxlabor**-Muster, Inhalte **neu** | Ankreuzen/Auswahl mit Distraktoren, zwei Fachbegriffslücken |
| Ergebnisübersicht mit Miniatur-Chromatogrammen | **neu** | Vergleich tatsächlich erzeugter Papiere |
| Hefteintrag (~100 Wörter) | **neu** | jederzeit erreichbar, unabhängig vom eigenen Versuch |
| Codex-Versuch (SVG, gemeinsame Fachlogik aller Bereiche) | **nicht übernommen** | Darstellung zu klein, Bedienung über Formularfelder; keine Bausteine, die A/B übertreffen |
