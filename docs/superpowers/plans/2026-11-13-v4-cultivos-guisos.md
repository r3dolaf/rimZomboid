# V4 Cultivos y guisos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cuatro cultivos elegidos por el jugador (con pistas en las semillas), cinco recetas, comer
variado y un dibujo para cada cosa, en el mapa y en los paneles.

**Architecture:** cada cultivo, semilla y plato es un `ItemKind` propio (enfoque 1 del spec); una tabla
`CROPS` en `balance.ts` manda en todo lo que distingue a los cultivos; las parcelas y lo sembrado llevan
su `CropKind`. Las recetas ganan dos ingredientes de grupo (`anyVeg`, `liquid`), como el `material` de
H5b. Los dibujos, como los de ahora (filas de letras en `render/`), y la interfaz los pinta en pequeño
con un lienzo propio (sin Phaser).

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest (unitarias y soak), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-11-13-v4-cultivos-guisos-design.md`

## Global Constraints

- `src/sim` no importa `render`, `ui`, `game`, `audio` ni usa globals del navegador (ESLint).
- Textos en `src/i18n/es.ts` y `en.ts` con la misma forma (`Texts = Widen<es>`); nada de texto suelto.
- Las pistas de las semillas, sin cifras ni estaciones (§2.1 del spec).
- `SAVE_VERSION` pasa a 8; una partida de la 7 (o anterior) se carga y queda como estaba, con patata.
- Lo nuevo de cada colono y de la partida, opcional en los tipos (partidas viejas).
- Commits con el pie de siempre (Co-Authored-By y Claude-Session); sin PR.
- Antes de cada commit: `npx tsc --noEmit -p .`, `npx eslint src soak e2e`, `npx prettier --check src soak e2e docs` y las unitarias tocadas; las sondas fuera del repo (scratchpad) al comprobar.

## Review Focus

1. **Partida vieja a mitad**: hortalizas en bolsas, montones, contenedores, viajeros, sitios y registro;
   pedidos «cook»; parcelas sembradas → todo carga como patata y guiso de verduras (test en Task 1).
2. **Cambiar el cultivo de una parcela mientras alguien va a sembrarla** con las semillas de antes: deja
   de ir y no siembra lo que no toca (test en Task 2).
3. **Semillas en la mano que ya no sirven** (parcelas desmarcadas o cambiadas): se devuelven al almacén,
   no se quedan a cuestas para siempre (test en Task 2).
4. **Guiso de patatas con 2 patatas justas y ninguna otra hortaliza**: no se puede (las 2 del
   ingrediente fijo no cuentan como «cualquiera») y lo dice el panel (test en Task 3).
5. **Selector del Huerto en el móvil**: no tapa la barra de abajo ni el mapa entero y los iconos se ven
   (test en Task 7, e2e con viewport de móvil).

---

### Task 1: Objetos nuevos, tabla de cultivos y partida versión 8

Cambia «hortaliza / semillas / guiso» por los objetos nuevos, sin cambiar aún cómo se cultiva (todo
patata). Al terminar, el juego se juega como hoy con patatas.

**Files:**

- Modify: `src/sim/types.ts` (`CropKind`, `Crop.kind`, `Plot.kind`), `src/sim/items.ts`, `src/sim/balance.ts` (`CROPS`, `ITEM_WEIGHT_KG`, `ROT_PER_DAY`, `cook.output`), `src/sim/food.ts`, `src/sim/spoil.ts`, `src/sim/log.ts` (`spoiled`), `src/sim/farm.ts` (`markPlot` crea `kind: 'potato'`), `src/sim/jobs/farm.ts` (semillas/cosecha de patata), `src/sim/save.ts` (`toV8`), `src/ui/hud.ts`, `src/ui/describe.ts`, `src/ui/guide.ts`, `src/ui/craftPanel.ts`, `src/i18n/es.ts`, `src/i18n/en.ts`, y los tests y e2e que nombran `veg`/`seeds`/`meal`.
- Test: `src/sim/save.test.ts`, `src/sim/food.test.ts`, `src/sim/spoil.test.ts`

**Interfaces:**

- Produces:
  - `type CropKind = 'lettuce' | 'tomato' | 'potato' | 'cabbage'` y `CROP_KINDS: readonly CropKind[]` (en ese orden).
  - `ItemKind` sin `seeds`/`veg`/`meal` y con `seedsLettuce | seedsTomato | seedsPotato | seedsCabbage | lettuce | tomato | potato | cabbage | stewVeg | stewPotato | soupCabbage | salad | preserves` (en `ITEM_KINDS`, en ese orden, donde estaban los tres de V1).
  - `CROPS: Record<CropKind, CropSpec>` con `interface CropSpec { seeds: ItemKind; produce: ItemKind; sowMin: number; growMin: number; frost: number; hours: number; yieldBase: number }` y los valores del §2 del spec (horas: 96, 192, 240, 216; heladas −2, −2, −2, −6).
  - `VEG: readonly ItemKind[] = ['lettuce','tomato','cabbage','potato']` (lo crudo, de lo que antes se estropea a lo que menos).
  - `ROT_PER_DAY`: `lettuce .25, tomato .12, potato .02, cabbage .05, stewVeg .3, stewPotato .3, soupCabbage .3, salad .5` (la conserva no).
  - `FoodKind = 'salad' | 'stewVeg' | 'stewPotato' | 'soupCabbage' | 'lettuce' | 'tomato' | 'cabbage' | 'potato' | 'preserves' | 'food'`; `FOODS` en ese orden; `FOOD_RESTORE`: 50, 80, 100, 60, 25, 20, 35, 40, 60, 60.
  - Pesos: semillas 0.02; lettuce 0.3, tomato 0.2, potato 0.3, cabbage 1; platos 0.6; preserves 0.5.
  - Log: `{ kind: 'spoiled'; items: Partial<Record<ItemKind, number>> }`.
  - `Crop = { kind: CropKind; grown; ripe; dry }`, `Plot = { tile; kind: CropKind; crop; moisture }`.

- [ ] **Step 1: Tests que fallan**: en `save.test.ts`, `test('una partida de la versión 7 carga con patatas y guisos de verduras')`: construye una partida, la guarda, le pone `version: 7` y en el JSON cambia las claves `potato→veg`, `seedsPotato→seeds`, `stewVeg→meal` en todos los inventarios (almacén, montón, bolsa puesta, carga de un viajero, contenedor de un sitio), quita `kind` de una parcela sembrada y de su `crop`, y mete un registro `{kind:'spoiled', veg: 2, meal: 1}`; al cargar: `storage.items.potato === 3`, `seedsPotato`, `stewVeg` en cada sitio; `plots[0].kind === 'potato'`, `plots[0].crop.kind === 'potato'`; el registro es `{kind:'spoiled', items:{potato:2, stewVeg:1}}`; `checkInvariants` vacío. En `food.test.ts`: `FOODS` es el orden de arriba y `foodUnits({...potato: 3, salad: 1})` es `(3*40+50)/60`. En `spoil.test.ts`: con 100 de cada uno y `mult 1`, se pierden 25 lechugas y 0 conservas.
- [ ] **Step 2: Correr y ver que fallan**: `npx vitest run src/sim/save.test.ts src/sim/food.test.ts src/sim/spoil.test.ts` → FAIL (tipos y claves que no existen).
- [ ] **Step 3: Implementar** los tipos, listas y tablas de arriba; `rot` devuelve `Partial<Record<ItemKind, number>>` por cada clave de `ROT_PER_DAY`; `toV8(world)` con `walk` (renombra claves de cualquier objeto con `veg`/`seeds`/`meal` numéricos y `pieces`; parcelas y cosechas sin `kind` → `'potato'`; `spoiled` viejos → `items`); `SAVE_VERSION = 8`. Renombrado mecánico en el resto (`veg→potato`, `seeds→seedsPotato`, `meal→stewVeg`, hortaliza de cosecha → `CROPS.potato`); `hudFoodTitle` recibe la lista de comidas con su número; textos de los objetos nuevos (nombres; las pistas, en Task 7).
- [ ] **Step 4: Correr todo**: `npx vitest run` y `npx tsc --noEmit -p .` → todo PASS (los tests que esperaban 7 días/3 hortalizas, con `CROPS.potato`).
- [ ] **Step 5: Commit** `feat(sim): V4, los objetos de cada cultivo, semilla y plato, y la partida versión 8 (lo de antes, patata y guiso de verduras)`.

### Task 2: Cada cultivo con su tiempo y la siembra elegida

**Files:**

- Modify: `src/sim/farm.ts` (`farmSystem`, `markPlot`, `plotMarked`, `plotKindAt`), `src/sim/orders.ts`, `src/game/tools.ts`, `src/sim/jobs/farm.ts`, `src/sim/work.ts` (devolver semillas que no sirven), `src/sim/log.ts` (`cropsFrozen` con cultivos), `src/sim/invariants.ts`
- Test: `src/sim/farming.test.ts`, `src/sim/orders.test.ts`, `src/game/tools.test.ts` (o el que tenga `togglePlot`)

**Interfaces:**

- Consumes: `CROPS`, `CropKind`, `Plot.kind`, `Crop.kind` (Task 1).
- Produces:
  - Orden `{ type: 'markPlot'; x; y; on: boolean; crop?: CropKind }` (sin `crop`, patata).
  - `markPlot(w, x, y, on, crop: CropKind = 'potato')`: marcada y `on` → cambia `kind`.
  - `plotKindAt(w, x, y): CropKind | null` (con órdenes pendientes, como `plotMarked`).
  - `togglePlot(w, x, y, crop)`: misma → desmarca; otra → cambia; libre → marca. `markPlotsIn(w, a, b, crop)`: marca y cambia, nunca desmarca.
  - `sowWeather(w, kind): boolean` = `dayMean(w) >= CROPS[kind].sowMin`.
  - `harvestCount(kind, level, roll): number` = `yieldBase × (1 + level/15)`, la fracción con `roll` (sustituye a `harvestVeg`).
  - Log `{ kind: 'cropsFrozen'; n: number; crops: CropKind[] }` (sin repetidos).

- [ ] **Step 1: Tests que fallan** (`farming.test.ts`): lechuga madura a las 96 h con humedad y col a las 216; con 3 °C la col crece y la lechuga se para; a −4 °C la lechuga se hiela y la col no; a −7 la col se hiela; el registro dice `crops: ['lettuce']`. Con el día a 10 °C se siembran lechuga y patata y no tomate (14) aunque haya semillas; con 4 °C, solo col. Una parcela de col solo se siembra con `seedsCabbage` (con semillas de patata a cuestas, no). `harvestCount('tomato', 0, 0.99) === 5`, `harvestCount('lettuce', 15, 0) === 4`. Cosechar da su hortaliza y 1–2 de sus semillas. **Review Focus 2**: alguien va a sembrar patata y la parcela pasa a col → `farmStillWorth` es `false` y no siembra. **Review Focus 3**: lleva 3 `seedsTomato` y no queda ninguna parcela de tomate → su siguiente trabajo es descargar en el almacén. `tools`: `togglePlot` con la misma desmarca, con otra cambia; `markPlotsIn` no desmarca.
- [ ] **Step 2: Correr y ver que fallan**: `npx vitest run src/sim/farming.test.ts src/sim/orders.test.ts` → FAIL.
- [ ] **Step 3: Implementar**: `farmSystem` usa `CROPS[c.kind]` (horas, `growMin`, `frost`); `nearestPlot(…,'sow')` solo parcelas cuya semilla lleva y con `sowWeather`; `takeSeeds` coge, para las parcelas vacías que se pueden sembrar hoy, sus semillas (hasta `SOW_TAKE_MAX` en total, repartidas por lo que falta); `GameScene` pasa `this.tool.cropKind` (Task 7 lo crea; mientras, `'potato'`).
- [ ] **Step 4: Correr**: `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(sim): V4, cada cultivo crece, se para y se hiela con su temperatura, y se siembra lo elegido en cada parcela`.

### Task 3: Las recetas

**Files:**

- Modify: `src/sim/types.ts` (`RecipeId`), `src/sim/balance.ts` (`Recipe.anyVeg`, `Recipe.liquid`, `RECIPES`), `src/sim/jobs/craft.ts` (`hasInputs`, `craftBlocker`, `fetchCraft`, `finishCraft`), `src/ui/craftPanel.ts`, i18n (recetas y lo que falta)
- Test: `src/sim/cook.test.ts`

**Interfaces:**

- Produces:
  - `RecipeId` += `'cookPotato' | 'soup' | 'salad' | 'preserve'` (`'cook'` sigue siendo el guiso de verduras: los pedidos guardados valen).
  - `Recipe.anyVeg?: number` (hortalizas cualesquiera de `VEG`, además de las fijas) y `Recipe.liquid?: number` (botellas de agua; si no hay, cubos con agua, que vuelven como `bucket`).
  - `RECIPES`: `cook {anyVeg 2 → stewVeg, 0.5 h, campfire}`, `cookPotato {potato 2, anyVeg 1 → stewPotato, 0.75 h, campfire}`, `soup {cabbage 1, liquid 1 → soupCabbage, 0.5 h, campfire}`, `salad {lettuce 1, tomato 1 → salad, 10 min, table}`, `preserve {tomato 3 → preserves, 1 h, campfire}`; todas `safe: true` no (pueden salir mal, como hoy).
  - `CraftBlock` += `{ kind: 'anyVeg'; missing: number }` y `{ kind: 'liquid' }`.
  - `vegFor(r, from): ItemKind[] | null`: qué hortalizas «cualquiera» se gastarían (de `VEG` en orden, sin tocar las fijas).

- [ ] **Step 1: Tests que fallan** (`cook.test.ts`): cada receta, con sus cosas en el almacén y la hoguera encendida (la ensalada, en la mesa), da su plato; `cook` con 1 lechuga y 1 col gasta las dos; `cookPotato` con 3 patatas gasta 3; **Review Focus 4**: con 2 patatas y nada más, `craftBlocker(w, RECIPES.cookPotato)` es `{kind:'anyVeg', missing:1}`; la sopa con una botella gasta la botella; sin botellas y con un cubo con agua, gasta el agua y vuelve un cubo; sin agua, `{kind:'liquid'}`.
- [ ] **Step 2: Correr y ver que fallan**: `npx vitest run src/sim/cook.test.ts` → FAIL.
- [ ] **Step 3: Implementar**: al ir a por las cosas (`fetchCraft`), coge también las de `vegFor` y el líquido; al terminar (`finishCraft`), gasta lo fijo, `anyVeg` de lo que lleva en el orden de `VEG` y el líquido; si sale mal, pierde la mitad como hoy. El panel de Fabricar lista las recetas nuevas con lo que llevan («2 hortalizas cualesquiera», «agua»).
- [ ] **Step 4: Correr**: `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(sim): V4, cinco recetas: guiso de verduras y de patatas, sopa de col, ensalada y conserva de tomate`.

### Task 4: Comer variado y entrar en calor

**Files:**

- Modify: `src/sim/types.ts` (`Survivor.ate?`, `Survivor.warmUntil?`, `MemoryId` += `freshFood`, `stats.eaten?`), `src/sim/food.ts` (`eatFrom`, `eatFromPack` con `last`), `src/sim/systems/activities.ts`, `src/sim/mood.ts` (`variedDiet`, `sameFood`), `src/sim/season.ts` y `src/sim/travel.ts` (sensación térmica), `src/sim/balance.ts` (`SOUP_WARMTH = 8`, `SOUP_WARM_HOURS = 6`, `VARIETY = { remember: 6, distinct: 3, mood: 4 }`, `freshFood: { value: 6, hours: 8 }`), i18n (ánimo)
- Test: `src/sim/food.test.ts`, `src/sim/mood.test.ts`, `src/sim/cold.test.ts`

**Interfaces:**

- Consumes: `FOODS`, `FOOD_RESTORE` (Task 1).
- Produces: `bestFood(inv, last?: FoodKind): FoodKind | null` (el primero de `FOODS`; entre los de igual `ROT_PER_DAY`, el que no es `last`); `Survivor.ate?: FoodKind[]` (los 6 últimos); `Survivor.warmUntil?: number`; `common.stats.eaten?: FoodKind[]` (sin repetidos, para el logro).

- [ ] **Step 1: Tests que fallan**: con guiso de verduras y de patatas en el almacén y `last = 'stewVeg'`, come `stewPotato`; con ensalada y guiso, la ensalada; lo crudo antes que la conserva y la lata al final. Tras comer 3 cosas distintas en las 6 últimas, el ánimo tiene `variedDiet +4`; con 6 iguales, `sameFood −4`; con 5, ninguno. Los guisos y la sopa dan `hotMeal`; la ensalada, `freshFood`. Tras la sopa, `feels` sube 8 durante 6 h (también de viaje) y luego no.
- [ ] **Step 2: Correr y ver que fallan**: `npx vitest run src/sim/food.test.ts src/sim/mood.test.ts src/sim/cold.test.ts` → FAIL.
- [ ] **Step 3: Implementar** lo de arriba; el atracón, dar de comer a un derribado y comer de viaje usan `bestFood`/`eatFromPack` (ya lo hacen) con `last = s.ate?.at(-1)`.
- [ ] **Step 4: Correr**: `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(sim): V4, comer variado anima y siempre lo mismo no; la sopa hace entrar en calor`.

### Task 5: Semillas al empezar y en el botín

**Files:**

- Modify: `src/sim/balance.ts` (`START_SEEDS = { seedsPotato: 3, seedsLettuce: 3 }`, `SEED_KINDS: Partial<Record<LootKind, readonly CropKind[]>>` = granja y ferretería las 4, súper lechuga y tomate, casa tomate y lechuga), `src/sim/loot.ts`, `src/sim/world.ts` (el comienzo), `src/sim/setup.ts` si reparte semillas
- Test: `src/sim/loot.test.ts`, `src/sim/world.test.ts`

**Interfaces:**

- Produces: cada semilla del botín (mismas cantidades de `SEEDS_LOOT`/`SITE_SEEDS_LOOT`, mismo azar `SEEDS_SALT`) elige su cultivo de `SEED_KINDS[sitio]` con ese azar.

- [ ] **Step 1: Tests que fallan**: al empezar hay 3 `seedsPotato`, 3 `seedsLettuce` y 0 de tomate y col; en 20 semillas (mundos) las granjas sacan de las cuatro; un supermercado nunca col ni patata.
- [ ] **Step 2: Correr y ver que fallan**: `npx vitest run src/sim/loot.test.ts src/sim/world.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**: `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(sim): V4, semillas de patata y lechuga al empezar; tomate y col, en el botín`.

