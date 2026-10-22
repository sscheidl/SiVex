# Chemische Modellierung

Dieses Dokument beschreibt, welche fachlichen Annahmen die Simulation trifft und wo sie bewusst vereinfacht. Alle Regeln sind in `js/chemistry.js` umgesetzt und durch `tests/unit/chemistry.test.js` sowie `tests/unit/regression.test.js` abgesichert. Die Tests sichern das **Modell** ab; die fachliche Begründung stützt sich auf die Quellen am Ende dieses Dokuments.

## 1. Stoffproben

| Stoff | Klasse | Summenformel | Halbstrukturformel | reduzierend | Oxidationsprodukt (alkalisch) |
| --- | --- | --- | --- | --- | --- |
| Ethanal | Aldehyd | C₂H₄O | CH₃–CHO | ja | Ethanoat (Schule: Ethansäure) |
| Propanal | Aldehyd | C₃H₆O | CH₃–CH₂–CHO | ja | Propanoat (Schule: Propansäure) |
| Butanal | Aldehyd | C₄H₈O | CH₃–CH₂–CH₂–CHO | ja | Butanoat (Schule: Butansäure) |
| Propanon | Keton | C₃H₆O | CH₃–CO–CH₃ | nein | – |
| Butanon | Keton | C₄H₈O | CH₃–CO–CH₂–CH₃ | nein | – |
| Pentan-2-on | Keton | C₅H₁₀O | CH₃–CO–CH₂–CH₂–CH₃ | nein | – |

Die Proben sind **verdünnte wässrige Lösungen**, keine Reinstoffe. Das wird in der Stoffinfo und im Bedienfeld genannt. Reines Ethanal siedet bereits bei etwa 21 °C (NIST); die verdünnte Lösung im Wasserbad siedet nicht.

Für diesen Probensatz gilt: drei Alkanale positiv, drei einfache Ketone negativ. Das ist **keine allgemeine Regel** für alle Aldehyde oder Ketone (z. B. reagieren α-Hydroxyketone und Fructose in alkalischer Lösung positiv – siehe Abschnitt 10 zu den Zuckern im Lernmodus). Benzaldehyd ist bewusst nicht enthalten. Ein Unit-Test leitet die Summenformeln aus den hinterlegten Halbstrukturformeln ab und vergleicht sie.

## 2. Mengenmodell

Jede Zugabe ist eine abstrakte **Portion** (Pipettenfüllung). Es werden keine Volumina, Konzentrationen oder Massen angegeben. Ein Reagenzglas fasst höchstens 7 Portionen. Pro Reagenzglas ist nur eine Stoffprobe zulässig.

## 3. Zustand eines Reagenzglases

Der Inhalt besteht aus drei getrennten Teilen:

1. **Zusammensetzung** (Portionen, Stoffprobe, Reihenfolge der Zugaben) – daraus leitet `analyze()` ab, welcher Nachweis vorliegt und ob er korrekt angesetzt ist.
2. **Beständige Reaktionsprodukte**: `cu2o` (Kupfer(I)-oxid), `ag` mit Anteil `agFilm` (Silber als Wandbelag bzw. fein verteilt), `cuo` (Kupfer(II)-oxid aus Fehlansatz), `darkening` (dunkles Silber aus nicht gelöstem Ag₂O). Produkte bleiben erhalten, wenn spätere Zugaben den Ansatz ungültig machen. Ein Statuswechsel deutet sie nie in ein anderes Produkt um.
3. **Beobachtungszeit** `exposure`: wächst nur, solange der aktuelle Ansatz gültig, gebrauchsfertig und durchmischt ist (Durchmischung ≥ 0,85), gewichtet mit dem Temperaturfaktor des jeweiligen Nachweises. **Jede Zugabe setzt sie auf 0** – Wärme vor der Zugabe der Probe zählt nicht.

## 4. Bewertung: positiv, abgeschlossen, negativ

