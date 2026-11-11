// D1: las armas de fuego: a tiro y en línea recta, la munición, el ruido, cuándo se dispara, la
// escopeta, acertar con la distancia y pelear con más zombis con un arma cargada.
import { expect, test } from 'vitest';
import {
  DECIDE_MIN_HEALTH,
  GUN_LOOT,
  GUN_MIN_HIT,
  GUNS,
  SHOTGUN_SPLASH,
  ZOMBIE_HEALTH,
} from './balance';
import { combatSystem } from './combat';
import { createWorld } from './world';
import { willFight, threatsOf } from './danger';
import { chooseGun, gunHitChance, loadedGuns, shootsNow } from './guns';
import { setTile } from './map/grid';
import { createRng } from './rng';
import { hitChance } from './skills';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Survivor, type World, type Zombie } from './types';
import { newZombie } from './zombies/spawn';

function setup(): { w: World; s: Survivor } {
  const w = emptyWorld(30, 30);
  w.seen.fill(1);
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  s.equipped = 'knife';
  return { w, s };
}

function zombie(w: World, x: number, y: number): Zombie {
  const z = newZombie(w, { x, y });
  w.zombies.push(z);
  return z;
}

/** Corre el combate `n` ticks (o hasta que no queden zombis). */
function fight(w: World, n: number): void {
  for (let i = 0; i < n && w.zombies.length > 0; i++) {
    combatSystem(w);
    w.tick++;
  }
}

test('con pistola y balas, en modo combate, dispara a tiro: gasta balas, hace ruido y mata sin moverse', () => {
  const { w, s } = setup();
  w.rng = createRng(3);
  s.carrying.pistol = 1;
  s.carrying.ammo = 10;
  s.drafted = true;
  const z = zombie(w, 11, 5); // a 6 casillas
  const far = zombie(w, 5, 30 - 1); // a 24: lo oye (la pistola, a 30)
  far.state = 'wander';
  s.action = { type: 'melee', zombieId: z.id, cooldown: 0 };
  const at = { ...s.pos };
  for (let i = 0; i < 400 && w.zombies.includes(z); i++) {
    combatSystem(w);
    w.tick++;
  }
  expect(w.zombies.includes(z)).toBe(false);
  expect(s.pos).toEqual(at);
  expect(s.carrying.ammo).toBeLessThan(10);
  expect(s.shot?.gun).toBe('pistol');
  expect(far.state).toBe('alert');
  expect(w.common.log.some((e) => e.kind === 'zombieKilled' && e.survivorId === s.id)).toBe(true);
});

test('cada disparo tarda lo suyo y gasta una bala; sin balas, a golpes (se acerca)', () => {
  const { w, s } = setup();
  s.carrying.pistol = 1;
  s.carrying.ammo = 2;
  s.drafted = true;
  const z = zombie(w, 11, 5);
  z.health = 1e9;
  s.action = { type: 'melee', zombieId: z.id, cooldown: 0 };
  combatSystem(w);
  expect(s.carrying.ammo).toBe(1);
  for (let i = 1; i < GUNS.pistol.ticks; i++) combatSystem(w);
  expect(s.carrying.ammo).toBe(1);
  combatSystem(w);
  expect(s.carrying.ammo).toBe(0);
  fight(w, 30);
  expect(s.pos.x).toBeGreaterThan(5.5); // va hacia él
});

test('fuera de su alcance o sin línea recta, no dispara', () => {
  const { w, s } = setup();
  s.carrying.pistol = 1;
  s.carrying.ammo = 10;
  s.drafted = true;
  const z = zombie(w, 5 + GUNS.pistol.range + 2, 5);
  expect(chooseGun(w, s, z)).toBeNull();
  z.pos = { x: 11.5, y: 5.5 };
  expect(chooseGun(w, s, z)).toBe('pistol');
  for (let y = 0; y < 30; y++) setTile(w.grid, 8, y, Tile.Wall);
  expect(chooseGun(w, s, z)).toBeNull();
});

test('sin modo combate, solo en apuros: con un zombi y bien, no; con dos, herido, sin sangre o en un asedio, sí', () => {
  const { w, s } = setup();
  s.carrying.pistol = 1;
  s.carrying.ammo = 10;
  zombie(w, 9, 5);
  expect(shootsNow(w, s)).toBe(false);
  s.drafted = true;
  expect(shootsNow(w, s)).toBe(true);
  s.drafted = false;
  s.health = DECIDE_MIN_HEALTH - 1;
  expect(shootsNow(w, s)).toBe(true);
  s.health = 100;
  s.blood = 50;
  expect(shootsNow(w, s)).toBe(true);
  s.blood = 100;
  w.hordes.push({ id: 1, kind: 'siege', goal: { x: 5, y: 5 }, done: false });
  expect(shootsNow(w, s)).toBe(true);
  w.hordes[0]!.done = true;
  expect(shootsNow(w, s)).toBe(false);
  zombie(w, 5, 9);
  expect(threatsOf(w, s)).toHaveLength(2);
  expect(shootsNow(w, s)).toBe(true);
});