### Task 6: Los dibujos en el mapa

**Files:**

- Create: `src/render/cropArt.ts` (plantas por cultivo y fase), `src/render/itemArt.ts` (lo cosechado, las semillas, los platos y la olla)
- Modify: `src/render/props.ts` (`cropFrame` por cultivo; registrar los nuevos en `PROP_SPRITES`), `src/render/colors.ts` (los colores nuevos de los bocetos, con letras libres: `1 2 3 4 5 6 7 8 9 0 # + * %`), `src/render/GameScene.ts` (olla en la hoguera)
- Test: `src/render/props.test.ts`

**Interfaces:**

- Produces: frames `crop-<kind>-1|2|3|ripe` (16 filas de 16); `ITEM_SPRITES: Record<ItemKind, readonly string[]>` solo para los 13 objetos nuevos (16 × 16); frames `pot-<plato>-0|1|2` (hoguera con olla, con la llama de `campfire`); `cropFrame(p): string | null` → `crop-${p.crop.kind}-…`; `potFrame(w, f, frame): string | null` (si alguien hace en esa hoguera una receta con olla).

- [ ] **Step 1: Tests que fallan** (`props.test.ts`): todos los frames nuevos tienen 16 de ancho, solo letras de `PROP_COLORS` o `.`; los cuatro cultivos maduros son distintos entre sí (como texto); `cropFrame` de una col a mitad es `crop-cabbage-2`; `potFrame` con alguien cocinando `soup` en esa hoguera es `pot-soupCabbage-…` y sin nadie, `null`.
- [ ] **Step 2: Correr y ver que fallan**: `npx vitest run src/render/props.test.ts` → FAIL.
- [ ] **Step 3: Implementar** los dibujos como en los bocetos (`scratchpad/bocetos/cultivos-guisos.html` tiene las funciones de forma: rosetas, caña, mata con flor, col con nervios, cuenco, tarro, olla); el tinte de mustio, como hoy.
- [ ] **Step 4: Correr**: `npx vitest run src/render` → PASS; `npm run build` sin errores.
- [ ] **Step 5: Commit** `feat(render): V4, un dibujo para cada cultivo en sus cuatro fases, y la olla en la hoguera con el color de cada plato`.

