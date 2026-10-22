# rimZomboid — H4e Hordas y mando: diseño

Fecha: 2026-10-22
Estado: aprobado en conversación, por partes. El usuario pidió escribirlo e implementarlo directamente ("Sí e implementa directamente"). Viene de H4b, que dejó para este hito las hordas, el modo combate, Sanar, el menú de Avisos y los zombis contra los desconocidos (spec H4b §1). Se hace después de H4f (Pueblo).

## 1. Objetivo

Llegan las crisis grandes y, con ellas, las herramientas para manejarlas. El narrador manda **hordas**: un **asedio** avisado con días de antelación que se empeña en la base, y **errantes** que cruzan el mapa. El jugador puede tomar el **mando** de uno o varios colonos (**modo combate**, tecla R), los colonos **rescatan y vendan** a los heridos (trabajo **Sanar**), los zombis también van a por los **desconocidos** y un **menú de Avisos** deja elegir qué interrumpe.

**Criterio de éxito.** En una partida normal:

- llega un asedio con 2–3 días de aviso y una cuenta atrás;
- se defiende la puerta con varios colonos en modo combate;
- los derribados se rescatan a una cama y los heridos se vendan;
- los zombis atacan a los desconocidos, que pelean o huyen;
- el jugador decide qué avisos aparecen y cuáles pausan.

**Sigue sin haber muerte** (H5): el derribado se levanta solo.

**Fuera de H4e:**

- heridas por parte del cuerpo, sangre, infección y muerte (H5); en H5 las vendas pasarán a cortar la sangre;
- no registrar cuerpos con zombis a la vista (hoja de ruta, para H6).

## 2. Hordas

### 2.1 Datos

- `Zombie.hordeId: number | null`: la horda de la que salió (se queda aunque la horda termine).
- `World.hordes: Horde[]` y `World.nextHordeId`:
  ```ts
  interface Horde {
    id: number;
    kind: 'siege' | 'wander';
    /** Adonde van: la base (asedio) o un punto del borde contrario (errantes). */
    goal: Point;
    /** Asedio: hasta cuándo se empeña en la base. */
    until?: number;
    /** Ya no manda en sus zombis (acabó el asedio o los errantes salieron del mapa). */
    done: boolean;
    /** Errantes: ya se ha avisado de que se han visto. */
    seen?: boolean;
  }
  ```
- `World.siege: { at: number; side: Side; size: number } | null`: el asedio anunciado que aún no ha llegado. `Side` = 0 norte (y = 0), 1 sur, 2 oeste (x = 0), 3 este, como en las llegadas por los bordes.
- Una horda terminada (`done`) se borra de la lista cuando ya no queda ningún zombi suyo.

### 2.2 Asedio (suceso `siege`)

- **Tono malo, dureza 3, espera 6 días.** Se puede dar desde el **día 6** si no hay otro asedio anunciado (`w.siege`) ni en marcha (horda `siege` sin terminar).
- **Al salir** (con el azar del mundo, como todos los sucesos):
  - llegará dentro de **48–72 h**;
  - por un lado al azar;
  - con `size` = un número de `SIEGE_SIZE[narrador]` (10–15 / 15–25 / 25–35) + 1 por cada 2 días de partida (`floor(día / 2)`), × `ZOMBIE_LEVEL_MULT` (pocos 0,5, normal 1, muchos 1,25), redondeado;
  - registro y aviso rojo que pausa: "Se acerca una horda: llegará en unas N horas, por el norte" (N redondeado; "unos 2 días" si son 48 h o más).
- **Cuenta atrás** en la barra de arriba: "Horda en 1 d 14 h" (o "Horda en 5 h"). Mientras dura el asedio: "Asedio: quedan 18 h".
- **Llegada** (`w.tick ≥ siege.at`), con `zombieRng`:
  - aparecen `size` zombis juntos en ese borde: en casillas que pisan, a 0–3 de profundidad del borde y a ±12 de un punto central sorteado;
  - van alertados hacia la base;
  - la horda dura hasta `until = llegada + 1 día`;
  - registro y aviso rojo que pausa: "¡La horda ha llegado!" (al pulsarlo, la cámara va al punto central).
