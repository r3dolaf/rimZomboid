// H5b2 §1 y §3: cargar con bolsas (lo de dentro pesa menos al andar) y usar lo que llevan dentro.
import { expect, test } from 'vitest';
import { LOAD_BRAKE_BASE, LOAD_BRAKE_PER_LEVEL } from './balance';
import { has, newBag, personal, reserved, spend, stashOne } from './bags';
import { totalFood } from './colony';
import { selfCare } from './jobs/medical';
import { equipFromPack } from './jobs/weapons';
import { capacityKg, effectiveLoad, loadFactor } from './skills';
import { activitiesSystem } from './systems/activities';
import { emptyWorld } from './testing/fixtures';
import type { Survivor, World } from './types';

function ana(): { w: World; s: Survivor } {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.carrying.bandage = 0;
  return { w, s };
}

test('al andar, lo de la bolsa pesa menos (su porcentaje) y la bolsa vacía, entera', () => {
  const { w, s } = ana();
  const pack = newBag(w, 'hikingPack');
  pack.items.food = 10; // 5 kg
  s.bags.back = pack;
  s.carrying.wood = 2; // 2 kg en las manos
  expect(effectiveLoad(s)).toBeCloseTo(2 + 1.5 + 5 * 0.6, 9);
  const brake = LOAD_BRAKE_BASE - LOAD_BRAKE_PER_LEVEL * s.skills.haul.level;
  expect(loadFactor(s)).toBeCloseTo(1 - brake * Math.min(1, 6.5 / capacityKg(s)), 9);
});

test('reservado, lo de la persona y lo que tiene: la lista de la bolsa aparta lo suyo', () => {
  const { w, s } = ana();
  const b = newBag(w, 'schoolBag');
  b.list = { bandage: 2 };
  b.items.bandage = 3;
  s.bags.back = b;
  s.carrying.bandage = 1;
  expect(reserved(b, 'bandage')).toBe(2);
  expect(personal(s, 'bandage')).toBe(2); // 1 en la mano + 1 sin reservar
  expect(has(s, 'bandage')).toBe(4);
  // Gasta primero lo de las manos, luego lo no reservado y por último lo reservado.
  expect(spend(s, 'bandage')).toBe(1);
  expect([s.carrying.bandage, b.items.bandage]).toEqual([0, 3]);
  expect(spend(s, 'bandage')).toBe(1);
  expect(b.items.bandage).toBe(2);
  expect(spend(s, 'bandage', 5)).toBe(2);
  expect(has(s, 'bandage')).toBe(0);
});

test('guardar una cosa: en la bolsa que la pide, si no en la de más sitio, si no en las manos', () => {
  const { w, s } = ana();
  const fanny = newBag(w, 'fannyPack');
  fanny.list = { food: 1 };
  const pack = newBag(w, 'schoolBag');
  s.bags.waist = fanny;
  s.bags.back = pack;
  expect(stashOne(s, 'food')).toBe(true);
  expect(fanny.items.food).toBe(1);
  expect(stashOne(s, 'food')).toBe(true);
  expect(pack.items.food).toBe(1); // la riñonera ya tiene la suya: a la de más sitio
  pack.items.wood = 5;
  pack.items.bandage = 1; // 5,6 kg de 6: no cabe otra lata (0,5 kg)
  fanny.items.wood = 1;
  fanny.items.bandage = 1; // 1,6 kg de 2
  s.carrying.wood = 0;
  expect(stashOne(s, 'food')).toBe(true);
  expect(s.carrying.food).toBe(1);
  s.carrying.wood = Math.ceil(capacityKg(s)); // manos llenas
  expect(stashOne(s, 'food')).toBe(false);
});

test('come de su bolsa si no lleva comida en las manos', () => {
  const { w, s } = ana();
  const b = newBag(w, 'schoolBag');
  b.items.food = 1;
  s.bags.back = b;
  s.needs.hunger = 10;
  s.action = { type: 'eat', ticksLeft: 1, fromPack: true };
  activitiesSystem(w);
  expect(b.items.food).toBe(0);
  expect(s.needs.hunger).toBeGreaterThan(10);
});

test('se venda con las vendas de la bolsa (sin ir al almacén)', () => {
  const { w, s } = ana();
  const b = newBag(w, 'fannyPack');
  b.items.bandage = 1;
  s.bags.waist = b;
  s.wounds.push({
    id: 1,
    part: 'leftArm',
    kind: 'scratch',
    size: 5,
    damage: 5,
    at: 0,
    bleeding: true,
    cleanUntil: 0,
  });
  expect(selfCare(s, w)).toMatchObject({ type: 'bandage', patientId: s.id });
});

test('la comida de la colonia cuenta la de sus bolsas; el arma de repuesto de la bolsa, también', () => {
  const { w, s } = ana();
  const before = totalFood(w);
  const b = newBag(w, 'duffel');
  b.items.food = 3;
  b.items.machete = 1;
  s.bags.back = b;
  expect(totalFood(w)).toBe(before + 3);
  s.equipped = 'knife';
  equipFromPack(s);
  expect(s.equipped).toBe('machete');
  expect(has(s, 'machete')).toBe(0);
  expect(has(s, 'knife')).toBe(1);
});
