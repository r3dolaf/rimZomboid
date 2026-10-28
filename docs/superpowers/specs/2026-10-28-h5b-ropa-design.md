# H5b. Ropa — diseño

Estado: aprobado en conversación, por partes. El usuario pidió implementarlo directamente ("ponte a implementar directamente"). Al diseñar, la Vestimenta de la hoja de ruta se partió en dos: **H5b Ropa** (esto) y **H5b2 Mochilas** (bolsas en la espalda y la cintura con sus cosas dentro, que caen con todo; se apoyará en los objetos de §1).

## Objetivo

Que vestir bien a los colonos importe y que la tela, el hilo y la aguja tengan un uso de verdad:

- ropa por capas y zonas del cuerpo, como en Project Zomboid, que puede parar los golpes de los zombis y se agujerea;
- coser parches y refuerzos, y descoser lo destrozado;
- atuendos como en RimWorld: cada colono se pone lo mejor que permita su atuendo;
- la ropa cambia el ánimo, con preferencias por colono y rasgos de estilo;
- agua (cubos, botellas, fregaderos, cisternas y lluvia) para lavar la ropa en un barreño;
- zombis y cuerpos vestidos.

## 1. Objetos: montones y piezas

- Todo lo que guarda objetos (el almacén, lo que lleva encima cada persona, los muebles, los cuerpos y los montones del suelo) guarda **montones** de lo que es todo igual (latas, telas, vendas…, como hasta ahora) y **piezas sueltas** de lo que tiene estado (de momento, las prendas; en H5b2, las mochilas).
- `Inventory` sigue contando los montones por tipo y suma `pieces: Piece[]`. Cada pieza tiene su `id` (de `World.nextPieceId`) y está en un solo sitio: en un inventario o puesta (`Survivor.worn`, `Zombie.worn`).
- Todo lo que mueve cosas mueve también las piezas: saquear, descargar, recoger y dejar montones, registrar cuerpos, fabricar, irse, morir y el panel del Almacén.
- **Peso:** lo puesto no cuenta para la carga; una pieza en el inventario, sí (su peso, §2).
- Este bloque no cambia nada por fuera: al terminarlo pasan todos los tests, el navegador y la partida larga.

## 2. Prendas

- **Zonas:** las seis partes del cuerpo (cabeza, torso, cada brazo, cada pierna).
- **Capas:** torso y brazos, interior / media / exterior; piernas, interior / exterior; cabeza, una. Dos prendas chocan si son de la misma capa y cubren alguna zona en común; no se llevan a la vez.
- `Garment { id; kind; holes: BodyPart[]; patches: Partial<Record<BodyPart, Material>>; pads: Partial<Record<BodyPart, Material>>; dirtHours: number; bloody: boolean; from: 'colonist' | 'zombie' | null }`. `Material` es `'cloth' | 'denim' | 'leather'`.
- **Catálogo** (protección contra arañazos y cortes / contra mordiscos, peso):

| Prenda                  | Cubre          | Capa     | Arañazo | Mordisco | Peso   | Al descoser          |
| ----------------------- | -------------- | -------- | ------- | -------- | ------ | -------------------- |
| Camiseta                | torso          | interior | 10 %    | 0 %      | 0,2 kg | 1 tela               |
| Camiseta de manga larga | torso y brazos | interior | 10 %    | 0 %      | 0,3 kg | 1 tela               |
| Camisa                  | torso y brazos | media    | 15 %    | 5 %      | 0,3 kg | 2 telas              |
| Sudadera                | torso y brazos | media    | 25 %    | 10 %     | 0,6 kg | 2 telas              |
| Jersey de lana          | torso y brazos | media    | 30 %    | 10 %     | 0,7 kg | 2 telas              |
| Chaqueta vaquera        | torso y brazos | exterior | 45 %    | 25 %     | 1,2 kg | 3 retales de vaquero |
| Chaqueta de cuero       | torso y brazos | exterior | 60 %    | 35 %     | 1,5 kg | 3 tiras de cuero     |
| Abrigo                  | torso y brazos | exterior | 40 %    | 20 %     | 1,5 kg | 3 telas              |
| Chaleco policial        | torso          | exterior | 70 %    | 50 %     | 2,5 kg | 2 telas              |
| Chándal                 | piernas        | interior | 15 %    | 5 %      | 0,5 kg | 2 telas              |
| Vaqueros                | piernas        | interior | 35 %    | 15 %     | 0,8 kg | 2 retales de vaquero |
| Pantalón de trabajo     | piernas        | interior | 40 %    | 20 %     | 0,9 kg | 2 telas              |
| Perneras de cuero       | piernas        | exterior | 55 %    | 35 %     | 1,5 kg | 2 tiras de cuero     |
| Gorra                   | cabeza         | —        | 10 %    | 0 %      | 0,1 kg | 1 tela               |
| Gorro de lana           | cabeza         | —        | 15 %    | 5 %      | 0,2 kg | 1 tela               |
| Casco de moto           | cabeza         | —        | 60 %    | 50 %     | 1,5 kg | —                    |