### Task 7: Selector del Huerto, iconos y avisos

**Files:**

- Create: `src/ui/icons.ts` (`itemIcon(kind, scale=2): HTMLCanvasElement` desde `ITEM_SPRITES` y `PROP_COLORS`, con caché de `dataURL`), `src/ui/farmMenu.ts`
- Modify: `src/ui/tool.ts` (`cropKind`, `setCropKind`; empieza en `'potato'`), `src/main.ts` (montar el menú), `src/render/GameScene.ts` (`togglePlot`/`markPlotsIn` con `tool.cropKind`), `src/ui/storagePanel.ts`, `src/ui/craftPanel.ts` y lo que lleva un colono en su ficha (`src/ui/sheet.ts`) (icono junto al nombre), `src/ui/describe.ts` (parcela: «Col, creciendo / madura / sin semillas»), `src/ui/notices.ts` (aviso «Faltan semillas de X», uno por cultivo), `src/ui/panels.css`, i18n (`seedHints`, `farmMenu`, notices)
- Test: `src/ui/farmMenu.test.ts`, `src/ui/notices.test.ts`, `src/ui/describe.test.ts`, `e2e/farm.spec.ts`

**Interfaces:**

- Consumes: `ITEM_SPRITES` (Task 6), `plotKindAt`, `togglePlot(w,x,y,crop)`, `markPlotsIn(w,a,b,crop)` (Task 2).
- Produces: `es.seedHints: Record<CropKind, string>` con las pistas del §2.1 del spec (y en inglés); `mountFarmMenu(root, { tool, world }): { update(): void }` (como `mountBuildMenu`: visible con la herramienta Huerto; 4 botones `farm-<kind>` con icono, nombre y semillas que hay; abajo, la pista del elegido).

