# Korrekturauftrag für Claude Code: SiVex – Fällungslabor

**Auftrag:** 16.11.2026 · Revision 1  
**Repository:** sscheidl/SiVex  
**Modul:** apps/faellungslabor/  
**Geprüfter Ausgangsstand:** feature/faellungslabor, Commit 01476d7d2de469d498dd5b11ff7cc651f1c98d3c, Version 1.0.0  
**Zielversion:** 1.1.0 – Bedienung, Darstellung und Aufgabenreihenfolge verbessern; HTML, Web- und mebis-SCORM-1.2-Pakete neu liefern.

## 0. Auftrag und Arbeitsweise

Setze die folgenden sieben Korrekturthemen am bestehenden Labor um. Die sechs nummerierten Nutzerrückmeldungen plus die Zufallsreihenfolge der Antworten sind vollständig berücksichtigt. Das vorhandene Labor gezielt verbessern, nicht neu entwickeln. Den ursprünglichen Build-Auftrag unter prompts/faellungslabor-build-claude.md einschließlich der weiterhin geltenden fachlichen Grenzen beachten; bei widersprechenden Darstellungs-/Bedienvorgaben gilt dieser neuere Auftrag.

Vor Änderungen den aktuellen Branch, Arbeitsstand und geltende AGENTS.md prüfen; fremde Änderungen erhalten. Lies docs/QUALITY.md, docs/MEBIS.md, den bisherigen Testbericht und die unten genannten betroffenen Dateien. Auf einem Korrekturbranch vom aktuellen Implementierungsstand arbeiten, etwa fix/faellungslabor-1.1. Den Auftrag übernehmen, falls er nur auf dem zugehörigen Dokumentationsbranch liegt. Kein automatischer Merge nach main und keine Live-Veröffentlichung.

Implementiere, teste, sieh dir Browsernachweise tatsächlich an, korrigiere gefundene Fehler und prüfe betroffene Abläufe erneut. Liefere fertige neue Nutzerartefakte und einen ehrlichen PASS/HOLD-Bericht. Bestehende Entwicklungsprüfungen gezielt ergänzen. Eine fehlende reale iPad-/mebis-Abnahme bleibt separat HOLD – unverified; sie ersetzt weder Implementierung noch mögliche Browser-/Pakettests.

### Bereits durch Quellenprüfung und gezielte Modellaufrufe bestätigt

- Beschriftung: js/render.js, drawBottles, verwendet 12/11 Weltpixel für Flaschenetiketten; zusätzlich existiert eine separate Formel-/Konzentrationsleiste in drawShelfLabels. Die Flaschenschrift schrumpft mit der gesamten Canvas-Skalierung. Nutzerrückmeldung: auf dem iPad grenzwertig lesbar.
- Identische Probe nachdosieren: js/model.js, rule, Zeilen 180–184 im Ausgangsstand, weist dieselbe Probelösung ab, sobald bereits AgNO₃, NH₃ oder Wasser protokolliert ist. Der Nutzerverdacht ist bestätigt, kein bloß hypothetischer Randfall.
- Auflösen: js/model.js, T.kSusp = 0,30 s⁻¹ und T.kSed = 0,05 s⁻¹. Ein gezielter Node-Modellaufruf mit 2 mL NaCl, 10 AgNO₃-Tropfen, vollständig abgesetztem Niederschlag und anschließend 1 mL NH₃ verdünnt ergibt Gleichgewichtsrest 0 %. Trotzdem verbleiben ohne Schwenken nach 10 s etwa 52,8 %, nach 30 s etwa 6,8 % des ursprünglichen Feststoffs. Mit einmaligem Schwenken: nach 10 s etwa 3,8 %, nach 20 s 0 %. Dies sind Modell-, keine Browser-/Realversuchsmessungen.
- Aufgaben: Aussagen in js/tasks.js haben feste Reihenfolgen; beispielsweise stehen unter ablauf die vier richtigen Aussagen a–d vor den beiden falschen. Auch die Gleichungsoptionen besitzen fest eingetragene Reihenfolgen.
- Reagenzgläser: addTube ist vorhanden, keine entsprechende Löschfunktion. rinse archiviert und ersetzt das Glas sofort durch einen leeren Zustand.

