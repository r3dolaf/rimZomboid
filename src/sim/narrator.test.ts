import { expect, test } from 'vitest';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';
import type { GameEvent } from './events/types';
import { checkInvariants } from './invariants';
import { narratorSystem, wellbeing } from './narrator';
import type { EventId, Tone, World } from './types';
import { createWorld } from './world';

test('por defecto, narrador Equilibrado en calma; el primer suceso, al día y medio', () => {
  const w = createWorld(4);
  expect(w.narrator.style).toBe('balanced');
  expect(w.narrator.phase).toBe('calm');
  expect(w.narrator.nextEventAt).toBe(1.5 * TICKS_PER_DAY);
  expect(w.narrator.phaseEndsAt).toBeGreaterThanOrEqual(2 * TICKS_PER_DAY);
  expect(w.narrator.phaseEndsAt).toBeLessThanOrEqual(3 * TICKS_PER_DAY);
  expect(w.narrator.lastAt).toEqual({});
  expect(w.decisions).toEqual([]);
  expect(w.stormUntil).toBe(0);
  for (const s of w.survivors) {
    expect(s.sick).toBeNull();
    expect(s.celebrated).toBe(false);
  }
});

test('el estilo no cambia el resto del mundo (se sortea después de todo), salvo los zombis', () => {
  const a = createWorld(7);
  const b = createWorld(7, 'chaotic');
  expect(b.narrator.style).toBe('chaotic');
  // Los zombis sí dependen del estilo (spec H4b §2.3), con su propio azar.
  const { zombies, zombieRng, nextZombieId } = a;
  expect({ ...b, narrator: a.narrator, zombies, zombieRng, nextZombieId }).toEqual(a);
});

test('invariantes: decisiones de colonos que no existen y gripe sin fin', () => {
  const w = createWorld(3);
  w.decisions.push({ id: 90, kind: 'birthday', survivorIds: [999], expiresAt: 100 });
  expect(checkInvariants(w).length).toBeGreaterThan(0);
  w.decisions = [{ id: 90, kind: 'birthday', survivorIds: [w.survivors[0]!.id], expiresAt: 100 }];
  expect(checkInvariants(w)).toEqual([]);
  w.survivors[1]!.sick = { until: Number.NaN, plan: 'undecided' };
  expect(checkInvariants(w).length).toBeGreaterThan(0);
});

// --- Narrador (tarea 2) ---

/** Mundo base que se clona en los tests que repiten muchas veces (clonar es mucho más rápido). */
const BASE4 = createWorld(4);

/** Suceso de mentira que apunta cuándo sale. */
function fake(
  id: EventId,
  tone: Tone,
  opts: { severity?: 1 | 2 | 3; cooldownDays?: number; can?: () => boolean } = {},
) {
  const fired: number[] = [];
  const ev: GameEvent = {
    id,
    tone,
    severity: opts.severity,
    cooldownDays: opts.cooldownDays ?? 0,
    canHappen: () => opts.can?.() ?? true,
    happen: (w) => void fired.push(w.tick),
  };
  return { ev, fired };
}

/** Pone el bienestar alto (≈ 77) o bajo (0). */
function setMood(w: World, level: 'high' | 'low') {
  for (const s of w.survivors) {
    s.needs.mood = level === 'high' ? 80 : 0;
    for (const o of w.survivors) if (o !== s) s.opinions[o.id] = level === 'high' ? 0 : -100;
  }
  w.storage.items.food = level === 'high' ? 50 : 0;
}

function run(w: World, catalog: GameEvent[], days: number) {
  const end = w.tick + days * TICKS_PER_DAY;
  for (; w.tick < end; w.tick++) narratorSystem(w, catalog);
}

test('bienestar: 0,4·ánimo + 0,3·opinión + 0,3·comida', () => {
  const w = createWorld(4);
  for (const s of w.survivors) {
    s.needs.mood = 50;
    for (const o of w.survivors) if (o !== s) s.opinions[o.id] = 0;
    s.carrying.food = 0;
  }
  w.storage.items.food = 17.5 / 1; // 3 colonos × 70/60 latas al día × 5 días = 17,5
  expect(wellbeing(w)).toBeCloseTo(0.4 * 50 + 0.3 * 50 + 0.3 * 100, 6);
  w.storage.items.food = 0;
  expect(wellbeing(w)).toBeCloseTo(35, 6);
  for (const s of w.survivors) for (const o of w.survivors) if (o !== s) s.opinions[o.id] = 100;
  expect(wellbeing(w)).toBeCloseTo(20 + 30, 6);
});

