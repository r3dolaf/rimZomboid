// Consolar (H3b §4): un amigo va a consolar a quien está en crisis o al límite.
import { expect, test } from 'vitest';
import { CONSOLE_OPINION_GAIN, CONSOLE_TICKS, TICKS_PER_HOUR } from './balance';
import { brains } from './brain';
import { checkInvariants } from './invariants';
import { addMemory } from './mood';
import { opinionOf } from './social';
import { step } from './step';
import type { Survivor, World } from './types';
import { createWorld, tileOf } from './world';

/** Ana (en crisis) y su amiga; el tercero no la aprecia lo bastante como para consolarla. */
function scene() {
  const w = createWorld(3);
  w.tick = 2 * TICKS_PER_HOUR; // 10:00
  for (const s of w.survivors) {
    s.needs.hunger = 100;
    s.needs.sleep = 100;
    s.needs.mood = 60;
    s.work.loot = false;
    for (const o of w.survivors) if (o !== s) s.opinions[o.id] = 0;
  }
  const [t, c, x] = w.survivors as [Survivor, Survivor, Survivor];
  t.needs.mood = 5;
  t.action = { type: 'crisis', ticksLeft: 1000 };
  c.opinions[t.id] = 50;
  return { w, t, c, x };
}

function runUntil(w: World, cond: () => boolean, max: number): boolean {
  for (let i = 0; i < max; i++) {
    if (cond()) return true;
    step(w);
  }
  return cond();
}

const consoledLog = (w: World) => w.log.filter((e) => e.kind === 'consoled');

test('un amigo cerca consuela a quien está en crisis: la crisis termina', () => {
  const { w, t, c } = scene();
  expect(runUntil(w, () => consoledLog(w).length > 0, TICKS_PER_HOUR)).toBe(true);
  expect(consoledLog(w)[0]).toMatchObject({ survivorId: c.id, otherId: t.id });
  expect(t.action.type).not.toBe('crisis');
  const m = t.memories.find((x) => x.id === 'consoled');
  expect(m?.otherId).toBe(c.id);
  expect(opinionOf(c, t.id)).toBe(50 + CONSOLE_OPINION_GAIN);
  expect(opinionOf(t, c.id)).toBe(CONSOLE_OPINION_GAIN);
  const a = tileOf(c.pos);
  const b = tileOf(t.pos);
  expect((a.x - b.x) ** 2 + (a.y - b.y) ** 2).toBeLessThanOrEqual(4);
  expect(checkInvariants(w)).toEqual([]);
});

test('consolar dura 30 ticks y los dos se quedan juntos mientras', () => {
  const { w, t, c } = scene();
  expect(runUntil(w, () => c.action.type === 'console', TICKS_PER_HOUR)).toBe(true);
  expect(t.action).toEqual({ type: 'consoled', otherId: c.id });
  expect(c.bubble?.kind).toBe('console');
  // El tick en que empieza ya cuenta.
  for (let i = 0; i < CONSOLE_TICKS - 2; i++) step(w);
  expect(c.action.type).toBe('console');
  step(w);
  expect(c.action.type).not.toBe('console');
  expect(t.action.type).not.toBe('consoled');
  expect(consoledLog(w)).toHaveLength(1);
});

test('la pareja consuela mejor: "Consolado por su pareja"', () => {
  const { w, t, c } = scene();
  t.partnerId = c.id;
  c.partnerId = t.id;
  c.opinions[t.id] = 25;
  t.opinions[c.id] = 25;
  expect(runUntil(w, () => consoledLog(w).length > 0, TICKS_PER_HOUR)).toBe(true);
  expect(t.memories.map((m) => m.id)).toContain('consoledByPartner');
  expect(t.memories.map((m) => m.id)).not.toContain('consoled');
});

test('consuela a quien está al límite aunque no esté en crisis', () => {
  const { w, t } = scene();
  t.action = { type: 'idle', ticksLeft: 0 };
  t.needs.mood = 20;
  addMemory(t, 'vented', w.tick); // para que no entre en crisis
  expect(runUntil(w, () => consoledLog(w).length > 0, TICKS_PER_HOUR)).toBe(true);
});

test('no consuela: con poca opinión, al límite él mismo, o si ya está consolado o dormido', () => {
  const cases: ((x: ReturnType<typeof scene>) => void)[] = [
    (x) => (x.c.opinions[x.t.id] = 19),
    (x) => (x.c.needs.mood = 24),
    (x) => addMemory(x.t, 'consoled', x.w.tick, x.x.id),
    (x) => (x.t.action = { type: 'sleep', inBed: false }),
  ];
  for (const setup of cases) {
    const x = scene();
    setup(x);
    const a = brains.ai.decide(x.c, x.w);
    expect(a?.type === 'moveTo' && a.then?.type === 'console').toBe(false);
  }
  const ok = scene();
  const a = brains.ai.decide(ok.c, ok.w);
  expect(a?.type === 'moveTo' && a.then?.type === 'console').toBe(true);
});

test('solo un consolador a la vez', () => {
  const { w, t, c, x } = scene();
  x.opinions[t.id] = 50;
  step(w);
  const going = [c, x].filter(
    (s) =>
      (s.action.type === 'moveTo' && s.action.then?.type === 'console') ||
      s.action.type === 'console',
  );
  expect(going).toHaveLength(1);
});

test('sus urgencias van antes: con hambre, primero come', () => {
  const { w, c } = scene();
  c.needs.hunger = 20;
  const a = brains.ai.decide(c, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'eat').toBe(true);
});

test('si el consolador se desploma a mitad, el otro queda libre y no hay consuelo', () => {
  const { w, t, c } = scene();
  expect(runUntil(w, () => c.action.type === 'console', TICKS_PER_HOUR)).toBe(true);
  c.needs.sleep = 0;
  step(w);
  expect(c.action.type).toBe('sleep');
  expect(t.action.type).not.toBe('consoled');
  expect(consoledLog(w)).toEqual([]);
  expect(checkInvariants(w)).toEqual([]);
});

test('si el otro deja de necesitarlo mientras va, se da la vuelta', () => {
  const { w, t, c } = scene();
  step(w);
  expect(c.action.type === 'moveTo' && c.action.then?.type === 'console').toBe(true);
  t.action = { type: 'idle', ticksLeft: 0 };
  t.needs.mood = 60;
  const a = brains.ai.decide(c, w);
  expect(a).toEqual({ type: 'idle', ticksLeft: 0 });
});

test('tras ser consolado no vuelve a entrar en crisis enseguida', () => {
  const { w, t } = scene();
  t.action = { type: 'idle', ticksLeft: 0 };
  t.needs.mood = 5;
  addMemory(t, 'consoled', w.tick, 2);
  const a = brains.ai.decide(t, w);
  expect(a?.type === 'moveTo' && a.then?.type === 'crisis').toBe(false);
});

test('invariante: consolar y pelear son siempre de dos en dos', () => {
  const { w, t, c } = scene();
  c.action = { type: 'console', otherId: t.id, ticksLeft: 5 };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  t.action = { type: 'consoled', otherId: c.id };
  expect(checkInvariants(w)).toEqual([]);
  t.action = { type: 'fight', otherId: c.id, ticksLeft: 3 };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});
