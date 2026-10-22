// Puertas atrancadas (spec H4d §6): coger la palanca y forzar la puerta de una casa marcada.
import { PRY_TICKS } from '../balance';
import { getTile } from '../map/grid';
import { effectiveDesignated } from '../orders';
import { pick } from '../rng';
import { skillSpeed } from '../skills';
import { Tile, type Action, type Point, type Survivor, type World } from '../types';
import { tileOf } from '../world';
import { atOrBeside, standBeside } from './stand';

/** Puerta (índice de casilla) que va a forzar o está forzando, o `null`. */
export function pryTarget(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'pry') return a.door;
  if (a.type === 'moveTo' && a.then?.type === 'pry') return a.then.door;
  return null;
}

const goingForCrowbar = (s: Survivor) =>
  s.action.type === 'moveTo' && s.action.then?.type === 'takeCrowbar';

/** ¿Lleva una palanca, en la mano o en la carga? */
export const hasCrowbar = (s: Survivor) => s.equipped === 'crowbar' || s.carrying.crowbar > 0;

/** Puertas atrancadas de casas con algo marcado para saquear (índices de casilla). */
export function doorsToPry(w: World): number[] {
  const out: number[] = [];
  for (const h of w.houses) {
    if (getTile(w.grid, h.door.x, h.door.y) !== Tile.LockedDoor) continue;
    if (w.containers.some((c) => c.houseId === h.id && effectiveDesignated(w, c)))
      out.push(h.door.y * w.grid.width + h.door.x);
  }
  return out;
}

/** La puerta que forzar más cercana que nadie más va a forzar, con dónde ponerse, o `null`. */
function doorToPry(s: Survivor, w: World): { door: number; stand: Point } | null {
  const claimed = new Set(w.survivors.filter((o) => o !== s).map(pryTarget));
  const at = tileOf(s.pos);
  let best: { door: number; stand: Point } | null = null;
  let bestD = Infinity;
  for (const door of doorsToPry(w)) {
    if (claimed.has(door)) continue;
    const p = { x: door % w.grid.width, y: Math.floor(door / w.grid.width) };
    const d = (p.x - at.x) ** 2 + (p.y - at.y) ** 2;
    if (d >= bestD) continue;
    const stand = standBeside(w, s, p);
    if (!stand) continue;
    best = { door, stand };
    bestD = d;
  }
  return best;
}

/** Si hay una puerta que forzar: con palanca, a forzarla; sin ella, a por la del almacén. */
export function pryJob(s: Survivor, w: World): Action | null {
  const best = doorToPry(s, w);
  if (!best) return null;
  if (!hasCrowbar(s)) {
    if (s.weaponLocked) return null; // con otra arma fijada, no
    const others = w.survivors.filter((o) => o !== s && goingForCrowbar(o)).length;
    if (w.storage.items.crowbar <= others) return null;
    return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'takeCrowbar' } };
  }
  return { type: 'moveTo', target: best.stand, then: { type: 'pry', door: best.door } };
}

/** ¿Sigue teniendo sentido? */
export function pryStillWorth(s: Survivor, w: World): boolean {
  if (!s.work.loot) return false;
  if (goingForCrowbar(s))
    return !hasCrowbar(s) && w.storage.items.crowbar > 0 && doorsToPry(w).length > 0;
  const door = pryTarget(s);
  return door !== null && hasCrowbar(s) && doorsToPry(w).includes(door);
}

/** Al llegar: coge la palanca (deja en el almacén lo que llevara) o empieza a forzar. */
export function startPryActivity(
  s: Survivor,
  w: World,
  activity: { type: 'takeCrowbar' } | { type: 'pry'; door: number },
): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  if (activity.type === 'takeCrowbar') {
    if (!hasCrowbar(s) && !s.weaponLocked && w.storage.items.crowbar > 0) {
      if (s.equipped) w.storage.items[s.equipped]++;
      w.storage.items.crowbar--;
      s.equipped = 'crowbar';
    }
    return idle;
  }
  const p = { x: activity.door % w.grid.width, y: Math.floor(activity.door / w.grid.width) };
  if (!atOrBeside(s, p) || !hasCrowbar(s) || getTile(w.grid, p.x, p.y) !== Tile.LockedDoor)
    return idle;
  const ticksLeft = Math.round(PRY_TICKS / skillSpeed(s.skills.loot.level));
  return { type: 'pry', door: activity.door, ticksLeft };
}
