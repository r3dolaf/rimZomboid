# H1. Cimientos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un juego web que genera un mapa aleatorio a partir de una semilla, con 3 supervivientes que pasean por la base, dibujado con Phaser, con cámara, pausa y velocidades, y publicado en GitHub Pages.

**Architecture:** La simulación (`src/sim/`) es TypeScript puro: un `World` de datos simples serializables que avanza con `step(world)` a 10 ticks por segundo de juego. Phaser (`src/render/`) solo dibuja el estado, y la interfaz (`src/ui/`) es HTML/CSS encima del canvas. Un `TimeController` decide cuántos ticks ejecutar en cada fotograma según la velocidad.

**Tech Stack:** TypeScript 6.0.3, Vite 8.3.4, Phaser 4.2.1, Vitest 5.0.5, ESLint 10.13.0 + typescript-eslint 8.71.2, Prettier 3.9.10, @playwright/test 1.64.1, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-19-rimzomboid-design.md` (hoja de ruta: `docs/superpowers/plans/2026-10-19-hoja-de-ruta.md`)

## Global Constraints

- Versiones exactas (sin `^`) de las dependencias listadas en Tech Stack. TypeScript 6.0.3 y no 7.x, porque typescript-eslint 8.71.2 exige `typescript <6.1.0`.
- `src/sim/` no importa nada de Phaser, del DOM ni de `window`. ESLint lo impone con `no-restricted-imports` y `no-restricted-globals`.
- Todo el azar de la simulación sale de `src/sim/rng.ts`. `Math.random` está prohibido en `src/sim/` (regla ESLint `no-restricted-properties`).
- El `World` contiene solo datos simples (números, cadenas, arrays y objetos planos): `JSON.parse(JSON.stringify(world))` debe ser igual a `world`.
- Identificadores del código en inglés; comentarios y textos visibles en español. Todos los textos visibles salen de `src/i18n/es.ts`. (Nombres del spec: `CerebroIA` → `AiBrain`, `Cerebro` → `Brain`.)
- Todas las cifras ajustables van en `src/sim/balance.ts`.
- 10 ticks por segundo de juego; 1 día de juego = 720 s reales a x1 = 7200 ticks; 1 hora de juego = 300 ticks; la partida empieza el Día 1 a las 08:00.
- Mapa de 100×100 casillas; base en el centro; 6–10 casas; 3 supervivientes.
- TypeScript con `strict: true` y `noUncheckedIndexedAccess: true`.
- Tests junto al código (`src/**/*.test.ts`). La partida larga va aparte (`soak/`) y no forma parte de `npm test`.
- Playwright usa el Chromium indicado en la variable `PLAYWRIGHT_CHROMIUM_PATH` si existe (en este entorno: `/opt/pw-browsers/chromium`); nunca se ejecuta `playwright install` aquí.

## Review Focus

1. **Una casa que no se puede alcanzar desde la base** (rodeada de árboles o pegada a otra): el saqueo de H3 fallaría. Se espera que todas las puertas sean alcanzables desde la puerta de la base → test en la Tarea 5.
2. **La pestaña pasa minutos en segundo plano** y al volver llega un `dt` enorme: el juego no debe congelarse intentando ponerse al día → test en la Tarea 8.
3. **`?seed=` raro en la URL** (vacío, letras, negativo, decimal, enorme): debe usarse una semilla aleatoria válida en lugar de romper o dar `NaN` → test en la Tarea 8.
4. **Un superviviente sin camino posible** (destino encerrado o él mismo encerrado): no debe colgarse, lanzar errores ni producir `NaN`; se queda esperando y vuelve a intentarlo → test en la Tarea 7.
5. **Supervivientes que aparecen en una casilla no transitable o encima de otro** → test en la Tarea 6.

---

### Task 1: Proyecto y herramientas

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`, `index.html`, `src/main.ts`, `src/sanity.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: scripts `npm run dev`, `build`, `preview`, `test`, `lint`, `typecheck`, `format`, `soak` (Tarea 11) y `e2e` (Tarea 10).

- [ ] **Step 1:** Crear `package.json` (`"type": "module"`, `"private": true`) con las dependencias exactas de Tech Stack (`phaser` en `dependencies`, el resto en `devDependencies`) y estos scripts: `dev: vite`, `build: tsc --noEmit && vite build`, `preview: vite preview`, `test: vitest run`, `lint: eslint .`, `typecheck: tsc --noEmit`, `format: prettier --write .`. Ejecutar `npm install`.
- [ ] **Step 2:** `tsconfig.json` con `target ES2022`, `module ESNext`, `moduleResolution bundler`, `strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `lib ["ES2022","DOM"]`, `include ["src","soak","e2e","*.ts"]`. `vite.config.ts` con `base: './'` (para GitHub Pages) y `test.include: ['src/**/*.test.ts']`.
- [ ] **Step 3:** `eslint.config.js` (configuración plana) con `typescript-eslint` recomendado y, solo para `src/sim/**`: `no-restricted-imports` de `phaser`, `no-restricted-globals` de `window` y `document`, y `no-restricted-properties` de `Math.random`. Ignorar `dist/`. `.prettierrc.json`: `{ "singleQuote": true, "semi": true, "printWidth": 100 }`. `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`.
- [ ] **Step 4:** `index.html` con `<div id="game"></div>`, `<div id="hud"></div>` y `<script type="module" src="/src/main.ts">`. `src/main.ts` provisional: `console.log('rimZomboid')`.
- [ ] **Step 5: Test de humo de la configuración** en `src/sanity.test.ts`:

