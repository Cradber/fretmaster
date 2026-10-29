/* FretMaster · tema Automático / Claro / Oscuro. Lo comparten la herramienta y las páginas de documentación.
   Modo guardado: 'auto' (sigue al sistema, en vivo), 'light' o 'dark'. Un script inline en <head> aplica el tema
   antes del primer pintado para evitar el parpadeo; este módulo se encarga del resto. */
(function (global) {
  'use strict';

  const KEY = 'fm-theme';
  const MODES = ['auto', 'light', 'dark'];
  const COLORS = { light: '#f7f7f8', dark: '#0b0b0e' };
  const root = document.documentElement;
  const query = global.matchMedia ? global.matchMedia('(prefers-color-scheme: light)') : null;

  function stored() {
    try {
      const v = localStorage.getItem(KEY);
      return MODES.includes(v) ? v : 'auto';
    } catch (e) { return 'auto'; }
  }

  function resolve(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return query && query.matches ? 'light' : 'dark';
  }

  function apply(mode) {
    const theme = resolve(mode);
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COLORS[theme]);
    document.querySelectorAll('[data-theme-set]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.themeSet === mode));
    });
  }

  function set(mode) {
    if (!MODES.includes(mode)) return;
    try {
      if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode);
    } catch (e) { /* almacenamiento bloqueado: el cambio vale para esta visita */ }
    apply(mode);
  }

  function init() {
    apply(stored());
    document.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => set(b.dataset.themeSet)));
    // En modo automático, seguir los cambios del sistema sin recargar.
    const onChange = () => { if (stored() === 'auto') apply('auto'); };
    if (query) {
      if (query.addEventListener) query.addEventListener('change', onChange); else if (query.addListener) query.addListener(onChange);
    }
  }

  global.FretTheme = { get: stored, set, resolve };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
