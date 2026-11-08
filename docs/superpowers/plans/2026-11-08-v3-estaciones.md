# Plan de V3 — Estaciones y frío

**Spec:** `docs/superpowers/specs/2026-11-08-v3-estaciones-design.md`

Cada tarea con TDD, `npm test`, `npm run lint` y `npm run typecheck` en verde antes del commit.

| Tarea | Qué                                                                                                   | Archivos principales                                    |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| T1    | Calendario y temperatura (año, día, desviación del día, lluvia, techo, hoguera); registro de estación | `season.ts` (nuevo), `balance.ts`, `log.ts`             |
| T2    | Abrigo de la ropa, sensación térmica, ánimo, sangre y muerte de frío, calor y sed; de viaje           | `season.ts`, `clothes.ts`, `mood.ts`, `blood.ts`        |
| T3    | La hoguera gasta leña; Transportar se la lleva; apagada no alumbra, no calienta ni cocina             | `furniture.ts`, `jobs/fuel.ts` (nuevo), `jobs/craft.ts` |
| T4    | Vestirse según el frío                                                                                | `jobs/dress.ts`, `clothes.ts`                           |
| T5    | Invierno: huerto, helada, nieve, estropearse menos, zombis lentos                                     | `farm.ts`, `water.ts`, `spoil.ts`, `zombies/*`          |
| T6    | Olas de frío y de calor                                                                               | `events/*`                                              |
| T7    | Pantalla: estación y temperatura, 🥶, abrigo en la ficha, hierba por estación, hoguera apagada        | `ui/*`, `render/*`, `es.ts`                             |
| T8    | Guardar versión 4; partida larga de 60 días; navegador                                                | `save.ts`, `soak/*`, `e2e/*`                            |
