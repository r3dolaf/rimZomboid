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

(Se rellena al terminar.)
