import { EAT_RESTORE } from '../balance';
import { isNight } from '../clock';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import type { World } from '../types';

/** Avanzan y terminan las actividades: comer, dormir y la crisis. */
export function activitiesSystem(w: World): void {
  for (const s of w.survivors) {
    const a = s.action;
    if (a.type === 'eat') {
      if (--a.ticksLeft > 0) continue;
      // Puede que otro se haya comido la última lata mientras tanto.
      if (w.storage.items.food > 0) {
        w.storage.items.food--;
        if (w.storage.items.food === 0) logEvent(w, { kind: 'outOfFood' });
        s.needs.hunger = Math.min(100, s.needs.hunger + EAT_RESTORE);
        addMemory(s, 'ate', w.tick);
      }
      s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'sleep') {
      // Con el sueño lleno se levanta, pero nunca de noche.
      if (s.needs.sleep < 100 || isNight(w.tick)) continue;
      addMemory(s, a.inBed ? 'sleptInBed' : 'sleptOnFloor', w.tick);
      s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'crisis') {
      if (--a.ticksLeft > 0) continue;
      addMemory(s, 'vented', w.tick);
      logEvent(w, { kind: 'vented', survivorId: s.id });
      s.action = { type: 'idle', ticksLeft: 0 };
    }
  }
}
