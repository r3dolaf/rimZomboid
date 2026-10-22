# H4c. Habilidades — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD en cada tarea.

**Goal:** seis habilidades (0–10) que mejoran con la práctica y cambian la rapidez, la carga, los fallos al construir, el consuelo y el acierto; nueve rasgos nuevos; ficha con pestañas y panel de Trabajos como matriz.
**Spec:** `docs/superpowers/specs/2026-10-22-h4c-habilidades-design.md`.
**Nota:** el usuario pidió implementar directamente; plan compacto.

## Global Constraints

Las de H1–H4b: simulación pura, serializable y determinista; cifras en `balance.ts`; textos en `es.ts` (neutros de género); la interfaz solo cambia el mundo mediante órdenes. Las habilidades se sortean con un azar propio de cada colono (no cambian el resto del mundo). Los tests de antes que dependan de duraciones, cargas o aciertos fijos usan colonos con nivel 5 (`fixtures`), que es el comportamiento de antes.

## Review Focus

1. **Determinismo y azar:** las habilidades no cambian nada más del mundo con la misma semilla; desconocidos incluidos; los fallos y el consuelo usan el azar de siempre (`w.rng`) sin romper la repetición.
2. **Avance con decimales:** terminar a la vez que antes con nivel 5; varios constructores en un mismo plano; ruido de martillo; el plano que falla vuelve a empezar y vuelve a pedir madera; la madera cuadra (`wasted`).
3. **Capacidad de cada uno:** que no quede ningún sitio con la capacidad fija (coger, saquear, dar comida, cambiar de arma, invariantes, ficha); nadie lleva más de lo que puede.
4. **Freno con carga:** andar, correr y pelear; nadie se queda parado (velocidad siempre > 0).
5. **Consuelo que falla y práctica:** sin bucles de intentos; la crisis sigue bien; la práctica no se cuenta dos veces y se para en 10.

## Tareas

1. **Datos:** `SkillId`, `Survivor.skills`, 9 rasgos nuevos (incompatibles, textos), `rollSkills` con azar propio en `createWorld` y en `newStranger`, `woodLog.wasted`, sucesos nuevos; invariantes; `fixtures` con nivel 5; tests de antes que lo necesiten.
2. **Aprender:** `skills.ts` (`skillSpeed`, `xpToNext`, `practice` con Aprende rápido/despacio, tope y registro `skillUp`).
3. **Talar y Saquear:** rapidez y práctica.
4. **Construir:** avance con decimales, ruido, fallos (madera perdida, Torpe, vuelve a empezar), práctica; registro `buildFailed`.
5. **Transportar:** `capacityKg` en todas partes, freno con carga (andar, correr, pelear), práctica.
6. **Pelear y Social:** acierto y práctica por golpe; consolar que falla (1 h sin reintentar), práctica al consolar y en charlas agradables; registro `consoleFailed`.
7. **Ficha:** pestañas General y Habilidades (barritas, recordar la pestaña), rasgos nuevos, carga con su capacidad; textos del registro y aviso verde.
8. **Panel de Trabajos:** matriz con niveles, negrita del mejor, Pelear con postura.
9. **Partidas largas, navegador y cierre:** soak de 30 días (habilidades que suben, fallos razonables, nadie atascado); e2e; medir la primera semana; hoja de ruta; revisión final.
