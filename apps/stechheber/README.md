# Stechheber – Modellexperiment zum chemischen Gleichgewicht

**Status: prototype 0.1.0** (Schritt 1 von 3, Erstentwurf für mebis) · Chemie Jgst. 10–13 · Labkit 0.3.0

Zwei Standzylinder A und B, zwei Rohre a und b. In jedem Zyklus taucht Rohr a in A und Rohr b in B, beide werden gehoben, getauscht und in den anderen Zylinder entleert. Weil ein Rohr immer denselben **Anteil** des Wassers mitnimmt, wird die Übertragung A → B kleiner und B → A größer, bis beide gleich groß sind: ein **dynamisches Gleichgewicht** auf der Stoffebene – K = V(B)/V(A) = f_a/f_b = (d_a/d_b)².

Teil der Reihe „Chemisches Gleichgewicht“ (Stechheber → Apfelkrieg → Estergleichgewicht), Planung und gemeinsame Kriterien: [`docs/GLEICHGEWICHT-PLANUNG.md`](../../docs/GLEICHGEWICHT-PLANUNG.md).

## Einsatz

- mebis: `release/stechheber-0.1.0-scorm12.zip` als „Lernpaket (SCORM)“, Darstellung „Neues Fenster“.
- Webserver/lokal: `release/stechheber-0.1.0-web.zip` entpacken, `index.html` öffnen.

## Entwicklung

```
npm test          # Modelltests (Node, ohne DOM)
npm start         # Entwicklungsserver http://localhost:8080
npm run package   # Build prüfen und Web-/SCORM-ZIP in release/ erzeugen
```

Fachliches: [`docs/CHEMIE.md`](docs/CHEMIE.md) · Prüfung: [`docs/TESTBERICHT.md`](docs/TESTBERICHT.md)
