/* FretMaster · salida de audio. Cada nota se sintetiza una vez con synth.js (cuerda pulsada) y se reutiliza.

   Safari e iOS son mucho más estrictos que Chrome con el audio web:
   - el contexto solo puede arrancar dentro de un gesto del usuario (clic, toque, tecla);
   - puede pasar a "interrupted" (estado propio de WebKit) al cambiar de pestaña, bloquear el teléfono o recibir una llamada, y
     solo vuelve con otro gesto;
   - en iPhone, el audio web se silencia con el interruptor de silencio salvo que la sesión de audio sea "playback".
   Por eso el contexto se crea y se reanuda en cada gesto, nunca desde un temporizador, y las notas se programan en el reloj de audio. */
(function (global) {
  'use strict';

  const nav = global.navigator || {};
  const IS_IOS = /iPad|iPhone|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
  const START_TIMEOUT_MS = 400;     // si el contexto no arranca en este tiempo, la nota se descarta en lugar de sonar tarde
  const PROBLEM_COOLDOWN_MS = 6000;

  let ctx = null;
  let master = null;
  let silentTrack = null;           // pista silenciosa (HTML) que fuerza la sesión "playback" cuando no hay Audio Session API
  let onProblemCb = null;
  let lastProblem = 0;
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
    return ctx;
  }

  /** Pide reanudar el contexto si no está en marcha ("suspended" en todos los navegadores, "interrupted" en Safari). */
  function resume(ac) {
    if (ac.state === 'running') return null;
    try { return ac.resume(); } catch (e) { return null; }
  }

  function problem(reason) {
    const now = Date.now();
    if (!onProblemCb || now - lastProblem < PROBLEM_COOLDOWN_MS) return;
    lastProblem = now;
    onProblemCb(reason);
  }

  // ---------- Desbloqueo en iOS ----------

  function setSessionPlayback() {
    try {
      if (nav.audioSession) { nav.audioSession.type = 'playback'; return; }
    } catch (e) { /* API no disponible */ }
    if (!IS_IOS || silentTrack || !global.Audio || !global.URL || !global.Blob) return;
    // Sin Audio Session API, reproducir una pista HTML silenciosa cambia la sesión de iOS a "playback".
    const rate = 8000;
    const n = 2000;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    try {
      silentTrack = new global.Audio(global.URL.createObjectURL(new global.Blob([buf], { type: 'audio/wav' })));
      silentTrack.loop = true;
      silentTrack.setAttribute('playsinline', '');
      silentTrack.setAttribute('x-webkit-airplay', 'deny');
      silentTrack.disableRemotePlayback = true;
      const p = silentTrack.play();
      if (p && p.catch) p.catch(() => { silentTrack = null; });
    } catch (e) { silentTrack = null; }
  }

  /** Crea el contexto (si falta), lo reanuda y prepara la sesión de audio. Se llama en cada gesto del usuario. */
  function unlock() {
    const ac = context();
    if (!ac) return;
    resume(ac);
    setSessionPlayback();
    if (ac.state !== 'running') return;
    try {   // un buffer vacío "calienta" la salida en Safari
      const s = ac.createBufferSource();
      s.buffer = ac.createBuffer(1, 1, 22050);
      s.connect(ac.destination);
      s.start(0);
    } catch (e) { /* ignorar */ }
  }

  function bindGestures() {
    const doc = global.document;
    if (!doc || !doc.addEventListener) return;
    let first = true;
    GESTURES.forEach((ev) => doc.addEventListener(ev, () => {
      if (first) { first = false; unlock(); return; }
      if (ctx && ctx.state !== 'running') resume(ctx);          // recuperación tras "interrupted" o "suspended"
    }, { capture: true, passive: true }));
    doc.addEventListener('visibilitychange', () => {
      if (!silentTrack) return;
      if (doc.hidden) silentTrack.pause(); else { const p = silentTrack.play(); if (p && p.catch) p.catch(() => {}); }
    });
  }

  // ---------- Síntesis y reproducción ----------

  function noteBuffer(ac, midi) {
    const key = midi + ':' + ac.sampleRate;
    let buf = buffers.get(key);
    if (!buf) {
      const data = global.FretSynth.pluckSamples(global.FretSynth.midiToFreq(midi), ac.sampleRate, 3);
      buf = ac.createBuffer(1, data.length, ac.sampleRate);
      buf.getChannelData(0).set(data);
      buffers.set(key, buf);
    }
    return buf;
  }

  function schedule(ac, midi, delay, dur, vol) {
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

  /**
   * Toca una nota MIDI. delay y dur en segundos, vol de 0 a 1.
   * Programa en el reloj de audio (no con temporizadores), así que una secuencia entera se puede lanzar desde un solo gesto.
   */
  function pluck(midi, delay = 0, dur = 1.4, vol = 0.3) {
    const ac = context();
    if (!ac) { problem('unsupported'); return; }
    if (ac.state === 'running') { schedule(ac, midi, delay, dur, vol); return; }

    // El contexto no está en marcha: se intenta reanudar y, si no arranca enseguida, la nota se descarta
    // (si no, al volver el audio sonarían de golpe todas las notas acumuladas).
    const p = resume(ac);
    let done = false;
    const timer = setTimeout(() => { done = true; problem('blocked'); }, START_TIMEOUT_MS);
    const ok = () => { if (done) return; done = true; clearTimeout(timer); if (ac.state === 'running') schedule(ac, midi, delay, dur, vol); else problem('blocked'); };
    const fail = () => { if (done) return; done = true; clearTimeout(timer); problem('blocked'); };
    if (p && p.then) p.then(ok, fail); else fail();
  }

  /** Estado del contexto: none, suspended, running, interrupted o closed. */
  function state() { return ctx ? ctx.state : 'none'; }

  /** Datos para el diagnóstico de la ventana de ajustes. */
  function info() {
    return {
      state: state(),
      sampleRate: ctx ? ctx.sampleRate : 0,
      session: nav.audioSession ? 'audioSession:' + nav.audioSession.type : (silentTrack ? 'pista silenciosa' : 'sin cambios'),
      ios: IS_IOS
    };
  }

  /** Registra una función que se llama cuando el navegador impide que suene el audio. */
  function onProblem(cb) { onProblemCb = cb; }

  bindGestures();
  global.FretApp = global.FretApp || {};
  global.FretApp.Audio = { pluck, unlock, state, info, onProblem };
})(window);
