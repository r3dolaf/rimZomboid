# rimZomboid — Diseño del primer prototipo

Fecha: 2026-10-19
Estado: pendiente de revisión

## 1. Visión

Un juego de gestión de una colonia de supervivientes (estilo RimWorld) en un
apocalipsis zombi realista (estilo Project Zomboid). El jugador da órdenes
indirectas a un pequeño grupo; las historias surgen de la mezcla de escasez,
personas con carácter y un mundo peligroso.

**Para qué:** primero, un prototipo jugable para el autor y sus amigos; si
funciona, con intención de publicarlo (itch.io y, más adelante, Steam).

**El corazón del juego** (en orden de importancia para el prototipo):

- **Escasez y saqueo:** los recursos se acaban; hay que salir cada vez más lejos.
- **Personas e historias:** necesidades, rasgos y ánimo que cambian lo que pasa.
- **Realismo de supervivencia:** heridas por parte del cuerpo, sangrado e
  infección por mordisco.

## 2. Decisiones tomadas

| Tema | Decisión ahora | Preparado para después |
|---|---|---|
| Control | Órdenes indirectas a la colonia (estilo RimWorld) | Tomar el control directo de un superviviente (estilo Zomboid), mediante cerebros intercambiables |
| Tecnología | Juego web: TypeScript + Phaser + Vite | Empaquetar para Steam con Electron/Tauri |
| Vista | Cenital 2D sobre cuadrícula | Vista isométrica (solo cambia la capa de dibujado) |
| Final de partida | Sin fin: se juega hasta que muere el último superviviente | Objetivos de victoria (p. ej. rescate) |
| Arte | Provisional: formas y colores simples | Arte definitivo |
| Idioma | Español, con los textos centralizados para poder traducirlos | Otros idiomas |

## 3. Arquitectura

Tres capas, con una regla: **la simulación no conoce la pantalla.**

```
Jugador ──órdenes──► SIMULACIÓN (TS puro) ──estado──► DIBUJADO (Phaser)
                                         └──estado──► INTERFAZ
```

- **`src/sim/` Simulación.** TypeScript puro, sin dependencias de Phaser ni del
  navegador. Contiene el mapa (cuadrícula de casillas), las entidades
  (supervivientes, zombis, objetos) y las reglas.
  - Avanza en **ticks fijos de 10 por segundo de juego**. Velocidades x1, x2 y
    x3 ejecutan 1, 2 o 3 veces más ticks; la pausa no ejecuta ninguno.
  - En cada tick se ejecutan los **sistemas** en este orden: órdenes →
    necesidades → salud → decisiones → movimiento → combate → saqueo →
    aparición de zombis.
  - Todo el azar sale de un **generador con semilla**: la misma semilla y las
    mismas órdenes producen exactamente la misma partida.
  - El estado completo es **serializable** (datos simples), lo que permitirá
    guardar y cargar más adelante.
- **Cerebros.** Cada superviviente tiene un `Cerebro` con una única función:
  decidir su siguiente acción a partir del mundo. En el prototipo solo existe
  `CerebroIA`. En la fase 2 se añadirá `CerebroJugador`, que traduce el
  teclado en acciones, sin cambiar el resto de la simulación.
- **Órdenes.** La entrada del jugador nunca modifica el mundo directamente: se
  convierte en una orden (`Saquear casa 4`, `Modo combate Ana`, …) que entra en
  una cola y se procesa en el siguiente tick.
- **`src/render/` Dibujado (Phaser).** Lee el estado en cada fotograma y lo
  dibuja. Nunca toma decisiones de juego.
- **`src/ui/` Interfaz.** Paneles, botones y registro de sucesos. Lee el estado
  y emite órdenes.
- **`src/sim/balance.ts`.** Todas las cifras ajustables del juego en un solo
  archivo. Las cifras de este documento son valores iniciales.

## 4. Los supervivientes

La partida empieza con **3 supervivientes**, cada uno con nombre, necesidades,
1–2 rasgos y salud completa.

### 4.1 Necesidades (0–100)

- **Hambre.** Baja de forma que se necesita aproximadamente 1 comida al día.
  Se come del almacén de la base o de la comida que se lleve encima. A 0:
  **desnutrido**, pierde salud poco a poco y tiene penalización de ánimo.
- **Sueño.** Llega a 0 tras unas 16 h despierto. Se duerme en una cama de la
  base (hay 3) o en el suelo (penalización de ánimo). A 0: **se desploma**
  donde esté.
