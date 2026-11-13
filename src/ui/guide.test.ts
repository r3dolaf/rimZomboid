import { expect, test } from 'vitest';
import { COLD_BELOW, SEASON_DAYS, TICKS_PER_DAY, TICKS_PER_HOUR } from '../sim/balance';
import { setTile } from '../sim/map/grid';
import { emptyInventory } from '../sim/items';
import { Tile } from '../sim/types';
import { createWorld } from '../sim/world';
import {
  currentStep,
  dueTip,
  GUIDE_STEPS,
  stepDone,
  type GuideSeen,
  type TipContext,
} from './guide';

const nothing: GuideSeen = { selected: false, fast: false, workOpened: false };
const calm: TipContext = { pausedByNotice: false, zombiesSeen: 0 };

test('al empezar, ningún paso está hecho y toca el primero', () => {
  const w = createWorld(5);
  w.storage.items.wood = 0;
  w.furniture = w.furniture.filter((f) => f.kind !== 'table');
  expect(GUIDE_STEPS.filter((s) => stepDone(s, w, nothing))).toEqual([]);
  expect(currentStep([])).toBe('people');
  expect(currentStep(['people', 'wood'])).toBe('loot');
  expect(currentStep([...GUIDE_STEPS])).toBeNull();
});

test('cada paso se da por hecho al hacerlo (también con lo pedido en pausa)', () => {
  const w = createWorld(5);
  w.storage.items.wood = 0;
  w.furniture = w.furniture.filter((f) => f.kind !== 'table');
  expect(stepDone('people', w, { ...nothing, selected: true })).toBe(true);
  expect(stepDone('time', w, { ...nothing, fast: true })).toBe(true);
  expect(stepDone('work', w, { ...nothing, workOpened: true })).toBe(true);

  const c = w.containers.find((x) => x.houseId >= 0)!;
  w.orders.push({ type: 'designateContainer', containerId: c.id, on: true });
  expect(stepDone('loot', w, nothing)).toBe(true);

  setTile(w.grid, 1, 1, Tile.Tree);
  w.orders.push({ type: 'markTree', x: 1, y: 1, on: true });
  expect(stepDone('wood', w, nothing)).toBe(true);

  const { x, y } = w.base.rect;
  w.orders.push({ type: 'placeBlueprint', kind: 'board', x, y });
  expect(stepDone('windows', w, nothing)).toBe(true);
  w.orders.push({ type: 'placeBlueprint', kind: 'table', x: x + 2, y: y + 2 });
  expect(stepDone('table', w, nothing)).toBe(true);
});

test('una ventana ya tapiada en la base y madera en el almacén cuentan', () => {
  const w = createWorld(5);
  const { x, y } = w.base.rect;
  setTile(w.grid, x, y, Tile.BoardedWindow);
  expect(stepDone('windows', w, nothing)).toBe(true);
  w.storage.items.wood = 2;
  expect(stepDone('wood', w, nothing)).toBe(true);
});

test('consejos: cada uno cuando pasa, en orden, y no los ya vistos', () => {
  const w = createWorld(5);
  w.storage.items.food = 20;
  expect(dueTip(w, calm, [])).toBeNull();
  expect(dueTip(w, { ...calm, pausedByNotice: true }, [])).toEqual({ id: 'pause' });
  expect(dueTip(w, { ...calm, zombiesSeen: 2 }, [])).toEqual({ id: 'zombies' });
  expect(dueTip(w, { ...calm, zombiesSeen: 2 }, ['zombies'])).toBeNull();
  const s = w.survivors[0]!;
  s.wounds.push({
    id: 1,
    part: 'leftArm',
    kind: 'bite',
    size: 1,
    damage: 5,
    at: w.tick,
    bleeding: true,
    cleanUntil: 0,
  });
  expect(dueTip(w, calm, [])).toEqual({ id: 'bleeding', who: s.name });
  expect(dueTip(w, calm, ['bleeding'])).toEqual({ id: 'bite', who: s.name });
  w.storage.items = emptyInventory();
  expect(dueTip(w, calm, ['bleeding', 'bite'])).toEqual({ id: 'food' });
  w.survivors[1]!.needs.mood = 12;
  expect(dueTip(w, calm, ['bleeding', 'bite', 'food'])).toEqual({
    id: 'mood',
    who: w.survivors[1]!.name,
  });
});

