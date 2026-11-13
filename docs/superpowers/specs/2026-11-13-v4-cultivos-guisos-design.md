# V4 — Cultivos y guisos

Fecha: 2026-11-13
Estado: aprobado («Aprobado, adelante»; decidido con el usuario: los cultivos y guisos «de juego», con su
dibujo cada uno; siembra elegida por el jugador, sin automático; las semillas dan pistas, no cifras;
una sola habilidad, Cultivar; los guisos, en el mapa y en los paneles). Bocetos:
https://claude.ai/artifact/G3LQBUX4jRnKwoxkX1ucmf

## 0. Para qué

Hoy hay una sola «hortaliza» y un solo guiso: el huerto se marca una vez y se olvida. El usuario
quiere **variedad**: varios cultivos y varios guisos, cada uno con su dibujo, y que **elegir qué
sembrar y cuándo sea una decisión** del jugador, como en RimWorld.

De paso cubre lo que dejó pendiente Q1: el **hueco de la primavera** (al entrar en el invierno hay
comida para 19–27 días y el huerto no vuelve a dar hasta 25–30 días después). Con cultivos que se
guardan (patata), que aguantan el frío (col) y una conserva, se cubre **jugando bien**, no tocando
cifras.

**Objetivos**

- Cuatro cultivos distintos de verdad (temporada, lo que tardan, lo que dan, lo que aguantan).
- Cinco recetas, cada una con su papel (llenar, guardar, abrigar, animar).
- El jugador elige qué siembra en cada parcela; la descripción de cada semilla da pistas.
- Un dibujo por cultivo (en cada fase) y por plato; los platos, también en los paneles.
- Comer variado anima; comer siempre lo mismo, no.

**No objetivos**

- Sembrar solo (automático): descartado por el usuario.
- Dos habilidades (sembrar y cosechar): se queda una, Cultivar.
- Calidad de la comida, mesas de cocina nuevas, nevera como mueble aparte, árboles frutales.
- Los rasgos nuevos de los colonos: proyecto aparte, después.

**Antiobjetivos** (aunque funcione, sería un fracaso si…)

- …la descripción dice la temperatura exacta o «siembra en tal estación»: deja de ser decisión.
- …un error del jugador gasta **todas** las semillas (lo que arregló Q1): un error cuesta una siembra.
- …no se distinguen los cultivos de un vistazo en el huerto con el zoom normal.
- …la partida de siempre (sin tocar el selector) se vuelve imposible: con patata y lechuga del
  principio tiene que poder jugarse como hoy.

## 1. Enfoques

1. **Cada cosa, un objeto propio** (elegido): lechuga, semillas de lechuga, guiso de patatas… como
   la lata o la venda. Encaja con todo lo que mueve cosas (cargar, mochilas, botín, estropearse,
   guardar partida). Unos 10 objetos más.
2. **«Hortaliza», «semillas» y «guiso» con un subtipo dentro**: menos objetos, pero un segundo tipo
   de inventario que tendrían que entender cargar, mochilas, estropearse, botín, expediciones y
   guardar: más riesgo y no ahorra trabajo. Descartado.

El usuario dejó el cómo a mi criterio («sigue adelante»).

## 2. Los cultivos

Sustituyen a la «hortaliza». Cada uno tiene sus semillas (objeto aparte) y lo que se cosecha.

| Cultivo | Se siembra con el día a | Crece con | La helada lo mata | Tarda   | Da (Cultivar 0) | Se estropea al día | Quita de hambre | Peso   |
| ------- | ----------------------- | --------- | ----------------- | ------- | --------------- | ------------------ | --------------- | ------ |
| Lechuga | 8 °C o más              | 5 °C      | por debajo de −2  | 4 días  | 2               | 25 %               | 25              | 0,3 kg |
| Tomate  | 14 °C o más             | 12 °C     | por debajo de −2  | 8 días  | 5               | 12 %               | 20              | 0,2 kg |
| Patata  | 8 °C o más              | 5 °C      | por debajo de −2  | 10 días | 4               | 2 %                | 40              | 0,3 kg |
| Col     | 2 °C o más              | 0 °C      | por debajo de −10 | 9 días  | 3               | 5 %                | 35              | 1 kg   |

