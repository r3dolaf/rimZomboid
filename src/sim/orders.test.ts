import { expect, test } from 'vitest';
import { LOG_MAX } from './balance';
import { logEvent } from './log';
import { issue } from './orders';
import { step } from './step';
import { activitiesSystem } from './systems/activities';
import { decisionsSystem } from './systems/decisions';
import { createWorld } from './world';

test('una orden no cambia nada hasta el siguiente tick, y entonces se aplica y se vacía', () => {
  const w = createWorld(2);
  const h = w.houses[0]!;
  issue(w, { type: 'designateHouse', houseId: h.id, on: true });
  expect(w.containers.some((c) => c.designated)).toBe(false);
  step(w);
  expect(w.orders).toEqual([]);
  for (const c of w.containers.filter((c) => c.houseId === h.id)) expect(c.designated).toBe(true);
  for (const c of w.containers.filter((c) => c.houseId !== h.id)) expect(c.designated).toBe(false);
});

test('desmarcar una casa desmarca sus contenedores', () => {
  const w = createWorld(2);
  const h = w.houses[0]!;
  issue(w, { type: 'designateHouse', houseId: h.id, on: true });
  step(w);
  issue(w, { type: 'designateHouse', houseId: h.id, on: false });
  step(w);
  expect(w.containers.some((c) => c.designated)).toBe(false);
});

test('marcar una casa no marca los contenedores ya registrados y vacíos', () => {
  const w = createWorld(2);
  const h = w.houses[0]!;
  const [c1, c2] = w.containers.filter((c) => c.houseId === h.id);
  c1!.searched = true;
  c1!.items = {
    food: 0,
    bandage: 0,
    knife: 0,
    bat: 0,
    axe: 0,
    wood: 0,
    cloth: 0,
    curtains: 0,
    thread: 0,
    needle: 0,
    crowbar: 0,
    machete: 0,
    painkillers: 0,
  };
  issue(w, { type: 'designateHouse', houseId: h.id, on: true });
  step(w);
  expect(c1!.designated).toBe(false);
  expect(c2!.designated).toBe(true);
});

test('marcar un contenedor concreto', () => {
  const w = createWorld(2);
  const c = w.containers[3]!;
  issue(w, { type: 'designateContainer', containerId: c.id, on: true });
  step(w);
  expect(w.containers.filter((x) => x.designated).map((x) => x.id)).toEqual([c.id]);
});

test('permitir o prohibir saquear a un superviviente', () => {
  const w = createWorld(2);
  const s = w.survivors[0]!;
  issue(w, { type: 'setWork', survivorId: s.id, work: 'loot', enabled: false });
  step(w);
  expect(s.work.loot).toBe(false);
});

test('el Cobarde empieza sin permiso para saquear; el resto, con él', () => {
  for (let seed = 1; seed <= 30; seed++)
    for (const s of createWorld(seed).survivors)
      expect(s.work.loot).toBe(!s.traits.includes('coward'));
});

test('el registro guarda el tick y como mucho LOG_MAX entradas', () => {
  const w = createWorld(2);
  w.tick = 77;
  logEvent(w, { kind: 'outOfFood' });
  expect(w.log.at(-1)).toEqual({ tick: 77, kind: 'outOfFood' });
  for (let i = 0; i < LOG_MAX + 10; i++) logEvent(w, { kind: 'outOfFood' });
  expect(w.log).toHaveLength(LOG_MAX);
});

test('se registran el desplome, la crisis, el desahogo y el almacén sin comida', () => {
  const w = createWorld(2);
  const [a, b, c] = w.survivors;
  a!.needs.sleep = 0;
  decisionsSystem(w);
  expect(w.log.at(-1)).toMatchObject({ kind: 'collapsed', survivorId: a!.id });

  b!.action = { type: 'crisis', ticksLeft: 1 };
  activitiesSystem(w);
  expect(w.log.at(-1)).toMatchObject({ kind: 'vented', survivorId: b!.id });

  w.storage.items.food = 1;
  c!.action = { type: 'eat', ticksLeft: 1 };
  activitiesSystem(w);
  expect(w.log.at(-1)).toMatchObject({ kind: 'outOfFood' });
});

test('se registra el comienzo de una crisis', () => {
  const w = createWorld(2);
  const s = w.survivors[0]!;
  s.action = { type: 'moveTo', target: { x: 0, y: 0 }, then: { type: 'crisis' } };
  s.path = [];
  step(w);
  expect(w.log.some((e) => e.kind === 'crisis' && e.survivorId === s.id)).toBe(true);
});