```ts
import { expect, test } from 'vitest';
test('vitest funciona', () => expect(1 + 1).toBe(2));
```

- [ ] **Step 6:** Ejecutar `npm test && npm run lint && npm run typecheck && npm run build`. Esperado: todo pasa y existe `dist/index.html`.
- [ ] **Step 7:** Añadir al `README.md` qué es el proyecto (una línea), cómo arrancarlo (`npm install`, `npm run dev`) y cómo pasar los tests. Commit: `chore: configurar proyecto con Vite, TypeScript, Vitest y ESLint`.

---

### Task 2: Azar con semilla, ajustes y reloj

**Files:**
- Create: `src/sim/rng.ts`, `src/sim/balance.ts`, `src/sim/clock.ts`
- Test: `src/sim/rng.test.ts`, `src/sim/clock.test.ts`
- Delete: `src/sanity.test.ts`

**Interfaces:**
- Produces:
  - `interface RngState { s: number }` — estado serializable (entero de 32 bits sin signo).
  - `createRng(seed: number): RngState`
  - `nextFloat(rng: RngState): number` — en [0, 1); modifica `rng.s`. Algoritmo mulberry32.
  - `nextInt(rng: RngState, min: number, max: number): number` — entero en [min, max], ambos incluidos.
  - `pick<T>(rng: RngState, items: readonly T[]): T` — lanza `Error` si `items` está vacío.
  - `balance.ts`: `TICKS_PER_SECOND = 10`, `TICKS_PER_HOUR = 300`, `TICKS_PER_DAY = 7200`, `START_HOUR = 8`, `MAP_SIZE = 100`, `HOUSE_COUNT_MIN = 6`, `HOUSE_COUNT_MAX = 10`, `SURVIVOR_COUNT = 3`, `SURVIVOR_WALK_SPEED = 0.15` (casillas por tick), `IDLE_TICKS_MIN = 20`, `IDLE_TICKS_MAX = 80`, `NO_PATH_RETRY_TICKS = 10`, `TREE_DENSITY = 0.03`.
  - `clock.ts`: `interface GameTime { day: number; hour: number; minute: number }` y `gameTime(tick: number): GameTime`.

- [ ] **Step 1: Tests que fallan**

```ts
// rng.test.ts
test('misma semilla, misma secuencia', () => {
  const a = createRng(42), b = createRng(42);
  const sa = Array.from({ length: 5 }, () => nextFloat(a));
  const sb = Array.from({ length: 5 }, () => nextFloat(b));
  expect(sa).toEqual(sb);
});
test('semillas distintas, secuencias distintas', () => {
  expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
});
test('nextFloat siempre en [0,1)', () => {
  const r = createRng(7);
  for (let i = 0; i < 10_000; i++) { const v = nextFloat(r); expect(v >= 0 && v < 1).toBe(true); }
});
test('nextInt incluye ambos extremos y nada fuera', () => {
  const r = createRng(3); const seen = new Set<number>();
  for (let i = 0; i < 2000; i++) seen.add(nextInt(r, 6, 10));
  expect([...seen].sort()).toEqual([6, 7, 8, 9, 10]);
});
test('el estado sobrevive a JSON', () => {
  const r = createRng(9); nextFloat(r);
  const copia = JSON.parse(JSON.stringify(r)) as RngState;
  expect(nextFloat(copia)).toBe(nextFloat(r));
});
test('pick con lista vacía lanza error', () => {
  expect(() => pick(createRng(1), [])).toThrow();
});

// clock.test.ts
test('el tick 0 es el Día 1 a las 08:00', () => expect(gameTime(0)).toEqual({ day: 1, hour: 8, minute: 0 }));
test('una hora son 300 ticks', () => expect(gameTime(300)).toEqual({ day: 1, hour: 9, minute: 0 }));
test('5 ticks son 1 minuto', () => expect(gameTime(5)).toEqual({ day: 1, hour: 8, minute: 1 }));
test('a medianoche cambia el día', () => expect(gameTime(16 * 300)).toEqual({ day: 2, hour: 0, minute: 0 }));
```

- [ ] **Step 2:** `npx vitest run src/sim` → FAIL (los módulos no existen).
- [ ] **Step 3:** Implementar `rng.ts`, `balance.ts` y `clock.ts` con las firmas de arriba. Borrar `src/sanity.test.ts`.
- [ ] **Step 4:** `npx vitest run src/sim` → PASS.
- [ ] **Step 5:** Commit: `feat(sim): azar con semilla, ajustes y reloj de juego`.

