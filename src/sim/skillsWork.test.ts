// H4c §3–4: lo que cambia cada habilidad en el trabajo, y la práctica que da.
import { expect, test } from 'vitest';
import { CHOP_TICKS, SEARCH_TICKS } from './balance';
import { startChopActivity } from './jobs/chop';
import { setTile } from './map/grid';
import { activitiesSystem } from './systems/activities';
import { movementSystem } from './systems/movement';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Action, type World } from './types';

function world(): World {
  const w = emptyWorld(8, 8);
  w.seen.fill(1);
  return w;
}

test('Talar: dura CHOP_TICKS con nivel 5, el doble con 0 y dos tercios con 10; cada tick da práctica', () => {
  const w = world();
  const s = w.survivors[0]!;
  setTile(w.grid, 3, 2, Tile.Tree);
  const tree = 2 * w.grid.width + 3;
  w.chopMarks = [tree];
  s.pos = { x: 2.5, y: 2.5 };
  s.equipped = 'axe';
  const ticks = (level: number) => {
    s.skills.chop.level = level;
    const a = startChopActivity(s, w, { type: 'chop', tree });
    return a.type === 'chop' ? a.ticksLeft : -1;
  };
  expect(ticks(5)).toBe(CHOP_TICKS);
  expect(ticks(0)).toBe(CHOP_TICKS * 2);
  expect(ticks(10)).toBe(Math.round(CHOP_TICKS / 1.5));
  s.skills.chop = { level: 5, xp: 0 };
  s.action = startChopActivity(s, w, { type: 'chop', tree });
  for (let i = 0; i < 40; i++) activitiesSystem(w);
  expect(s.skills.chop.xp).toBe(40);
});

test('Saquear: registrar dura SEARCH_TICKS con nivel 5, el doble con 0; cada tick da práctica', () => {
  const w = world();
  const s = w.survivors[0]!;
  w.containers = [
    {
      id: 1,
      houseId: 0,
      pos: { x: 3, y: 3 },
      kind: 'shelf',
      items: { food: 1, bandage: 0, knife: 0, bat: 0, axe: 0, wood: 0 },
      searched: false,
      designated: true,
      reservedBy: s.id,
    },
  ];
  const start = (level: number) => {
    s.skills.loot = { level, xp: 0 };
    s.path = [];
    s.action = { type: 'moveTo', target: { x: 0, y: 0 }, then: { type: 'search', containerId: 1 } };
    movementSystem(w);
    const a = s.action as Action; // movementSystem la cambia
    return a.type === 'search' ? a.ticksLeft : -1;
  };
  expect(start(5)).toBe(SEARCH_TICKS);
  expect(start(10)).toBe(Math.round(SEARCH_TICKS / 1.5));
  expect(start(0)).toBe(SEARCH_TICKS * 2);
  for (let i = 0; i < 10; i++) activitiesSystem(w);
  expect(s.skills.loot.xp).toBe(10);
});
