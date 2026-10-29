# Bedienung (ab 0.2.0)

Die App startet direkt im Labor:

- **Kopfzeile:** Hefteintrag, Bericht, Zurücksetzen und Bedienfeld ein/aus.
- **Laborbühne (links):** Titrierstand und Titrationskurve stehen nebeneinander, darunter die Dosierleiste.
- **Trennlinie:** Sie lässt sich mit Maus, Finger oder Pfeiltasten verschieben; ein Doppelklick stellt die Standardbreite wieder her.
- **Bedienfeld (rechts):** Reiter **Aufgabe · Ergebnisse · Hefteintrag**.

Messreihen, Eingaben und Antworten bleiben beim Wechsel von Versuch oder Reiter erhalten und werden lokal im Browser gespeichert.

## Versuch wählen

Über der Bühne stehen vier Versuche:

- **1 Essigsäure (Kern)**
- **2 Ammoniak (Transfer)**
- **3 Phosphorsäure (Vertiefung)**
- **4 Glycin (Vertiefung)**

Jeder Versuch ist direkt anwählbar, es gibt keine Sperre. Daneben stehen drei Knöpfe:

- **Neue Probe (vollständig)** und **Neue Probe (Halbtitration)** leeren nur den Kolben. Gespeicherte Messreihen, Rechnungen, Bürettenfüllung und Kalibrierung bleiben erhalten.
- **Reihe wiederholen** verwirft nur die aktive Messreihe und setzt eine frische Probe für denselben Zweck an.
- **Zurücksetzen** in der Kopfzeile löscht nach Rückfrage das gesamte Labor.

## Labor

### Vorbereitung (ab 0.2.1 nummeriert, von links nach rechts)

Der nächste offene Schritt ist blau hervorgehoben. Erledigte Schritte erscheinen nach dem Einklappen als ✓-Chips; über „Vorbereitung“ klappst du sie wieder auf.

1. **Bürette: Natronlauge | Salzsäure.** Hier wählst du die Maßlösung. Die richtige Wahl spült, füllt und entlüftet die Bürette; eine falsche Wahl gibt eine Rückmeldung, die Bürette bleibt leer. Es gibt je eine Bürette für NaOH und für HCl; ihr Stand bleibt für alle Proben erhalten. **Nachfüllen** geht zwischen zwei Proben.
2. **pH-Meter kalibrieren:** einmal für alle Versuche, Zwei-Punkt-Kalibrierung.
3. **Probe vorlegen:** 20,00 mL pipettieren, danach automatisch mit 30 mL Wasser verdünnen.
4. **Indikator (freiwillig):** Auswahl und „zugeben“. Der Knopf bleibt auch in der eingeklappten Vorbereitung sichtbar, solange die Probe keinen Indikator hat.
5. **Rührer einschalten.**
6. **Elektrode eintauchen:** je Probe.

### Messen

Die Anzeige zeigt V zugegeben, den Bürettenstand (digital abgelesen) und den pH-Wert mit Status (stabil, misst, Zugabe, ohne Rühren).

- **Dosiermenge:** 1 Tropfen (0,05 mL) bis 2,00 mL, dann **Zugeben** (Taste **D**).
- **Hahn öffnen/schließen:** kontinuierlicher Fluss (Taste **H** oder Antippen des Hahns im Bild); die Tropfgeschwindigkeit stellst du am Schieberegler ein.
- **Messpunkte entstehen automatisch** (ab 0.2.2), sobald die Anzeige stabil ist: beim Eintauchen der Elektrode (Startpunkt bei 0 mL), nach jeder Zugabe bzw. nach dem Schließen des Hahns und nach dem Ein-/Ausschalten des Rührers. Die Kurve wächst beim Titrieren mit. Ein neuer Wert beim gleichen Volumen ersetzt den alten.
- Ohne Rühren mischt die Lösung nur langsam; der Punkt entsteht dann erst später und kann als „nicht durchmischt“ gekennzeichnet sein.
- **Rührer** (links in der Messzeile), **Endpunkt notieren** (nur mit Indikator), **Zielmarke** (nur bei der Halbtitration). Ein automatischer Stopp am Ziel erfolgt nicht.

### Kurve

- **Volumenachse:** 0–50 mL (Bürettenskala) oder **Messbereich**, auf 5 mL gerundet.
- **Marker ÄP:** erscheint, sobald eine Titrationskurve vorliegt. Antippen oder Ziehen setzt den Marker; die Pfeiltasten verschieben ihn um 0,05 mL (mit Umschalt um 0,5 mL). „Fertig“ beendet den Markermodus.
- **Nach der Abgabe:** Modellreferenz, Literatur-pKₛ und Näherungswerte. Bei Ammoniak erscheint auf der pH-Achse nur pKₛ(NH₄⁺), kein pK_B.

## Aufgabe (Schritte)

Der jeweils nächste offene Schritt ist aufgeklappt. Alle Schritte lassen sich jederzeit öffnen, eine feste Klickfolge gibt es nicht.

