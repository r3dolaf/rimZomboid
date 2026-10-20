import { expect, test } from 'vitest';
import { CHAT_EVERY_MAX, CHAT_EVERY_MIN, CHAT_RETRY_TICKS, TICKS_PER_DAY } from '../balance';
import { brains } from '../brain';
import { checkInvariants } from '../invariants';
import { emptyInventory } from '../items';
import { setTile } from '../map/grid';
import { moodModifiers } from '../mood';
import { chatWeights, opinionOf } from '../social';
import { addSurvivor, emptyWorld } from '../testing/fixtures';
import { Tile } from '../types';
import { reservationsSystem } from '../work';
import { activitiesSystem } from './activities';
import { needsSystem } from './needs';
import { applyChat, socialSystem, startFight } from './social';

/** Ana en (0, 0) y Bea a `dx` casillas a la derecha, en un mapa de hierba. */
function pair(dx = 2) {
  const w = emptyWorld(20, 20);
  const a = w.survivors[0]!;
  const b = addSurvivor(w, { x: dx, y: 0 });
  a.needs.social = 50;
  b.needs.social = 50;
  b.nextChatAt = 10_000; // solo inicia Ana
  return { w, a, b };
}

test('pesos base: agradable 60, neutra 30, discusión 10, insulto 0', () => {
  const { a, b } = pair();
  expect(chatWeights(a, b)).toEqual({ pleasant: 60, neutral: 30, argue: 10, insult: 0 });
});

test('la opinión sube lo agradable y baja la discusión', () => {
  const { a, b } = pair();
  a.opinions[b.id] = 50;
  expect(chatWeights(a, b)).toEqual({ pleasant: 75, neutral: 30, argue: 5, insult: 0 });
  a.opinions[b.id] = -100;
  // agradable 60 − 30 = 30; discusión 10 + 10 = 20; insulto 0 + 10 (le cae mal)
  expect(chatWeights(a, b)).toEqual({ pleasant: 30, neutral: 30, argue: 20, insult: 10 });
});

test('con alguien al límite hay más discusiones e insultos (si cabe insultar)', () => {
  const { a, b } = pair();
  b.needs.mood = 20;
  // El que inicia está bien y no tiene mala opinión: no insulta.
  expect(chatWeights(a, b)).toEqual({ pleasant: 60, neutral: 30, argue: 25, insult: 0 });
  a.opinions[b.id] = -10;
  expect(chatWeights(a, b)).toEqual({ pleasant: 57, neutral: 30, argue: 26, insult: 11 });
  a.opinions[b.id] = 0;
  a.needs.mood = 20;
  expect(chatWeights(a, b).insult).toBe(10);
});

test('Optimista: +15 agradable; Pesimista: −10 agradable y +10 discusión; nunca negativos', () => {
  const { a, b } = pair();
  a.traits = ['optimist'];
  expect(chatWeights(a, b).pleasant).toBe(75);
  a.traits = ['pessimist'];
  expect(chatWeights(a, b)).toEqual({ pleasant: 50, neutral: 30, argue: 20, insult: 0 });
  a.traits = [];
  a.opinions[b.id] = -100;
  a.needs.mood = 0;
  const wts = chatWeights(a, b);
  for (const v of Object.values(wts)) expect(v).toBeGreaterThanOrEqual(0);
  a.opinions[b.id] = 100;
  a.needs.mood = 50;
  expect(chatWeights(a, b).argue).toBe(0);
});

