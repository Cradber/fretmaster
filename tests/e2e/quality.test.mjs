// Auditoría transversal en Chrome: accesibilidad básica de todas las páginas, foco visible con teclado
// y funcionamiento sin conexión de TODAS las páginas.
//   node tests/e2e/quality.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, startServer, launchBrowser } from './harness.mjs';

if (!chromePath()) {
  console.log('Chrome no encontrado: se omiten las pruebas e2e (define CHROME_PATH para ejecutarlas).');
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort();
const server = await startServer(root);
const browser = await launchBrowser();
const results = [];

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
const url = (p) => `${server.url}/${p}`;

assert.ok(PAGES.length >= 4, 'se esperaban al menos 4 páginas');

for (const page of PAGES) {
  await test(`${page}: todo control tiene nombre accesible`, async (p) => {
    await p.goto(url(page));
    const unnamed = await p.eval(`[...document.querySelectorAll('button, a[href], input, select, textarea, [role=tab], summary')]
      .filter(e => !e.closest('[hidden]') || e.matches('[role=tab]'))
      .filter(e => {
        const label = e.getAttribute('aria-label') || '';
        const by = (e.getAttribute('aria-labelledby') || '').split(' ').map(id => (document.getElementById(id) || {}).textContent || '').join('').trim();
        const text = (e.textContent || '').trim();
        const wrapped = e.closest('label') ? e.closest('label').textContent.trim() : '';
        const title = e.getAttribute('title') || '';
        return !(label.trim() || by || text || wrapped || title.trim());
      }).map(e => e.outerHTML.slice(0, 90))`);
    assert.deepEqual(unnamed, [], 'controles sin nombre');
  });

  await test(`${page}: estructura de títulos y regiones`, async (p) => {
    await p.goto(url(page));
    const info = await p.eval(`(() => {
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
      const jumps = hs.filter((l, i) => i > 0 && l > hs[i - 1] + 1);
      return { h1: hs.filter(l => l === 1).length, first: hs[0], jumps, main: document.querySelectorAll('main').length,
               header: document.querySelectorAll('header').length, nav: document.querySelectorAll('nav').length,
               lang: document.documentElement.lang, title: document.title.length > 3 };
    })()`);
    assert.equal(info.h1, 1, 'debe haber exactamente un h1');
    assert.equal(info.first, 1, 'el primer título debe ser el h1');
    assert.deepEqual(info.jumps, [], 'saltos de nivel de título');
    assert.equal(info.main, 1);
    assert.ok(info.header >= 1 && info.nav >= 1);
    assert.equal(info.lang, 'es');
    assert.ok(info.title);
  });

  await test(`${page}: el foco con teclado siempre es visible (primeros 25 elementos)`, async (p) => {
    await p.goto(url(page));
    const seen = [];
    for (let i = 0; i < 25; i++) {
      await p.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      const info = await p.eval(`(() => { const e = document.activeElement; if (!e || e === document.body) return null;
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        return { tag: e.tagName + (e.id ? '#' + e.id : '') + '.' + String(e.className).slice(0, 20), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
                 shadow: cs.boxShadow !== 'none', visible: r.width > 0 && r.height > 0 }; })()`);
      if (info) seen.push(info);
    }
    assert.ok(seen.length >= 8, 'el tabulador no recorre elementos suficientes: ' + seen.length);
    const bad = seen.filter((s) => s.visible && !s.outline && !s.shadow).map((s) => s.tag);
    assert.deepEqual(bad, [], 'elementos enfocables sin indicador de foco');
  });
}

await test('sin conexión: TODAS las páginas cargan desde la caché', async (p) => {
  await p.goto(url('index.html'));
  await p.waitFor('navigator.serviceWorker.ready.then(() => true)', 8000);
  await p.waitFor('caches.keys().then(k => k.length > 0)', 8000);
  const cached = await p.eval(`caches.keys().then(async k => (await (await caches.open(k[0])).keys()).map(r => new URL(r.url).pathname))`);
  PAGES.forEach((pg) => assert.ok(cached.includes('/' + pg), `${pg} no está en la caché`));
  await p.send('Network.enable');
  await p.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  for (const pg of PAGES) {
    await p.goto(url(pg));
    const t = await p.eval('document.title');
    assert.match(t, /FretMaster|·/, `${pg} sin conexión: título «${t}»`);
    assert.ok(await p.eval('document.querySelectorAll("h1").length') >= 1, `${pg} sin conexión: sin contenido`);
  }
  // La herramienta sigue siendo interactiva sin conexión.
  await p.goto(url('index.html'));
  assert.equal(await p.eval('document.querySelectorAll(".note-marker").length'), 84);
  await p.click('#key-selector [data-pc="5"]');
  assert.equal(await p.eval('document.querySelector("#note-chips b").textContent'), 'F');
  await p.goto(url('ayuda.html'));
  assert.ok(await p.eval('document.querySelectorAll("[data-gen=scales] tbody tr").length') > 10, 'las tablas generadas funcionan sin conexión');
});

await browser.close();
server.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} pruebas de calidad pasaron`);
process.exit(failed ? 1 : 0);
