# B1 — Amputación

Fecha: 2026-11-08
Estado: aprobado (el usuario pidió seguir con el siguiente bloque y que se tomen las decisiones sin
preguntar)

## 0. Para qué

Lo que más mata es la infección, y la del mordisco no tiene cura: un mordisco es una tirada de dados
con la muerte segura a los 2–3 días. Con la amputación, un mordisco en un brazo o una pierna es una
**decisión dura**: cortar a tiempo, con lo que haga falta y el riesgo de desangrarse, a cambio de una
secuela para siempre. Da historias que se recuerdan (la que sigue saqueando con un solo brazo) y
quita la sensación de que la muerte llega sin que el jugador pueda hacer nada.

## 1. Cuándo se puede

- Cuando un colono recibe un **mordisco en un brazo o una pierna** (en un mapa, no de viaje), sale
  una decisión (roja, pausa): «A Ana la ha mordido un zombi en el brazo izquierdo. ¿Amputar?».
  - **Amputar** (necesita una herramienta de cortar —cuchillo, machete, hacha o hachuela— y 2 vendas,
    de cualquiera del mapa o del almacén; si falta algo, el botón dice qué y no se puede).
  - **No** (lo que pasa si nadie contesta). La decisión caduca a las **8 horas** del mordisco:
    después ya es tarde.
- En la cabeza o el torso no hay nada que hacer.

## 2. Qué pasa al amputar

- Se gastan las 2 vendas. Sale bien con un 60 % y un 4 % más por cada nivel de Sanar del mejor
  sanador del mapa (con Sanar 10, siempre).
- El colono **pierde el brazo o la pierna para siempre** (`Survivor.missing`): sus heridas de esa
  parte desaparecen y la parte queda a 0 (con un brazo, trabaja y pelea a la mitad; con una pierna,
  anda a la mitad; sin las dos piernas no anda). Los golpes ya no le dan ahí.
- Queda **derribado 6 horas** y pierde sangre: 25 si sale bien, 45 si sale mal (puede morir).
- **La infección se cura** si venía de ese mordisco (si estaba infectado de antes por otra herida, la
  infección sigue: el jugador no lo sabe, como siempre).
- Ánimo: «Perdió un brazo» / «Perdió una pierna» (−20, 10 días); los demás del mapa, «Una amputación»
  (−4, 1 día).
- Registro: «Han amputado el brazo izquierdo de Ana» (y «… ha perdido mucha sangre», si sale mal).

## 3. Pantalla

- La decisión, con lo que hace falta en el botón.
- Ficha, pestaña Salud: la parte, «amputada». Tarjeta: el icono de brazo o pierna inutilizados.

## 4. Guardar

Los campos nuevos son opcionales (`missing`, la parte de la infección y la de la decisión): las
partidas de antes se cargan igual.

## 5. Pruebas

- **Unitarias:** cuándo sale la decisión (brazo o pierna sí; cabeza no; de viaje no), qué hace falta,
  amputar (vendas, parte perdida, heridas, derribado, sangre, infección curada o no, ánimo), que
  caduque, los golpes ya no van a la parte perdida, andar y trabajar sin ella.
- **Invariantes:** las partes perdidas, sin heridas.
- **Partida larga:** contestando «Amputar» cuando se puede, nada se rompe.
