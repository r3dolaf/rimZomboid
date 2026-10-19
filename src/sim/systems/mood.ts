import { MOOD_RATE_PER_TICK } from '../balance';
import { moodTarget } from '../mood';
import type { World } from '../types';

/** El ánimo se acerca poco a poco a su objetivo, sin pasarse. */
export function moodSystem(w: World): void {
  for (const s of w.survivors) {
    const target = moodTarget(s, w.tick, w.base.rect);
    const diff = target - s.needs.mood;
    s.needs.mood =
      Math.abs(diff) <= MOOD_RATE_PER_TICK
        ? target
        : s.needs.mood + Math.sign(diff) * MOOD_RATE_PER_TICK;
  }
}
