// H4e §2: las hordas del narrador — el asedio (aviso, llegada, empeño y fin) y los errantes.
import { expect, test } from 'vitest';
import {
  BORED_TICKS,
  HORDE_LEG,
  SIEGE_COOLDOWN_DAYS,
  SIEGE_HOURS,
  SIEGE_SIZE,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  WANDERERS_SIZE,
  ZOMBIE_MAX,
} from '../balance';
import { dayStart } from '../clock';
import { siegeEvent } from '../events/siege';
import { strangersEvent } from '../events/strangers';
import { wanderersEvent } from '../events/wanderers';
import { contains } from '../geom';
import { checkInvariants } from '../invariants';
import { createRng } from '../rng';
import { addBase, emptyWorld } from '../testing/fixtures';
import { setTile } from '../map/grid';
import { Tile, type World } from '../types';
import { tileOf } from '../world';
import { thinkZombie } from './brain';
import { hordeSystem, siegeActive, siegeSize, spawnWanderers, wanderersSize } from './hordes';
import { arrivalsSystem, newZombie } from './spawn';
import { zombieSystem } from './system';

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

// --- Tarea 2: empeño, fin y errantes ---

/** Un asedio ya llegado por el norte, con `n` zombis. */
function besieged(n = 10): World {
  const w = world();
  w.siege = { at: w.tick, side: 0, size: n };
  hordeSystem(w);
  return w;
}

const runZ = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    zombieSystem(w);
    w.tick++;
  }
};

/** Casillas desde `p` hasta el rectángulo de la base (0 dentro). */
const fromBase = (w: World, p: { x: number; y: number }) => {
  const r = w.base.rect;
  const t = tileOf(p);
  return Math.max(r.x - t.x, 0, t.x - (r.x + r.w - 1), r.y - t.y, 0, t.y - (r.y + r.h - 1));
};

test('empeño: el del asedio que no ve a nadie no vaga ni se aburre, vuelve a la base', () => {
  const w = besieged(1);
  const z = w.zombies[0]!;
  z.state = 'wander';
  z.goal = null;
  z.path = [];
  z.waitUntil = 0;
  z.lastSeenAt = w.tick - BORED_TICKS - 100; // aburrido de sobra
  thinkZombie(w, z);
  expect(z.state).toBe('alert');
  expect(contains(w.base.rect, z.goal!)).toBe(true);
});

test('empeño: al llegar a su casilla de la base, elige otra (no se pone a vagar)', () => {
  const w = besieged(1);
  const z = w.zombies[0]!;
  const t = { x: 37, y: 37 };
  z.pos = { x: t.x + 0.5, y: t.y + 0.5 };
  z.goal = t;
  z.path = [];
  w.survivors[0]!.pos = { x: 79.5, y: 79.5 }; // nadie a la vista
  thinkZombie(w, z);
  expect(z.state).toBe('alert');
  expect(contains(w.base.rect, z.goal!)).toBe(true);
});

test('tramos: el camino de un zombi de horda acaba a 25 casillas o menos de donde está', () => {
  const w = besieged(5);
  for (const z of w.zombies) {
    z.path = [];
    thinkZombie(w, z);
    const end = z.path.at(-1)!;
    const at = tileOf(z.pos);
    expect(Math.hypot(end.x - at.x, end.y - at.y)).toBeLessThanOrEqual(HORDE_LEG + 4);
  }
});

test('el asedio llega a la base: en 1500 ticks están todos en ella o en sus muros', () => {
  const w = besieged(15);
  runZ(w, 1500);
  for (const z of w.zombies) expect(fromBase(w, z.pos)).toBeLessThanOrEqual(3);
  expect(checkInvariants(w)).toEqual([]);
});

test('fin al día: la horda termina, sus zombis se aburren y se dispersan; vuelven las llegadas', () => {
  const w = besieged(8);
  const h = w.hordes[0]!;
  w.tick = h.until!;
  hordeSystem(w);
  expect(h.done).toBe(true);
  expect(siegeActive(w)).toBe(false);
  expect(w.log.at(-1)).toMatchObject({ kind: 'siegeEnded' });
  for (const z of w.zombies) {
    expect(z.hordeId).toBe(h.id); // se acuerda de su horda
    expect(w.tick - z.lastSeenAt).toBeGreaterThan(BORED_TICKS);
  }
  w.nextZombieAt = w.tick;
  const before = w.zombies.length;
  arrivalsSystem(w);
  expect(w.zombies.length).toBe(before + 1);
  // Al vagar, aburridos: el paseo es largo.
  const z = w.zombies[0]!;
  z.state = 'wander';
  z.goal = null;
  z.path = [];
  z.waitUntil = 0;
  thinkZombie(w, z);
  expect(z.state).toBe('wander');
  expect(siegeActive(w)).toBe(false);
});

