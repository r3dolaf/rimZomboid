// H5b2 §4: pelear con una bolsa en la mano (según el arma) y la hachuela, que también tala.
import { expect, test } from 'vitest';
import {
  AXE_DROP_PREF,
  CHOP_TICKS,
  HAND_BAG_DAMAGE,
  HAND_BAG_HIT,
  HATCHET_CHOP,
  WEAPON_STATS,
} from './balance';
import { has, newBag } from './bags';
import { combatSystem, weaponHit } from './combat';
import { checkInvariants } from './invariants';
import { chopJob, startChopActivity } from './jobs/chop';
import { canChop, equipFromPack, weaponJob } from './jobs/weapons';
import { hitChance, workSpeed } from './skills';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Survivor, type World } from './types';
import { newZombie } from './zombies/spawn';

function ana(): { w: World; s: Survivor } {
  const w = emptyWorld(12, 12);
  w.grid.tiles.fill(Tile.Floor);
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  return { w, s };
}

test('cifras: con bolsa en la mano, bate y palanca −15 % de acierto y −25 % de daño', () => {
  expect([HAND_BAG_HIT, HAND_BAG_DAMAGE, AXE_DROP_PREF, HATCHET_CHOP]).toEqual([
    0.85, 0.75, 0.75, 1.5,
  ]);
});

test('acierto y daño: con una mano, igual; bate y palanca, peor con bolsa en la mano', () => {
  const { w, s } = ana();
  const base = hitChance(s.skills.fight.level, s);
  for (const k of ['knife', 'machete', 'hatchet', 'bat', 'crowbar', 'axe'] as const) {
    s.equipped = k;
    s.bags.hand = null;
    expect(weaponHit(s)).toEqual({ chance: base, damage: WEAPON_STATS[k].damage });
    s.bags.hand = newBag(w, 'duffel');
    const two = k === 'bat' || k === 'crowbar';
    expect(weaponHit(s).chance).toBeCloseTo(two ? base * HAND_BAG_HIT : base, 9);
    expect(weaponHit(s).damage).toBeCloseTo(
      WEAPON_STATS[k].damage * (two ? HAND_BAG_DAMAGE : 1),
      9,
    );
  }
});

test('con el hacha de talar suelta la bolsa de la mano al empezar a pelear', () => {
  const { w, s } = ana();
  const duffel = newBag(w, 'duffel');
  duffel.items.food = 2;
  s.bags.hand = duffel;
  s.equipped = 'axe';
  const z = newZombie(w, { x: 6, y: 5 }, false);
  w.zombies.push(z);
  s.action = { type: 'melee', zombieId: z.id, cooldown: 0 };
  combatSystem(w);
  expect(s.bags.hand).toBeNull();
  expect(s.droppedBag).toBe(duffel.id);
  const pile = w.piles.find((p) => p.items.pieces.includes(duffel));
  expect(pile?.pos).toEqual({ x: 5, y: 5 });
  expect(w.bagLog.dropped).toBe(1);
  expect(w.log.some((e) => e.kind === 'bagDropped' && e.survivorId === s.id)).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('con bolsa en la mano prefiere un arma de una mano (el cuchillo a la palanca)', () => {
  const { w, s } = ana();
  w.storage.tiles = [{ x: 1, y: 1 }];
  s.equipped = 'knife';
  w.storage.items.crowbar = 1;
  expect(weaponJob(s, w)).not.toBeNull(); // sin bolsa, la palanca es mejor
  s.bags.hand = newBag(w, 'clothBag');
  expect(weaponJob(s, w)).toBeNull();
  w.storage.items.machete = 1;
  expect(weaponJob(s, w)).not.toBeNull(); // el machete, sí
  // Lo que lleva encima, igual: el bate no le compensa.
  s.carrying.bat = 1;
  equipFromPack(s);
  expect(s.equipped).toBe('knife');
  expect(has(s, 'bat')).toBe(1);
});

test('la hachuela tala sin ir a por el hacha, pero tarda 1,5 veces más', () => {
  const { w, s } = ana();
  w.storage.tiles = [{ x: 1, y: 1 }];
  s.work.chop = true;
  const tree = 5 * w.grid.width + 8;
  w.grid.tiles[tree] = Tile.Tree;
  w.chopMarks = [tree];
  s.equipped = 'hatchet';
  s.weaponLocked = true;
  expect(canChop(s)).toBe(true);
  expect(chopJob(s, w)).toMatchObject({ then: { type: 'chop', tree } });
  s.pos = { x: 7.5, y: 5.5 };
  const a = startChopActivity(s, w, { type: 'chop', tree });
  expect(a).toMatchObject({
    type: 'chop',
    ticksLeft: Math.round((CHOP_TICKS * HATCHET_CHOP) / workSpeed(s, 'chop')),
  });
});
