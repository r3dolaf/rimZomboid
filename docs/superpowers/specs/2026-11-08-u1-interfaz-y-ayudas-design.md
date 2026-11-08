# U1 Interfaz: más clara, más accesible y con ayudas — diseño

Estado: el usuario pidió hacerlo sin interrupciones («arregla la interfaz para que sea mucho más
accesible, en móvil y en navegador; que sea mucho más jugable; añade ayudas al jugador nuevo»).
Parte del repaso hecho antes de M1–M3 y S1 y lo adapta a lo que hay en `main` tras ellos.

## Objetivo

Que alguien que no ha jugado nunca sepa qué hacer en los primeros minutos, y que cualquiera llegue a
todo con menos clics o toques, en el ordenador (ratón y teclado) y en el móvil (dedo).

Hoy:

- La ficha del colono enseña las Habilidades debajo de cualquier pestaña: su estilo tapa el
  `hidden`. En el móvil son 802 px de ficha en 281 de alto.
- Siete paneles en la barra (o en el ☰), mezclados con las herramientas y los ajustes.
- Las teclas solo se ven al pasar el ratón, y Almacén, Atuendos, Expediciones, Partida y Avisos no
  tienen. Escribir en un campo (el nombre de un atuendo) dispara atajos.
- Con una herramienta activa no se dice qué hacer con ella; en el móvil, quitarla es volver a tocar
  su icono.
- El juego se pausa solo con los avisos rojos y no se ve que está en pausa.
- El clic derecho (mantener pulsado, con el dedo) solo sirve en ventanas, puertas, muros y planos.
- No hay ninguna explicación del juego: ni objetivo, ni controles, ni qué es cada barra.
- Detalles: los filtros del registro con el estilo del navegador (blancos), el menú Construir repite
  «(tienes 0)» en cada opción, la portada con el «Choose File» del navegador.

## 1. Arreglos de base

- **`[hidden]` siempre esconde** dentro de la interfaz (`#hud [hidden] { display: none
!important }`): arregla la ficha y cualquier otro caso igual.
- **Foco visible** con el teclado (`:focus-visible`): un borde amarillo en botones, casillas y
  desplegables.
- **Los atajos no saltan escribiendo** en un campo de texto, número o desplegable.
- **Registro:** los filtros, detrás de un botón «Filtrar» en su cabecera (se recuerda si están a la
  vista; al principio no); con el estilo oscuro del juego (encendido y apagado).
- **Construir:** cada opción, «Cama · 6 🪵»; arriba, una vez, «Tienes 3 🪵». Lo que no se puede
  pagar ya, más apagado (se puede poner igual: el plano espera a la madera).

## 2. La barra de arriba

- **Herramientas:** con su icono y su nombre (🎒 Saquear, 🪓 Talar, 🔨 Construir); en el móvil,
  solo el icono en la columna (M2).
- **Paneles: de 7 a 5.** 📦 Almacén, 📋 Trabajos, 🧵 Fabricar, 🧭 Expediciones y 💾 Partida.
  Atuendos pasa a ser una pestaña de Trabajos y Avisos una de Partida (§3). En el ☰ caben de sobra
  con los 44 px de M3.
- **❓ Ayuda,** siempre a la vista, en la punta derecha (antes del ☰ cuando lo hay): abre la Ayuda
  (§8).
- **En pausa:** junto a las velocidades, «⏸ En pausa» en un letrero naranja; pulsarlo sigue
  (como Espacio).
- **Teclas:** cada botón dice la suya en la ayuda emergente; en el ☰, a la derecha (solo con
  ratón). Nuevas: I Almacén, E Expediciones, P Partida, H o ? Ayuda.

| Tecla        | Qué hace                                           |
| ------------ | -------------------------------------------------- |
| Espacio      | Pausa y sigue                                      |
| 1 2 3        | Velocidad                                          |
| L T B        | Saquear, Talar, Construir                          |
| I J F E P    | Almacén, Trabajos, Fabricar, Expediciones, Partida |
| R            | Modo combate                                       |
| M            | Sonido                                             |
| H o ?        | Ayuda                                              |
| Esc          | Cerrar lo de arriba                                |
| WASD/flechas | Mover la cámara                                    |

## 3. Paneles con pestañas

