import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../sim/balance';

/** Opacidad máxima de la capa de noche. */
export const NIGHT_ALPHA = 0.55;

/** Oscuridad de la capa de noche: oscurece de 19 a 21 h y aclara de 05 a 07 h. */
export function nightAlpha(tick: number): number {
  const hour = (((tick + START_HOUR * TICKS_PER_HOUR) % TICKS_PER_DAY) / TICKS_PER_HOUR + 24) % 24;
  if (hour >= 21 || hour < 5) return NIGHT_ALPHA;
  if (hour >= 19) return ((hour - 19) / 2) * NIGHT_ALPHA;
  if (hour < 7) return ((7 - hour) / 2) * NIGHT_ALPHA;
  return 0;
}
