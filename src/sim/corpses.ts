// Cuerpos de zombi (spec H4d §7): un mueble de saqueo más, que se pudre o desaparece.
import {
  CORPSE_CLOTH_MAX,
  CORPSE_CLOTH_MIN,
  CORPSE_EMPTY_TICKS,
  CORPSE_ROT_TICKS,
  CORPSE_SMALL_CHANCE,
  CORPSE_WEAPON_CHANCE,
  CORPSE_WEAPONS,
} from './balance';
import { emptyInventory, isEmpty } from './items';
import { WEAPONS } from './jobs/weapons';
import { nextFloat, nextInt, weightedPick } from './rng';
import type { Container, World, Zombie } from './types';
import { tileOf } from './world';

const weaponsIn = (c: Container) => WEAPONS.reduce((n, k) => n + c.items[k], 0);

/** El cuerpo que deja un zombi al morir, con lo que lleva (azar de los zombis). */
export function leaveCorpse(w: World, z: Zombie): void {
  const rng = w.zombieRng;
  const items = emptyInventory();
  items.cloth = nextInt(rng, CORPSE_CLOTH_MIN, CORPSE_CLOTH_MAX);
  if (nextFloat(rng) < CORPSE_WEAPON_CHANCE) items[weightedPick(rng, { ...CORPSE_WEAPONS })]++;
  if (nextFloat(rng) < CORPSE_SMALL_CHANCE) items[nextFloat(rng) < 0.5 ? 'bandage' : 'food']++;
  const c: Container = {
    id: w.nextId++,
    houseId: -1,
    pos: tileOf(z.pos),
    kind: 'corpse',
    items,
    searched: false,
    designated: false,
    reservedBy: null,
    until: w.tick + CORPSE_ROT_TICKS,
  };
  w.weaponLog.fromCorpses += weaponsIn(c);
  w.containers.push(c);
}

/**
 * Registrado y vacío, se va en un día; si no, se pudre a los 3 días con lo que lleve. Mientras
 * alguien va a registrarlo (lo tiene reservado), espera: si no, llegaría a un cuerpo que ya no está.
 */
export function corpsesSystem(w: World): void {
  const due = (c: Container) =>
    c.kind === 'corpse' && c.until !== undefined && w.tick >= c.until && c.reservedBy === null;
  let gone = false;
  for (const c of w.containers) {
    if (c.kind !== 'corpse' || c.until === undefined) continue;
    if (c.searched && isEmpty(c.items) && c.until > w.tick + CORPSE_EMPTY_TICKS)
      c.until = w.tick + CORPSE_EMPTY_TICKS;
    if (due(c)) {
      w.weaponLog.rotted += weaponsIn(c);
      gone = true;
    }
  }
  if (gone) w.containers = w.containers.filter((c) => !due(c));
}
