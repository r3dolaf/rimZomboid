# H4c Habilidades — diseño

Estado: aprobado en conversación. El usuario pidió implementar directamente ("dale caña e implementa"). Después de H4b el usuario pidió habilidades por trabajo; en el diseño salieron también las cortinas, la tela y los cuerpos de zombi, que van en su propio hito (**H4d Tela, cortinas y cuerpos**). Lo que era H4c (hordas, modo combate, Sanar, menú de avisos) pasa a **H4e Hordas y mando**.

## 1. Objetivo

Cada colono es distinto y repartir los trabajos importa:

- cada colono tiene una habilidad en cada trabajo, y en pelear;
- la habilidad hace el trabajo más rápido o más lento, y puede hacer fallar lo complejo (construir);
- las habilidades mejoran con la práctica (no se olvidan);
- nueve rasgos nuevos tocan las habilidades.

Fuera de este hito: elegir solo al mejor para cada trabajo (prioridades, H6), Medicina (con Sanar), olvidar lo que no se usa.

## 2. Habilidades y rasgos

### 2.1 Habilidades

`SkillId = 'social' | 'build' | 'haul' | 'chop' | 'loot' | 'fight'`: las cinco de los trabajos (mismo nombre que `WorkType`) y Pelear. En pantalla: Social, Construir, Transportar, Talar, Saquear y Pelear, en ese orden (el de los trabajos, H4a §3.1, y Pelear al final).

`Survivor.skills: Record<SkillId, { level: number; xp: number }>`:

- `level`, entero de 0 a 10;
- `xp`, la práctica acumulada hacia el siguiente nivel (0 ≤ xp < lo que cuesta subir; a nivel 10, siempre 0).

### 2.2 Al empezar

`rollSkills(rng, traits)`:

1. cada habilidad, al azar entre 0 y 3;
2. una de ellas al azar, la especialidad, entre 5 y 7;
3. los rasgos suman o restan (tabla de §2.3), sin bajar de 0 ni pasar de 10;
4. `xp` a 0.

**Azar propio:** se sortean con un azar de cada colono, `createRng(semilla del mundo ^ (id · 0x9e3779b1))`. Así añadir habilidades no cambia nada más del mundo con la misma semilla (como `zombieRng` en H4b). Lo mismo para los desconocidos que llegan (H3b): con su id.

### 2.3 Rasgos nuevos

Nueve rasgos, en parejas incompatibles como Valiente/Cobarde. Nombres que valen igual para cualquier persona (por eso "Agradable" y no "Encantador"):

| Rasgo (id)                       | Efecto                                          |
| -------------------------------- | ----------------------------------------------- |
| Manitas (`handy`)                | +2 en Construir                                 |
| Torpe (`clumsy`)                 | −2 en Construir; falla un 10 % más al construir |
| Fuerte (`strong`)                | +2 en Transportar y en Talar                    |
| Débil (`weak`)                   | −2 en Transportar y en Talar                    |
| Aprende rápido (`fastLearner`)   | la práctica cuenta ×1,5                         |
| Aprende despacio (`slowLearner`) | la práctica cuenta ×0,5                         |
| Agradable (`pleasant`)           | +2 en Social                                    |
| Desagradable (`unpleasant`)      | −2 en Social                                    |
| Buen ojo (`keenEye`)             | +2 en Saquear                                   |
| Valiente / Cobarde (ya existían) | además, +2 / −2 en Pelear                       |

- Parejas incompatibles nuevas: Manitas/Torpe, Fuerte/Débil, Aprende rápido/Aprende despacio, Agradable/Desagradable.
- Cada colono sigue teniendo 1–2 rasgos, ahora entre 15.

## 3. Qué hace cada habilidad

**Rapidez:** `skillSpeed(nivel) = 0,5 + 0,1 · nivel`. Con 0, la mitad de rápido; con 5, como antes de H4c; con 10, un 50 % más.

### 3.1 Construir

- **Rapidez:** cada tick de trabajo suma `skillSpeed` al avance del plano (`Blueprint.progress` deja de ser entero). Se termina al llegar a `BUILD[tipo].ticks`. El ruido de martillo suena cada vez que el avance pasa un múltiplo de `BUILD_NOISE_TICKS`.
- **Puede fallar al terminar** (todo lo que lleva madera; destapiar no):
  - probabilidad `máx(0; 0,30 − 0,04 · nivel)`, y Torpe suma 0,10: con 0, un 30 %; con 5, un 10 %; desde el 8, nunca (Torpe, siempre un 10 % como poco);
  - al fallar se pierde **la mitad de la madera del plano, redondeando hacia arriba** (un muro de 2 pierde 1; una reparación de 1 pierde 1), el avance vuelve a 0 y el plano sigue ahí: Transportar vuelve a traer lo que falta;
  - la madera perdida va a `woodLog.wasted` (la madera sigue cuadrando);
  - registro: "X ha fallado al construir el muro (−1 de madera)". Sin aviso.
- Reparar (`repair`, `fixDoor`, `board` sobre una ventana rota y `woodWall` sobre escombros) es construir: misma rapidez y mismos fallos.

### 3.2 Talar

- Talar dura `CHOP_TICKS / skillSpeed` (redondeado; con 5, 1 h como ahora).

### 3.3 Transportar

- **Capacidad:** `capacityKg(s) = 6 + 0,4 · nivel` kg (con 5, los 8 kg de antes; con 10, 10 kg). Sustituye a `CARRY_CAPACITY_KG` en todas partes (coger de montones y contenedores, ir a saquear, dar comida, invariantes y ficha).
- **Ir cargado frena** (nuevo): la velocidad, andando o corriendo, se multiplica por `1 − freno · (carga / capacidad)`, con `freno = 0,40 − 0,03 · nivel` (a plena carga: 40 % más lento con 0, 25 % con 5, 10 % con 10). Vale también al huir y al ir a por un zombi.

