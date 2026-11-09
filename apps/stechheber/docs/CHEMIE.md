# Stechheber – fachliche Grundlage und Modellgrenzen

## Modell

Zwei Zylinder mit gleichem Innendurchmesser D = 25 mm, zwei Rohre mit Innendurchmessern d_a, d_b (4–12 mm). Ein bis zum Boden eingetauchtes, oben verschlossenes Rohr hebt eine Wassersäule der Höhe des Wasserstands an. Bei gleichem Wasserstand h gilt für das Rohr V_Rohr = q·h und für den Zylinder V = Q·h, also

    V_Rohr = (q/Q) · V = f · V      mit  f = (d/D)²

Pro Zyklus: ΔV(A→B) = f_a·V_A, ΔV(B→A) = f_b·V_B. Im Gleichgewicht f_a·V_A = f_b·V_B und damit

    K = V_B / V_A = f_a / f_b = (d_a / d_b)²

Standard: d_a = 10 mm, d_b = 7 mm → f_a = 0,160, f_b = 0,078, K = 2,04. Mit 80 mL Gesamtmenge: V_A ≈ 26 mL, V_B ≈ 54 mL.

## Analogie

| Modell | Chemie |
| --- | --- |
| V_A, V_B | c(Edukte), c(Produkte) |
| f_a, f_b | k₁, k₋₁ (Geschwindigkeitskonstanten) |
| f_a·V_A = f_b·V_B | v_hin = v_rück |
| K = f_a/f_b | K = k₁/k₋₁ (Reaktion 1. Ordnung in beide Richtungen) |

## Konvergenz

Die Abweichung vom Gleichgewicht schrumpft pro Zyklus um den Faktor (1 − f_a − f_b). Für f_a + f_b ≥ 1 würde das Modell schwingen; die App begrenzt f_a + f_b auf 0,4 (bei D = 25 mm: Σ d² ≤ 250 mm²). Das Gleichgewicht gilt als erreicht, wenn sich die Volumina drei Zyklen lang um weniger als 0,05 mL ändern (bei Standardwerten nach etwa 30 Zyklen).

## Vernachlässigt

- Verdrängung durch die Rohrwand (Wasserstand steigt beim Eintauchen leicht).
- Benetzung, Tropfenverlust, Oberflächenspannung.
- Das Realexperiment mit zwei Messzylindern und zwei Glasrohren unterschiedlichen Durchmessers liefert bei sorgfältigem Arbeiten dieselbe Struktur, aber keine exakten Anteile.

## Nicht Teil des Modells

Es findet keine Stoffumwandlung statt; Wasser wechselt nur den Ort. Temperatur und Druck haben keine Entsprechung. Die Analogie zum Katalysator (beide Rohre proportional dicker: schneller ins gleiche Gleichgewicht) und zu Konzentrationsänderungen (Nachgießen/Entnehmen) folgt in Schritt 3.