- [ ] **Step 1: Tests que fallan**: el menú solo se ve con Huerto; tocar `farm-cabbage` pone `tool.cropKind = 'cabbage'` y la pista es la de la col; el número de semillas sale del almacén. Aviso: una parcela de col vacía sin `seedsCabbage` en el almacén ni a cuestas → «Faltan semillas de col»; con semillas, no. Describir una parcela de tomate madura: «Tomate, madura». e2e: elegir Col, clic en hierba → la parcela es de col (`plotKindAt`); el Almacén enseña un icono `canvas` junto a «Patatas»; **Review Focus 5**: con viewport de móvil (390 × 844) el menú del Huerto no tapa la barra de herramientas y cabe en pantalla.
- [ ] **Step 2: Correr y ver que fallan**: `npx vitest run src/ui` y `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/farm.spec.ts --trace off` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**: `npx vitest run` y el e2e de arriba → PASS.
- [ ] **Step 5: Commit** `feat(ui): V4, el selector del Huerto con las pistas de cada semilla, iconos de comida en el almacén y en Fabricar, y el aviso de semillas que faltan`.

### Task 8: Ayuda, consejos, registro y logro

**Files:**

- Modify: `src/ui/guide.ts` (consejo del huerto: se elige; nuevo `winterCrops` en otoño con alguna parcela: «Lo que aguanta el invierno se siembra antes de que hiele»), `src/ui/help.ts` y i18n (Huerto y cocina), `src/ui/describe.ts` (registro `spoiled` por objeto y `cropsFrozen` por cultivo), `src/ui/achievements.ts` (`goodCook`: los 5 platos en `stats.eaten`), i18n
- Test: `src/ui/guide.test.ts`, `src/ui/help.test.ts`, `src/ui/logPanel.test.ts`, `src/ui/achievements.test.ts`

