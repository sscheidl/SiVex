# Bedienung

Vier Arbeitsphasen in der Kopfzeile. Sie lassen sich jederzeit wechseln; Messreihen, Rechnungen und Antworten bleiben erhalten (lokal im Browser).

1. **Theorie**: Begriffe, Herleitung der Henderson-Hasselbalch-Gleichung aus dem MWG, Basen (pOH/pK_B), mehrprotonige Systeme, Indikator und Elektrode. Fünf Verständnisfragen mit „Prüfen“, „Tipp n/3“ und „Lösung anzeigen“.
2. **Planung**: Wähle Versuch, Maßlösung, bei mehrprotonigen Systemen den Äquivalenzpunkt für den Indikator, die Teilchen am ÄP, die pH-Erwartung, den Indikator und die Begründung. Nach „Planung prüfen“ mit passender Maßlösung ist das Labor freigeschaltet. Die Indikatortabelle zeigt Farben und Umschlagsbereiche, aber keine fertige Kurve.
3. **Labor**: links Titrierstand und Kurve, rechts das Bedienfeld. Die Trennlinie lässt sich mit Maus, Finger oder Pfeiltasten verschieben; Doppelklick stellt die Standardbreite wieder her.
4. **Auswertung**: Kurve mit Werkzeugen und Messtabelle (mit ΔpH/ΔV), rechts das Laborjournal mit den Rechnungen 1–7.

## Labor

**Probe:** Wähle zuerst den Zweck („Erstdurchgang: ÄP untersuchen“ oder „Halbtitration: pK bestimmen“). Dann folgen:

1. Probe pipettieren
2. mit Wasser verdünnen
3. Indikator zugeben (falls geplant)
4. Magnetrührer einschalten (auch durch Antippen des Rührers)

**Bürette:** Vorspülen, befüllen, Spitze entlüften. Danach den Anfangsstand in der Ablesehilfe ablesen und eintragen; ohne Eintrag ist keine Zugabe möglich. Nachfüllen geht nur zwischen zwei Proben.

**pH-Meter:** Mit Puffer pH 7,00 und einem zweiten Puffer kalibrieren (pH 10,01 bei Säuren, pH 4,01 bei Ammoniak), dann die Elektrode spülen und eintauchen. Das geht erst, wenn die Probe verdünnt ist.

**Titrieren:**

- **Zugeben:** gibt die gewählte Dosiermenge ab (1 Tropfen = 0,05 mL bis 2,00 mL). Taste **D**.
- **Hahn öffnen/schließen:** kontinuierlicher Fluss mit einstellbarer Tropfgeschwindigkeit. Auch per Antippen des Hahns im Bild oder mit Taste **H**.
- **Messwert übernehmen:** protokolliert V und pH mit Messstatus. Taste **M**. Erst bei „stabil“ übernehmen; zu frühe Werte erscheinen in der Kurve als offene Kreise.
- **Automatisch übernehmen:** übernimmt nach jeder Zugabe den Wert, sobald die Anzeige stabil ist. Nicht-stabile Werte übernimmt diese Funktion nie.
- **Endpunkt notieren:** bei bleibender Indikatorfarbe. Danach den Bürettenstand ablesen und eintragen.
- **Eigene Zielmarke** (nur bei der Halbtitration): Hilfslinie an Bürette und Kurve. Es wird nicht automatisch gestoppt.
- **Messreihe beenden:** speichert die Reihe.

**Probe wechseln:**

- **Neue Probe:** frischer Kolben; alle gespeicherten Messreihen und Rechnungen bleiben.
- **Messreihe wiederholen:** verwirft nur die aktive Reihe und setzt eine frische Probe für denselben Zweck an.
- **Zurücksetzen** in der Kopfzeile: setzt das gesamte Labor zurück, also alle Versuche (mit Rückfrage).

## Auswertung

- **Reihenauswahl:** Erstdurchgang und Halbtitration getrennt wählbar. Die nicht aktive Reihe erscheint blass.
- **Ablesen:** Antippen oder Ziehen wählt den nächsten Messpunkt; Pfeiltasten springen von Punkt zu Punkt.
- **Marker ÄP/HÄP:** Antippen oder Ziehen setzt den Marker. Die Pfeiltasten verschieben ihn um 0,05 mL, mit Umschalt um 0,5 mL; alternativ das Eingabefeld „Setzen“ nutzen. Interpolierte pH-Werte sind gekennzeichnet. Liegen die umgebenden Messpunkte mehr als 0,5 mL (ÄP) bzw. 1 mL (HÄP) auseinander, meldet die App eine Datenlücke.
- **Bereich:** Bürettenskala 0–50 mL oder Messbereich (auf 5 mL gerundet, verrät keinen ÄP).
- **Nach der Abgabe zuschaltbar:** Modellreferenz, Literatur-pK und Näherungswerte. Die Legende unterscheidet Messreihe, Interpolation, Näherungsrechnung und Modellreferenz.

### Laborjournal

1. V(ÄP) aus der Stöchiometrie
2. Erstdurchgang: Marker, Endpunkt, Anfangs-/Endstand, Verbrauch und Indikatorprüfung
3. Zielvolumen V(HÄP) mit gewählter Rechenbasis (gemessen, stöchiometrisch, bei Stufe 2 auch „abgeleitet“)
4. pH am HÄP und experimenteller pK-Wert → **Ergebnis abgeben**
5. Nach der Freigabe: Literaturwerte und theoretische pH-Werte
6. Abweichungen ΔpK und ΔpH mit Vorzeichen; Zerlegung der Abweichung
7. Fehlerbetrachtung zum Ankreuzen mit Rückmeldung aus den eigenen Daten, dazu eine freie Begründung (wird nicht bewertet)

Jedes Feld hat „Prüfen“ (auch mit der Eingabetaste) und „Tipp 1/3 … 3/3“: Denkimpuls, Ansatz und eine Musterrechnung mit den eigenen Daten. Die Musterrechnung gibt es nach einem eigenen Versuch, sonst nur nach Rückfrage. Die Rückmeldungen sind gekennzeichnet als Rechnung, Messung/Durchführung oder Näherung.

**Eingaben:**

- Dezimalkomma oder -punkt; Volumina auch mit Einheit (mL, cm³, L)
- pH- und pK-Werte ohne Einheit

**Toleranzen:**

- Volumenrechnung ± 0,01 mL
- Bürettenablesung ± 0,02 mL
- pK aus pH ± 0,01
- theoretische pH-Werte ± 0,03

**Bericht:** öffnet den Druckdialog (auch „als PDF speichern“) mit Planung, Kurve, Messdaten, Markern, Rechnungen, freigegebenen Referenzen und Fehlerbetrachtung. Vor der Abgabe enthält er keine Literaturwerte.

**CSV-Export:** nur Messdaten.

**Hefteintrag:** Zusammenfassung zum Abschreiben, unabhängig vom eigenen Versuch.

## Speicherung

Alles bleibt in `localStorage` dieses Browsers (Schlüssel `sivex-halbtitration-v1`); es werden keine Daten übertragen. Ist das Speichern nicht möglich, etwa im privaten Modus, bleibt die App bedienbar und zeigt einen Hinweis an. Fallende Tropfen gelten beim Neuladen als angekommen.

## Für Tests

`index.html?speed=25` beschleunigt die Laborzeit (Pipettieren, Tropfen, Mischen, Ansprechzeit) für automatische Tests. Für den Unterricht ist dieser Parameter nicht vorgesehen.
