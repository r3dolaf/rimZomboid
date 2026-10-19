// Trabajo de saqueo: elegir contenedor, reservar, descargar en el almacén.
import { CARRY_CAPACITY_KG, MIN_ITEM_WEIGHT_KG } from './balance';
import { isEmpty, weightOf } from './items';
import { regionOf } from './path/astar';
import { pick } from './rng';
import type { Action, Container, Survivor, World } from './types';

/** Contenedor al que va o que está registrando, o `null`. */
export function targetContainerId(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'search') return a.containerId;
  if (a.type === 'moveTo' && a.then?.type === 'search') return a.then.containerId;
  return null;
}

function available(c: Container, s: Survivor): boolean {
  return (
    c.designated &&
    !(c.searched && isEmpty(c.items)) &&
    (c.reservedBy === null || c.reservedBy === s.id)
  );
}

/** El contenedor disponible y alcanzable más cercano en línea recta. */
function nearestContainer(s: Survivor, w: World): Container | null {
  const sx = Math.floor(s.pos.x);
  const sy = Math.floor(s.pos.y);
  const region = regionOf(w.grid, sx, sy);
  let best: Container | null = null;
  let bestD = Infinity;
  for (const c of w.containers) {
    if (!available(c, s) || regionOf(w.grid, c.pos.x, c.pos.y) !== region) continue;
    const d = (c.pos.x - sx) ** 2 + (c.pos.y - sy) ** 2;
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

function goUnload(w: World): Action {
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'unload' } };
}

/**
 * El trabajo que toca ahora, o `null` si no hay. Descargar va primero si está lleno, si no
 * queda nada que saquear o si ya no tiene permiso (lo que lleva no se pierde).
 */
export function findWork(s: Survivor, w: World): Action | null {
  const carrying = !isEmpty(s.carrying);
  const full = weightOf(s.carrying) > CARRY_CAPACITY_KG - MIN_ITEM_WEIGHT_KG + 1e-9;
  if (carrying && (full || !s.work.loot)) return goUnload(w);
  if (!s.work.loot) return null;
  const c = nearestContainer(s, w);
  if (!c) return carrying ? goUnload(w) : null;
  return { type: 'moveTo', target: c.pos, then: { type: 'search', containerId: c.id } };
}

/** Si el trabajo en curso ya no tiene sentido (desmarcado, sin permiso, reservado), lo deja. */
export function stillWorthIt(s: Survivor, w: World): boolean {
  const id = targetContainerId(s);
  if (id === null || s.action.type === 'search') return true;
  const c = w.containers.find((x) => x.id === id);
  return c !== undefined && s.work.loot && available(c, s);
}

/** Libera las reservas de quien ya no va a ese contenedor. */
export function reservationsSystem(w: World): void {
  for (const c of w.containers) {
    if (c.reservedBy === null) continue;
    const s = w.survivors.find((x) => x.id === c.reservedBy);
    if (!s || targetContainerId(s) !== c.id) c.reservedBy = null;
  }
}
