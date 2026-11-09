# Apfelkrieg – fachliche Grundlage und Modellgrenzen

## Modell

Zwei Felder mit N_Opa bzw. N_Enkel Äpfeln. In jedem Zeitschritt von 0,5 s wird für **jeden Apfel einzeln** gewürfelt: Ein Apfel beim Großvater fliegt mit Wahrscheinlichkeit p_Opa zum Enkel, ein Apfel beim Enkel mit p_Enkel zum Großvater. Erwartete Würfe je Schritt:

    Opa → Enkel:  p_Opa · N_Opa          Enkel → Opa:  p_Enkel · N_Enkel

Im Gleichgewicht (Mittelwert) sind beide gleich:

    p_Opa · N_Opa = p_Enkel · N_Enkel   →   K = N_Opa / N_Enkel = p_Enkel / p_Opa

Standard: p_Opa = 0,05, p_Enkel = 0,10 → K = 2; mit 18 Äpfeln im Mittel 12 : 6 wie in der Vorlage.

Das Modell ist eine stochastische Simulation einer reversiblen Reaktion erster Ordnung A ⇌ B mit k₁ = p_Opa/Δt und k₋₁ = p_Enkel/Δt. Der Mittelwert folgt dN_Opa/dt = −k₁·N_Opa + k₋₁·N_Enkel; die Relaxationszeit beträgt 1/(k₁ + k₋₁) ≈ 3,3 s, nach etwa 15 s ist der Mittelwert eingependelt. Die Zahlen schwanken um den Mittelwert mit einer Standardabweichung von etwa √(N·K)/(1+K) ≈ 2 Äpfeln bei 18 Äpfeln; relativ nimmt die Schwankung mit 1/√N ab (Schritt 2: 180 Äpfel).

## Analogie

| Modell | Chemie |
| --- | --- |
| Apfel | Teilchen |
| Feld des Großvaters, N_Opa | Edukte, c(Edukt) |
| Feld des Enkels, N_Enkel | Produkte, c(Produkt) |
| Wurf nach rechts / links | Umwandlung eines Teilchens (Hin-/Rückreaktion) |
| p_Opa, p_Enkel | k₁, k₋₁ |
| K = p_Enkel/p_Opa | K = k₁/k₋₁ |

## Zufallsgenerator

Eigener deterministischer Generator (mulberry32) mit Startwert: Derselbe Startwert liefert denselben Lauf (Vergleich im Unterricht, Tests), „Nochmal würfeln“ zieht einen neuen Startwert. Es werden keine Zufallszahlen aus dem Browser verwendet, damit Läufe wiederholbar bleiben.

## „Eingependelt“

Nach mindestens 40 s, wenn der Mittelwert von N_Opa über die letzten 30 s um weniger als 1,5 Äpfel (bzw. 8 % der Gesamtzahl) vom erwarteten Gleichgewicht abweicht. Das ist eine Anzeigehilfe, kein physikalisches Kriterium – das Modell kennt keinen „Endzustand“, die Würfe gehen weiter.

## Nicht Teil des Modells

Keine Stoffumwandlung, keine Energie, keine Temperatur. Die Figuren und Flugbahnen sind Animation ohne Einfluss auf die Zahlen. Die Eingriffe nach Le Chatelier (Korb Äpfel, bessere Schuhe = Katalysator, Großvater wird müde = K ändert sich) folgen in Schritt 3.
