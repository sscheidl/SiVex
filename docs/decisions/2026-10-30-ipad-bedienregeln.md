# Entscheidung: iPad- und Bedienregeln für alle Apps

Datum: 30.10.2026 · Status: angenommen · Regeln: [`QUALITY.md`](../QUALITY.md#ipad--und-bedienregeln-für-alle-apps)

## Anlass

Erster Unterrichtseinsatz von Trennverfahren 0.3.x und Aggregatzuständen 0.2.1 auf Schul-iPads (iPad 8. Generation, Safari, Querformat, Start aus mebis im neuen Fenster). Die Apps waren bedienbar und kamen gut an; die Schülerinnen und Schüler fanden aber Fehler, die nicht an eine App gebunden sind:

1. Aggregatzustände: Auswahllisten überdecken bei schmalem Bedienfeld den Text daneben.
2. Trennverfahren: Die Auswahlliste „Gemischart“ springt nach dem Antippen einer Antwort erneut auf.
3. Trennverfahren: Über den Trichter ließ sich der Kolben darunter unbegrenzt füllen.
4. Trennverfahren: Nach einer Pause in einem Versuch blieb ein Handgriff im nächsten stehen und blockierte alles („Warte, bis der laufende Handgriff fertig ist“).

## Entscheidung

- Die vier Ursachen werden als **verbindliche Regeln** in `QUALITY.md` festgeschrieben.
- Was ohne Fachwissen auskommt, wandert in den **Labkit** (0.2.0): Gestaltung der Auswahllisten (`.lk-choice`, Regeln für `select`) und Fokus-Wiederherstellung (`LK.core.restoreFocus`, `LK.core.lastInputKeyboard`).
- Füllgrenze und Pause hängen am Fachmodell bzw. an der Zeitsteuerung jeder App und werden **pro App** umgesetzt.
- Jede betroffene App bekommt eine eigene Version (+0.1) mit Tests und neuen Paketen. Apps werden nur bei echtem Befund geändert; das freigegebene Redoxlabor und das TitraLab 3 (nur als Paket im Repository) bleiben sonst unverändert.

## Offen

- Kompakte Bedienung direkt am Gerät: erst als Testvariante des Trennverfahrens im Unterricht vergleichen.
- mebis: „Struktur der Inhaltsseite überspringen: Nie“ gegen den Pop-up-Blocker bestätigen.
