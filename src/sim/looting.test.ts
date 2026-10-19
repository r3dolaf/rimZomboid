// Saqueo (H3): buscar contenedores, registrarlos, cargar y descargar en el almacén.
import { expect, test } from 'vitest';
import { REFUSE_CHANCE, TICKS_PER_DAY } from './balance';
import { brains } from './brain';
import { checkInvariants } from './invariants';
import { emptyInventory, isEmpty } from './items';
import { moodModifiers } from './mood';
import { issue } from './orders';
import { createRng } from './rng';
import { step } from './step';
import type { Survivor, World } from './types';
import { createWorld } from './world';
import { targetContainerId } from './work';

const happy = (s: Survivor) => {
  s.needs.hunger = 100;
  s.needs.sleep = 100;
  s.needs.mood = 70;
  s.work.loot = true;
};
const dist = (w: World, id: number) => {
  const h = w.houses.find((x) => x.id === id)!;
  return Math.hypot(h.door.x - w.base.door.x, h.door.y - w.base.door.y);
};
const byDistance = (w: World) => [...w.houses].sort((a, b) => dist(w, a.id) - dist(w, b.id));

test('marcar la casa más cercana: la vacían y sus objetos acaban en el almacén', () => {
  const w = createWorld(3);
  w.survivors.forEach(happy);
  const house = byDistance(w)[0]!;
  const inHouse = w.containers.filter((c) => c.houseId === house.id);
  const bandages = inHouse.reduce((n, c) => n + c.items.bandage, 0);
  const weapons = inHouse.reduce((n, c) => n + c.items.knife + c.items.bat, 0);
  issue(w, { type: 'designateHouse', houseId: house.id, on: true });
  for (let i = 0; i < TICKS_PER_DAY; i++) step(w);
  for (const c of inHouse) {
    expect(isEmpty(c.items)).toBe(true);
    expect(c.designated).toBe(false);
  }
  expect(w.log.some((e) => e.kind === 'houseEmptied' && e.houseId === house.id)).toBe(true);
  expect(w.log.some((e) => e.kind === 'found')).toBe(true);
  for (const s of w.survivors) expect(isEmpty(s.carrying)).toBe(true);
  expect(w.storage.items.bandage).toBe(bandages);
  expect(w.storage.items.knife + w.storage.items.bat).toBe(weapons);
  expect(checkInvariants(w)).toEqual([]);
});

test('con dos casas marcadas nunca van dos al mismo contenedor', () => {
  const w = createWorld(6);
  w.survivors.forEach(happy);
  for (const h of byDistance(w).slice(0, 2))
    issue(w, { type: 'designateHouse', houseId: h.id, on: true });
  for (let i = 0; i < 2 * TICKS_PER_DAY; i++) {
    step(w);
    const targets = w.survivors.map(targetContainerId).filter((id) => id !== null);
    expect(new Set(targets).size).toBe(targets.length);
  }
});

test('una casa marcada sin ver se descubre al llegar', () => {
  const w = createWorld(4);
  w.survivors.forEach(happy);
  const far = byDistance(w).at(-1)!;
  const c = w.containers.find((x) => x.houseId === far.id)!;
  expect(w.seen[c.pos.y * w.grid.width + c.pos.x]).toBe(0);
  issue(w, { type: 'designateHouse', houseId: far.id, on: true });
  for (let i = 0; i < TICKS_PER_DAY && !c.searched; i++) step(w);
  expect(c.searched).toBe(true);
  expect(w.seen[c.pos.y * w.grid.width + c.pos.x]).toBe(1);
});

function goingToLoot(seed: number) {
  const w = createWorld(seed);
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  w.survivors.slice(1).forEach((x) => (x.work.loot = false));
  const house = byDistance(w).at(-1)!;
  issue(w, { type: 'designateHouse', houseId: house.id, on: true });
  for (let i = 0; i < 50 && targetContainerId(s) === null; i++) step(w);
  const c = w.containers.find((x) => x.id === targetContainerId(s))!;
  expect(c.reservedBy).toBe(s.id);
  return { w, s, c, house };
}