test('efectos de cada charla en la opinión, la necesidad social y los recuerdos', () => {
  const cases = [
    { kind: 'pleasant', opinion: 2, social: 15, a: ['goodChat'], b: ['goodChat'] },
    { kind: 'neutral', opinion: 1, social: 8, a: [], b: [] },
    { kind: 'argue', opinion: -4, social: 3, a: ['argued'], b: ['argued'] },
    { kind: 'insult', opinion: -8, social: 3, a: [], b: ['insulted'] },
  ] as const;
  for (const c of cases) {
    const { w, a, b } = pair();
    applyChat(w, a, b, c.kind);
    expect(opinionOf(a, b.id)).toBe(c.opinion);
    expect(opinionOf(b, a.id)).toBe(c.opinion);
    expect(a.needs.social).toBe(50 + c.social);
    expect(b.needs.social).toBe(50 + c.social);
    expect(a.memories.map((m) => m.id)).toEqual(c.a);
    expect(b.memories.map((m) => m.id)).toEqual(c.b);
    for (const m of b.memories) expect(m.otherId).toBe(a.id);
    const bubble = c.kind === 'argue' || c.kind === 'insult' ? 'argue' : 'chat';
    expect(a.bubble).toEqual({ kind: bubble, until: w.tick + 30 });
    expect(b.bubble).toEqual({ kind: bubble, until: w.tick + 30 });
  }
});

test('el insulto queda en el registro; la charla normal no', () => {
  const { w, a, b } = pair();
  applyChat(w, a, b, 'pleasant');
  applyChat(w, a, b, 'argue');
  expect(w.log).toEqual([]);
  applyChat(w, a, b, 'insult');
  expect(w.log).toEqual([{ tick: 0, kind: 'insult', survivorId: a.id, otherId: b.id }]);
});

test('la necesidad social no pasa de 100', () => {
  const { w, a, b } = pair();
  a.needs.social = 95;
  applyChat(w, a, b, 'pleasant');
  expect(a.needs.social).toBe(100);
});

test('al llegar su momento charla con el más cercano y los dos fijan el siguiente intento', () => {
  const { w, a, b } = pair(3);
  const c = addSurvivor(w, { x: 6, y: 0 }, 'Carla');
  c.nextChatAt = 10_000;
  w.tick = 100;
  socialSystem(w);
  expect(a.needs.social).toBeGreaterThan(50);
  expect(b.needs.social).toBeGreaterThan(50);
  expect(c.needs.social).toBe(100);
  for (const s of [a, b]) {
    expect(s.nextChatAt).toBeGreaterThanOrEqual(100 + CHAT_EVERY_MIN);
    expect(s.nextChatAt).toBeLessThanOrEqual(100 + CHAT_EVERY_MAX);
    expect(s.bubble).not.toBeNull();
  }
});

test('sin nadie a 6 casillas o a la vista, lo reintenta a los 30 ticks', () => {
  const far = pair(7);
  far.w.tick = 50;
  socialSystem(far.w);
  expect(far.a.nextChatAt).toBe(50 + CHAT_RETRY_TICKS);
  expect(far.a.needs.social).toBe(50);

  const walled = pair(4);
  for (let y = 0; y < 20; y++) setTile(walled.w.grid, 2, y, Tile.Wall);
  socialSystem(walled.w);
  expect(walled.a.nextChatAt).toBe(CHAT_RETRY_TICKS);
  expect(walled.b.needs.social).toBe(50);
});

test('no charla quien duerme, está en crisis o habla con quien duerme', () => {
  const check = (setup: (x: ReturnType<typeof pair>) => void) => {
    const x = pair();
    setup(x);
    socialSystem(x.w);
    return x.a.needs.social === 50 && x.b.needs.social === 50;
  };
  expect(check((x) => (x.a.action = { type: 'sleep', inBed: false }))).toBe(true);
  expect(check((x) => (x.b.action = { type: 'sleep', inBed: false }))).toBe(true);
  expect(check((x) => (x.b.action = { type: 'crisis', ticksLeft: 50 }))).toBe(true);
  expect(
    check(
      (x) => (x.a.action = { type: 'moveTo', target: { x: 5, y: 5 }, then: { type: 'crisis' } }),
    ),
  ).toBe(true);
  expect(check(() => {})).toBe(false);
});

