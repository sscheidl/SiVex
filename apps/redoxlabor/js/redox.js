/*
 * Redoxlabor – Redoxgleichungen und Redoxtrainer
 *
 * Schulische Vereinfachung: Das Oxidationsprodukt wird als Carbonsäure mit
 * protonierter Carboxygruppe (R–COOH) geschrieben, obwohl im alkalischen
 * Milieu tatsächlich das Carboxylat-Ion überwiegt. Beide Schreibweisen sind
 * atom- und ladungsmäßig ausgeglichen; die fachlich genauere Form mit R–COO⁻
 * steht in EQUATIONS_PRECISE und wird in der Musterlösung zusätzlich gezeigt.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.RL = root.RL || {}).redox = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------ Formelparser
  /**
   * Zerlegt eine Teilchenformel in Atome und Ladung.
   * Unterstützt Klammern ( ) [ ], Indizes, "R" als organischen Rest,
   * Bindestriche (R-CHO) und Ladungen am Ende (2+, +, -, 3-).
   * "e-" ist das Elektron.
   */
  function parseFormula(f) {
    if (f === 'e-') return { atoms: {}, charge: -1 };
    let s = f.replace(/[–-](?=[A-Z(\[])/g, ''); // Bindungsstriche entfernen
    let charge = 0;
    const cm = /(\d*)([+-])$/.exec(s);
    if (cm) {
      charge = (cm[1] ? +cm[1] : 1) * (cm[2] === '+' ? 1 : -1);
      s = s.slice(0, cm.index);
    }
    let i = 0;
    function group() {
      const atoms = {};
      while (i < s.length) {
        const ch = s[i];
        if (ch === '(' || ch === '[') {
          i++;
          const inner = group();
          i++; // schließende Klammer
          const n = num();
          for (const k in inner) atoms[k] = (atoms[k] || 0) + inner[k] * n;
        } else if (ch === ')' || ch === ']') {
          return atoms;
        } else if (/[A-Z]/.test(ch)) {
          let el = ch; i++;
          while (i < s.length && /[a-z]/.test(s[i])) el += s[i++];
          const n = num();
          atoms[el] = (atoms[el] || 0) + n;
        } else {
          throw new Error('Unerwartetes Zeichen "' + ch + '" in ' + f);
        }
      }
      return atoms;
    }
    function num() {
      let d = '';
      while (i < s.length && /\d/.test(s[i])) d += s[i++];
      return d ? +d : 1;
    }
    return { atoms: group(), charge };
  }

  /** Atom- und Ladungsbilanz einer Gleichung [{n, f}] → [{n, f}]. */
  function balance(eq) {
    const side = (list) => {
      const atoms = {}; let charge = 0;
      for (const { n, f } of list) {
        const p = parseFormula(f);
        for (const k in p.atoms) atoms[k] = (atoms[k] || 0) + p.atoms[k] * n;
        charge += p.charge * n;
      }
      return { atoms, charge };
    };
    const L = side(eq.left), R = side(eq.right);
    const keys = new Set([...Object.keys(L.atoms), ...Object.keys(R.atoms)]);
    const diff = {};
    let ok = L.charge === R.charge;
    for (const k of keys) {
      if ((L.atoms[k] || 0) !== (R.atoms[k] || 0)) { ok = false; diff[k] = [(L.atoms[k] || 0), (R.atoms[k] || 0)]; }
    }
    return { ok, left: L, right: R, diff };
  }

  // ------------------------------------------------------------ Darstellung
  const HTML = {
    'R-CHO': 'R–CHO',
    'R-COOH': 'R–COOH',
    'R-COO-': 'R–COO<sup>–</sup>',
    'OH-': 'OH<sup>–</sup>',
    'H2O': 'H<sub>2</sub>O',
    'e-': 'e<sup>–</sup>',
    'Cu2+': 'Cu<sup>2+</sup>',
    'Cu2O': 'Cu<sub>2</sub>O',
    '[Ag(NH3)2]+': '[Ag(NH<sub>3</sub>)<sub>2</sub>]<sup>+</sup>',
    'Ag': 'Ag',
    'NH3': 'NH<sub>3</sub>',
    'H+': 'H<sup>+</sup>'
  };
  const html = (f) => HTML[f] || f;

  function eqToHtml(eq, opts) {
    const o = opts || {};
    const part = (list) => list.map(({ n, f }) => `${n > 1 ? `<b class="coef">${n}</b>&#8239;` : ''}<span class="sp">${html(f)}</span>`).join(' + ');
    return `${part(eq.left)} ${o.arrow || '→'} ${part(eq.right)}`;
  }

  // ------------------------------------------------------------ Gleichungen
  const OXIDATION = {
    left: [{ n: 1, f: 'R-CHO' }, { n: 2, f: 'OH-' }],
    right: [{ n: 1, f: 'R-COOH' }, { n: 1, f: 'H2O' }, { n: 2, f: 'e-' }]
  };
  const EQUATIONS = {
    fehling: {
      oxidation: OXIDATION,
      reduction: {
        left: [{ n: 2, f: 'Cu2+' }, { n: 2, f: 'OH-' }, { n: 2, f: 'e-' }],
        right: [{ n: 1, f: 'Cu2O' }, { n: 1, f: 'H2O' }]
      },
      total: {
        left: [{ n: 1, f: 'R-CHO' }, { n: 2, f: 'Cu2+' }, { n: 4, f: 'OH-' }],
        right: [{ n: 1, f: 'R-COOH' }, { n: 1, f: 'Cu2O' }, { n: 2, f: 'H2O' }]
      }
    },
    tollens: {
      oxidation: OXIDATION,
      reduction: {
        left: [{ n: 2, f: '[Ag(NH3)2]+' }, { n: 2, f: 'e-' }],
        right: [{ n: 2, f: 'Ag' }, { n: 4, f: 'NH3' }]
      },
      total: {
        left: [{ n: 1, f: 'R-CHO' }, { n: 2, f: '[Ag(NH3)2]+' }, { n: 2, f: 'OH-' }],
        right: [{ n: 1, f: 'R-COOH' }, { n: 2, f: 'Ag' }, { n: 4, f: 'NH3' }, { n: 1, f: 'H2O' }]
      }
    }
  };

  /**
   * Fachlich genauere Schreibweise im alkalischen Ansatz: Carboxylat-Ion statt
   * Carbonsäure. Die Komplexierung von Cu(II) durch Tartrat bleibt vereinfacht.
   * Vgl. RSC Education, „The silver mirror test with Tollens' reagent“.
   */
  const OXIDATION_PRECISE = {
    left: [{ n: 1, f: 'R-CHO' }, { n: 3, f: 'OH-' }],
    right: [{ n: 1, f: 'R-COO-' }, { n: 2, f: 'H2O' }, { n: 2, f: 'e-' }]
  };
  const EQUATIONS_PRECISE = {
    fehling: {
      oxidation: OXIDATION_PRECISE,
      reduction: EQUATIONS.fehling.reduction,
      total: {
        left: [{ n: 1, f: 'R-CHO' }, { n: 2, f: 'Cu2+' }, { n: 5, f: 'OH-' }],
        right: [{ n: 1, f: 'R-COO-' }, { n: 1, f: 'Cu2O' }, { n: 3, f: 'H2O' }]
      }
    },
    tollens: {
      oxidation: OXIDATION_PRECISE,
      reduction: EQUATIONS.tollens.reduction,
      total: {
        left: [{ n: 1, f: 'R-CHO' }, { n: 2, f: '[Ag(NH3)2]+' }, { n: 3, f: 'OH-' }],
        right: [{ n: 1, f: 'R-COO-' }, { n: 2, f: 'Ag' }, { n: 4, f: 'NH3' }, { n: 2, f: 'H2O' }]
      }
    }
  };

  // ------------------------------------------------------------ Trainer
  const OX_OPTIONS = ['–III', '–II', '–I', '0', '+I', '+II', '+III', '+IV'];
  const COEF_OPTIONS = ['1', '2', '3', '4', '5', '6'];
  const PARTICLE_OPTIONS = [
    { v: 'e-', t: 'e⁻' }, { v: 'H+', t: 'H⁺' }, { v: 'OH-', t: 'OH⁻' }, { v: 'H2O', t: 'H₂O' }
  ];

  /**
   * Erzeugt die sechs Teilaufgaben für "fehling" oder "tollens".
   * Felder: {id, label?, options, answer}. Ein Feld vom Typ "eq" enthält
   * Gleichungsbausteine mit Auswahlfeldern.
   */
  function buildTrainer(test) {
    const F = test === 'fehling';
    const metal = F ? 'Cu<sup>2+</sup>' : '[Ag(NH<sub>3</sub>)<sub>2</sub>]<sup>+</sup>';
    const metalName = F ? 'Die Kupfer(II)-Ionen' : 'Die Silber(I)-Ionen im Silber-Ammin-Komplex';
    const product = F ? 'Cu<sub>2</sub>O' : 'Ag';
    const sel = (id, options, answer, label) => ({ id, options, answer, label });
    const ox = (id, answer, label) => sel(id, OX_OPTIONS, answer, label);
    const co = (id, answer) => sel(id, COEF_OPTIONS, String(answer));

    const steps = [
      {
        id: 'assign', title: 'Oxidation und Reduktion zuordnen',
        intro: 'Bei der positiven Nachweisreaktion findet eine Elektronenübertragung statt. Ordne zu.',
        fields: [
          sel('ald', ['wird oxidiert', 'wird reduziert'], 'wird oxidiert', 'Das Aldehyd-Molekül R–CHO …'),
          sel('met', ['wird oxidiert', 'wird reduziert'], 'wird reduziert', metalName + ' …'),
          sel('oxm', ['R–CHO', F ? 'Cu²⁺' : '[Ag(NH₃)₂]⁺', 'OH⁻'], F ? 'Cu²⁺' : '[Ag(NH₃)₂]⁺', 'Das Oxidationsmittel ist …'),
          sel('red', ['R–CHO', F ? 'Cu²⁺' : '[Ag(NH₃)₂]⁺', 'OH⁻'], 'R–CHO', 'Das Reduktionsmittel ist …')
        ],
        hints: [
          'Oxidation bedeutet Elektronenabgabe, Reduktion Elektronenaufnahme.',
          F ? 'Aus Cu²⁺ entsteht Cu₂O – darin hat Kupfer eine kleinere Ladung bzw. Oxidationszahl.' : 'Aus Silber-Ionen entsteht elementares, ungeladenes Silber.',
          'Das Oxidationsmittel nimmt Elektronen auf und wird dabei selbst reduziert. Das Aldehyd ist das Reduktionsmittel.'
        ]
      },
      {
        id: 'oxnum', title: 'Oxidationszahlen bestimmen',
        intro: 'Bestimme die Oxidationszahlen der Atome, die ihre Oxidationszahl ändern.',
        fields: [
          ox('c1', '+I', 'C-Atom der Aldehydgruppe in R–CHO'),
          ox('c2', '+III', 'C-Atom der Carboxygruppe in R–COOH'),
          ox('m1', F ? '+II' : '+I', F ? 'Cu in Cu²⁺' : 'Ag in [Ag(NH₃)₂]⁺'),
          ox('m2', F ? '+I' : '0', F ? 'Cu in Cu₂O' : 'Ag im elementaren Silber')
        ],
        hints: [
          'Denke dir alle Bindungen als Ionenbindungen: Das elektronegativere Atom erhält die Bindungselektronen.',
          'Beiträge für das C-Atom: Bindung zu C → 0; Bindung zu H → –I (C ist elektronegativer als H); C=O → +II; C–OH → +I.',
          F ? 'Aldehyd-C: 0 – I + II = +I; Carboxy-C: 0 + II + I = +III. Cu²⁺ hat +II; in Cu₂O (O: –II) hat jedes Cu-Atom +I.' : 'Aldehyd-C: 0 – I + II = +I; Carboxy-C: 0 + II + I = +III. Im Komplex hat Silber +I (NH₃ ist neutral), elementares Silber hat 0.'
        ]
      },
      {
        id: 'electrons', title: 'Elektronenabgabe und -aufnahme erkennen',
        intro: 'Leite aus den Oxidationszahlen ab, wie viele Elektronen übertragen werden.',
        fields: [
          sel('eox', ['1', '2', '3', '4'], '2', 'Ein Aldehyd-Molekül gibt … Elektronen ab.'),
          sel('ered', ['1', '2', '3', '4'], '1', F ? 'Ein Cu²⁺-Ion nimmt … Elektron(en) auf.' : 'Ein Silber(I)-Ion nimmt … Elektron(en) auf.')
        ],
        hints: [
          'Die Änderung der Oxidationszahl entspricht der Zahl übertragener Elektronen.',
          F ? 'C: von +I auf +III; Cu: von +II auf +I.' : 'C: von +I auf +III; Ag: von +I auf 0.',
          'Das Aldehyd-Molekül gibt 2 Elektronen ab, jedes Metall-Ion nimmt 1 Elektron auf.'
        ]
      },
      {
        id: 'balanceE', title: 'Elektronenzahlen ausgleichen',
        intro: 'Abgegebene und aufgenommene Elektronen müssen übereinstimmen.',
        fields: [
          sel('ratio', ['1', '2', '3', '4'], '2', `Ein Aldehyd-Molekül reagiert mit … ${F ? 'Cu²⁺-Ionen' : 'Silber(I)-Ionen'}.`),
          sel('prod', F ? ['1 Cu₂O', '2 Cu₂O', '2 Cu'] : ['1 Ag', '2 Ag', '4 Ag'], F ? '1 Cu₂O' : '2 Ag', 'Dabei entsteht/entstehen …')
        ],
        hints: [
          'Wie oft muss die Reduktion ablaufen, damit sie die Elektronen einer Oxidation aufnimmt?',
          'Kleinstes gemeinsames Vielfaches: 2 Elektronen.',
          F ? 'Zwei Cu²⁺-Ionen nehmen 2 e⁻ auf; die zwei Cu⁺ bilden zusammen mit einem O ein Cu₂O.' : 'Zwei Silber(I)-Ionen nehmen 2 e⁻ auf; es entstehen 2 Silberatome.'
        ]
      },
      {
        id: 'halves', title: 'Teilgleichungen vervollständigen',
        intro: 'Ergänze Koeffizienten und fehlende Teilchen. Im alkalischen Milieu gleichst du mit OH⁻ und H₂O aus. Schulische Schreibweise: Das Produkt wird als R–COOH notiert.',
        eqs: [
          {
            label: 'Oxidation',
            parts: [
              { t: 'R–CHO' }, { t: '+' }, co('o1', 2), { t: 'OH<sup>–</sup>' }, { t: '→' },
              { t: 'R–COOH' }, { t: '+' }, co('o2', 1), { t: 'H<sub>2</sub>O' }, { t: '+' }, co('o3', 2),
              sel('o4', PARTICLE_OPTIONS.map((p) => p.t), 'e⁻')
            ]
          },
          {
            label: 'Reduktion',
            parts: F
              ? [co('r1', 2), { t: 'Cu<sup>2+</sup>' }, { t: '+' }, co('r2', 2), { t: 'OH<sup>–</sup>' }, { t: '+' }, co('r3', 2),
                sel('r4', PARTICLE_OPTIONS.map((p) => p.t), 'e⁻'), { t: '→' }, { t: 'Cu<sub>2</sub>O' }, { t: '+' }, co('r5', 1), { t: 'H<sub>2</sub>O' }]
              : [co('r1', 2), { t: '[Ag(NH<sub>3</sub>)<sub>2</sub>]<sup>+</sup>' }, { t: '+' }, co('r3', 2),
                sel('r4', PARTICLE_OPTIONS.map((p) => p.t), 'e⁻'), { t: '→' }, co('r5', 2), { t: 'Ag' }, { t: '+' }, co('r6', 4), { t: 'NH<sub>3</sub>' }]
          }
        ],
        hints: [
          'Prüfe zuerst die Elektronen: Wo stehen sie bei einer Oxidation, wo bei einer Reduktion?',
          'Gleiche danach die Ladungen mit OH⁻ aus und zuletzt die H- und O-Atome mit H₂O.',
          F ? 'Oxidation: R–CHO + 2 OH⁻ → R–COOH + H₂O + 2 e⁻. Reduktion: 2 Cu²⁺ + 2 OH⁻ + 2 e⁻ → Cu₂O + H₂O.' : 'Oxidation: R–CHO + 2 OH⁻ → R–COOH + H₂O + 2 e⁻. Reduktion: 2 [Ag(NH₃)₂]⁺ + 2 e⁻ → 2 Ag + 4 NH₃.'
        ]
      },
      {
        id: 'total', title: 'Gesamtgleichung aufstellen',
        intro: 'Addiere die Teilgleichungen. Elektronen sowie gleiche Teilchen auf beiden Seiten werden gekürzt.',
        eqs: [
          {
            label: 'Redoxreaktion',
            parts: F
              ? [{ t: 'R–CHO' }, { t: '+' }, co('t1', 2), { t: 'Cu<sup>2+</sup>' }, { t: '+' }, co('t2', 4), { t: 'OH<sup>–</sup>' }, { t: '→' },
                { t: 'R–COOH' }, { t: '+' }, co('t3', 1), { t: 'Cu<sub>2</sub>O' }, { t: '+' }, co('t4', 2), { t: 'H<sub>2</sub>O' }]
              : [{ t: 'R–CHO' }, { t: '+' }, co('t1', 2), { t: '[Ag(NH<sub>3</sub>)<sub>2</sub>]<sup>+</sup>' }, { t: '+' }, co('t2', 2), { t: 'OH<sup>–</sup>' }, { t: '→' },
                { t: 'R–COOH' }, { t: '+' }, co('t3', 2), { t: 'Ag' }, { t: '+' }, co('t4', 4), { t: 'NH<sub>3</sub>' }, { t: '+' }, co('t5', 1), { t: 'H<sub>2</sub>O' }]
          }
        ],
        hints: [
          'Schreibe beide Teilgleichungen untereinander und addiere alle Teilchen links und rechts.',
          F ? 'Links stehen 2 + 2 = 4 OH⁻, rechts 1 + 1 = 2 H₂O. Die 2 e⁻ heben sich auf.' : 'Die 2 e⁻ heben sich auf. Rechts stehen H₂O, 2 Ag und 4 NH₃.',
          'Kontrolliere am Ende: Gleiche Anzahl jedes Atoms und gleiche Gesamtladung auf beiden Seiten.'
        ]
      }
    ];
    return { test, metal, product, steps, equations: EQUATIONS[test] };
  }

  /** Prüft die Eingaben eines Schritts. answers: {fieldId: value} */
  function checkStep(step, answers) {
    const fields = step.fields || step.eqs.flatMap((e) => e.parts.filter((p) => p.id));
    const res = {};
    let all = true;
    for (const f of fields) {
      const ok = answers[f.id] === f.answer;
      res[f.id] = ok;
      if (!ok) all = false;
    }
    return { fields: res, allCorrect: all };
  }

  function fieldsOf(step) {
    return step.fields || step.eqs.flatMap((e) => e.parts.filter((p) => p.id));
  }

  /** Setzt alle Koeffizienten des Trainers zusammen – zur Selbstprüfung gegen EQUATIONS. */
  function trainerEquation(trainer, stepId, eqIndex) {
    const step = trainer.steps.find((s) => s.id === stepId);
    const eq = step.eqs[eqIndex];
    const left = [], right = [];
    let side = left, coef = 1;
    const rev = Object.fromEntries(Object.entries(HTML).map(([k, v]) => [v, k]));
    const pTxt = Object.fromEntries(PARTICLE_OPTIONS.map((p) => [p.t, p.v]));
    for (const p of eq.parts) {
      if (p.id && COEF_OPTIONS.includes(p.answer)) { coef = +p.answer; continue; }
      if (p.id) { side.push({ n: coef, f: pTxt[p.answer] }); coef = 1; continue; }
      if (p.t === '+') continue;
      if (p.t === '→') { side = right; continue; }
      side.push({ n: coef, f: rev[p.t] || p.t.replace('–', '-') });
      coef = 1;
    }
    return { left, right };
  }

  const COOH_NOTE = 'Schreibweise: Im alkalischen Reaktionsgemisch liegt das Oxidationsprodukt überwiegend als Carboxylat-Ion (R–COO⁻) vor. Hier wird es – wie im Unterricht üblich – vereinfacht als Carbonsäure R–COOH notiert. Diese Gleichungen sind trotzdem atom- und ladungsmäßig ausgeglichen; sie beschreiben nur die Teilchenform vereinfacht. Die Komplexbildung (Kupfer-Tartrat-Komplex) wird in der Fehling-Gleichung nicht berücksichtigt.';

  return { parseFormula, balance, EQUATIONS, EQUATIONS_PRECISE, buildTrainer, checkStep, fieldsOf, trainerEquation, eqToHtml, html, COOH_NOTE, OX_OPTIONS };
});