| Begriff | Bedingung | Bedeutung |
| --- | --- | --- |
| **positiv** | Nachweisprodukt deutlich sichtbar (Cu₂O ≥ 45 %, Ag ≥ 30 % des vollständigen Umsatzes) | Ein charakteristisches, deutlich sichtbares Produkt genügt für eine positive qualitative Aussage. |
| **abgeschlossen** | Umsatz ≥ 97 % | Nur Anzeige („Reaktion läuft noch“); keine Voraussetzung für einen positiven Befund. |
| **negativ** | kein Produkt sichtbar **und** `exposure ≥ 1` | Erst nach ausreichend langer Beobachtung des fertig gemischten Ansatzes unter geeigneten Bedingungen. |
| **nicht abgeschlossen** | sonst | Beginnende Veränderung, nicht erwärmt, nicht durchmischt oder Beobachtungszeit zu kurz – jeweils mit eigener Begründung. |

Ein Regressionstest prüft für alle Aldehyde, beide Nachweise und mehrere Temperaturen, dass nie ein falsch negativer Befund entsteht: Das Produkt wird sichtbar, bevor die Wartezeit für „negativ“ erreicht ist.

## 5. Fehling-Probe

| Inhalt | Modellzustand | Darstellung |
| --- | --- | --- |
| Fehling I | freie Cu²⁺(aq) | hellblau, klar |
| Fehling II | Tartrat, NaOH | farblos, klar |
| Fehling I + II (II ≥ I) | Kupfer(II)-Tartrat-Komplex, „bereit“ | tiefblau, klar; beim Zugeben zunächst geschichtet, durch Schütteln oder Konvektion homogen |
| Fehling I + II (II < I) | teilweise Cu(OH)₂ | Niederschlag, „nicht korrekt angesetzt“ |
| Fehling I + Natronlauge | Cu(OH)₂ | hellblauer Niederschlag, beim Erhitzen schwarzes CuO; kein gültiger Fehling-Nachweis |
| … danach + Fehling II | CuO bleibt als Feststoff | schwarz; „außerhalb des Modells“ – ob sich CuO wieder löst, wird nicht modelliert; kein gültiger Nachweis |
| Fehling I + Ammoniaklösung | Kupfer-Ammin-Komplex | tiefblau-violett; kein Fehling-Reagenz |
| Kupfer- und Silberreagenzien gemischt | „fremd“ | kein gültiger Nachweis; vorhandene Produkte (z. B. Silberbelag) bleiben sichtbar |

**Reaktion:** Nur wenn das Reagenz korrekt angesetzt ist, eine reduzierende Probe enthalten ist und die Temperatur über ca. 40 °C liegt: `d(cu2o)/dt = f(T) · Durchmischung · k(Probe) / 12 s`, mit `f(T) = ((T − 40 °C)/30 K)^1,3` (gedeckelt). Bei 80 °C ist Cu₂O nach wenigen Sekunden deutlich sichtbar und nach rund 10 s praktisch vollständig, bei 60 °C nach rund 20 s. Bei Raumtemperatur läuft die Fehling-Probe im Modell nicht ab. **In der Auswertung steht ausdrücklich: „Wir betrachten den beschleunigten Versuch im heißen Wasserbad.“** Die Geschwindigkeitsfaktoren der drei Aldehyde (1,00 / 0,93 / 0,86) sind modelliert, keine Messdaten, und ändern nichts am Ergebnis.

**Optisches Modell:** Cu₂O entsteht zunächst als feines, gelb-oranges Kolloid und wird mit wachsender Partikelgröße ziegelrot. Gelbe Partikel in tiefblauer Lösung wirken subtraktiv grün. Die Gesamtfarbe durchläuft deshalb im Modell tiefblau → blaugrün → oliv/gelbgrün → gelborange → orange → ziegelrot. Das ist **ein mögliches Erscheinungsbild**, keine unveränderliche Abfolge für alle Konzentrationen und Partikelgrößen. Cu₂O setzt sich in ruhender Flüssigkeit langsam ab (im Ständer schneller als im warmen Bad, wo Konvektion einen Teil in Schwebe hält); Schütteln oder Umsetzen wirbelt es wieder auf.

## 6. Tollens-Probe

| Inhalt | Modellzustand | Darstellung |
| --- | --- | --- |
| Silbernitratlösung | Ag⁺(aq) | farblos – kein Tollens-Reagenz |
| + Natronlauge | Ag₂O | brauner Niederschlag (kein Nachweisprodukt) |
| + Ammoniaklösung (tropfenweise) | Ag₂O löst sich als [Ag(NH₃)₂]⁺ | Niederschlag wird weniger, schließlich klar |
| klare ammoniakalische Silberlösung | „bereit“ | farblos, klar |

