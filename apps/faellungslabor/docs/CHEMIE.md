# Fällungslabor 1.0.0 – Fachmodell, Parameter und Grenzen

Zielniveau: Gymnasium, Einführung in Ionen, Fällungsreaktionen und qualitative Nachweise (LehrplanPLUS Chemie 8 NTG, Lernbereich 4: „Ionennachweise: Fällungsreaktionen (Halogenid-, … Silber-Ionen)“; Chemie 9, Lernbereich 4: Ionen und Salze – Ionennachweise dort nicht ausdrücklich, daher als Ergänzung). Die Ammoniakprüfung ist eine Erweiterung. Belege: [`QUELLEN.md`](QUELLEN.md).

## 1. Vorratslösungen

| Flasche | Konzentration | Herleitung / Hinweis |
| --- | --- | --- |
| Silbernitratlösung, AgNO₃(aq) | 0,100 mol/L (w ≈ 1,7 %) | Vorgabe; braune Flasche |
| Natriumchlorid-, -bromid-, -iodidlösung | je 0,100 mol/L | Vorgabe; **NaBr** (nicht BaBr₂) |
| Ammoniaklösung, verdünnt | **2,0 mol/L** (w ≈ 3,4 %) | Startwert bestätigt, siehe 4 |
| Ammoniaklösung, konzentriert | **w = 25 %, c ≈ 13,3 mol/L** | c = w·ρ/M = 0,25 · 907 g/L / 17,031 g/mol = 13,31 mol/L (ρ(20 °C) ≈ 0,903–0,91 g/mL laut SDB); Startwert 13,0 mol/L auf 13,3 mol/L präzisiert |
| Destilliertes Wasser | – | idealisiert ohne gelöste Ionen |
| Leitungs-, Mineralwasser | Modellproben | nur im Kontrollteil, siehe 6 |

Kein Carbonat, keine Salpetersäure, keine Feststoffe, keine Waage. Ein Modelltropfen ist **0,050 mL** (Simulationsparameter). Probevolumen 1,00 / 2,00 / 3,00 mL (Standard 2,00 mL). Reagenzglas: Innenradius 1,0 cm mit Halbkugelboden, Fassungsvermögen **20 mL** (Glasrand bei 82 mm, Füllgrenze 67 mm).

## 2. Zustand je Ansatz (DOM-frei, `js/model.js`)

Ein Reagenzglas führt einen Ansatz mit Kennung (A1, A2 … bzw. K1 … im Kontrollteil):

- Volumen V und eingebrachte Stoffmengen **Na⁺, NO₃⁻, Ag (gesamt), X⁻ (gesamt), NH₃ (gesamt)**, bei Wasserproben **F** (fällbare Ag⁺-Äquivalente);
- Feststoff in drei Bereichen: **Wolken** (frisch gefällt am Eintreffpunkt), **Schwebe** (verteilt, mit Absetzfront), **Bodensatz**;
- Zugabeprotokoll (Probevolumen, Tropfen AgNO₃, mL NH₃ verdünnt/konzentriert, mL Wasser) und eine Revisionsnummer.

Gelöstes ergibt sich immer als Differenz: gelöstes Ag = Ag_ges − Feststoff, gelöstes X⁻ = X_ges − Feststoff. Damit sind Silber-, Halogenid- und Zuschauerionenbilanz durch die Konstruktion erfüllt; Na⁺ und NO₃⁻ werden nie verändert. Wasser erhöht nur V. Gebucht wird erst beim Eintreffen eines Tropfens bzw. Strahlanteils an der Oberfläche.

## 3. Gleichgewichtsmodell für Chlorid, Bromid, Iodid (`js/chem.js`)

Gekoppelt, für genau ein Halogenid je Ansatz:

