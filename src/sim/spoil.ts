// Estropearse (spec V1 §1): una vez al día, a las SPOIL_HOUR, las hortalizas y los guisos pierden su
// parte, estén donde estén: en el almacén, en los montones y los muebles, encima de cada uno y en sus
// bolsas (también las guardadas), y en los viajes.
import { ROT_PER_DAY, SPOIL_HOUR, START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';
import { isBag, type Inventory } from './items';
import { logEvent } from './log';
import { nextFloat, type RngState } from './rng';
import type { Survivor, World } from './types';

const KINDS = Object.keys(ROT_PER_DAY) as (keyof typeof ROT_PER_DAY)[];

/** ¿Es la hora de estropearse? */
export const spoilsNow = (tick: number): boolean =>
  (tick + START_HOUR * TICKS_PER_HOUR) % TICKS_PER_DAY === SPOIL_HOUR * TICKS_PER_HOUR;

/** Lo que se estropea de un montón: la parte entera y la fracción con su probabilidad. */
function lost(n: number, perDay: number, rng: RngState): number {
  const exact = n * perDay;
  const whole = Math.floor(exact);
  return whole + (nextFloat(rng) < exact - whole ? 1 : 0);
}

/** Estropea lo fresco de `inv` y de las bolsas que haya dentro; devuelve lo perdido. */
export function rot(inv: Inventory, rng: RngState): Record<'veg' | 'meal', number> {
  const out = { veg: 0, meal: 0 };
  for (const k of KINDS) {
    if (inv[k] === 0) continue;
    const n = lost(inv[k], ROT_PER_DAY[k], rng);
    inv[k] -= n;
    out[k] += n;
  }
  for (const p of inv.pieces) {
    if (!isBag(p)) continue;
    const inner = rot(p.items, rng);
    for (const k of KINDS) out[k] += inner[k];
  }
  return out;
}

/** Lo que lleva alguien: en las manos y en las bolsas puestas. */
function rotOn(s: Survivor, rng: RngState): void {
  rot(s.carrying, rng);
  for (const b of Object.values(s.bags)) if (b) rot(b.items, rng);
}

/** A su hora, en todo el mapa; en la base, también los que van de viaje. Avisa de lo del almacén. */
export function spoilSystem(w: World): void {
  if (!spoilsNow(w.tick)) return;
  const store = rot(w.storage.items, w.rng);
  for (const p of w.piles) rot(p.items, w.rng);
  for (const c of w.containers) rot(c.items, w.rng);
  for (const s of w.survivors) rotOn(s, w.rng);
  for (const s of w.stranger?.survivors ?? []) rotOn(s, w.rng);
  if (w.mapId === 0)
    for (const t of w.common.expedition.travels) for (const s of t.members) rotOn(s, w.rng);
  if (store.veg + store.meal > 0) logEvent(w, { kind: 'spoiled', ...store });
}
