# H4f Pueblo — diseño

Estado: aprobado en conversación por secciones. El usuario lo pidió al diseñar H4d: un mapa más grande con más tipos de edificio, no solo casas, cada uno con su botín. Al diseñarlo propuso un mapa global como el de RimWorld; se decidió hacerlo en dos pasos: este hito (pueblo, edificios y botín, con un generador por zonas pensado para reutilizarse) y, después de H5b, **H5c Mundo y expediciones** (mapa global, viajes y mapas que se generan al llegar).

## 1. Objetivo

- Más que explorar: un pueblo con calles y edificios de nueve tipos, y cosas sueltas por el campo.
- Cada tipo de edificio tiene su botín: el jugador decide a dónde ir según lo que le falta (comida al supermercado, vendas a la farmacia, armas a la comisaría…).
- El pueblo es donde más se gana y más se arriesga: más zombis, y algunos encerrados en los edificios grandes.
- El generador se hace por zonas (carretera, pueblo, campo) y por recetas de edificio, para que H5c genere cada casilla del mapa global con las mismas piezas.

## 2. El mapa

- **Tamaño:** 150×150 (`MAP_SIZE`; un solo número para poder ampliarlo).
- **Carretera principal:** 3 casillas de ancho, cruza el mapa de lado a lado, horizontal o vertical al azar, a una altura al azar (lejos de los bordes).
- **Caminos:** 1–2 de 2 casillas que salen de la carretera principal hacia el campo (hasta el borde o hasta un edificio suelto).
- **El pueblo:** una zona de unas 60×60 casillas atravesada por la carretera principal, en un tramo al azar (sin tocar los bordes).
  - Calles de 2 casillas en cuadrícula que forman 9–12 manzanas de 14–18 casillas de lado.
  - Cada manzana se parte en 1–4 parcelas; en cada parcela, un edificio con la puerta hacia una calle (o la carretera). Alguna parcela queda vacía (hierba, algún árbol).
  - Hay uno de cada: **supermercado, farmacia, ferretería, comisaría y tienda de ropa**. El resto, casas.
- **Fuera del pueblo**, junto a la carretera o a un camino: una **gasolinera** (en la carretera principal), una **nave**, dos **granjas** y 3–5 **casas sueltas**.
- **Árboles:** pocos junto a las carreteras y en el pueblo (solo en parcelas vacías), más cuanto más lejos de todo (bosque): del 2 % al 8 % de las casillas de hierba.
- **La base** es la de ahora (12×10, camas al fondo, almacén junto a la puerta), girada para que la puerta mire a la calle o carretera más cercana. Se sortea dónde:
  - en las **afueras** del pueblo (40 %): a 4–20 casillas del borde del pueblo;
  - en el **campo** (40 %): a más de 30 casillas del pueblo, junto a la carretera o un camino;
  - **dentro del pueblo** (20 %): en una parcela, en lugar de una casa.
- Desde la base se llega andando a todos los edificios. Si un mapa no cumple, se genera otro (como ahora).
- En total, unos 30 edificios (hoy, 6–10).
- `World.town`: el rectángulo del pueblo (para los zombis y para H5c).

## 3. Los edificios

- Cada edificio tiene **un tipo** (`BuildingKind`), **una sola puerta** y ventanas. Puertas atrancadas, ventanas, cortinas, tapiar y romper funcionan igual que en H4d.
- **Muebles de saqueo nuevos** (`ContainerKind`): **mostrador** (`counter`), **taquilla** (`locker`), **caja** (`crate`) y **botiquín** (`medicine`), además de nevera, armario y estantería.
- Cada mueble se puede alcanzar desde la puerta (hay una casilla libre al lado).

