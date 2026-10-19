// Ayudas para los tests de la simulación.
import { emptyInventory } from '../items';
import { createGrid, setTile } from '../map/grid';
import { createRng } from '../rng';
import { Tile, type Point, type World } from '../types';

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
        needs: { hunger: 100, sleep: 100, mood: 50 },
        traits: [],
        memories: [],
        bedId: 1,
        carrying: emptyInventory(),
      },
    ],
    beds: [{ id: 1, pos: { x: width - 1, y: 0 }, ownerId: 1 }],
    storage: { tiles: [{ x: 0, y: height - 1 }], items: { ...emptyInventory(), food: 10 } },
    containers: [],
    nextId: 2,
  };
}

/** Pone muros en las 8 casillas vecinas. */
export function encloseTile(w: World, t: Point): void {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (dx !== 0 || dy !== 0) setTile(w.grid, t.x + dx, t.y + dy, Tile.Wall);
}
