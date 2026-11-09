# Reihe „Chemisches Gleichgewicht“ – Planung

Stand: 09.11.2026 · drei Apps, die aufeinander aufbauen · Zielgruppe: Chemie Jgst. 10–13 (Gymnasium)

| App | Verzeichnis | Rolle in der Reihe | Ebene |
| --- | --- | --- | --- |
| **Stechheber** | `apps/stechheber/` | Modellexperiment mit Wasser: kontinuierliche Mengen, exakt berechenbar | **Stoffebene** (Analogie) |
| **Apfelkrieg** | `apps/apfelkrieg/` | Modellexperiment mit einzelnen Objekten: Zufall, Schwankungen, Zählen | **Teilchenebene** (Analogie) |
| **Estergleichgewicht** | `apps/ester-gleichgewicht/` | echte Reaktion: Ethansäure + Ethanol ⇌ Ester + Wasser, K ≈ 4 | **beide Ebenen nebeneinander** |

Voraussetzung bei den Lernenden: das Massenwirkungsgesetz und die Gleichgewichtskonstante K sind bekannt. Alle drei Apps zeigen deshalb von Anfang an den Quotienten Q und seine Annäherung an K. Das Prinzip von Le Chatelier wird in der Reihe erst **erarbeitet** – die Apps liefern die Beobachtung, die Regel formulieren die Lernenden.

## 1. Gemeinsame Kriterien für alle drei Apps

Die Kriterien ergänzen die verbindlichen Regeln in [`QUALITY.md`](QUALITY.md) (Gestaltung, iPad-Bedienregeln, Lern- und Auswertungsstruktur, Hefteintrag) und [`MEBIS.md`](MEBIS.md). Sie gelten für alle Schritte aller drei Apps; Abweichungen werden im Testbericht begründet.

### G1 – Ebene immer sichtbar

- Jede Ansicht trägt oben links ein **Ebenen-Etikett**: „Stoffebene – Modell“, „Teilchenebene – Modell“ oder in der Ester-App „Stoffebene – messbar“ und „Teilchenebene – Modell“.
- Einheitliche Kennfarben in allen drei Apps: **Stoffebene blau umrahmt**, **Teilchenebene violett umrahmt**. Die Farbe ist Zusatz, das Etikett trägt die Information.
- Ein Satz unter dem Bild erklärt die Verbindung: *Die glatte Kurve ist der Mittelwert über unvorstellbar viele Teilchen; die Teilchenansicht zeigt Einzelereignisse.* (Ester-App; in den Modell-Apps der jeweilige Modellhinweis.)

### G2 – Zeit-Mengen-Diagramm

- Mengen über der Zeit (Stechheber: Zyklen, Apfelkrieg: Sekunden, Ester: Tage bzw. Stunden).
- **Linke Seite / Edukte in Rot, rechte Seite / Produkte in Blau** – in allen drei Apps gleich. Linien zusätzlich beschriftet (nicht nur farbig).
- Sobald sich die Mengen nicht mehr ändern, erscheint eine **senkrechte gestrichelte Linie „Gleichgewicht“**; danach laufen die Kurven waagrecht weiter.
- Eingriffe (Schritt 3) setzen eine **Marke** im Diagramm mit Kurzbeschriftung.
- Baustein: `shared/labkit/js/chart.js` (`createChart`): Achsen, Reihen, Referenzlinien, Marken, HiDPI. Keine Chemie im Baustein.

### G3 – Hin und Rück als Balkenpaar

- Neben dem Diagramm steht ein **Balkenpaar „pro Zeiteinheit“**: links Hinrichtung (rot), rechts Rückrichtung (blau), mit Zahl.
- Das ist der Kern von *dynamisch*: Die Balken werden gleich hoch, obwohl weiter übertragen bzw. umgesetzt wird. Die Mengen stehen – die Vorgänge nicht.
- Beim Apfelkrieg und auf der Ester-Teilchenebene schwanken die Balken sichtbar (gleitender Mittelwert über wenige Sekunden). Das ist gewollt und wird in der Modellkritik aufgegriffen.

### G4 – Q und K

