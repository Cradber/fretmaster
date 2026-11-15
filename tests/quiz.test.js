'use strict';
// Ejercicios de práctica (quiz.js): cada nivel pregunta solo lo que anuncia y la corrección es la que debe ser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const T = require('../theory.js');
const Q = require('../quiz.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }

const STD = T.TUNINGS.standard.midi;
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const LEVELS = [1, 2, 3];
/** Muchas preguntas seguidas de un ejercicio y nivel, con azar reproducible. */
function sample(exercise, level, tuning = STD, n = 400) {
  const rng = Q.seeded(exercise.length * 100 + level * 7 + tuning.length);
  const out = [];
  let prev = null;
  for (let i = 0; i < n; i++) { prev = Q.next(exercise, level, tuning, rng, prev); out.push(prev); }
  return out;
}

test('el catálogo tiene tres ejercicios con tres niveles descritos', () => {
  assert.deepEqual(Object.keys(Q.EXERCISES), ['name', 'find', 'interval']);
  Object.values(Q.EXERCISES).forEach((ex) => {
    assert.ok(ex.title.length > 3);
    assert.equal(ex.levels.length, 3);
    ex.levels.forEach((d) => assert.ok(d.length > 10));
  });
});

test('los ejercicios que valida state.js son los del catálogo', () => {
  const ctx = { FretTheory: T, FretApp: { Util: { has: (o, k) => Object.prototype.hasOwnProperty.call(o, k) } } };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'state.js'), 'utf8'), ctx);
  const S = ctx.FretApp.State;
  Object.keys(Q.EXERCISES).forEach((x) => assert.equal(S.sanitize({ x }).x, x));
  assert.equal(S.sanitize({ x: 'otro' }).x, S.DEFAULTS.x);
  LEVELS.forEach((y) => assert.equal(S.sanitize({ y: String(y) }).y, y));
  ['0', '4', 'x'].forEach((y) => assert.equal(S.sanitize({ y }).y, S.DEFAULTS.y));
  assert.equal(S.sanitize({ w: 'practica' }).w, 'practica');
});

