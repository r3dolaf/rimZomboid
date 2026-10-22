# H4d Tela, cortinas y cuerpos — diseño

Estado: aprobado en conversación por secciones. El usuario pidió implementar directamente. Lo pidió al diseñar H4c: cortinas como en Zomboid (no ves fuera, pero los zombis no te ven), tela que se saquea y se convierte, y cuerpos de zombi que se registran. En el diseño se añadieron: Fabricar (trabajo, habilidad y pedidos), prioridades de trabajo, hilo y aguja, palanca y machete, puertas atrancadas y romper ventanas. Quedan para otros hitos: **vestimenta** (ropa que protege, mochilas, refuerzos cosidos con hilo) y **H4f Pueblo** (mapa más grande con más tipos de edificio).

## 1. Objetivo

- Las ventanas se protegen sin tapiarlas: cortinas que se corren.
- Saquear tiene más sentido: tela, hilo, agujas, palancas, machetes y cuerpos que registrar.
- Fabricar en la mesa con pedidos que duran toda la partida (base para cocinar y otras recetas).
- El jugador ordena qué hace primero cada colono (prioridades).
- La palanca sirve para algo: casas con la puerta atrancada.

## 2. Objetos y armas

| Objeto (id)           | Peso            | De dónde sale                                            |
| --------------------- | --------------- | -------------------------------------------------------- |
| Tela (`cloth`)        | 0,2 kg          | ~30 por mapa (70 % armarios, 30 % estanterías) y cuerpos |
| Cortinas (`curtains`) | 0,5 kg          | En las ventanas; descolgadas o cosidas, en el almacén    |
| Hilo (`thread`)       | 0,01 kg por uso | ~6 carretes de 10 usos por mapa (estanterías y armarios) |
| Aguja (`needle`)      | 0,05 kg         | ~3 por mapa (armarios y estanterías)                     |
| Palanca (`crowbar`)   | 2 kg            | Muebles (como el bate) y cuerpos                         |
| Machete (`machete`)   | 1 kg            | Muebles (raro) y cuerpos                                 |

- El hilo se cuenta en **usos**: el inventario guarda usos y cada carrete trae 10. En pantalla, "Hilo: 23 usos".
- Las casas lejanas tienen más, como el resto del botín (peso `0,5 + d`).

**Armas** (en la mano; las de antes no cambian):

| Arma     | Daño | Ticks entre golpes |
| -------- | ---- | ------------------ |
| Cuchillo | 15   | 10                 |
| Bate     | 25   | 15                 |
| Hacha    | 40   | 20                 |
| Palanca  | 30   | 15                 |
| Machete  | 35   | 15                 |

- Orden al coger la mejor: **machete > palanca > hacha > bate > cuchillo**. El hacha sigue siendo la de talar (H4a/H4b), y la palanca la de forzar puertas (§6).
- En los muebles: palanca con un 6 % por mueble y machete con un 4 % (× `0,5 + d`, como las demás).

## 3. Cortinas

**Estados de una ventana:**

| Estado            | Casilla                                  | Vista                                                    |
| ----------------- | ---------------------------------------- | -------------------------------------------------------- |
| Cortinas abiertas | `Window`, en `World.curtains`            | Como ahora                                               |
| Cortinas corridas | `CurtainedWindow` (nueva), en `curtains` | Tapa la vista en los dos sentidos y la luz de la hoguera |
| Sin cortinas      | `Window`, fuera de `curtains`            | Como ahora                                               |

- `World.curtains`: índices (`y·ancho + x`) de las ventanas con cortinas, corridas o no, también tapiadas.
- **Al empezar**, todas las ventanas (casas y base) tienen cortinas abiertas: nada cambia hasta que el jugador las corre.
- `CurtainedWindow` es como `Window` para pisar (nadie), romper (resistencia 60, deja `BrokenWindow`) y los planos (tapiar, romper ventana); solo cambia que tapa la vista. El ruido pasa igual.
- **Tapiar** una ventana con cortinas las deja dentro (siguen en `curtains`); al quitar las tablas vuelve a `Window` con cortinas abiertas.
- Al **romperse** (zombi o colono), las cortinas se pierden.

**Órdenes** (menú Construir; son planos, como tapiar):

| Plano (`BuildKind`) | Dónde                             | Gasta      | Tiempo | Resultado                                                |
| ------------------- | --------------------------------- | ---------- | ------ | -------------------------------------------------------- |
| `curtains`          | ventana con cortinas              | nada       | 5 min  | Corridas ↔ abiertas                                      |
| `takeDownCurtains`  | ventana con cortinas (sin tapiar) | nada       | 10 min | Ventana sin cortinas; unas cortinas en un montón al lado |
| `hangCurtains`      | ventana sin cortinas              | 1 cortinas | 15 min | Cortinas abiertas                                        |

