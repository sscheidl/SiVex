# Destillation – Fachmodell, Modellgrenzen, Quellen

Version 0.2.0 · Quellcode: [`js/model.js`](../js/model.js) (ohne DOM, in Node testbar)

## 1. Stoffgemische

Genau drei Szenarien, je eine feste Füllung von 100 mL im 250-mL-Rundkolben:

| Modus | Gemisch | Zusammensetzung |
| --- | --- | --- |
| Standard 1 | Ethanol + Wasser | 40 mL Ethanol + 60 mL Wasser |
| Standard 2 | Propanon (Aceton) + Wasser | 40 mL Propanon + 60 mL Wasser |
| Experte 3 | Propanon + Ethanol + Wasser | 30 + 30 + 40 mL |

Stoffdaten (gerundet; Siedetemperaturen bei etwa 1013 hPa):

| Stoff | ϑb | ρ in g/mL | M in g/mol | ΔHv in kJ/mol | c in J/(g·K) |
| --- | --- | --- | --- | --- | --- |
| Propanon | 56 °C | 0,784 | 58,08 | 29,1 | 2,16 |
| Ethanol | 78 °C | 0,789 | 46,07 | 38,6 | 2,44 |
| Wasser | 100 °C | 0,998 | 18,02 | 40,7 | 4,18 |

Mengen werden als Volumen der reinen Stoffe geführt (Volumenkontraktion beim Mischen vernachlässigt). Erdölfraktionierung ist bewusst nicht enthalten (andere Apparatur, keine Reinstoff-Siedetemperaturen).

## 2. Verbindliche didaktische Vereinfachung: idealisierte Trennung

Die Simulation nimmt eine **idealisierte, weitgehend vollständige Trennung** an. Reale Azeotrope und weitere Nichtidealitäten werden vernachlässigt.

- **Real** liefert eine einfache Destillation eines Ethanol-Wasser-Gemischs nur ein *ethanolreicheres* Destillat; Ethanol und Wasser bilden ein Azeotrop (≈ 95,6 % Massenanteil Ethanol, ϑb ≈ 78,2 °C) und sind durch Destillation nie vollständig trennbar. Auch Propanon/Wasser und das Dreistoffgemisch trennen sich in einer einfachen Apparatur nur teilweise; Fraktionen enthalten immer Anteile der anderen Stoffe.
- **In der Modellwelt** besteht der Dampf praktisch nur aus dem am niedrigsten siedenden noch vorhandenen Stoff. Die Übergänge sind stetig: Wird ein Stoff knapp, steigt die Siedetemperatur des Kolbeninhalts kontinuierlich, der Dampfstrom bricht kurz ein, das Thermometer fällt etwas und steigt dann zum nächsten Abschnitt.

Diese Grenze steht in der App unter „Grundlagen und Modellgrenze“, in der Ergebnisübersicht, im Hefteintrag („Merke“) und in den Lösungstexten. Die App behauptet nirgends, eine reale einfache Destillation trenne vollständig.

### Formel

Mit den Stoffmengenanteilen xᵢ der Flüssigkeit, den Reinstoff-Siedetemperaturen ϑb,ᵢ und der Trennschärfe K = 1,5 K⁻¹:

    Σ xᵢ · exp(K · (ϑ − ϑb,ᵢ)) = 1   ⇒   ϑ = −ln(Σ xᵢ · exp(−K · ϑb,ᵢ)) / K
    Dampf: yᵢ = xᵢ · exp(K · (ϑ − ϑb,ᵢ))

Für einen Reinstoff ergibt sich genau seine Siedetemperatur. Für das Ausgangsgemisch Ethanol/Wasser liegt die Siedetemperatur bei 79,2 °C (Propanon/Wasser 57,3 °C); während das Ethanol übergeht, steigt sie langsam auf etwa 81 °C. Der Parameter K ist eine Modellgröße, kein Stoffwert.

## 3. Energie und Zeit

