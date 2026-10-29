'use strict';
// Comprueba en código las afirmaciones de arquitectura que hace la documentación de desarrollo:
//  - la API documentada coincide, nombre por nombre, con lo que exportan los módulos;
//  - los módulos se cargan en un orden coherente con sus dependencias;
//  - las capas "puras" (teoría y síntesis) no tocan el DOM, el almacenamiento ni la red;
//  - ninguna fuente pide recursos externos;
//  - cada archivo del proyecto está descrito en el README;
//  - las referencias data-src de la documentación apuntan a símbolos que existen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const list = fs.readdirSync(root);
const pages = list.filter((f) => f.endsWith('.html'));
const sources = list.filter((f) => /\.(js|css|html|webmanifest)$/.test(f));

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  ' + name); }

// ---------- Carga de los módulos en un contexto aislado ----------
const noop = () => {};
const ctx = {
  document: {
    readyState: 'complete', documentElement: { setAttribute: noop },
    querySelector: () => null, querySelectorAll: () => [], addEventListener: noop
  },
  console
};
ctx.window = ctx;
vm.createContext(ctx);
['theory.js', 'synth.js', 'theme.js', 'util.js', 'state.js', 'audio.js', 'fretboard.js', 'explorer.js'].forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));

const MODULES = {
  FretTheory: ctx.FretTheory, FretSynth: ctx.FretSynth, FretTheme: ctx.FretTheme,
  'FretApp.Util': ctx.FretApp.Util, 'FretApp.State': ctx.FretApp.State, 'FretApp.Audio': ctx.FretApp.Audio,
  'FretApp.Fretboard': ctx.FretApp.Fretboard, 'FretApp.Explorer': ctx.FretApp.Explorer
};
const PROVIDERS = {
  FretTheory: 'theory.js', FretSynth: 'synth.js', FretTheme: 'theme.js',
  'FretApp.Util': 'util.js', 'FretApp.State': 'state.js', 'FretApp.Audio': 'audio.js',
  'FretApp.Fretboard': 'fretboard.js', 'FretApp.Explorer': 'explorer.js'
};

test('todos los módulos cargan y exponen un objeto', () => {
  Object.entries(MODULES).forEach(([name, m]) => assert.ok(m && typeof m === 'object', name));
});

test('la API documentada en desarrollo.html coincide con las exportaciones reales', () => {
  const m = /<script type="application\/json" id="api-docs">([\s\S]*?)<\/script>/.exec(read('desarrollo.html'));
  assert.ok(m, 'falta el bloque #api-docs');
  const docs = JSON.parse(m[1]);
  assert.deepEqual(Object.keys(docs).sort(), Object.keys(MODULES).sort(), 'módulos documentados');
  Object.entries(MODULES).forEach(([name, mod]) => {
    const real = Object.keys(mod).sort();
    const documented = Object.keys(docs[name]).sort();
    assert.deepEqual(documented, real, `${name}: la documentación y el código difieren`);
    Object.entries(docs[name]).forEach(([k, v]) => assert.ok(typeof v === 'string' && v.length > 12, `${name}.${k}: descripción vacía`));
  });
});

test('el orden de carga de index.html respeta las dependencias entre módulos', () => {
  const order = [...read('index.html').matchAll(/<script src="([^"]+)"/g)].map((x) => x[1]);
  assert.ok(order.length >= 9);
  const used = (file) => {
    const src = read(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const needs = new Set();
    if (/FretTheory/.test(src)) needs.add('theory.js');
    if (/FretSynth/.test(src)) needs.add('synth.js');
    for (const [, name] of src.matchAll(/(?:FretApp|\bA)\.(Util|State|Audio|Fretboard|Explorer)\b/g)) needs.add(PROVIDERS['FretApp.' + name]);
    if (/FretApp\.Util\b|\{\s*\$[^}]*\}\s*=\s*(?:global\.FretApp|A)\.Util/.test(src)) needs.add('util.js');
    needs.delete(file);
    return [...needs];
  };
  order.filter((f) => f.endsWith('.js')).forEach((f, i) => {
    used(f).forEach((dep) => {
      const at = order.indexOf(dep);
      assert.ok(at >= 0 && at < i, `${f} usa ${dep}, que no se carga antes (posición ${at} frente a ${i})`);
    });
  });
});

test('teoría y síntesis son puras: sin DOM, almacenamiento, red ni temporizadores', () => {
  const forbidden = /\b(document|localStorage|sessionStorage|navigator|fetch|XMLHttpRequest|AudioContext|setTimeout|setInterval|location|history)\b/;
  ['theory.js', 'synth.js'].forEach((f) => {
    const src = read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const hit = forbidden.exec(src);
    assert.ok(!hit, `${f} usa «${hit && hit[0]}»`);
  });
});

test('ninguna fuente carga recursos de otros orígenes', () => {
  const allowed = new Set(['http://www.w3.org/2000/svg', 'http://x', 'https://github.com/Cradber/fretmaster']);
  sources.forEach((f) => {
    for (const [url] of read(f).matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
      assert.ok(allowed.has(url.replace(/[.,;]+$/, '')) || /^http:\/\/127\.0\.0\.1/.test(url) || /^http:\/\/localhost/.test(url), `${f}: URL externa ${url}`);
    }
  });
});

test('las páginas HTML no enlazan scripts ni estilos remotos', () => {
  pages.forEach((p) => {
    for (const [, u] of read(p).matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
      assert.ok(!/^(https?:)?\/\//.test(u), `${p}: recurso remoto ${u}`);
    }
  });
});

test('cada archivo de código y documentación está descrito en el README', () => {
  const readme = read('README.md');
  list.filter((f) => /\.(js|css|html|webmanifest)$/.test(f) && f !== 'sw.js').forEach((f) => {
    assert.ok(readme.includes('`' + f + '`') || readme.includes(f), `README no menciona ${f}`);
  });
  ['sw.js', 'manifest.webmanifest'].forEach((f) => assert.ok(readme.includes(f), `README no menciona ${f}`));
});

test('la tabla de archivos de desarrollo.html no omite ningún archivo del proyecto', () => {
  const dev = read('desarrollo.html');
  list.filter((f) => /\.(js|css|html|webmanifest)$/.test(f)).forEach((f) => {
    assert.ok(dev.includes('<td class="mono">' + f + '</td>'), `desarrollo.html no describe ${f}`);
  });
  assert.ok(dev.includes('<td class="mono">tests/</td>'));
});

test('los scripts de package.json apuntan a pruebas que existen', () => {
  const pkg = JSON.parse(read('package.json'));
  Object.values(pkg.scripts).forEach((cmd) => {
    for (const [, f] of cmd.matchAll(/node (tests\/[\w./-]+)/g)) assert.ok(fs.existsSync(path.join(root, f)), `falta ${f}`);
  });
  ['test', 'test:e2e', 'test:all'].forEach((k) => assert.ok(pkg.scripts[k], 'falta el script ' + k));
});

test('las referencias data-src de la documentación apuntan a símbolos que existen', () => {
  let n = 0;
  pages.forEach((p) => {
    for (const [, spec] of read(p).matchAll(/data-src="([^"]+)"/g)) {
      const [file, symbol] = spec.split(':');
      assert.ok(fs.existsSync(path.join(root, file)), `${p}: no existe ${file}`);
      assert.ok(read(file).includes(symbol), `${p}: «${symbol}» no aparece en ${file}`);
      n++;
    }
  });
  assert.ok(n >= 20, 'se esperaban al menos 20 referencias al código, hay ' + n);
});

console.log(`\n${passed} pruebas de arquitectura pasaron`);
