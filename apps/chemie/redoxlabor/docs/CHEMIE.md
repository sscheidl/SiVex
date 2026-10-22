# Chemische Modellierung

Dieses Dokument beschreibt, welche fachlichen Annahmen die Simulation trifft und wo sie bewusst vereinfacht. Alle Regeln sind in `js/chemistry.js` umgesetzt und durch `tests/unit/chemistry.test.js` abgesichert.

## 1. Stoffproben

| Stoff | Klasse | Summenformel | Halbstrukturformel | reduzierend | Oxidationsprodukt |
| --- | --- | --- | --- | --- | --- |
| Ethanal | Aldehyd | C₂H₄O | CH₃–CHO | ja | Ethansäure |
| Propanal | Aldehyd | C₃H₆O | CH₃–CH₂–CHO | ja | Propansäure |
| Butanal | Aldehyd | C₄H₈O | CH₃–CH₂–CH₂–CHO | ja | Butansäure |
| Propanon | Keton | C₃H₆O | CH₃–CO–CH₃ | nein | – |
| Butanon | Keton | C₄H₈O | CH₃–CO–CH₂–CH₃ | nein | – |
| Pentan-2-on | Keton | C₅H₁₀O | CH₃–CO–CH₂–CH₂–CH₃ | nein | – |

Benzaldehyd ist bewusst nicht enthalten. Ein Unit-Test leitet die Summenformeln aus den hinterlegten Halbstrukturformeln ab und vergleicht sie. Propanal/Propanon und Butanal/Butanon sind Isomere – das wird in der Stoffinfo und in der Auflösung des Analysemodus thematisiert.

## 2. Mengenmodell

Jede Zugabe ist eine abstrakte **Portion** (Pipettenfüllung). Es werden keine Volumina, Konzentrationen oder Massen angegeben. Ein Reagenzglas fasst höchstens 7 Portionen (zum Erwärmen höchstens etwa halb voll). Pro Reagenzglas ist nur eine Stoffprobe zulässig (sonst keine eindeutige Auswertung).

## 3. Fehling-Probe

| Inhalt | Modellzustand | Darstellung |
| --- | --- | --- |
| Fehling I | freie Cu²⁺(aq) | hellblau, klar |
| Fehling II | Tartrat, NaOH | farblos, klar |
| Fehling I + II (II ≥ I) | Kupfer(II)-Tartrat-Komplex, „bereit“ | tiefblau, klar; beim Zugeben zunächst geschichtet (hellblau / tiefblaue Grenzschicht / farblos), durch Schütteln oder Konvektion homogen |
| Fehling I + II (II < I) | teilweise Cu(OH)₂ | Niederschlag, „nicht korrekt angesetzt“ |
| Fehling I + Natronlauge | Cu(OH)₂ | hellblauer Niederschlag, beim Erhitzen schwarzes CuO; kein gültiger Fehling-Nachweis |
| Fehling I + Ammoniaklösung | Kupfer-Ammin-Komplex | tiefblau-violett; kein Fehling-Reagenz |
| Kupfer- und Silberreagenzien gemischt | „fremd“ | trüb; kein gültiger Nachweis |

**Reaktion:** Nur wenn das Reagenz korrekt angesetzt ist, eine reduzierende Probe enthalten ist und die Temperatur über ca. 40 °C liegt:

- Umsatz `p` wächst mit `dp/dt = f(T) · Durchmischung · k(Probe) / 12 s`, mit `f(T) = ((T − 40 °C)/30 K)^1,3` (gedeckelt).
- Bei 80 °C ist die Reaktion nach rund 10 s abgeschlossen, bei 60 °C nach rund 20 s, bei Raumtemperatur findet sie im Modell nicht statt (in der Realität ebenfalls nicht in beobachtbarer Zeit).
- Ethanal reagiert etwas schneller als Propanal und Butanal (k = 1,00 / 0,93 / 0,86) – das ändert nichts am Ergebnis.

**Optisches Modell:** Cu₂O entsteht zunächst als feines, gelb-oranges Kolloid und wird mit wachsender Partikelgröße ziegelrot. Gelbe Partikel in tiefblauer Lösung wirken subtraktiv grün. Die beobachtete Gesamtfarbe durchläuft deshalb: tiefblau → blau-türkis → blaugrün → oliv/gelbgrün → gelborange → orange → ziegelrot. Zusätzlich steigen Trübung (Wolkentextur) und Partikeldichte. Nach Abschluss und Abkühlen im Ständer setzt sich Cu₂O vereinfacht als Bodensatz ab; darüber bleibt die überschüssige Fehling-Lösung bläulich.

**Ketone:** Die Lösung bleibt auch nach ausreichendem Erwärmen tiefblau; der Versuch ist abgeschlossen und als negativer Nachweis auswertbar.

## 4. Tollens-Probe

| Inhalt | Modellzustand | Darstellung |
| --- | --- | --- |
| Silbernitratlösung | Ag⁺(aq) | farblos – kein Tollens-Reagenz |
| + Natronlauge | Ag₂O | brauner Niederschlag |
| + Ammoniaklösung (tropfenweise) | Ag₂O löst sich als [Ag(NH₃)₂]⁺ | Niederschlag wird weniger, schließlich klar |
| klare ammoniakalische Silberlösung | „bereit“ | farblos, klar |