- Las cifras son de partida: se ajustan con la sonda (§10). «Se siembra con el día a» es la media del
  día (como la regla de Q1, ahora por cultivo): los colonos no siembran algo con un frío que
  cualquier agricultor sabe que lo mata, pero **no adivinan el tiempo que viene**: un tomate sembrado
  a final de verano se queda parado cuando refresca y se pierde con la primera helada.
- Por debajo de «crece con» se para (ni crece ni se seca), como hoy con GROW_MIN_TEMP.
- Cultivar sube lo que da cada parcela en la misma proporción que hoy (3 → 4 → 5 con 0/5/10 es +⅓ por
  cada 5 niveles; para todos, `base × (1 + nivel/15)`, la fracción a veces).
- Semillas al cosechar: 1 y otra con el 50 % (como hoy), de ese cultivo.
- Regar, secarse sin agua y pudrirse lo maduro sin cosechar: igual que hoy, para todos.

### 2.1 Pistas de las semillas

La descripción de cada semilla (al tocarla en el almacén y en el selector) da pistas, sin cifras ni
estaciones:

- **Lechuga**: «Brota enseguida si no hace frío. Hay que comérsela pronto.»
- **Tomate**: «Le gusta el sol más fuerte. Da mucho, si le da tiempo a madurar.» (sin decir la
  estación, como pide el antiobjetivo)
- **Patata**: «Tarda, pero se guarda casi para siempre. Sembrar con buen tiempo.»
- **Col**: «Aguanta el fresco y alguna helada. Lenta, pero no se rinde.»

(En inglés, con el mismo tono; el texto final es del constructor.)

### 2.2 Elegir qué se siembra

- La herramienta **Huerto** tiene un selector: **Lechuga, Tomate, Patata, Col**, con el dibujo y el
  número de semillas de cada una en el almacén. Lo elegido es lo que se marca al tocar o arrastrar.
  Empieza en Patata (así, sin tocarlo, se juega como hoy).
- Cada parcela **recuerda su cultivo**. Tocar una parcela ya marcada con otro cultivo lo cambia (lo
  sembrado sigue hasta cosecharse o perderse; lo nuevo, al quedar libre); tocarla con el mismo, la
  desmarca (como hoy). Arrastrar marca y cambia, nunca desmarca.
- Los colonos (Cultivar) solo siembran en cada parcela su cultivo, con sus semillas, y solo si ese día
  hace para sembrarlo. Cogen del almacén las semillas de lo que hace falta.
- **Sin semillas** de lo elegido, la parcela se queda vacía; si hay parcelas vacías por eso, un aviso
  en la barra de avisos («Faltan semillas de col»), uno por cultivo.
- Describir una parcela (tocarla): su cultivo y cómo va («Col, creciendo», «Tomate, madura», «Lechuga:
  sin semillas»).

## 3. Las recetas

En la hoguera (las cocinadas) o en la mesa (la ensalada), con Fabricar como hoy (pedidos «hasta tener
N» en el panel de Fabricar).

| Plato              | Lleva                              | Dónde   | Tarda  | Quita de hambre | Se estropea al día | Además                                                   |
| ------------------ | ---------------------------------- | ------- | ------ | --------------- | ------------------ | -------------------------------------------------------- |
| Guiso de verduras  | 2 hortalizas cualesquiera          | hoguera | 30 min | 80              | 30 %               | «Ha comido caliente» (como hoy)                          |
| Guiso de patatas   | 2 patatas y 1 hortaliza cualquiera | hoguera | 45 min | 100             | 30 %               | «Ha comido caliente»                                     |
| Sopa de col        | 1 col y 1 litro de agua            | hoguera | 30 min | 60              | 30 %               | «Ha comido caliente» y entra en calor: +8 °C durante 6 h |
| Ensalada           | 1 lechuga y 1 tomate               | mesa    | 10 min | 50              | 50 %               | «Algo fresco»: +6 de ánimo, 8 h                          |
| Conserva de tomate | 3 tomates                          | hoguera | 1 h    | 60              | nunca              | se come como una lata                                    |

