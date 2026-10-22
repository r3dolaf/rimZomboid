# rimZomboid — H4b Zombis: diseño

Fecha: 2026-10-21
Estado: aprobado en conversación. El usuario pidió implementar directamente. Lo grande ya se había decidido antes de partir H4: la barra de Salud con derribos, puertas y ventanas que se rompen, Reparar como orden y Pelear/Huir/Decidir. H4 quedó así: **H4a Defensa y trabajos** (hecho), **H4b Zombis** (este) y **H4c Hordas y mando**.

## 1. Objetivo

Los zombis llegan al mundo. Vagan en grupos, los atrae el ruido, persiguen a los colonos y rompen lo que se interpone. Los colonos pelean o huyen según su postura y su arma, pueden quedar derribados y se levantan solos. Lo que se rompe se repara con madera. Nadie muere todavía.

**Criterio de éxito.** En una partida normal:

- los zombis vagan en grupos y el ruido los atrae;
- los colonos pelean o huyen según su postura y su arma, los derriban y se levantan;
- los zombis rompen puertas y ventanas, y el jugador las repara.

**Queda para H4e** (antes H4c; luego se añadieron H4c Habilidades y H4d Tela, cortinas y cuerpos)**:**

- hordas del narrador, de asedio y errantes;
- modo combate (R) con varios colonos;
- el trabajo Sanar (rescatar derribados y vendar);
- el menú de Avisos;
- que los zombis ataquen a los desconocidos que llegan a la puerta.

**Queda para H5:** heridas por parte del cuerpo, sangre, infección y muerte.

## 2. Los zombis

### 2.1 Datos

`World.zombies: Zombie[]`. Cada zombi tiene:

- `id` y `pos` (continua, como los colonos);
- `path`;
- `health` (60);
- `state`: `wander`, `alert` o `chase`;
- `targetId`, el colono que persigue;
- `goal`, el punto adonde va;
- `lastSeenAt`;
- `cooldown`, los ticks hasta su próximo golpe;
- `waitUntil`, las pausas al vagar.

Usan su propio generador de azar, `World.zombieRng`, para que añadir zombis no cambie lo que hacen los colonos con la misma semilla.

### 2.2 Cerebro y estados

El cerebro de cada zombi decide cada `ZOMBIE_THINK_TICKS`, con los zombis repartidos por id.

- **Vagar:** paseos cortos al azar (3–8 casillas), con pausas.
  - **Agruparse:** si tiene otros zombis a 10 casillas o menos, 3 de cada 4 paseos van hacia el centro de ese grupo (con 8 casillas y la mitad de las veces, los grupos se dispersaban).
  - **Aburrirse:** si pasan 3 h sin que nada le llame la atención (ver a alguien, un ruido, otro zombi que persigue, una hoguera), da un paseo largo, de 12 a 25 casillas. Así los grupos no se quedan para siempre donde perdieron a alguien; dentro de la base, por ejemplo, con los colonos derribados.
- **Alertado:** va hacia `goal`, el punto de un ruido, una hoguera o adonde va otro zombi que persigue. Al llegar, vuelve a vagar.
  - **Contagio:** un zombi que vaga o está alertado y ve a otro que persigue queda alertado hacia el punto donde ese otro vio a su presa por última vez.
- **Perseguir:** ve a un colono (no derribado) y va a por el más cercano.
  - Rehace el camino cada `ZOMBIE_REPATH_TICKS` o cuando el colono cambia de casilla.
  - **Ataca** cuando está pegado al colono, a 1,5 casillas o menos de centro a centro.
- **Perder el rastro:** si deja de verlo `LOSE_TRACK_TICKS`, pasa a alertado hacia el último sitio donde lo vio.

**Vista:**

- Ven a **8 casillas**, de día y de noche, en línea recta.
- Les tapan la vista las mismas casillas que a los colonos: muros, árboles, puertas, muros de madera y ventanas tapiadas. Las ventanas normales y las rotas, no.
- No ven a los derribados ni a los desconocidos.

**Velocidad:** 0,1 casillas por tick. Un colono andando va a 0,15 y corriendo a 0,25.

**Por dónde pasan:**

- Pasan por hierba, suelo, carretera, puerta rota, ventana rota y escombros.
- Lo rompible (puerta, ventana, ventana tapiada, muro de madera y muro de ladrillo) también lo pueden cruzar, pero rompiéndolo.
- No pasan nunca por árboles ni fuera del mapa.

**Caminos:**