- Eine **Q-Anzeige** läuft live mit (Stechheber V_B/V_A, Apfelkrieg N_Opa/N_Enkel, Ester n(E)·n(W)/(n(S)·n(A))). Erreicht das System das Gleichgewicht, wird Q als K beschriftet.
- Die Formel steht in der Anzeige ausgeschrieben, damit der Bezug zum MWG sichtbar bleibt.
- K hängt in jeder App nur von den „Naturkonstanten“ des Modells ab (Rohrdurchmesser, Wurfraten, k₁/k₋₁), nie von den Startmengen. Das ist die zentrale Erkenntnis der Schritte 2.

### G5 – Start von beiden Seiten

- Jede App kann **„von links“, „von rechts“ oder gemischt** starten (Stechheber: Wasser in A oder B; Apfelkrieg: 18+0, 0+18, 9+9; Ester: Synthese 1/1/0/0, Hydrolyse 0/0/1/1).
- Ab Schritt 2: zwei Läufe lassen sich als **Vergleichslauf** überlagern (gestrichelte Zweitkurven). So sehen die Lernenden: dasselbe Gleichgewicht von beiden Seiten.

### G6 – Eingriffe nach Le Chatelier (Schritt 3)

- Einheitliches **Eingriffs-Panel** mit denselben Schaltflächen-Mustern: *Zugeben*, *Entnehmen*, *Beschleunigen (Katalysator)*, *K ändern*.
- Jeder Eingriff setzt die Marke im Diagramm (G2). Die Deutung („Zwang … → Verschiebung nach …“) ist eine **Aufgabe im Lernweg**, kein automatischer Text: Erst beobachten, dann formulieren, dann mit der Lösung vergleichen.
- Katalysator-Analogie in jeder App: *beide* Richtungen gleichermaßen schneller, Lage von K unverändert (vgl. Diagramm „mit/ohne Katalysator“).
- Nur Eingriffe, die im Modell ehrlich sind: Beim Ester keine Temperaturverschiebung (nahezu thermoneutral) und kein Druck (keine Gase) – höchstens als Hinweis „hier kaum Wirkung“.

### G7 – Modellkritik

- Jede App hat eine Karte **„Was das Modell zeigt – und was nicht“** (Reiter „Modell“). Mindestens: Analogie ↔ Chemie, was im Modell fehlt (Stechheber/Apfelkrieg: keine Stoffumwandlung), was übertrieben ist (kleine Zahlen → Schwankungen).
- Die Hefteinträge der drei Apps bauen aufeinander auf und verwenden dieselben Fachbegriffe: *dynamisches Gleichgewicht, Hin- und Rückreaktion, Gleichgewichtskonstante K, Massenwirkungsgesetz, Prinzip von Le Chatelier (Schritt 3)*.

### G8 – Zeitsteuerung

- Bedienmuster in allen drei Apps gleich: **Schritt** (ein Zyklus / eine Zeiteinheit), **Start/Pause**, **Tempo** (1×, 3×, 10×), **Neu starten**. Pause blockiert nie (QUALITY, iPad-Regel 4).
- Feste Zeitschritte über `LK.core.createClock`; Tempo ändert nur die Geschwindigkeit, nie das Ergebnis. Stochastische Modelle (Apfelkrieg, Ester-Teilchen) laufen mit festem Startwert (`seed`), damit ein Lauf wiederholbar ist; „Nochmal würfeln“ zieht einen neuen Startwert.

### G9 – Lern- und Auswertungsstruktur

- Lernweg in **drei Schritten** je App, die den Entwicklungsschritten entsprechen: **1 Beobachten**, **2 Deuten (K, von beiden Seiten)**, **3 Eingreifen (Le Chatelier)**. Geschlossene Formate, Rückmeldung je Feld, Tipp 1/3–3/3, Lösung auf Anforderung – Mechanik aus `shared/labkit/js/learn.js`, Inhalte in `js/tasks.js` jeder App.
- Reiter im Bedienfeld: **Versuch · Aufgabe · Modell · Hefteintrag** (Ester zusätzlich **Tabelle**). Im Reiter „Versuch“ liegen die Einstellungen (Rohre bzw. Wahrscheinlichkeiten, Startmengen, Ablesen); die Zeitsteuerung steht unter der Bühne.
- Hefteintrag: etwa 100 Wörter plus Gleichung bzw. MWG; unabhängig vom eigenen Lauf.

