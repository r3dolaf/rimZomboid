# H5c1. Expediciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD en cada tarea.

**Goal:** varios mapas a la vez (la base y hasta 4 sitios) con una caja común; descubrir sitios (explorar, mapas y notas, narrador); mandar grupos con lo que necesiten, viajar de día, saquear desde un campamento y volver; sitios que se guardan y cambian, y especiales; Fabricar y Construir más claros y menú del clic derecho.
**Architecture:** `World` sigue siendo el estado de un mapa (así todos los sistemas de siempre valen tal cual) y gana `common: Common`, el mismo objeto en todos los mapas, con lo que se comparte (registro, atuendos, numeración, cuentas, estadísticas, muertos, fin de partida, lluvia y la expedición: sitios conocidos y viajes). La base guarda los mapas de los sitios en `siteMaps` (Common no guarda mundos: así no hay ciclos y sigue siendo JSON). `stepGame(base)` avanza la base, los sitios con gente y los viajes. Lo nuevo va en `src/sim/game.ts` (varios mapas), `src/sim/map/site.ts` (generar un sitio), `src/sim/sites.ts` (sitios: descubrir, guardar, cambiar), `src/sim/expeditions.ts` (formar el grupo, salir, viajar, llegar, volver, explorar) y en la interfaz `src/ui/expeditionsPanel.ts`, `src/ui/mapTabs.ts` y `src/ui/contextMenu.ts`.
**Tech Stack:** TypeScript, Vite, Phaser 4, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-30-h5c1-expediciones-design.md`.
**Nota:** el usuario pidió implementar directamente; plan compacto, como en H4a–H5b2.

## Global Constraints

Las de H1–H5b2: simulación pura, serializable (JSON) y determinista (nada de `Math.random`, `Date`, Phaser ni DOM en `src/sim`); cifras en `balance.ts`; textos en `es.ts` (neutros de género para personas); la interfaz solo cambia el mundo con órdenes (`issue`) y los paneles muestran lo pedido aunque esté en pausa. Cada tick por debajo de 1 ms de media en las partidas largas (con varios sitios, la suma).

## Decisiones del plan (afinan la spec)

- **Common** = `{ log, outfits, nextOutfitId, nextId, nextPieceId, pieceLog, nextWoundId, woodLog, weaponLog, stats, dead, over, bagLog, stormUntil, rainUntil, expedition }`. Se quitan de `World`. Las funciones que reciben un contador de piezas (`newGarment`, `newBag`) aceptan un `World` o el `Common`.
- **Mapas:** `World.mapId` (0 la base; si no, el id del sitio); `World.siteMaps: { siteId: number; world: World }[]` (solo en la base). Solo se simulan los sitios **con gente**; un sitio sin nadie queda congelado (su `tick` se queda) y al volver se calcula lo que pasó (§2 de la spec).
- **Solo en la base:** narrador, desconocidos que llegan, hordas y asedios, corte del agua (en los sitios no hay agua corriente), echar y volver, piedad. Los demás sistemas, en todos los mapas.
- **Ids únicos** de personas, objetos y entidades en todos los mapas (`common.nextId`, `common.nextPieceId`, `common.nextWoundId`). Los zombis tienen ids por mapa.
- **Sitios:** `SiteKind` = `house` | `farm` | `gas` | `warehouse` | `village`; `SiteSpecial` = `survivors` | `stash` | `dangerous`. `SiteInfo { id; kind; special: SiteSpecial | null; side: MapSide; hours; state: 'known' | 'lost'; visited: boolean; specialUntil: number | null; leftAt: number | null }`. Tamaño `SITE_SIZE` 64, el pueblecito `VILLAGE_SIZE` 96. Horas `SITE_HOURS` [2, 12]. `KNOWN_SITES_MAX` 10, `ACTIVE_SITES_MAX` 4.
- **Zombis al crearse:** casa 4, granja 6, gasolinera 6, nave 8, pueblecito 12; alijo 3; peligroso 30. **Mientras no hay nadie:** `SITE_ZOMBIES_PER_DAY` 2 hasta el doble de los iniciales; `SITE_LOOT_TAKEN_PER_DAY` 0,1 (de cada montón de muebles y campamento se quita `round(n × (1 − 0,9^días))`, con su azar para las piezas); cada día, con el azar del sitio, `SITE_BURN_PER_DAY` 0,02 (se pierde) y `SITE_HORDE_PER_DAY` 0,03 (+10 zombis), con aviso.
- **Descubrir:** objetos nuevos `roadMap` (mapa de carreteras) y `note` (nota), 0,05 kg. Botín: `roadMap` casa {0,1}, gasolinera {0,5}; `note` casa {0,05}; zombis `ZOMBIE_NOTE_CHANCE` 0,03. Al entrar en un almacén (descargar en la base o en un campamento) se gastan y descubren un sitio cada uno (nota: especial «supervivientes» la mitad de las veces). Narrador: suceso `smoke` (sitio normal) y `radio` (supervivientes un 70 %). Un sitio nuevo: especial con `SPECIAL_SHARE` 0,25 (supervivientes, alijo o peligroso a partes iguales); los supervivientes, con `specialUntil` a 2–3 días.
- **Explorar:** 1 o 2 colonos, un día de luz (`EXPLORE_HOURS` 14 de luz); traen 1 sitio y un 2.º con `0,3 + 0,05 × Saquear` (del mejor); herida (arañazo o corte en una parte al azar) con `EXPLORE_WOUND` 0,2 si va uno y 0,1 si van dos, por persona.
- **Viajar:** cuentan las horas de 6 a 20 (`TRAVEL_DAY` [6, 20]); de noche duermen. `Travel { id; kind: 'go' | 'back' | 'explore'; siteId: number | null; side: MapSide; members: Survivor[]; hoursLeft: number }` en `common.expedition.travels`. Los viajeros pasan por hambre, sueño, salud, sangre e infección como en un mapa (`travelerSystem`), comen de lo suyo con hambre y se vendan si sangran y llevan vendas.
- **Formar el grupo:** orden `sendExpedition { siteId; survivorIds; items: Partial<Record<ItemKind, number>> }`; cada uno lleva `Survivor.trip: { kind: 'go' | 'back' | 'explore'; siteId: number | null; side: MapSide; stage: 'prepare' | 'exit' } | null`. Preparar: al almacén (descargar con `unloadAt`, `takeSupplies`, y su parte de la lista del grupo, repartida por orden entre ellos con `placeFor`), luego a la casilla de salida de ese lado (la del borde más cercana a la puerta de la base o del campamento). Al pisarla sale del mapa; el viaje empieza cuando han salido todos (los que esperan, `idle` en el borde). Si uno cae derribado o muere, se queda y los demás siguen.
- **Llegar a un sitio:** si no tiene mapa, se crea (`generateSite`); si lo tiene, `catchUp`. Entran por las casillas del borde de ese lado. El **campamento** es el almacén del sitio: 3×3 casillas a 3 del borde, frente a la entrada, con un plano de hoguera al lado. Al crear el sitio se marcan todos sus edificios para saquear.
- **Volver:** orden `returnHome { siteId }`: todos los colonos del sitio pasan a `trip.kind = 'back'`: van al campamento, `loadForTrip` (lo de la lista del grupo con la que salieron, luego comida, vendas, analgésicos, armas, y lo demás, a sus bolsas y manos), y a la salida. Al llegar a la base entran por el borde de ese lado. El sitio queda guardado (`leftAt`) cuando se va el último.
- **Especiales:** supervivientes: 1–2 desconocidos (`newStranger`) dentro de un edificio del sitio, con `stranger` del mapa del sitio; al verlos un colono, decisión «¿Se unen?» (como la de los desconocidos); si aceptas, pasan a ser colonos de ese mapa. Alijo: una casa aislada con el doble de botín. Peligroso: comisaría o supermercado con 30 zombis.
- **Fin de partida:** cuando no queda ningún colono vivo en ningún mapa ni de viaje. **×6 durmiendo:** duermen todos en todos los mapas, y los viajeros de noche cuentan como dormidos.
- **Pantalla:** el escenario dibuja el mapa elegido; cada mapa recuerda su cámara. Las órdenes se mandan al mapa que se ve (`issue(mapWorld, …)`); las de expedición, a la base.

## Interfaces (las que comparten varias tareas)

- `types.ts`: `Common`, `SiteKind`, `SiteSpecial`, `SiteInfo`, `Travel`, `World.common`, `World.mapId`, `World.siteMaps`, `Survivor.trip`, `ItemKind` + `roadMap`, `note`; `LogEntry.mapId?: number`; órdenes `sendExpedition`, `explore`, `returnHome`.
- `game.ts`: `stepGame(base)`, `allMaps(base): World[]`, `activeMaps(base): World[]`, `mapById(base, id): World | undefined`, `allColonists(base): { s: Survivor; where: number | 'travel' }[]`, `checkGameInvariants(base): string[]`.
- `map/site.ts`: `generateSite(kind, special, side, seed): GeneratedMap & { camp: Point[] }`.
- `sites.ts`: `discoverSite(base, opts?): SiteInfo | null`, `siteMap(base, siteId): World` (crea o despierta), `catchUp(map, info, now)`, `sitesDailySystem(base)`, `readFindings(map)` (mapas y notas del almacén).
- `expeditions.ts`: `applyExpeditionOrder(base, order)`, `tripJob(s, w)` (en `findWork`, lo primero), `exitTile(w, side)`, `leaveMap(w, s)`, `travelSystem(base)`, `arrive(base, travel)`, `loadForTrip(w, s, wanted)`.
- UI: `mapTabs` (pestañas y mapa elegido), `expeditionsPanel`, `contextMenu`; `describe.ts`: `whereText(base, s)`, `siteName(info)`.

## Review Focus

1. **Cosas y personas entre mapas:** nada se duplica ni se pierde al salir de un mapa, viajar, llegar, morir de viaje, volver o quemarse un sitio con lo de dentro (piezas, madera, armas).
2. **Ids:** que dos mapas nunca den el mismo id a personas, muebles, montones o piezas.
3. **Mapas congelados:** un sitio sin gente no avanza, y al volver no se aplica dos veces lo que pasó.
4. **Bucles:** nadie se queda yendo y viniendo al almacén o al borde (lista del grupo que no cabe, salida inalcanzable, compañero derribado).
5. **Rendimiento:** el tiempo por tick con la base y 4 sitios con gente.

## Tareas

### Task 1: La caja común

`Common` en `types.ts`, `World.common`, `World.mapId` (0), `World.siteMaps` ([]); `createWorld` y `emptyWorld` crean la caja; todos los usos de los campos que pasan a `common` (código, pruebas, partida larga y navegador, que lee `window.rimzomboid.world`) se cambian; `newGarment`/`newBag` aceptan mundo o caja; el registro de sucesos apunta `mapId` (0). Sin cambios en el juego: pasan todas las pruebas (también las de JSON de ida y vuelta). Test nuevo en `game.test.ts`: dos mundos con la misma caja comparten registro, atuendos y numeración.

### Task 2: Varios mapas a la vez

`game.ts`: `stepGame`, `allMaps`, `activeMaps`, `mapById`, `allColonists`; sistemas solo de la base (narrador, desconocidos, hordas, corte del agua, echar y volver, piedad) no actúan si `mapId !== 0`; `runTicks` usa `stepGame`; fin de partida y ×6 con todos los mapas y viajeros; `checkGameInvariants` (cada mapa, más ids únicos de personas y piezas en todo, piezas = hechas − perdidas en todo, madera y armas en todo, contando a los viajeros). Un sitio de prueba (`siteForTest`, mapa vacío con campamento) en `testing/fixtures.ts`. Tests en `game.test.ts`.

### Task 3: Generar un sitio

`map/site.ts`: `generateSite` (64×64 o 96×96; carretera que cruza; los edificios de su tipo con `buildBuilding` y `furnish`; casilla de entrada en el borde de su lado; campamento de 3×3 y plano de hoguera; árboles), botín con `fillBuilding`, `fillGarments`, `fillBags`, `fillHatchets`, zombis según tipo; todo se alcanza desde la entrada. `sites.ts`: `siteMap` crea el mundo del sitio (con su `seed` derivada, `mapId` = id del sitio, la caja común y sus edificios marcados). Tests en `site.test.ts`.

### Task 4: Sitios conocidos y descubrirlos

`common.expedition` (`sites`, `travels`, `nextSiteId`); `discoverSite` (tipo, especial, lado y horas al azar con `w.rng`; tope 10; aviso `siteFound`); objetos `roadMap` y `note` (peso, nombres, botín, zombis) y `readFindings` al descargar en un almacén; sucesos `smoke` y `radio` del narrador. Tests en `sites.test.ts`.

### Task 5: Formar el grupo y salir

Orden `sendExpedition` (con sus comprobaciones: sitio conocido, no perdido, tope de 4 activos, colonos que pueden ir); `Survivor.trip`; `tripJob` lo primero en `findWork` (prepararse en el almacén y la lista del grupo, ir a la salida); `exitTile`; `leaveMap` (quita a la persona del mapa con todo); cuando han salido todos, `Travel` de ida. Tests en `expeditions.test.ts`.

### Task 6: Viajar y llegar

`travelSystem` (horas de luz, de noche duermen; `travelerSystem` con hambre, sueño, salud, sangre, infección, comer de lo suyo y vendarse; morir de viaje: muertos, piezas perdidas, madera y armas en sus cuentas); `arrive`: al sitio (crearlo o `catchUp`, entrar por el borde) o a la base. Tests en `travel.test.ts`.

### Task 7: En el sitio y volver

Reglas del sitio (sin narrador; campamento como almacén); orden `returnHome`; `loadForTrip` por prioridad; otro grupo al mismo sitio se junta; al irse el último, `leftAt`. Tests en `expeditions.test.ts`.

### Task 8: El mundo cambia

`catchUp` (zombis por día con tope, botín que se llevan otros, una sola vez por ausencia); `sitesDailySystem` (quemarse y hordas en sitios conocidos sin gente; especiales de supervivientes que caducan); avisos. Tests en `sites.test.ts`.

### Task 9: Especiales

Supervivientes (desconocidos dentro de un edificio; decisión al verlos; aceptar los hace colonos del sitio), alijo y sitio peligroso en `generateSite`. Tests en `site.test.ts` y `expeditions.test.ts`.

### Task 10: Explorar

Orden `explore` (lado, 1 o 2 colonos); salen y el viaje dura `EXPLORE_HOURS` de luz; al volver, sitios descubiertos y heridas; vuelven por el mismo lado. Tests en `travel.test.ts`.

### Task 11: Pantalla: mapas, tarjetas y paneles por mapa

Pestañas de mapa; el escenario dibuja el mapa elegido y recuerda su cámara; tarjetas de todos con dónde están (y al pulsar, a su mapa); arriba y los paneles Almacén, Fabricar y Trabajos, del mapa que se ve; avisos y registro con el nombre del mapa (al pulsar un aviso, a su mapa); la ficha dice dónde está. Tests en `src/ui/mapsUi.test.ts`.

### Task 12: Pantalla: panel Expediciones

Sitios conocidos con su estado; formar un grupo (sitio, quién, lista de cosas con + y −); explorar (lado, quién); «Volver»; con lo pedido en pausa. Tests en `src/ui/expeditionsUi.test.ts`.

### Task 13: Construir y Fabricar más claros

Construir por grupos (Muebles; Muros y puertas; Arreglar) con lo que gasta y lo que tienes y una frase abajo; Fabricar por grupos (Curar; Tela y cortinas; Ropa; Bolsas) con «usa → da · dónde · tiempo», el motivo si no se puede y los modos de los pedidos dichos claro; «Cortinas» de Fabricar pasa a «Coser cortinas». Tests en `src/ui/craftBuildUi.test.ts`.

### Task 14: Menú del clic derecho

`contextMenu`: en una ventana (tapiar, quitar tablas, colgar, correr o abrir, descolgar, romper), puerta (reparar o arreglar), muro dañado (reparar) o plano (cancelar), con lo que gasta y lo que tienes y solo lo que tiene sentido; cuando el clic derecho no es una orden de combate; se cierra con Esc o con un clic fuera. Las opciones de ventana salen del menú Construir. Tests en `src/ui/contextMenu.test.ts`.

### Task 15: Navegador

`e2e/expeditions.spec.ts`: descubrir un sitio (por depuración), mandar un grupo, ver la pestaña del sitio, cambiar de mapa con una tarjeta, volver; `e2e/menus.spec.ts`: clic derecho en una ventana, Construir y Fabricar por grupos. Sin errores en la consola.

### Task 16: Partida larga y equilibrio

Partida larga con expediciones (explorar, ir, saquear, volver) y tiempo por tick con varios sitios; invariantes de todo el juego en cada tick. Sonda de equilibrio (12 semillas) con y sin expediciones; ajustar cifras si hace falta y apuntarlo en la spec (§10) y la hoja de ruta.
