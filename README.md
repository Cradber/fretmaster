# FretMaster

Explorador de escalas, modos y acordes diatónicos sobre el mástil de la guitarra. Sin dependencias ni paso de build; funciona sin conexión.

## Ejecutar

```bash
python3 -m http.server 8000
```

Abre <http://localhost:8000>. El service worker (modo offline e instalación como app) solo funciona por HTTP, no abriendo el archivo directamente.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `index.html` | La herramienta: cabecera, pestañas Escala y Explorador de acordes |
| `ayuda.html` | Documentación del contenido (notas, escalas, CAGED, acordes, digitaciones…). Tablas generadas desde `theory.js` |
| `aprender.html`, `aprender.js` | Ruta de estudio autodidacta por niveles (0–4) con lecciones, comprobaciones guardadas en el navegador y autoevaluación |
| `desarrollo.html` | Documentación de desarrollo: arquitectura, algoritmos, estado, pruebas y cómo ampliar. La API se genera desde los módulos reales |
| `docs.css`, `docs.js` | Estilo y comportamiento comunes de las páginas de documentación (índice, tablas generadas) |
| `base.css` | Sistema de diseño compartido: tokens de color (claro/oscuro), cabecera, botones, controles |
| `app.css` | Estilos de la herramienta: mástil, notas, diagramas de acordes |
| `theme.js` | Tema Automático / Claro / Oscuro (compartido por todas las páginas) |
| `theory.js` | Teoría musical pura (sin DOM): ortografía, roles, acordes, catálogo, digitaciones, cajas CAGED |
| `synth.js` | Síntesis de cuerda pulsada (Karplus-Strong), pura y probada |
| `util.js`, `state.js` | Utilidades de DOM; modelo de estado (validación y persistencia en la URL) |
| `audio.js` | Salida de audio con Web Audio |
| `fretboard.js` | Dibujo del mástil, resaltado y navegación con teclado |
| `explorer.js` | Explorador de acordes y diagramas SVG |
| `app.js` | Orquestación: controles, escala, acordes diatónicos, pestañas, ajustes |
| `sw.js`, `manifest.webmanifest`, `icon*` | PWA y modo offline |
| `tests/` | Teoría, síntesis, contraste WCAG y pruebas e2e en Chrome headless |
| `original/index.html` | Versión inicial (línea base de referencia) |

## Pruebas

```bash
npm test          # teoría, síntesis, contraste WCAG, documentación y arquitectura
npm run test:e2e  # interfaz en Chrome headless (usa CHROME_PATH si Chrome no está en la ruta habitual)
npm run test:all
```

## Limitaciones conocidas

- Las cajas CAGED salen de ventanas de trastes fijas sobre la mayor "madre" de la escala. En las diatónicas cada caja completa tiene 2–3 notas por cuerda y ninguna nota queda sin caja. En las escalas con notas ajenas a esa mayor (menor armónica y melódica, frigio dominante…) cada nota alterada va en la caja de la nota que sustituye (G → G♯), un traste más arriba o abajo. Hay tests en las 12 tonalidades.
- Las notas de paso sin nota que sustituyan (la ♭5 del blues, algunas de la disminuida) se colocan por ventana de trastes, sin patrón propio.
- Cerca del traste 0 puede verse una caja recortada: es el final de la forma anterior, no un error.
- El audio es síntesis de cuerda pulsada, no samples de guitarra. Su afinación está verificada con tests; el timbre no se ha evaluado de oído.
- Las digitaciones del explorador las calcula un buscador (máx. 4 trastes de amplitud, máx. 4 dedos), no un catálogo curado. Con cejilla, se calculan desde la cejilla. Se puede elegir la nota del bajo (inversiones), pero no hay bajos ajenos al acorde (C/D, "slash" sobre otra nota).
