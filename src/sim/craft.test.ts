// H4d §4: Fabricar — recetas, pedidos y el trabajo en la mesa.
import { expect, test } from 'vitest';
import { BILL_DEFAULT_TARGET, RECIPES, TICKS_PER_HOUR } from './balance';
import { checkInvariants } from './invariants';
import { craftJob } from './jobs/craft';
import { issue, ordersSystem } from './orders';
import { createRng } from './rng';
import { skillSpeed } from './skills';
import { step } from './step';
import { addSurvivor, emptyWorld } from './testing/fixtures';
import { Tile, type Action, type World } from './types';

/** Una mesa en (5, 5), el almacén en (1, 1) con 6 telas, y Ana (solo Fabricar) junto al almacén. */
function world(): World {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor); // todo es suelo de la base (para pasear cuando no hay nada)
  w.narrator.nextEventAt = 1e9;
  w.furniture.push({ id: 80, kind: 'table', pos: { x: 5, y: 5 } });
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.food = 50;
  w.storage.items.cloth = 6;
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 2.5 };
  s.work = { social: false, build: false, craft: true, haul: false, chop: false, loot: false };
  s.skills.craft.level = 10; // no falla (los fallos, en su test)
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
  s.nextChatAt = 1e9;
  return w;
}

const bill = (w: World, recipe: 'bandages' | 'curtains' | 'unpick') => {
  issue(w, { type: 'addBill', recipe });
  ordersSystem(w);
  return w.bills.at(-1)!;
};

const then = (a: Action | null) => (a?.type === 'moveTo' ? a.then?.type : a?.type);

test('recetas: vendas (1 tela → 2), cortinas (3 telas + 2 usos de hilo, con aguja) y deshacerlas (con cuchillo)', () => {
  expect(RECIPES.bandages).toEqual({
    input: { cloth: 1 },
    tool: null,
    output: { bandage: 2 },
    ticks: 0.25 * TICKS_PER_HOUR,
  });
  expect(RECIPES.curtains).toEqual({
    input: { cloth: 3, thread: 2 },
    tool: 'needle',
    output: { curtains: 1 },
    ticks: TICKS_PER_HOUR,
  });
  expect(RECIPES.unpick).toEqual({
    input: { curtains: 1 },
    tool: 'knife',
    output: { cloth: 3 },
    ticks: 0.25 * TICKS_PER_HOUR,
  });
});

test('pedidos: añadir ("hasta tener 5"), cambiar modo y N, subir y bajar, quitar', () => {
  const w = world();
  const a = bill(w, 'bandages');
  const b = bill(w, 'curtains');
  expect(w.bills).toEqual([
    { id: a.id, recipe: 'bandages', mode: 'until', target: BILL_DEFAULT_TARGET, done: 0 },
    { id: b.id, recipe: 'curtains', mode: 'until', target: BILL_DEFAULT_TARGET, done: 0 },
  ]);
  issue(w, { type: 'setBill', billId: b.id, mode: 'count', target: 2 });
  issue(w, { type: 'setBill', billId: a.id, target: 0 }); // N, como poco 1
  issue(w, { type: 'moveBill', billId: b.id, dir: -1 });
  ordersSystem(w);
  expect(w.bills.map((x) => x.id)).toEqual([b.id, a.id]);
  expect(w.bills[0]).toMatchObject({ mode: 'count', target: 2 });
  expect(w.bills[1]).toMatchObject({ mode: 'until', target: 1 });
  issue(w, { type: 'removeBill', billId: b.id });
  ordersSystem(w);
  expect(w.bills.map((x) => x.id)).toEqual([a.id]);
  expect(checkInvariants(w)).toEqual([]);
});

test('sin mesa, sin materiales o con el pedido cumplido, no hay nada que fabricar', () => {
  const w = world();
  const s = w.survivors[0]!;
  bill(w, 'bandages');
  expect(then(craftJob(s, w))).toBe('fetchCraft');
  w.furniture = [];
  expect(craftJob(s, w)).toBeNull();
  w.furniture.push({ id: 80, kind: 'table', pos: { x: 5, y: 5 } });
  w.storage.items.cloth = 0;
  expect(craftJob(s, w)).toBeNull();
  w.storage.items.cloth = 6;
  w.storage.items.bandage = BILL_DEFAULT_TARGET; // ya hay las que pide
  expect(craftJob(s, w)).toBeNull();
});