Modell der Auflösung: Anteil gelöst = min(1, NH₃-Portionen / (2 · AgNO₃-Portionen)). Mit einer Portion Silbernitrat sind also zwei Portionen Ammoniaklösung nötig. Auch ohne Natronlauge bildet Ammoniaklösung zuerst einen Ag₂O-Niederschlag, der sich im Überschuss löst – das klassische ammoniakalische Reagenz ist ebenfalls gültig.

**Reaktion:** Nur mit klarer ammoniakalischer Silberlösung, reduzierender Probe und Temperatur über ca. 35 °C (Faktor `(T − 35 °C)/25 K`, gedeckelt). Bei 60 °C ist die Silberabscheidung nach rund 15 s abgeschlossen. Im Modell findet die Reaktion bei Raumtemperatur nicht statt (Vereinfachung: real kann sie langsam einsetzen). Oberhalb ca. 75 °C entsteht vereinfacht mehr fein verteiltes, dunkles Silber und ein fleckigerer Spiegel; empfohlen wird daher das warme Wasserbad (60 °C).

**Darstellung des Silberspiegels:** Zunächst färbt kolloidales Silber die Lösung grau. An der benetzten Innenwand entstehen an zufällig verteilten Keimstellen kleine Inseln, die wachsen und zusammenwachsen; ein dünner Film deckt zuletzt fast die ganze benetzte Fläche. Die Schicht wird mit einem zylindrischen Metallverlauf (Glanzlichter, dunkle Umgebungsspiegelung, wandernder Glanzstreifen) eingefärbt und endet scharf am Flüssigkeitsspiegel – oberhalb bleibt das Glas klar.

**Fehlerfälle:** Silbernitrat allein oder mit nicht gelöstem Ag₂O ergibt keinen Silberspiegel. Ag₂O mit Aldehyd dunkelt beim Erwärmen zu grau-schwarzem Niederschlag nach – das ist kein gültiger Nachweis.

## 5. Erwärmen und Siedeverzug

- **Wasserbad:** Heizplatte 60 °C oder 80 °C; das Bad heizt in einigen Sekunden auf, das Reagenzglas folgt mit einer Zeitkonstante von ca. 2 s.
- **Kein Erwärmen:** keine Reaktion; das Protokoll weist den Versuch als „noch nicht abgeschlossen“ aus.
- **Brennerflamme (optional):** Direktes Halten in die Flamme führt nach etwa 2,6 s zu einem Siedeverzug: Die Flüssigkeit wallt auf, ein Teil spritzt heraus, der Ansatz ist ungültig, und ein Sicherheitshinweis erscheint (Wasserbad, Schutzbrille, Öffnung nie auf Personen richten; Tollens-Reagenz nie in der Flamme erhitzen, frisch ansetzen, nicht aufbewahren). Gefährliches Verhalten wird nicht belohnt.

## 6. Bewertung von Versuchen

`classify()` liefert für jeden Inhalt eine Musterauswertung:

| Fall | Ergebnis |
| --- | --- |
| korrektes Reagenz + Aldehyd + ausreichend erwärmt | positiv – Probe wirkt reduzierend; Aldehyd, aber **nicht eindeutig welcher** |
| korrektes Reagenz + Keton + ausreichend erwärmt | negativ – keine reduzierende Wirkung; im Probensatz ein Keton, aber **allein dadurch nicht bewiesen** |
| korrektes Reagenz ohne Probe | Blindprobe |
| nicht erwärmt / Reaktion läuft noch | nicht abgeschlossen – keine Aussage |
| Reagenz unvollständig, falsch, gemischt, Siedeverzug | kein gültiger Nachweis |

Beobachtungen werden über eine Liste zutreffender Aussagen erfasst (erforderliche, optionale und falsche Aussagen je Fall). Die Stoffklassen-Auswahl enthält absichtlich auch die fachlich unzulässigen Schlüsse „eindeutig identifiziert“ und „Keton bewiesen“.

## 7. Redoxgleichungen (schulische Darstellung)

Das Oxidationsprodukt wird vereinbarungsgemäß als Carbonsäure R–COOH geschrieben. Im alkalischen Milieu liegt tatsächlich überwiegend das Carboxylat-Ion R–COO⁻ vor; die App weist im Redox-Trainer darauf hin. Die Komplexbildung (Kupfer-Tartrat) bleibt in der Fehling-Gleichung unberücksichtigt.

**Fehling-Probe**

- Oxidation: R–CHO + 2 OH⁻ → R–COOH + H₂O + 2 e⁻
- Reduktion: 2 Cu²⁺ + 2 OH⁻ + 2 e⁻ → Cu₂O + H₂O
- Gesamt: R–CHO + 2 Cu²⁺ + 4 OH⁻ → R–COOH + Cu₂O + 2 H₂O

**Tollens-Probe**

- Oxidation: R–CHO + 2 OH⁻ → R–COOH + H₂O + 2 e⁻
- Reduktion: 2 [Ag(NH₃)₂]⁺ + 2 e⁻ → 2 Ag + 4 NH₃
- Gesamt: R–CHO + 2 [Ag(NH₃)₂]⁺ + 2 OH⁻ → R–COOH + 2 Ag + 4 NH₃ + H₂O

Oxidationszahlen: C der Aldehydgruppe +I → C der Carboxygruppe +III; Cu +II → +I; Ag +I → 0.

Ein Formelparser (`redox.parseFormula`) zählt Atome inkl. Klammern und R als Rest; Unit-Tests prüfen für alle sechs Gleichungen Atom- und Ladungsbilanz, dass Gesamtgleichung = Oxidation + Reduktion ist und dass die Musterlösungen des Trainers genau diese Gleichungen ergeben.
