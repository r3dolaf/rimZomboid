# H5c3 — El camino (diseño)

## Objetivo

Que viajar por el mundo tenga riesgo y sorpresas, y que la comida del viaje se piense. Por el camino
pasan cosas: unas se resuelven solas y salen en el registro, y otras piden una decisión, como las de
la base. El grupo comparte la comida que lleva. El panel Expediciones propone cuánta llevar.

Lo aprobado por el usuario:

- La mayoría de los sucesos se resuelven solos; algunos piden decisión (B).
- Sucesos: zombis sueltos, horda (decisión), botín abandonado, alguien que pide unirse (decisión),
  tormenta y buscar comida. Los saqueadores quedan para más adelante.
- Comida: se comparte en el grupo y el panel propone la que hace falta (B).
- Frecuencia: más o menos un suceso por día de viaje, según el terreno y el narrador (B).
- Por dentro: una tirada al entrar en cada hexágono (1).

Sobre H5c2 (spec `2026-10-30-h5c2-mapa-mundo-design.md`) y H5c1 (`2026-10-30-h5c1-expediciones-design.md`).

## 1. Cuándo pasa algo

- **Tirada:** de día, al entrar en un hexágono, la probabilidad de suceso es
  `ROAD_EVENT_PER_HOUR × horas de ese hexágono × narrador`.
  - `ROAD_EVENT_PER_HOUR` = 1/14: de media, uno por día de viaje (14 horas de luz).
  - Narrador: Tranquilo ×0,6, Equilibrado ×1, Caótico ×1,5.
- **Respiro:** tras un suceso, ese viaje no tiene otro hasta pasadas `ROAD_EVENT_GAP` (3) horas.
- **Qué toca:** se elige según el hexágono en que entran, con estos pesos:

  | Terreno            | Zombis | Horda | Botín | Alguien | Comida |
  | ------------------ | ------ | ----- | ----- | ------- | ------ |
  | Campo              | 3      | 1     | 2     | 1       | 3      |
  | Bosque             | 5      | 1     | 1     | 1       | 3      |
  | Colinas            | 3      | 1     | 1     | 1       | 1      |
  | Carretera o puente | 2      | 2     | 4     | 2       | 0      |

  Junto a un pueblo (a 1 hexágono o menos): Zombis +3 y Horda +1.

- No toca «Alguien» si la colonia ya está llena (8, contando a todos) o si ese viaje ya espera una
  respuesta. Tampoco toca «Horda» mientras ese viaje espera una respuesta.
- Vale para todos los viajes: ir, volver y explorar. Todo usa el azar de las expediciones.

## 2. Los sucesos

- **Zombis sueltos** (de 2 a 5):
  - Cada uno del grupo puede salir herido. El riesgo sube con los zombis por persona y baja con la
    habilidad de pelea y con un arma.
  - Herida: 70 % arañazo, 30 % mordisco, en una parte al azar.
  - Quien pelea gana práctica de pelea.
  - Registro: «Ana y Luis se cruzan con 3 zombis en el bosque: Luis se lleva un arañazo».
- **Horda** (decisión):
  - El grupo se para ante el hexágono siguiente y espera la respuesta. Sigue comiendo y durmiendo.
  - **Rodear:** rehacen la ruta sin pasar por ese hexágono ni sus vecinos. Si así no hay camino, la
    atraviesan.
  - **Atravesar:** como los zombis sueltos, pero con 6 a 10 zombis.
  - Si nadie contesta en `ROAD_DECISION_HOURS` (2) horas, rodean.
- **Botín abandonado:**
  - En la carretera es un coche; fuera de ella, una casa.
  - De 1 a 3 cosas: comida (peso 4), vendas (2), tela (2), analgésicos (1) y un arma (1).
  - Se lo lleva quien tenga sitio; lo que no cabe se queda.
- **Alguien pide unirse** (decisión):
  - Una persona nueva, como el desconocido de la base, con su ropa y lo que lleve. Espera junto al
    grupo, que no se para.
  - **Aceptar:** se une al grupo y viaja con ellos. Si la colonia ya está llena, se va.
  - **Rechazar:** se va con lo suyo.
  - Si nadie contesta en `ROAD_DECISION_HOURS`, se va.
- **Tormenta:** mientras dura la tormenta de siempre (`stormUntil`), ningún grupo avanza; esperan a
  cubierto.
- **Buscar comida:** encuentran 1 o 2 latas, que se lleva quien tenga sitio.

## 3. La comida del viaje

- **Compartir:** si alguien tiene hambre y no le queda comida, come de lo que lleve el compañero que
  tenga más.
- **Cuánta hace falta:** `tripFood(horas de ruta, idaYVuelta)` da las latas por persona.
  - Días = horas de ruta / 14, redondeado hacia arriba (de noche no se avanza pero se come).
  - Latas = días × `HUNGER_PER_DAY` / `EAT_RESTORE`, redondeado hacia arriba (×2 si es ida y vuelta),
    más `TRIP_FOOD_MARGIN` (1).
- **Panel Expediciones** (desde la base):
  - Con destino y gente elegidos, la lista lleva esa comida para todos, hasta lo que haya en el
    almacén.
  - Debajo dice «Para este viaje (unas N h de camino, M días): unas X latas por persona».
  - Si el jugador cambia la comida con + y −, ya no se recalcula; vuelve a recalcularse al elegir
    otro destino.
  - Si la lista lleva menos de lo que hace falta: «Os falta comida para el viaje».
- **Explorar:** cada uno coge `tripFood` de ida y vuelta (como mínimo 1 lata, como antes).
- **Desde un sitio:** como antes, cargan lo que pueden del campamento, con la comida primero.

## 4. Pantalla

- **Registro:** cada suceso, con los nombres del grupo y el terreno. Filtros: Combate (zombis,
  horda), Saqueo (botín, comida) y Colonia (alguien se une o se va).
- **Avisos:** zombis con heridos, horda y alguien que pide unirse. Se pueden apagar en Avisos.
- **Decisiones:** la horda y quien pide unirse salen como las de la base, con sus botones. La de
  unirse dice quién es, sus rasgos y lo que lleva.
- **Mapa del mundo:**
  - Un grupo que espera una respuesta lleva «❗».
  - Su ficha dice «Esperando: una horda delante» o «Alguien quiere unirse», con los botones de la
    decisión.
  - En tormenta, la ficha dice «Esperando a que pase la tormenta».

## 5. Pruebas y equilibrio

- **Tests:**
  - la tirada según el terreno, el narrador y el respiro;
  - cada suceso por separado;
  - las decisiones contestadas y sin contestar;
  - compartir comida y `tripFood`;
  - la lista propuesta en el panel y el aviso de falta;
  - la ficha del grupo que espera.
- **Invariantes:** el viaje que espera tiene su decisión; quien pide unirse no está en otro sitio;
  la ropa y las cosas cuadran (lo que se encuentra entra en las cuentas; lo que se va con quien no se
  une, sale).
- **Partida larga** con sucesos del camino, contestando las decisiones.
- **Navegador:** una horda en el camino, contestada desde la ficha del grupo.
- **Sonda de equilibrio:** con y sin expediciones, como en H5c2. Las cifras se ajustan si hace falta
  y se apuntan aquí (§6) y en la hoja de ruta.