| Gleichgewicht | Konstante (25 °C, I = 0) |
| --- | --- |
| AgCl(s) ⇌ Ag⁺ + Cl⁻ | pKₗ = 9,74 (Kₗ = 1,82·10⁻¹⁰ mol²/L²) |
| AgBr(s) ⇌ Ag⁺ + Br⁻ | pKₗ = 12,30 (5,01·10⁻¹³) |
| AgI(s) ⇌ Ag⁺ + I⁻ | pKₗ = 16,08 (8,32·10⁻¹⁷) |
| Ag⁺ + NH₃ ⇌ [Ag(NH₃)]⁺ | lg K₁ = 3,31 |
| [Ag(NH₃)]⁺ + NH₃ ⇌ [Ag(NH₃)₂]⁺ | lg K₂ = 3,91 → lg β₂ = 7,22 |

Gelöst wird nach der freien Ag⁺-Konzentration a: Aus der NH₃-Bilanz folgt das freie NH₃ (quadratische Gleichung), aus Ag- und X-Bilanz mit [Ag⁺][X⁻] = Kₗ die Feststoffmenge (Bisektion auf lg a, monotone Funktion). Ist kein Feststoff stabil, wird die Ag-Verteilung ohne Kₗ gelöst. Prüfung: alle Bilanzen (Ag, NH₃) mit relativer Abweichung < 10⁻⁸, Kₗ bei Feststoff erfüllt, keine negativen, unendlichen oder NaN-Werte (Raster über 3 Halogenide × 6 Tropfenzahlen × 5 NH₃-Mengen × 2 Konzentrationen).

**Vernachlässigt (dokumentierte Modellgrenzen):** Aktivitätskoeffizienten (I = 0), Protolyse von NH₃ (bei 2 mol/L < 0,5 %), Ag₂O-Bildung bei Silberüberschuss und wenig NH₃, Lichtzersetzung (nicht beauftragt), Mischhalogenide (nur ein Halogenid je Ansatz; eine zweite andere Probe ist außerhalb der Anleitung).

### Gesamtkonstante und Folgen für den Versuch

AgX(s) + 2 NH₃ ⇌ [Ag(NH₃)₂]⁺ + X⁻ mit K = Kₗ·β₂: Cl 3,0·10⁻³; Br 8,3·10⁻⁶; I 1,4·10⁻⁹. Für vollständiges Auflösen gilt näherungsweise n(NH₃, frei) ≥ √(n(AgX)·n(X⁻, gesamt)/K) – das Volumen kürzt sich heraus. Deshalb zählt die **zugegebene Menge** Ammoniak und der **Halogenidüberschuss** (wenig AgNO₃ zu viel Probe), nicht die Flasche allein. Wasser allein löst praktisch nichts (10 mL Wasser lösen von 5·10⁻⁵ mol AgCl rund 4 ppm, Handrechnung V·Kₗ/[Cl⁻]).

## 4. Referenzfälle (unabhängige Handrechnung, Toleranz vorab festgelegt)

Referenz: Fixpunkt-Iteration der Näherung x·(X_ex + x) = K·(N − 2x)² (nur [Ag(NH₃)₂]⁺, ohne freies Ag⁺ und [Ag(NH₃)]⁺) bzw. geschlossene Formeln; sie benutzt den Solver nicht. Toleranz Solver ↔ Näherung: 0,5 % relativ (Fehler der Näherung < 0,1 %); Mengenbilanzen 10⁻⁶ relativ. Tests: `tests/unit/chem.test.js`.

