# rimZomboid — H3b Relaciones: diseño

Fecha: 2026-10-20
Estado: aprobado en conversación. Hito nuevo entre H3 y H4. Adelanta del diseño general "relaciones entre supervivientes" y "nuevos supervivientes que llegan al grupo".

## 1. Objetivo

Los colonos charlan, se hacen amigos o rivales, discuten, se pelean, se consuelan, comparten comida y pueden hacerse pareja. Llegan desconocidos que el jugador acepta o rechaza. Todo se ve en el mapa, en la ficha y en el registro.

## 2. Opinión

- `Survivor.opinions: Record<string, number>`: opinión de este colono sobre cada uno de los demás, por id. Va de −100 a 100 y si no hay entrada vale 0. No tiene por qué ser mutua.
- **Al empezar:** los 3 colonos iniciales tienen una opinión al azar de −10 a +20 entre ellos. Los recién llegados empiezan en 0 en ambos sentidos.
- **Se diluye:** cada día de juego, cada opinión se acerca a 0 un 10 % (y al menos 1 punto). Ajustado al implementar: con solo 1 punto al día, en un grupo de 3 todos acababan en 100 con todos en una semana; así cada pareja de colonos se estabiliza según sus rasgos y su ánimo.
- **Etiquetas:** Amigo si es ≥ 40; Rival si es ≤ −40; Pareja si `partnerId` apunta a esa persona.

## 3. Charlas y necesidad social

- **Cuándo:** cada colono tiene un `nextChatAt`. Al llegar a ese tick, si está despierto y no está en crisis ni peleando, busca al colono más cercano que cumpla tres cosas: que esté a 6 casillas o menos, que lo vea (línea de visión) y que también esté disponible.
  - Si encuentra a alguien, charlan, y los dos fijan el siguiente intento entre 450 y 750 ticks después (1,5–2,5 h de juego).
  - Si no encuentra a nadie, lo reintenta a los 30 ticks.
- **Tipo de charla** (lo elige quien inicia, con estos pesos):
  - **Base:** agradable 60, neutra 30, discusión 10, insulto 0.
  - **Opinión** `o` de quien inicia sobre el otro: agradable + 0,3·o, discusión − 0,1·o.
  - **Ánimo** de cualquiera de los dos por debajo de 25: discusión +15 e insulto +10.
  - **Insulto** solo es posible si `o` < 0 o si el que inicia tiene el ánimo por debajo de 25.
  - **Optimista** (el que inicia): agradable +15. **Pesimista:** agradable −10 y discusión +10.
  - Los pesos negativos cuentan como 0.

| Charla    | Opinión (ambos) | Social (ambos) | Recuerdo (24 h si no se indica)           |
| --------- | --------------- | -------------- | ----------------------------------------- |
| Agradable | +2              | +15            | ambos: "Buena charla con X" +3 (6 h)      |
| Neutra    | +1              | +8             | —                                         |
| Discusión | −4              | +3             | ambos: "Discutió con X" −5 (12 h)         |
| Insulto   | −8              | +3             | el insultado: "Insultado por X" −8 (12 h) |

(Opinión de la tabla ajustada al implementar, desde +4/+1/−5/−10: con la cifra original las amistades llegaban al máximo en días.)

- **Necesidad Social** (`needs.social`, de 0 a 100, empieza al azar entre 60 y 100):
  - baja 50 puntos por día;
  - por debajo de 20, modificador de estado "Solo" −10.
- **Recuerdos con otra persona:** llevan `otherId`. Un recuerdo nuevo del mismo tipo sustituye al anterior.

## 4. Conflictos y apoyo

- **Pelea:**
  - **Cuándo:** tras un insulto, si alguno de los dos tiene al otro en −40 o menos y alguno tiene el ánimo por debajo de 25, hay un 30 % de pelea.
  - **Qué pasa:** los dos pasan a la acción `fight` durante 30 ticks (interrumpe todo salvo dormir). Cada uno pierde 15 de opinión sobre el otro y recibe "Se peleó con X" −10 (24 h).
  - Queda en el registro.
- **Consolar:**
  - **Quién recibe consuelo:** un colono **en crisis**, o **al límite** (ánimo por debajo de 25), que no tenga ya un "Consolado" vigente.
  - **Quién consuela:** un colono despierto, sin crisis, con ánimo de 25 o más y una opinión del otro de +20 o más (o que sea su pareja). Va hasta él y, a 2 casillas o menos, lo consuela durante 30 ticks.
  - **Prioridad:** consolar va después de las urgencias propias y antes del trabajo. Una persona solo recibe consuelo de un colono a la vez.
  - **Al terminar:** el consolado recibe "Consolado por X" +10 (12 h), o "Consolado por su pareja" +15. Si estaba en crisis, la crisis termina. Los dos ganan +3 de opinión (ajustado al implementar desde +8: sin comida hay consuelos a diario y con +8 todos acababan en 100). Queda en el registro.
  - Tras ser consolado, como tras desahogarse, no entra en otra crisis mientras dure el recuerdo.
