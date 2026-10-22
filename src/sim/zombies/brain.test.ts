// H4b §2.2–2.3: el cerebro de los zombis (vagar, rebaño, perseguir, rastro, golpes, romper) y las
// llegadas por los bordes.
import { expect, test } from 'vitest';
import { contains } from '../geom';
import {
  BORED_TICKS,
  LOSE_TRACK_TICKS,
  TICKS_PER_HOUR,
  WANDER_FAR_MIN,
  WANDER_MAX,
  START_HOUR,
  ZOMBIE_DAMAGE_MAX,
  ZOMBIE_DAMAGE_MIN,
  ZOMBIE_EVERY_HOURS,
  ZOMBIE_HIT_CHANCE,
} from '../balance';
import { checkInvariants } from '../invariants';
import { getTile, isZombieWalkable, setTile } from '../map/grid';
import { createRng } from '../rng';
import { emptyWorld } from '../testing/fixtures';
import { Tile, type Survivor, type World, type Zombie } from '../types';
import { tileOf } from '../world';
import { thinkZombie, zombieAttack } from './brain';
import { arrivalInterval, newZombie, zombieMax } from './spawn';
import { zombieSystem } from './system';

function world(w = 40, h = 40): World {
  const out = emptyWorld(w, h);
  out.seen.fill(1);
  // El colono, lejos y detrás de un muro, salvo que el test lo ponga en otro sitio.
  out.survivors[0]!.pos = { x: w - 1.5, y: h - 1.5 };
  return out;
}

const zombieAt = (w: World, x: number, y: number): Zombie => {
  const z = newZombie(w, { x, y });
  w.zombies.push(z);
  return z;
};

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    zombieSystem(w);
    w.tick++;
  }
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

function hide(w: World, s: Survivor) {
  // Un muro alrededor del colono: nadie lo ve.
  const t = tileOf(s.pos);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (dx || dy) setTile(w.grid, t.x + dx, t.y + dy, Tile.Wall);
}

test('vaga: paseos cortos con pausas, sin alejarse mucho y siempre donde puede pisar', () => {
  const w = world();
  hide(w, w.survivors[0]!);
  const z = zombieAt(w, 20, 20);
  const start = { ...z.pos };
  let moved = 0;
  let still = 0;
  for (let i = 0; i < 1500; i++) {
    const before = { ...z.pos };
    run(w, 1);
    if (before.x !== z.pos.x || before.y !== z.pos.y) moved++;
    else still++;
    const t = tileOf(z.pos);
    expect(isZombieWalkable(w.grid, t.x, t.y)).toBe(true);
  }
  expect(z.state).toBe('wander');
  expect(moved).toBeGreaterThan(100);
  expect(still).toBeGreaterThan(100);
  expect(dist(z.pos, start)).toBeGreaterThan(0);
  expect(checkInvariants(w)).toEqual([]);
});

test('agruparse: los zombis que vagan cerca se mantienen en grupo (sin rebaño, se dispersarían)', () => {
  let lone = 0;
  let pairs = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const w = world();
    w.zombieRng = createRng(seed);
    hide(w, w.survivors[0]!);
    const z0 = zombieAt(w, 12, 20);
    const others = [
      [18, 19],
      [18, 21],
      [19, 20],
    ].map(([x, y]) => zombieAt(w, x!, y!));
    let sumLone = 0;
    let sumPairs = 0;
    let n = 0;
    // Antes de que se aburran (luego se van lejos, ver el test siguiente).
    for (let t = 0; t < BORED_TICKS; t++) {
      run(w, 1);
      if (t < 200) continue;
      const cx = others.reduce((a, z) => a + z.pos.x, 0) / others.length;
      const cy = others.reduce((a, z) => a + z.pos.y, 0) / others.length;
      sumLone += dist(z0.pos, { x: cx, y: cy });
      let p = 0;
      for (const a of w.zombies) for (const b of w.zombies) if (a !== b) p += dist(a.pos, b.pos);
      sumPairs += p / (w.zombies.length * (w.zombies.length - 1));
      n++;
    }
    lone += sumLone / n / 10;
    pairs += sumPairs / n / 10;
  }
  expect(lone).toBeLessThan(6.3); // empezó a 6,3 del grupo
  expect(pairs).toBeLessThan(8);
});

