/* FretMaster · teoría musical pura (sin DOM). Se usa desde app.js y desde los tests de node. */
(function (global) {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

  const GROUPS = [
    { id: 'basic', title: 'Comunes' },
    { id: 'penta', title: 'Penta y blues' },
    { id: 'mode', title: 'Modos' },
    { id: 'other', title: 'Otras' }
  ];

  /*
   * formula: grados respecto a la escala mayor (la ortografía de las notas sale de aquí).
   * parent:  semitonos desde la tónica hasta la tónica de la mayor "madre"; las formas CAGED
   *          se calculan sobre esa mayor (D dórico usa las cajas de C mayor).
   */
  const SCALES = {
    major: {
      name: 'Mayor (Jónico)', group: 'basic', formula: '1 2 3 4 5 6 7', parent: 0,
      desc: 'Sonido brillante y estable; es la base de la armonía tonal.',
      use: 'Melodías alegres, pop, country y rock clásico. Se apoya en los acordes I, IV y V.'
    },
    minor: {
      name: 'Menor natural', group: 'basic', formula: '1 2 b3 4 5 b6 b7', parent: 3,
      desc: 'Sonido oscuro y melancólico (modo eólico). Comparte notas con su mayor relativa.',
      use: 'Rock, baladas y metal; sobre acordes i, iv, v o la cadencia ♭VI–♭VII–i.'
    },
    harmonic_minor: {
      name: 'Menor armónica', group: 'basic', formula: '1 2 b3 4 5 b6 7', parent: 3,
      desc: 'Menor natural con 7ª mayor: la sensible resuelve con fuerza y aparece una 2ª aumentada (♭6–7).',
      use: 'Sobre el V7 que resuelve a menor, música clásica, neoclásico y metal.'
    },
    melodic_minor: {
      name: 'Menor melódica', group: 'basic', formula: '1 2 b3 4 5 6 7', parent: 3,
      desc: 'Menor con 6ª y 7ª mayores (versión ascendente): suena suave pero con tensión.',
      use: 'Jazz, sobre acordes m(maj7). De ella salen la escala alterada y el lidio dominante.'
    },
    major_pentatonic: {
      name: 'Pentatónica mayor', group: 'penta', formula: '1 2 3 5 6', parent: 0,
      desc: 'Cinco notas, sin 4ª ni 7ª y sin ningún semitono entre ellas: sonido abierto y sin choques.',
      use: 'Solos de country, rock sureño y pop sobre acordes mayores.'
    },
    minor_pentatonic: {
      name: 'Pentatónica menor', group: 'penta', formula: '1 b3 4 5 b7', parent: 3,
      desc: 'La escala del rock: cinco notas, sin 2ª ni 6ª.',
      use: 'Rock, blues y pop sobre acordes menores; en el blues, también sobre los acordes de séptima dominante.'
    },
    blues: {
      name: 'Blues', group: 'penta', formula: '1 b3 4 b5 5 b7', parent: 3,
      desc: 'Pentatónica menor con ♭5 (la «blue note»), que añade tensión.',
      use: 'Blues y rock; usa la ♭5 de paso, deslizándola o estirándola (bending) hacia la 4ª o la 5ª.'
    },
    dorian: {
      name: 'Dórico', group: 'mode', formula: '1 2 b3 4 5 6 b7', parent: 10,
      desc: 'Menor con 6ª mayor: oscuro pero con luz, menos triste que el eólico.',
      use: 'Funk, jazz y rock sobre acordes m7 (Oye Cómo Va, So What).'
    },
    phrygian: {
      name: 'Frigio', group: 'mode', formula: '1 b2 b3 4 5 b6 b7', parent: 8,
      desc: 'Menor con ♭2: sonido español, tenso y oscuro.',
      use: 'Flamenco y metal; sobre acordes menores que se mueven hacia el ♭II.'
    },
    lydian: {
      name: 'Lidio', group: 'mode', formula: '1 2 3 #4 5 6 7', parent: 7,
      desc: 'Mayor con ♯4: sonido etéreo y soñador.',
      use: 'Bandas sonoras y rock instrumental, sobre acordes maj7 y maj7♯11.'
    },
    mixolydian: {
      name: 'Mixolidio', group: 'mode', formula: '1 2 3 4 5 6 b7', parent: 5,
      desc: 'Mayor con ♭7: sonido de dominante, relajado y bluesy.',
      use: 'Rock, blues y folk, sobre acordes de séptima dominante (7).'
    },
    locrian: {
      name: 'Locrio', group: 'mode', formula: '1 b2 b3 4 b5 b6 b7', parent: 1,
      desc: 'Modo con ♭5 sobre la tónica: inestable, no tiene acorde de reposo.',
      use: 'Sobre acordes m7♭5; apenas se usa como centro tonal.'
    },
    phrygian_dominant: {
      name: 'Frigio dominante', group: 'other', formula: '1 b2 3 4 5 b6 b7', parent: 8,
      desc: 'Frigio con 3ª mayor (5º modo de la menor armónica): sonido árabe y flamenco.',
      use: 'Sobre dominantes que resuelven a menor (V7♭9); flamenco, metal y klezmer.'
    },
    whole_tone: {
      name: 'Tonos enteros', group: 'other', formula: '1 2 3 #4 #5 b7', parent: 0, symmetric: true,
      desc: 'Seis notas separadas por tonos enteros: ambigua, flotante y sin resolución.',
      use: 'Tensión onírica sobre acordes aumentados o 7♯5 (Debussy).'
    },
    diminished: {
      name: 'Disminuida (T–S)', group: 'other', formula: '1 2 b3 4 b5 b6 bb7 7', parent: 0, symmetric: true,
      desc: 'Ocho notas simétricas que alternan tono y semitono.',
      use: 'Sobre acordes dim7 de su misma fundamental; jazz y neoclásico. Sus notas son las de la disminuida S–T un semitono más abajo (Do T–S = Si S–T), la que se usa sobre el dominante 7♭9 (Si7♭9).'
    }
  };

  const CAGED = { C: [0, 3], A: [2, 5], G: [4, 8], E: [7, 10], D: [9, 13] };
  const CAGED_ORDER = ['C', 'A', 'G', 'E', 'D'];

  // MIDI de la cuerda más aguda a la más grave.
  const TUNINGS = {
    standard: { name: 'Estándar (E A D G B E)', midi: [64, 59, 55, 50, 45, 40] },
    eb: { name: 'Medio tono abajo (E♭)', midi: [63, 58, 54, 49, 44, 39] },
    dropd: { name: 'Drop D (D A D G B E)', midi: [64, 59, 55, 50, 45, 38] },
    dadgad: { name: 'DADGAD', midi: [62, 57, 55, 50, 45, 38] },
    opend: { name: 'Open D (D A D F♯ A D)', midi: [62, 57, 54, 50, 45, 38] },
    openg: { name: 'Open G (D G D G B D)', midi: [62, 59, 55, 50, 43, 38] },
    seven: { name: '7 cuerdas (B E A D G B E)', midi: [64, 59, 55, 50, 45, 40, 35] }
  };

  const ROLE_NAMES = {
    root: 'tónica', third: 'tercera', fifth: 'quinta',
    tritone: 'nota de color', seventh: 'séptima', scale: 'grado de la escala'
  };

  const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

  // ---------- Ortografía ----------

  const accName = (acc) => (acc > 0 ? '♯'.repeat(acc) : acc < 0 ? '♭'.repeat(-acc) : '');
  const pretty = (token) => token.replace(/b/g, '♭').replace(/#/g, '♯');

  function parseFormula(formula) {
    return formula.split(' ').map((token) => {
      const m = /^([#b]*)(\d+)$/.exec(token);
      const acc = [...m[1]].reduce((a, c) => a + (c === '#' ? 1 : -1), 0);
      const deg = Number(m[2]);
      return { token, deg, acc, semi: (LETTER_PC[(deg - 1) % 7] + acc + 12) % 12 };
    });
  }

  // Candidatos de ortografía para cada clase de altura: naturales, luego ♯, luego ♭.
  const PC_CANDIDATES = (() => {
    const out = Array.from({ length: 12 }, () => []);
    [0, 1, -1].forEach((acc) => {
      LETTER_PC.forEach((base, letter) => {
        out[(base + acc + 12) % 12].push({ letter, acc });
      });
    });
    return out;
  })();

  // letra:alteración → B♯ (6:1), E♯ (2:1), F♭ (3:-1), C♭ (0:-1)
  const EXOTIC_ROOTS = new Set(['6:1', '2:1', '3:-1', '0:-1']);

  function spellWith(cand, tokens) {
    const rootPc = (LETTER_PC[cand.letter] + cand.acc + 12) % 12;
    let cost = 0;
    const notes = tokens.map((t) => {
      const letter = (cand.letter + t.deg - 1) % 7;
      const pc = (rootPc + t.semi) % 12;
      let acc = (((pc - LETTER_PC[letter]) % 12) + 12) % 12;
      if (acc > 6) acc -= 12;
      cost += acc * acc;
      return { name: LETTERS[letter] + accName(acc), pc, token: t.token, display: pretty(t.token), semi: t.semi, deg: t.deg, acc: t.acc };
    });
    return { notes, cost, rootPc };
  }

  function roleFor(semi, hasPerfectFifth) {
    if (semi === 0) return 'root';
    if (semi === 3 || semi === 4) return 'third';
    if (semi === 7) return 'fifth';
    if (semi === 6) return hasPerfectFifth ? 'tritone' : 'fifth';
    if (semi === 10 || semi === 11) return 'seventh';
    return 'scale';
  }

  /**
   * pref: 'auto' elige la ortografía con menos alteraciones; 'sharp' / 'flat' la fuerzan
   * cuando existe una alternativa (p. ej. C♯ vs D♭).
   */
  function bestSpelling(pc, tokens, pref) {
    // Fundamentales que nadie escribe (B♯, E♯, F♭, C♭): ya existen como C, F, E y B.
    let cands = PC_CANDIDATES[pc].filter((c) => !EXOTIC_ROOTS.has(c.letter + ':' + c.acc));
    if (pref === 'sharp') cands = cands.filter((c) => c.acc >= 0).length ? cands.filter((c) => c.acc >= 0) : cands;
    if (pref === 'flat') cands = cands.filter((c) => c.acc <= 0).length ? cands.filter((c) => c.acc <= 0) : cands;
    let best = null;
    cands.forEach((cand) => {
      const sp = spellWith(cand, tokens);
      if (!best || sp.cost < best.cost) best = sp;
    });
    return best;
  }

  function spellScale(pc, scaleId, pref) {
    const scale = SCALES[scaleId];
    const tokens = parseFormula(scale.formula);
    const hasP5 = tokens.some((t) => t.semi === 7);
    const best = { sp: bestSpelling(pc, tokens, pref) };

    const notes = best.sp.notes.map((n) => {
      const role = roleFor(n.semi, hasP5);
      return { ...n, role, roleName: ROLE_NAMES[role] };
    });
    return {
      scaleId,
      rootPc: pc,
      rootName: notes[0].name,
      notes,
      byPc: new Map(notes.map((n) => [n.pc, n]))
    };
  }

  function keyLabel(pc, pref) {
    const cands = PC_CANDIDATES[pc].filter((c) => Math.abs(c.acc) <= 1 && !(c.letter === 6 && c.acc === 1) && !(c.letter === 2 && c.acc === 1) && !(c.letter === 3 && c.acc === -1) && !(c.letter === 0 && c.acc === -1));
    const name = (c) => LETTERS[c.letter] + accName(c.acc);
    if (cands.length === 1) return name(cands[0]);
    if (pref === 'sharp') return name(cands.find((c) => c.acc >= 0));
    if (pref === 'flat') return name(cands.find((c) => c.acc <= 0));
    return cands.map(name).join('/');
  }

  // ---------- Leyenda, patrón, acordes ----------

  function legendFor(spelled) {
    const out = [];
    const find = (role) => spelled.notes.find((n) => n.role === role);
    const root = find('root');
    if (root) out.push({ role: 'root', label: 'Tónica (1)' });
    const third = find('third');
    if (third) out.push({ role: 'third', label: third.semi === 4 ? '3ª mayor' : '3ª menor (♭3)' });
    const fifth = find('fifth');
    if (fifth) out.push({ role: 'fifth', label: fifth.semi === 7 ? 'Quinta justa' : tritoneLabel(fifth) });
    const tri = find('tritone');
    if (tri) out.push({ role: 'tritone', label: tritoneLabel(tri) });
    const seventh = find('seventh');
    if (seventh) out.push({ role: 'seventh', label: seventh.semi === 11 ? '7ª mayor' : '7ª menor (♭7)' });
    if (find('scale')) out.push({ role: 'scale', label: 'Resto de la escala' });
    return out;
  }

  function tritoneLabel(note) {
    return note.token.includes('#') ? '4ª aumentada (♯4)' : '5ª disminuida (♭5)';
  }

  function stepPattern(scaleId) {
    const semis = parseFormula(SCALES[scaleId].formula).map((t) => t.semi);
    const names = { 1: 'S', 2: 'T', 3: 'T½', 4: '2T' };
    return semis.map((s, i) => {
      const next = i === semis.length - 1 ? 12 : semis[i + 1];
      const d = next - s;
      return names[d] || String(d);
    });
  }

  const TRIADS = { '4,7': 'maj', '3,7': 'min', '3,6': 'dim', '4,8': 'aug' };
  const SEVENTHS = {
    maj: { 11: 'maj7', 10: '7' },
    min: { 10: 'm7', 11: 'mMaj7' },
    dim: { 10: 'm7b5', 9: 'dim7' },
    aug: { 11: 'maj7#5', 10: '7#5' }
  };
  const TRIAD_SUFFIX = { maj: '', min: 'm', dim: 'dim', aug: 'aug' };
  const SEVENTH_SUFFIX = { maj7: 'maj7', 7: '7', m7: 'm7', mMaj7: 'm(maj7)', m7b5: 'm7♭5', dim7: 'dim7', 'maj7#5': 'maj7♯5', '7#5': '7♯5' };
  const ROMAN_SUFFIX = {
    3: { maj: '', min: '', dim: '°', aug: '+' },
    4: { maj7: 'maj7', 7: '7', m7: '7', mMaj7: '(maj7)', m7b5: 'ø7', dim7: '°7', 'maj7#5': '+maj7', '7#5': '+7' }
  };
  const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  /** Acordes por terceras apilados sobre cada grado (solo para escalas de 7 notas). */
  function diatonicChords(spelled, size) {
    const n = spelled.notes;
    if (n.length !== 7) return [];
    return n.map((note, i) => {
      const picks = [0, 2, 4, 6].slice(0, size).map((k) => n[(i + k) % 7]);
      const rel = picks.map((p) => (p.pc - note.pc + 12) % 12);
      const triad = TRIADS[rel[1] + ',' + rel[2]];
      let quality = triad;
      let suffix = TRIAD_SUFFIX[triad];
      let romanSuffix = size === 3 ? ROMAN_SUFFIX[3][triad] : '';
      if (size === 4) {
        quality = SEVENTHS[triad] && SEVENTHS[triad][rel[3]];
        suffix = SEVENTH_SUFFIX[quality];
        romanSuffix = ROMAN_SUFFIX[4][quality];
      }
      if (suffix === undefined) { suffix = '?'; romanSuffix = ''; }
      const lower = triad === 'min' || triad === 'dim';
      const numeral = lower ? NUMERALS[note.deg - 1].toLowerCase() : NUMERALS[note.deg - 1];
      const accidental = note.acc < 0 ? '♭'.repeat(-note.acc) : note.acc > 0 ? '♯'.repeat(note.acc) : '';
      return {
        roman: accidental + numeral + romanSuffix,
        name: note.name + suffix,
        notes: picks.map((p) => p.name),
        pcs: picks.map((p) => p.pc),
        quality: quality || null
      };
    });
  }

  // ---------- MIDI / posiciones ----------

  function chordMidis(pcs, base) {
    let prev = (base === undefined ? 48 : base) + pcs[0];
    const out = [prev];
    for (let i = 1; i < pcs.length; i++) {
      let step = (pcs[i] - (prev % 12) + 12) % 12;
      if (step === 0) step = 12;
      prev += step;
      out.push(prev);
    }
    return out;
  }

  function scaleMidis(spelled) {
    const base = 48 + spelled.rootPc;
    const asc = spelled.notes.map((n) => base + n.semi);
    asc.push(base + 12);
    return asc;
  }

  /** Ventanas de trastes de cada forma, sin recortar al mástil (pueden empezar antes del traste 0). */
  function windows(scaleId, rootPc, frets) {
    const shift = (rootPc + SCALES[scaleId].parent) % 12;
    const out = {};
    CAGED_ORDER.forEach((id) => {
      const [start, end] = CAGED[id];
      const span = end - start;
      const first = (start + shift) % 12;
      const list = [];
      for (let o = first - 12; o <= frets + 2; o += 12) {
        if (o + span >= -2) list.push([o, o + span]);
      }
      out[id] = list;
    });
    return out;
  }

  function positionRanges(scaleId, rootPc, frets) {
    const w = windows(scaleId, rootPc, frets);
    const out = { all: [[0, frets]] };
    CAGED_ORDER.forEach((id) => {
      out[id] = w[id].filter(([a, b]) => a <= frets && b >= 0).map(([a, b]) => [Math.max(0, a), Math.min(frets, b)]);
    });
    return out;
  }

  /**
   * Notas de la escala que no están en su mayor "madre" (p. ej. el G♯ de La menor armónica sobre Do mayor).
   * Cada una sustituye a una nota de la madre desplazada un semitono (G → G♯): sourceOf.get(pc) = { pc, delta }.
   * Las notas de paso sin sustituta (la ♭5 del blues) quedan sin emparejar.
   */
  function alterationMap(scaleId, rootPc) {
    const sc = SCALES[scaleId];
    const parentRoot = (rootPc + sc.parent) % 12;
    const P = new Set(LETTER_PC.map((s) => (parentRoot + s) % 12));
    const Q = new Set(parseFormula(sc.formula).map((t) => (rootPc + t.semi) % 12));
    const missing = [...P].filter((pc) => !Q.has(pc)).sort((a, b) => a - b);
    const extras = new Set([...Q].filter((pc) => !P.has(pc)));
    const sourceOf = new Map();
    const paired = new Set();
    // Dos pasadas: primero las notas elevadas (G → G♯), luego las rebajadas (E → E♭). Emparejar nota a nota
    // en un solo recorrido puede cruzar los pares (C → B en lugar de C → C♯ en Re menor melódica).
    [1, -1].forEach((d) => {
      missing.forEach((m) => {
        const e = (m + d + 12) % 12;
        if (!paired.has(m) && extras.has(e) && !sourceOf.has(e)) {
          sourceOf.set(e, { pc: m, delta: d });
          paired.add(m);
        }
      });
    });
    return { P, Q, extras, sourceOf };
  }

  /**
   * ¿Pertenece la nota (traste, clase de altura) a la caja? Una nota alterada va en la caja de la nota
   * que sustituye, un traste más arriba o abajo, así la caja no queda con huecos.
   */
  function positionPredicate(scaleId, rootPc, shapeId, frets) {
    if (shapeId === 'all') return () => true;
    const wins = windows(scaleId, rootPc, frets)[shapeId];
    const inWin = (f) => wins.some(([a, b]) => f >= a && f <= b);
    const { sourceOf } = alterationMap(scaleId, rootPc);
    return (fret, pc) => {
      const src = sourceOf.get(pc);
      return inWin(src ? fret - src.delta : fret);
    };
  }

  // ---------- Catálogo de acordes y digitaciones ----------

  const CHORD_GROUPS = [
    { id: 'triad', title: 'Tríadas' },
    { id: 'sixth', title: 'Sextas' },
    { id: 'seventh', title: 'Séptimas' },
    { id: 'ext', title: 'Extendidos' }
  ];

  const CHORD_TYPES = {
    maj: { name: 'Mayor', symbol: '', group: 'triad', formula: '1 3 5' },
    min: { name: 'Menor', symbol: 'm', group: 'triad', formula: '1 b3 5' },
    dim: { name: 'Disminuido', symbol: 'dim', group: 'triad', formula: '1 b3 b5' },
    aug: { name: 'Aumentado', symbol: 'aug', group: 'triad', formula: '1 3 #5' },
    sus2: { name: 'Sus2', symbol: 'sus2', group: 'triad', formula: '1 2 5' },
    sus4: { name: 'Sus4', symbol: 'sus4', group: 'triad', formula: '1 4 5' },
    6: { name: 'Sexta', symbol: '6', group: 'sixth', formula: '1 3 5 6' },
    m6: { name: 'Menor 6', symbol: 'm6', group: 'sixth', formula: '1 b3 5 6' },
    maj7: { name: 'Maj7', symbol: 'maj7', group: 'seventh', formula: '1 3 5 7' },
    7: { name: 'Dominante 7', symbol: '7', group: 'seventh', formula: '1 3 5 b7' },
    m7: { name: 'Menor 7', symbol: 'm7', group: 'seventh', formula: '1 b3 5 b7' },
    mmaj7: { name: 'Menor maj7', symbol: 'm(maj7)', group: 'seventh', formula: '1 b3 5 7' },
    m7b5: { name: 'Semidisminuido', symbol: 'm7♭5', group: 'seventh', formula: '1 b3 b5 b7' },
    dim7: { name: 'Disminuido 7', symbol: 'dim7', group: 'seventh', formula: '1 b3 b5 bb7' },
    '7sus4': { name: '7sus4', symbol: '7sus4', group: 'seventh', formula: '1 4 5 b7' },
    aug7: { name: 'Aumentado 7', symbol: '7♯5', group: 'seventh', formula: '1 3 #5 b7' },
    'maj7#5': { name: 'Maj7♯5', symbol: 'maj7♯5', group: 'seventh', formula: '1 3 #5 7' },
    5: { name: 'Power chord', symbol: '5', group: 'ext', formula: '1 5' },
    add9: { name: 'Add9', symbol: 'add9', group: 'ext', formula: '1 3 5 9' },
    9: { name: 'Dominante 9', symbol: '9', group: 'ext', formula: '1 3 5 b7 9' },
    maj9: { name: 'Maj9', symbol: 'maj9', group: 'ext', formula: '1 3 5 7 9' },
    m9: { name: 'Menor 9', symbol: 'm9', group: 'ext', formula: '1 b3 5 b7 9' }
  };

  // Mapa de la calidad que devuelve diatonicChords() al tipo del catálogo.
  const QUALITY_TO_TYPE = {
    maj: 'maj', min: 'min', dim: 'dim', aug: 'aug',
    maj7: 'maj7', 7: '7', m7: 'm7', mMaj7: 'mmaj7', m7b5: 'm7b5', dim7: 'dim7', 'maj7#5': 'maj7#5', '7#5': 'aug7'
  };

  const CHORD_ROLE_NAMES = { root: 'tónica', third: 'tercera', fifth: 'quinta', seventh: 'séptima o sexta', tritone: 'extensión o suspensión' };

  function chordRole(semi) {
    if (semi === 0) return 'root';
    if (semi === 3 || semi === 4) return 'third';
    if (semi === 6 || semi === 7 || semi === 8) return 'fifth';
    if (semi === 9 || semi === 10 || semi === 11) return 'seventh';
    return 'tritone';
  }

  function spellChord(pc, typeId, pref) {
    const type = CHORD_TYPES[typeId];
    const sp = bestSpelling(pc, parseFormula(type.formula), pref);
    const notes = sp.notes.map((n) => {
      const role = chordRole(n.semi);
      return { ...n, role, roleName: CHORD_ROLE_NAMES[role] };
    });
    return {
      typeId,
      rootPc: pc,
      rootName: notes[0].name,
      symbol: type.symbol,
      name: notes[0].name + type.symbol,
      notes,
      pcs: notes.map((n) => n.pc),
      byPc: new Map(notes.map((n) => [n.pc, n]))
    };
  }

  function chordLegend(chord) {
    const labels = {
      root: 'Fundamental', third: 'Tercera', fifth: 'Quinta',
      seventh: 'Séptima / sexta', tritone: 'Extensión / suspensión'
    };
    const out = [];
    Object.keys(labels).forEach((role) => {
      if (chord.notes.some((n) => n.role === role)) out.push({ role, label: labels[role] });
    });
    return out;
  }

  /** Dedos necesarios y cejilla (si la hay) para un vector de trastes (-1 = cuerda muda). */
  function fingering(frets) {
    const fretted = frets.filter((f) => f > 0);
    if (!fretted.length) return { fingers: 0, barre: null };
    const f0 = Math.min(...fretted);
    const idx = frets.map((f, i) => (f === f0 ? i : -1)).filter((i) => i >= 0);
    const from = Math.min(...idx);
    const to = Math.max(...idx);
    let barreOk = idx.length >= 2;
    for (let i = from; i <= to && barreOk; i++) if (frets[i] < f0) barreOk = false;
    if (barreOk) {
      return { fingers: 1 + fretted.filter((f) => f > f0).length, barre: { fret: f0, from, to } };
    }
    return { fingers: fretted.length, barre: null };
  }

  /**
   * Busca digitaciones tocables para el acorde en la afinación dada.
   * frets[i]: traste de la cuerda i (0 = la más aguda); -1 = muda. La nota más grave es la del bajo elegido (bassIdx; por defecto, la fundamental).
   */
  function findVoicings(tuning, chord, maxFret, limit, bassIdx) {
    const n = tuning.length;
    const bass = chord.notes[bassIdx || 0];
    const root = bass.pc;                       // la nota más grave que suena
    const pcSet = new Set(chord.pcs);
    const fifth = chord.notes.find((x) => x.semi === 7);
    const required = new Set(chord.pcs);
    if (chord.pcs.length >= 4 && fifth && fifth.pc !== bass.pc) required.delete(fifth.pc);
    const minStrings = chord.pcs.length <= 2 ? 3 : 4;
    const top = Math.max(4, Math.min(maxFret, 15));
    const found = new Map();

    function evaluate(cur) {
      const played = cur.filter((f) => f >= 0);
      if (played.length < minStrings) return;
      const seen = new Set();
      cur.forEach((f, s) => { if (f >= 0) seen.add((tuning[s] + f) % 12); });
      for (const pc of required) if (!seen.has(pc)) return;
      const fretted = played.filter((f) => f > 0);
      const minF = fretted.length ? Math.min(...fretted) : 0;
      const maxF = fretted.length ? Math.max(...fretted) : 0;
      if (maxF - minF > 3) return;
      const { fingers, barre } = fingering(cur);
      if (fingers > 4) return;
      const key = cur.join(',');
      if (found.has(key)) return;
      const mutes = cur.filter((f) => f < 0).length;
      const opens = played.length - fretted.length;
      const score = (maxF - minF) * 1.5 + minF * 0.12 + mutes * 1.2 - opens * 0.4 +
        (seen.has(fifth ? fifth.pc : -1) || !fifth ? 0 : 1) + fingers * 0.3 - played.length * 0.3;
      found.set(key, { frets: cur.slice(), barre, fingers, minFret: minF, maxFret: maxF, score });
    }

    for (let b = 0; b <= top - 3; b++) {
      const lo = b === 0 ? 0 : b;
      const hi = b === 0 ? 4 : b + 3;
      const cur = new Array(n).fill(-1);
      const dfs = (s, started, ended) => {
        if (s < 0) { evaluate(cur); return; }
        cur[s] = -1;
        dfs(s - 1, started, started);
        if (ended) return;
        for (let f = lo; f <= hi; f++) {
          const pc = (tuning[s] + f) % 12;
          if (!pcSet.has(pc) || (!started && pc !== root)) continue;
          cur[s] = f;
          dfs(s - 1, true, false);
        }
        cur[s] = -1;
      };
      dfs(n - 1, false, false);
    }
    return [...found.values()].sort((a, b) => a.score - b.score).slice(0, limit || 6);
  }

  const api = {
    LETTERS, GROUPS, SCALES, TUNINGS, CAGED, CAGED_ORDER, INLAY_FRETS, ROLE_NAMES,
    CHORD_GROUPS, CHORD_TYPES, QUALITY_TO_TYPE,
    spellScale, keyLabel, legendFor, stepPattern, diatonicChords,
    chordMidis, scaleMidis, positionRanges, parseFormula, pretty,
    spellChord, chordLegend, findVoicings, fingering,
    alterationMap, positionPredicate
  };
  global.FretTheory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