- Usan el mismo A\*, pero lo rompible cuenta como "se pasa, con un coste" según su resistencia: los ticks que tardaría un zombi en romperlo, pasados a casillas de andar.
- Así solo rompe una puerta si es el camino más corto, y un muro de ladrillo casi nunca.
- La búsqueda tiene un límite de casillas exploradas (`ZOMBIE_PATH_BUDGET`). Si se pasa, da un paso en línea recta hacia el destino (en diagonal, solo por lo libre y sin cortar esquinas, como los caminos).

**Romper:** si la siguiente casilla del camino es rompible, se queda al lado golpeándola, un golpe cada `ZOMBIE_HIT_TICKS` que quita `ZOMBIE_BREAK_DAMAGE`, hasta romperla (§4).

Los zombis pueden solaparse entre sí y con los colonos: no se empujan.

### 2.3 Cuántos y dónde

Con la opción **Zombis** en _normal_:

| Narrador    | Al empezar | Llegan por los bordes | Máximo |
| ----------- | ---------- | --------------------- | ------ |
| Tranquilo   | 15         | 1 cada 4 h            | 30     |
| Equilibrado | 25         | 1 cada 2 h            | 50     |
| Caótico     | 30         | 1 cada hora y media   | 60     |

- **Opción Zombis** en la portada: con **pocos** las tres cifras se multiplican por 0,5; con **normal**, por 1; con **muchos**, por 1,25. Las cifras se redondean, y el ritmo de llegada se escala igual (con muchos, más a menudo). Se guarda en `World.zombieLevel`.
- Al principio Caótico era 35, 1 cada hora y 70, y muchos ×1,5: sin construir defensas, en Caótico/muchos los colonos pasaban en el suelo el 80 % del tiempo. Con estas cifras, un 44 % (Caótico/normal, 28 %; Equilibrado/muchos, 18 %; Equilibrado/normal no cambia).
- **Al empezar:**
  - cada zombi va junto a una casa, a 6 casillas o menos de ella, y las casas lejanas tienen más probabilidad (peso `0,5 + d`, con `d` de 0 a 1 según la distancia a la base);
  - si no hay sitio, va a cualquier casilla exterior;
  - **ninguno a menos de 20 casillas** de la base.
- **Llegadas:**
  - empiezan el **día 2**, por una casilla de borde transitable, y van hacia una casa al azar (hacia el centro no, porque ahí está la base);
  - de noche llegan al doble de ritmo;
  - nunca se pasa del máximo (`World.nextZombieAt` marca la siguiente).
- Se reparten al final de `createWorld(seed, style, level)`, con `zombieRng`. Lo demás no cambia.

## 3. Ruido

`makeNoise(w, pos, radius)` alerta al momento a los zombis a `radius` casillas o menos, en línea recta y sin mirar muros. Los que ya persiguen a alguien no cambian de objetivo.

| Qué                                             | Radio | Cuándo                   |
| ----------------------------------------------- | ----- | ------------------------ |
| Un golpe en una pelea (colono o zombi a colono) | 10    | cada golpe               |
| Romperse una puerta, ventana o muro             | 12    | al romperse              |
| Golpe de zombi a una puerta, ventana o muro     | 8     | cada golpe               |
| Talar                                           | 8     | cada `CHOP_NOISE_TICKS`  |
| Construir o reparar                             | 6     | cada `BUILD_NOISE_TICKS` |
| Correr                                          | 5     | cada `RUN_NOISE_TICKS`   |

**Hoguera de noche:** no es ruido. Un zombi que vaga y ve una hoguera a 15 casillas o menos en línea recta (de noche, con oscuridad) queda alertado hacia ella.

## 4. Romper y reparar

### 4.1 Resistencia

`World.damage: Record<string, number>` guarda la resistencia que le queda a cada casilla dañada, por índice `y·ancho + x`. Lo intacto no está en el mapa. La interfaz dibuja una barrita en lo dañado.

| Casilla                   | Resistencia | Al romperse                                                             |
| ------------------------- | ----------- | ----------------------------------------------------------------------- |
| Ventana                   | 60          | **Ventana rota** (`BrokenWindow`): se pasa y se ve a través             |
| Ventana tapiada           | 180         | Ventana rota                                                            |
| Puerta (de casa o madera) | 100         | **Puerta rota** (`BrokenDoor`): un hueco que se pasa y no tapa la vista |
| Muro de madera            | 200         | **Escombros** (`Rubble`): se pasa por encima                            |
| Muro de ladrillo          | 800         | Escombros                                                               |

