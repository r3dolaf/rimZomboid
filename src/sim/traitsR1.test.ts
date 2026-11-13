// R1: rasgos que cambian lo que hacen (nocturno, mano verde, cocinillas, gourmet y asceta, buen
// tirador y gatillo fácil, duro de pelar y enfermizo, friolero y caluroso).
import { expect, test } from 'vitest';
import {
  CROPS,
  INFECTION_DEATH_HOURS_MAX,
  INFECTION_DEATH_HOURS_MIN,
  RECIPES,
  TICKS_PER_HOUR,
  VARIETY,
} from './balance';
import { brains } from './brain';
import { dayStart } from './clock';
import { ateFood } from './food';
import { markPlot } from './farm';
import { gunHitChance, shootsNow } from './guns';
import { addWound } from './body';
import { craftTicks } from './jobs/craft';
import { tendStep } from './jobs/farm';
import { addMemory, moodModifiers } from './mood';
import { feelsSystem, outdoorTemp } from './season';
import { activitiesSystem } from './systems/activities';
import { addBase, emptyWorld } from './testing/fixtures';
import { INCOMPATIBLE, TRAITS } from './traits';
import type { Survivor, TraitId, World } from './types';
import { createWorld } from './world';

const NEW: readonly TraitId[] = [
  'nightOwl',
  'greenThumb',
  'cook',
  'gourmet',
  'ascetic',
  'sharpshooter',
  'triggerHappy',
  'tough',
  'sickly',
  'chilly',
  'warmBlooded',
];

const at = (hour: number) => dayStart(2) + hour * TICKS_PER_HOUR;
const withTrait = (s: Survivor, t: TraitId) => {
  s.traits = [t];
  return s;
};

test('los once rasgos nuevos se sortean, en parejas que no se dan juntas', () => {
  for (const t of NEW) expect(TRAITS).toContain(t);
  for (const pair of [
    ['gourmet', 'ascetic'],
    ['sharpshooter', 'triggerHappy'],
    ['tough', 'sickly'],
    ['chilly', 'warmBlooded'],
  ])
    expect(INCOMPATIBLE).toContainEqual(pair);
});

test('Nocturno: de día, con algo de sueño, se acuesta; de noche no; y no se levanta hasta que anochece', () => {
  const w = createWorld(3);
  const s = withTrait(w.survivors[0]!, 'nightOwl');
  s.needs.hunger = 100;
  s.needs.thirst = 100;
  s.needs.sleep = 80;
  w.tick = at(14);
  expect(brains.ai.decide(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'sleep' } });
  w.tick = at(23);
  const night = brains.ai.decide(s, w) as { then?: { type: string } } | null;
  expect(night?.then?.type).not.toBe('sleep');
  // Durmiendo de día con el sueño lleno, sigue; al anochecer, se levanta.
  s.needs.sleep = 100;
  s.action = { type: 'sleep', inBed: false };
  w.tick = at(14);
  activitiesSystem(w);
  expect(s.action.type).toBe('sleep');
  w.tick = at(22);
  activitiesSystem(w);
  expect(s.action.type).toBe('idle');
});

test('Mano verde: cada cosecha suya, una hortaliza y una semilla más', () => {
  const crop = (traits: TraitId[]) => {
    const w = addBase(emptyWorld(16, 12), { x: 0, y: 0, w: 5, h: 5 });
    w.seen.fill(1);
    markPlot(w, 8, 6, true, 'potato');
    const p = w.plots[0]!;
    p.crop = { kind: 'potato', grown: CROPS.potato.hours, ripe: 0, dry: 0 };
    const s = w.survivors[0]!;
    s.traits = traits;
    s.skills.farm.level = 0;
    s.pos = { x: 8.5, y: 6.5 };
    w.rng = { ...w.rng };
    const a = { type: 'tend' as const, tile: p.tile, what: 'harvest' as const, ticksLeft: 1 };
    s.action = a;
    tendStep(w, s, a);
    return w.piles[0]!.items;
  };
  const plain = crop([]);
  const green = crop(['greenThumb']);
  expect(green.potato).toBe(plain.potato + 1);
  expect(green.seedsPotato).toBe(plain.seedsPotato + 1);
});

test('Cocinillas: cocina el doble de rápido (solo la cocina) y nunca le sale mal', () => {
  const w = createWorld(2);
  const s = w.survivors[0]!;
  s.skills.craft.level = 5;
  s.traits = [];
  const plain = craftTicks(s, RECIPES.cook);
  const bandages = craftTicks(s, RECIPES.bandages);
  s.traits = ['cook'];
  expect(craftTicks(s, RECIPES.cook)).toBe(Math.round(plain / 2));
  expect(craftTicks(s, RECIPES.bandages)).toBe(bandages);
});