- **Dónde salen:** los colonos empiezan con camiseta y pantalón (vaqueros o chándal) y, la mitad, con algo más (sudadera, camisa o gorra); en los armarios de las casas; mucho en la tienda de ropa; chalecos y cascos en la comisaría; ropa de trabajo (pantalón de trabajo, perneras, abrigo) en la ferretería, la nave y la granja. Lo del botín sale limpio y sin agujeros.

## 3. Golpes, agujeros, parches y refuerzos

- Cuando un zombi acierta en una zona, después de decidir el tipo de herida (H5 §2.3), se miran **de fuera a dentro** las prendas que la cubren. Cada una sin agujero ahí la puede parar con su protección (la de arañazos para arañazos y cortes; la de mordiscos para mordiscos), con lo que dé su parche o su refuerzo. Si la para: **no hay herida**, y la prenda queda **agujereada en esa zona** (y pierde el parche que tuviera ahí) con un 25 % (arañazo o corte) o un 50 % (mordisco). Si ninguna la para, hay herida como en H5, y las prendas de esa zona se **manchan de sangre**.
- **Protección de una prenda en una zona:** con agujero, 0; con parche, la de la prenda × la del material (tela ×0,5, vaquero ×0,75, cuero ×1); con refuerzo, más +10 / +15 / +25 % contra arañazos (tela / vaquero / cuero) y la mitad contra mordiscos. Nunca más del 95 %.
- **Destrozada:** con agujeros en todas las zonas que cubre.
- **Coser** (pedidos de Fabricar en la mesa, con aguja; Fabricar da la rapidez y la probabilidad de fallar, como en H4c, y al fallar se pierde lo que se iba a gastar):
  - **Remendar** (1 hilo + 1 material): tapa un agujero de una prenda del almacén. Usa el mejor material que haya (cuero, vaquero, tela).
  - **Reforzar** (1 hilo + 1 material): cose un refuerzo en una zona sin agujero ni refuerzo de una prenda del almacén.
  - **Descoser ropa** (con cuchillo): una prenda destrozada del almacén se convierte en lo que diga el catálogo.
  - Estos pedidos, que trabajan sobre prendas, tienen el modo "N veces" y el modo nuevo **"Siempre que haya"**.
- **Objetos nuevos (montones):** retal de vaquero y tira de cuero.

## 4. Atuendos

- `Outfit { id; name; allowed: GarmentKind[]; dead: boolean }`: las prendas permitidas y si acepta ropa de muertos (de colonos o de zombis). En `World.outfits`; cada colono tiene `outfitId`.
- **De serie:** Cualquiera (todo, acepta ropa de muertos), Saqueo (chaquetas vaquera y de cuero, chaleco, vaqueros, pantalón de trabajo, perneras, casco y gorro de lana, y lo interior), Base (sin casco, chaleco ni perneras). Se pueden crear, renombrar y borrar (siempre queda uno; al borrar, sus colonos pasan al primero).
- **Vestirse** (capa de trabajo, como cambiar de arma; también en modo combate, no): si en el almacén hay una prenda permitida **claramente mejor** que la que lleva en ese hueco (o el hueco está vacío), va a ponérsela y deja allí las que choquen con ella; si lleva una que su atuendo ya no permite, va a quitársela. Ponerse o quitarse una prenda tarda 5 minutos.
- **Lo que vale una prenda para alguien:** su protección en cada zona por lo que pesan las zonas al recibir golpes (H5 §2.2), más lo de su ánimo (§5): favorita, odiada, sucia, con sangre, de un muerto, según su rasgo. "Claramente mejor": un 20 % más.

## 5. Ánimo y preferencias

| Motivo                                                                               | Ánimo |
| ------------------------------------------------------------------------------------ | ----- |
| Medio desnudo (nada en el torso o en las piernas)                                    | −5    |
| Desnudo (nada en ninguno de los dos)                                                 | −10   |
| Ropa rota (algún agujero sin remendar en lo que lleva)                               | −3    |
| Ropa sucia                                                                           | −2    |
| Ropa con sangre                                                                      | −4    |
| Ropa de un muerto (de un colono)                                                     | −3    |
| Ropa de un zombi                                                                     | −5    |
| Bien vestido (torso y piernas cubiertos; nada roto, sucio, con sangre ni de muertos) | +3    |
| Lleva su prenda favorita                                                             | +4    |
| Lleva su prenda odiada                                                               | −4    |

- **Suciedad:** cada prenda puesta suma horas; **sucia** a las 72 h. **Sangre:** al recibir una herida en una zona que cubre. La de los zombis viene sucia y con sangre. Lavar lo quita (§6). Ser de un muerto no se quita.
- **Preferencias:** cada persona (también los desconocidos) tiene al azar una prenda favorita y una odiada, distintas (`Survivor.likes`, `Survivor.hates`).
- **Rasgos de estilo** (nuevos, se sortean como los demás): **Presumido** (`vain`: el ánimo de la ropa le cuenta el doble, bueno y malo), **Desaliñado** (`slob`: la ropa no le afecta salvo ir desnudo; contrario de Presumido), **Práctico** (`practical`: no le afecta lo roto, sucio, con sangre ni de muertos; desnudo sí; al elegir prenda, la protección le pesa el doble).

