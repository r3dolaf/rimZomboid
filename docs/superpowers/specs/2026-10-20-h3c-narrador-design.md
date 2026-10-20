# rimZomboid — H3c Narrador: diseño

Fecha: 2026-10-20
Estado: aprobado en conversación. Hito nuevo entre H3b y H4. El usuario pidió implementarlo directamente.

## 1. Objetivo

Un narrador, como los de RimWorld, decide cuándo pasan cosas y de qué tono son, mirando cómo va la colonia. Además de sucesos sin peligro, trae **sucesos sociales** que mueven el ánimo y las relaciones, sobre todo hacia lo negativo, que ahora cuesta provocar (tienden a ir a positivo). Algunos sucesos piden una decisión al jugador. En H4 las hordas serán un suceso más.

**Criterio de éxito:** en una partida normal con el Equilibrado se notan altibajos: rachas buenas, roces, alguna rivalidad; el ánimo no se queda plano; y cada cambio se explica en un aviso y en el registro.

## 2. El narrador

### 2.1 Bienestar de la colonia (0–100)

`bienestar = 0,4 · ánimo medio + 0,3 · opinión media + 0,3 · comida`, donde:

- **ánimo medio:** el de los colonos (0–100);
- **opinión media:** la media de las opiniones de cada colono sobre cada uno de los demás, pasada a 0–100 como `(o + 100) / 2`; con un solo colono vale 50;
- **comida:** `min(1, días de comida / 5) · 100`, con `días de comida = latas (almacén + encima) / (colonos · 70 / 60)` (cada colono gasta unas 1,17 latas al día).

Se calcula cuando el narrador decide y cada hora, para cortar una racha de tensión.

### 2.2 Estado

`World.narrator = { style, phase, phaseEndsAt, nextEventAt, lastAt }`:

- `style`: `'calm' | 'balanced' | 'chaotic'` (Tranquilo, Equilibrado, Caótico);
- `phase`: `'calm' | 'tension'` (solo la usa el Equilibrado);
- `nextEventAt`: tick del siguiente suceso;
- `lastAt`: por cada suceso, el tick en que salió por última vez (para su espera).

Todo es serializable y usa el generador con semilla del mundo: la misma semilla y el mismo narrador dan la misma partida.

### 2.3 Estilos

| Estilo          | Ritmo                                                                                                                           | Tono que busca                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Equilibrado** | Alterna **calma** (2–3 días, un suceso cada 1,5–2,5 días) y **tensión** (1–2 días, un suceso cada 0,5–1 día). Empieza en calma. | En calma: bueno 60 %, mixto 40 %; con bienestar < 35, bueno. En tensión: malo; si el bienestar baja de 25, la tensión acaba en esa misma hora y empieza la calma. |
| **Tranquilo**   | Un suceso cada 2–4 días.                                                                                                        | Bueno 35 %, mixto 25 %, malo 40 %. Con bienestar < 40 nunca malo (bueno o mixto).                                                                                 |
| **Caótico**     | Entre 6 h y 3 días al azar; un 20 % de las veces, otro suceso 1 h después.                                                      | Bueno, mixto o malo por igual, sin mirar el bienestar.                                                                                                            |

**Cambio de fase:** al pasar de calma a tensión (o al revés), si el siguiente suceso queda más lejos que el ritmo de la nueva fase, se adelanta: `nextEventAt = min(nextEventAt, ahora + ritmo de la nueva fase)`.

**Tranquilo con bienestar < 40:** se reparte entre bueno y mixto en la misma proporción (35 : 25).

**Dureza en tensión (Equilibrado):** cada suceso malo tiene una dureza de 1 a 3. Con bienestar ≥ 60 el peso de cada suceso se multiplica por su dureza; con bienestar < 40, por `4 − dureza`. Así, cuanto mejor va la colonia, más duros son.

### 2.4 Elegir un suceso

