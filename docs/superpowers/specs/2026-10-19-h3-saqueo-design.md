# rimZomboid — H3 Saqueo: diseño

Fecha: 2026-10-19
Estado: aprobado en conversación. Complementa el diseño general (`2026-10-19-rimzomboid-design.md`, §3, §5.1, §5.3, §8 y §9) y el de H2.

## 1. Objetivo

El jugador marca casas o contenedores para saquear y los supervivientes, por su cuenta, salen a explorar, registran los contenedores y traen comida y vendas al almacén. Solo se ve lo que ven los supervivientes. Un registro de sucesos cuenta lo que pasa.

## 2. Decisiones de esta fase

| Tema          | Decisión                                                                           |
| ------------- | ---------------------------------------------------------------------------------- |
| Niebla        | Línea de visión casilla a casilla ya en H3 (se reutilizará para los zombis en H4). |
| Comida total  | Unos 25 días: 10 latas en el almacén y unas 80 repartidas por las casas.           |
| Peligro fuera | Ninguno hasta H4.                                                                  |
| Transportar   | Pasa a H5: en H3 nada deja objetos en el suelo.                                    |
| Armas         | Se encuentran y se guardan; equiparlas llega en H4.                                |
| Vendas        | Se encuentran y se guardan; usarlas llega en H5.                                   |

## 3. Objetos y carga

| Objeto (`ItemKind`) | Peso   |
| ------------------- | ------ |
| `food` (lata)       | 0,5 kg |
| `bandage` (venda)   | 0,1 kg |
| `knife` (cuchillo)  | 0,5 kg |
| `bat` (bate)        | 1,5 kg |

- Un **inventario** es un recuento por tipo de objeto: `Record<ItemKind, number>`. Lo usan el almacén, los contenedores y la carga de cada superviviente.
- **Carga máxima:** 8 kg por superviviente.
- **Al coger de un contenedor** se toma en este orden hasta llenarse: comida, vendas, cuchillo y bate.
- El almacén guarda todo. La barra superior muestra "Comida: N · Vendas: N".

## 4. Contenedores y botín

- **Ubicación:** cada casa tiene de 2 a 5 contenedores (nevera, armario o estantería), sobre casillas de suelo pegadas a una pared exterior o interior. Nunca junto a la puerta ni en el hueco del muro interior. Son transitables.
- **Contenedor:** `{ id, houseId, pos, kind, items, searched, designated, reservedBy }`.
- **Reparto de la comida:** el total de las casas son `LOOT_FOOD_TOTAL = 80` latas. Cada casa recibe una parte proporcional a `1 + 2·d`, donde `d` es su distancia a la base normalizada entre 0 y 1. Dentro de la casa, cada lata va a un contenedor al azar.
- **Vendas:** `LOOT_BANDAGE_TOTAL = 15`, repartidas igual que la comida.
- **Armas:** cada contenedor tiene un `8 %·(0,5 + d)` de probabilidad de cuchillo y un `6 %·(0,5 + d)` de bate.
- Se genera al crear el mundo, después de los supervivientes, para no cambiar las partidas de H2 con la misma semilla.
- **Comida inicial del almacén:** 10 latas.

## 5. Visión y niebla

- **Radio de visión:** 12 casillas de día y 6 de noche, con transición siguiendo la oscuridad: `radio = round(12 − 6·oscuridad)`. La oscuridad (0–1, de 19 a 21 h y de 05 a 07 h) pasa de la capa de render a `clock.ts`.
- **Opacos:** muro, árbol y puerta. Las ventanas son **transparentes**.
- **Algoritmo:** _shadowcasting_ recursivo por octantes, con distancia euclídea.
- **Casillas vistas:** `World.seen: number[]` (0/1 por casilla) guarda las vistas alguna vez. Se actualiza cada 5 ticks y al crear el mundo.
- **Qué se ve ahora:** se calcula al vuelo con `visibleTiles(world)`; no se guarda.
- **Cómo se pinta:**
  - **nunca vista:** negro;
  - **vista antes pero no ahora:** penumbra (oscurecida al 55 %);
  - **visible:** normal.
- Los contenedores solo se dibujan en casillas vistas.

## 6. Órdenes

- **`World.orders: Order[]`.** La interfaz solo añade órdenes con `issue(world, order)`. El sistema de órdenes las aplica al principio del tick y vacía la cola.
- **Tipos:**
  - `{ type: 'designateHouse', houseId, on }`: marca o desmarca todos los contenedores de la casa que no estén vacíos. Se puede usar sin haberla visto.
  - `{ type: 'designateContainer', containerId, on }`: solo se puede usar con un contenedor ya visto, y la interfaz lo comprueba.
  - `{ type: 'setWork', survivorId, work: 'loot', enabled }`.
- **Prioridades:** `Survivor.work = { loot: boolean }`. Por defecto `true`; el Cobarde empieza en `false`.