test('los doce intervalos están completos y en orden', () => {
  assert.deepEqual(Q.INTERVALS.map((i) => i.semi), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(new Set(Q.INTERVALS.map((i) => i.symbol)).size, 12);
  // Los símbolos son los de las fórmulas de la app: 7 semitonos es la quinta de la escala mayor.
  const major = T.parseFormula(T.SCALES.major.formula);
  major.slice(1).forEach((t) => assert.equal(Q.INTERVALS.find((i) => i.semi === t.semi).symbol, T.pretty(t.token)));
});

test('nombra la nota: la posición está en el rango y la respuesta es la nota que suena', () => {
  LEVELS.forEach((level) => {
    sample('name', level).forEach((q) => {
      assert.equal(q.type, 'name');
      assert.ok(q.f >= 0 && q.f <= Q.MAX_FRET);
      assert.equal(q.pc, (STD[q.s] + q.f) % 12);
      assert.equal(q.midi, STD[q.s] + q.f);
      assert.ok(q.options.includes(q.pc), 'la respuesta correcta está entre las opciones');
      assert.ok(Q.check(q, q.pc));
      q.options.filter((pc) => pc !== q.pc).forEach((pc) => assert.ok(!Q.check(q, pc)));
    });
  });
});

test('niveles de notas: 1 = naturales en las cuerdas 6 y 5; 2 = naturales en todas; 3 = las doce', () => {
  ['name', 'find'].forEach((ex) => {
    const strings = (level) => new Set(sample(ex, level).map((q) => q.s));
    const pcs = (level) => new Set(sample(ex, level).map((q) => q.pc));
    assert.deepEqual([...strings(1)].sort(), [4, 5], ex);
    assert.equal(strings(2).size, 6, ex);
    assert.deepEqual([...pcs(1)].sort((a, b) => a - b), NATURALS, ex);
    assert.deepEqual([...pcs(2)].sort((a, b) => a - b), NATURALS, ex);
    assert.equal(pcs(3).size, 12, ex);
  });
  assert.deepEqual(sample('name', 1)[0].options, NATURALS);
  assert.equal(sample('name', 3)[0].options.length, 12);
});

test('encuentra la nota: valen todos los trastes de la cuerda con esa nota, y solo esos', () => {
  LEVELS.forEach((level) => {
    sample('find', level).forEach((q) => {
      assert.ok(q.frets.length >= 1 && q.frets.length <= 2);
      for (let f = 0; f <= Q.MAX_FRET; f++) {
        const right = (STD[q.s] + f) % 12 === q.pc;
        assert.equal(Q.check(q, { s: q.s, f }), right, `cuerda ${q.s + 1}, traste ${f}`);
        assert.equal(q.frets.includes(f), right);
      }
      assert.ok(!Q.check(q, { s: (q.s + 1) % 6, f: q.frets[0] }), 'otra cuerda no vale');
      assert.ok(!Q.check(q, undefined));
    });
  });
  // La nota al aire se repite en el traste 12: las dos posiciones son correctas.
  const open = sample('find', 2).find((q) => q.pc === STD[q.s] % 12);
  assert.deepEqual(open.frets, [0, 12]);
});

test('intervalos: la segunda nota está a los semitonos pedidos, más aguda y dentro del mástil', () => {
  LEVELS.forEach((level) => {
    sample('interval', level).forEach((q) => {
      assert.equal(q.root.midi, STD[q.root.s] + q.root.f);
      assert.equal(q.target.midi, STD[q.target.s] + q.target.f);
      assert.equal(q.target.midi - q.root.midi, q.semi);
      assert.ok(q.target.f >= 0 && q.target.f <= Q.MAX_FRET && q.target.s <= q.root.s);
      assert.ok(q.options.includes(q.semi));
      assert.ok(Q.check(q, q.semi));
      q.options.filter((s) => s !== q.semi).forEach((s) => assert.ok(!Q.check(q, s)));
    });
  });
});

test('niveles de intervalos: 1 = básicos a la vista; 2 = los doce; 3 = los doce, de oído', () => {
  const semis = (level) => [...new Set(sample('interval', level).map((q) => q.semi))].sort((a, b) => a - b);
  assert.deepEqual(semis(1), [3, 4, 5, 7, 12]);
  assert.equal(semis(2).length, 12);
  assert.equal(semis(3).length, 12);
  assert.ok(sample('interval', 1).every((q) => !q.byEar) && sample('interval', 2).every((q) => !q.byEar));
  assert.ok(sample('interval', 3).every((q) => q.byEar));
  // El dibujo queda a mano: la octava desde la 6ª cuerda cae dos cuerdas más arriba, dos trastes más allá (lección 0.3).
  const octave = sample('interval', 1).find((q) => q.semi === 12 && q.root.s === 5);
  assert.deepEqual([octave.target.s, octave.target.f - octave.root.f], [3, 2]);
});

test('no se repite la misma pregunta dos veces seguidas', () => {
  ['name', 'find', 'interval'].forEach((ex) => LEVELS.forEach((level) => {
    const qs = sample(ex, level, STD, 300);
    for (let i = 1; i < qs.length; i++) assert.notDeepEqual(qs[i], qs[i - 1], `${ex} nivel ${level}, pregunta ${i}`);
  }));
});

test('funciona en todas las afinaciones, también con siete cuerdas', () => {
  Object.entries(T.TUNINGS).forEach(([id, t]) => {
    ['name', 'find', 'interval'].forEach((ex) => LEVELS.forEach((level) => {
      sample(ex, level, t.midi, 60).forEach((q) => {
        assert.ok(q, `${id}: ${ex} nivel ${level} no genera pregunta`);
        if (q.type === 'name') assert.equal(q.pc, (t.midi[q.s] + q.f) % 12);
        if (q.type === 'find') assert.ok(q.frets.length >= 1, id);
        if (q.type === 'interval') assert.equal(t.midi[q.target.s] + q.target.f - q.root.midi, q.semi);
      });
    }));
  });
});

test('el marcador cuenta aciertos, intentos, racha y mejor racha sin modificar el anterior', () => {
  const zero = { right: 0, total: 0, streak: 0, best: 0 };
  const run = [true, true, false, true].reduce((s, ok) => Q.tally(s, ok), zero);
  assert.deepEqual(run, { right: 3, total: 4, streak: 1, best: 2 });
  assert.deepEqual(zero, { right: 0, total: 0, streak: 0, best: 0 });
  assert.equal(Q.tally({ right: 0, total: 0, streak: 0, best: 7 }, true).best, 7, 'la mejor racha guardada no baja');
});

test('el generador reproducible da la misma serie para la misma semilla y valores en [0, 1)', () => {
  const a = Q.seeded(42), b = Q.seeded(42);
  for (let i = 0; i < 200; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

console.log(`\n${passed} pruebas de ejercicios pasaron`);
