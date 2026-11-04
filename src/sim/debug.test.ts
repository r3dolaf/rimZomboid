// H6c §1: las trampas del modo depuración, como órdenes de la simulación: ver todo, dar cosas,
// matar los zombis de cerca (con sus cuerpos, para que cuadren las cuentas) y curar a alguien.
import { expect, test } from 'vitest';
import { addWound } from './body';
import { checkInvariants } from './invariants';
import { issue, ordersSystem } from './orders';
import { emptyWorld } from './testing/fixtures';
import { newZombie } from './zombies/spawn';
import { createWorld } from './world';

test('ver todo: sin niebla en el mapa ni en el mundo', () => {
  const w = createWorld(2);
  issue(w, { type: 'debug', action: 'reveal' });
  ordersSystem(w);
  expect(w.seen.every((v) => v === 1)).toBe(true);
  expect(w.common.atlas.seen.every((v) => v === 1)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('dar: 10 latas, 10 vendas y 10 antibióticos al almacén', () => {
  const w = emptyWorld(10, 10);
  const before = { ...w.storage.items };
  issue(w, { type: 'debug', action: 'give' });
  ordersSystem(w);
  expect(w.storage.items.food).toBe(before.food + 10);
  expect(w.storage.items.bandage).toBe(before.bandage + 10);
  expect(w.storage.items.antibiotics).toBe(before.antibiotics + 10);
});

test('matar los zombis cerca de los colonos (dejan su cuerpo); los lejanos siguen', () => {
  const w = emptyWorld(60, 60);
  const ana = w.survivors[0]!;
  ana.pos = { x: 5.5, y: 5.5 };
  w.zombies.push(newZombie(w, { x: 10, y: 10 }), newZombie(w, { x: 55, y: 55 }));
  issue(w, { type: 'debug', action: 'killNear' });
  ordersSystem(w);
  expect(w.zombies.map((z) => Math.floor(z.pos.x))).toEqual([55]);
  expect(w.containers.some((c) => c.kind === 'corpse')).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('curar al elegido: sin heridas, infección ni fiebre, y con todo lleno', () => {
  const w = emptyWorld(10, 10);
  const ana = w.survivors[0]!;
  addWound(w, ana, 'leftArm', 'bite');
  ana.needs.hunger = 5;
  ana.blood = 40;
  issue(w, { type: 'debug', action: 'heal', survivorId: ana.id });
  ordersSystem(w);
  expect(ana.wounds).toEqual([]);
  expect(ana.infection).toBeNull();
  expect(ana.fever).toBeNull();
  expect(ana.blood).toBe(100);
  expect(ana.needs.hunger).toBe(100);
  expect(checkInvariants(w)).toEqual([]);
});
