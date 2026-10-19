import { darkness } from '../sim/clock';

/** Opacidad máxima de la capa de noche. */
export const NIGHT_ALPHA = 0.55;

/** Oscuridad de la capa de noche: oscurece de 19 a 21 h y aclara de 05 a 07 h. */
export function nightAlpha(tick: number): number {
  return darkness(tick) * NIGHT_ALPHA;
}