| Edificio (id)                | Tamaño        | Por dentro                                                                                                    | Muebles                          | Ventanas                                    | Atrancada |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------- | --------- |
| Casa (`house`)               | 8–12 × 7–10   | Como ahora (un tabique)                                                                                       | 2–5: nevera, armario, estantería | 1–2 por muro                                | 25 %      |
| Supermercado (`supermarket`) | 14–18 × 12–16 | Escaparate; filas de estanterías con pasillos de 2; neveras en el muro del fondo; mostrador junto a la puerta | 12–20                            | delante, una sí y otra no; 0–1 en los demás | 40 %      |
| Farmacia (`pharmacy`)        | 8–10 × 7–9    | Una sala; botiquines en las paredes y un mostrador                                                            | 3–6                              | 1–2 por muro                                | 40 %      |
| Ferretería (`hardware`)      | 10–14 × 8–12  | Una sala con estanterías y cajas                                                                              | 5–8                              | 1 por muro                                  | 40 %      |
| Comisaría (`police`)         | 12–16 × 10–14 | Tres salas (dos tabiques); taquillas, cajas y alguna estantería                                               | 5–8                              | 1 por muro                                  | 50 %      |
| Tienda de ropa (`clothes`)   | 10–12 × 8–10  | Filas de armarios (percheros) y un mostrador                                                                  | 5–8                              | delante, 2–3; 1 en los demás                | 40 %      |
| Gasolinera (`gas`)           | tienda de 8×6 | Mostrador, estanterías y una nevera; delante, una explanada de asfalto con surtidores de adorno               | 3–5                              | delante, 2                                  | 25 %      |
| Granja (`farm`)              | 14–18 × 10–14 | Dos partes con un tabique: vivienda (nevera, armario, estantería) y granero (cajas)                           | 5–8                              | 1–2 por muro                                | 15 %      |
| Nave (`warehouse`)           | 16–22 × 12–16 | Diáfana, con filas de cajas                                                                                   | 10–16                            | 0–1 por muro                                | 50 %      |

- La base nunca está atrancada (como ahora).
- Las cifras van en `balance.ts` (`BUILDINGS`); los nombres, en `es.ts`.

## 4. El botín

- Depende **solo del tipo de edificio** (ya no de la distancia a la base). Cada edificio sortea lo suyo, con su azar.
- Dentro del edificio, cada cosa va a su mueble; si no tiene ese mueble, a una estantería o un mostrador, y si tampoco, a cualquiera:

| Mueble                 | Qué guarda                             |
| ---------------------- | -------------------------------------- |
| Nevera                 | Comida                                 |
| Botiquín               | Vendas                                 |
| Armario                | Tela, hilo y agujas                    |
| Taquilla               | Armas                                  |
| Caja                   | Madera y herramientas (hacha, palanca) |
| Estantería y mostrador | Un poco de todo                        |

**Por edificio** (los rangos se sortean; "a veces" es la probabilidad por edificio):

| Edificio       | Comida | Vendas | Madera | Tela  | Hilo (carretes) | Agujas | Armas                                       |
| -------------- | ------ | ------ | ------ | ----- | --------------- | ------ | ------------------------------------------- |
| Casa           | 2–5    | 0–1    | 0–2    | 0–2   | 20 %: 1         | 5 %: 1 | Cuchillo 25 %, bate 15 %                    |
| Supermercado   | 40–60  | 1–3    | —      | —     | —               | —      | 1 cuchillo                                  |
| Farmacia       | 0–4    | 12–18  | —      | —     | —               | 1      | —                                           |
| Ferretería     | —      | 0–2    | 16–24  | —     | 2               | 1      | 2 hachas, 2 palancas, 1 machete, 1 cuchillo |
| Comisaría      | 2–6    | 2–4    | —      | —     | —               | —      | 2 bates, 1 palanca, 1 machete               |
| Tienda de ropa | —      | —      | —      | 20–30 | 6               | 3      | —                                           |
| Gasolinera     | 8–16   | 0–2    | —      | —     | —               | —      | 1 bate                                      |
| Granja         | 8–16   | 0–2    | 6–10   | 1–3   | —               | —      | 1 hacha, 1 machete                          |
| Nave           | 2–6    | 0–2    | 20–30  | 5–10  | —               | —      | 1 palanca, 1 hacha                          |

- **En total** (de media, con unas 19 casas): unas **160 latas** (el doble que hoy: unos 50 días para 3 colonos), unas **34 vendas**, **80 tablas**, unas **56 telas**, **12 carretes** (120 usos de hilo), **6 agujas** y unas **25 armas** (la mayoría en la ferretería, la comisaría y las granjas; el resto, cuchillos y bates sueltos por las casas).
- Los cuerpos de zombi dan lo mismo que en H4d.
- Desaparecen `LOOT_*_TOTAL`, `*_CHANCE` por mueble y el peso por distancia; los sustituye la tabla por tipo.

## 5. Los zombis

| Narrador    | Al empezar (hoy) | Máximo a la vez (hoy) |
| ----------- | ---------------- | --------------------- |
| Tranquilo   | 25 (15)          | 50 (30)               |
| Equilibrado | 40 (25)          | 80 (50)               |
| Caótico     | 50 (30)          | 100 (60)              |

