# C3 — Crónica y logros

Fecha: 2026-11-12
Estado: aprobado (el usuario pidió seguir «por lo más barato»; las decisiones, sin preguntar)

## 0. Para qué

Una partida de un juego de colonias se recuerda por su historia: quién murió, quién llegó, el asedio
que casi acaba con todos. Hoy la pantalla final da cifras y el registro solo guarda los últimos 100
sucesos. Con una **crónica** de los momentos clave que se puede **compartir** (texto o imagen), cada
partida se cuenta (y trae jugadores). Los **logros** dan metas a medio plazo para volver a jugar, y
Steam los pide.

## 1. La crónica

- Se apuntan aparte (y se guardan con la partida), sin límite práctico (los últimos 300):
  - **Siempre:** muertes, quien se une (aceptado o por el camino), parejas y rupturas, asedios (llega
    y rechazado), amputaciones, echar a alguien, acabar con su sufrimiento, ver a un compañero
    convertido, fiestas de cumpleaños, castigar un robo, las crisis de atracón, rabia y huida, cada
    estación nueva, la radio (dónde y cuándo), el helicóptero (llega, quién sube, se va) y el final.
  - **Solo la primera vez:** se corta el agua, se acaba la comida, entra un zombi en la base, hiela
    el huerto, la radio da la primera noticia, una pelea entre colonos, alguien se inspira.
- Cada línea, con su día: «Día 12 · Ana y Luis ahora son pareja» (la misma frase que en el registro).
- Partidas guardadas de antes: su crónica empieza con lo que haya de esto en su registro.

## 2. La pantalla final

- **Crónica**: la lista entera (con barra si es larga).
- **Logros de esta partida**: los que se han conseguido en ella.
- **Compartir**: «📋 Copiar la crónica» (como texto: el final, los días, el comienzo, las cifras, la
  crónica y la dirección del juego) y «🖼️ Guardar imagen» (un PNG con lo mismo, con las 24 líneas
  más importantes de la crónica si no caben todas: muertes, llegadas, asedios, rescate y final
  primero).

## 3. Los logros

20, guardados **en el navegador** (valen para todas las partidas):

| Logro            | Cómo                                   |
| ---------------- | -------------------------------------- |
| Primera noche    | Llegar al día 2                        |
| Una semana       | Llegar al día 8                        |
| Un mes           | Llegar al día 31                       |
| Primavera        | Llegar al día 46 (pasar el invierno)   |
| Un año           | Llegar al día 61                       |
| Rescatados       | Ganar (subir al helicóptero)           |
| Nadie se queda   | Ganar sin ninguna muerte               |
| Asedio rechazado | Rechazar un asedio                     |
| Fortaleza        | Rechazar 3 asedios                     |
| Primera cosecha  | Cosechar                               |
| Autosuficientes  | Cosechar 100 hortalizas                |
| Cien zombis      | Matar 100                              |
| Mil zombis       | Matar 1000                             |
| Cirujano         | Amputar                                |
| Bienvenido       | Que alguien se una                     |
| Una familia      | 8 en la colonia a la vez               |
| Pareja           | Que dos se hagan pareja                |
| Lobo solitario   | Con el comienzo Solo, llegar al día 15 |
| Al habla         | Saber por la radio dónde y cuándo      |
| Primer disparo   | Disparar un arma de fuego              |

- Al conseguir uno: un aviso arriba, «🏆 Logro: Primera noche», con el sonido de lo bueno.
- En el panel **Partida**: «🏆 Logros 5/20» con la lista (los que faltan, apagados, con cómo se
  consiguen).
- **Con trampas no cuentan**: si en la partida se ha usado algo de depuración (dar, matar, curar,
  saltar horas, la radio, el helicóptero), no se consigue ninguno en ella (y lo dice el panel).

## 4. Idiomas

Todo en español e inglés.

## 5. Pruebas

- **Unitarias:** qué se apunta en la crónica (siempre, la primera vez, lo que no) y su límite; la
  partida guardada (con y sin crónica); las trampas marcan la partida; cada logro, cuándo; se guardan
  y no se repiten; con trampas, ninguno; el texto para compartir; la pantalla final con la crónica.
- **Navegador:** conseguir un logro (aviso y en Partida); la pantalla final con su crónica, copiar y
  guardar la imagen sin errores.
