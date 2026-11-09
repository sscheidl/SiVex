# Estergleichgewicht – Esterbildung und chemisches Gleichgewicht

**Status: prototype 0.1.0** (Schritt 1 von 3, Erstentwurf für mebis) · Chemie Jgst. 10–13 · Labkit 0.3.0

Ethansäure + Ethanol ⇌ Ethansäureethylester + Wasser (K = 4). Die **Stoffebene** zeigt messbare Stoffmengen: Kolben, Mengenbalken, Kurven n(t) und die Tabelle Start/Gleichgewicht für Synthese und Hydrolyse – beide enden bei 0,33/0,33/0,67/0,67 mol. Die **Teilchenebene** zeigt daneben 40 schematische Teilchen, die zusammenstoßen und hin und zurück reagieren; im Gleichgewicht gleich oft. Katalysator: schneller, gleiche Lage.

Dritte App der Reihe „Chemisches Gleichgewicht“ (Stechheber → Apfelkrieg → Estergleichgewicht), Planung und gemeinsame Kriterien: [`docs/GLEICHGEWICHT-PLANUNG.md`](../../docs/GLEICHGEWICHT-PLANUNG.md).

## Einsatz

- mebis: `release/ester-gleichgewicht-0.1.0-scorm12.zip` als „Lernpaket (SCORM)“, Darstellung „Neues Fenster“.
- Webserver/lokal: `release/ester-gleichgewicht-0.1.0-web.zip` entpacken, `index.html` öffnen.

## Entwicklung

```
npm test          # Kinetik- und Teilchentests (Node, ohne DOM)
npm start         # Entwicklungsserver http://localhost:8080
npm run package   # Build prüfen und Web-/SCORM-ZIP in release/ erzeugen
```

Fachliches: [`docs/CHEMIE.md`](docs/CHEMIE.md) · Prüfung: [`docs/TESTBERICHT.md`](docs/TESTBERICHT.md)
