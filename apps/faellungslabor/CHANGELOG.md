# Changelog

## 1.1.1 – 16.11.2026 (prototype)

Fehlerbehebung aus dem Code-Review zu PR #56; sonst unverändert gegenüber 1.1.0.

- **„− Glas“ bei gefülltem Glas:** Wurde während des Ausgießens in ein *anderes* Glas getropft, landeten Tropfen, die beim Aufrücken der Gläser noch in der Luft waren, im Nachbarglas (falscher Ansatz, falsches Protokoll). Jetzt kommen alle Tropfen im Flug vor dem Aufrücken in ihrem Glas an; eine Pipette über einem nachrückenden Glas – auch eine gerade dorthin unterwegs – folgt ihm. Neue Prüffälle FK05b (Unit und Browser).
- iPad-/mebis-Rückmeldung der Lehrkraft zu 1.0.0 im Testbericht nachgetragen (FL32/FL33 für 1.0.0).

## 1.1.0 – 16.11.2026 (prototype)

Korrekturfassung nach [`prompts/faellungslabor-korrekturauftrag-claude.md`](../../prompts/faellungslabor-korrekturauftrag-claude.md) (Revision 1). Labkit 0.3.0 unverändert; andere Apps unverändert.

- **Etiketten und Gruppen:** Flaschenetikett als HTML in festen Bildschirmpixeln (Formel 18 px, Name 14 px, „verdünnt“/„konzentriert“/„destilliert“ 14 px fett), Flaschen in fachlichen Gruppen mit Abstand und Überschrift (Haupt- und Kontrollteil). Die Flaschengröße folgt dem Etikett, nicht dem Bühnenmaßstab. Pipetten, Tropfen und Ausgießen liegen auf einer eigenen Ebene über den Etiketten; Trefferflächen folgen den neuen Positionen. Schmale Bühne: Etikett nur mit Formel und Zusatz.
- **Keine Konzentrationsetiketten mehr auf der Bühne;** die exakten Konzentrationen stehen in der antippbaren Infokarte („Konzentration: …“). Modellwerte unverändert.
- **„− Glas“:** nimmt das gewählte Glas aus dem Ständer – leer sofort, gefüllt nach Rückfrage über das Ausgießen; mindestens ein Glas bleibt; laufende Dosierung wird zuvor beendet; Kennungen bleiben stabil.
- **Ausgießen in „Silberabfälle“** (Spülen und „− Glas“): Anheben, Kippen über dem beschrifteten Sammelbehälter, Strahl in die Öffnung, leer zurück (2,4 s; reduzierte Bewegung 0,8 s im Ständer). Zustandsgekoppelt, Archiv genau einmal, Abfallbilanz je Versuchsteil; robust bei Mehrfachklick, Pause, Teilwechsel, Fokusverlust und Neuladen.
- **Auflösen mit Ammoniak schneller sichtbar:** Darstellungsraten 0,9 / 0,25 s⁻¹ und 3 %/s (vorher 0,30 / 0,05 s⁻¹, 1 %/s); Kₗ, β und Stoffmengen unverändert, Gleichgewichtsreste bleiben.
- **Dieselbe Probe** darf nach AgNO₃ und nach NH₃ erneut zugegeben werden (gleicher Ansatz, neue Revision, Kapazitätsgrenze); eine andere Probe bleibt gesperrt.
- **Antworten gemischt:** Fisher-Yates mit Startwert je Durchgang (auch Zuordnungen und Gleichungen als Ganzes), stabil bis „Neuer Durchgang …“; Bewertung über fachliche IDs; gespeicherte 1.0-Antworten werden übernommen.
- Bedienfeld standardmäßig etwas schmaler, Reiter umbrechen statt abzuschneiden; Bedienleiste kompakter.
- Neue Prüffälle FK01–FK19 (`tests/e2e/korrektur.mjs`, `tests/unit/korrektur.test.js`), angepasste Regressionstests.

## 1.0.0 – 16.11.2026 (prototype)

Erste funktionsvollständige Version nach dem Build-Auftrag [`prompts/faellungslabor-build-claude.md`](../../prompts/faellungslabor-build-claude.md) (Auftragsversion 1.0). Labkit 0.3.0 (unverändert).

- **Fällungsreaktionen:** NaCl, NaBr, NaI (je 0,100 mol/L) mit AgNO₃ (0,100 mol/L); Probe 1/2/3 mL, Tropfen 0,050 mL; Tropfen fallen sichtbar und werden erst beim Eintreffen gebucht; lokale Wolke → Verteilung → Absetzen, Schwenken; Farben weiß / cremefarben bis schwach gelb / blassgelb.
- **Ammoniakprüfung (Erweiterung):** verdünnt 2,0 mol/L, konzentriert 25 % (13,3 mol/L); gekoppeltes Löslichkeits-/Komplexgleichgewicht (Martell/Smith), mengenabhängig und zeitlich fortschreitend; frische Vergleichsansätze mit „+ Glas“ (bis 6).
- **Kontrollversuche** als eigener, unabhängiger Teil: Positivkontrolle, Blindprobe, Leitungs- und Mineralwasser (phänomenologisches Mischfällungsmodell), verbindliche Auswertungsaussage, Kurzfassung.
- **Grenzen der Anleitung:** Verbotszeichen mit Text vor jedem Stofftransfer; Zustand bleibt unverändert.
- **Aufgaben:** Beobachtungen, reagierende Ionen und Zuschauerionen, vollständige Ionengleichungen, Ammoniak (optional), Kontrollen (getrennt); Rückmeldung je Aussage, Tipp 1/3–3/3, Lösung mit Rückfrage. Protokoll mit Ergebnisübersicht, veränderte Ansätze werden markiert.
- **Hefteintrag** (83 Wörter + Gleichung) jederzeit; Kurzfassung der Kontrollen separat.
- **Gefahrstoffkarten** je Lösung nach aktuellen Sicherheitsdatenblättern bzw. begründeter Ableitung.
- Hell/dunkel-Kontrastschirm, verschiebbare Trennlinie, Touch/Maus/Tastatur, Pause/1×/5×, Sitzungsspeicher.
- **Artefakte:** Einzeldatei-HTML, Web-ZIP, SCORM-1.2-ZIP, SHA256SUMS.
