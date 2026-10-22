// H4e §2: las hordas del narrador — el asedio (aviso, llegada, empeño y fin) y los errantes.
import { expect, test } from 'vitest';
import {
  SIEGE_COOLDOWN_DAYS,
  SIEGE_HOURS,
  SIEGE_SIZE,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  ZOMBIE_MAX,
} from '../balance';
import { dayStart } from '../clock';
import { siegeEvent } from '../events/siege';
import { strangersEvent } from '../events/strangers';
import { contains } from '../geom';
import { checkInvariants } from '../invariants';
import { createRng } from '../rng';
import { addBase, emptyWorld } from '../testing/fixtures';
import { setTile } from '../map/grid';
import { Tile, type World } from '../types';
import { tileOf } from '../world';
import { hordeSystem, siegeActive, siegeSize } from './hordes';
import { arrivalsSystem, newZombie } from './spawn';

/** Un mapa de 80×80 con la base en medio y el colono dentro. */
function world(): World {
  const w = addBase(emptyWorld(80, 80), { x: 35, y: 35, w: 10, h: 8 });
  w.seen.fill(1);
  w.survivors[0]!.pos = { x: 37.5, y: 37.5 };
  w.tick = dayStart(6);
  return w;
}

test('asedio: tono malo, dureza 3, cada 6 días como mucho, desde el día 6', () => {
  expect(siegeEvent.tone).toBe('bad');
  expect(siegeEvent.severity).toBe(3);
  expect(siegeEvent.cooldownDays).toBe(SIEGE_COOLDOWN_DAYS);
  expect(SIEGE_COOLDOWN_DAYS).toBe(6);
  const w = world();
  expect(siegeEvent.canHappen(w)).toBe(true);
  w.tick = dayStart(6) - 1;
  expect(siegeEvent.canHappen(w)).toBe(false);
});

test('el día N empieza a las 00:00 de ese día (la partida empieza el día 1 a las 08:00)', () => {
  expect(dayStart(1)).toBe(-8 * TICKS_PER_HOUR);
  expect(dayStart(6)).toBe(5 * TICKS_PER_DAY - 8 * TICKS_PER_HOUR);
});

test('tamaño: según el narrador, +1 cada 2 días y por la opción de la portada', () => {
  expect(SIEGE_SIZE).toEqual({ calm: [10, 15], balanced: [15, 25], chaotic: [25, 35] });
  const w = world();
  w.tick = dayStart(10); // día 10: +5
  const sizes = (style: World['narrator']['style'], level: World['zombieLevel']) => {
    w.narrator.style = style;
    w.zombieLevel = level;
    return Array.from({ length: 200 }, (_, i) => {
      w.rng = createRng(i + 1);
      return siegeSize(w);
    });
  };
  const span = (xs: number[]) => [Math.min(...xs), Math.max(...xs)];
  expect(span(sizes('calm', 'normal'))).toEqual([15, 20]);
  expect(span(sizes('balanced', 'normal'))).toEqual([20, 30]);
  expect(span(sizes('chaotic', 'normal'))).toEqual([30, 40]);
  expect(span(sizes('balanced', 'few'))).toEqual([10, 15]);
  expect(span(sizes('balanced', 'many'))).toEqual([25, 38]);
});

test('al salir se anuncia: llega en 48–72 h por un lado, y el aviso lo dice', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = world();
    w.rng = createRng(seed);
    siegeEvent.happen(w);
    const s = w.siege!;
    expect(s.at - w.tick).toBeGreaterThanOrEqual(48 * TICKS_PER_HOUR);
    expect(s.at - w.tick).toBeLessThanOrEqual(72 * TICKS_PER_HOUR);
    expect([0, 1, 2, 3]).toContain(s.side);
    expect(s.size).toBeGreaterThanOrEqual(18);
    const e = w.log.at(-1)!;
    expect(e).toMatchObject({ kind: 'siegeAnnounced', side: s.side });
    expect(e.kind === 'siegeAnnounced' && e.hours).toBe(
      Math.round((s.at - w.tick) / TICKS_PER_HOUR),
    );
    // No sale otro mientras este está en camino.
    expect(siegeEvent.canHappen(w)).toBe(false);
  }
});

