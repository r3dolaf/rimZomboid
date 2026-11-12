# E1 — El generador

Fecha: 2026-11-12
Estado: aprobado (el usuario pidió seguir «por lo más barato»; las decisiones, sin preguntar)

## 0. Para qué

A mitad de partida falta algo que conseguir y mantener que cambie la vida en la base: con corriente,
el **fregadero vuelve a dar agua** (la bomba del pozo), **lo fresco aguanta** (la nevera), **la base
se ilumina de noche** y **la radio no gasta pilas**. A cambio, **hace ruido** (atrae zombis) y
**gasta gasolina** (escasa): hay que decidir cuándo encenderlo. Se reutiliza lo de la radio (C1):
se encuentra, se construye en la base, se llena (Transportar) y se enciende y apaga.

## 1. Objetos

| Objeto               | Peso | Para qué                      | Dónde                                                          |
| -------------------- | ---- | ----------------------------- | -------------------------------------------------------------- |
| Generador (portátil) | 5 kg | Construirlo en la base        | Ferretería 50 %, nave 40 %, granja 20 %                        |
| Bidón de gasolina    | 2 kg | 6 horas de generador cada uno | Gasolinera 2–5, nave 1–3, granja 0–2, ferretería 0–1, casa 5 % |

Con su propio azar (no cambia el resto del botín), en el pueblo y en los sitios del mapa del mundo.

## 2. Construirlo, llenarlo y encenderlo

- **Construir → Generador**: hace falta uno en el almacén; uno por base, en el suelo de la base (como
  la radio). Se construye **encendido**.
- **Gasolina**: hasta 24 horas; **Transportar** le lleva bidones del almacén cuando le quedan menos
  de 8 (cada uno, 6 horas). En marcha gasta 1 hora por hora.
- **Encender y apagar**: clic derecho (mantener pulsado) en el generador. Apagado, o sin gasolina, no
  hace nada.

## 3. Con el generador en marcha (encendido y con gasolina)

- **Agua**: el fregadero de la base da agua aunque se haya cortado el agua corriente (para beber,
  llenar cubos y regar).
- **Nevera**: lo fresco del almacén se estropea menos: cada mañana, según las horas que ha estado en
  marcha desde la anterior (con 24, a la cuarta parte; con 12, a cinco octavos…).
- **Luz**: de noche, la base se ve iluminada y quien está en ella ve como de día.
- **Radio**: no gasta pilas (y se escucha aunque no tenga).
- **Ruido**: cada 5 segundos de juego (50 ticks) se oye a 15 casillas (un golpe se oye a 10): los
  zombis que lo oyen van hacia allí.

## 4. Pantalla

- Su dibujo, apagado y en marcha (con el piloto encendido y humo).
- Su letrero: «Generador: en marcha · 14 h de gasolina» / «apagado» / «sin gasolina».
- En el menú Construir, con lo que falta («Hace falta un generador en el almacén»…).
- Consejo «Un generador» con el primero en el almacén; en la Ayuda, «⚡ Generador».
- El fregadero dice «con agua (generador)».
- Todo en español e inglés.

## 5. Guardar

Versión 7: las cosas nuevas a 0 en todo lo que guarda cosas. Lo del mueble (encendido, gasolina,
horas en marcha), opcional.

## 6. Pruebas

- **Unitarias:** construirlo (con uno en el almacén, uno por base); gastar gasolina solo en marcha;
  Transportar lo llena; el agua del fregadero con el agua cortada; la nevera según las horas; la
  vista de noche en la base; la radio sin pilas; el ruido; encender y apagar; el botín con su azar;
  una partida de la versión 6.
- **Partida larga:** con generador y gasolina, se llena, se bebe del fregadero tras el corte y no se
  rompe nada.
- **Navegador:** construirlo, encenderlo y apagarlo desde el menú, sin errores.
