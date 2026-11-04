# H6d Equilibrio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la colonia aguante hacia el día 25 con más antibióticos a mano y menos infecciones, con los números elegidos por una sonda.

**Architecture:** Un número nuevo (`START_ANTIBIOTICS`) que `createWorld` pone en el almacén y cuatro números de `balance.ts` ajustados con una sonda desechable (fuera del repo, en un worktree del scratchpad).

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-h6d-equilibrio-design.md`

## Global Constraints

- Límites: `START_ANTIBIOTICS` 1–3; `WOUNDS.scratch.infect` ≥ 0,015; `MAUL_BITE_CHANCE` ≥ 0,025; el mordisco sigue con `infect: 1`.
- Números en `balance.ts`; `src/sim` puro y determinista.
- La sonda no entra en el repo.

## Review Focus

1. Partidas guardadas antes de H6d: se cargan igual (no cambia el formato).
2. El soak sigue cuadrando (los antibióticos del principio no rompen ninguna cuenta).
3. Las pruebas que fijaban los números viejos se actualizan, no se borran.
4. Los modos Tranquilo/Caótico y pocos/muchos zombis siguen funcionando (mismos números).
5. Que los antibióticos del principio se vean en el almacén desde el día 1.

## Tareas

### Task 1: Antibióticos al empezar

- `START_ANTIBIOTICS` en `balance.ts` (valor inicial 2, lo ajusta la Task 2); `createWorld` lo pone en el almacén.
- Test: `createWorld(s).storage.items.antibiotics === START_ANTIBIOTICS` y `> 0`.

### Task 2: Sonda y ajuste

- Sonda de 36 semillas (con y sin expediciones) en un worktree del scratchpad: base (main) y combinaciones de menos a más.
- Fijar los números elegidos; actualizar las pruebas que los fijan.

### Task 3: Partida larga, e2e y hoja de ruta

- Soak y e2e en verde; resultados en la spec (§5) y en la hoja de ruta.
