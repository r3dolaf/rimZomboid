# H5b2. Mochilas — diseño

Estado: aprobado en conversación, por partes. El usuario pidió implementarlo directamente ("e implementa directamente"). Se apoya en los objetos de H5b (montones y piezas, `docs/superpowers/specs/2026-10-28-h5b-ropa-design.md` §1).

## Objetivo

Que lo que lleva cada colono sea una decisión de juego, como en Project Zomboid:

- bolsas en la cintura, la espalda y la mano, que dejan cargar más y en las que lo de dentro pesa menos para andar;
- listas: qué guarda cada bolsa y qué lleva siempre cada persona;
- mochilas preparadas en el almacén, listas para coger y huir;
- caen con todo: al morir, todas; la de la mano, también al caer derribado o al huir;
- pelear con una bolsa en la mano cambia según el arma; la hachuela, nueva, es de una mano;
- se encuentran saqueando, en algunos zombis y desconocidos, y la de tela se cose.

## 1. Bolsas

| Bolsa                | Hueco          | Capacidad | Lo de dentro pesa | Vacía pesa |
| -------------------- | -------------- | --------- | ----------------- | ---------- |
| Riñonera             | cintura        | +2 kg     | 80 %              | 0,2 kg     |
| Bolsa de tela        | espalda o mano | +4 kg     | 80 %              | 0,3 kg     |
| Mochila escolar      | espalda        | +6 kg     | 70 %              | 0,5 kg     |
| Bolsa de deporte     | espalda o mano | +8 kg     | 70 %              | 1 kg       |
| Mochila de excursión | espalda        | +12 kg    | 60 %              | 1,5 kg     |

- Cada bolsa es una **pieza** (como las prendas): tiene su `id`, lo que lleva dentro (`items`, montones y prendas, nunca otras bolsas) y su lista (§3). Está en un solo sitio: puesta, en un inventario (el almacén, lo que se lleva en las manos, un mueble, un cuerpo, un montón) o puesta en un zombi.
- **Huecos:** cintura, espalda y mano; como mucho una bolsa en cada uno, y solo en un hueco que le valga.
- **Capacidad:** lo de dentro de una bolsa, contado en kilos reales, no pasa nunca de su capacidad. Las manos cargan lo de siempre (6 kg más lo que sube con Transportar); una bolsa que no se lleva puesta pesa entera (vacía + lo de dentro) donde esté.
- **Andar:** lo de las manos pesa entero; cada bolsa puesta, su peso vacía más lo de dentro por su porcentaje. Con eso se calcula el freno de siempre (a plena carga, ×0,6 con Transportar 0).
- Las bolsas no se rompen, no se ensucian y no cambian el ánimo.

## 2. Ponerse las bolsas

- **Atuendos:** cada atuendo dice qué bolsas acepta (una casilla por tipo) y si acepta **bolsa en la mano**. Los de partida: Cualquiera y Saqueo, todas y en la mano; Base, todas pero sin bolsa en la mano (manos libres en casa).
- **Qué elige:** en cada hueco, la bolsa de más capacidad que permita su atuendo. La bolsa de deporte y la de tela van a la espalda si allí no hay nada mejor; si no, a la mano (si su atuendo lo permite). Solo cambia una bolsa por otra de más capacidad, y se quita (en el almacén) la que su atuendo ya no permite.
- **Dónde:** en el almacén. Al cambiar descarga primero (§3), cambia la bolsa y vuelve a coger lo de su «Llevar siempre». La bolsa que se pone llega con lo que tenga dentro (las preparadas, llenas).
- **Al saquear:** si encuentra una bolsa, tiene libre un hueco que le vale y su atuendo la permite, se la pone allí mismo.
- **Fijar:** desde la ficha se fija la bolsa de un hueco, como el arma. Fijada, no se la quita ni la cambia, diga lo que diga el atuendo (sí puede caer, §5).
- En modo combate no se cambia de bolsa.

## 3. Listas, descargar y «Llevar siempre»

