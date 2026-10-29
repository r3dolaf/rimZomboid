// Sucesos sociales malos (spec H3c §3.1).
import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from '../balance';
import { checkInvariants } from '../invariants';
import { issue } from '../orders';
import { chatWeights, opinionOf } from '../social';
import { step } from '../step';
import type { MemoryId, Survivor, World } from '../types';
import { createWorld } from '../world';
import { clashEvent } from './clash';
import { foodFightEvent } from './foodFight';
import { gossipEvent } from './gossip';
import { griefEvent } from './grief';
import { jealousyEvent } from './jealousy';
import { theftEvent } from './theft';

const BASE = new Map<number, World>();

/** Mundo tranquilo: opiniones a 0, comida, sin narrador y lejos del cambio de día. */
function calm(seed = 3): { w: World; a: Survivor; b: Survivor; c: Survivor } {
  if (!BASE.has(seed)) BASE.set(seed, createWorld(seed));
  const w = structuredClone(BASE.get(seed)!);
  w.tick = 1000; // a las 0 de cada día las opiniones se diluyen
  w.narrator.nextEventAt = 1e9;
  for (const s of w.survivors) {
    s.traits = [];
    s.needs.hunger = 100;
    s.needs.sleep = 100;
    s.needs.mood = 60;
    s.nextChatAt = 1e9; // sin charlas que muevan las opiniones
    for (const o of w.survivors) if (o !== s) s.opinions[o.id] = 0;
  }
  const [a, b, c] = w.survivors as [Survivor, Survivor, Survivor];
  return { w, a, b, c };
}

const has = (s: Survivor, id: MemoryId, otherId?: number) =>
  s.memories.some((m) => m.id === id && (otherId === undefined || m.otherId === otherId));

/** Repite con varias semillas del azar. */
function trials(n: number, fn: (seed: number) => void) {
  for (let i = 0; i < n; i++) fn(i * 7919 + 1);
}

// --- 1. Raciones robadas ---

test('robo: requisitos, latas que faltan, sospechoso y decisión', () => {
  const { w } = calm();
  expect(theftEvent.tone).toBe('bad');
  expect(theftEvent.severity).toBe(3);
  expect(theftEvent.cooldownDays).toBe(6);
  w.storage.items.food = 2;
  expect(theftEvent.canHappen(w)).toBe(false);
  w.storage.items.food = 10;
  expect(theftEvent.canHappen(w)).toBe(true);
  theftEvent.happen(w);
  const d = w.decisions[0]!;
  expect(d.kind).toBe('theft');
  const suspect = w.survivors.find((s) => s.id === d.survivorIds[0])!;
  const cans = 10 - w.storage.items.food;
  expect(cans).toBeGreaterThanOrEqual(1);
  expect(cans).toBeLessThanOrEqual(3);
  for (const o of w.survivors) if (o !== suspect) expect(opinionOf(o, suspect.id)).toBe(-10);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'theft', suspectId: suspect.id, cans });
  expect(checkInvariants(w)).toEqual([]);
});

test('robo: un 60 % el sospechoso es culpable, y el hambre y los rasgos pesan', () => {
  let guilty = 0;
  let glutton = 0;
  trials(1000, (seed) => {
    const { w, a } = calm();
    a.traits = ['glutton'];
    w.rng = { s: seed };
    theftEvent.happen(w);
    if (w.decisions[0]!.guilty) guilty++;
    if (w.decisions[0]!.survivorIds[0] === a.id) glutton++;
  });
  expect(guilty).toBeGreaterThan(550);
  expect(guilty).toBeLessThan(650);
  expect(glutton).toBeGreaterThan(420); // peso 2 de 4: la mitad
  expect(glutton).toBeLessThan(580);
});

