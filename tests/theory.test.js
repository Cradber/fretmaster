'use strict';
const assert = require('node:assert/strict');
const T = require('../theory.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}
const names = (pc, scale, pref) => T.spellScale(pc, scale, pref).notes.map((n) => n.name).join(' ');

test('C mayor', () => assert.equal(names(0, 'major'), 'C D E F G A B'));
test('F mayor usa B♭, no A♯ (bug original)', () => assert.equal(names(5, 'major'), 'F G A B♭ C D E'));
test('D♭ mayor', () => assert.equal(names(1, 'major'), 'D♭ E♭ F G♭ A♭ B♭ C'));
test('pc 3 en mayor es E♭, no D♯', () => assert.equal(names(3, 'major'), 'E♭ F G A♭ B♭ C D'));
test('C♯ menor natural usa sostenidos', () => assert.equal(names(1, 'minor'), 'C♯ D♯ E F♯ G♯ A B'));
test('forzar sostenidos', () => assert.equal(names(10, 'major', 'sharp').split(' ')[0], 'A♯'));
test('forzar bemoles', () => assert.equal(names(6, 'major', 'flat').split(' ')[0], 'G♭'));
test('D dórico', () => assert.equal(names(2, 'dorian'), 'D E F G A B C'));
test('A menor armónica', () => assert.equal(names(9, 'harmonic_minor'), 'A B C D E F G♯'));
test('C disminuida T–S', () => assert.equal(names(0, 'diminished'), 'C D E♭ F G♭ A♭ B♭♭ B'));
test('C tonos enteros', () => assert.equal(names(0, 'whole_tone'), 'C D E F♯ G♯ B♭'));

test('lidio: el ♯4 es nota de color, no quinta (bug original)', () => {
  const s = T.spellScale(0, 'lydian');
  assert.equal(s.byPc.get(6).role, 'tritone');
  assert.equal(s.byPc.get(7).role, 'fifth');
});
test('blues: ♭5 es nota de color y la 5ª es quinta', () => {
  const s = T.spellScale(0, 'blues');
  assert.equal(s.byPc.get(6).role, 'tritone');
  assert.equal(s.byPc.get(7).role, 'fifth');
});
test('locrio: la ♭5 hace de quinta y la leyenda lo dice', () => {
  const s = T.spellScale(11, 'locrian');
  assert.equal(s.byPc.get(5).role, 'fifth');
  const l = T.legendFor(s).find((x) => x.role === 'fifth');
  assert.match(l.label, /disminuida/);
});
test('leyenda penta mayor no incluye séptima', () => {
  const roles = T.legendFor(T.spellScale(0, 'major_pentatonic')).map((x) => x.role);
  assert.ok(!roles.includes('seventh'));
});

test('patrón de pasos', () => {
  assert.equal(T.stepPattern('major').join(' '), 'T T S T T T S');
  assert.equal(T.stepPattern('harmonic_minor').join(' '), 'T S T T S T½ S');
  assert.equal(T.stepPattern('diminished').join(' '), 'T S T S T S T S');
});

test('acordes diatónicos de C mayor (tríadas)', () => {
  const c = T.diatonicChords(T.spellScale(0, 'major'), 3);
  assert.deepEqual(c.map((x) => x.name), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
  assert.deepEqual(c.map((x) => x.roman), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
});
test('acordes diatónicos de C mayor (séptimas)', () => {
  const c = T.diatonicChords(T.spellScale(0, 'major'), 4);
  assert.deepEqual(c.map((x) => x.name), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
  assert.equal(c[6].roman, 'viiø7');
});
test('acordes de A menor armónica', () => {
  const c = T.diatonicChords(T.spellScale(9, 'harmonic_minor'), 4);
  assert.equal(c[0].name, 'Am(maj7)');
  assert.equal(c[2].name, 'Cmaj7♯5');
  assert.equal(c[2].roman, '♭III+maj7');
  assert.equal(c[6].name, 'G♯dim7');
});
test('no hay acordes en pentatónicas', () => {
  assert.equal(T.diatonicChords(T.spellScale(0, 'minor_pentatonic'), 3).length, 0);
});
test('ningún acorde diatónico queda sin clasificar', () => {
  ['major', 'minor', 'harmonic_minor', 'melodic_minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'phrygian_dominant'].forEach((id) => {
    [3, 4].forEach((size) => {
      T.diatonicChords(T.spellScale(0, id), size).forEach((ch) => assert.ok(!ch.name.includes('?'), id + ' ' + ch.name));
    });
  });
});

test('formas CAGED de C mayor repetidas en la octava', () => {
  const r = T.positionRanges('major', 0, 22);
  assert.deepEqual(r.C, [[0, 3], [12, 15]]);
  assert.deepEqual(r.all, [[0, 22]]);
});
test('D dórico usa las cajas de su mayor madre (C)', () => {
  assert.deepEqual(T.positionRanges('dorian', 2, 22).C, T.positionRanges('major', 0, 22).C);
});
test('A menor usa las cajas de C mayor (relativa)', () => {
  assert.deepEqual(T.positionRanges('minor', 9, 22).A, T.positionRanges('major', 0, 22).A);
});
test('todas las ventanas caben en el mástil de 24 trastes', () => {
  const r = T.positionRanges('major', 7, 24);
  Object.values(r).flat().forEach(([a, b]) => assert.ok(a >= 0 && b <= 24 && a <= b));
});

test('MIDI de acorde asciende', () => {
  const m = T.chordMidis([0, 4, 7, 11]);
  assert.deepEqual(m, [48, 52, 55, 59]);
});
test('MIDI de escala llega a la octava', () => {
  const m = T.scaleMidis(T.spellScale(0, 'major'));
  assert.equal(m[0], 48);
  assert.equal(m[m.length - 1], 60);
});

test('etiquetas de tecla', () => {
  assert.equal(T.keyLabel(0, 'auto'), 'C');
  assert.equal(T.keyLabel(1, 'auto'), 'C♯/D♭');
  assert.equal(T.keyLabel(1, 'flat'), 'D♭');
  assert.equal(T.keyLabel(6, 'sharp'), 'F♯');
});

test('todas las escalas se deletrean con 12 tonalidades sin lanzar error', () => {
  Object.keys(T.SCALES).forEach((id) => {
    for (let pc = 0; pc < 12; pc++) {
      ['auto', 'sharp', 'flat'].forEach((p) => {
        const s = T.spellScale(pc, id, p);
        assert.equal(s.notes[0].pc, pc);
      });
    }
  });
});

console.log(`\n${passed} pruebas pasaron`);