1. **Auftrag und Maßlösung:** kurzer Auftrag und Ausgangsdaten. Die Maßlösung wählst du an der Bürette; das Bedienfeld zeigt, ob die Wahl passt, und bietet Tipps. Grundlagen gibt es als freiwillige Hilfe.
2. **Titrationskurve und Äquivalenzpunkt:** Marker setzen oder V(ÄP) eintragen. Die Prüfung erfolgt an deiner eigenen Kurve: Liegt der Marker im steilsten Abschnitt? Freiwillig kannst du V(ÄP) mit der Stöchiometrie kontrollieren, mit absoluter und relativer Abweichung und benannter Referenz.
3. **Halber Umsatz:** wenige geschlossene Fragen; bei mehrprotonigen Säuren auch zur zweiten Stufe.
4. **Zielvolumen berechnen:** Rechenbasis wählen (eigener ÄP, berechnet oder bei Stufe 2 abgeleitet) und V(HÄP) eintragen.
5. **Gezielt halbtitrieren:** frische Probe, Zielmarke, selbst dosieren, pH-Wert am HÄP aus der eigenen Messreihe eintragen.
6. **Warum gilt das? (MWG):** ein Trainer in Schritten. Jeder Schritt erscheint erst, wenn der vorige gelöst ist. Die Henderson-Hasselbalch-Gleichung gibt es als Vertiefung.
7. **Eigenen pK-Wert bestimmen und abgeben:**
   - Die Abgabe setzt ein eigenes Zielvolumen und einen protokollierten Messpunkt der Halbtitration voraus.
   - Mängel werden gekennzeichnet, etwa neben dem Ziel, zu früh abgelesen, nicht durchmischt oder Rechnung unpassend.
   - **Lösung anzeigen** zeigt die Musterlösung. Sie wird als „Musterlösung angesehen“ gespeichert und zählt nicht als eigener Versuch.
8. **Vergleichen und deuten** (nach Abgabe): Literaturwert, ΔpK mit Vorzeichen und eine knappe Fehlerdeutung zum Ankreuzen. Die Rückmeldung stammt aus den eigenen Daten.

Die **Vertiefung (freiwillig)** enthält:

- Reaktionsfolge (schematisch)
- Gleichgewichtsanteile aus dem Modell, nach der Abgabe
- Wiederholung: Start-, HÄP- und ÄP-pH berechnen, mit ΔpH
- Indikatoren untersuchen
- Zerlegung der Abweichung

### Prüfen und Hilfen

Jedes Feld und jede Frage hat **Prüfen** (bei Feldern auch die Eingabetaste) und **Tipp 1/3 … 3/3**: Denkanstoß, Ansatz, Musterrechnung bzw. Antwort. Tipp 3 wird nach einem eigenen Versuch empfohlen, sonst erst nach einer Rückfrage.

Ändert sich eine Eingabe oder eine ihrer Grundlagen, steht beim Feld **„Geändert – erneut prüfen“**. Grundlagen sind Marker, Rechenbasis, die ausgewählte Messreihe und deren Messpunkte. Eine alte Bestätigung gilt dann nicht mehr.

**Eingaben:**

- Dezimalkomma oder -punkt; Volumina auch mit Einheit (mL, cm³, L)
- pH- und pK-Werte ohne Einheit

## Ergebnisse, Bericht, Hefteintrag

- **Ergebnisse:** eine Karte je Versuch und Stufe mit:
  - ÄP und Herkunft (Kurve oder abgeleitet)
  - Ziel- und Messvolumen
  - pH mit Status
  - abgegebenem pK-Wert und späterer Korrektur
  - nach der Freigabe Literaturwert und ΔpK
  - Kennzeichnungen wie Musterlösung oder ein aus 0.1.0 übernommener Wert
- **Bericht:** Druckdialog, auch „als PDF speichern“. Er enthält Aufgabe, Kurve, Messdaten, Rechnungen, Abgabe, freigegebene Referenzen und die Fehlerdeutung. Vor der Freigabe enthält er keine Literaturwerte.
- **CSV:** nur Messdaten.
- **Hefteintrag:** etwa 100 Wörter, unabhängig vom eigenen Versuch.

## Speicherung

Die Daten liegen in `localStorage` unter dem Schlüssel `sivex-halbtitration-v2`. Ein Stand aus 0.1.0 (`…-v1`) wird beim ersten Start übernommen:

- Messreihen, Marker und Eingaben bleiben erhalten.
- Frühere Prüfungen müssen erneut ausgeführt werden.
- Eine alte Abgabe bleibt sichtbar, schaltet aber nichts frei.

Ist Speichern nicht möglich, bleibt die App bedienbar und zeigt einen Hinweis an. Es werden keine Daten übertragen.

## Für Tests

`index.html?speed=25` beschleunigt die Laborzeit. Das ist nur für automatische Prüfungen gedacht.
