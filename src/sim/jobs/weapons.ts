// Armas en la mano (spec H4b §6.2): coger lo mejor del almacén y cambiarlo si sale algo mejor.
import { has, spend, stashOne } from '../bags';
import { pick } from '../rng';
import { doorsToPry } from './pry';
import type { Action, Survivor, Weapon, World } from '../types';

/** La hachuela (H5b2 §4) cuenta como la palanca. */
const RANK: Record<Weapon, number> = {
  knife: 1,
  bat: 2,
  axe: 3,
  hatchet: 4,
  crowbar: 4,
  machete: 5,
};
/** De mejor a peor (spec H4d §2). */
export const WEAPONS: readonly Weapon[] = ['machete', 'crowbar', 'hatchet', 'axe', 'bat', 'knife'];
const rank = (x: Weapon | null) => (x ? RANK[x] : 0);

/** ¿Puede talar? (permiso, sin gripe con descanso y sin otra arma fijada) */
export function canChop(s: Survivor): boolean {
  return s.work.chop && s.fever?.rest !== true && !(s.weaponLocked && s.equipped !== 'axe');
}

/** ¿Puede forzar puertas? (permiso de Saquear, sin gripe con descanso y sin otra arma fijada) */
export function canPry(s: Survivor): boolean {
  return s.work.loot && s.fever?.rest !== true && !(s.weaponLocked && s.equipped !== 'crowbar');
}

/**
 * Lo mejor del almacén que puede coger: el hacha no, si hay árboles marcados y no tala; la palanca
 * tampoco, si hay puertas que forzar y no saquea (H4d).
 */
export function bestInStorage(s: Survivor, w: World): Weapon | null {
  for (const k of WEAPONS) {
    if (w.storage.items[k] <= 0) continue;
    if (k === 'axe' && w.chopMarks.length > 0 && !canChop(s)) continue;
    if (k === 'crowbar' && !canPry(s) && doorsToPry(w).length > 0) continue;
    return k;
  }
  return null;
}

/** Con la palanca en la mano no la cambia mientras haya puertas que forzar (H4d). */
const keepsCrowbar = (s: Survivor, w: World) =>
  s.equipped === 'crowbar' && canPry(s) && doorsToPry(w).length > 0;

/**
 * Ni el hacha mientras haya árboles marcados y tale: el machete y la palanca son mejores armas
 * (H4d), y si no iría a cambiarla y volvería a por ella, sin talar nunca.
 */
const keepsAxe = (s: Survivor, chopMarked: boolean) =>
  s.equipped === 'axe' && chopMarked && canChop(s);

const better = (s: Survivor, w: World) =>
  !s.weaponLocked &&
  !keepsCrowbar(s, w) &&
  !keepsAxe(s, w.chopMarks.length > 0) &&
  rank(bestInStorage(s, w)) > rank(s.equipped);

/** Quien no saquea devuelve la palanca si hay puertas que forzar (H4d), como el hacha al talar. */
const returnsCrowbar = (s: Survivor, w: World) =>
  s.equipped === 'crowbar' && !s.weaponLocked && !canPry(s) && doorsToPry(w).length > 0;

const wantsSwap = (s: Survivor, w: World) => better(s, w) || returnsCrowbar(s, w);

/** Si en el almacén hay algo mejor que lo que lleva (o tiene que devolver la palanca), va. */
export function weaponJob(s: Survivor, w: World): Action | null {
  if (!wantsSwap(s, w)) return null;
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'swapWeapon' } };
}

export function swapWeaponStillWorth(s: Survivor, w: World): boolean {
  return wantsSwap(s, w);
}

/** En el almacén: deja lo suyo y coge lo mejor (si sigue habiendo algo mejor). */
export function startSwapWeapon(s: Survivor, w: World): Action {
  if (wantsSwap(s, w)) takeBest(s, w);
  return { type: 'idle', ticksLeft: 0 };
}

/** Deja en el almacén lo que lleve y coge lo mejor que pueda (puede quedarse sin nada). */
export function takeBest(s: Survivor, w: World): void {
  if (s.equipped) w.storage.items[s.equipped]++;
  s.equipped = null;
  const best = bestInStorage(s, w);
  if (!best) return;
  w.storage.items[best]--;
  s.equipped = best;
}

/**
 * Equipa sin más la mejor arma que lleve en la carga, si es mejor que la suya (spec general §5.3);
 * la de la mano pasa a la carga. Con el arma fijada, no. El hacha, como en el almacén: no, si hay
 * árboles marcados y no tala (ya la descargará); y quien tala no la cambia mientras haya árboles.
 */
export function equipFromPack(s: Survivor, chopMarked = false): void {
  if (s.weaponLocked || keepsAxe(s, chopMarked)) return;
  for (const k of WEAPONS) {
    if (has(s, k) <= 0) continue;
    if (k === 'axe' && chopMarked && !canChop(s)) continue;
    if (rank(k) <= rank(s.equipped)) return;
    // La de la mano pasa a la carga (o a una bolsa, H5b2): tiene que caber.
    spend(s, k);
    if (s.equipped && !stashOne(s, s.equipped)) {
      stashOne(s, k); // vuelve: cabe, acaba de salir
      continue;
    }
    s.equipped = k;
    return;
  }
}
