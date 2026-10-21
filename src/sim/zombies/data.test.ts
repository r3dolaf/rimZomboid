// H4b, datos: casillas rotas, Salud y postura, zombis al empezar e invariantes.
import { expect, test } from 'vitest';
import {
  RESISTANCE,
  START_HOUR,
  START_WEAPON,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  ZOMBIE_SAFE_RADIUS,
} from '../balance';
import { checkInvariants } from '../invariants';
import { createGrid, isWalkable, isZombieWalkable, setTile } from '../map/grid';
import { Tile, type NarratorStyle, type ZombieLevel } from '../types';
import { isOpaque } from '../vision';
import { createWorld } from '../world';
import { zombieMax, zombieStartCount } from './spawn';

test('casillas rotas: las pisa cualquiera y no tapan la vista; la puerta, solo los colonos', () => {
  const g = createGrid(3, 3, Tile.Grass);
  for (const t of [Tile.BrokenWindow, Tile.BrokenDoor, Tile.Rubble]) {
    setTile(g, 1, 1, t);
    expect(isWalkable(g, 1, 1)).toBe(true);
    expect(isZombieWalkable(g, 1, 1)).toBe(true);
    expect(isOpaque(g, 1, 1)).toBe(false);
  }
  setTile(g, 1, 1, Tile.Door);
  expect(isWalkable(g, 1, 1)).toBe(true);
  expect(isZombieWalkable(g, 1, 1)).toBe(false);
  for (const t of [Tile.Window, Tile.BoardedWindow, Tile.Wall, Tile.WoodWall, Tile.Tree]) {
    setTile(g, 1, 1, t);
    expect(isZombieWalkable(g, 1, 1)).toBe(false);
  }
  expect(isZombieWalkable(g, -1, 0)).toBe(false);
});

test('al empezar: Salud 100, postura según los rasgos y sin arma fijada', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(seed);
    for (const s of w.survivors) {
      expect(s.health).toBe(100);
      expect(s.weaponLocked).toBe(false);
      const want = s.traits.includes('coward')
        ? 'flee'
        : s.traits.includes('brave')
          ? 'fight'
          : 'decide';
      expect(s.stance).toBe(want);
    }
  }
});

test('cuántos zombis hay al empezar y cuántos como mucho, según el narrador y la opción', () => {
  // Caótico y Muchos, más suaves que al principio: con 35/70 y ×1,5 caían el 80 % del tiempo.
  const start = { calm: 15, balanced: 25, chaotic: 30 };
  const max = { calm: 30, balanced: 50, chaotic: 60 };
  const mult = { few: 0.5, normal: 1, many: 1.25 };
  for (const style of ['calm', 'balanced', 'chaotic'] as NarratorStyle[])
    for (const level of ['few', 'normal', 'many'] as ZombieLevel[]) {
      expect(zombieStartCount(style, level)).toBe(Math.round(start[style] * mult[level]));
      expect(zombieMax(style, level)).toBe(Math.round(max[style] * mult[level]));
      const w = createWorld(7, style, level);
      expect(w.zombieLevel).toBe(level);
      expect(w.zombies).toHaveLength(zombieStartCount(style, level));
      expect(checkInvariants(w)).toEqual([]);
    }
});

test('al empezar, ninguno cerca de la base, todos donde pueden pisar y más junto a las casas lejanas', () => {
  let nearFar = 0;
  let nearClose = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const w = createWorld(seed);
    const r = w.base.rect;
    const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2];
    const dist = (p: { x: number; y: number }) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
    const houses = [...w.houses].sort((a, b) => dist(a.door) - dist(b.door));
    const half = Math.floor(houses.length / 2);
    for (const z of w.zombies) {
      expect(dist(z.pos)).toBeGreaterThanOrEqual(ZOMBIE_SAFE_RADIUS);
      expect(isZombieWalkable(w.grid, Math.floor(z.pos.x), Math.floor(z.pos.y))).toBe(true);
      expect(z.health).toBe(60);
      expect(z.state).toBe('wander');
      // La casa más cercana al zombi: ¿de la mitad lejana o de la cercana?
      const near = houses.reduce((best, h) =>
        dist2(h.door, z.pos) < dist2(best.door, z.pos) ? h : best,
      );
      if (houses.indexOf(near) >= half) nearFar++;
      else nearClose++;
    }
  }
  expect(nearFar).toBeGreaterThan(nearClose);
});

const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

test('los zombis usan su propio azar: lo demás del mundo no cambia con la opción', () => {
  const few = createWorld(9, 'balanced', 'few');
  const many = createWorld(9, 'balanced', 'many');
  const strip = (w: ReturnType<typeof createWorld>) =>
    JSON.stringify({ ...w, zombies: [], zombieRng: null, zombieLevel: null, nextZombieId: 0 });
  expect(strip(few)).toBe(strip(many));
  expect(JSON.stringify(createWorld(9, 'balanced', 'many'))).toBe(JSON.stringify(many));
});

test('las llegadas por los bordes empiezan el día 2', () => {
  const w = createWorld(3);
  expect(w.nextZombieAt).toBe(TICKS_PER_DAY - START_HOUR * TICKS_PER_HOUR);
});

test('invariantes: zombis dentro de lo que no pisan, salud rara, de más; Salud y daños raros', () => {
  const w = createWorld(5);
  const z = w.zombies[0]!;
  const s = w.survivors[0]!;
  const door = w.base.door;
  z.pos = { x: door.x + 0.5, y: door.y + 0.5 };
  z.health = 0;
  s.health = 120;
  w.survivors[1]!.action = { type: 'downed', until: 100 };
  w.damage[String(door.y * w.grid.width + door.x)] = RESISTANCE[Tile.Door]!;
  const grass = w.grid.tiles.indexOf(Tile.Grass);
  w.damage[String(grass)] = 5;
  while (w.zombies.length <= zombieMax('balanced', 'normal'))
    w.zombies.push({ ...structuredClone(z), id: w.nextZombieId++ });
  const p = checkInvariants(w).join('\n');
  expect(p).toMatch(/zombi #\d+: en una casilla que no puede pisar/);
  expect(p).toMatch(/zombi #\d+: salud fuera de 1–60/);
  expect(p).toMatch(/demasiados zombis/);
  expect(p).toMatch(/Salud fuera de 0–100/);
  expect(p).toMatch(/derribad[oa] con Salud/);
  expect(p).toMatch(/daño en .*: resistencia 100 fuera de 1–99/);
  expect(p).toMatch(/daño en .*: no se puede romper/);
});

test('hay armas para defenderse: unas 10 por mapa de media (cuchillos, bates y hachas)', () => {
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(seed);
    total += w.containers.reduce((n, c) => n + c.items.knife + c.items.bat + c.items.axe, 0);
  }
  expect(total / 20).toBeGreaterThanOrEqual(8);
  expect(total / 20).toBeLessThanOrEqual(14);
});

test('las ventanas aguantan algo (60) y tapiadas mucho más (180), menos que un muro de madera', () => {
  expect(RESISTANCE[Tile.Window]).toBe(60);
  expect(RESISTANCE[Tile.BoardedWindow]).toBe(180);
  expect(RESISTANCE[Tile.BoardedWindow]!).toBeLessThan(RESISTANCE[Tile.WoodWall]!);
});

test('cada colono empieza con un cuchillo en la mano (sin arma caían enseguida)', () => {
  const w = createWorld(2);
  expect(w.survivors.map((s) => s.equipped)).toEqual(w.survivors.map(() => START_WEAPON));
  expect(START_WEAPON).toBe('knife');
});
