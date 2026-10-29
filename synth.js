/* FretMaster · síntesis de cuerda pulsada (Karplus-Strong). Pura: no toca Web Audio, así se puede probar en node. */
(function (global) {
  'use strict';

  const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  /**
   * Devuelve un Float32Array con una cuerda pulsada.
   * La línea de retardo tiene N muestras; el filtro de promedio aporta 0,5 y un pasatodo de primer
   * orden aporta la parte fraccionaria, de modo que el periodo total es exactamente sampleRate / freq.
   */
  function pluckSamples(freq, sampleRate, seconds, opts) {
    const o = opts || {};
    const rho = o.rho === undefined ? 0.9992 : o.rho;     // pérdida por vuelta (más alto = sustain más largo)
    const pick = o.pick === undefined ? 0.55 : o.pick;    // 0 = ataque brillante, 1 = apagado
    const len = Math.max(1, Math.floor(sampleRate * seconds));
    const delay = sampleRate / freq - 0.5;
    const N = Math.max(2, Math.floor(delay));
    const frac = delay - N;
    const C = (1 - frac) / (1 + frac);

    // Excitación: ruido determinista (misma nota = mismo sonido) suavizado para quitar el chasquido.
    let seed = (Math.round(freq * 100) % 2147483646) + 1;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
    const line = new Float32Array(N);
    let prev = 0;
    let peak = 0;
    for (let i = 0; i < N; i++) {
      prev = pick * prev + (1 - pick) * rand();
      line[i] = prev;
      peak = Math.max(peak, Math.abs(prev));
    }
    const gain = peak > 0 ? 0.9 / peak : 1;
    for (let i = 0; i < N; i++) line[i] *= gain;

    const out = new Float32Array(len);
    let idx = 0;
    let lastS = 0;
    let apX = 0;
    let apY = 0;
    for (let n = 0; n < len; n++) {
      const s = line[idx];
      out[n] = s;
      const avg = 0.5 * rho * (s + lastS);
      lastS = s;
      const y = C * avg + apX - C * apY;      // pasatodo fraccional
      apX = avg;
      apY = y;
      line[idx] = y;
      idx = idx + 1 === N ? 0 : idx + 1;
    }

    // Fundido final para no dejar un corte seco.
    const fade = Math.min(len, Math.floor(sampleRate * 0.06));
    for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
    return out;
  }

  const api = { pluckSamples, midiToFreq };
  global.FretSynth = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
