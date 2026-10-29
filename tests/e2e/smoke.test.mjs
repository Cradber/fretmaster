// Pruebas de humo de la interfaz: se ejecutan en Chrome headless contra la app real.
//   node tests/e2e/smoke.test.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, startServer, launchBrowser } from './harness.mjs';

if (!chromePath()) {
  console.log('Chrome no encontrado: se omiten las pruebas e2e (define CHROME_PATH para ejecutarlas).');
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = await startServer(root);
const browser = await launchBrowser();
const results = [];

async function test(name, fn) {
  const page = await browser.newPage();
  try {
    // Cada prueba parte limpia: la app recuerda el estado en localStorage entre visitas.
    await page.goto(`${server.url}/manifest.webmanifest`);
    await page.eval('localStorage.clear()');
    page.errors.length = 0;      // el favicon de la página intermedia no cuenta
    await fn(page);
    assert.deepEqual(page.errors, [], 'errores de consola');
    results.push([true, name]);
    console.log('ok  ' + name);
  } catch (e) {
    results.push([false, name]);
    console.log('FALLA ' + name + '\n   ' + String(e.message).split('\n').join('\n   '));
  } finally {
    await page.close();
  }
}

const base = (hash = '') => `${server.url}/index.html${hash}`;
const text = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.textContent.trim())`;

await test('carga sin errores y pinta mástil, acordes y digitaciones', async (p) => {
  await p.goto(base());
  assert.match(await p.eval('document.title'), /FretMaster/);
  assert.equal(await p.eval('document.querySelectorAll(".note-marker").length'), 84);
  assert.equal(await p.eval('document.querySelectorAll("#chord-list .chord").length'), 7);
  assert.equal(await p.eval('document.querySelectorAll("#voicings .voicing").length'), 8);
});

await test('cambiar tonalidad y escala actualiza notas y leyenda', async (p) => {
  await p.goto(base());
  await p.click('#key-selector [data-pc="5"]');
  assert.deepEqual(await p.eval(`${text('#note-chips b')}.join(" ")`), 'F G A B♭ C D E');
  await p.click('#key-selector [data-pc="0"]');
  await p.click('#scale-selector [data-scale="lydian"]');
  const legend = await p.eval(`${text('#legend li')}.join("|")`);
  assert.match(legend, /4ª aumentada/);
  assert.ok(await p.eval('document.querySelectorAll(".role-tritone").length') > 0);
});

await test('el estado se guarda en la URL y se recupera al recargar', async (p) => {
  await p.goto(base());
  await p.click('#key-selector [data-pc="9"]');
  await p.click('#scale-selector [data-scale="minor"]');
  const hash = await p.eval('location.hash');
  assert.match(hash, /k=9/);
  assert.match(hash, /s=minor/);
  await p.goto(base(hash));
  assert.match(await p.eval('document.title'), /^A Menor Natural/);
});

await test('formas CAGED: filtran notas y la menor armónica lleva el G♯ en la caja C', async (p) => {
  await p.goto(base('#k=9&s=harmonic_minor&p=C'));
  const active = await p.eval(`[...document.querySelectorAll(".note-marker.note-active")].filter(m => m.dataset.s === "5").map(m => m.dataset.f + m.textContent).join(" ")`);
  assert.match(active, /4G♯/);
  assert.ok(!/3G/.test(active.replace('3G♯', '')));
});

await test('acorde diatónico: resalta sus notas y abre el explorador', async (p) => {
  await p.goto(base());
  await p.click('#chord-list .chord[data-i="4"]');
  assert.ok(await p.eval('document.querySelectorAll(".chord-tone").length') > 0);
  await p.click('#open-voicings');
  assert.match(await p.eval('document.querySelector("#explorer-name").textContent'), /^G · Mayor/);
});

await test('explorador: tipo, bajo y filtros', async (p) => {
  await p.goto(base());
  await p.click('#chord-type [data-type="maj7"]');
  assert.match(await p.eval('document.querySelector("#explorer-name").textContent'), /^Cmaj7/);
  await p.click('#chord-type [data-type="maj"]');
  await p.click('#bass-seg [data-b="1"]');
  assert.match(await p.eval('document.querySelector("#explorer-name").textContent'), /^C\/E · Mayor · 1ª inversión/);
  const first = await p.eval('document.querySelector("#voicings .vcap").textContent');
  assert.equal(first, '0 3 2 0 1 0');
  await p.click('#voicing-filter [data-vf="barre"]');
  assert.ok(await p.eval('document.querySelectorAll("#voicings .voicing").length') > 0);
});

await test('ajustes: afinación, 24 trastes y cejilla', async (p) => {
  await p.goto(base('#t=dropd&f=24&c=2'));
  assert.equal(await p.eval('document.querySelectorAll(".string-row").length'), 6);
  assert.equal(await p.eval('document.querySelectorAll("#fret-numbers span").length'), 25);
  assert.ok(await p.eval('!!document.querySelector(".capo")'));
});

await test('7 cuerdas dibuja 7 filas', async (p) => {
  await p.goto(base('#t=seven'));
  assert.equal(await p.eval('document.querySelectorAll(".string-row").length'), 7);
});

await test('teclado: un solo punto de tabulación y las flechas mueven entre notas', async (p) => {
  await p.goto(base());
  assert.equal(await p.eval('document.querySelectorAll(".note-marker[tabindex=\\"0\\"]").length'), 1);
  await p.eval('document.querySelector(".note-marker[tabindex=\\"0\\"]").focus()');
  const before = await p.eval('document.activeElement.dataset.s + ":" + document.activeElement.dataset.f');
  await p.key('ArrowRight');
  const after = await p.eval('document.activeElement.dataset.s + ":" + document.activeElement.dataset.f');
  assert.notEqual(before, after);
  assert.equal(after.split(':')[0], before.split(':')[0]);
});

await test('tema: el botón alterna y se recuerda', async (p) => {
  await p.goto(base());
  const t0 = await p.eval('document.documentElement.dataset.theme');
  await p.click('#theme-toggle');
  const t1 = await p.eval('document.documentElement.dataset.theme');
  assert.notEqual(t0, t1);
  await p.goto(base());
  assert.equal(await p.eval('document.documentElement.dataset.theme'), t1);
});

await test('service worker: se registra y cachea la app', async (p) => {
  await p.goto(base());
  await p.waitFor('navigator.serviceWorker.ready.then(() => true)', 8000);
  await p.waitFor('caches.keys().then(k => k.length > 0)', 8000);
});

await test('móvil (375 px): sin desbordamiento horizontal de la página', async (p) => {
  await p.close();
  const m = await browser.newPage(375, 812);
  try {
    await m.goto(`${server.url}/manifest.webmanifest`);
    await m.eval('localStorage.clear()');
    m.errors.length = 0;
    await m.goto(base());
    const overflow = await m.eval('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    assert.ok(overflow <= 1, 'desbordamiento de ' + overflow + ' px');
    assert.deepEqual(m.errors, []);
  } finally { await m.close(); }
});

await browser.close();
server.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} pruebas e2e pasaron`);
process.exit(failed ? 1 : 0);
