# H5c1. Expediciones — diseño

Estado: aprobado en conversación, por partes. Al diseñarlo, H5c (Mundo y expediciones) se partió en dos: **H5c1 Expediciones** (esto: varios mapas a la vez, descubrir sitios, mandar grupos, saquear allí y volver) y **H5c2 Mapa del mundo** (el mapa grande tipo RimWorld con terreno y distancias, sucesos en el camino, comida para el viaje…). En este hito entran también unos paneles de Fabricar y Construir más claros y un menú con el clic derecho.

## Objetivo

Que la colonia pueda salir de su mapa, como en RimWorld:

- sitios que hay que **descubrir** (explorando, con mapas y notas, a veces por el narrador);
- mandar un grupo con lo que necesite, viajar de día y llegar a un **mapa de verdad** que se juega mientras la base sigue viva;
- saquear desde un campamento, construir allí y volver con el botín;
- un mundo **que cambia**: los sitios se guardan, se llenan de zombis, otros se llevan cosas, alguno se quema, y hay sitios especiales.

## 1. Una caja grande con lo común y una caja por mapa

- **Lo común** (una sola vez): el reloj, los atuendos, el registro de sucesos (cada suceso dice de qué mapa es), el narrador, la numeración de objetos, personas y demás, las estadísticas, la lluvia, los sitios conocidos y quién está viajando o explorando.
- **Cada mapa** (la base y cada sitio con su caja): su mapa, zombis, muebles, contenedores, montones, almacén (en un sitio, el campamento), planos, árboles marcados, pedidos de Fabricar y los colonos que están allí.
- Dentro de cada mapa se usan las mismas reglas de siempre (saquear, pelear, construir, heridas, ropa, bolsas…). Todos los mapas avanzan a la vez, con un solo reloj.
- El primer paso del hito es pasar lo común a la caja grande sin cambiar nada del juego: al terminarlo pasan todas las pruebas.

## 2. Sitios

- **Tipos:** casa aislada, granja, gasolinera, nave y pueblecito (unas pocas casas y una tienda), con los edificios, muebles y botín de H4f.
- **Tamaño:** 64×64 casillas; el pueblecito, 96×96. La base sigue con 150×150.
- **Dónde:** cada sitio está hacia el norte, el sur, el este o el oeste, a entre 2 y 12 horas de viaje.
- **Se crea** la primera vez que llega alguien, con su propio azar (de la semilla y el sitio).
- **Se guarda** al irse todos (lo que queda en los muebles, el campamento, lo construido, los cuerpos), y se puede volver.
- **Cambia mientras nadie está:** al volver se calcula lo que ha pasado desde la última vez:
  - cada día llegan zombis (hasta un tope);
  - cada día otros se llevan parte de lo que hay (también del campamento).
- **Se pierde o empeora:** cada día, un sitio conocido sin gente puede quemarse (se pierde con lo que tenía) o llenarse de zombis por una horda; los dos, con aviso.
- **Especiales:**
  - **Supervivientes que piden ayuda:** 1 o 2 desconocidos atrapados entre zombis. Si el grupo llega en 2–3 días, al verlos sale una decisión como la de los desconocidos («¿Se unen?»); si aceptas, son colonos y vuelven con el grupo. Si no se llega a tiempo, el sitio queda normal.
  - **Alijo:** una cabaña con mucho botín (comida, medicinas, armas) y pocos zombis.
  - **Sitio peligroso:** una comisaría o un supermercado tomado, con mucho botín y muchos zombis.
- **Límites:** como mucho 10 sitios conocidos y 4 con gente a la vez (contando a los que van de camino).

## 3. Descubrir sitios

Al empezar no se conoce ninguno.

- **Explorar:** desde el panel Expediciones, una dirección y 1 o 2 colonos. Salen por ese borde, están fuera un día (las horas de luz) y vuelven por el mismo lado con 1 o 2 sitios nuevos de esa dirección (más a menudo 2 con buen Saquear). Riesgo: vuelven con un arañazo o un corte 1 de cada 5 veces si va uno solo y 1 de cada 10 si van dos (con las reglas de heridas de siempre). Comen y duermen como en un viaje.
- **Mapas y notas:** objetos nuevos del botín (casas, gasolineras) y de algunos zombis. Al llegar al almacén o a un campamento, cada uno descubre su sitio, a veces especial («Nota: "Estamos en la granja del norte, venid"»), con aviso.
- **El narrador:** de vez en cuando, «Se ve humo hacia el norte» o una llamada por radio (más a menudo de supervivientes que piden ayuda), que descubren un sitio.

## 4. Formar el grupo y viajar

