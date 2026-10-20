// Trabajo de saqueo: elegir contenedor, reservar, descargar en el almacén.
import { CARRY_CAPACITY_KG, ITEM_WEIGHT_KG } from './balance';
import { isEmpty, ITEM_KINDS, weightOf } from './items';
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

/** Lo más ligero que se puede encontrar (una venda). */
const LIGHTEST_KG = Math.min(...ITEM_KINDS.map((k) => ITEM_WEIGHT_KG[k]));

/**
 * ¿Merece la pena ir? Si nadie lo ha registrado no se sabe qué tiene: vale la pena si cabe al
 * menos lo más ligero. Si ya está registrado, solo si cabe algo de lo que queda. Sin esto, quien
 * va casi lleno volvería una y otra vez a un contenedor del que no puede coger nada.
 */
function canTakeSomething(c: Container, s: Survivor): boolean {
  const room = CARRY_CAPACITY_KG - weightOf(s.carrying) + 1e-9;
  if (!c.searched) return room >= LIGHTEST_KG;
  return ITEM_KINDS.some((k) => c.items[k] > 0 && ITEM_WEIGHT_KG[k] <= room);
}

/** El contenedor disponible y alcanzable más cercano en línea recta. */
function nearestContainer(s: Survivor, w: World): Container | null {
  const sx = Math.floor(s.pos.x);
  const sy = Math.floor(s.pos.y);
  const region = regionOf(w.grid, sx, sy);
  let best: Container | null = null;
  let bestD = Infinity;
  for (const c of w.containers) {
    if (!available(c, s) || !canTakeSomething(c, s)) continue;
    if (regionOf(w.grid, c.pos.x, c.pos.y) !== region) continue;
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
 * El trabajo que toca ahora, o `null` si no hay. Si lleva algo y no queda ningún contenedor
 * del que pueda coger algo (porque no le cabe o no hay), o si ya no tiene permiso, descarga.
 */
export function findWork(s: Survivor, w: World): Action | null {
  const carrying = !isEmpty(s.carrying);
  // Con gripe y descansando (H3c) no saquea, como si no tuviera permiso.
  const loot = s.work.loot && s.sick?.plan !== 'rest';
  if (carrying && !loot) return goUnload(w);
  // Si en el almacén no queda comida y él lleva, lo primero es llevarla para que coman todos.
  if (s.carrying.food > 0 && w.storage.items.food === 0) return goUnload(w);
  if (!loot) return null;
  const c = nearestContainer(s, w);
  if (!c) return carrying ? goUnload(w) : null;
  return { type: 'moveTo', target: c.pos, then: { type: 'search', containerId: c.id } };
}

/** Si el trabajo en curso ya no tiene sentido (desmarcado, sin permiso, reservado), lo deja. */
export function stillWorthIt(s: Survivor, w: World): boolean {
  const id = targetContainerId(s);
  if (id === null || s.action.type === 'search') return true;
  const c = w.containers.find((x) => x.id === id);
  return (
    c !== undefined &&
    s.work.loot &&
    s.sick?.plan !== 'rest' &&
    available(c, s) &&
    canTakeSomething(c, s)
  );
}

/** Libera las reservas de quien ya no va a ese contenedor. */
export function reservationsSystem(w: World): void {
  for (const c of w.containers) {
    if (c.reservedBy === null) continue;
    const s = w.survivors.find((x) => x.id === c.reservedBy);
    if (!s || targetContainerId(s) !== c.id) c.reservedBy = null;
  }
}