test('aburrido (horas sin nada que le llame la atención) da un paseo largo; si no, cortos', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const w = world(80, 80);
    w.zombieRng = createRng(seed);
    hide(w, w.survivors[0]!);
    w.tick = 10 * BORED_TICKS;
    const walkLength = (bored: boolean) => {
      const z = zombieAt(w, 40, 40);
      z.lastSeenAt = bored ? 0 : w.tick;
      for (let i = 0; i < 50 && !z.goal; i++) thinkZombie(w, z); // hasta que encuentra adónde ir
      w.zombies = [];
      return dist(z.goal!, { x: 40, y: 40 });
    };
    expect(walkLength(true)).toBeGreaterThanOrEqual(WANDER_FAR_MIN - 1);
    expect(walkLength(false)).toBeLessThanOrEqual(WANDER_MAX + 1);
  }
});

test('persigue al colono que ve y le golpea cuando lo tiene al lado', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 10.5, y: 10.5 };
  const z = zombieAt(w, 16, 10);
  run(w, 120);
  expect(z.state).toBe('chase');
  expect(z.targetId).toBe(s.id);
  expect(dist(z.pos, s.pos)).toBeLessThanOrEqual(1.5);
  expect(s.health).toBeLessThan(100);
});

test('no ve a través de los muros', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 10.5, y: 10.5 };
  for (let y = 0; y < 40; y++) setTile(w.grid, 13, y, Tile.Wall);
  const z = zombieAt(w, 16, 10);
  run(w, 30);
  expect(z.state).not.toBe('chase');
});

test('a los derribados no los ve', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 10.5, y: 10.5 };
  s.health = 0;
  s.action = { type: 'downed', until: 1e9 };
  const z = zombieAt(w, 13, 10);
  run(w, 30);
  expect(z.state).not.toBe('chase');
  expect(s.health).toBe(0);
});

test('contagio: quien ve a otro zombi perseguir va hacia donde este vio a su presa', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 10.5 };
  // B no ve al colono (un muro en medio), pero sí ve a A.
  for (let y = 0; y < 9; y++) setTile(w.grid, 8, y, Tile.Wall);
  for (let y = 11; y < 40; y++) setTile(w.grid, 8, y, Tile.Wall);
  setTile(w.grid, 8, 10, Tile.Wall);
  setTile(w.grid, 8, 9, Tile.Grass);
  const a = zombieAt(w, 9, 9);
  a.state = 'chase';
  a.targetId = s.id;
  a.goal = { x: 5, y: 10 };
  a.lastSeenAt = 0;
  const b = zombieAt(w, 14, 9);
  run(w, 6);
  expect(b.state).toBe('alert');
  expect(b.goal).toEqual({ x: 5, y: 10 });
});

test('pierde el rastro: va adonde lo vio por última vez y luego vuelve a vagar', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 10.5, y: 10.5 };
  const z = zombieAt(w, 18, 10); // lejos: no llega adonde lo vio antes de perder el rastro
  run(w, 6);
  expect(z.state).toBe('chase');
  s.pos = { x: 35.5, y: 35.5 };
  hide(w, s);
  run(w, LOSE_TRACK_TICKS + 10);
  expect(z.state).toBe('alert');
  expect(z.goal).toEqual({ x: 10, y: 10 });
  run(w, 300);
  expect(z.state).toBe('wander');
});

