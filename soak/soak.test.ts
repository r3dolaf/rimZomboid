// Partida larga sin pantalla: solo IA, a toda velocidad. Comprueba que nada se rompe.
// Las de antes de H4b, sin zombis (prueban lo suyo); las de H4b, al final, con zombis.
import { describe, expect, test } from 'vitest';
import { FAINT_UNTIL, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/sim/balance';
import { gameTime } from '../src/sim/clock';
import { checkInvariants } from '../src/sim/invariants';
import { step } from '../src/sim/step';
import { isEmpty } from '../src/sim/items';
import { hasCargo } from '../src/sim/jobs/medical';
import { issue } from '../src/sim/orders';
import { createRng, nextInt } from '../src/sim/rng';
import { canPlace } from '../src/sim/build';
import { contains } from '../src/sim/geom';
import { WEAPONS } from '../src/sim/jobs/weapons';
import {
  Tile,
  type BuildKind,
  type Decision,
  type EventId,
  type NarratorStyle,
  type Survivor,
  type World,
  type ZombieLevel,
} from '../src/sim/types';
import { regionOf } from '../src/sim/path/astar';
import { withoutZombies } from '../src/sim/testing/fixtures';
import { createWorld, tileOf } from '../src/sim/world';
import { targetContainerId } from '../src/sim/work';

const DAYS = Number(process.env.SOAK_DAYS || 30);

/** Descansando o derribado (H5): no moverse en todo el día no es estar bloqueado. */
const lying = (s: Survivor) => s.action.type === 'rest' || s.action.type === 'downed';

/** Una respuesta al azar (la fiebre, H5, tiene tres opciones). */
const answer = (r: ReturnType<typeof createRng>, d: Decision) =>
  nextInt(r, 0, d.kind === 'fever' ? 2 : 1) as 0 | 1 | 2;

test('SOAK_DAYS es un número de días válido', () => {
  expect(Number.isInteger(DAYS) && DAYS > 0).toBe(true);
});

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días sin romper invariantes ni bloquearse`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
    for (let day = 1; day <= DAYS; day++) {
      const present = new Set(w.survivors.map((s) => s.id));
      const moved = new Set<number>();
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
        step(w);
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        for (const s of w.survivors) {
          const b = before.get(s.id);
          if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
        }
      }
      // H2: con ~10 días de comida, el almacén está vacío antes del día 15
      if (day === 15) expect(w.storage.items.food, 'comida el día 15').toBe(0);
      // sin bloqueos: cada superviviente se ha movido en algún momento del día (o ha estado
      // acostado: descansando o derribado, H5)
      for (const s of w.survivors)
        if (present.has(s.id))
          expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
    }
    expect(w.tick).toBe(DAYS * TICKS_PER_DAY);
  },
  120_000,
);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días con todas las casas marcadas — el mapa se vacía (salvo lo atrancado sin palanca) sin romper nada`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
    // Sin narrador: un alijo de última hora dejaría comida en un mueble sin marcar.
    w.narrator.nextEventAt = Number.MAX_SAFE_INTEGER;
    w.narrator.phaseEndsAt = Number.MAX_SAFE_INTEGER; // si no, el cambio de fase lo adelanta
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    for (let i = 0; i < DAYS * TICKS_PER_DAY; i++) {
      step(w);
      const problems = checkInvariants(w);
      if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
      const targets = w.survivors.map(targetContainerId).filter((id) => id !== null);
      if (new Set(targets).size !== targets.length)
        expect(targets, `tick ${w.tick}`).toEqual('únicos');
    }
    // H4d: una casa con la puerta aún atrancada no se puede saquear (nadie ha tenido palanca).
    const locked = (h: (typeof w.houses)[number]) =>
      w.grid.tiles[h.door.y * w.grid.width + h.door.x] === Tile.LockedDoor;
    const shut = new Set(w.houses.filter(locked).map((h) => h.id));
    if (shut.size > 0) expect(allCrowbars(w), 'atrancadas habiendo palanca').toBe(0);
    for (const c of w.containers)
      if (!shut.has(c.houseId)) expect(isEmpty(c.items), `contenedor ${c.id}`).toBe(true);
    // (salvo sus 2 vendas, H5)
    for (const s of w.survivors) expect(hasCargo(s), s.name).toBe(false);
  },
  120_000,
);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días aceptando a todos los desconocidos — relaciones sanas y sin bloqueos`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    for (let day = 1; day <= DAYS; day++) {
      const present = new Set(w.survivors.map((s) => s.id));
      const moved = new Set<number>();
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const d = w.decisions.find((x) => x.kind === 'stranger');
        if (d && w.orders.length === 0) issue(w, { type: 'decide', decisionId: d.id, option: 0 });
        const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
        step(w);
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        for (const s of w.survivors) {
          const b = before.get(s.id);
          if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
        }
      }
      for (const s of w.survivors)
        if (present.has(s.id))
          expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
    }
    if (DAYS >= 10) expect(w.survivors.length, 'han llegado y se han unido').toBeGreaterThan(3);
  },
  240_000,
);

/** ¿Hay algún árbol marcado al lado de una casilla a la que se llega desde el almacén? */
function markedTreeReachable(w: World): boolean {
  const st = w.storage.tiles[0]!;
  const region = regionOf(w.grid, st.x, st.y);
  return w.chopMarks.some((i) => {
    const [x, y] = [i % w.grid.width, Math.floor(i / w.grid.width)];
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => regionOf(w.grid, x + dx!, y + dy!) === region);
  });
}

/** Palancas que tiene la colonia (almacén, carga o mano) o hay en el suelo. */
function allCrowbars(w: World): number {
  return (
    w.storage.items.crowbar +
    w.piles.reduce((n, p) => n + p.items.crowbar, 0) +
    w.survivors.reduce((n, s) => n + s.carrying.crowbar + (s.equipped === 'crowbar' ? 1 : 0), 0)
  );
}

const STYLES: NarratorStyle[] = ['calm', 'balanced', 'chaotic'];
const eventsBy: Record<NarratorStyle, number> = { calm: 0, balanced: 0, chaotic: 0 };

describe.each(STYLES)('narrador %s', (style) => {
  test.each([1, 2, 3])(
    `semilla %i: ${DAYS} días saqueando y contestando al azar — sin romper nada ni bloquearse`,
    (seed) => {
      const w = withoutZombies(createWorld(seed, style));
      for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
      const answers = createRng(seed * 77);
      let events = 0;
      let tension = false;
      let edge = false;
      let negative = false;
      for (let day = 1; day <= DAYS; day++) {
        const present = new Set(w.survivors.map((s) => s.id));
        const moved = new Set<number>();
        for (let i = 0; i < TICKS_PER_DAY; i++) {
          const d = w.decisions[0];
          if (d && w.orders.length === 0)
            issue(w, { type: 'decide', decisionId: d.id, option: answer(answers, d) });
          const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
          step(w);
          const problems = checkInvariants(w);
          if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
          for (const id of Object.keys(w.narrator.lastAt) as EventId[])
            if (w.narrator.lastAt[id] === w.tick - 1) events++;
          if (w.narrator.phase === 'tension') tension = true;
          for (const s of w.survivors) {
            const b = before.get(s.id);
            if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
            if (s.needs.mood < 25) edge = true;
            if (Object.values(s.opinions).some((v) => v < 0)) negative = true;
          }
        }
        for (const s of w.survivors)
          if (present.has(s.id))
            expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
      }
      eventsBy[style] += events;
      if (style === 'balanced' && DAYS >= 30) {
        expect(events, 'sucesos en el Equilibrado').toBeGreaterThanOrEqual(8);
        expect(tension, 'alguna fase de tensión').toBe(true);
        expect(edge, 'alguien al límite').toBe(true);
        expect(negative, 'alguna opinión negativa').toBe(true);
      }
    },
    240_000,
  );
});

test('en total, el Tranquilo saca menos sucesos que el Caótico', () => {
  if (DAYS < 30) return;
  expect(eventsBy.calm).toBeLessThan(eventsBy.chaotic);
});

const BUILDS: BuildKind[] = [
  'bed',
  'table',
  'campfire',
  'woodWall',
  'woodDoor',
  'board',
  'unboard',
];

/** Hachas en todo el mundo: nunca se crean ni se pierden (spec H4a, Review Focus 2). */
function axes(w: World): number {
  const people = [...w.survivors, ...(w.stranger?.survivors ?? [])];
  return (
    w.storage.items.axe +
    w.containers.reduce((n, c) => n + c.items.axe, 0) +
    w.piles.reduce((n, p) => n + p.items.axe, 0) +
    people.reduce((n, s) => n + s.carrying.axe + (s.equipped === 'axe' ? 1 : 0), 0)
  );
}

/**
 * Un día de partida contestando las decisiones al azar; comprueba las invariantes en cada tick y
 * que todos los que estaban se han movido (salvo a quien `excused` disculpe).
 */
function playDay(
  w: World,
  r: ReturnType<typeof createRng>,
  day: number,
  excused: (s: Survivor) => boolean = () => false,
): void {
  const present = new Set(w.survivors.map((s) => s.id));
  const moved = new Set<number>();
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    const d = w.decisions[0];
    if (d && !w.orders.some((o) => o.type === 'decide'))
      issue(w, { type: 'decide', decisionId: d.id, option: answer(r, d) });
    const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
    step(w);
    const problems = checkInvariants(w);
    if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
    for (const s of w.survivors) {
      const b = before.get(s.id);
      if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
    }
  }
  // Quien ha quedado encerrado (sin camino al almacén, ver la hoja de ruta) tampoco.
  const store = w.storage.tiles[0]!;
  const cut = (s: Survivor) =>
    regionOf(w.grid, Math.floor(s.pos.x), Math.floor(s.pos.y)) !==
    regionOf(w.grid, store.x, store.y);
  for (const s of w.survivors)
    if (present.has(s.id) && !excused(s) && !cut(s))
      expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
}

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días talando y construyendo al azar — la madera cuadra y nadie se bloquea`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    const r = createRng(seed * 131);
    const cx = w.base.rect.x + Math.floor(w.base.rect.w / 2);
    const cy = w.base.rect.y + Math.floor(w.base.rect.h / 2);
    const axesAtStart = axes(w);
    const levelsAtStart = levels(w);
    let choppedHalf = 0;
    for (let day = 1; day <= DAYS; day++) {
      // Cada mañana: marcar algunos árboles vistos y poner unos planos cerca de la base.
      for (let k = 0; k < 40; k++) {
        const x = cx + nextInt(r, -14, 14);
        const y = cy + nextInt(r, -14, 14);
        if (w.seen[y * w.grid.width + x] === 1 && w.grid.tiles[y * w.grid.width + x] === Tile.Tree)
          issue(w, { type: 'markTree', x, y, on: true });
      }
      // Y tapiar (o destapiar) una ventana de las que se ven cerca.
      const windows: { x: number; y: number }[] = [];
      for (let y = cy - 12; y <= cy + 12; y++)
        for (let x = cx - 12; x <= cx + 12; x++) {
          const t = w.grid.tiles[y * w.grid.width + x];
          if (t === Tile.Window || t === Tile.BoardedWindow) windows.push({ x, y });
        }
      if (windows.length > 0) {
        const win = windows[nextInt(r, 0, windows.length - 1)]!;
        for (const kind of ['board', 'unboard'] as const)
          if (canPlace(w, kind, win)) issue(w, { type: 'placeBlueprint', kind, ...win });
      }
      for (let k = 0; k < 60; k++) {
        const kind = BUILDS[nextInt(r, 0, BUILDS.length - 1)]!;
        const p = { x: cx + nextInt(r, -10, 10), y: cy + nextInt(r, -10, 10) };
        if (canPlace(w, kind, p)) issue(w, { type: 'placeBlueprint', kind, ...p });
        if (w.orders.length >= 3) break;
      }
      playDay(w, r, day);
      expect(axes(w), `día ${day}: hachas`).toBe(axesAtStart);
      if (day === Math.floor(DAYS / 2)) choppedHalf = w.woodLog.chopped;
    }
    // H4d: se sigue talando (antes, el machete y la palanca le quitaban el hacha a quien tala).
    // (H5: si los muros al azar han dejado fuera todos los árboles marcados, no se puede.)
    if (DAYS >= 10 && markedTreeReachable(w))
      expect(w.woodLog.chopped, 'se tala también en la segunda mitad').toBeGreaterThan(choppedHalf);
    if (DAYS >= 10) {
      expect(w.woodLog.chopped, 'se ha talado').toBeGreaterThan(0);
      expect(w.woodLog.spent, 'se ha construido').toBeGreaterThan(0);
      expect(
        w.grid.tiles.includes(Tile.BoardedWindow) || w.woodLog.recovered > 0,
        'se ha tapiado',
      ).toBe(true);
      // H4c: practicando se mejora, y los fallos al construir no se comen la madera.
      expect(levels(w), 'las habilidades han subido').toBeGreaterThan(levelsAtStart);
      expect(w.woodLog.wasted, 'madera perdida al fallar').toBeLessThan(w.woodLog.spent / 2);
    }
  },
  240_000,
);