test('herramientas: cortinas sin aguja, no; deshacer cortinas con el cuchillo en la mano, sí', () => {
  const w = world();
  const s = w.survivors[0]!;
  w.storage.items.thread = 10;
  bill(w, 'curtains');
  expect(craftJob(s, w)).toBeNull();
  w.storage.items.needle = 1;
  expect(then(craftJob(s, w))).toBe('fetchCraft');
  w.bills = [];
  w.storage.items.curtains = 1;
  w.storage.items.cloth = 0; // si no, "hasta tener 5 telas" ya estaría cumplido
  bill(w, 'unpick');
  s.equipped = null;
  expect(craftJob(s, w)).toBeNull();
  s.equipped = 'knife';
  expect(then(craftJob(s, w))).toBe('fetchCraft');
});

test('de principio a fin: coge la tela, cose en la mesa (a su ritmo) y lleva las vendas al almacén', () => {
  const w = world();
  const s = w.survivors[0]!;
  const b = bill(w, 'bandages');
  issue(w, { type: 'setBill', billId: b.id, mode: 'count', target: 2 });
  ordersSystem(w);
  let crafting = 0;
  for (let i = 0; i < 4 * TICKS_PER_HOUR; i++) {
    step(w);
    if (s.action.type === 'craft') crafting++;
    const p = checkInvariants(w);
    if (p.length > 0) expect(p, `tick ${w.tick}`).toEqual([]);
  }
  expect(w.storage.items.bandage).toBe(4);
  expect(w.storage.items.cloth).toBe(4);
  expect(b.done).toBe(2);
  expect(s.carrying.bandage + s.carrying.cloth).toBe(0);
  const each = Math.round(RECIPES.bandages.ticks / skillSpeed(10));
  expect(Math.abs(crafting - 2 * each)).toBeLessThanOrEqual(2);
  expect(w.log.filter((e) => e.kind === 'crafted' && e.recipe === 'bandages')).toHaveLength(2);
});

test('dos colonos con un pedido de una vez: solo lo hace uno', () => {
  const w = world();
  const b = bill(w, 'bandages');
  issue(w, { type: 'setBill', billId: b.id, mode: 'count', target: 1 });
  ordersSystem(w);
  const other = addSurvivor(w, { x: 2, y: 1 });
  other.skills.craft.level = 10;
  for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) step(w);
  expect(b.done).toBe(1);
  expect(w.storage.items.bandage).toBe(2);
  expect(w.storage.items.cloth).toBe(5);
});

test('al fallar: pierde la mitad de cada material (hacia arriba), lo demás vuelve al almacén; y aprende igual', () => {
  let failed = false;
  for (let seed = 1; seed <= 60 && !failed; seed++) {
    const w = world();
    w.rng = createRng(seed);
    const s = w.survivors[0]!;
    s.skills.craft = { level: 0, xp: 0 };
    w.storage.items.thread = 10;
    w.storage.items.needle = 1;
    const b = bill(w, 'curtains');
    issue(w, { type: 'setBill', billId: b.id, mode: 'count', target: 1 });
    ordersSystem(w);
    for (let i = 0; i < 6 * TICKS_PER_HOUR && b.done === 0; i++) {
      step(w);
      if (w.log.some((e) => e.kind === 'craftFailed')) break;
    }
    if (!w.log.some((e) => e.kind === 'craftFailed')) continue;
    failed = true;
    expect(w.log.find((e) => e.kind === 'craftFailed')).toMatchObject({
      survivorId: s.id,
      recipe: 'curtains',
      lost: { cloth: 2, thread: 1 },
    });
    expect(s.carrying.cloth + w.storage.items.cloth).toBe(6 - 2);
    expect(s.carrying.thread + w.storage.items.thread).toBe(10 - 1);
    expect(s.skills.craft.xp).toBeGreaterThan(0);
    expect(b.done).toBe(0);
  }
  expect(failed).toBe(true);
});
