// H4c §3–4: lo que cambia cada habilidad en el trabajo, y la práctica que da.
import { expect, test } from 'vitest';
import { BUILD, BUILD_NOISE_TICKS, CHOP_TICKS, SEARCH_TICKS } from './balance';
import { checkInvariants } from './invariants';
import { workOnBlueprint } from './jobs/build';
import { haulJob } from './jobs/haul';
import { buildFailChance } from './skills';
import { damageTile } from './structures';
import { newZombie } from './zombies/spawn';
import { startChopActivity } from './jobs/chop';
import { setTile } from './map/grid';
import { createRng } from './rng';
import { activitiesSystem } from './systems/activities';
import { movementSystem } from './systems/movement';
import { addSurvivor, emptyWorld } from './testing/fixtures';
import { Tile, type Action, type Blueprint, type BuildKind, type World } from './types';

function world(): World {
  const w = emptyWorld(8, 8);
  w.seen.fill(1);
  return w;
}

test('Talar: dura CHOP_TICKS con nivel 5, el doble con 0 y dos tercios con 10; cada tick da práctica', () => {
  const w = world();
  const s = w.survivors[0]!;
  setTile(w.grid, 3, 2, Tile.Tree);
  const tree = 2 * w.grid.width + 3;
  w.chopMarks = [tree];
  s.pos = { x: 2.5, y: 2.5 };
  s.equipped = 'axe';
  const ticks = (level: number) => {
    s.skills.chop.level = level;
    const a = startChopActivity(s, w, { type: 'chop', tree });
    return a.type === 'chop' ? a.ticksLeft : -1;
  };
  expect(ticks(5)).toBe(CHOP_TICKS);
  expect(ticks(0)).toBe(CHOP_TICKS * 2);
  expect(ticks(10)).toBe(Math.round(CHOP_TICKS / 1.5));
  s.skills.chop = { level: 5, xp: 0 };
  s.action = startChopActivity(s, w, { type: 'chop', tree });
  for (let i = 0; i < 40; i++) activitiesSystem(w);
  expect(s.skills.chop.xp).toBe(40);
});

test('Saquear: registrar dura SEARCH_TICKS con nivel 5, el doble con 0; cada tick da práctica', () => {
  const w = world();
  const s = w.survivors[0]!;
  w.containers = [
    {
      id: 1,
      houseId: 0,
      pos: { x: 3, y: 3 },
      kind: 'shelf',
      items: { food: 1, bandage: 0, knife: 0, bat: 0, axe: 0, wood: 0 },
      searched: false,
      designated: true,
      reservedBy: s.id,
    },
  ];
  const start = (level: number) => {
    s.skills.loot = { level, xp: 0 };
    s.path = [];
    s.action = { type: 'moveTo', target: { x: 0, y: 0 }, then: { type: 'search', containerId: 1 } };
    movementSystem(w);
    const a = s.action as Action; // movementSystem la cambia
    return a.type === 'search' ? a.ticksLeft : -1;
  };
  expect(start(5)).toBe(SEARCH_TICKS);
  expect(start(10)).toBe(Math.round(SEARCH_TICKS / 1.5));
  expect(start(0)).toBe(SEARCH_TICKS * 2);
  for (let i = 0; i < 10; i++) activitiesSystem(w);
  expect(s.skills.loot.xp).toBe(10);
});

/** Un plano con toda su madera y alguien al lado trabajando en él. */
function plan(w: World, kind: BuildKind, progress = 0): Blueprint {
  const b = { id: w.nextId++, kind, pos: { x: 4, y: 4 }, wood: BUILD[kind].wood, progress };
  w.blueprints.push(b);
  w.woodLog.chopped += b.wood;
  const s = w.survivors[0]!;
  s.pos = { x: 4.5, y: 5.5 };
  s.action = { type: 'build', blueprintId: b.id };
  return b;
}

test('Construir: cada tick avanza lo que da la habilidad (×0,5 con 0, ×1 con 5, ×1,5 con 10) y da práctica', () => {
  for (const [level, after10] of [
    [0, 5],
    [5, 10],
    [10, 15],
  ] as const) {
    const w = world();
    const s = w.survivors[0]!;
    s.skills.build = { level, xp: 0 };
    const b = plan(w, 'bed');
    for (let i = 0; i < 10; i++) workOnBlueprint(w, s, b.id);
    expect(b.progress).toBeCloseTo(after10, 9);
    expect(s.skills.build.xp).toBe(level === 10 ? 0 : 10); // a 10 ya no se aprende
  }
});

