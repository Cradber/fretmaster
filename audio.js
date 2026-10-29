/* FretMaster · salida de audio. Cada nota se sintetiza una vez con synth.js (cuerda pulsada) y se reutiliza. */
(function (global) {
  'use strict';

  let ctx = null;
  let master = null;
  const buffers = new Map();

  function context() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noteBuffer(ac, midi) {
    const key = midi + ':' + ac.sampleRate;
    let buf = buffers.get(key);
    if (!buf) {
      const data = global.FretSynth.pluckSamples(global.FretSynth.midiToFreq(midi), ac.sampleRate, 3);
      buf = ac.createBuffer(1, data.length, ac.sampleRate);
      buf.copyToChannel(data, 0);
      buffers.set(key, buf);
    }
    return buf;
  }

  /** Toca una nota MIDI. delay y dur en segundos, vol de 0 a 1. */
  function pluck(midi, delay = 0, dur = 1.4, vol = 0.3) {
    const ac = context();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noteBuffer(ac, midi);
    const body = ac.createBiquadFilter();       // suaviza el brillo, como la caja de la guitarra
    body.type = 'lowpass';
    body.frequency.value = 4200;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol * 1.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur + 0.8, 2.9));
    src.connect(body);
    body.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 3);
  }

  global.FretApp = global.FretApp || {};
  global.FretApp.Audio = { pluck };
})(window);
