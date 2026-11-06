# A5 Arte: movimiento — diseño

## Objetivo

Quinto paso del arte: que las figuras (A3) se muevan como personas y que lo que pasa se note: andar,
golpes, sangre, talar y construir.

## 1. Lo que se ve

- **Andar:** dos pasos por vista (de frente y de espaldas, un pie levantado y luego el otro; de
  lado, las piernas abiertas y luego juntas) que se alternan con el de pie según lo andado, con un
  pequeño balanceo. Los zombis arrastran el pie. Quieto, de pie.
- **El arma en la mano:** cuchillo, bate, hacha, hachuela, palanca o machete, cada uno con su
  dibujo, levantada hacia fuera (de lado, hacia delante).
- **Quien trabaja mira a lo que hace:** el árbol que tala, lo que construye, la puerta que fuerza,
  el zombi con el que pelea.
- **Golpes:** quien recibe uno (un colono, una herida nueva; un zombi, menos vida) se tiñe de rojo un
  momento, salpica gotas de sangre que caen al suelo y deja una mancha; quien lo da se lanza un poco
  hacia él y vuelve.
- **Sangre en el suelo:** las manchas de los golpes y las gotas de quien va sangrando (una cada
  poco andado) se secan en un día de juego (enteras la primera mitad).
- **Trabajo:** al talar y al forzar una puerta saltan astillas; al construir, polvo. Solo con la
  partida en marcha.
- **El árbol que cae:** al talar uno que se ve, cae hacia el lado contrario de quien lo tala, cada
  vez más deprisa, levanta polvo al tocar el suelo y se desvanece.

## 2. Cómo se pinta

- `people.ts`: los pasos son las tres filas de abajo de cada vista cambiadas (`WALK_LEGS`), y las
  armas, píxeles sueltos desde la mano (`WEAPON_PX`); cada figura tiene ahora once dibujos (y en el
  lienzo de las figuras caben 320).
- `motion.ts` (sin dibujo, con tests): el paso según lo andado (`walkStep`), las gotas, astillas y
  polvo (`stepParticles`: suben, caen con gravedad y se quedan en el suelo; el polvo flota), cómo se
  secan las manchas (`decalAlpha`), el ángulo del árbol que cae (`fallAngle`) y el golpe hacia
  delante (`lungeAmount`).
- `GameScene`: lo que se recuerda de cada uno entre fotogramas (`Track`: hacia dónde mira, lo andado,
  cuándo se movió por última vez, para no parpadear entre tick y tick, y cuándo deja la próxima
  gota); las heridas y la vida del fotograma anterior para ver los golpes; las manchas, en su capa
  sobre el suelo (como mucho 300, y las de cada mapa en su mapa); las gotas, astillas y polvo en un
  dibujo encima de la gente; y los árboles que caen, en su capa, con el dibujo de su copa (A1).
- El azar de las salpicaduras y del polvo es solo de la pantalla.

## 3. Pruebas

- `motion.test.ts`: los pasos alternos con el de pie entre medias; lo que salta sube, cae y se
  queda; el polvo flota; las manchas se secan; el árbol cae cada vez más deprisa; el golpe va y
  vuelve.
- `people.test.ts`: al andar solo cambian las piernas; cada arma se ve distinta; los zombis no
  llevan; el paso y el lado del dibujo.
- `props.test.ts`: las salpicaduras y la gota.
- Capturas en el navegador: un golpe a un colono y a un zombi (tinte, gotas, manchas), un árbol que
  cae, astillas al talar con la partida en marcha y una colona andando, fotograma a fotograma.
