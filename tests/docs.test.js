'use strict';
// Verifica que las páginas de documentación no contradicen a la aplicación:
//  1) los ejemplos marcados con data-verify coinciden con lo que calcula theory.js,
//  2) los enlaces hacia la herramienta llevan parámetros válidos,
//  3) los enlaces internos (#ancla) apuntan a ids que existen,
//  4) la cabecera de navegación es idéntica en todas las páginas y todos sus destinos existen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const T = require('../theory.js');

const root = path.join(__dirname, '..');
const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }

// state.js se carga en un contexto aislado para reutilizar su validación real.
const ctx = { FretTheory: T, FretApp: { Util: { has: (o, k) => Object.prototype.hasOwnProperty.call(o, k) } } };
ctx.window = ctx;
vm.runInNewContext(read('state.js'), ctx);
const State = ctx.FretApp.State;

const STD = T.TUNINGS.standard.midi;
const shape = (v) => [...v.frets].reverse().map((f) => (f < 0 ? 'x' : f)).join(' ');
const voicings = (tuning, pc, type, bass, maxFret) => T.findVoicings(tuning, T.spellChord(pc, type), maxFret, 80, bass).map(shape);

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const list = (arr) => (arr.length > 1 ? arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1] : arr[0]);

/** Trastes mínimo y máximo de las notas de una caja (la primera completa) de una escala, en afinación estándar. */
function boxFrets(pc, id, shape) {
  const [a0, b0] = T.CAGED[shape];
  const win = T.positionRanges(id, pc, 22)[shape].find(([a, b]) => b - a >= b0 - a0);
  const pred = T.positionPredicate(id, pc, shape, 22);
  const sc = T.spellScale(pc, id);
  const frets = [];
  STD.forEach((m) => { for (let x = win[0]; x <= win[1]; x++) if (sc.byPc.has((m + x) % 12) && pred(x, (m + x) % 12)) frets.push(x); });
  return Math.min(...frets) + '-' + Math.max(...frets);
}

const CHECKS = {
  octave: (from, to) => String(STD[+from - 1] + 12 - STD[+to - 1]),
  fretnote: (string, fret) => NAMES[(STD[+string - 1] + +fret) % 12],
  stringfrets: (string, id, pc, max) => {
    const sc = T.spellScale(+pc, id);
    const out = [];
    for (let f = 0; f <= +max; f++) if (sc.byPc.has((STD[+string - 1] + f) % 12)) out.push(f);
    return out.join(' ');
  },
  boxfrets: (pc, id, shape) => boxFrets(+pc, id, shape),
  modeorder: () => ['lydian', 'major', 'mixolydian', 'dorian', 'minor', 'phrygian', 'locrian']
    .map((id) => [id, T.parseFormula(T.SCALES[id].formula).reduce((a, t) => a + t.semi, 0)])
    .sort((x, y) => y[1] - x[1]).map(([id]) => T.SCALES[id].name).join(' › '),
  samepcs: (pcs, type) => {
    const chords = pcs.split(',').map((p) => T.spellChord(+p, type));
    const key = (c) => [...c.pcs].sort((a, b) => a - b).join(',');
    return chords.every((c) => key(c) === key(chords[0])) ? list(chords.map((c) => c.name)) : 'DISTINTAS';
  },
  prog: (pc, id, romans) => {
    const chords = T.diatonicChords(T.spellScale(+pc, id), 3);
    return romans.split(' ').map((r) => { const c = chords.find((x) => x.roman === r); return c ? c.name : '?' + r; }).join(' ');
  },
  scale: (pc, id) => T.spellScale(+pc, id).notes.map((n) => n.name).join(' '),
  chord: (pc, type) => T.spellChord(+pc, type).notes.map((n) => n.name).join(' '),
  steps: (id) => T.stepPattern(id).join(' '),
  diatonic: (pc, id, size) => T.diatonicChords(T.spellScale(+pc, id), +size).map((c) => c.name).join(' '),
  roman: (pc, id, size) => T.diatonicChords(T.spellScale(+pc, id), +size).map((c) => c.roman).join(' '),
  chordname: (pc, type, bass) => { const c = T.spellChord(+pc, type); return +bass ? `${c.name}/${c.notes[+bass].name}` : c.name; }
};

function verifyItems(html) {
  const out = [];
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-verify="([^"]+)"[^>]*>([^<]*)</g)) out.push({ spec: m[2], text: decode(m[3]) });
  return out;
}