- Trabajos tiene dos pestañas, **Trabajos** y **Atuendos**; Partida, **Partida** y **Avisos**. Cada
  pestaña es el panel de antes, en el mismo sitio (Avisos pasa al sitio de Partida).
- El botón (y su tecla) abre el grupo en la última pestaña usada, o lo cierra.

## 4. Con una herramienta: qué hacer y «Hecho»

Abajo, encima de las tarjetas, un letrero con el icono, una línea de qué hacer (con «clic» o
«toca» según haya ratón o dedo) y un botón **Hecho** que la quita:

- 🎒 «Toca una casa o un mueble para saquearlo (otra vez, para dejarlo). Arrastra para marcar
  cuerpos.»
- 🪓 «Toca un árbol para talarlo, o arrastra para marcar varios.»
- 🔨 «Elige arriba qué construir y toca donde va. Los muros, arrastrando.»

En pantalla ancha, en el centro; en la mediana y la pequeña, a la derecha (no tapa el registro).

## 5. La ficha del colono: cuatro pestañas

- **General:** qué hace; ⚔️ Combate y Postura; sus barras con nombre y el color de la tarjeta (❤️
  Salud, 🩸 Sangre, 🍗 Hambre, 💤 Sueño, 💬 Social, 🙂 Ánimo), así se aprende qué es cada barra;
  ánimo y por qué; rasgos; relaciones.
- **Trabajos** (antes Habilidades): cada fila, el trabajo con su prioridad (el botón de antes) y su
  nivel con la barra de práctica. Pelear, sin prioridad.
- **Salud:** como ahora.
- **Equipo:** lo que lleva en la mano (y Fijar), lo que carga, la ropa y las bolsas (antes Ropa y
  Bolsas).

La pestaña guardada `bags` abre Equipo.

## 6. Tarjetas

La tarjeta dice a los lectores de pantalla su nombre y sus barras en una frase; cada barra mantiene
su ayuda. Lo demás, como ahora (la leyenda está en la ficha y en la Ayuda).

## 7. Clic derecho (mantener pulsado) en todo

Además de lo de ahora, el menú tiene, según lo que haya en esa casilla:

- **Un mueble o un cuerpo visto, con algo dentro:** 🎒 «Saquear» o «Dejar de saquear»; con un
  cuerpo, «Registrar» o «No registrar».
- **Una casa:** 🎒 «Saquear la casa» o «Dejar de saquear la casa», y 🏠 «Ver la casa» (su ficha).
- **Un árbol visto:** 🪓 «Talar» o «No talar».
- **La mesa:** 🧵 «Fabricar…» (abre el panel).

Así casi no hace falta cambiar de herramienta: las herramientas quedan para marcar muchas cosas
arrastrando. El modo combate sigue mandando primero (si hay elegidos en combate, es una orden).

## 8. Ayuda

Un panel ❓ (y en la portada, «❓ Cómo se juega») con pestañas:

- **Cómo se juega:** qué es el juego y lo que hay que vigilar: comida, sueño, saqueo, defensa y
  heridas, y que los colonos trabajan solos.
- **Controles:** primero los del aparato (dedo o ratón y teclado) y debajo los otros.
- **La pantalla:** la barra (cada icono), las tarjetas (cada barra con su color), el registro, los
  avisos y las pestañas de mapa.
- **Consejos:** una lista corta de cosas que conviene saber.
- Abajo: «Ver otra vez los primeros pasos» y «Mostrar consejos» (sí o no).

Abrirla en la partida la pausa; al cerrarla sigue a la velocidad de antes si la pausó ella.

## 9. Primeros pasos y consejos

Una tarjeta abajo a la derecha, encima de las tarjetas de colono, con **un solo paso** cada vez:
título, qué hacer y por qué, «paso 2 de 7», y «Ocultar». Se puede plegar a una línea. Con una
herramienta activa no se ve (está el letrero de §4).

Pasos (cada uno se da por hecho al hacerlo, en cualquier orden; se ve el primero sin hacer):

1. **Tu gente:** toca una tarjeta de abajo para ver su ficha. _Hecho:_ elegir a alguien.
2. **Comida:** marca una casa con 🎒 Saquear (o mantén pulsada la casa). _Hecho:_ algo marcado
   para saquear.
