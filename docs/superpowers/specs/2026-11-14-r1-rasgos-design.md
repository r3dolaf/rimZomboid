# R1 — Rasgos que cambian lo que hacen

Fecha: 2026-11-14
Estado: aprobado (el usuario eligió «rasgos que cambian lo que hacen» y pidió lanzarse sin más
preguntas: las decisiones de abajo son mías)

## 0. Para qué

Variedad entre colonos: hoy hay 18 rasgos y la mitad solo suman o restan 2 a una habilidad. Los
nuevos se notan en la partida (lo que hace, lo que siente, cómo aguanta) y tocan lo de los últimos
bloques: el huerto y la cocina (V4), las armas (D1), el frío (V3) y la infección (H6). Van en
parejas opuestas que no se dan juntas, como los de ahora; cada colono sigue sacando 1 o 2.

**No objetivos**: rasgos que se ganan o se pierden jugando (otro proyecto, después); cambiar los 18
de ahora; elegir los rasgos al empezar.

**Antiobjetivos**: un rasgo que no se nota en nada; uno que rompa la partida (que haga a alguien
inútil o imprescindible); textos que digan cifras que no son.

## 1. Los rasgos nuevos

| Rasgo             | Qué hace                                                                                                                                | Pareja (no se dan juntos) |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Nocturno**      | Duerme de día y está despierto de noche (se acuesta con el sueño por debajo de 95 de día y no se levanta hasta que anochece).           | —                         |
| **Mano verde**    | Cada cosecha suya da una hortaliza y una semilla más.                                                                                   | —                         |
| **Cocinillas**    | Cocina el doble de rápido y nunca le sale mal (las recetas de la cocina).                                                               | —                         |
| **Gourmet**       | Comer variado le anima el doble y comer siempre lo mismo le hunde el doble; la comida caliente y la fresca, la mitad más.               | Asceta                    |
| **Asceta**        | La comida no le cambia el ánimo (ni variada, ni caliente, ni en la mesa) y le da igual dormir en el suelo.                              | Gourmet                   |
| **Buen tirador**  | Con armas de fuego acierta 15 puntos más.                                                                                               | Gatillo fácil             |
| **Gatillo fácil** | Dispara en cuanto ve un zombi que le amenaza (no espera a estar en apuros) y acierta 10 puntos menos: gasta más balas y hace más ruido. | Buen tirador              |
| **Duro de pelar** | La infección le avanza más despacio: tarda la mitad más en matarle (más tiempo para antibióticos o amputar).                            | Enfermizo                 |
| **Enfermizo**     | La infección le avanza más deprisa: tarda una cuarta parte menos en matarle.                                                            | Duro de pelar             |
| **Friolero**      | Siente 4 grados menos.                                                                                                                  | Caluroso                  |
| **Caluroso**      | Siente 4 grados más (aguanta mejor el frío y peor el calor).                                                                            | Friolero                  |

- Las descripciones (ficha del colono), en español y en inglés, dicen lo que hacen sin cifras que
  no sean las de arriba.
- Se sortean igual que los de ahora (1 o 2, sin parejas incompatibles), con el mismo azar.
- Partidas guardadas: no cambia nada (son rasgos nuevos que las de antes no tienen).

## 2. Enfoques

1. **Cada rasgo, donde ya se decide lo suyo** (elegido): el sueño en el cerebro y las actividades,
   la cosecha en Cultivar, la cocina en Fabricar, el ánimo de la comida en el ánimo, los disparos en
   las armas, la infección en la enfermedad y el frío en la sensación térmica. Poco código en cada
   sitio, cada uno con su prueba.
2. Un sistema genérico de «efectos de rasgo» (tabla de modificadores): más ordenado a la larga, pero
   para 11 rasgos con efectos tan distintos es más código que el problema. Descartado.

## 3. Pruebas

Cada rasgo con la suya (lo hace y, sin el rasgo, no); el sorteo respeta las parejas; la ficha
enseña nombre y descripción en los dos idiomas; las partidas largas siguen sin romper nada.
