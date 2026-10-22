// Armas en la mano (spec H4b §6.2): coger lo mejor del almacén y cambiarlo si sale algo mejor.
import { ITEM_WEIGHT_KG } from '../balance';
import { weightOf } from '../items';
import { pick } from '../rng';
import { capacityKg } from '../skills';
import type { Action, Survivor, Weapon, World } from '../types';

const RANK: Record<Weapon, number> = { knife: 1, bat: 2, axe: 3, crowbar: 4, machete: 5 };
/** De mejor a peor (spec H4d §2). */
export const WEAPONS: readonly Weapon[] = ['machete', 'crowbar', 'axe', 'bat', 'knife'];
const rank = (x: Weapon | null) => (x ? RANK[x] : 0);

/** ¿Puede talar? (permiso, sin gripe con descanso y sin otra arma fijada) */
export function canChop(s: Survivor): boolean {
  return s.work.chop && s.sick?.plan !== 'rest' && !(s.weaponLocked && s.equipped !== 'axe');
}

/** Lo mejor del almacén que puede coger: el hacha no, si hay árboles marcados y no tala. */
export function bestInStorage(s: Survivor, w: World): Weapon | null {
  for (const k of WEAPONS) {
    if (w.storage.items[k] <= 0) continue;
    if (k === 'axe' && w.chopMarks.length > 0 && !canChop(s)) continue;
    return k;
  }
  return null;
}

const better = (s: Survivor, w: World) =>
  !s.weaponLocked && rank(bestInStorage(s, w)) > rank(s.equipped);

/** Si en el almacén hay algo mejor que lo que lleva, va a cambiarlo. */
export function weaponJob(s: Survivor, w: World): Action | null {
  if (!better(s, w)) return null;
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'swapWeapon' } };
}

export function swapWeaponStillWorth(s: Survivor, w: World): boolean {
  return better(s, w);
}

/** En el almacén: deja lo suyo y coge lo mejor (si sigue habiendo algo mejor). */
export function startSwapWeapon(s: Survivor, w: World): Action {
  if (better(s, w)) takeBest(s, w);
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
 * árboles marcados y no tala (ya la descargará).
 */
export function equipFromPack(s: Survivor, chopMarked = false): void {
  if (s.weaponLocked) return;
  for (const k of WEAPONS) {
    if (s.carrying[k] <= 0) continue;
    if (k === 'axe' && chopMarked && !canChop(s)) continue;
    if (rank(k) <= rank(s.equipped)) return;
    // La de la mano pasa a la carga: tiene que caber (un machete pesa menos que un hacha).
    const swapKg = (s.equipped ? ITEM_WEIGHT_KG[s.equipped] : 0) - ITEM_WEIGHT_KG[k];
    if (weightOf(s.carrying) + swapKg > capacityKg(s) + 1e-9) continue;
    s.carrying[k]--;
    if (s.equipped) s.carrying[s.equipped]++;
    s.equipped = k;
    return;
  }
}
