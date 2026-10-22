// Trabajos (spec H4a §3): cuál toca por orden de criticidad, si sigue teniendo sentido, y el
// saqueo (elegir contenedor, reservar, descargar en el almacén).
import { HUNGRY_LOOT_DAYS, ITEM_WEIGHT_KG } from './balance';
import { capacityKg } from './skills';
import { foodDays } from './colony';
import { buildJob, buildStillWorth } from './jobs/build';
import { chopJob, chopStillWorth, returnAxeJob } from './jobs/chop';
import { pryJob, pryStillWorth } from './jobs/pry';
import { deliverJob, haulJob, haulStillWorth } from './jobs/haul';
import { swapWeaponStillWorth, weaponJob } from './jobs/weapons';
import { isEmpty, ITEM_KINDS, weightOf } from './items';
import { regionOf } from './path/astar';
import { pick } from './rng';
import type { Action, Container, Survivor, WorkType, World } from './types';

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
  const room = capacityKg(s) - weightOf(s.carrying) + 1e-9;
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

/** ¿Puede hacer ese trabajo? Con gripe y descansando (H3c), ninguno (salvo Social), como si no
 * tuviera permiso. */
function may(s: Survivor, work: WorkType): boolean {
  return s.work[work] && s.sick?.plan !== 'rest';
}

function lootJob(s: Survivor, w: World): Action | null {
  const c = nearestContainer(s, w);
  return c && { type: 'moveTo', target: c.pos, then: { type: 'search', containerId: c.id } };
}

/**
 * El trabajo que toca ahora, o `null` si no hay (spec H4a §3.1), por orden de criticidad.
 * (Consolar, el trabajo Social, lo decide antes el cerebro.)
 */
export function findWork(s: Survivor, w: World): Action | null {
  const loot = may(s, 'loot');
  // Quien lleva cosas termina el viaje: sigue saqueando si puede o descarga.
  if (!isEmpty(s.carrying)) {
    // Si en el almacén no queda comida y él lleva, lo primero es llevarla para que coman todos.
    if (s.carrying.food > 0 && w.storage.items.food === 0) return goUnload(w);
    // La madera que lleva, a un plano que la necesite.
    const deliver = may(s, 'haul') ? deliverJob(s, w) : null;
    if (deliver) return deliver;
    return (loot ? (pryJob(s, w) ?? lootJob(s, w)) : null) ?? goUnload(w);
  }
  const back = returnAxeJob(s, w);
  if (back) return back;
  const arm = weaponJob(s, w);
  if (arm) return arm;
  const hungry = foodDays(w) < HUNGRY_LOOT_DAYS;
  const order: (() => Action | null)[] = [
    () => (hungry && loot ? (pryJob(s, w) ?? lootJob(s, w)) : null),
    () => (may(s, 'build') ? buildJob(s, w) : null),
    () => (may(s, 'haul') ? haulJob(s, w) : null),
    () => (may(s, 'chop') ? chopJob(s, w) : null),
    // Saquear: antes, forzar las puertas atrancadas de las casas marcadas (H4d).
    () => (loot ? (pryJob(s, w) ?? lootJob(s, w)) : null),
  ];
  for (const job of order) {
    const a = job();
    if (a) return a;
  }
  return null;
}

/** Acciones y actividades que son trabajo (para que el cerebro las deje seguir). */
const WORK_ACTIONS: ReadonlySet<string> = new Set([
  'search',
  'unload',
  'chop',
  'takeAxe',
  'storeAxe',
  'pickUp',
  'fetchWood',
  'deliver',
  'build',
  'swapWeapon',
  'takeCrowbar',
  'pry',
]);

/** ¿Está trabajando (o yendo a trabajar)? */
export function isWorking(s: Survivor): boolean {
  const a = s.action;
  return WORK_ACTIONS.has(a.type) || (a.type === 'moveTo' && WORK_ACTIONS.has(a.then?.type ?? ''));
}

/** Si el trabajo en curso ya no tiene sentido (desmarcado, sin permiso, reservado), lo deja. */
export function stillWorthIt(s: Survivor, w: World): boolean {
  const a = s.action;
  const what = a.type === 'moveTo' ? a.then?.type : a.type;
  // Si le mandan descansar, deja lo que esté haciendo (descargar o cambiar de arma, no).
  if (s.sick?.plan === 'rest' && what !== 'unload' && what !== 'storeAxe' && what !== 'swapWeapon')
    return false;
  if (what === 'chop' || what === 'takeAxe' || what === 'storeAxe') return chopStillWorth(s, w);
  if (what === 'pickUp' || what === 'fetchWood' || what === 'deliver') return haulStillWorth(s, w);
  if (what === 'build') return buildStillWorth(s, w);
  if (what === 'swapWeapon') return swapWeaponStillWorth(s, w);
  if (what === 'takeCrowbar' || what === 'pry') return pryStillWorth(s, w);
  const id = targetContainerId(s);
  if (id === null || s.action.type === 'search') return true;
  const c = w.containers.find((x) => x.id === id);
  return c !== undefined && s.work.loot && available(c, s) && canTakeSomething(c, s);
}

/** Libera las reservas de quien ya no va a ese contenedor. */
export function reservationsSystem(w: World): void {
  for (const c of w.containers) {
    if (c.reservedBy === null) continue;
    const s = w.survivors.find((x) => x.id === c.reservedBy);
    if (!s || targetContainerId(s) !== c.id) c.reservedBy = null;
  }
}