- **Lista de una bolsa:** qué cosas (montones) y cuántas guarda, por ejemplo 4 vendas y 3 latas. Se edita desde la ficha (las bolsas puestas) y desde el Almacén (las guardadas).
- **Reservado:** lo que una bolsa tiene de lo que pide su lista, hasta su cantidad.
- **«Llevar siempre»** de cada persona: lista con cantidades (3 vendas, 2 latas, 1 analgésico…); al empezar, **2 vendas** (la regla de H5). Cuenta lo que lleva en las manos y lo que tiene en sus bolsas sin reservar. Las dos listas se suman.
- **Al saquear:** lo que encuentra va primero a la bolsa cuya lista lo pide (hasta su cantidad); lo demás, a cualquier hueco libre, primero las bolsas y luego las manos.
- **Al registrar una bolsa que no puede ponerse ni le cabe entera** (en un mueble, un cuerpo o un montón), la vacía allí mismo: lo de dentro se coge como lo demás y la bolsa vacía, si cabe, también.
- **Al descargar en el almacén:** de cada bolsa sale todo menos lo reservado; de lo que lleva sale todo menos su «Llevar siempre» (que se guarda en una bolsa si cabe, si no en las manos). Las bolsas que lleva en las manos, y las puestas que su atuendo no permite (sin fijar), se quedan en el almacén.
- **Una bolsa que entra en el almacén** suelta en él lo que no está en su lista; lo reservado se queda dentro.
- **Rellenar:** si le falta algo de su «Llevar siempre» o de la lista de una bolsa que lleva puesta, y hay en el almacén y le cabe, va a por ello cuando no tiene nada urgente (como las vendas de H5).
- **Bolsas guardadas:** una bolsa con lista que está en el almacén se rellena sola con **Transportar**. Lo de dentro **no** cuenta como existencias: no se come, no se usa para fabricar ni sale en los números del almacén. Quien se la pone, la coge llena.
- **Usar lo de las bolsas:** quien lleva una bolsa puede usar lo de dentro como lo de las manos (comer, vendarse o vendar, analgésicos, dar de comer, armas de repuesto): primero lo de las manos, luego lo no reservado, y por último lo reservado.

## 4. Pelear con bolsa en la mano y la hachuela

| Arma                                  | Manos     | Con bolsa en la mano                                  |
| ------------------------------------- | --------- | ----------------------------------------------------- |
| Sin arma, cuchillo, machete, hachuela | una       | normal                                                |
| Palanca, bate                         | una o dos | −15 % de acierto, −25 % de daño                       |
| Hacha de talar                        | dos       | suelta la bolsa al empezar a pelear y la recoge luego |

- **Soltar la bolsa:** con el hacha de talar, al empezar a pelear deja la bolsa de la mano en el suelo (un montón) con todo dentro. Cuando no ve zombis, va a por ella (§5).
- **Hachuela:** arma de una mano, daño 30 y la rapidez de la palanca (el hacha de talar hace 40). Tala, pero tarda 1,5 veces más que el hacha. Sale donde el hacha (ferretería, granja, almacén), igual de a menudo. Para elegir arma cuenta como la palanca.
- **Elegir arma con bolsa en la mano:** se compara lo que hace cada arma por segundo con lo de la tabla (y el hacha, como si no tuviera bolsa pero un poco por debajo, por tener que soltarla). Así, con bolsa en la mano prefiere el machete o la hachuela al bate o la palanca, salvo que la diferencia sea grande.

## 5. Cuándo caen

- **Al morir:** todas sus bolsas pasan al cuerpo con lo de dentro. Si se levanta, el zombi sigue con ellas; al matarlo, se pueden registrar.
- **Derribado o huyendo:** la bolsa de la mano cae al suelo con todo dentro (las de la espalda y la cintura, no).
- **Una bolsa en el suelo** es un montón como los demás. Quien la soltó, si está bien, tiene la mano libre y no hay peligro, va primero a por ella y se la vuelve a poner. Si no, Transportar la lleva al almacén **en la mano** (aunque su atuendo no pida bolsa en la mano) y allí la deja.