Modell der Auflösung: Anteil gelöst = min(1, NH₃-Portionen / (2 · AgNO₃-Portionen)). Die „zwei Portionen“ sind eine abstrakte Modellregel, keine Mengenangabe.

**Reaktion und Temperatur:** Faktor `f(T) = 0,05 + max(0, (T − 35 °C)/25 K)` (gedeckelt). Mit einfachen Aldehyden **kann sich Silber auch bei Raumtemperatur abscheiden** (Strathclyde, Kap. 7). Im Modell geschieht das langsam (deutlich sichtbar nach rund 1,5–2 min, vollständig nach einigen Minuten). Im warmen Wasserbad (60 °C) ist die Abscheidung nach rund 15 s abgeschlossen. Ein negativer Befund bei Raumtemperatur setzt entsprechend längere Beobachtung voraus.

**Formen des Silbers:** Ein positiver Tollens-Nachweis ist die Reduktion von Ag(I) zu **elementarem Silber**. Es kann sich als Spiegel an der Glaswand oder fein verteilt als grau-schwarzer Niederschlag zeigen; beides gilt als positiv (Strathclyde, Kap. 7; Chemguide). Im Modell gehen bei schonender Temperatur (≤ 65 °C) 88 % des Silbers an die Wand, bei 65–75 °C 65 %, darüber 40 %; der Rest bleibt fein verteilt. In der Auswertung genügt deshalb die Beobachtung „Silberspiegel“ **oder** „grau-schwarz“. Braunes Ag₂O aus unvollständig angesetztem Reagenz ist ausdrücklich davon abgegrenzt.

**Darstellung des Silberspiegels:** Zunächst färbt kolloidales Silber die Lösung grau. An der benetzten Innenwand entstehen an zufällig verteilten Keimstellen kleine Inseln, die wachsen und zusammenwachsen. Die Schicht endet scharf am Flüssigkeitsspiegel. Der Belag bleibt erhalten, auch wenn danach andere Reagenzien zugegeben werden.

**Handhabung:** Beim Fertigstellen des Reagenzes erscheint der Hinweis „immer frisch ansetzen und nicht aufbewahren“; beim Austauschen eines silberhaltigen Glases „Reste nicht aufbewahren – nach Anweisung der Lehrkraft entsorgen“. Konkrete Entsorgungswege werden bewusst nicht vorgegeben, weil sie von den regionalen Schulregeln abhängen.

## 7. Erwärmen, Bläschen und Siedeverzug

- **Wasserbad:** Heizplatte 60 °C oder 80 °C; das Reagenzglas folgt mit einer Zeitkonstante von ca. 2 s. Beim Herunter- oder Ausschalten kühlt das Bad nach dem Newtonschen Abkühlungsgesetz ab (Zeitkonstante 25 s im Zeitraffer: von 80 °C in rund 30 s auf etwa 40 °C); das Thermometer sinkt entsprechend.
- **Bläschen:** Beim Aufheizen entweicht anfangs gelöste Luft als einzelne Bläschen; das klingt nach einigen Sekunden ab. Wasser siedet bei 60/80 °C nicht, und die Nachweisreaktionen setzen kein Gas frei. Über dem warmen Bad steigt leichter Dunst auf.
- **Lupe:** zeigt das Reagenzglas immer vor neutralem, weißem Hintergrund, auch wenn es im Wasserbad steht – das getönte Bad würde schwach gefärbte Proben verfälschen.
- **Brennerflamme (optional, „Weitere Geräte“):** rauschende, nicht leuchtende (blaue) Flamme. Direktes Halten eines Glases **mit Flüssigkeit** in die Flamme führt im Modell nach 2,6 s zu einem Siedeverzug; leere Gläser oder trockener Feststoff nicht. Das ist ein **geskriptetes Lernszenario**; der Sicherheitshinweis sagt ausdrücklich, dass ein realer Siedeverzug nicht vorhersagbar ist.

## 8. Protokolle und Ergebnisübersicht

