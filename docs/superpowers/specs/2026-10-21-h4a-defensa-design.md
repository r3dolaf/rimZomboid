# rimZomboid — H4a Defensa y trabajos: diseño

Fecha: 2026-10-21
Estado: aprobado en conversación. El antiguo H4 se parte en dos: **H4a Defensa y trabajos** (este) y **H4b Zombis** (después). El usuario pidió implementar directamente.

## 1. Objetivo

Antes de que lleguen los zombis, la colonia puede prepararse: encontrar un hacha, talar árboles, acarrear madera y construir camas, mesas, hogueras, muros y puertas, y tapiar ventanas. Un panel de Trabajos permite decidir quién hace qué. Consolar pasa a ser un trabajo (Social).

**Criterio de éxito:** en una partida normal encuentras un hacha, talas, acarreas, construyes camas, mesa, hoguera, muros y puertas, y tapias ventanas. Desde el panel decides quién hace qué, y todo queda explicado en la ficha y en el registro.

**Queda para H4b:** zombis, puertas que se abren, se cierran y se rompen, ventanas que se rompen, reparar puertas, Salud y derribos, el trabajo Sanar, combate, Pelear/Huir/Decidir y modo combate.

## 2. Objetos, montones y equipo

### 2.1 Objetos nuevos

| Objeto     | Peso | Dónde se encuentra                                                                                                                                                                                                        |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Madera** | 1 kg | 40 en total en armarios y estanterías (no en neveras), repartidas como la comida: más en las casas lejanas. Al talar un árbol salen 4–6.                                                                                  |
| **Hacha**  | 2 kg | En cada mueble, una probabilidad de 0,05 × (0,5 + d), con `d` de 0 a 1 según la distancia a la base (como el bate). Si no sale ninguna, se pone una en un mueble al azar de la casa más lejana: siempre hay al menos una. |

La madera y el hacha se reparten al final de `createWorld`, después de todo lo anterior, para no cambiar partidas ya conocidas. Orden al coger cosas (`ITEM_KINDS`): comida, vendas, cuchillo, bate, hacha, madera.

### 2.2 Montones en el suelo

`World.piles: { id, pos, items }[]`: objetos tirados en una casilla transitable. Si ya hay un montón en esa casilla, se suma a él. Salen al talar y al quitar tablas (y en H5, al morir alguien). Los lleva al almacén quien tiene Transportar.

### 2.3 Equipo

`Survivor.equipped: 'axe' | null`: lo que lleva en la mano. No cuenta como carga ni se descarga en el almacén. Quien tiene Talar y no lleva hacha coge una del almacén si hay árboles marcados (va al almacén, la saca de `storage.items` y la equipa). En H4b irá aquí el arma.

## 3. Trabajos

### 3.1 Tipos y orden

`Survivor.work = { social, build, haul, chop, loot }` (booleanos). Por defecto, todo permitido; el **Cobarde** empieza sin `loot` ni `chop` (los dos son fuera de la base). Los recién llegados siguen la misma regla.

Cada colono, cuando no tiene nada urgente (comer, dormir, crisis), busca trabajo **en este orden de criticidad**, saltándose los que no tiene permitidos:

1. **Social:** consolar (H3b). Solo consuela quien tiene `social`.
2. **Saquear con hambre:** si quedan menos de 2 días de comida en total (`latas / (colonos · 70/60) < 2`), saquear sube aquí.
3. **Construir:** trabajar en un plano que ya tiene toda su madera.
4. **Transportar:** llevar a un plano la madera que le falta, o un montón al almacén.
5. **Talar.**
6. **Saquear** normal.

Antes de todo eso se mantienen las reglas de H3: quien lleva comida y el almacén no tiene, la lleva primero; y quien lleva cosas que ya no necesita para su trabajo, las descarga.

**Reservas:** dos colonos no van a la vez al mismo árbol, montón o plano (para acarrear o para construir). Se deduce de las acciones en curso, como el consuelo en H3b, para que nunca quede una reserva colgada.

**Negarse a trabajar** (H3, ánimo < 25) vale para todos los trabajos salvo Social.

### 3.2 Talar

- **Marcar:** herramienta Talar sobre árboles ya vistos (`World.chopMarks`, índices de casilla).
- **Trabajo:** si no lleva hacha y hay una en el almacén, va a por ella. Con hacha, va al árbol marcado más cercano (de los alcanzables), se pone en una casilla de al lado y tala **1 h** de juego.
- **Al terminar:** la casilla pasa a hierba (se abren paso y vista), se quita la marca y queda un montón de **4–6 maderas** en ella.

### 3.3 Transportar

- **A un plano:** si lleva madera, la entrega al plano que la necesite más cercano; si no, va al almacén, coge la que falte (lo que le quepa) y la lleva.
- **Al almacén:** va a un montón, recoge lo que le quepa y lo descarga en el almacén.
- Primero los planos (para que se pueda construir) y luego los montones.

## 4. Construir

### 4.1 Planos

- Herramienta **Construir**: se elige en un menú qué hacer y se hace clic donde va (los muros se pueden arrastrar en línea).
- Aparece un plano: `World.blueprints: { id, kind, pos, wood, progress }` (`wood`, madera entregada; `progress`, ticks trabajados).
- Los de Transportar le llevan madera; cuando la tiene toda, uno de Construir trabaja en él hasta terminar. Si lo dejan a medias (por comer, dormir…), el avance se guarda.
- **Cancelar:** clic en un plano con la herramienta lo quita; la madera que tuviera queda en un montón en su casilla (o al lado si no es transitable).

