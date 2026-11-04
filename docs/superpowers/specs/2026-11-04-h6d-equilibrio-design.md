# H6d Equilibrio — diseño

## Objetivo

Cerrar H6: que, jugando con cabeza (saqueando, vendando, dando antibióticos y usando las
expediciones), en Equilibrado y con zombis normales, la colonia caiga hacia el día 25 de media.
Casi todo lo que mata es la infección: la mitad, de mordisco (no tiene cura); la otra mitad, de
arañazos que los antibióticos curan, pero casi nunca hay cuando hacen falta (H6a §4).

El usuario eligió **A y B** (más antibióticos a mano y menos infecciones) y que **los números los
decida la sonda**, dentro de unos límites. El mordisco sigue siendo mortal.

## 1. Las palancas (en `balance.ts`)

- **Antibióticos al empezar** (`START_ANTIBIOTICS`, nuevo): 1–3 en el almacén (ahora 0).
- **Antibióticos en el pueblo:** algo más en las casas y la farmacia del pueblo (ahora una casa,
  1 de cada 33; la farmacia, 3 de cada 10).
- **Arañazos que infectan menos** (`WOUNDS.scratch.infect`, ahora 0,03): como mucho, la mitad.
- **Mordiscos más raros** (`MAUL_BITE_CHANCE`, ahora 0,05): como mucho, la mitad.

## 2. Cómo se eligen

- **Sonda** de 36 semillas, Equilibrado y normal, contestando con sensatez (antibióticos a quien
  tiene fiebre si hay), con y sin expediciones (como en H6a).
- Primero, cómo está ahora (después de H6c). Luego, de menos a más: solo antibióticos (al empezar
  y en el pueblo); si no basta, también menos infecciones. Se queda la combinación más pequeña que
  llegue al objetivo.

## 3. Objetivo

- **Con expediciones:** media de caída entre el día 24 y el 26; llegan al día 30 entre un tercio y
  la mitad de las partidas.
- **Sin expediciones:** algo mejor que ahora, hacia el día 22–23.
- Si ni con todo al máximo de los límites se llega, se para y se le cuenta al usuario.
- Solo se mide Equilibrado y normal; los demás modos cambian en la misma medida.

## 4. Pruebas

- Se empieza con `START_ANTIBIOTICS` antibióticos en el almacén.
- Las pruebas que fijan los números, al día.
- La partida larga de 30 días y las e2e, en verde.
- Los resultados de la sonda, aquí (§5) y en la hoja de ruta.

## 5. Resultados de la sonda

36 semillas, Equilibrado y normal; media del día en que cae la colonia (31 si llega al final) y
cuántas llegan al día 30. El ruido de la media es de ±1,3 días, más o menos.

| Combinación                                                 | Sin expediciones | Con expediciones |
| ----------------------------------------------------------- | ---------------- | ---------------- |
| Como estaba (tras H6c)                                      | 21,2 (11/36)     | 19,1 (7/36)      |
| 1 antibiótico al empezar + pueblo (casas 0,1; farmacia 1–2) | 23,3 (16/36)     | 22,8 (15/36)     |
| **2 antibióticos al empezar (lo elegido)**                  | **26,0 (20/36)** | **24,3 (17/36)** |
| 2 al empezar + pueblo                                       | 25,1 (20/36)     | 24,9 (19/36)     |
| 2 + pueblo + arañazo 0,02 + mordisco 0,035 (sin acabar)     | ~29              | ~29              |
| Todo al máximo de los límites (sin acabar)                  | ~29,8            | ~29,8            |

- **Elegido: solo `START_ANTIBIOTICS = 2`.** Es lo más pequeño que llega al objetivo con
  expediciones (24,3 y 17 de 36 al día 30). Con 1 no se llega; añadir el pueblo no cambia nada que
  se note (dentro del ruido); bajar las infecciones lo pone demasiado fácil.
- **Sin expediciones se pasa del objetivo** (26 frente a 22–23): no hay un número entre 1 y 2.
- Se toman 2,6 antibióticos por partida sin expediciones y 5,4 con ellas; curan 1,3 y 2,0.
- Casi todas las muertes siguen siendo por infección; unos 2 mordiscos por partida.
- En esta sonda las expediciones cuestan gente: con ellas se cae algo antes que sin ellas.