test('un zombi solo y bien: a golpes, sin gastar balas', () => {
  const { w, s } = setup();
  s.carrying.pistol = 1;
  s.carrying.ammo = 10;
  const z = zombie(w, 9, 5);
  s.action = { type: 'melee', zombieId: z.id, cooldown: 0 };
  fight(w, 600);
  expect(w.zombies).toEqual([]);
  expect(s.carrying.ammo).toBe(10);
});

test('la escopeta da también a los de al lado; si hay otro cerca, la escopeta; si no, la pistola', () => {
  const { w, s } = setup();
  w.rng = createRng(1);
  s.skills.fight = { level: 10, xp: 0 };
  s.carrying.pistol = 1;
  s.carrying.ammo = 10;
  s.carrying.shotgun = 1;
  s.carrying.shells = 10;
  s.drafted = true;
  const z = zombie(w, 9, 5);
  expect(chooseGun(w, s, z)).toBe('pistol');
  const b = zombie(w, 9, 6);
  const c = zombie(w, 10, 5);
  const far = zombie(w, 9, 5 + Math.ceil(SHOTGUN_SPLASH) + 2);
  expect(chooseGun(w, s, z)).toBe('shotgun');
  for (const x of [z, b, c, far]) x.health = 1e6;
  s.action = { type: 'melee', zombieId: z.id, cooldown: 0 };
  // Hasta que acierte (con Pelear 10, casi siempre).
  for (let i = 0; i < 20 && z.health === 1e6; i++) {
    s.action.cooldown = 0;
    combatSystem(w);
  }
  expect(s.carrying.shells).toBeLessThan(10);
  expect(s.carrying.ammo).toBe(10);
  expect(z.health).toBeLessThan(1e6);
  expect(far.health).toBe(1e6);
  // Los de al lado, cada uno con su tirada: en varios disparos, a los dos.
  for (let i = 0; i < 20; i++) {
    s.action.cooldown = 0;
    combatSystem(w);
  }
  expect(b.health).toBeLessThan(1e6);
  expect(c.health).toBeLessThan(1e6);
});

test('acertar: como un golpe, menos con la distancia; como poco, el mínimo', () => {
  const { s } = setup();
  s.skills.fight = { level: 5, xp: 0 };
  expect(gunHitChance(s, 'pistol', 0)).toBeCloseTo(hitChance(5, s));
  expect(gunHitChance(s, 'pistol', 5)).toBeCloseTo(hitChance(5, s) - 5 * GUNS.pistol.falloff);
  expect(gunHitChance(s, 'shotgun', 5)).toBeCloseTo(hitChance(5, s) - 5 * GUNS.shotgun.falloff);
  s.skills.fight = { level: 0, xp: 0 };
  s.missing = ['leftArm', 'rightArm'];
  expect(gunHitChance(s, 'pistol', 8)).toBe(GUN_MIN_HIT);
});

test('un disparo que acierta mata de una vez a un zombi sano (la pistola hace su vida)', () => {
  expect(GUNS.pistol.damage).toBeGreaterThanOrEqual(ZOMBIE_HEALTH);
});

test('con un arma cargada, con Decidir pelea con más zombis; sin munición, como antes', () => {
  const { w, s } = setup();
  s.stance = 'decide';
  for (const [x, y] of [
    [8, 5],
    [5, 8],
    [8, 8],
  ])
    zombie(w, x!, y!);
  const threats = threatsOf(w, s);
  expect(threats).toHaveLength(3);
  expect(willFight(w, s, threats)).toBe(false);
  s.carrying.pistol = 1;
  expect(loadedGuns(s)).toEqual([]);
  expect(willFight(w, s, threats)).toBe(false);
  s.carrying.ammo = 5;
  expect(loadedGuns(s)).toEqual(['pistol']);
  expect(willFight(w, s, threats)).toBe(true);
  s.health = DECIDE_MIN_HEALTH - 1;
  expect(willFight(w, s, threats)).toBe(false);
});

test('el botín: en la comisaría del pueblo, pistolas y balas; escopetas y cartuchos donde tocan', () => {
  let polices = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const w = createWorld(seed);
    for (const h of w.houses) {
      const cs = w.containers.filter((c) => c.houseId === h.id);
      const sum = (k: 'pistol' | 'shotgun' | 'ammo' | 'shells') =>
        cs.reduce((n, c) => n + c.items[k], 0);
      if (h.kind === 'police') {
        polices++;
        expect(sum('pistol')).toBeGreaterThanOrEqual(1);
        expect(sum('pistol')).toBeLessThanOrEqual(2);
        expect(sum('ammo')).toBeGreaterThanOrEqual(12);
        expect(sum('ammo')).toBeLessThanOrEqual(30);
      } else if (!GUN_LOOT[h.kind as keyof typeof GUN_LOOT]) {
        for (const k of ['pistol', 'shotgun', 'ammo', 'shells'] as const) expect(sum(k)).toBe(0);
      }
    }
  }
  expect(polices).toBeGreaterThan(0);
});
