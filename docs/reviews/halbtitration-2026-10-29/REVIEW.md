# Halbtitrationslabor: Review und Vorschlag für die Überarbeitung

29.10.2026 · geprüfter Stand: `9bd514b` · keine Änderung am Anwendungscode.

## Urteil

Das chemische Modell und die übernommene TitraLab-Apparatur sind eine brauchbare Grundlage. Der Lernweg setzt für die beschriebene Lerngruppe zu früh zu viel Theorie voraus bzw. erklärt vorab bereits das, was die Lernenden experimentell erarbeiten sollen. Zusätzlich schwächen konkrete Fehler in der Rückmeldung die Selbstkontrolle.

Empfehlung: Modell und Apparatur erhalten; den Einstieg, die Arbeitsphasen, die Auswertung und die Gerätebedienung gezielt überarbeiten. Orientierung an den bestehenden SiVex-Mustern und dem Labkit, das auch Pufferfish verwendet.

## Prüfumfang und Nachweise

- Den Commit `9bd514b` aus `origin/main` separat ausgepackt. Der vom Chat bereitgestellte Arbeitsordner steht tatsächlich noch auf `feat/trennlabor` (`dde56a0`) und enthält lokale Änderungen/Löschungen. Diese wurden erhalten.
- Chemisches Modell, Experimentsteuerung, Renderer, Diagramm, Speicherung, Theorie, Aufgaben, Auswertung und vorhandene Prüfungen gelesen.
- Alle **28 vorhandenen Unit-Tests erneut ausgeführt: PASS**.
- Im Browser Einstieg, Planung, Gerätevorbereitung, Kalibrierung, Bürettenablesung, Messwertübernahme und Dosierung bedient. Zusätzlich fehlerhafte Rückmeldungen und Ergebnisfreigabe ohne Messreihe reproduziert.
- Vorhandene Desktop-/Tablet-Screenshots mit Redoxlabor und dem aktuellen SiVex-Aufbau verglichen. Die vier vollständigen E2E-Abläufe sind im vorhandenen Testbericht dokumentiert; sie wurden in diesem Review nicht erneut vollständig durchlaufen.
- Keine neue Prüfung auf echtem iPad oder in mebis; keine Freigabe für den Unterricht behauptet.

Bildnachweise dieses Reviews: [veralteter grüner Prüfstatus und Freigabe ohne Messreihe](01-pruefstatus-und-freigabe.png), [Labor mit eigener Messwertübernahme](02-labor-messung.png).

## Konkrete Befunde

### 1. P2 – Prüfstatus bleibt nach Änderungen gültig

**Im Browser reproduziert:** In der Auswertung für Essigsäure `V(ÄP) = 24` prüfen → „Richtig berechnet“. Anschließend den Wert auf `30` ändern, ohne erneut zu prüfen. Feld und Rückmeldung bleiben grün. Auch nach dem Neuaufbau der Auswertung steht weiterhin „Richtig berechnet“ unter 30 mL.

Ursache: Die Eingabehandler speichern nur `f.input`. Sie setzen `status`, `message` und zugehörige Messpunktnachweise nicht zurück. Auch Änderungen an Rechenbasis, Markern oder ausgewählter Messreihe entwerten abhängige Prüfungen nicht zuverlässig. Die Abgabe prüft pK-Felder nur neu, wenn noch kein Status bzw. `empty` vorliegt.