/** La suma de los niveles de todas las habilidades de los colonos de ahora. */
function levels(w: World): number {
  return w.survivors.reduce(
    (n, s) => n + Object.values(s.skills).reduce((m, k) => m + k.level, 0),
    0,
  );
}

const WALL_DAYS = Math.min(DAYS, 10);

test.each([1, 2, 3])(
  `semilla %i: ${WALL_DAYS} días levantando muros en línea por la base y alrededor — nadie los atraviesa ni se queda dentro`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
    w.seen.fill(1);
    w.storage.items.wood += 300; // madera de sobra: que se construya deprisa
    w.woodLog.start += 300;
    const r = createRng(seed * 977);
    const rect = w.base.rect;
    for (let day = 1; day <= WALL_DAYS; day++) {
      // Cada mañana, dos líneas de muro (con una puerta en medio): una por dentro de la base y
      // otra justo fuera, en horizontal o en vertical.
      for (const inside of [true, false]) {
        const horizontal = nextInt(r, 0, 1) === 0;
        const len = nextInt(r, 5, 9);
        const x0 = inside ? nextInt(r, rect.x + 1, rect.x + rect.w - 2) : rect.x - 2;
        const y0 = inside ? nextInt(r, rect.y + 1, rect.y + rect.h - 2) : rect.y - 2;
        for (let i = 0; i < len; i++) {
          const p = horizontal ? { x: x0 + i, y: y0 } : { x: x0, y: y0 + i };
          const kind = i === Math.floor(len / 2) ? 'woodDoor' : 'woodWall';
          if (canPlace(w, kind, p)) issue(w, { type: 'placeBlueprint', kind, ...p });
        }
      }
      // Encerrarse es decisión del jugador: quien ha quedado separado del almacén (sin poder ir a
      // comer) puede pasarse el día esperando un camino.
      const store = w.storage.tiles[0]!;
      const cutOff = (s: Survivor) => {
        const t = tileOf(s.pos);
        return regionOf(w.grid, t.x, t.y) !== regionOf(w.grid, store.x, store.y);
      };
      playDay(w, r, day, cutOff);
    }
    expect(w.grid.tiles.filter((t) => t === Tile.WoodWall).length, 'muros').toBeGreaterThan(10);
  },
  240_000,
);

