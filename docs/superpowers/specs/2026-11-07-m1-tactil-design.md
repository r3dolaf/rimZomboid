# M1 Móvil: controles táctiles — diseño

## Objetivo

Que el juego se pueda manejar con los dedos, en un móvil en horizontal o en una tableta, sin perder
nada de lo que se hace con el ratón. El ratón y el teclado siguen igual.

Hoy, con el dedo no se puede mover la cámara (va con el botón derecho o WASD) ni acercarla (con la
rueda), y no hay clic derecho (órdenes del modo combate y menú contextual) ni Mayús (elegir a
varios).

## Móvil, por pasos

| Paso                                 | Qué se hace                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1. Controles táctiles**           | Este: gestos en el mapa y en el mapa del mundo, tarjetas y menú contextual con el dedo                                                                                                        |
| **M2. Interfaz en pantalla pequeña** | La barra de arriba no cabe (mide 1177 px; un móvil en horizontal, unos 750): herramientas y paneles en iconos o en un menú; «Sucesos» plegado; tarjetas más pequeñas; paneles a todo el ancho |
| **M3. Detalles de móvil**            | Botones de al menos 44 px; respetar el notch; guardar al salir de la pestaña (el móvil las cierra sin avisar); instalable a pantalla completa; medir el rendimiento en un móvil               |

El objetivo es el móvil en horizontal y la tableta. En vertical cabe muy poco mapa; no se busca.

## 1. Gestos en el mapa

| Gesto                            | Sin herramienta                                                           | Con Saquear, Talar o Construir               | Con el ratón                 |
| -------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------- |
| **Tocar**                        | Elige al colono; si no, abre la mesa, la cama o la casa; si no, nadie     | Marca o desmarca la casilla, o pone el plano | Clic izquierdo               |
| **Arrastrar un dedo**            | Mueve la cámara                                                           | Marca el rectángulo o la línea               | Arrastrar con el izquierdo   |
| **Mantener pulsado y soltar**    | Orden del modo combate o menú contextual                                  | Igual                                        | Clic derecho                 |
| **Mantener pulsado y arrastrar** | Rectángulo para elegir a varios                                           | Como arrastrar                               | Arrastrar con el izquierdo   |
| **Dos dedos**                    | Pellizcar acerca y aleja alrededor de los dedos; moverlos mueve la cámara | Igual                                        | Rueda y arrastrar el derecho |

- **Mantener** es dejar el dedo quieto 0,45 s. Entonces sale un aro donde está el dedo y, si el
  móvil puede, vibra un poco.
- **Quieto** es moverse menos de 10 px (el ratón, 6 px: el dedo tiembla más).
- **Un segundo dedo** a mitad de un gesto de uno lo anula (no se marca ni se elige nada) y empieza
  el pellizco. Al levantar un dedo del pellizco, el otro ya no hace nada hasta que se levanten los
  dos (si no, al terminar de pellizcar se elegiría o se marcaría algo sin querer).
- **Tocar a un colono** es más fácil que con el ratón: el radio para cogerlo es de al menos 22 px en
  pantalla (con el ratón, 0,6 casillas; a zoom 2 son unos 19 px).
- **Construir:** la silueta del plano se ve mientras el dedo está puesto; al levantarlo, desaparece
  (con el dedo no hay «encima»).

## 2. Gestos en el mapa del mundo

- **Tocar:** la ficha del grupo que viaja, o la del hexágono.
- **Arrastrar un dedo:** mueve la cámara; si empieza en un punto de la ruta planeada (no en sus
  extremos), lo lleva adonde se suelte, como con el ratón.
- **Mantener pulsado:** sobre una parada de la ruta, la quita (el clic derecho); en otro sitio, como
  tocar.
- **Dos dedos:** pellizcar, como en el mapa.

## 3. Fuera del mapa

- **Tarjetas:** mantener pulsada una tarjeta añade o quita a ese colono de los elegidos (Mayús y
  clic). Tocarla, como hacer clic.
- **Menú contextual:** se cierra al tocar fuera (antes, solo con un clic del ratón).
- **El navegador** no hace sus gestos sobre el mapa (desplazar la página, su zoom). En el resto, no
  acerca con dos toques seguidos, que en los botones de velocidad molesta.
- **Sin teclado** se puede hacer todo menos F3 (depuración): pausa, velocidades, herramientas y
  paneles tienen botón; el modo combate está en la ficha y en el panel de grupo; lo que cierra Esc
  tiene «Cerrar», la herramienta se quita con su botón y tocar el suelo deja de elegir.

## 4. Cómo se hace

- `src/game/gestures.ts`, sin Phaser y con pruebas: `createGestures` recibe los dedos que se ponen,
  se mueven y se levantan (con su número y la hora) y dice qué gesto es: `tap`, `hold` (el aro),
  `longPress`, `dragStart`/`drag`/`dragEnd` (con `held` si empezó manteniendo), `pinch` (punto medio
  de antes y de ahora y cuánto ha cambiado la distancia) y `cancel`. Además:
  - `zoomAround`: dónde queda la cámara al pellizcar, para que lo que había bajo los dedos siga bajo
    los dedos;
  - `fingerRadius`: el radio para coger a un colono con el dedo, en casillas.
- `GameScene` y `WorldScene`: los punteros de dedo (`wasTouch`) van a los gestos; los del ratón,
  como siempre. Lo que hacía cada clic se saca a funciones que usan los dos (tocar o clic izquierdo,
  mantener o clic derecho, elegir en un rectángulo, ir arrastrando y soltar).
- `main.ts`: Phaser atiende a dos dedos (`input.activePointers: 2`).
- `cards.ts`: mantener pulsada una tarjeta, con los eventos de puntero, solo con el dedo.
- `contextMenu.ts`: se cierra con `pointerdown` (vale para ratón y dedo), no con `mousedown`.
- `index.html`: `touch-action: none` en el mapa y `manipulation` en la página.

## 5. Pruebas

- `gestures.test.ts`: tocar; mantener (con la hora, al pasar el fotograma o al moverse); arrastrar;
  mantener y arrastrar; el temblor del dedo no es arrastrar; pellizcar (acercar, alejar, mover);
  segundo dedo a mitad de un gesto; levantar un dedo del pellizco; un dedo que no es el del gesto;
  `zoomAround` deja el punto bajo los dedos; `fingerRadius`.
- `cards.test.ts`: mantener pulsada una tarjeta la añade y la vuelve a quitar; el clic que llega
  después no hace nada; con el ratón no pasa nada al mantener.
- `contextMenu.test.ts`: tocar fuera lo cierra.
- `e2e/touch.spec.ts`, en un móvil en horizontal (844 × 390, con pantalla táctil y varios dedos):
  tocar a un colono abre su ficha; arrastrar mueve la cámara; pellizcar acerca; mantener y arrastrar
  sobre la base elige a todos; con ellos en modo combate, mantener pulsado los manda allí; mantener
  pulsada una tarjeta añade a ese colono; en el mapa del mundo, pellizcar acerca y tocar un
  hexágono abre su ficha.
- Los tests de navegador de siempre, con ratón, siguen pasando.
