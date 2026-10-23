// Salud y derribos (spec H4b §5; desde H5 la Salud es el dolor de las heridas, ver body.ts).
import {
  DOWNED_HARD_MAX_TICKS,
  DOWNED_MAX_TICKS,
  DOWNED_TICKS,
  FAINT_BELOW,
  FAINT_UNTIL,
  GET_UP_HEALTH,
  GET_UP_CLEAR_RANGE,
  ZOMBIE_VISION,
} from './balance';
import { bloodTick } from './blood';
import { knockDown, refreshHealth } from './body';
import { zombieInSight } from './danger';
import { logEvent } from './log';
import { addMemory } from './mood';
import type { Survivor, World } from './types';

/** La Salud (el dolor) se recalcula; a 0 cae derribado; el derribado se levanta a su hora. */
export function healthSystem(w: World): void {
  for (const s of w.survivors) healthOf(w, s, true);
  for (const s of w.stranger?.survivors ?? []) healthOf(w, s, false); // H4e
}

/** Lo de cada uno; `colonist`: si es de la colonia (si no, ni recuerdos ni registro). */
function healthOf(w: World, s: Survivor, colonist: boolean): void {
  bloodTick(w, s);
  refreshHealth(w, s);
  const a = s.action;
  if (a.type !== 'downed') {
    // Por el dolor o por la sangre (se desmaya), al suelo.
    if (s.health <= 0 || s.blood < FAINT_BELOW) knockDown(w, s);
    return;
  }
  // A las 4 h se levanta si el dolor ha bajado (Salud de 15 o más), pero no si ve zombis cerca:
  // se queda quieto hasta que se van (o hasta las 8 h, que si no podía quedarse ahí para siempre).
  // Pasadas las 8 h, si tiene uno encima, tampoco (H4e: en un asedio volvía a caer al momento),
  // pero no más de 16 h.
  if (w.tick < a.until || s.health < GET_UP_HEALTH || s.blood < FAINT_UNTIL) return;
  const since = w.tick - (a.until - DOWNED_TICKS);
  const range =
    since < DOWNED_MAX_TICKS
      ? ZOMBIE_VISION
      : since < DOWNED_HARD_MAX_TICKS
        ? GET_UP_CLEAR_RANGE
        : 0;
  if (range > 0 && zombieInSight(w, s, range)) return;
  s.action = { type: 'idle', ticksLeft: 0 };
  if (!colonist) return;
  addMemory(s, 'downed', w.tick);
  logEvent(w, { kind: 'gotUp', survivorId: s.id });
}