/** Armas en todo el mundo: solo aparecen en los cuerpos y desaparecen al pudrirse (H4d). */
function allWeapons(w: World): number {
  const kinds = WEAPONS; // con la palanca y el machete (H4d)
  const people = [...w.survivors, ...(w.stranger?.survivors ?? [])];
  let n = 0;
  for (const k of kinds) {
    n += w.storage.items[k];
    n += w.containers.reduce((a, c) => a + c.items[k], 0);
    n += w.piles.reduce((a, p) => a + p.items[k], 0);
    n += people.reduce((a, s) => a + s.carrying[k] + (s.equipped === k ? 1 : 0), 0);
  }
  return n;
}

// H4b: un juego por narrador, cada uno con una opción de Zombis (los 3 narradores y las 3 opciones).
const ZOMBIE_GAMES: [NarratorStyle, ZombieLevel][] = [
  ['calm', 'few'],
  ['balanced', 'normal'],
  ['chaotic', 'many'],
];
const zombieTotals = {
  kills: 0,
  downs: 0,
  broken: 0,
  crafted: 0,
  corpses: 0,
  // H4e
  sieges: 0,
  wanderers: 0,
  healed: 0,
  strangersFled: 0,
  // H5: muertos y hasta qué día se llega en cada partida
  dead: 0,
  survived: [] as number[],
  // H5b: ropa rota por golpes parados, cambios de ropa, costura y lavado
  torn: 0,
  dressed: 0,
  sewn: 0,
  washed: 0,
};