test('consejos: la noche y el asedio anunciado', () => {
  const w = createWorld(5);
  w.storage.items.food = 20;
  w.tick = 0;
  while (true) {
    w.tick += TICKS_PER_HOUR;
    if (dueTip(w, calm, [])) break;
  }
  expect(dueTip(w, calm, [])).toEqual({ id: 'night' });
  w.siege = { at: w.tick + 48 * TICKS_PER_HOUR, side: 0, size: 10 };
  expect(dueTip(w, calm, ['night'])).toEqual({ id: 'siege' });
});

// U2: los consejos de lo nuevo (el huerto, las hortalizas, el agua, el frío, el otoño, la crisis).
const MANY = ['pause', 'night', 'zombies', 'bleeding', 'bite', 'food', 'mood', 'siege'] as const;

test('U2: «poca comida» cuenta las hortalizas y los guisos, no solo las latas', () => {
  const w = createWorld(5);
  w.storage.items = emptyInventory();
  w.storage.items.stewVeg = 10;
  expect(dueTip(w, calm, [])).toBeNull();
  w.storage.items.stewVeg = 0;
  expect(dueTip(w, calm, [])).toEqual({ id: 'food' });
});

test('U2: el huerto, desde el día 2 con semillas y sin huerto; las primeras hortalizas', () => {
  const w = createWorld(5);
  w.storage.items.food = 20;
  w.storage.items.seedsPotato = 6;
  w.tick = 2 * TICKS_PER_HOUR; // día 1, a las 10
  expect(dueTip(w, calm, [...MANY])).toBeNull();
  w.tick = 20 * TICKS_PER_HOUR; // día 2, a las 4
  expect(dueTip(w, calm, [...MANY])).toEqual({ id: 'farm' });
  w.plots.push({ tile: 1, kind: 'potato', crop: null, moisture: 0 });
  expect(dueTip(w, calm, [...MANY])).toBeNull();
  w.storage.items.potato = 3;
  expect(dueTip(w, calm, [...MANY])).toEqual({ id: 'veg' });
});

test('U2: el corte del agua, el frío, el otoño y la crisis', () => {
  const w = createWorld(5);
  w.storage.items.food = 20;
  w.storage.items.seedsPotato = 0;
  w.tick = 2 * TICKS_PER_HOUR;
  w.waterCutAt = w.tick + 1;
  expect(dueTip(w, calm, [...MANY])).toBeNull();
  w.waterCutAt = w.tick;
  expect(dueTip(w, calm, [...MANY])).toEqual({ id: 'water' });
  const seen = [...MANY, 'water'] as const;
  const s = w.survivors[0]!;
  s.feels = COLD_BELOW + 1;
  expect(dueTip(w, calm, [...seen])).toBeNull();
  s.feels = COLD_BELOW - 1;
  expect(dueTip(w, calm, [...seen])).toEqual({ id: 'cold', who: s.name });
  s.feels = undefined;
  s.action = { type: 'crisis', ticksLeft: 100, kind: 'flee' };
  expect(dueTip(w, calm, [...seen])).toEqual({ id: 'crisis', who: s.name });
  s.action = { type: 'idle', ticksLeft: 0 };
  w.tick = SEASON_DAYS * TICKS_PER_DAY; // ya en otoño (el día 16)
  expect(dueTip(w, calm, [...seen])).toEqual({ id: 'autumn' });
});

test('D1: el consejo del arma de fuego, con la primera en el almacén', () => {
  const w = createWorld(5);
  w.storage.items.food = 20;
  w.storage.items.seedsPotato = 0;
  w.tick = 2 * TICKS_PER_HOUR;
  expect(dueTip(w, calm, [...MANY])).toBeNull();
  w.storage.items.shotgun = 1;
  expect(dueTip(w, calm, [...MANY])).toEqual({ id: 'gun' });
});
