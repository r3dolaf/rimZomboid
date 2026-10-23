// Recién llegados (spec H3b §6 y H3c §3.3): caminan hasta la puerta, esperan y se unen o se van.
// Cuándo llegan lo decide el narrador (events/strangers.ts).
import {
  CHAT_EVERY_MAX,
  SURVIVOR_RUN_SPEED,
  SURVIVOR_WALK_SPEED,
  COLONY_MAX,
  STRANGER_BANDAGE_CHANCE,
  STRANGER_FOOD_MAX,
  STRANGER_NEED_MAX,
  STRANGER_NEED_MIN,
} from '../balance';
import { baseLayout } from '../base';
import { freeFloor } from '../build';
import { contains } from '../geom';
import { threatsOf, willFight } from '../danger';
import { emptyInventory } from '../items';
import { logEvent } from '../log';
import { getTile, isWalkable } from '../map/grid';
import { moodTarget } from '../mood';
import { NAMES } from '../names';
import { findPath, regionOf } from '../path/astar';
import { nextFloat, nextInt, pick } from '../rng';
import { rollSkills, skillRng } from '../skills';
import { rollTraits } from '../traits';
import { Tile, type Point, type Survivor, type World } from '../types';
import { defaultPriorities, defaultStance, defaultWork, tileOf } from '../world';
import { walkStep } from './movement';

/**
 * La caminata hasta la puerta, la espera y la marcha; con zombis a la vista (H4e), pelean o huyen.
 * El que está en el suelo o peleando no se ha ido aún.
 */
export function strangerSystem(w: World): void {
  const st = w.stranger;
  if (st === null) return;
  if (!st.leaving) strangerDanger(w);
  let arrived = true;
  for (const s of st.survivors) {
    const a = s.action;
    if (a.type === 'downed' || a.type === 'melee') {
      arrived = false;
      continue;
    }
    if (a.type !== 'moveTo') {
      // Tras levantarse o pelear: a la salida si se van; si no, otra vez a la puerta.
      const target = st.leaving ? exitFor(w, s) : doorOutside(w);
      const here = tileOf(s.pos);
      if (here.x === target.x && here.y === target.y) continue;
      s.action = { type: 'moveTo', target };
      s.path = findPath(w.grid, here, target) ?? [];
      arrived = false;
      continue;
    }
    // Al llegar (o si un muro le corta el paso), espera ahí (o ya se ha ido).
    const speed = a.run ? SURVIVOR_RUN_SPEED : SURVIVOR_WALK_SPEED;
    if (walkStep(s, w.grid, speed) === 'walking') arrived = false;
    else s.action = { type: 'idle', ticksLeft: 0 };
  }
  if (st.leaving && arrived) w.stranger = null;
}

/**
 * Los que ven zombis deciden como un colono con Decidir: pelean con el más cercano si pueden con
 * ellos; si alguno no puede, huyen todos juntos (su decisión se quita).
 */
function strangerDanger(w: World): void {
  const st = w.stranger!;
  let flee = false;
  for (const s of st.survivors) {
    if (s.action.type === 'downed') continue;
    const threats = threatsOf(w, s);
    if (threats.length === 0) {
      if (s.action.type === 'melee') s.action = { type: 'idle', ticksLeft: 0 };
      continue;
    }
    if (!willFight(w, s, threats, 'decide')) {
      flee = true;
      break;
    }
    const z = threats[0]!;
    if (s.action.type !== 'melee' || s.action.zombieId !== z.id) {
      s.action = { type: 'melee', zombieId: z.id, cooldown: 0 };
      s.path = [];
    }
  }
  if (!flee) return;
  w.decisions = w.decisions.filter((d) => d.kind !== 'stranger');
  logEvent(w, { kind: 'strangersFled', names: st.survivors.map((s) => s.name) });
  leaveStrangers(w, true);
}

