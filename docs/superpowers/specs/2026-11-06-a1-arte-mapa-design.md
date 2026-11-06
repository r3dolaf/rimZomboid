# A1 Arte: el mapa — diseño

## Objetivo

Primer paso del arte definitivo (spec principal §11, n.º 10): que el mapa deje de verse como un
plano de cuadrados planos. El usuario no tiene arte propio y eligió, frente a paquetes gratuitos
(Kenney, CC0), **arte de píxel hecho a medida y dibujado por código**, a partir de una maqueta que
le gustó. Este paso cubre **el suelo, los muros y los árboles**; lo demás va en pasos aparte.

## 1. Decisiones

- **Píxel de 16×16**, el mismo tamaño de casilla que ya tiene el juego (`TILE_PX`), con
  `pixelArt: true`. Sin archivos de imagen: los dibujos se hacen al empezar, en lienzos.
- **Una paleta** (`MAP_ART` en `colors.ts`), de tonos apagados. **Luz de arriba a la izquierda:**
  bordes de arriba y de la izquierda más claros; caras y sombras, abajo y a la derecha.
- **Variantes por casilla:** 8 dibujos de cada suelo; cada casilla elige uno con un número fijo
  sacado de su posición (`hash2`), así que al repintarla sale igual.
- La simulación no cambia; todo está en `src/render/`.

## 2. Lo que se ve

- **Hierba** con tres tonos, matas, alguna flor y calvas de tierra.
- **Carretera:** asfalto con grietas, el arcén donde acaba y la raya del centro (amarilla, a trozos
  de 8 y gastada) en las calles de 2 y 3 de ancho; en los cruces, sin raya.
- **Suelos:** tablas en las casas y la base; baldosas de 8×8 en las tiendas; cemento en la
  comisaría y la nave; tablones de arriba abajo en la granja (como en H4f).
- **Muros** (ladrillo y madera): arriba, el muro visto desde arriba con sus bordes; si debajo no
  hay muro, su **cara** (ladrillos o tablas). Dan **sombra** a lo que tienen debajo y a la derecha.
- **Ventanas:** el cristal en la cara del muro (o a lo largo, en los muros de arriba abajo), con
  cortinas abiertas o corridas, tapiadas con tablas o rotas.
- **Puertas:** de frente en los muros de lado a lado y vistas desde arriba en los de arriba abajo;
  atrancadas (dos tablones cruzados) o rotas (el hueco con el suelo y astillas).
- **Cascotes:** piedras sobre polvo.
- **Árboles:** copa redonda que sale de su casilla, con luz, borde y tronco, y su sombra; tres
  verdes y tres tamaños. Así ya no se confunden con la niebla (antes, un árbol a la vista era casi
  del mismo color que la hierba fuera de la vista).

## 3. Cómo se pinta

- `look.ts` (sin dibujo, con tests): qué cuenta como muro, los vecinos de cada casilla, la raya
  de las calles, `hash2` y `tileLook`, un número que cambia si cambia algo de lo que se ve en la
  casilla (también por los vecinos: la cara y la sombra de los muros, el arcén y la raya).
- `tileArt.ts`: los dibujos de los suelos y lo de arriba de los muros, y `paintTile`.
- `trees.ts`: las copas y sus sombras, y `paintTrees` (todas o las que caen en una casilla).
- `GameScene.refreshMap` repinta las casillas cuyo `tileLook` ha cambiado; si aparece o desaparece
  un árbol, también las de alrededor; y en lo repintado vuelve a pintar las copas que lleguen.
- **Los árboles van en el mismo lienzo que el suelo, por debajo de la gente.** Se probó una capa
  aparte por encima de la gente (como en la maqueta), pero en el navegador de pruebas bajaba de
  ~36 a ~25 imágenes por segundo, y sin ella se queda en ~35. Además, así una copa no tapa nunca a
  un zombi.
- Pintar el mapa entero (al empezar y al cambiar de mapa) pasa de ~30 a ~100 ms; repintar al
  talar o construir cuesta lo mismo que antes (lo que pesa es subir el lienzo, ~30 ms).

## 4. Fuera de este paso

Por orden: A2 muebles; A3 personas y zombis; A4 luz de noche de verdad (sin anillos, huecos
suaves donde alumbran la hoguera y las ventanas) y niebla suave; A5 animaciones, sangre y polvo;
A6 el mapa del mundo con relieve. El almacén sigue con sus cuadrados marrones hasta A2.

## 5. Pruebas

- `look.test.ts`: muros y no muros; nada fuera del mapa; la raya en calles de 2 y 3, de lado a
  lado y de arriba abajo, sin raya en cruces ni en trozos cortos; cuándo cambia `tileLook` (muro
  al lado sí, más lejos no; cortinas; arcén y raya); cada tipo de casilla cabe en 4 bits; `hash2`
  fijo y con todas las variantes en un trozo pequeño.
- El dibujo se comprueba con capturas en el navegador (base, pueblo, noche, talar, muros de madera,
  ventanas tapiadas, rotas y con cortinas, puertas atrancadas y rotas, cascotes) y con los tests de
  navegador de siempre, que cambian de mapa.
