// Muebles (spec H4a §4.2): la mesa da gusto al comer y la hoguera calienta y alumbra de noche.
import {
  CAMPFIRE_RANGE,
  FURNITURE_EVERY_TICKS,
  TABLE_RANGE,
  TICKS_PER_HOUR,
  VISION_DAY,
} from './balance';
import { darkness } from './clock';
import { addMemory } from './mood';
import type { Furniture, Survivor, World } from './types';
import { visionRadius } from './vision';

function near(s: Survivor, f: Furniture, range: number): boolean {
  const x = Math.floor(s.pos.x) - f.pos.x;
  const y = Math.floor(s.pos.y) - f.pos.y;
  return x * x + y * y <= range * range;
}

/** ¿Es una hoguera encendida? (V3 §4: con leña; las de antes, sin el campo, siempre.) */
export const isLitFire = (f: Furniture): boolean =>
  f.kind === 'campfire' && (f.fuel === undefined || f.fuel > 0);

/** ¿Tiene una mesa a TABLE_RANGE casillas o menos? */
export function nearTable(w: World, s: Survivor): boolean {
  return w.furniture.some((f) => f.kind === 'table' && near(s, f, TABLE_RANGE));
}

/** ¿Está junto al fuego (de noche, a CAMPFIRE_RANGE casillas o menos de una hoguera)? */
export function byTheFire(w: World, s: Survivor): boolean {
  return (
    darkness(w.tick) > 0 && w.furniture.some((f) => isLitFire(f) && near(s, f, CAMPFIRE_RANGE))
  );
}

/**
 * "Junto al fuego" es un recuerdo corto que se renueva mientras se cumple. Cada hora, las hogueras
 * con leña gastan una hora (V3 §4).
 */
export function furnitureSystem(w: World): void {
  if (w.tick % TICKS_PER_HOUR === 0)
    for (const f of w.furniture)
      if (f.kind === 'campfire' && f.fuel !== undefined) f.fuel = Math.max(0, f.fuel - 1);
  if (w.tick % FURNITURE_EVERY_TICKS !== 0 || !w.furniture.some(isLitFire)) return;
  for (const s of w.survivors) if (byTheFire(w, s)) addMemory(s, 'byTheFire', w.tick);
}

/** Radio de visión de un superviviente: de noche, junto a una hoguera, el de día. */
export function visionFor(w: World, s: Survivor): number {
  return byTheFire(w, s) ? VISION_DAY : visionRadius(w.tick);
}
