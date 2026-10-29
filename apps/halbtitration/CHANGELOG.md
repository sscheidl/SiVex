# Änderungen

## 0.2.2 – 29.10.2026

Messwerterfassung didaktisch vereinfacht (Rückmeldung der Lehrkraft):

- Messpunkte entstehen **immer automatisch**, sobald die Anzeige stabil ist: beim Eintauchen der Elektrode (Startpunkt), nach jeder Zugabe bzw. nach dem Schließen des Hahns und nach dem Ein-/Ausschalten des Rührers. Die Kurve wächst beim Titrieren mit.
- Entfallen: Knopf „Messwert übernehmen“ (Taste M), Umschalter „Erfassung automatisch/manuell“ und die Meldung zu nicht stabilen Werten.
- Begriffe: Der erste Durchgang heißt „vollständige Titration“ (Knopf „Neue Probe (vollständig)“). Das Zielvolumen der Halbtitration ist ausdrücklich das halbe Äquivalenzvolumen der vollständigen Titration.

## 0.2.1 – 29.10.2026

Bedienung im Labor nach Rückmeldung der Lehrkraft vereinfacht:

- Die Vorbereitung ist nummeriert, in Laborreihenfolge von links nach rechts: ① Bürette ② pH-Meter kalibrieren ③ Probe vorlegen ④ Indikator (freiwillig) ⑤ Rührer ⑥ Elektrode. Der nächste offene Schritt ist hervorgehoben.
- Die Maßlösung wird direkt an der Bürette gewählt („Bürette: Natronlauge | Salzsäure“), nicht mehr im Bedienfeld. Eine falsche Wahl gibt eine Rückmeldung, die Bürette bleibt leer.
- Der Indikator wird mit Auswahl und Knopf im Labor zugegeben und bleibt auch in der eingeklappten Vorbereitung erreichbar.
- Die Messwerterfassung steht standardmäßig auf **automatisch**: Nach jeder Zugabe wird der Messwert übernommen, sobald die Anzeige stabil ist – die Kurve wächst beim Titrieren mit. Umschaltbar auf **manuell**.
- „Messwert übernehmen“ ist grün hervorgehoben; der Rührer steht links in der Messzeile.
- Bei zu früher Übernahme kommt eine verständlichere Meldung.

## 0.2.0 – 29.10.2026

Überarbeitung nach dem Review vom 29.10.2026 (Stand `9bd514b`).

**Lernweg**

- Die App startet im Labor mit kurzem Auftrag.
- Die vorgeschalteten Theorieblöcke und die lange Planungsseite entfallen.
- Neue Folge: selbst titrieren → ÄP an der eigenen Kurve → halber Umsatz → Zielvolumen → frische Probe gezielt halbtitrieren → MWG-Trainer → eigener pK → Abgabe → Vergleich.
- Rollen der Versuche: Essigsäure ist der Kern, Ammoniak der Transfer (pOH ≈ pK_B, pH ≈ pKₛ(NH₄⁺)); Phosphorsäure und Glycin sind ausdrücklich Vertiefungen, beide direkt anwählbar.
- Der Indikator ist eine freiwillige zusätzliche Beobachtung; der Kernweg ist pH-metrisch.
- Start-/ÄP-pH-Rechnungen, Indikatoreignung, Henderson-Hasselbalch und Fehlerzerlegung stehen als freiwillige Vertiefung zur Verfügung.

**Behobene Fehler**

- A: Prüfstatus an Eingabe, Rechenbasis und Messnachweis gebunden (Signatur). Änderungen zeigen „erneut prüfen“; die Abgabe prüft mit den aktuellen Daten.
- B: Eine Abgabe ist nur mit eigenem Zielvolumen und protokolliertem Messpunkt der Halbtitration möglich. Ungenaue echte Messungen werden gekennzeichnet angenommen. Die Abgabe ist eine unveränderliche Momentaufnahme. „Lösung anzeigen“ ist davon getrennt und wird als Musterlösung gekennzeichnet.
- C: Ohne Zielvolumen meldet `checkMeasuredPH` nur noch „vorhanden, Zuordnung offen“. Zielabweichung und Messstatus werden getrennt ausgewiesen.
- D: Die Speziesdarstellung ist als schematische Reaktionsfolge gekennzeichnet; die falsche Aussage „geringe Anteile“ ist entfernt. Gleichgewichtsanteile aus dem Solver erscheinen nach der Freigabe.

**Oberfläche**

- Labkit-Hülle (`shared/labkit` 0.1.1, unverändert): Kopfzeile, verschiebbare Trennlinie, einklappbares Bedienfeld mit den Reitern Aufgabe · Ergebnisse · Hefteintrag.
- Labor und Kurve stehen gleichzeitig nebeneinander.
- Kompakte Dosierleiste; die Vorbereitung klappt nach Erledigung ein.
- Ein pH-Meter für alle Versuche, eine Bürette je Maßlösung; der Bürettenstand wird digital übernommen.
- Kurvenwerkzeuge erscheinen passend zur Aufgabe.
- Ergebnisübersicht als Karten je Versuch und Stufe.

**Daten**

- Speicherformat v2 mit Migration aus 0.1.0. Alte Prüfungen und Abgaben gelten nicht als neue Bearbeitung.
- Solver, Konstanten (Martell & Smith, I = 0) und Mengen sind unverändert.

## 0.1.0 – 27.10.2026

Erste vollständige Fassung (prototype).

- Vier Versuche: Essigsäure/NaOH, Ammoniak/HCl, Phosphorsäure/NaOH, Glycinhydrochlorid/NaOH
- Durchgängiger Gleichgewichtssolver (Ladungs-, Stoff- und Volumenbilanz, Autoprotolyse, Gegenionen)
- Theorie mit Verständnisfragen, Planung mit Indikatortabelle und Begründung
- Labor auf Basis von TitraLab 3: Vorbereitung, Kalibrierung, Bürette mit Anfangsstand, Dosierung, Durchmischung, Elektrode mit Ansprechzeit, Messwertübernahme mit Messstatus, Endpunkt, Zielmarke
- Zwei Durchgänge (Erstdurchgang und Halbtitration), beliebig viele Proben, „Messreihe wiederholen“
- Laborjournal mit sieben Rechenschritten, gestuften Hilfen, Abgabe und Freigabe der Literaturwerte, Zerlegung der Abweichung, Fehlerbetrachtung
- Bericht (Druck/PDF), CSV-Export, Hefteintrag
- Web- und SCORM-1.2-Paket