- "Cortinas" en el menú: clic en una ventana con cortinas → `curtains`; en una sin cortinas → `hangCurtains`. "Descolgar cortinas" es otra opción.
- Las cortinas de `hangCurtains` las lleva Transportar desde el almacén, como la madera de un plano (los planos llevan ahora la madera y las cortinas que han recibido).
- Ninguno de los tres falla (no gastan materiales al trabajar). Dan práctica de Construir.

## 4. Fabricar

**Trabajo y habilidad nuevos: Fabricar (`craft`).** Columna en el panel de Trabajos y séptima habilidad (empieza como las demás; Manitas y Torpe también suman o restan 2 en Fabricar). Todos lo tienen marcado al empezar. En el orden de criticidad va detrás de Construir: Social, Construir, Fabricar, Transportar, Talar, Saquear.

**Dónde:** en una **mesa** (H4a). Sin mesa no se fabrica.

**Recetas:**

| Receta (id)                  | Gasta                    | Herramienta | Da         | Tiempo (nivel 5) |
| ---------------------------- | ------------------------ | ----------- | ---------- | ---------------- |
| Vendas (`bandages`)          | 1 tela                   | —           | 2 vendas   | 15 min           |
| Cortinas (`curtains`)        | 3 telas + 2 usos de hilo | aguja       | 1 cortinas | 1 h              |
| Deshacer cortinas (`unpick`) | 1 cortinas               | cuchillo    | 3 telas    | 15 min           |

- **Herramientas:** la aguja, en el almacén; el cuchillo, en el almacén o en la mano de quien fabrica. No se gastan ni se mueven.

**Pedidos** (`World.bills`): una sola lista para todo el grupo.

- Cada pedido: receta, modo (`count`: hacer N veces; `until`: hasta tener N en el almacén; por defecto `until`) y N.
- **Toca** si (modo `count`) hechos + en curso < N, o (modo `until`) lo que hay en el almacén + lo que se está haciendo < N.
- Se hacen **de arriba abajo**: el primero que toca y tiene sus materiales y herramienta en el almacén. El jugador los ordena con flechas.
- Un pedido `count` que llega a N se queda en la lista (hecho), por si se quiere repetir; el jugador lo quita con ✕.
- Órdenes nuevas: `addBill`, `removeBill`, `setBill` (modo y N), `moveBill` (arriba o abajo).

**Cómo trabaja el colono:**

1. Coge los materiales del almacén (van en su carga).
2. Va a la mesa (al lado) y trabaja `ticks / skillSpeed(Fabricar)`.
3. Al terminar puede **fallar**, como al construir (30 % con 0, 10 % con 5, nunca desde 8; Torpe +10 %): pierde la mitad de cada material, redondeando hacia arriba, y lo demás se queda en su carga. Si sale bien, lo fabricado va a su carga.
4. Lleva su carga al almacén.

- Practica 1 por tick trabajando, salga bien o mal.
- Registro: "X ha cosido 2 vendas" (o "ha hecho unas cortinas", "ha deshecho unas cortinas"); "X ha fallado al coser las cortinas (−2 de tela, −1 de hilo)".

## 5. Prioridades de trabajo

- `Survivor.priorities: Record<WorkType, number>`, de 1 (lo primero) a 4. El permiso (`work`) sigue igual: sin permiso no lo hace.
- **Al empezar**, todo a 3: si no se toca nada, se trabaja como antes.
- **Buscar trabajo:** primero los de prioridad 1, luego 2, 3 y 4; dentro de cada número, el orden de criticidad (§4). Se mantiene que, con poca comida, saquear va delante de todo.
- Orden nueva: `setPriority` (colono, trabajo, número).
- **En el panel y la ficha**, cada celda muestra "—" (sin permiso) o el número; un clic pasa por — → 1 → 2 → 3 → 4 → —.

## 6. Puertas atrancadas y romper ventanas

**Puertas atrancadas:**

- Al crear el mapa, una de cada cuatro puertas de casa es `LockedDoor` (nueva). La de la base, nunca.
- Nadie la pisa; tapa la vista; los zombis la rompen como una puerta, con resistencia 150 (deja `BrokenDoor`).
- **Forzarla:** si hay muebles marcados para saquear en una casa con la puerta atrancada, quien tiene Saquear y una palanca (en la mano, en la carga o en el almacén, que la coge como el hacha para talar) va a forzarla: 30 min / `skillSpeed(Saquear)`, con un golpe que se oye cada 30 ticks (radio 8). Después es una `Door`. Practica Saquear.
- Sin palanca no se puede. La ficha de la casa dice "Puerta atrancada: hace falta una palanca".
- Registro: "X ha forzado la puerta de la casa 3".

**Romper ventana** (plano `smashWindow`, menú Construir):

