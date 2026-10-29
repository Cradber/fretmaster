/* FretMaster · teoría musical pura (sin DOM). Se usa desde app.js y desde los tests de node. */
(function (global) {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

  const GROUPS = [
    { id: 'basic', title: 'Comunes' },
    { id: 'penta', title: 'Pentatónicas y blues' },
    { id: 'mode', title: 'Modos griegos' },
    { id: 'other', title: 'Otras escalas' }
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
      name: 'Menor Natural', group: 'basic', formula: '1 2 b3 4 5 b6 b7', parent: 3,
      desc: 'Sonido oscuro y melancólico (modo eólico). Comparte notas con su mayor relativa.',
      use: 'Rock, baladas y metal; sobre acordes i, iv, v o la cadencia ♭VI–♭VII–i.'
    },
    harmonic_minor: {
      name: 'Menor Armónica', group: 'basic', formula: '1 2 b3 4 5 b6 7', parent: 3,
      desc: 'Menor natural con 7ª mayor: la sensible resuelve con fuerza y aparece una 2ª aumentada (♭6–7).',
      use: 'Sobre el V7 que resuelve a menor, música clásica, neoclásico y metal.'
    },
    melodic_minor: {
      name: 'Menor Melódica', group: 'basic', formula: '1 2 b3 4 5 6 7', parent: 3,
      desc: 'Menor con 6ª y 7ª mayores (versión ascendente): suena suave pero con tensión.',
      use: 'Jazz, sobre acordes m(maj7). De ella salen la escala alterada y el lidio dominante.'
    },
    major_pentatonic: {
      name: 'Penta Mayor', group: 'penta', formula: '1 2 3 5 6', parent: 0,
      desc: 'Cinco notas sin 4ª ni 7ª: sonido abierto y sin disonancias.',
      use: 'Solos de country, rock sureño y pop sobre acordes mayores.'
    },
    minor_pentatonic: {
      name: 'Penta Menor', group: 'penta', formula: '1 b3 4 5 b7', parent: 3,
      desc: 'La escala del rock: cinco notas, sin 2ª ni 6ª.',
      use: 'Rock, blues y pop; funciona sobre casi cualquier acorde menor o de dominante.'
    },
    blues: {
      name: 'Blues', group: 'penta', formula: '1 b3 4 b5 5 b7', parent: 3,
      desc: 'Pentatónica menor con ♭5 (la «blue note»), que añade tensión.',
      use: 'Blues y rock; desliza o dobla la ♭5 hacia la 4ª o la 5ª.'
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
      name: 'Frigio Dominante', group: 'other', formula: '1 b2 3 4 5 b6 b7', parent: 8,
      desc: 'Frigio con 3ª mayor (5º modo de la menor armónica): sonido árabe y flamenco.',
      use: 'Sobre dominantes que resuelven a menor (V7♭9); flamenco, metal y klezmer.'
    },
    whole_tone: {
      name: 'Tonos Enteros', group: 'other', formula: '1 2 3 #4 #5 b7', parent: 0, symmetric: true,
      desc: 'Seis notas separadas por tonos enteros: ambigua, flotante y sin resolución.',
      use: 'Tensión onírica sobre acordes aumentados o 7♯5 (Debussy).'
    },
    diminished: {
      name: 'Disminuida (T–S)', group: 'other', formula: '1 2 b3 4 b5 b6 bb7 7', parent: 0, symmetric: true,
      desc: 'Ocho notas simétricas que alternan tono y semitono.',
      use: 'Sobre acordes dim7 y dominantes con ♭9; jazz y neoclásico.'
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
      const m = /^([#b]*)(\d)$/.exec(token);
      const acc = [...m[1]].reduce((a, c) => a + (c === '#' ? 1 : -1), 0);
      const deg = Number(m[2]);
      return { token, deg, acc, semi: (LETTER_PC[deg - 1] + acc + 12) % 12 };
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
  function spellScale(pc, scaleId, pref) {
    const scale = SCALES[scaleId];
    const tokens = parseFormula(scale.formula);
    const hasP5 = tokens.some((t) => t.semi === 7);
    let cands = PC_CANDIDATES[pc];
    if (pref === 'sharp') cands = cands.filter((c) => c.acc >= 0).length ? cands.filter((c) => c.acc >= 0) : cands;
    if (pref === 'flat') cands = cands.filter((c) => c.acc <= 0).length ? cands.filter((c) => c.acc <= 0) : cands;

    let best = null;
    cands.forEach((cand) => {
      const sp = spellWith(cand, tokens);
      if (!best || sp.cost < best.sp.cost) best = { cand, sp };
    });

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

  function positionRanges(scaleId, rootPc, frets) {
    const shift = (rootPc + SCALES[scaleId].parent) % 12;
    const out = { all: [[0, frets]] };
    CAGED_ORDER.forEach((id) => {
      const [start, end] = CAGED[id];
      const span = end - start;
      const first = (start + shift) % 12;
      const ranges = [];
      for (let o = first - 12; o <= frets; o += 12) {
        if (o + span >= 0) ranges.push([Math.max(0, o), Math.min(frets, o + span)]);
      }
      out[id] = ranges;
    });
    return out;
  }

  const api = {
    LETTERS, GROUPS, SCALES, TUNINGS, CAGED, CAGED_ORDER, INLAY_FRETS, ROLE_NAMES,
    spellScale, keyLabel, legendFor, stepPattern, diatonicChords,
    chordMidis, scaleMidis, positionRanges, parseFormula, pretty
  };
  global.FretTheory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