function robbed(guilty: boolean) {
  const x = calm();
  x.w.storage.items.food = 10;
  theftEvent.happen(x.w);
  const d = x.w.decisions[0]!;
  d.guilty = guilty;
  const suspect = x.w.survivors.find((s) => s.id === d.survivorIds[0])!;
  const others = x.w.survivors.filter((s) => s !== suspect);
  return { ...x, d, suspect, others };
}

test('robo, Castigar al culpable: "Le castigaron" y confiesa', () => {
  const { w, d, suspect, others } = robbed(true);
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  step(w);
  expect(has(suspect, 'punished')).toBe(true);
  for (const o of others) expect(opinionOf(suspect, o.id)).toBeGreaterThanOrEqual(-1);
  expect(w.common.log.at(-1)).toMatchObject({
    kind: 'theftPunished',
    suspectId: suspect.id,
    guilty: true,
  });
});

test('robo, Castigar a un inocente: "Le castigaron sin culpa", −20 a todos y se sabe la verdad', () => {
  const { w, d, suspect, others } = robbed(false);
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  step(w);
  expect(has(suspect, 'punishedUnfairly')).toBe(true);
  expect(has(suspect, 'punished')).toBe(false);
  for (const o of others) expect(opinionOf(suspect, o.id)).toBe(-20);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'theftPunished', guilty: false });
});

test('robo, Dejarlo estar (también al caducar): más desconfianza y "Alguien nos roba"', () => {
  for (const timeout of [false, true]) {
    const { w, d, suspect, others } = robbed(true);
    if (timeout) w.tick = d.expiresAt;
    else issue(w, { type: 'decide', decisionId: d.id, option: 1 });
    step(w);
    for (const o of others) {
      expect(opinionOf(o, suspect.id)).toBe(-20);
      expect(has(o, 'thiefAmongUs')).toBe(true);
    }
    expect(has(suspect, 'thiefAmongUs')).toBe(false);
    expect(w.decisions).toEqual([]);
    expect(w.common.log.at(-1)).toMatchObject({ kind: 'theftIgnored', suspectId: suspect.id });
  }
});

// --- 2. Celos ---

test('celos: solo con una pareja y alguien que aprecia a uno de los dos', () => {
  const { w, a, b, c } = calm();
  expect(jealousyEvent.canHappen(w)).toBe(false);
  a.partnerId = b.id;
  b.partnerId = a.id;
  a.opinions[b.id] = 60;
  b.opinions[a.id] = 60;
  expect(jealousyEvent.canHappen(w)).toBe(false);
  c.opinions[b.id] = 20;
  expect(jealousyEvent.canHappen(w)).toBe(true);
  jealousyEvent.happen(w);
  expect(has(a, 'jealous', c.id)).toBe(true);
  expect(opinionOf(a, c.id)).toBe(-20);
  expect(opinionOf(a, b.id)).toBe(50);
  expect(opinionOf(b, a.id)).toBe(50);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'jealousy', survivorId: a.id, otherId: c.id });
  expect(checkInvariants(w)).toEqual([]);
});

// --- 3. Choque de caracteres ---

test('choque: dos que no son pareja y se tienen < 30; sus charlas se tuercen', () => {
  const { w, a, b, c } = calm();
  for (const s of [a, b, c]) for (const o of [a, b, c]) if (o !== s) s.opinions[o.id] = 30;
  expect(clashEvent.canHappen(w)).toBe(false);
  a.opinions[b.id] = 29;
  b.opinions[a.id] = 29;
  expect(clashEvent.canHappen(w)).toBe(true);
  const before = chatWeights(a, b);
  clashEvent.happen(w);
  expect(has(a, 'clash', b.id)).toBe(true);
  expect(has(b, 'clash', a.id)).toBe(true);
  const after = chatWeights(a, b);
  expect(after.argue).toBeCloseTo(before.argue + 30, 6);
  expect(after.insult).toBeCloseTo(10, 6); // con buen ánimo y opinión ≥ 0, ahora sí puede insultar
  expect(chatWeights(a, c).insult).toBe(0);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'clash' });
});

