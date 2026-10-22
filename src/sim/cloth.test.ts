// H4d §2, §5 y §9: objetos y armas nuevos, botín, casillas, Fabricar como trabajo e invariantes.
import { expect, test } from 'vitest';
import {
  ITEM_WEIGHT_KG,
  LOOT_CLOTH_TOTAL,
  NEEDLE_TOTAL,
  RESISTANCE,
  THREAD_PER_SPOOL,
  THREAD_SPOOLS,
  TRAIT_SKILL_MODS,
  WEAPON_STATS,
} from './balance';
import { checkInvariants } from './invariants';
import { emptyInventory, ITEM_KINDS } from './items';
import { bestInStorage, equipFromPack } from './jobs/weapons';
import { createGrid, isWalkable, isZombieWalkable, setTile } from './map/grid';
import { capacityKg, SKILLS } from './skills';
import { damageTile } from './structures';
import { emptyWorld } from './testing/fixtures';
import { Tile } from './types';
import { isOpaque } from './vision';
import { createWorld, defaultWork } from './world';

test('objetos nuevos: tela, cortinas, hilo (por usos), aguja, palanca y machete, con su peso', () => {
  expect(ITEM_KINDS).toEqual([
    'food',
    'bandage',
    'knife',
    'bat',
    'axe',
    'wood',
    'cloth',
    'curtains',
    'thread',
    'needle',
    'crowbar',
    'machete',
  ]);
  expect(ITEM_WEIGHT_KG).toMatchObject({
    cloth: 0.2,
    curtains: 0.5,
    thread: 0.01,
    needle: 0.05,
    crowbar: 2,
    machete: 1,
  });
  expect(emptyInventory()).toMatchObject({ cloth: 0, thread: 0, machete: 0 });
});

test('armas nuevas: palanca 30/15 y machete 35/15; lo mejor es machete > palanca > hacha > bate > cuchillo', () => {
  expect(WEAPON_STATS.crowbar).toEqual({ damage: 30, ticks: 15 });
  expect(WEAPON_STATS.machete).toEqual({ damage: 35, ticks: 15 });
  const w = emptyWorld(4, 4);
  const s = w.survivors[0]!;
  const order = ['machete', 'crowbar', 'axe', 'bat', 'knife'] as const;
  for (const k of order) w.storage.items[k] = 1;
  for (const k of order) {
    expect(bestInStorage(s, w)).toBe(k);
    w.storage.items[k] = 0;
  }
});

test('equipar de la carga no le pasa de su capacidad (un machete pesa menos que el hacha que deja)', () => {
  const s = emptyWorld(4, 4).survivors[0]!;
  s.equipped = 'axe';
  s.carrying.machete = 1;
  s.carrying.wood = Math.floor(capacityKg(s)) - 1; // lleno: el hacha (2 kg) no cabe por el machete (1 kg)
  equipFromPack(s);
  expect(s.equipped).toBe('axe');
  s.carrying.wood -= 1; // ahora sí cabe
  equipFromPack(s);
  expect(s.equipped).toBe('machete');
  expect(s.carrying.axe).toBe(1);
});

test('botín: 30 telas, 6 carretes de hilo (10 usos cada uno) y 3 agujas por mapa; algunas palancas y machetes', () => {
  expect(THREAD_PER_SPOOL).toBe(10);
  let crowbars = 0;
  let machetes = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(seed);
    const sum = (k: 'cloth' | 'thread' | 'needle' | 'crowbar' | 'machete') =>
      w.containers.reduce((n, c) => n + c.items[k], 0);
    expect(sum('cloth')).toBe(LOOT_CLOTH_TOTAL);
    expect(sum('thread')).toBe(THREAD_SPOOLS * THREAD_PER_SPOOL);
    expect(sum('needle')).toBe(NEEDLE_TOTAL);
    for (const c of w.containers) expect(c.items.thread % THREAD_PER_SPOOL).toBe(0);
    // La tela, en armarios y estanterías (no en neveras).
    for (const c of w.containers) if (c.kind === 'fridge') expect(c.items.cloth).toBe(0);
    crowbars += sum('crowbar');
    machetes += sum('machete');
  }
  expect(crowbars / 20).toBeGreaterThan(1);
  expect(machetes / 20).toBeGreaterThan(0.5);
  expect(machetes).toBeLessThan(crowbars);
});