---

### Task 3: Cuadrícula y casillas

**Files:**
- Create: `src/sim/types.ts`, `src/sim/map/grid.ts`
- Test: `src/sim/map/grid.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `interface Point { x: number; y: number }`, `interface Rect { x: number; y: number; w: number; h: number }`.
  - `Tile = { Grass: 0, Floor: 1, Road: 2, Wall: 3, Door: 4, Window: 5, Tree: 6 } as const` y `type Tile = (typeof Tile)[keyof typeof Tile]`.
  - `interface Grid { width: number; height: number; tiles: Tile[] }` (fila a fila: índice `y * width + x`).
  - `createGrid(width: number, height: number, fill: Tile): Grid`
  - `inBounds(g: Grid, x: number, y: number): boolean`
  - `getTile(g: Grid, x: number, y: number): Tile` — fuera de los límites devuelve `Tile.Wall`.
  - `setTile(g: Grid, x: number, y: number, t: Tile): void` — fuera de los límites lanza `Error`.
  - `isWalkable(g: Grid, x: number, y: number): boolean` — transitables: `Grass`, `Floor`, `Road`, `Door`.

- [ ] **Step 1: Tests que fallan**

```ts
test('una cuadrícula nueva está llena del tipo indicado', () => {
  const g = createGrid(4, 3, Tile.Grass);
  expect(g.tiles).toHaveLength(12);
  expect(getTile(g, 3, 2)).toBe(Tile.Grass);
});
test('setTile y getTile usan (x, y)', () => {
  const g = createGrid(4, 3, Tile.Grass);
  setTile(g, 1, 2, Tile.Wall);
  expect(getTile(g, 1, 2)).toBe(Tile.Wall);
  expect(getTile(g, 2, 1)).toBe(Tile.Grass);
});
test('fuera de los límites se comporta como muro', () => {
  const g = createGrid(4, 3, Tile.Grass);
  expect(getTile(g, -1, 0)).toBe(Tile.Wall);
  expect(isWalkable(g, 4, 0)).toBe(false);
});
test.each([
  [Tile.Grass, true], [Tile.Floor, true], [Tile.Road, true], [Tile.Door, true],
  [Tile.Wall, false], [Tile.Window, false], [Tile.Tree, false],
])('transitabilidad de la casilla %i = %s', (t, esperado) => {
  const g = createGrid(1, 1, t);
  expect(isWalkable(g, 0, 0)).toBe(esperado);
});
```

- [ ] **Step 2:** `npx vitest run src/sim/map` → FAIL.
- [ ] **Step 3:** Implementar `types.ts` y `grid.ts`.
- [ ] **Step 4:** `npx vitest run src/sim/map` → PASS.
- [ ] **Step 5:** Commit: `feat(sim): cuadrícula y tipos de casilla`.

---

### Task 4: Búsqueda de caminos (A*)

**Files:**
- Create: `src/sim/path/astar.ts`
- Test: `src/sim/path/astar.test.ts`

**Interfaces:**
- Consumes: `Grid`, `isWalkable` (Tarea 3), `Point`.
- Produces: `findPath(g: Grid, from: Point, to: Point): Point[] | null` — lista de casillas desde la siguiente a `from` hasta `to`, ambas incluidas en ese orden; `[]` si `from` y `to` son la misma casilla; `null` si no hay camino o `to` no es transitable. Movimiento en 8 direcciones (coste 1 en recto y √2 en diagonal); una diagonal solo se permite si las dos casillas rectas que la rodean son transitables (no se cortan esquinas de muros). Heurística octil. Desempate determinista: con igual coste, gana el nodo insertado antes.

- [ ] **Step 1: Tests que fallan**

```ts
// mapas en texto: '.' hierba, '#' muro
function grid(...rows: string[]): Grid { /* construye la cuadrícula con createGrid y setTile */ }