/**
 * H4e: cada día, a mediodía, el jugador pone a dos en modo combate, los manda a la puerta, ataca
 * al zombi que vean y, una hora después, lo quita.
 */
function drill(w: World, inDay: number): void {
  const ids = w.survivors.slice(0, 2).map((s) => s.id);
  const noon = TICKS_PER_DAY / 6; // 12:00 (se empieza a las 8)
  if (inDay === noon) {
    issue(w, { type: 'draft', survivorIds: ids, on: true });
    const d = w.base.door;
    issue(w, { type: 'draftMove', survivorIds: ids, x: d.x, y: d.y });
  } else if (inDay === noon + 150) {
    const z = w.zombies.find((x) =>
      w.survivors.some((s) => (s.pos.x - x.pos.x) ** 2 + (s.pos.y - x.pos.y) ** 2 < 64),
    );
    if (z) issue(w, { type: 'draftAttack', survivorIds: ids, zombieId: z.id });
  } else if (inDay === noon + 300) {
    issue(w, { type: 'draft', survivorIds: ids, on: false });
  }
}

/**
 * H4d, desde el primer día: una mesa (con su madera), pedidos de vendas (hasta 10), unas cortinas
 * y deshacer otras, y las cortinas de la base corridas.
 */
function clothSetup(w: World): void {
  w.storage.items.wood += 4;
  w.woodLog.start += 4;
  const r = w.base.rect;
  const spot = [];
  for (let y = r.y + 1; y < r.y + r.h - 1; y++)
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) spot.push({ x, y });
  const table = spot.find((p) => canPlace(w, 'table', p));
  if (table) issue(w, { type: 'placeBlueprint', kind: 'table', ...table });
  const id = w.nextBillId;
  for (const recipe of ['bandages', 'curtains', 'unpick'] as const)
    issue(w, { type: 'addBill', recipe });
  issue(w, { type: 'setBill', billId: id, target: 10 });
  issue(w, { type: 'setBill', billId: id + 1, mode: 'count', target: 2 });
  issue(w, { type: 'setBill', billId: id + 2, mode: 'count', target: 1 });
  // H5b: remendar, reforzar, descoser y lavar ("siempre que haya") y un barreño fuera de la base,
  // junto a la puerta (con su madera).
  for (const recipe of ['mend', 'pad', 'unpickGarment', 'wash'] as const)
    issue(w, { type: 'addBill', recipe });
  w.storage.items.wood += 4;
  w.woodLog.start += 4;
  const d = w.base.door;
  const outside = [
    { x: d.x + 2, y: d.y + 2 },
    { x: d.x - 2, y: d.y + 2 },
    { x: d.x + 2, y: d.y - 2 },
    { x: d.x - 2, y: d.y - 2 },
  ].find((p) => !contains(r, p) && canPlace(w, 'tub', p));
  if (outside) issue(w, { type: 'placeBlueprint', kind: 'tub', ...outside });
  for (const i of w.curtains) {
    const p = { x: i % w.grid.width, y: Math.floor(i / w.grid.width) };
    if (contains(r, p) && canPlace(w, 'curtains', p))
      issue(w, { type: 'placeBlueprint', kind: 'curtains', ...p });
  }
}

