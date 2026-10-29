/* FretMaster · comportamiento común de las páginas de documentación:
   1) genera las tablas a partir de theory.js y state.js (así la documentación no puede contradecir a la app),
   2) marca la sección activa en el índice, 3) pone enlaces de ancla a los títulos. */
(function (global) {
  'use strict';

  const T = global.FretTheory;
  const A = global.FretApp || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) e.setAttribute(k, v); });
    kids.flat().forEach((k) => e.append(k instanceof Node ? k : document.createTextNode(String(k))));
    return e;
  }

  function table(caption, heads, rows, monoCols) {
    const mono = new Set(monoCols || []);
    const t = h('table', null,
      caption ? h('caption', null, caption) : '',
      h('thead', null, h('tr', null, heads.map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => h('td', mono.has(i) ? { class: 'mono' } : null, c))))));
    return h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': caption || 'Tabla' }, t);
  }

  // ---------- Generadores ----------

  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const midiName = (m, flats) => (flats ? FLAT : SHARP)[m % 12] + (Math.floor(m / 12) - 1);

  const groupTitle = (id) => T.GROUPS.find((g) => g.id === id).title;
  const spell = (pc, id) => T.spellScale(pc, id).notes.map((n) => n.name).join(' ');
  const cMajorParent = (id) => `${T.spellScale((0 + T.SCALES[id].parent) % 12, 'major').rootName} mayor`;

  const GENERATORS = {
    scales() {
      const rows = Object.entries(T.SCALES).map(([id, s]) => [
        s.name, groupTitle(s.group), T.parseFormula(s.formula).map((t) => T.pretty(t.token)).join(' '),
        T.stepPattern(id).join(' '), spell(0, id), s.symmetric ? 'simétrica (sin madre)' : cMajorParent(id)
      ]);
      return table('Escalas disponibles, con la tónica en Do', ['Escala', 'Familia', 'Fórmula', 'Pasos', 'Notas', 'Mayor madre'], rows, [2, 3, 4]);
    },

    modes() {
      const order = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'];
      const rows = order.map((id, i) => {
        const pc = (12 - T.SCALES[id].parent) % 12;
        return [String(i + 1), T.SCALES[id].name, spell(pc, id), T.parseFormula(T.SCALES[id].formula).map((t) => T.pretty(t.token)).join(' ')];
      });
      return table('Los siete modos de la escala mayor de Do: las mismas notas, empezando en cada grado',
        ['Grado', 'Modo', 'Notas', 'Fórmula'], rows, [2, 3]);
    },

    chords() {
      const rows = Object.entries(T.CHORD_TYPES).map(([id, c]) => {
        const sp = T.spellChord(0, id);
        return [c.name, `C${c.symbol}`, T.CHORD_GROUPS.find((g) => g.id === c.group).title,
          T.parseFormula(c.formula).map((t) => T.pretty(t.token)).join(' '), sp.notes.map((n) => n.name).join(' ')];
      });
      return table('Tipos de acorde del explorador, con la fundamental en Do', ['Tipo', 'Símbolo', 'Familia', 'Fórmula', 'Notas'], rows, [1, 3, 4]);
    },

    tunings() {
      const rows = Object.entries(T.TUNINGS).map(([id, t]) => [
        t.name, String(t.midi.length), [...t.midi].reverse().map((m) => midiName(m, id === 'eb')).join(' ')
      ]);
      return table('Afinaciones, de la cuerda más grave a la más aguda (la cuerda 1 es la más aguda)', ['Afinación', 'Cuerdas', 'Notas'], rows, [2]);
    },

    caged() {
      const rows = T.CAGED_ORDER.map((id) => {
        const [a, b] = T.CAGED[id];
        return [`Forma ${id}`, `${a} – ${b}`, String(b - a + 1)];
      });
      return table('Ventanas de trastes de las cinco formas, medidas para la mayor de Do (se trasladan con la tónica)', ['Forma', 'Trastes', 'Anchura (trastes)'], rows, [1]);
    },

    intervals() {
      const names = [
        ['0', '1', 'Unísono / tónica'], ['1', '♭2', '2ª menor'], ['2', '2', '2ª mayor'], ['3', '♭3', '3ª menor'],
        ['4', '3', '3ª mayor'], ['5', '4', '4ª justa'], ['6', '♯4 o ♭5', '4ª aumentada o 5ª disminuida (tritono)'],
        ['7', '5', '5ª justa'], ['8', '♭6 o ♯5', '6ª menor o 5ª aumentada'], ['9', '6', '6ª mayor (en acordes disminuidos, 7ª disminuida)'],
        ['10', '♭7', '7ª menor'], ['11', '7', '7ª mayor']
      ];
      return table('Los doce intervalos desde una nota, con el símbolo que usa la app', ['Semitonos', 'Símbolo', 'Nombre'], names, [0, 1]);
    },

    state() {
      const D = (A.State && A.State.DEFAULTS) || {};
      const desc = {
        k: 'Tonalidad de la escala: 0 = Do … 11 = Si', s: 'Identificador de la escala (por ejemplo major, dorian, harmonic_minor)',
        p: 'Forma CAGED: all, C, A, G, E o D', m: 'Qué se escribe en las notas: notes o intervals',
        a: 'Alteraciones: auto, sharp (♯) o flat (♭)', t: 'Afinación (por ejemplo standard, dropd, dadgad)',
        f: 'Número de trastes: 22 o 24', c: 'Traste de la cejilla (0 = sin cejilla, hasta 9)', l: 'Modo zurdo: 1 = sí, 0 = no',
        z: 'Acordes diatónicos: 3 = tríadas, 4 = cuatriadas', v: 'Sonido al tocar una nota: 1 = sí, 0 = no',
        r: 'Fundamental del explorador de acordes (0–11)', q: 'Tipo de acorde del explorador (por ejemplo maj, m7, dim7)',
        b: 'Nota del bajo en el explorador (0 = fundamental, 1 = 3ª, 2 = 5ª…)', w: 'Pestaña abierta: escala o acordes'
      };
      const rows = Object.keys(D).map((k) => [k, String(D[k]), desc[k] || '—']);
      return table('Parámetros que guarda la dirección (tras el símbolo #)', ['Parámetro', 'Valor por defecto', 'Significado'], rows, [0, 1]);
    }
  };

  function generate() {
    $$('[data-gen]').forEach((slot) => {
      const g = GENERATORS[slot.dataset.gen];
      if (g) slot.replaceChildren(g());
    });
    const counts = {
      scales: Object.keys(T.SCALES).length, chords: Object.keys(T.CHORD_TYPES).length,
      tunings: Object.keys(T.TUNINGS).length, params: A.State ? Object.keys(A.State.DEFAULTS).length : '',
      shapes: T.CAGED_ORDER.length
    };
    $$('[data-count]').forEach((s) => { s.textContent = counts[s.dataset.count]; });
  }

  // ---------- Anclas en los títulos ----------

  function anchors() {
    $$('.prose h2[id], .prose h3[id]').forEach((hd) => {
      const a = h('a', { class: 'anchor', href: '#' + hd.id, 'aria-label': 'Enlace a esta sección' }, '#');
      hd.append(a);
    });
  }

  // ---------- Índice: sección activa ----------

  function toc() {
    const links = $$('.toc a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in global)) return;
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    const visible = new Set();
    const mark = () => {
      const first = sections.find((s) => visible.has(s.id));
      links.forEach((a) => a.removeAttribute('aria-current'));
      if (first) byId.get(first.id).setAttribute('aria-current', 'true');
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
      mark();
    }, { rootMargin: '-80px 0px -65% 0px' });
    sections.forEach((s) => io.observe(s));
    // En pantallas pequeñas el índice se pliega al elegir una sección.
    links.forEach((a) => a.addEventListener('click', () => { const d = a.closest('details'); if (d && matchMedia('(max-width: 1039px)').matches) d.open = false; }));
  }

  // El índice está desplegado en pantallas grandes y plegado en las pequeñas.
  function tocLayout() {
    const d = $('.toc');
    if (!d) return;
    const wide = matchMedia('(min-width: 1040px)');
    const sync = () => { d.open = wide.matches; };
    sync();
    if (wide.addEventListener) wide.addEventListener('change', sync);
  }

  function init() { generate(); anchors(); toc(); tocLayout(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