1. Decide el tono buscado (tabla anterior).
2. Se queda con los sucesos de ese tono que **se pueden dar**: cumplen sus requisitos y ha pasado su espera desde la última vez.
3. Sortea uno según su peso (todos pesan 1 salvo lo dicho en la dureza).
4. Si no hay ninguno, prueba el tono más cercano: desde bueno, mixto y luego malo; desde malo, mixto y luego bueno; desde mixto, bueno y luego malo.
5. Si no hay ninguno de ningún tono, lo reintenta en 1 hora.
6. Cuando el estilo no permite sucesos malos (Tranquilo con bienestar < 40, respiro del Equilibrado), el plan B tampoco los usa: si no hay buenos ni mixtos, se reintenta en 1 hora. (Ajustado tras la revisión: en partidas largas se acaban los buenos y caía en uno malo justo entonces.)

**Inicio:** el primer día y medio no hay sucesos (`nextEventAt` = 1,5 días). El Equilibrado empieza en calma hasta el día 2–3.

## 3. Catálogo de sucesos

Cada suceso tiene: **tono** (bueno 🟢, mixto 🟡, malo 🔴), **dureza** (los malos), **espera** (días antes de poder repetirse), **requisitos** (`canHappen`) y **efectos** (`happen`). Un archivo por suceso en `src/sim/events/`.

"Colono disponible" = despierto, sin crisis, sin pelear y sin consolar ni ser consolado. Los recuerdos nuevos llevan `otherId` cuando son con alguien; un recuerdo nuevo del mismo tipo sustituye al anterior (como en H3b).

### 3.1 Sociales malos

| Suceso                             | Dureza | Espera | Requisitos                                                       | Efectos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------ | ------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Raciones robadas** (decisión) | 3      | 6 días | ≥ 3 latas en el almacén y ≥ 3 colonos                            | Faltan 1–3 latas del almacén. **Sospechoso:** un colono al azar con peso 1, ×2 si tiene hambre < 50, ×2 si es Glotón, ×1,5 si es Pesimista. **Culpable de verdad** con un 60 %. Todos los demás bajan 10 su opinión del sospechoso. **Decisión** (por defecto, _Dejarlo estar_): **Castigar** → el sospechoso recibe "Le castigaron" −15 (48 h); si era inocente, en su lugar "Le castigaron sin culpa" −25 (72 h) y baja 20 su opinión de todos los demás; el registro cuenta la verdad ("X confesó" o "Más tarde se supo que X era inocente"). **Dejarlo estar** → los demás bajan otros 10 su opinión de él y reciben "Alguien nos roba" −5 (48 h). |
| **2. Celos**                       | 2      | 5 días | Una pareja (A, B) y un tercero C con opinión de B ≥ 20           | A recibe "Celos de C" −10 (24 h) y baja 20 su opinión de C; A y B bajan 10 su opinión mutua (puede acabar en ruptura por la regla de H3b).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **3. Choque de caracteres**        | 2      | 4 días | Dos colonos que no son pareja y se tienen < 30 en ambos sentidos | Los dos reciben "No soporta a X" −5 (72 h). Mientras dure, en sus charlas entre ellos la discusión +30 y el insulto +10, y el insulto es posible aunque estén de buen ánimo y con opinión ≥ 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **4. Malos recuerdos**             | 2      | 3 días | Un colono disponible                                             | "Recuerda a los suyos" −20 (48 h).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **5. Disputa por el reparto**      | 2      | 4 días | ≥ 2 colonos y menos de 2 latas por colono (almacén + encima)     | Todos bajan 5 su opinión de todos y reciben "Discusión por la comida" −5 (24 h).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **6. Chisme**                      | 1      | 3 días | ≥ 3 colonos                                                      | Chismoso A, oyente B y víctima C, distintos. A: peso 1, ×2 si es Pesimista; C: la persona que peor le cae a A. B al azar. B baja 15 su opinión de C. Con un 30 %, C se entera: baja 20 su opinión de A, y queda en el registro.                                                                                                                                                                                                                                                                                                                                                                                                                        |

### 3.2 Buenos (de doble cara)

