# rimZomboid — Hoja de ruta del prototipo

**Spec:** `docs/superpowers/specs/2026-10-19-rimzomboid-design.md`

El prototipo se construye en 6 hitos, más H3b (Relaciones) y H3c (Narrador), que se añadieron entre H3 y H4. H4 se partió en tres: H4a (Defensa y trabajos), H4b (Zombis) y H4c (Hordas y mando), donde las hordas serán sucesos del narrador. Cada hito tiene su propio plan detallado,
que se escribe cuando el anterior está terminado, y cada uno deja el juego en un
estado que se puede probar o jugar.

| Hito                        | Qué se construye                                                                                                                                                                                                                                                                                                                                  | Qué se puede ver al terminar                                                            | Secciones del spec                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **H1. Cimientos**           | Proyecto, simulación por ticks con semilla, mapa generado, caminos, 3 supervivientes que pasean, dibujado con Phaser, cámara, velocidad y pausa, publicación en GitHub Pages                                                                                                                                                                      | Un enlace con un mapa aleatorio y 3 supervivientes moviéndose; pausa y x1/x2/x3         | 3, 5.1, 5.2 (reloj), 9 (barra superior y cámara), 10 |
| **H2. Personas**            | Hambre, sueño, ánimo con modificadores, rasgos, camas, comida del almacén, día y noche, **tarjetas y ficha** (adelantadas de H3)                                                                                                                                                                                                                  | Los supervivientes comen, duermen y cambian de ánimo; crisis de ánimo                   | 4.1, 4.2, 5.2                                        |
| **H3. Saqueo**              | Objetos, contenedores, niebla de guerra, peso de carga, órdenes (cola), herramienta Saquear, prioridades y registro de sucesos (Transportar → H4a)                                                                                                                                                                                                | Marcas una casa y traen comida y vendas al almacén                                      | 3 (órdenes), 5.1 (niebla), 5.3, 8.2, 8.3, 9          |
| **H3b. Relaciones**         | Opinión, charlas y necesidad social, peleas, consuelo, compartir comida, parejas y recién llegados que se aceptan o rechazan (spec `2026-10-20-h3b-relaciones-design.md`)                                                                                                                                                                         | Se forman amistades, rivalidades y parejas; llegan desconocidos a la puerta             | 4.1 (relaciones), nuevos supervivientes              |
| **H3c. Narrador**           | Narrador con tres estilos (Tranquilo, Equilibrado, Caótico), 12 sucesos sociales y sin peligro, decisiones del jugador, avisos y portada (spec `2026-10-20-h3c-narrador-design.md`)                                                                                                                                                               | Rachas de calma y tensión; robos, celos, cumpleaños, gripe, tormentas…                  | nuevo (narrador)                                     |
| **H4a. Defensa y trabajos** | Madera y hacha, talar, transportar, construir (cama, mesa, hoguera, muro, puerta, tapiar), Social como trabajo, panel de Trabajos (spec `2026-10-21-h4a-defensa-design.md`)                                                                                                                                                                       | Talas, acarreas y construyes; decides quién hace qué                                    | nuevo (trabajos y construcción)                      |
| **H4b. Zombis**             | Zombis con cerebro (vagar en grupo, alerta y contagio, perseguir, rastro, aburrirse), vista, ruido (también talar, construir y la hoguera), aparición según narrador y opción de la portada, romper (ventanas, puertas, muros) y Reparar, Salud y derribos, combate y armas, Pelear/Huir/Decidir, avisos (spec `2026-10-21-h4b-zombis-design.md`) | Los zombis persiguen; los colonos pelean o huyen, caen y se levantan; se repara lo roto | 5.4, 6, 7, 8.1, 8.3                                  |
| **H4c. Hordas y mando**     | Hordas del narrador (asedio y errantes), modo combate (R) con varios colonos, trabajo Sanar (rescatar y vendar), menú de Avisos, zombis contra los desconocidos                                                                                                                                                                                   | Asedios a la base; manejas tú la defensa                                                | 8.3 (modo combate)                                   |
| **H5. Heridas y muerte**    | Heridas por parte del cuerpo, sangre, vendas, infección, muerte, reanimación, fin de partida                                                                                                                                                                                                                                                      | Un mordisco acaba en zombi; la partida termina con el resumen                           | 4.3, 4.4, 9 (fin de partida)                         |
| **H6. Pulido**              | Modo depuración F3, partida automática de 30 días con todas las reglas, prioridades de trabajo (1–4, como RimWorld), ajuste de `balance.ts`                                                                                                                                                                                                       | El prototipo cumple el criterio de éxito (spec §12)                                     | 9 (F3), 10, 12                                       |