- En una ventana vista (`Window` o `CurtainedWindow`): un colono la rompe en 2 min. Ruido de radio 12. Queda `BrokenWindow` (se pasa por ella y se ve); las cortinas se pierden.
- Nunca la rompen por su cuenta. Por la ventana rota pasan si es su camino.
- No falla. Da práctica de Construir.

## 7. Cuerpos de zombi

- Al matar a un zombi queda un **cuerpo** en su casilla. Es un mueble de saqueo más (`Container` con `kind: 'corpse'` y `houseId: -1`, que no es de ninguna casa; la base es la 0) con `until` (cuándo desaparece).
- **Lo que lleva** (azar de los zombis): siempre 1–2 telas; un 10 %, un arma (cuchillo 35 %, bate 25 %, palanca 15 %, machete 15 %, hacha 10 %); un 15 %, una venda o una lata (mitad y mitad).
- **Marcar:** con la herramienta Saquear, clic en un cuerpo lo marca o desmarca; arrastrar marca todos los cuerpos vistos de la zona. Orden `designateCorpse` (id, sí/no).
- **Registrar:** como los demás muebles marcados (el más cercano, sin ir dos), con su habilidad de Saquear. Registro: "X ha registrado un cuerpo: 2 telas y un cuchillo".
- **Desaparecen:** a los 3 días de morir (se pudre, con lo que lleve) o 1 día después de quedar registrado y vacío, lo que pase antes. Las armas que desaparecen así se apuntan en `World.weaponLog` (`fromCorpses`, `rotted`) para que las cuentas cuadren.

## 8. Pantalla

- **Barra de arriba:** botón **Fabricar** que abre el panel de pedidos.
- **Panel Fabricar:** lo que hay en el almacén (tela, hilo en usos, cortinas, agujas); "Hace falta una mesa" si no hay; una fila por pedido: receta · [hasta tener ▾ / veces] · [− N +] · ↑ ↓ · ✕ (y "hechos x/N" en los de `count`); botones para añadir cada receta. Clic en una mesa del mapa también lo abre.
- **Menú Construir:** Cortinas, Descolgar cortinas y Romper ventana.
- **Panel de Trabajos:** columna Fabricar; en cada celda, la prioridad ("—" o 1–4, clic para cambiar) y el nivel (el mejor, en negrita); Pelear como en H4c.
- **Ficha:** prioridades en lugar de casillas; Fabricar en Habilidades; los objetos nuevos en "Lleva".
- **Mapa:** ventana con cortinas corridas (tela oscura), sin cortinas (marco vacío); puerta atrancada (barra cruzada); cuerpos (silueta oscura) y su marca; los objetos nuevos en montones.
- **Registro:** fabricar, fallar al fabricar, forzar puerta y registrar un cuerpo. Ninguno pausa.

## 9. Datos e invariantes

- **Tipos:** `ItemKind` con `cloth`, `curtains`, `thread`, `needle`, `crowbar`, `machete`; `Weapon` con `crowbar` y `machete`; `Tile.CurtainedWindow` y `Tile.LockedDoor`; `WorkType` con `craft` (y la habilidad); `Survivor.priorities`; `World.curtains`, `World.bills`, `World.nextBillId`, `World.weaponLog`; `Blueprint.curtains`; acción `craft`; actividades `fetchCraft`, `craft`, `pry`; `ContainerKind` con `corpse` y `Container.until`.
- **Invariantes:** toda `CurtainedWindow` está en `curtains`, y en `curtains` solo hay ventanas (normales, corridas o tapiadas); prioridades enteras de 1 a 4; pedidos con N ≥ 1 y receta válida; cuerpos en casillas que se pisan; las armas cuadran con `weaponLog`.

## 10. Pruebas

- **Objetos y armas:** pesos, botín por mapa, armas nuevas (daño, orden), hilo en usos.
- **Cortinas:** vista tapada y la hoguera; los tres planos; tapiar y romper con cortinas; los zombis no ven a través.
- **Fabricar:** recetas, herramientas, sin mesa, pedidos (`count`, `until`, orden, en curso), fallos, rapidez, práctica, descarga.
- **Prioridades:** orden por número y por criticidad, todo a 3 como antes, saqueo con hambre delante, orden `setPriority`.
- **Puertas y ventanas:** atrancadas al crear el mapa, forzar con palanca (cogerla del almacén), sin palanca no, los zombis las rompen; romper ventana.
- **Cuerpos:** aparecen al matar, lo que llevan, marcar (clic y zona), registrar, desaparecer, cuentas de armas.
- **Pantalla:** panel Fabricar, prioridades en panel y ficha, menú Construir, textos; e2e del panel y las cortinas.
- **Partidas largas de 30 días:** con pedidos, cortinas corridas, cuerpos marcados y casas atrancadas; nada se rompe y las cuentas cuadran.
- **Equilibrio:** cuántas armas y vendas hay a los 7 y 30 días; se apunta en la hoja de ruta.
