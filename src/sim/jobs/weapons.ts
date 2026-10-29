// Armas en la mano (spec H4b §6.2): coger lo mejor del almacén y cambiarlo si sale algo mejor.
import {
  AXE_DROP_PREF,
  HAND_BAG_DAMAGE,
  HAND_BAG_HIT,
  WEAPON_HANDS,
  WEAPON_STATS,
} from '../balance';
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

/**
 * Con una bolsa en la mano (H5b2 §4), lo que hace por segundo con los factores de la mano: el bate y
 * la palanca, peor; el hacha, un poco por debajo (hay que soltar la bolsa).
 */
function handBagValue(k: Weapon): number {
  const hands = WEAPON_HANDS[k];
  const f =
    hands === 'either' ? HAND_BAG_HIT * HAND_BAG_DAMAGE : hands === 'two' ? AXE_DROP_PREF : 1;
  return (WEAPON_STATS[k].damage / WEAPON_STATS[k].ticks) * f;
}
const HAND_BAG_ORDER = [...WEAPONS].sort((a, b) => handBagValue(b) - handBagValue(a));

/** Lo que vale un arma para él: el orden de H4d o, con bolsa en la mano, el de `handBagValue`. */
const rankFor = (s: Survivor, x: Weapon | null) =>
  !x ? 0 : s.bags.hand ? handBagValue(x) : RANK[x];
/** Sus armas de mejor a peor. */
const weaponsFor = (s: Survivor) => (s.bags.hand ? HAND_BAG_ORDER : WEAPONS);

/** ¿Tala con ella? El hacha o la hachuela (H5b2). */
export const chopsWith = (x: Weapon | null) => x === 'axe' || x === 'hatchet';

/** ¿Puede talar? (permiso, sin gripe con descanso y sin otra arma fijada) */
export function canChop(s: Survivor): boolean {
  return s.work.chop && s.fever?.rest !== true && !(s.weaponLocked && !chopsWith(s.equipped));
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
  for (const k of weaponsFor(s)) {
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
  rankFor(s, bestInStorage(s, w)) > rankFor(s, s.equipped);

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
  for (const k of weaponsFor(s)) {
    if (has(s, k) <= 0) continue;
    if (k === 'axe' && chopMarked && !canChop(s)) continue;
    if (rankFor(s, k) <= rankFor(s, s.equipped)) return;
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
