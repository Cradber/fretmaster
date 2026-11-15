/* FretMaster · modelo de estado de la herramienta: valores por defecto, validación y persistencia.
   El estado completo vive en la URL (#k=0&s=major…) y en localStorage, así que cualquier vista se puede enlazar. */
(function (global) {
  'use strict';

  const T = global.FretTheory;
  const { has } = global.FretApp.Util;

  const STORE_KEY = 'fm-state';
  // Ejercicios de la pestaña Práctica; un test comprueba que son los de quiz.js (state.js no depende de él).
  const EXERCISES = ['name', 'find', 'interval'];

  /*  k tonalidad (0–11)        s escala            p forma CAGED (all|C|A|G|E|D)   m mostrar (notes|intervals)
      a alteraciones (auto|sharp|flat)  t afinación  f trastes (22|24)  c cejilla (0–9)  l zurdo (0|1)
      z acordes diatónicos (3|4)  v sonido (0|1)     r fundamental del explorador   q tipo de acorde
      b nota del bajo (índice)   w pestaña (escala|acordes|practica)
      x ejercicio de práctica (name|find|interval)   y nivel del ejercicio (1–3) */
  const DEFAULTS = { k: 0, s: 'major', p: 'all', m: 'notes', a: 'auto', t: 'standard', f: 22, c: 0, l: 0, z: 3, v: 1, r: 0, q: 'maj', b: 0, w: 'escala', x: 'name', y: 1 };

  /** Convierte cualquier entrada (URL, localStorage) en un estado válido; lo que no es válido vuelve al valor por defecto. */
  function sanitize(raw) {
    const o = { ...DEFAULTS };
    const k = parseInt(raw.k, 10);
    if (k >= 0 && k < 12) o.k = k;
    if (has(T.SCALES, raw.s)) o.s = raw.s;
    if (raw.p === 'all' || T.CAGED_ORDER.includes(raw.p)) o.p = raw.p;
    if (raw.m === 'notes' || raw.m === 'intervals') o.m = raw.m;
    if (['auto', 'sharp', 'flat'].includes(raw.a)) o.a = raw.a;
    if (has(T.TUNINGS, raw.t)) o.t = raw.t;
    if (String(raw.f) === '22' || String(raw.f) === '24') o.f = Number(raw.f);
    const c = parseInt(raw.c, 10);
    if (c >= 0 && c <= 9) o.c = c;
    if (raw.l !== undefined) o.l = String(raw.l) === '1' ? 1 : 0;
    if (String(raw.z) === '4') o.z = 4;
    if (raw.v !== undefined) o.v = String(raw.v) === '0' ? 0 : 1;
    const r = parseInt(raw.r, 10);
    if (r >= 0 && r < 12) o.r = r;
    if (has(T.CHORD_TYPES, raw.q)) o.q = String(raw.q);
    const b = parseInt(raw.b, 10);
    if (b >= 0 && b < 6) o.b = b;
    if (['escala', 'acordes', 'practica'].includes(raw.w)) o.w = raw.w;
    if (EXERCISES.includes(raw.x)) o.x = raw.x;
    const y = parseInt(raw.y, 10);
    if (y >= 1 && y <= 3) o.y = y;
    if (o.c > 0 && o.c >= o.f - 2) o.c = 0;
    return o;
  }

  // Preferencias de quien toca (zurdo, trastes, alteraciones, sonido): un enlace que no las mencione no debe borrarlas.
  // El resto (escala, forma, afinación, cejilla…) describe una vista, y un enlace parcial la deja en su valor por defecto.
  const PREF_KEYS = ['l', 'f', 'a', 'v'];

  function load() {
    const fromUrl = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
    let stored;
    try { stored = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { stored = {}; }
    if (!Object.keys(fromUrl).length) return sanitize(stored);
    const prefs = {};
    PREF_KEYS.forEach((k) => { if (has(stored, k)) prefs[k] = stored[k]; });
    return sanitize({ ...prefs, ...fromUrl });
  }

  function persist(state) {
    const qs = new URLSearchParams(Object.entries(state).map(([k, v]) => [k, String(v)])).toString();
    try { history.replaceState(null, '', '#' + qs); } catch (e) { /* file:// restringido */ }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* almacenamiento bloqueado */ }
  }

  global.FretApp.State = { DEFAULTS, STORE_KEY, sanitize, load, persist };
})(window);
