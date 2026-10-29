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
- Las digitaciones del explorador de acordes se calculan con un buscador (bajo = fundamental, máx. 4 trastes de amplitud, máx. 4 dedos); no es un catálogo curado y la cejilla del ajuste del mástil no las afecta.
