import { NO_PATH_RETRY_TICKS } from '../balance';
import { brains } from '../brain';
import { logEvent } from '../log';
import { isWalkable } from '../map/grid';
import { findPath } from '../path/astar';
import { walkableNear } from '../piles';
import type { World } from '../types';
import { tileOf } from '../world';

/** Cada superviviente consulta a su cerebro; quien se cae de sueño se desploma donde esté. */
export function decisionsSystem(w: World): void {
  for (const s of w.survivors) {
    if (s.needs.sleep <= 0 && s.action.type !== 'sleep') {
      s.action = { type: 'sleep', inBed: false };
      s.path = [];
      logEvent(w, { kind: 'collapsed', survivorId: s.id });
      continue;
    }
    if (s.action.type === 'idle' && s.action.ticksLeft > 0) {
      s.action.ticksLeft--;
      // Tras no encontrar camino, espera sin volver a decidir (si no, A* correría cada tick).
      if (s.action.wait === 'noPath') continue;
    }

    const action = brains[s.brain].decide(s, w);
    if (action === null) continue;
    if (action.type === 'moveTo') {
      // Si está en una casilla que ya no se pisa, sale por la transitable más cercana.
      const here = tileOf(s.pos);
      const from = isWalkable(w.grid, here.x, here.y) ? here : (walkableNear(w, here) ?? here);
      const rest = findPath(w.grid, from, action.target);
      const path = rest && from !== here ? [from, ...rest] : rest;
      if (path === null) {
        s.action = { type: 'idle', ticksLeft: NO_PATH_RETRY_TICKS, wait: 'noPath' };
        s.path = [];
        continue;
      }
      s.path = path;
      // Reserva el contenedor en cuanto sabe que puede llegar.
      if (action.then?.type === 'search') {
        const id = action.then.containerId;
        const c = w.containers.find((x) => x.id === id);
        if (c) c.reservedBy = s.id;
      }
    } else {
      s.path = [];
    }
    s.action = action;
  }
}
