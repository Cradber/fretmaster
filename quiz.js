/* FretMaster · ejercicios de práctica, parte pura (sin DOM): decide qué se pregunta y qué respuesta es correcta.
   El azar llega como parámetro (rng: función que devuelve un número en [0, 1)), así las preguntas se pueden
   reproducir en los tests de node. Lo usa practice.js. */
(function (global) {
  'use strict';

  const MAX_FRET = 12;                              // los ejercicios se quedan en la primera octava del mástil
  const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
  const ALL_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  // Intervalos ascendentes desde una nota, con el símbolo que usa la app (el tritono se escribe ♭5; 12 semitonos, 8).
  const INTERVALS = [
    { semi: 1, symbol: '♭2', name: '2ª menor' }, { semi: 2, symbol: '2', name: '2ª mayor' },
    { semi: 3, symbol: '♭3', name: '3ª menor' }, { semi: 4, symbol: '3', name: '3ª mayor' },
    { semi: 5, symbol: '4', name: '4ª justa' }, { semi: 6, symbol: '♭5', name: 'tritono' },
    { semi: 7, symbol: '5', name: '5ª justa' }, { semi: 8, symbol: '♭6', name: '6ª menor' },
    { semi: 9, symbol: '6', name: '6ª mayor' }, { semi: 10, symbol: '♭7', name: '7ª menor' },
    { semi: 11, symbol: '7', name: '7ª mayor' }, { semi: 12, symbol: '8', name: 'octava' }
  ];
  const BASIC_SEMIS = [3, 4, 5, 7, 12];

  // Tres niveles por ejercicio; la descripción es la que se muestra bajo el selector.
  const NOTE_LEVELS = ['Notas naturales en las cuerdas 6 y 5', 'Notas naturales en todas las cuerdas', 'Las doce notas en todas las cuerdas'];
  const EXERCISES = {
    name: { title: 'Nombra la nota', levels: NOTE_LEVELS },
    find: { title: 'Encuentra la nota', levels: NOTE_LEVELS },
    interval: {
      title: 'Intervalos',
      levels: ['Terceras, cuarta, quinta y octava, viéndolas en el mástil', 'Los doce intervalos, viéndolos en el mástil', 'Los doce intervalos, solo de oído']
    }
  };

  /** Qué entra en un ejercicio y nivel (1–3) para un instrumento de nStrings cuerdas. */
  function config(exercise, level, nStrings) {
    if (exercise === 'interval') {
      return { maxFret: MAX_FRET, semis: level === 1 ? BASIC_SEMIS.slice() : INTERVALS.map((i) => i.semi), byEar: level === 3 };
    }
    const all = Array.from({ length: nStrings }, (_, i) => i);
    return { maxFret: MAX_FRET, strings: level === 1 ? [5, 4].filter((i) => i < nStrings) : all, naturals: level < 3 };
  }

  const pick = (arr, rng) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

  function make(exercise, cfg, tuning, rng) {
    if (exercise === 'interval') {
      // La nota de partida va en las cuerdas graves y trastes bajos; la segunda, donde quede más a mano.
      const s = pick(Array.from({ length: tuning.length - 3 }, (_, i) => i + 3), rng);
      const f = 1 + Math.floor(rng() * 7);
      const semi = pick(cfg.semis, rng);
      const midi = tuning[s] + f;
      let target = null;
      for (let s2 = s; s2 >= 0; s2--) {
        const f2 = midi + semi - tuning[s2];
        if (f2 < 0 || f2 > cfg.maxFret) continue;
        if (!target || Math.abs(f2 - f) < Math.abs(target.f - f)) target = { s: s2, f: f2, midi: midi + semi };
      }
      return target && { type: 'interval', root: { s, f, midi }, target, semi, options: cfg.semis.slice(), byEar: cfg.byEar };
    }
    const pcs = cfg.naturals ? NATURAL_PCS : ALL_PCS;
    const s = pick(cfg.strings, rng);
    const fretsOf = (ok) => {
      const out = [];
      for (let f = 0; f <= cfg.maxFret; f++) if (ok((tuning[s] + f) % 12)) out.push(f);
      return out;
    };
    if (exercise === 'find') {
      const pc = pick(pcs, rng);
      return { type: 'find', s, pc, frets: fretsOf((x) => x === pc), maxFret: cfg.maxFret };
    }
    const f = pick(fretsOf((x) => pcs.includes(x)), rng);
    return { type: 'name', s, f, pc: (tuning[s] + f) % 12, midi: tuning[s] + f, options: pcs.slice() };
  }

  const sameQuestion = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /**
   * Pregunta nueva para un ejercicio ('name' | 'find' | 'interval'), un nivel (1–3) y una afinación (MIDI de las cuerdas).
   * prev (opcional) es la pregunta anterior: se evita repetirla dos veces seguidas.
   *   name     → { type, s, f, pc, midi, options }      la respuesta es una clase de altura de options
   *   find     → { type, s, pc, frets, maxFret }         la respuesta es { s, f } con f en frets
   *   interval → { type, root, target, semi, options, byEar }   la respuesta es un número de semitonos de options
   */
  function next(exercise, level, tuning, rng, prev) {
    const cfg = config(exercise, level, tuning.length);
    let last = null;
    for (let tries = 0; tries < 40; tries++) {
      const q = make(exercise, cfg, tuning, rng);
      if (!q) continue;
      last = q;
      if (!prev || !sameQuestion(q, prev)) return q;
    }
    return last;
  }

  /** ¿Es correcta la respuesta? answer: clase de altura (name), { s, f } (find) o semitonos (interval). */
  function check(q, answer) {
    if (q.type === 'find') return !!answer && answer.s === q.s && q.frets.includes(answer.f);
    return answer === (q.type === 'name' ? q.pc : q.semi);
  }

  /** Marcador tras una respuesta: aciertos, intentos, racha actual y mejor racha. No modifica stats. */
  function tally(stats, ok) {
    const streak = ok ? stats.streak + 1 : 0;
    return { right: stats.right + (ok ? 1 : 0), total: stats.total + 1, streak, best: Math.max(stats.best, streak) };
  }

  /** Generador de números pseudoaleatorios reproducible (para los tests). */
  function seeded(seed) {
    let x = (seed % 2147483646) + 1;
    return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
  }

  const api = { MAX_FRET, INTERVALS, EXERCISES, config, next, check, tally, seeded };
  global.FretQuiz = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