test('rompe la ventana para llegar a quien ve dentro y entra', () => {
  const w = world();
  const s = w.survivors[0]!;
  // Habitación cerrada con una ventana a la derecha y la puerta en el otro lado.
  for (let x = 5; x <= 11; x++)
    for (let y = 5; y <= 11; y++)
      if (x === 5 || x === 11 || y === 5 || y === 11) setTile(w.grid, x, y, Tile.Wall);
  setTile(w.grid, 11, 8, Tile.Window);
  setTile(w.grid, 5, 8, Tile.Door);
  s.pos = { x: 8.5, y: 8.5 };
  const z = zombieAt(w, 16, 8);
  run(w, 400);
  expect(getTile(w.grid, 11, 8)).toBe(Tile.BrokenWindow);
  expect(dist(z.pos, s.pos)).toBeLessThanOrEqual(1.5);
  expect(w.log.some((e) => e.kind === 'broken' && e.what === 'window')).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('el golpe de un zombi: acierta el 40 % y quita de 8 a 12', () => {
  const w = world();
  const s = w.survivors[0]!;
  const z = zombieAt(w, 5, 5);
  let hits = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    s.health = 100;
    zombieAttack(w, z, s);
    const lost = 100 - s.health;
    if (lost > 0) {
      hits++;
      expect(lost).toBeGreaterThanOrEqual(ZOMBIE_DAMAGE_MIN);
      expect(lost).toBeLessThanOrEqual(ZOMBIE_DAMAGE_MAX);
    }
  }
  expect(hits / n).toBeGreaterThan(ZOMBIE_HIT_CHANCE - 0.04);
  expect(hits / n).toBeLessThan(ZOMBIE_HIT_CHANCE + 0.04);
});

test('a 0 de Salud el colono cae derribado', () => {
  const w = world();
  const s = w.survivors[0]!;
  const z = zombieAt(w, 5, 5);
  s.health = 1;
  for (let i = 0; i < 50 && s.health > 0; i++) zombieAttack(w, z, s);
  expect(s.health).toBe(0);
  expect(s.action.type).toBe('downed');
  expect(checkInvariants(w)).toEqual([]);
});

test('llegadas por los bordes: desde el día 2, al doble de ritmo de noche y sin pasar del máximo', () => {
  const w = world(30, 30);
  hide(w, w.survivors[0]!);
  w.narrator.style = 'balanced';
  const day = 0; // 08:00 del día 1
  const night = (24 - START_HOUR) * TICKS_PER_HOUR;
  w.tick = day;
  expect(arrivalInterval(w)).toBe(ZOMBIE_EVERY_HOURS.balanced * TICKS_PER_HOUR);
  w.tick = night;
  expect(arrivalInterval(w)).toBe((ZOMBIE_EVERY_HOURS.balanced * TICKS_PER_HOUR) / 2);
  w.zombieLevel = 'many';
  expect(arrivalInterval(w)).toBe((ZOMBIE_EVERY_HOURS.balanced * TICKS_PER_HOUR) / 2 / 1.25);
  w.narrator.style = 'chaotic';
  expect(ZOMBIE_EVERY_HOURS.chaotic).toBe(1.5);
  w.narrator.style = 'balanced';
  w.zombieLevel = 'normal';
  w.nextZombieAt = w.tick;
  run(w, 1);
  expect(w.zombies).toHaveLength(1);
  const z = w.zombies[0]!;
  const t = tileOf(z.pos);
  expect(t.x === 0 || t.y === 0 || t.x === 29 || t.y === 29).toBe(true);
  expect(w.nextZombieAt).toBe(night + arrivalInterval(w));
  while (w.zombies.length < zombieMax('balanced', 'normal')) zombieAt(w, 15, 15);
  w.nextZombieAt = w.tick;
  run(w, 1);
  expect(w.zombies).toHaveLength(zombieMax('balanced', 'normal'));
});

test('los que llegan por un borde van hacia el pueblo (H4f; no hacia la base)', () => {
  const w = world(40, 40);
  hide(w, w.survivors[0]!);
  w.town = { x: 4, y: 4, w: 8, h: 8 };
  for (let i = 0; i < 10; i++) {
    w.nextZombieAt = w.tick;
    run(w, 1);
  }
  expect(w.zombies.length).toBe(10);
  for (const z of w.zombies) {
    expect(z.state).toBe('alert');
    expect(contains(w.town, z.goal!)).toBe(true);
  }
});

test('sin camino, el paso en línea recta no corta esquinas: no se mete en un muro', () => {
  const w = world(14, 14);
  setTile(w.grid, 6, 5, Tile.Wall);
  setTile(w.grid, 5, 4, Tile.Wall);
  // La meta, rodeada de árboles: no hay camino y da un paso hacia ella (en diagonal, no).
  for (let y = 0; y <= 3; y++) for (let x = 8; x <= 12; x++) setTile(w.grid, x, y, Tile.Tree);
  setTile(w.grid, 10, 1, Tile.Grass);
  const z = zombieAt(w, 5, 5);
  z.pos = { x: 5.9, y: 5.4 };
  z.state = 'alert';
  z.goal = { x: 10, y: 1 };
  z.lastSeenAt = w.tick;
  for (let i = 0; i < 60; i++) {
    run(w, 1);
    const t = tileOf(z.pos);
    expect(isZombieWalkable(w.grid, t.x, t.y)).toBe(true);
  }
});