test('una urgencia interrumpe el saqueo y libera la reserva', () => {
  const { w, s, c } = goingToLoot(5);
  s.needs.hunger = 10;
  step(w);
  expect(targetContainerId(s)).toBeNull();
  expect(c.reservedBy).toBeNull();
});

test('desmarcar la casa mientras va hacia ella: lo deja y libera la reserva', () => {
  const { w, s, c, house } = goingToLoot(5);
  issue(w, { type: 'designateHouse', houseId: house.id, on: false });
  step(w);
  step(w);
  expect(targetContainerId(s)).toBeNull();
  expect(c.reservedBy).toBeNull();
});

test('sin permiso para saquear no sale, pero si lleva algo lo descarga', () => {
  const w = createWorld(5);
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  s.work.loot = false;
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  expect(targetContainerId(s)).toBeNull();
  s.carrying = { ...emptyInventory(), food: 3 };
  s.action = { type: 'idle', ticksLeft: 0 };
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'unload').toBe(true);
});

test('lleno, va a descargar al almacén', () => {
  const w = createWorld(5);
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  s.carrying = { ...emptyInventory(), food: 16 };
  s.action = { type: 'idle', ticksLeft: 0 };
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'unload').toBe(true);
});

test('al límite se niega a trabajar más o menos la mitad de las veces', () => {
  const w = createWorld(5);
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  let refused = 0;
  const N = 400;
  w.rng = createRng(123);
  for (let i = 0; i < N; i++) {
    s.needs.mood = 20;
    s.action = { type: 'idle', ticksLeft: 0 };
    const a = brains.ai.decide(s, w);
    if (a?.type === 'idle' && a.wait === 'refused') refused++;
  }
  expect(refused / N).toBeGreaterThan(REFUSE_CHANCE - 0.1);
  expect(refused / N).toBeLessThan(REFUSE_CHANCE + 0.1);
  expect(w.log.some((e) => e.kind === 'refused' && e.survivorId === s.id)).toBe(true);
});

test('mientras espera tras negarse, no trabaja pero sí atiende urgencias', () => {
  const w = createWorld(5);
  const s = w.survivors[0]!;
  happy(s);
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  s.action = { type: 'idle', ticksLeft: 100, wait: 'refused' };
  expect(brains.ai.decide(s, w)).toBeNull();
  s.needs.hunger = 10;
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'eat').toBe(true);
});

test('el Cobarde tiene −10 de ánimo fuera de la base', () => {
  const w = createWorld(5);
  const s = w.survivors[0]!;
  s.traits = ['coward'];
  expect(moodModifiers(s, w.tick, w.base.rect).map((m) => m.id)).not.toContain('scaredOutside');
  s.pos = { x: 2.5, y: 2.5 };
  expect(moodModifiers(s, w.tick, w.base.rect)).toContainEqual({ id: 'scaredOutside', value: -10 });
});

test('una reserva de un superviviente que no va a ese contenedor se libera', () => {
  const w = createWorld(5);
  const c = w.containers[0]!;
  c.reservedBy = w.survivors[0]!.id;
  step(w);
  expect(c.reservedBy).toBeNull();
});

test('registrar un contenedor sin espacio deja lo que no cabe y sigue marcado', () => {
  const { w, s, c } = goingToLoot(5);
  c.items = { ...emptyInventory(), food: 30 };
  s.carrying = { ...emptyInventory(), food: 10 };
  s.pos = { x: c.pos.x + 0.5, y: c.pos.y + 0.5 };
  s.path = [];
  s.action = { type: 'search', containerId: c.id, ticksLeft: 1 };
  step(w);
  expect(s.carrying.food).toBe(16);
  expect(c.items.food).toBe(24);
  expect(c.designated).toBe(true);
  expect(c.searched).toBe(true);
});
