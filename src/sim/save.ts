// Guardar y cargar la partida (spec H6b §1): la partida entera en JSON, con su versión y unos datos
// para enseñarla. La caja común va una sola vez (los sitios la comparten con la base) y al cargar se
// vuelve a enlazar, así la partida sigue exactamente igual.
import type { NarratorStyle, World, ZombieLevel } from './types';

/** Cambia cuando una partida guardada antes ya no sirve. */
export const SAVE_VERSION = 1;

/** Lo que se enseña de una partida guardada. */
export interface SaveMeta {
  day: number;
  seed: number;
  narrator: NarratorStyle;
  zombies: ZombieLevel;
  /** Cuándo se guardó (fecha real, ISO). */
  savedAt: string;
}

interface SaveFile {
  version: number;
  meta: SaveMeta;
  world: World;
}

/** La partida (desde la base) como texto. */
export function saveGame(base: World, meta: SaveMeta): string {
  const world = {
    ...base,
    siteMaps: base.siteMaps.map((m) => ({ ...m, world: { ...m.world, common: undefined } })),
  };
  return JSON.stringify({ version: SAVE_VERSION, meta, world });
}

/** La partida de un texto, o por qué no se puede cargar. */
export function loadGame(
  text: string,
): { world: World; meta: SaveMeta } | { error: 'broken' | 'version' } {
  let file: Partial<SaveFile>;
  try {
    file = JSON.parse(text) as Partial<SaveFile>;
  } catch {
    return { error: 'broken' };
  }
  if (typeof file !== 'object' || file === null || typeof file.version !== 'number')
    return { error: 'broken' };
  if (file.version !== SAVE_VERSION) return { error: 'version' };
  const world = file.world;
  if (!file.meta || !world || typeof world !== 'object' || !world.common || !world.grid)
    return { error: 'broken' };
  for (const m of world.siteMaps ?? []) m.world.common = world.common;
  return { world, meta: file.meta };
}
