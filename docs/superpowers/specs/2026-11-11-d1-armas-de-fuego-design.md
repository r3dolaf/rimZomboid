# D1 — Armas de fuego

Fecha: 2026-11-11
Estado: aprobado (el usuario pidió seguir «por lo más barato»; las decisiones, sin preguntar)

## 0. Para qué

Desde N1 los asedios llegan con ritmo y la colonia solo puede responder a golpes o escondiéndose. Un
arma de fuego mata de lejos, pero **se oye desde muy lejos** (atrae a más zombis) y la munición
escasea: hay que decidir quién la lleva y cuándo se usa. Además vende en un juego de zombis. Se
reutiliza lo que ya hay: el ruido, la postura, el modo combate y «Llevar siempre».

## 1. Las armas y la munición

| Objeto   | Peso   | Munición  | Alcance    | Cada disparo | Daño                                   | Ruido       |
| -------- | ------ | --------- | ---------- | ------------ | -------------------------------------- | ----------- |
| Pistola  | 1 kg   | Balas     | 8 casillas | 2 s          | 60 (un zombi tiene 60)                 | 30 casillas |
| Escopeta | 3,5 kg | Cartuchos | 5 casillas | 4 s          | 60 al zombi y 40 a otros 2 a 1,5 de él | 35 casillas |

- Balas 0,02 kg; cartuchos 0,04 kg.
- Son **cosas que se llevan encima**, no el arma de la mano: el cuchillo o el machete siguen para los
  golpes (sin ruido) y el arma de fuego se usa cuando hace falta. Quién la lleva lo decide el
  jugador con **«Llevar siempre»** (ficha → Bolsas): «1 pistola, 20 balas» (Transportar no, cada uno
  va a por lo suyo, como las vendas).
- Comparación: un golpe se oye a 10 casillas y romper una ventana a 12.

## 2. Disparar

- Quien pelea con un zombi, lleva un arma de fuego **con munición para ella** y lo tiene **a tiro**
  (a su alcance y en línea recta) **dispara** en vez de acercarse. Si lleva las dos, la escopeta
  cuando hay otro zombi a 1,5 casillas del suyo; si no, la pistola.
- **Cuándo:** en **modo combate**, siempre. Si no, solo **en apuros**: ve 2 zombis o más, tiene la
  salud por debajo de 50 o la sangre por debajo de 60, o hay un asedio en marcha. Con un zombi solo y
  bien, a golpes (sin ruido).
- **Acertar:** como un golpe (según Pelear y los brazos), menos un 4 % por casilla de distancia con
  la pistola y un 2 % con la escopeta; como poco, un 20 %. 1 de cada 6 aciertos, a la cabeza (doble),
  como los golpes. Se practica Pelear con cada disparo.
- Cada disparo gasta una bala o un cartucho y hace ruido (los zombis que lo oyen van hacia allí).
- **Pelear o huir:** con un arma de fuego cargada se pelea con más zombis a la vista (con Decidir,
  hasta 3 en vez de 1, más o menos según Valiente o Cobarde), con la salud en 50 o más.
- Los desconocidos y los viajes por el camino, como hasta ahora.

## 3. Dónde se encuentran (con su propio azar: no cambia el resto del botín)

| Edificio   | Pistolas | Balas | Escopetas | Cartuchos |
| ---------- | -------- | ----- | --------- | --------- |
| Comisaría  | 1–2      | 12–30 | 50 %      | 0–8       |
| Granja     |          |       | 50 %      | 2–8       |
| Ferretería |          |       |           | 0–6       |

En el pueblo y en los sitios del mapa del mundo (el puesto del ejército es una comisaría).

## 4. Pantalla y sonido

- Al disparar: un fogonazo y una línea hasta el zombi; suena el disparo (distinto en la escopeta).
- Consejo «Un arma de fuego» con la primera en el almacén: cómo dársela a alguien y cuándo dispara.
- Ayuda: «🔫 Armas de fuego».
- Nombres en español e inglés. Depuración: «Dar» también da una pistola y 30 balas.

## 5. Guardar

Versión 6: las cosas nuevas, a 0 en todo lo que guarda cosas. El último disparo de cada uno
(`shot`, para dibujarlo) es opcional.

## 6. Pruebas

- **Unitarias:** disparar a tiro y no fuera de él ni sin línea recta; sin munición, a golpes; gastar
  munición; el ruido; cuándo (modo combate, apuros, asedio; con uno solo y bien, no); la escopeta y
  los de al lado; acertar con la distancia; pelear con más zombis con un arma cargada; el botín con
  su azar (no cambia lo demás); cargar una partida de la versión 5.
- **Partida larga:** con pistolas y balas en «Llevar siempre», se dispara, se gastan balas, se matan
  zombis y no se rompe nada.
- **Navegador:** un colono con pistola y balas dispara a zombis cercanos sin errores.