- «Hortaliza cualquiera» es un ingrediente nuevo de las recetas: cualquiera de las cuatro, empezando
  por la que antes se estropea. (Hoy las recetas solo piden objetos concretos.)
- El agua de la sopa: una botella de agua del almacén o, si no hay, un cubo con agua (vuelve vacío).
- El guiso de siempre (el «guiso» de hoy) pasa a ser el guiso de verduras.

## 4. Comer

- **Orden**: primero lo que antes se estropea; los platos antes que lo crudo, y la conserva y las
  latas al final. Entre dos que se estropean igual, el que **no comió la última vez**.
- **Variedad**: cada colono recuerda lo último que ha comido (las 6 últimas veces). Si entre ellas hay
  3 cosas distintas o más: «Come variado» (+4). Si las 6 son lo mismo: «Siempre lo mismo» (−4). Las
  latas cuentan como una cosa más.
- **Entrar en calor** (la sopa): se suma a lo que abriga la ropa en la sensación térmica (V3), 6 h.
- Las expediciones pueden llevar cualquier comida (el panel ya lista todo lo del almacén); por el
  camino comen lo que antes se estropea, como en la base.
- Lo que se da a las expediciones, la comida de los derribados, el atracón (crisis B2), los avisos de
  «queda poca comida» y el contador de comida de arriba cuentan todo lo que se come, por lo que quita
  de hambre (como hoy `foodUnits`).

## 5. Botín y comienzo

- Las semillas pesan lo de hoy (20 g), todas igual.

- **Al empezar**: 6 patatas de siembra y 3 semillas de lechuga (tras la sonda; antes, 3 y 3), nada más; tomate y col hay
  que encontrarlos.
- **Botín** (con el azar propio de las semillas, como hoy): las mismas cantidades de SEEDS_LOOT
  repartidas por cultivo según el sitio: granja y ferretería, las cuatro; supermercado, lechuga y
  tomate; casa (huertos de casa), tomate y lechuga. Los sitios del mapa del mundo, igual.
- Lo cosechado y los platos no salen en el botín (como hoy).

## 6. Los dibujos

En el estilo de los bocetos (16 × 16, los colores del juego y unos pocos nuevos):

- **Cada cultivo, en 4 fases** (brote, mediano, grande, maduro): lechuga (rosetas verde claro), tomate
  (sube por una caña; tomates verdes y luego rojos), patata (mata baja; flores blancas; madura,
  amarillea y asoman las patatas), col (verde azulado con nervios). Lo mustio, con el tinte de hoy.
- **Objetos**: lo cosechado (4), las semillas (4: un sobre con el color de su cultivo) y los platos (5:
  cuenco de madera; la conserva, en tarro con etiqueta).
- **En el mapa**: mientras alguien cocina en la hoguera, una olla encima con el color de ese plato y su
  vapor (la ensalada, en la mesa, no).
- **En los paneles**: un icono junto al nombre en el Almacén, en el panel de Fabricar (recetas y
  pedidos), en el selector del Huerto y donde se describe lo que lleva alguien. Se pintan con los
  mismos dibujos, en pequeño; se comprueba que se leen en el móvil.

## 7. Guardar partida (versión 8)

- Lo de antes pasa a lo más parecido: «hortaliza» → patata, «semillas» → semillas de patata, «guiso» →
  guiso de verduras; lo sembrado → patata (con sus horas), y las parcelas, con cultivo patata.
- Lo nuevo de cada colono (lo último que ha comido, el calor de la sopa), opcional.

## 8. Ayuda, consejos y crónica

- **Ayuda**: «Huerto y cocina» cuenta que hay cuatro cultivos, que se elige en la herramienta Huerto,
  que las semillas dan pistas y las recetas.
- **Consejos**: el del huerto (día 2) dice que se elige qué sembrar; uno nuevo en otoño: «Lo que
  aguanta el invierno se siembra antes de que hiele» (sin decir cuál). El de «queda poca comida»
  cuenta todo.
- **Registro**: «Se han echado a perder N lechugas y M guisos» (por objeto); «Se ha helado la col».
- **Logros** (C3): uno nuevo, «Buen cocinero»: haber comido los cinco platos en una partida.
- En español y en inglés.

## 9. Pruebas

