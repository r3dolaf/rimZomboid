// @vitest-environment jsdom
// H4e: avisos de las hordas y de los desconocidos, la cuenta atrás del asedio y los textos nuevos.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../sim/balance';
import { createTimeController } from '../game/timeController';
import { logEvent, type LogEntry } from '../sim/log';
import { emptyWorld } from '../sim/testing/fixtures';
import type { World } from '../sim/types';
import { activityText, logText, noticeFor, siegeText } from './describe';
import { mountHud } from './hud';

const last = (w: World): LogEntry => w.log.at(-1)!;

test('avisos: el asedio (anunciado y llegado, rojos), resistido (verde), su fin, errantes y huida', () => {
  const w = emptyWorld(10, 10);
  const cases: [Parameters<typeof logEvent>[1], string, string, string][] = [
    [
      { kind: 'siegeAnnounced', side: 0, hours: 60 },
      'bad',
      'Se acerca una horda',
      'Se acerca una horda: llegará en unos 3 días, por el norte',
    ],
    [
      { kind: 'siegeAnnounced', side: 3, hours: 30 },
      'bad',
      'Se acerca una horda',
      'Se acerca una horda: llegará en unas 30 horas, por el este',
    ],
    [{ kind: 'siegeArrived', x: 0, y: 5 }, 'bad', '¡Asedio!', '¡La horda ha llegado!'],
    [{ kind: 'siegeRepelled' }, 'good', 'Asedio resistido', 'Habéis resistido el asedio'],
    [{ kind: 'siegeEnded' }, 'mixed', 'Fin del asedio', 'La horda se dispersa'],
    [
      { kind: 'wanderersSighted', x: 3, y: 4 },
      'mixed',
      'Horda errante',
      'Una horda errante cruza el mapa',
    ],
    [
      { kind: 'strangersFled', names: ['Iris', 'Teo'] },
      'mixed',
      'Huyen',
      'Iris y Teo huyen de los zombis y se marchan',
    ],
  ];
  for (const [e, tone, title, text] of cases) {
    logEvent(w, e);
    expect(noticeFor(last(w))).toMatchObject({ tone, title });
    expect(logText(last(w), w)).toBe(text);
  }
  logEvent(w, { kind: 'siegeArrived', x: 0, y: 5 });
  expect(noticeFor(last(w))!.focusAt).toEqual({ x: 0, y: 5 });
  // Solo al registro.
  const ana = w.survivors[0]!;
  const plain: Parameters<typeof logEvent>[1][] = [
    { kind: 'rescued', survivorId: ana.id, otherId: ana.id },
    { kind: 'bandaged', survivorId: ana.id, otherId: ana.id },
    { kind: 'strangerDowned', names: ['Iris'] },
  ];
  for (const e of plain) {
    logEvent(w, e);
    expect(noticeFor(last(w))).toBeNull();
  }
  expect(logText(last(w), w)).toBe('Ha caído Iris, que esperaba a la puerta');
});

test('cuenta atrás: "Horda en 1 d 14 h", "Horda en 5 h" y, durante el asedio, lo que queda', () => {
  const w = emptyWorld(10, 10);
  expect(siegeText(w)).toBeNull();
  w.siege = { at: w.tick + 38 * TICKS_PER_HOUR, side: 0, size: 10 };
  expect(siegeText(w)).toBe('Horda en 1 d 14 h');
  w.siege.at = w.tick + 5 * TICKS_PER_HOUR - 10;
  expect(siegeText(w)).toBe('Horda en 5 h');
  w.siege = null;
  w.hordes = [
    {
      id: 1,
      kind: 'siege',
      goal: { x: 0, y: 0 },
      until: w.tick + 18 * TICKS_PER_HOUR,
      done: false,
    },
  ];
  expect(siegeText(w)).toBe('Asedio: quedan 18 h');
  w.hordes[0]!.done = true;
  expect(siegeText(w)).toBeNull();
});

test('el HUD enseña la cuenta atrás (en rojo) solo si hay asedio', () => {
  const root = document.createElement('div');
  const hud = mountHud(root, { seed: 1, time: createTimeController() });
  const el = () => root.querySelector('[data-testid="hud-siege"]') as HTMLElement;
  const t = { day: 1, hour: 8, minute: 0 };
  const stock = { ...emptyWorld(2, 2).storage.items };
  hud.update(t, stock, false, 0, null);
  expect(el().hidden).toBe(true);
  hud.update(t, stock, false, 0, 'Horda en 5 h');
  expect(el().hidden).toBe(false);
  expect(el().textContent).toBe('Horda en 5 h');
  expect(el().classList.contains('alert')).toBe(true);
});

test('textos de lo que hace: en modo combate, esperando órdenes', () => {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.drafted = true;
  expect(activityText(s, w)).toBe('En modo combate: esperando órdenes');
  s.action = { type: 'moveTo', target: { x: 3, y: 3 } };
  expect(activityText(s, w)).toBe('En modo combate: yendo');
  s.action = { type: 'melee', zombieId: 1, cooldown: 0 };
  expect(activityText(s, w)).toBe('Peleando con un zombi');
});
