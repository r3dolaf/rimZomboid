// H6c §2.6–§2.7: quien se va puede ser atacado por los zombis; en la base se come primero del
// almacén (lo de la mochila, para cuando no hay).
import { expect, test } from 'vitest';
import { EAT_BELOW, NIGHT_START_HOUR, START_HOUR, TICKS_PER_HOUR } from './balance';
import { isNight } from './clock';
import { knockDown } from './body';
import { banish } from './death';
import { emptyInventory } from './items';
import { NAMES } from './names';
import { loadGame, saveGame } from './save';
import { step } from './step';
import { freeNames, newStranger, roadEnds } from './systems/strangers';
import { addSurvivor, emptyWorld } from './testing/fixtures';
import { Tile, type Action, type Container } from './types';
import { findWork, stillWorthIt } from './work';
import { createWorld } from './world';
import { newZombie } from './zombies/spawn';

test('a quien se va le pueden atacar los zombis (le persiguen como a cualquiera)', () => {
  const w = emptyWorld(30, 30);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  const bea = addSurvivor(w, { x: 20, y: 20 }, 'Bea');
  w.survivors[0]!.pos = { x: 2.5, y: 2.5 };
  banish(w, bea);
  expect(w.leaving).toContain(bea);
  bea.path = Array.from({ length: 15 }, (_, i) => ({ x: 19 - i, y: 20 })); // un camino largo al borde
  const z = newZombie(w, { x: 21, y: 20 });
  w.zombies.push(z);
  for (let i = 0; i < 30; i++) step(w);
  expect(z.targetId === bea.id || bea.wounds.length > 0).toBe(true);
});

test('en la base, con hambre, come del almacén aunque lleve comida encima', () => {
  const w = emptyWorld(20, 20);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 5, y: 5 }];
  w.storage.items.food = 4;
  const ana = w.survivors[0]!;
  ana.pos = { x: w.base.rect.x + 1.5, y: w.base.rect.y + 1.5 };
  ana.carrying.food = 2;
  ana.needs.hunger = EAT_BELOW - 5;
  for (let i = 0; i < 400 && ana.needs.hunger < EAT_BELOW; i++) step(w);
  expect(ana.needs.hunger).toBeGreaterThan(EAT_BELOW);
  expect(ana.carrying.food).toBe(2);
  expect(w.storage.items.food).toBe(3);
});

// --- H6c §2.9: sin nombres repetidos ---

test('los nombres usados se recuerdan: el de un muerto no vuelve a salir', () => {
  const w = createWorld(5);
  for (const s of w.survivors) expect(w.common.usedNames).toContain(s.name);
  const dead = w.survivors.pop()!; // se ha ido de la colonia
  expect(freeNames(w)).not.toContain(dead.name);
  const a = newStranger(w, roadEnds(w)[0]!);
  expect(w.common.usedNames).toContain(a.name);
  // Aunque ya no esté (se marchó), su nombre no se repite.
  expect(freeNames(w)).not.toContain(a.name);
  for (let i = 0; i < 5; i++) {
    const b = newStranger(w, roadEnds(w)[0]!);
    expect(b.name).not.toBe(dead.name);
    expect(b.name).not.toBe(a.name);
  }
});

test('si ya se han usado todos, vuelven los que nadie lleva ahora', () => {
  const w = createWorld(5);
  w.common.usedNames = [...NAMES];
  const free = freeNames(w);
  expect(free.length).toBeGreaterThan(0);
  for (const s of w.survivors) expect(free).not.toContain(s.name);
});

test('una partida guardada sin la lista de nombres se carga y la rellena con los de ahora', () => {
  const w = createWorld(5);
  const raw = JSON.parse(
    saveGame(w, { day: 1, seed: 5, savedAt: 'x', narrator: 'balanced', zombies: 'normal' }),
  ) as { world: { common: Record<string, unknown> } };
  delete raw.world.common.usedNames;
  const r = loadGame(JSON.stringify(raw));
  if ('error' in r) throw new Error(r.error);
  for (const s of r.world.survivors) expect(r.world.common.usedNames).toContain(s.name);
});

// --- H6c §2.10: los cuerpos, solo de día (salvo dentro de la base) ---

function corpseWorld(inBase: boolean) {
  const w = emptyWorld(30, 30);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.base.rect = { x: 0, y: 0, w: 10, h: 10 };
  w.storage.tiles = [{ x: 2, y: 2 }];
  w.storage.items.food = 50; // con comida de sobra: saquear no va delante de todo
  const ana = w.survivors[0]!;
  ana.pos = { x: 3.5, y: 3.5 };
  for (const k of Object.keys(ana.work) as (keyof typeof ana.work)[]) ana.work[k] = k === 'loot';
  const items = emptyInventory();
  items.food = 1;
  const pos = inBase ? { x: 6, y: 6 } : { x: 20, y: 20 };
  const c: Container = {
    id: w.common.nextId++,
    houseId: -1,
    pos,
    kind: 'corpse',
    items,
    searched: false,
    designated: true,
    reservedBy: null,
    until: 1e9,
  };
  w.containers.push(c);
  return { w, ana, c };
}

const NIGHT = (NIGHT_START_HOUR - START_HOUR) * TICKS_PER_HOUR + 10;
const goesTo = (a: Action | null, id: number) =>
  a?.type === 'moveTo' && a.then?.type === 'search' && a.then.containerId === id;

test('de día va a registrar un cuerpo de fuera; de noche no', () => {
  const day = corpseWorld(false);
  expect(goesTo(findWork(day.ana, day.w), day.c.id)).toBe(true);
  const night = corpseWorld(false);
  night.w.tick = NIGHT;
  expect(isNight(night.w.tick)).toBe(true);
  expect(goesTo(findWork(night.ana, night.w), night.c.id)).toBe(false);
});

test('de noche sí registra los cuerpos que hay dentro de la base', () => {
  const { w, ana, c } = corpseWorld(true);
  w.tick = NIGHT;
  expect(goesTo(findWork(ana, w), c.id)).toBe(true);
});

test('si se hace de noche de camino a un cuerpo de fuera, lo deja', () => {
  const { w, ana, c } = corpseWorld(false);
  ana.action = findWork(ana, w)!;
  expect(goesTo(ana.action, c.id)).toBe(true);
  expect(stillWorthIt(ana, w)).toBe(true);
  w.tick = NIGHT;
  expect(stillWorthIt(ana, w)).toBe(false);
});

test('a quien se va no le derriban: sigue andando, herido, hasta el borde (no desaparece a medio mapa)', () => {
  const w = emptyWorld(30, 30);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  const bea = addSurvivor(w, { x: 20, y: 20 }, 'Bea');
  w.survivors[0]!.pos = { x: 2.5, y: 2.5 };
  banish(w, bea);
  bea.path = Array.from({ length: 20 }, (_, i) => ({ x: 19 - i, y: 20 }));
  knockDown(w, bea);
  expect(bea.action.type).not.toBe('downed');
  step(w);
  expect(w.leaving).toContain(bea);
  expect(w.returning).toHaveLength(0);
  for (let i = 0; i < 2000 && w.leaving.length > 0; i++) step(w);
  expect(w.returning).toHaveLength(1);
  expect(w.returning[0]!.pos).toEqual({ x: 0, y: 20 });
});