Diese Befunde sind gezielte Quellcode-/Modellprüfungen. Sie stellen keine vollständige unabhängige Abnahme von Version 1.0.0 oder Prüfung der tatsächlich beim Nutzer sichtbaren Pixel dar.

## 1. Größere Flaschenbeschriftung und getrennte Reagenzgruppen

### Soll

Stoffnamen/Formeln müssen auf dem Ziel-iPad bei normaler Ansicht ohne Zoom sofort lesbar sein. Eine Canvas-Vergrößerung darf nicht durch nachfolgendes Herunterskalieren der gesamten Bühne wieder zunichtegemacht werden.

- Im Hauptlabor Probelösungen NaCl/NaBr/NaI als zusammengehörige Gruppe zeigen.
- Deutliche räumliche Lücke und passende Überschriften zwischen Probelösungen und Nachweis-/Prüfreagenzien AgNO₃ / NH₃ verdünnt / NH₃ konzentriert.
- Destilliertes Wasser logisch separat oder eindeutig zugeordnet zeigen; nicht als zusätzliche Halogenidprobe ausgeben.
- Kontrollreiter entsprechend nach Vergleichs-/Wasserproben und Nachweisreagenz gruppieren.
- Stoffname, Formel und bei NH₃ zwingend „verdünnt“/„konzentriert“ priorisieren. Auf schmaler Bühne sinnvoll umbrechen oder Regal aufteilen.
- Als Entwicklungsziel: Stoffname effektiv mindestens 14 CSS-Pixel, Formel beziehungsweise primäre Kurzbezeichnung etwa 16–18 CSS-Pixel. Tatsächliche Bildschirmgröße prüfen, nicht nur Fontwerte im Weltkoordinatensystem.
- Keine Texte durch maxWidth automatisch so zusammendrücken, dass sie wieder winzig werden. Namen vollständig anzeigen oder verständlich auf zwei Zeilen verteilen.
- Gefahrstoffpiktogramme und Informationszugang bleiben eindeutig der richtigen Flasche zugeordnet.
- Hit-Flächen und Pipettenpositionen müssen den neuen Flaschenpositionen folgen; keine veralteten unsichtbaren Klickflächen.
- Lösungsnamen nicht unnötig doppelt auf Flasche und separater Badge-Leiste wiederholen. Platzgewinn aus Abschnitt 6 für Lesbarkeit und Abstand verwenden.

### Nachweis

Vorher-/Nachheransichten bei 1024×768 und 1180×820, zusätzlich Hochformat 820×1180, je hell/dunkel und bei sinnvoll schmalem Bedienfeld. Namen, NH₃-Unterscheidung, Gruppenabstand und bedienbare Infokarten sichtbar nachweisen. Ein reiner Zahlencheck auf Fontgröße genügt nicht.

## 2. „− Glas“ ergänzen

Neben „+ Glas“ einen klar erkennbaren „− Glas“-Button bereitstellen. Gemeint ist das ausgewählte Reagenzglas, nicht stillschweigend irgendein anderes.

- Ohne gewähltes Glas verständlicher Hinweis beziehungsweise deaktivierter Button.
- Leeres ausgewähltes Glas direkt entfernen.
- Bei gefülltem Glas vor Entfernen bestätigen: Der Ansatz wird beendet; gespeicherte Beobachtungen bleiben erhalten. Abbrechen verändert nichts.
- Ein gefülltes Glas vor dem Entfernen kontrolliert entleeren; die Ausgießanimation aus Abschnitt 5 kann wiederverwendet werden.
- Mindestens ein sichtbares Reagenzglas je Reiter erhalten; am Minimum „− Glas“ deaktivieren und kurz erklären.
- Nach dem Entfernen nachvollziehbare neue Auswahl; kein Verweis auf einen ungültigen Slot.
- Nicht nur visible verringern und dadurch ein beliebiges gefülltes letztes Glas unsichtbar zurücklassen.
- Inhalte der übrigen Gläser, Ansatzkennungen, archivierte Protokolle und Antwortzustände erhalten. Slots/IDs so verwalten, dass keine Zuordnung auf ein anderes Glas springt.
- Eine zugehörige laufende Dosierung zuerst stoppen, Tropfen/Transferzustände kontrolliert abschließen; keine später eintreffenden Tropfen in ein entferntes oder neu belegtes Glas.
- +/− wiederholt und in beiden Reitern prüfen, einschließlich Hinzufügen nach Löschen und Wiederherstellung nach Neuladen.

