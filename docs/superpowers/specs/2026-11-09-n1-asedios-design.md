# N1 — Asedios con ritmo

Fecha: 2026-11-09
Estado: aprobado (el usuario eligió «Asedios» como siguiente bloque; las decisiones, sin preguntar)

## 0. Para qué

El asedio es la amenaza que obliga a defender la base (tapiar, muros, guardias), pero casi no llega:
en una sonda de 12 partidas de 25 días (Tranquilo y Equilibrado, 6 semillas) se anunciaron solo 3
(7 tras C1, por azar). La causa: el asedio es uno de unos diez sucesos malos y el narrador lo sortea
como a los demás; el Equilibrado saca unos dos malos cada cuatro días y el Tranquilo, muy pocos.

## 1. El ritmo

- El asedio **sale del sorteo** del narrador y tiene **su propio reloj**: se anuncia (con los 2–3
  días de aviso de siempre) cada cierto tiempo, según el narrador:

  | Narrador    | Primer anuncio | Después, cada |
  | ----------- | -------------- | ------------- |
  | Tranquilo   | día 10–12      | 10–14 días    |
  | Equilibrado | día 7–9        | 7–10 días     |
  | Caótico     | día 6–8        | 4–9 días      |

- El tamaño, como hasta ahora (crece cada 2 días y con la opción Zombis).
- Si al tocar hay un asedio anunciado o en marcha, se mira al día siguiente.
- **El Tranquilo no remata**: si la colonia va mal (bienestar por debajo de 40, como sus sucesos
  malos), lo aplaza un día, las veces que haga falta.
- El primer anuncio sale de la semilla con su propio azar (el resto de la partida no cambia por
  ello); los siguientes, con el azar de la partida.

## 2. Guardar

El reloj (`Narrator.nextSiegeAt`) es opcional: una partida de antes lo pone al cargarla, desde ese
momento (como si empezara: el primer anuncio, dentro del margen del primero de su narrador).

## 3. Pruebas

- **Unitarias:** el primer anuncio en su margen según el narrador; a su hora, se anuncia y se pone el
  siguiente; con uno anunciado o en marcha, se mira al día siguiente; el Tranquilo con la colonia mal
  lo aplaza; el sorteo ya no saca asedios; una partida sin reloj lo pone.
- **Sonda:** las mismas 12 partidas: cuántos asedios y hasta qué día se aguanta, antes y después.
- **Partida larga:** las tres partidas con zombis tienen asedios sin forzarlos.
