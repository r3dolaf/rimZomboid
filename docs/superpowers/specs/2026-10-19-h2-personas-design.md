# rimZomboid — H2 Personas: diseño

Fecha: 2026-10-19
Estado: aprobado en conversación; complementa al diseño general
(`docs/superpowers/specs/2026-10-19-rimzomboid-design.md`, §4.1, §4.2, §5.2 y §9).

## 1. Objetivo

Los supervivientes comen, duermen y cambian de ánimo por sí solos, con rasgos que los
diferencian, y el jugador lo ve en pantalla: tarjetas abajo y ficha con el porqué del ánimo.

## 2. Decisiones de esta fase

| Tema                   | Decisión                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Interfaz               | Se adelantan a H2 las tarjetas de la barra inferior y la ficha del superviviente (spec §9). El registro de sucesos sigue en H3. |
| Comida inicial         | 35 latas (~10 días para 3 supervivientes). En H3 bajará a "unos pocos días".                                                    |
| Muerte                 | No hay en H2. Desnutrido solo afecta al ánimo; la salud llega en H5.                                                            |
| Al límite (ánimo < 25) | Se marca en la tarjeta; negarse a trabajar llega en H3.                                                                         |
| Valiente / Cobarde     | Se asignan y se ven en la ficha; sus efectos llegan en H3/H4.                                                                   |

## 3. Necesidades (0–100)

Todas las cifras en `src/sim/balance.ts`; son valores iniciales.

- **Hambre:** baja 70 puntos por día de juego (×1,5 si es Glotón).
  - Va a comer si el hambre es menor que 35 **y** queda comida en el almacén.
  - Comer: caminar a una casilla del almacén y estar 30 ticks (6 min de juego) comiendo. Al terminar, si queda comida: −1 lata, +60 de hambre (máximo 100) y el recuerdo "Comió".
- **Sueño:** despierto baja 100 en 16 h (×1,3 si es Dormilón). Durmiendo sube 100 en 8 h en cama, o al 75 % de esa velocidad en el suelo.
  - Se acuesta de noche (22:00–06:00) si el sueño es menor que 95, o a cualquier hora si es menor que 10 (siesta). Va a **su** cama.
  - Se despierta cuando el sueño llega a 100, **pero nunca de noche**: de noche sigue en la cama hasta las 06:00. Al despertar gana el recuerdo "Durmió en una cama" o "Durmió en el suelo".
  - _Cambio durante la implementación:_ con "< 50" y despertar a cualquier hora, quien echaba una siesta de tarde se despertaba de madrugada y nunca volvía a dormir de noche.
  - Si el sueño llega a 0 sin estar durmiendo, **se desploma**: duerme en el suelo donde esté, interrumpiendo cualquier cosa.
- Valores iniciales: hambre y sueño al azar entre 60 y 100; ánimo igual a su objetivo.

## 4. Ánimo

- **Objetivo** = 50 + suma de modificadores, limitado a 0–100.
- El ánimo se mueve hacia el objetivo a 10 puntos por hora de juego.
- **Modificadores de estado:**
  - Hambriento (hambre < 25): −10.
  - Desnutrido (hambre = 0): −25, y sustituye a Hambriento.
  - Cansado (sueño < 20): −10.
  - Optimista: +10.
  - Pesimista: −10.
- **Recuerdos** (con caducidad; un recuerdo nuevo sustituye a otro del mismo tipo):
  - Durmió en una cama: +5 (12 h).
  - Durmió en el suelo: −5 (12 h).
  - Comió: +5 (6 h).
  - Se desahogó: +15 (24 h).
- **Al límite:** ánimo < 25.
- **Crisis:** ánimo < 10. Va a una casilla de suelo al azar de la base y se queda 4 h. Al terminar gana "Se desahogó".
  - La crisis solo se interrumpe por desplomarse, por hambre < 10 con comida, o por sueño < 10. Si se interrumpe, no gana el recuerdo.

## 5. Rasgos

1–2 al azar por superviviente, sin repetir y sin parejas incompatibles (Valiente/Cobarde, Optimista/Pesimista).
Glotón y Dormilón cambian los ritmos; Optimista y Pesimista son modificadores de ánimo.