test('choque: nunca entre pareja', () => {
  const { w, a, b, c } = calm();
  for (const s of [a, b, c]) for (const o of [a, b, c]) if (o !== s) s.opinions[o.id] = 50;
  a.partnerId = b.id;
  b.partnerId = a.id;
  a.opinions[b.id] = 0;
  b.opinions[a.id] = 0;
  expect(clashEvent.canHappen(w)).toBe(false);
});

// --- 4. Malos recuerdos ---

test('malos recuerdos: a alguien disponible, −20 durante 48 h', () => {
  const { w, a, b, c } = calm();
  b.action = { type: 'sleep', inBed: true };
  c.action = { type: 'crisis', ticksLeft: 10 };
  griefEvent.happen(w);
  expect(has(a, 'grief')).toBe(true);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'grief', survivorId: a.id });
  a.action = { type: 'sleep', inBed: true };
  expect(griefEvent.canHappen(w)).toBe(false);
});

// --- 5. Disputa por el reparto ---

test('disputa: con menos de 2 latas por colono, todos −5 entre sí y "Discusión por la comida"', () => {
  const { w } = calm();
  for (const s of w.survivors) s.carrying.food = 0;
  w.storage.items.food = 6;
  expect(foodFightEvent.canHappen(w)).toBe(false);
  w.storage.items.food = 5;
  expect(foodFightEvent.canHappen(w)).toBe(true);
  foodFightEvent.happen(w);
  for (const s of w.survivors) {
    expect(has(s, 'foodFight')).toBe(true);
    for (const o of w.survivors) if (o !== s) expect(opinionOf(s, o.id)).toBe(-5);
  }
});

// --- 6. Chisme ---

test('chisme: el oyente pasa a tener peor opinión de quien peor le cae al chismoso', () => {
  let found = 0;
  trials(400, (seed) => {
    const { w, a, b, c } = calm();
    a.traits = ['pessimist'];
    a.opinions[c.id] = -30; // a A le cae peor C
    b.opinions[a.id] = -30; // y a B, A: si B chismea, la víctima es A
    w.rng = { s: seed };
    const snap = new Map(w.survivors.map((s) => [s.id, { ...s.opinions }]));
    gossipEvent.happen(w);
    const e = w.common.log.at(-1)!;
    expect(e.kind).toBe('gossip');
    if (e.kind !== 'gossip') return;
    const teller = w.survivors.find((s) => s.id === e.survivorId)!;
    const listener = w.survivors.find((s) => s.id === e.listenerId)!;
    const victim = w.survivors.find((s) => s.id === e.otherId)!;
    expect(new Set([teller, listener, victim]).size).toBe(3);
    if (teller === a) expect(victim).toBe(c);
    expect(opinionOf(listener, victim.id)).toBe((snap.get(listener.id)![victim.id] ?? 0) - 15);
    if (e.found) {
      found++;
      expect(opinionOf(victim, teller.id)).toBeLessThanOrEqual(-20);
    }
  });
  expect(found).toBeGreaterThan(80);
  expect(found).toBeLessThan(160);
});

test('chisme: hacen falta 3 colonos', () => {
  const { w } = calm();
  w.survivors.splice(2, 1);
  w.beds = w.beds.filter((b) => w.survivors.some((s) => s.id === b.ownerId));
  expect(gossipEvent.canHappen(w)).toBe(false);
});

test('todos los sucesos sociales caben en el catálogo con su tono y espera', () => {
  for (const [e, days, severity] of [
    [theftEvent, 6, 3],
    [jealousyEvent, 5, 2],
    [clashEvent, 4, 2],
    [griefEvent, 3, 2],
    [foodFightEvent, 4, 2],
    [gossipEvent, 3, 1],
  ] as const) {
    expect(e.tone).toBe('bad');
    expect(e.cooldownDays).toBe(days);
    expect(e.severity).toBe(severity);
  }
  expect(TICKS_PER_DAY).toBe(7200);
});
