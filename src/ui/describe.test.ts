import { expect, test } from 'vitest';
import { emptyWorld } from '../sim/testing/fixtures';
import type { Action } from '../sim/types';
import { createWorld } from '../sim/world';
import { activityText, barLevel, formatModifier, statusIcon } from './describe';

const s = () => emptyWorld(3, 3).survivors[0]!;

test.each<[Action, string]>([
  [{ type: 'idle', ticksLeft: 5 }, 'Paseando'],
  [{ type: 'moveTo', target: { x: 1, y: 1 } }, 'Paseando'],
  [{ type: 'moveTo', target: { x: 1, y: 1 }, then: { type: 'eat' } }, 'Va a comer'],
  [{ type: 'eat', ticksLeft: 3 }, 'Comiendo'],
  [{ type: 'moveTo', target: { x: 1, y: 1 }, then: { type: 'sleep' } }, 'Va a dormir'],
  [{ type: 'sleep', inBed: true }, 'Durmiendo en su cama'],
  [{ type: 'sleep', inBed: false }, 'Durmiendo en el suelo'],
  [
    { type: 'moveTo', target: { x: 1, y: 1 }, then: { type: 'crisis' } },
    'En crisis: encerrado en la base',
  ],
  [{ type: 'crisis', ticksLeft: 9 }, 'En crisis: encerrado en la base'],
])('activityText(%o) = %s', (action, text) => {
  const x = s();
  x.action = action;
  expect(activityText(x)).toBe(text);
});

test('statusIcon por prioridad: crisis, durmiendo, comiendo, al límite', () => {
  const x = s();
  x.needs.mood = 20;
  expect(statusIcon(x)?.icon).toBe('⚠');
  x.action = { type: 'eat', ticksLeft: 1 };
  expect(statusIcon(x)?.icon).toBe('🍽');
  x.action = { type: 'sleep', inBed: true };
  expect(statusIcon(x)?.icon).toBe('💤');
  x.action = { type: 'crisis', ticksLeft: 1 };
  expect(statusIcon(x)?.icon).toBe('🌀');
  x.action = { type: 'idle', ticksLeft: 0 };
  x.needs.mood = 60;
  expect(statusIcon(x)).toBeNull();
});

test('barLevel: necesidades amarillo < 35 y rojo < 15; ánimo < 25 y < 10', () => {
  expect([barLevel(40, 'need'), barLevel(34, 'need'), barLevel(14, 'need')]).toEqual([
    'ok',
    'warn',
    'bad',
  ]);
  expect([barLevel(30, 'mood'), barLevel(24, 'mood'), barLevel(9, 'mood')]).toEqual([
    'ok',
    'warn',
    'bad',
  ]);
});

test('formatModifier muestra el signo y, en los recuerdos, las horas que quedan', () => {
  expect(formatModifier({ id: 'hungry', value: -10 }, 0)).toBe('Hambriento −10');
  expect(formatModifier({ id: 'ate', value: 5, expiresAt: 650 }, 0)).toBe('Comió +5 (quedan 3 h)');
});

test('textos del saqueo', () => {
  const w = createWorld(3);
  const x = w.survivors[0]!;
  const c = w.containers.find((k) => k.kind === 'fridge') ?? w.containers[0]!;
  x.action = { type: 'moveTo', target: c.pos, then: { type: 'search', containerId: c.id } };
  expect(activityText(x, w)).toBe(`Va a saquear la casa ${c.houseId}`);
  x.action = { type: 'search', containerId: c.id, ticksLeft: 3 };
  expect(activityText(x, w)).toMatch(/^Registrando (una nevera|un armario|una estantería)$/);
  x.action = { type: 'moveTo', target: c.pos, then: { type: 'unload' } };
  expect(activityText(x, w)).toBe('Llevando cosas al almacén');
  x.action = { type: 'idle', ticksLeft: 50, wait: 'refused' };
  expect(activityText(x, w)).toBe('Se niega a trabajar');
  x.action = { type: 'idle', ticksLeft: 5, wait: 'noPath' };
  expect(activityText(x, w)).toBe('No puede llegar');
});

test('pelea: actividad con el nombre del otro e icono 🥊', () => {
  const w = createWorld(3);
  const [x, y] = w.survivors;
  x!.action = { type: 'fight', otherId: y!.id, ticksLeft: 5 };
  expect(activityText(x!, w)).toBe(`Peleándose con ${y!.name}`);
  expect(statusIcon(x!)?.icon).toBe('🥊');
});
