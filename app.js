/* FretMaster · interfaz, audio, accesibilidad y estado */
(function () {
  'use strict';

  const T = window.FretTheory;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------- Estado (persistido en la URL y en localStorage) ----------

  const DEFAULTS = { k: 0, s: 'major', p: 'all', m: 'notes', a: 'auto', t: 'standard', f: 22, c: 0, l: 0, z: 3, v: 1, r: 0, q: 'maj', b: 0 };
  const STORE_KEY = 'fm-state';
  const KEEP_CHORD_KEYS = ['t', 'f', 'c', 'l', 'm', 'v', 'p', 'r', 'q', 'b'];

  function sanitize(raw) {
    const o = { ...DEFAULTS };
    const k = parseInt(raw.k, 10);
    if (k >= 0 && k < 12) o.k = k;
    if (has(T.SCALES, raw.s)) o.s = raw.s;
    if (raw.p === 'all' || T.CAGED_ORDER.includes(raw.p)) o.p = raw.p;
    if (raw.m === 'notes' || raw.m === 'intervals') o.m = raw.m;
    if (['auto', 'sharp', 'flat'].includes(raw.a)) o.a = raw.a;
    if (has(T.TUNINGS, raw.t)) o.t = raw.t;
    if (String(raw.f) === '22' || String(raw.f) === '24') o.f = Number(raw.f);
    const c = parseInt(raw.c, 10);
    if (c >= 0 && c <= 9) o.c = c;
    if (raw.l !== undefined) o.l = String(raw.l) === '1' ? 1 : 0;
    if (String(raw.z) === '4') o.z = 4;
    if (raw.v !== undefined) o.v = String(raw.v) === '0' ? 0 : 1;
    const r = parseInt(raw.r, 10);
    if (r >= 0 && r < 12) o.r = r;
    if (has(T.CHORD_TYPES, raw.q)) o.q = String(raw.q);
    const b = parseInt(raw.b, 10);
    if (b >= 0 && b < 6) o.b = b;
    return o;
  }

  function loadState() {
    let raw = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
    if (!Object.keys(raw).length) {
      try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { raw = {}; }
    }
    return sanitize(raw);
  }

  function persist() {
    const qs = new URLSearchParams(Object.entries(state).map(([k, v]) => [k, String(v)])).toString();
    try { history.replaceState(null, '', '#' + qs); } catch (e) { /* file:// restringido */ }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* almacenamiento bloqueado */ }
  }

  let state = loadState();
  let S;                 // escala deletreada actual
  let chords = [];       // acordes diatónicos actuales
  let chordIdx = null;   // acorde seleccionado
  let playTimers = [];
  let explorer = null;   // acorde del explorador (deletreado)
  let explorerLabel = '';  // nombre con bajo: C/E
  let bassIdx = 0;         // posición en explorer.notes de la nota más grave
  let voicings = [];     // digitaciones calculadas
  let voicingIdx = 0;
  let allVoicings = [];  // todas las digitaciones encontradas (antes de filtrar)
  let voicingFilter = 'all';
  let explorerTuning = [];  // afinación efectiva: la del instrumento + cejilla
  const MAX_VOICINGS = 8;
  const VOICING_FILTERS = {
    all: () => true,
    open: (v) => v.frets.includes(0),
    barre: (v) => !!v.barre,
    high: (v) => v.minFret >= 5
  };

  function setState(patch) {
    const keepChord = Object.keys(patch).every((k) => KEEP_CHORD_KEYS.includes(k));
    Object.assign(state, patch);
    if (state.c > 0 && state.c >= state.f - 2) state.c = 0;
    if (!keepChord) chordIdx = null;
    update();
  }

  // ---------- Audio (Web Audio, sin archivos) ----------

  let actx = null;
  let master = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.5;
      const comp = actx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  // Cada nota se sintetiza una vez (cuerda pulsada, ver synth.js) y se reutiliza.
  const noteBuffers = new Map();
  function noteBuffer(ac, midi) {
    const key = midi + ':' + ac.sampleRate;
    let buf = noteBuffers.get(key);
    if (!buf) {
      const data = window.FretSynth.pluckSamples(window.FretSynth.midiToFreq(midi), ac.sampleRate, 3);
      buf = ac.createBuffer(1, data.length, ac.sampleRate);
      buf.copyToChannel(data, 0);
      noteBuffers.set(key, buf);
    }
    return buf;
  }

  function pluck(midi, delay = 0, dur = 1.4, vol = 0.3) {
    const ac = audio();
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

  function flash(match, ms = 320) {
    $$('.note-marker').forEach((m) => {
      if (match(m) && !m.classList.contains('note-dimmed')) {
        m.classList.add('is-playing');
        setTimeout(() => m.classList.remove('is-playing'), ms);
      }
    });
  }

  function stopPlayback() {
    playTimers.forEach(clearTimeout);
    playTimers = [];
    const b = $('#play-scale');
    if (b) b.textContent = '▶ Escuchar escala';
  }

  function playScale() {
    if (playTimers.length) { stopPlayback(); return; }
    const asc = T.scaleMidis(S);
    const seq = asc.concat(asc.slice(0, -1).reverse());
    const step = 340;
    $('#play-scale').textContent = '■ Detener';
    seq.forEach((m, i) => {
      playTimers.push(setTimeout(() => {
        pluck(m);
        flash((mk) => Number(mk.dataset.pc) === m % 12);
      }, i * step));
    });
    playTimers.push(setTimeout(stopPlayback, seq.length * step + 300));
  }

  // ---------- Controles estáticos ----------

  function buildControls() {
    const keys = $('#key-selector');
    for (let pc = 0; pc < 12; pc++) {
      const b = el('button', 'pill');
      b.type = 'button';
      b.dataset.pc = pc;
      keys.appendChild(b);
    }

    const sc = $('#scale-selector');
    T.GROUPS.forEach((g) => {
      const row = el('div', 'scale-group');
      row.appendChild(el('span', 'glabel', g.title));
      const items = el('div', 'items');
      Object.entries(T.SCALES).filter(([, s]) => s.group === g.id).forEach(([id, s]) => {
        const b = el('button', 'chip', s.name);
        b.type = 'button';
        b.dataset.scale = id;
        items.appendChild(b);
      });
      row.appendChild(items);
      sc.appendChild(row);
    });

    const cr = $('#chord-root');
    for (let pc = 0; pc < 12; pc++) {
      const b = el('button', 'pill');
      b.type = 'button';
      b.dataset.pc = pc;
      cr.appendChild(b);
    }
    const ct = $('#chord-type');
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
      ct.appendChild(row);
    });

    const tun = $('#sel-tuning');
    Object.entries(T.TUNINGS).forEach(([id, t]) => {
      const o = el('option', '', t.name);
      o.value = id;
      tun.appendChild(o);
    });
    const capo = $('#sel-capo');
    for (let i = 0; i <= 9; i++) {
      const o = el('option', '', i === 0 ? 'Sin cejilla' : 'Traste ' + i);
      o.value = i;
      capo.appendChild(o);
    }
  }

  function wireEvents() {
    $('#key-selector').addEventListener('click', (e) => {
      const b = e.target.closest('.pill');
      if (b) setState({ k: Number(b.dataset.pc) });
    });
    $('#scale-selector').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (b) setState({ s: b.dataset.scale });
    });
    $('#mode-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) setState({ m: b.dataset.mode });
    });
    $('#acc-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) setState({ a: b.dataset.acc });
    });
    $('#size-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) setState({ z: Number(b.dataset.size) });
    });
    $('#caged-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.p = b.dataset.pos;
      syncControls();
      renderCagedNote();
      applyHighlight();
      persist();
    });
    $('#sel-tuning').addEventListener('change', (e) => setState({ t: e.target.value }));
    $('#sel-frets').addEventListener('change', (e) => setState({ f: Number(e.target.value) }));
    $('#sel-capo').addEventListener('change', (e) => setState({ c: Number(e.target.value) }));
    $('#chk-lefty').addEventListener('change', (e) => setState({ l: e.target.checked ? 1 : 0 }));
    $('#chk-sound').addEventListener('change', (e) => setState({ v: e.target.checked ? 1 : 0 }));
    $('#play-scale').addEventListener('click', playScale);
    $('#share').addEventListener('click', share);

    // Explorador de acordes
    const explorerChanged = () => announce(`${explorerLabel}: ${explorer.notes.map((n) => n.name).join(' ')}`);
    $('#chord-root').addEventListener('click', (e) => {
      const b = e.target.closest('.pill');
      if (!b) return;
      setState({ r: Number(b.dataset.pc), b: 0 });
      explorerChanged();
    });
    $('#chord-type').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      setState({ q: b.dataset.type, b: 0 });
      explorerChanged();
    });
    $('#bass-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      setState({ b: Number(b.dataset.b) });
      explorerChanged();
    });
    $('#play-chord').addEventListener('click', () => playVoicing(voicings[voicingIdx]));
    $('#voicing-filter').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      voicingFilter = b.dataset.vf;
      renderVoicings();
    });
    $('#voicings').addEventListener('click', (e) => {
      const b = e.target.closest('.voicing');
      if (!b) return;
      voicingIdx = Number(b.dataset.i);
      $$('#voicings .voicing').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.i) === voicingIdx)));
      playVoicing(voicings[voicingIdx]);
    });
    $('#open-voicings').addEventListener('click', () => {
      const c = chords[chordIdx];
      const type = c && T.QUALITY_TO_TYPE[c.quality];
      if (!type) return;
      setState({ r: c.pcs[0], q: type, b: 0 });
      $('#explorer').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      explorerChanged();
    });

    $('#theme-toggle').addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    // Notas del mástil: sonido al tocar y navegación con flechas
    const board = $('#fretboard');
    board.addEventListener('click', (e) => {
      const m = e.target.closest('.note-marker');
      if (!m) return;
      focusMarker(m, false);
      if (!state.v) return;
      pluck(T.TUNINGS[state.t].midi[Number(m.dataset.s)] + Number(m.dataset.f));
      m.classList.add('is-playing');
      setTimeout(() => m.classList.remove('is-playing'), 320);
    });
    board.addEventListener('keydown', onBoardKey);

    $('#note-chips').addEventListener('click', (e) => {
      const b = e.target.closest('.note-chip');
      if (!b) return;
      const i = Number(b.dataset.i);
      pluck(T.scaleMidis(S)[i]);
      flash((mk) => Number(mk.dataset.pc) === S.notes[i].pc);
    });

    $('#chord-list').addEventListener('click', (e) => {
      const b = e.target.closest('.chord');
      if (!b) return;
      const i = Number(b.dataset.i);
      chordIdx = chordIdx === i ? null : i;
      syncChordButtons();
      $('#open-voicings').hidden = chordIdx === null;
      applyHighlight();
      if (chordIdx !== null) {
        const c = chords[chordIdx];
        T.chordMidis(c.pcs).forEach((m, n) => pluck(m, n * 0.07, 1.8, 0.22));
        announce(`Mostrando ${c.name}: ${c.notes.join(', ')}`);
      } else {
        announce('Mostrando toda la escala');
      }
    });
  }

  // ---------- Tema, enlace, avisos ----------

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#09090b' : '#fafafa');
    try { localStorage.setItem('fm-theme', t); } catch (e) { /* ignorar */ }
    $('#theme-toggle').setAttribute('aria-label', t === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
  }

  function announce(msg) { $('#live').textContent = msg; }

  async function share() {
    const btn = $('#share');
    const done = (txt) => {
      btn.textContent = txt;
      announce(txt);
      setTimeout(() => { btn.textContent = 'Copiar enlace'; }, 1800);
    };
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(location.href);
      } else {
        const ta = el('textarea');
        ta.value = location.href;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (!ok) throw new Error('copy');
      }
      done('¡Enlace copiado!');
    } catch (e) {
      done('Copia la URL de la barra');
    }
  }

  // ---------- Render ----------

  function update() {
    stopPlayback();
    S = T.spellScale(state.k, state.s, state.a);
    const scale = T.SCALES[state.s];
    document.title = `${S.rootName} ${scale.name} · FretMaster`;
    syncControls();
    renderHeading();
    renderInfo();
    renderLegend();
    renderChords();
    renderBoard();
    renderExplorer();
    persist();
    announce(`${S.rootName} ${scale.name}: ${S.notes.map((n) => n.name).join(' ')}`);
  }

  function syncControls() {
    $$('#key-selector .pill').forEach((b) => {
      const pc = Number(b.dataset.pc);
      const label = T.keyLabel(pc, state.a);
      b.textContent = label;
      b.classList.toggle('dual', label.includes('/'));
      b.setAttribute('aria-pressed', String(pc === state.k));
    });
    $$('#scale-selector .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scale === state.s)));
    $$('#mode-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.m)));
    $$('#acc-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.acc === state.a)));
    $$('#size-seg button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.z)));
    $$('#caged-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pos === state.p)));
    $('#sel-tuning').value = state.t;
    $('#sel-frets').value = String(state.f);
    $('#sel-capo').value = String(state.c);
    $('#chk-lefty').checked = !!state.l;
    $('#chk-sound').checked = !!state.v;
    $$('#chord-root .pill').forEach((b) => {
      const pc = Number(b.dataset.pc);
      const label = T.keyLabel(pc, state.a);
      b.textContent = label;
      b.classList.toggle('dual', label.includes('/'));
      b.setAttribute('aria-pressed', String(pc === state.r));
    });
    $$('#chord-type .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === state.q)));
    $('#open-voicings').hidden = chordIdx === null || !chords[chordIdx];
  }

  function renderHeading() {
    const scale = T.SCALES[state.s];
    $('#scale-root-text').textContent = S.rootName;
    $('#scale-name-text').textContent = scale.name;
    const d = $('#scale-desc');
    d.textContent = '';
    d.append(scale.desc + ' ');
    const u = el('span');
    u.append(el('strong', '', 'Úsala en: '), scale.use);
    d.appendChild(u);
    renderCagedNote();
  }

  function renderCagedNote() {
    const n = $('#caged-note');
    if (state.p === 'all') { n.hidden = true; return; }
    const scale = T.SCALES[state.s];
    const parentPc = (state.k + scale.parent) % 12;
    const parentName = T.spellScale(parentPc, 'major', state.a).rootName;
    n.hidden = false;
    if (scale.symmetric) {
      n.textContent = `Forma ${state.p}: ventana de trastes tomando ${S.rootName} como referencia (la escala es simétrica).`;
    } else if (scale.parent === 0) {
      n.textContent = `Forma ${state.p}: caja CAGED de ${parentName} Mayor.`;
    } else {
      n.textContent = `Forma ${state.p}: caja CAGED de ${parentName} Mayor, la tonalidad que comparte las notas de ${S.rootName} ${scale.name}.`;
    }
    const { sourceOf } = T.alterationMap(state.s, state.k);
    const alt = S.notes.filter((x) => sourceOf.has(x.pc)).map((x) => x.name);
    if (alt.length) {
      n.textContent += ` Las notas ajenas a esa mayor (${alt.join(', ')}) van en la caja de la nota a la que sustituyen, un traste más arriba o abajo.`;
    }
  }

  function renderInfo() {
    const chips = $('#note-chips');
    chips.textContent = '';
    S.notes.forEach((n, i) => {
      const li = el('li');
      const b = el('button', 'note-chip');
      b.type = 'button';
      b.dataset.i = i;
      b.setAttribute('aria-label', `${n.name}, ${n.roleName}, intervalo ${n.display}. Pulsa para escucharla.`);
      const top = el('b');
      const dot = el('span', 'dot');
      dot.style.background = `var(--c-${n.role})`;
      top.append(dot, n.name);
      b.append(top, el('small', '', n.display));
      li.appendChild(b);
      chips.appendChild(li);
    });
    $('#pattern').textContent =
      `Fórmula: ${S.notes.map((n) => n.display).join(' ')}  ·  Pasos: ${T.stepPattern(state.s).join(' ')}`;
  }

  function renderLegend() {
    const ul = $('#legend');
    ul.textContent = '';
    T.legendFor(S).forEach((item) => {
      const li = el('li');
      const dot = el('span', 'dot');
      dot.style.background = `var(--c-${item.role})`;
      li.append(dot, el('span', '', item.label));
      ul.appendChild(li);
    });
  }

  function renderChords() {
    const list = $('#chord-list');
    list.textContent = '';
    chords = T.diatonicChords(S, state.z);
    const ok = chords.length > 0;
    $('#chord-msg').hidden = ok;
    $('#chord-help').hidden = !ok;
    $('#size-seg').hidden = !ok;
    chords.forEach((c, i) => {
      const b = el('button', 'chord');
      b.type = 'button';
      b.dataset.i = i;
      b.setAttribute('aria-label', `${c.roman}: ${c.name}, notas ${c.notes.join(', ')}`);
      b.append(el('span', 'roman', c.roman), el('span', 'cname', c.name), el('span', 'cnotes', c.notes.join(' ')));
      list.appendChild(b);
    });
    syncChordButtons();
  }

  function syncChordButtons() {
    $$('#chord-list .chord').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.i) === chordIdx)));
  }

  function renderBoard() {
    const tuning = T.TUNINGS[state.t].midi;
    const n = tuning.length;
    const inner = $('#board-inner');
    const board = $('#fretboard');
    const nums = $('#fret-numbers');
    inner.style.setProperty('--frets', state.f);
    inner.style.setProperty('--n', n);
    inner.classList.toggle('lefty', !!state.l);
    board.textContent = '';
    nums.textContent = '';

    for (let f = 0; f <= state.f; f++) {
      nums.appendChild(el('span', T.INLAY_FRETS.includes(f) ? 'mark' : '', String(f)));
    }

    // Marcas del mástil (en una capa propia: sirven para cualquier número de cuerdas)
    const inlays = el('div', 'layer');
    T.INLAY_FRETS.filter((f) => f <= state.f).forEach((f) => {
      const double = f % 12 === 0;
      const dots = double ? ['top', 'bottom'] : [''];
      dots.forEach((pos) => {
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
      for (let f = 0; f <= state.f; f++) {
        const cell = el('div', 'fret-cell');
        const note = f >= state.c ? S.byPc.get((tuning[s] + f) % 12) : null;
        if (note) cell.appendChild(makeMarker(note, s, f));
        row.appendChild(cell);
      }
      board.appendChild(row);
    }

    if (state.c > 0) {
      const overlay = el('div', 'layer overlay');
      const capo = el('div', 'capo');
      capo.style.gridColumn = state.c + 1;
      overlay.appendChild(capo);
      board.appendChild(overlay);
    }
    applyHighlight();
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

  function applyHighlight() {
    const inShape = T.positionPredicate(state.s, state.k, state.p, state.f);
    const chordPcs = chordIdx !== null && chords[chordIdx] ? new Set(chords[chordIdx].pcs) : null;
    $$('.note-marker').forEach((m) => {
      const fret = Number(m.dataset.f);
      const pc = Number(m.dataset.pc);
      const inPos = inShape(fret, pc);
      const inChord = !chordPcs || chordPcs.has(pc);
      const on = inPos && inChord;
      m.classList.toggle('note-active', on);
      m.classList.toggle('note-dimmed', !on);
      m.classList.toggle('chord-tone', !!chordPcs && on);
    });
    if (!$('.note-marker[tabindex="0"]')) {
      const first = $('.note-marker.note-active') || $('.note-marker');
      if (first) first.tabIndex = 0;
    }
  }

  // ---------- Explorador de acordes ----------

  const SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  function renderExplorer() {
    explorer = T.spellChord(state.r, state.q, state.a);
    const type = T.CHORD_TYPES[state.q];
    // Con cejilla, la forma se toca desde la cejilla: las cuerdas "al aire" pasan a sonar más agudas.
    explorerTuning = T.TUNINGS[state.t].midi.map((m) => m + state.c);
    bassIdx = Math.min(state.b, explorer.notes.length - 1);
    explorerLabel = bassIdx ? `${explorer.name}/${explorer.notes[bassIdx].name}` : explorer.name;
    allVoicings = T.findVoicings(explorerTuning, explorer, state.f - state.c - 1, 80, bassIdx);
    renderBass();
    const capoNote = $('#capo-note');
    capoNote.hidden = state.c === 0;
    capoNote.textContent = `Cejilla en el traste ${state.c}: los trastes del diagrama se cuentan desde la cejilla y las notas son las que suenan.`;

    const title = $('#explorer-name');
    title.textContent = '';
    const inversion = bassIdx === 0 ? '' : bassIdx <= 3 ? ` · ${bassIdx}ª inversión` : ` · bajo en la ${explorer.notes[bassIdx].display}`;
    title.append(el('strong', '', explorerLabel), ` · ${type.name}${inversion}`);

    const chips = $('#explorer-chips');
    chips.textContent = '';
    explorer.notes.forEach((n, i) => {
      const li = el('li');
      const b = el('button', 'note-chip');
      b.type = 'button';
      b.setAttribute('aria-label', `${n.name}, ${n.roleName}, intervalo ${n.display}. Pulsa para escucharla.`);
      const top = el('b');
      const dot = el('span', 'dot');
      dot.style.background = `var(--c-${n.role})`;
      top.append(dot, n.name);
      b.append(top, el('small', '', n.display));
      b.addEventListener('click', () => pluck(T.chordMidis(explorer.pcs)[i]));
      li.appendChild(b);
      chips.appendChild(li);
    });
    $('#explorer-formula').textContent = `Fórmula: ${explorer.notes.map((n) => n.display).join(' ')}`;

    const legend = $('#explorer-legend');
    legend.textContent = '';
    T.chordLegend(explorer).forEach((item) => {
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
    explorer.notes.forEach((n, i) => {
      const b = el('button', '', `${n.name} (${n.display})`);
      b.type = 'button';
      b.dataset.b = i;
      b.setAttribute('aria-pressed', String(i === bassIdx));
      seg.appendChild(b);
    });
  }

  function renderVoicings() {
    $$('#voicing-filter button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vf === voicingFilter)));
    voicings = allVoicings.filter(VOICING_FILTERS[voicingFilter]).slice(0, MAX_VOICINGS);
    voicingIdx = 0;
    const box = $('#voicings');
    box.textContent = '';
    $('#play-chord').disabled = !voicings.length;
    if (!voicings.length) {
      box.appendChild(el('p', 'empty-voicings', allVoicings.length
        ? 'Ninguna digitación de este tipo para este acorde. Prueba con otro filtro.'
        : 'No hay digitaciones cómodas de este acorde en esta afinación.'));
      return;
    }
    voicings.forEach((v, i) => {
      const b = el('button', 'voicing');
      b.type = 'button';
      b.dataset.i = i;
      b.setAttribute('aria-pressed', String(i === 0));
      const caption = [...v.frets].reverse().map((f) => (f < 0 ? 'x' : f)).join(' ');
      b.setAttribute('aria-label', `Digitación ${i + 1} de ${explorerLabel}, cuerdas de grave a aguda: ${caption.replace(/x/g, 'muda')}. Pulsa para escucharla.`);
      b.appendChild(drawVoicing(v));
      b.append(el('span', 'vcap', caption));
      const sub = v.frets.includes(0) ? 'Posición abierta' : `Traste ${v.minFret}`;
      b.append(el('span', 'vsub', `${sub}${v.barre ? ' · cejilla' : ''}`));
      box.appendChild(b);
    });
  }

  function drawVoicing(v) {
    const n = v.frets.length;
    const W = 110, H = 134, x0 = 24, x1 = 98, top = 30, rows = 5, rh = 16;
    const gap = (x1 - x0) / (n - 1);
    const base = v.maxFret > 4 ? v.minFret : 1;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' });
    const xOf = (s) => x0 + gap * (n - 1 - s);        // grave a la izquierda
    const yOf = (f) => top + rh * (f - base + 0.5);

    const g = svgEl('g', { class: 'vlines' }, svg);
    for (let r = 0; r <= rows; r++) svgEl('line', { x1: x0, x2: x1, y1: top + r * rh, y2: top + r * rh }, g);
    for (let i = 0; i < n; i++) svgEl('line', { x1: x0 + gap * i, x2: x0 + gap * i, y1: top, y2: top + rows * rh }, g);
    if (base === 1) svgEl('rect', { class: 'vnut', x: x0 - 1, y: top - 3, width: x1 - x0 + 2, height: 4, rx: 1 }, svg);
    else {
      const t = svgEl('text', { class: 'vfr', x: 2, y: top + rh * 0.5 + 3 }, svg);
      t.textContent = `${base}fr`;
    }

    if (v.barre) {
      const xa = xOf(v.barre.to), xb = xOf(v.barre.from);
      svgEl('rect', { class: 'vbarre', x: xa - 6.5, y: yOf(v.barre.fret) - 6.5, width: xb - xa + 13, height: 13, rx: 6.5 }, svg);
    }

    v.frets.forEach((f, s) => {
      const x = xOf(s);
      if (f < 0) {
        const m = svgEl('text', { class: 'vmark', x, y: 22 }, svg);
        m.textContent = '×';
      } else if (f === 0) {
        svgEl('circle', { class: 'vopen', cx: x, cy: 19, r: 3.6 }, svg);
      } else {
        const note = explorer.byPc.get((explorerTuning[s] + f) % 12);
        const dot = svgEl('g', { class: 'vdot' }, svg);
        svgEl('circle', { cx: x, cy: yOf(f), r: 6.5, fill: `var(--c-${note.role})` }, dot);
        const label = svgEl('text', { x, y: yOf(f) + 2.4 }, dot);
        label.textContent = note.name;
      }
    });
    return svg;
  }

  function playVoicing(v) {
    if (!v) return;
    const order = [];
    for (let s = v.frets.length - 1; s >= 0; s--) if (v.frets[s] >= 0) order.push(s);   // de grave a aguda
    order.forEach((s, i) => pluck(explorerTuning[s] + v.frets[s], i * 0.055, 1.8, 0.22));
  }

  // ---------- Teclado en el mástil ----------

  function focusMarker(m, focus = true) {
    const old = $('.note-marker[tabindex="0"]');
    if (old) old.tabIndex = -1;
    m.tabIndex = 0;
    if (focus) m.focus();
  }

  function onBoardKey(e) {
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

  // ---------- Arranque ----------

  function init() {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    buildControls();
    wireEvents();
    update();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin soporte offline */ });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
