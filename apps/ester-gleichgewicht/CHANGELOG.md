# Änderungen – Estergleichgewicht

## 0.1.0 – 09.11.2026 (Schritt 1: Beobachten)

Erstentwurf nach [`docs/GLEICHGEWICHT-PLANUNG.md`](../../docs/GLEICHGEWICHT-PLANUNG.md); löst den Status „planned“ ab.

- Stoffebene: Kinetik v_hin = k₁·n(S)·n(A), v_rück = k₋₁·n(E)·n(W), K = 4, RK4-Integration; Tage ohne, Stunden mit Katalysator (×50); Gleichgewichtserkennung; analytische Gleichgewichtslösung; Kolben mit Reaktionsgemisch und vier Mengenbalken
- Teilchenebene: hybrides Modell mit 40 Teilchen – Ereignisse aus den Ratengesetzen gewürfelt, danach Zusammenstoß mit Aufblitzen animiert; eigener Zufallsgenerator; Balkenpaar „erfolgreiche Stöße pro 10 s“
- Ansicht umschaltbar: beide Ebenen · Stoffebene · Teilchenebene; Ebenen-Etiketten, Brückensatz
- Diagramm n(t) wie die Vorlage (Edukte rot, Produkte blau, 0,33/0,67-Linien, Marke „chemisches Gleichgewicht“, Katalysator-Marken); Q/K-Anzeige mit MWG
- Zeitsteuerung 1 Tag/1 Stunde · Start/Pause · 1×/3×/10× · Katalysator · Neu starten; Ansätze Synthese, Hydrolyse, gemischt, eigene Mengen
- Tabelle Start/Gleichgewicht für Synthese und Hydrolyse (füllt sich selbst); Lernweg Schritt 1; Reiter Modell und Hefteintrag (Rohfassung)
- Labkit 0.3.0 (chart.js, learn.js), SCORM-1.2-Paket