### G10 – Technik und Status

- Labkit ≥ 0.3.0, Splitter, SCORM-1.2-Adapter, offline lauffähig, Build-Prüfung auf externe Ressourcen (Skripte aus `apps/aggregatzustaende/scripts/` übernommen).
- iPad 8. Generation quer ist die Referenzgröße: Bühne und Diagramm teilen sich den Platz, nichts liegt über dem Bild, Touchziele 44 px.
- Status: nach Schritt 1 `prototype 0.1.x` (Erstentwurf, mebis-Import zum Ausprobieren), nach Schritt 2 `0.2.x` mit iPad-Test, nach Schritt 3 `0.3.x`; `ready` erst nach fachlicher Prüfung, iPad- und mebis-Test ([`QUALITY.md`](QUALITY.md)).
- Reihenfolge der Entwicklung: Stechheber → Apfelkrieg → Ester. Jeder Schritt wird für alle drei Apps abgeschlossen, bevor der nächste beginnt, damit das gemeinsame Gerüst (G2–G4, G8, G9) überall gleich bleibt.

## 2. Modelle und Festlegungen

### Stechheber

- Zwei Standzylinder A und B (Querschnitt Q), zwei Rohre a und b (Querschnitte q_a, q_b). Ein Rohr, bis zum Boden eingetaucht, nimmt den Anteil **f = q/Q** des Volumens mit. Pro Zyklus: ΔV(A→B) = f_a·V_A, ΔV(B→A) = f_b·V_B.
- Gleichgewicht bei f_a·V_A = f_b·V_B, also **K = V_B/V_A = f_a/f_b = (d_a/d_b)²** – dieselbe Struktur wie k₁·c(Edukt) = k₋₁·c(Produkt).
- Standardwerte: D = 25 mm, d_a = 10 mm, d_b = 7 mm → f_a = 0,16, f_b = 0,078, K ≈ 2,0. Start: 80 mL in A.
- Begrenzung: f_a + f_b ≤ 0,4, sonst schwingt das Modell (Abweichung schrumpft pro Zyklus um 1 − f_a − f_b). Verdrängung durch die Rohrwand vernachlässigt (Modellkritik).
- Le Chatelier (Schritt 3): Wasser in A nachgießen / aus B entnehmen (Konzentration), beide Rohre im gleichen Verhältnis dicker (Katalysator), Verhältnis ändern (K ändert sich).

### Apfelkrieg

- Zwei Felder (Großvater links, Enkel rechts). Jeder Apfel wird pro Zeitschritt mit einer Wahrscheinlichkeit **p** auf das Nachbarfeld geworfen: p_Opa für Äpfel auf dem Feld des Großvaters (fliegen zum Enkel), p_Enkel für Äpfel beim Enkel (fliegen zum Großvater). Das ist stochastische Kinetik erster Ordnung: **K = N_Opa/N_Enkel = p_Enkel/p_Opa**.
- Standard: p_Opa = 0,05, p_Enkel = 0,10 je Schritt von 0,5 s → K = 2, bei 18 Äpfeln im Mittel 12 : 6 wie in der Vorlage. Die Figuren sind Animation; die Rate hängt nur von der Apfelzahl ab (Begründung in der Geschichte: Wer weniger Äpfel herumliegen hat, kommt seltener zum Werfen).
- Startoptionen: 9 + 9, 18 + 0, 0 + 18, eigene Zahlen (bis 60). „Nochmal würfeln“ zeigt, dass das Gleichgewicht schwankt (12 : 6, 13 : 5, 11 : 7).
- Le Chatelier (Schritt 3): Nachbar kippt einen Korb Äpfel auf ein Feld (Konzentration), bessere Schuhe für beide (Katalysator), Opa wird müde (nur p_Opa; K ändert sich).

### Estergleichgewicht

