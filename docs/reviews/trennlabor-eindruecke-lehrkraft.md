# Trennlabor – Eindrücke der Lehrkraft aus dem Praxistest

Laufende Sammlung zum mebis-Praxistest der Fassungen A (`486f370`) und B (`a5d6d0e`). Die Punkte fließen nach dem Codex-Review in die gemeinsamen Gestaltungs- und Bedienregeln (`shared/labkit/DESIGN.md`) und in die Aufträge der drei Einzel-Apps ein. Hintergrund: [Entscheidung zur Aufteilung](../decisions/2026-10-23-trennlabor-aufteilung.md).

## Leitgedanke

**Komplexität reduzieren.** Die Schülerinnen und Schüler kennen weder die App noch ihre Bedienung. Sie sollen sich auf den Versuch konzentrieren, nicht auf die Oberfläche.

## Grundsätze (gelten für alle drei Apps)

### G-01 Wenige Auswahlmöglichkeiten

Keine Optionen anbieten, die für das Lernziel nicht nötig sind.

*Beispiel Chromatographie, Startlinie:* Heute gibt es die Wahl der Höhe (1 cm / 1,5 cm / 2 cm) und des Stifts (Bleistift / Kugelschreiber). Es genügt: **Startlinie ziehen** und **Startlinie wieder löschen**.

*Folge:* Der Fehlerfall „Kugelschreiber statt Bleistift“ aus dem Masterauftrag (Abschnitt 3B) entfällt bzw. wird nur noch in Theorie oder Hilfe angesprochen.

### G-02 Erneutes Antippen stellt ein Gerät zurück

Ein erneuter Klick oder Tap auf ein Arbeitsgerät bzw. Gefäß **entfernt es wieder und stellt es an seinen Platz zurück**, zumindest solange es leer bzw. unbenutzt ist.

*Ausnahme:* Wo das physikalisch nicht möglich ist, z. B. den Rundkolben aus der fertig montierten Destillationsapparatur nehmen. Dann gibt es eine kurze Rückmeldung, warum es nicht geht.

*Noch festzulegen:* das Verhalten bei benutztem oder gefülltem Gerät (z. B. Becherglas mit Filtrat).

### G-03 Flüssigkeiten und Glas wie im TitraLab 3

Das Titrierlabor (TitraLab 3) hat die überzeugendste Flüssigkeitsdarstellung: Tropfen, Lösungen mit **Meniskus** (z. B. im Erlenmeyerkolben) und eine sehr elegante Darstellung der **Glasgefäße**. Diese Darstellung ist Vorbild für alle drei Trenn-Apps.

*Fundort:* Release `apps/titration/release/SiVex-Titration-Claude-v3-web.zip`, darin `titration/js/view/lab-renderer.js` (Gefäße, Flüssigkeit, Meniskus, Tropfen) und `titration/js/view/geometry.js`. Der Quellcode ist noch nicht entpackt eingecheckt; das TitraLab selbst bleibt unverändert.

### G-04 Verschiebbare Trennlinie zwischen Labor und Bedienfeld

Wie im TitraLab 3: Die linke Hälfte (virtuelles Labor) und die rechte Hälfte (Einstellungen) lassen sich mit einer Trennlinie **dynamisch horizontal verschieben**, sodass jeder die Breiten selbst einstellen kann.

*Fundort:* `titration/js/ui/app.js` (`bindSplitter`) und `titration/css/styles.css` (`.splitter`): bedienbar mit Maus, Finger (44 px breite Touch-Fläche) und Tastatur; auf schmalen Bildschirmen ausgeblendet.

## Geräte- und Browsertests anderer SiVex-Apps (Bezugspunkt)

Rückmeldung der Lehrkraft vom 23.10.2026: Redoxlabor und TitraLab 3 laufen auf einem **iPad im Browser** sowie in **Edge** und **Firefox** (jeweils aktuelle Version, Windows 11); alles ist bedienbar und erkennbar. Das Redoxlabor hat noch einige Grafikfehler, die getrennt behoben werden. Die Trenn-Apps sollen dieselbe Gerätebreite abdecken.

## Einzelbeobachtungen je App

*(wird ergänzt)*

| App | Fassung | Beobachtung | Vorschlag |
| --- | --- | --- | --- |
| | | | |
