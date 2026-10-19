# rimZomboid — Hoja de ruta del prototipo

**Spec:** `docs/superpowers/specs/2026-10-19-rimzomboid-design.md`

El prototipo se construye en 6 hitos. Cada hito tiene su propio plan detallado,
que se escribe cuando el anterior está terminado, y cada uno deja el juego en un
estado que se puede probar o jugar.

| Hito                     | Qué se construye                                                                                                                                                             | Qué se puede ver al terminar                                                    | Secciones del spec                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **H1. Cimientos**        | Proyecto, simulación por ticks con semilla, mapa generado, caminos, 3 supervivientes que pasean, dibujado con Phaser, cámara, velocidad y pausa, publicación en GitHub Pages | Un enlace con un mapa aleatorio y 3 supervivientes moviéndose; pausa y x1/x2/x3 | 3, 5.1, 5.2 (reloj), 9 (barra superior y cámara), 10 |
| **H2. Personas**         | Hambre, sueño, ánimo con modificadores, rasgos, camas, comida del almacén, día y noche                                                                                       | Los supervivientes comen, duermen y cambian de ánimo; crisis de ánimo           | 4.1, 4.2, 5.2                                        |
| **H3. Saqueo**           | Objetos, contenedores, niebla de guerra, peso de carga, órdenes (cola), herramienta Saquear, prioridades, transportar, tarjetas, ficha y registro de sucesos                 | Marcas una casa y traen comida y vendas al almacén                              | 3 (órdenes), 5.1 (niebla), 5.3, 8.2, 8.3, 9          |
| **H4. Zombis**           | Zombis con visión y estados, ruido, puertas que se rompen, aparición por los bordes, noche más peligrosa, combate y modo combate                                             | Los zombis persiguen; los supervivientes pelean o huyen                         | 5.4, 6, 7, 8.1, 8.3                                  |
| **H5. Heridas y muerte** | Heridas por parte del cuerpo, sangre, vendas, infección, muerte, reanimación, fin de partida                                                                                 | Un mordisco acaba en zombi; la partida termina con el resumen                   | 4.3, 4.4, 9 (fin de partida)                         |
| **H6. Pulido**           | Modo depuración F3, partida automática de 30 días con todas las reglas, ajuste de `balance.ts`                                                                               | El prototipo cumple el criterio de éxito (spec §12)                             | 9 (F3), 10, 12                                       |