test('Construir: el martillo suena cada BUILD_NOISE_TICKS de avance, vaya rápido o despacio', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.skills.build = { level: 10, xp: 0 };
  const b = plan(w, 'bed');
  const z = newZombie(w, { x: 6, y: 6 });
  w.zombies.push(z);
  let noises = 0;
  while (w.blueprints.includes(b) && b.progress < BUILD.bed.ticks) {
    workOnBlueprint(w, s, b.id);
    if (z.state === 'alert') noises++;
    z.state = 'wander';
    z.goal = null;
  }
  expect(noises).toBe(BUILD.bed.ticks / BUILD_NOISE_TICKS);
});

test('probabilidad de fallar al terminar: 30 % con 0, 10 % con 5, nunca desde 8; Torpe, un 10 % más', () => {
  expect(buildFailChance(0, false)).toBeCloseTo(0.3, 9);
  expect(buildFailChance(5, false)).toBeCloseTo(0.1, 9);
  expect(buildFailChance(8, false)).toBe(0);
  expect(buildFailChance(10, false)).toBe(0);
  expect(buildFailChance(10, true)).toBeCloseTo(0.1, 9);
  expect(buildFailChance(5, true)).toBeCloseTo(0.2, 9);
});

test('al fallar: pierde la mitad de la madera (hacia arriba), el plano vuelve a empezar y se registra', () => {
  let fails = 0;
  for (let i = 0; i < 200; i++) {
    const w = world();
    w.rng = createRng(i + 1);
    const s = w.survivors[0]!;
    s.skills.build = { level: 0, xp: 0 };
    const b = plan(w, 'woodWall', BUILD.woodWall.ticks - 0.5);
    workOnBlueprint(w, s, b.id);
    expect(checkInvariants(w)).toEqual([]);
    if (!w.blueprints.includes(b)) continue; // le ha salido bien
    fails++;
    expect(b.wood).toBe(BUILD.woodWall.wood - 1);
    expect(b.progress).toBe(0);
    expect(w.woodLog.wasted).toBe(1);
    expect(w.log.at(-1)).toMatchObject({
      kind: 'buildFailed',
      survivorId: s.id,
      what: 'woodWall',
      wood: 1,
    });
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(fails).toBeGreaterThan(40); // ~30 % de 200
  expect(fails).toBeLessThan(80);
  // Una reparación de 1 de madera la pierde entera.
  let failed = false;
  for (let i = 0; i < 100 && !failed; i++) {
    const w = world();
    w.rng = createRng(i + 1);
    w.survivors[0]!.skills.build = { level: 0, xp: 0 };
    setTile(w.grid, 4, 4, Tile.Door);
    damageTile(w, 4, 4, 10);
    const b = plan(w, 'repair', BUILD.repair.ticks - 0.5);
    workOnBlueprint(w, w.survivors[0]!, b.id);
    if (!w.blueprints.includes(b)) continue;
    failed = true;
    expect(b.wood).toBe(0);
    expect(w.log.at(-1)).toMatchObject({ kind: 'buildFailed', what: 'repair', wood: 1 });
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(failed).toBe(true);
});

test('con nivel 8 no falla nunca; quitar tablas (sin madera) tampoco, ni con nivel 0', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.skills.build = { level: 8, xp: 0 };
  for (let i = 0; i < 100; i++) {
    w.blueprints = [];
    const b = plan(w, 'bed', BUILD.bed.ticks - 0.5);
    workOnBlueprint(w, s, b.id);
    expect(w.blueprints.includes(b)).toBe(false);
  }
  s.skills.build = { level: 0, xp: 0 };
  for (let i = 0; i < 100; i++) {
    setTile(w.grid, 4, 4, Tile.BoardedWindow);
    w.blueprints = [];
    const b = plan(w, 'unboard', BUILD.unboard.ticks - 0.5);
    workOnBlueprint(w, s, b.id);
    expect(w.blueprints.includes(b)).toBe(false);
  }
  expect(w.log.some((e) => e.kind === 'buildFailed')).toBe(false);
});

test('tras fallar, el plano vuelve a pedir madera: quien acarrea va a por lo que falta', () => {
  for (let seed = 1; ; seed++) {
    const w = world();
    w.rng = createRng(seed);
    const s = w.survivors[0]!;
    s.skills.build = { level: 0, xp: 0 };
    const b = plan(w, 'woodWall', BUILD.woodWall.ticks - 0.5);
    workOnBlueprint(w, s, b.id);
    if (!w.blueprints.includes(b)) continue;
    w.storage.items.wood = 3;
    w.woodLog.start += 3;
    expect(haulJob(addSurvivor(w, { x: 1, y: 1 }), w)).toMatchObject({
      then: { type: 'fetchWood', blueprintId: b.id },
    });
    break;
  }
});

test('invariante: el avance de un plano, entre 0 y lo que dura', () => {
  const w = world();
  const b = plan(w, 'bed', BUILD.bed.ticks);
  expect(checkInvariants(w)).toEqual([]);
  b.progress = BUILD.bed.ticks + 0.5;
  expect(checkInvariants(w).join()).toMatch(/avance no válido/);
});