Betroffene Ausgangsstellen insbesondere js/model.js: makeTab/addTube/rinse/Export/Restore, js/app.js: Buttonaktionen/Hit-Flächen/Auswahl und passende HTML-/UI-Teile. Nicht nur einen optischen Button ohne Modellfunktion ergänzen.

## 3. NH₃: Auflösen deutlicher und zügiger darstellen

Nutzerbeobachtung: Auflösen mit verdünnter beziehungsweise konzentrierter Ammoniaklösung ist zu wenig erkennbar oder dauert zu lange. Ursache kann aus zwei Teilen bestehen: tatsächlich zu wenig NH₃ für die vorhandene Fällung oder eine unnötig langsame Darstellungszeit, besonders beim Bodensatz. Beide getrennt untersuchen.

### Soll

- Den vorhandenen geprüften Gleichgewichtsansatz und die Stoffmengenbilanzen erhalten. Keine Änderung von Kₗ, Komplexkonstanten oder Stoffmengen allein für einen gefälligeren Effekt.
- Die didaktischen Lösezeiten so abstimmen, dass ein fachlich erlaubter Lösevorgang nach ausreichender Zugabe und Schwenken rasch und deutlich sichtbar wird.
- Sichtbarer Beginn der Änderung nach Durchmischung innerhalb etwa 1–2 s; für vollständig lösliche Referenzfälle deutliche Klärung innerhalb etwa 5–10 s nach abgeschlossener ausreichender Zugabe und einmaligem Schwenken. Dies sind Visualisierungsziele, keine behaupteten experimentellen Messzeiten.
- Ein reiner Bodensatzfall darf ebenfalls nicht unnötig lange wie „keine Reaktion“ aussehen. Suspendierter und abgesetzter Anteil dürfen weiter unterschiedlich schnell reagieren, solange die Bedienwirkung klar bleibt.
- Verbleibender Gleichgewichtsrest bleibt sichtbar, wenn die zugegebene NH₃-Menge nicht ausreicht. Fehlenden Überschuss nicht durch schnelleres Wegblenden vortäuschen.
- Anleitung knapp präzisieren: ausreichende Ammoniakmenge zugeben und schwenken. Keine zusätzliche Pflichtrechnung und keine riesigen automatisch versteckten Reagenzzugaben.
- AgBr bleibt im vorgesehenen typischen Versuch mit verdünnter NH₃-Lösung weitgehend bestehen, mit ausreichender konzentrierter Lösung deutlich löslich. AgI bleibt sichtbar bestehen.
- Wasserzugabe allein darf nicht dieselbe Klärung wie ausreichende NH₃-Zugabe erzeugen.
- Messungen/Tests ab Ende der Reagenzzugabe auswerten; Transferdauer und chemische Darstellungszeit nicht vermischen.

Referenzserien aus docs/CHEMIE.md wiederverwenden: etwa NaCl 2 mL + 10 Tropfen AgNO₃ + 1 mL NH₃ verdünnt; AgBr mit konzentrierter NH₃ in einer im bestehenden Solver nachweislich ausreichenden Menge. Zusätzlich Fälle mit zu wenig NH₃, AgI sowie Bodensatz vs. geschwenkt vergleichen. Über 1× prüfen, nicht durch pauschales Aktivieren von Zeitraffer kaschieren.

Vorher-/Nachher-Bildfolgen oder kurzes Video mit Zeitpunkten erstellen und ansehen. Falls eine visuelle Zielzeit fachlich unpassend ist, die gemessenen Fälle und den begründeten Kompromiss dokumentieren, statt einen erfolgreichen Nachweis zu erfinden.

## 4. Identische Probelösung später erneut zugeben erlauben

Die bestehende Verbotslogik ist grundsätzlich erwünscht. Die aktuelle Sperre für dieselbe Probe nach anderen Zugaben ist jedoch zu weitgehend.

### Soll

