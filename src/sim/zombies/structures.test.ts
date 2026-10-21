// H4b §2.2 y §4: romper, caminos de zombi con coste y reparar.
import { expect, test } from 'vitest';
import { BUILD, RESISTANCE, ZOMBIE_BREAK_DAMAGE } from '../balance';
import { canPlace } from '../build';
import { checkInvariants } from '../invariants';
import { buildJob, workOnBlueprint } from '../jobs/build';
import { haulJob } from '../jobs/haul';
import { getTile, setTile } from '../map/grid';
import { issue, ordersSystem } from '../orders';
import { damageTile, resistanceOf } from '../structures';
import { addSurvivor, emptyWorld } from '../testing/fixtures';
import { Tile, type BuildKind, type Point, type World } from '../types';
import { zombiePath } from './path';
import { newZombie } from './spawn';

function world(w = 9, h = 9): World {
  const out = emptyWorld(w, h);
  out.seen.fill(1);
  return out;
}

const hitsToBreak = (t: Tile) => Math.ceil(RESISTANCE[t]! / ZOMBIE_BREAK_DAMAGE);

test('romper: cada golpe quita resistencia y, al llegar a 0, la casilla cambia', () => {
  const w = world();
  setTile(w.grid, 4, 4, Tile.Door);
  const v = w.grid.version;
  for (let i = 1; i < hitsToBreak(Tile.Door); i++) {
    expect(damageTile(w, 4, 4, ZOMBIE_BREAK_DAMAGE)).toBe(false);
    expect(resistanceOf(w, 4, 4)).toBe(RESISTANCE[Tile.Door]! - i * ZOMBIE_BREAK_DAMAGE);
  }
  expect(checkInvariants(w)).toEqual([]);
  expect(damageTile(w, 4, 4, ZOMBIE_BREAK_DAMAGE)).toBe(true);
  expect(getTile(w.grid, 4, 4)).toBe(Tile.BrokenDoor);
  expect(w.damage).toEqual({});
  expect(w.grid.version).toBeGreaterThan(v);
  expect(w.log.at(-1)).toMatchObject({ kind: 'broken', what: 'door', x: 4, y: 4 });
});

test('qué deja cada cosa al romperse; lo demás no se rompe', () => {
  const w = world();
  const cases: [Tile, Tile][] = [
    [Tile.Window, Tile.BrokenWindow],
    [Tile.BoardedWindow, Tile.BrokenWindow],
    [Tile.Door, Tile.BrokenDoor],
    [Tile.WoodWall, Tile.Rubble],
    [Tile.Wall, Tile.Rubble],
  ];
  for (const [from, to] of cases) {
    setTile(w.grid, 2, 2, from);
    expect(damageTile(w, 2, 2, 10_000)).toBe(true);
    expect(getTile(w.grid, 2, 2)).toBe(to);
  }
  for (const t of [Tile.Tree, Tile.Grass, Tile.Rubble, Tile.BrokenDoor]) {
    setTile(w.grid, 2, 2, t);
    expect(damageTile(w, 2, 2, 10_000)).toBe(false);
    expect(getTile(w.grid, 2, 2)).toBe(t);
  }
  expect(w.damage).toEqual({});
});

test('al romperse, los planos que ya no tienen sentido se cancelan (y su madera queda en el suelo)', () => {
  const w = world();
  setTile(w.grid, 2, 2, Tile.Door);
  setTile(w.grid, 5, 5, Tile.Window);
  damageTile(w, 2, 2, 5);
  w.blueprints.push({ id: 50, kind: 'repair', pos: { x: 2, y: 2 }, wood: 1, progress: 0 });
  w.blueprints.push({ id: 51, kind: 'board', pos: { x: 5, y: 5 }, wood: 2, progress: 0 });
  w.woodLog.start = 3;
  damageTile(w, 2, 2, 10_000);
  damageTile(w, 5, 5, 10_000);
  expect(w.blueprints.map((b) => b.id)).toEqual([51]); // tapiar una ventana rota sigue valiendo
  expect(w.piles.reduce((n, p) => n + p.items.wood, 0)).toBe(1);
  expect(checkInvariants(w)).toEqual([]);
});