- Jedes Protokoll speichert Zeitpunkt (Simulationszeit), Temperatur und den damaligen Befund. Einträge vor Reaktionsende sind als **Zwischenstand** gekennzeichnet.
- Ändert sich der Befund danach (z. B. „nicht abgeschlossen“ → „positiv“), bleibt der alte Eintrag erhalten. Das Reagenzglas wird wieder als „Beobachtung möglich“ angezeigt und kann erneut ausgewertet werden.
- Die Ergebnisübersicht zeigt je Probe und Verfahren die **letzte gültige Evidenz** und – falls abweichend – zusätzlich den letzten Versuch. Ein späterer gescheiterter Versuch löscht eine frühere Beobachtung nicht.

## 9. Redoxgleichungen

**Schulische Schreibweise** (im Redox-Trainer): Das Oxidationsprodukt wird als Carbonsäure R–COOH geschrieben. Diese Gleichungen sind **atom- und ladungsmäßig ausgeglichen**; sie vereinfachen nur die Teilchenform. Der Hinweis steht sichtbar über dem Trainer, nicht mehr in einem zugeklappten Abschnitt.

- Oxidation: R–CHO + 2 OH⁻ → R–COOH + H₂O + 2 e⁻
- Fehling gesamt: R–CHO + 2 Cu²⁺ + 4 OH⁻ → R–COOH + Cu₂O + 2 H₂O
- Tollens gesamt: R–CHO + 2 [Ag(NH₃)₂]⁺ + 2 OH⁻ → R–COOH + 2 Ag + 4 NH₃ + H₂O

**Fachlich genauere Schreibweise** (zusätzlich in der Musterlösung; im alkalischen Ansatz liegt das Carboxylat vor, RSC):

- Oxidation: R–CHO + 3 OH⁻ → R–COO⁻ + 2 H₂O + 2 e⁻
- Fehling gesamt: R–CHO + 2 Cu²⁺ + 5 OH⁻ → R–COO⁻ + Cu₂O + 3 H₂O
- Tollens gesamt: R–CHO + 2 [Ag(NH₃)₂]⁺ + 3 OH⁻ → R–COO⁻ + 2 Ag + 4 NH₃ + 2 H₂O

Die Komplexierung von Cu(II) durch Tartrat bleibt in beiden Schreibweisen unberücksichtigt. Oxidationszahlen: C der Aldehydgruppe +I → +III; Cu +II → +I; Ag +I → 0. Unit-Tests prüfen für alle Gleichungen beider Schreibweisen Atom- und Ladungsbilanz und dass die Gesamtgleichung der Summe der Teilgleichungen entspricht.

## 10. Zucker (Lernmodus, Feststoffe)

Im Lernmodus stehen in einer zweiten Reihe vier Zucker als **Feststoffe** (Pulverdosen) bereit. Eine Zugabe ist eine Spatelspitze (höchstens drei pro Reagenzglas). Feststoff zählt nicht zum Flüssigkeitsvolumen; die Kristalle sinken zu Boden und lösen sich nach und nach, schneller beim Schütteln und im warmen Wasserbad. Erst der gelöste Anteil reagiert. Die Beobachtungszeit für einen negativen Befund läuft erst, wenn der Zucker gelöst ist (≥ 95 %). Trockener Zucker ohne Reagenz ist kein Nachweis. Im Analysemodus (Proben A–F) bleiben die Zucker ausgeblendet; der Grundprobensatz aus Aldehyden und Ketonen bleibt dort unverändert.

| Zucker | Ergebnis | Begründung in der App | Stoffklasse im Protokoll |
| --- | --- | --- | --- |
| Glucose (Aldohexose) | positiv | Ring (Halbacetal) im Gleichgewicht mit der offenkettigen Form mit Aldehydgruppe. Schulmodell: Oxidation zur Gluconsäure (Gluconat). **Hinweis:** Nach Herstellerangaben zum Fehling-Reagenz ist das Hauptprodukt mit Cu(II) eher **Glucoson** (OH-Gruppe an C2 → Ketogruppe), das unter C–C-Spaltung weiter abgebaut wird. | reduzierender Zucker |
| Fructose (Ketohexose) | positiv | Ketose, kein Aldehyd. Im alkalischen Reagenz Keto-Enol-Tautomerie über ein Endiol (Lobry-de-Bruyn-van-Ekenstein-Umlagerung) → Aldosen bzw. Endiolat-Ionen reduzieren das Reagenz. Unterschied zu Propanon: OH-Gruppe am Nachbar-C-Atom der Carbonylgruppe. | reduzierender Zucker |
| Saccharose (Glucose + Fructose) | negativ | Beide anomeren C-Atome (C1 Glucose, C2 Fructose) sind glycosidisch gebunden; kein Ring kann sich öffnen. Hinweis: Langes Kochen kann Saccharose teilweise spalten und ein schwach positives Ergebnis vortäuschen – nicht modelliert. | nicht reduzierender Zucker |
| Maltose (Glucose + Glucose, α-1,4) | positiv | Das anomere C-Atom der zweiten Glucose-Einheit ist frei; dieser Ring öffnet sich in Lösung zur Aldehydform (Produkt im Schulmodell: Maltobionsäure). | reduzierender Zucker |