test('en una charla buena comparte una lata con quien tiene hambre', () => {
  const { w, a, b } = pair();
  a.carrying.food = 2;
  b.needs.hunger = 30;
  applyChat(w, a, b, 'neutral');
  expect(a.carrying.food).toBe(1);
  expect(b.carrying.food).toBe(1);
  expect(opinionOf(a, b.id)).toBe(1 + 5);
  expect(opinionOf(b, a.id)).toBe(1 + 5);
  expect(b.memories).toEqual([{ id: 'sharedFood', expiresAt: 12 * 300, otherId: a.id }]);
  expect(a.bubble?.kind).toBe('share');
  expect(w.log).toEqual([{ tick: 0, kind: 'sharedFood', survivorId: a.id, otherId: b.id }]);
});

test('no comparte si no lleva, si el otro no tiene hambre, si le cae mal, si discuten o si no le cabe', () => {
  const tries: ((x: ReturnType<typeof pair>) => void)[] = [
    (x) => (x.a.carrying.food = 0),
    (x) => (x.b.needs.hunger = 35),
    (x) => (x.a.opinions[x.b.id] = -5),
  ];
  for (const t of tries) {
    const x = pair();
    x.a.carrying.food = 1;
    x.b.needs.hunger = 30;
    t(x);
    applyChat(x.w, x.a, x.b, 'pleasant');
    expect(x.b.carrying.food).toBe(0);
  }
  const full = pair();
  full.a.carrying.food = 1;
  full.b.needs.hunger = 30;
  full.b.carrying.bat = 5;
  full.b.carrying.knife = 1; // 8 kg: lleno
  applyChat(full.w, full.a, full.b, 'pleasant');
  expect(full.b.carrying.food).toBe(0);
  const argue = pair();
  argue.a.carrying.food = 1;
  argue.b.needs.hunger = 30;
  applyChat(argue.w, argue.a, argue.b, 'argue');
  expect(argue.b.carrying.food).toBe(0);
});

test('la necesidad social baja 50 al día y por debajo de 20 da "Solo" −10', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    needsSystem(w);
    w.tick++;
  }
  expect(s.needs.social).toBeCloseTo(50, 5);
  expect(moodModifiers(s, w.tick).some((m) => m.id === 'lonely')).toBe(false);
  s.needs.social = 19;
  expect(moodModifiers(s, w.tick)).toContainEqual({ id: 'lonely', value: -10 });
});

test('cada día la opinión se acerca a 0 un 10 % (lo malo, un 3 %) y al menos 1 punto', () => {
  const { w, a, b } = pair();
  b.nextChatAt = a.nextChatAt = 1e9;
  a.opinions[b.id] = 10;
  b.opinions[a.id] = -3;
  a.opinions[99] = 0;
  a.opinions[98] = -60;
  a.opinions[96] = 60;
  a.opinions[97] = 0.5;
  w.tick = TICKS_PER_DAY - 1;
  socialSystem(w);
  expect(opinionOf(a, b.id)).toBe(10);
  w.tick = TICKS_PER_DAY;
  socialSystem(w);
  expect(opinionOf(a, b.id)).toBe(9);
  expect(opinionOf(b, a.id)).toBe(-2);
  expect(opinionOf(a, 99)).toBe(0);
  expect(opinionOf(a, 98)).toBeCloseTo(-58.2, 9);
  expect(opinionOf(a, 96)).toBe(54);
  expect(opinionOf(a, 97)).toBe(0);
});

test('los globos caducan', () => {
  const { w, a } = pair();
  a.nextChatAt = 1e9;
  a.bubble = { kind: 'chat', until: 5 };
  w.tick = 5;
  socialSystem(w);
  expect(a.bubble).toBeNull();
});

/** Rivales y alguien al límite: el insulto puede acabar en pelea. */
function rivals() {
  const x = pair();
  x.a.opinions[x.b.id] = -40;
  x.b.needs.mood = 20;
  return x;
}

