// @vitest-environment jsdom
// E1: el generador en la interfaz: su letrero, el del fregadero, el menú Construir y el consejo.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../sim/balance';
import { foundBlock } from '../sim/build';
import { createWorld } from '../sim/world';
import { furnitureLabel } from './describe';
import { dueTip } from './guide';

test('el letrero: en marcha, apagado o sin gasolina; el fregadero, con agua del generador', () => {
  const w = createWorld(3);
  const g = { id: 990, kind: 'generator' as const, pos: { x: 1, y: 1 }, fuel: 13.2, on: true };
  w.furniture.push(g);
  expect(furnitureLabel(w, g)).toBe('Generador en marcha · gasolina para 14 h');
  g.on = false;
  expect(furnitureLabel(w, g)).toBe('Generador apagado · gasolina para 14 h');
  g.fuel = 0;
  expect(furnitureLabel(w, g)).toBe(
    'Generador sin gasolina: Transportar le lleva bidones del almacén',
  );
  const sink = w.furniture.find((f) => f.kind === 'sink')!;
  w.waterCutAt = 0;
  w.tick = 10;
  expect(furnitureLabel(w, sink)).toBe('Fregadero (sin agua)');
  g.on = true;
  g.fuel = 5;
  expect(furnitureLabel(w, sink)).toBe('Fregadero (con agua: generador)');
});

test('Construir: hace falta un generador en el almacén y uno solo', () => {
  const w = createWorld(3);
  w.storage.items.generator = 0;
  expect(foundBlock(w, 'generator')).toBe('none');
  w.storage.items.generator = 1;
  expect(foundBlock(w, 'generator')).toBeNull();
  w.furniture.push({ id: 991, kind: 'generator', pos: { x: 1, y: 1 }, fuel: 0, on: true });
  expect(foundBlock(w, 'generator')).toBe('built');
});

test('el consejo, con el primer generador en el almacén', () => {
  const w = createWorld(3);
  w.storage.items.food = 20;
  w.storage.items.seeds = 0;
  w.tick = 2 * TICKS_PER_HOUR;
  const seen = ['pause', 'night', 'zombies', 'bleeding', 'bite', 'food', 'mood', 'siege'] as const;
  expect(dueTip(w, { pausedByNotice: false, zombiesSeen: 0 }, [...seen])).toBeNull();
  w.storage.items.generator = 1;
  expect(dueTip(w, { pausedByNotice: false, zombiesSeen: 0 }, [...seen])).toEqual({
    id: 'generator',
  });
});
