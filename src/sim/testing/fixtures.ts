// Ayudas para los tests de la simulación.
import { emptyInventory } from '../items';
import { createGrid, setTile } from '../map/grid';
import { createRng } from '../rng';
import { Tile, type Point, type Survivor, type World } from '../types';

/** Mundo de hierba sin edificios, con un superviviente en el centro de la casilla (0, 0). */
export function emptyWorld(width: number, height: number): World {
  const grid = createGrid(width, height, Tile.Grass);
  const building = { id: 0, rect: { x: 0, y: 0, w: width, h: height }, door: { x: 0, y: 0 } };
  return {
    seed: 1,
    tick: 0,
    rng: createRng(1),
    grid,
    base: building,
    houses: [],
    survivors: [
      {
        id: 1,
        name: 'Ana',
        pos: { x: 0.5, y: 0.5 },
        brain: 'ai',
        action: { type: 'idle', ticksLeft: 0 },
        path: [],
        needs: { hunger: 100, sleep: 100, mood: 50, social: 100 },
        traits: [],
        memories: [],
        bedId: 1,
        carrying: emptyInventory(),
        work: { loot: true },
        opinions: {},
        partnerId: null,
        nextChatAt: 0,
        bubble: null,
        sick: null,
        celebrated: false,
      },
    ],
    beds: [{ id: 1, pos: { x: width - 1, y: 0 }, ownerId: 1 }],
    storage: { tiles: [{ x: 0, y: height - 1 }], items: { ...emptyInventory(), food: 10 } },
    containers: [],
    seen: new Array<number>(width * height).fill(0),
    orders: [],
    log: [],
    nextId: 2,
    stranger: null,
    nextStrangerAt: Number.MAX_SAFE_INTEGER, // sin desconocidos salvo que el test los pida
    narrator: {
      style: 'balanced',
      phase: 'calm',
      phaseEndsAt: Number.MAX_SAFE_INTEGER,
      nextEventAt: Number.MAX_SAFE_INTEGER, // sin sucesos salvo que el test los pida
      lastAt: {},
    },
    decisions: [],
    stormUntil: 0,
  };
}

/** Añade un superviviente (sin cama) en el centro de la casilla `t`. */
export function addSurvivor(w: World, t: Point, name = 'Bea'): Survivor {
  const s: Survivor = {
    ...structuredClone(w.survivors[0]!),
    id: w.nextId++,
    name,
    pos: { x: t.x + 0.5, y: t.y + 0.5 },
    action: { type: 'idle', ticksLeft: 0 },
    path: [],
    needs: { hunger: 100, sleep: 100, mood: 50, social: 100 },
    traits: [],
    memories: [],
    bedId: null,
    carrying: emptyInventory(),
    opinions: {},
    partnerId: null,
    nextChatAt: 0,
    bubble: null,
    sick: null,
    celebrated: false,
  };
  w.survivors.push(s);
  return s;
}

/** Pone muros en las 8 casillas vecinas. */
export function encloseTile(w: World, t: Point): void {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (dx !== 0 || dy !== 0) setTile(w.grid, t.x + dx, t.y + dy, Tile.Wall);
}