- Cada golpe de zombi quita 5. Una puerta aguanta unos 40 minutos de juego a un zombi solo.
- Los colonos pasan por las puertas cerradas, y para los zombis son un obstáculo. Las puertas no tienen estado abierta o cerrada.
- Al romperse algo: `setTile` (la versión del mapa sube, las regiones se rehacen), el aviso y el registro (§8), y el ruido.
- Las casillas nuevas `BrokenWindow`, `BrokenDoor` y `Rubble` se pueden pisar y no tapan la vista.

### 4.2 Reparar

**Reparar** es una opción nueva del menú Construir. Al hacer clic, la herramienta elige el plano según la casilla:

| Casilla                              | Plano                  | Madera | Tiempo | Resultado            |
| ------------------------------------ | ---------------------- | ------ | ------ | -------------------- |
| Dañada sin romper (está en `damage`) | `repair` (nuevo)       | 1      | 15 min | Resistencia completa |
| Puerta rota                          | `fixDoor` (nuevo)      | 2      | 1 h    | Puerta               |
| Ventana rota                         | `board` (ya existe)    | 3      | 30 min | Ventana tapiada      |
| Escombros                            | `woodWall` (ya existe) | 2      | 1 h    | Muro de madera       |

- Son planos normales: Transportar lleva la madera y Construir trabaja desde una casilla de al lado.
- **Los planos de reparar** (`repair`, `fixDoor`, y `board` y `woodWall` puestos sobre algo roto) **van antes** que los demás, al acarrear y al construir.
- Si mientras tanto lo dañado se rompe, el plano `repair` se cancela y la madera queda en un montón.
- Tapiar o destapiar deja la casilla entera: las tablas nuevas no arrastran el daño de la ventana.
- **Esperar a que no haya nadie encima** vale ahora también para los zombis, y para todo plano que deja la casilla sin poder pisarse: muro, puerta (los zombis no pueden estar en una puerta), `fixDoor` y `board` sobre una ventana rota.

## 5. Salud y derribos

`Survivor.health`, de 0 a 100. Empieza en 100.

- **Se recupera** (sistema `health`), por hora de juego:
  - 1 despierto;
  - 4 durmiendo en el suelo;
  - 6 durmiendo en cama.
- **Herido:** −10 de ánimo mientras tenga menos de 50 (motivo `hurt`).
- **Derribado** al llegar a 0:
  - acción `{ type: 'downed', until }` durante 4 h, sin hacer nada y sin recuperarse;
  - el hambre y el sueño siguen bajando;
  - los zombis no lo ven, así que dejan de perseguirlo;
  - a las 4 h se levanta, pero solo si no ve zombis a 8 casillas o menos (los de detrás de un muro no cuentan): si los ve, sigue en el suelo hasta que se vayan (si no, caía una y otra vez entre ellos), pero nunca más de 8 h en total (un zombi encerrado con él no le dejaba levantarse nunca);
  - en el suelo nadie le consuela ni le habla, y tampoco a quien pelea con un zombi;
  - al levantarse tiene 15 de Salud y el recuerdo "Le derribaron" (−15, 24 h);
  - se registra al caer, con un aviso rojo que pausa.
- **Lo que interrumpe** (como el peligro, §7): cualquier acción, incluidas peleas y consuelos. El otro queda libre, igual que ahora cuando alguien se desploma.

## 6. Combate y armas

### 6.1 Golpes

**Zombi a colono:** un golpe cada 15 ticks, con 40 % de acierto, quita 8–12 de Salud y hace ruido.

**Colono a zombi.** El zombi tiene 60 de salud:

| En la mano | Daño | Ticks entre golpes | Acierto |
| ---------- | ---- | ------------------ | ------- |
| Nada       | 5    | 10                 | 70 %    |
| Cuchillo   | 15   | 10                 | 70 %    |
| Bate       | 25   | 15                 | 70 %    |
| Hacha      | 40   | 20                 | 70 %    |

- 1 de cada 6 golpes que aciertan va a la cabeza y hace el doble de daño.
- Cada golpe hace ruido.
- Al llegar a 0, el zombi desaparece y se registra "X ha matado un zombi".

**Acción de pelear:** `{ type: 'melee', zombieId, cooldown }`.

- Si el zombi está a 1,5 casillas o menos, golpea cuando toca.
- Si no, va corriendo hacia él y rehace el camino cada `ZOMBIE_REPATH_TICKS`.
- Termina si el zombi ya no existe.

### 6.2 Armas en la mano

`Survivor.equipped`: `'axe' | 'bat' | 'knife' | null`, de mejor a peor.

