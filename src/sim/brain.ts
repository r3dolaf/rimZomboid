import { getTile } from './map/grid';
import { pick } from './rng';
import { Tile, type Action, type BrainId, type Point, type Survivor, type World } from './types';

/** Decide la siguiente acción de un superviviente. Intercambiable: IA ahora, jugador en la fase 2. */
export interface Brain {
  decide(s: Survivor, w: World): Action;
}

/** H1: pasea por la base. */
const AiBrain: Brain = {
  decide(_s, w) {
    return { type: 'moveTo', target: pick(w.rng, baseFloor(w)) };
  },
};

function baseFloor(w: World): Point[] {
  const { x, y, w: width, h } = w.base.rect;
  const out: Point[] = [];
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + width; i++)
      if (getTile(w.grid, i, j) === Tile.Floor) out.push({ x: i, y: j });
  return out;
}

export const brains: Record<BrainId, Brain> = { ai: AiBrain };
