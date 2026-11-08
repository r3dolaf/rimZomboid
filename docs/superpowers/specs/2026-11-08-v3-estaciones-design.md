# V3 — Estaciones y frío

Fecha: 2026-11-08
Estado: aprobado (bloque A «Asentarse»; el usuario pidió que se tomen las decisiones sin preguntar)

## 0. Para qué

Con el huerto (V1) y el agua (V2) una colonia puede llegar a mantenerse sola. Hace falta una amenaza
nueva para cuando lo consigue, y que obligue a **prepararse**: el invierno. En verano todo es fácil;
el otoño es para cosechar, guardar comida y leña y buscar ropa de abrigo; en invierno no crece nada,
hace frío y hay que mantener las hogueras encendidas. Así la ropa sirve para algo más que parar
mordiscos, talar sirve para algo más que construir, y la partida tiene un arco de un año.

## 1. El calendario

- Un año de **60 días**: cuatro estaciones de 15. El día 1 es el primero del **verano**; el otoño
  empieza el 16, el invierno el 31 y la primavera el 46.

## 2. La temperatura

- **Al aire libre**, en grados: la media del día sigue el año (unos 24 en pleno verano, unos −2 en
  pleno invierno, unos 11 en otoño y primavera); a lo largo del día baja de madrugada y sube por la
  tarde (±5); cada día tiene su desviación (±4, la misma con la misma semilla, sin tocar el azar
  de la partida); la lluvia resta 3 y la tormenta 5; y las olas de frío o de calor (§8).
- **Bajo techo** (dentro de un edificio o de la base): 8 grados más.
- **Junto a una hoguera encendida** (a 4 casillas): 12 grados más.

## 3. El abrigo y la sensación térmica

- Cada prenda **abriga** (camiseta 1, manga larga 2, camisa 2, sudadera 4, jersey 5, chaqueta
  vaquera 4, de cuero 5, abrigo 9, chaleco 1, chándal 3, vaqueros 2, pantalón de trabajo 3, perneras
  2, gorra 0,5, gorro 2, casco 1); cada agujero le quita un 20 %.
- **Sensación térmica** de cada uno: la temperatura de donde está más lo que abriga su ropa. Se
  calcula cada pocos ticks (`Survivor.feels`).
- **Ánimo:** por debajo de 10, «Tiene frío» (−6); por debajo de 0, «Helado» (−20); por encima de
  40, «Pasa calor» (−5).
- **Helado** (por debajo de 0): pierde 3 de sangre por hora; quien muere así muere **de frío**. Con
  calor (por encima de 40), la sed baja una vez y media más rápido.
- De viaje, al aire libre (y de noche, sin hoguera).

## 4. La hoguera gasta leña

- La hoguera tiene **leña** (horas): con leña alumbra, calienta y sirve para cocinar; sin leña se
  apaga (y se dibuja apagada). Gasta 1 hora de leña por hora.
- Recién construida tiene 12 horas. **Transportar** le lleva tablas cuando le quedan menos de 8 h,
  hasta 24 (cada tabla, 4 horas).
- Las partidas guardadas de antes: sus hogueras empiezan con 12 horas.

## 5. Vestirse según el frío

- Al elegir ropa, cuando hace frío (la media del día por debajo de 15) el abrigo también cuenta, más
  cuanto más frío; en verano se elige como hasta ahora.

## 6. El invierno

- **El huerto** solo crece por encima de 5 grados; **una helada** (por debajo de −2) mata lo que
  está creciendo («La helada ha matado N cultivos»).
- **Nieva** en vez de llover por debajo de 0: los barriles y barreños se llenan la mitad y el huerto
  no se moja (está helado). Se dibuja como lluvia blanca y más lenta.
- **Lo fresco se estropea menos** con frío: con la media del día por debajo de 5, a la cuarta parte;
  por debajo de 15, al 60 %.
- **Los zombis van más despacio** helados (por debajo de 0): un 20 % menos.

## 7. Pantalla

- **Barra de arriba:** la estación y la temperatura junto a la hora («Otoño · 9 °C»).
- **Tarjeta:** icono 🥶 a quien está helado.
- **Ficha, pestaña Ropa:** lo que abriga lo que lleva y su sensación térmica.
- **Mapa:** la hierba, más amarilla en otoño y blanca en invierno; la hoguera, apagada sin leña; la
  leña que le queda al pasar el ratón.
- **Registro y avisos:** «Empieza el otoño» (y cada estación), «La helada ha matado…», «Ana ha
  muerto de frío»; aviso (amarillo) al empezar el invierno.

## 8. Olas de frío y de calor (narrador)

- **Ola de frío** (otoño e invierno): −8 grados durante 2 días. Mala, con aviso.
- **Ola de calor** (verano): +8 grados durante 2 días. Mala, con aviso.

## 9. Guardar

`SAVE_VERSION` 4: las de antes se siguen cargando (la ola en curso, ninguna; las hogueras con 12 h de
leña).

## 10. Pruebas

- **Unitarias:** calendario, temperatura (año, día, lluvia, techo, hoguera), abrigo y agujeros,
  sensación, ánimo, sangre y muerte de frío, calor y sed, leña (gastar, apagarse, llevarla),
  vestirse con frío, el huerto con frío y helada, nieve, estropearse con frío, zombis lentos, olas,
  cargar una partida de la versión 3.
- **Invariantes:** leña entre 0 y 24.
- **Partida larga:** de 60 días con huerto, hogueras y leña: llega el invierno sin romper nada.
