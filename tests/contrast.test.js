'use strict';
// Comprueba el contraste WCAG 2.1 de los tokens de color de base.css en los dos temas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'base.css'), 'utf8');

function tokens(selectorPattern) {
  const m = new RegExp(selectorPattern + '\\s*\\{([^}]*)\\}').exec(css);
  assert.ok(m, 'no se encontró el bloque ' + selectorPattern);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out[k] = v.toLowerCase();
  return out;
}
const light = tokens(':root');
const dark = { ...light, ...tokens(':root\\[data-theme="dark"\\]') };

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

let passed = 0;
function check(theme, tk, fg, bg, min, what) {
  assert.ok(tk[fg] && tk[bg], `faltan tokens ${fg}/${bg}`);
  const r = ratio(tk[fg], tk[bg]);
  assert.ok(r >= min, `${theme}: ${what || fg + ' sobre ' + bg} = ${r.toFixed(2)} (mínimo ${min})`);
  passed++;
}

const ROLES = ['c-root', 'c-third', 'c-fifth', 'c-tritone', 'c-seventh'];
[['claro', light], ['oscuro', dark]].forEach(([theme, tk]) => {
  // Texto normal: AA = 4.5
  ['fg', 'muted', 'faint'].forEach((t) => ['bg', 'surface', 'surface-2'].forEach((b) => check(theme, tk, t, b, 4.5)));
  ['accent'].forEach(() => ['bg', 'surface'].forEach((b) => check(theme, tk, 'accent', b, 4.5, 'acento como texto sobre ' + b)));
  check(theme, tk, 'on-accent', 'accent', 4.5, 'texto del botón primario');
  check(theme, tk, 'pill-on-fg', 'pill-on-bg', 4.5, 'selección activa');
  check(theme, tk, 'c-scale-fg', 'c-scale', 4.5, 'nota del resto de la escala');
  ROLES.forEach((r) => check(theme, tk, 'on-role', r, 4.5, `texto de nota sobre ${r}`));
  // Objetos gráficos necesarios para entender la interfaz: 3:1 contra el mástil
  ROLES.forEach((r) => check(theme, tk, r, 'board', 3, `${r} contra el mástil`));
  check(theme, tk, 'nut', 'board', 1.5, 'cejuela contra el mástil');
});

console.log(`${passed} comprobaciones de contraste pasaron (claro y oscuro)`);
