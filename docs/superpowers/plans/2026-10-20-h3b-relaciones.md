# H3b. Relaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD en cada tarea.

**Goal:** opinión, charlas, necesidad social, peleas, consuelo, compartir comida, parejas y recién llegados.
**Spec:** `docs/superpowers/specs/2026-10-20-h3b-relaciones-design.md`.
**Nota:** el usuario pidió implementar directamente; plan compacto.

## Global Constraints

Las de H1–H3: simulación pura, serializable y determinista; cifras en `balance.ts`; textos en `es.ts`; la interfaz solo cambia el mundo mediante órdenes.

## Review Focus

1. **Que el consolado o el consolador se vayan a dormir, se desplomen o empiecen a pelear a mitad del consuelo:** nadie se queda bloqueado esperando.
2. **Dos colonos que se consuelan mutuamente o que se pelean a la vez con un tercero:** que no aparezcan acciones cruzadas incoherentes.
3. **El desconocido llega con la base llena (5 camas) o con la colonia en 8:** no aparece o duerme en el suelo, sin romper ninguna invariante.
4. **Romper con la pareja mientras duermen juntos o mientras uno consuela al otro.**
5. **Muchas charlas por tick:** que el coste por tick siga siendo bajo con 8 colonos.

## Tareas

1. **Datos:**
   - `needs.social`, `opinions`, `partnerId`, `nextChatAt`, `bubble`;
   - `Memory.otherId`;
   - `bedId` nulo y 5 sitios de cama;
   - `World.stranger` y `nextStrangerAt`;
   - opiniones iniciales;
   - invariantes;
   - `social.ts` con `opinionOf`, `changeOpinion` y `relationLabel`.
2. **Charlas:**
   - `socialSystem`: elegir con quién, tirar el tipo de charla y aplicar sus efectos (opinión, social, recuerdos, globo);
   - compartir comida;
   - la necesidad social baja; modificador "Solo";
   - la opinión se diluye cada día.
3. **Peleas:** del insulto a la pelea; acción `fight`.
4. **Consolar:** el cerebro elige consolar; acción `console`; termina la crisis.
5. **Parejas:** formarse, romper y el recuerdo "Durmió con su pareja".
6. **Recién llegados:**
   - aparición y caminar hasta la puerta;
   - órdenes de aceptar y rechazar;
   - marcharse si nadie contesta;
   - camas.
7. **Partidas largas:** añadir la de aceptar a todos.
8. **Interfaz:**
   - tarjetas dinámicas con barra Social y 💕;
   - sección Relaciones en la ficha;
   - nombres en los motivos de ánimo;
   - aviso del desconocido y pausa;
   - textos del registro.
9. **Mapa:** globos con iconos y desconocido en gris.
10. **Navegador y revisión final.**
