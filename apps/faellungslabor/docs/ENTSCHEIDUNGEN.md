# Fällungslabor – Bestandsaufnahme und Implementierungsentscheidungen

Stand 16.11.2026. Ausgangsbasis: `main` = 5f063f8 (unverändert seit der Bestandsaufnahme im Auftrag), Auftragsbranch `docs/faellungslabor-build-claude` (d64c5ac) als Arbeitsbasis übernommen; Implementierung auf `feature/faellungslabor`. Kein `AGENTS.md` im Repository; keine fremden Änderungen im Arbeitsstand.

## Bestandsaufnahme

- **Labkit 0.3.0** (`shared/labkit`): Grundstil, Trennlinie, Fokus-Wiederherstellung, Lernweg (Schrittchips, Formular, Tipps, Lösung), SCORM-Adapter. Alle Bausteine passen ohne Änderung → Labkit bleibt unverändert, keine Regressionen an anderen Apps.
- **TitraLab 3** (`apps/titration`): Referenz für Glas, Meniskus, Tropfen, Flüssigkeit, Paletten; Füllhöhe aus Glasgeometrie. Übernommen als Darstellungslösung (siehe `QUELLEN.md`), keine Titrationslogik.
- **Redoxlabor:** Vorbild für Protokoll/Ergebnisübersicht/Aufgaben und Gefahrstoffkarten; GHS-Piktogramme (gemeinfrei) unverändert übernommen.
- **Pufferfish:** aktuelles Muster für Build, Paket, Server, Playwright-Tests und Mock-LMS.

## Entscheidungen

| Thema | Entscheidung | Begründung |
| --- | --- | --- |
| Laufzeitformat | klassische Skripte (UMD-Muster wie Labkit), kein Bundler, keine ES-Module, kein `fetch` | startet per Doppelklick über `file://` ohne CORS; Einzeldatei durch einfaches Einbetten |
| Einzeldatei | `package.mjs` bettet Stylesheets und Skripte in Ladereihenfolge ein; Piktogramme sind schon `data:`-URIs | keine zweite Quelle, identischer Code in allen drei Artefakten |
| Fachmodell | gekoppeltes Kₗ/β-Gleichgewicht je Ansatz (ein Halogenid), Bisektion; Fällung sofort, Auflösen als Relaxation zum Gleichgewicht | mengen- und überschussabhängig, keine Flaschenname-Automatik, keine allgemeine Speziationsengine |
| Wasserproben | festes F (Ag⁺-Äquivalente), Fällung min(Ag, F) | vom Auftrag verlangt: phänomenologisch, getrennt vom Halogenidmodell |
| Feststoff-Darstellung | drei Bereiche (Wolke, Schwebe mit Absetzfront, Bodensatz) im Modell, Renderer zeichnet nur | Übergänge prüfbar; Menge bleibt beim Schwenken erhalten |
| Bedienung | Tippen statt Ziehen; nur Pointer-Ereignisse für Tropfen, Klick nur für Hilfsmittel ohne Zeiger; Ziehen der Pipette zusätzlich | keine Doppelauslösung Touch/Maus; „Umfüllen in Flaschen“ als Ziehen abfangbar |
| Messpipette | kehrt nach der Probenabgabe selbst zurück | erneutes Antippen des Glases soll es auswählen, nicht ungewollt Probe nachfüllen |
| Etiketten | Regal-Etiketten auf der Zeichnung, unsichtbare Schaltflächen darüber | die Pipette über einem Glas liegt sonst hinter HTML-Etiketten (beim Test gefunden) |
| Speicher | Sitzung in `sessionStorage`, Darstellung in `localStorage` | Labkit-Regel (DESIGN.md §7): Neuladen behält den Versuch, neuer Tab beginnt neu |
| Version/Status | 1.0.0, `prototype` | iPad, mebis und Lehrkraftabnahme ausstehend (Abschnitt 12 des Auftrags) |
| Jahrgangsstufen | 8, 9 | LehrplanPLUS geprüft (Chemie 8 NTG LB 4; Chemie 9 LB 4) – nicht aus Pufferfish (Q13) übernommen |
| NH₃-Konzentrationen | 2,0 mol/L; 25 % ≙ 13,3 mol/L | Referenzfälle R4–R9 bestätigen die verlangte Abstufung (`CHEMIE.md`) |
