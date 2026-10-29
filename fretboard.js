/* FretMaster · mástil: dibujo, resaltado por forma CAGED o acorde, y navegación con teclado. */
(function (global) {
  'use strict';

  const T = global.FretTheory;
  const { $, $$, el } = global.FretApp.Util;

  let state = null;
  let onNote = () => {};

  /** Conecta los eventos del mástil. onNote({ midi, el, s, f }) se llama al pulsar una nota. */
  function init(options) {
    onNote = options.onNote;
    const board = $('#fretboard');
    board.addEventListener('click', (e) => {
      const m = e.target.closest('.note-marker');
      if (!m) return;
      focusMarker(m, false);
      const s = Number(m.dataset.s);
      const f = Number(m.dataset.f);
      onNote({ midi: T.TUNINGS[state.t].midi[s] + f, el: m, s, f });
    });
    board.addEventListener('keydown', onKey);
  }

  /** Dibuja el mástil para la escala deletreada S según state (afinación, trastes, cejilla, zurdo, notas/intervalos). */
  function render(st, S, chordPcs) {
    state = st;
    const tuning = T.TUNINGS[st.t].midi;
    const n = tuning.length;
    const inner = $('#board-inner');
    const board = $('#fretboard');
    const nums = $('#fret-numbers');
    inner.style.setProperty('--frets', st.f);
    inner.style.setProperty('--n', n);
    inner.classList.toggle('lefty', !!st.l);
    board.textContent = '';
    nums.textContent = '';

    for (let f = 0; f <= st.f; f++) {
      nums.appendChild(el('span', T.INLAY_FRETS.includes(f) ? 'mark' : '', String(f)));
    }

    // Marcas del mástil en una capa propia: sirven para cualquier número de cuerdas.
    const inlays = el('div', 'layer');
    T.INLAY_FRETS.filter((f) => f <= st.f).forEach((f) => {
      (f % 12 === 0 ? ['top', 'bottom'] : ['']).forEach((pos) => {
        const d = el('i', 'inlay' + (pos ? ' ' + pos : ''));
        d.style.gridColumn = f + 1;
        inlays.appendChild(d);
      });
    });
    board.appendChild(inlays);

    for (let s = 0; s < n; s++) {
      const row = el('div', 'string-row');
      const line = el('div', 'string-line');
      line.style.height = (1 + s * 0.5) + 'px';
      row.appendChild(line);
      for (let f = 0; f <= st.f; f++) {
        const cell = el('div', 'fret-cell');
        const note = f >= st.c ? S.byPc.get((tuning[s] + f) % 12) : null;
        if (note) cell.appendChild(makeMarker(note, s, f));
        row.appendChild(cell);
      }
      board.appendChild(row);
    }

    if (st.c > 0) {
      const overlay = el('div', 'layer overlay');
      const capo = el('div', 'capo');
      capo.style.gridColumn = st.c + 1;
      overlay.appendChild(capo);
      board.appendChild(overlay);
    }
    highlight(st, S, chordPcs);
  }

  function makeMarker(note, s, f) {
    const b = el('button', `note-marker role-${note.role}`);
    b.type = 'button';
    b.tabIndex = -1;
    const txt = state.m === 'notes' ? note.name : note.display;
    if (txt.length > 2) b.classList.add('long');
    b.textContent = txt;
    b.dataset.s = s;
    b.dataset.f = f;
    b.dataset.pc = note.pc;
    b.setAttribute('aria-label', `Cuerda ${s + 1}, traste ${f}: ${note.name}, ${note.roleName} (${note.display})`);
    return b;
  }

  /** Atenúa las notas fuera de la forma CAGED elegida o del acorde seleccionado (chordPcs: Set de clases de altura o null). */
  function highlight(st, S, chordPcs) {
    state = st;
    const inShape = T.positionPredicate(st.s, st.k, st.p, st.f, T.TUNINGS[st.t].midi);
    $$('.note-marker').forEach((m) => {
      const fret = Number(m.dataset.f);
      const pc = Number(m.dataset.pc);
      const on = inShape(fret, pc) && (!chordPcs || chordPcs.has(pc));
      m.classList.toggle('note-active', on);
      m.classList.toggle('note-dimmed', !on);
      m.classList.toggle('chord-tone', !!chordPcs && on);
    });
    if (!$('.note-marker[tabindex="0"]')) {
      const first = $('.note-marker.note-active') || $('.note-marker');
      if (first) first.tabIndex = 0;
    }
  }

  /** Ilumina un momento las notas que cumplan match(marcador), salvo las atenuadas. */
  function flash(match, ms = 320) {
    $$('.note-marker').forEach((m) => {
      if (match(m) && !m.classList.contains('note-dimmed')) {
        m.classList.add('is-playing');
        setTimeout(() => m.classList.remove('is-playing'), ms);
      }
    });
  }

  // ---------- Teclado: un solo punto de tabulación y flechas entre notas ----------

  function focusMarker(m, focus = true) {
    const old = $('.note-marker[tabindex="0"]');
    if (old) old.tabIndex = -1;
    m.tabIndex = 0;
    if (focus) m.focus();
  }

  function onKey(e) {
    const cur = e.target.closest('.note-marker');
    if (!cur) return;
    const s = Number(cur.dataset.s);
    const f = Number(cur.dataset.f);
    const row = (i) => $$(`.note-marker[data-s="${i}"]`, $('#fretboard'));
    let target = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        const dir = (e.key === 'ArrowRight' ? 1 : -1) * (state.l ? -1 : 1);
        const r = row(s);
        target = dir > 0 ? r.find((m) => Number(m.dataset.f) > f) : r.reverse().find((m) => Number(m.dataset.f) < f);
        break;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        const r = row(s + (e.key === 'ArrowUp' ? -1 : 1));
        target = r.reduce((best, m) => (!best || Math.abs(Number(m.dataset.f) - f) < Math.abs(Number(best.dataset.f) - f) ? m : best), null);
        break;
      }
      case 'Home': target = row(s)[0]; break;
      case 'End': { const r = row(s); target = r[r.length - 1]; break; }
      default: return;
    }
    if (target) {
      e.preventDefault();
      focusMarker(target);
    }
  }

  global.FretApp.Fretboard = { init, render, highlight, flash };
})(window);
