import {
  BED_SLOTS,
  CALM_DAYS_MAX,
  CALM_DAYS_MIN,
  CHAT_EVERY_MAX,
  EVENTS_START,
  INITIAL_REVEAL,
  NEED_START_MAX,
  NEED_START_MIN,
  START_FOOD,
  START_OPINION_MAX,
  START_OPINION_MIN,
  SURVIVOR_COUNT,
  TICKS_PER_DAY,
} from './balance';
import { emptyInventory } from './items';
import { placeContainers } from './loot';
import { revealFromSurvivors } from './vision';
import { generateMap } from './map/generate';
import { getTile } from './map/grid';
import { moodTarget } from './mood';
import { NAMES } from './names';
import { createRng, nextInt, type RngState } from './rng';
import { rollTraits } from './traits';
import {
  Tile,
  type Bed,
  type NarratorStyle,
  type Point,
  type Storage,
  type Survivor,
  type World,
} from './types';

/** Casilla en la que está una posición continua. */
export function tileOf(p: Point): Point {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

export function createWorld(seed: number, style: NarratorStyle = 'balanced'): World {
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
      social: 0, // se sortea abajo, después de los contenedores
    },
    traits: rollTraits(rng),
    memories: [],
    bedId: i + 1,
    carrying: emptyInventory(),
    work: { loot: true },
    opinions: {},
    partnerId: null,
    nextChatAt: 0,
    bubble: null,
    sick: null,
    celebrated: false,
  }));
  // El Cobarde no sale a saquear salvo que el jugador lo permita.
  for (const s of survivors) s.work.loot = !s.traits.includes('coward');

  // Muebles de la base (spec H2 §7): camas arriba, almacén abajo junto a la puerta.
  const r = base.rect;
  const beds: Bed[] = survivors.map((s, i) => ({
    id: i + 1,
    pos: { x: r.x + BED_SLOTS[i]!.dx, y: r.y + BED_SLOTS[i]!.dy },
    ownerId: s.id,
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

  // Relaciones (H3b), también después para no cambiar partidas anteriores.
  for (const s of survivors) {
    s.needs.social = nextInt(rng, NEED_START_MIN, NEED_START_MAX);
    s.nextChatAt = nextInt(rng, 0, CHAT_EVERY_MAX);
    for (const o of survivors)
      if (o !== s) s.opinions[o.id] = nextInt(rng, START_OPINION_MIN, START_OPINION_MAX);
  }
  for (const s of survivors) s.needs.mood = moodTarget(s, 0, base.rect);
  // Narrador (H3c), lo último: el estilo no cambia nada de lo anterior.
  const calmEndsAt = nextInt(rng, CALM_DAYS_MIN * TICKS_PER_DAY, CALM_DAYS_MAX * TICKS_PER_DAY);

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
    stranger: null,
    narrator: {
      style,
      phase: 'calm',
      phaseEndsAt: calmEndsAt,
      nextEventAt: EVENTS_START,
      lastAt: {},
    },
    decisions: [],
    stormUntil: 0,
  };
  // Los supervivientes conocen su base y los alrededores.
  for (let y = r.y - INITIAL_REVEAL; y < r.y + r.h + INITIAL_REVEAL; y++)
    for (let x = r.x - INITIAL_REVEAL; x < r.x + r.w + INITIAL_REVEAL; x++)
      if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) world.seen[y * grid.width + x] = 1;
  // Se conoce el pueblo (spec general §5.1): carreteras y exterior de los edificios.
  // Lo de dentro y lo que pasa fuera solo se ve con la línea de visión.
  const reveal = (x: number, y: number) => (world.seen[y * grid.width + x] = 1);
  for (let i = 0; i < grid.tiles.length; i++) if (grid.tiles[i] === Tile.Road) world.seen[i] = 1;
  for (const b of [base, ...houses]) {
    const { x, y, w, h } = b.rect;
    for (let i = x; i < x + w; i++) {
      reveal(i, y);
      reveal(i, y + h - 1);
    }
    for (let j = y; j < y + h; j++) {
      reveal(x, j);
      reveal(x + w - 1, j);
    }
  }
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
