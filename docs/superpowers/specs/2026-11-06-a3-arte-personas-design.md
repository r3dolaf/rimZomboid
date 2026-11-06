# A3 Arte: personas y zombis — diseño

## Objetivo

Tercer paso del arte (después de A1, el mapa, y A2, los muebles): que las personas y los zombis
dejen de ser círculos de color. Cada uno con su figura, reconocible de un vistazo, con el mismo
estilo (píxel de 16, una paleta, contorno oscuro).

## 1. Lo que se ve

- **Figuras de 16×16** de frente, de espaldas y de lado (a la izquierda es la de lado al revés),
  **mirando hacia donde andan**; quietos, hacia donde miraban.
- **Cada persona, la suya:** el tono de piel, el color de pelo y si lo lleva largo salen de su
  nombre (siempre igual); **la ropa, de lo que lleva puesto** (H5b): en cada zona se ve la prenda de
  más fuera (la chaqueta tapa la camiseta; con camiseta, los brazos al aire), cada prenda con su
  color (una camiseta de entre siete, unos vaqueros de entre tres…), la gorra, el gorro o el casco,
  manchas en el pecho si la ropa tiene sangre y piel asomando si tiene agujeros. Sin ropa, ropa
  interior.
- **Los zombis**, con su propia silueta: brazos por delante, boca abierta y una pierna que
  arrastran; piel verdosa y ojos rojos; su ropa, algo más oscura. **Quien se vuelve zombi conserva
  su pelo y su ropa** (sale de su nombre).
- **Derribado:** tumbado sobre un círculo rojo. **Dormido:** en la cama, la cabeza en la almohada
  con los ojos cerrados; en el suelo, tumbado.
- **Desconocidos y quien se va:** con su figura, agrisados.
- **Cuerpos** (H4d, aplazados de A2): tumbados sobre un charco de sangre, más oscuros, con la ropa
  que les quede; de persona o de zombi.
- **Elegido:** un círculo blanco en el suelo, a sus pies. Las espadas del modo combate, los iconos
  de encima, la vida de los zombis y los nombres de los que fueron alguien, ajustados a la figura.
- **Retratos en las tarjetas:** la cabeza y el pecho de cada colono, que cambian si cambia de ropa.

## 2. Cómo se pinta

- `people.ts`: las figuras **dibujadas a mano letra a letra** (persona y zombi, tres vistas), con
  el pelo largo y los gorros encima; tumbado es la de frente girada y en la cama, la cabeza y los
  hombros. `personLook` decide cómo se ve alguien (piel, pelo, ropa de cada zona, sangre,
  agujeros) y `lookKey` lo resume: dos figuras con la misma clave son el mismo dibujo.
- **Todas las figuras van en un solo lienzo** (`people`, 384 sitios), pintadas la primera vez que
  hacen falta; si se llenara, las nuevas irían en su propia textura. Con una textura por zombi, una
  horda de 40 a la vista bajaba de ~32 a ~25 imágenes por segundo en el navegador de pruebas; con
  el lienzo compartido se queda en ~32, como con A2.
- `GameScene.drawActors` hace en cada fotograma la lista de figuras, cada una en su sitio, y la pone
  en imágenes reutilizadas en su capa (entre los muebles y las marcas de encima), de arriba abajo.
  Hacia dónde mira cada uno se guarda por fotograma (`facingOf`): cambia al moverse más de un poco.
- Los cuerpos van con los muebles (A2), con el charco de sangre en el atlas de los muebles.
- Las tarjetas reciben de `main.ts` una función que da el retrato de cada colono (`makePortraits`,
  guardados por `lookKey`); la interfaz no dibuja nada.

## 3. Fuera de este paso

Andar con las piernas, golpes, sangre al herir y polvo (A5); el arma en la mano.

## 4. Pruebas

- `people.test.ts`: cada dibujo mide 16×16 con las letras de la figura; sin ropa; lo de más fuera
  en cada zona; quien se vuelve zombi conserva el pelo y cambia de piel y de silueta; sangre y
  agujeros en el pecho; la misma persona siempre igual y distinta con otra ropa; hacia dónde mira.
- `cards.test.ts`: con retratos, cada tarjeta lleva el suyo y cambia cuando cambia la imagen; sin
  ellos, ninguna imagen.
- El test de navegador de los zombis creaba un zombi a mano sin ropa ni bolsas (de antes de H5b);
  ahora las lleva, como todo zombi.
- Capturas en el navegador: gente de pie, derribada, dormida en la cama, un desconocido, cuerpos de
  persona y de zombi, el elegido y una horda de 40 zombis mirando hacia distintos lados.
