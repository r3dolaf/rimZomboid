// H4a §4: construir cada cosa, el orden de los trabajos y el escenario completo.
import { expect, test } from 'vitest';
import { skillsAt, withoutZombies } from './testing/fixtures';
import { BUILD, TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';
import { brains } from './brain';
import { strangersEvent } from './events/strangers';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { getTile } from './map/grid';
import { issue } from './orders';
import { step } from './step';
import { Tile, type BuildKind, type Point, type Survivor, type World } from './types';
import { createWorld, tileOf } from './world';

const BASE = withoutZombies(createWorld(3));

/** Ana sola construyendo, todo visto, sin narrador. */
function scene(): { w: World; a: Survivor } {
  const w = structuredClone(BASE);
  w.seen.fill(1);
  w.tick = 1000;
  w.narrator.nextEventAt = 1e9;
  w.narrator.phaseEndsAt = 1e9;
  for (const s of w.survivors) {
    s.needs.hunger = 100;
    s.needs.sleep = 100;
    s.needs.mood = 60;
    s.nextChatAt = 1e9;
    s.traits = [];
    // Como antes de H4c, y Construir 8 para que nunca falle (los fallos, en skillsWork.test).
    s.skills = skillsAt(5);
    s.skills.build.level = 8;
    s.work = {
      heal: false,
      social: false,
      build: false,
      craft: false,
      haul: false,
      chop: false,
      loot: false,
    };
  }
  const a = w.survivors[0]!;
  a.work.build = true;
  return { w, a };
}

function runUntil(w: World, cond: () => boolean, max: number): boolean {
  for (let i = 0; i < max; i++) {
    if (cond()) return true;
    step(w);
  }
  return cond();
}

const at = (p: Point) => (q: Point) => q.x === p.x && q.y === p.y;

/** Una casilla de suelo libre de la base, lejos de los colonos. */
function freeFloor(w: World, skip: Point[] = []): Point {
  const r = w.base.rect;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++)
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const p = { x, y };
      if (getTile(w.grid, x, y) !== Tile.Floor || skip.some(at(p))) continue;
      if (w.storage.tiles.some(at(p)) || w.beds.some((b) => at(p)(b.pos))) continue;
      if (w.survivors.some((s) => at(p)(tileOf(s.pos)))) continue;
      return p;
    }
  throw new Error('sin suelo libre');
}

/** Un plano ya con toda su madera (como si se la hubieran traído). */
function readyBlueprint(w: World, kind: BuildKind, p: Point) {
  const b = { id: w.common.nextId++, kind, pos: p, wood: BUILD[kind].wood, progress: 0 };
  w.blueprints.push(b);
  w.common.woodLog.chopped += b.wood;
  return b;
}

test('cama: se construye en 2 h y es para quien dormía en el suelo', () => {
  const { w, a } = scene();
  const b = w.survivors[1]!;
  w.beds = w.beds.filter((x) => x.ownerId !== b.id);
  b.bedId = null;
  const p = freeFloor(w);
  readyBlueprint(w, 'bed', p);
  expect(runUntil(w, () => a.action.type === 'build', TICKS_PER_HOUR)).toBe(true);
  expect(runUntil(w, () => w.blueprints.length === 0, BUILD.bed.ticks + 5)).toBe(true);
  const bed = w.beds.find((x) => at(p)(x.pos))!;
  expect(bed.ownerId).toBe(b.id);
  expect(b.bedId).toBe(bed.id);
  expect(w.common.woodLog.spent).toBe(6);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'built', what: 'bed' });
  expect(checkInvariants(w)).toEqual([]);
});

test('sin toda la madera no se construye', () => {
  const { w, a } = scene();
  const p = freeFloor(w);
  w.blueprints.push({ id: w.common.nextId++, kind: 'table', pos: p, wood: 3, progress: 0 });
  w.common.woodLog.chopped += 3;
  const d = brains.ai.decide(a, w);
  expect(d?.type === 'moveTo' && d.then?.type === 'build').toBe(false);
});

