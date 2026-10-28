import { expect, test } from 'vitest';
import { newGarment } from './clothes';
import { checkInvariants } from './invariants';
import { createWorld } from './world';

test('detecta NaN (un solo problema)', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos.x = NaN;
  expect(checkInvariants(w)).toHaveLength(1);
});

test('detecta coordenadas infinitas', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos.y = Infinity;
  expect(checkInvariants(w)).toHaveLength(1);
});

test('detecta un superviviente dentro de un muro', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos = { x: w.base.rect.x + 0.5, y: w.base.rect.y + 0.5 };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta un superviviente fuera del mapa', () => {
  const w = createWorld(1);
  w.survivors[0]!.pos = { x: -3, y: 10 };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta ids repetidos', () => {
  const w = createWorld(1);
  w.survivors[1]!.id = w.survivors[0]!.id;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta un tick no válido', () => {
  const w = createWorld(1);
  w.tick = -1;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  w.tick = 1.5;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test.each(['hunger', 'sleep', 'mood'] as const)('detecta %s fuera de 0–100 o no finito', (k) => {
  for (const bad of [-1, 101, NaN]) {
    const w = createWorld(1);
    w.survivors[0]!.needs[k] = bad;
    expect(checkInvariants(w).length).toBeGreaterThan(0);
  }
});

test('detecta comida negativa o no entera', () => {
  for (const bad of [-1, 1.5]) {
    const w = createWorld(1);
    w.storage.items.food = bad;
    expect(checkInvariants(w).length).toBeGreaterThan(0);
  }
});

test('detecta una cama cuyo dueño no existe', () => {
  const w = createWorld(1);
  w.beds[0]!.ownerId = 999;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta objetos negativos o no enteros en el almacén y en la carga', () => {
  for (const bad of [-1, 0.5]) {
    const w = createWorld(1);
    w.storage.items.bandage = bad;
    expect(checkInvariants(w).length).toBeGreaterThan(0);
    const w2 = createWorld(1);
    w2.survivors[0]!.carrying.food = bad;
    expect(checkInvariants(w2).length).toBeGreaterThan(0);
  }
});

test('detecta a quien carga más de 8 kg', () => {
  const w = createWorld(1);
  w.survivors[0]!.carrying.food = 17;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta objetos no válidos en un contenedor', () => {
  const w = createWorld(1);
  w.containers[0]!.items.food = -2;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta una reserva de un superviviente que no existe', () => {
  const w = createWorld(1);
  w.containers[0]!.reservedBy = 999;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta una reserva de alguien que no va a ese contenedor', () => {
  const w = createWorld(1);
  w.containers[0]!.reservedBy = w.survivors[0]!.id;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('detecta a quien va a un contenedor sin tenerlo reservado', () => {
  const w = createWorld(1);
  const c = w.containers[0]!;
  w.survivors[0]!.action = {
    type: 'moveTo',
    target: c.pos,
    then: { type: 'search', containerId: c.id },
  };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  c.reservedBy = w.survivors[0]!.id;
  expect(checkInvariants(w)).toEqual([]);
});

test('detecta opiniones fuera de [−100, 100] y social fuera de rango', () => {
  const w = createWorld(1);
  const [a, b] = w.survivors;
  a!.opinions[b!.id] = 150;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  const w2 = createWorld(1);
  w2.survivors[0]!.needs.social = -3;
  expect(checkInvariants(w2).length).toBeGreaterThan(0);
});

test('detecta parejas que no son mutuas', () => {
  const w = createWorld(1);
  const [a, b] = w.survivors;
  a!.partnerId = b!.id;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  b!.partnerId = a!.id;
  expect(checkInvariants(w)).toEqual([]);
});

test('no tener cama (bedId nulo) es válido', () => {
  const w = createWorld(1);
  const s = w.survivors[0]!;
  w.beds = w.beds.filter((b) => b.ownerId !== s.id);
  s.bedId = null;
  expect(checkInvariants(w)).toEqual([]);
});

test('el desconocido: id distinto de los colonos y necesidades en rango', () => {
  const w = createWorld(1);
  const s = structuredClone(w.survivors[0]!);
  s.name = 'Zoe';
  s.bedId = null;
  w.stranger = { survivors: [s], leaving: false };
  expect(checkInvariants(w).length).toBeGreaterThan(0); // id repetido
  s.id = 99;
  expect(checkInvariants(w)).toEqual([]);
  s.needs.hunger = 120;
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

test('piezas (H5b §1): una en dos sitios o una perdida se detecta', () => {
  const w = createWorld(1);
  const g = newGarment(w, 'cap');
  w.storage.items.pieces.push(g);
  expect(checkInvariants(w)).toEqual([]);
  w.containers[0]!.items.pieces.push(g);
  expect(checkInvariants(w).some((p) => p.includes('pieza'))).toBe(true);
  w.containers[0]!.items.pieces = [];
  w.storage.items.pieces = [];
  expect(checkInvariants(w).some((p) => p.includes('pieza'))).toBe(true);
});