## 7. Saquear

**Prioridad del `AiBrain`:** urgencias (comer, dormir) → crisis → **trabajo** → pasear.

**Trabajo (si `work.loot`):**

1. Si lleva algo y está lleno, o lleva algo y no hay contenedor disponible: ir al almacén y **descargar** (20 ticks: todo lo que lleva pasa al almacén).
2. Si no, elegir el contenedor disponible más cercano en línea recta y alcanzable, reservarlo, ir y **registrar**.
   - **Disponible:** marcado, no vacío y sin reserva de otro.
3. **Registrar** dura 30 ticks. Al terminar:
   - el contenedor queda `searched`;
   - se coge lo que quepa;
   - si se vacía, se desmarca;
   - se libera la reserva.

**Reglas generales:**

- **Reservas:** después de cada tick se limpian las reservas cuyo superviviente ya no va hacia ese contenedor ni lo está registrando. Una urgencia interrumpe el trabajo; lo que lleva se queda encima.
- **Al límite** (ánimo < 25): al ir a empezar un trabajo, 50 % de negarse. Se queda esperando 1 h y, mientras, solo atiende urgencias.
- **Cobarde:** modificador de ánimo "Asustado fuera" −10 mientras está fuera de la base.

## 8. Registro de sucesos

- **`World.log`:** `{ tick, kind, ... }[]`. Son datos, sin texto; la interfaz los traduce. Guarda como máximo 100 entradas.
- **Tipos:**
  - `found {survivorId, houseId, items}`
  - `emptyContainer {survivorId, houseId}`
  - `houseEmptied {houseId}`
  - `refused {survivorId}`
  - `crisis {survivorId}`
  - `vented {survivorId}`
  - `collapsed {survivorId}`
  - `outOfFood`
- **Panel:** abajo a la izquierda, encima de las tarjetas. Muestra las últimas entradas, con desplazamiento hasta 100.

## 9. Interfaz

- **Barra superior:** botón **Saquear** (o tecla **L**) para activar el modo marcar; **Esc** o volver a pulsar lo desactiva.
- **En modo marcar:**
  - clic en una casa: marca o desmarca la casa;
  - clic en un contenedor visto: marca o desmarca ese contenedor.
- **Mapa:**
  - casas con contenedores marcados: borde naranja;
  - contenedores marcados: marca naranja encima.
- **Ficha del superviviente**, se añade:
  - "Lleva: …" con el peso / 8 kg;
  - la casilla "Saquear";
  - nuevas actividades: "Va a saquear la casa N", "Registrando una nevera", "Llevando cosas al almacén", "Se niega a trabajar", "No puede llegar".
- **Ficha de la casa:** clic en una casa vista, sin la herramienta, la abre y cierra la del superviviente. Muestra:
  - número de la casa;
  - si está marcada;
  - contenedores registrados, por registrar y vacíos.
- **Modo depuración:** con `?debug=1`, `window.rimzomboid = { world, tileToScreen }` para los tests de navegador.

## 10. Pendientes de H2 incluidos

- **A\*:**
  - **regiones conectadas** precalculadas por cuadrícula: si el origen y el destino están en regiones distintas, `null` al momento;
  - búferes reutilizados con un sello por búsqueda;
  - función para invalidar las regiones si cambia el mapa.
- **"Sin camino":** la espera `NO_PATH_RETRY_TICKS` se respeta en todas las acciones. Durante esa espera no se consulta al cerebro.
- **Almacén vacío:** quien va a comer se da la vuelta si la comida llega a 0, y quien está comiendo lo deja.

## 11. Pruebas

- **Unitarias:**
  - pesos y carga;
  - reparto del botín (≈80 latas, más lejos, determinista);
  - órdenes;
  - reservas;
  - visión (muros, árboles y puertas opacos, ventanas transparentes, radio de día y de noche, casillas vistas);
  - negarse a trabajar (~50 %);
  - Cobarde fuera;
  - regiones del A\*.
- **Escenarios:**
  - marcar la casa más cercana: en 1 día sube la comida del almacén y la casa queda vaciada;
  - dos casas y tres supervivientes: nunca coinciden dos en un contenedor;
  - una casa sin ver se descubre al llegar.
- **Partida automática de 30 días:**
  - la actual;
  - otra con todas las casas marcadas al empezar: el mapa se vacía, nadie supera 8 kg, ningún recuento es negativo y las reservas son válidas.
- **Navegador:**
  - al empezar hay casillas sin ver;
  - el botón Saquear entra y sale del modo;
  - marcar una casa la deja marcada en su ficha.

## 12. Criterio de éxito

- Marcas casas y los supervivientes exploran, registran y traen comida y vendas.
- La niebla muestra solo lo visto.
- El registro cuenta lo que pasa.
- El Cobarde no saquea salvo que se lo permitas.
- Todos los tests, las dos partidas automáticas y los tests de navegador pasan.
