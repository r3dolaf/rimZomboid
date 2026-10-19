import { SURVIVOR_COUNT } from './balance';
import { generateMap } from './map/generate';
import { getTile } from './map/grid';
import { NAMES } from './names';
import { createRng, nextInt, type RngState } from './rng';
import { Tile, type Point, type Survivor, type World } from './types';

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
  }));

  return { seed, tick: 0, rng, grid, base, houses, survivors, nextId: survivors.length + 1 };
}

/** Elige `n` elementos distintos al azar. */
function takeDistinct<T>(rng: RngState, items: readonly T[], n: number): T[] {
  if (items.length < n) throw new Error(`takeDistinct: faltan elementos (${items.length} < ${n})`);
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pool.splice(nextInt(rng, 0, pool.length - 1), 1)[0]!);
  return out;
}
