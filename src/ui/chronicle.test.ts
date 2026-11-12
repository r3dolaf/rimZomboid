// C3: las líneas de la crónica, las que van en la imagen y el texto para compartir.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from '../sim/balance';
import { logEvent } from '../sim/log';
import { createWorld } from '../sim/world';
import { chronicleLines, imageLines, shareText, type ChronicleLine } from './chronicle';
import { logText } from './describe';

test('las líneas, con su día y la frase del registro', () => {
  const w = createWorld(4);
  w.tick = 2 * TICKS_PER_DAY;
  logEvent(w, { kind: 'siegeArrived', x: 3, y: 4 });
  const entry = w.common.chronicle![0]!;
  expect(chronicleLines(w)).toEqual([{ day: 3, text: logText(entry, w), kind: 'siegeArrived' }]);
  expect(logText(entry, w).length).toBeGreaterThan(10);
});

test('en la imagen, si no cabe todo: primero muertes, llegadas, asedios y el final, en su orden', () => {
  const line = (day: number, kind: ChronicleLine['kind']): ChronicleLine => ({
    day,
    text: `${kind} ${day}`,
    kind,
  });
  const lines = [
    line(1, 'inspired'),
    line(2, 'died'),
    line(3, 'couple'),
    line(4, 'siegeArrived'),
    line(5, 'season'),
    line(6, 'colonyFell'),
  ];
  expect(imageLines(lines, 10)).toEqual(lines);
  expect(imageLines(lines, 4).map((l) => l.day)).toEqual([1, 2, 4, 6]);
  expect(imageLines(lines, 3).map((l) => l.day)).toEqual([2, 4, 6]);
});

test('el texto: el final, los días, el comienzo, las cifras, la crónica y el enlace', () => {
  const w = createWorld(4);
  w.common.stats.kills = 12;
  w.common.stats.siegesRepelled = 1;
  w.common.over = { tick: 9 * TICKS_PER_DAY, won: true };
  logEvent(w, { kind: 'rescueEnd' });
  const text = shareText(w, 'https://example.org/?seed=4');
  const lines = text.split('\n');
  expect(lines[0]).toBe('rimZomboid — ¡Os han rescatado!');
  expect(lines[1]).toBe('Aguantasteis 10 días hasta el rescate');
  expect(lines[3]).toBe('12 zombis · 1 asedio · 0 hortalizas');
  expect(lines.at(-1)).toBe('Juega esta misma partida: https://example.org/?seed=4');
});
