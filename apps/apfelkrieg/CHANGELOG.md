# Änderungen – Apfelkrieg

## 0.1.0 – 09.11.2026 (Schritt 1: Beobachten)

Erstentwurf nach [`docs/GLEICHGEWICHT-PLANUNG.md`](../../docs/GLEICHGEWICHT-PLANUNG.md).

- Modell: jeder Apfel wird je Schritt (0,5 s) mit fester Wahrscheinlichkeit geworfen (p_Opa = 5 %, p_Enkel = 10 %); eigener Zufallsgenerator mit Startwert, dadurch wiederholbare Läufe; „eingependelt“-Erkennung; K = p_Enkel/p_Opa
- Bühne: zwei Felder mit Zaun, Äpfel als einzelne Objekte, Wurfbogen-Animation, Figuren mit Wurfarm
- Diagramm N(t) beider Felder mit erwarteten Gleichgewichtslinien und Marke „eingependelt“; Balkenpaar „Würfe pro 10 s“; Q/K-Anzeige mit Formel
- Zeitsteuerung Schritt · Start/Pause · 1×/3×/10× · Neu starten · Nochmal würfeln; Startaufstellungen 9 : 9, 18 : 0, 0 : 18, eigene (bis 60); Wurfwahrscheinlichkeiten einstellbar
- Lernweg Schritt 1 (Lückentext + Frage, Tipp 1/3–3/3, Lösung); Schritte 2 und 3 angelegt (gesperrt)
- Reiter Modell (Analogietabelle, zeigt/zeigt nicht) und Hefteintrag (Rohfassung, druckbar)
- Labkit 0.3.0 (chart.js, learn.js), SCORM-1.2-Paket