test('fin por matarlos: aviso verde y la horda se borra', () => {
  const w = besieged(4);
  w.zombies = [];
  hordeSystem(w);
  expect(w.log.at(-1)).toMatchObject({ kind: 'siegeRepelled' });
  expect(w.hordes).toHaveLength(0);
  expect(siegeActive(w)).toBe(false);
});

test('una horda terminada se borra cuando ya no quedan zombis suyos', () => {
  const w = besieged(2);
  w.tick = w.hordes[0]!.until!;
  hordeSystem(w);
  expect(w.hordes).toHaveLength(1);
  w.zombies = [];
  hordeSystem(w);
  expect(w.hordes).toHaveLength(0);
  expect(w.log.filter((e) => e.kind === 'siegeRepelled')).toHaveLength(0);
});

test('errantes: tono malo, dureza 2, cada 3 días, desde el día 3', () => {
  expect(wanderersEvent).toMatchObject({
    id: 'wanderers',
    tone: 'bad',
    severity: 2,
    cooldownDays: 3,
  });
  const w = world();
  w.tick = dayStart(3);
  expect(wanderersEvent.canHappen(w)).toBe(true);
  w.tick--;
  expect(wanderersEvent.canHappen(w)).toBe(false);
});

test('errantes: 8–15 por la opción, juntos en un borde y con destino en el de enfrente', () => {
  expect(WANDERERS_SIZE).toEqual([8, 15]);
  const sizes: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const w = world();
    w.rng = createRng(seed);
    w.zombieRng = createRng(seed + 100);
    wanderersEvent.happen(w);
    const h = w.hordes[0]!;
    expect(h.kind).toBe('wander');
    sizes.push(w.zombies.length);
    const zs = w.zombies.map((z) => tileOf(z.pos));
    // Todos a 3 casillas o menos de un mismo borde, y el destino en el de enfrente.
    const depth = (t: { x: number; y: number }, side: number) =>
      [t.y, 79 - t.y, t.x, 79 - t.x][side]!;
    const from = [0, 1, 2, 3].find((side) => zs.every((t) => depth(t, side) <= 3))!;
    expect(from).toBeDefined();
    expect(depth(h.goal, from ^ 1)).toBeLessThanOrEqual(3);
    for (const z of w.zombies) expect(z.goal).toEqual(h.goal);
    expect(w.log.some((e) => e.kind === 'wanderersSighted')).toBe(false); // sin aviso al salir
  }
  expect(Math.min(...sizes)).toBe(8);
  expect(Math.max(...sizes)).toBe(15);
  const w = world();
  w.zombieLevel = 'few';
  expect(Array.from({ length: 50 }, () => wanderersSize(w)).every((n) => n >= 4 && n <= 8)).toBe(
    true,
  );
});

/** Errantes saliendo por el oeste hacia el este, con el colono encerrado lejos. */
function wandering(n = 10): World {
  const w = world();
  w.survivors[0]!.pos = { x: 37.5, y: 37.5 };
  for (const t of [36, 37, 38]) setTile(w.grid, t, 36, Tile.Wall); // que no le vean por la ventana
  spawnWanderers(w, 2, n);
  return w;
}

test('errantes: cruzan el mapa y salen por el otro lado; luego la horda se borra', () => {
  const w = wandering(10);
  const goal = w.hordes[0]!.goal;
  expect(goal.x).toBeGreaterThanOrEqual(76);
  runZ(w, 3000);
  expect(w.zombies.filter((z) => z.hordeId !== null)).toHaveLength(0);
  expect(w.hordes).toHaveLength(0);
  expect(checkInvariants(w)).toEqual([]);
});

test('errantes: tras perder a alguien (o una pausa), siguen hacia su destino', () => {
  const w = wandering(1);
  const z = w.zombies[0]!;
  z.state = 'wander';
  z.goal = null;
  z.path = [];
  z.waitUntil = 0;
  z.lastSeenAt = w.tick - BORED_TICKS - 100;
  thinkZombie(w, z);
  expect(z.state).toBe('alert');
  expect(z.goal).toEqual(w.hordes[0]!.goal);
});

test('errantes: aviso (una vez) cuando un colono ve a uno', () => {
  const w = wandering(3);
  const z = w.zombies[0]!;
  w.survivors[0]!.pos = { x: z.pos.x + 3, y: z.pos.y };
  w.base.rect = { x: 70, y: 70, w: 5, h: 5 };
  runZ(w, 12);
  const seen = w.log.filter((e) => e.kind === 'wanderersSighted');
  expect(seen).toHaveLength(1);
  expect(w.hordes[0]!.seen).toBe(true);
  runZ(w, 30);
  expect(w.log.filter((e) => e.kind === 'wanderersSighted')).toHaveLength(1);
});