### 3.4 Saquear

- Registrar un contenedor dura `SEARCH_TICKS / skillSpeed` (redondeado). En H4d, también registrar cuerpos.

### 3.5 Social

- **Consolar puede no funcionar:** al terminar, sale bien con probabilidad `0,5 + 0,05 · nivel` (50 % con 0, 75 % con 5, siempre con 10).
- Si sale mal:
  - sin "Le consoló" ni opinión; los dos vuelven a decidir (la crisis vuelve si el ánimo sigue bajo);
  - durante 1 h nadie vuelve a intentar consolar a esa persona (si no, lo intentarían una y otra vez);
  - registro: "X ha intentado consolar a Y, sin éxito". Sin aviso.

### 3.6 Pelear

- Acierto de los golpes a un zombi: `0,5 + 0,04 · nivel` (50 % con 0, 70 % con 5 como antes, 90 % con 10). El daño sigue siendo el del arma.

**Quién hace cada trabajo no cambia:** quien esté libre y lo tenga marcado.

## 4. Aprender

**Práctica** (`xp`), en ticks de trabajo:

| Habilidad   | Gana                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| Construir   | 1 por tick construyendo o reparando (aunque luego falle)                  |
| Talar       | 1 por tick talando                                                        |
| Saquear     | 1 por tick registrando                                                    |
| Transportar | 1 por tick andando o corriendo con algo encima                            |
| Pelear      | por cada golpe a un zombi, acierte o no, los ticks que tarda el arma      |
| Social      | 60 por cada vez que consuela (salga bien o mal) y 10 por charla agradable |

- Aprende rápido ×1,5; Aprende despacio ×0,5.
- **Subir:** del nivel N al N+1 cuesta `(N + 1) · TICKS_PER_HOUR`: 1 h de práctica de 0 a 1, 5 h de 4 a 5, 10 h de 9 a 10. La práctica que sobra pasa al nivel siguiente; a 10 ya no se gana más.
- **Al subir:** registro "X ha mejorado en Construir (nivel 4)" y aviso verde que no pausa (H3c §5.2), que enfoca al colono.
- Sin olvido.

## 5. Pantalla

- **Ficha con pestañas:** **General** (lo de ahora: Salud, necesidades, ánimo, rasgos, arma, postura, relaciones) y **Habilidades**: una fila por habilidad con el nombre, el nivel y una barrita de la práctica hacia el siguiente ("máx." a 10). La ficha recuerda la última pestaña (`localStorage`, con try/catch).
- **Rasgos:** los nuevos salen con su explicación al pasar el ratón, como los de antes. Valiente y Cobarde dicen también lo de Pelear.
- **Panel de Trabajos como matriz:** una fila por colono y una columna por habilidad (Social, Construir, Transportar, Talar, Saquear, Pelear):
  - en las cinco de los trabajos, la casilla de marcar y al lado su nivel ("☑ 7");
  - en Pelear, su nivel y el desplegable de Postura (pelear no se marca);
  - el nivel más alto de cada columna, en negrita (si empatan, todos).
- **Ficha, carga:** "Lleva 3,0 / 8,4 kg" con su capacidad.
- **Registro y avisos:** subir de nivel (aviso verde), fallar al construir y consolar sin éxito (solo registro).

## 6. Datos, órdenes e invariantes

- **Tipos:** `SkillId`, `Survivor.skills`, 9 `TraitId` nuevos, `Blueprint.progress` con decimales, `woodLog.wasted`, sucesos `skillUp`, `buildFailed`, `consoleFailed`, y el recuerdo sin efecto en el ánimo que bloquea consolar 1 h.
- **Módulo nuevo** `src/sim/skills.ts`: `rollSkills`, `skillSpeed`, `capacityKg`, `loadFactor`, `buildFailChance`, `consoleChance`, `hitChance`, `xpToNext`, `practice` (suma práctica, sube de nivel y lo registra).
- **Invariantes:** niveles enteros de 0 a 10; `0 ≤ xp < xpToNext(nivel)` (0 a nivel 10); nadie lleva más de su capacidad; el avance de un plano entre 0 y sus ticks; la madera cuadra con `wasted`.
- Sin órdenes nuevas.

## 7. Pruebas

- **Reglas:** cómo empiezan (rango, especialidad, rasgos, azar propio: el resto del mundo no cambia); rapidez de construir, talar y saquear con 0, 5 y 10; fallos al construir (probabilidad, madera perdida, el plano vuelve a empezar, se trae lo que falta, Torpe); capacidad y freno con carga (andando y huyendo); acierto al pelear; consolar sin éxito y la hora sin reintentar; práctica (cada fuente, coste de cada nivel, Aprende rápido/despacio, tope en 10, registro); rasgos incompatibles.
- **Con nivel 5:** rapidez, capacidad y acierto iguales que antes de H4c. Lo nuevo con nivel 5 son los fallos al construir (10 %), el freno con carga y el consuelo que falla (25 %).
- **Pantalla:** pestañas de la ficha (y que recuerda la última), matriz del panel con la negrita, textos del registro y aviso verde; e2e: abrir la ficha, pestaña Habilidades, y el panel.
- **Partidas largas de 30 días:** nada se rompe; al final ha subido alguna habilidad; los fallos al construir no se disparan; nadie se queda sin llegar por ir cargado.
- **Equilibrio:** se mide cómo cambia la primera semana (niveles bajos al empezar) y se apunta en la hoja de ruta.
