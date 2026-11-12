# Villamuerta

Juego de gestión de una colonia de supervivientes en un pueblo durante un apocalipsis zombi: saquear,
defenderse, cultivar, pasar el invierno y, si hay suerte, que os rescaten. Se juega en el navegador.

Antes se llamaba «rimZomboid» (un nombre de trabajo con dos marcas ajenas). El repositorio, la
dirección de GitHub Pages y las claves de lo guardado en el navegador conservan el nombre antiguo.

## Arrancar

```bash
npm install
npm run dev      # abre el juego en modo desarrollo
```

## Comprobar

```bash
npm test         # tests de la simulación y la interfaz
npm run lint     # reglas de estilo y de arquitectura
npm run typecheck
npm run build    # versión para publicar, en dist/
npm run soak     # partida automática de 30 días sin pantalla (SOAK_DAYS=5 para menos)
npm run e2e      # test en el navegador con Playwright
```

En la nube de Claude Code, el test del navegador usa el Chromium preinstalado:
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`.
En tu ordenador, instala antes el navegador con `npx playwright install chromium`.

## Jugar con una semilla concreta

Cada partida se genera a partir de una semilla, que aparece en el panel **Partida**.
Para repetir una partida exacta, añade `?seed=NÚMERO` a la dirección.

Controles (también en el juego, en **❓ Ayuda**, con `H` o `?`):

- `Espacio` pausa · `1` `2` `3` velocidad. En pausa (también cuando la pone un aviso rojo), arriba
  sale **⏸ En pausa**.
- `WASD` o flechas mueven la cámara · arrastrar con el botón derecho · rueda para el zoom.
- Clic izquierdo en un superviviente (o en su tarjeta) abre su ficha; en una casa, la ficha de la casa.
- Clic derecho en un sitio: lo que se puede hacer allí (saquear una casa, un mueble o un cuerpo,
  talar un árbol, tapiar o reparar, cortinas, fabricar en la mesa, ver la casa).
- Herramientas, para marcar muchas cosas arrastrando: `L` Saquear, `T` Talar, `G` Huerto, `B`
  Construir. Abajo dicen qué hacer; **Hecho** (o `Esc`) las quita.
- Paneles: `I` Almacén, `J` Trabajos (con Atuendos), `F` Fabricar, `E` Expediciones, `P` Partida
  (con Avisos y el sonido). `R` modo combate · `M` sonido · `Esc` cierra lo de arriba.

Al empezar, una tarjeta abajo a la derecha enseña los primeros pasos, uno a uno, y luego salen
consejos cuando pasa algo por primera vez (se pueden apagar en la Ayuda).

Asentarse (huerto, agua y estaciones):

- **Huerto** (`G`): clic en una casilla de hierba junto a la base, o arrastrar para un rectángulo.
  Lo siembran, riegan y cosechan quienes tienen **Cultivar**; las hortalizas se cocinan en la
  hoguera (Fabricar → Cocinar) y se estropean con los días.
- **Agua** (💧 arriba): se bebe del fregadero mientras hay agua corriente (se corta entre los días 7
  y 14); después, de barriles de lluvia (Construir), barreños, cisternas y botellas. Para las
  expediciones, botellas (o un río por el camino).
- **Amputar**: un mordisco en un brazo o una pierna pregunta si se amputa (hay 8 horas, y hace falta
  algo para cortar y 2 vendas). Si se hace a tiempo, la infección no le mata, pero pierde el brazo o
  la pierna para siempre.
- **Idiomas**: español e inglés (**ES · EN** en la portada y en el panel Partida; la primera vez,
  el del navegador; `?lang=en` en la dirección).
- **Comienzos y ajustes**: en la portada se elige cómo empieza (en el pueblo, solo, con familia
  numerosa o con lo puesto) y, plegados, los ajustes a medida: infección, botín, asedios, hambre y
  sed y frío. Van en la dirección, así que un enlace compartido es la misma partida.
- **Radio y rescate**: tras encontrar una radio en una nave, una gasolinera o un pueblecito del mapa
  del mundo, se construye en la base (Construir → Radio) y se le dan pilas. Encendida, se oye al
  ejército: primero que evacúa, luego hacia dónde y, por último, dónde y qué día pasará un
  helicóptero. Hay que llegar al punto de evacuación y pisar la zona de aterrizaje antes de que se
  vaya (el ruido atrae a los zombis). Quien sube se salva; se puede ver el final o seguir con los que
  se quedan.
- **Generador**: se encuentra en ferreterías, naves y granjas y se monta en la base (Construir →
  Generador); Transportar le lleva gasolina. En marcha, el fregadero da agua aunque se haya cortado,
  lo fresco aguanta más, la base se ilumina de noche y la radio no gasta pilas; pero hace ruido y
  gasta un bidón cada 6 horas. Se enciende y se apaga con el clic derecho.
- **Armas de fuego**: pistola (con balas) y escopeta (con cartuchos), en comisarías, granjas y
  ferreterías. Se llevan encima: en la ficha, Equipo → Llevar siempre. Disparan de lejos en modo
  combate o cuando están en apuros (varios zombis, heridos o en un asedio); con un zombi solo, a
  golpes. Cada disparo se oye desde muy lejos.
- **Crónica y logros**: al acabar, la pantalla final cuenta la partida (quién murió, quién llegó, los
  asedios, el rescate…) y se puede copiar como texto o guardar como imagen para compartirla, con el
  enlace a la misma partida. Hay 20 logros que se guardan en el navegador (panel Partida); con las
  trampas de depuración no cuentan.
- **Estaciones**: el año dura 60 días y empieza en verano. En invierno no crece nada y hiela: hace
  falta ropa de abrigo y hogueras con leña (Transportar se la lleva). La estación y la temperatura
  están junto a las pestañas de mapa.

## Sonido

Los efectos y la música se hacen por código, en el navegador (`src/audio/`): no hay archivos de
audio. Suenan tras el primer clic o la primera tecla (los navegadores no dejan antes). Con `F3`, el
muestrario deja oír cada efecto y forzar cada ambiente de música.

Para cambiar un efecto o un ambiente de música por un archivo:

1. Copia el archivo a `public/audio/` (por ejemplo `public/audio/noche-1.mp3`).
2. En `src/audio/catalog.ts`, cambia su línea: `night: [{ file: 'audio/noche-1.mp3' }]`. Puede haber
   varios temas por ambiente, de código y de archivo mezclados; se elige uno al azar cada vez.
3. Apunta de dónde es y su licencia en `public/audio/CREDITOS.md`.

Con el dedo (móvil en horizontal o tableta):

- Tocar es el clic izquierdo; mantener pulsado medio segundo y soltar, el clic derecho (órdenes del
  modo combate y menú contextual).
- Arrastrar un dedo mueve la cámara (con una herramienta activa, marca); mantener y arrastrar elige
  a varios con un rectángulo; dos dedos acercan, alejan y mueven la cámara.
- Mantener pulsado un sitio (una casa, un árbol, una ventana…) saca lo que se puede hacer allí: casi
  no hace falta cambiar de herramienta.
- Mantener pulsada una tarjeta añade o quita a ese colono de los elegidos.
- En el móvil, los paneles están en el menú ☰ (arriba a la derecha) y las herramientas, en la columna
  de la derecha. Desde el navegador se puede **añadir a la pantalla de inicio** para jugar a pantalla
  completa, y en Android también desde «⛶ Pantalla completa» en el menú ☰.
- Para ver los fotogramas por segundo en el móvil (no hay F3), añade `?debug=1` a la dirección: sale
  «🐞 Depuración» en el menú ☰.

Los iconos de la app (`public/icons/`) se generan con `node scripts/app-icons.mjs`.

## Publicar en GitHub Pages

Cada push a `main` comprueba el juego y lo publica automáticamente. La primera vez hay que
activarlo en GitHub: **Settings → Pages → Source: GitHub Actions**.
El juego quedará en `https://r3dolaf.github.io/rimZomboid/`.

Diseño: `docs/superpowers/specs/2026-10-19-rimzomboid-design.md`