- Ethansäure + Ethanol ⇌ Ethansäureethylester + Wasser, **K = 4** (ergibt die 0,67/0,33 mol der Vorlage: x²/(1−x)² = 4 → x = 2/3).
- Stoffebene: dn/dt = k₁·n(S)·n(A) − k₋₁·n(E)·n(W) mit k₁/k₋₁ = 4, Integration mit RK4 (glatte Kurven, kein Knick). Zeitachse in **Tagen ohne**, in **Stunden mit Katalysator** (Faktor 50 in beiden Richtungen).
- Darstellung wie die Vorlage: Synthese (Start 1/1/0/0) und Hydrolyse (Start 0/0/1/1) laufen auf dieselben Werte zu; Tabelle „Start / Gleichgewicht“ füllt sich mit.
- Teilchenebene: 20 + 20 Teilchen (Kalottensymbole, schematisch). **Kein Stoßphysik-Modell**, sondern hybrid: Reaktionsereignisse werden stochastisch aus denselben Ratengesetzen gezogen (Wahrscheinlichkeit pro Zeitschritt ∝ Teilchenzahlen), erst dann wird ein passendes Paar zum Zusammenstoß mit Aufblitzen animiert. K stimmt im Mittel, die Zahlen schwanken sichtbar.
- Le Chatelier (Schritt 3): Ethanol oder Wasser zugeben, Ester abdestillieren, Wasser entziehen (konz. H₂SO₄), Katalysator an/aus. Temperatur nur als Hinweis „kaum Wirkung“ (nahezu thermoneutral); Druck entfällt.
- Ausblick (nicht Teil der Reihe): Probenahme mit Titration der Säure im TitraLab – Kopplung erst nach Schritt 3 prüfen.

## 3. Drei Entwicklungsschritte je App

Jeder Schritt ist eine eigene Version, eigenständig testbar und als SCORM-Paket für mebis nutzbar. Die Schritte sind für die drei Apps gleich aufgebaut.

### App 1 – Stechheber

| Schritt | Version | Inhalt | Fertig, wenn |
| --- | --- | --- | --- |
| **1 Beobachten** | 0.1.0 | Modell (f_a, f_b), Bühne mit zwei Standzylindern und zwei Rohren, Zyklus-Animation (eintauchen – heben – tauschen – ablassen), Schritt/Start/Pause/Tempo, Regler für d_a, d_b, Startvolumen A und B, Diagramm V(Zyklus), Balkenpaar übertragen A→B/B→A, Q-Anzeige, Lernschritt 1 (Lückentext zur Beobachtung), Hefteintrag-Rohfassung, Modellkarte | Build + SCORM-Paket, Mengenbilanz exakt, Gleichgewicht nach ≤ 40 Zyklen bei Standardwerten, Unit-Tests für Modell |
| **2 Deuten** | 0.2.0 | Start in A, in B oder gemischt; Vergleichslauf (zweiter Lauf gestrichelt); K-Anzeige mit Formel K = f_a/f_b = (d_a/d_b)²; Lernschritt 2 (K hängt nicht von der Startmenge ab; dynamisch = Balken gleich, Mengen konstant); Messzylinder-Ablesung für ein Protokoll zum Realexperiment | iPad-Test (Querformat), Protokolltabelle, Modellkritik vollständig |
| **3 Eingreifen** | 0.3.0 | Eingriffs-Panel: Wasser in A nachgießen, aus B entnehmen, beide Rohre dicker (Katalysator), Verhältnis ändern; Marken im Diagramm; Lernschritt 3 (Zwang → Verschiebung formulieren); Hefteintrag mit Le Chatelier | Testbericht, mebis-Import, fachliche Prüfung → Freigabe-Pfad |

### App 2 – Apfelkrieg

| Schritt | Version | Inhalt | Fertig, wenn |
| --- | --- | --- | --- |
| **1 Beobachten** | 0.1.0 | Stochastisches Modell mit festem Startwert, zwei Felder mit Äpfeln und Figuren, Wurf-Animation, Startoptionen 9+9 / 18+0 / 0+18 / eigene, Schritt/Start/Pause/Tempo, Diagramm N(t), Balkenpaar Würfe pro 10 s, Q-Anzeige, Lernschritt 1 (Beobachtung: Zahlen schwanken, pendeln sich ein), Hefteintrag-Rohfassung, Modellkarte | Build + SCORM-Paket, Apfelzahl bleibt erhalten, Mittelwert im Gleichgewicht ≈ K, Unit-Tests für Modell und Zufallsgenerator |
| **2 Deuten** | 0.2.0 | „Nochmal würfeln“ und Vergleichslauf; Regler für die Apfelzahl (18 → 180) zeigt kleinere relative Schwankungen; K = p_Enkel/p_Opa mit Formel; Lernschritt 2 (Verhältnis statt Differenz, Zufall vs. Mittelwert, Brücke zur Teilchenzahl) | iPad-Test, Modellkritik vollständig |
| **3 Eingreifen** | 0.3.0 | Eingriffs-Panel: Korb Äpfel auf ein Feld kippen, Äpfel wegnehmen, bessere Schuhe für beide (Katalysator), Opa wird müde (K ändert sich); Marken; Lernschritt 3; Hefteintrag mit Le Chatelier | Testbericht, mebis-Import, fachliche Prüfung |

