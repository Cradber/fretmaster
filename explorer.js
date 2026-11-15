/* FretMaster · explorador de acordes: catálogo, inversiones y digitaciones calculadas (los diagramas los dibuja diagram.js). */
(function (global) {
  'use strict';

  const T = global.FretTheory;
  const A = global.FretApp;
  const { $, $$, el } = A.Util;

  const MAX_VOICINGS = 8;
  const FILTERS = {
    all: () => true,
    open: (v) => v.frets.includes(0),
    barre: (v) => !!v.barre,
    high: (v) => v.minFret >= 5
  };

  let api = null;          // { setState, announce }
  let state = null;
  let chord = null;        // acorde deletreado
  let label = '';          // nombre con bajo: C/E
  let bassIdx = 0;         // posición en chord.notes de la nota más grave
  let tuning = [];         // afinación efectiva: la del instrumento + cejilla
  let found = [];          // todas las digitaciones encontradas
  let shown = [];          // las que se muestran tras el filtro
  let selected = 0;
  let filter = 'all';

  function init(options) {
    api = options;
    const roots = $('#chord-root');
    for (let pc = 0; pc < 12; pc++) {
      const b = el('button', 'pill');
      b.type = 'button';
      b.dataset.pc = pc;
      roots.appendChild(b);
    }
    const types = $('#chord-type');
    T.CHORD_GROUPS.forEach((g) => {
      const row = el('div', 'scale-group');
      row.appendChild(el('span', 'glabel', g.title));
      const items = el('div', 'items');
      Object.entries(T.CHORD_TYPES).filter(([, t]) => t.group === g.id).forEach(([id, t]) => {
        const b = el('button', 'chip', t.name + (t.symbol ? ` (${t.symbol})` : ''));
        b.type = 'button';
        b.dataset.type = id;
        items.appendChild(b);
      });
      row.appendChild(items);
      types.appendChild(row);
    });

    const changed = () => api.announce(`${label}: ${chord.notes.map((n) => n.name).join(' ')}`);
    roots.addEventListener('click', (e) => {
      const b = e.target.closest('.pill');
      if (b) { api.setState({ r: Number(b.dataset.pc), b: 0 }); changed(); }
    });
    types.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (b) { api.setState({ q: b.dataset.type, b: 0 }); changed(); }
    });
    $('#bass-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { api.setState({ b: Number(b.dataset.b) }); changed(); }
    });
    $('#play-chord').addEventListener('click', () => play(shown[selected]));
    $('#voicing-filter').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      filter = b.dataset.vf;
      renderVoicings();
    });
    $('#voicings').addEventListener('click', (e) => {
      const b = e.target.closest('.voicing');
      if (!b) return;
      selected = Number(b.dataset.i);
      $$('#voicings .voicing').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.i) === selected)));
      play(shown[selected]);
    });
  }

  /** Abre el explorador con un acorde concreto (desde los acordes diatónicos). */
  function open(rootPc, typeId) {
    api.setState({ r: rootPc, q: typeId, b: 0, w: 'acordes' });
    api.announce(`${label}: ${chord.notes.map((n) => n.name).join(' ')}`);
  }

  function render(st) {
    state = st;
    chord = T.spellChord(st.r, st.q, st.a);
    const type = T.CHORD_TYPES[st.q];
    // Con cejilla, la forma se toca desde la cejilla: las cuerdas "al aire" pasan a sonar más agudas.
    tuning = T.TUNINGS[st.t].midi.map((m) => m + st.c);
    bassIdx = Math.min(st.b, chord.notes.length - 1);
    label = bassIdx ? `${chord.name}/${chord.notes[bassIdx].name}` : chord.name;
    found = T.findVoicings(tuning, chord, st.f - st.c - 1, 80, bassIdx);

    $$('#chord-root .pill').forEach((b) => {
      const pc = Number(b.dataset.pc);
      const text = T.keyLabel(pc, st.a);
      b.textContent = text;
      b.classList.toggle('pill--dual', text.includes('/'));
      b.setAttribute('aria-pressed', String(pc === st.r));
    });
    $$('#chord-type .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === st.q)));

    const capoNote = $('#capo-note');
    capoNote.hidden = st.c === 0;
    capoNote.textContent = `Cejilla en el traste ${st.c}: los trastes del diagrama se cuentan desde la cejilla y las notas son las que suenan.`;

    renderBass();

    // Las inversiones se nombran por el grado del bajo (3ª, 5ª, 7ª); con otra nota (la 2ª de un sus2, la 6ª, la 9ª) no hay número de inversión.
    const bass = chord.notes[bassIdx];
    const INVERSIONS = { 3: '1ª inversión', 5: '2ª inversión', 7: '3ª inversión' };
    const inversion = bassIdx === 0 ? '' : ` · ${INVERSIONS[bass.deg] || `bajo en la ${bass.display}ª`}`;
    const title = $('#explorer-name');
    title.textContent = '';
    title.append(el('strong', '', label), ` · ${type.name}${inversion}`);

    const chips = $('#explorer-chips');
    chips.textContent = '';
    chord.notes.forEach((n, i) => {
      const li = el('li');
      const b = el('button', 'note-chip');
      b.type = 'button';
      b.setAttribute('aria-label', `${n.name}, ${n.roleName}, intervalo ${n.display}. Pulsa para escucharla.`);
      const top = el('b');
      const dot = el('span', 'dot');
      dot.style.background = `var(--c-${n.role})`;
      top.append(dot, n.name);
      b.append(top, el('small', '', n.display));
      b.addEventListener('click', () => A.Audio.pluck(T.chordMidis(chord.pcs)[i]));
      li.appendChild(b);
      chips.appendChild(li);
    });
    $('#explorer-formula').textContent = `Fórmula: ${chord.notes.map((n) => n.display).join(' ')}`;

    const legend = $('#explorer-legend');
    legend.textContent = '';
    T.chordLegend(chord).forEach((item) => {
      const li = el('li');
      const dot = el('span', 'dot');
      dot.style.background = `var(--c-${item.role})`;
      li.append(dot, el('span', '', item.label));
      legend.appendChild(li);
    });

    renderVoicings();
  }

  function renderBass() {
    const seg = $('#bass-seg');
    seg.textContent = '';
    chord.notes.forEach((n, i) => {
      const b = el('button', '', `${n.name} (${n.display})`);
      b.type = 'button';
      b.dataset.b = i;
      b.setAttribute('aria-pressed', String(i === bassIdx));
      seg.appendChild(b);
    });
  }

  function renderVoicings() {
    $$('#voicing-filter button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vf === filter)));
    shown = found.filter(FILTERS[filter]).slice(0, MAX_VOICINGS);
    selected = 0;
    const box = $('#voicings');
    box.textContent = '';
    $('#play-chord').disabled = !shown.length;
    if (!shown.length) {
      box.appendChild(el('p', 'empty-voicings', found.length
        ? 'Ninguna digitación de este tipo para este acorde. Prueba con otro filtro.'
        : 'No hay digitaciones cómodas de este acorde en esta afinación.'));
      return;
    }
    shown.forEach((v, i) => {
      const b = el('button', 'voicing');
      b.type = 'button';
      b.dataset.i = i;
      b.setAttribute('aria-pressed', String(i === 0));
      const caption = [...v.frets].reverse().map((f) => (f < 0 ? 'x' : f)).join(' ');
      b.setAttribute('aria-label', `Digitación ${i + 1} de ${label}, cuerdas de grave a aguda: ${caption.replace(/x/g, 'muda')}. Pulsa para escucharla.`);
      b.appendChild(A.Diagram.voicing(v, chord, tuning));
      b.append(el('span', 'vcap', caption));
      const where = v.frets.includes(0) ? 'Posición abierta' : `Traste ${v.minFret}`;
      b.append(el('span', 'vsub', `${where}${v.barre ? ' · cejilla' : ''}`));
      box.appendChild(b);
    });
  }

  /** Rasguea la digitación de grave a aguda. */
  function play(v) {
    if (!v) return;
    const order = [];
    for (let s = v.frets.length - 1; s >= 0; s--) if (v.frets[s] >= 0) order.push(s);
    order.forEach((s, i) => A.Audio.pluck(tuning[s] + v.frets[s], i * 0.055, 1.8, 0.22));
  }

  A.Explorer = { init, render, open };
})(window);
