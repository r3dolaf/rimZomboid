import { darkness } from '../sim/clock';

/** Opacidad máxima de la capa de noche. */
export const NIGHT_ALPHA = 0.55;

/** Oscuridad de la capa de noche: oscurece de 19 a 21 h y aclara de 05 a 07 h. */
export function nightAlpha(tick: number): number {
  return darkness(tick) * NIGHT_ALPHA;
}

/** Lo que se oscurece además con tormenta. */
export const STORM_ALPHA = 0.25;

/** Oscuridad de la capa del cielo: la noche y, si la hay, la tormenta. */
export function skyAlpha(tick: number, storm: boolean): number {
  return nightAlpha(tick) + (storm ? STORM_ALPHA : 0);
}