/** Habitación cerrada de muros de 3×3 por dentro con una puerta en `door`. */
function room(w: World, door: Point) {
  for (let x = 2; x <= 6; x++)
    for (let y = 2; y <= 6; y++)
      if (x === 2 || x === 6 || y === 2 || y === 6) setTile(w.grid, x, y, Tile.Wall);
  setTile(w.grid, door.x, door.y, Tile.Door);
}

test('camino de zombi: entra por la puerta (rompiéndola) antes que por un muro', () => {
  const w = world();
  room(w, { x: 4, y: 6 });
  const path = zombiePath(w, { x: 4, y: 8 }, { x: 4, y: 4 })!;
  expect(path).not.toBeNull();
  expect(path).toContainEqual({ x: 4, y: 6 });
  expect(path.at(-1)).toEqual({ x: 4, y: 4 });
  // Con la puerta muy lejos (al otro lado), sigue sin atravesar el ladrillo: la rodea.
  const w2 = world(9, 15);
  room(w2, { x: 4, y: 2 });
  const p2 = zombiePath(w2, { x: 4, y: 12 }, { x: 4, y: 4 })!;
  expect(p2).toContainEqual({ x: 4, y: 2 });
  expect(p2.some((p) => getTile(w2.grid, p.x, p.y) === Tile.Wall)).toBe(false);
});

test('camino de zombi: lo dañado cuesta menos; sin diagonales por lo rompible; con límite', () => {
  const w = world();
  room(w, { x: 4, y: 6 });
  setTile(w.grid, 6, 4, Tile.Window);
  const path = zombiePath(w, { x: 8, y: 4 }, { x: 4, y: 4 })!;
  expect(path).toContainEqual({ x: 6, y: 4 }); // la ventana (20) es más barata que dar la vuelta
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1]!, path[i]!];
    const diagonal = a.x !== b.x && a.y !== b.y;
    if (diagonal) expect(getTile(w.grid, b.x, b.y)).not.toBe(Tile.Window);
  }
  expect(zombiePath(w, { x: 8, y: 4 }, { x: 4, y: 4 }, 3)).toBeNull(); // se pasa del límite
  setTile(w.grid, 0, 0, Tile.Tree);
  expect(zombiePath(w, { x: 8, y: 8 }, { x: 0, y: 0 })).toBeNull(); // los árboles no se rompen
});

test('dónde se puede poner cada plano de reparar', () => {
  const w = world();
  const at = (t: Tile, x: number, y: number) => {
    setTile(w.grid, x, y, t);
    return { x, y };
  };
  const door = at(Tile.Door, 1, 1);
  const broken = at(Tile.BrokenDoor, 2, 1);
  const bwin = at(Tile.BrokenWindow, 3, 1);
  const rubble = at(Tile.Rubble, 4, 1);
  const wall = at(Tile.Wall, 5, 1);
  expect(canPlace(w, 'repair', door)).toBe(false); // intacta
  damageTile(w, door.x, door.y, 5);
  damageTile(w, wall.x, wall.y, 5);
  expect(canPlace(w, 'repair', door)).toBe(true);
  expect(canPlace(w, 'repair', wall)).toBe(true);
  expect(canPlace(w, 'repair', broken)).toBe(false);
  expect(canPlace(w, 'fixDoor', broken)).toBe(true);
  expect(canPlace(w, 'fixDoor', door)).toBe(false);
  expect(canPlace(w, 'board', bwin)).toBe(true);
  expect(canPlace(w, 'woodWall', rubble)).toBe(true);
  expect(canPlace(w, 'bed', rubble)).toBe(false);
});

function readyPlan(w: World, kind: BuildKind, pos: Point) {
  const b = { id: w.nextId++, kind, pos, wood: BUILD[kind].wood, progress: BUILD[kind].ticks };
  w.blueprints.push(b);
  w.woodLog.chopped += b.wood;
  return b;
}

