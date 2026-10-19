import { NO_PATH_RETRY_TICKS } from '../balance';
import { brains } from '../brain';
import { findPath } from '../path/astar';
import type { World } from '../types';
import { tileOf } from '../world';

/** Cada superviviente consulta a su cerebro; quien se cae de sueño se desploma donde esté. */
export function decisionsSystem(w: World): void {
  for (const s of w.survivors) {
    if (s.needs.sleep <= 0 && s.action.type !== 'sleep') {
      s.action = { type: 'sleep', inBed: false };
      s.path = [];
      continue;
    }
    if (s.action.type === 'idle' && s.action.ticksLeft > 0) s.action.ticksLeft--;

    const action = brains[s.brain].decide(s, w);
    if (action === null) continue;
    if (action.type === 'moveTo') {
      const path = findPath(w.grid, tileOf(s.pos), action.target);
      if (path === null) {
        s.action = { type: 'idle', ticksLeft: NO_PATH_RETRY_TICKS };
        s.path = [];
        continue;
      }
      s.path = path;
    } else {
      s.path = [];
    }
    s.action = action;
  }
}
