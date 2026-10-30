# H5c2 — Mapa del mundo (diseño)

## Objetivo

Un mapa del mundo de hexágonos, como el de RimWorld, con terreno, niebla y muchos sitios repartidos.
Los grupos van de cualquier sitio a cualquier sitio por rutas que tienen en cuenta el terreno; la
ruta sale sola y se puede ajustar con paradas; mientras viajan se les puede cambiar el destino.
Explorar es ir y volver a una zona elegida. Los sucesos del camino y la comida del viaje van en
H5c3.

Todo lo aprobado por el usuario: mundo de hexágonos y mapas de casillas (como RimWorld); niebla que
despeja quien viaja y, más, quien explora; ruta automática ajustable con paradas; viajes de cualquier
sitio a cualquier sitio y cambiar de destino por el camino; mundo lleno de sitios desde el principio;
explorar = ida y vuelta a un hexágono; el mundo en la caja común y dibujado en una escena de Phaser
aparte, en una pestaña «🌍 Mundo».

## 1. El mundo

- **Hexágonos** con punta arriba, en filas desplazadas (las impares, medio hexágono a la derecha):
  `ATLAS_SIZE` = 41 × 31. Cada uno es de unos 2 km.
- **Terreno** de cada hexágono: campo, bosque, colinas o agua. Encima puede haber **carretera** (si
  pasa por agua, es un puente) y **pueblo**.
- **La base** está en un hexágono de pueblo, en el centro (20, 15).
- **Se genera** con la semilla de la partida (su propio azar, `ATLAS_SALT`): manchas de bosque
  (`ATLAS_FOREST` ≈ 25 %) y colinas (`ATLAS_HILLS` ≈ 12 %); `ATLAS_RIVERS` 1–2 ríos que cruzan de
  un borde a otro; `ATLAS_TOWNS` 4–6 pueblos separados (`TOWN_MIN_DIST`) y lejos de la base; y
  carreteras de la base a cada pueblo y entre pueblos cercanos (el camino más barato, con puentes al
  cruzar un río). La base y los pueblos nunca están en el agua; todo pueblo se alcanza por carretera.
- **Se guarda** en la caja común (`common.atlas`): tamaño, terreno, carreteras, pueblos, niebla y el
  hexágono de la base, con números simples (se puede guardar en JSON).

## 2. Los sitios en el mundo

- Al crear el mundo se colocan `ATLAS_SITES` 40–60 sitios, cada uno en su hexágono (nunca dos en el
  mismo, ni en el agua, ni a menos de `SITE_MIN_DIST` = 4 de la base), según el terreno:
  junto a un pueblo, pueblecitos y naves; en carretera, gasolineras; en el campo, granjas (y alguna
  casa); en el bosque y las colinas, casas aisladas.
- Empiezan **ocultos** (`state: 'hidden'`): no salen en ningún sitio hasta descubrirlos.
- `SiteInfo` gana `hex` (su hexágono). `side` (hacia dónde queda desde la base) y `hours` (horas de
  la base por la ruta, al descubrirlo) se calculan al descubrirlo y se usan en textos y nombres.
- Siguen cambiando cada día como en H5c1 (quemarse, hordas, especiales que callan), solo los
  conocidos. El tope de 10 sitios conocidos desaparece.
- Nombres: «Granja del norte»; si hay otro igual conocido, «Granja del norte 2».

## 3. Niebla y descubrir

- Al empezar se conocen los hexágonos a `ATLAS_START_SEEN` = 3 o menos de la base.
- Quien viaja despeja el hexágono en el que entra y los de al lado (`TRAVEL_SEEN` = 1).
- **Explorar**: ir a un hexágono elegido; al llegar despeja `EXPLORE_RADIUS` = 3 a la redonda, tiene
  su riesgo de arañazo o corte (como en H5c1) y vuelve solo a la base.
- **Un sitio se descubre** cuando su hexágono queda despejado («visto por el camino», «al explorar»).
  Al descubrirlo puede ser especial (`SPECIAL_SHARE`, como en H5c1).
