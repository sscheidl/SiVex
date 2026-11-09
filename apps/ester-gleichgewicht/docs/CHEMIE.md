# Estergleichgewicht – fachliche Grundlage und Modellgrenzen

## Reaktion und Gleichgewicht

    CH₃COOH + C₂H₅OH  ⇌  CH₃COOC₂H₅ + H₂O        K ≈ 4 (Lehrbuchwert, 25 °C)

Für 1 mol + 1 mol gilt im Gleichgewicht x²/(1−x)² = 4 → x = 2/3: n(Ester) = n(Wasser) = 0,67 mol, n(Säure) = n(Alkohol) = 0,33 mol – die Werte der Vorlage. Dasselbe Gleichgewicht stellt sich von der Produktseite (Hydrolyse) ein.

## Kinetik der Stoffebene

Geschlossenes System bei konstantem Volumen; mit Stoffmengen statt Konzentrationen (V konstant):

    v_hin = k₁ · n(S) · n(A)        v_rück = k₋₁ · n(E) · n(W)        k₁ / k₋₁ = K

    dn(S)/dt = dn(A)/dt = −(v_hin − v_rück)        dn(E)/dt = dn(W)/dt = +(v_hin − v_rück)

Integration mit Runge-Kutta 4. Ordnung, Schrittweite ≤ 0,02 d (mit Katalysator entsprechend kleiner). k₁ = 0,8 pro (mol·Tag) ist ein Anschauungswert, der das Gleichgewicht ohne Katalysator nach etwa 10 Tagen erreicht; mit Katalysator werden beide Konstanten verfünfzigfacht (Stunden). Reale Zeiten hängen stark von Temperatur und Katalysatormenge ab und sind nicht Gegenstand der App.

Allgemeine Gleichgewichtslösung für beliebige Startmengen (a, b, c, d): (c+x)(d+x) = K·(a−x)(b−x), quadratische Gleichung in x – die App zeigt die erwarteten Werte als Referenzlinien.

Gleichgewicht gilt als erreicht, wenn der Nettoumsatz pro Tag (ohne Katalysatorfaktor) unter 2·10⁻⁴ mol liegt.

## Teilchenebene (hybrides Modell)

40 Teilchen (20 je mol). Kein Stoßphysik-Modell: Ob in einem Zeitschritt eine Hin- oder Rückreaktion stattfindet, wird mit den Wahrscheinlichkeiten κ·N(S)·N(A)·Δt bzw. (κ/K)·N(E)·N(W)·Δt gewürfelt (κ = 0,012 s⁻¹). Erst dann wird ein zufälliges Paar zum Zusammenstoß animiert (Annäherung 0,55 s, Aufblitzen 0,25 s) und paarweise umgewandelt: Säure + Alkohol → Ester + Wasser oder umgekehrt. Teilchenzahl und Sortenbilanz bleiben exakt erhalten. Mittelwert im Gleichgewicht: 6,7 : 6,7 : 13,3 : 13,3 mit sichtbaren Schwankungen. Die Teilchenzeit (Sekunden) ist von der Stoffzeit (Tage) entkoppelt; der Katalysator verdreifacht die Ereignisrate (Veranschaulichung, nicht ×50, damit es sichtbar bleibt).

Die Symbole (Säure rot mit heller Gruppe, Alkohol orange mit heller Gruppe, Ester aus beiden Teilen mit blauem Ring, Wasser klein blau) sind Veranschaulichung und keine Molekülstrukturen; sie zeigen, dass der Ester aus Teilen von Säure und Alkohol entsteht.

## Vereinfachungen

- Volumen, Dichte und Temperatur konstant; keine Nebenreaktionen; der Katalysator wird nicht als Stoff mitgeführt.
- Keine Aktivitäten; K als Stoffmengenverhältnis bei gleichem Volumen.
- Esterbildung nahezu thermoneutral (ΔH ≈ −3 kJ/mol): Temperatur verschiebt das Gleichgewicht kaum; Druck ohne Gasphase ohne Wirkung. Deshalb bietet die App diese Eingriffe nicht an. Le Chatelier (Schritt 3) über Konzentrationen: Zugabe, Abdestillieren des Esters, Wasserentzug.

## Ausblick

Probenahme und Titration der Säure (Kopplung an TitraLab) nach Schritt 3; dabei den mittitrierten Katalysator berücksichtigen.
