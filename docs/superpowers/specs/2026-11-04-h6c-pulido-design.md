# H6c — Pulido: modo depuración F3 y diez arreglos (diseño)

## Objetivo

Cerrar el prototipo: un modo depuración (F3) para mirar por dentro y hacer trampas al probar, y los
diez arreglos pendientes que más se notan al jugar.

Lo aprobado por el usuario: F3 y la lista corta de arreglos (B); F3 con información y trampas (B).

## 1. Modo depuración (F3)

- F3 abre y cierra un panel con: fotogramas por segundo, milisegundos por tick, colonos, zombis y
  viajes; y del colono elegido, sus números exactos (hambre, sueño, ánimo, sangre, salud), qué hace
  y hacia dónde, su camino dibujado en el mapa y la infección aunque aún no se vea.
- **Trampas** (órdenes `debug` de la simulación): ver todo el mapa sin niebla; dar 10 latas, 10
  vendas y 10 antibióticos al almacén; matar los zombis a 20 casillas o menos de algún colono; curar
  al colono elegido (sin heridas, infección ni fiebre, sangre y necesidades llenas). Y pasar 1 hora o
  1 día (la pantalla avanza el juego de golpe).
- Sin abrir F3 no cambia nada.

## 2. Los diez arreglos

1. **Dar de comer a los derribados:** quien hace «Sanar» lleva una lata del almacén a un derribado
   con hambre (por debajo de `EAT_BELOW`).
2. **Tirar ropa:** en Almacén, cada tipo de prenda tiene «Tirar»: esas prendas del almacén
   desaparecen (salen de las cuentas de piezas).
3. **Reforzar con cabeza:** solo la ropa del almacén que permite algún atuendo.
4. **La barra de arriba:** la semilla pasa al panel «Partida».
5. **El registro desde el principio,** vacío: «Aún no ha pasado nada».
6. **Quien se va** («Que se vaya») puede ser atacado por los zombis mientras cruza el mapa.
7. **En la base, primero el almacén:** para comer o vendarse se va al almacén si tiene; lo de la
   mochila, cuando no hay.
8. **Más sucesos buenos del narrador,** repetibles: «Provisiones en la puerta» (unas latas o vendas)
   y «Un buen día» (todos de mejor ánimo un rato).
9. **Sin nombres repetidos:** los nombres usados se recuerdan (colonos, muertos, desconocidos y
   quienes piden unirse).
10. **Registrar cuerpos solo de día,** salvo los que están dentro de la base.

## 3. Pruebas

- Una por arreglo; el panel F3 y sus trampas; la partida larga; el navegador.
