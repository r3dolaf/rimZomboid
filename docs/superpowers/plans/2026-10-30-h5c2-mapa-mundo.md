# H5c2 Mapa del mundo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Un mapa del mundo de hexágonos con terreno, niebla y 40–60 sitios; viajes por rutas de
hexágonos entre cualquier par de sitios, con paradas y cambio de destino; pestaña «🌍 Mundo».

**Architecture:** `common.atlas` (puro, JSON) con su generación; `SiteInfo.hex`; `Travel` con ruta de
hexágonos; `WorldScene` de Phaser para dibujarlo y un panel DOM para la ficha y la ruta.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-10-30-h5c2-mapa-mundo-design.md

## Global Constraints

- `src/sim` puro y determinista; todo el azar del mundo y las expediciones, con su propia sal.
- Cifras en `balance.ts`; textos en `es.ts` (neutros para personas).
- La pantalla cambia el mundo solo con `issue`; lo pedido en pausa se ve.
- Invariantes en cada tick de la partida larga.

## Review Focus

1. Rutas imposibles (agua, niebla que esconde agua, destino perdido o quemado a mitad de camino).
2. Cambiar de destino con gente aún saliendo (pendientes) o de noche.
3. Sitios que se descubren a la vez por varias vías (sin duplicar avisos).
4. La pestaña Mundo con el juego corriendo (cámara, clics que no caen en el mapa normal).
5. Rendimiento: dibujar ~1.300 hexágonos y el tiempo por tick con varios viajes.

## Tareas

### Task 1: Hexágonos

`src/sim/atlas/hex.ts`: índice ↔ (col, fila), vecinos (6, dentro del mapa), distancia, centro en
píxeles, `sideFrom(a, b)` (0 norte, 1 sur, 2 oeste, 3 este), hexágonos a radio ≤ r. Tests en
`src/sim/atlas/hex.test.ts`.

### Task 2: Generar el mundo

`src/sim/atlas/generate.ts`: `generateAtlas(seed)` con terreno, ríos, pueblos, carreteras y puentes;
`Atlas` en `types.ts`; cifras en `balance.ts`. Tests: misma semilla = mismo mundo; base y pueblos sin
agua; todo pueblo alcanzable por carretera desde la base; porcentajes razonables.

### Task 3: La caja común con el mundo y los sitios repartidos

`common.atlas` en `createWorld` (y uno pequeño en `emptyWorld`); `placeSites(atlas, rng)` con
40–60 sitios ocultos según el terreno; `SiteInfo.hex`, `state: 'hidden'`; niebla inicial.
Invariantes: un sitio por hexágono válido. Tests.

### Task 4: Niebla y descubrir

`reveal(w, center, radius, how, survivorId?)`: despeja y descubre los sitios ocultos de la zona
(con `side`, `hours`, especial); `discoverSite` para mapas, notas, humo y radio con las reglas
nuevas; sin tope de 10. Tests (reescribir los de H5c1 que dependían de lado y horas al azar).

### Task 5: Rutas

`src/sim/atlas/route.ts`: `hexHours`, `findRoute(atlas, from, to, waypoints)` (A*, niebla = campo,
agua sin puente no), `routeHours`. Tests.

### Task 6: Viajar por hexágonos

`Travel` nuevo (destino, paradas, `path`, `at`, `hoursLeft`); `travelSystem` hexágono a hexágono de
día, despejando; rehacer si aparece agua; salir y entrar por el lado de la ruta; explorar con vuelta.
Ajustar `expeditions.ts`, `travel.ts` y sus tests.

### Task 7: Órdenes nuevas

`sendExpedition` desde cualquier mapa (campo `from`) con paradas; `explore` a un hexágono;
`redirectTravel`; `returnHome` con ruta. Todo a la base. Tests.

### Task 8: Escena del mundo

`src/render/WorldScene.ts`: hexágonos, carreteras, ríos, pueblos, niebla, base, sitios y grupos;
cámara; la pestaña «🌍 Mundo» en `mapView`/`mapTabs` cambia de escena. Tests de lo que no es Phaser
(`src/ui/worldUi.test.ts`).

### Task 9: Ficha, ruta y panel Expediciones

`src/ui/worldPanel.ts`: ficha del hexágono o del grupo con sus botones; ruta dibujada y paradas
(arrastrar y botón derecho); panel Expediciones con «desde», zona a explorar y «Ver en el mapa».
Tests en `src/ui/worldUi.test.ts`.

### Task 10: Navegador, partida larga y equilibrio

`e2e/world.spec.ts`; partida larga con viajes entre sitios y cambios de destino; sonda de equilibrio;
spec §8 y hoja de ruta.