## 6. Comportamiento (`AiBrain`)

En orden de prioridad:

1. **Desplomarse** si el sueño llega a 0.
2. **Comer**, si toca.
3. **Dormir**, si toca.
4. **Crisis**, si el ánimo baja de 10.
5. **Pasear** por la base, como en H1.

Comer, dormir y la crisis se completan antes de volver a decidir (salvo las excepciones de §4). Pasear y esperar se interrumpen en cuanto hay algo más prioritario.

Orden de sistemas en cada tick: necesidades → ánimo → decisiones → movimiento → actividades.

## 7. Base

- **Camas:** 3, en la habitación de arriba de la base: (x+2, y+1), (x+5, y+1) y (x+9, y+1) respecto a `base.rect`. La cama i es del superviviente i.
- **Almacén:** 2 casillas en la habitación de abajo, junto a la puerta: (x+7, y+h−2) y (x+8, y+h−2).
- Camas y almacén son casillas de suelo transitables; se dibujan encima.

## 8. Pantalla

- **Barra superior:** se añade "Comida: N".
- **Barra inferior:** una tarjeta por superviviente con:
  - el nombre;
  - barras de hambre, sueño y ánimo (amarilla por debajo de 35 y roja por debajo de 15; el ánimo usa 25 y 10);
  - un icono de estado, por prioridad: 🌀 crisis, 💤 durmiendo, 🍽 comiendo, ⚠ al límite.
  - Clic en la tarjeta: seleccionar.
- **Ficha** (panel derecho) del seleccionado:
  - qué hace;
  - sus rasgos con una explicación;
  - el valor de cada necesidad;
  - el ánimo actual → objetivo;
  - la lista de modificadores con su valor y, en los recuerdos, las horas que quedan.
  - Se cierra con ✕ o Esc.
- **Mapa:**
  - camas y almacén dibujados;
  - anillo alrededor del seleccionado;
  - el que duerme se dibuja más apagado;
  - capa de noche que oscurece de 19:00 a 21:00 y aclara de 05:00 a 07:00 (máxima opacidad 0,55).
- **Ratón:** clic izquierdo sobre un superviviente lo selecciona (radio de 0,6 casillas); sobre otro sitio deselecciona.
- La selección es estado de la interfaz, no de la simulación.

## 9. Arreglos de la revisión de H1 incluidos

- **ESLint (`src/sim/`):** prohibido importar `render/`, `ui/` y `game/`; prohibidos los globales `Date`, `performance`, `process`, `globalThis`, `self`, `navigator` y `localStorage`; prohibidos `Math.random` y `Math.hypot`. Los tests y las ayudas de test tienen excepción.
- `MS_PER_TICK` se deriva de `TICKS_PER_SECOND`.
- El icono ⏸ pasa a `es.ts`.
- `togglePause` deja de depender de `this`.
- `Math.hypot` se cambia por `Math.sqrt` en la simulación.
- **CI:** `prettier --check`, y `cancel-in-progress` solo en pull requests.

## 10. Pruebas

- **Tests unitarios por regla:** ritmos, Glotón, Dormilón, comer, cama/suelo, desplomarse, objetivo y velocidad del ánimo, caducidad de recuerdos, crisis y desahogo, rasgos compatibles.
- **Escenarios con semilla:**
  - a las 23:00 del día 1 todos duermen en su cama;
  - con el almacén vacío, a los 2 días todos están desnutridos;
  - un superviviente con ánimo < 10 entra en crisis y al terminar se desahoga.
- **Invariantes:**
  - necesidades finitas y dentro de 0–100;
  - comida entera y ≥ 0;
  - cada cama con un dueño existente.
- **Partida automática de 30 días:** sin romper invariantes y con todos moviéndose al menos una vez al día.
- **Navegador:** 3 tarjetas visibles; clic en una abre la ficha con su nombre; Esc la cierra.

## 11. Criterio de éxito de H2

En el navegador se ve a los supervivientes comer en el almacén, dormir de noche en sus camas y cambiar de ánimo. La ficha explica por qué. Al acabarse la comida se hunden y alguno entra en crisis. Todos los tests, la partida de 30 días y el test del navegador pasan.
