# A4 Arte: luz, niebla y tiempo — diseño

## Objetivo

Cuarto paso del arte: que la noche no sea un velo azul igual en todas partes con la hoguera
dibujada como anillos encima, que la niebla no se vea a cuadros, y que la tormenta y la lluvia se
vean.

## 1. Lo que se ve

- **La noche oscurece y azulea** (más con tormenta), y **cada hoguera vista deja un hueco de luz
  suave**, sin anillos, que **tiembla con la llama**, **es cálido** cerca del fuego y **no pasa los
  muros**, las puertas ni lo tapiado (sí las ventanas). En lo ya visto que ahora no se ve, la luz
  aclara la niebla a medias: los cuartos de la base con hoguera se ven alumbrados.
- **La niebla, de bordes suaves:** se difumina en el borde de lo que se ve, en vez de ir a cuadros.
- **Lluvia** mientras llueve o hay tormenta (gotas que caen ladeadas por el viento) y, con
  tormenta, **relámpagos** de vez en cuando que lo blanquean todo un momento.
- **Las ventanas no se encienden:** en el juego no hay lámparas; solo alumbran las hogueras.

## 2. Cómo se pinta

- `light.ts` (sin dibujo, con tests): `lightField` calcula cuánta luz llega a cada píxel (dos por
  casilla) desde cada hoguera, con lo que vería desde su casilla (`computeFov` de la vista de la
  simulación) y una caída suave (`falloff`); `nightShade` da por cuánto se multiplica el color.
- **La niebla y la noche son una sola capa** de dos píxeles por casilla, estirada con suavizado,
  que **multiplica** el color por lo que queda de él: lo que deja la niebla × lo que deja la noche
  (o la luz). Se repinta cuando cambia la niebla (cada 4 fotogramas, como antes) o la luz (cada 3
  con hogueras; sin ellas, solo si cambia el cielo).
- **Por qué multiplicar y por qué una sola capa** (medido en el navegador de pruebas, que no tiene
  tarjeta gráfica y dibuja con el procesador):
  - Una capa que tapa (como la de antes) Phaser la juntaba al dibujar con los letreros de los
    edificios, cada uno con su textura, y cada píxel de la capa pagaba todas esas texturas: ~24
    imágenes por segundo de día frente a ~32. Multiplicar obliga a dibujarla aparte. Para la
    niebla, multiplicar da exactamente lo mismo que tapar de negro.
  - Con la noche y el resplandor en capas aparte, de noche bajaba a ~17 (frente a ~28). En una
    sola capa con la niebla, de noche hay las mismas capas que de día: ~30 de día y de noche.
- Con `pixelArt`, Phaser vuelve a poner a cuadros cada lienzo que sube; por eso, tras subirlo, se
  vuelve a poner el suavizado (`smoothRefresh`).
- La lluvia es un dibujo de 64×64 que se repite (`weather.ts`) y solo cubre lo que se ve; el
  relámpago, un rectángulo blanco que se desvanece en 0,35 s. El azar del relámpago es solo de la
  pantalla.

## 3. Pruebas

- `light.test.ts`: la caída suave y sin escalones; la oscuridad con y sin luz; una hoguera alumbra
  alrededor y nada fuera de su alcance; un muro para la luz y una ventana no; donde llegan dos,
  la más fuerte; la noche multiplica (sin oscuridad, nada; del todo, el tinte; azulea) y cerca del
  fuego tira a cálido.
- Capturas en el navegador: la niebla de día, la noche con una hoguera fuera y otra dentro de la
  base, y una tormenta de día con lluvia. Imágenes por segundo de día, de noche con dos hogueras y
  con una horda de 40 zombis (~29–31).