- **Un mapa de carreteras** despeja `ROADMAP_RADIUS` = 5 alrededor de un sitio oculto al azar (y
  descubre los de esa zona). **Una nota, el humo o la radio** señalan un sitio oculto al azar y
  despejan su hexágono (la radio y algunas notas, con supervivientes que piden ayuda).
- Si ya no queda ningún sitio oculto, un mapa, una nota, el humo o la radio no hacen nada.

## 4. Rutas y viajes

- **Horas por hexágono** (al entrar en él), `HEX_HOURS`: carretera ½, campo 1, bosque 1½, colinas 2.
  El agua sin puente no se cruza. En la niebla se cuenta como campo.
- **La ruta** es el camino más rápido (A* sobre hexágonos) del hexágono de salida al de destino,
  pasando por las paradas en orden. Si por el camino se descubre que el siguiente hexágono es agua,
  se rehace desde donde están; si ya no hay camino, vuelven por donde vinieron.
- **Se viaja de día** (`TRAVEL_DAY`), de noche se acampa (como en H5c1). El viaje avanza hexágono a
  hexágono: cada uno cuesta sus horas.
- **Al salir de un mapa** van al borde del lado hacia el que queda el primer paso de la ruta; **al
  llegar** entran por el lado del que vienen (el más cercano al campamento o a la puerta).
- `Travel` guarda: destino (`siteId`, o la base, o un hexágono al explorar), paradas, la ruta
  (`path`, hexágonos), dónde va (`at`) y lo que falta para el siguiente (`hoursLeft`).

## 5. Órdenes

- **Mandar un grupo** desde la base o desde un sitio con gente a cualquier sitio conocido (o a la
  base), con paradas. Desde la base, con la lista de cosas del almacén (como en H5c1); desde un
  sitio, cargan lo del campamento (como al volver). Sigue el tope de 4 sitios con gente o de camino.
- **Volver** (de un sitio a la base): como en H5c1, ahora con ruta.
- **Explorar** un hexágono: 1 o 2 colonos de la base; cada uno se lleva su lata.
- **Cambiar de destino** a un grupo que viaja (a un sitio, a la base): rehace la ruta desde donde
  está.
- Todas las órdenes de expedición se dan a la base, que ve todos los mapas.

## 6. Pantalla

- **Pestaña «🌍 Mundo»** junto a las de los mapas: una escena de Phaser con los hexágonos (terreno,
  carreteras, ríos, pueblos), la niebla, la base, los sitios conocidos con su icono y estado y los
  grupos que viajan. Zoom y arrastre como en el mapa normal; recuerda la cámara.
- **Al pulsar un hexágono** sale una ficha: qué hay (terreno, sitio, distancia y horas desde la base)
  y botones: «Mandar grupo aquí» (sitio), «Ir a su mapa» (si hay gente), «Explorar aquí» (sin sitio).
  Al pulsar un grupo: a dónde va, cuánto falta, «Cambiar destino» y «Volver a la base».
- **Ruta**: al elegir destino se dibuja la ruta con las horas; arrastrar un punto de la línea a otro
  hexágono pone una parada; el botón derecho sobre una parada la quita.
- **Panel Expediciones**: elegir desde dónde sale el grupo (base o sitio con gente), el destino o la
  zona a explorar (del mapa), y «Ver en el mapa» en cada sitio y viaje.

## 7. Pruebas y equilibrio

- Pruebas de cada parte: hexágonos (vecinos, distancia, lados), generación (sin agua en base y
  pueblos, carreteras conectadas, misma semilla = mismo mundo), sitios repartidos, niebla y descubrir,
  rutas (terreno, agua, paradas, rehacer), viajes hexágono a hexágono, órdenes nuevas, pantalla.
- Invariantes: cada sitio en un hexágono propio y válido; cada viaje con una ruta de hexágonos
  vecinos y `at` dentro de ella.
- Partida larga con viajes entre sitios y cambios de destino; tiempo por tick con el mundo.
- Navegador: la pestaña Mundo, elegir un sitio, ver y ajustar la ruta, mandar un grupo.
- Sonda de equilibrio (con y sin expediciones, jugador sensato), como en H5c1; ajustar cifras si hace
  falta y apuntarlo aquí (§8) y en la hoja de ruta.