/** El extremo de carretera más cercano (o donde está, si no hay). */
function exitFor(w: World, s: Survivor): Point {
  const here = tileOf(s.pos);
  let exit = here;
  let best = Infinity;
  for (const e of roadEnds(w)) {
    const d = (e.x - here.x) ** 2 + (e.y - here.y) ** 2;
    if (d < best) {
      best = d;
      exit = e;
    }
  }
  return exit;
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
export function roadEnds(w: World): Point[] {
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

/** Nombres que nadie de la colonia (ni quien espera) lleva ya. */
export function freeNames(w: World): string[] {
  const used = new Set([
    ...w.survivors.map((s) => s.name),
    ...(w.stranger?.survivors.map((s) => s.name) ?? []),
  ]);
  return NAMES.filter((n) => !used.has(n));
}

/** Un desconocido en `start` que va hacia la puerta, con lo que lleve encima. */
export function newStranger(w: World, start: Point): Survivor {
  const door = doorOutside(w);
  const s: Survivor = {
    id: w.nextId++,
    name: pick(w.rng, freeNames(w)),
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
    skills: rollSkills(skillRng(w.seed, 0), []), // se sortea abajo con su id y sus rasgos
    memories: [],
    bedId: null,
    carrying: {
      ...emptyInventory(),
      food: nextInt(w.rng, 0, STRANGER_FOOD_MAX),
      bandage: nextFloat(w.rng) < STRANGER_BANDAGE_CHANCE ? 1 : 0,
    },
    work: {
      heal: true,
      social: true,
      build: true,
      craft: true,
      haul: true,
      chop: false,
      loot: false,
    },
    priorities: defaultPriorities(),
    equipped: null,
    weaponLocked: false,
    health: 100,
    stance: 'decide', // se ajusta abajo con los rasgos
    opinions: {},
    partnerId: null,
    nextChatAt: 0,
    bubble: null,
    sick: null,
    celebrated: false,
    drafted: false,
    carryingId: null,
    wounds: [],
    blood: 100,
    dying: null,
    painkillerUntil: 0,
    painkillerWanted: false,
  };
  s.needs.mood = moodTarget(s, w.tick, w.base.rect);
  s.stance = defaultStance(s.traits);
  s.skills = rollSkills(skillRng(w.seed, s.id), s.traits);
  return s;
}

/**
 * Se van hacia el extremo de carretera más cercano (`run`: huyendo de los zombis, H4e). El que
 * está en el suelo se irá al levantarse.
 */
export function leaveStrangers(w: World, run = false): void {
  const st = w.stranger;
  if (st === null) return;
  st.leaving = true;
  for (const s of st.survivors) {
    if (s.action.type === 'downed') continue;
    const exit = exitFor(w, s);
    s.action = run ? { type: 'moveTo', target: exit, run } : { type: 'moveTo', target: exit };
    s.path = findPath(w.grid, tileOf(s.pos), exit) ?? [];
  }
}

/** Se unen a la colonia (con cama mientras quede). Si no caben todos, no entra nadie y se van. */
export function acceptStrangers(w: World): void {
  const st = w.stranger;
  if (st === null || st.leaving) return;
  if (w.survivors.length + st.survivors.length > COLONY_MAX) {
    logEvent(w, { kind: 'strangerLeft', names: st.survivors.map((s) => s.name) });
    leaveStrangers(w);
    return;
  }
  for (const s of st.survivors) {
    // El que está en el suelo entra derribado (H4e): ya lo rescatarán.
    if (s.action.type !== 'downed') s.action = { type: 'idle', ticksLeft: 0 };
    s.path = [];
    s.work = defaultWork(s.traits);
    s.nextChatAt = w.tick + nextInt(w.rng, 0, CHAT_EVERY_MAX);
    // Primero una cama construida que esté libre (H4a); si no, uno de los sitios de serie.
    const spare = w.beds.find((b) => b.ownerId === null && b.medical !== true);
    const free = baseLayout(w.base).beds.find((p) => freeFloor(w, p));
    if (spare) {
      spare.ownerId = s.id;
      s.bedId = spare.id;
    } else if (free) {
      const id = Math.max(0, ...w.beds.map((b) => b.id)) + 1;
      w.beds.push({ id, pos: free, ownerId: s.id });
      s.bedId = id;
    }
    w.survivors.push(s);
  }
  w.stranger = null;
  logEvent(w, { kind: 'strangerAccepted', names: st.survivors.map((s) => s.name) });
}