- **Compartir comida:** en una charla agradable o neutra, si el otro tiene hambre por debajo de 35, quien inicia lleva comida, su opinión del otro es de 0 o más y al otro le cabe, le da 1 lata.
  - Los dos ganan +5 de opinión.
  - El que la recibe gana "X compartió su comida" +5 (12 h).
  - Queda en el registro.

## 5. Parejas

- **Formarse:** tras una charla agradable entre dos sin pareja que se tienen ≥ 60 en ambos sentidos, hay un 10 % de que se hagan pareja (`partnerId` mutuo). Queda en el registro.
- **Durmió con su pareja:** al despertar, si su pareja está durmiendo, recibe "Durmió con su pareja" +5 (12 h).
- **Ruptura:** si la opinión de cualquiera de los dos sobre el otro baja de 20, rompen.
  - Los dos reciben "Ruptura con X" −15 (72 h) y pierden 20 de opinión sobre el otro.
  - Queda en el registro.

## 6. Recién llegados

- **`World.stranger`:** `{ survivor, expiresAt, leaving }` o `null`. `World.nextStrangerAt` es el tick de la siguiente llegada; la primera llega entre el día 3 y el 6.
- **Aparición:** al llegar el tick, si la colonia tiene menos de 8 colonos y no hay otro desconocido, aparece uno en el extremo de una carretera, en el borde del mapa.
  - Trae nombre sin repetir, rasgos, necesidades al azar, de 0 a 4 latas y un 30 % de llevar una venda.
  - Camina hasta la casilla de fuera de la puerta de la base y espera allí.
  - Queda en el registro.
- **Órdenes:** `acceptStranger` y `rejectStranger`.
  - **Aceptar:**
    - pasa a la lista de colonos con sus propias opiniones vacías;
    - recibe permiso para saquear salvo si es Cobarde;
    - recibe una cama si queda hueco de las 5 posibles, en las posiciones (x+2, y+1), (x+5, y+1), (x+9, y+1), (x+2, y+3) y (x+9, y+3) de la base; si no, `bedId: null` y duerme en el suelo de la base.
  - **Rechazar:** se marcha.
  - **Sin respuesta en 1 día de juego:** se marcha.
  - Al marcharse vuelve al borde del mapa y desaparece. La siguiente llegada se programa entre 3 y 6 días después.
- **Pausa:** la interfaz pausa el juego cuando aparece un desconocido.

## 7. Pantalla

- **Iconos sobre la cabeza durante 30 ticks** (`Survivor.bubble`):
  - 💬 charla;
  - 💢 discusión o insulto;
  - 🥊 pelea;
  - 🤝 consolar;
  - 🍞 compartir;
  - 💕 nueva pareja.
- **El desconocido** se dibuja como un punto gris.
- **Tarjetas:**
  - una cuarta barra Social (amarilla por debajo de 35, roja por debajo de 20);
  - 💕 junto al nombre si tiene pareja;
  - se crean y se quitan según quién esté en la colonia.
- **Ficha:** sección "Relaciones" con la pareja y la lista de opiniones ordenada, con su etiqueta. Los motivos de ánimo con otra persona llevan su nombre.
- **Aviso del recién llegado:** nombre, rasgos, lo que lleva y los botones Aceptar y Rechazar. Los botones se crean una sola vez.
- **Registro:** insulto, pelea, consuelo, comida compartida, pareja, ruptura, llegada, aceptado, rechazado y se marcha. Las charlas normales no se registran.

## 8. Pruebas

- **Unitarias:** cada regla de las §2–§6.
- **Escenarios:**
  - dos colonos que charlan durante días acaban siendo amigos;
  - un colono en crisis con un amigo cerca es consolado;
  - al aceptar a un desconocido se convierte en colono con cama.
- **Partidas automáticas:** las actuales, más otra aceptando a todos los desconocidos. Se comprueba:
  - opiniones dentro de [−100, 100];
  - parejas mutuas y únicas;
  - social dentro de [0, 100];
  - que nadie se queda bloqueado.
- **Navegador:**
  - con el aviso del desconocido, Aceptar añade una tarjeta;
  - la ficha muestra "Relaciones".

## 9. Criterio de éxito

En una partida normal se ven charlas en el mapa, se forman amistades y rivalidades, alguien consuela a quien está en crisis, aparecen desconocidos que puedes aceptar y todo queda explicado en la ficha y en el registro. Todos los tests y las partidas automáticas pasan.
