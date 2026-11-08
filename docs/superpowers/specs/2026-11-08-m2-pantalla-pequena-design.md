# M2 Móvil: interfaz en pantalla pequeña — diseño

## Objetivo

Que en un móvil en horizontal (unos 670–930 × 375–430 px) y en una tableta se llegue a todo y
quede mapa a la vista. Con M1 ya se maneja con los dedos; lo que falla es el sitio.

Hoy, a 844 × 390:

- la barra de arriba mide 1177 px: Trabajos, Fabricar, Atuendos, Expediciones, Partida y Avisos
  quedan fuera de la pantalla y no hay forma de llegar a ellos;
- «Sucesos» y las tarjetas tapan casi la mitad de abajo;
- Expediciones, Fabricar, Atuendos y Avisos se cortan por abajo o quedan detrás de las tarjetas;
- la portada (y la pantalla final) se corta por arriba: el título y lo primero no se pueden ver;
- el Almacén sale con otra letra (no tiene la suya; pasa en todas las pantallas).

En una tableta (1024 × 768) la barra tampoco cabe.

## 1. Tres tamaños

| Pantalla                                                  | Barra de arriba                                                         | Lo demás        |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | --------------- |
| **Ancha** (desde 1200 px)                                 | Como ahora                                                              | Como ahora      |
| **Mediana** (800–1199 px)                                 | Los paneles, en un menú «☰»                                            | Como ahora      |
| **Pequeña** (menos de 800 de ancho o 500 de alto o menos) | Además, las herramientas en una columna a la derecha, solo con su icono | Compacto: §3–§6 |

Una tableta en horizontal usa la mediana; un móvil en horizontal, la pequeña. Un móvil en vertical
también usa la pequeña (no se busca, pero así se puede usar).

## 2. La barra de arriba

- **Siempre en la barra:** hora, velocidades, comida, vendas, analgésicos, madera, zombis a la vista
  y tormenta.
- **Paneles** (📦 Almacén, 📋 Trabajos, 🧵 Fabricar, 👕 Atuendos, 🧭 Expediciones, 🔔 Avisos,
  💾 Partida): en la mediana y la pequeña, en un menú «☰» en la punta derecha de la barra, uno
  debajo de otro con su icono y su nombre. Elegir uno lo abre (o lo cierra, como su botón) y cierra
  el menú; tocar fuera o Esc también lo cierran. En la ancha, como ahora (en este orden).
- **Herramientas** (🎒 Saquear, 🪓 Talar, 🔨 Construir): en la pequeña, en una columna junto al
  borde derecho, bajo la barra, solo con el icono. La activa, naranja como ahora. El nombre sigue en
  la ayuda y para los lectores de pantalla.
- El letrero del asedio, centrado bajo la barra, como ahora.

## 3. Pestañas de mapa y avisos

En la pequeña, las pestañas de mapa (Base, 🌍 Mundo…) van arriba a la izquierda, bajo la barra (en
el centro las taparían los paneles), y los avisos debajo de ellas, de hasta 300 px o el 45 % del
ancho, hasta encima del registro.

## 4. Registro («Sucesos»)

- En la pequeña empieza plegado (solo su cabecera), salvo que el jugador lo haya desplegado antes:
  se recuerda, como ahora.
- Desplegado: hasta la mitad del ancho y el 40 % del alto.

## 5. Tarjetas

En la pequeña, más pequeñas: 116 px de ancho, el nombre en una línea y las barras más finas (3 px en
vez de 6). Llevan lo mismo: retrato, iconos, todas las barras y dónde está.

## 6. Paneles

En la pequeña, cada panel sale como una hoja pegada a un borde, justo debajo de la barra y, como
mucho, hasta encima de las tarjetas (que siguen a la vista para cambiar de colono), con su propio
scroll y por encima del registro:

- **A la derecha, hasta 400 px de ancho:** ficha del colono, del grupo, de la casa y de la cama;
  la ficha del hexágono (mundo); Almacén, Fabricar, Atuendos, Expediciones, Avisos y Partida.
- **Todo el ancho:** Trabajos (la tabla; si no cabe, se desplaza de lado).
- **A la izquierda, hasta 320 px o la mitad del ancho:** el menú de Construir, para que el mapa y la
  columna de herramientas queden libres mientras se pone.
- La depuración (F3), como está: es para el ordenador.

En los avisos con tres o cuatro respuestas (la fiebre), los botones van de dos en dos: en 300 px no
cabían (tampoco en el ordenador). Los avisos van por encima de los paneles.

La altura de la barra y la de las tarjetas se miden en la página (cambian con el tamaño de letra y
con «dónde está» en las tarjetas) y los paneles se colocan con ellas.

El registro plegado ya no enseña sus filtros (su estilo tapaba el `hidden`; pasaba en todas las
pantallas).

## 7. Portada y pantalla final

Si no caben, se desplazan desde arriba (hoy se centran y lo de arriba queda fuera).

## 8. Cómo se hace

- `src/ui/screen.ts`: las consultas de tamaño (`SMALL_SCREEN`, `MENU_SCREEN`) y `screenIs(q)`
  (falso sin `matchMedia`, como en los tests); `trackHeight(el, nombre)` pone la altura de un
  elemento en una variable de CSS y la sigue con `ResizeObserver`.
- `hud.ts`: la barra en grupos (herramientas y paneles), el botón «☰» con su menú (sus propios
  botones, que llaman a lo mismo) y `closeMenu()` para Esc. Cada botón lleva su icono en
  `data-icon`, que se pinta con CSS: el texto del botón no cambia.
- `logPanel.ts`: plegado al empezar en la pequeña si no hay nada guardado.
- `main.ts`: Esc cierra el menú; `--bar-h` y `--cards-h` con `trackHeight`.
- CSS: todo con `@media` en `hud.css`, `panels.css` y `start.css`; en la ancha no cambia nada.

## 9. Pruebas

- `hud.test.ts`: el menú «☰» se abre y se cierra (con el botón, al elegir un panel, con
  `closeMenu`); sus botones abren lo mismo que los de la barra; cada botón con su icono.
- `logPanel.test.ts`: en la pequeña empieza plegado; lo guardado manda.
- `screen.test.ts`: `screenIs` sin `matchMedia`; `trackHeight`.
- `e2e/mobile.spec.ts`, a 844 × 390: nada se sale de la pantalla de lado; la barra cabe; cada panel
  del menú se abre, queda dentro de la pantalla, entre la barra y las tarjetas, y se cierra con su
  ×; las herramientas en su columna funcionan; el registro empieza plegado; la portada se ve
  entera desde arriba. A 1024 × 768: el menú «☰» y las herramientas con su nombre en la barra.
- Los tests de navegador de siempre (1280 × 720, la ancha) no cambian.
