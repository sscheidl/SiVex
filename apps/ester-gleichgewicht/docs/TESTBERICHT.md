# Estergleichgewicht 0.1.0 – Testbericht

Stand 09.11.2026 · Labkit 0.3.0 · Status **prototype** (Erstentwurf, Schritt 1 von 3)

| Prüfung | Ergebnis |
| --- | --- |
| Kinetik: Gleichgewicht 0,33/0,67 ± 0,005 mol von Synthese, Hydrolyse und gemischtem Start; Bilanz; Katalysator schneller bei gleichem K; analytische Lösung (`npm test`) | PASS (6 Tests) |
| Teilchenebene: 40 Teilchen konstant, Sortenbilanz, Mittelwert ≈ 13 Ester, Hin- und Rückstöße gleich häufig, Katalysator beschleunigt (`npm test`) | PASS (3 Tests) |
| Build-Prüfung (keine externen Ressourcen, keine absoluten Pfade) und Paketierung | PASS |
| Browser-Screenshot Desktop und iPad-quer-Größe (Playwright, Chromium), beide Ebenen nebeneinander | siehe `screenshots/` |
| Touchbedienung auf dem iPad (Safari) | HOLD – unverified |
| SCORM-Import in mebis, Darstellung „Neues Fenster“ | HOLD – unverified |
| Fachliche Prüfung durch die Lehrkraft (K = 4, Zeitskala, Teilchensymbole) | HOLD – unverified |
| Lernschritt 1 und Tabelle: Werte stimmen mit der Vorlage überein | PASS (im Browser durchgespielt) |

Ein bestandener Build ist keine fachliche Freigabe. Offene Punkte für Schritt 2: Vergleichslauf Synthese ↔ Hydrolyse übereinander, K aus eigenen Messwerten berechnen, iPad-Test.