## 6. De dónde salen

| Sitio                       | Bolsas por edificio | Cuáles                                           |
| --------------------------- | ------------------- | ------------------------------------------------ |
| Casa                        | 0 o 1               | riñonera, mochila escolar                        |
| Tienda de ropa              | de 2 a 4            | riñonera, mochila escolar, de deporte, excursión |
| Ferretería, granja, almacén | de 0 a 2            | mochila de excursión, bolsa de deporte           |

- Salen vacías, en sus muebles (armarios en las casas; en las tiendas, cualquiera).
- **Zombis:** 1 de cada 10 lleva una bolsa (riñonera, mochila escolar o bolsa de deporte) con 1 a 3 cosas (latas, vendas, tela, una botella de agua, un analgésico). Queda en su cuerpo.
- **Desconocidos que llegan:** 3 de cada 10 traen una riñonera o una mochila escolar.
- **Al empezar**, nadie tiene bolsa.
- **Coser:** «Bolsa de tela» en la mesa: 4 de tela y 2 de hilo, con aguja, 1 hora (Fabricar da la rapidez y el fallo, como siempre).

## 7. Pantalla

- **Ficha, pestaña «Bolsas»:** una fila por hueco (cintura, espalda, mano) con la bolsa, lo de dentro en kilos frente a lo que admite (p. ej. 3,2 / 6 kg) y «Fijar»; debajo, lo que lleva y su lista (con + y −, y un desplegable para añadir). Al final, «En las manos» con sus kilos y la lista «Llevar siempre» con el mismo editor.
- **Almacén:** sección «Bolsas»: cada bolsa guardada con lo de dentro y su lista, que se edita ahí.
- **Atuendos:** una casilla por tipo de bolsa y «Bolsa en la mano».
- **Fabricar:** la receta «Bolsa de tela».
- **Mapa:** una bolsa en el suelo se ve como un montón; al pasar el ratón, p. ej. «Mochila escolar (4 cosas)».
- **Registro:** «Ana ha encontrado una mochila de excursión», «Ana ha soltado la bolsa de deporte», «Ana ha recogido su bolsa».

## 8. Pruebas y equilibrio

- **Invariantes (cada tick en la partida larga):** cada bolsa en un solo sitio; ninguna bolsa dentro de otra; como mucho una por hueco y en un hueco que le vale; nada pasa de su capacidad; todo lo de dentro se cuenta (también prendas); listas y «Llevar siempre» con cantidades enteras positivas.
- **Tests** de cada parte: ponerse y fijar, listas y descargar, rellenar (persona y almacén), pelear con bolsa en la mano, soltar y recoger, morir con bolsas, saqueo, zombis y desconocidos con bolsa, coser y la hachuela.
- **Navegador:** la pestaña «Bolsas», editar una lista, las bolsas en el Almacén y en Atuendos.
- **Partida larga:** se cuentan bolsas encontradas, puestas, soltadas y recogidas, y se comprueba que se usan.
- **Equilibrio:** se compara con H5b cuánto aguantan las colonias: las mochilas deben ayudar sin hacerlo demasiado fácil.

## 9. Equilibrio tras la partida larga

- Con la misma sonda que en H5b (12 semillas, saqueando todo el pueblo, 30 días): en H5b la colonia caía de media hacia el día 21 y 4 de 12 llegaban al día 30; con mochilas, hacia el día 23 y también 4 de 12. Con las bolsas prohibidas en todos los atuendos, hacia el día 23 y 6 de 12. Las mochilas ayudan un poco, sin hacerlo demasiado fácil: no se tocan las cifras.
- Casi todas las muertes siguen siendo por infección de arañazos. Las bolsas de la mano se sueltan a menudo al huir (10–40 por partida) y se recogen casi todas.
- Se arregló al medir: con las bolsas prohibidas, cogían antes una bolsa (que no podían ponerse) que la comida y pasaban hambre; ahora las bolsas que no se ponen se cogen al final, como la ropa. Y sin comida en el almacén, ahora también llevan la de sus bolsas.