| Größe | Wert | Bedeutung |
| --- | --- | --- |
| Heizpilz | 400 J/K, Stufen niedrig/mittel/hoch = 100/150/250 W elektrisch | EIN/AUS schaltet die elektrische Leistung sofort; der Pilz gibt Wärme über 4 W/K an den gefüllten Kolben ab (Restwärme nach dem Ausschalten) |
| Kolben | Glas 150 J/K + Füllung, Verlust 0,5 W/K | Aufheizen auf Siedetemperatur bei „mittel“ ≈ 8–9 min Modellzeit |
| Aufsatz | 90 J/K, 4 W/K zum Dampf, 0,25 W/K Verlust | Der Dampf kondensiert zuerst an der kalten Wand (Rücklauf); erst dann erreicht er Thermometer und Kühler |
| Siedeverzug | ohne Siedesteine bis 6 K Überhitzung | danach schlagartiges Aufsieden, Spritzer, Sicherheitsstopp (Lehrszenario, keine reale Zeitvorhersage) |
| Heftiges Sieden | Verdampfungsleistung > 110 W | Flüssigkeit wird mitgerissen (0,0004 mL/(s·W)), das Destillat wird unreiner |

Das Modell rechnet in festen Zeitschritten von 0,05 s Modellzeit (`LK.core.createClock`). Pause und Zeitraffer (1×, 10×, 30×) ändern nur das Tempo, nie das Ergebnis (Test M-06). Handgriffe (Einfüllen, Siedesteine, Flamme) laufen höchstens in Echtzeit.

Typische Zeiten bei „mittel“ und korrekter Kühlung (Standard 1): erste Tropfen nach ≈ 10 min, Ethanol-Abschnitt ≈ 10 min, ≈ 0,08 mL/s Destillat; bei 30× in gut 40 s Echtzeit.

## 4. Thermometer

| Lage | Messwert im Modell |
| --- | --- |
| Kugel auf Höhe des seitlichen Abgangs (richtig) | Dampftemperatur, sobald Dampf den Aufsatz passiert (Zeitkonstante 6 s); ohne Dampfstrom die Temperatur im Aufsatz |
| Kugel oberhalb des Abgangs | nicht vom Dampf umspült: 20 °C + 0,72 · (örtliche Temperatur − 20 °C), träge (30 s) – deutlich zu niedrig |
| Kugel tief im Kolbenhals | nahe der heißen Flüssigkeit, von Spritzern getroffen: Flüssigkeitstemperatur + 2 K + 5 % des Abstands zum Heizpilz – zu hoch |

Die Lage lässt sich nur verstellen, wenn die Heizung aus ist und nichts mehr siedet. Messwerte einer Vorlage gelten als „nicht repräsentativ“, wenn mehr als 20 % ihrer Tropfen bei falscher Lage aufgefangen wurden.

## 5. Kühlwasser und Kondensation

- Mantel 45 mL. Durchfluss gering/mittel/stark = 1/4/10 mL/s (gegenüber der Praxis verkleinert, damit die Stufen sichtbar wirken), Leitungswasser 15 °C.
- Wärmedurchgang 3,0 W/K bei vollem Mantel, Luftkühlung 0,35 W/K. Die Kondensationsleistung ist durch Mantelfüllung und Wassertemperatur begrenzt; was nicht kondensiert, tritt am Vorstoß als Dampf aus und wird als Verlust gebucht.
- **Richtig** (unten hinein, oben heraus): Mantel füllt sich von unten vollständig.
- **Vertauscht** (oben hinein, unten heraus): Das Wasser läuft am Boden des Mantels durch; nur etwa 12 % sind gefüllt → weniger Kondensat, Dampfverlust.
- **Kühlwasser AUS** bei gefülltem Mantel: Das stehende Wasser erwärmt sich durch die Kondensationswärme; die Kühlleistung sinkt deshalb verzögert.
- Kondensat bildet einen Film im Innenrohr (Verweilzeit 5 s) und fällt in Tropfen zu 0,05 mL aus dem Vorstoß. Steht keine Vorlage darunter, fallen die Tropfen auf den Tisch (Verlust).

## 6. Brennprobe (Modellvereinfachung)

