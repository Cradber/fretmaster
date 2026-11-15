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

async function test(name, fn, opts = {}) {
  const page = await browser.newPage(opts.width || 1280, opts.height || 800, opts.scheme);
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
  assert.match(await p.eval('document.title'), /^A Menor natural/);
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

await test('formas CAGED según la afinación: desplazadas en medio tono abajo y avisadas en las abiertas', async (p) => {
  await p.goto(base('#k=0&s=major&p=C&t=eb'));
  assert.match(await p.eval('document.querySelector("#caged-note").textContent'), /1 traste más arriba/);
  // Cuerda 6 en estándar: E F G en los trastes 0 1 3. Con la afinación medio tono abajo, las mismas notas en 1 2 4.
  const active = await p.eval(`[...document.querySelectorAll('.note-marker[data-s="5"]')].filter(m => !m.classList.contains('note-dimmed')).map(m => +m.dataset.f).filter(f => f < 6).join(' ')`);
  assert.equal(active, '1 2 4');
  await p.goto(base('#k=0&s=major&p=C&t=dadgad'));
  assert.match(await p.eval('document.querySelector("#caged-note").textContent'), /no existen las formas CAGED/);
});

await test('cambiar el # en la misma pestaña actualiza la vista', async (p) => {
  await p.goto(base('#k=0&s=major'));
  assert.match(await p.eval('document.title'), /^C Mayor/);
  await p.eval(`location.hash = 'k=9&s=harmonic_minor'`);
  await p.waitFor(`document.title.startsWith('A Menor armónica')`);
  assert.match(await p.eval('location.hash'), /k=9/);
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
  // La inversión se nombra por el grado del bajo, no por su posición en la fórmula.
  const nameWith = async (type, bass) => {
    await p.click(`#chord-type [data-type="${type}"]`);
    await p.click(`#bass-seg [data-b="${bass}"]`);
    return p.eval('document.querySelector("#explorer-name").textContent');
  };
  assert.match(await nameWith('sus2', 1), /· bajo en la 2ª$/);
  assert.match(await nameWith('6', 3), /· bajo en la 6ª$/);
  assert.match(await nameWith('7', 3), /· 3ª inversión$/);
  await p.click('#chord-type [data-type="maj"]');
  await p.click('#bass-seg [data-b="1"]');
  await p.click('#voicing-filter [data-vf="barre"]');
  assert.ok(await p.eval('document.querySelectorAll("#voicings .voicing").length') > 0);
});

await test('ajustes: afinación, 24 trastes y cejilla', async (p) => {
  await p.goto(base('#t=dropd&f=24&c=2'));
  assert.equal(await p.eval('document.querySelectorAll("#fretboard .string-row").length'), 6);
  assert.equal(await p.eval('document.querySelectorAll("#fret-numbers span").length'), 25);
  assert.ok(await p.eval('!!document.querySelector(".capo")'));
});

await test('7 cuerdas dibuja 7 filas', async (p) => {
  await p.goto(base('#t=seven'));
  assert.equal(await p.eval('document.querySelectorAll("#fretboard .string-row").length'), 7);
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .string-row").length'), 7, 'el mástil de práctica sigue la afinación');
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

await test('tema automático: sigue al sistema en vivo y se puede fijar a claro u oscuro', async (p) => {
  await p.goto(base());
  const mode = () => p.eval('document.documentElement.dataset.themeMode');
  const theme = () => p.eval('document.documentElement.dataset.theme');
  assert.equal(await mode(), 'auto');
  assert.equal(await theme(), 'light');                       // el sistema emulado es claro
  await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await p.waitFor('document.documentElement.dataset.theme === "dark"');   // sin recargar
  await p.click('[data-theme-set="light"]');
  assert.equal(await mode(), 'light');
  assert.equal(await theme(), 'light');                       // fijado: ya no sigue al sistema
  await p.goto(base());
  assert.equal(await mode(), 'light');                        // se recuerda
  await p.click('[data-theme-set="dark"]');
  assert.equal(await theme(), 'dark');
  await p.click('[data-theme-set="auto"]');
  assert.equal(await mode(), 'auto');
  assert.equal(await p.eval('localStorage.getItem("fm-theme")'), null);
  assert.equal(await p.eval('document.querySelector("[data-theme-set=auto]").getAttribute("aria-pressed")'), 'true');
}, { scheme: 'light' });

await test('tema automático sin preferencia guardada arranca oscuro si el sistema es oscuro', async (p) => {
  await p.goto(base());
  assert.equal(await p.eval('document.documentElement.dataset.theme'), 'dark');
}, { scheme: 'dark' });

await test('rediseño: el mástil entero cabe en la primera pantalla (1280×720)', async (p) => {
  await p.goto(base());
  const r = await p.eval('(() => { const b = document.querySelector("#fretboard").getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; })()');
  assert.ok(r.bottom <= 720, `el mástil termina en y=${Math.round(r.bottom)}, fuera de 720`);
}, { width: 1280, height: 720 });

await test('enlace discreto: botón de icono con nombre accesible y sin texto "Copiar enlace" visible', async (p) => {
  await p.goto(base());
  assert.match(await p.eval('document.querySelector("#share").getAttribute("aria-label")'), /enlace/i);
  assert.equal(await p.eval('document.querySelector("#share").textContent.trim()'), '');
});

await test('ajustes: la ventana se abre, se cierra con Escape y devuelve el foco', async (p) => {
  await p.goto(base());
  assert.equal(await p.eval('document.querySelector("#settings-panel").hidden'), true);
  await p.click('#settings-toggle');
  assert.equal(await p.eval('document.querySelector("#settings-panel").hidden'), false);
  assert.equal(await p.eval('document.querySelector("#settings-toggle").getAttribute("aria-expanded")'), 'true');
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', windowsVirtualKeyCode: 27 });
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await p.eval('document.querySelector("#settings-panel").hidden'), true);
  assert.equal(await p.eval('document.activeElement.id'), 'settings-toggle');
});

await test('pestañas: cambian de panel, guardan la vista y se mueven con flechas', async (p) => {
  await p.goto(base());
  assert.equal(await p.eval('document.querySelector("#panel-acordes").hidden'), true);
  await p.click('#tab-acordes');
  assert.equal(await p.eval('document.querySelector("#panel-acordes").hidden'), false);
  assert.equal(await p.eval('document.querySelector("#panel-escala").hidden'), true);
  assert.match(await p.eval('location.hash'), /w=acordes/);
  assert.equal(await p.eval('document.querySelector("#tab-acordes").getAttribute("aria-selected")'), 'true');
  await p.eval('document.querySelector("#tab-acordes").focus()');
  await p.key('ArrowLeft');
  assert.equal(await p.eval('document.querySelector("#tab-escala").getAttribute("aria-selected")'), 'true');
});

await test('los acordes diatónicos abren el explorador en su pestaña', async (p) => {
  await p.goto(base());
  await p.click('#chord-list .chord[data-i="1"]');
  await p.click('#open-voicings');
  assert.equal(await p.eval('document.querySelector("#panel-acordes").hidden'), false);
  assert.match(await p.eval('document.querySelector("#explorer-name").textContent'), /^Dm · Menor/);
});

await test('selector de escala por familias: cambia de familia sin cambiar la escala', async (p) => {
  await p.goto(base());
  assert.equal(await p.eval('document.querySelector("#scale-selector .scale-items[data-group=basic]").hidden'), false);
  await p.click('#scale-groups [data-group="mode"]');
  assert.equal(await p.eval('document.querySelector("#scale-selector .scale-items[data-group=mode]").hidden'), false);
  assert.equal(await p.eval('document.querySelector("#scale-selector .scale-items[data-group=basic]").hidden'), true);
  assert.match(await p.eval('document.title'), /Mayor/);     // la escala sigue siendo la misma
  await p.click('#scale-selector [data-scale="dorian"]');
  assert.match(await p.eval('document.title'), /Dórico/);
});

await test('lo que lleva el atributo hidden no se ve (el display propio de .btn y .seg no lo anula)', async (p) => {
  const shown = (sel) => `getComputedStyle(document.querySelector(${JSON.stringify(sel)})).display !== "none"`;
  await p.goto(base());
  assert.equal(await p.eval(shown('#open-voicings')), false, 'sin acorde elegido no hay «Ver digitaciones»');
  await p.click('#chord-list .chord');
  assert.equal(await p.eval(shown('#open-voicings')), true, 'con un acorde elegido, sí');
  await p.click('#scale-groups [data-group="penta"]');
  await p.click('#scale-selector [data-scale="minor_pentatonic"]');
  assert.equal(await p.eval(shown('#size-seg')), false, 'sin acordes diatónicos no hay Tríadas / Cuatriadas');
  assert.equal(await p.eval(shown('#open-voicings')), false);
  const leaked = await p.eval('[...document.querySelectorAll("[hidden]")].filter(e => getComputedStyle(e).display !== "none").map(e => e.id || e.className)');
  assert.deepEqual(leaked, []);
});

await test('un enlace parcial conserva las preferencias (zurdo, trastes, alteraciones, sonido) y reinicia la vista', async (p) => {
  await p.goto(base('#k=4&s=dorian&p=E&t=eb&c=2&l=1&f=24&a=flat&v=0'));
  await p.goto(`${server.url}/aprender.html`);
  await p.goto(base('#k=0&s=major&m=notes'));           // como los botones «Abrir» de las lecciones
  const st = Object.fromEntries(new URLSearchParams((await p.eval('location.hash')).slice(1)));
  assert.deepEqual([st.l, st.f, st.a, st.v], ['1', '24', 'flat', '0'], 'preferencias conservadas');
  assert.deepEqual([st.k, st.s, st.p, st.t, st.c], ['0', 'major', 'all', 'standard', '0'], 'la vista vuelve a los valores por defecto');
  assert.ok(await p.eval('document.querySelector("#board-inner").classList.contains("lefty")'));
  // Lo que el enlace dice explícitamente manda sobre lo guardado.
  await p.goto(`${server.url}/aprender.html`);
  await p.goto(base('#k=0&l=0'));
  assert.match(await p.eval('location.hash'), /l=0/);
});

await test('una forma CAGED se enmarca con una franja que abarca sus notas y desaparece con «Todo»', async (p) => {
  await p.goto(base('#k=9&s=harmonic_minor'));
  assert.equal(await p.eval('document.querySelectorAll("#fretboard .band").length'), 0);
  await p.click('#caged-seg [data-pos="C"]');
  const spans = await p.eval('[...document.querySelectorAll("#fretboard .band")].map(b => b.style.gridColumn)');
  // Trastes 0–4 (columnas 1 a 6): la ventana es 0–3, pero el G♯ de la caja está en el traste 4.
  assert.equal(spans[0].replace(/\s/g, ''), '1/6', spans.join(' | '));
  assert.ok(spans.length >= 2, 'la caja se repite una octava más arriba');
  const outside = await p.eval(`(() => {
    const cols = [...document.querySelectorAll('#fretboard .band')].map(b => b.style.gridColumn.split('/').map(Number));
    return [...document.querySelectorAll('.note-marker.note-active')].filter(m => !cols.some(([a, b]) => +m.dataset.f + 1 >= a && +m.dataset.f + 1 < b)).length;
  })()`);
  assert.equal(outside, 0, 'notas de la caja fuera de la franja');
  assert.match(await p.eval('document.querySelector("#caged-note").textContent'), /^Forma C/);
  await p.click('#caged-seg [data-pos="all"]');
  assert.equal(await p.eval('document.querySelectorAll("#fretboard .band").length'), 0);
});

await test('la pentatónica menor indica el número de caja y la descripción va junto al título', async (p) => {
  await p.goto(base('#k=9&s=minor_pentatonic&p=G'));
  assert.match(await p.eval('document.querySelector("#caged-note").textContent'), /«caja 1»/);
  await p.click('#caged-seg [data-pos="E"]');
  assert.match(await p.eval('document.querySelector("#caged-note").textContent'), /«caja 2»/);
  const order = await p.eval('document.querySelector("#scale-desc").compareDocumentPosition(document.querySelector("#fretboard")) & Node.DOCUMENT_POSITION_FOLLOWING');
  assert.ok(order, 'la descripción de la escala va antes del mástil');
  assert.ok(await p.eval('document.querySelector("#scale-desc").textContent.length > 20'));
});

await test('desde la guía, la herramienta ofrece volver a la lección', async (p) => {
  await p.goto(base());
  assert.equal(await p.eval('document.querySelector("#back-lesson").hidden'), true, 'sin venir de la guía no aparece');
  await p.goto(`${server.url}/aprender.html`);
  await p.click('a.try[href^="index.html#k=9"]');
  await p.waitFor('location.pathname.endsWith("index.html") && !!document.querySelector(".note-marker")');
  assert.equal(await p.eval('document.querySelector("#back-lesson").hidden'), false);
  await p.click('#back-lesson');
  await p.waitFor('location.pathname.endsWith("aprender.html")');
});

// ---------- Pestaña Práctica ----------
const feedback = 'document.querySelector("#quiz-feedback").textContent';
const score = 'document.querySelector("#quiz-score").textContent';
// Posición (cuerda, traste) de un punto del mástil de práctica, leída del propio dibujo.
const dotAt = (sel) => `(() => {
  const d = document.querySelector('#quiz-board ${sel}');
  if (!d) return null;
  const row = d.closest('.string-row');
  return { s: [...document.querySelectorAll('#quiz-board .string-row')].indexOf(row), f: [...row.querySelectorAll('.fret-cell')].indexOf(d.closest('.fret-cell')) };
})()`;

await test('práctica: «Nombra la nota» corrige el fallo y el acierto, y lleva la racha', async (p) => {
  await p.goto(base('#w=practica&x=name&y=1'));
  assert.equal(await p.eval('document.querySelector("#panel-practica").hidden'), false);
  assert.equal(await p.eval('document.querySelector("#tab-practica").getAttribute("aria-selected")'), 'true');
  assert.equal(await p.eval('document.querySelectorAll("#quiz-answers .quiz-answer").length'), 7, 'nivel 1: siete notas naturales');
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .qdot--ask").length'), 1);
  const rightPc = async () => {
    const pos = await p.eval(dotAt('.qdot--ask'));
    assert.match(await p.eval('document.querySelector("#quiz-sub").textContent'), new RegExp(`^Cuerda ${pos.s + 1}, traste ${pos.f}$`));
    assert.ok(pos.s === 4 || pos.s === 5, 'nivel 1: cuerdas 6 y 5');
    return p.eval(`(FretTheory.TUNINGS.standard.midi[${pos.s}] + ${pos.f}) % 12`);
  };
  let pc = await rightPc();
  const wrong = [0, 2, 4, 5, 7, 9, 11].find((x) => x !== pc);
  await p.click(`#quiz-answers [data-a="${wrong}"]`);
  assert.match(await p.eval(feedback), /^✗ No\. Es /);
  assert.ok(await p.eval(`document.querySelector('#quiz-answers [data-a="${wrong}"]').classList.contains('is-wrong')`));
  assert.ok(await p.eval(`document.querySelector('#quiz-answers [data-a="${pc}"]').classList.contains('is-right')`));
  assert.match(await p.eval(score), /^Racha: 0 · Mejor racha: 0 · Aciertos: 0 de 1$/);
  assert.equal(await p.eval('document.activeElement.id'), 'quiz-next', 'el foco pasa a «Siguiente»');
  await p.click(`#quiz-answers [data-a="${pc}"]`);                 // ya respondida: no cuenta dos veces
  assert.match(await p.eval(score), /Aciertos: 0 de 1$/);
  await p.click('#quiz-next');
  assert.equal(await p.eval(feedback), '');
  assert.equal(await p.eval('document.querySelector("#quiz-next").hidden'), true);
  pc = await rightPc();
  await p.click(`#quiz-answers [data-a="${pc}"]`);
  assert.match(await p.eval(feedback), /^✓ Correcto\. Es /);
  assert.match(await p.eval(score), /^Racha: 1 · Mejor racha: 1 · Aciertos: 1 de 2$/);
  assert.equal(await p.eval('JSON.parse(localStorage.getItem("fm-practice"))["name-1"]'), 1);
  await p.waitFor(`${feedback} === ""`, 4000);                      // tras un acierto, la siguiente llega sola
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .qdot--ask").length'), 1);
  // La mejor racha se recupera al volver.
  await p.goto(`${server.url}/aprender.html`);
  await p.goto(base('#w=practica&x=name&y=1'));
  assert.match(await p.eval(score), /^Racha: 0 · Mejor racha: 1 · Aciertos: 0 de 0$/);
});

await test('práctica: «Encuentra la nota» se responde en el mástil y enseña dónde estaba', async (p) => {
  await p.goto(base('#w=practica&x=find&y=1'));
  assert.equal(await p.eval('document.querySelector("#quiz-answers").hidden'), true);
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .quiz-cell").length'), 13, 'trastes 0 a 12 de una sola cuerda');
  // La nota pedida se deduce del enunciado («Toca G (Sol)») y las casillas correctas, de la afinación.
  const cells = () => p.eval(`(() => {
    const label = document.querySelector('#quiz-prompt').textContent.replace(/^Toca /, '');
    const pc = [0, 2, 4, 5, 7, 9, 11].find((x) => label.startsWith(FretTheory.keyLabel(x, 'auto') + ' ('));
    const all = [...document.querySelectorAll('#quiz-board .quiz-cell')].map((c) => ({ s: +c.dataset.s, f: +c.dataset.f }));
    const ok = (c) => (FretTheory.TUNINGS.standard.midi[c.s] + c.f) % 12 === pc;
    return { right: all.filter(ok), wrong: all.filter((c) => !ok(c)) };
  })()`);
  let c = await cells();
  assert.ok(c.right.length >= 1 && c.wrong.length >= 11);
  assert.match(await p.eval('document.querySelector("#quiz-sub").textContent'), new RegExp(`^en la cuerda ${c.right[0].s + 1}$`));
  await p.click(`#quiz-board .quiz-cell[data-f="${c.right[0].f}"]`);
  assert.match(await p.eval(feedback), /^✓ Correcto\./);
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .qdot--ok").length'), c.right.length);
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .quiz-cell").length'), 0, 'respondida: ya no se puede pulsar');
  await p.click('#quiz-next');
  c = await cells();
  await p.click(`#quiz-board .quiz-cell[data-f="${c.wrong[0].f}"]`);
  assert.match(await p.eval(feedback), /^✗ No\. Has tocado /);
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .qdot--bad").length'), 1);
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .qdot--ok").length'), c.right.length, 'se enseña la posición correcta');
  assert.match(await p.eval(score), /^Racha: 0 · Mejor racha: 1 · Aciertos: 1 de 2$/);
});

await test('práctica: «Intervalos» a la vista y de oído, y el ejercicio viaja en la URL', async (p) => {
  await p.goto(base('#w=practica&x=interval&y=1'));
  assert.equal(await p.eval('document.querySelectorAll("#quiz-answers .quiz-answer").length'), 5);
  const root = await p.eval(dotAt('.role-root'));
  const target = await p.eval(dotAt('.qdot--ask'));
  const semi = await p.eval(`(() => { const t = FretTheory.TUNINGS.standard.midi; return t[${target.s}] + ${target.f} - t[${root.s}] - ${root.f}; })()`);
  assert.ok([3, 4, 5, 7, 12].includes(semi), 'nivel 1: intervalos básicos, y el dibujo coincide con la pregunta');
  await p.click(`#quiz-answers [data-a="${semi}"]`);
  assert.match(await p.eval(feedback), /^✓ Correcto\. Es una .+ \(.+\): \d+ semitonos\.$/);
  // Cambiar algo ajeno al ejercicio (el modo zurdo) redibuja la pregunta en curso sin cambiarla ni perder la cuenta.
  await p.click('#quiz-next');
  const before = await p.eval(dotAt('.qdot--ask'));
  await p.eval('(() => { const c = document.querySelector("#chk-lefty"); c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); })()');
  assert.deepEqual(await p.eval(dotAt('.qdot--ask')), before);
  assert.ok(await p.eval('document.querySelector("#quiz-inner").classList.contains("lefty")'));
  assert.match(await p.eval(score), /Aciertos: 1 de 1$/);
  // Nivel 3: doce intervalos y el mástil vacío hasta responder.
  await p.click('#quiz-level [data-y="3"]');
  assert.match(await p.eval('location.hash'), /x=interval&y=3/);
  assert.match(await p.eval('document.querySelector("#quiz-level-desc").textContent'), /solo de oído/);
  assert.equal(await p.eval('document.querySelectorAll("#quiz-answers .quiz-answer").length'), 12);
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .qdot").length'), 0);
  assert.equal(await p.eval('document.querySelector("#quiz-ear").hidden'), false);
  assert.match(await p.eval(score), /^Racha: 0 · Mejor racha: 0 · Aciertos: 0 de 0$/, 'otro nivel empieza de cero');
  await p.click('#quiz-answers [data-a="7"]');
  assert.equal(await p.eval('document.querySelectorAll("#quiz-board .qdot").length'), 2, 'al responder se ven las dos notas');
  assert.equal(await p.eval('document.querySelector("#quiz-ear").hidden'), true);
  // Cambiar de ejercicio con los botones.
  await p.click('#quiz-kind [data-x="find"]');
  assert.match(await p.eval('location.hash'), /x=find&y=3/);
  assert.match(await p.eval('document.querySelector("#quiz-prompt").textContent'), /^Toca /);
  // El mástil principal no se ve afectado por el de práctica.
  assert.equal(await p.eval('document.querySelectorAll(".note-marker").length'), 84);
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
    // En columna, la etiqueta de cada familia de acordes mide lo que su texto (antes, 88 px por un flex-basis de fila).
    await m.goto(base('#w=acordes'));
    const labels = await m.eval('[...document.querySelectorAll("#chord-type .glabel")].map(e => e.getBoundingClientRect().height)');
    assert.ok(labels.length > 0 && labels.every((h) => h > 0 && h < 30), 'altura de las etiquetas: ' + labels.join(', '));
    await m.goto(base('#w=practica&x=interval&y=2'));
    assert.equal(await m.eval('document.querySelector("#panel-practica").hidden'), false);
    const wide = await m.eval('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    assert.ok(wide <= 1, 'la pestaña Práctica desborda ' + wide + ' px');
    assert.deepEqual(m.errors, []);
  } finally { await m.close(); }
});

await browser.close();
server.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} pruebas e2e pasaron`);
process.exit(failed ? 1 : 0);
