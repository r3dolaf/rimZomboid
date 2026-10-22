// H4a §3.3: transportar montones al almacén y madera a los planos.
import { expect, test } from 'vitest';
import { withoutZombies, withSkills } from './testing/fixtures';
import { TICKS_PER_HOUR } from './balance';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { getTile } from './map/grid';
import { issue } from './orders';
import { step } from './step';
import { Tile, type Point, type Survivor, type World } from './types';
import { createWorld, tileOf } from './world';

// H4a: talar y acarrear, sin zombis; con nivel 5 (las cargas de antes de H4c).
const BASE = withSkills(withoutZombies(createWorld(3)));

/** Ana sola transportando, todo visto, sin narrador. */
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
  a.work.haul = true;
  return { w, a };
}

function runUntil(w: World, cond: () => boolean, max: number): boolean {
  for (let i = 0; i < max; i++) {
    if (cond()) return true;
    step(w);
  }
  return cond();
}

/** Una casilla de suelo libre de la base (no almacén, ni cama). */
function freeFloor(w: World): Point {
  const r = w.base.rect;
  for (let y = r.y + 1; y < r.y + r.h - 1; y++)
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const p = { x, y };
      const at = (q: Point) => q.x === x && q.y === y;
      if (getTile(w.grid, x, y) !== Tile.Floor) continue;
      if (w.storage.tiles.some(at) || w.beds.some((b) => at(b.pos))) continue;
      if (w.survivors.some((s) => at(tileOf(s.pos)))) continue;
      return p;
    }
  throw new Error('sin suelo libre');
}

/** Añade madera a un montón como si se hubiera talado (para que cuadre la madera). */
function chopped(w: World, pos: Point, wood: number) {
  w.piles.push({ id: w.nextId++, pos, items: { ...emptyInventory(), wood } });
  w.woodLog.chopped += wood;
}

test('lleva un montón al almacén y lo descarga', () => {
  const { w, a } = scene();
  const p = freeFloor(w);
  chopped(w, p, 5);
  expect(checkInvariants(w)).toEqual([]);
  expect(runUntil(w, () => w.storage.items.wood === 5, 2 * TICKS_PER_HOUR)).toBe(true);
  expect(w.piles).toEqual([]);
  expect(a.carrying.wood).toBe(0);
  expect(checkInvariants(w)).toEqual([]);
});

test('de un montón grande coge lo que le cabe (8 tablas) y deja el resto', () => {
  const { w, a } = scene();
  chopped(w, freeFloor(w), 12);
  expect(runUntil(w, () => a.carrying.wood > 0, 2 * TICKS_PER_HOUR)).toBe(true);
  expect(a.carrying.wood).toBe(8);
  expect(w.piles[0]!.items.wood).toBe(4);
  expect(runUntil(w, () => w.storage.items.wood === 12, 4 * TICKS_PER_HOUR)).toBe(true);
});

test('lleva al plano la madera que le falta, desde el almacén', () => {
  const { w } = scene();
  w.storage.items.wood = 10;
  w.woodLog.chopped += 10;
  const p = freeFloor(w);
  issue(w, { type: 'placeBlueprint', kind: 'bed', x: p.x, y: p.y });
  expect(runUntil(w, () => w.blueprints[0]?.wood === 6, 3 * TICKS_PER_HOUR)).toBe(true);
  expect(w.storage.items.wood).toBe(4);
  expect(checkInvariants(w)).toEqual([]);
});

test('si ya lleva madera, la entrega directamente', () => {
  const { w, a } = scene();
  a.carrying.wood = 3;
  w.woodLog.chopped += 3;
  const p = freeFloor(w);
  issue(w, { type: 'placeBlueprint', kind: 'woodWall', x: p.x, y: p.y });
  expect(runUntil(w, () => w.blueprints[0]?.wood === 2, 2 * TICKS_PER_HOUR)).toBe(true);
  // La que sobra la descarga.
  expect(runUntil(w, () => w.storage.items.wood === 1, 2 * TICKS_PER_HOUR)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('dos no abastecen a la vez el mismo plano', () => {
  const { w, a } = scene();
  const b = w.survivors[1]!;
  b.work.haul = true;
  w.storage.items.wood = 20;
  w.woodLog.chopped += 20;
  const p = freeFloor(w);
  issue(w, { type: 'placeBlueprint', kind: 'bed', x: p.x, y: p.y });
  step(w);
  step(w);
  const going = [a, b].filter(
    (s) => s.action.type === 'moveTo' && s.action.then?.type === 'fetchWood',
  );
  expect(going).toHaveLength(1);
});

test('si cancelan el plano mientras lleva la madera, la deja en el almacén (no se pierde)', () => {
  const { w, a } = scene();
  w.storage.items.wood = 10;
  w.woodLog.chopped += 10;
  const p = freeFloor(w);
  issue(w, { type: 'placeBlueprint', kind: 'bed', x: p.x, y: p.y });
  expect(runUntil(w, () => a.carrying.wood > 0, 2 * TICKS_PER_HOUR)).toBe(true);
  issue(w, { type: 'cancelBlueprint', id: w.blueprints[0]!.id });
  expect(runUntil(w, () => w.storage.items.wood === 10, 3 * TICKS_PER_HOUR)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('sin permiso de transportar no lleva nada', () => {
  const { w, a } = scene();
  a.work.haul = false;
  chopped(w, freeFloor(w), 5);
  for (let i = 0; i < TICKS_PER_HOUR; i++) step(w);
  expect(w.piles).toHaveLength(1);
});

test('invariante: la madera cuadra', () => {
  const { w } = scene();
  expect(checkInvariants(w)).toEqual([]);
  w.storage.items.wood += 1; // madera que sale de la nada
  expect(checkInvariants(w).some((p) => p.includes('madera'))).toBe(true);
});