Eine Probe von 1 mL wird mit der Pipette aus der **abgenommenen** Vorlage am Prüfplatz entnommen (aus der montierten Vorlage nicht möglich) und in der Porzellanschale entzündet. Entnahme, Überführen und Anzünden sind Handgriffe mit festem Wirkzeitpunkt (0,55 / 0,7 / 0,72 ihrer Dauer); sie laufen höchstens in Echtzeit. Ethanol-Wasser-Gemische lassen sich nur entzünden, wenn ihr Flammpunkt nahe an oder unter der Probentemperatur liegt. Der Flammpunkt steigt mit dem Wasseranteil (Richtwerte: reines Ethanol ≈ 13 °C, 50 % ≈ 24 °C, 40 % ≈ 26 °C, 30 % ≈ 29 °C, 20 % ≈ 36 °C Volumenanteil Ethanol). Eine kleine Probe in der Schale, die mit dem Stabfeuerzeug direkt beflammt wird, entzündet sich deshalb erst ab etwa der Hälfte Ethanol zuverlässig. Das Modell verwendet daher vereinfachte Schwellen:

| Ethanolanteil der Probe (Volumen) | Beobachtung |
| --- | --- |
| ≥ 50 % | anhaltende, überwiegend bläuliche Flamme; verbrennt Ethanol mit 0,08 mL/s, bis der Anteil unter 25 % fällt |
| 30 – 50 % | kurzes Aufflackern |
| < 30 % | keine anhaltende Flamme |

Eine Flamme zeigt Brennbarkeit, sie beweist weder die Identität noch die Reinheit von Ethanol. Die Brennprobe gehört nur zum Ethanol-Wasser-Versuch; beim Propanon (leicht entzündlich) ist sie keine Unterrichtsaufgabe. Zünden an der Apparatur und Probenahme aus dem heißen Kolben lösen einen Sicherheitsstopp aus.

## 7. Sicherheitsstopps

| Ursache | Wirkung | Wiederanlauf |
| --- | --- | --- |
| Siedeverzug (ohne Siedesteine) | Heizung aus, bis 4 mL verspritzt | Kolben < 50 °C, Siedesteine zugeben |
| Vorlage verschlossen beim Heizen | Heizung aus | Stopfen entfernen |
| > 4 mL brennbarer bzw. > 8 mL Dampf ausgetreten | Heizung aus | Kühlwasser in Betrieb |
| Kolben unter 4 mL bei laufender Heizung | Heizung aus | Versuch neu beginnen |
| Zünden an der Apparatur | Heizung aus | Bestätigen; Brennprobe am Prüfplatz |
| Probe aus heißem Kolben | Heizung aus | Bestätigen; Probe aus der Vorlage |

Bereits aufgefangene Fraktionen bleiben erhalten; „Versuch neu beginnen“ archiviert sie für die Ergebnisübersicht.

### Warnung vor dem Übergang des nächsten Stoffs

Sammelt die Vorlage überwiegend Propanon oder Ethanol und sind im Kolben weniger als 5 % davon übrig, warnt die App einmal je Vorlage: Steigt die Temperatur weiter, geht der nächste Stoff (meist Wasser) über und verunreinigt das Destillat. Abhilfe: Heizung aus bzw. (Experte) Vorlage wechseln.

## 8. Stoffbilanz

    Eingefüllt = Kolben + Kondensat im Kühler + hängender Tropfen + alle Vorlagen
               + Dampfverlust + Tisch + verspritzt + Proben + verbrannt

Die Abweichung bleibt in allen Unit-Tests unter 10⁻⁶ mL (Test M-04), keine Stoffvermehrung.

## 9. Quellen

- Siedetemperaturen, Dichten, molare Massen, Verdampfungsenthalpien: CRC Handbook of Chemistry and Physics; GESTIS-Stoffdatenbank (IFA) für Ethanol, Propanon, Wasser.
- Azeotrop Ethanol/Wasser: z. B. Gmehling/Kolbe, *Thermodynamik*; Lehrbuchwerte 95,6 % (Massenanteil), 78,2 °C.
- Flammpunkte wässriger Ethanollösungen: GESTIS bzw. DGUV-Informationen zu Ethanol-Wasser-Gemischen (Richtwerte, gerundet).
- Didaktik: Bayerischer Lehrplan Chemie NTG 8 / SG 9 (Stoffgemische, Trennverfahren); Sicherheitsregeln nach RiSU (Siedesteine, offene Apparatur, Brennprobe nur kleine Mengen getrennt von der Apparatur).
- Gleichgewichtsdaten aus Fassung A/B des Trennlabors (Hintergrund, im idealisierten Modell nicht verwendet).
