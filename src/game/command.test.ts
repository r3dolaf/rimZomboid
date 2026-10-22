// H4e §3.2: lo que manda el ratón y la R en modo combate (puro: sin Phaser).
import { expect, test } from 'vitest';
import { hurtSurvivor } from '../sim/health';
import { issue, ordersSystem } from '../sim/orders';
import { addSurvivor, emptyWorld } from '../sim/testing/fixtures';
import type { World } from '../sim/types';
import { newZombie } from '../sim/zombies/spawn';
import { commandAt, draftToggle, effectiveDrafted } from './command';

function world(): World {
  const w = emptyWorld(30, 30);
  w.survivors[0]!.pos = { x: 5.5, y: 5.5 };
  addSurvivor(w, { x: 6, y: 5 });
  addSurvivor(w, { x: 7, y: 5 });
  return w;
}

test('R: si alguno no está en modo combate, lo ponen todos; si lo están todos, lo quitan', () => {
  const w = world();
  const [a, b] = w.survivors;
  expect(draftToggle(w, [a!.id, b!.id])).toEqual({
    type: 'draft',
    survivorIds: [a!.id, b!.id],
    on: true,
  });
  a!.drafted = true;
  expect(
    draftToggle(w, [a!.id, b!.id])!.type === 'draft' && draftToggle(w, [a!.id, b!.id]),
  ).toMatchObject({ on: true });
  b!.drafted = true;
  expect(draftToggle(w, [a!.id, b!.id])).toMatchObject({ on: false });
  expect(draftToggle(w, [])).toBeNull();
});

test('R: el derribado no cuenta (no se le puede poner)', () => {
  const w = world();
  const [a, b] = w.survivors;
  a!.drafted = true;
  hurtSurvivor(w, b!, 200);
  expect(draftToggle(w, [a!.id, b!.id])).toMatchObject({ on: false });
});

test('en pausa se ve al momento (las órdenes pendientes cuentan)', () => {
  const w = world();
  const a = w.survivors[0]!;
  issue(w, { type: 'draft', survivorIds: [a.id], on: true });
  expect(effectiveDrafted(w, a)).toBe(true);
  expect(draftToggle(w, [a.id])).toMatchObject({ on: false });
  ordersSystem(w);
  expect(a.drafted).toBe(true);
});

test('clic derecho: zombi a la vista → atacar; derribado → rescatar; si no, ir', () => {
  const w = world();
  const [a, b, c] = w.survivors;
  a!.drafted = true;
  b!.drafted = true;
  const ids = [a!.id, b!.id];
  const z = newZombie(w, { x: 20, y: 20 });
  w.zombies.push(z);
  const seen = () => true;
  expect(commandAt(w, ids, { x: 20.4, y: 20.6 }, seen)).toEqual({
    type: 'draftAttack',
    survivorIds: ids,
    zombieId: z.id,
  });
  // El que no se ve no cuenta: se va allí.
  expect(commandAt(w, ids, { x: 20.4, y: 20.6 }, () => false)).toEqual({
    type: 'draftMove',
    survivorIds: ids,
    x: 20,
    y: 20,
  });
  hurtSurvivor(w, c!, 200);
  expect(commandAt(w, ids, { x: c!.pos.x, y: c!.pos.y }, seen)).toEqual({
    type: 'draftRescue',
    survivorId: a!.id,
    downedId: c!.id,
  });
  // Sin nadie en modo combate, nada.
  a!.drafted = false;
  b!.drafted = false;
  expect(commandAt(w, ids, { x: 3.5, y: 3.5 }, seen)).toBeNull();
});
