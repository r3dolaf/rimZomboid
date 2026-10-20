import { expect, test } from 'vitest';
import { CHAT_EVERY_MAX, CHAT_EVERY_MIN, CHAT_RETRY_TICKS, TICKS_PER_DAY } from '../balance';
import { setTile } from '../map/grid';
import { moodModifiers } from '../mood';
import { chatWeights, opinionOf } from '../social';
import { addSurvivor, emptyWorld } from '../testing/fixtures';
import { Tile } from '../types';
import { needsSystem } from './needs';
import { applyChat, socialSystem } from './social';

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
  // agradable 60 − 30 = 30; discusión 10 + 10 = 20
  expect(chatWeights(a, b)).toEqual({ pleasant: 30, neutral: 30, argue: 20, insult: 0 });
});

test('con alguien al límite hay más discusiones e insultos (si cabe insultar)', () => {
  const { a, b } = pair();
  b.needs.mood = 20;
  // El que inicia está bien y no tiene mala opinión: no insulta.
  expect(chatWeights(a, b)).toEqual({ pleasant: 60, neutral: 30, argue: 25, insult: 0 });
  a.opinions[b.id] = -10;
  expect(chatWeights(a, b)).toEqual({ pleasant: 57, neutral: 30, argue: 26, insult: 10 });
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

test('cada día la opinión se acerca a 0 un 10 % y al menos 1 punto', () => {
  const { w, a, b } = pair();
  b.nextChatAt = a.nextChatAt = 1e9;
  a.opinions[b.id] = 10;
  b.opinions[a.id] = -3;
  a.opinions[99] = 0;
  a.opinions[98] = -60;
  a.opinions[97] = 0.5;
  w.tick = TICKS_PER_DAY - 1;
  socialSystem(w);
  expect(opinionOf(a, b.id)).toBe(10);
  w.tick = TICKS_PER_DAY;
  socialSystem(w);
  expect(opinionOf(a, b.id)).toBe(9);
  expect(opinionOf(b, a.id)).toBe(-2);
  expect(opinionOf(a, 99)).toBe(0);
  expect(opinionOf(a, 98)).toBe(-54);
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
