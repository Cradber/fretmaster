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
| `theory.js` | Teoría musical pura (sin DOM): ortografía de notas, roles, acordes, catálogo de acordes y buscador de digitaciones, posiciones CAGED |
| `synth.js` | Síntesis de cuerda pulsada (Karplus-Strong), pura y probada |
| `app.js` | Interfaz, audio (Web Audio), teclado y estado en URL/localStorage |
| `styles.css` | Estilos y temas claro/oscuro |
| `sw.js`, `manifest.webmanifest`, `icon*` | PWA y modo offline |
| `tests/theory.test.js`, `tests/synth.test.js` | Pruebas de la teoría y del sintetizador |
| `original/index.html` | Versión inicial (línea base de referencia) |

## Pruebas

```bash
node tests/theory.test.js && node tests/synth.test.js
```

## Limitaciones conocidas

- Las cajas CAGED salen de ventanas de trastes fijas sobre la mayor "madre". En escalas diatónicas cada caja completa tiene 2–3 notas por cuerda y ninguna nota queda sin caja (hay un test para las 12 tonalidades). En escalas con notas alteradas (armónica, melódica, blues…) se muestran las notas de la escala dentro de esa ventana, sin dibujar un patrón propio.
- Cerca de la cejilla de la guitarra (traste 0) puede verse una caja recortada: es el final de la forma anterior, no un error.
- El audio es síntesis de cuerda pulsada, no samples de guitarra. Su afinación está verificada con tests; el timbre no se ha evaluado de oído.
- Las digitaciones del explorador las calcula un buscador (bajo = fundamental, máx. 4 trastes de amplitud, máx. 4 dedos), no un catálogo curado. Con cejilla, se calculan desde la cejilla.
- No hay inversiones ni acordes con bajo distinto de la fundamental (tipo C/E).
