// H5, ajuste tras la partida larga (el usuario pidió que la colonia aguante 1–2 semanas saqueando
// todo sin defenderse): vendas al empezar, cortes que dejan de sangrar solos, menos infección y
// colonos más prudentes con Decidir.
import { expect, test } from 'vitest';
import {
  BANDAGES_CARRIED,
  BLOOD_REGEN,
  DECIDE_MAX_THREATS,
  DECIDE_MIN_BLOOD,
  FLEE_HEALTH,
  MAUL_BELOW,
  MAUL_BITE_CHANCE,
  SCRATCH_CHANCE,
  TICKS_PER_HOUR,
  WOUNDS,
  ZOMBIE_HIT_CHANCE,
} from './balance';
import { addWound } from './body';
import { bloodTick } from './blood';
import { willFight } from './danger';
import { emptyWorld, withoutZombies } from './testing/fixtures';
import { createWorld } from './world';
import { newZombie } from './zombies/spawn';

test('cifras del ajuste', () => {
  expect(WOUNDS).toEqual({
    scratch: { damage: 3, bleed: 2, stopsHours: 1, healDays: 1, infect: 0.03 },
    cut: { damage: 6, bleed: 4, stopsHours: 3, healDays: 3, infect: 0 },
    bite: { damage: 10, bleed: 5, stopsHours: null, healDays: 5, infect: 1 },
  });
  expect(BLOOD_REGEN).toEqual({ awake: 2, rest: 4, hospital: 6 });
  expect([SCRATCH_CHANCE, MAUL_BITE_CHANCE, ZOMBIE_HIT_CHANCE]).toEqual([0.85, 0.05, 0.25]);
  expect([DECIDE_MAX_THREATS, FLEE_HEALTH, DECIDE_MIN_BLOOD]).toEqual([1, MAUL_BELOW, 60]);
});

test('cada colono empieza con sus 2 vendas encima', () => {
  for (const s of createWorld(3).survivors) expect(s.carrying.bandage).toBe(BANDAGES_CARRIED);
});

test('un corte sin vendar deja de sangrar solo a las 3 h; un mordisco, no', () => {
  const w = withoutZombies(emptyWorld(8, 8));
  const s = w.survivors[0]!;
  const cut = addWound(w, s, 'leftLeg', 'cut');
  const bite = addWound(w, s, 'leftArm', 'bite');
  s.infection = null;
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) {
    bloodTick(w, s);
    w.tick++;
  }
  expect(cut.bleeding).toBe(false);
  expect(bite.bleeding).toBe(true);
});

test('con Decidir no pelea con poca sangre ni contra dos zombis (con armas)', () => {
  const w = emptyWorld(20, 20);
  const s = w.survivors[0]!;
  s.pos = { x: 10.5, y: 10.5 };
  s.equipped = 'knife';
  s.stance = 'decide';
  s.traits = [];
  const z1 = newZombie(w, { x: 11, y: 10 });
  const z2 = newZombie(w, { x: 9, y: 10 });
  expect(willFight(w, s, [z1])).toBe(true);
  expect(willFight(w, s, [z1, z2])).toBe(false);
  s.blood = DECIDE_MIN_BLOOD - 1;
  expect(willFight(w, s, [z1])).toBe(false);
  s.stance = 'fight'; // con Pelear, pelea igual (salvo muy herido)
  expect(willFight(w, s, [z1])).toBe(true);
});
