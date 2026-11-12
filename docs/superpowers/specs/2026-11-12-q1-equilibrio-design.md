# Q1 — Equilibrio grande

Fecha: 2026-11-12
Estado: aprobado (el usuario pidió «el doble de sondas, hay que equilibrar bien»; las decisiones, sin
preguntar)

## 0. Para qué

Desde la última sonda de equilibrio (bloque A) han entrado el huerto, el agua, las estaciones, la
amputación, la radio, los asedios con ritmo, los comienzos, las crisis, la infección revisada, las
armas de fuego y el generador. No se sabe cuánto se aguanta ahora ni de qué se muere. Con una mitad
de partida (asentarse) el objetivo ya no es «caer el día 24», sino que **un buen jugador pase el
primer otoño, sufra en el invierno y a veces llegue al año**.

## 1. La sonda

72 partidas de 60 días sin pantalla (el doble de las 36 propuestas): **Equilibrado 36**, **Tranquilo
18** y **Caótico 18**, con zombis normales y el pueblo de siempre. Juega como un jugador competente:
saquea todo, tapia las ventanas de la base, mesa y vendas hasta 10, un barril, un huerto de 16, una
hoguera y guisos, marca los cuerpos, lleva pistola y balas si las encuentra y contesta con sensatez.
Sin expediciones ni radio. Apunta cuándo cae, de qué muere cada uno y cuándo, la comida de cada día,
los asedios, las heridas, las amputaciones y las crisis (`probe/balance.test.ts`, no se publica).

## 2. Objetivos

| Narrador    | Cae (mediana) | Llegan al día 60 | Además                                   |
| ----------- | ------------- | ---------------- | ---------------------------------------- |
| Tranquilo   | 50 o más      | 50 % o más       |                                          |
| Equilibrado | día 35–45     | 25–35 %          | El 60 % o más llega al invierno (día 31) |
| Caótico     | día 22–30     | 15 % o menos     |                                          |

En todos: ninguna causa de muerte por encima del 45 % (la infección) o del 35 % (las demás); el
hambre, la sed y el frío, presentes pero no lo que más mata.

## 3. Cómo se ajusta

Se cambian cifras de `balance.ts` (una o dos cada vez), se vuelve a medir con las mismas semillas y se
apunta cada vuelta en la hoja de ruta (lo que se cambió y lo que dio), hasta cumplir los objetivos o
explicar por qué no.
