# H6a — Equilibrio: antibióticos y sitios con especialidad (diseño)

## Objetivo

Que la colonia aguante algo más (hacia el día 25, jugando con cabeza) y que buena parte de la mejora
venga de salir de expedición. Lo que más mata es la infección de los arañazos: los antibióticos la
curan si se dan a tiempo, y se encuentran sobre todo fuera, en los sitios del mundo, cada uno con su
especialidad.

Lo aprobado por el usuario:

- Objetivo: aguantar algo más y que la mejora venga de las expediciones (C).
- Antibióticos que curan la infección de arañazos y cortes, no la de mordisco (A).
- Cada tipo de sitio con su especialidad; los antibióticos, en la farmacia del pueblecito (A).
- Se dan con una opción nueva en la decisión de la fiebre; de viaje, solos si se llevan (B).
- Después vendrán guardar y cargar la partida (H6b) y el resto de H6.

## 1. Los antibióticos

- **Objeto nuevo:** `antibiotics` («antibiótico», «antibióticos»), ligero, en el botiquín de las
  casas y en las farmacias, como los analgésicos.
- **La infección recuerda si fue de un mordisco** (`infection.bite`). Si alguien con una infección
  de arañazo recibe después un mordisco, pasa a ser de mordisco.
- **Decisión de la fiebre:** opción nueva, la 3, «Antibióticos y que descanse (quedan N)».
  - Se puede elegir si hay alguno en el almacén de ese mapa o lo lleva el enfermo. Si no hay, el
    botón sale apagado.
  - Gasta uno (primero el que lleve encima) y manda descansar, como «Que descanse».
  - Si la fiebre es de una infección de arañazo o corte y aún no han pasado
    `INFECTION_NAUSEA_HOURS` (24 h) desde la herida, la infección se cura y se le pasa la fiebre.
  - Si es de mordisco, llega tarde o es gripe, no hace nada más.
  - Registro: «Ana toma antibióticos» y, si cura, «A Ana se le pasa la infección».
- **De viaje:** quien lleve antibióticos y tenga una infección que ya daría fiebre
  (`INFECTION_FEVER_HOURS`) toma uno solo, con las mismas reglas.

## 2. Dónde se encuentran

- **En el pueblo de la base, casi nada:** en la farmacia, uno a veces; en el botiquín de una casa,
  muy de vez en cuando.
- **En los sitios, botín de más según el edificio** (`SITE_LOOT`, que se suma a `LOOT`):
  - **pueblecito:** siempre tiene farmacia, con antibióticos y vendas;
  - **nave:** armas y herramientas;
  - **gasolinera:** latas y, a veces, antibióticos;
  - **granja:** más comida;
  - **casa:** un poco de todo; a veces, un antibiótico.
- **En pantalla:** la ficha del sitio en el mapa del mundo y la lista de Expediciones dicen qué suele
  haber («farmacia: antibióticos y vendas», «armas y herramientas», «mucha comida»…).

## 3. Pruebas y equilibrio

- **Tests:**
  - antibióticos a tiempo, tarde, con mordisco y con gripe;
  - la opción en la decisión (y apagada si no hay);
  - de viaje;
  - el botín de los sitios y del pueblo;
  - los textos.
- **Partida larga** de 30 días con todo.
- **Sonda** de 36 semillas, Equilibrado y normal, contestando con sensatez (antibióticos si hay).
  Las expediciones se usan con cabeza: si faltan antibióticos y se conoce un pueblecito, van allí.
  - Objetivo sin expediciones: más o menos como ahora (día 20–21).
  - Objetivo con expediciones: hacia el día 25.
  - Si no se llega, se ajustan las cantidades de `SITE_LOOT` y se apunta aquí (§4) y en la hoja de
    ruta.
