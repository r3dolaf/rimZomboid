# V1 — Huerto, cocina y comida que se estropea

Fecha: 2026-11-08
Estado: aprobado (el usuario pidió el bloque A «Asentarse» y que se tomen las decisiones sin
preguntar)

## 0. Para qué

Hoy la comida solo sale de las latas saqueadas: cada partida es una cuenta atrás y está ajustada
para caer hacia el día 24. Para que el juego dure y se pueda vender hace falta una **mitad de
partida**: pasar de saquear a vivir de lo que se cultiva. V1 es el primer paso del bloque
«Asentarse» (después, V2 Beber y V3 Estaciones y frío).

Objetivo de juego: una colonia que invierte en un huerto pronto (semillas, agua y manos) puede
alimentarse sola hacia el día 12–15; la que no, sigue dependiendo de las latas. La comida fresca se
estropea, así que no basta con amontonar: hay que cultivar y cocinar con cabeza.

## 1. Objetos nuevos (montones)

| Objeto                | Peso    | Quita hambre | Se estropea | De dónde sale           |
| --------------------- | ------- | ------------ | ----------- | ----------------------- |
| Semillas (`seeds`)    | 0,02 kg | —            | no          | botín y al cosechar     |
| Hortalizas (`veg`)    | 0,5 kg  | 35           | 10 % al día | al cosechar             |
| Guiso (`meal`)        | 0,6 kg  | 80           | 30 % al día | cocinando en la hoguera |
| Latas (`food`, igual) | 0,5 kg  | 60           | no          | botín (como antes)      |

- Se añaden al final de `ITEM_KINDS` (lo de antes se coge en el mismo orden).
- **Estropearse:** una vez al día (a las 06:00) cada montón de hortalizas y de guisos pierde su
  porcentaje: la parte entera seguro y la fracción con su probabilidad. Vale para todo lo que hay en
  un mapa que se simula (almacén, montones, contenedores, lo que llevan encima y en sus bolsas) y
  para lo que llevan los que van de viaje. Si se pierde algo en el almacén, el registro lo dice una
  vez al día: «Se han estropeado 3 hortalizas y 1 guiso» (Colonia).
- Se empieza con **6 semillas** en el almacén, para que el huerto se descubra pronto.

## 2. Semillas en el botín

Con su propio azar y al final (como las hachuelas de H5b2): el resto del botín sale igual.

- Granja 4–8 (en un sitio del mapa del mundo, 6–12), ferretería 1–3, supermercado 0–2, casa 10 %.

## 3. El huerto

- **Herramienta Huerto** (🌱, junto a Talar): clic en una casilla de hierba vista la marca o
  desmarca; arrastrar marca las del rectángulo. Solo hierba, fuera de los edificios, sin mueble,
  montón, plano ni árbol. Solo en la base (en los sitios no hay huerto).
- Cada casilla marcada es una **parcela** (`Plot`): vacía, creciendo o madura.
- **Sembrar:** con una semilla. **Crecer:** 7 días con tierra húmeda (lo seco no crece).
- **Humedad:** cada parcela guarda las horas de humedad que le quedan. La lluvia la deja en 48 h
  (cada hora de lluvia). **Regar** una parcela gasta 1 litro y la deja en 36 h.
- **Seca:** tras 3 días seguidos sin humedad, lo sembrado se seca y se pierde (la parcela queda
  vacía; «Se ha secado un cultivo», una vez al día).
- **Madura:** hay que cosecharla en 4 días o se pudre (igual que seca).
- **Cosechar** deja en la parcela un montón con 3 hortalizas con Cultivar 0, 4 con 5 y 5 con 10 (la
  fracción, con su probabilidad), más 1 semilla y otra la mitad de las veces. Lo lleva al almacén
  Transportar, como cualquier montón.
- Desmarcar una parcela con algo sembrado lo pierde.
- Cuentas (4 colonos): una parcela da en 7 días 4 hortalizas (140 de hambre, 160 cocinadas); para
  que 4 colonos coman solo del huerto hacen falta unas 14 parcelas.

## 4. Trabajo y habilidad Cultivar

- Trabajo nuevo **Cultivar** (`farm`), con su habilidad (rapidez y cosecha), su columna en Trabajos,
  prioridad 3 y permitido por defecto. La habilidad se sortea después de Sanar (lo de antes sale
  igual) y no puede ser la especialidad.
- Por orden: **cosechar** lo maduro; **regar** lo seco que esté sembrado; **sembrar** lo vacío.
  - Sembrar: coge del almacén las semillas que vaya a usar (hasta 10) y siembra una a una
    (5 minutos cada una con Cultivar 5).
  - Regar: va a por agua a la fuente más cercana (fregadero con agua corriente, cisterna o barreño
    con agua), coge hasta 4 litros y riega una a una (3 minutos). El agua que lleva para regar
    (`Survivor.waterCan`) no pesa y se queda para la próxima vez.
  - Cosechar: 10 minutos por parcela.
- Practicar Cultivar sube la habilidad, como las demás.

## 5. Cocinar

- Receta nueva **Cocinar** en Fabricar: 2 hortalizas → 1 guiso, media hora, en la **hoguera**
  (nueva forma de mueble para las recetas, como el barreño). Sin hoguera, Fabricar lo dice.
- Comer: primero el guiso, luego las hortalizas y al final las latas (lo que se estropea antes).
  Comer un guiso da el recuerdo **Comida caliente** (+8, 8 h) en vez de «Ha comido» (+5).
- Todo lo que contaba latas cuenta ahora la comida por lo que quita de hambre (días de comida, la
  pelea por la comida, el aviso de que no queda): 1 guiso = 4/3 latas, 1 hortaliza = 7/12.
- Los demás usos de las latas (de viaje, dar de comer a un derribado, compartir, robar) usan la
  comida que haya, en el mismo orden.

## 6. Pantalla

- **Botón Huerto** y su ayuda; en el mapa, la parcela: tierra labrada, brote, planta y planta con
  fruto (y más clara si está seca). Al pasar el ratón: «Huerto: creciendo 60 % · húmeda 20 h» o
  «seca».
- **Barra de arriba:** el contador de comida suma latas, hortalizas y guisos (con su título).
- **Almacén, Fabricar y Trabajos:** lo nuevo, con sus nombres.

## 7. Guardar

- `SAVE_VERSION` 2. Las partidas de la versión 1 **se siguen cargando**: se les añade lo que falta
  (las parcelas vacías, las cuentas de los objetos nuevos a 0 y Cultivar en cada colono).

## 8. Pruebas

- **Unitarias:** marcar y desmarcar, sembrar, crecer con humedad y no sin ella, lluvia, regar,
  secarse, cosechar (cantidades por habilidad), pudrirse lo maduro, estropearse, cocinar, comer en
  orden, días de comida, cargar una partida de la versión 1.
- **Invariantes:** parcelas sobre hierba, sin repetir casilla, valores dentro de su rango.
- **Partida larga:** una colonia con huerto desde el día 1 cosecha y come de él.
- **Navegador:** el botón Huerto marca parcelas.
