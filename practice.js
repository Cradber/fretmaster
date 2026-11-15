/* FretMaster · pestaña Práctica: ejercicios de notas e intervalos sobre un mástil propio.
   Qué se pregunta y qué respuesta es correcta lo decide quiz.js (puro); aquí se dibuja, se hace sonar y se lleva la cuenta.
   El mástil usa las mismas clases CSS que el de la herramienta, pero no sus marcadores (.note-marker), para no mezclarse con él. */
(function (global) {
  'use strict';

  const T = global.FretTheory;
  const Q = global.FretQuiz;
  const A = global.FretApp;
  const { $, $$, el } = A.Util;

  const BEST_KEY = 'fm-practice';      // mejores rachas por ejercicio y nivel, en este navegador
  const NEXT_DELAY_MS = 1100;          // tras un acierto se pasa sola a la pregunta siguiente
  const SOLFEGE = { 0: 'Do', 2: 'Re', 4: 'Mi', 5: 'Fa', 7: 'Sol', 9: 'La', 11: 'Si' };
  const NO_STATS = { right: 0, total: 0, streak: 0, best: 0 };

  let api = null;          // { setState, announce }
  let state = null;
  let tuning = [];
  let question = null;
  let answered = null;     // null mientras no se responde; después, { ok, given }
  let stats = NO_STATS;
  let signature = '';      // ejercicio | nivel | afinación: si cambia, se empieza de cero
  let nextTimer = null;

  const interval = (semi) => Q.INTERVALS.find((i) => i.semi === semi);
  const noteLabel = (pc) => T.keyLabel(pc, state.a) + (SOLFEGE[pc] ? ` (${SOLFEGE[pc]})` : '');

  function loadBest() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveBest(key, value) {
    try { localStorage.setItem(BEST_KEY, JSON.stringify({ ...loadBest(), [key]: value })); } catch (e) { /* almacenamiento bloqueado */ }
  }

  function init(options) {
    api = options;
    const kinds = $('#quiz-kind');
    Object.entries(Q.EXERCISES).forEach(([id, ex]) => {
      const b = el('button', '', ex.title);
      b.type = 'button';
      b.dataset.x = id;
      kinds.appendChild(b);
    });
    const levels = $('#quiz-level');
    [1, 2, 3].forEach((n) => {
      const b = el('button', '', 'Nivel ' + n);
      b.type = 'button';
      b.dataset.y = n;
      levels.appendChild(b);
    });

    kinds.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { api.setState({ x: b.dataset.x }); announcePrompt(); }
    });
    levels.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { api.setState({ y: Number(b.dataset.y) }); announcePrompt(); }
    });
    $('#quiz-answers').addEventListener('click', (e) => {
      const b = e.target.closest('.quiz-answer');
      if (b) answer(Number(b.dataset.a));
    });
    $('#quiz-board').addEventListener('click', (e) => {
      const b = e.target.closest('.quiz-cell');
      if (b) answer({ s: Number(b.dataset.s), f: Number(b.dataset.f) });
    });
    $('#quiz-next').addEventListener('click', () => advance(true));
    $('#quiz-replay').addEventListener('click', play);
  }

  /** Dibuja la pestaña para el estado dado. Solo cambia de pregunta si cambian el ejercicio, el nivel o la afinación. */
  function render(st) {
    state = st;
    tuning = T.TUNINGS[st.t].midi;
    const sig = [st.x, st.y, st.t].join('|');
    if (sig !== signature) {
      signature = sig;
      stats = { ...NO_STATS, best: Number(loadBest()[st.x + '-' + st.y]) || 0 };
      question = null;
      newQuestion();
    }
    draw();
  }

  function newQuestion() {
    clearTimeout(nextTimer);
    question = Q.next(state.x, state.y, tuning, Math.random, question);
    answered = null;
  }

  // ---------- Responder y avanzar ----------

  function answer(given) {
    if (answered || !question) return;
    const ok = Q.check(question, given);
    answered = { ok, given };
    stats = Q.tally(stats, ok);
    saveBest(state.x + '-' + state.y, stats.best);
    if (question.type === 'interval') play();
    else if (state.v) A.Audio.pluck(question.type === 'find' ? tuning[given.s] + given.f : question.midi);
    draw();
    api.announce($('#quiz-feedback').textContent);
    // Al redibujar se pierde el foco del botón pulsado: pasa a «Siguiente», que es lo que toca ahora.
    $('#quiz-next').focus();
    if (ok) nextTimer = setTimeout(() => advance(false), NEXT_DELAY_MS);
  }

  /** Pasa a la pregunta siguiente. byUser: viene de un clic, así que el intervalo puede sonar (los navegadores lo exigen). */
  function advance(byUser) {
    const hadFocus = $('#panel-practica').contains(document.activeElement);
    newQuestion();
    draw();
    if (question.type === 'interval' && (byUser || A.Audio.state() === 'running')) play();
    if (hadFocus) {
      const target = $('#quiz-answers .quiz-answer') || $('#quiz-board .quiz-cell');
      if (target) target.focus();
    }
    announcePrompt();
  }

  /** Hace sonar la pregunta: la nota, o las dos notas del intervalo una tras otra. */
  function play() {
    if (!question) return;
    if (question.type === 'interval') {
      A.Audio.pluck(question.root.midi, 0, 1.2);
      A.Audio.pluck(question.target.midi, 0.6, 1.4);
    } else if (question.type === 'name') {
      A.Audio.pluck(question.midi);
    }
  }

  // ---------- Textos ----------

  function promptText() {
    const q = question;
    if (q.type === 'name') return { main: '¿Qué nota es?', sub: `Cuerda ${q.s + 1}, traste ${q.f}` };
    if (q.type === 'find') return { main: `Toca ${noteLabel(q.pc)}`, sub: `en la cuerda ${q.s + 1}` };
    return q.byEar
      ? { main: '¿Qué intervalo suena?', sub: 'Dos notas, de la grave a la aguda' }
      : { main: '¿Qué intervalo hay entre las dos notas?', sub: 'De la tónica (1) a la nota marcada con ?' };
  }

  function announcePrompt() {
    const p = promptText();
    api.announce(`${p.main} ${p.sub}`);
  }

  function feedbackText() {
    if (!answered) return '';
    const q = question;
    const head = answered.ok ? '✓ Correcto.' : '✗ No.';
    if (q.type === 'name') return `${head} Es ${noteLabel(q.pc)}.`;
    if (q.type === 'find') {
      const where = `${noteLabel(q.pc)} está en ${q.frets.length > 1 ? 'los trastes' : 'el traste'} ${q.frets.join(' y ')} de la cuerda ${q.s + 1}`;
      return answered.ok ? `${head} ${where}.` : `${head} Has tocado ${noteLabel((tuning[q.s] + answered.given.f) % 12)}; ${where}.`;
    }
    const i = interval(q.semi);
    return `${head} Es una ${i.name} (${i.symbol}): ${q.semi} ${q.semi === 1 ? 'semitono' : 'semitonos'}.`;
  }

  // ---------- Dibujo ----------

  function draw() {
    const ex = Q.EXERCISES[state.x];
    $$('#quiz-kind button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.x === state.x)));
    $$('#quiz-level button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.y) === state.y)));
    $('#quiz-level-desc').textContent = `Nivel ${state.y}: ${ex.levels[state.y - 1].toLowerCase()}.`;

    const p = promptText();
    $('#quiz-prompt').textContent = p.main;
    $('#quiz-sub').textContent = p.sub;

    drawBoard();
    drawAnswers();

    const fb = $('#quiz-feedback');
    fb.textContent = feedbackText();
    fb.classList.toggle('is-ok', !!answered && answered.ok);
    fb.classList.toggle('is-bad', !!answered && !answered.ok);
    $('#quiz-next').hidden = !answered;
    $('#quiz-replay').hidden = question.type === 'find';
    $('#quiz-replay').textContent = question.type === 'interval' ? '▶ Escuchar el intervalo' : '▶ Escuchar la nota';
    // En «Nombra la nota» el sonido es una pista: solo se ofrece una vez respondida.
    if (question.type === 'name') $('#quiz-replay').hidden = !answered;
    $('#quiz-score').textContent = `Racha: ${stats.streak} · Mejor racha: ${stats.best} · Aciertos: ${stats.right} de ${stats.total}`;
  }

  function dot(cls, text) {
    const d = el('span', 'qdot ' + cls, text);
    if (text.length > 2) d.classList.add('long');
    return d;
  }

  /** Qué se pinta en la posición (cuerda s, traste f) según el ejercicio y si ya se ha respondido. */
  function cellContent(s, f) {
    const q = question;
    const here = (pos) => pos.s === s && pos.f === f;
    if (q.type === 'name') {
      if (!here(q)) return null;
      return answered ? dot('qdot--ok', T.keyLabel(q.pc, state.a === 'auto' ? 'sharp' : state.a)) : dot('qdot--ask', '?');
    }
    if (q.type === 'find') {
      if (s !== q.s) return null;
      if (!answered) {
        const b = el('button', 'quiz-cell');
        b.type = 'button';
        b.dataset.s = s;
        b.dataset.f = f;
        b.setAttribute('aria-label', `Cuerda ${s + 1}, traste ${f}`);
        return b;
      }
      const name = T.keyLabel((tuning[s] + f) % 12, state.a === 'auto' ? 'sharp' : state.a);
      if (q.frets.includes(f)) return dot('qdot--ok', name);
      return here(answered.given) ? dot('qdot--bad', name) : null;
    }
    if (q.byEar && !answered) return null;
    if (here(q.root)) return dot('role-root', '1');
    if (here(q.target)) return answered ? dot('qdot--ok', interval(q.semi).symbol) : dot('qdot--ask', '?');
    return null;
  }

  function drawBoard() {
    const inner = $('#quiz-inner');
    const board = $('#quiz-board');
    const nums = $('#quiz-numbers');
    const n = tuning.length;
    inner.style.setProperty('--frets', Q.MAX_FRET);
    inner.style.setProperty('--n', n);
    inner.classList.toggle('lefty', !!state.l);
    board.textContent = '';
    nums.textContent = '';
    board.setAttribute('aria-label', question.type === 'find'
      ? `Mástil: elige un traste de la cuerda ${question.s + 1}`
      : 'Mástil con la pregunta');

    for (let f = 0; f <= Q.MAX_FRET; f++) nums.appendChild(el('span', T.INLAY_FRETS.includes(f) ? 'mark' : '', String(f)));
    const inlays = el('div', 'layer');
    T.INLAY_FRETS.filter((f) => f <= Q.MAX_FRET).forEach((f) => {
      (f % 12 === 0 ? ['top', 'bottom'] : ['']).forEach((pos) => {
        const d = el('i', 'inlay' + (pos ? ' ' + pos : ''));
        d.style.gridColumn = f + 1;
        inlays.appendChild(d);
      });
    });
    board.appendChild(inlays);

    for (let s = 0; s < n; s++) {
      const row = el('div', 'string-row');
      if (question.type === 'find' && s === question.s) row.classList.add('quiz-row');
      const line = el('div', 'string-line');
      line.style.height = (1 + s * 0.5) + 'px';
      row.appendChild(line);
      for (let f = 0; f <= Q.MAX_FRET; f++) {
        const cell = el('div', 'fret-cell');
        const content = cellContent(s, f);
        if (content) cell.appendChild(content);
        row.appendChild(cell);
      }
      board.appendChild(row);
    }
    $('#quiz-ear').hidden = !(question.type === 'interval' && question.byEar && !answered);
  }

  function drawAnswers() {
    const box = $('#quiz-answers');
    box.textContent = '';
    box.hidden = question.type === 'find';
    $('#quiz-tap').hidden = question.type !== 'find' || !!answered;
    if (question.type === 'find') return;
    const right = question.type === 'name' ? question.pc : question.semi;
    question.options.forEach((value) => {
      const b = el('button', 'quiz-answer');
      b.type = 'button';
      b.dataset.a = value;
      if (question.type === 'name') {
        b.append(el('b', '', T.keyLabel(value, state.a)));
        if (SOLFEGE[value]) b.append(el('small', '', SOLFEGE[value]));
      } else {
        const i = interval(value);
        b.append(el('b', '', i.symbol), el('small', '', i.name));
        b.setAttribute('aria-label', `${i.name}, ${i.symbol}`);
      }
      if (answered) {
        b.disabled = true;
        if (value === right) b.classList.add('is-right');
        else if (value === answered.given) b.classList.add('is-wrong');
      }
      box.appendChild(b);
    });
  }

  A.Practice = { init, render };
})(window);
