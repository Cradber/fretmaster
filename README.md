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
| `theory.js` | Teoría musical pura (sin DOM): ortografía de notas, roles, acordes, posiciones CAGED |
| `app.js` | Interfaz, audio (Web Audio), teclado y estado en URL/localStorage |
| `styles.css` | Estilos y temas claro/oscuro |
| `sw.js`, `manifest.webmanifest`, `icon*` | PWA y modo offline |
| `tests/theory.test.js` | Pruebas de la teoría |
| `original/index.html` | Versión inicial (línea base de referencia) |

## Pruebas

```bash
node tests/theory.test.js
```

## Limitaciones conocidas

- Las formas CAGED son ventanas de trastes aproximadas, no los patrones completos de 7 notas por cuerda.
- El audio es sintetizado, no samples de guitarra.