- [ ] **Step 1: Tests que fallan**: el consejo `winterCrops` sale el primer día de otoño con parcelas y no antes; la Ayuda menciona los cuatro cultivos y las cinco recetas (es y en); el registro dice «Se han echado a perder 2 lechugas y 1 guiso de patatas» y «Se ha helado la col»; `goodCook` se consigue con los cinco en `stats.eaten` y no con cuatro.
- [ ] **Step 2: Correr y ver que fallan**: `npx vitest run src/ui` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr**: `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(ui): V4, ayuda, consejos y registro de los cultivos y guisos, y el logro Buen cocinero`.

### Task 9: Partida larga

**Files:**

- Modify: `soak/soak.test.ts` (partida «V4»: huerto de 8 parcelas que el plan cambia por temporada —verano patata y tomate, otoño col—, pedidos de las cinco recetas; y el resto de partidas de huerto, como están, con patata)
- Test: el propio soak

- [ ] **Step 1: Test**: `test.each([1, 2])('V4: semilla %i, 60 días con los cuatro cultivos y las cinco recetas — sin romper nada')` (invariantes cada tick) y `test('V4: se cosecha de los cuatro y se cocinan los cinco platos')` (totales de las dos partidas: cada cultivo cosechado > 0, cada plato hecho > 0).
- [ ] **Step 2: Correr**: `npx vitest run --config vitest.soak.config.ts -t "V4"` → PASS (si falla, depurar antes de seguir).
- [ ] **Step 3: Commit** `test(soak): V4, partida larga con los cuatro cultivos y las cinco recetas`.

