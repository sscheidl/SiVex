# Apfelkrieg 0.1.0 – Testbericht

Stand 09.11.2026 · Labkit 0.3.0 · Status **prototype** (Erstentwurf, Schritt 1 von 3)

| Prüfung | Ergebnis |
| --- | --- |
| Modell: Apfelzahl erhalten, Mittelwert ≈ 12 : 6 von allen Startaufstellungen, Raten im Gleichgewicht gleich und > 0, wiederholbarer Zufall, Grenzen (`npm test`) | PASS (6 Tests) |
| Build-Prüfung (keine externen Ressourcen, keine absoluten Pfade) und Paketierung | PASS |
| Browser-Screenshot Desktop und iPad-quer-Größe (Playwright, Chromium) | siehe `screenshots/` |
| Touchbedienung auf dem iPad (Safari) | HOLD – unverified |
| SCORM-Import in mebis, Darstellung „Neues Fenster“ | HOLD – unverified |
| Fachliche Prüfung durch die Lehrkraft (Wahrscheinlichkeiten, Zeitschritt, Vorlage Seilnacht) | HOLD – unverified |
| Lernschritt 1: richtige, teilweise richtige, falsche Antworten; Tipps 1–3; Lösung mit Rückfrage | PASS (Mechanik in Labkit-Tests; Inhalte im Browser durchgespielt) |

Ein bestandener Build ist keine fachliche Freigabe. Offene Punkte für Schritt 2: Vergleichslauf, Regler für die Apfelzahl (18 → 180), iPad-Test.