test('mesa y hoguera son muebles; cama sin nadie que la necesite queda libre', () => {
  const { w } = scene();
  const p1 = freeFloor(w);
  const p2 = freeFloor(w, [p1]);
  const p3 = freeFloor(w, [p1, p2]);
  readyBlueprint(w, 'table', p1);
  readyBlueprint(w, 'campfire', p2);
  readyBlueprint(w, 'bed', p3);
  expect(runUntil(w, () => w.blueprints.length === 0, 6 * TICKS_PER_HOUR)).toBe(true);
  const built = w.furniture.filter((f) => f.kind !== 'sink' && f.kind !== 'cistern'); // H5b
  expect(built.map((f) => f.kind).sort()).toEqual(['campfire', 'table']);
  expect(w.beds.find((x) => at(p3)(x.pos))?.ownerId).toBeNull();
  expect(checkInvariants(w)).toEqual([]);
});

test('muro: se levanta desde al lado y espera si hay alguien encima', () => {
  const { w, a } = scene();
  const b = w.survivors[1]!;
  const p = freeFloor(w);
  readyBlueprint(w, 'woodWall', p);
  b.pos = { x: p.x + 0.5, y: p.y + 0.5 };
  b.action = { type: 'idle', ticksLeft: 1e6 }; // se queda quieto encima
  b.path = [];
  expect(runUntil(w, () => a.action.type === 'build', TICKS_PER_HOUR)).toBe(true);
  expect(tileOf(a.pos)).not.toEqual(p);
  for (let i = 0; i < BUILD.woodWall.ticks + 10; i++) step(w);
  expect(getTile(w.grid, p.x, p.y)).not.toBe(Tile.WoodWall);
  expect(a.action.type).toBe('build');
  b.pos = { x: tileOf(a.pos).x + 0.5, y: tileOf(a.pos).y + 0.5 }; // se aparta
  expect(runUntil(w, () => getTile(w.grid, p.x, p.y) === Tile.WoodWall, 5)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('puerta, tapiar y quitar tablas (que devuelve una tabla al suelo)', () => {
  const { w } = scene();
  const p = freeFloor(w);
  readyBlueprint(w, 'woodDoor', p);
  let win: Point | null = null;
  for (let i = 0; i < w.grid.tiles.length && !win; i++)
    if (w.grid.tiles[i] === Tile.Window) {
      const q = { x: i % w.grid.width, y: Math.floor(i / w.grid.width) };
      const r = w.base.rect;
      if (q.x >= r.x && q.y >= r.y && q.x < r.x + r.w && q.y < r.y + r.h) win = q;
    }
  readyBlueprint(w, 'board', win!);
  expect(runUntil(w, () => w.blueprints.length === 0, 6 * TICKS_PER_HOUR)).toBe(true);
  expect(getTile(w.grid, p.x, p.y)).toBe(Tile.Door);
  expect(getTile(w.grid, win!.x, win!.y)).toBe(Tile.BoardedWindow);
  issue(w, { type: 'placeBlueprint', kind: 'unboard', x: win!.x, y: win!.y });
  expect(
    runUntil(w, () => getTile(w.grid, win!.x, win!.y) === Tile.Window, 3 * TICKS_PER_HOUR),
  ).toBe(true);
  expect(w.piles.reduce((acc, x) => acc + x.items.wood, 0)).toBe(1);
  expect(w.common.woodLog.recovered).toBe(1);
  expect(checkInvariants(w)).toEqual([]);
});

test('si lo dejan a medias, el avance se guarda', () => {
  const { w, a } = scene();
  const p = freeFloor(w);
  const b = readyBlueprint(w, 'bed', p);
  expect(runUntil(w, () => a.action.type === 'build', TICKS_PER_HOUR)).toBe(true);
  for (let i = 0; i < 100; i++) step(w);
  a.action = { type: 'idle', ticksLeft: 0 };
  a.work.build = false;
  for (let i = 0; i < 20; i++) step(w);
  expect(b.progress).toBeGreaterThanOrEqual(99);
  expect(w.blueprints).toHaveLength(1);
});

test('orden por criticidad: construir antes que transportar, talar o saquear; con hambre, saquear primero', () => {
  const { w, a } = scene();
  a.work = {
    heal: false,
    social: true,
    build: true,
    craft: false,
    haul: true,
    chop: true,
    loot: true,
  };
  a.equipped = 'axe';
  w.storage.items.axe = 0;
  for (const c of w.containers) c.designated = true;
  for (let i = 0; i < w.grid.tiles.length; i++)
    if (w.grid.tiles[i] === Tile.Tree) {
      w.chopMarks.push(i);
      break;
    }
  readyBlueprint(w, 'table', freeFloor(w));
  const what = () => {
    const d = brains.ai.decide(a, w);
    return d?.type === 'moveTo' ? d.then?.type : d?.type;
  };
  w.storage.items.food = 50;
  expect(what()).toBe('build');
  w.storage.items.food = 1;
  for (const s of w.survivors) s.carrying.food = 0;
  expect(what()).toBe('search');
});

test('orden por criticidad: transportar antes que talar, y talar antes que saquear', () => {
  const { w, a } = scene();
  a.work = {
    heal: false,
    social: true,
    build: true,
    craft: false,
    haul: true,
    chop: true,
    loot: true,
  };
  a.equipped = 'axe';
  w.storage.items.axe = 0;
  w.storage.items.food = 50;
  for (const c of w.containers) c.designated = true;
  // El árbol más cercano a la base (para que se pueda llegar a él).
  const r = w.base.rect;
  let tree = -1;
  let best = Infinity;
  for (let i = 0; i < w.grid.tiles.length; i++) {
    if (w.grid.tiles[i] !== Tile.Tree) continue;
    const d = ((i % w.grid.width) - r.x) ** 2 + (Math.floor(i / w.grid.width) - r.y) ** 2;
    if (d < best) [tree, best] = [i, d];
  }
  w.chopMarks.push(tree);
  w.piles.push({
    id: w.common.nextId++,
    pos: freeFloor(w),
    items: { ...emptyInventory(), wood: 2 },
  });
  w.common.woodLog.chopped += 2;
  const what = () => {
    const d = brains.ai.decide(a, w);
    return d?.type === 'moveTo' ? d.then?.type : d?.type;
  };
  expect(what()).toBe('pickUp');
  w.piles = [];
  expect(what()).toBe('chop');
  w.chopMarks = [];
  expect(what()).toBe('search');
});

test('un recién llegado ocupa antes una cama construida libre', () => {
  const { w } = scene();
  const p = freeFloor(w);
  w.beds.push({ id: 77, pos: p, ownerId: null });
  w.tick = 3 * TICKS_PER_DAY;
  w.rng = { s: 1 };
  strangersEvent.happen(w);
  const d = w.decisions[0]!;
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  step(w);
  const newcomer = w.survivors.find((s) => s.id === d.survivorIds[0])!;
  expect(newcomer.bedId).toBe(77);
  expect(w.beds.find((x) => x.id === 77)!.ownerId).toBe(newcomer.id);
  expect(checkInvariants(w)).toEqual([]);
});

test('escenario: talar, acarrear y construir una cama para quien dormía en el suelo', () => {
  const { w, a } = scene();
  const b = w.survivors[1]!;
  w.beds = w.beds.filter((x) => x.ownerId !== b.id);
  b.bedId = null;
  a.work = {
    heal: false,
    social: false,
    build: true,
    craft: false,
    haul: true,
    chop: true,
    loot: false,
  };
  w.storage.items.axe = 1;
  // Los dos árboles vistos más cercanos a la base.
  const r = w.base.rect;
  const trees: number[] = [];
  for (let i = 0; i < w.grid.tiles.length; i++) if (w.grid.tiles[i] === Tile.Tree) trees.push(i);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  trees.sort((i, j) => {
    const d = (k: number) =>
      ((k % w.grid.width) - cx) ** 2 + (Math.floor(k / w.grid.width) - cy) ** 2;
    return d(i) - d(j);
  });
  for (const t of trees.slice(0, 2))
    issue(w, { type: 'markTree', x: t % w.grid.width, y: Math.floor(t / w.grid.width), on: true });
  const p = freeFloor(w);
  issue(w, { type: 'placeBlueprint', kind: 'bed', x: p.x, y: p.y });
  expect(runUntil(w, () => b.bedId !== null, 2 * TICKS_PER_DAY)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
  // Y esa noche duerme en su cama.
  b.needs.sleep = 40;
  expect(runUntil(w, () => b.action.type === 'sleep' && b.action.inBed, TICKS_PER_DAY)).toBe(true);
});