- **Empeñados en la base** (mientras `tick < until`): un zombi del asedio que no persigue a nadie no vaga ni se aburre: va a una casilla al azar del suelo de la base (rompiendo lo que haga falta). Si llega, elige otra. Se acercan por **tramos** de hasta 25 casillas hacia su destino (así cada búsqueda de camino es corta); cada tramo acaba fuera de los edificios, para no ir rompiendo casas por el pueblo.
- **Fin:**
  - al llegar `until`, la horda termina. Registro y aviso: "La horda se dispersa" (no pausa);
  - también termina así si pasan **2 h sin ningún colono en pie** (`SIEGE_GIVE_UP_HOURS`; se añadió en la revisión final: sin defensas, los colonos se levantaban entre los zombis y volvían a caer una y otra vez);
  - al terminar, la horda **se va por donde vino**: pasa a comportarse como unos errantes, con destino en un punto de su borde de llegada, y sus zombis salen del mapa al llegar (también se añadió en la revisión: si se quedaban rondando la base, seguían derribando a quien se levantaba). No hay aviso de horda errante;
  - si antes se matan todos los zombis del asedio, la horda termina con aviso verde: "Habéis resistido el asedio".
- **Mientras dura el asedio no llegan zombis sueltos** por los bordes (el reloj de llegadas sigue corriendo).
- **Mientras haya asedio anunciado o en marcha, no llegan desconocidos.**

### 2.3 Errantes (suceso `wanderers`)

- **Tono malo, dureza 2, espera 3 días.** Desde el **día 3**.
- **Al salir:** `size` = 8–15 × `ZOMBIE_LEVEL_MULT`, redondeado. Aparecen juntos en un borde al azar (como el asedio) y su destino es un punto que pisan del **borde contrario**, enfrente. No hay aviso al salir.
- **Qué hacen:** si no persiguen a nadie, van hacia su destino por tramos (como el asedio). Si ven u oyen a alguien, hacen lo de cualquier zombi. Al perderlo, siguen su camino.
- **Al llegar al destino** (a 1 casilla o menos), el zombi sale del mapa (se quita). Cuando no queda ninguno, la horda se borra.
- **Aviso:** la primera vez que un colono ve a uno, "Una horda errante cruza el mapa" (no pausa; al pulsarlo, la cámara va al zombi). Se comprueba cada 10 ticks.

### 2.4 El tope de zombis

- Las hordas pueden pasar del tope (`ZOMBIE_MAX`). Las llegadas por los bordes siguen sin pasar de él: mientras haya tantos zombis como el tope o más, no llega ninguno suelto.
- Invariante: los zombis **que no son de ninguna horda** no pasan del tope.

## 3. Modo combate

### 3.1 En la simulación

- `Survivor.drafted: boolean` (sale en `false`).
- **Órdenes nuevas:**
  - `{ type: 'draft'; survivorIds: number[]; on: boolean }`: pone o quita el modo combate. No se puede a quien está derribado ni a quien está en crisis. Al ponerlo, deja lo que hacía (se despierta si dormía) y se queda quieto. Si hacía algo de dos (pelear, consolar o ser consolado), al otro también se le corta. Al quitarlo, vuelve a lo suyo;
  - `{ type: 'draftMove'; survivorIds; x; y }`: cada uno (de los que están en modo combate) va **andando** a una casilla libre distinta alrededor del punto: la más cercana que se pisa y que no ha cogido otro (búsqueda en anchura desde el punto);
  - `{ type: 'draftAttack'; survivorIds; zombieId }`: todos van **corriendo** a por ese zombi (el `melee` de siempre). Cuando muere, se quedan donde están;
  - `{ type: 'draftRescue'; survivorId; downedId }`: lo rescata (§4.2), aunque haya zombis cerca.
