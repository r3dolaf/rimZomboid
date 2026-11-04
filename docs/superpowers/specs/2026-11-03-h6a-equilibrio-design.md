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
  - Si la fiebre es de una infección de arañazo o corte y aún no está muy grave (§4: al principio,
    hasta las náuseas), la infección se cura y se le pasa la fiebre.
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

## 4. Equilibrio y cambios tras la sonda y la revisión

- **El mundo, con sus especialidades:** la sonda mostró que casi no había pueblecitos, naves ni
  gasolineras (0–4 pueblecitos por mundo). Ahora se colocan primero un pueblecito al lado de cada
  pueblo y una nave a 2 hexágonos, y 4–6 gasolineras en la carretera (`ATLAS_GAS`); el resto, al
  azar como antes.
- **Antibióticos en los sitios:** farmacia 4–6, gasolinera 1–2, casa 0–1. Al volver, son lo primero
  que se carga.
- **Sonda** (36 semillas, Equilibrado y normal, contestando con sensatez y dando antibióticos si
  hay; con expediciones, yendo a por antibióticos cuando quedan menos de 2):
  - **Sin expediciones:** cae hacia el día 19,7; 10 de 36 llegan al día 30.
  - **Con expediciones:** hacia el día 20,9; 13 de 36 llegan al día 30.
  - **No se llega al objetivo (día 25).** La mitad de las infecciones son de mordisco, que no se
    curan. Muchos antibióticos se gastan en gripes, mordiscos o tarde: de media se toman 2,9 por
    partida y curan 0,7.
  - Para mejorar más habría que tocar otra cosa (menos mordiscos, más tiempo para dar los
    antibióticos o que frenen también el mordisco): se le plantea al usuario.
- **Después, a petición del usuario (D):** los antibióticos curan hasta que la infección está muy
  grave (las últimas `GRAVE_HOURS` horas), no solo hasta las náuseas. En la sonda no cambia nada que
  se note: con expediciones, día 20,7 y 13 de 36; sin ellas, día 19,7 y 10 de 36. Lo que falta no
  es tiempo, sino tener antibióticos cuando hacen falta (y los mordiscos).
- **Cambios tras la revisión:**
  - Quien cambia de mapa con fiebre sin decidir recupera su aviso al llegar.
  - Los sitios especiales (alijo, peligroso) no anuncian la especialidad de su tipo.
  - La gasolinera dice «latas y algún antibiótico».