test('el primer día y medio no hay sucesos; luego sí', () => {
  const w = createWorld(4);
  const good = fake('cache', 'good');
  const mixed = fake('strangers', 'mixed');
  const bad = fake('storm', 'bad');
  for (; w.tick < 1.5 * TICKS_PER_DAY; w.tick++) narratorSystem(w, [good.ev, mixed.ev, bad.ev]);
  expect([...good.fired, ...mixed.fired, ...bad.fired]).toEqual([]);
  narratorSystem(w, [good.ev, mixed.ev, bad.ev]);
  expect(good.fired.length + mixed.fired.length + bad.fired.length).toBe(1);
});

test('Tranquilo: un suceso cada 2–4 días y nunca malo con bienestar < 40', () => {
  const w = createWorld(4, 'calm');
  setMood(w, 'low');
  const evs = [fake('cache', 'good'), fake('strangers', 'mixed'), fake('storm', 'bad')];
  run(
    w,
    evs.map((e) => e.ev),
    40,
  );
  const ticks = evs.flatMap((e) => e.fired).sort((a, b) => a - b);
  expect(evs[2]!.fired).toEqual([]);
  expect(ticks.length).toBeGreaterThan(8);
  for (let i = 1; i < ticks.length; i++) {
    expect(ticks[i]! - ticks[i - 1]!).toBeGreaterThanOrEqual(2 * TICKS_PER_DAY);
    expect(ticks[i]! - ticks[i - 1]!).toBeLessThanOrEqual(4 * TICKS_PER_DAY);
  }
});

test('Caótico: separación de 6 h a 3 días, a veces dos seguidos, y de todos los tonos', () => {
  const w = createWorld(4, 'chaotic');
  setMood(w, 'low');
  const evs = [fake('cache', 'good'), fake('strangers', 'mixed'), fake('storm', 'bad')];
  run(
    w,
    evs.map((e) => e.ev),
    60,
  );
  const ticks = evs.flatMap((e) => e.fired).sort((a, b) => a - b);
  const gaps = ticks.slice(1).map((t, i) => t - ticks[i]!);
  for (const g of gaps) {
    expect(g).toBeGreaterThanOrEqual(TICKS_PER_HOUR);
    expect(g).toBeLessThanOrEqual(3 * TICKS_PER_DAY);
  }
  expect(gaps.some((g) => g === TICKS_PER_HOUR)).toBe(true);
  for (const e of evs) expect(e.fired.length).toBeGreaterThan(0);
});

test('Equilibrado: alterna calma (buenos y mixtos) y tensión (malos), con su ritmo', () => {
  const w = createWorld(4);
  setMood(w, 'high');
  const evs = [fake('cache', 'good'), fake('strangers', 'mixed'), fake('storm', 'bad')];
  const phases: { tick: number; phase: string }[] = [];
  const end = 40 * TICKS_PER_DAY;
  for (; w.tick < end; w.tick++) {
    const before = evs.map((e) => e.fired.length);
    narratorSystem(
      w,
      evs.map((e) => e.ev),
    );
    evs.forEach((e, i) => {
      if (e.fired.length > before[i]!) phases.push({ tick: w.tick, phase: w.narrator.phase });
    });
  }
  for (const p of phases) {
    const tone = evs.find((e) => e.fired.includes(p.tick))!.ev.tone;
    if (p.phase === 'tension') expect(tone).toBe('bad');
    else expect(tone).not.toBe('bad');
  }
  expect(phases.some((p) => p.phase === 'tension')).toBe(true);
  expect(phases.some((p) => p.phase === 'calm')).toBe(true);
  expect(evs[0]!.fired.length).toBeGreaterThan(0);
  expect(evs[1]!.fired.length).toBeGreaterThan(0);
});

test('Equilibrado en calma con bienestar < 35: solo buenos (un respiro)', () => {
  const w = createWorld(4);
  setMood(w, 'low');
  const evs = [fake('cache', 'good'), fake('strangers', 'mixed'), fake('storm', 'bad')];
  w.narrator.phaseEndsAt = 1e9; // siempre en calma
  run(
    w,
    evs.map((e) => e.ev),
    20,
  );
  expect(evs[0]!.fired.length).toBeGreaterThan(3);
  expect(evs[1]!.fired).toEqual([]);
  expect(evs[2]!.fired).toEqual([]);
});

test('con bienestar < 25, la tensión acaba en esa misma hora', () => {
  const w = createWorld(4);
  setMood(w, 'low');
  w.tick = 3 * TICKS_PER_DAY;
  w.narrator.phase = 'tension';
  w.narrator.phaseEndsAt = w.tick + TICKS_PER_DAY;
  w.narrator.nextEventAt = w.tick + 10 * TICKS_PER_DAY;
  for (let i = 0; i < TICKS_PER_HOUR; i++, w.tick++) narratorSystem(w, []);
  expect(w.narrator.phase).toBe('calm');
  expect(w.narrator.phaseEndsAt).toBeGreaterThanOrEqual(
    w.tick + 2 * TICKS_PER_DAY - TICKS_PER_HOUR,
  );
});

