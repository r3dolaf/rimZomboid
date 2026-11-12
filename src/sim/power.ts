// E1: la corriente del generador (spec E1 §3): si está en marcha y lo que hace con ello (la nevera).
// Sin dependencias de otros sistemas, para que lo puedan mirar el agua, la vista y la radio.
import { GEN_FRIDGE } from './balance';
import type { Furniture, World } from './types';

/** El generador de ese mapa, o `null`. */
export const generatorOf = (w: World): Furniture | null =>
  w.furniture.find((f) => f.kind === 'generator') ?? null;

/** ¿Hay corriente? (El generador encendido y con gasolina.) */
export function powered(w: World): boolean {
  const g = generatorOf(w);
  return g !== null && g.on === true && (g.fuel ?? 0) > 0;
}

/** ¿Está encendido, contando lo pedido en pausa? (Para la interfaz.) */
export function generatorOn(w: World): boolean {
  let on = generatorOf(w)?.on ?? false;
  for (const o of w.orders) if (o.type === 'setGenerator') on = o.on;
  return on;
}

/** Encender o apagar el generador de ese mapa (si lo hay). */
export function setGenerator(w: World, on: boolean): void {
  const g = generatorOf(w);
  if (g) g.on = on;
}

/**
 * La nevera (§3): por cuánto se multiplica lo que se estropea del almacén, según las horas en marcha
 * desde la mañana anterior (con 24, GEN_FRIDGE; sin generador, 1).
 */
export function fridgeMult(w: World): number {
  const hours = Math.min(24, generatorOf(w)?.powered ?? 0);
  return 1 - ((1 - GEN_FRIDGE) * hours) / 24;
}