## Pendientes

Hallazgos menores de las revisiones finales, aplazados. Se tienen en cuenta al planificar el hito indicado.

**Hechos en H2:** frontera de `src/sim/` en ESLint, `MS_PER_TICK` derivado de `TICKS_PER_SECOND`, `⏸` en `es.ts`, `togglePause` sin `this`, `Math.sqrt` en vez de `Math.hypot`, y en CI `prettier --check` y `cancel-in-progress` solo en pull requests.

**Hechos en H3:** A\* con regiones conectadas y búferes reutilizados, espera de "sin camino" en todas las acciones, comida inicial a 10 latas, darse la vuelta con el almacén vacío.

**Hechos tras la revisión de H3:**

- Visión simétrica (shadowcasting de Ford) y sin ver por huecos diagonales.
- Contenedores sin registrar valorados por el hueco libre, no por lo que tienen dentro.
- Invariante de reservas estricta.
- Botín sin pérdidas si una casa no tuviera contenedores.
- Esc por capas.
- La ficha de la casa cuenta solo contenedores vistos.
- El test del navegador comprueba la ficha de la casa.

**Hechos en H3b:** tarjetas que se crean y se quitan según quién está en la colonia; `goSleep` sin cama (duerme en el suelo de la base) y `bedId` nulo en las invariantes.

**Para H5 (muertes):**

- La invariante "cada cama tiene un dueño vivo" tendrá que contemplar las muertes (liberar la cama o borrarla), igual que las parejas (la pareja de un muerto) y las acciones de dos (pelea, consuelo).
- Probar el desplome en plena crisis de principio a fin.

**Pedido por el usuario (después de H4b, antes de H4c si así lo quiere):** habilidades de los colonos en cada trabajo, que hagan las tareas más rápido o más lento y puedan fallar las complejas (construir). Pendiente de diseño. Ya estaba en la lista de "después" del spec general (§11, n.º 5).

**Para H6 (pulido), de H4b:**

- Equilibrio de zombis: ya se empieza con un cuchillo cada uno, hay unas 10 armas por mapa y las ventanas aguantan 60 (tapiadas, 180). Así, en Equilibrado/normal y sin construir nada, los colonos pasan en el suelo cerca de un 9 % del tiempo los 3 primeros días (12 semillas; antes, un 31 %). Lo que queda: en algunas semillas un grupo de unos 12 zombis entra en una base sin muros, y quien se levanta con 15 de Salud vuelve a caer en cuanto vuelven.
- La partida larga de zombis prueba 3 combinaciones de narrador y opción, no las 9.

**Para H6 (pulido):**

- H4a: quien se queda con madera que ya no necesita (le cancelan el plano) se la lleva de saqueo en vez de descargarla; la mesa solo da gusto si está a 3 casillas del almacén (donde se come); talar a medias no guarda el avance; quien queda encerrado sin camino al almacén se queda quieto esperando en vez de pasear por su lado; arrastrar un mueble lo pone donde se empezó el arrastre.

- Narrador: en partidas largas se acaban los sucesos buenos y mixtos (cumpleaños uno por colono, desconocidos hasta 8, noche de historias solo de 19 a 23 h) y las fases de calma se quedan casi vacías. Añadir uno o dos sucesos buenos que se repitan y una partida automática de más de 30 días.
- Las partidas automáticas contestan cada decisión al momento: la caducidad y la gripe "sin decidir" solo las prueban los tests unitarios.

- Relaciones en colonias de 6–8: con el olvido del 10 % diario y las charlas repartidas entre más gente, casi todas las opiniones quedan neutras; quien llega tarde no pasa de +20 y nadie le consuela, y las peleas casi no salen en partidas normales. Ajustar el olvido o la frecuencia de charla según el tamaño de la colonia.
- Un desconocido rechazado puede volver más tarde con el mismo nombre (solo se evitan los de los colonos actuales).
- Si el consuelo de alguien en crisis se corta (el que consuela se desploma), vuelve a entrar en crisis desde cero y el registro lo dice dos veces.
- `cards.ts` reescribe la clase de las barras en cada fotograma.
- El color de los motivos del ánimo en la ficha se deduce del texto (`−`), en vez de usar el signo del valor.
- Los Dormilones pasan unas 12 h en la cama (se acuestan hacia las 18 h). Revisar al ajustar el equilibrio.
- Plan H1: sus versiones de Tech Stack no coinciden con `package.json`; las válidas son las de `package.json`.
