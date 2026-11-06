# A6 Arte: el mapa del mundo — diseño

## Objetivo

Último paso del arte: que el mapa del mundo (H5c2) deje de ser hexágonos de cuatro colores planos y
se lea el terreno de un vistazo, con el mismo estilo que el mapa de la base.

## 1. Lo que se ve

- **Cada terreno con su textura** (ruido de tres tonos de su color) y **su relieve**:
  - **bosque:** de 5 a 7 arbolitos con su sombra;
  - **colinas:** 2 o 3 lomas con luz arriba a la izquierda;
  - **agua:** de 2 a 4 olas;
  - **campo:** unas matas.
- **Pueblos:** 4 o 5 casitas con tejado (rojo, marrón o gris) y su sombra, encima de las carreteras.
- **Carreteras de tierra**, con un borde más oscuro y las puntas redondeadas.
- **La niebla**, oscura y con algo de textura; el borde de cada hexágono, suave.
- Los iconos de los sitios, los grupos que viajan, la ruta y lo elegido, como estaban.

## 2. Cómo se pinta

- `atlasArt.ts`: `hexDecor` decide los adornos de cada hexágono visto (siempre los mismos, por su
  número, dentro del hexágono y de arriba abajo; en la base, ninguno), y los dibujos de los
  adornos están hechos a mano letra a letra (`DECOR_SPRITES`).
- `WorldScene.paintGround` pinta el suelo en un lienzo (antes, un `Graphics`): cada hexágono
  relleno con el dibujo de su terreno (o de la niebla) y su borde; el relieve; las carreteras; y
  las casitas. Se repinta, como antes, solo cuando se ve más del mundo o cambian las carreteras.

## 3. Pruebas

- `atlasArt.test.ts`: los dibujos son rectángulos con sus letras; cada terreno lleva sus adornos y
  un pueblo, casitas; sin ver y en la base, nada; los adornos, siempre los mismos, dentro del
  hexágono y de arriba abajo.
- Capturas en el navegador del mundo entero, de cerca alrededor de la base y de un pueblo; y los
  tests de navegador del mapa del mundo y de las expediciones de siempre.