test('al cambiar de fase, el siguiente suceso se adelanta al ritmo de la nueva', () => {
  const w = createWorld(4);
  setMood(w, 'high');
  w.tick = 5 * TICKS_PER_DAY;
  w.narrator.phaseEndsAt = w.tick;
  w.narrator.nextEventAt = w.tick + 2 * TICKS_PER_DAY;
  narratorSystem(w, []);
  expect(w.narrator.phase).toBe('tension');
  expect(w.narrator.nextEventAt).toBeLessThanOrEqual(w.tick + TICKS_PER_DAY);
});

test('plan B: si no hay del tono buscado, el más cercano; si no hay ninguno, en 1 h', () => {
  const w = createWorld(4);
  setMood(w, 'high');
  w.tick = 5 * TICKS_PER_DAY;
  w.narrator.phase = 'tension';
  w.narrator.phaseEndsAt = 1e9;
  w.narrator.nextEventAt = w.tick;
  const mixed = fake('strangers', 'mixed');
  const good = fake('cache', 'good');
  narratorSystem(w, [good.ev, mixed.ev]);
  expect(mixed.fired).toEqual([w.tick]); // malo → mixto antes que bueno
  w.narrator.nextEventAt = w.tick;
  narratorSystem(w, []);
  expect(w.narrator.nextEventAt).toBe(w.tick + TICKS_PER_HOUR);
});

test('requisitos y esperas: no sale lo que no se puede dar ni repite antes de tiempo', () => {
  const w = createWorld(4, 'chaotic');
  const never = fake('theft', 'bad', { can: () => false });
  const slow = fake('storm', 'bad', { cooldownDays: 4 });
  const good = fake('cache', 'good');
  const mixed = fake('strangers', 'mixed');
  run(w, [never.ev, slow.ev, good.ev, mixed.ev], 40);
  expect(never.fired).toEqual([]);
  for (let i = 1; i < slow.fired.length; i++)
    expect(slow.fired[i]! - slow.fired[i - 1]!).toBeGreaterThanOrEqual(4 * TICKS_PER_DAY);
  expect(w.narrator.lastAt.storm).toBe(slow.fired.at(-1));
});

test('en tensión, cuanto mejor va la colonia, más duros los sucesos', () => {
  const hard = fake('theft', 'bad', { severity: 3 });
  const soft = fake('storm', 'bad', { severity: 1 });
  const w = structuredClone(BASE4);
  setMood(w, 'high');
  for (let i = 0; i < 600; i++) {
    // Se reutiliza el mundo: solo cambia el azar y se reinicia lo que toca el narrador.
    w.rng = { s: i * 7919 + 1 };
    w.tick = 5 * TICKS_PER_DAY;
    w.narrator = {
      ...w.narrator,
      phase: 'tension',
      phaseEndsAt: 1e9,
      nextEventAt: w.tick,
      lastAt: {},
    };
    narratorSystem(w, [hard.ev, soft.ev]);
  }
  expect(hard.fired.length / soft.fired.length).toBeGreaterThan(2);
});

test('el plan B nunca da un suceso malo cuando está prohibido (Tranquilo < 40 y respiro)', () => {
  for (const style of ['calm', 'balanced'] as const) {
    const w = createWorld(4, style);
    setMood(w, 'low');
    w.tick = 5 * TICKS_PER_DAY;
    w.narrator.phase = 'calm';
    w.narrator.phaseEndsAt = 1e9;
    w.narrator.nextEventAt = w.tick;
    const good = fake('cache', 'good', { can: () => false });
    const bad = fake('storm', 'bad');
    narratorSystem(w, [good.ev, bad.ev]);
    expect(bad.fired).toEqual([]);
    expect(w.narrator.nextEventAt).toBe(w.tick + TICKS_PER_HOUR);
  }
});

test('en tensión con la colonia mal, los sucesos leves pesan más', () => {
  const hard = fake('theft', 'bad', { severity: 3 });
  const soft = fake('storm', 'bad', { severity: 1 });
  const w = structuredClone(BASE4);
  w.survivors.forEach((s) => (s.needs.mood = 30));
  w.storage.items.food = 0;
  expect(wellbeing(w)).toBeLessThan(40);
  expect(wellbeing(w)).toBeGreaterThanOrEqual(25);
  for (let i = 0; i < 600; i++) {
    // Se reutiliza el mundo: solo cambia el azar y se reinicia lo que toca el narrador.
    w.rng = { s: i * 7919 + 1 };
    w.tick = 5 * TICKS_PER_DAY + 7; // fuera de la hora en punto: la tensión no se corta
    w.narrator = {
      ...w.narrator,
      phase: 'tension',
      phaseEndsAt: 1e9,
      nextEventAt: w.tick,
      lastAt: {},
    };
    narratorSystem(w, [hard.ev, soft.ev]);
  }
  expect(soft.fired.length / hard.fired.length).toBeGreaterThan(2);
});
