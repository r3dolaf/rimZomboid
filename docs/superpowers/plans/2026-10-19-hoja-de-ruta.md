# rimZomboid — Hoja de ruta del prototipo

**Spec:** `docs/superpowers/specs/2026-10-19-rimzomboid-design.md`

El prototipo se construye en 6 hitos. Cada hito tiene su propio plan detallado,
que se escribe cuando el anterior está terminado, y cada uno deja el juego en un
estado que se puede probar o jugar.

| Hito                     | Qué se construye                                                                                                                                                             | Qué se puede ver al terminar                                                    | Secciones del spec                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **H1. Cimientos**        | Proyecto, simulación por ticks con semilla, mapa generado, caminos, 3 supervivientes que pasean, dibujado con Phaser, cámara, velocidad y pausa, publicación en GitHub Pages | Un enlace con un mapa aleatorio y 3 supervivientes moviéndose; pausa y x1/x2/x3 | 3, 5.1, 5.2 (reloj), 9 (barra superior y cámara), 10 |
| **H2. Personas**         | Hambre, sueño, ánimo con modificadores, rasgos, camas, comida del almacén, día y noche, **tarjetas y ficha** (adelantadas de H3)                                             | Los supervivientes comen, duermen y cambian de ánimo; crisis de ánimo           | 4.1, 4.2, 5.2                                        |
| **H3. Saqueo**           | Objetos, contenedores, niebla de guerra, peso de carga, órdenes (cola), herramienta Saquear, prioridades y registro de sucesos (Transportar → H5)                            | Marcas una casa y traen comida y vendas al almacén                              | 3 (órdenes), 5.1 (niebla), 5.3, 8.2, 8.3, 9          |
| **H4. Zombis**           | Zombis con visión y estados, ruido, puertas que se rompen, aparición por los bordes, noche más peligrosa, combate y modo combate                                             | Los zombis persiguen; los supervivientes pelean o huyen                         | 5.4, 6, 7, 8.1, 8.3                                  |
| **H5. Heridas y muerte** | Heridas por parte del cuerpo, sangre, vendas, infección, muerte, reanimación, fin de partida                                                                                 | Un mordisco acaba en zombi; la partida termina con el resumen                   | 4.3, 4.4, 9 (fin de partida)                         |
| **H6. Pulido**           | Modo depuración F3, partida automática de 30 días con todas las reglas, ajuste de `balance.ts`                                                                               | El prototipo cumple el criterio de éxito (spec §12)                             | 9 (F3), 10, 12                                       |

## Pendientes

Hallazgos menores de las revisiones finales, aplazados. Se tienen en cuenta al planificar el hito indicado.

**Hechos en H2:** frontera de `src/sim/` en ESLint, `MS_PER_TICK` derivado de `TICKS_PER_SECOND`, `⏸` en `es.ts`, `togglePause` sin `this`, `Math.sqrt` en vez de `Math.hypot`, y en CI `prettier --check` y `cancel-in-progress` solo en pull requests.

**Hechos en H3:** A\* con regiones conectadas y búferes reutilizados, espera de "sin camino" en todas las acciones, comida inicial a 10 latas, darse la vuelta con el almacén vacío.

**Para H4 (zombis):**

- **Visión simétrica y sin fugas por esquinas.** El shadowcasting deja ver entre dos casillas opacas que se tocan en diagonal y por esquinas junto a ventanas. Además, no es simétrico: A ve a B pero B no ve a A en ~5 % de los pares cerca de casas. Con zombis que usan la misma visión, conviene una variante simétrica o una regla que bloquee las esquinas, con tests de ventanas y huecos en diagonal.
- **Contenedores sin registrar.** `canTakeSomething` mira lo que hay dentro aunque nadie lo haya registrado. Mejor: un contenedor sin registrar merece el viaje solo si cabe al menos el objeto más ligero.
- **Invariante de reservas.** Ahora solo comprueba que el dueño de la reserva exista. Debería comprobar también que va hacia ese contenedor y que quien va hacia un contenedor lo tiene reservado.
- **Botín perdido.** Si una casa no tuviera contenedores, su parte del botín se perdería sin aviso; hoy no puede pasar.

**Para H5 (muertes):**

- Las tarjetas se crean una vez al empezar; habrá que quitar las de los muertos.
- La invariante "cada cama tiene un dueño vivo" y `goSleep`, que lanza un error si falta la cama, tendrán que contemplar las muertes.
- Probar el desplome en plena crisis de principio a fin.

**Para H6 (pulido):**

- **Esc por capas.** Ahora Esc cierra a la vez la herramienta, la ficha del superviviente y la de la casa; mejor cerrar solo la de más arriba.
- **Contenedores en la ficha de la casa.** "Registrados: N de M" cuenta también contenedores que no se han visto.
- **Test del navegador.** El de saqueo comprueba el mundo; mejor que compruebe la ficha de la casa.

- `cards.ts` reescribe la clase de las barras en cada fotograma.
- El color de los motivos del ánimo en la ficha se deduce del texto (`−`), en vez de usar el signo del valor.
- Los Dormilones pasan unas 12 h en la cama (se acuestan hacia las 18 h). Revisar al ajustar el equilibrio.
- Plan H1: sus versiones de Tech Stack no coinciden con `package.json`; las válidas son las de `package.json`.