- Dieselbe bereits im Ansatz verwendete Probelösung darf bei freiem Gefäßvolumen erneut zugegeben werden, auch nach AgNO₃ und auch nach NH₃.
- Die Freigabe gilt für dieselbe Lösung aus derselben Quelle; eine andere Halogenidprobe bleibt im vorgesehenen Einzelhalogenidversuch gesperrt.
- Weitere AgNO₃- und NH₃-Zugaben bleiben möglich. Bestehende Sperren für NH₃ vor der Silbernitratprobe und Umfüllen in Vorratsflaschen bleiben erhalten.
- Neu zugegebene Probe erhöht Volumen und Stoffmengen korrekt und kann das Gleichgewicht erneut verschieben. Eine mögliche erneute Fällung nach Komplexierung muss das bestehende Modell ausdrücken können.
- Ansatzkennung und bisheriges Zugabeprotokoll erhalten; Revisions-/Änderungshinweise für ältere Beobachtungen aktualisieren.
- An der Kapazitätsgrenze weiterhin stoppen. Kein Überschreiben, kostenloser Austausch oder stilles Neuanlegen einer frischen Probe.

Pflichttests für NaCl, NaBr, NaI: gleiche Probe mehrfach vor Reagenzien, nach AgNO₃, nach NH₃; jeweils Volumen-/Stoffbilanz und Zugabeereignis prüfen. Zusätzlich andere Probe nach AgNO₃ weiterhin abweisen, volle Gefäße abweisen und anschließend korrekt weiterarbeiten können.

## 5. Sichtbares Ausgießen beim Spülen/Entleeren

Beim bisherigen „Spülen“ wird das Glas unmittelbar leer. Ergänze eine kurze, zum Zustand passende Handlung:

1. ausgewähltes Reagenzglas anheben,
2. über ein geeignetes klar bezeichnetes Auffanggefäß für silberhaltigen Abfall kippen,
3. Flüssigkeit und gegebenenfalls Niederschlag sichtbar ausgießen,
4. leeres Glas zurück in den Ständer setzen.

Das Auffanggefäß kann platzsparend nur während der Handlung am Bühnenrand erscheinen. Ziel ist eine anschauliche Animation von etwa 1,5–3 s; keine zusätzliche verpflichtende Entsorgungsaufgabe oder neue chemische Versuchsreihe.

- Flüssigkeitsspiegel, Schräglage, Austrittsstelle und Strahl müssen zusammenpassen; Strahl trifft die Gefäßöffnung.
- Nicht vorab chemisch leeren und danach eine unverbundene volle Attrappe ausgießen.
- Keine Flüssigkeit durch Glas oder Tisch. Relevante Stoffmengen gehen nachvollziehbar in den entsorgten/archivierten Zustand, nicht in andere Versuchsgläser.
- Archivierung genau einmal; die anderen Ansätze und der Lernstand bleiben erhalten.
- Mehrfachklick, Tabwechsel, Pause, Fokusverlust und Neuladen während der Handlung hinterlassen einen stabilen Zustand, keine doppelte Archivierung oder blockierte App.
- Bei reduzierter Bewegung kurze vereinfachte Darstellung mit nachvollziehbarem Abschluss.
- Entfernen eines gefüllten Glases nach Abschnitt 2 darf denselben Ablauf verwenden.

Ein zusätzlicher sichtbarer kurzer Nachspüleffekt ist optional. Keine exakte Wasser-Reinigungsphysik und keine neue Pflicht zur manuellen Reinigung implementieren.

## 6. Konzentrationsanzeigen: Schwerpunkt qualitative Beobachtung

Dieser Abschnitt enthält den ausdrücklich als Vorschlag diskutierten Darstellungsansatz: größere Stoffkennzeichnung und mehr Platz, indem exakte Konzentrationen in die antippbare Informationskarte verlagert werden. Er ist die empfohlene Standardausführung dieses Korrekturauftrags; neuere Nutzerentscheidungen haben Vorrang.

