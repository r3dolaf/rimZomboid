// H4a §3.2: talar con hacha.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from './balance';
import { brains } from './brain';
import { checkInvariants } from './invariants';
import { getTile, isWalkable } from './map/grid';
import { issue } from './orders';
import { step } from './step';
import { Tile, type Survivor, type World } from './types';
import { createWorld, tileOf } from './world';

const BASE = createWorld(3);

/** Ana sola trabajando (los demás sin trabajos), todo visto, sin narrador. */
function scene(): { w: World; a: Survivor; tree: { x: number; y: number } } {
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
    s.work = { social: false, build: false, haul: false, chop: false, loot: false };
  }
  const a = w.survivors[0]!;
  a.work.chop = true;
  // El árbol visto más cercano a Ana.
  const at = tileOf(a.pos);
  let tree = { x: -1, y: -1 };
  let best = Infinity;
  for (let y = 0; y < w.grid.height; y++)
    for (let x = 0; x < w.grid.width; x++)
      if (getTile(w.grid, x, y) === Tile.Tree) {
        const d = (x - at.x) ** 2 + (y - at.y) ** 2;
        if (d < best) {
          best = d;
          tree = { x, y };
        }
      }
  return { w, a, tree };
}

function runUntil(w: World, cond: () => boolean, max: number): boolean {
  for (let i = 0; i < max; i++) {
    if (cond()) return true;
    step(w);
  }
  return cond();
}

const idx = (w: World, p: { x: number; y: number }) => p.y * w.grid.width + p.x;

test('sin hacha y con árboles marcados, va al almacén a por ella', () => {
  const { w, a, tree } = scene();
  w.storage.items.axe = 1;
  issue(w, { type: 'markTree', ...tree, on: true });
  expect(runUntil(w, () => a.equipped === 'axe', 2 * TICKS_PER_HOUR)).toBe(true);
  expect(w.storage.items.axe).toBe(0);
  expect(checkInvariants(w)).toEqual([]);
});

test('con hacha, tala el árbol marcado en 1 h: hierba, sin marca y un montón de 4–6 tablas', () => {
  const { w, a, tree } = scene();
  a.equipped = 'axe';
  issue(w, { type: 'markTree', ...tree, on: true });
  expect(runUntil(w, () => a.action.type === 'chop', 3 * TICKS_PER_HOUR)).toBe(true);
  const t = tileOf(a.pos);
  expect(Math.max(Math.abs(t.x - tree.x), Math.abs(t.y - tree.y))).toBe(1);
  // El tick en que empieza ya cuenta.
  for (let i = 0; i < TICKS_PER_HOUR - 2; i++) step(w);
  expect(a.action.type).toBe('chop');
  step(w);
  expect(getTile(w.grid, tree.x, tree.y)).toBe(Tile.Grass);
  expect(isWalkable(w.grid, tree.x, tree.y)).toBe(true);
  expect(w.chopMarks).toEqual([]);
  expect(w.piles).toHaveLength(1);
  expect(w.piles[0]!.pos).toEqual(tree);
  expect(w.piles[0]!.items.wood).toBeGreaterThanOrEqual(4);
  expect(w.piles[0]!.items.wood).toBeLessThanOrEqual(6);
  expect(checkInvariants(w)).toEqual([]);
});

test('sin marcas no tala ni va a por el hacha; sin permiso tampoco', () => {
  const { w, a, tree } = scene();
  w.storage.items.axe = 1;
  const first = brains.ai.decide(a, w);
  expect(first?.type === 'moveTo' && first.then !== undefined).toBe(false); // solo pasea
  w.chopMarks.push(idx(w, tree));
  a.work.chop = false;
  const d = brains.ai.decide(a, w);
  expect(d?.type === 'moveTo' && d.then?.type === 'takeAxe').toBe(false);
});

test('quien tiene el hacha sin permiso de talar la devuelve al almacén', () => {
  const { w, a } = scene();
  a.equipped = 'axe';
  a.work.chop = false;
  expect(runUntil(w, () => a.equipped === null, 2 * TICKS_PER_HOUR)).toBe(true);
  expect(w.storage.items.axe).toBe(1);
});

test('dos con hacha no van al mismo árbol', () => {
  const { w, a, tree } = scene();
  const b = w.survivors[1]!;
  a.equipped = 'axe';
  b.equipped = 'axe';
  b.work.chop = true;
  w.chopMarks.push(idx(w, tree));
  step(w);
  const going = [a, b].filter((s) => s.action.type === 'moveTo' && s.action.then?.type === 'chop');
  expect(going).toHaveLength(1);
});

test('si desmarcan el árbol mientras va, lo deja', () => {
  const { w, a, tree } = scene();
  a.equipped = 'axe';
  w.chopMarks.push(idx(w, tree));
  step(w);
  expect(a.action.type === 'moveTo' && a.action.then?.type === 'chop').toBe(true);
  issue(w, { type: 'markTree', ...tree, on: false });
  step(w);
  expect(a.action.type === 'moveTo' && a.action.then?.type === 'chop').toBe(false);
  expect(a.action.type).not.toBe('chop');
});
