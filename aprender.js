/* FretMaster · ruta de aprendizaje: guarda en tu navegador qué comprobaciones has marcado y cuenta el avance por nivel.
   El progreso no sale de tu dispositivo. */
(function (global) {
  'use strict';

  const KEY = 'fm-progress';
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    } catch (e) { return new Set(); }
  }
  function save(set) {
    try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch (e) { /* almacenamiento bloqueado */ }
  }

  function init() {
    const boxes = $$('input[data-progress]');
    let done = load();

    const counts = () => {
      const levels = new Map();
      boxes.forEach((b) => {
        const lv = b.dataset.progress.split('-')[0];
        const c = levels.get(lv) || { total: 0, done: 0 };
        c.total++; if (b.checked) c.done++;
        levels.set(lv, c);
      });
      $$('[data-progress-level]').forEach((el) => {
        const c = levels.get(el.dataset.progressLevel) || { total: 0, done: 0 };
        el.textContent = `${c.done} de ${c.total}`;
      });
      const all = [...levels.values()].reduce((a, c) => ({ total: a.total + c.total, done: a.done + c.done }), { total: 0, done: 0 });
      $$('[data-progress-total]').forEach((el) => { el.textContent = `${all.done} de ${all.total}`; });
    };

    boxes.forEach((b) => {
      b.checked = done.has(b.dataset.progress);
      b.addEventListener('change', () => {
        if (b.checked) done.add(b.dataset.progress); else done.delete(b.dataset.progress);
        save(done);
        counts();
      });
    });

    const reset = document.getElementById('reset-progress');
    if (reset) {
      let armed = null;
      reset.addEventListener('click', () => {
        if (!armed) {
          reset.textContent = 'Pulsa de nuevo para borrar el progreso';
          armed = setTimeout(() => { armed = null; reset.textContent = 'Reiniciar progreso'; }, 4000);
          return;
        }
        clearTimeout(armed); armed = null;
        done = new Set(); save(done);
        boxes.forEach((b) => { b.checked = false; });
        reset.textContent = 'Reiniciar progreso';
        counts();
      });
    }
    counts();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
