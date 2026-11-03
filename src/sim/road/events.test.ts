// H5c3 §2: zombis sueltos, botín abandonado y buscar comida por el camino; y que pasen al entrar en
// un hexágono.
import { expect, test } from 'vitest';
import { ROAD_FIGHT, ROAD_FORAGE, ROAD_LOOT, TICKS_PER_HOUR } from '../balance';
import { has } from '../bags';
import { dayStart } from '../clock';
import { hexToward } from '../expeditions';
import { stepGame } from '../game';
import { checkInvariants } from '../invariants';
import { createRng } from '../rng';
import { addSurvivor, emptyWorld, travelFor } from '../testing/fixtures';
import type { Survivor, World } from '../types';
import { fightRisk, roadForage, roadLoot, roadZombies } from './events';

/** Ana (y Bea, si se pide) de viaje hacia el este; el hexágono siguiente es `hex`. */
function onTheRoad(two = false) {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  const ana = w.survivors[0]!;
  const bea = two ? addSurvivor(w, { x: 1, y: 1 }, 'Bea') : null;
  const members = bea ? [ana, bea] : [ana];
  w.survivors = [];
  const to = hexToward(atlas, atlas.base, 3, 6);
  const t = travelFor(w, { kind: 'go', from: atlas.base, to, members, hoursLeft: 1 });
  w.common.expedition.travels.push(t);
  for (const s of members) {
    s.wounds = [];
    s.equipped = null;
    s.skills.fight.level = 0;
  }
  return { w, t, ana, bea, hex: t.path[t.at]! };
}

test('el riesgo de pelear: más con más zombis por persona; menos con habilidad y con arma', () => {
  const { ana } = onTheRoad();
  expect(fightRisk(ana, 4, 2)).toBeCloseTo(ROAD_FIGHT.base * 2, 9);
  ana.skills.fight.level = 5;
  ana.equipped = 'machete';
  expect(fightRisk(ana, 4, 2)).toBeCloseTo(
    ROAD_FIGHT.base * 2 - 5 * ROAD_FIGHT.perLevel - ROAD_FIGHT.armed,
    9,
  );
  expect(fightRisk(ana, 100, 1)).toBe(ROAD_FIGHT.max);
  ana.skills.fight.level = 10;
  expect(fightRisk(ana, 1, 4)).toBe(ROAD_FIGHT.min);
});

test('zombis sueltos: unos salen heridos (arañazos y algún mordisco), todos practican y se cuenta', () => {
  let hurt = 0;
  let bites = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { w, ana, hex } = onTheRoad();
    w.common.expedition.rng = createRng(seed);
    const xp = ana.skills.fight.xp;
    roadZombies(w, w.common.expedition.travels[0]!, hex, 5); // riesgo máximo
    expect(ana.skills.fight.xp + ana.skills.fight.level * 1000).toBeGreaterThan(xp);
    const e = w.common.log.find((x) => x.kind === 'roadZombies')!;
    expect(e).toMatchObject({ names: ['Ana'], zombies: 5, ground: 'field' });
    if (ana.wounds.length > 0) {
      hurt++;
      if (ana.wounds[0]!.kind === 'bite') bites++;
      expect(e.kind === 'roadZombies' && e.hurt).toEqual([
        { name: 'Ana', wound: ana.wounds[0]!.kind },
      ]);
    }
  }
  expect(hurt / 200).toBeGreaterThan(ROAD_FIGHT.max - 0.1);
  expect(bites / hurt).toBeGreaterThan(ROAD_FIGHT.bite - 0.12);
  expect(bites / hurt).toBeLessThan(ROAD_FIGHT.bite + 0.12);
});

test('botín abandonado: un coche en la carretera, una casa fuera; se lo lleva quien tenga sitio', () => {
  const { w, t, ana, bea, hex } = onTheRoad(true);
  w.common.atlas.road[hex] = 1;
  const before = (s: Survivor) => ROAD_LOOT.kinds.reduce((n, [k]) => n + has(s, k), 0);
  const n0 = before(ana) + before(bea!);
  roadLoot(w, t, hex);
  const e = w.common.log.find((x) => x.kind === 'roadLoot')!;
  expect(e).toMatchObject({ names: ['Ana', 'Bea'], car: true });
  const got = e.kind === 'roadLoot' ? Object.values(e.items).reduce((a, b) => a + b, 0) : 0;
  expect(got).toBeGreaterThanOrEqual(ROAD_LOOT.count[0]);
  expect(got).toBeLessThanOrEqual(ROAD_LOOT.count[1]);
  expect(before(ana) + before(bea!) - n0).toBe(got);
  expect(checkInvariants(w)).toEqual([]);
});

test('botín sin sitio para llevarlo: se queda (y lo dice)', () => {
  const { w, t, ana, hex } = onTheRoad();
  ana.carrying.wood = 999; // las manos llenas
  ana.bags = { waist: null, back: null, hand: null };
  roadLoot(w, t, hex);
  const e = w.common.log.find((x) => x.kind === 'roadLoot')!;
  expect(e).toMatchObject({ car: false, items: {}, left: true });
});

test('buscar comida: 1 o 2 latas para quien más hambre tenga y sitio', () => {
  const { w, t, ana, bea, hex } = onTheRoad(true);
  ana.needs.hunger = 80;
  bea!.needs.hunger = 40;
  ana.carrying.food = 0;
  bea!.carrying.food = 0;
  roadForage(w, t, hex);
  const e = w.common.log.find((x) => x.kind === 'roadForage')!;
  const food = e.kind === 'roadForage' ? e.food : 0;
  expect(food).toBeGreaterThanOrEqual(ROAD_FORAGE[0]);
  expect(food).toBeLessThanOrEqual(ROAD_FORAGE[1]);
  expect(has(bea!, 'food')).toBe(food);
  expect(has(ana, 'food')).toBe(0);
});

test('al entrar en los hexágonos del camino pasan cosas (y nunca se rompe nada)', () => {
  let events = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const w: World = emptyWorld(10, 10);
    const { atlas } = w.common;
    const ana = w.survivors[0]!;
    w.survivors = [];
    w.narrator.nextEventAt = 1e9;
    w.common.expedition.rng = createRng(seed);
    const to = hexToward(atlas, atlas.base, 3, 12);
    const t = travelFor(w, { kind: 'go', from: atlas.base, to, members: [ana], hoursLeft: 1 });
    t.at = 0;
    w.common.expedition.travels.push(t);
    w.tick = dayStart(1) + 7 * TICKS_PER_HOUR;
    for (let i = 0; i < 10 * TICKS_PER_HOUR; i++) stepGame(w);
    events += w.common.log.filter((e) => e.kind.startsWith('road')).length;
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(events).toBeGreaterThan(5); // ~30 × 10 h / 14 ≈ 20 (menos los de decisión, que aún no)
});
