// La radio (spec C1 §1–2): se construye en la base con una radio encontrada en un sitio, se carga con
// pilas y, encendida, se escucha.
import type { Furniture, World } from './types';

/** La radio de ese mapa, o `null`. */
export const radioOf = (w: World): Furniture | null =>
  w.furniture.find((f) => f.kind === 'radio') ?? null;

/** ¿Está encendida, contando lo pedido en pausa? (Para la interfaz.) */
export function radioOn(w: World): boolean {
  let on = radioOf(w)?.on ?? false;
  for (const o of w.orders) if (o.type === 'setRadio') on = o.on;
  return on;
}

/** Encender o apagar la radio de ese mapa (si la hay). */
export function setRadio(w: World, on: boolean): void {
  const r = radioOf(w);
  if (r) r.on = on;
}