- **El cerebro**, para quien está en modo combate:
  - no huye, no trabaja, no come y no duerme por su cuenta; su postura no cuenta;
  - si un zombi está al alcance de su brazo y no está haciendo otra cosa (quieto o llegando), le golpea **sin moverse**: un `melee` con `hold: true`, que, si el zombi se aleja, no le persigue y vuelve a quedarse quieto;
  - **sale del modo combate** si lo derriban, si se desploma de sueño (sueño a 0, como ahora) o si le toca una crisis de ánimo (ánimo bajo el umbral de crisis sin haberse calmado hace poco); en los tres casos se registra solo lo que ya se registraba.
- Invariante: nadie derribado ni durmiendo está en modo combate.

### 3.2 En la pantalla

- **Elegir** (estado de la pantalla, no de la partida):
  - clic en un colono: solo él;
  - **Mayús + clic** (en el mapa o en su tarjeta): lo añade o lo quita;
  - **arrastrar con el izquierdo** sin herramienta: los colonos que queden dentro del rectángulo (se dibuja mientras se arrastra);
  - clic en el suelo: nadie (y, como ahora, abre la ficha del edificio si es uno visto);
  - `Selection` pasa a tener `ids` (todos los elegidos), `toggle(id)` y `setMany(ids)`; `id` es el elegido si hay uno solo y `null` si hay ninguno o varios.
- **Con uno elegido**, su ficha de siempre, con un botón **Combate** (encendido si está en modo combate; apagado y sin efecto si está derribado o en crisis).
- **Con varios**, en el mismo sitio, la **lista de nombres** con el botón **Combate**. Pulsar un nombre deja elegido solo a ese.
- **R** (y el botón): si alguno de los elegidos no está en modo combate, lo ponen todos; si lo están todos, lo quitan todos.
- **Clic derecho** (sin arrastrar; arrastrar con el derecho sigue moviendo la cámara), si hay algún elegido en modo combate:
  - en un zombi que se ve: `draftAttack`;
  - en un colono derribado: `draftRescue` con el primero de los elegidos en modo combate;
  - en cualquier otro sitio: `draftMove`.
- **Se ve:** ⚔ en la tarjeta (icono de estado, delante de los demás) y una marca sobre la cabeza en el mapa; un aro por cada elegido.
- Esc deja sin nadie elegido aunque haya varios.

## 4. Sanar

### 4.1 El trabajo

- Trabajo nuevo `heal` (**Sanar**), con su habilidad (sube con cada tick de rescate y de vendaje). Columna en el panel de Trabajos y en las habilidades de la ficha.
- Viene activado para todos (también el Cobarde: no sale lejos por su cuenta, pero rescatar es urgente) y con **prioridad 1** (los demás, 3), y va el primero de la lista.

### 4.2 Rescatar

- **A quién:** a un colono derribado que no esté en una cama y al que no lleve ni vaya a rescatar otro.
- **Adónde:** a su cama; si no tiene, a una cama sin dueño; si no hay, a una casilla al azar del suelo de la base. Si ya está en la base y no hay cama a la que llevarlo, no hace falta rescatarlo.
- **Cuándo no sale por su cuenta:** si algún colono ve un zombi a 8 casillas o menos del derribado (`RESCUE_SAFE_RANGE`).
- **Cómo:**
  - va hasta el derribado; al llegar, si sigue ahí y nadie lo lleva, lo coge (`Survivor.carryingId` = el derribado; en el derribado, `downed.carriedBy`);
  - lo lleva andando al 60 % de su velocidad (`CARRY_SPEED`); el derribado va con él, casilla a casilla;
  - al llegar, lo deja: en la cama, con `downed.inBed = true`; registro "X ha rescatado a Y".
