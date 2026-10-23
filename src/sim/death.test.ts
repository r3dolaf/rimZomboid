// H5 §8: la muerte — causas, el cuerpo, el ánimo de los demás, lo que se queda colgando, levantarse
// como zombi y los desconocidos que mueren a la puerta.
import { expect, test } from 'vitest';
import {
  CORPSE_ROT_TICKS,
  DEATH_MOOD_MAX,
  DEATH_MOOD_MIN,
  MEMORY_EFFECTS,
  RISE_TICKS,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { addWound, knockDown } from './body';
import { colonistHit } from './combat';
import { gameTime } from './clock';
import { deathSystem, killSurvivor } from './death';
import { addDecision } from './decisions';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { moodModifiers } from './mood';
import { step } from './step';
import { activitiesSystem } from './systems/activities';
import { acceptStrangers, doorOutside, newStranger } from './systems/strangers';
import { addBase, addSurvivor, emptyWorld, withoutZombies } from './testing/fixtures';
import type { Survivor, World } from './types';
import { createWorld, tileOf } from './world';
import { hordeSystem } from './zombies/hordes';
import { newZombie } from './zombies/spawn';

/** Base en (2, 2)–(11, 9); Ana (con cama), Bea y Cris dentro. */
function world(): { w: World; ana: Survivor; bea: Survivor; cris: Survivor } {
  const w = withoutZombies(addBase(emptyWorld(40, 40), { x: 2, y: 2, w: 10, h: 8 }));
  w.seen.fill(1);
  w.tick = TICKS_PER_DAY / 2;
  const ana = w.survivors[0]!;
  ana.pos = { x: 4.5, y: 5.5 };
  const bea = addSurvivor(w, { x: 6, y: 5 });
  const cris = addSurvivor(w, { x: 8, y: 5 }, 'Cris');
  return { w, ana, bea, cris };
}

const body = (w: World, name: string) => w.containers.find((c) => c.name === name);

test('desangrado: muere, deja de ser de la colonia, queda su cuerpo con lo que llevaba y su arma, y se apunta', () => {
  const { w, ana } = world();
  ana.carrying.food = 2;
  ana.carrying.bandage = 1;
  ana.equipped = 'bat';
  addWound(w, ana, 'leftLeg', 'cut');
  ana.blood = 0.001;
  step(w);
  expect(w.survivors.map((s) => s.name)).not.toContain('Ana');
  const c = body(w, 'Ana');
  expect(c).toMatchObject({ kind: 'corpse', pos: { x: 4, y: 5 }, searched: false });
  expect(c?.items).toMatchObject({ food: 2, bandage: 1, bat: 1 });
  expect(c?.until).toBe(w.tick - 1 + CORPSE_ROT_TICKS);
  expect(c?.risesAt).toBeUndefined();
  expect(w.dead).toEqual([
    { id: ana.id, name: 'Ana', day: gameTime(w.tick - 1).day, cause: 'blood' },
  ]);
  expect(w.log.some((e) => e.kind === 'died' && e.name === 'Ana' && e.cause === 'blood')).toBe(
    true,
  );
  expect(checkInvariants(w)).toEqual([]);
});

test('golpes: con la cabeza (o el torso) a 0, muere de las heridas', () => {
  const { w, ana } = world();
  for (let i = 0; i < 2; i++) addWound(w, ana, 'head', 'bite');
  step(w);
  expect(w.dead[0]).toMatchObject({ name: 'Ana', cause: 'wounds' });
});

test('hambre: sin comer y sin sangre, muere de hambre', () => {
  const { w, ana } = world();
  ana.needs.hunger = 0;
  ana.blood = 0.001;
  step(w);
  expect(w.dead[0]).toMatchObject({ name: 'Ana', cause: 'hunger' });
});

test('ánimo: todos "Ha muerto Ana" según lo que pensaban de ella; su pareja, más y se queda sin pareja', () => {
  const { w, ana, bea, cris } = world();
  expect([MEMORY_EFFECTS.died, MEMORY_EFFECTS.partnerDied]).toEqual([
    { value: -15, hours: 72 },
    { value: -30, hours: 120 },
  ]);
  expect([DEATH_MOOD_MIN, DEATH_MOOD_MAX]).toEqual([-25, -5]);
  const dan = addSurvivor(w, { x: 9, y: 6 }, 'Dan');
  ana.partnerId = bea.id;
  bea.partnerId = ana.id;
  cris.opinions[ana.id] = 100;
  dan.opinions[ana.id] = -100;
  killSurvivor(w, ana, 'blood');
  const grief = (s: Survivor) => moodModifiers(s, w.tick).filter((m) => m.otherId === ana.id);
  expect(grief(bea)).toEqual([
    { id: 'partnerDied', value: -30, expiresAt: w.tick + 120 * TICKS_PER_HOUR, otherId: ana.id },
  ]);
  expect(bea.partnerId).toBeNull();
  expect(grief(cris)).toEqual([
    { id: 'died', value: -25, expiresAt: w.tick + 72 * TICKS_PER_HOUR, otherId: ana.id },
  ]);
  expect(grief(dan)[0]?.value).toBe(-5);
  // Si muere otro, se suma (no sustituye al anterior).
  killSurvivor(w, dan, 'blood');
  expect(moodModifiers(cris, w.tick).filter((m) => m.id === 'died')).toHaveLength(2);
  expect(checkInvariants(w)).toEqual([]);
});

test('su cama queda libre (y la coge quien no tiene); a quien estaba con él en algo de dos se le corta', () => {
  const { w, ana, bea, cris } = world();
  expect(bea.bedId).toBeNull();
  bea.action = { type: 'fight', otherId: ana.id, ticksLeft: 50 };
  ana.action = { type: 'fight', otherId: bea.id, ticksLeft: 50 };
  cris.action = {
    type: 'moveTo',
    target: { x: 4, y: 5 },
    then: { type: 'console', otherId: ana.id },
  };
  killSurvivor(w, ana, 'wounds');
  expect(w.beds[0]!.ownerId).toBe(bea.id);
  expect(bea.bedId).toBe(w.beds[0]!.id);
  expect(bea.action).toEqual({ type: 'idle', ticksLeft: 0 });
  expect(cris.action).toEqual({ type: 'idle', ticksLeft: 0 });
  expect(bea.opinions[ana.id]).toBeUndefined();
  expect(checkInvariants(w)).toEqual([]);
});

test('si lo llevaban en brazos, se suelta; si llevaba a alguien, lo deja en el suelo', () => {
  const { w, ana, bea, cris } = world();
  knockDown(w, ana);
  bea.carryingId = ana.id;
  if (ana.action.type === 'downed') ana.action.carriedBy = bea.id;
  bea.action = {
    type: 'moveTo',
    target: { x: 3, y: 3 },
    then: { type: 'dropOff', downedId: ana.id },
  };
  ana.pos = { ...bea.pos };
  killSurvivor(w, ana, 'blood');
  expect(bea.carryingId).toBeNull();
  expect(bea.action.type).toBe('idle');
  knockDown(w, cris);
  bea.carryingId = cris.id;
  if (cris.action.type === 'downed') cris.action.carriedBy = bea.id;
  bea.action = {
    type: 'moveTo',
    target: { x: 3, y: 3 },
    then: { type: 'dropOff', downedId: cris.id },
  };
  cris.pos = { ...bea.pos };
  killSurvivor(w, bea, 'blood');
  expect(cris.action.type === 'downed' && cris.action.carriedBy).toBeUndefined();
  expect(checkInvariants(w)).toEqual([]);
});

test('sus avisos de decisión desaparecen; lo que iba a registrar queda libre; los zombis le pierden', () => {
  const { w, ana, bea } = world();
  addDecision(w, 'birthday', [ana.id]);
  addDecision(w, 'birthday', [bea.id]);
  w.containers.push({
    id: 50,
    houseId: -1,
    pos: { x: 20, y: 20 },
    kind: 'corpse',
    items: { ...w.storage.items },
    searched: false,
    designated: true,
    reservedBy: ana.id,
  });
  ana.action = {
    type: 'moveTo',
    target: { x: 20, y: 20 },
    then: { type: 'search', containerId: 50 },
  };
  const z = newZombie(w, { x: 30, y: 30 });
  z.targetId = ana.id;
  z.state = 'chase';
  w.zombies.push(z);
  killSurvivor(w, ana, 'blood');
  expect(w.decisions.map((d) => d.survivorIds)).toEqual([[bea.id]]);
  expect(w.containers.find((c) => c.id === 50)?.reservedBy).toBeNull();
  expect(z.targetId).toBeNull();
  expect(checkInvariants(w)).toEqual([]);
});

test('infectado: a la hora se levanta como "Ana (zombi)"; lo que llevaba queda en un montón', () => {
  expect(RISE_TICKS).toBe(TICKS_PER_HOUR);
  const { w, ana } = world();
  ana.infection = { at: 0, deathAt: w.tick };
  ana.carrying.food = 3;
  killSurvivor(w, ana, 'infection');
  const c = body(w, 'Ana')!;
  expect(c.risesAt).toBe(w.tick + RISE_TICKS);
  w.tick += RISE_TICKS - 1;
  deathSystem(w);
  expect(w.zombies).toHaveLength(0);
  w.tick++;
  deathSystem(w);
  expect(body(w, 'Ana')).toBeUndefined();
  expect(w.zombies).toHaveLength(1);
  expect(w.zombies[0]).toMatchObject({ name: 'Ana', pos: { x: 4.5, y: 5.5 } });
  expect(w.piles.find((p) => p.pos.x === 4 && p.pos.y === 5)?.items.food).toBe(3);
  expect(w.log.some((e) => e.kind === 'rose' && e.name === 'Ana')).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('infectado y muerto por acabar con su sufrimiento: no se levanta', () => {
  const { w, ana } = world();
  ana.infection = { at: 0, deathAt: w.tick + 1000 };
  killSurvivor(w, ana, 'mercy');
  expect(body(w, 'Ana')?.risesAt).toBeUndefined();
});

test('un desconocido que muere a la puerta: al registro; si no queda ninguno, su aviso desaparece', () => {
  const { w } = world();
  const door = doorOutside(w);
  const [x, y] = [newStranger(w, door), newStranger(w, { x: door.x + 1, y: door.y })] as [
    Survivor,
    Survivor,
  ];
  w.stranger = { survivors: [x, y], leaving: false };
  addDecision(w, 'stranger', [x.id, y.id]);
  killSurvivor(w, x, 'blood');
  expect(w.stranger?.survivors).toEqual([y]);
  expect(w.decisions[0]?.survivorIds).toEqual([y.id]);
  expect(w.dead).toEqual([]);
  expect(w.log.some((e) => e.kind === 'strangerDied' && e.names[0] === x.name)).toBe(true);
  expect(body(w, x.name)).toBeDefined();
  expect(checkInvariants(w)).toEqual([]);
  y.blood = 0.001;
  y.wounds = [];
  addWound(w, y, 'leftLeg', 'cut');
  step(w);
  expect(w.stranger).toBeNull();
  expect(w.decisions).toEqual([]);
  expect(checkInvariants(w)).toEqual([]);
});

test('mordida y con zombis encima hasta morir: la partida sigue sin romperse, también sin nadie', () => {
  const w = withoutZombies(addBase(emptyWorld(40, 40), { x: 2, y: 2, w: 10, h: 8 }));
  w.seen.fill(1);
  const ana = w.survivors[0]!;
  ana.pos = { x: 25.5, y: 25.5 };
  ana.stance = 'fight';
  for (const part of ['leftLeg', 'rightLeg', 'leftArm'] as const) addWound(w, ana, part, 'bite');
  for (let i = 0; i < 6; i++) w.zombies.push(newZombie(w, { x: 24 + (i % 3), y: 24 + (i % 2) }));
  for (let i = 0; i < 2 * TICKS_PER_DAY && w.survivors.length > 0; i++) {
    step(w);
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(w.survivors).toEqual([]);
  expect(w.dead[0]?.name).toBe('Ana');
  expect(body(w, 'Ana')?.pos).toEqual(tileOf(ana.pos));
  for (let i = 0; i < 300; i++) step(w); // y sin nadie, sigue
  expect(checkInvariants(w)).toEqual([]);
});

test('invariantes: ningún muerto sigue en la colonia', () => {
  const { w, ana } = world();
  w.dead.push({ id: ana.id, name: 'Ana', day: 1, cause: 'blood' });
  expect(checkInvariants(w).join()).toMatch(/Ana.*muert/);
});

// --- H5 §9: fin de partida ---

test('cuando no queda nadie en la colonia (muertos o idos), se acaba: sin narrador ni desconocidos; los zombis siguen', () => {
  const { w, ana, bea, cris } = world();
  const door = doorOutside(w);
  const x = newStranger(w, door);
  w.stranger = { survivors: [x], leaving: false };
  addDecision(w, 'stranger', [x.id]);
  killSurvivor(w, ana, 'blood');
  killSurvivor(w, bea, 'wounds');
  step(w);
  expect(w.over).toBeNull();
  killSurvivor(w, cris, 'hunger');
  step(w);
  expect(w.over).toEqual({ tick: w.tick - 1 });
  expect(w.log.some((e) => e.kind === 'colonyFell')).toBe(true);
  expect(w.stranger?.leaving ?? true).toBe(true); // el que esperaba se va
  expect(w.decisions).toEqual([]);
  w.narrator.nextEventAt = w.tick;
  const events = w.log.length;
  w.zombies.push(newZombie(w, { x: 30, y: 30 }));
  for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) step(w);
  expect(w.log.slice(events).some((e) => e.kind === 'strangerArrived')).toBe(false);
  expect(w.narrator.nextEventAt).toBeLessThanOrEqual(w.tick); // el narrador ya no hace nada
  expect(w.zombies[0]!.pos).not.toEqual({ x: 30.5, y: 30.5 });
  expect(w.over).toEqual({ tick: expect.any(Number) });
  expect(checkInvariants(w)).toEqual([]);
});

test('para el resumen: zombis matados, asedios resistidos, lo saqueado y quién se unió', () => {
  const { w } = world();
  expect(w.stats).toEqual({ kills: 0, siegesRepelled: 0, looted: emptyInventory(), joined: [] });
  const fresh = createWorld(3);
  expect(fresh.stats).toEqual(w.stats);
  expect(fresh.over).toBeNull();
});

test('las cuentas: cada zombi que mata un colono, cada asedio que se acaba, lo saqueado y quien se une', () => {
  const { w, ana } = world();
  const z = newZombie(w, { x: 5, y: 5 });
  w.zombies.push(z);
  for (let i = 0; i < 200 && w.zombies.includes(z); i++) colonistHit(w, ana, z);
  expect(w.stats.kills).toBe(1);
  w.hordes.push({ id: 1, kind: 'siege', goal: { x: 5, y: 5 }, until: w.tick + 100, done: false });
  hordeSystem(w);
  expect(w.stats.siegesRepelled).toBe(1);
  w.containers.push({
    id: 60,
    houseId: 1,
    pos: { x: 4, y: 5 },
    kind: 'fridge',
    items: { ...emptyInventory(), food: 3 },
    searched: false,
    designated: true,
    reservedBy: ana.id,
  });
  ana.action = { type: 'search', containerId: 60, ticksLeft: 1 };
  activitiesSystem(w);
  expect(w.stats.looted.food).toBe(3);
  expect(w.log.find((e) => e.kind === 'found')).toMatchObject({ items: { food: 3 } });
  const x = newStranger(w, doorOutside(w));
  w.stranger = { survivors: [x], leaving: false };
  acceptStrangers(w);
  expect(w.stats.joined).toEqual([x.name]);
});
