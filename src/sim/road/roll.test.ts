// H5c3 §1: al entrar en un hexágono, una tirada: según sus horas, el narrador y el respiro; qué toca,
// según el terreno (y si hay un pueblo cerca).
import { expect, test } from 'vitest';
import {
  COLONY_MAX,
  ROAD_EVENT_GAP,
  ROAD_EVENT_PER_HOUR,
  ROAD_STYLE,
  ROAD_TOWN_BONUS,
  ROAD_WEIGHTS,
  TICKS_PER_HOUR,
} from '../balance';
import { neighbors } from '../atlas/hex';
import { hexToward } from '../expeditions';
import { addSurvivor, emptyWorld, travelFor } from '../testing/fixtures';
import type { World } from '../types';
import { roadChance, roadWeights, rollRoad } from './roll';

function onTheRoad(): { w: World; t: ReturnType<typeof travelFor>; hex: number } {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  const ana = w.survivors[0]!;
  w.survivors = [];
  const hex = hexToward(atlas, atlas.base, 3, 6);
  const t = travelFor(w, { kind: 'go', from: atlas.base, to: hex, members: [ana], hoursLeft: 1 });
  w.common.expedition.travels.push(t);
  return { w, t, hex };
}

test('la probabilidad: por las horas del hexágono y el narrador; tras un suceso, unas horas de respiro', () => {
  expect(ROAD_EVENT_PER_HOUR).toBeCloseTo(1 / 14, 9);
  expect(ROAD_STYLE).toEqual({ calm: 0.6, balanced: 1, chaotic: 1.5 });
  const { w, t, hex } = onTheRoad();
  const { atlas } = w.common;
  expect(roadChance(w, t, hex)).toBeCloseTo(1 / 14, 9); // campo: 1 h
  atlas.terrain[hex] = 'forest';
  expect(roadChance(w, t, hex)).toBeCloseTo(1.5 / 14, 9);
  atlas.road[hex] = 1;
  expect(roadChance(w, t, hex)).toBeCloseTo(0.5 / 14, 9);
  w.narrator.style = 'chaotic';
  expect(roadChance(w, t, hex)).toBeCloseTo((0.5 / 14) * 1.5, 9);
  w.narrator.style = 'calm';
  expect(roadChance(w, t, hex)).toBeCloseTo((0.5 / 14) * 0.6, 9);
  t.nextEventAt = w.tick + 1;
  expect(roadChance(w, t, hex)).toBe(0);
});

test('qué toca, según el terreno; junto a un pueblo, más zombis; sin horda ni alguien mientras se espera', () => {
  const { w, t, hex } = onTheRoad();
  const { atlas } = w.common;
  expect(ROAD_WEIGHTS.field).toEqual({ zombies: 3, horde: 1, loot: 2, joiner: 1, forage: 3 });
  expect(roadWeights(w, t, hex)).toEqual(ROAD_WEIGHTS.field);
  atlas.road[hex] = 1;
  expect(roadWeights(w, t, hex)).toEqual(ROAD_WEIGHTS.road);
  atlas.road[hex] = 0;
  atlas.town[neighbors(atlas, hex)[0]!] = 1;
  expect(roadWeights(w, t, hex)).toMatchObject({
    zombies: ROAD_WEIGHTS.field.zombies + ROAD_TOWN_BONUS.zombies,
    horde: ROAD_WEIGHTS.field.horde + ROAD_TOWN_BONUS.horde,
  });
  t.waiting = 99;
  expect(roadWeights(w, t, hex)).toMatchObject({ horde: 0, joiner: 0 });
});

test('con la colonia llena no toca «alguien»', () => {
  const { w, t, hex } = onTheRoad();
  w.survivors = [t.members[0]!]; // (de molde para los demás)
  for (let i = 1; i < COLONY_MAX; i++) addSurvivor(w, { x: 1, y: 1 }, `P${i}`);
  w.survivors.shift(); // 7 en la base y 1 de viaje
  expect(roadWeights(w, t, hex).joiner).toBe(0);
});

test('la tirada: sale más o menos con su probabilidad y deja el respiro', () => {
  const { w, t, hex } = onTheRoad();
  w.common.atlas.terrain[hex] = 'forest';
  const seen: Record<string, number> = {};
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    t.nextEventAt = undefined;
    const k = rollRoad(w, t, hex);
    if (k === null) continue;
    n++;
    seen[k] = (seen[k] ?? 0) + 1;
    expect(t.nextEventAt).toBe(w.tick + ROAD_EVENT_GAP * TICKS_PER_HOUR);
  }
  expect(n / 4000).toBeGreaterThan(0.08); // 1,5/14 ≈ 0,107
  expect(n / 4000).toBeLessThan(0.14);
  expect(seen.zombies!).toBeGreaterThan(seen.horde!); // 5 contra 1
});