**Kinetik (modelliert):** Geschwindigkeitsfaktoren Glucose 0,70, Fructose 0,85, Maltose 0,55. Fructose ist bewusst nicht langsamer als Glucose: Nach der Herstellerangabe reagiert Fructose sogar schneller als Glucose und Mannose, was zur Endiol-Erklärung passt und gegen eine reine „Aldehyd → Carbonsäure“-Erklärung spricht. Die Zahlen sind keine Messdaten.

**Redox-Trainer:** Die allgemeine Gleichung mit R–CHO gilt für die Aldehydgruppe der (offenkettigen) Aldose. Für Glucose zeigt die Musterlösung ein Beispiel mit Gluconsäure und den Glucoson-Hinweis; für Fructose und Maltose einen erklärenden Text statt einer Beispielgleichung.

## Quellen

- University of Strathclyde, Dissertation, Kap. 7 „Studying the Tollens’ test“ (S. 157–168 der Arbeit): Silberspiegel oder Teilspiegel mit überwiegend schwarzem, kolloidalem Silber als positiver Befund; Silberspiegel bzw. Reaktion bei Raumtemperatur für mehrere Substrate. <https://stax.strath.ac.uk/downloads/kh04dq07h?locale=en>
- Royal Society of Chemistry, „The silver mirror test with Tollens’ reagent“: Aldehyde werden zu Carboxylat-Ionen oxidiert; Reagenz nicht im Voraus ansetzen. <https://edu.rsc.org/experiments/the-silver-mirror-test-with-tollens-reagent/822.article>
- Chemguide (J. Clark), „Oxidation of aldehydes and ketones“: graues Silber oder Silberspiegel; Gleichungen mit Carboxylat im alkalischen Milieu. <https://www.chemguide.co.uk/organicprops/carbonyls/oxidation.html>
- FU Berlin, Versuchsvideo Fehling-Probe: Fehling I hellblau, Fehling II farblos, Mischung tiefblau, Cu₂O-Niederschlag. <https://www.bcp.fu-berlin.de/en/chemie/chemie/forschung/OrgChem/schalley/Teaching/OCI_Videos/Versuch10_02/index.html>
- ITW Reagents (PanReac AppliChem), Produktinformation „Fehling’s A Reagent“: Hauptprodukt von Glucose mit Cu(II) ist Glucoson (2-Ketoglucose), das unter C–C-Spaltung weiter oxidiert wird; Fructose reagiert schneller als Glucose; Reduktion über Endiolat-Ionen. Herstellerangabe ohne Literaturzitat – deshalb in der App als Hinweis formuliert. <https://itwreagents.com/rest-of-world/en/product/fehlingx0027-s-a-reagent-for-clinical-diagnosis/251563>
- C. A. Lobry de Bruyn, W. Alberda van Ekenstein, Recueil des Travaux Chimiques des Pays-Bas 14 (1895) 203–216: Umlagerung von Glucose, Fructose und Mannose in alkalischer Lösung (Endiol-Zwischenstufe).
- Boston University, Biochemie-Skript „Carbohydrates“: Saccharose ohne freies anomeres C-Atom (nicht reduzierend), Maltose mit freiem Halbacetal (reduzierend). <https://www.bu.edu/aldolase/biochemistry/html_docs/22_Carbohydrates_25.pdf>
- NIST Chemistry WebBook, Acetaldehyd: Normalsiedetemperatur 294,0 ± 0,8 K. <https://webbook.nist.gov/cgi/cbook.cgi?ID=C75070&Mask=4&Units=CAL>
