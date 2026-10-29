// Pruebas en navegador de las páginas de documentación.
//   node tests/e2e/docs.test.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromePath, startServer, launchBrowser } from './harness.mjs';

if (!chromePath()) {
  console.log('Chrome no encontrado: se omiten las pruebas e2e (define CHROME_PATH para ejecutarlas).');
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = createRequire(import.meta.url)(path.join(root, 'theory.js'));
const server = await startServer(root);
const browser = await launchBrowser();
const results = [];
const PAGES = ['ayuda.html', 'aprender.html', 'desarrollo.html'];

async function test(name, fn, opts = {}) {
  const page = await browser.newPage(opts.width || 1280, opts.height || 800, opts.scheme);
  try {
    await page.goto(`${server.url}/manifest.webmanifest`);
    await page.eval('localStorage.clear()');
    page.errors.length = 0;
    await fn(page);
    assert.deepEqual(page.errors, [], 'errores de consola');
    results.push([true, name]);
    console.log('ok  ' + name);
  } catch (e) {
    results.push([false, name]);
    console.log('FALLA ' + name + '\n   ' + String(e.message).split('\n').join('\n   '));
  } finally { await page.close(); }
}
const url = (p, hash = '') => `${server.url}/${p}${hash}`;

for (const page of PAGES) {
  await test(`${page}: carga sin errores y sin peticiones a otros orígenes`, async (p) => {
    await p.goto(url(page));
    const external = await p.eval(`performance.getEntriesByType('resource').map(r => r.name).filter(n => new URL(n).origin !== location.origin)`);
    assert.deepEqual(external, [], 'peticiones externas');
    assert.equal(await p.eval('document.querySelectorAll("h1").length'), 1);
  });

  await test(`${page}: sin desbordamiento horizontal en móvil (375 px)`, async (p) => {
    await p.goto(url(page));
    const overflow = await p.eval('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    assert.ok(overflow <= 1, 'desbordamiento de ' + overflow + ' px');
  }, { width: 375, height: 812 });

  await test(`${page}: el tema Automático/Claro/Oscuro funciona también aquí`, async (p) => {
    await p.goto(url(page));
    assert.equal(await p.eval('document.documentElement.dataset.theme'), 'light');
    await p.click('[data-theme-set="dark"]');
    assert.equal(await p.eval('document.documentElement.dataset.theme'), 'dark');
  }, { scheme: 'light' });
}

await test('ayuda: las tablas generadas contienen todas las escalas, acordes, afinaciones y parámetros', async (p) => {
  await p.goto(url('ayuda.html'));
  const rows = (gen) => p.eval(`document.querySelectorAll('[data-gen="${gen}"] tbody tr').length`);
  assert.equal(await rows('scales'), Object.keys(T.SCALES).length);
  assert.equal(await rows('chords'), Object.keys(T.CHORD_TYPES).length);
  assert.equal(await rows('tunings'), Object.keys(T.TUNINGS).length);
  assert.equal(await rows('caged'), 5);
  assert.equal(await rows('modes'), 7);
  assert.equal(await rows('intervals'), 12);
  assert.equal(await rows('state'), await p.eval('Object.keys(FretApp.State.DEFAULTS).length'));
  assert.deepEqual(await p.eval(`[...document.querySelectorAll('[data-gen="state"] tbody tr')].filter(r => r.cells[2].textContent === '—').map(r => r.cells[0].textContent)`), [], 'parámetros sin documentar');
  const counts = await p.eval(`[...document.querySelectorAll('[data-count]')].map(e => e.dataset.count + '=' + e.textContent)`);
  assert.ok(counts.includes('scales=' + Object.keys(T.SCALES).length));
  assert.ok(counts.includes('chords=' + Object.keys(T.CHORD_TYPES).length));
  assert.ok(!counts.some((c) => c.endsWith('=')), 'contador vacío');
});

await test('ayuda: la tabla de escalas muestra las notas correctas de Do', async (p) => {
  await p.goto(url('ayuda.html'));
  const row = await p.eval(`[...document.querySelectorAll('[data-gen="scales"] tbody tr')].find(r => r.cells[0].textContent.startsWith('Menor armónica')).cells[4].textContent`);
  assert.equal(row, 'C D E♭ F G A♭ B');
});

await test('ayuda: el índice marca la sección visible y los enlaces llevan a ella', async (p) => {
  await p.goto(url('ayuda.html'));
  await p.eval('document.querySelector("#caged").scrollIntoView()');
  await p.waitFor('document.querySelector(".toc a[aria-current=true]")');
  assert.equal(await p.eval('document.querySelector(".toc a[aria-current=true]").getAttribute("href")'), '#caged');
  assert.equal(await p.eval('getComputedStyle(document.querySelector(".toc > summary")).display'), 'none');   // índice fijo en escritorio
});

await test('ayuda: en móvil el índice empieza plegado', async (p) => {
  await p.goto(url('ayuda.html'));
  assert.equal(await p.eval('document.querySelector(".toc").open'), false);
}, { width: 390, height: 844 });

await test('ayuda: los enlaces "Verla" abren la herramienta con ese estado', async (p) => {
  await p.goto(url('ayuda.html'));
  const href = await p.eval('document.querySelector(\'a.try[href*="harmonic_minor&p=C"]\').getAttribute("href")');
  await p.goto(`${server.url}/${href}`);
  assert.match(await p.eval('document.title'), /^A Menor armónica/);
  assert.equal(await p.eval('document.querySelector("#caged-seg [aria-pressed=true]").dataset.pos'), 'C');
});

await test('herramienta: la navegación lleva a la ayuda', async (p) => {
  await p.goto(url('index.html'));
  assert.ok(await p.eval('!!document.querySelector(\'.site-nav a[href="ayuda.html"]\')'));
  assert.deepEqual(await p.eval(`performance.getEntriesByType('resource').map(r => r.name).filter(n => new URL(n).origin !== location.origin)`), []);
});

await test('aprender: el progreso se guarda, se cuenta por nivel y se puede reiniciar', async (p) => {
  await p.goto(url('aprender.html'));
  const total = await p.eval('document.querySelectorAll("input[data-progress]").length');
  assert.ok(total >= 30, 'comprobaciones: ' + total);
  assert.match(await p.eval('document.querySelector("[data-progress-total]").textContent'), new RegExp('^0 de ' + total + '$'));
  await p.click('input[data-progress="n0-cuerda6"]');
  await p.click('input[data-progress="n0-cuerda5"]');
  const n0 = await p.eval('document.querySelectorAll("input[data-progress^=n0-]").length');
  assert.equal(await p.eval('document.querySelector(".table-wrap [data-progress-level=n0]").textContent'), `2 de ${n0}`);
  await p.goto(url('aprender.html'));                         // se recupera al recargar
  assert.equal(await p.eval('document.querySelector("input[data-progress=n0-cuerda6]").checked'), true);
  assert.match(await p.eval('document.querySelector("[data-progress-total]").textContent'), new RegExp('^2 de ' + total + '$'));
  await p.click('#reset-progress');                           // primer clic: pide confirmación
  assert.equal(await p.eval('document.querySelector("input[data-progress=n0-cuerda6]").checked'), true);
  await p.click('#reset-progress');                           // segundo clic: borra
  assert.equal(await p.eval('document.querySelector("input[data-progress=n0-cuerda6]").checked'), false);
  assert.equal(await p.eval('localStorage.getItem("fm-progress")'), '[]');
});

await test('aprender: los identificadores de progreso son únicos y cada casilla tiene texto', async (p) => {
  await p.goto(url('aprender.html'));
  const ids = await p.eval('[...document.querySelectorAll("input[data-progress]")].map(i => i.dataset.progress)');
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(await p.eval('[...document.querySelectorAll("input[data-progress]")].filter(i => !i.closest("label").textContent.trim()).length'), 0);
  const levels = new Set(ids.map((i) => i.split('-')[0]));
  assert.deepEqual([...levels].sort(), ['n0', 'n1', 'n2', 'n3', 'n4']);
});

await test('aprender: las tablas generadas y los enlaces "Abrir" funcionan', async (p) => {
  await p.goto(url('aprender.html'));
  assert.equal(await p.eval('document.querySelectorAll("[data-gen=caged] tbody tr").length'), 5);
  const href = await p.eval('document.querySelector(\'a.try[href*="blues"]\').getAttribute("href")');
  await p.goto(`${server.url}/${href}`);
  assert.match(await p.eval('document.title'), /^A Blues/);
});

await test('aprender: la autoevaluación se despliega con teclado y muestra la respuesta', async (p) => {
  await p.goto(url('aprender.html'));
  assert.equal(await p.eval('document.querySelector("details.qa").open'), false);
  await p.eval('document.querySelector("details.qa > summary").click()');
  assert.equal(await p.eval('document.querySelector("details.qa").open'), true);
  assert.ok(await p.eval('document.querySelector("details.qa > div").textContent.length > 5'));
});

await test('desarrollo: la API generada tiene una fila por exportación y ninguna sin descripción', async (p) => {
  await p.goto(url('desarrollo.html'));
  const result = await p.eval(`[...document.querySelectorAll('[data-gen=api]')].map(slot => {
    const name = slot.dataset.api;
    const obj = name.split('.').reduce((o, k) => o[k], window);
    return { name, rows: slot.querySelectorAll('tbody tr').length, real: Object.keys(obj).length,
             sinDescripcion: [...slot.querySelectorAll('tbody tr')].filter(r => r.cells[2].textContent === '—').length };
  })`);
  assert.equal(result.length, 8);
  result.forEach((r) => {
    assert.equal(r.rows, r.real, `${r.name}: filas ${r.rows} frente a exportaciones ${r.real}`);
    assert.equal(r.sinDescripcion, 0, `${r.name}: funciones sin descripción`);
  });
  assert.ok(result.find((r) => r.name === 'FretTheory').rows >= 25);
});

await test('desarrollo: el diagrama de arquitectura es accesible y la tabla de estado está completa', async (p) => {
  await p.goto(url('desarrollo.html'));
  assert.equal(await p.eval('document.querySelector(".diagram svg").getAttribute("role")'), 'img');
  assert.ok(await p.eval('document.querySelector(".diagram svg title").textContent.length > 10'));
  assert.ok(await p.eval('document.querySelector(".diagram svg desc").textContent.length > 50'));
  assert.equal(await p.eval('document.querySelectorAll("[data-gen=state] tbody tr").length'), await p.eval('Object.keys(FretApp.State.DEFAULTS).length'));
});

await test('desarrollo: el diagrama se desplaza en móvil sin ensanchar la página', async (p) => {
  await p.goto(url('desarrollo.html'));
  const d = await p.eval('(() => { const e = document.querySelector(".diagram"); return { scroll: e.scrollWidth, client: e.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()');
  assert.ok(d.scroll > d.client, 'el diagrama debería poder desplazarse');
  assert.ok(d.page <= 1, 'la página se ensancha ' + d.page + ' px');
}, { width: 375, height: 812 });

await browser.close();
server.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} pruebas e2e de documentación pasaron`);
process.exit(failed ? 1 : 0);
