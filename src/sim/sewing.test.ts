// H5b §3: coser — remendar, reforzar y descoser ropa en la mesa, sobre prendas del almacén.
import { expect, test } from 'vitest';
import { RECIPES } from './balance';
import { newGarment } from './clothes';
import { checkInvariants } from './invariants';
import { finishCraft } from './jobs/craft';
import { issue, ordersSystem } from './orders';
import { step } from './step';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Garment, type RecipeId, type World } from './types';

/** Una mesa en (5, 5), el almacén en (1, 1) con aguja, hilo y cuchillo, y Ana (solo Fabricar). */
function world(): World {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.furniture.push({ id: 80, kind: 'table', pos: { x: 5, y: 5 } });
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.food = 50;
  w.storage.items.needle = 1;
  w.storage.items.thread = 10;
  w.storage.items.knife = 1;
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 2.5 };
  s.work = {
    heal: false,
    social: false,
    build: false,
    craft: true,
    haul: false,
    chop: false,
    loot: false,
  };
  s.equipped = null;
  s.skills.craft.level = 10; // no falla (los fallos, en su test)
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
  s.nextChatAt = 1e9;
  // Que no se ponga la ropa que hay que coser (H5b: se vestiría con ella).
  w.outfits[0]!.allowed = ['tshirt', 'jeans'];
  return w;
}

function stored(w: World, g: Garment): Garment {
  w.storage.items.pieces.push(g);
  return g;
}

const bill = (w: World, recipe: RecipeId) => {
  issue(w, { type: 'addBill', recipe });
  ordersSystem(w);
  return w.bills.at(-1)!;
};

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(w);
};

test('las recetas de prendas trabajan sobre una prenda y empiezan en "Siempre que haya"', () => {
  expect(RECIPES.mend).toMatchObject({ input: { thread: 1 }, material: 1, tool: 'needle' });
  expect(RECIPES.pad).toMatchObject({ input: { thread: 1 }, material: 1, tool: 'needle' });
  expect(RECIPES.unpickGarment).toMatchObject({ input: {}, tool: 'knife' });
  const w = world();
  const b = bill(w, 'mend');
  expect(b.mode).toBe('always');
  issue(w, { type: 'setBill', billId: b.id, mode: 'until' });
  ordersSystem(w);
  expect(b.mode).toBe('always'); // "hasta tener" no vale para prendas
  issue(w, { type: 'setBill', billId: b.id, mode: 'count', target: 2 });
  ordersSystem(w);
  expect(b).toMatchObject({ mode: 'count', target: 2 });
  expect(bill(w, 'bandages').mode).toBe('until');
});

test('Remendar: lleva la prenda a la mesa y tapa el agujero de la zona más golpeada con el mejor material', () => {
  const w = world();
  w.storage.items.denim = 1;
  const jacket = stored(w, newGarment(w, 'denimJacket'));
  jacket.holes.push('leftArm', 'torso');
  bill(w, 'mend');
  for (let i = 0; i < 1200 && jacket.holes.length === 2; i++) step(w);
  expect(jacket.holes).toEqual(['leftArm']);
  expect(jacket.patches).toEqual({ torso: 'denim' });
  expect(w.storage.items.denim).toBe(0);
  expect(w.storage.items.thread).toBeLessThanOrEqual(9);
  run(w, 100); // lo devuelve al almacén
  expect(w.storage.items.pieces).toContain(jacket);
  expect(w.log).toContainEqual(
    expect.objectContaining({ kind: 'crafted', recipe: 'mend', garment: 'denimJacket' }),
  );
  // Y luego el otro, con tela.
  w.storage.items.cloth = 2;
  run(w, 600);
  expect(jacket.holes).toEqual([]);
  expect(jacket.patches).toEqual({ torso: 'denim', leftArm: 'cloth' });
  expect(checkInvariants(w)).toEqual([]);
});

test('Reforzar: la zona más golpeada sin agujero ni refuerzo; "Siempre que haya" para cuando no queda', () => {
  const w = world();
  w.storage.items.leather = 5;
  const pants = stored(w, newGarment(w, 'workPants'));
  pants.pads.leftLeg = 'cloth';
  bill(w, 'pad');
  run(w, 600);
  expect(pants.pads).toEqual({ leftLeg: 'cloth', rightLeg: 'leather' });
  run(w, 1200);
  expect(w.storage.items.leather).toBe(4); // ya no queda dónde
  expect(w.survivors[0]!.action.type).not.toBe('craft');
  expect(checkInvariants(w)).toEqual([]);
});

test('Descoser ropa: la destrozada se convierte en lo del catálogo (con cuchillo); el casco, no', () => {
  const w = world();
  const jacket = stored(w, newGarment(w, 'denimJacket'));
  jacket.holes.push('torso', 'leftArm', 'rightArm');
  const torn = stored(w, newGarment(w, 'shirt'));
  torn.holes.push('torso'); // no destrozada
  const helmet = stored(w, newGarment(w, 'helmet'));
  helmet.holes.push('head');
  const gone = w.pieceLog.gone;
  bill(w, 'unpickGarment');
  run(w, 1200);
  expect(w.storage.items.denim).toBe(3);
  expect(w.storage.items.pieces).toEqual([torn, helmet]);
  expect(w.pieceLog.gone).toBe(gone + 1);
  expect(checkInvariants(w)).toEqual([]);
});

test('al fallar se pierden el hilo y el material y la prenda queda igual', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.skills.craft.level = 0;
  s.traits = ['clumsy'];
  const b = bill(w, 'mend');
  let fails = 0;
  let oks = 0;
  for (let i = 0; i < 200; i++) {
    const g = newGarment(w, 'jeans');
    g.holes.push('leftLeg');
    s.carrying = { ...s.carrying, thread: 1, denim: 1, pieces: [g] };
    finishCraft(w, s, { billId: b.id, recipe: 'mend', pieceId: g.id, material: 'denim' });
    expect(s.carrying.thread).toBe(0);
    expect(s.carrying.denim).toBe(0);
    if (g.holes.length === 1) fails++;
    else oks++;
    expect(s.carrying.pieces).toEqual([g]);
  }
  expect(fails).toBeGreaterThan(0);
  expect(oks).toBeGreaterThan(0);
});

test('si se quita el pedido a medias, la prenda vuelve al almacén', () => {
  const w = world();
  w.storage.items.cloth = 1;
  const shirt = stored(w, newGarment(w, 'shirt'));
  shirt.holes.push('torso');
  const b = bill(w, 'mend');
  const s = w.survivors[0]!;
  for (let i = 0; i < 600 && s.action.type !== 'craft'; i++) step(w);
  expect(s.action.type).toBe('craft');
  expect(s.carrying.pieces).toEqual([shirt]);
  issue(w, { type: 'removeBill', billId: b.id });
  run(w, 600);
  expect(w.storage.items.pieces).toContain(shirt);
  expect(checkInvariants(w)).toEqual([]);
});
