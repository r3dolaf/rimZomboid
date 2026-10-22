// Salud y derribos (spec H4b §5).
import {
  DOWNED_MAX_TICKS,
  DOWNED_TICKS,
  GET_UP_HEALTH,
  GET_UP_HEALTH_BED,
  HEALTH_PER_HOUR,
  TICKS_PER_HOUR,
  ZOMBIE_VISION,
} from './balance';
import { zombieInSight } from './danger';
import { logEvent } from './log';
import { addMemory } from './mood';
import type { Survivor, World } from './types';

/** Le quita Salud; a 0 cae derribado (lo que estuviera haciendo se corta). */
export function hurtSurvivor(w: World, s: Survivor, amount: number): void {
  s.health = Math.max(0, s.health - amount);
  if (s.health > 0 || s.action.type === 'downed') return;
  s.action = { type: 'downed', until: w.tick + DOWNED_TICKS };
  s.path = [];
  s.drafted = false; // H4e: el derribado sale del modo combate
  logEvent(w, { kind: 'downed', survivorId: s.id });
}

/** La Salud se recupera (más durmiendo, y más en cama); el derribado se levanta a su hora. */
export function healthSystem(w: World): void {
  for (const s of w.survivors) {
    const a = s.action;
    if (a.type === 'downed') {
      // A las 4 h se levanta, pero no si ve zombis cerca: se queda quieto hasta que se van (o
      // hasta las 8 h, que si no podía quedarse ahí para siempre).
      const limit = a.until - DOWNED_TICKS + DOWNED_MAX_TICKS;
      if (w.tick < a.until || (w.tick < limit && zombieInSight(w, s, ZOMBIE_VISION))) continue;
      s.health = a.inBed ? GET_UP_HEALTH_BED : GET_UP_HEALTH; // en cama, mejor (H4e)
      s.action = { type: 'idle', ticksLeft: 0 };
      addMemory(s, 'downed', w.tick);
      logEvent(w, { kind: 'gotUp', survivorId: s.id });
      continue;
    }
    const perHour =
      a.type === 'sleep'
        ? a.inBed
          ? HEALTH_PER_HOUR.bed
          : HEALTH_PER_HOUR.floor
        : HEALTH_PER_HOUR.awake;
    // Vendado (H4e), el doble.
    const bandaged = s.bandagedUntil > w.tick ? 2 : 1;
    s.health = Math.min(100, s.health + (bandaged * perHour) / TICKS_PER_HOUR);
  }
}
