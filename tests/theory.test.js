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

// ---------- Acordes y digitaciones ----------
const STD = T.TUNINGS.standard.midi;
const shape = (pc, type, pref) => T.findVoicings(STD, T.spellChord(pc, type, pref), 15, 12)
  .map((v) => [...v.frets].reverse().map((f) => (f < 0 ? 'x' : f)).join(''));

test('deletreo de acordes', () => {
  const sp = (pc, t, pref) => T.spellChord(pc, t, pref).notes.map((n) => n.name).join(' ');
  assert.equal(sp(0, 'maj7'), 'C E G B');
  assert.equal(sp(7, '7'), 'G B D F');
  assert.equal(sp(10, 'maj'), 'B♭ D F');
  assert.equal(sp(0, 'dim7'), 'C E♭ G♭ B♭♭');
  assert.equal(sp(0, '9'), 'C E G B♭ D');
  assert.equal(sp(2, 'm9'), 'D F A C E');
  assert.equal(T.spellChord(1, 'min').name, 'C♯m');
});
test('nombre del acorde incluye el símbolo', () => {
  assert.equal(T.spellChord(9, 'm7b5').name, 'Am7♭5');
  assert.equal(T.spellChord(5, 'mmaj7').name, 'Fm(maj7)');
});
test('digitaciones clásicas abiertas', () => {
  assert.ok(shape(0, 'maj').includes('x32010'), 'C');
  assert.ok(shape(7, 'maj').includes('320003'), 'G');
  assert.ok(shape(9, 'min').includes('x02210'), 'Am');
  assert.ok(shape(4, 'maj').includes('022100'), 'E');
  assert.ok(shape(2, 'min').includes('xx0231'), 'Dm');
  assert.ok(shape(9, '7').includes('x02020'), 'A7');
});
test('acorde con cejilla: F mayor tiene 133211', () => {
  const f = T.findVoicings(STD, T.spellChord(5, 'maj'), 15, 40).find((v) => [...v.frets].reverse().join('') === '133211');
  assert.ok(f, 'F con cejilla');
  assert.deepEqual(f.barre, { fret: 1, from: 0, to: 5 });
  assert.equal(f.fingers, 4);
});
test('todas las digitaciones respetan las reglas', () => {
  Object.keys(T.CHORD_TYPES).forEach((id) => {
    for (let pc = 0; pc < 12; pc++) {
      const ch = T.spellChord(pc, id);
      T.findVoicings(STD, ch, 15, 6).forEach((v) => {
        const low = v.frets.map((f, s) => (f >= 0 ? s : -1)).filter((s) => s >= 0).pop();
        assert.equal((STD[low] + v.frets[low]) % 12, pc, `${ch.name}: el bajo es la fundamental`);
        assert.ok(v.fingers <= 4 && v.maxFret - v.minFret <= 3, ch.name);
        v.frets.forEach((f, s) => { if (f >= 0) assert.ok(ch.pcs.includes((STD[s] + f) % 12), ch.name + ': nota ajena'); });
      });
    }
  });
});
test('todo acorde del catálogo tiene al menos una digitación en afinación estándar', () => {
  Object.keys(T.CHORD_TYPES).forEach((id) => {
    for (let pc = 0; pc < 12; pc++) {
      assert.ok(T.findVoicings(STD, T.spellChord(pc, id), 15, 1).length > 0, id + ' pc ' + pc);
    }
  });
});
test('funciona con 7 cuerdas y afinaciones alternativas', () => {
  Object.values(T.TUNINGS).forEach((t) => {
    assert.ok(T.findVoicings(t.midi, T.spellChord(0, 'maj7'), 15, 6).length > 0, t.name);
  });
});
test('cada calidad diatónica tiene tipo en el catálogo', () => {
  ['major', 'harmonic_minor', 'melodic_minor', 'locrian'].forEach((sc) => {
    [3, 4].forEach((size) => T.diatonicChords(T.spellScale(0, sc), size).forEach((c) => {
      assert.ok(T.CHORD_TYPES[T.QUALITY_TO_TYPE[c.quality]], sc + ' ' + c.name);
    }));
  });
});
test('las escalas siguen igual tras generalizar el parser', () => {
  assert.equal(names(0, 'major'), 'C D E F G A B');
});

test('cajas CAGED: en las 12 tonalidades cada caja completa tiene 2–3 notas por cuerda y no queda ninguna nota sin caja', () => {
  const S = T.TUNINGS.standard.midi;
  for (let pc = 0; pc < 12; pc++) {
    const sc = T.spellScale(pc, 'major');
    const ranges = T.positionRanges('major', pc, 22);
    let uncovered = 0;
    S.forEach((m) => {
      for (let x = 0; x <= 22; x++) {
        if (sc.byPc.has((m + x) % 12) && !T.CAGED_ORDER.some((id) => ranges[id].some(([a, b]) => x >= a && x <= b))) uncovered++;
      }
    });
    assert.equal(uncovered, 0, 'tonalidad ' + pc);
    T.CAGED_ORDER.forEach((id) => ranges[id].filter(([a, b]) => b - a >= T.CAGED[id][1] - T.CAGED[id][0]).forEach(([a, b]) => {
      S.forEach((m, si) => {
        let count = 0;
        for (let x = a; x <= b; x++) if (sc.byPc.has((m + x) % 12)) count++;
        assert.ok(count >= 2 && count <= 3, `tonalidad ${pc}, forma ${id} [${a},${b}], cuerda ${si + 1}: ${count} notas`);
      });
    }));
  }
});

test('con cejilla en el traste 2, A suena con la forma abierta de G (320003)', () => {
  const capoTuning = STD.map((m) => m + 2);
  const shapes = T.findVoicings(capoTuning, T.spellChord(9, 'maj'), 12, 60)
    .map((v) => [...v.frets].reverse().map((f) => (f < 0 ? 'x' : f)).join(''));
  assert.ok(shapes.includes('320003'), shapes.join(' '));
});
test('el filtro de posición alta y de cejilla encuentran candidatos en acordes comunes', () => {
  const all = T.findVoicings(STD, T.spellChord(0, 'maj'), 21, 80);
  assert.ok(all.some((v) => v.barre), 'con cejilla');
  assert.ok(all.some((v) => v.minFret >= 5), 'posición alta');
  assert.ok(all.some((v) => v.frets.includes(0)), 'abierta');
});

console.log(`\n${passed} pruebas pasaron`);
