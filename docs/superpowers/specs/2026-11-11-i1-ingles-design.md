# I1 — El juego en inglés

Fecha: 2026-11-11
Estado: aprobado (el usuario pidió traducir al inglés; las decisiones, sin preguntar)

## 0. Para qué

Un juego solo en español tiene un mercado muy pequeño. Todos los textos ya están en un solo fichero
(`src/i18n/es.ts`, unas 2000 líneas, unas 300 frases con huecos escritas como funciones), así que
traducir es sobre todo escribir su pareja en inglés. Falta lo de alrededor: elegir el idioma y sacar
del código los pocos sitios con gramática española.

## 1. Elegir el idioma

- **Español** e **inglés**.
- La primera vez, el del navegador (español si empieza por `es`; si no, inglés). Se cambia con
  **ES · EN** arriba en la portada y en el panel Partida, y se recuerda en el navegador. Con
  `?lang=en` (o `es`) en la dirección, ese.
- Cambiar de idioma **recarga la página**; en plena partida, antes la guarda (y se sigue la guardada).
- La página dice su idioma (`<html lang>`).

## 2. Cómo está hecho

- `src/i18n/index.ts` elige los textos al cargar (`t`): todo el juego los toma de ahí en vez de
  importar el español directamente.
- `src/i18n/en.ts` tiene **la misma forma** que el español (el compilador lo comprueba: si falta
  algo o sobra, no compila).
- Lo que el código hacía en español pasa al fichero de idiomas: «una nevera» → «la nevera» (menú del
  clic derecho) y la coma de los decimales.
- Los nombres de los supervivientes se quedan como están (el pueblo es el mismo).
- Lo que solo ven los programadores (invariantes, errores internos, depuración) se queda en español.

## 3. Pruebas

- **Unitarias:** elegir el idioma (navegador, guardado, dirección); el inglés tiene todo y nada se
  queda en español (sin tildes, eñes ni ¿¡ en sus textos, probando cada frase con huecos de ejemplo);
  lo de la gramática (el artículo, los decimales) en los dos idiomas.
- **Navegador:** empezar en inglés desde la portada y jugar un rato sin errores; cambiar de idioma.
