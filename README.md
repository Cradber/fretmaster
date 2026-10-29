# FretMaster

Explorador de escalas, modos, formas CAGED, acordes y digitaciones para guitarra. Sin dependencias ni paso de compilación; funciona sin conexión y no envía datos a ningún servidor.

## Qué incluye

- **Herramienta** (`index.html`): 15 escalas en 12 tonalidades, formas CAGED, acordes de la escala y un explorador de 22 tipos de acorde con digitaciones calculadas, inversiones y cejilla. Afinaciones alternativas, 22 o 24 trastes, modo zurdo, sonido y tema Automático / Claro / Oscuro.
- **Aprender** (`aprender.html`): ruta autodidacta por niveles, con lecciones, práctica, autoevaluación y progreso guardado en el navegador.
- **Ayuda** (`ayuda.html`): descripción rigurosa del contenido musical y de cómo se calcula.
- **Desarrollo** (`desarrollo.html`): arquitectura, algoritmos, pruebas y cómo ampliar.

Las tablas y los ejemplos de las páginas de documentación se generan o se verifican contra el código, de modo que no pueden contradecir a la aplicación.

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

La lista completa, con ejemplos, está en la sección «Límites y alcance» de `ayuda.html`. En resumen:

- **Cajas CAGED**: ventanas de trastes fijas sobre la mayor "madre", medidas para la afinación estándar. En las diatónicas cada caja completa tiene 2–3 notas por cuerda (2 en las pentatónicas, hasta 4 en la disminuida) y ninguna nota queda sin caja; las notas alteradas (G → G♯) van en la caja de la nota que sustituyen. Se desplazan con la afinación (en «medio tono abajo», un traste más arriba); en las afinaciones abiertas no existen formas CAGED y la app lo avisa.
- **Digitaciones**: las calcula un buscador (hasta el traste 15, máx. 4 trastes de amplitud y 4 dedos), no un catálogo curado. Quedan fuera las formas con cuerdas mudas intercaladas (drop 3, shell), las de tres cuerdas salvo el power chord y las que necesitan una cejilla que no está en el traste más bajo (C9 x32333). No hay bajos ajenos al acorde (C/D).
- **Catálogo**: 22 tipos de acorde (sin 7♭9, 7♯9, 6/9, 11, 13) y 15 escalas (sin disminuida S–T, alterada, lidio dominante ni mayor armónica).
- **Escuchar escala** toca una octava en un registro fijo, sin seguir la forma elegida.
- **Audio**: síntesis de cuerda pulsada; afinación verificada con tests, timbre no evaluado de oído. En Safari e iOS **no está verificado en dispositivos reales** (hay un diagnóstico en Ajustes).