test('tras un insulto entre rivales con alguien al límite, un 30 % acaba en pelea', () => {
  let fights = 0;
  for (let i = 0; i < 1000; i++) {
    const { w, a, b } = rivals();
    w.rng = { s: i * 7919 };
    applyChat(w, a, b, 'insult');
    if (a.action.type === 'fight') fights++;
  }
  expect(fights).toBeGreaterThan(250);
  expect(fights).toBeLessThan(350);
});

test('sin rivalidad o sin nadie al límite, el insulto no acaba en pelea', () => {
  for (let i = 0; i < 200; i++) {
    const calm = rivals();
    calm.w.rng = { s: i };
    calm.b.needs.mood = 25;
    applyChat(calm.w, calm.a, calm.b, 'insult');
    expect(calm.a.action.type).toBe('idle');
    const mild = rivals();
    mild.w.rng = { s: i };
    mild.a.opinions[mild.b.id] = -31; // −31 − 8 del insulto = −39
    applyChat(mild.w, mild.a, mild.b, 'insult');
    expect(mild.a.action.type).toBe('idle');
  }
});

test('la pelea: 30 ticks los dos, −15 de opinión, "Se peleó" y al registro', () => {
  const { w, a, b } = pair();
  a.action = { type: 'moveTo', target: { x: 9, y: 9 } };
  a.path = [{ x: 1, y: 1 }];
  startFight(w, a, b);
  expect(a.action).toEqual({ type: 'fight', otherId: b.id, ticksLeft: 30 });
  expect(b.action).toEqual({ type: 'fight', otherId: a.id, ticksLeft: 30 });
  expect(a.path).toEqual([]);
  expect(opinionOf(a, b.id)).toBe(-15);
  expect(opinionOf(b, a.id)).toBe(-15);
  expect(a.memories).toEqual([{ id: 'fought', expiresAt: 24 * 300, otherId: b.id }]);
  expect(b.memories).toEqual([{ id: 'fought', expiresAt: 24 * 300, otherId: a.id }]);
  expect(a.bubble?.kind).toBe('fight');
  expect(w.log).toEqual([{ tick: 0, kind: 'fight', survivorId: a.id, otherId: b.id }]);
  for (let i = 0; i < 29; i++) activitiesSystem(w);
  expect(a.action.type).toBe('fight');
  activitiesSystem(w);
  expect(a.action.type).toBe('idle');
  expect(b.action.type).toBe('idle');
});

test('mientras pelea el cerebro no le cambia de acción ni charla', () => {
  const { w, a, b } = pair();
  startFight(w, a, b);
  a.needs.hunger = 20;
  expect(brains.ai.decide(a, w)).toBeNull();
  a.nextChatAt = 0;
  const social = a.needs.social;
  socialSystem(w);
  expect(a.needs.social).toBe(social);
});

test('si el otro deja de pelear (se desploma), él también para', () => {
  const { w, a, b } = pair();
  startFight(w, a, b);
  b.action = { type: 'sleep', inBed: false };
  activitiesSystem(w);
  expect(a.action.type).toBe('idle');
});

test('la pelea corta el registro de un contenedor y libera la reserva', () => {
  const { w, a, b } = pair();
  w.containers.push({
    id: 50,
    houseId: 1,
    pos: { x: 5, y: 5 },
    kind: 'shelf',
    items: { ...emptyInventory(), food: 2 },
    searched: false,
    designated: true,
    reservedBy: a.id,
  });
  a.action = { type: 'search', containerId: 50, ticksLeft: 10 };
  startFight(w, a, b);
  reservationsSystem(w);
  expect(w.containers[0]!.reservedBy).toBeNull();
  expect(checkInvariants(w)).toEqual([]);
});

/** Dos que se aprecian mucho y no tienen pareja. */
function lovers() {
  const x = pair();
  x.a.opinions[x.b.id] = 60;
  x.b.opinions[x.a.id] = 60;
  return x;
}