- **Si aparecen zombis por el camino:** si le toca pelear, lo suelta en el suelo donde está y pelea; si le toca huir, sigue cargándolo (ya va a la base).
- **Si lo derriban a él o deja de llevarlo por cualquier otra razón**, el derribado queda en el suelo donde iba.
- **En cama**, el derribado se levanta a la hora de siempre, pero con **40** de Salud (`GET_UP_HEALTH_BED`) en vez de 15.
- **Levantarse** (cambio de la revisión final, para todos los derribados): pasadas las 8 h, si tiene un zombi a 3 casillas o menos (`GET_UP_CLEAR_RANGE`) sigue en el suelo, hasta las 16 h como mucho (`DOWNED_HARD_MAX_TICKS`). Antes se levantaba a las 8 h aunque lo tuviera encima, y volvía a caer al momento.

### 4.3 Vendar

- **A quién:** a un colono (él mismo también) que esté **en la base**, no derribado, con menos de **50** de Salud (`BANDAGE_BELOW`), sin venda en las últimas **12 h** (`Survivor.bandagedUntil`) y al que no vaya a vendar otro.
- **Hace falta** al menos una venda en el almacén.
- **Cómo:** va adonde está el herido y le venda durante **media hora**. Si al llegar el herido se ha ido a más de 1,5 casillas, vuelve a decidir (y va a buscarlo). Al terminar gasta una venda del almacén (si ya no queda, no hay vendaje).
- **Efecto:** +**15** de Salud, más 1 por nivel de Sanar; durante 12 h la Salud sube **el doble** de rápido. Registro "X ha vendado a Y".

## 5. Zombis contra desconocidos

- Los zombis ven, persiguen y golpean a los desconocidos (`w.stranger.survivors`) como a los colonos (no a los derribados).
- **Los desconocidos se defienden como un colono con Decidir** (su postura no cuenta): si pueden con los zombis que ven, pelean (`melee`, con lo que lleven en la mano); si no, **huyen todos juntos**: su decisión se quita, se registra "Los desconocidos han huido" (aviso, no pausa) y se van corriendo al extremo de carretera más cercano, como al rechazarlos. Al llegar, desaparecen.
- **Derribados:** como los colonos: caen a 0 de Salud, se levantan a las 4 h (o hasta 8 h si ven zombis; ver §4.2). Registro "Un desconocido ha caído: X" (sin aviso).
  - Si se les acepta en el suelo, entran en la colonia derribados (y Sanar puede rescatarlos).
  - Si se les rechaza o caduca su decisión mientras están en el suelo, se van al levantarse; los demás esperan a que se levante.
- Lo que aprenden peleando no se registra ni avisa (no son de la colonia), y sus muertes de zombi tampoco.
- No llegan desconocidos mientras hay asedio anunciado o en marcha (§2.2).

## 6. Menú de Avisos

- Un botón **Avisos** en la barra de arriba abre un panel (se cierra con ✕ o Esc).
- **La lista:** cada tipo de aviso, por grupos (**Narrador**, **Zombis**, **Hordas**, **Colonos**), con dos casillas: **Aparece** y **Pausa** (apagada y sin efecto si no aparece).
- **Los de decisión** (robo, cumpleaños, gripe, desconocidos) aparecen siempre; solo se elige si pausan.
- **Por defecto**, como ahora: aparecen todos; pausan los rojos (también los de tono variable cuando salen rojos, como el castigo injusto) y los de decisión. Marcar o desmarcar **Pausa** fija lo que hace ese tipo siempre, sea del color que sea.
- **Como al principio:** un botón que borra lo elegido.
- **Se guarda en el navegador** (`localStorage`, clave `rimzomboid.avisos`), no en la partida. Si no se puede leer o guardar, el juego funciona con lo de siempre.
- El registro lo sigue apuntando todo.