- Unitarias: cada cultivo crece, se para y se hiela con su temperatura; no se siembra lo que no toca
  ese día; se siembra lo elegido y solo eso; cambiar el cultivo de una parcela sembrada; sin semillas,
  aviso; cada receta (la «hortaliza cualquiera», el agua de la sopa); el orden al comer y la variedad;
  el calor de la sopa; botín y comienzo; guardar y cargar una partida de la versión 7.
- Partida larga (soak): un huerto con los cuatro cultivos elegidos por temporada y las cinco recetas
  pedidas: se cosecha de todo, se cocina de todo, nada se rompe.
- Navegador (e2e): elegir un cultivo en el selector, marcar, ver crecer su dibujo y cosechar; pedir
  una receta y verla en el almacén con su icono.

## 10. Equilibrio

La sonda de Q1 juega como un jugador competente: ahora tiene que **elegir bien** (patata y tomate en
verano, conserva en otoño, col antes del invierno) y, aparte, como **jugador descuidado** (todo
patata, como hoy). Objetivos:

- Competente: Equilibrado llega al día 60 un 25–35 % (Q1 se quedó en 17 %), y en Tranquilo el hambre
  deja de ser la mitad de las muertes.
- Descuidado: no peor que hoy (Q1).

### 10.1 Resultado

Cuatro vueltas (144 partidas de 60 días cada una: Equilibrado 36, Tranquilo 18 y Caótico 18, por
jugador; la sonda, en `probe/balance.test.ts`, no se publica). La sonda cuenta además lo que se
seca, se pudre o se hiela, los avisos de semillas y los platos hechos.

- **Vuelta 1** (como el diseño): más difícil que Q1, sobre todo por el hambre. Quien no toca el
  selector solo tenía 3 patatas de siembra (antes, 6 semillas); la col se helaba casi cada noche de
  invierno con −6; y en la sonda el guiso de verduras iba el primero de los pedidos y se llevaba las
  hortalizas de los otros platos (un jugador lo pondría el último).
- **Vuelta 2**: 6 patatas de siembra y 3 de lechuga; la col, de invierno (se siembra desde 2,
  crece desde 0 y aguanta hasta −10); la sonda, con el guiso de verduras el último.
- **Vuelta 3**: la patata y el tomate dejan 2 semillas (antes 1), y otra a veces: con 1, faltaban
  semillas (unos 8 avisos por partida; ahora, unos 6).
- **Vuelta 4**: 2 semillas de tomate al empezar (para que el competente haga conservas): sin efecto
  claro (las conservas, de 0,5 a 0,5–1,3 por partida); no se queda.

| Narrador    | Q1 (mediana / al día 60) | Descuidado (vueltas 2–3) | Competente (vueltas 2–4) |
| ----------- | ------------------------ | ------------------------ | ------------------------ |
| Equilibrado | 46 / 17 %                | 44 / 11–13 %             | 42–50 / 8–16 %           |
| Tranquilo   | 61 / 67 %                | 49–58 / 27–38 %          | 53–61 / 33–61 %          |
| Caótico     | 28,5 / 6 %               | 22 / 0 %                 | 24–28 / 0 %              |

Entre vueltas con las mismas cifras, lo que llega al final varía más de 20 puntos en Tranquilo (18
partidas): las diferencias de menos de eso son ruido. Lo que queda: el competente no llega al 25–35 %
en Equilibrado (ahí mata sobre todo la infección, un 40 %, y la sed, un 20 %; el hambre, un 20–25 %),
y en Tranquilo el hambre de primavera sigue siendo la mitad de las muertes: la conserva casi no se
hace (el tomate sale del botín) y entrar al invierno con comida para unos 15–25 días no basta hasta
la primera cosecha de primavera. Ninguno de los dos se arregla bien con más cifras del huerto.

## 11. Lo que decide quien lo construye

- Los nombres de los objetos y de los dibujos, y cómo se guarda lo elegido en cada parcela.
- Cómo se pinta un dibujo en un icono de panel (sin depender de Phaser en la interfaz).
- El texto final de pistas, consejos y ayuda en los dos idiomas.
- Ajustar las cifras de §2 y §3 con la sonda, sin tocar los antiobjetivos.
