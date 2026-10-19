import { NO_PATH_RETRY_TICKS } from '../balance';
import { brains } from '../brain';
import { findPath } from '../path/astar';
import type { World } from '../types';
import { tileOf } from '../world';

/** Los supervivientes sin nada que hacer piden una acción a su cerebro. */
export function decisionsSystem(w: World): void {
  for (const s of w.survivors) {
    if (s.action.type !== 'idle') continue;
    if (s.action.ticksLeft > 0) {
      s.action.ticksLeft--;
      continue;
    }
    const action = brains[s.brain].decide(s, w);
    if (action.type === 'moveTo') {
      const path = findPath(w.grid, tileOf(s.pos), action.target);
      if (path === null) {
        s.action = { type: 'idle', ticksLeft: NO_PATH_RETRY_TICKS };
        continue;
      }
      s.path = path;
    }
    s.action = action;
  }
}