### App 3 – Estergleichgewicht

| Schritt | Version | Inhalt | Fertig, wenn |
| --- | --- | --- | --- |
| **1 Beobachten** | 0.1.0 | Kinetik mit RK4 (K = 4), Stoffebene: Kolben mit Flüssigkeit, Mengenbalken der vier Stoffe, Diagramm n(t) wie Vorlage mit 0,33/0,67-Linien und Gleichgewichtsmarke; Teilchenebene: hybrides Teilchenmodell mit Stoßanimation und Balkenpaar erfolgreicher Stöße; Umschalter Stoff/Teilchen/beide; Start Synthese/Hydrolyse; Katalysator an/aus (Tage ↔ Stunden); Tabelle Start/Gleichgewicht; Q-Anzeige mit MWG; Lernschritt 1; Hefteintrag-Rohfassung; Modellkarte | Build + SCORM-Paket, Gleichgewichtswerte 0,33/0,67 ± 0,01, Teilchenzahl 40 konstant, Unit-Tests für Kinetik |
| **2 Deuten** | 0.2.0 | Vergleichslauf Synthese ↔ Hydrolyse übereinander, eigene Startmengen, K-Anzeige mit vollständigem MWG, Lernschritt 2 (K unabhängig vom Start; Stoff- vs. Teilchenebene: glatte Kurve = Mittelwert) | iPad-Test (zwei Spalten im Querformat), Tabelle vollständig |
| **3 Eingreifen** | 0.3.0 | Eingriffs-Panel: Ethanol/Wasser zugeben, Ester abdestillieren, Wasser entziehen, Katalysator; Marken; Hinweis „Temperatur: kaum Wirkung“; Lernschritt 3; Hefteintrag mit Le Chatelier und Ausbeutesteigerung | Testbericht, mebis-Import, fachliche Prüfung; danach Kopplung an TitraLab prüfen |

## 4. Stand der Umsetzung

| App | Schritt 1 | Schritt 2 | Schritt 3 |
| --- | --- | --- | --- |
| Stechheber | **0.1.0 am 09.11.2026** – Erstentwurf, SCORM-Paket in `apps/stechheber/release/` | offen | offen |
| Apfelkrieg | **0.1.0 am 09.11.2026** – Erstentwurf, SCORM-Paket in `apps/apfelkrieg/release/` | offen | offen |
| Estergleichgewicht | **0.1.0 am 09.11.2026** – Erstentwurf, SCORM-Paket in `apps/ester-gleichgewicht/release/` | offen | offen |

Gemeinsames Gerüst: Labkit 0.3.0 (`js/chart.js`, `js/learn.js`, Ebenen-Etikett). Die Lernschritte 2 und 3 sind in jeder App bereits als gesperrte Chips sichtbar, damit der Weg erkennbar ist.

## 5. Offene Fragen für die fachliche Prüfung

1. Stechheber: Sollen Rohrdurchmesser in mm oder direkt als „Anteil“ f eingestellt werden? (Entwurf: mm, Anteil wird angezeigt.)
2. Apfelkrieg: Stimmen 0,5 s je Schritt und 18 Äpfel als Standard mit dem Unterrichtsspiel überein?
3. Ester: Reicht K = 4 als Lehrbuchwert, oder soll der Wert einstellbar sein (3,5–4,5), um Messwerte aus dem Unterricht nachzustellen?
4. Reihenfolge im Unterricht: Stechheber vor Apfelkrieg (kontinuierlich vor diskret) oder umgekehrt?