| Plano                | Madera | Tiempo | Dónde                                      | Resultado                                                                                                                                                |
| -------------------- | ------ | ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cama**             | 6      | 2 h    | Casilla libre de suelo, hierba o carretera | Cama para el primer colono que duerme en el suelo; si no hay, queda libre (`ownerId` nulo) y la ocupa el próximo que llegue antes que las camas de serie |
| **Mesa**             | 4      | 1,5 h  | Ídem                                       | Mueble. Quien termina de comer a 3 casillas o menos de una mesa recibe "Comió en la mesa" +3 (6 h)                                                       |
| **Hoguera**          | 3      | 30 min | Ídem                                       | Mueble. De noche (con oscuridad), a 4 casillas o menos: "Junto al fuego" +4 y se ve tan lejos como de día                                                |
| **Muro de madera**   | 2      | 1 h    | Ídem                                       | Casilla nueva **muro de madera**: no deja pasar ni ver                                                                                                   |
| **Puerta de madera** | 4      | 1,5 h  | Ídem                                       | Casilla **puerta** (como las de las casas): deja pasar a las personas y tapa la vista                                                                    |
| **Tapiar**           | 3      | 30 min | Una ventana                                | Casilla nueva **ventana tapiada**: no deja pasar ni ver                                                                                                  |
| **Quitar tablas**    | 0      | 15 min | Una ventana tapiada                        | Vuelve a ser ventana y deja 1 madera en un montón en la casilla del constructor                                                                          |

- **Casilla libre:** ya vista, sin mueble, cama, contenedor, almacén, montón ni otro plano.
- Los muebles se construyen de pie encima del plano; muros, puertas y ventanas, desde una casilla transitable de al lado.
- Un muro o una puerta no se termina mientras haya alguien encima de esa casilla: el constructor espera trabajando.
- Encerrarse con muros es decisión del jugador.

### 4.2 Muebles

`World.furniture: { id, kind: 'table' | 'campfire', pos }[]`. Son transitables (como los contenedores). Las camas siguen en `World.beds` (`ownerId: number | null`).

- **Junto al fuego** es un recuerdo corto (1 h) que se renueva mientras se cumpla; así no cambia cómo se calcula el ánimo.
- **La visión** de cada colono pasa a calcularse por separado: a 4 casillas o menos de una hoguera, de noche, usa el radio de día.

## 5. Pantalla

- **HUD:** "Madera: N" (la del almacén) y los botones **Saquear** (L), **Talar** (T), **Construir** (B, abre un menú) y **Trabajos** (J). Solo una herramienta activa a la vez; Esc la quita (y cierra el menú y el panel por capas).
- **Panel de Trabajos:** tabla con una fila por colono y una columna por trabajo en el orden de criticidad (Social, Construir, Transportar, Talar, Saquear). Cada casilla da su orden (`setWork`) y refleja al momento las órdenes pendientes. Se cierra con ✕ o Esc.
- **Ficha:** la casilla de Saquear pasa a ser una fila con los 5 trabajos; "En la mano: hacha" si la lleva; textos de las actividades nuevas ("Va a talar", "Talando", "Recogiendo madera", "Llevando madera a una cama", "Construyendo un muro"…).
- **Mapa:**
  - casillas nuevas: muro de madera y ventana tapiada;
  - el mapa se redibuja cuando cambia una casilla (`Grid.version`);
  - mesa, hoguera (que de noche ilumina un círculo), montones, planos (silueta con barras de madera y avance) y marcas de talar;
  - clic con Talar marca o desmarca un árbol, y arrastrar marca todos los árboles de un rectángulo; clic con Construir coloca el plano elegido (arrastrar, una línea de muros) o cancela uno.
- **Registro:** "X ha encontrado un hacha" (ya lo hace el saqueo), "X ha talado un árbol" no (sería ruido); sí "Se ha construido una cama" y similares.

## 6. Datos y sistemas

- Objetos `wood` y `axe`; casillas `Tile.WoodWall` y `Tile.BoardedWindow` (opacas, no transitables).
- `World.piles`, `World.blueprints`, `World.furniture`, `World.chopMarks`; `Survivor.equipped`; `Survivor.work` con 5 trabajos; `Bed.ownerId` nulo.
- Órdenes nuevas: `markTree { x, y, on }`, `placeBlueprint { kind, x, y }`, `cancelBlueprint { id }`; `setWork` con cualquier trabajo.
- Cada trabajo en su archivo (`jobs/chop.ts`, `jobs/haul.ts`, `jobs/build.ts`); `work.ts` los recorre en el orden de criticidad.
- Todas las cifras en `balance.ts` y todos los textos en `es.ts` (neutros de género).

## 7. Pruebas

- **Unitarias:**
  - cada trabajo y sus reservas;
  - cada construcción: sitio válido, coste, tiempo, efecto y cancelación;
  - el orden por criticidad, incluido el saqueo con hambre y Social;
  - el hacha (cogerla, equiparla);
  - los efectos de mesa y hoguera;
  - el reparto de madera y hacha.
- **Escenario:** marcar árboles → talar → llevar la madera → construir una cama → quien dormía en el suelo duerme en ella.
- **Partidas automáticas de 30 días** marcando árboles y planos al azar: nadie se bloquea, las invariantes se cumplen y **la madera cuadra** (almacén + montones + encima + planos + gastada = repartida + talada).
- **Navegador:** el panel de Trabajos cambia un permiso; la herramienta Construir pone un plano.
