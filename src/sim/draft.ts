// Modo combate (spec H4e §3.1): el jugador manda. El colono no huye, no trabaja, no come ni duerme
// por su cuenta; va donde le dicen, ataca al zombi que le marcan y golpea sin moverse al que le
// toque. Sale si cae derribado, si se desploma de sueño o si le toca una crisis.
import { SURVIVOR_REACH } from './balance';
import { crisisDue } from './brain';
import { inCrisis } from './consoling';
import { inBounds, isWalkable } from './map/grid';
import type { Order } from './orders';
import { findPath } from './path/astar';
import type { Action, Point, Survivor, World } from './types';
import { tileOf } from './world';

type DraftOrder = Extract<Order, { type: 'draft' | 'draftMove' | 'draftAttack' }>;

/** ¿Se le puede poner? No derribado ni en crisis (ni yendo a tenerla). */
export function canDraft(s: Survivor): boolean {
  return s.action.type !== 'downed' && !inCrisis(s);
}

/** Corta lo que hacía; si era cosa de dos (pelear, consolar), también al otro. */
function release(w: World, s: Survivor): void {
  const a = s.action;
  if (a.type === 'fight' || a.type === 'console' || a.type === 'consoled') {
    const o = w.survivors.find((x) => x.id === a.otherId);
    if (o && 'otherId' in o.action && o.action.otherId === s.id) {
      // Al que consolaban y estaba en crisis, sigue con ella donde la dejó.
      const left = o.action.type === 'consoled' ? o.action.crisisLeft : undefined;
      o.action = left ? { type: 'crisis', ticksLeft: left } : { type: 'idle', ticksLeft: 0 };
      o.path = [];
    }
  }
  s.action = { type: 'idle', ticksLeft: 0 };
  s.path = [];
}

/** Las `n` casillas que se pisan más cercanas a `p` (búsqueda en anchura desde `p`). */
function spotsAround(w: World, p: Point, n: number): Point[] {
  const out: Point[] = [];
  const seen = new Set<number>();
  const queue: Point[] = [p];
  const key = (q: Point) => q.y * w.grid.width + q.x;
  seen.add(key(p));
  while (queue.length > 0 && out.length < n) {
    const q = queue.shift()!;
    const walkable = isWalkable(w.grid, q.x, q.y);
    if (walkable) out.push(q);
    // Se avanza por lo que se pisa (y, desde el punto pedido, aunque ese no se pise).
    if (!walkable && q !== p) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const r = { x: q.x + dx, y: q.y + dy };
      if (!inBounds(w.grid, r.x, r.y) || seen.has(key(r))) continue;
      seen.add(key(r));
      queue.push(r);
    }
  }
  return out;
}

/** Aplica una orden del modo combate (la llama `ordersSystem`). */
export function applyDraftOrder(w: World, o: DraftOrder): void {
  const ss = o.survivorIds
    .map((id) => w.survivors.find((s) => s.id === id))
    .filter((s): s is Survivor => s !== undefined);
  switch (o.type) {
    case 'draft':
      for (const s of ss) {
        if (o.on === s.drafted || (o.on && !canDraft(s))) continue;
        release(w, s);
        s.drafted = o.on;
      }
      break;
    case 'draftMove': {
      const drafted = ss.filter((s) => s.drafted);
      const spots = spotsAround(w, { x: o.x, y: o.y }, drafted.length);
      drafted.forEach((s, i) => {
        const spot = spots[i];
        const path = spot ? findPath(w.grid, tileOf(s.pos), spot) : null;
        release(w, s);
        if (spot && path) {
          s.action = { type: 'moveTo', target: spot };
          s.path = path;
        }
      });
      break;
    }
    case 'draftAttack':
      if (!w.zombies.some((z) => z.id === o.zombieId)) break;
      for (const s of ss.filter((x) => x.drafted)) {
        release(w, s);
        s.action = { type: 'melee', zombieId: o.zombieId, cooldown: 0 };
      }
      break;
  }
}

/**
 * Lo que hace en modo combate, antes que el cerebro: `undefined` si no está en modo combate (o
 * acaba de salir por una crisis); `null` para seguir con lo que le han mandado.
 */
export function draftDecision(s: Survivor, w: World): Action | null | undefined {
  if (!s.drafted) return undefined;
  if (crisisDue(s, w)) {
    s.drafted = false;
    return undefined;
  }
  if (s.action.type !== 'idle') return null;
  // Quieto: si un zombi le toca, le golpea sin moverse.
  let best = null;
  let bestD = SURVIVOR_REACH * SURVIVOR_REACH;
  for (const z of w.zombies) {
    const d = (z.pos.x - s.pos.x) ** 2 + (z.pos.y - s.pos.y) ** 2;
    if (d <= bestD) {
      best = z;
      bestD = d;
    }
  }
  return best ? { type: 'melee', zombieId: best.id, cooldown: 0, hold: true } : null;
}
