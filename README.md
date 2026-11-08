# rimZomboid

Juego de gestión de una colonia de supervivientes en un apocalipsis zombi, a medio camino entre RimWorld y Project Zomboid. Se juega en el navegador.

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

- `Espacio` pausa · `1` `2` `3` velocidad. En pausa, arriba sale **⏸ En pausa** (pulsarlo sigue).
- `WASD` o flechas mueven la cámara · arrastrar con el botón derecho · rueda para el zoom.
- Clic izquierdo en un superviviente (o en su tarjeta) abre su ficha; en una casa, la ficha de la casa.
- Clic derecho en un sitio: lo que se puede hacer allí (saquear una casa, un mueble o un cuerpo,
  talar un árbol, tapiar o reparar, cortinas, fabricar en la mesa, ver la casa).
- Herramientas, para marcar muchas cosas arrastrando: `L` Saquear, `T` Talar, `B` Construir. Abajo
  dicen qué hacer; **Hecho** (o `Esc`) las quita.
- Paneles: `I` Almacén, `J` Trabajos (con Atuendos), `F` Fabricar, `E` Expediciones, `P` Partida
  (con Avisos y el sonido). `R` modo combate · `M` sonido · `Esc` cierra lo de arriba.

Al empezar, una tarjeta abajo a la derecha enseña los primeros pasos, uno a uno, y luego salen
consejos cuando pasa algo por primera vez (se pueden apagar en la Ayuda).

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
