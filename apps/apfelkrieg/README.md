# Apfelkrieg – Modell zum chemischen Gleichgewicht

**Status: prototype 0.1.0** (Schritt 1 von 3, Erstentwurf für mebis) · Chemie Jgst. 10–13 · Labkit 0.3.0

Großvater und Enkel werfen sich Äpfel über den Zaun. Der Enkel wirft jeden Apfel mit doppelter Wahrscheinlichkeit – trotzdem liegen am Ende beim Großvater doppelt so viele Äpfel, weil die Zahl der Würfe auch von der Zahl der eigenen Äpfel abhängt. Die Zahlen **schwanken** um feste Werte: ein **dynamisches Gleichgewicht** auf der Teilchenebene mit sichtbarem Zufall – K = N(Großvater)/N(Enkel) = p_Enkel/p_Opa.

Vorlage: das Spiel „Apfelkrieg“ (T. Seilnacht). Teil der Reihe „Chemisches Gleichgewicht“ (Stechheber → Apfelkrieg → Estergleichgewicht), Planung und gemeinsame Kriterien: [`docs/GLEICHGEWICHT-PLANUNG.md`](../../docs/GLEICHGEWICHT-PLANUNG.md).

## Einsatz

- mebis: `release/apfelkrieg-0.1.0-scorm12.zip` als „Lernpaket (SCORM)“, Darstellung „Neues Fenster“.
- Webserver/lokal: `release/apfelkrieg-0.1.0-web.zip` entpacken, `index.html` öffnen.

## Entwicklung

```
npm test          # Modelltests (Node, ohne DOM)
npm start         # Entwicklungsserver http://localhost:8080
npm run package   # Build prüfen und Web-/SCORM-ZIP in release/ erzeugen
```

Fachliches: [`docs/CHEMIE.md`](docs/CHEMIE.md) · Prüfung: [`docs/TESTBERICHT.md`](docs/TESTBERICHT.md)
