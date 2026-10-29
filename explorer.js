/* FretMaster · explorador de acordes: catálogo, inversiones, digitaciones calculadas y diagramas SVG. */
(function (global) {
  'use strict';

  const T = global.FretTheory;
  const A = global.FretApp;
  const { $, $$, el, svgEl } = A.Util;

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

    const inversion = bassIdx === 0 ? '' : bassIdx <= 3 ? ` · ${bassIdx}ª inversión` : ` · bajo en la ${chord.notes[bassIdx].display}`;
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
      b.appendChild(drawVoicing(v));
      b.append(el('span', 'vcap', caption));
      const where = v.frets.includes(0) ? 'Posición abierta' : `Traste ${v.minFret}`;
      b.append(el('span', 'vsub', `${where}${v.barre ? ' · cejilla' : ''}`));
      box.appendChild(b);
    });
  }

  /** Diagrama SVG de una digitación: cuerdas verticales (grave a la izquierda), cejilla, × mudas y ○ al aire. */
  function drawVoicing(v) {
    const n = v.frets.length;
    const W = 110, H = 134, x0 = 24, x1 = 98, top = 30, rows = 5, rh = 16;
    const gap = (x1 - x0) / (n - 1);
    const base = v.maxFret > 4 ? v.minFret : 1;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
    const xOf = (s) => x0 + gap * (n - 1 - s);
    const yOf = (f) => top + rh * (f - base + 0.5);

    const g = svgEl('g', { class: 'vlines' }, svg);
    for (let r = 0; r <= rows; r++) svgEl('line', { x1: x0, x2: x1, y1: top + r * rh, y2: top + r * rh }, g);
    for (let i = 0; i < n; i++) svgEl('line', { x1: x0 + gap * i, x2: x0 + gap * i, y1: top, y2: top + rows * rh }, g);
    if (base === 1) {
      svgEl('rect', { class: 'vnut', x: x0 - 1, y: top - 3, width: x1 - x0 + 2, height: 4, rx: 1 }, svg);
    } else {
      svgEl('text', { class: 'vfr', x: 2, y: top + rh * 0.5 + 3 }, svg).textContent = `${base}fr`;
    }

    if (v.barre) {
      const xa = xOf(v.barre.to), xb = xOf(v.barre.from);
      svgEl('rect', { class: 'vbarre', x: xa - 6.5, y: yOf(v.barre.fret) - 6.5, width: xb - xa + 13, height: 13, rx: 6.5 }, svg);
    }

    v.frets.forEach((f, s) => {
      const x = xOf(s);
      if (f < 0) {
        svgEl('text', { class: 'vmark', x, y: 22 }, svg).textContent = '×';
      } else if (f === 0) {
        svgEl('circle', { class: 'vopen', cx: x, cy: 19, r: 3.6 }, svg);
      } else {
        const note = chord.byPc.get((tuning[s] + f) % 12);
        const dot = svgEl('g', { class: 'vdot' }, svg);
        svgEl('circle', { cx: x, cy: yOf(f), r: 6.5, fill: `var(--c-${note.role})` }, dot);
        svgEl('text', { x, y: yOf(f) + 2.4 }, dot).textContent = note.name;
      }
    });
    return svg;
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
