# Plan de C1 — La radio y el rescate

**Spec:** `docs/superpowers/specs/2026-11-08-c1-radio-rescate-design.md`

Cada tarea con TDD, `npm test`, `npm run lint` y `npm run typecheck` en verde antes del commit.

| Tarea | Qué                                                                                                                                                         | Archivos principales                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| T1    | Radio y pilas: objetos nuevos (peso, nombres), dónde salen (su propio azar), guardar versión 5                                                              | `items.ts`, `balance.ts`, `loot.ts`, `sites.ts`, `world.ts`, `save.ts`   |
| T2    | Construir → Radio (radio en el almacén, una sola, se gasta al terminar); carga con pilas (Transportar, como la leña); encender y apagar (orden y menú)      | `build.ts`, `jobs/build.ts`, `jobs/fuel.ts`, `furniture.ts`, `orders.ts` |
| T3    | Escuchar: horas escuchadas, los tres mensajes, el punto de evacuación (sitio nuevo a 9–13 hexágonos, día N), las llamadas que descubren sitios              | `radio.ts` (nuevo), `sites.ts`, `atlas/*`, `types.ts`, `log.ts`          |
| T4    | El mapa del punto: la zona de aterrizaje y el puesto; el helicóptero (llega, ruido, horda, espera, se va, llegar tarde)                                     | `map/site.ts`, `rescue.ts` (nuevo), `game.ts`, `travel.ts`               |
| T5    | Subir: correr al helicóptero (cerebro), llevar en brazos a la zona, subir (sale de las cuentas, cama y pareja), después (decisión, final, seguir, otra vez) | `rescue.ts`, `brain.ts`, `jobs/heal.ts`, `death.ts`, `events/resolve.ts` |
| T6    | Pantalla: construir, la radio y el helicóptero en el mapa, el punto en el mundo y en Expediciones, avisos, registro, final, Ayuda, portada, consejo         | `ui/*`, `render/*`, `es.ts`                                              |
| T7    | Invariantes, partida larga del rescate, navegador, hoja de ruta y README                                                                                    | `invariants.ts`, `soak/*`, `e2e/*`, `docs/*`                             |