test('Gourmet: comer variado y siempre lo mismo, el doble; Asceta: la comida no le cambia el ánimo', () => {
  const w = createWorld(3);
  const s = w.survivors[0]!;
  const mood = (id: string) => moodModifiers(s, w.tick).find((m) => m.id === id)?.value;
  s.ate = ['food', 'potato', 'stewVeg'];
  withTrait(s, 'gourmet');
  expect(mood('variedDiet')).toBe(2 * VARIETY.mood);
  withTrait(s, 'ascetic');
  expect(mood('variedDiet')).toBeUndefined();
  s.ate = ['food', 'food', 'food', 'food', 'food', 'food'];
  expect(mood('sameFood')).toBeUndefined();
  withTrait(s, 'gourmet');
  expect(mood('sameFood')).toBe(-2 * VARIETY.mood);
  // Comida caliente: al gourmet, la mitad más; al asceta, nada; dormir en el suelo, al asceta, nada.
  s.memories = [];
  ateFood(w, s, 'stewPotato');
  expect(mood('hotMeal')).toBe(12);
  withTrait(s, 'ascetic');
  s.memories = [];
  ateFood(w, s, 'stewPotato');
  addMemory(s, 'sleptOnFloor', w.tick);
  expect(mood('hotMeal')).toBeUndefined();
  expect(mood('sleptOnFloor')).toBeUndefined();
});

test('Buen tirador acierta 15 puntos más; Gatillo fácil, 10 menos y dispara con un zombi que amenaza', () => {
  const w = createWorld(4);
  const s = w.survivors[0]!;
  s.traits = [];
  const base = gunHitChance(s, 'pistol', 2);
  s.traits = ['sharpshooter'];
  expect(gunHitChance(s, 'pistol', 2)).toBeCloseTo(base + 0.15, 9);
  s.traits = ['triggerHappy'];
  expect(gunHitChance(s, 'pistol', 2)).toBeCloseTo(base - 0.1, 9);
  // Un zombi a su lado: el normal no dispara (no está en apuros); el de gatillo fácil, sí.
  w.zombies = [];
  const z = { ...w.survivors[0]!.pos };
  w.zombies.push({
    id: 900,
    pos: { x: z.x + 1, y: z.y },
    path: [],
    health: 60,
    state: 'chase',
    targetId: s.id,
    goal: null,
    lastSeenAt: w.tick,
    cooldown: 0,
    waitUntil: 0,
    hordeId: null,
    worn: [],
    bags: [],
  } as never);
  s.traits = [];
  expect(shootsNow(w, s)).toBe(false);
  s.traits = ['triggerHappy'];
  expect(shootsNow(w, s)).toBe(true);
});

test('Duro de pelar: la infección tarda la mitad más en matarle; Enfermizo, una cuarta parte menos', () => {
  const hours = (t: TraitId[]) => {
    const w = createWorld(5);
    const s = w.survivors[0]!;
    s.traits = t;
    addWound(w, s, 'leftArm', 'bite'); // el mordisco infecta siempre
    return (s.infection!.deathAt - w.tick) / TICKS_PER_HOUR;
  };
  const plain = hours([]);
  expect(plain).toBeGreaterThanOrEqual(INFECTION_DEATH_HOURS_MIN);
  expect(plain).toBeLessThanOrEqual(INFECTION_DEATH_HOURS_MAX);
  expect(hours(['tough'])).toBeCloseTo(plain * 1.5, 5);
  expect(hours(['sickly'])).toBeCloseTo(plain * 0.75, 5);
});

test('Friolero siente 4 grados menos; Caluroso, 4 más', () => {
  const feel = (t: TraitId[]): number => {
    const w: World = addBase(emptyWorld(10, 10), { x: 0, y: 0, w: 3, h: 3 });
    w.tick = dayStart(3) + 12 * TICKS_PER_HOUR;
    const s = w.survivors[0]!;
    s.pos = { x: 8.5, y: 8.5 };
    s.worn = [];
    s.traits = t;
    feelsSystem(w);
    return s.feels! - outdoorTemp(w);
  };
  expect(feel([])).toBeCloseTo(0, 5);
  expect(feel(['chilly'])).toBeCloseTo(-4, 5);
  expect(feel(['warmBlooded'])).toBeCloseTo(4, 5);
});