test('tras una charla agradable entre dos que se tienen ≥ 60, un 10 % se hacen pareja', () => {
  let couples = 0;
  for (let i = 0; i < 2000; i++) {
    const { w, a, b } = lovers();
    w.rng = { s: i * 104729 };
    applyChat(w, a, b, 'pleasant');
    if (a.partnerId === b.id) {
      couples++;
      expect(b.partnerId).toBe(a.id);
      expect(a.bubble?.kind).toBe('love');
      expect(w.log).toEqual([{ tick: 0, kind: 'couple', survivorId: a.id, otherId: b.id }]);
      expect(checkInvariants(w)).toEqual([]);
    }
  }
  expect(couples).toBeGreaterThan(150);
  expect(couples).toBeLessThan(250);
});

test('no se hacen pareja si alguno ya tiene, si no llegan a 60 o si la charla no es agradable', () => {
  for (let i = 0; i < 300; i++) {
    const taken = lovers();
    taken.w.rng = { s: i };
    const c = addSurvivor(taken.w, { x: 9, y: 9 }, 'Carla');
    taken.b.partnerId = c.id;
    c.partnerId = taken.b.id;
    applyChat(taken.w, taken.a, taken.b, 'pleasant');
    expect(taken.a.partnerId).toBeNull();

    const low = lovers();
    low.w.rng = { s: i };
    low.b.opinions[low.a.id] = 57; // + 2 = 59
    applyChat(low.w, low.a, low.b, 'pleasant');
    expect(low.a.partnerId).toBeNull();

    const neutral = lovers();
    neutral.w.rng = { s: i };
    applyChat(neutral.w, neutral.a, neutral.b, 'neutral');
    expect(neutral.a.partnerId).toBeNull();
  }
});

test('rompen si la opinión de alguno baja de 20: "Ruptura" y −20 de opinión', () => {
  const { w, a, b } = pair();
  a.nextChatAt = 1e9;
  a.partnerId = b.id;
  b.partnerId = a.id;
  a.opinions[b.id] = 50;
  b.opinions[a.id] = 20;
  socialSystem(w);
  expect(a.partnerId).toBe(b.id);
  b.opinions[a.id] = 19;
  socialSystem(w);
  expect(a.partnerId).toBeNull();
  expect(b.partnerId).toBeNull();
  expect(opinionOf(a, b.id)).toBe(30);
  expect(opinionOf(b, a.id)).toBe(-1);
  expect(a.memories).toEqual([{ id: 'breakup', expiresAt: 72 * 300, otherId: b.id }]);
  expect(b.memories).toEqual([{ id: 'breakup', expiresAt: 72 * 300, otherId: a.id }]);
  expect(w.log).toEqual([{ tick: 0, kind: 'breakup', survivorId: a.id, otherId: b.id }]);
  expect(checkInvariants(w)).toEqual([]);
});

test('al despertar con su pareja aún dormida, los dos ganan "Durmió con su pareja"', () => {
  const { w, a, b } = pair();
  a.partnerId = b.id;
  b.partnerId = a.id;
  w.tick = 3 * 300; // 11:00, de día
  a.action = { type: 'sleep', inBed: false };
  b.action = { type: 'sleep', inBed: false };
  a.needs.sleep = 100;
  b.needs.sleep = 50;
  activitiesSystem(w);
  expect(a.action.type).toBe('idle');
  const ids = (s: typeof a) => s.memories.map((m) => m.id);
  expect(ids(a)).toContain('sleptWithPartner');
  expect(ids(b)).toEqual(['sleptWithPartner']);
  expect(b.memories[0]!.otherId).toBe(a.id);
});

test('sin pareja o con la pareja despierta, no hay "Durmió con su pareja"', () => {
  const { w, a, b } = pair();
  w.tick = 3 * 300;
  a.action = { type: 'sleep', inBed: false };
  b.action = { type: 'sleep', inBed: false };
  a.needs.sleep = 100;
  b.needs.sleep = 50;
  activitiesSystem(w);
  expect(a.memories.map((m) => m.id)).toEqual(['sleptOnFloor']);
});