- **Ánimo.** No baja por sí solo: se mueve gradualmente hacia un **objetivo**
  que es la suma de modificadores visibles (p. ej. hambriento −10, herido −15,
  ha muerto un compañero −30, durmió en cama +5, comió +5).
  - **Por debajo de 25 (al límite):** probabilidad de negarse a trabajar o a
    salir a saquear.
  - **Por debajo de 10 (crisis):** abandona lo que hace y se encierra en una
    habitación de la base durante varias horas. Es la única crisis del
    prototipo.

### 4.2 Rasgos (1–2 al azar, sin contradicciones entre sí)

| Rasgo | Efecto |
|---|---|
| Valiente | Tolera más zombis cerca antes de huir |
| Cobarde | Huye antes; penalización de ánimo al saquear |
| Glotón | El hambre baja más rápido |
| Dormilón | El sueño baja más rápido |
| Optimista | +10 al objetivo de ánimo |
| Pesimista | −10 al objetivo de ánimo |

Pares incompatibles: Valiente/Cobarde, Optimista/Pesimista.

### 4.3 Salud por heridas

- **Partes del cuerpo:** cabeza, torso, brazo izquierdo, brazo derecho, pierna
  izquierda, pierna derecha.
- Cada **herida** tiene tipo (arañazo, corte, mordisco), gravedad y si sangra.
- **Efectos:** heridas en piernas reducen la velocidad; en brazos, la
  eficacia al trabajar y pelear.
- **Sangre:** las heridas que sangran la reducen; se recupera muy lentamente.
  **Sin sangre, el superviviente muere.**
- Una **venda** corta la hemorragia de una herida. Las heridas se curan con el
  tiempo, más rápido descansando.

### 4.4 Infección

- **Mordisco:** infección segura (y visible, porque se ve la herida).
- **Arañazo:** 10 % de probabilidad de infección, oculta hasta los síntomas.
- **Síntomas** a las ~12 h: fiebre y fuerte penalización de ánimo.
- **Muerte** a los 2–3 días de la infección; ~1 h después **se levanta como
  zombi** donde esté.
- **No hay cura** en el prototipo.

## 5. El mundo

### 5.1 Mapa

- Cuadrícula de **100×100 casillas** (1 casilla ≈ 1 m), generada a partir de la
  semilla.
- **Base inicial** en el centro: una casa con 3 camas, un almacén y comida para
  unos pocos días.
- **6–10 casas** alrededor, con habitaciones, puertas y ventanas, unidas por
  carreteras; árboles decorativos que bloquean el paso.
- Casillas: suelo, hierba, carretera, muro, puerta, ventana, árbol.
- **Niebla de guerra:** el interior de una casa no se conoce hasta que alguien
  entra. Supervivientes y zombis tienen **línea de visión**; los muros la
  bloquean.

### 5.2 Tiempo

- 1 día de juego ≈ 12 minutos reales a x1.
- **De noche:** el radio de visión de los supervivientes baja a la mitad y los
  zombis aparecen por los bordes al doble de ritmo.

### 5.3 Objetos y saqueo

- Las casas tienen **contenedores** (nevera, armario, estantería) con objetos
  aleatorios. **El botín no reaparece.**
- Cuanto **más lejos** está una casa de la base, **mejor botín y más zombis**.
- Objetos del prototipo:
  - **Comida** (latas): quita hambre.
  - **Vendas**: cortan hemorragias.
  - **Armas** (bate, cuchillo): mejoran daño y alcance. Cada superviviente
    equipa automáticamente la mejor que lleve.
- Cada superviviente tiene un **peso máximo de carga**; el saqueo se hace en
  viajes de ida y vuelta al almacén.

### 5.4 Puertas

- Los supervivientes las abren al pasar y las cierran detrás.
- Una puerta cerrada **bloquea a los zombis** hasta que la rompen (cada puerta
  tiene resistencia). En el prototipo no se pueden reparar ni construir.

## 6. Los zombis

- **~30 al empezar**, con más densidad cerca de las casas lejanas.
- **Estados:** vagar → alertado (por visión o ruido) → perseguir → atacar →
  perder el rastro → vagar.
- **Ruido:** pelear, correr y romper puertas genera ruido con un radio; los
  zombis dentro del radio se alertan y van hacia el origen.
- Más lentos que un superviviente corriendo, pero no se cansan.
- **Ataque:** probabilidad de acierto; si acierta, causa un arañazo o un
  mordisco en una parte del cuerpo al azar.
- **Salud** simple (un número); los golpes en la cabeza hacen más daño.
- **Aparición continua:** llegan nuevos zombis por los bordes del mapa poco a
  poco, sin superar un máximo configurable.