test('lo que deja cada reparación al terminar', () => {
  const w = world();
  const s = w.survivors[0]!;
  setTile(w.grid, 3, 3, Tile.Door);
  damageTile(w, 3, 3, 30);
  setTile(w.grid, 5, 3, Tile.BrokenDoor);
  setTile(w.grid, 7, 3, Tile.Rubble);
  for (const [kind, x] of [
    ['repair', 3],
    ['fixDoor', 5],
    ['woodWall', 7],
  ] as const) {
    const b = readyPlan(w, kind, { x, y: 3 });
    s.pos = { x: x + 0.5, y: 4.5 };
    expect(workOnBlueprint(w, s, b.id)).toBe(true);
  }
  expect(resistanceOf(w, 3, 3)).toBe(RESISTANCE[Tile.Door]);
  expect(getTile(w.grid, 5, 3)).toBe(Tile.Door);
  expect(getTile(w.grid, 7, 3)).toBe(Tile.WoodWall);
  expect(checkInvariants(w)).toEqual([]);
});

test('no se termina con un zombi encima o a punto de pisarla', () => {
  const w = world();
  const s = w.survivors[0]!;
  setTile(w.grid, 4, 4, Tile.BrokenDoor);
  const b = readyPlan(w, 'fixDoor', { x: 4, y: 4 });
  s.pos = { x: 4.5, y: 3.5 };
  const z = newZombie(w, { x: 4, y: 4 });
  w.zombies.push(z);
  expect(workOnBlueprint(w, s, b.id)).toBe(false);
  z.pos = { x: 4.5, y: 5.5 };
  z.path = [{ x: 4, y: 4 }];
  expect(workOnBlueprint(w, s, b.id)).toBe(false);
  z.path = [];
  expect(workOnBlueprint(w, s, b.id)).toBe(true);
});

test('reparar va antes: el constructor y el que acarrea eligen antes un plano de reparar', () => {
  const w = world(15, 15);
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 1.5 };
  readyPlan(w, 'table', { x: 2, y: 2 });
  setTile(w.grid, 12, 12, Tile.BrokenDoor);
  const fix = readyPlan(w, 'fixDoor', { x: 12, y: 12 });
  fix.progress = 0;
  const job = buildJob(s, w);
  expect(job).toMatchObject({ then: { type: 'build', blueprintId: fix.id } });
  // Acarrear: dos planos sin madera, el de reparar más lejos.
  w.blueprints = [];
  w.storage.items.wood = 5;
  w.woodLog.start = 5 + w.woodLog.chopped;
  w.woodLog.chopped = 0;
  w.blueprints.push({ id: 90, kind: 'table', pos: { x: 3, y: 3 }, wood: 0, progress: 0 });
  w.blueprints.push({ id: 91, kind: 'fixDoor', pos: { x: 12, y: 12 }, wood: 0, progress: 0 });
  const haul = haulJob(addSurvivor(w, { x: 1, y: 2 }), w);
  expect(haul).toMatchObject({ then: { type: 'fetchWood', blueprintId: 91 } });
});

test('orden de poner un plano de reparar', () => {
  const w = world();
  setTile(w.grid, 3, 3, Tile.BrokenDoor);
  issue(w, { type: 'placeBlueprint', kind: 'fixDoor', x: 3, y: 3 });
  ordersSystem(w);
  expect(w.blueprints).toMatchObject([{ kind: 'fixDoor', pos: { x: 3, y: 3 } }]);
});

test('tapiar una ventana dañada, o destapiarla, la deja entera (no arrastra el daño)', () => {
  const w = world();
  const s = w.survivors[0]!;
  setTile(w.grid, 3, 3, Tile.Window);
  damageTile(w, 3, 3, RESISTANCE[Tile.Window]! - 5);
  setTile(w.grid, 5, 3, Tile.BoardedWindow);
  damageTile(w, 5, 3, 60);
  for (const [kind, x] of [
    ['board', 3],
    ['unboard', 5],
  ] as const) {
    const b = readyPlan(w, kind, { x, y: 3 });
    s.pos = { x: x + 0.5, y: 4.5 };
    expect(workOnBlueprint(w, s, b.id)).toBe(true);
  }
  expect(getTile(w.grid, 3, 3)).toBe(Tile.BoardedWindow);
  expect(resistanceOf(w, 3, 3)).toBe(RESISTANCE[Tile.BoardedWindow]);
  expect(getTile(w.grid, 5, 3)).toBe(Tile.Window);
  expect(resistanceOf(w, 5, 3)).toBe(RESISTANCE[Tile.Window]);
  expect(checkInvariants(w)).toEqual([]);
});