## 6. Agua y barreño

- **Objetos nuevos (montones):** cubo vacío (1 kg), cubo de agua (4 litros, 5 kg), botella de agua (1 litro, 1 kg). Botellas en el supermercado, la gasolinera y las casas; cubos vacíos en la ferretería, la granja y la nave.
- **Fregaderos** (mueble `sink`) en las casas, el supermercado, la gasolinera y la granja: dan agua mientras haya **agua corriente**. Se **corta** un día al azar entre el 7 y el 14 (`World.waterCutAt`), con aviso "Se ha cortado el agua".
- **Cisternas** (mueble `cistern`) en la granja, la gasolinera y la nave: 200 litros como mucho, empiezan llenas, se gastan y la lluvia las rellena.
- **Lluvia:** suceso nuevo del narrador, **Llueve** (3–6 h, cada 2 días como poco; bueno); la tormenta también llueve. `World.rainUntil`. Mientras llueve, cada hora: cada cubo vacío de un montón al aire libre (fuera de todo edificio) se llena; las cisternas suben 5 litros; el barreño, si está al aire libre, 2.
- **Barreño** (mueble nuevo, `tub`, 4 tablas): guarda hasta 20 litros.
- **Llenarlo** (trabajo Transportar): si al barreño le caben 4 litros o más y hay cubo vacío y fuente de agua (fregadero con agua corriente, cisterna con 4 litros, cubo de agua en el almacén), un colono lleva el cubo, lo llena y lo vacía en el barreño (y el cubo vuelve al almacén). Las botellas de agua del almacén también se vacían en él.
- **Lavar ropa** (pedido de Fabricar, en el barreño): 2 litros y un cuarto de hora por prenda; quita la suciedad y la sangre a una prenda sucia o con sangre del almacén. Sin agua, espera.

## 7. Cuerpos, zombis y desconocidos

- Los **zombis van vestidos** (2–4 prendas: camiseta o camisa, pantalón y a veces chaqueta o gorra), sucias, con sangre y con 0–2 agujeros cada una; las sortea el azar de los zombis.
- Su **cuerpo** guarda esa ropa (`from: 'zombie'`); al registrarlo se coge si cabe. La tela de los cuerpos de H4d desaparece (ahora sale de descoser su ropa).
- El **cuerpo de un colono** guarda la ropa que llevaba (`from: 'colonist'`); si se levanta como zombi, la sigue llevando.
- **El que echan** se va con la ropa puesta (deja en el almacén lo que lleva encima) y vuelve con ella.
- Los **desconocidos** llegan vestidos.

## 8. Pantalla

- **Ficha, pestaña Ropa:** cada zona con sus capas (prenda y estado: agujeros, parches, refuerzos, sucia, con sangre, de un muerto), la protección de cada zona, su atuendo (para cambiarlo) y su prenda favorita y odiada.
- **Panel Atuendos** (botón arriba): los atuendos, con casillas por prenda agrupadas por zona y "Acepta ropa de muertos"; crear, renombrar y borrar.
- **Panel de Almacén:** Materiales (como ahora) y Ropa (cada prenda con su estado).
- **Panel de Trabajos:** columna Atuendo.
- **Fabricar:** los pedidos nuevos (Remendar, Reforzar, Descoser ropa, Lavar ropa) con su modo "Siempre que haya".
- **Mapa:** el barreño (y su agua al pasar el ratón), los fregaderos y las cisternas.
- **Registro:** "A Ana se le ha roto la chaqueta por el brazo izquierdo" (Combate); remendar, reforzar, descoser y lavar (Trabajo); "Llueve" y "Se ha cortado el agua" (Colonia). **Aviso** "Se ha cortado el agua" (amarillo, sin pausa).

## 9. Pruebas y equilibrio

- **Unitarias:** cada regla (capas, parar golpes, agujeros, parches, refuerzos, descoser, atuendos y vestirse, ánimo y preferencias, agua, lluvia, corte del agua, llenar el barreño, lavar, cuerpos y zombis vestidos).
- **Invariantes:** cada pieza en un solo sitio (sin perderse ni duplicarse), ids únicos, agujeros solo en zonas que cubre, ninguna pareja de prendas que choque puesta a la vez; agua entre 0 y lo que cabe.
- **Navegador:** pestaña Ropa, panel Atuendos, Almacén con ropa, barreño.
- **Equilibrio:** con la ropa del principio la colonia aguanta como en H5 (1–2 semanas saqueando todo sin defenderse); con buena ropa y cosiendo, bastante más. Se mide con la partida larga y se ajusta.
- **Rendimiento:** por debajo de 1 ms por tick de media.
