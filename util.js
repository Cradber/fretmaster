/* FretMaster · utilidades de DOM compartidas por los módulos de la herramienta. */
(function (global) {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  global.FretApp = global.FretApp || {};
  global.FretApp.Util = { $, $$, has, el, svgEl };
})(window);