## 7. Combate

- Solo cuerpo a cuerpo, con armas o a mano. Sin armas de fuego.
- La IA del superviviente decide **pelear o huir** según su salud, su arma, el
  número de zombis cercanos y sus rasgos.

## 8. Órdenes e IA

### 8.1 Cómo decide el `CerebroIA` (en orden de prioridad)

1. **Peligro:** huir o pelear si hay zombis cerca.
2. **Urgencias:** vendarse si sangra (y tiene vendas), comer con hambre alta,
   dormir con sueño muy bajo.
3. **Crisis de ánimo**, si está en crisis.
4. **Trabajo:** la tarea disponible más importante que tenga permitida.

Un superviviente en **modo combate** se salta los pasos 1–4 y obedece al
jugador.

### 8.2 Tipos de trabajo

- **Saquear:** ir a una casa o contenedor marcado, recoger lo que quepa,
  volver, dejarlo en el almacén y repetir hasta vaciarlo.
- **Transportar:** llevar al almacén objetos que hayan quedado en el suelo
  (p. ej. los de un superviviente muerto).

### 8.3 Acciones del jugador

- **Seleccionar** un superviviente (clic) para ver su ficha.
- **Herramienta Saquear:** marcar una casa entera o un contenedor.
- **Prioridades:** tabla de sí/no por superviviente y tipo de trabajo.
- **Modo combate:** el superviviente seleccionado va donde se hace clic y
  ataca al zombi marcado. Se activa y desactiva con un botón o la tecla R.

## 9. Interfaz

- **Barra superior:** día y hora; velocidad (Espacio = pausa, 1/2/3 =
  velocidades); recursos del almacén (comida, vendas); semilla de la partida.
- **Barra inferior:** tarjeta por superviviente con barras de necesidades e
  iconos de alerta (sangrando, infectado, en crisis, en modo combate).
- **Ficha del superviviente:** necesidades, rasgos, heridas por parte del
  cuerpo, inventario y lista de modificadores de ánimo.
- **Registro de sucesos** con fecha y hora de juego (p. ej. "Día 3, 22:14: Ana
  ha sido mordida en el brazo izquierdo").
- **Cámara:** WASD o arrastrar para mover; rueda para zoom.
- **Fin de partida:** "La colonia ha caído. Sobrevivisteis X días", con un
  resumen del registro.
- **Modo depuración (F3):** caminos, estados de los zombis y radios de ruido.

## 10. Pruebas y calidad

- **TDD con Vitest** para toda la simulación: tests de reglas (hambre,
  sangrado, infección, ruido…) y escenarios con semilla fija.
- **Partida automática larga:** un comando simula 30 días de juego sin
  pantalla, solo con IA, y comprueba invariantes: ningún valor `NaN`, ninguna
  entidad dentro de un muro, necesidades dentro de 0–100, sin bloqueos.
- **Comprobación de invariantes en desarrollo** en cada tick, con aviso
  inmediato si se rompe una.
- **Playwright** para el juego en el navegador: carga sin errores de consola,
  pausa y velocidades funcionan, seleccionar abre la ficha; capturas de
  pantalla para revisar el aspecto.
- **TypeScript estricto, ESLint y Prettier.**
- **Publicación automática en GitHub Pages** para poder jugar con un enlace.

## 11. Fuera del prototipo (lista de "después")

Por orden aproximado de prioridad:

1. Guardar y cargar partida.
2. Construcción y defensa: talar, madera, barricadas, muros, reparar puertas.
3. Tomar el control directo de un superviviente (`CerebroJugador`).
4. Objetivos de victoria (rescate).
5. Habilidades (cocinar, construir, medicina…).
6. Relaciones entre supervivientes y más tipos de crisis.
7. Amputación, enfermedades, comida que se estropea.
8. Nuevos supervivientes que llegan al grupo.
9. Armas de fuego.
10. Vista isométrica y arte definitivo.
11. Empaquetado para Steam.

## 12. Criterio de éxito del prototipo

El prototipo está terminado cuando se puede jugar una partida completa en el
navegador en la que:

- los 3 supervivientes comen, duermen y cambian de ánimo por sí solos;
- el jugador marca casas para saquear y la comida y las vendas llegan al
  almacén;
- los zombis vagan, oyen ruidos, persiguen y causan heridas;
- un mordisco lleva a la muerte y a la reanimación como zombi;
- la partida acaba cuando muere el último superviviente y muestra los días
  sobrevividos;
- y todos los tests y la partida automática de 30 días pasan.