- **Al empezar**, cada colono lleva un cuchillo en la mano (sin arma caían enseguida).
- **En los contenedores** hay unas 10 armas por mapa de media: cada mueble tiene un 14 % de cuchillo, un 10 % de bate y un 8 % de hacha, más en las casas lejanas.

- **Coger y cambiar:**
  - quien no lleva nada, o lleva algo peor que lo mejor del almacén, va al almacén (actividad `swapWeapon`), deja lo suyo y coge lo mejor;
  - esto se mira antes de buscar trabajo, como devolver el hacha;
  - si al llegar ya no está, lo deja.
- **El hacha:**
  - quien no tiene Talar no coge el hacha del almacén si hay árboles marcados;
  - si la lleva, hay árboles marcados y no la tiene fijada, la devuelve y coge lo mejor que quede;
  - quien tiene Talar sigue cogiéndola para talar (H4a), dejando en el almacén lo que llevara.
- **Fijar arma** (`Survivor.weaponLocked`, orden `lockWeapon`): no cambia ni devuelve lo que lleva. Un colono con Talar y otra arma fijada no tala.
- **Lo que lleva encima:** equipa sin más la mejor arma que lleve en la carga, si es mejor que la suya (spec general §5.3); la de la mano pasa a la carga.
- **Las armas no aparecen ni desaparecen:** la suma de almacén, contenedores, montones, cargas y manos es siempre la misma.

## 7. Posturas y peligro

`Survivor.stance`: `'fight' | 'flee' | 'decide'`. Se cambia con la orden `setStance`.

- **Por defecto:** el Cobarde, Huir; el Valiente, Pelear; el resto, Decidir. Los recién llegados siguen la misma regla.

**Amenazas:** zombis que el colono ve, en línea recta, a la distancia de su vista o menos (de noche, 6), y como mucho a 8 casillas.

**Capa de Peligro**, la primera del cerebro, antes de comer, dormir, la crisis o el trabajo. Solo actúa si hay amenazas, o si un zombi le golpea:

- **Pelear:** si ya pelea con un zombi que sigue existiendo, sigue. Si no, va a por la amenaza más cercana.
- **Huir:**
  - fuera de la base, corre a la casilla de suelo de la base más lejana de las amenazas, y sigue hasta llegar aunque deje de verlas un momento (si no, iba y volvía en el límite de la vista);
  - "X huye a la base" va al registro y a los avisos como mucho una vez por hora y colono;
  - dentro de la base, se queda y pasea dentro, sin trabajar; pero si no tiene un zombi al lado, come y duerme cuando lo necesita (si no, caían rendidos);
  - si no hay camino a la base, se comporta como acorralado.
- **Decidir:** pelea si tiene Salud de 50 o más, lleva arma y las amenazas son como mucho 2. Si no, huye.
  - Cada compañero a 5 casillas o menos que esté peleando cuenta como una amenaza menos.
  - Sin arma, pelea solo contra una amenaza y con Salud de 70 o más.
  - El Valiente tolera una amenaza más y el Cobarde una menos.
- **Para todos:**
  - con Salud por debajo de 20 huye siempre, aunque esté en Pelear;
  - **acorralado:** si un zombi está a 1,5 casillas o menos y no puede huir (ya está en la base o no hay camino), pelea con él.
- **Durmiendo:**
  - se despierta si le golpean, o si ve un zombi a 4 casillas o menos; y con uno así no se acuesta (los de detrás de un muro no cuentan: le despertaban una y otra vez y caía rendido);
  - rendido de sueño (sueño por debajo de 5, como al desplomarse), solo le despierta un golpe;
  - mientras duerme no ve.
- **Derribado:** no decide nada.
- **Correr:**
  - quien huye o va a por un zombi corre (`moveTo` con `run: true`) y hace ruido;
  - el ánimo y las necesidades no cambian por correr.
- **Lo que se interrumpe:**
  - las reservas de árboles, montones, planos y contenedores se liberan solas, porque salen de las acciones;
  - las peleas y consuelos entre colonos se cortan como ahora.
- **Al acabar el peligro:** vuelve a decidir con normalidad.

## 8. Pantalla

**Mapa:**

- **Zombis:** círculo verde grisáceo, solo en las casillas que ven ahora los colonos, con una barrita si están heridos.
- **Casillas nuevas:** ventana rota (marco con cristal oscuro), puerta rota (hueco en el marco) y escombros (suelo con cascotes).
- **Lo dañado:** barrita de resistencia.
- **Derribado:** tumbado (elipse), con borde rojo.
- **Reparar:** con la opción Reparar del menú Construir, clic en algo dañado o roto pone el plano que toque.

**Interfaz:**