/** Cada mañana, marcar los cuerpos que se ven (H4d). */
function markCorpses(w: World): void {
  for (const c of w.containers)
    if (c.kind === 'corpse' && w.seen[c.pos.y * w.grid.width + c.pos.x] === 1 && !c.designated)
      issue(w, { type: 'designateContainer', containerId: c.id, on: true });
}

describe.each(ZOMBIE_GAMES)('zombis: narrador %s, %s', (style, level) => {
  test(`${DAYS} días saqueando con zombis, fabricando, con cortinas y cuerpos — sin romper nada, sin bloqueos, las armas cuadran y cada tick va rápido`, () => {
    const w = createWorld(1, style, level);
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    clothSetup(w);
    const r = createRng(17);
    const weapons = allWeapons(w);
    const levelsAtStart = levels(w);
    const wasDressing = new Map<number, boolean>();
    let ms = 0;
    for (let day = 1; day <= DAYS; day++) {
      const present = new Set(w.survivors.map((s) => s.id));
      const moved = new Set<number>();
      const down = new Map<number, number>();
      markCorpses(w);
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const d = w.decisions[0];
        if (d && !w.orders.some((o) => o.type === 'decide'))
          issue(w, { type: 'decide', decisionId: d.id, option: answer(r, d) });
        const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
        const last = w.log.at(-1);
        drill(w, i);
        const t0 = performance.now();
        step(w);
        ms += performance.now() - t0;
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        for (const e of w.log.slice(last ? w.log.lastIndexOf(last) + 1 : 0)) {
          if (e.kind === 'zombieKilled') zombieTotals.kills++;
          if (e.kind === 'downed') zombieTotals.downs++;
          if (e.kind === 'broken') zombieTotals.broken++;
          if (e.kind === 'crafted') zombieTotals.crafted++;
          if (e.kind === 'corpseSearched') zombieTotals.corpses++;
          if (e.kind === 'siegeArrived') zombieTotals.sieges++;
          if (e.kind === 'wanderersSighted') zombieTotals.wanderers++;
          if (e.kind === 'rescued' || e.kind === 'bandaged') zombieTotals.healed++;
          if (e.kind === 'strangersFled') zombieTotals.strangersFled++;
          if (e.kind === 'clothesTorn') zombieTotals.torn++;
          if (e.kind === 'crafted' && e.recipe === 'wash') zombieTotals.washed++;
          else if (e.kind === 'crafted' && e.garment) zombieTotals.sewn++;
        }
        for (const s of w.survivors) {
          const b = before.get(s.id);
          if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
          if (s.action.type === 'downed') down.set(s.id, (down.get(s.id) ?? 0) + 1);
          if (s.action.type === 'dress' && wasDressing.get(s.id) !== true) zombieTotals.dressed++;
          wasDressing.set(s.id, s.action.type === 'dress');
        }
      }
      const store = w.storage.tiles[0]!;
      for (const s of w.survivors) {
        if (!present.has(s.id)) continue;
        // Nadie se pasa el día entero en el suelo (cayendo una y otra vez entre zombis).
        expect(down.get(s.id) ?? 0, `día ${day}: ${s.name}, todo el día en el suelo`).toBeLessThan(
          TICKS_PER_DAY,
        );
        // Nadie se queda quieto un día entero, salvo derribados o encerrados (spec H4b §10).
        const t = tileOf(s.pos);
        const cut = regionOf(w.grid, t.x, t.y) !== regionOf(w.grid, store.x, store.y);
        if (!down.has(s.id) && !cut)
          expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
      }
      // Las de los cuerpos (H4d) entran al morir el zombi y salen si el cuerpo se pudre.
      const log = w.weaponLog;
      expect(allWeapons(w), `día ${day}: armas`).toBe(weapons + log.fromCorpses - log.rotted);
    }
    // Límite generoso (en local va por 0,1–0,2 ms por tick).
    expect(ms / (DAYS * TICKS_PER_DAY), 'ms por tick').toBeLessThan(1);
    // H5: ¿cuánto se sobrevive? (Sin nadie, las habilidades ya no cuentan.)
    zombieTotals.survived.push(w.over ? gameTime(w.over.tick).day : DAYS);
    zombieTotals.dead += w.dead.length;
    if (DAYS >= 10 && w.over === null)
      expect(levels(w), 'las habilidades han subido').toBeGreaterThan(levelsAtStart);
  }, 600_000);
});

