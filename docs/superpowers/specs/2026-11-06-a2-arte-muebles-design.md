# A2 Arte: muebles — diseño

## Objetivo

Segundo paso del arte (después de A1, el mapa): que los muebles dejen de ser cuadrados de color y
se reconozca cada uno de un vistazo, con el mismo estilo que el mapa (píxel de 16, una paleta, luz
de arriba a la izquierda y vista un poco de frente: se ve lo de arriba y la cara).

## 1. Lo que se dibuja

- **Camas:** de madera con almohada y manta azul; **de hospital** (H5 §6), de metal y blanca, con
  la cruz roja.
- **Muebles de saqueo:** nevera (con el congelador y sus tiradores), armario (dos puertas),
  estantería del súper (con latas y paquetes de colores), mostrador con caja registradora, taquilla
  de la comisaría (de metal, con rejillas), caja de madera con su aspa y botiquín con la cruz. Los
  altos (nevera, armario, taquilla, botiquín) salen un poco por encima de su casilla. Registrado y
  vacío, desvaído como antes.
- **Mesa** de madera con patas, **hoguera** (corro de piedras, troncos cruzados y una llama que
  cambia entre tres dibujos), **barreño** de madera y **cisterna** de metal con el agua por dentro
  en cinco niveles (de vacío a lleno), **fregadero** (encimera con la pila, con agua mientras haya
  agua corriente) y **surtidores** de la gasolinera.
- **Montones:** de una a tres tablas apiladas y, si hay, una bolsa (H5b2) o, si no, una caja con
  lo demás.
- **Almacén:** palés de madera en el suelo y **cajas encima según lo que hay**: un palé con cajas
  por cada 10 cosas (o menos), hasta llenarlos todos.
- Los **cuerpos** de zombi siguen como estaban: van con los zombis en A3.

## 2. Cómo se pinta

- `props.ts`: los dibujos, **hechos a mano letra a letra** (una letra por píxel, con su color en
  `PROP_COLORS`), y por código los redondos (hoguera, barreño, cisterna) y las tablas. Al empezar se
  ponen todos en fila en un lienzo, que es la textura `props` con un trozo por dibujo.
- Lo que decide qué dibujo se ve, sin dibujar (con tests): `waterLevel`, `campfireFrame`,
  `pileFrames`, `itemCount` y `stockedPallets`.
- `GameScene.drawFurniture` hace en cada fotograma la lista de muebles vistos y la pone en imágenes
  que se reutilizan (en su capa, bajo la gente y la niebla), **de arriba abajo** para que el de
  delante tape al de detrás. Los muebles no van en el lienzo del mapa porque cambian a menudo (el
  agua, los montones, la llama) y repintarlo cuesta subirlo entero (~30 ms).
- Los palés del almacén sí van en el lienzo del mapa (no cambian).
- Los planos de construir siguen siendo siluetas, y las marcas (saquear, cama elegida) van encima
  de la niebla como antes.
- Las imágenes por fotograma no cambian las imágenes por segundo en el navegador de pruebas
  (~35 de cerca y de lejos, con todo el pueblo a la vista, igual que con A1).

## 3. Pruebas

- `props.test.ts`: cada dibujo mide 16 de ancho y como mucho 24 de alto y solo usa colores de la
  paleta; hay dibujo para cada mueble, nivel de agua y llama; el agua en cinco niveles; la llama
  cambia y vuelve a empezar; lo que se ve en un montón (tablas, bolsa, caja); cuántas cosas hay y
  en cuántos palés se ven cajas.
- Capturas en el navegador de la base (cama de hospital, mesa, hoguera, barreños y cisternas con
  distinta agua, fregadero, montones, almacén) y de cada tipo de edificio; y los tests de navegador
  de siempre.
