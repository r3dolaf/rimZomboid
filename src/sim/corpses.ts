// Cuerpos de zombi (spec H4d §7): un mueble de saqueo más, que se pudre o desaparece.
import {
  CORPSE_EMPTY_TICKS,
  CORPSE_ROT_TICKS,
  CORPSE_SMALL_CHANCE,
  CORPSE_WEAPON_CHANCE,
  CORPSE_WEAPONS,
} from './balance';
import { piecesGone } from './clothes';
import { emptyInventory, isEmpty } from './items';
import { WEAPONS } from './jobs/weapons';
import { dropPile } from './piles';
import { nextFloat, weightedPick } from './rng';
import type { Container, World, Zombie } from './types';
import { tileOf } from './world';

const weaponsIn = (c: Container) => WEAPONS.reduce((n, k) => n + c.items[k], 0);

/**
 * El cuerpo que deja un zombi al morir, con lo que lleva (azar de los zombis) y su ropa (H5b: la
 * tela ya no sale de los cuerpos, sale de descoser su ropa).
 */
export function leaveCorpse(w: World, z: Zombie): void {
  const rng = w.zombieRng;
  const items = emptyInventory();
  if (nextFloat(rng) < CORPSE_WEAPON_CHANCE) items[weightedPick(rng, { ...CORPSE_WEAPONS })]++;
  if (nextFloat(rng) < CORPSE_SMALL_CHANCE) items[nextFloat(rng) < 0.5 ? 'bandage' : 'food']++;
  // Su ropa (H5b §7), de un zombi (la de un colono que se levantó sigue siendo de un colono).
  for (const g of z.worn) g.from ??= 'zombie';
  items.pieces.push(...z.worn);
  z.worn = [];
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
 * Registrado y vacío, se va en un día; si no, se pudre a los 3 días con lo que lleve (el de una
 * persona, H5, lo deja en el suelo). Mientras alguien va a registrarlo (lo tiene reservado),
 * espera: si no, llegaría a un cuerpo que ya no está.
 */
export function corpsesSystem(w: World): void {
  const due = (c: Container) =>
    c.kind === 'corpse' && c.until !== undefined && w.tick >= c.until && c.reservedBy === null;
  let gone = false;
  for (const c of w.containers) {
    if (c.kind !== 'corpse' || c.until === undefined) continue;
    if (c.searched && isEmpty(c.items) && c.until > w.tick + CORPSE_EMPTY_TICKS)
      c.until = w.tick + CORPSE_EMPTY_TICKS;
    if (!due(c)) continue;
    gone = true;
    // El de una persona (H5) deja en el suelo lo que llevaba; lo del zombi se pudre con él.
    if (c.name !== undefined) dropPile(w, c.pos, c.items);
    else {
      w.weaponLog.rotted += weaponsIn(c);
      piecesGone(w, c.items.pieces); // H5b: su ropa se pudre con él
    }
  }
  if (gone) w.containers = w.containers.filter((c) => !due(c));
}