test('el botín nuevo no cambia nada más del mundo con la misma semilla', () => {
  const w = createWorld(5);
  expect(w.survivors.map((s) => `${s.name}:${s.traits.join('+')}`)).toEqual([
    'Óscar:handy+slowLearner',
    'Nuria:unpleasant',
    'Raúl:keenEye',
  ]);
});

test('casillas nuevas: ventana con cortinas corridas (60) y puerta atrancada (150); ni se pisan ni dejan ver', () => {
  const g = createGrid(3, 3, Tile.Grass);
  for (const t of [Tile.CurtainedWindow, Tile.LockedDoor]) {
    setTile(g, 1, 1, t);
    expect(isWalkable(g, 1, 1)).toBe(false);
    expect(isZombieWalkable(g, 1, 1)).toBe(false);
    expect(isOpaque(g, 1, 1)).toBe(true);
  }
  expect(RESISTANCE[Tile.CurtainedWindow]).toBe(RESISTANCE[Tile.Window]);
  expect(RESISTANCE[Tile.LockedDoor]).toBe(150);
});

test('al empezar: todas las ventanas con cortinas abiertas, sin pedidos y con las cuentas de armas a 0', () => {
  const w = createWorld(3);
  const windows = w.grid.tiles.flatMap((t, i) => (t === Tile.Window ? [i] : []));
  expect(windows.length).toBeGreaterThan(0);
  expect([...w.curtains].sort((a, b) => a - b)).toEqual(windows);
  expect(w.bills).toEqual([]);
  expect(w.weaponLog).toEqual({ fromCorpses: 0, rotted: 0 });
  expect(checkInvariants(w)).toEqual([]);
});

test('Fabricar: trabajo y habilidad nuevos, detrás de Construir; todos lo tienen; Manitas y Torpe, ±2', () => {
  expect(SKILLS).toEqual(['social', 'build', 'craft', 'haul', 'chop', 'loot', 'fight']);
  expect(defaultWork([]).craft).toBe(true);
  expect(defaultWork(['coward']).craft).toBe(true);
  expect(TRAIT_SKILL_MODS.handy).toEqual({ build: 2, craft: 2 });
  expect(TRAIT_SKILL_MODS.clumsy).toEqual({ build: -2, craft: -2 });
  const w = createWorld(3);
  for (const s of w.survivors) {
    expect(s.skills.craft.level).toBeGreaterThanOrEqual(0);
    expect(s.priorities).toEqual({ social: 3, build: 3, craft: 3, haul: 3, chop: 3, loot: 3 });
  }
});

test('invariantes: cortinas solo en ventanas (y toda corrida, en la lista), prioridades 1–4 y pedidos con N ≥ 1', () => {
  const w = emptyWorld(4, 4);
  setTile(w.grid, 1, 1, Tile.CurtainedWindow);
  setTile(w.grid, 2, 1, Tile.Window);
  w.curtains = [1 * 4 + 2]; // la de (1,1) está corrida pero no está en la lista
  expect(checkInvariants(w).join()).toMatch(/cortinas corridas sin cortinas/);
  w.curtains = [5, 6, 0]; // (0,0) es hierba
  expect(checkInvariants(w).join()).toMatch(/cortinas en una casilla que no es ventana/);
  w.curtains = [5, 6];
  expect(checkInvariants(w)).toEqual([]);
  w.survivors[0]!.priorities.build = 5;
  expect(checkInvariants(w).join()).toMatch(/prioridad de build: 5/);
  w.survivors[0]!.priorities.build = 3;
  w.bills = [{ id: 1, recipe: 'bandages', mode: 'until', target: 0, done: 0 }];
  expect(checkInvariants(w).join()).toMatch(/pedido 1/);
});

test('si un zombi rompe una ventana con cortinas, las cortinas se pierden', () => {
  const w = emptyWorld(4, 4);
  for (const t of [Tile.Window, Tile.CurtainedWindow]) {
    setTile(w.grid, 1, 1, t);
    w.curtains = [5];
    damageTile(w, 1, 1, 1000);
    expect(w.grid.tiles[5]).toBe(Tile.BrokenWindow);
    expect(w.curtains).toEqual([]);
    expect(checkInvariants(w)).toEqual([]);
  }
});
