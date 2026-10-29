'use strict';
const assert = require('node:assert/strict');
const { pluckSamples, midiToFreq } = require('../synth.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

/** Frecuencia por autocorrelación con interpolación parabólica. */
function estimateFreq(buf, sr, expected) {
  const start = Math.floor(sr * 0.12);            // tras el ataque
  const size = Math.floor(sr * 0.25);
  const seg = buf.subarray(start, start + size);
  const minLag = Math.floor(sr / (expected * 1.5));
  const maxLag = Math.ceil(sr / (expected * 0.67));
  const ac = (lag) => { let a = 0; for (let i = 0; i + lag < seg.length; i++) a += seg[i] * seg[i + lag]; return a; };
  let best = minLag;
  let bestV = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const v = ac(lag);
    if (v > bestV) { bestV = v; best = lag; }
  }
  const a = ac(best - 1), b = ac(best), c = ac(best + 1);
  const shift = (a - c) / (2 * (a - 2 * b + c));
  return sr / (best + shift);
}
const cents = (f, ref) => 1200 * Math.log2(f / ref);

[44100, 48000].forEach((sr) => {
  [40, 45, 52, 59, 64, 76].forEach((midi) => {
    test(`afinación: MIDI ${midi} a ${sr} Hz queda a menos de 8 cents`, () => {
      const f = midiToFreq(midi);
      const est = estimateFreq(pluckSamples(f, sr, 1.0), sr, f);
      assert.ok(Math.abs(cents(est, f)) < 8, `${est.toFixed(2)} Hz vs ${f.toFixed(2)} Hz (${cents(est, f).toFixed(1)} cents)`);
    });
  });
});

test('la señal es finita, no está en silencio y no satura', () => {
  const buf = pluckSamples(midiToFreq(52), 44100, 2);
  let peak = 0;
  for (const v of buf) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
  assert.ok(peak > 0.3 && peak <= 1, 'pico ' + peak);
});

test('la energía decae con el tiempo', () => {
  const sr = 44100;
  const buf = pluckSamples(midiToFreq(52), sr, 3);
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += buf[i] * buf[i]; return Math.sqrt(s / (b - a)); };
  const early = rms(0, sr * 0.3);
  const mid = rms(sr * 1, sr * 1.3);
  const late = rms(sr * 2.4, sr * 2.7);
  assert.ok(early > mid && mid > late, `${early.toFixed(3)} > ${mid.toFixed(3)} > ${late.toFixed(3)}`);
});

test('las notas agudas se apagan antes que las graves', () => {
  const sr = 44100;
  const tail = (midi) => {
    const b = pluckSamples(midiToFreq(midi), sr, 2);
    let s = 0;
    for (let i = sr * 1.2; i < sr * 1.5; i++) s += b[i] * b[i];
    return Math.sqrt(s / (sr * 0.3));
  };
  assert.ok(tail(40) > tail(76));
});

test('es determinista: la misma nota suena igual', () => {
  const a = pluckSamples(220, 44100, 0.2);
  const b = pluckSamples(220, 44100, 0.2);
  assert.deepEqual(Array.from(a), Array.from(b));
});

test('el fundido final termina en silencio', () => {
  const b = pluckSamples(330, 44100, 0.5);
  assert.equal(b[b.length - 1], 0);
});

console.log(`\n${passed} pruebas pasaron`);