## 7. Datos y sistemas

- **Tipos:**
  - `EventId` + `siege`, `wanderers`;
  - `WorkType` + `heal` (y, con él, la habilidad);
  - `Survivor`: `drafted`, `carryingId: number | null`, `bandagedUntil: number`;
  - acciones: `downed` + `inBed?` y `carriedBy?`; `melee` + `hold?`; `bandage { patientId; ticksLeft }`;
  - actividades: `rescue { downedId }`, `dropOff { downedId }`, `bandage { patientId }`;
  - registro: `siegeAnnounced { side; hours }`, `siegeArrived { x; y }`, `siegeRepelled`, `siegeEnded`, `wanderersSighted { x; y }`, `strangersFled { names }`, `strangerDowned { names }`, `rescued { survivorId; otherId }`, `bandaged { survivorId; otherId }`.
- **Archivos nuevos:** `events/siege.ts`, `events/wanderers.ts`, `zombies/hordes.ts` (llegada, empeño, tramos, fin, avistamiento), `draft.ts` (órdenes y cerebro del modo combate), `jobs/heal.ts` (rescatar, llevar y vendar), `ui/noticePrefs.ts`, `ui/noticeMenu.ts`, `ui/groupPanel.ts`.
- **Orden del tick:** el de siempre. Lo nuevo va dentro de: órdenes (modo combate); salud (cama, venda y desconocidos); narrador (los dos sucesos); decisiones (modo combate antes que el cerebro); zombis (`hordeSystem` antes de las llegadas); combate (también los desconocidos y el `hold`); desconocidos (peligro y huida); actividades (vendar); y un `carrySystem` después de las actividades que mueve al derribado con quien lo lleva o lo suelta.
- **Invariantes nuevas:**
  - la horda de cada zombi existe;
  - los zombis que no son de ninguna horda no pasan del tope;
  - quien lleva a alguien no está derribado, y el llevado está derribado, en su misma posición y con `carriedBy` suyo (y al revés);
  - nadie derribado ni durmiendo en modo combate;
  - `bandagedUntil` es un número finito.
- **Azar:** los sucesos con el azar del mundo (como todos); las posiciones de las hordas con `zombieRng`. Lo nuevo de cada colono se pone sin sortear nada, para no cambiar partidas.
- **Cifras** en `balance.ts` y **textos** en `es.ts` (neutros de género).

## 8. Pruebas

- **Unitarias:**
  - asedio: requisitos (día 6, sin otro), aviso y su texto, cuenta atrás, llegada (cuántos, dónde, juntos), empeño (vuelve a la base sin aburrirse), fin al día y fin por matarlos, sin llegadas por los bordes ni desconocidos;
  - errantes: cruzan, siguen tras perder a alguien, salen del mapa y se borran; aviso al verlos;
  - tamaños con narrador, días y opción;
  - modo combate: cada orden, reparto de casillas, defenderse sin moverse, no huir ni comer, salir al derribo, al desplomarse y en crisis, no poner a derribados ni en crisis, cortar lo de dos;
  - rescatar: a quién y adónde, no con zombis cerca, llevar (velocidad, posición), soltar al pelear, seguir al huir, levantarse con 40 en cama, `draftRescue`;
  - vendar: a quién, efecto con la habilidad, curar el doble 12 h, sin vendas no;
  - desconocidos: los zombis los ven y golpean, pelean, huyen juntos, caen y se levantan, aceptados o rechazados en el suelo;
  - menú de Avisos: aparece, pausa, decisiones, por defecto, guardar y leer, sin `localStorage`.
- **Partida larga** (30 semillas × 30 días): sin bloqueos ni invariantes rotas; se cuentan los asedios y se mira el tiempo por tick.
- **Navegador (Playwright):** elegir a dos con el rectángulo, R, ⚔, clic derecho y van; apagar un tipo en el menú de Avisos y que siga apagado al recargar.
