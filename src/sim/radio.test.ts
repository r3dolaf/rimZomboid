// C1 §2–3: escuchar la radio: cada hora encendida y con carga es una hora escuchada (y gasta una de
// carga); a las 2 h, que el ejército evacúa; a las 6, hacia dónde (se elige el punto, a 9–13
// hexágonos, y se despeja su zona); a las 12, dónde y cuándo (el punto aparece en el mapa del mundo;
// el helicóptero, el día de hoy más 6, de 10 a 16 h). Además, llamadas que descubren sitios.
import { expect, test } from 'vitest';
import {
  EVAC_DIST,
  EVAC_HOUR,
  EVAC_LEAD_DAYS,
  EVAC_WAIT_HOURS,
  RADIO_HEARD,
  TICKS_PER_HOUR,
} from './balance';
import { hexDistance, hexesWithin } from './atlas/hex';
import { dayStart, gameTime } from './clock';
import { checkInvariants } from './invariants';
import { radioOf, radioSystem } from './radio';
import type { World } from './types';
import { createWorld } from './world';

function withRadio(fuel = 24, on = true): World {
  const w = createWorld(7);
  const p = { x: w.base.rect.x + 2, y: w.base.rect.y + 2 };
  w.furniture.push({ id: w.common.nextId++, kind: 'radio', pos: p, fuel, on });
  return w;
}

/** Pasa `h` horas en punto por el sistema de la radio. */
function hours(w: World, h: number): void {
  for (let i = 0; i < h; i++) {
    w.tick = (Math.floor(w.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR;
    radioSystem(w);
  }
}

const kinds = (w: World) => w.common.log.map((e) => e.kind);

test('encendida y con carga, cada hora es una hora escuchada y gasta una de carga', () => {
  const w = withRadio(3);
  hours(w, 2);
  expect(w.common.rescue?.heard).toBe(2);
  expect(radioOf(w)!.fuel).toBe(1);
  hours(w, 3); // la tercera la acaba; luego, sin carga, nada
  expect(w.common.rescue?.heard).toBe(3);
  expect(radioOf(w)!.fuel).toBe(0);
  radioOf(w)!.fuel = 10;
  radioOf(w)!.on = false;
  hours(w, 4);
  expect(w.common.rescue?.heard).toBe(3); // apagada, tampoco (y lo escuchado se guarda)
  expect(radioOf(w)!.fuel).toBe(10);
});

test('a las 2 h, que el ejército evacúa; a las 6, hacia dónde (y se despeja su zona, sin el punto)', () => {
  expect(RADIO_HEARD).toEqual([2, 6, 12]);
  const w = withRadio();
  hours(w, 1);
  expect(kinds(w)).not.toContain('radioNews');
  hours(w, 1);
  expect(kinds(w)).toContain('radioNews');
  expect(w.common.rescue?.stage).toBe(1);
  hours(w, 4);
  const r = w.common.rescue!;
  expect(r.stage).toBe(2);
  const { atlas } = w.common;
  const hex = r.hex!;
  const d = hexDistance(atlas, atlas.base, hex);
  expect(d).toBeGreaterThanOrEqual(EVAC_DIST[0]);
  expect(d).toBeLessThanOrEqual(EVAC_DIST[1]);
  expect(atlas.terrain[hex]).not.toBe('water');
  expect(w.common.expedition.sites.some((x) => x.hex === hex)).toBe(false);
  for (const i of hexesWithin(atlas, hex, 2)) expect(atlas.seen[i]).toBe(1);
  const dir = w.common.log.find((e) => e.kind === 'radioDirection');
  expect(dir).toMatchObject({ kind: 'radioDirection', dist: d });
});

test('a las 12 h, el punto de evacuación en el mapa del mundo y el día del helicóptero', () => {
  const w = withRadio();
  hours(w, 12);
  const r = w.common.rescue!;
  expect(r.stage).toBe(3);
  const site = w.common.expedition.sites.find((x) => x.id === r.siteId)!;
  expect(site).toMatchObject({ kind: 'evac', state: 'known', hex: r.hex, special: null });
  expect(site.hours).toBeGreaterThan(0);
  const today = gameTime(w.tick).day;
  const from = dayStart(today + EVAC_LEAD_DAYS) + EVAC_HOUR * TICKS_PER_HOUR;
  expect(r.from).toBe(from);
  expect(r.until).toBe(from + EVAC_WAIT_HOURS * TICKS_PER_HOUR);
  expect(w.common.log.find((e) => e.kind === 'radioEvac')).toMatchObject({
    day: today + EVAC_LEAD_DAYS,
  });
  // Después no hay más mensajes (hasta que pase el helicóptero).
  hours(w, 12);
  expect(w.common.rescue?.stage).toBe(3);
  expect(w.common.expedition.sites.filter((x) => x.kind === 'evac')).toHaveLength(1);
  expect(checkInvariants(w)).toEqual([]);
});

test('además, cada hora encendida, a veces una llamada que descubre un sitio', () => {
  const w = withRadio();
  const known = () => w.common.expedition.sites.filter((x) => x.state === 'known').length;
  const before = known();
  for (let i = 0; i < 100; i++) {
    radioOf(w)!.fuel = 24;
    hours(w, 1);
  }
  const calls = w.common.log.filter((e) => e.kind === 'siteFound' && e.how === 'radio');
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.length).toBeLessThan(20);
  expect(known()).toBeGreaterThan(before);
});
