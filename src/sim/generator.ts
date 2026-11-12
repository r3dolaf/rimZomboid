// E1: el generador en marcha (spec E1 §2–§3): gasta una hora de gasolina por hora, cuenta las horas
// para la nevera y hace ruido.
import { GEN_NOISE, GEN_NOISE_TICKS, TICKS_PER_HOUR } from './balance';
import { makeNoise } from './noise';
import { generatorOf, powered } from './power';

import type { World } from './types';

export function generatorSystem(w: World): void {
  if (!powered(w)) return;
  const g = generatorOf(w)!;
  if (w.tick % GEN_NOISE_TICKS === 0)
    makeNoise(w, { x: g.pos.x + 0.5, y: g.pos.y + 0.5 }, GEN_NOISE);
  if (w.tick % TICKS_PER_HOUR !== 0) return;
  g.fuel = Math.max(0, g.fuel! - 1);
  g.powered = Math.min(24, (g.powered ?? 0) + 1);
}
