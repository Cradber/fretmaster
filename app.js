/* FretMaster · orquestación de la herramienta: controles, estado, escala, acordes diatónicos y pestañas.
   El dibujo del mástil y el explorador viven en fretboard.js y explorer.js. */
(function () {
  'use strict';

  const T = window.FretTheory;
  const A = window.FretApp;
  const { $, $$, el } = A.Util;

  // Cambios que no invalidan el acorde diatónico seleccionado.
  const KEEP_CHORD_KEYS = ['t', 'f', 'c', 'l', 'm', 'v', 'p', 'r', 'q', 'b', 'w'];

  let state = A.State.load();
  let S;                       // escala deletreada actual
  let chords = [];             // acordes diatónicos actuales
  let chordIdx = null;         // acorde diatónico seleccionado
  let playTimers = [];
  let activeGroup = null;      // familia de escalas visible en el selector
  let lastScale = null;

  function setState(patch) {
    const keepChord = Object.keys(patch).every((k) => KEEP_CHORD_KEYS.includes(k));
    state = A.State.sanitize({ ...state, ...patch });
    if (!keepChord) chordIdx = null;
    update();
  }

  const announce = (msg) => { $('#live').textContent = msg; };

  // ---------- Ciclo de actualización ----------

  function update() {
    stopPlayback();
    S = T.spellScale(state.k, state.s, state.a);
    const scale = T.SCALES[state.s];
    document.title = `${S.rootName} ${scale.name} · FretMaster`;
    if (lastScale !== state.s) { activeGroup = scale.group; lastScale = state.s; }

    syncControls();
    renderHeading();
    renderInfo();
    renderLegend();
    renderChords();
    A.Fretboard.render(state, S, chordPcs());
    A.Explorer.render(state);
    renderTabs();
    A.State.persist(state);
    announce(`${S.rootName} ${scale.name}: ${S.notes.map((n) => n.name).join(' ')}`);
  }

  const chordPcs = () => (chordIdx !== null && chords[chordIdx] ? new Set(chords[chordIdx].pcs) : null);

  // ---------- Construcción de controles ----------

  function buildControls() {
    const keys = $('#key-selector');
    for (let pc = 0; pc < 12; pc++) {
      const b = el('button', 'pill');
      b.type = 'button';
      b.dataset.pc = pc;
      keys.appendChild(b);
    }

    const groups = $('#scale-groups');
    const items = $('#scale-selector');
    T.GROUPS.forEach((g) => {
      const tab = el('button', '', g.title);
      tab.type = 'button';
      tab.dataset.group = g.id;
      groups.appendChild(tab);

      const box = el('div', 'scale-items');
      box.dataset.group = g.id;
      Object.entries(T.SCALES).filter(([, s]) => s.group === g.id).forEach(([id, s]) => {
        const b = el('button', 'chip', s.name);
        b.type = 'button';
        b.dataset.scale = id;
        box.appendChild(b);
      });
      items.appendChild(box);
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
    $('#scale-groups').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      activeGroup = b.dataset.group;
      syncScalePicker();
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
      state = A.State.sanitize({ ...state, p: b.dataset.pos });
      syncControls();
      renderCagedNote();
      A.Fretboard.highlight(state, S, chordPcs());
      A.State.persist(state);
    });
    $('#sel-tuning').addEventListener('change', (e) => setState({ t: e.target.value }));
    $('#sel-frets').addEventListener('change', (e) => setState({ f: Number(e.target.value) }));
    $('#sel-capo').addEventListener('change', (e) => setState({ c: Number(e.target.value) }));
    $('#chk-lefty').addEventListener('change', (e) => setState({ l: e.target.checked ? 1 : 0 }));
    $('#chk-sound').addEventListener('change', (e) => setState({ v: e.target.checked ? 1 : 0 }));
    $('#play-scale').addEventListener('click', playScale);
    $('#audio-test').addEventListener('click', () => {
      A.Audio.unlock();
      A.Audio.pluck(57, 0, 1.2, 0.35);
      $('#audio-status').textContent = 'Probando…';
      setTimeout(reportAudio, 600);
    });
    $('#share').addEventListener('click', share);

    $('#note-chips').addEventListener('click', (e) => {
      const b = e.target.closest('.note-chip');
      if (!b) return;
      const i = Number(b.dataset.i);
      A.Audio.pluck(T.scaleMidis(S)[i]);
      A.Fretboard.flash((mk) => Number(mk.dataset.pc) === S.notes[i].pc);
    });

    $('#chord-list').addEventListener('click', (e) => {
      const b = e.target.closest('.chord');
      if (!b) return;
      const i = Number(b.dataset.i);
      chordIdx = chordIdx === i ? null : i;
      syncChordButtons();
      A.Fretboard.highlight(state, S, chordPcs());
      if (chordIdx !== null) {
        const c = chords[chordIdx];
        T.chordMidis(c.pcs).forEach((m, n) => A.Audio.pluck(m, n * 0.07, 1.8, 0.22));
        announce(`Mostrando ${c.name}: ${c.notes.join(', ')}`);
      } else {
        announce('Mostrando toda la escala');
      }
    });
    $('#open-voicings').addEventListener('click', () => {
      const c = chords[chordIdx];
      const type = c && T.QUALITY_TO_TYPE[c.quality];
      if (!type) return;
      A.Explorer.open(c.pcs[0], type);
      $('#view-tabs').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });

    wireTabs();
    wireSettings();
  }

  // ---------- Pestañas ----------

  function wireTabs() {
    const tabs = $$('#view-tabs [role="tab"]');
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => setState({ w: t.dataset.view }));
      t.addEventListener('keydown', (e) => {
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        const target = tabs[(next + tabs.length) % tabs.length];
        setState({ w: target.dataset.view });
        target.focus();
      });
    });
  }

  function renderTabs() {
    $$('#view-tabs [role="tab"]').forEach((t) => {
      const on = t.dataset.view === state.w;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }

  // ---------- Ajustes (ventana flotante) ----------

  function wireSettings() {
    const btn = $('#settings-toggle');
    const panel = $('#settings-panel');
    const close = (returnFocus) => {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (returnFocus) btn.focus();
    };
    btn.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(true); });
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) close(false);
    });
  }

  // ---------- Sincronización de controles ----------

  function syncControls() {
    $$('#key-selector .pill').forEach((b) => {
      const pc = Number(b.dataset.pc);
      const label = T.keyLabel(pc, state.a);
      b.textContent = label;
      b.classList.toggle('pill--dual', label.includes('/'));
      b.setAttribute('aria-pressed', String(pc === state.k));
    });
    syncScalePicker();
    $$('#mode-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.m)));
    $$('#acc-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.acc === state.a)));
    $$('#size-seg button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.z)));
    $$('#caged-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pos === state.p)));
    $('#sel-tuning').value = state.t;
    $('#sel-frets').value = String(state.f);
    $('#sel-capo').value = String(state.c);
    $('#chk-lefty').checked = !!state.l;
    $('#chk-sound').checked = !!state.v;
    $('#open-voicings').hidden = chordIdx === null || !chords[chordIdx];
  }

  function syncScalePicker() {
    $$('#scale-groups button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.group === activeGroup)));
    $$('#scale-selector .scale-items').forEach((box) => { box.hidden = box.dataset.group !== activeGroup; });
    $$('#scale-selector .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scale === state.s)));
  }

  // ---------- Escala: título, descripción, notas, leyenda ----------

  function renderHeading() {
    const scale = T.SCALES[state.s];
    $('#scale-root-text').textContent = S.rootName;
    $('#scale-name-text').textContent = scale.name;
    const d = $('#scale-desc');
    d.textContent = '';
    d.append(scale.desc + ' ');
    d.appendChild(el('strong', '', 'Úsala en: '));
    d.append(scale.use);
    renderCagedNote();
  }

  function renderCagedNote() {
    const n = $('#caged-note');
    if (state.p === 'all') { n.hidden = true; return; }
    const scale = T.SCALES[state.s];
    const parentName = T.spellScale((state.k + scale.parent) % 12, 'major', state.a).rootName;
    const { extras, sourceOf } = T.alterationMap(state.s, state.k);
    n.hidden = false;
    if (scale.symmetric) {
      n.textContent = `Forma ${state.p}: ventana de trastes tomando ${S.rootName} como referencia (la escala es simétrica).`;
    } else if (state.s === 'major') {
      n.textContent = `Forma ${state.p}: caja CAGED de ${parentName} mayor.`;
    } else {
      // Con notas ajenas a la mayor (menor armónica, blues…) la mayor no las contiene todas: solo es la referencia de las cajas.
      const relation = extras.size ? 'la mayor de referencia de' : 'que contiene todas las notas de';
      n.textContent = `Forma ${state.p}: caja CAGED de ${parentName} mayor, ${relation} ${S.rootName} ${scale.name.toLowerCase()}.`;
    }
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

  // ---------- Acordes diatónicos ----------

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
    $('#open-voicings').hidden = chordIdx === null || !chords[chordIdx];
  }

  // ---------- Escuchar la escala ----------

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
    // El sonido se programa entero en el reloj de audio desde este mismo gesto (Safari e iOS no dejan arrancar el audio
    // desde un temporizador); los temporizadores solo sirven para iluminar las notas en el mástil.
    seq.forEach((m, i) => {
      A.Audio.pluck(m, (i * step) / 1000);
      playTimers.push(setTimeout(() => A.Fretboard.flash((mk) => Number(mk.dataset.pc) === m % 12), i * step));
    });
    playTimers.push(setTimeout(stopPlayback, seq.length * step + 300));
  }

  // ---------- Diagnóstico y avisos de audio ----------

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    announce(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 9000);
  }

  const AUDIO_HINT = 'No se oye nada si el audio del navegador está bloqueado. Toca de nuevo; en iPhone, desactiva el interruptor de silencio y sube el volumen.';

  function reportAudio() {
    const i = A.Audio.info();
    const where = `${i.state}${i.sampleRate ? ' · ' + i.sampleRate + ' Hz' : ''} · sesión: ${i.session}`;
    $('#audio-status').textContent = i.state === 'running'
      ? `Audio activo (${where}). Si no lo oyes, sube el volumen y, en iPhone, desactiva el interruptor de silencio.`
      : `El audio no está activo (${where}). Pulsa de nuevo; si sigue igual, recarga la página.`;
  }

  // ---------- Copiar enlace ----------

  async function share() {
    const btn = $('#share');
    const done = (msg) => {
      btn.classList.add('is-done');
      announce(msg);
      setTimeout(() => btn.classList.remove('is-done'), 1800);
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
      done('Enlace copiado');
    } catch (e) {
      announce('No se pudo copiar: copia la URL de la barra de direcciones');
    }
  }

  // ---------- Arranque ----------

  function init() {
    buildControls();
    A.Fretboard.init({
      onNote: ({ midi, el: marker }) => {
        if (!state.v) return;
        A.Audio.pluck(midi);
        marker.classList.add('is-playing');
        setTimeout(() => marker.classList.remove('is-playing'), 320);
      }
    });
    A.Explorer.init({ setState, announce });
    A.Audio.onProblem(() => toast(AUDIO_HINT));
    wireEvents();
    update();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin soporte offline */ });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