| Fall | Ansatz | Rest Feststoff (Modell) | Rest (Näherung) |
| --- | --- | --- | --- |
| R1 | 2 mL NaCl + 10 Tr. AgNO₃ | 100 % (gelöst V·Kₗ/[Cl⁻] = 7,6·10⁻¹² mol) | gleich |
| R2 | 2 mL NaCl + 40 Tr. (Äquivalenz) | gelöst V·√Kₗ = 5,4·10⁻⁸ mol | gleich |
| R3 | 2 mL NaCl + 60 Tr. (Ag-Überschuss) | 2,0·10⁻⁴ mol – Fällung durch Cl⁻ begrenzt | gleich |
| R4 | AgCl (10 Tr.) + 0,50 mL NH₃ 2 M | 66,2 % | 66,2 % |
| R5 | AgCl (10 Tr.) + 0,90 / 1,00 mL NH₃ 2 M | 9,6 % / 0 % (Schwelle 0,96 mL) | gleich |
| R6 | AgBr (10 Tr.) + 2,5 / 5 mL NH₃ 2 M | 97,3 % / 89,3 % | gleich |
| R7 | AgBr (10 Tr.) + 2,5 mL NH₃ 13,3 M | 6,9 % | 6,9 % |
| R8 | AgI (10 Tr.) + 10 mL NH₃ 13,3 M | 99,7 % | 99,7 % |
| R9 | RSC-Versuch: 3 mL Probe + 3 Tr.; gleiches Volumen NH₃ 2 M bzw. Glas fast voll mit konz. | AgCl 0 %; AgBr 93 % bzw. 0 %; AgI 98,7 % | gleich |

R9 entspricht den Beobachtungen der RSC-Vorschrift (AgCl löst sich im gleichen Volumen verdünnter Ammoniaklösung, AgBr erst, wenn konzentrierte Ammoniaklösung das Glas fast füllt, AgI nicht). **Ergebnis zu den Startwerten:** 2,0 mol/L und konzentriert (25 %) liefern im typischen Versuchsbereich (wenige bis 10 Tropfen AgNO₃ auf 2 mL Probe, 0,5–3 mL Ammoniaklösung) genau die verlangte Abstufung; beide Werte werden beibehalten (konzentriert präzisiert auf 13,3 mol/L). Grenzfall: Sehr wenig AgBr (1–2 Tropfen) kann sich auch in viel verdünnter Ammoniaklösung lösen – das ist chemisch richtig und in der Lehrkraftinformation erwähnt.

## 5. Zeitlicher Ablauf (Darstellung, keine Messwerte)

| Vorgang | Parameter bei 1× |
| --- | --- |
| Fällung | sofort beim Eintreffen, stöchiometrisch nach Abschnitt 3 |
| lokale Wolke → verteilt | 3,0 s, Wolke sinkt und breitet sich aus |
| Absetzen | Front erreicht den Boden nach 40 s; Konzentration unter der Front bleibt gleich |
| Schwenken | 1,3 s Bewegung; Wolken und Bodensatz → Schwebe, Front zurück |
| Auflösen (NH₃) | erster Ordnung: Schwebe 0,30 s⁻¹, Bodensatz 0,05 s⁻¹ (× Triebkraft 1 − p_GG/p) plus 1 % der Höchstmenge je s; nie unter p_GG |
| Pipette | Tropfen: Tippen = 1, Halten = erster sofort, dann alle 0,38 s; Mindestabstand 0,16 s; Strahl 1,0 mL/s (Probe) bzw. 0,8 mL/s (Dosierhilfe) |

Pause hält alles an; 5× beschleunigt nur, solange kein Handgriff läuft (sonst höchstens 1×). Bedienen beendet die Pause (SiVex-Regel 4).

## 6. Alltagswasser – phänomenologisches Mischfällungsmodell

Bewusst **keine** Wasseranalytik: Jede Wasserprobe hat einen festen Wert F an Ag⁺-Äquivalenten, die mit Silberionen schwer lösliche Verbindungen bilden; gefällt wird min(Ag, F) – stöchiometrisch, ohne Kₗ.

| Probe | F (mmol/L) | davon als Chlorid angenommen | Darstellung |
| --- | --- | --- | --- |
| Leitungswasser | 0,9 | 0,6 (≈ 21 mg/L Cl⁻) | weißlich, leicht grau-beige |
| Mineralwasser | 1,6 | 1,0 (≈ 35 mg/L Cl⁻) | weißlich, leicht grau-beige |
| destilliertes Wasser | 0 | 0 | klar |

