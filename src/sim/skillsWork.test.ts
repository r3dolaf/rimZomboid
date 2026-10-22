// H4c §3–4: lo que cambia cada habilidad en el trabajo, y la práctica que da.
import { expect, test } from 'vitest';
import {
  BUILD,
  BUILD_NOISE_TICKS,
  CHOP_TICKS,
  CONSOLE_TICKS,
  SEARCH_TICKS,
  SOCIAL_XP,
  TICKS_PER_HOUR,
  WEAPON_STATS,
} from './balance';
import { colonistHit } from './combat';
import { needsConsoling, tryStartConsoling } from './consoling';
import { checkInvariants } from './invariants';
import { workOnBlueprint } from './jobs/build';
import { haulJob } from './jobs/haul';
import { moodModifiers } from './mood';
import { buildFailChance, capacityKg, consoleChance, hitChance, loadFactor } from './skills';
import { applyChat } from './systems/social';
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
      items: {
        food: 1,
        bandage: 0,
        knife: 0,
        bat: 0,
        axe: 0,
        wood: 0,
        cloth: 0,
        curtains: 0,
        thread: 0,
        needle: 0,
        crowbar: 0,
        machete: 0,
      },
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
  for (let seed = 1; seed <= 50; seed++) {
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

test('Transportar: capacidad 6 kg con 0, 8 con 5 (como antes) y 10 con 10', () => {
  const s = emptyWorld(2, 2).survivors[0]!;
  for (const [level, kg] of [
    [0, 6],
    [5, 8],
    [10, 10],
  ] as const) {
    s.skills.haul.level = level;
    expect(capacityKg(s)).toBeCloseTo(kg, 9);
  }
});

test('al registrar, cada uno coge lo que le cabe según su capacidad', () => {
  for (const [level, food] of [
    [0, 12],
    [10, 20],
  ] as const) {
    const w = world();
    const s = w.survivors[0]!;
    s.skills.haul.level = level;
    w.containers = [
      {
        id: 1,
        houseId: 0,
        pos: { x: 3, y: 3 },
        kind: 'fridge',
        items: {
          food: 40,
          bandage: 0,
          knife: 0,
          bat: 0,
          axe: 0,
          wood: 0,
          cloth: 0,
          curtains: 0,
          thread: 0,
          needle: 0,
          crowbar: 0,
          machete: 0,
        },
        searched: false,
        designated: true,
        reservedBy: s.id,
      },
    ];
    s.action = { type: 'search', containerId: 1, ticksLeft: 1 };
    activitiesSystem(w);
    expect(s.carrying.food).toBe(food); // 0,5 kg cada lata
  }
});

test('invariante: nadie lleva más de lo que puede', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.skills.haul.level = 0;
  s.carrying.food = 12; // 6 kg
  expect(checkInvariants(w)).toEqual([]);
  s.carrying.food = 14;
  expect(checkInvariants(w).join()).toMatch(/carga 7 kg > 6/);
});

test('ir cargado frena: a plena carga ×0,6 con 0, ×0,75 con 5 y ×0,9 con 10; vacío, nada', () => {
  const s = emptyWorld(2, 2).survivors[0]!;
  expect(loadFactor(s)).toBe(1);
  for (const [level, full] of [
    [0, 0.6],
    [5, 0.75],
    [10, 0.9],
  ] as const) {
    s.skills.haul.level = level;
    s.carrying = { ...s.carrying, wood: 0 };
    s.carrying.wood = Math.floor(capacityKg(s));
    expect(loadFactor(s)).toBeCloseTo(1 - (1 - full) * (s.carrying.wood / capacityKg(s)), 9);
  }
  s.skills.haul.level = 5;
  s.carrying.wood = 4; // media carga
  expect(loadFactor(s)).toBeCloseTo(0.875, 9);
});

test('andando y huyendo, quien va cargado avanza menos por tick; y practica Transportar', () => {
  const w = world();
  const s = w.survivors[0]!;
  const walk = (run: boolean) => {
    s.pos = { x: 0.5, y: 0.5 };
    s.path = [{ x: 7, y: 0 }];
    s.action = { type: 'moveTo', target: { x: 7, y: 0 }, run };
    movementSystem(w);
    return s.pos.x - 0.5;
  };
  const emptyWalk = walk(false);
  const emptyRun = walk(true);
  expect(s.skills.haul.xp).toBe(0); // sin carga no practica
  s.carrying.wood = 8; // plena carga con nivel 5
  expect(walk(false)).toBeCloseTo(emptyWalk * 0.75, 9);
  expect(walk(true)).toBeCloseTo(emptyRun * 0.75, 9);
  expect(s.skills.haul.xp).toBe(2);
});