- Dauerhaft sichtbar: verständlicher Stoffname und Formel; bei NH₃ deutlich „verdünnt“ oder „konzentriert“.
- Die separaten zusätzlichen Konzentrationsetiketten unter den Flaschen entfallen.
- Exakte Konzentrationen bleiben bei Antippen in der Informations-/Gefahrstoffkarte erreichbar. Dort Stoffname, Konzentration, Piktogramme und zugehörige Quelleninformationen konsistent erhalten.
- Für die Schülerauswertung keine Konzentrationsrechnung, keine Bestimmung von Stoffmengen oder NH₃-Mindestvolumina ergänzen.
- Bestehende Konzentrationen und der funktionierende Solver bleiben intern erhalten. Das Ausblenden einer Zahl ist kein Anlass für einen riskanten Modellumbau.
- Die Menge des Niederschlags reagiert weiterhin plausibel auf die tatsächlichen Zugaben und auf verbleibende reagierende Ionen.
- Dosiervolumen/Füllstand dürfen als Bedienorientierung bleiben; zusätzliche permanente Zahlenleisten auf das Nötige beschränken.
- Die Unterscheidung verdünnter/konzentrierter Ammoniaklösung bleibt als qualitativ entscheidendes Merkmal sichtbar und ist keine verzichtbare Detailzahl.
- Lösungsbezogene Gefahrstoffinformationen behalten ihre richtige Konzentrationsgrundlage, auch wenn diese nicht mehr dauerhaft auf der Bühne steht.

Nutzen: Der Schülerauftrag bleibt qualitativ; die Infokarte bewahrt die vollständigen Stoffinformationen. Der frei gewordene Platz dient den größeren Flaschennamen und klaren Gruppenabständen, nicht einer neuen Informationsleiste.

## 7. Antwortmöglichkeiten zufällig mischen

Richtige und falsche Lösungen sind derzeit teilweise in erkennbaren Blöcken angeordnet. Mische die Darstellung der Antwortoptionen pro neuem Durchgang zufällig.

- Gilt für Aussagen mit Mehrfachauswahl und Einfachauswahl sowie für die angebotenen vollständigen/falschen Gleichungen. Zuordnungsoptionen ebenfalls sinnvoll mischen.
- Die didaktische Reihenfolge der Lernschritte bleibt erhalten. Keine Summanden einer chemischen Gleichung zufällig durcheinanderwürfeln.
- Einmal je neuem Durchgang beziehungsweise neuer Aufgabeninstanz eine Permutation erzeugen; beim normalen Rendern/Prüfen nicht erneut mischen.
- Reihenfolge beim Ankreuzen, Prüfen, Korrigieren, Hilfeaufruf, Tabwechsel und Neuladen beibehalten. Erst ein ausdrücklich neuer Durchgang erzeugt neue Permutationen.
- Antwortdaten über stabile fachliche IDs bewerten, nicht über sichtbare Position oder neu vergebene Buchstaben. Richtige Antwortmenge, individuell passende Fehlerrückmeldungen und Musterlösung bleiben trotz geänderter Reihenfolge korrekt.
- Aktuelle gespeicherte Antworten beim Laden weiter richtig zuordnen; nötige Datenmigration sauber behandeln. Alte gespeicherte Buchstaben nicht unbemerkt als andere fachliche Aussagen auswerten.
- Fisher-Yates oder gleichwertiges korrektes Verfahren verwenden; keine unzuverlässige Sortierung mit zufälligem Vergleich.
- Kein erzwungenes „richtig/falsch im Wechsel“-Muster. Zufall darf gelegentlich dieselbe Reihenfolge liefern; Tests dürfen deswegen nicht sporadisch fehlschlagen.
- Tests mit festgelegten Seeds/Permutationen: richtige Auswahl an unterschiedlichen Positionen, teilweise richtig, falsch, leer und „alles gewählt“. Testwerte müssen unabhängig vom Renderindex bleiben.
- Hilfen/Lösungen und Tastatur-/Fokusbedienung weiterhin vollständig funktionsfähig.

## 8. Erhaltene Grenzen und Regressionen

