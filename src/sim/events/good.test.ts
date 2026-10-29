// Sucesos buenos (spec H3c §3.2): noche de historias, cumpleaños y alijo.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../balance';
import { piecesGone } from '../clothes';
import { contains } from '../geom';
import { checkInvariants } from '../invariants';
import { issue } from '../orders';
import { opinionOf } from '../social';
import { step } from '../step';
import type { MemoryId, Survivor, World } from '../types';
import { createWorld } from '../world';
import { birthdayEvent } from './birthday';
import { cacheEvent } from './cache';
import { storyNightEvent } from './storyNight';

const BASE = new Map<number, World>();

/** Mundo tranquilo a una hora dada del día 1 (la partida empieza a las 08:00). */
function calm(hour = 20, seed = 3): { w: World; a: Survivor; b: Survivor; c: Survivor } {
  if (!BASE.has(seed)) BASE.set(seed, createWorld(seed));
  const w = structuredClone(BASE.get(seed)!);
  w.tick = (hour - 8) * TICKS_PER_HOUR + 10;
  w.narrator.nextEventAt = 1e9;
  for (const s of w.survivors) {
    s.traits = [];
    s.needs.hunger = 100;
    s.needs.sleep = 100;
    s.needs.mood = 60;
    s.nextChatAt = 1e9;
    for (const o of w.survivors) if (o !== s) s.opinions[o.id] = 0;
  }
  const [a, b, c] = w.survivors as [Survivor, Survivor, Survivor];
  return { w, a, b, c };
}

const has = (s: Survivor, id: MemoryId, otherId?: number) =>
  s.memories.some((m) => m.id === id && (otherId === undefined || m.otherId === otherId));

// --- 7. Noche de historias ---

test('noche de historias: de 19:00 a 23:00 y con ≥ 2 despiertos en la base', () => {
  expect(storyNightEvent.tone).toBe('good');
  expect(storyNightEvent.cooldownDays).toBe(3);
  expect(storyNightEvent.canHappen(calm(18).w)).toBe(false);
  expect(storyNightEvent.canHappen(calm(19).w)).toBe(true);
  expect(storyNightEvent.canHappen(calm(22).w)).toBe(true);
  expect(storyNightEvent.canHappen(calm(23).w)).toBe(false);
  const { w, a, b } = calm();
  a.action = { type: 'sleep', inBed: true };
  b.action = { type: 'sleep', inBed: true };
  expect(storyNightEvent.canHappen(w)).toBe(false);
});

test('noche de historias sin problemas: +8 y +3 de opinión entre todos', () => {
  const { w } = calm();
  for (const s of w.survivors)
    expect(contains(w.base.rect, { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) })).toBe(true);
  storyNightEvent.happen(w);
  for (const s of w.survivors) {
    expect(has(s, 'storyNight')).toBe(true);
    for (const o of w.survivors) if (o !== s) expect(opinionOf(s, o.id)).toBe(3);
  }
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'storyNight', arguedIds: null });
});

test('con rivales, un 40 % acaba en discusión entre ellos; los demás sí lo celebran', () => {
  let ruined = 0;
  for (let i = 0; i < 500; i++) {
    const { w, a, b, c } = calm();
    a.opinions[b.id] = -50;
    w.rng = { s: i * 7919 + 1 };
    storyNightEvent.happen(w);
    const e = w.common.log.at(-1)!;
    if (e.kind !== 'storyNight' || e.arguedIds === null) continue;
    ruined++;
    expect(new Set(e.arguedIds)).toEqual(new Set([a.id, b.id]));
    expect(has(a, 'storyNight')).toBe(false);
    expect(has(a, 'argued', b.id)).toBe(true);
    expect(has(b, 'argued', a.id)).toBe(true);
    expect(opinionOf(a, b.id)).toBe(-60);
    expect(opinionOf(b, a.id)).toBe(-10);
    expect(has(c, 'storyNight')).toBe(true);
  }
  expect(ruined).toBeGreaterThan(160);
  expect(ruined).toBeLessThan(240);
});

test('con alguien al límite, discute con quien peor le cae', () => {
  for (let i = 0; i < 100; i++) {
    const { w, a, b, c } = calm();
    a.needs.mood = 20;
    a.opinions[c.id] = -5;
    w.rng = { s: i * 31 + 7 };
    storyNightEvent.happen(w);
    const e = w.common.log.at(-1)!;
    if (e.kind === 'storyNight' && e.arguedIds)
      expect(new Set(e.arguedIds)).toEqual(new Set([a.id, c.id]));
    void b;
  }
});

// --- 8. Cumpleaños ---

test('cumpleaños: a quien no lo ha tenido; pide decisión', () => {
  const { w, a, b, c } = calm(12);
  expect(birthdayEvent.tone).toBe('good');
  expect(birthdayEvent.cooldownDays).toBe(5);
  a.celebrated = true;
  b.celebrated = true;
  expect(birthdayEvent.canHappen(w)).toBe(true);
  birthdayEvent.happen(w);
  expect(c.celebrated).toBe(true);
  expect(w.decisions[0]).toMatchObject({ kind: 'birthday', survivorIds: [c.id] });
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'birthday', survivorId: c.id });
  expect(birthdayEvent.canHappen(w)).toBe(false);
});

function birthday() {
  const x = calm(12);
  x.a.celebrated = true;
  x.b.celebrated = true;
  birthdayEvent.happen(x.w);
  return { ...x, d: x.w.decisions[0]! };
}

