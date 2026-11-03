# H6a Equilibrio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Antibióticos contra la infección de arañazos (en la decisión de la fiebre y solos de
viaje), sitios con especialidad de botín y la colonia hacia el día 25 con expediciones.

**Architecture:** objeto `antibiotics`; `infection.bite`; opción 3 de la fiebre; `SITE_LOOT` sumado
al botín de los sitios; textos de especialidad en la ficha y el panel.

**Tech Stack:** TypeScript, Phaser 4, Vite, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-11-03-h6a-equilibrio-design.md

## Global Constraints

- `src/sim` puro y determinista; cifras en `balance.ts`; textos en `es.ts`.
- La pantalla cambia el mundo solo con `issue`.
- Invariantes en cada tick de la partida larga.

## Review Focus

1. Dar antibióticos a quien ya no tiene fiebre o ya no está (la decisión caduca o se contesta tarde).
2. Un mordisco después de una infección de arañazo (y al revés).
3. La opción con el almacén vacío pero el enfermo con uno encima (y en un sitio, su campamento).
4. Viajeros con infección y antibióticos.
5. Que el botín nuevo no rompa las cuentas (armas de los sitios en `weaponLog`).

## Tareas

### Task 1: Antibióticos

- Objeto `antibiotics` (items, peso, nombres, `LOOT`, muebles `medicine`).
- `infection.bite`.
- Opción 3 de la fiebre (`DecisionOption` 0–3, orden `decide`).
- De viaje, solos.
- Registro `antibiotics` (y `infectionCured`).
- Tests en `src/sim/antibiotics.test.ts`.

### Task 2: Sitios con especialidad

- `SITE_LOOT` y el pueblecito siempre con farmacia.
- Textos de especialidad en la ficha del mundo y en la lista de Expediciones.
- Tests.

### Task 3: Pantalla de la decisión

- El botón «Antibióticos y que descanse (quedan N)», apagado si no hay.
- Tests.

### Task 4: Partida larga, sonda y documentación

- Partida larga (que también conteste con antibióticos).
- Sonda y ajuste de `SITE_LOOT`.
- Spec §4 y hoja de ruta.