Unverändert gelten insbesondere:
- NaCl, NaBr, NaI; keine Bariumbromidprobe.
- Kontrollreiter unabhängig und freiwillig; Hauptversuche ohne Besuch abschließbar.
- Wasserproben als nicht eindeutig analysierbare Mischfällungen.
- Carbonat und Salpetersäure nur optionale Auswertung, keine Flaschen oder Versuchsschritte.
- Vollständige Ionengleichungen einschließlich Zuschauerionen und aq/s in der Aufgabenauswahl.
- Kurzer immer erreichbarer Hefteintrag mit vereinfachter allgemeiner Gleichung; Kontrollzusatz separat.
- Keine Pflicht zum Ionenpuzzle, keine Freitextbewertung und keine zusätzlichen Berechnungsaufgaben.
- Hell/dunkel ändert die Darstellung, nicht die Chemie.
- Eigenständige offlinefähige Dateien, keine neuen externen Laufzeitdienste, keine Lern-/Personendatenübertragung an das LMS.
- Keine Änderungen an anderen SiVex-Apps, solange keine gemeinsame Bibliothekskorrektur tatsächlich notwendig ist.

## 9. PASS/HOLD-Matrix für die Korrekturfassung

Jede Zeile im neuen Testbericht mit Soll/Ist, Daten, Prüfschritten und konkretem Nachweis dokumentieren. Ausgangszustand, Browser/Viewport, Artefaktversion und real/emuliert angeben. Die bestehenden FL-Prüfungen weiterführen; diese Matrix ergänzt sie.

| ID | Prüffall | PASS | HOLD |
|---|---|---|---|
| FK01 | Beschriftung und Gruppen | Lesbare größere Namen/Formeln, klarer Abstand, NH₃ eindeutig; Nachweis auf Tabletgrößen in hell/dunkel | Weiter winzig, gequetscht, überlappt oder Stoff nicht eindeutig |
| FK02 | Neue Positionen/Infokarten | Sichtbares Objekt, Pipette und Hit-Fläche deckungsgleich; alle Karten erreichbar | Falsche Flasche reagiert oder verdeckte/versetzte Klickflächen |
| FK03 | Leeres Glas entfernen | Ausgewähltes Glas entfernt; +/− bis Grenzen korrekt, mindestens eines bleibt | Falsches Glas weg, unsichtbare Restansätze oder ungültige Auswahl |
| FK04 | Gefülltes Glas entfernen | Bestätigung/Abbruch korrekt; übrige Gläser und Protokolle erhalten | Datenverlust, falsche Archivzuordnung oder ungefragtes Löschen |
| FK05 | Entfernen bei aktiver Zugabe | Kein Nachdosieren in entfernten Slot, keine Doppelbuchung, weiterer Betrieb möglich | Geistertropfen, falscher Ansatz, Hänger |
| FK06 | Identische Probe nach AgNO₃ | Für alle drei Halogenide erlaubt, richtige Mengen/Volumina und Revisionsnummer | Bisherige Sperre bleibt oder Ansatz wird ersetzt |
| FK07 | Identische Probe nach NH₃ | Erlaubt, Gleichgewicht und mögliche neue Fällung konsistent | Falsche Stoffmengen, nicht aktualisierte Chemie oder Sperre |
| FK08 | Weiterhin ungültige Aktionen | Andere Probe, NH₃ vor AgNO₃, volle Gefäße/Umfüllen weiter korrekt abgefangen | Schutz pauschal entfernt oder berechtigte Zugaben blockiert |
| FK09 | Lösliche NH₃-Referenzfälle | Auflösen nach ausreichender Zugabe sichtbar schneller/deutlicher; 1×-Zeitreihe und Chemiegrenze belegt | Nur Zeitraffer, Reaktion unsichtbar oder Konstanten für Optik verfälscht |
| FK10 | NH₃-Gegen-/Grenzfälle | Zu wenig NH₃ lässt Rest; AgBr/verdünnt typischerweise beständig, AgI bleibt; Wasser kein Ersatz | Alles verschwindet oder Verdünnung als Komplexbildung dargestellt |
| FK11 | Ausgießanimation | Anheben/Kippen/Strahl/Abfallziel/leer zurück sichtbar und zustandsgekoppelt | Bloße Leerung, falscher Strahl, Durchdringen oder doppelte Archivierung |
| FK12 | Ausgießen unter Abbruch | Mehrfachklick, Pause, Tabwechsel, Fokusverlust und Reload stabil; übrige Ansätze erhalten | Gesperrte App, doppelte Entsorgung oder Verlust anderer Gläser |
| FK13 | Konzentrationsdarstellung | Hauptansicht kompakt; genaue Angaben per Infokarte; NH₃-Unterscheidung und interne Modellwerte erhalten | Konzentrationsgrundlage verloren, NH₃ verwechselt oder neue Rechenpflicht |
| FK14 | Zufällige Reihenfolge | Unterschiedliche testbare Permutationen; fachliche Antwort-IDs und Feedback richtig | Feste richtige Position, Indexbewertung oder zerstörte Zuordnung |
| FK15 | Reihenfolge bleibt stabil | Antworten/Prüfen/Hilfe/Tab/Reload ändern laufende Anordnung nicht; neuer Durchgang kann neu mischen | Optionen springen beim Antworten oder gespeicherte Auswahl wird falsch |
| FK16 | Altzustände und Speicher | Bestehende Daten korrekt übernommen oder kontrolliert erklärt migriert; Speicherfehler abgefangen | Stillschweigend falsch bewertete Altantworten oder unlesbare Sitzung |
| FK17 | Gesamter Lernweg | Kernversuche, NH₃, Kontrollen, Gleichungen, Hilfen und kurzer Hefteintrag weiter funktionsfähig | Regression, Kontrollpflicht oder fachlich falsche Auswertung |
| FK18 | HTML/Web/SCORM | Frische neue Artefakte jeweils entpackt/isoliert getestet; offline, file/HTTP und Mock-LMS korrekt | Alte Pakete, Quellbaumabhängigkeit, fehlende Ressourcen oder LMS-Fehler |
| FK19 | Version/Prüfsummen | 1.1.0 in App/Metadaten/Manifest/Paketen, aktuelle SHA256SUMS, dokumentierter Quellstand | Versionsmix oder Paket passt nicht zu geprüftem Code |
| FK20 | Reales iPad und mebis | Für neue Version tatsächlich durchgespielt und separat belegt | Konkreter Fehler = failed; kein echter Test = unverified |

