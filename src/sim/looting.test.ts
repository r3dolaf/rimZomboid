// Saqueo (H3): buscar contenedores, registrarlos, cargar y descargar en el almacén.
import { expect, test } from 'vitest';
import { withoutZombies, withSkills } from './testing/fixtures';
import { REFUSE_CHANCE, TICKS_PER_DAY } from './balance';
import { brains } from './brain';
import { foodDays } from './colony';
import { checkInvariants } from './invariants';
import { hasCargo } from './jobs/medical';
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
  const w = withSkills(createWorld(3));
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
  // H5: cada uno se queda con hasta 2 vendas encima; lo demás, al almacén.
  for (const s of w.survivors) expect(hasCargo(s)).toBe(false);
  const carried = w.survivors.reduce((n, s) => n + s.carrying.bandage, 0);
  expect(w.storage.items.bandage + carried).toBe(bandages);
  // Las armas, en el almacén o ya en la mano de alguien (spec H4b §6.2), más el cuchillo con que
  // empieza cada uno.
  const inHand = w.survivors.filter((s) => s.equipped === 'knife' || s.equipped === 'bat').length;
  expect(w.storage.items.knife + w.storage.items.bat + inHand).toBe(weapons + w.survivors.length);
  expect(checkInvariants(w)).toEqual([]);
});

test('con dos casas marcadas nunca van dos al mismo contenedor', () => {
  const w = withSkills(createWorld(6));
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
  const w = withoutZombies(withSkills(createWorld(4))); // la casa más lejana es la de más zombis
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
  const w = withSkills(createWorld(seed));
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
  const w = withSkills(createWorld(5));
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
  const w = withSkills(createWorld(5));
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
  const w = withSkills(createWorld(5));
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
  const w = withSkills(createWorld(5));
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
  const w = withSkills(createWorld(5));
  const s = w.survivors[0]!;
  s.traits = ['coward'];
  expect(moodModifiers(s, w.tick, w.base.rect).map((m) => m.id)).not.toContain('scaredOutside');
  s.pos = { x: 2.5, y: 2.5 };
  expect(moodModifiers(s, w.tick, w.base.rect)).toContainEqual({ id: 'scaredOutside', value: -10 });
});

test('una reserva de un superviviente que no va a ese contenedor se libera', () => {
  const w = withSkills(createWorld(5));
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

test('si lo que queda en los contenedores no le cabe, va a descargar (sin bucles)', () => {
  const w = withSkills(createWorld(5));
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  for (const c of w.containers) {
    c.items = { ...emptyInventory(), food: 3 };
    c.searched = true; // se sabe lo que hay
  }
  s.carrying = { ...emptyInventory(), food: 15, bandage: 4 }; // 7,9 kg: no cabe ni una lata
  s.action = { type: 'idle', ticksLeft: 0 };
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'unload').toBe(true);
});

test('un bate que no cabe no le hace volver al mismo contenedor una y otra vez', () => {
  const w = withSkills(createWorld(5));
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  for (const c of w.containers) {
    c.items = { ...emptyInventory(), bat: 1, axe: 0, wood: 0 };
    c.searched = true;
  }
  s.carrying = { ...emptyInventory(), food: 14 }; // 7 kg: el bate (1,5) no cabe
  s.action = { type: 'idle', ticksLeft: 0 };
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'unload').toBe(true);
});

test('con hambre y comida encima, se come una lata de las que lleva', () => {
  const w = withSkills(createWorld(5));
  const s = w.survivors[0]!;
  happy(s);
  w.storage.items.food = 0;
  s.carrying = { ...emptyInventory(), food: 5 };
  s.needs.hunger = 20;
  for (let i = 0; i < 60; i++) step(w);
  expect(s.carrying.food).toBe(4);
  expect(s.needs.hunger).toBeGreaterThan(70);
});

test('con el almacén sin comida, quien lleva comida va primero a descargarla', () => {
  const w = withSkills(createWorld(5));
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  w.storage.items.food = 0;
  s.carrying = { ...emptyInventory(), food: 2 };
  s.action = { type: 'idle', ticksLeft: 0 };
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'unload').toBe(true);
});

test('un contenedor sin registrar no se sabe qué tiene: merece el viaje si cabe lo más ligero', () => {
  const w = withSkills(createWorld(5));
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  for (const c of w.containers) c.items = { ...emptyInventory(), food: 3 }; // sin registrar
  s.carrying = { ...emptyInventory(), food: 15, bandage: 4 }; // 7,9 kg: cabe una venda
  s.action = { type: 'idle', ticksLeft: 0 };
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'search').toBe(true);
});

test('lleno del todo (8 kg), no va a contenedores sin registrar: descarga', () => {
  const w = withSkills(createWorld(5));
  w.survivors.forEach(happy);
  const s = w.survivors[0]!;
  issue(w, { type: 'designateHouse', houseId: w.houses[0]!.id, on: true });
  step(w);
  for (const c of w.containers) c.items = emptyInventory(); // sin registrar y vacíos
  s.carrying = { ...emptyInventory(), food: 16 };
  s.action = { type: 'idle', ticksLeft: 0 };
  const a = brains.ai.decide(s, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'unload').toBe(true);
});

test('días de comida: latas entre lo que comen todos al día', () => {
  const w = withSkills(createWorld(3));
  for (const s of w.survivors) s.carrying.food = 0;
  w.storage.items.food = 7;
  expect(foodDays(w)).toBeCloseTo(7 / (3 * (70 / 60)), 9);
  w.survivors[0]!.carrying.food = 3;
  expect(foodDays(w)).toBeCloseTo(10 / 3.5, 9);
});
