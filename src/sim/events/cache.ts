// Suceso 9, Alijo descubierto (spec H3c §3.2): alguien recuerda una despensa en una casa.
import { CACHE_CANS_MAX, CACHE_CANS_MIN } from '../balance';
import { logEvent } from '../log';
import { nextInt, pick } from '../rng';
import type { Building, World } from '../types';
import type { GameEvent } from './types';

/** Casas con algún mueble sin registrar. */
function houses(w: World): Building[] {
  return w.houses.filter((h) => w.containers.some((c) => c.houseId === h.id && !c.searched));
}

/** ¿Queda algo de su interior sin ver? */
function unexplored(w: World, h: Building): boolean {
  const { x, y, w: width, h: height } = h.rect;
  for (let j = y + 1; j < y + height - 1; j++)
    for (let i = x + 1; i < x + width - 1; i++) if (w.seen[j * w.grid.width + i] !== 1) return true;
  return false;
}

export const cacheEvent: GameEvent = {
  id: 'cache',
  tone: 'good',
  cooldownDays: 4,
  canHappen: (w) => houses(w).length > 0 && w.survivors.length > 0,
  happen(w) {
    const all = houses(w);
    const fresh = all.filter((h) => unexplored(w, h));
    const house = pick(w.rng, fresh.length > 0 ? fresh : all);
    const c = pick(
      w.rng,
      w.containers.filter((x) => x.houseId === house.id && !x.searched),
    );
    const cans = nextInt(w.rng, CACHE_CANS_MIN, CACHE_CANS_MAX);
    c.items.food += cans;
    const { x, y, w: width, h: height } = house.rect;
    for (let j = y; j < y + height; j++)
      for (let i = x; i < x + width; i++) w.seen[j * w.grid.width + i] = 1;
    const who = pick(w.rng, w.survivors);
    logEvent(w, { kind: 'cache', survivorId: who.id, houseId: house.id, cans });
  },
};