| Suceso                       | Espera | Requisitos                                                             | Efectos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **7. Noche de historias**    | 3 días | Entre las 19:00 y las 23:00 y ≥ 2 colonos despiertos dentro de la base | Los participantes (despiertos en la base) reciben "Noche de historias" +8 (24 h) y ganan 3 de opinión entre sí. **Sale mal** con un 40 % si entre ellos hay rivales (alguno tiene al otro en ≤ −40) o alguien al límite (< 25): la pareja que discute es la de rivales (la de peor opinión) o, si no, el que está al límite y quien peor le cae. Esos dos no reciben el +8, pierden 10 de opinión mutua y reciben "Discutió con X"; los demás sí lo celebran.                                                                                  |
| **8. Cumpleaños** (decisión) | 5 días | Un colono que aún no ha tenido su cumpleaños (`celebrated` falso)      | Se elige uno al azar y se marca `celebrated`. **Decisión** (por defecto, _No hay para fiestas_): **Celebrarlo con 2 latas** (solo si quedan 2 en el almacén al contestar) → −2 latas; el cumpleañero recibe "Cumpleaños feliz" +15 (24 h), los demás "Fiesta" +5 (12 h) y todos le aprecian 5 más. **Sale mal** con un 30 % si alguien le tiene en ≤ −40: el cumpleañero recibe "Le amargaron el cumpleaños" −10 (24 h) en lugar del +15 y baja 15 su opinión de ese rival. **No hay para fiestas** → "Nadie celebró su cumpleaños" −8 (48 h). |
| **9. Alijo descubierto**     | 4 días | Alguna casa con muebles                                                | Un colono al azar recuerda una despensa: se suman 3–6 latas a un mueble de esa casa y se revela todo su interior. Se prefiere una casa cuyo interior aún no se ha visto, luego una con muebles sin registrar y, si no, cualquiera: es una despensa escondida y ese mueble vuelve a estar sin registrar. No se marca sola. (Ajustado al implementar: con todas las casas marcadas, los muebles quedan registrados el primer día y el alijo nunca salía.)                                                                                        |

### 3.3 Mixto y sin peligro

| Suceso                          | Tono | Dureza | Espera | Requisitos                                                  | Efectos                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ---- | ------ | ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **10. Desconocidos** (decisión) | 🟡   | —      | 3 días | Colonia < 8, sin desconocidos esperando, a partir del día 3 | Como en H3b, pero un 25 % de las veces llegan **dos** (si caben los dos en la colonia), ya en pareja (`partnerId` mutuo) y con 60–80 de opinión mutua. `World.stranger` pasa a `{ survivors, leaving }` (la caducidad la lleva su decisión). **Decisión** (por defecto, se marchan al cabo de 1 día): **Aceptar** (a todos, con cama mientras queden) o **Rechazar**. `World.nextStrangerAt` desaparece: las llegadas las decide el narrador. |
| **11. Tormenta**                | 🔴   | 1      | 4 días | Ninguno                                                     | `World.stormUntil` = ahora + 8–12 h. Todos reciben "Tormenta" −6 (18 h). Mientras dura, el sueño se recupera un 25 % más despacio. El HUD muestra "🌧 Tormenta".                                                                                                                                                                                                                                                                               |
| **12. Gripe** (decisión)        | 🔴   | 2      | 5 días | Un colono que no esté enfermo                               | `Survivor.sick = { until, plan }` (`plan`: `'undecided'                                                                                                                                                                                                                                                                                                                                                                                       | 'rest' | 'work'`, para que "Trabaja con gripe" no salga antes de contestar): dura 4 días desde que empieza; mientras, "Con gripe" −10 y el hambre baja ×1,3. **Decisión** (por defecto, _Que siga trabajando_): **Que descanse** → se cura a los 2 días de empezar y no saquea mientras tanto; **Que siga trabajando** → 4 días y además "Trabaja con gripe" −5 mientras dure. No mata. |

## 4. Decisiones