- La opción Zombis de la portada multiplica como ahora (×0,5, ×1, ×1,25).
- **Al empezar:** 7 de cada 10 en el pueblo (calles y junto a los edificios); el resto, en el campo, junto a la gasolinera, las granjas, la nave y las casas sueltas. Ninguno a menos de 12 casillas de la base.
- **Encerrados** (de los del principio): supermercado 3–5, comisaría 2–4, nave 2–4, granja 0–2 y una de cada diez casas, 1.
  - Empiezan dentro, en el suelo del edificio, y vagan por dentro (su región no tiene salida).
  - Si ven u oyen a un colono, actúan como cualquier zombi: van hacia él y rompen ventana o puerta si hace falta.
  - Al abrir la puerta (o forzarla, o romper una ventana) pueden salir.
- **Los que llegan por los bordes** van sobre todo al pueblo (a una casilla al azar del pueblo; si no hay pueblo, a un edificio al azar, como ahora).
- Lo demás de H4b no cambia (vista, ruido, grupos, romper, perseguir).

## 6. Pantalla

- **Suelo según el tipo:** baldosa clara en las tiendas (supermercado, farmacia, ferretería, ropa, gasolinera), cemento en la comisaría y la nave, tablas en la granja. Las casas y la base, como ahora.
- **Gasolinera:** la explanada es asfalto (casillas de carretera) con surtidores dibujados encima (no estorban).
- **Letrero:** el nombre del edificio ("Supermercado", "Farmacia", "Casa 4"…) encima de la puerta, en cuanto la puerta se ha visto.
- **Muebles nuevos** con su forma y color: mostrador, taquilla, caja y botiquín.
- **Ficha del edificio:** se titula con su nombre y dice lo mismo que ahora (marcado, atrancado, registrados, vacíos).
- **Registro:** con el nombre del edificio: "Ana ha encontrado 6 latas en el supermercado", "Ana no encuentra nada en la casa 4", "Se ha vaciado la farmacia", "Ana ha forzado la puerta de la comisaría".
- **Saquear:** un clic en un edificio marca o desmarca todos sus muebles (como con las casas).
- La cámara empieza en la base, esté donde esté.

## 7. Datos e invariantes

- `Building.kind: BuildingKind` (`house`, `supermarket`, `pharmacy`, `hardware`, `police`, `clothes`, `gas`, `farm`, `warehouse`, y `base` para la base).
- `World.houses` sigue llamándose así pero tiene edificios de todos los tipos (salvo la base); `Container.houseId` es el edificio. No se renombran para no tocar medio juego por un nombre.
- `World.town: Rect`.
- `ContainerKind` con `counter`, `locker`, `crate` y `medicine`.
- **Generador** en piezas: carreteras, pueblo (manzanas y parcelas), campo, colocar la base, y una receta por tipo de edificio (tamaño, interior, muebles, ventanas). Determinista con la semilla, como siempre.
- Las semillas de antes dan mapas distintos (cambia todo el mapa; el test de oro se actualiza).
- **Invariantes:** cada edificio tiene un tipo válido; los edificios no se solapan entre sí ni con la base; todo mueble de saqueo está dentro de su edificio y tiene una casilla al lado que se pisa.

## 8. Rendimiento

- El mapa pasa de 10.000 a 22.500 casillas y puede haber hasta 100 zombis.
- Objetivo: cada tick, por debajo de 1 ms de media en las partidas largas (como ahora), y fluido a ×3 en el navegador. Si no se cumple, se bajan los zombis o se optimiza lo que más cueste.

## 9. Pruebas

- **Generación** (30 semillas): todo alcanzable desde la base; uno de cada tienda en el pueblo; gasolinera, nave, dos granjas y 3–5 casas sueltas fuera; nada se solapa; cada mueble alcanzable desde la puerta; la base en afueras, campo o pueblo con la frecuencia esperada; puertas atrancadas según el tipo.
- **Botín:** cada tipo dentro de sus rangos; cada cosa en su mueble; totales del mapa cerca de los de §4.
- **Zombis:** 7 de cada 10 en el pueblo, ninguno a menos de 12 de la base, los encerrados dentro de su edificio, y los que llegan van al pueblo.
- **Pantalla:** nombre en la ficha y en el registro, letreros, muebles nuevos.
- **Partidas largas de 30 días** con todo; **e2e**: empezar, ver un edificio con su letrero y marcarlo.
- **Equilibrio:** comida, armas y vendas a los 7 y 30 días, tiempo en el suelo y ms por tick; se apunta en la hoja de ruta.

## 10. Fuera de este hito

- **H5c Mundo y expediciones** (después de H5b): mapa global, viajes de un grupo, mapas que se generan al llegar (con las zonas y recetas de este hito) y vuelta con el botín.
- Varias puertas por edificio, pisos, sótanos y coches.
- Objetos nuevos propios de cada edificio (medicinas en H5; ropa y mochilas en H5b).