Empfohlene Blickgrößen: 1024×768, 1180×820, 1440×900 und 820×1180; schmaler Splitter, helle/dunkle Ansicht, 1× und reduzierte Bewegung. Mindestens eine tatsächlich laufende NH₃-Lösefolge und eine Ausgießfolge ansehen, keine reinen Endbilder als Animationsnachweis.

## 10. Build, Korrekturschleife und Auslieferung

Bestehende reproduzierbare Befehle nutzen/gezielt erweitern:
~~~sh
cd apps/faellungslabor
npm ci
npm test
npm run build
npm run package
npm run test:e2e
npm run test:scorm
npm run test:all
~~~

Prüfungen passend zu den Änderungen ergänzen. Nach letzter Implementierungsänderung Pakete neu bauen und relevante Artefakt-/Browserprüfungen erneut gegen diese Fassung durchführen. Gefundene Fehler beheben und gezielt nachprüfen; Tests nicht an einen Fehler anpassen.

Liefere:
- release/faellungslabor-1.1.0.html
- release/faellungslabor-1.1.0-web.zip
- release/faellungslabor-1.1.0-scorm12.zip
- release/SHA256SUMS.txt
- aktualisierte README, CHANGELOG, sivex.json, BEDIENUNG/CHEMIE und TESTBERICHT samt FK01–FK20 und FL-Regressionen;
- relevante Vorher-/Nachherbilder, Löse-/Ausgieß-Bildfolgen und maschinenlesbare Testergebnisse.

Auf main/Release-Verzeichnis gemäß Repositoryregel nur die aktuelle ausgelieferte Version führen; alte Fassungen bleiben über Git erreichbar. Keine unübersichtliche Sammlung gleichnamiger „final“-Dateien. Andere Labore und deren Pakete erhalten.

**Entwicklungs-PASS:** FK01–FK19 nachgewiesen, ursprünglicher Pflichtumfang erhalten, Tests/Build/Artefakte bestanden. **Unterrichtsfreigabe:** zusätzlich tatsächliches iPad/mebis und fachlich-visuelle Lehrkraftabnahme der neuen Version. Fehlende reale Tests ehrlich HOLD – unverified; ohne diese kein ready-Status.

Abschluss knapp: Was geändert, wie getestet, welche Nutzerartefakte, geprüfter Commit, verbleibende konkrete HOLDs. Kein „fertig“ allein aufgrund eines grünen Builds.
