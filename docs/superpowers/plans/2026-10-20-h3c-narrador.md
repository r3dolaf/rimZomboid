# H3c. Narrador — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD en cada tarea.

**Goal:** un narrador con tres estilos que reparte sucesos (sociales, buenos de doble cara y sin peligro), con decisiones del jugador, avisos y portada.
**Spec:** `docs/superpowers/specs/2026-10-20-h3c-narrador-design.md`.
**Nota:** el usuario pidió implementar directamente; plan compacto.

## Global Constraints

Las de H1–H3b: simulación pura, serializable y determinista; cifras en `balance.ts`; textos en `es.ts` (neutros de género); la interfaz solo cambia el mundo mediante órdenes.

## Review Focus

1. **Decisiones** cuyo colono ya no puede (cumpleaños sin comida al contestar, desconocidos que ya se fueron) o que caducan con el juego en pausa: se resuelven siempre y sin errores.
2. **Requisitos y esperas** de cada suceso: nunca sale uno que no se puede dar (celos sin pareja, chisme con 2 colonos, alijo sin muebles).
3. **Desconocidos en pareja** con la colonia en 7 o la base llena: nunca se pasa de 8 ni se rompen las camas.
4. **Avisos que pausan:** que no vuelvan a pausar en bucle y que una decisión contestada en pausa desaparezca al momento.
5. **Determinismo:** la misma semilla y el mismo narrador dan la misma partida; la portada no cambia el mundo.

## Tareas

1. **Datos:**
   - `World.narrator`, `World.decisions`, `World.stormUntil`;
   - `Survivor.sick` y `celebrated`, recuerdos nuevos;
   - `World.stranger` con varios desconocidos;
   - `createWorld(seed, style)`;
   - invariantes y `fixtures`.
2. **Narrador:**
   - `wellbeing`, fases, ritmo y tono de cada estilo;
   - dureza, plan B de tono, esperas y el día y medio inicial;
   - `narratorSystem` y `events/catalog.ts`.
3. **Decisiones:**
   - orden `decide`, caducidad con opción por defecto;
   - el desconocido pasa a decisión (sustituye a `acceptStranger`/`rejectStranger`);
   - las llegadas las decide el narrador (suceso 10, con parejas).
4. **Sucesos sociales malos (1–6):** robo con decisión, celos, choque (también en `chatWeights`), malos recuerdos, disputa y chisme.
5. **Sucesos buenos (7–9):** noche de historias y cumpleaños (con decisión), con su lado malo; alijo.
6. **Tormenta y gripe (11–12):** `stormUntil` y sueño más lento; `sick` con hambre, ánimo, descanso y decisión.
7. **Partidas largas:** los 3 estilos contestando al azar; comprobaciones del spec §7.
8. **Interfaz:**
   - portada y dirección;
   - HUD con narrador y tormenta;
   - avisos y avisos de decisión (sustituyen al aviso del desconocido);
   - pausas;
   - textos.
9. **Mapa:**
   - centrar la cámara al pulsar un aviso;
   - oscurecer un poco con tormenta;
   - forzar un suceso en modo depuración.
10. **Navegador y revisión final.**