test('Pelear: acierta un 60 % con 0, un 75 % con 5 y un 90 % con 10', () => {
  // (Con 50 % a nivel 0, como empiezan casi todos entre 0 y 3, caían 4 veces más la 1.ª semana.)
  expect(hitChance(0)).toBeCloseTo(0.6, 9);
  expect(hitChance(5)).toBeCloseTo(0.75, 9);
  expect(hitChance(10)).toBeCloseTo(0.9, 9);
  for (const level of [0, 10]) {
    const w = world();
    const s = w.survivors[0]!;
    s.skills.fight.level = level;
    const z = newZombie(w, { x: 1, y: 0 });
    w.zombies.push(z);
    let hits = 0;
    for (let i = 0; i < 3000; i++) {
      s.skills.fight = { level, xp: 0 }; // si no, aprendería y subiría de nivel
      z.health = 1000;
      colonistHit(w, s, z);
      if (z.health < 1000) hits++;
    }
    expect(hits / 3000).toBeCloseTo(hitChance(level), 1);
  }
});

test('Pelear: cada golpe, acierte o no, da la práctica de lo que tarda el arma', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.equipped = 'bat';
  const z = newZombie(w, { x: 1, y: 0 });
  w.zombies.push(z);
  z.health = 1000;
  for (let i = 0; i < 4; i++) colonistHit(w, s, z);
  expect(s.skills.fight.xp).toBe(4 * WEAPON_STATS.bat.ticks);
});

/** Ana (en crisis) consuela Bea, a su lado. */
function consoling(seed: number) {
  const w = world();
  w.rng = createRng(seed);
  const c = w.survivors[0]!;
  const t = addSurvivor(w, { x: 1, y: 0 }, 'Bea');
  t.needs.mood = 5;
  c.action = { type: 'console', otherId: t.id, ticksLeft: 1 };
  t.action = { type: 'consoled', otherId: c.id };
  return { w, c, t };
}

test('Social: consolar sale bien un 50 % con 0, un 75 % con 5 y siempre con 10; y da práctica', () => {
  expect(consoleChance(0)).toBeCloseTo(0.5, 9);
  expect(consoleChance(5)).toBeCloseTo(0.75, 9);
  expect(consoleChance(10)).toBe(1);
  for (const level of [0, 10]) {
    let ok = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const { w, c, t } = consoling(seed);
      c.skills.social.level = level;
      activitiesSystem(w);
      if (t.memories.some((m) => m.id === 'consoled')) ok++;
      expect(c.skills.social.xp).toBe(level === 10 ? 0 : SOCIAL_XP.console);
    }
    expect(ok / 400).toBeCloseTo(consoleChance(level), 1);
  }
});

test('consolar sin éxito: sin "Le consoló", al registro, y durante 1 h nadie vuelve a intentarlo', () => {
  let failed = false;
  for (let seed = 1; seed <= 50 && !failed; seed++) {
    const { w, c, t } = consoling(seed);
    c.skills.social.level = 0;
    activitiesSystem(w);
    if (t.memories.some((m) => m.id === 'consoled')) continue;
    expect(w.log.at(-1)).toMatchObject({ kind: 'consoleFailed', survivorId: c.id, otherId: t.id });
    expect(c.action.type).toBe('idle');
    expect(t.action.type).toBe('idle');
    expect(needsConsoling(t, w)).toBe(false);
    expect(moodModifiers(t, w.tick).some((m) => m.id === 'notConsoled')).toBe(false); // no pesa
    w.tick += TICKS_PER_HOUR;
    expect(needsConsoling(t, w)).toBe(true);
    expect(checkInvariants(w)).toEqual([]);
    failed = true;
  }
  expect(failed).toBe(true);
});

test('Social: cada charla agradable da un poco de práctica a los dos', () => {
  const w = world();
  const a = w.survivors[0]!;
  const b = addSurvivor(w, { x: 1, y: 0 }, 'Bea');
  applyChat(w, a, b, 'pleasant');
  expect(a.skills.social.xp).toBe(SOCIAL_XP.chat);
  expect(b.skills.social.xp).toBe(SOCIAL_XP.chat);
  applyChat(w, a, b, 'neutral');
  expect(a.skills.social.xp).toBe(SOCIAL_XP.chat);
});

test('consolar sin éxito no reinicia la crisis: sigue donde estaba y no se vuelve a registrar', () => {
  let failed = false;
  for (let seed = 1; seed <= 50 && !failed; seed++) {
    const w = world();
    w.rng = createRng(seed);
    const c = w.survivors[0]!;
    c.skills.social.level = 0;
    const t = addSurvivor(w, { x: 1, y: 0 }, 'Bea');
    t.needs.mood = 5;
    t.action = { type: 'crisis', ticksLeft: 400 };
    c.opinions[t.id] = 80;
    c.pos = { x: 1.5, y: 1.5 };
    expect(tryStartConsoling(w, c, t.id)).toBe(true);
    for (let i = 0; i < CONSOLE_TICKS && c.action.type === 'console'; i++) activitiesSystem(w);
    if (t.memories.some((m) => m.id === 'consoled')) continue;
    failed = true;
    // Donde la dejó (en el mismo tick ya avanza uno).
    expect(t.action.type).toBe('crisis');
    expect(t.action.type === 'crisis' && t.action.ticksLeft).toBeGreaterThanOrEqual(399);
    expect(w.log.filter((e) => e.kind === 'crisis')).toHaveLength(0);
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(failed).toBe(true);
});
