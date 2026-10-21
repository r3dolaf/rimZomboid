// Salud y derribos (spec H4b §5).
import { DOWNED_TICKS } from './balance';
import type { Survivor, World } from './types';

/** Le quita Salud; a 0 cae derribado (lo que estuviera haciendo se corta). */
export function hurtSurvivor(w: World, s: Survivor, amount: number): void {
  s.health = Math.max(0, s.health - amount);
  if (s.health > 0 || s.action.type === 'downed') return;
  s.action = { type: 'downed', until: w.tick + DOWNED_TICKS };
  s.path = [];
}
