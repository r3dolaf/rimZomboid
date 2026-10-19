import { NEED_START_MAX, NEED_START_MIN, START_FOOD, SURVIVOR_COUNT } from './balance';
import { emptyInventory } from './items';
import { placeContainers } from './loot';
import { revealFromSurvivors } from './vision';
import { generateMap } from './map/generate';
import { getTile } from './map/grid';
import { moodTarget } from './mood';
import { NAMES } from './names';
import { createRng, nextInt, type RngState } from './rng';
import { rollTraits } from './traits';
import { Tile, type Bed, type Point, type Storage, type Survivor, type World } from './types';

/** Casilla en la que está una posición continua. */
export function tileOf(p: Point): Point {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

export function createWorld(seed: number): World {
  const rng = createRng(seed);
  const { grid, base, houses } = generateMap(rng);

  const floor: Point[] = [];
  for (let y = base.rect.y; y < base.rect.y + base.rect.h; y++)
    for (let x = base.rect.x; x < base.rect.x + base.rect.w; x++)
      if (getTile(grid, x, y) === Tile.Floor) floor.push({ x, y });

  const spots = takeDistinct(rng, floor, SURVIVOR_COUNT);
  const names = takeDistinct(rng, NAMES, SURVIVOR_COUNT);
  const survivors: Survivor[] = spots.map((t, i) => ({
    id: i + 1,
    name: names[i]!,
    pos: { x: t.x + 0.5, y: t.y + 0.5 },
    brain: 'ai',
    action: { type: 'idle', ticksLeft: 0 },
    path: [],
    needs: {
      hunger: nextInt(rng, NEED_START_MIN, NEED_START_MAX),
      sleep: nextInt(rng, NEED_START_MIN, NEED_START_MAX),
      mood: 0, // se fija abajo con su objetivo
    },
    traits: rollTraits(rng),
    memories: [],
    bedId: i + 1,
    carrying: emptyInventory(),
    work: { loot: true },
  }));
  // El Cobarde no sale a saquear salvo que el jugador lo permita.
  for (const s of survivors) s.work.loot = !s.traits.includes('coward');

  for (const s of survivors) s.needs.mood = moodTarget(s, 0);

  // Muebles de la base (spec H2 §7): camas arriba, almacén abajo junto a la puerta.
  const r = base.rect;
  const beds: Bed[] = [r.x + 2, r.x + 5, r.x + 9].map((x, i) => ({
    id: i + 1,
    pos: { x, y: r.y + 1 },
    ownerId: survivors[i]!.id,
  }));
  const storage: Storage = {
    tiles: [
      { x: r.x + 7, y: r.y + r.h - 2 },
      { x: r.x + 8, y: r.y + r.h - 2 },
    ],
    items: { ...emptyInventory(), food: START_FOOD },
  };

  // Después de los supervivientes, para no cambiar partidas anteriores con la misma semilla.
  const containers = placeContainers(grid, base, houses, rng);

  const world: World = {
    seed,
    tick: 0,
    rng,
    grid,
    base,
    houses,
    survivors,
    beds,
    storage,
    containers,
    seen: new Array<number>(grid.width * grid.height).fill(0),
    orders: [],
    log: [],
    nextId: survivors.length + 1,
  };
  revealFromSurvivors(world);
  return world;
}

/** Elige `n` elementos distintos al azar. */
function takeDistinct<T>(rng: RngState, items: readonly T[], n: number): T[] {
  if (items.length < n) throw new Error(`takeDistinct: faltan elementos (${items.length} < ${n})`);
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pool.splice(nextInt(rng, 0, pool.length - 1), 1)[0]!);
  return out;
}
