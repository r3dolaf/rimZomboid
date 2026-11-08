# V2 — Beber

Fecha: 2026-11-08
Estado: aprobado (bloque A «Asentarse»; el usuario pidió que se tomen las decisiones sin preguntar)

## 0. Para qué

El agua ya existe (botellas, cubos, fregaderos con agua corriente que se corta entre los días 7 y 14,
cisternas, lluvia y barreño), pero solo sirve para lavar ropa y, desde V1, para regar. Con la sed,
todo eso se vuelve tensión de verdad: antes del corte hay que **guardar agua**, después hay que
**recogerla** de la lluvia o ir a por ella lejos, y salir de viaje obliga a llevarla. El agua también
compite con el huerto y con lavar.

## 1. La sed

- Necesidad nueva **Sed** (`Needs.thirst`, 0–100, 100 = bien): baja 100 al día (con fiebre, ×1,5) y
  se empieza entre 60 y 100, como el hambre.
- **Beber** cuando baja de 40: 1 litro sube 50 (unos 2 litros al día por persona). Tarda 2 minutos.
- **Ánimo:** «Con sed» (−10) por debajo de 25; «Deshidratado» (−25) a 0.
- **A 0:** pierde 4 de sangre por hora (desnutrido, 2): se desmaya en unas 16 h y muere en unas 25.
  Causa de muerte nueva: «de sed».
- Beber va antes que comer y que dormir; quien está en crisis deja la crisis para beber por debajo
  de 10 (como para comer).

## 2. De dónde se bebe

Por orden (lo que no se acaba, primero; las botellas, para cuando no hay otra cosa o se está fuera):

1. **Fregadero** con agua corriente (también uno nuevo en la cocina de la base, §4).
2. **Barreño**, **barril de lluvia** o **cisterna** con al menos 1 litro (el más cercano).
3. **Botellas del almacén** (1 litro cada una).
4. Fuera de la base (o sin nada de lo anterior), **una botella de lo que lleva** encima o en sus
   bolsas.

Si la fuente se queda sin agua mientras va, lo deja y busca otra.

## 3. Barril de lluvia (nuevo)

- Mueble que se construye (**Construir → Barril de lluvia**): 6 tablas y una hora de trabajo, sobre
  suelo libre.
- Guarda hasta **60 litros**. Al aire libre, cada hora de lluvia suma 4 (el barreño, 2; la cisterna,
  5).
- **Llenar** (Transportar, como el barreño desde H5b): los barriles y los barreños se llenan con
  cubos desde un fregadero con agua corriente o una cisterna, o vaciando las botellas del almacén
  (salvo las 4 últimas, que se guardan para beber y para los viajes).
- En el mapa, con su nivel de agua y los litros al pasar el ratón, como el barreño.

## 4. Un fregadero en la base

La base es una casa: tiene su fregadero (junto a una pared libre, sin camas ni almacén). Da agua hasta
que se corta, como los demás. Sin él, al empezar había que salir a beber a otra casa.

## 5. De viaje

- Quien viaja bebe de sus botellas; si no le quedan, de las del compañero que más lleve (como la
  comida, H5c3).
- Si el hexágono en que están tiene agua al lado (un río o un lago), beben allí sin gastar botellas.
- El panel de Expediciones propone botellas como propone latas: lo que hace falta por persona para
  los días de viaje (una por persona y medio día de camino, por lo menos una).

## 6. Dar de beber

Sanar ya lleva comida a un derribado con hambre (H6c): ahora, también una botella al derribado con
sed, en la base y sin zombis cerca.

## 7. Pantalla

- **Tarjeta y ficha:** la barra de Sed, entre Hambre y Sueño.
- **Barra de arriba:** 💧 con los litros de la base (barreños, barriles y botellas del almacén); al
  pasar el ratón, el desglose y si aún hay agua corriente.
- **Construir:** el barril de lluvia. **Registro:** «Ana ha muerto de sed».
- **Aviso** (amarillo, sin pausa) cuando en la base quedan menos de 2 litros por persona y no hay agua
  corriente: «Queda poca agua».

## 8. Guardar

`SAVE_VERSION` 3: las de la versión 2 (y la 1) se siguen cargando, con la sed a 100 y el fregadero de
la base.

## 9. Pruebas

- **Unitarias:** la sed baja y la fiebre la sube, beber de cada fuente en su orden, dejarlo si se
  seca, ánimo, sangre y muerte de sed, el barril (construir, lluvia, llenarlo), las botellas que se
  guardan, de viaje (botellas, compañero, río), dar de beber, el aviso, cargar una partida de la
  versión 2.
- **Invariantes:** sed dentro de 0–100; agua del barril entre 0 y 60.
- **Partida larga:** con sed nadie se queda bloqueado; se bebe de todas las fuentes y alguien llena
  un barril o un barreño.
