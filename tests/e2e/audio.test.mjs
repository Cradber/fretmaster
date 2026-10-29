// Pruebas del audio en Chrome, centradas en lo que falla en Safari e iOS: arranque dentro de un gesto,
// recuperación tras una interrupción, programación en el reloj de audio y aviso cuando el audio está bloqueado.
// Los gestos son clics reales del ratón (con activación de usuario), no element.click().
//   node tests/e2e/audio.test.mjs
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Se ejecuta antes que cualquier script de la página: registra los contextos y cuenta las notas programadas.
const INSTRUMENT = `
  window.__ctxs = []; window.__starts = 0; window.__blockResume = false;
  (function () {
    const Orig = window.AudioContext;
    const Patched = function (...a) { const c = new Orig(...a); window.__ctxs.push(c); return c; };
    Patched.prototype = Orig.prototype;
    window.AudioContext = Patched;
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.length > 1000) window.__starts++; return st.apply(this, a); };   // solo notas, no el buffer vacío de calentamiento
    const rs = Orig.prototype.resume;
    Orig.prototype.resume = function () { return window.__blockResume ? new Promise(() => {}) : rs.call(this); };
  })();
`;

async function test(name, fn) {
  const page = await browser.newPage(1280, 800);
  try {
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT });
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
const url = (hash = '') => `${server.url}/index.html${hash}`;
const starts = (p) => p.eval('window.__starts');

await test('audio: no hay contexto hasta el primer gesto, y el primer clic lo crea y lo pone en marcha', async (p) => {
  await p.goto(url());
  assert.equal(await p.eval('FretApp.Audio.state()'), 'none');
  assert.equal(await p.eval('window.__ctxs.length'), 0);
  await p.realClick('.note-marker.note-active');
  await p.waitFor('FretApp.Audio.state() === "running"');
  assert.equal(await p.eval('window.__ctxs.length'), 1, 'debe haber un único contexto');
  await p.waitFor('window.__starts >= 1');
});

await test('audio: tocar una nota produce sonido (una fuente programada por nota)', async (p) => {
  await p.goto(url());
  await p.realClick('.note-marker.note-active');
  await p.waitFor('FretApp.Audio.state() === "running"');
  const before = await starts(p);
  await p.realClick('.note-marker.note-active[data-s="2"]');
  await p.waitFor(`window.__starts > ${before}`);
});

await test('audio: tras una interrupción (contexto suspendido) el siguiente gesto lo reanuda y la nota suena', async (p) => {
  await p.goto(url());
  await p.realClick('.note-marker.note-active');
  await p.waitFor('FretApp.Audio.state() === "running"');
  await p.eval('window.__ctxs[0].suspend()');
  await p.waitFor('FretApp.Audio.state() === "suspended"');
  // Safari informa "interrupted" (no "suspended") al bloquear el teléfono o cambiar de pestaña; Chrome nunca lo hace, así que se simula.
  await p.eval(`(() => { const c = window.__ctxs[0]; const real = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'state').get;
    Object.defineProperty(c, 'state', { configurable: true, get() { const s = real.call(this); return s === 'suspended' ? 'interrupted' : s; } }); })()`);
  assert.equal(await p.eval('FretApp.Audio.state()'), 'interrupted');
  const before = await starts(p);
  await p.realClick('.note-marker.note-active[data-s="3"]');
  await p.waitFor('FretApp.Audio.state() === "running"', 4000);
  await p.waitFor(`window.__starts > ${before}`, 4000);
});

await test('audio: Escuchar escala programa todas las notas de una vez desde el gesto (sin temporizadores)', async (p) => {
  await p.goto(url());
  await p.realClick('#play-scale');
  await p.waitFor('FretApp.Audio.state() === "running"');
  // 8 notas subiendo y 7 bajando = 15, todas programadas ya, aunque la reproducción dure unos 5 segundos.
  await p.waitFor('window.__starts >= 15', 3000);
  assert.ok(await p.eval('window.__ctxs[0].currentTime') < 1.5, 'el reloj de audio no debería haber avanzado mucho');
});

await test('audio: si el navegador no deja arrancar el audio, no se acumulan notas y se avisa al usuario', async (p) => {
  await p.goto(url());
  await p.realClick('.note-marker.note-active');
  await p.waitFor('FretApp.Audio.state() === "running"');
  await p.eval('window.__ctxs[0].suspend()');
  await p.waitFor('FretApp.Audio.state() === "suspended"');
  await p.eval('window.__blockResume = true');                       // resume() nunca se resuelve, como en un Safari bloqueado
  const before = await starts(p);
  assert.equal(await p.eval('document.querySelector("#toast").hidden'), true);
  await p.realClick('.note-marker.note-active[data-s="1"]');
  await p.waitFor('document.querySelector("#toast").hidden === false', 3000);
  assert.match(await p.eval('document.querySelector("#toast").textContent'), /interruptor de silencio/);
  assert.equal(await starts(p), before, 'no debe programar notas con el contexto parado');
  // Al volver a permitirse, las notas viejas no suenan de golpe.
  await p.eval('window.__blockResume = false');
  await p.realClick('.note-marker.note-active[data-s="4"]');
  await p.waitFor('FretApp.Audio.state() === "running"', 4000);
  await sleep(300);
  assert.ok((await starts(p)) - before <= 2, 'sonaron notas acumuladas: ' + ((await starts(p)) - before));
});

await test('audio: el diagnóstico de Ajustes informa del estado y reanuda el audio', async (p) => {
  await p.goto(url());
  await p.realClick('#settings-toggle');
  await p.realClick('#audio-test');
  await p.waitFor('document.querySelector("#audio-status").textContent.startsWith("Audio activo")', 3000);
  assert.match(await p.eval('document.querySelector("#audio-status").textContent'), /interruptor de silencio/);
  assert.ok(await p.eval('FretApp.Audio.info().sampleRate') > 0);
});

await test('audio: con el sonido desactivado, las notas no suenan al tocarlas', async (p) => {
  await p.goto(url('#v=0'));
  await p.realClick('.note-marker.note-active');
  await sleep(300);
  assert.equal(await starts(p), 0);
});

await browser.close();
server.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} pruebas de audio pasaron`);
process.exit(failed ? 1 : 0);
