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

Cada partida se genera a partir de una semilla, que aparece arriba a la derecha.
Para repetir una partida exacta, añade `?seed=NÚMERO` a la dirección.

Controles: `Espacio` pausa · `1` `2` `3` velocidad · `WASD` o flechas mover la cámara ·
arrastrar con el botón derecho · rueda para el zoom.

## Publicar en GitHub Pages

Cada push a `main` comprueba el juego y lo publica automáticamente. La primera vez hay que
activarlo en GitHub: **Settings → Pages → Source: GitHub Actions**.
El juego quedará en `https://r3dolaf.github.io/rimzomboid/`.

Diseño: `docs/superpowers/specs/2026-10-19-rimzomboid-design.md`
