# M3 Móvil: detalles de móvil — diseño

## Objetivo

Lo que falta para que jugar en el móvil sea cómodo y no se pierda nada: botones que se acierten con
el dedo, nada debajo del notch, la partida guardada aunque el móvil cierre la pestaña, poder
instalarlo y jugar a pantalla completa, y saber cómo va de rápido.

## 1. Botones para el dedo

Solo con pantalla táctil (`pointer: coarse`); con ratón, como ahora.

- **Barra y columna de herramientas:** 44 px de alto (lo que pide Apple); las herramientas, 44 × 44.
  La barra pasa de 39 a unos 52 px.
- **Menú ☰:** cada línea, 44 px.
- **Cerrar (×)** de cada panel: 40 × 40.
- **El resto de botones y desplegables:** al menos 36 px de alto; las casillas, de 22 px. En los
  paneles llenos (Trabajos, Fabricar, Atuendos) 44 px no caben en 390 de alto sin esconder casi todo.

## 2. El notch

- La página usa toda la pantalla (`viewport-fit=cover`): el mapa llega a los bordes.
- La barra, la columna de herramientas, las tarjetas, el registro, las pestañas, los avisos, el
  menú ☰ y los paneles se apartan lo que diga el móvil (`env(safe-area-inset-*)`): del notch a los
  lados y de la raya de abajo. Sin notch, como ahora.

## 3. Guardar al salir de la pestaña

- Cuando la pestaña se esconde (otra app, se apaga la pantalla, se cierra), se guarda la partida:
  el móvil cierra las pestañas en segundo plano sin avisar y si no se perdería lo jugado desde la
  mañana.
- Solo si esta partida ya es la guardada (se cargó, o ya se guardó sola o a mano): una partida
  nueva no pisa la guardada antes de su primera mañana (H6b §2). Y no si la colonia ha caído.
- Sin aviso (nadie lo vería).

## 4. Instalable y a pantalla completa

- **Manifiesto** (`manifest.webmanifest`): nombre, iconos, a pantalla completa y en horizontal;
  fondo y barra del color del juego. En Android sale «Instalar»/«Añadir a pantalla de inicio»; en
  iPhone, «Añadir a pantalla de inicio» (con su icono y sin la barra del navegador).
- **Icono:** una cabeza de zombi de píxeles hecha a mano letra a letra, como el arte del juego, en
  192, 512 y 180 px (iPhone); también de icono de la pestaña (antes, ninguno). Lo genera
  `scripts/app-icons.mjs` (sin dependencias).
- **«⛶ Pantalla completa»** en el menú ☰ (y «Salir de pantalla completa»), solo si el navegador
  deja (en iPhone no: allí, desde la pantalla de inicio). Al entrar, intenta fijar el horizontal.
- Sin modo sin conexión: necesita internet la primera vez y tras cada versión nueva, como ahora.

## 5. Otros detalles

- **Sin zoom de la página** con dos dedos fuera del mapa (en la barra o en un panel), que lo dejaba
  todo descolocado; se sigue pudiendo desplazar los paneles (`touch-action: pan-x pan-y`).
- **Sin «tirar para recargar»** (`overscroll-behavior: none`): en Android, bajar el dedo en un
  panel ya arriba recargaba la página.
- **En vertical**, en un móvil, un aviso: «Se juega mejor en horizontal: gira el móvil», con
  «Seguir así», que no vuelve a salir en esa visita. En una tableta en vertical, no.

## 6. Rendimiento

Medido en Chromium a 844 × 390, con la versión publicada (sin las comprobaciones de desarrollo) y la
CPU frenada 4 y 6 veces (como un móvil de gama media y uno modesto). Semilla 5; «día 4» es tras
saltar 3 días con la depuración (3 colonos y 76 zombis en el mapa).

| CPU     | Dónde y velocidad | Ticks por segundo | Por tick | JavaScript por fotograma | Fotogramas por segundo |
| ------- | ----------------- | ----------------- | -------- | ------------------------ | ---------------------- |
| Normal  | Base, día 1, x1   | 10                | 0,4 ms   | 1,0 ms                   | 60                     |
| Normal  | Base, día 4, x3   | 30                | 0,4 ms   | 1,1 ms                   | 60                     |
| 4 veces | Base, día 1, x1   | 10                | 1,4 ms   | 4,0 ms                   | ~50                    |
| 4 veces | Base, día 4, x3   | 31                | 1,7 ms   | 4,6 ms                   | ~47                    |
| 4 veces | Mundo, x3         | 31                | 1,7 ms   | 2,4 ms                   | 60                     |
| 6 veces | Base, día 1, x1   | 10                | 2,9 ms   | 6,6 ms                   | ~40                    |
| 6 veces | Base, día 4, x3   | 30                | 3,4 ms   | 9,1 ms                   | ~30                    |
| 6 veces | Mundo, x3         | 31                | 2,8 ms   | 4,8 ms                   | ~50                    |

- **La simulación va sobrada:** siempre hace sus 10 o 30 ticks por segundo, a menos de 3,5 ms cada
  uno.
- **Lo que baja los fotogramas no es el juego, es pintar:** el JavaScript de un fotograma (con los
  ticks) es de 1 a 9 ms; el resto del hilo principal (de 11 a 29 ms) es dibujo nativo, y aquí se
  dibuja **por software** (SwiftShader: no hay GPU). Un móvil dibuja con su GPU, así que esa parte
  no se puede medir aquí y estas cifras de fotogramas son pesimistas.
- El lienzo se pinta a la resolución de la página (no a la de la pantalla, que en un móvil es 2 o 3
  veces más fina): con píxeles grandes, sin coste de más.
- No se cambia nada: no hay un coste del juego que quitar sin cambiar cómo se ve.
- **Para medir en un móvil de verdad:** con `?debug=1` en la dirección, el menú ☰ tiene
  «🐞 Depuración» (el F3 del ordenador), con los fotogramas por segundo y los milisegundos por tick.

## 7. Cómo se hace

- `index.html`: `viewport-fit=cover`, manifiesto, iconos, `theme-color` y lo de Apple.
- `public/`: el manifiesto y los iconos (Vite los copia tal cual).
- CSS: `@media (pointer: coarse)` para los tamaños; `env(safe-area-inset-*)` con 0 por defecto.
- `autosave.ts`: `leave()` guarda si la partida es la guardada (`saved()` lo apunta al guardar a
  mano) y no ha terminado; `main.ts` lo llama en `visibilitychange` y `pagehide`.
- `src/ui/fullscreen.ts`: si se puede, entrar y salir; el menú ☰ cambia su texto al cambiar.
- `src/ui/rotateHint.ts`: el aviso de girar.
- `hud.ts`: «🐞 Depuración» en el menú ☰ si la dirección lleva `?debug=1`.

## 8. Pruebas

- `autosave.test.ts`: `leave()` no guarda una partida nueva antes de su primera mañana; sí tras
  guardarse sola o a mano, o si se cargó; nunca con la colonia caída.
- `fullscreen.test.ts`: sin permiso del navegador no sale; entrar, salir y el texto.
- `rotateHint.test.ts`: en vertical sale; en horizontal o con «Seguir así», no.
- `e2e/mobile.spec.ts`: con el dedo, los botones de la barra miden al menos 44 px; con un notch
  simulado (47 px a los lados y 21 abajo) nada queda debajo; al esconder la pestaña la partida
  cargada se guarda; el manifiesto se sirve con sus iconos; en vertical sale el aviso de girar y se
  quita; con `?debug=1`, la depuración desde el ☰. En el ordenador, nada de esto cambia.