test('Celebrarlo con 2 latas: −2 latas, "Cumpleaños feliz", "Fiesta" y +5', () => {
  const { w, a, b, c, d } = birthday();
  w.storage.items.food = 5;
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  step(w);
  expect(w.storage.items.food).toBe(3);
  expect(has(c, 'happyBirthday')).toBe(true);
  for (const o of [a, b]) {
    expect(has(o, 'party')).toBe(true);
    expect(opinionOf(o, c.id)).toBe(5);
  }
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'birthdayParty', survivorId: c.id });
});

test('un rival puede amargarlo (30 %): "Le amargaron el cumpleaños" y −15 al rival', () => {
  let ruined = 0;
  for (let i = 0; i < 500; i++) {
    const { w, a, c, d } = birthday();
    w.storage.items.food = 5;
    a.opinions[c.id] = -50;
    w.rng = { s: i * 104729 + 3 };
    issue(w, { type: 'decide', decisionId: d.id, option: 0 });
    step(w);
    if (!has(c, 'ruinedBirthday')) continue;
    ruined++;
    expect(has(c, 'happyBirthday')).toBe(false);
    expect(has(c, 'ruinedBirthday', a.id)).toBe(true);
    expect(opinionOf(c, a.id)).toBe(-15);
    expect(w.common.log.at(-1)).toMatchObject({
      kind: 'birthdayRuined',
      survivorId: c.id,
      otherId: a.id,
    });
  }
  expect(ruined).toBeGreaterThan(110);
  expect(ruined).toBeLessThan(190);
});

test('el rival que amarga el cumpleaños se mira antes del +5 de la fiesta', () => {
  let ruined = 0;
  for (let i = 0; i < 400; i++) {
    const { w, a, c, d } = birthday();
    w.storage.items.food = 5;
    a.opinions[c.id] = -42; // con el +5 quedaría en −37, pero ya era rival
    w.rng = { s: i * 7 + 1 };
    issue(w, { type: 'decide', decisionId: d.id, option: 0 });
    step(w);
    if (has(c, 'ruinedBirthday')) ruined++;
  }
  expect(ruined).toBeGreaterThan(80);
});

test('No hay para fiestas (o sin 2 latas, o si caduca): "Nadie celebró su cumpleaños"', () => {
  for (const how of ['no', 'sinComida', 'caduca'] as const) {
    const { w, c, d } = birthday();
    w.storage.items.food = how === 'sinComida' ? 1 : 5;
    if (how === 'caduca') w.tick = d.expiresAt;
    else issue(w, { type: 'decide', decisionId: d.id, option: how === 'no' ? 1 : 0 });
    step(w);
    expect(has(c, 'forgottenBirthday')).toBe(true);
    expect(w.storage.items.food).toBe(how === 'sinComida' ? 1 : 5);
    expect(w.common.log.at(-1)).toMatchObject({ kind: 'birthdaySkipped', survivorId: c.id });
  }
});

// --- 9. Alijo descubierto ---

test('alijo: 3–6 latas en un mueble sin registrar y se ve el interior de la casa', () => {
  const { w } = calm(12);
  expect(cacheEvent.tone).toBe('good');
  expect(cacheEvent.cooldownDays).toBe(4);
  expect(cacheEvent.canHappen(w)).toBe(true);
  const before = w.containers.map((c) => c.items.food);
  cacheEvent.happen(w);
  const e = w.common.log.at(-1)!;
  expect(e.kind).toBe('cache');
  if (e.kind !== 'cache') return;
  const changed = w.containers.filter((c, i) => c.items.food !== before[i]);
  expect(changed).toHaveLength(1);
  const c = changed[0]!;
  expect(c.searched).toBe(false);
  expect(c.houseId).toBe(e.houseId);
  expect(c.items.food - before[w.containers.indexOf(c)]!).toBe(e.cans);
  expect(e.cans).toBeGreaterThanOrEqual(3);
  expect(e.cans).toBeLessThanOrEqual(6);
  const h = w.houses.find((x) => x.id === e.houseId)!;
  for (let y = h.rect.y; y < h.rect.y + h.rect.h; y++)
    for (let x = h.rect.x; x < h.rect.x + h.rect.w; x++)
      expect(w.seen[y * w.grid.width + x]).toBe(1);
  expect(c.designated).toBe(false);
  expect(checkInvariants(w)).toEqual([]);
});

test('alijo en una casa ya saqueada: una despensa escondida que vuelve a estar por registrar', () => {
  const { w } = calm(12);
  for (const c of w.containers) {
    c.searched = true;
    piecesGone(w, c.items.pieces); // H5b: la ropa se va con lo vaciado
    c.items = {
      food: 0,
      bandage: 0,
      knife: 0,
      bat: 0,
      axe: 0,
      wood: c.items.wood,
      cloth: 0,
      curtains: 0,
      thread: 0,
      needle: 0,
      crowbar: 0,
      machete: 0,
      painkillers: 0,
      denim: 0,
      leather: 0,
      bucket: 0,
      waterBucket: 0,
      waterBottle: 0,
      hatchet: 0,
      pieces: [],
    }; // la madera no se toca: tiene que cuadrar
  }
  expect(cacheEvent.canHappen(w)).toBe(true);
  cacheEvent.happen(w);
  const c = w.containers.find((x) => x.items.food > 0)!;
  expect(c.searched).toBe(false);
  expect(checkInvariants(w)).toEqual([]);
});

test('alijo: sin muebles no sale', () => {
  const { w } = calm(12);
  w.containers = [];
  expect(cacheEvent.canHappen(w)).toBe(false);
});
