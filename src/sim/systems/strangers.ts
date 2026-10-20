// Recién llegados (spec H3b §6): aparecen en el borde, esperan a la puerta y se unen o se van.
import {
  BED_SLOTS,
  CHAT_EVERY_MAX,
  COLONY_MAX,
  STRANGER_BANDAGE_CHANCE,
  STRANGER_EVERY_DAYS_MAX,
  STRANGER_EVERY_DAYS_MIN,
  STRANGER_FOOD_MAX,
  STRANGER_NEED_MAX,
  STRANGER_NEED_MIN,
  STRANGER_WAIT_TICKS,
  TICKS_PER_DAY,
} from '../balance';
import { contains } from '../geom';
import { emptyInventory } from '../items';
import { logEvent } from '../log';
import { getTile, isWalkable } from '../map/grid';
import { moodTarget } from '../mood';
import { NAMES } from '../names';
import { findPath, regionOf } from '../path/astar';
import { nextFloat, nextInt, pick } from '../rng';
import { rollTraits } from '../traits';
import { Tile, type Point, type Survivor, type World } from '../types';
import { tileOf } from '../world';
import { walkStep } from './movement';

/** Llegadas, la caminata hasta la puerta, la espera y la marcha. */
export function strangerSystem(w: World): void {
  const st = w.stranger;
  if (st === null) {
    if (w.tick >= w.nextStrangerAt) arrive(w);
    return;
  }
  if (!st.leaving && w.tick >= st.expiresAt) {
    logEvent(w, { kind: 'strangerLeft', name: st.survivor.name });
    leave(w);
  }
  const s = st.survivor;
  if (s.action.type !== 'moveTo' || !walkStep(s)) return;
  if (st.leaving) w.stranger = null;
  else s.action = { type: 'idle', ticksLeft: 0 }; // espera a la puerta
}

/** La casilla de fuera, junto a la puerta de la base. */
export function doorOutside(w: World): Point {
  const d = w.base.door;
  const around = [
    { x: d.x, y: d.y + 1 },
    { x: d.x, y: d.y - 1 },
    { x: d.x + 1, y: d.y },
    { x: d.x - 1, y: d.y },
  ];
  return around.find((p) => !contains(w.base.rect, p) && isWalkable(w.grid, p.x, p.y)) ?? d;
}

/** Extremos de carretera en el borde del mapa a los que se puede llegar desde la puerta. */
function roadEnds(w: World): Point[] {
  const { width, height } = w.grid;
  const door = doorOutside(w);
  const region = regionOf(w.grid, door.x, door.y);
  const out: Point[] = [];
  const add = (x: number, y: number) => {
    if (getTile(w.grid, x, y) === Tile.Road && regionOf(w.grid, x, y) === region)
      out.push({ x, y });
  };
  for (let i = 0; i < width; i++) {
    add(i, 0);
    add(i, height - 1);
  }
  for (let j = 1; j < height - 1; j++) {
    add(0, j);
    add(width - 1, j);
  }
  return out;
}

function scheduleNext(w: World): void {
  w.nextStrangerAt =
    w.tick +
    nextInt(
      w.rng,
      STRANGER_EVERY_DAYS_MIN * TICKS_PER_DAY,
      STRANGER_EVERY_DAYS_MAX * TICKS_PER_DAY,
    );
}

function arrive(w: World): void {
  const names = NAMES.filter((n) => !w.survivors.some((s) => s.name === n));
  const ends = roadEnds(w);
  if (w.survivors.length >= COLONY_MAX || names.length === 0 || ends.length === 0) {
    scheduleNext(w);
    return;
  }
  const start = pick(w.rng, ends);
  const door = doorOutside(w);
  const s: Survivor = {
    id: w.nextId++,
    name: pick(w.rng, names),
    pos: { x: start.x + 0.5, y: start.y + 0.5 },
    brain: 'ai',
    action: { type: 'moveTo', target: door },
    path: findPath(w.grid, start, door) ?? [],
    needs: {
      hunger: nextInt(w.rng, STRANGER_NEED_MIN, STRANGER_NEED_MAX),
      sleep: nextInt(w.rng, STRANGER_NEED_MIN, STRANGER_NEED_MAX),
      mood: 0,
      social: nextInt(w.rng, STRANGER_NEED_MIN, STRANGER_NEED_MAX),
    },
    traits: rollTraits(w.rng),
    memories: [],
    bedId: null,
    carrying: {
      ...emptyInventory(),
      food: nextInt(w.rng, 0, STRANGER_FOOD_MAX),
      bandage: nextFloat(w.rng) < STRANGER_BANDAGE_CHANCE ? 1 : 0,
    },
    work: { loot: false },
    opinions: {},
    partnerId: null,
    nextChatAt: 0,
    bubble: null,
    sick: null,
    celebrated: false,
  };
  s.needs.mood = moodTarget(s, w.tick, w.base.rect);
  w.stranger = { survivor: s, expiresAt: w.tick + STRANGER_WAIT_TICKS, leaving: false };
  logEvent(w, { kind: 'strangerArrived', name: s.name });
}

/** Se va hacia el extremo de carretera más cercano y la siguiente llegada se programa. */
function leave(w: World): void {
  const st = w.stranger!;
  const s = st.survivor;
  st.leaving = true;
  const here = tileOf(s.pos);
  const ends = roadEnds(w);
  let exit = here;
  let best = Infinity;
  for (const e of ends) {
    const d = (e.x - here.x) ** 2 + (e.y - here.y) ** 2;
    if (d < best) {
      best = d;
      exit = e;
    }
  }
  s.action = { type: 'moveTo', target: exit };
  s.path = findPath(w.grid, here, exit) ?? [];
  scheduleNext(w);
}

/** Orden del jugador: se une a la colonia (con cama si queda sitio). */
export function acceptStranger(w: World): void {
  const st = w.stranger;
  if (st === null || st.leaving || w.survivors.length >= COLONY_MAX) return;
  const s = st.survivor;
  s.action = { type: 'idle', ticksLeft: 0 };
  s.path = [];
  s.work.loot = !s.traits.includes('coward');
  s.nextChatAt = w.tick + nextInt(w.rng, 0, CHAT_EVERY_MAX);
  const r = w.base.rect;
  const free = BED_SLOTS.map((b) => ({ x: r.x + b.dx, y: r.y + b.dy })).find(
    (p) => !w.beds.some((b) => b.pos.x === p.x && b.pos.y === p.y),
  );
  if (free) {
    const id = Math.max(0, ...w.beds.map((b) => b.id)) + 1;
    w.beds.push({ id, pos: free, ownerId: s.id });
    s.bedId = id;
  }
  w.survivors.push(s);
  w.stranger = null;
  logEvent(w, { kind: 'strangerAccepted', name: s.name });
  scheduleNext(w);
}

/** Orden del jugador: se marcha. */
export function rejectStranger(w: World): void {
  const st = w.stranger;
  if (st === null || st.leaving) return;
  logEvent(w, { kind: 'strangerRejected', name: st.survivor.name });
  leave(w);
}