test.each([1, 2, 3])(
  'semilla %i: un asedio de 25 a la hora de empezar, sin defender — nadie se pasa un día en el suelo ni cae sin parar',
  (seed) => {
    const w = createWorld(seed, 'balanced', 'normal');
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    w.siege = { at: TICKS_PER_DAY / 24, side: (seed % 4) as 0 | 1 | 2 | 3, size: 25 };
    const downs = new Map<number, number>();
    const streak = new Map<number, number>();
    const downTicks = new Map<number, number>();
    let arrived = false;
    for (let i = 0; i < 2 * TICKS_PER_DAY; i++) {
      const last = w.log.at(-1);
      step(w);
      const problems = checkInvariants(w);
      if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
      for (const e of w.log.slice(last ? w.log.lastIndexOf(last) + 1 : 0)) {
        if (e.kind === 'downed') downs.set(e.survivorId, (downs.get(e.survivorId) ?? 0) + 1);
        if (e.kind === 'siegeArrived') arrived = true;
      }
      for (const s of w.survivors) {
        const n = s.action.type === 'downed' ? (streak.get(s.id) ?? 0) + 1 : 0;
        streak.set(s.id, n);
        // (H5: el desmayado por falta de sangre no cuenta: no es caer una y otra vez.)
        if (n > 0 && s.blood >= FAINT_UNTIL) downTicks.set(s.id, (downTicks.get(s.id) ?? 0) + 1);
        expect(n, `${s.name}, un día entero en el suelo`).toBeLessThan(TICKS_PER_DAY);
      }
    }
    expect(arrived, 'ha llegado el asedio').toBe(true);
    // Antes de la revisión de H4e caían 4–7 veces cada uno y pasaban 35–43 de las 48 h en el
    // suelo: se levantaban entre los zombis, que luego se quedaban rondando la base.
    for (const [id, n] of downs) expect(n, `#${id} ha caído ${n} veces`).toBeLessThanOrEqual(4);
    for (const [id, t] of downTicks)
      expect(t / TICKS_PER_HOUR, `#${id}, horas en el suelo`).toBeLessThan(30);
  },
  300_000,
);

test('con zombis se pelea, alguien cae, algo se rompe, se fabrica y se registran cuerpos', () => {
  if (DAYS < 10) return;
  expect(zombieTotals.kills).toBeGreaterThan(0);
  expect(zombieTotals.downs).toBeGreaterThan(0);
  expect(zombieTotals.broken).toBeGreaterThan(0);
  expect(zombieTotals.crafted, 'fabricado').toBeGreaterThan(0);
  expect(zombieTotals.corpses, 'cuerpos registrados').toBeGreaterThan(0);
  // H4e: llegan asedios, se rescata o se venda a alguien.
  expect(zombieTotals.sieges, 'asedios').toBeGreaterThan(0);
  expect(zombieTotals.healed, 'rescates y vendajes').toBeGreaterThan(0);
  // H5b: la ropa para golpes (y se rompe), se cambian de ropa y se cose.
  expect(zombieTotals.torn, 'ropa rota al parar golpes').toBeGreaterThan(0);
  expect(zombieTotals.dressed, 'cambios de ropa').toBeGreaterThan(0);
  expect(zombieTotals.sewn, 'ropa cosida').toBeGreaterThan(0);
  console.log('H4e, en las 3 partidas con zombis:', zombieTotals);
});