Quellen: [app.js, Eingabehandler](https://github.com/sscheidl/SiVex/blob/9bd514b/apps/halbtitration/js/ui/app.js#L932), [journal.js, Abgabe](https://github.com/sscheidl/SiVex/blob/9bd514b/apps/halbtitration/js/ui/journal.js#L614).

**Korrektur:** Prüfung an Eingabe und Rechenbasis binden. Bei Änderung „erneut prüfen“ anzeigen; abhängige Ergebnisse ebenfalls entwerten. Bei Abgabe mit den aktuellen Daten neu prüfen. Ein bereits abgegebener Versuchswert bleibt als unveränderlicher Vergleich erhalten.

### 2. P2 – Ergebnisfreigabe verlangt keinen experimentellen Nachweis

**Im Browser reproduziert:** Frischer Stand → direkt „Auswertung“ → nur einen beliebigen numerischen pK-Wert eintragen → abgeben. Nach einem allgemeinen Warnhinweis werden Literaturwerte und Modellreferenz freigeschaltet. Es existieren weder Erstdurchgang noch Halbtitration noch ein gemessener pH-Wert. Die Zahl erscheint dennoch als abgegebener ursprünglicher Versuchswert.

Ursache: `submit()` verlangt nur endliche Zahlen in den pK-Feldern. Fehlende Messreihen, Zielvolumina und pH-Nachweise verhindern die Ergebnisabgabe nicht.

Quelle: [journal.js, submit](https://github.com/sscheidl/SiVex/blob/9bd514b/apps/halbtitration/js/ui/journal.js#L614).

**Korrektur:** Für „eigenes experimentelles Ergebnis abgeben“ einen nachvollziehbaren Messpunkt und ein eigenes Zielvolumen verlangen. Ungenaue Messungen und rechnerisch falsche Ergebnisse dürfen weiterhin abgegeben und reflektiert werden. Davon getrennt „Lösung anzeigen“ anbieten, auch ohne gelungenen Versuch; eine Musterlösung darf dann nicht als eigener Versuch ausgegeben werden. Das passt zur bestehenden SiVex-Regel, Lösungen bewusst anfordern zu können.

### 3. P2 – Messwert wird ohne Zielvolumen als Treffer am Ziel bestätigt

**Direkt an der Auswertungsfunktion reproduziert:** `checkMeasuredPH('4.76', [{v:12,pH:4.76,stable:true}], NaN)` liefert `status: 'ok'` und „Protokollierter Messwert am Zielvolumen“.

Die Volumenprüfung wird bei fehlendem Ziel übersprungen. Damit kann ein beliebiger vorhandener pH-Wert als HÄP-Nachweis bestätigt werden, bevor überhaupt ein Halbäquivalenzvolumen festgelegt wurde.

Quelle: [evaluation.js, checkMeasuredPH](https://github.com/sscheidl/SiVex/blob/9bd514b/apps/halbtitration/js/model/evaluation.js#L155).

**Korrektur:** Ohne gültiges Zielvolumen nur „Messwert vorhanden; Zuordnung zum HÄP noch offen“. Die rechnerische Ableitung des pK-Werts getrennt vom experimentellen Nachweis bewerten.

### 4. P2 – Speziesdarstellung passt nicht überall zum berechneten Gleichgewicht

Die Hervorhebung verwendet ausschließlich den stöchiometrischen Umsatz. Der Text behauptet, benachbarte Formen lägen nur „in geringen Anteilen“ vor. Das trifft bei den gewählten Ausgangsbedingungen nicht allgemein zu: Das Modell berechnet am Start bereits rund **44,4 % Dihydrogenphosphat** bzw. **34,8 % Glycin-Zwitterion**. Trotzdem wird jeweils die vollständig protonierte Form hervorgehoben.

Quellen: [app.js, Erläuterung](https://github.com/sscheidl/SiVex/blob/9bd514b/apps/halbtitration/js/ui/app.js#L602), [app.js, Speziesdarstellung](https://github.com/sscheidl/SiVex/blob/9bd514b/apps/halbtitration/js/ui/app.js#L681), [chemistry.js, stöchiometrische Formen](https://github.com/sscheidl/SiVex/blob/9bd514b/apps/halbtitration/js/model/chemistry.js#L332).

**Korrektur:** Entweder ausdrücklich eine schematische Reaktionsfolge ohne Aussage über tatsächliche Anteile zeigen oder nach eigener Deutung die echten Gleichgewichtsanteile aus dem vorhandenen Solver einblenden. „Geringe Anteile“ streichen. Eine neue Teilchenanimation ist dafür nicht erforderlich.

## Fachmodell und Auswahl der Versuche

Positiv: durchgängige Ladungsbilanz, Stoff- und Volumenbilanz, Wasserautoprotolyse, drei Phosphorsäurestufen und das Chlorid-Gegenion des Glycinhydrochlorids. Die Messsimulation unterscheidet Dosierung, Ankunft der Tropfen, Durchmischung und Sensoransprechzeit. Richtige Rechnungen mit ungenauen eigenen Messdaten können als rechnerisch richtig erkannt werden. Diese Trennung sollte erhalten bleiben.

Die erneut berechneten Halbäquivalenzwerte zeigen eine didaktisch wichtige Abstufung:

| Versuch | HÄP-Volumen | Modell-pH am HÄP | Bezug |
| --- | ---: | ---: | --- |
| Essigsäure | 12,00 mL | 4,758 | pKₛ des Modells 4,757 |
| Ammoniak | 9,00 mL | 9,243 | pKᵦ ≈ 14 − pH = 4,757 |
| Phosphorsäure, Stufe 1 | 5,00 mL | 2,480 | pKₛ₁ 2,148; Differenz +0,332 |
| Phosphorsäure, Stufe 2 | 15,00 mL | 7,199 | pKₛ₂ 7,199 |
| Glycin, Stufe 1 | 6,00 mL | 2,572 | pKₛ₁ 2,350; Differenz +0,222 |
| Glycin, Stufe 2 | 18,00 mL | 9,772 | pKₛ₂ 9,778 |

Die großen Abweichungen der ersten Stufen sind keine künstlich zu beseitigenden Solverfehler. Die schulische Gleichsetzung stöchiometrischer Halbtitration mit gleichen Gleichgewichtskonzentrationen ist hier deutlich eingeschränkt. Die App sollte diese Ergebnisse ausdrücklich als Grenzen der einfachen Bestimmung behandeln. Dafür sind sie wertvolle Vertiefungen, aber ungeeignete gleichrangige Einstiegsfälle.

Glycin 9,78 ist für sich kein Datenfehler: Die angegebene [Harvey-Tabelle](https://chem.libretexts.org/Bookshelves/Analytical_Chemistry/Analytical_Chemistry_2.1_by_David_Harvey/Analytical_Chemistry_2.1_(Harvey)/16%3A_Appendix/16.11%3A__Acid_Dissociation_Constants) enthält 2,350 und 9,778. Eine Angleichung an einen Schulwert wie 9,60 sollte nur mit passender Quellen- und Modellentscheidung erfolgen.

## Vorgeschlagener Lernweg

Ausgangspunkt: Die SuS kennen Titration, Säure-/Basenstärke, pKₛ/pKᵦ und die zugehörigen Rechnungen. Neu ist die experimentelle Bestimmung der Säure- bzw. Basenkonstante durch einen geschickt gewählten Umsatz.

1. **Labor mit kurzem Auftrag öffnen.** „Bestimme die Säurestärke einer Essigsäurelösung mithilfe einer Titration und einer pH-Messung.“ Ausgangsdaten, Geräte und Kurvenfeld sind sichtbar. Kein vorgeschaltetes Theoriekapitel und kein Eingangstest.
2. **Bekannte Titration nutzen.** SuS nehmen selbst eine Kurve auf und bestimmen das Äquivalenzvolumen. Die Auswahl der Maßlösung bleibt eine kurze fachliche Entscheidung; eine ausführliche Wiederholung von Indikatorwahl und ÄP-Teilchen wird zur optionalen Hilfe bzw. Vertiefung.
3. **Halben Umsatz als Untersuchungsfrage einführen.** „Wie viel Säure wurde bei halbem Äquivalenzvolumen umgesetzt? Welche Mengen von HA und A⁻ liegen dann näherungsweise vor?“ Kurze Auswahl-/Zuordnungsfragen und die eigene Volumenrechnung führen zur neuen Idee. Der Impuls wird ausdrücklich gegeben; SuS sollen nicht ohne Anhaltspunkt den besonderen Punkt erraten.
4. **Gezielte Halbtitration durchführen.** Eine frische gleich große Probe ansetzen, das eigene Zielvolumen dosieren, mischen und pH messen. Kalibrierung und vorbereitete Bürette bleiben erhalten. Die erste Kurve bleibt sichtbar. Kein automatisches Treffen oder Stoppen am geheimen Sollwert.
5. **Die neue Beziehung begründen.** Direkt am eigenen Ergebnis das bekannte MWG verwenden: Kₛ = c(H₃O⁺)·c(A⁻)/c(HA). Bei näherungsweise gleichen Partnerkonzentrationen kürzt sich das Verhältnis zu 1; daraus folgen Kₛ ≈ c(H₃O⁺) und pKₛ ≈ pH. Die vollständige Henderson-Hasselbalch-Herleitung kann als Vertiefung erreichbar sein. Eine eigene Puffer-Lerneinheit bleibt bei Pufferfish. Die Essigsäurebeziehung ist auch bei [OpenStax, Acid-Base Titrations](https://openstax.org/books/chemistry-atoms-first-2e/pages/14-7-acid-base-titrations) nachvollziehbar dargestellt.
6. **Eigenen Wert einreichen, vergleichen und sichern.** Messwert, pK-Wert, Literaturvergleich, eine passende Fehlerdeutung und kurzer Hefteintrag. Start-/ÄP-pH-Rechnungen als Wiederholungsangebot; sie sind für diese Lerngruppe kein notwendiger Durchgang durch bereits beherrschten Stoff.
7. **Transfer in Ammoniak.** „Was ändert sich bei einer Base?“ Fallende Kurve und pOH ≈ pKᵦ selbst zuordnen. Säure-/Base-Unterschied erst an dieser Stelle vertiefen.
8. **Phosphorsäure und Glycin als Vertiefungen.** Zwei Stufen richtig lokalisieren, zweiten HÄP als Mitte zwischen zwei ÄP verstehen, schwache Sprünge und Näherungsgrenzen untersuchen. Keine vier identischen langen Pflichtdurchläufe.

## Oberfläche und Grafik

- **App-Hülle vereinheitlichen:** Aufbau und Bedienmuster des vorhandenen Labkits übernehmen. Die Halbtitration hat derzeit eine eigene Hülle mit `Theorie → Planung → Labor → Auswertung`. Pufferfish und die Trenn-Apps führen über Aufgabe, Versuch und Ergebnisse. Farbähnlichkeit allein gleicht diese Unterschiede nicht aus.
- **Apparatur erhalten:** Bürette, Stativ, Kolben, Magnetrührer, Meniskus, Tropfen und Elektrode sind passend. Das ist ein erhaltenswerter Teil der App.
- **Während der Messung Gerätevorbereitung einklappen:** Nach Abschluss reichen kompakte Statusangaben. Dosieren, Hahn schließen, pH ablesen und Messwert übernehmen müssen zusammen sichtbar bleiben. Im jetzigen langen rechten Bedienfeld scrollt man zwischen Vorbereitung und den eigentlichen Messhandlungen.
- **Labor und Kurve gemeinsam groß halten:** Die 1024×768-Screenshots zeigen drei schmale Spalten. Dadurch schrumpfen Gerätebeschriftungen und Kurvenbreite. Auf Tablet die Dosierleiste kompakt anordnen und das rechte Feld einklappbar machen. Anders als bei Pufferfish muss die Titrationskurve während der Messung sichtbar bleiben.
- **Kurvenwerkzeuge schrittweise anbieten:** Zunächst eigene Messpunkte und ÄP-Auswahl; danach HÄP-Marker. Referenz-, Literatur-, Näherungs- und Ableitungsfunktionen erst bei der jeweiligen Aufgabe einblenden. Die vorhandene Umschaltung auf den Messbereich nach Datenaufnahme besser auffindbar machen; nicht mit geheimen Sollvolumina skalieren.
- **Ableseaufgabe konsistent machen:** Die App zeigt den Bürettenstand digital und fordert zugleich seine manuelle Ablesung aus der Lupe. Entweder Ablesen gezielt üben und die digitale Zahl zeitweise verbergen oder die vorhandene digitale Ablesung übernehmen und redundante Prüfknöpfe sparen.
- **Vergleich sichtbar machen:** Eine kompakte Ergebnistabelle für die eigenen Versuche bietet mehr Überblick als vier getrennte lange Journale: System, ÄP, HÄP, gemessener pH, bestimmter pK, Literatur und passende Erklärung.

## Reihenfolge der Überarbeitung

1. Verlässliche Prüfzustände und nachvollziehbare Messwertzuordnung herstellen.
2. Labor als Einstieg und den kurzen Essigsäure-Lernweg umsetzen.
3. Bedienfeld, Kurvenwerkzeuge und Auswertung an die SiVex-Muster anpassen.
4. Ammoniak als Transfer; Phosphorsäure/Glycin als klar beschriftete Vertiefungen einordnen.
5. Danach die betroffenen vollständigen Browserabläufe, Desktop-/Tablet-Darstellung und Pakete erneut prüfen. Bereits bestandene Modelltests bleiben die Grundlage; neue Tests auf die gefundenen Fehler und geänderten Abläufe richten.

Der bisherige Build-Auftrag hat den Einstieg mit Theorie ausdrücklich verlangt. Die bisherige Umsetzung folgt diesem Auftrag. Die nun beschriebene Lerngruppe und das aktuelle SiVex-Bedienmuster begründen eine Änderung dieser Vorgabe.