### Task 10: Equilibrio con la sonda

**Files:**

- Modify (fuera del repo): `scratchpad/probe-extra/q1/balance.test.ts` → copia en `probe/` para correrla; dos jugadores: **competente** (verano patata y tomate, conserva en otoño, col antes del invierno, guisos y sopa) y **descuidado** (todo patata, solo guiso de verduras)
- Modify (repo): `src/sim/balance.ts` (cifras de `CROPS`/recetas si hace falta), el spec (§10, tabla de resultados) y la hoja de ruta

- [ ] **Step 1: Correr la sonda** con los dos jugadores (72 partidas cada uno, como Q1) y comparar con Q1: Equilibrado competente al día 60 en 25–35 %; descuidado, no peor que Q1 (mediana 46, 17 %).
- [ ] **Step 2: Ajustar cifras** (una a la vez, con su vuelta) hasta cumplir, sin tocar los antiobjetivos del spec.
- [ ] **Step 3: Apuntar** los resultados en el spec y en la hoja de ruta; quitar la sonda del repo.
- [ ] **Step 4: Commit** `feat(sim): V4, equilibrio con la sonda (…resultado…)`.

### Task 11: Comprobar todo y subir a main

- [ ] **Step 1**: `npx tsc --noEmit -p .`, `npx eslint src soak e2e`, `npx prettier --check src soak e2e docs`, `npx vitest run`, `npm run build` → todo bien.
- [ ] **Step 2**: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --trace off` → todo pasa.
- [ ] **Step 3**: soak completo en segundo plano (`npx vitest run --config vitest.soak.config.ts`, ~90 min) → todo pasa.
- [ ] **Step 4**: `git fetch origin main && git merge-base --is-ancestor origin/main HEAD && git push origin HEAD:main`; comprobar el CI más tarde.
