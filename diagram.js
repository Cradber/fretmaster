/* FretMaster · diagramas SVG compartidos por el explorador y las páginas de documentación:
   la digitación de un acorde y un tramo del mástil con las notas de una escala. No guardan estado:
   todo lo que dibujan llega por parámetros, y los colores son variables CSS (cambian de tema sin redibujar). */
(function (global) {
  'use strict';

  const T = global.FretTheory;
  const { svgEl } = global.FretApp.Util;

  /**
   * Diagrama de una digitación: cuerdas verticales (grave a la izquierda), cejilla, × mudas y ○ al aire.
   * v: { frets, barre, minFret, maxFret } como lo devuelve findVoicings; chord: acorde deletreado (spellChord);
   * tuning: MIDI de las cuerdas tal como suenan (con la cejilla ya sumada).
   */
  function voicing(v, chord, tuning) {
    const n = v.frets.length;
    const W = 110, H = 134, x0 = 24, x1 = 98, top = 30, rows = 5, rh = 16;
    const gap = (x1 - x0) / (n - 1);
    const base = v.maxFret > 4 ? v.minFret : 1;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chord-diagram', 'aria-hidden': 'true', focusable: 'false' });
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

  /**
   * Tramo del mástil con las notas de una escala deletreada S (spellScale), como en la herramienta:
   * la cuerda 1 arriba y los trastes de izquierda a derecha.
   * opts: from, to (trastes, inclusive) · shape (forma CAGED; sin ella, toda la escala) · mode ('notes' | 'intervals')
   *       strings (números de cuerda que llevan notas; por defecto, todas) · roles (solo esos roles, p. ej. ['root'])
   *       tuning (MIDI; por defecto, la estándar).
   * Devuelve { svg, label }: label describe las notas cuerda a cuerda, para quien no ve el dibujo.
   */
  function board(S, opts) {
    const o = opts || {};
    const tuning = o.tuning || T.TUNINGS.standard.midi;
    const n = tuning.length;
    const from = Math.max(0, o.from || 0);
    const to = Math.max(from, o.to === undefined ? 12 : o.to);
    const inShape = T.positionPredicate(S.scaleId, S.rootPc, o.shape || 'all', Math.max(to, 22), tuning);
    const only = o.strings ? new Set(o.strings) : null;
    const roles = o.roles ? new Set(o.roles) : null;

    const cw = 36, sh = 25, r = 10.5, padX = 14, top = 15;
    const hasOpen = from === 0;
    const first = hasOpen ? 1 : from;                     // primer traste con celda propia
    const openW = hasOpen ? 30 : 0;                       // hueco de las cuerdas al aire, a la izquierda de la cejuela
    const x0 = padX + openW;                              // borde izquierdo del primer traste
    const cols = to - first + 1;
    const W = x0 + cols * cw + padX;
    const H = top + (n - 1) * sh + 30;
    const yOf = (s) => top + s * sh;
    const xOf = (f) => (f === 0 ? padX + openW / 2 - 2 : x0 + (f - first + 0.5) * cw);

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'mini-board', role: 'img', focusable: 'false' });
    const grid = svgEl('g', { class: 'mb-grid' }, svg);
    T.INLAY_FRETS.filter((f) => f >= first && f <= to).forEach((f) => {
      const ys = f % 12 === 0 ? [yOf(1) + sh / 2, yOf(n - 2) - sh / 2] : [(yOf(0) + yOf(n - 1)) / 2];
      ys.forEach((y) => svgEl('circle', { class: 'mb-inlay', cx: xOf(f), cy: y, r: 4 }, grid));
    });
    for (let i = 0; i <= cols; i++) {
      const x = x0 + i * cw;
      svgEl('line', { class: i === 0 && hasOpen ? 'mb-nut' : 'mb-fret', x1: x, x2: x, y1: yOf(0), y2: yOf(n - 1) }, grid);
    }
    for (let s = 0; s < n; s++) {
      svgEl('line', { class: 'mb-string', x1: hasOpen ? padX : x0, x2: x0 + cols * cw, y1: yOf(s), y2: yOf(s), 'stroke-width': 1 + s * 0.22 }, grid);
    }
    const nums = svgEl('g', { class: 'mb-nums' }, svg);
    for (let f = hasOpen ? 0 : first; f <= to; f++) {
      const t = svgEl('text', { x: xOf(f), y: H - 6 }, nums);
      if (T.INLAY_FRETS.includes(f)) t.setAttribute('class', 'mark');
      t.textContent = String(f);
    }

    const spoken = [];
    for (let s = n - 1; s >= 0; s--) {
      if (only && !only.has(s + 1)) continue;
      const here = [];
      for (let f = from; f <= to; f++) {
        const note = S.byPc.get((tuning[s] + f) % 12);
        if (!note || !inShape(f, note.pc) || (roles && !roles.has(note.role))) continue;
        const text = o.mode === 'intervals' ? note.display : note.name;
        const dot = svgEl('g', { class: `mb-dot mb-${note.role}` }, svg);
        if (note.role === 'root') svgEl('circle', { class: 'mb-ring', cx: xOf(f), cy: yOf(s), r: r + 2.4 }, dot);
        svgEl('circle', { cx: xOf(f), cy: yOf(s), r, fill: `var(--c-${note.role})` }, dot);
        const label = svgEl('text', { x: xOf(f), y: yOf(s) + 3.4 }, dot);
        if (text.length > 2) label.setAttribute('class', 'long');
        label.textContent = text;
        here.push(`${text} en el traste ${f}`);
      }
      if (here.length) spoken.push(`cuerda ${s + 1}: ${here.join(', ')}`);
    }
    const label = spoken.join('; ');
    svg.setAttribute('aria-label', label);
    return { svg, label };
  }

  global.FretApp.Diagram = { voicing, board };
})(window);
