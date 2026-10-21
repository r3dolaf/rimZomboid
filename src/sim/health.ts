// Salud y derribos (spec H4b §5).
import { DOWNED_TICKS, GET_UP_HEALTH, HEALTH_PER_HOUR, TICKS_PER_HOUR } from './balance';
import { logEvent } from './log';
import { addMemory } from './mood';
import type { Survivor, World } from './types';

/** Le quita Salud; a 0 cae derribado (lo que estuviera haciendo se corta). */
export function hurtSurvivor(w: World, s: Survivor, amount: number): void {
  s.health = Math.max(0, s.health - amount);
  if (s.health > 0 || s.action.type === 'downed') return;
  s.action = { type: 'downed', until: w.tick + DOWNED_TICKS };
  s.path = [];
  logEvent(w, { kind: 'downed', survivorId: s.id });
}

/** La Salud se recupera (más durmiendo, y más en cama); el derribado se levanta a su hora. */
export function healthSystem(w: World): void {
  for (const s of w.survivors) {
    const a = s.action;
    if (a.type === 'downed') {
      if (w.tick < a.until) continue;
      s.health = GET_UP_HEALTH;
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
    s.health = Math.min(100, s.health + perHour / TICKS_PER_HOUR);
  }
}
