# C2 — Comienzos y ajustes a medida

Fecha: 2026-11-11
Estado: aprobado (bloque C «Un final y una razón para volver»; el usuario pidió seguir y que se
tomen las decisiones sin preguntar)

## 0. Para qué

Hoy toda partida empieza igual: tres supervivientes en una casa del pueblo, con lo mismo en el
almacén. Para volver a jugar hace falta empezar distinto, y para que el juego valga a quien lo
encuentra fácil o difícil, poder ajustarlo (como el modo libre de Project Zomboid). Casi todo son
cifras que ya existen. Además, el objetivo (aguantar, o que os rescaten) se dice al empezar.

## 1. Comienzos

En la portada, antes del narrador, se elige el **comienzo**:

| Comienzo         | Gente | Almacén y lo que llevan                                                                           |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------- |
| El pueblo        | 3     | Como hasta ahora (10 latas, 6 botellas, 2 antibióticos, 6 semillas; cuchillo y 2 vendas cada uno) |
| Solo             | 1     | Como el pueblo                                                                                    |
| Familia numerosa | 5     | Como el pueblo (para cinco, se acaba enseguida)                                                   |
| Con lo puesto    | 3     | Nada: ni comida, ni agua, ni antibióticos, ni semillas; sin cuchillo ni vendas                    |

- **El pueblo** es el de siempre («Para empezar»): con la misma semilla, la misma partida que antes.
- Todos en la base del pueblo, con una cama cada uno (en la base caben cinco).

## 2. Ajustes a medida

Debajo, plegado («Ajustes a medida · todo normal»), cinco ajustes de tres valores, además del
narrador y los zombis de siempre:

| Ajuste       | Menos             | Normal | Más                | Qué cambia                                                                                                      |
| ------------ | ----------------- | ------ | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Infección    | Baja (×0,5)       | ×1     | Alta (×1,5)        | La probabilidad de que un arañazo o un corte infecte (un mordisco, siempre)                                     |
| Botín        | Escaso (×0,6)     | ×1     | Abundante (×1,5)   | La comida, las vendas, las medicinas y el agua de los muebles (el pueblo y los sitios) y del almacén al empezar |
| Asedios      | Pocos (×1,5 días) | ×1     | Muchos (×0,7 días) | El tiempo hasta el primer asedio y entre uno y otro                                                             |
| Hambre y sed | Menos (×0,8)      | ×1     | Más (×1,25)        | Lo que bajan el hambre y la sed (también de viaje)                                                              |
| Frío         | Suave (+4 °C)     | 0      | Duro (−4 °C)       | La temperatura de fuera, todo el año                                                                            |

- El botín se ajusta al crear el mapa (y cada sitio), por mueble, redondeando: no cambia el azar
  del resto de la partida.

## 3. El objetivo

En la portada, bajo el comienzo: «Objetivo: aguantad todo lo que podáis… o encontrad una radio y
que os rescaten».

## 4. Pantalla

- **Portada:** el comienzo (cuatro tarjetas con lo que tiene cada uno), el objetivo y los ajustes
  plegados (cada uno con sus tres botones; el resumen dice cuántos no son normales).
- **Dirección:** el comienzo y los ajustes que no son normales (`?comienzo=solo&infeccion=alta…`),
  para que al recargar o compartir el enlace sea la misma partida.
- **Panel Partida y pantalla final:** el comienzo y los ajustes cambiados, junto a la semilla y el
  narrador.

## 5. Guardar

`Common.setup` (el comienzo y los ajustes) es opcional: una partida de antes es «el pueblo» con todo
normal. No cambia la versión de las partidas guardadas.

## 6. Pruebas

- **Unitarias:** cada comienzo (gente, camas, almacén, armas y vendas; el pueblo, igual que antes);
  cada ajuste (infección, botín en el pueblo, los sitios y el almacén, asedios, hambre y sed también
  de viaje, frío); la dirección (escribirla y leerla); guardar y cargar con ajustes; una partida sin
  `setup`.
- **Portada:** elegir comienzo y ajustes llega a la partida.
- **Navegador:** empezar «Solo» con «Infección alta» desde la portada.
- **Sonda:** cuánto se aguanta con cada comienzo y con todo «más difícil» y todo «más fácil».
- **Partida larga:** una por comienzo, sin romper nada.
