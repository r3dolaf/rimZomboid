import {
  FLOOR_SLEEP_FACTOR,
  GLUTTON_HUNGER_MULT,
  HUNGER_PER_TICK,
  SLEEP_DRAIN_PER_TICK,
  SLEEP_GAIN_PER_TICK,
  SLEEPYHEAD_SLEEP_MULT,
  SOCIAL_PER_TICK,
} from '../balance';
import type { World } from '../types';

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Hambre, sueño y necesidad social avanzan; los recuerdos caducados se olvidan. */
export function needsSystem(w: World): void {
  for (const s of w.survivors) {
    const n = s.needs;
    const hungerMult = s.traits.includes('glutton') ? GLUTTON_HUNGER_MULT : 1;
    n.hunger = clamp(n.hunger - HUNGER_PER_TICK * hungerMult);
    n.social = clamp(n.social - SOCIAL_PER_TICK);

    if (s.action.type === 'sleep') {
      const factor = s.action.inBed ? 1 : FLOOR_SLEEP_FACTOR;
      n.sleep = clamp(n.sleep + SLEEP_GAIN_PER_TICK * factor);
    } else {
      const sleepMult = s.traits.includes('sleepyhead') ? SLEEPYHEAD_SLEEP_MULT : 1;
      n.sleep = clamp(n.sleep - SLEEP_DRAIN_PER_TICK * sleepMult);
    }

    if (s.memories.some((m) => m.expiresAt <= w.tick))
      s.memories = s.memories.filter((m) => m.expiresAt > w.tick);
  }
}
