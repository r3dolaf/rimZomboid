import { expect, test } from 'vitest';
import { emptyWorld } from '../sim/testing/fixtures';
import type { Action } from '../sim/types';
import { createWorld } from '../sim/world';
import {
  activityText,
  barLevel,
  buildingThe,
  formatModifier,
  logText,
  noticeFor,
  statusIcon,
} from './describe';

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
    'En crisis: se ha encerrado en la base',
  ],
  [{ type: 'crisis', ticksLeft: 9 }, 'En crisis: se ha encerrado en la base'],
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
  expect(activityText(x, w)).toBe(`Va a saquear ${buildingThe(w, c.houseId)}`);
  x.action = { type: 'search', containerId: c.id, ticksLeft: 3 };
  expect(activityText(x, w)).toMatch(
    /^Registrando (una nevera|un armario|una estantería|un mostrador|una taquilla|una caja|un botiquín)$/,
  );
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

test('ir a un cuerpo dice "Va a registrar un cuerpo", no la casa -1 (H4d)', () => {
  const w = createWorld(2);
  const x = w.survivors[0]!;
  const c = { ...structuredClone(w.containers[0]!), id: 999, houseId: -1, kind: 'corpse' as const };
  w.containers.push(c);
  x.action = { type: 'moveTo', target: c.pos, then: { type: 'search', containerId: c.id } };
  expect(activityText(x, w)).toBe('Va a registrar un cuerpo');
  x.action = { type: 'search', containerId: c.id, ticksLeft: 5 };
  expect(activityText(x, w)).toBe('Registrando un cuerpo');
});

test('V1: el huerto al pasar el ratón', async () => {
  const { plotLabel } = await import('./describe');
  const { GROW_HOURS } = await import('../sim/balance');
  expect(plotLabel({ tile: 0, moisture: 0, crop: null })).toBe('Huerto: sin sembrar');
  expect(
    plotLabel({ tile: 0, moisture: 20, crop: { grown: GROW_HOURS * 0.6, ripe: 0, dry: 0 } }),
  ).toBe('Huerto: creciendo 60 % · húmedo 20 h');
  expect(plotLabel({ tile: 0, moisture: 0, crop: { grown: 1, ripe: 0, dry: 3 } })).toBe(
    'Huerto: creciendo 0 % · seco',
  );
  expect(plotLabel({ tile: 0, moisture: 5, crop: { grown: GROW_HOURS, ripe: 2, dry: 0 } })).toBe(
    'Huerto: maduro, para cosechar',
  );
});

test('V3: la estación y la temperatura, el abrigo en la ficha y 🥶 a quien está helado', async () => {
  const { seasonText, clothesView, healthIcons } = await import('./describe');
  const { emptyWorld } = await import('../sim/testing/fixtures');
  const { dayStart } = await import('../sim/clock');
  const { es } = await import('../i18n/es');
  expect(es.seasonLabel('winter', -4)).toBe('❄️ Invierno · −4 °C');
  expect(es.seasonLabel('summer', 22)).toBe('☀️ Verano · 22 °C');
  const w = emptyWorld(3, 3);
  w.tick = dayStart(20);
  expect(seasonText(w)).toMatch(/^🍂 Otoño · −?\d+ °C$/);
  const s = w.survivors[0]!;
  s.feels = -3;
  expect(clothesView(s).warmth).toMatch(/^Abriga \d+ · sensación −3 °C$/);
  expect(healthIcons(s, 0).map((i) => i.icon)).toContain('🥶');
  s.feels = undefined;
  expect(clothesView(s).warmth).toMatch(/^Abriga \d+$/);
});

test('B2: cada crisis en el registro (el atracón, la rabia y la huida, avisos amarillos) y la inspiración', () => {
  const w = createWorld(3);
  const s = w.survivors[0]!;
  const e = (crisis?: 'sulk' | 'binge' | 'rage' | 'flee', food?: number) =>
    ({
      tick: 0,
      kind: 'crisis',
      survivorId: s.id,
      ...(crisis ? { crisis } : {}),
      ...(food !== undefined ? { food } : {}),
    }) as const;
  expect(logText(e(), w)).toBe(`${s.name} entra en crisis`);
  expect(logText(e('sulk'), w)).toBe(`${s.name} entra en crisis y se encierra`);
  expect(logText(e('binge', 3), w)).toContain('se come 3 raciones');
  expect(logText(e('rage'), w)).toContain('rabia');
  expect(logText(e('flee'), w)).toContain('huye de la base');
  expect(noticeFor(e('sulk'))).toBeNull();
  for (const k of ['binge', 'rage', 'flee'] as const) expect(noticeFor(e(k))?.tone).toBe('mixed');
  const insp = { tick: 0, kind: 'inspired', survivorId: s.id } as const;
  expect(logText(insp, w)).toContain('le llega la inspiración');
  expect(noticeFor(insp)?.tone).toBe('good');
  s.inspiredUntil = 100;
  expect(statusIcon(s)?.icon).toBe('✨');
});
