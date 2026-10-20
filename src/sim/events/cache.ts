// Suceso 9, Alijo descubierto (spec H3c §3.2): alguien recuerda una despensa en una casa.
import { CACHE_CANS_MAX, CACHE_CANS_MIN } from '../balance';
import { logEvent } from '../log';
import { nextInt, pick } from '../rng';
import type { Building, World } from '../types';
import type { GameEvent } from './types';

/** Casas con algún mueble. */
function houses(w: World): Building[] {
  return w.houses.filter((h) => w.containers.some((c) => c.houseId === h.id));
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
    // Mejor una casa sin explorar; si no, una con muebles sin registrar; si no, cualquiera.
    const all = houses(w);
    const unsearched = (h: Building) => w.containers.some((c) => c.houseId === h.id && !c.searched);
    const options = [all.filter((h) => unexplored(w, h)), all.filter(unsearched), all];
    const house = pick(
      w.rng,
      options.find((o) => o.length > 0)!,
    );
    const inHouse = w.containers.filter((c) => c.houseId === house.id);
    const fresh = inHouse.filter((c) => !c.searched);
    const c = pick(w.rng, fresh.length > 0 ? fresh : inHouse);
    const cans = nextInt(w.rng, CACHE_CANS_MIN, CACHE_CANS_MAX);
    c.items.food += cans;
    c.searched = false; // una despensa escondida: hay que volver a mirar
    const { x, y, w: width, h: height } = house.rect;
    for (let j = y; j < y + height; j++)
      for (let i = x; i < x + width; i++) w.seen[j * w.grid.width + i] = 1;
    const who = pick(w.rng, w.survivors);
    logEvent(w, { kind: 'cache', survivorId: who.id, houseId: house.id, cans });
  },
};
