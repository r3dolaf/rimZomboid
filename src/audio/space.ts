// Volumen y lado de un sonido según lo que se ve (spec S1 §1.1).
import type { Point } from '../sim/types';

/** Lo que se ve del mapa, en casillas: la esquina de arriba a la izquierda y el tamaño. */
export interface ListenerView {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hasta dónde se oye, en pantallas (el lado mayor de lo que se ve) desde el centro. */
const REACH_SCREENS = 1.5;
/** Cuánto se va a un lado lo que está en el borde de la pantalla. */
const PAN_EDGE = 0.7;

/** Lo de en medio suena entero; más lejos, más bajo; a más de 1,5 pantallas, nada (`null`). */
export function placeSound(at: Point, v: ListenerView): { gain: number; pan: number } | null {
  const dx = at.x - (v.x + v.w / 2);
  const dy = at.y - (v.y + v.h / 2);
  const reach = REACH_SCREENS * Math.max(v.w, v.h);
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= reach) return null;
  const pan = Math.max(-1, Math.min(1, dx / (v.w / 2))) * PAN_EDGE;
  return { gain: (1 - d / reach) ** 2, pan: pan === 0 ? 0 : pan };
}