- **Tarjetas:** barra de **Salud** (roja).
- **Ficha:** Salud; postura con tres botones (Pelear, Huir, Decidir); "En la mano: bate" con la casilla **Fijar**; textos de las acciones nuevas ("Peleando con un zombi", "Huyendo a la base", "Derribado").
- **Panel de Trabajos:** columna **Postura**, un desplegable con las tres opciones.
- **HUD:** "Zombis a la vista: N".
- **Registro de sucesos:** se puede minimizar (botón ▾/▴ en su cabecera) y se recuerda en el navegador. Lo pidió el usuario durante H4b.
- **Portada:** debajo del narrador, **Zombis: pocos / normal / muchos**. La dirección lleva `?zombis=pocos|normal|muchos` (en español, como `narrador`).

**Avisos:**

- **Rojos, que pausan:** derribado; zombis dentro de la base.
- **Que no pausan:**
  - el primer zombi visto a 15 casillas o menos de la base, una vez al día;
  - algo roto en la base ("Los zombis han roto la puerta de la base"); lo de las casas, solo en el registro;
  - un colono huye.
- Al pulsar un aviso, la cámara va al sitio, como ahora.

**Registro:** "X ha matado un zombi", "X ha caído", "X se ha levantado", "Los zombis han roto una ventana", "Hay zombis dentro de la base".

## 9. Datos y sistemas

- **Casillas:** `BrokenWindow`, `BrokenDoor` y `Rubble`.
- **Mundo:** `World.zombies`, `zombieRng`, `zombieLevel`, `nextZombieAt` y `damage`.
- **Colonos:**
  - `health`, `stance` y `weaponLocked`;
  - `equipped` con las tres armas;
  - acciones `downed` y `melee`;
  - `moveTo.run`;
  - actividad `swapWeapon`.
- **Planos:** `repair` y `fixDoor`.
- **Órdenes:** `setStance`, `lockWeapon`. `placeBlueprint` acepta `repair`, `fixDoor`, `board` sobre una ventana rota y `woodWall` sobre escombros.
- **Archivos:**
  - `zombies/` (cerebro, movimiento, aparición, vista);
  - `noise.ts`;
  - `structures.ts` (resistencia, romper);
  - `combat.ts` (golpes de colonos y armas);
  - `danger.ts` (la capa de Peligro);
  - `health.ts`.
- **Orden del tick:** órdenes → necesidades → **salud** → muebles → ánimo → social → narrador → decisiones (con Peligro) → movimiento → **zombis** (llegadas, cerebro, movimiento, golpes y roturas) → **combate** (golpes de colonos) → desconocidos → actividades → reservas → visión.
- **Desconocidos:** los zombis no los ven ni los atacan en H4b.
- Todas las cifras en `balance.ts` y todos los textos en `es.ts` (neutros de género).

**Invariantes nuevas:**

- zombis con posición válida, en casillas que pueden pisar y con salud entre 1 y 60;
- no más zombis que el máximo;
- Salud de los colonos entre 0 y 100, y derribado solo con Salud 0;
- `damage` solo en casillas rompibles, con resistencia entre 1 y la máxima menos 1;
- planos `repair` y `fixDoor` en casillas válidas.

## 10. Pruebas

- **Unitarias:**
  - estados del zombi, contagio y agruparse;
  - vista de día y de noche, y lo que la tapa;
  - ruido, con cada fuente, y la hoguera;
  - romper cada casilla y su resultado, y los caminos con coste;
  - cada reparación, su espera y su cancelación;
  - Salud: recuperación, herido, derribo y levantarse;
  - golpes y armas: daño, cabeza, coger, cambiar, fijar y el hacha para quien tala;
  - posturas: Decidir con compañeros y rasgos, Salud < 20, acorralado, despertarse y huir dentro de la base;
  - aparición: cantidades por narrador y opción, nadie cerca de la base, día 2, noche y máximo.
- **Escenarios:**
  - un colono con cuchillo mata a un zombi;
  - tres zombis derriban a alguien, que se levanta a las 4 h;
  - unos zombis rompen la puerta de la base, salta el aviso y se repara con madera.
- **Partidas automáticas de 30 días** con los 3 narradores y las 3 opciones. Se comprueba:
  - las invariantes en cada tick;
  - que nadie se queda quieto un día entero (salvo derribados o encerrados);
  - que la madera y las armas cuadran;
  - que se pelea, se derriba y se rompe algo;
  - un límite de tiempo por tick.
- **Navegador:** la opción Zombis de la portada llega a la partida, un zombi se ve en el mapa cuando un colono lo ve, y cambiar la postura en el panel.