test('llegada: todos juntos en su borde, alertados hacia la base, con la horda de un día', () => {
  for (const side of [0, 1, 2, 3] as const) {
    const w = world();
    w.siege = { at: w.tick, side, size: 20 };
    hordeSystem(w);
    expect(w.siege).toBeNull();
    expect(w.hordes).toHaveLength(1);
    const h = w.hordes[0]!;
    expect(h).toMatchObject({
      kind: 'siege',
      done: false,
      until: w.tick + SIEGE_HOURS * TICKS_PER_HOUR,
    });
    expect(w.zombies).toHaveLength(20);
    const ts = w.zombies.map((z) => tileOf(z.pos));
    for (const z of w.zombies) {
      expect(z.hordeId).toBe(h.id);
      expect(z.state).toBe('alert');
      expect(contains(w.base.rect, z.goal!)).toBe(true);
    }
    // En el borde (a 3 casillas o menos) y juntos (en 25 casillas a lo largo).
    const depth = (t: { x: number; y: number }) => [t.y, 79 - t.y, t.x, 79 - t.x][side]!;
    const along = (t: { x: number; y: number }) => (side < 2 ? t.x : t.y);
    for (const t of ts) expect(depth(t)).toBeLessThanOrEqual(3);
    const alongs = ts.map(along);
    expect(Math.max(...alongs) - Math.min(...alongs)).toBeLessThanOrEqual(24);
    expect(w.log.at(-1)).toMatchObject({ kind: 'siegeArrived' });
    expect(siegeActive(w)).toBe(true);
    expect(checkInvariants(w)).toEqual([]);
  }
});

test('antes de su hora, el asedio no llega', () => {
  const w = world();
  w.siege = { at: w.tick + 1, side: 0, size: 20 };
  hordeSystem(w);
  expect(w.zombies).toHaveLength(0);
  expect(w.siege).not.toBeNull();
});

test('mientras dura el asedio no llegan zombis sueltos (pero el reloj de llegadas sigue)', () => {
  const w = world();
  w.siege = { at: w.tick, side: 0, size: 5 };
  hordeSystem(w);
  w.nextZombieAt = w.tick;
  arrivalsSystem(w);
  expect(w.zombies).toHaveLength(5);
  expect(w.nextZombieAt).toBeGreaterThan(w.tick);
});

test('con un asedio anunciado o en marcha no llegan desconocidos ni otro asedio', () => {
  const w = world();
  for (let x = 0; x < 80; x++) setTile(w.grid, x, 43, Tile.Road); // por donde llegarían
  expect(strangersEvent.canHappen(w)).toBe(true);
  w.siege = { at: w.tick + 100, side: 0, size: 5 };
  expect(strangersEvent.canHappen(w)).toBe(false);
  w.siege.at = w.tick;
  hordeSystem(w);
  expect(strangersEvent.canHappen(w)).toBe(false);
  expect(siegeEvent.canHappen(w)).toBe(false);
});

test('invariantes: la horda de cada zombi existe; el tope solo cuenta a los que no son de horda', () => {
  const w = world();
  const max = ZOMBIE_MAX.balanced;
  for (let i = 0; i < max; i++)
    w.zombies.push(newZombie(w, { x: i % 80, y: 2 + Math.floor(i / 80) }));
  expect(checkInvariants(w)).toEqual([]);
  w.siege = { at: w.tick, side: 1, size: 10 };
  hordeSystem(w);
  expect(w.zombies.length).toBe(max + 10);
  expect(checkInvariants(w)).toEqual([]);
  w.zombies.push(newZombie(w, { x: 5, y: 10 }));
  expect(checkInvariants(w).join()).toMatch(/demasiados zombis/);
  w.zombies.pop();
  w.zombies[0]!.hordeId = 99;
  expect(checkInvariants(w).join()).toMatch(/zombi #\d+: su horda 99 no existe/);
});