- `World.decisions: Decision[]`, con `{ id, kind, survivorIds, expiresAt }` y lo que cada suceso necesite (p. ej., si el sospechoso es culpable). `kind`: `'theft' | 'birthday' | 'flu' | 'stranger'`.
- Opción por defecto al caducar (1 día de juego): robo → _Dejarlo estar_; cumpleaños → _No hay para fiestas_; gripe → _Que siga trabajando_; desconocidos → se marchan.
- El jugador contesta con la orden `{ type: 'decide', decisionId, option: 0 | 1 }` (la opción 0 es la primera: Castigar, Celebrar, Que descanse, Aceptar). Sustituye a `acceptStranger` y `rejectStranger`.
- Una decisión cuyo colono ya no está (o un cumpleaños sin comida para celebrar) se resuelve con la opción que sí se pueda.

## 5. Pantalla

### 5.1 Portada

- Al abrir el juego **sin `seed` en la dirección**: título, tres tarjetas (Tranquilo, Equilibrado —marcado—, Caótico) con nombre y una frase, la semilla al azar (editable, con botón para sortear otra) y **Empezar**.
- Al empezar, la dirección pasa a `?seed=…&narrador=…` sin recargar. Con `seed` en la dirección se entra directo; sin `narrador`, Equilibrado.
- El HUD muestra "Narrador: Equilibrado" junto a la semilla.

### 5.2 Avisos

- Columna arriba a la izquierda, bajo el HUD. Cada suceso del narrador deja un aviso: franja de color según el tono, título, una frase con los nombres y ✕.
- **Pulsar el aviso** centra la cámara en el colono implicado y abre su ficha.
- Desaparece al cabo de 1 día de juego o con la ✕; como mucho 5 a la vez (se quitan los más viejos).
- Los **rojos pausan** el juego al aparecer, una sola vez por aviso.
- Todo queda también en el registro de sucesos.

### 5.3 Avisos de decisión

- Con **dos botones**; pausan al aparecer (sea cual sea el color) y no tienen ✕.
- Al contestar desaparecen al momento, aunque el juego esté en pausa (orden pendiente).
- Si se reanuda sin contestar, siguen ahí hasta que caducan y se aplica la opción por defecto.
- El aviso del desconocido de H3b pasa a ser uno de estos.
- El botón _Celebrarlo con 2 latas_ se ve desactivado si no quedan 2 latas.

## 6. Datos y sistemas

- `createWorld(seed, style = 'balanced')`. Lo nuevo del narrador se sortea después de todo lo anterior, para no cambiar partidas ya conocidas.
- `Survivor`: `sick: { until; plan } | null`, `celebrated: boolean`. Recuerdos nuevos: `punished`, `punishedUnfairly`, `thiefAmongUs`, `jealous`, `clash`, `grief`, `foodFight`, `storyNight`, `happyBirthday`, `party`, `ruinedBirthday`, `forgottenBirthday`, `storm`. "Con gripe" y "Trabaja con gripe" son motivos de estado, no recuerdos.
- `src/sim/narrator.ts`: `wellbeing(w)`, fases, tono y elección; `narratorSystem(w)` va justo después de `socialSystem`. También resuelve las decisiones caducadas.
- `src/sim/events/`: un archivo por suceso con `{ id, tone, severity?, cooldownDays, canHappen(w), happen(w) }` y `catalog.ts` con la lista.
- Registro: cada suceso deja una entrada propia (`kind` = el id del suceso o su resultado) con los ids implicados; la interfaz hace los avisos a partir de esas entradas y de `World.decisions`.
- Todas las cifras en `balance.ts`; todos los textos en `es.ts` (neutros de género, como en H3b).

## 7. Pruebas

- **Unitarias:** cada suceso (requisitos, efectos, las dos caras y cada opción de decisión, incluida la caducidad); el narrador (fases y separación de cada estilo, tono buscado, dureza, plan B de tono, esperas, el día y medio inicial y el bienestar).
- **Partidas automáticas de 30 días**, con los 3 estilos y 3 semillas, saqueando y contestando las decisiones al azar: invariantes y nadie bloqueado. En el Equilibrado, ≥ 8 sucesos y alguna fase de tensión; alguien pasa por el límite (< 25) y aparece alguna opinión negativa. En total, el Tranquilo saca menos sucesos que el Caótico.
- **Navegador:** portada → Caótico → Empezar → la dirección lleva `narrador=caotico`; un suceso forzado (modo depuración) muestra su aviso; una decisión pausa y sus botones funcionan.
