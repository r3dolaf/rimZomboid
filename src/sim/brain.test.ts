import { expect, test } from 'vitest';
import { NO_PATH_RETRY_TICKS } from './balance';
import { brains } from './brain';
import { contains } from './geom';
import { checkInvariants } from './invariants';
import { getTile } from './map/grid';
import { step } from './step';
import { decisionsSystem } from './systems/decisions';
import { encloseTile, emptyWorld } from './testing/fixtures';
import { Tile } from './types';
import { createWorld, tileOf } from './world';

const originalAi = brains.ai;

test('AiBrain siempre elige una casilla Floor dentro de la base', () => {
  const w = createWorld(3);
  for (let i = 0; i < 100; i++) {
    const a = brains.ai.decide(w.survivors[0]!, w);
    expect(a.type).toBe('moveTo');
    if (a.type === 'moveTo') {
      expect(getTile(w.grid, a.target.x, a.target.y)).toBe(Tile.Floor);
      expect(contains(w.base.rect, a.target)).toBe(true);
    }
  }
});

test('idle con ticks pendientes solo descuenta', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  s.action = { type: 'idle', ticksLeft: 3 };
  decisionsSystem(w);
  expect(s.action).toEqual({ type: 'idle', ticksLeft: 2 });
});

test('al decidir moverse calcula el camino', () => {
  const w = createWorld(3);
  decisionsSystem(w);
  for (const s of w.survivors) {
    expect(s.action.type).toBe('moveTo');
    if (s.action.type === 'moveTo' && s.path.length > 0)
      expect(s.path.at(-1)).toEqual(s.action.target);
  }
});

test('sin camino posible espera NO_PATH_RETRY_TICKS', () => {
  const w = emptyWorld(5, 5);
  const s = w.survivors[0]!;
  s.pos = { x: 2.5, y: 2.5 };
  encloseTile(w, { x: 2, y: 2 });
  w.grid.tiles = w.grid.tiles.map((t) => (t === Tile.Grass ? Tile.Floor : t));
  // se fuerza un destino fuera del encierro
  brains.ai = { decide: () => ({ type: 'moveTo', target: { x: 0, y: 0 } }) };
  try {
    decisionsSystem(w);
    expect(s.action).toEqual({ type: 'idle', ticksLeft: NO_PATH_RETRY_TICKS });
  } finally {
    brains.ai = originalAi;
  }
});
test('encerrado durante 100 ticks no rompe nada', () => {
  const w = createWorld(3);
  const s = w.survivors[0]!;
  w.survivors = [s]; // los muros nuevos podrían caer encima de los demás
  const start = { ...s.pos };
  encloseTile(w, tileOf(s.pos));
  for (let i = 0; i < 100; i++) step(w);
  expect(s.pos).toEqual(start);
  expect(checkInvariants(w)).toEqual([]);
});