- **Panel «Expediciones»** (botón arriba): los sitios conocidos (tipo, dirección, horas, si se visitó, si hay gente, lo que le queda a un especial, si se perdió).
- **Formar el grupo:** el sitio, quién va (no los derribados ni en crisis) y una lista de cosas del almacén con sus cantidades.
- **Preparar la salida:** cada uno pasa por el almacén, descarga, rellena su «Llevar siempre» y las listas de sus bolsas; lo de la lista del grupo se reparte entre sus bolsas y manos hasta donde quepa; luego van al borde de ese lado y, cuando llegan todos, salen del mapa.
- **De viaje (sin verse):** solo cuentan las horas de luz (de 6 a 20 h); de noche acampan y duermen. Tienen hambre y sueño y comen de lo que llevan; las heridas siguen su curso y se vendan con lo suyo; quien muere por el camino se pierde con lo que llevaba.
- **Al llegar:** entran por el borde de ese lado; allí queda el campamento.
- **Volver** (botón del sitio): el grupo va al campamento, cada uno se carga lo que quepa (primero lo de la lista del grupo, luego comida, medicinas y armas, luego lo demás), salen por el borde, viajan y entran a la base por su lado.
- **Otro grupo al mismo sitio:** se puede; se juntan allí.

## 5. En el sitio

- **Al llegar** se marcan para saquear todos los edificios del sitio (se puede desmarcar). El **campamento** es una zona pequeña junto a la entrada que hace de almacén; hay un plano de hoguera listo.
- **Se trabaja como en la base**, con sus prioridades: saquear, registrar cuerpos, transportar, talar, construir (camas, muros, puertas, hoguera, mesa…) y fabricar con sus propios pedidos.
- Comen de lo que llevan y del campamento; duermen en el suelo si no hay camas. Modo combate, vendar y rescatar, igual.
- **Sin narrador:** ni asedios ni desconocidos; solo los zombis del sitio, que acuden al ruido.
- Un muerto se queda en el sitio (y puede levantarse). Si mueren todos, el sitio queda como esté.

## 6. Reglas comunes

- Un solo reloj; todo avanza a la vez.
- El narrador y sus sucesos son solo de la base, aunque esté vacía.
- La partida acaba cuando no queda nadie vivo en ningún mapa ni de viaje.
- El ×6 durmiendo solo salta si duermen todos, también los de fuera (de viaje de noche cuentan como dormidos).
- Charlas y relaciones, solo entre los del mismo mapa.
- Comunes: atuendos y registro. **Por mapa:** pedidos de Fabricar y planos de construir.

## 7. Pantalla

- **Pestañas de mapa** arriba: «Base» y una por sitio con gente («Granja · 3»); cada mapa recuerda la cámara.
- **Tarjetas** de todos; los de fuera con icono y dónde están («En la granja», «Viajando a la granja · faltan 3 h», «Explorando el norte»); al pulsar, a su mapa.
- **Panel Expediciones:** sitios, formar un grupo, explorar y «Volver».
- La comida, vendas y madera de arriba, y los paneles Almacén y Fabricar, son **del mapa que estás mirando** (en un sitio, el campamento).
- El campamento se dibuja como el almacén.
- **Avisos y registro** dicen de qué mapa es cada cosa («Granja: un zombi ha mordido a Ana»); al pulsar un aviso, vas allí. La ficha dice dónde está cada uno.

## 8. Fabricar y Construir más claros, y el clic derecho

- **Clic derecho** sobre una casilla (cuando no es una orden de modo combate): un menú con lo que se puede hacer allí, con lo que gasta y lo que tienes, y solo lo que tiene sentido:
  - **ventana:** Tapiar (1 tabla), Quitar tablas, Colgar cortinas (1 juego), Correr cortinas o Abrirlas, Descolgar cortinas, Romper ventana;
  - **puerta:** Reparar o Arreglar puerta (si está dañada o rota);
  - **muro dañado:** Reparar;
  - **un plano:** Cancelar.
    Se cierra con Esc o con un clic fuera.
- **Construir**, solo lo que se pone, por grupos: Muebles (Cama, Mesa, Hoguera, Barreño), Muros y puertas (Muro, Puerta) y Arreglar (Reparar, para muchas cosas seguidas). Cada botón dice lo que gasta y lo que tienes («Cama — 4 tablas (tienes 12)»), y abajo una frase de qué hace.
- **Fabricar**, por grupos: Curar (Vendas), Tela y cortinas (Coser cortinas, Deshacer cortinas), Ropa (Remendar, Reforzar, Descoser ropa, Lavar ropa) y Bolsas (Bolsa de tela). Cada receta: «usa → da · dónde · tiempo» y, si ahora no se puede, por qué («Falta una aguja», «Hace falta un barreño con agua»). Los pedidos dicen su modo: «Hacer 5 veces», «Hasta tener 10», «Siempre que haya».

## 9. Pruebas y equilibrio

- **Invariantes** en cada tick de la partida larga: nada aparece dos veces ni se pierde entre mapas y viajes; números únicos en todas las cajas; cada mapa cumple sus reglas.
- **Tests** de cada parte: la caja grande sin cambios en el juego; formar el grupo y repartir la lista; salir, viajar de día, acampar y llegar; campamento y volver cargando por orden; cambios mientras no hay nadie, quemarse y hordas; explorar y sus heridas, mapas y notas, narrador; especiales; fin de partida y ×6 con gente fuera; clic derecho y los paneles nuevos.
- **Navegador:** pestañas de mapa, mandar un grupo, cambiar de mapa con las tarjetas, el clic derecho en una ventana, Fabricar y Construir.
- **Partida larga** con expediciones (explorar, ir, saquear, volver) y tiempo por tick con varios sitios.
- **Equilibrio:** cuánto aguanta la colonia con y sin expediciones: que ayuden sin regalarlo.