test('camino recto', () => {
  const g = grid('.....');
  expect(findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual([
    { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
  ]);
});
test('misma casilla devuelve camino vacío', () => {
  expect(findPath(grid('...'), { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
});
test('rodea un muro', () => {
  const g = grid('.#.', '.#.', '...');
  const p = findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })!;
  expect(p.at(-1)).toEqual({ x: 2, y: 0 });
  expect(p.every((c) => isWalkable(g, c.x, c.y))).toBe(true);
});
test('no corta esquinas en diagonal', () => {
  const g = grid('.#', '..');
  // de (0,0) a (1,1): la diagonal está prohibida porque (1,0) es muro
  expect(findPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }]);
});
test('destino encerrado devuelve null', () => {
  const g = grid('.....', '.###.', '.#.#.', '.###.', '.....');
  expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
});
test('destino no transitable devuelve null', () => {
  expect(findPath(grid('.#'), { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
});
test('cruza un mapa de 100x100 vacío en menos de 50 ms', () => {
  const g = createGrid(100, 100, Tile.Grass);
  const t0 = performance.now();
  expect(findPath(g, { x: 0, y: 0 }, { x: 99, y: 99 })).toHaveLength(99);
  expect(performance.now() - t0).toBeLessThan(50);
});
```

- [ ] **Step 2:** `npx vitest run src/sim/path` → FAIL.
- [ ] **Step 3:** Implementar `findPath` con un montículo binario como cola de prioridad (en el mismo archivo).
- [ ] **Step 4:** `npx vitest run src/sim/path` → PASS.
- [ ] **Step 5:** Commit: `feat(sim): búsqueda de caminos A*`.

---

### Task 5: Generación del mapa

**Files:**
- Create: `src/sim/map/generate.ts`
- Test: `src/sim/map/generate.test.ts`

**Interfaces:**
- Consumes: `RngState`, `nextInt`, `nextFloat` (Tarea 2); `Grid`, `Tile`, `createGrid`, `setTile`, `getTile` (Tarea 3); `findPath` (Tarea 4); `MAP_SIZE`, `HOUSE_COUNT_MIN/MAX`, `TREE_DENSITY`.
- Produces:
  - `interface Building { id: number; rect: Rect; door: Point }` — `rect` incluye los muros; `door` es la casilla de la puerta, situada en el muro.
  - `interface GeneratedMap { grid: Grid; base: Building; houses: Building[] }`
  - `generateMap(rng: RngState): GeneratedMap`

Algoritmo (decisiones fijas):
1. Todo hierba. Dos carreteras de 3 casillas de ancho que se cruzan en el centro (filas y columnas 49–51).
2. **Base:** edificio de 12×10 con su esquina inferior derecha en (46, 46), es decir, `rect = { x: 35, y: 37, w: 12, h: 10 }`, y la puerta en el centro del muro inferior, mirando a la carretera horizontal.
3. **Casas:** objetivo `nextInt(rng, 6, 10)`. Cada intento genera un rectángulo de 8–12 × 7–10 en una posición aleatoria, dentro de un margen de 3 casillas desde el borde del mapa. Se descarta si se acerca a menos de 2 casillas de otro edificio o de una carretera. Máximo 2000 intentos. La puerta se pone en el centro del muro que mira a la carretera más cercana.
4. **Cada edificio:** muros en el perímetro e interior de `Floor`. Un muro interior a lo ancho del lado más largo, por la mitad, con un hueco de 1 casilla de `Floor`. 1–2 ventanas por muro exterior, nunca en esquinas ni junto a la puerta.
5. **Árboles:** cada casilla de hierba se convierte en árbol con probabilidad `TREE_DENSITY`, salvo si está a 2 casillas o menos de un edificio.
6. **Validación:** si alguna puerta no es alcanzable desde la puerta de la base con `findPath`, o hay menos de 6 casas, se vuelve a generar desde el paso 1 con el mismo `rng`, que ya ha avanzado. Máximo 20 reintentos; después, lanza `Error`.

- [ ] **Step 1: Tests que fallan**

```ts
const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

test('misma semilla, mismo mapa', () => {
  expect(generateMap(createRng(123))).toEqual(generateMap(createRng(123)));
});
test.each(SEEDS)('semilla %i: entre 6 y 10 casas', (s) => {
  const n = generateMap(createRng(s)).houses.length;
  expect(n).toBeGreaterThanOrEqual(6);
  expect(n).toBeLessThanOrEqual(10);
});
test.each(SEEDS)('semilla %i: todas las puertas alcanzables desde la base', (s) => {
  const m = generateMap(createRng(s));
  for (const h of m.houses) expect(findPath(m.grid, m.base.door, h.door)).not.toBeNull();
});
test.each(SEEDS)('semilla %i: los edificios no se solapan ni pisan carreteras', (s) => {
  const m = generateMap(createRng(s));
  const all = [m.base, ...m.houses];
  for (const b of all) for (let y = b.rect.y; y < b.rect.y + b.rect.h; y++)
    for (let x = b.rect.x; x < b.rect.x + b.rect.w; x++)
      expect(getTile(m.grid, x, y)).not.toBe(Tile.Road);
  // ningún par de rects se solapa (helper overlaps(a, b) en el test)
});
test('la base está en el centro y su puerta es una puerta', () => {
  const m = generateMap(createRng(5));
  expect(m.base.rect).toEqual({ x: 35, y: 37, w: 12, h: 10 });
  expect(getTile(m.grid, m.base.door.x, m.base.door.y)).toBe(Tile.Door);
});
test('ningún árbol pegado a un edificio', () => { /* para la semilla 5, ninguna casilla Tree a ≤2 casillas de un rect */ });
```

- [ ] **Step 2:** `npx vitest run src/sim/map/generate.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `generateMap` según el algoritmo. Repartir en funciones privadas: `placeRoads`, `placeBuilding`, `placeHouses`, `placeTrees`, `validate`.
- [ ] **Step 4:** `npx vitest run src/sim/map` → PASS.
- [ ] **Step 5:** Commit: `feat(sim): generación del mapa con base, casas, carreteras y árboles`.

---

### Task 6: El mundo, los supervivientes e invariantes

**Files:**
- Create: `src/sim/world.ts`, `src/sim/names.ts`, `src/sim/invariants.ts`
- Test: `src/sim/world.test.ts`, `src/sim/invariants.test.ts`

**Interfaces:**
- Consumes: `generateMap`, `GeneratedMap`, `Building` (Tarea 5); `RngState` (Tarea 2).
- Produces:
  - `type BrainId = 'ai'`
  - `type Action = { type: 'idle'; ticksLeft: number } | { type: 'moveTo'; target: Point }`
  - `interface Survivor { id: number; name: string; pos: Point; brain: BrainId; action: Action; path: Point[] }` — `pos` en coordenadas continuas: el centro de la casilla (i, j) es (i + 0.5, j + 0.5).
  - `interface World { seed: number; tick: number; rng: RngState; grid: Grid; base: Building; houses: Building[]; survivors: Survivor[]; nextId: number }`
  - `createWorld(seed: number): World` — genera el mapa y coloca `SURVIVOR_COUNT` supervivientes en casillas `Floor` distintas del interior de la base, con nombres distintos de `names.ts` (lista de al menos 20 nombres españoles) y `action = { type: 'idle', ticksLeft: 0 }`.
  - `tileOf(p: Point): Point` — `{ x: Math.floor(p.x), y: Math.floor(p.y) }`.
  - `checkInvariants(w: World): string[]` — lista de problemas en español (vacía si todo está bien): coordenadas `NaN` o infinitas, superviviente fuera del mapa o en una casilla no transitable, ids repetidos, `tick` negativo o no entero.

- [ ] **Step 1: Tests que fallan**

```ts
// world.test.ts
test('crea 3 supervivientes en casillas Floor distintas dentro de la base', () => {
  const w = createWorld(10);
  expect(w.survivors).toHaveLength(3);
  const tiles = w.survivors.map((s) => tileOf(s.pos));
  expect(new Set(tiles.map((t) => `${t.x},${t.y}`)).size).toBe(3);
  for (const t of tiles) {
    expect(getTile(w.grid, t.x, t.y)).toBe(Tile.Floor);
    expect(contains(w.base.rect, t)).toBe(true);
  }
});
test('nombres distintos', () => {
  const n = createWorld(10).survivors.map((s) => s.name);
  expect(new Set(n).size).toBe(3);
});
test('el mundo sobrevive a JSON', () => {
  const w = createWorld(10);
  expect(JSON.parse(JSON.stringify(w))).toEqual(w);
});
test('mundo recién creado sin problemas, para 20 semillas', () => {
  for (let s = 1; s <= 20; s++) expect(checkInvariants(createWorld(s))).toEqual([]);
});

// invariants.test.ts
test('detecta NaN', () => {
  const w = createWorld(1); w.survivors[0]!.pos.x = NaN;
  expect(checkInvariants(w)).toHaveLength(1);
});
test('detecta un superviviente dentro de un muro', () => {
  const w = createWorld(1); w.survivors[0]!.pos = { x: w.base.rect.x + 0.5, y: w.base.rect.y + 0.5 };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});
test('detecta ids repetidos', () => {
  const w = createWorld(1); w.survivors[1]!.id = w.survivors[0]!.id;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2:** `npx vitest run src/sim` → FAIL.
- [ ] **Step 3:** Implementar `world.ts`, `names.ts` e `invariants.ts`. Los tipos `Survivor`, `Action`, `BrainId` y `World` van en `src/sim/types.ts`.
- [ ] **Step 4:** `npx vitest run src/sim` → PASS.
- [ ] **Step 5:** Commit: `feat(sim): mundo con supervivientes y comprobación de invariantes`.

---

### Task 7: Cerebros, movimiento y paso de simulación

**Files:**
- Create: `src/sim/brain.ts`, `src/sim/systems/decisions.ts`, `src/sim/systems/movement.ts`, `src/sim/step.ts`
- Test: `src/sim/brain.test.ts`, `src/sim/systems/movement.test.ts`, `src/sim/step.test.ts`

**Interfaces:**
- Consumes: `World`, `Survivor`, `Action`, `BrainId`, `tileOf` (Tarea 6); `findPath` (Tarea 4); `nextInt`, `pick` (Tarea 2).
- Produces:
  - `interface Brain { decide(s: Survivor, w: World): Action }`
  - `brains: Record<BrainId, Brain>` — en H1, `{ ai: AiBrain }`.
  - `AiBrain.decide`: elige una casilla `Floor` aleatoria del interior de la base y devuelve `{ type: 'moveTo', target }`.
  - `decisionsSystem(w: World): void` — para cada superviviente: si su acción es `idle` con `ticksLeft > 0`, la decrementa; si es `idle` con 0, pide una acción a su cerebro. Al recibir `moveTo`, calcula `path` con `findPath`; si es `null`, pasa a `{ type: 'idle', ticksLeft: NO_PATH_RETRY_TICKS }`.
  - `movementSystem(w: World): void` — mueve hacia el centro de `path[0]` a `SURVIVOR_WALK_SPEED` casillas por tick; al llegar al centro, la quita de `path`. Con `path` vacío y acción `moveTo`, pasa a `idle` con `ticksLeft = nextInt(rng, IDLE_TICKS_MIN, IDLE_TICKS_MAX)`.
  - `step(w: World): void` — ejecuta `decisionsSystem`, luego `movementSystem`, y después `w.tick++`. Este es el orden del spec §3 limitado a los sistemas que existen en H1.

- [ ] **Step 1: Tests que fallan**

```ts
// movement.test.ts
test('avanza SURVIVOR_WALK_SPEED casillas por tick hacia la siguiente casilla', () => {
  const w = mundoVacio(10, 10); // helper: cuadrícula de hierba con 1 superviviente en (0.5, 0.5)
  const s = w.survivors[0]!;
  s.action = { type: 'moveTo', target: { x: 3, y: 0 } };
  s.path = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
  movementSystem(w);
  expect(s.pos.x).toBeCloseTo(0.5 + SURVIVOR_WALK_SPEED);
  expect(s.pos.y).toBeCloseTo(0.5);
});
test('al llegar al destino pasa a idle entre IDLE_TICKS_MIN y IDLE_TICKS_MAX', () => {
  const w = mundoVacio(10, 10); const s = w.survivors[0]!;
  s.action = { type: 'moveTo', target: { x: 1, y: 0 } }; s.path = [{ x: 1, y: 0 }];
  for (let i = 0; i < 20; i++) movementSystem(w);
  expect(tileOf(s.pos)).toEqual({ x: 1, y: 0 });
  expect(s.action.type).toBe('idle');
});

// brain.test.ts
test('AiBrain siempre elige una casilla Floor dentro de la base', () => {
  const w = createWorld(3);
  for (let i = 0; i < 100; i++) {
    const a = brains.ai.decide(w.survivors[0]!, w);
    expect(a.type).toBe('moveTo');
    if (a.type === 'moveTo') {
      expect(getTile(w.grid, a.target.x, a.target.y)).toBe(Tile.Floor);
      expect(contains(w.base.rect, a.target)).toBe(true);
    }
  }
});
test('sin camino posible espera NO_PATH_RETRY_TICKS y no rompe nada', () => {
  const w = createWorld(3); const s = w.survivors[0]!;
  // encerrar al superviviente: muros en sus 8 vecinas
  encerrar(w, tileOf(s.pos));
  for (let i = 0; i < 100; i++) step(w);
  expect(s.action.type).toBe('idle');
  expect(checkInvariants(w)).toEqual([]);
});

// step.test.ts
test('step incrementa el tick', () => { const w = createWorld(1); step(w); expect(w.tick).toBe(1); });
test('determinista: misma semilla, mismo mundo tras 2000 ticks', () => {
  const a = createWorld(77), b = createWorld(77);
  for (let i = 0; i < 2000; i++) { step(a); step(b); }
  expect(a).toEqual(b);
});
test('tras 2000 ticks alguien se ha movido y no hay problemas', () => {
  const w = createWorld(77); const antes = w.survivors.map((s) => ({ ...s.pos }));
  for (let i = 0; i < 2000; i++) step(w);
  expect(w.survivors.some((s, i) => s.pos.x !== antes[i]!.x || s.pos.y !== antes[i]!.y)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});
```

- [ ] **Step 2:** `npx vitest run src/sim` → FAIL.
- [ ] **Step 3:** Implementar `brain.ts`, `decisions.ts`, `movement.ts` y `step.ts` con las firmas de arriba.
- [ ] **Step 4:** `npx vitest run src/sim` → PASS.
- [ ] **Step 5:** Commit: `feat(sim): cerebros intercambiables, movimiento y paso de simulación`.

---

### Task 8: Control del tiempo y semilla de la URL

**Files:**
- Create: `src/game/timeController.ts`, `src/game/seed.ts`
- Test: `src/game/timeController.test.ts`, `src/game/seed.test.ts`

**Interfaces:**
- Produces:
  - `type Speed = 0 | 1 | 2 | 3`
  - `interface TimeController { readonly speed: Speed; setSpeed(s: Speed): void; togglePause(): void; advance(dtMs: number): number }`
  - `createTimeController(): TimeController` — empieza a velocidad 1. `togglePause` alterna entre 0 y la última velocidad distinta de 0. `advance` devuelve cuántos ticks hay que ejecutar: suma `min(dtMs, MAX_FRAME_MS) * speed` a un acumulador y saca un tick por cada `MS_PER_TICK`.
  - Constantes en `timeController.ts`: `MS_PER_TICK = 100` (a x1), `MAX_FRAME_MS = 250`.
  - `parseSeed(search: string, fallback: () => number): number` — si `search` contiene `seed=` seguido de un entero decimal en [0, 4294967295], lo devuelve; si no, devuelve `fallback()`.
  - `randomSeed(): number` — `Math.floor(Math.random() * 2 ** 32)`. Permitido aquí porque `src/game/` está fuera de `src/sim/`.

- [ ] **Step 1: Tests que fallan**

```ts
// timeController.test.ts
test('a x1, 100 ms son 1 tick', () => { const t = createTimeController(); expect(t.advance(100)).toBe(1); });
test('a x3, 100 ms son 3 ticks', () => { const t = createTimeController(); t.setSpeed(3); expect(t.advance(100)).toBe(3); });
test('acumula fracciones', () => {
  const t = createTimeController();
  expect(t.advance(60)).toBe(0);
  expect(t.advance(60)).toBe(1);
});
test('en pausa no avanza', () => { const t = createTimeController(); t.setSpeed(0); expect(t.advance(1000)).toBe(0); });
test('togglePause recuerda la última velocidad', () => {
  const t = createTimeController(); t.setSpeed(2); t.togglePause(); expect(t.speed).toBe(0);
  t.togglePause(); expect(t.speed).toBe(2);
});
test('un dt enorme (pestaña en segundo plano) se limita', () => {
  const t = createTimeController(); t.setSpeed(3);
  expect(t.advance(5 * 60_000)).toBe(7); // floor(250 * 3 / 100)
});

// seed.test.ts
const fb = () => 999;
test.each([
  ['?seed=12345', 12345], ['?seed=0', 0], ['?seed=4294967295', 4294967295],
  ['', 999], ['?seed=', 999], ['?seed=abc', 999], ['?seed=-5', 999],
  ['?seed=1.5', 999], ['?seed=4294967296', 999], ['?seed=1e5', 999], ['?otro=1', 999],
])('parseSeed(%s) = %i', (q, esperado) => expect(parseSeed(q, fb)).toBe(esperado));
```

- [ ] **Step 2:** `npx vitest run src/game` → FAIL.
- [ ] **Step 3:** Implementar `timeController.ts` y `seed.ts` (con `URLSearchParams` y la expresión regular `/^\d+$/`).
- [ ] **Step 4:** `npx vitest run src/game` → PASS.
- [ ] **Step 5:** Commit: `feat(game): control de velocidad y semilla desde la URL`.

---

### Task 9: Dibujado con Phaser, cámara y barra superior

**Files:**
- Create: `src/render/GameScene.ts`, `src/render/colors.ts`, `src/ui/hud.ts`, `src/ui/hud.css`, `src/i18n/es.ts`
- Modify: `src/main.ts`, `index.html`
- Test: `src/ui/hud.test.ts`

**Interfaces:**
- Consumes: `createWorld`, `step`, `World` (Tareas 6–7); `gameTime` (Tarea 2); `createTimeController`, `parseSeed`, `randomSeed` (Tarea 8).
- Produces:
  - `es.ts`: `export const es = { dayTime: (d: number, h: number, m: number) => string /* "Día 1, 08:00" */, seed: (s: number) => string /* "Semilla: 123" */, pause: 'Pausa', speed: (n: number) => string /* "x2" */ }`.
  - `hud.ts`: `formatDayTime(t: GameTime): string` y `mountHud(root: HTMLElement, opts: { seed: number; time: TimeController }): { update(t: GameTime): void }`. Pinta la hora, cuatro botones (`data-speed="0|1|2|3"`, el activo con la clase `active`) y la semilla. El elemento de la hora tiene `data-testid="hud-time"` y el de la semilla `data-testid="hud-seed"`.
  - `GameScene` (Phaser): recibe `{ world, time }` por `init`. En `create()` dibuja el mapa una vez en un `Graphics` (16 px por casilla, colores de `colors.ts`). En `update(_, dtMs)` ejecuta `time.advance(dtMs)` veces `step(world)` y redibuja los supervivientes como círculos de radio 5 px en una segunda capa `Graphics`.
  - Cámara: WASD o flechas para moverse (600 px/s divididos por el zoom); arrastrar con el botón derecho o el central; rueda para el zoom entre 0.5 y 4; límites de la cámara = tamaño del mapa. Al empezar, centrada en la base.
  - Teclado (en `main.ts`, sobre `window`): Espacio → `togglePause`; `1`/`2`/`3` → `setSpeed`.

- [ ] **Step 1: Tests que fallan** (`hud.test.ts`, entorno `jsdom`: añadir `jsdom` exacto a devDependencies y `// @vitest-environment jsdom` en el archivo)

```ts
test('formatDayTime rellena con ceros', () => {
  expect(formatDayTime({ day: 3, hour: 7, minute: 5 })).toBe('Día 3, 07:05');
});
test('el HUD muestra la semilla y marca la velocidad activa', () => {
  const root = document.createElement('div'); const time = createTimeController();
  mountHud(root, { seed: 42, time });
  expect(root.querySelector('[data-testid="hud-seed"]')!.textContent).toBe('Semilla: 42');
  (root.querySelector('[data-speed="3"]') as HTMLButtonElement).click();
  expect(time.speed).toBe(3);
  expect(root.querySelector('[data-speed="3"]')!.classList.contains('active')).toBe(true);
});
test('update cambia la hora', () => {
  const root = document.createElement('div');
  const hud = mountHud(root, { seed: 1, time: createTimeController() });
  hud.update({ day: 2, hour: 13, minute: 30 });
  expect(root.querySelector('[data-testid="hud-time"]')!.textContent).toBe('Día 2, 13:30');
});
```

- [ ] **Step 2:** `npx vitest run src/ui` → FAIL.
- [ ] **Step 3:** Implementar `es.ts`, `hud.ts` y `hud.css` (barra fija arriba, fondo oscuro semitransparente, `pointer-events` solo en los botones). Implementar `colors.ts` con un color por casilla (hierba verde apagado, suelo marrón claro, carretera gris, muro gris oscuro, puerta marrón, ventana azul claro, árbol verde oscuro) y para los supervivientes (amarillo).
- [ ] **Step 4:** `npx vitest run src/ui` → PASS.
- [ ] **Step 5:** Implementar `GameScene.ts` y reescribir `main.ts`: `seed = parseSeed(location.search, randomSeed)`, crear el mundo, montar el HUD, arrancar `new Phaser.Game({ type: Phaser.AUTO, parent: 'game', scale: { mode: Phaser.Scale.RESIZE }, scene: GameScene })` pasando `{ world, time }`, desactivar el menú contextual del canvas y llamar a `hud.update(gameTime(world.tick))` en cada fotograma.
- [ ] **Step 6:** `npm run build && npm run lint && npm test` → todo pasa. Arrancar `npm run preview` y hacer una captura con Playwright: se ve el mapa con la base y casas, y 3 puntos amarillos. Guardar la captura en el scratchpad para enseñársela al usuario.
- [ ] **Step 7:** Commit: `feat: dibujado del mapa con Phaser, cámara y barra superior`.

---

### Task 10: Test del juego en el navegador

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json` (script `e2e: playwright test`), `vite.config.ts` (excluir `e2e/` de Vitest si hiciera falta)

**Interfaces:**
- Consumes: `data-testid` y `data-speed` del HUD (Tarea 9).

- [ ] **Step 1:** `playwright.config.ts`: `webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173 }`, `use.baseURL: 'http://localhost:4173'`, un único proyecto Chromium con `launchOptions.executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH` (si no está definida, se usa el Chromium de Playwright).
- [ ] **Step 2: Test**

```ts
test('el juego carga sin errores y responde a la velocidad', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/?seed=4242');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('hud-seed')).toHaveText('Semilla: 4242');
  const t0 = await page.getByTestId('hud-time').textContent();
  await page.locator('[data-speed="3"]').click();
  await expect(page.getByTestId('hud-time')).not.toHaveText(t0!, { timeout: 5000 });
  await page.keyboard.press('Space');
  await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);
  const t1 = await page.getByTestId('hud-time').textContent();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('hud-time')).toHaveText(t1!);
  expect(errores).toEqual([]);
});
```

- [ ] **Step 3:** `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` → PASS.
- [ ] **Step 4:** Commit: `test(e2e): carga del juego, velocidad y pausa`.

---

### Task 11: Partida larga automática y publicación

**Files:**
- Create: `soak/soak.test.ts`, `vitest.soak.config.ts`, `.github/workflows/deploy.yml`
- Modify: `package.json` (script `soak: vitest run --config vitest.soak.config.ts`), `README.md`

**Interfaces:**
- Consumes: `createWorld`, `step`, `checkInvariants` (Tareas 6–7); `TICKS_PER_DAY` (Tarea 2).

- [ ] **Step 1: Test**

```ts
const DAYS = Number(process.env.SOAK_DAYS ?? 30);
test.each([1, 2, 3])(`semilla %i: ${DAYS} días sin romper invariantes`, (seed) => {
  const w = createWorld(seed);
  for (let i = 0; i < DAYS * TICKS_PER_DAY; i++) {
    step(w);
    if (i % 600 === 0) expect(checkInvariants(w), `tick ${w.tick}`).toEqual([]);
  }
  expect(checkInvariants(w)).toEqual([]);
}, 120_000);
```

`vitest.soak.config.ts` incluye solo `soak/**/*.test.ts`.

- [ ] **Step 2:** `npm run soak` → PASS, en menos de 2 minutos.
- [ ] **Step 3:** `.github/workflows/deploy.yml`: en `push` a `main` y en `workflow_dispatch`; un trabajo `build` (`actions/checkout@v4`, `actions/setup-node@v4` con Node 22 y caché npm, `npm ci`, `npm run lint`, `npm test`, `npm run build`, `actions/upload-pages-artifact@v3` con `path: dist`) y un trabajo `deploy` (`actions/deploy-pages@v4`, con `permissions: pages: write, id-token: write` y `environment: github-pages`). En pull requests solo se ejecuta `build` sin subir el artefacto.
- [ ] **Step 4:** Documentar en `README.md`: `npm run soak`, `npm run e2e`, y que para publicar hay que activar en GitHub **Settings → Pages → Source: GitHub Actions**. El enlace será `https://r3dolaf.github.io/rimzomboid/`.
- [ ] **Step 5:** Commit: `ci: partida larga automática y publicación en GitHub Pages`.
