// H4b §5: la Salud se recupera, "Herido", derribos y levantarse.
import { expect, test } from 'vitest';
import {
  DOWNED_HARD_MAX_TICKS,
  DOWNED_MAX_TICKS,
  DOWNED_TICKS,
  GET_UP_HEALTH,
  HEALTH_PER_HOUR,
  HURT_BELOW,
  MEMORY_EFFECTS,
  TICKS_PER_HOUR,
} from '../balance';
import { hurtSurvivor, healthSystem } from '../health';
import { checkInvariants } from '../invariants';
import { moodModifiers } from '../mood';
import { step } from '../step';
import { emptyWorld, withoutZombies } from '../testing/fixtures';
import { needsConsoling } from '../consoling';
import { isAvailable } from '../social';
import { setTile } from '../map/grid';
import { Tile, type Survivor } from '../types';
import { createWorld } from '../world';
import { newZombie } from './spawn';

const world = () => {
  const w = emptyWorld(8, 8);
  w.seen.fill(1);
  return w;
};

test('la Salud se recupera: poco despierto, más durmiendo y más aún en cama', () => {
  const w = world();
  const s = w.survivors[0]!;
  const hour = (action: typeof s.action) => {
    s.health = 40;
    s.action = action;
    for (let i = 0; i < TICKS_PER_HOUR; i++) healthSystem(w);
    return s.health - 40;
  };
  expect(hour({ type: 'idle', ticksLeft: 0 })).toBeCloseTo(HEALTH_PER_HOUR.awake);
  expect(hour({ type: 'sleep', inBed: false })).toBeCloseTo(HEALTH_PER_HOUR.floor);
  expect(hour({ type: 'sleep', inBed: true })).toBeCloseTo(HEALTH_PER_HOUR.bed);
  expect(HEALTH_PER_HOUR.awake).toBeLessThan(HEALTH_PER_HOUR.floor);
  expect(HEALTH_PER_HOUR.floor).toBeLessThan(HEALTH_PER_HOUR.bed);
  s.health = 99.99;
  for (let i = 0; i < TICKS_PER_HOUR; i++) healthSystem(w);
  expect(s.health).toBe(100);
});

test('"Herido" (−10) mientras tenga menos de 50', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.health = HURT_BELOW;
  expect(moodModifiers(s, w.tick).map((m) => m.id)).not.toContain('hurt');
  s.health = HURT_BELOW - 1;
  expect(moodModifiers(s, w.tick)).toContainEqual({ id: 'hurt', value: -10 });
});

test('derribado: cae, no se recupera y a las 4 h se levanta con 15 y "Le derribaron"', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.action = { type: 'eat', ticksLeft: 5 };
  hurtSurvivor(w, s, 150);
  expect(s.health).toBe(0);
  expect(s.action).toEqual({ type: 'downed', until: DOWNED_TICKS });
  expect(w.log.at(-1)).toMatchObject({ kind: 'downed', survivorId: s.id });
  hurtSurvivor(w, s, 10); // ya en el suelo: nada cambia
  expect(s.action).toEqual({ type: 'downed', until: DOWNED_TICKS });
  for (let i = 0; i < DOWNED_TICKS - 1; i++) {
    healthSystem(w);
    w.tick++;
  }
  expect(s.health).toBe(0);
  expect(s.action.type).toBe('downed');
  w.tick++; // ya son las 4 h
  healthSystem(w);
  expect(s.health).toBe(GET_UP_HEALTH);
  expect(s.action).toEqual({ type: 'idle', ticksLeft: 0 });
  expect(s.memories.map((m) => m.id)).toContain('downed');
  expect(MEMORY_EFFECTS.downed.value).toBe(-15);
  expect(w.log.at(-1)).toMatchObject({ kind: 'gotUp', survivorId: s.id });
});

test('en el suelo el sueño sigue bajando, pero no se "desploma" encima: sigue derribado', () => {
  const w = world();
  const s = w.survivors[0]!;
  hurtSurvivor(w, s, 100);
  s.needs.sleep = 0;
  const hunger = s.needs.hunger;
  for (let i = 0; i < 50; i++) step(w);
  expect(s.action.type).toBe('downed');
  expect(s.needs.hunger).toBeLessThan(hunger);
  expect(checkInvariants(w)).toEqual([]);
});

test('a las 4 h no se levanta con zombis a 8 casillas o menos: sigue en el suelo hasta que se van', () => {
  const w = emptyWorld(30, 30);
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  hurtSurvivor(w, s, 100);
  const z = newZombie(w, { x: 10, y: 5 });
  w.zombies.push(z);
  w.tick = DOWNED_TICKS + 10;
  healthSystem(w);
  expect(s.action.type).toBe('downed');
  z.pos = { x: 20.5, y: 20.5 };
  healthSystem(w);
  expect(s.action.type).toBe('idle');
});

test('en el suelo (o peleando con zombis) nadie le consuela ni le habla: sigue en el suelo', () => {
  const w = withoutZombies(createWorld(3));
  w.tick = 2 * TICKS_PER_HOUR;
  for (const s of w.survivors) {
    s.needs.hunger = 100;
    s.needs.sleep = 100;
    s.needs.mood = 60;
    s.work.loot = false;
  }
  const [t, c] = w.survivors as [Survivor, Survivor];
  t.needs.mood = 5;
  c.opinions[t.id] = 50;
  c.pos = { ...t.pos };
  hurtSurvivor(w, t, 200);
  for (let i = 0; i < TICKS_PER_HOUR; i++) step(w);
  expect(t.action.type).toBe('downed');
  expect(w.log.some((e) => e.kind === 'consoled' || e.kind === 'fight')).toBe(false);
  expect(isAvailable(t)).toBe(false);
  t.action = { type: 'melee', zombieId: 1, cooldown: 0 };
  expect(isAvailable(t)).toBe(false);
  expect(needsConsoling(t, w)).toBe(false);
});

test('para levantarse solo cuentan los zombis que ve; con uno al lado, ni a las 8 h (H4e: hasta las 16)', () => {
  const w = emptyWorld(30, 30);
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  hurtSurvivor(w, s, 100);
  for (let y = 0; y < 30; y++) setTile(w.grid, 8, y, Tile.Wall);
  const z = newZombie(w, { x: 10, y: 5 }); // a 5 casillas, detrás de un muro
  w.zombies.push(z);
  w.tick = DOWNED_TICKS;
  healthSystem(w);
  expect(s.action.type).toBe('idle');

  hurtSurvivor(w, s, 100);
  z.pos = { x: 6.5, y: 5.5 }; // al lado
  w.tick += DOWNED_MAX_TICKS;
  healthSystem(w);
  expect(s.action.type).toBe('downed'); // H4e: si se levantara con él al lado, volvería a caer
  w.tick += DOWNED_HARD_MAX_TICKS - DOWNED_MAX_TICKS;
  healthSystem(w);
  expect(s.action.type).toBe('idle');
  expect(DOWNED_MAX_TICKS).toBe(8 * TICKS_PER_HOUR);
});