Die Werte sind repräsentative Modellwerte (Größenordnung typischer Trinkwasser-Chloridgehalte); der Rest steht summarisch für weitere Anionen (z. B. carbonatbedingte Fällung). Das Modell behauptet nicht, dass jedes reale Wasser gleich reagiert, und erlaubt **keine** Zuordnung zu Chlorid/Bromid/Iodid. Verbindliche Aussage der Auswertung siehe Kontrollteil; Carbonat und das Ansäuern mit Salpetersäure stehen nur in einer zugeklappten, freiwilligen Erläuterung.

## 7. Farben und Sichtbarkeit (Darstellungsparameter)

| Feststoff | Pigment (sRGB) | Ziel |
| --- | --- | --- |
| AgCl | 246, 246, 241 | weiß |
| AgBr | 236, 226, 188 | cremefarben bis schwach gelb |
| AgI | 238, 225, 146 | blassgelb, deutlich von AgBr unterscheidbar, nicht schwefelgelb |

Abgleich mit den Beschreibungen fotografisch dokumentierter Versuche (RSC: weiß / creme, off-white / gelb; chemguide: weiß / sehr blass creme / sehr blass gelb; UC Davis: AgBr weiß bis hellgelb, AgI gelb). AgI wurde bewusst zur blassen Seite gewählt. Gemessen im Browser (E03, dunkler Hintergrund): Gelbanteil ((R+G)/2 − B)/255 = 0,01 / 0,13 / 0,26. Ein Pixelabgleich mit realen Fotos war in der Entwicklungsumgebung nicht möglich; die visuelle Abnahme der Farben ist Teil von FL34.

Trübung: Deckkraft = 0,85·(1 − exp(−√(c/4 mmol/L))), c = Feststoff in der Schwebe je Volumen unter der Absetzfront. Dadurch unterscheiden sich 1, 5 und 20 Tropfen deutlich (Test E07), und Glas, klarer Überstand und Bodensatz bleiben erkennbar. Bodensatzvolumen: 4,0 mL je mmol (lockerer, flockiger Niederschlag; Darstellungsparameter).

## 8. Grenzen der Anleitung (vor jedem Stofftransfer geprüft)

Abgewiesen (Zustand unverändert, Verbotszeichen mit Text „Dieser Vorgang entspricht nicht der Experimentieranleitung.“ und kurzer Begründung): Ammoniaklösung vor der Silbernitratlösung; zweite, andere Probe in denselben Ansatz; Probe nach anderen Zugaben; Silbernitrat, Ammoniak oder Wasser in ein leeres Glas; Pipette in eine Vorratsflasche (Umfüllen). Erlaubt bleiben weitere AgNO₃-Zugaben, wiederholte NH₃-Zugaben, Schwenken, Wasserzugabe, Spülen und frische Gläser. Die Rückmeldung beschreibt den Versuchsumfang, keine chemische Unmöglichkeit.

## 9. Gleichungen

Pflicht in den Aufgaben (vollständige Ionengleichungen):

```text
Na⁺(aq) + Cl⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgCl(s) + Na⁺(aq) + NO₃⁻(aq)
Na⁺(aq) + Br⁻(aq) + Ag⁺(aq) + NO₃⁻(aq) → AgBr(s) + Na⁺(aq) + NO₃⁻(aq)
Na⁺(aq) + I⁻(aq)  + Ag⁺(aq) + NO₃⁻(aq) → AgI(s)  + Na⁺(aq) + NO₃⁻(aq)
```

Hefteintrag: Ag⁺(aq) + X⁻(aq) → AgX(s). Vertiefung (freiwillig, aufklappbar): Ag⁺(aq) + 2 NH₃(aq) → [Ag(NH₃)₂]⁺(aq).