3. **Madera:** marca árboles con 🪓 Talar. _Hecho:_ algún árbol marcado, o madera en el almacén.
4. **Ventanas:** mantén pulsada (clic derecho) una ventana de la base y elige Tapiar. _Hecho:_ un
   plano de tapiar o una ventana tapiada.
5. **El tiempo:** ⏸ para pensar, x2 y x3 cuando todo va bien. _Hecho:_ cambiar la velocidad.
6. **Quién hace qué:** abre 📋 Trabajos. _Hecho:_ abrirlo.
7. **Una mesa:** pon una Mesa con 🔨 Construir; en ella se hacen vendas. _Hecho:_ un plano de mesa
   o una mesa.

Al acabar: «¡Ya sabes lo básico! Más en ❓ Ayuda», que se cierra sola al poco. Lo hecho se
recuerda en el navegador (no en la partida guardada): en la siguiente partida no vuelve a salir.

**Consejos:** en la misma tarjeta, y antes que el paso, una sola vez cada uno (se recuerda) y solo
si están activados:

| Cuándo                                     | Consejo                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Primer aviso que pausa                     | Los avisos rojos y las preguntas pausan el juego; para seguir, ▶ x1 o Espacio.                      |
| Primera vez que anochece                   | De noche llegan más zombis y la hoguera los atrae desde lejos: ventanas tapiadas y todos dentro.    |
| Primeros zombis a la vista                 | Pelean o huyen según su Postura; para mandarlos tú, ⚔️ Combate y clic derecho (mantener) adonde ir. |
| Primera herida que sangra                  | Se vendan solos si hay vendas (🩹); sin ellas se desangran: búscalas o hazlas en la mesa.           |
| Primer mordisco                            | Un mordisco no tiene cura; un arañazo a veces infecta y, a tiempo, los antibióticos lo curan.       |
| Poca comida (menos de una lata por colono) | Marca más casas para saquear: las latas están en cocinas y supermercados.                           |
| Ánimo muy bajo (menos de 20)               | Puede tener una crisis; en su ficha está por qué.                                                   |
| Primer asedio anunciado                    | Viene una horda: tapia, levanta muros y ten vendas.                                                 |

## 10. Portada

- Debajo del título, una línea: «Tus supervivientes trabajan solos: tú decides qué saquear, qué
  construir y quién hace qué.»
- «Para empezar» en Tranquilo y en Pocos zombis.
- «❓ Cómo se juega» abre la Ayuda.
- Importar, con un botón del juego («📂 Importar partida…») en vez del del navegador; también en
  Partida.

## 11. Cómo se hace

- `ui/panelGroup.ts`: une paneles en pestañas (sus banderas, la última abierta, el botón).
- `ui/toolHint.ts`: el letrero de la herramienta.
- `ui/help.ts`: el panel de Ayuda (textos en `es.help`).
- `ui/guide.ts`: los pasos y los consejos, puros (qué paso toca, qué consejo salta) y probados;
  `ui/coach.ts`: la tarjeta, con lo guardado en el navegador.
- `contextMenu.ts`: las opciones nuevas, con `onCraft` y `onHouse`.
- `sheet.ts`: las cuatro pestañas; `hud.ts`: 5 paneles, ❓ y «En pausa»; `keys.ts`: teclas nuevas y
  nada al escribir; `buildMenu.ts`, `logPanel.ts`, `startScreen.ts`, `saveStore.ts`.
- La simulación no cambia.

## 12. Pruebas

- Unidad: barra (5 paneles, ❓, «En pausa» y seguir, teclas en las ayudas); teclas nuevas y no al
  escribir; grupos de paneles; ficha (pestañas, prioridades en Trabajos, Equipo, `bags` → Equipo);
  menú contextual (saquear, casa, talar, mesa); letrero de herramienta y Hecho; guía (cada paso, el
  orden, lo guardado, consejos una vez y apagados); Ayuda (pestañas, pausa y sigue); Construir;
  registro con Filtrar; portada.
- Navegador: los de siempre, cambiando lo que se mueve; `e2e/help.spec.ts` en ordenador y en móvil
  (primeros pasos, Ayuda, letrero y Hecho, mantener pulsada una casa para saquearla).