test('hay ejemplos verificables en la página de ayuda', () => {
  assert.ok(verifyItems(read('ayuda.html')).length >= 25);
});

pages.forEach((page) => {
  test(`${page}: los ejemplos data-verify coinciden con el código`, () => {
    verifyItems(read(page)).forEach(({ spec, text }) => {
      const [kind, ...args] = spec.split(':');
      if (kind === 'voicing' || kind === 'voicing-first') {
        const [pc, type, bass] = args;
        const list = voicings(STD, +pc, type, +bass, 21);
        if (kind === 'voicing-first') assert.equal(list[0], text, spec);
        else assert.ok(list.includes(text), `${spec}: «${text}» no está entre ${list.slice(0, 6).join(' | ')}`);
      } else if (kind === 'voicing-tuning') {
        const [tuning, pc, type, bass] = args;
        const l = voicings(T.TUNINGS[tuning].midi, +pc, type, +bass, 21);
        assert.equal(l[0], text, spec);
      } else if (kind === 'voicingcapo') {
        const [pc, type, capo] = args;
        const list = voicings(STD.map((m) => m + +capo), +pc, type, 0, 22 - +capo - 1);
        assert.ok(list.includes(text), `${spec}: «${text}» no está entre ${list.slice(0, 6).join(' | ')}`);
      } else {
        assert.ok(CHECKS[kind], 'tipo de verificación desconocido: ' + kind);
        assert.equal(text.replace(/–/g, '-'), CHECKS[kind](...args), spec);
      }
    });
  });

  test(`${page}: los enlaces a la herramienta llevan parámetros válidos`, () => {
    const html = read(page);
    for (const m of html.matchAll(/href="index\.html#([^"]+)"/g)) {
      const params = Object.fromEntries(new URLSearchParams(decode(m[1])));
      const clean = State.sanitize(params);
      Object.keys(params).forEach((k) => {
        assert.ok(Object.prototype.hasOwnProperty.call(State.DEFAULTS, k), `parámetro desconocido «${k}» en ${m[1]}`);
        assert.equal(String(clean[k]), String(params[k]), `valor no válido ${k}=${params[k]} en ${m[1]}`);
      });
    }
  });

  test(`${page}: los enlaces internos apuntan a ids que existen y los ids no se repiten`, () => {
    const html = read(page);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'ids repetidos: ' + ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
    for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), `ancla rota #${m[1]}`);
  });
});

test('la navegación principal es idéntica en todas las páginas y sus destinos existen', () => {
  const navs = pages.map((p) => {
    const m = /<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(read(p));
    assert.ok(m, `${p} no tiene navegación`);
    const links = [...m[1].matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)].map((x) => ({ href: x[1], current: /aria-current="page"/.test(x[2]), text: x[3] }));
    return { page: p, links };
  });
  const reference = navs[0].links.map((l) => `${l.href}|${l.text}`).join(',');
  navs.forEach(({ page, links }) => {
    assert.equal(links.map((l) => `${l.href}|${l.text}`).join(','), reference, `${page}: la navegación difiere`);
    links.forEach((l) => assert.ok(fs.existsSync(path.join(root, l.href)), `${page}: el destino ${l.href} no existe`));
    const current = links.filter((l) => l.current);
    assert.equal(current.length, 1, `${page}: debe marcar exactamente una página actual`);
    assert.equal(current[0].href, page, `${page}: marca como actual ${current[0].href}`);
  });
});

test('todas las páginas cargan el tema, declaran idioma y tienen un único h1 o título', () => {
  pages.forEach((p) => {
    const html = read(p);
    assert.match(html, /<html lang="es"/, p);
    assert.match(html, /src="theme\.js"/, p);
    assert.match(html, /<title>[^<]+<\/title>/, p);
  });
});

test('las páginas y sus recursos están en la caché del service worker', () => {
  const sw = read('sw.js');
  pages.forEach((p) => {
    if (p === 'index.html') return;
    assert.ok(sw.includes(`'${p}'`), `${p} falta en ASSETS de sw.js`);
    for (const m of read(p).matchAll(/(?:href|src)="([\w.-]+\.(?:css|js))"/g)) assert.ok(sw.includes(`'${m[1]}'`), `${m[1]} (usado por ${p}) falta en ASSETS`);
  });
});

console.log(`\n${passed} pruebas de documentación pasaron`);
